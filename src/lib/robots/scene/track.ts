/*
 * Where the robots are drawn once the arm has landed in its box. The page lays
 * out stations top to bottom: the box (the arm, sticky beside the chapters), a
 * perch per feature (the arm, frameless, at the feature's picture) and the
 * finale (InMoov, framed). The robot scrolls with its station like the page
 * around it, and only moves on to the station centred on screen once its own
 * has left the screen; it then slides in there (`station` changes, see view.ts).
 * From one perch to the next, it instead slides across with the scroll, behind
 * the text between them (PERCH_SLIDE).
 */
import { PERCH_OVERFLOW, PERCH_SLIDE } from "../config.ts";
import { smoothstep } from "../math.ts";
import { lerpRect, toRect, viewHeight, viewWidth, type Rect } from "./screen.ts";

type Kind = "box" | "perch" | "finale";

/* `rect` is where the robot is drawn; `anchor` is what has to reach the middle of the screen for it to be there. */
type Station = { kind: Kind; rect: Rect; anchor: Rect; index: number };

type TrackPage = {
    frame: HTMLElement;
    perches: HTMLElement[];
    finale: HTMLElement | null;
    header: HTMLElement | null;
};

export type TrackFrame = {
    drawRect: Rect;
    /* Where the drawing is clipped to, or null for the whole screen (a perched arm). */
    clipRect: Rect | null;
    /* How far the clip has closed onto `clipRect` (0 the screen, 1 the frame), for its chamfer. */
    close: number;
    /* Which station it is ("perch:2"); a new one means the robot just arrived there. */
    station: string;
    /* Some of the station is on screen, so there is something to draw. */
    onScreen: boolean;
    /* 0 frames the arm, 1 InMoov. */
    view: number;
    /* The feature the arm is perched by, if any. */
    perch: number | null;
    /* At the finale, so InMoov should be there. */
    nearFinale: boolean;
};

const centerY = (rect: Rect) => rect.top + rect.height / 2;

export function createTrack(page: TrackPage, compact: () => boolean, reduceMotion: boolean) {
    const stations = (): Station[] => {
        const box = toRect(page.frame.getBoundingClientRect());
        const list: Station[] = [{ kind: "box", rect: box, anchor: box, index: 0 }];
        if (!compact()) {
            page.perches.forEach((perch, index) => {
                const rect = toRect(perch.getBoundingClientRect());
                // Hidden perches (display: none) have no size.
                if (rect.width === 0) return;
                // The arm is at its perch while the perch's feature (its screen) is centred.
                const feature = perch.closest("article") ?? perch;
                list.push({ kind: "perch", rect, anchor: toRect(feature.getBoundingClientRect()), index });
            });
        }
        if (page.finale) {
            const finale = toRect(page.finale.getBoundingClientRect());
            list.push({ kind: "finale", rect: finale, anchor: finale, index: 0 });
        }
        return list;
    };

    const keyOf = (station: Station) => `${station.kind}:${station.index}`;
    let shown: string | null = null;

    return {
        read(): TrackFrame {
            const list = stations();
            const headerBottom = page.header?.getBoundingClientRect().bottom ?? 0;
            // The sticky box sits centred in the screen below the header, so it's the first station there.
            const middle = headerBottom + (viewHeight() - headerBottom) / 2;

            let a = list[0];
            let b = list[0];
            for (let i = 0; i < list.length - 1; i++) {
                if (centerY(list[i + 1].anchor) > middle) {
                    a = list[i];
                    b = list[i + 1];
                    break;
                }
                a = b = list[i + 1];
            }
            const span = centerY(b.anchor) - centerY(a.anchor);
            const t = a === b || span <= 0 ? 0 : (middle - centerY(a.anchor)) / span;
            const centred = t < 0.5 ? a : b;

            const visible = (station: Station) => {
                // A perched arm reaches a little past its perch.
                const grow = station.kind === "perch" ? PERCH_OVERFLOW : 0;
                const { left, top, width, height } = station.rect;
                return top + height * (1 + grow) > headerBottom && top - height * grow < viewHeight()
                    && left + width * (1 + grow) > 0 && left - width * grow < viewWidth();
            };

            // Between two features, the arm slides from one's perch to the other's as the page scrolls.
            if (a.kind === "perch" && b.kind === "perch" && a !== b) {
                const slide = reduceMotion ? (t < 0.5 ? 0 : 1) : smoothstep(t, PERCH_SLIDE.from, PERCH_SLIDE.to);
                const at = slide < 0.5 ? a : b;
                const between: Station = { kind: "perch", rect: lerpRect(a.rect, b.rect, slide), anchor: at.anchor, index: at.index };
                shown = keyOf(at);
                return {
                    drawRect: between.rect,
                    clipRect: null,
                    close: 0,
                    station: shown,
                    onScreen: visible(between),
                    view: 0,
                    perch: at.index,
                    nearFinale: false,
                };
            }
            // Stay with the station until it's gone from the screen, so the robot never jumps in sight.
            const current = list.find((station) => keyOf(station) === shown);
            const at = current && current !== centred && visible(current) ? current : centred;
            shown = keyOf(at);

            const framed = at.kind !== "perch";
            return {
                drawRect: at.rect,
                // Perched, the arm has the whole screen; framed, it's clipped to the frame.
                clipRect: framed ? at.rect : null,
                close: framed ? 1 : 0,
                station: shown,
                onScreen: visible(at),
                view: at.kind === "finale" ? 1 : 0,
                perch: at.kind === "perch" ? at.index : null,
                nearFinale: at.kind === "finale",
            };
        },
    };
}
