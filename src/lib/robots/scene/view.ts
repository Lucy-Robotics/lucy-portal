/*
 * Draws the world into its rectangle on the page. As `enter` goes 0 -> 1 the arm
 * shrinks into the box (landed at 0.8), and the visible area closes in on the box
 * from 0.55, so it stays wider than the box while the arm flies in. Once landed,
 * the track (track.ts) keeps the drawing on the box, a perch or the finale, gliding
 * or fading it from one to the next, and nothing is drawn while it is off screen. The box's
 * infinity stays in the box when the arm leaves it.
 */
import * as THREE from "three";

import { ARRIVAL, BOX_SLIDE, CLOSE_FROM, FOV, RESTING_GLOW } from "../config.ts";
import { degToRad, easeOutCubic, smoothstep } from "../math.ts";
import type { So101PickDemo } from "../so101PickDemo.ts";
import type { Framing } from "./framing.ts";
import { glowArea, glowReach, logoGlow, rgbOf } from "./glow.ts";
import type { SceneRenderer } from "./renderer.ts";
import type { TrackFrame } from "./track.ts";
import { chamferedClip, HIDDEN, lerpRect, partsBounds, screenBounds, toRect, toScreen, viewHeight, viewWidth, type Rect } from "./screen.ts";
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

// Scratch space for the per-frame maths.
const rest = new THREE.Vector3();
const inBox = new THREE.Vector3();
const turn = new THREE.Quaternion();

export function createView(s: ViewScene) {
    const { page, camera, boxPick } = s;
    const { scene, arm, boxInfinity, boxPayload, heroPayload } = s.world;
    const glowRgb = rgbOf(s.accent);
    let hintPlaced = false;
    let drawn = false; // the last frame put something on screen
    let pinned = false; // the box's infinity is placed to stay in the box (pinToBox)

    /* With the drawing elsewhere, places the box's infinity (at rest at `rest`) where it shows in the box
       just as in the box's own shot: same spot and size on screen, at the same depth, turned with the camera.
       Call with the camera framed for the box; it is framed for `drawRect` on return. */
    const pinToBox = (rest: THREE.Vector3, box: Rect, drawRect: Rect, frame: () => void) => {
        const group = boxPayload.group;
        inBox.copy(rest).applyMatrix4(camera.matrixWorldInverse);
        const depth = -inBox.z;
        // Where it shows on screen, in the box's shot.
        const { x, y } = toScreen(rest, camera, box);
        turn.copy(camera.quaternion).invert();
        frame();
        // The same spot in the drawing's shot.
        const ndcX = (x - drawRect.left) / drawRect.width * 2 - 1;
        const ndcY = 1 - (y - drawRect.top) / drawRect.height * 2;
        const tan = Math.tan(degToRad(FOV / 2));
        group.position.set(ndcX * depth * tan * camera.aspect, ndcY * depth * tan, -depth).applyMatrix4(camera.matrixWorld);
        group.quaternion.copy(camera.quaternion).multiply(turn);
        group.scale.setScalar(box.height / drawRect.height);
        pinned = true;
    };

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
            // Sliding into a station it just reached, or fading in (or out) along the scroll.
            const arrived = track ? easeOutCubic(f.arrival) * track.reveal : 1;
            drawRect.top += (1 - arrived) * ARRIVAL.rise;
            const level = f.compact ? 1 - settle : 0;
            const frame = () => s.framing.place(landed ? f.view : 0, drawRect.width / drawRect.height, level);

            // Slides in and lights up as the arm settles, unless the arm brought one (lit already).
            // Once the arm has left the box, it stays there, and goes with it.
            const held = boxPick.state.holding;
            const arrive = held ? 1 : smoothstep(enter, 0.35, 0.95);
            const left = !held && track !== null && !track.boxed;
            boxPayload.shown = arrive > 0 && (!left || box.top + box.height > headerBottom && box.top < height);
            boxPayload.setGlow(held ? 1 : smoothstep(enter, 0.55, 1));
            const group = boxPayload.group;
            if (pinned && !left) {
                group.position.copy(boxInfinity);
                group.quaternion.identity();
                group.scale.setScalar(1);
                pinned = false;
            }
            rest.copy(boxInfinity).setX(boxInfinity.x - (1 - arrive) * BOX_SLIDE);
            if (!held && boxPick.idle) group.position.x = rest.x;
            if (left && boxPayload.shown && boxPick.idle) {
                s.framing.place(0, box.width / box.height);
                pinToBox(rest, box, drawRect, frame);
            } else frame();
            const humanoid = s.humanoid();
            if (humanoid) humanoid.visible = track?.view === 1;
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
