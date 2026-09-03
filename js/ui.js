/* ============================================================
 * 愈合之树 — 通用 UI 工具
 * 无依赖模块
 * ============================================================ */
export const $ = (id) => document.getElementById(id);
export const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

let toastEl = null, toastTimers = [];
export function toast(msg) {
  let el = toastEl;
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
    toastEl = el;
  }
  el.textContent = msg;
  el.classList.add('show');
  toastTimers.forEach(clearTimeout);
  let tt = setTimeout(() => el.classList.remove('show'), 2600);
  toastTimers = [tt];
}

export function showOverlay(el) {
  el.hidden = false;
  if (reducedMotion) { el.classList.add('show'); return; }
  el.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
}

export function hideOverlay(el) {
  el.classList.remove('show');
  if (reducedMotion) { el.hidden = true; return; }
  let finished = false;
  const finish = () => { if (finished) return; finished = true; el.hidden = true; };
  const onEnd = (e) => { if (e.target !== el) return; el.removeEventListener('transitionend', onEnd); finish(); };
  el.addEventListener('transitionend', onEnd);
  setTimeout(() => { el.removeEventListener('transitionend', onEnd); finish(); }, 600);
}
