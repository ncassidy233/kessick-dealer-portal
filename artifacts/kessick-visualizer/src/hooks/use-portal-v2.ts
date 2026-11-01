import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { usePortalSession } from "@/lib/portal-session";
import { dealerAccessState } from "@/lib/dealer-access";
import { useStaffDealerView } from "@/lib/staff-dealer-view-context";
import { assertDealerWritable, dealerQueryKey, dealerReadUrl } from "@/lib/staff-dealer-view";

export interface PortalContent {
  id: string;
  kind: string;
  title: string;
  description?: string | null;
  payload?: {
    externalForm?: boolean;
    promotion?: unknown;
    legacyId?: string | null;
    contentType?: string | null;
    imageUrl?: string | null;
    url?: string | null;
    category?: string | null;
    status?: string | null;
    clientName?: string | null;
    color?: string | null;
    featuredOnDashboard?: boolean;
    comingSoon?: boolean;
  } | null;
  published: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export function usePortalContent(kind?: string) {
  const view = useStaffDealerView();
  const sessionQuery = usePortalSession();
  return useQuery({
    queryKey: dealerQueryKey(["portal-v2-content", kind], view),
    queryFn: ({ signal }) => customFetch<{ content: PortalContent[] }>(dealerReadUrl(`/api/portal-v2/content${kind ? `?kind=${encodeURIComponent(kind)}` : ""}`, view), { responseType: "json", signal }),
    refetchInterval: kind === "announcement" ? 30_000 : false,
    enabled: dealerAccessState(sessionQuery) === "allowed"
  });
}

export function usePortalProjects() {
  const view = useStaffDealerView();
  const sessionQuery = usePortalSession();
  return useQuery({
    queryKey: dealerQueryKey(["portal-v2-projects"], view),
    queryFn: ({ signal }) => customFetch<{ content: PortalContent[] }>(dealerReadUrl("/api/portal-v2/projects", view), { responseType: "json", signal }),
    enabled: dealerAccessState(sessionQuery) === "allowed"
  });
}

export interface PortalNotification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
  priority: "low"|"normal"|"high";
  status: "draft"|"scheduled"|"sent"|"cancelled";
  sentAt?: string | null;
  expiresAt?: string | null;
  acknowledgementRequired: boolean;
}

export interface NotificationRecipient {
  id: string;
  notificationId: string;
  accountId?: string;
  readAt?: string | null;
  acknowledgedAt?: string | null;
  notification: PortalNotification;
}

export function usePortalNotifications() {
  const view = useStaffDealerView();
  const sessionQuery = usePortalSession();
  return useQuery({
    queryKey: dealerQueryKey(["portal-v2-notifications"], view),
    queryFn: async ({ signal }) => {
      const data = await customFetch<{ notifications: { notification: PortalNotification; recipient: Omit<NotificationRecipient, "notification"> }[] }>(dealerReadUrl("/api/portal-v2/notifications", view), { responseType: "json", signal });
      return { notifications: data.notifications.map(({ notification, recipient }) => ({ ...recipient, notification })) };
    },
    refetchInterval: 30_000,
    enabled: dealerAccessState(sessionQuery) === "allowed"
  });
}

export function useMarkNotificationRead() {
  const view = useStaffDealerView();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => { assertDealerWritable(view); return customFetch(`/api/portal-v2/notifications/${notificationId}/read`, { method: "POST", responseType: "json" }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-v2-notifications"] }),
  });
}

export function useAcknowledgeNotification() {
  const view = useStaffDealerView();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => { assertDealerWritable(view); return customFetch(`/api/portal-v2/notifications/${notificationId}/acknowledge`, { method: "POST", responseType: "json" }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-v2-notifications"] }),
  });
}

export function useNotificationPreferences() {
  const view = useStaffDealerView();
  const sessionQuery = usePortalSession();
  return useQuery({
    queryKey: dealerQueryKey(["portal-v2-notification-preferences"], view),
    queryFn: ({ signal }) => customFetch<{ preferences: any }>(dealerReadUrl("/api/portal-v2/notification-preferences", view), { responseType: "json", signal }),
    enabled: dealerAccessState(sessionQuery) === "allowed"
  });
}

export function useUpdateNotificationPreferences() {
  const view = useStaffDealerView();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { inAppEnabled?: boolean; pushEnabled?: boolean; priorityThreshold?: "low"|"normal"|"high" }) => {
      assertDealerWritable(view);
      return customFetch("/api/portal-v2/notification-preferences", { method: "PUT", body: JSON.stringify(data), responseType: "json" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-v2-notification-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["portal-v2-notifications"] });
    },
  });
}
