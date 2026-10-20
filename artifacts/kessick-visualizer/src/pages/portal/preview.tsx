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
  Globe,
  Images,
  Mail,
  MessageSquareText,
  Palette,
  Phone,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  MousePointerClick,
  TicketPercent,
  Sparkles,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import cellarImage from "@assets/kessick-room-demo.jpg";
import logoWhite from "@assets/kessick-logo-white.svg";
// Placeholders cropped from the client mockup until the original photos arrive.
import dealerAvatar from "@assets/mockup/dealer-avatar.jpg";
import showroomHero from "@assets/mockup/showroom-hero.jpg";
import estateCraftsman from "@assets/mockup/estate-craftsman.jpg";

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
  { kind: "section", label: "Account", icon: PersonIcon, section: "Account" },
  { kind: "link", label: "Email", icon: EnvelopeIcon, href: `mailto:${KESSICK_EMAIL}` },
  { kind: "link", label: "Teamwork", icon: TeamworkIcon, href: TEAMWORK_SITE },
];

/* Small inline icons kept local so the bundle stays lean. */
function PersonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="12" cy="7.5" r="4.5" />
      <path d="M3.5 21c0-4.7 3.8-8 8.5-8s8.5 3.3 8.5 8v.5h-17V21Z" />
    </svg>
  );
}

function EnvelopeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="currentColor" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" fill="none" stroke="#1d1d1d" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function TeamworkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className={className} aria-hidden="true">
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" strokeLinecap="round" />
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="10.3" r="1.7" fill="currentColor" stroke="none" />
      <path d="M8.8 15.6c.5-1.6 1.7-2.5 3.2-2.5s2.7.9 3.2 2.5" strokeLinecap="round" />
      <circle cx="8.4" cy="11.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="11.4" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.6 1.8 11.3l1.3 1.5L4.5 11.6V21h5.6v-5.6h3.8V21h5.6v-9.4l1.4 1.2 1.3-1.5L12 2.6Z" />
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

type Toolkit = { label: string; icon: IconType; section: Section };

/* Filled toolkit glyphs drawn to match the mockup. */
function TilesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="3" y="3" width="8" height="8" rx="2.4" />
      <rect x="13" y="3" width="8" height="8" rx="2.4" />
      <rect x="3" y="13" width="8" height="8" rx="2.4" />
      <rect x="13" y="13" width="8" height="8" rx="2.4" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 1.5c.6 5.4 3.6 9.6 10.5 10.5-6.9.9-9.9 5.1-10.5 10.5C11.4 17.1 8.4 12.9 1.5 12 8.4 11.1 11.4 6.9 12 1.5Z" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M10.3 1.8h3.4l.5 2.7c.7.2 1.3.5 1.9.9l2.3-1.6 2.4 2.4-1.6 2.3c.4.6.7 1.2.9 1.9l2.7.5v3.4l-2.7.5c-.2.7-.5 1.3-.9 1.9l1.6 2.3-2.4 2.4-2.3-1.6c-.6.4-1.2.7-1.9.9l-.5 2.7h-3.4l-.5-2.7c-.7-.2-1.3-.5-1.9-.9l-2.3 1.6-2.4-2.4 1.6-2.3c-.4-.6-.7-1.2-.9-1.9l-2.7-.5v-3.4l2.7-.5c.2-.7.5-1.3.9-1.9L3.2 6.2l2.4-2.4 2.3 1.6c.6-.4 1.2-.7 1.9-.9l.5-2.7ZM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"
      />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M14 3.5H6.5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3H9l3 3 3-3h2.5a3 3 0 0 0 3-3V11" />
      <circle cx="19" cy="5" r="2" />
      <circle cx="8.5" cy="10.5" r=".6" fill="currentColor" />
      <circle cx="12" cy="10.5" r=".6" fill="currentColor" />
      <circle cx="15.5" cy="10.5" r=".6" fill="currentColor" />
    </svg>
  );
}

const toolkit: Toolkit[] = [
  { label: "What’s New", icon: TilesIcon, section: "Announcements" },
  { label: "Design Request Form", icon: StarIcon, section: "DesignRequest" },
  { label: "Dealer Resources", icon: GearIcon, section: "Resources" },
  { label: "Feedback", icon: ChatIcon, section: "Support" },
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
    <div className="dealer-mockup space-y-2.5 pb-2">
      {/* Photographic header with dealer identity, title and search */}
      <header className="relative isolate -mx-4 -mt-4 overflow-hidden text-white sm:-mx-6">
        <img
          src={cellarImage}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-black/45" />
        <div className="px-6 pt-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <img
                src={dealerAvatar}
                alt=""
                className="h-[42px] w-[42px] shrink-0 rounded-full border-2 border-white object-cover"
              />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-bold">Authorized Dealer Name</p>
                <p className="truncate text-[12px]">123 Anywhere St., Any City</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate("Announcements")}
              aria-label="Notifications"
              className="mt-1 text-white"
            >
              <Bell className="h-[18px] w-[18px]" fill="currentColor" />
            </button>
          </div>

          <h1 className="mt-5 text-[23px] font-extrabold leading-[1.12]">
            Your Kessick
            <br />
            project desk.
          </h1>
          <p className="mt-1.5 pb-3 text-[10.5px] leading-snug">
            <em>Pricing, specs, finish options, and marketing assets in one place.</em>
            <br />
            Everything you need to sell, specify, and deliver.
          </p>
        </div>

        {/* Search band: black fading to the photo, underlined field */}
        <div className="bg-gradient-to-r from-black via-black/85 to-black/30 px-6 pb-2.5 pt-2">
          <div className="flex items-center gap-3 border-b-2 border-white/85 pb-2">
            <Search className="h-6 w-6 shrink-0" strokeWidth={2.2} />
            <label htmlFor="dealer-search" className="sr-only">
              Search the dealer portal
            </label>
            <input
              id="dealer-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search here"
              className="w-full bg-transparent text-[14px] text-white outline-none placeholder:text-white"
            />
            <button type="button" aria-label="Filters" className="shrink-0">
              <SlidersHorizontal className="h-6 w-6" strokeWidth={2} />
            </button>
          </div>
        </div>

        {search.trim() ? (
          <div className="bg-black/90">
            {results.length ? (
              results.map((r) => (
                <button
                  key={`${r.section}-${r.title}`}
                  onClick={() => {
                    onNavigate(r.section);
                    setSearch("");
                  }}
                  className="flex w-full items-center justify-between gap-3 border-b border-white/10 px-6 py-3 text-left last:border-0 hover:bg-white/5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-white/60">{r.detail}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-white/50" />
                </button>
              ))
            ) : (
              <p className="px-6 py-4 text-sm text-white/70">
                No results for “{search.trim()}”.
              </p>
            )}
          </div>
        ) : null}
      </header>

      {/* Showroom photograph */}
      <img
        src={showroomHero}
        alt="Kessick showroom wine display"
        className="aspect-[9/4] w-full rounded-[10px] object-cover"
      />

      {/* Your Dealer Toolkit */}
      <section className="pt-1">
        <h2 className="font-heading text-[18px] font-bold leading-tight tracking-[0.01em] text-[#222]">
          Your Dealer Toolkit
        </h2>
        <p className="text-[9.5px] italic text-[#222]">
          News, design support, sales resources, and a direct line to our team.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {toolkit.map(({ label, icon: Icon, section }) => (
            <button
              key={label}
              onClick={() => onNavigate(section)}
              className="group flex min-w-0 flex-col items-center gap-1.5 text-center"
            >
              <span
                className="flex h-[clamp(3.25rem,15vw,3.9rem)] w-[clamp(3.25rem,15vw,3.9rem)] items-center justify-center rounded-full text-[#c9c9c9] transition group-hover:-translate-y-0.5"
                style={{
                  background:
                    "linear-gradient(90deg,#000 0%,#0d0b08 45%,#6f6656 80%,#b9b09c 100%)",
                }}
              >
                <Icon className="h-[60%] w-[60%]" />
              </span>
              <span className="font-label text-[11px] leading-[1.1] text-[#555]">
                {label === "Design Request Form" ? (
                  <>Design<br />Request Form</>
                ) : label === "Dealer Resources" ? (
                  <>Dealer<br />Resources</>
                ) : (
                  label
                )}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Steel-blue voucher bar */}
      <button
        onClick={() => onNavigate("Announcements")}
        className="flex w-full items-center gap-3 rounded-[10px] bg-[#8ea8bf] px-3.5 py-2 text-left"
      >
        <TicketPercent className="h-9 w-9 shrink-0 text-white" fill="currentColor" stroke="#8ea8bf" strokeWidth={1.6} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="font-heading block text-[15px] font-bold text-[#1b1b1b]">
            Get a 15% Discount Voucher
          </span>
          <span className="font-heading block whitespace-nowrap text-[9.5px] italic text-[#1b1b1b]">
            on all Somm projects through Nov 30, 2026
          </span>
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#2b3a67]">
          <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
        </span>
      </button>

      {/* Coming Soon: Estate Series Cask Collection */}
      <section
        className="flex gap-3 rounded-[10px] p-2"
        style={{ background: "linear-gradient(180deg,#000 0%,#000 40%,#5e5748 78%,#a59d8c 100%)" }}
      >
        <img
          src={estateCraftsman}
          alt="Kessick craftsman building an Estate Series rack"
          className="aspect-[10/9] w-[42%] shrink-0 rounded-[8px] object-cover"
        />
        <div className="relative min-w-0 flex-1 py-1 pr-1 text-white">
          <Bookmark className="absolute right-1 top-1 h-6 w-6" strokeWidth={1.6} />
          <p className="text-[16px] font-bold">Coming Soon</p>
          <p className="mt-5 text-[12.5px] font-bold">ESTATE SERIES</p>
          <p className="font-label mt-0.5 rounded-full bg-white px-2 py-[1px] text-[13px] text-[#333]">
            Cask Collection
          </p>
          <div className="mt-5 flex items-end justify-between gap-2">
            <p className="leading-tight">
              <span className="block text-[10px] font-bold">Be first to quote it.</span>
              <span className="block text-[10px] italic">Click to get launch details</span>
            </p>
            <button
              onClick={() => onNavigate("Announcements")}
              aria-label="Get launch details"
              className="flex shrink-0 items-center rounded-full bg-[#b9ab97] py-0.5 pl-1.5 text-[6px] font-bold uppercase leading-[1.05] text-white"
            >
              Click
              <br />
              here
              <span className="ml-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-[#3a5fae] bg-[#7fa0d8]">
                <MousePointerClick className="h-2.5 w-2.5" />
              </span>
            </button>
          </div>
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
    <div className="dealer-preview-surface min-h-screen pb-28 text-[#1b1b19]">
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

      </div>

      {/* Sticky footer navigation, matching the mockup */}
      <nav
        aria-label="Dealer portal navigation"
        className="dealer-preview-surface dealer-mockup fixed inset-x-0 bottom-0 z-40"
      >
        <div className="mx-auto grid max-w-[460px] grid-cols-4 items-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:max-w-[520px]">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const active =
              item.kind === "section" && section === item.section;
            const content = active ? (
              <span
                className="flex h-[38px] items-center gap-1.5 rounded-full py-[3px] pl-[3px] pr-3.5 text-white"
                style={{ background: "linear-gradient(180deg,#000 0%,#000 45%,#6e6553 100%)" }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-bold">{item.label}</span>
              </span>
            ) : (
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#1d1d1d] text-white transition group-hover:-translate-y-0.5">
                <Icon className="h-[22px] w-[22px]" />
              </span>
            );
            const classes = "group flex min-h-12 items-center justify-center";
            if (item.kind === "link") {
              const external = item.href.startsWith("http");
              return (
                <a
                  key={item.label}
                  href={item.href}
                  target={external ? "_blank" : undefined}
                  rel={external ? "noopener noreferrer" : undefined}
                  aria-label={item.label}
                  className={classes}
                >
                  {content}
                </a>
              );
            }
            return (
              <button
                key={item.label}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                onClick={() => navigate(item.section)}
                className={classes}
              >
                {content}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
