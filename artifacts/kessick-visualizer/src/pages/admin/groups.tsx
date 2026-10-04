import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Edit3, Loader2, Plus, Search, Trash2, UserRoundPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  canManage,
  createPortalGroup,
  deletePortalGroup,
  listPortalGroups,
  listPortalUsers,
  portalQueryKeys,
  hasCapability,
  PortalGroup,
  PortalRole,
  PortalUser,
  replacePortalGroupMembers,
  updatePortalGroup,
  usePortalBootstrap,
} from "@/lib/portal-admin-api";

const ivory = "bg-[#F3F0E8] text-[#121210]";
const card = "border border-[#121210]/10 bg-white/70";
const inputClass = "rounded-none border-[#121210]/15 bg-white/80 text-[#121210] placeholder:text-[#121210]/45";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

export default function AdminGroups() {
  const queryClient = useQueryClient();
  const bootstrap = usePortalBootstrap();
  const role = bootstrap.data?.role;
  const canRead = hasCapability(bootstrap.data?.capabilities, "groups:read");
  const canEdit = canManage(role, "groups") && hasCapability(bootstrap.data?.capabilities, "groups:write");
  const groupsQuery = useQuery({
    queryKey: portalQueryKeys.groups,
    queryFn: listPortalGroups,
    enabled: Boolean(bootstrap.data?.authorized) && canRead,
    staleTime: 20_000,
  });
  const usersQuery = useQuery({
    queryKey: portalQueryKeys.users({ role: "dealer" }),
    queryFn: () => listPortalUsers({ role: "dealer" }),
    enabled: Boolean(bootstrap.data?.authorized) && canRead,
    staleTime: 20_000,
  });
  const groups = groupsQuery.data?.groups ?? [];
  const dealers = usersQuery.data?.users ?? [];
  const [search, setSearch] = useState("");
  const [editingGroup, setEditingGroup] = useState<PortalGroup | null>(null);
  const [memberGroup, setMemberGroup] = useState<PortalGroup | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<PortalGroup | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [reassignToGroupId, setReassignToGroupId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const visibleGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? groups.filter((group) => `${group.name} ${group.description || ""}`.toLowerCase().includes(needle)) : groups;
  }, [groups, search]);
  const visibleDealers = useMemo(() => {
    const needle = memberSearch.trim().toLowerCase();
    return needle ? dealers.filter((user) => `${user.email} ${user.displayName || ""}`.toLowerCase().includes(needle)) : dealers;
  }, [dealers, memberSearch]);

  const createMutation = useMutation({ mutationFn: createPortalGroup });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; description?: string } }) => updatePortalGroup(id, data),
  });
  const deleteMutation = useMutation({
    mutationFn: ({ id, reassign }: { id: string; reassign?: string }) => deletePortalGroup(id, reassign),
  });
  const membersMutation = useMutation({
    mutationFn: ({ id, accountIds }: { id: string; accountIds: string[] }) => replacePortalGroupMembers(id, accountIds),
  });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: portalQueryKeys.groups });
    queryClient.invalidateQueries({ queryKey: ["portal-v2", "admin", "users"] });
  };

  const openCreate = () => {
    setName("");
    setDescription("");
    setEditingGroup(null);
    setIsCreateOpen(true);
  };
  const openEdit = (group: PortalGroup) => {
    setName(group.name);
    setDescription(group.description || "");
    setEditingGroup(group);
    setIsCreateOpen(true);
  };
  const saveGroup = async () => {
    if (!name.trim()) return;
    try {
      if (editingGroup) await updateMutation.mutateAsync({ id: editingGroup.id, data: { name: name.trim(), description: description.trim() } });
      else await createMutation.mutateAsync({ name: name.trim(), description: description.trim() });
      setIsCreateOpen(false);
      invalidate();
      toast.success(editingGroup ? "Group updated" : "Group created");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const openMembers = (group: PortalGroup) => {
    setMemberGroup(group);
    setMemberSearch("");
    setSelectedMemberIds(dealers.filter((dealer) => dealer.groups?.some((item) => item.id === group.id)).map((dealer) => dealer.id));
  };
  const saveMembers = async () => {
    if (!memberGroup) return;
    try {
      await membersMutation.mutateAsync({ id: memberGroup.id, accountIds: selectedMemberIds });
      setMemberGroup(null);
      invalidate();
      toast.success("Group membership updated");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const confirmDelete = async () => {
    if (!deletingGroup) return;
    if (deletingGroup.memberCount > 0 && !reassignToGroupId) return;
    try {
      await deleteMutation.mutateAsync({ id: deletingGroup.id, ...(reassignToGroupId ? { reassign: reassignToGroupId } : {}) });
      setDeletingGroup(null);
      setReassignToGroupId("");
      invalidate();
      toast.success("Group deleted");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (bootstrap.isLoading || groupsQuery.isLoading || usersQuery.isLoading) return <Loading />;
  if (bootstrap.error || groupsQuery.error || usersQuery.error || !bootstrap.data) return <ErrorState message={errorMessage(bootstrap.error ?? groupsQuery.error ?? usersQuery.error)} />;
  if (!canRead) return <ErrorState message="Your role does not have access to dealer groups." />;

  return (
    <div className={`min-h-full ${ivory} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#121210]/15 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">Audience architecture</p>
            <h1 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Groups</h1>
            <p className="mt-2 text-sm text-[#121210]/60">Build reusable dealer audiences for content visibility, notifications, and pricing.</p>
          </div>
          {canEdit && <Button onClick={openCreate} className="rounded-none bg-[#121210] text-[#F3F0E8] hover:bg-[#121210]/85"><Plus className="mr-2 h-4 w-4" /> New group</Button>}
        </header>
        <section className="grid gap-3 sm:grid-cols-3">
          <Stat label="Total groups" value={groups.length} detail="audiences available" />
          <Stat label="Dealer accounts" value={dealers.length} detail="eligible for membership" />
          <Stat label="Visible results" value={visibleGroups.length} detail="matching your search" />
        </section>
        <section className={`${card} p-4`}>
          <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/45" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search groups" className={`${inputClass} pl-9`} /></div>
        </section>
        {visibleGroups.length === 0 ? (
          <div className={`${card} px-6 py-16 text-center`}><Users className="mx-auto h-8 w-8 text-[#B39862]" /><h2 className="mt-3 font-medium">No groups yet</h2><p className="mt-1 text-sm text-[#121210]/55">Create an audience to target portal content and alerts.</p></div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleGroups.map((group) => (
              <article key={group.id} className={`${card} flex min-h-[210px] flex-col p-5 transition hover:border-[#B39862]/60`}>
                <div className="flex items-start justify-between gap-3"><div><span className="text-[10px] uppercase tracking-[0.16em] text-[#B39862]">{group.memberCount} member{group.memberCount === 1 ? "" : "s"}</span><h2 className="mt-2 text-xl font-medium">{group.name}</h2></div>{canEdit && <div className="flex gap-1"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-[#B39862]/15" onClick={() => openEdit(group)}><Edit3 className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 rounded-none text-[#8b382b] hover:bg-[#a64c3b]/10" onClick={() => { setDeletingGroup(group); setReassignToGroupId(""); }}><Trash2 className="h-4 w-4" /></Button></div>}</div>
                <p className="mt-3 line-clamp-3 flex-1 text-sm leading-6 text-[#121210]/60">{group.description || "No description provided."}</p>
                <div className="mt-5 flex items-center justify-between border-t border-[#121210]/10 pt-3"><span className="text-xs text-[#121210]/45">Updated {group.updatedAt ? new Date(group.updatedAt).toLocaleDateString() : new Date(group.createdAt).toLocaleDateString()}</span>{canEdit && <Button variant="outline" size="sm" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => openMembers(group)}><UserRoundPlus className="mr-2 h-3.5 w-3.5" /> Members</Button>}</div>
              </article>
            ))}
          </section>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-lg"><DialogHeader><DialogTitle className="text-2xl font-medium">{editingGroup ? "Edit group" : "Create group"}</DialogTitle></DialogHeader><div className="space-y-4 py-3"><Field label="Group name"><Input value={name} onChange={(event) => setName(event.target.value)} className={inputClass} placeholder="Preferred showroom partners" /></Field><Field label="Description (optional)"><textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} className="w-full resize-none border border-[#121210]/15 bg-white/80 p-3 text-sm outline-none" placeholder="Describe who should see this audience's content." /></Field></div><DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setIsCreateOpen(false)}>Cancel</Button><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={!name.trim() || createMutation.isPending || updateMutation.isPending} onClick={saveGroup}>{createMutation.isPending || updateMutation.isPending ? "Saving…" : editingGroup ? "Save changes" : "Create group"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={Boolean(memberGroup)} onOpenChange={(open) => !open && setMemberGroup(null)}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-xl"><DialogHeader><DialogTitle className="text-2xl font-medium">Manage {memberGroup?.name}</DialogTitle></DialogHeader><div className="space-y-3 py-3"><p className="text-sm text-[#121210]/60">Select any number of dealer accounts. Membership is replaced atomically when you save.</p><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/45" /><Input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Filter dealers" className={`${inputClass} pl-9`} /></div><div className="max-h-72 overflow-y-auto border border-[#121210]/10 bg-white/55 p-3">{visibleDealers.map((dealer) => <label key={dealer.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-[#121210]/10 py-3 last:border-0"><span><span className="block text-sm font-medium">{dealer.displayName || "Name not set"}</span><span className="text-xs text-[#121210]/50">{dealer.email}</span></span><input type="checkbox" checked={selectedMemberIds.includes(dealer.id)} onChange={() => setSelectedMemberIds((ids) => ids.includes(dealer.id) ? ids.filter((id) => id !== dealer.id) : [...ids, dealer.id])} className="h-4 w-4 accent-[#B39862]" /></label>)}{visibleDealers.length === 0 && <p className="py-8 text-center text-sm text-[#121210]/50">No dealer accounts found.</p>}</div><p className="text-xs uppercase tracking-[0.14em] text-[#121210]/45">{selectedMemberIds.length} selected</p></div><DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setMemberGroup(null)}>Cancel</Button><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={membersMutation.isPending} onClick={saveMembers}>{membersMutation.isPending ? "Saving…" : "Save members"}</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={Boolean(deletingGroup)} onOpenChange={(open) => !open && setDeletingGroup(null)}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-lg"><DialogHeader><DialogTitle className="text-2xl font-medium">Delete group?</DialogTitle></DialogHeader><div className="space-y-4 py-3"><p className="text-sm text-[#121210]/65">Deleting <strong>{deletingGroup?.name}</strong> also transfers its content targets. This cannot be undone.</p>{(deletingGroup?.memberCount || 0) > 0 ? <><div className="border-l-2 border-[#B39862] bg-[#B39862]/10 px-3 py-2 text-xs text-[#121210]/65">This group has {deletingGroup?.memberCount} members. Choose a destination group to transfer memberships.</div><select value={reassignToGroupId} onChange={(event) => setReassignToGroupId(event.target.value)} className="h-10 w-full border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none"><option value="">Select destination group</option>{groups.filter((group) => group.id !== deletingGroup?.id).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></> : <p className="text-xs text-[#121210]/50">This group has no members; no reassignment is needed.</p>}</div><DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setDeletingGroup(null)}>Keep group</Button><Button className="rounded-none bg-[#8b382b] text-white hover:bg-[#8b382b]/90" disabled={deleteMutation.isPending || ((deletingGroup?.memberCount || 0) > 0 && !reassignToGroupId)} onClick={confirmDelete}>{deleteMutation.isPending ? "Deleting…" : "Delete group"}</Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className={`${card} p-4`}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#121210]/50">{label}</p><p className="mt-2 text-3xl font-medium">{value}</p><p className="mt-1 text-xs text-[#121210]/50">{detail}</p></div>;
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#121210]/55">{label}</label>{children}</div>;
}
function Loading() {
  return <div className={`flex min-h-[60vh] items-center justify-center ${ivory}`}><Loader2 className="h-6 w-6 animate-spin text-[#B39862]" /></div>;
}
function ErrorState({ message }: { message: string }) {
  return <div className={`min-h-[60vh] ${ivory} p-6 md:p-10`}><div className="mx-auto max-w-2xl border border-[#a64c3b]/30 bg-[#a64c3b]/10 p-5 text-[#8b382b]"><AlertTriangle className="mb-3 h-5 w-5" /><h2 className="font-medium">Groups are unavailable</h2><p className="mt-1 text-sm opacity-80">{message}</p></div></div>;
}