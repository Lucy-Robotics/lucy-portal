import { FaGitAlt, FaLinux, FaPython, FaWindows } from "react-icons/fa";
import { FaDocker } from "react-icons/fa6";
import type { IconType } from "react-icons";

import { EXTERNAL_LINKS } from "../constants/Links.ts";
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
        icon: FaDocker,
        name: "Docker",
        href: EXTERNAL_LINKS.DOCKER,
    },
    {
        icon: FaGitAlt,
        name: "Git",
        href: EXTERNAL_LINKS.GIT,
    },
];

const Download = () => {
    return (
        <div className="download">
            <div className="download__content">
                <h1 className="download__title">Download</h1>

                <p className="download__subtext">
                    Get Lucy running on your machine. Everything runs inside
                    one Docker container.
                </p>

                <h2 className="download__section-title">Requirements</h2>

                <p className="download__section-subtext">
                    You only need three things on the host, everything else
                    lives in the container.
                </p>

                <div className="download__requirements">
                    {REQUIREMENTS.map(({ icon: Icon, name, href }) => (
                        <a
                            key={name}
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="download__requirement-card"
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
                    <article className="download__install-card">
                        <h3 className="download__install-card-title">
                            <FaLinux aria-hidden="true" />
                            Linux &amp; macOS
                        </h3>

                        <div className="download__install-card-body">
                            <p className="download__install-text">
                                Clone with Git, then run the manager from the
                                repository root.
                            </p>

                            <div className="download__terminal">
                                <pre className="download__terminal-body">
                                    <code>
                                        <span className="download__terminal-line">
                                            <span className="download__terminal-prompt">
                                                ${" "}
                                            </span>
                                            git clone
                                            https://github.com/Sentience-Robotics/lucy_ws.git
                                        </span>
                                        <span className="download__terminal-line">
                                            <span className="download__terminal-prompt">
                                                ${" "}
                                            </span>
                                            cd lucy_ws
                                        </span>
                                        <span className="download__terminal-line">
                                            <span className="download__terminal-prompt">
                                                ${" "}
                                            </span>
                                            python3 Lucy.py
                                        </span>
                                    </code>
                                </pre>
                            </div>

                            <p className="download__install-text">
                                In the launcher, enable Core + Control Panel,
                                then open the Control Panel at{" "}
                                <a
                                    href="http://localhost:5000"
                                    className="download__highlight"
                                >
                                    http://localhost:5000
                                </a>{" "}
                                (or :5001 if 5000 is taken, common on macOS due
                                to AirPlay).
                            </p>
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

                    <article className="download__install-card">
                        <h3 className="download__install-card-title">
                            <FaWindows aria-hidden="true" />
                            Windows
                        </h3>

                        <div className="download__install-card-body">
                            <p className="download__install-text">
                                Use the installer. No manual setup required.
                            </p>

                            <p className="download__install-text">
                                Download Lucy-Setup.exe from GitHub Releases,
                                run it, then launch Lucy from the Start Menu
                                and enable Core + Control Panel.
                            </p>

                            <p className="download__install-text">
                                Native GUI apps (RViz, Gazebo, rqt) additionally
                                need a third-party X server. The browser control
                                panel does not.
                            </p>
                        </div>

                        <div className="download__install-card-footer">
                            <a
                                href={EXTERNAL_LINKS.GITHUB_RELEASES}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="header__button header__button--main download__install-button"
                            >
                                Download Lucy-Setup.exe
                                <ExternalIcon />
                            </a>
                        </div>
                    </article>
                </div>

                <p className="download__install-footer">
                    Prefer to read first? The full guide (launcher options, GUI
                    over VNC, developer mode and environment overrides) lives in
                    the{" "}
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
