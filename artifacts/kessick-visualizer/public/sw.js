// Always use the current online application. Remove only legacy Kessick demo
// caches; authentication cookies, drafts and other browser storage are untouched.
const updateClients = new Set();
const pendingClientChecks = new Map();

function sendReleaseNotice(client) {
  try { client.postMessage({ type: 'KESSICK_RELEASE_READY' }); } catch {}
}

function isAppClient(client) {
  try {
    const scope = new URL(self.registration.scope);
    const url = new URL(client.url);
    return client.frameType === 'top-level' && url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
  } catch { return false; }
}

function legacyReturnPath(client) {
  // A worker cannot inspect unsaved form input. Only migrate a top-level,
  // read-only landing/demo home, never an editor, sign-in, or form route.
  // This includes a saved home reopening in the foreground: old copies have
  // no update listener and may make no further background requests.
  if (client.frameType !== 'top-level') return null;
  const scope = new URL(self.registration.scope);
  const url = new URL(client.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || url.hash) return null;
  const relative = url.pathname.slice(scope.pathname.length);
  if (!['', 'index.html', 'portal/preview', 'portal/preview/', 'admin/preview', 'admin/preview/'].includes(relative)) return null;
  if (relative.startsWith('portal/preview')) url.pathname = scope.pathname + 'portal';
  if (relative.startsWith('admin/preview')) url.pathname = scope.pathname + 'admin';
  return url.pathname + url.search;
}

async function notifyOrMigrate(client) {
  if (!isAppClient(client)) return;
  sendReleaseNotice(client);
  if (updateClients.has(client.id) || pendingClientChecks.has(client.id) || !legacyReturnPath(client)) return;
  // New clients acknowledge the notice, including while React is booting.
  // Very old installed demos have no listener; they need a plain update page.
  const check = new Promise(resolve => setTimeout(resolve, 1500));
  pendingClientChecks.set(client.id, check);
  try {
    await check;
    if (updateClients.has(client.id)) return;
    const current = await self.clients.get(client.id);
    if (!current) return;
    const returnTo = legacyReturnPath(current);
    if (!returnTo) return;
    const target = new URL('app-update.html', self.registration.scope);
    target.searchParams.set('returnTo', returnTo);
    // Do not await navigation during activation: its document request can wait
    // for this worker to finish activating. The browser owns the queued visit.
    void current.navigate(target.href).catch(() => {});
  } catch {
    // A closed/frozen tab can disappear during migration. Its next navigation
    // still receives the current network document.
  } finally {
    pendingClientChecks.delete(client.id);
  }
}

self.addEventListener('message', function(event) {
  if (event.data?.type === 'KESSICK_UPDATE_CLIENT' && event.source?.id) {
    updateClients.add(event.source.id);
  }
});

self.addEventListener('install', function(event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async function() {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.filter(name => name.startsWith('kessick-portal-')).map(name => caches.delete(name)));
    } catch {
      // Cache storage can be unavailable. It must not block the new worker.
    }
    await self.clients.claim();
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    await Promise.all(windows.map(notifyOrMigrate));
  })());
});

self.addEventListener('fetch', function(event) {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode !== 'navigate') {
    // Workers can restart between visits. Re-check a legacy home client
    // when it next makes a request, without storing or modifying its response.
    if (event.clientId && !updateClients.has(event.clientId) && !pendingClientChecks.has(event.clientId)) {
      event.waitUntil(self.clients.get(event.clientId).then(client => client && notifyOrMigrate(client)).catch(() => {}));
    }
    return;
  }
  event.respondWith(fetch(request, { cache: 'no-store' }).catch(() => new Response(
    '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kessick Portal</title><body style="margin:0;background:#121210;color:#f3f0e8;font:16px system-ui;padding:15vh 24px;text-align:center"><h1>You are offline</h1><p>Reconnect to open the latest Kessick Portal.</p><p><a href="' + self.registration.scope + '" style="color:#e2c991">Try again</a></p></body></html>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  )));
});

self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'Kessick Portal';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: new URL('kessick-logo-white.svg', self.registration.scope).href,
    data: data.url || 'portal/notifications'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = new URL(event.notification.data || 'portal/notifications', self.registration.scope).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
