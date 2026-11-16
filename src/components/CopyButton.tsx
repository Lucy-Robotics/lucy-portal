import { useEffect, useRef, useState } from "react";
import { FaCheck, FaRegCopy } from "react-icons/fa";

const RESET_DELAY_MS = 2000;

type CopyState = "idle" | "copied" | "failed";

const STATUS_MESSAGES: Record<CopyState, string> = {
    idle: "",
    copied: "Copied to clipboard",
    failed: "Copy failed, select the text manually",
};

interface CopyButtonProps {
    text: string;
    label: string;
}

const CopyButton = ({ text, label }: CopyButtonProps) => {
    const [state, setState] = useState<CopyState>("idle");
    const timer = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setState("copied");
        } catch {
            setState("failed");
        }
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setState("idle"), RESET_DELAY_MS);
    };

    const copied = state === "copied";

    return (
        <>
            <button
                type="button"
                className="copy-button"
                onClick={copy}
                aria-label={`Copy ${label}`}
                title={copied ? "Copied" : "Copy"}
            >
                {copied ? (
                    <FaCheck aria-hidden="true" />
                ) : (
                    <FaRegCopy aria-hidden="true" />
                )}
            </button>
            <span className="sr-only" role="status" aria-live="polite">
                {STATUS_MESSAGES[state]}
            </span>
        </>
    );
};

export default CopyButton;
