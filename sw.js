// Minimal service worker — makes the app installable and lets it
// load instantly (and work offline) once it's been opened once.
// IMPORTANT: bump this version string every time you change index.html,
// app.js or style.css. The fetch handler below is cache-first, so an already
// installed copy of the app will keep serving the OLD files forever until the
// cache name changes — that's what forces phones to pick up an update.
const CACHE_NAME = 'iron-log-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon.png',
  './cogwheel.png',
  './ett.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first, falling back to network, so the app opens instantly
// and still works with no signal at the gym.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => cached);
    })
  );
});
