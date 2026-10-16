/*
 * The home page's robots, on one transparent canvas fixed over the viewport.
 * The canvas ignores the pointer so the page stays usable, and clicks on the
 * robots are hit-tested here instead.
 *
 * One world holds the SO-101 arm beside a Lucy infinity, and InMoov further
 * right. It is seen through one camera and drawn into a rectangle that goes
 * from the hero (where the arm can take the page's logo) into the box
 * (`page.frame`) as the page scrolls. setView then pans to InMoov.
 *
 * SO-101 uses the LeRobot URDF (TheRobotStudio, Apache 2.0).
 * InMoov's meshes are by Gael Langevin (CC BY-NC 4.0).
 *
 * Renders on demand, only while something moves.
 */
import * as THREE from "three";
import type { URDFRobot } from "urdf-loader";

import { inBackground, runFor } from "../background.ts";
import { listen } from "../listen.ts";
import {
    ARM_ATTENTION_TIME, ATTENTION_TIME, BOX_SLIDE, CLOSE_FROM, FOV, HEAD_TURN,
    HIT_SLOP, REST, RESTING_GLOW, RISE_TIME,
} from "./config.ts";
import { InMoovWave } from "./inmoovWave.ts";
import { loadLucyInfinity } from "./lucyInfinity.ts";
import { clamp, damp, DOWN, smoothstep } from "./math.ts";
import { prefetchOtherAssets, ROBOT_ASSETS } from "./robotAssets.ts";
import { loadRobot } from "./robotModel.ts";
import { stepCatch } from "./scene/catchFlight.ts";
import { SceneRenderer } from "./scene/renderer.ts";
import { Framing } from "./scene/framing.ts";
import { glowArea, glowReach, logoGlow, rgbOf } from "./scene/glow.ts";
import { layoutHero as layOutHero, type HeroPlan, type HeroTarget } from "./scene/heroLayout.ts";
import { createMaterials, INFINITY_LAYER, standInMoov } from "./scene/parts.ts";
import {
    chamferedClip, contains, cssColor, HIDDEN, lerpRect, partsBounds, rayFrom, screenBounds, toRect, toScreen, topRect,
    viewWidth, type Rect,
} from "./scene/screen.ts";
import { createWorld, disposeWorld } from "./scene/world.ts";
import { So101PickDemo } from "./so101PickDemo.ts";

export type RobotName = "so101" | "inmoov";

type Page = {
    /* heroLogo is not shown on phones. */
    hero: HTMLElement;
    heroLogo: HTMLElement | null;
    headerLogo: HTMLElement | null;
    /* The box the robots settle into, kept under the header. */
    frame: HTMLElement;
    header: HTMLElement | null;
    /* Behind the page's content, so the spreading grid never crosses text or buttons. */
    backdrop: HTMLElement;
    /* Just under the robots. The infinities are drawn here and get the logo's CSS drop-shadow. */
    glow: HTMLElement;
    hint: HTMLElement | null;
};

type Options = {
    /* Phone layout. The header's logo is the target and arrows drive the view. */
    compact: () => boolean;
    onActiveChange?: (robot: RobotName) => void;
};

export type RobotPageScene = {
    /* Same as clicking the robot. */
    activate(robot: RobotName): void;
    /* 0 frames the SO-101, 1 frames InMoov. The scroll drives it on wide screens. */
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
    const materials = createMaterials();

    // The hero only needs the arm and the logo. InMoov loads later.
    const started = performance.now();
    const timings: Record<string, number> = {}; // TEST-HOOK: ms since start
    const [so101, shape] = await Promise.all([
        loadRobot(ROBOT_ASSETS.so101.urdf, ROBOT_ASSETS.so101.glb, (urdfMaterial) =>
            urdfMaterial === "sts3215" ? materials.mechanism : materials.body,
        ),
        loadLucyInfinity(),
    ]);
    timings.assets = performance.now() - started;
    const { scene, fog, gridScene, grid, gridMaterial, arm, boxInfinity, boxPayload, heroPayload } =
        createWorld(so101, shape, materials, accent);

    let inmoov: URDFRobot | null = null;
    let humanoid: THREE.Group | null = null;
    let head: THREE.Object3D | null = null;
    let wave: InMoovWave | null = null;

    scene.updateMatrixWorld(true);
    const shoulder = () => so101.links.shoulder_link.getWorldPosition(new THREE.Vector3());

    /* Its rest pose is shared by every other plan. */
    const boxPick = await inBackground(So101PickDemo.create(so101, arm, { object: boxPayload.group, gripWidth: shape.depth }, {
        grasp: boxInfinity.clone(),
        lean: DOWN,
        rest: REST.clone(),
        restLean: DOWN,
        carry: boxInfinity.clone().add(new THREE.Vector3(0, 0.09, 0)),
        carryLean: DOWN,
        approach: 0.06,
    }, (holding) => {
        // Set down in the Stage, so the page gets its logo back.
        if (!holding && logoOut) {
            markVisible(logoOut, true);
            logoOut = null;
        }
    }));
    const restPose = boxPick.restPose;

    // Shots are fitted to the robots' bounds at rest.
    scene.updateMatrixWorld(true);
    const armShot = new THREE.Box3().setFromObject(arm).expandByObject(boxPayload.infinity);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 60);
    camera.layers.enable(INFINITY_LAYER);
    const framing = new Framing(camera, fog, armShot);

    const renderer = await SceneRenderer.create(container, page.backdrop, page.glow);

    // The rectangle the world is drawn into right now, and the hero's.
    let drawRect: Rect = { left: 0, top: 0, width: 1, height: 1 };
    let heroRect: Rect = { left: 0, top: 0, width: 1, height: 1 };

    const heroPlans = new Map<HeroTarget, HeroPlan>();
    let heroTarget: HeroTarget | null = null; // the plan in use
    // The page logo whose infinity the robot has (hidden on the page).
    let logoOut: HTMLElement | null = null;

    // Opacity, not visibility, so the mark still takes the click that asks for it back.
    const markVisible = (logo: HTMLElement, visible: boolean) => {
        logo.style.opacity = visible ? "" : "0";
    };

    /* `pinch` is where along its loops the infinity is held. */
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

    // Scroll positions (px) where the hero is past and where the arm has settled in the box.
    let landScroll = 0;
    let transitionScroll = 0;

    // The box's chamfer in px, read on layout rather than every frame.
    let chamferSize = 24;

    let layoutMs = 0; // TEST-HOOK: ms to lay out the hero, across frames when in the background
    let plansReady = false;
    /* Plans are made only when asked, but always on phones. A generator, so it
       can run a step at a time. */
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
    const layoutNow = (withPlans: boolean) => {
        const steps = layoutHero(withPlans);
        while (!steps.next().done);
    };
    let planning: Generator<void, void> | null = null; // the first plans, in the background
    /* What the layout depends on. If none of it changed, there's nothing to redo. */
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
    let settingUp = true; // nothing draws while the first layout runs in the background

    let enter = 0; // 0 is the arm free in the hero, 1 is the arm in the box
    let rise = 0; // 0 -> 1 as the robots rise into view on load
    let view = 0;
    let viewGoal = 0;
    let active: RobotName = "so101";
    let smoothing = 0; // seconds left of easing the arm toward its pose
    const shown = new Map<string, number>(); // joint values on screen while smoothing
    const ARM_JOINTS = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"];

    const frameRect = (): Rect => toRect(page.frame.getBoundingClientRect());

    /* Hero -> Stage over the first half of the hero's scroll. */
    const enterGoal = () => (transitionScroll > 0 ? clamp(window.scrollY / transitionScroll, 0, 1) : 0);

    /* On wide screens, once the hero is past, the scroll pans to InMoov. */
    const scrollView = () => clamp((window.scrollY - landScroll) / (0.9 * window.innerHeight), 0, 1);

    const heroPick = () => (heroTarget ? heroPlans.get(heroTarget)?.pick ?? null : null);
    let lastDriver: So101PickDemo | null = null;

    /* In the hero, the pick in use or else the default logo's. The box's otherwise. */
    const driver = () => {
        if (enter >= 0.02) return boxPick;
        const preferred = heroPlans.get(options.compact() ? "header" : "hero") ?? heroPlans.get("header");
        return heroPick() ?? preferred?.pick ?? boxPick;
    };

    const planOf = (pick: So101PickDemo) =>
        [...heroPlans.entries()].find(([, plan]) => plan.pick === pick) ?? null;

    /*
     * Switching picks (hero <-> box). A held infinity is carried across, and
     * anything half done (a logo mid-flight, say) is called off.
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
     * A logo taken from the page starts at the page logo's size, which can
     * vanish in the jaws (a header logo on a phone). So it grows as it's lifted.
     */
    const growHeld = () => {
        const plan = heroTarget ? heroPlans.get(heroTarget) : null;
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
    };

    const lookAtViewer = () => {
        if (!head) return null;
        const from = head.getWorldPosition(new THREE.Vector3());
        const to = camera.position.clone().sub(from);
        const yaw = Math.atan2(to.x, to.z);
        const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
        return { x: clamp(yaw / HEAD_TURN.yaw, -1, 1), y: clamp(pitch / HEAD_TURN.pitch, -1, 1) };
    };

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

    /* Planning moves the arm, so it's put back to the pose on screen. */
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

    const glowRgb = rgbOf(accent);

    /* "Click me!" above the arm while it waits in the hero. It stays put once placed. */
    const placeHint = () => {
        const hint = page.hint;
        if (!hint) return;
        const visible = rise >= 1 && enter < 0.02 && logoOut === null && driver().idle;
        // Wait for the arm to settle, as it eases from the pose on screen after a layout.
        if (visible && !hintPlaced && smoothing === 0 && driver() === lastDriver) {
            hintPlaced = true;
            const { top, left, right } = partsBounds(arm, camera, drawRect);
            // Nudged by --hint-x / --hint-y (robot-showcase.css).
            hint.style.transform = `translate(${((left + right) / 2).toFixed(1)}px, ${top.toFixed(1)}px) `
                + "translate(-50%, -100%) translate(var(--hint-x), var(--hint-y))";
        }
        hint.toggleAttribute("data-shown", visible && hintPlaced);
    };
    let hintPlaced = false;

    /*
     * As `enter` goes 0 -> 1 the grid spreads over the page, the arm shrinks
     * into the box (landed at 0.8), and the visible area closes in on the box
     * from 0.55, so it stays wider than the box while the arm flies in.
     */
    const draw = () => {
        const height = window.innerHeight;
        // Read the layout before writing to the page (no forced reflow).
        const box = frameRect();
        const headerBottom = page.header?.getBoundingClientRect().bottom ?? 0;
        const settle = smoothstep(enter, 0, 0.8);
        drawRect = lerpRect(heroRect, box, settle);
        // Rises into view on load from a screen lower.
        drawRect.top += (1 - rise) ** 3 * height;
        const level = options.compact() ? 1 - settle : 0;
        framing.place(enter >= 1 ? view : 0, drawRect.width / drawRect.height, level);

        const grid01 = smoothstep(enter, 0.05, 0.4);
        gridMaterial.opacity = 0.6 * grid01;
        grid.visible = grid01 > 0;

        // Slides in and lights up as the arm settles, unless the arm brought one (lit already).
        const held = boxPick.state.holding;
        const arrive = held ? 1 : smoothstep(enter, 0.35, 0.95);
        boxPayload.shown = arrive > 0;
        boxPayload.setGlow(held ? 1 : smoothstep(enter, 0.55, 1));
        if (!held && boxPick.idle) boxPayload.group.position.x = boxInfinity.x - (1 - arrive) * BOX_SLIDE;
        if (humanoid) humanoid.visible = enter >= 1;
        page.frame.toggleAttribute("data-landed", enter >= 1);

        const screen: Rect = { left: -1, top: -1, width: viewWidth() + 2, height: height + 2 };
        const close = smoothstep(enter, CLOSE_FROM, 1);
        const clip = enter <= 0 ? "none" : chamferedClip(lerpRect(screen, box, close), close, chamferSize, headerBottom);
        container.style.clipPath = clip;
        page.backdrop.style.clipPath = clip;
        page.glow.style.clipPath = clip;
        if (clip === HIDDEN) {
            page.hint?.removeAttribute("data-shown");
            return; // scrolled out of sight (phones), nothing to draw
        }

        // Measured before the camera gets its view offset for drawing.
        scene.updateMatrixWorld();
        placeHint();
        const payloads = [boxPayload, heroPayload].filter(({ shown }) => shown);
        // Like the page logo's glow, its reach follows the mark's size on screen.
        // Full when the arm has it or it's flying, dim at rest.
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

        // Judged before anything moves. A hovered robot holds still instead of
        // turning to the cursor, so the click lands where the visitor aimed.
        if (hoverPending) {
            hoverPending = false;
            hovered = pointer ? hitTest(pointer.x, pointer.y) : null;
            document.documentElement.classList.toggle("robot-hover", hovered !== null);
        }
        if (inMotion(pick)) armAttention = time + ARM_ATTENTION_TIME;
        if (!reduceMotion) {
            // After a click the arm holds its pose (presenting the logo) instead of following the cursor.
            if (time < armAttention) pick.setLook(null);
            else if (hovered !== "so101") pick.setLook(lookFrom(so101.links.shoulder_link));
            // While waving and a little after, InMoov looks the visitor in the eyes.
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

        // Once the hero is up, the slower work runs one piece per frame.
        if (rise >= 1 && !inmoovRequested) {
            inmoovRequested = true;
            renderer.precompile(scene, gridScene, camera);
            loadInMoov().catch((error: unknown) => console.error("Failed to load InMoov", error));
        } else if (rise >= 1 && !plansReady && !planning && !relayoutTimer && boxPick.idle) {
            planning = layoutHero();
        }
        // Paused while the arm is busy in the box. The layout would reset it, and
        // a held infinity would be measured as a jaw.
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
        // Keep going while a robot attends to the visitor, so it turns back to the cursor on its own.
        const working = rise < 1 || (!plansReady && boxPick.idle) || driver() !== lastDriver
            || time < armAttention + 50 || time < inmoovAttention + 50;
        // A click handled in this frame may have woken the loop already.
        if (picking || catching || waving || panning || smoothing > 0 || working) {
            if (!raf) raf = requestAnimationFrame(tick);
        }
        else last = 0;
    };

    const wake = () => {
        if (!raf && !settingUp) raf = requestAnimationFrame(tick);
    };

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

    const toggleHero = (target: "hero" | "header") => {
        const plan = heroPlans.get(target);
        if (!plan) return false;
        const current = heroTarget ? heroPlans.get(heroTarget) : null;
        // Busy with the other logo, so give that one back first.
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
        // After a click the visitor, not the cursor, has the robot's attention.
        if (robot === "inmoov") inmoovAttention = performance.now() + ATTENTION_TIME;
        else armAttention = performance.now() + ARM_ATTENTION_TIME;
        if (robot === "so101" && enter < 0.02 && !plansReady) {
            pending = () => activate(robot);
        } else if (robot === "inmoov") {
            wave?.wave();
        } else if (enter >= 1) {
            boxPick.toggle();
        } else if (enter < 0.02) {
            // The arm goes for the logo it can see (the header's on phones), or gives back the one it has.
            const busy = heroTarget ? heroPlans.get(heroTarget) : null;
            if (busy && !busy.pick.idle) togglePlan(busy);
            else if (!toggleHero(options.compact() ? "header" : "hero")) toggleHero("header");
        }
        wake();
    };

    const onLogoClick = (target: "hero" | "header") => (event: MouseEvent) => {
        if (enter >= 0.02) return; // a plain link once scrolled
        if (plansReady && !heroPlans.has(target)) return; // out of the arm's reach
        // The header's infinity is part of the home link. The arm takes it instead,
        // and "lucy" next to it still goes home.
        event.preventDefault();
        event.stopPropagation();
        if (plansReady) toggleHero(target);
        else pending = () => {
            if (enter < 0.02) toggleHero(target); // still in the hero by then
        };
        wake();
    };

    /* Hovering the hero's title makes the infinity the arm would take glow, and clicking takes it. */
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
        if (event.defaultPrevented || target?.closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        const robot = hitTest(event.clientX, event.clientY);
        if (robot) activate(robot);
    };

    // Fonts and resizes move the logos. Wait while the arm moves, or it would drop what it carries.
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
            // The layout resets the arm, so give back what it held and the logo it carried.
            const held = boxPick.state.holding;
            const carried = held ? logoOut : null;
            // Before the hero is up, stay light. The plans come after the rise.
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

    // Before anything listens to the page.
    await inBackground(layoutHero(false));
    // With parallel compiling, the first frame needn't stall on it either.
    await renderer.compileFirst(scene, camera);
    settingUp = false;
    enter = enterGoal();
    if (plansReady) plansDone(); // phones plan with the layout

    const unlisten = [
        listen(window, "scroll", wake, { passive: true }),
        listen(window, "click", onClick),
        listen(window, "resize", relayout),
        listen(document, "visibilitychange", wake),
        ...(page.heroLogo ? [listen(page.heroLogo, "click", onLogoClick("hero"))] : []),
        ...(page.headerLogo ? [listen(page.headerLogo, "click", onLogoClick("header"), { capture: true })] : []),
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
        humanoid = standInMoov(robot, materials, accent);
        humanoid.visible = enter >= 1;
        scene.add(humanoid);
        head = robot.links["i01.head.rothead_link"];
        wave = new InMoovWave(robot);
        // Headroom for the raised hand when it waves, with the arm still in the shot.
        framing.shots.inmoov = new THREE.Box3().setFromObject(humanoid)
            .expandByVector(new THREE.Vector3(0, 0.15, 0))
            .union(armShot);
        renderer.precompile(scene, gridScene, camera, humanoid);
        timings.inmoov = performance.now() - started;
        wake();
    };

    draw();
    wake();

    // TEST-HOOK: RobotShowcase only exposes it in development.
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
        activate,
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
            disposeWorld(scene, gridScene);
            renderer.dispose();
        },
    };
}
