export const allowedConciergeScopes = [
  "catalog:read",
  "project:read",
  "concierge:ask",
  "action:confirm",
  "mcp:use",
] as const;

const allowedScopeSet = new Set<string>(allowedConciergeScopes);

export function parsePersistedConciergeScopes(value: unknown): string[] | null {
  const values = typeof value === "string"
    ? value.split(" ").filter(Boolean)
    : Array.isArray(value)
      ? value
      : null;
  if (
    !values ||
    values.length === 0 ||
    values.some((scope) => typeof scope !== "string" || !allowedScopeSet.has(scope))
  ) return null;
  return [...new Set(values as string[])];
}

export function hasConciergeScope(
  scopes: readonly string[] | undefined,
  requiredScope: string,
) {
  return Boolean(scopes?.includes(requiredScope));
}

export function assertProjectReadScope(scopes: readonly string[] | undefined) {
  if (!hasConciergeScope(scopes, "project:read")) {
    throw new Error("PROJECT_SCOPE_REQUIRED");
  }
}