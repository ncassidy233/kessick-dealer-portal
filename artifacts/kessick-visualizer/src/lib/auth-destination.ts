export function validateAuthDestination(raw: string | null, origin: string, basePath = ""): string {
  const fallback = `${basePath}/continue`;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const target = new URL(raw, origin);
    if (target.origin !== origin) return fallback;
    const oauth = target.pathname === "/api/oauth/authorize";
    let path = target.pathname;
    if (basePath && !oauth && path !== basePath && !path.startsWith(`${basePath}/`)) path = `${basePath}${path}`;
    const localPath = basePath && path.startsWith(`${basePath}/`) ? path.slice(basePath.length) : path;
    if (/^\/(?:sign-in|sign-up)(?:\/|$)/i.test(localPath)) return fallback;
    if (!oauth && !/^\/(?:continue|portal|admin|workspace|account|invitation|pending-approval|forbidden|demo)(?:\/|$)/.test(localPath)) return fallback;
    return `${path}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
