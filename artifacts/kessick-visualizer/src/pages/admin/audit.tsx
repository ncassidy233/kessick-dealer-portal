import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Filter, Loader2, Search, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { canManage, listPortalAudit, portalQueryKeys, usePortalBootstrap } from "@/lib/portal-admin-api";

const ivory = "bg-[#F3F0E8] text-[#121210]";
const card = "border border-[#121210]/10 bg-white/70";
const inputClass = "rounded-none border-[#121210]/15 bg-white/80 text-[#121210] placeholder:text-[#121210]/45";

export default function AdminAudit() {
  const bootstrap = usePortalBootstrap();
  const auditQuery = useQuery({
    queryKey: portalQueryKeys.audit,
    queryFn: listPortalAudit,
    enabled: Boolean(bootstrap.data?.authorized) && canManage(bootstrap.data?.role, "audit"),
    staleTime: 15_000,
  });
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("all");
  const events = auditQuery.data ?? [];
  const actions = Array.from(new Set(events.map((event) => event.action))).sort();
  const filteredEvents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return events.filter((event) => {
      const matchesAction = action === "all" || event.action === action;
      const matchesSearch = !needle || `${event.action} ${event.actorAccountId || ""} ${event.targetType || ""} ${event.targetId || ""}`.toLowerCase().includes(needle);
      return matchesAction && matchesSearch;
    });
  }, [action, events, search]);

  if (bootstrap.isLoading || auditQuery.isLoading) return <Loading />;
  if (bootstrap.error || auditQuery.error || !bootstrap.data) return <ErrorState message={bootstrap.error instanceof Error ? bootstrap.error.message : "Try again later."} />;
  if (!canManage(bootstrap.data.role, "audit")) return <ErrorState message="Your role does not have access to audit history." />;

  return (
    <div className={`min-h-full ${ivory} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#121210]/15 pb-6 md:flex-row md:items-end md:justify-between"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">Governance & traceability</p><h1 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Audit history</h1><p className="mt-2 text-sm text-[#121210]/60">Every role, access, audience, content, notification, and delivery action leaves a record.</p></div><div className="flex items-center gap-2 text-xs text-[#121210]/50"><Activity className="h-4 w-4 text-[#B39862]" /> {events.length} total events</div></header>
        <section className={`${card} flex flex-col gap-3 p-4 lg:flex-row`}><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/45" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search action, actor, or target" className={`${inputClass} pl-9`} /></div><div className="relative lg:w-64"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/45" /><select value={action} onChange={(event) => setAction(event.target.value)} className="h-10 w-full border border-[#121210]/15 bg-white/80 pl-9 pr-3 text-sm outline-none"><option value="all">All actions</option>{actions.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></section>
        <section className={`${card} overflow-hidden`}><div className="border-b border-[#121210]/10 px-5 py-4"><p className="text-xs text-[#121210]/55">{filteredEvents.length} matching record{filteredEvents.length === 1 ? "" : "s"}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-[#121210]/10 bg-[#121210]/[0.035] text-[10px] uppercase tracking-[0.18em] text-[#121210]/55"><tr><th className="px-5 py-4">Time</th><th className="px-5 py-4">Action</th><th className="px-5 py-4">Actor</th><th className="px-5 py-4">Target</th><th className="px-5 py-4">Details</th></tr></thead><tbody className="divide-y divide-[#121210]/10">{filteredEvents.map((event) => <tr key={event.id} className="transition hover:bg-[#B39862]/[0.06]"><td className="whitespace-nowrap px-5 py-4 text-xs text-[#121210]/50">{format(new Date(event.createdAt), "MMM d, yyyy")}<span className="ml-2">{format(new Date(event.createdAt), "h:mm:ss a")}</span></td><td className="px-5 py-4"><Badge variant="outline" className="rounded-none border-[#B39862]/40 bg-[#B39862]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#725a2c]">{event.action}</Badge></td><td className="max-w-[180px] truncate px-5 py-4 font-mono text-xs text-[#121210]/55" title={event.actorAccountId || "System"}>{event.actorAccountId || "System"}</td><td className="px-5 py-4 text-xs text-[#121210]/60"><span className="capitalize">{event.targetType || "System"}</span>{event.targetId && <span className="ml-1 font-mono text-[#121210]/45">· {event.targetId}</span>}</td><td className="max-w-[280px] px-5 py-4 text-xs text-[#121210]/55">{event.metadata && Object.keys(event.metadata).length > 0 ? <div className="flex flex-wrap gap-1">{Object.entries(event.metadata).slice(0, 4).map(([key, value]) => <span key={key} className="border border-[#121210]/10 bg-white/50 px-2 py-1">{key}: {String(value)}</span>)}</div> : "—"}</td></tr>)}{filteredEvents.length === 0 && <tr><td colSpan={5} className="px-5 py-16 text-center text-sm text-[#121210]/50">No audit records match this filter.</td></tr>}</tbody></table></div></section>
      </div>
    </div>
  );
}

function Loading() { return <div className={`flex min-h-[60vh] items-center justify-center ${ivory}`}><Loader2 className="h-6 w-6 animate-spin text-[#B39862]" /></div>; }
function ErrorState({ message }: { message: string }) { return <div className={`min-h-[60vh] ${ivory} p-6 md:p-10`}><div className="mx-auto max-w-2xl border border-[#a64c3b]/30 bg-[#a64c3b]/10 p-5 text-[#8b382b]"><AlertTriangle className="mb-3 h-5 w-5" /><h2 className="font-medium">Audit history is unavailable</h2><p className="mt-1 text-sm opacity-80">{message}</p></div></div>; }