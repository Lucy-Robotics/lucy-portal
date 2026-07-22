import { EXTERNAL_LINKS } from "../constants/Links.ts";
import { useAuth } from "../providers/AuthProvider.tsx";

type HeaderProps = {
    sticky?: boolean;
};

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
                      }: {
    href: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
        >
            {children}
            <ExternalIcon />
        </a>
    );
}

export default function Header({
                                   sticky = true,
                               }: HeaderProps) {
    const { isAuthenticated, isLoading, displayName, login, logout } = useAuth();

    return (
        <header className={`header ${sticky ? "header--sticky" : ""}`}>
            <div className="header__left">
                <a href="/" className="header__brand">
                    LUCY
                </a>
            </div>

            <nav className="header__center">
                <a href="/blog">
                    Blog
                </a>

                <a href="/roadmap">
                    Roadmap
                </a>

                <ExternalLink href={EXTERNAL_LINKS.GITHUB}>
                    GitHub
                </ExternalLink>

                <ExternalLink href={EXTERNAL_LINKS.DOCUMENTATION}>
                    Documentation
                </ExternalLink>
            </nav>

            <nav className="header__right">
                {isAuthenticated ? (
                    <>
                        {displayName ? (
                            <span className="header__user" title={displayName}>
                                {displayName}
                            </span>
                        ) : null}

                        <button
                            type="button"
                            className="header__button header__button--secondary"
                            onClick={logout}
                        >
                            Sign out
                        </button>
                    </>
                ) : (
                    <button
                        type="button"
                        className="header__button header__button--secondary"
                        onClick={login}
                        disabled={isLoading}
                    >
                        {isLoading ? "Loading..." : "Sign in"}
                    </button>
                )}

                <a href="/download" className="header__button header__button--main">
                    Download
                </a>

                <ExternalLink
                    href={EXTERNAL_LINKS.LIVE_DEMO}
                    className="header__button header__button--primary"
                >
                    Live Demo
                </ExternalLink>
            </nav>
        </header>
    );
}