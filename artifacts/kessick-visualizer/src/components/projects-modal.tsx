import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store';
import { exportProjectJSON, importProjectJSON, getSavedProjects, deleteProjectLocal } from '@/lib/persistence';
import { Download, Upload, Trash2, Clock } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';

export function ProjectsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { loadProject } = useAppStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [projects, setProjects] = useState(getSavedProjects());

  useEffect(() => {
    if (open) setProjects(getSavedProjects());
  }, [open]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const snap = await importProjectJSON(file);
        await loadProject(snap);
        onOpenChange(false);
      } catch (err) {
        alert("Failed to load project JSON");
      }
    }
  };

  const handleDelete = (id: string) => {
    deleteProjectLocal(id);
    setProjects(getSavedProjects());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-sans font-bold uppercase tracking-widest text-primary">Open Project</DialogTitle>
          <DialogDescription>
            Load a previously saved site survey from your browser or import a JSON file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2">
          {projects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No saved projects found in this browser.
            </div>
          ) : (
            projects.sort((a,b) => b.lastSaved - a.lastSaved).map(p => (
              <div key={p.project.id} className="flex items-center justify-between p-3 border border-border  bg-background hover:bg-accent/10">
                <div className="flex flex-col">
                  <span className="font-bold text-sm">{p.project.name || 'Unnamed Project'}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Last saved: {formatDistanceToNow(p.lastSaved, { addSuffix: true })}
                  </span>
                  <span className="text-xs text-muted-foreground mt-1">
                    {p.entities?.length || 0} entities, {(p.options ? p.options.reduce((acc, o) => acc + (o.instances?.length || 0), 0) : (p.instances?.length || 0))} products
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    loadProject(p);
                    onOpenChange(false);
                  }}>
                    Load
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(p.project.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-between mt-4 pt-4 border-t border-border">
          <input type="file" ref={fileRef} className="hidden" accept=".json" onChange={handleImport} />
          <Button variant="outline" className="gap-2 border-primary/50 text-primary hover:bg-primary/10" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4" />
            Import JSON
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
