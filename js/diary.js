/* ============================================================
 * 愈合之树 — 微型日记本
 *
 * 数据：entries[]，多条并存，永不覆盖（旧版 noteText 单条会被迁移进来）
 * 视图：按月分组的时间轴，倒序；左侧色点联动 feels 里当天记录的情绪
 * 隐私：全部只存本机 localStorage；只有新写时主动点「和树聊聊」才联网
 * ============================================================ */
import { getState, setState, save } from './state.js';
import { $, showOverlay, hideOverlay, toast } from './ui.js';

const MAX_TEXT = 42;
const NO_COLOR = 'rgba(120,140,125,.26)';
const PAGE = 40;          // 每次渲染的条目数，日记多了也不卡
let _limit = PAGE;        // 当前已展开的条目上限

/* ---------------- 数据层 ---------------- */

export function entryList() {
  const list = getState().entries;
  return Array.isArray(list) ? list : [];
}

function writeEntries(list) {
  setState({ entries: list });
  save();
}

function newId() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function addEntry({ text, reply = '', aiReply = '' }) {
  const list = entryList();
  const entry = {
    id: newId(),
    text: String(text || '').slice(0, MAX_TEXT),
    at: Date.now(),
    reply: reply || '',
    aiReply: aiReply || '',
  };
  list.push(entry);
  writeEntries(list);
  return entry;
}

export function updateEntry(id, patch) {
  const list = entryList();
  const i = list.findIndex(e => e.id === id);
  if (i < 0) return null;
  list[i] = Object.assign({}, list[i], patch);
  writeEntries(list);
  return list[i];
}

export function deleteEntry(id) {
  writeEntries(entryList().filter(e => e.id !== id));
}

export function latestEntry() {
  const list = entryList();
  return list.length ? list[list.length - 1] : null;
}

/* 保证这句话已存档：直接点「和树聊聊」而没点「让树回应」时也要留下 */
export function ensureEntry(text, reply) {
  const t = String(text || '').slice(0, MAX_TEXT);
  const list = entryList();
  const now = Date.now();
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].text === t && now - list[i].at < 5 * 60 * 1000) return list[i];
  }
  return addEntry({ text: t, reply });
}

/* ---------------- 视图层 ---------------- */

function dayKey(ts) { return new Date(ts).toDateString(); }

/* 预构建 日期→情绪 映射：渲染 N 条只需 O(N)，不再每条遍历全量 feels */
function buildMoodMap() {
  const map = {};
  for (const f of getState().feels || []) map[dayKey(f.t)] = f;
  return map;
}

function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function fmtMonth(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ESCAPES[c]);
}

function itemHtml(e, mood) {
  const reply = e.aiReply || e.reply || '';
  return `<div class="diary-item">
      <span class="diary-dot" style="--c:${mood ? escapeHtml(mood.color) : NO_COLOR}"></span>
      <div class="diary-body">
        <p class="diary-date">${fmtDate(e.at)}${mood ? ' · ' + escapeHtml(mood.label) : ''}</p>
        <p class="diary-text">${escapeHtml(e.text)}</p>
        ${reply ? `<p class="diary-reply">树：${escapeHtml(reply)}</p>` : ''}
      </div>
      <button class="diary-del" data-id="${escapeHtml(e.id)}" aria-label="删掉这一篇" title="删掉这一篇">×</button>
    </div>`;
}

/* reset=true 或省略：回到最新一页；false：在当前位置继续展开更早 */
export function renderDiary(reset) {
  if (reset !== false) _limit = PAGE;
  const list = $('diaryList');
  if (!list) return;
  const all = entryList();
  const meta = $('diaryMeta');
  const empty = $('diaryEmpty');

  if (meta) {
    if (!all.length) meta.textContent = '';
    else {
      const first = all.reduce((a, b) => (a.at <= b.at ? a : b));
      const days = Math.max(1, Math.ceil((Date.now() - first.at) / 86400000));
      meta.textContent = `共 ${all.length} 篇 · 最早一篇在 ${days} 天前`;
    }
  }

  if (!all.length) {
    list.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const moodMap = buildMoodMap();
  const desc = all.slice().sort((a, b) => b.at - a.at);
  const shown = desc.slice(0, _limit);
  const groups = [];
  for (const e of shown) {
    const key = fmtMonth(e.at);
    if (!groups.length || groups[groups.length - 1].key !== key) groups.push({ key, items: [] });
    groups[groups.length - 1].items.push(e);
  }
  let html = groups.map(g =>
    `<p class="diary-month">${escapeHtml(g.key)} · ${g.items.length} 篇</p>${g.items.map(e => itemHtml(e, moodMap[dayKey(e.at)] || null)).join('')}`
  ).join('');
  const rest = desc.length - shown.length;
  if (rest > 0) html += `<button class="diary-more" data-action="more">更早的还有 ${rest} 篇 · 再看看</button>`;
  list.innerHTML = html;
}

export function openDiary() {
  renderDiary();
  showOverlay($('diaryOverlay'));
}

export function closeDiary() {
  hideOverlay($('diaryOverlay'));
}

/* 列表内点击：加载更早 / 删除（两次点击确认） */
export function handleDiaryClick(e) {
  const t = e.target;
  if (t.closest && t.closest('[data-action="more"]')) {
    _limit += PAGE;
    renderDiary(false);
    return;
  }
  const del = t.closest && t.closest('.diary-del');
  if (!del) return;
  const id = del.dataset.id;
  if (!entryList().some(x => x.id === id)) return;
  if (!del.classList.contains('pending')) {
    del.classList.add('pending');
    del.textContent = '确定删除？';
    setTimeout(() => { del.classList.remove('pending'); del.textContent = '×'; }, 2600);
    return;
  }
  deleteEntry(id);
  renderDiary(false);
  toast('已经删掉了。');
}

/* ---------------- 导出备份 ---------------- */

function stamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function download(filename, content, type) {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function ascending() {
  return entryList().slice().sort((a, b) => a.at - b.at);
}

function toMarkdown() {
  const lines = ['# 愈合之树 · 我写给自己的话', '', `> 导出于 ${new Date().toLocaleString('zh-CN')}`, ''];
  const moodMap = buildMoodMap();
  let lastMonth = '';
  for (const e of ascending()) {
    const key = fmtMonth(e.at);
    if (key !== lastMonth) { lines.push('', `## ${key}`, ''); lastMonth = key; }
    const m = moodMap[dayKey(e.at)];
    lines.push(`### ${fmtDate(e.at)}${m ? ' · ' + m.label : ''}`, '', e.text, '');
    const reply = e.aiReply || e.reply;
    if (reply) lines.push(`> 树：${reply}`, '');
  }
  return lines.join('\n');
}

export function exportMarkdown() {
  if (!entryList().length) { toast('还没有写过，没什么可导出的。'); return; }
  download(`愈合之树-日记-${stamp()}.md`, toMarkdown(), 'text/markdown');
  toast('已导出，收好它。');
}

export function exportJson() {
  if (!entryList().length) { toast('还没有写过，没什么可备份的。'); return; }
  const data = {
    app: 'healing-tree',
    exportedAt: new Date().toISOString(),
    entries: ascending(),
    feels: getState().feels || [],
  };
  download(`愈合之树-备份-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
  toast('备份已导出，留着以后还能看。');
}
