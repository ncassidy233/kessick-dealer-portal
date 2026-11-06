import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { appEntryVersion, canAutomaticallyRefresh, createAppUpdateCheck } from "../lib/app-updates";

export function AppUpdateBanner({ onRefresh }: { onRefresh: () => void }) {
  return <aside role="status" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[90] mx-auto max-w-md rounded-lg border border-[#b39862] bg-[#171715] p-4 text-white shadow-xl md:inset-x-auto md:bottom-6 md:right-6">
    <p className="text-sm font-semibold">Portal update ready</p><p className="mt-1 text-xs leading-relaxed text-white/80">Save your work, then refresh to see the latest changes. You do not need to reinstall the app.</p>
    <button type="button" onClick={onRefresh} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#b39862] px-4 text-sm font-semibold text-[#121210] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#171715]">
      <RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh app
    </button>
  </aside>;
}

export function AppUpdateNotice() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const src = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
    const currentVersion = src && appEntryVersion(src, baseUrl);
    if (!currentVersion) return;
    let registration: ServiceWorkerRegistration | undefined;
    let stopped = false;
    let nextVersion: string | undefined;
    let reloading = false;
    let lastWorkerCheck = -Infinity;
    let lastInteraction = Date.now();
    let inputPath: string | undefined;
    const canCheck = () => document.visibilityState !== "hidden" && navigator.onLine !== false;
    const refreshIfSafe = () => {
      if (!nextVersion || reloading) return;
      const relative = window.location.pathname.slice(new URL(baseUrl).pathname.length);
      const hasFocusedField = document.activeElement instanceof HTMLElement
        && document.activeElement.matches("input,textarea,select,[contenteditable='true']");
      if (!canAutomaticallyRefresh({ pathname: `/${relative}`,
        hasInput: inputPath === window.location.pathname,
        hasDialog: Boolean(document.querySelector('[role="dialog"],dialog[open],[aria-modal="true"]')),
        hasFocusedField, idleMs: Date.now() - lastInteraction,
        visible: document.visibilityState !== "hidden", online: navigator.onLine !== false,
      })) return;
      // A broken old worker must not create a reload loop. Never clear sign-in data.
      try {
        if (sessionStorage.getItem("kessick-applied-release") === nextVersion) return;
        sessionStorage.setItem("kessick-applied-release", nextVersion);
      } catch {
        // Without a persistent reload guard, a stale CDN response could loop.
        // Keep the visible refresh button for browsers that block storage.
        return;
      }
      reloading = true;
      window.location.reload();
    };
    const checker = createAppUpdateCheck({ currentVersion, baseUrl,
      isVisible: canCheck,
      onUpdate: (version) => { nextVersion = version; setAvailable(true); refreshIfSafe(); },
    });
    const check = () => {
      if (!canCheck()) return;
      if (registration && Date.now() - lastWorkerCheck >= 30_000) {
        lastWorkerCheck = Date.now();
        void registration.update().catch(() => {});
      }
      void checker.check();
      refreshIfSafe();
    };
    const interaction = () => { lastInteraction = Date.now(); };
    const input = () => { inputPath = window.location.pathname; interaction(); };
    const workerMessage = (event: MessageEvent) => {
      if (event.data?.type === "KESSICK_RELEASE_READY") check();
    };
    // Replace the legacy offline demo worker at its existing URL and scope.
    // The new worker never caches authentication, API responses or portal pages.
    if ("serviceWorker" in navigator && window.isSecureContext && window.self === window.top) {
      void navigator.serviceWorker.register(new URL("sw.js", baseUrl).href, {
        scope: new URL(baseUrl).pathname, updateViaCache: "none",
      }).then((value) => { if (!stopped) { registration = value; check(); } }).catch(() => {});
      navigator.serviceWorker.addEventListener("controllerchange", check);
      navigator.serviceWorker.addEventListener("message", workerMessage);
    }
    document.addEventListener("visibilitychange", check);
    document.addEventListener("input", input, true);
    document.addEventListener("change", input, true);
    document.addEventListener("pointerdown", interaction, true);
    document.addEventListener("keydown", interaction, true);
    window.addEventListener("pageshow", check);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    const interval = window.setInterval(check, 30_000);
    const refreshInterval = window.setInterval(refreshIfSafe, 5_000);
    check();
    return () => {
      stopped = true;
      checker.stop(); window.clearInterval(interval); window.clearInterval(refreshInterval);
      document.removeEventListener("visibilitychange", check);
      document.removeEventListener("input", input, true);
      document.removeEventListener("change", input, true);
      document.removeEventListener("pointerdown", interaction, true);
      document.removeEventListener("keydown", interaction, true);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("controllerchange", check);
        navigator.serviceWorker.removeEventListener("message", workerMessage);
      }
    };
  }, []);
  return available ? <AppUpdateBanner onRefresh={() => window.location.reload()} /> : null;
}
