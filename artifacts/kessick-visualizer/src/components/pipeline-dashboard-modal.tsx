import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppStore } from '@/store';
import { PipelineStageId } from '@/types/pipeline';
import { evaluateStageReadiness } from '@/lib/pipeline-readiness';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Download, AlertCircle, Clock, CheckCircle, Printer } from 'lucide-react';
import { exportPipelineCsv, exportPipelineJson } from '@/lib/pipeline-export';
import { useProducts } from '@/hooks/use-products';

const STAGE_IDS: PipelineStageId[] = [
  'lead-intake', 'site-survey', 'design', 'client-approval', 
  'construction-documents', 'estimate-proposal', 'procurement-ready', 
  'installation', 'punch-list', 'closeout-warranty'
];

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

export function PipelineDashboardModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const store = useAppStore();
  const { data: products = [] } = useProducts();
  
  const currentStageId = useMemo(() => {
    // Find first non-completed stage
    for (const id of STAGE_IDS) {
      if (store.pipeline.stages[id]?.status !== 'completed') {
        return id;
      }
    }
    return 'closeout-warranty';
  }, [store.pipeline.stages]);

  const readiness = evaluateStageReadiness(store, currentStageId, products);
  const stage = store.pipeline.stages[currentStageId];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-background text-foreground border-border p-0">
        <DialogHeader className="p-6 border-b border-border bg-card sticky top-0 z-10 flex flex-row items-center justify-between no-print">
          <div>
            <DialogTitle className="text-xl font-sans font-bold uppercase tracking-widest text-primary">Project Pipeline Dashboard</DialogTitle>
            <div className="text-sm text-muted-foreground mt-1">Coordination Meeting View &bull; {store.project.name}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportPipelineJson(store.project, store.pipeline)}>
              <Download className="w-4 h-4" /> JSON
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportPipelineCsv(store.project, store.pipeline)}>
              <Download className="w-4 h-4" /> CSVs
            </Button>
            <Button variant="default" size="sm" className="gap-2 bg-primary text-primary-foreground" onClick={() => window.print()}>
              <Printer className="w-4 h-4" /> Print Report
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-8 print:p-0 print:block">
          <div className="hidden print:block mb-8 border-b-2 border-primary pb-4">
            <h1 className="text-2xl font-sans font-bold uppercase tracking-widest text-primary">Project Status Summary</h1>
            <div className="text-lg text-muted-foreground">{store.project.name} &bull; {format(new Date(), 'MMMM d, yyyy')}</div>
          </div>
          {/* Header Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border p-4 ">
              <div className="text-xs font-bold uppercase text-muted-foreground">Current Phase</div>
              <div className="text-xl font-bold mt-1 text-primary">{STAGE_LABELS[currentStageId]}</div>
            </div>
            <div className="bg-card border p-4 ">
              <div className="text-xs font-bold uppercase text-muted-foreground">Phase Progress</div>
              <div className="text-xl font-bold mt-1">{readiness.percentComplete}% Ready</div>
            </div>
            <div className="bg-card border p-4 ">
              <div className="text-xs font-bold uppercase text-muted-foreground">Critical Risks</div>
              <div className="text-xl font-bold mt-1 text-destructive">
                {store.pipeline.risks.filter(r => r.status === 'open' && r.severity === 'critical').length}
              </div>
            </div>
            <div className="bg-card border p-4 ">
              <div className="text-xs font-bold uppercase text-muted-foreground">Punch Items</div>
              <div className="text-xl font-bold mt-1">
                {store.pipeline.punchItems.filter(p => p.status === 'open').length} Open
              </div>
            </div>
          </div>

          {/* Timeline / Rail */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4">Master Schedule</h3>
            <div className="flex w-full border border-border  overflow-hidden bg-card text-sm">
              {STAGE_IDS.map((id, index) => {
                const s = store.pipeline.stages[id];
                const isActive = id === currentStageId;
                const isCompleted = s.status === 'completed';
                return (
                  <div 
                    key={id} 
                    className={`flex-1 p-3 border-r border-border last:border-0 relative ${isActive ? 'bg-primary/10' : ''}`}
                  >
                    <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis mb-1" title={STAGE_LABELS[id]}>
                      {index + 1}. {STAGE_LABELS[id]}
                    </div>
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                      <span>{isCompleted ? 'Done' : s.status}</span>
                      {isCompleted ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      ) : isActive ? (
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-current opacity-30" />
                      )}
                    </div>
                    {isActive && (
                      <div className="absolute bottom-0 left-0 h-1 bg-primary" style={{ width: `${readiness.percentComplete}%` }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Blockers & Action Items */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Blockers & Tasks</h3>
              <div className="bg-card border  p-4 space-y-4">
                {readiness.blockers.length === 0 ? (
                  <div className="text-sm text-green-500 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> No active blockers for this stage.
                  </div>
                ) : (
                  readiness.blockers.map((b, i) => (
                    <div key={i} className="flex gap-2 items-start text-sm bg-destructive/10 text-destructive p-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))
                )}
                
                <div className="border-t border-border pt-4">
                  <div className="text-xs font-bold uppercase mb-2">Required Open Tasks</div>
                  {stage?.tasks.filter(t => t.isRequired && !t.isCompleted).map(t => (
                    <div key={t.id} className="flex items-center gap-2 text-sm p-1.5 border-b border-border/50 last:border-0">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      {t.title}
                    </div>
                  ))}
                  {stage?.tasks.filter(t => t.isRequired && !t.isCompleted).length === 0 && (
                    <div className="text-sm text-muted-foreground italic">All required tasks completed.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Activity Feed */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent Activity</h3>
              <div className="bg-card border  p-4 max-h-[400px] overflow-y-auto space-y-4 print:max-h-none print:overflow-visible">
                {store.pipeline.activity.length === 0 ? (
                  <div className="text-sm text-muted-foreground italic">No activity recorded yet.</div>
                ) : (
                  store.pipeline.activity.slice(0, 20).map(act => (
                    <div key={act.id} className="flex gap-3 text-sm border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                      <div>
                        <div className="font-bold">{act.action}</div>
                        <div className="text-muted-foreground mt-0.5">{act.details}</div>
                        <div className="text-xs text-muted-foreground opacity-60 mt-1">
                          {format(new Date(act.date), 'MMM d, h:mm a')} &bull; {act.userId}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* Print-only details */}
          <div className="hidden print:block space-y-8 mt-12 pt-8 border-t border-border">
            <div>
              <h3 className="text-lg font-bold border-b border-border pb-2 mb-4">Risk Register</h3>
              {store.pipeline.risks.length === 0 ? <p className="text-sm">No risks logged.</p> : (
                <table className="w-full text-sm text-left">
                  <thead><tr><th>Title</th><th>Category</th><th>Severity</th><th>Status</th><th>Owner</th></tr></thead>
                  <tbody>
                    {store.pipeline.risks.map(r => (
                      <tr key={r.id} className="border-b"><td>{r.title}</td><td className="uppercase">{r.category}</td><td>{r.severity}</td><td className="uppercase">{r.status}</td><td>{r.owner}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold border-b border-border pb-2 mb-4">Approvals</h3>
              {store.pipeline.approvals.length === 0 ? <p className="text-sm">No approvals logged.</p> : (
                <table className="w-full text-sm text-left">
                  <thead><tr><th>Type</th><th>Approver</th><th>Method</th><th>Date</th><th>Notes</th></tr></thead>
                  <tbody>
                    {store.pipeline.approvals.map(a => (
                      <tr key={a.id} className="border-b"><td className="capitalize">{a.type}</td><td>{a.approver}</td><td className="capitalize">{a.method}</td><td>{format(new Date(a.date), 'MM/dd/yyyy')}</td><td>{a.notes}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold border-b border-border pb-2 mb-4">Punch List</h3>
              {store.pipeline.punchItems.length === 0 ? <p className="text-sm">No punch list items.</p> : (
                <table className="w-full text-sm text-left">
                  <thead><tr><th>Description</th><th>Location</th><th>Severity</th><th>Status</th></tr></thead>
                  <tbody>
                    {store.pipeline.punchItems.map(p => (
                      <tr key={p.id} className="border-b"><td>{p.description}</td><td>{p.location}</td><td>{p.severity}</td><td className="uppercase">{p.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
