import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { useProducts } from '@/hooks/use-products';
import { Download, CheckCircle, Presentation as PresentationIcon, AlignLeft } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { resolveProductForInstance } from '@/lib/catalog-domain';
import { BrandLogo } from './brand-logo';

export function PresentationModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { project, activeOption, instances, unit, pixelsPerInch, commit } = useAppStore();
  const { data: products } = useProducts();
  const [snapshotData, setSnapshotData] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        setSnapshotData(canvas.toDataURL('image/jpeg', 0.9));
      }
    } else {
      setSnapshotData(null);
    }
  }, [open]);

  const schedule = useMemo(() => {
    if (!products) return [];
    return instances.map(inst => {
      const product = resolveProductForInstance(inst, products);
      return { inst, product };
    }).filter(x => x.product);
  }, [instances, products]);

  const handleExportPNG = () => {
    if (snapshotData) {
      const a = document.createElement('a');
      a.href = snapshotData;
      a.download = `kessick_presentation_${activeOption.name.replace(/\s+/g, '_')}.jpg`;
      a.click();
    }
  };

  const markApproved = () => {
    commit(s => ({
      ...s,
      options: s.options.map(o => o.id === s.activeOptionId ? { ...o, status: 'approved' } : o)
    }));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1000px] w-full max-h-[95vh] overflow-y-auto bg-card border-border text-foreground p-0">
        
        <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border p-4 flex items-center justify-between z-10">
          <DialogHeader className="p-0">
            <DialogTitle className="text-lg font-sans font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <PresentationIcon className="w-5 h-5" />
              Client Presentation: {activeOption.name}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Review design option details with your client.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPNG} disabled={!snapshotData}>
              <Download className="w-4 h-4" /> Save Scene
            </Button>
            <Button className="gap-2 bg-green-600 text-white hover:bg-green-700" onClick={markApproved}>
              <CheckCircle className="w-4 h-4" /> Approve Option
            </Button>
          </div>
        </div>

        <div className="p-8 space-y-12">
          
          {/* Header Info */}
          <div className="flex justify-between items-end border-b-2 border-primary/30 pb-6">
            <div>
              <BrandLogo tone="light" className="mb-3 h-10" />
              <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Design Option: {activeOption.name}</p>
            </div>
            <div className="text-right text-sm space-y-1 text-muted-foreground">
              <p><span className="font-bold text-foreground">Project:</span> {project.name || 'Unnamed'}</p>
              <p><span className="font-bold text-foreground">Client:</span> {project.client || 'N/A'}</p>
              <p><span className="font-bold text-foreground">Date:</span> {new Date().toLocaleDateString()}</p>
              <p>
                <span className="font-bold text-foreground">Status:</span>{' '}
                <span className={`uppercase font-bold tracking-wider text-xs ${activeOption.status === 'approved' ? 'text-green-500' : activeOption.status === 'review' ? 'text-primary' : 'text-muted-foreground'}`}>
                  {activeOption.status}
                </span>
              </p>
            </div>
          </div>

          {/* Client Notes */}
          {activeOption.clientNotes && (
            <div className="bg-primary/5 border border-primary/20 p-6  relative">
              <AlignLeft className="absolute top-6 left-6 w-5 h-5 text-primary/40" />
              <div className="pl-8">
                <h3 className="font-bold text-xs uppercase tracking-widest text-primary mb-2">Designer Notes</h3>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{activeOption.clientNotes}</p>
              </div>
            </div>
          )}

          {/* Scene Render */}
          {snapshotData && (
            <div className="space-y-4">
              <h3 className="font-bold border-b border-border pb-2 uppercase text-xs tracking-widest text-primary">Concept Visualization</h3>
              <div className="border border-border p-2 bg-black/20  overflow-hidden shadow-2xl">
                <img src={snapshotData} alt="Canvas Snapshot" className="w-full h-auto object-contain max-h-[500px] " />
              </div>
            </div>
          )}

          {/* Detailed Schedule */}
          <div className="space-y-4">
            <h3 className="font-bold border-b border-border pb-2 uppercase text-xs tracking-widest text-primary">Placements & Finishes</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {schedule.map(({ inst, product }, idx) => (
                <div key={inst.instanceId} className="border border-border bg-card p-4  flex flex-col justify-between hover:border-primary/50 transition-colors">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-sm text-foreground">{product!.name}</h4>
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">#{idx + 1}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">{product!.sku} | {product!.series}</p>
                    
                    <div className="space-y-2 text-xs">
                      {inst.finishSelection?.material && (
                        <div className="flex justify-between border-b border-border/50 pb-1">
                          <span className="text-muted-foreground">Material</span>
                          <span className="font-bold text-right">{inst.finishSelection.material}</span>
                        </div>
                      )}
                      {inst.finishSelection?.finish && (
                        <div className="flex justify-between border-b border-border/50 pb-1">
                          <span className="text-muted-foreground">Finish</span>
                          <span className="font-bold text-right">{inst.finishSelection.finish}</span>
                        </div>
                      )}
                      {inst.finishSelection?.hardware && (
                        <div className="flex justify-between border-b border-border/50 pb-1">
                          <span className="text-muted-foreground">Hardware</span>
                          <span className="font-bold text-right">{inst.finishSelection.hardware}</span>
                        </div>
                      )}
                      {inst.lighting?.enabled && (
                        <div className="flex justify-between border-b border-border/50 pb-1">
                          <span className="text-muted-foreground">Lighting</span>
                          <span className="font-bold text-right text-yellow-500">
                            {inst.lighting.type === 'led_strip' ? 'LED Strip' : inst.lighting.type} ({inst.lighting.colorTemp})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {schedule.length === 0 && (
                <div className="col-span-2 text-center py-8 text-muted-foreground text-sm">
                  No products placed in this option.
                </div>
              )}
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
