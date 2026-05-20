self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      await self.clients.claim();
      await self.registration.unregister();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  // Keep all requests on the network so navigation and API calls do not fail.
  event.respondWith(fetch(event.request));
});
