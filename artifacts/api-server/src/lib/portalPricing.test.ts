import test from "node:test";
import assert from "node:assert/strict";
import { canManagePortalPricing, priceOverrideInput } from "./portalPricing";

test("pricing read/write require authorized administrator capabilities", () => {
  for (const role of ["super_admin", "staff_admin"] as const) {
    assert.equal(canManagePortalPricing(role, "read"), true);
    assert.equal(canManagePortalPricing(role, "write"), true);
  }
  for (const role of ["sales_rep", "content_manager", null] as const) {
    assert.equal(canManagePortalPricing(role, "read"), false);
    assert.equal(canManagePortalPricing(role, "write"), false);
  }
});

test("pricing input requires a single valid target and finite two-decimal USD amount", () => {
  const base = { sku: " SKU-1 ", groupId: "a86bb3c9-9950-4915-a612-b969948025bc", wholesaleAmount: 12.34 };
  assert.deepEqual(priceOverrideInput.parse(base), { ...base, sku: "SKU-1", currency: "USD" });
  for (const invalid of [
    { ...base, groupId: null },
    { ...base, accountId: "d79b6185-25a7-497a-9342-c10937e8c568" },
    { ...base, groupId: "not-a-uuid" },
    { ...base, wholesaleAmount: -1 },
    { ...base, wholesaleAmount: 1.234 },
    { ...base, wholesaleAmount: "Infinity" },
    { ...base, wholesaleAmount: "" },
    { ...base, wholesaleAmount: 10000000000 },
    { ...base, currency: "EUR" },
    { ...base, sku: " " },
  ]) assert.equal(priceOverrideInput.safeParse(invalid).success, false);
});