// 愈合之树 Service Worker — 离线缓存（v2 模块化）
const CACHE = 'healing-tree-v20';
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
  './js/diary.js',
  './js/yearring.js',
  './js/replies.js',
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

// 网络优先 + 超时兜底：github.io 在国内偶发连接挂起（几分钟不返回），
// 若一直等网络，页面 import 链会卡住 → 标签页永远转圈。
// 4 秒拿不到网络响应就回退缓存：网络好时照常更新，网络抖时页面秒开。
function fetchWithTimeout(req, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  return fetch(req, { signal: ctl.signal }).then(
    resp => { clearTimeout(timer); return resp; },
    err => { clearTimeout(timer); throw err; }
  );
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetchWithTimeout(e.request, 4000).then(resp => {
      if (resp.ok && e.request.url.startsWith(self.location.origin)) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return resp;
    }).catch(() =>
      caches.match(e.request).then(cached => cached || caches.match('./'))
    )
  );
});
