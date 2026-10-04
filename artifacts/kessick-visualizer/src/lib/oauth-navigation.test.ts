import assert from "node:assert/strict";
import test from "node:test";
import { resolveOAuthAuthorizationDestination } from "./oauth-navigation";

const origin = "https://kessick.example";

test("recognizes the same-origin API OAuth return as a document destination", () => {
  assert.equal(
    resolveOAuthAuthorizationDestination(
      "/api/oauth/authorize?client_id=gpt_test",
      origin,
      "",
    ),
    `${origin}/api/oauth/authorize?client_id=gpt_test`,
  );
});

test("does not document-navigate to external or ordinary SPA destinations", () => {
  assert.equal(
    resolveOAuthAuthorizationDestination(
      "https://attacker.example/api/oauth/authorize",
      origin,
      "",
    ),
    null,
  );
  assert.equal(
    resolveOAuthAuthorizationDestination("/workspace", origin, ""),
    null,
  );
});