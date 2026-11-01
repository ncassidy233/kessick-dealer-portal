import { type ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { PortalLink as Link } from "@/components/portal-link";
import { BrandLogo } from "@/components/brand-logo";
import { usePortalSession } from "@/lib/portal-session";
import { useStaffDealerView } from "@/lib/staff-dealer-view-context";
import { dealerAccessState } from "@/lib/dealer-access";
import { useGetDealerPortalAccess } from "@/hooks/use-dealer-api";
import { usePortalNotifications } from "@/hooks/use-portal-v2";
import {
  LogOut, User, Home, DollarSign, FileText, FolderOpen, Bell, Users,
  Shield, MessageSquare, Briefcase, Layers, GraduationCap, BookOpen,
  BarChart3, Headphones, Menu, Paintbrush, ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClerk } from "@clerk/react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type NavLink = { href: string; label: string; icon: typeof Home; exact?: boolean; badge?: number };

export function PortalLayout({ children, signOutControl = <PortalSignOut /> }: { children: ReactNode; signOutControl?: ReactNode }) {
  const [routeLocation] = useLocation();
  const selectedDealer = useStaffDealerView();
  const location = selectedDealer ? routeLocation.replace(`/admin/dealer-view/${selectedDealer.selectedDealerAccountId}`, "") : routeLocation;
  const sessionQuery = usePortalSession();
  const session = sessionQuery.data;
  const { data: notices } = usePortalNotifications();
  const { data: access } = useGetDealerPortalAccess();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setMenuOpen(false), [routeLocation]);

  const isStaff = Boolean(session?.authorized && session.role !== "dealer" && session.role !== "customer");
  const staffWorkspace = isStaff && !location.startsWith("/portal");
  const dealerAuthorized = dealerAccessState(sessionQuery) === "allowed";
  const canDesign = isStaff && session?.capabilities.includes("content:read");
  const unreadCount = notices?.notifications.filter(n => !n.readAt).length || 0;
  const dealerLinks: NavLink[] = [
    { href: "/portal", label: "Dashboard", icon: Home, exact: true },
    { href: "/portal/projects", label: "Projects", icon: Briefcase },
    { href: "/portal/collections", label: "Collections", icon: Layers },
    { href: "/portal/training", label: "Training", icon: GraduationCap },
    { href: "/portal/pricing", label: "Pricing", icon: DollarSign },
    { href: "/portal/resources", label: "Resources", icon: FolderOpen },
    { href: "/portal/forms", label: "Forms & support", icon: FileText },
    { href: "/portal/notifications", label: "Notices", icon: Bell, badge: unreadCount || undefined },
    { href: "/portal/account", label: "Account", icon: User },
  ];
  const visibleDealerLinks = dealerLinks.filter(link => {
    if (!dealerAuthorized) return link.href === "/portal/account";
    if (isStaff || link.href === "/portal" || link.href === "/portal/account") return true;
    return (access?.capabilities as Record<string, boolean> | undefined)?.[`page:${link.href.split("/").pop()}`] !== false;
  });
  const adminLinks: (NavLink & { capability?: string; adminOnly?: boolean })[] = [
    { href: "/admin", label: "Overview", icon: Home, exact: true, capability: "admin:overview" },
    { href: "/admin/page-studio", label: "Layout & Theme", icon: Paintbrush, capability: "content:read" },
    { href: "/admin/users", label: "Accounts", icon: Users, capability: "users:read" },
    { href: "/admin/groups", label: "Dealer groups", icon: Layers, capability: "groups:read" },
    { href: "/admin/content", label: "Content & resources", icon: FolderOpen, capability: "content:read" },
    { href: "/admin/pricing", label: "Pricing", icon: DollarSign, capability: "pricing:read" },
    { href: "/admin/notifications", label: "Notifications", icon: MessageSquare, capability: "notifications:read" },
    { href: "/admin/access", label: "Access rules", icon: Shield, adminOnly: true },
    { href: "/admin/knowledge", label: "Concierge knowledge", icon: BookOpen, capability: "content:read" },
    { href: "/admin/concierge-insights", label: "Concierge insights", icon: BarChart3, adminOnly: true },
    { href: "/admin/audit", label: "Activity log", icon: Shield, adminOnly: true },
  ];
  const fullAdmin = ["super_admin", "staff_admin"].includes(session?.role ?? "");
  const visibleAdminLinks = adminLinks.filter(link => isStaff && (fullAdmin || (!link.adminOnly && Boolean(link.capability && session?.capabilities.includes(link.capability)))));
  const links = staffWorkspace ? visibleAdminLinks : visibleDealerLinks;
  const current = links.find(link => link.exact ? location === link.href : location.startsWith(link.href));
  const mobileStaffLinks = visibleAdminLinks.filter(link => ["/admin", "/admin/page-studio", "/admin/users", "/admin/notifications"].includes(link.href));
  const mobileDealerLinks = visibleDealerLinks.filter(link => ["/portal", "/portal/account", "/portal/notifications", "/portal/forms"].includes(link.href));

  function NavItem({ link, compact = false }: { link: NavLink; compact?: boolean }) {
    const active = link.exact ? location === link.href : location.startsWith(link.href);
    return <Link href={link.href} aria-current={active ? "page" : undefined}
      className={compact
        ? `relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`
        : `flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#171715] text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
      <link.icon className={compact ? "h-5 w-5 shrink-0" : `h-[18px] w-[18px] shrink-0 ${active ? "text-[#c9ad72]" : ""}`} />
      <span className="truncate">{compact && link.href === "/admin/page-studio" ? "Editor" : compact && link.href === "/portal/forms" ? "Support" : link.label}</span>
      {Boolean(link.badge) && <span className={compact ? "absolute right-3 top-1 h-2 w-2 rounded-full bg-[#b39862]" : "ml-auto rounded-full bg-[#b39862]/15 px-2 py-0.5 text-[10px]"}>{compact ? null : link.badge}</span>}
    </Link>;
  }
  const switcher = isStaff && <nav aria-label="Portal switch" className="inline-flex shrink-0 items-center rounded-full border border-current/15 p-1 text-xs font-semibold">
    <Link href="/admin" aria-current={staffWorkspace ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3 ${staffWorkspace ? "bg-[#171715] text-white" : "text-current/70"}`}>Staff View</Link>
    <Link href="/portal" aria-current={!staffWorkspace ? "page" : undefined} className={`inline-flex min-h-9 items-center rounded-full px-3 ${!staffWorkspace ? "bg-[#b39862] text-[#121210]" : "text-[#5e5e59]"}`}>Dealer View</Link>
  </nav>;

  return <div className={`min-h-[100dvh] min-w-0 flex flex-col md:flex-row ${staffWorkspace ? "staff-portal bg-white text-[#171715]" : "dealer-portal bg-background text-foreground"}`}>
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card md:flex sticky top-0 h-[100dvh] overflow-y-auto">
      <div className="border-b border-border px-6 py-6"><BrandLogo tone="dark" className="h-6 w-auto" /><p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{staffWorkspace ? "Staff Portal" : "Dealer Portal"}</p></div>
      <nav aria-label={staffWorkspace ? "Staff navigation" : "Dealer navigation"} className="flex-1 space-y-1 px-3 py-5">{links.map(link => <NavItem key={link.href} link={link} />)}
        {staffWorkspace && session?.capabilities.includes("dealer-view:read") && <Link href="/admin/dealer-view" className="mt-5 flex min-h-11 items-center gap-2 border-t border-border px-3 pt-4 text-xs text-muted-foreground">View a specific dealer<ArrowUpRight className="ml-auto h-4 w-4" /></Link>}
      </nav>
      <div className="flex items-center gap-2 border-t border-border p-4"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b39862]/15 text-sm font-bold text-[#806936]">{(session?.account.displayName || session?.account.email || "K").charAt(0).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{session?.account.displayName || session?.account.email}</p><p className="mt-1 text-[10px] capitalize text-muted-foreground">{session?.role.replaceAll("_", " ")}</p></div>{!selectedDealer && signOutControl}</div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className={`sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur ${staffWorkspace ? "text-[#171715]" : "text-foreground"}`}>
        <div className="flex min-h-[76px] flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex min-w-0 items-center gap-3"><BrandLogo tone="dark" className="h-5 w-auto md:hidden" /><div className="hidden md:block"><p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{staffWorkspace ? "Kessick staff workspace" : isStaff ? "Kessick staff · dealer access" : "Kessick dealer network"}</p><p className="mt-1 text-sm font-semibold">{current?.label || (staffWorkspace ? "Staff Portal" : "Dealer Portal")}</p></div></div>
          <div className="flex items-center gap-2">{switcher}{staffWorkspace && canDesign && <Link href="/admin/page-studio" className="hidden min-h-11 items-center gap-2 rounded-lg bg-[#b39862] px-4 text-xs font-semibold text-[#171715] lg:inline-flex"><Paintbrush className="h-4 w-4" />Edit dealer portal</Link>}<button aria-label={staffWorkspace ? "All staff tools" : "All dealer pages"} onClick={() => setMenuOpen(true)} className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border md:hidden"><Menu className="h-5 w-5" /></button></div>
        </div>
      </header>
      <main id="portal-content" className="min-w-0 pb-24 md:pb-0">{children}</main>
    </div>
    <nav aria-label={staffWorkspace ? "Mobile staff navigation" : "Mobile dealer navigation"} className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border bg-card/95 px-2 pb-safe backdrop-blur md:hidden">
      {(staffWorkspace ? mobileStaffLinks : mobileDealerLinks).map(link => <NavItem key={link.href} link={link} compact />)}
      <button aria-label={staffWorkspace ? "More staff tools" : "More dealer pages"} onClick={() => setMenuOpen(true)} className="flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-muted-foreground"><Menu className="h-5 w-5" />More</button>
    </nav>
    <Sheet open={menuOpen} onOpenChange={setMenuOpen}><SheetContent className={`${staffWorkspace ? "staff-portal bg-white text-[#171715]" : "dealer-portal bg-background text-foreground"} w-[min(90vw,380px)] overflow-y-auto`}><SheetHeader className="mb-6 text-left"><SheetTitle>{staffWorkspace ? "Staff tools" : "Dealer portal"}</SheetTitle><SheetDescription>Choose a workspace.</SheetDescription></SheetHeader><nav aria-label="All portal tools" className="space-y-1">{links.map(link => <NavItem key={link.href} link={link} />)}</nav>{isStaff && <div className="mt-6 border-t border-border pt-5">{switcher}{staffWorkspace && session?.capabilities.includes("dealer-view:read") && <Link href="/admin/dealer-view" className="mt-4 block text-sm underline">View a specific dealer</Link>}</div>}<div className="mt-6 flex items-center justify-between border-t border-border pt-5"><p className="min-w-0 truncate text-xs text-muted-foreground">{session?.account.email}</p>{!selectedDealer && signOutControl}</div></SheetContent></Sheet>
  </div>;
}

function PortalSignOut() {
  const { signOut } = useClerk();
  return <Button aria-label="Sign out" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}><LogOut className="h-4 w-4" /></Button>;
}
