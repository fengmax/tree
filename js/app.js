/* ============================================================
 * 愈合之树 (Healing Tree) — 主入口
 * 模块化重构：组装所有模块 + 事件绑定 + 启动
 * ============================================================ */
import { $, toast, showOverlay, hideOverlay } from './ui.js';
import { getState, save } from './state.js';
import { settleGrowth, stageAt, companionDays } from './growth.js';
import { renderTree, goldFruitIntended } from './tree-render.js';
import { setTheme } from './theme.js';
import { initParticles } from './particles.js';
import { ensureAudio, setMuted, switchSoundType, setVolume, updateSoundPanel, playWaterSound } from './audio.js';
import { water, waterBtnVisual } from './water.js';
import { openBreathWithAudio, closeBreath } from './breath.js';
import { openFeel, recordFeel, recordBetter, setRefreshAll } from './feel.js';
import { gentleWhisper, normalizeGreeting } from './whisper.js';

/* ---------------- 刷新 UI ---------------- */
function refreshAll() {
  settleGrowth();
  setTheme();
  renderTree(getState().growth);
  waterBtnVisual();
  gentleWhisper();
  renderStageInfo();
  renderGoldCrownNote();
}

function renderStageInfo() {
  const el = $('stageInfo');
  if (!el) return;
  const state = getState();
  const stage = stageAt(state.growth);
  const days = companionDays();
  if (days <= 0 && state.growth < 0.001) { el.textContent = ''; return; }
  let text = '';
  if (days > 0) text += `第 ${days} 天 · `;
  text += stage.label;
  if (state.growth >= 1) text = `第 ${days} 天 · 树已成荫`;
  el.textContent = text;
}

function renderGoldCrownNote() {
  const goldN = Math.min(goldFruitIntended(), 3);
  if (goldN <= 0) return;
  const stageInfo = $('stageInfo');
  if (!stageInfo) return;
  const current = stageInfo.textContent;
  stageInfo.textContent = current + ' · 金果 ' + goldN;
}

/* ---------------- 事件绑定 ---------------- */
function bindEvents() {
  // 浇水
  $('waterBtn').addEventListener('click', () => {
    ensureAudio();
    water();
    playWaterSound();
    refreshAll();
  });

  // 呼吸
  $('breathBtn').addEventListener('click', () => {
    ensureAudio();
    openBreathWithAudio();
  });
  $('breathClose').addEventListener('click', closeBreath);

  // 感受
  $('feelBtn').addEventListener('click', openFeel);
  $('feelClose').addEventListener('click', () => { hideOverlay($('feelOverlay')); });

  // 声音按钮：短按切换静音，长按打开声音面板
  let mutePressTimer = null;
  let muteLongPressed = false;
  $('muteBtn').addEventListener('pointerdown', () => {
    muteLongPressed = false;
    mutePressTimer = setTimeout(() => {
      muteLongPressed = true;
      ensureAudio();
      showOverlay($('soundOverlay'));
      updateSoundPanel();
    }, 500);
  });
  $('muteBtn').addEventListener('pointerup', () => {
    if (mutePressTimer) { clearTimeout(mutePressTimer); mutePressTimer = null; }
    if (!muteLongPressed) {
      ensureAudio();
      setMuted(!getState().muted);
    }
  });
  $('muteBtn').addEventListener('pointerleave', () => {
    if (mutePressTimer) { clearTimeout(mutePressTimer); mutePressTimer = null; }
  });

  // 声音面板：选项
  document.querySelectorAll('.sound-opt').forEach(b => {
    b.addEventListener('click', () => {
      const type = b.dataset.type;
      switchSoundType(type);
      updateSoundPanel();
      toast('声音已切换为 ' + b.textContent.trim());
    });
  });

  // 声音面板：音量
  $('volSlider').addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value));
  });

  // 声音面板关闭
  $('soundClose').addEventListener('click', () => { hideOverlay($('soundOverlay')); });

  // 感受按钮
  document.querySelectorAll('.mood').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.mood').forEach(x => x.classList.remove('sel'));
      b.classList.add('sel');
      const color = b.dataset.color, label = b.textContent;
      recordFeel(color, label);
      setTimeout(() => {
        document.querySelectorAll('.mood').forEach(x => x.classList.remove('sel'));
      }, 600);
    });
  });

  $('betterBtn').addEventListener('click', recordBetter);

  // 遮罩点空白关闭
  [$('breathOverlay'), $('feelOverlay'), $('soundOverlay')].forEach(ov => {
    ov.addEventListener('click', (e) => {
      if (e.target !== ov) return;
      if (ov === $('breathOverlay')) closeBreath();
      else hideOverlay(ov);
    });
  });

  // 离开/隐藏自动保存
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) settleGrowth();
    else refreshAll();
  });
}

/* ---------------- 启动 ---------------- */
function start() {
  settleGrowth();
  setRefreshAll(refreshAll);
  bindEvents();
  initParticles();
  setTheme();
  if (getState().muted) setMuted(true);
  if (!getState().muted) {
    ensureAudio();
    const unlock = () => {
      ensureAudio();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }
  refreshAll();
  const gr = $('greeting');
  const state = getState();
  const first = state.feels && state.feels.length === 0 && state.lastWaterAt === 0;
  gr.textContent = first ? '你来了。' : normalizeGreeting();
  setInterval(() => save(), 30000);
}

document.addEventListener('DOMContentLoaded', start);
