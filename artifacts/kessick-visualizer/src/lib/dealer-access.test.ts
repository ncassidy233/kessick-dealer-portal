import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { canAccessDealerPortal, dealerAccessState } from "./dealer-access";
import type { PortalSession } from "./portal-session";

const dealer: PortalSession = {
  role: "dealer",
  authorized: true,
  account: { id: "dealer-account", email: "dealer@example.com", status: "approved" },
  capabilities: ["content:read", "notifications:read"],
  groups: [],
};

test("private dealer pages require the server's dealer authorization", () => {
  assert.equal(canAccessDealerPortal(dealer), true);
  assert.equal(canAccessDealerPortal({ ...dealer, authorized: false }), false);
  assert.equal(canAccessDealerPortal(undefined), false);
  assert.equal(canAccessDealerPortal(null), false);
});

test("customer and staff roles never inherit private dealer access", () => {
  const roles: PortalSession["role"][] = ["customer", "super_admin", "staff_admin", "sales_rep", "content_manager"];
  for (const role of roles) {
    assert.equal(canAccessDealerPortal({ ...dealer, role }), false, role);
  }
});

test("pending and suspended accounts cannot use stale dealer authorization", () => {
  for (const status of ["pending", "suspended"]) {
    assert.equal(canAccessDealerPortal({ ...dealer, account: { ...dealer.account, status } }), false);
  }
});

test("loading and failed verification never render cached private dealer pages", () => {
  assert.equal(dealerAccessState({ data: dealer, isLoading: true, isError: false }), "loading");
  assert.equal(dealerAccessState({ data: dealer, isLoading: false, isError: true }), "error");
  assert.equal(dealerAccessState({ isLoading: false, isError: false }), "error");
  assert.equal(dealerAccessState({ data: null, isLoading: false, isError: false }), "error");
});

test("verified dealers continue normally and ineligible accounts retain account access", () => {
  assert.equal(dealerAccessState({ data: dealer, isLoading: false, isError: false }), "allowed");
  for (const session of [
    { ...dealer, authorized: false },
    { ...dealer, role: "customer" as const },
  ]) {
    assert.equal(dealerAccessState({ data: session, isLoading: false, isError: false }), "account");
  }
});

test("a failed bootstrap refresh with cached authorization stays locked until verification succeeds", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ["dealer-access-regression"];
  client.setQueryData(key, dealer);
  let rejectRefresh = true;
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => {
      if (rejectRefresh) throw new Error("Permission service unavailable");
      return dealer;
    },
  });

  try {
    assert.equal(dealerAccessState(observer.getCurrentResult()), "allowed");
    const failed = await observer.refetch();
    assert.equal(failed.data, dealer);
    assert.equal(failed.isError, true);
    assert.equal(dealerAccessState(failed), "error");
    rejectRefresh = false;
    assert.equal(dealerAccessState(await observer.refetch()), "allowed");
  } finally {
    client.clear();
  }
});

test("a refreshed bootstrap revocation overrides a previously approved dealer session", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ["dealer-revocation-regression"];
  client.setQueryData(key, dealer);
  const observer = new QueryObserver(client, {
    queryKey: key,
    queryFn: async () => ({ ...dealer, authorized: false }),
  });

  try {
    assert.equal(dealerAccessState(observer.getCurrentResult()), "allowed");
    assert.equal(dealerAccessState(await observer.refetch()), "account");
  } finally {
    client.clear();
  }
});
