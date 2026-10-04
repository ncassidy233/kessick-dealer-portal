import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { accountsTable } from "./accounts";
import type { JsonValue } from "./catalog";

/** Groups are deliberately separate from dealer organizations: a group can
 * contain accounts from several dealerships and controls portal entitlements. */
export const portalNotificationTargetEnum = pgEnum("portal_notification_target", [
  "everyone",
  "group",
  "accounts",
]);
export const portalAccessSubjectEnum = pgEnum("portal_access_subject", [
  "group",
  "account",
]);

export const portalGroupsTable = pgTable(
  "portal_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("portal_groups_name_unique").on(table.name)],
);

export const portalGroupAssignmentsTable = pgTable(
  "portal_group_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accountsTable.id),
    groupId: uuid("group_id").notNull().references(() => portalGroupsTable.id),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("portal_group_assignments_account_unique").on(table.accountId),
    index("portal_group_assignments_group_idx").on(table.groupId),
  ],
);

export const portalAccessRulesTable = pgTable(
  "portal_access_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: portalAccessSubjectEnum("subject_type").notNull(),
    groupId: uuid("group_id").references(() => portalGroupsTable.id),
    accountId: uuid("account_id").references(() => accountsTable.id),
    capability: text("capability").notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portal_access_rules_group_idx").on(table.groupId),
    index("portal_access_rules_account_idx").on(table.accountId),
    uniqueIndex("portal_access_rules_group_capability_unique").on(table.groupId, table.capability),
    uniqueIndex("portal_access_rules_account_capability_unique").on(table.accountId, table.capability),
  ],
);

export const portalPriceOverridesTable = pgTable(
  "portal_price_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    groupId: uuid("group_id").references(() => portalGroupsTable.id),
    accountId: uuid("account_id").references(() => accountsTable.id),
    wholesaleAmount: numeric("wholesale_amount", { precision: 12, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portal_price_overrides_sku_idx").on(table.sku),
    uniqueIndex("portal_price_overrides_group_sku_unique").on(table.groupId, table.sku),
    uniqueIndex("portal_price_overrides_account_sku_unique").on(table.accountId, table.sku),
  ],
);

export const portalFormsTable = pgTable(
  "portal_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    fieldDefinitions: jsonb("field_definitions").$type<JsonValue>().notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdByAccountId: uuid("created_by_account_id").notNull().references(() => accountsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const portalFormSubmissionsTable = pgTable(
  "portal_form_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id").notNull().references(() => portalFormsTable.id),
    accountId: uuid("account_id").notNull().references(() => accountsTable.id),
    values: jsonb("values").$type<JsonValue>().notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("portal_form_submissions_form_idx").on(table.formId)],
);

export const portalResourcesTable = pgTable(
  "portal_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    category: text("category").notNull(),
    description: text("description"),
    url: text("url").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdByAccountId: uuid("created_by_account_id").notNull().references(() => accountsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const portalNotificationsTable = pgTable(
  "portal_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    targetType: portalNotificationTargetEnum("target_type").notNull(),
    targetGroupId: uuid("target_group_id").references(() => portalGroupsTable.id),
    sentByAccountId: uuid("sent_by_account_id").notNull().references(() => accountsTable.id),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("portal_notifications_sent_idx").on(table.sentAt)],
);

export const portalNotificationRecipientsTable = pgTable(
  "portal_notification_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id").notNull().references(() => portalNotificationsTable.id),
    accountId: uuid("account_id").notNull().references(() => accountsTable.id),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("portal_notification_recipients_unique").on(table.notificationId, table.accountId),
    index("portal_notification_recipients_account_idx").on(table.accountId),
  ],
);

export const portalPushSubscriptionsTable = pgTable(
  "portal_push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => accountsTable.id),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    expirationTime: integer("expiration_time"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("portal_push_subscriptions_endpoint_unique").on(table.endpoint),
    index("portal_push_subscriptions_account_idx").on(table.accountId),
  ],
);

export const insertPortalGroupSchema = createInsertSchema(portalGroupsTable);
export const insertPortalGroupAssignmentSchema = createInsertSchema(portalGroupAssignmentsTable);
export const insertPortalAccessRuleSchema = createInsertSchema(portalAccessRulesTable);
export const insertPortalPriceOverrideSchema = createInsertSchema(portalPriceOverridesTable);
export const insertPortalFormSchema = createInsertSchema(portalFormsTable);
export const insertPortalFormSubmissionSchema = createInsertSchema(portalFormSubmissionsTable);
export const insertPortalResourceSchema = createInsertSchema(portalResourcesTable);
export const insertPortalNotificationSchema = createInsertSchema(portalNotificationsTable);
export const insertPortalNotificationRecipientSchema = createInsertSchema(portalNotificationRecipientsTable);
export const insertPortalPushSubscriptionSchema = createInsertSchema(portalPushSubscriptionsTable);

export type PortalGroup = typeof portalGroupsTable.$inferSelect;
export type PortalGroupAssignment = typeof portalGroupAssignmentsTable.$inferSelect;
export type PortalAccessRule = typeof portalAccessRulesTable.$inferSelect;
export type PortalPriceOverride = typeof portalPriceOverridesTable.$inferSelect;
export type PortalForm = typeof portalFormsTable.$inferSelect;
export type PortalFormSubmission = typeof portalFormSubmissionsTable.$inferSelect;
export type PortalResource = typeof portalResourcesTable.$inferSelect;
export type PortalNotification = typeof portalNotificationsTable.$inferSelect;
export type PortalNotificationRecipient = typeof portalNotificationRecipientsTable.$inferSelect;
export type PortalPushSubscription = typeof portalPushSubscriptionsTable.$inferSelect;