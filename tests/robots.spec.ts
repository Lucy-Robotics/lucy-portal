/// <reference lib="dom" />
import { expect, test, type Page } from "@playwright/test";

type Pick = { progress: number; goal: number; holding: boolean };
type State = {
    enter: number;
    view: number;
    perch: number | null;
    greeting: boolean;
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
    drawRect: { left: number; top: number; width: number; height: number };
    drawn: boolean;
    inmoov: { left: number; right: number; top: number; bottom: number } | null;
    boxLogo: { x: number; y: number } | null;
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

function expectLogosConsistent(s: State) {
    const holding = s.box.holding || Object.values(s.plans).some((plan) => plan.pick.holding);
    expect(s.logoOut !== null, "a logo is out only while a pick holds it").toBe(holding);
    if (s.heroLogoVisible !== null) expect(s.heroLogoVisible).toBe(s.logoOut !== "hero");
    if (s.headerLogoVisible !== null) expect(s.headerLogoVisible).toBe(s.logoOut !== "header");
}

async function clickArm(page: Page) {
    // hitTest has slop, so take the whole-pixel point (clicks land on whole pixels) deepest inside the arm.
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

test("the arm greets each feature it stands by", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones keep the arm in its box");
    await open(page);
    for (const index of [0, 1]) {
        await page.locator("[data-robot-perch]").nth(index).evaluate((perch) => {
            perch.closest("article")?.scrollIntoView({ block: "center" });
        });
        await expect.poll(async () => (await state(page)).perch).toBe(index);
        await expect.poll(async () => (await state(page)).greeting).toBe(true);
        // Standing in the perches' column, alone: no InMoov beside it.
        await expect.poll(async () => {
            const perch = await page.locator("[data-robot-perch]").nth(index).boundingBox();
            const { drawRect } = await state(page);
            return Math.abs(drawRect.left - (perch?.x ?? NaN));
        }).toBeLessThan(2);
        expect((await state(page)).inmoov, "InMoov waits for the finale").toBeNull();
    }
    const s = await settle(page);
    expect(s.greeting).toBe(false);
    expect(s.view, "still the arm's shot").toBe(0);
});

test("the arm stays put from one feature to the next", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones keep the arm in its box");
    await open(page);
    await page.locator("article.home__feature").first().evaluate((feature) => feature.scrollIntoView({ block: "center" }));
    await expect.poll(async () => (await state(page)).perch).toBe(0);
    // Wherever it is between the two features, the arm stands at the same place on screen.
    const tops: number[] = [];
    for (const share of [0, 0.25, 0.6, 1]) {
        await scrollBetween(page, "article.home__feature:nth-of-type(1)", "article.home__feature:nth-of-type(2)", share);
        await page.waitForTimeout(300);
        const s = await state(page);
        expect(s.drawn).toBe(true);
        tops.push(s.drawRect.top);
    }
    expect(Math.max(...tops) - Math.min(...tops), "fixed on screen").toBeLessThan(2);
    // Past halfway, it acts out the next feature.
    await expect.poll(async () => (await state(page)).perch).toBe(1);
});

/* Scrolls `share` of the way from one element's centre reaching the middle of the screen (below the header) to the other's. */
const scrollBetween = (page: Page, from: string, to: string, share: number) => page.evaluate(({ from, to, share }) => {
    const header = document.querySelector(".header")?.getBoundingClientRect().bottom ?? 0;
    const middle = header + (window.innerHeight - header) / 2;
    const [a, b] = [from, to].map((selector) => {
        const rect = document.querySelector(selector)!.getBoundingClientRect();
        return rect.top + rect.height / 2;
    });
    window.scrollBy(0, a + (b - a) * share - middle);
}, { from, to, share });

test("the arm stays put as its box scrolls away, the logo in the box", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones keep the arm in its box");
    await open(page);
    // From the first feature, so the box is no longer sticky and scrolls with the page.
    await page.locator("article.home__feature").first().evaluate((feature) => feature.scrollIntoView({ block: "center" }));
    await expect.poll(async () => (await state(page)).perch).toBe(0);
    await scrollBetween(page, ".robot-showcase__frame", "article.home__feature", 0.3);
    await page.waitForTimeout(300);
    const s = await state(page);
    expect(s.drawn, "seen all the way").toBe(true);
    const box = (await page.locator(".robot-showcase__frame").boundingBox())!;
    expect(s.drawRect.top, "left behind by the box").toBeGreaterThan(box.y + 1);
    // Right where the box was while sticky: lined up with the features' column, not moving.
    const perch = (await page.locator("[data-robot-perch]").first().boundingBox())!;
    expect(Math.abs(s.drawRect.left - perch.x)).toBeLessThan(2);
    expect(Math.abs(s.drawRect.width - perch.width)).toBeLessThan(2);
    const logo = s.boxLogo!;
    expect(logo, "the logo stays in the box").not.toBeNull();
    expect(logo.x).toBeGreaterThan(box.x);
    expect(logo.x).toBeLessThan(box.x + box.width);
    expect(logo.y).toBeGreaterThan(box.y);
    expect(logo.y).toBeLessThan(box.y + box.height);
});

test("the arm fades out, then InMoov rises into his frame, along the scroll", async ({ page, isMobile }) => {
    test.skip(isMobile, "phones keep the arm in its box");
    await open(page);
    await page.locator("article.home__feature").last().evaluate((feature) => feature.scrollIntoView({ block: "center" }));
    await expect.poll(async () => (await state(page)).perch).not.toBeNull();
    const at = async (share: number) => {
        await scrollBetween(page, "article.home__feature:last-of-type", "[data-robot-finale]", share);
        await page.waitForTimeout(300);
        return state(page);
    };
    // Fading out at its spot, no pan to InMoov.
    const leaving = await at(0.25);
    expect(leaving.view).toBe(0);
    expect(leaving.perch).not.toBeNull();
    // InMoov in his frame, rising in; never sliding in from the side.
    const frame = async () => (await page.locator("[data-robot-finale]").boundingBox())!;
    const rising = await at(0.6);
    expect(rising.view).toBe(1);
    expect(rising.drawn).toBe(true);
    expect(Math.abs(rising.drawRect.left - (await frame()).x)).toBeLessThan(2);
    expect(rising.drawRect.top, "still rising").toBeGreaterThan((await frame()).y + 1);
    const there = await at(0.9);
    expect(Math.abs(there.drawRect.top - (await frame()).y), "risen into his frame").toBeLessThan(2);
});

test("nothing is drawn with no robot on screen", async ({ page }) => {
    await open(page);
    // Straight from the features, where the arm is fixed on screen.
    await page.locator("article.home__feature").first().evaluate((feature) => feature.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(async () => (await state(page)).drawn).toBe(false);
    const s = await settle(page);
    expect(s.drawn).toBe(false);
    expect(s.animating).toBe(false);
});

test("InMoov waves at the end of the page", async ({ page }) => {
    await open(page);
    await page.locator("[data-robot-finale]").evaluate((frame) => frame.scrollIntoView({ block: "center" }));
    await expect.poll(async () => (await state(page)).view, { timeout: 20_000 }).toBeGreaterThan(0.95);
    await expect.poll(async () => (await state(page)).waving).toBe(true);
    const s = await settle(page);
    expect(s.perch).toBeNull();
    expectLogosConsistent(s);
});
