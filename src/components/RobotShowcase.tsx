import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FaChevronDown, FaChevronLeft, FaChevronRight } from "react-icons/fa";

import { prefetchHeroAssets } from "../lib/robots/robotAssets.ts";
import type { RobotName, RobotPageScene } from "../lib/robots/robotPageScene.ts";
import "../styles/robot-showcase.css";

type Status = "loading" | "ready" | "unavailable";

const ROBOTS: { id: RobotName; name: string; family: string }[] = [
    { id: "so101", name: "SO-101", family: "LeRobot" },
    { id: "inmoov", name: "InMoov", family: "Humanoid" },
];

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
};

/*
 * The robots draw on a canvas fixed over the whole page (see robotPageScene.ts)
 * and settle into this box as it scrolls into view. The hidden buttons give
 * keyboard and screen-reader users the same actions as clicking the robots.
 */
export default function RobotShowcase({ heroRef }: RobotShowcaseProps) {
    const layerRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
    const hintRef = useRef<HTMLButtonElement>(null);
    const frameRef = useRef<HTMLElement>(null);
    const sceneRef = useRef<RobotPageScene | null>(null);
    const [webGl] = useState(hasWebGl);
    const [status, setStatus] = useState<Status>(webGl ? "loading" : "unavailable");
    const [active, setActive] = useState<RobotName>("so101");
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const layer = layerRef.current;
        const backdrop = backdropRef.current;
        const glow = glowRef.current;
        const frame = frameRef.current;
        const hero = heroRef.current;
        if (!webGl || !layer || !backdrop || !glow || !frame || !hero) return;

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
                    backdrop,
                    glow,
                    hint: hintRef.current,
                }, {
                    compact: () => compact.matches,
                    onActiveChange: (robot) => {
                        setActive(robot);
                        // On wide screens the scroll picks the robot and the arrows follow.
                        if (!compact.matches) setIndex(ROBOTS.findIndex(({ id }) => id === robot));
                    },
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
    }, [webGl, heroRef]);

    // On phones the arrows choose the robot, also after leaving a wide layout.
    useEffect(() => {
        const scene = sceneRef.current;
        if (!scene) return;
        const show = () => scene.setView(index / (ROBOTS.length - 1));
        show();
        const compact = window.matchMedia(COMPACT);
        compact.addEventListener("change", show);
        return () => compact.removeEventListener("change", show);
    }, [index, status]);

    const robot = ROBOTS.find(({ id }) => id === active) ?? ROBOTS[0];
    const isFirst = index === 0;
    const isLast = index === ROBOTS.length - 1;

    return (
        <section className="robot-showcase" aria-label="Robots running Lucy">
            <div className="robot-showcase__row">
                <button
                    type="button"
                    className="robot-showcase__arrow"
                    onClick={() => setIndex(index - 1)}
                    disabled={isFirst}
                    aria-label={isFirst ? "Previous robot" : `Previous robot: ${ROBOTS[index - 1].name}`}
                >
                    <FaChevronLeft aria-hidden="true" />
                </button>

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

                    <figcaption className="robot-showcase__caption" aria-live="polite">
                        {robot.name} <span className="robot-showcase__caption-sep">//</span> {robot.family}
                    </figcaption>

                    {status === "ready" && (
                        <p className="robot-showcase__hint" aria-hidden="true">
                            Click!
                        </p>
                    )}
                </figure>

                <button
                    type="button"
                    className="robot-showcase__arrow"
                    onClick={() => setIndex(index + 1)}
                    disabled={isLast}
                    aria-label={isLast ? "Next robot" : `Next robot: ${ROBOTS[index + 1].name}`}
                >
                    <FaChevronRight aria-hidden="true" />
                </button>
            </div>

            {/* Portaled out of the sticky column's stacking context, so the grid can sit
                behind the content and the robots above it. */}
            {createPortal(
                <>
                    <div ref={backdropRef} className="robot-backdrop" aria-hidden="true" />
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
                        <FaChevronDown />
                    </button>
                </>,
                document.body,
            )}

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
