import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { usePortalSession } from "@/lib/portal-session";

export interface PortalContent {
  id: string;
  kind: string;
  title: string;
  description?: string;
  payload?: any;
  visibility: string;
  published: boolean;
  createdByAccountId: string;
  createdAt: string;
  updatedAt: string;
  targets: { groupIds: string[]; accountIds: string[] };
}

export function usePortalContent(kind?: string) {
  const { data: session } = usePortalSession();
  return useQuery({
    queryKey: ["portal-v2-content", kind],
    queryFn: () => customFetch<{ content: PortalContent[] }>(`/api/portal-v2/content${kind ? `?kind=${kind}` : ""}`, { responseType: "json" }),
    enabled: session?.role === 'dealer'
  });
}

export function usePortalProjects() {
  const { data: session } = usePortalSession();
  return useQuery({
    queryKey: ["portal-v2-projects"],
    queryFn: () => customFetch<{ content: PortalContent[] }>(`/api/portal-v2/projects`, { responseType: "json" }),
    enabled: session?.role === 'dealer'
  });
}

export interface PortalNotification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  linkUrl?: string;
  priority: "low"|"normal"|"high";
  status: "draft"|"scheduled"|"sent"|"cancelled";
  scheduledFor?: string;
  sentAt?: string;
  expiresAt?: string;
  acknowledgementRequired: boolean;
  targets: { everyone: boolean; groupIds: string[]; accountIds: string[] };
  delivery: { recipients: number; delivered: number; pushSent: number; pushFailed: number; pushSkipped: number };
  createdByAccountId: string;
}

export interface NotificationRecipient {
  id: string;
  notificationId: string;
  accountId: string;
  readAt?: string;
  acknowledgedAt?: string;
  notification: PortalNotification;
}

export function usePortalNotifications() {
  const { data: session } = usePortalSession();
  return useQuery({
    queryKey: ["portal-v2-notifications"],
    queryFn: async () => {
      const data = await customFetch<{ notifications: { notification: PortalNotification; recipient: Omit<NotificationRecipient, "notification"> }[] }>("/api/portal-v2/notifications", { responseType: "json" });
      return { notifications: data.notifications.map(({ notification, recipient }) => ({ ...recipient, notification })) };
    },
    refetchInterval: 30_000,
    enabled: session?.role === 'dealer'
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => customFetch(`/api/portal-v2/notifications/${notificationId}/read`, { method: "POST", responseType: "json" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-v2-notifications"] }),
  });
}

export function useAcknowledgeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => customFetch(`/api/portal-v2/notifications/${notificationId}/acknowledge`, { method: "POST", responseType: "json" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-v2-notifications"] }),
  });
}

export function useNotificationPreferences() {
  const { data: session } = usePortalSession();
  return useQuery({
    queryKey: ["portal-v2-notification-preferences"],
    queryFn: () => customFetch<{ preferences: any }>("/api/portal-v2/notification-preferences", { responseType: "json" }),
    enabled: session?.role === 'dealer'
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { inAppEnabled?: boolean; pushEnabled?: boolean; priorityThreshold?: "low"|"normal"|"high" }) => 
      customFetch("/api/portal-v2/notification-preferences", { method: "PUT", body: JSON.stringify(data), responseType: "json" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portal-v2-notification-preferences"] });
      queryClient.invalidateQueries({ queryKey: ["portal-v2-notifications"] });
    },
  });
}
