/* ============================================================
 * 愈合之树 — 树的年轮（成长时间带）
 *
 * 把最近一段日子里留下的痕迹画成一条横向的时间带：
 *   ── 色点：那天记录的情绪（feels）
 *   ── 刻线：写给自己的话（entries）
 *   ── 水滴：浇过水（waterLog，自本版起记录）
 *   ── 金点：说过「比昨天好一点」（hearts）
 *
 * 数据全部来自本机 localStorage，纯展示、不催、不评。
 * 短横线没有断档惩罚 —— 空着的那几天，树也只是安静地等。
 * ============================================================ */
import { getState } from './state.js';
import { $, showOverlay, hideOverlay } from './ui.js';
import { companionDays } from './growth.js';

const WINS = [7, 30, 90];
let _win = 30;

/* SVG 画布几何：viewBox 0 0 360 212 */
const PAD_L = 16;
const PAD_R = 16;
const BASE_Y = 168;      // 土壤线高度
const AXIS_W = 360 - PAD_L - PAD_R;

const C_WATER = '#9cc0de';
const C_NOTE = '#7fae7e';
const C_HEART = '#e3bd57';
const C_SOIL = 'rgba(148,120,90,.4)';
const C_TICK = 'rgba(120,140,125,.4)';
const C_TEXT = '#5a6b62';
const C_TODAY = '#42544c';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ESCAPES[c]); }

function dayKey(ts) { return new Date(ts).toDateString(); }

function safeColor(c) {
  if (typeof c === 'string' && /^#([0-9a-fA-F]{3,8})$|^rgba?\(/.test(c)) return c;
  return 'rgba(120,140,125,.3)';
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/* 把各数据源聚合成 按天索引 的映射，一天一个桶 */
function collect(win) {
  const st = getState();
  const today = startOfToday();
  const dayMs = 86400000;
  const mood = {};    // dayIdx -> { color, label }（feels 每天最多一条）
  const note = {};    // dayIdx -> 条数
  const heart = {};   // dayIdx -> 条数
  const water = {};   // dayIdx -> 条数
  const idx = ts => Math.floor((startOfDayTs(ts) - today.getTime()) / dayMs) + win - 1;

  function startOfDayTs(ts) {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  }
  const put = (bucket, ts) => {
    const i = idx(ts);
    if (i >= 0 && i < win) bucket[i] = (bucket[i] || 0) + 1;
  };

  for (const f of st.feels || []) {
    const i = idx(f.t);
    if (i >= 0 && i < win && !mood[i]) mood[i] = { color: f.color, label: f.label };
  }
  for (const e of st.entries || []) put(note, e.at);
  for (const h of st.hearts || []) put(heart, h);
  for (const w of st.waterLog || []) put(water, w.t);
  return { today, mood, note, heart, water };
}

/* 每个数据源在当窗内的出现天数（情绪按天、其余按条） */
function summarize(win, mood, note, heart, water) {
  const n = win;
  const feelDays = Object.keys(mood).length;
  const noteTotal = Object.values(note).reduce((a, b) => a + b, 0);
  const heartTotal = Object.values(heart).reduce((a, b) => a + b, 0);
  const waterTotal = Object.values(water).reduce((a, b) => a + b, 0);
  return { n, feelDays, noteTotal, heartTotal, waterTotal };
}

function fmtShort(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* 时间带主体：今天在最右列 */
function ringSvg(win, data) {
  const { today, mood, note, heart, water } = data;
  const step = AXIS_W / win;
  const cx = i => PAD_L + step * (i + 0.5);
  const dayAt = i => today.getTime() + (i - win + 1) * 86400000;

  let s = '';

  // 底土线
  s += `<line x1="${PAD_L}" y1="${BASE_Y}" x2="${360 - PAD_R}" y2="${BASE_Y}" stroke="${C_SOIL}" stroke-width="1"/>`;

  // 浇水：渗进土里的淡蓝小点（当天多次则竖排）
  for (const i in water) {
    const k = Math.min(water[i], 3);
    for (let j = 0; j < k; j++) {
      const y = BASE_Y + 5 + j * 4.6;
      s += `<circle cx="${cx(+i).toFixed(1)}" cy="${y.toFixed(1)}" r="1.5" fill="${C_WATER}" opacity="${.9 - j * .22}"/>`;
    }
  }

  // 写话：土壤线上方的细刻线，越多越长
  for (const i in note) {
    const h = 5 + Math.min(note[i], 5) * 1.4;
    s += `<line x1="${cx(+i).toFixed(1)}" y1="${(BASE_Y - 2).toFixed(1)}" x2="${cx(+i).toFixed(1)}" y2="${(BASE_Y - 2 - h).toFixed(1)}" stroke="${C_NOTE}" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>`;
  }

  // 情绪：写话上方的色点
  const r = win === 7 ? 3 : win === 30 ? 2.6 : 1.9;
  for (const i in mood) {
    s += `<circle cx="${cx(+i).toFixed(1)}" cy="${(BASE_Y - 16).toFixed(1)}" r="${r}" fill="${safeColor(mood[i].color)}" opacity=".95"/>`;
  }

  // 金点：最上层，稀有
  for (const i in heart) {
    s += `<circle cx="${cx(+i).toFixed(1)}" cy="${(BASE_Y - 27).toFixed(1)}" r="${win === 7 ? 2 : 1.6}" fill="${C_HEART}" opacity=".9"/>`;
  }

  // 刻度与日期标签
  const labelEvery = win === 7 ? 1 : win === 30 ? 5 : 15;
  for (let i = 0; i < win; i++) {
    if (i === win - 1 || i % labelEvery === 0) {
      const d = dayAt(i);
      const isToday = i === win - 1;
      s += `<line x1="${cx(i).toFixed(1)}" y1="${BASE_Y + 1}" x2="${cx(i).toFixed(1)}" y2="${BASE_Y + 4}" stroke="${C_TICK}" stroke-width=".8"/>`;
      s += `<text x="${cx(i).toFixed(1)}" y="212" text-anchor="middle" font-size="7.5" fill="${isToday ? C_TODAY : C_TEXT}" ${isToday ? 'font-weight="500"' : ''} opacity="${isToday ? 1 : .72}">${isToday ? '今天' : esc(fmtShort(d))}</text>`;
    }
  }

  return s;
}

export function setRingWindow(win) {
  if (!WINS.includes(win)) return;
  _win = win;
  renderRing();
}

export function renderRing() {
  const svg = $('ringSvg');
  const meta = $('ringMeta');
  const sum = $('ringSummary');
  if (!svg) return;

  const data = collect(_win);
  const st = getState();
  const days = companionDays();
  const summary = summarize(_win, data.mood, data.note, data.heart, data.water);

  if (meta) {
    const stage = st.growth >= 1 ? '树已成荫' : '';
    meta.textContent = days > 0
      ? `第 ${days} 天${stage ? ' · ' + stage : ''} · 时间带是最近 ${summary.n} 天`
      : `最近 ${summary.n} 天`;
  }

  const body = ringSvg(_win, data);
  svg.innerHTML = body;
  svg.setAttribute('aria-label', `最近 ${summary.n} 天的成长时间带`);

  if (sum) {
    if (!summary.feelDays && !summary.noteTotal && !summary.waterTotal) {
      sum.innerHTML = '这段时间没有留下痕迹。<br>没有痕迹也很好，树一样在这里。';
      return;
    }
    // 出现最多的情绪（按天计）
    const labelCount = {};
    let topLabel = '', topN = 0;
    for (const i in data.mood) {
      const lb = data.mood[i].label || '';
      labelCount[lb] = (labelCount[lb] || 0) + 1;
      if (labelCount[lb] > topN) { topN = labelCount[lb]; topLabel = lb; }
    }
    const parts = [];
    if (summary.feelDays) parts.push(`${summary.feelDays} 天留下感受`);
    if (summary.noteTotal) parts.push(`${summary.noteTotal} 篇写话`);
    if (summary.waterTotal) parts.push(`浇水 ${summary.waterTotal} 次`);
    if (summary.heartTotal) parts.push(`${summary.heartTotal} 次「好一点」`);
    let html = parts.join(' · ') + '。';
    if (topLabel && topN >= 2) html += `<br><span class="ring-top">说得最多的感受：${esc(topLabel)}（${topN} 天）</span>`;
    sum.innerHTML = html;
  }
}

export function openYearRing() {
  renderRing();
  showOverlay($('ringOverlay'));
}

export function closeYearRing() {
  hideOverlay($('ringOverlay'));
}
