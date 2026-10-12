import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  ExternalLink,
  FileText,
  FolderOpen,
  Home,
  Mail,
  MessageSquareText,
  Phone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  UserRound,
  Wine,
  type LucideIcon,
} from "lucide-react";
import cellarImage from "@assets/kessick-room-demo.jpg";
import whiteLogo from "@assets/kessick-logo-white.svg";
import "./preview.css";

type Section =
  | "Home"
  | "Announcements"
  | "Design"
  | "Resources"
  | "Feedback"
  | "Account"
  | "Teamwork";
type Entry = { title: string; detail: string; section: Section; href?: string };
const sections: Section[] = [
  "Home",
  "Announcements",
  "Design",
  "Resources",
  "Feedback",
  "Account",
  "Teamwork",
];
const website = "https://kessickwinecellars.com";
const email = "sales@kessickwinecellars.com";
const teamworkLogin = "https://www.teamwork.com/login/";
const designRequest = `${website}/design-request/`;

function emailDraft(subject: string, body = "") {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const resources: Entry[] = [
  {
    title: "Renders",
    detail:
      "Explore public wine-cellar inspiration. Request project-specific renders from your representative.",
    section: "Resources",
    href: `${website}/inspiration-gallery/`,
  },
  {
    title: "Policies & Guides",
    detail:
      "Current dealer policies and account-specific guidance require authorized access.",
    section: "Resources",
  },
  {
    title: "Installation & Specification Sheets",
    detail:
      "Find public installation guidance and product documentation on Kessick’s resource hub.",
    section: "Resources",
    href: `${website}/resources/`,
  },
  {
    title: "Wood Stain Chart",
    detail:
      "Request the current approved stain chart and physical finish samples.",
    section: "Resources",
  },
  {
    title: "Brochures & Catalogs",
    detail: "Browse Kessick’s public product brochures and catalogs.",
    section: "Resources",
    href: `${website}/resources/`,
  },
  {
    title: "Approved Logos",
    detail: "Request approved logo files and the current brand-use guidelines.",
    section: "Resources",
  },
  {
    title: "Marketing Materials",
    detail:
      "Request permission and approved photography for your dealer marketing.",
    section: "Resources",
  },
  {
    title: "Direct Teamwork Access",
    detail:
      "Sign in to Teamwork with your existing account. A Kessick workspace invitation is required.",
    section: "Teamwork",
    href: teamworkLogin,
  },
];
const announcements: Entry[] = [
  {
    title: "New Products",
    detail:
      "Explore Kessick’s published collections, including Forma and Towers. New release announcements await staff confirmation.",
    section: "Announcements",
    href: `${website}/our-styles/`,
  },
  {
    title: "Coming Soon",
    detail:
      "ESTATE SERIES · Cask Collection is a design concept only. Product name, availability and release date are not approved.",
    section: "Announcements",
  },
  {
    title: "New Policies",
    detail:
      "No new policy is announced in this public preview. Request current policies from Kessick.",
    section: "Announcements",
  },
  {
    title: "Special Announcements",
    detail:
      "The 15% voucher shown on Home is an unapproved example, not a redeemable offer.",
    section: "Announcements",
  },
  {
    title: "Kessick Cut List",
    detail:
      "Newsletter section reserved for Kessick Cut List. Content and publication schedule pending Kessick confirmation.",
    section: "Announcements",
  },
  {
    title: "Project Credits",
    detail:
      "Project credits and attribution requirements are pending staff confirmation. Request approval before publishing project photography.",
    section: "Announcements",
  },
];
const searchEntries: Entry[] = [
  ...resources,
  ...announcements,
  {
    title: "Design Request Form",
    detail:
      "Required project details and the official Kessick design-request workflow.",
    section: "Design",
  },
  {
    title: "Forma",
    detail: "Explore Forma and prepare a design request.",
    section: "Design",
  },
  {
    title: "Towers",
    detail: "Explore Towers and prepare a design request.",
    section: "Design",
  },
  {
    title: "Report an Issue",
    detail: "Feedback, email and telephone support.",
    section: "Feedback",
  },
  {
    title: "Dealer Account",
    detail:
      "Request verified dealer account assistance. No private account data is displayed here.",
    section: "Account",
  },
];
const toolkit: { title: string; section: Section; icon: LucideIcon }[] = [
  { title: "What’s New", section: "Announcements", icon: Sparkles },
  { title: "Design Request Form", section: "Design", icon: FileText },
  { title: "Dealer Resources", section: "Resources", icon: FolderOpen },
  { title: "Feedback", section: "Feedback", icon: MessageSquareText },
];

function currentSection(): Section {
  const hash = window.location.hash.slice(1);
  return sections.find((section) => section.toLowerCase() === hash) ?? "Home";
}

function PublicLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className="desk-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
      <ExternalLink size={15} aria-hidden="true" />
    </a>
  );
}

function AccessLink({ title }: { title: string }) {
  return (
    <a
      className="desk-link"
      href={emailDraft(
        `Dealer resource access: ${title}`,
        `Hello Kessick,\n\nPlease help me access ${title}.\nDealer/company:\nProject reference (if applicable):\n\nThank you.`,
      )}
    >
      Request Access
      <ArrowRight size={15} aria-hidden="true" />
    </a>
  );
}

function Feedback() {
  const [draft, setDraft] = useState("");
  function prepareEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const subject = `Dealer portal — ${values.get("category")}`;
    const body = `Hello Kessick,\n\nIssue category: ${values.get("category")}\nName: ${values.get("name")}\nDealer/company: ${values.get("company")}\nReply email: ${values.get("email")}\n\n${values.get("message")}\n\nSent from the public dealer portal preview.`;
    const href = emailDraft(subject, body);
    setDraft(href);
    window.location.href = href;
  }
  return (
    <>
      <p>
        Share feedback or report a problem. This preview prepares an email; it
        does not submit a ticket or store your details.
      </p>
      <form className="desk-form" onSubmit={prepareEmail}>
        <label>
          Issue category
          <select
            name="category"
            required
            defaultValue="Portal or access issue"
          >
            <option>Portal or access issue</option>
            <option>Design request</option>
            <option>Product or installation question</option>
            <option>Document access</option>
            <option>Order or project support</option>
            <option>General feedback</option>
          </select>
        </label>
        <div className="desk-form-row">
          <label>
            Your name
            <input name="name" autoComplete="name" maxLength={100} required />
          </label>
          <label>
            Dealer / company
            <input
              name="company"
              autoComplete="organization"
              maxLength={120}
              required
            />
          </label>
        </div>
        <label>
          Reply email
          <input
            type="email"
            name="email"
            autoComplete="email"
            maxLength={200}
            required
          />
        </label>
        <label>
          How can we help?
          <textarea name="message" rows={5} maxLength={2000} required />
        </label>
        <p className="desk-note">
          Please do not include passwords, payment information, private
          documents or customer details.
        </p>
        <button className="desk-primary" type="submit">
          <Mail size={17} aria-hidden="true" />
          Open email draft
        </button>
      </form>
      {draft && (
        <div className="desk-callout" role="status">
          Email draft requested — not sent. Review and send it in your email
          app. If nothing opened, <a href={draft}>open the prepared draft</a> or
          contact Kessick below.
        </div>
      )}
      <div className="desk-contact">
        <a href={`mailto:${email}`}>
          <Mail size={18} aria-hidden="true" />
          Email Kessick
        </a>
        <a href="tel:+18642971911">
          <Phone size={18} aria-hidden="true" />
          864.297.1911
        </a>
        <PublicLink href={`${website}/contact/`}>
          Contact Kessick online
        </PublicLink>
      </div>
    </>
  );
}

function SectionContent({ section }: { section: Section }) {
  if (section === "Resources")
    return (
      <>
        <p>
          Public Kessick information is linked below. Restricted documents,
          prices and project files stay in authorized dealer accounts.
        </p>
        <div className="desk-card-grid">
          {resources.map((resource) => (
            <article className="desk-card" key={resource.title}>
              <FolderOpen size={23} aria-hidden="true" />
              <h2>{resource.title}</h2>
              <p>{resource.detail}</p>
              {resource.href ? (
                <PublicLink href={resource.href}>
                  {resource.section === "Teamwork"
                    ? "Open Teamwork sign-in"
                    : "View public resources"}
                </PublicLink>
              ) : (
                <AccessLink title={resource.title} />
              )}
            </article>
          ))}
        </div>
      </>
    );
  if (section === "Announcements")
    return (
      <>
        <p>
          Public product information and clearly marked content awaiting
          approval. Account-targeted announcements and notifications remain
          private.
        </p>
        <div className="desk-card-grid">
          {announcements.map((item) => (
            <article className="desk-card" key={item.title}>
              <span className="desk-status">
                {item.href
                  ? "Public product information"
                  : "Pending confirmation"}
              </span>
              <h2>{item.title}</h2>
              <p>{item.detail}</p>
              {item.href ? (
                <PublicLink href={item.href}>
                  Explore Kessick collections
                </PublicLink>
              ) : (
                <AccessLink title={item.title} />
              )}
            </article>
          ))}
        </div>
      </>
    );
  if (section === "Design")
    return (
      <>
        <p>
          Start your project through Kessick’s official design-request workflow,
          not a sample submission form.
        </p>
        <div className="desk-card-grid">
          <article className="desk-card">
            <Wine size={24} aria-hidden="true" />
            <h2>Forma</h2>
            <p>
              Explore Kessick’s Forma collection and share your project
              requirements with the design team.
            </p>
            <PublicLink href={`${website}/forma/`}>Explore Forma</PublicLink>
            <PublicLink href={designRequest}>Request a Forma design</PublicLink>
          </article>
          <article className="desk-card">
            <Wine size={24} aria-hidden="true" />
            <h2>Towers</h2>
            <p>
              Explore Kessick’s Tower Series in the official styles collection
              and discuss the right configuration for your project.
            </p>
            <PublicLink href={`${website}/our-styles/`}>
              Explore Towers
            </PublicLink>
            <PublicLink href={designRequest}>
              Request a Towers design
            </PublicLink>
          </article>
        </div>
        <article className="desk-card desk-checklist">
          <h2>Prepare your project details</h2>
          <p>
            Have these details ready; Kessick’s official form confirms the
            required fields.
          </p>
          <ul>
            <li>Dealer/company name and contact information</li>
            <li>Project location, type and desired timeline</li>
            <li>Room dimensions, ceiling height and dimensioned plans</li>
            <li>Doors, windows, obstructions and site photographs</li>
            <li>Desired bottle capacity and collection / style</li>
            <li>Wood, finish, lighting and other design preferences</li>
            <li>Budget guidance and installation requirements</li>
          </ul>
          <PublicLink href={designRequest}>
            Open official Design Request Form
          </PublicLink>
        </article>
      </>
    );
  if (section === "Feedback") return <Feedback />;
  if (section === "Teamwork")
    return (
      <article className="desk-card">
        <Users size={30} aria-hidden="true" />
        <h2>Your Teamwork account</h2>
        <p>
          Use your existing Teamwork account and Kessick workspace invitation.
          This public preview does not create an account or grant project
          access.
        </p>
        <PublicLink href={teamworkLogin}>Open Teamwork sign-in</PublicLink>
        <p>Need your dealer-specific workspace link or an invitation?</p>
        <AccessLink title="Kessick Teamwork workspace invitation" />
      </article>
    );
  return (
    <article className="desk-card">
      <ShieldCheck size={30} aria-hidden="true" />
      <h2>Verified dealer access</h2>
      <p>
        You are viewing the public project desk, not signed in to a dealer
        account. No customer records, dealer prices or private documents are
        available here.
      </p>
      <p>
        Contact Kessick for your verified account sign-in link, account changes
        or dealer approval. Staff manage accounts and document permissions in
        the separately protected staff portal.
      </p>
      <AccessLink title="verified dealer account and sign-in link" />
      <PublicLink href={`${website}/become-a-dealer/`}>
        Become a Kessick dealer
      </PublicLink>
    </article>
  );
}

export default function DealerPortalPreview({
  staffViewMode = false,
}: {
  staffViewMode?: boolean;
}) {
  const [section, setSection] = useState<Section>(currentSection);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    const handleHash = () => {
      setSection(currentSection());
      setSearch("");
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [section]);
  const results = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return searchEntries.filter(
      (entry) =>
        (filter === "All" || entry.section === filter) &&
        `${entry.title} ${entry.detail}`.toLowerCase().includes(query),
    );
  }, [search, filter]);
  function navigate(next: Section) {
    setSection(next);
    setSearch("");
    window.location.hash = next.toLowerCase();
  }
  const title = {
    Home: "Your Kessick project desk.",
    Announcements: "What’s New",
    Design: "Design Request Form",
    Resources: "Dealer Resources",
    Feedback: "Report an Issue",
    Account: "Dealer Account",
    Teamwork: "Teamwork Account",
  }[section];
  return (
    <div className="dealer-cover">
      <a
        className="desk-skip"
        href="#desk-content"
        onClick={(event) => {
          event.preventDefault();
          content.current?.focus({ preventScroll: true });
          content.current?.scrollIntoView();
        }}
      >
        Skip to content
      </a>
      {staffViewMode && (
        <div className="desk-staff-notice">
          Read-only public dealer view · not account impersonation{" "}
          <a href="/admin">Return to staff portal</a>
        </div>
      )}
      <div className="desk-shell">
        <header
          className={`desk-header ${section !== "Home" ? "desk-header-compact" : ""}`}
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.44), rgba(0,0,0,.87)), url(${cellarImage})`,
          }}
        >
          <div className="desk-topbar">
            <a
              href="#account"
              onClick={() => navigate("Account")}
              className="desk-profile"
              aria-label="Dealer profile"
            >
              <span className="desk-avatar">
                <UserRound size={22} aria-hidden="true" />
              </span>
              <span>
                Dealer portal<small>Public preview</small>
              </span>
            </a>
            <a
              href="#announcements"
              onClick={() => navigate("Announcements")}
              className="desk-bell"
              aria-label="Notifications and announcements"
            >
              <Bell size={23} aria-hidden="true" />
            </a>
          </div>
          <a
            className="desk-brand"
            href="#home"
            onClick={() => navigate("Home")}
            aria-label="Kessick Home"
          >
            <img
              src={whiteLogo}
              width="180"
              height="50"
              alt="Kessick Wine Storage Systems"
            />
          </a>
          <h1 ref={heading} tabIndex={-1}>
            {title}
          </h1>
          {section === "Home" && (
            <p className="desk-intro">
              A place for inspiration, project support,
              <br />
              and everything you need to create something extraordinary.
            </p>
          )}
          <div className="desk-search">
            <Search size={19} aria-hidden="true" />
            <input
              aria-label="Search dealer toolkit"
              placeholder="Search your dealer toolkit…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <button
              type="button"
              aria-label="Filter search"
              aria-expanded={filtersOpen}
              aria-controls="desk-search-filters"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal size={19} aria-hidden="true" />
            </button>
          </div>
          {filtersOpen && (
            <div id="desk-search-filters" className="desk-filters">
              <label>
                Search in
                <select
                  aria-label="Search in"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                >
                  <option>All</option>
                  <option value="Resources">Dealer Resources</option>
                  <option value="Design">Design Requests</option>
                  <option value="Announcements">Announcements</option>
                  <option value="Feedback">Feedback</option>
                </select>
              </label>
            </div>
          )}
          {search.trim() && (
            <div
              className="desk-search-results"
              role="region"
              aria-label="Search results"
            >
              <p role="status">
                {results.length
                  ? `${results.length} result${results.length === 1 ? "" : "s"}`
                  : "No results. Try “Forma”, “stain” or “feedback”."}
              </p>
              {results.map((result) => (
                <a
                  key={`${result.section}-${result.title}`}
                  href={`#${result.section.toLowerCase()}`}
                  onClick={() => navigate(result.section)}
                >
                  <span>
                    {result.title}
                    <small>{result.detail}</small>
                  </span>
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              ))}
            </div>
          )}
        </header>
        <main ref={content} id="desk-content" tabIndex={-1}>
          {section === "Home" ? (
            <>
              <figure className="desk-cellar">
                <img
                  src={cellarImage}
                  width="1440"
                  height="960"
                  alt="Wine-cellar room inspiration with warm wood cabinetry and display racks"
                />
                <figcaption>Wine-cellar inspiration</figcaption>
              </figure>
              <section
                className="desk-toolkit"
                aria-labelledby="toolkit-heading"
              >
                <h2 id="toolkit-heading">Your Dealer Toolkit</h2>
                <div className="desk-toolkit-grid">
                  {toolkit.map(
                    ({ title: label, section: destination, icon: Icon }) => (
                      <a
                        key={label}
                        href={`#${destination.toLowerCase()}`}
                        onClick={() => navigate(destination)}
                      >
                        <span className="desk-metal">
                          <Icon
                            size={28}
                            strokeWidth={1.35}
                            aria-hidden="true"
                          />
                        </span>
                        <span>{label}</span>
                      </a>
                    ),
                  )}
                </div>
              </section>
              <a
                className="desk-voucher"
                href="#announcements"
                onClick={() => navigate("Announcements")}
              >
                <span className="desk-voucher-value">
                  15%<small>VOUCHER</small>
                </span>
                <span>
                  <strong>
                    A little inspiration.
                    <br />A little extra possibility.
                  </strong>
                  <span className="desk-voucher-disclaimer">
                    UNAPPROVED EXAMPLE · NOT REDEEMABLE
                  </span>
                  <small>Offer and terms require Kessick confirmation.</small>
                </span>
                <ArrowRight size={19} aria-hidden="true" />
              </a>
              <a
                className="desk-feature"
                href="#announcements"
                onClick={() => navigate("Announcements")}
              >
                <span className="desk-feature-eyebrow">Coming Soon</span>
                <span className="desk-feature-series">ESTATE SERIES</span>
                <span className="desk-feature-name">Cask Collection</span>
                <span className="desk-feature-rule" />
                <span className="desk-feature-concept">
                  DESIGN CONCEPT · NOT AN APPROVED RELEASE
                </span>
                <span className="desk-feature-link">
                  Explore the concept
                  <ArrowRight size={17} aria-hidden="true" />
                </span>
              </a>
              <p className="desk-preview-note">
                Public design preview. Header photograph awaits Kessick’s
                approved building image. Private dealer content requires
                authorized access.
              </p>
            </>
          ) : (
            <section className="desk-page">
              <a
                className="desk-back"
                href="#home"
                onClick={() => navigate("Home")}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Project desk
              </a>
              <SectionContent section={section} />
            </section>
          )}
        </main>
        <nav className="desk-bottom-nav" aria-label="Dealer navigation">
          <a
            href="#home"
            onClick={() => navigate("Home")}
            aria-current={section === "Home" ? "page" : undefined}
          >
            <Home size={22} aria-hidden="true" />
            <span>Home</span>
          </a>
          <a
            href="#account"
            onClick={() => navigate("Account")}
            aria-current={section === "Account" ? "page" : undefined}
            aria-label="Dealer Account"
          >
            <UserRound size={22} aria-hidden="true" />
            <span>Account</span>
          </a>
          <a href={`mailto:${email}`} aria-label="Email Kessick">
            <Mail size={22} aria-hidden="true" />
            <span>Email</span>
          </a>
          <a
            href="#teamwork"
            onClick={() => navigate("Teamwork")}
            aria-current={section === "Teamwork" ? "page" : undefined}
            aria-label="Teamwork Account"
          >
            <Users size={22} aria-hidden="true" />
            <span>Teamwork</span>
          </a>
        </nav>
      </div>
    </div>
  );
}
