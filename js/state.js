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
      entries: [],
      /* 以下为单条便签的旧字段：仅供迁移读取，日记化后不再写入 */
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

/* 微型日记本迁移：老版单条 noteText → entries[0]，不丢老数据 */
function migrate(s) {
  if (!Array.isArray(s.entries)) s.entries = [];
  if (s.entries.length === 0 && typeof s.noteText === 'string' && s.noteText.trim()) {
    s.entries.push({
      id: 'e' + (s.noteAt || Date.now()).toString(36),
      text: s.noteText.slice(0, 42),
      at: s.noteAt || Date.now(),
      reply: s.noteReply || s.aiReply || '',
    });
    s.noteText = '';
    s.noteReply = '';
    s.aiReply = '';
  }
  return s;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const p = JSON.parse(raw);
    return migrate(Object.assign(defaultState(), p));
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
