// This prompt must work even when an installed copy's React bundle is gone.
(() => {
  const base = new URL('./', document.currentScript.src);
  const button = document.getElementById('update-now');
  const status = document.getElementById('update-status');
  if (!button || !status) return;

  function destination() {
    const fallback = new URL('portal', base);
    try {
      const recovery = new URL(window.location.href);
      const value = recovery.searchParams.get('returnTo');
      const target = value ? new URL(value, base) : fallback;
      const pathname = decodeURIComponent(target.pathname);
      if (target.origin !== base.origin || !pathname.startsWith(base.pathname)) return fallback;
      const relative = pathname.slice(base.pathname.length);
      // Only application routes are valid. Never navigate into the API, a
      // downloadable file, another origin, or this recovery page again.
      if (/^api(?:\/|$)/i.test(relative) || /(?:^|\/)\.{1,2}(?:\/|$)/.test(relative)
        || /(?:^|\/)[^/]*\.[^/]*(?:\/|$)/.test(relative)) return fallback;
      // Keep fragments on the client, never promote them into a request query.
      if (!target.hash) target.hash = recovery.hash;
      if (/^(portal|admin)\/preview\/?$/.test(relative)) {
        target.pathname = base.pathname + relative.split('/')[0];
        target.hash = '';
      }
      return target;
    } catch { return fallback; }
  }

  function acknowledge(event) {
    if (event.data?.type === 'KESSICK_RELEASE_READY') {
      event.source?.postMessage({ type: 'KESSICK_UPDATE_CLIENT' });
    }
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', acknowledge);
    navigator.serviceWorker.controller?.postMessage({ type: 'KESSICK_UPDATE_CLIENT' });
  }

  async function prepareWorker() {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const registration = await navigator.serviceWorker.register(new URL('sw.js', base).href, {
      scope: base.pathname, updateViaCache: 'none',
    });
    await registration.update();
    const worker = registration.installing || registration.waiting;
    if (!worker || worker.state === 'activated' || worker.state === 'redundant') return;
    await new Promise(resolve => {
      const changed = () => {
        if (worker.state !== 'activated' && worker.state !== 'redundant') return;
        worker.removeEventListener('statechange', changed);
        resolve();
      };
      worker.addEventListener('statechange', changed);
      changed();
    });
  }

  let updating = false;
  button.addEventListener('click', async () => {
    if (updating) return;
    if (navigator.onLine === false) {
      status.textContent = 'You are offline. Reconnect, then tap Update now.';
      return;
    }
    updating = true;
    button.disabled = true;
    status.textContent = 'Opening the latest portal…';
    let timeout;
    try {
      // An old/stalled worker must not prevent an explicit fresh navigation.
      await Promise.race([
        prepareWorker().catch(() => {}),
        new Promise(resolve => { timeout = setTimeout(resolve, 3000); }),
      ]);
      const target = destination();
      target.searchParams.set('_kessick_update', Date.now().toString(36));
      window.location.replace(target.href);
    } catch {
      updating = false;
      button.disabled = false;
      status.textContent = 'The update could not open. Please try again.';
    } finally {
      clearTimeout(timeout);
    }
  });

  if (navigator.onLine === false) status.textContent = 'You are offline. Reconnect, then tap Update now.';
  window.addEventListener('online', () => {
    if (!updating) status.textContent = 'Ready to update.';
  });
})();
