import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAppStore } from '@/store';
import { useProducts } from '@/hooks/use-products';
import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { resolveProductForInstance } from '@/lib/catalog-domain';

export function QuoteModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { instances, unit } = useAppStore();
  const { data: products } = useProducts();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open && products) {
      const summary = instances
        .map((inst) => {
          const product = resolveProductForInstance(inst, products);
          if (!product) return null;
          
          let w = inst.customSized ? inst.scaleX * product.width_in : product.width_in;
          let h = inst.customSized ? inst.scaleY * product.height_in : product.height_in;
          let d = product.depth_in;

          if (unit === 'cm') {
            w *= 2.54;
            h *= 2.54;
            d *= 2.54;
          }

          const u = unit === 'cm' ? 'cm' : '"';
          return `- [${product.sku}] ${product.name} (${w.toFixed(1)}${u} W x ${h.toFixed(1)}${u} H x ${d.toFixed(1)}${u} D)`;
        })
        .filter(Boolean)
        .join('\n');
      setNotes(`Project Summary:\n${summary}\n\nAdditional notes:\n`);
    }
  }, [open, instances, products, unit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(`Quote Request: ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\n${notes}`);
    window.location.href = `mailto:sales@kessickwinecellars.com?subject=${subject}&body=${body}`;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-border bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle className="text-lg font-sans font-bold uppercase tracking-widest text-primary">Request Quote</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Send your layout to our design team for a professional review and quote.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-background" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-background" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Project Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-40 bg-background font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Send Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
