// Service worker for "מסלול דינמי - ליפנו ודרום צ'כיה"
// Bump CACHE_VERSION whenever index.html / manifest / icons change, so old
// clients pick up the new version instead of being stuck on a stale cache.
const CACHE_VERSION = 'lipno-trip-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Install: pre-cache the app shell only. We deliberately do NOT call
// self.skipWaiting() here — a newly installed service worker must stay in
// the "waiting" state until the person actively confirms the update (via
// the "עדכון חדש זמין — טען מחדש" banner in index.html, which sends this
// worker a SKIP_WAITING message). This prevents the app from silently
// swapping versions under an open tab.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.error('SW install cache error', err))
  );
});

// Activate: delete any caches from older versions of this app, and take
// control of already-open pages immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Allow the page to tell a waiting service worker to activate immediately
// (used by the "עדכון חדש זמין — טען מחדש" banner in index.html).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch strategy:
// - Same-origin app shell files: cache-first, so the app opens instantly
//   and works offline with the last saved itinerary.
// - Everything else (Open-Meteo weather API, Google Fonts, external links):
//   left to the network as normal. The app itself already handles weather
//   fetch failures gracefully (falls back to the last forecast saved in
//   localStorage), so the service worker does not need to intercept those
//   requests — doing so risked serving a stale weather forecast forever.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin || req.method !== 'GET') {
    return; // let the browser handle it normally (network)
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => {
          // Offline and not in cache: fall back to the cached index.html
          // so the app shell still loads instead of showing a browser error.
          return caches.match('./index.html');
        });
    })
  );
});
