/* ============================================================
 * 愈合之树 — 昼夜 + 季节主题
 * 依赖: ui.js (无直接依赖，独立工具函数)
 *
 * 季节不只是一层 CSS 底色 —— 树冠、花、草都随季节换装：
 *  - 每季一套色板（叶团 3 档渐变 + 花瓣 2 档 + 花心 + 草色）
 *  - 换季前 TRANS_DAYS 天开始逐日渐变到新季，画面平滑过渡
 *  - 秋冬只换颜色，永不落叶、永不倒退（见 index.html 设计原则）
 * ============================================================ */
import { $ } from './ui.js';

export const TRANS_DAYS = 10;          // 换季渐变的过渡天数
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SEASON_LABEL = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };

/* 每季色板：各渐变由内向外 3 个 stop 色（半透明结构留在 SVG defs 里，只换色）
 * leaf0/1/2 = 树冠叶团三层；petalA/B = 花瓣；heart = 花心；grass = 地面草茎 */
const PALETTES = {
  spring: {
    leaf0: ['#dceecd', '#a9cca2', '#8cb58e'],
    leaf1: ['#eaf3dc', '#c3ddb3', '#a3c39b'],
    leaf2: ['#c3dcb1', '#94b895', '#7b9e81'],
    petalA: ['#fae6de', '#f3d3c6', '#ecc0b3'],
    petalB: ['#f8e0d8', '#efc6bb', '#e8b7aa'],
    heart: ['#f9d9a8', '#f3b987', '#eba06f'],
    grass: '#73966f',
  },
  summer: {
    leaf0: ['#a5d190', '#7bb47c', '#629b6d'],
    leaf1: ['#c6e3ab', '#99c68d', '#7dac85'],
    leaf2: ['#8ec080', '#6ca372', '#538864'],
    petalA: ['#f8dcc7', '#efc5ac', '#e2ab93'],
    petalB: ['#f6d5c0', '#ebb9a2', '#dda38b'],
    heart: ['#f6cf94', '#eea96f', '#df9258'],
    grass: '#5f8f5f',
  },
  autumn: {
    leaf0: ['#e8c177', '#cf9d52', '#a97940'],
    leaf1: ['#f1da9f', '#ddb46a', '#be8c4c'],
    leaf2: ['#d9ac60', '#ba8843', '#956a3b'],
    petalA: ['#f6daa3', '#ebc282', '#daa867'],
    petalB: ['#f3d29c', '#e5b979', '#d49f5f'],
    heart: ['#f0ba70', '#e19b49', '#ca8439'],
    grass: '#a88b55',
  },
  winter: {
    leaf0: ['#bacbb5', '#91a598', '#77897e'],
    leaf1: ['#d0e0c9', '#a7bba7', '#899e91'],
    leaf2: ['#a6b9a3', '#809688', '#697c71'],
    petalA: ['#f3e4df', '#e7cbc6', '#d5b3b0'],
    petalB: ['#f2dfdb', '#e1c4bf', '#d0afaa'],
    heart: ['#f7dcae', '#edc084', '#dda961'],
    grass: '#8a9a8e',
  },
};

/* ---------------- 季节纯函数（可注入日期测试） ---------------- */

export function hourNow() { return new Date().getHours(); }

export function isNight() { const h = hourNow(); return h >= 19 || h < 6; }

export function seasonOfDate(d) {
  const m = d.getMonth();
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

export function nextSeason(s) {
  return SEASONS[(SEASONS.indexOf(s) + 1) % SEASONS.length];
}

/* 某季的起始月份（1-12） */
function seasonStartMonth(s) {
  return { spring: 3, summer: 6, autumn: 9, winter: 12 }[s];
}

/* d 所在季节的起始日（1-2 月的冬季属于上一年 12 月开的那一季） */
function seasonStartOf(d) {
  const cur = seasonOfDate(d);
  let y = d.getFullYear();
  if (cur === 'winter' && d.getMonth() <= 1) y -= 1;
  return new Date(y, seasonStartMonth(cur) - 1, 1);
}

/* 下一季的起始日 = 本季起点 + 3 个月（跨年自动进位） */
function nextSeasonStart(d) {
  const s = seasonStartOf(d);
  return new Date(s.getFullYear(), s.getMonth() + 3, 1);
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
const DAY = 86400000;

/* 颜色插值 */
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = pa >> 16, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = pb >> 16, bg = (pb >> 8) & 255, bb = pb & 255;
  const mr = Math.round(ar + (br - ar) * t);
  const mg = Math.round(ag + (bg - ag) * t);
  const mb = Math.round(ab + (bb - ab) * t);
  return '#' + ((1 << 24) + (mr << 16) + (mg << 8) + mb).toString(16).slice(1);
}

function mixPal(a, b, t) {
  const pal = { grass: mixHex(a.grass, b.grass, t) };
  for (const k of ['leaf0', 'leaf1', 'leaf2', 'petalA', 'petalB', 'heart']) {
    pal[k] = [0, 1, 2].map(i => mixHex(a[k][i], b[k][i], t));
  }
  return pal;
}

/* 某天的实际生效色板：换季前 TRANS_DAYS 天起逐日向新季渐变
 * 返回 { season: 名义季节, pal: 混合后的色板 } */
export function paletteAt(d) {
  const cur = seasonOfDate(d);
  const s = startOfDay(d);
  const gap = (nextSeasonStart(d) - s) / DAY;   // 距下一季还有几天
  let season = cur;
  let pal = PALETTES[cur];
  if (gap >= 0 && gap <= TRANS_DAYS) {
    const f = 1 - gap / TRANS_DAYS;             // 0 → 1 逼近新季
    season = nextSeason(cur);
    pal = mixPal(PALETTES[cur], PALETTES[season], f);
  }
  return { season, pal };
}

export function seasonNow() { return paletteAt(new Date()).season; }

/* 当前生效季节名 + 色板（页面渲染用，内部按天缓存避免重复插值） */
let _cacheDate = '';
let _cache = null;
export function seasonPaletteNow() {
  const d = new Date();
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (key !== _cacheDate) { _cache = paletteAt(d); _cacheDate = key; }
  return _cache;
}

/* ---------------- 昼夜主题（沿用原逻辑） ---------------- */

export function setTheme() {
  const h = hourNow();
  const m = new Date().getMonth();
  const b = document.body;
  let theme;
  if (h >= 6 && h < 17) theme = 'day';
  else if (h >= 17 && h < 19) theme = 'dusk';
  else theme = 'night';
  b.className = 'theme-' + theme;

  let season;
  if (m >= 2 && m <= 4) season = 'spring';
  else if (m >= 5 && m <= 7) season = 'summer';
  else if (m >= 8 && m <= 10) season = 'autumn';
  else season = 'winter';
  b.classList.add('season-' + season);

  const w = $('timeOfDay');
  if (w) {
    if (h < 6) w.textContent = '夜深了，陪伴你的是一颗安静的树';
    else if (h < 12) w.textContent = '清晨的光透过叶隙，树醒了';
    else if (h < 14) w.textContent = '正午，树影正好歇脚';
    else if (h < 17) w.textContent = '午后，风轻轻摇着枝叶';
    else if (h < 19) w.textContent = '黄昏，天边染上温柔的颜色';
    else w.textContent = '夜晚，星星与树的低语';
  }
}
