import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Images,
  Mail,
  MessageSquareText,
  Palette,
  Phone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import cellarImage from "@assets/kessick-room-demo.jpg";
import logoWhite from "@assets/kessick-logo-white.svg";

/* ------------------------------------------------------------------ *
 * Kessick Dealer Portal — public sample preview
 *
 * Recreates Cindi McNew's mobile app-cover design with real, interactive
 * React components (not a screenshot). The layout is mobile-first and
 * centered inside a pale lavender-gray surface so it reads like an app
 * cover on every viewport while remaining fully responsive.
 *
 * This is a PUBLIC preview: no sign-in, no private pricing/documents,
 * no fake "submitted successfully" messages. Real actions open the
 * official Kessick website, an email draft, or a phone dialer.
 * ------------------------------------------------------------------ */

const KESSICK_SITE = "https://kessickwinecellars.com/";
const KESSICK_DESIGN_REQUEST = "https://kessickwinecellars.com/design-request/";
const KESSICK_STYLES = "https://kessickwinecellars.com/our-styles/";
const KESSICK_RESOURCES = "https://kessickwinecellars.com/";
const KESSICK_EMAIL = "sales@kessickwinecellars.com";
const KESSICK_PHONE_DISPLAY = "864.297.1911";
const KESSICK_PHONE_TEL = "+18642971911";
const TEAMWORK_SITE = "https://www.teamwork.com/";

type Section =
  | "Home"
  | "Announcements"
  | "DesignRequest"
  | "Resources"
  | "Support"
  | "Account";

/** Accepts both lucide-react icons and the local inline SVG icons below. */
type IconType = React.ComponentType<{ className?: string }>;

type NavItem =
  | { kind: "section"; label: string; icon: IconType; section: Section }
  | { kind: "link"; label: string; icon: IconType; href: string };

const bottomNav: NavItem[] = [
  { kind: "section", label: "Home", icon: HomeIcon, section: "Home" },
  { kind: "section", label: "Account", icon: Users, section: "Account" },
  { kind: "link", label: "Email", icon: Mail, href: `mailto:${KESSICK_EMAIL}` },
  { kind: "link", label: "Teamwork", icon: Briefcase, href: TEAMWORK_SITE },
];

/* Small inline icons kept local so the bundle stays lean. */
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function Briefcase({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

type Toolkit = { label: string; icon: LucideIcon; section: Section };

const toolkit: Toolkit[] = [
  { label: "What’s New", icon: Sparkles, section: "Announcements" },
  { label: "Design Request Form", icon: FileText, section: "DesignRequest" },
  { label: "Dealer Resources", icon: FolderOpen, section: "Resources" },
  { label: "Feedback", icon: MessageSquareText, section: "Support" },
];

/* ---- Announcements content (Oct 8 outline) ---- */
const announcementGroups: {
  category: string;
  pending?: boolean;
  items: { title: string; body: string; href?: string }[];
}[] = [
  {
    category: "New Products",
    items: [
      {
        title: "Explore current Kessick collections",
        body: "Estate, Elevation, Forma, Towers and Wine As Art styles are published on the Kessick website.",
        href: KESSICK_STYLES,
      },
    ],
  },
  {
    category: "Coming Soon",
    items: [
      {
        title: "ESTATE SERIES · Cask Collection",
        body: "Concept preview only. This collection is an unapproved example and is not yet released — details are pending Kessick confirmation.",
      },
    ],
  },
  {
    category: "New Policies",
    items: [
      {
        title: "Dealer policy updates",
        body: "Published dealer policy changes will appear here. Refer to your authorized account for current, binding policies.",
      },
    ],
  },
  {
    category: "Special Announcements",
    items: [
      {
        title: "15% dealer voucher (example)",
        body: "Powder-blue voucher shown on the home screen is an unapproved example. No offer is live until Kessick confirms it.",
      },
    ],
  },
  {
    category: "Kessick Cut List Newsletter",
    pending: true,
    items: [
      {
        title: "Newsletter section — pending content",
        body: "The Kessick Cut List newsletter will live here once content is confirmed with the Kessick team.",
      },
    ],
  },
  {
    category: "Project Credits",
    pending: true,
    items: [
      {
        title: "Project credits — pending staff confirmation",
        body: "Credit and recognition details for completed projects will be added after staff confirm the information.",
      },
    ],
  },
];

/* ---- Dealer Resources (Oct 8 outline) ---- */
type Resource = {
  title: string;
  icon: IconType;
  public?: string; // public link available
  restricted?: boolean; // requires Request Access
  note: string;
};

const resources: Resource[] = [
  {
    title: "Renders",
    icon: Images,
    restricted: true,
    note: "Project renders are dealer-specific. Request access from the Kessick team.",
  },
  {
    title: "Policies & Guides",
    icon: BookOpen,
    public: KESSICK_RESOURCES,
    note: "Dealer policies and project guides. Public guidance on the Kessick website.",
  },
  {
    title: "Installation & Specification Sheets",
    icon: FileText,
    restricted: true,
    note: "Technical install and spec sheets. Request access for the latest files.",
  },
  {
    title: "Wood Stain Chart",
    icon: Palette,
    public: KESSICK_STYLES,
    note: "Finish and wood stain options. See finishes on the Kessick website.",
  },
  {
    title: "Brochures & Catalogs",
    icon: FolderOpen,
    public: KESSICK_SITE,
    note: "Product brochures and catalogs. Browse collections on Kessick's site.",
  },
  {
    title: "Approved Logos",
    icon: Download,
    restricted: true,
    note: "Brand-approved Kessick logos. Request the current logo pack.",
  },
  {
    title: "Marketing Materials",
    icon: Images,
    restricted: true,
    note: "Co-branded marketing assets. Request access from your rep.",
  },
  {
    title: "Direct Teamwork Access",
    icon: Briefcase,
    public: TEAMWORK_SITE,
    note: "Dealer project collaboration runs in Teamwork. Open Teamwork or request access.",
  },
];

/* ---- Report an issue categories ---- */
const issueCategories = [
  "Product / spec question",
  "Order or delivery",
  "Design request help",
  "Website / portal issue",
  "Billing or account",
  "Something else",
];

type SearchHit = { title: string; detail: string; section: Section };

/* ------------------------------------------------------------------ */

function PendingBadge({ children = "Pending" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#b8923f]/40 bg-[#f6edda] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7a5c1e]">
      {children}
    </span>
  );
}

function ExampleBadge({ children = "Example" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#5f7fa6]/40 bg-[#dde8f3] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#3c5a80]">
      {children}
    </span>
  );
}

function WebLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6d5a30] underline-offset-4 hover:underline"
    >
      {children} <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function SectionHeader({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <button
        onClick={onBack}
        className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-[#6d5a30] hover:underline"
      >
        <ChevronLeft className="h-4 w-4" /> Back to home
      </button>
      <h1 className="font-serif text-2xl font-semibold text-[#1b1b19]">
        {title}
      </h1>
      {children ? (
        <p className="mt-1.5 text-sm leading-relaxed text-[#1b1b19]/60">
          {children}
        </p>
      ) : null}
    </div>
  );
}

/* ---------------------------- Home ---------------------------------- */

function Home({
  search,
  setSearch,
  results,
  onNavigate,
}: {
  search: string;
  setSearch: (v: string) => void;
  results: SearchHit[];
  onNavigate: (s: Section) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Dark photographic header */}
      <header className="relative isolate -mx-4 -mt-4 overflow-hidden rounded-b-[28px] bg-[#15130f] px-5 pb-7 pt-5 text-white shadow-[0_18px_40px_rgba(21,19,15,0.28)] sm:-mx-6 sm:px-7">
        <img
          src={cellarImage}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#15130f]/78 via-[#15130f]/82 to-[#15130f]/92" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/10 text-sm font-semibold text-white">
              AM
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">
                Authorized Dealer Name
              </span>
              <span className="block truncate text-xs text-white/70">
                123 Anywhere St., Any City
              </span>
            </span>
          </div>
          <button
            onClick={() => onNavigate("Announcements")}
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/5 text-white hover:bg-white/15"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#d9bf7e]" />
          </button>
        </div>

        <img
          src={logoWhite}
          alt="Kessick Wine Storage Systems"
          className="mt-6 h-6 w-auto opacity-90"
        />
        <h1 className="mt-4 font-serif text-[32px] font-semibold leading-[1.1] tracking-tight sm:text-4xl">
          Your Kessick
          <br />
          project desk.
        </h1>
        <p className="mt-2 max-w-sm text-sm italic leading-relaxed text-white/75">
          Pricing, specs, finish options, and marketing assets in one place.
          Everything you need to sell, specify, and deliver.
        </p>

        {/* Black search bar with magnifier + filter icon */}
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/12 bg-black/55 px-4 py-3 backdrop-blur">
          <Search className="h-5 w-5 shrink-0 text-white/60" />
          <label htmlFor="dealer-search" className="sr-only">
            Search the dealer portal
          </label>
          <input
            id="dealer-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search here"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/45"
          />
          <button
            type="button"
            aria-label="Filters"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/15 text-white/70 hover:bg-white/10"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>

        {search.trim() ? (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-[#1d1b16]">
            {results.length ? (
              results.map((r) => (
                <button
                  key={`${r.section}-${r.title}`}
                  onClick={() => {
                    onNavigate(r.section);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-white/5 px-4 py-3 text-left last:border-0 hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">
                      {r.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/50">
                      {r.detail}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/40" />
                </button>
              ))
            ) : (
              <p className="px-4 py-4 text-sm text-white/55">
                No results for “{search.trim()}”.
              </p>
            )}
          </div>
        ) : null}
      </header>

      {/* Wide wine-cellar photograph */}
      <section className="relative overflow-hidden rounded-3xl">
        <img
          src={cellarImage}
          alt="Luxury custom Kessick wine cellar"
          className="h-44 w-full object-cover sm:h-52"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <p className="font-serif text-lg font-medium text-white drop-shadow">
            Spaces worth savoring.
          </p>
          <WebLinkDark href={KESSICK_STYLES}>Explore styles</WebLinkDark>
        </div>
      </section>

      {/* Your Dealer Toolkit */}
      <section>
        <h2 className="font-serif text-xl font-semibold text-[#1b1b19]">
          Your Dealer Toolkit
        </h2>
        <p className="mb-4 mt-0.5 text-xs italic text-[#1b1b19]/65">
          News, design support, sales resources, and a direct line to our team.
        </p>
        <div className="grid grid-cols-4 gap-2 sm:gap-4">
          {toolkit.map(({ label, icon: Icon, section }) => (
            <button
              key={label}
              onClick={() => onNavigate(section)}
              className="group flex min-w-0 flex-col items-center gap-2 text-center"
            >
              <span
                className="flex h-[clamp(3.5rem,18vw,4.5rem)] w-[clamp(3.5rem,18vw,4.5rem)] items-center justify-center rounded-full border border-black/60 text-white shadow-[0_8px_18px_rgba(27,27,25,0.28),inset_0_1px_1px_rgba(255,255,255,0.35)] transition group-hover:-translate-y-0.5 group-active:translate-y-0"
                style={{
                  background:
                    "radial-gradient(circle at 30% 25%,#8a8a86 0%,#3a3a37 38%,#0f0f0e 100%)",
                }}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-[10px] font-semibold leading-tight text-[#1b1b19]/80 sm:text-xs">
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Powder-blue 15% voucher banner (unapproved example) */}
      <section className="rounded-2xl border border-[#9fb9d6] bg-gradient-to-br from-[#bcd2e8] to-[#9fbcdb] px-4 py-3 text-[#1b1b19]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-12 shrink-0 items-center justify-center rounded-md bg-white/70 text-lg font-bold text-[#3c5a80]">
            %
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold leading-tight sm:text-base">
              Get a 15% Discount Voucher
            </p>
            <p className="text-[11px] italic leading-tight text-[#1b1b19]/75">
              on all Somm projects through Nov 30, 2026
            </p>
          </div>
          <button
            onClick={() => onNavigate("Announcements")}
            aria-label="Voucher details"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#1b1b19] hover:bg-[#f6edda]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2">
          <ExampleBadge>Example · pending Kessick approval</ExampleBadge>
        </div>
      </section>

      {/* Black ESTATE SERIES / Cask Collection concept card */}
      <section className="overflow-hidden rounded-3xl bg-[#111010] text-white">
        <div className="relative h-36 w-full overflow-hidden">
          <img
            src={cellarImage}
            alt=""
            className="h-full w-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#111010] via-[#111010]/50 to-transparent" />
          <span className="absolute left-4 top-4">
            <ExampleBadge>Concept · pending approval</ExampleBadge>
          </span>
          <Bookmark className="absolute right-4 top-4 h-5 w-5 text-white/85" aria-hidden="true" />
        </div>
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#d9bf7e]">
            Coming Soon · Estate Series
          </p>
          <h3 className="mt-2 font-serif text-2xl font-semibold">
            Cask Collection
          </h3>
          <p className="mt-3 text-sm font-semibold">Be first to quote it.</p>
          <p className="text-xs italic text-white/65">
            Concept preview only, not yet approved or available.
          </p>
          <button
            onClick={() => onNavigate("Announcements")}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            Click to get launch details <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}

function WebLinkDark({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-[#1b1b19] hover:bg-white"
    >
      {children} <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

/* ------------------------ Announcements ----------------------------- */

function Announcements({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <SectionHeader title="Announcements" onBack={onBack}>
        New products, coming-soon concepts, policy updates, and special
        announcements. Example and pending items are labeled.
      </SectionHeader>
      <div className="space-y-4">
        {announcementGroups.map((group) => (
          <article
            key={group.category}
            className="rounded-2xl border border-[#1b1b19]/10 bg-white p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[#6d5a30]">
                {group.category}
              </h2>
              {group.pending ? <PendingBadge /> : null}
            </div>
            <div className="mt-3 space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.title}
                  className="border-l-2 border-[#c9ab62] pl-3"
                >
                  <p className="text-sm font-semibold text-[#1b1b19]">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[#1b1b19]/60">
                    {item.body}
                  </p>
                  {item.href ? (
                    <div className="mt-2">
                      <WebLink href={item.href}>Open on kessickwinecellars.com</WebLink>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/* ----------------------- Design Request ----------------------------- */

function DesignRequest({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <SectionHeader title="Design Request Form" onBack={onBack}>
        Start a Forma or Towers design request through Kessick's official
        workflow. Submissions are handled on the Kessick website.
      </SectionHeader>

      <section className="rounded-2xl border border-[#c9ab62]/40 bg-[#f7f2e6] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#6d5a30]" />
          <div>
            <h2 className="font-semibold text-[#1b1b19]">
              Submit through Kessick's official form
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[#1b1b19]/65">
              The official design-request workflow collects your project
              details securely. This public preview links you straight to it.
            </p>
            <div className="mt-3">
              <WebLink href={KESSICK_DESIGN_REQUEST}>
                Open the Kessick design request
              </WebLink>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          {
            name: "Forma",
            body: "Request a Forma collection design.",
          },
          {
            name: "Towers",
            body: "Request a tower-style design.",
          },
        ].map((style) => (
          <a
            key={style.name}
            href={KESSICK_DESIGN_REQUEST}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-[#1b1b19]/10 bg-white p-5 transition hover:border-[#c9ab62]"
          >
            <h3 className="font-serif text-lg font-semibold text-[#1b1b19]">
              {style.name}
            </h3>
            <p className="mt-1 text-sm text-[#1b1b19]/60">{style.body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#6d5a30]">
              Start request <ArrowRight className="h-4 w-4" />
            </span>
          </a>
        ))}
      </div>

      <section className="mt-4 rounded-2xl border border-[#1b1b19]/10 bg-white p-5">
        <h2 className="font-semibold text-[#1b1b19]">
          Project details you'll need
        </h2>
        <ul className="mt-3 space-y-2 text-sm text-[#1b1b19]/65">
          {[
            "Room dimensions and photos or drawings",
            "Collection / style of interest (e.g. Forma, Towers)",
            "Desired wood species and finish / stain",
            "Bottle capacity and refrigeration needs",
            "Project timeline and installation location",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c9ab62]" />
              {line}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* -------------------------- Resources ------------------------------- */

function Resources({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <SectionHeader title="Dealer Resources" onBack={onBack}>
        Renders, guides, spec sheets, finishes, brochures, logos, marketing, and
        Teamwork access. Restricted files use a Request Access action instead of
        a fake download.
      </SectionHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        {resources.map((r) => {
          const Icon = r.icon;
          const requestHref = `mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent(
            `Resource access request: ${r.title}`,
          )}&body=${encodeURIComponent(
            `Hello Kessick team,\n\nI'd like access to the "${r.title}" dealer resource.\n\nDealer / company:\nContact name:\n\nThank you.`,
          )}`;
          return (
            <article
              key={r.title}
              className="flex flex-col rounded-2xl border border-[#1b1b19]/10 bg-white p-4"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c9ab62]/15 text-[#6d5a30]">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#1b1b19]">
                    {r.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-[#1b1b19]/55">
                    {r.note}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {r.public ? (
                  <a
                    href={r.public}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-[#1b1b19] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
                  >
                    Open <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
                {r.restricted ? (
                  <a
                    href={requestHref}
                    className="inline-flex items-center gap-1 rounded-full border border-[#1b1b19]/20 px-3 py-1.5 text-xs font-semibold text-[#1b1b19] hover:border-[#c9ab62]"
                  >
                    Request access <Mail className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- Support -------------------------------- */

function Support({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState(issueCategories[0]);
  const [message, setMessage] = useState("");

  const mailtoHref = `mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent(
    `Dealer portal — ${category}`,
  )}&body=${encodeURIComponent(
    `Issue category: ${category}\n\n${message || "Describe the issue here…"}\n\n— Sent from the Kessick dealer portal`,
  )}`;

  return (
    <div>
      <SectionHeader title="Report an Issue & Feedback" onBack={onBack}>
        Send feedback by email, reach the Kessick team, or call support. This
        preview opens a real, prefilled email draft — it never shows a fake
        "submitted" message.
      </SectionHeader>

      <section className="rounded-2xl border border-[#1b1b19]/10 bg-white p-5">
        <h2 className="font-semibold text-[#1b1b19]">Feedback form</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="issue-category"
              className="block text-xs font-semibold uppercase tracking-wide text-[#6d5a30]"
            >
              Issue category
            </label>
            <select
              id="issue-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-[#1b1b19]/15 bg-[#faf9f6] px-3 py-2.5 text-sm text-[#1b1b19] outline-none focus:border-[#c9ab62]"
            >
              {issueCategories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="issue-message"
              className="block text-xs font-semibold uppercase tracking-wide text-[#6d5a30]"
            >
              Details
            </label>
            <textarea
              id="issue-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Tell us what's happening…"
              className="mt-1.5 w-full rounded-xl border border-[#1b1b19]/15 bg-[#faf9f6] px-3 py-2.5 text-sm text-[#1b1b19] outline-none focus:border-[#c9ab62]"
            />
          </div>
          <a
            href={mailtoHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1b1b19] px-5 py-3 text-sm font-semibold text-white hover:bg-black sm:w-auto"
          >
            <Mail className="h-4 w-4" /> Open email draft
          </a>
          <p className="text-xs text-[#1b1b19]/45">
            Your email app opens with these details prefilled so you can review
            and send. Nothing is submitted from this public preview.
          </p>
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a
          href={`mailto:${KESSICK_EMAIL}`}
          className="flex items-center gap-3 rounded-2xl border border-[#1b1b19]/10 bg-white p-4 hover:border-[#c9ab62]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c9ab62]/15 text-[#6d5a30]">
            <Mail className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#1b1b19]">
              Email Kessick
            </span>
            <span className="block truncate text-xs text-[#1b1b19]/55">
              {KESSICK_EMAIL}
            </span>
          </span>
        </a>
        <a
          href={`tel:${KESSICK_PHONE_TEL}`}
          className="flex items-center gap-3 rounded-2xl border border-[#1b1b19]/10 bg-white p-4 hover:border-[#c9ab62]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c9ab62]/15 text-[#6d5a30]">
            <Phone className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#1b1b19]">
              Call support
            </span>
            <span className="block truncate text-xs text-[#1b1b19]/55">
              {KESSICK_PHONE_DISPLAY}
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}

/* --------------------------- Account -------------------------------- */

function Account({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <SectionHeader title="Dealer Account" onBack={onBack}>
        A sample dealer profile. No real person, pricing, or private records are
        shown in this public preview.
      </SectionHeader>
      <section className="rounded-2xl border border-[#1b1b19]/10 bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c9ab62]/15 text-sm font-semibold text-[#6d5a30]">
            AM
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-[#1b1b19]">Alex Morgan</h2>
            <p className="truncate text-sm text-[#1b1b19]/55">
              Example Cellars LLC · sample profile
            </p>
          </div>
        </div>
        <dl className="mt-5 grid gap-4 border-t border-[#1b1b19]/10 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[#1b1b19]/45">
              Account status
            </dt>
            <dd className="mt-0.5 text-sm text-[#1b1b19]">
              Sample approved dealer
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[#1b1b19]/45">
              Access
            </dt>
            <dd className="mt-0.5 text-sm text-[#1b1b19]">
              Illustrative only · no sign-in
            </dd>
          </div>
        </dl>
      </section>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <a
          href={TEAMWORK_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-[#1b1b19]/10 bg-white p-4 hover:border-[#c9ab62]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c9ab62]/15 text-[#6d5a30]">
            <Briefcase className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#1b1b19]">
              Teamwork Account
            </span>
            <span className="block truncate text-xs text-[#1b1b19]/55">
              Open dealer project collaboration
            </span>
          </span>
        </a>
        <a
          href={KESSICK_SITE}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-[#1b1b19]/10 bg-white p-4 hover:border-[#c9ab62]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#c9ab62]/15 text-[#6d5a30]">
            <ExternalLink className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[#1b1b19]">
              Kessick Wine Cellars
            </span>
            <span className="block truncate text-xs text-[#1b1b19]/55">
              Visit the official website
            </span>
          </span>
        </a>
      </div>
    </div>
  );
}

/* ---------------------------- Shell --------------------------------- */

export default function DealerPortalPreview({
  staffViewMode = false,
}: {
  staffViewMode?: boolean;
}) {
  const [section, setSection] = useState<Section>("Home");
  const [search, setSearch] = useState("");

  const results = useMemo<SearchHit[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const entries: SearchHit[] = [
      ...toolkit.map((t) => ({
        title: t.label,
        detail: "Dealer toolkit",
        section: t.section,
      })),
      ...announcementGroups.map((g) => ({
        title: g.category,
        detail: "Announcements",
        section: "Announcements" as const,
      })),
      ...resources.map((r) => ({
        title: r.title,
        detail: "Dealer resource",
        section: "Resources" as const,
      })),
      {
        title: "Forma design request",
        detail: "Design Request Form",
        section: "DesignRequest",
      },
      {
        title: "Towers design request",
        detail: "Design Request Form",
        section: "DesignRequest",
      },
      {
        title: "Report an issue",
        detail: "Feedback & support",
        section: "Support",
      },
      {
        title: "Wood stain chart",
        detail: "Finishes",
        section: "Resources",
      },
    ];
    return entries
      .filter((e) => `${e.title} ${e.detail}`.toLowerCase().includes(q))
      .slice(0, 7);
  }, [search]);

  const navigate = (next: Section) => {
    setSection(next);
    setSearch("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="dealer-preview-surface min-h-screen pb-24 text-[#1b1b19]">
      {staffViewMode ? (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#171715] px-4 py-2 text-xs text-white">
          <span className="font-semibold uppercase tracking-wide">
            Staff-only dealer view · read-only sample
          </span>
          <a
            href="/admin"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#d4bd85] px-3 font-semibold text-[#171715] hover:bg-white"
          >
            <ShieldCheck className="h-4 w-4" /> Staff View
          </a>
        </div>
      ) : null}

      {/* Public sample notice */}
      <div
        role="note"
        className="bg-[#2c2a24] px-4 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-[#e9e2cf]"
      >
        Public sample preview · example data · no sign-in or live actions
      </div>

      {/* Centered mobile app shell */}
      <div className="mx-auto w-full max-w-[460px] px-4 pt-4 sm:max-w-[520px] sm:px-6">
        {section === "Home" ? (
          <Home
            search={search}
            setSearch={setSearch}
            results={results}
            onNavigate={navigate}
          />
        ) : section === "Announcements" ? (
          <Announcements onBack={() => navigate("Home")} />
        ) : section === "DesignRequest" ? (
          <DesignRequest onBack={() => navigate("Home")} />
        ) : section === "Resources" ? (
          <Resources onBack={() => navigate("Home")} />
        ) : section === "Support" ? (
          <Support onBack={() => navigate("Home")} />
        ) : (
          <Account onBack={() => navigate("Home")} />
        )}

        <footer className="mt-8 border-t border-[#1b1b19]/10 pt-4 text-[11px] leading-relaxed text-[#1b1b19]/45">
          Public sample preview only. No dealer account, pricing, or private
          documents are connected. Product links open the official Kessick Wine
          Cellars website.{" "}
          <WebLink href={KESSICK_SITE}>Visit Kessick Wine Cellars</WebLink>
        </footer>
      </div>

      {/* Bottom navigation */}
      <nav
        aria-label="Dealer portal navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#1b1b19]/10 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto grid max-w-[460px] grid-cols-4 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 sm:max-w-[520px]">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.kind === "section" && section === item.section;
            const classes = `flex min-h-12 flex-col items-center justify-center gap-1 ${
              active ? "text-[#6d5a30]" : "text-[#1b1b19]/45"
            }`;
            if (item.kind === "link") {
              const external = item.href.startsWith("http");
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  className={classes}
                >
                  <Icon className="h-[18px] w-[18px]" />
                  <span className="text-[10px] font-semibold leading-none">
                    {item.label}
                  </span>
                </a>
              );
            }
            return (
              <button
                key={item.label}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(item.section)}
                className={classes}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span className="text-[10px] font-semibold leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
