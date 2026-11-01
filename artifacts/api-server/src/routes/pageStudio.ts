import { Router, type RequestHandler } from "express";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  db,
  auditEventsTable,
  portalPageDraftsTable,
  portalPagePublicationsTable,
  portalPageHistoryTable,
  portalGroupAssignmentsTable,
  portalGroupMembershipsTable,
} from "@workspace/db";
import {
  studioDraftInputSchema,
  studioPageDocumentSchema,
  studioPageKeySchema,
  studioPublishInputSchema,
  studioRestoreInputSchema,
} from "@workspace/api-zod";
import { getAuthorizedStaffRole } from "../middlewares/auth";
import { hasPortalCapability } from "../lib/portalPermissions";
import { isApprovedDealerAccount } from "../lib/portalDealerEligibility";
import { dealerReadAccount, staffHasFullDealerAccess } from "../lib/staffDealerRead";
import { canViewLegacyPortalCapability } from "../lib/portalLegacyAccess";

const router = Router();
const requireCapability =
  (capability: string): RequestHandler =>
  async (req, res, next) => {
    const role = await getAuthorizedStaffRole(req);
    if (!role || !hasPortalCapability(role, capability)) {
      res.status(403).json({ error: "Page Studio staff permission required." });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    next();
  };

router.get(
  "/admin/pages/:pageKey/draft",
  requireCapability("content:read"),
  async (req, res) => {
    const key = studioPageKeySchema.safeParse(req.params.pageKey);
    if (!key.success) {
      res
        .status(400)
        .json({ error: "This page cannot be edited in Page Studio." });
      return;
    }
    const [draft] = await db
      .select()
      .from(portalPageDraftsTable)
      .where(eq(portalPageDraftsTable.pageKey, key.data));
    res.json({ draft: draft ?? null });
  },
);

router.put(
  "/admin/pages/:pageKey/draft",
  requireCapability("content:write"),
  async (req, res) => {
    const key = studioPageKeySchema.safeParse(req.params.pageKey);
    const input = studioDraftInputSchema.safeParse(req.body);
    if (!key.success || !input.success) {
      res.status(400).json({ error: "Invalid structured page draft." });
      return;
    }
    const { expectedRevision, document } = input.data;
    const draft = await db.transaction(async (transaction) => {
      const values = {
        document,
        revision: expectedRevision + 1,
        updatedByAccountId: req.account!.id,
        updatedAt: new Date(),
      };
      const [saved] =
        expectedRevision === 0
          ? await transaction
              .insert(portalPageDraftsTable)
              .values({ pageKey: key.data, ...values })
              .onConflictDoNothing()
              .returning()
          : await transaction
              .update(portalPageDraftsTable)
              .set(values)
              .where(
                and(
                  eq(portalPageDraftsTable.pageKey, key.data),
                  eq(portalPageDraftsTable.revision, expectedRevision),
                ),
              )
              .returning();
      if (saved)
        await transaction.insert(auditEventsTable).values({
          actorAccountId: req.account!.id,
          action: "page_studio.draft.saved",
          targetType: "page",
          targetId: null,
          metadata: { pageKey: key.data, revision: saved.revision },
        });
      return saved;
    });
    if (!draft) {
      res
        .status(409)
        .json({
          error:
            "The draft changed. Reload before saving to avoid overwriting another editor.",
        });
      return;
    }
    res.json({ draft });
  },
);

router.get(
  "/admin/pages/:pageKey/history",
  requireCapability("content:read"),
  async (req, res) => {
    const key = studioPageKeySchema.safeParse(req.params.pageKey);
    if (!key.success) {
      res.status(400).json({ error: "Unknown page." });
      return;
    }
    const [history, current] = await Promise.all([
      db
        .select({
          revision: portalPageHistoryTable.revision,
          publishedAt: portalPageHistoryTable.publishedAt,
          publishedByAccountId: portalPageHistoryTable.publishedByAccountId,
        })
        .from(portalPageHistoryTable)
        .where(eq(portalPageHistoryTable.pageKey, key.data))
        .orderBy(desc(portalPageHistoryTable.revision))
        .limit(50),
      db
        .select()
        .from(portalPagePublicationsTable)
        .where(eq(portalPagePublicationsTable.pageKey, key.data)),
    ]);
    res.json({ history, publishedRevision: current[0]?.revision ?? 0 });
  },
);

// The per-page transaction lock serializes publication and restore, including a
// page's first publication. A stale confirmation must never replace newer work.
for (const operation of ["publish", "restore"] as const) {
  router.post(
    `/admin/pages/:pageKey/${operation}`,
    requireCapability("pages:publish"),
    async (req, res) => {
      const key = studioPageKeySchema.safeParse(req.params.pageKey);
      const input =
        operation === "publish"
          ? studioPublishInputSchema.safeParse(req.body)
          : studioRestoreInputSchema.safeParse(req.body);
      if (!key.success || !input.success) {
        res.status(400).json({ error: "Invalid publication request." });
        return;
      }
      const result = await db.transaction(async (transaction) => {
        await transaction.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${"page-studio:" + key.data}))`,
        );
        const [current] = await transaction
          .select()
          .from(portalPagePublicationsTable)
          .where(eq(portalPagePublicationsTable.pageKey, key.data));
        if ((current?.revision ?? 0) !== input.data.expectedPublishedRevision)
          return null;
        let candidate: unknown;
        if (operation === "publish") {
          const [draft] = await transaction
            .select()
            .from(portalPageDraftsTable)
            .where(eq(portalPageDraftsTable.pageKey, key.data))
            .for("update");
          if (
            !draft ||
            !("expectedDraftRevision" in input.data) ||
            draft.revision !== input.data.expectedDraftRevision
          )
            return null;
          candidate = draft.document;
        } else {
          if (!("revision" in input.data)) return null;
          const [previous] = await transaction
            .select()
            .from(portalPageHistoryTable)
            .where(
              and(
                eq(portalPageHistoryTable.pageKey, key.data),
                eq(portalPageHistoryTable.revision, input.data.revision),
              ),
            );
          candidate = previous?.document;
        }
        const parsed = studioPageDocumentSchema.safeParse(candidate);
        if (!parsed.success) return null;
        // Preserve publications created before history was introduced.
        if (current)
          await transaction
            .insert(portalPageHistoryTable)
            .values(current)
            .onConflictDoNothing();
        const values = {
          pageKey: key.data,
          revision: (current?.revision ?? 0) + 1,
          document: parsed.data,
          publishedByAccountId: req.account!.id,
          publishedAt: new Date(),
        };
        const [page] = await transaction
          .insert(portalPagePublicationsTable)
          .values(values)
          .onConflictDoUpdate({
            target: portalPagePublicationsTable.pageKey,
            set: values,
          })
          .returning();
        await transaction.insert(portalPageHistoryTable).values(values);
        await transaction
          .insert(auditEventsTable)
          .values({
            actorAccountId: req.account!.id,
            action: `page_studio.${operation}`,
            targetType: "page",
            targetId: null,
            metadata: {
              pageKey: key.data,
              revision: page.revision,
              sourceRevision:
                "revision" in input.data
                  ? input.data.revision
                  : input.data.expectedDraftRevision,
            },
          });
        return page;
      });
      if (!result) {
        res
          .status(409)
          .json({
            error:
              "The saved draft or published page changed, or that version is unavailable. Reload and review before publishing.",
          });
        return;
      }
      res.json({ page: result });
    },
  );
}

router.get("/pages/:pageKey", async (req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  const account = dealerReadAccount(req);
  const staffAccess = await staffHasFullDealerAccess(req);
  if (!account || (!staffAccess && !(await isApprovedDealerAccount(account.id)))) {
    res.status(403).json({ error: "Approved dealer access required." });
    return;
  }
  const key = studioPageKeySchema.safeParse(req.params.pageKey);
  if (!key.success) {
    res.status(404).json({ error: "Published page not found." });
    return;
  }
  if (!staffAccess && key.data !== "home") {
    const [memberships, assignments] = await Promise.all([
      db
        .select({ groupId: portalGroupMembershipsTable.groupId })
        .from(portalGroupMembershipsTable)
        .where(eq(portalGroupMembershipsTable.accountId, account.id)),
      db
        .select({ groupId: portalGroupAssignmentsTable.groupId })
        .from(portalGroupAssignmentsTable)
        .where(eq(portalGroupAssignmentsTable.accountId, account.id)),
    ]);
    const groups = [
      ...new Set([...memberships, ...assignments].map((row) => row.groupId)),
    ];
    if (
      !(await canViewLegacyPortalCapability(
        account.id,
        groups,
        `page:${key.data}`,
      ))
    ) {
      res.status(403).json({ error: "Dealer page access denied." });
      return;
    }
  }
  const [page] = await db
    .select({
      document: portalPagePublicationsTable.document,
      revision: portalPagePublicationsTable.revision,
    })
    .from(portalPagePublicationsTable)
    .where(eq(portalPagePublicationsTable.pageKey, key.data));
  if (!page) {
    res.status(404).json({ error: "Published page not found." });
    return;
  }
  const document = studioPageDocumentSchema.safeParse(page.document);
  if (!document.success) {
    res.status(503).json({ error: "Published page is unavailable." });
    return;
  }
  res.json({ page: { document: document.data, revision: page.revision } });
});

export default router;
