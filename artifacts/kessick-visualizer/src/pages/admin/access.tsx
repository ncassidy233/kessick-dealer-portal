import { useState } from "react";
import { 
  useListPortalAccessRules, 
  useUpsertPortalAccessRule, 
  getListPortalAccessRulesQueryKey,
  useListPortalGroups,
  useListPortalUsers 
} from "@workspace/api-client-react";
import { Loader2, AlertTriangle, Shield, Check, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function AdminAccess() {
  const queryClient = useQueryClient();
  const { data: rules, isLoading: rulesLoading, error } = useListPortalAccessRules();
  const { data: groups, isLoading: groupsLoading } = useListPortalGroups();
  const { data: users, isLoading: usersLoading } = useListPortalUsers();
  const upsertMutation = useUpsertPortalAccessRule();

  const [isUpsertOpen, setIsUpsertOpen] = useState(false);
  const [subjectType, setSubjectType] = useState<"account" | "group">("group");
  const [groupId, setGroupId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [capabilityPreset, setCapabilityPreset] = useState("custom");
  const [customCapability, setCustomCapability] = useState("");
  const [enabled, setEnabled] = useState(true);

  const capability = capabilityPreset === "custom" ? customCapability : capabilityPreset;

  const handleUpsert = () => {
    if (!capability.trim()) return;
    if (subjectType === 'group' && !groupId.trim()) return;
    if (subjectType === 'account' && !accountId.trim()) return;

    upsertMutation.mutate({ 
      data: { 
        subjectType,
        groupId: subjectType === 'group' ? groupId : undefined,
        accountId: subjectType === 'account' ? accountId : undefined,
        capability,
        enabled
      } as any
    }, {
      onSuccess: () => {
        setIsUpsertOpen(false);
        queryClient.invalidateQueries({ queryKey: getListPortalAccessRulesQueryKey() });
        toast.success("Access rule saved");
      },
      onError: () => toast.error("Failed to save access rule")
    });
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/api/staff/portal/access-rules/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: getListPortalAccessRulesQueryKey() });
        toast.success("Access rule deleted");
      } else {
        toast.error("Failed to delete access rule");
      }
    } catch (e) {
      toast.error("An error occurred while deleting");
    }
  };

  if (rulesLoading || groupsLoading || usersLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !rules) {
    return (
      <div className="p-8">
        <div className="border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold">Unable to load access rules</h3>
            <p className="text-sm mt-1">Please try again later.</p>
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
            <Shield className="w-8 h-8 text-primary" />
            Access Rules
          </h1>
          <p className="text-muted-foreground">Manage visibility matrices for content and pricing.</p>
        </div>
        
        <Button onClick={() => setIsUpsertOpen(true)} className="rounded-none bg-primary text-primary-foreground self-start sm:self-end">
          New Rule
        </Button>
      </div>

      <div className="border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/50 border-b border-border">
            <tr>
              <th className="px-6 py-4 font-semibold">Capability</th>
              <th className="px-6 py-4 font-semibold">Subject Type</th>
              <th className="px-6 py-4 font-semibold">Target ID</th>
              <th className="px-6 py-4 font-semibold text-right">Access</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(rules as any[]).map(r => (
              <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-6 py-4 font-mono font-medium">{r.capability}</td>
                <td className="px-6 py-4 capitalize">{r.subjectType}</td>
                <td className="px-6 py-4 text-xs text-muted-foreground">
                  {r.subjectType === 'group' 
                    ? (groups as any[])?.find(g => g.id === r.groupId)?.name || r.groupId 
                    : (users as any[])?.find(u => u.id === r.accountId)?.email || r.accountId}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {r.enabled ? (
                      <Badge variant="outline" className="text-[10px] rounded-none border-primary/50 text-primary">GRANTED</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] rounded-none border-destructive/50 text-destructive">DENIED</Badge>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                  No access rules defined. Portal access is allowed by default until an override is added.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isUpsertOpen} onOpenChange={setIsUpsertOpen}>
        <DialogContent className="rounded-none border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-light">Upsert Access Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Capability</label>
              <select 
                value={capabilityPreset} 
                onChange={(e) => setCapabilityPreset(e.target.value)}
                className="flex h-10 w-full border border-input bg-input px-3 py-2 text-sm rounded-none"
              >
                <option value="custom">Custom (SKU, Form ID, Resource ID)</option>
                <option value="page:pricing">page:pricing</option>
                <option value="page:forms">page:forms</option>
                <option value="page:resources">page:resources</option>
                <option value="page:notifications">page:notifications</option>
              </select>
            </div>

            {capabilityPreset === "custom" && (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Custom Capability Key</label>
                <Input value={customCapability} onChange={e => setCustomCapability(e.target.value)} placeholder="e.g. form:123 or pricing:DEMO-1" className="rounded-none bg-input font-mono" />
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Subject Type</label>
              <select 
                value={subjectType} 
                onChange={(e) => setSubjectType(e.target.value as any)}
                className="flex h-10 w-full border border-input bg-input px-3 py-2 text-sm rounded-none"
              >
                <option value="group">Group</option>
                <option value="account">User Account</option>
              </select>
            </div>
            
            {subjectType === 'group' ? (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Select Group</label>
                <select 
                  value={groupId} 
                  onChange={(e) => setGroupId(e.target.value)}
                  className="flex h-10 w-full border border-input bg-input px-3 py-2 text-sm rounded-none"
                >
                  <option value="" disabled>Select a group</option>
                  {(groups as any[] || []).map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-widest font-semibold text-muted-foreground">Select User</label>
                <select 
                  value={accountId} 
                  onChange={(e) => setAccountId(e.target.value)}
                  className="flex h-10 w-full border border-input bg-input px-3 py-2 text-sm rounded-none"
                >
                  <option value="" disabled>Select a user</option>
                  {(users as any[] || []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName ? `${u.displayName} (${u.email})` : u.email}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="flex items-center gap-2 pt-2">
              <Button 
                variant="outline" 
                className={`rounded-none flex-1 ${enabled ? 'border-primary text-primary' : ''}`}
                onClick={() => setEnabled(true)}
              >
                <Check className="w-4 h-4 mr-2" /> Grant Access
              </Button>
              <Button 
                variant="outline" 
                className={`rounded-none flex-1 ${!enabled ? 'border-destructive text-destructive' : ''}`}
                onClick={() => setEnabled(false)}
              >
                <X className="w-4 h-4 mr-2" /> Deny Access
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setIsUpsertOpen(false)}>Cancel</Button>
            <Button className="rounded-none bg-primary" onClick={handleUpsert} disabled={!capability.trim() || upsertMutation.isPending}>
              Save Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
