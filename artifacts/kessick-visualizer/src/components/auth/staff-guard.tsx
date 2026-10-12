import { ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { staffHome, usePortalSession } from "@/lib/portal-session";

export function StaffGuard({ children }: { children: ReactNode }) {
  const { data: session, isLoading, isError, refetch } = usePortalSession();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !session) {
    return <div className="p-8 text-center"><h1 className="text-xl">Unable to verify staff permissions</h1><p className="mt-2 text-muted-foreground">Staff access remains locked until permissions can be checked.</p><button className="mt-4 underline" onClick={() => refetch()}>Try again</button></div>;
  }
  // Render a denial instead of redirecting to /portal: AuthGuard sends accounts
  // it considers staff from /portal back to /admin, so a redirect here can
  // ping-pong forever when /api/account and portal bootstrap disagree on role.
  if (!session.authorized || session.role === "dealer" || session.role === "customer") {
    return <StaffAccessDenied />;
  }

  const required = location === "/admin" ? "admin:overview"
    : location.startsWith("/admin/pricing") ? "pricing:read"
    : location.startsWith("/admin/users") ? "users:read"
    : location.startsWith("/admin/groups") ? "groups:read"
    : location.startsWith("/admin/content") ? "content:read"
    : location.startsWith("/admin/notifications") ? "notifications:read"
    : null;
  const fullAdmin = ["super_admin", "staff_admin"].includes(session.role);
  const roleAllowed = location.startsWith("/admin/knowledge")
    ? fullAdmin || session.role === "content_manager"
    : location.startsWith("/admin/concierge-insights")
      ? fullAdmin
      : null;
  const staffDealerPreview = location === "/admin/dealer-view";
  const denied = roleAllowed !== null
    ? !roleAllowed
    : (required && !session.capabilities.includes(required)) || (!required && !fullAdmin && !staffDealerPreview);
  if (denied) {
    const home = staffHome(session.role);
    // Never redirect to the page we are already on; that re-renders forever.
    if (home === location) return <StaffAccessDenied />;
    return <Redirect to={home} />;
  }

  return <>{children}</>;
}

function StaffAccessDenied() {
  return (
    <div className="p-8 text-center" role="alert" data-testid="state-staff-access-denied">
      <h1 className="text-xl">Staff access required</h1>
      <p className="mt-2 text-muted-foreground">Your current portal role does not allow this page. Ask an administrator to confirm your staff role, then sign in again.</p>
    </div>
  );
}
