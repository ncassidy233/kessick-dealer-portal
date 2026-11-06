import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  primaryKey,
} from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";
import type { JsonValue } from "./catalog";

export const studioPageKeyEnum = pgEnum("studio_page_key", [
  "home",
  "projects",
  "collections",
  "training",
  "resources",
]);

export const portalPageDraftsTable = pgTable("portal_page_drafts", {
  pageKey: studioPageKeyEnum("page_key").primaryKey(),
  document: jsonb("document").$type<JsonValue>().notNull(),
  revision: integer("revision").notNull(),
  updatedByAccountId: uuid("updated_by_account_id")
    .notNull()
    .references(() => accountsTable.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Dealer reads must never select from the draft table or fall back to a draft.
export const portalPagePublicationsTable = pgTable("portal_page_publications", {
  pageKey: studioPageKeyEnum("page_key").primaryKey(),
  document: jsonb("document").$type<JsonValue>().notNull(),
  revision: integer("revision").notNull(),
  publishedByAccountId: uuid("published_by_account_id")
    .notNull()
    .references(() => accountsTable.id),
  publishedAt: timestamp("published_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Append-only publication snapshots. Restoring creates a new publication.
export const portalPageHistoryTable = pgTable(
  "portal_page_history",
  {
    pageKey: studioPageKeyEnum("page_key").notNull(),
    revision: integer("revision").notNull(),
    document: jsonb("document").$type<JsonValue>().notNull(),
    publishedByAccountId: uuid("published_by_account_id")
      .notNull()
      .references(() => accountsTable.id),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.pageKey, table.revision] })],
);
