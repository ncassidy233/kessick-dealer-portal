import { db, portalAccessRulesTable } from "@workspace/db";
import { eq, inArray, or } from "drizzle-orm";

/** Preserves the legacy access-rule precedence for v2 content surfaces. */
export async function resolvedLegacyPortalCapabilities(
  accountId: string,
  groupIds: string[],
): Promise<Map<string, boolean>> {
  const rules = await db.select().from(portalAccessRulesTable).where(
    groupIds.length
      ? or(inArray(portalAccessRulesTable.groupId, groupIds), eq(portalAccessRulesTable.accountId, accountId))
      : eq(portalAccessRulesTable.accountId, accountId),
  );
  const result = new Map<string, boolean>();
  for (const rule of rules.filter((rule) => rule.subjectType === "group")) {
    result.set(rule.capability, result.get(rule.capability) === false ? false : rule.enabled);
  }
  for (const rule of rules.filter((rule) => rule.subjectType === "account")) result.set(rule.capability, rule.enabled);
  return result;
}

export async function canViewLegacyPortalCapability(
  accountId: string,
  groupIds: string[],
  capability: string,
  defaultValue = true,
): Promise<boolean> {
  const value = (await resolvedLegacyPortalCapabilities(accountId, groupIds)).get(capability);
  return value === undefined ? defaultValue : value;
}