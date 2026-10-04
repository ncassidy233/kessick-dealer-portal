const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function getValidatedAuthRedirect(): string {
  const fallback = `${basePath}/workspace`;
  const raw = new URLSearchParams(window.location.search).get('redirect_url');
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return fallback;

  try {
    const target = new URL(raw, window.location.origin);
    if (target.origin !== window.location.origin) return fallback;
    const localTarget = `${target.pathname}${target.search}${target.hash}`;
    const isOAuthAuthorization =
      target.pathname === '/api/oauth/authorize';
    if (
      basePath
      && !isOAuthAuthorization
      && localTarget !== basePath
      && !localTarget.startsWith(`${basePath}/`)
    ) {
      return `${basePath}${localTarget}`;
    }
    return localTarget;
  } catch {
    return fallback;
  }
}

export function authRouteWithRedirect(route: '/sign-in' | '/sign-up', redirect: string): string {
  return `${basePath}${route}?redirect_url=${encodeURIComponent(redirect)}`;
}