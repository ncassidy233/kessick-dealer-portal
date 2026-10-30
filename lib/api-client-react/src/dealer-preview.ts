const previewLocation = /^(?:\/[^/]+)*\/admin\/dealer-view\/([0-9a-f-]{36})(?:\/|$)/;

export function dealerPreviewAccountId(pathname: string): string | null {
  return previewLocation.exec(pathname)?.[1] ?? null;
}

export function dealerPreviewRequestUrl(url: URL, location: URL, method: string): string {
  const accountId = dealerPreviewAccountId(location.pathname);
  if (!accountId || url.origin !== location.origin || !url.pathname.startsWith("/api/")) return url.href;
  if (method !== "GET") throw new Error("Dealer View is read-only. Return to Administration to make changes.");
  if (/^\/api\/(?:dealer-portal|portal-v2\/(?:content|projects|notifications|notification-preferences))(?:\/|$)/.test(url.pathname)) {
    return `${url.origin}/api/staff/dealer-view/${accountId}${url.pathname.slice(4)}${url.search}`;
  }

  return url.href;
}

export function dealerPreviewLinkUrl(href: string, location: URL, basePath: string): string | null {
  const url = new URL(href, location);
  if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return null;
  if (url.origin !== location.origin) return url.href;
  const accountId = dealerPreviewAccountId(location.pathname);
  if (!accountId) return null;
  const base = basePath.replace(/\/$/, "");
  const path = base && url.pathname.startsWith(`${base}/`) ? url.pathname.slice(base.length) : url.pathname;
  if (/^\/portal(?:\/(?:projects|collections|training|pricing|resources|forms|notifications|account))?\/?$/.test(path)) {
    return `${url.origin}${base}/admin/dealer-view/${accountId}${path}${url.search}${url.hash}`;
  }
  if (url.pathname.startsWith(`${base}/admin/dealer-view/${accountId}/portal`)) return url.href;
  const readUrl = dealerPreviewRequestUrl(url, location, "GET");
  return readUrl !== url.href ? readUrl : null;
}
