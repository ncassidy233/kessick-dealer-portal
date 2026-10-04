import { Estimate } from '@/types/estimating';

export interface EstimateTotals {
  materialTotal: number;
  laborTotal: number;
  subcontractTotal: number;
  freightTotal: number;
  taxTotal: number;
  grandTotal: number;
  isComplete: boolean;
  tbdCount: number;
}

export function calculateEstimateTotals(estimate: Estimate | null): EstimateTotals {
  if (!estimate) {
    return {
      materialTotal: 0,
      laborTotal: 0,
      subcontractTotal: 0,
      freightTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      isComplete: false,
      tbdCount: 0
    };
  }

  let material = 0;
  let labor = 0;
  let tbdCount = 0;

  for (const line of estimate.lines) {
    if (line.isAlternate) continue;

    if (line.materialAllowance === null) {
      tbdCount++;
    } else {
      material += (line.materialAllowance * line.qty);
    }

    if (line.laborAllowance === null) {
      tbdCount++;
    } else {
      labor += (line.laborAllowance * line.qty);
    }
  }

  // Calculate markups
  let markupMaterial = 0;
  let markupLabor = 0;
  let markupOverall = 0;

  for (const mu of estimate.markups) {
    if (mu.type === 'percentage') {
      if (mu.appliesTo === 'material') markupMaterial += material * (mu.value / 100);
      else if (mu.appliesTo === 'labor') markupLabor += labor * (mu.value / 100);
      else if (mu.appliesTo === 'overall') markupOverall += (material + labor) * (mu.value / 100);
    } else {
      // fixed
      if (mu.appliesTo === 'material') markupMaterial += mu.value;
      else if (mu.appliesTo === 'labor') markupLabor += mu.value;
      else if (mu.appliesTo === 'overall') markupOverall += mu.value;
    }
  }

  material += markupMaterial;
  labor += markupLabor;
  const overallMarkup = markupOverall;

  let freight = estimate.freight;
  if (freight === null) {
    tbdCount++;
    freight = 0;
  }

  let tax = 0;
  if (estimate.tax.rate > 0) {
    const taxableAmount = 
      (estimate.tax.appliesToMaterial ? material : 0) +
      (estimate.tax.appliesToLabor ? labor : 0) +
      (estimate.tax.appliesToFreight ? freight : 0) +
      ((estimate.tax.appliesToMaterial || estimate.tax.appliesToLabor) ? overallMarkup : 0);
    
    tax = taxableAmount * (estimate.tax.rate / 100);
  }

  const grandTotal = material + labor + overallMarkup + freight + tax;

  return {
    materialTotal: material,
    laborTotal: labor,
    subcontractTotal: 0,
    freightTotal: freight,
    taxTotal: tax,
    grandTotal,
    isComplete: tbdCount === 0,
    tbdCount
  };
}
