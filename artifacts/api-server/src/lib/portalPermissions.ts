export const portalStaffRoles = [
  "super_admin",
  "staff_admin",
  "sales_rep",
  "content_manager",
] as const;
export type PortalStaffRole = (typeof portalStaffRoles)[number];
export type PortalRole = PortalStaffRole | "dealer" | "customer";

export const portalCapabilities: Record<PortalRole, readonly string[]> = {
  super_admin: ["admin:overview", "users:read", "users:write", "groups:read", "groups:write", "reps:write", "content:read", "content:write", "notifications:read", "notifications:write", "notifications:history", "pricebooks:read", "pricing:read", "pricing:write"],
  staff_admin: ["admin:overview", "users:read", "users:write", "groups:read", "groups:write", "reps:write", "content:read", "content:write", "notifications:read", "notifications:write", "notifications:history", "pricebooks:read", "pricing:read", "pricing:write"],
  sales_rep: ["users:read", "groups:read", "content:read", "notifications:read", "pricebooks:read"],
  content_manager: ["content:read", "content:write", "notifications:read", "notifications:write"],
  dealer: ["content:read", "notifications:read"],
  customer: [],
};

export function hasPortalCapability(
  role: PortalRole,
  capability: string,
): boolean {
  return portalCapabilities[role].includes(capability);
}

export function resolvePortalBootstrapAccess(
  account: { role: "customer" | "dealer" | "staff"; status: string },
  staffRole: PortalStaffRole | null,
  approvedDealer: boolean,
): { role: PortalRole; authorized: boolean } | null {
  if (account.status !== "approved") return null;
  if (account.role === "staff") {
    return staffRole ? { role: staffRole, authorized: true } : null;
  }
  if (account.role === "dealer") {
    return { role: "dealer", authorized: approvedDealer };
  }
  return { role: "customer", authorized: false };
}

export function legacyPortalPathAllowed(
  role: PortalStaffRole,
  path: string,
): boolean {
  if (role === "super_admin" || role === "staff_admin") return true;
  return role === "content_manager" &&
    /^\/(?:api\/)?staff\/portal\/(resource-uploads(?:\/|$)|forms(?:\/|$)|resources(?:\/|$)|notifications(?:\/|$))/.test(path);
}