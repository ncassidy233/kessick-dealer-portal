import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  FileText,
  FolderOpen,
  Headphones,
  Loader2,
  Search,
  Sparkles,
  UserRound,
  Wine,
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import roomImage from "@assets/kessick-room-demo.jpg";
import { usePortalContent, usePortalNotifications, usePortalProjects } from "@/hooks/use-portal-v2";
import type { PortalContent } from "@/hooks/use-portal-v2";
import { usePortalSession } from "@/lib/portal-session";
import { safeWebUrl } from "@/lib/content-links";

type SearchResult = {
  id: string;
  title: string;
  detail: string;
  href: string;
  type: string;
};

function matches(item: PortalContent, query: string) {
  return `${item.title} ${item.description ?? ""} ${item.payload?.status ?? ""} ${item.payload?.category ?? ""}`
    .toLowerCase()
    .includes(query);
}

export default function PortalDashboard() {
  const { data: session, isLoading: sessionLoading } = usePortalSession();
  const { data: notificationsData } = usePortalNotifications();
  const { data: projectsData } = usePortalProjects();
  const { data: announcementsData } = usePortalContent("announcement");
  const { data: seriesData } = usePortalContent("product_series");
  const { data: resourcesData } = usePortalContent("resource");
  const { data: categoriesData } = usePortalContent("resource_category");
  const [search, setSearch] = useState("");

  const notifications = notificationsData?.notifications ?? [];
  const unreadNotifications = notifications.filter((item) => !item.readAt);
  const announcements = announcementsData?.content ?? [];
  const projects = projectsData?.content ?? [];
  const productSeries = seriesData?.content ?? [];
  const resources = resourcesData?.content ?? [];
  const resourceCategories = categoriesData?.content ?? [];
  const featuredAnnouncement =
    announcements.find((item) => item.payload?.featuredOnDashboard === true) ?? announcements[0];
  const featuredSeries = productSeries.find(
    (item) => item.payload?.featuredOnDashboard === true || item.payload?.comingSoon === true,
  );
  const query = search.trim().toLowerCase();

  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query) return [];
    const records: SearchResult[] = [
      ...projects.map((item) => ({
        id: `project-${item.id}`,
        title: item.title,
        detail: item.description || "Dealer project",
        href: "/portal/projects",
        type: "Project",
      })),
      ...productSeries.map((item) => ({
        id: `series-${item.id}`,
        title: item.title,
        detail: item.description || "Product collection",
        href: "/portal/collections",
        type: "Collection",
      })),
      ...resources.map((item) => ({
        id: `resource-${item.id}`,
        title: item.title,
        detail: item.description || "Dealer resource",
        href: "/portal/resources",
        type: "Resource",
      })),
      ...resourceCategories.map((item) => ({
        id: `category-${item.id}`,
        title: item.title,
        detail: item.description || "Resource category",
        href: "/portal/resources",
        type: "Resource",
      })),
      ...announcements.map((item) => ({
        id: `announcement-${item.id}`,
        title: item.title,
        detail: item.description || "Dealer announcement",
        href: safeWebUrl(item.payload?.url) ?? "/portal/notifications",
        type: "Announcement",
      })),
      ...notifications.map(({ notification }) => ({
        id: `notice-${notification.id}`,
        title: notification.title,
        detail: notification.body,
        href: "/portal/notifications",
        type: "Notice",
      })),
    ];
    return records.filter((item) => `${item.title} ${item.detail}`.toLowerCase().includes(query)).slice(0, 6);
  }, [announcements, notifications, productSeries, projects, query, resourceCategories, resources]);

  if (sessionLoading) {
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center bg-[#10100f]">
        <Loader2 className="h-6 w-6 animate-spin text-[#B39862]" />
      </div>
    );
  }

  const dealerName = session?.account?.displayName?.trim() || "Dealer partner";

  return (
    <div className="dealer-dashboard min-h-full bg-[#10100f] pb-5 text-[#f4f0e8]">
      <section className="dealer-hero relative isolate min-h-[330px] overflow-hidden sm:min-h-[390px]">
        <img
          src={roomImage}
          alt="Kessick wine cellar display"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/75 via-black/45 to-[#10100f]" />
        <header className="mx-auto flex w-full max-w-7xl items-start justify-between gap-4 px-4 pb-8 pt-5 sm:px-8 sm:pt-8">
          <div className="min-w-0">
            <img src="/kessick-logo-white.svg" alt="Kessick Wine Cellars" className="h-7 w-auto sm:h-9" />
            <p className="mt-4 truncate text-xs font-medium text-white/80 sm:text-sm">
              {dealerName}
              {session?.account?.email ? <span className="ml-2 text-white/55">· {session.account.email}</span> : null}
            </p>
            {session?.groups?.length ? (
              <p className="mt-1 truncate text-[10px] uppercase tracking-[0.14em] text-white/50">
                {session.groups.map((group) => group.name).join(" · ")}
              </p>
            ) : null}
          </div>
          <Link
            href="/portal/notifications"
            aria-label={`${unreadNotifications.length} unread notices`}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur transition hover:bg-white/15"
          >
            <Bell className="h-5 w-5" />
            {unreadNotifications.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#B39862] px-1 text-[10px] font-bold text-black">
                {unreadNotifications.length > 9 ? "9+" : unreadNotifications.length}
              </span>
            )}
          </Link>
        </header>
        <div className="mx-auto w-full max-w-7xl px-4 pb-9 pt-8 sm:px-8 sm:pt-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-[#d8c18d]">Kessick dealer portal</p>
          <h1 className="mt-3 max-w-3xl font-serif text-4xl font-medium leading-[1.04] tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your Kessick project desk.
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
            A considered workspace for your projects, product information, and dealer support.
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-3 w-full max-w-7xl space-y-9 px-4 sm:space-y-12 sm:px-8">
        <section className="relative z-10" aria-label="Search your dealer portal">
          <label htmlFor="dealer-dashboard-search" className="sr-only">Search projects, collections, resources, and notices</label>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#1a1a18] px-4 shadow-[0_16px_44px_rgba(0,0,0,.35)] focus-within:border-[#B39862]/80">
            <Search className="h-5 w-5 shrink-0 text-[#B39862]" />
            <input
              id="dealer-dashboard-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects, products, resources…"
              className="h-14 w-full bg-transparent text-sm text-white outline-none placeholder:text-white/40 sm:h-16 sm:text-base"
            />
            {search && <button type="button" onClick={() => setSearch("")} className="shrink-0 text-xs text-white/55 hover:text-white">Clear</button>}
          </div>
          {query && (
            <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#1a1a18] shadow-xl">
              {searchResults.length ? searchResults.map((result) => (
                <Link key={result.id} href={result.href} className="flex items-center justify-between gap-4 border-b border-white/5 px-4 py-3 last:border-0 hover:bg-white/5">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{result.title}</span><span className="mt-1 block truncate text-xs text-white/50">{result.detail}</span></span>
                  <span className="shrink-0 text-[9px] uppercase tracking-wider text-[#d8c18d]">{result.type}</span>
                </Link>
              )) : <p className="px-4 py-5 text-sm text-white/55">No published projects, resources, or notices match that search.</p>}
            </div>
          )}
        </section>

        <section aria-labelledby="toolkit-heading">
          <div className="mb-5 flex items-end justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B39862]">At your service</p><h2 id="toolkit-heading" className="mt-1 text-xl font-medium sm:text-2xl">Your Dealer Toolkit</h2></div>
            <Link href="/portal/forms" className="hidden items-center gap-1 text-xs text-white/55 hover:text-white sm:flex">All dealer forms <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            <ToolkitLink href="/portal/notifications" icon={Sparkles} label="What’s New" />
            <ToolkitLink href="/portal/forms" icon={FileText} label="Design Request" />
            <ToolkitLink href="/portal/resources" icon={FolderOpen} label="Resources" />
            <ToolkitLink href="/portal/forms" icon={Headphones} label="Feedback" />
          </div>
        </section>

        {featuredAnnouncement && (
          <section aria-label="Dealer announcement" className="relative isolate overflow-hidden rounded-2xl border border-[#d1b35f]/40 bg-[#d1b35f] text-[#191711]">
            <img
              src={safeWebUrl(featuredAnnouncement.payload?.imageUrl) ?? roomImage}
              alt=""
              className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#e3c76e]/95 via-[#e3c76e]/80 to-[#e3c76e]/45" />
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="max-w-3xl">
                <p className="text-[9px] font-bold uppercase tracking-[0.2em]">Special announcement</p>
                <h2 className="mt-2 text-xl font-semibold sm:text-2xl">{featuredAnnouncement.title}</h2>
                {featuredAnnouncement.description && <p className="mt-2 text-sm leading-relaxed text-black/70">{featuredAnnouncement.description}</p>}
              </div>
              <Link href={safeWebUrl(featuredAnnouncement.payload?.url) ?? "/portal/notifications"} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#171715] px-5 text-xs font-semibold text-white transition hover:bg-black sm:self-center">
                View announcement <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a18]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
              <div><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#B39862]">Your workspace</p><h2 className="mt-1 text-lg font-medium">Active projects</h2></div>
              <Link href="/portal/projects" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">View all <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            {projects.length ? (
              <div className="divide-y divide-white/10">
                {projects.slice(0, 3).map((project) => (
                  <Link key={project.id} href="/portal/projects" className="flex items-center gap-4 px-5 py-4 transition hover:bg-white/[0.035] sm:px-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-[#d3bb84]"><BriefcaseBusiness className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{project.title}</p><p className="mt-1 truncate text-xs text-white/45">{project.description || "Kessick project"}</p></div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/35" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 sm:px-6">
                <p className="text-sm text-white/65">No projects have been published to your account yet.</p>
                <Link href="/portal/forms" className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[#d8c18d] hover:text-white">Start a design request <ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a18]">
            <div className="border-b border-white/10 px-5 py-4"><p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#B39862]">Kessick updates</p><h2 className="mt-1 text-lg font-medium">Notices & email</h2></div>
            <div className="space-y-4 p-5">
              {notifications.slice(0, 2).map(({ id, notification, readAt }) => (
                <Link key={id} href="/portal/notifications" className="block border-l-2 border-[#B39862] pl-3">
                  <p className="line-clamp-2 text-sm font-medium">{notification.title}</p>
                  <p className="mt-1 text-xs text-white/45">{readAt ? "Read" : "New"}{notification.sentAt ? ` · ${formatDistanceToNow(new Date(notification.sentAt), { addSuffix: true })}` : ""}</p>
                </Link>
              ))}
              {notifications.length === 0 && <p className="text-sm text-white/55">You’re all caught up. New notices from Kessick will appear here.</p>}
            </div>
            <Link href="/portal/notifications" className="flex items-center justify-between border-t border-white/10 px-5 py-3 text-xs font-medium text-[#d8c18d] hover:bg-white/[0.035]">Open notices <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        <section aria-labelledby="collection-heading" className="overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a18]">
          <div className="grid md:grid-cols-[1.05fr_.95fr]">
            <div className="relative min-h-52 overflow-hidden md:min-h-64">
              <img src={featuredSeries ? safeWebUrl(featuredSeries.payload?.imageUrl) ?? roomImage : roomImage} alt="Kessick wine storage in an architectural interior" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent md:bg-gradient-to-r md:from-transparent md:to-[#1a1a18]/90" />
              {!featuredSeries && <span className="absolute bottom-4 left-4 rounded-full border border-white/25 bg-black/40 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white">Kessick Wine Cellars</span>}
            </div>
            <div className="flex flex-col justify-center p-5 sm:p-7">
              <p className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-[#B39862]">
                {featuredSeries?.payload?.comingSoon === true ? "Coming soon" : "Featured collection"}
              </p>
              {featuredSeries ? (
                <>
                  <h2 id="collection-heading" className="mt-3 text-2xl font-medium">{featuredSeries.title}</h2>
                  {featuredSeries.description && <p className="mt-2 text-sm leading-relaxed text-white/60">{featuredSeries.description}</p>}
                  <Link href="/portal/collections" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#d8c18d] hover:text-white">Explore collection <ArrowRight className="h-4 w-4" /></Link>
                </>
              ) : (
                <>
                  <h2 id="collection-heading" className="mt-3 text-xl font-medium">Discover Kessick collections</h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">No featured collection is currently published for your account. Explore the collections available to you.</p>
                  <Link href="/portal/collections" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#d8c18d] hover:text-white">Browse published collections <ArrowRight className="h-4 w-4" /></Link>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 border-t border-white/10 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-medium">Need help with a project?</p><p className="mt-1 text-xs text-white/50">Contact Kessick or send your team a request through the portal.</p></div>
          <div className="flex flex-wrap gap-3">
            <Link href="/portal/forms" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs hover:border-[#B39862]"><FileText className="h-4 w-4 text-[#B39862]" /> Design request</Link>
            <a href="tel:+18642971911" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs hover:border-[#B39862]"><Headphones className="h-4 w-4 text-[#B39862]" /> Call Kessick</a>
            <Link href="/portal/account" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 px-4 text-xs hover:border-[#B39862]"><UserRound className="h-4 w-4 text-[#B39862]" /> Account</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function ToolkitLink({ href, icon: Icon, label }: { href: string; icon: typeof Wine; label: string }) {
  return (
    <Link href={href} className="group flex min-w-0 flex-col items-center gap-2 text-center">
      <span className="flex h-[clamp(3.75rem,15vw,5.25rem)] w-[clamp(3.75rem,15vw,5.25rem)] items-center justify-center rounded-full border border-[#B39862]/45 bg-[#1a1a18] text-[#d8c18d] transition duration-200 group-hover:-translate-y-0.5 group-hover:border-[#d8c18d] group-hover:bg-[#B39862]/15 group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-[#d8c18d]">
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <span className="max-w-[6rem] text-[10px] font-medium leading-tight text-white/75 sm:text-xs">{label}</span>
    </Link>
  );
}
