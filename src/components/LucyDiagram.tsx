import { useState, type CSSProperties } from "react";

/*
 * Interactive architecture diagram of the Lucy stack: interfaces, the core, robots.
 * Colours are set in home.css (.diagram), so they follow the theme tokens. The edges draw in
 * once the feature's media is revealed (data-revealed, useScrollReveal).
 */

type NodeId =
    | "lcp" | "cli" | "huri" | "custom"
    | "core" | "packages" | "firmware" | "ws"
    | "inmoov" | "so101" | "more";

type Column = "interfaces" | "core" | "robots";

type DiagramNode = {
    id: Exclude<NodeId, "core">;
    column: Column;
    x: number;
    y: number;
    w: number;
    h: number;
    /* Dashed outline: an open slot, more to come. */
    ghost?: boolean;
};

const COLUMNS: Record<Column, string> = { interfaces: "Interfaces", core: "Lucy core", robots: "Robots" };

const NODE_TEXT: Record<NodeId, { title: string; description: string }> = {
    lcp: {
        title: "Lucy Control Panel",
        description: "The main interface: a web app to drive the robot, move each actuator and follow its telemetry in real time.",
    },
    cli: {
        title: "CLI",
        description: "A command-line interface shipped with Lucy, for scripting and quick control from a terminal.",
    },
    huri: {
        title: "HuRI · AI",
        description: "Our AI framework (speech-to-speech, multi-layer memory, gesture grounding) sends its intentions to the robot through Lucy.",
    },
    custom: {
        title: "+ Your interface",
        description: "Everything is open source: plug in your own interface, or build a new one on top of Lucy.",
    },
    core: {
        title: "Lucy core",
        description: "The heart of the stack. It runs all the ROS 2 logic (C++, Rust and Python) and exposes every robot to every interface the same way.",
    },
    packages: {
        title: "lucy_ros_packages",
        description: "Lucy's custom ROS 2 packages, built on ros2_control: the common layer between interfaces and hardware.",
    },
    firmware: {
        title: "lucy_embedded_firmware",
        description: "The firmware running on the robot's electronics, linking the ROS 2 stack to motors and sensors.",
    },
    ws: {
        title: "lucy_ws",
        description: "The workspace that pulls everything together, with Python scripts and installers: up and running in a few commands on macOS, Windows or Linux, without Docker (pixi + RoboStack).",
    },
    inmoov: {
        title: "InMoov",
        description: "The open-source 3D-printed humanoid created by Gaël Langevin, our main development platform.",
    },
    so101: {
        title: "SO-101 arm",
        description: "An open-source robotic arm, supported by Lucy today.",
    },
    more: {
        title: "+ Your robot",
        description: "Lucy is robot-agnostic: new robots join the stack as the community grows.",
    },
};

// Layout in SVG units: interfaces -> core -> robots, left to right.
const COL = {
    interfaces: { x: 10, w: 170 },
    core: { x: 250, w: 260 },
    robots: { x: 580, w: 170 },
};
const ROW_H = 46;
const rowY = (i: number) => 50 + i * 64;

const CORE = { x: COL.core.x, y: 50, w: COL.core.w, h: 300 };

const NODES: DiagramNode[] = [
    { id: "lcp", column: "interfaces", ...COL.interfaces, y: rowY(0), h: ROW_H },
    { id: "cli", column: "interfaces", ...COL.interfaces, y: rowY(1), h: ROW_H },
    { id: "huri", column: "interfaces", ...COL.interfaces, y: rowY(2), h: ROW_H },
    { id: "custom", column: "interfaces", ...COL.interfaces, y: rowY(3), h: ROW_H, ghost: true },

    { id: "packages", column: "core", x: CORE.x + 16, w: CORE.w - 32, y: 112, h: 38 },
    { id: "firmware", column: "core", x: CORE.x + 16, w: CORE.w - 32, y: 160, h: 38 },
    { id: "ws", column: "core", x: CORE.x + 16, w: CORE.w - 32, y: 226, h: 38 },

    { id: "inmoov", column: "robots", ...COL.robots, y: rowY(1) - 32, h: ROW_H },
    { id: "so101", column: "robots", ...COL.robots, y: rowY(2) - 32, h: ROW_H },
    { id: "more", column: "robots", ...COL.robots, y: rowY(3) - 32, h: ROW_H, ghost: true },
];

const inCore = (n: DiagramNode) => n.column === "core";
const GHOSTS = new Set<NodeId>(NODES.filter((n) => n.ghost).map((n) => n.id));
const CORE_PARTS = new Set<NodeId>(["core", ...NODES.filter(inCore).map((n) => n.id)]);

const GROUPS = (Object.keys(COLUMNS) as Column[]).map((column) => ({
    column,
    ids: [...(column === "core" ? ["core" as const] : []), ...NODES.filter((n) => n.column === column).map((n) => n.id)],
}));

const centerY = (n: DiagramNode) => n.y + n.h / 2;

// Every interface plugs into the core; the core drives every robot.
const EDGES = NODES.filter((n) => !inCore(n)).map((n) => {
    const y = centerY(n);
    return n.column === "interfaces"
        ? { node: n.id, ghost: n.ghost, d: `M ${n.x + n.w} ${y} L ${CORE.x} ${y}` }
        : { node: n.id, ghost: n.ghost, d: `M ${CORE.x + CORE.w} ${y} L ${n.x} ${y}` };
});

const CUT = 10;

const chamferPoints = ({ x, y, w, h }: { x: number; y: number; w: number; h: number }, cut = CUT) =>
    [[x, y], [x + w - cut, y], [x + w, y + cut], [x + w, y + h], [x + cut, y + h], [x, y + h - cut]]
        .map((p) => p.join(","))
        .join(" ");

const isCorePart = (id: NodeId) => CORE_PARTS.has(id);

const classes = (...names: (string | false)[]) => names.filter(Boolean).join(" ");
const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export default function LucyDiagram() {
    const [active, setActive] = useState<NodeId>("core");

    const select = (id: NodeId) => ({
        onMouseEnter: () => setActive(id),
        onFocus: () => setActive(id),
        onClick: () => setActive(id),
    });
    const edgeLit = (node: NodeId) => node === active || isCorePart(active);

    return (
        <figure className="diagram chamfer" aria-label="Architecture of the Lucy stack">
            {/* Wide screens: the SVG diagram. */}
            <svg viewBox="0 0 760 370" className="diagram__svg" role="presentation">
                {(Object.keys(COLUMNS) as Column[]).map((column) => (
                    <text key={column} x={COL[column].x} y={24} className="diagram__column">
                        {COLUMNS[column].toUpperCase()}
                    </text>
                ))}

                {EDGES.map((edge, i) => (
                    <path
                        key={edge.node}
                        d={edge.d}
                        // Ghost edges fade in rather than draw in, so their dashes keep real units.
                        pathLength={edge.ghost ? undefined : 1}
                        className={classes("diagram__edge", !!edge.ghost && "diagram__edge--ghost", edgeLit(edge.node) && "is-lit")}
                        style={delay(0.3 + i * 0.08)}
                    />
                ))}

                <g
                    className={classes("diagram__node", "diagram__node--core", active === "core" && "is-active", isCorePart(active) && "is-lit")}
                    tabIndex={0}
                    role="button"
                    aria-pressed={active === "core"}
                    aria-label={NODE_TEXT.core.title}
                    {...select("core")}
                >
                    <polygon points={chamferPoints(CORE, 14)} />
                    <text x={CORE.x + 16} y={CORE.y + 28} className="diagram__core-title">
                        {NODE_TEXT.core.title}
                    </text>
                    <text x={CORE.x + 16} y={CORE.y + 48} className="diagram__note">
                        ROS 2 · C++ · Rust · Python
                    </text>
                    <text x={CORE.x + 16} y={CORE.y + 256} className="diagram__note">
                        pixi + RoboStack · no Docker
                    </text>
                    <text x={CORE.x + 16} y={CORE.y + 276} className="diagram__note">
                        macOS · Windows · Linux
                    </text>
                </g>

                {NODES.map((node, i) => (
                    <g
                        key={node.id}
                        className={classes(
                            "diagram__node",
                            "diagram__node--enter",
                            !!node.ghost && "is-ghost",
                            inCore(node) && "is-inner",
                            node.id === active && "is-active",
                        )}
                        style={delay(i * 0.06)}
                        tabIndex={0}
                        role="button"
                        aria-pressed={node.id === active}
                        aria-label={NODE_TEXT[node.id].title}
                        {...select(node.id)}
                    >
                        <polygon points={chamferPoints(node, inCore(node) ? 7 : CUT)} />
                        <text x={node.x + node.w / 2} y={centerY(node)} textAnchor="middle" dominantBaseline="central">
                            {NODE_TEXT[node.id].title}
                        </text>
                    </g>
                ))}
            </svg>

            {/* Phones: the same nodes as a stacked list. */}
            <div className="diagram__stack">
                {GROUPS.map((group, gi) => (
                    <div key={group.column} className="diagram__group">
                        <span className="diagram__group-label">{COLUMNS[group.column]}</span>
                        <div className="diagram__chips">
                            {group.ids.map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={active === id}
                                    className={classes("diagram__chip", active === id && "is-active", GHOSTS.has(id) && "is-ghost")}
                                    onClick={() => setActive(id)}
                                >
                                    {NODE_TEXT[id].title}
                                </button>
                            ))}
                        </div>
                        {gi < GROUPS.length - 1 && <span className="diagram__connector" aria-hidden="true" />}
                    </div>
                ))}
            </div>

            <figcaption className="diagram__caption" aria-live="polite">
                {/* Re-mounted on change so the fade replays. */}
                <div key={active} className="diagram__caption-body">
                    <strong>{NODE_TEXT[active].title}</strong>
                    <p>{NODE_TEXT[active].description}</p>
                </div>
                <p className="diagram__hint">Hover or select a block to learn more.</p>
            </figcaption>
        </figure>
    );
}
