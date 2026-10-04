import { useAppStore, updateActiveInstances } from '@/store';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { validateLayout } from '@/lib/design-geometry';
import { useProducts } from '@/hooks/use-products';
import { AlertTriangle, CheckCircle, Copy, Plus, Trash2, Pencil, CheckSquare, Presentation } from 'lucide-react';
import { useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DesignOption, ProductInstance } from '@/types/design';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { reconcileInstance, resolveProductForInstance, validateProductConfiguration } from '@/lib/catalog-domain';

export function DesignTab() {
  const { 
    options, activeOption, activeOptionId, setActiveOptionId, 
    instances, entities, selectedIds, setSelectedIds, commit, pixelsPerInch
  } = useAppStore();
  const { data: products } = useProducts();

  const [editingOption, setEditingOption] = useState(false);
  const [configurationError, setConfigurationError] = useState<string | null>(null);

  const selectedInst = instances.find(i => selectedIds.includes(i.instanceId));
  const selectedProduct = selectedInst ? resolveProductForInstance(selectedInst, products ?? []) : null;
  const catalogWarnings = selectedInst ? reconcileInstance(selectedInst, products ?? []).warnings : [];

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

  const validationIssues = useMemo(() => {
    if (!pixelsPerInch || !products) return [];
    return validateLayout(instances, entities, products, pixelsPerInch);
  }, [instances, entities, products, pixelsPerInch]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* Options Header */}
      <div className="p-3 border-b border-border bg-card shrink-0 space-y-3">
        <div className="flex items-center gap-2">
          {editingOption ? (
            <Input 
              value={activeOption.name}
              onChange={e => handleUpdateOption({ name: e.target.value })}
              onBlur={() => setEditingOption(false)}
              onKeyDown={e => e.key === 'Enter' && setEditingOption(false)}
              className="h-8 text-sm font-bold"
              autoFocus
            />
          ) : (
            <div className="flex items-center flex-1 gap-2 border border-input  px-3 h-8 bg-background">
              <span className="flex-1 text-sm font-bold truncate">{activeOption.name}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-muted" onClick={() => setEditingOption(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
          <Select value={activeOptionId} onValueChange={setActiveOptionId}>
            <SelectTrigger className="w-[120px] h-8 bg-background border-border text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(o => (
                <SelectItem key={o.id} value={o.id} className="text-xs">{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Select value={activeOption.status} onValueChange={(v: any) => handleUpdateOption({ status: v })}>
              <SelectTrigger className="w-[110px] h-7 bg-background border-border text-xs gap-1">
                {activeOption.status === 'concept' ? <Pencil className="w-3 h-3 text-muted-foreground" /> :
                 activeOption.status === 'review' ? <Presentation className="w-3 h-3 text-primary" /> :
                 <CheckCircle className="w-3 h-3 text-green-500" />}
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concept">Concept</SelectItem>
                <SelectItem value="review">In Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleCreateOption} title="New Option" data-testid="btn-new-option">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleDuplicateOption} title="Duplicate Option" data-testid="btn-dup-option">
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7 hover:text-destructive" onClick={handleDeleteOption} disabled={options.length <= 1} title="Delete Option">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        
        {validationIssues.length > 0 && (
          <div className="m-3 p-3 border border-destructive/20 bg-destructive/10 ">
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

        {selectedInst && selectedProduct ? (
          <div className="p-4 space-y-6">
            <div className="pb-4 border-b border-border">
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider mb-1">Placement Details</h3>
              <p className="text-xs text-muted-foreground">{selectedProduct.name}</p>
            </div>
            {catalogWarnings.length > 0 && (
              <div className=" border border-amber-500/30 bg-amber-500/10 p-3">
                <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase text-amber-500"><AlertTriangle className="h-4 w-4" /> Catalog review</div>
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {catalogWarnings.map((warning, index) => <li key={`${warning.kind}-${warning.field}-${index}`}>{warning.message}</li>)}
                </ul>
              </div>
            )}
            {configurationError && <div role="alert" className=" border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">{configurationError}</div>}

            {/* Finishes */}
            <div className="space-y-4">
              <h4 className="font-bold text-xs uppercase tracking-wider">Finishes & Materials</h4>
              
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <Select
                  value={selectedInst.finishSelection?.material || ''}
                  onValueChange={v => handleUpdateInstance(selectedInst.instanceId, { finishSelection: { ...selectedInst.finishSelection, material: v }})}
                >
                  <SelectTrigger data-testid={`select-material-${selectedInst.instanceId}`} className="bg-background text-foreground border-border text-xs h-8">
                    <SelectValue placeholder="Default Material" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProduct.materials?.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Finish</Label>
                <Select
                  value={selectedInst.finishSelection?.finish || ''}
                  onValueChange={v => handleUpdateInstance(selectedInst.instanceId, { finishSelection: { ...selectedInst.finishSelection, finish: v }})}
                >
                  <SelectTrigger data-testid={`select-finish-${selectedInst.instanceId}`} className="bg-background text-foreground border-border text-xs h-8">
                    <SelectValue placeholder="Default Finish" />
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
                    value={selectedInst.finishSelection?.hardware || ''}
                    onValueChange={v => handleUpdateInstance(selectedInst.instanceId, { finishSelection: { ...selectedInst.finishSelection, hardware: v }})}
                  >
                    <SelectTrigger className="bg-background text-foreground border-border text-xs h-8">
                      <SelectValue placeholder="Default Hardware" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedProduct.hardware_finishes?.map(hf => <SelectItem key={hf} value={hf}>{hf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Lighting */}
            {selectedProduct.features?.some(f => f.toLowerCase().includes('led') || f.toLowerCase().includes('lighting')) && (
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs uppercase tracking-wider">Lighting Plan</h4>
                  <Switch 
                    checked={selectedInst.lighting?.enabled || false}
                    onCheckedChange={v => handleUpdateInstance(selectedInst.instanceId, { lighting: { ...(selectedInst.lighting || { type: 'led_strip', colorTemp: '3000K', intensity: 80, dimming: false, notes: '' }), enabled: v }})}
                  />
                </div>

                {selectedInst.lighting?.enabled && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Fixture Type</Label>
                      <Select
                        value={selectedInst.lighting.type}
                        onValueChange={(v: any) => handleUpdateInstance(selectedInst.instanceId, { lighting: { ...selectedInst.lighting!, type: v }})}
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
                        value={selectedInst.lighting.colorTemp}
                        onValueChange={(v: any) => handleUpdateInstance(selectedInst.instanceId, { lighting: { ...selectedInst.lighting!, colorTemp: v }})}
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

                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs text-muted-foreground">Intensity</Label>
                        <span className="text-xs font-bold">{selectedInst.lighting.intensity}%</span>
                      </div>
                      <Slider
                        value={[selectedInst.lighting.intensity]}
                        min={10} max={100} step={10}
                        onValueChange={v => handleUpdateInstance(selectedInst.instanceId, { lighting: { ...selectedInst.lighting!, intensity: v[0] }})}
                      />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Switch 
                        checked={selectedInst.lighting.dimming}
                        onCheckedChange={v => handleUpdateInstance(selectedInst.instanceId, { lighting: { ...selectedInst.lighting!, dimming: v }})}
                      />
                      <Label className="text-xs">Dimming System Compatible</Label>
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        ) : (
          <div className="p-6 text-center">
            <p className="text-xs text-muted-foreground mb-4">Select a product on the canvas to configure finishes and lighting, or adjust option settings below.</p>
            
            <div className="text-left space-y-4 border-t border-border pt-6 mt-6">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary">Presentation Settings</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={activeOption.presentationSettings.showDimensions}
                    onCheckedChange={v => handleUpdateOption({ presentationSettings: { ...activeOption.presentationSettings, showDimensions: v } })}
                  />
                  <Label className="text-xs">Show Dimensions</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={activeOption.presentationSettings.showClearances}
                    onCheckedChange={v => handleUpdateOption({ presentationSettings: { ...activeOption.presentationSettings, showClearances: v } })}
                  />
                  <Label className="text-xs">Show Clearances / Guides</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch 
                    checked={activeOption.presentationSettings.showLighting}
                    onCheckedChange={v => handleUpdateOption({ presentationSettings: { ...activeOption.presentationSettings, showLighting: v } })}
                  />
                  <Label className="text-xs">Show Lighting Render</Label>
                </div>
              </div>
            </div>

            <div className="text-left space-y-4 border-t border-border pt-6 mt-6">
              <h4 className="font-bold text-xs uppercase tracking-wider text-primary">Client & Presentation Notes</h4>
              <Textarea 
                value={activeOption.clientNotes}
                onChange={e => handleUpdateOption({ clientNotes: e.target.value })}
                placeholder="Notes for client proposal or presentation..."
                className="min-h-[100px] text-xs bg-background resize-y"
              />
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
