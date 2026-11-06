// Recover even when the main module never loads and React cannot show its update prompt.
(() => {
  const base = new URL("./", document.currentScript.src);

  function entryPath(src) {
    const url = new URL(src, base);
    const path = url.pathname;
    return url.origin === base.origin &&
      path.startsWith(base.pathname + "assets/") &&
      /\/index-[\w-]+\.js$/.test(path) ? path : null;
  }

  function handleError(event) {
    const script = event.target;
    if (!(script instanceof HTMLScriptElement) || script.type !== "module" || !script.src) return;
    const failedEntry = entryPath(script.src);
    if (!failedEntry) return;
    window.removeEventListener("error", handleError, true);

    const status = document.getElementById("portal-start-status");
    const retry = document.getElementById("portal-start-retry");
    if (status) {
      status.setAttribute("role", "status");
      status.textContent = "The portal could not load. Reconnect if offline, then refresh.";
    }
    if (retry) {
      retry.hidden = false;
      retry.addEventListener("click", () => window.location.reload());
    }

    if (navigator.onLine !== false) void recover(failedEntry);
    else window.addEventListener("online", () => void recover(failedEntry), { once: true });
  }

  async function recover(failedEntry) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(new URL("app-version.json", base), {
        cache: "no-store", credentials: "omit", redirect: "error", signal: controller.signal,
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
      const release = await response.json();
      if (release?.schemaVersion !== 1 || typeof release.entry !== "string") return;
      const nextEntry = entryPath(release.entry);
      if (!nextEntry || nextEntry === failedEntry) return;
      // Share the one-reload-per-release guard with the in-app updater.
      if (sessionStorage.getItem("kessick-applied-release") === nextEntry) return;
      sessionStorage.setItem("kessick-applied-release", nextEntry);
      window.location.reload();
    } catch {
      // Keep the explicit refresh button when automatic recovery cannot run.
    } finally {
      clearTimeout(timeout);
    }
  }

  window.addEventListener("error", handleError, true);
})();
