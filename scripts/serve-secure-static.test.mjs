import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStaticServer } from "./serve-secure-static.mjs";

test("production static service protects files, routes, methods and headers", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "kessick-static-"));
  const root = path.join(tmp, "public");
  await mkdir(root);
  await writeFile(path.join(root, "index.html"), "<!doctype html><title>Portal</title>");
  await writeFile(path.join(tmp, "private.txt"), "not public");
  await symlink(path.join(tmp, "private.txt"), path.join(root, "leak.json"));
  const server = await createStaticServer(root);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${url}/portal/projects`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.doesNotMatch(response.headers.get("content-security-policy"), /unsafe-eval/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.match(response.headers.get("permissions-policy"), /camera=\(self\)/);
    for (const route of ["/.env", "/leak.json", "/api/account", "/__e2e/canvas", "/assets/missing.js", "/%2e%2e%2fprivate.txt", "/%ZZ"]) {
      assert.ok((await fetch(url + route)).status >= 400, route);
    }
    assert.equal((await fetch(url, { method: "POST", body: "unsafe" })).status, 405);
    assert.equal((await fetch(url, { method: "HEAD" })).status, 200);
    assert.match(await (await fetch(`${url}/robots.txt`)).text(), /Disallow: \//);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(tmp, { recursive: true, force: true });
  }
});