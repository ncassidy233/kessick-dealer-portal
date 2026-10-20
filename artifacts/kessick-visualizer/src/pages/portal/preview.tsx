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
const KESSICK_EMAIL = "office@kessick.com";
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

/* ---- Announcements content (dealer portal outline) ---- */
type AnnouncementTab = "New Products" | "Coming Soon" | "New Policies";

const announcementGroups: {
  category: AnnouncementTab;
  items: { title: string; body: string; href?: string; cta?: string }[];
}[] = [
  {
    category: "New Products",
    items: [
      {
        title: "Forma Wine Enclosures",
        body: "A freestanding, furniture-grade wine enclosure in single, double or triple-door configurations. No dedicated cellar room required.",
        href: KESSICK_STYLES,
        cta: "View Forma",
      },
      {
        title: "Tower Series",
        body: "Arrives fully assembled and ready to install. Combine towers into a wine wall or a complete room.",
        href: KESSICK_STYLES,
        cta: "View Towers",
      },
      {
        title: "Our Styles",
        body: "Estate, Elevation, Forma, Towers and Wine As Art, as published on kessickwinecellars.com.",
        href: KESSICK_STYLES,
        cta: "Explore styles",
      },
    ],
  },
  {
    category: "Coming Soon",
    items: [
      {
        title: "Estate Series · Cask Collection",
        body: "Be first to quote it. Ask the Kessick team for launch details, finishes and lead times.",
      },
    ],
  },
  {
    category: "New Policies",
    items: [
      {
        title: "No new policies posted",
        body: "When Kessick publishes a dealer policy update it will appear here, and in Dealer Resources under Policies and Guides.",
      },
    ],
  },
];

/* Standing notices from the outline, shown above the announcement tabs. */
const portalNotices: { label?: string; text: string; section: Section }[] = [
  {
    label: "Special Announcement",
    text: "Dealer news from Kessick appears here.",
    section: "Announcements",
  },
  {
    text: "Subscribe now to receive our quarterly newsletter: The Kessick Cut List",
    section: "Support",
  },
  {
    text: "Earn project credits on your next build. Learn more",
    section: "Support",
  },
];

/* ---- Dealer Resources (dealer portal outline) ---- */
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
    note: "Project renders for your proposals and presentations.",
  },
  {
    title: "Policies and Guides",
    icon: BookOpen,
    restricted: true,
    note: "Dealer policies, ordering guides and warranty information.",
  },
  {
    title: "Installation & Spec Sheets",
    icon: FileText,
    restricted: true,
    note: "Installation instructions and technical specifications by series.",
  },
  {
    title: "Wood Stain Chart",
    icon: Palette,
    public: KESSICK_STYLES,
    note: "Wood species and stain finishes for every Kessick series.",
  },
  {
    title: "Brochures & Catalogs",
    icon: FolderOpen,
    public: KESSICK_SITE,
    note: "Current brochures and product catalogs to share with clients.",
  },
  {
    title: "Logos",
    icon: Download,
    restricted: true,
    note: "Approved Kessick logo files for co-branded materials.",
  },
  {
    title: "Marketing Materials",
    icon: Sparkles,
    restricted: true,
    note: "Showroom, social and print assets ready for your marketing.",
  },
  {
    title: "Direct Teamwork Access",
    icon: TeamworkIcon,
    public: TEAMWORK_SITE,
    note: "Collaborate with the Kessick team on active projects in Teamwork.",
  },
];

/* ---- Report an issue categories ---- */
const issueCategories = [
  "Product or specification question",
  "Order or delivery",
  "Design request help",
  "Installation",
  "Portal or website issue",
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

/* ---------------- Shared section styling (homepage look) ------------- */

const BRONZE_CIRCLE =
  "linear-gradient(90deg,#000 0%,#0d0b08 45%,#6f6656 80%,#b9b09c 100%)";
const BLACK_TO_TAUPE =
  "linear-gradient(180deg,#000 0%,#000 40%,#5e5748 78%,#a59d8c 100%)";

/** Photographic page header in the style of the home header. */
function PageHeader({
  title,
  tagline,
  onBack,
}: {
  title: string;
  tagline: string;
  onBack: () => void;
}) {
  return (
    <header className="relative isolate -mx-4 -mt-4 overflow-hidden text-white sm:-mx-6">
      <img
        src={cellarImage}
        alt=""
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-black/55" />
      <div className="px-6 pb-4 pt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/90 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" /> Home
        </button>
        <h1 className="mt-4 text-[23px] font-extrabold leading-[1.12]">
          {title}
        </h1>
        <p className="mt-1.5 text-[10.5px] italic leading-snug">{tagline}</p>
      </div>
    </header>
  );
}

/** Underlined tab row on the black search-band gradient. */
function TabBand<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly T[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="-mx-4 flex gap-5 overflow-x-auto bg-gradient-to-r from-black via-black/90 to-black/70 px-6 pt-2.5 text-[13px] text-white sm:-mx-6"
    >
      {tabs.map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={t === active}
          onClick={() => onChange(t)}
          className={`shrink-0 border-b-2 pb-2 font-semibold transition ${
            t === active ? "border-white" : "border-transparent text-white/60 hover:text-white"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function BronzeCircle({
  icon: Icon,
  size = "h-11 w-11",
}: {
  icon: IconType;
  size?: string;
}) {
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-[#d0d0d0]`}
      style={{ background: BRONZE_CIRCLE }}
    >
      <Icon className="h-[55%] w-[55%]" />
    </span>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="pt-1">
      <h2 className="font-heading text-[18px] font-bold leading-tight text-[#222]">
        {title}
      </h2>
      {sub ? <p className="text-[9.5px] italic text-[#222]">{sub}</p> : null}
    </div>
  );
}

/** Steel-blue bar, the voucher style from the home screen. */
function SteelBar({
  label,
  text,
  onClick,
  href,
}: {
  label?: string;
  text: string;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <span className="min-w-0 flex-1 text-[12px] leading-snug text-[#1b1b1b]">
        {label ? <strong className="font-heading">{label}: </strong> : null}
        {text}
      </span>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#2b3a67]">
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
    </>
  );
  const cls =
    "flex w-full items-center gap-3 rounded-[10px] bg-[#8ea8bf] px-3.5 py-2.5 text-left";
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** White row with a bronze circle icon, used for lists. */
function RowCard({
  icon,
  title,
  body,
  children,
}: {
  icon: IconType;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="flex gap-3 rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
      <BronzeCircle icon={icon} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[13.5px] font-bold text-[#1b1b1b]">{title}</h3>
        <p className="mt-0.5 text-[11.5px] leading-snug text-[#555]">{body}</p>
        {children ? <div className="mt-2 flex flex-wrap gap-2">{children}</div> : null}
      </div>
    </article>
  );
}

function PillLink({
  href,
  children,
  dark = true,
}: {
  href: string;
  children: React.ReactNode;
  dark?: boolean;
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold ${
        dark
          ? "bg-[#1d1d1d] text-white hover:bg-black"
          : "border border-[#1d1d1d]/25 text-[#1d1d1d] hover:border-[#1d1d1d]"
      }`}
    >
      {children}
    </a>
  );
}

function requestAccessHref(title: string) {
  return `mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent(
    `Dealer resource request: ${title}`,
  )}&body=${encodeURIComponent(
    `Hello Kessick team,\n\nPlease send me the "${title}" dealer resource.\n\nDealer / company:\nContact name:\n\nThank you.`,
  )}`;
}

/* ------------------------ Announcements ----------------------------- */

const ANNOUNCEMENT_TABS = ["New Products", "Coming Soon", "New Policies"] as const;

function Announcements({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate: (s: Section) => void;
}) {
  const [tab, setTab] = useState<AnnouncementTab>("New Products");
  const group = announcementGroups.find((g) => g.category === tab)!;
  return (
    <div className="space-y-3 pb-2">
      <div>
        <PageHeader
          title="Announcements"
          tagline="New products, upcoming collections, and policy updates from Kessick."
          onBack={onBack}
        />
        <TabBand<AnnouncementTab> tabs={ANNOUNCEMENT_TABS} active={tab} onChange={setTab} />
      </div>

      <div className="space-y-2 pt-1">
        {portalNotices.map((n) => (
          <SteelBar
            key={n.text}
            label={n.label}
            text={n.text}
            onClick={() => onNavigate(n.section)}
          />
        ))}
      </div>

      <SectionTitle title={tab} />

      {tab === "Coming Soon" ? (
        <section
          className="flex gap-3 rounded-[10px] p-2"
          style={{ background: BLACK_TO_TAUPE }}
        >
          <img
            src={estateCraftsman}
            alt="Kessick craftsman building an Estate Series rack"
            className="aspect-[10/9] w-[42%] shrink-0 rounded-[8px] object-cover"
          />
          <div className="min-w-0 flex-1 py-1 pr-1 text-white">
            <p className="text-[12.5px] font-bold">ESTATE SERIES</p>
            <p className="font-label mt-0.5 rounded-full bg-white px-2 py-[1px] text-[13px] text-[#333]">
              Cask Collection
            </p>
            <p className="mt-3 text-[11px] leading-snug text-white/85">
              {group.items[0].body}
            </p>
            <a
              href={`mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent("Cask Collection launch details")}`}
              className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-[#111]"
            >
              Get launch details <ChevronRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </section>
      ) : (
        <div className="space-y-2">
          {group.items.map((item) => (
            <RowCard
              key={item.title}
              icon={tab === "New Policies" ? BookOpen : StarIcon}
              title={item.title}
              body={item.body}
            >
              {item.href ? (
                <PillLink href={item.href}>
                  {item.cta ?? "Learn more"} <ArrowUpRight className="h-3 w-3" />
                </PillLink>
              ) : null}
            </RowCard>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------- Design Request ----------------------------- */

const DESIGN_TABS = ["Forma", "Towers"] as const;
type DesignTab = (typeof DESIGN_TABS)[number];

function DesignRequest({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<DesignTab>("Forma");
  const [form, setForm] = useState({
    project: "",
    client: "",
    location: "",
    configuration: "",
    finish: "",
    bottles: "",
    timeline: "",
    notes: "",
  });
  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const configOptions =
    tab === "Forma"
      ? ["Single door", "Double door", "Triple door", "Not sure yet"]
      : ["Single tower", "Wine wall (multiple towers)", "Full room", "Not sure yet"];

  const body = [
    `Design request: ${tab}`,
    "",
    `Project name: ${form.project}`,
    `Client: ${form.client}`,
    `Project location: ${form.location}`,
    `Configuration: ${form.configuration}`,
    `Wood / stain finish: ${form.finish}`,
    `Bottle capacity: ${form.bottles}`,
    `Timeline: ${form.timeline}`,
    "",
    `Notes: ${form.notes}`,
    "",
    "Please attach room dimensions, photos or drawings to this email.",
    "Sent from the Kessick dealer portal",
  ].join("\n");
  const mailto = `mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent(
    `${tab} design request${form.project ? `: ${form.project}` : ""}`,
  )}&body=${encodeURIComponent(body)}`;

  const field =
    "mt-1 w-full rounded-[8px] border border-[#1b1b1b]/15 bg-white px-3 py-2 text-[13px] text-[#1b1b1b] outline-none focus:border-[#8ea8bf]";
  const labelCls = "block text-[11px] font-bold text-[#333]";

  return (
    <div className="space-y-3 pb-2">
      <div>
        <PageHeader
          title="Design Request Form"
          tagline="Tell us about the space. Our design team will prepare a layout for your client."
          onBack={onBack}
        />
        <TabBand<DesignTab> tabs={DESIGN_TABS} active={tab} onChange={setTab} />
      </div>

      <section
        className="flex items-center gap-3 rounded-[10px] p-3 text-white"
        style={{ background: BLACK_TO_TAUPE }}
      >
        <BronzeCircle icon={StarIcon} size="h-12 w-12" />
        <div className="min-w-0">
          <p className="text-[15px] font-bold">{tab}</p>
          <p className="text-[11px] italic text-white/85">
            {tab === "Forma"
              ? "Freestanding, furniture-grade enclosures in single, double or triple-door."
              : "Fully assembled towers that combine into wine walls and rooms."}
          </p>
        </div>
      </section>

      <SectionTitle title="Project details" sub="Every field helps our designers get it right the first time." />

      <form
        className="space-y-3 rounded-[10px] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = mailto;
        }}
      >
        <label className={labelCls}>
          Project name
          <input className={field} value={form.project} onChange={set("project")} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Client
            <input className={field} value={form.client} onChange={set("client")} />
          </label>
          <label className={labelCls}>
            City, state
            <input className={field} value={form.location} onChange={set("location")} />
          </label>
        </div>
        <label className={labelCls}>
          Configuration
          <select className={field} value={form.configuration} onChange={set("configuration")}>
            <option value="">Choose one</option>
            {configOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelCls}>
            Wood / stain
            <input className={field} value={form.finish} onChange={set("finish")} placeholder="See Wood Stain Chart" />
          </label>
          <label className={labelCls}>
            Bottle capacity
            <input className={field} value={form.bottles} onChange={set("bottles")} inputMode="numeric" />
          </label>
        </div>
        <label className={labelCls}>
          Timeline
          <input className={field} value={form.timeline} onChange={set("timeline")} placeholder="e.g. install by March" />
        </label>
        <label className={labelCls}>
          Notes
          <textarea className={field} rows={3} value={form.notes} onChange={set("notes")} />
        </label>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-bold text-white"
          style={{ background: "linear-gradient(180deg,#000 0%,#000 45%,#6e6553 100%)" }}
        >
          <EnvelopeIcon className="h-4 w-4" /> Email {tab} request to Kessick
        </button>
        <p className="text-[10.5px] italic text-[#555]">
          Opens your email with these details filled in. Attach room dimensions,
          photos or drawings before sending.
        </p>
      </form>
    </div>
  );
}

/* -------------------------- Resources ------------------------------- */

function Resources({ onBack }: { onBack: () => void }) {
  return (
    <div className="space-y-3 pb-2">
      <PageHeader
        title="Dealer Resources"
        tagline="Renders, guides, spec sheets, finishes and marketing assets to sell, specify, and deliver."
        onBack={onBack}
      />

      <div className="grid grid-cols-4 gap-2 pt-1">
        {resources.slice(0, 4).map((r) => (
          <a
            key={r.title}
            href={`#res-${r.title.replace(/\W+/g, "-")}`}
            className="flex min-w-0 flex-col items-center gap-1.5 text-center"
          >
            <BronzeCircle icon={r.icon} size="h-[clamp(3.25rem,15vw,3.9rem)] w-[clamp(3.25rem,15vw,3.9rem)]" />
            <span className="font-label text-[10.5px] leading-[1.1] text-[#555]">{r.title}</span>
          </a>
        ))}
      </div>

      <SectionTitle title="All resources" sub="Open what's public, or request files from the Kessick team." />

      <div className="space-y-2">
        {resources.map((r) => (
          <div key={r.title} id={`res-${r.title.replace(/\W+/g, "-")}`}>
            <RowCard icon={r.icon} title={r.title} body={r.note}>
              {r.public ? (
                <PillLink href={r.public}>
                  Open <ArrowUpRight className="h-3 w-3" />
                </PillLink>
              ) : null}
              {r.restricted ? (
                <PillLink href={requestAccessHref(r.title)} dark={false}>
                  Request files <ChevronRight className="h-3 w-3" />
                </PillLink>
              ) : null}
            </RowCard>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------- Report an Issue ----------------------------- */

function Support({ onBack }: { onBack: () => void }) {
  const [category, setCategory] = useState(issueCategories[0]);
  const [message, setMessage] = useState("");

  const mailtoHref = `mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent(
    `Dealer portal feedback: ${category}`,
  )}&body=${encodeURIComponent(
    `Category: ${category}\n\n${message}\n\nSent from the Kessick dealer portal`,
  )}`;
  const field =
    "mt-1 w-full rounded-[8px] border border-[#1b1b1b]/15 bg-white px-3 py-2 text-[13px] text-[#1b1b1b] outline-none focus:border-[#8ea8bf]";

  return (
    <div className="space-y-3 pb-2">
      <PageHeader
        title="Report an Issue"
        tagline="Feedback, questions, or something not right? A direct line to our team."
        onBack={onBack}
      />

      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          { label: "Feedback Form", icon: ChatIcon, href: "#feedback-form" },
          { label: "Email Us", icon: EnvelopeIcon, href: `mailto:${KESSICK_EMAIL}` },
          { label: "Call Now", icon: Phone as IconType, href: `tel:${KESSICK_PHONE_TEL}` },
        ].map((a) => (
          <a key={a.label} href={a.href} className="flex flex-col items-center gap-1.5 text-center">
            <BronzeCircle icon={a.icon} size="h-[clamp(3.25rem,15vw,3.9rem)] w-[clamp(3.25rem,15vw,3.9rem)]" />
            <span className="font-label text-[11px] text-[#555]">{a.label}</span>
          </a>
        ))}
      </div>

      <SectionTitle title="Feedback Form" sub="Choose a topic and tell us what's happening." />

      <form
        id="feedback-form"
        className="space-y-3 rounded-[10px] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
        onSubmit={(e) => {
          e.preventDefault();
          window.location.href = mailtoHref;
        }}
      >
        <label className="block text-[11px] font-bold text-[#333]">
          Topic
          <select className={field} value={category} onChange={(e) => setCategory(e.target.value)}>
            {issueCategories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="block text-[11px] font-bold text-[#333]">
          Details
          <textarea
            className={field}
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Order number, series, and what you're seeing"
          />
        </label>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-full py-2.5 text-[13px] font-bold text-white"
          style={{ background: "linear-gradient(180deg,#000 0%,#000 45%,#6e6553 100%)" }}
        >
          <EnvelopeIcon className="h-4 w-4" /> Send feedback
        </button>
      </form>

      <SteelBar label="Email" text={KESSICK_EMAIL} href={`mailto:${KESSICK_EMAIL}`} />
      <SteelBar label="Call now" text={KESSICK_PHONE_DISPLAY} href={`tel:${KESSICK_PHONE_TEL}`} />
    </div>
  );
}

/* --------------------------- Account -------------------------------- */

function Account({
  onBack,
  onNavigate,
}: {
  onBack: () => void;
  onNavigate: (s: Section) => void;
}) {
  return (
    <div className="space-y-3 pb-2">
      <header className="relative isolate -mx-4 -mt-4 overflow-hidden text-white sm:-mx-6">
        <img src={cellarImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-black/55" />
        <div className="px-6 pb-5 pt-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-white/90 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> Home
          </button>
          <div className="mt-4 flex items-center gap-3">
            <img
              src={dealerAvatar}
              alt=""
              className="h-16 w-16 rounded-full border-2 border-white object-cover"
            />
            <div className="min-w-0 leading-tight">
              <h1 className="text-[18px] font-extrabold">Authorized Dealer Name</h1>
              <p className="text-[12px]">123 Anywhere St., Any City</p>
              <p className="mt-1 text-[10.5px] italic text-white/80">Dealer Account Page</p>
            </div>
          </div>
        </div>
      </header>

      <SectionTitle title="Your account" sub="Profile, projects, and your line to the Kessick team." />

      <div className="space-y-2">
        <RowCard icon={PersonIcon} title="Dealer profile" body="Company details, showroom address and primary contact.">
          <PillLink href={`mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent("Dealer profile update")}`} dark={false}>
            Request an update <ChevronRight className="h-3 w-3" />
          </PillLink>
        </RowCard>
        <RowCard icon={TeamworkIcon} title="Teamwork Account" body="Your active Kessick projects, files and conversations.">
          <PillLink href={TEAMWORK_SITE}>
            Open Teamwork <ArrowUpRight className="h-3 w-3" />
          </PillLink>
        </RowCard>
        <RowCard icon={EnvelopeIcon} title="Email the Kessick team" body={KESSICK_EMAIL}>
          <PillLink href={`mailto:${KESSICK_EMAIL}`}>
            Email <ChevronRight className="h-3 w-3" />
          </PillLink>
        </RowCard>
      </div>

      <SteelBar text="Report an issue or send feedback" onClick={() => onNavigate("Support")} />
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
      <div className="dealer-mockup mx-auto w-full max-w-[460px] px-4 pt-4 sm:max-w-[520px] sm:px-6">
        {section === "Home" ? (
          <Home
            search={search}
            setSearch={setSearch}
            results={results}
            onNavigate={navigate}
          />
        ) : section === "Announcements" ? (
          <Announcements onBack={() => navigate("Home")} onNavigate={navigate} />
        ) : section === "DesignRequest" ? (
          <DesignRequest onBack={() => navigate("Home")} />
        ) : section === "Resources" ? (
          <Resources onBack={() => navigate("Home")} />
        ) : section === "Support" ? (
          <Support onBack={() => navigate("Home")} />
        ) : (
          <Account onBack={() => navigate("Home")} onNavigate={navigate} />
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
