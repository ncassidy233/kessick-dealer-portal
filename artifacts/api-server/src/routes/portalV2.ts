import { Router, type IRouter, type Request, type Response } from "express";
import { createClerkClient } from "@clerk/backend";
import {
  accountsTable,
  auditEventsTable,
  db,
  dealerOrganizationsTable,
  organizationMembershipsTable,
  portalContentTable,
  portalContentTargetsTable,
  portalDealerProfilesTable,
  portalGroupAssignmentsTable,
  portalGroupMembershipsTable,
  portalGroupsTable,
  portalNotificationPreferencesTable,
  portalNotificationRecipientsV2Table,
  portalNotificationTargetsTable,
  portalNotificationsV2Table,
  portalPushSubscriptionsTable,
  portalFormsTable,
  portalResourcesTable,
  portalStaffProfilesTable,
  pricebooksTable,
} from "@workspace/db";
import { and, desc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import webPush from "web-push";
import { z } from "zod";
import { requireAccount, requireActiveAccount } from "../middlewares/auth";
import {
  hasPortalCapability,
  portalCapabilities,
  resolvePortalBootstrapAccess,
  type PortalStaffRole,
} from "../lib/portalPermissions";
import { canClaimPush, isDealerNotificationVisible, isNotificationDue, notificationCanBeEdited, shouldListDealerNotification } from "../lib/portalNotificationPolicy";
import { isPortalTargetVisible, legacyPageCapabilityForContent, linkedResourceId, shouldDisableLinkedLegacyContent } from "../lib/portalTargetPolicy";
import { logger } from "../lib/logger";
import { approvedDealerAccountIds, isApprovedDealerAccount } from "../lib/portalDealerEligibility";
import { canViewLegacyPortalCapability } from "../lib/portalLegacyAccess";
import linkedFormsRouter from "./linkedForms";
import { dealerProvisioningPlan } from "../lib/portalDealerProvisioning";
import { portalInvitationRedirectUrl } from "../lib/portalInvitation";
import { requestSourceOrigin } from "../security/origin";
import {
  configurePushFromEnvironment,
  isAllowedPushEndpoint,
  mapWithConcurrency,
  PUSH_MAX_CONCURRENCY,
  PUSH_MAX_SUBSCRIPTIONS_PER_DISPATCH,
  PUSH_SEND_TIMEOUT_MS,
} from "../lib/pushSecurity";

const router: IRouter = Router();
const uuid = z.string().uuid();
const staffRoles = z.enum(["super_admin", "staff_admin", "sales_rep", "content_manager"]);
const contentKinds = z.enum(["project", "price_book", "resource_category", "product_series", "finish", "training", "launch_kit", "resource", "form", "announcement"]);
const visibility = z.enum(["everyone", "groups", "individuals"]);
const notificationStatuses = z.enum(["draft", "scheduled", "sent", "cancelled"]);
const priority = z.enum(["low", "normal", "high"]);
const accountStatus = z.enum(["pending", "approved", "suspended"]);
const url = z.string().url().max(2048).refine((value) => ["http:", "https:"].includes(new URL(value).protocol), "Only HTTP(S) URLs are supported.");
const pushConfiguration = configurePushFromEnvironment();
const pushConfigured = pushConfiguration.configured;
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

type StaffRole = PortalStaffRole;

function rawParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
function can(role: StaffRole, action: string): boolean {
  return hasPortalCapability(role, action);
}
async function getStaffRole(req: Request): Promise<StaffRole | null> {
  if (req.account?.role !== "staff" || req.account.status !== "approved") return null;
  const [profile] = await db.select().from(portalStaffProfilesTable)
    .where(eq(portalStaffProfilesTable.accountId, req.account.id)).limit(1);
  if (!profile?.authorizedAt || profile.authorizedClerkUserId !== req.account.clerkUserId) return null;
  return profile.role;
}
async function requireApprovedDealer(req: Request, res: Response): Promise<boolean> {
  if (!req.account || !await isApprovedDealerAccount(req.account.id)) {
    res.status(403).json({ error: "Approved dealer organization membership required." });
    return false;
  }
  return true;
}
function requireCapability(action: string) {
  return async (req: Request, res: Response, next: () => void): Promise<void> => {
    const role = await getStaffRole(req);
    if (!role || !can(role, action)) {
      res.status(403).json({ error: "Insufficient portal privilege." });
      return;
    }
    (req as Request & { portalStaffRole?: StaffRole }).portalStaffRole = role;
    next();
  };
}
function staffRole(req: Request): StaffRole {
  return (req as Request & { portalStaffRole: StaffRole }).portalStaffRole;
}
async function audit(req: Request | null, action: string, targetType: string, targetId: string | null, metadata: Record<string, unknown> = {}) {
  await db.insert(auditEventsTable).values({
    actorAccountId: req?.account?.id ?? null,
    action,
    targetType,
    targetId,
    metadata: metadata as never,
  });
}
async function groupsForAccount(accountId: string) {
  const [memberships, legacy] = await Promise.all([
    db.select({ id: portalGroupsTable.id, name: portalGroupsTable.name, description: portalGroupsTable.description })
    .from(portalGroupMembershipsTable)
    .innerJoin(portalGroupsTable, eq(portalGroupMembershipsTable.groupId, portalGroupsTable.id))
    .where(eq(portalGroupMembershipsTable.accountId, accountId)),
    db.select({ id: portalGroupsTable.id, name: portalGroupsTable.name, description: portalGroupsTable.description })
      .from(portalGroupAssignmentsTable)
      .innerJoin(portalGroupsTable, eq(portalGroupAssignmentsTable.groupId, portalGroupsTable.id))
      .where(eq(portalGroupAssignmentsTable.accountId, accountId)),
  ]);
  return [...new Map([...memberships, ...legacy].map((group) => [group.id, group])).values()];
}
async function userDto(account: typeof accountsTable.$inferSelect) {
  const [groups, profiles] = await Promise.all([
    groupsForAccount(account.id),
    db.select().from(portalDealerProfilesTable).where(eq(portalDealerProfilesTable.accountId, account.id)).limit(1),
  ]);
  const [staff] = await db.select().from(portalStaffProfilesTable).where(eq(portalStaffProfilesTable.accountId, account.id)).limit(1);
  const assignedRepId = profiles[0]?.assignedSalesRepAccountId ?? null;
  const [assignedRep] = assignedRepId
    ? await db.select({ id: accountsTable.id, email: accountsTable.email, displayName: accountsTable.displayName }).from(accountsTable).where(eq(accountsTable.id, assignedRepId)).limit(1)
    : [null];
  return {
    ...account,
    portalRole: staff?.role ?? null,
    groups,
    assignedRepId,
    assignedRep,
    invitationEligible:
      account.clerkUserId.startsWith("pending:") ||
      account.clerkUserId.startsWith("invited:") ||
      account.clerkUserId.startsWith("staff:"),
  };
}
async function createPortalInvitation(
  req: Request,
  email: string,
  role: "dealer" | "staff",
  ignoreExisting = false,
) {
  const origin = requestSourceOrigin(req);
  if (!origin) throw Object.assign(new Error("Request origin could not be verified."), { status: 403 });
  const previousInvitations = ignoreExisting
    ? (await clerk.invitations.getInvitationList({ query: email })).data.filter(
        (invitation) =>
          invitation.emailAddress.toLowerCase() === email.toLowerCase() &&
          invitation.status === "pending",
      )
    : [];
  const invitation = await clerk.invitations.createInvitation({
    emailAddress: email,
    notify: true,
    ...(ignoreExisting ? { ignoreExisting: true } : {}),
    redirectUrl: portalInvitationRedirectUrl(
      origin,
      process.env.BASE_PATH ?? "/",
      role,
    ),
  });
  await Promise.all(
    previousInvitations
      .filter((previous) => previous.id !== invitation.id)
      .map(async (previous) => {
        try {
          await clerk.invitations.revokeInvitation(previous.id);
        } catch (error) {
          req.log.warn({ err: error }, "Previous Clerk invitation could not be revoked");
        }
      }),
  );
  return invitation;
}
async function groupDto(group: typeof portalGroupsTable.$inferSelect) {
  const [members, legacyMembers] = await Promise.all([
    db.select({ accountId: portalGroupMembershipsTable.accountId }).from(portalGroupMembershipsTable).where(eq(portalGroupMembershipsTable.groupId, group.id)),
    db.select({ accountId: portalGroupAssignmentsTable.accountId }).from(portalGroupAssignmentsTable).where(eq(portalGroupAssignmentsTable.groupId, group.id)),
  ]);
  return { ...group, memberCount: new Set([...members.map((member) => member.accountId), ...legacyMembers.map((member) => member.accountId)]).size };
}
async function assertDealerAccounts(accountIds: string[]) {
  const unique = [...new Set(accountIds)];
  if (!unique.length) return;
  const rows = await db.select({ id: accountsTable.id }).from(accountsTable)
    .where(and(inArray(accountsTable.id, unique), eq(accountsTable.role, "dealer")));
  if (rows.length !== unique.length) throw new Error("One or more targets are not dealer accounts.");
}
async function assertGroups(groupIds: string[]) {
  const unique = [...new Set(groupIds)];
  if (!unique.length) return;
  const rows = await db.select({ id: portalGroupsTable.id }).from(portalGroupsTable).where(inArray(portalGroupsTable.id, unique));
  if (rows.length !== unique.length) throw new Error("One or more target groups do not exist.");
}
async function contentDto(content: typeof portalContentTable.$inferSelect) {
  const targets = await db.select().from(portalContentTargetsTable).where(eq(portalContentTargetsTable.contentId, content.id));
  return {
    ...content,
    targets: { groupIds: targets.flatMap((target) => target.groupId ? [target.groupId] : []), accountIds: targets.flatMap((target) => target.accountId ? [target.accountId] : []) },
  };
}
const contentInput = z.object({
  kind: contentKinds,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  visibility,
  groupIds: z.array(uuid).max(500).optional(),
  accountIds: z.array(uuid).max(1000).optional(),
  published: z.boolean().optional(),
});
function validateContentTargets(value: Pick<z.infer<typeof contentInput>, "visibility" | "groupIds" | "accountIds">): string | null {
  const groups = value.groupIds ?? [];
  const accounts = value.accountIds ?? [];
  if (value.visibility === "everyone" && (groups.length || accounts.length)) return "Everyone content cannot have targets.";
  if (value.visibility === "groups" && (!groups.length || accounts.length)) return "Group content requires group targets only.";
  if (value.visibility === "individuals" && (!accounts.length || groups.length)) return "Individual content requires dealer targets only.";
  return null;
}

async function resolveNotificationRecipients(notificationId: string): Promise<string[]> {
  const targets = await db.select().from(portalNotificationTargetsTable)
    .where(eq(portalNotificationTargetsTable.notificationId, notificationId));
  const accountIds = new Set(targets.flatMap((target) => target.accountId ? [target.accountId] : []));
  if (targets.some((target) => target.everyone)) {
    const all = await db.select({ id: accountsTable.id }).from(accountsTable)
      .where(and(eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved")));
    all.forEach(({ id }) => accountIds.add(id));
  }
  const groupIds = targets.flatMap((target) => target.groupId ? [target.groupId] : []);
  if (groupIds.length) {
    const [members, legacyMembers] = await Promise.all([
      db.select({ accountId: portalGroupMembershipsTable.accountId }).from(portalGroupMembershipsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, portalGroupMembershipsTable.accountId))
        .where(and(inArray(portalGroupMembershipsTable.groupId, groupIds), eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved"))),
      db.select({ accountId: portalGroupAssignmentsTable.accountId }).from(portalGroupAssignmentsTable)
        .innerJoin(accountsTable, eq(accountsTable.id, portalGroupAssignmentsTable.accountId))
        .where(and(inArray(portalGroupAssignmentsTable.groupId, groupIds), eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved"))),
    ]);
    [...members, ...legacyMembers].forEach(({ accountId }) => accountIds.add(accountId));
  }
  if (!accountIds.size) return [];
  return approvedDealerAccountIds([...accountIds]);
}
async function notificationDto(notification: typeof portalNotificationsV2Table.$inferSelect) {
  const [targets, recipients] = await Promise.all([
    db.select().from(portalNotificationTargetsTable).where(eq(portalNotificationTargetsTable.notificationId, notification.id)),
    db.select().from(portalNotificationRecipientsV2Table).where(eq(portalNotificationRecipientsV2Table.notificationId, notification.id)),
  ]);
  return {
    ...notification,
    targets: {
      everyone: targets.some((target) => target.everyone),
      groupIds: targets.flatMap((target) => target.groupId ? [target.groupId] : []),
      accountIds: targets.flatMap((target) => target.accountId ? [target.accountId] : []),
    },
    delivery: {
      recipients: recipients.length,
      delivered: recipients.length,
      pushSent: recipients.filter((recipient) => recipient.pushStatus === "sent").length,
      pushFailed: recipients.filter((recipient) => recipient.pushStatus === "failed").length,
      pushSkipped: recipients.filter((recipient) => recipient.pushStatus === "skipped_vapid").length,
    },
  };
}
async function replaceNotificationTargets(notificationId: string, target: { everyone?: boolean; groupIds?: string[]; accountIds?: string[] }) {
  await db.delete(portalNotificationTargetsTable).where(eq(portalNotificationTargetsTable.notificationId, notificationId));
  const values = [
    ...(target.everyone ? [{ notificationId, everyone: true, groupId: null, accountId: null }] : []),
    ...[...new Set(target.groupIds ?? [])].map((groupId) => ({ notificationId, everyone: false, groupId, accountId: null })),
    ...[...new Set(target.accountIds ?? [])].map((accountId) => ({ notificationId, everyone: false, groupId: null, accountId })),
  ];
  if (values.length) await db.insert(portalNotificationTargetsTable).values(values);
}
const notificationInput = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10_000),
  imageUrl: url.nullable().optional(),
  linkUrl: url.nullable().optional(),
  priority: priority.optional(),
  status: z.enum(["draft", "scheduled"]).optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  acknowledgementRequired: z.boolean().optional(),
  target: z.object({ everyone: z.boolean().optional(), groupIds: z.array(uuid).max(500).optional(), accountIds: z.array(uuid).max(1000).optional() }),
}).superRefine((value, ctx) => {
  if (!value.target.everyone && !value.target.groupIds?.length && !value.target.accountIds?.length) ctx.addIssue({ code: "custom", message: "At least one notification target is required." });
  if (value.status === "scheduled" && !value.scheduledFor) ctx.addIssue({ code: "custom", message: "Scheduled notifications require scheduledFor." });
  if (value.expiresAt && value.scheduledFor && value.expiresAt <= value.scheduledFor) ctx.addIssue({ code: "custom", message: "Expiry must be after the scheduled time." });
});
const notificationPatchInput = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().min(1).max(10_000).optional(),
  imageUrl: url.nullable().optional(),
  linkUrl: url.nullable().optional(),
  priority: priority.optional(),
  status: notificationStatuses.optional(),
  scheduledFor: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  acknowledgementRequired: z.boolean().optional(),
  target: z.object({ everyone: z.boolean().optional(), groupIds: z.array(uuid).max(500).optional(), accountIds: z.array(uuid).max(1000).optional() }).optional(),
});

/** DB state is authoritative; due rows are safely reclaimed after an interrupted restart. */
export async function processDuePortalNotifications(): Promise<void> {
  const now = new Date();
  const due = await db.select().from(portalNotificationsV2Table)
    .where(and(eq(portalNotificationsV2Table.status, "scheduled"), lte(portalNotificationsV2Table.scheduledFor, now)));
  for (const candidate of due) {
    if (!isNotificationDue(candidate.status, candidate.scheduledFor, now)) continue;
    if (candidate.expiresAt && candidate.expiresAt <= now) {
      await db.update(portalNotificationsV2Table).set({ status: "cancelled", updatedAt: now })
        .where(and(eq(portalNotificationsV2Table.id, candidate.id), eq(portalNotificationsV2Table.status, "scheduled")));
      await audit(null, "portal_v2.notification.expired_before_send", "notification", candidate.id);
      continue;
    }
    const [claim] = await db.update(portalNotificationsV2Table)
      .set({ schedulerClaimedAt: now, updatedAt: now })
      .where(and(eq(portalNotificationsV2Table.id, candidate.id), eq(portalNotificationsV2Table.status, "scheduled")))
      .returning();
    if (claim) await deliverPortalNotification(claim, null);
  }
  const sent = await db.select().from(portalNotificationsV2Table)
    .where(eq(portalNotificationsV2Table.status, "sent"));
  for (const notification of sent) {
    if (notification.expiresAt && notification.expiresAt <= now) continue;
    await processPendingPushes(notification, null);
  }
}
async function deliverPortalNotification(notification: typeof portalNotificationsV2Table.$inferSelect, req: Request | null) {
  if (notification.status === "cancelled") return;
  const targetRecipientIds = await resolveNotificationRecipients(notification.id);
  const preferences = targetRecipientIds.length
    ? await db.select().from(portalNotificationPreferencesTable).where(inArray(portalNotificationPreferencesTable.accountId, targetRecipientIds))
    : [];
  const preferenceByAccount = new Map(preferences.map((value) => [value.accountId, value]));
  const recipientIds = targetRecipientIds;
  const level = { low: 0, normal: 1, high: 2 };
  if (recipientIds.length) {
    await db.insert(portalNotificationRecipientsV2Table).values(recipientIds.map((accountId) => ({
      notificationId: notification.id,
      accountId,
      pushStatus: !pushConfigured
        ? "skipped_vapid"
        : preferenceByAccount.get(accountId)?.pushEnabled === false ||
            level[notification.priority] < level[preferenceByAccount.get(accountId)?.priorityThreshold ?? "low"]
          ? "skipped_preference"
          : "pending",
    }))).onConflictDoNothing();
  }
  const [sent] = await db.update(portalNotificationsV2Table)
    .set({ status: "sent", sentAt: new Date(), schedulerClaimedAt: null, updatedAt: new Date() })
    .where(and(eq(portalNotificationsV2Table.id, notification.id), or(eq(portalNotificationsV2Table.status, "scheduled"), eq(portalNotificationsV2Table.status, "draft"))))
    .returning();
  if (!sent) return;
  await processPendingPushes(sent, req);
  await audit(req, "portal_v2.notification.sent", "notification", sent.id, { recipientCount: recipientIds.length, pushConfigured });
}
async function processPendingPushes(notification: typeof portalNotificationsV2Table.$inferSelect, req: Request | null) {
  if (!pushConfigured) return;
  let remainingDispatchQuota = PUSH_MAX_SUBSCRIPTIONS_PER_DISPATCH;
  const staleAt = new Date(Date.now() - 5 * 60_000);
  const recipients = await db.select().from(portalNotificationRecipientsV2Table)
    .where(eq(portalNotificationRecipientsV2Table.notificationId, notification.id));
  for (const recipient of recipients) {
    if (remainingDispatchQuota <= 0) break;
    if (!canClaimPush(recipient.pushStatus, recipient.pushClaimedAt, recipient.pushNextAttemptAt, recipient.pushAttemptCount, new Date())) continue;
    const [claimed] = await db.update(portalNotificationRecipientsV2Table)
      .set({ pushStatus: "sending", pushClaimedAt: new Date(), pushNextAttemptAt: null, pushAttemptCount: recipient.pushAttemptCount + 1 })
      .where(and(
        eq(portalNotificationRecipientsV2Table.id, recipient.id),
        eq(portalNotificationRecipientsV2Table.pushStatus, recipient.pushStatus),
        recipient.pushStatus === "sending" ? lte(portalNotificationRecipientsV2Table.pushClaimedAt, staleAt) : undefined,
      )).returning();
    if (!claimed) continue;
    if (!await isApprovedDealerAccount(claimed.accountId)) {
      await db.update(portalNotificationRecipientsV2Table).set({ pushStatus: "skipped_ineligible", pushClaimedAt: null, pushAttemptedAt: new Date() })
        .where(eq(portalNotificationRecipientsV2Table.id, claimed.id));
      continue;
    }
    const subscriptions = (await db.select().from(portalPushSubscriptionsTable)
      .where(eq(portalPushSubscriptionsTable.accountId, claimed.accountId)))
      .filter((subscription) => isAllowedPushEndpoint(subscription.endpoint))
      .slice(0, Math.max(0, remainingDispatchQuota));
    remainingDispatchQuota -= subscriptions.length;
    if (!subscriptions.length) {
      await db.update(portalNotificationRecipientsV2Table).set({ pushStatus: "skipped_no_subscription", pushClaimedAt: null, pushAttemptedAt: new Date() })
        .where(eq(portalNotificationRecipientsV2Table.id, claimed.id));
      continue;
    }
    const results = await mapWithConcurrency(subscriptions, PUSH_MAX_CONCURRENCY, async (subscription) => {
      try {
        await webPush.sendNotification({ endpoint: subscription.endpoint, expirationTime: subscription.expirationTime, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify({ title: notification.title, body: notification.body, url: "/portal/notifications" }), { TTL: 60 * 60, timeout: PUSH_SEND_TIMEOUT_MS });
        return true;
      } catch (error: any) {
        if (error?.statusCode === 404 || error?.statusCode === 410) await db.delete(portalPushSubscriptionsTable).where(eq(portalPushSubscriptionsTable.id, subscription.id));
        else req?.log.warn(
          { statusCode: error?.statusCode, subscriptionId: subscription.id },
          "Portal v2 push delivery failed",
        );
        return false;
      }
    });
    if (results.some(Boolean)) {
      await db.update(portalNotificationRecipientsV2Table).set({ pushStatus: "sent", pushClaimedAt: null, pushAttemptedAt: new Date(), pushError: null })
        .where(and(eq(portalNotificationRecipientsV2Table.id, claimed.id), eq(portalNotificationRecipientsV2Table.pushStatus, "sending")));
    } else {
      const attemptedAt = new Date();
      const terminal = claimed.pushAttemptCount >= 5;
      const delayMs = Math.min(60 * 60_000, 60_000 * 2 ** Math.max(0, claimed.pushAttemptCount - 1));
      await db.update(portalNotificationRecipientsV2Table).set({
        pushStatus: terminal ? "failed_terminal" : "failed",
        pushClaimedAt: null,
        pushAttemptedAt: attemptedAt,
        pushNextAttemptAt: terminal ? null : new Date(attemptedAt.getTime() + delayMs),
        pushError: "Push delivery failed for all subscriptions",
      })
        .where(eq(portalNotificationRecipientsV2Table.id, claimed.id));
    }
  }
}

router.use(requireAccount, requireActiveAccount);
router.use(async (req, _res, next) => {
  await processDuePortalNotifications().catch((error) => req.log.warn({ err: error }, "Portal v2 scheduler cycle failed"));
  next();
});

router.get("/portal-v2/bootstrap", async (req, res): Promise<void> => {
  if (!req.account) { res.status(404).json({ error: "Portal account not found." }); return; }
  const staffRole = await getStaffRole(req);
  const access = resolvePortalBootstrapAccess(
    req.account,
    staffRole,
    req.account.role === "dealer"
      ? await isApprovedDealerAccount(req.account.id)
      : false,
  );
  if (!access) { res.status(404).json({ error: "Portal account not found." }); return; }
  const [membership] = await db.select({ organization: dealerOrganizationsTable })
    .from(organizationMembershipsTable).innerJoin(dealerOrganizationsTable, eq(organizationMembershipsTable.organizationId, dealerOrganizationsTable.id))
    .where(and(eq(organizationMembershipsTable.accountId, req.account.id), eq(organizationMembershipsTable.status, "approved"), eq(dealerOrganizationsTable.status, "approved"))).limit(1);
  res.json({ account: await userDto(req.account), role: access.role, authorized: access.authorized, organization: membership?.organization ?? null, groups: await groupsForAccount(req.account.id), capabilities: portalCapabilities[access.role], push: { configured: pushConfigured, message: pushConfiguration.error } });
});
router.post("/portal-v2/bootstrap", async (req, res): Promise<void> => {
  const body = z.object({ displayName: z.string().trim().min(1).max(200).optional() }).safeParse(req.body);
  if (!body.success || !req.account) { res.status(400).json({ error: "Invalid bootstrap request." }); return; }
  if (body.data.displayName) await db.update(accountsTable).set({ displayName: body.data.displayName, updatedAt: new Date() }).where(eq(accountsTable.id, req.account.id));
  await audit(req, "portal_v2.bootstrap", "account", req.account.id);
  const staffRole = await getStaffRole(req);
  const access = resolvePortalBootstrapAccess(
    req.account,
    staffRole,
    req.account.role === "dealer"
      ? await isApprovedDealerAccount(req.account.id)
      : false,
  );
  if (!access) { res.status(404).json({ error: "Portal account not found." }); return; }
  res.json({ account: await userDto({ ...req.account, displayName: body.data.displayName ?? req.account.displayName }), role: access.role, authorized: access.authorized, groups: await groupsForAccount(req.account.id), capabilities: portalCapabilities[access.role], push: { configured: pushConfigured, message: pushConfiguration.error } });
});

router.get("/portal-v2/admin/overview", requireCapability("admin:overview"), async (_req, res): Promise<void> => {
  const [dealers, approved, staff, groups, content, notifications, acknowledgements, recentAudit] = await Promise.all([
    db.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.role, "dealer")),
    db.select({ id: accountsTable.id }).from(accountsTable).where(and(eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved"))),
    db.select({ id: portalStaffProfilesTable.accountId }).from(portalStaffProfilesTable),
    db.select({ id: portalGroupsTable.id }).from(portalGroupsTable),
    db.select({ id: portalContentTable.id }).from(portalContentTable),
    db.select({ id: portalNotificationsV2Table.id }).from(portalNotificationsV2Table),
    db.select({ id: portalNotificationRecipientsV2Table.id }).from(portalNotificationRecipientsV2Table).where(isNull(portalNotificationRecipientsV2Table.acknowledgedAt)),
    db.select().from(auditEventsTable).orderBy(desc(auditEventsTable.createdAt)).limit(25),
  ]);
  res.json({ counts: { dealers: dealers.length, approvedDealers: approved.length, staff: staff.length, groups: groups.length, content: content.length, notifications: notifications.length, unreadAcknowledgements: acknowledgements.length }, recentAudit });
});

router.get("/portal-v2/admin/users", requireCapability("users:read"), async (req, res): Promise<void> => {
  const query = z.object({ role: z.enum(["dealer", "staff"]).optional(), status: accountStatus.optional() }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid user filter." }); return; }
  const role = staffRole(req);
  const rows = await db.select().from(accountsTable).where(query.data.status ? eq(accountsTable.status, query.data.status) : undefined);
  const users = await Promise.all(rows.filter((account) => {
    if (role !== "super_admin") return account.role === "dealer";
    return query.data.role === "staff" ? account.role === "staff" : query.data.role === "dealer" ? account.role === "dealer" : true;
  }).map(userDto));
  res.json({ users });
});

router.post("/portal-v2/admin/users", requireCapability("users:write"), async (req, res): Promise<void> => {
  const body = z.object({ email: z.string().email().max(320).transform((value) => value.toLowerCase()), displayName: z.string().trim().min(1).max(200).optional(), role: z.union([z.literal("dealer"), staffRoles]), status: accountStatus.optional(), organizationId: uuid.optional(), organizationName: z.string().trim().min(1).max(200).optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid user." }); return; }
  const actorRole = staffRole(req);
  if (actorRole !== "super_admin" && body.data.role !== "dealer") { res.status(403).json({ error: "Only super admins may provision staff." }); return; }
  const [existing] = await db.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.email, body.data.email)).limit(1);
  if (existing) { res.status(409).json({ error: "An account with that email already exists." }); return; }
  if (body.data.organizationId && body.data.role !== "dealer") { res.status(400).json({ error: "Only dealer accounts can join an organization." }); return; }
  if (body.data.organizationId) {
    const [organization] = await db.select({ id: dealerOrganizationsTable.id }).from(dealerOrganizationsTable)
      .where(and(eq(dealerOrganizationsTable.id, body.data.organizationId), eq(dealerOrganizationsTable.status, "approved"))).limit(1);
    if (!organization) { res.status(404).json({ error: "Approved dealer organization not found." }); return; }
  }
  let invitation: Awaited<ReturnType<typeof clerk.invitations.createInvitation>>;
  try {
    invitation = await createPortalInvitation(
      req,
      body.data.email,
      body.data.role === "dealer" ? "dealer" : "staff",
    );
  } catch (error) {
    req.log.error({ err: error }, "Clerk invitation could not be created");
    if ((error as { status?: number }).status === 403) {
      res.status(403).json({ error: "Request origin could not be verified." });
      return;
    }
    res.status(502).json({ error: "Account invitation could not be created. No account was provisioned." });
    return;
  }
  let account: typeof accountsTable.$inferSelect;
  try {
    [account] = await db.transaction(async (tx) => {
      const plan = body.data.role === "dealer" ? dealerProvisioningPlan(body.data.status, body.data.organizationId) : null;
      const initialStatus = plan?.status ?? (body.data.status ?? "approved");
      const [created] = await tx.insert(accountsTable).values({
        clerkUserId: body.data.role === "dealer" ? `invited:${body.data.email}` : `staff:${body.data.email}`,
        email: body.data.email, displayName: body.data.displayName ?? null,
        role: body.data.role === "dealer" ? "dealer" : "staff",
        status: initialStatus,
        emailVerified: false,
      }).returning();
      if (body.data.role !== "dealer") await tx.insert(portalStaffProfilesTable).values({ accountId: created.id, role: body.data.role, assignedByAccountId: req.account!.id });
      if (body.data.role === "dealer") {
        const organizationId = body.data.organizationId ?? (await tx.insert(dealerOrganizationsTable).values({
          name: body.data.organizationName ?? body.data.displayName ?? `${body.data.email} Dealer Account`,
          slug: `dealer-${created.id}`,
          status: plan!.status,
          createdByAccountId: created.id,
          approvedByAccountId: plan!.status === "approved" ? req.account!.id : null,
          approvedAt: plan!.status === "approved" ? new Date() : null,
        }).returning())[0].id;
        await tx.insert(organizationMembershipsTable).values({
          organizationId,
          accountId: created.id,
          role: plan!.membershipRole,
          status: plan!.membershipStatus,
        });
      }
      return [created];
    });
  } catch (error) {
    try {
      await clerk.invitations.revokeInvitation(invitation.id);
    } catch (revokeError) {
      req.log.error({ err: revokeError }, "Orphaned Clerk invitation could not be revoked");
    }
    throw error;
  }
  await audit(req, "portal_v2.user.provisioned", "account", account.id, { role: body.data.role });
  res.status(201).json({
    user: {
      ...await userDto(account),
      invitation: { status: "pending", url: invitation.url },
    },
  });
});

router.post("/portal-v2/admin/users/:accountId/invitation", requireCapability("users:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.accountId));
  if (!id.success) { res.status(400).json({ error: "Invalid account id." }); return; }
  const [account] = await db.select().from(accountsTable).where(eq(accountsTable.id, id.data)).limit(1);
  const isUnclaimed = account && (
    account.clerkUserId.startsWith("pending:") ||
    account.clerkUserId.startsWith("invited:") ||
    account.clerkUserId.startsWith("staff:")
  );
  if (!account || !isUnclaimed || account.status === "suspended") {
    res.status(409).json({ error: "This account is not eligible for a setup invitation." });
    return;
  }
  try {
    const invitation = await createPortalInvitation(
      req,
      account.email,
      account.role === "dealer" ? "dealer" : "staff",
      true,
    );
    await audit(req, "portal_v2.invitation.resent", "account", account.id);
    res.json({ invitation: { status: "pending", url: invitation.url } });
  } catch (error) {
    req.log.error({ err: error }, "Clerk invitation could not be resent");
    if ((error as { status?: number }).status === 403) {
      res.status(403).json({ error: "Request origin could not be verified." });
      return;
    }
    res.status(502).json({ error: "Account invitation could not be resent." });
  }
});

router.patch("/portal-v2/admin/users/:accountId", requireCapability("users:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.accountId));
  const body = z.object({ displayName: z.string().trim().min(1).max(200).nullable().optional(), status: accountStatus.optional(), role: z.union([z.literal("dealer"), staffRoles]).optional() }).safeParse(req.body);
  if (!id.success || !body.success || !Object.keys(body.data).length) { res.status(400).json({ error: "Invalid user update." }); return; }
  const [target] = await db.select().from(accountsTable).where(eq(accountsTable.id, id.data)).limit(1);
  if (!target) { res.status(404).json({ error: "User not found." }); return; }
  if (target.id === req.account!.id && (body.data.role || body.data.status)) { res.status(400).json({ error: "You cannot change your own role or status." }); return; }
  if (staffRole(req) !== "super_admin" && (target.role !== "dealer" || body.data.role)) { res.status(403).json({ error: "Staff admins may only edit dealer accounts." }); return; }
  if (body.data.role === "dealer") {
    res.status(400).json({ error: "Staff roles may only change between staff roles." });
    return;
  }
  const [targetProfile] = target.role === "staff"
    ? await db.select().from(portalStaffProfilesTable).where(eq(portalStaffProfilesTable.accountId, target.id)).limit(1)
    : [undefined];
  if ((body.data.status === "suspended" || body.data.role) && targetProfile?.role === "super_admin") {
    const activeSuperAdmins = await db.select({ accountId: portalStaffProfilesTable.accountId }).from(portalStaffProfilesTable)
      .innerJoin(accountsTable, eq(accountsTable.id, portalStaffProfilesTable.accountId))
      .where(and(eq(portalStaffProfilesTable.role, "super_admin"), eq(accountsTable.status, "approved")));
    if (activeSuperAdmins.length <= 1 && activeSuperAdmins.some((row) => row.accountId === target.id)) {
      res.status(400).json({ error: "The final active super admin cannot be changed or suspended." });
      return;
    }
  }
  if (body.data.role) {
    if (target.role !== "staff") { res.status(400).json({ error: "Create a staff account rather than elevating a dealer." }); return; }
    await db.update(portalStaffProfilesTable).set({ role: body.data.role, assignedByAccountId: req.account!.id, updatedAt: new Date() }).where(eq(portalStaffProfilesTable.accountId, target.id));
  }
  const updateResult = await db.transaction(async (tx) => {
    if (target.role === "dealer" && target.status === "pending" && body.data.status === "approved") {
      const [membership] = await tx.select({ membership: organizationMembershipsTable, organization: dealerOrganizationsTable })
        .from(organizationMembershipsTable)
        .innerJoin(dealerOrganizationsTable, eq(dealerOrganizationsTable.id, organizationMembershipsTable.organizationId))
        .where(eq(organizationMembershipsTable.accountId, target.id)).limit(1);
      if (!membership || membership.organization.status === "suspended") return { updated: null, error: "Dealer organization cannot be approved." };
      if (membership.organization.status === "pending") {
        if (membership.organization.createdByAccountId !== target.id) return { updated: null, error: "Dealer organization is still pending approval." };
        const [organization] = await tx.update(dealerOrganizationsTable).set({ status: "approved", approvedByAccountId: req.account!.id, approvedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(dealerOrganizationsTable.id, membership.organization.id), eq(dealerOrganizationsTable.status, "pending"))).returning();
        if (!organization) return { updated: null, error: "Dealer organization approval changed concurrently." };
      }
      await tx.update(organizationMembershipsTable).set({ status: "approved", updatedAt: new Date() })
        .where(eq(organizationMembershipsTable.id, membership.membership.id));
    }
    const [updated] = await tx.update(accountsTable).set({ displayName: body.data.displayName, status: body.data.status, updatedAt: new Date() }).where(eq(accountsTable.id, target.id)).returning();
    return { updated, error: null };
  });
  if (!updateResult.updated) { res.status(409).json({ error: updateResult.error ?? "User update failed." }); return; }
  const updated = updateResult.updated;
  await audit(req, "portal_v2.user.updated", "account", target.id, { changed: Object.keys(body.data) });
  res.json({ user: await userDto(updated) });
});

router.delete("/portal-v2/admin/users/:accountId", requireCapability("users:write"), async (req, res): Promise<void> => {
  if (staffRole(req) !== "super_admin") { res.status(403).json({ error: "Only super admins may suspend staff." }); return; }
  const id = uuid.safeParse(rawParam(req.params.accountId));
  if (!id.success) { res.status(400).json({ error: "Invalid account id." }); return; }
  if (id.data === req.account!.id) { res.status(400).json({ error: "You cannot suspend yourself." }); return; }
  const [target] = await db.select().from(accountsTable).where(and(eq(accountsTable.id, id.data), eq(accountsTable.role, "staff"))).limit(1);
  if (!target) { res.status(404).json({ error: "Staff account not found." }); return; }
  const activeSuperAdmins = await db.select({ accountId: portalStaffProfilesTable.accountId }).from(portalStaffProfilesTable)
    .innerJoin(accountsTable, eq(accountsTable.id, portalStaffProfilesTable.accountId))
    .where(and(eq(portalStaffProfilesTable.role, "super_admin"), eq(accountsTable.status, "approved")));
  if (activeSuperAdmins.length <= 1 && activeSuperAdmins.some((row) => row.accountId === target.id)) { res.status(400).json({ error: "The final active super admin cannot be suspended." }); return; }
  await db.update(accountsTable).set({ status: "suspended", updatedAt: new Date() }).where(eq(accountsTable.id, target.id));
  await audit(req, "portal_v2.staff.suspended", "account", target.id);
  res.status(204).end();
});

router.put("/portal-v2/admin/users/:accountId/rep", requireCapability("reps:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.accountId));
  const body = z.object({ salesRepAccountId: uuid.nullable() }).safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Invalid rep assignment." }); return; }
  const [dealer] = await db.select().from(accountsTable).where(and(eq(accountsTable.id, id.data), eq(accountsTable.role, "dealer"), eq(accountsTable.status, "approved"))).limit(1);
  if (!dealer) { res.status(404).json({ error: "Approved dealer not found." }); return; }
  if (body.data.salesRepAccountId) {
    const [rep] = await db.select().from(portalStaffProfilesTable).where(and(eq(portalStaffProfilesTable.accountId, body.data.salesRepAccountId), eq(portalStaffProfilesTable.role, "sales_rep"))).limit(1);
    if (!rep?.authorizedAt) { res.status(400).json({ error: "Sales representative is not active." }); return; }
  }
  await db.insert(portalDealerProfilesTable).values({ accountId: dealer.id, assignedSalesRepAccountId: body.data.salesRepAccountId, updatedByAccountId: req.account!.id, updatedAt: new Date() })
    .onConflictDoUpdate({ target: portalDealerProfilesTable.accountId, set: { assignedSalesRepAccountId: body.data.salesRepAccountId, updatedByAccountId: req.account!.id, updatedAt: new Date() } });
  await audit(req, "portal_v2.rep.assigned", "account", dealer.id, { salesRepAccountId: body.data.salesRepAccountId });
  res.json({ accountId: dealer.id, salesRepAccountId: body.data.salesRepAccountId });
});

router.get("/portal-v2/admin/groups", requireCapability("groups:read"), async (_req, res): Promise<void> => {
  res.json({ groups: await Promise.all((await db.select().from(portalGroupsTable)).map(groupDto)) });
});
router.post("/portal-v2/admin/groups", requireCapability("groups:write"), async (req, res): Promise<void> => {
  const body = z.object({ name: z.string().trim().min(1).max(160), description: z.string().max(500).nullable().optional() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid group." }); return; }
  const [group] = await db.insert(portalGroupsTable).values({ ...body.data, description: body.data.description ?? null }).onConflictDoNothing().returning();
  if (!group) { res.status(409).json({ error: "Group already exists." }); return; }
  await audit(req, "portal_v2.group.created", "group", group.id);
  res.status(201).json({ group: await groupDto(group) });
});
router.patch("/portal-v2/admin/groups/:groupId", requireCapability("groups:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.groupId));
  const body = z.object({ name: z.string().trim().min(1).max(160).optional(), description: z.string().max(500).nullable().optional() }).safeParse(req.body);
  if (!id.success || !body.success || !Object.keys(body.data).length) { res.status(400).json({ error: "Invalid group update." }); return; }
  const [group] = await db.update(portalGroupsTable).set({ ...body.data, updatedAt: new Date() }).where(eq(portalGroupsTable.id, id.data)).returning();
  if (!group) { res.status(404).json({ error: "Group not found." }); return; }
  await audit(req, "portal_v2.group.updated", "group", group.id, { changed: Object.keys(body.data) });
  res.json({ group: await groupDto(group) });
});
router.delete("/portal-v2/admin/groups/:groupId", requireCapability("groups:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.groupId));
  const replacement = req.query.reassignToGroupId ? uuid.safeParse(String(req.query.reassignToGroupId)) : null;
  const replacementId = replacement?.success ? replacement.data : null;
  if (!id.success || (req.query.reassignToGroupId && !replacement?.success) || replacementId === id.data) { res.status(400).json({ error: "Invalid group deletion." }); return; }
  const [group] = await db.select().from(portalGroupsTable).where(eq(portalGroupsTable.id, id.data)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found." }); return; }
  const [v2Members, legacyMembers] = await Promise.all([
    db.select({ id: portalGroupMembershipsTable.id }).from(portalGroupMembershipsTable).where(eq(portalGroupMembershipsTable.groupId, id.data)),
    db.select({ id: portalGroupAssignmentsTable.id }).from(portalGroupAssignmentsTable).where(eq(portalGroupAssignmentsTable.groupId, id.data)),
  ]);
  if ((v2Members.length || legacyMembers.length) && !replacement) { res.status(409).json({ error: "Reassign members before deleting this group." }); return; }
  if (replacementId) {
    const [exists] = await db.select({ id: portalGroupsTable.id }).from(portalGroupsTable).where(eq(portalGroupsTable.id, replacementId)).limit(1);
    if (!exists) { res.status(404).json({ error: "Replacement group not found." }); return; }
  }
  await db.transaction(async (tx) => {
    if (replacementId) {
      // Transfer with ON CONFLICT rather than updating rows in place: a dealer
      // may already belong to the replacement group, as may a target item.
      await tx.execute(sql`insert into portal_group_memberships_v2 (group_id, account_id, added_by_account_id)
        select ${replacementId}, account_id, added_by_account_id from portal_group_memberships_v2
        where group_id = ${id.data} on conflict (group_id, account_id) do nothing`);
      await tx.delete(portalGroupMembershipsTable).where(eq(portalGroupMembershipsTable.groupId, id.data));
      await tx.update(portalGroupAssignmentsTable).set({ groupId: replacementId }).where(eq(portalGroupAssignmentsTable.groupId, id.data));
      await tx.execute(sql`insert into portal_content_targets_v2 (content_id, group_id)
        select content_id, ${replacementId} from portal_content_targets_v2 where group_id = ${id.data}
        on conflict (content_id, group_id) do nothing`);
      await tx.delete(portalContentTargetsTable).where(eq(portalContentTargetsTable.groupId, id.data));
      await tx.execute(sql`insert into portal_notification_targets_v2 (notification_id, group_id, everyone)
        select notification_id, ${replacementId}, false from portal_notification_targets_v2 where group_id = ${id.data}
        on conflict (notification_id, group_id) do nothing`);
      await tx.delete(portalNotificationTargetsTable).where(eq(portalNotificationTargetsTable.groupId, id.data));
    }
    await tx.delete(portalGroupsTable).where(eq(portalGroupsTable.id, id.data));
  });
  await audit(req, "portal_v2.group.deleted", "group", id.data, { reassignToGroupId: replacementId });
  res.status(204).end();
});
router.put("/portal-v2/admin/groups/:groupId/members", requireCapability("groups:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.groupId));
  const body = z.object({ accountIds: z.array(uuid).max(1000) }).safeParse(req.body);
  if (!id.success || !body.success) { res.status(400).json({ error: "Invalid group members." }); return; }
  try { await assertDealerAccounts(body.data.accountIds); } catch (error: any) { res.status(400).json({ error: error.message }); return; }
  const [group] = await db.select().from(portalGroupsTable).where(eq(portalGroupsTable.id, id.data)).limit(1);
  if (!group) { res.status(404).json({ error: "Group not found." }); return; }
  await db.transaction(async (tx) => {
    await tx.delete(portalGroupMembershipsTable).where(eq(portalGroupMembershipsTable.groupId, id.data));
    // Once this group is edited with v2, its old single-group rows no longer
    // shadow the explicit replacement membership list.
    await tx.delete(portalGroupAssignmentsTable).where(eq(portalGroupAssignmentsTable.groupId, id.data));
    const ids = [...new Set(body.data.accountIds)];
    if (ids.length) await tx.insert(portalGroupMembershipsTable).values(ids.map((accountId) => ({ groupId: id.data, accountId, addedByAccountId: req.account!.id })));
  });
  await audit(req, "portal_v2.group.members.replaced", "group", id.data, { count: body.data.accountIds.length });
  const members = await db.select().from(portalGroupMembershipsTable).where(eq(portalGroupMembershipsTable.groupId, id.data));
  res.json({ group: await groupDto(group), members });
});
router.post("/portal-v2/admin/groups/:groupId/members", requireCapability("groups:write"), async (req, res): Promise<void> => {
  const groupId = uuid.safeParse(rawParam(req.params.groupId)); const body = z.object({ accountId: uuid }).safeParse(req.body);
  if (!groupId.success || !body.success) { res.status(400).json({ error: "Invalid group membership." }); return; }
  try { await assertDealerAccounts([body.data.accountId]); await assertGroups([groupId.data]); } catch (error: any) { res.status(400).json({ error: error.message }); return; }
  const [membership] = await db.insert(portalGroupMembershipsTable).values({ groupId: groupId.data, accountId: body.data.accountId, addedByAccountId: req.account!.id }).onConflictDoNothing().returning();
  if (!membership) { res.status(409).json({ error: "Dealer is already in this group." }); return; }
  await audit(req, "portal_v2.group.member.added", "group", groupId.data, { accountId: body.data.accountId });
  res.status(201).json({ membership });
});
router.delete("/portal-v2/admin/groups/:groupId/members/:accountId", requireCapability("groups:write"), async (req, res): Promise<void> => {
  const groupId = uuid.safeParse(rawParam(req.params.groupId)); const accountId = uuid.safeParse(rawParam(req.params.accountId));
  if (!groupId.success || !accountId.success) { res.status(400).json({ error: "Invalid group membership." }); return; }
  const [membership] = await db.delete(portalGroupMembershipsTable).where(and(eq(portalGroupMembershipsTable.groupId, groupId.data), eq(portalGroupMembershipsTable.accountId, accountId.data))).returning();
  const [legacyMembership] = await db.delete(portalGroupAssignmentsTable).where(and(eq(portalGroupAssignmentsTable.groupId, groupId.data), eq(portalGroupAssignmentsTable.accountId, accountId.data))).returning();
  if (!membership && !legacyMembership) { res.status(404).json({ error: "Membership not found." }); return; }
  await audit(req, "portal_v2.group.member.removed", "group", groupId.data, { accountId: accountId.data });
  res.status(204).end();
});

router.use("/portal-v2/admin/form-records", linkedFormsRouter);
router.get("/portal-v2/admin/content", requireCapability("content:read"), async (req, res): Promise<void> => {
  const query = z.object({ kind: contentKinds.optional(), published: z.enum(["true", "false"]).optional() }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid content filter." }); return; }
  const rows = await db.select().from(portalContentTable);
  res.json({ content: await Promise.all(rows.filter((row) => (!query.data.kind || row.kind === query.data.kind) && (query.data.published === undefined || row.published === (query.data.published === "true"))).map(contentDto)) });
});
router.post("/portal-v2/admin/content", requireCapability("content:write"), async (req, res): Promise<void> => {
  const body = contentInput.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid content." }); return; }
  const targetError = validateContentTargets(body.data); if (targetError) { res.status(400).json({ error: targetError }); return; }
  try { await assertGroups(body.data.groupIds ?? []); await assertDealerAccounts(body.data.accountIds ?? []); } catch (error: any) { res.status(400).json({ error: error.message }); return; }
  const resourceId = linkedResourceId(body.data.kind, body.data.payload);
  const content = await db.transaction(async (tx) => {
    if (resourceId) {
      const [resource] = await tx.select({ id: portalResourcesTable.id }).from(portalResourcesTable)
        .where(eq(portalResourcesTable.id, resourceId)).for("update").limit(1);
      if (!resource) return null;
    }
    const [row] = await tx.insert(portalContentTable).values({ kind: body.data.kind, title: body.data.title, description: body.data.description ?? null, payload: (body.data.payload ?? {}) as never, visibility: body.data.visibility, published: body.data.published ?? false, createdByAccountId: req.account!.id }).returning();
    const targets = [
      ...[...new Set(body.data.groupIds ?? [])].map((groupId) => ({ contentId: row.id, groupId, accountId: null })),
      ...[...new Set(body.data.accountIds ?? [])].map((accountId) => ({ contentId: row.id, groupId: null, accountId })),
    ];
    if (targets.length) await tx.insert(portalContentTargetsTable).values(targets);
    if (resourceId) await tx.update(portalResourcesTable).set({ enabled: row.published, updatedAt: new Date() }).where(eq(portalResourcesTable.id, resourceId));
    return row;
  });
  if (!content) { res.status(400).json({ error: "Linked resource not found." }); return; }
  await audit(req, "portal_v2.content.created", "content", content.id, { kind: content.kind });
  res.status(201).json({ content: await contentDto(content) });
});
router.patch("/portal-v2/admin/content/:contentId", requireCapability("content:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.contentId)); const body = contentInput.partial().safeParse(req.body);
  if (!id.success || !body.success || !Object.keys(body.data).length) { res.status(400).json({ error: "Invalid content update." }); return; }
  const [existing] = await db.select().from(portalContentTable).where(eq(portalContentTable.id, id.data)).limit(1);
  if (!existing) { res.status(404).json({ error: "Content not found." }); return; }
  const merged = { ...existing, ...body.data, groupIds: body.data.groupIds ?? (await contentDto(existing)).targets.groupIds, accountIds: body.data.accountIds ?? (await contentDto(existing)).targets.accountIds };
  const targetError = validateContentTargets(merged); if (targetError) { res.status(400).json({ error: targetError }); return; }
  try { await assertGroups(merged.groupIds); await assertDealerAccounts(merged.accountIds); } catch (error: any) { res.status(400).json({ error: error.message }); return; }
  const previousResourceId = linkedResourceId(existing.kind, existing.payload);
  const nextResourceId = linkedResourceId(merged.kind, merged.payload);
  const content = await db.transaction(async (tx) => {
    if (nextResourceId) {
      const [resource] = await tx.select({ id: portalResourcesTable.id }).from(portalResourcesTable)
        .where(eq(portalResourcesTable.id, nextResourceId)).for("update").limit(1);
      if (!resource) return null;
    }
    const [row] = await tx.update(portalContentTable).set({ kind: body.data.kind, title: body.data.title, description: body.data.description, payload: body.data.payload as never, visibility: body.data.visibility, published: body.data.published, updatedAt: new Date() }).where(eq(portalContentTable.id, id.data)).returning();
    if (!row) return null;
    if (body.data.groupIds || body.data.accountIds || body.data.visibility) {
      await tx.delete(portalContentTargetsTable).where(eq(portalContentTargetsTable.contentId, row.id));
      const targets = [
        ...[...new Set(merged.groupIds)].map((groupId) => ({ contentId: row.id, groupId, accountId: null })),
        ...[...new Set(merged.accountIds)].map((accountId) => ({ contentId: row.id, groupId: null, accountId })),
      ];
      if (targets.length) await tx.insert(portalContentTargetsTable).values(targets);
    }
    if (previousResourceId && previousResourceId !== nextResourceId)
      await tx.update(portalResourcesTable).set({ enabled: false, updatedAt: new Date() }).where(eq(portalResourcesTable.id, previousResourceId));
    if (nextResourceId)
      await tx.update(portalResourcesTable).set({ enabled: row.published, updatedAt: new Date() }).where(eq(portalResourcesTable.id, nextResourceId));
    return row;
  });
  if (!content) { res.status(400).json({ error: "Linked resource not found." }); return; }
  await audit(req, "portal_v2.content.updated", "content", content.id, { changed: Object.keys(body.data) });
  res.json({ content: await contentDto(content) });
});
router.delete("/portal-v2/admin/content/:contentId", requireCapability("content:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.contentId)); if (!id.success) { res.status(400).json({ error: "Invalid content id." }); return; }
  const [content] = await db.select().from(portalContentTable).where(eq(portalContentTable.id, id.data)).limit(1);
  if (!content) { res.status(404).json({ error: "Content not found." }); return; }
  const payload = content.payload;
  const legacyId = typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>).legacyId
    : null;
  await db.transaction(async (tx) => {
    await tx.delete(portalContentTargetsTable).where(eq(portalContentTargetsTable.contentId, content.id));
    if (typeof legacyId === "string" && shouldDisableLinkedLegacyContent(content.kind) && content.kind === "form") {
      await tx.update(portalFormsTable).set({ enabled: false, updatedAt: new Date() }).where(eq(portalFormsTable.id, legacyId));
    }
    if (typeof legacyId === "string" && shouldDisableLinkedLegacyContent(content.kind) && content.kind === "resource") {
      await tx.update(portalResourcesTable).set({ enabled: false, updatedAt: new Date() }).where(eq(portalResourcesTable.id, legacyId));
    }
    if (typeof legacyId === "string" && shouldDisableLinkedLegacyContent(content.kind) && content.kind === "price_book") {
      await tx.update(pricebooksTable).set({ approvedAt: null }).where(eq(pricebooksTable.id, legacyId));
    }
    await tx.delete(portalContentTable).where(eq(portalContentTable.id, content.id));
  });
  await audit(req, "portal_v2.content.deleted", "content", content.id); res.status(204).end();
});

router.get("/portal-v2/content", async (req, res): Promise<void> => {
  if (!await requireApprovedDealer(req, res)) return;
  const query = z.object({ kind: contentKinds.optional() }).safeParse(req.query); if (!query.success) { res.status(400).json({ error: "Invalid content filter." }); return; }
  const groupIds = (await groupsForAccount(req.account!.id)).map((group) => group.id);
  const rows = await db.select().from(portalContentTable).where(eq(portalContentTable.published, true));
  const visible = await Promise.all(rows.filter((row) => !query.data.kind || row.kind === query.data.kind).map(async (row) => {
    const pageCapability = legacyPageCapabilityForContent(row.kind);
    if (pageCapability && !await canViewLegacyPortalCapability(req.account!.id, groupIds, pageCapability)) return null;
    if (row.visibility === "everyone") return row;
    const targets = await db.select().from(portalContentTargetsTable).where(eq(portalContentTargetsTable.contentId, row.id));
    return isPortalTargetVisible(row.visibility, targets, req.account!.id, groupIds) ? row : null;
  }));
  res.json({ content: await Promise.all(visible.filter((row): row is typeof portalContentTable.$inferSelect => Boolean(row)).map(contentDto)) });
});
router.get("/portal-v2/projects", async (req, res): Promise<void> => {
  req.query.kind = "project"; // reuse the exact dealer visibility handler through a local redirect-free invocation is not possible.
  if (!await requireApprovedDealer(req, res)) return;
  const groupIds = (await groupsForAccount(req.account!.id)).map((group) => group.id);
  const rows = await db.select().from(portalContentTable).where(and(eq(portalContentTable.published, true), eq(portalContentTable.kind, "project")));
  const visible = await Promise.all(rows.map(async (row) => {
    if (row.visibility === "everyone") return row;
    const targets = await db.select().from(portalContentTargetsTable).where(eq(portalContentTargetsTable.contentId, row.id));
    return isPortalTargetVisible(row.visibility, targets, req.account!.id, groupIds) ? row : null;
  }));
  res.json({ content: await Promise.all(visible.filter((row): row is typeof portalContentTable.$inferSelect => Boolean(row)).map(contentDto)) });
});

router.get("/portal-v2/admin/notifications", requireCapability("notifications:read"), async (req, res): Promise<void> => {
  const query = z.object({ status: notificationStatuses.optional() }).safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: "Invalid notification filter." }); return; }
  const rows = await db.select().from(portalNotificationsV2Table).orderBy(desc(portalNotificationsV2Table.createdAt));
  res.json({ notifications: await Promise.all(rows.filter((row) => !query.data.status || row.status === query.data.status).map(notificationDto)) });
});
router.post("/portal-v2/admin/notifications", requireCapability("notifications:write"), async (req, res): Promise<void> => {
  const body = notificationInput.safeParse(req.body); if (!body.success) { res.status(400).json({ error: "Invalid notification." }); return; }
  if (body.data.status !== "draft" && !body.data.scheduledFor && body.data.expiresAt && body.data.expiresAt <= new Date()) {
    res.status(400).json({ error: "Expired notifications cannot be sent." });
    return;
  }
  try { await assertGroups(body.data.target.groupIds ?? []); await assertDealerAccounts(body.data.target.accountIds ?? []); } catch (error: any) { res.status(400).json({ error: error.message }); return; }
  const isDraft = body.data.status === "draft";
  const [notification] = await db.insert(portalNotificationsV2Table).values({
    title: body.data.title, body: body.data.body, imageUrl: body.data.imageUrl ?? null, linkUrl: body.data.linkUrl ?? null, priority: body.data.priority ?? "normal",
    status: isDraft ? "draft" : body.data.scheduledFor ? "scheduled" : "draft", scheduledFor: body.data.scheduledFor ?? null, expiresAt: body.data.expiresAt ?? null,
    acknowledgementRequired: body.data.acknowledgementRequired ?? false, createdByAccountId: req.account!.id,
  }).returning();
  await replaceNotificationTargets(notification.id, body.data.target);
  if (!isDraft && !body.data.scheduledFor) await deliverPortalNotification(notification, req);
  await audit(req, "portal_v2.notification.created", "notification", notification.id, { status: isDraft ? "draft" : body.data.scheduledFor ? "scheduled" : "sent" });
  const [current] = await db.select().from(portalNotificationsV2Table).where(eq(portalNotificationsV2Table.id, notification.id));
  res.status(201).json({ notification: await notificationDto(current) });
});
router.patch("/portal-v2/admin/notifications/:notificationId", requireCapability("notifications:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.notificationId));
  const body = notificationPatchInput.safeParse(req.body);
  if (!id.success || !body.success || !Object.keys(body.data).length) { res.status(400).json({ error: "Invalid notification update." }); return; }
  const [existing] = await db.select().from(portalNotificationsV2Table).where(eq(portalNotificationsV2Table.id, id.data)).limit(1);
  if (!existing) { res.status(404).json({ error: "Notification not found." }); return; }
  if (!notificationCanBeEdited(existing.status)) { res.status(409).json({ error: "Sent notifications cannot be altered." }); return; }
  if (body.data.status === "sent") { res.status(400).json({ error: "Use the send endpoint to deliver a notification." }); return; }
  const nextStatus = body.data.status ?? existing.status;
  const nextScheduledFor = body.data.scheduledFor === undefined ? existing.scheduledFor : body.data.scheduledFor;
  const nextExpiresAt = body.data.expiresAt === undefined ? existing.expiresAt : body.data.expiresAt;
  if (nextStatus === "scheduled" && !nextScheduledFor) { res.status(400).json({ error: "Scheduled notifications require scheduledFor." }); return; }
  if (nextExpiresAt && nextScheduledFor && nextExpiresAt <= nextScheduledFor) { res.status(400).json({ error: "Expiry must be after the scheduled time." }); return; }
  if (body.data.target && !body.data.target.everyone && !body.data.target.groupIds?.length && !body.data.target.accountIds?.length) { res.status(400).json({ error: "At least one notification target is required." }); return; }
  if (body.data.target) try { await assertGroups(body.data.target.groupIds ?? []); await assertDealerAccounts(body.data.target.accountIds ?? []); } catch (error: any) { res.status(400).json({ error: error.message }); return; }
  const [notification] = await db.update(portalNotificationsV2Table).set({
    title: body.data.title, body: body.data.body, imageUrl: body.data.imageUrl, linkUrl: body.data.linkUrl, priority: body.data.priority, status: body.data.status,
    scheduledFor: body.data.scheduledFor, expiresAt: body.data.expiresAt, acknowledgementRequired: body.data.acknowledgementRequired, updatedAt: new Date(),
  }).where(eq(portalNotificationsV2Table.id, id.data)).returning();
  if (body.data.target) await replaceNotificationTargets(notification.id, body.data.target);
  await audit(req, body.data.status === "cancelled" ? "portal_v2.notification.cancelled" : "portal_v2.notification.updated", "notification", notification.id, { changed: Object.keys(body.data) });
  res.json({ notification: await notificationDto(notification) });
});
router.post("/portal-v2/admin/notifications/:notificationId/send", requireCapability("notifications:write"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.notificationId)); if (!id.success) { res.status(400).json({ error: "Invalid notification id." }); return; }
  const [notification] = await db.select().from(portalNotificationsV2Table).where(eq(portalNotificationsV2Table.id, id.data)).limit(1);
  if (!notification) { res.status(404).json({ error: "Notification not found." }); return; }
  if (notification.status === "cancelled" || notification.status === "sent") { res.status(409).json({ error: "Notification cannot be sent." }); return; }
  if (notification.expiresAt && notification.expiresAt <= new Date()) { res.status(409).json({ error: "Expired notifications cannot be sent." }); return; }
  await deliverPortalNotification(notification, req);
  const [sent] = await db.select().from(portalNotificationsV2Table).where(eq(portalNotificationsV2Table.id, id.data));
  res.json({ notification: await notificationDto(sent) });
});
router.get("/portal-v2/admin/notifications/:notificationId/history", requireCapability("notifications:history"), async (req, res): Promise<void> => {
  const id = uuid.safeParse(rawParam(req.params.notificationId)); if (!id.success) { res.status(400).json({ error: "Invalid notification id." }); return; }
  res.json({ recipients: await db.select().from(portalNotificationRecipientsV2Table).where(eq(portalNotificationRecipientsV2Table.notificationId, id.data)) });
});

router.get("/portal-v2/notifications", async (req, res): Promise<void> => {
  if (!await requireApprovedDealer(req, res)) return;
  const [preferences] = await db.select().from(portalNotificationPreferencesTable)
    .where(eq(portalNotificationPreferencesTable.accountId, req.account!.id)).limit(1);
  const rows = await db.select({ notification: portalNotificationsV2Table, recipient: portalNotificationRecipientsV2Table }).from(portalNotificationRecipientsV2Table)
    .innerJoin(portalNotificationsV2Table, eq(portalNotificationRecipientsV2Table.notificationId, portalNotificationsV2Table.id))
    .where(and(eq(portalNotificationRecipientsV2Table.accountId, req.account!.id), eq(portalNotificationsV2Table.status, "sent"))).orderBy(desc(portalNotificationsV2Table.sentAt));
  res.json({
    notifications: rows.filter(({ notification }) =>
      shouldListDealerNotification(
        isDealerNotificationVisible(notification.status, notification.expiresAt, new Date()),
        preferences?.inAppEnabled !== false,
        notification.acknowledgementRequired,
      ),
    ),
  });
});
async function recipientAction(req: Request, res: Response, field: "readAt" | "acknowledgedAt") {
  if (!await requireApprovedDealer(req, res)) return;
  const id = uuid.safeParse(rawParam(req.params.notificationId)); if (!id.success) { res.status(400).json({ error: "Invalid notification id." }); return; }
  const [notification] = await db.select().from(portalNotificationsV2Table).where(eq(portalNotificationsV2Table.id, id.data)).limit(1);
  if (!notification || !isDealerNotificationVisible(notification.status, notification.expiresAt, new Date()) || (field === "acknowledgedAt" && !notification.acknowledgementRequired)) { res.status(404).json({ error: "Notification not found." }); return; }
  const [recipient] = await db.update(portalNotificationRecipientsV2Table).set({ [field]: new Date() }).where(and(eq(portalNotificationRecipientsV2Table.notificationId, id.data), eq(portalNotificationRecipientsV2Table.accountId, req.account!.id))).returning();
  if (!recipient) { res.status(404).json({ error: "Notification not found." }); return; }
  await audit(req, field === "readAt" ? "portal_v2.notification.read" : "portal_v2.notification.acknowledged", "notification", id.data);
  res.json({ recipient });
}
router.post("/portal-v2/notifications/:notificationId/read", async (req, res): Promise<void> => { await recipientAction(req, res, "readAt"); });
router.post("/portal-v2/notifications/:notificationId/acknowledge", async (req, res): Promise<void> => { await recipientAction(req, res, "acknowledgedAt"); });
router.get("/portal-v2/notification-preferences", async (req, res): Promise<void> => {
  if (!await requireApprovedDealer(req, res)) return;
  const [preferences] = await db.select().from(portalNotificationPreferencesTable).where(eq(portalNotificationPreferencesTable.accountId, req.account!.id)).limit(1);
  res.json({ preferences: preferences ?? { accountId: req.account!.id, inAppEnabled: true, pushEnabled: true, priorityThreshold: "low" } });
});
router.put("/portal-v2/notification-preferences", async (req, res): Promise<void> => {
  if (!await requireApprovedDealer(req, res)) return;
  const body = z.object({ inAppEnabled: z.boolean().optional(), pushEnabled: z.boolean().optional(), priorityThreshold: priority.optional() }).safeParse(req.body);
  if (!body.success || !Object.keys(body.data).length) { res.status(400).json({ error: "Invalid notification preferences." }); return; }
  const [preferences] = await db.insert(portalNotificationPreferencesTable).values({ accountId: req.account!.id, ...body.data }).onConflictDoUpdate({ target: portalNotificationPreferencesTable.accountId, set: { ...body.data, updatedAt: new Date() } }).returning();
  await audit(req, "portal_v2.notification.preferences.updated", "account", req.account!.id);
  res.json({ preferences });
});

export function startPortalV2Scheduler() {
  const run = () => {
    void processDuePortalNotifications().catch((error) => logger.warn({ err: error }, "Portal v2 scheduler cycle failed"));
  };
  const interval = setInterval(run, 60_000);
  interval.unref();
  run();
}

export default router;