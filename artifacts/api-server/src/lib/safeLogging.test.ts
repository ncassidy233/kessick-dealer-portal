import assert from "node:assert/strict";
import test from "node:test";
import { Writable } from "node:stream";
import pino from "pino";
import pinoHttp from "pino-http";
import express from "express";
import { protectedLoggerOptions } from "./logger";
import { protectedHttpSerializers, safeErrorForLog, safeRequestPath } from "./safeLogging";

test("runtime logger removes database/provider payloads and credential fields", () => {
  let output = "";
  const destination = new Writable({ write(chunk, _encoding, callback) { output += chunk; callback(); } });
  const log = pino(protectedLoggerOptions, destination);
  const marker = "SENSITIVE_TEST_VALUE_DO_NOT_LOG";
  const error = Object.assign(new Error(`SQL parameters: ${marker}`), {
    body: { apiKey: marker },
    cause: Object.assign(new Error(marker), { code: "42P01", query: marker }),
  });
  log.error({ err: error, token: marker, nested: { password: marker }, access_token: marker,
    req: { headers: { authorization: marker, cookie: marker } } }, "Operation failed");
  assert.ok(!output.includes(marker));
  const record = JSON.parse(output);
  assert.equal(record.err.errorCode, "42P01");
  assert.equal(record.err.stack, undefined);
  assert.equal(record.err.cause, undefined);
  assert.equal(record.token, "[Redacted]");
});

test("request logs use route templates and reject arbitrary exception codes", () => {
  assert.equal(safeRequestPath({ baseUrl: "/api", route: { path: "/invitations/:token" } }), "/api/invitations/:token");
  assert.equal(safeRequestPath({}), "[unmatched route]");
  assert.deepEqual(safeErrorForLog({ code: "SENSITIVE_TEST_VALUE", message: "private", stack: "private" }),
    { type: "Error", message: "Internal operation failed" });
});

test("HTTP child loggers cannot restore raw errors, URLs, cookies or authorization", async () => {
  let output = "";
  const destination = new Writable({ write(chunk, _encoding, callback) { output += chunk; callback(); } });
  const marker = "SENSITIVE_TEST_VALUE_DO_NOT_LOG";
  const app = express();
  app.use(pinoHttp({ logger: pino(protectedLoggerOptions, destination), serializers: protectedHttpSerializers,
    customProps: req => ({ route: safeRequestPath(req) }) }));
  app.get("/invitations/:token", (req, res) => {
    req.log.error({ err: Object.assign(new Error(marker), { query: marker, params: [marker] }) }, "Operation failed");
    res.status(500).json({ error: "Unable to complete request" });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/invitations/${marker}?token=${marker}`, {
      headers: { authorization: `Bearer ${marker}`, cookie: `session=${marker}` },
    });
    await response.text();
    assert.equal(response.status, 500);
    assert.ok(!output.includes(marker));
    assert.ok(output.includes("/invitations/:token"));
    assert.ok(!output.includes('"stack"'));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
