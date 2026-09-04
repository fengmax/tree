/* ============================================================
 * 愈合之树 — Canvas 粒子（夜晚星星 + 常驻季节飘落 + 季节小景 + 一阵风）
 * 依赖: ui.js, theme.js
 *
 * 层次设计（都只画在树后的天幕上，安静不抢戏）：
 *  - 常驻层 ambient：秋时时 5 片落叶、冬 6 片雪、春 2 片樱瓣缓缓下落，
 *    颜色取自当前季节色板 —— 树掉下的是自己身上那种叶子
 *  - 事件层 microEvent：蝴蝶横飞、夏夜萤火（偶尔才来）
 *  - 一阵风 wind：低频偶发，把树冠推斜几秒，飘落物被横吹加速
 * ============================================================ */
import { $, reducedMotion } from './ui.js';
import { isNight, seasonPaletteNow } from './theme.js';

let Pctx = null;
let PRAF;
let lastPFrame = 0;
let microEvent = null;
let nextMicroEventAt = 0;

/* ---------------- 常驻层配置（导出供测试） ---------------- */
const AMBIENT_CFG = {
  spring: { kind: 'petal', count: 2 },
  summer: { kind: null, count: 0 },   // 夏天安静，只有夜里偶来的萤火虫
  autumn: { kind: 'leaf', count: 5 },
  winter: { kind: 'snow', count: 6 },
};
/* 风速加倍补足额外飘落（吹落更多） */
export function ambientTargetsFor(season, windy) {
  const cfg = AMBIENT_CFG[season] || AMBIENT_CFG.spring;
  const count = windy && cfg.count > 0 ? cfg.count + 3 : cfg.count;
  return { kind: cfg.kind, count };
}

function currentSeason() {
  return [...document.body.classList].find(name => name.startsWith('season-'))?.slice(7) || 'spring';
}
function isWindy() { return document.body.classList.contains('wind-gust'); }
function isNightNow() { return document.body.classList.contains('theme-night'); }

/* 飘落物颜色：取树自己的季节色板（金果色/花心/霜色由各自分支处理） */
function ambientColor(kind) {
  const { pal } = seasonPaletteNow();
  if (kind === 'leaf') return Math.random() < .5 ? pal.leaf1[1] : pal.leaf2[1];
  if (kind === 'petal') return Math.random() < .5 ? pal.petalA[1] : pal.petalB[1];
  // snow：白天灰蓝（浅色天空下可见），夜晚雪白
  return isNightNow() ? '#f3f7f3' : '#b6c3cf';
}

let ambient = [];
function spawnAmbient(kind, h, fillTop) {
  const base = {
    kind,
    x: Math.random() * Pctx.canvas.width,
    y: fillTop ? Math.random() * h * .86 : -22 - Math.random() * 60,
    vy: 0, amp: 0, phase: Math.random() * Math.PI * 2,
    w: 0, size: 0, rot: Math.random() * Math.PI * 2,
    rotSpd: 0, color: ambientColor(kind),
  };
  if (kind === 'snow') {
    base.vy = h * (.034 + Math.random() * .012);   // 一片雪 ~24s 落完
    base.size = 1.2 + Math.random() * 1.1;
    base.amp = 10 + Math.random() * 12;
    base.w = .5 + Math.random() * .7;
  } else {
    base.vy = h * (.048 + Math.random() * .016);   // 一片叶 ~15-22s 落完
    base.size = 5.5 + Math.random() * 3;           // 半高
    base.amp = 22 + Math.random() * 22;
    base.w = .6 + Math.random() * .8;
    base.rotSpd = (.35 + Math.random() * .5) * (Math.random() < .5 ? -1 : 1);
  }
  return base;
}

function drawFallen(c, p, ts) {
  const t = ts / 1000;
  const x = p.x + Math.sin(p.phase + t * p.w) * p.amp;
  const y = p.y;
  const h = c.canvas.height;
  // 顶部 70px 淡入、近地 120px 淡出
  const alpha = Math.min(1, y / 70, (h - y) / 120);
  if (alpha <= 0.02) return;
  c.save();
  c.globalAlpha = p.kind === 'petal' ? alpha * .9 : alpha * .85;
  if (p.kind === 'snow') {
    c.fillStyle = p.color;
    c.beginPath(); c.arc(x, y, p.size, 0, Math.PI * 2); c.fill();
    c.globalAlpha *= .55;
    c.beginPath(); c.arc(x + p.size * .8, y + p.size * .7, p.size * .45, 0, Math.PI * 2); c.fill();
  } else {
    c.translate(x, y);
    c.rotate(p.rot);
    c.fillStyle = p.color;
    c.beginPath();
    c.moveTo(0, -p.size);
    c.quadraticCurveTo(p.size, -p.size * .4, 0, p.size);
    c.quadraticCurveTo(-p.size, -p.size * .4, 0, -p.size);
    c.fill();
  }
  c.restore();
}

function tickAmbient(dt, ts) {
  if (!Pctx) return;
  const { width: w, height: h } = Pctx.canvas;
  const season = currentSeason();
  const windy = isWindy();
  const { kind, count } = ambientTargetsFor(season, windy);

  // 补足到目标数（顶外生成，缓缓飘入）
  while (ambient.length < count) {
    ambient.push(spawnAmbient(kind, h, false));
  }
  // 夏天/配置变更后清掉多余（例如换季时夏天无飘落）
  if (ambient.length > count) ambient.length = count;

  const drift = windy ? (Math.random() < .5 ? 1 : -1) * h * .075 : 0; // 风横推速度
  const next = [];
  for (const p of ambient) {
    p.y += p.vy * (windy ? 1.7 : 1) * dt;
    p.x += drift * dt;
    p.rot += p.rotSpd * dt;
    // 横飘出画布就从对侧回场，始终有点东西在下
    if (p.x < -50) p.x = w + 30;
    else if (p.x > w + 50) p.x = -30;
    if (p.y < h + 40) next.push(p);
  }
  ambient = next;
  for (const p of ambient) drawFallen(Pctx, p, ts);
}

/* ---------------- 事件层（保留原有：蝴蝶 / 樱瓣 / 萤火虫 / 雪） ---------------- */

function drawMicroEvent(c, ts) {
  const { width: w, height: h } = c.canvas;
  if (!nextMicroEventAt) {
    nextMicroEventAt = ts + 7000 + Math.random() * 11000;
    return;
  }
  if (!microEvent && ts >= nextMicroEventAt) {
    const season = currentSeason();
    let kind;
    let duration = 5600;
    if (season === 'spring') {
      kind = Math.random() < 0.45 ? 'butterfly' : 'petal';
    } else if (season === 'autumn') {
      kind = 'butterfly';              // 常驻落叶已够，秋的偶发留给蝴蝶
    } else if (season === 'winter') {
      kind = 'snow';
      duration = 4600;
    } else {
      kind = 'firefly';
      duration = 7000;
    }
    microEvent = {
      kind,
      start: ts,
      duration,
      x: Math.random() * w,
      y: h * (.28 + Math.random() * .25),
    };
  }
  if (!microEvent) return;

  const event = microEvent;
  const progress = (ts - event.start) / event.duration;
  if (progress >= 1) {
    microEvent = null;
    nextMicroEventAt = ts + 14000 + Math.random() * 18000;
    return;
  }
  const fade = Math.min(1, progress * 5, (1 - progress) * 5);
  c.save();
  c.globalAlpha = fade * .7;

  if (event.kind === 'butterfly') {
    const x = -28 + (w + 56) * progress;
    const y = event.y + Math.sin(progress * Math.PI * 4) * 18;
    c.translate(x, y);
    c.rotate(Math.sin(progress * Math.PI * 4) * .12);
    const flap = 3 + Math.abs(Math.sin(ts / 90)) * 4;
    c.fillStyle = '#e8a8a0';
    c.beginPath(); c.ellipse(-flap, -2, flap, 5, -.35, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(flap, -2, flap, 5, .35, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#856e61';
    c.fillRect(-.8, -3, 1.6, 7);
  } else if (event.kind === 'petal') {
    const x = event.x + Math.sin(progress * Math.PI * 3) * 45;
    const y = -18 + h * .68 * progress;
    c.translate(x, y);
    c.rotate(progress * Math.PI * 3);
    c.fillStyle = progress < .5 ? '#f6d5cc' : '#f0c2bd';
    c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(7, -2, 0, 6); c.quadraticCurveTo(-7, -2, 0, -6); c.fill();
  } else if (event.kind === 'snow') {
    const x = event.x + Math.sin(progress * Math.PI * 2) * 24;
    const y = -12 + h * .62 * progress;
    c.fillStyle = '#f3f7f3';
    c.beginPath(); c.arc(x, y, 2.8, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 14, y - 30, 1.7, 0, Math.PI * 2); c.fill();
  } else {
    const x = event.x + Math.sin(progress * Math.PI * 2) * 28;
    const y = event.y + Math.cos(progress * Math.PI * 3) * 24;
    c.fillStyle = '#eaff9a';
    c.shadowColor = '#eaff9a'; c.shadowBlur = 10;
    c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill();
  }
  c.restore();
}

/* ---------------- 星星（夜晚） ---------------- */

function drawStarField(c, stat) {
  const { width: w, height: h } = c.canvas;
  const ts = Date.now() / 1000;
  const n = 60;
  for (let i = 0; i < n; i++) {
    const x = (i * 97) % w;
    const y = (i * 41) % (h * 0.7);
    const tw = stat ? 0.62 : 0.4 + 0.6 * Math.abs(Math.sin(ts * 0.8 + i * 7));
    c.globalAlpha = tw * 0.9;
    c.fillStyle = '#f5f2d8';
    c.beginPath();
    c.arc(x, y, i % 5 === 0 ? 1.7 : 1.0, 0, Math.PI * 2);
    c.fill();
  }
  const fm = 12;
  for (let i = 0; i < fm; i++) {
    const id = i * 53;
    const x = stat ? ((id * 0.37) % w) : (((id * 0.37) % w) + Math.sin(ts * 0.3 + i) * 22);
    const y0 = (h * 0.35) + ((i * 67) % (h * 0.5));
    const y = stat ? y0 : (y0 + Math.cos(ts * 0.24 + i * 3) * 18);
    const a = stat ? 0.42 : 0.18 + 0.5 * Math.abs(Math.sin(ts * (0.7 + (i % 3) * 0.2) + i));
    c.globalAlpha = a;
    c.fillStyle = '#eaff9a';
    c.beginPath(); c.arc(x, y, 1.9, 0, Math.PI * 2); c.fill();
    c.globalAlpha = a * 0.4;
    c.beginPath(); c.arc(x, y, 4.2, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

/* ---------------- 一阵风：低频偶发，让整棵树一起应一下 ---------------- */

let windTimer = null;
function windGap() { return 150000 + Math.random() * 130000; }   // 风与风之间 2.5~4.7 分钟
function gustDuration() { return 3400; }

function gust() {
  document.body.classList.add('wind-gust');
  setTimeout(() => document.body.classList.remove('wind-gust'), gustDuration());
  windTimer = setTimeout(gust, windGap());
}

/* ---------------- 主循环 ---------------- */

function resizeP() {
  if (!Pctx) return;
  const canvas = $('particles');
  if (!canvas) return;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

function drawStaticP() {
  if (!Pctx) return;
  const canvas = $('particles');
  Pctx.clearRect(0, 0, canvas.width, canvas.height);
  if (isNight()) drawStarField(Pctx, true);
}

function loopP(ts) {
  cancelAnimationFrame(PRAF);
  if (document.hidden) { PRAF = requestAnimationFrame(loopP); return; }
  if (ts - lastPFrame >= 33) {
    const dt = Math.min(.05, (ts - lastPFrame) / 1000);   // clamp：切页回来不瞬移
    lastPFrame = ts;
    if (!Pctx) return;
    const canvas = $('particles');
    Pctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isNight()) drawStarField(Pctx);
    tickAmbient(dt, ts);
    drawMicroEvent(Pctx, ts);
  }
  PRAF = requestAnimationFrame(loopP);
}

export function initParticles() {
  const canvas = $('particles');
  if (!canvas) return;
  Pctx = canvas.getContext('2d');
  resizeP();
  window.addEventListener('resize', () => { resizeP(); if (reducedMotion) drawStaticP(); });
  if (reducedMotion) { drawStaticP(); return; }
  // 先让常驻层立刻有内容（散布半屏），再进入循环
  const { kind } = ambientTargetsFor(currentSeason(), false);
  if (kind) {
    const { height: h } = Pctx.canvas;
    for (let i = 0; i < AMBIENT_CFG[currentSeason()].count; i++) ambient.push(spawnAmbient(kind, h, true));
  }
  windTimer = setTimeout(gust, 45000 + Math.random() * 35000);   // 首阵风晚点来
  loopP();
}
