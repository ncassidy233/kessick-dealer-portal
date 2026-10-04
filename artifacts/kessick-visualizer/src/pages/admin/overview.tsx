import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowRight, BarChart3, Bell, BookOpen, DollarSign, FileText, FolderKanban, Loader2, ShieldCheck, Users, UserRound } from "lucide-react";
import { format } from "date-fns";
import {
  listPortalOverview,
  hasCapability,
  portalQueryKeys,
  usePortalBootstrap,
} from "@/lib/portal-admin-api";

const ivory = "bg-[#F3F0E8] text-[#121210]";
const card = "border border-[#121210]/10 bg-white/70";

export default function AdminOverview() {
  const bootstrap = usePortalBootstrap();
  const overviewQuery = useQuery({
    queryKey: portalQueryKeys.overview,
    queryFn: listPortalOverview,
    enabled: Boolean(bootstrap.data?.authorized) && (bootstrap.data?.role === "super_admin" || bootstrap.data?.role === "staff_admin") && hasCapability(bootstrap.data?.capabilities, "admin:overview"),
    staleTime: 20_000,
  });

  if (bootstrap.isLoading || overviewQuery.isLoading) return <Loading />;
  if (bootstrap.error || overviewQuery.error || !bootstrap.data || !bootstrap.data.authorized || (bootstrap.data.role !== "super_admin" && bootstrap.data.role !== "staff_admin") || !hasCapability(bootstrap.data.capabilities, "admin:overview")) return <ErrorState message={bootstrap.error instanceof Error ? bootstrap.error.message : overviewQuery.error instanceof Error ? overviewQuery.error.message : "This account is not authorized for staff overview."} />;
  const overview = overviewQuery.data;
  if (!overview) return <ErrorState message="The overview did not return any data." />;
  const { counts, recentAudit } = overview;
  const role = bootstrap.data.role;
  const capabilities = bootstrap.data.capabilities;
  const canRead = (capability: string) => hasCapability(capabilities, capability);
  const fullAdmin = role === "super_admin" || role === "staff_admin";

  return (
    <div className={`min-h-full ${ivory} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col gap-4 border-b border-[#121210]/15 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">Trade desk operations</p>
            <h1 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Staff overview</h1>
            <p className="mt-2 text-sm text-[#121210]/60">Choose a task below to manage the dealer portal without editing code. Figures are returned by the staff overview.</p>
          </div>
          <div className="border border-[#B39862]/35 bg-[#B39862]/10 px-4 py-3 text-xs text-[#725a2c]"><span className="font-semibold uppercase tracking-[0.14em]">Signed in as</span><span className="ml-2 capitalize">{role.replaceAll("_", " ")}</span></div>
        </header>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {canRead("users:read") && <DashboardMetric icon={Users} label="Dealer accounts" value={counts.dealers} detail={`${counts.approvedDealers} approved`} href="/admin/users" />}
          {canRead("users:read") && <DashboardMetric icon={UserRound} label="Staff accounts" value={counts.staff} detail="role-managed access" href="/admin/users" />}
          {canRead("groups:read") && <DashboardMetric icon={FolderKanban} label="Groups" value={counts.groups} detail="audience groups" href="/admin/groups" />}
          {canRead("content:read") && <DashboardMetric icon={FileText} label="Content" value={counts.content} detail="all content records" href="/admin/content" />}
        </section>
        <section className={`${card} overflow-hidden`} aria-labelledby="task-heading">
          <div className="border-b border-[#121210]/10 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B39862]">Staff task guide</p><h2 id="task-heading" className="mt-1 text-xl font-medium">What would you like to do?</h2><p className="mt-1 text-xs text-[#121210]/55">Open a workspace, complete the task there, and check the dealer-facing result when appropriate.</p></div>
          <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {canRead("users:read") && <QuickAction href="/admin/users" label="Approve builder accounts" description="Filter pending dealers, review their details, then approve or suspend access. Staff roles are managed here too." icon={Users} />}
            {canRead("groups:read") && <QuickAction href="/admin/groups" label="Set up audiences" description="Create groups and manage dealer membership for targeted content and notices." icon={FolderKanban} />}
            {canRead("content:read") && <QuickAction href="/admin/content" label="Publish content, forms & training" description="Use the content types to build forms, add resources and training, choose an audience, and publish." icon={FileText} />}
            {canRead("pricing:read") && <QuickAction href="/admin/pricing" label="Set pricing overrides" description="Review and maintain custom wholesale rates by SKU for a dealer or group." icon={DollarSign} />}
            {fullAdmin && <QuickAction href="/admin/access" label="Manage access rules" description="Review visibility rules for content and pricing by group or individual." icon={ShieldCheck} />}
            {canRead("content:read") && <QuickAction href="/admin/content" label="Post an announcement" description="Choose Announcements in Content, select the audience, then publish the record." icon={Bell} />}
            {canRead("notifications:read") && <QuickAction href="/admin/notifications" label="Send a notice" description="Draft, schedule, or send a targeted in-app notice; review recipient history and acknowledgements." icon={Bell} />}
            {(fullAdmin || role === "content_manager") && <QuickAction href="/admin/knowledge" label="Review AI knowledge" description="Upload and review a document, select its audience, then activate it for the concierge." icon={BookOpen} />}
            {fullAdmin && <QuickAction href="/admin/concierge-insights" label="Explore concierge insights" description="Review aggregate answer outcomes, source usage, and knowledge gaps by date range." icon={BarChart3} />}
          </div>
        </section>
        <section className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-[#121210]/10 px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B39862]">Follow-up</p><h2 className="mt-1 text-xl font-medium">Check these workspaces</h2></div><Activity className="h-5 w-5 text-[#B39862]" /></div>
            <div className="divide-y divide-[#121210]/10">
              {canRead("users:read") && <QueueItem icon={Users} title="Dealer access review" detail="Filter Accounts by Pending to see which dealers need a decision." href="/admin/users" />}
              {canRead("notifications:read") && <QueueItem icon={Bell} title="Acknowledgements" detail={`${counts.unreadAcknowledgements} required acknowledgement${counts.unreadAcknowledgements === 1 ? "" : "s"} outstanding in the overview`} href="/admin/notifications" />}
              {canRead("notifications:read") && <QueueItem icon={FileText} title="Notification history" detail="Review actual recipient and push attempt records before reporting delivery." href="/admin/notifications" />}
            </div>
          </div>
          <div className={`${card} overflow-hidden`}>
            <div className="border-b border-[#121210]/10 px-5 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B39862]">Traceability</p><h2 className="mt-1 text-xl font-medium">Review changes</h2></div>
            <div className="space-y-2 p-4">
              {fullAdmin && <QuickAction href="/admin/audit" label="Inspect audit history" description="Search recorded administrative actions and their targets." icon={ShieldCheck} />}
            </div>
          </div>
        </section>
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#121210]/10 px-5 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B39862]">Recent changes</p><h2 className="mt-1 text-xl font-medium">Audit trail</h2></div><Link href="/admin/audit" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#725a2c] hover:text-[#121210]">View all <ArrowRight className="h-3.5 w-3.5" /></Link></div>
          {recentAudit.length === 0 ? <p className="px-5 py-10 text-center text-sm text-[#121210]/50">No audit events returned.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b border-[#121210]/10 text-[10px] uppercase tracking-[0.16em] text-[#121210]/50"><tr><th className="px-5 py-3">Action</th><th className="px-5 py-3">Target</th><th className="px-5 py-3">When</th></tr></thead><tbody className="divide-y divide-[#121210]/10">{recentAudit.slice(0, 8).map((event) => <tr key={event.id}><td className="px-5 py-3 font-medium">{event.action}</td><td className="px-5 py-3 text-xs text-[#121210]/55">{event.targetType || "System"}{event.targetId ? ` · ${event.targetId}` : ""}</td><td className="px-5 py-3 text-xs text-[#121210]/50">{format(new Date(event.createdAt), "MMM d, h:mm a")}</td></tr>)}</tbody></table></div>}
        </section>
      </div>
    </div>
  );
}

function DashboardMetric({ icon: Icon, label, value, detail, href }: { icon: typeof Users; label: string; value: number; detail: string; href: string }) {
  return <Link href={href} className={`${card} group block p-5 transition hover:-translate-y-0.5 hover:border-[#B39862]/60`}><div className="flex items-start justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#121210]/50">{label}</span><Icon className="h-4 w-4 text-[#B39862]" /></div><p className="mt-4 text-4xl font-medium">{value}</p><p className="mt-1 text-xs text-[#121210]/50">{detail}</p><ArrowRight className="mt-4 h-4 w-4 text-[#121210]/35 transition group-hover:translate-x-1 group-hover:text-[#B39862]" /></Link>;
}
function QueueItem({ icon: Icon, title, detail, href }: { icon: typeof Users; title: string; detail: string; href: string }) {
  return <Link href={href} className="flex items-center gap-4 px-5 py-4 transition hover:bg-[#B39862]/[0.06]"><span className="border border-[#B39862]/35 bg-[#B39862]/10 p-2 text-[#725a2c]"><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="mt-1 block text-xs text-[#121210]/55">{detail}</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#121210]/35" /></Link>;
}
function QuickAction({ href, label, description, icon: Icon }: { href: string; label: string; description: string; icon: typeof Users }) {
  return <Link href={href} className="group flex items-start justify-between gap-3 border border-[#121210]/10 bg-white/45 px-4 py-4 transition hover:border-[#B39862]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B39862]"><span className="flex min-w-0 items-start gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#B39862]" /><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-relaxed text-[#121210]/60">{description}</span></span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#121210]/35 transition group-hover:translate-x-1" /></Link>;
}
function Loading() { return <div className={`flex min-h-[60vh] items-center justify-center ${ivory}`}><Loader2 className="h-6 w-6 animate-spin text-[#B39862]" /></div>; }
function ErrorState({ message }: { message: string }) { return <div className={`min-h-[60vh] ${ivory} p-6 md:p-10`}><div className="mx-auto max-w-2xl border border-[#a64c3b]/30 bg-[#a64c3b]/10 p-5 text-[#8b382b]"><AlertTriangle className="mb-3 h-5 w-5" /><h2 className="font-medium">Overview is unavailable</h2><p className="mt-1 text-sm opacity-80">{message}</p></div></div>; }