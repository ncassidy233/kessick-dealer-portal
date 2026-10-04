import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import {
  auditEventsTable,
  accountsTable,
  conciergeOAuthClientsTable,
  conciergeOAuthCodesTable,
  conciergeOAuthTokensTable,
  db,
} from "@workspace/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import {
  requireAccount,
  requireActiveAccount,
} from "../middlewares/auth";
import type { NextFunction, Request, Response } from "express";

const router: IRouter = Router();
export const oauthScopes = new Set([
  "catalog:read",
  "project:read",
  "concierge:ask",
  "action:confirm",
  "mcp:use",
]);
const clientBody = z.object({
  clientName: z.string().trim().min(1).max(120),
  redirectUris: z.array(z.string().url()).min(1).max(5),
  scopes: z.array(z.string().min(1).max(40)).min(1).max(5),
}).strict();
const oauthAuthorize = z.object({
  client_id: z.string().min(8).max(100),
  redirect_uri: z.string().url(),
  response_type: z.literal("code"),
  scope: z.string().min(1).max(300),
  state: z.string().max(500).optional(),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
}).strict();

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function validOAuthRedirect(uri: string) {
  try {
    const parsed = new URL(uri);
    if (parsed.username || parsed.password || parsed.hash) return false;
    if (parsed.protocol === "https:") return true;
    return parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]");
  } catch {
    return false;
  }
}

export function safeInternalReturnTo(value: string): string {
  return value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      !/[\r\n]/.test(value)
    ? value
    : "/api/oauth/authorize";
}

export function validRequestedOAuthScopes(
  requested: readonly string[],
  allowed: readonly string[],
): boolean {
  return requested.length > 0 &&
    new Set(requested).size === requested.length &&
    requested.every((scope) => oauthScopes.has(scope) && allowed.includes(scope));
}

function redirectWithError(uri: string, error: string, state?: string) {
  const target = new URL(uri);
  target.searchParams.set("error", error);
  if (state) target.searchParams.set("state", state);
  return target.toString();
}

function requireOAuthAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!getAuth(req).userId) {
    const returnTo = safeInternalReturnTo(req.originalUrl);
    res.redirect(
      302,
      `/sign-in?redirect_url=${encodeURIComponent(returnTo)}`,
    );
    return;
  }
  void requireAccount(req, res, next);
}

function clientCredentials(req: Request) {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(authorization.slice(6), "base64").toString(
        "utf8",
      );
      const separator = decoded.indexOf(":");
      if (separator >= 0) {
        return {
          clientId: decodeURIComponent(decoded.slice(0, separator)),
          clientSecret: decodeURIComponent(decoded.slice(separator + 1)),
        };
      }
    } catch {
      return null;
    }
  }
  const clientId = String(req.body?.client_id ?? "");
  const clientSecret = String(req.body?.client_secret ?? "");
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function authenticatedClient(req: Request) {
  const credentials = clientCredentials(req);
  if (!credentials) return null;
  const [client] = await db
    .select()
    .from(conciergeOAuthClientsTable)
    .where(
      and(
        eq(conciergeOAuthClientsTable.clientId, credentials.clientId),
        isNull(conciergeOAuthClientsTable.revokedAt),
      ),
    )
    .limit(1);
  if (!client) return null;
  const suppliedHash = Buffer.from(hash(credentials.clientSecret), "hex");
  const expectedHash = Buffer.from(client.clientSecretHash, "hex");
  return suppliedHash.length === expectedHash.length &&
    timingSafeEqual(suppliedHash, expectedHash)
    ? client
    : null;
}

router.post(
  "/oauth/clients",
  requireAccount,
  requireActiveAccount,
  async (req, res) => {
    const parsed = clientBody.safeParse(req.body);
    if (
      !parsed.success ||
      !validRequestedOAuthScopes(parsed.data.scopes, [...oauthScopes]) ||
      new Set(parsed.data.redirectUris).size !== parsed.data.redirectUris.length ||
      parsed.data.redirectUris.some((uri) => !validOAuthRedirect(uri))
    ) {
      res.status(400).json({ error: "Invalid OAuth client or redirect URI." });
      return;
    }
    const clientSecret = `gpts_${randomBytes(32).toString("base64url")}`;
    const [client] = await db
      .insert(conciergeOAuthClientsTable)
      .values({
        ownerAccountId: req.account!.id,
        clientId: `gpt_${randomBytes(18).toString("base64url")}`,
        clientSecretHash: hash(clientSecret),
        clientSecretPrefix: clientSecret.slice(0, 12),
        clientName: parsed.data.clientName,
        redirectUris: parsed.data.redirectUris,
        allowedScopes: parsed.data.scopes,
      })
      .returning();
    await db.insert(auditEventsTable).values({
      actorAccountId: req.account!.id,
      action: "concierge.oauth.client.created",
      targetType: "oauth_client",
      targetId: client.id,
      metadata: { scopes: parsed.data.scopes },
    });
    res.status(201).json({
      clientId: client.clientId,
      clientSecret,
      clientSecretPrefix: client.clientSecretPrefix,
      clientName: client.clientName,
      redirectUris: client.redirectUris,
      scopes: client.allowedScopes,
      warning: "Copy the client secret now. It is not shown again.",
    });
  },
);

router.get(
  "/oauth/clients",
  requireAccount,
  requireActiveAccount,
  async (req, res) => {
    const clients = await db
      .select()
      .from(conciergeOAuthClientsTable)
      .where(eq(conciergeOAuthClientsTable.ownerAccountId, req.account!.id));
    res.json(
      clients.map((client) => ({
        clientId: client.clientId,
        clientSecretPrefix: client.clientSecretPrefix,
        clientName: client.clientName,
        redirectUris: client.redirectUris,
        scopes: client.allowedScopes,
        revokedAt: client.revokedAt,
        createdAt: client.createdAt,
      })),
    );
  },
);

router.delete(
  "/oauth/clients/:clientId",
  requireAccount,
  requireActiveAccount,
  async (req, res) => {
    const revokedAt = new Date();
    const client = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(conciergeOAuthClientsTable)
        .set({ revokedAt })
        .where(
          and(
            eq(conciergeOAuthClientsTable.clientId, String(req.params.clientId)),
            eq(conciergeOAuthClientsTable.ownerAccountId, req.account!.id),
            isNull(conciergeOAuthClientsTable.revokedAt),
          ),
        )
        .returning();
      if (updated) {
        await tx
          .update(conciergeOAuthTokensTable)
          .set({ revokedAt })
          .where(eq(conciergeOAuthTokensTable.clientId, updated.id));
      }
      return updated;
    });
    if (!client) {
      res.status(404).json({ error: "OAuth client not found." });
      return;
    }
    await db.insert(auditEventsTable).values({
      actorAccountId: req.account!.id,
      action: "concierge.oauth.client.revoked",
      targetType: "oauth_client",
      targetId: client.id,
      metadata: {},
    });
    res.status(204).end();
  },
);

async function authorizationRequest(req: Request, res: Response) {
  const parsed = oauthAuthorize.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).send("Invalid OAuth authorization request.");
    return;
  }
  const [client] = await db
    .select()
    .from(conciergeOAuthClientsTable)
    .where(
      and(
        eq(conciergeOAuthClientsTable.clientId, parsed.data.client_id),
        isNull(conciergeOAuthClientsTable.revokedAt),
      ),
    )
    .limit(1);
  const redirectAllowed =
    client &&
    Array.isArray(client.redirectUris) &&
    client.redirectUris.includes(parsed.data.redirect_uri);
  const requestedScopes = parsed.data.scope.split(" ").filter(Boolean);
  const allowedScopes =
    client && Array.isArray(client.allowedScopes)
      ? (client.allowedScopes as unknown[]).filter(
          (scope): scope is string => typeof scope === "string",
        )
      : [];
  if (
    !client ||
    !redirectAllowed ||
    !validRequestedOAuthScopes(requestedScopes, allowedScopes)
  ) {
    res.status(400).send("OAuth client, redirect URI, or scope is invalid.");
    return;
  }
  if (req.method === "GET") {
    const hidden = Object.entries(req.query)
      .map(([key, value]) => {
        return `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value))}">`;
      })
      .join("");
    res.type("html").send(
      `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize Kessick AI</title><body><main><h1>Authorize ${escapeHtml(client.clientName)}</h1><p>This will allow access only to your selected Kessick scopes: ${escapeHtml(requestedScopes.join(", "))}.</p><p>Kessick AI cannot approve engineering, accept quotes, place orders, take payments, or message customers autonomously.</p><form method="post">${hidden}<button name="consent" value="deny">Deny</button><button name="consent" value="allow">Allow</button></form></main></body></html>`,
    );
    return;
  }
  if (req.body?.consent !== "allow") {
    res.redirect(redirectWithError(parsed.data.redirect_uri, "access_denied", parsed.data.state));
    return;
  }
  const rawCode = `koc_${randomBytes(32).toString("base64url")}`;
  const [code] = await db
    .insert(conciergeOAuthCodesTable)
    .values({
      clientId: client.id,
      accountId: req.account!.id,
      codeHash: hash(rawCode),
      redirectUri: parsed.data.redirect_uri,
      scope: requestedScopes.join(" "),
      codeChallenge: parsed.data.code_challenge,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    })
    .returning();
  await db.insert(auditEventsTable).values({
    actorAccountId: req.account!.id,
    action: "concierge.oauth.code.issued",
    targetType: "oauth_code",
    targetId: code.id,
    metadata: { clientId: client.id, scope: requestedScopes.join(" ") },
  });
  const target = new URL(parsed.data.redirect_uri);
  target.searchParams.set("code", rawCode);
  if (parsed.data.state) target.searchParams.set("state", parsed.data.state);
  res.redirect(target.toString());
}

router.get(
  "/oauth/authorize",
  requireOAuthAccount,
  requireActiveAccount,
  authorizationRequest,
);
router.post(
  "/oauth/authorize",
  requireOAuthAccount,
  requireActiveAccount,
  authorizationRequest,
);

router.post("/oauth/token", async (req, res) => {
  const client = await authenticatedClient(req);
  if (!client) {
    res
      .status(401)
      .set("WWW-Authenticate", 'Basic realm="Kessick OAuth token endpoint"')
      .json({ error: "invalid_client" });
    return;
  }
  const grantType = String(req.body?.grant_type ?? "");
  if (grantType === "authorization_code") {
    const code = String(req.body?.code ?? "");
    const verifier = String(req.body?.code_verifier ?? "");
    const redirectUri = String(req.body?.redirect_uri ?? "");
    const [record] = await db
      .select()
      .from(conciergeOAuthCodesTable)
      .where(
        and(
          eq(conciergeOAuthCodesTable.codeHash, hash(code)),
          isNull(conciergeOAuthCodesTable.consumedAt),
          gt(conciergeOAuthCodesTable.expiresAt, new Date()),
          eq(conciergeOAuthCodesTable.redirectUri, redirectUri),
        ),
      )
      .limit(1);
    if (
      !record ||
      record.clientId !== client.id ||
      pkceChallenge(verifier) !== record.codeChallenge
    ) {
      res.status(400).json({ error: "invalid_grant" });
      return;
    }
    const access = `kso_${randomBytes(32).toString("base64url")}`;
    const refresh = `ksr_${randomBytes(40).toString("base64url")}`;
    try {
      await db.transaction(async (tx) => {
        const [activeClient] = await tx
          .select({ id: conciergeOAuthClientsTable.id })
          .from(conciergeOAuthClientsTable)
          .where(
            and(
              eq(conciergeOAuthClientsTable.id, client.id),
              isNull(conciergeOAuthClientsTable.revokedAt),
            ),
          )
          .for("update")
          .limit(1);
        if (!activeClient) throw new Error("INVALID_CLIENT");
        const [activeAccount] = await tx
          .select({ id: accountsTable.id })
          .from(accountsTable)
          .where(
            and(
              eq(accountsTable.id, record.accountId),
              eq(accountsTable.status, "approved"),
            ),
          )
          .for("update")
          .limit(1);
        if (!activeAccount) throw new Error("INVALID_GRANT");
        const [consumed] = await tx
          .update(conciergeOAuthCodesTable)
          .set({ consumedAt: new Date() })
          .where(
            and(
              eq(conciergeOAuthCodesTable.id, record.id),
              isNull(conciergeOAuthCodesTable.consumedAt),
            ),
          )
          .returning();
        if (!consumed) throw new Error("INVALID_GRANT");
        await tx.insert(auditEventsTable).values({
          actorAccountId: record.accountId,
          action: "concierge.oauth.code.consumed",
          targetType: "oauth_code",
          targetId: record.id,
          metadata: { clientId: record.clientId },
        });
        const [tokenRecord] = await tx
          .insert(conciergeOAuthTokensTable)
          .values({
            clientId: record.clientId,
            accountId: record.accountId,
            accessTokenHash: hash(access),
            refreshTokenHash: hash(refresh),
            scope: record.scope,
            accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
            refreshExpiresAt: new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000,
            ),
          })
          .returning();
        await tx.insert(auditEventsTable).values({
          actorAccountId: record.accountId,
          action: "concierge.oauth.token.issued",
          targetType: "oauth_token",
          targetId: tokenRecord.id,
          metadata: { clientId: record.clientId, scope: record.scope },
        });
      });
    } catch (error) {
      res.status(error instanceof Error && error.message === "INVALID_CLIENT" ? 401 : 400)
        .json({
          error:
            error instanceof Error && error.message === "INVALID_CLIENT"
              ? "invalid_client"
              : "invalid_grant",
        });
      return;
    }
    res.json({
      access_token: access,
      token_type: "Bearer",
      expires_in: 900,
      refresh_token: refresh,
      scope: record.scope,
    });
    return;
  }
  if (grantType === "refresh_token") {
    const refresh = String(req.body?.refresh_token ?? "");
    const access = `kso_${randomBytes(32).toString("base64url")}`;
    const rotatedRefresh = `ksr_${randomBytes(40).toString("base64url")}`;
    let rotated: typeof conciergeOAuthTokensTable.$inferSelect;
    try {
      rotated = await db.transaction(async (tx) => {
        const [activeClient] = await tx
          .select({ id: conciergeOAuthClientsTable.id })
          .from(conciergeOAuthClientsTable)
          .where(
            and(
              eq(conciergeOAuthClientsTable.id, client.id),
              isNull(conciergeOAuthClientsTable.revokedAt),
            ),
          )
          .for("update")
          .limit(1);
        if (!activeClient) throw new Error("INVALID_CLIENT");
        const [updated] = await tx
          .update(conciergeOAuthTokensTable)
          .set({
            accessTokenHash: hash(access),
            refreshTokenHash: hash(rotatedRefresh),
            accessExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
          })
          .where(
            and(
              eq(
                conciergeOAuthTokensTable.refreshTokenHash,
                hash(refresh),
              ),
              eq(conciergeOAuthTokensTable.clientId, client.id),
              isNull(conciergeOAuthTokensTable.revokedAt),
              gt(conciergeOAuthTokensTable.refreshExpiresAt, new Date()),
            ),
          )
          .returning();
        if (!updated) throw new Error("INVALID_GRANT");
        const [activeAccount] = await tx
          .select({ id: accountsTable.id })
          .from(accountsTable)
          .where(
            and(
              eq(accountsTable.id, updated.accountId),
              eq(accountsTable.status, "approved"),
            ),
          )
          .for("update")
          .limit(1);
        if (!activeAccount) throw new Error("INVALID_GRANT");
        await tx.insert(auditEventsTable).values({
          actorAccountId: updated.accountId,
          action: "concierge.oauth.token.refreshed",
          targetType: "oauth_token",
          targetId: updated.id,
          metadata: { clientId: updated.clientId, scope: updated.scope },
        });
        return updated;
      });
    } catch (error) {
      res.status(error instanceof Error && error.message === "INVALID_CLIENT" ? 401 : 400)
        .json({
          error:
            error instanceof Error && error.message === "INVALID_CLIENT"
              ? "invalid_client"
              : "invalid_grant",
        });
      return;
    }
    res.json({
      access_token: access,
      token_type: "Bearer",
      expires_in: 900,
      refresh_token: rotatedRefresh,
      scope: rotated.scope,
    });
    return;
  }
  res.status(400).json({ error: "unsupported_grant_type" });
});

router.post("/oauth/revoke", async (req, res) => {
  const client = await authenticatedClient(req);
  if (!client) {
    res
      .status(401)
      .set("WWW-Authenticate", 'Basic realm="Kessick OAuth revocation endpoint"')
      .json({ error: "invalid_client" });
    return;
  }
  const token = String(req.body?.token ?? "");
  const [revoked] = await db
    .update(conciergeOAuthTokensTable)
    .set({ revokedAt: new Date() })
    .where(
      and(
        or(
          eq(conciergeOAuthTokensTable.accessTokenHash, hash(token)),
          eq(conciergeOAuthTokensTable.refreshTokenHash, hash(token)),
        ),
        eq(conciergeOAuthTokensTable.clientId, client.id),
        isNull(conciergeOAuthTokensTable.revokedAt),
      ),
    )
    .returning();
  if (revoked) {
    await db.insert(auditEventsTable).values({
      actorAccountId: revoked.accountId,
      action: "concierge.oauth.token.revoked",
      targetType: "oauth_token",
      targetId: revoked.id,
      metadata: {},
    });
  }
  res.status(200).json({});
});

export default router;