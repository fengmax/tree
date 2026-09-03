/* ============================================================
 * 愈合之树 — 声音系统
 * 依赖: state.js, ui.js, theme.js
 * ============================================================ */
import { getState, setState, save } from './state.js';
import { $ } from './ui.js';
import { isNight } from './theme.js';

let audioCtx = null;
let activeNodes = [];
let soundOn = false;
let masterGain = null;

export function getVolume() { const s = getState(); return s.volume != null ? s.volume : 0.5; }

let noiseBuf = null;
function getNoiseBuf() {
  if (!audioCtx) return null;
  if (noiseBuf) return noiseBuf;
  const len = audioCtx.sampleRate * 2;
  noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

function makeWind(ctx, gainNode) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuf(); src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 520;
  const g = ctx.createGain(); g.gain.value = 0.3;
  src.connect(lp).connect(g).connect(gainNode);
  src.start();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(lp.frequency);
  lfo.start();
  return { src, lfo, gain: g };
}

function makeRain(ctx, gainNode) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuf(); src.loop = true;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 800;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 4000;
  const g = ctx.createGain(); g.gain.value = 0.25;
  src.connect(hp).connect(lp).connect(g).connect(gainNode);
  src.start();
  return { src, gain: g };
}

function makeStream(ctx, gainNode) {
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuf(); src.loop = true;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.6;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = 2500;
  const g = ctx.createGain(); g.gain.value = 0.22;
  src.connect(bp).connect(lp).connect(g).connect(gainNode);
  src.start();
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.3;
  const lfoGain = ctx.createGain(); lfoGain.gain.value = 300;
  lfo.connect(lfoGain).connect(bp.frequency);
  lfo.start();
  return { src, lfo, gain: g };
}

function makeBirds(ctx, gainNode) {
  const g = ctx.createGain(); g.gain.value = 0.0;
  g.connect(gainNode);
  let stopped = false;
  function chirp() {
    if (stopped || !audioCtx) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const baseF = 2000 + Math.random() * 2500;
    osc.frequency.setValueAtTime(baseF, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseF * 1.4, ctx.currentTime + 0.06);
    osc.frequency.exponentialRampToValueAtTime(baseF * 0.7, ctx.currentTime + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(env).connect(g);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    const next = 2000 + Math.random() * 4000;
    setTimeout(chirp, next);
  }
  setTimeout(chirp, 500 + Math.random() * 2000);
  return {
    src: { stop: () => { stopped = true; } },
    gain: g,
    set stopped(v) { stopped = v; }
  };
}

function makeCrickets(ctx, gainNode) {
  const g = ctx.createGain(); g.gain.value = 0.0;
  g.connect(gainNode);
  let stopped = false;
  function pulse() {
    if (stopped || !audioCtx) return;
    const burstCount = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < burstCount; i++) {
      const t = ctx.currentTime + i * 0.06;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 7500 + Math.random() * 1500;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.04, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      osc.connect(env).connect(g);
      osc.start(t);
      osc.stop(t + 0.05);
    }
    const next = 1500 + Math.random() * 2500;
    setTimeout(pulse, next);
  }
  setTimeout(pulse, 1000 + Math.random() * 2000);
  return {
    src: { stop: () => { stopped = true; } },
    gain: g,
    set stopped(v) { stopped = v; }
  };
}

function resolveSoundType() {
  const state = getState();
  if (state.soundType && state.soundType !== 'auto') return state.soundType;
  return isNight() ? 'crickets' : 'birds';
}

export function startAmbient() {
  if (soundOn || !audioCtx || !masterGain) return;
  stopAmbient();
  try {
    const type = resolveSoundType();
    const nodes = [];
    nodes.push(makeWind(audioCtx, masterGain));
    if (type === 'rain') nodes.push(makeRain(audioCtx, masterGain));
    else if (type === 'stream') nodes.push(makeStream(audioCtx, masterGain));
    else if (type === 'birds') nodes.push(makeBirds(audioCtx, masterGain));
    else if (type === 'crickets') nodes.push(makeCrickets(audioCtx, masterGain));
    activeNodes = nodes;
    soundOn = true;
  } catch (e) { soundOn = false; }
}

export function stopAmbient() {
  activeNodes.forEach(n => {
    try {
      if (n.src && n.src.stop) n.src.stop();
      if (n.lfo && n.lfo.stop) n.lfo.stop();
    } catch(e){}
  });
  activeNodes = [];
  soundOn = false;
}

export function ensureAudio() {
  const state = getState();
  if (state.muted) return;
  if (audioCtx) { startAmbient(); return; }
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
  catch(e){ return; }
  audioCtx.resume && audioCtx.resume();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = getVolume();
  masterGain.connect(audioCtx.destination);
  startAmbient();
}

export function switchSoundType(type) {
  setState({ soundType: type });
  save();
  if (soundOn && audioCtx) { stopAmbient(); startAmbient(); }
}

export function setVolume(v) {
  v = Math.max(0, Math.min(1, v));
  setState({ volume: v });
  save();
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(v, audioCtx.currentTime, 0.1);
  }
  if (v === 0 && !getState().muted) setMuted(true);
  else if (v > 0 && getState().muted) setMuted(false);
}

export function setMuted(m) {
  setState({ muted: m });
  save();
  const btn = $('muteBtn');
  const ico = btn && btn.querySelector('.dock-ico');
  if (m) { stopAmbient(); audioCtx && audioCtx.suspend && audioCtx.suspend(); }
  else { ensureAudio(); }
  if (ico) ico.textContent = m ? '🔇' : '🔊';
  if (btn) btn.setAttribute('aria-pressed', m ? 'true' : 'false');
  const vol = $('volSlider');
  if (vol) vol.value = m ? 0 : getVolume();
  updateSoundPanel();
}

export function updateSoundPanel() {
  const panel = $('soundOverlay');
  if (!panel || panel.hidden) return;
  const state = getState();
  const cur = state.soundType || 'auto';
  panel.querySelectorAll('.sound-opt').forEach(b => {
    b.classList.toggle('sel', b.dataset.type === cur);
  });
  const vol = $('volSlider');
  if (vol) vol.value = state.muted ? 0 : getVolume();
}

export function playWaterSound() {
  if (!audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    const src = audioCtx.createBufferSource();
    src.buffer = getNoiseBuf();
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(2500, t);
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.6);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.3 * getVolume(), t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(bp).connect(g).connect(masterGain || audioCtx.destination);
    src.start(t);
    src.stop(t + 0.85);

    const drops = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < drops; i++) {
      const dt = t + 0.3 + i * 0.15 + Math.random() * 0.1;
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      const f = 800 + Math.random() * 600;
      osc.frequency.setValueAtTime(f, dt);
      osc.frequency.exponentialRampToValueAtTime(f * 0.5, dt + 0.08);
      const env = audioCtx.createGain();
      env.gain.setValueAtTime(0, dt);
      env.gain.linearRampToValueAtTime(0.12 * getVolume(), dt + 0.005);
      env.gain.exponentialRampToValueAtTime(0.001, dt + 0.1);
      osc.connect(env).connect(masterGain || audioCtx.destination);
      osc.start(dt);
      osc.stop(dt + 0.12);
    }
  } catch(e){}
}

let breathAudioNodes = [];
export function startBreathAmbient() {
  if (!audioCtx || !masterGain) return;
  stopBreathAmbient();
  try {
    const osc = audioCtx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 110;
    const g = audioCtx.createGain(); g.gain.value = 0.0;
    osc.connect(g).connect(masterGain);
    osc.start();
    g.gain.setTargetAtTime(0.06, audioCtx.currentTime, 1.5);
    let stopped = false;
    function bell() {
      if (stopped || !audioCtx) return;
      const t = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      o.type = 'sine';
      o.frequency.value = 880 + Math.random() * 440;
      const env = audioCtx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.03 * getVolume(), t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
      o.connect(env).connect(masterGain);
      o.start(t); o.stop(t + 1.6);
      const next = 4000 + Math.random() * 6000;
      setTimeout(bell, next);
    }
    setTimeout(bell, 2000);
    breathAudioNodes = [{ src: osc, gain: g }, { src: { stop: () => { stopped = true; } } }];
    breathAudioNodes[1].setStopped = (v) => { stopped = v; };
  } catch(e){}
}

export function stopBreathAmbient() {
  breathAudioNodes.forEach(n => {
    try {
      if (n.gain && audioCtx) n.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.8);
      setTimeout(() => { if (n.src && n.src.stop) n.src.stop(); }, 1200);
      if (n.setStopped) n.setStopped(true);
    } catch(e){}
  });
  breathAudioNodes = [];
}
