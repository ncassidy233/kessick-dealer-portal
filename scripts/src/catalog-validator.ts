import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type JsonRecord = Record<string, unknown>;
export type Severity = "error" | "warning";

export interface ValidationIssue {
  severity: Severity;
  code: string;
  path: string;
  message: string;
}

export interface CatalogValidationReport {
  valid: boolean;
  catalogPath: string;
  assetRoot: string;
  source: string | null;
  sourceVersion: string | null;
  releaseVersion: string | null;
  productCount: number;
  assetCount: number;
  errors: number;
  warnings: number;
  issues: ValidationIssue[];
  assets: Array<{
    file: string;
    thumbnail: string;
    byteSize: number;
    sha256: string;
    thumbnailByteSize: number;
    thumbnailSha256: string;
  }>;
}

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function imageKind(bytes: Buffer): string | null {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff &&
    bytes[bytes.length - 1] === 0xd9
  )
    return ".jpg";
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    )
  )
    return ".png";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString() === "RIFF" &&
    bytes.subarray(8, 12).toString() === "WEBP"
  )
    return ".webp";
  return null;
}

async function inspectImage(path: string): Promise<{
  byteSize: number;
  sha256: string;
  kind: string | null;
}> {
  const details = await stat(path);
  if (!details.isFile() || details.size === 0) throw new Error("empty or not a file");
  const bytes = await readFile(path);
  return {
    byteSize: details.size,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    kind: imageKind(bytes),
  };
}

function normalizeWood(value: string): string {
  return value.replace(/\s+wood$/i, "").trim().toLowerCase();
}

export async function validateCatalog(
  catalogPath: string,
  assetRoot: string,
): Promise<CatalogValidationReport> {
  const issues: ValidationIssue[] = [];
  const add = (
    severity: Severity,
    code: string,
    path: string,
    message: string,
  ): void => {
    issues.push({ severity, code, path, message });
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(catalogPath, "utf8")) as unknown;
  } catch (error) {
    add(
      "error",
      "INVALID_JSON",
      "$",
      error instanceof Error ? error.message : "Catalog is not valid JSON.",
    );
    return finishReport(catalogPath, assetRoot, null, [], [], issues);
  }

  const catalog = record(parsed);
  if (!catalog) {
    add("error", "INVALID_ROOT", "$", "Catalog root must be an object.");
    return finishReport(catalogPath, assetRoot, null, [], [], issues);
  }

  const products = Array.isArray(catalog.products) ? catalog.products : [];
  if (!Array.isArray(catalog.products) || products.length === 0) {
    add(
      "error",
      "MISSING_PRODUCTS",
      "$.products",
      "A nonempty products array is required.",
    );
  }

  const sourceVersion = text(catalog.source_version);
  const releaseVersion =
    text(catalog.release_version) ?? text(catalog.catalog_version);
  if (!sourceVersion)
    add(
      "warning",
      "MISSING_SOURCE_VERSION",
      "$.source_version",
      "Approved feed does not identify its source version.",
    );
  if (!releaseVersion)
    add(
      "warning",
      "MISSING_RELEASE_VERSION",
      "$.release_version",
      "Approved feed does not identify a catalog release version.",
    );
  const declaredSourceVersions = new Map<string, string>();
  for (const [index, value] of (Array.isArray(catalog.sources)
    ? catalog.sources
    : []
  ).entries()) {
    const source = record(value);
    if (!source) continue;
    const sourceKey = text(source.id) ?? text(source.url);
    const declaredVersion = text(source.version);
    if (!sourceKey || !declaredVersion) continue;
    const priorVersion = declaredSourceVersions.get(sourceKey);
    if (priorVersion && priorVersion !== declaredVersion) {
      add(
        "error",
        "CONFLICTING_VERSIONS",
        `$.sources[${index}].version`,
        `Source "${sourceKey}" declares both "${priorVersion}" and "${declaredVersion}".`,
      );
    }
    declaredSourceVersions.set(sourceKey, declaredVersion);
  }

  const standards = record(catalog.standards) ?? {};
  const widths = new Set(
    [
      ...(Array.isArray(standards.tower_widths_in)
        ? standards.tower_widths_in
        : []),
      ...(Array.isArray(standards.tower_niche_widths_in)
        ? standards.tower_niche_widths_in
        : []),
    ].filter((value): value is number => typeof value === "number"),
  );
  const heights = new Set(
    (Array.isArray(standards.tower_heights_in)
      ? standards.tower_heights_in
      : []
    ).filter((value): value is number => typeof value === "number"),
  );
  const towerDepth =
    typeof standards.tower_depth_in === "number"
      ? standards.tower_depth_in
      : null;
  const woods = new Set(stringArray(standards.woods).map(normalizeWood));
  const hardware = new Set(
    stringArray(standards.hardware).map((value) => value.toLowerCase()),
  );
  const optionControls = record(standards.options);
  const ids = new Set<string>();
  const skus = new Set<string>();
  const sourceFiles = new Map<string, string>();

  for (let index = 0; index < products.length; index += 1) {
    const path = `$.products[${index}]`;
    const product = record(products[index]);
    if (!product) {
      add("error", "INVALID_PRODUCT", path, "Product must be an object.");
      continue;
    }
    const id = text(product.id);
    const sku = text(product.sku);
    if (!id) add("error", "MISSING_ID", `${path}.id`, "Product id is required.");
    else if (ids.has(id))
      add("error", "DUPLICATE_ID", `${path}.id`, `Duplicate id "${id}".`);
    else ids.add(id);
    if (!sku)
      add("error", "MISSING_SKU", `${path}.sku`, "Product SKU is required.");
    else if (skus.has(sku))
      add("error", "DUPLICATE_SKU", `${path}.sku`, `Duplicate SKU "${sku}".`);
    else skus.add(sku);

    for (const field of ["width_in", "height_in", "depth_in"] as const) {
      const value = product[field];
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        add(
          "error",
          "INVALID_DIMENSION",
          `${path}.${field}`,
          `${field} must be a finite number greater than zero.`,
        );
      }
    }
    if (product.unit !== "inches")
      add(
        "error",
        "UNSUPPORTED_UNIT",
        `${path}.unit`,
        `Unsupported dimension unit "${String(product.unit)}".`,
      );

    if (product.category === "tower") {
      if (typeof product.width_in === "number" && !widths.has(product.width_in))
        add(
          "error",
          "UNSUPPORTED_TOWER_WIDTH",
          `${path}.width_in`,
          `Width ${product.width_in} is not in the approved tower or niche width controls.`,
        );
      if (
        typeof product.height_in === "number" &&
        !heights.has(product.height_in)
      )
        add(
          "error",
          "UNSUPPORTED_TOWER_HEIGHT",
          `${path}.height_in`,
          `Height ${product.height_in} is not in standards.tower_heights_in.`,
        );
      if (
        towerDepth !== null &&
        typeof product.depth_in === "number" &&
        product.depth_in !== towerDepth
      )
        add(
          "error",
          "UNSUPPORTED_TOWER_DEPTH",
          `${path}.depth_in`,
          `Depth ${product.depth_in} conflicts with standard ${towerDepth}.`,
        );
    }

    for (const material of stringArray(product.materials)) {
      if (woods.size > 0 && !woods.has(normalizeWood(material)))
        add(
          "error",
          "UNSUPPORTED_MATERIAL",
          `${path}.materials`,
          `Material "${material}" is not in standards.woods.`,
        );
    }
    for (const finish of stringArray(product.hardware_finishes)) {
      if (hardware.size > 0 && !hardware.has(finish.toLowerCase()))
        add(
          "error",
          "UNSUPPORTED_HARDWARE",
          `${path}.hardware_finishes`,
          `Hardware finish "${finish}" is not in standards.hardware.`,
        );
    }
    const productOptions = record(product.options);
    if (productOptions) {
      for (const [control, selected] of Object.entries(productOptions)) {
        const allowed = optionControls
          ? stringArray(optionControls[control])
          : [];
        if (allowed.length === 0) {
          add(
            "error",
            "UNSUPPORTED_OPTION_CONTROL",
            `${path}.options.${control}`,
            `Option control "${control}" has no approved values in standards.options.`,
          );
          continue;
        }
        const values = Array.isArray(selected) ? selected : [selected];
        for (const value of values) {
          if (typeof value !== "string" || !allowed.includes(value))
            add(
              "error",
              "UNSUPPORTED_OPTION_VALUE",
              `${path}.options.${control}`,
              `Value "${String(value)}" is not approved for option "${control}".`,
            );
        }
      }
    }

    const productVersion =
      text(product.source_version) ?? text(product.release_version);
    const expectedVersion = sourceVersion ?? releaseVersion;
    if (
      productVersion &&
      expectedVersion &&
      productVersion !== expectedVersion
    )
      add(
        "error",
        "CONFLICTING_PRODUCT_VERSION",
        path,
        `Product version "${productVersion}" conflicts with feed version "${expectedVersion}".`,
      );

    const imageFile = text(product.image_file);
    if (!imageFile) {
      add(
        "error",
        "MISSING_ASSET_REFERENCE",
        `${path}.image_file`,
        "Product must reference an approved original.",
      );
    } else if (
      imageFile !== basename(imageFile) ||
      !IMAGE_EXTENSIONS.has(extname(imageFile).toLowerCase())
    ) {
      add(
        "error",
        "INVALID_ASSET_REFERENCE",
        `${path}.image_file`,
        `Unsafe or unsupported image filename "${imageFile}".`,
      );
    } else {
      sourceFiles.set(imageFile, `${path}.image_file`);
    }
    if (!text(product.source_image_url))
      add(
        "error",
        "MISSING_ASSET_PROVENANCE",
        `${path}.source_image_url`,
        "Original asset source URL is required.",
      );

    const pricing = record(product.pricing);
    const amount = pricing?.wholesale_amount;
    const currency = pricing?.currency;
    if (
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/.test(currency)
    )
      add(
        "warning",
        "INCOMPLETE_PRICING",
        `${path}.pricing`,
        `No complete approved price is present for SKU "${sku ?? "(missing)"}"; keep it TBD.`,
      );
  }

  if (!Array.isArray(standards.finishes))
    add(
      "warning",
      "MISSING_FINISH_CONTROL_SET",
      "$.standards.finishes",
      "Finish values cannot be checked because the feed has no approved finish control set.",
    );

  const assets: CatalogValidationReport["assets"] = [];
  for (const [file, issuePath] of [...sourceFiles].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const original = join(assetRoot, file);
    const thumbnail = join(assetRoot, "thumbnails", `${file}.webp`);
    try {
      const inspected = await inspectImage(original);
      const expected = extname(file).toLowerCase().replace(".jpeg", ".jpg");
      if (inspected.kind !== expected)
        add(
          "error",
          "ORIGINAL_CONTENT_MISMATCH",
          issuePath,
          `"${file}" bytes do not match its extension.`,
        );
      let thumbnailInspection:
        | Awaited<ReturnType<typeof inspectImage>>
        | undefined;
      try {
        const thumb = await inspectImage(thumbnail);
        thumbnailInspection = thumb;
        if (thumb.kind !== ".webp")
          add(
            "error",
            "THUMBNAIL_CONTENT_MISMATCH",
            issuePath,
            `Thumbnail for "${file}" is not a valid WebP image.`,
          );
      } catch (error) {
        add(
          "error",
          "MISSING_THUMBNAIL",
          issuePath,
          `Missing or empty generated thumbnail "${thumbnail}": ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
      if (thumbnailInspection)
        assets.push({
          file,
          thumbnail: `thumbnails/${file}.webp`,
          byteSize: inspected.byteSize,
          sha256: inspected.sha256,
          thumbnailByteSize: thumbnailInspection.byteSize,
          thumbnailSha256: thumbnailInspection.sha256,
        });
    } catch (error) {
      add(
        "error",
        "MISSING_ORIGINAL",
        issuePath,
        `Missing or empty original "${original}": ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  }

  return finishReport(catalogPath, assetRoot, catalog, products, assets, issues);
}

function finishReport(
  catalogPath: string,
  assetRoot: string,
  catalog: JsonRecord | null,
  products: unknown[],
  assets: CatalogValidationReport["assets"],
  issues: ValidationIssue[],
): CatalogValidationReport {
  issues.sort(
    (a, b) =>
      a.severity.localeCompare(b.severity) ||
      a.path.localeCompare(b.path) ||
      a.code.localeCompare(b.code),
  );
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  return {
    valid: errors === 0,
    catalogPath,
    assetRoot,
    source: catalog ? text(catalog.source) : null,
    sourceVersion: catalog ? text(catalog.source_version) : null,
    releaseVersion: catalog
      ? text(catalog.release_version) ?? text(catalog.catalog_version)
      : null,
    productCount: products.length,
    assetCount: assets.length,
    errors,
    warnings,
    issues,
    assets,
  };
}

function parseArgs(argv: string[]): {
  catalog: string;
  assets: string;
  output: string | null;
} {
  const root = process.env.INIT_CWD ?? process.cwd();
  const result = {
    catalog: resolve(
      root,
      "artifacts/kessick-visualizer/public/data/kessick-products.json",
    ),
    assets: resolve(
      root,
      "artifacts/kessick-visualizer/public/assets/kessick-products",
    ),
    output: null as string | null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--") continue;
    if (key !== "--catalog" && key !== "--assets" && key !== "--output")
      throw new Error(`Unknown argument "${key}".`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`Missing value after ${key}.`);
    if (key === "--catalog") result.catalog = resolve(root, value);
    if (key === "--assets") result.assets = resolve(root, value);
    if (key === "--output") result.output = resolve(root, value);
    index += 1;
  }
  return result;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await validateCatalog(options.catalog, options.assets);
  const rendered = `${JSON.stringify(report, null, 2)}\n`;
  if (options.output) await writeFile(options.output, rendered);
  process.stdout.write(rendered);
  if (!report.valid) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]))
  void main().catch((error: unknown) => {
    process.stderr.write(
      `Catalog validation failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });