// 愈合之树 Service Worker — 离线缓存（v2 模块化）
const CACHE = 'healing-tree-v15';
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './sounds/rain.mp3',
  './sounds/forest.mp3',
  './sounds/stream.mp3',
  './sounds/night.mp3',
  './js/app.js',
  './js/config.js',
  './js/state.js',
  './js/ui.js',
  './js/theme.js',
  './js/growth.js',
  './js/tree-render.js',
  './js/audio.js',
  './js/particles.js',
  './js/water.js',
  './js/breath.js',
  './js/feel.js',
  './js/whisper.js',
  './js/note.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => k !== CACHE ? caches.delete(k) : null))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached);
    })
  );
});
