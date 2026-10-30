import assert from "node:assert/strict";
import test from "node:test";
import { dealerPreviewAccountId, dealerPreviewRequestUrl, dealerPreviewLinkUrl } from "../../../../lib/api-client-react/src/dealer-preview";

const id = "11111111-1111-4111-8111-111111111111";
const location = new URL(`https://portal.example/admin/dealer-view/${id}/portal`);

test("Dealer View transports real dealer reads through the selected account gateway", () => {
  assert.equal(dealerPreviewAccountId(location.pathname), id);
  assert.equal(dealerPreviewAccountId("/portal/preview"), null);
  for (const path of ["/api/dealer-portal/pricing", "/api/portal-v2/content?kind=resource", "/api/portal-v2/projects"]) {
    assert.equal(dealerPreviewRequestUrl(new URL(path, location), location, "GET"), `https://portal.example/api/staff/dealer-view/${id}${path.slice(4)}`);
  }
});

test("Dealer View recognizes subpath deployments and keeps native links inside the preview", () => {
  const subpath = new URL(`https://portal.example/dealer-app/admin/dealer-view/${id}/portal`);
  assert.equal(dealerPreviewAccountId(subpath.pathname), id);
  assert.equal(dealerPreviewRequestUrl(new URL("/api/dealer-portal/pricing", subpath), subpath, "GET"), `https://portal.example/api/staff/dealer-view/${id}/dealer-portal/pricing`);
  assert.throws(() => dealerPreviewRequestUrl(new URL("/api/account", subpath), subpath, "PATCH"), /read-only/);
  for (const href of ["/portal/forms", "/dealer-app/portal/forms"]) {
    assert.equal(dealerPreviewLinkUrl(href, subpath, "/dealer-app/"), `https://portal.example/dealer-app/admin/dealer-view/${id}/portal/forms`);
  }
  for (const href of ["/admin/users", "/dealer-app/admin/content", "javascript:alert(1)"]) assert.equal(dealerPreviewLinkUrl(href, subpath, "/dealer-app/"), null);
  assert.equal(dealerPreviewLinkUrl("https://kessickwinecellars.com/", subpath, "/dealer-app/"), "https://kessickwinecellars.com/");
  const download = dealerPreviewLinkUrl(`/api/dealer-portal/resources/${id}/file`, subpath, "/dealer-app/")!;
  assert.equal(dealerPreviewLinkUrl(download, subpath, "/dealer-app/"), download);
  assert.equal(dealerPreviewLinkUrl(`/api/staff/dealer-view/${id}/staff/portal/users`, subpath, "/dealer-app/"), null);
});

test("Dealer View rejects writes but never remaps staff bootstrap, authentication, or external URLs", () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) assert.throws(() => dealerPreviewRequestUrl(new URL("/api/account", location), location, method), /read-only/);
  for (const url of ["https://portal.example/api/account", "https://portal.example/api/portal-v2/bootstrap", "https://other.example/api/dealer-portal/pricing"]) {
    assert.equal(dealerPreviewRequestUrl(new URL(url), location, "GET"), url);
  }
  const dealerLocation = new URL("https://portal.example/portal");
  assert.equal(dealerPreviewRequestUrl(new URL("/api/dealer-portal/pricing", location), dealerLocation, "GET"), "https://portal.example/api/dealer-portal/pricing");
});
