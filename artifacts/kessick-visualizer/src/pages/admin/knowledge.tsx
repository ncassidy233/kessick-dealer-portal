import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle, Archive, BookOpen, CheckCircle2, Download, FileText, FileUp, Loader2,
  MessageSquare, RotateCcw, Save, Search, ShieldCheck, Trash2, Upload, Users,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConciergePanel } from "@/components/concierge/concierge-panel";
import { usePortalSession } from "@/lib/portal-session";
import {
  KNOWLEDGE_MAX_BYTES, type KnowledgeAudience, type KnowledgeDocument, type KnowledgeStatus,
  canManageKnowledge, conciergeKeys, deleteKnowledge, downloadKnowledgeExport, errorText,
  getKnowledge, listKnowledge, setKnowledgeStatus, updateKnowledge, uploadKnowledge,
} from "@/lib/concierge-knowledge-api";

const ivory = "bg-[#F3F0E8] text-[#121210]";
const card = "border border-[#121210]/10 bg-white/70";
const inputClass = "rounded-none border-[#121210]/15 bg-white/80 text-[#121210] placeholder:text-[#121210]/45";
const btn = "inline-flex items-center justify-center gap-2 h-10 px-4 text-xs font-semibold uppercase tracking-[0.14em] transition disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B39862]";
const btnDark = `${btn} bg-[#121210] text-[#F3F0E8] hover:bg-[#2a2a26]`;
const btnGhost = `${btn} border border-[#121210]/15 bg-white/60 hover:bg-white`;
const btnDanger = `${btn} border border-[#a64c3b]/40 text-[#8b382b] hover:bg-[#a64c3b]/10`;

const statusStyle: Record<KnowledgeStatus, string> = {
  active: "border-[#3d6b4f]/40 bg-[#3d6b4f]/10 text-[#2f5a40]",
  review: "border-[#B39862]/50 bg-[#B39862]/12 text-[#725a2c]",
  archived: "border-[#121210]/20 bg-[#121210]/5 text-[#121210]/55",
  error: "border-[#a64c3b]/40 bg-[#a64c3b]/10 text-[#8b382b]",
};
const statusLabel: Record<KnowledgeStatus, string> = { active: "Active", review: "In review", archived: "Archived", error: "Extraction error" };

function StatusPill({ status, id }: { status: KnowledgeStatus; id: string }) {
  return <span data-testid={`status-knowledge-${id}`} className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${statusStyle[status]}`}>{statusLabel[status]}</span>;
}
function bytes(n: number) { return n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`; }

export default function AdminKnowledge() {
  const session = usePortalSession();
  const allowed = canManageKnowledge(session.data?.role);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: conciergeKeys.list(), queryFn: listKnowledge, enabled: allowed });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | KnowledgeStatus>("all");
  const [exporting, setExporting] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);

  const items = list.data?.items ?? [];
  const filtered = useMemo(() => {
    const n = search.trim().toLowerCase();
    return items.filter((d) => (statusFilter === "all" || d.status === statusFilter) && (!n || `${d.title} ${d.category} ${d.fileName}`.toLowerCase().includes(n)));
  }, [items, search, statusFilter]);
  const counts = useMemo(() => items.reduce((acc, d) => { acc[d.status] = (acc[d.status] ?? 0) + 1; return acc; }, {} as Record<string, number>), [items]);

  const invalidateAll = (id?: string) => {
    qc.invalidateQueries({ queryKey: conciergeKeys.list() });
    if (id) qc.invalidateQueries({ queryKey: conciergeKeys.detail(id) });
  };

  const runExport = async (fmt: "json" | "txt") => {
    setExporting(fmt);
    try { await downloadKnowledgeExport(fmt); } catch (e) { toast.error(`Export failed: ${errorText(e)}`); } finally { setExporting(null); }
  };

  if (session.isLoading) return <PageSkeleton />;
  if (session.error || !session.data) return <ErrorState title="Could not confirm your access" message={errorText(session.error) || "Sign in again and retry."} onRetry={() => session.refetch()} />;
  if (!allowed) return <ErrorState title="Concierge knowledge is restricted" message="Only super admins, staff admins, and content managers can maintain concierge knowledge." />;

  return (
    <div className={`min-h-full ${ivory} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#121210]/15 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">Kessick Concierge</p>
            <h1 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Knowledge library</h1>
            <p className="mt-2 text-sm text-[#121210]/60">Approved documents the concierge may quote from. Answers retrieve exact passages from active documents and cite them. Nothing here trains or fine-tunes a model.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" data-testid="button-test-concierge" aria-haspopup="dialog" className={btnDark} onClick={() => setTestOpen(true)} title="Ask the real concierge; only active documents you can access are cited"><MessageSquare className="h-4 w-4" />Test concierge</button>
            <button type="button" data-testid="button-export-json" className={btnGhost} disabled={!!exporting} onClick={() => runExport("json")}>{exporting === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Export JSON</button>
            <button type="button" data-testid="button-export-txt" className={btnGhost} disabled={!!exporting} onClick={() => runExport("txt")}>{exporting === "txt" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Export TXT</button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div className="space-y-6 min-w-0">
            <UploadPanel onUploaded={(doc) => { invalidateAll(doc.id); setSelectedId(doc.id); }} />

            <section className={card} aria-label="Documents">
              <div className="space-y-3 border-b border-[#121210]/10 p-4">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/45" /><Input aria-label="Search documents" data-testid="input-search-knowledge" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, category, file" className={`${inputClass} pl-9`} /></div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
                  {(["all", "review", "active", "archived", "error"] as const).map((s) => (
                    <button key={s} type="button" data-testid={`filter-status-${s}`} aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)} className={`border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${statusFilter === s ? "border-[#121210] bg-[#121210] text-[#F3F0E8]" : "border-[#121210]/15 bg-white/50 text-[#121210]/60 hover:bg-white"}`}>
                      {s === "all" ? `All ${items.length}` : `${statusLabel[s]} ${counts[s] ?? 0}`}
                    </button>
                  ))}
                </div>
              </div>
              {list.isLoading ? (
                <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-none bg-[#121210]/5" />)}</div>
              ) : list.error ? (
                <div className="p-5 text-sm text-[#8b382b]" role="alert"><p>{errorText(list.error)}</p><button type="button" data-testid="button-retry-knowledge" className={`${btnGhost} mt-3`} onClick={() => list.refetch()}><RotateCcw className="h-4 w-4" />Retry</button></div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-12 text-center" data-testid="empty-knowledge">
                  <BookOpen className="mx-auto h-6 w-6 text-[#B39862]" />
                  <p className="mt-3 text-sm font-medium">{items.length === 0 ? "No knowledge documents yet" : "No documents match"}</p>
                  <p className="mt-1 text-xs text-[#121210]/55">{items.length === 0 ? "Upload a PDF or text file above. It stays staff-only and in review until you activate it." : "Adjust the search or status filter."}</p>
                </div>
              ) : (
                <ul className="max-h-[560px] divide-y divide-[#121210]/10 overflow-y-auto">
                  {filtered.map((d) => (
                    <li key={d.id}>
                      <button type="button" data-testid={`row-knowledge-${d.id}`} onClick={() => setSelectedId(d.id)} aria-current={selectedId === d.id} className={`w-full px-4 py-3 text-left transition ${selectedId === d.id ? "bg-[#B39862]/12 shadow-[inset_3px_0_0_#B39862]" : "hover:bg-[#B39862]/[0.06]"}`}>
                        <div className="flex items-start justify-between gap-3"><span className="min-w-0 truncate text-sm font-medium">{d.title}</span><StatusPill status={d.status} id={d.id} /></div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-[#121210]/50"><span>{d.category}</span><span aria-hidden>/</span><span>{d.audience === "approved_dealers" ? "Staff + approved dealers" : "Staff only"}</span><span aria-hidden>/</span><span>{format(new Date(d.updatedAt), "MMM d")}</span></div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <div className="min-w-0">
            <p className="mb-3 text-[11px] text-[#121210]/55" data-testid="text-test-concierge-hint">Use Test concierge to ask a question and confirm answers cite your active documents. Documents in review, archived, or with errors are never cited.</p>
            {selectedId ? <DocumentEditor key={selectedId} id={selectedId} onChanged={() => invalidateAll(selectedId)} onDeleted={() => { setSelectedId(null); qc.removeQueries({ queryKey: conciergeKeys.detail(selectedId) }); invalidateAll(); }} /> : <HowItWorks />}
          </div>
        </div>
      </div>
      <ConciergePanel open={testOpen} onOpenChange={setTestOpen} />
    </div>
  );
}

function UploadPanel({ onUploaded }: { onUploaded: (doc: KnowledgeDocument) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [localError, setLocalError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({ mutationFn: () => uploadKnowledge(file!, title.trim(), category.trim() || undefined) });

  const pick = (f: File | null) => {
    setLocalError("");
    if (!f) { setFile(null); return; }
    const n = f.name.toLowerCase();
    if (!(n.endsWith(".pdf") || n.endsWith(".txt"))) { setLocalError("Only PDF or TXT files are accepted."); return; }
    if (f.size > KNOWLEDGE_MAX_BYTES) { setLocalError(`File is ${bytes(f.size)}. Maximum is 10 MB.`); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.(pdf|txt)$/i, ""));
  };
  const submit = () => {
    if (!file || !title.trim()) return;
    upload.mutate(undefined, {
      onSuccess: (doc) => {
        if (doc.status === "error") toast.error(`Uploaded, but extraction failed: ${doc.errorMessage ?? "unknown reason"}`);
        else toast.success("Uploaded. Review the extracted text before activating.");
        setFile(null); setTitle(""); setCategory(""); if (inputRef.current) inputRef.current.value = "";
        onUploaded(doc);
      },
    });
  };

  return (
    <section className={`${card} p-4`} aria-labelledby="upload-heading">
      <h2 id="upload-heading" className="flex items-center gap-2 text-sm font-semibold"><FileUp className="h-4 w-4 text-[#B39862]" />Add a document</h2>
      <label data-testid="dropzone-knowledge" className="mt-3 flex cursor-pointer flex-col items-center justify-center border border-dashed border-[#121210]/25 bg-[#F3F0E8]/60 px-4 py-6 text-center transition hover:border-[#B39862] hover:bg-[#B39862]/5"
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0] ?? null); }}>
        <Upload className="h-5 w-5 text-[#121210]/50" />
        <span className="mt-2 text-sm">{file ? <span data-testid="text-selected-file">{file.name} <span className="text-[#121210]/50">({bytes(file.size)})</span></span> : "Choose or drop a PDF or TXT file"}</span>
        <span className="mt-1 text-[11px] text-[#121210]/50">Max 10 MB, 100 PDF pages. Scanned PDFs need OCR first; this app does not read images.</span>
        <input ref={inputRef} data-testid="input-knowledge-file" type="file" accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" aria-label="Knowledge file" onChange={(e) => pick(e.target.files?.[0] ?? null)} />
      </label>
      {localError && <p className="mt-2 text-xs text-[#8b382b]" role="alert" data-testid="text-upload-validation">{localError}</p>}
      <div className="mt-3 grid gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#121210]/55" htmlFor="upload-title">Title</label>
        <Input id="upload-title" data-testid="input-upload-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="e.g. Cooling unit clearance guide" />
        <label className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#121210]/55" htmlFor="upload-category">Category (optional)</label>
        <Input id="upload-category" data-testid="input-upload-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} placeholder="General" />
      </div>
      {upload.error && <p className="mt-2 text-xs text-[#8b382b]" role="alert" data-testid="text-upload-error">{errorText(upload.error)}</p>}
      <button type="button" data-testid="button-upload-knowledge" className={`${btnDark} mt-4 w-full`} disabled={!file || !title.trim() || upload.isPending} onClick={submit}>
        {upload.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Uploading and extracting</> : <><Upload className="h-4 w-4" />Upload for review</>}
      </button>
      <p className="mt-2 text-[11px] text-[#121210]/50">New documents start staff-only and in review.</p>
    </section>
  );
}

function DocumentEditor({ id, onChanged, onDeleted }: { id: string; onChanged: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: conciergeKeys.detail(id), queryFn: () => getKnowledge(id) });
  const doc = detail.data;
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [audience, setAudience] = useState<KnowledgeAudience>("staff");
  const [confirm, setConfirm] = useState<null | "dealers" | "delete" | "activate">(null);
  const initFor = useRef<string | null>(null);

  useEffect(() => {
    if (doc && initFor.current !== doc.updatedAt) {
      initFor.current = doc.updatedAt;
      setTitle(doc.title); setCategory(doc.category); setText(doc.extractedText ?? ""); setAudience(doc.audience);
    }
  }, [doc]);

  const apply = (d: KnowledgeDocument) => { qc.setQueryData(conciergeKeys.detail(id), d); onChanged(); };
  const save = useMutation({
    mutationFn: (confirmDealer: boolean) => updateKnowledge(id, {
      title: title.trim(), category: category.trim() || "General", extractedText: text, audience,
      ...(audience === "approved_dealers" && confirmDealer ? { confirmDealerVisibility: true } : {}),
    }),
    onSuccess: (d) => { apply(d); toast.success("Saved. The document is back in review until you activate it."); },
    onError: (e) => toast.error(errorText(e)),
  });
  const status = useMutation({
    mutationFn: (s: "active" | "review" | "archived") => setKnowledgeStatus(id, s),
    onSuccess: (d) => { apply(d); toast.success(d.status === "active" ? "Activated. The concierge can now cite this document." : d.status === "archived" ? "Archived. Excluded from future answers." : "Moved to review. Excluded from answers."); },
    onError: (e) => toast.error(errorText(e)),
  });
  const remove = useMutation({
    mutationFn: () => deleteKnowledge(id),
    onSuccess: () => { toast.success("Deleted. It is no longer available for retrieval."); onDeleted(); },
    onError: (e) => toast.error(errorText(e)),
  });

  if (detail.isLoading) return <section className={`${card} space-y-3 p-6`}><Skeleton className="h-8 w-1/2 rounded-none bg-[#121210]/5" /><Skeleton className="h-10 rounded-none bg-[#121210]/5" /><Skeleton className="h-72 rounded-none bg-[#121210]/5" /></section>;
  if (detail.error || !doc) return <section className={`${card} p-6 text-sm text-[#8b382b]`} role="alert"><p>{errorText(detail.error) || "Document not found."}</p><button type="button" data-testid="button-retry-document" className={`${btnGhost} mt-3`} onClick={() => detail.refetch()}><RotateCcw className="h-4 w-4" />Retry</button></section>;

  const dirty = title !== doc.title || category !== doc.category || text !== (doc.extractedText ?? "") || audience !== doc.audience;
  const busy = save.isPending || status.isPending || remove.isPending;
  const canActivate = doc.status === "review" && !dirty && (doc.extractedText ?? "").trim().length > 0;
  const onSave = () => {
    if (!title.trim()) { toast.error("Title is required."); return; }
    if (audience === "approved_dealers" && doc.audience !== "approved_dealers") { setConfirm("dealers"); return; }
    save.mutate(audience === "approved_dealers");
  };

  return (
    <section className={card} aria-label={`Edit ${doc.title}`} data-testid="panel-knowledge-editor">
      <div className="flex flex-col gap-3 border-b border-[#121210]/10 p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><StatusPill status={doc.status} id={`detail-${doc.id}`} />{dirty && <span className="text-[11px] text-[#725a2c]" data-testid="text-unsaved">Unsaved changes</span>}</div>
          <p className="mt-2 flex items-center gap-2 truncate text-xs text-[#121210]/55" data-testid="text-document-file"><FileText className="h-3.5 w-3.5 shrink-0" />{doc.fileName} / {bytes(doc.byteSize)} / updated {format(new Date(doc.updatedAt), "MMM d, yyyy h:mm a")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {doc.status === "active" ? (
            <button type="button" data-testid="button-deactivate-knowledge" className={btnGhost} disabled={busy} onClick={() => status.mutate("review")}><RotateCcw className="h-4 w-4" />Deactivate</button>
          ) : doc.status === "archived" ? (
            <button type="button" data-testid="button-restore-knowledge" className={btnGhost} disabled={busy} onClick={() => status.mutate("review")}><RotateCcw className="h-4 w-4" />Restore to review</button>
          ) : doc.status === "review" ? (
            <button type="button" data-testid="button-activate-knowledge" className={btnDark} disabled={busy || !canActivate} title={dirty ? "Save changes first" : undefined} onClick={() => setConfirm("activate")}><CheckCircle2 className="h-4 w-4" />Activate</button>
          ) : null}
          {doc.status !== "archived" && doc.status !== "error" && <button type="button" data-testid="button-archive-knowledge" className={btnGhost} disabled={busy} onClick={() => status.mutate("archived")}><Archive className="h-4 w-4" />Archive</button>}
          <button type="button" data-testid="button-delete-knowledge" className={btnDanger} disabled={busy} onClick={() => setConfirm("delete")}><Trash2 className="h-4 w-4" />Delete</button>
        </div>
      </div>

      {doc.status === "error" && (
        <div className="m-5 mb-0 flex gap-3 border border-[#a64c3b]/30 bg-[#a64c3b]/10 p-4 text-sm text-[#8b382b]" role="alert" data-testid="text-extraction-error">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-medium">Text could not be extracted</p><p className="mt-1 opacity-85">{doc.errorMessage ?? "Unknown error."} If this is a scanned PDF, run OCR elsewhere and upload the text version. This document cannot be activated.</p></div>
        </div>
      )}
      {doc.status === "review" && dirty && <p className="mx-5 mt-4 text-xs text-[#725a2c]">Save your edits, then activate. Every edit returns the document to review.</p>}

      <div className="grid gap-4 p-5 md:grid-cols-2">
        <div className="grid gap-1.5"><label htmlFor="doc-title" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#121210]/55">Title</label><Input id="doc-title" data-testid="input-document-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} /></div>
        <div className="grid gap-1.5"><label htmlFor="doc-category" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#121210]/55">Category</label><Input id="doc-category" data-testid="input-document-category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} /></div>
        <fieldset className="md:col-span-2">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#121210]/55">Who can receive answers from it</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {([["staff", "Staff only", "Default. Kessick staff answers only.", ShieldCheck], ["approved_dealers", "Staff and approved dealers", "Requires confirmation. Approved dealer members may see quoted passages.", Users]] as const).map(([val, label, hint, Icon]) => (
              <label key={val} className={`flex cursor-pointer gap-3 border p-3 transition ${audience === val ? "border-[#121210] bg-white" : "border-[#121210]/15 bg-white/50 hover:bg-white"}`}>
                <input type="radio" name="audience" value={val} checked={audience === val} onChange={() => setAudience(val)} data-testid={`radio-audience-${val}`} className="mt-1 accent-[#121210]" />
                <span><span className="flex items-center gap-1.5 text-sm font-medium"><Icon className="h-3.5 w-3.5 text-[#B39862]" />{label}</span><span className="mt-0.5 block text-[11px] text-[#121210]/55">{hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-1.5 md:col-span-2">
          <div className="flex items-end justify-between"><label htmlFor="doc-text" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#121210]/55">Extracted text</label><span className="text-[11px] text-[#121210]/45" data-testid="text-char-count">{text.length.toLocaleString()} / 200,000</span></div>
          <Textarea id="doc-text" data-testid="input-document-text" value={text} onChange={(e) => setText(e.target.value)} rows={16} className={`${inputClass} font-mono text-xs leading-relaxed`} placeholder="No text extracted." />
          <p className="text-[11px] text-[#121210]/50">Correct extraction errors and remove anything that should never be quoted. The concierge only cites exact passages from this text.</p>
        </div>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[#121210]/10 p-5 sm:flex-row sm:justify-end">
        <button type="button" data-testid="button-reset-document" className={btnGhost} disabled={!dirty || busy} onClick={() => { initFor.current = null; setTitle(doc.title); setCategory(doc.category); setText(doc.extractedText ?? ""); setAudience(doc.audience); }}>Discard changes</button>
        <button type="button" data-testid="button-save-document" className={btnDark} disabled={!dirty || busy} onClick={onSave}>{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save for review</button>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="dealer-portal rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm === "dealers" ? "Share with approved dealers?" : confirm === "delete" ? "Delete this document?" : "Activate this document?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "dealers" ? "Approved dealer members in approved organizations will be able to receive answers that quote this document once it is active. Make sure it contains no internal pricing, margins, or staff-only guidance."
                : confirm === "delete" ? `"${doc.title}" will be removed from the library and immediately excluded from concierge retrieval. This cannot be undone here.`
                : `The concierge will be able to quote "${doc.title}" with citations for ${doc.audience === "approved_dealers" ? "staff and approved dealers" : "staff only"}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel" className="rounded-none">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-action" className={`rounded-none ${confirm === "delete" ? "bg-[#8b382b] text-white hover:bg-[#6f2c22]" : ""}`}
              onClick={() => { if (confirm === "dealers") save.mutate(true); else if (confirm === "delete") remove.mutate(); else status.mutate("active"); setConfirm(null); }}>
              {confirm === "dealers" ? "Confirm dealer visibility" : confirm === "delete" ? "Delete document" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    ["Upload", "PDF or plain text, up to 10 MB. Text is extracted; scanned images are not read (no OCR)."],
    ["Review", "Check the extracted text, title, category, and audience. Edits always return a document to review."],
    ["Activate", "Only active documents are searched. The concierge quotes exact passages and cites the source."],
    ["Retire", "Deactivate, archive, or delete at any time. Future answers stop using it immediately."],
  ];
  return (
    <section className={`${card} p-6 md:p-8`} data-testid="panel-how-it-works">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">How retrieval works</p>
      <h2 className="mt-2 text-2xl font-medium tracking-[-0.02em]">Select a document to review it.</h2>
      <ol className="mt-6 grid gap-px bg-[#121210]/10 sm:grid-cols-2">
        {steps.map(([t, d], i) => (
          <li key={t} className="bg-white/80 p-5"><span className="font-serif text-3xl text-[#B39862]">{String(i + 1).padStart(2, "0")}</span><p className="mt-2 text-sm font-semibold">{t}</p><p className="mt-1 text-xs leading-relaxed text-[#121210]/60">{d}</p></li>
        ))}
      </ol>
      <p className="mt-6 text-xs text-[#121210]/55">No model is trained on these files. Customers never receive knowledge answers; approved dealers only see documents explicitly shared with them.</p>
    </section>
  );
}

function PageSkeleton() { return <div className={`min-h-full ${ivory} p-8`}><div className="mx-auto max-w-7xl space-y-4"><Skeleton className="h-10 w-72 rounded-none bg-[#121210]/5" /><div className="grid gap-6 lg:grid-cols-[380px_1fr]"><Skeleton className="h-96 rounded-none bg-[#121210]/5" /><Skeleton className="h-96 rounded-none bg-[#121210]/5" /></div></div></div>; }
export function ErrorState({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return <div className={`min-h-[60vh] ${ivory} p-6 md:p-10`}><div className="mx-auto max-w-2xl border border-[#a64c3b]/30 bg-[#a64c3b]/10 p-5 text-[#8b382b]" role="alert" data-testid="state-error"><AlertTriangle className="mb-3 h-5 w-5" /><h2 className="font-medium">{title}</h2><p className="mt-1 text-sm opacity-80">{message}</p>{onRetry && <button type="button" data-testid="button-retry" className={`${btnGhost} mt-4`} onClick={onRetry}><RotateCcw className="h-4 w-4" />Retry</button>}</div></div>;
}
