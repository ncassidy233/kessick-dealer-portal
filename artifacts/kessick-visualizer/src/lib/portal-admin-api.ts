import { customFetch } from "@workspace/api-client-react";
import { useMutation, useQuery } from "@tanstack/react-query";

export type PortalRole =
  | "super_admin"
  | "staff_admin"
  | "sales_rep"
  | "content_manager"
  | "dealer"
  | "customer";
export type UserStatus = "pending" | "approved" | "suspended";
export type ContentKind =
  | "project"
  | "price_book"
  | "resource_category"
  | "product_series"
  | "finish"
  | "training"
  | "launch_kit"
  | "resource"
  | "form"
  | "announcement"
export type Visibility = "everyone" | "groups" | "individuals";
export type NotificationPriority = "low" | "normal" | "high";
export type NotificationStatus = "draft" | "scheduled" | "sent" | "cancelled";

export interface PortalGroup {
  id: string;
  name: string;
  description?: string | null;
  createdAt: string;
  updatedAt?: string;
  memberCount: number;
}

export interface PortalUser {
  id: string;
  email: string;
  displayName?: string | null;
  role: "staff" | "dealer" | "customer";
  portalRole: Exclude<PortalRole, "dealer" | "customer"> | null;
  status: UserStatus;
  createdAt: string;
  invitationEligible?: boolean;
  groups: PortalGroup[];
  assignedRepId?: string | null;
  assignedRep?: { id: string; email: string; displayName?: string | null } | null;
  organizationId?: string | null;
  invitation?: {
    status?: "pending" | "accepted" | "expired" | "revoked";
    token?: string;
    url?: string;
    createdAt?: string;
    expiresAt?: string;
  } | null;
}

export interface PortalBootstrap {
  account: PortalUser;
  role: PortalRole;
  authorized: boolean;
  organization?: { id: string; name: string; status?: string } | null;
  groups: PortalGroup[];
  capabilities: string[];
}

export interface PortalOverview {
  counts: {
    dealers: number;
    approvedDealers: number;
    staff: number;
    groups: number;
    content: number;
    notifications: number;
    unreadAcknowledgements: number;
  };
  recentAudit: PortalAuditEvent[];
}

export interface PortalContent {
  id: string;
  kind: ContentKind;
  title: string;
  description?: string | null;
  payload: Record<string, unknown>;
  visibility: Visibility;
  published: boolean;
  createdByAccountId: string;
  createdAt: string;
  updatedAt: string;
  targets: { groupIds: string[]; accountIds: string[] };
}

export interface PortalNotification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  priority: NotificationPriority;
  status: NotificationStatus;
  scheduledFor?: string | null;
  sentAt?: string | null;
  expiresAt?: string | null;
  acknowledgementRequired: boolean;
  targets: { everyone: boolean; groupIds: string[]; accountIds: string[] };
  delivery: {
    recipients: number;
    delivered: number;
    pushSent: number;
    pushFailed: number;
    pushSkipped: number;
  };
  createdByAccountId: string;
}

export interface PortalNotificationRecipient {
  id: string;
  accountId: string;
  readAt?: string | null;
  acknowledgedAt?: string | null;
  pushStatus?: string | null;
  pushAttemptedAt?: string | null;
}

export interface PortalAuditEvent {
  id: string;
  action: string;
  actorAccountId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

type RequestOptions = Parameters<typeof customFetch>[1];

function request<T>(path: string, options: RequestOptions = {}) {
  return customFetch<T>(`/api/portal-v2${path}`, options);
}

function jsonRequest<T>(path: string, method: "POST" | "PATCH" | "PUT", body: unknown) {
  return request<T>(path, {
    method,
    responseType: "json",
    body: JSON.stringify(body),
  });
}

export const portalQueryKeys = {
  bootstrap: ["portal-v2", "bootstrap"] as const,
  overview: ["portal-v2", "admin", "overview"] as const,
  users: (params?: { role?: string; status?: string }) =>
    ["portal-v2", "admin", "users", params ?? {}] as const,
  groups: ["portal-v2", "admin", "groups"] as const,
  content: (params?: { kind?: string; published?: string }) =>
    ["portal-v2", "admin", "content", params ?? {}] as const,
  notifications: (status?: string) =>
    ["portal-v2", "admin", "notifications", status ?? "all"] as const,
  notificationHistory: (id: string) =>
    ["portal-v2", "admin", "notifications", id, "history"] as const,
  audit: ["portal-v2", "admin", "audit"] as const,
};

export function getPortalBootstrap() {
  return request<PortalBootstrap>("/bootstrap", { responseType: "json" });
}

export function usePortalBootstrap() {
  return useQuery({
    queryKey: portalQueryKeys.bootstrap,
    queryFn: getPortalBootstrap,
    staleTime: 60_000,
    retry: false,
  });
}

export function canManage(role: PortalRole | undefined, area: "users" | "groups" | "content" | "notifications" | "audit") {
  if (!role) return false;
  if (area === "users" || area === "groups") return role === "super_admin" || role === "staff_admin";
  if (area === "audit") return role === "super_admin" || role === "staff_admin";
  if (area === "content" || area === "notifications") {
    return role === "super_admin" || role === "staff_admin" || role === "content_manager";
  }
  return role === "super_admin" || role === "staff_admin" || role === "content_manager";
}

export function hasCapability(capabilities: string[] | undefined, capability: string) {
  return Boolean(capabilities?.includes(capability));
}

export function listPortalOverview() {
  return request<PortalOverview>("/admin/overview", { responseType: "json" });
}

export function listPortalUsers(params: { role?: "dealer" | "staff"; status?: UserStatus } = {}) {
  const query = new URLSearchParams();
  if (params.role) query.set("role", params.role);
  if (params.status) query.set("status", params.status);
  return request<{ users: PortalUser[] }>(`/admin/users${query.size ? `?${query}` : ""}`, { responseType: "json" });
}

export function createPortalUser(body: {
  email: string;
  displayName?: string;
  role: Exclude<PortalRole, "dealer"> | "dealer";
  status?: UserStatus;
  organizationId?: string;
}) {
  return jsonRequest<{ user: PortalUser }>("/admin/users", "POST", body);
}

export function resendPortalUserInvitation(accountId: string) {
  return jsonRequest<{
    invitation: { status: "pending"; url?: string };
  }>(`/admin/users/${accountId}/invitation`, "POST", {});
}

export function updatePortalUser(accountId: string, body: Partial<{ displayName: string | null; status: UserStatus; role: Exclude<PortalRole, "dealer"> }>) {
  return jsonRequest<{ user: PortalUser }>(`/admin/users/${accountId}`, "PATCH", body);
}

export function deletePortalUser(accountId: string) {
  return request<void>(`/admin/users/${accountId}`, { method: "DELETE" });
}

export function assignPortalRep(accountId: string, salesRepAccountId: string | null) {
  return jsonRequest<{ accountId: string; salesRepAccountId: string | null }>(
    `/admin/users/${accountId}/rep`,
    "PUT",
    { salesRepAccountId },
  );
}

export function listPortalGroups() {
  return request<{ groups: PortalGroup[] }>("/admin/groups", { responseType: "json" });
}

export function createPortalGroup(body: { name: string; description?: string }) {
  return jsonRequest<{ group: PortalGroup }>("/admin/groups", "POST", body);
}

export function updatePortalGroup(groupId: string, body: { name?: string; description?: string }) {
  return jsonRequest<{ group: PortalGroup }>(`/admin/groups/${groupId}`, "PATCH", body);
}

export function deletePortalGroup(groupId: string, reassignToGroupId?: string) {
  const query = reassignToGroupId ? `?reassignToGroupId=${encodeURIComponent(reassignToGroupId)}` : "";
  return request<void>(`/admin/groups/${groupId}${query}`, { method: "DELETE" });
}

export function replacePortalGroupMembers(groupId: string, accountIds: string[]) {
  return jsonRequest<{ group: PortalGroup; members: PortalUser[] }>(
    `/admin/groups/${groupId}/members`,
    "PUT",
    { accountIds },
  );
}

export function addPortalGroupMember(groupId: string, accountId: string) {
  return jsonRequest<{ membership: unknown }>(`/admin/groups/${groupId}/members`, "POST", { accountId });
}

export function removePortalGroupMember(groupId: string, accountId: string) {
  return request<void>(`/admin/groups/${groupId}/members/${accountId}`, { method: "DELETE" });
}

export function listPortalContent(params: { kind?: string; published?: string } = {}) {
  const query = new URLSearchParams();
  if (params.kind) query.set("kind", params.kind);
  if (params.published) query.set("published", params.published);
  return request<{ content: PortalContent[] }>(`/admin/content${query.size ? `?${query}` : ""}`, { responseType: "json" });
}

export type PortalContentInput = {
  kind: ContentKind;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  visibility: Visibility;
  groupIds?: string[];
  accountIds?: string[];
  published?: boolean;
};

export function createPortalContent(body: PortalContentInput) {
  return jsonRequest<{ content: PortalContent }>("/admin/content", "POST", body);
}

export function updatePortalContent(contentId: string, body: Partial<PortalContentInput>) {
  return jsonRequest<{ content: PortalContent }>(`/admin/content/${contentId}`, "PATCH", body);
}

export function deletePortalContent(contentId: string) {
  return request<void>(`/admin/content/${contentId}`, { method: "DELETE" });
}

export function listPortalNotifications(status?: NotificationStatus) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return request<{ notifications: PortalNotification[] }>(`/admin/notifications${query}`, { responseType: "json" });
}

export type PortalNotificationInput = {
  title: string;
  body: string;
  imageUrl?: string;
  linkUrl?: string;
  priority?: NotificationPriority;
  status?: "draft" | "scheduled";
  scheduledFor?: string;
  expiresAt?: string;
  acknowledgementRequired?: boolean;
  target: { everyone?: boolean; groupIds?: string[]; accountIds?: string[] };
};
export type PortalNotificationPatch = Partial<Omit<PortalNotificationInput, "status">> & {
  status?: NotificationStatus;
};

export function createPortalNotification(body: PortalNotificationInput) {
  return jsonRequest<{ notification: PortalNotification }>("/admin/notifications", "POST", body);
}

export function updatePortalNotification(notificationId: string, body: PortalNotificationPatch) {
  return jsonRequest<{ notification: PortalNotification }>(`/admin/notifications/${notificationId}`, "PATCH", body);
}

export function sendPortalNotification(notificationId: string) {
  return jsonRequest<{ notification: PortalNotification }>(`/admin/notifications/${notificationId}/send`, "POST", {});
}

export function listPortalNotificationHistory(notificationId: string) {
  return request<{ recipients: PortalNotificationRecipient[] }>(
    `/admin/notifications/${notificationId}/history`,
    { responseType: "json" },
  );
}

// Audit remains a read-only compatibility route until the v2 contract publishes
// a dedicated path. It still exposes the same audit records produced by v2 actions.
export function listPortalAudit() {
  return customFetch<PortalAuditEvent[]>("/api/staff/portal/audit", { responseType: "json" });
}

export function usePortalMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  return useMutation({ mutationFn });
}