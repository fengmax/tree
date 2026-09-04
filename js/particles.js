/* ============================================================
 * 愈合之树 — Canvas 粒子（夜晚星星 + 萤火虫）
 * 依赖: ui.js, theme.js
 * ============================================================ */
import { $, reducedMotion } from './ui.js';
import { isNight } from './theme.js';

let Pctx = null;
let PRAF;
let lastPFrame = 0;
let microEvent = null;
let nextMicroEventAt = 0;

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
    drawMicroEvent(Pctx, ts);
  }
  PRAF = requestAnimationFrame(loopP);
}

function drawMicroEvent(c, ts) {
  const { width: w, height: h } = c.canvas;
  if (!nextMicroEventAt) {
    nextMicroEventAt = ts + 9000 + Math.random() * 12000;
    return;
  }
  if (!microEvent && ts >= nextMicroEventAt) {
    const season = [...document.body.classList].find(name => name.startsWith('season-'))?.slice(7) || 'spring';
    microEvent = {
      kind: season === 'spring' ? 'butterfly' : season === 'autumn' ? 'leaf' : season === 'winter' ? 'snow' : 'firefly',
      start: ts,
      duration: season === 'spring' ? 6200 : 5200,
      x: Math.random() * w,
      y: h * (.28 + Math.random() * .25),
    };
  }
  if (!microEvent) {
    return;
  }

  const event = microEvent;
  const progress = (ts - event.start) / event.duration;
  if (progress >= 1) {
    microEvent = null;
    nextMicroEventAt = ts + 16000 + Math.random() * 22000;
    return;
  }
  const fade = Math.min(1, progress * 5, (1 - progress) * 5);
  c.save();
  c.globalAlpha = fade * .7;

  if (event.kind === 'butterfly') {
    const x = -28 + (w + 56) * progress;
    const y = event.y + Math.sin(progress * Math.PI * 4) * 18;
    c.translate(x, y);
    c.rotate(Math.sin(progress * Math.PI * 4) * .12);
    const flap = 3 + Math.abs(Math.sin(ts / 90)) * 4;
    c.fillStyle = '#e8a8a0';
    c.beginPath(); c.ellipse(-flap, -2, flap, 5, -.35, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(flap, -2, flap, 5, .35, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#856e61';
    c.fillRect(-.8, -3, 1.6, 7);
  } else if (event.kind === 'leaf') {
    const x = event.x + Math.sin(progress * Math.PI * 3) * 45;
    const y = -18 + h * .68 * progress;
    c.translate(x, y);
    c.rotate(progress * Math.PI * 3);
    c.fillStyle = progress < .5 ? '#cc8b55' : '#d4a24d';
    c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(7, -2, 0, 6); c.quadraticCurveTo(-7, -2, 0, -6); c.fill();
  } else if (event.kind === 'snow') {
    const x = event.x + Math.sin(progress * Math.PI * 2) * 24;
    const y = -12 + h * .62 * progress;
    c.fillStyle = '#f3f7f3';
    c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + 12, y - 28, 1.5, 0, Math.PI * 2); c.fill();
  } else {
    const x = event.x + Math.sin(progress * Math.PI * 2) * 28;
    const y = event.y + Math.cos(progress * Math.PI * 3) * 24;
    c.fillStyle = '#eaff9a';
    c.shadowColor = '#eaff9a'; c.shadowBlur = 10;
    c.beginPath(); c.arc(x, y, 2.2, 0, Math.PI * 2); c.fill();
  }
  c.restore();
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
