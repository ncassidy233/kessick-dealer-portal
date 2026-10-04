export type IssueStatus = 'draft' | 'for-review' | 'issued' | 'superseded';

export interface Revision {
  id: string;
  number: string;
  date: string;
  description: string;
}

export interface ConstructionDocument {
  status: IssueStatus;
  issueDate: string;
  issuedBy: string;
  drawingScale: string;
  revisions: Revision[];
  generalNotes: string;
  selectedOptionId: string | null;
}

export const DEFAULT_GENERAL_NOTES = `1. FIELD VERIFY ALL DIMENSIONS AND EXISTING CONDITIONS PRIOR TO FABRICATION OR INSTALLATION.
2. WRITTEN DIMENSIONS GOVERN OVER SCALED DRAWINGS.
3. COORDINATE POWER AND LIGHTING REQUIREMENTS WITH ELECTRICAL CONTRACTOR.
4. MAINTAIN REQUIRED CLEARANCES AROUND OBSTRUCTIONS AS SHOWN.
5. VERIFY CRITICAL SKUS AGAINST CURRENT KESSICK DOCUMENTS AND SPECIFICATIONS.
6. THIS VISUALIZATION IS INTENDED FOR DESIGN INTENT ONLY AND IS NOT A SUBSTITUTE FOR ENGINEERED SHOP DRAWINGS.`;

export const DEFAULT_CONSTRUCTION_DOCUMENT = (): ConstructionDocument => ({
  status: 'draft',
  issueDate: new Date().toISOString().split('T')[0],
  issuedBy: '',
  drawingScale: 'NTS',
  revisions: [],
  generalNotes: DEFAULT_GENERAL_NOTES,
  selectedOptionId: null,
});