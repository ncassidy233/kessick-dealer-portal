import {
  customFetch,
  getListConciergeKnowledgeQueryKey,
  getGetConciergeKnowledgeQueryKey,
  getGetConciergeInsightsQueryKey,
} from "@workspace/api-client-react";
import type { PortalRole } from "@/lib/portal-admin-api";

const BASE = "/api/staff/concierge";

export const KNOWLEDGE_MAX_BYTES = 10 * 1024 * 1024;
export type KnowledgeAudience = "staff" | "approved_dealers";
export type KnowledgeStatus = "review" | "active" | "archived" | "error";

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  audience: KnowledgeAudience;
  status: KnowledgeStatus;
  extractedText: string;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConciergeInsights {
  from: string;
  to: string;
  totals: { conversations: number; answered: number; unanswered: number; failed: number };
  sourceUsage: { sourceType: string; count: number }[];
  knowledgeGaps: { reason: string; count: number }[];
}

export const conciergeKeys = {
  list: () => getListConciergeKnowledgeQueryKey(),
  detail: (id: string) => getGetConciergeKnowledgeQueryKey(id),
  insights: (from: string, to: string) => getGetConciergeInsightsQueryKey({ from, to }),
};

export function canManageKnowledge(role: PortalRole | string | undefined) {
  return role === "super_admin" || role === "staff_admin" || role === "content_manager";
}
export function canViewInsights(role: PortalRole | string | undefined) {
  return role === "super_admin" || role === "staff_admin";
}

function json<T>(path: string, method: "POST" | "PATCH" | "DELETE", body: unknown) {
  return customFetch<T>(`${BASE}${path}`, {
    method,
    responseType: "json",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function listKnowledge() {
  return customFetch<{ items: KnowledgeDocument[] }>(`${BASE}/knowledge`, { responseType: "json" });
}
export function getKnowledge(id: string) {
  return customFetch<KnowledgeDocument>(`${BASE}/knowledge/${encodeURIComponent(id)}`, { responseType: "json" });
}
export function updateKnowledge(
  id: string,
  body: Partial<{ title: string; category: string; extractedText: string; audience: KnowledgeAudience; confirmDealerVisibility: boolean }>,
) {
  return json<KnowledgeDocument>(`/knowledge/${encodeURIComponent(id)}`, "PATCH", body);
}
export function setKnowledgeStatus(id: string, status: "active" | "review" | "archived") {
  return json<KnowledgeDocument>(`/knowledge/${encodeURIComponent(id)}/status`, "POST", { status });
}
export function deleteKnowledge(id: string) {
  return json<{ ok: true }>(`/knowledge/${encodeURIComponent(id)}`, "DELETE", {});
}

export async function uploadKnowledge(file: File, title: string, category?: string) {
  const contentType = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "text/plain";
  const req = await json<{ uploadId: string; uploadUrl: string; expiresAt: string }>(
    "/knowledge/uploads/request",
    "POST",
    { fileName: file.name, contentType, byteSize: file.size },
  );
  await customFetch<{ ok: true }>(req.uploadUrl, {
    method: "PUT",
    responseType: "json",
    headers: { "Content-Type": contentType, "X-Kessick-CSRF": "1" },
    body: file,
  });
  return json<KnowledgeDocument>(
    `/knowledge/uploads/${encodeURIComponent(req.uploadId)}/complete`,
    "POST",
    category ? { title, category } : { title },
  );
}

async function download(url: string, fallbackName: string) {
  const blob = await customFetch<Blob>(url, { responseType: "blob" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export function downloadKnowledgeExport(format: "json" | "txt") {
  return download(`${BASE}/knowledge/export?format=${format}`, `kessick-concierge-knowledge.${format}`);
}
export function getInsights(from: string, to: string) {
  return customFetch<ConciergeInsights>(`${BASE}/insights?from=${from}&to=${to}`, { responseType: "json" });
}
export function downloadInsightsCsv(from: string, to: string) {
  return download(`${BASE}/insights/export?from=${from}&to=${to}`, `kessick-concierge-insights-${from}-to-${to}.csv`);
}

export function errorText(err: unknown) {
  if (!err) return "";
  const e = err as { data?: { error?: string }; message?: string };
  return e.data?.error || e.message || "Something went wrong.";
}
