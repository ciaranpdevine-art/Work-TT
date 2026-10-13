// Minimal service worker: makes the app installable and gives basic offline support.
// The page is fetched network-first so you always get the latest version when online.
const CACHE_NAME = 'work-tt-v7';
const APP_SHELL = ['./', './index.html', './manifest.json?v=4', './icon-192.png', './icon-512.png', './cloud.js', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // The sign-in library is versioned and never changes: serve it from the cache so the app works offline.
  if (req.url.startsWith('https://www.gstatic.com/firebasejs/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (!req.url.startsWith(self.location.origin)) return;
  event.respondWith(
    // Always check the server first (skip the browser's 10-minute cache) so updates arrive straight away.
    fetch(req, { cache: 'no-cache' }).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('./index.html')))
  );
});
