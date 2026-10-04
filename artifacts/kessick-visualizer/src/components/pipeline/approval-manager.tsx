import React, { useState } from 'react';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApprovalRecord } from '@/types/pipeline';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export function ApprovalManager() {
  const store = useAppStore();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<ApprovalRecord>>({
    type: 'design',
    method: 'email',
    approver: '',
    notes: ''
  });

  const handleSave = () => {
    if (!formData.approver) return;
    
    store.commit(s => {
      const newApproval: ApprovalRecord = {
        id: uuidv4(),
        type: formData.type as any,
        method: formData.method as any,
        approver: formData.approver!,
        notes: formData.notes || '',
        date: new Date().toISOString(),
        referenceId: formData.type === 'design' ? s.activeOptionId : ''
      };
      
      // Auto-update Option status if design approval
      if (formData.type === 'design' && s.activeOptionId) {
        const opt = s.options.find(o => o.id === s.activeOptionId);
        if (opt) opt.status = 'approved';
      }
      
      return {
        ...s,
        pipeline: {
          ...s.pipeline,
          approvals: [newApproval, ...s.pipeline.approvals]
        }
      };
    });
    
    store.recordActivity('Approval Recorded', `Client approved ${formData.type} via ${formData.method}.`, 'client-approval');
    setIsAdding(false);
    setFormData({ type: 'design', method: 'email', approver: '', notes: '' });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Explicit Approvals</h3>
        {!isAdding && <Button size="sm" onClick={() => setIsAdding(true)}>Add Approval</Button>}
      </div>

      {isAdding && (
        <div className="bg-card border p-4  space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={formData.type} onValueChange={v => setFormData({...formData, type: v as any})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="design">Design Option</SelectItem>
                  <SelectItem value="estimate">Estimate</SelectItem>
                  <SelectItem value="document">Construction Doc</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={formData.method} onValueChange={v => setFormData({...formData, method: v as any})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="signature">Signature</SelectItem>
                  <SelectItem value="verbal">Verbal</SelectItem>
                  <SelectItem value="portal">Client Portal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Approver Name</Label>
              <Input 
                value={formData.approver} 
                onChange={e => setFormData({...formData, approver: e.target.value})} 
                placeholder="e.g. John Doe"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Notes / Reference</Label>
              <Textarea 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                placeholder="Reference to email thread or specific details..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!formData.approver}>Save Approval</Button>
          </div>
        </div>
      )}

      {store.pipeline.approvals.length === 0 && !isAdding && (
          <div className="text-sm text-muted-foreground italic bg-muted/30 p-4 text-center border">
          No approvals recorded yet.
        </div>
      )}

      <div className="space-y-2">
        {store.pipeline.approvals.map(a => (
          <div key={a.id} className="p-3 borderbg-card flex flex-col gap-1 text-sm">
            <div className="flex justify-between font-bold">
              <span className="capitalize">{a.type} Approval</span>
              <span className="text-muted-foreground font-normal">{format(new Date(a.date), 'MMM d, yyyy')}</span>
            </div>
            <div><span className="text-muted-foreground">By:</span> {a.approver} via {a.method}</div>
            {a.notes && <div className="text-muted-foreground italic mt-1">{a.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
