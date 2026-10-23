import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import type { NodeResult, Result } from "axe-core";
import { mockBackend } from "./fixtures.ts";
import { AXE_ATTACHMENT, type ScanIssue, type ScanResult } from "./reporter.ts";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// The decorative layers the robot scene draws into (see RobotShowcase.tsx).
const ROBOT_LAYERS = ".robot-layer, .robot-backdrop, .robot-glow";

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
        await openPage(page, route);

        await expectNoViolations(page, new AxeBuilder({ page }), route);
    });
}

test("main buttons keep their contrast on hover", async ({ page, isMobile }) => {
    test.skip(isMobile, "no hover on touch screens");

    await openPage(page, "/download");

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

// Scans the settled layout: web fonts change text size, and with it contrast and target sizes.
async function openPage(page: Page, route: string) {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => document.fonts.ready);
}

async function expectNoViolations(page: Page, builder: AxeBuilder, label: string) {
    const { violations, incomplete, passes } = await builder.withTags(WCAG_TAGS).analyze();

    const overRobotCanvas = await findNodesOverRobotCanvas(page, incomplete);
    const isUnresolvedContrast = (result: Result, node: NodeResult) =>
        result.id === "color-contrast" && !overRobotCanvas.has(node);

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
        issue.nodes.map((node) => `[${issue.id}] ${node.target}\n    ${node.summary}`),
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

/* Contrast nodes whose unknown background comes only from the robots' WebGL
   layers: axe's selectors are resolved in the page, so this does not depend on
   how three.js renders its canvas. */
async function findNodesOverRobotCanvas(page: Page, incomplete: Result[]) {
    const nodes = incomplete.filter((result) => result.id === "color-contrast").flatMap((result) => result.nodes);
    const relatedSelectors = nodes.map((node) =>
        node.any.flatMap((check) => check.relatedNodes ?? []).map((related) => related.target.join(" ")),
    );

    const overCanvas = await page.evaluate(
        ({ groups, layers }) =>
            groups.map(
                (selectors) =>
                    selectors.length > 0 &&
                    selectors.every((selector) => {
                        const element = document.querySelector(selector);
                        return element instanceof HTMLCanvasElement && element.closest(layers) !== null;
                    }),
            ),
        { groups: relatedSelectors, layers: ROBOT_LAYERS },
    );

    return new Set(nodes.filter((_, index) => overCanvas[index]));
}
