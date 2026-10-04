import { useAppStore, updateActiveInstances } from '@/store';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { validateLayout } from '@/lib/design-geometry';
import { useProducts } from '@/hooks/use-products';
import { AlertTriangle, CheckCircle, Copy, Plus, Trash2, Pencil, Presentation } from 'lucide-react';
import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DesignOption, ProductInstance } from '@/types/design';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { reconcileInstance, resolveProductForInstance, validateProductConfiguration } from '@/lib/catalog-domain';

export function InspectorPanel({ onClose }: { onClose?: () => void }) {
  const store = useAppStore();
  const { 
    options, activeOption, activeOptionId, setActiveOptionId, 
    instances, entities, selectedIds, setSelectedIds, commit, pixelsPerInch 
  } = store;
  
  const { data: products } = useProducts();
  const [editingOption, setEditingOption] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);

  // Determine what is selected
  const selectedProductInst = instances.find(i => selectedIds.includes(i.instanceId));
  const selectedProduct = selectedProductInst ? resolveProductForInstance(selectedProductInst, products ?? []) : null;
  const catalogWarnings = selectedProductInst ? reconcileInstance(selectedProductInst, products ?? []).warnings : [];
  const selectedEntity = entities.find(e => selectedIds.includes(e.id));

  const validationIssues = useMemo(() => {
    if (!pixelsPerInch || !products) return [];
    return validateLayout(instances, entities, products, pixelsPerInch);
  }, [instances, entities, products, pixelsPerInch]);

  const handleUpdateOption = (updates: Partial<DesignOption>) => {
    commit(s => ({
      ...s,
      options: s.options.map(o => o.id === s.activeOptionId ? { ...o, ...updates } : o)
    }));
  };

  const handleCreateOption = () => {
    const id = uuidv4();
    commit(s => ({
      ...s,
      options: [...s.options, {
        id,
        name: `Option ${s.options.length + 1}`,
        status: 'concept',
        instances: [],
        clientNotes: '',
        presentationSettings: { showDimensions: true, showClearances: true, showLighting: true }
      }],
      activeOptionId: id
    }));
    setSelectedIds([]);
  };

  const handleDuplicateOption = () => {
    const id = uuidv4();
    commit(s => ({
      ...s,
      options: [...s.options, {
        ...activeOption,
        id,
        name: `${activeOption.name} (Copy)`,
        status: 'concept'
      }],
      activeOptionId: id
    }));
    setSelectedIds([]);
  };

  const handleDeleteOption = () => {
    if (options.length <= 1) return;
    const newOptions = options.filter(o => o.id !== activeOptionId);
    commit(s => ({
      ...s,
      options: newOptions,
      activeOptionId: newOptions[0].id
    }));
    setSelectedIds([]);
  };

  const handleUpdateInstance = (id: string, updates: Partial<ProductInstance>) => {
    const current = instances.find(instance => instance.instanceId === id);
    const product = current ? resolveProductForInstance(current, products ?? []) : undefined;
    if (current && product) {
      const candidate = { ...current, ...updates };
      const existingIssues = new Set(validateProductConfiguration(product, current)
        .filter(warning => warning.kind === 'compatibility').map(warning => warning.message));
      const issue = validateProductConfiguration(product, candidate)
        .find(warning => warning.kind === 'compatibility' && !existingIssues.has(warning.message));
      if (issue) {
        setConfigurationError(issue.message);
        return;
      }
    }
    setConfigurationError(null);
    commit(s => updateActiveInstances(s, insts => insts.map(i => i.instanceId === id ? { ...i, ...updates } : i)));
  };

  const handleUpdateEntity = (id: string, updates: any) => {
    commit(s => ({
      ...s,
      entities: s.entities.map(e => e.id === id ? { ...e, ...updates } : e)
    }));
  };

  return (
    <div className="w-full shrink-0 flex flex-col z-10 h-full bg-card">
      
      {/* Top Action Bar - Options */}
      <div className="p-4 border-b border-border bg-sidebar/50 shrink-0 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Properties</h2>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6 md:hidden text-muted-foreground hover:text-foreground" onClick={onClose} data-testid="close-inspector">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </Button>
          )}
        </div>
        
        <div className="flex flex-col gap-2 bg-background p-2 border border-border">
          <div className="flex items-center gap-2">
            {editingOption ? (
              <Input 
                value={activeOption.name}
                onChange={e => handleUpdateOption({ name: e.target.value })}
                onBlur={() => setEditingOption(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingOption(false)}
                className="h-8 text-sm font-bold bg-transparent"
                autoFocus
              />
            ) : (
              <div className="flex items-center flex-1 gap-2 px-2 h-8">
                <span className="flex-1 text-sm font-bold uppercase tracking-wider truncate text-primary">{activeOption.name}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={() => setEditingOption(true)}>
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
            <Select value={activeOptionId} onValueChange={setActiveOptionId}>
              <SelectTrigger className="w-10 h-8 bg-transparent border-none text-xs px-2 [&>span]:hidden">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(o => (
                  <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center justify-between px-1">
            <Select value={activeOption.status} onValueChange={(v: any) => handleUpdateOption({ status: v })}>
              <SelectTrigger className="w-[120px] h-6 bg-transparent border-none text-xs px-1 gap-1 text-muted-foreground hover:text-foreground">
                {activeOption.status === 'concept' ? <Pencil className="w-3 h-3" /> :
                 activeOption.status === 'review' ? <Presentation className="w-3 h-3" /> :
                 <CheckCircle className="w-3 h-3 text-green-500" />}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concept">Concept</SelectItem>
                <SelectItem value="review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={handleCreateOption} title="New Option">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={handleDuplicateOption} title="Duplicate Option">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={handleDeleteOption} disabled={options.length <= 1} title="Delete Option">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          
          {validationIssues.length > 0 && !selectedProductInst && !selectedEntity && (
            <div className="p-3 border border-destructive/20 bg-destructive/10">
              <div className="flex items-center gap-2 text-destructive font-bold text-xs mb-2 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4" /> Layout Exceptions ({validationIssues.length})
              </div>
              <ul className="text-xs text-destructive-foreground space-y-1 list-disc pl-4">
                {validationIssues.map(w => (
                  <li key={w.id}>{w.message}</li>
                ))}
              </ul>
            </div>
          )}

          {/* PRODUCT INSPECTOR */}
          {selectedProductInst && selectedProduct && (
            <div className="space-y-6 animate-in fade-in">
              <div className="pb-4 border-b border-border">
                <h3 className="font-bold text-xs text-primary uppercase tracking-wider mb-1">Product Details</h3>
                <p className="text-sm text-foreground font-semibold leading-tight">{selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground mt-1">SKU: {selectedProduct.sku}</p>
              </div>
              {catalogWarnings.length > 0 && (
                <div className="border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-amber-500"><AlertTriangle className="h-4 w-4" /> Catalog review</div>
                  <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                    {catalogWarnings.map((warning, index) => <li key={`${warning.kind}-${warning.field}-${index}`}>{warning.message}</li>)}
                  </ul>
                </div>
              )}
              {configurationError && <div role="alert" className="border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{configurationError}</div>}

              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Finishes & Materials</h4>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Material</Label>
                  <Select
                    value={selectedProductInst.finishSelection?.material || ''}
                    onValueChange={v => handleUpdateInstance(selectedProductInst.instanceId, { finishSelection: { ...selectedProductInst.finishSelection, material: v }})}
                  >
                    <SelectTrigger className="bg-background text-foreground border-border text-xs h-9">
                      <SelectValue placeholder="Standard Material" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProduct.materials?.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Finish</Label>
                  <Select
                    value={selectedProductInst.finishSelection?.finish || ''}
                    onValueChange={v => handleUpdateInstance(selectedProductInst.instanceId, { finishSelection: { ...selectedProductInst.finishSelection, finish: v }})}
                  >
                    <SelectTrigger className="bg-background text-foreground border-border text-xs h-9">
                      <SelectValue placeholder="Standard Finish" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProduct.finishes?.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct.hardware_finishes && selectedProduct.hardware_finishes.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Hardware Finish</Label>
                    <Select
                      value={selectedProductInst.finishSelection?.hardware || ''}
                      onValueChange={v => handleUpdateInstance(selectedProductInst.instanceId, {
                        finishSelection: { ...selectedProductInst.finishSelection, hardware: v },
                      })}
                    >
                      <SelectTrigger
                        data-testid={`select-hardware-${selectedProductInst.instanceId}`}
                        className="bg-background text-foreground border-border text-xs h-9"
                      >
                        <SelectValue placeholder="Standard Hardware" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedProduct.hardware_finishes.map(hardware => (
                          <SelectItem key={hardware} value={hardware}>{hardware}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {selectedProduct.features?.some(f => f.toLowerCase().includes('led') || f.toLowerCase().includes('lighting')) && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Lighting Plan</h4>
                    <Switch 
                      checked={selectedProductInst.lighting?.enabled || false}
                      onCheckedChange={v => handleUpdateInstance(selectedProductInst.instanceId, { lighting: { ...(selectedProductInst.lighting || { type: 'led_strip', colorTemp: '3000K', intensity: 80, dimming: false, notes: '' }), enabled: v }})}
                    />
                  </div>

                  {selectedProductInst.lighting?.enabled && (
                    <div className="space-y-4 bg-muted/20 p-3 border border-border">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Fixture Type</Label>
                        <Select
                          value={selectedProductInst.lighting.type}
                          onValueChange={(v: any) => handleUpdateInstance(selectedProductInst.instanceId, { lighting: { ...selectedProductInst.lighting!, type: v }})}
                        >
                          <SelectTrigger className="bg-background text-foreground border-border text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="led_strip">LED Strip (Channels)</SelectItem>
                            <SelectItem value="puck">Puck Lights</SelectItem>
                            <SelectItem value="spot">Spot/Display</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Color Temperature</Label>
                        <Select
                          value={selectedProductInst.lighting.colorTemp}
                          onValueChange={(v: any) => handleUpdateInstance(selectedProductInst.instanceId, { lighting: { ...selectedProductInst.lighting!, colorTemp: v }})}
                        >
                          <SelectTrigger className="bg-background text-foreground border-border text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="2700K">2700K (Warm White)</SelectItem>
                            <SelectItem value="3000K">3000K (Soft White)</SelectItem>
                            <SelectItem value="4000K">4000K (Cool White)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3 pt-2">
                        <div className="flex justify-between">
                          <Label className="text-xs text-muted-foreground">Intensity</Label>
                          <span className="text-xs font-bold text-primary">{selectedProductInst.lighting.intensity}%</span>
                        </div>
                        <Slider
                          value={[selectedProductInst.lighting.intensity]}
                          min={10} max={100} step={10}
                          onValueChange={v => handleUpdateInstance(selectedProductInst.instanceId, { lighting: { ...selectedProductInst.lighting!, intensity: v[0] }})}
                          className="py-1"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2">
                        <Label className="text-xs text-foreground">Dimming compatible</Label>
                        <Switch
                          data-testid={`switch-dimming-${selectedProductInst.instanceId}`}
                          checked={selectedProductInst.lighting.dimming}
                          onCheckedChange={v => handleUpdateInstance(selectedProductInst.instanceId, {
                            lighting: { ...selectedProductInst.lighting!, dimming: v },
                          })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SURVEY ENTITY INSPECTOR */}
          {selectedEntity && !selectedProductInst && (
            <div className="space-y-6 animate-in fade-in">
              <div className="pb-4 border-b border-border">
                <h3 className="font-bold text-xs text-primary uppercase tracking-wider mb-1">Survey Element</h3>
                <p className="text-sm text-foreground font-semibold leading-tight capitalize">{selectedEntity.type}</p>
              </div>
              
              {selectedEntity.type === 'opening' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Opening Type</Label>
                  <Select
                    value={selectedEntity.openingType}
                    onValueChange={(v) => handleUpdateEntity(selectedEntity.id, { openingType: v })}
                  >
                    <SelectTrigger className="bg-background text-foreground border-border h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="door">Door</SelectItem>
                      <SelectItem value="window">Window</SelectItem>
                      <SelectItem value="pass-through">Pass-through</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedEntity.type === 'obstruction' && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Obstruction Type</Label>
                  <Select
                    value={selectedEntity.obstructionType}
                    onValueChange={(v) => handleUpdateEntity(selectedEntity.id, { obstructionType: v })}
                  >
                    <SelectTrigger className="bg-background text-foreground border-border h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="outlet">Outlet</SelectItem>
                      <SelectItem value="switch">Switch</SelectItem>
                      <SelectItem value="HVAC">HVAC Vent</SelectItem>
                      <SelectItem value="pipe">Pipe/Plumbing</SelectItem>
                      <SelectItem value="column">Structural Column</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedEntity.type === 'annotation' && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Severity</Label>
                    <Select
                      value={selectedEntity.severity}
                      onValueChange={(v) => handleUpdateEntity(selectedEntity.id, { severity: v })}
                    >
                      <SelectTrigger className="bg-background text-foreground border-border h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="info">Information</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="danger">Danger / Block</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Note Text</Label>
                    <Input
                      className="bg-background h-9"
                      value={selectedEntity.text}
                      onChange={(e) => handleUpdateEntity(selectedEntity.id, { text: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* GLOBAL SETTINGS (When nothing is selected) */}
          {!selectedProductInst && !selectedEntity && (
            <div className="space-y-6 animate-in fade-in text-left">
              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Presentation Settings</h4>
                <div className="space-y-3 bg-muted/20 p-3 border border-border">
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={activeOption.presentationSettings.showDimensions}
                      onCheckedChange={v => handleUpdateOption({ presentationSettings: { ...activeOption.presentationSettings, showDimensions: v } })}
                    />
                    <Label className="text-xs font-medium cursor-pointer">Show Dimensions</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={activeOption.presentationSettings.showClearances}
                      onCheckedChange={v => handleUpdateOption({ presentationSettings: { ...activeOption.presentationSettings, showClearances: v } })}
                    />
                    <Label className="text-xs font-medium cursor-pointer">Show Clearances</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch 
                      checked={activeOption.presentationSettings.showLighting}
                      onCheckedChange={v => handleUpdateOption({ presentationSettings: { ...activeOption.presentationSettings, showLighting: v } })}
                    />
                    <Label className="text-xs font-medium cursor-pointer">Render Lighting</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Client Notes</h4>
                <Textarea 
                  value={activeOption.clientNotes}
                  onChange={e => handleUpdateOption({ clientNotes: e.target.value })}
                  placeholder="Notes for client proposal or presentation..."
                  className="min-h-[140px] text-xs bg-background resize-y border-border focus-visible:ring-primary"
                />
              </div>
              
              {instances.length === 0 && entities.length === 0 && (
                <div className="text-center pt-8 text-muted-foreground">
                  <p className="text-sm">Workspace is empty.</p>
                  <p className="text-xs mt-2">Upload a photo, set scale, and add products from the catalog.</p>
                </div>
              )}
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}
