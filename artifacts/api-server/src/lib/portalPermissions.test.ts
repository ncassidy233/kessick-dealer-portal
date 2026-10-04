import test from "node:test";
import assert from "node:assert/strict";
import {
  hasPortalCapability,
  legacyPortalPathAllowed,
  resolvePortalBootstrapAccess,
} from "./portalPermissions";

test("dealer and sales roles cannot gain administration privileges", () => {
  assert.equal(hasPortalCapability("dealer", "users:write"), false);
  assert.equal(hasPortalCapability("sales_rep", "reps:write"), false);
  assert.equal(hasPortalCapability("content_manager", "groups:write"), false);
  assert.equal(hasPortalCapability("staff_admin", "users:write"), true);
});

test("wholesale pricebooks require a persisted pricing-capable role", () => {
  assert.equal(hasPortalCapability("super_admin", "pricebooks:read"), true);
  assert.equal(hasPortalCapability("staff_admin", "pricebooks:read"), true);
  assert.equal(hasPortalCapability("sales_rep", "pricebooks:read"), true);
  assert.equal(hasPortalCapability("content_manager", "pricebooks:read"), false);
  assert.equal(hasPortalCapability("dealer", "pricebooks:read"), false);
});

test("legacy endpoints preserve content manager least privilege", () => {
  assert.equal(legacyPortalPathAllowed("content_manager", "/staff/portal/resources"), true);
  assert.equal(legacyPortalPathAllowed("content_manager", "/api/staff/portal/resources"), true);
  assert.equal(legacyPortalPathAllowed("content_manager", "/staff/portal/forms/a"), true);
  assert.equal(legacyPortalPathAllowed("content_manager", "/staff/portal/groups"), false);
  assert.equal(legacyPortalPathAllowed("sales_rep", "/staff/portal/resources"), false);
});

test("bootstrap represents an approved customer without granting dealer access", () => {
  assert.deepEqual(
    resolvePortalBootstrapAccess(
      { role: "customer", status: "approved" },
      null,
      false,
    ),
    { role: "customer", authorized: false },
  );
  assert.equal(hasPortalCapability("customer", "content:read"), false);
});

test("bootstrap fails closed for unbound staff and preserves approved dealers", () => {
  assert.equal(
    resolvePortalBootstrapAccess(
      { role: "staff", status: "approved" },
      null,
      false,
    ),
    null,
  );
  assert.deepEqual(
    resolvePortalBootstrapAccess(
      { role: "dealer", status: "approved" },
      null,
      true,
    ),
    { role: "dealer", authorized: true },
  );
});