import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PunchItem } from '@/types/pipeline';
import { v4 as uuidv4 } from 'uuid';

export function PunchListManager() {
  const store = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<PunchItem>>({
    location: '',
    description: '',
    severity: 'medium',
    status: 'open',
    owner: ''
  });

  const handleSave = () => {
    if (!formData.description) return;
    
    store.commit(s => {
      const newItem: PunchItem = {
        id: uuidv4(),
        location: formData.location || 'General',
        description: formData.description!,
        severity: formData.severity as any,
        status: formData.status as any,
        owner: formData.owner || 'Unassigned',
        dueDate: '',
        evidenceLink: '',
        resolutionNote: '',
        clientVerified: false
      };
      
      return {
        ...s,
        pipeline: {
          ...s.pipeline,
          punchItems: [newItem, ...s.pipeline.punchItems]
        }
      };
    });
    
    store.recordActivity('Punch Item Added', `Punch item logged: ${formData.description}`, 'punch-list');
    setIsAdding(false);
    setFormData({ location: '', description: '', severity: 'medium', status: 'open', owner: '' });
  };

  const updateStatus = (id: string, status: 'open' | 'resolved' | 'verified') => {
    store.commit(s => ({
      ...s,
      pipeline: {
        ...s.pipeline,
        punchItems: s.pipeline.punchItems.map(p => p.id === id ? { ...p, status, clientVerified: status === 'verified' } : p)
      }
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Punch List</h3>
        {!isAdding && <Button size="sm" onClick={() => setIsAdding(true)}>Add Punch Item</Button>}
      </div>

      {isAdding && (
        <div className="bg-card border p-4  space-y-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Issue Description</Label>
              <Input 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                placeholder="e.g. Scratch on baseboard right side"
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input 
                value={formData.location} 
                onChange={e => setFormData({...formData, location: e.target.value})} 
                placeholder="e.g. Wall A"
              />
            </div>
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select value={formData.severity} onValueChange={v => setFormData({...formData, severity: v as any})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.description}>Save Item</Button>
          </div>
        </div>
      )}

      {store.pipeline.punchItems.length === 0 && !isAdding && (
          <div className="text-sm text-muted-foreground italic bg-muted/30 p-4 text-center border">
          No punch list items logged.
        </div>
      )}

      <div className="space-y-2">
        {store.pipeline.punchItems.map(p => (
          <div key={p.id} className={`p-3 borderbg-card flex flex-col gap-2 text-sm ${p.status === 'open' && (p.severity === 'high' || p.severity === 'critical') ? 'border-destructive' : ''}`}>
            <div className="flex justify-between font-bold">
              <span>{p.description}</span>
              <Select value={p.status} onValueChange={(v) => updateStatus(p.id, v as any)}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="verified">Verified</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 text-xs uppercase tracking-wider text-muted-foreground font-bold">
              <span>{p.location}</span>
              <span className={p.severity === 'critical' || p.severity === 'high' ? 'text-destructive' : ''}>
                {p.severity}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
