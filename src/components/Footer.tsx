import type { ReactNode } from "react";
import { EXTERNAL_LINKS } from "../constants/Links.ts";
import { FaGithub, FaLinkedin, FaDiscord } from "react-icons/fa";
import { useAuth } from "../providers/AuthProvider.tsx";

type FooterProps = {
    children?: ReactNode;
};

type FooterLink = {
    text: string;
    href: string;
    external?: boolean;
};

const columns: { title: string; links: FooterLink[] }[] = [
    {
        title: "Project",
        links: [
            { text: "Download", href: "/download" },
            { text: "Roadmap", href: "/roadmap" },
            { text: "Blog", href: "/blog" },
            {
                text: "Live Demo",
                href: EXTERNAL_LINKS.LIVE_DEMO,
                external: true,
            },
        ],
    },
    {
        title: "Resources",
        links: [
            {
                text: "Documentation",
                href: EXTERNAL_LINKS.DOCUMENTATION,
                external: true,
            },
            {
                text: "GitHub",
                href: EXTERNAL_LINKS.GITHUB,
                external: true,
            },
            {
                text: "Releases",
                href: EXTERNAL_LINKS.GITHUB_RELEASES,
                external: true,
            },
            {
                text: "Accessibility",
                href: "/accessibility",
            },
            {
                text: "Mentions légales",
                href: "/legal",
            },
        ],
    },
    {
        title: "Sentience Robotics",
        links: [
            {
                text: "LinkedIn",
                href: EXTERNAL_LINKS.LINKEDIN,
                external: true,
            },
            {
                text: "Contact",
                href: "mailto:contact@example.com",
            },
            {
                text: "GitHub org",
                href: EXTERNAL_LINKS.GITHUB_ORG,
                external: true,
            },
        ],
    },
];

const socials = [
    {
        label: "GitHub",
        href: EXTERNAL_LINKS.GITHUB,
        icon: FaGithub,
    },
    {
        label: "LinkedIn",
        href: EXTERNAL_LINKS.LINKEDIN,
        icon: FaLinkedin,
    },
    {
        label: "Discord",
        href: EXTERNAL_LINKS.DISCORD,
        icon: FaDiscord,
    },
];

function ExternalIcon() {
    return (
        <svg
            className="footer__external-icon"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
        >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
    );
}

export default function Footer({ children }: FooterProps) {
    const year = new Date().getFullYear();
    const { isAuthenticated, isLoading, displayName, login, logout } = useAuth();

    return (
        <footer className="footer">
            {children ?? (
                <>
                    <div className="footer__grid">
                        <div className="footer__brand">
                            <a href="/" className="footer__logo">
                                LUCY
                            </a>

                            <p className="footer__description">
                                An open-source humanoid robot by Lucy.org.
                                Built on InMoov &amp; ROS 2.
                            </p>
                        </div>

                        {columns.map((column) => (
                            <nav
                                key={column.title}
                                className="footer__column"
                                aria-label={column.title}
                            >
                                <h3>{column.title}</h3>

                                {column.links.map((link) => (
                                    <a
                                        key={link.text}
                                        href={link.href}
                                        target={
                                            link.external
                                                ? "_blank"
                                                : undefined
                                        }
                                        rel={
                                            link.external
                                                ? "noopener noreferrer"
                                                : undefined
                                        }
                                    >
                                        {link.text}
                                        {link.external && <ExternalIcon />}
                                    </a>
                                ))}
                            </nav>
                        ))}
                    </div>

                    <div className="footer__bottom">
                        <p>
                            © {year} Lucy Project. Code under GPLv3 · InMoov
                            3D models under CC BY-NC 4.0 (Gael Langevin).
                        </p>

                        <div className="footer__bottom-right">
                            <div className="footer__admin">
                                {isAuthenticated ? (
                                    <>
                                        {displayName ? (
                                            <span
                                                className="footer__admin-user"
                                                title={displayName}
                                            >
                                                {displayName}
                                            </span>
                                        ) : null}
                                        <button
                                            type="button"
                                            className="footer__admin-button"
                                            onClick={logout}
                                        >
                                            Sign out
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        type="button"
                                        className="footer__admin-button"
                                        onClick={login}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? "Loading..." : "Admin sign in"}
                                    </button>
                                )}
                            </div>

                            <div className="footer__socials">
                                {socials.map((social) => {
                                    const Icon = social.icon;

                                    return (
                                        <a
                                            key={social.label}
                                            href={social.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={social.label}
                                            title={social.label}
                                        >
                                            <Icon />
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </footer>
    );
}