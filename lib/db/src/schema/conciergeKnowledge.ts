import { pgTable, uuid, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { accountsTable } from "./accounts";

export const conciergeKnowledgeTable = pgTable("concierge_knowledge", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  category: text("category").notNull().default("General"),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  objectPath: text("object_path").notNull(),
  extractedText: text("extracted_text").notNull().default(""),
  audience: text("audience").notNull().default("staff"),
  status: text("status").notNull().default("review"),
  errorMessage: text("error_message"),
  createdByAccountId: uuid("created_by_account_id").notNull().references(() => accountsTable.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("concierge_knowledge_eligibility_idx").on(t.status, t.audience)]);

export const conciergeKnowledgeUploadsTable = pgTable("concierge_knowledge_uploads", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accountsTable.id),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  status: text("status").notNull().default("pending"),
  generation: text("generation"),
  documentId: uuid("document_id").references(() => conciergeKnowledgeTable.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});