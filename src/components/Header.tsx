import { useEffect, useId, useState } from "react";
import { EXTERNAL_LINKS } from "../constants/Links.ts";
import Logo from "./Logo.tsx";

type HeaderProps = {
    sticky?: boolean;
};

const MOBILE_NAV_QUERY = "(max-width: 900px)";

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

function ExternalLink({
    href,
    children,
    className,
    onClick,
}: {
    href: string;
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            onClick={onClick}
        >
            {children}
            <ExternalIcon />
        </a>
    );
}

export default function Header({ sticky = true }: HeaderProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const mobileNavId = useId();

    useEffect(() => {
        if (!menuOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setMenuOpen(false);
            }
        };

        const onResize = () => {
            if (!window.matchMedia(MOBILE_NAV_QUERY).matches) {
                setMenuOpen(false);
            }
        };

        document.addEventListener("keydown", onKeyDown);
        window.addEventListener("resize", onResize);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("resize", onResize);
            document.body.style.overflow = previousOverflow;
        };
    }, [menuOpen]);

    const closeMenu = () => setMenuOpen(false);

    return (
        <header
            className={`header ${sticky ? "header--sticky" : ""} ${menuOpen ? "header--menu-open" : ""}`}
        >
            <div className="header__bar">
                <div className="header__left">
                    <a href="/" className="header__brand" onClick={closeMenu}>
                        <Logo />
                    </a>
                </div>

                <nav className="header__center" aria-label="Primary">
                    <a href="/blog">Blog</a>
                    <a href="/roadmap">Roadmap</a>

                    <ExternalLink href={EXTERNAL_LINKS.GITHUB}>
                        GitHub
                    </ExternalLink>

                    <ExternalLink href={EXTERNAL_LINKS.DOCUMENTATION}>
                        Documentation
                    </ExternalLink>
                </nav>

                <nav className="header__right" aria-label="Actions">
                    <a
                        href="/download"
                        className="header__button header__button--main"
                    >
                        Download
                    </a>

                    <ExternalLink
                        href={EXTERNAL_LINKS.LIVE_DEMO}
                        className="header__button header__button--primary"
                    >
                        Live Demo
                    </ExternalLink>
                </nav>

                <button
                    type="button"
                    className="header__menu-toggle"
                    aria-expanded={menuOpen}
                    aria-controls={mobileNavId}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <span className="header__menu-bars" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                    </span>
                    <span className="sr-only">
                        {menuOpen ? "Close menu" : "Open menu"}
                    </span>
                </button>
            </div>

            <nav
                id={mobileNavId}
                className="header__mobile-nav"
                aria-label="Mobile"
                hidden={!menuOpen}
            >
                <a href="/blog" onClick={closeMenu}>
                    Blog
                </a>
                <a href="/roadmap" onClick={closeMenu}>
                    Roadmap
                </a>
                <ExternalLink href={EXTERNAL_LINKS.GITHUB} onClick={closeMenu}>
                    GitHub
                </ExternalLink>
                <ExternalLink
                    href={EXTERNAL_LINKS.DOCUMENTATION}
                    onClick={closeMenu}
                >
                    Documentation
                </ExternalLink>
                <a
                    href="/download"
                    className="header__button header__button--main"
                    onClick={closeMenu}
                >
                    Download
                </a>
                <ExternalLink
                    href={EXTERNAL_LINKS.LIVE_DEMO}
                    className="header__button header__button--primary"
                    onClick={closeMenu}
                >
                    Live Demo
                </ExternalLink>
            </nav>
        </header>
    );
}
