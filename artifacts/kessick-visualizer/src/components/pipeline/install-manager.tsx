import React from 'react';
import { useAppStore } from '@/store';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function InstallManager() {
  const store = useAppStore();
  const install = store.pipeline.installRecord;

  const updateField = (field: keyof typeof install, value: string) => {
    store.commit(s => ({
      ...s,
      pipeline: {
        ...s.pipeline,
        installRecord: {
          ...s.pipeline.installRecord,
          [field]: value
        }
      }
    }));
  };

  const toggleChecklist = (id: string, checked: boolean) => {
    store.commit(s => ({
      ...s,
      pipeline: {
        ...s.pipeline,
        installRecord: {
          ...s.pipeline.installRecord,
          checklist: s.pipeline.installRecord.checklist.map(c => 
            c.id === id ? { 
              ...c, 
              isCompleted: checked,
              completedBy: checked ? store.actorName : '',
              date: checked ? new Date().toISOString() : ''
            } : c
          )
        }
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Crew Lead / Installer</Label>
          <Input 
            value={install.crewLead} 
            onChange={e => updateField('crewLead', e.target.value)} 
            placeholder="Name"
          />
        </div>
        <div className="space-y-2">
          <Label>Scheduled Date</Label>
          <Input 
            type="date"
            value={install.scheduledDate} 
            onChange={e => updateField('scheduledDate', e.target.value)} 
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Daily Notes</Label>
          <Textarea 
            value={install.dailyNotes} 
            onChange={e => updateField('dailyNotes', e.target.value)} 
            placeholder="Log daily progress and site conditions..."
          />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Field Execution Checklist</h3>
        <div className="bg-card border  p-2 space-y-1">
          {install.checklist.map(item => (
            <div key={item.id} className={`flex items-start gap-3 p-2transition-colors ${item.isCompleted ? 'bg-muted/30 text-muted-foreground' : 'hover:bg-muted/50'}`}>
              <Checkbox 
                checked={item.isCompleted} 
                onCheckedChange={c => toggleChecklist(item.id, !!c)}
                className="mt-0.5"
                data-testid={`install-check-${item.id}`}
              />
              <div className="flex-1">
                <div className={`text-sm ${item.isCompleted ? 'line-through' : ''}`}>
                  <span className="font-bold uppercase text-[10px] tracking-wider text-muted-foreground mr-2">{item.category}</span>
                  {item.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
