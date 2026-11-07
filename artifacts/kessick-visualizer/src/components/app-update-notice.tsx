import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { appEntryVersion, createAppUpdateCheck, freshAppUrl, prepareAppUpdate } from "../lib/app-updates";

export function AppUpdateBanner({ onRefresh, updating = false, error }: { onRefresh: () => void; updating?: boolean; error?: string }) {
  return <aside role="status" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[90] mx-auto max-w-md rounded-lg border border-[#b39862] bg-[#171715] p-4 text-white shadow-xl md:inset-x-auto md:bottom-6 md:right-6">
    <p className="text-sm font-semibold">Portal update ready</p><p className="mt-1 text-xs leading-relaxed text-white/80">Save any open work, then update to load the latest version.</p>
    <button type="button" onClick={onRefresh} disabled={updating} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#b39862] px-4 text-sm font-semibold text-[#121210] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#171715] disabled:opacity-70">
      <RefreshCw aria-hidden="true" className="h-4 w-4" />{updating ? "Updating…" : "Update now"}
    </button>
    {error && <p role="alert" className="mt-2 text-xs leading-relaxed text-white/90">{error}</p>}
  </aside>;
}

export function AppUpdateNotice() {
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string>();
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const src = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
    const currentVersion = src && appEntryVersion(src, baseUrl);
    if (!currentVersion) return;
    const currentReleaseId = document.querySelector<HTMLMetaElement>('meta[name="kessick-release"]')?.content;
    let registration: ServiceWorkerRegistration | undefined;
    let stopped = false;
    let lastWorkerCheck = -Infinity;
    const canCheck = () => document.visibilityState !== "hidden" && navigator.onLine !== false;
    const checker = createAppUpdateCheck({ currentVersion, currentReleaseId, baseUrl,
      isVisible: canCheck,
      onUpdate: () => setAvailable(true),
    });
    const check = () => {
      if (!canCheck()) return;
      if (registration && Date.now() - lastWorkerCheck >= 30_000) {
        lastWorkerCheck = Date.now();
        void registration.update().catch(() => {});
      }
      void checker.check();
    };
    const workerMessage = (event: MessageEvent) => {
      if (event.data?.type === "KESSICK_RELEASE_READY") {
        (event.source as ServiceWorker | null)?.postMessage({ type: "KESSICK_UPDATE_CLIENT" });
        check();
      }
    };
    const preloadError = () => { void checker.check({ force: true }); };
    // Replace the legacy offline demo worker at its existing URL and scope.
    // The new worker never caches authentication, API responses or portal pages.
    if ("serviceWorker" in navigator && window.isSecureContext && window.self === window.top) {
      void navigator.serviceWorker.register(new URL("sw.js", baseUrl).href, {
        scope: new URL(baseUrl).pathname, updateViaCache: "none",
      }).then((value) => {
        if (!stopped) {
          registration = value;
          navigator.serviceWorker.controller?.postMessage({ type: "KESSICK_UPDATE_CLIENT" });
          check();
        }
      }).catch(() => {});
      navigator.serviceWorker.addEventListener("controllerchange", check);
      navigator.serviceWorker.addEventListener("message", workerMessage);
    }
    document.addEventListener("visibilitychange", check);
    // A resumed tab may request a lazy chunk removed by the new deploy.
    window.addEventListener("vite:preloadError", preloadError);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    const interval = window.setInterval(check, 30_000);
    check();
    return () => {
      stopped = true;
      checker.stop(); window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("vite:preloadError", preloadError);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", check);
        navigator.serviceWorker.removeEventListener("message", workerMessage);
      }
    };
  }, []);
  const refresh = async () => {
    if (updating) return;
    if (navigator.onLine === false) {
      setUpdateError("Reconnect to the internet, then tap Update now.");
      return;
    }
    setUpdating(true);
    setUpdateError(undefined);
    try {
      const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
      await prepareAppUpdate("serviceWorker" in navigator ? navigator.serviceWorker : undefined, baseUrl);
      window.location.replace(freshAppUrl(window.location.href, baseUrl));
    } catch {
      setUpdateError("The update could not open. Please try again.");
    } finally {
      // A user can cancel the editor's beforeunload prompt to save their work.
      // location.replace then returns normally, so the button must be usable again.
      setUpdating(false);
    }
  };
  return available ? <AppUpdateBanner onRefresh={() => { void refresh(); }} updating={updating} error={updateError} /> : null;
}
