import { ReactNode } from "react";
import { useLocation } from "wouter";
import { PortalLink as Link } from "@/components/portal-link";
import { BrandLogo } from "@/components/brand-logo";
import { usePortalSession } from "@/lib/portal-session";
import { useStaffDealerView } from "@/lib/staff-dealer-view-context";
import { dealerAccessState } from "@/lib/dealer-access";
import { useGetDealerPortalAccess } from "@/hooks/use-dealer-api";
import { usePortalNotifications } from "@/hooks/use-portal-v2";
import { 
  LogOut, 
  User, 
  Home, 
  DollarSign, 
  FileText, 
  FolderOpen, 
  Bell,
  Users,
  Shield,
  MessageSquare,
  Briefcase,
  Layers,
  GraduationCap,
  BookOpen,
  BarChart3,
  ArrowLeftRight,
  Headphones,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClerk } from "@clerk/react";
import { Badge } from "@/components/ui/badge";

export function PortalLayout({ children, signOutControl = <PortalSignOut /> }: { children: ReactNode; signOutControl?: ReactNode }) {
  const [routeLocation] = useLocation();
  const previewDealerId = useStaffDealerView();
  const location = previewDealerId ? routeLocation.replace(`/admin/dealer-view/${previewDealerId.selectedDealerAccountId}`, "") : routeLocation;
  const sessionQuery = usePortalSession();
  const session = sessionQuery.data;
  const { data: notificationsData } = usePortalNotifications();
  
  const role = session?.role;
  const isStaff = role && role !== 'dealer' && role !== 'customer';
  const canPreview = isStaff && session?.authorized && session.capabilities.includes("dealer-view:read");
  const dealerAuthorized = dealerAccessState(sessionQuery) === "allowed";
  const { data: access } = useGetDealerPortalAccess();
  
  const unreadCount = notificationsData?.notifications?.filter(n => !n.readAt).length || 0;

  type NavLink = {
    href: string;
    label: string;
    icon: typeof Home;
    exact?: boolean;
    badge?: number;
  };

  const dealerLinks: NavLink[] = [
    { href: "/portal", label: "Dashboard", icon: Home, exact: true },
    { href: "/portal/projects", label: "Projects", icon: Briefcase },
    { href: "/portal/collections", label: "Collections", icon: Layers },
    { href: "/portal/training", label: "Training", icon: GraduationCap },
    { href: "/portal/pricing", label: "Pricing", icon: DollarSign },
    { href: "/portal/resources", label: "Resources", icon: FolderOpen },
    { href: "/portal/forms", label: "Forms", icon: FileText },
    { href: "/portal/notifications", label: "Notices", icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    { href: "/portal/account", label: "Account", icon: User },
  ];

  const visibleDealerLinks = dealerLinks.filter((link) => {
    if (!dealerAuthorized) return link.href === "/portal/account";
    if (link.href === "/portal" || link.href === "/portal/account") return true;
    const pageKey = `page:${link.href.split("/").pop()}`;
    if ((access?.capabilities as Record<string, boolean> | undefined)?.[pageKey] === false) return false;
    return true;
  });
  const mobileDealerLinks: NavLink[] = [
    { href: "/portal", label: "Home", icon: Home, exact: true },
    { href: "/portal/account", label: "Account", icon: User },
    { href: "/portal/notifications", label: "Notices", icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
    { href: "/portal/forms", label: "Support", icon: Headphones },
  ];
  const visibleMobileDealerLinks = mobileDealerLinks.filter((link) =>
    visibleDealerLinks.some((visible) => visible.href === link.href),
  );

  const adminLinks: NavLink[] = [
    { href: "/admin", label: "Overview", icon: Home, exact: true },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/groups", label: "Groups", icon: Users },
    { href: "/admin/access", label: "Access Rules", icon: Shield },
    { href: "/admin/pricing", label: "Pricing", icon: DollarSign },
    { href: "/admin/content", label: "Content", icon: FileText },
    { href: "/admin/notifications", label: "Notifications", icon: MessageSquare },
    { href: "/admin/knowledge", label: "Concierge Knowledge", icon: BookOpen },
    { href: "/admin/concierge-insights", label: "Concierge Insights", icon: BarChart3 },
    { href: "/admin/audit", label: "Audit Log", icon: Shield },
  ];

  const visibleAdminLinks = adminLinks.filter(link => {
    if (!session) return false;
    if (link.href === "/admin/knowledge") return ["super_admin", "staff_admin", "content_manager"].includes(session.role);
    if (link.href === "/admin/concierge-insights") return ["super_admin", "staff_admin"].includes(session.role);
    if (["super_admin", "staff_admin"].includes(session.role)) return true;
    
    const required = link.href === "/admin" ? "admin:overview"
      : link.href === "/admin/users" ? "users:read"
      : link.href === "/admin/groups" ? "groups:read"
      : link.href === "/admin/content" ? "content:read"
      : link.href === "/admin/notifications" ? "notifications:read"
      : null;
      
    if (required && session.capabilities?.includes(required)) return true;
    return false;
  });

  return (
    <div className={`min-h-[100dvh] flex flex-col md:flex-row dealer-portal ${isStaff ? "staff-portal bg-white text-[#121210]" : "bg-background text-foreground"} selection:bg-sidebar-primary/30 selection:text-sidebar-primary`}>
      {/* Mobile Header */}
      <header className="md:hidden h-14 border-b border-border flex items-center justify-between px-4 bg-background/70 sticky top-0 z-50 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <BrandLogo tone="dark" className="h-4 w-auto" />
          <Badge variant="outline" className="text-[9px] uppercase tracking-widest bg-transparent border-border rounded-none px-1.5 py-0.5 text-muted-foreground">
            {isStaff ? 'Admin' : 'Portal'}
          </Badge>
        </div>
        {canPreview && <Link href="/admin/dealer-view" className="inline-flex min-h-11 items-center gap-2 bg-[#121210] px-3 text-xs font-semibold text-white"><ArrowLeftRight className="h-4 w-4" /> Switch to Dealer View</Link>}
      </header>

      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex w-64 flex-col border-r border-border ${isStaff ? "bg-white" : "bg-card"} shrink-0 sticky top-0 h-[100dvh] overflow-y-auto no-scrollbar`}>
        <div className="p-6">
          <BrandLogo tone="dark" className="h-5 w-auto" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-3">
            {isStaff ? 'Staff Admin' : 'Dealer Portal'}
          </p>
        </div>

        <div className="flex-1 px-4 py-2 space-y-8">
          {!isStaff && (
            <nav className="space-y-1">
              {visibleDealerLinks.map((link) => {
                const isActive = link.exact ? location === link.href : location.startsWith(link.href);
                return (
                  <Link 
                    key={link.href} 
                    href={link.href}
                    className={`flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-foreground text-background' : 'text-foreground/70 hover:bg-muted'} rounded-none`}
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className={`h-4 w-4 ${isActive ? 'text-sidebar-primary' : 'text-muted-foreground'}`} />
                      {link.label}
                    </div>
                    {link.badge !== undefined && link.badge > 0 && (
                      <Badge variant="default" className="h-5 min-w-[20px] rounded-none px-1 text-[10px] bg-sidebar-primary text-primary-foreground flex items-center justify-center">
                        {link.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          )}

          {isStaff && (
            <nav className="space-y-1">
              <h4 className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Management</h4>
              {visibleAdminLinks.map((link) => {
                const isActive = link.exact ? location === link.href : location.startsWith(link.href);
                return (
                  <Link 
                    key={link.href} 
                    href={link.href}
                    className={`flex items-center justify-between px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-sidebar-primary/10 text-sidebar-primary border-l-2 border-sidebar-primary' : 'text-foreground/70 hover:bg-muted border-l-2 border-transparent'} rounded-none`}
                  >
                    <div className="flex items-center gap-3">
                      <link.icon className={`h-4 w-4 ${isActive ? 'text-sidebar-primary' : 'text-muted-foreground'}`} />
                      {link.label}
                    </div>
                  </Link>
                );
              })}
              {canPreview && <Link href="/admin/dealer-view" className="mt-4 flex items-center gap-3 border border-[#121210]/15 px-3 py-2.5 text-sm font-semibold text-[#121210] transition-colors hover:bg-[#B39862]/10">
                <ArrowLeftRight className="h-4 w-4 text-[#806936]" />
                Switch to Dealer View
              </Link>}
            </nav>
          )}
        </div>

        <div className={`p-4 border-t border-border space-y-4 ${isStaff ? "bg-white" : "bg-card"}`}>
          <div className="flex items-center justify-between px-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold truncate max-w-[140px] text-foreground">{session?.account?.displayName || session?.account?.email}</span>
              <span className="text-[10px] text-muted-foreground capitalize truncate">{session?.role}</span>
            </div>
            {!previewDealerId && signOutControl}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-y-auto no-scrollbar pb-20 md:pb-0 bg-background">
        {canPreview && <header className="hidden md:flex justify-end border-b border-border bg-white px-6 py-3"><Link href="/admin/dealer-view" className="inline-flex min-h-11 items-center gap-2 bg-[#121210] px-4 text-sm font-semibold text-white"><ArrowLeftRight className="h-4 w-4" />Switch to Dealer View</Link></header>}
        {children}
      </main>
      
      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-border flex justify-around overflow-x-auto p-2 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {(isStaff ? visibleAdminLinks.filter(l => ['Overview', 'Users', 'Content', 'Notifications'].includes(l.label)) : visibleMobileDealerLinks).map((link) => {
          const isActive = link.exact ? location === link.href : location.startsWith(link.href);
          return (
            <Link 
              key={link.href} 
              href={link.href}
              className={`flex flex-col items-center justify-center p-2 min-w-[64px] transition-colors relative ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              <link.icon className={`h-5 w-5 mb-1 ${isActive ? 'text-sidebar-primary' : ''}`} />
              <span className="text-[10px] font-medium leading-none">{link.label}</span>
              {link.badge !== undefined && link.badge > 0 && (
                <div className="absolute top-1 right-2 w-2 h-2 rounded-full bg-sidebar-primary" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function PortalSignOut() {
  const { signOut } = useClerk();
  return <Button aria-label="Sign out" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}><LogOut className="h-4 w-4" /></Button>;
}
