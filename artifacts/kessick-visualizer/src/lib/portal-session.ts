import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

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
  return useQuery({
    queryKey: portalSessionKey,
    queryFn: () => customFetch<PortalSession>("/api/portal-v2/bootstrap"),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function staffHome(role?: PortalRole) {
  return role === "content_manager" || role === "sales_rep" ? "/admin/content" : "/admin";
}