import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { useProducts } from '@/hooks/use-products';
import { Printer, Download, Upload } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { exportProjectJSON } from '@/lib/persistence';
import { buildProductSchedule } from '@/lib/schedule-builders';
import { BrandLogo } from './brand-logo';

export function ReportModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const store = useAppStore();
  const { project, entities, instances, unit, pixelsPerInch, activeOption } = store;
  const { data: products } = useProducts();
  const [snapshotData, setSnapshotData] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      // Capture canvas
      const canvas = document.querySelector('canvas');
      if (canvas) {
        setSnapshotData(canvas.toDataURL('image/jpeg', 0.8));
      }
    } else {
      setSnapshotData(null);
    }
  }, [open]);

  const schedule = useMemo(() => {
    if (!products) return [];
    return buildProductSchedule(instances, products)
      .filter(item => item.product)
      .map(item => ({ ...item.product!, qty: item.qty }));
  }, [instances, products]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPNG = () => {
    if (snapshotData) {
      const a = document.createElement('a');
      a.href = snapshotData;
      a.download = `kessick_survey_${project.name.replace(/\s+/g, '_')}.jpg`;
      a.click();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] w-full max-h-[90vh] overflow-y-auto bg-card border-border text-foreground p-0">
        
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10 no-print">
          <DialogHeader className="p-0">
            <DialogTitle className="text-lg font-sans font-bold uppercase tracking-widest text-primary">Survey & Layout Report</DialogTitle>
            <DialogDescription className="text-muted-foreground">Print or export this report for client sign-off or factory drafting.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => exportProjectJSON(store)}>
              <Download className="w-4 h-4" /> Export JSON
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPNG} disabled={!snapshotData}>
              <Download className="w-4 h-4" /> Save Image
            </Button>
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print PDF
            </Button>
          </div>
        </div>

        <div className="p-8 print:p-0 print:text-black print:bg-white print-report bg-card" id="printable-report">
          
          <div className="flex justify-between items-start border-b-2 border-primary pb-4 mb-6">
            <div>
              <div className="mb-2">
                <BrandLogo tone="dark" className="hidden h-8 print:block" />
                <BrandLogo tone="light" className="block h-8 print:hidden" />
              </div>
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground print:text-gray-600">Site Survey & Product Layout</p>
            </div>
            <div className="text-right text-sm space-y-1">
              <p><span className="font-bold print:text-gray-600">Project:</span> {project.name || 'Unnamed'}</p>
              <p><span className="font-bold print:text-gray-600">Client:</span> {project.client || 'N/A'}</p>
              <p><span className="font-bold print:text-gray-600">Site:</span> {project.address || 'N/A'}</p>
              <p><span className="font-bold print:text-gray-600">Surveyor:</span> {project.surveyor || 'N/A'} &nbsp;|&nbsp; <span className="font-bold print:text-gray-600">Date:</span> {project.surveyDate}</p>
              <p className="mt-2 text-primary font-bold print:text-gray-800">Option: {store.activeOption?.name}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-6">
            <div className="col-span-2">
              <h3 className="font-bold border-b border-border print:border-gray-300 pb-1 mb-3 uppercase text-xs tracking-widest text-primary print:text-black">Measured Conditions</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-bold">Scale: </span> 
                  {pixelsPerInch ? `${pixelsPerInch.toFixed(1)} px / in` : 'Not Calibrated'}
                </div>
                <div>
                  <span className="font-bold">Total Survey Entities: </span> 
                  {entities.length}
                </div>
                <div className="col-span-2 text-muted-foreground print:text-gray-700 mt-2">
                  <span className="font-bold text-foreground print:text-black block mb-1">Survey Notes:</span>
                  {project.notes || 'No notes provided.'}
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold border-b border-border print:border-gray-300 pb-1 mb-3 uppercase text-xs tracking-widest text-primary print:text-black">Survey Summary</h3>
              <ul className="text-sm space-y-1">
                <li><span className="font-bold">Walls:</span> {entities.filter(e => e.type === 'wall').length}</li>
                <li><span className="font-bold">Openings:</span> {entities.filter(e => e.type === 'opening').length}</li>
                <li><span className="font-bold">Obstructions:</span> {entities.filter(e => e.type === 'obstruction').length}</li>
                <li><span className="font-bold">Annotations:</span> {entities.filter(e => e.type === 'annotation').length}</li>
              </ul>
            </div>
          </div>

          {snapshotData && (
            <div className="mb-8 page-break-inside-avoid">
              <h3 className="font-bold border-b border-border print:border-gray-300 pb-1 mb-3 uppercase text-xs tracking-widest text-primary print:text-black">Visual Layout</h3>
              <div className="border border-border print:border-gray-400 p-2 bg-black/5">
                <img src={snapshotData} alt="Canvas Snapshot" className="w-full h-auto object-contain max-h-[400px]" />
              </div>
            </div>
          )}

          <div className="page-break-inside-avoid">
            <h3 className="font-bold border-b border-border print:border-gray-300 pb-1 mb-3 uppercase text-xs tracking-widest text-primary print:text-black">Product Schedule ({instances.length} Total Items)</h3>
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border print:border-gray-300 text-muted-foreground print:text-gray-600 uppercase text-xs tracking-wider">
                  <th className="py-2 font-bold">Qty</th>
                  <th className="py-2 font-bold">SKU</th>
                  <th className="py-2 font-bold">Description</th>
                  <th className="py-2 font-bold">Series</th>
                  <th className="py-2 font-bold">Dims (W×H×D)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 print:divide-gray-200">
                {schedule.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-muted-foreground">No products in layout.</td>
                  </tr>
                ) : (
                  schedule.map(p => (
                    <tr key={p.id}>
                      <td className="py-2 font-bold">{p.qty}</td>
                      <td className="py-2 text-primary print:text-black">{p.sku}</td>
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.series}</td>
                      <td className="py-2">
                        {p.width_in}" × {p.height_in}" × {p.depth_in}"
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
