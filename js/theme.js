/* ============================================================
 * 愈合之树 — 昼夜 + 季节主题
 * 依赖: ui.js (无直接依赖，独立工具函数)
 * ============================================================ */
import { $ } from './ui.js';

export function hourNow() { return new Date().getHours(); }

export function isNight() { const h = hourNow(); return h >= 19 || h < 6; }

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
    else if (h < 17) w.textContent = '';
    else if (h < 19) w.textContent = '黄昏，天边染上温柔的颜色';
    else w.textContent = '夜晚，星星与树的低语';
  }
}
