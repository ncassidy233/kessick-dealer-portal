import { useParams, useLocation } from "wouter";
import { useAcceptProjectInvitation } from "@workspace/api-client-react";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BrandLogo } from "@/components/brand-logo";

export default function InvitationPage() {
  const { token } = useParams();
  const [, setLocation] = useLocation();
  const acceptInvitation = useAcceptProjectInvitation();
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!token || hasAttempted.current) return;
    hasAttempted.current = true;

    acceptInvitation.mutate({
      data: { token }
    }, {
      onSuccess: (project) => {
        toast.success("Invitation accepted successfully!");
        setLocation(`/workspace/project/${project.id}`);
      },
      onError: (err: any) => {
        toast.error("Failed to accept invitation. It may have expired.");
        setLocation('/workspace');
      }
    });
  }, [token, acceptInvitation, setLocation]);

  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-canvas-pattern opacity-[0.03]" />
      <div className="z-10 flex flex-col items-center">
        <BrandLogo tone="light" className="h-8 w-auto mb-6" />
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground text-sm uppercase tracking-widest font-mono">Accepting Invitation...</p>
      </div>
    </div>
  );
}