import { EXTERNAL_LINKS } from "../constants/Links.ts";

// Click tracking for Umami

type Umami = { track: (event: string, data?: Record<string, string>) => void };

declare global {
    interface Window {
        umami?: Umami;
    }
}

const WINDOWS_INSTALLER = "https://github.com/Lucy-Robotics/Lucy-Windows-Installer/releases";

// First match wins, so more specific prefixes come before broader ones.
const TRACKED_LINKS: [prefix: string, event: string][] = [
    [EXTERNAL_LINKS.LIVE_DEMO, "Live demo"],
    [EXTERNAL_LINKS.DISCORD, "Discord"],
    [WINDOWS_INSTALLER, "Windows installer"],
    [EXTERNAL_LINKS.GITHUB_RELEASES, "GitHub releases"],
    [EXTERNAL_LINKS.GITHUB, "GitHub"],
    [EXTERNAL_LINKS.GITHUB_ORG, "GitHub org"],
    [EXTERNAL_LINKS.DOCUMENTATION, "Documentation"],
    [EXTERNAL_LINKS.LINKEDIN, "LinkedIn"],
    ["/download", "Download page"],
];

function eventFor(href: string): string | null {
    for (const [prefix, event] of TRACKED_LINKS) {
        if (href.startsWith(prefix)) return event;
    }
    return null;
}

export function initClickTracking() {
    document.addEventListener(
        "click",
        (e) => {
            const link = (e.target as Element | null)?.closest?.("a[href]");
            if (!link) return;

            const href = link.getAttribute("href") ?? "";
            const event = eventFor(href);
            if (!event) return;

            window.umami?.track(event, { from: window.location.pathname });
        },
        { capture: true },
    );
}
