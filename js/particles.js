/* ============================================================
 * 愈合之树 — Canvas 粒子（夜晚星星 + 萤火虫）
 * 依赖: ui.js, theme.js
 * ============================================================ */
import { $, reducedMotion } from './ui.js';
import { isNight } from './theme.js';

let Pctx = null;
let PRAF;
let lastPFrame = 0;

function resizeP() {
  if (!Pctx) return;
  const canvas = $('particles');
  if (!canvas) return;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}

function drawStaticP() {
  if (!Pctx) return;
  const canvas = $('particles');
  Pctx.clearRect(0, 0, canvas.width, canvas.height);
  if (isNight()) drawStarField(Pctx, true);
}

function loopP(ts) {
  cancelAnimationFrame(PRAF);
  if (document.hidden) { PRAF = requestAnimationFrame(loopP); return; }
  if (ts - lastPFrame >= 33) {
    lastPFrame = ts;
    if (!Pctx) return;
    const canvas = $('particles');
    Pctx.clearRect(0, 0, canvas.width, canvas.height);
    if (isNight()) drawStarField(Pctx);
  }
  PRAF = requestAnimationFrame(loopP);
}

function drawStarField(c, stat) {
  const { width: w, height: h } = c.canvas;
  const ts = Date.now() / 1000;
  const n = 60;
  for (let i = 0; i < n; i++) {
    const x = (i * 97) % w;
    const y = (i * 41) % (h * 0.7);
    const tw = stat ? 0.62 : 0.4 + 0.6 * Math.abs(Math.sin(ts * 0.8 + i * 7));
    c.globalAlpha = tw * 0.9;
    c.fillStyle = '#f5f2d8';
    c.beginPath();
    c.arc(x, y, i % 5 === 0 ? 1.7 : 1.0, 0, Math.PI * 2);
    c.fill();
  }
  const fm = 12;
  for (let i = 0; i < fm; i++) {
    const id = i * 53;
    const x = stat ? ((id * 0.37) % w) : (((id * 0.37) % w) + Math.sin(ts * 0.3 + i) * 22);
    const y0 = (h * 0.35) + ((i * 67) % (h * 0.5));
    const y = stat ? y0 : (y0 + Math.cos(ts * 0.24 + i * 3) * 18);
    const a = stat ? 0.42 : 0.18 + 0.5 * Math.abs(Math.sin(ts * (0.7 + (i % 3) * 0.2) + i));
    c.globalAlpha = a;
    c.fillStyle = '#eaff9a';
    c.beginPath(); c.arc(x, y, 1.9, 0, Math.PI * 2); c.fill();
    c.globalAlpha = a * 0.4;
    c.beginPath(); c.arc(x, y, 4.2, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

export function initParticles() {
  const canvas = $('particles');
  if (!canvas) return;
  Pctx = canvas.getContext('2d');
  resizeP();
  window.addEventListener('resize', () => { resizeP(); if (reducedMotion) drawStaticP(); });
  if (reducedMotion) { drawStaticP(); return; }
  loopP();
}
