/* Axis Drive service worker.
 * Needed so Chrome/Android can install the site as an app.
 * It does NOT cache anything: files and photos are always loaded live from the server,
 * so users never see stale data or an old version of the app.
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
