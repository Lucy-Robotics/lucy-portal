import { useEffect, useRef, useState } from "react";

import "../styles/robot-stage.css";

type Status = "loading" | "ready" | "unavailable";

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

    useEffect(() => {
        const viewport = viewportRef.current;
        if (!viewport || !webGl) return;

        let cancelled = false;
        let dispose: (() => void) | undefined;

        // three.js and the model only load on pages that show the stage.
        import("../lib/so101Scene.ts")
            .then(({ createSo101Scene }) => createSo101Scene(viewport))
            .then((scene) => {
                if (cancelled) {
                    scene.dispose();
                    return;
                }
                dispose = scene.dispose;
                setStatus("ready");
            })
            .catch((error: unknown) => {
                console.error("Failed to load the 3D robot view", error);
                if (!cancelled) setStatus("unavailable");
            });

        return () => {
            cancelled = true;
            dispose?.();
        };
    }, [webGl]);

    return (
        <figure
            className={`robot-stage chamfer ${className ?? ""}`}
            aria-label="3D view of an SO-101 robot arm"
        >
            <div
                ref={viewportRef}
                className="robot-stage__viewport"
                {...(status === "ready" && {
                    role: "button",
                    tabIndex: 0,
                    "aria-label": "SO-101 robot arm. Activate to pick up the cube; again to put it back.",
                })}
            />

            {status !== "ready" && (
                <p className="robot-stage__status" role="status">
                    {status === "loading" ? "Loading 3D view..." : "3D view unavailable"}
                </p>
            )}

            <figcaption className="robot-stage__caption">
                SO-101 <span className="robot-stage__caption-sep">//</span> LeRobot
            </figcaption>

            {status === "ready" && (
                <p className="robot-stage__hint" aria-hidden="true">
                    Click the arm to move the cube
                </p>
            )}
        </figure>
    );
}
