import { useState, type KeyboardEvent } from "react";

import { chamferPoints, classes, CUT, delay, type Box, type CaptionText } from "../lib/diagram.ts";
import DiagramCaption from "./DiagramCaption.tsx";

/*
 * Two clients on one robot: the core's auth grants control to one of them, whose commands it passes on to the
 * robot; the other only watches. Clicking a client hands it the controls. Same look as LucyDiagram (home.css,
 * .diagram).
 */

type ClientId = "a" | "b";
type NodeId = ClientId | "core" | "auth" | "robot";

const CLIENT_TITLE: Record<ClientId, string> = { a: "Client A", b: "Client B" };

const TEXT: Record<"core" | "auth" | "robot", CaptionText> = {
    core: {
        title: "Lucy core",
        description: "Serves every connected browser at once, and passes the commands of the one in control on to the robot.",
    },
    auth: {
        title: "Auth",
        description: "Checks who is connected and grants control to a single client at a time. The others keep the full live view, read-only.",
    },
    robot: {
        title: "Robot",
        description: "In Gazebo or on real hardware: it only ever takes commands from the client in control.",
    },
};

const clientText = (id: ClientId, driving: boolean): CaptionText => ({
    title: `${CLIENT_TITLE[id]} · ${driving ? "in control" : "view only"}`,
    description: driving
        ? "Granted control by the core: its sliders, poses and animations drive the robot, while the other client watches live."
        : "Sees the robot live, 3D twin, camera and telemetry, with read-only controls. Click it to hand it the controls.",
});

// Every text the caption can show, for its height (DiagramCaption).
const CAPTIONS = [...Object.values(TEXT), clientText("a", true), clientText("a", false), clientText("b", true), clientText("b", false)];

// Layout in SVG units: clients -> core -> robot, left to right.
const CLIENTS: (Box & { id: ClientId })[] = [
    { id: "a", x: 10, y: 20, w: 200, h: 84 },
    { id: "b", x: 10, y: 156, w: 200, h: 84 },
];
const CORE: Box = { x: 290, y: 10, w: 210, h: 240 };
const AUTH: Box = { x: CORE.x + 20, y: 110, w: CORE.w - 40, h: 64 };
const ROBOT: Box = { x: 580, y: 88, w: 170, h: 84 };

const centerY = (box: Box) => box.y + box.h / 2;
const centerX = (box: Box) => box.x + box.w / 2;

export default function MultiClientDiagram() {
    const [driver, setDriver] = useState<ClientId>("a");
    const [active, setActive] = useState<NodeId>("auth");

    const isClient = (id: NodeId): id is ClientId => id === "a" || id === "b";
    const shown = isClient(active) ? clientText(active, active === driver) : TEXT[active];

    /* Hovering or focusing a block explains it; clicking a client also hands it the controls. */
    const choose = (id: NodeId) => {
        setActive(id);
        if (isClient(id)) setDriver(id);
    };
    const select = (id: NodeId) => ({
        tabIndex: 0,
        role: "button",
        onMouseEnter: () => setActive(id),
        onFocus: () => setActive(id),
        onClick: () => choose(id),
        onKeyDown: (event: KeyboardEvent) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            choose(id);
        },
    });

    const robotLink = `M ${CORE.x + CORE.w} ${centerY(ROBOT)} L ${ROBOT.x} ${centerY(ROBOT)}`;

    return (
        <figure className="diagram diagram--clients chamfer" aria-label="Two clients on one robot: the core grants control to one, the other only watches">
            {/* Wide screens: the SVG diagram. */}
            <svg viewBox="0 0 760 260" className="diagram__svg" role="presentation">
                {/* Lit from the client in control through the core to the robot. */}
                {CLIENTS.map((box, i) => (
                    <path
                        key={box.id}
                        d={`M ${box.x + box.w} ${centerY(box)} L ${CORE.x} ${centerY(box)}`}
                        pathLength={1}
                        className={classes("diagram__edge", box.id === driver && "is-lit")}
                        style={delay(0.3 + i * 0.1)}
                    />
                ))}
                <path d={robotLink} pathLength={1} className="diagram__edge is-lit" style={delay(0.5)} />

                <g
                    className={classes("diagram__node", "diagram__node--core", "is-lit", active === "core" && "is-active")}
                    aria-pressed={active === "core"}
                    aria-label={TEXT.core.title}
                    {...select("core")}
                >
                    <polygon points={chamferPoints(CORE, 14)} />
                    <text x={centerX(CORE)} y={CORE.y + 50} textAnchor="middle" dominantBaseline="central" className="diagram__core-title">
                        {TEXT.core.title}
                    </text>
                </g>

                <g
                    className={classes("diagram__node", "diagram__node--enter", "is-inner", active === "auth" && "is-active")}
                    style={delay(0.1)}
                    aria-pressed={active === "auth"}
                    aria-label={TEXT.auth.title}
                    {...select("auth")}
                >
                    <polygon points={chamferPoints(AUTH, 7)} />
                    <text x={centerX(AUTH)} y={centerY(AUTH)} textAnchor="middle" dominantBaseline="central">
                        {TEXT.auth.title}
                    </text>
                </g>

                {CLIENTS.map((box, i) => {
                    const driving = box.id === driver;
                    return (
                        <g
                            key={box.id}
                            className={classes("diagram__node", "diagram__node--enter", box.id === active && "is-active", driving && "is-driver")}
                            style={delay(i * 0.08)}
                            aria-pressed={driving}
                            aria-label={`${CLIENT_TITLE[box.id]}, ${driving ? "in control" : "view only: hand it the controls"}`}
                            {...select(box.id)}
                        >
                            <polygon points={chamferPoints(box, CUT)} />
                            <text x={centerX(box)} y={centerY(box) - 14} textAnchor="middle" dominantBaseline="central">
                                {CLIENT_TITLE[box.id]}
                            </text>
                            <text x={centerX(box)} y={centerY(box) + 16} textAnchor="middle" dominantBaseline="central" className={classes("diagram__role", driving && "is-driver")}>
                                {driving ? "in control" : "view only"}
                            </text>
                        </g>
                    );
                })}

                <g
                    className={classes("diagram__node", "diagram__node--enter", active === "robot" && "is-active")}
                    style={delay(0.3)}
                    aria-pressed={active === "robot"}
                    aria-label={TEXT.robot.title}
                    {...select("robot")}
                >
                    <polygon points={chamferPoints(ROBOT, CUT)} />
                    <text x={centerX(ROBOT)} y={centerY(ROBOT)} textAnchor="middle" dominantBaseline="central">
                        {TEXT.robot.title}
                    </text>
                </g>
            </svg>

            {/* Phones: the same blocks as stacked groups of chips; a client's chip hands it the controls. */}
            <div className="diagram__stack">
                <div className="diagram__group">
                    <span className="diagram__group-label">Clients</span>
                    <div className="diagram__chips">
                        {CLIENTS.map(({ id }) => (
                            <button
                                key={id}
                                type="button"
                                aria-pressed={id === driver}
                                className={classes("diagram__chip", id === driver && "is-active")}
                                onClick={() => choose(id)}
                            >
                                {CLIENT_TITLE[id]} · {id === driver ? "in control" : "view only"}
                            </button>
                        ))}
                    </div>
                    <span className="diagram__connector" aria-hidden="true" />
                </div>
                <div className="diagram__group">
                    <span className="diagram__group-label">Lucy core</span>
                    <div className="diagram__chips">
                        <button type="button" aria-pressed={active === "auth"} className={classes("diagram__chip", active === "auth" && "is-active")} onClick={() => choose("auth")}>
                            Auth
                        </button>
                    </div>
                    <span className="diagram__connector" aria-hidden="true" />
                </div>
                <div className="diagram__group">
                    <span className="diagram__group-label">Robot</span>
                    <div className="diagram__chips">
                        <button type="button" aria-pressed={active === "robot"} className={classes("diagram__chip", active === "robot" && "is-active")} onClick={() => choose("robot")}>
                            Robot
                        </button>
                    </div>
                </div>
            </div>

            <DiagramCaption texts={CAPTIONS} shown={shown} hint="Hover a block to learn more, click a client to hand it the controls." />
        </figure>
    );
}
