/*
 * Where the robots are drawn once the arm has landed in its box. The page lays
 * out stations top to bottom: the box (the arm, sticky beside the chapters), a
 * perch per feature (the arm, frameless, beside the feature) and the finale
 * (InMoov, framed).
 *
 * From one station to the next the robot follows the scroll: once the sticky box
 * lets go, the arm stays put where the box was (the features' arm column lines up
 * with it, home.css) and the box scrolls away without it, unclipped. It stays
 * there from one feature to the next, then fades out as InMoov fades and rises
 * in, in the finale's frame (FINALE_ENTRY).
 * Between stations that have no glide (phones: the box,
 * then the finale) the robot scrolls with its station like the page around it,
 * and only moves on to the station centred on screen once its own has left the
 * screen; it then slides in there (`station` changes without `glided`, see view.ts).
 */
import { FINALE_ENTRY, PERCH_OVERFLOW } from "../config.ts";
import { smoothstep } from "../math.ts";
import { toRect, viewHeight, viewWidth, type Rect } from "./screen.ts";

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
    /* It got to `station` along the scroll, so it needn't slide in. */
    glided: boolean;
    /* The arm is all in its box (the box's infinity stays there when it isn't). */
    boxed: boolean;
    /* Some of the drawing is on screen, so there is something to draw. */
    onScreen: boolean;
    /* 0 -> 1 as the robot fades and rises in along the scroll (1 when it's simply there). */
    reveal: number;
    /* 0 frames the arm, 1 InMoov. */
    view: number;
    /* The feature the arm is perched by, if any. */
    perch: number | null;
};

const centerY = (rect: Rect) => rect.top + rect.height / 2;

export function createTrack(page: TrackPage, compact: () => boolean, reduceMotion: boolean) {
    /* Where the arm stands by the features: where the box is while it's sticky (its stage sticks right
       below the header, home.css), in the perches' column. */
    const stage = page.frame.closest(".home__stage");
    const spot = (perch: HTMLElement, box: Rect, headerBottom: number): Rect => {
        const { left, width } = perch.getBoundingClientRect();
        const top = stage?.getBoundingClientRect().top ?? headerBottom;
        return { left, width, height: box.height, top: headerBottom + box.top - top };
    };

    const stations = (headerBottom: number): Station[] => {
        const box = toRect(page.frame.getBoundingClientRect());
        const list: Station[] = [{ kind: "box", rect: box, anchor: box, index: 0 }];
        // Hidden perches (display: none) have no size.
        const perches = compact() ? [] : page.perches
            .map((perch, index) => ({ perch, index }))
            .filter(({ perch }) => perch.getBoundingClientRect().width > 0);
        if (perches.length) {
            const rect = spot(perches[0].perch, box, headerBottom);
            for (const { perch, index } of perches) {
                // The arm is by a feature while that feature (its screen) is centred.
                const feature = perch.closest("article") ?? perch;
                list.push({ kind: "perch", rect, anchor: toRect(feature.getBoundingClientRect()), index });
            }
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
            const headerBottom = page.header?.getBoundingClientRect().bottom ?? 0;
            const list = stations(headerBottom);
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

            const visible = (rect: Rect, perched: boolean) => {
                // A perched arm reaches a little past its spot.
                const grow = perched ? PERCH_OVERFLOW : 0;
                const { left, top, width, height } = rect;
                return top + height * (1 + grow) > headerBottom && top - height * grow < viewHeight()
                    && left + width * (1 + grow) > 0 && left - width * grow < viewWidth();
            };
            const glide = (range: { from: number; to: number }) => (reduceMotion ? (t < 0.5 ? 0 : 1) : smoothstep(t, range.from, range.to));
            /* The robot drawn at `at`'s station: a perched arm has the whole screen; framed, it's clipped to the frame. */
            const frameAt = (at: Station, overrides: Partial<TrackFrame> = {}): TrackFrame => {
                const framed = at.kind !== "perch";
                const frame = {
                    drawRect: at.rect,
                    clipRect: framed ? at.rect : null,
                    close: framed ? 1 : 0,
                    station: keyOf(at),
                    glided: true,
                    boxed: at.kind === "box",
                    onScreen: visible(at.rect, !framed),
                    reveal: 1,
                    view: at.kind === "finale" ? 1 : 0,
                    perch: framed ? null : at.index,
                    ...overrides,
                };
                shown = frame.station;
                return frame;
            };

            // Out of the box to the features: once the box lets go (scrolls up from its spot), the arm stays
            // put, unclipped, as the box scrolls away.
            if (a.kind === "box" && b.kind === "perch") {
                const boxed = a.rect.top >= b.rect.top - 0.5;
                return frameAt(boxed ? a : b, { station: keyOf(t < 0.5 ? a : b), perch: t < 0.5 ? null : b.index });
            }
            // From the features to the finale: the arm fades out at its spot, then InMoov fades and rises in, in his frame.
            if (a.kind === "perch" && b.kind === "finale") {
                const armOut = glide(FINALE_ENTRY.armOut);
                const inmoovIn = glide(FINALE_ENTRY.inmoovIn);
                const arm = armOut < 1;
                const frame = frameAt(arm ? a : b, { reveal: arm ? 1 - armOut : inmoovIn });
                frame.onScreen &&= arm || inmoovIn > 0;
                return frame;
            }
            // From one feature to the next, the arm stays put and takes up the next one halfway.
            if (a.kind === "perch" && b.kind === "perch") return frameAt(centred);

            // Stay with the station until it's gone from the screen, so the robot never jumps in sight.
            // Not the arm's spot by the features: it's fixed on screen, so it never goes.
            const current = list.find((station) => keyOf(station) === shown);
            const stay = current && current !== centred && current.kind !== "perch" && visible(current.rect, false);
            return frameAt(stay ? current : centred, { glided: false });
        },
    };
}
