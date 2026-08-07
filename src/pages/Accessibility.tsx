import { Link } from "react-router-dom";
import "../styles/accessibility.css";

type PageReport = {
  name: string;
  path: string;
  level: "Good" | "Partial" | "Limited";
  summary: string;
  done: string[];
  gaps: string[];
};

const pages: PageReport[] = [
  {
    name: "Home",
    path: "/",
    level: "Good",
    summary:
      "Marketing landing page with clear hierarchy, labeled sections, and decorative icons hidden from assistive tech.",
    done: [
      "Single primary heading for the brand and supporting copy hierarchy",
      "Sections labeled with aria-label (quickstart, feature grid)",
      "Decorative icons marked aria-hidden so screen readers hear text, not icon names",
      "Primary CTAs are real links/buttons, keyboard reachable",
      "External-link icons marked decorative",
      "Skip-to-content link available site-wide",
    ],
    gaps: [
      "Feature grid relies on visual layout; no live region announcements on load",
    ],
  },
  {
    name: "Download",
    path: "/download",
    level: "Good",
    summary:
      "Install instructions use a clear title, readable body text, and labeled platform/requirement links.",
    done: [
      "Page title as an h1",
      "Requirement and platform icons marked aria-hidden",
      "External documentation links open with visible text labels",
      "Install steps presented as readable prose, not icon-only controls",
      "Skip-to-content link available site-wide",
    ],
    gaps: [
      "Long instruction blocks could use more landmark headings for jump navigation",
      "Copy-to-clipboard style actions (if added later) would need live feedback",
    ],
  },
  {
    name: "Roadmap",
    path: "/roadmap",
    level: "Good",
    summary:
      "Timeline with named status, accessible dialogs, and keyboard reorder alternatives for admins.",
    done: [
      "Page header with title and short description",
      "Status shown as labeled markers (Shipped / Soon), not inert checkboxes",
      "Create/edit and delete dialogs use aria-modal, labelled titles, focus trap, Escape, and restore focus",
      "Admins can reorder with Move up / Move down buttons as well as drag-and-drop / keyboard DnD",
      "Drag handle is a dedicated control with an accessible name",
      "List exposed as a labeled roadmap region; errors use role=\"alert\"",
    ],
    gaps: [
      "Pointer drag remains available; some users may still prefer only the button controls",
    ],
  },
  {
    name: "Blog",
    path: "/blog",
    level: "Good",
    summary:
      "Post list with labeled search, linked titles, and an accessible admin editor dialog.",
    done: [
      "Search field has an aria-label",
      "Post titles are links to the full article",
      "List shows a short text snippet instead of dumping full HTML",
      "Rich-text toolbar uses role=\"toolbar\", button aria-labels, and aria-pressed states",
      "Create/edit and delete dialogs trap focus, support Escape, and restore focus",
      "Editor notes that body HTML is admin-authored content",
    ],
    gaps: [
      "Heading structure inside post bodies still depends on what admins write in TipTap",
    ],
  },
  {
    name: "Blog post detail",
    path: "/blog/:id",
    level: "Good",
    summary:
      "Full article view with a back link, title, meta, and rendered body content.",
    done: [
      "Back-to-blog link for easy return",
      "Post title as the main heading",
      "Author/date meta and tags presented as text",
      "Loading and not-found states communicate failure in text",
    ],
    gaps: [
      "Rendered HTML body depends on heading structure authored in the editor",
      "No reading-time or landmark aside for long posts yet",
    ],
  },
  {
    name: "404 Not found",
    path: "*",
    level: "Good",
    summary: "Clear error page with a path back home.",
    done: [
      "Meaningful h1 (“Page not found”)",
      "Decorative “404” code hidden from assistive tech",
      "Primary “Back to home” link",
    ],
    gaps: ["Could announce the error with a polite live region on entry"],
  },
  {
    name: "Accessibility report",
    path: "/accessibility",
    level: "Good",
    summary: "This page: structured headings, linked page names, and clear ratings.",
    done: [
      "Semantic sections with labelled headings",
      "Per-page cards with summaries and lists",
      "Links to the pages being reviewed",
    ],
    gaps: [],
  },
  {
    name: "Mentions légales",
    path: "/legal",
    level: "Good",
    summary: "French legal notices with clear headings and contact links.",
    done: [
      "Section headings for each legal topic",
      "Accessible links to email, CNIL, and the accessibility report",
    ],
    gaps: [],
  },
];

const siteWide = {
  done: [
    "Document language set to English (`lang=\"en\"`)",
    "Responsive viewport meta for mobile layouts",
    "Shared layout uses semantic `<header>`, `<main>`, and `<footer>`",
    "Skip-to-content link targets the main landmark",
    "Header navigation uses real links; Download / Live Demo are labeled buttons/links",
    "Footer column groups use aria-label; social icons have aria-label text",
    "Decorative SVG icons generally marked aria-hidden",
    "High-contrast accent (#00ff41) on dark backgrounds for key actions and borders",
    "Admin sign-in moved to the footer so casual visitors are not interrupted",
    "Route loading fallback announces with role=\"status\" / aria-live",
    "Shared accessible dialog pattern (focus trap, Escape, aria-modal, labelled title)",
  ],
  gaps: [
    "Focus outlines follow browser defaults in places; not yet a unified :focus-visible system everywhere",
    "Full WCAG 2.2 AA audit (automated + manual) has not been published yet",
  ],
};

const Accessibility = () => {
  return (
    <div className="a11y-page">
      <header className="a11y-page__header">
        <h1 className="a11y-page__title">Accessibility report</h1>
        <p className="a11y-page__subtitle">
          A quick status of how each public page on the Lucy portal supports
          keyboard use, screen readers, and readable structure — and what still
          needs work.
        </p>
        <p className="a11y-page__meta">
          Reviewed against common WCAG 2.2 practices (structure, names, contrast
          intent, keyboard). This is an internal engineering report, not a formal
          certification.
        </p>
      </header>

      <section className="a11y-section" aria-labelledby="a11y-sitewide">
        <h2 id="a11y-sitewide">Site-wide</h2>
        <div className="a11y-card">
          <p className="a11y-card__summary">
            Shared chrome (header, main content, footer) and document setup.
          </p>
          <div className="a11y-columns">
            <div>
              <h3>What was done</h3>
              <ul>
                {siteWide.done.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Known gaps</h3>
              <ul>
                {siteWide.gaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="a11y-section" aria-labelledby="a11y-pages">
        <h2 id="a11y-pages">Per page</h2>
        <div className="a11y-list">
          {pages.map((page) => (
            <article key={page.path} className="a11y-card">
              <div className="a11y-card__top">
                <div>
                  <h3 className="a11y-card__name">
                    <Link to={page.path === "*" ? "/" : page.path}>
                      {page.name}
                    </Link>
                  </h3>
                  <p className="a11y-card__path">{page.path}</p>
                </div>
                <span
                  className={`a11y-badge a11y-badge--${page.level.toLowerCase()}`}
                >
                  {page.level}
                </span>
              </div>
              <p className="a11y-card__summary">{page.summary}</p>
              <div className="a11y-columns">
                <div>
                  <h4>What was done</h4>
                  <ul>
                    {page.done.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4>Known gaps</h4>
                  {page.gaps.length > 0 ? (
                    <ul>
                      {page.gaps.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="a11y-card__summary">No major gaps noted.</p>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="a11y-section" aria-labelledby="a11y-legend">
        <h2 id="a11y-legend">Rating legend</h2>
        <ul className="a11y-legend">
          <li>
            <span className="a11y-badge a11y-badge--good">Good</span>
            Solid basics for structure, naming, and keyboard reachability.
          </li>
          <li>
            <span className="a11y-badge a11y-badge--partial">Partial</span>
            Usable, but interactive patterns (modals, DnD, editor) still need work.
          </li>
          <li>
            <span className="a11y-badge a11y-badge--limited">Limited</span>
            Major barriers remain (none currently rated this low).
          </li>
        </ul>
      </section>
    </div>
  );
};

export default Accessibility;
