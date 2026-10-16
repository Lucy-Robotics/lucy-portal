/*
 * The infinities' glow, matching the page logo's in robot-showcase.css (3px and
 * 9px drop-shadows at 60% and 35% on a ~120px mark), scaled to a mark `size` px wide.
 */
import * as THREE from "three";

import { clamp } from "../math.ts";
import type { Rect, ScreenBounds } from "./screen.ts";

export const glowReach = (size: number) => ({ near: 0.025 * size, far: 0.075 * size });

/* A colour as CSS rgb() components ("0 255 65"), for logoGlow. */
export function rgbOf(color: string) {
    const c = new THREE.Color(color);
    return [c.r, c.g, c.b].map((v) => Math.round(clamp(v, 0, 1) * 255)).join(" ");
}

/* `strength` is 0..1 and `rgb` comes from rgbOf. */
export function logoGlow(size: number, strength: number, rgb: string) {
    const { near, far } = glowReach(size);
    return `drop-shadow(0 0 ${near.toFixed(1)}px rgb(${rgb} / ${(0.6 * strength).toFixed(2)})) `
        + `drop-shadow(0 0 ${far.toFixed(1)}px rgb(${rgb} / ${(0.35 * strength).toFixed(2)}))`;
}

/* The screen rectangle around some bounds, with `margin` px of room for their
   glow, clipped to the screen. Null if they're off it. */
export function glowArea(all: ScreenBounds[], margin: number, width: number, height: number): Rect | null {
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const bounds of all) {
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
}
