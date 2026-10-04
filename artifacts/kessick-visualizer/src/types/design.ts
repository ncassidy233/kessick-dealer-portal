import type { AuthorizedPriceSnapshot, CatalogProductSnapshot } from './catalog';

export interface FinishSelection {
  material?: string;
  finish?: string;
  hardware?: string;
}

export interface LightingPlan {
  enabled: boolean;
  type: 'led_strip' | 'puck' | 'spot' | 'none';
  colorTemp: '2700K' | '3000K' | '4000K' | '6000K';
  intensity: number; // 0-100
  dimming: boolean;
  notes: string;
}

export interface ProductInstance {
  instanceId: string;
  productId: string;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  opacity: number;
  customSized?: boolean;
  /** Immutable references captured when the item was placed. */
  productSnapshot?: CatalogProductSnapshot;
  priceSnapshot?: AuthorizedPriceSnapshot;
  catalogReconciliationRequired?: boolean;
  
  // Design properties
  finishSelection?: FinishSelection;
  lighting?: LightingPlan;
  wallId?: string; // which wall it is anchored to
}

export type OptionStatus = 'concept' | 'review' | 'approved';

export interface DesignOption {
  id: string;
  name: string;
  status: OptionStatus;
  instances: ProductInstance[];
  clientNotes: string;
  presentationSettings: {
    showDimensions: boolean;
    showClearances: boolean;
    showLighting: boolean;
  };
}
