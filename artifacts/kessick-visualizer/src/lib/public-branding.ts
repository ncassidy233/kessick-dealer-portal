import { useEffect, useState } from "react";
import { defaultPortalPublicBranding, publicPortalBranding, type PortalPublicBranding } from "@workspace/api-zod";

export { defaultPortalPublicBranding };
export type { PortalPublicBranding };

/** No session or private portal bootstrap is required to render the sign-in page. */
export function usePublicBranding(override?: PortalPublicBranding) {
  const [branding, setBranding] = useState<PortalPublicBranding>(defaultPortalPublicBranding);
  useEffect(() => {
    if (override) return;
    const controller = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const response = await fetch("/api/public/portal-branding", {
          cache: "no-store", credentials: "omit", signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!response.ok) return;
        const result: unknown = await response.json();
        if (!result || typeof result !== "object" || !("branding" in result)) return;
        const next = publicPortalBranding(result.branding) ?? defaultPortalPublicBranding;
        if (!controller.signal.aborted) setBranding(next);
      } catch { /* The existing Kessick design remains usable during an outage. */ }
      finally { pending = false; }
    };
    void refresh();
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      controller.abort();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [override]);
  return override ?? branding;
}
