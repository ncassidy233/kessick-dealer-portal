import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  issueResourceUploadIntent,
  uploadHeadersMatch,
  validatePdfBytes,
  validateRasterBytes,
  verifyResourceUploadIntent,
} from "./uploadSecurity";

test("raster validation rejects signatures with executable or trailing payloads", () => {
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("image"),
    Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]),
  ]);
  assert.equal(validateRasterBytes(png, "image/png"), true);
  assert.equal(validateRasterBytes(Buffer.concat([png, Buffer.from("MZpayload")]), "image/png"), false);
  assert.equal(validateRasterBytes(Buffer.from("MZ fake image"), "image/jpeg"), false);
});

test("bounded upload headers require the authorized exact byte count and type", () => {
  assert.equal(uploadHeadersMatch("image/png", "1024", "image/png", 1024), true);
  assert.equal(uploadHeadersMatch("image/png", undefined, "image/png", 1024), false);
  assert.equal(uploadHeadersMatch("image/png", "1025", "image/png", 1024), false);
  assert.equal(uploadHeadersMatch("application/octet-stream", "1024", "image/png", 1024), false);
  assert.equal(uploadHeadersMatch("image/png", "1024junk", "image/png", 1024), false);
});

test("PDF policy structurally parses dictionaries and rejects active actions", async () => {
  const safe = await PDFDocument.create();
  safe.addPage();
  assert.equal(await validatePdfBytes(Buffer.from(await safe.save())), true);

  const active = await PDFDocument.create();
  active.addPage();
  active.catalog.set(PDFName.of("OpenAction"), active.context.obj({
    S: PDFName.of("JavaScript"),
    JS: "app.alert('no')",
  }));
  assert.equal(await validatePdfBytes(Buffer.from(await active.save())), false);
});

test("resource upload intents are actor-bound, expiring, and tamper evident", () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-only-secret-with-at-least-32-bytes";
  const now = 1_700_000_000_000;
  try {
    const token = issueResourceUploadIntent({
      accountId: "11111111-1111-1111-1111-111111111111",
      objectPath: "/objects/uploads/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222",
      fileName: "guide.pdf",
      contentType: "application/pdf",
      byteSize: 1024,
      expiresAt: now + 60_000,
    });
    assert.equal(verifyResourceUploadIntent(token, "11111111-1111-1111-1111-111111111111", now)?.byteSize, 1024);
    assert.equal(verifyResourceUploadIntent(token, "33333333-3333-3333-3333-333333333333", now), null);
    assert.equal(verifyResourceUploadIntent(`${token.slice(0, -1)}x`, "11111111-1111-1111-1111-111111111111", now), null);
    assert.equal(verifyResourceUploadIntent(token, "11111111-1111-1111-1111-111111111111", now + 60_001), null);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});