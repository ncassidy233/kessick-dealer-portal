import type { ScheduleItem } from './schedule-builders';
import type { Estimate } from '@/types/estimating';
import { escapeCsvCell } from './csv-safety';

export function exportCsv(filename: string, headers: string[], rows: (string | number | undefined | null)[][]) {
  const csvContent = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map(row => row.map(escapeCsvCell).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportSchedulesCsv(
  projectName: string,
  productSchedule: ScheduleItem[],
  finishSchedule: ScheduleItem[],
  lightingSchedule: ScheduleItem[],
  openingSchedule: ScheduleItem[],
  obstructionSchedule: ScheduleItem[]
) {
  const prefix = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  // Export Consolidated Takeoff
  const consolidatedRows = [
    ...productSchedule.map(s => ['Product', s.product?.sku, s.product?.name, s.qty, s.product?.width_in, s.product?.height_in]),
    ...lightingSchedule.map(s => ['Lighting', s.product?.sku, s.instance?.lighting?.type, s.qty, '', '']),
  ];
  exportCsv(
    `${prefix}_consolidated_takeoff.csv`,
    ['Category', 'SKU/ID', 'Description', 'Qty', 'Width', 'Height'],
    consolidatedRows
  );

  // Export Product Schedule
  exportCsv(
    `${prefix}_product_schedule.csv`,
    ['Qty', 'SKU', 'Description', 'Series', 'Width', 'Height', 'Depth'],
    productSchedule.map(s => [
      s.qty, 
      s.product?.sku, 
      s.product?.name, 
      s.product?.series, 
      s.product?.width_in, 
      s.product?.height_in, 
      s.product?.depth_in
    ])
  );

  // Export Finish Schedule
  exportCsv(
    `${prefix}_finish_schedule.csv`,
    ['Qty', 'SKU', 'Material', 'Finish', 'Hardware'],
    finishSchedule.map(s => [
      s.qty,
      s.product?.sku,
      s.instance?.finishSelection?.material || 'Standard',
      s.instance?.finishSelection?.finish || 'Standard',
      s.instance?.finishSelection?.hardware || 'Standard'
    ])
  );

  // Export Lighting Schedule
  exportCsv(
    `${prefix}_lighting_schedule.csv`,
    ['Qty', 'SKU', 'Type', 'Color Temp', 'Intensity', 'Dimming'],
    lightingSchedule.map(s => [
      s.qty,
      s.product?.sku,
      s.instance?.lighting?.type,
      s.instance?.lighting?.colorTemp,
      s.instance?.lighting?.intensity,
      s.instance?.lighting?.dimming ? 'Yes' : 'No'
    ])
  );

  // Export Coordinate Schedule (Openings/Obstructions)
  exportCsv(
    `${prefix}_coordination_schedule.csv`,
    ['Type', 'Classification', 'Width', 'Height', 'X', 'Y', 'Notes'],
    [
      ...openingSchedule.map(s => [
        'Opening',
        s.entity?.type === 'opening' ? s.entity.openingType : '',
        s.entity?.type === 'opening' ? s.entity.rect.w : '',
        s.entity?.type === 'opening' ? s.entity.rect.h : '',
        s.entity?.type === 'opening' ? s.entity.rect.x : '',
        s.entity?.type === 'opening' ? s.entity.rect.y : '',
        s.notes.join('; ')
      ]),
      ...obstructionSchedule.map(s => [
        'Obstruction',
        s.entity?.type === 'obstruction' ? s.entity.obstructionType : '',
        s.entity?.type === 'obstruction' ? s.entity.rect.w : '',
        s.entity?.type === 'obstruction' ? s.entity.rect.h : '',
        s.entity?.type === 'obstruction' ? s.entity.rect.x : '',
        s.entity?.type === 'obstruction' ? s.entity.rect.y : '',
        s.notes.join('; ')
      ])
    ]
  );
}

export function exportEstimateCsv(projectName: string, estimate: Estimate) {
  const prefix = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  
  const headers = [
    'Revision', 'Option ID', 'Scope/Category', 'Source SKU', 'Description', 'Qty', 'Unit', 
    'Material Allowance', 'Labor Allowance', 'Line Total', 'Included/Alt', 'TBD Status', 'Notes'
  ];

  const revisionCount = estimate.revisions.length;

  const rows = estimate.lines.map(line => {
    const isTbd = line.materialAllowance === null || line.laborAllowance === null;
    let lineTotal: number | string = 'TBD';
    if (!isTbd) {
      lineTotal = ((line.materialAllowance || 0) + (line.laborAllowance || 0)) * line.qty;
    }

    return [
      revisionCount,
      estimate.optionId || '',
      line.category,
      line.sku || line.sourceId || '',
      line.description,
      line.qty,
      line.unit,
      line.materialAllowance !== null ? line.materialAllowance : 'TBD',
      line.laborAllowance !== null ? line.laborAllowance : 'TBD',
      lineTotal,
      line.isAlternate ? 'Alternate' : 'Included',
      isTbd ? 'Incomplete' : 'Complete',
      line.notes || ''
    ];
  });

  exportCsv(`${prefix}_estimate_${estimate.id.substring(0,6)}.csv`, headers, rows);
}