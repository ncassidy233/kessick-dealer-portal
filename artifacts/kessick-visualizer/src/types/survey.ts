export type SurveyPoint = { x: number; y: number };

export interface ProjectMetadata {
  id: string;
  name: string;
  client: string;
  address: string;
  surveyor: string;
  surveyDate: string;
  notes: string;
}

export type EntityType = 'wall' | 'opening' | 'obstruction' | 'annotation' | 'measure';

export interface BaseEntity {
  id: string;
  type: EntityType;
}

export interface WallEntity extends BaseEntity {
  type: 'wall';
  points: SurveyPoint[]; // Polyline
}

export interface OpeningEntity extends BaseEntity {
  type: 'opening';
  rect: { x: number; y: number; w: number; h: number };
  openingType: 'door' | 'window' | 'pass-through';
}

export interface ObstructionEntity extends BaseEntity {
  type: 'obstruction';
  rect: { x: number; y: number; w: number; h: number };
  obstructionType: 'outlet' | 'switch' | 'HVAC' | 'pipe' | 'column' | 'other';
}

export interface AnnotationEntity extends BaseEntity {
  type: 'annotation';
  point: SurveyPoint;
  text: string;
  severity: 'info' | 'warning' | 'danger';
}

export interface MeasureEntity extends BaseEntity {
  type: 'measure';
  start: SurveyPoint;
  end: SurveyPoint;
}

export type SurveyEntity = WallEntity | OpeningEntity | ObstructionEntity | AnnotationEntity | MeasureEntity;

export interface CalibrationRecord {
  p1: SurveyPoint;
  p2: SurveyPoint;
  realLength: number;
  type: 'reference' | 'wall_height';
}

export type SurveyMode = 'select' | 'pan' | 'calibrate' | 'measure' | 'wall' | 'opening' | 'obstruction' | 'annotation';
