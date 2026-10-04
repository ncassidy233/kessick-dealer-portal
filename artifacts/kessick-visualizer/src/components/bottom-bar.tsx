import { useAppStore } from '@/store';
import { useProducts } from '@/hooks/use-products';
import { resolveProductForInstance } from '@/lib/catalog-domain';
import { Ruler, Maximize2, AlertTriangle, Cuboid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo } from 'react';
import { validateLayout } from '@/lib/design-geometry';

export function BottomBar() {
  const { pixelsPerInch, instances, entities, setMode, unit, setUnit } = useAppStore();
  const { data: products } = useProducts();

  const stats = useMemo(() => {
    let totalWidth = 0;
    let totalBottles = 0;
    let warningCount = 0;

    if (!products) return { totalWidth, totalBottles, warningCount };

    instances.forEach((inst) => {
      const product = resolveProductForInstance(inst, products);
      if (product) {
        totalWidth += inst.customSized ? inst.scaleX * product.width_in : product.width_in;
        if (product.bottle_capacity) {
          totalBottles += product.bottle_capacity;
        }
      }
    });

    if (pixelsPerInch) {
      warningCount = validateLayout(instances, entities, products, pixelsPerInch).length;
    }

    return { totalWidth, totalBottles, warningCount };
  }, [instances, entities, products, pixelsPerInch]);

  const displayWidth = unit === 'cm' ? (stats.totalWidth * 2.54).toFixed(1) : stats.totalWidth.toFixed(1);
  const displayUnit = unit === 'cm' ? 'cm' : '"';

  return (
    <div className="min-h-12 border-t border-border bg-card shrink-0 flex items-center justify-between overflow-x-auto px-4 py-2 text-xs z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] gap-4 no-scrollbar">
      <div className="flex shrink-0 items-center gap-3 md:gap-4">
        {pixelsPerInch ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-primary hover:text-primary hover:bg-primary/10 gap-2 border border-primary/20 text-xs px-3 font-medium bg-primary/5 whitespace-nowrap"
            onClick={() => setMode('calibrate')}
          >
            <Maximize2 className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Scale: {pixelsPerInch.toFixed(1)} px/in</span>
            <span className="sm:hidden">Calibrated</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 border border-destructive/20 animate-pulse text-xs px-3 font-bold bg-destructive/10 whitespace-nowrap"
            onClick={() => setMode('calibrate')}
          >
            <Ruler className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Calibration Required</span>
            <span className="sm:hidden">Calibrate</span>
          </Button>
        )}

        {stats.warningCount > 0 && (
          <div className="flex items-center gap-1.5 md:gap-2 text-destructive font-bold bg-destructive/10 px-2 md:px-3 py-1.5 border border-destructive/20 shadow-sm whitespace-nowrap">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{stats.warningCount} Conflicts</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4 md:gap-6 font-medium bg-background px-3 md:px-4 py-1.5 border border-border">
        <div className="flex items-center gap-2">
          <Cuboid className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold hidden sm:inline">Products</span>
          <span className="text-foreground text-sm">{instances.length}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-muted-foreground hidden sm:block" />
          <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold hidden sm:inline">Width</span>
          <span className="text-foreground text-sm">{displayWidth}{displayUnit}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground uppercase tracking-widest text-[10px] font-bold hidden sm:inline">Capacity</span>
          <span className="text-foreground text-sm">{stats.totalBottles} btl</span>
        </div>
        
        <div className="w-px h-4 bg-border" />
        
        <div className="flex items-center bg-card  border border-border overflow-hidden p-0.5">
          <button
            data-testid="button-unit-inches"
            className={`px-3 py-1 text-[10px] font-bold  transition-colors ${unit === 'in' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            onClick={() => setUnit('in')}
          >
            IN
          </button>
          <button
            data-testid="button-unit-centimeters"
            className={`px-3 py-1 text-[10px] font-bold  transition-colors ${unit === 'cm' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            onClick={() => setUnit('cm')}
          >
            CM
          </button>
        </div>
      </div>
    </div>
  );
}
