// Service worker for "מסלול דינמי - ליפנו ודרום צ'כיה".
// Online visits always request the latest page. The cached page is used only
// when the network is unavailable.
const CACHE_VERSION = 'lipno-trip-v5-20260819';
const OFFLINE_PAGE = './index.html';
const STATIC_ASSETS = [
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => Promise.all([
        cache.add(new Request(OFFLINE_PAGE, { cache: 'reload' })),
        ...STATIC_ASSETS.map((url) => cache.add(url))
      ]))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.error('SW install cache error', err);
        return self.skipWaiting();
      })
  );
});

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

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isNavigation) {
    event.respondWith(
      fetch(new Request(req, { cache: 'no-store' }))
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION)
              .then((cache) => cache.put(OFFLINE_PAGE, copy));
          }
          return response;
        })
        .catch(() => caches.match(OFFLINE_PAGE)
          .then((cached) => cached || Response.error()))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return response;
      });
    })
  );
});
