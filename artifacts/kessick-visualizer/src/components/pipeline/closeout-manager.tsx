import React from 'react';
import { useAppStore } from '@/store';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function CloseoutManager() {
  const store = useAppStore();
  const closeout = store.pipeline.closeoutRecord;

  const updateField = (field: keyof typeof closeout, value: string | boolean) => {
    store.commit(s => ({
      ...s,
      pipeline: {
        ...s.pipeline,
        closeoutRecord: {
          ...s.pipeline.closeoutRecord,
          [field]: value
        }
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Final Acceptance Date</Label>
          <Input 
            type="date"
            value={closeout.finalAcceptanceDate} 
            onChange={e => updateField('finalAcceptanceDate', e.target.value)} 
          />
        </div>
        <div className="space-y-2">
          <Label>Warranty Start Date</Label>
          <Input 
            type="date"
            value={closeout.warrantyStartDate} 
            onChange={e => updateField('warrantyStartDate', e.target.value)} 
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label>Serial / Reference Notes</Label>
          <Textarea 
            value={closeout.serialNotes} 
            onChange={e => updateField('serialNotes', e.target.value)} 
            placeholder="Log serial numbers for cooling units, specialized lighting, etc."
          />
        </div>
      </div>

      <div className="bg-card border  p-4 space-y-4">
        <h3 className="font-bold uppercase tracking-wider text-xs text-muted-foreground">Closeout Package</h3>
        
        <div className="flex items-center gap-3">
          <Checkbox 
            checked={closeout.isPackageComplete}
            onCheckedChange={c => updateField('isPackageComplete', !!c)}
          />
          <Label className="text-sm font-bold">Package is Complete & Handed Over</Label>
        </div>

        <div className="text-sm text-muted-foreground ml-7 space-y-1">
          <div>&bull; Final Payment Received</div>
          <div>&bull; As-Built Drawings Provided</div>
          <div>&bull; Care & Maintenance Guide Delivered</div>
          <div>&bull; Warranty Documentation Registered</div>
        </div>
      </div>
    </div>
  );
}
