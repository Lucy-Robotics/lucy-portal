import { useEffect, useRef, useState } from "react";
import {
    FaChevronDown,
    FaCodeBranch,
    FaCogs,
    FaCube,
    FaDiscord,
    FaFilm,
    FaHandPaper,
    FaSlidersH,
    FaUsers,
    FaVideo,
} from "react-icons/fa";
import type { IconType } from "react-icons";

import { EXTERNAL_LINKS } from "../constants/Links.ts";
import Logo from "../components/Logo.tsx";
import RobotShowcase from "../components/RobotShowcase.tsx";
import "../styles/home.css";

const FEATURES: { icon: IconType; title: string; description: string }[] = [
    {
        icon: FaSlidersH,
        title: "Real-time joint control",
        description:
            "Precise sliders and inputs for every servo: drive the robot in Gazebo simulation or on real hardware.",
    },
    {
        icon: FaCube,
        title: "Live 3D viewer",
        description:
            "An in-browser Three.js model that mirrors the robot in real time.",
    },
    {
        icon: FaHandPaper,
        title: "Webcam hand tracking",
        description:
            "MediaPipe reads your hand through the webcam and maps each finger to the robot for live teleop.",
    },
    {
        icon: FaFilm,
        title: "Pose & animation manager",
        description:
            "Save, name, load and delete robot poses, then sequence them into animations.",
    },
    {
        icon: FaVideo,
        title: "Live camera streaming",
        description:
            "View the robot's camera feed inside the panel, with FPS and latency metrics.",
    },
    {
        icon: FaCogs,
        title: "Hardware configuration",
        description:
            "Edit boards, sensors and per-actuator offsets, inversions and limits in our custom editor, then flash it directly into the simulation or the robot.",
    },
    {
        icon: FaUsers,
        title: "Multi-client, one driver",
        description:
            "Connect from multiple browsers simultaneously. Share live telemetry and visualizations while maintaining exclusive control for a single operator.",
    },
    {
        icon: FaCube,
        title: "Runs anywhere with Pixi",
        description:
            "A single Pixi-managed environment bundles Lucy alongside ROS 2, Gazebo and RViz for smooth setup across laptops and edge devices.",
    },
    {
        icon: FaCodeBranch,
        title: "Open ROS 2 API",
        description:
            "Lucy handles the hardware abstraction! Web interfaces, scripts and custom clients plug in through documented ROS 2 topics, services and actions.",
    },
];

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

const Home = () => {
    const heroRef = useRef<HTMLDivElement>(null);
    const introRef = useRef<HTMLElement>(null);
    const [isAtTop, setIsAtTop] = useState(true);

    useEffect(() => {
        const onScroll = () => setIsAtTop(window.scrollY < 40);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const scrollToContent = () => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        introRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    };

    return (
        <div className="home">
            <div className="home__layout">
                <div ref={heroRef} className="home__hero">
                    <h1 className="home__title">
                        <Logo />
                    </h1>

                    <p className="home__tagline">
                        <span className="home__tagline-accent">&gt;</span> One platform{" "}
                        <span className="home__tagline-accent">//</span> Any robot.
                    </p>

                    <button
                        type="button"
                        className={`home__scroll-hint ${isAtTop ? "" : "home__scroll-hint--hidden"}`}
                        onClick={scrollToContent}
                        aria-label="Scroll to content"
                    >
                        <FaChevronDown aria-hidden="true" />
                    </button>
                </div>

                <aside className="home__stage">
                    <RobotShowcase heroRef={heroRef} />
                </aside>

                <div className="home__main">
                    <section
                        ref={introRef}
                        className="home__intro"
                        aria-label="About Lucy"
                    >
                        <p className="home__description">
                            Lucy is an open-source framework powered by ROS 2. It
                            controls and simulates robots and integrates with
                            many tools, such as Gazebo simulation, RViz and a web control
                            panel. Lucy is multiplatform and runs from a Python + Pixi
                            environment.
                        </p>

                        <div className="home__actions">
                            <a
                                href="/download"
                                className="header__button header__button--main home__button"
                            >
                                Download
                            </a>

                            <a
                                href={EXTERNAL_LINKS.LIVE_DEMO}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="header__button header__button--primary home__button"
                            >
                                Live Demo
                                <ExternalIcon />
                            </a>
                        </div>

                        <a
                            href={EXTERNAL_LINKS.DISCORD}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="home__discord"
                        >
                            <FaDiscord aria-hidden="true" />
                            Join our Discord
                        </a>
                    </section>

                    <section
                        className="home__quickstart"
                        aria-label="Lucy quickstart"
                    >
                        <div className="home__terminal">
                            <div className="home__terminal-header">
                                Lucy quickstart
                            </div>
                            <pre className="home__terminal-body">
                                <code>
                                    <span className="home__terminal-line">
                                        <span className="home__terminal-prompt">
                                            ${" "}
                                        </span>
                                        git clone
                                        https://github.com/Lucy-Robotics/lucy_ws.git
                                    </span>
                                    <span className="home__terminal-line">
                                        <span className="home__terminal-prompt">
                                            ${" "}
                                        </span>
                                        cd lucy_ws
                                    </span>
                                    <span className="home__terminal-line">
                                        <span className="home__terminal-prompt">
                                            ${" "}
                                        </span>
                                        python3 Lucy.py
                                    </span>
                                </code>
                            </pre>
                        </div>

                        <p className="home__quickstart-note">
                            Then enable{" "}
                            <span className="home__highlight">
                                Core + Control Panel
                            </span>{" "}
                            and open{" "}
                            <a
                                href="http://localhost:4004"
                                className="home__highlight"
                            >
                                http://localhost:4004
                            </a>
                            .
                        </p>
                        <p className="home__quickstart-note">
                            Only{" "}
                            <a href="https://git-scm.com/downloads" target="_blank" rel="noopener noreferrer" className="home__highlight">
                                Git
                            </a>
                            ,{" "}
                            <a href="https://www.python.org/downloads/" target="_blank" rel="noopener noreferrer" className="home__highlight">
                                Python
                            </a>
                            {" "}and{" "}
                            <a href="https://pixi.sh/latest/installation/" target="_blank" rel="noopener noreferrer" className="home__highlight">
                                Pixi
                            </a>{" "}
                            are required.
                        </p>

                        <hr className="home__separator" />
                    </section>

                    <section
                        className="home__features"
                        aria-label="Everything you need already in Lucy"
                    >
                        <h2 className="home__features-title">
                            Everything you need already in Lucy
                        </h2>

                        <div className="home__features-grid">
                            {FEATURES.map(({ icon: Icon, title, description }) => (
                                <article
                                    key={title}
                                    className="home__feature-card chamfer"
                                >
                                    <h3 className="home__feature-card-title">
                                        <Icon aria-hidden="true" />
                                        {title}
                                    </h3>
                                    <p className="home__feature-card-text">
                                        {description}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Home;
