import assert from "node:assert/strict";
import test from "node:test";
import { safeWebUrl } from "./content-links.ts";

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