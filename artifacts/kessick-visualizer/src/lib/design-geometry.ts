import { SurveyEntity } from '@/types/survey';
import { ProductInstance } from '@/types/design';
import { Product } from '@/hooks/use-products';
import { resolveProductForInstance } from './catalog-domain';

// Clearance configuration
export const INSTALL_CLEARANCE_IN = 2.0; 
export const AISLE_CLEARANCE_IN = 36.0;

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ValidationIssue {
  id: string;
  severity: 'warning' | 'danger';
  message: string;
  instanceId?: string;
  entityId?: string;
}

// Convert a product instance into its physical bounding box (incorporating scale/pixels)
export function getInstanceBounds(inst: ProductInstance, product: Product, pixelsPerInch: number): BoundingBox {
  const w = product.width_in * pixelsPerInch * inst.scaleX;
  const h = product.height_in * pixelsPerInch * inst.scaleY;
  // Rotation simplified for orthographic, assuming axis-aligned or bounding box of rotation
  // For precise Kessick walls, we assume 0 rotation visually or axis-aligned.
  // We will treat as axis-aligned rect for clearance
  return { x: inst.x, y: inst.y, w, h };
}

// Check intersection of two rects
export function rectIntersect(r1: BoundingBox, r2: BoundingBox, padding: number = 0): boolean {
  return !(r2.x >= r1.x + r1.w + padding || 
           r2.x + r2.w <= r1.x - padding || 
           r2.y >= r1.y + r1.h + padding ||
           r2.y + r2.h <= r1.y - padding);
}

export function validateLayout(
  instances: ProductInstance[], 
  entities: SurveyEntity[], 
  products: Product[],
  pixelsPerInch: number
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check product-entity collisions
  instances.forEach(inst => {
    const product = resolveProductForInstance(inst, products);
    if (!product) return;
    const bounds = getInstanceBounds(inst, product, pixelsPerInch);

    entities.forEach(ent => {
      if (ent.type === 'obstruction') {
        if (rectIntersect(bounds, ent.rect)) {
          issues.push({
            id: `overlap-obstruction-${inst.instanceId}-${ent.id}`,
            severity: 'danger',
            message: `Product ${product.sku} overlaps ${ent.obstructionType} obstruction`,
            instanceId: inst.instanceId,
            entityId: ent.id
          });
        } else if (rectIntersect(bounds, ent.rect, INSTALL_CLEARANCE_IN * pixelsPerInch)) {
          issues.push({
            id: `clearance-obstruction-${inst.instanceId}-${ent.id}`,
            severity: 'warning',
            message: `Product ${product.sku} is within ${INSTALL_CLEARANCE_IN}" clearance of ${ent.obstructionType}`,
            instanceId: inst.instanceId,
            entityId: ent.id
          });
        }
      }
      if (ent.type === 'opening') {
        if (rectIntersect(bounds, ent.rect)) {
          issues.push({
            id: `overlap-opening-${inst.instanceId}-${ent.id}`,
            severity: 'danger',
            message: `Product ${product.sku} overlaps ${ent.openingType} opening`,
            instanceId: inst.instanceId,
            entityId: ent.id
          });
        }
      }
    });
  });

  // Check product-product collisions (simplistic)
  for (let i = 0; i < instances.length; i++) {
    for (let j = i + 1; j < instances.length; j++) {
      const instA = instances[i];
      const instB = instances[j];
      const prodA = resolveProductForInstance(instA, products);
      const prodB = resolveProductForInstance(instB, products);
      if (!prodA || !prodB) continue;

      const boundsA = getInstanceBounds(instA, prodA, pixelsPerInch);
      const boundsB = getInstanceBounds(instB, prodB, pixelsPerInch);

      // Overlap with 1px leeway for snapping
      if (rectIntersect(boundsA, boundsB, -1)) {
        issues.push({
          id: `overlap-product-${instA.instanceId}-${instB.instanceId}`,
          severity: 'warning',
          message: `Product ${prodA.sku} and ${prodB.sku} are overlapping. Check layout.`,
          instanceId: instA.instanceId
        });
      }
    }
  }

  return issues;
}
