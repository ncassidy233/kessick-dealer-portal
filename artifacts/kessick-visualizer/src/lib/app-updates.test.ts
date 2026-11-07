import assert from "node:assert/strict";
import test from "node:test";
import { appEntryVersion, appReleaseId, createAppUpdateCheck, freshAppUrl, prepareAppUpdate, publishedEntryVersion, publishedManifestVersion, publishedReleaseId } from "./app-updates";

const baseUrl = "https://portal.example/preview/";
const entry = (version: string) => `<html><script type="module" crossorigin src="/preview/assets/index-${version}.js"></script></html>`;
const htmlResponse = (html: string) => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
const manifestResponse = (version: string) => Response.json({ schemaVersion: 1, entry: `assets/index-${version}.js` });

test("version checks use the entry bundle and preserve nested deployment paths", () => {
  assert.equal(appEntryVersion("/preview/assets/index-OLD_1.js?v=1", baseUrl), "/preview/assets/index-OLD_1.js");
  assert.equal(publishedEntryVersion(entry("NEW-2"), baseUrl), "/preview/assets/index-NEW-2.js");
  assert.equal(publishedEntryVersion("<script src='assets/index-a.js' type='module'></script>", baseUrl), "/preview/assets/index-a.js");
  assert.equal(appEntryVersion("https://another.example/preview/assets/index-a.js", baseUrl), null);
  assert.equal(appEntryVersion("/assets/index-a.js", baseUrl), null);
  for (const html of ["<h1>Service starting</h1>", "<script src='/preview/assets/index-a.js'></script>", "<script data-type='module' data-src='/preview/assets/index-a.js'></script>"]) {
    assert.equal(publishedEntryVersion(html, baseUrl), null);
  }
});

test("a suspended old app gets one update notice from the public, uncached release manifest", async () => {
  let updates = 0, reads = 0;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
    isVisible: () => true, onUpdate: () => updates++,
    fetcher: async (url, options) => {
      reads++;
      assert.equal(String(url), "https://portal.example/preview/app-version.json");
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.credentials, "omit");
      assert.equal(options?.redirect, "error");
      return manifestResponse("new");
    },
  });
  await checker.check(); await checker.check();
  assert.equal(updates, 1); assert.equal(reads, 1); checker.stop();
});

test("unchanged releases, failed deploy responses and offline checks do not interrupt work", async () => {
  let time = 0, calls = 0, updates = 0;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
    now: () => time, isVisible: () => true, onUpdate: () => updates++,
    fetcher: async (url) => {
      if (String(url).endsWith("app-version.json")) return new Response("Not found", { status: 404 });
      calls++;
      if (calls === 1) throw new TypeError("offline");
      if (calls === 2) return new Response("Unavailable", { status: 503 });
      if (calls === 3) return htmlResponse("<h1>Service starting</h1>");
      if (calls === 4) return htmlResponse(entry("old"));
      return htmlResponse(entry("new"));
    },
  });
  for (let i = 0; i < 5; i++) { await checker.check(); time += 5000; }
  assert.equal(calls, 5); assert.equal(updates, 1); checker.stop();
});

test("resume events coalesce, background checks pause, and disposed checks cannot show a notice", async () => {
  let visible = false, calls = 0, updates = 0;
  let finish!: (response: Response) => void;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
    isVisible: () => visible, onUpdate: () => updates++,
    fetcher: async () => { calls++; return new Promise<Response>(resolve => { finish = resolve; }); },
  });
  await checker.check(); assert.equal(calls, 0);
  visible = true;
  const pending = checker.check(); await checker.check(); assert.equal(calls, 1);
  checker.stop(); finish(htmlResponse(entry("new"))); await pending;
  assert.equal(updates, 0);
});

test("release manifests require the supported schema and a same-origin entry inside the app base", () => {
  assert.equal(publishedManifestVersion({ schemaVersion: 1, entry: "assets/index-new.js" }, baseUrl), "/preview/assets/index-new.js");
  for (const manifest of [null, {}, { schemaVersion: 2, entry: "assets/index-new.js" },
    { schemaVersion: 1, entry: 7 }, { schemaVersion: 1, entry: "https://other.example/preview/assets/index-new.js" },
    { schemaVersion: 1, entry: "/assets/index-new.js" }, { schemaVersion: 1, entry: "assets/chunk-new.js" }]) {
    assert.equal(publishedManifestVersion(manifest, baseUrl), null);
  }
});

test("invalid or missing release manifests fall back to the uncached entry document", async () => {
  const manifests = [
    () => new Response("Not found", { status: 404 }),
    () => htmlResponse("<h1>Service starting</h1>"),
    () => new Response("{invalid", { headers: { "content-type": "application/json" } }),
    () => Response.json({ schemaVersion: 2, entry: "assets/index-new.js" }),
  ];
  for (const manifest of manifests) {
    const reads: string[] = [], updates: string[] = [];
    const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
      isVisible: () => true, onUpdate: version => updates.push(version),
      fetcher: async (url, options) => {
        reads.push(String(url));
        assert.equal(options?.cache, "no-store");
        assert.equal(options?.credentials, "omit");
        assert.equal(options?.redirect, "error");
        return reads.length === 1 ? manifest() : htmlResponse(entry("new"));
      },
    });
    await checker.check(); checker.stop();
    assert.deepEqual(reads, ["https://portal.example/preview/app-version.json", "https://portal.example/preview/index.html"]);
    assert.deepEqual(updates, ["/preview/assets/index-new.js"]);
  }
});

test("an unchanged valid manifest skips HTML fallback and repeated resume events are throttled", async () => {
  let time = 0, calls = 0, updates = 0;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
    now: () => time, isVisible: () => true, onUpdate: () => updates++,
    fetcher: async (url) => {
      calls++;
      assert.equal(String(url), "https://portal.example/preview/app-version.json");
      return manifestResponse("old");
    },
  });
  await checker.check(); time = 4999; await checker.check();
  assert.equal(calls, 1);
  time = 5000; await checker.check(); checker.stop();
  assert.equal(calls, 2); assert.equal(updates, 0);
});

test("whole-release fingerprints detect changes with an unchanged entry without breaking legacy clients", async () => {
  const oldRelease = "a".repeat(64), newRelease = "b".repeat(64);
  for (const [currentReleaseId, releaseId, expected] of [
    [oldRelease, newRelease, 1], [oldRelease, oldRelease, 0],
    [undefined, newRelease, 0], [oldRelease, undefined, 0], [oldRelease, "invalid", 0],
  ] as const) {
    let updates = 0;
    const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-same.js", currentReleaseId,
      baseUrl, isVisible: () => true, onUpdate: () => updates++,
      fetcher: async () => Response.json({ schemaVersion: 1, entry: "assets/index-same.js", releaseId }),
    });
    await checker.check(); await checker.check(); checker.stop();
    assert.equal(updates, expected);
  }
});

test("HTML fallback detects a whole-release change and rejects malformed fingerprint metadata", async () => {
  const oldRelease = "a".repeat(64), newRelease = "b".repeat(64);
  const meta = `<meta content='${newRelease}' name='kessick-release'>`;
  assert.equal(publishedReleaseId(meta), newRelease);
  assert.equal(publishedReleaseId(`<meta data-name='kessick-release' content='${newRelease}'>`), null);
  assert.equal(publishedReleaseId("<meta name='kessick-release' content='invalid'>"), null);
  for (const value of [null, 1, "a".repeat(63), "g".repeat(64)]) assert.equal(appReleaseId(value), null);
  let updates = 0;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-same.js", currentReleaseId: oldRelease,
    baseUrl, isVisible: () => true, onUpdate: () => updates++,
    fetcher: async url => String(url).endsWith("app-version.json")
      ? new Response("Not found", { status: 404 }) : htmlResponse(meta + entry("same")),
  });
  await checker.check(); checker.stop();
  assert.equal(updates, 1);
});

test("Update now uses a fresh same-origin document and preserves the current route and filters", () => {
  assert.equal(freshAppUrl("https://portal.example/preview/admin/page-studio?section=login#draft", baseUrl, "new"),
    "https://portal.example/preview/admin/page-studio?section=login&_kessick_update=new#draft");
  assert.equal(freshAppUrl("https://portal.example/preview/portal?_kessick_update=old", baseUrl, "new"),
    "https://portal.example/preview/portal?_kessick_update=new");
  for (const href of ["https://other.example/preview/portal", "https://portal.example/outside"]) {
    assert.equal(freshAppUrl(href, baseUrl, "new"), "https://portal.example/preview/?_kessick_update=new");
  }
});

test("a removed lazy chunk can force a check immediately after an unchanged release check", async () => {
  let calls = 0, updates = 0;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
    now: () => 0, isVisible: () => true, onUpdate: () => updates++,
    fetcher: async () => manifestResponse(++calls === 1 ? "old" : "new"),
  });
  await checker.check();
  await checker.check();
  assert.equal(calls, 1);
  await checker.check({ force: true });
  assert.equal(calls, 2);
  assert.equal(updates, 1);
  checker.stop();
});

test("disposing a check releases a stalled request even when the network ignores its abort signal", async () => {
  let calls = 0, updates = 0;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
    isVisible: () => true, onUpdate: () => updates++,
    fetcher: async () => { calls++; return new Promise<Response>(() => {}); },
  });
  const pending = checker.check();
  checker.stop();
  await pending;
  assert.equal(calls, 1);
  assert.equal(updates, 0);
});

test("Update now waits for the replacement worker to activate and removes its listener", async () => {
  let listener: (() => void) | undefined;
  let workerState = "installed";
  let updates = 0;
  const worker = {
    get state() { return workerState; },
    addEventListener(_type: string, value: () => void) { listener = value; },
    removeEventListener(_type: string, value: () => void) { if (listener === value) listener = undefined; },
  };
  const ready = prepareAppUpdate({ register: async (url, options) => {
    assert.equal(url, "https://portal.example/preview/sw.js");
    assert.deepEqual(options, { scope: "/preview/", updateViaCache: "none" });
    return { installing: worker, waiting: null, update: async () => { updates++; } } as unknown as ServiceWorkerRegistration;
  } }, baseUrl);
  await Promise.resolve(); await Promise.resolve();
  assert.ok(listener);
  workerState = "activated";
  listener();
  await ready;
  assert.equal(listener, undefined);
  assert.equal(updates, 1);
});

test("a blocked or stalled service worker cannot indefinitely block an explicit update", async () => {
  await prepareAppUpdate(undefined, baseUrl);
  await prepareAppUpdate({ register: async () => { throw new Error("Workers blocked"); } }, baseUrl);
  await prepareAppUpdate({ register: async () => new Promise<ServiceWorkerRegistration>(() => {}) }, baseUrl, 1);
  await prepareAppUpdate({ register: async () => ({
    update: () => new Promise(() => {}),
  }) as unknown as ServiceWorkerRegistration }, baseUrl, 1);
});
