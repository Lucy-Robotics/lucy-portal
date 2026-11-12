import { useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import {
    HiOutlineAdjustmentsHorizontal,
    HiOutlineChevronDown,
    HiOutlineCodeBracket,
    HiOutlineCodeBracketSquare,
    HiOutlineCog6Tooth,
    HiOutlineComputerDesktop,
    HiOutlineCpuChip,
    HiOutlineCube,
    HiOutlineFilm,
    HiOutlineUsers,
} from "react-icons/hi2";

import { EXTERNAL_LINKS } from "../constants/Links.ts";
import { useScrollReveal } from "../hooks/useScrollReveal.ts";
import ExternalLinkIcon from "../components/ExternalLinkIcon.tsx";
import Logo from "../components/Logo.tsx";
import LucyDiagram from "../components/LucyDiagram.tsx";
import RobotShowcase from "../components/RobotShowcase.tsx";
import { DiscordIcon } from "../components/svg/index.ts";
import { illustrationFor } from "../lib/featureIllustrations.ts";
import "../styles/home.css";

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

const FEATURES: { slug: string; icon: Icon; title: string; description: string }[] = [
    {
        slug: "drive",
        icon: HiOutlineAdjustmentsHorizontal,
        title: "Drive it your way",
        description:
            "Precise sliders for every joint, or your own hand: MediaPipe reads it through the webcam and maps each finger to the robot. In Gazebo or on real hardware.",
    },
    {
        slug: "live-view",
        icon: HiOutlineCube,
        title: "See it live",
        description:
            "An in-browser 3D twin mirrors the robot in real time, next to its camera feed with FPS and latency metrics.",
    },
    {
        slug: "poses",
        icon: HiOutlineFilm,
        title: "Save poses, play animations",
        description:
            "Save, name, load and delete robot poses, then sequence them into animations.",
    },
    {
        slug: "hardware-config",
        icon: HiOutlineCog6Tooth,
        title: "Configure your hardware",
        description:
            "Edit boards, sensors and per-actuator offsets, inversions and limits in our custom editor, then flash it directly into the simulation or the robot.",
    },
    {
        slug: "multi-client",
        icon: HiOutlineUsers,
        title: "Share the view, keep one driver",
        description:
            "Connect from multiple browsers simultaneously. Share live telemetry and visualizations while maintaining exclusive control for a single operator.",
    },
    {
        slug: "open-portable",
        icon: HiOutlineCodeBracket,
        title: "Extend it anywhere",
        description:
            "Lucy handles the hardware abstraction: web interfaces, scripts and custom clients plug in through documented ROS 2 topics, services and actions. One Pixi environment runs it on laptops and edge devices alike.",
    },
];

/* Features shown with a live component instead of a picture. */
const LIVE_MEDIA: Partial<Record<string, ComponentType>> = {
    "open-portable": LucyDiagram,
};

const POINTS: { icon: Icon; title: string; text: string }[] = [
    { icon: HiOutlineCodeBracketSquare, title: "Open source", text: "GPLv3, built in the open." },
    { icon: HiOutlineCpuChip, title: "Simulation & real hardware", text: "Same code in Gazebo or on the robot." },
    { icon: HiOutlineComputerDesktop, title: "Multiplatform", text: "Runs on Linux, macOS and Windows." },
];

const STEPS = [
    { title: "Clone the workspace", command: "git clone https://github.com/Lucy-Robotics/lucy_ws.git" },
    { title: "Step inside", command: "cd lucy_ws" },
    { title: "Launch Lucy", command: "python3 Lucy.py" },
];

const STACK = ["ROS 2", "Gazebo", "RViz", "Pixi", "Python"];

const Home = () => {
    const heroRef = useRef<HTMLDivElement>(null);
    const introRef = useRef<HTMLElement>(null);
    const homeRef = useRef<HTMLDivElement>(null);
    const finaleRef = useRef<HTMLElement>(null);
    const [isAtTop, setIsAtTop] = useState(true);

    useScrollReveal(homeRef);

    useEffect(() => {
        const onScroll = () => setIsAtTop(window.scrollY < 40);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // The outro and the footer fill the last screen together (home.css), so the outro needs the footer's height.
    useEffect(() => {
        const home = homeRef.current;
        const footer = document.querySelector<HTMLElement>(".footer");
        if (!home || !footer) return;
        const measure = () => {
            const margin = parseFloat(getComputedStyle(footer).marginTop) || 0;
            home.style.setProperty("--footer-height", `${footer.offsetHeight + margin}px`);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(footer);
        return () => observer.disconnect();
    }, []);

    const scrollToContent = () => {
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        introRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
    };

    return (
        <div ref={homeRef} className="home">
            <div className="home__layout">
                <div ref={heroRef} className="home__hero">
                    <h1 className="home__title">
                        <Logo />
                    </h1>

                    <p className="home__tagline">
                        <span className="home__tagline-accent"></span> One platform,{" "}
                        <span className="home__tagline-accent"></span> any robot.
                    </p>

                    <div className="home__actions">
                        <a
                            href={EXTERNAL_LINKS.LIVE_DEMO}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="chamfer header__button header__button--primary"
                        >
                            Live Demo
                            <ExternalLinkIcon />
                        </a>

                        <a
                            href="/download"
                            className="chamfer header__button header__button--main"
                        >
                            Download
                        </a>
                    </div>

                    <button
                        type="button"
                        className={`home__scroll-hint ${isAtTop ? "" : "home__scroll-hint--hidden"}`}
                        onClick={scrollToContent}
                        aria-label="Scroll to content"
                    >
                        <HiOutlineChevronDown aria-hidden="true" />
                    </button>
                </div>

                <aside className="home__stage">
                    <RobotShowcase heroRef={heroRef} finaleRef={finaleRef} />
                </aside>

                <div className="home__main">
                    <section
                        ref={introRef}
                        className="home__chapter home__intro"
                        aria-labelledby="home-about-title"
                    >
                        <p className="home__kicker" data-reveal>
                            01 <span className="home__kicker-sep">//</span> What is Lucy
                        </p>
                        <h2 id="home-about-title" className="home__chapter-title" data-reveal>
                            An open-source robotics framework, powered by{" "}
                            <span className="home__accent">ROS&nbsp;2</span>.
                        </h2>
                        <p className="home__description" data-reveal>
                            Lucy controls and simulates robots and integrates with
                            many tools, such as Gazebo simulation, RViz and a web control
                            panel. It is multiplatform and runs from a Python + Pixi
                            environment.
                        </p>

                        <ul className="home__points">
                            {POINTS.map(({ icon: PointIcon, title, text }) => (
                                <li key={title} className="home__point" data-reveal>
                                    <PointIcon className="home__point-icon" aria-hidden="true" />
                                    <div>
                                        <h3 className="home__point-title">{title}</h3>
                                        <p className="home__point-text">{text}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <a
                            href={EXTERNAL_LINKS.DISCORD}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="home__discord"
                            data-reveal
                        >
                            <DiscordIcon aria-hidden="true" />
                            Join our Discord
                        </a>

                        <div className="home__stack" data-reveal>
                            <p className="home__kicker">Built on</p>
                            <ul className="home__stack-list">
                                {STACK.map((name) => (
                                    <li key={name}>{name}</li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    <section
                        className="home__chapter home__quickstart"
                        aria-labelledby="home-quickstart-title"
                    >
                        <p className="home__kicker" data-reveal>
                            02 <span className="home__kicker-sep">//</span> Quickstart
                        </p>
                        <h2 id="home-quickstart-title" className="home__chapter-title" data-reveal>
                            Up and running in{" "}
                            <span className="home__accent">three commands</span>.
                        </h2>

                        <ol className="home__steps">
                            {STEPS.map(({ title, command }, i) => (
                                <li key={command} className="home__step" data-reveal>
                                    <span className="home__step-index" aria-hidden="true">{i + 1}</span>
                                    <div className="home__step-body">
                                        <h3 className="home__step-title">{title}</h3>
                                        {/* Focusable so keyboard users can scroll a long command. */}
                                        <pre className="home__step-command" tabIndex={0}>
                                            <code>
                                                <span className="home__terminal-prompt">$ </span>
                                                {command}
                                            </code>
                                        </pre>
                                    </div>
                                </li>
                            ))}
                        </ol>

                        <div data-reveal>
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
                        </div>
                    </section>
                </div>
            </div>

            <section
                className="home__features"
                aria-labelledby="home-features-title"
            >
                <header className="home__features-header">
                    <p className="home__kicker" data-reveal>
                        03 <span className="home__kicker-sep">//</span> Features
                    </p>
                    <h2 id="home-features-title" className="home__features-title" data-reveal>
                        Everything you need,{" "}
                        <span className="home__accent">already in Lucy</span>.
                    </h2>
                </header>

                {FEATURES.map(({ slug, icon: Icon, title, description }, i) => {
                    const Live = LIVE_MEDIA[slug];
                    const illustration = illustrationFor(slug);
                    return (
                        <article key={slug} className="home__feature" aria-labelledby={`home-feature-${slug}`}>
                            <div className="home__feature-body" data-reveal>
                                <span className="home__feature-index" aria-hidden="true">
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                                <h3 id={`home-feature-${slug}`} className="home__feature-title">
                                    <Icon className="home__feature-icon" aria-hidden="true" />
                                    {title}
                                </h3>
                                <p className="home__feature-text">{description}</p>
                            </div>

                            <div className={`home__feature-media${Live ? " home__feature-media--live" : ""}`} data-reveal>
                                {Live ? (
                                    <Live />
                                ) : illustration ? (
                                    <img src={illustration} alt="" loading="lazy" decoding="async" />
                                ) : (
                                    <div className="home__feature-placeholder">
                                        <Icon aria-hidden="true" />
                                        <span>Illustration coming soon</span>
                                    </div>
                                )}
                            </div>

                            {/* The column the arm stands in, beside the text, while this feature is on screen; it stays put
                                on screen from one feature to the next (robots/scene/track.ts). data-robot-gesture is what it acts out (robots/config.ts). */}
                            <div className="home__feature-perch" data-robot-perch data-robot-gesture={slug} aria-hidden="true" />
                        </article>
                    );
                })}
            </section>

            <section className="home__finale" aria-labelledby="home-finale-title">
                <div className="home__finale-body">
                    <p className="home__kicker" data-reveal>
                        <span className="home__kicker-sep">//</span> One last thing
                    </p>
                    <h2 id="home-finale-title" className="home__chapter-title" data-reveal>
                        Lucy isn&apos;t built for one robot. It&apos;s built for{" "}
                        <span className="home__accent">every robot</span>.
                    </h2>
                    <p className="home__description" data-reveal>
                        Arms, mobile bases, full humanoids: Lucy speaks to them all the same way.
                        Here&apos;s InMoov, the open-source 3D-printed humanoid by Gael Langevin,
                        running on Lucy. Go on, say hi.
                    </p>
                </div>

                {/* The robots' scene draws InMoov in here (robots/scene/track.ts). */}
                <figure ref={finaleRef} className="home__finale-frame chamfer" data-robot-finale>
                    <figcaption className="robot-showcase__caption">
                        InMoov <span className="robot-showcase__caption-sep">//</span> Humanoid
                    </figcaption>
                </figure>
            </section>

            <section className="home__outro" aria-labelledby="home-outro-title">
                <h2 id="home-outro-title" className="home__outro-title" data-reveal>
                    One platform. <span className="home__accent">Any robot.</span>
                </h2>
                <p className="home__outro-text" data-reveal>
                    Try the control panel in your browser, or install Lucy and drive your own robot.
                </p>
                <div className="home__actions home__outro-actions" data-reveal>
                    <a
                        href={EXTERNAL_LINKS.LIVE_DEMO}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="chamfer header__button header__button--primary"
                    >
                        Live Demo
                        <ExternalLinkIcon />
                    </a>

                    <a
                        href="/download"
                        className="chamfer header__button header__button--main"
                    >
                        Download
                    </a>
                </div>
            </section>
        </div>
    );
};

export default Home;
