import { useState } from "react";
import {
  customFetch,
  useListPortalPriceOverrides,
  useUpsertPortalPriceOverride,
  getListPortalPriceOverridesQueryKey,
  useListPortalGroups,
  useListPortalUsers,
} from "@workspace/api-client-react";
import { Loader2, AlertTriangle, DollarSign, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";

type PriceOverride = { id: string; sku: string; wholesaleAmount: string; currency: string; groupId: string | null; accountId: string | null; updatedAt: string };
type Group = { id: string; name: string };
type Dealer = { id: string; displayName?: string | null; email: string };

export default function AdminPricing() {
  const queryClient = useQueryClient();
  const { data: overrides, isLoading: overridesLoading, error } = useListPortalPriceOverrides();
  // These enumerations are already restricted by the legacy staff router to staff admins.
  const { data: groups, isLoading: groupsLoading, error: groupsError } = useListPortalGroups();
  const { data: users, isLoading: usersLoading, error: usersError } = useListPortalUsers();
  const upsertMutation = useUpsertPortalPriceOverride();

  const [isUpsertOpen, setIsUpsertOpen] = useState(false);
  const [sku, setSku] = useState("");
  const [wholesaleAmount, setWholesaleAmount] = useState("");
  const [targetType, setTargetType] = useState<"group" | "account">("group");
  const [targetId, setTargetId] = useState("");
  const [toDelete, setToDelete] = useState<PriceOverride | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState("");
  const groupList = (groups ?? []) as Group[];
  const dealerList = (users ?? []) as Dealer[];
  const rows = (overrides ?? []) as PriceOverride[];
  const targetName = (o: PriceOverride) => o.groupId
    ? groupList.find(g => g.id === o.groupId)?.name ?? o.groupId
    : dealerList.find(u => u.id === o.accountId)?.displayName || dealerList.find(u => u.id === o.accountId)?.email || o.accountId || "Unknown dealer";
  const amount = Number(wholesaleAmount);
  const validAmount = /^\d+(?:\.\d{1,2})?$/.test(wholesaleAmount) && Number.isFinite(amount) && amount <= 9999999999.99;
  const validTarget = targetType === "group" ? groupList.some(g => g.id === targetId) : dealerList.some(u => u.id === targetId);
  const validForm = sku.trim().length > 0 && sku.trim().length <= 240 && validAmount && validTarget;

  const handleUpsert = () => {
    if (!validForm) { setFormError("Enter a SKU, a non-negative USD amount with at most two decimals, and a valid target."); return; }
    setFormError("");
    
    upsertMutation.mutate({ 
      data: { 
        sku: sku.trim(),
        wholesaleAmount: amount,
        currency: "USD",
        groupId: targetType === 'group' ? targetId : undefined,
        accountId: targetType === 'account' ? targetId : undefined,
      }
    }, {
      onSuccess: () => {
        setIsUpsertOpen(false);
        queryClient.invalidateQueries({ queryKey: getListPortalPriceOverridesQueryKey() });
        setSku(""); setWholesaleAmount(""); setTargetId("");
        toast.success("Price override saved");
      },
      onError: (error) => setFormError(error.message)
    });
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await customFetch(`/api/staff/portal/price-overrides/${encodeURIComponent(toDelete.id)}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: getListPortalPriceOverridesQueryKey() });
      setToDelete(null);
      toast.success("Price override deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete price override");
    } finally {
      setDeleting(false);
    }
  };

  if (overridesLoading || groupsLoading || usersLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || groupsError || usersError || !overrides) {
    return (
      <div className="p-8">
        <div className="border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Unable to load price overrides</h3>
             <p className="text-sm mt-1">{(error || groupsError || usersError)?.message ?? "Please try again later."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-border pb-6 shrink-0">
        <div className="space-y-2">
          <h1 className="text-3xl font-light tracking-tight flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-primary" />
            Pricing Overrides
          </h1>
          <p className="text-muted-foreground">Manage custom wholesale rates for specific groups or users.</p>
        </div>
        
        <Button onClick={() => setIsUpsertOpen(true)} className="rounded-none bg-primary text-primary-foreground self-start sm:self-end">
          New Override
        </Button>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-4 font-semibold">SKU</th>
              <th className="px-6 py-4 font-semibold text-right">Amount</th>
              <th className="px-6 py-4 font-semibold">Target Type</th>
               <th className="px-6 py-4 font-semibold">Target</th>
              <th className="px-6 py-4 font-semibold">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
             {rows.map(o => {
              const type = o.groupId ? 'group' : 'account';
              return (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-4 font-mono font-medium">{o.sku}</td>
                  <td className="px-6 py-4 text-right font-mono font-semibold">
                     {new Intl.NumberFormat('en-US', { style: 'currency', currency: o.currency }).format(Number(o.wholesaleAmount))}
                  </td>
                  <td className="px-6 py-4 capitalize">{type}</td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                     {targetName(o)}
                  </td>
                  <td className="px-6 py-4 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-2">
                      {format(new Date(o.updatedAt), "MMM d, yyyy")}
                       <Button variant="ghost" size="icon" aria-label={`Delete override for ${o.sku} — ${targetName(o)}`} className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setToDelete(o)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
             {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                  No pricing overrides found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

       <Dialog open={isUpsertOpen} onOpenChange={(open) => { setIsUpsertOpen(open); setFormError(""); }}>
        <DialogContent className="rounded-none border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-light">Set Price Override</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-4">
              <div className="space-y-1.5 flex-1">
                <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">SKU</label>
                <Input value={sku} onChange={e => setSku(e.target.value)} className="rounded-none bg-input font-mono" />
              </div>
              <div className="space-y-1.5 w-32 shrink-0">
                <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Amount</label>
                 <Input type="number" min="0" step="0.01" value={wholesaleAmount} onChange={e => setWholesaleAmount(e.target.value)} className="rounded-none bg-input font-mono" />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Target Type</label>
              <select 
                value={targetType} 
                 onChange={(e) => { setTargetType(e.target.value as "group" | "account"); setTargetId(""); }}
                className="flex h-10 w-full border border-input bg-input px-3 py-2 text-sm rounded-none"
              >
                <option value="group">Specific Group</option>
                <option value="account">Specific User Account</option>
              </select>
            </div>
            
            {targetType === 'group' ? (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Select Group</label>
                <select 
                  value={targetId} 
                  onChange={(e) => setTargetId(e.target.value)}
                  className="flex h-10 w-full border border-input bg-input px-3 py-2 text-sm rounded-none"
                >
                  <option value="" disabled>Select a group</option>
                   {groupList.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Select User</label>
                <select 
                  value={targetId} 
                  onChange={(e) => setTargetId(e.target.value)}
                  className="flex h-10 w-full border border-input bg-input px-3 py-2 text-sm rounded-none"
                >
                  <option value="" disabled>Select a user</option>
                   {dealerList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName ? `${u.displayName} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
           {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setIsUpsertOpen(false)}>Cancel</Button>
             <Button className="rounded-none bg-primary" onClick={handleUpsert} disabled={!validForm || upsertMutation.isPending}>
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
       <Dialog open={toDelete !== null} onOpenChange={(open) => { if (!open && !deleting) setToDelete(null); }}>
         <DialogContent className="rounded-none border-border sm:max-w-md">
           <DialogHeader><DialogTitle>Delete price override?</DialogTitle></DialogHeader>
           <p className="text-sm text-muted-foreground">
             Remove the {toDelete?.sku} override for {toDelete ? targetName(toDelete) : ""}? The dealer will return to their applicable group or pricebook rate.
           </p>
           <DialogFooter>
             <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
             <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete Override"}</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
    </div>
  );
}
