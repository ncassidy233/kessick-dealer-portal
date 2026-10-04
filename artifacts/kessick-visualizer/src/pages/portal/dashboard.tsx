import { usePortalContent, usePortalNotifications } from "@/hooks/use-portal-v2";
import { usePortalSession } from "@/lib/portal-session";
import { Loader2, ArrowRight, FolderOpen, Bell, Briefcase, GraduationCap, FileText } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export default function PortalDashboard() {
  const { data: session, isLoading: sessionLoading } = usePortalSession();
  const { data: noticesData } = usePortalNotifications();
  const { data: projectsData } = usePortalContent("project");

  if (sessionLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-sidebar-primary" />
      </div>
    );
  }

  const unreadNotices = noticesData?.notifications?.filter(n => !n.readAt) || [];
  const recentProjects = projectsData?.content?.slice(0, 4) || [];

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-12">
      {/* Hero / Greeting */}
      <div className="relative border border-border bg-card shadow-xl overflow-hidden p-8 md:p-12">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none text-sidebar-primary">
          <svg width="200" height="200" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0L24 12L12 24L0 12L12 0Z" />
          </svg>
        </div>
        <div className="relative z-10 space-y-4 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-light tracking-tight text-foreground">
            Welcome back, <span className="font-semibold">{session?.account?.displayName || 'Partner'}</span>.
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Your centralized workspace for Kessick Wholesale. Manage projects, access targeted resources, and stay up to date with our latest collections.
          </p>
          <div className="pt-4 flex flex-col sm:flex-row gap-4">
            <Button asChild className="rounded-none bg-foreground text-background hover:bg-foreground/90 h-12 px-8">
              <Link href="/portal/projects">Open Projects</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none border-border text-foreground hover:bg-muted h-12 px-8">
              <Link href="/portal/collections">Explore Collections</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Alerts / Notifications */}
        <div className="border border-border bg-card p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-muted flex items-center justify-center">
              <Bell className="w-5 h-5 text-sidebar-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Alerts</h3>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{unreadNotices.length} Unread</p>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            {unreadNotices.slice(0, 3).map((notice) => (
              <div key={notice.id} className="border-l-2 border-sidebar-primary pl-3 py-1">
                <p className="text-sm font-medium text-foreground line-clamp-1">{notice.notification.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{formatDistanceToNow(new Date(notice.notification.sentAt!), { addSuffix: true })}</p>
              </div>
            ))}
            {unreadNotices.length === 0 && (
              <p className="text-sm text-muted-foreground italic">You're all caught up.</p>
            )}
          </div>
          <Button variant="link" className="text-sidebar-primary hover:text-foreground px-0 mt-4 self-start rounded-none" asChild>
            <Link href="/portal/notifications">View all notices <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>

        {/* Recent Projects */}
        <div className="border border-border bg-card p-6 flex flex-col md:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-muted flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-sidebar-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Active Projects</h3>
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Recent Activity</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-none border-border" asChild>
              <Link href="/portal/projects">View All</Link>
            </Button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            {recentProjects.map((proj) => {
              const url = proj.payload?.url;
              const CardContent = (
                <>
                  <h4 className="font-medium text-foreground truncate">{proj.title}</h4>
                  <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(proj.updatedAt), { addSuffix: true })}</p>
                </>
              );
              
              const className = "border border-border p-4 hover:border-sidebar-primary/50 transition-colors block bg-background";
              
              if (url) {
                return (
                  <a key={proj.id} href={url} target="_blank" rel="noopener noreferrer" className={className}>
                    {CardContent}
                  </a>
                );
              }
              return (
                <div key={proj.id} className={className}>
                  {CardContent}
                </div>
              );
            })}
            {recentProjects.length === 0 && (
              <div className="col-span-2 flex flex-col items-center justify-center text-center py-8 text-muted-foreground border border-dashed border-border bg-background">
                <p className="text-sm">No recent projects published to your account.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-12">
        <h2 className="text-lg font-medium mb-6 text-foreground">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/portal/pricing" className="group p-5 border border-border bg-card hover:border-sidebar-primary/50 transition-colors flex flex-col gap-3">
            <FileText className="w-6 h-6 text-muted-foreground group-hover:text-sidebar-primary transition-colors" />
            <div>
              <h4 className="font-medium text-foreground">Wholesale Pricing</h4>
              <p className="text-xs text-muted-foreground mt-1">Review custom rates and catalogs</p>
            </div>
          </Link>
          <Link href="/portal/resources" className="group p-5 border border-border bg-card hover:border-sidebar-primary/50 transition-colors flex flex-col gap-3">
            <FolderOpen className="w-6 h-6 text-muted-foreground group-hover:text-sidebar-primary transition-colors" />
            <div>
              <h4 className="font-medium text-foreground">Resource Library</h4>
              <p className="text-xs text-muted-foreground mt-1">CAD blocks, specs, and materials</p>
            </div>
          </Link>
          <Link href="/portal/training" className="group p-5 border border-border bg-card hover:border-sidebar-primary/50 transition-colors flex flex-col gap-3">
            <GraduationCap className="w-6 h-6 text-muted-foreground group-hover:text-sidebar-primary transition-colors" />
            <div>
              <h4 className="font-medium text-foreground">Training Center</h4>
              <p className="text-xs text-muted-foreground mt-1">Product education and onboarding</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
