import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { HiOutlineChevronDown } from "react-icons/hi2";

import { prefetchHeroAssets } from "../lib/robots/robotAssets.ts";
import type { RobotPageScene } from "../lib/robots/robotPageScene.ts";
import "../styles/robot-showcase.css";

type Status = "loading" | "ready" | "unavailable";

/* Must match the single-column breakpoint in home.css. */
const COMPACT = "(max-width: 959px)";

// TEST-HOOK: browser tests read the robots' state through window.__robotPage.
type TestWindow = { __robotPage?: RobotPageScene["testHook"] & { ready: true } };

function hasWebGl() {
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        // Give the probe context back, since browsers allow only a few at once.
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        return Boolean(gl);
    } catch {
        return false;
    }
}

type RobotShowcaseProps = {
    /* Its logo is what the arm takes on wide screens. */
    heroRef: RefObject<HTMLElement | null>;
    /* Where InMoov stands at the end of the page. */
    finaleRef: RefObject<HTMLElement | null>;
};

/* The robots draw on a page-wide fixed canvas (see robotPageScene.ts): the arm settles into this box,
   then stands by each feature's [data-robot-perch], and InMoov waits in the finale's frame. */
export default function RobotShowcase({ heroRef, finaleRef }: RobotShowcaseProps) {
    const layerRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const hintRef = useRef<HTMLButtonElement>(null);
    const frameRef = useRef<HTMLElement>(null);
    const sceneRef = useRef<RobotPageScene | null>(null);
    const [webGl] = useState(hasWebGl);
    const [status, setStatus] = useState<Status>(webGl ? "loading" : "unavailable");

    useEffect(() => {
        const layer = layerRef.current;
        const glow = glowRef.current;
        const frame = frameRef.current;
        const hero = heroRef.current;
        if (!webGl || !layer || !glow || !frame || !hero) return;

        let cancelled = false;
        const compact = window.matchMedia(COMPACT);

        // Lazy so three.js stays off other pages. The hero models download alongside it.
        prefetchHeroAssets();
        import("../lib/robots/robotPageScene.ts")
            .then(({ createRobotPageScene }) =>
                // Build nothing if unmounted meanwhile (including StrictMode's first mount).
                cancelled ? null : createRobotPageScene(layer, {
                    hero,
                    heroLogo: hero.querySelector<HTMLElement>(".logo__mark"),
                    headerLogo: document.querySelector<HTMLElement>(".header__brand .logo__mark"),
                    header: document.querySelector<HTMLElement>(".header"),
                    frame,
                    perches: [...document.querySelectorAll<HTMLElement>("[data-robot-perch]")],
                    finale: finaleRef.current,
                    glow,
                    hint: hintRef.current,
                }, {
                    compact: () => compact.matches,
                }),
            )
            .then((scene) => {
                if (!scene) return;
                if (cancelled) {
                    scene.dispose();
                    return;
                }
                sceneRef.current = scene;
                if (import.meta.env.DEV) (window as TestWindow).__robotPage = { ...scene.testHook, ready: true }; // TEST-HOOK
                setStatus("ready");
            })
            .catch((error: unknown) => {
                console.error("Failed to load the 3D robots", error);
                if (!cancelled) setStatus("unavailable");
            });

        return () => {
            cancelled = true;
            if (import.meta.env.DEV) delete (window as TestWindow).__robotPage; // TEST-HOOK
            sceneRef.current?.dispose();
            sceneRef.current = null;
        };
    }, [webGl, heroRef, finaleRef]);

    return (
        <section className="robot-showcase" aria-label="Robots running Lucy">
            <figure
                ref={frameRef}
                className="robot-showcase__frame chamfer"
                // Hidden until the arm lands, except to show the unavailable message.
                data-live={status !== "unavailable" ? "" : undefined}
            >
                {status !== "ready" && (
                    <p className="robot-showcase__status" role="status">
                        {status === "loading" ? "Loading 3D view..." : "3D view unavailable"}
                    </p>
                )}

                <figcaption className="robot-showcase__caption">
                    SO-101 <span className="robot-showcase__caption-sep">//</span> LeRobot
                </figcaption>

                {status === "ready" && (
                    <p className="robot-showcase__hint" aria-hidden="true">
                        Click!
                    </p>
                )}
            </figure>

            {/* Portaled out of the sticky column's stacking context, so the robots draw over the page. */}
            {createPortal(
                <>
                    <div ref={glowRef} className="robot-glow" aria-hidden="true" />
                    <div ref={layerRef} className="robot-layer" aria-hidden="true" />
                    <button
                        ref={hintRef}
                        type="button"
                        className="robot-click-hint"
                        tabIndex={-1}
                        aria-hidden="true"
                        onClick={() => sceneRef.current?.activate("so101")}
                    >
                        Click me!
                        <HiOutlineChevronDown />
                    </button>
                </>,
                document.body,
            )}

            {/* Visually hidden: the same actions as clicking the robots, for keyboard and screen-reader users. */}
            {status === "ready" && (
                <div className="robot-actions">
                    <button type="button" onClick={() => sceneRef.current?.activate("so101")}>
                        Robot arm: take or put back the logo
                    </button>
                    <button type="button" onClick={() => sceneRef.current?.activate("inmoov")}>
                        InMoov: wave
                    </button>
                </div>
            )}
        </section>
    );
}
