import assert from "node:assert/strict";
import test from "node:test";
import { appEntryVersion, createAppUpdateCheck, publishedEntryVersion } from "./app-updates";

const baseUrl = "https://portal.example/preview/";
const entry = (version: string) => `<html><script type="module" crossorigin src="/preview/assets/index-${version}.js"></script></html>`;
const htmlResponse = (html: string) => new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });

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

test("a suspended old app gets one update notice from the public, uncached entry document", async () => {
  let updates = 0, reads = 0;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
    isVisible: () => true, onUpdate: () => updates++,
    fetcher: async (url, options) => {
      reads++;
      assert.equal(String(url), "https://portal.example/preview/index.html");
      assert.equal(options?.cache, "no-store");
      assert.equal(options?.credentials, "omit");
      return htmlResponse(entry("new"));
    },
  });
  await checker.check(); await checker.check();
  assert.equal(updates, 1); assert.equal(reads, 1); checker.stop();
});

test("unchanged releases, failed deploy responses and offline checks do not interrupt work", async () => {
  let time = 0, calls = 0, updates = 0;
  const checker = createAppUpdateCheck({ currentVersion: "/preview/assets/index-old.js", baseUrl,
    now: () => time, isVisible: () => true, onUpdate: () => updates++,
    fetcher: async () => {
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
