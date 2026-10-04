export function resolveOAuthAuthorizationDestination(
  destination: string,
  origin: string,
  basePath: string,
) {
  try {
    const target = new URL(destination, origin);
    const oauthPaths = new Set([
      "/api/oauth/authorize",
      `${basePath}/api/oauth/authorize`,
    ]);
    return target.origin === origin && oauthPaths.has(target.pathname)
      ? target.href
      : null;
  } catch {
    return null;
  }
}