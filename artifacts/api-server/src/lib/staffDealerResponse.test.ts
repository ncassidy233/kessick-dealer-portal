import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import type { Account } from "@workspace/db";
import { dealerReadAccount, setStaffDealerRead } from "./staffDealerRead";
import { staffDealerResponse } from "./staffDealerResponse";

test("staff dealer context never replaces authentication or authorizes a mutation", () => {
  const staff = { id: "staff", role: "staff" } as Account;
  const dealer = { id: "dealer", role: "dealer" } as Account;
  const req = { method: "GET", account: staff } as Request;
  setStaffDealerRead(req, dealer);
  assert.equal(dealerReadAccount(req), dealer);
  assert.equal(req.account, staff);
  for (const method of ["HEAD", "POST", "PUT", "DELETE", "PATCH"]) {
    req.method = method;
    assert.equal(dealerReadAccount(req), staff);
  }
  assert.equal(dealerReadAccount({ method: "GET", account: staff } as Request), staff);
});

test("staff dealer DTO denies unapproved fields and endpoint additions by default", () => {
  const result = staffDealerResponse("/portal-v2/bootstrap", {
    role: "dealer", authorized: true, account: { id: "dealer", email: "dealer@example.invalid", displayName: "Dealer", status: "approved",
      clerkUserId: "private-auth-identity", assignedRep: { email: "representative@example.invalid", displayName: "Dealer contact", id: "private-staff", clerkUserId: "private-rep-identity", portalRole: "super_admin" }, invitationEligible: true },
    groups: [{ id: "group", name: "Assigned group", internalNotes: "private group note" }],
    capabilities: ["content:read"], organization: { id: "org", name: "Dealer organization", status: "approved", approvedByAccountId: "private-staff" },
    push: { message: "private server configuration" },
  });
  assert.deepEqual(result, {
    role: "dealer", authorized: true,
    account: { id: "dealer", email: "dealer@example.invalid", displayName: "Dealer", status: "approved", assignedRep: { email: "representative@example.invalid", displayName: "Dealer contact" } },
    groups: [{ id: "group", name: "Assigned group" }], capabilities: ["content:read"],
    organization: { id: "org", name: "Dealer organization", status: "approved" },
  });
  const content = staffDealerResponse("/portal-v2/content", { content: [{
    id: "content", kind: "resource", title: "Approved", published: true,
    createdByAccountId: "private-staff", targets: { accountIds: ["another-dealer"] },
    payload: { category: "Resources", featuredOnDashboard: true, staffNotes: "private", arbitraryNewField: "denied" },
  }] });
  assert.deepEqual(content, { content: [{ id: "content", kind: "resource", title: "Approved", published: true, payload: { category: "Resources", featuredOnDashboard: true } }] });
  assert.throws(() => staffDealerResponse("/portal-v2/new-sensitive-endpoint", { secret: true }), /Unapproved/);
  assert.throws(() => staffDealerResponse("/portal-v2/content", { content: [{ id: "draft", kind: "resource", title: "Draft", payload: {}, published: false }] }));
});

test("staff dealer pricing DTO omits raw source records and private provenance", () => {
  assert.deepEqual(staffDealerResponse("/dealer-portal/pricing", [{
    id: "line", pricebookId: "book", sku: "TEST-SKU", currency: "USD", wholesaleAmount: "100.00", status: "priced",
    sourceRecord: { internalNote: "private" }, optionAdjustments: { internalRule: "private" }, secret: "denied",
  }]), [{
    id: "line", pricebookId: "book", sku: "TEST-SKU", currency: "USD", wholesaleAmount: "100.00", status: "priced",
  }]);
});
