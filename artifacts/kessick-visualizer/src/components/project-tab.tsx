import { useAppStore } from '@/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ProjectTab() {
  const { project, commit } = useAppStore();

  const update = (field: keyof typeof project, value: string) => {
    commit(s => ({
      ...s,
      project: { ...s.project, [field]: value }
    }));
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Project Name</Label>
        <Input 
          className="bg-background"
          value={project.name}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Smith Residence Cellar"
          data-testid="input-project-name"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Client</Label>
        <Input 
          className="bg-background"
          value={project.client}
          onChange={(e) => update('client', e.target.value)}
          placeholder="Client Name"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Address / Site</Label>
        <Input 
          className="bg-background"
          value={project.address}
          onChange={(e) => update('address', e.target.value)}
          placeholder="Site Location"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Surveyor</Label>
          <Input 
            className="bg-background"
            value={project.surveyor}
            onChange={(e) => update('surveyor', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Date</Label>
          <Input 
            type="date"
            className="bg-background"
            value={project.surveyDate}
            onChange={(e) => update('surveyDate', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</Label>
        <Textarea 
          className="bg-background min-h-[120px] resize-none"
          value={project.notes}
          onChange={(e) => update('notes', e.target.value)}
          placeholder="Add site notes, conditions, restrictions..."
        />
      </div>
    </div>
  );
}
