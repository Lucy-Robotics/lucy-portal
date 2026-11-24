import type { CaptionText } from "../lib/diagram.ts";

/*
 * What the selected block is. Every text it can show is laid out, unseen, in the same cell, so the caption is
 * always as tall as the longest one: the diagram above never resizes as the selection changes.
 */
export default function DiagramCaption({ texts, shown, hint }: { texts: CaptionText[]; shown: CaptionText; hint: string }) {
    return (
        <figcaption className="diagram__caption" aria-live="polite">
            <div className="diagram__caption-slot">
                {texts.map(({ title, description }) => (
                    <div key={`${title}\n${description}`} className="diagram__caption-sizer" aria-hidden="true">
                        <strong>{title}</strong>
                        <p>{description}</p>
                    </div>
                ))}
                {/* Re-mounted on change so the fade replays. */}
                <div key={`${shown.title}\n${shown.description}`} className="diagram__caption-body">
                    <strong>{shown.title}</strong>
                    <p>{shown.description}</p>
                </div>
            </div>
            <p className="diagram__hint">{hint}</p>
        </figcaption>
    );
}
