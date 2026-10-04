import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, differenceInCalendarDays, parseISO } from "date-fns";
import { BarChart3, Download, Loader2, Lock, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePortalSession } from "@/lib/portal-session";
import { canViewInsights, conciergeKeys, downloadInsightsCsv, errorText, getInsights } from "@/lib/concierge-knowledge-api";
import { ErrorState } from "@/pages/admin/knowledge";

const ivory = "bg-[#F3F0E8] text-[#121210]";
const card = "border border-[#121210]/10 bg-white/70";
const inputClass = "rounded-none border-[#121210]/15 bg-white/80 text-[#121210]";
const btn = "inline-flex items-center justify-center gap-2 h-10 px-4 text-xs font-semibold uppercase tracking-[0.14em] transition disabled:opacity-40";

const utcDay = (d: Date) => format(new Date(d.getTime() + d.getTimezoneOffset() * 60000), "yyyy-MM-dd");
const humanize = (s: string) => s.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "0%");

export default function AdminConciergeInsights() {
  const session = usePortalSession();
  const allowed = canViewInsights(session.data?.role);
  const today = new Date();
  const [draft, setDraft] = useState({ from: utcDay(subDays(today, 29)), to: utcDay(today) });
  const [range, setRange] = useState(draft);
  const [downloading, setDownloading] = useState(false);

  const span = differenceInCalendarDays(parseISO(draft.to), parseISO(draft.from));
  const rangeError = !draft.from || !draft.to ? "Choose both dates." : span < 0 ? "Start date must be on or before end date." : span > 365 ? "Maximum range is 366 days." : "";

  const q = useQuery({ queryKey: conciergeKeys.insights(range.from, range.to), queryFn: () => getInsights(range.from, range.to), enabled: allowed });

  if (session.isLoading) return <div className={`min-h-full ${ivory} p-8`}><Skeleton className="mx-auto h-96 max-w-7xl rounded-none bg-[#121210]/5" /></div>;
  if (session.error || !session.data) return <ErrorState title="Could not confirm your access" message={errorText(session.error) || "Sign in again and retry."} onRetry={() => session.refetch()} />;
  if (!allowed) return <ErrorState title="Concierge insights are restricted" message="Only super admins and staff admins can view concierge usage insights." />;

  const presets = [["7 days", 6], ["30 days", 29], ["90 days", 89], ["1 year", 365]] as const;
  const data = q.data;
  const t = data?.totals;
  const responses = t ? t.answered + t.unanswered + t.failed : 0;
  const maxSource = Math.max(1, ...(data?.sourceUsage.map((s) => s.count) ?? [1]));
  const maxGap = Math.max(1, ...(data?.knowledgeGaps.map((s) => s.count) ?? [1]));

  const exportCsv = async () => {
    setDownloading(true);
    try { await downloadInsightsCsv(range.from, range.to); } catch (e) { toast.error(`CSV download failed: ${errorText(e)}`); } finally { setDownloading(false); }
  };

  return (
    <div className={`min-h-full ${ivory} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#121210]/15 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">Kessick Concierge</p>
            <h1 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Usage insights</h1>
            <p className="mt-2 flex items-start gap-2 text-sm text-[#121210]/60"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B39862]" />Aggregate counts only. No questions, transcripts, dealer names, or projects are shown or exported.</p>
          </div>
          <button type="button" data-testid="button-download-insights-csv" className={`${btn} bg-[#121210] text-[#F3F0E8] hover:bg-[#2a2a26]`} disabled={downloading || !data} onClick={exportCsv}>{downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Download CSV</button>
        </header>

        <section className={`${card} flex flex-col gap-3 p-4 md:flex-row md:items-end`} aria-label="Date range">
          <div className="grid grid-cols-2 gap-3 md:flex md:gap-3">
            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#121210]/55">From (UTC)<Input type="date" data-testid="input-insights-from" value={draft.from} max={draft.to} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className={inputClass} /></label>
            <label className="grid gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#121210]/55">To (UTC)<Input type="date" data-testid="input-insights-to" value={draft.to} min={draft.from} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className={inputClass} /></label>
          </div>
          <button type="button" data-testid="button-apply-range" className={`${btn} border border-[#121210] bg-white hover:bg-[#121210] hover:text-[#F3F0E8]`} disabled={!!rangeError} onClick={() => setRange(draft)}>Apply</button>
          <div className="flex flex-wrap gap-1.5 md:ml-auto">
            {presets.map(([label, days]) => (
              <button key={label} type="button" data-testid={`button-preset-${days + 1}`} className="border border-[#121210]/15 bg-white/50 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#121210]/65 hover:bg-white"
                onClick={() => { const r = { from: utcDay(subDays(new Date(), days)), to: utcDay(new Date()) }; setDraft(r); setRange(r); }}>{label}</button>
            ))}
          </div>
          {rangeError && <p className="text-xs text-[#8b382b] md:basis-full" role="alert" data-testid="text-range-error">{rangeError}</p>}
        </section>

        {q.isLoading ? (
          <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-none bg-[#121210]/5" />)}</div>
        ) : q.error || !data || !t ? (
          <div className={`${card} p-5 text-sm text-[#8b382b]`} role="alert"><p>{errorText(q.error) || "No data returned."}</p><button type="button" data-testid="button-retry-insights" className={`${btn} mt-3 border border-[#121210]/15 bg-white text-[#121210]`} onClick={() => q.refetch()}><RotateCcw className="h-4 w-4" />Retry</button></div>
        ) : (
          <>
            <p className="text-xs text-[#121210]/55" data-testid="text-insights-range">{format(parseISO(data.from), "MMM d, yyyy")} to {format(parseISO(data.to), "MMM d, yyyy")}, inclusive UTC days</p>
            <p className="text-[11px] text-[#121210]/50">Answered, unanswered, and error counts are per assistant response; percentages use their combined total ({responses.toLocaleString()}). A conversation can contain several responses.</p>
            <section className="grid grid-cols-2 gap-px bg-[#121210]/10 md:grid-cols-4" aria-label="Totals">
              {([["Conversations", t.conversations, "conversations", "", "Distinct conversations in range"], ["Answered", t.answered, "answered", pct(t.answered, responses), ""], ["Unanswered", t.unanswered, "unanswered", pct(t.unanswered, responses), "Includes partial answers"], ["Errors", t.failed, "failed", pct(t.failed, responses), ""]] as const).map(([label, val, key, share, note]) => (
                <div key={key} className="bg-white/80 p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#121210]/50">{label}</p>
                  <p className="mt-2 font-serif text-4xl tracking-tight" data-testid={`text-total-${key}`}>{val.toLocaleString()}</p>
                  {share && <p className="mt-1 text-xs text-[#121210]/50" data-testid={`text-share-${key}`}>{share} of completed responses</p>}
                  {note && <p className="mt-1 text-[11px] text-[#121210]/45">{note}</p>}
                </div>
              ))}
            </section>
            {t.conversations === 0 ? (
              <div className={`${card} px-6 py-14 text-center`} data-testid="empty-insights"><BarChart3 className="mx-auto h-6 w-6 text-[#B39862]" /><p className="mt-3 text-sm font-medium">No concierge conversations in this range</p><p className="mt-1 text-xs text-[#121210]/55">Try a wider date range.</p></div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <BarList title="Source usage" subtitle="How often each approved source type grounded an answer." rows={data.sourceUsage.map((s) => ({ key: s.sourceType, label: humanize(s.sourceType), count: s.count }))} max={maxSource} tid="source" tone="#121210" />
                <BarList title="Knowledge gaps" subtitle="Fixed reason buckets for unanswered questions. Use them to decide what to document next." rows={data.knowledgeGaps.map((s) => ({ key: s.reason, label: humanize(s.reason), count: s.count }))} max={maxGap} tid="gap" tone="#B39862" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function BarList({ title, subtitle, rows, max, tid, tone }: { title: string; subtitle: string; rows: { key: string; label: string; count: number }[]; max: number; tid: string; tone: string }) {
  return (
    <section className={`${card} p-5`} aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs text-[#121210]/55">{subtitle}</p>
      {rows.length === 0 ? <p className="mt-6 text-xs text-[#121210]/50" data-testid={`empty-${tid}`}>Nothing recorded in this range.</p> : (
        <ul className="mt-5 space-y-3">
          {rows.map((r) => (
            <li key={r.key} data-testid={`row-${tid}-${r.key}`}>
              <div className="flex justify-between text-xs"><span>{r.label}</span><span className="font-mono" data-testid={`text-${tid}-count-${r.key}`}>{r.count.toLocaleString()}</span></div>
              <div className="mt-1 h-2 bg-[#121210]/5"><div className="h-full origin-left transition-transform duration-500" style={{ width: "100%", transform: `scaleX(${r.count / max})`, background: tone }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
