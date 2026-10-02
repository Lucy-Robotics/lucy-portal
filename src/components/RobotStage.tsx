import { useEffect, useRef, useState } from "react";

import type { RobotName } from "../lib/robotStageScene.ts";
import "../styles/robot-stage.css";

type Status = "loading" | "ready" | "unavailable";

const ROBOTS: Record<RobotName, { name: string; family: string; action: string }> = {
    so101: {
        name: "SO-101",
        family: "LeRobot",
        action: "SO-101 robot arm. Activate to pick up the Lucy infinity; again to put it back.",
    },
    inmoov: {
        name: "InMoov",
        family: "Humanoid",
        action: "InMoov humanoid. Activate and it waves.",
    },
};

/* Page scroll -> stage view: the SO-101 near the top, InMoov by mid-page. */
function scrollToView() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    return (window.scrollY / scrollable - 0.1) / 0.5;
}

function hasWebGl() {
    try {
        const canvas = document.createElement("canvas");
        return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
        return false;
    }
}

type RobotStageProps = {
    className?: string;
};

export default function RobotStage({ className }: RobotStageProps) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [webGl] = useState(hasWebGl);
    const [status, setStatus] = useState<Status>(webGl ? "loading" : "unavailable");
    const [active, setActive] = useState<RobotName>("so101");

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport || !webGl) return;

        let cancelled = false;
        let cleanup: (() => void) | undefined;

        // three.js and the models only load on pages that show the stage.
        import("../lib/robotStageScene.ts")
            .then(({ createRobotStageScene }) =>
                createRobotStageScene(viewport, { onActiveChange: setActive }),
            )
            .then((scene) => {
                if (cancelled) {
                    scene.dispose();
                    return;
                }
                const onScroll = () => scene.setView(scrollToView());
                onScroll();
                window.addEventListener("scroll", onScroll, { passive: true });
                cleanup = () => {
                    window.removeEventListener("scroll", onScroll);
                    scene.dispose();
                };
                setStatus("ready");
            })
            .catch((error: unknown) => {
                console.error("Failed to load the 3D robot view", error);
                if (!cancelled) setStatus("unavailable");
            });

        return () => {
            cancelled = true;
            cleanup?.();
        };
    }, [webGl]);

    const robot = ROBOTS[active];

    return (
        <figure
            className={`robot-stage chamfer ${className ?? ""}`}
            aria-label="3D view of an SO-101 robot arm and an InMoov humanoid"
        >
            <div
                ref={viewportRef}
                className="robot-stage__viewport"
                {...(status === "ready" && {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": robot.action,
                })}
            />

            {status !== "ready" && (
                <p className="robot-stage__status" role="status">
                    {status === "loading" ? "Loading 3D view..." : "3D view unavailable"}
                </p>
            )}

            <figcaption className="robot-stage__caption">
                {robot.name} <span className="robot-stage__caption-sep">//</span> {robot.family}
            </figcaption>

            {status === "ready" && (
                <p className="robot-stage__hint" aria-hidden="true">
                    Click!
                </p>
            )}
        </figure>
    );
}
