import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { and, count, desc, eq, getTableColumns, gte, isNull, lt, sql } from "drizzle-orm";
import {
  db, conciergeKnowledgeTable as knowledge, conciergeKnowledgeUploadsTable as uploads,
  conciergeMessagesTable as messages, conciergeConversationsTable as conversations, auditEventsTable,
} from "@workspace/db";
import { RequestKnowledgeUploadBody, CompleteKnowledgeUploadBody, UpdateConciergeKnowledgeBody, SetConciergeKnowledgeStatusBody } from "@workspace/api-zod";
import { requireAccount, requireStaffRoles } from "../middlewares/auth";
import { ObjectStorageService } from "../lib/objectStorage";
import { uploadHeadersMatch } from "../lib/uploadSecurity";
import { extractKnowledge } from "../lib/knowledgeExtraction";
import { canActivateKnowledge, csvCell, insightDates } from "../lib/knowledgePolicy";
import { configuredOrigins, isAllowedRequestOrigin } from "../security/origin";
import { isMissingKnowledgeSchema } from "../lib/knowledgeAvailability";

const router: IRouter = Router();
const base = "/staff/concierge";
const storage = new ObjectStorageService();
router.use(base, requireAccount, requireStaffRoles(["super_admin", "staff_admin", "content_manager"]), (_req, res, next) => {
  res.setHeader("Cache-Control", "private, no-store"); next();
});
function dto(row: typeof knowledge.$inferSelect & { updatedAtVersion?: string }) {
  const { objectPath: _path, createdByAccountId: _actor, deletedAt: _deleted, updatedAtVersion: _version, ...safe } = row;
  return safe;
}
async function audit(req: Request, action: string, id: string) {
  await db.insert(auditEventsTable).values({ actorAccountId: req.account!.id, action: `concierge.knowledge.${action}`, targetType: "knowledge", targetId: id, metadata: {} });
}
function bad(message: string, status = 400) { return Object.assign(new Error(message), { status }); }
async function document(id: string) {
  if (!z.string().uuid().safeParse(id).success) throw bad("Document not found.", 404);
  // Retain PostgreSQL's full timestamp precision for optimistic status changes;
  // converting through JS Date loses microseconds on defaultNow() records.
  const [row] = await db.select({ ...getTableColumns(knowledge), updatedAtVersion: sql<string>`${knowledge.updatedAt}::text` })
    .from(knowledge).where(and(eq(knowledge.id, id), isNull(knowledge.deletedAt))).limit(1);
  if (!row) throw bad("Document not found.", 404);
  return row;
}
async function intent(req: Request) {
  const id = String(req.params.uploadId);
  if (!z.string().uuid().safeParse(id).success) throw bad("Upload not found.", 404);
  const [row] = await db.select().from(uploads).where(and(eq(uploads.id, id), eq(uploads.accountId, req.account!.id), gte(uploads.expiresAt, new Date()))).limit(1);
  if (!row) throw bad("Upload not found or expired.", 404);
  return row;
}
router.get(`${base}/knowledge`, async (_req, res) => {
  const rows = await db.select({ ...getTableColumns(knowledge), extractedText: sql<string>`''` })
    .from(knowledge).where(isNull(knowledge.deletedAt)).orderBy(desc(knowledge.createdAt)).limit(200);
  res.json({ items: rows.map(dto) });
});
router.get(`${base}/knowledge/export`, async (req, res) => {
  const format = z.enum(["json", "txt"]).parse(req.query.format ?? "json");
  // Explicit cap, rather than silently exporting an incomplete library.
  const rows = await db.select().from(knowledge).where(isNull(knowledge.deletedAt)).orderBy(knowledge.id).limit(501);
  if (rows.length > 500) throw bad("Export exceeds 500 documents. Contact an administrator.", 413);
  const items = rows.map(dto);
  res.setHeader("Content-Disposition", `attachment; filename="kessick-knowledge-${new Date().toISOString().slice(0, 10)}.${format}"`);
  if (format === "json") res.json({ exportedAt: new Date().toISOString(), items });
  else res.type("text/plain").send(items.map(({ extractedText, ...metadata }) => `${JSON.stringify(metadata)}\n\n${extractedText}`).join("\n\n---\n\n"));
});
router.post(`${base}/knowledge/uploads/request`, async (req, res) => {
  const body = RequestKnowledgeUploadBody.parse(req.body);
  if (!body.fileName.trim()) throw bad("A file name is required.");
  const row = await db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`knowledge-upload:${req.account!.id}`}))`);
    const [{ n }] = await tx.select({ n: count() }).from(uploads).where(and(eq(uploads.accountId, req.account!.id), gte(uploads.expiresAt, new Date())));
    if (n >= 10) throw bad("Upload limit reached. Wait ten minutes.", 429);
    const [created] = await tx.insert(uploads).values({ ...body, accountId: req.account!.id, objectPath: storage.createObjectEntityUploadPath(req.account!.id), expiresAt: new Date(Date.now() + 600_000) }).returning();
    return created;
  });
  res.json({ uploadId: row.id, uploadUrl: `/api${base}/knowledge/uploads/${row.id}`, expiresAt: row.expiresAt });
});
router.put(`${base}/knowledge/uploads/:uploadId`, async (req, res) => {
  const row = await intent(req);
  if (req.get("x-kessick-csrf") !== "1") throw bad("Upload CSRF marker required.", 403);
  if (!isAllowedRequestOrigin(req, configuredOrigins())) throw bad("Upload requires a verified same-origin request.", 403);
  if (!uploadHeadersMatch(req.get("content-type"), req.get("content-length"), row.contentType, row.byteSize)) throw bad("Upload headers do not match the authorized file.");
  const [claimed] = await db.update(uploads).set({ status: "uploading" }).where(and(eq(uploads.id, row.id), eq(uploads.status, "pending"))).returning();
  if (!claimed) throw bad("Upload already used. Request a new upload.", 409);
  try {
    const generation = await storage.uploadBoundedObject(row.objectPath, req, row.contentType, row.byteSize);
    await db.update(uploads).set({ status: "uploaded", generation }).where(eq(uploads.id, row.id));
    res.json({ ok: true });
  } catch {
    await db.update(uploads).set({ status: "error" }).where(eq(uploads.id, row.id));
    throw bad("Upload failed size validation or storage transfer. Request a new upload.");
  }
});
router.post(`${base}/knowledge/uploads/:uploadId/complete`, async (req, res) => {
  const body = CompleteKnowledgeUploadBody.parse(req.body);
  if (!body.title.trim() || body.category !== undefined && !body.category.trim()) throw bad("Title and category cannot be blank.");
  const row = await intent(req);
  if (row.status === "complete" && row.documentId) { res.status(201).json(dto(await document(row.documentId))); return; }
  const [claimed] = await db.update(uploads).set({ status: "processing" }).where(and(eq(uploads.id, row.id), eq(uploads.status, "uploaded"))).returning();
  if (!claimed || !row.generation) throw bad("Upload is not ready or completion is already processing.", 409);
  try {
    const file = await storage.getObjectEntityFile(row.objectPath);
    const versioned = file.bucket.file(file.name, { generation: row.generation });
    const [metadata] = await versioned.getMetadata();
    if (Number(metadata.size) !== row.byteSize || metadata.contentType !== row.contentType) throw bad("Stored upload does not match authorization.");
    const [bytes] = await versioned.download();
    if (bytes.length !== row.byteSize) throw bad("Stored upload size mismatch.");
    let extractedText = "", errorMessage: string | null = null;
    try { extractedText = await extractKnowledge(bytes, row.contentType); }
    catch (error) { errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Extraction failed."; }
    // Originals are never served. Even rejected PDFs remain private quarantined data.
    const objectPath = await storage.finalizeObjectEntityUpload(row.objectPath, row.contentType, row.generation, "concierge-knowledge");
    const created = await db.transaction(async tx => {
      const [doc] = await tx.insert(knowledge).values({
        title: body.title.trim(), category: body.category?.trim() ?? "General",
        fileName: row.fileName, contentType: row.contentType, byteSize: row.byteSize,
        objectPath, extractedText, errorMessage, status: errorMessage ? "error" : "review",
        audience: "staff", createdByAccountId: req.account!.id,
      }).returning();
      await tx.update(uploads).set({ status: "complete", documentId: doc.id }).where(eq(uploads.id, row.id));
      return doc;
    });
    await audit(req, "uploaded", created.id);
    res.status(201).json(dto(created));
  } catch (error) {
    await db.update(uploads).set({ status: "error" }).where(eq(uploads.id, row.id));
    throw error;
  }
});
router.get(`${base}/knowledge/:id`, async (req, res) => res.json(dto(await document(String(req.params.id)))));
router.patch(`${base}/knowledge/:id`, async (req, res) => {
  const { confirmDealerVisibility, ...body } = UpdateConciergeKnowledgeBody.parse(req.body);
  if (!Object.keys(body).length || Object.values(body).some(v => typeof v === "string" && !v.trim())) throw bad("Provide nonempty document fields.");
  if (body.audience === "approved_dealers" && !confirmDealerVisibility) throw bad("Confirm that approved dealers may receive quotes from this document.");
  const row = await document(String(req.params.id));
  const [updated] = await db.update(knowledge).set({ ...body, status: "review", errorMessage: body.extractedText ? null : row.errorMessage, updatedAt: sql`greatest(clock_timestamp(), ${knowledge.updatedAt} + interval '1 microsecond')` })
    .where(and(eq(knowledge.id, row.id), isNull(knowledge.deletedAt))).returning();
  if (!updated) throw bad("Document not found.", 404);
  await audit(req, "edited", row.id); res.json(dto(updated));
});
router.post(`${base}/knowledge/:id/status`, async (req, res) => {
  const { status } = SetConciergeKnowledgeStatusBody.parse(req.body);
  const row = await document(String(req.params.id));
  if (status === "active" && !canActivateKnowledge(row)) throw bad("Only reviewed, nonempty, error-free documents can be activated.", 409);
  const [updated] = await db.update(knowledge).set({ status, updatedAt: sql`greatest(clock_timestamp(), ${knowledge.updatedAt} + interval '1 microsecond')` }).where(and(
    eq(knowledge.id, row.id), isNull(knowledge.deletedAt),
    sql`${knowledge.updatedAt} = ${row.updatedAtVersion}::timestamptz`,
    status === "active" ? and(eq(knowledge.status, "review"), isNull(knowledge.errorMessage), sql`length(trim(${knowledge.extractedText})) > 0`) : undefined,
  )).returning();
  if (!updated) throw bad("Only reviewed, nonempty, error-free documents can be activated.", 409);
  await audit(req, status, row.id); res.json(dto(updated));
});
router.delete(`${base}/knowledge/:id`, async (req, res) => {
  const row = await document(String(req.params.id));
  await db.update(knowledge).set({ deletedAt: new Date(), status: "archived", updatedAt: new Date() }).where(eq(knowledge.id, row.id));
  await audit(req, "deleted", row.id); res.json({ ok: true });
});

async function insights(req: Request) {
  let range: ReturnType<typeof insightDates>;
  try { range = insightDates(typeof req.query.from === "string" ? req.query.from : undefined, typeof req.query.to === "string" ? req.query.to : undefined); }
  catch (error) { throw bad(error instanceof Error ? error.message : "Invalid date range."); }
  const within = and(gte(messages.createdAt, range.start), lt(messages.createdAt, range.end), eq(messages.role, "assistant"));
  const counts = await db.select({ status: messages.status, n: count() }).from(messages).where(within).groupBy(messages.status);
  const [{ n: conversationCount }] = await db.select({ n: count() }).from(conversations).where(and(gte(conversations.createdAt, range.start), lt(conversations.createdAt, range.end)));
  const totals = { conversations: conversationCount, answered: 0, unanswered: 0, failed: 0 };
  for (const row of counts) {
    if (row.status === "answered") totals.answered += row.n;
    else if (row.status === "failed") totals.failed += row.n;
    else if (["unknown", "partial"].includes(row.status)) totals.unanswered += row.n;
  }
  // Fixed buckets only: no prompts, titles, quotes, or tenant identifiers leave SQL.
  const sources = await db.execute(sql`
    SELECT CASE WHEN c->>'sourceId' LIKE 'knowledge:%' THEN 'knowledge'
      WHEN c->>'sourceId' LIKE 'catalog:%' THEN 'catalog'
      WHEN c->>'sourceId' LIKE 'project:%' THEN 'project' ELSE 'other' END AS "sourceType",
      count(*)::int AS count
    FROM concierge_messages m, LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(m.citations) = 'array' THEN m.citations ELSE '[]'::jsonb END) c
    WHERE m.role = 'assistant' AND m.created_at >= ${range.start} AND m.created_at < ${range.end}
    GROUP BY 1`);
  return { from: range.from, to: range.to, totals, sourceUsage: sources.rows,
    knowledgeGaps: [{ reason: "insufficient_authorized_sources", count: totals.unanswered }, { reason: "provider_or_validation_failure", count: totals.failed }] };
}
router.get(`${base}/insights`, requireStaffRoles(["super_admin", "staff_admin"]), async (req, res) => res.json(await insights(req)));
router.get(`${base}/insights/export`, requireStaffRoles(["super_admin", "staff_admin"]), async (req, res) => {
  const data = await insights(req);
  const rows: unknown[][] = [["from", "to", "section", "metric", "count"]];
  for (const [metric, value] of Object.entries(data.totals)) rows.push([data.from, data.to, "totals", metric, value]);
  for (const row of data.sourceUsage) rows.push([data.from, data.to, "source_usage", row.sourceType, row.count]);
  for (const row of data.knowledgeGaps) rows.push([data.from, data.to, "knowledge_gaps", row.reason, row.count]);
  res.setHeader("Content-Disposition", `attachment; filename="kessick-insights-${data.from}-${data.to}.csv"`);
  res.type("text/csv").send(rows.map(row => row.map(csvCell).join(",")).join("\r\n"));
});
router.use(base, (error: unknown, req: Request, res: import("express").Response, _next: import("express").NextFunction) => {
  if (isMissingKnowledgeSchema(error)) {
    req.log.error({ event: "concierge.knowledge.migration_required" }, "Knowledge database schema unavailable");
    res.status(503).json({ error: "Knowledge library unavailable: an administrator must apply the knowledge database migration before use." });
    return;
  }
  const validation = error instanceof z.ZodError || error instanceof Error && error.name === "ZodError";
  const status = validation ? 400 : Number((error as { status?: number })?.status) || 500;
  if (status >= 500) req.log.error({ err: error }, "Knowledge operation failed");
  res.status(status).json({ error: validation ? "Invalid request fields." : status < 500 && error instanceof Error ? error.message : "Knowledge operation failed. Please try again." });
});
export default router;