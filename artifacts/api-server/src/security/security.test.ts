import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTION_SECURITY_HEADERS } from "./headers";
import { configuredOrigins, isAllowedRequestOrigin } from "./origin";
import { classifyRateLimit, verifiedAccountRateKey } from "./rateLimits";
import { csrfGuard } from "./csrf";

function requestWith(headers: Record<string, string>) {
  return {
    get(name: string) {
      return headers[name.toLowerCase()];
    },
  } as never;
}

test("production security headers deny framing, sniffing, indexing, and excess permissions", () => {
  assert.equal(PRODUCTION_SECURITY_HEADERS["X-Frame-Options"], "DENY");
  assert.equal(PRODUCTION_SECURITY_HEADERS["X-Content-Type-Options"], "nosniff");
  assert.match(PRODUCTION_SECURITY_HEADERS["X-Robots-Tag"], /noindex/);
  assert.match(PRODUCTION_SECURITY_HEADERS["Permissions-Policy"], /camera=\(self\)/);
  assert.match(PRODUCTION_SECURITY_HEADERS["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.match(PRODUCTION_SECURITY_HEADERS["Content-Security-Policy"], /clerk\.accounts\.dev/);
});

test("origins are exact and malicious lookalikes are rejected", () => {
  const allowed = configuredOrigins({
    NODE_ENV: "production",
    REPLIT_DOMAINS: "portal.example.com",
    KESSICK_ALLOWED_ORIGINS: "https://dealer.kessick.com",
  } as NodeJS.ProcessEnv);
  assert.equal(isAllowedRequestOrigin(requestWith({ origin: "https://portal.example.com" }), allowed), true);
  assert.equal(isAllowedRequestOrigin(requestWith({ referer: "https://dealer.kessick.com/app" }), allowed), true);
  assert.equal(isAllowedRequestOrigin(requestWith({ origin: "https://portal.example.com.evil.test" }), allowed), false);
  assert.equal(isAllowedRequestOrigin(requestWith({ origin: "https://portal.example.com@evil.test" }), allowed), false);
  assert.equal(isAllowedRequestOrigin(requestWith({ origin: "null" }), allowed), false);
});

test("sensitive endpoints receive tighter rate-limit classes", () => {
  assert.equal(classifyRateLimit("POST", "/projects/p1/images"), "upload");
  assert.equal(classifyRateLimit("POST", "/staff/portal/resource-uploads/request"), "upload");
  assert.equal(classifyRateLimit("PUT", "/staff/portal/resource-uploads/11111111-1111-1111-1111-111111111111"), "upload");
  assert.equal(classifyRateLimit("POST", "/v1/concierge/ask"), "ai");
  assert.equal(classifyRateLimit("POST", "/oauth/token"), "oauth");
  assert.equal(classifyRateLimit("GET", "/catalog"), "general");
});

test("account limit keys require a verified Clerk session", () => {
  assert.equal(
    verifiedAccountRateKey({ userId: "user_attacker_text", sessionId: null }),
    null,
  );
  assert.equal(
    verifiedAccountRateKey({ userId: "user_verified", sessionId: "sess_verified" }),
    "account:user_verified",
  );
});

test("CSRF guard permits only marked, same-origin, allowlisted raw upload MIME", () => {
  const guard = csrfGuard(new Set(["https://portal.example.com"]));
  const run = (
    contentType: string,
    marker?: string,
    path = "/staff/portal/resource-uploads/11111111-1111-1111-8111-111111111111",
  ) => {
    let status = 200;
    let nextCalled = false;
    const headers: Record<string, string | undefined> = {
      origin: "https://portal.example.com",
      cookie: "__session=ambient",
      "content-type": contentType,
      "sec-fetch-site": "same-origin",
      "x-kessick-csrf": marker,
    };
    guard({
      method: "PUT",
      path,
      get: (name: string) => headers[name.toLowerCase()],
      is: () => false,
    } as never, {
      status(code: number) { status = code; return this; },
      json() { return this; },
    } as never, () => { nextCalled = true; });
    return { status, nextCalled };
  };
  assert.deepEqual(run("application/pdf", "1"), { status: 200, nextCalled: true });
  assert.deepEqual(run("application/pdf"), { status: 415, nextCalled: false });
  assert.deepEqual(run("application/x-msdownload", "1"), { status: 415, nextCalled: false });
  const projectUpload = "/projects/11111111-1111-1111-8111-111111111111/images/uploads/22222222-2222-2222-8222-222222222222";
  assert.deepEqual(run("image/jpeg", "1", projectUpload), { status: 200, nextCalled: true });
  assert.deepEqual(run("application/pdf", "1", projectUpload), { status: 415, nextCalled: false });
  assert.deepEqual(
    run("image/jpeg", "1", `${projectUpload}/extra`),
    { status: 415, nextCalled: false },
  );
});

test("CSRF guard rejects cross-site cookie writes and accepts verified JSON writes", () => {
  const allowed = new Set(["https://portal.example.com"]);
  const guard = csrfGuard(allowed);
  const run = (headers: Record<string, string>) => {
    let status = 200;
    let nextCalled = false;
    guard({
      method: "POST",
      path: "/projects",
      get: (name: string) => headers[name.toLowerCase()],
      is: (type: string) => type === "application/json",
    } as never, {
      status(code: number) { status = code; return this; },
      json() { return this; },
    } as never, () => { nextCalled = true; });
    return { status, nextCalled };
  };

  assert.deepEqual(run({
    origin: "https://evil.test",
    cookie: "__session=ambient",
    "content-type": "application/json",
    "sec-fetch-site": "cross-site",
  }), { status: 403, nextCalled: false });
  assert.deepEqual(run({
    origin: "https://portal.example.com",
    cookie: "__session=ambient",
    "content-type": "application/json",
    "sec-fetch-site": "same-origin",
  }), { status: 200, nextCalled: true });
});