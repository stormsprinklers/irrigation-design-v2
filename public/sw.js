/* Irrigation Design PWA service worker — installability + lightweight shell */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first; keep SW registered for iOS Home Screen installability.
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
