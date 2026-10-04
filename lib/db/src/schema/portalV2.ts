import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { accountsTable } from "./accounts";
import { portalGroupsTable } from "./portal";
import type { JsonValue } from "./catalog";

export const portalStaffRoleEnum = pgEnum("portal_staff_role", [
  "super_admin",
  "staff_admin",
  "sales_rep",
  "content_manager",
]);
export const portalContentKindEnum = pgEnum("portal_content_kind", [
  "project",
  "price_book",
  "resource_category",
  "product_series",
  "finish",
  "training",
  "launch_kit",
  "resource",
  "form",
  "announcement",
]);
export const portalVisibilityEnum = pgEnum("portal_visibility", [
  "everyone",
  "groups",
  "individuals",
]);
export const portalNotificationStatusEnum = pgEnum("portal_notification_status", [
  "draft",
  "scheduled",
  "sent",
  "cancelled",
]);
export const portalNotificationPriorityEnum = pgEnum("portal_notification_priority", [
  "low",
  "normal",
  "high",
]);

/** Staff privileges are separate from the long-lived account role enum. */
export const portalStaffProfilesTable = pgTable(
  "portal_staff_profiles",
  {
    accountId: uuid("account_id").primaryKey().references(() => accountsTable.id),
    role: portalStaffRoleEnum("role").notNull(),
    // A provisioned staff row cannot gain any privilege until its owner claims it.
    authorizedAt: timestamp("authorized_at", { withTimezone: true }),
    authorizedClerkUserId: text("authorized_clerk_user_id"),
    assignedByAccountId: uuid("assigned_by_account_id").references(() => accountsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("portal_staff_profiles_role_idx").on(table.role)],
);

/** This is additive so legacy single-group assignments remain untouched. */
export const portalGroupMembershipsTable = pgTable(
  "portal_group_memberships_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id").notNull().references(() => portalGroupsTable.id),
    accountId: uuid("account_id").notNull().references(() => accountsTable.id),
    addedByAccountId: uuid("added_by_account_id").references(() => accountsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("portal_group_memberships_v2_unique").on(table.groupId, table.accountId),
    index("portal_group_memberships_v2_account_idx").on(table.accountId),
  ],
);

export const portalDealerProfilesTable = pgTable(
  "portal_dealer_profiles",
  {
    accountId: uuid("account_id").primaryKey().references(() => accountsTable.id),
    assignedSalesRepAccountId: uuid("assigned_sales_rep_account_id").references(() => accountsTable.id),
    updatedByAccountId: uuid("updated_by_account_id").references(() => accountsTable.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("portal_dealer_profiles_rep_idx").on(table.assignedSalesRepAccountId)],
);

export const portalContentTable = pgTable(
  "portal_content_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: portalContentKindEnum("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    payload: jsonb("payload").$type<JsonValue>().notNull().default({}),
    visibility: portalVisibilityEnum("visibility").notNull().default("everyone"),
    published: boolean("published").notNull().default(false),
    createdByAccountId: uuid("created_by_account_id").notNull().references(() => accountsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portal_content_v2_kind_published_idx").on(table.kind, table.published),
    index("portal_content_v2_created_idx").on(table.createdAt),
  ],
);

export const portalContentTargetsTable = pgTable(
  "portal_content_targets_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id").notNull().references(() => portalContentTable.id),
    groupId: uuid("group_id").references(() => portalGroupsTable.id),
    accountId: uuid("account_id").references(() => accountsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("portal_content_targets_v2_group_unique").on(table.contentId, table.groupId),
    uniqueIndex("portal_content_targets_v2_account_unique").on(table.contentId, table.accountId),
    index("portal_content_targets_v2_content_idx").on(table.contentId),
  ],
);

export const portalNotificationsV2Table = pgTable(
  "portal_notifications_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    linkUrl: text("link_url"),
    priority: portalNotificationPriorityEnum("priority").notNull().default("normal"),
    status: portalNotificationStatusEnum("status").notNull().default("draft"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    acknowledgementRequired: boolean("acknowledgement_required").notNull().default(false),
    createdByAccountId: uuid("created_by_account_id").notNull().references(() => accountsTable.id),
    schedulerClaimedAt: timestamp("scheduler_claimed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portal_notifications_v2_schedule_idx").on(table.status, table.scheduledFor),
    index("portal_notifications_v2_sent_idx").on(table.sentAt),
  ],
);

export const portalNotificationTargetsTable = pgTable(
  "portal_notification_targets_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id").notNull().references(() => portalNotificationsV2Table.id),
    groupId: uuid("group_id").references(() => portalGroupsTable.id),
    accountId: uuid("account_id").references(() => accountsTable.id),
    everyone: boolean("everyone").notNull().default(false),
  },
  (table) => [
    uniqueIndex("portal_notification_targets_v2_group_unique").on(table.notificationId, table.groupId),
    uniqueIndex("portal_notification_targets_v2_account_unique").on(table.notificationId, table.accountId),
    index("portal_notification_targets_v2_notification_idx").on(table.notificationId),
  ],
);

export const portalNotificationRecipientsV2Table = pgTable(
  "portal_notification_recipients_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id").notNull().references(() => portalNotificationsV2Table.id),
    accountId: uuid("account_id").notNull().references(() => accountsTable.id),
    readAt: timestamp("read_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
    pushStatus: text("push_status").notNull().default("not_attempted"),
    pushAttemptedAt: timestamp("push_attempted_at", { withTimezone: true }),
    pushClaimedAt: timestamp("push_claimed_at", { withTimezone: true }),
    pushAttemptCount: integer("push_attempt_count").notNull().default(0),
    pushNextAttemptAt: timestamp("push_next_attempt_at", { withTimezone: true }),
    pushError: text("push_error"),
  },
  (table) => [
    uniqueIndex("portal_notification_recipients_v2_unique").on(table.notificationId, table.accountId),
    index("portal_notification_recipients_v2_account_idx").on(table.accountId, table.deliveredAt),
  ],
);

export const portalNotificationPreferencesTable = pgTable(
  "portal_notification_preferences_v2",
  {
    accountId: uuid("account_id").primaryKey().references(() => accountsTable.id),
    inAppEnabled: boolean("in_app_enabled").notNull().default(true),
    pushEnabled: boolean("push_enabled").notNull().default(true),
    priorityThreshold: portalNotificationPriorityEnum("priority_threshold").notNull().default("low"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const insertPortalStaffProfileSchema = createInsertSchema(portalStaffProfilesTable);
export const insertPortalGroupMembershipSchema = createInsertSchema(portalGroupMembershipsTable);
export const insertPortalDealerProfileSchema = createInsertSchema(portalDealerProfilesTable);
export const insertPortalContentSchema = createInsertSchema(portalContentTable);
export const insertPortalContentTargetSchema = createInsertSchema(portalContentTargetsTable);
export const insertPortalNotificationV2Schema = createInsertSchema(portalNotificationsV2Table);
export const insertPortalNotificationTargetSchema = createInsertSchema(portalNotificationTargetsTable);
export const insertPortalNotificationRecipientV2Schema = createInsertSchema(portalNotificationRecipientsV2Table);
export const insertPortalNotificationPreferenceSchema = createInsertSchema(portalNotificationPreferencesTable);

export type PortalStaffProfile = typeof portalStaffProfilesTable.$inferSelect;
export type PortalGroupMembership = typeof portalGroupMembershipsTable.$inferSelect;
export type PortalDealerProfile = typeof portalDealerProfilesTable.$inferSelect;
export type PortalContent = typeof portalContentTable.$inferSelect;
export type PortalNotificationV2 = typeof portalNotificationsV2Table.$inferSelect;