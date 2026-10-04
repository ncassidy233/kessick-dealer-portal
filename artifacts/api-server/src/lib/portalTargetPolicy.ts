export type VisibilityTarget = {
  groupId: string | null;
  accountId: string | null;
};

/** Visibility is deny-by-default once an item has a v2 visibility record. */
export function isPortalTargetVisible(
  visibility: "everyone" | "groups" | "individuals",
  targets: readonly VisibilityTarget[],
  accountId: string,
  groupIds: readonly string[],
): boolean {
  if (visibility === "everyone") return true;
  if (visibility === "individuals") {
    return targets.some((target) => target.accountId === accountId);
  }
  return targets.some((target) => target.groupId !== null && groupIds.includes(target.groupId));
}

export function isMappedLegacyItemVisible(
  mappings: readonly { published: boolean; visibility: "everyone" | "groups" | "individuals"; targets: readonly VisibilityTarget[] }[],
  accountId: string,
  groupIds: readonly string[],
): boolean {
  return mappings.length === 0 || mappings.some((mapping) =>
    mapping.published && isPortalTargetVisible(mapping.visibility, mapping.targets, accountId, groupIds),
  );
}

export function shouldDisableLinkedLegacyContent(kind: string): boolean {
  return kind === "form" || kind === "resource" || kind === "price_book";
}

/** A linked resource is identified only by a UUID in the resource payload. */
export function linkedResourceId(kind: string, payload: unknown): string | null {
  if (kind !== "resource" || !payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const id = (payload as Record<string, unknown>).legacyId;
  return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id : null;
}

export function legacyPageCapabilityForContent(kind: string): string | null {
  if (kind === "form") return "page:forms";
  if (kind === "resource" || kind === "resource_category") return "page:resources";
  if (kind === "price_book") return "page:pricing";
  return null;
}