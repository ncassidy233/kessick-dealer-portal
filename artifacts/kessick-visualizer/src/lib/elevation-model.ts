import { SurveyEntity, WallEntity, OpeningEntity, ObstructionEntity, AnnotationEntity, MeasureEntity } from '@/types/survey';
import { ProductInstance } from '@/types/design';
import { Product } from '@/hooks/use-products';
import { ValidationIssue, validateLayout } from './design-geometry';
import { resolveProductForInstance } from './catalog-domain';

export interface ElevationModel {
  wall: WallEntity | null;
  width_px: number;
  height_px: number;
  pixelsPerInch: number;
  openings: OpeningEntity[];
  obstructions: ObstructionEntity[];
  annotations: AnnotationEntity[];
  measures: MeasureEntity[];
  products: { inst: ProductInstance; product: Product }[];
  issues: ValidationIssue[];
}

export function buildElevationModel(
  entities: SurveyEntity[],
  instances: ProductInstance[],
  products: Product[],
  pixelsPerInch: number | null
): ElevationModel {
  const wall = entities.find((e): e is WallEntity => e.type === 'wall') || null;
  const openings = entities.filter((e): e is OpeningEntity => e.type === 'opening');
  const obstructions = entities.filter((e): e is ObstructionEntity => e.type === 'obstruction');
  const annotations = entities.filter((e): e is AnnotationEntity => e.type === 'annotation');
  const measures = entities.filter((e): e is MeasureEntity => e.type === 'measure');
  
  const mappedProducts = instances.map(inst => {
    const product = resolveProductForInstance(inst, products);
    return product ? { inst, product } : null;
  }).filter((x): x is { inst: ProductInstance; product: Product } => x !== null);

  const ppi = pixelsPerInch || 10; // Default fallback if not calibrated

  // Calculate bounding box if no wall is defined explicitly or to bound the view
  let maxX = 1000;
  let maxY = 1000;
  
  [...entities, ...instances].forEach(item => {
    if ('points' in item && item.points) {
      item.points.forEach((p: { x: number, y: number }) => {
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
    } else if ('rect' in item && item.rect) {
      if (item.rect.x + item.rect.w > maxX) maxX = item.rect.x + item.rect.w;
      if (item.rect.y + item.rect.h > maxY) maxY = item.rect.y + item.rect.h;
    } else if ('x' in item && 'y' in item && 'scaleX' in item) {
      // Product instance
      const prod = resolveProductForInstance(item, products);
      if (prod) {
        const w = prod.width_in * ppi * item.scaleX;
        const h = prod.height_in * ppi * item.scaleY;
        if (item.x + w > maxX) maxX = item.x + w;
        if (item.y + h > maxY) maxY = item.y + h;
      }
    }
  });

  const width_px = maxX + 100;
  const height_px = maxY + 100;

  const issues = validateLayout(instances, entities, products, ppi);

  return {
    wall,
    width_px,
    height_px,
    pixelsPerInch: ppi,
    openings,
    obstructions,
    annotations,
    measures,
    products: mappedProducts,
    issues
  };
}