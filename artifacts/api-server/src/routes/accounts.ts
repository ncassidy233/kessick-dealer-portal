import { createHash, randomBytes } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import {
  AcceptProjectInvitationBody,
  CompleteProjectImageUploadBody,
  CreateOrganizationMemberBody,
  CreateDealerApplicationBody,
  CreateProjectBody,
  CreateProjectInvitationBody,
  ImportLocalProjectBody,
  RequestProjectImageUploadBody,
  UpdateAccountBody,
  UpdateDealerOrganizationStatusBody,
  UpdateOrganizationMemberBody,
  UpdateProjectBody,
} from "@workspace/api-zod";
import {
  accountsTable,
  auditEventsTable,
  db,
  dealerOrganizationsTable,
  organizationMembershipsTable,
  projectImageUploadIntentsTable,
  projectImagesTable,
  projectInvitationsTable,
  projectsTable,
  type Project,
  type JsonValue,
} from "@workspace/db";
import { and, desc, eq, gt, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";
import {
  getAuthorizedStaffRole,
  requireAccount,
  requireActiveAccount,
  requireStaff,
} from "../middlewares/auth";
import {
  authorizedProjectDto as projectDto,
  canReadProject,
  canWriteProject,
  currentMembership,
  durableProjectSnapshot,
  findProject,
  staffRoleCanReadProjects,
  validUuid,
} from "../lib/projectPolicy";
import {
  PROJECT_IMAGE_MAX_BYTES,
  PROJECT_IMAGE_MAX_COUNT,
  PROJECT_IMAGE_MAX_PENDING_PER_ACCOUNT,
  projectImageTypes,
  sanitizeRaster,
  uploadHeadersMatch,
} from "../lib/uploadSecurity";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const imageContentTypes = projectImageTypes;

router.use(requireAccount);

function accountDto(account: NonNullable<Request["account"]>) {
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    role: account.role,
    status: account.status,
    emailVerified: account.emailVerified,
    createdAt: account.createdAt,
  };
}

function organizationDto(org: typeof dealerOrganizationsTable.$inferSelect) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    createdAt: org.createdAt,
  };
}

function invitationDto(invitation: typeof projectInvitationsTable.$inferSelect) {
  return {
    id: invitation.id,
    projectId: invitation.projectId,
    email: invitation.email,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
  };
}

function imageDto(image: typeof projectImagesTable.$inferSelect) {
  return {
    id: image.id,
    projectId: image.projectId,
    fileName: image.fileName,
    contentType: image.contentType,
    byteSize: image.byteSize,
    contentUrl: `/api/project-images/${image.id}/content`,
    createdAt: image.createdAt,
  };
}

async function accountContextDto(account: NonNullable<Request["account"]>) {
  const context = await currentMembership(account.id);
  return {
    account: accountDto(account),
    organization: context ? organizationDto(context.organization) : null,
    membership: context
      ? {
          id: context.membership.id,
          accountId: account.id,
          email: account.email,
          displayName: account.displayName,
          membershipRole: context.membership.role,
          status: context.membership.status,
        }
      : null,
  };
}

async function audit(
  req: Request,
  action: string,
  targetType: string,
  targetId: string | null,
  project?: Project,
  metadata: Record<string, string | number | boolean | null> = {},
) {
  await db.insert(auditEventsTable).values({
    actorAccountId: req.account!.id,
    organizationId: project?.organizationId,
    projectId: project?.id,
    action,
    targetType,
    targetId,
    metadata,
  });
}

router.get("/account", async (req, res) => {
  res.json(await accountContextDto(req.account!));
});

router.use(requireActiveAccount);

router.patch("/account", async (req, res) => {
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid account profile." });
    return;
  }
  const [account] = await db
    .update(accountsTable)
    .set({ displayName: parsed.data.displayName, updatedAt: new Date() })
    .where(eq(accountsTable.id, req.account!.id))
    .returning();
  req.account = account;
  res.json(await accountContextDto(account));
});

router.post("/dealer-applications", async (req, res) => {
  const parsed = CreateDealerApplicationBody.safeParse(req.body);
  if (!parsed.success || req.account!.role !== "customer") {
    res.status(400).json({ error: "Invalid dealer application." });
    return;
  }
  if (await currentMembership(req.account!.id)) {
    res.status(409).json({ error: "A dealer application already exists." });
    return;
  }
  const base = parsed.data.organizationName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const slug = `${base || "dealer"}-${randomBytes(4).toString("hex")}`;
  const org = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(dealerOrganizationsTable)
      .values({
        name: parsed.data.organizationName.trim(),
        slug,
        createdByAccountId: req.account!.id,
      })
      .returning();
    await tx.insert(organizationMembershipsTable).values({
      organizationId: created.id,
      accountId: req.account!.id,
      role: "owner",
      status: "pending",
    });
    await tx
      .update(accountsTable)
      .set({ role: "dealer", status: "pending", updatedAt: new Date() })
      .where(eq(accountsTable.id, req.account!.id));
    return created;
  });
  await audit(req, "dealer.application.created", "organization", org.id);
  res.status(201).json(organizationDto(org));
});

router.get("/organizations/current", async (req, res) => {
  const context = await currentMembership(req.account!.id);
  if (!context || req.account!.role !== "dealer") {
    res.status(403).json({ error: "Dealer organization access required." });
    return;
  }
  res.json(organizationDto(context.organization));
});

router.get("/organizations/current/members", requireStaff, async (req, res) => {
  const context = await currentMembership(req.account!.id);
  if (
    !context ||
    context.membership.status !== "approved" ||
    context.organization.status !== "approved"
  ) {
    res.status(403).json({ error: "Approved dealer access required." });
    return;
  }
  const rows = await db
    .select({ membership: organizationMembershipsTable, account: accountsTable })
    .from(organizationMembershipsTable)
    .innerJoin(
      accountsTable,
      eq(organizationMembershipsTable.accountId, accountsTable.id),
    )
    .where(
      eq(
        organizationMembershipsTable.organizationId,
        context.organization.id,
      ),
    );
  res.json(
    rows.map(({ membership, account }) => ({
      id: membership.id,
      accountId: account.id,
      email: account.email,
      displayName: account.displayName,
      membershipRole: membership.role,
      status: membership.status,
    })),
  );
});

router.post("/organizations/current/members", requireStaff, async (req, res) => {
  const parsed = CreateOrganizationMemberBody.safeParse(req.body);
  const context = await currentMembership(req.account!.id);
  if (
    !parsed.success ||
    parsed.data.membershipRole !== "member" ||
    !context ||
    context.membership.role !== "owner" ||
    context.membership.status !== "approved" ||
    context.organization.status !== "approved"
  ) {
    res.status(403).json({ error: "Organization owner access required." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [account] = await db
    .select()
    .from(accountsTable)
    .where(eq(accountsTable.email, email))
    .limit(1);
  if (
    !account ||
    !account.emailVerified ||
    account.status === "suspended" ||
    account.role === "staff" ||
    (await currentMembership(account.id))
  ) {
    res.status(409).json({
      error: "That account cannot be added to this organization.",
    });
    return;
  }
  const [membership] = await db
    .insert(organizationMembershipsTable)
    .values({
      organizationId: context.organization.id,
      accountId: account.id,
      role: "member",
      status: "pending",
    })
    .returning();
  await audit(req, "membership.invited", "membership", membership.id);
  res.status(201).json({
    id: membership.id,
    accountId: account.id,
    email: account.email,
    displayName: account.displayName,
    membershipRole: membership.role,
    status: membership.status,
  });
});

router.post("/organizations/current/membership/accept", async (req, res) => {
  const context = await currentMembership(req.account!.id);
  if (
    !context ||
    context.membership.status !== "pending" ||
    context.membership.role !== "member" ||
    context.organization.status !== "approved" ||
    req.account!.role !== "customer" ||
    req.account!.status !== "approved"
  ) {
    res.status(409).json({ error: "No pending dealer team invitation is available." });
    return;
  }
  const account = await db.transaction(async (tx) => {
    await tx
      .update(organizationMembershipsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(organizationMembershipsTable.id, context.membership.id));
    const [updated] = await tx
      .update(accountsTable)
      .set({ role: "dealer", status: "approved", updatedAt: new Date() })
      .where(eq(accountsTable.id, req.account!.id))
      .returning();
    return updated;
  });
  req.account = account;
  await audit(req, "membership.accepted", "membership", context.membership.id);
  res.json(await accountContextDto(account));
});

router.delete("/organizations/current/membership", async (req, res) => {
  const context = await currentMembership(req.account!.id);
  if (
    !context ||
    context.membership.status !== "pending" ||
    context.membership.role !== "member" ||
    req.account!.role !== "customer"
  ) {
    res.status(409).json({ error: "No pending dealer team invitation is available." });
    return;
  }
  await audit(req, "membership.declined", "membership", context.membership.id);
  await db
    .delete(organizationMembershipsTable)
    .where(eq(organizationMembershipsTable.id, context.membership.id));
  res.status(204).end();
});

router.patch("/organizations/current/members/:membershipId", requireStaff, async (req, res) => {
  const parsed = UpdateOrganizationMemberBody.safeParse(req.body);
  const context = await currentMembership(req.account!.id);
  const membershipId = Array.isArray(req.params.membershipId)
    ? req.params.membershipId[0]
    : req.params.membershipId;
  if (
    !parsed.success ||
    !validUuid(membershipId) ||
    !context ||
    context.membership.role !== "owner" ||
    context.membership.status !== "approved"
  ) {
    res.status(403).json({ error: "Organization owner access required." });
    return;
  }
  const [existing] = await db
    .select({ membership: organizationMembershipsTable, account: accountsTable })
    .from(organizationMembershipsTable)
    .innerJoin(
      accountsTable,
      eq(organizationMembershipsTable.accountId, accountsTable.id),
    )
    .where(
      and(
        eq(organizationMembershipsTable.id, membershipId),
        eq(
          organizationMembershipsTable.organizationId,
          context.organization.id,
        ),
      ),
    )
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Membership not found." });
    return;
  }
  if (
    existing.membership.status === "pending"
  ) {
    res.status(409).json({
      error: "A pending invitation can only be accepted by the invited account.",
    });
    return;
  }
  if (existing.membership.accountId === req.account!.id) {
    res.status(409).json({ error: "Owners cannot change their own membership." });
    return;
  }
  const membership = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizationMembershipsTable)
      .set({
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(parsed.data.membershipRole
          ? { role: parsed.data.membershipRole }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(organizationMembershipsTable.id, existing.membership.id))
      .returning();
    if (parsed.data.status) {
      await tx
        .update(accountsTable)
        .set({
          role: "dealer",
          status: parsed.data.status,
          updatedAt: new Date(),
        })
        .where(eq(accountsTable.id, existing.account.id));
    }
    return updated;
  });
  await audit(req, "membership.updated", "membership", membership.id);
  res.json({
    id: membership.id,
    accountId: existing.account.id,
    email: existing.account.email,
    displayName: existing.account.displayName,
    membershipRole: membership.role,
    status: membership.status,
  });
});

router.get("/projects", async (req, res) => {
  const account = req.account!;
  let rows: Project[];
  if (staffRoleCanReadProjects(await getAuthorizedStaffRole(req))) {
    rows = await db
      .select()
      .from(projectsTable)
      .where(isNull(projectsTable.archivedAt))
      .orderBy(desc(projectsTable.updatedAt));
  } else if (account.role === "dealer") {
    const context = await currentMembership(account.id);
    rows =
      context?.membership.status === "approved" &&
      context.organization.status === "approved"
        ? await db
            .select()
            .from(projectsTable)
            .where(
              and(
                eq(projectsTable.organizationId, context.organization.id),
                isNull(projectsTable.archivedAt),
              ),
            )
            .orderBy(desc(projectsTable.updatedAt))
        : [];
  } else {
    rows = await db
      .select({ project: projectsTable })
      .from(projectsTable)
      .innerJoin(
        projectInvitationsTable,
        eq(projectInvitationsTable.projectId, projectsTable.id),
      )
      .where(
        and(
          eq(projectInvitationsTable.acceptedByAccountId, account.id),
          eq(projectInvitationsTable.status, "accepted"),
          isNull(projectsTable.archivedAt),
        ),
      )
      .orderBy(desc(projectsTable.updatedAt))
      .then((result) => result.map(({ project }) => project));
  }
  res.json(rows.map((project) => projectDto(project, account.role === "customer")));
});

router.post("/projects", async (req, res) => {
  const parsed = CreateProjectBody.safeParse(req.body);
  const context = await currentMembership(req.account!.id);
  if (
    !parsed.success ||
    req.account!.role !== "dealer" ||
    req.account!.status !== "approved" ||
    context?.membership.status !== "approved" ||
    context.organization.status !== "approved"
  ) {
    res.status(403).json({ error: "Approved dealer access required." });
    return;
  }
  const [project] = await db
    .insert(projectsTable)
    .values({
      organizationId: context.organization.id,
      name: parsed.data.name.trim(),
      snapshot: durableProjectSnapshot(parsed.data.snapshot as JsonValue),
      createdByAccountId: req.account!.id,
      updatedByAccountId: req.account!.id,
    })
    .returning();
  await audit(req, "project.created", "project", project.id, project);
  res.status(201).json(projectDto(project));
});

router.post("/projects/import", async (req, res) => {
  const parsed = ImportLocalProjectBody.safeParse(req.body);
  const context = await currentMembership(req.account!.id);
  if (
    !parsed.success ||
    req.account!.role !== "dealer" ||
    req.account!.status !== "approved" ||
    context?.membership.status !== "approved" ||
    context.organization.status !== "approved"
  ) {
    res.status(403).json({ error: "Approved dealer access required." });
    return;
  }
  const importSourceId = createHash("sha256")
    .update(context.organization.id)
    .update("\0")
    .update(parsed.data.localProjectId)
    .digest("hex");
  const [existing] = await db
    .select()
    .from(projectsTable)
    .where(
      and(
        eq(projectsTable.organizationId, context.organization.id),
        eq(projectsTable.importSourceId, importSourceId),
      ),
    )
    .limit(1);
  if (existing) {
    res.json(projectDto(existing));
    return;
  }
  const [project] = await db
    .insert(projectsTable)
    .values({
      organizationId: context.organization.id,
      name: parsed.data.name.trim(),
      snapshot: durableProjectSnapshot(parsed.data.snapshot as JsonValue),
      importSourceId,
      createdByAccountId: req.account!.id,
      updatedByAccountId: req.account!.id,
    })
    .returning();
  await audit(req, "project.imported", "project", project.id, project, {
    source: "local_explicit_claim",
  });
  res.status(201).json(projectDto(project));
});

router.get("/projects/:projectId", async (req, res) => {
  const project = await findProject(req.params.projectId);
  if (!project || !(await canReadProject(req, project))) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  res.json(projectDto(project, req.account!.role === "customer"));
});

router.put("/projects/:projectId", async (req, res) => {
  const parsed = UpdateProjectBody.safeParse(req.body);
  const project = await findProject(req.params.projectId);
  if (!parsed.success || !project || !(await canWriteProject(req, project))) {
    res.status(project ? 403 : 404).json({ error: project ? "Forbidden." : "Project not found." });
    return;
  }
  const [updated] = await db
    .update(projectsTable)
    .set({
      name: parsed.data.name.trim(),
      snapshot: durableProjectSnapshot(parsed.data.snapshot as JsonValue),
      version: sql`${projectsTable.version} + 1`,
      updatedByAccountId: req.account!.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(projectsTable.id, project.id),
        eq(projectsTable.version, parsed.data.version),
      ),
    )
    .returning();
  if (!updated) {
    res.status(409).json({ error: "Project was changed on another device." });
    return;
  }
  await audit(req, "project.updated", "project", project.id, updated, {
    version: updated.version,
  });
  res.json(projectDto(updated));
});

router.delete("/projects/:projectId", async (req, res) => {
  const project = await findProject(req.params.projectId);
  if (!project || !(await canWriteProject(req, project))) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  await db
    .update(projectsTable)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(projectsTable.id, project.id));
  await audit(req, "project.archived", "project", project.id, project);
  res.status(204).end();
});

router.get("/projects/:projectId/invitations", async (req, res) => {
  const project = await findProject(req.params.projectId);
  if (!project || !(await canWriteProject(req, project))) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const invitations = await db
    .select()
    .from(projectInvitationsTable)
    .where(eq(projectInvitationsTable.projectId, project.id))
    .orderBy(desc(projectInvitationsTable.createdAt));
  res.json(invitations.map(invitationDto));
});

router.post("/projects/:projectId/invitations", async (req, res) => {
  const parsed = CreateProjectInvitationBody.safeParse(req.body);
  const project = await findProject(req.params.projectId);
  if (!parsed.success || !project || !(await canWriteProject(req, project))) {
    res.status(project ? 400 : 404).json({ error: "Invalid invitation." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  if (!emailPattern.test(email)) {
    res.status(400).json({ error: "Invalid invitation email." });
    return;
  }
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [invitation] = await db
    .insert(projectInvitationsTable)
    .values({
      projectId: project.id,
      email,
      tokenHash,
      invitedByAccountId: req.account!.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    .returning();
  await audit(req, "invitation.created", "invitation", invitation.id, project);
  res.status(201).json({ ...invitationDto(invitation), token });
});

router.post("/invitations/accept", async (req, res) => {
  const parsed = AcceptProjectInvitationBody.safeParse(req.body);
  if (!parsed.success || req.account!.role !== "customer") {
    res.status(403).json({ error: "Invitation cannot be accepted." });
    return;
  }
  const hash = createHash("sha256").update(parsed.data.token).digest("hex");
  const acceptedAt = new Date();
  const [invitation] = await db
    .update(projectInvitationsTable)
    .set({
      status: "accepted",
      acceptedByAccountId: req.account!.id,
      acceptedAt,
    })
    .where(
      and(
        eq(projectInvitationsTable.tokenHash, hash),
        eq(projectInvitationsTable.status, "pending"),
        eq(projectInvitationsTable.email, req.account!.email),
        gt(projectInvitationsTable.expiresAt, acceptedAt),
      ),
    )
    .returning();
  if (!invitation) {
    res.status(403).json({ error: "Invitation is invalid or expired." });
    return;
  }
  const project = await findProject(invitation.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  await audit(req, "invitation.accepted", "invitation", invitation.id, project);
  res.json(projectDto(project, true));
});

router.delete("/invitations/:invitationId", async (req, res) => {
  if (!validUuid(req.params.invitationId)) {
    res.status(404).json({ error: "Invitation not found." });
    return;
  }
  const [invitation] = await db
    .select()
    .from(projectInvitationsTable)
    .where(eq(projectInvitationsTable.id, req.params.invitationId))
    .limit(1);
  const project = invitation ? await findProject(invitation.projectId) : null;
  if (!invitation || !project || !(await canWriteProject(req, project))) {
    res.status(404).json({ error: "Invitation not found." });
    return;
  }
  await db
    .update(projectInvitationsTable)
    .set({ status: "revoked" })
    .where(eq(projectInvitationsTable.id, invitation.id));
  await audit(req, "invitation.revoked", "invitation", invitation.id, project);
  res.status(204).end();
});

router.get("/projects/:projectId/images", async (req, res) => {
  const project = await findProject(req.params.projectId);
  if (!project || !(await canReadProject(req, project))) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const images = await db
    .select()
    .from(projectImagesTable)
    .where(eq(projectImagesTable.projectId, project.id));
  res.json(images.map(imageDto));
});

router.post("/projects/:projectId/images", async (req, res) => {
  const parsed = RequestProjectImageUploadBody.safeParse(req.body);
  const project = await findProject(req.params.projectId);
  if (!parsed.success || !project || !(await canWriteProject(req, project))) {
    res.status(project ? 400 : 404).json({ error: "Invalid image upload request." });
    return;
  }
  if (
    !imageContentTypes.has(parsed.data.contentType)
    || parsed.data.byteSize > PROJECT_IMAGE_MAX_BYTES
  ) {
    res.status(400).json({ error: "Choose a JPEG, PNG, or WebP image up to 10 MB." });
    return;
  }
  const tempObjectPath = storage.createObjectEntityUploadPath(req.account!.id);
  const result = await db.transaction(async (tx) => {
    // Transaction-scoped advisory locks make both project count and per-actor
    // pending quotas race-safe across server instances.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`image-project:${project.id}`}))`);
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`image-account:${req.account!.id}`}))`);
    const images = await tx.select({ id: projectImagesTable.id }).from(projectImagesTable)
      .where(eq(projectImagesTable.projectId, project.id));
    const pending = await tx.select({ id: projectImageUploadIntentsTable.id }).from(projectImageUploadIntentsTable)
      .where(and(
        eq(projectImageUploadIntentsTable.requestedByAccountId, req.account!.id),
        isNull(projectImageUploadIntentsTable.consumedAt),
        gt(projectImageUploadIntentsTable.expiresAt, new Date()),
      ));
    if (images.length >= PROJECT_IMAGE_MAX_COUNT) return { error: "count" as const };
    if (pending.length >= PROJECT_IMAGE_MAX_PENDING_PER_ACCOUNT) return { error: "pending" as const };
    const [intent] = await tx
      .insert(projectImageUploadIntentsTable)
      .values({
        projectId: project.id,
        requestedByAccountId: req.account!.id,
        tempObjectPath,
        fileName: parsed.data.fileName.trim(),
        contentType: parsed.data.contentType,
        byteSize: parsed.data.byteSize,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      })
      .returning();
    return { intent };
  });
  if ("error" in result && result.error === "count") {
    res.status(409).json({ error: `A project may contain at most ${PROJECT_IMAGE_MAX_COUNT} images.` });
    return;
  }
  if ("error" in result && result.error === "pending") {
    res.status(429).json({ error: "Too many image uploads are already in progress." });
    return;
  }
  if (!("intent" in result)) {
    res.status(500).json({ error: "Unable to authorize image upload." });
    return;
  }
  const intent = result.intent;
  res.json({
    uploadUrl: `/api/projects/${project.id}/images/uploads/${intent.id}`,
    uploadId: intent.id,
  });
});

router.put("/projects/:projectId/images/uploads/:uploadId", async (req, res) => {
  const project = await findProject(req.params.projectId);
  if (!project || !(await canWriteProject(req, project)) || !validUuid(req.params.uploadId)) {
    res.status(404).json({ error: "Image upload not found." });
    return;
  }
  const [intent] = await db.select().from(projectImageUploadIntentsTable).where(and(
    eq(projectImageUploadIntentsTable.id, req.params.uploadId),
    eq(projectImageUploadIntentsTable.projectId, project.id),
    eq(projectImageUploadIntentsTable.requestedByAccountId, req.account!.id),
    isNull(projectImageUploadIntentsTable.consumedAt),
    gt(projectImageUploadIntentsTable.expiresAt, new Date()),
  )).limit(1);
  if (!intent) {
    res.status(404).json({ error: "Image upload not found or expired." });
    return;
  }
  if (!uploadHeadersMatch(
    req.get("content-type"),
    req.get("content-length"),
    intent.contentType,
    intent.byteSize,
  )) {
    res.status(400).json({ error: "Upload headers do not match the authorized image." });
    return;
  }
  try {
    await storage.uploadBoundedObject(
      intent.tempObjectPath,
      req,
      intent.contentType,
      intent.byteSize,
    );
    res.status(204).end();
  } catch {
    res.status(400).json({ error: "Upload size or content did not match the authorized image." });
  }
});

router.post("/projects/:projectId/images/complete", async (req, res) => {
  const parsed = CompleteProjectImageUploadBody.safeParse(req.body);
  const project = await findProject(req.params.projectId);
  if (!parsed.success || !project || !(await canWriteProject(req, project))) {
    res.status(project ? 400 : 404).json({ error: "Invalid image." });
    return;
  }
  const now = new Date();
  const intent = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`image-project:${project.id}`}))`);
    const existingImages = await tx.select({ id: projectImagesTable.id })
      .from(projectImagesTable).where(eq(projectImagesTable.projectId, project.id));
    const reservations = await tx.select({ id: projectImageUploadIntentsTable.id })
      .from(projectImageUploadIntentsTable).where(and(
        eq(projectImageUploadIntentsTable.projectId, project.id),
        isNotNull(projectImageUploadIntentsTable.consumedAt),
      ));
    if (existingImages.length + reservations.length >= PROJECT_IMAGE_MAX_COUNT) return null;
    const [claimed] = await tx
      .update(projectImageUploadIntentsTable)
      .set({ consumedAt: now })
      .where(
        and(
          eq(projectImageUploadIntentsTable.id, parsed.data.uploadId),
          eq(projectImageUploadIntentsTable.projectId, project.id),
          eq(projectImageUploadIntentsTable.requestedByAccountId, req.account!.id),
          isNull(projectImageUploadIntentsTable.consumedAt),
          gt(projectImageUploadIntentsTable.expiresAt, now),
        ),
      )
      .returning();
    return claimed ?? null;
  });
  if (!intent) {
    res.status(400).json({ error: "Image upload is invalid or expired." });
    return;
  }

  let finalObjectPath: string | null = null;
  let image: typeof projectImagesTable.$inferSelect;
  try {
    const file = await storage.getObjectEntityFile(intent.tempObjectPath);
    const [metadata] = await file.getMetadata();
    const sourceGeneration = String(metadata.generation || "");
    const versionedFile = file.bucket.file(file.name, {
      generation: sourceGeneration,
    });
    if (
      Number(metadata.size) !== intent.byteSize
      || metadata.contentType !== intent.contentType
      || !sourceGeneration
      || !imageContentTypes.has(intent.contentType)
    ) {
      throw new Error("Uploaded image validation failed");
    }

    const sanitizedBytes = await sanitizeRaster(
      versionedFile,
      intent.contentType,
      intent.byteSize,
    );
    finalObjectPath = await storage.finalizeObjectEntityUpload(
      intent.tempObjectPath,
      intent.contentType,
      sourceGeneration,
      "project-images",
      sanitizedBytes,
    );
    [image] = await db
      .insert(projectImagesTable)
      .values({
        projectId: project.id,
        objectPath: finalObjectPath,
        fileName: intent.fileName,
        contentType: intent.contentType,
        byteSize: sanitizedBytes.length,
        uploadedByAccountId: req.account!.id,
      })
      .returning();
  } catch (error) {
    if (finalObjectPath) {
      await storage.deleteObjectEntity(finalObjectPath).catch(() => undefined);
    }
    await storage.deleteObjectEntity(intent.tempObjectPath).catch(() => undefined);
    await db.delete(projectImageUploadIntentsTable)
      .where(eq(projectImageUploadIntentsTable.id, intent.id));
    if (error instanceof ObjectNotFoundError) {
      res.status(400).json({ error: "Uploaded image was not found." });
      return;
    }
    res.status(400).json({ error: "Uploaded image failed validation." });
    return;
  }
  await db.delete(projectImageUploadIntentsTable)
    .where(eq(projectImageUploadIntentsTable.id, intent.id));
  await audit(req, "image.created", "project_image", image.id, project);
  res.status(201).json(imageDto(image));
});

router.get("/project-images/:imageId/content", async (req, res) => {
  if (!validUuid(req.params.imageId)) {
    res.status(404).json({ error: "Image not found." });
    return;
  }
  const [row] = await db
    .select({ image: projectImagesTable, project: projectsTable })
    .from(projectImagesTable)
    .innerJoin(projectsTable, eq(projectImagesTable.projectId, projectsTable.id))
    .where(eq(projectImagesTable.id, req.params.imageId))
    .limit(1);
  if (!row || !(await canReadProject(req, row.project))) {
    res.status(404).json({ error: "Image not found." });
    return;
  }
  if (!imageContentTypes.has(row.image.contentType)) {
    res.status(404).json({ error: "Image not found." });
    return;
  }
  const file = await storage.getObjectEntityFile(row.image.objectPath);
  const response = await storage.downloadObject(file, 0, row.image.contentType);
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  if (!response.body) {
    res.end();
    return;
  }
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
});

router.delete("/project-images/:imageId", async (req, res) => {
  if (!validUuid(req.params.imageId)) {
    res.status(404).json({ error: "Image not found." });
    return;
  }
  const [row] = await db
    .select({ image: projectImagesTable, project: projectsTable })
    .from(projectImagesTable)
    .innerJoin(projectsTable, eq(projectImagesTable.projectId, projectsTable.id))
    .where(eq(projectImagesTable.id, req.params.imageId))
    .limit(1);
  if (!row || !(await canWriteProject(req, row.project))) {
    res.status(404).json({ error: "Image not found." });
    return;
  }
  const file = await storage.getObjectEntityFile(row.image.objectPath);
  await file.delete();
  await db
    .delete(projectImagesTable)
    .where(eq(projectImagesTable.id, row.image.id));
  await audit(req, "image.deleted", "project_image", row.image.id, row.project);
  res.status(204).end();
});

router.get("/audit-events", async (req, res) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : null;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  let organizationId: string | null = null;
  if (req.account!.role === "dealer") {
    const context = await currentMembership(req.account!.id);
    organizationId =
      context?.membership.status === "approved" ? context.organization.id : null;
    if (!organizationId) {
      res.status(403).json({ error: "Approved dealer access required." });
      return;
    }
  } else if (!["super_admin", "staff_admin"].includes((await getAuthorizedStaffRole(req)) ?? "")) {
    if (!projectId) {
      res.status(403).json({ error: "Project scope is required." });
      return;
    }
    const project = await findProject(projectId);
    if (!project || !(await canReadProject(req, project))) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
  }
  const events = await db
    .select()
    .from(auditEventsTable)
    .where(
      and(
        projectId && validUuid(projectId)
          ? eq(auditEventsTable.projectId, projectId)
          : undefined,
        organizationId
          ? eq(auditEventsTable.organizationId, organizationId)
          : undefined,
      ),
    )
    .orderBy(desc(auditEventsTable.createdAt))
    .limit(limit);
  res.json(
    events.map((event) => ({
      id: event.id,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      metadata: event.metadata,
      createdAt: event.createdAt,
    })),
  );
});

router.get("/staff/dealer-organizations", requireStaff, async (req, res) => {
  const status =
    req.query.status === "pending" ||
    req.query.status === "approved" ||
    req.query.status === "suspended"
      ? req.query.status
      : null;
  const rows = await db
    .select()
    .from(dealerOrganizationsTable)
    .where(status ? eq(dealerOrganizationsTable.status, status) : undefined)
    .orderBy(desc(dealerOrganizationsTable.createdAt));
  res.json(rows.map(organizationDto));
});

router.patch(
  "/staff/dealer-organizations/:organizationId/status",
  requireStaff,
  async (req, res) => {
    const parsed = UpdateDealerOrganizationStatusBody.safeParse(req.body);
    const organizationId = Array.isArray(req.params.organizationId)
      ? req.params.organizationId[0]
      : req.params.organizationId;
    if (!parsed.success || !organizationId || !validUuid(organizationId)) {
      res.status(400).json({ error: "Invalid organization status." });
      return;
    }
    const [org] = await db.transaction(async (tx) => {
      const updated = await tx
        .update(dealerOrganizationsTable)
        .set({
          status: parsed.data.status,
          approvedByAccountId:
            parsed.data.status === "approved" ? req.account!.id : null,
          approvedAt: parsed.data.status === "approved" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(dealerOrganizationsTable.id, organizationId))
        .returning();
      if (!updated[0]) return [];
      const memberRows = await tx
        .select({ accountId: organizationMembershipsTable.accountId })
        .from(organizationMembershipsTable)
        .where(
          and(
            eq(organizationMembershipsTable.organizationId, updated[0].id),
            or(
              eq(organizationMembershipsTable.role, "owner"),
              ne(organizationMembershipsTable.status, "pending"),
            ),
          ),
        );
      await tx
        .update(organizationMembershipsTable)
        .set({
          status:
            parsed.data.status === "approved" ? "approved" : "suspended",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(organizationMembershipsTable.organizationId, updated[0].id),
            or(
              eq(organizationMembershipsTable.role, "owner"),
              ne(organizationMembershipsTable.status, "pending"),
            ),
          ),
        );
      for (const member of memberRows) {
        await tx
          .update(accountsTable)
          .set({
            role: "dealer",
            status: parsed.data.status,
            updatedAt: new Date(),
          })
          .where(eq(accountsTable.id, member.accountId));
      }
      return updated;
    });
    if (!org) {
      res.status(404).json({ error: "Organization not found." });
      return;
    }
    await audit(req, "organization.status.updated", "organization", org.id, undefined, {
      status: org.status,
    });
    res.json(organizationDto(org));
  },
);

export default router;