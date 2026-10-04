import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Router, type IRouter } from "express";
import {
  GetCurrentCatalogReleaseResponse,
  GetCurrentPricebookResponse,
} from "@workspace/api-zod";
import {
  db,
  dealerOrganizationsTable,
  organizationMembershipsTable,
  pricebookLinesTable,
  pricebooksTable,
} from "@workspace/db";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  getAuthorizedStaffRole,
  requireAccount,
} from "../middlewares/auth";
import { hasPortalCapability } from "../lib/portalPermissions";

type JsonRecord = Record<string, unknown>;

const router: IRouter = Router();
let catalogPromise: Promise<unknown> | null = null;

function asRecord(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Approved catalog root and products must be objects.");
  return value as JsonRecord;
}

function catalogCandidates(): string[] {
  const configured = process.env.APPROVED_CATALOG_PATH;
  return [
    ...(configured ? [resolve(configured)] : []),
    resolve(
      process.cwd(),
      "../kessick-visualizer/public/data/kessick-products.json",
    ),
    resolve(
      process.cwd(),
      "artifacts/kessick-visualizer/public/data/kessick-products.json",
    ),
    resolve(
      fileURLToPath(new URL("../../../", import.meta.url)),
      "kessick-visualizer/public/data/kessick-products.json",
    ),
  ];
}

async function findCatalogPath(): Promise<string> {
  for (const candidate of catalogCandidates()) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Continue through explicit deployment and workspace layouts.
    }
  }
  throw new Error(
    "No approved catalog feed is available. Set APPROVED_CATALOG_PATH.",
  );
}

export async function loadPublicCatalog(): Promise<unknown> {
  const catalogPath = await findCatalogPath();
  const raw = await readFile(catalogPath);
  const catalog = asRecord(JSON.parse(raw.toString("utf8")) as unknown);
  if (!Array.isArray(catalog.products) || catalog.products.length === 0)
    throw new Error("Approved catalog products are missing.");

  const releaseDigest = createHash("sha256").update(raw).digest("hex");

  const products = catalog.products.map((item) => {
    const product = asRecord(item);
    return {
      id: product.id,
      sku: product.sku,
      catalogRef: product.catalog_ref ?? null,
      name: product.name,
      series: product.series,
      category: product.category,
      productType: product.product_type,
      bottleCapacity: product.bottle_capacity ?? null,
      widthIn: product.width_in,
      heightIn: product.height_in,
      depthIn: product.depth_in,
      dimensionsRaw: product.dimensions_raw,
      unit: product.unit,
      materials: product.materials,
      finishes: product.finishes,
      hardwareFinishes: product.hardware_finishes,
      features: product.features,
      customizable: product.customizable,
      fullyAssembled: product.fully_assembled,
      productUrl: product.product_url,
      catalogPdf: product.catalog_pdf,
      notes: product.notes,
      asset: null,
    };
  });

  return GetCurrentCatalogReleaseResponse.parse({
    releaseId: `sha256:${releaseDigest}`,
    releaseVersion:
      catalog.release_version ?? catalog.catalog_version ?? null,
    effectiveFrom: catalog.effective_from ?? null,
    effectiveTo: catalog.effective_to ?? null,
    brand: catalog.brand,
    website: catalog.website,
    disclaimer: catalog.disclaimer,
    provenance: {
      source: catalog.source,
      sourceUrls: catalog.catalogs,
      generatedAt: catalog.generated_at,
      sourceVersion: catalog.source_version ?? null,
    },
    products,
  });
}

router.get("/catalog/releases/current", async (req, res): Promise<void> => {
  catalogPromise ??= loadPublicCatalog();
  try {
    res.json(await catalogPromise);
  } catch (error) {
    catalogPromise = null;
    req.log.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Approved public catalog is unavailable",
    );
    res.status(503).json({
      error: "No valid approved catalog release is currently available.",
    });
  }
});

router.get("/pricebooks/current", requireAccount, async (req, res) => {
  const account = req.account!;
  const staffRole = await getAuthorizedStaffRole(req);
  let authorized = staffRole
    ? hasPortalCapability(staffRole, "pricebooks:read")
    : false;
  if (account.role === "dealer" && account.status === "approved") {
    const [membership] = await db
      .select({ membership: organizationMembershipsTable })
      .from(organizationMembershipsTable)
      .innerJoin(
        dealerOrganizationsTable,
        eq(
          organizationMembershipsTable.organizationId,
          dealerOrganizationsTable.id,
        ),
      )
      .where(
        and(
          eq(organizationMembershipsTable.accountId, account.id),
          eq(organizationMembershipsTable.status, "approved"),
          eq(dealerOrganizationsTable.status, "approved"),
        ),
      )
      .limit(1);
    authorized = Boolean(membership);
  }
  if (!authorized) {
    res.status(403).json({
      error: "Wholesale pricebook access is not authorized.",
    });
    return;
  }
  const [pricebook] = await db
    .select()
    .from(pricebooksTable)
    .where(isNotNull(pricebooksTable.approvedAt))
    .orderBy(desc(pricebooksTable.effectiveFrom), desc(pricebooksTable.approvedAt))
    .limit(1);
  if (!pricebook) {
    res.status(503).json({ error: "No approved pricebook is available." });
    return;
  }
  const lines = await db
    .select()
    .from(pricebookLinesTable)
    .where(eq(pricebookLinesTable.pricebookId, pricebook.id));
  const provenance = asRecord(pricebook.provenance);
  res.json(
    GetCurrentPricebookResponse.parse({
      version: pricebook.version,
      catalogReleaseId: pricebook.catalogReleaseId,
      effectiveFrom: pricebook.effectiveFrom,
      effectiveTo: pricebook.effectiveTo,
      provenance: {
        source: provenance.source,
        sourceUrls: provenance.sourceUrls,
        generatedAt: provenance.generatedAt,
        sourceVersion: provenance.sourceVersion ?? null,
      },
      lines: lines.map((line) => ({
        sku: line.sku,
        currency: line.currency,
        wholesaleAmount:
          line.wholesaleAmount === null ? null : Number(line.wholesaleAmount),
        pricingStatus: line.status,
      })),
    }),
  );
});

export default router;