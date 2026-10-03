/*
 * The page side of the scene: screen rectangles, the viewport, and where the
 * 3D world lands on screen through the camera.
 */
import * as THREE from "three";

export type Rect = { left: number; top: number; width: number; height: number };

/* The fixed layers' width: the window's less a classic scrollbar. innerWidth
   counts the scrollbar, and a canvas that wide is squeezed into the layer
   (the robots then miss their glow, the hit tests and the box by a few px). */
export const viewWidth = () => document.documentElement.clientWidth;

export const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
    left: a.left + (b.left - a.left) * t,
    top: a.top + (b.top - a.top) * t,
    width: a.width + (b.width - a.width) * t,
    height: a.height + (b.height - a.height) * t,
});

export const toRect = ({ left, top, width, height }: DOMRect): Rect => ({ left, top, width, height });

export const contains = (rect: Rect, x: number, y: number) =>
    x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;

export function cssColor(name: string, fallback: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/* An element's rectangle in the viewport, as the page is at the top. */
export function topRect(element: Element) {
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
export type TopRect = ReturnType<typeof topRect>;

/* A world point on screen, the camera's view drawn into `rect`. */
export function toScreen(point: THREE.Vector3, camera: THREE.Camera, rect: Rect) {
    const p = point.clone().project(camera);
    return { x: rect.left + ((p.x + 1) / 2) * rect.width, y: rect.top + ((1 - p.y) / 2) * rect.height };
}

/* The ray from the camera through a screen point. */
export function rayFrom(x: number, y: number, camera: THREE.Camera, rect: Rect) {
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -(((y - rect.top) / rect.height) * 2 - 1));
    const raycaster = new THREE.Raycaster();
    raycaster.layers.enableAll();
    raycaster.setFromCamera(ndc, camera);
    return raycaster;
}

export type ScreenBounds = { left: number; right: number; top: number; bottom: number };

/* Screen bounds of boxes' corners (each box in `matrix`'s space). */
const corner = new THREE.Vector3();
function boxesOnScreen(boxes: { box: THREE.Box3; matrix?: THREE.Matrix4 }[], camera: THREE.Camera, rect: Rect): ScreenBounds {
    const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const { box: { min, max }, matrix } of boxes) {
        for (let i = 0; i < 8; i++) {
            corner.set(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z);
            if (matrix) corner.applyMatrix4(matrix);
            const p = toScreen(corner, camera, rect);
            bounds.left = Math.min(bounds.left, p.x);
            bounds.right = Math.max(bounds.right, p.x);
            bounds.top = Math.min(bounds.top, p.y);
            bounds.bottom = Math.max(bounds.bottom, p.y);
        }
    }
    return bounds;
}

/* An object's bounding box (in world space), projected to the screen. */
export const screenBounds = (object: THREE.Object3D, camera: THREE.Camera, rect: Rect) =>
    boxesOnScreen([{ box: new THREE.Box3().setFromObject(object) }], camera, rect);

/* Tighter: each of its meshes' own box, projected. An axis-aligned box in
   world space overshoots a lot once the object turns. */
export function partsBounds(object: THREE.Object3D, camera: THREE.Camera, rect: Rect) {
    const boxes: { box: THREE.Box3; matrix: THREE.Matrix4 }[] = [];
    object.traverse((part) => {
        if (!(part instanceof THREE.Mesh)) return;
        if (!part.geometry.boundingBox) part.geometry.computeBoundingBox();
        boxes.push({ box: part.geometry.boundingBox!, matrix: part.matrixWorld });
    });
    return boxesOnScreen(boxes, camera, rect);
}

/* A CSS clip-path showing a rectangle (kept below the header) with the box's
   chamfer (`chamferSize` px) scaled by `chamfer` (0 square, 1 the box's). */
export const HIDDEN = "inset(100%)";
export function chamferedClip(rect: Rect, chamfer: number, chamferSize: number, headerBottom: number) {
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
}
