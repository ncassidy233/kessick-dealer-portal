import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "vite";
import { appRelease } from "../../vite.app-release";
import { createAppUpdateCheck, publishedReleaseId } from "./app-updates";

test("real builds fingerprint CSS, public assets and HTML even when the JavaScript entry is unchanged", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "kessick-release-"));
  const previousCommit = process.env.RENDER_GIT_COMMIT;
  delete process.env.RENDER_GIT_COMMIT;
  try {
    await mkdir(path.join(root, "public"));
    const html = '<html><head><title>Portal</title><link rel="stylesheet" href="/style.css"></head><body><script type="module" src="/main.js"></script></body></html>';
    await writeFile(path.join(root, "index.html"), html);
    await writeFile(path.join(root, "main.js"), 'document.body.dataset.ready = "yes";');
    await writeFile(path.join(root, "public", "style.css"), "body { color: red; }");
    await writeFile(path.join(root, "public", "sw.js"), 'self.addEventListener("fetch", () => {});\n');
    await writeFile(path.join(root, "public", "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><title>Original</title></svg>');
    const compile = async () => {
      await build({ configFile: false, root, plugins: [appRelease()], logLevel: "silent", build: { minify: false } });
      const manifest = JSON.parse(await readFile(path.join(root, "dist", "app-version.json"), "utf8")) as {
        schemaVersion: number; entry: string; releaseId: string; commit?: string;
      };
      assert.equal(manifest.schemaVersion, 1);
      assert.match(manifest.releaseId, /^[a-f0-9]{64}$/);
      assert.equal(publishedReleaseId(await readFile(path.join(root, "dist", "index.html"), "utf8")), manifest.releaseId);
      assert.ok((await readFile(path.join(root, "dist", "sw.js"), "utf8")).endsWith(`// Application release: ${manifest.releaseId}\n`));
      return manifest;
    };
    const original = await compile();
    assert.deepEqual(await compile(), original, "identical builds must not create update churn");
    const changedRelease = async (previous: typeof original) => {
      const next = await compile();
      assert.equal(next.entry, original.entry, "fixture must exercise unchanged JavaScript");
      assert.notEqual(next.releaseId, previous.releaseId);
      let updates = 0;
      const checker = createAppUpdateCheck({ currentVersion: `/${previous.entry}`, currentReleaseId: previous.releaseId,
        baseUrl: "https://portal.example/", isVisible: () => true, onUpdate: () => updates++,
        fetcher: async () => Response.json(next),
      });
      await checker.check(); checker.stop();
      assert.equal(updates, 1);
      return next;
    };
    await writeFile(path.join(root, "public", "style.css"), "body { color: blue; }");
    const css = await changedRelease(original);
    await writeFile(path.join(root, "public", "logo.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><title>New logo</title></svg>');
    const asset = await changedRelease(css);
    await writeFile(path.join(root, "index.html"), html.replace("<title>Portal</title>", "<title>Latest portal</title>"));
    const document = await changedRelease(asset);
    process.env.RENDER_GIT_COMMIT = "c".repeat(40);
    const commit = await changedRelease(document);
    assert.equal(commit.commit, "c".repeat(40));
    assert.deepEqual(await compile(), commit, "commit metadata must also be deterministic");
  } finally {
    if (previousCommit === undefined) delete process.env.RENDER_GIT_COMMIT;
    else process.env.RENDER_GIT_COMMIT = previousCommit;
    await rm(root, { recursive: true, force: true });
  }
});
