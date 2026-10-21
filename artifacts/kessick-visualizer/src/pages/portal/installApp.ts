/*
 * Installing the portal as an app on the dealer's device.
 *
 * Chrome, Edge and Android fire `beforeinstallprompt` once the page is
 * installable; we keep that event so the footer button can open the
 * browser's own install dialog in one tap. Safari has no such event, so
 * iPhone and Mac dealers get the Add to Home Screen steps instead.
 */
import { useEffect, useState } from "react";

/** Where dealers install from. A copy of the portal inside another page can't be installed. */
export const PORTAL_URL = "https://kessick-dealer-black.onrender.com/";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const CHANGE = "kessick-install-change";
let deferred: InstallPromptEvent | null = null;
let installed = false;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the browser's mini bar from showing; the footer button offers it instead.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    window.dispatchEvent(new Event(CHANGE));
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installed = true;
    window.dispatchEvent(new Event(CHANGE));
  });
}

/** True when the portal is already running as an installed app. */
export function isRunningAsApp() {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    installed ||
    nav.standalone === true ||
    ["standalone", "fullscreen", "minimal-ui"].some((m) => window.matchMedia?.(`(display-mode: ${m})`).matches)
  );
}

export function isEmbedded() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export type InstallPlatform = "ios-safari" | "ios-other" | "android" | "mac-safari" | "desktop";

export function installPlatform(ua = navigator.userAgent): InstallPlatform {
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua) ? "ios-other" : "ios-safari";
  if (/Android/i.test(ua)) return "android";
  if (/Macintosh/i.test(ua) && /Safari/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua)) return "mac-safari";
  return "desktop";
}

/** Opens the browser's install dialog. Returns null when the browser didn't offer one. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  const event = deferred;
  if (!event) return null;
  deferred = null;
  window.dispatchEvent(new Event(CHANGE));
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

/** Live install state for the footer button. */
export function useInstallState() {
  const [state, setState] = useState(() => ({ canPrompt: Boolean(deferred), installed: isRunningAsApp() }));
  useEffect(() => {
    const sync = () => setState({ canPrompt: Boolean(deferred), installed: isRunningAsApp() });
    window.addEventListener(CHANGE, sync);
    const media = window.matchMedia?.("(display-mode: standalone)");
    media?.addEventListener?.("change", sync);
    return () => {
      window.removeEventListener(CHANGE, sync);
      media?.removeEventListener?.("change", sync);
    };
  }, []);
  return state;
}
