/* ============================================================
 * 愈合之树 — 浇水系统
 * 依赖: config.js, state.js, ui.js, growth.js, audio.js
 * ============================================================ */
import { WATER_CD, FILL_WINDOW, MAX_FILL } from './config.js';
import { getState, setState, save } from './state.js';
import { $, toast } from './ui.js';
import { pruneFills } from './growth.js';

let wateringAnimTimers = [];

export function paintWateringFeedback() {
  document.body.classList.remove('watering');
  wateringAnimTimers.forEach(clearTimeout);
  wateringAnimTimers = [];
  requestAnimationFrame(() => {
    document.body.classList.add('watering');
    const t1 = setTimeout(() => { document.body.classList.add('watered'); }, 600);
    const t2 = setTimeout(() => {
      document.body.classList.remove('watering');
      document.body.classList.remove('watered');
    }, 1500);
    wateringAnimTimers = [t1, t2];
  });
}

export function water() {
  const state = getState();
  const now = Date.now();
  if (state.growth >= 1) { toast('树已经很茂盛了，谢谢你一直在。'); return; }

  if (now - state.lastWaterAt < WATER_CD) {
    const remainMin = Math.ceil((WATER_CD - (now - state.lastWaterAt)) / 60000);
    toast('树喝饱了，' + remainMin + ' 分钟后再来也不迟。');
    return;
  }
  pruneFills(now);
  if (state.waterFill.length >= MAX_FILL) {
    toast('土壤还很湿润，不急着再浇。');
    return;
  }
  state.waterFill.push({ from: now, until: now + FILL_WINDOW });
  state.lastWaterAt = now;
  save();
  paintWateringFeedback();
  toast('你轻柔地浇了浇水，土壤喝饱了。');
}

export function waterBtnVisual() {
  const state = getState();
  const btn = $('waterBtn');
  const st = $('waterState');
  if (state.growth >= 1) { btn.disabled = true; st.textContent = ''; return; }
  const now = Date.now();
  const el = now - state.lastWaterAt;
  if (el < WATER_CD) {
    btn.disabled = true;
    const remain = Math.ceil((WATER_CD - el) / 60000);
    st.textContent = '· ' + remain + ' 分钟后可再浇 ·';
  } else {
    btn.disabled = false;
    pruneFills(now);
    st.textContent = state.waterFill.length ? '' : '想浇水时，点一下';
  }
}
