import assert from "node:assert/strict";
import test from "node:test";
import { validateAuthDestination } from "./auth-destination";

test("sign-in return paths reject external redirects, auth loops and raw private API destinations", () => {
  const origin = "https://portal.example.invalid";
  for (const target of [null, "https://evil.example", "//evil.example", "/\\evil.example", "/\n/evil.example", "/sign-in", "/sign-up/verify-email-address", "/api/staff/portal/users", "/unknown"]) assert.equal(validateAuthDestination(target, origin), "/continue", String(target));
  assert.equal(validateAuthDestination("/portal/resources?category=guides", origin), "/portal/resources?category=guides");
  assert.equal(validateAuthDestination("/admin/content?section=forms", origin), "/admin/content?section=forms");
  assert.equal(validateAuthDestination("/api/oauth/authorize?state=test", origin), "/api/oauth/authorize?state=test");
  assert.equal(validateAuthDestination("/portal", origin, "/app"), "/app/portal");
  assert.equal(validateAuthDestination("/app/sign-in", origin, "/app"), "/app/continue");
});
