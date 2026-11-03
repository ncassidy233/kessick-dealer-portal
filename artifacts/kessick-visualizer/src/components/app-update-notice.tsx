import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { appEntryVersion, createAppUpdateCheck } from "../lib/app-updates";

export function AppUpdateBanner({ onRefresh, onDismiss }: { onRefresh: () => void; onDismiss: () => void }) {
  return <aside role="status" className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[90] mx-auto max-w-md rounded-lg border border-[#b39862] bg-[#171715] p-4 text-white shadow-xl md:inset-x-auto md:bottom-6 md:right-6">
    <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">Portal update ready</p><p className="mt-1 text-xs leading-relaxed text-white/80">Save your work, then refresh to see the latest changes.</p></div>
      <button type="button" aria-label="Dismiss update notice" onClick={onDismiss} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"><X aria-hidden="true" className="h-4 w-4" /></button>
    </div>
    <button type="button" onClick={onRefresh} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-md bg-[#b39862] px-4 text-sm font-semibold text-[#121210] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#171715]">
      <RefreshCw aria-hidden="true" className="h-4 w-4" />Refresh app
    </button>
  </aside>;
}

export function AppUpdateNotice() {
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).href;
    const src = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;
    const currentVersion = src && appEntryVersion(src, baseUrl);
    if (!currentVersion) return;
    const checker = createAppUpdateCheck({ currentVersion, baseUrl,
      isVisible: () => document.visibilityState !== "hidden",
      onUpdate: () => setAvailable(true),
    });
    const check = () => { void checker.check(); };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("pageshow", check);
    window.addEventListener("online", check);
    const interval = window.setInterval(check, 60_000);
    check();
    return () => {
      checker.stop(); window.clearInterval(interval);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("pageshow", check);
      window.removeEventListener("online", check);
    };
  }, []);
  return available && !dismissed ? <AppUpdateBanner onRefresh={() => window.location.reload()} onDismiss={() => setDismissed(true)} /> : null;
}
