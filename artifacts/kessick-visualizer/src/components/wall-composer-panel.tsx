import { useAppStore, updateActiveInstances } from '@/store';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { X, Wand2, Plus } from 'lucide-react';
import { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Product, CatalogProductSnapshot, CatalogReleaseReference } from '@/types/catalog';
import { ProductInstance, FinishSelection } from '@/types/design';

interface WallComposerPanelProps {
  onClose?: () => void;
}

interface Block {
  id: string;
  name: string;
  category: string;
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  finish: FinishSelection;
  lightingEnabled: boolean;
}

export function WallComposerPanel({ onClose }: WallComposerPanelProps) {
  const { commit, setSelectedIds, pixelsPerInch } = useAppStore();

  const [envelope, setEnvelope] = useState<'full' | 'stair-left' | 'stair-right'>('stair-left');
  const [width, setWidth] = useState(120);
  const [maxHeight, setMaxHeight] = useState(108);
  const [minHeight, setMinHeight] = useState(36);
  const [stylePreset, setStylePreset] = useState<'estate' | 'modern' | 'transitional'>('modern');
  const [baseType, setBaseType] = useState<'open' | 'closed' | 'none'>('closed');
  const [hasCountertop, setHasCountertop] = useState(true);
  const [hasDisplayRow, setHasDisplayRow] = useState(true);
  const [hasLighting, setHasLighting] = useState(true);

  const columnWidth = 24;
  const baseHeight = 36;
  const counterHeight = 1.5;
  const displayHeight = 14;

  const blocks = useMemo(() => {
    const b: Block[] = [];
    const numCols = Math.max(1, Math.floor(width / columnWidth));
    const actualWidth = numCols * columnWidth;
    
    let finish: FinishSelection = { material: 'Wood', finish: 'Walnut' };
    if (stylePreset === 'modern') finish = { material: 'Metal', finish: 'Matte Black' };
    if (stylePreset === 'transitional') finish = { material: 'Wood', finish: 'White Oak' };

    for (let col = 0; col < numCols; col++) {
      const colX = col * columnWidth;
      
      // Calculate max height for this column based on envelope
      let colMaxH = maxHeight;
      if (envelope === 'stair-left') {
        // slopes down from left to right
        const progress = col / (numCols - 1 || 1);
        colMaxH = maxHeight - (maxHeight - minHeight) * progress;
      } else if (envelope === 'stair-right') {
        // slopes down from right to left
        const progress = 1 - (col / (numCols - 1 || 1));
        colMaxH = maxHeight - (maxHeight - minHeight) * progress;
      }

      let currentY = 0;

      // Base
      if (baseType !== 'none') {
        if (colMaxH >= currentY + baseHeight) {
          b.push({
            id: `base-${col}`,
            name: baseType === 'closed' ? 'Closed Base Cabinet' : 'Open Base Cubbies',
            category: 'Base',
            x: colX,
            y: currentY,
            w: columnWidth,
            h: baseHeight,
            d: 24,
            finish,
            lightingEnabled: false
          });
          currentY += baseHeight;
        } else {
          // If stairs cut into base
          const h = Math.max(0, colMaxH - currentY);
          if (h > 0) {
             b.push({ id: `base-${col}`, name: 'Base Cabinet', category: 'Base', x: colX, y: currentY, w: columnWidth, h, d: 24, finish, lightingEnabled: false });
             currentY += h;
          }
        }
      }

      // Countertop
      if (hasCountertop && baseType !== 'none' && colMaxH >= currentY + counterHeight) {
        b.push({
          id: `counter-${col}`,
          name: 'Countertop',
          category: 'Counter',
          x: colX,
          y: currentY,
          w: columnWidth,
          h: counterHeight,
          d: 25,
          finish: { ...finish, finish: stylePreset === 'modern' ? 'Quartz' : 'Wood' },
          lightingEnabled: false
        });
        currentY += counterHeight;
      }

      // Display Row
      if (hasDisplayRow && colMaxH >= currentY + displayHeight) {
        b.push({
          id: `display-${col}`,
          name: 'Angled Display Row',
          category: 'Display',
          x: colX,
          y: currentY,
          w: columnWidth,
          h: displayHeight,
          d: 12,
          finish,
          lightingEnabled: hasLighting
        });
        currentY += displayHeight;
      }

      // Wall Field
      if (colMaxH > currentY) {
        b.push({
          id: `wall-${col}`,
          name: 'Wall Bottle Field',
          category: 'Wall',
          x: colX,
          y: currentY,
          w: columnWidth,
          h: colMaxH - currentY,
          d: 12,
          finish,
          lightingEnabled: hasLighting
        });
      }
    }
    return b;
  }, [width, maxHeight, minHeight, envelope, stylePreset, baseType, hasCountertop, hasDisplayRow, hasLighting]);

  const handlePlace = () => {
    if (!pixelsPerInch) return;

    const baseRelease: CatalogReleaseReference = {
      id: 'concept-composer',
      version: '1.0',
      capturedAt: new Date().toISOString()
    };

    const newInstances: ProductInstance[] = [];
    const addedSnapshots: Record<string, CatalogProductSnapshot> = {};

    // Determine a center position for placement
    const startX = 200;
    const startY = 200; // note: Y is down in canvas, but our Y in blocks is bottom-up?
    // Let's invert Y for canvas so they stack correctly visually. 
    // In our blocks logic, currentY = 0 is bottom. Canvas y=0 is top.
    const overallMaxH = Math.max(...blocks.map(b => b.y + b.h));

    blocks.forEach(block => {
      const productId = `composer-${block.name.replace(/\s+/g, '-').toLowerCase()}-${block.w}x${block.h}`;
      
      if (!addedSnapshots[productId]) {
        const prod: Product = {
          id: productId,
          sku: '', // explicitly no SKU
          name: block.name,
          series: stylePreset === 'estate' ? 'Estate' : stylePreset === 'modern' ? 'Wine Wall' : 'Elevation',
          category: block.category,
          bottle_capacity: null,
          width_in: block.w,
          height_in: block.h,
          depth_in: block.d,
          image_url: '',
          thumbnail_url: '',
          customizable: true,
          warnings: [{
            kind: 'planning',
            message: 'Concept massing only. Replace with approved Kessick product geometry before estimating or construction documents.',
            actionable: true,
          }],
          catalog_release: baseRelease,
          confidence: 'low',
          provenance: { confidence: 'low', source: 'Customer concept study' },
          gallery: [],
          status: 'planning',
        };
        addedSnapshots[productId] = { release: baseRelease, product: prod, capturedAt: baseRelease.capturedAt };
      }

      const instanceId = uuidv4();
      
      // Calculate canvas Y. If block.y is bottom-up, canvas y = overallMaxH - block.y - block.h
      const canvasY = (overallMaxH - (block.y + block.h));

      newInstances.push({
        instanceId,
        productId,
        x: startX + block.x * pixelsPerInch,
        y: startY + canvasY * pixelsPerInch,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        customSized: false,
        productSnapshot: addedSnapshots[productId],
        finishSelection: block.finish,
        lighting: block.lightingEnabled ? { enabled: true, type: 'led_strip', colorTemp: '3000K', intensity: 80, dimming: true, notes: '' } : undefined
      });
    });

    commit(s => {
      const currentCatalog = s.catalogSnapshot || { schemaVersion: 1, releases: [], products: {}, prices: {} };
      const nextCatalog = {
        ...currentCatalog,
        products: { ...currentCatalog.products, ...addedSnapshots }
      };
      
      const s2 = updateActiveInstances(s, insts => [...insts, ...newInstances]);
      return { ...s2, catalogSnapshot: nextCatalog };
    });

    setSelectedIds(newInstances.map(i => i.instanceId));
    if (onClose) onClose();
  };

  return (
    <div className="flex flex-col h-full shrink-0 overflow-hidden bg-sidebar w-full">
      <div className="p-4 border-b border-border bg-sidebar/50 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            Wall Composer
          </h2>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Procedural Design
          </p>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 md:hidden text-muted-foreground hover:text-foreground"
            onClick={onClose}
            data-testid="close-composer-panel"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-6">
          
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">Envelope & Dimensions</h3>
            
            <div className="grid gap-2">
              <Label className="text-xs">Wall Shape</Label>
              <Select value={envelope} onValueChange={(v: any) => setEnvelope(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Full Wall (Rectangular)</SelectItem>
                  <SelectItem value="stair-left">Under-Stair (Slopes Left to Right)</SelectItem>
                  <SelectItem value="stair-right">Under-Stair (Slopes Right to Left)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label className="text-xs">Width (in)</Label>
                <Input type="number" value={width} onChange={e => setWidth(Number(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Max Height (in)</Label>
                <Input type="number" value={maxHeight} onChange={e => setMaxHeight(Number(e.target.value) || 0)} className="h-8 text-xs" />
              </div>
              {envelope !== 'full' && (
                <div className="grid gap-2">
                  <Label className="text-xs">Min Height (in)</Label>
                  <Input type="number" value={minHeight} onChange={e => setMinHeight(Number(e.target.value) || 0)} className="h-8 text-xs" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">Style & Configuration</h3>
            
            <div className="grid gap-2">
              <Label className="text-xs">Design Preset</Label>
              <Select value={stylePreset} onValueChange={(v: any) => setStylePreset(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Wine Wall concept</SelectItem>
                  <SelectItem value="estate">Estate concept</SelectItem>
                  <SelectItem value="transitional">Elevation concept</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2 mt-2">
              <Label className="text-xs">Base Cabinetry</Label>
              <Select value={baseType} onValueChange={(v: any) => setBaseType(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="closed">Closed Cabinets</SelectItem>
                  <SelectItem value="open">Open Cubbies</SelectItem>
                  <SelectItem value="none">None (Full height walls)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between mt-4">
              <Label className="text-xs">Include Countertop</Label>
              <Switch checked={hasCountertop} onCheckedChange={setHasCountertop} disabled={baseType === 'none'} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Angled Display Row</Label>
              <Switch checked={hasDisplayRow} onCheckedChange={setHasDisplayRow} />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Integrated Lighting</Label>
              <Switch checked={hasLighting} onCheckedChange={setHasLighting} />
            </div>
          </div>

          {/* Mini Preview */}
          <div className="mt-2 p-4 bg-background border border-border flex flex-col items-center justify-center min-h-[200px] relative overflow-hidden">
            <span className="absolute top-2 left-2 text-[10px] uppercase font-bold text-muted-foreground tracking-widest z-10">Elevation Preview</span>
            <span className="absolute top-2 right-2 text-[9px] uppercase font-bold text-primary tracking-widest z-10">Concept only</span>
            <div className="relative" style={{ width: '100%', height: '180px' }}>
              <svg width="100%" height="100%" viewBox={`0 0 ${Math.max(1, width)} ${Math.max(1, maxHeight)}`} preserveAspectRatio="xMidYMax meet" className="drop-shadow-md">
                {blocks.map(b => (
                  <g key={b.id}>
                    <rect 
                      x={b.x} 
                      y={maxHeight - (b.y + b.h)} 
                      width={b.w - 0.5} 
                      height={b.h - 0.5} 
                      fill={b.category === 'Base' ? '#2d2522' : b.category === 'Counter' ? '#d4af37' : b.category === 'Display' ? '#4a3b37' : '#1c1514'} 
                      stroke="#8D794E"
                      strokeWidth={1}
                    />
                    {b.lightingEnabled && b.category === 'Display' && (
                       <rect x={b.x} y={maxHeight - (b.y + b.h)} width={b.w} height={maxHeight * 0.02} fill="#fef08a" opacity={0.6} />
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
          
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border bg-sidebar/50 shrink-0">
         <Button
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2 h-10 font-bold tracking-wider uppercase text-xs"
            onClick={handlePlace}
            disabled={!pixelsPerInch}
            data-testid="btn-place-composition"
          >
            {pixelsPerInch ? (
              <>
                <Plus className="w-4 h-4" />
                Place Assembly on Wall
              </>
            ) : (
              'Set scale first'
            )}
          </Button>
      </div>
    </div>
  );
}
