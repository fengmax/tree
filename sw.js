// 愈合之树 Service Worker — 离线缓存（v3 容错版）
const CACHE = 'healing-tree-v21';
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

/* 逐个容错预缓存：github.io 单文件可能挂起，addAll 会因一个文件失败
 * 而整个安装失败 → 新 SW 永远装不上，页面一直被旧 SW 卡着。
 * 改为带超时逐个下载，单文件失败跳过：只要 sw.js 本身到了就一定能装上，
 * 缺的文件之后由 fetch 超时兜底从网络/缓存补齐。 */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache =>
      Promise.allSettled(PRECACHE.map(url =>
        fetchWithTimeout(url, 4000)
          .then(resp => { if (resp && resp.ok) return cache.put(url, resp); })
          .catch(() => {})
      ))
    ).then(() => self.skipWaiting())
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
