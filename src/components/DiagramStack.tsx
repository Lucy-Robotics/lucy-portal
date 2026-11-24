import { classes } from "../lib/diagram.ts";

type Chip = { text: string; on: boolean; ghost?: boolean };

/* Phones: a diagram's blocks as stacked groups of chips, joined by connectors (home.css, .diagram__stack). */
export default function DiagramStack<Id extends string>({ groups, chip, choose }: {
    groups: { label: string; ids: Id[] }[];
    chip: (id: Id) => Chip;
    choose: (id: Id) => void;
}) {
    return (
        <div className="diagram__stack">
            {groups.map((group, gi) => (
                <div key={group.label} className="diagram__group">
                    <span className="diagram__group-label">{group.label}</span>
                    <div className="diagram__chips">
                        {group.ids.map((id) => {
                            const { text, on, ghost } = chip(id);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    aria-pressed={on}
                                    className={classes("diagram__chip", on && "is-active", !!ghost && "is-ghost")}
                                    onClick={() => choose(id)}
                                >
                                    {text}
                                </button>
                            );
                        })}
                    </div>
                    {gi < groups.length - 1 && <span className="diagram__connector" aria-hidden="true" />}
                </div>
            ))}
        </div>
    );
}
