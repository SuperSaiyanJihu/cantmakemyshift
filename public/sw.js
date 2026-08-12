/**
 * Minimal service worker: makes the app installable, caches nothing.
 *
 * Chrome only offers "Install"/"Add to home screen" for a page whose service
 * worker handles fetch. This one passes every request straight to the network,
 * which is deliberate: call-out directions must never be served stale, and a
 * cached shell would keep showing an old business profile after leadership
 * changed it. Offline support would need a cache-busting story first.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally empty: no respondWith, so the browser performs its normal
  // network fetch. Present only to satisfy the installability requirement.
});
