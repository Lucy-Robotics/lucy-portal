import CopyButton from "./CopyButton.tsx";

interface CommandTerminalProps {
    lines: string[];
    label: string;
}

const isContinuation = (line: string) => line.startsWith(" ");

const CommandTerminal = ({ lines, label }: CommandTerminalProps) => (
    <div className="download__terminal">
        <CopyButton text={lines.join("\n")} label={label} />
        <pre
            className="download__terminal-body"
            tabIndex={0}
            role="region"
            aria-label={label}
        >
            <code>
                {lines.map((line) => (
                    <span key={line} className="download__terminal-line">
                        {!isContinuation(line) && (
                            <span className="download__terminal-prompt">
                                ${" "}
                            </span>
                        )}
                        {line}
                    </span>
                ))}
            </code>
        </pre>
    </div>
);

export default CommandTerminal;
