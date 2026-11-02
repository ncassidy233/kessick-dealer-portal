import type { PageKey } from "./page-studio";

export const portalSections = {
  home: { label: "Dashboard", dealerPath: "/portal", page: "home", kinds: ["announcement"], capability: "content:read" },
  projects: { label: "Projects", dealerPath: "/portal/projects", page: "projects", kinds: ["project"], capability: "content:read" },
  collections: { label: "Collections", dealerPath: "/portal/collections", page: "collections", kinds: ["product_series", "finish"], capability: "content:read" },
  training: { label: "Training", dealerPath: "/portal/training", page: "training", kinds: ["training", "launch_kit"], capability: "content:read" },
  resources: { label: "Resources", dealerPath: "/portal/resources", page: "resources", kinds: ["resource", "resource_category"], capability: "content:read" },
  forms: { label: "Forms & support", dealerPath: "/portal/forms", kinds: ["form"], capability: "content:read" },
  pricing: { label: "Pricing", dealerPath: "/portal/pricing", staffPath: "/admin/pricing", capability: "pricing:read" },
  notifications: { label: "Notices", dealerPath: "/portal/notifications", staffPath: "/admin/notifications", capability: "notifications:read" },
  account: { label: "Accounts", dealerPath: "/portal/account", staffPath: "/admin/users", capability: "users:read" },
} as const;
export type PortalSection = keyof typeof portalSections;
export const asPortalSection = (value: string | null): PortalSection | undefined =>
  value && Object.hasOwn(portalSections, value) ? value as PortalSection : undefined;
export const sectionPage = (section: PortalSection): PageKey | undefined => {
  const item = portalSections[section]; return "page" in item ? item.page : undefined;
};
export const sectionKinds = (section?: PortalSection): readonly string[] => {
  const item = section && portalSections[section]; return item && "kinds" in item ? item.kinds : [];
};
export function dealerContextId(search: string) {
  const value = new URLSearchParams(search).get("dealer");
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : undefined;
}
export function sectionEditorHref(section: PortalSection, mode: "content" | "layout" = "content", dealer?: string) {
  const params = new URLSearchParams(mode === "layout" ? { page: sectionPage(section) ?? "home" } : { section });
  if (dealer && dealerContextId(`dealer=${dealer}`)) params.set("dealer", dealer);
  return `/admin/${mode === "layout" ? "page-studio" : "content"}?${params}`;
}
export function staffRouteSection(path: string, search: string): PortalSection | undefined {
  const params = new URLSearchParams(search);
  if (path === "/admin/page-studio") {
    const section = asPortalSection(params.get("page"));
    return section && sectionPage(section) ? section : "home";
  }
  if (path === "/admin/content") return asPortalSection(params.get("section"));
  return (Object.keys(portalSections) as PortalSection[]).find(key => "staffPath" in portalSections[key] && (portalSections[key] as { staffPath: string }).staffPath === path);
}
export function portalSwitchDestinations(path: string, search: string, capabilities: readonly string[], selectedDealer?: string) {
  const section = (Object.keys(portalSections) as PortalSection[]).find(key => portalSections[key].dealerPath === path.replace(/\/$/, "")) ?? staffRouteSection(path, search);
  const dealer = selectedDealer ?? dealerContextId(search);
  let staffHref = path.startsWith("/admin") ? `${path}${search ? `?${search}` : ""}` : "/admin";
  if (!path.startsWith("/admin") && section && capabilities.includes(portalSections[section].capability)) {
    const item = portalSections[section];
    staffHref = "staffPath" in item ? item.staffPath : sectionEditorHref(section, section === "home" ? "layout" : "content", dealer);
  }
  const dealerPath = section ? portalSections[section].dealerPath : "/portal";
  return { staffHref, dealerHref: dealer && capabilities.includes("dealer-view:read") ? `/admin/dealer-view/${dealer}${dealerPath}` : dealerPath };
}
