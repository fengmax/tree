/* ============================================================
 * 愈合之树 — 感受记录
 * 依赖: config.js, state.js, ui.js, tree-render.js, app(refreshAll)
 * ============================================================ */
import { BETTER_NEED } from './config.js';
import { getState, setState, save } from './state.js';
import { $, toast, showOverlay, hideOverlay } from './ui.js';
import { trackGoldFlag, goldFruitIntended, betterCount } from './tree-render.js';

// refreshAll 回调，由 app.js 注入
let _refreshAll = null;
export function setRefreshAll(fn) { _refreshAll = fn; }

function todayKey() { return new Date().toDateString(); }

function lastBetterToday() {
  const tk = todayKey();
  return (getState().hearts || []).some(t => new Date(t).toDateString() === tk);
}

export function renderFeelHistory() {
  const wrap = $('feelHistory');
  const dots = $('feelDots');
  if (!wrap || !dots) return;
  const feels = getState().feels || [];
  if (feels.length === 0) { wrap.hidden = true; return; }
  wrap.hidden = false;
  const recent = feels.slice(-30).reverse();
  dots.innerHTML = recent.map(f => {
    const d = new Date(f.t);
    const dateStr = `${d.getMonth()+1}月${d.getDate()}日`;
    return `<span class="feel-dot" style="--c:${f.color}" data-label="${f.label}" data-date="${dateStr}"></span>`;
  }).join('');
}

export function renderMood() {
  const bw = $('betterWrap');
  const note = $('goldNote');
  if (lastBetterToday()) { bw.hidden = true; }
  else {
    bw.hidden = false;
    const since = betterCount() % BETTER_NEED;
    note.textContent = since === 0 ? `再记录 7 次"比昨天好一点"，树会结金果` :
      `已攒 ${since}/7，再 ${BETTER_NEED - since} 次树梢会亮起金光`;
  }
}

export function openFeel() {
  showOverlay($('feelOverlay'));
  renderMood();
  renderFeelHistory();
}

export function recordFeel(color, label) {
  const state = getState();
  state.feels = state.feels || [];
  if (state.feels.some(f => new Date(f.t).toDateString() === todayKey())) {
    toast('今天已经记过了，树都记得。');
    return false;
  }
  state.feels.push({ t: Date.now(), color, label });
  save();
  if (_refreshAll) _refreshAll();
  toast('记下了，树梢轻轻摇了摇。');
  return true;
}

export function recordBetter() {
  if (lastBetterToday()) { toast('今天已记过"好一点"啦。'); return; }
  const state = getState();
  state.hearts = state.hearts || [];
  state.hearts.push(Date.now());
  save();
  trackGoldFlag();
  hideOverlay($('feelOverlay'));
  if (_refreshAll) _refreshAll();
  toast('好，比昨天好一点，这就很好。');
}
