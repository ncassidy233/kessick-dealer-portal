import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { calculateEstimateTotals } from '@/lib/estimate-calc';
import { Printer, CheckCircle, Send, XCircle } from 'lucide-react';
import { EstimateStatus } from '@/types/estimating';
import { BrandLogo } from './brand-logo';

import { v4 as uuidv4 } from 'uuid';

export function ProposalModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { activeEstimate, project, commit, activeOption } = useAppStore();

  if (!activeEstimate) return null;

  const totals = calculateEstimateTotals(activeEstimate);
  const includedLines = activeEstimate.lines.filter(l => !l.isAlternate);
  const alternateLines = activeEstimate.lines.filter(l => l.isAlternate);

  const updateStatus = (status: EstimateStatus) => {
    commit(s => {
      const next = { ...activeEstimate, status };
      if (status === 'sent' || status === 'accepted') {
        next.revisions = [
          ...next.revisions,
          {
            id: uuidv4(),
            date: new Date().toISOString(),
            snapshot: JSON.parse(JSON.stringify(activeEstimate)),
            status
          }
        ];
      }
      return {
        ...s,
        estimates: s.estimates.map(e => e.id === next.id ? next : e),
        activeEstimateId: next.id
      };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-screen h-[100dvh] max-h-screen m-0 p-0 rounded-none bg-background border-none flex flex-col overflow-hidden">
        
        {/* Header (No print) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-3 sm:px-4 py-2 border-b border-border bg-card shrink-0 z-20 no-print gap-2 sm:gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
            <h2 className="text-base sm:text-lg font-sans font-bold uppercase tracking-widest text-primary">Proposal Generation</h2>
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2">
              <Button size="sm" variant={activeEstimate.status === 'sent' ? 'default' : 'outline'} onClick={() => updateStatus('sent')} className="gap-1 sm:gap-2 h-8 px-2 text-xs">
                <Send className="w-3 h-3"/> Mark Sent
              </Button>
              <Button size="sm" variant={activeEstimate.status === 'accepted' ? 'default' : 'outline'} onClick={() => updateStatus('accepted')} className="gap-1 sm:gap-2 h-8 px-2 text-xs">
                <CheckCircle className="w-3 h-3"/> Accept
              </Button>
              <Button size="sm" variant={activeEstimate.status === 'declined' ? 'destructive' : 'outline'} onClick={() => updateStatus('declined')} className="gap-1 sm:gap-2 h-8 px-2 text-xs">
                <XCircle className="w-3 h-3"/> Decline
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <Button data-testid="button-print-proposal" size="sm" onClick={() => window.print()} className="gap-2 w-full sm:w-auto">
              <Printer className="w-4 h-4"/> Print PDF
            </Button>
            <Button data-testid="button-close-proposal" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Close</Button>
          </div>
        </div>

        {/* Paper Canvas */}
        <div className="flex-1 overflow-auto bg-muted/30 p-0 sm:p-8 flex justify-center print:p-0 print:bg-white">
          <div className="bg-white text-black print-proposal-sheet shadow-none sm:shadow-2xl mx-auto flex flex-col w-full min-h-full p-4 sm:p-[0.5in] print:shadow-none print:m-0 print:w-[8.5in] print:min-h-[11in] print:p-[0.5in]">
            
            {/* Proposal Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 border-b-2 border-black pb-4 sm:pb-6 mb-6">
              <div>
                <h1 className="text-4xl font-serif font-bold text-black uppercase tracking-tight">PROPOSAL</h1>
                <p className="text-gray-500 text-sm mt-1 uppercase tracking-wider font-bold">Wine Cellar Construction Scope</p>
              </div>
              <div className="text-left sm:text-right w-48">
                <BrandLogo tone="dark" className="mb-2 h-auto w-full" />
                <p className="text-xs text-gray-500 mt-1 font-bold uppercase tracking-wider">Kessick Wine Cellars<br/>kessick.com</p>
              </div>
            </div>

            {/* Project / Client Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-12 mb-8 text-sm">
              <div className="flex-1">
                <div className="font-bold text-xs uppercase tracking-wider text-gray-400 mb-1">Prepared For</div>
                <div className="font-bold text-lg">{project.client || 'Client Name'}</div>
                <div>{project.address || 'Site Address'}</div>
              </div>
              <div className="flex-1">
                <div className="font-bold text-xs uppercase tracking-wider text-gray-400 mb-1">Project</div>
                <div className="font-bold text-lg">{project.name || 'Unnamed Project'}</div>
                <div>Option: {activeOption.name}</div>
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Valid For: {activeEstimate.validityDays} Days</div>
              </div>
            </div>

            {/* Incomplete Warning */}
            {!totals.isComplete && (
              <div className="border border-red-500 bg-red-50 p-4 text-red-800 mb-8 text-sm">
                <strong>Warning:</strong> This proposal is incomplete and contains {totals.tbdCount} unpriced (TBD) item(s). Grand total does not reflect all costs.
              </div>
            )}

            {/* Scope of Work */}
            <div className="mb-8 flex-1">
              <h3 className="font-bold text-lg border-b border-black pb-2 mb-4 uppercase">Base Scope of Work</h3>
              
              <table className="w-full text-sm text-left table-fixed sm:table-auto">
                <thead>
                  <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
                    <th className="pb-2 w-[28%]">Category</th>
                    <th className="pb-2 w-[48%]">Description</th>
                    <th className="pb-2 text-right w-[24%]">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {includedLines.map(l => (
                    <tr key={l.id}>
                      <td className="py-2 pr-2 font-medium break-words">{l.category}</td>
                      <td className="py-2 pr-2 sm:pr-4 break-words">{l.description}</td>
                      <td className="py-2 text-right">{l.qty} {l.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {alternateLines.length > 0 && (
                <>
                  <h3 className="font-bold text-sm border-b border-gray-300 pb-1 mt-8 mb-3 uppercase text-gray-500">Alternates (Not included in total)</h3>
                  <table className="w-full text-sm text-left opacity-75 table-fixed">
                    <tbody className="divide-y divide-gray-100">
                      {alternateLines.map(l => (
                        <tr key={l.id}>
                          <td className="py-2 font-medium w-1/4">{l.category}</td>
                          <td className="py-2 pr-4 w-1/2">{l.description}</td>
                          <td className="py-2 text-right">{l.qty} {l.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {/* Totals */}
            <div className="ml-auto w-full sm:w-1/2 mt-8 text-sm">
              <div className="flex justify-between py-1">
                <span>Material Subtotal:</span>
                <span>${totals.materialTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Labor Subtotal:</span>
                <span>${totals.laborTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Freight / Delivery:</span>
                <span>{activeEstimate.freight === null ? 'TBD' : `$${activeEstimate.freight.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Estimated Tax:</span>
                <span>${totals.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-3 mt-2 border-t-2 border-black font-bold text-lg">
                <span>Total Investment:</span>
                <span>${totals.grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Terms */}
            <div className="mt-12 text-xs text-gray-600">
              <h4 className="font-bold text-gray-800 uppercase mb-2">Terms & Conditions</h4>
              <p className="mb-2"><strong>Payment Terms:</strong> {activeEstimate.paymentTerms}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                <div className="flex-1">
                  <strong className="block mb-1">Exclusions:</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    {activeEstimate.exclusions.filter(ex => ex.trim().length > 0).map((ex, i) => <li key={i}>{ex}</li>)}
                  </ul>
                </div>
                <div className="flex-1">
                  <strong className="block mb-1">Assumptions:</strong>
                  <ul className="list-disc pl-4 space-y-1">
                    {activeEstimate.assumptions.filter(ass => ass.trim().length > 0).map((ass, i) => <li key={i}>{ass}</li>)}
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="mt-12 border-t border-gray-300 pt-8 grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="flex-1">
                <div className="border-b border-black pb-1 mb-1 w-full h-8"></div>
                <div className="text-xs uppercase text-gray-500">Accepted By (Client)</div>
              </div>
              <div className="flex-1">
                <div className="border-b border-black pb-1 mb-1 w-full h-8"></div>
                <div className="text-xs uppercase text-gray-500">Date</div>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
