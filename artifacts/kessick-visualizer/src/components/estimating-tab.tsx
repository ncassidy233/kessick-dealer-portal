import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProducts } from '@/hooks/use-products';
import { Calculator, FileText, Plus, RefreshCw } from 'lucide-react';
import { createOrUpdateEstimate } from '@/lib/estimate-builders';
import { useState } from 'react';
import { EstimatingWorkspaceModal } from './estimating-workspace-modal';
import { ProposalModal } from './proposal-modal';

import { OptionComparisonModal } from './option-comparison-modal';

export function EstimatingTab() {
  const { estimates, activeEstimate, setActiveEstimateId, activeOption, commit } = useAppStore();
  const { data: products } = useProducts();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [proposalOpen, setProposalOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const handleCreateEstimate = () => {
    if (!products) return;
    const name = `Estimate for Option ${activeOption.name}`;
    const newEst = createOrUpdateEstimate(null, activeOption, products, name);
    commit(s => ({
      ...s,
      estimates: [...s.estimates, newEst],
      activeEstimateId: newEst.id
    }));
  };

  const handleUpdateEstimate = () => {
    if (!activeEstimate || !products) return;
    const updated = createOrUpdateEstimate(activeEstimate, activeOption, products, activeEstimate.name);
    commit(s => ({
      ...s,
      estimates: s.estimates.map(e => e.id === updated.id ? updated : e)
    }));
  };

  return (
    <div className="flex flex-col h-full bg-background p-4 gap-4 overflow-y-auto">
      <div>
        <h2 className="text-lg font-sans font-bold uppercase tracking-widest text-primary mb-1">Estimating</h2>
        <p className="text-xs text-muted-foreground">
          Translate designs into scopes of work. Remember: Kessick does not provide pricing. All rates must be entered manually.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Estimate</label>
        {estimates.length > 0 ? (
          <Select value={activeEstimate?.id || ''} onValueChange={setActiveEstimateId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Estimate" />
            </SelectTrigger>
            <SelectContent>
              {estimates.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name} ({e.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-sm text-muted-foreground italic mb-2">No estimates created yet.</div>
        )}
        
        <Button data-testid="button-create-estimate" variant="outline" className="w-full justify-start gap-2" onClick={handleCreateEstimate} disabled={!products}>
          <Plus className="w-4 h-4" />
          Create New from Option {activeOption.name}
        </Button>
      </div>

      {activeEstimate && (
        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex gap-2">
            <Button data-testid="button-open-workspace" className="flex-1 gap-2" onClick={() => setWorkspaceOpen(true)}>
              <Calculator className="w-4 h-4" />
              Workspace
            </Button>
            <Button data-testid="button-open-proposal" variant="secondary" className="flex-1 gap-2" onClick={() => setProposalOpen(true)}>
              <FileText className="w-4 h-4" />
              Proposal
            </Button>
          </div>

          <Button data-testid="button-update-estimate" variant="ghost" className="w-full text-xs gap-2" onClick={handleUpdateEstimate}>
            <RefreshCw className="w-3 h-3" />
            Sync with Option {activeOption.name}
          </Button>
          
          <Button data-testid="button-compare-options" variant="outline" className="w-full text-xs gap-2 mt-2" onClick={() => setCompareOpen(true)}>
            Compare Options
          </Button>

            <div className="bg-muted/30 p-3 text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="uppercase font-bold">{activeEstimate.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lines:</span>
              <span>{activeEstimate.lines.length} items</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Updated:</span>
              <span>{new Date(activeEstimate.lastUpdated).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      <EstimatingWorkspaceModal open={workspaceOpen} onOpenChange={setWorkspaceOpen} />
      <ProposalModal open={proposalOpen} onOpenChange={setProposalOpen} />
      <OptionComparisonModal open={compareOpen} onOpenChange={setCompareOpen} />
    </div>
  );
}
