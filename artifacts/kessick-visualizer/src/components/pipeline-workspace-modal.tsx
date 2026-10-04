import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PipelineTab } from './pipeline-tab';
import { Button } from '@/components/ui/button';
import { X, LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { PipelineDashboardModal } from './pipeline-dashboard-modal';

export function PipelineWorkspaceModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [isDashOpen, setIsDashOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[100vw] w-screen h-[100dvh] max-h-screen m-0 p-0 rounded-none bg-background border-none flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-card shrink-0 z-20">
            <div className="text-lg font-sans font-bold uppercase tracking-widest text-primary">Project Pipeline Workspace</div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setIsDashOpen(true)} className="gap-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground">
                <LayoutDashboard className="w-4 h-4" />
                Coordination Dashboard
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <PipelineTab />
          </div>
        </DialogContent>
      </Dialog>
      
      <PipelineDashboardModal open={isDashOpen} onOpenChange={setIsDashOpen} />
    </>
  );
}
