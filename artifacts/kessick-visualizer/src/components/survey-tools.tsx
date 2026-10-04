import { useAppStore, updateActiveInstances } from '@/store';
import { MousePointer2, Hand, Ruler, Pencil, Square, Box, MessageSquareText, ArrowRightLeft, Magnet, ZoomIn, ZoomOut, Maximize, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SurveyMode } from '@/types/survey';
import { useIsMobile } from '@/hooks/use-mobile';

interface ToolDef {
  id: SurveyMode;
  label: string;
  icon: React.ElementType;
}

const tools: ToolDef[] = [
  { id: 'select', label: 'Select', icon: MousePointer2 },
  { id: 'pan', label: 'Pan Canvas', icon: Hand },
  { id: 'calibrate', label: 'Calibrate Scale', icon: Ruler },
  { id: 'wall', label: 'Draw Wall (Polyline)', icon: Pencil },
  { id: 'opening', label: 'Add Opening', icon: Square },
  { id: 'obstruction', label: 'Add Obstruction', icon: Box },
  { id: 'measure', label: 'Measure Distance', icon: ArrowRightLeft },
  { id: 'annotation', label: 'Add Note', icon: MessageSquareText },
];

export function SurveyTools({
  onZoomIn,
  onZoomOut,
  onFit
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  const { mode, setMode, snapEnabled, setSnapEnabled, selectedIds, commit } = useAppStore();
  const isMobile = useIsMobile();

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    commit(s => {
      const s2 = updateActiveInstances(s, insts => insts.filter(i => !selectedIds.includes(i.instanceId)));
      return {
        ...s2,
        entities: s2.entities.filter(e => !selectedIds.includes(e.id))
      };
    });
  };

  return (
    <div className="absolute bottom-2 left-2 right-2 z-20 flex flex-row gap-2 pointer-events-auto md:bottom-auto md:right-auto md:top-4 md:left-4 md:flex-col md:gap-3">
      
      {/* Drawing & Survey Tools */}
      <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto bg-card/90 backdrop-blur-md border border-border p-1  shadow-xl flex flex-row gap-0.5 items-center md:flex-none md:flex-col md:gap-1 md:w-12 md:p-1.5 md:">
        {tools.map((t) => (
          <Tooltip key={t.id} delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant={mode === t.id ? 'default' : 'ghost'}
                size="icon"
                className={`h-9 w-9 shrink-0  md: transition-all ${mode === t.id ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                onClick={() => setMode(t.id)}
                data-testid={`tool-${t.id}`}
              >
                <t.icon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side={isMobile ? 'top' : 'right'} className="font-bold">
              <p>{t.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      {/* View & Canvas Controls */}
      <div className="bg-card/90 backdrop-blur-md border border-border p-1  shadow-xl flex flex-row gap-0.5 shrink-0 items-center md:p-1.5 md: md:flex-col md:gap-1 md:w-12">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9  md: transition-all ${snapEnabled ? 'bg-secondary/50 text-foreground shadow-inner' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={() => setSnapEnabled(!snapEnabled)}
            >
              <Magnet className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={isMobile ? 'top' : 'right'} className="font-bold">
            <p>Toggle Snapping</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-6 w-px bg-border mx-1 md:h-px md:w-6 md:mx-auto md:my-1" />

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button data-testid="canvas-zoom-in" aria-label="Zoom in" variant="ghost" size="icon" className="h-9 w-9  md: text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={isMobile ? 'top' : 'right'} className="font-bold">
            <p>Zoom In</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button data-testid="canvas-zoom-out" aria-label="Zoom out" variant="ghost" size="icon" className="h-9 w-9  md: text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={isMobile ? 'top' : 'right'} className="font-bold">
            <p>Zoom Out</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button data-testid="canvas-fit" aria-label="Fit room to screen" variant="ghost" size="icon" className="h-9 w-9  md: text-muted-foreground hover:text-foreground hover:bg-muted" onClick={onFit}>
              <Maximize className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={isMobile ? 'top' : 'right'} className="font-bold">
            <p>Fit to Screen</p>
          </TooltipContent>
        </Tooltip>

        {selectedIds.length > 0 && (
          <>
            <div className="h-6 w-px bg-border mx-1 md:h-px md:w-6 md:mx-auto md:my-1" />
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button aria-label="Delete selected" variant="ghost" size="icon" className="h-9 w-9  md: text-destructive hover:text-destructive hover:bg-destructive/20" onClick={handleDelete}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side={isMobile ? 'top' : 'right'} className="font-bold">
                <p>Delete Selected</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
