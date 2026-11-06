import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { createSessionRecovery, installSessionFocusRecovery, retryAccessRead } from "./access-recovery";
import { dealerAccessState } from "./dealer-access";

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test("mobile resume renews the cookie before refetch and coalesces browser events", async () => {
  const win = new EventTarget(), doc = new EventTarget();
  let visible = false, refreshes = 0;
  let renew!: () => void;
  const states: boolean[] = [];
  const cleanup = installSessionFocusRecovery({ windowTarget: win, documentTarget: doc,
    isVisible: () => visible, onFocus: value => states.push(value),
    refreshSession: () => { refreshes++; return new Promise<void>(resolve => { renew = resolve; }); },
  });
  visible = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  win.dispatchEvent(new Event("focus"));
  win.dispatchEvent(new Event("pageshow"));
  await tick();
  assert.equal(refreshes, 1);
  assert.equal(states.includes(true), false);
  // A second minimize/restore during renewal must not leave focus stuck false.
  visible = false; doc.dispatchEvent(new Event("visibilitychange"));
  visible = true; doc.dispatchEvent(new Event("visibilitychange"));
  renew(); await tick();
  assert.equal(states.at(-1), true);
  cleanup(); win.dispatchEvent(new Event("focus")); await tick();
  assert.equal(refreshes, 1);
});

test("a hidden or disposed app cannot refetch after an old renewal finishes", async () => {
  for (const dispose of [false, true]) {
    const win = new EventTarget(), doc = new EventTarget();
    let visible = true, renew!: () => void;
    const states: boolean[] = [];
    const cleanup = installSessionFocusRecovery({ windowTarget: win, documentTarget: doc,
      isVisible: () => visible, onFocus: value => states.push(value),
      refreshSession: () => new Promise<void>(resolve => { renew = resolve; }),
    });
    win.dispatchEvent(new Event("focus")); await tick();
    if (dispose) cleanup(); else { visible = false; doc.dispatchEvent(new Event("visibilitychange")); }
    renew(); await tick(); assert.equal(states.includes(true), false); cleanup();
  }
});

test("a renewal failure still permits real server verification and never grants access", async () => {
  const win = new EventTarget(), doc = new EventTarget();
  const states: boolean[] = [];
  const cleanup = installSessionFocusRecovery({ windowTarget: win, documentTarget: doc,
    isVisible: () => true, onFocus: value => states.push(value),
    refreshSession: async () => { throw new TypeError("Network unavailable"); },
  });
  win.dispatchEvent(new Event("online")); await tick();
  assert.deepEqual(states, [false, true]);
  assert.equal(dealerAccessState({ isLoading: false, isError: true }), "error"); cleanup();
});

test("a stalled wake-up refresh cannot leave account reads paused indefinitely", async () => {
  const win = new EventTarget(), doc = new EventTarget();
  const states: boolean[] = [];
  const cleanup = installSessionFocusRecovery({ windowTarget: win, documentTarget: doc,
    isVisible: () => true, onFocus: value => states.push(value), timeoutMs: 5,
    refreshSession: () => new Promise(() => {}),
  });
  try {
    win.dispatchEvent(new Event("focus"));
    await new Promise(resolve => setTimeout(resolve, 15));
    assert.deepEqual(states, [false, true]);
  } finally { cleanup(); }
});

test("concurrent access failures share a bounded renewal and can recover after a timeout", async () => {
  let attempts = 0;
  const recover = createSessionRecovery(() => ++attempts === 1
    ? new Promise(() => {}) : Promise.resolve("fresh-session-token"), 5);
  const first = recover();
  assert.equal(recover(), first);
  assert.equal(await first, false);
  assert.equal(attempts, 1);
  assert.equal(await recover(), true);
  assert.equal(attempts, 2);
  assert.equal(await createSessionRecovery(async () => null)(), false);
});

test("read recovery is bounded and does not retry permission denials", () => {
  for (const status of [401, 408, 429, 500, 502, 503, 504]) {
    assert.equal(retryAccessRead(0, { status }), true);
    assert.equal(retryAccessRead(2, { status }), false);
  }
  for (const status of [400, 403, 404, 422]) assert.equal(retryAccessRead(0, { status }), false);
  assert.equal(retryAccessRead(0, new TypeError("fetch failed")), true);
  assert.equal(retryAccessRead(0, new Error("Invalid access")), false);
});

test("a stale-cookie read retries automatically while cached dealer pages stay locked", async () => {
  const client = new QueryClient();
  const data = { role: "dealer" as const, authorized: true,
    account: { id: "dealer", email: "qa@example.invalid", status: "approved" } };
  const key = ["resume-regression"];
  client.setQueryData(key, data);
  let attempts = 0;
  const states: string[] = [];
  const observer = new QueryObserver(client, { queryKey: key, retry: retryAccessRead,
    retryDelay: 1, staleTime: Infinity,
    queryFn: async () => { if (++attempts === 1) throw { status: 401 }; return data; },
  });
  const unsubscribe = observer.subscribe(result => { if (result.failureCount) states.push(dealerAccessState(result)); });
  try {
    const recovered = await observer.refetch();
    assert.equal(attempts, 2);
    assert.ok(states.includes("loading"));
    assert.equal(states.includes("allowed"), false);
    assert.equal(dealerAccessState(recovered), "allowed");
  } finally { unsubscribe(); client.clear(); }
});
