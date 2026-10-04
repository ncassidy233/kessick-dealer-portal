import { accountsTable, db, dealerOrganizationsTable, organizationMembershipsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

/** The single eligibility definition for any private dealer delivery or access. */
export function hasApprovedDealerEligibility(
  account: { role: string; status: string },
  membership: { status: string } | null,
  organization: { status: string } | null,
): boolean {
  return account.role === "dealer" && account.status === "approved" &&
    membership?.status === "approved" && organization?.status === "approved";
}

export async function approvedDealerAccountIds(accountIds?: readonly string[]): Promise<string[]> {
  if (accountIds && accountIds.length === 0) return [];
  const rows = await db.select({ id: accountsTable.id })
    .from(accountsTable)
    .innerJoin(organizationMembershipsTable, eq(organizationMembershipsTable.accountId, accountsTable.id))
    .innerJoin(dealerOrganizationsTable, eq(dealerOrganizationsTable.id, organizationMembershipsTable.organizationId))
    .where(and(
      eq(accountsTable.role, "dealer"),
      eq(accountsTable.status, "approved"),
      eq(organizationMembershipsTable.status, "approved"),
      eq(dealerOrganizationsTable.status, "approved"),
      accountIds ? inArray(accountsTable.id, [...new Set(accountIds)]) : undefined,
    ));
  return [...new Set(rows.map((row) => row.id))];
}

export async function isApprovedDealerAccount(accountId: string): Promise<boolean> {
  return (await approvedDealerAccountIds([accountId])).length === 1;
}