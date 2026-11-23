import type { CSSProperties } from "react";

/*
 * What the home page's live diagrams (components/LucyDiagram.tsx, MultiClientDiagram.tsx) share: the chamfered
 * blocks and the reveal delays. Their look is in home.css (.diagram), their caption in DiagramCaption.tsx.
 */

export type Box = { x: number; y: number; w: number; h: number };

export const CUT = 10;

/* A block's outline, its top-right and bottom-left corners cut like the site's chamfered boxes. */
export const chamferPoints = ({ x, y, w, h }: Box, cut = CUT) =>
    [[x, y], [x + w - cut, y], [x + w, y + cut], [x + w, y + h], [x + cut, y + h], [x, y + h - cut]]
        .map((p) => p.join(","))
        .join(" ");

export const classes = (...names: (string | false)[]) => names.filter(Boolean).join(" ");

/* When it draws or slides in once the diagram is revealed (home.css). */
export const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export type CaptionText = { title: string; description: string };
