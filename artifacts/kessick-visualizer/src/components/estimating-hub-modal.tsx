import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { Calculator, Plus, ArrowRight, X, FileText, RefreshCw, Columns3 } from 'lucide-react';
import { useState } from 'react';
import { EstimatingWorkspaceModal } from './estimating-workspace-modal';
import { v4 as uuidv4 } from 'uuid';
import { useProducts } from '@/hooks/use-products';
import { DEFAULT_ESTIMATE_TAX, Estimate } from '@/types/estimating';
import { createOrUpdateEstimate } from '@/lib/estimate-builders';
import { ProposalModal } from './proposal-modal';
import { OptionComparisonModal } from './option-comparison-modal';

export function EstimatingHubModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const store = useAppStore();
  const { estimates, activeEstimate, commit, instances } = store;
  const { data: products } = useProducts();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const handleOpenWorkspace = (id: string) => {
    commit(s => ({ ...s, activeEstimateId: id }));
    setWorkspaceOpen(true);
  };

  const handleSelectEstimate = (id: string) => {
    commit(s => ({ ...s, activeEstimateId: id }));
  };

  const handleSyncEstimate = () => {
    if (!activeEstimate || !products) return;
    const updated = createOrUpdateEstimate(
      activeEstimate,
      store.activeOption,
      products,
      activeEstimate.name,
    );
    commit(s => ({
      ...s,
      estimates: s.estimates.map(estimate => estimate.id === updated.id ? updated : estimate),
      activeEstimateId: updated.id,
    }));
  };

  const handleCreateNew = () => {
    const id = uuidv4();
    const newEst: Estimate = {
      id,
      name: `Estimate ${estimates.length + 1}`,
      optionId: store.activeOption.id,
      status: 'draft',
      lines: [],
      markups: [],
      freight: null,
      tax: DEFAULT_ESTIMATE_TAX(),
      validityDays: 30,
      paymentTerms: '50% deposit prior to fabrication, 50% upon delivery.',
      exclusions: ['Site prep', 'HVAC installation'],
      assumptions: ['Site dimensions verified'],
      revisions: [],
      lastUpdated: Date.now()
    };
    commit(s => ({ ...s, estimates: [...s.estimates, newEst], activeEstimateId: id }));
    setWorkspaceOpen(true);
  };

  const handleCreateFromDesign = () => {
    if (!products) return;
    const newEst = createOrUpdateEstimate(
      null,
      store.activeOption,
      products,
      `Estimate for ${store.activeOption.name}`,
    );
    commit(s => ({ ...s, estimates: [...s.estimates, newEst], activeEstimateId: newEst.id }));
    setWorkspaceOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden bg-background p-0 border-none flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
             <div className="text-lg font-sans font-bold uppercase tracking-widest text-primary flex items-center gap-3"><Calculator className="w-6 h-6" /> Estimating Hub</div>
             <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} data-testid="close-estimating-hub"><X className="w-5 h-5" /></Button>
          </div>
           <div className="flex-1 overflow-y-auto p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-4">
                <h3 className="font-bold text-lg text-primary uppercase tracking-wider mb-2">Create Estimate</h3>
                <div className="bg-card border border-border p-6  flex flex-col gap-4">
                   <Button onClick={handleCreateFromDesign} className="w-full h-12 text-base shadow-lg" disabled={instances.length === 0} data-testid="btn-create-design-est">
                     <Plus className="w-5 h-5 mr-2" /> Generate from Current Design
                   </Button>
                   <Button variant="outline" onClick={handleCreateNew} className="w-full h-12 text-base" data-testid="btn-create-blank-est">
                     <Plus className="w-5 h-5 mr-2" /> Create Blank Estimate
                   </Button>
                </div>
             </div>
             <div className="space-y-4">
                <h3 className="font-bold text-lg text-primary uppercase tracking-wider mb-2">Recent Estimates</h3>
                <div className="bg-card border border-border p-4  flex flex-col gap-2 max-h-[400px] overflow-y-auto">
                   {estimates.length === 0 && <div className="text-muted-foreground text-center py-8">No estimates created yet.</div>}
                   {estimates.map(e => (
                       <div
                         key={e.id}
                         data-testid={`select-est-${e.id}`}
                         className={`flex items-center justify-between p-3 border  bg-background hover:border-primary/50 cursor-pointer transition-colors ${activeEstimate?.id === e.id ? 'border-primary ring-1 ring-primary/30' : 'border-border'}`}
                         onClick={() => handleSelectEstimate(e.id)}
                       >
                         <div>
                            <div className="font-bold text-sm text-foreground">{e.name}</div>
                            <div className="text-xs text-muted-foreground uppercase mt-1">{e.status} • {new Date(e.lastUpdated).toLocaleDateString()}</div>
                         </div>
                          <Button
                            data-testid={`open-est-${e.id}`}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Open ${e.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleOpenWorkspace(e.id);
                            }}
                          >
                            <ArrowRight className="w-4 h-4 text-muted-foreground" />
                          </Button>
                      </div>
                   ))}
                </div>
             </div>
              {activeEstimate && (
                <div className="md:col-span-2 flex flex-col sm:flex-row gap-2 border-t border-border pt-5">
                  <Button className="gap-2" onClick={() => setWorkspaceOpen(true)} data-testid="button-open-workspace">
                    <Calculator className="w-4 h-4" />
                    Open Workspace
                  </Button>
                  <Button variant="secondary" className="gap-2" onClick={() => setProposalOpen(true)} data-testid="button-open-proposal">
                    <FileText className="w-4 h-4" />
                    Proposal
                  </Button>
                  <Button variant="outline" className="gap-2" onClick={handleSyncEstimate} disabled={!products} data-testid="button-update-estimate">
                    <RefreshCw className="w-4 h-4" />
                    Sync with {store.activeOption.name}
                  </Button>
                  <Button variant="outline" className="gap-2 sm:ml-auto" onClick={() => setCompareOpen(true)} data-testid="button-compare-options">
                    <Columns3 className="w-4 h-4" />
                    Compare Options
                  </Button>
                </div>
              )}
          </div>
        </DialogContent>
      </Dialog>
      <EstimatingWorkspaceModal open={workspaceOpen} onOpenChange={setWorkspaceOpen} />
      <ProposalModal open={proposalOpen} onOpenChange={setProposalOpen} />
      <OptionComparisonModal open={compareOpen} onOpenChange={setCompareOpen} />
    </>
  );
}
