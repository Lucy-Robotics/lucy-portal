/*
 * Draws the world into its rectangle on the page. As `enter` goes 0 -> 1 the arm
 * shrinks into the box (landed at 0.8), and the visible area closes in on the box
 * from 0.55, so it stays wider than the box while the arm flies in. Once landed,
 * the track (track.ts) keeps the drawing on the box, a perch or the finale, sliding it
 * in on arrival, and nothing is drawn while that station is off screen.
 */
import * as THREE from "three";

import { ARRIVAL, BOX_SLIDE, CLOSE_FROM, RESTING_GLOW } from "../config.ts";
import { easeOutCubic, smoothstep } from "../math.ts";
import type { So101PickDemo } from "../so101PickDemo.ts";
import type { Framing } from "./framing.ts";
import { glowArea, glowReach, logoGlow, rgbOf } from "./glow.ts";
import type { SceneRenderer } from "./renderer.ts";
import type { TrackFrame } from "./track.ts";
import { chamferedClip, HIDDEN, lerpRect, partsBounds, screenBounds, toRect, viewHeight, viewWidth, type Rect } from "./screen.ts";
import type { createWorld } from "./world.ts";

type ViewScene = {
    container: HTMLElement;
    page: { frame: HTMLElement; header: HTMLElement | null; glow: HTMLElement; hint: HTMLElement | null };
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
    /* Read once landed. */
    track: TrackFrame | null;
    /* 0 -> 1 as the robot slides into a station it just reached. */
    arrival: number;
};

export function createView(s: ViewScene) {
    const { page, camera, boxPick } = s;
    const { scene, arm, boxInfinity, boxPayload, heroPayload } = s.world;
    const glowRgb = rgbOf(s.accent);
    let hintPlaced = false;
    let drawn = false; // the last frame put something on screen

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

        get drawn() {
            return drawn;
        },

        draw(f: ViewFrame): Rect {
            const { enter } = f;
            const landed = enter >= 1;
            const height = viewHeight();
            // Read the layout before writing to the page (no forced reflow).
            const box = toRect(page.frame.getBoundingClientRect());
            const headerBottom = page.header?.getBoundingClientRect().bottom ?? 0;
            const settle = smoothstep(enter, 0, 0.8);
            const track = landed ? f.track : null;
            const drawRect = track ? { ...track.drawRect } : lerpRect(f.heroRect, box, settle);
            // Rises into view on load from a screen lower.
            drawRect.top += (1 - f.rise) ** 3 * height;
            const arrived = track ? easeOutCubic(f.arrival) : 1;
            drawRect.top += (1 - arrived) * ARRIVAL.rise;
            const level = f.compact ? 1 - settle : 0;
            s.framing.place(landed ? f.view : 0, drawRect.width / drawRect.height, level);

            // Slides in and lights up as the arm settles, unless the arm brought one (lit already).
            // Perched, the arm stands alone by the feature's picture.
            const held = boxPick.state.holding;
            const arrive = held ? 1 : smoothstep(enter, 0.35, 0.95);
            boxPayload.shown = arrive > 0 && (held || track?.perch == null);
            boxPayload.setGlow(held ? 1 : smoothstep(enter, 0.55, 1));
            if (!held && boxPick.idle) boxPayload.group.position.x = boxInfinity.x - (1 - arrive) * BOX_SLIDE;
            const humanoid = s.humanoid();
            if (humanoid) humanoid.visible = track?.nearFinale ?? false;
            page.frame.toggleAttribute("data-landed", landed);

            const screen: Rect = { left: -1, top: -1, width: viewWidth() + 2, height: height + 2 };
            let clip = "none";
            if (track) {
                // Perched, the arm has the whole screen below the header.
                const target = track.clipRect ?? screen;
                clip = chamferedClip(lerpRect(screen, target, track.close), track.close, f.chamferSize, headerBottom);
            } else if (enter > 0) {
                const close = smoothstep(enter, CLOSE_FROM, 1);
                clip = chamferedClip(lerpRect(screen, box, close), close, f.chamferSize, headerBottom);
            }
            const layers = [s.container, page.glow];
            if (track && !track.onScreen) clip = HIDDEN;
            const opacity = arrived < 1 ? String(arrived) : "";
            for (const layer of layers) {
                layer.style.clipPath = clip;
                layer.style.opacity = opacity;
            }
            if (clip === HIDDEN) {
                page.hint?.removeAttribute("data-shown");
                drawn = false;
                return drawRect; // scrolled out of sight, nothing to draw
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

            drawn = true;
            s.renderer.render({
                scene,
                camera,
                drawRect,
                glowArea: area,
                glowFilter,
            });
            return drawRect;
        },
    };
}
