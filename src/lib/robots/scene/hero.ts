/*
 * The arm in the hero: one pick per page logo it can take (planned by
 * heroLayout.ts), where the page's logo is, and hand-overs between those picks
 * and the box's.
 */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import type { InfinityShape } from "../lucyInfinity.ts";
import { smoothstep } from "../math.ts";
import type { So101PickDemo } from "../so101PickDemo.ts";
import { stepCatch } from "./catchFlight.ts";
import type { Framing } from "./framing.ts";
import { layoutHero, type HeroPlan, type HeroTarget } from "./heroLayout.ts";
import type { Payload } from "./parts.ts";
import { topRect, viewWidth, type Rect } from "./screen.ts";

/* Where the page's logo is: on the page, with the hero's arm (in its jaws or flying
   to or from them), or carried into the box. What shows it only follows this. */
export type LogoState = { at: "page" } | { at: "hero" | "box"; logo: HeroTarget };
export const ON_PAGE: LogoState = { at: "page" };

type HeroScene = {
    page: { hero: HTMLElement; heroLogo: HTMLElement | null; headerLogo: HTMLElement | null; frame: HTMLElement; header: HTMLElement | null };
    compact: () => boolean;
    reduceMotion: boolean;
    so101: URDFRobot;
    arm: THREE.Object3D;
    shape: InfinityShape;
    camera: THREE.PerspectiveCamera;
    framing: Framing;
    heroPayload: Payload;
    boxPick: So101PickDemo;
    shoulder: () => THREE.Vector3;
    beforeLayout: () => void;
};

export function createHero(s: HeroScene) {
    const { page, heroPayload, boxPick, camera } = s;
    const restPose = boxPick.restPose;
    const plans = new Map<HeroTarget, HeroPlan>();
    let target: HeroTarget | null = null; // the plan in use

    let logo: LogoState = ON_PAGE;
    // The page logo a robot has, hidden on the page.
    const logoOut = () => (logo.at === "page" ? null : logo.logo);
    const setLogo = (next: LogoState) => {
        logo = next;
        // Opacity, not visibility, so the mark still takes the click that asks for it back.
        for (const [name, element] of [["hero", page.heroLogo], ["header", page.headerLogo]] as const) {
            if (element) element.style.opacity = logoOut() === name ? "0" : "";
        }
        heroPayload.shown = logo.at === "hero";
    };

    /* `pinch` is where along its loops the infinity is held. */
    const placeHeroPayload = (position: THREE.Vector3, scale: number, pinch: number) => {
        heroPayload.setPinch(pinch);
        heroPayload.group.quaternion.copy(camera.quaternion);
        heroPayload.group.scale.setScalar(scale);
        heroPayload.group.position.copy(position);
    };

    const clear = () => {
        for (const plan of plans.values()) {
            plan.pick.dispose();
            plan.logo.classList.remove("robot-target", "robot-shake");
        }
        plans.clear();
        target = null;
        setLogo(ON_PAGE);
    };

    let layout = {
        heroRect: { left: 0, top: 0, width: 1, height: 1 } as Rect,
        // Scroll positions (px) where the hero is past and where the arm has settled in the box.
        landScroll: 0,
        transitionScroll: 0,
        // The box's chamfer in px, read on layout rather than every frame.
        chamferSize: 24,
    };
    let layoutMs = 0; // TEST-HOOK: ms to lay out the hero, across frames when in the background

    /* What the layout depends on. If none of it changed, there's nothing to redo. */
    const layoutKey = () => {
        const frame = page.frame.getBoundingClientRect();
        const logos = [page.heroLogo, page.headerLogo].flatMap((logo) => {
            const at = logo ? topRect(logo) : null;
            return at ? [at.centerX, at.centerY, at.width] : [];
        });
        return [viewWidth(), window.innerHeight, frame.width, frame.height, ...logos]
            .map(Math.round).join() + (s.compact() ? "c" : "");
    };
    let laidOutFor = "";

    /* Plans are made only when asked, but always on phones. A generator, so it
       can run a step at a time. Returns whether it made them. */
    const layOut = function* (withPlans = true): Generator<void, boolean> {
        const started = performance.now();
        laidOutFor = layoutKey();
        clear();
        s.beforeLayout();
        yield;
        const result = yield* layoutHero({
            page,
            compact: s.compact(),
            so101: s.so101,
            arm: s.arm,
            shape: s.shape,
            camera,
            framing: s.framing,
            shoulder: s.shoulder,
            restPose,
            resetArm: () => {
                boxPick.reset();
                s.arm.updateMatrixWorld(true);
            },
            heroPayload,
            placeHeroPayload,
            onHeroHold: (name, holding) => setLogo(holding ? { at: "hero", logo: name } : ON_PAGE),
        }, withPlans);
        const { heroRect, landScroll, transitionScroll, chamferSize } = result;
        layout = { heroRect, landScroll, transitionScroll, chamferSize };
        for (const [name, plan] of result.plans ?? []) {
            plans.set(name, plan);
            plan.logo.classList.add("robot-target");
        }
        layoutMs = performance.now() - started;
        return result.plans !== null;
    };

    const heroPick = () => (target ? plans.get(target)?.pick ?? null : null);

    const planOf = (pick: So101PickDemo) =>
        [...plans.entries()].find(([, plan]) => plan.pick === pick) ?? null;

    /* A caught logo only turns around once it's settled (held, or back in place). */
    const togglePlan = (plan: HeroPlan) => {
        if (!plan.flight) {
            if (plan.pick.idle) placeHeroPayload(plan.home.position, plan.home.scale, plan.home.pinch);
            plan.pick.toggle();
        } else if (plan.phase === "idle") {
            placeHeroPayload(plan.home.position, plan.home.scale, plan.home.pinch);
            plan.phase = "reach";
            plan.timer = 0;
            plan.pick.setGoal(0.5);
        } else if (plan.phase === "held") {
            plan.phase = "letgo";
            plan.timer = 0;
            plan.pick.setGoal(0.5);
        }
    };

    const toggle = (name: HeroTarget) => {
        const plan = plans.get(name);
        if (!plan) return false;
        const current = target ? plans.get(target) : null;
        // Busy with the other logo, so give that one back first.
        if (current && target !== name && !current.pick.idle) {
            togglePlan(current);
        } else {
            target = name;
            togglePlan(plan);
        }
        return true;
    };

    return {
        plans: plans as ReadonlyMap<HeroTarget, HeroPlan>,
        get target() {
            return target;
        },
        get logo() {
            return logo;
        },
        setLogo,
        logoOut,
        get layout() {
            return layout;
        },
        get layoutMs() {
            return layoutMs;
        },
        layOut,
        layOutNow(withPlans: boolean) {
            const steps = layOut(withPlans);
            let step = steps.next();
            while (!step.done) step = steps.next();
            return step.value;
        },
        upToDate: () => layoutKey() === laidOutFor,
        clear,
        busy: () => [...plans.values()].some((plan) => !plan.pick.idle),

        /* In the hero, the pick in use or else the default logo's. The box's otherwise. */
        driver(inHero: boolean) {
            if (!inHero) return boxPick;
            const preferred = plans.get(s.compact() ? "header" : "hero") ?? plans.get("header");
            return heroPick() ?? preferred?.pick ?? boxPick;
        },

        /*
         * Switching picks (hero <-> box). A held infinity is carried across, and
         * anything half done (a logo mid-flight, say) is called off.
         */
        handOver(from: So101PickDemo, to: So101PickDemo) {
            const holding = from.state.holding;
            const fromEntry = planOf(from);
            if (fromEntry) {
                const [name, plan] = fromEntry;
                plan.logo.classList.remove("robot-shake");
                if (!holding && plan.phase !== "idle" && logoOut() === name) setLogo(ON_PAGE);
                plan.phase = "idle";
            }
            to.lookLike(from);
            from.release();
            if (!holding) return;
            const entry = planOf(to);
            if (entry) {
                const [name, plan] = entry;
                target = name;
                placeHeroPayload(plan.home.position, plan.home.scale, plan.home.pinch);
                to.takeOver();
                setLogo({ at: "hero", logo: name });
                if (plan.flight) plan.phase = "held";
            } else {
                to.takeOver();
                if (logo.at === "hero") setLogo({ at: "box", logo: logo.logo });
            }
        },

        /* Set down in the Stage, so the page gets its logo back. */
        onBoxHold(holding: boolean) {
            if (!holding && logo.at === "box") setLogo(ON_PAGE);
        },

        /*
         * A logo taken from the page starts at the page logo's size, which can
         * vanish in the jaws (a header logo on a phone). So it grows as it's lifted.
         */
        growHeld() {
            const plan = target ? plans.get(target) : null;
            if (!plan || plan.flight || !plan.pick.state.holding) return;
            const grown = smoothstep(plan.pick.state.progress, 0.7, 1);
            const payload = heroPayload.group;
            payload.scale.setScalar(plan.home.scale + (1 - plan.home.scale) * grown);
            // Held at its centre on phones, it stays upright and facing the viewer.
            if (plan.home.pinch === 0 && payload.parent) {
                payload.parent.updateMatrixWorld(true);
                const parent = payload.parent.getWorldQuaternion(new THREE.Quaternion());
                payload.quaternion.copy(parent.invert().multiply(camera.quaternion));
            }
        },

        catchStep(dt: number) {
            const name = target;
            const plan = name ? plans.get(name) : null;
            if (!name || !plan?.flight) return { moving: false, wristTwist: 0 };
            return stepCatch(plan, dt, {
                heroPayload,
                instant: s.reduceMotion,
                setLogoOut: (out) => setLogo(out ? { at: "hero", logo: name } : ON_PAGE),
            });
        },

        toggle,
        /* The arm goes for the logo it can see (the header's on phones), or gives back the one it has. */
        takeOrGiveBack() {
            const busy = target ? plans.get(target) : null;
            if (busy && !busy.pick.idle) togglePlan(busy);
            else if (!toggle(s.compact() ? "header" : "hero")) toggle("header");
        },
    };
}
