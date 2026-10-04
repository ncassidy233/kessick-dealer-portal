import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProjectReadScope,
  hasConciergeScope,
} from "./conciergeScopes";

test("project concierge data requires delegated project:read scope", () => {
  const askOnly = ["concierge:ask"];
  assert.equal(hasConciergeScope(askOnly, "project:read"), false);
  assert.throws(
    () => assertProjectReadScope(askOnly),
    /PROJECT_SCOPE_REQUIRED/,
  );
  assert.doesNotThrow(() =>
    assertProjectReadScope(["concierge:ask", "project:read"]),
  );
});