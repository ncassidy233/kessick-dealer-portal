import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { RiskRecord } from '@/types/pipeline';
import { v4 as uuidv4 } from 'uuid';

export function RiskRegister() {
  const store = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<RiskRecord>>({
    title: '',
    category: 'schedule',
    severity: 'medium',
    status: 'open',
    owner: '',
    mitigation: ''
  });

  const handleSave = () => {
    if (!formData.title) return;
    
    store.commit(s => {
      const newRisk: RiskRecord = {
        id: uuidv4(),
        title: formData.title!,
        category: formData.category as any,
        severity: formData.severity as any,
        status: formData.status as any,
        owner: formData.owner || 'Unassigned',
        mitigation: formData.mitigation || '',
        dueDate: '',
        stageId: ''
      };
      
      return {
        ...s,
        pipeline: {
          ...s.pipeline,
          risks: [newRisk, ...s.pipeline.risks]
        }
      };
    });
    
    store.recordActivity('Risk Added', `Risk logged: ${formData.title}`);
    setIsAdding(false);
    setFormData({ title: '', category: 'schedule', severity: 'medium', status: 'open', owner: '', mitigation: '' });
  };

  const updateRiskStatus = (id: string, status: 'open' | 'mitigated' | 'closed') => {
    store.commit(s => ({
      ...s,
      pipeline: {
        ...s.pipeline,
        risks: s.pipeline.risks.map(r => r.id === id ? { ...r, status } : r)
      }
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Risk Register</h3>
        {!isAdding && <Button size="sm" variant="outline" className="border-amber-500 text-amber-500 hover:bg-amber-500/10" onClick={() => setIsAdding(true)}>Log Issue/Risk</Button>}
      </div>

      {isAdding && (
        <div className="bg-card border border-amber-500/30 p-4  space-y-4 shadow-sm">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label>Risk / Issue Title</Label>
              <Input 
                value={formData.title} 
                onChange={e => setFormData({...formData, title: e.target.value})} 
                placeholder="e.g. Long lead time on custom finish"
              />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={v => setFormData({...formData, category: v as any})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedule">Schedule</SelectItem>
                  <SelectItem value="budget">Budget</SelectItem>
                  <SelectItem value="site">Site Condition</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="supply">Supply Chain</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
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
            <div className="space-y-2 col-span-2">
              <Label>Mitigation Plan</Label>
              <Textarea 
                value={formData.mitigation} 
                onChange={e => setFormData({...formData, mitigation: e.target.value})} 
                placeholder="How will this be addressed?"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.title}>Save Risk</Button>
          </div>
        </div>
      )}

      {store.pipeline.risks.length === 0 && !isAdding && (
          <div className="text-sm text-muted-foreground italic bg-muted/30 p-4 text-center border">
          No risks or issues logged.
        </div>
      )}

      <div className="space-y-2">
        {store.pipeline.risks.map(r => (
          <div key={r.id} className={`p-3 borderbg-card flex flex-col gap-2 text-sm ${r.status === 'open' && (r.severity === 'high' || r.severity === 'critical') ? 'border-destructive' : ''}`}>
            <div className="flex justify-between font-bold">
              <span>{r.title}</span>
              <Select value={r.status} onValueChange={(v) => updateRiskStatus(r.id, v as any)}>
                <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="mitigated">Mitigated</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 text-xs uppercase tracking-wider text-muted-foreground font-bold">
              <span>{r.category}</span>
              <span className={r.severity === 'critical' || r.severity === 'high' ? 'text-destructive' : ''}>
                {r.severity}
              </span>
            </div>
            {r.mitigation && <div className="text-muted-foreground mt-1">Plan: {r.mitigation}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
