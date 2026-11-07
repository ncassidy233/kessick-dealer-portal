import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate } from "node:timers/promises";
import test from "node:test";
import vm from "node:vm";

const workerSource = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const updateSource = readFileSync(new URL("../../public/app-update.js", import.meta.url), "utf8");
const startSource = readFileSync(new URL("../../public/app-start.js", import.meta.url), "utf8");
const base = "https://portal.example/app/";

type TestClient = {
  id: string;
  url: string;
  visibilityState: string;
  frameType: string;
  acknowledge?: boolean;
  postMessage?: (message: unknown) => void;
  navigate?: (url: string) => Promise<void>;
};

function workerHarness(clients: TestClient[]) {
  const listeners = new Map<string, (event: any) => void>();
  const timers: (() => void)[] = [];
  const navigations: { id: string; url: string }[] = [];
  const messages: { id: string; type: string }[] = [];
  const removedCaches: string[] = [];
  let claimed = false;
  for (const client of clients) {
    client.postMessage = (message: any) => {
      messages.push({ id: client.id, type: message.type });
      if (client.acknowledge) listeners.get("message")!({ data: { type: "KESSICK_UPDATE_CLIENT" }, source: client });
    };
    client.navigate = async url => { navigations.push({ id: client.id, url }); };
  }
  vm.runInNewContext(workerSource, {
    URL, Response, console,
    setTimeout: (callback: () => void) => { timers.push(callback); return timers.length; },
    self: {
      location: { origin: "https://portal.example" },
      registration: { scope: base },
      addEventListener: (type: string, callback: (event: any) => void) => listeners.set(type, callback),
      skipWaiting: async () => {},
      clients: {
        claim: async () => { claimed = true; },
        matchAll: async () => clients,
        get: async (id: string) => clients.find(client => client.id === id),
      },
    },
    caches: {
      keys: async () => ["kessick-portal-v1", "kessick-portal-old", "unrelated-app", "saved-drafts"],
      delete: async (name: string) => { removedCaches.push(name); return true; },
    },
  });
  return {
    clients, messages, navigations, removedCaches, timers,
    get claimed() { return claimed; },
    async activate(beforeMigration?: () => void) {
      let operation!: Promise<void>;
      listeners.get("activate")!({ waitUntil: (promise: Promise<void>) => { operation = promise; } });
      await setImmediate();
      beforeMigration?.();
      for (const timer of timers.splice(0)) timer();
      await operation;
    },
  };
}

const legacyClient = (id: string, path: string, extra: Partial<TestClient> = {}): TestClient => ({
  id, url: new URL(path, base).href, frameType: "top-level", visibilityState: "hidden", ...extra,
});

test("pre-updater homes reach a standalone prompt on open while current clients only receive a notice", async () => {
  const harness = workerHarness([
    legacyClient("legacy", ""),
    legacyClient("current", "", { acknowledge: true }),
    legacyClient("retired", "portal/preview"),
    legacyClient("visible", "", { visibilityState: "visible" }),
  ]);
  await harness.activate();
  assert.equal(harness.claimed, true);
  assert.deepEqual(harness.removedCaches.sort(), ["kessick-portal-old", "kessick-portal-v1"]);
  assert.deepEqual(harness.navigations.map(item => item.id), ["legacy", "retired", "visible"]);
  for (const item of harness.navigations) {
    const target = new URL(item.url);
    assert.equal(target.origin + target.pathname, base + "app-update.html");
    assert.equal(target.searchParams.get("returnTo"), item.id === "retired" ? "/app/portal" : "/app/");
  }
  assert.equal(harness.messages.filter(item => item.type === "KESSICK_RELEASE_READY").length, 4);
});

test("legacy migration never interrupts editing, sign-in, iframe, or hash-form clients", async () => {
  const harness = workerHarness([
    legacyClient("editor", "admin/page-studio?section=login", { visibilityState: "visible" }),
    legacyClient("auth", "sign-in"),
    legacyClient("account", "portal/account"),
    legacyClient("form", "#design-request"),
    legacyClient("iframe", "", { frameType: "nested" }),
    legacyClient("other-scope", "https://portal.example/other/"),
    legacyClient("other-origin", "https://other.example/app/"),
  ]);
  await harness.activate();
  assert.deepEqual(harness.navigations, []);
  assert.equal(harness.timers.length, 0);
});

test("a legacy client that opens a form during its handshake is left in place", async () => {
  const client = legacyClient("returning", "");
  const harness = workerHarness([client]);
  await harness.activate(() => { client.url = base + "#design-request"; });
  assert.deepEqual(harness.navigations, []);
});

function updateHarness(returnTo: string, online = true, fragment = "") {
  const actions = new Map<string, () => unknown>();
  const navigations: string[] = [];
  const button = { disabled: false, addEventListener: (type: string, action: () => unknown) => actions.set(type, action) };
  const status = { textContent: "Ready to update." };
  const navigator = { onLine: online };
  const onlineEvents: (() => void)[] = [];
  let pendingTimers = 0;
  vm.runInNewContext(updateSource, {
    URL, console, navigator,
    setTimeout: (callback: () => void, timeout: number) => { pendingTimers++; return setTimeout(callback, timeout); },
    clearTimeout: (timer: ReturnType<typeof setTimeout> | undefined) => { if (timer) pendingTimers--; clearTimeout(timer); },
    document: {
      currentScript: { src: base + "app-update.js" },
      getElementById: (id: string) => id === "update-now" ? button : status,
    },
    window: {
      location: {
        href: base + "app-update.html?returnTo=" + encodeURIComponent(returnTo) + fragment,
        replace: (url: string) => navigations.push(url),
      },
      addEventListener: (type: string, action: () => void) => { if (type === "online") onlineEvents.push(action); },
    },
  });
  return { button, status, navigator, navigations, onlineEvents,
    get pendingTimers() { return pendingTimers; },
    click: async () => { await actions.get("click")!(); },
  };
}

test("the plain update prompt preserves the application route and does not reload until Update now", async () => {
  const harness = updateHarness("/app/admin/page-studio?section=login#draft");
  assert.deepEqual(harness.navigations, []);
  await harness.click();
  const target = new URL(harness.navigations[0]);
  assert.equal(target.origin + target.pathname, base + "admin/page-studio");
  assert.equal(target.searchParams.get("section"), "login");
  assert.equal(target.hash, "#draft");
  assert.ok(target.searchParams.get("_kessick_update"));
  assert.equal(harness.pendingTimers, 0);
  await harness.click();
  assert.equal(harness.navigations.length, 1);
});

test("the plain prompt carries client-side fragments back without turning them into server query parameters", async () => {
  const harness = updateHarness("/app/portal?section=resources", true, "#client-only");
  await harness.click();
  const target = new URL(harness.navigations[0]);
  assert.equal(target.hash, "#client-only");
  assert.equal(target.searchParams.get("section"), "resources");
  assert.equal(target.search.includes("client-only"), false);
});

test("update return links cannot leave the portal scope, open API/files, or loop to the prompt", async () => {
  for (const destination of ["https://other.example/app/", "//other.example/", "/other/portal", "/app/api/users",
    "/app/%61pi/users", "/app/app-update.html", "/app/file.pdf", "/app/%2e%2e/other", "/app/%E0%A4%A"]) {
    const harness = updateHarness(destination);
    await harness.click();
    const target = new URL(harness.navigations[0]);
    assert.equal(target.origin + target.pathname, base + "portal", destination);
  }
  const retired = updateHarness("/app/portal/preview#resources");
  await retired.click();
  const target = new URL(retired.navigations[0]);
  assert.equal(target.pathname, "/app/portal");
  assert.equal(target.hash, "");
});

test("the update prompt remains usable offline and retries when connectivity returns", async () => {
  const harness = updateHarness("/app/portal", false);
  await harness.click();
  assert.deepEqual(harness.navigations, []);
  assert.equal(harness.button.disabled, false);
  assert.match(harness.status.textContent, /offline/i);
  harness.navigator.onLine = true;
  for (const handler of harness.onlineEvents) handler();
  await harness.click();
  assert.equal(harness.navigations.length, 1);
});

test("the bootstrap registers the replacement worker and acknowledges updates without waiting for React", async () => {
  const listeners = new Map<string, (event?: any) => void>();
  const workerMessages: unknown[] = [];
  const registrations: { url: string; options: unknown }[] = [];
  let cleanUrl = "", workerUpdates = 0;
  const controller = { postMessage: (message: unknown) => workerMessages.push(message) };
  const worker = {
    controller,
    addEventListener: (type: string, action: (event?: any) => void) => listeners.set(type, action),
    register: async (url: string, options: unknown) => {
      registrations.push({ url, options });
      return { update: async () => { workerUpdates++; } };
    },
  };
  const window: any = {
    isSecureContext: true,
    location: { href: base + "portal?section=resources&_kessick_update=new#details" },
    history: { state: { keep: true }, replaceState: (_state: unknown, _title: string, url: string) => { cleanUrl = url; } },
    addEventListener: (type: string, action: (event?: any) => void) => listeners.set(type, action),
  };
  window.self = window;
  window.top = window;
  vm.runInNewContext(startSource, {
    URL, AbortController, setTimeout, clearTimeout, window,
    navigator: { onLine: true, serviceWorker: worker },
    document: { currentScript: { src: base + "app-start.js" }, visibilityState: "visible", addEventListener: () => {} },
  });
  await setImmediate();
  assert.equal(registrations[0].url, base + "sw.js");
  assert.equal((registrations[0].options as any).updateViaCache, "none");
  assert.equal(workerUpdates, 1);
  assert.equal(cleanUrl, base + "portal?section=resources#details");
  listeners.get("message")!({ data: { type: "KESSICK_RELEASE_READY" }, source: controller });
  assert.ok(workerMessages.length >= 2);
  assert.ok(workerMessages.every((message: any) => message.type === "KESSICK_UPDATE_CLIENT"));
});
