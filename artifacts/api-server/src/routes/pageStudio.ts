import { Router, type RequestHandler } from "express";
import { and, eq } from "drizzle-orm";
import { db, auditEventsTable, portalPageDraftsTable, portalPagePublicationsTable, portalGroupAssignmentsTable, portalGroupMembershipsTable } from "@workspace/db";
import { studioDraftInputSchema, studioPageDocumentSchema, studioPageKeySchema } from "@workspace/api-zod";
import { getAuthorizedStaffRole } from "../middlewares/auth";
import { hasPortalCapability } from "../lib/portalPermissions";
import { isApprovedDealerAccount } from "../lib/portalDealerEligibility";
import { canViewLegacyPortalCapability } from "../lib/portalLegacyAccess";

const router = Router();
const requireCapability = (capability: string): RequestHandler => async (req, res, next) => {
  const role = await getAuthorizedStaffRole(req);
  if (!role || !hasPortalCapability(role, capability)) {
    res.status(403).json({ error: "Page Studio staff permission required." });
    return;
  }
  res.setHeader("Cache-Control", "private, no-store");
  next();
};

router.get("/admin/pages/:pageKey/draft", requireCapability("content:read"), async (req, res) => {
  const key = studioPageKeySchema.safeParse(req.params.pageKey);
  if (!key.success) { res.status(400).json({ error: "This page cannot be edited in Page Studio." }); return; }
  const [draft] = await db.select().from(portalPageDraftsTable).where(eq(portalPageDraftsTable.pageKey, key.data));
  res.json({ draft: draft ?? null });
});

router.put("/admin/pages/:pageKey/draft", requireCapability("content:write"), async (req, res) => {
  const key = studioPageKeySchema.safeParse(req.params.pageKey);
  const input = studioDraftInputSchema.safeParse(req.body);
  if (!key.success || !input.success) { res.status(400).json({ error: "Invalid structured page draft." }); return; }
  const { expectedRevision, document } = input.data;
  const draft = await db.transaction(async transaction => {
    const values = { document, revision: expectedRevision + 1, updatedByAccountId: req.account!.id, updatedAt: new Date() };
    const [saved] = expectedRevision === 0
      ? await transaction.insert(portalPageDraftsTable).values({ pageKey: key.data, ...values }).onConflictDoNothing().returning()
      : await transaction.update(portalPageDraftsTable).set(values).where(and(eq(portalPageDraftsTable.pageKey, key.data), eq(portalPageDraftsTable.revision, expectedRevision))).returning();
    if (saved) await transaction.insert(auditEventsTable).values({
      actorAccountId: req.account!.id, action: "page_studio.draft.saved", targetType: "page", targetId: null,
      metadata: { pageKey: key.data, revision: saved.revision },
    });
    return saved;
  });
  if (!draft) { res.status(409).json({ error: "The draft changed. Reload before saving to avoid overwriting another editor." }); return; }
  res.json({ draft });
});

router.get("/pages/:pageKey", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!req.account || !await isApprovedDealerAccount(req.account.id)) { res.status(403).json({ error: "Approved dealer access required." }); return; }
  const key = studioPageKeySchema.safeParse(req.params.pageKey);
  if (!key.success) { res.status(404).json({ error: "Published page not found." }); return; }
  if (key.data !== "home") {
    const [memberships, assignments] = await Promise.all([
      db.select({ groupId: portalGroupMembershipsTable.groupId }).from(portalGroupMembershipsTable).where(eq(portalGroupMembershipsTable.accountId, req.account.id)),
      db.select({ groupId: portalGroupAssignmentsTable.groupId }).from(portalGroupAssignmentsTable).where(eq(portalGroupAssignmentsTable.accountId, req.account.id)),
    ]);
    const groups = [...new Set([...memberships, ...assignments].map(row => row.groupId))];
    if (!await canViewLegacyPortalCapability(req.account.id, groups, `page:${key.data}`)) { res.status(403).json({ error: "Dealer page access denied." }); return; }
  }
  const [page] = await db.select({ document: portalPagePublicationsTable.document, revision: portalPagePublicationsTable.revision })
    .from(portalPagePublicationsTable).where(eq(portalPagePublicationsTable.pageKey, key.data));
  if (!page) { res.status(404).json({ error: "Published page not found." }); return; }
  const document = studioPageDocumentSchema.safeParse(page.document);
  if (!document.success) { res.status(503).json({ error: "Published page is unavailable." }); return; }
  res.json({ page: { document: document.data, revision: page.revision } });
});

export default router;
