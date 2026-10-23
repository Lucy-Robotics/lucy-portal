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
    // The robots' canvases only arrive once their scene is built, which can outlast the network on slow machines.
    await page
        .locator(".robot-showcase__status", { hasText: "Loading" })
        .waitFor({ state: "detached", timeout: 30_000 });
}

async function expectNoViolations(page: Page, builder: AxeBuilder, label: string) {
    await pinRobotCanvases(page);
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
            summary: withRelated(node.failureSummary ?? node.any.map((check) => check.message).join("; "), node),
        })),
    };
}

// Names what axe blames, such as the element overlapping some text.
function withRelated(summary: string, node: NodeResult) {
    const related = node.any.flatMap((check) => check.relatedNodes ?? []);
    if (related.length === 0) return summary;
    return `${summary}\n    Related: ${related.map((other) => `${other.target.join(" ")} ${other.html}`).join(" | ")}`;
}

/* Gives the robots' canvases ids, so axe points at them by those. Its default
   selectors carry the canvas size, which the scene changes on any resize. */
async function pinRobotCanvases(page: Page) {
    await page.evaluate((layers) => {
        document.querySelectorAll(`:is(${layers}) canvas`).forEach((canvas, index) => {
            canvas.id ||= `a11y-robot-canvas-${index}`;
        });
    }, ROBOT_LAYERS);
}

/* What axe's in-page API, left by the scan, tells about the elements over some text. Untyped in axe-core. */
type AxeStacks = {
    setup(): void;
    teardown(): void;
    commons: {
        dom: {
            getTextElementStack(element: Element): Element[][];
            reduceToElementsBelowFloating(stack: Element[], element: Element): Element[];
        };
    };
};

/* Contrast nodes whose unknown background comes only from the robots' WebGL
   layers: axe's selectors are resolved in the page, so this does not depend on
   how three.js renders its canvas. A canvas behind the text is named by axe. One
   over it is not ("overlapped by another element"), as on phones where the layers
   are not fixed, so axe's own element stack says what covers the text. */
async function findNodesOverRobotCanvas(page: Page, incomplete: Result[]) {
    const nodes = incomplete.filter((result) => result.id === "color-contrast").flatMap((result) => result.nodes);
    const scanned = nodes.map((node) => ({
        target: node.target.join(" "),
        related: node.any.flatMap((check) => check.relatedNodes ?? []).map((related) => related.target.join(" ")),
    }));

    const overCanvas = await page.evaluate(
        ({ scanned, layers }) => {
            const axe = (window as unknown as { axe: AxeStacks }).axe;
            const inRobotLayer = (element: Element | null) => element?.closest(layers) != null;

            // As axe sees it: what is above the text, short of a fixed or sticky element.
            const covering = (element: Element) =>
                axe.commons.dom.getTextElementStack(element).flatMap((stack) => {
                    const below = axe.commons.dom.reduceToElementsBelowFloating(stack, element);
                    const index = below.indexOf(element);
                    return index === -1 ? below : below.slice(0, index);
                });

            axe.setup();
            try {
                return scanned.map(({ target, related }) => {
                    if (related.length > 0) {
                        return related.every((selector) => {
                            const element = document.querySelector(selector);
                            return element instanceof HTMLCanvasElement && inRobotLayer(element);
                        });
                    }
                    const element = document.querySelector(target);
                    const over = element ? covering(element) : [];
                    return over.some((other) => other instanceof HTMLCanvasElement) && over.every(inRobotLayer);
                });
            } finally {
                axe.teardown();
            }
        },
        { scanned, layers: ROBOT_LAYERS },
    );

    return new Set(nodes.filter((_, index) => overCanvas[index]));
}
