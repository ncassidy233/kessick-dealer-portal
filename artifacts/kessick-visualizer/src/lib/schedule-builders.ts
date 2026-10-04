import { ProductInstance } from '@/types/design';
import { Product } from '@/hooks/use-products';
import { SurveyEntity, OpeningEntity, ObstructionEntity } from '@/types/survey';
import { reconcileInstance } from './catalog-domain';

export interface ScheduleItem {
  id: string; // SKU or entity ID
  qty: number;
  product?: Product;
  instance?: ProductInstance; // representative instance for finishes
  entity?: SurveyEntity;
  notes: string[];
  catalogWarnings?: string[];
}

export function buildProductSchedule(instances: ProductInstance[], products: Product[]): ScheduleItem[] {
  const map = new Map<string, ScheduleItem>();
  for (const inst of instances) {
    const reconciled = reconcileInstance(inst, products);
    const prod = reconciled.product;
    if (!prod) continue;
    const key = `${prod.catalog_release.id}:${prod.catalog_release.version}:${prod.sku}`;
    if (!map.has(key)) {
      map.set(key, { id: key, qty: 0, product: prod, instance: inst, notes: [], catalogWarnings: reconciled.warnings.map(warning => warning.message) });
    }
    map.get(key)!.qty += 1;
  }
  return Array.from(map.values()).sort((a, b) => (a.product?.sku || '').localeCompare(b.product?.sku || ''));
}

export function buildFinishSchedule(instances: ProductInstance[], products: Product[]): ScheduleItem[] {
  const map = new Map<string, ScheduleItem>();
  for (const inst of instances) {
    const reconciled = reconcileInstance(inst, products);
    const prod = reconciled.product;
    if (!prod) continue;
    
    // Group by SKU + finishes
    const mat = inst.finishSelection?.material || 'Standard';
    const fin = inst.finishSelection?.finish || 'Standard';
    const hw = inst.finishSelection?.hardware || 'Standard';
    const key = `${prod.catalog_release.id}:${prod.catalog_release.version}:${prod.sku}-${mat}-${fin}-${hw}`;
    
    if (!map.has(key)) {
      map.set(key, { id: key, qty: 0, product: prod, instance: inst, notes: [], catalogWarnings: reconciled.warnings.map(warning => warning.message) });
    }
    map.get(key)!.qty += 1;
  }
  return Array.from(map.values()).sort((a, b) => (a.product?.sku || '').localeCompare(b.product?.sku || ''));
}

export function buildLightingSchedule(instances: ProductInstance[], products: Product[]): ScheduleItem[] {
  const map = new Map<string, ScheduleItem>();
  for (const inst of instances) {
    if (!inst.lighting?.enabled) continue;
    const reconciled = reconcileInstance(inst, products);
    const prod = reconciled.product;
    if (!prod) continue;
    
    const type = inst.lighting.type;
    const color = inst.lighting.colorTemp;
    const key = `${prod.catalog_release.id}:${prod.catalog_release.version}:${prod.sku}-${type}-${color}`;
    
    if (!map.has(key)) {
      map.set(key, { id: key, qty: 0, product: prod, instance: inst, notes: [], catalogWarnings: reconciled.warnings.map(warning => warning.message) });
    }
    map.get(key)!.qty += 1;
  }
  return Array.from(map.values()).sort((a, b) => (a.product?.sku || '').localeCompare(b.product?.sku || ''));
}

export function buildOpeningSchedule(entities: SurveyEntity[]): ScheduleItem[] {
  return entities
    .filter((e): e is OpeningEntity => e.type === 'opening')
    .map(e => ({
      id: e.id,
      qty: 1,
      entity: e,
      notes: [`${e.openingType}`.toUpperCase()]
    }));
}

export function buildObstructionSchedule(entities: SurveyEntity[]): ScheduleItem[] {
  return entities
    .filter((e): e is ObstructionEntity => e.type === 'obstruction')
    .map(e => ({
      id: e.id,
      qty: 1,
      entity: e,
      notes: [`${e.obstructionType}`.toUpperCase()]
    }));
}