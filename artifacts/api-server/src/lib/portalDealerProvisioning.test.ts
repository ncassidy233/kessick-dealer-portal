import assert from "node:assert/strict";
import test from "node:test";
import { hasApprovedDealerEligibility } from "./portalDealerEligibility";
import { dealerProvisioningPlan } from "./portalDealerProvisioning";

test("admin dealer provisioning without an organization creates an approved owner organization", () => {
  const plan = dealerProvisioningPlan(undefined);
  assert.deepEqual(plan, {
    status: "approved",
    createOrganization: true,
    membershipRole: "owner",
    membershipStatus: "approved",
  });
  assert.equal(
    hasApprovedDealerEligibility(
      { role: "dealer", status: plan.status },
      { status: plan.membershipStatus },
      { status: plan.status },
    ),
    true,
  );
});