import {
  boolean,
  check,
  date,
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
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export const releaseStatusEnum = pgEnum("catalog_release_status", [
  "draft",
  "approved",
  "retired",
]);

export const pricingStatusEnum = pgEnum("pricing_status", [
  "priced",
  "tbd",
  "unavailable",
]);

export const catalogReleasesTable = pgTable(
  "catalog_releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    status: releaseStatusEnum("status").notNull().default("draft"),
    sourceName: text("source_name").notNull(),
    sourceVersion: text("source_version"),
    provenance: jsonb("provenance").$type<JsonValue>().notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }),
    effectiveTo: date("effective_to", { mode: "string" }),
    snapshot: jsonb("snapshot").$type<JsonValue>().notNull(),
    snapshotSha256: text("snapshot_sha256").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("catalog_releases_version_unique").on(table.version),
    uniqueIndex("catalog_releases_snapshot_sha256_unique").on(
      table.snapshotSha256,
    ),
    check(
      "catalog_releases_effective_range_valid",
      sql`${table.effectiveTo} is null or ${table.effectiveFrom} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  ],
);

export const catalogProductsTable = pgTable(
  "catalog_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogReleaseId: uuid("catalog_release_id")
      .notNull()
      .references(() => catalogReleasesTable.id),
    productId: text("product_id").notNull(),
    sku: text("sku").notNull(),
    isPublic: boolean("is_public").notNull().default(true),
    metadata: jsonb("metadata").$type<JsonValue>().notNull(),
    sourceRecord: jsonb("source_record").$type<JsonValue>().notNull(),
  },
  (table) => [
    uniqueIndex("catalog_products_release_product_unique").on(
      table.catalogReleaseId,
      table.productId,
    ),
    uniqueIndex("catalog_products_release_sku_unique").on(
      table.catalogReleaseId,
      table.sku,
    ),
    index("catalog_products_release_idx").on(table.catalogReleaseId),
  ],
);

export const catalogAssetsTable = pgTable(
  "catalog_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogReleaseId: uuid("catalog_release_id")
      .notNull()
      .references(() => catalogReleasesTable.id),
    productId: text("product_id").notNull(),
    originalPath: text("original_path").notNull(),
    thumbnailPath: text("thumbnail_path").notNull(),
    sourceUrl: text("source_url").notNull(),
    sha256: text("sha256").notNull(),
    byteSize: integer("byte_size").notNull(),
    thumbnailSha256: text("thumbnail_sha256").notNull(),
    thumbnailByteSize: integer("thumbnail_byte_size").notNull(),
    mediaType: text("media_type").notNull(),
  },
  (table) => [
    uniqueIndex("catalog_assets_release_product_original_unique").on(
      table.catalogReleaseId,
      table.productId,
      table.originalPath,
    ),
    check("catalog_assets_byte_size_positive", sql`${table.byteSize} > 0`),
    check(
      "catalog_assets_thumbnail_byte_size_positive",
      sql`${table.thumbnailByteSize} > 0`,
    ),
  ],
);

export const pricebooksTable = pgTable(
  "pricebooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    catalogReleaseId: uuid("catalog_release_id")
      .notNull()
      .references(() => catalogReleasesTable.id),
    version: text("version").notNull(),
    sourceName: text("source_name").notNull(),
    sourceVersion: text("source_version"),
    provenance: jsonb("provenance").$type<JsonValue>().notNull(),
    effectiveFrom: date("effective_from", { mode: "string" }).notNull(),
    effectiveTo: date("effective_to", { mode: "string" }),
    snapshot: jsonb("snapshot").$type<JsonValue>().notNull(),
    snapshotSha256: text("snapshot_sha256").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("pricebooks_version_unique").on(table.version),
    uniqueIndex("pricebooks_snapshot_sha256_unique").on(table.snapshotSha256),
    check(
      "pricebooks_effective_range_valid",
      sql`${table.effectiveTo} is null or ${table.effectiveTo} >= ${table.effectiveFrom}`,
    ),
  ],
);

export const pricebookLinesTable = pgTable(
  "pricebook_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pricebookId: uuid("pricebook_id")
      .notNull()
      .references(() => pricebooksTable.id),
    sku: text("sku").notNull(),
    currency: text("currency").notNull(),
    wholesaleAmount: numeric("wholesale_amount", {
      precision: 12,
      scale: 2,
    }),
    status: pricingStatusEnum("status").notNull(),
    optionAdjustments: jsonb("option_adjustments")
      .$type<JsonValue>()
      .notNull()
      .default({}),
    sourceRecord: jsonb("source_record").$type<JsonValue>().notNull(),
  },
  (table) => [
    uniqueIndex("pricebook_lines_pricebook_sku_unique").on(
      table.pricebookId,
      table.sku,
    ),
    check(
      "pricebook_lines_amount_status_valid",
      sql`(${table.status} = 'priced' and ${table.wholesaleAmount} is not null and ${table.wholesaleAmount} >= 0) or (${table.status} <> 'priced' and ${table.wholesaleAmount} is null)`,
    ),
  ],
);

export const projectCatalogSnapshotsTable = pgTable(
  "project_catalog_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: text("project_id").notNull(),
    catalogReleaseId: uuid("catalog_release_id")
      .notNull()
      .references(() => catalogReleasesTable.id),
    pricebookId: uuid("pricebook_id").references(() => pricebooksTable.id),
    snapshot: jsonb("snapshot").$type<JsonValue>().notNull(),
    snapshotSha256: text("snapshot_sha256").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("project_catalog_snapshots_project_digest_unique").on(
      table.projectId,
      table.snapshotSha256,
    ),
    index("project_catalog_snapshots_project_idx").on(table.projectId),
  ],
);

export const insertCatalogReleaseSchema = createInsertSchema(
  catalogReleasesTable,
).omit({ id: true, createdAt: true });
export const insertCatalogProductSchema = createInsertSchema(
  catalogProductsTable,
).omit({ id: true });
export const insertCatalogAssetSchema = createInsertSchema(
  catalogAssetsTable,
).omit({ id: true });
export const insertPricebookSchema = createInsertSchema(pricebooksTable).omit({
  id: true,
  createdAt: true,
});
export const insertPricebookLineSchema = createInsertSchema(
  pricebookLinesTable,
).omit({ id: true });
export const insertProjectCatalogSnapshotSchema = createInsertSchema(
  projectCatalogSnapshotsTable,
).omit({ id: true, issuedAt: true });

export type InsertCatalogRelease = z.infer<
  typeof insertCatalogReleaseSchema
>;
export type CatalogRelease = typeof catalogReleasesTable.$inferSelect;
export type InsertCatalogProduct = z.infer<
  typeof insertCatalogProductSchema
>;
export type CatalogProduct = typeof catalogProductsTable.$inferSelect;
export type InsertCatalogAsset = z.infer<typeof insertCatalogAssetSchema>;
export type CatalogAsset = typeof catalogAssetsTable.$inferSelect;
export type InsertPricebook = z.infer<typeof insertPricebookSchema>;
export type Pricebook = typeof pricebooksTable.$inferSelect;
export type InsertPricebookLine = z.infer<typeof insertPricebookLineSchema>;
export type PricebookLine = typeof pricebookLinesTable.$inferSelect;
export type InsertProjectCatalogSnapshot = z.infer<
  typeof insertProjectCatalogSnapshotSchema
>;
export type ProjectCatalogSnapshot =
  typeof projectCatalogSnapshotsTable.$inferSelect;