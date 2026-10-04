import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store';
import { Calculator, Download, AlertTriangle, Plus, Trash2, X, MoreHorizontal } from 'lucide-react';
import { calculateEstimateTotals } from '@/lib/estimate-calc';
import { Estimate, EstimateLine, EstimateStatus } from '@/types/estimating';
import { exportEstimateCsv } from '@/lib/csv-export';
import { v4 as uuidv4 } from 'uuid';
import { Checkbox } from '@/components/ui/checkbox';
import { EstimateMarkup } from '@/types/estimating';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function EstimatingWorkspaceModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const store = useAppStore();
  const { activeEstimate, project, commit } = store;
  const [mobilePane, setMobilePane] = useState<'items' | 'summary'>('items');

  if (!activeEstimate) return null;

  const estimate: Estimate = activeEstimate;
  const totals = calculateEstimateTotals(estimate);

  const updateEstimate = (updater: (e: Estimate) => Estimate) => {
    commit(s => {
      const nextEst: Estimate = {
        ...updater(estimate),
        lastUpdated: Date.now(),
      };
      return {
        ...s,
        estimates: s.estimates.map(e => e.id === nextEst.id ? nextEst : e),
        activeEstimateId: nextEst.id
      };
    });
  };

  const updateLine = (id: string, updater: (l: EstimateLine) => EstimateLine) => {
    updateEstimate(e => ({
      ...e,
      lines: e.lines.map(l => l.id === id ? updater(l) : l)
    }));
  };

  const addManualLine = () => {
    updateEstimate(e => ({
      ...e,
      lines: [...e.lines, {
        id: uuidv4(),
        category: 'Custom',
        description: 'New Item',
        qty: 1,
        unit: 'ea',
        materialAllowance: null,
        laborAllowance: null,
        isOptional: false,
        isAlternate: false,
        notes: ''
      }]
    }));
  };

  const removeLine = (id: string) => {
    updateEstimate(e => ({
      ...e,
      lines: e.lines.filter(l => l.id !== id)
    }));
  };

  const addMarkup = () => {
    updateEstimate(e => ({
      ...e,
      markups: [...e.markups, {
        id: uuidv4(),
        name: 'Markup',
        type: 'percentage',
        value: 10,
        appliesTo: 'overall'
      }]
    }));
  };

  const updateMarkup = (id: string, updater: (m: EstimateMarkup) => EstimateMarkup) => {
    updateEstimate(e => ({
      ...e,
      markups: e.markups.map(m => m.id === id ? updater(m) : m)
    }));
  };

  const removeMarkup = (id: string) => {
    updateEstimate(e => ({
      ...e,
      markups: e.markups.filter(m => m.id !== id)
    }));
  };

  const updateEstimateStatus = (status: EstimateStatus) => {
    updateEstimate(e => ({ ...e, status }));
    if (status === 'sent') {
      store.recordActivity('Estimate Sent', `Estimate ${estimate.name} marked as sent.`, 'estimate-proposal');
    }
    if (status === 'accepted') {
      store.recordActivity('Estimate Accepted', `Estimate ${estimate.name} marked as accepted.`, 'estimate-proposal');
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(activeEstimate, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_estimate_${activeEstimate.id.substring(0,6)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-screen h-[100dvh] max-h-screen m-0 p-0 rounded-none bg-background border-none flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 md:px-6 py-3 border-b border-border bg-card shrink-0 z-20">
          <div className="flex min-w-0 items-center gap-2 md:gap-4">
            <DialogTitle className="min-w-0 text-base md:text-lg font-sans font-bold uppercase tracking-widest text-primary flex items-center gap-2 md:gap-3">
              <Calculator className="w-5 h-5 md:w-6 md:h-6 shrink-0" />
              <span className="truncate">Estimating Workspace</span>
            </DialogTitle>
            {!totals.isComplete && (
              <div className="flex shrink-0 items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 md:px-3 py-1.5 border border-amber-500/20" title="All items need rates. Blank = TBD">
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">{totals.tbdCount} TBD Item(s)</span>
                <span className="sm:hidden">{totals.tbdCount}</span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1 md:gap-3">
            <div className="hidden sm:flex items-center gap-2">
            <Button data-testid="button-export-json" variant="outline" size="sm" className="gap-2 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground" onClick={exportJson}>
              <Download className="w-4 h-4" /> JSON
            </Button>
            <Button data-testid="button-export-csv" variant="outline" size="sm" className="gap-2 border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground" onClick={() => exportEstimateCsv(project.name, activeEstimate)}>
              <Download className="w-4 h-4" /> CSV
            </Button>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="button-mobile-estimate-menu" variant="outline" size="icon" className="sm:hidden h-9 w-9" aria-label="Estimate export options">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={exportJson}>
                  <Download className="w-4 h-4" />
                  Export JSON
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => exportEstimateCsv(project.name, activeEstimate)}>
                  <Download className="w-4 h-4" />
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button data-testid="button-close-workspace" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:hidden border-b border-border bg-card p-1">
          <Button
            data-testid="button-estimate-items"
            variant={mobilePane === 'items' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMobilePane('items')}
          >
            Line Items
          </Button>
          <Button
            data-testid="button-estimate-summary"
            variant={mobilePane === 'summary' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setMobilePane('summary')}
          >
            Summary & Terms
          </Button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          
          {/* Main Table */}
          <div className={`${mobilePane === 'items' ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 flex-col overflow-hidden bg-background`}>
            <div className="flex-1 overflow-auto p-3 md:p-6">
              <div className="min-w-[800px] border border-border shadow-lg bg-card">
                <table className="w-full text-sm text-left border-collapse">
                <thead className="sticky top-0 bg-sidebar z-10 shadow-sm border-b border-border">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                    <th className="py-3 px-3 w-8 text-center">Alt</th>
                    <th className="py-3 px-3 w-32">Category</th>
                    <th className="py-3 px-3 w-32">SKU</th>
                    <th className="py-3 px-3">Description</th>
                    <th className="py-3 px-3 w-16">Qty</th>
                    <th className="py-3 px-3 w-16">Unit</th>
                    <th className="py-3 px-3 w-32 text-right">Mat. Rate</th>
                    <th className="py-3 px-3 w-32 text-right">Lab. Rate</th>
                    <th className="py-3 px-3 w-48">Notes</th>
                    <th className="py-3 px-3 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {activeEstimate.lines.map(line => (
                    <tr key={line.id} className={`group transition-colors hover:bg-muted/30 ${line.isAlternate ? 'opacity-60 bg-muted/20' : ''}`}>
                      <td className="py-2 px-3 text-center">
                        <Checkbox 
                          checked={line.isAlternate} 
                          onCheckedChange={c => updateLine(line.id, l => ({ ...l, isAlternate: !!c }))}
                        />
                      </td>
                      <td className="py-2 px-3">
                        <Input className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background" value={line.category} onChange={e => updateLine(line.id, l => ({ ...l, category: e.target.value }))} />
                      </td>
                      <td className="py-2 px-3 font-mono text-[10px] text-primary">
                        {line.sku || <span className="text-muted-foreground/50">-</span>}
                      </td>
                      <td className="py-2 px-3">
                        <Input className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background w-full font-medium" value={line.description} onChange={e => updateLine(line.id, l => ({ ...l, description: e.target.value }))} />
                      </td>
                      <td className="py-2 px-3">
                        <Input type="number" className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background font-mono text-center" value={line.qty} onChange={e => updateLine(line.id, l => ({ ...l, qty: Number(e.target.value) }))} />
                      </td>
                      <td className="py-2 px-3">
                        <Input className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background text-center uppercase" value={line.unit} onChange={e => updateLine(line.id, l => ({ ...l, unit: e.target.value }))} />
                      </td>
                      <td className="py-2 px-3">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-muted-foreground text-xs">$</span>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="TBD"
                            className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background text-right pl-6 font-mono" 
                            value={line.materialAllowance === null ? '' : line.materialAllowance} 
                            onChange={e => updateLine(line.id, l => ({ ...l, materialAllowance: e.target.value === '' ? null : Number(e.target.value) }))} 
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="relative">
                          <span className="absolute left-2 top-2 text-muted-foreground text-xs">$</span>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="TBD"
                            className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background text-right pl-6 font-mono" 
                            value={line.laborAllowance === null ? '' : line.laborAllowance} 
                            onChange={e => updateLine(line.id, l => ({ ...l, laborAllowance: e.target.value === '' ? null : Number(e.target.value) }))} 
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <Input className="h-8 text-xs bg-transparent border-transparent hover:border-input focus:bg-background w-full italic" placeholder="Notes..." value={line.notes} onChange={e => updateLine(line.id, l => ({ ...l, notes: e.target.value }))} />
                      </td>
                      <td className="py-2 px-3 text-center opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeLine(line.id)}
                          aria-label={`Delete ${line.description}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              
              <div className="mt-6 flex justify-center">
                <Button variant="outline" size="sm" onClick={addManualLine} className="gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground shadow-lg">
                  <Plus className="w-4 h-4" /> Add Manual Line Item
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar / Settings & Summary */}
          <div className={`${mobilePane === 'summary' ? 'flex' : 'hidden'} md:flex w-full md:w-[380px] min-h-0 border-l border-border bg-sidebar flex-col shrink-0 overflow-y-auto shadow-2xl z-10`}>
            
            <div className="p-6 border-b border-border space-y-4 bg-card">
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Estimate Configuration</h3>
              
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</label>
                <Select value={activeEstimate.status} onValueChange={v => updateEstimateStatus(v as EstimateStatus)}>
                  <SelectTrigger className="h-10 mt-1.5 bg-background border-border font-medium"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="internal-review">Internal Review</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-6 border-b border-border space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Markups & Adjustments</h3>
                <Button variant="ghost" size="sm" className="h-7 px-3 text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground" onClick={addMarkup}>+ Add</Button>
              </div>

              <div className="space-y-3">
                {activeEstimate.markups.map(markup => (
                  <div key={markup.id} className="bg-background border border-border p-3 relative group space-y-3 shadow-sm transition-all hover:border-primary/50">
                    <div className="flex gap-2">
                      <Input 
                        className="h-8 text-xs w-full font-bold bg-transparent border-transparent hover:border-input focus:bg-background" 
                        value={markup.name} 
                        onChange={e => updateMarkup(markup.id, m => ({ ...m, name: e.target.value }))} 
                      />
                      <button onClick={() => removeMarkup(markup.id)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 shadow-md transition-opacity">&times;</button>
                    </div>
                    <div className="flex gap-2 items-center">
                      <Select value={markup.type} onValueChange={(v: 'percentage' | 'fixed') => updateMarkup(markup.id, m => ({ ...m, type: v }))}>
                        <SelectTrigger className="h-8 text-xs w-20 px-2 bg-card border-border"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">$</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input 
                        type="number" 
                        className="h-8 text-xs w-20 bg-card border-border text-center font-mono" 
                        value={markup.value} 
                        onChange={e => updateMarkup(markup.id, m => ({ ...m, value: Number(e.target.value) }))} 
                      />
                      <Select value={markup.appliesTo} onValueChange={(v: 'material' | 'labor' | 'overall') => updateMarkup(markup.id, m => ({ ...m, appliesTo: v }))}>
                        <SelectTrigger className="h-8 text-xs flex-1 px-2 bg-card border-border"><SelectValue/></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="overall">Overall</SelectItem>
                          <SelectItem value="material">Material</SelectItem>
                          <SelectItem value="labor">Labor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {activeEstimate.markups.length === 0 && <div className="text-sm text-muted-foreground italic text-center py-2">No markups applied.</div>}
              </div>
            </div>

            <div className="p-6 border-b border-border bg-primary/5 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider text-primary">Financial Summary</h3>
              
              <div className="space-y-2 text-sm font-medium">
                <div className="flex justify-between text-muted-foreground">
                  <span>Material Subtotal:</span>
                  <span className="font-mono text-foreground">${totals.materialTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Labor Subtotal:</span>
                  <span className="font-mono text-foreground">${totals.laborTotal.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between items-center py-3 border-y border-primary/10 my-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Freight Estimate</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-muted-foreground text-xs">$</span>
                    <Input 
                      type="number" 
                      step="0.01"
                      placeholder="TBD"
                      className="w-28 h-8 text-xs text-right pl-6 bg-background border-border font-mono"
                      value={activeEstimate.freight === null ? '' : activeEstimate.freight}
                      onChange={e => updateEstimate(est => ({ ...est, freight: e.target.value === '' ? null : Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Tax Rate (%)</span>
                  <Input 
                    type="number" 
                    step="0.1"
                    className="w-28 h-8 text-xs text-right bg-background border-border font-mono"
                    value={activeEstimate.tax.rate}
                    onChange={e => updateEstimate(est => ({ ...est, tax: { ...est.tax, rate: Number(e.target.value) } }))}
                  />
                </div>
                {activeEstimate.tax.rate > 0 && (
                  <div className="flex justify-between text-muted-foreground text-xs pl-2 mt-1">
                    <span>Tax Amount:</span>
                    <span className="font-mono text-foreground">${totals.taxTotal.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between font-bold text-2xl pt-6 mt-4 border-t border-primary/20 text-primary">
                  <span>Total:</span>
                  <span className="font-mono">${totals.grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="p-6 flex-1 space-y-5">
              <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Terms & Conditions</h3>
              
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Validity (Days)</label>
                <Input 
                  type="number" 
                  className="h-9 text-sm bg-background border-border" 
                  value={activeEstimate.validityDays} 
                  onChange={e => updateEstimate(est => ({ ...est, validityDays: Number(e.target.value) }))} 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Payment Terms</label>
                <Textarea 
                  className="min-h-[80px] text-sm resize-none bg-background border-border" 
                  value={activeEstimate.paymentTerms} 
                  onChange={e => updateEstimate(est => ({ ...est, paymentTerms: e.target.value }))} 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Exclusions (One per line)</label>
                <Textarea 
                  className="min-h-[100px] text-sm resize-none bg-background border-border" 
                  value={activeEstimate.exclusions.join('\n')} 
                  onChange={e => updateEstimate(est => ({ ...est, exclusions: e.target.value.split('\n') }))} 
                  placeholder="e.g. HVAC rough-in"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Assumptions (One per line)</label>
                <Textarea 
                  className="min-h-[100px] text-sm resize-none bg-background border-border" 
                  value={activeEstimate.assumptions.join('\n')} 
                  onChange={e => updateEstimate(est => ({ ...est, assumptions: e.target.value.split('\n') }))} 
                  placeholder="e.g. Site is cleared"
                />
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 p-4 text-xs text-amber-500 mt-6 font-medium shadow-inner">
                <AlertTriangle className="w-5 h-5 mb-2" />
                Kessick provides equipment schedules only. All rates, markups, and final totals are the responsibility of the builder.
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
