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

import { HEAD_TURN, InMoovWave } from "./inmoovWave.ts";
import {
    createHalo,
    createLucyGlowMaterial,
    createLucyInfinity,
    loadLucyInfinity,
    type InfinityShape,
} from "./lucyInfinity.ts";
import { prefetchOtherAssets, ROBOT_ASSETS } from "./robotAssets.ts";
import { clamp, damp, degToRad, smoothstep, smootherstep } from "./math.ts";
import { forEachOwnMesh, loadRobot } from "./robotModel.ts";
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

const BODY_COLOR = "#2B3E50";
const MECHANISM_COLOR = "#000000";
const INMOOV_COLOR = "#f2f2f2";
const INMOOV_MECHANISM_LINKS = /^neck_link$|^(left|right)_shoulder_[xz]_link$/;
const INMOOV_EYE_LINKS = /eye(Left|Right)_link$/;

/* The arm stands at the world's origin, turned three-quarters toward the
   viewer and reaching left; its infinity stands on the grid to its left. */
const ARM_YAW = Math.PI + 0.55;
const BOX_INFINITY_X = -0.17;
/* The share of the hero's height scrolled by the end of the hero -> Stage
   transition. */
const TRANSITION_SHARE = 0.5;
/* Where in the transition the grid's window starts closing in on the box. */
const CLOSE_FROM = 0.55;
/* How far left of its spot it slides in from, in metres. */
const BOX_SLIDE = 0.35;
/* Where the gripper waits at rest (every plan shares this pose), and where
   it holds a logo it has taken. */
const REST = new THREE.Vector3(-0.13, 0.14, 0.06);
/* On phones the arm is drawn much bigger (to reach the header): its base
   stands right of centre (this share of the width) so it can wait in a
   natural ready pose, gripper hanging over the screen's left, and it holds a
   taken logo above itself. */
const PHONE_BASE = 0.66;
const REST_COMPACT = new THREE.Vector3(-0.08, 0.17, 0.06);
const CARRY_COMPACT = new THREE.Vector3(-0.04, 0.3, 0);
const CARRY = new THREE.Vector3(-0.12, 0.27, 0);
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

/* InMoov stands to the right, out of the arm's shot; its own shot keeps the
   arm in view beside it: all these robots, one platform. */
const INMOOV_X = 0.6;
const INMOOV_HEIGHT = 1.8;

/* Hero sizing, in metres. Wide screens: the hero logo sits this high above
   the arm's base (just within reach), the base this far from the right edge,
   and the arm's footprint takes at most this share of the width. Phones: the
   header logo sits this far from the shoulder. */
const LOGO_HEIGHT = 0.27;
const ARM_INSET = 0.09;
const ARM_MAX_WIDTH_SHARE = 0.4;
/* Wide screens, taking the hero's logo: extra wrist roll, and jaws opened
   wider / closed tighter than measured (radians, negative for less). */
const HERO_ROLL = 0.3;
const HERO_GRIPPER = { open: 0, closed: 0 };
/* Phones: how far the header logo may be from the shoulder, longest first:
   the further the arm can reach, the smaller it can be drawn. */
const HEADER_REACHES = [0.435, 0.42, 0.4, 0.38, 0.37, 0.35, 0.33, 0.31];
/* A logo out of reach: the arm stretches toward it as far as it possibly can
   (searched between these distances from the shoulder, in metres), the logo
   shakes in place, then flies into the open gripper. Seconds. */
const CATCH_RANGE = { min: 0.22, max: 0.55, steps: 5 };
/* On load the robots rise into view from below the screen, in seconds. */
const RISE_TIME = 1.3;
/* After a click, the robots turn to the visitor (the camera) instead of the
   cursor, for their animation and this long after it, in ms (InMoov's). */
const ATTENTION_TIME = 2500;
const ARM_ATTENTION_TIME = 800; // the arm's, back to the cursor sooner
const SHAKE_TIME = 0.9;
/* Meanwhile the wrist twists back and forth (radians, twists per second):
   trying to get it, and showing the open jaws. */
const WRIST_TWIST = { amplitude: 0.6, rate: 2 };
const FLIGHT_TIME = 0.7;

/* The camera looks down a little, from in front. On phones the hero's is
   level, at floor height: the base's bottom is then a flat line on the
   screen's bottom edge. */
const VIEW_DIRECTION = new THREE.Vector3(0, 0.38, 1).normalize();
const LEVEL_DIRECTION = new THREE.Vector3(0, 0, 1);
const FOV = 30;

/* Clicks on these go to the page, even over a robot. */
const INTERACTIVE = "a, button, input, textarea, select, label, summary, [role='button'], [contenteditable]";
const HIT_SLOP = 20; // px: thin robots, so a click in a gap still counts

type Rect = { left: number; top: number; width: number; height: number };

/* The fixed layers' width: the window's less a classic scrollbar. innerWidth
   counts the scrollbar, and a canvas that wide is squeezed into the layer
   (the robots then miss their glow, the hit tests and the box by a few px). */
const viewWidth = () => document.documentElement.clientWidth;

/* Background work (generators): a few ms of it at a time, the page drawing
   its frames in between. Slower overall, but nothing stalls. */
const SLICE_MS = 5;
function runFor<T>(steps: Generator<void, T>, ms = SLICE_MS) {
    const end = performance.now() + ms;
    let step = steps.next();
    while (!step.done && performance.now() < end) step = steps.next();
    return step;
}
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
async function inBackground<T>(steps: Generator<void, T>): Promise<T> {
    for (;;) {
        const step = runFor(steps);
        if (step.done) return step.value;
        await nextTask();
    }
}

const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
    left: a.left + (b.left - a.left) * t,
    top: a.top + (b.top - a.top) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
});

function cssColor(name: string, fallback: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function createMaterials(accent: string) {
    const standard = (color: string, roughness: number) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    return {
        body: standard(BODY_COLOR, 0.65),
        mechanism: standard(MECHANISM_COLOR, 0.45),
        inmoov: standard(INMOOV_COLOR, 0.6),
        // Exactly the page's green: unlit, no fog, and drawn after the eyes'
        // halos (transparent, fully opaque) so they can't tint it.
        glow: new THREE.MeshBasicMaterial({ color: accent, fog: false, transparent: true }),
        logo: createLucyGlowMaterial(),
    };
}

/* A Lucy infinity and the light it casts. Its origin is where it's pinched.
   The page gives it the logo's own glow (see the glow layer). */
/* How much glow an infinity has resting on the grid, against one in hand. */
const RESTING_GLOW = 0.35;

/* The infinities are drawn on their own layer as well, for their glow. */
const INFINITY_LAYER = 1;

/* InMoov's eyes, each with a faint green light. */
const EYES = 2;
const EYE_LIGHT = 0.03;

function createPayload(shape: InfinityShape, material: THREE.Material, accent: string) {
    const infinity = createLucyInfinity(shape, material);
    infinity.layers.set(INFINITY_LAYER);
    const light = new THREE.PointLight(accent, 0.1, 0.6, 2);
    const group = new THREE.Group();
    group.add(infinity, light);
    let shown = true;
    let glow = 1;
    return {
        group,
        infinity,
        // Hiding only darkens its light, as a new light count recompiles every material.
        get shown() {
            return shown;
        },
        set shown(value: boolean) {
            shown = value;
            infinity.visible = value;
            light.intensity = value ? 0.1 * glow : 0;
        },
        setPinch(x: number) {
            infinity.position.x = -x;
        },
        /* 0..1: how lit it is (its own colour and the light it casts). */
        setGlow(level: number) {
            glow = level;
            const uniforms = (material as THREE.ShaderMaterial).uniforms;
            if (uniforms?.glow) uniforms.glow.value = level;
            light.intensity = shown ? 0.1 * level : 0;
        },
    };
}

/* InMoov, in Blender units: scaled to its real height, stood on the grid,
   white with glowing green eyes. Returns it, and its eyes' halos (where their
   lights go). */
function standInMoov(inmoov: URDFRobot, materials: ReturnType<typeof createMaterials>, accent: string) {
    const eyes: THREE.Object3D[] = [];
    for (const [name, link] of Object.entries(inmoov.links)) {
        if (INMOOV_MECHANISM_LINKS.test(name)) forEachOwnMesh(link, (mesh) => (mesh.material = materials.mechanism));
        if (INMOOV_EYE_LINKS.test(name)) {
            forEachOwnMesh(link, (mesh) => (mesh.material = materials.glow));
            eyes.push(link);
        }
    }
    const base = new THREE.Group();
    base.add(inmoov);
    base.updateMatrixWorld(true);
    const raw = new THREE.Box3().setFromObject(inmoov);
    const scale = INMOOV_HEIGHT / (raw.max.y - raw.min.y);
    base.scale.setScalar(scale);
    base.position.set(INMOOV_X, -raw.min.y * scale, 0);
    base.updateMatrixWorld(true);

    // A small halo on each eye, sized in metres.
    const halos = eyes.map((eye) => {
        const bounds = new THREE.Box3();
        forEachOwnMesh(eye, (mesh) => bounds.expandByObject(mesh));
        const unscale = 1 / eye.getWorldScale(new THREE.Vector3()).x;
        const halo = createHalo(accent, 0.07 * unscale, 0.6);
        halo.position.copy(eye.worldToLocal(bounds.getCenter(new THREE.Vector3())));
        eye.add(halo);
        return halo;
    });
    return { body: base, halos };
}

/* An element's rectangle in the viewport, as the page is at the top. */
function topRect(element: Element) {
    const rect = element.getBoundingClientRect();
    const fixed = getComputedStyle(element.closest(".header") ?? element).position;
    const scrollY = fixed === "sticky" || fixed === "fixed" ? 0 : window.scrollY;
    return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2 + scrollY,
    };
}

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

    // Each robot's shot is fitted to its bounds at rest. Until InMoov is
    // here, its shot is the arm's.
    scene.updateMatrixWorld(true);
    const armShot = new THREE.Box3().setFromObject(arm).expandByObject(boxPayload.infinity);
    const shots = { so101: armShot, inmoov: armShot.clone() };

    /* ---------------- camera ---------------- */
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 60);
    camera.layers.enable(INFINITY_LAYER);

    /* Distance that fits a box in the frame at the camera's aspect ratio. */
    const fitDistance = (box: THREE.Box3) => {
        const size = box.getSize(new THREE.Vector3());
        const tan = Math.tan(degToRad(FOV / 2));
        const halfDepth = Math.max(size.x, size.z) / 2;
        return Math.max(size.y / 2 / tan, halfDepth / (tan * camera.aspect)) * 1.25 + halfDepth;
    };

    /* Frame a box that morphs from the arm's bounds to the humanoid's; its far
       corner leads, so InMoov fits as soon as it enters the shot. `level`
       (0..1) brings the camera down to floor height, looking straight ahead. */
    const placeCamera = (view: number, aspect: number, level = 0) => {
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        const lead = smootherstep(view * 2, 0, 1);
        const trail = smootherstep(view, 0, 1);
        const box = new THREE.Box3(
            shots.so101.min.clone().lerp(shots.inmoov.min, trail),
            shots.so101.max.clone().lerp(shots.inmoov.max, lead),
        );
        const center = box.getCenter(new THREE.Vector3());
        const distance = fitDistance(box);
        const direction = VIEW_DIRECTION.clone().lerp(LEVEL_DIRECTION, level).normalize();
        camera.position.copy(center).addScaledVector(direction, distance);
        camera.position.y *= 1 - level;
        camera.lookAt(center.x, center.y * 0.85 * (1 - level), center.z);
        camera.updateMatrixWorld(true);
        fog.near = distance * 0.7;
        fog.far = distance * 1.7;
    };

    /* ---------------- rendering ---------------- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);
    await nextTask(); // each WebGL context takes a while to create
    // The grid has its own renderer on the layer behind the page (no per-frame copy).
    const gridRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    gridRenderer.setPixelRatio(renderer.getPixelRatio());
    page.backdrop.appendChild(gridRenderer.domElement);
    let gridDrawn = false;
    // Only as big as the infinities (and their glow) on screen: the CSS
    // drop-shadow is cheap on a small canvas, not on the whole screen.
    const glowCanvas = document.createElement("canvas");
    glowCanvas.style.position = "absolute";
    page.glow.appendChild(glowCanvas);
    const glowContext = glowCanvas.getContext("2d")!;
    // Draws the robots into the depth buffer only: they hide what's behind them.
    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });

    // The rectangle the world is drawn into right now, and the hero's.
    let drawRect: Rect = { left: 0, top: 0, width: 1, height: 1 };
    let heroRect: Rect = { left: 0, top: 0, width: 1, height: 1 };

    const toScreen = (point: THREE.Vector3, rect = drawRect) => {
        const p = point.clone().project(camera);
        return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
    };

    /* An object's bounding box, projected to the screen. */
    const screenBounds = (object: THREE.Object3D, rect = drawRect) => {
        const box = new THREE.Box3().setFromObject(object);
        const corners = [0, 1].flatMap((i) => [0, 1].flatMap((j) => [0, 1].map((k) => toScreen(new THREE.Vector3(
            i ? box.max.x : box.min.x, j ? box.max.y : box.min.y, k ? box.max.z : box.min.z,
        ), rect))));
        return {
            left: Math.min(...corners.map((c) => c.x)),
            right: Math.max(...corners.map((c) => c.x)),
            top: Math.min(...corners.map((c) => c.y)),
            bottom: Math.max(...corners.map((c) => c.y)),
        };
    };

    const rayFrom = (x: number, y: number, rect = drawRect) => {
        const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -(((y - rect.top) / rect.height) * 2 - 1));
        const raycaster = new THREE.Raycaster();
        raycaster.layers.enableAll();
        raycaster.setFromCamera(ndc, camera);
        return raycaster;
    };

    /* ---------------- the hero: layout and the logo plans ---------------- */
    // A caught logo: the arm reaches (pick to 0.5, jaws open), the logo shakes,
    // flies in, the jaws close (pick to 1); and the same backwards.
    type CatchPhase = "idle" | "reach" | "shake" | "fly" | "grip" | "held" | "letgo" | "flyback" | "return";
    type HeroPlan = {
        logo: HTMLElement;
        pick: So101PickDemo;
        // Where the hero payload sits for this plan before it's taken, and the
        // point of it the gripper takes (along its loops, from the crossing).
        home: { position: THREE.Vector3; scale: number; pinch: number };
        // A logo out of reach flies to the arm instead: where it starts.
        flight: { from: THREE.Vector3; fromScale: number } | null;
        phase: CatchPhase;
        timer: number;
    };
    const heroPlans = new Map<"hero" | "header", HeroPlan>();
    let heroTarget: "hero" | "header" | null = null; // the plan in use
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

    let landScroll = 0; // scroll position where the hero has scrolled past
    // Scroll position where the arm has settled in the box: half the hero, or
    // later on wide screens if the hero's text would still be under the box
    // (pinned on the right from the top).
    let transitionScroll = 0;

    /* The canvases cover the window. */
    const fitCanvas = () => {
        const size = renderer.getSize(new THREE.Vector2());
        if (size.x === viewWidth() && size.y === window.innerHeight) return;
        renderer.setSize(viewWidth(), window.innerHeight, false);
        gridRenderer.setSize(viewWidth(), window.innerHeight, false);
    };

    // The box's chamfer, in px (read on layout, not every frame).
    let chamferSize = 24;

    let layoutMs = 0; // TEST-HOOK: time taken to lay out the hero (across frames when in the background)
    let plansReady = false;
    // A generator: the plans are worked out a step at a time (see runFor).
    const layoutHero = function* (reachIndex = 0, withPlans = true): Generator<void, void> {
        const started = performance.now();
        const width = viewWidth();
        const height = window.innerHeight;
        laidOutFor = layoutKey();
        disposeHeroPlans();
        fitCanvas();
        hintPlaced = false;
        yield;
        chamferSize = parseFloat(getComputedStyle(page.frame).getPropertyValue("--chamfer")) * 16 || 24;

        const hero = page.hero.getBoundingClientRect();
        landScroll = hero.bottom + window.scrollY;
        transitionScroll = TRANSITION_SHARE * hero.height;
        if (!options.compact()) {
            const frameTop = page.frame.getBoundingClientRect().top;
            for (const text of page.hero.querySelectorAll(".home__title, .home__tagline")) {
                const bottom = text.getBoundingClientRect().bottom + window.scrollY;
                transitionScroll = Math.max(transitionScroll, bottom - frameTop + 12);
            }
        }

        const compact = options.compact();
        const frame = page.frame.getBoundingClientRect();
        const aspect = frame.width && frame.height ? frame.width / frame.height : 0.77;
        // The hero's camera. draw() moves it between steps: put it back after each.
        const heroCamera = () => placeCamera(0, aspect, compact ? 1 : 0);
        heroCamera();

        // Pixels per metre at the arm, per pixel of the draw rectangle's height.
        const base = new THREE.Vector3(0, 0, 0);
        const ndcBase = base.clone().project(camera);
        const ndcUp = base.clone().add(new THREE.Vector3(0, 0.1, 0)).project(camera);
        const perPixel = (ndcUp.y - ndcBase.y) / 2 / 0.1;

        // Page scale, and where the base stands on the bottom edge.
        const heroLogo = page.heroLogo && !compact ? topRect(page.heroLogo) : null;
        const headerLogo = page.headerLogo ? topRect(page.headerLogo) : null;
        let scale = 1500;
        let baseX = width * PHONE_BASE;
        if (heroLogo?.width) {
            scale = Math.min((height - heroLogo.centerY) / LOGO_HEIGHT, (ARM_MAX_WIDTH_SHARE * width) / 0.12);
            baseX = width - ARM_INSET * scale;
        } else if (headerLogo?.width) {
            // Phones: centred, just big enough to reach the header logo.
            const shoulderHeight = shoulder().y;
            for (let i = 0; i < 8; i++) {
                const dy = height - shoulderHeight * scale - headerLogo.centerY;
                scale = Math.hypot(baseX - headerLogo.centerX, dy) / HEADER_REACHES[reachIndex];
            }
        }
        const rectHeight = scale / perPixel;
        const rectWidth = rectHeight * aspect;
        // Drawn from only once final (frames may come in between).
        const laidOut: Rect = {
            left: baseX - ((ndcBase.x + 1) / 2) * rectWidth,
            top: height - ((1 - ndcBase.y) / 2) * rectHeight,
            width: rectWidth,
            height: rectHeight,
        };
        // The base's front edge sits lower on screen than its centre: lift the
        // arm until its lowest point just touches the bottom edge.
        boxPick.reset();
        arm.updateMatrixWorld(true);
        yield;
        heroCamera();
        // Lowest on screen is lowest in clip space: project in place, no copies.
        let lowestNdc = Infinity;
        const vertex = new THREE.Vector3();
        forEachOwnMesh(so101.links.base_link, (mesh) => {
            const position = mesh.geometry.attributes.position;
            for (let i = 0; i < position.count; i++) {
                lowestNdc = Math.min(lowestNdc, vertex.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).project(camera).y);
            }
        });
        const lowest = laidOut.top + ((1 - lowestNdc) / 2) * laidOut.height;
        if (Number.isFinite(lowest)) laidOut.top -= lowest - height;
        heroRect = laidOut;
        yield;
        heroCamera();

        // Screen points become world points on the plane through the shoulder
        // that faces the camera, where the gripper can stay square to them.
        const from = shoulder();
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
            camera.getWorldDirection(new THREE.Vector3()).negate(),
            from,
        );
        const toWorld = (x: number, y: number) =>
            rayFrom(x, y, heroRect).ray.intersectPlane(plane, new THREE.Vector3()) ?? from.clone();
        const metresPerPixel = (point: THREE.Vector3) => {
            const a = toScreen(point, heroRect);
            const b = toScreen(point.clone().addScaledVector(right, 0.01), heroRect);
            return 0.01 / Math.hypot(b.x - a.x, b.y - a.y);
        };
        const carryAt = compact ? CARRY_COMPACT : CARRY;
        const carry = new THREE.Vector3(carryAt.x, carryAt.y, from.z);

        /*
         * Reach for a logo where it is. Out of reach, catch it instead: the
         * arm reaches toward it as far as it comfortably can, and the logo
         * flies into its gripper.
         */
        const planFor = function* (logo: HTMLElement, rect: ReturnType<typeof topRect>): Generator<void, HeroPlan | null> {
            const center = toWorld(rect.centerX, rect.centerY);
            const markScale = (rect.width * metresPerPixel(center)) / shape.width;
            // Wide screens, pinched by the far end of its right loop, which the
            // arm reaches from above right (over the text). Phones, taken by its centre.
            const pinchAt = compact ? 0 : shape.rightEnd;
            const pinch = center.clone().addScaledVector(right, pinchAt * markScale);
            const towards = pinch.clone().sub(from).normalize();
            // A logo is thin and round-edged, so the gripper needn't be square
            // to it: it reaches much further that way.
            const common = compact
                ? { rest: REST_COMPACT.clone(), restLean: DOWN, carry, carryLean: UP, square: false }
                : { rest: REST.clone(), restLean: DOWN, carry, carryLean: UP, square: false, restPose, rollOffset: HERO_ROLL, gripperOffset: HERO_GRIPPER };

            placeHeroPayload(pinch, markScale, pinchAt);
            const reach = yield* So101PickDemo.create(so101, arm, {
                object: heroPayload.group,
                gripWidth: shape.depth * markScale,
            }, { ...common, grasp: pinch.clone(), lean: compact ? towards : towards.clone().add(DOWN).normalize(), approach: 0.05 }, (holding) => {
                heroPayload.shown = holding;
                markVisible(logo, !holding);
                logoOut = holding ? logo : null;
            });
            heroCamera();
            if (reach.reachable) {
                return { logo, pick: reach, home: { position: pinch, scale: markScale, pinch: pinchAt }, flight: null, phase: "idle", timer: 0 };
            }
            reach.dispose();
            // Phones try a bigger arm before falling back to catching.
            if (compact && reachIndex < HEADER_REACHES.length - 1) return null;

            // Catch it: stretched toward it as far as the arm goes, where the
            // caught logo is fully on screen and clear of the header.
            const margin = 16;
            const halfWidth = (shape.width / 2) / metresPerPixel(from);
            const headerBottom = page.header?.getBoundingClientRect().bottom ?? 0;
            const onScreen = (point: THREE.Vector3) => {
                const p = toScreen(point, heroRect);
                return p.x - 2 * halfWidth >= margin && p.x + margin <= width && p.y - halfWidth >= headerBottom + margin;
            };
            const tryCatch = function* (distance: number): Generator<void, { at: THREE.Vector3; pick: So101PickDemo } | null> {
                const at = from.clone().addScaledVector(towards, distance);
                if (!onScreen(at)) return null;
                placeHeroPayload(at, 1, pinchAt);
                const catching = yield* So101PickDemo.create(so101, arm, {
                    object: heroPayload.group,
                    gripWidth: shape.depth,
                }, { ...common, grasp: at.clone(), lean: towards, approach: 0 });
                heroCamera();
                if (catching.reachable) return { at, pick: catching };
                catching.dispose();
                return null;
            };
            // The longest reach that works: binary search, keeping the best.
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

        // Worked out aside, and all in use at once when done: the arm never
        // drives a plan while the next one is still being solved.
        const plans = new Map<"hero" | "header", HeroPlan>();
        const add = function* (name: "hero" | "header", logo: HTMLElement | null, logoRect: ReturnType<typeof topRect> | null) {
            if (!logo || !logoRect?.width) return;
            const plan = yield* planFor(logo, logoRect);
            if (plan) plans.set(name, plan);
        };
        // Wide screens can show the arm first and plan once it's up (the
        // layout doesn't depend on the plans there); phones need the plan to
        // know how big to draw the arm.
        plansReady = false;
        try {
            if (withPlans || compact) {
                yield* add("hero", page.heroLogo, heroLogo);
                yield* add("header", page.headerLogo, headerLogo);
                for (const [name, plan] of plans) {
                    heroPlans.set(name, plan);
                    plan.logo.classList.add("robot-target");
                }
                plans.clear();
                plansReady = true;
            }
        } finally {
            for (const plan of plans.values()) plan.pick.dispose(); // abandoned half way
        }
        heroPayload.shown = false;

        layoutMs = performance.now() - started;
        if (!compact) return;
        const plan = heroPlans.get("header");
        // Out of reach at this size: a bit bigger.
        if (!plan && reachIndex < HEADER_REACHES.length - 1) yield* layoutHero(reachIndex + 1);
    };
    /* All at once (on resize). */
    const layoutNow = (withPlans: boolean) => {
        const steps = layoutHero(0, withPlans);
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

    const frameRect = (): Rect => {
        const r = page.frame.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    };

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

    /* A caught logo: shake, fly in, grip; or let go, fly back, rest. */
    let wristTwist = 0; // added to the wrist roll while it strains for the logo
    const catchStep = (dt: number) => {
        const plan = heroTarget ? heroPlans.get(heroTarget) : null;
        if (!plan?.flight) return false;
        const { progress, holding } = plan.pick.state;
        const { flight, logo } = plan;
        const place = (e: number) => {
            heroPayload.group.position
                .lerpVectors(flight.from, plan.home.position, e)
                .addScaledVector(UP, Math.sin(Math.PI * e) * 0.04);
            heroPayload.group.scale.setScalar(flight.fromScale + (plan.home.scale - flight.fromScale) * e);
        };
        const instant = reduceMotion;
        plan.timer += dt;
        switch (plan.phase) {
            case "reach": // stretching toward the logo, jaws open
                if (progress >= 0.5 - 1e-3) {
                    plan.phase = "shake";
                    plan.timer = 0;
                    logo.classList.add("robot-shake");
                }
                break;
            case "shake": // the logo works itself loose; the wrist strains for it
                if (!instant) {
                    const envelope = Math.sin(Math.PI * clamp(plan.timer / SHAKE_TIME, 0, 1));
                    wristTwist = WRIST_TWIST.amplitude * envelope * Math.sin(2 * Math.PI * WRIST_TWIST.rate * plan.timer);
                }
                if (instant || plan.timer >= SHAKE_TIME) {
                    logo.classList.remove("robot-shake");
                    markVisible(logo, false);
                    logoOut = logo;
                    heroPayload.shown = true;
                    plan.phase = "fly";
                    plan.timer = 0;
                    place(0);
                }
                break;
            case "fly": {
                const e = instant ? 1 : smoothstep(plan.timer, 0, FLIGHT_TIME);
                place(e);
                if (e >= 1) {
                    plan.phase = "grip";
                    plan.pick.setGoal(1);
                }
                break;
            }
            case "grip":
                if (holding && progress >= 1) plan.phase = "held";
                break;
            case "letgo": // opening the jaws: the logo floats free at the catch point
                if (progress <= 0.5 + 1e-3) {
                    plan.phase = "flyback";
                    plan.timer = 0;
                    heroPayload.shown = true;
                }
                break;
            case "flyback": {
                const e = instant ? 1 : smoothstep(plan.timer, 0, FLIGHT_TIME);
                place(1 - e);
                if (e >= 1) {
                    heroPayload.shown = false;
                    markVisible(logo, true);
                    logoOut = null;
                    logo.classList.add("robot-shake"); // settling back in
                    plan.phase = "return";
                    plan.timer = 0;
                    plan.pick.setGoal(0);
                }
                break;
            }
            case "return":
                if (plan.timer >= SHAKE_TIME) logo.classList.remove("robot-shake");
                if (progress <= 0 && plan.timer >= SHAKE_TIME) plan.phase = "idle";
                break;
            default:
                return false;
        }
        return plan.phase !== "idle" && plan.phase !== "held";
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
    /* The page logo's glow when the arm is invited to take it (robot-showcase.css:
       3px and 9px drop-shadows, 60% and 35%, on the hero's ~120px wide mark),
       scaled to a mark `size` px wide. */
    const glowColor = new THREE.Color(accent);
    const glowRgb = [glowColor.r, glowColor.g, glowColor.b]
        .map((c) => Math.round(clamp(c, 0, 1) * 255)).join(" ");
    const glowReach = (size: number) => ({ near: 0.025 * size, far: 0.075 * size });
    const logoGlow = (size: number, strength: number) => {
        const { near, far } = glowReach(size);
        return `drop-shadow(0 0 ${near.toFixed(1)}px rgb(${glowRgb} / ${(0.6 * strength).toFixed(2)})) `
            + `drop-shadow(0 0 ${far.toFixed(1)}px rgb(${glowRgb} / ${(0.35 * strength).toFixed(2)}))`;
    };
    /* The screen rectangle around some meshes, with `margin` px of room for
       their glow, within the screen; null if they're off it. */
    const glowArea = (meshes: THREE.Object3D[], margin: number, width: number, height: number) => {
        if (!meshes.length) return null;
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const mesh of meshes) {
            const bounds = screenBounds(mesh);
            left = Math.min(left, bounds.left);
            top = Math.min(top, bounds.top);
            right = Math.max(right, bounds.right);
            bottom = Math.max(bottom, bounds.bottom);
        }
        left = Math.max(0, Math.floor(left - margin));
        top = Math.max(0, Math.floor(top - margin));
        right = Math.min(width, Math.ceil(right + margin));
        bottom = Math.min(height, Math.ceil(bottom + margin));
        if (right <= left || bottom <= top) return null;
        return { left, top, width: right - left, height: bottom - top };
    };

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
            // Each part's own box, projected: much tighter than the arm's box in
            // world space (axis-aligned, it overshoots a lot once the arm turns).
            let top = Infinity;
            let left = Infinity;
            let right = -Infinity;
            arm.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;
                if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
                const { min, max } = object.geometry.boundingBox!;
                for (let corner = 0; corner < 8; corner++) {
                    hintCorner.set(corner & 1 ? max.x : min.x, corner & 2 ? max.y : min.y, corner & 4 ? max.z : min.z);
                    const p = toScreen(hintCorner.applyMatrix4(object.matrixWorld));
                    top = Math.min(top, p.y);
                    left = Math.min(left, p.x);
                    right = Math.max(right, p.x);
                }
            });
            // Centred above the arm, then nudged by --hint-x / --hint-y (robot-showcase.css).
            hint.style.transform = `translate(${((left + right) / 2).toFixed(1)}px, ${top.toFixed(1)}px) `
                + "translate(-50%, -100%) translate(var(--hint-x), var(--hint-y))";
        }
        hint.toggleAttribute("data-shown", visible && hintPlaced);
    };
    const hintCorner = new THREE.Vector3();
    let hintPlaced = false;

    /* The canvas's visible area: a rectangle (kept below the header) with the
       box's chamfer, scaled by `chamfer` (0 square, 1 the box's). */
    const HIDDEN = "inset(100%)";
    const clipTo = (rect: Rect, chamfer: number, headerBottom: number) => {
        const inset = 1; // inside the box's border
        const top = Math.max(rect.top + inset, headerBottom);
        const left = rect.left + inset;
        const right = rect.left + rect.width - inset;
        const bottom = rect.top + rect.height - inset;
        if (bottom <= top) return HIDDEN;
        const cut = chamfer * chamferSize;
        const topCut = top <= rect.top + inset ? cut : 0;
        return `polygon(${left}px ${top}px, ${right - topCut}px ${top}px, ${right}px ${top + topCut}px, `
            + `${right}px ${bottom}px, ${left + cut}px ${bottom}px, ${left}px ${bottom - cut}px)`;
    };

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
        placeCamera(enter >= 1 ? view : 0, drawRect.width / drawRect.height, level);

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
        const clip = enter <= 0 ? "none" : clipTo(lerpRect(screen, box, close), close, headerBottom);
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
            const bounds = screenBounds(lead.infinity);
            const size = Math.max(8, bounds.right - bounds.left);
            const strength = lead === heroPayload || boxPick.state.holding ? 1 : RESTING_GLOW;
            glowFilter = logoGlow(size, strength);
            // Room for the wider shadow to fade out entirely.
            const margin = Math.ceil(3 * glowReach(size).far) + 4;
            area = glowArea(payloads.map(({ infinity }) => infinity), margin, viewWidth(), height);
        }

        renderer.setScissorTest(false);
        renderer.setClearColor(0x000000, 0);
        renderer.clear();
        // The camera frames the draw rectangle, which may cover only part of
        // the screen (or overflow it): render the whole screen as a window onto
        // that framing, so a logo flying in from the header is still drawn.
        renderer.setViewport(0, 0, viewWidth(), height);
        camera.setViewOffset(drawRect.width, drawRect.height, -drawRect.left, -drawRect.top, viewWidth(), height);

        // Behind the page, the grid never crosses its text. Drawn once more when it goes, to clear it.
        if (grid.visible || gridDrawn) gridRenderer.render(gridScene, camera);
        gridDrawn = grid.visible;

        // The infinities' glow, like the logo's on the page: their visible
        // parts (the robots in front still hide them) are copied to the glow
        // layer, whose CSS drop-shadow does the glowing. Only the rectangle
        // around them is drawn and copied.
        glowCanvas.style.display = area ? "" : "none";
        page.glow.style.filter = glowFilter;
        if (area) {
            const ratio = renderer.getPixelRatio();
            const pixels = { width: Math.round(area.width * ratio), height: Math.round(area.height * ratio) };
            if (glowCanvas.width !== pixels.width || glowCanvas.height !== pixels.height) {
                glowCanvas.width = pixels.width;
                glowCanvas.height = pixels.height;
            }
            Object.assign(glowCanvas.style, {
                left: `${area.left}px`,
                top: `${area.top}px`,
                width: `${area.width}px`,
                height: `${area.height}px`,
            });
            renderer.setScissorTest(true);
            renderer.setScissor(area.left, height - area.top - area.height, area.width, area.height);
            // The robots into depth only, then the infinities alone (their own
            // layer): only their visible parts come out, wherever they're held.
            camera.layers.set(0);
            scene.overrideMaterial = depthOnly;
            renderer.render(scene, camera);
            scene.overrideMaterial = null;
            camera.layers.set(INFINITY_LAYER);
            renderer.render(scene, camera);
            camera.layers.enable(0);
            glowContext.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
            glowContext.drawImage(
                renderer.domElement,
                Math.round(area.left * ratio), Math.round(area.top * ratio), pixels.width, pixels.height,
                0, 0, pixels.width, pixels.height,
            );
            renderer.clear();
            renderer.setScissorTest(false);
        }
        renderer.render(scene, camera);
        camera.clearViewOffset();
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
        const from = toScreen(object.getWorldPosition(new THREE.Vector3()));
        return {
            x: Math.tanh(((pointer.x - from.x) / (viewWidth() / 2)) * 1.6),
            y: Math.tanh((-(pointer.y - from.y) / (window.innerHeight / 2)) * 1.6),
        };
    };

    /* Which robot, if any, is drawn at a screen point (forgiving: also a ring around it). */
    const hitAt = (x: number, y: number): RobotName | null => {
        const raycaster = rayFrom(x, y);
        const armParts = [arm, ...(heroPayload.shown ? [heroPayload.group] : [])];
        if (raycaster.intersectObjects(armParts, true).length) return "so101";
        if (humanoid?.visible && raycaster.intersectObject(humanoid, true).length) return "inmoov";
        return null;
    };
    const hitTest = (x: number, y: number): RobotName | null => {
        // In the box, only what's inside the box counts.
        if (enter >= 1) {
            const box = frameRect();
            if (x < box.left || x > box.left + box.width || y < box.top || y > box.top + box.height) return null;
        }
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
            precompile(gridRenderer, gridScene);
            precompile(renderer, scene);
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

    /* Compile every material ahead so none compiles mid-scroll. Only with parallel
       compiling, as otherwise it just moves the stall to the page load. */
    const precompile = (target: THREE.WebGLRenderer, world: THREE.Scene) => {
        if (!target.extensions.has("KHR_parallel_shader_compile")) return;
        target.compileAsync(world, camera).catch(() => {}); // else compiled when first drawn
        if (target !== renderer) return;
        // compileAsync skips depthOnly (an override material), so draw it once on one pixel.
        const humanoidVisible = humanoid?.visible ?? false;
        if (humanoid) humanoid.visible = true;
        renderer.setScissorTest(true);
        renderer.setScissor(0, 0, 1, 1);
        camera.layers.set(0);
        scene.overrideMaterial = depthOnly;
        renderer.render(scene, camera);
        scene.overrideMaterial = null;
        camera.layers.enable(INFINITY_LAYER);
        renderer.setScissorTest(false);
        if (humanoid) humanoid.visible = humanoidVisible;
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
                fitCanvas();
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
    await inBackground(layoutHero(0, false));
    // With parallel compiling, the first frame needn't stall on it either.
    if (renderer.extensions.has("KHR_parallel_shader_compile")) await renderer.compileAsync(scene, camera);
    settingUp = false;
    enter = enterGoal();
    if (plansReady) plansDone(); // phones plan with the layout

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("click", onClick);
    page.heroLogo?.addEventListener("click", onHeroLogo);
    for (const element of heroText) {
        element.classList.add("robot-takeable");
        element.addEventListener("pointerenter", onTextEnter);
        element.addEventListener("pointerleave", onTextLeave);
        element.addEventListener("click", onTextClick);
    }
    page.headerLogo?.addEventListener("click", onHeaderLogo, { capture: true });
    if (!reduceMotion) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("pointerout", onPointerOut);
    }
    window.addEventListener("resize", relayout);
    const resizeObserver = new ResizeObserver(relayout);
    resizeObserver.observe(page.frame);
    document.addEventListener("visibilitychange", wake);
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
        shots.inmoov = new THREE.Box3().setFromObject(humanoid)
            .expandByVector(new THREE.Vector3(0, 0.15, 0))
            .union(armShot);
        precompile(renderer, scene);
        timings.inmoov = performance.now() - started;
        wake();
    };

    enter = enterGoal();
    draw();
    wake();

    // TEST-HOOK: lets a browser test find the robots on screen and check the
    // effect of real clicks. RobotShowcase only exposes it in development.
    const screenRect = (object: THREE.Object3D) => screenBounds(object);
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
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("click", onClick);
            page.heroLogo?.removeEventListener("click", onHeroLogo);
            for (const element of heroText) {
                element.classList.remove("robot-takeable");
                element.removeEventListener("pointerenter", onTextEnter);
                element.removeEventListener("pointerleave", onTextLeave);
                element.removeEventListener("click", onTextClick);
            }
            page.heroLogo?.classList.remove("robot-invite");
            page.headerLogo?.classList.remove("robot-invite");
            page.headerLogo?.removeEventListener("click", onHeaderLogo, { capture: true });
            window.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerout", onPointerOut);
            window.removeEventListener("resize", relayout);
            document.removeEventListener("visibilitychange", wake);
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
            for (const used of [renderer, gridRenderer]) {
                used.dispose();
                used.forceContextLoss();
                used.domElement.remove();
            }
            glowCanvas.remove();
            depthOnly.dispose();
        },
    };
}
