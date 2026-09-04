// 愈合之树 Service Worker — 离线缓存（v4：缓存优先 + 后台静默更新）
const CACHE = 'healing-tree-v22';
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

/* 带超时的 fetch：github.io 偶发连接挂起，超时即放弃（由调用方兜底） */
function fetchWithTimeout(req, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  return fetch(req, { signal: ctl.signal }).then(
    resp => { clearTimeout(timer); return resp; },
    err => { clearTimeout(timer); throw err; }
  );
}

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

/* 缓存优先 + 后台更新（stale-while-revalidate）：
 * github.io 国际链路慢（每文件 1~3s+，偶发挂起），网络优先会让
 * 每次打开都卡在等网络。有缓存 → 立即返回秒开，同时后台拉网络
 * 响应写缓存，下次刷新即新版（新版本刷新两次的约定不变）。 */
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetchWithTimeout(e.request, 4000)
        .then(resp => {
          if (resp && resp.ok && e.request.url.startsWith(self.location.origin)) {
            const clone = resp.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return resp;
        })
        .catch(() => cached);   // 网络失败/超时：静默，继续用缓存
      return cached || net;     // 命中缓存立即回；未命中才等网络（4s 兜底）
    })
  );
});
