import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

import { prefetchHeroAssets } from "../lib/robotAssets.ts";
import type { RobotName, RobotPageScene } from "../lib/robotPageScene.ts";
import "../styles/robot-showcase.css";

type Status = "loading" | "ready" | "unavailable";

const ROBOTS: { id: RobotName; name: string; family: string }[] = [
    { id: "so101", name: "SO-101", family: "LeRobot" },
    { id: "inmoov", name: "InMoov", family: "Humanoid" },
];

/* Matches the home layout's single-column breakpoint (home.css). */
const COMPACT = "(max-width: 959px)";

// TEST-HOOK: browser tests read the robots' state through window.__robotPage.
type TestWindow = { __robotPage?: RobotPageScene["testHook"] & { ready: true } };

function hasWebGl() {
    try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
        // Only a probe: give the context back (browsers allow few at once).
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        return Boolean(gl);
    } catch {
        return false;
    }
}

type RobotShowcaseProps = {
    /* The hero, whose logo the arm takes on wide screens. */
    heroRef: RefObject<HTMLElement | null>;
};

/*
 * The home page's robots. They're drawn on a canvas fixed over the whole
 * page (see robotPageScene.ts): in the hero the arm stands free on the
 * bottom edge of the screen, and as this box scrolls into view it settles
 * into it. On phones, arrows switch robot; on wide screens the scroll does.
 * The hidden buttons give keyboard and screen-reader users the same actions
 * as clicking the robots.
 */
export default function RobotShowcase({ heroRef }: RobotShowcaseProps) {
    const layerRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    const glowRef = useRef<HTMLDivElement>(null);
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

        // three.js and the models only load on the page that shows the robots;
        // the arm's and the logo's models download alongside three.js.
        prefetchHeroAssets();
        import("../lib/robotPageScene.ts")
            .then(({ createRobotPageScene }) =>
                // Unmounted meanwhile (or StrictMode's first mount): build nothing.
                cancelled ? null : createRobotPageScene(layer, {
                    hero,
                    heroLogo: hero.querySelector<HTMLElement>(".logo__mark"),
                    headerLogo: document.querySelector<HTMLElement>(".header__brand .logo__mark"),
                    header: document.querySelector<HTMLElement>(".header"),
                    frame,
                    backdrop,
                    glow,
                }, {
                    compact: () => compact.matches,
                    onActiveChange: (robot) => {
                        setActive(robot);
                        // Wide screens: the scroll picks the robot, the arrows follow.
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

    // Phones: the arrows choose the robot in the box, also after switching
    // from a wide layout (where the scroll chose it).
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
                    // Hidden until the arm lands in it (also while loading); shown
                    // as is only to say the 3D view is unavailable.
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

            {/* Fixed layers, out of the page's stacking contexts (the sticky
                column has one): the grid behind the content, the robots above. */}
            {createPortal(
                <>
                    <div ref={backdropRef} className="robot-backdrop" aria-hidden="true" />
                    <div ref={glowRef} className="robot-glow" aria-hidden="true" />
                    <div ref={layerRef} className="robot-layer" aria-hidden="true" />
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
