import { useGetAccount } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Redirect } from "wouter";
import { Loader2, ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  const { data: accountContext, isLoading } = useGetAccount();
  const { signOut } = useClerk();

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (accountContext?.account.status === 'approved') {
    return <Redirect to="/workspace" />;
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-canvas-pattern opacity-[0.03]" />
      
      <div className="z-10 max-w-md w-full border border-destructive/20 bg-card shadow-2xl p-10 flex flex-col items-center text-center space-y-6">
        <BrandLogo tone="light" className="h-8 w-auto mb-4" />
        
        <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-2">
          <ShieldAlert className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-sans font-light tracking-tight text-foreground">
          Access Suspended
        </h1>
        
        <p className="text-muted-foreground leading-relaxed">
          Your account has been suspended or your access to this workspace has been revoked. 
          Please contact support if you believe this is an error.
        </p>

        <div className="pt-6 w-full border-t border-border">
          <Button variant="outline" className="w-full rounded-none" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL })}>
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}