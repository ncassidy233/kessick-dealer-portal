export type NotificationState = "draft" | "scheduled" | "sent" | "cancelled";

export function isNotificationDue(
  status: NotificationState,
  scheduledFor: Date | null,
  now: Date,
): boolean {
  return status === "scheduled" && scheduledFor !== null && scheduledFor <= now;
}

export function notificationCanBeEdited(status: NotificationState): boolean {
  return status === "draft" || status === "scheduled";
}

export function isDealerNotificationVisible(
  status: NotificationState,
  expiresAt: Date | null,
  now: Date,
): boolean {
  return status === "sent" && (expiresAt === null || expiresAt > now);
}

export function shouldListDealerNotification(
  visible: boolean,
  inAppEnabled: boolean,
  acknowledgementRequired: boolean,
): boolean {
  return visible && (inAppEnabled || acknowledgementRequired);
}

export function canClaimPush(
  status: string,
  claimedAt: Date | null,
  nextAttemptAt: Date | null,
  attemptCount: number,
  now: Date,
): boolean {
  if (attemptCount >= 5) return false;
  return ["pending", "not_attempted"].includes(status) ||
    (status === "failed" && (nextAttemptAt === null || nextAttemptAt <= now)) ||
    (status === "sending" && claimedAt !== null && claimedAt <= new Date(now.getTime() - 5 * 60_000));
}