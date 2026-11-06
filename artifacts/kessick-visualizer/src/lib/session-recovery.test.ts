import assert from "node:assert/strict";
import test from "node:test";
import { ApiError, customFetch, setSessionRecovery } from "../../../../lib/api-client-react/src/custom-fetch";

async function withBrowser(run: () => Promise<void>) {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true,
    value: { location: new URL("https://portal.example/portal") } });
  try { await run(); } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
}

const reply = (status: number) => new Response(JSON.stringify({ status }), {
  status, headers: { "content-type": "application/json" },
});

test("an expired access cookie is renewed before exactly one same-origin read retry", async () => {
  await withBrowser(async () => {
    for (const path of ["/api/account", "/api/portal-v2/bootstrap?staffDealerView=example", "/api/dealer-portal/access"]) {
      let reads = 0, renewals = 0;
      const unregister = setSessionRecovery(async () => { renewals++; return true; });
      globalThis.fetch = async (_input, init) => {
        assert.equal(new Headers(init?.headers).has("authorization"), false);
        reads++;
        if (reads === 1) return reply(401);
        assert.equal(renewals, 1);
        return reply(200);
      };
      try {
        assert.deepEqual(await customFetch(path), { status: 200 });
        assert.equal(reads, 2);
        assert.equal(renewals, 1);
      } finally { unregister(); }
    }
  });
});

test("real expired sessions remain denied after one retry or a failed renewal", async () => {
  await withBrowser(async () => {
    for (const outcome of ["fresh", "expired", "unavailable"] as const) {
      let reads = 0, renewals = 0;
      const unregister = setSessionRecovery(async () => {
        renewals++;
        if (outcome === "unavailable") throw new Error("offline");
        return outcome === "fresh";
      });
      globalThis.fetch = async () => { reads++; return reply(401); };
      try {
        await assert.rejects(customFetch("/api/account"), error => error instanceof ApiError && error.status === 401);
        assert.equal(reads, outcome === "fresh" ? 2 : 1);
        assert.equal(renewals, 1);
      } finally { unregister(); }
    }
  });
});

test("permission denials, writes, external requests and other reads never trigger renewal or replay", async () => {
  await withBrowser(async () => {
    const cases = [
      { path: "/api/account", status: 403 },
      { path: "/api/account", status: 401, options: { method: "POST", body: "{}" } },
      { path: "/api/account", status: 401, options: { method: "PATCH", body: "{}" } },
      { path: "/api/account", status: 401, options: { method: "DELETE" } },
      { path: "https://other.example/api/account", status: 401 },
      { path: "/api/portal-v2/content", status: 401 },
      { path: "/api/account", status: 401, options: { headers: { authorization: "Bearer explicit" } } },
      { path: "/api/account", status: 401, options: { credentials: "omit" as const } },
    ];
    for (const { path, status, options } of cases) {
      let reads = 0, renewals = 0;
      const unregister = setSessionRecovery(async () => { renewals++; return true; });
      globalThis.fetch = async () => { reads++; return reply(status); };
      try {
        await assert.rejects(customFetch(path, options), error => error instanceof ApiError && error.status === status);
        assert.equal(reads, 1, path);
        assert.equal(renewals, 0, path);
      } finally { unregister(); }
    }
  });
});

test("sign-out, account switching and cancelled reads cannot replay a stale request", async () => {
  await withBrowser(async () => {
    for (const cancel of ["sign-out", "account-switch", "abort"] as const) {
      let reads = 0, release!: (fresh: boolean) => void;
      const controller = new AbortController();
      const unregister = setSessionRecovery(() => new Promise(resolve => { release = resolve; }));
      let unregisterNext = () => {};
      globalThis.fetch = async () => { reads++; return reply(401); };
      try {
        const request = customFetch("/api/account", { signal: controller.signal });
        await new Promise(resolve => setTimeout(resolve, 0));
        if (cancel === "abort") controller.abort();
        else if (cancel === "sign-out") unregister();
        else {
          unregisterNext = setSessionRecovery(async () => true);
          unregister(); // Older effect cleanup must not clear the new account's callback.
        }
        release(true);
        await assert.rejects(request, error => error instanceof ApiError && error.status === 401);
        assert.equal(reads, 1);
        if (cancel === "account-switch") {
          globalThis.fetch = async () => reply(++reads === 2 ? 401 : 200);
          assert.deepEqual(await customFetch("/api/account"), { status: 200 });
          assert.equal(reads, 3);
        }
      } finally { unregister(); unregisterNext(); }
    }
  });
});
