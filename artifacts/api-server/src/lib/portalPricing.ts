import { z } from "zod";
import { hasPortalCapability, type PortalStaffRole } from "./portalPermissions";

// These checks supplement (not replace) the authenticated legacy staff router.
export function canManagePortalPricing(role: PortalStaffRole | null, method: "read" | "write"): boolean {
  return role !== null && hasPortalCapability(role, `pricing:${method}`);
}

export const priceOverrideInput = z.object({
  sku: z.string().trim().min(1).max(240),
  groupId: z.string().uuid().nullable().optional(),
  accountId: z.string().uuid().nullable().optional(),
  wholesaleAmount: z.number().finite().min(0).max(9999999999.99).refine((n) => Math.round(n * 100) / 100 === n, "Use at most two decimal places."),
  currency: z.literal("USD").default("USD"),
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.groupId) === Boolean(value.accountId)) {
    ctx.addIssue({ code: "custom", message: "Exactly one group or account is required." });
  }
});