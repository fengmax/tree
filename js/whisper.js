/* ============================================================
 * 愈合之树 — 低频陪伴低语 + 问候语
 * 依赖: config.js, state.js, growth.js, ui.js
 * ============================================================ */
import { BETTER_NEED } from './config.js';
import { getState } from './state.js';
import { $ } from './ui.js';
import { stageAt, companionDays } from './growth.js';
import { hourNow } from './theme.js';

export function gentleWhisper() {
  const state = getState();
  const totalBetter = (state.hearts || []).length;
  let text = '';
  if (state.lastWaterAt === 0 && state.hearts.length === 0 && state.growth < 0.01) {
    text = '树在等你，它没有怪你。';
  } else if (state.growth >= 1) {
    text = '树已成荫。谢谢你陪它这么久。';
  } else if (totalBetter >= BETTER_NEED) {
    text = '树梢的金果，是你一天天攒下的温柔。';
  }
  const qn = $('quietNote');
  if (qn) { qn.textContent = text; qn.hidden = !text; }
}

export function normalizeGreeting() {
  const state = getState();
  const h = hourNow();
  const stage = stageAt(state.growth);
  const days = companionDays();

  let base;
  if (h < 6) base = '夜深了，你来了。';
  else if (h < 12) base = '早安，你来了。';
  else if (h < 14) base = '正午好，你来了。';
  else if (h < 17) base = '午后，你来了。';
  else if (h < 19) base = '黄昏好，你来了。';
  else base = '晚上好，你来了。';

  if (state.growth >= 1) {
    base = '你来了，树已成荫。';
  } else if (stage.key === 'fruit' || stage.key === 'canopy') {
    base = (base ? base + ' ' : '') + '树结果了。';
  } else if (stage.key === 'bloom') {
    base = (base ? base + ' ' : '') + '树开花了。';
  }

  if (days === 1) base = '第一天，你来了。';
  else if (days === 7) base = '第七天，树记得你。';
  else if (days === 30) base = '一个月了，谢谢你在这里。';
  else if (days === 100) base = '一百天了，树和你一起。';
  else if (days === 365) base = '一年了，这棵树因你而在。';

  return base;
}
