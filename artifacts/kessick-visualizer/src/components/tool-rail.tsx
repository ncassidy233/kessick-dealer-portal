import { Button } from '@/components/ui/button';
import { Box, Package, Layers, SlidersHorizontal, Wand2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type ToolRailPanel = 'catalog' | 'survey' | 'composer' | 'model-studio';

interface ToolRailProps {
  active: ToolRailPanel | null;
  onChange: (v: ToolRailPanel | null) => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (v: boolean) => void;
  hasImage: boolean;
}

export function ToolRail({ active, onChange, rightPanelOpen, setRightPanelOpen, hasImage }: ToolRailProps) {
  const toggle = (val: ToolRailPanel) => onChange(active === val ? null : val);
  
  return (
    <div className="order-2 md:order-none md:w-14 h-14 md:h-full shrink-0 border-t md:border-t-0 md:border-r border-border bg-card flex flex-row md:flex-col items-center justify-center md:justify-start py-0 md:py-4 px-4 md:px-0 gap-6 md:gap-0 z-30 md:z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.2)] md:shadow-[2px_0_10px_rgba(0,0,0,0.2)]">
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button 
            data-testid="toolrail-catalog"
            variant="ghost" 
            size="icon" 
            className={`w-10 h-10 md:mb-3 transition-all ${active === 'catalog' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => toggle('catalog')}
          >
            <Package className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Product Catalog</TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button 
            data-testid="toolrail-survey"
            variant="ghost" 
            size="icon" 
            className={`w-10 h-10 md:mb-3 transition-all ${active === 'survey' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => toggle('survey')}
          >
            <Layers className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Survey & Layers</TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            data-testid="toolrail-composer"
            variant="ghost"
            size="icon"
            className={`w-10 h-10 md:mb-3 transition-all ${active === 'composer' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => toggle('composer')}
          >
            <Wand2 className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Wall Composer</TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            data-testid="toolrail-model-studio"
            variant="ghost"
            size="icon"
            className={`w-10 h-10 md:mb-3 transition-all ${active === 'model-studio' ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => toggle('model-studio')}
          >
            <Box className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">3D / AR Asset Studio</TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button 
            data-testid="toolrail-inspector"
            variant="ghost" 
            size="icon" 
            disabled={!hasImage}
            className={`w-10 h-10 md:mb-3 md:mt-auto transition-all ${rightPanelOpen ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">Properties Inspector</TooltipContent>
      </Tooltip>
    </div>
  );
}
