import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import {
  accountsTable,
  conciergeConnectionsTable,
  conciergeOAuthClientsTable,
  conciergeOAuthTokensTable,
  db,
} from "@workspace/db";
import { and, eq, gt, isNull } from "drizzle-orm";
import { requireAccount } from "./auth";
import { allowedConciergeScopes, parsePersistedConciergeScopes } from "../lib/conciergeScopes";

declare global {
  namespace Express {
    interface Request {
      conciergeScopes?: string[];
      conciergeConnectionId?: string;
    }
  }
}

function bearerToken(req: Request): string | null {
  const value = req.headers.authorization;
  if (!value?.startsWith("Bearer ")) return null;
  const token = value.slice(7);
  return token.startsWith("ksk_") || token.startsWith("kso_") ? token : null;
}

export function requireConciergeScopes(...required: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token) {
      requireAccount(req, res, () => {
         if (req.account?.status !== "approved") {
          res.status(403).json({ error: "Account access is unavailable." });
          return;
        }
         req.conciergeScopes = [...allowedConciergeScopes];
        next();
      });
      return;
    }

    try {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const oauth = token.startsWith("kso_")
        ? (
            await db
              .select({
                token: conciergeOAuthTokensTable,
                account: accountsTable,
              })
              .from(conciergeOAuthTokensTable)
              .innerJoin(accountsTable, eq(conciergeOAuthTokensTable.accountId, accountsTable.id))
              .innerJoin(
                conciergeOAuthClientsTable,
                eq(
                  conciergeOAuthTokensTable.clientId,
                  conciergeOAuthClientsTable.id,
                ),
              )
              .where(
                and(
                  eq(conciergeOAuthTokensTable.accessTokenHash, tokenHash),
                  isNull(conciergeOAuthTokensTable.revokedAt),
                  isNull(conciergeOAuthClientsTable.revokedAt),
                  gt(conciergeOAuthTokensTable.accessExpiresAt, new Date()),
                ),
              )
              .limit(1)
          )[0]
        : null;
      const pat = token.startsWith("ksk_")
        ? (
            await db
              .select({ connection: conciergeConnectionsTable, account: accountsTable })
              .from(conciergeConnectionsTable)
              .innerJoin(accountsTable, eq(conciergeConnectionsTable.accountId, accountsTable.id))
              .where(
                and(
                  eq(conciergeConnectionsTable.tokenHash, tokenHash),
                  isNull(conciergeConnectionsTable.revokedAt),
                  gt(conciergeConnectionsTable.expiresAt, new Date()),
                ),
              )
              .limit(1)
          )[0]
        : null;
      const account = oauth?.account ?? pat?.account;
       if (!account || account.status !== "approved") {
        res.status(401).json({ error: "Connection token is invalid or expired." });
        return;
      }
      const scopeValue = oauth?.token.scope ?? pat?.connection.scopes;
       const scopes = parsePersistedConciergeScopes(scopeValue);
       if (!scopes) {
         res.status(401).json({ error: "Connection token is invalid or expired." });
         return;
       }
      if (required.some((scope) => !scopes.includes(scope))) {
        res.status(403).json({ error: "Connection scope is not authorized." });
        return;
      }
      req.account = account;
      req.conciergeScopes = scopes;
      req.conciergeConnectionId = oauth?.token.id ?? pat?.connection.id;
      if (pat) {
        await db
          .update(conciergeConnectionsTable)
          .set({ lastUsedAt: new Date() })
          .where(eq(conciergeConnectionsTable.id, pat.connection.id));
      }
      next();
    } catch (error) {
      req.log.warn({ err: error }, "Concierge token validation failed");
      res.status(503).json({ error: "Authorization service is unavailable." });
    }
  };
}