import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { gzipSync } from "node:zlib";
import { payloadBudget, payloadWithinBudget } from "./payloadBudget";

test("request budgets reject deep and wide trees before schema validation", () => {
  let deep: unknown = "end";
  for (let i = 0; i < 34; i++) deep = { child: deep };
  assert.equal(payloadWithinBudget(deep), false);
  assert.equal(payloadWithinBudget({ values: Array(20_001).fill(false) }), false);
  assert.equal(payloadWithinBudget({ title: "Dealer project", sections: Array.from({ length: 100 }, (_, id) => ({ id, labels: ["Estate", "Walnut"] })) }), true);
});

test("compressed and over-complex JSON never reaches application work", async () => {
  const app = express(); let reached = 0;
  app.use(express.json({ limit: "1mb", inflate: false }), payloadBudget);
  app.post("/content", (_req, res) => { reached++; res.json({ ok: true }); });
  app.use((err: { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(err.status ?? 500).end());
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  try {
    const url = `http://127.0.0.1:${address.port}/content`;
    assert.equal((await fetch(url, { method: "POST", headers: { "content-type": "application/json", "content-encoding": "gzip" }, body: gzipSync(JSON.stringify({ title: "compressed" })) })).status, 415);
    assert.equal((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: Array(20_001).fill(false) }) })).status, 413);
    assert.equal(reached, 0);
    assert.equal((await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: "valid" }) })).status, 200);
    assert.equal(reached, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
