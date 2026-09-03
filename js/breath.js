/* ============================================================
 * 愈合之树 — 呼吸引导
 * 依赖: ui.js, audio.js
 * ============================================================ */
import { $, showOverlay, hideOverlay } from './ui.js';
import { startBreathAmbient, stopBreathAmbient } from './audio.js';

let breathStop = false;
let breathTimers = [];
let breathCycles = 0;

export function openBreath() {
  showOverlay($('breathOverlay'));
  const word = $('breathWord');
  const tip = $('breathTip');
  const ring = $('breathRing');
  breathCycles = 0;
  tip.textContent = '跟着圈，慢慢吸气 4 秒，再缓缓呼出 6 秒。';
  let phase = 'inhale';
  ring.className = 'breath-ring inhale';
  word.textContent = '吸气';
  const cycle = () => {
    if (breathStop) return;
    if (phase === 'inhale') {
      ring.className = 'breath-ring inhale';
      word.textContent = '吸气';
      let t = setTimeout(() => { phase = 'exhale'; cycle(); }, 4000);
      breathTimers.push(t);
    } else {
      ring.className = 'breath-ring exhale';
      word.textContent = '呼气';
      let t2 = setTimeout(() => {
        breathCycles++;
        if (breathCycles === 5) {
          tip.textContent = '已陪伴你 5 次呼吸。继续或收好，都可以。';
        }
        phase = 'inhale';
        cycle();
      }, 6000);
      breathTimers.push(t2);
    }
  };
  cycle();
  const endT = setTimeout(() => {
    if (!breathStop) { tip.textContent = '够了吗？收好也行，继续也行。'; }
  }, 120000);
  breathTimers.push(endT);
}

export function closeBreath() {
  breathStop = true;
  breathTimers.forEach(clearTimeout);
  breathTimers = [];
  hideOverlay($('breathOverlay'));
  stopBreathAmbient();
  breathStop = false;
}

export function openBreathWithAudio() {
  openBreath();
  startBreathAmbient();
}
