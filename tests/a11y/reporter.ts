import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

export const AXE_ATTACHMENT = "axe-results";

export type ScanIssue = {
    id: string;
    impact: string | null;
    help: string;
    helpUrl: string;
    nodes: { target: string; summary: string }[];
};

export type ScanResult = {
    label: string;
    url: string;
    failures: ScanIssue[];
    toReview: ScanIssue[];
    passedRules: number;
};

type Attempt = {
    status: TestResult["status"];
    error?: string;
    scans: ScanResult[];
};

type RowState = "passed" | "flaky" | "failed" | "skipped";

type Row = {
    project: string;
    title: string;
    state: RowState;
    error?: string;
    scans: ScanResult[];
};

const OUTPUT_DIR = "a11y-report";

export default class A11yReporter implements Reporter {
    private tests = new Map<string, { test: TestCase; attempts: Attempt[] }>();

    // Every attempt is kept: an issue found before a passing retry must still be reported.
    onTestEnd(test: TestCase, result: TestResult) {
        const entry = this.tests.get(test.id) ?? { test, attempts: [] };
        entry.attempts.push({
            status: result.status,
            error: result.error ? stripAnsi(result.error.message ?? "").split("\n")[0] : undefined,
            scans: result.attachments
                .filter((attachment) => attachment.name === AXE_ATTACHMENT && attachment.body)
                .map((attachment) => JSON.parse(attachment.body!.toString()) as ScanResult),
        });
        this.tests.set(test.id, entry);
    }

    onEnd(result: FullResult) {
        const rows = [...this.tests.values()].map(({ test, attempts }) => toRow(test, attempts)).sort(
            (a, b) => a.project.localeCompare(b.project) || a.title.localeCompare(b.title),
        );
        const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

        mkdirSync(OUTPUT_DIR, { recursive: true });
        const markdown = renderMarkdown(rows, result.status, generatedAt);
        writeFileSync(path.join(OUTPUT_DIR, "summary.md"), markdown);
        writeFileSync(path.join(OUTPUT_DIR, "index.html"), renderHtml(rows, result.status, generatedAt));

        if (process.env.GITHUB_STEP_SUMMARY) {
            appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
        }

        console.log(`\nAccessibility report: ${path.resolve(OUTPUT_DIR, "index.html")}`);
    }

    printsToStdio() {
        return false;
    }
}

function toRow(test: TestCase, attempts: Attempt[]): Row {
    const outcome = test.outcome();
    const state: RowState =
        outcome === "expected" ? "passed" : outcome === "unexpected" ? "failed" : outcome;
    const retried = attempts.length > 1;

    return {
        project: test.parent.project()?.name ?? "",
        title: test.title,
        state,
        error: attempts.find((attempt) => attempt.error)?.error,
        scans: attempts.flatMap((attempt, index) =>
            attempt.scans.map((scan) =>
                retried ? { ...scan, label: `${scan.label} (attempt ${index + 1}: ${attempt.status})` } : scan,
            ),
        ),
    };
}

const countNodes = (issues: ScanIssue[]) => issues.reduce((sum, issue) => sum + issue.nodes.length, 0);

function totals(rows: Row[]) {
    const scans = rows.flatMap((row) => row.scans);
    const count = (state: RowState) => rows.filter((row) => row.state === state).length;
    return {
        tests: rows.length - count("skipped"),
        passed: count("passed"),
        flaky: count("flaky"),
        failed: count("failed"),
        failures: scans.reduce((sum, scan) => sum + countNodes(scan.failures), 0),
        toReview: scans.reduce((sum, scan) => sum + countNodes(scan.toReview), 0),
    };
}

function renderMarkdown(rows: Row[], status: FullResult["status"], generatedAt: string) {
    const total = totals(rows);
    const icon: Record<RowState, string> = { passed: "✅", flaky: "⚠️", failed: "❌", skipped: "⏭️" };
    const lines = [
        `## Accessibility report ${status !== "passed" ? "❌" : total.flaky ? "⚠️" : "✅"}`,
        "",
        `WCAG 2.2 AA (axe-core) · ${total.tests} checks · ${total.failed} failing · ${total.flaky} flaky · ` +
            `${total.failures} issues · ${total.toReview} to review by hand · ${generatedAt}`,
        "",
        "| | Viewport | Check | Issues | To review | Rules passed |",
        "| --- | --- | --- | ---: | ---: | ---: |",
        ...rows.map((row) => {
            const failures = row.scans.reduce((sum, scan) => sum + countNodes(scan.failures), 0);
            const review = row.scans.reduce((sum, scan) => sum + countNodes(scan.toReview), 0);
            const passed = Math.max(0, ...row.scans.map((scan) => scan.passedRules));
            return `| ${icon[row.state]} | ${row.project} | ${escapeMd(row.title)} | ${failures} | ${review} | ${passed} |`;
        }),
        "",
    ];

    const failing = rows.filter((row) => row.state === "failed" || row.state === "flaky");
    if (failing.length > 0) {
        lines.push("### Issues", "");
        for (const row of failing) {
            lines.push(`**${row.project} · ${escapeMd(row.title)}${row.state === "flaky" ? " (flaky)" : ""}**`, "");
            if (row.error && row.scans.every((scan) => scan.failures.length === 0)) {
                lines.push(`- Test error: ${escapeMd(row.error)}`);
            }
            for (const scan of row.scans) {
                for (const issue of scan.failures) {
                    lines.push(`- [\`${issue.id}\`](${issue.helpUrl}) (${issue.impact ?? "n/a"}): ${escapeMd(issue.help)}`);
                    for (const node of issue.nodes) lines.push(`  - \`${node.target}\``);
                }
            }
            lines.push("");
        }
    }

    const reviewed = rows.flatMap((row) =>
        row.scans.flatMap((scan) => scan.toReview.map((issue) => ({ row, scan, issue }))),
    );
    if (reviewed.length > 0) {
        lines.push("<details><summary>To review by hand</summary>", "");
        for (const { row, scan, issue } of reviewed) {
            lines.push(`- ${row.project} · ${escapeMd(scan.label)}: [\`${issue.id}\`](${issue.helpUrl}), ${issue.nodes.length} element(s)`);
        }
        lines.push("", "</details>", "");
    }

    return lines.join("\n");
}

function escapeMd(text: string) {
    return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function renderHtml(rows: Row[], status: FullResult["status"], generatedAt: string) {
    const total = totals(rows);
    const projects = [...new Set(rows.map((row) => row.project))];

    const issueList = (issues: ScanIssue[], kind: "fail" | "review") =>
        issues
            .map(
                (issue) => `
                <li class="issue issue--${kind}">
                    <div class="issue__head">
                        <a href="${escapeHtml(issue.helpUrl)}" target="_blank" rel="noopener noreferrer"><code>${escapeHtml(issue.id)}</code></a>
                        ${issue.impact ? `<span class="impact impact--${escapeHtml(issue.impact)}">${escapeHtml(issue.impact)}</span>` : ""}
                        <span>${escapeHtml(issue.help)}</span>
                    </div>
                    <ul class="nodes">
                        ${issue.nodes
                            .map(
                                (node) =>
                                    `<li><code>${escapeHtml(node.target)}</code><pre>${escapeHtml(node.summary)}</pre></li>`,
                            )
                            .join("")}
                    </ul>
                </li>`,
            )
            .join("");

    const rowHtml = (row: Row) => {
        const state = row.state;
        const failures = row.scans.reduce((sum, scan) => sum + countNodes(scan.failures), 0);
        const review = row.scans.reduce((sum, scan) => sum + countNodes(scan.toReview), 0);
        const body = row.scans
            .map(
                (scan) => `
                <section class="scan">
                    <h4>${escapeHtml(scan.label)} <span class="muted">· ${escapeHtml(scan.url)} · ${scan.passedRules} rules passed</span></h4>
                    ${scan.failures.length ? `<h5>Issues</h5><ul class="issues">${issueList(scan.failures, "fail")}</ul>` : ""}
                    ${scan.toReview.length ? `<h5>To review by hand</h5><ul class="issues">${issueList(scan.toReview, "review")}</ul>` : ""}
                    ${!scan.failures.length && !scan.toReview.length ? `<p class="muted">Nothing to report.</p>` : ""}
                </section>`,
            )
            .join("");

        return `
            <details class="row row--${state}" ${state === "failed" || state === "flaky" ? "open" : ""}>
                <summary>
                    <span class="badge badge--${state}">${state}</span>
                    <span class="row__title">${escapeHtml(row.title)}</span>
                    <span class="count ${failures ? "count--fail" : ""}">${failures} issues</span>
                    <span class="count ${review ? "count--review" : ""}">${review} to review</span>
                </summary>
                <div class="row__body">
                    ${row.error ? `<p class="error">${escapeHtml(row.error)}</p>` : ""}
                    ${body || `<p class="muted">${state === "skipped" ? "Skipped." : "No scan recorded."}</p>`}
                </div>
            </details>`;
    };

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Accessibility report</title>
<style>
    :root {
        --bg: #141414; --raised: #1a1a1a; --border: #3f3f3f;
        --text: #ffffff; --muted: #b7b7b7;
        --ok: #00ff41; --fail: #ff6b6b; --review: #e6c84c;
        color-scheme: dark;
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 2rem 1rem; background: var(--bg); color: var(--text); font: 15px/1.5 "IBM Plex Mono", ui-monospace, monospace; }
    main { max-width: 1100px; margin: 0 auto; }
    h1 { margin: 0 0 0.25rem; font-size: 1.6rem; }
    h2 { margin: 2rem 0 0.75rem; font-size: 1.1rem; text-transform: capitalize; }
    h4 { margin: 0 0 0.5rem; font-size: 0.95rem; }
    h5 { margin: 0.75rem 0 0.25rem; font-size: 0.85rem; color: var(--muted); text-transform: uppercase; }
    a { color: var(--ok); }
    code { font-family: inherit; }
    .muted { color: var(--muted); font-weight: normal; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin: 1.5rem 0; }
    .stat { padding: 1rem; background: var(--raised); border: 1px solid var(--border); }
    .stat strong { display: block; font-size: 1.8rem; }
    .stat--fail strong { color: var(--fail); }
    .stat--review strong { color: var(--review); }
    .stat--ok strong { color: var(--ok); }
    .row { margin-bottom: 0.5rem; background: var(--raised); border: 1px solid var(--border); }
    .row--failed { border-color: var(--fail); }
    .row--flaky { border-color: var(--review); }
    .row summary { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; cursor: pointer; }
    .row summary:focus-visible { outline: 2px solid var(--ok); outline-offset: -2px; }
    .row__title { flex: 1; min-width: 12rem; }
    .row__body { padding: 0 1rem 1rem; }
    .badge { padding: 0.1rem 0.5rem; font-size: 0.8rem; font-weight: bold; text-transform: uppercase; color: #000; }
    .badge--passed { background: var(--ok); }
    .badge--failed { background: var(--fail); }
    .badge--flaky { background: var(--review); }
    .badge--skipped { background: var(--muted); }
    .count { font-size: 0.85rem; color: var(--muted); }
    .count--fail { color: var(--fail); }
    .count--review { color: var(--review); }
    .scan { padding-top: 0.75rem; border-top: 1px solid var(--border); }
    .scan + .scan { margin-top: 0.75rem; }
    .issues, .nodes { margin: 0; padding: 0; list-style: none; }
    .issue { margin-top: 0.5rem; padding: 0.5rem 0.75rem; border-left: 3px solid var(--fail); background: var(--bg); }
    .issue--review { border-left-color: var(--review); }
    .issue__head { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; }
    .impact { font-size: 0.75rem; text-transform: uppercase; color: var(--muted); }
    .impact--critical, .impact--serious { color: var(--fail); }
    .nodes li { margin-top: 0.5rem; overflow-wrap: anywhere; }
    .nodes pre { margin: 0.25rem 0 0; white-space: pre-wrap; color: var(--muted); font: inherit; font-size: 0.85rem; }
    .error { color: var(--fail); white-space: pre-wrap; }
</style>
</head>
<body>
<main>
    <h1>Accessibility report ${status !== "passed" ? "· failed" : total.flaky ? "· passed with flaky checks" : "· passed"}</h1>
    <p class="muted">WCAG 2.2 AA, checked with axe-core · generated ${escapeHtml(generatedAt)}</p>

    <div class="stats">
        <div class="stat ${total.failed ? "stat--fail" : total.flaky ? "stat--review" : "stat--ok"}"><strong>${total.passed}/${total.tests}</strong>checks passing${total.flaky ? `, ${total.flaky} flaky` : ""}</div>
        <div class="stat ${total.failures ? "stat--fail" : "stat--ok"}"><strong>${total.failures}</strong>issues</div>
        <div class="stat ${total.toReview ? "stat--review" : "stat--ok"}"><strong>${total.toReview}</strong>to review by hand</div>
    </div>

    ${projects
        .map(
            (project) => `
    <h2>${escapeHtml(project)}</h2>
    ${rows.filter((row) => row.project === project).map(rowHtml).join("")}`,
        )
        .join("")}
</main>
</body>
</html>
`;
}

function escapeHtml(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function stripAnsi(text: string) {
    return text.replace(new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g"), "");
}
