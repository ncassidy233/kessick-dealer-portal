import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { accountsTable, projectsTable } from "./accounts";
import type { JsonValue } from "./catalog";

export const conciergeConnectionsTable = pgTable(
  "concierge_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    tokenHash: text("token_hash").notNull(),
    tokenPrefix: text("token_prefix").notNull(),
    scopes: jsonb("scopes").$type<JsonValue>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("concierge_connections_token_hash_unique").on(table.tokenHash),
    index("concierge_connections_account_idx").on(table.accountId),
  ],
);

export const conciergeOAuthClientsTable = pgTable(
  "concierge_oauth_clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerAccountId: uuid("owner_account_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    clientId: text("client_id").notNull(),
    clientSecretHash: text("client_secret_hash").notNull(),
    clientSecretPrefix: text("client_secret_prefix").notNull(),
    clientName: text("client_name").notNull(),
    redirectUris: jsonb("redirect_uris").$type<JsonValue>().notNull(),
    allowedScopes: jsonb("allowed_scopes").$type<JsonValue>().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("concierge_oauth_clients_client_id_unique").on(table.clientId),
    index("concierge_oauth_clients_owner_idx").on(table.ownerAccountId),
  ],
);

export const conciergeOAuthCodesTable = pgTable(
  "concierge_oauth_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => conciergeOAuthClientsTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    redirectUri: text("redirect_uri").notNull(),
    scope: text("scope").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("concierge_oauth_codes_hash_unique").on(table.codeHash),
    index("concierge_oauth_codes_account_idx").on(table.accountId),
  ],
);

export const conciergeOAuthTokensTable = pgTable(
  "concierge_oauth_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => conciergeOAuthClientsTable.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    accessTokenHash: text("access_token_hash").notNull(),
    refreshTokenHash: text("refresh_token_hash").notNull(),
    scope: text("scope").notNull(),
    accessExpiresAt: timestamp("access_expires_at", { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("concierge_oauth_tokens_access_hash_unique").on(
      table.accessTokenHash,
    ),
    uniqueIndex("concierge_oauth_tokens_refresh_hash_unique").on(
      table.refreshTokenHash,
    ),
    index("concierge_oauth_tokens_account_idx").on(table.accountId),
  ],
);

export const conciergeConversationsTable = pgTable(
  "concierge_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accountsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projectsTable.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("concierge_conversations_account_updated_idx").on(
      table.accountId,
      table.updatedAt,
    ),
  ],
);

export const conciergeMessagesTable = pgTable(
  "concierge_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderIndex: bigserial("order_index", { mode: "number" }).notNull(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conciergeConversationsTable.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    content: text("content").notNull(),
    citations: jsonb("citations").$type<JsonValue>().notNull().default([]),
    status: text("status").notNull(),
    inputCharacters: integer("input_characters").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("concierge_messages_conversation_order_idx").on(
      table.conversationId,
      table.orderIndex,
    ),
  ],
);

export const conciergeActionsTable = pgTable(
  "concierge_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conciergeConversationsTable.id, { onDelete: "cascade" }),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projectsTable.id, { onDelete: "cascade" }),
    proposedByMessageId: uuid("proposed_by_message_id").references(
      () => conciergeMessagesTable.id,
      { onDelete: "set null" },
    ),
    actionType: text("action_type").notNull(),
    payload: jsonb("payload").$type<JsonValue>().notNull(),
    expectedProjectVersion: integer("expected_project_version").notNull(),
    status: text("status").notNull().default("pending"),
    confirmedByAccountId: uuid("confirmed_by_account_id").references(
      () => accountsTable.id,
    ),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("concierge_actions_conversation_idx").on(table.conversationId),
    index("concierge_actions_project_idx").on(table.projectId),
  ],
);

export type ConciergeConnection =
  typeof conciergeConnectionsTable.$inferSelect;
export type ConciergeConversation =
  typeof conciergeConversationsTable.$inferSelect;
export type ConciergeMessage = typeof conciergeMessagesTable.$inferSelect;
export type ConciergeAction = typeof conciergeActionsTable.$inferSelect;