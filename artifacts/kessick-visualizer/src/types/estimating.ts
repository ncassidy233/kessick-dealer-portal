export type EstimateStatus = 'draft' | 'internal-review' | 'sent' | 'accepted' | 'declined' | 'expired' | 'superseded';

export interface EstimateLine {
  id: string;
  sourceId?: string; // e.g. SKU or entity ID
  sourceKind?: 'catalog-product' | 'catalog-lighting' | 'manual';
  category: string; // 'Product', 'Site Prep', 'Installation', etc.
  description: string;
  sku?: string;
  qty: number;
  unit: string; // 'ea', 'LF', 'SF', 'hr', 'ls'
  materialAllowance: number | null; // null = TBD
  laborAllowance: number | null; // null = TBD
  isOptional: boolean; // Not part of the base total if true, unless selected? Actually, let's say isAlternate
  isAlternate: boolean; 
  notes: string;
}

export interface EstimateMarkup {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  appliesTo: 'material' | 'labor' | 'overall';
}

export interface EstimateTax {
  jurisdiction: string;
  rate: number; // percentage, e.g. 7.5
  appliesToMaterial: boolean;
  appliesToLabor: boolean;
  appliesToFreight: boolean;
}

export interface EstimateRevisionSnapshot {
  id: string;
  date: string;
  snapshot: any; // Omit recursive types for simplicity, we cast on read
  status: EstimateStatus;
}

export interface Estimate {
  id: string;
  name: string;
  optionId: string | null;
  status: EstimateStatus;
  lines: EstimateLine[];
  markups: EstimateMarkup[];
  tax: EstimateTax;
  freight: number | null; // null = TBD
  exclusions: string[];
  assumptions: string[];
  validityDays: number;
  paymentTerms: string;
  revisions: EstimateRevisionSnapshot[];
  lastUpdated: number;
}

export const DEFAULT_ESTIMATE_TAX = (): EstimateTax => ({
  jurisdiction: 'Default',
  rate: 0,
  appliesToMaterial: true,
  appliesToLabor: false,
  appliesToFreight: false,
});
