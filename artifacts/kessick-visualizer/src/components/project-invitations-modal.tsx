import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useListProjectInvitations, useCreateProjectInvitation, useRevokeProjectInvitation } from "@workspace/api-client-react";
import { Mail, Copy, XCircle, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { getListProjectInvitationsQueryKey } from "@workspace/api-client-react";

export function ProjectInvitationsModal({ projectId, open, onOpenChange }: { projectId: string, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { data: invitations, isLoading } = useListProjectInvitations(projectId, { query: { enabled: open, queryKey: getListProjectInvitationsQueryKey(projectId) } });
  const createInvite = useCreateProjectInvitation();
  const revokeInvite = useRevokeProjectInvitation();
  const queryClient = useQueryClient();
  
  const [email, setEmail] = useState("");
  const [createdToken, setCreatedToken] = useState<{ email: string, token: string } | null>(null);

  const handleInvite = () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error("Valid email required");
      return;
    }
    
    createInvite.mutate({
      projectId,
      data: { email }
    }, {
      onSuccess: (res: any) => {
        toast.success(`Invitation created for ${email}`);
        setCreatedToken({ email, token: res.token });
        setEmail("");
        queryClient.invalidateQueries({ queryKey: getListProjectInvitationsQueryKey(projectId) });
      },
      onError: () => toast.error("Failed to create invitation")
    });
  };

  const handleRevoke = (id: string) => {
    revokeInvite.mutate({
      invitationId: id
    }, {
      onSuccess: () => {
        toast.success("Project access revoked");
        queryClient.invalidateQueries({ queryKey: getListProjectInvitationsQueryKey(projectId) });
      },
      onError: () => toast.error("Project access could not be revoked"),
    });
  };

  const copyLink = (token: string) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const link = `${window.location.origin}${base}/invitation/${token}`;
    navigator.clipboard.writeText(link).then(
      () => toast.success("Invitation link copied to clipboard"),
      () => toast.error("Copy failed. Select and copy the link manually."),
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) setCreatedToken(null);
      onOpenChange(o);
    }}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-none">
        <DialogHeader>
          <DialogTitle className="text-lg font-sans font-medium">Share Project</DialogTitle>
          <DialogDescription>
            Invite customers or team members to view this project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          
          {createdToken && (
            <div className="p-4 bg-primary/10 border border-primary/30 flex flex-col gap-2">
              <h4 className="text-sm font-semibold text-primary">Invitation Link Created!</h4>
              <p className="text-xs text-muted-foreground">Send this link to {createdToken.email}:</p>
              <div className="flex gap-2">
                <Input value={`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/invitation/${createdToken.token}`} readOnly className="h-8 text-xs bg-background rounded-none border-primary/30" />
                <Button size="sm" className="rounded-none bg-primary text-primary-foreground" onClick={() => copyLink(createdToken.token)}>
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex gap-2 items-center">
            <Mail className="w-4 h-4 text-muted-foreground ml-1" />
            <Input 
              placeholder="Email address" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-none bg-input"
            />
            <Button onClick={handleInvite} disabled={createInvite.isPending} className="rounded-none">
              Invite
            </Button>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Project Access</h4>
            {isLoading ? (
              <div className="flex items-center justify-center p-4"><Loader2 className="w-4 h-4 animate-spin" /></div>
            ) : !invitations || invitations.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border">No invitations or shared access.</div>
            ) : (
              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2">
                {invitations.map(inv => (
                  <div key={inv.id} className="flex justify-between items-center p-2 border border-border bg-muted/30">
                    <div>
                      <div className="text-sm font-medium">{inv.email}</div>
                      <div className="text-xs text-muted-foreground capitalize">Status: {inv.status}</div>
                    </div>
                    {(inv.status === 'pending' || inv.status === 'accepted') && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-none"
                        onClick={() => handleRevoke(inv.id)}
                        aria-label={inv.status === 'accepted' ? `Revoke ${inv.email}'s project access` : `Revoke invitation for ${inv.email}`}
                        title={inv.status === 'accepted' ? 'Revoke project access' : 'Revoke invitation'}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}