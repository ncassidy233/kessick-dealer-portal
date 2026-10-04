import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { validateCatalog } from "./catalog-validator.js";

test("reports duplicate identities, invalid dimensions, pricing, and assets", async () => {
  const root = await mkdtemp(join(tmpdir(), "catalog-validator-"));
  try {
    const catalogPath = join(root, "catalog.json");
    const assetRoot = join(root, "assets");
    await mkdir(assetRoot);
    const product = {
      id: "duplicate",
      sku: "DUPLICATE",
      category: "tower",
      width_in: -1,
      height_in: 10,
      depth_in: 10,
      unit: "centimeters",
      materials: ["Unknown"],
      hardware_finishes: ["Unknown"],
      image_file: "missing.jpg",
    };
    await writeFile(
      catalogPath,
      JSON.stringify({
        source: "approved fixture",
        standards: {
          tower_widths_in: [18],
          tower_heights_in: [77.25],
          tower_depth_in: 11.75,
          woods: ["Walnut"],
          hardware: ["Black"],
        },
        products: [product, product],
      }),
    );

    const report = await validateCatalog(catalogPath, assetRoot);
    const codes = new Set(report.issues.map((issue) => issue.code));
    assert.equal(report.valid, false);
    assert.ok(codes.has("DUPLICATE_ID"));
    assert.ok(codes.has("DUPLICATE_SKU"));
    assert.ok(codes.has("INVALID_DIMENSION"));
    assert.ok(codes.has("UNSUPPORTED_UNIT"));
    assert.ok(codes.has("MISSING_ORIGINAL"));
    assert.ok(codes.has("MISSING_ASSET_PROVENANCE"));
    assert.ok(codes.has("INCOMPLETE_PRICING"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("reports conflicting versions for the same approved source", async () => {
  const root = await mkdtemp(join(tmpdir(), "catalog-validator-"));
  try {
    const catalogPath = join(root, "catalog.json");
    const assetRoot = join(root, "assets");
    await mkdir(assetRoot);
    await writeFile(
      catalogPath,
      JSON.stringify({
        source: "approved fixture",
        source_version: "source-set-1",
        release_version: "release-1",
        sources: [
          { id: "tower-catalog", version: "2023" },
          { id: "tower-catalog", version: "2024" },
        ],
        products: [],
      }),
    );

    const report = await validateCatalog(catalogPath, assetRoot);
    assert.ok(report.issues.some((issue) => issue.code === "CONFLICTING_VERSIONS"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});