import assert from "node:assert/strict";
import test from "node:test";
import { hasApprovedDealerEligibility } from "./portalDealerEligibility";

test("private dealer eligibility rejects suspended organizations and memberships", () => {
  const dealer = { role: "dealer", status: "approved" };
  assert.equal(hasApprovedDealerEligibility(dealer, { status: "approved" }, { status: "approved" }), true);
  assert.equal(hasApprovedDealerEligibility(dealer, { status: "suspended" }, { status: "approved" }), false);
  assert.equal(hasApprovedDealerEligibility(dealer, { status: "approved" }, { status: "suspended" }), false);
  assert.equal(hasApprovedDealerEligibility({ role: "dealer", status: "pending" }, { status: "approved" }, { status: "approved" }), false);
});