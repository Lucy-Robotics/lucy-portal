import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { NodeResult, Result } from "axe-core";
import { mockBackend } from "./fixtures.ts";
import { AXE_ATTACHMENT, type ScanIssue, type ScanResult } from "./reporter.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

const ROUTES = [
    "/",
    "/download",
    "/blog",
    "/blog/1",
    "/roadmap",
    "/accessibility",
    "/legal",
    "/does-not-exist",
];

test.beforeEach(async ({ page }) => {
    await mockBackend(page);
});

for (const route of ROUTES) {
    test(`${route} has no accessibility violations`, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState("networkidle");

        await expectNoViolations(page, new AxeBuilder({ page }), route);
    });
}

test("main buttons keep their contrast on hover", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hover on touch screens");

    await page.goto("/download");
    await page.waitForLoadState("networkidle");

    for (const button of await page.locator(".header__button--main:visible").all()) {
        await button.hover();
        await page.waitForTimeout(250); // let the colour transition finish
        await expectNoViolations(
            page,
            new AxeBuilder({ page }).include(".header__button--main"),
            `/download, hovering "${(await button.innerText()).trim()}"`,
        );
    }
});

async function expectNoViolations(page: Page, builder: AxeBuilder, label: string) {
    const { violations, incomplete, passes } = await builder.withTags(WCAG_TAGS).analyze();

    const isUnresolvedContrast = (result: Result, node: NodeResult) =>
        result.id === "color-contrast" && !isOverRobotCanvas(node);

    const failures = [
        ...violations.map((result) => toIssue(result, result.nodes)),
        ...incomplete.map((result) =>
            toIssue(result, result.nodes.filter((node) => isUnresolvedContrast(result, node))),
        ),
    ].filter((issue) => issue.nodes.length > 0);

    const toReview = incomplete
        .map((result) => toIssue(result, result.nodes.filter((node) => !isUnresolvedContrast(result, node))))
        .filter((issue) => issue.nodes.length > 0);

    const scan: ScanResult = { label, url: page.url(), failures, toReview, passedRules: passes.length };
    await test.info().attach(AXE_ATTACHMENT, { body: JSON.stringify(scan), contentType: "application/json" });

    const report = failures.flatMap((issue) =>
        issue.nodes.map((node) => `[${issue.id}] ${node.target}
    ${node.summary}`),
    );

    expect(report, `Accessibility issues on ${page.url()}`).toEqual([]);
}

function toIssue(result: Result, nodes: NodeResult[]): ScanIssue {
    return {
        id: result.id,
        impact: result.impact ?? null,
        help: result.help,
        helpUrl: result.helpUrl,
        nodes: nodes.map((node) => ({
            target: node.target.join(" "),
            summary: node.failureSummary ?? node.any.map((check) => check.message).join("; "),
        })),
    };
}

function isOverRobotCanvas(node: NodeResult) {
    return node.any.some(
        (check) =>
            check.relatedNodes?.length &&
            check.relatedNodes.every((related) => related.html.startsWith('<canvas data-engine="three.js')),
    );
}
