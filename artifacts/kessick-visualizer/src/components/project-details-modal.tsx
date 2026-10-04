import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ProjectTab } from './project-tab';
import { Button } from '@/components/ui/button';
import { X, FileText } from 'lucide-react';

export function ProjectDetailsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden bg-background p-0 border-none flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card shrink-0">
           <div className="text-lg font-sans font-bold uppercase tracking-widest text-primary flex items-center gap-3"><FileText className="w-5 h-5" /> Project Metadata</div>
           <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} data-testid="close-project-meta"><X className="w-5 h-5" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto relative p-4">
           <ProjectTab />
        </div>
      </DialogContent>
    </Dialog>
  );
}
