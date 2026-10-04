import { Router, type IRouter, type Request, type Response } from "express";
import { accountsTable, auditEventsTable, db, portalContentTable, portalContentTargetsTable, portalFormsTable, portalGroupsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getAuthorizedStaffRole } from "../middlewares/auth";
import { hasPortalCapability } from "../lib/portalPermissions";

const router: IRouter = Router();
const uuid = z.string().uuid();
const field = z.object({
  name: z.string().trim().min(1).max(120).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
  label: z.string().trim().min(1).max(200),
  type: z.enum(["text", "email", "number", "date", "textarea", "select"]),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.type === "select" && !value.options?.length) ctx.addIssue({ code: "custom", message: "Select fields require options." });
  if (value.type !== "select" && value.options?.length) ctx.addIssue({ code: "custom", message: "Only select fields may have options." });
});
export const linkedFormInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable(),
  fieldDefinitions: z.array(field).min(1).max(100).superRefine((fields, ctx) => {
    const names = new Set<string>();
    fields.forEach((value, index) => {
      if (names.has(value.name)) ctx.addIssue({ code: "custom", path: [index, "name"], message: "Field names must be unique." });
      names.add(value.name);
    });
  }),
  visibility: z.enum(["everyone", "groups", "individuals"]),
  groupIds: z.array(uuid).max(500),
  accountIds: z.array(uuid).max(1000),
  published: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if (value.visibility === "everyone" && (value.groupIds.length || value.accountIds.length))
    ctx.addIssue({ code: "custom", message: "Everyone content cannot have targets." });
  if (value.visibility === "groups" && (!value.groupIds.length || value.accountIds.length))
    ctx.addIssue({ code: "custom", message: "Group content requires group targets only." });
  if (value.visibility === "individuals" && (!value.accountIds.length || value.groupIds.length))
    ctx.addIssue({ code: "custom", message: "Individual content requires dealer targets only." });
  if (new Set(value.groupIds).size !== value.groupIds.length || new Set(value.accountIds).size !== value.accountIds.length)
    ctx.addIssue({ code: "custom", message: "Duplicate targets are not allowed." });
});

router.use(async (req, res, next): Promise<void> => {
  const role = await getAuthorizedStaffRole(req);
  if (!role || !hasPortalCapability(role, "content:write")) {
    res.status(403).json({ error: "Insufficient portal privilege." });
    return;
  }
  next();
});

async function save(req: Request, res: Response, contentId?: string): Promise<void> {
  const body = linkedFormInput.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid linked form.", details: body.error.flatten() }); return; }
  const data = body.data;
  try {
    const result = await db.transaction(async (tx) => {
      // Serialize writers for this mapping even before a content row exists. A legacy
      // form row is locked on updates, so a second linked update cannot fork it.
      if (contentId) await tx.execute(sql`select pg_advisory_xact_lock(hashtext('portal_form_link'), hashtext(${contentId}))`);
      if (data.groupIds.length) {
        const groups = await tx.select({ id: portalGroupsTable.id }).from(portalGroupsTable).where(inArray(portalGroupsTable.id, data.groupIds));
        if (groups.length !== data.groupIds.length) throw new Error("One or more target groups do not exist.");
      }
      if (data.accountIds.length) {
        const dealers = await tx.select({ id: accountsTable.id }).from(accountsTable)
          .where(and(inArray(accountsTable.id, data.accountIds), eq(accountsTable.role, "dealer")));
        if (dealers.length !== data.accountIds.length) throw new Error("One or more targets are not dealer accounts.");
      }
      let legacyId: string;
      let existing: typeof portalContentTable.$inferSelect | undefined;
      if (contentId) {
        [existing] = await tx.select().from(portalContentTable).where(eq(portalContentTable.id, contentId)).for("update").limit(1);
        if (!existing || existing.kind !== "form") throw new Error("Linked form content not found.");
        const payload = existing.payload;
        legacyId = typeof payload === "object" && payload !== null && !Array.isArray(payload) && typeof payload.legacyId === "string" && uuid.safeParse(payload.legacyId).success
          ? payload.legacyId : "";
        if (!legacyId) throw new Error("Content is not linked to a legacy form.");
        const [legacy] = await tx.update(portalFormsTable).set({
          title: data.title, description: data.description, fieldDefinitions: data.fieldDefinitions,
          enabled: data.published, updatedAt: new Date(),
        }).where(eq(portalFormsTable.id, legacyId)).returning();
        if (!legacy) throw new Error("Linked legacy form not found.");
      } else {
        const [legacy] = await tx.insert(portalFormsTable).values({
          title: data.title, description: data.description, fieldDefinitions: data.fieldDefinitions,
          // Never enable a legacy record before its visibility mapping commits.
          enabled: data.published, createdByAccountId: req.account!.id,
        }).returning();
        legacyId = legacy.id;
      }
      // No schema migration: an advisory lock on the legacy key serializes linked
      // saves, while this check rejects pre-existing duplicate JSON mappings.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext('portal_form_legacy'), hashtext(${legacyId}))`);
      const duplicates = await tx.select({ id: portalContentTable.id }).from(portalContentTable)
        .where(and(eq(portalContentTable.kind, "form"), sql`${portalContentTable.payload}->>'legacyId' = ${legacyId}`));
      if (duplicates.some((row) => row.id !== contentId)) throw new Error("Legacy form is already linked to other content.");
      const payload = { legacyId, fieldDefinitions: data.fieldDefinitions };
      const [content] = existing
        ? await tx.update(portalContentTable).set({
          title: data.title, description: data.description, payload, visibility: data.visibility,
          published: data.published, updatedAt: new Date(),
        }).where(eq(portalContentTable.id, existing.id)).returning()
        : await tx.insert(portalContentTable).values({
          kind: "form", title: data.title, description: data.description, payload,
          visibility: data.visibility, published: data.published, createdByAccountId: req.account!.id,
        }).returning();
      await tx.delete(portalContentTargetsTable).where(eq(portalContentTargetsTable.contentId, content.id));
      const targets = [
        ...data.groupIds.map((groupId) => ({ contentId: content.id, groupId, accountId: null })),
        ...data.accountIds.map((accountId) => ({ contentId: content.id, groupId: null, accountId })),
      ];
      if (targets.length) await tx.insert(portalContentTargetsTable).values(targets);
      await tx.insert(auditEventsTable).values({
        actorAccountId: req.account!.id, action: existing ? "portal_v2.form.updated" : "portal_v2.form.created",
        targetType: "content", targetId: content.id,
        metadata: { legacyId, visibility: data.visibility, published: data.published, groupIds: data.groupIds, accountIds: data.accountIds },
      });
      return { content: { ...content, targets: { groupIds: data.groupIds, accountIds: data.accountIds } }, legacyId };
    });
    res.status(contentId ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof Error && (
      error.message.includes("target groups") || error.message.includes("dealer accounts") ||
      error.message.includes("Legacy form is already linked") || error.message.includes("Content is not linked")
    )) { res.status(400).json({ error: error.message }); return; }
    if (error instanceof Error && (error.message === "Linked form content not found." || error.message === "Linked legacy form not found.")) {
      res.status(404).json({ error: error.message }); return;
    }
    throw error;
  }
}

router.post("/", async (req, res) => save(req, res));
router.patch("/:contentId", async (req, res): Promise<void> => {
  const id = uuid.safeParse(req.params.contentId);
  if (!id.success) { res.status(400).json({ error: "Invalid content id." }); return; }
  await save(req, res, id.data);
});

export default router;