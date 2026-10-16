/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

/* The home page robots, driven through window.__robotPage (development only). */

type Pick = { progress: number; goal: number; holding: boolean };
type State = {
    enter: number;
    view: number;
    heroTarget: "hero" | "header" | null;
    logoOut: "hero" | "header" | null;
    plans: Record<string, {
        reachable: boolean; flies: boolean; phase: string; pick: Pick;
        misses: Record<"grasp" | "approach" | "rest" | "carry", number>;
    }>;
    box: Pick;
    waving: boolean;
    so101: { left: number; right: number; top: number; bottom: number };
    heroRect: { left: number; top: number; width: number; height: number };
    heroLogoVisible: boolean | null;
    headerLogoVisible: boolean | null;
    animating: boolean;
};

type Hook = { ready: true; hitTest(x: number, y: number): string | null; state(): State };

const state = (page: Page) => page.evaluate(() => (window as unknown as { __robotPage: Hook }).__robotPage.state());

/* Until nothing moves, the relayout timer included. */
async function settle(page: Page) {
    await page.waitForTimeout(250);
    await page.waitForFunction(() => {
        const s = (window as unknown as { __robotPage: Hook }).__robotPage.state();
        return !s.animating;
    }, null, { timeout: 20_000, polling: 100 });
    return state(page);
}

async function open(page: Page) {
    await page.goto("/");
    await page.waitForFunction(() => {
        const s = (window as unknown as { __robotPage?: Hook }).__robotPage?.state();
        return s && Object.keys(s.plans).length > 0;
    }, null, { timeout: 30_000 });
    return settle(page);
}

/* The logo the arm goes for: the hero's on wide screens, the header's on phones. */
const target = (s: State) => (s.plans.hero ? "hero" : "header");

/* A page logo is hidden exactly when the arm has it, and it has it only while holding. */
function expectLogosConsistent(s: State) {
    const holding = s.box.holding || Object.values(s.plans).some((plan) => plan.pick.holding);
    expect(s.logoOut !== null, "a logo is out only while a pick holds it").toBe(holding);
    if (s.heroLogoVisible !== null) expect(s.heroLogoVisible).toBe(s.logoOut !== "hero");
    if (s.headerLogoVisible !== null) expect(s.headerLogoVisible).toBe(s.logoOut !== "header");
}

async function clickArm(page: Page) {
    // hitTest allows some slop, so a point that just hits can be off the arm. Take
    // the whole-pixel point (clicks land on whole pixels) deepest inside it.
    const point = await page.evaluate(() => {
        const robots = (window as unknown as { __robotPage: Hook }).__robotPage;
        const r = robots.state().so101;
        const hits = (x: number, y: number) => robots.hitTest(x, y) === "so101";
        let best: { x: number; y: number } | null = null;
        let bestDepth = 0;
        for (let y = Math.ceil(Math.max(r.top, 0)); y < Math.min(r.bottom, innerHeight); y += 8) {
            for (let x = Math.ceil(Math.max(r.left, 0)); x < Math.min(r.right, innerWidth); x += 8) {
                if (!hits(x, y)) continue;
                let depth = 0;
                for (let dy = -24; dy <= 24; dy += 12) for (let dx = -24; dx <= 24; dx += 12) if (hits(x + dx, y + dy)) depth++;
                if (depth > bestDepth) {
                    best = { x, y };
                    bestDepth = depth;
                }
            }
        }
        return best;
    });
    expect(point, "a point on the arm").not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
}

/* Scrolls down until the arm has landed in the box. */
async function scrollToBox(page: Page) {
    for (let y = 0; y < 5000; y += 40) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(20);
        if ((await state(page)).enter >= 1) return;
    }
    throw new Error("never reached the box");
}

async function scrollToTop(page: Page) {
    await page.evaluate(() => window.scrollTo(0, 0));
}

test.describe.configure({ timeout: 90_000 });

test("every plan is in reach", async ({ page }) => {
    const s = await open(page);
    expect(Object.keys(s.plans).length).toBeGreaterThan(0);
    for (const [name, plan] of Object.entries(s.plans)) {
        expect(plan.reachable, name).toBe(true);
        for (const pose of ["grasp", "approach", "carry"] as const) {
            expect(plan.misses[pose], `${name} ${pose} (m)`).toBeLessThan(0.006);
        }
    }
    expectLogosConsistent(s);
});

test("the arm takes the logo and gives it back", async ({ page }) => {
    const start = await open(page);
    const logo = target(start);
    await clickArm(page);
    let s = await settle(page);
    expect(s.logoOut).toBe(logo);
    expect(s.plans[logo].pick.holding).toBe(true);
    expectLogosConsistent(s);

    await clickArm(page);
    s = await settle(page);
    expect(s.logoOut).toBeNull();
    expect(s.plans[logo].pick.progress).toBe(0);
    expectLogosConsistent(s);
});

test("clicking the header logo makes the arm catch it", async ({ page }) => {
    const start = await open(page);
    test.skip(!start.plans.header?.flies, "the header logo is in reach here, no catch");
    const headerLogo = page.locator(".header__brand .logo__mark");
    await headerLogo.click();
    let s = await settle(page);
    expect(s.plans.header.phase).toBe("held");
    expect(s.logoOut).toBe("header");
    expect(new URL(page.url()).pathname).toBe("/");
    expectLogosConsistent(s);

    await headerLogo.click();
    s = await settle(page);
    expect(s.plans.header.phase).toBe("idle");
    expectLogosConsistent(s);
});

test("scrolling away mid-pick calls the pick off", async ({ page }) => {
    await open(page);
    await clickArm(page);
    await page.waitForTimeout(400); // reaching, not holding yet
    expect((await state(page)).logoOut).toBeNull();
    await scrollToBox(page);
    let s = await settle(page);
    expect(s.box.holding).toBe(false);
    expect(s.logoOut).toBeNull();
    expectLogosConsistent(s);

    await scrollToTop(page);
    s = await settle(page);
    expect(Object.values(s.plans).every((plan) => plan.pick.progress === 0)).toBe(true);
    expectLogosConsistent(s);
});

test("a held logo goes to the box and back", async ({ page }) => {
    const start = await open(page);
    const logo = target(start);
    await clickArm(page);
    await settle(page);
    await scrollToBox(page);
    let s = await settle(page);
    expect(s.box.holding).toBe(true);
    expect(s.logoOut).toBe(logo);
    expectLogosConsistent(s);

    await scrollToTop(page);
    s = await settle(page);
    expect(s.plans[logo].pick.holding).toBe(true);
    expect(s.logoOut).toBe(logo);
    expectLogosConsistent(s);

    await clickArm(page);
    s = await settle(page);
    expect(s.logoOut).toBeNull();
    expectLogosConsistent(s);
});

test("setting the logo down in the box gives it back to the page", async ({ page }) => {
    await open(page);
    await clickArm(page);
    await settle(page);
    await scrollToBox(page);
    await settle(page);
    await clickArm(page);
    const s = await settle(page);
    expect(s.box.holding).toBe(false);
    expect(s.logoOut).toBeNull();
    expectLogosConsistent(s);
});

test("resizing while holding keeps the logo, then lays out again", async ({ page }) => {
    const start = await open(page);
    const logo = target(start);
    await clickArm(page);
    await settle(page);
    const size = page.viewportSize()!;
    await page.setViewportSize({ width: size.width - 60, height: size.height - 40 });
    let s = await settle(page);
    expect(s.logoOut).toBe(logo);
    expect(s.plans[logo].pick.holding).toBe(true);
    expectLogosConsistent(s);

    await clickArm(page);
    s = await settle(page);
    expect(s.logoOut).toBeNull();
    expect(s.heroRect).not.toEqual(start.heroRect);
    expectLogosConsistent(s);
});

test("InMoov waves", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "InMoov: wave" }).press("Enter");
    await expect.poll(async () => (await state(page)).waving).toBe(true);
    const s = await settle(page);
    expect(s.waving).toBe(false);
    expectLogosConsistent(s);
});
