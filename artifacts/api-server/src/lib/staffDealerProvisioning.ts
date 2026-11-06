import {
  accountsTable, auditEventsTable, db, dealerOrganizationsTable,
  organizationMembershipsTable,
} from "@workspace/db";
import { and, eq, gte, sql } from "drizzle-orm";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DealerInput = {
  email: string;
  displayName?: string;
  organizationId?: string;
  organizationName?: string;
  actorAccountId: string;
};

export class DealerProvisioningConflict extends Error {}

async function provisionDealer(tx: Transaction, input: DealerInput) {
  const email = input.email.trim().toLowerCase();
  let [account] = await tx.select().from(accountsTable)
    .where(eq(accountsTable.email, email)).limit(1).for("update");
  let created = false;
  if (!account) {
    [account] = await tx.insert(accountsTable).values({
      email, clerkUserId: `invited:${email}`, displayName: input.displayName ?? null,
      role: "dealer", status: "approved", emailVerified: false,
    }).onConflictDoNothing().returning();
    created = Boolean(account);
    if (!account) [account] = await tx.select().from(accountsTable)
      .where(eq(accountsTable.email, email)).limit(1).for("update");
  }
  if (!account || account.role === "staff") {
    throw new DealerProvisioningConflict("This email already belongs to another account type.");
  }
  if (account.status === "suspended") {
    throw new DealerProvisioningConflict("This account is suspended. Reactivate it explicitly before adding access.");
  }

  const [membership] = await tx.select().from(organizationMembershipsTable)
    .where(eq(organizationMembershipsTable.accountId, account.id)).limit(1).for("update");
  if (membership?.status === "suspended") {
    throw new DealerProvisioningConflict("Dealer membership is suspended. Reactivate it explicitly before adding access.");
  }
  if (membership && input.organizationId && membership.organizationId !== input.organizationId) {
    throw new DealerProvisioningConflict("This account already belongs to a different dealer organization.");
  }
  const requestedOrganizationId = membership?.organizationId ?? input.organizationId;
  let organizationId = requestedOrganizationId;
  if (requestedOrganizationId) {
    const [organization] = await tx.select().from(dealerOrganizationsTable)
      .where(eq(dealerOrganizationsTable.id, requestedOrganizationId)).limit(1).for("update");
    if (!organization || organization.status === "suspended") {
      throw new DealerProvisioningConflict("The dealer organization is unavailable or suspended.");
    }
    if (organization.status === "pending") {
      // An applicant's own company can be approved with their account. Never
      // approve a shared pending company as a side effect of adding a member.
      if (organization.createdByAccountId !== account.id || !membership) {
        throw new DealerProvisioningConflict("Approve this dealer organization before adding members.");
      }
      await tx.update(dealerOrganizationsTable).set({
        status: "approved", approvedByAccountId: input.actorAccountId,
        approvedAt: new Date(), updatedAt: new Date(),
      }).where(eq(dealerOrganizationsTable.id, organization.id));
    }
  } else {
    const [organization] = await tx.insert(dealerOrganizationsTable).values({
      name: input.organizationName ?? input.displayName ?? account.displayName ?? `${email} Dealer Account`,
      slug: `dealer-${account.id}`, status: "approved", createdByAccountId: account.id,
      approvedByAccountId: input.actorAccountId, approvedAt: new Date(),
    }).returning();
    organizationId = organization.id;
  }

  if (membership) await tx.update(organizationMembershipsTable)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(organizationMembershipsTable.id, membership.id));
  else await tx.insert(organizationMembershipsTable).values({
    organizationId: organizationId!, accountId: account.id,
    role: input.organizationId ? "member" : "owner", status: "approved",
  });
  const [approved] = await tx.update(accountsTable).set({
    role: "dealer", status: "approved", updatedAt: new Date(),
    ...(input.displayName === undefined ? {} : { displayName: input.displayName }),
  }).where(eq(accountsTable.id, account.id)).returning();
  return { account: approved, created };
}

/** Only call after the staff users:write capability has been verified. */
export async function provisionStaffAddedDealer(input: DealerInput) {
  return db.transaction(async tx => {
    const result = await provisionDealer(tx, input);
    await tx.insert(auditEventsTable).values({
      actorAccountId: input.actorAccountId, action: "portal_v2.dealer.preapproved",
      targetType: "account", targetId: result.account.id,
      metadata: { created: result.created },
    });
    return result;
  });
}

/** Repair only old staff-provisioned invitations, never public applications,
 * suspended access, or a later explicit staff status decision. */
export async function repairStaffAddedDealerInvitations() {
  const candidates = await db.select({ email: accountsTable.email, actorAccountId: auditEventsTable.actorAccountId, provisionedAt: auditEventsTable.createdAt })
    .from(accountsTable).innerJoin(auditEventsTable, and(
      eq(auditEventsTable.targetId, sql`${accountsTable.id}::text`),
      eq(auditEventsTable.targetType, "account"),
      eq(auditEventsTable.action, "portal_v2.user.provisioned"),
      sql`${auditEventsTable.metadata}->>'role' = 'dealer'`,
    )).where(and(eq(accountsTable.role, "dealer"), eq(accountsTable.status, "pending"),
      sql`NOT EXISTS (SELECT 1 FROM audit_events later WHERE later.target_id = ${accountsTable.id}::text
        AND later.target_type = 'account' AND later.action = 'portal_v2.user.updated'
        AND later.created_at >= ${auditEventsTable.createdAt}
        AND later.metadata->'changed' @> '["status"]'::jsonb)`,
    ));
  let repaired = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    if (!candidate.actorAccountId) { skipped++; continue; }
    try {
      const changed = await db.transaction(async tx => {
        const [current] = await tx.select().from(accountsTable).where(eq(accountsTable.email, candidate.email)).limit(1).for("update");
        if (!current || current.role !== "dealer" || current.status !== "pending") return false;
        const [laterDecision] = await tx.select({ id: auditEventsTable.id }).from(auditEventsTable).where(and(
          eq(auditEventsTable.targetId, current.id), eq(auditEventsTable.targetType, "account"),
          eq(auditEventsTable.action, "portal_v2.user.updated"), gte(auditEventsTable.createdAt, candidate.provisionedAt),
          sql`${auditEventsTable.metadata}->'changed' @> '["status"]'::jsonb`,
        )).limit(1);
        if (laterDecision) return false;
        const result = await provisionDealer(tx, { email: candidate.email, actorAccountId: candidate.actorAccountId! });
        await tx.insert(auditEventsTable).values({
          actorAccountId: candidate.actorAccountId, action: "portal_v2.dealer.preapproval.repaired",
          targetType: "account", targetId: result.account.id,
        });
        return true;
      });
      if (changed) repaired++;
      else skipped++;
    } catch (error) {
      if (!(error instanceof DealerProvisioningConflict)) throw error;
      skipped++;
    }
  }
  return { repaired, skipped };
}
