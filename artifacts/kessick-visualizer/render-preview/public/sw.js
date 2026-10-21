/*
 * Kessick Dealer Portal service worker.
 * Makes the portal installable as an app. Pages always come from the
 * network so dealers see the latest version; the last copy is only used
 * when the device is offline.
 */
const CACHE = "kessick-portal-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put("./", copy));
        return response;
      })
      .catch(() => caches.match("./").then((cached) => cached || Response.error())),
  );
});
