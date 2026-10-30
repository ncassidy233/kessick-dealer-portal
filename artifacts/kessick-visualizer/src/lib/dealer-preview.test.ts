import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { assertDealerWritable, dealerContentDestination, dealerQueryKey, dealerReadUrl, portalDestination, type StaffDealerView } from "./staff-dealer-view";
import { customFetch } from "../../../../lib/api-client-react/src/custom-fetch";
import { getGetAccountQueryKey, getGetDealerPortalAccessQueryKey, getGetDealerPortalPricingQueryKey, getListDealerPortalFormsQueryKey, getListDealerPortalResourcesQueryKey } from "../../../../lib/api-client-react/src/generated/api";

const view: StaffDealerView = { selectedDealerAccountId: "11111111-1111-4111-8111-111111111111", readOnly: true };
const other: StaffDealerView = { ...view, selectedDealerAccountId: "22222222-2222-4222-8222-222222222222" };

test("selected-dealer reads use explicit allowlisted URLs; real dealer URLs stay unchanged", () => {
  for (const path of ["/api/portal-v2/bootstrap", "/api/portal-v2/content?kind=resource", "/api/portal-v2/projects", "/api/portal-v2/notifications", "/api/portal-v2/notification-preferences", "/api/dealer-portal/dashboard", "/api/dealer-portal/access", "/api/dealer-portal/pricing", "/api/dealer-portal/resources", `/api/dealer-portal/resources/${view.selectedDealerAccountId}/file`, "/api/dealer-portal/forms", "/api/dealer-portal/push-config"]) {
    assert.equal(dealerReadUrl(path, view), `/api/staff/dealer-view/${view.selectedDealerAccountId}${path.slice(4)}`);
    assert.equal(dealerReadUrl(path, null), path);
  }
  for (const path of ["/api/account", "/api/dealer-portal/resources/id/file", "/api/portal-v2/notifications/id/read", "/api/dealer-portal/forms/anything", "/api/portal-v2/content/../users"]) assert.throws(() => dealerReadUrl(path, view));
});

test("every legacy and v2 preview query is isolated on the shared QueryClient", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const key of [["portal-v2", "bootstrap"], ["portal-v2-content", "announcement"], ["portal-v2-projects"], ["portal-v2-notifications"], ["portal-v2-notification-preferences"], ["portal-push-config"], ["dealer-resource-file", `/api/dealer-portal/resources/${view.selectedDealerAccountId}/file`], ...["access", "pricing", "resources", "forms"].map(path => [`/api/dealer-portal/${path}`])]) {
    client.setQueryData(dealerQueryKey(key, view), "Dealer A private data");
    client.setQueryData(key, "Real dealer private data");
    assert.equal(client.getQueryData(dealerQueryKey(key, other)), undefined);
    const observer = new QueryObserver(client, { queryKey: dealerQueryKey(key, other), queryFn: async () => "Dealer B private data", enabled: false });
    assert.equal(observer.getCurrentResult().data, undefined);
    assert.equal(client.getQueryData(key), "Real dealer private data");
    observer.destroy();
  }
  client.clear();
});

test("normal dealer invalidation retains generated keys without invalidating staff preview accounts", async () => {
  const client = new QueryClient();
  for (const key of [
    getGetAccountQueryKey(), getGetDealerPortalAccessQueryKey(), getGetDealerPortalPricingQueryKey(),
    getListDealerPortalFormsQueryKey(), getListDealerPortalResourcesQueryKey(),
    ["portal-v2", "bootstrap"], ["portal-v2-content", "form"], ["portal-push-config"],
  ]) {
    assert.equal(dealerQueryKey(key, null), key);
    client.setQueryData(dealerQueryKey(key, null), "Original dealer data");
    client.setQueryData(dealerQueryKey(key, view), "Staff preview data");
    await client.invalidateQueries({ queryKey: key });
    assert.equal(client.getQueryState(key)?.isInvalidated, true);
    assert.equal(client.getQueryState(dealerQueryKey(key, view))?.isInvalidated, false);
  }
  client.clear();
});

test("preview routes are explicit and content links cannot escape to staff APIs or unallowlisted downloads", () => {
  assert.equal(portalDestination("/portal/forms", view), `/admin/dealer-view/${view.selectedDealerAccountId}/portal/forms`);
  assert.equal(portalDestination("/portal/forms", null), "/portal/forms");
  assert.equal(dealerContentDestination("https://portal.example/app/portal/forms", view, "https://portal.example", "/app/"), `/app/admin/dealer-view/${view.selectedDealerAccountId}/portal/forms`);
  for (const href of ["/admin/users", "/api/account", "/api/dealer-portal/resources/id/file", "javascript:alert(1)"]) assert.equal(dealerContentDestination(href, view, "https://portal.example", "/"), null);
  for (const href of ["javascript:alert(1)", "data:text/html,bad", "******other.example/", "https://example.com\\@evil.example/"]) assert.equal(dealerContentDestination(href, null, "https://portal.example", "/"), null);
  assert.equal(dealerContentDestination(`/api/dealer-portal/resources/${view.selectedDealerAccountId}/file`, view, "https://portal.example", "/"), `/api/staff/dealer-view/${view.selectedDealerAccountId}/dealer-portal/resources/${view.selectedDealerAccountId}/file`);
  assert.equal(dealerContentDestination(`https://portal.example/api/dealer-portal/resources/${view.selectedDealerAccountId}/file`, other, "https://portal.example", "/"), `/api/staff/dealer-view/${other.selectedDealerAccountId}/dealer-portal/resources/${view.selectedDealerAccountId}/file`);
  assert.equal(dealerContentDestination("https://kessickwinecellars.com/", view, "https://portal.example", "/"), "https://kessickwinecellars.com/");
  assert.throws(() => assertDealerWritable(view), /read-only/);
  assert.doesNotThrow(() => assertDealerWritable(null));
});

test("shared customFetch never remaps or blocks requests because of the browser route", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const requests: { input: RequestInfo | URL; method?: string }[] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: { location: new URL(`https://portal.example/admin/dealer-view/${view.selectedDealerAccountId}/portal`) } });
  globalThis.fetch = async (input, init) => {
    requests.push({ input, method: init?.method });
    return new Response("{}", { headers: { "content-type": "application/json" } });
  };
  try {
    await customFetch("/api/dealer-portal/pricing");
    await customFetch("/api/account", { method: "PATCH", body: "{}" });
    assert.equal(requests[0].input, "/api/dealer-portal/pricing");
    assert.equal(requests[1].input, "/api/account");
    assert.equal(requests[1].method, "PATCH");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
