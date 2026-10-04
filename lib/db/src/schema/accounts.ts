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
import { z } from "zod/v4";
import type { JsonValue } from "./catalog";

export const accountRoleEnum = pgEnum("account_role", [
  "customer",
  "dealer",
  "staff",
]);
export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "suspended",
]);
export const membershipRoleEnum = pgEnum("membership_role", ["owner", "member"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const accountsTable = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: text("clerk_user_id").notNull(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: accountRoleEnum("role").notNull().default("customer"),
    status: approvalStatusEnum("status").notNull().default("approved"),
    emailVerified: boolean("email_verified").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("accounts_clerk_user_id_unique").on(table.clerkUserId),
    uniqueIndex("accounts_email_unique").on(table.email),
  ],
);

export const dealerOrganizationsTable = pgTable(
  "dealer_organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: approvalStatusEnum("status").notNull().default("pending"),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountsTable.id),
    approvedByAccountId: uuid("approved_by_account_id").references(
      () => accountsTable.id,
    ),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("dealer_organizations_slug_unique").on(table.slug)],
);

export const organizationMembershipsTable = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => dealerOrganizationsTable.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id),
    role: membershipRoleEnum("role").notNull().default("member"),
    status: approvalStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_memberships_org_account_unique").on(
      table.organizationId,
      table.accountId,
    ),
    uniqueIndex("organization_memberships_account_unique").on(table.accountId),
    index("organization_memberships_account_idx").on(table.accountId),
  ],
);

export const projectsTable = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => dealerOrganizationsTable.id),
    name: text("name").notNull(),
    snapshot: jsonb("snapshot").$type<JsonValue>().notNull(),
    version: integer("version").notNull().default(1),
    importSourceId: text("import_source_id"),
    createdByAccountId: uuid("created_by_account_id")
      .notNull()
      .references(() => accountsTable.id),
    updatedByAccountId: uuid("updated_by_account_id")
      .notNull()
      .references(() => accountsTable.id),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("projects_organization_idx").on(table.organizationId),
    index("projects_updated_at_idx").on(table.updatedAt),
    uniqueIndex("projects_organization_import_source_unique").on(
      table.organizationId,
      table.importSourceId,
    ),
  ],
);

export const projectInvitationsTable = pgTable(
  "project_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: invitationStatusEnum("status").notNull().default("pending"),
    invitedByAccountId: uuid("invited_by_account_id")
      .notNull()
      .references(() => accountsTable.id),
    acceptedByAccountId: uuid("accepted_by_account_id").references(
      () => accountsTable.id,
    ),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_invitations_token_hash_unique").on(table.tokenHash),
    index("project_invitations_project_idx").on(table.projectId),
    index("project_invitations_email_idx").on(table.email),
  ],
);

export const projectImagesTable = pgTable(
  "project_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id),
    objectPath: text("object_path").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedByAccountId: uuid("uploaded_by_account_id")
      .notNull()
      .references(() => accountsTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_images_object_path_unique").on(table.objectPath),
    index("project_images_project_idx").on(table.projectId),
  ],
);

export const projectImageUploadIntentsTable = pgTable(
  "project_image_upload_intents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id),
    requestedByAccountId: uuid("requested_by_account_id")
      .notNull()
      .references(() => accountsTable.id),
    tempObjectPath: text("temp_object_path").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_image_upload_intents_path_unique").on(
      table.tempObjectPath,
    ),
    index("project_image_upload_intents_project_idx").on(table.projectId),
  ],
);

export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorAccountId: uuid("actor_account_id").references(() => accountsTable.id),
    organizationId: uuid("organization_id").references(
      () => dealerOrganizationsTable.id,
    ),
    projectId: uuid("project_id").references(() => projectsTable.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<JsonValue>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_org_created_idx").on(
      table.organizationId,
      table.createdAt,
    ),
    index("audit_events_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const insertAccountSchema = createInsertSchema(accountsTable);
export const insertOrganizationSchema = createInsertSchema(
  dealerOrganizationsTable,
);
export const insertMembershipSchema = createInsertSchema(
  organizationMembershipsTable,
);
export const insertProjectSchema = createInsertSchema(projectsTable);
export const insertInvitationSchema = createInsertSchema(
  projectInvitationsTable,
);
export const insertProjectImageSchema = createInsertSchema(projectImagesTable);
export const insertProjectImageUploadIntentSchema = createInsertSchema(
  projectImageUploadIntentsTable,
);
export const insertAuditEventSchema = createInsertSchema(auditEventsTable);

export type Account = typeof accountsTable.$inferSelect;
export type DealerOrganization = typeof dealerOrganizationsTable.$inferSelect;
export type OrganizationMembership =
  typeof organizationMembershipsTable.$inferSelect;
export type Project = typeof projectsTable.$inferSelect;
export type ProjectInvitation = typeof projectInvitationsTable.$inferSelect;
export type ProjectImage = typeof projectImagesTable.$inferSelect;
export type ProjectImageUploadIntent =
  typeof projectImageUploadIntentsTable.$inferSelect;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;