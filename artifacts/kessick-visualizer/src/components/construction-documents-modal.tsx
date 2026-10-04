import React, { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppStore } from '@/store';
import { useProducts } from '@/hooks/use-products';
import { Printer, Download, FileText, ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle } from 'lucide-react';
import { buildElevationModel } from '@/lib/elevation-model';
import { ElevationRenderer } from './elevation-renderer';
import { exportSchedulesCsv } from '@/lib/csv-export';
import { buildProductSchedule, buildFinishSchedule, buildLightingSchedule, buildOpeningSchedule, buildObstructionSchedule } from '@/lib/schedule-builders';
import { Revision, IssueStatus } from '@/types/construction-documents';
import { v4 as uuidv4 } from 'uuid';
import { BrandLogo } from './brand-logo';

export function ConstructionDocumentsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const store = useAppStore();
  const { project, entities, instances, pixelsPerInch, activeOption, options, constructionDocument: cd, commit } = store;
  const { data: products } = useProducts();

  const [activeSheet, setActiveSheet] = useState('G-001');
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Identify correct instances
  const cdSelectedOption = useMemo(() => options.find(o => o.id === (cd.selectedOptionId || activeOption.id)) || activeOption, [options, cd.selectedOptionId, activeOption]);
  const cdInstances = cdSelectedOption.instances;

  // Build schedules
  const productSchedule = useMemo(() => buildProductSchedule(cdInstances, products || []), [cdInstances, products]);
  const finishSchedule = useMemo(() => buildFinishSchedule(cdInstances, products || []), [cdInstances, products]);
  const lightingSchedule = useMemo(() => buildLightingSchedule(cdInstances, products || []), [cdInstances, products]);
  const openingSchedule = useMemo(() => buildOpeningSchedule(entities), [entities]);
  const obstructionSchedule = useMemo(() => buildObstructionSchedule(entities), [entities]);

  const elevationModel = useMemo(() => buildElevationModel(entities, cdInstances, products || [], pixelsPerInch), [entities, cdInstances, products, pixelsPerInch]);

  const hasIssues = elevationModel.issues.length > 0;
  const notCalibrated = !pixelsPerInch;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    exportSchedulesCsv(
      project.name || 'Project',
      productSchedule,
      finishSchedule,
      lightingSchedule,
      openingSchedule,
      obstructionSchedule
    );
  };

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name || 'elevation'}_A201.svg`.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateCd = (updater: (cd: typeof store.constructionDocument) => typeof store.constructionDocument) => {
    commit(s => {
      const updated = updater(s.constructionDocument);
      if (s.constructionDocument.status !== 'issued' && updated.status === 'issued') {
        store.recordActivity('Documents Issued', `Construction documents issued by ${updated.issuedBy || 'User'}.`, 'construction-documents');
      }
      return {
        ...s,
        constructionDocument: updated
      };
    });
  };

  const addRevision = () => {
    updateCd(cd => ({
      ...cd,
      revisions: [...cd.revisions, { id: uuidv4(), number: String(cd.revisions.length + 1), date: new Date().toISOString().split('T')[0], description: 'New Revision' }]
    }));
  };

  const updateRevision = (id: string, field: keyof Revision, value: string) => {
    updateCd(cd => ({
      ...cd,
      revisions: cd.revisions.map(r => r.id === id ? { ...r, [field]: value } : r)
    }));
  };

  const removeRevision = (id: string) => {
    updateCd(cd => ({
      ...cd,
      revisions: cd.revisions.filter(r => r.id !== id)
    }));
  };

  const TitleBlock = ({ sheetNum, sheetTitle }: { sheetNum: string, sheetTitle: string }) => (
    <div className="absolute right-0 bottom-0 top-0 w-[1.5in] border-l-2 border-black flex flex-col bg-white">
      <div className="flex-1 flex flex-col justify-end p-2 border-b border-black">
        <BrandLogo tone="dark" className="mb-2 h-auto w-full" />
        <p className="text-[0.4rem] leading-tight mt-1 font-bold uppercase tracking-wider">KESSICK WINE CELLARS<br/>KESSICK.COM</p>
      </div>
      
      <div className="h-[2in] border-b border-black p-2 flex flex-col text-[0.5rem]">
        <div className="font-bold mb-1">PROJECT:</div>
        <div className="mb-2">{project.name || 'Unnamed Project'}</div>
        <div className="font-bold mb-1">CLIENT:</div>
        <div className="mb-2">{project.client || 'TBD'}</div>
        <div className="font-bold mb-1">ADDRESS:</div>
        <div className="whitespace-pre-wrap">{project.address || 'TBD'}</div>
      </div>

      <div className="h-[1.5in] border-b border-black p-1 flex flex-col text-[0.4rem]">
        <div className="font-bold border-b border-black mb-1 pb-0.5">REVISIONS</div>
        <div className="flex-1 overflow-hidden">
          {cd.revisions.map(r => (
            <div key={r.id} className="flex gap-1 mb-1">
              <span className="w-4">{r.number}</span>
              <span className="w-10">{r.date}</span>
              <span className="flex-1 truncate">{r.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-[1in] border-b border-black p-2 flex flex-col text-[0.5rem] justify-between">
        <div className="flex justify-between"><span>DATE:</span> <span>{cd.issueDate}</span></div>
        <div className="flex justify-between"><span>DRAWN BY:</span> <span>{cd.issuedBy || project.surveyor || 'KESSICK'}</span></div>
        <div className="flex justify-between"><span>SCALE:</span> <span>{cd.drawingScale}</span></div>
        <div className="flex justify-between"><span>STATUS:</span> <span className="uppercase">{cd.status}</span></div>
      </div>

      <div className="h-[1in] p-2 flex flex-col justify-center items-center text-center">
        <div className="text-[0.6rem] font-bold mb-1">{sheetTitle}</div>
        <div className="text-2xl font-bold">{sheetNum}</div>
      </div>
    </div>
  );

  const SheetWrapper = ({ id, num, title, children }: { id: string, num: string, title: string, children: React.ReactNode }) => (
    <div 
      id={`sheet-${id}`}
      className={`print-cd-sheet bg-white border-0 sm:border border-gray-300 shadow-none sm:shadow-xl mx-auto mb-4 sm:mb-8 print:m-0 print:border-none print:shadow-none text-black font-sans w-full min-h-full md:w-[11in] md:h-[8.5in] relative overflow-visible md:overflow-hidden print:w-[11in] print:h-[8.5in] print:overflow-hidden ${activeSheet === id ? 'block print:block' : 'hidden print:block'}`}
    >
      <div className="md:hidden print:hidden px-4 py-3 border-b-2 border-black bg-gray-50">
        <div className="text-xs font-bold tracking-widest text-gray-500">{num}</div>
        <div className="text-lg font-bold">{title}</div>
      </div>
      <div className="relative p-4 sm:p-6 min-h-[calc(100dvh-12rem)] md:min-h-0 flex flex-col md:absolute md:inset-[0.25in] md:border-2 md:border-black md:mr-[1.75in] md:p-4 print:absolute print:inset-[0.25in] print:min-h-0 print:border-2 print:border-black print:mr-[1.75in] print:p-4">
        {children}
      </div>
      <div className="hidden md:block print:block"><TitleBlock sheetNum={num} sheetTitle={title} /></div>
    </div>
  );

  const sheets = [
    { id: 'G-001', num: 'G-001', title: 'COVER & NOTES' },
    { id: 'A-101', num: 'A-101', title: 'PLAN / PHOTO KEY' },
    { id: 'A-201', num: 'A-201', title: 'DIMENSIONED ELEVATION' },
    { id: 'A-601', num: 'A-601', title: 'PRODUCT SCHEDULES' },
    { id: 'A-602', num: 'A-602', title: 'COORDINATION SCHEDULE' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[100vw] w-screen h-[100dvh] max-h-screen m-0 p-0 rounded-none bg-background border-none flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-3 sm:px-4 py-2 border-b border-border bg-card no-print shrink-0 z-20 gap-2">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 min-w-0">
            <DialogTitle className="text-base sm:text-lg font-sans font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <FileText className="w-5 h-5" />
              <span className="truncate">Construction Documents</span>
            </DialogTitle>
            {(hasIssues || notCalibrated) && (
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-1">
                <AlertTriangle className="w-4 h-4" />
                {notCalibrated ? 'Drawing Not Calibrated' : 'Unresolved Issues'}
              </div>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:flex sm:items-center sm:gap-2">
            <Button data-testid="button-export-svg" variant="outline" size="sm" onClick={handleExportSvg} disabled={!svgRef.current} className="px-2">
              <Download className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Export SVG</span><span className="sr-only sm:hidden">Export SVG</span>
            </Button>
            <Button data-testid="button-export-csv" variant="outline" size="sm" onClick={handleExportCsv} className="px-2">
              <Download className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Export CSVs</span><span className="sr-only sm:hidden">Export CSVs</span>
            </Button>
            <Button data-testid="button-print-sheets" variant="default" size="sm" onClick={handlePrint} className="bg-primary text-primary-foreground px-2">
              <Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Print Sheet Set</span><span className="sr-only sm:hidden">Print sheet set</span>
            </Button>
            <Button data-testid="button-close-docs" variant="outline" size="sm" onClick={() => onOpenChange(false)} className="px-2">Close</Button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar */}
          <div className="hidden md:flex w-80 border-r border-border bg-card overflow-y-auto flex-col no-print shrink-0">
            <div className="p-4 border-b border-border space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Document Status</Label>
                <Select value={cd.status} onValueChange={(v: IssueStatus) => updateCd(c => ({ ...c, status: v }))}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft (WIP)</SelectItem>
                    <SelectItem value="for-review">For Review</SelectItem>
                    <SelectItem value="issued">Issued for Construction</SelectItem>
                    <SelectItem value="superseded">Superseded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Issued By</Label>
                <Input 
                  value={cd.issuedBy} 
                  onChange={e => updateCd(c => ({ ...c, issuedBy: e.target.value }))} 
                  className="mt-1 h-8" 
                  placeholder={project.surveyor || "Initials/Name"}
                />
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Issue Date</Label>
                <Input 
                  type="date"
                  value={cd.issueDate} 
                  onChange={e => updateCd(c => ({ ...c, issueDate: e.target.value }))} 
                  className="mt-1 h-8" 
                />
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Drawing Scale</Label>
                <Input 
                  value={cd.drawingScale} 
                  onChange={e => updateCd(c => ({ ...c, drawingScale: e.target.value }))} 
                  className="mt-1 h-8" 
                  placeholder="e.g. 1/2&quot; = 1'-0&quot;"
                />
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Design Option</Label>
                <Select value={cd.selectedOptionId || activeOption.id} onValueChange={v => updateCd(c => ({ ...c, selectedOptionId: v }))}>
                  <SelectTrigger className="mt-1 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.name} ({o.status})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 border-b border-border space-y-3">
              <div className="flex justify-between items-center">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Revisions</Label>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={addRevision}>+ Add</Button>
              </div>
              {cd.revisions.map(rev => (
                <div key={rev.id} className="flex gap-2 items-start border border-border p-2relative group">
                  <Input className="h-6 w-12 px-1 text-xs" value={rev.number} onChange={e => updateRevision(rev.id, 'number', e.target.value)} />
                  <Input className="h-6 w-24 px-1 text-xs" type="date" value={rev.date} onChange={e => updateRevision(rev.id, 'date', e.target.value)} />
                  <Input className="h-6 flex-1 px-1 text-xs" value={rev.description} onChange={e => updateRevision(rev.id, 'description', e.target.value)} />
                  <button onClick={() => removeRevision(rev.id)} className="absolute -top-2 -right-2 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100">&times;</button>
                </div>
              ))}
              {cd.revisions.length === 0 && <div className="text-xs text-muted-foreground">No revisions.</div>}
            </div>

            <div className="p-4 border-b border-border flex-1 flex flex-col">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2">General Notes</Label>
              <Textarea 
                className="flex-1 text-xs font-mono resize-none" 
                value={cd.generalNotes} 
                onChange={e => updateCd(c => ({ ...c, generalNotes: e.target.value }))}
              />
            </div>

          </div>

          {/* Sheet Viewer */}
          <div className="flex-1 min-w-0 bg-muted/30 overflow-auto p-0 sm:p-4 lg:p-8 flex flex-col items-center print:p-0 print:bg-white print:block no-scrollbar relative">
            
            <div className="flex w-full sm:w-auto gap-2 mb-2 sm:mb-4 sticky top-0 z-10 p-2 bg-background/95 backdrop-blur sm: border-b sm:border border-border shadow-sm no-print overflow-x-auto">
              {sheets.map(s => (
                <Button 
                  key={s.id} 
                  variant={activeSheet === s.id ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setActiveSheet(s.id)}
                  className={`shrink-0 ${activeSheet === s.id ? "bg-primary text-primary-foreground" : ""}`}
                >
                  {s.num}
                </Button>
              ))}
            </div>

            <div className="print-sheets-container w-full max-w-[11in]">
              
              {/* G-001 COVER & NOTES */}
              <SheetWrapper id="G-001" num="G-001" title="COVER & NOTES">
                <div className="flex flex-col md:flex-row h-full gap-6 md:gap-8">
                  <div className="flex-1">
                    <h1 className="text-5xl font-serif font-bold mb-4 uppercase">{project.name || 'Unnamed Project'}</h1>
                    <h2 className="text-xl mb-8 uppercase text-gray-600">Wine Cellar Construction Documents</h2>
                    
                    <div className="mb-12 text-sm max-w-sm border-l-4 border-black pl-4">
                      <div className="font-bold mb-1">PROJECT LOCATION</div>
                      <div className="mb-4">{project.address || 'TBD'}</div>
                      
                      <div className="font-bold mb-1">CLIENT</div>
                      <div className="mb-4">{project.client || 'TBD'}</div>
                    </div>

                    <div className="border border-black p-4 inline-block">
                      <h3 className="font-bold border-b border-black pb-1 mb-2">SHEET INDEX</h3>
                      <table className="text-sm text-left">
                        <tbody>
                          {sheets.map(s => (
                            <tr key={s.id}>
                              <td className="pr-4 py-1 font-bold">{s.num}</td>
                              <td className="py-1">{s.title}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="flex-1 border-t md:border-t-0 md:border-l border-black pt-6 md:pt-0 md:pl-8">
                    <h3 className="text-lg font-bold border-b-2 border-black pb-1 mb-4 uppercase">General Notes</h3>
                    <div className="whitespace-pre-wrap font-mono text-sm md:text-[10px] leading-relaxed">
                      {cd.generalNotes}
                    </div>
                    
                    {hasIssues && (
                      <div className="mt-8 border-2 border-red-500 p-4 bg-red-50">
                        <h4 className="text-red-700 font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> PRE-ISSUE WARNING</h4>
                        <p className="text-xs text-red-900">This layout contains unresolved collisions or clearance violations. Do not use for fabrication.</p>
                      </div>
                    )}
                    {notCalibrated && (
                      <div className="mt-4 border-2 border-orange-500 p-4 bg-orange-50">
                        <h4 className="text-orange-700 font-bold mb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5"/> UNCALIBRATED</h4>
                        <p className="text-xs text-orange-900">Survey dimensions are not calibrated to physical scale. All dimensions are estimates.</p>
                      </div>
                    )}
                  </div>
                </div>
              </SheetWrapper>

              {/* A-101 PLAN / PHOTO KEY */}
              <SheetWrapper id="A-101" num="A-101" title="PLAN / PHOTO KEY">
                <h3 className="text-lg font-bold border-b-2 border-black pb-1 mb-4 uppercase">Reference Plan / Existing Conditions</h3>
                <div className="flex-1 border border-black flex items-center justify-center bg-gray-50 relative overflow-hidden">
                  {store.roomImageDataUrl ? (
                    <img src={store.roomImageDataUrl} alt="Room" className="w-full h-full object-contain grayscale contrast-125 opacity-50" />
                  ) : (
                    <div className="text-gray-400 font-bold tracking-widest">NO SURVEY PHOTO PROVIDED</div>
                  )}
                  {/* Overlay a basic key plan box if calibrated */}
                  {pixelsPerInch && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <div className="border-4 border-black border-dashed w-3/4 h-3/4 flex items-center justify-center font-bold text-2xl rotate-[-5deg] opacity-30">
                         WALL ELEVATION BOUNDARY
                       </div>
                    </div>
                  )}
                </div>
              </SheetWrapper>

              {/* A-201 DIMENSIONED ELEVATION */}
              <SheetWrapper id="A-201" num="A-201" title="DIMENSIONED ELEVATION">
                <h3 className="text-lg font-bold border-b-2 border-black pb-1 mb-4 uppercase flex justify-between">
                  <span>Wall Elevation - Option {cdSelectedOption.name}</span>
                  <span className="text-sm font-normal">Scale: {cd.drawingScale}</span>
                </h3>
                <div className="flex-1 flex items-center justify-center overflow-hidden border border-black bg-white p-4">
                  <ElevationRenderer model={elevationModel} showDimensions={true} svgRef={svgRef} className="w-full h-full object-contain max-w-[8in] max-h-[6in]" />
                </div>
              </SheetWrapper>

              {/* A-601 PRODUCT SCHEDULES */}
              <SheetWrapper id="A-601" num="A-601" title="PRODUCT SCHEDULES">
                <div className="flex flex-col h-full gap-6">
                  
                  <div className="flex-1 overflow-x-auto md:overflow-hidden flex flex-col">
                    <h3 className="text-sm font-bold border-b-2 border-black pb-1 mb-2 uppercase bg-gray-100 px-2">Equipment Schedule</h3>
                    <table className="w-full min-w-[36rem] md:min-w-0 print:min-w-0 text-xs md:text-[9px] text-left border-collapse table-auto">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="py-1 px-1">QTY</th>
                          <th className="py-1 px-1">SKU</th>
                          <th className="py-1 px-1">DESCRIPTION</th>
                          <th className="py-1 px-1">SERIES</th>
                          <th className="py-1 px-1">W×H×D (IN)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {productSchedule.length === 0 ? <tr><td colSpan={5} className="py-2 text-center text-gray-500">NO PRODUCTS</td></tr> : null}
                        {productSchedule.map(s => (
                          <tr key={s.id}>
                            <td className="py-1 px-1 font-bold">{s.qty}</td>
                            <td className="py-1 px-1 font-mono">{s.product?.sku}</td>
                            <td className="py-1 px-1">{s.product?.name}</td>
                            <td className="py-1 px-1">{s.product?.series}</td>
                            <td className="py-1 px-1">{s.product?.width_in} × {s.product?.height_in} × {s.product?.depth_in}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex-1 overflow-x-auto md:overflow-hidden flex flex-col">
                    <h3 className="text-sm font-bold border-b-2 border-black pb-1 mb-2 uppercase bg-gray-100 px-2">Finish & Material Schedule</h3>
                    <table className="w-full min-w-[36rem] md:min-w-0 print:min-w-0 text-xs md:text-[9px] text-left border-collapse table-auto">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="py-1 px-1">QTY</th>
                          <th className="py-1 px-1">SKU</th>
                          <th className="py-1 px-1">MATERIAL</th>
                          <th className="py-1 px-1">FINISH</th>
                          <th className="py-1 px-1">HARDWARE</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {finishSchedule.length === 0 ? <tr><td colSpan={5} className="py-2 text-center text-gray-500">NO FINISHES SPECIFIED</td></tr> : null}
                        {finishSchedule.map(s => (
                          <tr key={s.id}>
                            <td className="py-1 px-1 font-bold">{s.qty}</td>
                            <td className="py-1 px-1 font-mono">{s.product?.sku}</td>
                            <td className="py-1 px-1">{s.instance?.finishSelection?.material || 'Standard'}</td>
                            <td className="py-1 px-1">{s.instance?.finishSelection?.finish || 'Standard'}</td>
                            <td className="py-1 px-1">{s.instance?.finishSelection?.hardware || 'Standard'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex-1 overflow-x-auto md:overflow-hidden flex flex-col">
                    <h3 className="text-sm font-bold border-b-2 border-black pb-1 mb-2 uppercase bg-gray-100 px-2">Lighting Schedule</h3>
                    <table className="w-full min-w-[40rem] md:min-w-0 print:min-w-0 text-xs md:text-[9px] text-left border-collapse table-auto">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="py-1 px-1">QTY</th>
                          <th className="py-1 px-1">SKU</th>
                          <th className="py-1 px-1">TYPE</th>
                          <th className="py-1 px-1">COLOR TEMP</th>
                          <th className="py-1 px-1">INTENSITY</th>
                          <th className="py-1 px-1">DIMMING</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {lightingSchedule.length === 0 ? <tr><td colSpan={6} className="py-2 text-center text-gray-500">NO LIGHTING SPECIFIED</td></tr> : null}
                        {lightingSchedule.map(s => (
                          <tr key={s.id}>
                            <td className="py-1 px-1 font-bold">{s.qty}</td>
                            <td className="py-1 px-1 font-mono">{s.product?.sku}</td>
                            <td className="py-1 px-1 uppercase">{s.instance?.lighting?.type?.replace('_', ' ')}</td>
                            <td className="py-1 px-1">{s.instance?.lighting?.colorTemp}</td>
                            <td className="py-1 px-1">{s.instance?.lighting?.intensity}%</td>
                            <td className="py-1 px-1">{s.instance?.lighting?.dimming ? 'YES' : 'NO'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                </div>
              </SheetWrapper>

              {/* A-602 COORDINATION SCHEDULE */}
              <SheetWrapper id="A-602" num="A-602" title="COORDINATION SCHEDULE">
                <div className="flex flex-col h-full gap-6">
                  
                  <div className="flex-1 overflow-x-auto md:overflow-hidden flex flex-col">
                    <h3 className="text-sm font-bold border-b-2 border-black pb-1 mb-2 uppercase bg-gray-100 px-2">Openings</h3>
                    <table className="w-full min-w-[36rem] md:min-w-0 print:min-w-0 text-xs md:text-[10px] text-left border-collapse table-auto">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="py-1 px-1">ID</th>
                          <th className="py-1 px-1">TYPE</th>
                          <th className="py-1 px-1">WIDTH (PX)</th>
                          <th className="py-1 px-1">HEIGHT (PX)</th>
                          <th className="py-1 px-1">LOCATION (X,Y)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {openingSchedule.length === 0 ? <tr><td colSpan={5} className="py-2 text-center text-gray-500">NO OPENINGS</td></tr> : null}
                        {openingSchedule.map(s => (
                          <tr key={s.id}>
                            <td className="py-1 px-1 font-mono text-[8px]">{s.id.split('-')[0]}</td>
                            <td className="py-1 px-1 uppercase">{s.entity?.type === 'opening' && s.entity.openingType}</td>
                            <td className="py-1 px-1">{s.entity?.type === 'opening' && s.entity.rect.w}</td>
                            <td className="py-1 px-1">{s.entity?.type === 'opening' && s.entity.rect.h}</td>
                            <td className="py-1 px-1">{s.entity?.type === 'opening' && `${s.entity.rect.x}, ${s.entity.rect.y}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex-1 overflow-x-auto md:overflow-hidden flex flex-col">
                    <h3 className="text-sm font-bold border-b-2 border-black pb-1 mb-2 uppercase bg-gray-100 px-2">Obstructions & Utilities</h3>
                    <table className="w-full min-w-[36rem] md:min-w-0 print:min-w-0 text-xs md:text-[10px] text-left border-collapse table-auto">
                      <thead>
                        <tr className="border-b border-black">
                          <th className="py-1 px-1">ID</th>
                          <th className="py-1 px-1">TYPE</th>
                          <th className="py-1 px-1">WIDTH (PX)</th>
                          <th className="py-1 px-1">HEIGHT (PX)</th>
                          <th className="py-1 px-1">LOCATION (X,Y)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-300">
                        {obstructionSchedule.length === 0 ? <tr><td colSpan={5} className="py-2 text-center text-gray-500">NO OBSTRUCTIONS</td></tr> : null}
                        {obstructionSchedule.map(s => (
                          <tr key={s.id}>
                            <td className="py-1 px-1 font-mono text-[8px]">{s.id.split('-')[0]}</td>
                            <td className="py-1 px-1 uppercase">{s.entity?.type === 'obstruction' && s.entity.obstructionType}</td>
                            <td className="py-1 px-1">{s.entity?.type === 'obstruction' && s.entity.rect.w}</td>
                            <td className="py-1 px-1">{s.entity?.type === 'obstruction' && s.entity.rect.h}</td>
                            <td className="py-1 px-1">{s.entity?.type === 'obstruction' && `${s.entity.rect.x}, ${s.entity.rect.y}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hasIssues && (
                    <div className="border border-red-500 p-2">
                      <h3 className="text-sm font-bold text-red-600 border-b border-red-200 pb-1 mb-2 uppercase flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4"/> Coordination Issues
                      </h3>
                      <ul className="text-[10px] space-y-1 text-red-900">
                        {elevationModel.issues.map(iss => (
                          <li key={iss.id}>&bull; {iss.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                </div>
              </SheetWrapper>

            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}