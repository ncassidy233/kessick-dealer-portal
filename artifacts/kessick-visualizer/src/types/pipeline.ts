export type PipelineStageId = 
  | 'lead-intake'
  | 'site-survey'
  | 'design'
  | 'client-approval'
  | 'construction-documents'
  | 'estimate-proposal'
  | 'procurement-ready'
  | 'installation'
  | 'punch-list'
  | 'closeout-warranty';

export type StageStatus = 'pending' | 'in-progress' | 'completed' | 'blocked';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface PipelineTask {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  isRequired: boolean;
  owner: string;
  dueDate: string;
  completedDate: string;
  completedBy: string;
  evidenceLink: string;
}

export interface PipelineGateOverride {
  reason: string;
  overriddenBy: string;
  date: string;
}

export interface PipelineStage {
  id: PipelineStageId;
  status: StageStatus;
  owner: string;
  startDate: string;
  dueDate: string;
  completedDate: string;
  tasks: PipelineTask[];
  gateOverride?: PipelineGateOverride;
}

export interface ApprovalRecord {
  id: string;
  type: 'design' | 'estimate' | 'document' | 'other';
  approver: string;
  date: string;
  method: 'email' | 'signature' | 'verbal' | 'portal';
  referenceId: string; // optionId, documentId, estimateId
  notes: string;
}

export interface RiskRecord {
  id: string;
  title: string;
  category: 'schedule' | 'budget' | 'site' | 'client' | 'supply' | 'other';
  severity: Priority;
  owner: string;
  dueDate: string;
  status: 'open' | 'mitigated' | 'closed';
  mitigation: string;
  stageId: PipelineStageId | '';
}

export interface InstallChecklistItem {
  id: string;
  category: 'prep' | 'protection' | 'verification' | 'installation' | 'finish' | 'cleanup' | 'walkthrough';
  description: string;
  isCompleted: boolean;
  completedBy: string;
  date: string;
}

export interface InstallRecord {
  crewLead: string;
  scheduledDate: string;
  deliveryDate: string;
  dailyNotes: string;
  checklist: InstallChecklistItem[];
}

export interface PunchItem {
  id: string;
  location: string;
  description: string;
  severity: Priority;
  owner: string;
  dueDate: string;
  status: 'open' | 'resolved' | 'verified';
  evidenceLink: string;
  resolutionNote: string;
  clientVerified: boolean;
}

export interface CloseoutRecord {
  finalAcceptanceDate: string;
  asBuiltLink: string;
  careDocumentLink: string;
  warrantyProvider: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  serialNotes: string;
  handoffDate: string;
  finalPaymentNote: string;
  isPackageComplete: boolean;
}

export interface ActivityEntry {
  id: string;
  date: string;
  userId: string;
  action: string;
  details: string;
  stageId: PipelineStageId | '';
}

export interface PipelineState {
  stages: Record<PipelineStageId, PipelineStage>;
  approvals: ApprovalRecord[];
  risks: RiskRecord[];
  installRecord: InstallRecord;
  punchItems: PunchItem[];
  closeoutRecord: CloseoutRecord;
  activity: ActivityEntry[];
  preferences: {
    dashboardView: 'compact' | 'detailed';
  };
}
