import { useState } from "react";

import { centerX, centerY, chamferPoints, classes, CUT, delay, selectable, type Box, type CaptionText } from "../lib/diagram.ts";
import DiagramCaption from "./DiagramCaption.tsx";

/*
 * Two clients on one robot: the core's auth grants control to one of them, whose commands it passes on to the
 * robot; the other only watches. Clicking a client hands it the controls. Same look as LucyDiagram (home.css,
 * .diagram).
 */

type ClientId = "a" | "b";
type PartId = "auth" | "robot";
type NodeId = ClientId | PartId | "core";

const CLIENT_TITLE: Record<ClientId, string> = { a: "Client A", b: "Client B" };

const TEXT: Record<PartId | "core", CaptionText> = {
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

const role = (driving: boolean) => (driving ? "in control" : "view only");

const clientText = (id: ClientId, driving: boolean): CaptionText => ({
    title: `${CLIENT_TITLE[id]} · ${role(driving)}`,
    description: driving
        ? "Granted control by the core: its sliders, poses and animations drive the robot, while the other client watches live."
        : "Sees the robot live, 3D twin, camera and telemetry, with read-only controls. Click it to hand it the controls.",
});

// Layout in SVG units: clients -> core -> robot, left to right.
const CLIENTS: (Box & { id: ClientId })[] = [
    { id: "a", x: 10, y: 20, w: 200, h: 84 },
    { id: "b", x: 10, y: 156, w: 200, h: 84 },
];
const CORE: Box = { x: 290, y: 10, w: 210, h: 240 };
/* The blocks with a single title: the auth inside the core, and the robot. */
const PARTS: (Box & { id: PartId; inner?: boolean; at: number })[] = [
    { id: "auth", x: CORE.x + 20, y: 110, w: CORE.w - 40, h: 64, inner: true, at: 0.1 },
    { id: "robot", x: 580, y: 88, w: 170, h: 84, at: 0.3 },
];
const ROBOT = PARTS[1];

// Every text the caption can show, for its height (DiagramCaption).
const CAPTIONS = [...Object.values(TEXT), ...CLIENTS.flatMap(({ id }) => [clientText(id, true), clientText(id, false)])];

/* Phones: the same blocks as stacked groups of chips. */
const GROUPS: { label: string; ids: NodeId[] }[] = [
    { label: "Clients", ids: ["a", "b"] },
    { label: "Lucy core", ids: ["auth"] },
    { label: "Robot", ids: ["robot"] },
];

const isClient = (id: NodeId): id is ClientId => id === "a" || id === "b";

export default function MultiClientDiagram() {
    const [driver, setDriver] = useState<ClientId>("a");
    const [active, setActive] = useState<NodeId>("auth");

    const shown = isClient(active) ? clientText(active, active === driver) : TEXT[active];

    /* Hovering or focusing a block explains it; choosing a client also hands it the controls. */
    const choose = (id: NodeId) => {
        setActive(id);
        if (isClient(id)) setDriver(id);
    };
    const select = (id: NodeId) => selectable(() => setActive(id), () => choose(id));
    const chipText = (id: NodeId) => (isClient(id) ? `${CLIENT_TITLE[id]} · ${role(id === driver)}` : TEXT[id].title);

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

                {PARTS.map((part) => (
                    <g
                        key={part.id}
                        className={classes("diagram__node", "diagram__node--enter", !!part.inner && "is-inner", active === part.id && "is-active")}
                        style={delay(part.at)}
                        aria-pressed={active === part.id}
                        aria-label={TEXT[part.id].title}
                        {...select(part.id)}
                    >
                        <polygon points={chamferPoints(part, part.inner ? 7 : CUT)} />
                        <text x={centerX(part)} y={centerY(part)} textAnchor="middle" dominantBaseline="central">
                            {TEXT[part.id].title}
                        </text>
                    </g>
                ))}

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
                            <text x={centerX(box)} y={centerY(box) + 16} textAnchor="middle" dominantBaseline="central" className="diagram__note">
                                {role(driving)}
                            </text>
                        </g>
                    );
                })}
            </svg>

            {/* Phones: the same blocks as stacked groups of chips; a client's chip hands it the controls. */}
            <div className="diagram__stack">
                {GROUPS.map((group, gi) => (
                    <div key={group.label} className="diagram__group">
                        <span className="diagram__group-label">{group.label}</span>
                        <div className="diagram__chips">
                            {group.ids.map((id) => {
                                const on = isClient(id) ? id === driver : id === active;
                                return (
                                    <button key={id} type="button" aria-pressed={on} className={classes("diagram__chip", on && "is-active")} onClick={() => choose(id)}>
                                        {chipText(id)}
                                    </button>
                                );
                            })}
                        </div>
                        {gi < GROUPS.length - 1 && <span className="diagram__connector" aria-hidden="true" />}
                    </div>
                ))}
            </div>

            <DiagramCaption texts={CAPTIONS} shown={shown} hint="Hover a block to learn more, click a client to hand it the controls." />
        </figure>
    );
}
