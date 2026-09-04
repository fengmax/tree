/* ============================================================
 * 愈合之树 — 状态管理
 * 依赖: config.js
 * ============================================================ */
import { KEY } from './config.js';

let _state = null;

export function defaultState() {
  return {
    bornAt: Date.now(),
    lastOpen: Date.now(),
    growth: 0,
    waterFill: [],
    lastWaterAt: 0,
    hearts: [],
    betterStreak: 0,
    goldFruits: 0,
    feels: [],
    companions: 0,
    muted: true,
    volume: 0.5,
    soundType: 'auto',
      noteText: '',
      noteAt: 0,
      noteReply: '',
      aiReply: '',
      replyBag: {},
      aiApiKey: '',
      aiBaseUrl: 'https://api.openai.com/v1',
      aiModel: 'gpt-4o-mini',
      dailyPromptDate: '',
      feelGrowthDate: '',
      noteGrowthDate: '',
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const p = JSON.parse(raw);
    return Object.assign(defaultState(), p);
  } catch (e) {
    return defaultState();
  }
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(_state)); } catch (e) {}
}

export function getState() {
  if (!_state) _state = load();
  return _state;
}

export function setState(patch) {
  if (!_state) _state = load();
  Object.assign(_state, patch);
}
