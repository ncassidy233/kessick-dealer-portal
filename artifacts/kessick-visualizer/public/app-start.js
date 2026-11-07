// Register the update channel before React loads. A missing/old entry bundle
// must not be the only route by which an installed app can receive its fix.
(() => {
  const base = new URL("./", document.currentScript.src);

  try {
    if (new URL(window.location.href).searchParams.has('_kessick_update')) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete('_kessick_update');
      window.history.replaceState(window.history.state, '', clean.href);
    }
  } catch {}

  let workerRegistration;
  let workerCheck;
  let lastWorkerCheck = -Infinity;
  const canUseWorker = 'serviceWorker' in navigator && window.isSecureContext && window.self === window.top;
  function acknowledge(worker = navigator.serviceWorker?.controller) {
    try { worker?.postMessage({ type: 'KESSICK_UPDATE_CLIENT' }); } catch {}
  }
  function checkWorker() {
    if (!canUseWorker || navigator.onLine === false || document.visibilityState === 'hidden'
      || workerCheck || Date.now() - lastWorkerCheck < 5000) return;
    lastWorkerCheck = Date.now();
    let timeout;
    const preparation = (async () => {
      workerRegistration = workerRegistration || await navigator.serviceWorker.register(new URL('sw.js', base).href, {
        scope: base.pathname, updateViaCache: 'none',
      });
      acknowledge();
      await workerRegistration.update();
    })();
    workerCheck = Promise.race([
      preparation,
      new Promise(resolve => { timeout = setTimeout(resolve, 10_000); }),
    ]).catch(() => {}).finally(() => { clearTimeout(timeout); workerCheck = undefined; });
  }
  if (canUseWorker) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'KESSICK_RELEASE_READY') acknowledge(event.source);
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => acknowledge());
    document.addEventListener('visibilitychange', checkWorker);
    window.addEventListener('pageshow', checkWorker);
    window.addEventListener('online', checkWorker);
    window.addEventListener('focus', checkWorker);
    acknowledge();
    checkWorker();
  }

  function showUpdatePrompt() {
    if (navigator.onLine === false) {
      const status = document.getElementById('portal-start-status');
      if (status) status.textContent = 'Reconnect to the internet, then tap Update now.';
      return;
    }
    const target = new URL('app-update.html', base);
    target.searchParams.set('returnTo', window.location.pathname + window.location.search);
    target.hash = window.location.hash;
    window.location.replace(target.href);
  }

  function entryPath(src) {
    try {
      const url = new URL(src, base);
      const path = url.pathname;
      return url.origin === base.origin &&
        path.startsWith(base.pathname + "assets/") &&
        /\/index-[\w-]+\.js$/.test(path) ? path : null;
    } catch { return null; }
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
      retry.textContent = 'Update now';
      retry.addEventListener("click", showUpdatePrompt);
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
      // The independent prompt works without React, preserves sign-in/storage,
      // and cannot enter an automatic reload loop if the network stays stale.
      showUpdatePrompt();
    } catch {
      // Keep the explicit refresh button when automatic recovery cannot run.
    } finally {
      clearTimeout(timeout);
    }
  }

  window.addEventListener("error", handleError, true);
})();
