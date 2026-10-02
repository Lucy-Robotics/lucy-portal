/*
 * The robot stage: one grid with two robots in the Lucy colours. The SO-101
 * arm (LeRobot URDF, TheRobotStudio, Apache 2.0) picks up a glowing Lucy
 * infinity; further right stands InMoov (Lucy URDF; meshes by Gael Langevin,
 * CC BY-NC 4.0), who waves. setView(0..1) slides the camera from one to the
 * other. Both follow the cursor anywhere on the page.
 *
 * Renders on demand: a frame on load and on resize, and frames only while
 * something moves.
 */
import * as THREE from "three";

import { InMoovWave } from "./inmoovWave.ts";
import {
    createFloorGlow,
    createHalo,
    createLucyInfinity,
    INFINITY_CENTER_HEIGHT,
    INFINITY_GRIP_WIDTH,
} from "./lucyInfinity.ts";
import { forEachOwnMesh, loadRobot } from "./robotModel.ts";
import { BASE_YAW, So101PickDemo } from "./so101PickDemo.ts";

export type RobotName = "so101" | "inmoov";

export type RobotStageScene = {
    /* 0 frames the SO-101, 1 frames InMoov; the camera eases between them. */
    setView(t: number): void;
    dispose(): void;
};

type Options = {
    /* Called when the robot the view is closest to changes. */
    onActiveChange?: (robot: RobotName) => void;
};

const BODY_COLOR = "#2B3E50";
const MECHANISM_COLOR = "#000000";

/* InMoov stands to the right of the arm, out of the first shot. */
const INMOOV_X = 1.1;
const INMOOV_HEIGHT = 1.8; // metres, stand included
const INMOOV_DARK_LINKS = /eye(Left|Right)_link$|^neck_link$|^(left|right)_shoulder_[xz]_link$/;

/* The camera looks down a little, from in front. */
const VIEW_DIRECTION = new THREE.Vector3(0, 0.38, 1).normalize();

function cssColor(el: Element, name: string, fallback: string) {
    return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/* Soft round shadow on the ground. */
function contactShadow(radius: number, opacity: number) {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, `rgba(0, 0, 0, ${opacity})`);
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 2, radius * 2),
        new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(canvas),
            transparent: true,
            depthWrite: false,
        }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    return shadow;
}

const damp = (from: number, to: number, rate: number, dt: number) =>
    from + (to - from) * (1 - Math.exp(-rate * dt));

export async function createRobotStageScene(container: HTMLElement, options: Options = {}): Promise<RobotStageScene> {
    const background = cssColor(container, "--color-bg-comp", "#141414");
    const accent = cssColor(container, "--color-highlight", "#00ff41");
    const gridColor = cssColor(container, "--color-border", "#3f3f3f");

    const material = (color: string, roughness: number) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    const body = material(BODY_COLOR, 0.65);
    const mechanism = material(MECHANISM_COLOR, 0.45);

    const [so101, inmoov] = await Promise.all([
        loadRobot("/models/so101/so101.urdf", "/models/so101/so101.glb", (urdfMaterial) =>
            urdfMaterial === "sts3215" ? mechanism : body,
        ),
        // InMoov's URDF colours are Blender leftovers, so its dark parts are picked by link.
        loadRobot("/models/inmoov/inmoov.urdf", "/models/inmoov/inmoov.glb", () => body),
    ]);
    for (const [name, link] of Object.entries(inmoov.links)) {
        if (INMOOV_DARK_LINKS.test(name)) forEachOwnMesh(link, (mesh) => (mesh.material = mechanism));
    }

    const scene = new THREE.Scene();
    // Fog in the stage colour fades the grid out; its range follows the camera.
    const fog = new THREE.Fog(background, 1, 2);
    scene.fog = fog;

    scene.add(new THREE.HemisphereLight(0xffffff, background, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-0.6, 1, 0.8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0.8, 0.4, -1);
    scene.add(rim);

    const grid = new THREE.GridHelper(16, 160, gridColor, gridColor);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    scene.add(grid);

    /* SO-101 and its payload, the Lucy infinity, glowing and lighting what's around it. */
    const so101Base = new THREE.Group();
    so101Base.rotation.y = BASE_YAW;
    so101Base.add(so101);
    scene.add(so101Base, contactShadow(0.12, 0.6));

    // Exactly the page's green, like the flat logo: unlit, no fog, and drawn
    // after the halo (transparent, fully opaque) so the halo can't tint it.
    const infinity = createLucyInfinity(new THREE.MeshBasicMaterial({
        color: accent,
        fog: false,
        transparent: true,
    }));
    infinity.renderOrder = 1;
    const payload = new THREE.Group();
    payload.add(infinity, createHalo(accent, 0.11), new THREE.PointLight(accent, 0.1, 0.6, 2));

    const pick = new So101PickDemo(so101, so101Base, scene, {
        object: payload,
        gripWidth: INFINITY_GRIP_WIDTH,
        restHeight: INFINITY_CENTER_HEIGHT,
        floorMark: createFloorGlow(accent, 0.3),
    });

    /* InMoov, in Blender units: scaled to its real height and stood on the grid. */
    const inmoovBase = new THREE.Group();
    inmoovBase.add(inmoov);
    inmoovBase.updateMatrixWorld(true);
    const rawBounds = new THREE.Box3().setFromObject(inmoov);
    const scale = INMOOV_HEIGHT / (rawBounds.max.y - rawBounds.min.y);
    inmoovBase.scale.setScalar(scale);
    inmoovBase.position.set(INMOOV_X, -rawBounds.min.y * scale, 0);
    const shadow = contactShadow(0.35, 0.6);
    shadow.position.x = INMOOV_X;
    scene.add(inmoovBase, shadow);

    const wave = new InMoovWave(inmoov);

    // Each robot's shot is fitted to its bounds at rest.
    scene.updateMatrixWorld(true);
    const shots = {
        so101: new THREE.Box3().setFromObject(so101Base).expandByObject(infinity),
        // Headroom above InMoov for its raised hand when it waves.
        inmoov: new THREE.Box3().setFromObject(inmoovBase).expandByVector(new THREE.Vector3(0, 0.15, 0)),
    };

    // Opaque, in the stage colour: additive glows don't composite over a transparent canvas.
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(background);
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 60);
    let view = 0;
    let viewGoal = 0;
    let active: RobotName = "so101";

    /* Distance that fits a box in the frame at the current aspect ratio. */
    const fitDistance = (box: THREE.Box3) => {
        const size = box.getSize(new THREE.Vector3());
        const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const halfDepth = Math.max(size.x, size.z) / 2;
        return Math.max(size.y / 2 / tan, halfDepth / (tan * camera.aspect)) * 1.25 + halfDepth;
    };

    const placeCamera = () => {
        // Frame a box that morphs from the arm's bounds to the humanoid's. Its
        // far corner (InMoov's side, and its head) leads, so InMoov fits as
        // soon as it enters the shot while the arm leaves last.
        const lead = THREE.MathUtils.smootherstep(view * 2, 0, 1);
        const trail = THREE.MathUtils.smootherstep(view, 0, 1);
        const box = new THREE.Box3(
            shots.so101.min.clone().lerp(shots.inmoov.min, trail),
            shots.so101.max.clone().lerp(shots.inmoov.max, lead),
        );
        const center = box.getCenter(new THREE.Vector3());
        const distance = fitDistance(box);
        camera.position.copy(center).addScaledVector(VIEW_DIRECTION, distance);
        camera.lookAt(center.x, center.y * 0.85, center.z);
        fog.near = distance * 0.7;
        fog.far = distance * 1.7;

        const closest: RobotName = view < 0.5 ? "so101" : "inmoov";
        if (closest !== active) {
            active = closest;
            options.onActiveChange?.(active);
        }
    };

    const resize = () => {
        const { clientWidth: width, clientHeight: height } = container;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        placeCamera();
    };

    const render = () => renderer.render(scene, camera);

    // With reduced motion, moves jump to their end and nothing follows the cursor.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;
    let visible = true;

    const tick = (time: number) => {
        if (!visible) {
            // Paused off-screen; wake() resumes it when the stage comes back.
            raf = 0;
            last = 0;
            return;
        }
        const dt = last ? Math.min((time - last) / 1000, 0.05) : 1 / 60;
        last = time;

        view = reduceMotion ? viewGoal : damp(view, viewGoal, 6, dt);
        const panning = Math.abs(view - viewGoal) > 1e-4;
        if (!panning) view = viewGoal;
        placeCamera();

        const picking = pick.update(dt, { instant: reduceMotion });
        const waving = wave.update(dt, { instant: reduceMotion });
        render();

        if (panning || picking || waving) {
            raf = requestAnimationFrame(tick);
        } else {
            raf = 0;
            last = 0;
        }
    };

    const wake = () => {
        if (visible && !raf) raf = requestAnimationFrame(tick);
    };

    /*
     * The robots follow the cursor anywhere on the page. The direction is
     * measured from the stage's centre in half-stage units and saturated, so
     * a cursor far across the page turns them a lot but never past their
     * limits: the arm keeps facing its infinity and glances toward the cursor.
     */
    let pointer: { x: number; y: number } | null = null;

    const updateLook = () => {
        let look: { x: number; y: number } | null = null;
        if (pointer) {
            const rect = container.getBoundingClientRect();
            const x = (pointer.x - (rect.left + rect.width / 2)) / (rect.width / 2);
            const y = -(pointer.y - (rect.top + rect.height / 2)) / (rect.height / 2);
            look = { x: Math.tanh(x * 0.8), y: Math.tanh(y * 0.8) };
        }
        pick.setLook(look);
        wave.setLook(look);
        wake();
    };

    const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType !== "mouse") return;
        pointer = { x: event.clientX, y: event.clientY };
        updateLook();
    };

    // relatedTarget is null when the pointer leaves the window.
    const onPointerOut = (event: PointerEvent) => {
        if (event.relatedTarget) return;
        pointer = null;
        updateLook();
    };

    // The stage moves under a still cursor when the page scrolls on narrow screens.
    const onScroll = () => {
        if (pointer) updateLook();
    };

    // Clicks and keys go to the robot in view.
    const onActivate = () => {
        if (active === "so101") pick.toggle();
        else wave.wave();
        wake();
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onActivate();
    };

    if (!reduceMotion) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("pointerout", onPointerOut);
        window.addEventListener("scroll", onScroll, { passive: true });
    }
    container.addEventListener("click", onActivate);
    container.addEventListener("keydown", onKeyDown);

    // Nothing to draw while the stage is off-screen.
    const visibility = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        wake();
    });
    visibility.observe(container);

    const resizeObserver = new ResizeObserver(() => {
        resize();
        render();
    });
    resizeObserver.observe(container);
    resize();
    render();

    return {
        setView(t) {
            viewGoal = THREE.MathUtils.clamp(t, 0, 1);
            wake();
        },
        dispose() {
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            visibility.disconnect();
            window.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerout", onPointerOut);
            window.removeEventListener("scroll", onScroll);
            container.removeEventListener("click", onActivate);
            container.removeEventListener("keydown", onKeyDown);
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments || object instanceof THREE.Sprite) {
                    object.geometry.dispose();
                    const materials = Array.isArray(object.material) ? object.material : [object.material];
                    materials.forEach((material) => {
                        (material as THREE.MeshBasicMaterial).map?.dispose();
                        material.dispose();
                    });
                }
            });
            renderer.dispose();
            renderer.domElement.remove();
        },
    };
}
