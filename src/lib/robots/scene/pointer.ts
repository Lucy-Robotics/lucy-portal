/* The mouse over the robots: what it hovers, what a click hits, where the robots should look. */
import * as THREE from "three";

import { HIT_SLOP } from "../config.ts";
import type { RobotName } from "../robotPageScene.ts";
import type { Payload } from "./parts.ts";
import { contains, rayFrom, toScreen, viewHeight, viewWidth, type Rect } from "./screen.ts";

type PointerScene = {
    camera: THREE.Camera;
    drawRect: () => Rect;
    arm: THREE.Object3D;
    heroPayload: Payload;
    humanoid: () => THREE.Object3D | null;
    /* Where the robots are drawn (a box or frame), or null when they're free on screen. */
    shownIn: () => Rect | null;
    onChange: () => void;
};

export function createPointer(s: PointerScene) {
    let pointer: { x: number; y: number } | null = null;
    let hoverPending = false;
    let hovered: RobotName | null = null;

    const hitAt = (x: number, y: number): RobotName | null => {
        const raycaster = rayFrom(x, y, s.camera, s.drawRect());
        const armParts = [s.arm, ...(s.heroPayload.shown ? [s.heroPayload.group] : [])];
        if (raycaster.intersectObjects(armParts, true).length) return "so101";
        const humanoid = s.humanoid();
        if (humanoid?.visible && raycaster.intersectObject(humanoid, true).length) return "inmoov";
        return null;
    };
    const hitTest = (x: number, y: number): RobotName | null => {
        // In a box, only what's inside it counts.
        const shown = s.shownIn();
        if (shown && !contains(shown, x, y)) return null;
        const exact = hitAt(x, y);
        if (exact) return exact;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const robot = hitAt(x + Math.cos(angle) * HIT_SLOP, y + Math.sin(angle) * HIT_SLOP);
            if (robot) return robot;
        }
        return null;
    };

    return {
        hitTest,

        // Judged before anything moves; a hovered robot holds still so the click lands where aimed.
        hovered() {
            if (hoverPending) {
                hoverPending = false;
                hovered = pointer ? hitTest(pointer.x, pointer.y) : null;
                document.documentElement.classList.toggle("robot-hover", hovered !== null);
            }
            return hovered;
        },

        /* Look direction from `object` towards a screen point, the cursor by default. */
        lookFrom(object: THREE.Object3D, at = pointer) {
            if (!at) return null;
            const from = toScreen(object.getWorldPosition(new THREE.Vector3()), s.camera, s.drawRect());
            return {
                x: Math.tanh(((at.x - from.x) / (viewWidth() / 2)) * 1.6),
                y: Math.tanh((-(at.y - from.y) / (viewHeight() / 2)) * 1.6),
            };
        },

        onMove(event: PointerEvent) {
            if (event.pointerType !== "mouse") return;
            pointer = { x: event.clientX, y: event.clientY };
            hoverPending = true;
            s.onChange();
        },

        // relatedTarget is null when the pointer leaves the window.
        onOut(event: PointerEvent) {
            if (event.relatedTarget) return;
            pointer = null;
            hoverPending = true;
            s.onChange();
        },
    };
}
