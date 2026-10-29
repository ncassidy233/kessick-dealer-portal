import type { PortalSession } from "./portal-session";

type DealerSession = Pick<PortalSession, "role" | "authorized" | "account">;

export function canAccessDealerPortal(session: DealerSession | null | undefined): boolean {
  return session?.role === "dealer"
    && session.authorized === true
    && session.account?.status === "approved";
}

export function dealerAccessState(query: {
  data?: DealerSession | null;
  isLoading: boolean;
  isError: boolean;
}): "loading" | "error" | "allowed" | "account" {
  if (query.isLoading) return "loading";
  if (query.isError || !query.data) return "error";
  return canAccessDealerPortal(query.data) ? "allowed" : "account";
}
