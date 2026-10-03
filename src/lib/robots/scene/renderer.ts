/*
 * The WebGL side: the robots' canvas (fixed over the page), the grid's own
 * (on the layer behind the page: no per-frame copy), and the glow layer's
 * copy of the infinities.
 */
import * as THREE from "three";

import { nextTask } from "../../background.ts";
import { INFINITY_LAYER } from "./parts.ts";
import { viewWidth, type Rect } from "./screen.ts";

/* What a frame draws. */
export type Frame = {
    scene: THREE.Scene;
    gridScene: THREE.Scene;
    gridVisible: boolean;
    camera: THREE.PerspectiveCamera;
    // Where on screen the camera's view goes.
    drawRect: Rect;
    // Where the infinities are (with room for their glow), and the glow's CSS filter.
    glowArea: Rect | null;
    glowFilter: string;
};

export class SceneRenderer {
    private readonly main: THREE.WebGLRenderer;
    private readonly grid: THREE.WebGLRenderer;
    private readonly glowLayer: HTMLElement;
    // Only as big as the infinities (and their glow) on screen: the CSS
    // drop-shadow is cheap on a small canvas, not on the whole screen.
    private readonly glowCanvas = document.createElement("canvas");
    private readonly glowContext: CanvasRenderingContext2D;
    // Draws the robots into the depth buffer only: they hide what's behind them.
    private readonly depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
    private gridDrawn = false;

    /* Each WebGL context takes a while to create: the page runs in between. */
    static async create(layer: HTMLElement, backdrop: HTMLElement, glowLayer: HTMLElement) {
        const main = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        main.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        main.autoClear = false;
        layer.appendChild(main.domElement);
        await nextTask();
        const grid = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        grid.setPixelRatio(main.getPixelRatio());
        backdrop.appendChild(grid.domElement);
        return new SceneRenderer(main, grid, glowLayer);
    }

    private constructor(main: THREE.WebGLRenderer, grid: THREE.WebGLRenderer, glowLayer: HTMLElement) {
        this.main = main;
        this.grid = grid;
        this.glowLayer = glowLayer;
        this.glowCanvas.style.position = "absolute";
        glowLayer.appendChild(this.glowCanvas);
        this.glowContext = this.glowCanvas.getContext("2d")!;
    }

    /* The browser compiles shaders in the background (else compileAsync just blocks). */
    get parallelCompile() {
        return this.main.extensions.has("KHR_parallel_shader_compile");
    }

    /* The canvases cover the window. */
    fit() {
        const size = this.main.getSize(new THREE.Vector2());
        if (size.x === viewWidth() && size.y === window.innerHeight) return;
        this.main.setSize(viewWidth(), window.innerHeight, false);
        this.grid.setSize(viewWidth(), window.innerHeight, false);
    }

    /* Compile every material ahead (hidden ones too, and `alsoShown` for the
       depth pass), so none compiles mid-scroll. Only with parallel compiling:
       otherwise it just moves the stall to the page load. */
    precompile(scene: THREE.Scene, gridScene: THREE.Scene, camera: THREE.Camera, alsoShown: THREE.Object3D | null = null) {
        if (!this.parallelCompile) return;
        this.grid.compileAsync(gridScene, camera).catch(() => {}); // else compiled when first drawn
        this.main.compileAsync(scene, camera).catch(() => {});
        // compileAsync skips depthOnly (an override material), so draw it once on one pixel.
        const wasVisible = alsoShown?.visible ?? false;
        if (alsoShown) alsoShown.visible = true;
        this.main.setScissorTest(true);
        this.main.setScissor(0, 0, 1, 1);
        camera.layers.set(0);
        scene.overrideMaterial = this.depthOnly;
        this.main.render(scene, camera);
        scene.overrideMaterial = null;
        camera.layers.enable(INFINITY_LAYER);
        this.main.setScissorTest(false);
        if (alsoShown) alsoShown.visible = wasVisible;
    }

    /* Before the first frame, with parallel compiling: none of it stalls. */
    async compileFirst(scene: THREE.Scene, camera: THREE.Camera) {
        if (this.parallelCompile) await this.main.compileAsync(scene, camera);
    }

    render(f: Frame) {
        const { main, glowCanvas, glowContext } = this;
        const { scene, camera, drawRect, glowArea: area } = f;
        const height = window.innerHeight;
        main.setScissorTest(false);
        main.setClearColor(0x000000, 0);
        main.clear();
        // The camera frames the draw rectangle, which may cover only part of
        // the screen (or overflow it): render the whole screen as a window onto
        // that framing, so a logo flying in from the header is still drawn.
        main.setViewport(0, 0, viewWidth(), height);
        camera.setViewOffset(drawRect.width, drawRect.height, -drawRect.left, -drawRect.top, viewWidth(), height);

        // Behind the page, the grid never crosses its text. Drawn once more when it goes, to clear it.
        if (f.gridVisible || this.gridDrawn) this.grid.render(f.gridScene, camera);
        this.gridDrawn = f.gridVisible;

        // The infinities' glow, like the logo's on the page: their visible
        // parts (the robots in front still hide them) are copied to the glow
        // layer, whose CSS drop-shadow does the glowing. Only the rectangle
        // around them is drawn and copied.
        glowCanvas.style.display = area ? "" : "none";
        this.glowLayer.style.filter = f.glowFilter;
        if (area) {
            const ratio = main.getPixelRatio();
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
            main.setScissorTest(true);
            main.setScissor(area.left, height - area.top - area.height, area.width, area.height);
            // The robots into depth only, then the infinities alone (their own
            // layer): only their visible parts come out, wherever they're held.
            camera.layers.set(0);
            scene.overrideMaterial = this.depthOnly;
            main.render(scene, camera);
            scene.overrideMaterial = null;
            camera.layers.set(INFINITY_LAYER);
            main.render(scene, camera);
            camera.layers.enable(0);
            glowContext.clearRect(0, 0, glowCanvas.width, glowCanvas.height);
            glowContext.drawImage(
                main.domElement,
                Math.round(area.left * ratio), Math.round(area.top * ratio), pixels.width, pixels.height,
                0, 0, pixels.width, pixels.height,
            );
            main.clear();
            main.setScissorTest(false);
        }
        main.render(scene, camera);
        camera.clearViewOffset();
    }

    dispose() {
        for (const renderer of [this.main, this.grid]) {
            renderer.dispose();
            renderer.forceContextLoss();
            renderer.domElement.remove();
        }
        this.glowCanvas.remove();
        this.depthOnly.dispose();
    }
}
