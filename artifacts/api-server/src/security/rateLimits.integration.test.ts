import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { apiRateLimit } from "./rateLimits";

test("API limiter returns 429 and Retry-After after the actual IP budget", async () => {
  const app = express();
  app.use(apiRateLimit);
  app.get("/probe", (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/probe`;
  try {
    for (let n = 0; n < 300; n++) {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      await response.arrayBuffer();
    }
    const blocked = await fetch(url);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
    assert.deepEqual(await blocked.json(), { error: "Request limit reached. Try again later." });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});