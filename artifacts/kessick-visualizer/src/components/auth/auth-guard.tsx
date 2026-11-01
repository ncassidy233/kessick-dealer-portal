import { useUser } from "@clerk/react";
import { getGetAccountQueryKey, useGetAccount } from "@workspace/api-client-react";
import { Link, Redirect, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";
import { usePortalSession } from "@/lib/portal-session";
import { dealerAccessState } from "@/lib/dealer-access";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  const [location] = useLocation();

  if (!isLoaded) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Redirect to={`/sign-in?redirect_url=${encodeURIComponent(location)}`} />;
  }

  return <AccountDataGuard>{children}</AccountDataGuard>;
}

export function AccountDataGuard({ children }: { children: ReactNode }) {
  const { data: accountContext, isLoading, isFetching, error, refetch } =
    useGetAccount({
      query: {
        queryKey: getGetAccountQueryKey(),
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    });
  const [location] = useLocation();

  if (isLoading && !accountContext) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!accountContext) {
    // If unauthorized response, clerk might be out of sync or server error.
    return (
      <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
        <p className="text-muted-foreground">Unable to fetch account details. Please try refreshing.</p>
      </div>
    );
  }

  if (error && (location === "/admin" || location.startsWith("/admin/"))) {
    return <div role="alert" className="flex min-h-[100dvh] flex-col items-center justify-center p-6 text-center"><h1 className="text-xl font-medium">Staff access verification required</h1><p className="mt-2">Staff pages remain locked until your current account can be verified.</p><button className="mt-4 min-h-11 underline" disabled={isFetching} onClick={() => void refetch()}>Retry account check</button></div>;
  }

  const status = accountContext.account.status;
  const role = accountContext.account.role;
  
  if (status === 'pending' && location !== '/pending-approval') {
    return <Redirect to="/pending-approval" />;
  }
  
  if (status === 'suspended' && location !== '/forbidden') {
    return <Redirect to="/forbidden" />;
  }

  if (status === 'approved' && role !== 'staff' && location.startsWith('/admin')) {
    return <Redirect to="/portal" />;
  }

  if (status === 'approved' && (location === '/pending-approval' || location === '/forbidden' || location === '/')) {
    return <Redirect to={role === 'staff' ? "/admin" : role === 'customer' ? "/portal/account" : "/portal"} />;
  }

  return (
    <>
      {(location === "/portal" || location.startsWith("/portal/")) && location !== "/portal/account"
        ? <DealerDataGuard>{children}</DealerDataGuard>
        : children}
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 left-1/2 z-[120] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 border border-destructive/50 bg-card px-4 py-3 text-sm text-foreground shadow-2xl"
        >
          <p className="font-medium">
            {(error as { status?: number }).status === 401
            || (error as { status?: number }).status === 403
              ? "Your account session needs attention."
              : "Kessick could not refresh your account details."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Your open work has been preserved. Keep this tab open and retry before leaving.
          </p>
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            {isFetching ? "Retrying..." : "Retry account check"}
          </button>
        </div>
      )}
    </>
  );
}

function DealerDataGuard({ children }: { children: ReactNode }) {
  const sessionQuery = usePortalSession();
  const state = dealerAccessState(sessionQuery);

  if (state === "loading") {
    return (
      <div role="status" aria-label="Checking dealer access" className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div role="alert" className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 text-center">
        <h1 className="text-xl font-medium">Unable to verify dealer access</h1>
        <p className="mt-2 text-muted-foreground">Private dealer pages remain locked until your permissions can be checked.</p>
        <button className="mt-4 underline disabled:opacity-50" disabled={sessionQuery.isFetching} onClick={() => void sessionQuery.refetch()}>
          {sessionQuery.isFetching ? "Checking access..." : "Retry access check"}
        </button>
        <Link href="/portal/account" className="mt-4 underline">Go to account</Link>
      </div>
    );
  }

  if (state === "account") return <Redirect to="/portal/account" />;

  return <>{children}</>;
}
