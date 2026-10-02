/*
 * The SO-101 arm (LeRobot URDF, TheRobotStudio, Apache 2.0) standing on a
 * grid, in the Lucy colours. Renders on demand: one frame on load and on
 * resize, and frames only while the arm eases toward the cursor.
 */
import * as THREE from "three";

import type { URDFRobot } from "urdf-loader";

import { loadRobot } from "./robotModel.ts";

const MODEL_URL = "/models/so101/";

const BODY_COLOR = "#2B3E50";
const SERVO_COLOR = "#000000";
const ACCENT_LINK = "moving_jaw_so101_v1_link"; // the gripper's top (moving) jaw

/* Rest pose: upper arm raised, forearm forward, gripper tilted down. */
const REST = {
    shoulder_pan: 0,
    shoulder_lift: -1.0,
    elbow_flex: 0.6,
    wrist_flex: 1.3,
    wrist_roll: 0,
    gripper: 0.6,
};

/* How far the arm turns toward the cursor, at the screen edges, in radians. */
const FOLLOW = { pan: 0.6, wrist: 0.35 };

export type So101Scene = { dispose(): void };

const damp = (from: number, to: number, rate: number, dt: number) =>
    from + (to - from) * (1 - Math.exp(-rate * dt));

function cssColor(el: Element, name: string, fallback: string) {
    return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

/* Soft round shadow under the base. */
function contactShadow(radius: number) {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0.6)");
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

async function createRobot(accent: string) {
    const material = (color: string, roughness: number) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    const body = material(BODY_COLOR, 0.65);
    const servo = material(SERVO_COLOR, 0.45);
    const gripper = material(accent, 0.5);

    const robot = await loadRobot(MODEL_URL + "so101.urdf", MODEL_URL + "so101.glb", (urdfMaterial) =>
        urdfMaterial === "sts3215" ? servo : body,
    );
    // The moving jaw is a leaf link, so this only reaches its own meshes.
    robot.links[ACCENT_LINK].traverse((object) => {
        if (object instanceof THREE.Mesh && object.material === body) object.material = gripper;
    });
    return robot;
}

function pose(robot: URDFRobot, look: THREE.Vector2) {
    robot.setJointValues({
        ...REST,
        shoulder_pan: REST.shoulder_pan + look.x * FOLLOW.pan,
        wrist_flex: REST.wrist_flex - look.y * FOLLOW.wrist,
    });
}

export async function createSo101Scene(container: HTMLElement): Promise<So101Scene> {
    const background = cssColor(container, "--color-bg-comp", "#141414");
    const accent = cssColor(container, "--color-highlight", "#00ff41");
    const gridColor = cssColor(container, "--color-border", "#3f3f3f");
    const robot = await createRobot(accent);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    // Fog in the stage colour fades the grid out instead of ending it on a hard edge.
    scene.fog = new THREE.Fog(background, 0.9, 2.2);

    scene.add(new THREE.HemisphereLight(0xffffff, background, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-0.6, 1, 0.8);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.8);
    rim.position.set(0.8, 0.4, -1);
    scene.add(rim);

    const grid = new THREE.GridHelper(4, 80, gridColor, gridColor);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.6;
    scene.add(grid);
    scene.add(contactShadow(0.12));

    const turntable = new THREE.Group();
    turntable.rotation.y = -0.6; // three-quarter view, reaching toward the viewer's right
    turntable.add(robot);
    scene.add(turntable);

    const look = new THREE.Vector2();
    const lookGoal = new THREE.Vector2();
    pose(robot, look);

    // Frame the arm from its rest-pose bounds, whatever the stage's aspect ratio.
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(turntable);
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 20);

    const frame = () => {
        const { clientWidth: width, clientHeight: height } = container;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
        const fit = Math.min(Math.tan(halfFov), Math.tan(halfFov) * camera.aspect);
        const distance = (radius * 1.25) / fit;
        const direction = new THREE.Vector3(0, 0.38, 1).normalize();
        camera.position.copy(center).addScaledVector(direction, distance);
        camera.lookAt(center.x, center.y * 0.85, center.z);
        camera.updateProjectionMatrix();
    };

    const render = () => renderer.render(scene, camera);

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = 0;

    const tick = (time: number) => {
        const dt = last ? Math.min((time - last) / 1000, 0.05) : 1 / 60;
        last = time;
        look.x = damp(look.x, lookGoal.x, 5, dt);
        look.y = damp(look.y, lookGoal.y, 5, dt);
        pose(robot, look);
        render();
        if (look.distanceTo(lookGoal) > 0.001) {
            raf = requestAnimationFrame(tick);
        } else {
            raf = 0;
            last = 0;
        }
    };

    const wake = () => {
        if (!raf) raf = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
        if (reduceMotion || event.pointerType !== "mouse") return;
        const rect = container.getBoundingClientRect();
        lookGoal.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -(((event.clientY - rect.top) / rect.height) * 2 - 1),
        );
        wake();
    };

    const onPointerLeave = () => {
        lookGoal.set(0, 0);
        wake();
    };

    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);

    const resizeObserver = new ResizeObserver(() => {
        frame();
        render();
    });
    resizeObserver.observe(container);
    frame();
    render();

    return {
        dispose() {
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            container.removeEventListener("pointermove", onPointerMove);
            container.removeEventListener("pointerleave", onPointerLeave);
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
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
