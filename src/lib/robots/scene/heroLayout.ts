/*
 * Where the hero's arm stands, how big it's drawn to reach the page's logos,
 * and its plans for taking them. Solved a step at a time (see lib/background.ts).
 */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import {
    ARM_INSET, ARM_MAX_WIDTH_SHARE, CARRY, CARRY_COMPACT, CATCH_RANGE, HEADER_REACHES, HERO_GRIPPER, HERO_ROLL,
    LOGO_HEIGHT, PHONE_BASE, REST, REST_COMPACT, TRANSITION_SHARE,
} from "../config.ts";
import type { InfinityShape } from "../lucyInfinity.ts";
import { DOWN, UP } from "../math.ts";
import { forEachOwnMesh } from "../robotModel.ts";
import { So101PickDemo } from "../so101PickDemo.ts";
import type { Framing } from "./framing.ts";
import type { Payload } from "./parts.ts";
import { rayFrom, toScreen, topRect, viewHeight, viewWidth, type Rect, type TopRect } from "./screen.ts";

export type HeroTarget = "hero" | "header";

// A caught logo's steps. The pick is at 0.5 with the jaws open, at 1 once gripped.
type CatchPhase = "idle" | "reach" | "shake" | "fly" | "grip" | "held" | "letgo" | "flyback" | "return";

export type HeroPlan = {
    logo: HTMLElement;
    pick: So101PickDemo;
    // `pinch` is the gripped point along the loops, measured from the crossing.
    home: { position: THREE.Vector3; scale: number; pinch: number };
    // Set only when the logo is out of reach and flies to the arm.
    flight: { from: THREE.Vector3; fromScale: number } | null;
    phase: CatchPhase;
    timer: number;
};

type HeroLayoutScene = {
    page: { hero: HTMLElement; heroLogo: HTMLElement | null; headerLogo: HTMLElement | null; frame: HTMLElement; header: HTMLElement | null };
    compact: boolean;
    so101: URDFRobot;
    arm: THREE.Object3D;
    shape: InfinityShape;
    camera: THREE.PerspectiveCamera;
    framing: Framing;
    shoulder: () => THREE.Vector3;
    /* The box pick's rest pose, shared by every plan. */
    restPose: number[];
    resetArm: () => void;
    heroPayload: Payload;
    placeHeroPayload: (position: THREE.Vector3, scale: number, pinch: number) => void;
    onHeroHold: (name: HeroTarget, holding: boolean) => void;
};

type HeroLayout = {
    heroRect: Rect;
    // Scroll position (px) once past the hero.
    landScroll: number;
    // Where the arm has settled in the box: half the hero, or later on wide screens while the hero's text is under the box.
    transitionScroll: number;
    // The box's chamfer, in px.
    chamferSize: number;
    // Only when asked for (always on phones).
    plans: Map<HeroTarget, HeroPlan> | null;
};

export function* layoutHero(s: HeroLayoutScene, withPlans: boolean, reachIndex = 0): Generator<void, HeroLayout> {
    const { page, compact, camera } = s;
    const width = viewWidth();
    const height = viewHeight();
    const chamferSize = parseFloat(getComputedStyle(page.frame).getPropertyValue("--chamfer")) * 16 || 24;

    const hero = page.hero.getBoundingClientRect();
    const landScroll = hero.bottom + window.scrollY;
    let transitionScroll = TRANSITION_SHARE * hero.height;
    if (!compact) {
        const frameTop = page.frame.getBoundingClientRect().top;
        for (const text of page.hero.querySelectorAll(".home__title, .home__tagline")) {
            const bottom = text.getBoundingClientRect().bottom + window.scrollY;
            transitionScroll = Math.max(transitionScroll, bottom - frameTop + 12);
        }
    }

    const frame = page.frame.getBoundingClientRect();
    const aspect = frame.width && frame.height ? frame.width / frame.height : 0.77;
    // The scene draws between steps, so the hero camera is put back after each.
    const heroCamera = () => s.framing.place(0, aspect, compact ? 1 : 0);
    heroCamera();

    // Pixels per metre at the arm, per pixel of the draw rectangle's height.
    const ndcBase = new THREE.Vector3().project(camera);
    const ndcUp = new THREE.Vector3(0, 0.1, 0).project(camera);
    const perPixel = (ndcUp.y - ndcBase.y) / 2 / 0.1;

    // Page scale in px per metre, and where the base stands on the bottom edge.
    const heroLogo = page.heroLogo && !compact ? topRect(page.heroLogo) : null;
    const headerLogo = page.headerLogo ? topRect(page.headerLogo) : null;
    let scale = 1500;
    let baseX = width * PHONE_BASE;
    if (heroLogo?.width) {
        scale = Math.min((height - heroLogo.centerY) / LOGO_HEIGHT, (ARM_MAX_WIDTH_SHARE * width) / 0.12);
        baseX = width - ARM_INSET * scale;
    } else if (headerLogo?.width) {
        // Phones get an arm just big enough to reach the header logo.
        const shoulderHeight = s.shoulder().y;
        for (let i = 0; i < 8; i++) {
            const dy = height - shoulderHeight * scale - headerLogo.centerY;
            scale = Math.hypot(baseX - headerLogo.centerX, dy) / HEADER_REACHES[reachIndex];
        }
    }
    const rectHeight = scale / perPixel;
    const rectWidth = rectHeight * aspect;
    const heroRect: Rect = {
        left: baseX - ((ndcBase.x + 1) / 2) * rectWidth,
        top: height - ((1 - ndcBase.y) / 2) * rectHeight,
        width: rectWidth,
        height: rectHeight,
    };
    // The base's front edge sits below its centre on screen, so lift the arm until its lowest point touches the bottom edge.
    s.resetArm();
    yield;
    heroCamera();
    let lowestNdc = Infinity;
    const vertex = new THREE.Vector3();
    forEachOwnMesh(s.so101.links.base_link, (mesh) => {
        const position = mesh.geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
            lowestNdc = Math.min(lowestNdc, vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).project(camera).y);
        }
    });
    const lowest = heroRect.top + ((1 - lowestNdc) / 2) * heroRect.height;
    if (Number.isFinite(lowest)) heroRect.top -= lowest - height;
    const layout: HeroLayout = { heroRect, landScroll, transitionScroll, chamferSize, plans: null };
    if (!withPlans && !compact) return layout;
    yield;
    heroCamera();

    // Screen points land on the camera-facing plane through the shoulder, where the gripper can stay square to them.
    const from = s.shoulder();
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
        camera.getWorldDirection(new THREE.Vector3()).negate(),
        from,
    );
    const onHero = (point: THREE.Vector3) => toScreen(point, camera, heroRect);
    const toWorld = (x: number, y: number) =>
        rayFrom(x, y, camera, heroRect).ray.intersectPlane(plane, new THREE.Vector3()) ?? from.clone();
    const metresPerPixel = (point: THREE.Vector3) => {
        const a = onHero(point);
        const b = onHero(point.clone().addScaledVector(right, 0.01));
        return 0.01 / Math.hypot(b.x - a.x, b.y - a.y);
    };
    const carryAt = compact ? CARRY_COMPACT : CARRY;
    const carry = new THREE.Vector3(carryAt.x, carryAt.y, from.z);

    /* Out of reach, the arm stretches toward the logo and the logo flies into its gripper. */
    const planFor = function* (name: HeroTarget, logo: HTMLElement, rect: TopRect): Generator<void, HeroPlan | null> {
        const center = toWorld(rect.centerX, rect.centerY);
        const markScale = (rect.width * metresPerPixel(center)) / s.shape.width;
        // Wide screens pinch the right loop's far end, reached from above the text; phones take it by its centre.
        const pinchAt = compact ? 0 : s.shape.rightEnd;
        const pinch = center.clone().addScaledVector(right, pinchAt * markScale);
        const towards = pinch.clone().sub(from).normalize();
        // A logo is thin and round-edged, so the gripper needn't be square to it, and reaches much further.
        const common = compact
            ? { rest: REST_COMPACT.clone(), restLean: DOWN, carry, carryLean: UP, square: false }
            : { rest: REST.clone(), restLean: DOWN, carry, carryLean: UP, square: false, restPose: s.restPose, rollOffset: HERO_ROLL, gripperOffset: HERO_GRIPPER };

        s.placeHeroPayload(pinch, markScale, pinchAt);
        const reach = yield* So101PickDemo.create(s.so101, s.arm, {
            object: s.heroPayload.group,
            gripWidth: s.shape.depth * markScale,
        }, { ...common, grasp: pinch.clone(), lean: compact ? towards : towards.clone().add(DOWN).normalize(), approach: 0.05 },
        (holding) => s.onHeroHold(name, holding));
        heroCamera();
        if (reach.reachable) {
            return { logo, pick: reach, home: { position: pinch, scale: markScale, pinch: pinchAt }, flight: null, phase: "idle", timer: 0 };
        }
        reach.dispose();
        // Phones try a bigger arm before falling back to catching.
        if (compact && reachIndex < HEADER_REACHES.length - 1) return null;

        // The caught logo must stay fully on screen and clear of the header.
        const margin = 16;
        const halfWidth = (s.shape.width / 2) / metresPerPixel(from);
        const headerBottom = page.header?.getBoundingClientRect().bottom ?? 0;
        const onScreen = (point: THREE.Vector3) => {
            const p = onHero(point);
            return p.x - 2 * halfWidth >= margin && p.x + margin <= width && p.y - halfWidth >= headerBottom + margin;
        };
        const tryCatch = function* (distance: number): Generator<void, { at: THREE.Vector3; pick: So101PickDemo } | null> {
            const at = from.clone().addScaledVector(towards, distance);
            if (!onScreen(at)) return null;
            s.placeHeroPayload(at, 1, pinchAt);
            const catching = yield* So101PickDemo.create(s.so101, s.arm, {
                object: s.heroPayload.group,
                gripWidth: s.shape.depth,
            }, { ...common, grasp: at.clone(), lean: towards, approach: 0 });
            heroCamera();
            if (catching.reachable) return { at, pick: catching };
            catching.dispose();
            return null;
        };
        // Binary search for the longest reach that works.
        let best: { at: THREE.Vector3; pick: So101PickDemo } | null = null;
        try {
            best = yield* tryCatch(CATCH_RANGE.min);
            let low = CATCH_RANGE.min;
            let high = CATCH_RANGE.max;
            for (let i = 0; best && i < CATCH_RANGE.steps; i++) {
                const middle = (low + high) / 2;
                const attempt = yield* tryCatch(middle);
                if (attempt) {
                    best.pick.dispose();
                    best = attempt;
                    low = middle;
                } else {
                    high = middle;
                }
            }
            if (!best) return null;
            const plan: HeroPlan = {
                logo, pick: best.pick, home: { position: best.at, scale: 1, pinch: pinchAt },
                flight: { from: pinch, fromScale: markScale }, phase: "idle", timer: 0,
            };
            best = null;
            return plan;
        } finally {
            best?.pick.dispose(); // abandoned half way
        }
    };

    // Handed over all at once, so the arm never drives a plan while the next is still being solved.
    const plans = new Map<HeroTarget, HeroPlan>();
    try {
        for (const [name, logo, rect] of [["hero", page.heroLogo, heroLogo], ["header", page.headerLogo, headerLogo]] as const) {
            if (!logo || !rect?.width) continue;
            const plan = yield* planFor(name, logo, rect);
            if (plan) plans.set(name, plan);
        }
        layout.plans = new Map(plans);
        plans.clear();
    } finally {
        for (const plan of plans.values()) plan.pick.dispose(); // abandoned half way
    }

    // On phones, retry with a bigger arm when the header logo is out of reach.
    if (compact && !layout.plans.has("header") && reachIndex < HEADER_REACHES.length - 1) {
        for (const plan of layout.plans.values()) plan.pick.dispose();
        return yield* layoutHero(s, withPlans, reachIndex + 1);
    }
    return layout;
}
