import { FINALE_ENTRY, PERCH_OVERFLOW } from "../config.ts";
import { smoothstep } from "../math.ts";
import { toRect, viewHeight, viewWidth, type Rect } from "./screen.ts";

type Kind = "box" | "perch" | "finale";

type Station = { kind: Kind; rect: Rect; anchor: Rect; index: number };

type TrackPage = {
    frame: HTMLElement;
    perches: HTMLElement[];
    finale: HTMLElement | null;
    header: HTMLElement | null;
};

export type TrackFrame = {
    drawRect: Rect;
    clipRect: Rect | null;
    station: string;
    glided: boolean;
    boxed: boolean;
    onScreen: boolean;
    reveal: number;
    view: number;
    perch: number | null;
};

const centerY = (rect: Rect) => rect.top + rect.height / 2;

export function createTrack(page: TrackPage, compact: () => boolean, reduceMotion: boolean) {
    const stage = page.frame.closest(".home__stage");
    const spot = (perch: HTMLElement, box: Rect, headerBottom: number): Rect => {
        const { left, width } = perch.getBoundingClientRect();
        const top = stage?.getBoundingClientRect().top ?? headerBottom;
        return { left, width, height: box.height, top: headerBottom + box.top - top };
    };

    const stations = (headerBottom: number): Station[] => {
        const box = toRect(page.frame.getBoundingClientRect());
        const list: Station[] = [{ kind: "box", rect: box, anchor: box, index: 0 }];
        const perches = compact() ? [] : page.perches
            .map((perch, index) => ({ perch, index }))
            .filter(({ perch }) => perch.getBoundingClientRect().width > 0);
        if (perches.length) {
            const rect = spot(perches[0].perch, box, headerBottom);
            for (const { perch, index } of perches) {
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
                const grow = perched ? PERCH_OVERFLOW : 0;
                const { left, top, width, height } = rect;
                return top + height * (1 + grow) > headerBottom && top - height * grow < viewHeight()
                    && left + width * (1 + grow) > 0 && left - width * grow < viewWidth();
            };
            const glide = (range: { from: number; to: number }) => (reduceMotion ? (t < 0.5 ? 0 : 1) : smoothstep(t, range.from, range.to));
            const frameAt = (at: Station, overrides: Partial<TrackFrame> = {}): TrackFrame => {
                const framed = at.kind !== "perch";
                const frame = {
                    drawRect: at.rect,
                    clipRect: framed ? at.rect : null,
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

            if (a.kind === "box" && b.kind === "perch") {
                if (a.rect.top + a.rect.height > headerBottom) return frameAt(a);
                const below = Math.max(0, b.anchor.top - headerBottom);
                const rising = { ...b, rect: { ...b.rect, top: b.rect.top + below } };
                return frameAt(rising, { perch: b.anchor.top <= middle ? b.index : null });
            }
            if (a.kind === "perch" && b.kind === "finale") {
                const armOut = glide(FINALE_ENTRY.armOut);
                const inmoovIn = glide(FINALE_ENTRY.inmoovIn);
                const arm = armOut < 1;
                const frame = frameAt(arm ? a : b, { reveal: arm ? 1 - armOut : inmoovIn });
                frame.onScreen &&= arm || inmoovIn > 0;
                return frame;
            }
            if (a.kind === "perch" && b.kind === "perch") return frameAt(centred);

            const current = list.find((station) => keyOf(station) === shown);
            const stay = current && current !== centred && current.kind !== "perch" && visible(current.rect, false);
            return frameAt(stay ? current : centred, { glided: false });
        },
    };
}
