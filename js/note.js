/* ============================================================
 * 愈合之树 — 写给自己的话
 * 文字只保存在本地，不上传、不公开。
 * ============================================================ */
import { getState, setState, save } from './state.js';
import { $, showOverlay, hideOverlay, toast } from './ui.js';
import { rewardDailyCare } from './growth.js';
import { replyFor } from './replies.js';

let refresh = null;

export function setNoteRefresh(fn) { refresh = fn; }

export function openAiConfig() {
  const state = getState();
  const base = $('aiBaseUrl');
  const model = $('aiModel');
  const key = $('aiApiKey');
  if (base) base.value = state.aiBaseUrl || 'https://api.openai.com/v1';
  if (model) model.value = state.aiModel || 'gpt-4o-mini';
  if (key) key.value = state.aiApiKey || '';
  showOverlay($('aiConfigOverlay'));
}

export function saveAiConfig() {
  const base = ($('aiBaseUrl')?.value || '').trim().replace(/\/$/, '');
  const model = ($('aiModel')?.value || '').trim();
  const key = ($('aiApiKey')?.value || '').trim();
  if (!base || !model || !key) { toast('请把接口地址、模型和 API Key 填完整。'); return; }
  setState({ aiBaseUrl: base, aiModel: model, aiApiKey: key });
  save();
  hideOverlay($('aiConfigOverlay'));
  toast('配置好了，现在树可以听见你了。');
  askAiReply();
}

export function renderNoteReply() {
  const reply = $('treeReply');
  if (!reply) return;
  const state = getState();
  const text = state.aiReply || state.noteReply || '';
  reply.textContent = text;
  reply.hidden = !text;
}

export function openNote() {
  const input = $('noteInput');
  if (!input) return;
  input.value = getState().noteText || '';
  showOverlay($('noteOverlay'));
  setTimeout(() => input.focus(), 180);
}

export function saveNote() {
  const input = $('noteInput');
  const text = input ? input.value.trim() : '';
  if (!text) {
    toast('想写的时候再写，也可以。');
    return;
  }
  const noteText = text.slice(0, 42);
  setState({ noteText, noteAt: Date.now(), noteReply: replyFor(noteText), aiReply: '' });
  save();
  const grew = rewardDailyCare('note');
  if (refresh) refresh();
  hideOverlay($('noteOverlay'));
  toast(grew ? '这句话长成了一片叶子，树也向前长了一点。' : '这句话长成了一片叶子。');
}

export async function askAiReply() {
  if (!getState().aiApiKey) { openAiConfig(); return; }
  const input = $('noteInput');
  const text = input ? input.value.trim() : '';
  const button = $('aiReply');
  if (!text) { toast('先写一句话，树才知道该怎样回应。'); return; }
  if (button) { button.disabled = true; button.textContent = '树在想一想…'; }
  try {
    const state = getState();
    const baseUrl = (state.aiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.aiApiKey}`,
      },
      body: JSON.stringify({
        model: state.aiModel || 'gpt-4o-mini',
        temperature: 0.7,
        max_tokens: 120,
        messages: [
          { role: 'system', content: '你是一个安静、温柔的树形陪伴者。只用简体中文回应一句到两句。接住用户的感受，不诊断、不说教、不强行积极、不连续追问，不提供医疗或危机判断。不要声称自己真正理解用户的人生。' },
          { role: 'user', content: text.slice(0, 42) },
        ],
      }),
    });
    const result = await response.json();
    const reply = result?.choices?.[0]?.message?.content?.trim();
    if (!response.ok || !reply) throw new Error(result.error?.message || 'AI response failed');
    setState({ aiReply: reply.slice(0, 180) });
    save();
    renderNoteReply();
    toast('树听见了，也替你回了一句话。');
  } catch (error) {
    toast('现在还联系不上 AI，树先陪你安静一会儿。');
  } finally {
    if (button) { button.disabled = false; button.textContent = '和树聊聊'; }
  }
}