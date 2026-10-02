/*
 * The SO-101 arm (LeRobot URDF, TheRobotStudio, Apache 2.0) on a grid, in
 * the Lucy colours, picking up a glowing Lucy infinity. Renders on demand:
 * a frame on load and on resize, and frames only while something moves.
 */
import * as THREE from "three";

import {
    createFloorGlow,
    createHalo,
    createLucyInfinity,
    INFINITY_CENTER_HEIGHT,
    INFINITY_GRIP_WIDTH,
} from "./lucyInfinity.ts";
import { loadRobot } from "./robotModel.ts";
import { BASE_YAW, So101PickDemo } from "./so101PickDemo.ts";

const MODEL_URL = "/models/so101/";

const BODY_COLOR = "#2B3E50";
const SERVO_COLOR = "#000000";

export type So101Scene = { dispose(): void };

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

export async function createSo101Scene(container: HTMLElement): Promise<So101Scene> {
    const background = cssColor(container, "--color-bg-comp", "#141414");
    const accent = cssColor(container, "--color-highlight", "#00ff41");
    const gridColor = cssColor(container, "--color-border", "#3f3f3f");

    const material = (color: string, roughness: number) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, flatShading: true });
    const body = material(BODY_COLOR, 0.65);
    const servo = material(SERVO_COLOR, 0.45);

    const robot = await loadRobot(MODEL_URL + "so101.urdf", MODEL_URL + "so101.glb", (urdfMaterial) =>
        urdfMaterial === "sts3215" ? servo : body,
    );

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
    scene.add(contactShadow(0.12, 0.6));

    const base = new THREE.Group();
    base.rotation.y = BASE_YAW;
    base.add(robot);
    scene.add(base);

    // The payload: the Lucy infinity, glowing and lighting what's around it.
    // Exactly the page's green, like the flat logo: unlit, no fog, and drawn
    // after the halo (transparent, fully opaque) so the halo can't tint it.
    const infinity = createLucyInfinity(new THREE.MeshBasicMaterial({
        color: accent,
        fog: false,
        transparent: true,
    }));
    infinity.renderOrder = 1;
    const light = new THREE.PointLight(accent, 0.1, 0.6, 2);
    const payload = new THREE.Group();
    payload.add(infinity, createHalo(accent, 0.11), light);

    const demo = new So101PickDemo(robot, base, scene, {
        object: payload,
        gripWidth: INFINITY_GRIP_WIDTH,
        restHeight: INFINITY_CENTER_HEIGHT,
        floorMark: createFloorGlow(accent, 0.3),
    });

    // Frame the arm and the payload at rest, whatever the stage's aspect ratio.
    scene.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(base).expandByObject(infinity);
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() / 2;

    // Opaque, in the stage colour: additive glows don't composite over a transparent canvas.
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(background);
    container.appendChild(renderer.domElement);

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

    // With reduced motion the arm jumps to the end of what was asked and never follows the cursor.
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
        const moving = demo.update(dt, { instant: reduceMotion });
        render();
        if (moving) {
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
     * The arm follows the cursor anywhere on the page. The direction is
     * measured from the stage's centre in half-stage units and saturated,
     * so a cursor far across the page turns it a lot but never past its
     * limits: it keeps facing its infinity and glances toward the cursor.
     */
    let pointer: { x: number; y: number } | null = null;

    const updateLook = () => {
        if (!pointer) {
            demo.setLook(null);
        } else {
            const rect = container.getBoundingClientRect();
            const x = (pointer.x - (rect.left + rect.width / 2)) / (rect.width / 2);
            const y = -(pointer.y - (rect.top + rect.height / 2)) / (rect.height / 2);
            demo.setLook({ x: Math.tanh(x * 0.8), y: Math.tanh(y * 0.8) });
        }
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

    const onClick = () => {
        demo.toggle();
        wake();
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onClick();
    };

    if (!reduceMotion) {
        window.addEventListener("pointermove", onPointerMove, { passive: true });
        document.addEventListener("pointerout", onPointerOut);
        window.addEventListener("scroll", onScroll, { passive: true });
    }
    container.addEventListener("click", onClick);
    container.addEventListener("keydown", onKeyDown);

    // Nothing to draw while the stage is off-screen.
    const visibility = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        wake();
    });
    visibility.observe(container);

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
            visibility.disconnect();
            window.removeEventListener("pointermove", onPointerMove);
            document.removeEventListener("pointerout", onPointerOut);
            window.removeEventListener("scroll", onScroll);
            container.removeEventListener("click", onClick);
            container.removeEventListener("keydown", onKeyDown);
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
