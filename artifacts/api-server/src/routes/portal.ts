import { Router, type IRouter } from "express";
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import webPush from "web-push";
import {
  accountsTable, auditEventsTable, db, dealerOrganizationsTable,
  organizationMembershipsTable, portalAccessRulesTable, portalFormsTable,
  portalFormSubmissionsTable, portalGroupAssignmentsTable, portalGroupsTable,
  portalNotificationsTable, portalNotificationRecipientsTable, portalPriceOverridesTable,
  portalPushSubscriptionsTable, portalResourcesTable, pricebookLinesTable, pricebooksTable,
  portalContentTable, portalContentTargetsTable, portalGroupMembershipsTable,
} from "@workspace/db";
import { getAuthorizedStaffRole, requireAccount, requireActiveAccount, requireStaffRoles } from "../middlewares/auth";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import { legacyPortalPathAllowed } from "../lib/portalPermissions";
import { canManagePortalPricing, priceOverrideInput } from "../lib/portalPricing";
import { isMappedLegacyItemVisible } from "../lib/portalTargetPolicy";
import { validatePortalFormSubmission } from "../lib/portalFormSubmission";
import { canViewLegacyPortalCapability, resolvedLegacyPortalCapabilities } from "../lib/portalLegacyAccess";
import { z } from "zod";
import {
  configurePushFromEnvironment,
  isAllowedPushEndpoint,
  mapWithConcurrency,
  PUSH_MAX_CONCURRENCY,
  PUSH_MAX_SUBSCRIPTIONS_PER_ACCOUNT,
  PUSH_MAX_SUBSCRIPTIONS_PER_DISPATCH,
  PUSH_SEND_TIMEOUT_MS,
} from "../lib/pushSecurity";
import {
  PORTAL_RESOURCE_MAX_BYTES,
  issueResourceUploadIntent,
  portalResourceTypes,
  projectImageTypes,
  sanitizeRaster,
  uploadHeadersMatch,
  UploadIntentConfigurationError,
  validateUploadedFile,
  verifyResourceUploadIntent,
} from "../lib/uploadSecurity";

const router: IRouter = Router();
const storage = new ObjectStorageService();
router.use(requireAccount, requireActiveAccount);

async function context(accountId: string) {
  const [membership] = await db.select({ organization: dealerOrganizationsTable, membership: organizationMembershipsTable })
    .from(organizationMembershipsTable).innerJoin(dealerOrganizationsTable, eq(organizationMembershipsTable.organizationId, dealerOrganizationsTable.id))
    .where(and(eq(organizationMembershipsTable.accountId, accountId), eq(organizationMembershipsTable.status, "approved"))).limit(1);
  const [[assignment], groupMemberships] = await Promise.all([
    db.select().from(portalGroupAssignmentsTable).where(eq(portalGroupAssignmentsTable.accountId, accountId)).limit(1),
    db.select({ groupId: portalGroupMembershipsTable.groupId }).from(portalGroupMembershipsTable).where(eq(portalGroupMembershipsTable.accountId, accountId)),
  ]);
  const groupIds = [...new Set([assignment?.groupId, ...groupMemberships.map((row) => row.groupId)].filter((value): value is string => Boolean(value)))];
  return { membership, groupId: assignment?.groupId ?? groupIds[0] ?? null, groupIds };
}
const groupName = z.string().trim().min(1).max(160);
const uuid = z.string().uuid();
const dealerPortalBody = z.object({}).passthrough();
async function dealerContext(req: any, res: any): Promise<Awaited<ReturnType<typeof context>> | null> {
  if (req.account?.role !== "dealer" || req.account?.status !== "approved") { res.status(403).json({ error: "Approved dealer access required." }); return null; }
  const c = await context(req.account.id);
  if (!c.membership || c.membership.organization.status !== "approved") { res.status(403).json({ error: "Approved dealer access required." }); return null; }
  return c;
}
async function audit(req: any, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}) {
  await db.insert(auditEventsTable).values({ actorAccountId: req.account!.id, action, targetType, targetId, metadata: metadata as any });
}
const statusSchema = z.enum(["pending", "approved", "suspended"]);
const urlSchema = z.string().url().max(2048).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) URLs are supported.");
const storedResourcePathSchema = z.string().regex(/^\/objects\/portal-resources\/[0-9a-f-]{36}$/);
const resourceUrlSchema = z.union([urlSchema, storedResourcePathSchema]);
const resourceContentTypes = portalResourceTypes;
const maxResourceBytes = PORTAL_RESOURCE_MAX_BYTES;
const pushConfiguration = configurePushFromEnvironment();
const pushConfigured = pushConfiguration.configured;
const vapidPublicKey = pushConfiguration.publicKey;
const formInput = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  fieldDefinitions: z.array(z.record(z.string(), z.unknown())).max(100),
  enabled: z.boolean().optional(),
});
const resourceInput = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  description: z.string().max(2000).nullable().optional(),
  url: resourceUrlSchema,
  enabled: z.boolean().optional(),
});
function dealerResourceDto(resource: typeof portalResourcesTable.$inferSelect) {
  return {
    ...resource,
    url: resource.url.startsWith("/objects/")
      ? `/api/dealer-portal/resources/${resource.id}/file`
      : resource.url,
  };
}
async function streamStoredResource(res: any, resource: typeof portalResourcesTable.$inferSelect) {
  if (!storedResourcePathSchema.safeParse(resource.url).success) {
    res.status(404).json({ error: "File not found." });
    return;
  }
  try {
    const file = await storage.getObjectEntityFile(resource.url);
    const response = await storage.downloadObject(file, 0);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(resource.title)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
    if (!response.body) { res.end(); return; }
    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "File not found." });
      return;
    }
    throw error;
  }
}
async function canView(accountId: string, groupIds: string[], capability: string, defaultValue = true) {
  return canViewLegacyPortalCapability(accountId, groupIds, capability, defaultValue);
}
async function legacyTargetVisible(accountId: string, groupIds: string[], kind: "price_book" | "resource" | "form", legacyId: string): Promise<boolean> {
  const items = await db.select().from(portalContentTable).where(eq(portalContentTable.kind, kind));
  const mapped = items.filter((item) => {
    const payload = item.payload;
    return typeof payload === "object" && payload !== null && !Array.isArray(payload) && (payload as Record<string, unknown>).legacyId === legacyId;
  });
  const mappings = await Promise.all(mapped.map(async (item) => ({
    published: item.published,
    visibility: item.visibility,
    targets: await db.select().from(portalContentTargetsTable).where(eq(portalContentTargetsTable.contentId, item.id)),
  })));
  return isMappedLegacyItemVisible(mappings, accountId, groupIds);
}
router.get("/dealer-portal/dashboard", async (req, res): Promise<void> => {
  const c = await dealerContext(req, res); if (!c) return;
  const [formsPageVisible, resourcesPageVisible] = await Promise.all([
    canView(req.account!.id, c.groupIds, "page:forms"),
    canView(req.account!.id, c.groupIds, "page:resources"),
  ]);
  const [forms, resources, notifications] = await Promise.all([
    db.select({ id: portalFormsTable.id }).from(portalFormsTable).where(eq(portalFormsTable.enabled, true)),
    db.select({ id: portalResourcesTable.id }).from(portalResourcesTable).where(eq(portalResourcesTable.enabled, true)),
    db.select({ count: portalNotificationRecipientsTable.id }).from(portalNotificationRecipientsTable).where(and(eq(portalNotificationRecipientsTable.accountId, req.account!.id), isNull(portalNotificationRecipientsTable.readAt))),
  ]);
  const [visibleForms, visibleResources] = await Promise.all([
    formsPageVisible
      ? Promise.all(forms.map(async (x) => (await canView(req.account!.id, c.groupIds, `form:${x.id}`)) && (await legacyTargetVisible(req.account!.id, c.groupIds, "form", x.id)))).then((x) => x.filter(Boolean).length)
      : 0,
    resourcesPageVisible
      ? Promise.all(resources.map(async (x) => (await canView(req.account!.id, c.groupIds, `resource:${x.id}`)) && (await legacyTargetVisible(req.account!.id, c.groupIds, "resource", x.id)))).then((x) => x.filter(Boolean).length)
      : 0,
  ]);
  res.json({ organization: c.membership.organization, groupId: c.groupId, counts: { forms: visibleForms, resources: visibleResources, unreadNotifications: notifications.length } });
});

router.get("/dealer-portal/pricing", async (req, res): Promise<void> => {
  const c = await dealerContext(req, res); if (!c) return;
  if (!(await canView(req.account!.id, c.groupIds, "page:pricing"))) { res.status(403).json({ error: "Pricing access denied." }); return; }
  const [book] = await db.select().from(pricebooksTable).where(isNotNull(pricebooksTable.approvedAt)).orderBy(desc(pricebooksTable.effectiveFrom)).limit(1);
  const lines = book ? await db.select().from(pricebookLinesTable).where(eq(pricebookLinesTable.pricebookId, book.id)) : [];
  if (book && !(await legacyTargetVisible(req.account!.id, c.groupIds, "price_book", book.id))) { res.json([]); return; }
  const overrides = await db.select().from(portalPriceOverridesTable).where(or(eq(portalPriceOverridesTable.accountId, req.account!.id), c.groupIds.length ? inArray(portalPriceOverridesTable.groupId, c.groupIds) : eq(portalPriceOverridesTable.id, "__none__")));
  const bySku = new Map<string, typeof overrides[number]>();
  const visibleSkus = new Set<string>();
  for (const line of lines) {
    if (!(await canView(req.account!.id, c.groupIds, `pricing:${line.sku}`))) continue;
    visibleSkus.add(line.sku);
    const candidates = overrides.filter((x) => x.sku === line.sku);
    const account = candidates.find((x) => x.accountId === req.account!.id);
    const group = c.groupIds.map((groupId) => candidates.find((x) => x.groupId === groupId)).find(Boolean);
    if (account ?? group) bySku.set(line.sku, account ?? group!);
  }
  res.json(lines.filter((line) => visibleSkus.has(line.sku)).map((line) => ({ ...line, wholesaleAmount: bySku.get(line.sku)?.wholesaleAmount ?? line.wholesaleAmount })));
});
router.get("/dealer-portal/forms", async (req, res) => { const c = await dealerContext(req, res); if (!c) return; if (!(await canView(req.account!.id, c.groupIds, "page:forms"))) { res.status(403).json({ error: "Forms access denied." }); return; } const rows = await db.select().from(portalFormsTable).where(eq(portalFormsTable.enabled, true)); res.json((await Promise.all(rows.map(async (x) => (await canView(req.account!.id, c.groupIds, `form:${x.id}`)) && (await legacyTargetVisible(req.account!.id, c.groupIds, "form", x.id)) ? x : null))).filter(Boolean)); });
router.post("/dealer-portal/forms/:formId/submissions", async (req, res): Promise<void> => {
  const c = await dealerContext(req, res); if (!c) return;
  if (!(await canView(req.account!.id, c.groupIds, "page:forms"))) { res.status(403).json({ error: "Forms access denied." }); return; }
  const formId = uuid.safeParse(req.params.formId); if (!formId.success) { res.status(400).json({ error: "Invalid form id." }); return; }
  const [form] = await db.select().from(portalFormsTable).where(and(eq(portalFormsTable.id, formId.data), eq(portalFormsTable.enabled, true)));
  if (!form) { res.status(404).json({ error: "Form not found." }); return; }
  if (!(await canView(req.account!.id, c.groupIds, `form:${form.id}`)) || !(await legacyTargetVisible(req.account!.id, c.groupIds, "form", form.id))) { res.status(403).json({ error: "Form access denied." }); return; }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
    Object.keys(req.body).some((key) => key !== "values")) {
    res.status(400).json({ error: "Invalid form submission." }); return;
  }
  const validation = validatePortalFormSubmission(form.fieldDefinitions, req.body.values);
  if (!validation.ok) { res.status(validation.invalidDefinition ? 409 : 400).json({ error: validation.error }); return; }
  // Drizzle's entity detection expects a normal object prototype for JSONB.
  // Keys were allowlisted against persisted definitions and dangerous prototype
  // keys rejected by validatePortalFormSubmission before this shallow copy.
  const [submission] = await db.insert(portalFormSubmissionsTable).values({ formId: form.id, accountId: req.account!.id, values: { ...validation.values } }).returning();
  res.status(201).json(submission);
});
router.get("/dealer-portal/resources", async (req, res) => { const c = await dealerContext(req, res); if (!c) return; if (!(await canView(req.account!.id, c.groupIds, "page:resources"))) { res.status(403).json({ error: "Resources access denied." }); return; } const rows = await db.select().from(portalResourcesTable).where(eq(portalResourcesTable.enabled, true)); const visible = (await Promise.all(rows.map(async (x) => (await canView(req.account!.id, c.groupIds, `resource:${x.id}`)) && (await legacyTargetVisible(req.account!.id, c.groupIds, "resource", x.id)) ? x : null))).filter((x): x is typeof portalResourcesTable.$inferSelect => Boolean(x)); res.json(visible.map(dealerResourceDto)); });
router.get("/dealer-portal/resources/:resourceId/file", async (req, res): Promise<void> => {
  const c = await dealerContext(req, res); if (!c) return;
  if (!(await canView(req.account!.id, c.groupIds, "page:resources"))) { res.status(403).json({ error: "Resources access denied." }); return; }
  const id = uuid.safeParse(req.params.resourceId);
  if (!id.success) { res.status(404).json({ error: "File not found." }); return; }
  const [resource] = await db.select().from(portalResourcesTable).where(and(eq(portalResourcesTable.id, id.data), eq(portalResourcesTable.enabled, true))).limit(1);
  if (!resource || !(await canView(req.account!.id, c.groupIds, `resource:${resource.id}`)) || !(await legacyTargetVisible(req.account!.id, c.groupIds, "resource", resource.id))) { res.status(404).json({ error: "File not found." }); return; }
  await streamStoredResource(res, resource);
});
router.get("/dealer-portal/notifications", async (req, res) => { const c = await dealerContext(req, res); if (!c) return; if (!(await canView(req.account!.id, c.groupIds, "page:notifications"))) { res.status(403).json({ error: "Notifications access denied." }); return; } res.json(await db.select({ notification: portalNotificationsTable, recipient: portalNotificationRecipientsTable }).from(portalNotificationRecipientsTable).innerJoin(portalNotificationsTable, eq(portalNotificationRecipientsTable.notificationId, portalNotificationsTable.id)).where(eq(portalNotificationRecipientsTable.accountId, req.account!.id)).orderBy(desc(portalNotificationsTable.sentAt))); });
router.post("/dealer-portal/notifications/:notificationId/read", async (req, res): Promise<void> => { const c = await dealerContext(req, res); if (!c) return; if (!(await canView(req.account!.id, c.groupIds, "page:notifications"))) { res.status(403).json({ error: "Notifications access denied." }); return; } const id = uuid.safeParse(req.params.notificationId); if (!id.success) { res.status(400).json({ error: "Invalid notification id." }); return; } const [row] = await db.update(portalNotificationRecipientsTable).set({ readAt: new Date() }).where(and(eq(portalNotificationRecipientsTable.notificationId, id.data), eq(portalNotificationRecipientsTable.accountId, req.account!.id))).returning(); if (!row) { res.status(404).json({ error: "Notification not found." }); return; } res.json(row); });
router.post("/dealer-portal/notifications/read-all", async (req, res) => { const c = await dealerContext(req, res); if (!c) return; if (!(await canView(req.account!.id, c.groupIds, "page:notifications"))) { res.status(403).json({ error: "Notifications access denied." }); return; } await db.update(portalNotificationRecipientsTable).set({ readAt: new Date() }).where(and(eq(portalNotificationRecipientsTable.accountId, req.account!.id), isNull(portalNotificationRecipientsTable.readAt))); res.status(204).end(); });
router.get("/dealer-portal/access", async (req, res) => { const c = await dealerContext(req, res); if (!c) return; const capabilities = await resolvedLegacyPortalCapabilities(req.account!.id, c.groupIds); res.json({ groupId: c.groupId, groupIds: c.groupIds, capabilities: Object.fromEntries(capabilities) }); });
router.post("/dealer-portal/push-subscriptions", async (req, res) => {
  if (!await dealerContext(req, res)) return;
  const body = z.object({ endpoint: z.string().max(2048).refine(isAllowedPushEndpoint), keys: z.object({ p256dh: z.string().min(1).max(512), auth: z.string().min(1).max(512) }), expirationTime: z.number().int().nonnegative().nullable().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Push endpoint is not an approved browser push provider." }); return; }
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`push-account:${req.account!.id}`}))`);
    const existing = await tx.select({ id: portalPushSubscriptionsTable.id, endpoint: portalPushSubscriptionsTable.endpoint }).from(portalPushSubscriptionsTable).where(eq(portalPushSubscriptionsTable.accountId, req.account!.id));
    if (!existing.some((row) => row.endpoint === body.data.endpoint) && existing.length >= PUSH_MAX_SUBSCRIPTIONS_PER_ACCOUNT) return { quota: true as const };
    const [inserted] = await tx.insert(portalPushSubscriptionsTable).values({ accountId: req.account!.id, endpoint: body.data.endpoint, p256dh: body.data.keys.p256dh, auth: body.data.keys.auth, expirationTime: body.data.expirationTime ?? null }).onConflictDoNothing().returning();
    if (inserted) return { row: inserted };
    const [owned] = await tx.select().from(portalPushSubscriptionsTable).where(and(
      eq(portalPushSubscriptionsTable.endpoint, body.data.endpoint),
      eq(portalPushSubscriptionsTable.accountId, req.account!.id),
    )).limit(1);
    if (!owned) return { conflict: true as const };
    const [updated] = await tx.update(portalPushSubscriptionsTable).set({
      p256dh: body.data.keys.p256dh,
      auth: body.data.keys.auth,
      expirationTime: body.data.expirationTime ?? null,
      updatedAt: new Date(),
    }).where(eq(portalPushSubscriptionsTable.id, owned.id)).returning();
    return { row: updated };
  });
  if ("quota" in result) {
    res.status(429).json({ error: "Too many push subscriptions are registered for this account." });
    return;
  }
  if ("conflict" in result) {
    res.status(409).json({ error: "That push subscription is already registered." });
    return;
  }
  res.status(201).json(result.row);
});
router.delete("/dealer-portal/push-subscriptions", async (req, res) => { if (!await dealerContext(req, res)) return; const body = z.object({ endpoint: z.string().max(2048).refine(isAllowedPushEndpoint) }).safeParse({ endpoint: req.body?.endpoint ?? String(req.query.endpoint ?? "") }); if (!body.success) { res.status(400).json({ error: "A valid approved push endpoint is required." }); return; } await db.delete(portalPushSubscriptionsTable).where(and(eq(portalPushSubscriptionsTable.accountId, req.account!.id), eq(portalPushSubscriptionsTable.endpoint, body.data.endpoint))); res.status(204).end(); });
router.get("/dealer-portal/push-config", async (req, res) => { if (!await dealerContext(req, res)) return; res.json({ configured: pushConfigured, publicKey: pushConfigured ? vapidPublicKey : null, message: pushConfiguration.error }); });

// Legacy administration remains least-privilege: content managers can retain
// content/form/resource/notification work, while people, groups, pricing and
// audit administration remain restricted to staff admins.
router.use("/staff/portal", requireStaffRoles(["super_admin", "staff_admin", "content_manager"]));
router.use("/staff/portal", async (req, res, next): Promise<void> => {
  const role = await getAuthorizedStaffRole(req);
  if (!role || !legacyPortalPathAllowed(role, `${req.baseUrl}${req.path}`)) {
    res.status(403).json({ error: "Forbidden." });
    return;
  }
  next();
});
router.post("/staff/portal/resource-uploads/request", async (req, res): Promise<void> => {
  const body = z.object({
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().refine((value) => resourceContentTypes.has(value), "Unsupported file type."),
    byteSize: z.number().int().positive().max(maxResourceBytes),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Choose a PDF, plain-text, JPEG, PNG, or WebP file up to 25 MB. Office and ZIP uploads are not accepted because their active or embedded content cannot be safely verified." }); return; }
  const objectPath = storage.createObjectEntityUploadPath(req.account!.id);
  const uploadId = objectPath.split("/").at(-1)!;
  try {
    const intentToken = issueResourceUploadIntent({
      accountId: req.account!.id, objectPath, fileName: body.data.fileName,
      contentType: body.data.contentType, byteSize: body.data.byteSize,
      expiresAt: Date.now() + 10 * 60_000,
    });
    res.json({
      uploadUrl: `/api/staff/portal/resource-uploads/${uploadId}?intent=${encodeURIComponent(intentToken)}`,
      objectPath,
      fileName: body.data.fileName,
      intentToken,
    });
  } catch (error) {
    if (error instanceof UploadIntentConfigurationError) {
      res.status(503).json({ error: error.message });
      return;
    }
    throw error;
  }
});
router.put("/staff/portal/resource-uploads/:uploadId", async (req, res): Promise<void> => {
  let intent;
  try {
    intent = verifyResourceUploadIntent(
      typeof req.query.intent === "string" ? req.query.intent : "",
      req.account!.id,
    );
  } catch (error) {
    if (error instanceof UploadIntentConfigurationError) {
      res.status(503).json({ error: error.message }); return;
    }
    throw error;
  }
  if (!intent || intent.objectPath.split("/").at(-1) !== String(req.params.uploadId)) {
    res.status(404).json({ error: "Resource upload not found or expired." }); return;
  }
  if (!uploadHeadersMatch(req.get("content-type"), req.get("content-length"), intent.contentType, intent.byteSize)) {
    res.status(400).json({ error: "Upload headers do not match the authorized resource." }); return;
  }
  try {
    await storage.uploadBoundedObject(intent.objectPath, req, intent.contentType, intent.byteSize);
    res.status(204).end();
  } catch {
    res.status(400).json({ error: "Upload size or content did not match the authorized resource." });
  }
});
router.post("/staff/portal/resource-uploads/complete", async (req, res): Promise<void> => {
  const body = z.object({
    tempObjectPath: z.string().regex(/^\/objects\/uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().refine((value) => resourceContentTypes.has(value), "Unsupported file type."),
    byteSize: z.number().int().positive().max(maxResourceBytes),
    title: z.string().trim().min(1).max(200),
    category: z.string().trim().min(1).max(100),
    description: z.string().max(2000).nullable().optional(),
    enabled: z.boolean().optional(),
    intentToken: z.string().min(1).max(4096),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid uploaded resource." }); return; }
  let intent;
  try {
    intent = verifyResourceUploadIntent(body.data.intentToken, req.account!.id);
  } catch (error) {
    if (error instanceof UploadIntentConfigurationError) {
      res.status(503).json({ error: error.message }); return;
    }
    throw error;
  }
  if (
    !intent
    || intent.objectPath !== body.data.tempObjectPath
    || intent.fileName !== body.data.fileName
    || intent.contentType !== body.data.contentType
    || intent.byteSize !== body.data.byteSize
  ) {
    res.status(400).json({ error: "Resource upload authorization is invalid or expired." }); return;
  }
  let finalObjectPath: string | null = null;
  try {
    const file = await storage.getObjectEntityFile(body.data.tempObjectPath);
    const [metadata] = await file.getMetadata();
    const generation = String(metadata.generation || "");
    if (!generation || Number(metadata.size) !== intent.byteSize || metadata.contentType !== intent.contentType) {
      throw new Error("Uploaded file validation failed.");
    }
    const versionedFile = file.bucket.file(file.name, { generation });
    if (!(await validateUploadedFile(versionedFile, intent.contentType, intent.byteSize))) throw new Error("Unsafe resource.");
    const sanitizedBytes = projectImageTypes.has(intent.contentType)
      ? await sanitizeRaster(versionedFile, intent.contentType, intent.byteSize, PORTAL_RESOURCE_MAX_BYTES)
      : undefined;
    finalObjectPath = await storage.finalizeObjectEntityUpload(intent.objectPath, intent.contentType, generation, "portal-resources", sanitizedBytes);
    const [resource] = await db.insert(portalResourcesTable).values({
      title: body.data.title,
      category: body.data.category,
      description: body.data.description ?? body.data.fileName,
      url: finalObjectPath,
      // The v2 audience has not committed yet. Unmapped legacy resources
      // default to everyone, so never expose a freshly uploaded file here.
      enabled: false,
      createdByAccountId: req.account!.id,
    }).returning();
    await audit(req, "portal.resource.uploaded", "resource", resource.id, { fileName: body.data.fileName, byteSize: body.data.byteSize });
    res.status(201).json(resource);
  } catch (error) {
    if (finalObjectPath) await storage.deleteObjectEntity(finalObjectPath).catch(() => undefined);
    else await storage.deleteObjectEntity(intent.objectPath).catch(() => undefined);
    res.status(400).json({ error: "The file was rejected by safety validation. PDFs must be unencrypted, non-incremental documents without scripts, actions, XFA, rich media, or embedded files." });
  }
});
router.get("/staff/portal/groups", async (_req, res) => res.json(await db.select().from(portalGroupsTable)));
router.post("/staff/portal/groups", async (req, res): Promise<void> => { const body = z.object({ name: groupName, description: z.string().max(500).nullable().optional() }).safeParse(req.body); if (!body.success) { res.status(400).json({ error: "Invalid group." }); return; } const [row] = await db.insert(portalGroupsTable).values({ name: body.data.name, description: body.data.description ?? null }).onConflictDoNothing().returning(); if (!row) { res.status(409).json({ error: "Group already exists." }); return; } await audit(req, "portal.group.created", "group", row.id, { name: row.name }); res.status(201).json(row); });
router.patch("/staff/portal/groups/:id", async (req, res): Promise<void> => { const id = uuid.safeParse(req.params.id); const body = z.object({ name: groupName.optional(), description: z.string().max(500).nullable().optional() }).safeParse(req.body); if (!id.success || !body.success) { res.status(400).json({ error: "Invalid group update." }); return; } const [row] = await db.update(portalGroupsTable).set({ ...body.data, updatedAt: new Date() }).where(eq(portalGroupsTable.id, id.data)).returning(); if (!row) { res.status(404).json({ error: "Group not found." }); return; } await audit(req, "portal.group.updated", "group", row.id, { changed: Object.keys(body.data) }); res.json(row); });
router.post("/staff/portal/groups/:id/users", async (req, res): Promise<void> => { const groupId = uuid.safeParse(req.params.id); const body = z.object({ accountId: uuid }).safeParse(req.body); if (!groupId.success || !body.success) { res.status(400).json({ error: "Invalid group assignment." }); return; } const [group] = await db.select({ id: portalGroupsTable.id }).from(portalGroupsTable).where(eq(portalGroupsTable.id, groupId.data)); const [account] = await db.select({ id: accountsTable.id }).from(accountsTable).where(and(eq(accountsTable.id, body.data.accountId), eq(accountsTable.role, "dealer"))); if (!group || !account) { res.status(404).json({ error: "Group or dealer account not found." }); return; } const [row] = await db.insert(portalGroupAssignmentsTable).values({ groupId: groupId.data, accountId: body.data.accountId }).onConflictDoUpdate({ target: portalGroupAssignmentsTable.accountId, set: { groupId: groupId.data } }).returning(); await audit(req, "portal.group.assignment.changed", "group_assignment", row.id, { groupId: groupId.data, accountId: body.data.accountId }); res.status(201).json(row); });
router.get("/staff/portal/users", async (_req, res) => res.json(await db.select().from(accountsTable).where(eq(accountsTable.role, "dealer"))));
router.post("/staff/portal/users/invite", async (req, res): Promise<void> => {
  const body = z.object({
    email: z.string().email().max(320).transform((x) => x.toLowerCase()),
    organizationId: uuid,
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid invitation." }); return; }
  const [[existing], [organization]] = await Promise.all([
    db.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.email, body.data.email)).limit(1),
    db.select({ id: dealerOrganizationsTable.id }).from(dealerOrganizationsTable).where(and(eq(dealerOrganizationsTable.id, body.data.organizationId), eq(dealerOrganizationsTable.status, "approved"))).limit(1),
  ]);
  if (existing) { res.status(409).json({ error: "An account with that email already exists." }); return; }
  if (!organization) { res.status(404).json({ error: "Approved dealer organization not found." }); return; }
  const row = await db.transaction(async (tx) => {
    const [account] = await tx.insert(accountsTable).values({
      clerkUserId: `invited:${body.data.email}`,
      email: body.data.email,
      role: "dealer",
      status: "pending",
      emailVerified: false,
    }).returning();
    await tx.insert(organizationMembershipsTable).values({
      organizationId: organization.id,
      accountId: account.id,
      role: "member",
      status: "approved",
    });
    return account;
  });
  await audit(req, "portal.user.invited", "account", row.id, {
    email: body.data.email,
    organizationId: organization.id,
  });
  res.status(201).json(row);
});
router.patch("/staff/portal/users/:id/status", async (req, res): Promise<void> => { const id = uuid.safeParse(req.params.id); const body = z.object({ status: statusSchema }).safeParse(req.body); if (!id.success || !body.success) { res.status(400).json({ error: "Invalid user status." }); return; } const [row] = await db.update(accountsTable).set({ status: body.data.status, updatedAt: new Date() }).where(and(eq(accountsTable.id, id.data), eq(accountsTable.role, "dealer"))).returning(); if (!row) { res.status(404).json({ error: "Dealer account not found." }); return; } await audit(req, "portal.user.status.changed", "account", row.id, { status: row.status }); res.json(row); });
router.get("/staff/portal/access-rules", async (_req, res) => res.json(await db.select().from(portalAccessRulesTable)));
router.post("/staff/portal/access-rules", async (req, res): Promise<void> => { const body = z.object({ subjectType: z.enum(["group", "account"]), groupId: uuid.nullable().optional(), accountId: uuid.nullable().optional(), capability: z.string().min(1).max(240), enabled: z.boolean() }).superRefine((x, ctx) => { if (x.subjectType === "group" && (!x.groupId || x.accountId)) ctx.addIssue({ code: "custom", message: "Group rules require groupId only." }); if (x.subjectType === "account" && (!x.accountId || x.groupId)) ctx.addIssue({ code: "custom", message: "Account rules require accountId only." }); }).safeParse(req.body); if (!body.success) { res.status(400).json({ error: "Invalid access rule." }); return; } const where = body.data.subjectType === "group" ? and(eq(portalAccessRulesTable.groupId, body.data.groupId!), eq(portalAccessRulesTable.capability, body.data.capability)) : and(eq(portalAccessRulesTable.accountId, body.data.accountId!), eq(portalAccessRulesTable.capability, body.data.capability)); const [row] = await db.insert(portalAccessRulesTable).values(body.data as any).onConflictDoUpdate({ target: body.data.subjectType === "group" ? [portalAccessRulesTable.groupId, portalAccessRulesTable.capability] : [portalAccessRulesTable.accountId, portalAccessRulesTable.capability], set: { enabled: body.data.enabled, updatedAt: new Date() } }).returning(); await db.insert(auditEventsTable).values({ actorAccountId: req.account!.id, action: "portal.access.changed", targetType: "access_rule", targetId: row.id, metadata: { capability: body.data.capability, enabled: body.data.enabled } }); res.status(200).json(row); });
router.delete("/staff/portal/access-rules/:id", async (req, res): Promise<void> => { const id = uuid.safeParse(req.params.id); if (!id.success) { res.status(400).json({ error: "Invalid access rule id." }); return; } const [row] = await db.delete(portalAccessRulesTable).where(eq(portalAccessRulesTable.id, id.data)).returning(); if (!row) { res.status(404).json({ error: "Access rule not found." }); return; } await audit(req, "portal.access.deleted", "access_rule", row.id, { capability: row.capability }); res.status(204).end(); });
router.use("/staff/portal/price-overrides", async (req, res, next): Promise<void> => {
  const role = await getAuthorizedStaffRole(req);
  if (!canManagePortalPricing(role, req.method === "GET" ? "read" : "write")) {
    res.status(403).json({ error: "Insufficient pricing privilege." });
    return;
  }
  next();
});
router.get("/staff/portal/price-overrides", async (_req, res) => res.json(await db.select().from(portalPriceOverridesTable)));
router.post("/staff/portal/price-overrides", async (req, res): Promise<void> => {
  const body = priceOverrideInput.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid price override: SKU, USD amount (two decimal places), and exactly one target are required." }); return; }
  const { sku, groupId, accountId, wholesaleAmount, currency } = body.data;
  const [targetExists] = accountId
    ? await db.select({ id: accountsTable.id }).from(accountsTable).where(and(eq(accountsTable.id, accountId), eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved"))).limit(1)
    : await db.select({ id: portalGroupsTable.id }).from(portalGroupsTable).where(eq(portalGroupsTable.id, groupId!)).limit(1);
  if (!targetExists) { res.status(404).json({ error: "Approved dealer account or group not found." }); return; }
  const [book] = await db.select({ id: pricebooksTable.id }).from(pricebooksTable)
    .where(isNotNull(pricebooksTable.approvedAt)).orderBy(desc(pricebooksTable.effectiveFrom)).limit(1);
  const [line] = book ? await db.select({ sku: pricebookLinesTable.sku }).from(pricebookLinesTable)
    .where(and(eq(pricebookLinesTable.pricebookId, book.id), eq(pricebookLinesTable.sku, sku))).limit(1) : [];
  if (!line) { res.status(400).json({ error: "SKU not found in the current approved pricebook." }); return; }
  const target = accountId ? [portalPriceOverridesTable.accountId, portalPriceOverridesTable.sku] : [portalPriceOverridesTable.groupId, portalPriceOverridesTable.sku];
  const [row] = await db.insert(portalPriceOverridesTable).values({ sku, groupId: groupId ?? null, accountId: accountId ?? null, wholesaleAmount: String(wholesaleAmount), currency }).onConflictDoUpdate({ target, set: { wholesaleAmount: String(wholesaleAmount), currency, updatedAt: new Date() } }).returning();
  await audit(req, "portal.pricing.changed", "price_override", row.id, { sku: row.sku, groupId: row.groupId, accountId: row.accountId, wholesaleAmount: row.wholesaleAmount, currency: row.currency });
  res.status(200).json(row);
});
router.delete("/staff/portal/price-overrides/:id", async (req, res): Promise<void> => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) { res.status(400).json({ error: "Invalid price override id." }); return; }
  const [row] = await db.delete(portalPriceOverridesTable).where(eq(portalPriceOverridesTable.id, id.data)).returning();
  if (!row) { res.status(404).json({ error: "Price override not found." }); return; }
  await audit(req, "portal.pricing.deleted", "price_override", row.id, { sku: row.sku, groupId: row.groupId, accountId: row.accountId, wholesaleAmount: row.wholesaleAmount, currency: row.currency });
  res.status(204).end();
});
router.get("/staff/portal/forms", async (_req, res) => res.json(await db.select().from(portalFormsTable)));
router.get("/staff/portal/form-submissions", async (_req, res) => {
  const rows = await db.select({
    submission: portalFormSubmissionsTable,
    form: { id: portalFormsTable.id, title: portalFormsTable.title },
    account: { id: accountsTable.id, email: accountsTable.email, displayName: accountsTable.displayName },
  }).from(portalFormSubmissionsTable)
    .innerJoin(portalFormsTable, eq(portalFormsTable.id, portalFormSubmissionsTable.formId))
    .innerJoin(accountsTable, eq(accountsTable.id, portalFormSubmissionsTable.accountId))
    .orderBy(desc(portalFormSubmissionsTable.submittedAt));
  res.json(rows);
});
router.post("/staff/portal/forms", async (req, res): Promise<void> => { const body = formInput.safeParse(req.body); if (!body.success) { res.status(400).json({ error: "Invalid form." }); return; } const [row] = await db.insert(portalFormsTable).values({ ...body.data, fieldDefinitions: body.data.fieldDefinitions as any, createdByAccountId: req.account!.id }).returning(); await audit(req, "portal.form.created", "form", row.id, { title: row.title }); res.status(201).json(row); });
router.patch("/staff/portal/forms/:id", async (req, res): Promise<void> => { const id = uuid.safeParse(req.params.id); const body = formInput.partial().safeParse(req.body); if (!id.success || !body.success) { res.status(400).json({ error: "Invalid form update." }); return; } const [row] = await db.update(portalFormsTable).set({ ...body.data, fieldDefinitions: body.data.fieldDefinitions as any, updatedAt: new Date() }).where(eq(portalFormsTable.id, id.data)).returning(); if (!row) { res.status(404).json({ error: "Form not found." }); return; } await audit(req, "portal.form.updated", "form", row.id, { changed: Object.keys(body.data) }); res.json(row); });
router.delete("/staff/portal/forms/:id", async (req, res): Promise<void> => { const id = uuid.safeParse(req.params.id); if (!id.success) { res.status(400).json({ error: "Invalid form id." }); return; } const [row] = await db.delete(portalFormsTable).where(eq(portalFormsTable.id, id.data)).returning(); if (!row) { res.status(404).json({ error: "Form not found." }); return; } await audit(req, "portal.form.deleted", "form", row.id); res.status(204).end(); });
router.get("/staff/portal/resources", async (_req, res) => res.json(await db.select().from(portalResourcesTable)));
router.get("/staff/portal/resources/:id/file", async (req, res): Promise<void> => {
  const id = uuid.safeParse(req.params.id);
  if (!id.success) { res.status(404).json({ error: "File not found." }); return; }
  const [resource] = await db.select().from(portalResourcesTable).where(eq(portalResourcesTable.id, id.data)).limit(1);
  if (!resource) { res.status(404).json({ error: "File not found." }); return; }
  await streamStoredResource(res, resource);
});
router.post("/staff/portal/resources", async (req, res): Promise<void> => { const body = resourceInput.safeParse(req.body); if (!body.success) { res.status(400).json({ error: "Invalid resource." }); return; } const [row] = await db.insert(portalResourcesTable).values({ ...body.data, createdByAccountId: req.account!.id }).returning(); await audit(req, "portal.resource.created", "resource", row.id, { title: row.title }); res.status(201).json(row); });
router.patch("/staff/portal/resources/:id", async (req, res): Promise<void> => { const id = uuid.safeParse(req.params.id); const body = resourceInput.partial().safeParse(req.body); if (!id.success || !body.success) { res.status(400).json({ error: "Invalid resource update." }); return; } const [row] = await db.update(portalResourcesTable).set({ ...body.data, updatedAt: new Date() }).where(eq(portalResourcesTable.id, id.data)).returning(); if (!row) { res.status(404).json({ error: "Resource not found." }); return; } await audit(req, "portal.resource.updated", "resource", row.id, { changed: Object.keys(body.data) }); res.json(row); });
router.delete("/staff/portal/resources/:id", async (req, res): Promise<void> => { const id = uuid.safeParse(req.params.id); if (!id.success) { res.status(400).json({ error: "Invalid resource id." }); return; } const [row] = await db.delete(portalResourcesTable).where(eq(portalResourcesTable.id, id.data)).returning(); if (!row) { res.status(404).json({ error: "Resource not found." }); return; } if (storedResourcePathSchema.safeParse(row.url).success) await storage.deleteObjectEntity(row.url).catch((error) => req.log.warn({ err: error, resourceId: row.id }, "Unable to delete stored portal resource")); await audit(req, "portal.resource.deleted", "resource", row.id); res.status(204).end(); });
router.post("/staff/portal/notifications", async (req, res) => {
  const body = z.object({ title: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(10000), targetType: z.enum(["everyone", "group", "accounts"]), targetGroupId: uuid.optional(), accountIds: z.array(uuid).max(1000).optional() }).superRefine((x, ctx) => {
    if (x.targetType === "group" && !x.targetGroupId) ctx.addIssue({ code: "custom", message: "A group target is required." });
    if (x.targetType !== "group" && x.targetGroupId) ctx.addIssue({ code: "custom", message: "Group target is only valid for group notifications." });
    if (x.targetType === "accounts" && !x.accountIds?.length) ctx.addIssue({ code: "custom", message: "At least one account is required." });
    if (x.targetType !== "accounts" && x.accountIds?.length) ctx.addIssue({ code: "custom", message: "Account targets are only valid for account notifications." });
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid notification." }); return; }
  const [row] = await db.insert(portalNotificationsTable).values({ title: body.data.title, body: body.data.body, targetType: body.data.targetType, targetGroupId: body.data.targetGroupId ?? null, sentByAccountId: req.account!.id }).returning();
  let recipients: string[] = body.data.accountIds ?? [];
  if (row.targetType === "everyone") {
    recipients = (await db.select({ id: accountsTable.id }).from(accountsTable).where(and(eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved")))).map((x) => x.id);
  } else if (row.targetType === "group" && row.targetGroupId) {
    recipients = (await db.select({ accountId: portalGroupAssignmentsTable.accountId }).from(portalGroupAssignmentsTable).innerJoin(accountsTable, eq(accountsTable.id, portalGroupAssignmentsTable.accountId)).where(and(eq(portalGroupAssignmentsTable.groupId, row.targetGroupId), eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved")))).map((x) => x.accountId);
  }
  if (row.targetType === "accounts") {
    const valid = await db.select({ id: accountsTable.id }).from(accountsTable).where(and(eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved"), or(...recipients.map((id) => eq(accountsTable.id, id)))));
    recipients = [...new Set(valid.map((x) => x.id))];
  } else recipients = [...new Set(recipients)];
  if (recipients.length) await db.insert(portalNotificationRecipientsTable).values(recipients.map((accountId) => ({ notificationId: row.id, accountId }))).onConflictDoNothing();
  let pushDelivered = 0;
  let pushFailed = 0;
  if (pushConfigured && recipients.length) {
    const subscriptions = (await db.select().from(portalPushSubscriptionsTable).where(inArray(portalPushSubscriptionsTable.accountId, recipients)))
      .filter((subscription) => isAllowedPushEndpoint(subscription.endpoint))
      .slice(0, PUSH_MAX_SUBSCRIPTIONS_PER_DISPATCH);
    await mapWithConcurrency(subscriptions, PUSH_MAX_CONCURRENCY, async (subscription) => {
      try {
        await webPush.sendNotification({
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, JSON.stringify({ title: row.title, body: row.body, url: "/portal/notifications" }), { TTL: 60 * 60, timeout: PUSH_SEND_TIMEOUT_MS });
        pushDelivered++;
      } catch (error: any) {
        pushFailed++;
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          await db.delete(portalPushSubscriptionsTable).where(eq(portalPushSubscriptionsTable.id, subscription.id));
          return;
        }
        req.log.warn(
          { statusCode: error?.statusCode, subscriptionId: subscription.id },
          "Portal push delivery failed",
        );
      }
    });
  }
  await db.insert(auditEventsTable).values({ actorAccountId: req.account!.id, action: "portal.notification.sent", targetType: "notification", targetId: row.id, metadata: { recipientCount: recipients.length, pushDelivered, pushFailed } });
  res.status(201).json(row);
});
router.get("/staff/portal/notifications", async (_req, res) => res.json(await db.select().from(portalNotificationsTable).orderBy(desc(portalNotificationsTable.sentAt))));
router.get("/staff/portal/audit", async (_req, res) => res.json(await db.select().from(auditEventsTable).orderBy(desc(auditEventsTable.createdAt)).limit(100)));
router.post("/staff/portal/seed", async (req, res): Promise<void> => {
  if (process.env.NODE_ENV === "production") { res.status(403).json({ error: "Demo seed is disabled in production." }); return; }
  const names = ["Sample Dealer Network", "Sample Boutique Dealers"];
  const groups = [];
  for (const name of names) {
    let [group] = await db.select().from(portalGroupsTable).where(eq(portalGroupsTable.name, name)).limit(1);
    if (!group) [group] = await db.insert(portalGroupsTable).values({ name, description: "Development demo group" }).returning();
    groups.push(group);
  }
  let [org] = await db.select().from(dealerOrganizationsTable).where(eq(dealerOrganizationsTable.slug, "portal-demo-dealers")).limit(1);
  if (!org) [org] = await db.insert(dealerOrganizationsTable).values({ name: "Portal Demo Dealers", slug: "portal-demo-dealers", status: "approved", createdByAccountId: req.account!.id, approvedByAccountId: req.account!.id, approvedAt: new Date() }).returning();
  const demoAccounts = [];
  for (const [i, group] of groups.entries()) {
    for (let n = 1; n <= 2; n++) {
      const email = `portal-demo-${i + 1}-${n}@example.invalid`;
      let [account] = await db.select().from(accountsTable).where(eq(accountsTable.email, email)).limit(1);
      if (!account) [account] = await db.insert(accountsTable).values({ clerkUserId: `pending:portal-demo-${i + 1}-${n}`, email, displayName: `Demo Dealer ${i + 1}-${n}`, role: "dealer", status: "approved", emailVerified: false }).returning();
      if (account) {
        demoAccounts.push(account);
        await db.insert(organizationMembershipsTable).values({ organizationId: org.id, accountId: account.id, role: "member", status: "approved" }).onConflictDoNothing();
        await db.insert(portalGroupAssignmentsTable).values({ accountId: account.id, groupId: group.id }).onConflictDoUpdate({ target: portalGroupAssignmentsTable.accountId, set: { groupId: group.id } });
      }
    }
  }
  const capabilities = ["page:pricing", "page:forms", "page:resources", "page:notifications"];
  let accessRules = 0;
  for (const group of groups) for (const capability of capabilities) {
    const [rule] = await db.insert(portalAccessRulesTable).values({ subjectType: "group", groupId: group.id, capability, enabled: true }).onConflictDoNothing().returning();
    if (rule) accessRules++;
  }
  if (demoAccounts[0]) {
    const [rule] = await db.insert(portalAccessRulesTable).values({ subjectType: "account", accountId: demoAccounts[0].id, capability: "page:notifications", enabled: false }).onConflictDoNothing().returning();
    if (rule) accessRules++;
  }
  const [book] = await db.select().from(pricebooksTable).where(isNotNull(pricebooksTable.approvedAt)).orderBy(desc(pricebooksTable.effectiveFrom)).limit(1);
  const bookLines = book ? await db.select({ sku: pricebookLinesTable.sku, wholesaleAmount: pricebookLinesTable.wholesaleAmount }).from(pricebookLinesTable).where(eq(pricebookLinesTable.pricebookId, book.id)).limit(3) : [];
  const skus = bookLines.length ? bookLines.map((x) => x.sku) : ["DEMO-PORTAL-001", "DEMO-PORTAL-002", "DEMO-PORTAL-003"];
  let priceOverrides = 0;
  const priceTargets = [{ groupId: groups[0].id, accountId: null }, { groupId: groups[1].id, accountId: null }, { groupId: null, accountId: demoAccounts[0]?.id ?? null }];
  for (const [i, target] of priceTargets.entries()) if (target.accountId || target.groupId) {
    const sku = bookLines.length ? bookLines[i % bookLines.length].sku : skus[i];
    const amount = bookLines.length ? bookLines[i % bookLines.length].wholesaleAmount : 125 + i * 25;
    const [row] = await db.insert(portalPriceOverridesTable).values({ sku, groupId: target.groupId, accountId: target.accountId, wholesaleAmount: String(amount), currency: "USD" }).onConflictDoNothing().returning();
    if (row) priceOverrides++;
  }
  let forms = 0;
  for (const title of ["Dealer Quote Request", "Warranty Support Request"]) {
    const [existing] = await db.select({ id: portalFormsTable.id }).from(portalFormsTable).where(eq(portalFormsTable.title, title)).limit(1);
    if (!existing) {
      await db.insert(portalFormsTable).values({ title, description: "Development sample form", fieldDefinitions: [{ name: "details", label: "Details", type: "textarea", required: true }], enabled: true, createdByAccountId: req.account!.id });
      forms++;
    }
  }
  let resources = 0;
  for (const [title, category] of [["Dealer Portal Guide", "Getting started"], ["Installation Checklist", "Operations"], ["Warranty Reference", "Support"]] as const) {
    const [existing] = await db.select({ id: portalResourcesTable.id }).from(portalResourcesTable).where(eq(portalResourcesTable.title, title)).limit(1);
    if (!existing) {
      await db.insert(portalResourcesTable).values({ title, category, description: "Development sample resource", url: "https://example.invalid/kessick-portal-demo", enabled: true, createdByAccountId: req.account!.id });
      resources++;
    }
  }
  let notifications = 0;
  for (const title of ["Welcome to the Dealer Portal", "Sample pricing update"]) {
    const [existing] = await db.select({ id: portalNotificationsTable.id }).from(portalNotificationsTable).where(eq(portalNotificationsTable.title, title)).limit(1);
    if (existing) continue;
    const [notification] = await db.insert(portalNotificationsTable).values({ title, body: "Development sample notification.", targetType: "everyone", sentByAccountId: req.account!.id }).returning();
    const recipients = demoAccounts.map((account) => ({ notificationId: notification.id, accountId: account.id }));
    if (recipients.length) await db.insert(portalNotificationRecipientsTable).values(recipients).onConflictDoNothing();
    notifications++;
  }
  res.json({ seeded: true, groupsCreated: groups.length, organizationId: org.id, demoAccounts: demoAccounts.length, accessRules, priceOverrides, forms, resources, notifications, recipients: demoAccounts.length * notifications });
});

export default router;