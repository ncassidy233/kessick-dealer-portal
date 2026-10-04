import { useGetAccount } from "@workspace/api-client-react";
import { useClerk } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { Redirect } from "wouter";
import { Loader2, Clock } from "lucide-react";

export default function PendingApprovalPage() {
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
    return <Redirect to={accountContext.account.role === "staff" ? "/admin/users" : accountContext.account.role === "customer" ? "/portal/account" : "/portal"} />;
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-canvas-pattern opacity-[0.03]" />
      
      <div className="z-10 max-w-md w-full border border-border bg-card shadow-2xl p-10 flex flex-col items-center text-center space-y-6">
        <BrandLogo tone="light" className="h-8 w-auto mb-4" />
        
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center text-muted-foreground mb-2">
          <Clock className="w-8 h-8" />
        </div>
        
        <h1 className="text-2xl font-sans font-light tracking-tight text-foreground">
          Application Under Review
        </h1>
        
        <p className="text-muted-foreground leading-relaxed">
          Your account request has been received. Our team is currently reviewing your details. 
          You will receive an email once your account has been approved and activated.
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