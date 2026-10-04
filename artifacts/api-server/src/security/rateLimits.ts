import { getAuth } from "@clerk/express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { logger } from "../lib/logger";

const common = {
  windowMs: 15 * 60 * 1000,
  standardHeaders: "draft-8" as const,
  legacyHeaders: false,
  handler: (req: Parameters<typeof accountOrIp>[0], res: {
    status(code: number): { json(body: { error: string }): void };
  }) => {
    logger.warn({
      event: "security.rate_limit_exceeded",
      method: req.method,
      path: req.path,
      limitClass: classifyRateLimit(req.method, req.path),
    }, "Request rate limit exceeded");
    res.status(429).json({ error: "Request limit reached. Try again later." });
  },
};

export type RateLimitClass = "upload" | "ai" | "oauth" | "general";

export function classifyRateLimit(method: string, path: string): RateLimitClass {
  if (
    (method === "POST" || method === "PUT") &&
    (/^\/projects\/[^/]+\/images(?:\/complete|\/uploads\/[^/]+)?$/.test(path) ||
      path.includes("/resource-uploads/") || path.includes("/knowledge/uploads/"))
  ) return "upload";
  if (method === "POST" && path.startsWith("/v1/concierge/")) return "ai";
  if (path.startsWith("/oauth/")) return "oauth";
  return "general";
}

export const apiRateLimit = rateLimit({ ...common, limit: 300 });

export function verifiedAccountRateKey(auth: {
  userId: string | null;
  sessionId: string | null;
}): string | null {
  return auth.userId && auth.sessionId ? `account:${auth.userId}` : null;
}

function accountOrIp(req: Parameters<typeof getAuth>[0]): string {
  const auth = getAuth(req);
  // Account buckets are available only after clerkMiddleware established a
  // verified interactive session, never from attacker-supplied bearer text.
  return verifiedAccountRateKey(auth) ?? `ip:${ipKeyGenerator(req.ip ?? "")}`;
}

export const uploadRateLimit = rateLimit({
  ...common,
  limit: 30,
  keyGenerator: accountOrIp,
  skip: (req) => classifyRateLimit(req.method, req.path) !== "upload",
});

export const aiRateLimit = rateLimit({
  ...common,
  limit: 30,
  keyGenerator: accountOrIp,
  skip: (req) => classifyRateLimit(req.method, req.path) !== "ai",
});

export const oauthRateLimit = rateLimit({
  ...common,
  limit: 40,
  keyGenerator: accountOrIp,
  skip: (req) => classifyRateLimit(req.method, req.path) !== "oauth",
});