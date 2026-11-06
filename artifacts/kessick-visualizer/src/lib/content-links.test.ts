import assert from "node:assert/strict";
import test from "node:test";
import { safeContentUrl, safeWebUrl } from "./content-links.ts";

test("accepts absolute web URLs without claiming destination availability", () => {
  assert.equal(safeWebUrl(" https://example.com/guide?version=2 "), "https://example.com/guide?version=2");
  assert.equal(safeWebUrl("http://example.com/training"), "http://example.com/training");
});

test("rejects unsafe or malformed destinations", () => {
  for (const value of [
    null, {}, "", "/training", "//example.com", "javascript:alert(1)",
    "data:text/html,hello", "ftp://example.com/file", "https://user:pass@example.com",
    "https://example.com\\@evil.com", "https://example.com/space here",
    "https://example.com/\nunsafe",
  ]) {
    assert.equal(safeWebUrl(value), null);
  }
});

test("CMS content accepts safe same-origin assets and navigation but no executable protocols", () => {
  for (const value of ["/portal/forms", "/images/project.jpg", "/api/dealer-portal/resources/id/file", "https://example.com/image.jpg"]) assert.equal(safeContentUrl(value), value);
  for (const value of ["javascript:alert(1)", "data:image/svg+xml,bad", "file:///etc/passwd", "//evil.example/img", "/\\evil.example/img", "******example.com/image.jpg", "/images/unsafe\nimage.jpg"]) assert.equal(safeContentUrl(value), null);
});