import type { PortalSession } from "./portal-session";

/** Navigation only; every destination still enforces server authorization. */
export function accountHome(session: Pick<PortalSession, "authorized" | "role" | "account">): string {
  if (session.account.status === "suspended") return "/forbidden";
  if (session.account.status === "pending") return "/pending-approval";
  if (!session.authorized || session.account.status !== "approved") return "/portal/account";
  if (session.role === "super_admin" || session.role === "staff_admin") return "/admin";
  if (session.role === "sales_rep" || session.role === "content_manager") return "/admin/content";
  return session.role === "dealer" ? "/portal" : "/portal/account";
}
