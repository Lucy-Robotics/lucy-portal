/*
 * Draws the world into its rectangle on the page. As `enter` goes 0 -> 1 the grid
 * spreads over the page, the arm shrinks into the box (landed at 0.8), and the
 * visible area closes in on the box from 0.55, so it stays wider than the box
 * while the arm flies in.
 */
import * as THREE from "three";

import { BOX_SLIDE, CLOSE_FROM, RESTING_GLOW } from "../config.ts";
import { smoothstep } from "../math.ts";
import type { So101PickDemo } from "../so101PickDemo.ts";
import type { Framing } from "./framing.ts";
import { glowArea, glowReach, logoGlow, rgbOf } from "./glow.ts";
import type { SceneRenderer } from "./renderer.ts";
import { chamferedClip, HIDDEN, lerpRect, partsBounds, screenBounds, toRect, viewHeight, viewWidth, type Rect } from "./screen.ts";
import type { createWorld } from "./world.ts";

type ViewScene = {
    container: HTMLElement;
    page: { frame: HTMLElement; header: HTMLElement | null; backdrop: HTMLElement; glow: HTMLElement; hint: HTMLElement | null };
    world: ReturnType<typeof createWorld>;
    camera: THREE.PerspectiveCamera;
    framing: Framing;
    renderer: SceneRenderer;
    boxPick: So101PickDemo;
    accent: string;
    humanoid: () => THREE.Object3D | null;
};

export type ViewFrame = {
    enter: number;
    rise: number; // 0 -> 1 as the robots rise into view on load
    view: number;
    heroRect: Rect;
    chamferSize: number;
    compact: boolean;
    hint: { shown: boolean; settled: boolean };
};

export function createView(s: ViewScene) {
    const { page, camera, boxPick } = s;
    const { scene, gridScene, grid, gridMaterial, arm, boxInfinity, boxPayload, heroPayload } = s.world;
    const glowRgb = rgbOf(s.accent);
    let hintPlaced = false;

    /* "Click me!" above the arm while it waits in the hero. It stays put once placed. */
    const placeHint = (hint: ViewFrame["hint"], drawRect: Rect) => {
        if (!page.hint) return;
        // Wait for the arm to settle, as it eases from the pose on screen after a layout.
        if (hint.shown && !hintPlaced && hint.settled) {
            hintPlaced = true;
            const { top, left, right } = partsBounds(arm, camera, drawRect);
            // Nudged by --hint-x / --hint-y (robot-showcase.css).
            page.hint.style.transform = `translate(${((left + right) / 2).toFixed(1)}px, ${top.toFixed(1)}px) `
                + "translate(-50%, -100%) translate(var(--hint-x), var(--hint-y))";
        }
        page.hint.toggleAttribute("data-shown", hint.shown && hintPlaced);
    };

    return {
        resetHint() {
            hintPlaced = false;
        },

        draw(f: ViewFrame): Rect {
            const { enter } = f;
            const landed = enter >= 1;
            const height = viewHeight();
            // Read the layout before writing to the page (no forced reflow).
            const box = toRect(page.frame.getBoundingClientRect());
            const headerBottom = page.header?.getBoundingClientRect().bottom ?? 0;
            const settle = smoothstep(enter, 0, 0.8);
            const drawRect = lerpRect(f.heroRect, box, settle);
            // Rises into view on load from a screen lower.
            drawRect.top += (1 - f.rise) ** 3 * height;
            const level = f.compact ? 1 - settle : 0;
            s.framing.place(landed ? f.view : 0, drawRect.width / drawRect.height, level);

            const grid01 = smoothstep(enter, 0.05, 0.4);
            gridMaterial.opacity = 0.6 * grid01;
            grid.visible = grid01 > 0;

            // Slides in and lights up as the arm settles, unless the arm brought one (lit already).
            const held = boxPick.state.holding;
            const arrive = held ? 1 : smoothstep(enter, 0.35, 0.95);
            boxPayload.shown = arrive > 0;
            boxPayload.setGlow(held ? 1 : smoothstep(enter, 0.55, 1));
            if (!held && boxPick.idle) boxPayload.group.position.x = boxInfinity.x - (1 - arrive) * BOX_SLIDE;
            const humanoid = s.humanoid();
            if (humanoid) humanoid.visible = landed;
            page.frame.toggleAttribute("data-landed", landed);

            const screen: Rect = { left: -1, top: -1, width: viewWidth() + 2, height: height + 2 };
            const close = smoothstep(enter, CLOSE_FROM, 1);
            const clip = enter <= 0 ? "none" : chamferedClip(lerpRect(screen, box, close), close, f.chamferSize, headerBottom);
            const layers = [s.container, page.backdrop, page.glow];
            for (const layer of layers) layer.style.clipPath = clip;
            if (clip === HIDDEN) {
                page.hint?.removeAttribute("data-shown");
                return drawRect; // scrolled out of sight (phones), nothing to draw
            }
            // Phones: pinned to the page, so they scroll with the box.
            // shortcut: drawing at the very end of the page would lengthen it.
            const top = f.compact ? `${window.scrollY}px` : "";
            for (const layer of layers) layer.style.top = top;

            // Measured before the camera gets its view offset for drawing.
            scene.updateMatrixWorld();
            placeHint(f.hint, drawRect);
            const payloads = [boxPayload, heroPayload].filter(({ shown }) => shown);
            // Like the page logo's glow, reach follows on-screen size; full when held or flying, dim at rest.
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

            s.renderer.render({
                scene,
                gridScene,
                gridVisible: grid.visible,
                camera,
                drawRect,
                glowArea: area,
                glowFilter,
            });
            return drawRect;
        },
    };
}
