import { Dialog, DialogContent, DialogTitle, DialogHeader } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store';
import { calculateEstimateTotals } from '@/lib/estimate-calc';
import { useProducts } from '@/hooks/use-products';
import { useState, useMemo } from 'react';
import { resolveProductForInstance } from '@/lib/catalog-domain';

export function OptionComparisonModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { options, estimates } = useAppStore();
  const { data: products } = useProducts();
  const [leftOptionId, setLeftOptionId] = useState<string>(options[0]?.id || '');
  const [rightOptionId, setRightOptionId] = useState<string>(options[1]?.id || '');

  const leftOption = options.find(o => o.id === leftOptionId);
  const rightOption = options.find(o => o.id === rightOptionId);

  const leftEstimate = estimates.find(e => e.optionId === leftOptionId) || null;
  const rightEstimate = estimates.find(e => e.optionId === rightOptionId) || null;

  const leftTotals = calculateEstimateTotals(leftEstimate);
  const rightTotals = calculateEstimateTotals(rightEstimate);

  const calculateCapacity = (option: typeof leftOption) => {
    if (!option || !products) return 0;
    let count = 0;
    for (const inst of option.instances) {
      const prod = resolveProductForInstance(inst, products);
      if (prod?.bottle_capacity) count += prod.bottle_capacity;
    }
    return count;
  };

  const leftCapacity = calculateCapacity(leftOption);
  const rightCapacity = calculateCapacity(rightOption);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-lg font-sans font-bold uppercase tracking-widest text-primary">Option Comparison</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-8 mt-4">
          {/* Left Side */}
          <div className="space-y-4">
            <Select value={leftOptionId} onValueChange={setLeftOptionId}>
              <SelectTrigger className="w-full font-bold">
                <SelectValue placeholder="Select Option 1" />
              </SelectTrigger>
              <SelectContent>
                {options.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="bg-muted/20 border border-border  p-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">Products:</span>
                <span className="font-bold">{leftOption?.instances.length || 0}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">Bottle Capacity:</span>
                <span className="font-bold">{leftCapacity}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">Estimate Status:</span>
                <span className="font-bold uppercase">{leftEstimate ? leftEstimate.status : 'None'}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">TBD Items:</span>
                <span className="font-bold text-amber-500">{leftTotals.tbdCount}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">Known Total:</span>
                <span className="font-bold">${leftTotals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
            {leftTotals.tbdCount > 0 && rightTotals.tbdCount > 0 && (
               <div className="text-xs text-muted-foreground text-center italic">
                 Total price comparisons are inconclusive due to pending (TBD) values.
               </div>
            )}
          </div>

          {/* Right Side */}
          <div className="space-y-4">
            <Select value={rightOptionId} onValueChange={setRightOptionId}>
              <SelectTrigger className="w-full font-bold">
                <SelectValue placeholder="Select Option 2" />
              </SelectTrigger>
              <SelectContent>
                {options.map(o => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="bg-muted/20 border border-border  p-4 space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">Products:</span>
                <span className="font-bold">{rightOption?.instances.length || 0}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">Bottle Capacity:</span>
                <span className="font-bold">{rightCapacity}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">Estimate Status:</span>
                <span className="font-bold uppercase">{rightEstimate ? rightEstimate.status : 'None'}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">TBD Items:</span>
                <span className="font-bold text-amber-500">{rightTotals.tbdCount}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-1">
                <span className="text-muted-foreground">Known Total:</span>
                <span className="font-bold">${rightTotals.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}