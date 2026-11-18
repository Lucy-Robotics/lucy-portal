import {
    FaCube,
    FaGitAlt,
    FaLinux,
    FaPython,
    FaWindows,
} from "react-icons/fa";
import { SiTmux } from "react-icons/si";
import type { IconType } from "react-icons";

import CommandTerminal from "../components/CommandTerminal.tsx";
import { EXTERNAL_LINKS, INSTALLER_URL } from "../constants/Links.ts";
import "../styles/download.css";

function ExternalIcon() {
    return (
        <svg
            className="external-link-icon"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}

const REQUIREMENTS: {
    icon: IconType;
    name: string;
    href: string;
}[] = [
    {
        icon: FaPython,
        name: "Python 3",
        href: EXTERNAL_LINKS.PYTHON,
    },
    {
        icon: FaCube,
        name: "Pixi",
        href: EXTERNAL_LINKS.PIXI,
    },
    {
        icon: FaGitAlt,
        name: "Git",
        href: EXTERNAL_LINKS.GIT,
    },
    {
        icon: SiTmux,
        name: "tmux",
        href: EXTERNAL_LINKS.TMUX,
    },
];

const CURL_LINES = [
    `curl -fsSL "${INSTALLER_URL}" -o installer.py \\`,
    "  && python3 installer.py \\",
    "  && rm installer.py \\",
    "  && cd lucy_ws \\",
    "  && python3 Lucy.py",
];

const LINUX_LINES = [
    "git clone -b release/v0.3.0 https://github.com/Lucy-Robotics/lucy_ws.git",
    "cd lucy_ws",
    "python3 Lucy.py",
];

const Download = () => {
    return (
        <div className="download">
            <div className="download__content">
                <h1 className="page-title">
                    <span className="page-title__accent" aria-hidden="true">&gt;</span> Download
                </h1>

                <p className="download__subtext">
                    Get Lucy running on your machine with a Python + Pixi
                    setup.
                </p>

                <h2 className="download__section-title">Requirements</h2>

                <p className="download__section-subtext">
                    You only need Python, Pixi, Git and tmux on the host. The
                    project environment is managed with Pixi.
                </p>

                <div className="download__requirements">
                    {REQUIREMENTS.map(({ icon: Icon, name, href }) => (
                        <a
                            key={name}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chamfer download__requirement-card"
                        >
                            <Icon aria-hidden="true" />
                            <span className="download__requirement-name">
                                {name}
                            </span>
                        </a>
                    ))}
                </div>

                <h2 className="download__section-title">Install &amp; Launch</h2>

                <p className="download__section-subtext">
                    Clone the workspace, then let the Python manager build and
                    launch everything.
                </p>

                <div className="download__install-grid">
                    <article className="chamfer download__install-card">
                        <h3 className="download__install-card-title">
                            <FaLinux aria-hidden="true" />
                            Linux &amp; macOS
                        </h3>

                        <div className="download__install-card-body">
                            <p className="download__install-text">
                                Clone the repository, install the environment,
                                build it, and then launch Lucy.
                            </p>

                            <CommandTerminal
                                lines={LINUX_LINES}
                                label="Linux and macOS install commands"
                            />
                        </div>

                        <div className="download__install-card-footer">
                            <a
                                href={EXTERNAL_LINKS.GITHUB}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="header__button header__button--main download__install-button"
                            >
                                View the README
                                <ExternalIcon />
                            </a>
                        </div>
                    </article>

                    <article className="chamfer download__install-card">
                        <h3 className="download__install-card-title">
                            <FaWindows aria-hidden="true" />
                            Windows
                        </h3>

                        <div className="download__install-card-body">
                            <p className="download__install-text">
                                Download the latest Lucy.exe from the Lucy
                                Windows releases page and run it.
                            </p>
                        </div>

                        <div className="download__install-card-footer">
                            <a
                                href={EXTERNAL_LINKS.WINDOWS_RELEASES}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="header__button header__button--main download__install-button"
                            >
                                Download Lucy.exe
                                <ExternalIcon />
                            </a>
                        </div>
                    </article>
                </div>

                <div className="chamfer download__curl-panel">
                    <h3 className="download__curl-title">Or use the curl installer</h3>

                    <div className="download__terminal--wide">
                        <CommandTerminal
                            lines={CURL_LINES}
                            label="curl installer command"
                        />
                    </div>
                </div>

                <p className="download__install-footer">
                    Prefer to read first? The full guide lives in the{" "}
                    <a
                        href={EXTERNAL_LINKS.GITHUB}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="download__highlight"
                    >
                        lucy_ws README
                    </a>{" "}
                    and the{" "}
                    <a
                        href={EXTERNAL_LINKS.DOCUMENTATION}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="download__highlight"
                    >
                        documentation
                    </a>
                    .
                </p>
            </div>
        </div>
    );
};

export default Download;
