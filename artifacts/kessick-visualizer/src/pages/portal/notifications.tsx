import { useState, useEffect } from "react";
import { 
  usePortalNotifications,
  useMarkNotificationRead,
  useAcknowledgeNotification,
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from "@/hooks/use-portal-v2";
import { Loader2, Bell, AlertTriangle, Check, CheckCheck, Settings2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { NotificationPreferences } from "./notification-preferences";

export default function PortalNotifications() {
  const { data: notificationsData, isLoading: noticesLoading, isError, refetch } = usePortalNotifications();
  const { data: prefsData } = useNotificationPreferences();
  
  const markReadMutation = useMarkNotificationRead();
  const acknowledgeMutation = useAcknowledgeNotification();
  const updatePrefsMutation = useUpdateNotificationPreferences();

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate(id, {
      onError: () => toast.error("Failed to mark as read")
    });
  };

  const handleAcknowledge = (id: string) => {
    acknowledgeMutation.mutate(id, {
      onSuccess: () => toast.success("Notification acknowledged"),
      onError: () => toast.error("Failed to acknowledge")
    });
  };

  if (noticesLoading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#B39862]" />
      </div>
    );
  }

  if (isError) return <div className="p-8" role="alert"><h1 className="text-xl">Notices could not be loaded</h1><p className="mt-2">Your read and acknowledgement history has not been changed.</p><Button className="mt-4" onClick={() => refetch()}>Retry</Button></div>;
  const notifications = notificationsData?.notifications || [];

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto w-full space-y-6 flex flex-col h-full">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-end border-b border-[#121210]/10 pb-6 shrink-0">
        <div className="space-y-2">
          <h1 className="text-3xl font-light tracking-tight flex items-center gap-3 text-[#121210]">
            <Bell className="w-8 h-8 text-[#B39862]" />
            Notices & Alerts
          </h1>
          <p className="text-[#121210]/60">Important updates and required acknowledgements from Kessick.</p>
        </div>
      </div>

      <NotificationPreferences />
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pb-12">
        {notifications.length === 0 ? (
          <div className="border border-[#121210]/10 bg-white p-12 text-center text-[#121210]/50">
            You have no notifications.
          </div>
        ) : (
          notifications.map((item) => {
            const n = item.notification;
            const isUnread = !item.readAt;
            const needsAck = n.acknowledgementRequired && !item.acknowledgedAt;
            
            return (
              <div 
                key={item.id} 
                className={`p-6 border transition-colors relative flex flex-col gap-4 ${isUnread || needsAck ? 'bg-white border-[#B39862]/40 shadow-md' : 'bg-[#121210]/5 border-[#121210]/10 opacity-70'}`}
              >
                {(isUnread || needsAck) && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#B39862]" />}
                {n.imageUrl && <img src={n.imageUrl} alt="" className="max-h-64 w-full object-cover" />}
                {n.linkUrl && <a className="text-sm underline underline-offset-4" href={n.linkUrl} target="_blank" rel="noopener noreferrer">Open announcement link</a>}
                
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-medium text-lg ${isUnread || needsAck ? 'text-[#121210]' : 'text-[#121210]/60'}`}>
                        {n.title}
                      </h3>
                      {isUnread && <Badge variant="default" className="text-[9px] rounded-none px-1.5 py-0 h-4 bg-[#121210] text-white">NEW</Badge>}
                      {n.priority === 'high' && <Badge variant="destructive" className="text-[9px] rounded-none px-1.5 py-0 h-4 bg-red-600">HIGH PRIORITY</Badge>}
                    </div>
                    <p className={`text-sm ${isUnread || needsAck ? 'text-[#121210]/80' : 'text-[#121210]/50'}`}>
                      {n.body}
                    </p>
                    <p className="text-xs text-[#121210]/40 font-mono mt-2">
                      {n.sentAt ? formatDistanceToNow(new Date(n.sentAt), { addSuffix: true }) : 'Unknown date'}
                    </p>
                  </div>
                  
                  <div className="flex flex-col gap-2 shrink-0 sm:min-w-[140px]">
                    {needsAck && (
                      <Button 
                        size="sm" 
                        onClick={() => handleAcknowledge(item.id)}
                        disabled={acknowledgeMutation.isPending}
                        className="w-full text-xs rounded-none bg-[#B39862] text-white hover:bg-[#B39862]/90"
                      >
                        <ShieldAlert className="w-4 h-4 mr-2" /> Acknowledge
                      </Button>
                    )}
                    {isUnread && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleMarkRead(item.id)}
                        disabled={markReadMutation.isPending}
                        className="w-full text-xs rounded-none border-[#121210]/20 text-[#121210] hover:bg-[#121210]/5"
                      >
                        <Check className="w-4 h-4 mr-2" /> Mark as read
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
