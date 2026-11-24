import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";

export type Box = { x: number; y: number; w: number; h: number };

export const CUT = 10;

export const chamferPoints = ({ x, y, w, h }: Box, cut = CUT) =>
    [[x, y], [x + w - cut, y], [x + w, y + cut], [x + w, y + h], [x + cut, y + h], [x, y + h - cut]]
        .map((p) => p.join(","))
        .join(" ");

export const centerX = (box: Box) => box.x + box.w / 2;
export const centerY = (box: Box) => box.y + box.h / 2;

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

export const delay = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

export type CaptionText = { title: string; description: string };
