import { createContext, useContext, useEffect, useState } from "react";
import { defaultPortalPublicBranding, publicPortalBranding, type PortalPublicBranding } from "@workspace/api-zod";
import { installPublishedBrandingRefresh } from "./public-branding-refresh";

export { defaultPortalPublicBranding };
export { notifyPublishedPortalBranding } from "./public-branding-refresh";
export type { PortalPublicBranding };

export const PublicBrandingContext = createContext(defaultPortalPublicBranding);

export function usePublicBranding(override?: PortalPublicBranding) {
  const published = useContext(PublicBrandingContext);
  return override ?? published;
}

/** No session or private portal bootstrap is required to load published branding. */
export function usePublishedPortalBranding() {
  const [branding, setBranding] = useState<PortalPublicBranding>(defaultPortalPublicBranding);
  useEffect(() => installPublishedBrandingRefresh({
    windowTarget: window,
    documentTarget: document,
    isVisible: () => document.visibilityState !== "hidden",
    onValue: setBranding,
    read: async (signal) => {
      const response = await fetch("/api/public/portal-branding", {
        cache: "no-store", credentials: "omit", signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const result: unknown = await response.json();
      if (!result || typeof result !== "object" || !("branding" in result)) return;
      return publicPortalBranding(result.branding) ?? defaultPortalPublicBranding;
    },
  }), []);
  return branding;
}
