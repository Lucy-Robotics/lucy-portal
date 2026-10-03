/*
 * The home page's robots, drawn on one transparent canvas fixed over the
 * viewport. The canvas ignores the pointer, so the page stays usable; clicks
 * on the robots are hit-tested here instead.
 *
 * There is one 3D world, the Stage's: a grid with the SO-101 arm (LeRobot
 * URDF, TheRobotStudio, Apache 2.0) beside a Lucy infinity, and InMoov (Lucy
 * URDF; meshes by Gael Langevin, CC BY-NC 4.0) further right. It is always
 * seen through the Stage's camera; what changes is the rectangle it's drawn
 * into:
 * - In the hero, a scaled-up copy of the box, placed so the arm stands on the
 *   bottom edge of the screen (bottom-right; bottom-centre on phones), free in
 *   the page. It takes the page's logo: the hero's by reaching for it, the
 *   header's by reaching for it on phones, or on wider screens by stretching
 *   toward it while it shakes loose and flies into the gripper.
 * - As the box (`page.frame`) scrolls into view, the grid spreads over the
 *   page, the rectangle shrinks into the box, and the visible area closes in
 *   on it: the arm is now in the Stage. A logo it holds comes along, and
 *   goes back to the page once it's set down there.
 * - setView(0..1) then pans the camera to InMoov, who waves.
 *
 * Renders on demand: frames only while something moves.
 */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import { inBackground, runFor } from "../background.ts";
import { listen } from "../listen.ts";
import {
    ARM_ATTENTION_TIME, ARM_YAW, ATTENTION_TIME, BOX_INFINITY_X, BOX_SLIDE, CLOSE_FROM, EYE_LIGHT, FOV, HEAD_TURN,
    HIT_SLOP, REST, RESTING_GLOW, RISE_TIME,
} from "./config.ts";
import { InMoovWave } from "./inmoovWave.ts";
import { createLucyGlowMaterial, loadLucyInfinity } from "./lucyInfinity.ts";
import { clamp, damp, DOWN, smoothstep } from "./math.ts";
import { prefetchOtherAssets, ROBOT_ASSETS } from "./robotAssets.ts";
import { loadRobot } from "./robotModel.ts";
import { stepCatch } from "./scene/catchFlight.ts";
import { SceneRenderer } from "./scene/renderer.ts";
import { Framing } from "./scene/framing.ts";
import { glowArea, glowReach, logoGlow, rgbOf } from "./scene/glow.ts";
import { layoutHero as layOutHero, type HeroPlan, type HeroTarget } from "./scene/heroLayout.ts";
import { createMaterials, createPayload, EYES, INFINITY_LAYER, standInMoov } from "./scene/parts.ts";
import {
    chamferedClip, contains, cssColor, HIDDEN, lerpRect, partsBounds, rayFrom, screenBounds, toRect, toScreen, topRect,
    viewWidth, type Rect,
} from "./scene/screen.ts";
import { So101PickDemo } from "./so101PickDemo.ts";

export type RobotName = "so101" | "inmoov";

type Page = {
    /* The hero, its logo mark (not shown on phones), and the header's. */
    hero: HTMLElement;
    heroLogo: HTMLElement | null;
    headerLogo: HTMLElement | null;
    /* The box the robots settle into, and the header it must stay under. */
    frame: HTMLElement;
    header: HTMLElement | null;
    /* A layer behind the page's content: the grid is drawn there while it
       spreads over the page, so it never crosses text or buttons. */
    backdrop: HTMLElement;
    /* A layer just under the robots: the infinities' visible parts are drawn
       there, and the page gives them the logo's glow (a CSS drop-shadow). */
    glow: HTMLElement;
    /* "Click me!", placed above the arm while it waits in the hero. */
    hint: HTMLElement | null;
};

type Options = {
    /* Phone layout: the header's logo is the target, arrows drive the view. */
    compact: () => boolean;
    onActiveChange?: (robot: RobotName) => void;
};

export type RobotPageScene = {
    /* Same as clicking a robot: the arm takes / puts back, InMoov waves. */
    activate(robot: RobotName): void;
    /* 0 frames the SO-101, 1 frames InMoov (the scroll drives it on wide screens). */
    setView(t: number): void;
    /* TEST-HOOK: lets a browser test find the robots and check real clicks. */
    testHook: {
        hitTest(x: number, y: number): RobotName | null;
        state(): Record<string, unknown>;
    };
    dispose(): void;
};

/* Clicks on these go to the page, even over a robot. */
const INTERACTIVE = "a, button, input, textarea, select, label, summary, [role='button'], [contenteditable]";

export async function createRobotPageScene(
    container: HTMLElement,
    page: Page,
    options: Options,
): Promise<RobotPageScene> {
    const accent = cssColor("--color-highlight", "#00ff41");
    const background = cssColor("--color-bg-comp", "#141414");
    const gridColor = cssColor("--color-border", "#3f3f3f");
    const materials = createMaterials(accent);

    // The hero needs the arm and the logo; InMoov comes later (see loadInMoov).
    const started = performance.now();
    const timings: Record<string, number> = {}; // TEST-HOOK: ms since start
    const [so101, shape] = await Promise.all([
        loadRobot(ROBOT_ASSETS.so101.urdf, ROBOT_ASSETS.so101.glb, (urdfMaterial) =>
            urdfMaterial === "sts3215" ? materials.mechanism : materials.body,
        ),
        loadLucyInfinity(),
    ]);
    timings.assets = performance.now() - started;
    // The box's infinity stands on its loops: its crossing is half its height up.
    const boxInfinity = new THREE.Vector3(BOX_INFINITY_X, shape.height / 2, 0);

    /* ---------------- the world ---------------- */
    const scene = new THREE.Scene();
    const fog = new THREE.Fog(background, 1, 2);
    scene.fog = fog;
    scene.add(new THREE.HemisphereLight(0xffffff, background, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-0.6, 1, 0.8);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0.8, 0.4, -1);
    scene.add(key, rim);

    // The grid has its own scene: drawn behind the page during the
    // transition, under the robots once in the box.
    const gridScene = new THREE.Scene();
    gridScene.fog = fog;
    const grid = new THREE.GridHelper(16, 160, gridColor, gridColor);
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridScene.add(grid);

    const arm = new THREE.Group();
    arm.rotation.y = ARM_YAW;
    arm.add(so101);
    scene.add(arm);

    // The Stage's infinity has its own material: it fades in on its own.
    const boxPayload = createPayload(shape, createLucyGlowMaterial(), accent);
    boxPayload.group.position.copy(boxInfinity);
    const heroPayload = createPayload(shape, materials.logo, accent);
    heroPayload.shown = false;
    scene.add(boxPayload.group, heroPayload.group);
    // InMoov's eye lights exist from the start, dark until it shows (constant light count).
    const eyeLights = Array.from({ length: EYES }, () => new THREE.PointLight(accent, 0, 0.35, 2));
    scene.add(...eyeLights);
    // Lights on every layer, so the glow pass reuses the main pass's shaders.
    scene.traverse((object) => {
        if (object instanceof THREE.Light) object.layers.enableAll();
    });

    // InMoov, once loaded (after the hero is up and running).
    let inmoov: URDFRobot | null = null;
    let humanoid: THREE.Group | null = null;
    let eyeHalos: THREE.Object3D[] = [];
    let head: THREE.Object3D | null = null;
    let wave: InMoovWave | null = null;

    scene.updateMatrixWorld(true);
    const shoulder = () => so101.links.shoulder_link.getWorldPosition(new THREE.Vector3());

    /* The box's pick: the infinity on the grid, from above by its crossing.
       Its rest pose is the one every other plan shares. */
    const boxPick = await inBackground(So101PickDemo.create(so101, arm, { object: boxPayload.group, gripWidth: shape.depth }, {
        grasp: boxInfinity.clone(),
        lean: DOWN,
        rest: REST.clone(),
        restLean: DOWN,
        carry: boxInfinity.clone().add(new THREE.Vector3(0, 0.09, 0)),
        carryLean: DOWN,
        approach: 0.06,
    }, (holding) => {
        // Set down in the Stage: it's the Stage's now, the page gets its logo back.
        if (!holding && logoOut) {
            markVisible(logoOut, true);
            logoOut = null;
        }
    }));
    const restPose = boxPick.restPose;

    // Each robot's shot is fitted to its bounds at rest (see Framing).
    scene.updateMatrixWorld(true);
    const armShot = new THREE.Box3().setFromObject(arm).expandByObject(boxPayload.infinity);

    /* ---------------- camera ---------------- */
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 60);
    camera.layers.enable(INFINITY_LAYER);
    const framing = new Framing(camera, fog, armShot);


    /* ---------------- rendering ---------------- */
    const renderer = await SceneRenderer.create(container, page.backdrop, page.glow);

    // The rectangle the world is drawn into right now, and the hero's.
    let drawRect: Rect = { left: 0, top: 0, width: 1, height: 1 };
    let heroRect: Rect = { left: 0, top: 0, width: 1, height: 1 };

    /* ---------------- the hero: layout and the logo plans ---------------- */
    const heroPlans = new Map<HeroTarget, HeroPlan>();
    let heroTarget: HeroTarget | null = null; // the plan in use
    // The page logo whose infinity is with the robot (hidden on the page).
    let logoOut: HTMLElement | null = null;

    // Hidden by opacity, not visibility: it must still take the click that
    // asks for it back (a hidden mark would let the click reach the link).
    const markVisible = (logo: HTMLElement, visible: boolean) => {
        logo.style.opacity = visible ? "" : "0";
    };

    /* The hero payload faces the camera, held at `pinch` along its loops. */
    const placeHeroPayload = (position: THREE.Vector3, scale: number, pinch: number) => {
        heroPayload.setPinch(pinch);
        heroPayload.group.quaternion.copy(camera.quaternion);
        heroPayload.group.scale.setScalar(scale);
        heroPayload.group.position.copy(position);
    };

    const disposeHeroPlans = () => {
        for (const plan of heroPlans.values()) {
            plan.pick.dispose();
            markVisible(plan.logo, true);
            plan.logo.classList.remove("robot-target", "robot-shake");
        }
        heroPlans.clear();
        heroTarget = null;
        logoOut = null;
        heroPayload.shown = false;
    };

    // Where the hero has scrolled past, and where the arm has settled in the box (see HeroLayout).
    let landScroll = 0;
    let transitionScroll = 0;


    // The box's chamfer, in px (read on layout, not every frame).
    let chamferSize = 24;

    let layoutMs = 0; // TEST-HOOK: time taken to lay out the hero (across frames when in the background)
    let plansReady = false;
    /* The hero laid out again (see scene/heroLayout.ts), with its plans when
       asked (always on phones). A generator: a step at a time. */
    const layoutHero = function* (withPlans = true): Generator<void, void> {
        const started = performance.now();
        laidOutFor = layoutKey();
        disposeHeroPlans();
        renderer.fit();
        hintPlaced = false;
        plansReady = false;
        yield;
        const layout = yield* layOutHero({
            page,
            compact: options.compact(),
            so101,
            arm,
            shape,
            camera,
            framing,
            shoulder,
            restPose,
            resetArm: () => {
                boxPick.reset();
                arm.updateMatrixWorld(true);
            },
            heroPayload,
            placeHeroPayload,
            onHeroHold: (logo, holding) => {
                heroPayload.shown = holding;
                markVisible(logo, !holding);
                logoOut = holding ? logo : null;
            },
        }, withPlans);
        ({ heroRect, landScroll, transitionScroll, chamferSize } = layout);
        for (const [name, plan] of layout.plans ?? []) {
            heroPlans.set(name, plan);
            plan.logo.classList.add("robot-target");
        }
        plansReady = layout.plans !== null;
        heroPayload.shown = false;
        layoutMs = performance.now() - started;
    };
    /* All at once (on resize). */
    const layoutNow = (withPlans: boolean) => {
        const steps = layoutHero(withPlans);
        while (!steps.next().done);
    };
    let planning: Generator<void, void> | null = null; // the first plans, in the background
    /* What the layout depends on: when none of it changed, nothing to redo. */
    const layoutKey = () => {
        const frame = page.frame.getBoundingClientRect();
        const logos = [page.heroLogo, page.headerLogo].flatMap((logo) => {
            const at = logo ? topRect(logo) : null;
            return at ? [at.centerX, at.centerY, at.width] : [];
        });
        return [viewWidth(), window.innerHeight, frame.width, frame.height, ...logos]
            .map(Math.round).join() + (options.compact() ? "c" : "");
    };
    let laidOutFor = "";
    let settingUp = true; // laid out in the background too: nothing draws meanwhile

    /* ---------------- state ---------------- */
    let enter = 0; // 0: the arm free in the hero, 1: in the box
    let rise = 0; // 0 -> 1 as the robots rise into view on load
    let view = 0;
    let viewGoal = 0;
    let active: RobotName = "so101";
    let smoothing = 0; // seconds left of easing the arm toward its pose
    const shown = new Map<string, number>(); // joint values on screen while smoothing
    const ARM_JOINTS = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"];

    const frameRect = (): Rect => toRect(page.frame.getBoundingClientRect());

    /* Hero -> Stage over the first half of the hero's scroll (see
       transitionScroll): the arm has settled in the box by then. */
    const enterGoal = () => (transitionScroll > 0 ? clamp(window.scrollY / transitionScroll, 0, 1) : 0);

    /* Wide screens: once the hero has scrolled past, the scroll pans to InMoov. */
    const scrollView = () => clamp((window.scrollY - landScroll) / (0.9 * window.innerHeight), 0, 1);

    const heroPick = () => (heroTarget ? heroPlans.get(heroTarget)?.pick ?? null : null);
    let lastDriver: So101PickDemo | null = null;

    /* The pick driving the arm: in the hero, the one in use or else the one
       for the logo it goes for by default; the box's otherwise. */
    const driver = () => {
        if (enter >= 0.02) return boxPick;
        const preferred = heroPlans.get(options.compact() ? "header" : "hero") ?? heroPlans.get("header");
        return heroPick() ?? preferred?.pick ?? boxPick;
    };

    const planOf = (pick: So101PickDemo) =>
        [...heroPlans.entries()].find(([, plan]) => plan.pick === pick) ?? null;

    /*
     * The arm moves on from one pick to another (hero <-> box). If it was
     * holding the infinity, the next pick holds it too: it's carried across.
     * Anything half done (a logo mid-flight, say) is called off.
     */
    const handOver = (from: So101PickDemo, to: So101PickDemo) => {
        const holding = from.state.holding;
        const fromPlan = planOf(from)?.[1];
        if (fromPlan) {
            fromPlan.logo.classList.remove("robot-shake");
            if (!holding && fromPlan.phase !== "idle") {
                markVisible(fromPlan.logo, true);
                if (logoOut === fromPlan.logo) logoOut = null;
            }
            fromPlan.phase = "idle";
        }
        to.lookLike(from);
        from.release();
        heroPayload.shown = false;
        if (holding) {
            const entry = planOf(to);
            if (entry) {
                const [name, plan] = entry;
                heroTarget = name;
                placeHeroPayload(plan.home.position, plan.home.scale, plan.home.pinch);
                to.takeOver();
                heroPayload.shown = true;
                markVisible(plan.logo, false);
                if (logoOut && logoOut !== plan.logo) markVisible(logoOut, true);
                logoOut = plan.logo;
                if (plan.flight) plan.phase = "held";
            } else {
                to.takeOver();
            }
        }
        smoothing = 0.6;
    };

    /*
     * A logo taken straight from the page is the page logo's size, which can
     * vanish in the jaws (a header logo on a phone): it grows to full size as
     * the arm lifts it, and shrinks back on the way home.
     */
    const growHeld = () => {
        const plan = heroTarget ? heroPlans.get(heroTarget) : null;
        if (!plan || plan.flight || !plan.pick.state.holding) return;
        const grown = smoothstep(plan.pick.state.progress, 0.7, 1);
        const payload = heroPayload.group;
        payload.scale.setScalar(plan.home.scale + (1 - plan.home.scale) * grown);
        // Held at its centre on phones: it stays upright and facing the
        // viewer, as on the page, while the wrist turns around it.
        if (plan.home.pinch === 0 && payload.parent) {
            payload.parent.updateMatrixWorld(true);
            const parent = payload.parent.getWorldQuaternion(new THREE.Quaternion());
            payload.quaternion.copy(parent.invert().multiply(camera.quaternion));
        }
    };

    /* InMoov's head turned to the camera: looking the visitor in the eyes. */
    const lookAtViewer = () => {
        if (!head || !humanoid) return null;
        const from = head.getWorldPosition(new THREE.Vector3());
        const to = camera.position.clone().sub(from);
        const yaw = Math.atan2(to.x, to.z);
        const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
        return { x: clamp(yaw / HEAD_TURN.yaw, -1, 1), y: clamp(pitch / HEAD_TURN.pitch, -1, 1) };
    };

    /* A caught logo: shake, fly in, grip; or let go, fly back, rest (see scene/catchFlight.ts). */
    let wristTwist = 0; // added to the wrist roll while it strains for the logo
    const catchStep = (dt: number) => {
        const plan = heroTarget ? heroPlans.get(heroTarget) : null;
        if (!plan?.flight) return false;
        const step = stepCatch(plan, dt, {
            heroPayload,
            instant: reduceMotion,
            setLogoOut: (logo, out) => {
                markVisible(logo, !out);
                logoOut = out ? logo : null;
            },
        });
        wristTwist = step.wristTwist;
        return step.moving;
    };

    /* Back to the pose on screen: planning moves the arm, and the switch to
       the new plans is eased from there (see handOver). */
    const showShown = () => {
        for (const name of ARM_JOINTS) {
            const value = shown.get(name);
            if (value !== undefined) so101.joints[name].setJointValue(value);
        }
    };

    const smoothJoints = (dt: number) => {
        for (const name of ARM_JOINTS) {
            const joint = so101.joints[name];
            const target = joint.angle;
            const from = shown.get(name) ?? target;
            const value = smoothing > 0 ? damp(from, target, 10, dt) : target;
            shown.set(name, value);
            joint.setJointValue(value);
        }
        smoothing = Math.max(0, smoothing - dt);
    };

    /* ---------------- drawing ---------------- */
    const glowRgb = rgbOf(accent); // the infinities glow like the page's logo (see scene/glow.ts)

    /* "Click me!" above the arm, in the hero while it waits for a click. It
       stays put: placed once the arm is up, again after each layout. */
    const placeHint = () => {
        const hint = page.hint;
        if (!hint) return;
        const visible = rise >= 1 && enter < 0.02 && logoOut === null && driver().idle;
        // Placed once the arm has settled into its rest pose (after a layout, it
        // eases there from the pose on screen), and only shown once placed.
        if (visible && !hintPlaced && smoothing === 0 && driver() === lastDriver) {
            hintPlaced = true;
            const { top, left, right } = partsBounds(arm, camera, drawRect);
            // Centred above the arm, then nudged by --hint-x / --hint-y (robot-showcase.css).
            hint.style.transform = `translate(${((left + right) / 2).toFixed(1)}px, ${top.toFixed(1)}px) `
                + "translate(-50%, -100%) translate(var(--hint-x), var(--hint-y))";
        }
        hint.toggleAttribute("data-shown", visible && hintPlaced);
    };
    let hintPlaced = false;

    /*
     * Hero -> Stage (`enter` 0 -> 1): the grid spreads over the whole page,
     * the arm shrinks into the box (landed at 0.8) while the visible area
     * slowly closes in from the screen to the box (from 0.55). The box's
     * border then fades in, and its caption after it.
     */
    const draw = () => {
        const height = window.innerHeight;
        // Read the layout before writing to the page (no forced reflow).
        const box = frameRect();
        const headerBottom = page.header?.getBoundingClientRect().bottom ?? 0;
        const settle = smoothstep(enter, 0, 0.8);
        drawRect = lerpRect(heroRect, box, settle);
        // Rising into view on load: start a screen lower, ease out.
        drawRect.top += (1 - (1 - (1 - rise) ** 3)) * height;
        const level = options.compact() ? 1 - settle : 0;
        framing.place(enter >= 1 ? view : 0, drawRect.width / drawRect.height, level);

        const grid01 = smoothstep(enter, 0.05, 0.4);
        gridMaterial.opacity = 0.6 * grid01;
        grid.visible = grid01 > 0;

        // The Stage's infinity slides in from the left and lights up as the
        // arm settles (unless the arm brought one along: it's lit already).
        const held = boxPick.state.holding;
        const arrive = held ? 1 : smoothstep(enter, 0.35, 0.95);
        boxPayload.shown = arrive > 0;
        boxPayload.setGlow(held ? 1 : smoothstep(enter, 0.55, 1));
        if (!held && boxPick.idle) boxPayload.group.position.x = boxInfinity.x - (1 - arrive) * BOX_SLIDE;
        if (humanoid) humanoid.visible = enter >= 1;
        eyeLights.forEach((light, i) => {
            const halo = humanoid?.visible ? eyeHalos[i] : undefined;
            light.intensity = halo ? EYE_LIGHT : 0;
            halo?.getWorldPosition(light.position);
        });
        page.frame.toggleAttribute("data-landed", enter >= 1);

        const screen: Rect = { left: -1, top: -1, width: viewWidth() + 2, height: height + 2 };
        // The grid's window closes in on the box slowly, from 55% of the way:
        // always wider than the box while the arm is still flying in (to 80%).
        const close = smoothstep(enter, CLOSE_FROM, 1);
        const clip = enter <= 0 ? "none" : chamferedClip(lerpRect(screen, box, close), close, chamferSize, headerBottom);
        container.style.clipPath = clip;
        page.backdrop.style.clipPath = clip;
        page.glow.style.clipPath = clip;
        if (clip === HIDDEN) {
            page.hint?.removeAttribute("data-shown");
            return; // scrolled out of sight (phones), nothing to draw
        }

        // Where the infinities are on screen, for their glow (measured before
        // the camera gets its view offset for drawing).
        scene.updateMatrixWorld();
        placeHint();
        const payloads = [boxPayload, heroPayload].filter(({ shown }) => shown);
        // Like the page logo's glow: its reach follows the mark's size on
        // screen; full when the arm has it (or it's flying), dim at rest.
        let glowFilter = "none";
        let area: Rect | null = null;
        if (payloads.length) {
            const lead = payloads.includes(heroPayload) ? heroPayload : boxPayload;
            const bounds = screenBounds(lead.infinity, camera, drawRect);
            const size = Math.max(8, bounds.right - bounds.left);
            const strength = lead === heroPayload || boxPick.state.holding ? 1 : RESTING_GLOW;
            glowFilter = logoGlow(size, strength, glowRgb);
            // Room for the wider shadow to fade out entirely.
            const margin = Math.ceil(3 * glowReach(size).far) + 4;
            area = glowArea(payloads.map(({ infinity }) => screenBounds(infinity, camera, drawRect)), margin, viewWidth(), height);
        }

        renderer.render({
            scene,
            gridScene,
            gridVisible: grid.visible,
            camera,
            drawRect,
            glowArea: area,
            glowFilter,
        });
    };

    /* ---------------- the loop ---------------- */
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let pointer: { x: number; y: number } | null = null;
    let hoverPending = false;
    let hovered: RobotName | null = null;
    // Until when each robot attends to the visitor rather than the cursor.
    let armAttention = 0;
    let inmoovAttention = 0;
    const inMotion = (pick: So101PickDemo) => !pick.idle && pick.state.progress !== pick.state.goal;
    let raf = 0;
    let last = 0;

    const lookFrom = (object: THREE.Object3D) => {
        if (!pointer) return null;
        const from = toScreen(object.getWorldPosition(new THREE.Vector3()), camera, drawRect);
        return {
            x: Math.tanh(((pointer.x - from.x) / (viewWidth() / 2)) * 1.6),
            y: Math.tanh((-(pointer.y - from.y) / (window.innerHeight / 2)) * 1.6),
        };
    };

    /* Which robot, if any, is drawn at a screen point (forgiving: also a ring around it). */
    const hitAt = (x: number, y: number): RobotName | null => {
        const raycaster = rayFrom(x, y, camera, drawRect);
        const armParts = [arm, ...(heroPayload.shown ? [heroPayload.group] : [])];
        if (raycaster.intersectObjects(armParts, true).length) return "so101";
        if (humanoid?.visible && raycaster.intersectObject(humanoid, true).length) return "inmoov";
        return null;
    };
    const hitTest = (x: number, y: number): RobotName | null => {
        // In the box, only what's inside the box counts.
        if (enter >= 1 && !contains(frameRect(), x, y)) return null;
        const exact = hitAt(x, y);
        if (exact) return exact;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const robot = hitAt(x + Math.cos(angle) * HIT_SLOP, y + Math.sin(angle) * HIT_SLOP);
            if (robot) return robot;
        }
        return null;
    };

    const tick = (time: number) => {
        raf = 0;
        if (disposed) return;
        if (document.hidden) {
            last = 0;
            return;
        }
        const dt = last ? Math.min((time - last) / 1000, 0.05) : 1 / 60;
        last = time;

        rise = reduceMotion ? 1 : Math.min(1, rise + dt / RISE_TIME);
        enter = enterGoal();
        if (!options.compact()) viewGoal = scrollView();
        view = reduceMotion ? viewGoal : damp(view, viewGoal, 6, dt);
        if (Math.abs(view - viewGoal) < 1e-4) view = viewGoal;
        const panning = view !== viewGoal;

        const closest: RobotName = enter >= 1 && view >= 0.5 ? "inmoov" : "so101";
        if (closest !== active) {
            active = closest;
            options.onActiveChange?.(active);
        }

        const pick = driver();
        if (lastDriver && pick !== lastDriver) handOver(lastDriver, pick);
        lastDriver = pick;

        // Hover is judged on what's on screen now, before anything moves. A
        // robot under the cursor holds still instead of turning to it, so the
        // click lands where the visitor aimed.
        if (hoverPending) {
            hoverPending = false;
            hovered = pointer ? hitTest(pointer.x, pointer.y) : null;
            document.documentElement.classList.toggle("robot-hover", hovered !== null);
        }
        if (inMotion(pick)) armAttention = time + ARM_ATTENTION_TIME;
        if (!reduceMotion) {
            // After a click the arm attends to the visitor: it stops following
            // the cursor and holds its pose (it presents the logo it took).
            if (time < armAttention) pick.setLook(null);
            else if (hovered !== "so101") pick.setLook(lookFrom(so101.links.shoulder_link));
            // Waving (and a little after), InMoov looks the visitor in the eyes;
            // otherwise at the cursor.
            if (wave?.waving) inmoovAttention = time + ATTENTION_TIME;
            if (time < inmoovAttention) wave?.setLook(lookAtViewer());
            else if (hovered !== "inmoov" && wave && head) wave.setLook(lookFrom(head));
        }
        const picking = pick.update(dt, { instant: reduceMotion });
        wristTwist = 0;
        const catching = enter < 0.02 && catchStep(dt);
        growHeld();
        if (wristTwist) so101.joints.wrist_roll.setJointValue(so101.joints.wrist_roll.angle + wristTwist);
        smoothJoints(dt);
        const waving = wave?.update(dt, { instant: reduceMotion }) ?? false;

        // The hero is up: now the slower work, one piece per frame (InMoov
        // was already downloading).
        if (rise >= 1 && !inmoovRequested) {
            inmoovRequested = true;
            renderer.precompile(scene, gridScene, camera);
            loadInMoov().catch((error: unknown) => console.error("Failed to load InMoov", error));
        } else if (rise >= 1 && !plansReady && !planning && !relayoutTimer && boxPick.idle) {
            planning = layoutHero();
        }
        // The plans are worked out in the background, a slice per frame: the arm
        // keeps following the cursor. Paused while the arm is busy in the box (the
        // layout would reset it, and a held infinity would be measured as a jaw).
        if (planning && boxPick.idle) {
            if (runFor(planning).done) {
                planning = null;
                plansDone();
            }
            showShown();
        }

        draw();

        if (!timings.firstFrame) {
            timings.firstFrame = performance.now() - started;
            prefetchOtherAssets();
        }
        // Keep going while a robot attends to the visitor, so it turns back to
        // the cursor on its own when that ends.
        const working = rise < 1 || (!plansReady && boxPick.idle) || driver() !== lastDriver
            || time < armAttention + 50 || time < inmoovAttention + 50;
        // (A click handled in this frame may have woken the loop already.)
        if (picking || catching || waving || panning || smoothing > 0 || working) {
            if (!raf) raf = requestAnimationFrame(tick);
        }
        else last = 0;
    };

    const wake = () => {
        if (!raf && !settingUp) raf = requestAnimationFrame(tick);
    };

    /* ---------------- actions ---------------- */
    /* Take the logo, or give it back. A caught logo only turns around once
       it's settled (held, or back in place). */
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

    const toggleHero = (target: "hero" | "header") => {
        const plan = heroPlans.get(target);
        if (!plan) return false;
        const current = heroTarget ? heroPlans.get(heroTarget) : null;
        // Holding (or busy with) the other logo: give that one back first.
        if (current && heroTarget !== target && !current.pick.idle) {
            togglePlan(current);
        } else {
            heroTarget = target;
            togglePlan(plan);
        }
        wake();
        return true;
    };

    let pending: (() => void) | null = null; // asked for before the plans were ready
    function plansDone() {
        timings.plans = performance.now() - started;
        if (pending) {
            const action = pending;
            pending = null;
            action();
        }
    }
    const activate = (robot: RobotName) => {
        // A click: the visitor, not the cursor, has their attention now.
        if (robot === "inmoov") inmoovAttention = performance.now() + ATTENTION_TIME;
        else armAttention = performance.now() + ARM_ATTENTION_TIME;
        if (robot === "so101" && enter < 0.02 && !plansReady) {
            pending = () => activate(robot);
        } else if (robot === "inmoov") {
            wave?.wave();
        } else if (enter >= 1) {
            boxPick.toggle();
        } else if (enter < 0.02) {
            // In the hero the arm goes for the logo it can see: the hero's on
            // wide screens, the header's on phones; or gives back the one it has.
            const busy = heroTarget ? heroPlans.get(heroTarget) : null;
            if (busy && !busy.pick.idle) togglePlan(busy);
            else if (!toggleHero(options.compact() ? "header" : "hero")) toggleHero("header");
        }
        wake();
    };

    const onLogoClick = (target: "hero" | "header") => (event: MouseEvent) => {
        if (enter >= 0.02) return; // a plain link once scrolled
        if (plansReady && !heroPlans.has(target)) return; // out of the arm's reach
        // The header's infinity is part of the home link: the arm takes it
        // instead, and "lucy" next to it still goes home. Asked before the arm
        // is ready, it's remembered for when it is.
        event.preventDefault();
        event.stopPropagation();
        if (plansReady) toggleHero(target);
        else pending = () => {
            if (enter < 0.02) toggleHero(target); // still in the hero by then
        };
        wake();
    };
    const onHeroLogo = onLogoClick("hero");
    const onHeaderLogo = onLogoClick("header");

    /* The hero's title (logo and name) invites the arm: hovering it makes the
       infinity the arm would take glow, and clicking it takes it. */
    const heroText = [...page.hero.querySelectorAll<HTMLElement>(".home__title")];
    const invited = () => (options.compact() ? page.headerLogo : page.heroLogo);
    const onTextEnter = () => {
        if (enter < 0.02) invited()?.classList.add("robot-invite");
    };
    const onTextLeave = () => invited()?.classList.remove("robot-invite");
    const onTextClick = (event: MouseEvent) => {
        // The logo's mark has its own listener.
        if (event.target === page.heroLogo || enter >= 0.02 || window.getSelection()?.toString()) return;
        event.stopPropagation();
        activate("so101");
    };

    const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        pointer = { x: event.clientX, y: event.clientY };
        hoverPending = true;
        wake();
    };

    // relatedTarget is null when the pointer leaves the window.
    const onPointerOut = (event: PointerEvent) => {
        if (event.relatedTarget) return;
        pointer = null;
        hoverPending = true;
        wake();
    };

    const onClick = (event: MouseEvent) => {
        const target = event.target as Element | null;
        // The page keeps its clicks: links and buttons, and text selections.
        if (event.defaultPrevented || target?.closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        const robot = hitTest(event.clientX, event.clientY);
        if (robot) activate(robot);
    };

    // Scrolling moves the box, and the next frame (right after the scroll event) follows.
    const onScroll = wake;

    // Lay the hero out again once the fonts load and on resize (the logos move),
    // but wait while the arm moves, or it would drop what it carries.
    let disposed = false;
    let relayoutTimer = 0;
    const relayout = () => {
        if (disposed) return;
        window.clearTimeout(relayoutTimer);
        relayoutTimer = window.setTimeout(() => {
            relayoutTimer = 0;
            if (settingUp) {
                relayout();
                return;
            }
            if (layoutKey() === laidOutFor) return; // fonts or observers, nothing moved
            if (inMotion(boxPick) || [...heroPlans.values()].some((plan) => !plan.pick.idle)) {
                renderer.fit();
                draw();
                relayout();
                return;
            }
            // The layout resets the arm, so give back what it held (and the logo it carried).
            const held = boxPick.state.holding;
            const carried = held ? logoOut : null;
            // Before the hero is up, stay light: the plans come after the rise.
            planning?.return(); // what it had half built goes
            planning = null;
            layoutNow(plansReady);
            if (plansReady) plansDone();
            if (held) {
                boxPick.takeOver();
                if (carried) {
                    markVisible(carried, false);
                    logoOut = carried;
                }
            }
            showShown();
            draw();
            wake();
        }, 150);
    };

    // Laid out in the background, before anything listens to the page.
    await inBackground(layoutHero(false));
    // With parallel compiling, the first frame needn't stall on it either.
    await renderer.compileFirst(scene, camera);
    settingUp = false;
    enter = enterGoal();
    if (plansReady) plansDone(); // phones plan with the layout

    // Everything listened to, stopped all at once on dispose.
    const unlisten = [
        listen(window, "scroll", onScroll, { passive: true }),
        listen(window, "click", onClick),
        listen(window, "resize", relayout),
        listen(document, "visibilitychange", wake),
        ...(page.heroLogo ? [listen(page.heroLogo, "click", onHeroLogo)] : []),
        ...(page.headerLogo ? [listen(page.headerLogo, "click", onHeaderLogo, { capture: true })] : []),
        ...heroText.flatMap((element) => [
            listen(element, "pointerenter", onTextEnter),
            listen(element, "pointerleave", onTextLeave),
            listen(element, "click", onTextClick),
        ]),
        ...(reduceMotion ? [] : [
            listen(window, "pointermove", onPointerMove, { passive: true }),
            listen(document, "pointerout", onPointerOut),
        ]),
    ];
    for (const element of heroText) element.classList.add("robot-takeable");
    const resizeObserver = new ResizeObserver(relayout);
    resizeObserver.observe(page.frame);
    void document.fonts?.ready.then(relayout);

    let inmoovRequested = false;
    const loadInMoov = async () => {
        // InMoov's URDF colours are Blender leftovers, so its parts are coloured by link.
        const robot = await loadRobot(ROBOT_ASSETS.inmoov.urdf, ROBOT_ASSETS.inmoov.glb, () => materials.inmoov);
        if (disposed) return;
        inmoov = robot;
        const stood = standInMoov(robot, materials, accent);
        humanoid = stood.body;
        eyeHalos = stood.halos;
        humanoid.visible = enter >= 1;
        scene.add(humanoid);
        head = robot.links["i01.head.rothead_link"];
        wave = new InMoovWave(robot);
        // Headroom above InMoov for its raised hand when it waves, and the arm
        // still in the shot.
        framing.shots.inmoov = new THREE.Box3().setFromObject(humanoid)
            .expandByVector(new THREE.Vector3(0, 0.15, 0))
            .union(armShot);
        renderer.precompile(scene, gridScene, camera, humanoid);
        timings.inmoov = performance.now() - started;
        wake();
    };

    enter = enterGoal();
    draw();
    wake();

    // TEST-HOOK: lets a browser test find the robots on screen and check the
    // effect of real clicks. RobotShowcase only exposes it in development.
    const screenRect = (object: THREE.Object3D) => screenBounds(object, camera, drawRect);
    const testHook = {
        hitTest,
        state: () => ({
            enter,
            view,
            active,
            heroTarget,
            layoutMs: Math.round(layoutMs),
            catchReach: (() => {
                const plan = heroPlans.get("header");
                return plan?.flight ? +plan.home.position.distanceTo(shoulder()).toFixed(3) : null;
            })(),
            logoOut: logoOut ? (logoOut.closest(".header") ? "header" : "hero") : null,
            plans: Object.fromEntries([...heroPlans].map(([name, plan]) => [name, {
                reachable: plan.pick.reachable,
                flies: plan.flight !== null,
                phase: plan.phase,
                misses: plan.pick.misses,
                pick: plan.pick.state,
            }])),
            box: boxPick.state,
            waving: wave?.waving ?? false,
            armPan: so101.joints.shoulder_pan.angle,
            armLook: lastDriver ? lastDriver.looking : null,
            headYaw: inmoov?.joints["i01.head.rothead_link_joint"].angle ?? null,
            so101: screenRect(arm),
            inmoov: humanoid?.visible ? screenRect(humanoid) : null,
            timings: Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v)])),
            heroRect,
            drawRect,
            heroLogoVisible: page.heroLogo ? page.heroLogo.style.opacity !== "0" : null,
            headerLogoVisible: page.headerLogo ? page.headerLogo.style.opacity !== "0" : null,
            animating: raf !== 0,
        }),
    };

    return {
        activate: (robot) => activate(robot),
        setView(t) {
            viewGoal = clamp(t, 0, 1);
            wake();
        },
        testHook,
        dispose() {
            disposed = true;
            cancelAnimationFrame(raf);
            window.clearTimeout(relayoutTimer);
            resizeObserver.disconnect();
            for (const stop of unlisten) stop();
            for (const element of heroText) element.classList.remove("robot-takeable");
            page.heroLogo?.classList.remove("robot-invite");
            page.headerLogo?.classList.remove("robot-invite");
            document.documentElement.classList.remove("robot-hover");
            page.frame.removeAttribute("data-landed");
            page.hint?.removeAttribute("data-shown");
            disposeHeroPlans();
            boxPick.dispose();
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite) {
                    object.geometry.dispose();
                    const list = Array.isArray(object.material) ? object.material : [object.material];
                    list.forEach((material) => {
                        (material as THREE.MeshBasicMaterial).map?.dispose();
                        material.dispose();
                    });
                }
            });
            gridScene.traverse((object) => {
                if (object instanceof THREE.LineSegments) {
                    object.geometry.dispose();
                    (object.material as THREE.Material).dispose();
                }
            });
            renderer.dispose();
        },
    };
}
