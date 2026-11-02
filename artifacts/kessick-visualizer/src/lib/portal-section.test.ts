import assert from "node:assert/strict";
import test from "node:test";
import { asPortalSection, dealerContextId, portalSwitchDestinations, sectionEditorHref, sectionKinds, staffRouteSection } from "./portal-section";
const caps = ["content:read", "pricing:read", "notifications:read", "users:read", "dealer-view:read"];

test("dealer sections map to their matching staff tools and back", () => {
  for (const section of ["projects", "collections", "training", "resources", "forms"] as const) {
    const { staffHref } = portalSwitchDestinations(`/portal/${section}`, "", caps);
    assert.equal(staffHref, `/admin/content?section=${section}`);
    assert.equal(portalSwitchDestinations("/admin/content", `section=${section}`, caps).dealerHref, `/portal/${section}`);
  }
  assert.equal(portalSwitchDestinations("/portal/pricing", "", caps).staffHref, "/admin/pricing");
  assert.equal(portalSwitchDestinations("/portal/notifications", "", caps).staffHref, "/admin/notifications");
  assert.equal(portalSwitchDestinations("/portal/account", "", caps).staffHref, "/admin/users");
  assert.deepEqual(sectionKinds("collections"), ["product_series", "finish"]);
  assert.equal(staffRouteSection("/admin/page-studio", "page=collections"), "collections");
});
test("context links allow only known pages and never accept an arbitrary return URL", () => {
  for (const unsafe of ["__proto__", "constructor", "https://evil.invalid", "../../users"]) assert.equal(asPortalSection(unsafe), undefined);
  assert.equal(staffRouteSection("/admin/page-studio", "page=https://evil.invalid"), "home");
  assert.equal(portalSwitchDestinations("/admin/content", "section=unknown&return=https://evil.invalid", caps).dealerHref, "/portal");
  assert.equal(dealerContextId("dealer=../../users"), undefined);
  assert.equal(portalSwitchDestinations("/portal/pricing", "", ["content:read"]).staffHref, "/admin");
});
test("returning to a selected dealer retains the page without carrying dealer permissions into editing", () => {
  const dealer = "11111111-1111-4111-8111-111111111111";
  assert.equal(portalSwitchDestinations("/portal/collections", "", caps, dealer).staffHref, `/admin/content?section=collections&dealer=${dealer}`);
  assert.equal(sectionEditorHref("collections", "layout", dealer), `/admin/page-studio?page=collections&dealer=${dealer}`);
  assert.equal(portalSwitchDestinations("/admin/page-studio", `page=collections&dealer=${dealer}`, caps).dealerHref, `/admin/dealer-view/${dealer}/portal/collections`);
  assert.equal(portalSwitchDestinations("/admin/content", `section=collections&dealer=${dealer}`, ["content:read"]).dealerHref, "/portal/collections");
});
