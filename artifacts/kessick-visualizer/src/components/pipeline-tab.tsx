import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { PipelineStageId } from '@/types/pipeline';
import { evaluateStageReadiness } from '@/lib/pipeline-readiness';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ApprovalManager } from './pipeline/approval-manager';
import { RiskRegister } from './pipeline/risk-register';
import { InstallManager } from './pipeline/install-manager';
import { PunchListManager } from './pipeline/punch-list-manager';
import { CloseoutManager } from './pipeline/closeout-manager';
import { 
  CheckCircle, 
  Circle, 
  AlertCircle, 
  ChevronRight,
  ShieldAlert,
  Clock,
  User,
  ShieldCheck,
  ListChecks
} from 'lucide-react';
import { format } from 'date-fns';
import { useProducts } from '@/hooks/use-products';

const STAGE_LABELS: Record<PipelineStageId, string> = {
  'lead-intake': 'Lead Intake',
  'site-survey': 'Site Survey',
  'design': 'Design',
  'client-approval': 'Client Approval',
  'construction-documents': 'Construction Docs',
  'estimate-proposal': 'Estimate & Proposal',
  'procurement-ready': 'Procurement Ready',
  'installation': 'Installation',
  'punch-list': 'Punch List',
  'closeout-warranty': 'Closeout & Warranty'
};

export function PipelineTab() {
  const store = useAppStore();
  const { data: products = [] } = useProducts();
  const [activeStageId, setActiveStageId] = useState<PipelineStageId>('lead-intake');
  const [overrideReason, setOverrideReason] = useState('');
  
  const stage = store.pipeline.stages[activeStageId];
  const readiness = evaluateStageReadiness(store, activeStageId, products);

  const handleTaskToggle = (taskId: string, completed: boolean) => {
    store.commit(s => {
      const st = s.pipeline.stages[activeStageId];
      if (!st) return s;
      st.tasks = st.tasks.map(t => t.id === taskId ? { 
        ...t, 
        isCompleted: completed, 
        completedDate: completed ? new Date().toISOString() : '',
        completedBy: completed ? store.actorName : ''
      } : t);
      return { ...s };
    });
  };

  const handleStageStatusChange = (status: 'pending' | 'in-progress' | 'completed' | 'blocked') => {
    store.commit(s => {
      const st = s.pipeline.stages[activeStageId];
      if (!st) return s;
      st.status = status;
      if (status === 'completed') {
        st.completedDate = new Date().toISOString();
      }
      return { ...s };
    });
    store.recordActivity(`Stage ${status}`, `Stage ${STAGE_LABELS[activeStageId]} marked as ${status}.`, activeStageId);
  };

  const handleOverride = () => {
    if (!overrideReason.trim()) return;
    store.commit(s => {
      const st = s.pipeline.stages[activeStageId];
      if (!st) return s;
      st.gateOverride = {
        reason: overrideReason,
        overriddenBy: store.actorName,
        date: new Date().toISOString()
      };
      return { ...s };
    });
    store.recordActivity('Gate Overridden', `Stage overridden: ${overrideReason}`, activeStageId);
    setOverrideReason('');
  };

  return (
    <div className="flex h-full w-full bg-background overflow-hidden flex-col md:flex-row">
      {/* Sidebar / Rail */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-sidebar overflow-x-auto md:overflow-y-auto shrink-0 flex flex-row md:flex-col p-2 gap-2 snap-x">
        <div className="hidden md:flex px-2 py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground justify-between items-center shrink-0">
          Project Pipeline
          <ListChecks className="w-4 h-4" />
        </div>
        {Object.entries(STAGE_LABELS).map(([id, label]) => {
          const sId = id as PipelineStageId;
          const s = store.pipeline.stages[sId];
          const r = evaluateStageReadiness(store, sId, products);
          const isActive = sId === activeStageId;
          
          return (
            <button
              key={sId}
              data-testid={`pipeline-stage-${sId}`}
              className={`flex flex-col text-left px-3 py-2  transition-colors shrink-0 snap-start w-48 md:w-auto ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
              onClick={() => setActiveStageId(sId)}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="font-semibold text-sm">{label}</span>
                {s.status === 'completed' ? (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                ) : s.status === 'blocked' ? (
                  <ShieldAlert className="w-4 h-4 text-destructive" />
                ) : s.status === 'in-progress' ? (
                  <Clock className="w-4 h-4 text-amber-500" />
                ) : (
                  <Circle className="w-4 h-4 opacity-30" />
                )}
              </div>
              <div className="flex justify-between items-center text-xs opacity-80">
                <span>{r.percentComplete}% Ready</span>
                {r.blockers.length > 0 && (
                  <span className="flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {r.blockers.length}</span>
                )}
              </div>
              {isActive && (
                <div className="w-full bg-black/20 h-1.5 mt-2 rounded-full overflow-hidden">
                  <div className="bg-current h-full" style={{ width: `${r.percentComplete}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-background space-y-6">
        
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-sans font-bold uppercase tracking-widest text-primary">{STAGE_LABELS[activeStageId]}</h2>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              Status: <span className="uppercase font-bold tracking-wider">{stage?.status}</span>
            </p>
          </div>
          <div className="flex gap-2">
            {stage?.status !== 'completed' && readiness.isReady && (
              <Button onClick={() => handleStageStatusChange('completed')} className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Complete Stage
              </Button>
            )}
            {stage?.status === 'completed' && (
              <Button variant="outline" onClick={() => handleStageStatusChange('in-progress')} className="gap-2">
                <Clock className="w-4 h-4" />
                Reopen Stage
              </Button>
            )}
          </div>
        </div>

        {/* Readiness Panel */}
        <div className="bg-card border border-border  p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Gate Criteria & Readiness</h3>
            <span className="text-sm font-bold bg-primary/10 text-primary px-2 py-1">
              {readiness.percentComplete}%
            </span>
          </div>

          <div className="space-y-2 text-sm">
            {readiness.blockers.map((b, i) => (
              <div key={i} className="flex gap-2 items-start text-destructive bg-destructive/10 p-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{b}</span>
              </div>
            ))}
            {readiness.warnings.map((w, i) => (
              <div key={i} className="flex gap-2 items-start text-amber-500 bg-amber-500/10 p-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{w}</span>
              </div>
            ))}
            {readiness.blockers.length === 0 && (
              <div className="flex gap-2 items-start text-green-500 bg-green-500/10 p-2">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <span>All gate criteria met. {readiness.recommendedAction}</span>
              </div>
            )}
          </div>

          {!readiness.isReady && !stage?.gateOverride && (
            <div className="pt-4 border-t border-border space-y-3">
              <Label className="text-xs text-muted-foreground uppercase">Manual Override</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="Reason for overriding gate..." 
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="text-sm"
                />
                <Button variant="outline" onClick={handleOverride} disabled={!overrideReason.trim()}>
                  Override
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="space-y-3">
          <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Stage Tasks</h3>
          {stage?.tasks.map(task => (
            <div key={task.id} className={`flex items-start gap-3 p-3 border  transition-colors ${task.isCompleted ? 'bg-muted/30 border-muted text-muted-foreground' : 'bg-card border-border'}`}>
              <Checkbox 
                checked={task.isCompleted} 
                onCheckedChange={(c) => handleTaskToggle(task.id, !!c)}
                className="mt-1"
                data-testid={`task-checkbox-${task.id}`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold text-sm ${task.isCompleted ? 'line-through' : ''}`}>{task.title}</span>
                  {task.isRequired && <span className="text-[10px] bg-red-500/20 text-red-500 px-1uppercase tracking-wider font-bold">Req</span>}
                </div>
                <p className="text-xs mt-1">{task.description}</p>
              </div>
              {task.isCompleted && (
                <div className="text-[10px] flex items-center gap-1 opacity-70">
                  <User className="w-3 h-3" />
                  {task.completedBy}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Stage Specific Forms via component embedding or links */}
        {activeStageId === 'client-approval' && (
          <ApprovalManager />
        )}
        
        {['design', 'procurement-ready', 'installation'].includes(activeStageId) && (
          <RiskRegister />
        )}

        {activeStageId === 'installation' && (
          <InstallManager />
        )}

        {activeStageId === 'punch-list' && (
          <PunchListManager />
        )}

        {activeStageId === 'closeout-warranty' && (
          <CloseoutManager />
        )}
      </div>
    </div>
  );
}
