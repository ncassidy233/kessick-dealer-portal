import { expect, test } from '@playwright/test';
import { getLightingCapabilities } from '../../src/lib/catalog-domain';
import { createOrUpdateEstimate } from '../../src/lib/estimate-builders';
import type { Product } from '../../src/types/catalog';
import type { DesignOption, ProductInstance } from '../../src/types/design';
import type { Estimate, EstimateLine } from '../../src/types/estimating';

const SKU = '1877.ET.R-P';

function product(releaseId: string, releaseVersion: string): Product {
  return {
    id: 'tower-1877-et-r-p',
    sku: SKU,
    name: 'Kessick Tower 1877.ET.R-P',
    series: 'Tower Series',
    category: 'tower',
    bottle_capacity: 73,
    width_in: 18,
    height_in: 77.25,
    depth_in: 11.75,
    image_url: '',
    thumbnail_url: '',
    customizable: false,
    gallery: [],
    provenance: { confidence: 'verified' },
    confidence: 'verified',
    warnings: [],
    catalog_release: {
      id: releaseId,
      version: releaseVersion,
      capturedAt: '2026-09-09T00:00:00.000Z',
    },
  };
}

function placement(item: Product, instanceId: string, withSnapshot = true): ProductInstance {
  return {
    instanceId,
    productId: item.id,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1,
    ...(withSnapshot ? {
      productSnapshot: {
        release: item.catalog_release,
        product: item,
        capturedAt: '2026-09-09T00:00:00.000Z',
      },
    } : {}),
  };
}

function option(instances: ProductInstance[]): DesignOption {
  return {
    id: 'option-1',
    name: 'Option 1',
    status: 'concept',
    instances,
    clientNotes: '',
    presentationSettings: {
      showDimensions: true,
      showClearances: true,
      showLighting: true,
    },
  };
}

function existingEstimate(lines: EstimateLine[]): Estimate {
  return {
    id: 'estimate-1',
    name: 'Estimate',
    optionId: 'option-1',
    status: 'draft',
    lines,
    markups: [],
    tax: {
      jurisdiction: 'Default',
      rate: 0,
      appliesToMaterial: true,
      appliesToLabor: false,
      appliesToFreight: false,
    },
    freight: null,
    exclusions: [],
    assumptions: [],
    validityDays: 30,
    paymentTerms: '',
    revisions: [],
    lastUpdated: 0,
  };
}

test('migrates one legacy SKU line only once across mixed catalog releases', () => {
  const releaseA = product('release-a', 'A');
  const releaseB = product('release-b', 'B');
  const legacyLine: EstimateLine = {
    id: 'legacy-line',
    sourceId: SKU,
    category: 'Product',
    description: releaseA.name,
    sku: SKU,
    qty: 2,
    unit: 'ea',
    materialAllowance: 100,
    laborAllowance: 25,
    isOptional: false,
    isAlternate: false,
    notes: 'Dealer-entered legacy allowance.',
  };

  const estimate = createOrUpdateEstimate(
    existingEstimate([legacyLine]),
    option([placement(releaseA, 'a'), placement(releaseB, 'b')]),
    [releaseB],
    'Estimate',
  );
  const productLines = estimate.lines.filter(line => line.sourceKind === 'catalog-product');

  expect(productLines).toHaveLength(2);
  expect(new Set(productLines.map(line => line.id)).size).toBe(2);
  expect(productLines.filter(line => line.id === 'legacy-line')).toHaveLength(1);
  expect(productLines.reduce((total, line) => total + line.qty, 0)).toBe(2);
  expect(productLines.filter(line => line.materialAllowance === 100)).toHaveLength(1);
  expect(productLines.find(line => line.id !== 'legacy-line')?.materialAllowance).toBeNull();
  expect(productLines.find(line => line.id !== 'legacy-line')?.notes).toContain('review this release separately');
});

test('replaces an obsolete generated release line and remains stable on repeated updates', () => {
  const current = product('release-b', 'B');
  const obsoleteLine: EstimateLine = {
    id: 'generated-line',
    sourceId: `release-a:A:${SKU}`,
    category: 'Product',
    description: current.name,
    sku: SKU,
    qty: 1,
    unit: 'ea',
    materialAllowance: 200,
    laborAllowance: 50,
    isOptional: false,
    isAlternate: false,
    notes: 'Approved dealer allowance.',
  };
  const manualLine: EstimateLine = {
    id: 'manual-line',
    sourceKind: 'manual',
    category: 'Installation',
    description: 'Installation',
    qty: 1,
    unit: 'ls',
    materialAllowance: null,
    laborAllowance: 500,
    isOptional: false,
    isAlternate: false,
    notes: '',
  };
  const design = option([placement(current, 'current', false)]);

  const updated = createOrUpdateEstimate(
    existingEstimate([obsoleteLine, manualLine]),
    design,
    [current],
    'Estimate',
  );
  const repeated = createOrUpdateEstimate(updated, design, [current], 'Estimate');
  const productLines = repeated.lines.filter(line => line.sourceKind === 'catalog-product');

  expect(productLines).toHaveLength(1);
  expect(productLines[0]).toMatchObject({
    id: 'generated-line',
    sourceId: `release-b:B:${SKU}`,
    qty: 1,
    materialAllowance: 200,
    laborAllowance: 50,
  });
  expect(repeated.lines.filter(line => line.id === 'manual-line')).toHaveLength(1);
  expect(new Set(repeated.lines.map(line => line.id)).size).toBe(repeated.lines.length);
});

test('reserves retained release lines before assigning a new same-SKU release', () => {
  const releaseA = product('release-a', 'A');
  const releaseB = product('release-b', 'B');
  const releaseC = product('release-c', 'C');
  const generatedLine = (item: Product, amount: number): EstimateLine => ({
    id: `line-${item.catalog_release.version}`,
    sourceId: `${item.catalog_release.id}:${item.catalog_release.version}:${SKU}`,
    sourceKind: 'catalog-product',
    category: 'Product',
    description: item.name,
    sku: SKU,
    qty: 1,
    unit: 'ea',
    materialAllowance: amount,
    laborAllowance: amount / 2,
    isOptional: item.catalog_release.version === 'B',
    isAlternate: false,
    notes: `Release ${item.catalog_release.version}`,
  });

  const estimate = createOrUpdateEstimate(
    existingEstimate([generatedLine(releaseA, 100), generatedLine(releaseB, 200)]),
    option([
      placement(releaseC, 'c'),
      placement(releaseA, 'a'),
      placement(releaseB, 'b'),
    ]),
    [releaseC],
    'Estimate',
  );
  const byVersion = new Map(
    estimate.lines
      .filter(line => line.sourceKind === 'catalog-product')
      .map(line => [line.sourceId?.split(':')[1], line]),
  );

  expect(byVersion.get('A')).toMatchObject({
    id: 'line-A',
    materialAllowance: 100,
    laborAllowance: 50,
    notes: 'Release A',
  });
  expect(byVersion.get('B')).toMatchObject({
    id: 'line-B',
    materialAllowance: 200,
    laborAllowance: 100,
    isOptional: true,
    notes: 'Release B',
  });
  expect(byVersion.get('C')?.materialAllowance).toBeNull();
  expect(new Set(estimate.lines.map(line => line.id)).size).toBe(estimate.lines.length);
});

test('reserves retained lighting lines before assigning a new release', () => {
  const releases = [
    product('release-c', 'C'),
    product('release-a', 'A'),
    product('release-b', 'B'),
  ];
  const instances = releases.map((item, index) => ({
    ...placement(item, `light-${index}`),
    lighting: {
      enabled: true,
      type: 'led_strip' as const,
      colorTemp: '3000K' as const,
      intensity: 80,
      dimming: true,
      notes: '',
    },
  }));
  const existingLighting = [releases[1], releases[2]].map((item, index): EstimateLine => ({
    id: `lighting-${item.catalog_release.version}`,
    sourceId: `light-${item.catalog_release.id}:${item.catalog_release.version}:${SKU}-led_strip-3000K`,
    sourceKind: 'catalog-lighting',
    category: 'Lighting',
    description: 'Lighting: led strip - 3000K',
    sku: SKU,
    qty: 1,
    unit: 'ea',
    materialAllowance: (index + 1) * 10,
    laborAllowance: (index + 1) * 5,
    isOptional: false,
    isAlternate: false,
    notes: `Lighting ${item.catalog_release.version}`,
  }));

  const estimate = createOrUpdateEstimate(
    existingEstimate(existingLighting),
    option(instances),
    [releases[0]],
    'Estimate',
  );
  const lightingByVersion = new Map(
    estimate.lines
      .filter(line => line.sourceKind === 'catalog-lighting')
      .map(line => [line.sourceId?.split(':')[1], line]),
  );

  expect(lightingByVersion.get('A')).toMatchObject({
    id: 'lighting-A',
    materialAllowance: 10,
    laborAllowance: 5,
  });
  expect(lightingByVersion.get('B')).toMatchObject({
    id: 'lighting-B',
    materialAllowance: 20,
    laborAllowance: 10,
  });
  expect(lightingByVersion.get('C')?.materialAllowance).toBeNull();
});

test('does not infer lighting support from fully assembled cabinetry', () => {
  const assembled = {
    ...product('release-a', 'A'),
    features: ['Fully assembled semi-custom wine cabinetry'],
  };
  const illuminated = {
    ...product('release-b', 'B'),
    features: ['Optional LED display lighting'],
  };

  expect(getLightingCapabilities(assembled)).toEqual([]);
  expect(getLightingCapabilities(illuminated)).toEqual(['Optional LED display lighting']);
});