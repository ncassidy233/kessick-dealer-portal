import type {
  AuthorizedPriceSnapshot,
  Catalog,
  CatalogCompatibilityRule,
  CatalogConfidence,
  CatalogGalleryAsset,
  CatalogProductSnapshot,
  CatalogReleaseReference,
  CatalogWarning,
  Product,
  ProjectCatalogSnapshot,
} from '@/types/catalog';
import type { FinishSelection, ProductInstance } from '@/types/design';

const PRODUCT_IMAGE_ASSET_PATH = 'assets/kessick-products/';
const PRODUCT_THUMBNAIL_ASSET_PATH = `${PRODUCT_IMAGE_ASSET_PATH}thumbnails/`;

type UnknownRecord = Record<string, unknown>;

export interface CatalogFilters {
  search?: string;
  line?: string;
  style?: string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  minDepth?: number;
  maxDepth?: number;
  minCapacity?: number;
  material?: string;
  finish?: string;
  lighting?: string;
  suitability?: string;
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function strings(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return result.length ? result : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function approvedCutoutImageFile(raw: UnknownRecord): string | undefined {
  const placementAsset = record(raw.placement_asset);
  const imageFile = typeof placementAsset.image_file === 'string'
    ? placementAsset.image_file
    : undefined;
  const hasCutoutRole = placementAsset.role === 'cutout';
  const isApproved = placementAsset.approved_for_placement === true;
  const supportsTransparency = imageFile ? /\.(?:png|webp)$/i.test(imageFile) : false;
  return hasCutoutRole && isApproved && supportsTransparency ? imageFile : undefined;
}

export function resolveProductImageUrl(imageFile?: string) {
  if (!imageFile) return '';
  if (imageFile !== imageFile.split('/').pop()) throw new Error(`Product image_file must be a filename: ${imageFile}`);
  return `${import.meta.env.BASE_URL}${PRODUCT_IMAGE_ASSET_PATH}${encodeURIComponent(imageFile)}`;
}

export function resolveProductThumbnailUrl(imageFile?: string) {
  if (!imageFile) return '';
  if (imageFile !== imageFile.split('/').pop()) throw new Error(`Product image_file must be a filename: ${imageFile}`);
  return `${import.meta.env.BASE_URL}${PRODUCT_THUMBNAIL_ASSET_PATH}${encodeURIComponent(`${imageFile}.webp`)}`;
}

function confidence(value: unknown, fallback: CatalogConfidence): CatalogConfidence {
  return ['verified', 'high', 'medium', 'low', 'unknown'].includes(String(value))
    ? value as CatalogConfidence
    : fallback;
}

function releaseFromEnvelope(envelope: UnknownRecord): CatalogReleaseReference {
  const release = record(envelope.release);
  const generatedAt = typeof envelope.generated_at === 'string' ? envelope.generated_at : undefined;
  const version = String(release.version ?? envelope.release_version ?? envelope.catalog_version ?? generatedAt ?? 'legacy-unversioned');
  return {
    id: String(release.id ?? envelope.release_id ?? `public-${version}`),
    version,
    effectiveAt: typeof release.effective_at === 'string'
      ? release.effective_at
      : typeof envelope.effective_from === 'string'
        ? envelope.effective_from
        : generatedAt,
    source: typeof release.source === 'string' ? release.source : typeof envelope.source === 'string' ? envelope.source : undefined,
    capturedAt: new Date().toISOString(),
  };
}

function normalizeGallery(raw: UnknownRecord): CatalogGalleryAsset[] {
  const gallery = Array.isArray(raw.gallery) ? raw.gallery : [];
  const normalized = gallery.flatMap((entry, index) => {
    const asset = record(entry);
    const imageFile = typeof asset.image_file === 'string' ? asset.image_file : undefined;
    const isApprovedCutout = asset.role === 'cutout'
      && asset.approved_for_placement === true
      && Boolean(imageFile && /\.(?:png|webp)$/i.test(imageFile));
    if (!isApprovedCutout) return [];
    return [{
      id: String(asset.id ?? `${raw.id ?? raw.sku}-gallery-${index}`),
      imageFile,
      imageUrl: imageFile ? resolveProductImageUrl(imageFile) : undefined,
      thumbnailUrl: imageFile ? resolveProductThumbnailUrl(imageFile) : undefined,
      sourceUrl: typeof asset.source_url === 'string' ? asset.source_url : undefined,
      alt: typeof asset.alt === 'string' ? asset.alt : undefined,
      role: typeof asset.role === 'string' ? asset.role : undefined,
    }];
  });
  const approvedImageFile = approvedCutoutImageFile(raw);
  if (!normalized.length && approvedImageFile) {
    normalized.push({
      id: `${raw.id ?? raw.sku}-primary`,
      imageFile: approvedImageFile,
      imageUrl: resolveProductImageUrl(approvedImageFile),
      thumbnailUrl: resolveProductThumbnailUrl(approvedImageFile),
      sourceUrl: typeof raw.source_image_url === 'string' ? raw.source_image_url : undefined,
      alt: typeof raw.name === 'string' ? raw.name : undefined,
      role: 'cutout',
    });
  }
  return normalized;
}

function normalizePrice(raw: UnknownRecord): AuthorizedPriceSnapshot | undefined {
  const price = record(raw.authorized_price);
  const amount = finiteNumber(price.unit_amount);
  const authorization = price.authorization;
  if (amount === undefined || amount < 0 || (authorization !== 'dealer' && authorization !== 'kessick')) return undefined;
  if (!price.pricebook_id || !price.pricebook_version || !price.currency) return undefined;
  return {
    pricebookId: String(price.pricebook_id),
    pricebookVersion: String(price.pricebook_version),
    effectiveAt: typeof price.effective_at === 'string' ? price.effective_at : undefined,
    currency: String(price.currency),
    unitAmount: amount,
    authorization,
    capturedAt: new Date().toISOString(),
  };
}

function deriveWarnings(raw: UnknownRecord, dimensions: { width: number; height: number; depth: number }): CatalogWarning[] {
  const warnings: CatalogWarning[] = [];
  if (!raw.sku) warnings.push({ kind: 'missing', field: 'sku', message: 'SKU is missing; do not issue for ordering.', actionable: true });
  if (!dimensions.width || !dimensions.height || !dimensions.depth) {
    warnings.push({ kind: 'missing', field: 'dimensions', message: 'Verified physical dimensions are incomplete; placement is blocked.', actionable: true });
  }
  if (raw.customizable === true || raw.status === 'planning') {
    warnings.push({ kind: 'planning', field: 'dimensions', message: 'Planning-default dimensions only. Confirm project-specific dimensions before approval.', actionable: true });
  }
  if (raw.status === 'stale' || raw.status === 'discontinued') {
    warnings.push({ kind: 'stale', message: `Catalog record is ${String(raw.status)}. Reconcile with the current release before specifying.`, actionable: true });
  }
  if (raw.bottle_capacity == null) {
    warnings.push({ kind: 'missing', field: 'bottle_capacity', message: 'Bottle capacity is not published for this record.' });
  }
  if (!approvedCutoutImageFile(raw)) {
    warnings.push({
      kind: 'missing',
      field: 'gallery',
      message: 'No approved product cutout is available; room placement uses the verified dimensional elevation.',
    });
  }
  if (!Array.isArray(raw.materials) || !raw.materials.length) warnings.push({ kind: 'missing', field: 'materials', message: 'Available materials are not documented.' });
  if (!Array.isArray(raw.finishes) || !raw.finishes.length) warnings.push({ kind: 'missing', field: 'finishes', message: 'Available finishes are not documented.' });
  const supplied = Array.isArray(raw.warnings) ? raw.warnings : [];
  for (const item of supplied) {
    const warning = record(item);
    if (typeof warning.message === 'string') {
      warnings.push({
        kind: ['missing', 'stale', 'planning', 'compatibility', 'clearance', 'pricing'].includes(String(warning.kind))
          ? warning.kind as CatalogWarning['kind'] : 'compatibility',
        message: warning.message,
        field: typeof warning.field === 'string' ? warning.field : undefined,
        actionable: warning.actionable === true,
      });
    }
  }
  return warnings;
}

function normalizeProduct(rawValue: unknown, release: CatalogReleaseReference, envelope: UnknownRecord): Product {
  const raw = record(rawValue);
  const width = finiteNumber(raw.width_in) ?? 0;
  const height = finiteNumber(raw.height_in) ?? 0;
  const depth = finiteNumber(raw.depth_in) ?? 0;
  const imageFile = approvedCutoutImageFile(raw);
  const provenance = record(raw.provenance);
  const sourceConfidence = confidence(provenance.confidence ?? raw.confidence, raw.customizable === true ? 'low' : 'medium');
  const options = Array.isArray(raw.options) ? raw.options.map((value, index) => {
    const option = record(value);
    return {
      id: String(option.id ?? `option-${index}`),
      label: String(option.label ?? option.id ?? `Option ${index + 1}`),
      values: strings(option.values) ?? [],
      required: option.required === true,
    };
  }) : undefined;
  const compatibility = Array.isArray(raw.compatibility) ? raw.compatibility.map(value => {
    const rule = record(value);
    return {
      when: record(rule.when) as Record<string, string | boolean>,
      requires: rule.requires ? record(rule.requires) as Record<string, string | boolean> : undefined,
      excludes: rule.excludes ? record(rule.excludes) as Record<string, string | boolean> : undefined,
      message: typeof rule.message === 'string' ? rule.message : undefined,
    };
  }) : undefined;
  return {
    id: String(raw.id ?? raw.sku ?? ''),
    sku: String(raw.sku ?? ''),
    name: String(raw.name ?? raw.sku ?? 'Unnamed product'),
    series: String(raw.series ?? raw.line ?? 'Unspecified'),
    category: String(raw.category ?? 'Unspecified'),
    bottle_capacity: raw.bottle_capacity === null ? null : finiteNumber(raw.bottle_capacity) ?? null,
    width_in: width,
    height_in: height,
    depth_in: depth,
    image_url: resolveProductImageUrl(imageFile),
    thumbnail_url: resolveProductThumbnailUrl(imageFile),
    source_image_url: typeof raw.source_image_url === 'string' ? raw.source_image_url : undefined,
    image_file: imageFile,
    product_url: typeof raw.product_url === 'string' ? raw.product_url : undefined,
    customizable: raw.customizable === true,
    materials: strings(raw.materials),
    finishes: strings(raw.finishes),
    hardware_finishes: strings(raw.hardware_finishes),
    features: strings(raw.features),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    style: typeof raw.style === 'string' || Array.isArray(raw.style) ? raw.style as string | string[] : undefined,
    lighting: strings(raw.lighting),
    suitability: strings(raw.suitability),
    specifications: record(raw.specifications) as Record<string, string | number | boolean | null>,
    options,
    compatibility,
    clearances: record(raw.clearances) as Record<string, number>,
    gallery: normalizeGallery(raw),
    provenance: {
      source: typeof provenance.source === 'string' ? provenance.source : release.source,
      sourceUrl: typeof provenance.source_url === 'string' ? provenance.source_url : typeof raw.catalog_pdf === 'string' ? raw.catalog_pdf : undefined,
      catalogRef: typeof raw.catalog_ref === 'string' || raw.catalog_ref === null ? raw.catalog_ref : undefined,
      effectiveAt: typeof provenance.effective_at === 'string' ? provenance.effective_at : release.effectiveAt,
      importedAt: typeof provenance.imported_at === 'string' ? provenance.imported_at : typeof envelope.generated_at === 'string' ? envelope.generated_at : undefined,
      confidence: sourceConfidence,
    },
    confidence: sourceConfidence,
    warnings: deriveWarnings(raw, { width, height, depth }),
    catalog_release: release,
    status: ['active', 'stale', 'discontinued', 'planning'].includes(String(raw.status)) ? raw.status as Product['status'] : undefined,
    authorized_price: normalizePrice(raw),
  };
}

export function parseCatalogEnvelope(value: unknown): Catalog {
  const envelope = record(value);
  const release = releaseFromEnvelope(envelope);
  const sourceProducts = Array.isArray(envelope.products)
    ? envelope.products
    : Array.isArray(record(envelope.data).products) ? record(envelope.data).products as unknown[] : [];
  const products = sourceProducts.map(raw => normalizeProduct(raw, release, envelope));
  const warnings: CatalogWarning[] = [];
  const ids = new Set<string>();
  const skus = new Set<string>();
  for (const product of products) {
    if (ids.has(product.id)) warnings.push({ kind: 'missing', message: `Duplicate product id: ${product.id}`, actionable: true });
    if (skus.has(product.sku)) warnings.push({ kind: 'missing', message: `Duplicate SKU: ${product.sku}`, actionable: true });
    ids.add(product.id);
    skus.add(product.sku);
  }
  return { release, products, warnings };
}

export function filterCatalogProducts(products: Product[], filters: CatalogFilters): Product[] {
  const search = filters.search?.trim().toLowerCase();
  const includes = (values: string[] | undefined, expected: string | undefined) =>
    !expected || values?.some(value => value.toLowerCase() === expected.toLowerCase());
  return products.filter(product => {
    const searchable = [product.name, product.sku, product.series, product.category, product.description, ...(product.features ?? [])].join(' ').toLowerCase();
    return (!search || searchable.includes(search))
      && (!filters.line || filters.line === 'All' || product.series === filters.line || (filters.line === 'Tower Series' && product.series === 'Tower'))
      && (!filters.style || (Array.isArray(product.style) ? product.style : product.style ? [product.style] : [])
        .some(style => style.toLowerCase() === filters.style!.toLowerCase()))
      && (filters.minWidth === undefined || product.width_in >= filters.minWidth)
      && (filters.maxWidth === undefined || product.width_in <= filters.maxWidth)
      && (filters.minHeight === undefined || product.height_in >= filters.minHeight)
      && (filters.maxHeight === undefined || product.height_in <= filters.maxHeight)
      && (filters.minDepth === undefined || product.depth_in >= filters.minDepth)
      && (filters.maxDepth === undefined || product.depth_in <= filters.maxDepth)
      && (filters.minCapacity === undefined || (product.bottle_capacity !== null && product.bottle_capacity >= filters.minCapacity))
      && includes(product.materials, filters.material)
      && includes(product.finishes, filters.finish)
      && (!filters.lighting || getLightingCapabilities(product).some(value => value.toLowerCase().includes(filters.lighting!.toLowerCase())))
      && includes(product.suitability, filters.suitability);
  });
}

export function getLightingCapabilities(product: Product): string[] {
  if (product.lighting?.length) return product.lighting;
  return (product.features ?? []).filter(feature => /\b(?:lighting?|led)\b/i.test(feature));
}

function selectionRecord(selection?: FinishSelection, lightingEnabled?: boolean): Record<string, string | boolean> {
  return {
    ...(selection?.material ? { material: selection.material } : {}),
    ...(selection?.finish ? { finish: selection.finish } : {}),
    ...(selection?.hardware ? { hardware: selection.hardware } : {}),
    lighting: lightingEnabled === true,
  };
}

function ruleMatches(rule: Record<string, string | boolean>, selection: Record<string, string | boolean>) {
  return Object.entries(rule).every(([key, value]) => selection[key] === value);
}

export function validateProductConfiguration(product: Product, instance: Pick<ProductInstance, 'finishSelection' | 'lighting' | 'customSized'>): CatalogWarning[] {
  const warnings = [...product.warnings];
  const selected = instance.finishSelection;
  const check = (field: keyof FinishSelection, values: string[] | undefined, label: string) => {
    const value = selected?.[field];
    if (value && !values?.includes(value)) warnings.push({
      kind: 'compatibility',
      field,
      message: `${label} “${value}” is not available for ${product.sku}. Choose a listed option or request catalog review.`,
      actionable: true,
    });
  };
  check('material', product.materials, 'Material');
  check('finish', product.finishes, 'Finish');
  check('hardware', product.hardware_finishes, 'Hardware finish');
  if (instance.lighting?.enabled && getLightingCapabilities(product).length === 0) {
    warnings.push({ kind: 'compatibility', field: 'lighting', message: 'Lighting availability is not documented for this product. Disable lighting or obtain approval.', actionable: true });
  }
  if (instance.customSized) warnings.push({ kind: 'planning', field: 'dimensions', message: 'Placement has been resized from catalog dimensions. Confirm all dimensions and fabrication clearances.', actionable: true });
  const selection = selectionRecord(selected, instance.lighting?.enabled);
  for (const rule of product.compatibility ?? []) {
    if (!ruleMatches(rule.when, selection)) continue;
    const invalidRequired = rule.requires && !ruleMatches(rule.requires, selection);
    const invalidExcluded = rule.excludes && Object.entries(rule.excludes).some(([key, value]) => selection[key] === value);
    if (invalidRequired || invalidExcluded) warnings.push({
      kind: 'compatibility',
      message: rule.message ?? 'This option combination is not supported. Review the required and excluded options.',
      actionable: true,
    });
  }
  if (!product.clearances || Object.keys(product.clearances).length === 0) {
    warnings.push({ kind: 'clearance', field: 'clearances', message: 'Required installation clearances are not published; verify before construction.' });
  }
  return warnings;
}

export function snapshotProduct(product: Product): CatalogProductSnapshot {
  const capturedAt = new Date().toISOString();
  return { release: { ...product.catalog_release, capturedAt }, product: structuredClone(product), capturedAt };
}

export function addProductToProjectCatalog(snapshot: ProjectCatalogSnapshot | undefined, product: Product): ProjectCatalogSnapshot {
  const productSnapshot = snapshotProduct(product);
  const releases = [...(snapshot?.releases ?? [])];
  if (!releases.some(release => release.id === product.catalog_release.id && release.version === product.catalog_release.version)) {
    releases.push(productSnapshot.release);
  }
  return {
    schemaVersion: 1,
    releases,
    products: { ...(snapshot?.products ?? {}), [product.id]: productSnapshot },
    prices: {
      ...(snapshot?.prices ?? {}),
      ...(product.authorized_price ? { [product.id]: product.authorized_price } : {}),
    },
    migrationWarnings: snapshot?.migrationWarnings,
  };
}

export function resolveProductForInstance(instance: ProductInstance, products: Product[]): Product | undefined {
  if (instance.productSnapshot) {
    return {
      ...instance.productSnapshot.product,
      catalog_release: instance.productSnapshot.release,
      authorized_price: instance.priceSnapshot,
    };
  }
  return products.find(product => product.id === instance.productId);
}

export function reconcileInstance(instance: ProductInstance, products: Product[]): { product?: Product; warnings: CatalogWarning[] } {
  const current = products.find(product => product.id === instance.productId);
  const product = resolveProductForInstance(instance, products);
  const warnings: CatalogWarning[] = [];
  if (!product) {
    warnings.push({ kind: 'missing', message: `Product ${instance.productId} is unavailable and has no saved snapshot.`, actionable: true });
    return { warnings };
  }
  if (!instance.productSnapshot) warnings.push({ kind: 'stale', message: 'Legacy placement has no exact catalog snapshot. Reconcile before issue.', actionable: true });
  if (current && instance.productSnapshot && (current.catalog_release.id !== instance.productSnapshot.release.id || current.catalog_release.version !== instance.productSnapshot.release.version)) {
    warnings.push({ kind: 'stale', message: `Placement uses catalog ${instance.productSnapshot.release.version}; current catalog is ${current.catalog_release.version}.`, actionable: true });
  }
  return { product, warnings: [...warnings, ...validateProductConfiguration(product, instance)] };
}