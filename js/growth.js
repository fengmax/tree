/* ============================================================
 * 愈合之树 — 成长引擎
 * 依赖: config.js, state.js
 * ============================================================ */
import { DAY, BASE_PER_DAY, WATER_MULT, CARE_GROWTH, MAX_LOOKBACK, STAGES } from './config.js';
import { getState, setState, save } from './state.js';

export function settleGrowth() {
  const state = getState();
  const now = Date.now();
  let dt = now - state.lastOpen;
  if (dt < 0) dt = 0;
  if (dt > MAX_LOOKBACK) dt = MAX_LOOKBACK;
  if (dt <= 0) { setState({ lastOpen: now }); save(); return; }

  const days = dt / DAY;
  pruneFills(now);
  let mult = 1.0;
  if (state.waterFill.length) mult = WATER_MULT;

  let added = days * BASE_PER_DAY * mult;
  state.growth = Math.min(1.0, state.growth + added);
  if (state.growth >= 1) state.growth = 1;

  state.companions = companionDays();
  state.lastOpen = now;
  save();
}

export function pruneFills(now) {
  const state = getState();
  state.waterFill = (state.waterFill || []).filter(f => now < f.until);
}

export function stageAt(g) {
  let cur = STAGES[0];
  for (const s of STAGES) if (g >= s.at) cur = s;
  return cur;
}

export function companionDays() {
  const state = getState();
  const start = new Date(state.bornAt || Date.now());
  const now = new Date();
  start.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now - start) / DAY));
}

export function rewardDailyCare(kind) {
  const state = getState();
  const field = kind === 'feel' ? 'feelGrowthDate' : 'noteGrowthDate';
  const today = new Date().toDateString();
  if (state[field] === today) return false;
  state.growth = Math.min(1, state.growth + CARE_GROWTH);
  state[field] = today;
  save();
  return true;
}
