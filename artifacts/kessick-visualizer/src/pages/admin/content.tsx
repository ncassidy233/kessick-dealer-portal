import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Edit3, FileText, GripVertical, Loader2, Plus, Search, Trash2, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react";
import { safeWebUrl } from "@/lib/content-links";
import { formFieldsError } from "@/lib/form-fields";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  canManage,
  ContentKind,
  createPortalContent,
  deletePortalContent,
  listPortalContent,
  listPortalGroups,
  listPortalUsers,
  portalQueryKeys,
  hasCapability,
  PortalContent,
  PortalContentInput,
  PortalGroup,
  PortalRole,
  updatePortalContent,
  usePortalBootstrap,
  Visibility,
} from "@/lib/portal-admin-api";

type UiKind = ContentKind;
type FormField = { name: string; label: string; type: "text" | "email" | "number" | "date" | "textarea" | "select"; required: boolean; options?: string[] };
type FormSubmission = {
  submission: { id: string; formId: string; accountId: string; values: Record<string, unknown>; submittedAt: string };
  form: { id: string; title: string };
  account: { id: string; email: string; displayName?: string | null };
};
type LegacyFormRecord = { id: string; title: string; description?: string | null; fieldDefinitions: FormField[]; enabled: boolean };
type LegacyResourceRecord = { id: string; title: string; category: string; description?: string | null; url: string; enabled: boolean };
type ContentTarget = "everyone" | "groups" | "individuals";
type KindOption = { value: UiKind; label: string; apiKind: PortalContentInput["kind"] };

const kindOptions: KindOption[] = [
  { value: "project", label: "Projects", apiKind: "project" },
  { value: "price_book", label: "Price books", apiKind: "price_book" },
  { value: "resource_category", label: "Resource categories", apiKind: "resource_category" },
  { value: "product_series", label: "Product series", apiKind: "product_series" },
  { value: "finish", label: "Finishes", apiKind: "finish" },
  { value: "training", label: "Training", apiKind: "training" },
  { value: "launch_kit", label: "Launch kits", apiKind: "launch_kit" },
  { value: "resource", label: "Docs & resources", apiKind: "resource" },
  { value: "form", label: "Forms & requests", apiKind: "form" },
  { value: "announcement", label: "Announcements", apiKind: "announcement" },
];
const ivory = "bg-[#F3F0E8] text-[#121210]";
const card = "border border-[#121210]/10 bg-white/70";
const inputClass = "rounded-none border-[#121210]/15 bg-white/80 text-[#121210] placeholder:text-[#121210]/45";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
function contentUiKind(item: PortalContent): UiKind {
  const explicit = item.payload?.contentType;
  if (typeof explicit === "string" && kindOptions.some((kind) => kind.value === explicit)) return explicit as UiKind;
  const option = kindOptions.find((kind) => kind.apiKind === item.kind);
  return option?.value || "resource";
}
function newField(index: number): FormField {
  return { name: `field_${index + 1}`, label: "", type: "text", required: false };
}
function formatResponseValue(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).join(", ");
  return String(value ?? "—");
}
function csvCell(value: unknown): string {
  const text = String(value ?? "").replace(/\r\n?/g, "\n");
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

export default function AdminContent() {
  const queryClient = useQueryClient();
  const bootstrap = usePortalBootstrap();
  const role = bootstrap.data?.role;
  const canEdit = canManage(role, "content") && hasCapability(bootstrap.data?.capabilities, "content:write");
  // Legacy submissions route is limited to these roles by legacyPortalPathAllowed.
  const canReviewResponses = role === "super_admin" || role === "staff_admin";
  const canReadTargets = hasCapability(bootstrap.data?.capabilities, "groups:read");
  const contentQuery = useQuery({
    queryKey: portalQueryKeys.content(),
    queryFn: () => listPortalContent(),
    enabled: Boolean(bootstrap.data?.authorized),
    staleTime: 20_000,
  });
  const groupsQuery = useQuery({ queryKey: portalQueryKeys.groups, queryFn: listPortalGroups, enabled: Boolean(bootstrap.data?.authorized) && canReadTargets, staleTime: 20_000 });
  const usersQuery = useQuery({ queryKey: portalQueryKeys.users({ role: "dealer" }), queryFn: () => listPortalUsers({ role: "dealer" }), enabled: Boolean(bootstrap.data?.authorized) && canReadTargets, staleTime: 20_000 });
  const content = contentQuery.data?.content ?? [];
  const submissionsQuery = useQuery({
    queryKey: ["portal-v2", "legacy", "form-submissions"],
    queryFn: () => customFetch<FormSubmission[]>("/api/staff/portal/form-submissions", { responseType: "json" }),
    enabled: Boolean(bootstrap.data?.authorized) && canReviewResponses,
    staleTime: 20_000,
  });
  const submissions = submissionsQuery.data ?? [];
  const [submissionSearch, setSubmissionSearch] = useState("");
  const [submissionFormId, setSubmissionFormId] = useState("");
  const filteredSubmissions = useMemo(() => submissions.filter((item) =>
    (!submissionFormId || item.form.id === submissionFormId) &&
    (!submissionSearch.trim() || `${item.form.title} ${item.account.displayName || ""} ${item.account.email} ${Object.values(item.submission.values).map(formatResponseValue).join(" ")}`.toLowerCase().includes(submissionSearch.trim().toLowerCase()))
  ), [submissions, submissionFormId, submissionSearch]);
  const exportSubmissions = () => {
    if (!canReviewResponses || submissionsQuery.error || !filteredSubmissions.length) return;
    const rows = [
      ["Form", "Dealer", "Email", "Submitted", "Response"],
      ...filteredSubmissions.map((item) => [
        item.form.title,
        item.account.displayName || item.account.email,
        item.account.email,
        item.submission.submittedAt,
        JSON.stringify(item.submission.values),
      ]),
    ];
    const blob = new Blob(["\uFEFF", rows.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "kessick-form-responses.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const legacyFormsQuery = useQuery({
    queryKey: ["portal-v2", "legacy", "forms"],
    queryFn: () => customFetch<LegacyFormRecord[]>("/api/staff/portal/forms", { responseType: "json" }),
    enabled: Boolean(bootstrap.data?.authorized) && canEdit,
    staleTime: 30_000,
  });
  const legacyResourcesQuery = useQuery({
    queryKey: ["portal-v2", "legacy", "resources"],
    queryFn: () => customFetch<LegacyResourceRecord[]>("/api/staff/portal/resources", { responseType: "json" }),
    enabled: Boolean(bootstrap.data?.authorized) && canEdit,
    staleTime: 30_000,
  });
  const [syncingLegacyId, setSyncingLegacyId] = useState<string | null>(null);
  const legacyForms = legacyFormsQuery.data ?? [];
  const legacyResources = legacyResourcesQuery.data ?? [];
  const linkedLegacyIds = useMemo(() => new Set(content.flatMap((item) => typeof item.payload?.legacyId === "string" ? [item.payload.legacyId] : [])), [content]);
  const unsyncedForms = legacyForms.filter((item) => !linkedLegacyIds.has(item.id));
  const unsyncedResources = legacyResources.filter((item) => !linkedLegacyIds.has(item.id));
  const groups = groupsQuery.data?.groups ?? [];
  const users = usersQuery.data?.users ?? [];
  const [activeKind, setActiveKind] = useState<UiKind | "all">("all");
  const [search, setSearch] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PortalContent | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<UiKind>("project");
  const [published, setPublished] = useState(false);
  const [target, setTarget] = useState<ContentTarget>("everyone");
  const [targetGroupIds, setTargetGroupIds] = useState<string[]>([]);
  const [targetAccountIds, setTargetAccountIds] = useState<string[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([newField(0)]);
  const [resourceUrl, setResourceUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [projectStatus, setProjectStatus] = useState("");
  const [clientName, setClientName] = useState("");
  const [demoData, setDemoData] = useState(false);
  const [finishColor, setFinishColor] = useState("");
  const [resourceFile, setResourceFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const imageKinds: UiKind[] = ["project", "product_series", "finish", "training", "launch_kit", "resource_category", "resource"];
  const urlKinds: UiKind[] = ["resource", "resource_category", "product_series", "finish", "price_book", "training", "launch_kit"];
  const supportsImage = imageKinds.includes(kind);
  const supportsUrl = urlKinds.includes(kind);
  const existingStoredResource = kind === "resource" && typeof editing?.payload?.url === "string" &&
    /^\/objects\/portal-resources\/[0-9a-f-]{36}$/.test(editing.payload.url) ? editing.payload.url : null;
  const imageError = supportsImage && imageUrl.trim() && !safeWebUrl(imageUrl) ? "Enter an absolute http:// or https:// image URL without spaces or credentials." : "";
  const urlError = supportsUrl && resourceUrl.trim() && !safeWebUrl(resourceUrl) ? "Enter an absolute http:// or https:// link without spaces or credentials." : "";
  const requiredLinkError = published && (kind === "training" || kind === "launch_kit") && !resourceUrl.trim()
    ? "Published training and launch kits need a destination URL. Check the link yourself before publishing."
    : "";

  const visibleContent = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return content.filter((item) => {
      const matchesKind = activeKind === "all" || contentUiKind(item) === activeKind;
      const matchesSearch = !needle || `${item.title} ${item.description || ""}`.toLowerCase().includes(needle);
      return matchesKind && matchesSearch;
    });
  }, [activeKind, content, search]);
  const createMutation = useMutation({ mutationFn: createPortalContent });
  const updateMutation = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<PortalContentInput> }) => updatePortalContent(id, data) });
  const deleteMutation = useMutation({ mutationFn: deletePortalContent });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal-v2", "admin", "content"] });
  const syncLegacyRecord = async (record: LegacyFormRecord | LegacyResourceRecord, kind: "form" | "resource") => {
    setSyncingLegacyId(record.id);
    try {
      await createPortalContent({
        kind,
        title: record.title,
        description: record.description || undefined,
        payload: kind === "form"
          ? { contentType: "form", legacyId: record.id, fieldDefinitions: (record as LegacyFormRecord).fieldDefinitions }
          : { contentType: "resource", legacyId: record.id },
        visibility: "everyone",
        published: record.enabled,
      });
      invalidate();
      toast.success(`${record.title} is now available for v2 targeting`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSyncingLegacyId(null);
    }
  };

  const resetEditor = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setKind("project");
    setPublished(false);
    setTarget("everyone");
    setTargetGroupIds([]);
    setTargetAccountIds([]);
    setFormFields([newField(0)]);
    setResourceUrl("");
    setImageUrl("");
    setProjectStatus("");
    setClientName("");
    setDemoData(false);
    setFinishColor("");
    setResourceFile(null);
  };
  const openEditor = (item?: PortalContent) => {
    if (!item) resetEditor();
    else {
      setEditing(item);
      setTitle(item.title);
      setDescription(item.description || "");
      setKind(contentUiKind(item));
      setPublished(item.published);
      const visibility = item.visibility === "individuals" ? "individuals" : item.visibility === "groups" ? "groups" : "everyone";
      setTarget(visibility);
      setTargetGroupIds(item.targets?.groupIds ?? []);
      setTargetAccountIds(item.targets?.accountIds ?? []);
      setFormFields(Array.isArray(item.payload?.fieldDefinitions) && item.payload.fieldDefinitions.length ? item.payload.fieldDefinitions as FormField[] : [newField(0)]);
      setResourceUrl(typeof item.payload?.url === "string" && !/^\/objects\/portal-resources\/[0-9a-f-]{36}$/.test(item.payload.url) ? item.payload.url : "");
      setImageUrl(typeof item.payload?.imageUrl === "string" ? item.payload.imageUrl : "");
      setProjectStatus(typeof item.payload?.status === "string" ? item.payload.status : "");
      setClientName(typeof item.payload?.clientName === "string" ? item.payload.clientName : "");
      setDemoData(item.payload?.demo === true);
      setFinishColor(typeof item.payload?.color === "string" ? item.payload.color : "");
      setResourceFile(null);
    }
    setIsEditorOpen(true);
  };
  const uploadResource = async () => {
    if (!resourceFile) return null;
    const targetUpload = await customFetch<{ uploadUrl: string; objectPath: string; fileName: string; intentToken: string }>("/api/staff/portal/resource-uploads/request", {
      method: "POST",
      responseType: "json",
      body: JSON.stringify({ fileName: resourceFile.name, contentType: resourceFile.type, byteSize: resourceFile.size }),
    });
    const uploadResponse = await fetch(targetUpload.uploadUrl, { method: "PUT", headers: { "Content-Type": resourceFile.type, "X-Kessick-CSRF": "1" }, body: resourceFile });
    if (!uploadResponse.ok) throw new Error("File upload failed");
    const legacyResource = await customFetch<{ id: string; url: string }>("/api/staff/portal/resource-uploads/complete", {
      method: "POST",
      responseType: "json",
      body: JSON.stringify({
        tempObjectPath: targetUpload.objectPath,
        fileName: resourceFile.name,
        contentType: resourceFile.type,
        byteSize: resourceFile.size,
        title,
        category: kind === "resource" ? "Documents" : "Portal content",
        description: description || null,
        enabled: published,
        intentToken: targetUpload.intentToken,
      }),
    });
    return { legacyId: legacyResource.id, url: legacyResource.url, objectPath: targetUpload.objectPath, fileName: resourceFile.name, contentType: resourceFile.type };
  };
  const save = async () => {
    if (isSavingForm) return;
    if (!title.trim()) return;
    if (kind === "form" && (title.trim().length > 200 || description.trim().length > 2000)) {
      toast.error("Form titles must be at most 200 characters and descriptions at most 2000.");
      return;
    }
    if (imageError || urlError || requiredLinkError) {
      toast.error(imageError || urlError || requiredLinkError);
      return;
    }
    if (target === "groups" && targetGroupIds.length === 0) {
      toast.error("Choose at least one group");
      return;
    }
    if (target === "individuals" && targetAccountIds.length === 0) {
      toast.error("Choose at least one dealer");
      return;
    }
    if (kind === "form") {
      const error = formFieldsError(formFields);
      if (error) { toast.error(error); return; }
    }
    if (resourceFile && kind !== "resource") {
      toast.error("Uploaded files are linked to Docs & resources. Use a secure URL for this content kind.");
      return;
    }
    setIsUploading(Boolean(resourceFile));
    setIsSavingForm(kind === "form");
    try {
      if (kind === "form") {
        const fieldDefinitions = formFields.map((field) => ({
          name: field.name.trim(),
          label: field.label.trim(),
          type: field.type,
          required: field.required,
          ...(field.type === "select" ? { options: (field.options || []).map((option) => option.trim()) } : {}),
        }));
        // One transaction commits the legacy form, visibility targets, and v2 card.
        const saved = await customFetch<{ content: PortalContent; legacyId: string }>(
          `/api/portal-v2/admin/form-records${editing ? `/${editing.id}` : ""}`,
          {
            method: editing ? "PATCH" : "POST",
            responseType: "json",
            body: JSON.stringify({
              title: title.trim(),
              description: description.trim() || null,
              fieldDefinitions,
              visibility: target,
              groupIds: target === "groups" ? targetGroupIds : [],
              accountIds: target === "individuals" ? targetAccountIds : [],
              published,
            }),
          },
        );
        setIsEditorOpen(false);
        invalidate();
        queryClient.invalidateQueries({ queryKey: ["portal-v2", "legacy", "forms"] });
        toast.success(`${saved.content.title} ${editing ? "updated" : "created"}`);
        return;
      }
      const uploaded = resourceFile ? await uploadResource() : null;
      const option = kindOptions.find((item) => item.value === kind) || kindOptions[0];
      const payload: Record<string, unknown> = {
        ...(editing?.payload ?? {}),
        contentType: kind,
        imageUrl: supportsImage ? safeWebUrl(imageUrl) || undefined : undefined,
        status: kind === "project" ? projectStatus.trim() || undefined : undefined,
        clientName: kind === "project" ? clientName.trim() || undefined : undefined,
        demo: kind === "project" ? demoData : undefined,
        color: kind === "finish" ? finishColor.trim() || undefined : undefined,
        url: supportsUrl ? safeWebUrl(resourceUrl) || (resourceFile ? undefined : existingStoredResource || undefined) : undefined,
        ...(uploaded || {}),
      };
      if (editing?.kind === "form" && !uploaded) delete payload.legacyId;
      const data: PortalContentInput = {
        kind: option.apiKind,
        title: title.trim(),
        description: description.trim() || undefined,
        payload,
        visibility: target as Visibility,
        groupIds: target === "groups" ? targetGroupIds : [],
        accountIds: target === "individuals" ? targetAccountIds : [],
        published,
      };
      if (editing) await updateMutation.mutateAsync({ id: editing.id, data });
      else await createMutation.mutateAsync(data);
      setIsEditorOpen(false);
      invalidate();
      toast.success(editing ? "Content updated" : "Content created");
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsUploading(false);
      setIsSavingForm(false);
    }
  };
  const remove = async (item: PortalContent) => {
    if (item.kind === "form") {
      toast.error("Unpublish this form instead. Deleting its card without retiring the linked legacy form could expose it outside its audience.");
      return;
    }
    if (!window.confirm(`Delete "${item.title}"? This removes the content record and its targeting.`)) return;
    try {
      await deleteMutation.mutateAsync(item.id);
      invalidate();
      toast.success("Content deleted");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  if (bootstrap.isLoading || contentQuery.isLoading || groupsQuery.isLoading || usersQuery.isLoading || submissionsQuery.isLoading || legacyFormsQuery.isLoading || legacyResourcesQuery.isLoading) return <Loading />;
  if (bootstrap.error || contentQuery.error || !bootstrap.data) return <ErrorState message={getErrorMessage(bootstrap.error ?? contentQuery.error)} />;

  return (
    <div className={`min-h-full ${ivory} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#121210]/15 pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">Publishing studio</p><h1 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Content</h1><p className="mt-2 text-sm text-[#121210]/60">Create once, target precisely, and publish dealer-facing content without editing payloads by hand.</p></div>{canEdit && <Button className="rounded-none bg-[#121210] text-[#F3F0E8]" onClick={() => openEditor()}><Plus className="mr-2 h-4 w-4" /> New content</Button>}</header>
         <section className="grid gap-3 sm:grid-cols-3"><Stat label="Published" value={content.filter((item) => item.published).length} detail="visible records" /><Stat label="Drafts" value={content.filter((item) => !item.published).length} detail="not yet published" /><Stat label="Results" value={visibleContent.length} detail="matching this view" /></section>
          {canReviewResponses && <section className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-[#121210]/10 px-4 py-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B39862]">Response review</p><h2 className="mt-1 text-lg font-medium">Form submissions</h2></div><span className="text-xs text-[#121210]/50">{submissions.length} response{submissions.length === 1 ? "" : "s"}</span></div>
            {submissionsQuery.error ? <p className="p-4 text-sm text-[#8b382b]">Responses are temporarily unavailable: {getErrorMessage(submissionsQuery.error)}</p> : submissions.length === 0 ? <p className="p-4 text-sm text-[#121210]/55">No dealer responses have been submitted yet.</p> : <>
              <div className="flex flex-wrap items-center gap-2 border-b border-[#121210]/10 p-4"><Input aria-label="Search responses" value={submissionSearch} onChange={(event) => setSubmissionSearch(event.target.value)} placeholder="Search form, dealer, or response" className={`${inputClass} min-w-48 flex-1`} /><select aria-label="Filter by form" value={submissionFormId} onChange={(event) => setSubmissionFormId(event.target.value)} className="h-10 border border-[#121210]/15 bg-white/80 px-3 text-sm"><option value="">All forms</option>{Array.from(new Map(submissions.map((item) => [item.form.id, item.form.title])).entries()).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><Button type="button" variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" disabled={!filteredSubmissions.length} onClick={exportSubmissions}>Export filtered CSV</Button></div>
              {filteredSubmissions.length === 0 ? <p className="p-4 text-sm text-[#121210]/55">No responses match these filters.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-[#121210]/10 bg-[#121210]/[0.035] text-[10px] uppercase tracking-[0.18em] text-[#121210]/55"><tr><th className="px-4 py-3 font-semibold">Form</th><th className="px-4 py-3 font-semibold">Dealer</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Response</th></tr></thead><tbody className="divide-y divide-[#121210]/10">{filteredSubmissions.map((item) => <tr key={item.submission.id}><td className="px-4 py-3 font-medium">{item.form.title}</td><td className="px-4 py-3 text-xs text-[#121210]/60">{item.account.displayName || item.account.email}<div>{item.account.email}</div></td><td className="px-4 py-3 text-xs text-[#121210]/55">{new Date(item.submission.submittedAt).toLocaleString()}</td><td className="max-w-sm px-4 py-3"><div className="flex flex-wrap gap-1">{Object.entries(item.submission.values).map(([key, value]) => <span key={key} className="border border-[#121210]/10 bg-white/60 px-2 py-1 text-xs"><strong className="font-medium">{key}:</strong> {formatResponseValue(value)}</span>)}</div></td></tr>)}</tbody></table></div>}
            </>}
          </section>}
         {canEdit && (legacyFormsQuery.error || legacyResourcesQuery.error) ? <section className={`${card} p-4 text-sm text-[#8b382b]`}>Legacy records could not be checked for v2 visibility links. Existing dealer access remains unchanged.</section> : null}
         {canEdit && (unsyncedForms.length > 0 || unsyncedResources.length > 0) && <section className={`${card} overflow-hidden`}><div className="border-b border-[#121210]/10 px-4 py-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B39862]">Visibility migration</p><h2 className="mt-1 text-lg font-medium">Link existing forms and resources</h2><p className="mt-1 text-xs text-[#121210]/55">Linking creates a v2 record with the legacy ID so private targets remain authoritative without deleting the existing file or submissions.</p></div><div className="divide-y divide-[#121210]/10">{[...unsyncedForms.map((item) => ({ ...item, legacyKind: "form" as const })), ...unsyncedResources.map((item) => ({ ...item, legacyKind: "resource" as const }))].map((item) => <div key={`${item.legacyKind}-${item.id}`} className="flex items-center justify-between gap-4 px-4 py-3"><div><p className="text-sm font-medium">{item.title}</p><p className="text-xs text-[#121210]/50">{item.legacyKind === "form" ? "Existing form and submissions" : "Existing stored resource"} · {item.enabled ? "enabled" : "disabled"}</p></div><Button variant="outline" size="sm" className="shrink-0 rounded-none border-[#121210]/20 bg-transparent" disabled={syncingLegacyId === item.id} onClick={() => syncLegacyRecord(item, item.legacyKind)}>{syncingLegacyId === item.id ? "Linking…" : "Link for targeting"}</Button></div>)}</div></section>}
        <section className={`${card} space-y-4 p-4`}>
          <div className="relative max-w-lg"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/45" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search content" className={`${inputClass} pl-9`} /></div>
          <div className="flex flex-wrap gap-2">{[{ value: "all" as const, label: "All content" }, ...kindOptions].map((item) => <button key={item.value} type="button" onClick={() => setActiveKind(item.value)} className={`border px-3 py-2 text-xs font-semibold transition ${activeKind === item.value ? "border-[#121210] bg-[#121210] text-[#F3F0E8]" : "border-[#121210]/15 bg-white/50 text-[#121210]/60 hover:border-[#B39862]"}`}>{item.label}</button>)}</div>
        </section>
        {visibleContent.length === 0 ? <div className={`${card} px-6 py-16 text-center`}><FileText className="mx-auto h-8 w-8 text-[#B39862]" /><h2 className="mt-3 font-medium">No content in this view</h2><p className="mt-1 text-sm text-[#121210]/55">Create a record or adjust your filters.</p></div> : <section className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b border-[#121210]/10 bg-[#121210]/[0.035] text-[10px] uppercase tracking-[0.18em] text-[#121210]/55"><tr><th className="px-4 py-4 font-semibold">Content</th><th className="px-4 py-4 font-semibold">Audience</th><th className="px-4 py-4 font-semibold">Status</th><th className="px-4 py-4 font-semibold">Updated</th><th className="px-4 py-4 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-[#121210]/10">{visibleContent.map((item) => <tr key={item.id} className="transition hover:bg-[#B39862]/[0.06]"><td className="px-4 py-4"><div className="flex items-start gap-3"><div className="mt-0.5 border border-[#B39862]/40 bg-[#B39862]/10 p-2 text-[#806936]"><FileText className="h-4 w-4" /></div><div><div className="font-medium">{item.title}</div><div className="mt-1 text-xs text-[#B39862]">{kindOptions.find((kindItem) => kindItem.value === contentUiKind(item))?.label || item.kind}</div>{item.description && <div className="mt-1 max-w-sm truncate text-xs text-[#121210]/50">{item.description}</div>}</div></div></td><td className="px-4 py-4 text-xs text-[#121210]/60">{item.visibility === "everyone" ? "Everyone" : item.visibility === "groups" ? `${item.targets.groupIds.length} group${item.targets.groupIds.length === 1 ? "" : "s"}` : `${item.targets.accountIds.length} dealer${item.targets.accountIds.length === 1 ? "" : "s"}`}</td><td className="px-4 py-4"><span className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${item.published ? "border-[#55704b]/35 bg-[#55704b]/10 text-[#3d5a35]" : "border-[#121210]/15 text-[#121210]/55"}`}>{item.published ? "Published" : "Draft"}</span></td><td className="px-4 py-4 text-xs text-[#121210]/50">{new Date(item.updatedAt).toLocaleDateString()}</td><td className="px-4 py-4"><div className="flex justify-end gap-1">{canEdit && <><Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-[#B39862]/15" onClick={() => openEditor(item)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-[#8b382b] hover:bg-[#a64c3b]/10" onClick={() => remove(item)}><Trash2 className="h-4 w-4" /></Button></>}</div></td></tr>)}</tbody></table></div></section>}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-2xl"><DialogHeader><DialogTitle className="text-2xl font-medium">{editing ? "Edit content" : "Create content"}</DialogTitle></DialogHeader><div className="space-y-5 py-3"><div className="grid gap-4 sm:grid-cols-2"><Field label="Content type"><select value={kind} onChange={(event) => { const nextKind = event.target.value as UiKind; setKind(nextKind); if (!imageKinds.includes(nextKind)) setImageUrl(""); if (nextKind !== "project") { setProjectStatus(""); setClientName(""); setDemoData(false); } if (nextKind !== "finish") setFinishColor(""); }} className="h-10 w-full border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none">{kindOptions.map((item) => <option key={item.value} value={item.value} disabled={Boolean(editing) && ((contentUiKind(editing!) === "form") !== (item.value === "form"))}>{item.label}</option>)}</select></Field><Field label="Title"><Input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="A clear dealer-facing title" /></Field></div><Field label="Description (optional)"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} resize-none`} rows={3} placeholder="Give dealers enough context to act." /></Field>
            {supportsImage && <div className="space-y-3 border border-[#121210]/10 bg-white/45 p-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B39862]">Dealer gallery card</p><p className="mt-1 text-xs text-[#121210]/55">Optional image for dealer cards. Leave blank to remove the saved image URL.</p></div><Field label="Image URL"><Input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className={inputClass} placeholder="https://images.example.com/card.jpg" /></Field>{imageError && <p role="alert" className="text-xs text-[#8b382b]">{imageError}</p>}{kind === "project" && <div className="grid gap-3 sm:grid-cols-2"><Field label="Project status"><Input value={projectStatus} onChange={(event) => setProjectStatus(event.target.value)} className={inputClass} placeholder="Featured, planning, installed" /></Field><Field label="Client display name"><Input value={clientName} onChange={(event) => setClientName(event.target.value)} className={inputClass} placeholder="Smith Residence" /></Field></div>}{kind === "project" && <label className="flex items-center gap-2 text-xs text-[#121210]/65"><input type="checkbox" checked={demoData} onChange={(event) => setDemoData(event.target.checked)} className="h-4 w-4 accent-[#B39862]" /> Demo data (show a DEMO badge in dealer galleries)</label>}{kind === "finish" && <Field label="Finish color"><div className="flex gap-2"><Input type="color" value={finishColor || "#B39862"} onChange={(event) => setFinishColor(event.target.value)} className="h-10 w-14 cursor-pointer rounded-none border-[#121210]/15 bg-white/80 p-1" /><Input value={finishColor} onChange={(event) => setFinishColor(event.target.value)} className={inputClass} placeholder="#B39862" /></div></Field>}</div>}
          {kind === "form" && <div className="space-y-3 border border-[#121210]/10 bg-white/45 p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B39862]">Visual form builder</p><p className="mt-1 text-xs text-[#121210]/55">Build fields without editing JSON. Keep field keys stable after collecting responses.</p></div>
              <Button type="button" variant="outline" size="sm" className="rounded-none border-[#121210]/20 bg-transparent" disabled={formFields.length >= 100} onClick={() => setFormFields((fields) => { let index = fields.length; while (fields.some((field) => field.name === `field_${index + 1}`)) index++; return [...fields, newField(index)]; })}><Plus className="mr-1 h-3.5 w-3.5" /> Add field</Button>
            </div>
            {formFields.map((field, index) => <div key={index} className="border border-[#121210]/10 bg-white/70 p-3">
              <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-[#121210]/45"><span className="flex items-center gap-1"><GripVertical className="h-3.5 w-3.5" /> Field {index + 1}</span>{formFields.length > 1 && <button type="button" onClick={() => setFormFields((fields) => fields.filter((_, fieldIndex) => fieldIndex !== index))} className="text-[#8b382b]">Remove</button>}</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input aria-label={`Field ${index + 1} label`} placeholder="Field label" value={field.label} onChange={(event) => setFormFields((fields) => fields.map((item, fieldIndex) => fieldIndex === index ? { ...item, label: event.target.value } : item))} className={inputClass} />
                <Input aria-label={`Field ${index + 1} key`} placeholder="Stable field key" value={field.name} onChange={(event) => setFormFields((fields) => fields.map((item, fieldIndex) => fieldIndex === index ? { ...item, name: event.target.value } : item))} className={inputClass} />
                <select aria-label={`Field ${index + 1} type`} value={field.type} onChange={(event) => setFormFields((fields) => fields.map((item, fieldIndex) => fieldIndex === index ? { ...item, type: event.target.value as FormField["type"] } : item))} className="h-10 border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none"><option value="text">Short answer</option><option value="textarea">Long answer</option><option value="email">Email</option><option value="number">Number</option><option value="date">Date</option><option value="select">Multiple choice</option></select>
                {field.type === "select" && <Input aria-label={`Field ${index + 1} choices`} className={inputClass} placeholder="Choices separated by commas" value={(field.options || []).join(", ")} onChange={(event) => setFormFields((fields) => fields.map((item, fieldIndex) => fieldIndex === index ? { ...item, options: event.target.value.split(",").map((option) => option.trim()) } : item))} />}
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-[#121210]/65"><input type="checkbox" checked={field.required} onChange={(event) => setFormFields((fields) => fields.map((item, fieldIndex) => fieldIndex === index ? { ...item, required: event.target.checked } : item))} className="h-4 w-4 accent-[#B39862]" /> Required</label>
            </div>)}
            {formFieldsError(formFields) && <p role="alert" className="text-xs text-[#8b382b]">{formFieldsError(formFields)}</p>}
          </div>}
            {supportsUrl && <div className="space-y-3 border border-[#121210]/10 bg-white/45 p-4"><Field label={published && (kind === "training" || kind === "launch_kit") ? "Destination URL (required to publish)" : "External URL (optional)"}><Input type="url" value={resourceUrl} onChange={(event) => { setResourceUrl(event.target.value); if (event.target.value) setResourceFile(null); }} className={inputClass} placeholder="https://…" /></Field>{(urlError || requiredLinkError) && <p role="alert" className="text-xs text-[#8b382b]">{urlError || requiredLinkError}</p>}{existingStoredResource && !resourceUrl && !resourceFile && <p className="text-xs text-[#121210]/60">Existing uploaded file remains attached.</p>}<p className="text-xs text-[#121210]/50">Only http(s) links are accepted. Saving does not verify that a destination is reachable or accessible to dealers.</p>{kind === "resource" && <><div className="text-center text-xs uppercase tracking-[0.16em] text-[#121210]/40">or</div><label className="flex cursor-pointer items-center justify-center gap-2 border border-dashed border-[#121210]/20 bg-white/50 px-4 py-5 text-sm text-[#121210]/55 hover:border-[#B39862]"><Upload className="h-4 w-4" />{resourceFile ? resourceFile.name : "Upload a safe file (up to 25 MB)"}<input type="file" className="sr-only" accept=".pdf,.txt,.jpg,.jpeg,.png,.webp" onChange={(event) => { const file = event.target.files?.[0] || null; setResourceFile(file); if (file) setResourceUrl(""); }} /></label><p className="text-xs text-[#121210]/45">PDF, plain text, JPEG, PNG, and WebP are accepted. Office and ZIP files must be shared as external links because embedded active content cannot be safely verified.</p></>}</div>}
          <div className="space-y-3 border border-[#121210]/10 bg-white/45 p-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B39862]">Audience</p><p className="mt-1 text-xs text-[#121210]/55">Choose exactly who can see this record.</p></div><div className="grid gap-2 sm:grid-cols-3">{(["everyone", "groups", "individuals"] as const).map((value) => <button key={value} type="button" onClick={() => setTarget(value)} className={`border px-3 py-3 text-left text-xs font-semibold capitalize ${target === value ? "border-[#121210] bg-[#121210] text-[#F3F0E8]" : "border-[#121210]/15 bg-white/50 text-[#121210]/60"}`}>{value === "individuals" ? "Selected dealers" : value}</button>)}</div>{target === "groups" && (canReadTargets ? <div className="max-h-36 space-y-2 overflow-y-auto border border-[#121210]/10 bg-white/60 p-3">{groups.map((group) => <label key={group.id} className="flex items-center justify-between py-1 text-sm"><span>{group.name}</span><input type="checkbox" checked={targetGroupIds.includes(group.id)} onChange={() => setTargetGroupIds((ids) => ids.includes(group.id) ? ids.filter((id) => id !== group.id) : [...ids, group.id])} className="h-4 w-4 accent-[#B39862]" /></label>)}{groups.length === 0 && <p className="text-xs text-[#121210]/50">No groups available.</p>}</div> : <TargetUnavailable />)}{target === "individuals" && (canReadTargets ? <div className="max-h-36 space-y-2 overflow-y-auto border border-[#121210]/10 bg-white/60 p-3">{users.map((user) => <label key={user.id} className="flex items-center justify-between py-1 text-sm"><span><span className="block">{user.displayName || user.email}</span><span className="text-xs text-[#121210]/45">{user.email}</span></span><input type="checkbox" checked={targetAccountIds.includes(user.id)} onChange={() => setTargetAccountIds((ids) => ids.includes(user.id) ? ids.filter((id) => id !== user.id) : [...ids, user.id])} className="h-4 w-4 accent-[#B39862]" /></label>)}{users.length === 0 && <p className="text-xs text-[#121210]/50">No dealer accounts available.</p>}</div> : <TargetUnavailable />)}</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={published} onChange={(event) => setPublished(event.target.checked)} className="h-4 w-4 accent-[#B39862]" /> Publish immediately</label>
           <section aria-label="Draft card preview" className="border border-[#121210]/15 bg-white/70 p-4">
             <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B39862]">Preview · current editor values</p>
             <p className="mt-1 text-xs text-[#121210]/55">Staff-only preview; not a live dealer view. Links and images are not checked for availability.</p>
             <div className="mt-3 max-w-sm border border-[#121210]/10 bg-white">
               {supportsImage && <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-[#121210]/5 text-xs text-[#121210]/40">{safeWebUrl(imageUrl) ? <img src={safeWebUrl(imageUrl)!} alt="" className="h-full w-full object-cover" /> : "No card image"}{demoData && kind === "project" && <span className="absolute right-2 top-2 bg-white px-2 py-1 text-[10px] text-[#121210]">DEMO</span>}</div>}
               <div className="space-y-2 p-4">
                 <p className="text-[10px] font-semibold uppercase tracking-widest text-[#B39862]">{kindOptions.find((option) => option.value === kind)?.label}</p>
                 <h3 className="font-medium">{title.trim() || "Untitled content"}</h3>
                 {description.trim() && <p className="text-xs text-[#121210]/60">{description.trim()}</p>}
                 {kind === "project" && (projectStatus.trim() || clientName.trim()) && <p className="text-xs text-[#121210]/60">{[projectStatus.trim(), clientName.trim()].filter(Boolean).join(" · ")}</p>}
                 {kind === "finish" && finishColor.trim() && <p className="flex items-center gap-2 text-xs text-[#121210]/60"><span className="h-4 w-4 border border-[#121210]/15" style={{ backgroundColor: finishColor }} />{finishColor}</p>}
                 {kind === "form" && <p className="text-xs text-[#121210]/60">{formFields.filter((field) => field.label.trim()).map((field) => field.label.trim()).join(" · ") || "Add form fields above"}</p>}
                 {supportsUrl && <p className="break-all text-xs text-[#121210]/60">{resourceFile ? `Selected file: ${resourceFile.name}` : safeWebUrl(resourceUrl) ? `Destination: ${resourceUrl.trim()}` : resourceUrl.trim() ? "Invalid destination URL" : existingStoredResource ? "Existing uploaded file" : "No destination link"}</p>}
                 {supportsUrl && safeWebUrl(resourceUrl) && !resourceFile && <a href={safeWebUrl(resourceUrl)!} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-[#806936] underline">Open destination to check access ↗</a>}
               </div>
             </div>
             <p className="mt-2 text-xs text-[#121210]/55">{published ? "Published" : "Draft"} · {target === "everyone" ? "Everyone" : target === "groups" ? `${targetGroupIds.length} selected group(s)` : `${targetAccountIds.length} selected dealer(s)`}</p>
           </section>
        </div><DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setIsEditorOpen(false)}>Cancel</Button><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={!title.trim() || isUploading || isSavingForm || createMutation.isPending || updateMutation.isPending} onClick={save}>{isUploading ? "Uploading…" : isSavingForm || createMutation.isPending || updateMutation.isPending ? "Saving…" : editing ? "Save content" : "Create content"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) { return <div className={`${card} p-4`}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#121210]/50">{label}</p><p className="mt-2 text-3xl font-medium">{value}</p><p className="mt-1 text-xs text-[#121210]/50">{detail}</p></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-1.5"><label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#121210]/55">{label}</label>{children}</div>; }
function TargetUnavailable() { return <p className="border border-[#B39862]/30 bg-[#B39862]/10 p-3 text-xs text-[#121210]/60">Your role can publish content, but cannot enumerate dealer audiences. Choose Everyone or ask a staff admin for targeting.</p>; }
function Loading() { return <div className={`flex min-h-[60vh] items-center justify-center ${ivory}`}><Loader2 className="h-6 w-6 animate-spin text-[#B39862]" /></div>; }
function ErrorState({ message }: { message: string }) { return <div className={`min-h-[60vh] ${ivory} p-6 md:p-10`}><div className="mx-auto max-w-2xl border border-[#a64c3b]/30 bg-[#a64c3b]/10 p-5 text-[#8b382b]"><AlertTriangle className="mb-3 h-5 w-5" /><h2 className="font-medium">Content is unavailable</h2><p className="mt-1 text-sm opacity-80">{message}</p></div></div>; }