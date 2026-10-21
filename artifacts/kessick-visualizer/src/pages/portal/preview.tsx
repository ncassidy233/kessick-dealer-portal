import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Copy,
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
  X,
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
  | { kind: "link"; label: string; icon: IconType; href: string }
  | { kind: "email"; label: string; icon: IconType };

const bottomNav: NavItem[] = [
  { kind: "section", label: "Home", icon: HomeIcon, section: "Home" },
  { kind: "section", label: "Account", icon: PersonIcon, section: "Account" },
  { kind: "email", label: "Email", icon: EnvelopeIcon },
  { kind: "link", label: "Teamwork", icon: TeamworkIcon, href: TEAMWORK_SITE },
];

/* ---------------------- Routing, focus and feedback ------------------ */

/* Hash routes so the browser Back button, refresh and shared links work. */
const SECTION_SLUGS: Record<Section, string> = {
  Home: "",
  Announcements: "announcements",
  DesignRequest: "design-request",
  Resources: "resources",
  Support: "support",
  Account: "account",
};

const SECTION_TITLES: Record<Section, string> = {
  Home: "Home",
  Announcements: "Announcements",
  DesignRequest: "Design Request Form",
  Resources: "Dealer Resources",
  Support: "Report an Issue",
  Account: "Account",
};

type Route = { section: Section; sub?: string };

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function parseHash(hash: string): Route {
  const [slug = "", sub] = hash.replace(/^#\/?/, "").split("/");
  const section = (Object.keys(SECTION_SLUGS) as Section[]).find(
    (s) => SECTION_SLUGS[s] === slug,
  );
  return { section: section ?? "Home", sub: sub || undefined };
}

function routeHash({ section, sub }: Route) {
  const slug = SECTION_SLUGS[section];
  return `#/${slug}${slug && sub ? `/${sub}` : ""}`;
}

function useHashRoute() {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  /** Pushes a history entry, so Back returns to the previous page. */
  const go = (next: Route) => {
    if (routeHash(next) === routeHash(route)) return;
    window.location.hash = routeHash(next);
  };
  /** Swaps the current entry, for tab changes inside a page. */
  const replace = (next: Route) => {
    try {
      window.history.replaceState(null, "", routeHash(next));
    } catch {
      // Some embedded viewers block history writes; state still updates.
    }
    setRoute(next);
  };
  return { route, go, replace };
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Scrolls an element into view, focuses it and briefly highlights it. */
function revealElement(id: string, focusSelector?: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
  const target = (focusSelector ? el.querySelector<HTMLElement>(focusSelector) : null) ?? el;
  target.focus({ preventScroll: true });
  el.classList.remove("flash-highlight");
  void el.offsetWidth;
  el.classList.add("flash-highlight");
}

/** Small status messages, announced to screen readers. */
function notify(message: string) {
  window.dispatchEvent(new CustomEvent("kessick-toast", { detail: message }));
}

function Toast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMessage(null), 3200);
    };
    window.addEventListener("kessick-toast", onToast);
    return () => {
      window.removeEventListener("kessick-toast", onToast);
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div role="status" aria-live="polite" className="dealer-mockup">
      {message ? (
        <div className="toast-in fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-full bg-[#1d1d1d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          <CircleCheck className="h-4 w-4 shrink-0 text-[#8ea8bf]" aria-hidden="true" />
          {message}
        </div>
      ) : null}
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

/** Form state that survives a refresh or an accidental tap away. */
function useDraft<T extends Record<string, string>>(key: string, initial: T) {
  const storageKey = `kessick-portal:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved ? { ...initial, ...JSON.parse(saved) } : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Storage can be unavailable (private mode); the form still works.
    }
  }, [storageKey, value]);
  const reset = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setValue(initial);
  };
  return [value, setValue, reset] as const;
}

const NEW_TAB_HINT = <span className="sr-only"> (opens in a new tab)</span>;

/**
 * Opens a mailto: or tel: link without navigating the portal itself away.
 * Inside an embedded viewer (iframe) a same-frame mailto replaces the page
 * with a blank screen, so it goes to a new window there instead. If nothing
 * can open, the address is copied so the dealer is never left stuck.
 */
function openContactLink(href: string) {
  let embedded = false;
  try {
    embedded = window.self !== window.top;
  } catch {
    embedded = true;
  }
  if (!embedded) {
    window.location.href = href;
    return;
  }
  let opened: Window | null = null;
  try {
    opened = window.open(href, "_blank");
    if (opened) opened.opener = null;
  } catch {
    opened = null;
  }
  if (opened) return;
  // The viewer blocked the new window: hand over the address instead.
  const value = decodeURIComponent(href.replace(/^(mailto|tel):/i, "").split("?")[0]);
  void copyText(value).then((ok) =>
    notify(ok ? `${value} copied. Paste it into your email or phone app.` : `Contact us at ${value}`),
  );
}

/**
 * Keeps the portal on screen when a link points outside it. mailto:/tel:
 * go through openContactLink; web links ask first, then open in a new tab,
 * so the dealer can always come back to where they were.
 */
function useLinkGuard(onExternal: (link: { url: string; label: string }) => void) {
  const handler = useRef(onExternal);
  handler.current = onExternal;
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      const href = a?.getAttribute("href") ?? "";
      if (/^(mailto|tel):/i.test(href)) {
        e.preventDefault();
        openContactLink(href);
      } else if (/^https?:/i.test(href)) {
        e.preventDefault();
        const label =
          a?.getAttribute("data-site") ??
          (a?.getAttribute("aria-label") ?? a?.textContent ?? "")
            .replace(/\(opens in a new tab\)/, "")
            .trim();
        handler.current({ url: href, label });
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}

/** Opens a web page in a new tab; copies the link if the viewer blocks it. */
function openInNewTab(url: string) {
  let opened: Window | null = null;
  try {
    opened = window.open(url, "_blank");
    if (opened) opened.opener = null;
  } catch {
    opened = null;
  }
  if (opened) return true;
  void copyText(url).then((ok) =>
    notify(ok ? "Link copied. Paste it into your browser." : `Open ${url} in your browser`),
  );
  return false;
}

/** Focus trap, Escape to close, and focus return for bottom sheets. */
function useSheetFocus(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const items = Array.from(ref.current.querySelectorAll<HTMLElement>("button, a"));
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [ref, onClose]);
}

const SHEET_ROW =
  "flex min-h-12 w-full items-center gap-3 rounded-[10px] px-3 text-left text-[14px] font-semibold text-[#1b1b1b] hover:bg-[#eef0fb]";

function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** Receives close(after?): closes the sheet, then runs `after`. */
  children: (close: (after?: () => void) => void) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushed = useRef(false);
  const afterClose = useRef<(() => void) | undefined>(undefined);

  // The sheet gets its own history entry, so the phone's Back button closes
  // it instead of leaving the page.
  useEffect(() => {
    try {
      window.history.pushState({ kessickSheet: true }, "");
      pushed.current = true;
    } catch {
      pushed.current = false;
    }
    const onPop = () => {
      pushed.current = false;
      onCloseRef.current();
      const after = afterClose.current;
      afterClose.current = undefined;
      after?.();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const close = useCallback((after?: () => void) => {
    if (pushed.current) {
      afterClose.current = after;
      window.history.back();
    } else {
      onCloseRef.current();
      after?.();
    }
  }, []);
  const dismiss = useCallback(() => close(), [close]);
  useSheetFocus(ref, dismiss);
  return (
    <div className="dealer-mockup fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={dismiss}
        className="absolute inset-0 bg-black/40"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="toast-sheet absolute inset-x-0 bottom-0 mx-auto max-w-[520px] rounded-t-[18px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#1b1b1b]/15" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 id="sheet-title" className="font-heading text-[17px] font-bold text-[#1b1b1b]">
              {title}
            </h2>
            {subtitle ? <p className="break-words text-[13px] text-[#555]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="tap-target rounded-full p-1 text-[#1b1b1b]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-3 space-y-1">{children(close)}</div>
      </div>
    </div>
  );
}

const SITE_NAMES: Record<string, string> = {
  "teamwork.com": "Teamwork",
  "kessickwinecellars.com": "Kessick Wine Cellars",
};

/** Asked before leaving for another site, so the portal stays put. */
function LeaveSheet({ url, onClose }: { url: string; onClose: () => void }) {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep the raw url
  }
  const name = SITE_NAMES[host] ?? host;
  return (
    <Sheet
      title={`Open ${name}`}
      subtitle={`${name} opens in a new tab. This portal stays open right where you left it.`}
      onClose={onClose}
    >
      {(close) => (
        <>
          <button
            type="button"
            className={SHEET_ROW}
            onClick={() => {
              // Open first: popups must start from the tap itself.
              openInNewTab(url);
              close();
            }}
          >
            <BronzeCircle icon={ArrowUpRight as IconType} size="h-9 w-9" /> Open {name} in a new tab
          </button>
          <button
            type="button"
            className={SHEET_ROW}
            onClick={async () => {
              notify((await copyText(url)) ? "Link copied" : `Open ${url} in your browser`);
              close();
            }}
          >
            <BronzeCircle icon={Copy} size="h-9 w-9" /> Copy link
          </button>
          <button type="button" className={SHEET_ROW} onClick={() => close()}>
            <BronzeCircle icon={ChevronLeft as IconType} size="h-9 w-9" /> Stay in the portal
          </button>
        </>
      )}
    </Sheet>
  );
}

function EmailSheet({ onClose, onFeedback }: { onClose: () => void; onFeedback: () => void }) {
  return (
    <Sheet title="Email the Kessick team" subtitle={KESSICK_EMAIL} onClose={onClose}>
      {(close) => (
        <>
          <button
            type="button"
            className={SHEET_ROW}
            onClick={() => {
              openContactLink(`mailto:${KESSICK_EMAIL}`);
              close();
            }}
          >
            <BronzeCircle icon={EnvelopeIcon} size="h-9 w-9" /> Open my email app
          </button>
          <button
            type="button"
            className={SHEET_ROW}
            onClick={async () => {
              notify((await copyText(KESSICK_EMAIL)) ? "Email address copied" : `Contact us at ${KESSICK_EMAIL}`);
              close();
            }}
          >
            <BronzeCircle icon={Copy} size="h-9 w-9" /> Copy email address
          </button>
          <button type="button" className={SHEET_ROW} onClick={() => close(onFeedback)}>
            <BronzeCircle icon={ChatIcon} size="h-9 w-9" /> Write to us from the portal
          </button>
        </>
      )}
    </Sheet>
  );
}

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

const SEARCH_CATEGORIES = ["Announcements", "Design", "Resources", "Support"] as const;
type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

type SearchHit = {
  title: string;
  detail: string;
  section: Section;
  /** Tab or resource to open on arrival. */
  sub?: string;
  category: SearchCategory;
  /** Extra words that should match but are not shown. */
  keywords?: string;
};

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
  filter,
  setFilter,
  results,
  onNavigate,
  onOpenHit,
}: {
  search: string;
  setSearch: (v: string) => void;
  filter: SearchCategory | null;
  setFilter: (v: SearchCategory | null) => void;
  results: SearchHit[];
  onNavigate: (route: Route) => void;
  onOpenHit: (hit: SearchHit) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(filter !== null);
  const showResults = Boolean(search.trim() || filter);
  const resultLabel = results.length
    ? `${results.length} result${results.length === 1 ? "" : "s"}`
    : "No results";

  return (
    <div className="space-y-2.5 pb-2">
      {/* Photographic header with dealer identity, title and search */}
      <header className="relative isolate -mx-4 -mt-4 overflow-hidden text-white sm:-mx-6">
        <img
          src={cellarImage}
          alt=""
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-black/45" />
        <div className="px-6 pt-5">
          <div className="flex items-start justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={dealerAvatar}
                alt=""
                width={42}
                height={42}
                className="h-[42px] w-[42px] shrink-0 rounded-full border-2 border-white object-cover"
              />
              <div className="min-w-0 leading-tight">
                <p className="truncate text-[13px] font-bold">Authorized Dealer Name</p>
                <p className="truncate text-[12px]">123 Anywhere St., Any City</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate({ section: "Announcements" })}
              aria-label="Announcements"
              className="tap-target mt-1 rounded-full text-white"
            >
              <Bell className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true" />
            </button>
          </div>

          <h1
            data-page-title
            tabIndex={-1}
            className="mt-5 text-[23px] font-extrabold leading-[1.12]"
          >
            Your Kessick
            <br />
            project desk.
          </h1>
          <p className="mt-1.5 pb-3 text-[11px] leading-snug">
            <em>Pricing, specs, finish options, and marketing assets in one place.</em>
            <br />
            Everything you need to sell, specify, and deliver.
          </p>
        </div>

        {/* Search band: black fading to the photo, underlined field */}
        <form
          role="search"
          className="bg-gradient-to-r from-black via-black/85 to-black/30 px-6 pb-2.5 pt-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <div className="flex items-center gap-3 border-b-2 border-white/85 pb-1 focus-within:border-white">
            <Search className="h-6 w-6 shrink-0" strokeWidth={2.2} aria-hidden="true" />
            <label htmlFor="dealer-search" className="sr-only">
              Search the dealer portal
            </label>
            <input
              id="dealer-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // Handled here, not via form submit, which sandboxed viewers block.
                  e.preventDefault();
                  if (results[0]) onOpenHit(results[0]);
                }
                if (e.key === "Escape") {
                  setSearch("");
                  setFilter(null);
                }
              }}
              placeholder="Search here"
              autoComplete="off"
              enterKeyHint="search"
              aria-controls="dealer-search-results"
              className="min-h-9 w-full bg-transparent text-[16px] text-white outline-none placeholder:text-white focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="tap-target shrink-0 rounded-full"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Filter search"
              aria-expanded={filtersOpen}
              aria-controls="dealer-search-filters"
              onClick={() => {
                if (filtersOpen) setFilter(null);
                setFiltersOpen(!filtersOpen);
              }}
              className="tap-target shrink-0 rounded-full"
            >
              <SlidersHorizontal className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          {filtersOpen ? (
            <div
              id="dealer-search-filters"
              role="group"
              aria-label="Search filters"
              className="flex gap-2 overflow-x-auto pt-2.5 [scrollbar-width:none]"
            >
              {SEARCH_CATEGORIES.map((c) => {
                const on = filter === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(on ? null : c)}
                    className={`min-h-8 shrink-0 rounded-full border px-3 text-[12px] font-semibold transition ${
                      on
                        ? "border-white bg-white text-black"
                        : "border-white/50 text-white hover:border-white"
                    }`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          ) : null}
        </form>

        <div id="dealer-search-results">
          <p className="sr-only" aria-live="polite">
            {showResults ? resultLabel : ""}
          </p>
          {showResults ? (
            <div className="bg-black/90">
              {results.length ? (
                <ul>
                  {results.map((r) => (
                    <li key={`${r.section}-${r.sub ?? ""}-${r.title}`}>
                      <button
                        type="button"
                        onClick={() => onOpenHit(r)}
                        className="flex min-h-12 w-full items-center justify-between gap-3 border-b border-white/10 px-6 py-3 text-left hover:bg-white/5 focus-visible:-outline-offset-4"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold">{r.title}</span>
                          <span className="mt-0.5 block truncate text-xs text-white/70">{r.detail}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-white/60" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-6 py-4 text-sm text-white/80">
                  <p>
                    No results{search.trim() ? <> for “{search.trim()}”</> : null}
                    {filter ? <> in {filter}</> : null}.
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    Try “Forma”, “spec sheets” or “stain”, or{" "}
                    <a
                      href={`mailto:${KESSICK_EMAIL}`}
                      className="font-semibold text-white underline underline-offset-2"
                    >
                      email the Kessick team
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      {/* Showroom photograph */}
      <img
        src={showroomHero}
        alt="Kessick showroom wine display"
        width={900}
        height={400}
        decoding="async"
        className="aspect-[9/4] h-auto w-full rounded-[10px] bg-[#d9d6cf] object-cover"
      />

      {/* Your Dealer Toolkit */}
      <section className="pt-1" aria-labelledby="toolkit-heading">
        <h2
          id="toolkit-heading"
          className="font-heading text-[18px] font-bold leading-tight tracking-[0.01em] text-[#222]"
        >
          Your Dealer Toolkit
        </h2>
        <p className="text-[11px] italic text-[#333]">
          News, design support, sales resources, and a direct line to our team.
        </p>
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {toolkit.map(({ label, icon: Icon, section }) => (
            <li key={label} className="min-w-0">
              <button
                type="button"
                onClick={() => onNavigate({ section })}
                className="group flex w-full min-w-0 flex-col items-center gap-1.5 rounded-[10px] py-0.5 text-center"
              >
                <span
                  className="flex h-[clamp(3.25rem,15vw,3.9rem)] w-[clamp(3.25rem,15vw,3.9rem)] items-center justify-center rounded-full text-[#c9c9c9] transition motion-safe:group-hover:-translate-y-0.5 group-active:scale-95"
                  style={{ background: BRONZE_CIRCLE }}
                >
                  <Icon className="h-[60%] w-[60%]" />
                </span>
                <span className="font-label text-[11px] leading-[1.1] text-[#444]">
                  {label === "Design Request Form" ? (
                    <>Design<br />Request Form</>
                  ) : label === "Dealer Resources" ? (
                    <>Dealer<br />Resources</>
                  ) : (
                    label
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Steel-blue voucher bar */}
      <a
        href={`mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent("15% Somm project voucher")}&body=${encodeURIComponent(
          "Hello Kessick team,\n\nPlease send me the 15% discount voucher for Somm projects (valid through Nov 30, 2026).\n\nDealer / company:\nProject:\n\nThank you.",
        )}`}
        className="flex w-full items-center gap-3 rounded-[10px] bg-[#8ea8bf] px-3.5 py-2 text-left transition active:brightness-95"
      >
        <TicketPercent className="h-9 w-9 shrink-0 text-white" fill="currentColor" stroke="#8ea8bf" strokeWidth={1.6} aria-hidden="true" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="font-heading block text-[15px] font-bold text-[#1b1b1b]">
            Get a 15% Discount Voucher
          </span>
          <span className="font-heading block text-[11px] italic text-[#1b1b1b]">
            on all Somm projects through Nov 30, 2026
          </span>
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#2b3a67]">
          <ChevronRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
        </span>
      </a>

      {/* Coming Soon: Estate Series Cask Collection */}
      <section
        aria-labelledby="coming-soon-heading"
        className="flex gap-3 rounded-[10px] p-2"
        style={{ background: BLACK_TO_TAUPE }}
      >
        <img
          src={estateCraftsman}
          alt="Kessick craftsman building an Estate Series rack"
          width={330}
          height={297}
          loading="lazy"
          decoding="async"
          className="aspect-[10/9] h-auto w-[42%] shrink-0 rounded-[8px] object-cover"
        />
        <div className="relative min-w-0 flex-1 py-1 pr-1 text-white">
          <Bookmark className="absolute right-1 top-1 h-6 w-6" strokeWidth={1.6} aria-hidden="true" />
          <h2 id="coming-soon-heading" className="text-[16px] font-bold">Coming Soon</h2>
          <p className="mt-5 text-[12.5px] font-bold">ESTATE SERIES</p>
          <p className="font-label mt-0.5 rounded-full bg-white px-2 py-[1px] text-[13px] text-[#333]">
            Cask Collection
          </p>
          <div className="mt-5 flex items-end justify-between gap-2">
            <p className="leading-tight">
              <span className="block text-[11px] font-bold">Be first to quote it.</span>
              <span className="block text-[11px] italic">Click to get launch details</span>
            </p>
            <button
              type="button"
              onClick={() => onNavigate({ section: "Announcements", sub: slugify("Coming Soon") })}
              aria-label="Get Cask Collection launch details"
              className="tap-target flex shrink-0 items-center rounded-full bg-[#b9ab97] py-0.5 pl-1.5 text-[7px] font-bold uppercase leading-[1.05] text-white"
            >
              <span aria-hidden="true">
                Click
                <br />
                here
              </span>
              <span className="ml-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-[#3a5fae] bg-[#7fa0d8]">
                <MousePointerClick className="h-2.5 w-2.5" aria-hidden="true" />
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
        decoding="async"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-black/55" />
      <div className="px-6 pb-4 pt-3">
        <BackButton onBack={onBack} />
        <h1
          data-page-title
          tabIndex={-1}
          className="mt-3 text-[23px] font-extrabold leading-[1.12]"
        >
          {title}
        </h1>
        <p className="mt-1.5 text-[11px] italic leading-snug">{tagline}</p>
      </div>
    </header>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[12px] font-semibold text-white/90 hover:text-white"
    >
      <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Home
    </button>
  );
}

/** Underlined tab row on the black search-band gradient (WAI-ARIA tabs). */
function TabBand<T extends string>({
  id,
  label,
  tabs,
  active,
  onChange,
}: {
  id: string;
  label: string;
  tabs: readonly T[];
  active: T;
  onChange: (t: T) => void;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (index: number) => {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next]);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-4 flex gap-5 overflow-x-auto bg-gradient-to-r from-black via-black/90 to-black/70 px-6 pt-1 text-[13px] text-white [scrollbar-width:none] sm:-mx-6"
      onKeyDown={(e) => {
        const i = tabs.indexOf(active);
        if (e.key === "ArrowRight") move(i + 1);
        else if (e.key === "ArrowLeft") move(i - 1);
        else if (e.key === "Home") move(0);
        else if (e.key === "End") move(tabs.length - 1);
        else return;
        e.preventDefault();
      }}
    >
      {tabs.map((t, i) => {
        const selected = t === active;
        return (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${slugify(t)}`}
            aria-selected={selected}
            aria-controls={`${id}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t)}
            className={`min-h-11 shrink-0 border-b-2 pt-1.5 font-semibold transition focus-visible:-outline-offset-4 ${
              selected ? "border-white" : "border-transparent text-white/70 hover:text-white"
            }`}
          >
            {t}
          </button>
        );
      })}
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
      aria-hidden="true"
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-[#d0d0d0]`}
      style={{ background: BRONZE_CIRCLE }}
    >
      <Icon className="h-[55%] w-[55%]" />
    </span>
  );
}

function SectionTitle({ title, sub, id }: { title: string; sub?: string; id?: string }) {
  return (
    <div className="pt-1">
      <h2 id={id} className="font-heading text-[18px] font-bold leading-tight text-[#222]">
        {title}
      </h2>
      {sub ? <p className="text-[11px] italic text-[#333]">{sub}</p> : null}
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
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[#2b3a67]"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.4} />
      </span>
    </>
  );
  const cls =
    "flex min-h-12 w-full items-center gap-3 rounded-[10px] bg-[#8ea8bf] px-3.5 py-2.5 text-left transition active:brightness-95";
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/** White row with a bronze circle icon, used for lists. */
function RowCard({
  id,
  icon,
  title,
  body,
  children,
}: {
  id?: string;
  icon: IconType;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <article
      id={id}
      tabIndex={id ? -1 : undefined}
      aria-label={title}
      className="flex scroll-mt-4 gap-3 rounded-[10px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
    >
      <BronzeCircle icon={icon} />
      <div className="min-w-0 flex-1">
        <h3 className="text-[13.5px] font-bold text-[#1b1b1b]">{title}</h3>
        <p className="mt-0.5 text-[12px] leading-snug text-[#555]">{body}</p>
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
      className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3.5 text-[12px] font-semibold transition ${
        dark
          ? "bg-[#1d1d1d] text-white hover:bg-black"
          : "border border-[#1d1d1d]/30 text-[#1d1d1d] hover:border-[#1d1d1d]"
      }`}
    >
      {children}
      {external ? NEW_TAB_HINT : null}
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

/* ---------------------------- Forms ---------------------------------- */

const FIELD_CLS =
  "mt-1 w-full rounded-[8px] border bg-white px-3 py-2.5 text-[16px] text-[#1b1b1b] outline-none transition focus:border-[#5b84a8] focus:ring-2 focus:ring-[#8ea8bf]/40 focus-visible:outline-none";

const fieldCls = (error?: string) =>
  `${FIELD_CLS} ${error ? "border-[#b4372f]" : "border-[#1b1b1b]/20"}`;

function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[12px] font-bold text-[#333]">
        {label}
        {required ? (
          <span className="text-[#b4372f]" aria-hidden="true"> *</span>
        ) : (
          <span className="font-normal text-[#666]"> (optional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-[12px] font-semibold text-[#b4372f]">
          <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11.5px] text-[#666]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** ARIA wiring for a control inside <Field>. */
const controlProps = (id: string, error?: string, hint?: string, required?: boolean) => ({
  id,
  name: id,
  required,
  "aria-required": required || undefined,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : hint ? `${id}-hint` : undefined,
  className: fieldCls(error),
});

function focusFirstError(formId: string) {
  window.requestAnimationFrame(() => {
    document
      .querySelector<HTMLElement>(`#${formId} [aria-invalid="true"]`)
      ?.focus();
  });
}

const SUBMIT_GRADIENT = "linear-gradient(180deg,#000 0%,#000 45%,#6e6553 100%)";

/** Shown after a form opens the email draft; mailto can silently fail. */
function SentPanel({
  heading,
  copyBody,
  mailto,
  onEdit,
  onReset,
  resetLabel,
}: {
  heading: string;
  copyBody: string;
  mailto: string;
  onEdit: () => void;
  onReset: () => void;
  resetLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="status"
      className="space-y-3 rounded-[10px] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start gap-3">
        <CircleCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#4d7a5a]" aria-hidden="true" />
        <div>
          <h3 className="text-[15px] font-bold text-[#1b1b1b]">{heading}</h3>
          <p className="mt-1 text-[12.5px] leading-snug text-[#555]">
            Your email app should have opened with everything filled in. Review it
            and press send. If nothing opened, copy the details and email them to{" "}
            <a href={`mailto:${KESSICK_EMAIL}`} className="font-semibold text-[#1b1b1b] underline underline-offset-2">
              {KESSICK_EMAIL}
            </a>
            .
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () =>
            notify((await copyText(copyBody)) ? "Details copied" : "Couldn't copy. Select the text and copy it instead.")
          }
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[#1d1d1d] px-4 text-[12.5px] font-semibold text-white"
        >
          <Copy className="h-4 w-4" aria-hidden="true" /> Copy details
        </button>
        <a
          href={mailto}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#1d1d1d]/30 px-4 text-[12.5px] font-semibold text-[#1d1d1d]"
        >
          <Mail className="h-4 w-4" aria-hidden="true" /> Open email again
        </a>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[#1b1b1b]/10 pt-2 text-[12.5px] font-semibold">
        <button type="button" onClick={onEdit} className="min-h-10 text-[#3c5a80] underline underline-offset-2">
          Edit details
        </button>
        <button type="button" onClick={onReset} className="min-h-10 text-[#3c5a80] underline underline-offset-2">
          {resetLabel}
        </button>
      </div>
    </div>
  );
}

/* ------------------------ Announcements ----------------------------- */

const ANNOUNCEMENT_TABS = ["New Products", "Coming Soon", "New Policies"] as const;

function Announcements({
  sub,
  onBack,
  onNavigate,
  onTab,
}: {
  sub?: string;
  onBack: () => void;
  onNavigate: (route: Route) => void;
  onTab: (sub: string) => void;
}) {
  const tab = ANNOUNCEMENT_TABS.find((t) => slugify(t) === sub) ?? "New Products";
  const group = announcementGroups.find((g) => g.category === tab)!;
  return (
    <div className="space-y-3 pb-2">
      <div>
        <PageHeader
          title="Announcements"
          tagline="New products, upcoming collections, and policy updates from Kessick."
          onBack={onBack}
        />
        <TabBand<AnnouncementTab>
          id="announcements"
          label="Announcement categories"
          tabs={ANNOUNCEMENT_TABS}
          active={tab}
          onChange={(t) => onTab(slugify(t))}
        />
      </div>

      <div className="space-y-2 pt-1">
        {portalNotices.map((n) => (
          <SteelBar
            key={n.text}
            label={n.label}
            text={n.text}
            onClick={() => onNavigate({ section: n.section })}
          />
        ))}
      </div>

      <div
        id="announcements-panel"
        role="tabpanel"
        aria-labelledby={`announcements-tab-${slugify(tab)}`}
        className="space-y-3"
      >
        <SectionTitle title={tab} />

        {tab === "Coming Soon" ? (
          <section
            className="flex gap-3 rounded-[10px] p-2"
            style={{ background: BLACK_TO_TAUPE }}
          >
            <img
              src={estateCraftsman}
              alt="Kessick craftsman building an Estate Series rack"
              width={330}
              height={297}
              decoding="async"
              className="aspect-[10/9] h-auto w-[42%] shrink-0 rounded-[8px] object-cover"
            />
            <div className="min-w-0 flex-1 py-1 pr-1 text-white">
              <h3 className="text-[12.5px] font-bold">ESTATE SERIES</h3>
              <p className="font-label mt-0.5 rounded-full bg-white px-2 py-[1px] text-[13px] text-[#333]">
                Cask Collection
              </p>
              <p className="mt-3 text-[12px] leading-snug text-white/90">
                {group.items[0].body}
              </p>
              <a
                href={`mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent("Cask Collection launch details")}`}
                className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-full bg-white px-3.5 text-[12px] font-bold text-[#111]"
              >
                Get launch details <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
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
                    {item.cta ?? "Learn more"} <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                  </PillLink>
                ) : null}
              </RowCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------- Design Request ----------------------------- */

const DESIGN_TABS = ["Forma", "Towers"] as const;
type DesignTab = (typeof DESIGN_TABS)[number];

const EMPTY_DESIGN = {
  project: "",
  client: "",
  location: "",
  configuration: "",
  finish: "",
  bottles: "",
  timeline: "",
  notes: "",
};
type DesignForm = typeof EMPTY_DESIGN;

function DesignRequest({
  sub,
  onBack,
  onTab,
}: {
  sub?: string;
  onBack: () => void;
  onTab: (sub: string) => void;
}) {
  const tab = DESIGN_TABS.find((t) => slugify(t) === sub) ?? "Forma";
  const [form, setForm, resetForm] = useDraft<DesignForm>("design-request", EMPTY_DESIGN);
  const [errors, setErrors] = useState<Partial<Record<keyof DesignForm, string>>>({});
  const [sent, setSent] = useState(false);

  const set = (k: keyof DesignForm) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [k]: value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
  };

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
  const subject = `${tab} design request${form.project ? `: ${form.project}` : ""}`;
  const mailto = `mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  const validate = () => {
    const next: typeof errors = {};
    if (!form.project.trim()) next.project = "Add a project name.";
    if (!form.client.trim()) next.client = "Add the client's name.";
    if (!form.configuration) next.configuration = "Choose a configuration.";
    if (form.bottles && !/^\d[\d,]*$/.test(form.bottles.trim()))
      next.bottles = "Use numbers only, e.g. 400.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  return (
    <div className="space-y-3 pb-2">
      <div>
        <PageHeader
          title="Design Request Form"
          tagline="Tell us about the space. Our design team will prepare a layout for your client."
          onBack={onBack}
        />
        <TabBand<DesignTab>
          id="design"
          label="Product line"
          tabs={DESIGN_TABS}
          active={tab}
          onChange={(t) => {
            onTab(slugify(t));
            if (form.configuration) setForm((f) => ({ ...f, configuration: "" }));
          }}
        />
      </div>

      <div id="design-panel" role="tabpanel" aria-labelledby={`design-tab-${slugify(tab)}`} className="space-y-3">
        <section
          className="flex items-center gap-3 rounded-[10px] p-3 text-white"
          style={{ background: BLACK_TO_TAUPE }}
        >
          <BronzeCircle icon={StarIcon} size="h-12 w-12" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold">{tab}</h2>
            <p className="text-[12px] italic text-white/90">
              {tab === "Forma"
                ? "Freestanding, furniture-grade enclosures in single, double or triple-door."
                : "Fully assembled towers that combine into wine walls and rooms."}
            </p>
          </div>
        </section>

        <SectionTitle title="Project details" sub="Fields marked * are required. Your progress is saved on this device." />

        {sent ? (
          <SentPanel
            heading={`${tab} request ready to send`}
            copyBody={`To: ${KESSICK_EMAIL}\nSubject: ${subject}\n\n${body}`}
            mailto={mailto}
            onEdit={() => setSent(false)}
            onReset={() => {
              resetForm();
              setErrors({});
              setSent(false);
            }}
            resetLabel="Start a new request"
          />
        ) : (
          <form
            id="design-form"
            noValidate
            className="space-y-3.5 rounded-[10px] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            onSubmit={(e) => e.preventDefault()}
          >
            <Field id="project" label="Project name" required error={errors.project}>
              <input {...controlProps("project", errors.project, undefined, true)} value={form.project} onChange={set("project")} />
            </Field>
            <div className="grid grid-cols-1 gap-3.5 min-[400px]:grid-cols-2">
              <Field id="client" label="Client" required error={errors.client}>
                <input {...controlProps("client", errors.client, undefined, true)} value={form.client} onChange={set("client")} autoComplete="off" />
              </Field>
              <Field id="location" label="City, state">
                <input {...controlProps("location")} value={form.location} onChange={set("location")} autoComplete="address-level2" />
              </Field>
            </div>
            <Field id="configuration" label="Configuration" required error={errors.configuration}>
              <select {...controlProps("configuration", errors.configuration, undefined, true)} value={form.configuration} onChange={set("configuration")}>
                <option value="">Choose one</option>
                {configOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-3.5 min-[400px]:grid-cols-2">
              <Field id="finish" label="Wood / stain" hint="See the Wood Stain Chart in Dealer Resources.">
                <input {...controlProps("finish", undefined, "See the Wood Stain Chart in Dealer Resources.")} value={form.finish} onChange={set("finish")} />
              </Field>
              <Field id="bottles" label="Bottle capacity" error={errors.bottles}>
                <input {...controlProps("bottles", errors.bottles)} value={form.bottles} onChange={set("bottles")} inputMode="numeric" placeholder="e.g. 400" />
              </Field>
            </div>
            <Field id="timeline" label="Timeline">
              <input {...controlProps("timeline")} value={form.timeline} onChange={set("timeline")} placeholder="e.g. install by March" />
            </Field>
            <Field id="notes" label="Notes">
              <textarea {...controlProps("notes")} rows={3} value={form.notes} onChange={set("notes")} />
            </Field>
            <button
              type="submit"
              // Click (and Enter's implicit click) is handled directly because
              // sandboxed viewers silently block real form submission.
              onClick={(e) => {
                e.preventDefault();
                if (!validate()) {
                  focusFirstError("design-form");
                  return;
                }
                openContactLink(mailto);
                setSent(true);
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold text-white transition active:brightness-125"
              style={{ background: SUBMIT_GRADIENT }}
            >
              <EnvelopeIcon className="h-4 w-4" /> Email {tab} request to Kessick
            </button>
            <p className="text-[11.5px] italic text-[#555]">
              Opens your email with these details filled in. Attach room dimensions,
              photos or drawings before sending.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

/* -------------------------- Resources ------------------------------- */

const resourceId = (title: string) => `res-${slugify(title)}`;

function Resources({ sub, onBack }: { sub?: string; onBack: () => void }) {
  useEffect(() => {
    if (!sub) return;
    const t = window.setTimeout(() => revealElement(`res-${sub}`), 80);
    return () => window.clearTimeout(t);
  }, [sub]);

  return (
    <div className="space-y-3 pb-2">
      <PageHeader
        title="Dealer Resources"
        tagline="Renders, guides, spec sheets, finishes and marketing assets to sell, specify, and deliver."
        onBack={onBack}
      />

      <nav aria-label="Popular resources">
        <ul className="grid grid-cols-4 gap-2 pt-1">
          {resources.slice(0, 4).map((r) => (
            <li key={r.title} className="min-w-0">
              <button
                type="button"
                onClick={() => revealElement(resourceId(r.title))}
                className="flex w-full min-w-0 flex-col items-center gap-1.5 rounded-[10px] py-0.5 text-center"
              >
                <BronzeCircle icon={r.icon} size="h-[clamp(3.25rem,15vw,3.9rem)] w-[clamp(3.25rem,15vw,3.9rem)]" />
                <span className="font-label text-[11px] leading-[1.1] text-[#444]">{r.title}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <SectionTitle title="All resources" sub="Open what's public, or request files from the Kessick team." />

      <div className="space-y-2">
        {resources.map((r) => (
          <RowCard key={r.title} id={resourceId(r.title)} icon={r.icon} title={r.title} body={r.note}>
            {r.public ? (
              <PillLink href={r.public}>
                Open <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
              </PillLink>
            ) : null}
            {r.restricted ? (
              <PillLink href={requestAccessHref(r.title)} dark={false}>
                Request files <ChevronRight className="h-3 w-3" aria-hidden="true" />
              </PillLink>
            ) : null}
          </RowCard>
        ))}
      </div>
    </div>
  );
}

/* ----------------------- Report an Issue ----------------------------- */

const EMPTY_FEEDBACK = { category: issueCategories[0], message: "" };

function Support({ onBack }: { onBack: () => void }) {
  const [form, setForm, resetForm] = useDraft("feedback", EMPTY_FEEDBACK);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);

  const subject = `Dealer portal feedback: ${form.category}`;
  const body = `Category: ${form.category}\n\n${form.message}\n\nSent from the Kessick dealer portal`;
  const mailtoHref = `mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="space-y-3 pb-2">
      <PageHeader
        title="Report an Issue"
        tagline="Feedback, questions, or something not right? A direct line to our team."
        onBack={onBack}
      />

      <ul className="grid grid-cols-3 gap-2 pt-1">
        <li>
          <button
            type="button"
            onClick={() => revealElement("feedback-section", sent ? undefined : "select")}
            className="flex w-full flex-col items-center gap-1.5 rounded-[10px] py-0.5 text-center"
          >
            <BronzeCircle icon={ChatIcon} size="h-[clamp(3.25rem,15vw,3.9rem)] w-[clamp(3.25rem,15vw,3.9rem)]" />
            <span className="font-label text-[11px] text-[#444]">Feedback Form</span>
          </button>
        </li>
        {[
          { label: "Email Us", icon: EnvelopeIcon, href: `mailto:${KESSICK_EMAIL}` },
          { label: "Call Now", icon: Phone as IconType, href: `tel:${KESSICK_PHONE_TEL}` },
        ].map((a) => (
          <li key={a.label}>
            <a href={a.href} className="flex flex-col items-center gap-1.5 rounded-[10px] py-0.5 text-center">
              <BronzeCircle icon={a.icon} size="h-[clamp(3.25rem,15vw,3.9rem)] w-[clamp(3.25rem,15vw,3.9rem)]" />
              <span className="font-label text-[11px] text-[#444]">{a.label}</span>
            </a>
          </li>
        ))}
      </ul>

      <section id="feedback-section" tabIndex={-1} className="scroll-mt-4 space-y-3 rounded-[10px]">
        <SectionTitle title="Feedback Form" sub="Choose a topic and tell us what's happening." />

        {sent ? (
          <SentPanel
            heading="Feedback ready to send"
            copyBody={`To: ${KESSICK_EMAIL}\nSubject: ${subject}\n\n${body}`}
            mailto={mailtoHref}
            onEdit={() => setSent(false)}
            onReset={() => {
              resetForm();
              setError(undefined);
              setSent(false);
            }}
            resetLabel="Send something else"
          />
        ) : (
          <form
            id="feedback-form"
            noValidate
            className="space-y-3.5 rounded-[10px] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
            onSubmit={(e) => e.preventDefault()}
          >
            <Field id="category" label="Topic" required>
              <select
                {...controlProps("category", undefined, undefined, true)}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {issueCategories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field id="message" label="Details" required error={error} hint="Include an order number or series if it applies.">
              <textarea
                {...controlProps("message", error, "Include an order number or series if it applies.", true)}
                rows={4}
                value={form.message}
                onChange={(e) => {
                  const value = e.target.value;
                  setForm((f) => ({ ...f, message: value }));
                  if (error) setError(undefined);
                }}
                placeholder="What are you seeing?"
              />
            </Field>
            <button
              type="submit"
              onClick={(e) => {
                e.preventDefault();
                if (form.message.trim().length < 10) {
                  setError("Tell us a little more, at least a sentence.");
                  focusFirstError("feedback-form");
                  return;
                }
                openContactLink(mailtoHref);
                setSent(true);
              }}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold text-white transition active:brightness-125"
              style={{ background: SUBMIT_GRADIENT }}
            >
              <EnvelopeIcon className="h-4 w-4" /> Send feedback
            </button>
          </form>
        )}
      </section>

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
  onNavigate: (route: Route) => void;
}) {
  return (
    <div className="space-y-3 pb-2">
      <header className="relative isolate -mx-4 -mt-4 overflow-hidden text-white sm:-mx-6">
        <img src={cellarImage} alt="" decoding="async" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-black/55" />
        <div className="px-6 pb-5 pt-3">
          <BackButton onBack={onBack} />
          <div className="mt-3 flex items-center gap-3">
            <img
              src={dealerAvatar}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border-2 border-white object-cover"
            />
            <div className="min-w-0 leading-tight">
              <h1 data-page-title tabIndex={-1} className="text-[18px] font-extrabold">
                Authorized Dealer Name
              </h1>
              <p className="text-[12px]">123 Anywhere St., Any City</p>
              <p className="mt-1 text-[11px] italic text-white/85">Dealer Account Page</p>
            </div>
          </div>
        </div>
      </header>

      <SectionTitle title="Your account" sub="Profile, projects, and your line to the Kessick team." />

      <div className="space-y-2">
        <RowCard icon={PersonIcon} title="Dealer profile" body="Company details, showroom address and primary contact.">
          <PillLink href={`mailto:${KESSICK_EMAIL}?subject=${encodeURIComponent("Dealer profile update")}`} dark={false}>
            Request an update <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </PillLink>
        </RowCard>
        <RowCard icon={TeamworkIcon} title="Teamwork Account" body="Your active Kessick projects, files and conversations.">
          <PillLink href={TEAMWORK_SITE}>
            Open Teamwork <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </PillLink>
        </RowCard>
        <RowCard icon={EnvelopeIcon} title="Email the Kessick team" body={KESSICK_EMAIL}>
          <PillLink href={`mailto:${KESSICK_EMAIL}`}>
            Email <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </PillLink>
          <button
            type="button"
            onClick={async () => notify((await copyText(KESSICK_EMAIL)) ? "Email address copied" : "Couldn't copy the address")}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[#1d1d1d]/30 px-3.5 text-[12px] font-semibold text-[#1d1d1d] hover:border-[#1d1d1d]"
          >
            <Copy className="h-3 w-3" aria-hidden="true" /> Copy address
          </button>
        </RowCard>
      </div>

      <SteelBar text="Report an issue or send feedback" onClick={() => onNavigate({ section: "Support" })} />
    </div>
  );
}

/* ---------------------------- Shell --------------------------------- */

function buildSearchIndex(): SearchHit[] {
  return [
    ...toolkit.map((t) => ({
      title: t.label,
      detail: "Dealer toolkit",
      section: t.section,
      category: (t.section === "DesignRequest"
        ? "Design"
        : t.section === "Resources"
          ? "Resources"
          : t.section === "Support"
            ? "Support"
            : "Announcements") as SearchCategory,
    })),
    ...announcementGroups.flatMap((g) =>
      g.items.map((item) => ({
        title: item.title,
        detail: `Announcements · ${g.category}`,
        section: "Announcements" as const,
        sub: slugify(g.category),
        category: "Announcements" as const,
        keywords: item.body,
      })),
    ),
    ...resources.map((r) => ({
      title: r.title,
      detail: "Dealer resource",
      section: "Resources" as const,
      sub: slugify(r.title),
      category: "Resources" as const,
      keywords: r.note,
    })),
    ...DESIGN_TABS.map((t) => ({
      title: `${t} design request`,
      detail: "Design Request Form",
      section: "DesignRequest" as const,
      sub: slugify(t),
      category: "Design" as const,
      keywords: "layout quote drawing room dimensions",
    })),
    {
      title: "Report an issue",
      detail: "Feedback & support",
      section: "Support",
      category: "Support",
      keywords: "help problem feedback order delivery installation",
    },
    {
      title: "Call Kessick",
      detail: KESSICK_PHONE_DISPLAY,
      section: "Support",
      category: "Support",
      keywords: "phone contact",
    },
    {
      title: "Dealer account",
      detail: "Profile and Teamwork",
      section: "Account",
      category: "Support",
      keywords: "profile teamwork email",
    },
  ];
}

export default function DealerPortalPreview({
  staffViewMode = false,
}: {
  staffViewMode?: boolean;
}) {
  const { route, go, replace } = useHashRoute();
  const { section, sub } = route;
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<SearchCategory | null>(null);
  const searchIndex = useMemo(buildSearchIndex, []);
  const [emailOpen, setEmailOpen] = useState(false);
  const [leaving, setLeaving] = useState<{ url: string; label: string } | null>(null);
  useLinkGuard(setLeaving);

  const results = useMemo<SearchHit[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q && !filter) return [];
    const words = q.split(/\s+/).filter(Boolean);
    return searchIndex
      .filter((e) => !filter || e.category === filter)
      .filter((e) => {
        const hay = `${e.title} ${e.detail} ${e.keywords ?? ""}`.toLowerCase();
        return words.every((w) => hay.includes(w));
      })
      .sort((a, b) => {
        // Title matches first.
        const at = words.every((w) => a.title.toLowerCase().includes(w)) ? 0 : 1;
        const bt = words.every((w) => b.title.toLowerCase().includes(w)) ? 0 : 1;
        return at - bt;
      })
      .slice(0, 8);
  }, [search, filter, searchIndex]);

  const navigate = (next: Route) => {
    setSearch("");
    setFilter(null);
    go(next);
  };

  // Page title, scroll position and focus follow the route.
  const firstRender = useRef(true);
  useEffect(() => {
    document.title =
      section === "Home"
        ? "Kessick Dealer Portal"
        : `${SECTION_TITLES[section]} · Kessick Dealer Portal`;
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    document.querySelector<HTMLElement>("[data-page-title]")?.focus({ preventScroll: true });
  }, [section]);

  const goHome = () => navigate({ section: "Home" });

  return (
    <div className="dealer-preview-surface min-h-screen pb-[calc(6rem+env(safe-area-inset-bottom))] text-[#1b1b19]">
      <a
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.querySelector<HTMLElement>("[data-page-title]")?.focus();
        }}
        className="sr-only z-50 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

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
      <main
        id="main-content"
        className="dealer-mockup mx-auto w-full max-w-[460px] px-4 pt-4 sm:max-w-[520px] sm:px-6"
      >
        {section === "Home" ? (
          <Home
            search={search}
            setSearch={setSearch}
            filter={filter}
            setFilter={setFilter}
            results={results}
            onNavigate={navigate}
            onOpenHit={(hit) => navigate({ section: hit.section, sub: hit.sub })}
          />
        ) : section === "Announcements" ? (
          <Announcements
            sub={sub}
            onBack={goHome}
            onNavigate={navigate}
            onTab={(s) => replace({ section, sub: s })}
          />
        ) : section === "DesignRequest" ? (
          <DesignRequest sub={sub} onBack={goHome} onTab={(s) => replace({ section, sub: s })} />
        ) : section === "Resources" ? (
          <Resources sub={sub} onBack={goHome} />
        ) : section === "Support" ? (
          <Support onBack={goHome} />
        ) : (
          <Account onBack={goHome} onNavigate={navigate} />
        )}
      </main>

      <Toast />
      {emailOpen ? (
        <EmailSheet
          onClose={() => setEmailOpen(false)}
          onFeedback={() => navigate({ section: "Support" })}
        />
      ) : null}
      {leaving ? (
        <LeaveSheet url={leaving.url} onClose={() => setLeaving(null)} />
      ) : null}

      {/* Sticky footer navigation, matching the mockup */}
      <nav
        aria-label="Main"
        className="dealer-preview-surface dealer-mockup fixed inset-x-0 bottom-0 z-40 shadow-[0_-1px_0_rgba(0,0,0,0.06)]"
      >
        <ul className="mx-auto grid max-w-[460px] grid-cols-4 items-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 sm:max-w-[520px]">
          {bottomNav.map((item) => {
            const Icon = item.icon;
            const active = item.kind === "section" && section === item.section;
            const content = active ? (
              <span
                className="flex h-[38px] items-center gap-1.5 rounded-full py-[3px] pl-[3px] pr-3.5 text-white"
                style={{ background: SUBMIT_GRADIENT }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-bold">{item.label}</span>
              </span>
            ) : (
              <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#1d1d1d] text-white transition motion-safe:group-hover:-translate-y-0.5 group-active:scale-95">
                <Icon className="h-[22px] w-[22px]" />
              </span>
            );
            const classes = "group flex min-h-12 w-full items-center justify-center rounded-full";
            if (item.kind === "email") {
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    aria-label={item.label}
                    aria-haspopup="dialog"
                    aria-expanded={emailOpen}
                    onClick={() => setEmailOpen(true)}
                    className={classes}
                  >
                    {content}
                  </button>
                </li>
              );
            }
            if (item.kind === "link") {
              const external = item.href.startsWith("http");
              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noopener noreferrer" : undefined}
                    aria-label={external ? `${item.label} (opens in a new tab)` : item.label}
                    className={classes}
                  >
                    {content}
                  </a>
                </li>
              );
            }
            return (
              <li key={item.label}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                  onClick={() => navigate({ section: item.section })}
                  className={classes}
                >
                  {content}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
