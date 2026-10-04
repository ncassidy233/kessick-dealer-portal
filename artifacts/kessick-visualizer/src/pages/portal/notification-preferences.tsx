import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useNotificationPreferences, useUpdateNotificationPreferences } from "@/hooks/use-portal-v2";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function NotificationPreferences() {
  const preferences = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const [busy, setBusy] = useState(false);
  const config = useQuery({
    queryKey: ["portal-push-config"],
    queryFn: () => customFetch<{ configured: boolean; publicKey: string | null }>("/api/dealer-portal/push-config"),
    retry: false,
  });
  const canPush = typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
  const save = (data: Parameters<typeof update.mutate>[0]) => update.mutate(data, {
    onSuccess: () => toast.success("Notification preferences saved"),
    onError: () => toast.error("Could not save preferences. Please retry."),
  });

  const registerPush = async () => {
    if (!config.data?.publicKey || !canPush) return;
    setBusy(true);
    try {
      if (await Notification.requestPermission() !== "granted") throw new Error("Allow notifications in your browser settings to enable device alerts.");
      const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
      await navigator.serviceWorker.ready;
      const key = config.data.publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(atob(key.padEnd(Math.ceil(key.length / 4) * 4, "=")), c => c.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      await customFetch("/api/dealer-portal/push-subscriptions", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
      await update.mutateAsync({ pushEnabled: true });
      toast.success("This device is registered for push alerts");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not register this device");
    } finally {
      setBusy(false);
    }
  };

  if (preferences.isError) return <p role="alert" className="text-sm text-red-700">Notification preferences could not be loaded. <button className="underline" onClick={() => preferences.refetch()}>Retry</button></p>;
  if (!preferences.data) return null;
  const values = preferences.data.preferences;
  return <details className="border border-black/10 bg-white p-5">
    <summary className="cursor-pointer font-medium">Notification preferences</summary>
    <div className="mt-5 grid gap-4 sm:grid-cols-2 text-sm">
      <label className="flex items-center gap-3"><input type="checkbox" checked={values.inAppEnabled} disabled={update.isPending} onChange={e => save({ inAppEnabled: e.target.checked })} />Show in-app announcements</label>
      <label className="flex items-center gap-3"><input type="checkbox" checked={values.pushEnabled} disabled={update.isPending} onChange={e => save({ pushEnabled: e.target.checked })} />Receive push alerts on registered devices</label>
      <label className="flex items-center gap-3">Push priority<select aria-label="Minimum push priority" className="border border-black/20 bg-white p-2" value={values.priorityThreshold} disabled={update.isPending} onChange={e => save({ priorityThreshold: e.target.value as "low" | "normal" | "high" })}><option value="low">All priorities</option><option value="normal">Normal and high</option><option value="high">High only</option></select></label>
      <Button className="rounded-none" disabled={busy || !config.data?.configured || !canPush} onClick={registerPush}>{busy ? "Registering device…" : "Enable push on this device"}</Button>
    </div>
    <p className="mt-4 text-xs text-black/60">Required acknowledgements remain visible even if in-app announcements are disabled.</p>
    {!canPush ? <p className="mt-2 text-xs text-black/60">This browser does not support Web Push. In-app notices remain available.</p> : config.isError ? <p className="mt-2 text-xs text-red-700">Push configuration could not be checked.</p> : config.data && !config.data.configured ? <p className="mt-2 text-xs text-black/60">Device push is not configured yet. In-app delivery is available.</p> : null}
  </details>;
}