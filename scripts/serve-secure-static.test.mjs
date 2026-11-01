import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, writeFile, mkdir, symlink, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createStaticServer,
  normalizeApiOrigin,
} from "./serve-secure-static.mjs";

test("production static service protects files, routes, methods and headers", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "kessick-static-"));
  const root = path.join(tmp, "public");
  await mkdir(root);
  await writeFile(
    path.join(root, "index.html"),
    "<!doctype html><title>Portal</title>",
  );
  await writeFile(path.join(tmp, "private.txt"), "not public");
  await symlink(path.join(tmp, "private.txt"), path.join(root, "leak.json"));
  const server = await createStaticServer(root);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${url}/portal/projects`);
    assert.equal(response.status, 200);
    assert.match(
      response.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
    assert.doesNotMatch(
      response.headers.get("content-security-policy"),
      /unsafe-eval/,
    );
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.match(response.headers.get("x-robots-tag"), /noindex/);
    assert.match(response.headers.get("permissions-policy"), /camera=\(self\)/);
    for (const route of [
      "/.env",
      "/leak.json",
      "/api/account",
      "/__e2e/canvas",
      "/assets/missing.js",
      "/%2e%2e%2fprivate.txt",
      "/%ZZ",
    ]) {
      assert.ok((await fetch(url + route)).status >= 400, route);
    }
    assert.equal(
      (await fetch(url, { method: "POST", body: "unsafe" })).status,
      405,
    );
    assert.equal((await fetch(url, { method: "HEAD" })).status, 200);
    assert.match(
      await (await fetch(`${url}/robots.txt`)).text(),
      /Disallow: \//,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(tmp, { recursive: true, force: true });
  }
});

test("API_ORIGIN accepts secure origins and rejects unsafe URLs", () => {
  assert.equal(
    normalizeApiOrigin("api.example.com").origin,
    "https://api.example.com",
  );
  assert.equal(
    normalizeApiOrigin("http://127.0.0.1:3000").origin,
    "http://127.0.0.1:3000",
  );
  for (const value of [
    "http://api.example.com",
    `https://${"user"}:${"pass"}@api.example.com`,
    "https://api.example.com/api",
    "https://api.example.com?debug=1",
  ]) {
    assert.throws(() => normalizeApiOrigin(value), /API_ORIGIN/);
  }
  assert.equal(normalizeApiOrigin(undefined), null);
});

test("production static service proxies same-origin API requests", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "kessick-static-api-"));
  const root = path.join(tmp, "public");
  await mkdir(root);
  await writeFile(
    path.join(root, "index.html"),
    "<!doctype html><title>Portal</title>",
  );
  let apiRequest;
  const api = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    apiRequest = {
      method: req.method,
      url: req.url,
      host: req.headers.host,
      forwardedHost: req.headers["x-forwarded-host"],
      forwardedProto: req.headers["x-forwarded-proto"],
      forwardedFor: req.headers["x-forwarded-for"],
      cookie: req.headers.cookie,
      csrf: req.headers["x-kessick-csrf"],
      body: Buffer.concat(chunks).toString(),
    };
    res.writeHead(201, {
      "Content-Type": "application/json",
      "Set-Cookie": "portal-session=example; HttpOnly; Secure",
      "Content-Security-Policy": "default-src 'none'",
      "X-Frame-Options": "SAMEORIGIN",
      Connection: "close",
    });
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => api.listen(0, "127.0.0.1", resolve));
  const apiAddress = api.address();
  const server = await createStaticServer(
    root,
    "/",
    `http://127.0.0.1:${apiAddress.port}`,
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(`${url}/api/portal-v2/bootstrap?test=1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "session=value",
        "X-Kessick-CSRF": "1",
      },
      body: JSON.stringify({ projectId: "scoped" }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { ok: true });
    assert.match(response.headers.get("set-cookie"), /HttpOnly/);
    assert.match(
      response.headers.get("content-security-policy"),
      /frame-ancestors 'none'/,
    );
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(apiRequest.method, "POST");
    assert.equal(apiRequest.url, "/api/portal-v2/bootstrap?test=1");
    assert.match(apiRequest.host, /^127\.0\.0\.1:/);
    assert.equal(
      apiRequest.forwardedHost,
      `127.0.0.1:${server.address().port}`,
    );
    assert.equal(apiRequest.forwardedProto, "https");
    assert.equal(apiRequest.forwardedFor, "127.0.0.1");
    assert.equal(apiRequest.cookie, "session=value");
    assert.equal(apiRequest.csrf, "1");
    assert.deepEqual(JSON.parse(apiRequest.body), { projectId: "scoped" });
  } finally {
    await Promise.all([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => api.close(resolve)),
    ]);
    await rm(tmp, { recursive: true, force: true });
  }
});
