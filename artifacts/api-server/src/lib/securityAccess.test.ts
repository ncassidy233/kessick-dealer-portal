import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePersistedConciergeScopes,
} from "./conciergeScopes";
import {
  staffRoleCanReadProjects,
  staffRoleCanWriteProjects,
} from "./projectPolicy";
import {
  safeInternalReturnTo,
  validOAuthRedirect,
  validRequestedOAuthScopes,
} from "../routes/oauth";
import {
  mcpAskConciergeArgsSchema,
  mcpGetProjectArgsSchema,
  mcpToolCallParamsSchema,
} from "../routes/mcp";

test("project staff access is denied without an approved persisted role", () => {
  assert.equal(staffRoleCanReadProjects(null), false);
  assert.equal(staffRoleCanWriteProjects(null), false);
  assert.equal(staffRoleCanReadProjects("content_manager"), false);
  assert.equal(staffRoleCanWriteProjects("content_manager"), false);
  assert.equal(staffRoleCanReadProjects("sales_rep"), true);
});

test("persisted concierge scopes fail closed on malformed or unknown values", () => {
  assert.equal(parsePersistedConciergeScopes(null), null);
  assert.equal(parsePersistedConciergeScopes([]), null);
  assert.equal(
    parsePersistedConciergeScopes(["project:read", "role:staff"]),
    null,
  );
  assert.deepEqual(
    parsePersistedConciergeScopes("project:read project:read mcp:use"),
    ["project:read", "mcp:use"],
  );
});

test("OAuth redirects reject fragments, credentials, and non-loopback HTTP", () => {
  assert.equal(validOAuthRedirect("https://example.com/callback"), true);
  assert.equal(validOAuthRedirect("http://localhost:3000/callback"), true);
  assert.equal(validOAuthRedirect("https://example.com/callback#steal"), false);
  assert.equal(validOAuthRedirect("https://user@example.com/callback"), false);
  assert.equal(validOAuthRedirect("http://example.com/callback"), false);
  assert.equal(validOAuthRedirect("javascript:alert(1)"), false);
});

test("OAuth return paths and requested scopes reject injection", () => {
  assert.equal(safeInternalReturnTo("/api/oauth/authorize?x=1"), "/api/oauth/authorize?x=1");
  assert.equal(safeInternalReturnTo("//evil.example/sign-in"), "/api/oauth/authorize");
  assert.equal(safeInternalReturnTo("/\\evil.example"), "/api/oauth/authorize");
  assert.equal(
    validRequestedOAuthScopes(["project:read"], ["project:read"]),
    true,
  );
  assert.equal(
    validRequestedOAuthScopes(["project:read", "project:read"], ["project:read"]),
    false,
  );
  assert.equal(
    validRequestedOAuthScopes(["role:staff"], ["role:staff"]),
    false,
  );
});

test("MCP tool inputs reject ownership and role injection", () => {
  const projectId = "11111111-1111-4111-8111-111111111111";
  assert.equal(
    mcpToolCallParamsSchema.safeParse({
      name: "get_project",
      arguments: { projectId },
      accountId: "victim",
    }).success,
    false,
  );
  assert.equal(
    mcpGetProjectArgsSchema.safeParse({
      projectId,
      organizationId: "attacker-controlled",
    }).success,
    false,
  );
  assert.equal(
    mcpAskConciergeArgsSchema.safeParse({
      message: "show the project",
      acknowledgeCreditUsage: true,
      role: "staff",
    }).success,
    false,
  );
});