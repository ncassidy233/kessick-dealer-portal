export interface StaffDealerView {
  selectedDealerAccountId: string;
  readOnly: true;
}

const dealerReads = /^\/api\/(?:portal-v2\/(?:bootstrap|content|projects|notifications|notification-preferences)|dealer-portal\/(?:dashboard|access|pricing|resources|forms|push-config|resources\/[0-9a-f-]{36}\/file))$/;
const portalPage = /^\/portal(?:\/(?:projects|collections|training|pricing|resources|forms|notifications|account))?\/?$/;

export function dealerReadUrl(path: string, view: StaffDealerView | null) {
  if (!view) return path;
  const [pathname] = path.split("?");
  if (!dealerReads.test(pathname)) throw new Error("This read is unavailable in Staff View.");
  return `/api/staff/dealer-view/${encodeURIComponent(view.selectedDealerAccountId)}${path.slice(4)}`;
}

export function dealerQueryKey(key: readonly unknown[], view: StaffDealerView | null) {
  return view ? ["staff-dealer-view", view.selectedDealerAccountId, ...key] : key;
}

export function portalDestination(path: string, view: StaffDealerView | null) {
  if (!view || !portalPage.test(path.split(/[?#]/)[0])) return path;
  return `/admin/dealer-view/${encodeURIComponent(view.selectedDealerAccountId)}${path}`;
}

export function dealerContentDestination(href: string, view: StaffDealerView | null, origin: string, base: string) {
  if (!href.trim() || /[\s\\\u0000-\u001f\u007f]/.test(href)) return null;
  if (!/^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href)) return null;
  let url: URL;
  try { url = new URL(href, origin); } catch { return null; }
  if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) return null;
  if (url.username || url.password) return null;
  if (!view) return href;
  if (url.origin !== origin) return url.href;
  const prefix = base.replace(/\/$/, "");
  const path = prefix && url.pathname.startsWith(`${prefix}/`) ? url.pathname.slice(prefix.length) : url.pathname;
  if (portalPage.test(path)) return `${prefix}${portalDestination(`${path}${url.search}${url.hash}`, view)}`;
  if (/^\/api\/dealer-portal\/resources\/[0-9a-f-]{36}\/file$/.test(path) && !url.search) return dealerReadUrl(path, view);
  return null;
}

export function assertDealerWritable(view: StaffDealerView | null) {
  if (view?.readOnly) throw new Error("Staff View is read-only.");
}
