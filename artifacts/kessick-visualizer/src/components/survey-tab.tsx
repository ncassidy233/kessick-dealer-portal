import { useAppStore } from '@/store';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Info, Pencil, Square, Box, MessageSquareText, Ruler } from 'lucide-react';
import { validateLayout } from '@/lib/design-geometry';
import { useProducts } from '@/hooks/use-products';
import { useMemo } from 'react';

export function SurveyTab() {
  const { entities, instances, selectedIds, setSelectedIds, setMode, commit, pixelsPerInch } = useAppStore();
  const { data: products } = useProducts();

  const selectedEntity = entities.find(e => selectedIds.includes(e.id));
  
  const warnings = useMemo(() => {
    if (!pixelsPerInch || !products) return [];
    return validateLayout(instances, entities, products, pixelsPerInch).map(w => w.message);
  }, [instances, entities, products, pixelsPerInch]);

  const handleUpdate = (id: string, updates: any) => {
    commit(s => ({
      ...s,
      entities: s.entities.map(e => e.id === id ? { ...e, ...updates } : e)
    }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {warnings.length > 0 && (
        <div className="p-4 border-b border-destructive/20 bg-destructive/10 shrink-0">
          <div className="flex items-center gap-2 text-destructive font-bold text-sm mb-2">
            <AlertTriangle className="w-4 h-4" />
            {warnings.length} Warnings
          </div>
          <ul className="text-xs text-destructive-foreground space-y-1 list-disc pl-4">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {selectedEntity ? (
        <div className="p-4 border-b border-border shrink-0 bg-card">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-4 font-bold">Selected Entity</div>
          
          {selectedEntity.type === 'opening' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Opening Type</Label>
                <Select
                  value={selectedEntity.openingType}
                  onValueChange={(v) => handleUpdate(selectedEntity.id, { openingType: v })}
                >
                  <SelectTrigger className="bg-background text-foreground border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="door">Door</SelectItem>
                    <SelectItem value="window">Window</SelectItem>
                    <SelectItem value="pass-through">Pass-through</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {selectedEntity.type === 'obstruction' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Obstruction Type</Label>
                <Select
                  value={selectedEntity.obstructionType}
                  onValueChange={(v) => handleUpdate(selectedEntity.id, { obstructionType: v })}
                >
                  <SelectTrigger className="bg-background text-foreground border-border">
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
            </div>
          )}

          {selectedEntity.type === 'annotation' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Severity</Label>
                <Select
                  value={selectedEntity.severity}
                  onValueChange={(v) => handleUpdate(selectedEntity.id, { severity: v })}
                >
                  <SelectTrigger className="bg-background text-foreground border-border">
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
                <Label className="text-xs text-muted-foreground">Text</Label>
                <Input
                  className="bg-background"
                  value={selectedEntity.text}
                  onChange={(e) => handleUpdate(selectedEntity.id, { text: e.target.value })}
                />
              </div>
            </div>
          )}
          
          {selectedEntity.type === 'wall' && (
            <div className="text-sm text-muted-foreground">
              Wall Polyline with {selectedEntity.points.length} points.
            </div>
          )}
        </div>
      ) : (
        <div className="p-4 border-b border-border shrink-0 text-sm text-muted-foreground bg-card/50">
          Select a survey entity on the canvas to view properties.
        </div>
      )}

      <div className="p-4 shrink-0 border-b border-border bg-sidebar font-bold text-sm text-foreground">
        Survey Entities ({entities.length})
      </div>
      
      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col gap-1">
          {entities.map(ent => (
            <div 
              key={ent.id}
              className={`flex items-center gap-3 p-2cursor-pointer text-sm ${selectedIds.includes(ent.id) ? 'bg-primary/20 text-primary' : 'hover:bg-accent/10 text-muted-foreground'}`}
              onClick={() => {
                setSelectedIds([ent.id]);
                setMode('select');
              }}
            >
              {ent.type === 'wall' && <Pencil className="w-4 h-4" />}
              {ent.type === 'opening' && <Square className="w-4 h-4" />}
              {ent.type === 'obstruction' && <Box className="w-4 h-4" />}
              {ent.type === 'annotation' && <MessageSquareText className="w-4 h-4" />}
              {ent.type === 'measure' && <Ruler className="w-4 h-4" />}
              
              <span className="capitalize">
                {ent.type === 'opening' ? ent.openingType : 
                 ent.type === 'obstruction' ? ent.obstructionType : 
                 ent.type}
              </span>
            </div>
          ))}
          {entities.length === 0 && (
            <div className="text-xs text-center text-muted-foreground py-8">
              No survey elements yet.<br/>Use the tools on the left to measure and annotate.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
