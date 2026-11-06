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

const REQUIREMENTS: {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    name: string;
    href: string;
}[] = [
    {
        icon: PythonIcon,
        name: "Python 3",
        href: EXTERNAL_LINKS.PYTHON,
    },
    {
        icon: HiOutlineCube,
        name: "Pixi",
        href: EXTERNAL_LINKS.PIXI,
    },
    {
        icon: GitIcon,
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
                            <LinuxIcon aria-hidden="true" />
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
                                className="chamfer header__button header__button--main download__install-button"
                            >
                                View the README
                                <ExternalLinkIcon />
                            </a>
                        </div>
                    </article>

                    <article className="chamfer download__install-card">
                        <h3 className="download__install-card-title">
                            <WindowsIcon aria-hidden="true" />
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
                                className="chamfer header__button header__button--main download__install-button"
                            >
                                Download Lucy.exe
                                <ExternalLinkIcon />
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
