import { v4 as uuidv4 } from 'uuid';
import { Estimate, EstimateLine, DEFAULT_ESTIMATE_TAX } from '@/types/estimating';
import { DesignOption } from '@/types/design';
import { Product } from '@/hooks/use-products';
import { buildProductSchedule, buildLightingSchedule } from './schedule-builders';

export function createOrUpdateEstimate(
  existing: Estimate | null,
  option: DesignOption,
  products: Product[],
  estimateName: string
): Estimate {
  
  const productSchedule = buildProductSchedule(option.instances, products);
  const lightingSchedule = buildLightingSchedule(option.instances, products);
  const plannedProductSourceIds = new Set(productSchedule.map(item => item.id));
  const plannedLightingSourceIds = new Set(lightingSchedule.map(item => `light-${item.id}`));

  const newLines: EstimateLine[] = [];
  const existingLines = existing?.lines ?? [];
  const consumedLineIds = new Set<string>();
  const takeExistingLine = (...matches: Array<(line: EstimateLine) => boolean>) => {
    for (const matchesLine of matches) {
      const match = existingLines.find(line => !consumedLineIds.has(line.id) && matchesLine(line));
      if (match) {
        consumedLineIds.add(match.id);
        return match;
      }
    }
    return undefined;
  };
  const isGeneratedProductLine = (line: EstimateLine) =>
    line.sourceKind === 'catalog-product'
    || (!line.sourceKind && line.category === 'Product' && !!line.sku && !!line.sourceId
      && (line.sourceId === line.sku || line.sourceId.includes(':')));
  const isGeneratedLightingLine = (line: EstimateLine) =>
    line.sourceKind === 'catalog-lighting'
    || (!line.sourceKind && line.category === 'Lighting' && !!line.sku && Boolean(line.sourceId?.startsWith('light-')));

  // 1. Map products
  for (const s of productSchedule) {
    const sku = s.product?.sku;
    const prev = takeExistingLine(
      line => line.sourceId === s.id || (!line.sourceId && line.id === s.id),
      line => !!sku && line.sourceId === sku,
      line => !!sku && line.sku === sku && isGeneratedProductLine(line)
        && !plannedProductSourceIds.has(line.sourceId ?? ''),
    );
    const legacySkuLineAlreadyUsed = !!sku && existingLines.some(line =>
      consumedLineIds.has(line.id) && line.sourceId === sku,
    );
    const catalogNotes = s.catalogWarnings?.length ? s.catalogWarnings.join(' ') : '';
    const allowanceMigrationNote = !prev && legacySkuLineAlreadyUsed
      ? `A legacy ${sku} allowance was already assigned to another catalog release; review this release separately.`
      : '';
    newLines.push({
      id: prev?.id || uuidv4(),
      sourceId: s.id,
      sourceKind: 'catalog-product',
      category: 'Product',
      description: s.product?.name || 'Unknown Product',
      sku,
      qty: s.qty,
      unit: 'ea',
      materialAllowance: prev ? prev.materialAllowance : (s.instance?.priceSnapshot?.unitAmount ?? null),
      laborAllowance: prev ? prev.laborAllowance : null,
      isOptional: prev ? prev.isOptional : false,
      isAlternate: prev ? prev.isAlternate : false,
      notes: prev?.notes || [catalogNotes, allowanceMigrationNote].filter(Boolean).join(' ')
    });
  }

  // 2. Map lighting
  for (const s of lightingSchedule) {
    const sourceId = `light-${s.id}`;
    const legacySourceId = s.product && s.instance?.lighting
      ? `light-${s.product.sku}-${s.instance.lighting.type}-${s.instance.lighting.colorTemp}`
      : undefined;
    const legacySuffix = legacySourceId?.slice('light-'.length);
    const prev = takeExistingLine(
      line => line.sourceId === sourceId || (!line.sourceId && line.id === sourceId),
      line => !!legacySourceId && line.sourceId === legacySourceId,
      line => !!legacySuffix && line.sku === s.product?.sku && isGeneratedLightingLine(line)
        && !plannedLightingSourceIds.has(line.sourceId ?? '')
        && Boolean(line.sourceId?.endsWith(legacySuffix)),
    );
    newLines.push({
      id: prev?.id || uuidv4(),
      sourceId,
      sourceKind: 'catalog-lighting',
      category: 'Lighting',
      description: `Lighting: ${s.instance?.lighting?.type?.replace('_', ' ')} - ${s.instance?.lighting?.colorTemp}`,
      sku: s.product?.sku,
      qty: s.qty,
      unit: 'ea',
      materialAllowance: prev ? prev.materialAllowance : null,
      laborAllowance: prev ? prev.laborAllowance : null,
      isOptional: prev ? prev.isOptional : false,
      isAlternate: prev ? prev.isAlternate : false,
      notes: prev?.notes || ''
    });
  }
  
  // 3. Retain genuinely manual lines, but remove obsolete catalog-generated
  // rows after a release or schedule change so they cannot double count.
  for (const l of existingLines) {
    if (!consumedLineIds.has(l.id) && !isGeneratedProductLine(l) && !isGeneratedLightingLine(l)) {
      newLines.push(l);
    }
  }

  // 4. If new, seed some empty manual lines
  if (!existing) {
    const manualCategories = ['Site Prep', 'Installation', 'Finishing'];
    for (const cat of manualCategories) {
      const sourceId = `manual-${cat.toLowerCase().replace(' ', '-')}`;
      newLines.push({
        id: uuidv4(),
        sourceId,
        sourceKind: 'manual',
        category: cat,
        description: `${cat} Labor & Materials`,
        qty: 1,
        unit: 'ls',
        materialAllowance: null,
        laborAllowance: null,
        isOptional: false,
        isAlternate: false,
        notes: ''
      });
    }
  }

  return {
    id: existing?.id || uuidv4(),
    name: estimateName,
    optionId: option.id,
    status: existing?.status || 'draft',
    lines: newLines,
    markups: existing?.markups || [],
    tax: existing?.tax || DEFAULT_ESTIMATE_TAX(),
    freight: existing?.freight !== undefined ? existing.freight : null,
    exclusions: existing?.exclusions || ['HVAC rough-in', 'High-voltage electrical'],
    assumptions: existing?.assumptions || ['Site is cleared and ready for installation'],
    validityDays: existing?.validityDays || 30,
    paymentTerms: existing?.paymentTerms || '50% deposit, 50% prior to shipping',
    revisions: existing?.revisions || [],
    lastUpdated: Date.now()
  };
}
