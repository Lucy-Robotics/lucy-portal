import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

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

export const centerX = (box: Box) => box.x + box.w / 2;
export const centerY = (box: Box) => box.y + box.h / 2;

/* A block as a button: hovering or focusing it shows it (the caption), clicking or Enter/Space chooses it.
   A mouse press doesn't focus it: that focus would light up as keyboard focus at the next key, even a lone
   Cmd/Super (Safari, Firefox). Tab still focuses it. */
export const selectable = (show: () => void, choose: () => void) => ({
    tabIndex: 0,
    role: "button",
    onMouseDown: (event: MouseEvent) => event.preventDefault(),
    onMouseEnter: show,
    onFocus: show,
    onClick: choose,
    onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        choose();
    },
});

export const classes = (...names: (string | false)[]) => names.filter(Boolean).join(" ");

/* When it draws or slides in once the diagram is revealed (home.css). */
export const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export type CaptionText = { title: string; description: string };
