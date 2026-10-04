import type { Request } from "express";
import { db, conciergeKnowledgeTable as knowledge } from "@workspace/db";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { getAuthorizedStaffRole } from "../middlewares/auth";
import { isApprovedDealerAccount } from "./portalDealerEligibility";
import { knowledgeSnippets, knowledgeTerms } from "./knowledgePolicy";
import { knowledgeSchemaOperation } from "./knowledgeAvailability";

export async function knowledgeAudience(req: Request): Promise<"staff" | "approved_dealers" | null> {
  if (!req.account) return null;
  const role = await getAuthorizedStaffRole(req);
  if (role) return "staff";
  return await isApprovedDealerAccount(req.account.id) ? "approved_dealers" : null;
}
export async function retrieveKnowledge(req: Request, query: string) {
  const audience = await knowledgeAudience(req);
  const terms = knowledgeTerms(query);
  if (!audience || !terms.length) return [];
  const rows = await knowledgeSchemaOperation(async () => db.select({ id: knowledge.id, text: knowledge.extractedText })
    .from(knowledge).where(and(
      eq(knowledge.status, "active"), isNull(knowledge.deletedAt),
      audience === "staff" ? undefined : eq(knowledge.audience, "approved_dealers"),
      or(...terms.map(term => sql`position(${term} in lower(${knowledge.extractedText})) > 0`)),
    )).orderBy(knowledge.id).limit(24));
  return rows.flatMap(row => knowledgeSnippets(row.text, terms).map((text, i) => ({
    sourceId: `knowledge:${row.id}:${i}`, text,
    score: terms.reduce((n, t) => n + Number(text.toLowerCase().includes(t)), 0),
  }))).sort((a, b) => b.score - a.score).slice(0, 6);
}

/** Recheck eligibility at response time, not merely at retrieval time. */
export async function currentKnowledgeSources(req: Request, sourceIds: string[]) {
  if (sourceIds.length === 0) return new Map<string, string>();
  const audience = await knowledgeAudience(req);
  const ids = [...new Set(sourceIds.map(id => /^knowledge:([0-9a-f-]{36}):\d+$/.exec(id)?.[1]).filter((id): id is string => Boolean(id)))].slice(0, 100);
  const sources = new Map<string, string>();
  if (!audience || !ids.length) return sources;
  const rows = await knowledgeSchemaOperation(async () => db.select({ id: knowledge.id, text: knowledge.extractedText }).from(knowledge).where(and(
    inArray(knowledge.id, ids), eq(knowledge.status, "active"), isNull(knowledge.deletedAt),
    audience === "staff" ? undefined : eq(knowledge.audience, "approved_dealers"),
  )));
  for (const row of rows) for (const sourceId of sourceIds) {
    if (sourceId.startsWith(`knowledge:${row.id}:`)) sources.set(sourceId, row.text);
  }
  return sources;
}