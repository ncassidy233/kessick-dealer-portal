import { useAppStore, updateActiveInstances } from '@/store';
import { useProducts, Product } from '@/hooks/use-products';
import { Input } from '@/components/ui/input';
import { Search, AlertTriangle, Plus, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { addProductToProjectCatalog, filterCatalogProducts, getLightingCapabilities } from '@/lib/catalog-domain';

export function SidebarCatalog({ onClose }: { onClose?: () => void }) {
  const { data: products, isLoading, isError, error, refetch } = useProducts();
  const { pixelsPerInch, commit, unit, setSelectedIds } = useAppStore();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [material, setMaterial] = useState('All');
  const [style, setStyle] = useState('All');
  const [finish, setFinish] = useState('All');
  const [lighting, setLighting] = useState('All');
  const [suitability, setSuitability] = useState('All');
  const [minCapacity, setMinCapacity] = useState('');
  const [maxWidth, setMaxWidth] = useState('');
  const [maxHeight, setMaxHeight] = useState('');
  const [maxDepth, setMaxDepth] = useState('');

  const facets = useMemo(() => {
    const values = (pick: (product: Product) => string[] | undefined) =>
      [...new Set((products ?? []).flatMap(product => pick(product) ?? []))].sort();
    return {
      lines: [...new Set((products ?? []).map(product => product.series))],
      materials: values(product => product.materials),
      styles: values(product => Array.isArray(product.style) ? product.style : product.style ? [product.style] : undefined),
      finishes: values(product => product.finishes),
      lighting: values(getLightingCapabilities),
      suitability: values(product => product.suitability),
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return filterCatalogProducts(products, {
      search,
      line: category,
      material: material === 'All' ? undefined : material,
      style: style === 'All' ? undefined : style,
      finish: finish === 'All' ? undefined : finish,
      lighting: lighting === 'All' ? undefined : lighting,
      suitability: suitability === 'All' ? undefined : suitability,
      minCapacity: minCapacity ? Number(minCapacity) : undefined,
      maxWidth: maxWidth ? Number(maxWidth) : undefined,
      maxHeight: maxHeight ? Number(maxHeight) : undefined,
      maxDepth: maxDepth ? Number(maxDepth) : undefined,
    }).sort((a, b) => {
      const aTower = a.series === 'Tower Series' || a.series === 'Tower';
      const bTower = b.series === 'Tower Series' || b.series === 'Tower';
      if (aTower && !bTower) return -1;
      if (!aTower && bTower) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [products, search, category, material, style, finish, lighting, suitability, minCapacity, maxWidth, maxHeight, maxDepth]);

  return (
    <div className="flex flex-col h-full shrink-0 overflow-hidden bg-sidebar w-full">
      <div className="p-4 border-b border-border bg-sidebar/50 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Product Catalog</h2>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              {isLoading ? 'Loading approved collection' : `${products?.length ?? 0} approved products`}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" className="h-6 w-6 md:hidden text-muted-foreground hover:text-foreground" onClick={onClose} data-testid="close-catalog-panel">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SKUs, names..."
            className="pl-9 bg-background border-border focus-visible:ring-primary h-9 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <ScrollArea className="w-full whitespace-nowrap pb-1">
          <div className="flex gap-2">
            {['All', ...facets.lines].map((c) => (
              <Badge
                key={c}
                variant={category === c ? 'default' : 'outline'}
                className={`cursor-pointer shrink-0 transition-colors ${
                  category === c ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90' : 'text-muted-foreground hover:text-foreground border-border bg-background hover:bg-muted'
                }`}
                onClick={() => setCategory(c)}
              >
                {c === 'Tower Series' ? 'Tower' : c}
              </Badge>
            ))}
          </div>
        </ScrollArea>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <FacetSelect label="Material" value={material} values={facets.materials} onChange={setMaterial} />
          {facets.styles.length > 0 && <FacetSelect label="Style" value={style} values={facets.styles} onChange={setStyle} />}
          <FacetSelect label="Finish" value={finish} values={facets.finishes} onChange={setFinish} />
          {facets.lighting.length > 0 && <FacetSelect label="Lighting" value={lighting} values={facets.lighting} onChange={setLighting} />}
          {facets.suitability.length > 0 && <FacetSelect label="Suitability" value={suitability} values={facets.suitability} onChange={setSuitability} />}
          <Input aria-label="Minimum bottle capacity" placeholder="Min bottles" inputMode="numeric" value={minCapacity} onChange={event => setMinCapacity(event.target.value)} className="h-8 text-xs" />
          <Input aria-label="Maximum width in inches" placeholder="Max width (in)" inputMode="decimal" value={maxWidth} onChange={event => setMaxWidth(event.target.value)} className="h-8 text-xs" />
          <Input aria-label="Maximum height in inches" placeholder="Max height (in)" inputMode="decimal" value={maxHeight} onChange={event => setMaxHeight(event.target.value)} className="h-8 text-xs" />
          <Input aria-label="Maximum depth in inches" placeholder="Max depth (in)" inputMode="decimal" value={maxDepth} onChange={event => setMaxDepth(event.target.value)} className="h-8 text-xs" />
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground text-center py-12">Loading catalog...</div>
        ) : isError ? (
          <div className="border border-destructive/50 bg-destructive/10 p-4 text-center">
            <AlertTriangle className="mx-auto mb-3 h-5 w-5 text-destructive" />
            <p className="text-sm font-semibold text-foreground">The product catalog could not be loaded.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {error instanceof Error ? error.message : 'Please try loading the approved catalog again.'}
            </p>
            <Button className="mt-4 w-full" size="sm" onClick={() => void refetch()}>
              Retry catalog
            </Button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="border border-border bg-muted/20 p-4 text-center">
            <p className="text-sm font-semibold text-foreground">No products match these filters.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setSearch('');
                setCategory('All');
                setMaterial('All');
                setStyle('All');
                setFinish('All');
                setLighting('All');
                setSuitability('All');
                setMinCapacity('');
                setMaxWidth('');
                setMaxHeight('');
                setMaxDepth('');
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                unit={unit}
                canAdd={!!pixelsPerInch}
                onAdd={() => {
                  const instanceId = uuidv4();
                   commit(s => {
                     const catalogSnapshot = addProductToProjectCatalog(s.catalogSnapshot, product);
                     const productSnapshot = catalogSnapshot.products[product.id];
                    const inst = {
                       instanceId,
                      productId: product.id,
                       x: 100, y: 100, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1, customSized: false,
                       productSnapshot,
                       priceSnapshot: product.authorized_price,
                    };
                    const s2 = updateActiveInstances(s, insts => [...insts, inst]);
                     return { ...s2, catalogSnapshot };
                  });
                    setSelectedIds([instanceId]);
                  onClose?.();
                }}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function FacetSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="All">{label}: All</SelectItem>
        {values.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function ProductCard({ product, canAdd, onAdd, unit }: { product: Product; canAdd: boolean; onAdd: () => void; unit: 'in' | 'cm' }) {
  const [showDetails, setShowDetails] = useState(false);
  const w = unit === 'cm' ? (product.width_in * 2.54).toFixed(1) : product.width_in;
  const h = unit === 'cm' ? (product.height_in * 2.54).toFixed(1) : product.height_in;
  const d = unit === 'cm' ? (product.depth_in * 2.54).toFixed(1) : product.depth_in;
  const u = unit === 'cm' ? 'cm' : '"';

  return (
    <div className="group bg-card border border-border overflow-hidden flex flex-col transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <div className="aspect-[4/3] bg-background relative flex items-center justify-center p-4">
        {product.thumbnail_url ? (
          <img
            src={product.thumbnail_url}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="object-contain w-full h-full drop-shadow-md transition-transform group-hover:scale-105 duration-500"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/30 text-muted-foreground">
            <div
              className="relative flex h-[72%] max-w-[72%] items-center justify-center border border-primary/70 bg-[#211710]"
              style={{
                aspectRatio: `${Math.max(product.width_in, 1)} / ${Math.max(product.height_in, 1)}`,
              }}
            >
              <div className="absolute inset-[8%] grid grid-cols-3 gap-[3px] overflow-hidden border border-primary/40 p-[4px]">
                {Array.from({ length: 18 }, (_, index) => (
                  <span key={index} className="aspect-square rounded-full border border-primary/50 bg-black/70" />
                ))}
              </div>
            </div>
            <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
              Dimensional elevation
            </span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-3">
        <div>
          <div className="text-[10px] text-primary font-bold uppercase tracking-wider mb-1">{product.sku}</div>
          <div className="text-sm font-bold text-foreground leading-tight">{product.name}</div>
        </div>
        
        <div className="text-xs text-muted-foreground flex justify-between items-center bg-muted/20 p-2">
          <span className="font-medium">{w}{u}W × {h}{u}H × {d}{u}D</span>
          {product.bottle_capacity && <span className="text-primary font-bold">{product.bottle_capacity} btl</span>}
        </div>

        {product.customizable && (
          <div className="flex items-center gap-1.5 bg-amber-500/10 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
            <AlertTriangle className="w-3 h-3" />
            <span>Custom Planning Dims</span>
          </div>
        )}
        {product.warnings.length > 0 && (
          <div className="flex items-start gap-1.5 text-[10px] text-amber-500">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>{product.warnings[0].message}</span>
          </div>
        )}
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowDetails(value => !value)}>
          {showDetails ? 'Hide details' : 'Details & specifications'}
        </Button>
        {showDetails && (
          <div className="space-y-2 border border-border bg-muted/20 p-2 text-[11px] text-muted-foreground">
            <div><span className="font-semibold text-foreground">Line:</span> {product.series}</div>
            <div><span className="font-semibold text-foreground">Confidence:</span> {product.confidence}</div>
            {product.bottle_capacity === null && <div>Capacity: Not published</div>}
            {product.materials?.length ? <div>Materials: {product.materials.join(', ')}</div> : null}
            {product.finishes?.length ? <div>Finishes: {product.finishes.join(', ')}</div> : null}
            {product.suitability?.length ? <div>Suitability: {product.suitability.join(', ')}</div> : null}
            {Object.entries(product.specifications ?? {}).map(([key, value]) => (
              <div key={key}><span className="font-semibold text-foreground">{key}:</span> {value === null ? 'Not published' : String(value)}</div>
            ))}
            <div>Source: {product.provenance.catalogRef || product.provenance.source || 'Not identified'}</div>
            <div>Catalog release: {product.catalog_release.version}</div>
            <div>Price: {product.authorized_price ? 'Authorized snapshot available' : 'TBD — no authorized price'}</div>
          </div>
        )}

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div className="mt-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground gap-2 h-9 transition-colors"
                disabled={!canAdd || product.width_in <= 0 || product.height_in <= 0 || product.depth_in <= 0}
                onClick={onAdd}
                data-testid={`btn-add-${product.sku}`}
              >
                <Plus className="w-4 h-4" />
                Add to Room
              </Button>
            </div>
          </TooltipTrigger>
          {!canAdd && (
            <TooltipContent side="top">
              <p>Set scale first</p>
            </TooltipContent>
          )}
        </Tooltip>
      </div>
    </div>
  );
}
