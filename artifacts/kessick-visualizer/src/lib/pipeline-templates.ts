import { v4 as uuidv4 } from 'uuid';
import { 
  PipelineState, 
  PipelineStageId, 
  PipelineStage, 
  InstallChecklistItem,
  PipelineTask
} from '@/types/pipeline';

const STAGE_IDS: PipelineStageId[] = [
  'lead-intake',
  'site-survey',
  'design',
  'client-approval',
  'construction-documents',
  'estimate-proposal',
  'procurement-ready',
  'installation',
  'punch-list',
  'closeout-warranty'
];

function createDefaultTask(title: string, description: string, isRequired: boolean): PipelineTask {
  return {
    id: uuidv4(),
    title,
    description,
    isCompleted: false,
    isRequired,
    owner: '',
    dueDate: '',
    completedDate: '',
    completedBy: '',
    evidenceLink: ''
  };
}

function getTasksForStage(stage: PipelineStageId): PipelineTask[] {
  switch (stage) {
    case 'lead-intake':
      return [
        createDefaultTask('Initial Client Consultation', 'Understand budget, timeline, and capacity needs.', true),
        createDefaultTask('Site Details Collected', 'Gather address, access info, and preliminary dimensions.', true),
        createDefaultTask('Project Folder Created', 'Initialize shared folders for assets and references.', false)
      ];
    case 'site-survey':
      return [
        createDefaultTask('Field Verification', 'Perform on-site measurement and photo documentation.', true),
        createDefaultTask('Calibrate Room Image', 'Upload and calibrate the reference wall/floor image.', true),
        createDefaultTask('Obstructions Mapped', 'Map HVAC, outlets, plumbing, and structural elements.', true)
      ];
    case 'design':
      return [
        createDefaultTask('Concept Layout', 'Generate initial layout options within Kessick standards.', true),
        createDefaultTask('Design Validation', 'Check clearances, collisions, and capacity targets.', true),
        createDefaultTask('Lighting Plan', 'Specify LED, puck, or spot lighting routing.', false)
      ];
    case 'client-approval':
      return [
        createDefaultTask('Present Design', 'Review design options and pricing estimates with client.', true),
        createDefaultTask('Formal Approval', 'Secure written sign-off on design and finishes.', true),
        createDefaultTask('Deposit Collected', 'Receive initial payment to proceed to production.', true)
      ];
    case 'construction-documents':
      return [
        createDefaultTask('Generate Elevations', 'Produce scaled elevation drawings.', true),
        createDefaultTask('Add General Notes', 'Include site-specific installation instructions.', true),
        createDefaultTask('Issue for Review', 'Send documents for internal or architect review.', true)
      ];
    case 'estimate-proposal':
      return [
        createDefaultTask('Verify SKUs', 'Confirm all product SKUs and finishes are accurate.', true),
        createDefaultTask('Labor & Site Prep', 'Estimate non-material costs accurately.', true),
        createDefaultTask('Client Accepted', 'Proposal accepted with signature.', true)
      ];
    case 'procurement-ready':
      return [
        createDefaultTask('Purchase Orders Issued', 'Send POs to Kessick and third-party vendors.', true),
        createDefaultTask('Long-Lead Review', 'Identify items that could delay the project.', true),
        createDefaultTask('Delivery Scheduled', 'Coordinate site delivery dates with client.', true)
      ];
    case 'installation':
      return [
        createDefaultTask('Site Readiness Check', 'Confirm site prep is complete before unloading.', true),
        createDefaultTask('Floor/Wall Protection', 'Install protective coverings.', true),
        createDefaultTask('Anchoring & Blocking', 'Verify structural support for wine racks.', true),
        createDefaultTask('Lighting Test', 'Test all low-voltage connections before sealing.', true),
        createDefaultTask('Cleanup', 'Remove all packaging and debris.', true)
      ];
    case 'punch-list':
      return [
        createDefaultTask('Internal Walkthrough', 'Identify any defects or missing items.', true),
        createDefaultTask('Client Walkthrough', 'Review installation with client.', true),
        createDefaultTask('Punch Resolution', 'Address all logged punch items.', true)
      ];
    case 'closeout-warranty':
      return [
        createDefaultTask('Final Payment', 'Collect final invoice balance.', true),
        createDefaultTask('As-Builts Provided', 'Hand over final as-built drawings if requested.', false),
        createDefaultTask('Care & Warranty Docs', 'Provide wood and finish care instructions.', true)
      ];
    default:
      return [];
  }
}

function getDefaultInstallChecklist(): InstallChecklistItem[] {
  const items = [
    { cat: 'prep', desc: 'Confirm room temperature/humidity controls are operational.' },
    { cat: 'protection', desc: 'Lay down floor protection (ram board/rosin paper).' },
    { cat: 'verification', desc: 'Verify field measurements against approved Construction Documents.' },
    { cat: 'installation', desc: 'Locate and mark all studs/blocking.' },
    { cat: 'installation', desc: 'Install base/kickboards level and plumb.' },
    { cat: 'installation', desc: 'Assemble and secure racking units per Kessick instructions.' },
    { cat: 'finish', desc: 'Install trim, crown molding, and filler panels.' },
    { cat: 'finish', desc: 'Touch up any exposed brad nail holes or scratches.' },
    { cat: 'cleanup', desc: 'Vacuum all sawdust and wipe down racking.' }
  ];
  return items.map(item => ({
    id: uuidv4(),
    category: item.cat as any,
    description: item.desc,
    isCompleted: false,
    completedBy: '',
    date: ''
  }));
}

export function createDefaultPipelineState(): PipelineState {
  const stages = {} as Record<PipelineStageId, PipelineStage>;
  
  STAGE_IDS.forEach(id => {
    stages[id] = {
      id,
      status: id === 'lead-intake' ? 'in-progress' : 'pending',
      owner: '',
      startDate: '',
      dueDate: '',
      completedDate: '',
      tasks: getTasksForStage(id)
    };
  });

  return {
    stages,
    approvals: [],
    risks: [],
    installRecord: {
      crewLead: '',
      scheduledDate: '',
      deliveryDate: '',
      dailyNotes: '',
      checklist: getDefaultInstallChecklist()
    },
    punchItems: [],
    closeoutRecord: {
      finalAcceptanceDate: '',
      asBuiltLink: '',
      careDocumentLink: '',
      warrantyProvider: 'Kessick Wine Cellars',
      warrantyStartDate: '',
      warrantyEndDate: '',
      serialNotes: '',
      handoffDate: '',
      finalPaymentNote: '',
      isPackageComplete: false
    },
    activity: [],
    preferences: {
      dashboardView: 'compact'
    }
  };
}
