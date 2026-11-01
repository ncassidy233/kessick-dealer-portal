import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useStaffDealerView } from "./staff-dealer-view-context";
import { dealerQueryKey, dealerReadUrl } from "./staff-dealer-view";

export type PortalRole = "super_admin" | "staff_admin" | "sales_rep" | "content_manager" | "dealer" | "customer";

export interface PortalSession {
  role: PortalRole;
  authorized: boolean;
  capabilities: string[];
  account: { id: string; email: string; displayName?: string | null; status: string };
  groups: { id: string; name: string }[];
}

export const portalSessionKey = ["portal-v2", "bootstrap"] as const;

export function usePortalSession() {
  const view = useStaffDealerView();
  return useQuery({
    queryKey: dealerQueryKey(portalSessionKey, view),
    queryFn: ({ signal }) => customFetch<PortalSession>(dealerReadUrl("/api/portal-v2/bootstrap", view), { signal }),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnMount: "always",
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function staffHome(role?: PortalRole) {
  return role === "content_manager" || role === "sales_rep" ? "/admin/content" : "/admin";
}