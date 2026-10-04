import { useAppStore } from '@/store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Square, Box, MessageSquareText, Ruler, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LeftSurveyPanel({ onClose }: { onClose?: () => void }) {
  const { entities, selectedIds, setSelectedIds, setMode } = useAppStore();

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      <div className="p-4 border-b border-border bg-sidebar/50 shrink-0 flex justify-between items-center">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Survey Elements</h2>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-6 w-6 md:hidden text-muted-foreground hover:text-foreground" onClick={onClose} data-testid="close-survey-panel">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="flex flex-col gap-1">
          {entities.map(ent => (
            <div 
              key={ent.id}
              className={`flex items-center gap-3 p-2  cursor-pointer text-sm transition-colors ${selectedIds.includes(ent.id) ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'hover:bg-muted text-muted-foreground hover:text-foreground'}`}
              onClick={() => {
                setSelectedIds([ent.id]);
                setMode('select');
              }}
            >
              <div className={`p-1.5${selectedIds.includes(ent.id) ? 'bg-primary-foreground/20' : 'bg-background'}`}>
                {ent.type === 'wall' && <Pencil className="w-4 h-4" />}
                {ent.type === 'opening' && <Square className="w-4 h-4" />}
                {ent.type === 'obstruction' && <Box className="w-4 h-4" />}
                {ent.type === 'annotation' && <MessageSquareText className="w-4 h-4" />}
                {ent.type === 'measure' && <Ruler className="w-4 h-4" />}
              </div>
              
              <span className="capitalize flex-1 truncate">
                {ent.type === 'opening' ? ent.openingType : 
                 ent.type === 'obstruction' ? ent.obstructionType : 
                 ent.type === 'annotation' ? ent.text : 
                 ent.type}
              </span>
            </div>
          ))}
          
          {entities.length === 0 && (
            <div className="text-xs text-center text-muted-foreground py-12 px-4">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Ruler className="w-6 h-6 opacity-50" />
              </div>
              No survey elements yet.<br/>Use the floating tools on the canvas to measure and annotate.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
