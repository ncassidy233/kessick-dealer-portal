export type CatalogConfidence = 'verified' | 'high' | 'medium' | 'low' | 'unknown';
export type CatalogWarningKind = 'missing' | 'stale' | 'planning' | 'compatibility' | 'clearance' | 'pricing';

export interface CatalogWarning {
  kind: CatalogWarningKind;
  message: string;
  field?: string;
  actionable?: boolean;
}

export interface CatalogProvenance {
  source?: string;
  sourceUrl?: string;
  catalogRef?: string | null;
  effectiveAt?: string;
  importedAt?: string;
  confidence: CatalogConfidence;
}

export interface CatalogGalleryAsset {
  id: string;
  imageFile?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  alt?: string;
  role?: 'primary' | 'detail' | 'installed' | 'drawing' | string;
}

export interface CatalogOptionDefinition {
  id: string;
  label: string;
  values: string[];
  required?: boolean;
}

export interface CatalogCompatibilityRule {
  when: Record<string, string | boolean>;
  requires?: Record<string, string | boolean>;
  excludes?: Record<string, string | boolean>;
  message?: string;
}

export interface AuthorizedPriceSnapshot {
  pricebookId: string;
  pricebookVersion: string;
  effectiveAt?: string;
  currency: string;
  unitAmount: number;
  authorization: 'dealer' | 'kessick';
  capturedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  series: string;
  category: string;
  bottle_capacity: number | null;
  width_in: number;
  height_in: number;
  depth_in: number;
  image_url: string;
  thumbnail_url: string;
  source_image_url?: string;
  image_file?: string;
  product_url?: string;
  customizable: boolean;
  materials?: string[];
  finishes?: string[];
  hardware_finishes?: string[];
  features?: string[];
  description?: string;
  style?: string | string[];
  lighting?: string[];
  suitability?: string[];
  specifications?: Record<string, string | number | boolean | null>;
  options?: CatalogOptionDefinition[];
  compatibility?: CatalogCompatibilityRule[];
  clearances?: Record<string, number>;
  gallery: CatalogGalleryAsset[];
  provenance: CatalogProvenance;
  confidence: CatalogConfidence;
  warnings: CatalogWarning[];
  catalog_release: CatalogReleaseReference;
  status?: 'active' | 'stale' | 'discontinued' | 'planning';
  authorized_price?: AuthorizedPriceSnapshot;
}

export interface CatalogReleaseReference {
  id: string;
  version: string;
  effectiveAt?: string;
  source?: string;
  capturedAt: string;
}

export interface CatalogProductSnapshot {
  release: CatalogReleaseReference;
  product: Product;
  capturedAt: string;
}

export interface ProjectCatalogSnapshot {
  schemaVersion: 1;
  releases: CatalogReleaseReference[];
  products: Record<string, CatalogProductSnapshot>;
  prices: Record<string, AuthorizedPriceSnapshot>;
  migrationWarnings?: string[];
}

export interface Catalog {
  release: CatalogReleaseReference;
  products: Product[];
  warnings: CatalogWarning[];
}