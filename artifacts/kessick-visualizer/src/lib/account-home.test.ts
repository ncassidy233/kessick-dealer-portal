import assert from "node:assert/strict";
import test from "node:test";
import { accountHome } from "./account-home";
import type { PortalSession } from "./portal-session";

test("one entry point routes only authorized roles to their own workspace", () => {
  const destination = (role: PortalSession["role"], authorized = true, status = "approved") => accountHome({ role, authorized, account: { id: "fixture", email: "fixture@example.invalid", status } });
  assert.equal(destination("super_admin"), "/admin");
  assert.equal(destination("staff_admin"), "/admin");
  for (const role of ["sales_rep", "content_manager"] as const) assert.equal(destination(role), "/admin/content");
  assert.equal(destination("dealer"), "/portal");
  assert.equal(destination("customer"), "/portal/account");
  for (const role of ["super_admin", "staff_admin", "dealer"] as const) {
    assert.equal(destination(role, false), "/portal/account");
    assert.equal(destination(role, true, "suspended"), "/forbidden");
    assert.equal(destination(role, true, "pending"), "/pending-approval");
    assert.equal(destination(role, true, "unknown"), "/portal/account");
  }
});
