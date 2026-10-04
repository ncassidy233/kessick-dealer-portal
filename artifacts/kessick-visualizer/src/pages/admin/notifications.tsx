import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCircle2, Clock3, Edit3, Eye, ImagePlus, Link2, Loader2, Plus, Send, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  canManage,
  createPortalNotification,
  listPortalGroups,
  listPortalNotificationHistory,
  listPortalNotifications,
  listPortalUsers,
  portalQueryKeys,
  hasCapability,
  PortalNotification,
  PortalNotificationInput,
  PortalNotificationRecipient,
  PortalRole,
  sendPortalNotification,
  updatePortalNotification,
  usePortalBootstrap,
} from "@/lib/portal-admin-api";

type ComposerMode = "draft" | "scheduled" | "send";
type TargetMode = "everyone" | "groups" | "users";
const ivory = "bg-[#F3F0E8] text-[#121210]";
const card = "border border-[#121210]/10 bg-white/70";
const inputClass = "rounded-none border-[#121210]/15 bg-white/80 text-[#121210] placeholder:text-[#121210]/45";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}
function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
}
function priorityTone(priority: PortalNotification["priority"]) {
  if (priority === "high") return "border-[#a64c3b]/35 bg-[#a64c3b]/10 text-[#8b382b]";
  if (priority === "low") return "border-[#121210]/15 text-[#121210]/50";
  return "border-[#B39862]/40 bg-[#B39862]/10 text-[#725a2c]";
}

export default function AdminNotifications() {
  const queryClient = useQueryClient();
  const bootstrap = usePortalBootstrap();
  const role = bootstrap.data?.role;
  const canEdit = canManage(role, "notifications") && hasCapability(bootstrap.data?.capabilities, "notifications:write");
  const canReadTargets = hasCapability(bootstrap.data?.capabilities, "groups:read");
  const canViewHistory = hasCapability(bootstrap.data?.capabilities, "notifications:history");
  const notificationsQuery = useQuery({
    queryKey: portalQueryKeys.notifications(),
    queryFn: () => listPortalNotifications(),
    enabled: Boolean(bootstrap.data?.authorized),
    staleTime: 15_000,
  });
  const groupsQuery = useQuery({ queryKey: portalQueryKeys.groups, queryFn: listPortalGroups, enabled: Boolean(bootstrap.data?.authorized) && canReadTargets, staleTime: 20_000 });
  const usersQuery = useQuery({ queryKey: portalQueryKeys.users({ role: "dealer" }), queryFn: () => listPortalUsers({ role: "dealer" }), enabled: Boolean(bootstrap.data?.authorized) && canReadTargets, staleTime: 20_000 });
  const notifications = notificationsQuery.data?.notifications ?? [];
  const groups = groupsQuery.data?.groups ?? [];
  const users = usersQuery.data?.users ?? [];
  const [statusFilter, setStatusFilter] = useState<"all" | PortalNotification["status"]>("all");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [selected, setSelected] = useState<PortalNotification | null>(null);
  const [editingNotification, setEditingNotification] = useState<PortalNotification | null>(null);
  const [history, setHistory] = useState<PortalNotificationRecipient[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [priority, setPriority] = useState<PortalNotification["priority"]>("normal");
  const [composerMode, setComposerMode] = useState<ComposerMode>("send");
  const [targetMode, setTargetMode] = useState<TargetMode>("everyone");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [sendTime, setSendTime] = useState("");
  const [expiry, setExpiry] = useState("");
  const [acknowledgementRequired, setAcknowledgementRequired] = useState(false);

  const visibleNotifications = useMemo(() => statusFilter === "all" ? notifications : notifications.filter((notification) => notification.status === statusFilter), [notifications, statusFilter]);
  const createMutation = useMutation({ mutationFn: createPortalNotification });
  const updateMutation = useMutation({ mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updatePortalNotification>[1] }) => updatePortalNotification(id, data) });
  const sendMutation = useMutation({ mutationFn: sendPortalNotification });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal-v2", "admin", "notifications"] });

  const reset = () => {
    setEditingNotification(null);
    setTitle("");
    setBody("");
    setImageUrl("");
    setLinkUrl("");
    setPriority("normal");
    setComposerMode("send");
    setTargetMode("everyone");
    setGroupIds([]);
    setAccountIds([]);
    setSendTime("");
    setExpiry("");
    setAcknowledgementRequired(false);
  };
  const openEditor = (notification: PortalNotification) => {
    setEditingNotification(notification);
    setTitle(notification.title);
    setBody(notification.body);
    setImageUrl(notification.imageUrl || "");
    setLinkUrl(notification.linkUrl || "");
    setPriority(notification.priority);
    setComposerMode(notification.status === "scheduled" ? "scheduled" : "draft");
    setTargetMode(notification.targets.everyone ? "everyone" : notification.targets.groupIds.length ? "groups" : "users");
    setGroupIds(notification.targets.groupIds);
    setAccountIds(notification.targets.accountIds);
    setSendTime(notification.scheduledFor ? new Date(notification.scheduledFor).toISOString().slice(0, 16) : "");
    setExpiry(notification.expiresAt ? new Date(notification.expiresAt).toISOString().slice(0, 16) : "");
    setAcknowledgementRequired(notification.acknowledgementRequired);
    setIsComposerOpen(true);
  };
  const openHistory = async (notification: PortalNotification) => {
    setSelected(notification);
    setHistory([]);
    setHistoryLoading(true);
    try {
      const result = await queryClient.fetchQuery({ queryKey: portalQueryKeys.notificationHistory(notification.id), queryFn: () => listPortalNotificationHistory(notification.id) });
      setHistory(result.recipients);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  };
  const target = targetMode === "everyone" ? { everyone: true } : targetMode === "groups" ? { groupIds } : { accountIds };
  const save = async () => {
    if (!title.trim() || !body.trim()) return;
    if (targetMode === "groups" && groupIds.length === 0) {
      toast.error("Choose at least one group");
      return;
    }
    if (targetMode === "users" && accountIds.length === 0) {
      toast.error("Choose at least one dealer");
      return;
    }
    if (composerMode === "scheduled" && !sendTime) {
      toast.error("Choose a send time");
      return;
    }
    try {
      const bodyData: PortalNotificationInput = {
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
        linkUrl: linkUrl.trim() || undefined,
        priority,
        ...(composerMode === "send" ? {} : { status: composerMode === "scheduled" ? "scheduled" as const : "draft" as const }),
        ...(composerMode === "scheduled" ? { scheduledFor: new Date(sendTime).toISOString() } : {}),
        expiresAt: expiry ? new Date(expiry).toISOString() : undefined,
        acknowledgementRequired,
        target,
      };
      if (editingNotification) {
        await updateMutation.mutateAsync({ id: editingNotification.id, data: bodyData });
        if (composerMode === "send") await sendMutation.mutateAsync(editingNotification.id);
      } else {
        await createMutation.mutateAsync(bodyData);
      }
      setIsComposerOpen(false);
      reset();
      invalidate();
      toast.success(composerMode === "send" ? "Notification sent" : composerMode === "scheduled" ? "Notification scheduled" : "Draft saved");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const sendNow = async (notification: PortalNotification) => {
    if (!window.confirm(`Send "${notification.title}" to its saved audience now?`)) return;
    try {
      await sendMutation.mutateAsync(notification.id);
      invalidate();
      toast.success("Notification sent");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };
  const cancel = async (notification: PortalNotification) => {
    if (!window.confirm(`Cancel "${notification.title}"?`)) return;
    try {
      await updateMutation.mutateAsync({ id: notification.id, data: { status: "cancelled" } });
      invalidate();
      toast.success("Notification cancelled");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (bootstrap.isLoading || notificationsQuery.isLoading || groupsQuery.isLoading || usersQuery.isLoading) return <Loading />;
  if (bootstrap.error || notificationsQuery.error || !bootstrap.data) return <ErrorState message={errorMessage(bootstrap.error ?? notificationsQuery.error)} />;

  return (
    <div className={`min-h-full ${ivory} px-4 py-6 md:px-8 md:py-8`}>
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-[#121210]/15 pb-6 lg:flex-row lg:items-end lg:justify-between"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#B39862]">Dealer communications</p><h1 className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">Notifications</h1><p className="mt-2 text-sm text-[#121210]/60">Compose in-app alerts with an explicit audience, schedule, expiry, and acknowledgement policy.</p></div>{canEdit && <Button className="rounded-none bg-[#121210] text-[#F3F0E8]" onClick={() => { reset(); setIsComposerOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Compose notification</Button>}</header>
        <section className="grid gap-3 sm:grid-cols-4"><Stat label="Total" value={notifications.length} detail="notification records" /><Stat label="Drafts" value={notifications.filter((item) => item.status === "draft").length} detail="awaiting review" /><Stat label="Scheduled" value={notifications.filter((item) => item.status === "scheduled").length} detail="queued for later" /><Stat label="Ack required" value={notifications.filter((item) => item.acknowledgementRequired && item.status === "sent").length} detail="sent alerts with acknowledgement" /></section>
        <section className={`${card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}><p className="text-sm text-[#121210]/60">{visibleNotifications.length} notification{visibleNotifications.length === 1 ? "" : "s"} shown</p><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="h-10 border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none sm:w-48"><option value="all">All statuses</option><option value="draft">Drafts</option><option value="scheduled">Scheduled</option><option value="sent">Sent</option><option value="cancelled">Cancelled</option></select></section>
        {visibleNotifications.length === 0 ? <div className={`${card} px-6 py-16 text-center`}><Bell className="mx-auto h-8 w-8 text-[#B39862]" /><h2 className="mt-3 font-medium">No notifications in this view</h2><p className="mt-1 text-sm text-[#121210]/55">Draft or send an alert when there is something dealers need to know.</p></div> : <section className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b border-[#121210]/10 bg-[#121210]/[0.035] text-[10px] uppercase tracking-[0.18em] text-[#121210]/55"><tr><th className="px-4 py-4 font-semibold">Notification</th><th className="px-4 py-4 font-semibold">Audience</th><th className="px-4 py-4 font-semibold">Status</th><th className="px-4 py-4 font-semibold">Delivery</th><th className="px-4 py-4 font-semibold">Timing</th><th className="px-4 py-4 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-[#121210]/10">{visibleNotifications.map((notification) => <tr key={notification.id} className="transition hover:bg-[#B39862]/[0.06]"><td className="max-w-[270px] px-4 py-4"><div className="font-medium">{notification.title}</div><div className="mt-1 truncate text-xs text-[#121210]/50">{notification.body}</div><div className="mt-2 flex gap-2"><span className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${priorityTone(notification.priority)}`}>{notification.priority}</span>{notification.acknowledgementRequired && <span className="border border-[#121210]/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-[#121210]/55">Ack required</span>}</div></td><td className="px-4 py-4 text-xs text-[#121210]/60">{notification.targets.everyone ? "Everyone" : notification.targets.groupIds.length ? `${notification.targets.groupIds.length} group${notification.targets.groupIds.length === 1 ? "" : "s"}` : `${notification.targets.accountIds.length} dealer${notification.targets.accountIds.length === 1 ? "" : "s"}`}</td><td className="px-4 py-4"><span className={`border px-2 py-1 text-[10px] uppercase tracking-[0.14em] ${notification.status === "sent" ? "border-[#55704b]/35 bg-[#55704b]/10 text-[#3d5a35]" : notification.status === "cancelled" ? "border-[#a64c3b]/35 bg-[#a64c3b]/10 text-[#8b382b]" : "border-[#B39862]/40 bg-[#B39862]/10 text-[#725a2c]"}`}>{notification.status}</span></td><td className="px-4 py-4 text-xs text-[#121210]/55"><div>{notification.delivery.delivered}/{notification.delivery.recipients} in-app</div><div className="mt-1 text-[10px]">Push: {notification.delivery.pushSent} sent · {notification.delivery.pushSkipped} skipped</div></td><td className="px-4 py-4 text-xs text-[#121210]/55">{notification.status === "scheduled" ? formatDate(notification.scheduledFor) : notification.status === "sent" ? formatDate(notification.sentAt) : "Not sent"}{notification.expiresAt && <div className="mt-1 text-[10px]">Expires {formatDate(notification.expiresAt)}</div>}</td><td className="px-4 py-4"><div className="flex justify-end gap-1">{canEdit && (notification.status === "draft" || notification.status === "scheduled") && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-[#B39862]/15" title="Edit notification" onClick={() => openEditor(notification)}><Edit3 className="h-4 w-4" /></Button>}{canViewHistory && (notification.status === "sent" || notification.status === "scheduled") && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none hover:bg-[#B39862]/15" title="View recipient history" onClick={() => openHistory(notification)}><Eye className="h-4 w-4" /></Button>}{canEdit && (notification.status === "draft" || notification.status === "scheduled") && <Button variant="ghost" size="sm" className="h-8 rounded-none px-2 text-xs hover:bg-[#B39862]/15" onClick={() => sendNow(notification)}><Send className="mr-1 h-3.5 w-3.5" /> Send</Button>}{canEdit && (notification.status === "draft" || notification.status === "scheduled") && <Button variant="ghost" size="sm" className="h-8 rounded-none px-2 text-xs text-[#8b382b] hover:bg-[#a64c3b]/10" onClick={() => cancel(notification)}>Cancel</Button>}</div></td></tr>)}</tbody></table></div></section>}
      </div>

      <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}><DialogContent className="max-h-[92vh] overflow-y-auto rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-2xl"><DialogHeader><DialogTitle className="text-2xl font-medium">Compose notification</DialogTitle></DialogHeader><div className="space-y-5 py-3"><div className="grid gap-4 sm:grid-cols-2"><Field label="Title"><Input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} placeholder="Important portal update" /></Field><Field label="Priority"><select value={priority} onChange={(event) => setPriority(event.target.value as PortalNotification["priority"])} className="h-10 w-full border border-[#121210]/15 bg-white/80 px-3 text-sm outline-none"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></Field></div><Field label="Message body"><Textarea value={body} onChange={(event) => setBody(event.target.value)} className={`${inputClass} resize-none`} rows={5} placeholder="Write the in-app message…" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Image URL (optional)"><div className="relative"><ImagePlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/40" /><Input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className={`${inputClass} pl-9`} placeholder="https://…" /></div></Field><Field label="Link URL (optional)"><div className="relative"><Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#121210]/40" /><Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} className={`${inputClass} pl-9`} placeholder="https://…" /></div></Field></div><div className="space-y-3 border border-[#121210]/10 bg-white/45 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B39862]">Audience</p><div className="grid gap-2 sm:grid-cols-3">{(["everyone", "groups", "users"] as const).map((value) => <button key={value} type="button" onClick={() => setTargetMode(value)} className={`border px-3 py-3 text-left text-xs font-semibold capitalize ${targetMode === value ? "border-[#121210] bg-[#121210] text-[#F3F0E8]" : "border-[#121210]/15 bg-white/50 text-[#121210]/60"}`}>{value === "users" ? "Selected dealers" : value}</button>)}</div>{targetMode === "groups" && (canReadTargets ? <MultiSelect items={groups.map((group) => ({ id: group.id, label: group.name, detail: `${group.memberCount} members` }))} selected={groupIds} onChange={setGroupIds} empty="No groups available." /> : <TargetUnavailable />)}{targetMode === "users" && (canReadTargets ? <MultiSelect items={users.map((user) => ({ id: user.id, label: user.displayName || user.email, detail: user.email }))} selected={accountIds} onChange={setAccountIds} empty="No dealer accounts available." /> : <TargetUnavailable />)}</div><div className="space-y-3 border border-[#121210]/10 bg-white/45 p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#B39862]">Delivery</p><div className="grid gap-2 sm:grid-cols-3">{([{ value: "draft", label: "Save draft" }, { value: "scheduled", label: "Schedule" }, { value: "send", label: "Send now" }] as const).map((item) => <button key={item.value} type="button" onClick={() => setComposerMode(item.value)} className={`flex items-center gap-2 border px-3 py-3 text-left text-xs font-semibold ${composerMode === item.value ? "border-[#121210] bg-[#121210] text-[#F3F0E8]" : "border-[#121210]/15 bg-white/50 text-[#121210]/60"}`}>{item.value === "draft" ? <FileIcon /> : item.value === "scheduled" ? <Clock3 className="h-4 w-4" /> : <Send className="h-4 w-4" />}{item.label}</button>)}</div>{composerMode === "scheduled" && <Field label="Send time"><Input type="datetime-local" value={sendTime} onChange={(event) => setSendTime(event.target.value)} className={inputClass} /></Field>}{composerMode === "draft" && <p className="text-xs text-[#121210]/55">Drafts are created server-side and are not sent to any recipient until you choose Send.</p>}<Field label="Expiry (optional)"><Input type="datetime-local" value={expiry} onChange={(event) => setExpiry(event.target.value)} className={inputClass} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={acknowledgementRequired} onChange={(event) => setAcknowledgementRequired(event.target.checked)} className="h-4 w-4 accent-[#B39862]" /> Require acknowledgement</label></div><p className="border-l-2 border-[#B39862] bg-[#B39862]/10 px-3 py-2 text-xs text-[#121210]/65">Delivery is reported from actual in-app recipient and push attempt records. Push delivery is never assumed when it is skipped or unavailable.</p></div><DialogFooter><Button variant="outline" className="rounded-none border-[#121210]/20 bg-transparent" onClick={() => setIsComposerOpen(false)}>Cancel</Button><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" disabled={!title.trim() || !body.trim() || createMutation.isPending || updateMutation.isPending} onClick={save}>{createMutation.isPending || updateMutation.isPending ? "Saving…" : composerMode === "send" ? "Send notification" : composerMode === "scheduled" ? "Schedule notification" : "Save draft"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="max-h-[85vh] overflow-y-auto rounded-none border-[#121210]/15 bg-[#F3F0E8] text-[#121210] sm:max-w-2xl"><DialogHeader><DialogTitle className="text-2xl font-medium">Recipient history</DialogTitle></DialogHeader><div className="py-3">{selected && <><div className="mb-4 border-b border-[#121210]/10 pb-4"><p className="font-medium">{selected.title}</p><p className="mt-1 text-sm text-[#121210]/55">{selected.delivery.recipients} recipients · {selected.delivery.delivered} in-app records · {selected.delivery.pushSent} push sent · {selected.delivery.pushSkipped} push skipped</p></div>{historyLoading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-[#B39862]" /></div> : history.length === 0 ? <p className="py-10 text-center text-sm text-[#121210]/50">No recipient history returned.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-[#121210]/10 text-[10px] uppercase tracking-[0.16em] text-[#121210]/50"><tr><th className="px-2 py-3">Account</th><th className="px-2 py-3">Read</th><th className="px-2 py-3">Acknowledged</th><th className="px-2 py-3">Push</th></tr></thead><tbody className="divide-y divide-[#121210]/10">{history.map((recipient) => <tr key={recipient.id}><td className="px-2 py-3 font-mono text-xs">{recipient.accountId}</td><td className="px-2 py-3 text-xs">{recipient.readAt ? formatDate(recipient.readAt) : "Unread"}</td><td className="px-2 py-3 text-xs">{recipient.acknowledgedAt ? formatDate(recipient.acknowledgedAt) : "—"}</td><td className="px-2 py-3 text-xs capitalize">{recipient.pushStatus || "not attempted"}</td></tr>)}</tbody></table></div>}</>}</div><DialogFooter><Button className="rounded-none bg-[#121210] text-[#F3F0E8]" onClick={() => setSelected(null)}>Done</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}

function MultiSelect({ items, selected, onChange, empty }: { items: Array<{ id: string; label: string; detail: string }>; selected: string[]; onChange: (ids: string[]) => void; empty: string }) {
  return <div className="max-h-44 space-y-1 overflow-y-auto border border-[#121210]/10 bg-white/60 p-3">{items.map((item) => <label key={item.id} className="flex cursor-pointer items-center justify-between gap-3 border-b border-[#121210]/10 py-2 last:border-0"><span><span className="block text-sm">{item.label}</span><span className="text-xs text-[#121210]/45">{item.detail}</span></span><input type="checkbox" checked={selected.includes(item.id)} onChange={() => onChange(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} className="h-4 w-4 accent-[#B39862]" /></label>)}{items.length === 0 && <p className="py-5 text-center text-xs text-[#121210]/50">{empty}</p>}</div>;
}
function FileIcon() { return <span className="flex h-4 w-4 items-center justify-center border border-current text-[9px]">D</span>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="space-y-1.5"><label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#121210]/55">{label}</label>{children}</div>; }
function TargetUnavailable() { return <p className="border border-[#B39862]/30 bg-[#B39862]/10 p-3 text-xs text-[#121210]/60">Your role can compose notifications, but cannot enumerate dealer audiences. Choose Everyone or ask a staff admin for targeting.</p>; }
function Stat({ label, value, detail }: { label: string; value: number; detail: string }) { return <div className={`${card} p-4`}><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#121210]/50">{label}</p><p className="mt-2 text-3xl font-medium">{value}</p><p className="mt-1 text-xs text-[#121210]/50">{detail}</p></div>; }
function Loading() { return <div className={`flex min-h-[60vh] items-center justify-center ${ivory}`}><Loader2 className="h-6 w-6 animate-spin text-[#B39862]" /></div>; }
function ErrorState({ message }: { message: string }) { return <div className={`min-h-[60vh] ${ivory} p-6 md:p-10`}><div className="mx-auto max-w-2xl border border-[#a64c3b]/30 bg-[#a64c3b]/10 p-5 text-[#8b382b]"><AlertTriangle className="mb-3 h-5 w-5" /><h2 className="font-medium">Notifications are unavailable</h2><p className="mt-1 text-sm opacity-80">{message}</p></div></div>; }