import assert from "node:assert/strict";
import test from "node:test";
import { installPublishedBrandingRefresh, notifyPublishedPortalBranding } from "./public-branding-refresh";

const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test("published presentation updates while visible and when an installed app returns", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const win = new EventTarget(), doc = new EventTarget();
  let visible = true, published = "first", reads = 0;
  const seen: string[] = [];
  const cleanup = installPublishedBrandingRefresh({
    windowTarget: win, documentTarget: doc, isVisible: () => visible,
    read: async () => { reads++; return published; }, onValue: value => seen.push(value),
  });
  try {
    await settle();
    assert.deepEqual(seen, ["first"]);
    published = "published on another device";
    t.mock.timers.tick(30_000);
    await settle();
    assert.equal(seen.at(-1), published);
    visible = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    t.mock.timers.tick(60_000);
    win.dispatchEvent(new Event("pageshow"));
    await settle();
    assert.equal(reads, 2, "hidden apps do not poll");
    published = "published while away";
    visible = true;
    win.dispatchEvent(new Event("pageshow"));
    await settle();
    assert.equal(seen.at(-1), published);
    for (const event of ["focus", "online"]) {
      win.dispatchEvent(new Event(event));
      await settle();
    }
    assert.equal(reads, 5);
  } finally { cleanup(); }
});

test("a frozen background request cannot block recovery or overwrite newer branding", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const win = new EventTarget(), doc = new EventTarget();
  let visible = true;
  const pending: { signal: AbortSignal; resolve: (value: string) => void }[] = [];
  const seen: string[] = [];
  const cleanup = installPublishedBrandingRefresh({
    windowTarget: win, documentTarget: doc, isVisible: () => visible,
    read: signal => new Promise<string>(resolve => pending.push({ signal, resolve })),
    onValue: value => seen.push(value),
  });
  try {
    await settle();
    visible = false;
    doc.dispatchEvent(new Event("visibilitychange"));
    assert.equal(pending[0].signal.aborted, true);
    visible = true;
    doc.dispatchEvent(new Event("visibilitychange"));
    await settle();
    assert.equal(pending.length, 2);
    pending[1].resolve("new publication");
    await settle();
    pending[0].resolve("old publication");
    await settle();
    assert.deepEqual(seen, ["new publication"]);

    win.dispatchEvent(new Event("pageshow"));
    await settle();
    t.mock.timers.tick(10_000);
    assert.equal(pending[2].signal.aborted, true, "each read has a bounded timeout");
    t.mock.timers.tick(20_000);
    await settle();
    assert.equal(pending.length, 4, "a timed-out read does not block periodic recovery");
    pending[3].resolve("recovered publication");
    await settle();
    assert.equal(seen.at(-1), "recovered publication");
  } finally { cleanup(); }
});

test("a successful publication refreshes this tab and signals other tabs without sharing draft content", async () => {
  const win = new EventTarget(), doc = new EventTarget();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const writes: [string, string][] = [];
  Object.defineProperty(globalThis, "window", { configurable: true, value: Object.assign(win, {
    localStorage: { setItem: (key: string, value: string) => { writes.push([key, value]); } },
  }) });
  let reads = 0;
  const cleanup = installPublishedBrandingRefresh({
    windowTarget: win, documentTarget: doc, isVisible: () => true,
    read: async () => ++reads, onValue: () => {},
  });
  try {
    await settle();
    notifyPublishedPortalBranding();
    await settle();
    assert.equal(reads, 2);
    assert.equal(writes.length, 1);
    assert.match(writes[0][1], /^\d+-0\.\d+$/);
    win.dispatchEvent(Object.assign(new Event("storage"), { key: "unrelated" }));
    await settle();
    assert.equal(reads, 2);
    win.dispatchEvent(Object.assign(new Event("storage"), { key: writes[0][0] }));
    await settle();
    assert.equal(reads, 3);
    (win as EventTarget & { localStorage: { setItem: () => void } }).localStorage.setItem = () => { throw new Error("storage disabled"); };
    assert.doesNotThrow(() => notifyPublishedPortalBranding());
    await settle();
    assert.equal(reads, 4, "same-tab refresh also works when storage is unavailable");
  } finally {
    cleanup();
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});

test("failed reads retain the published value and cleanup cancels work without late updates", async t => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const win = new EventTarget(), doc = new EventTarget();
  let reads = 0, finish!: (value: string) => void, signal!: AbortSignal;
  const seen: string[] = [];
  const cleanup = installPublishedBrandingRefresh({
    windowTarget: win, documentTarget: doc, isVisible: () => true,
    read: async requestSignal => {
      reads++;
      if (reads === 1) return "published";
      if (reads === 2) throw new Error("offline");
      signal = requestSignal;
      return new Promise<string>(resolve => { finish = resolve; });
    },
    onValue: value => seen.push(value),
  });
  await settle();
  win.dispatchEvent(new Event("focus"));
  await settle();
  assert.deepEqual(seen, ["published"]);
  win.dispatchEvent(new Event("online"));
  await settle();
  cleanup();
  assert.equal(signal.aborted, true);
  finish("late result");
  win.dispatchEvent(new Event("pageshow"));
  doc.dispatchEvent(new Event("visibilitychange"));
  t.mock.timers.tick(60_000);
  await settle();
  assert.equal(reads, 3);
  assert.deepEqual(seen, ["published"]);
});
