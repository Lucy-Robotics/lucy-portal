/*
 * The home page's robots, on one transparent canvas fixed over the viewport.
 * The canvas ignores the pointer so the page stays usable, and clicks on the
 * robots are hit-tested instead (scene/pointer.ts).
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
import { ARM_ATTENTION_TIME, ATTENTION_TIME, FOV, HEAD_TURN, REST, RISE_TIME } from "./config.ts";
import { InMoovWave } from "./inmoovWave.ts";
import { loadLucyInfinity } from "./lucyInfinity.ts";
import { clamp, damp, DOWN } from "./math.ts";
import { prefetchOtherAssets, ROBOT_ASSETS } from "./robotAssets.ts";
import { loadRobot } from "./robotModel.ts";
import { Framing } from "./scene/framing.ts";
import { createHero } from "./scene/hero.ts";
import { createMaterials, INFINITY_LAYER, standInMoov } from "./scene/parts.ts";
import { createPointer } from "./scene/pointer.ts";
import { SceneRenderer } from "./scene/renderer.ts";
import { cssColor, screenBounds, type Rect } from "./scene/screen.ts";
import { createView } from "./scene/view.ts";
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
    const world = createWorld(so101, shape, materials, accent);
    const { scene, fog, gridScene, arm, boxInfinity, boxPayload, heroPayload } = world;

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
    }, (holding) => hero.onBoxHold(holding)));

    // Shots are fitted to the robots' bounds at rest.
    scene.updateMatrixWorld(true);
    const armShot = new THREE.Box3().setFromObject(arm).expandByObject(boxPayload.infinity);

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 60);
    camera.layers.enable(INFINITY_LAYER);
    const framing = new Framing(camera, fog, armShot);

    const renderer = await SceneRenderer.create(container, page.backdrop, page.glow);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const painter = createView({ container, page, world, camera, framing, renderer, boxPick, accent, humanoid: () => humanoid });
    const hero = createHero({
        page,
        compact: options.compact,
        reduceMotion,
        so101,
        arm,
        shape,
        camera,
        framing,
        heroPayload,
        boxPick,
        shoulder,
        beforeLayout: () => {
            renderer.fit();
            painter.resetHint();
        },
    });

    // The rectangle the world is drawn into right now.
    let drawRect: Rect = { left: 0, top: 0, width: 1, height: 1 };

    // The hero's plans: not made, being made in the background a step per frame, or ready.
    let plans: { status: "none" } | { status: "planning"; steps: Generator<void, boolean> } | { status: "ready" } =
        { status: "none" };
    const plansReady = () => plans.status === "ready";
    let settingUp = true; // nothing draws while the first layout runs in the background

    let enter = 0; // 0 is the arm free in the hero, 1 is the arm in the box
    // Still in the hero, where the arm can take the page's logo, and landed in the box.
    const inHero = () => enter < 0.02;
    const landed = () => enter >= 1;
    let rise = 0; // 0 -> 1 as the robots rise into view on load
    let view = 0;
    let viewGoal = 0;
    let active: RobotName = "so101";
    let smoothing = 0; // seconds left of easing the arm toward its pose
    const shown = new Map<string, number>(); // joint values on screen while smoothing
    const ARM_JOINTS = ["shoulder_pan", "shoulder_lift", "elbow_flex", "wrist_flex", "wrist_roll", "gripper"];

    /* Hero -> Stage over the first half of the hero's scroll. */
    const enterGoal = () => {
        const { transitionScroll } = hero.layout;
        return transitionScroll > 0 ? clamp(window.scrollY / transitionScroll, 0, 1) : 0;
    };

    /* On wide screens, once the hero is past, the scroll pans to InMoov. */
    const scrollView = () => clamp((window.scrollY - hero.layout.landScroll) / (0.9 * window.innerHeight), 0, 1);

    let lastDriver: So101PickDemo | null = null;
    const driver = () => hero.driver(inHero());

    const lookAtViewer = () => {
        if (!head) return null;
        const from = head.getWorldPosition(new THREE.Vector3());
        const to = camera.position.clone().sub(from);
        const yaw = Math.atan2(to.x, to.z);
        const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
        return { x: clamp(yaw / HEAD_TURN.yaw, -1, 1), y: clamp(pitch / HEAD_TURN.pitch, -1, 1) };
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

    const draw = () => {
        const { heroRect, chamferSize } = hero.layout;
        drawRect = painter.draw({
            enter,
            rise,
            view,
            heroRect,
            chamferSize,
            compact: options.compact(),
            hint: {
                shown: rise >= 1 && inHero() && hero.logo.at === "page" && driver().idle,
                settled: smoothing === 0 && driver() === lastDriver,
            },
        });
    };

    const pointer = createPointer({
        camera,
        drawRect: () => drawRect,
        arm,
        heroPayload,
        humanoid: () => humanoid,
        frame: page.frame,
        landed,
        onChange: () => wake(),
    });
    // Until when each robot attends to the visitor rather than the cursor.
    let armAttention = 0;
    let inmoovAttention = 0;
    const inMotion = (pick: So101PickDemo) => !pick.idle && pick.state.progress !== pick.state.goal;
    let raf = 0;
    let last = 0;

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

        const closest: RobotName = landed() && view >= 0.5 ? "inmoov" : "so101";
        if (closest !== active) {
            active = closest;
            options.onActiveChange?.(active);
        }

        const pick = driver();
        if (lastDriver && pick !== lastDriver) {
            hero.handOver(lastDriver, pick);
            smoothing = 0.6;
        }
        lastDriver = pick;

        const hovered = pointer.hovered();
        if (inMotion(pick)) armAttention = time + ARM_ATTENTION_TIME;
        if (!reduceMotion) {
            // After a click the arm holds its pose (presenting the logo) instead of following the cursor.
            if (time < armAttention) pick.setLook(null);
            else if (hovered !== "so101") pick.setLook(pointer.lookFrom(so101.links.shoulder_link));
            // While waving and a little after, InMoov looks the visitor in the eyes.
            if (wave?.waving) inmoovAttention = time + ATTENTION_TIME;
            if (time < inmoovAttention) wave?.setLook(lookAtViewer());
            else if (hovered !== "inmoov" && wave && head) wave.setLook(pointer.lookFrom(head));
        }
        const picking = pick.update(dt, { instant: reduceMotion });
        const caught = inHero() ? hero.catchStep(dt) : null;
        hero.growHeld();
        // The wrist twists while it strains for the logo.
        if (caught?.wristTwist) so101.joints.wrist_roll.setJointValue(so101.joints.wrist_roll.angle + caught.wristTwist);
        smoothJoints(dt);
        const waving = wave?.update(dt, { instant: reduceMotion }) ?? false;

        // Once the hero is up, the slower work runs one piece per frame.
        if (rise >= 1 && !inmoovRequested) {
            inmoovRequested = true;
            renderer.precompile(scene, gridScene, camera);
            loadInMoov().catch((error: unknown) => console.error("Failed to load InMoov", error));
        } else if (rise >= 1 && plans.status === "none" && !relayoutTimer && boxPick.idle) {
            plans = { status: "planning", steps: hero.layOut() };
        }
        // Paused while the arm is busy in the box. The layout would reset it, and
        // a held infinity would be measured as a jaw.
        if (plans.status === "planning" && boxPick.idle) {
            const step = runFor(plans.steps);
            if (step.done) plansMade(step.value);
            showShown();
        }

        draw();

        if (!timings.firstFrame) {
            timings.firstFrame = performance.now() - started;
            prefetchOtherAssets();
        }
        // Keep going while a robot attends to the visitor, so it turns back to the cursor on its own.
        const working = rise < 1 || (!plansReady() && boxPick.idle) || driver() !== lastDriver
            || time < armAttention + 50 || time < inmoovAttention + 50;
        // A click handled in this frame may have woken the loop already.
        if (picking || caught?.moving || waving || panning || smoothing > 0 || working) {
            if (!raf) raf = requestAnimationFrame(tick);
        }
        else last = 0;
    };

    const wake = () => {
        if (!raf && !settingUp) raf = requestAnimationFrame(tick);
    };

    let pending: (() => void) | null = null; // asked for before the plans were ready
    function plansMade(ready: boolean) {
        plans = ready ? { status: "ready" } : { status: "none" };
        if (!ready) return;
        timings.plans = performance.now() - started;
        const action = pending;
        pending = null;
        if (action) {
            action();
            wake();
        }
    }
    const activate = (robot: RobotName) => {
        // After a click the visitor, not the cursor, has the robot's attention.
        if (robot === "inmoov") inmoovAttention = performance.now() + ATTENTION_TIME;
        else armAttention = performance.now() + ARM_ATTENTION_TIME;
        if (robot === "so101" && inHero() && !plansReady()) {
            pending = () => activate(robot);
        } else if (robot === "inmoov") {
            wave?.wave();
        } else if (landed()) {
            boxPick.toggle();
        } else if (inHero()) {
            hero.takeOrGiveBack();
        }
        wake();
    };

    const onLogoClick = (target: "hero" | "header") => (event: MouseEvent) => {
        if (!inHero()) return; // a plain link once scrolled
        if (plansReady() && !hero.plans.has(target)) return; // out of the arm's reach
        // The header's infinity is part of the home link. The arm takes it instead,
        // and "lucy" next to it still goes home.
        event.preventDefault();
        event.stopPropagation();
        if (plansReady()) hero.toggle(target);
        else pending = () => {
            if (inHero()) hero.toggle(target); // still in the hero by then
        };
        wake();
    };

    /* Hovering the hero's title makes the infinity the arm would take glow, and clicking takes it. */
    const heroText = [...page.hero.querySelectorAll<HTMLElement>(".home__title")];
    const invited = () => (options.compact() ? page.headerLogo : page.heroLogo);
    const onTextEnter = () => {
        if (inHero()) invited()?.classList.add("robot-invite");
    };
    const onTextLeave = () => invited()?.classList.remove("robot-invite");
    const onTextClick = (event: MouseEvent) => {
        // The logo's mark has its own listener.
        if (event.target === page.heroLogo || !inHero() || window.getSelection()?.toString()) return;
        event.stopPropagation();
        activate("so101");
    };

    const onClick = (event: MouseEvent) => {
        const target = event.target as Element | null;
        if (event.defaultPrevented || target?.closest(INTERACTIVE)) return;
        if (window.getSelection()?.toString()) return;
        const robot = pointer.hitTest(event.clientX, event.clientY);
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
            if (hero.upToDate()) return; // fonts or observers, nothing moved
            if (inMotion(boxPick) || hero.busy()) {
                renderer.fit();
                draw();
                relayout();
                return;
            }
            // The layout resets the arm, so give back what it held and the logo it carried.
            const held = boxPick.state.holding;
            const carried = hero.logo.at === "box" ? hero.logo : null;
            // Before the hero is up, stay light. The plans come after the rise.
            if (plans.status === "planning") plans.steps.return(false); // what it had half built goes
            plansMade(hero.layOutNow(plansReady()));
            if (held) {
                boxPick.takeOver();
                if (carried) hero.setLogo(carried);
            }
            showShown();
            draw();
            wake();
        }, 150);
    };

    // Before anything listens to the page.
    const planned = await inBackground(hero.layOut(false));
    // With parallel compiling, the first frame needn't stall on it either.
    await renderer.compileFirst(scene, camera);
    settingUp = false;
    enter = enterGoal();
    plansMade(planned); // phones plan with the layout

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
            listen(window, "pointermove", pointer.onMove, { passive: true }),
            listen(document, "pointerout", pointer.onOut),
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
        humanoid.visible = landed();
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
        hitTest: pointer.hitTest,
        state: () => ({
            enter,
            view,
            active,
            heroTarget: hero.target,
            layoutMs: Math.round(hero.layoutMs),
            catchReach: (() => {
                const plan = hero.plans.get("header");
                return plan?.flight ? +plan.home.position.distanceTo(shoulder()).toFixed(3) : null;
            })(),
            logoOut: hero.logoOut(),
            plans: Object.fromEntries([...hero.plans].map(([name, plan]) => [name, {
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
            heroRect: hero.layout.heroRect,
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
            hero.clear();
            boxPick.dispose();
            disposeWorld(scene, gridScene);
            renderer.dispose();
        },
    };
}
