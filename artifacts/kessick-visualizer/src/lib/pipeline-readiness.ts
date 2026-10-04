import { AppState } from '@/store';
import { PipelineStageId } from '@/types/pipeline';
import { validateLayout } from '@/lib/design-geometry';
import { Product } from '@/hooks/use-products';

export interface StageReadiness {
  isReady: boolean;
  completionCount: number;
  totalCount: number;
  percentComplete: number;
  blockers: string[];
  warnings: string[];
  recommendedAction: string;
}

export function evaluateStageReadiness(state: AppState, stageId: PipelineStageId, products: Product[] = []): StageReadiness {
  const stage = state.pipeline.stages[stageId];
  let completionCount = 0;
  let totalCount = 0;
  const blockers: string[] = [];
  const warnings: string[] = [];
  let recommendedAction = 'Review required tasks.';

  // Check tasks
  if (stage) {
    stage.tasks.forEach(t => {
      if (t.isRequired) {
        totalCount++;
        if (t.isCompleted) completionCount++;
        else blockers.push(`Incomplete task: ${t.title}`);
      }
    });
  }

  // Gate Criteria overrides tasks if present, but we still calculate derived state
  
  if (stageId === 'site-survey') {
    totalCount += 2;
    if (state.roomImageDataUrl && state.calibration) {
      completionCount++;
    } else {
      blockers.push('Missing calibrated room image.');
      recommendedAction = 'Upload and calibrate a room image.';
    }
    
    if (state.entities.length > 0) {
      completionCount++;
    } else {
      blockers.push('No walls or obstacles mapped.');
      recommendedAction = 'Draw walls and add obstructions in Survey tab.';
    }
  }
  
  if (stageId === 'design') {
    totalCount += 2;
    const hasInstances = state.activeOption.instances.length > 0;
    if (hasInstances) {
      completionCount++;
    } else {
      blockers.push('Design option is empty.');
      recommendedAction = 'Add products in the Design tab.';
    }

    if (hasInstances && state.pixelsPerInch) {
      const issues = validateLayout(state.activeOption.instances, state.entities, products, state.pixelsPerInch);
      const criticalIssues = issues.filter(i => i.severity === 'danger');
      if (criticalIssues.length === 0) {
        completionCount++;
      } else {
        blockers.push(`${criticalIssues.length} critical layout collisions.`);
        recommendedAction = 'Resolve layout collisions in Design tab.';
      }
      if (issues.length > criticalIssues.length) {
        warnings.push(`${issues.length - criticalIssues.length} layout warnings.`);
      }
    } else {
      blockers.push('Cannot validate layout without products and calibration.');
    }
  }

  if (stageId === 'client-approval') {
    totalCount += 2;
    if (state.activeOption.status === 'approved') {
      completionCount++;
    } else {
      blockers.push('Design Option is not marked Approved.');
      recommendedAction = 'Set Design Option status to Approved.';
    }
    
    const hasDesignApproval = state.pipeline.approvals.some(a => a.type === 'design' && a.referenceId === state.activeOptionId);
    if (hasDesignApproval) {
      completionCount++;
    } else {
      blockers.push('Missing explicit Design Approval record.');
      recommendedAction = 'Record Client Approval in Pipeline -> Client Approval.';
    }
  }

  if (stageId === 'construction-documents') {
    totalCount += 2;
    if (state.constructionDocument.status === 'issued') {
      completionCount++;
    } else {
      blockers.push('Construction Documents not Issued.');
      recommendedAction = 'Issue documents in Construction Documents modal.';
    }
    
    if (state.constructionDocument.selectedOptionId === state.activeOptionId) {
      completionCount++;
    } else {
      warnings.push('Issued document does not match active design option.');
    }
  }

  if (stageId === 'estimate-proposal') {
    totalCount += 2;
    if (state.activeEstimate && state.activeEstimate.status === 'accepted') {
      completionCount++;
    } else {
      blockers.push('No accepted estimate for this project.');
      recommendedAction = 'Create and accept an Estimate.';
    }
    
    const hasTBD = state.activeEstimate?.lines.some(l => l.materialAllowance === null || l.laborAllowance === null);
    if (!hasTBD) {
      completionCount++;
    } else {
      blockers.push('Estimate contains TBD allowances.');
      recommendedAction = 'Update Estimate to resolve TBD amounts.';
    }
  }

  if (stageId === 'installation') {
    totalCount += 1;
    const completedChecklist = state.pipeline.installRecord.checklist.filter(c => c.isCompleted).length;
    const totalChecklist = state.pipeline.installRecord.checklist.length;
    
    if (completedChecklist === totalChecklist) {
      completionCount++;
    } else {
      blockers.push(`Incomplete installation checklist (${totalChecklist - completedChecklist} remaining).`);
      recommendedAction = 'Complete all installation checklist items.';
    }
  }
  
  if (stageId === 'punch-list') {
    const openPunchItems = state.pipeline.punchItems.filter(p => p.status !== 'resolved' && p.status !== 'verified');
    const criticalPunchItems = openPunchItems.filter(p => p.severity === 'high' || p.severity === 'critical');
    
    if (criticalPunchItems.length > 0) {
      blockers.push(`${criticalPunchItems.length} critical punch items open.`);
      recommendedAction = 'Resolve critical punch list items.';
    } else if (openPunchItems.length > 0) {
      warnings.push(`${openPunchItems.length} open punch items (non-critical).`);
    } else if (state.pipeline.punchItems.length === 0) {
      warnings.push('No punch list items recorded. Ensure walkthrough occurred.');
    }
  }

  if (stageId === 'closeout-warranty') {
    totalCount += 1;
    if (state.pipeline.closeoutRecord.isPackageComplete) {
      completionCount++;
    } else {
      blockers.push('Closeout package marked incomplete.');
      recommendedAction = 'Complete final closeout checklist in Pipeline.';
    }
  }

  // Handle manual override
  if (stage?.gateOverride) {
    blockers.length = 0;
    warnings.push(`Gate overridden by ${stage.gateOverride.overriddenBy}: ${stage.gateOverride.reason}`);
    recommendedAction = 'Proceed to next stage.';
  }

  const isReady = blockers.length === 0 && totalCount > 0 && completionCount === totalCount;
  const percentComplete = totalCount > 0 ? Math.round((completionCount / totalCount) * 100) : (stage?.tasks.length === 0 ? 100 : 0);

  if (isReady && !stage?.gateOverride) {
    recommendedAction = 'Ready to complete stage.';
  }

  return {
    isReady,
    completionCount,
    totalCount,
    percentComplete: stage?.gateOverride ? 100 : percentComplete,
    blockers,
    warnings,
    recommendedAction
  };
}
