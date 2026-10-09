import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Clipboard,
  Loader2,
  MailPlus,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  addPortalGroupMember,
  assignPortalRep,
  canManage,
  createPortalUser,
  deletePortalUser,
  listPortalGroups,
  listPortalUsers,
  portalQueryKeys,
  hasCapability,
  PortalGroup,
  PortalRole,
  PortalUser,
  removePortalGroupMember,
  resendPortalUserInvitation,
  replacePortalGroupMembers,
  updatePortalUser,
  usePortalBootstrap,
  UserStatus,
} from "@/lib/portal-admin-api";

const ivory = "bg-[#F3F0E8] text-[#121210]";
const card = "border border-[#121210]/10 bg-white/70";
const inputClass = "rounded-none border-[#121210]/15 bg-white/80 text-[#121210] placeholder:text-[#121210]/45";
const roles: Array<{ value: Exclude<PortalRole, "dealer">; label: string }> = [
  { value: "staff_admin", label: "Staff admin" },
  { value: "sales_rep", label: "Sales rep" },
  { value: "content_manager", label: "Content manager" },
  { value: "super_admin", label: "Super admin" },
];
const statusOptions: Array<{ value: UserStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "approved", label: "Approved" },
  { value: "pending", label: "Pending" },
  { value: "suspended", label: "Suspended" },
];

function labelRole(role: string) {
  return role.replaceAll("_", " ");
}

function statusTone(status: UserStatus) {
  if (status === "approved") return "border-[#55704b]/40 bg-[#55704b]/10 text-[#3d5a35]";
  if (status === "suspended") return "border-[#a64c3b]/40 bg-[#a64c3b]/10 text-[#8b382b]";
  return "border-[#B39862]/50 bg-[#B39862]/10 text-[#725a2c]";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const bootstrap = usePortalBootstrap();
  const role = bootstrap.data?.role;
  const canRead = hasCapability(bootstrap.data?.capabilities, "users:read");
  const canEdit = canManage(role, "users") && hasCapability(bootstrap.data?.capabilities, "users:write");
  const isSuperAdmin = role === "super_admin" && hasCapability(bootstrap.data?.capabilities, "users:write");
  const [userType, setUserType] = useState<"dealer" | "staff">("dealer");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [isGroupsOpen, setIsGroupsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [activeUser, setActiveUser] = useState<PortalUser | null>(null);
  const [roleUser, setRoleUser] = useState<PortalUser | null>(null);
  const [createdUser, setCreatedUser] = useState<PortalUser | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newRole, setNewRole] = useState<PortalRole>("dealer");
  const [newStatus, setNewStatus] = useState<UserStatus>("approved");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [repId, setRepId] = useState("");
  const [bulkStatus, setBulkStatus] = useState<UserStatus>("approved");
  const [selectedRole, setSelectedRole] = useState<Exclude<PortalRole, "dealer">>("staff_admin");

  const usersQuery = useQuery({
    queryKey: portalQueryKeys.users({ role: userType, ...(status === "all" ? {} : { status }) }),
    queryFn: () => listPortalUsers({ role: userType, ...(status === "all" ? {} : { status }) }),
    enabled: Boolean(bootstrap.data?.authorized) && canRead,
    staleTime: 20_000,
  });
  const staffQuery = useQuery({
    queryKey: portalQueryKeys.users({ role: "staff" }),
    queryFn: () => listPortalUsers({ role: "staff" }),
    enabled: Boolean(bootstrap.data?.authorized) && isSuperAdmin,
    staleTime: 20_000,
  });
  const groupsQuery = useQuery({
    queryKey: portalQueryKeys.groups,
    queryFn: listPortalGroups,
    enabled: Boolean(bootstrap.data?.authorized) && hasCapability(bootstrap.data?.capabilities, "groups:read"),
    staleTime: 20_000,
  });

  const users = usersQuery.data?.users ?? [];
  const salesReps = (staffQuery.data?.users ?? []).filter((user) => user.portalRole === "sales_rep");
  const groups = groupsQuery.data?.groups ?? [];
  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return users;
    return users.filter((user) =>
      [user.displayName, user.email, user.portalRole, user.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [search, users]);
  const selectableUsers = filteredUsers.filter((user) => user.id !== bootstrap.data?.account.id);
  const allVisibleSelected = selectableUsers.length > 0 && selectableUsers.every((user) => selectedIds.includes(user.id));

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ["portal-v2", "admin", "users"] });
  const invalidateGroups = () => queryClient.invalidateQueries({ queryKey: portalQueryKeys.groups });
  const createMutation = useMutation({ mutationFn: createPortalUser });
  const invitationMutation = useMutation({ mutationFn: resendPortalUserInvitation });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePortalUser>[1] }) => updatePortalUser(id, data),
  });
  const deleteMutation = useMutation({ mutationFn: deletePortalUser });
  const repMutation = useMutation({
    mutationFn: ({ id, rep }: { id: string; rep: string | null }) => assignPortalRep(id, rep),
  });
  const membershipMutation = useMutation({
    mutationFn: async ({ user, groupIds }: { user: PortalUser; groupIds: string[] }) => {
      const currentIds = new Set((user.groups ?? []).map((group) => group.id));
      const nextIds = new Set(groupIds);
      await Promise.all([
        ...groupIds.filter((id) => !currentIds.has(id)).map((groupId) => addPortalGroupMember(groupId, user.id)),
        ...Array.from(currentIds).filter((id) => !nextIds.has(id)).map((groupId) => removePortalGroupMember(groupId, user.id)),
      ]);
    },
  });
  const bulkMutation = useMutation({
    mutationFn: async ({ ids, nextStatus }: { ids: string[]; nextStatus: UserStatus }) =>
      Promise.all(ids.map((id) => updatePortalUser(id, { status: nextStatus }))),
  });

  const resetCreate = () => {
    setEmail("");
    setDisplayName("");
    setNewRole("dealer");
    setNewStatus("approved");
  };

  const handleCreate = async () => {
    if (!email.trim() || !email.includes("@")) return;
    if (newRole !== "dealer" && !isSuperAdmin) return;
    try {
      const result = await createMutation.mutateAsync({
        email: email.trim(),
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        role: newRole,
        status: newStatus,
      });
      setCreatedUser(result.user);
      setIsCreateOpen(false);
      setIsInviteOpen(true);
      resetCreate();
      invalidateUsers();
      toast.success(`${newRole === "dealer" ? "Dealer" : "Staff account"} provisioned`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleResendInvitation = async (user: PortalUser) => {
    try {
      const result = await invitationMutation.mutateAsync(user.id);
      setCreatedUser({ ...user, invitation: result.invitation });
      setIsInviteOpen(true);
      toast.success(`Invitation sent to ${user.email}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleStatus = async (user: PortalUser, nextStatus: UserStatus) => {
    if (nextStatus === "suspended" && !window.confirm(`Suspend access for ${user.email}?`)) return;
    try {
      await updateMutation.mutateAsync({ id: user.id, data: { status: nextStatus } });
      invalidateUsers();
      toast.success(`${user.email} is now ${nextStatus}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleBulkStatus = async () => {
    try {
      await bulkMutation.mutateAsync({ ids: selectedIds, nextStatus: bulkStatus });
      setSelectedIds([]);
      setIsBulkOpen(false);
      invalidateUsers();
      toast.success(`${selectedIds.length} account${selectedIds.length === 1 ? "" : "s"} updated`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openGroups = (user: PortalUser) => {
    setActiveUser(user);
    setSelectedGroupIds((user.groups ?? []).map((group) => group.id));
    setIsGroupsOpen(true);
  };

  const handleGroups = async () => {
    if (!activeUser) return;
    try {
      await membershipMutation.mutateAsync({ user: activeUser, groupIds: selectedGroupIds });
      setIsGroupsOpen(false);
      invalidateUsers();
      invalidateGroups();
      toast.success("Group access updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleRep = async (user: PortalUser) => {
    try {
      await repMutation.mutateAsync({ id: user.id, rep: repId || null });
      invalidateUsers();
      setActiveUser(null);
      setRepId("");
      toast.success("Sales rep assignment updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };
  const handleRole = async () => {
    if (!roleUser) return;
    try {
      await updateMutation.mutateAsync({ id: roleUser.id, data: { role: selectedRole } });
      setRoleUser(null);
      invalidateUsers();
      toast.success("Staff role updated");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const copyInvite = async () => {
    if (!createdUser?.invitation?.url) return;
    await navigator.clipboard.writeText(createdUser.invitation.url);
    toast.success("Invitation link copied");
  };

  if (bootstrap.isLoading || usersQuery.isLoading || staffQuery.isLoading) {
    return <LoadingState />;
  }
  if (bootstrap.error || usersQuery.error || staffQuery.error || !bootstrap.data) {
    return <ErrorState message={getErrorMessage(bootstrap.error ?? usersQuery.error ?? staffQuery.error)} />;
  }
  if (!canRead) {
    return <RestrictedState role={role} message="Your role does not have access to dealer accounts." />;
  }

  return (
    <div className={`min-h-full ${ivory} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#121210]/15 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">People & access</p>
            <h1 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Accounts</h1>
            <p className="mt-2 max-w-2xl text-sm text-[#121210]/60">
              Provision dealer and staff access, review invitations, and keep account permissions current.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isSuperAdmin && (
              <Button
                variant="outline"
                className="rounded-none border-[#121210]/20 bg-transparent"
                onClick={() => {
                  resetCreate();
                  setNewRole("staff_admin");
                    setNewStatus("approved");
                  setIsCreateOpen(true);
                }}
              >
                <ShieldCheck className="mr-2 h-4 w-4" /> Add staff
              </Button>
            )}
            <Button
              className="rounded-none bg-[#121210] text-[#F3F0E8] hover:bg-[#121210]/85"
              onClick={() => {
                resetCreate();
                setNewRole("dealer");
                  setNewStatus("pending");
                setIsCreateOpen(true);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" /> Add dealer
            </Button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Showing" value={filteredUsers.length} detail={`of ${users.length} ${userType} accounts`} />
          <Metric label="Approved" value={users.filter((user) => user.status === "approved").length} detail="active access" />
          <Metric label="Selected" value={selectedIds.length} detail="ready for a bulk action" />
        </section>

        <section className={`${card} p-4`}>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/45" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search name, email, role, or status"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <div className="flex border border-[#121210]/15 bg-white/80 p-1">
                {(["dealer", ...(isSuperAdmin ? ["staff" as const] : [])] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setUserType(value);
                      setSelectedIds([]);
                    }}
                    className={`px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                      userType === value ? "bg-[#121210] text-[#F3F0E8]" : "text-[#121210]/55 hover:text-[#121210]"
                    }`}
                  >
                    {value}s
                  </button>
                ))}
              </div>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as UserStatus | "all");
                  setSelectedIds([]);
                }}
                className="h-10 border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none"
              >
                {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {selectedIds.length > 0 && (
              <Button
                variant="outline"
                className="rounded-none border-[#121210]/20 bg-transparent"
                onClick={() => setIsBulkOpen(true)}
              >
                <CheckSquare className="mr-2 h-4 w-4" /> Bulk status ({selectedIds.length})
              </Button>
            )}
          </div>
        </section>

        <section className={`${card} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="border-b border-[#121210]/10 bg-[#121210]/[0.035] text-[10px] uppercase tracking-[0.18em] text-[#121210]/55">
                <tr>
                  {canEdit && <th className="w-12 px-4 py-4">
                    <input
                      aria-label="Select all visible accounts"
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => setSelectedIds(allVisibleSelected ? [] : selectableUsers.map((user) => user.id))}
                      className="h-4 w-4 accent-[#B39862]"
                    />
                  </th>}
                  <th className="px-4 py-4 font-semibold">Account</th>
                  <th className="px-4 py-4 font-semibold">Role</th>
                  <th className="px-4 py-4 font-semibold">Status</th>
                  <th className="px-4 py-4 font-semibold">Groups</th>
                  <th className="px-4 py-4 font-semibold">Rep</th>
                  <th className="px-4 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#121210]/10">
                {filteredUsers.map((user) => {
                  const isSelected = selectedIds.includes(user.id);
                  const invitationStatus = user.invitation?.status;
                  return (
                    <tr key={user.id} className={`transition hover:bg-[#B39862]/[0.06] ${isSelected ? "bg-[#B39862]/[0.08]" : ""}`}>
                      <td className="px-4 py-4 align-top">
                          {canEdit && <input
                          aria-label={`Select ${user.email}`}
                          type="checkbox"
                          checked={isSelected}
                          disabled={user.id === bootstrap.data.account.id}
                          onChange={() => setSelectedIds((ids) => isSelected ? ids.filter((id) => id !== user.id) : [...ids, user.id])}
                          className="h-4 w-4 accent-[#B39862]"
                          />}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-medium">{user.displayName || "Name not set"}</div>
                        <div className="mt-0.5 text-xs text-[#121210]/55">{user.email}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.13em] text-[#121210]/45">
                          <span>{format(new Date(user.createdAt), "MMM d, yyyy")}</span>
                          {(invitationStatus || (user.status === "pending" ? "pending" : undefined)) && <span className="text-[#B39862]">Invite {invitationStatus || "pending"}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top capitalize text-[#121210]/70">{labelRole(user.role === "staff" ? user.portalRole || "staff" : user.role)}</td>
                      <td className="px-4 py-4 align-top">
                        <Badge variant="outline" className={`rounded-none text-[10px] capitalize ${statusTone(user.status)}`}>{user.status}</Badge>
                      </td>
                      <td className="max-w-[180px] px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-1">
                          {(user.groups ?? []).slice(0, 3).map((group) => (
                            <span key={group.id} className="border border-[#121210]/15 px-2 py-1 text-[10px] text-[#121210]/65">{group.name}</span>
                          ))}
                          {(user.groups ?? []).length > 3 && <span className="px-1 py-1 text-[10px] text-[#121210]/50">+{user.groups.length - 3}</span>}
                          {(user.groups ?? []).length === 0 && <span className="text-xs text-[#121210]/40">None</span>}
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top text-xs text-[#121210]/60">
                        {user.assignedRepId ? user.assignedRep?.email || salesReps.find((rep) => rep.id === user.assignedRepId)?.email || "Assigned" : "Unassigned"}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap justify-end gap-1">
                          {canEdit && user.invitationEligible && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-none px-2 text-xs hover:bg-[#B39862]/15"
                              disabled={invitationMutation.isPending}
                              onClick={() => void handleResendInvitation(user)}
                            >
                              Resend invite
                            </Button>
                          )}
                          {user.role === "dealer" && (
                            <>
                              {hasCapability(bootstrap.data.capabilities, "groups:write") && <Button variant="ghost" size="sm" className="h-8 rounded-none px-2 text-xs hover:bg-[#B39862]/15" onClick={() => openGroups(user)}>
                                Groups
                              </Button>}
                              {isSuperAdmin || role === "staff_admin" ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 rounded-none px-2 text-xs hover:bg-[#B39862]/15"
                                  onClick={() => {
                                    setActiveUser(user);
                                    setRepId(user.assignedRepId || "");
                                  }}
                                >
                                  Rep
                                </Button>
                              ) : null}
                            </>
                          )}
                           {isSuperAdmin && user.role === "staff" && user.id !== bootstrap.data.account.id && (
                             <Button variant="ghost" size="sm" className="h-8 rounded-none px-2 text-xs hover:bg-[#B39862]/15" onClick={() => { setRoleUser(user); setSelectedRole(user.portalRole || "staff_admin"); }}>
                               Role
                             </Button>
                           )}
                           {canEdit && user.id !== bootstrap.data.account.id && (user.status === "approved" ? (
                            <Button variant="ghost" size="sm" className="h-8 rounded-none px-2 text-xs text-[#8b382b] hover:bg-[#a64c3b]/10" onClick={() => handleStatus(user, "suspended")}>
                              Suspend
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-8 rounded-none px-2 text-xs text-[#3d5a35] hover:bg-[#55704b]/10" onClick={() => handleStatus(user, "approved")}>
                              Verify
                            </Button>
                           ))}
                          {isSuperAdmin && user.id !== bootstrap.data.account.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 rounded-none px-2 text-xs text-[#8b382b] hover:bg-[#a64c3b]/10"
                              onClick={async () => {
                                if (!window.confirm(`Remove access for ${user.email}? This safely suspends the account.`)) return;
                                try {
                                  await deleteMutation.mutateAsync(user.id);
                                  invalidateUsers();
                                  toast.success("Access removed");
                                } catch (error) {
                                  toast.error(getErrorMessage(error));
                                }
                              }}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={7} className="px-6 py-16 text-center text-sm text-[#121210]/50">No accounts match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-medium">Add {newRole === "dealer" ? "dealer" : "staff"} account</DialogTitle></DialogHeader>
          <div className="space-y-4 py-3">
            <p className="border-l-2 border-[#B39862] bg-[#B39862]/10 px-3 py-2 text-xs text-[#121210]/65">
              The client will receive an account setup link and choose their own password.
            </p>
            <Field label="Email address"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="name@dealer.com" /></Field>
            <Field label="Display name (optional)"><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={inputClass} placeholder="Jordan Lee" /></Field>
            {isSuperAdmin && (
              <Field label="Role">
                 <select value={newRole} onChange={(event) => { const nextRole = event.target.value as PortalRole; setNewRole(nextRole); setNewStatus("approved"); }} className="h-10 w-full border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none">
                  <option value="dealer">Dealer</option>
                  {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </Field>
            )}
            <Field label="Initial status">
              <select value={newStatus} onChange={(event) => setNewStatus(event.target.value as UserStatus)} className="h-10 w-full border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none">
                <option value="pending">Pending verification</option>
                <option value="approved">Approved</option>
              </select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={!email.includes("@") || createMutation.isPending} onClick={handleCreate}>
              {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Provision account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-medium">Preview access ready</DialogTitle></DialogHeader>
          {createdUser && (
            <div className="space-y-4 py-3">
              <div><p className="font-medium">{createdUser.displayName || createdUser.email}</p><p className="text-sm text-[#121210]/55">{createdUser.email}</p></div>
              <div className="border border-[#121210]/10 bg-white/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#B39862]"><MailPlus className="h-4 w-4" /> Invitation record</div>
                <p className="mt-2 text-sm text-[#121210]/65">
                  A setup email was sent. The client can set their own password there. Share this link for preview access.
                  {createdUser.status === "pending" && " This account is pending; use Verify in the user list before they can enter the portal."}
                </p>
                {createdUser.invitation?.url ? (
                  <div className="mt-3 flex gap-2">
                    <Input readOnly value={createdUser.invitation.url} className={`${inputClass} text-xs`} />
                    <Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={copyInvite}><Clipboard className="h-4 w-4" /></Button>
                  </div>
                ) : <p className="mt-3 text-xs text-[#121210]/50">The invitation email was sent. Ask the client to check their inbox.</p>}
              </div>
            </div>
          )}
          <DialogFooter><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" onClick={() => setIsInviteOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-2xl font-medium">Confirm bulk status</DialogTitle></DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-sm text-[#121210]/65">Update {selectedIds.length} selected account{selectedIds.length === 1 ? "" : "s"}. This action is recorded in the audit history.</p>
            <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as UserStatus)} className="h-10 w-full border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none">
              <option value="approved">Approved — restore access</option><option value="pending">Pending — require verification</option><option value="suspended">Suspended — block access</option>
            </select>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setIsBulkOpen(false)}>Cancel</Button><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={bulkMutation.isPending} onClick={handleBulkStatus}>{bulkMutation.isPending ? "Updating…" : "Confirm update"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGroupsOpen} onOpenChange={setIsGroupsOpen}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-lg">
          <DialogHeader><DialogTitle className="text-2xl font-medium">Assign groups</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-[#121210]/60">{activeUser?.email} can belong to multiple groups. Changes replace this account’s group memberships.</p>
            <div className="max-h-64 space-y-2 overflow-y-auto border border-[#121210]/10 bg-white/50 p-3">
              {groups.map((group) => (
                <label key={group.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-[#121210]/10 py-2 last:border-0">
                  <span><span className="block text-sm font-medium">{group.name}</span><span className="text-xs text-[#121210]/50">{group.memberCount} members</span></span>
                  <input type="checkbox" checked={selectedGroupIds.includes(group.id)} onChange={() => setSelectedGroupIds((ids) => ids.includes(group.id) ? ids.filter((id) => id !== group.id) : [...ids, group.id])} className="h-4 w-4 accent-[#B39862]" />
                </label>
              ))}
              {groups.length === 0 && <p className="py-6 text-center text-sm text-[#121210]/50">Create a group first.</p>}
            </div>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setIsGroupsOpen(false)}>Cancel</Button><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={membershipMutation.isPending} onClick={handleGroups}>{membershipMutation.isPending ? "Saving…" : "Save groups"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(activeUser) && !isGroupsOpen} onOpenChange={(open) => !open && setActiveUser(null)}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-2xl font-medium">Assign sales rep</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-[#121210]/60">{activeUser?.email}</p>
            <p className="border-l-2 border-[#B39862] bg-[#B39862]/10 px-3 py-2 text-xs text-[#121210]/60">Only an activated sales rep can receive assignments. The server verifies the rep has signed in with the provisioned email before saving.</p>
            {salesReps.length > 0 ? (
              <select value={repId} onChange={(event) => setRepId(event.target.value)} className="h-10 w-full border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none">
                <option value="">Unassigned</option>
                {salesReps.filter((user) => user.status === "approved").map((rep) => <option key={rep.id} value={rep.id}>{rep.displayName || rep.email}</option>)}
              </select>
            ) : (
              <Input value={repId} onChange={(event) => setRepId(event.target.value)} className={inputClass} placeholder="Sales rep account ID (UUID), or blank to unassign" />
            )}
          </div>
          <DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setActiveUser(null)}>Cancel</Button><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={repMutation.isPending || !activeUser} onClick={() => activeUser && handleRep(activeUser)}>Save assignment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(roleUser)} onOpenChange={(open) => !open && setRoleUser(null)}>
        <DialogContent className="rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-md">
          <DialogHeader><DialogTitle className="text-2xl font-medium">Change staff role</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-sm text-[#121210]/60">{roleUser?.email}</p>
            <Field label="Portal role">
              <select value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as Exclude<PortalRole, "dealer">)} className="h-10 w-full border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none">
                {roles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </Field>
            <p className="text-xs text-[#121210]/50">Activation still requires the provisioned staff member to sign in with the exact email.</p>
          </div>
          <DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setRoleUser(null)}>Cancel</Button><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={updateMutation.isPending || !roleUser} onClick={handleRole}>{updateMutation.isPending ? "Saving…" : "Save role"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <div className={`${card} p-4`}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#121210]/50">{label}</p><p className="mt-2 text-3xl font-medium">{value}</p><p className="mt-1 text-xs text-[#121210]/50">{detail}</p></div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#121210]/55">{label}</label>{children}</div>;
}

function LoadingState() {
  return <div className={`flex min-h-[60vh] items-center justify-center ${ivory}`}><Loader2 className="h-6 w-6 animate-spin text-[#B39862]" /></div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className={`min-h-[60vh] ${ivory} p-6 md:p-10`}><div className="mx-auto max-w-2xl border border-[#a64c3b]/30 bg-[#a64c3b]/10 p-5 text-[#8b382b]"><AlertTriangle className="mb-3 h-5 w-5" /><h2 className="font-medium">Accounts are unavailable</h2><p className="mt-1 text-sm opacity-80">{message}</p></div></div>;
}

function RestrictedState({ role, message }: { role?: PortalRole; message: string }) {
  return <div className={`min-h-[60vh] ${ivory} p-6 md:p-10`}><div className="mx-auto max-w-2xl border border-[#121210]/10 bg-white/60 p-6"><X className="mb-3 h-5 w-5 text-[#B39862]" /><h2 className="font-medium">View only</h2><p className="mt-1 text-sm text-[#121210]/60">{message}</p><p className="mt-4 text-xs uppercase tracking-[0.14em] text-[#121210]/40">Current role: {role ? labelRole(role) : "unknown"}</p></div></div>;
}