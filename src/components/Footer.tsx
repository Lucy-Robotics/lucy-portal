import type { ReactNode } from "react";
import { EXTERNAL_LINKS } from "../constants/Links.ts";
import ExternalLinkIcon from "./ExternalLinkIcon.tsx";
import Logo from "./Logo.tsx";
import { DiscordIcon, GithubIcon, LinkedinIcon } from "./svg/index.ts";
import { useAuth } from "../hooks/useAuth.ts";
import { isAuthConfigured } from "../config/env.ts";

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
        title: "Lucy Robotics",
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
        icon: GithubIcon,
    },
    {
        label: "LinkedIn",
        href: EXTERNAL_LINKS.LINKEDIN,
        icon: LinkedinIcon,
    },
    {
        label: "Discord",
        href: EXTERNAL_LINKS.DISCORD,
        icon: DiscordIcon,
    },
];

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
                                <Logo />
                            </a>
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
                                        {link.external && <ExternalLinkIcon className="footer__external-icon" />}
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
                                        disabled={!isAuthConfigured || isLoading}
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
