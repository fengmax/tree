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
import { openNote, saveNote, askAiReply, openAiConfig, saveAiConfig, renderNoteReply, setNoteRefresh } from './note.js';

/* ---------------- 刷新 UI ---------------- */
function refreshAll() {
  settleGrowth();
  setTheme();
  renderTree(getState().growth);
  waterBtnVisual();
  gentleWhisper();
  renderStageInfo();
  renderGoldCrownNote();
  renderDailyPrompt();
  renderNoteReply();
}

const DAILY_PROMPTS = [
  '今天不需要解决所有事情。',
  '可以先照顾好眼前这一小步。',
  '你已经做得够多了，休息也算在其中。',
  '有些答案，可以晚一点再来。',
  '今天也可以只是安静地在这里。',
];

function renderDailyPrompt() {
  const prompt = $('dailyPrompt');
  if (!prompt) return;
  const today = new Date().toDateString();
  const state = getState();
  if (state.dailyPromptDate === today) { prompt.hidden = true; return; }
  prompt.querySelector('.daily-prompt-text').textContent = DAILY_PROMPTS[new Date().getDate() % DAILY_PROMPTS.length];
  prompt.hidden = false;
  state.dailyPromptDate = today;
  save();
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
  $('noteBtn').addEventListener('click', openNote);
  $('noteClose').addEventListener('click', () => { hideOverlay($('noteOverlay')); });
  $('noteSave').addEventListener('click', saveNote);
  $('aiReply').addEventListener('click', askAiReply);
  $('aiConfigClose').addEventListener('click', () => { hideOverlay($('aiConfigOverlay')); });
  $('aiConfigSave').addEventListener('click', saveAiConfig);
  $('promptDismiss').addEventListener('click', () => { $('dailyPrompt').hidden = true; });
  $('feelClose').addEventListener('click', () => { hideOverlay($('feelOverlay')); });

  // 声音按钮：点击打开面板，选择场景后才主动播放
  $('muteBtn').addEventListener('click', () => {
    showOverlay($('soundOverlay'));
    updateSoundPanel();
  });

  // 声音面板：选项
  document.querySelectorAll('.sound-opt').forEach(b => {
    b.addEventListener('click', () => {
      const type = b.dataset.type;
      switchSoundType(type);
      setMuted(false);
      updateSoundPanel();
      toast('声音已切换为 ' + b.textContent.trim());
    });
  });

  // 声音面板：音量
  $('volSlider').addEventListener('input', (e) => {
    setVolume(parseFloat(e.target.value));
  });

  $('soundMute').addEventListener('click', () => {
    setMuted(!getState().muted);
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
  [$('breathOverlay'), $('feelOverlay'), $('soundOverlay'), $('noteOverlay'), $('aiConfigOverlay')].forEach(ov => {
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
  setNoteRefresh(refreshAll);
  bindEvents();
  initParticles();
  setTheme();
  if (getState().muted) setMuted(true);
  refreshAll();
  const gr = $('greeting');
  const state = getState();
  const first = state.feels && state.feels.length === 0 && state.lastWaterAt === 0;
  gr.textContent = first ? '你来了。' : normalizeGreeting();
  setInterval(() => save(), 30000);
}

document.addEventListener('DOMContentLoaded', start);
