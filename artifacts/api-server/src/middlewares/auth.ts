import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/express";
import {
  accountsTable,
  db,
  portalStaffProfilesTable,
  type Account,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      account?: Account;
    }
  }
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

function canonicalEmail(value: string): string {
  return value.trim().toLowerCase();
}

export async function requireAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const auth = getAuth(req);
    const clerkUserId = auth.userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Authentication required." });
      return;
    }
    const user = await clerk.users.getUser(clerkUserId);
    const primary =
      user.emailAddresses.find(
        (candidate) => candidate.id === user.primaryEmailAddressId,
      ) ?? user.emailAddresses[0];
    if (!primary?.emailAddress) {
      res.status(403).json({ error: "A verified email address is required." });
      return;
    }
    const email = canonicalEmail(primary.emailAddress);
    if (primary.verification?.status !== "verified") {
      res.status(403).json({ error: "Verify your email address to continue." });
      return;
    }
    let claimedPlaceholder = false;
    let [account] = await db
      .select()
      .from(accountsTable)
      .where(eq(accountsTable.clerkUserId, clerkUserId))
      .limit(1);

    if (!account) {
      // Invitations are represented by placeholder Clerk IDs. Claim only that
      // exact row; never replace a real identity or overwrite its approval,
      // role, or organization-related fields.
      const [emailAccount] = await db
        .select()
        .from(accountsTable)
        .where(eq(accountsTable.email, email))
        .limit(1);
      if (emailAccount) {
          const placeholder =
            emailAccount.clerkUserId.startsWith("pending:") ||
            emailAccount.clerkUserId.startsWith("invited:") ||
            emailAccount.clerkUserId.startsWith("staff:");
        if (placeholder) {
          const [claimed] = await db
            .update(accountsTable)
            .set({
              clerkUserId,
              emailVerified: true,
              ...(emailAccount.displayName
                ? {}
                : {
                    displayName:
                      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                      null,
                  }),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(accountsTable.id, emailAccount.id),
                eq(accountsTable.clerkUserId, emailAccount.clerkUserId),
              ),
            )
            .returning();
          account = claimed;
          claimedPlaceholder = Boolean(claimed);
        } else if (emailAccount.clerkUserId !== clerkUserId) {
          res.status(403).json({ error: "Account identity could not be reconciled." });
          return;
        }
      }

      if (!account && !emailAccount) {
        const [created] = await db
          .insert(accountsTable)
          .values({
            clerkUserId,
            email,
            displayName:
              [user.firstName, user.lastName].filter(Boolean).join(" ") || null,
            emailVerified: true,
            role: "customer",
            status: "approved",
          })
          .onConflictDoNothing()
          .returning();
        account = created;
      }

      // A concurrent request may have claimed/inserted the same Clerk ID.
      // Refetch it rather than retrying a broad update or losing the account.
      if (!account) {
        [account] = await db
          .select()
          .from(accountsTable)
          .where(eq(accountsTable.clerkUserId, clerkUserId))
          .limit(1);
      }
      if (!account) {
        res.status(403).json({ error: "Account identity could not be reconciled." });
        return;
      }
    } else if (account.email !== email || !account.emailVerified) {
      const [emailOwner] = await db
        .select({ id: accountsTable.id })
        .from(accountsTable)
        .where(eq(accountsTable.email, email))
        .limit(1);
      if (emailOwner && emailOwner.id !== account.id) {
        res.status(403).json({ error: "Account identity could not be reconciled." });
        return;
      }
      const [reconciled] = await db
        .update(accountsTable)
        .set({
          email,
          emailVerified: true,
          updatedAt: new Date(),
        })
        .where(eq(accountsTable.id, account.id))
        .returning();
      account = reconciled;
    }

    if (!account) {
      res.status(403).json({ error: "Account access is unavailable." });
      return;
    }
    if (claimedPlaceholder && account.role === "staff") {
      // A staff profile is activated only at the verified, exact-email
      // placeholder claim. Later requests must not reverse revocation.
      await db
        .update(portalStaffProfilesTable)
        .set({
          authorizedAt: new Date(),
          authorizedClerkUserId: clerkUserId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(portalStaffProfilesTable.accountId, account.id),
            isNull(portalStaffProfilesTable.authorizedAt),
          ),
        );
    }
    await db
      .update(accountsTable)
      .set({ lastSeenAt: new Date(), updatedAt: new Date() })
      .where(eq(accountsTable.id, account.id));
    req.account = account;
    next();
  } catch (error) {
    req.log.error({ err: error }, "Account bridge failed");
    res.status(503).json({ error: "Account service is temporarily unavailable." });
  }
}

export function requireActiveAccount(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.account?.status !== "approved") {
    res.status(403).json({ error: "Account access is unavailable." });
    return;
  }
  next();
}

export async function getAuthorizedStaffRole(
  req: Request,
): Promise<"super_admin" | "staff_admin" | "sales_rep" | "content_manager" | null> {
  return req.account ? getAuthorizedStaffRoleForAccount(req.account) : null;
}

export async function getAuthorizedStaffRoleForAccount(
  account: Account,
): Promise<"super_admin" | "staff_admin" | "sales_rep" | "content_manager" | null> {
  if (account.role !== "staff" || account.status !== "approved") return null;
  const [profile] = await db
    .select()
    .from(portalStaffProfilesTable)
    .where(eq(portalStaffProfilesTable.accountId, account.id))
    .limit(1);
  if (
    !profile?.authorizedAt ||
    profile.authorizedClerkUserId !== account.clerkUserId
  ) return null;
  return profile.role;
}

export function requireStaffRoles(
  roles: readonly ("super_admin" | "staff_admin" | "sales_rep" | "content_manager")[],
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const role = await getAuthorizedStaffRole(req);
    if (!role || !roles.includes(role)) {
      res.status(403).json({ error: "Forbidden." });
      return;
    }
    next();
  };
}

export function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  void requireStaffRoles(["super_admin", "staff_admin"])(req, res, next);
}