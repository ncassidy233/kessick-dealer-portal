// Always use the current online application. Remove only legacy Kessick demo
// caches; authentication cookies, drafts and other browser storage are untouched.
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
    for (const client of windows) client.postMessage({ type: 'KESSICK_RELEASE_READY' });
  })());
});

self.addEventListener('fetch', function(event) {
  const request = event.request;
  if (request.method !== 'GET' || request.mode !== 'navigate' || new URL(request.url).origin !== self.location.origin) return;
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
