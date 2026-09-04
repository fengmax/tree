/* ============================================================
 * 愈合之树 — SVG 参数化树绘制
 * 依赖: config.js, state.js, ui.js, growth.js
 * ============================================================ */
import { STAGES, BETTER_NEED } from './config.js';
import { getState, save } from './state.js';
import { $, toast } from './ui.js';
import { stageAt } from './growth.js';

// 颜色插值：把一种十六进制色柔和地过渡到另一种
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = pa >> 16, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = pb >> 16, bg = (pb >> 8) & 255, bb = pb & 255;
  const mr = Math.round(ar + (br - ar) * t);
  const mg = Math.round(ag + (bg - ag) * t);
  const mb = Math.round(ab + (bb - ab) * t);
  return '#' + ((1 << 24) + (mr << 16) + (mg << 8) + mb).toString(16).slice(1);
}

// 金果：柔和光晕 + 果实 + 高光
function goldFruit(cx, cy, r) {
  let s = `<circle class="gold-halo" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * 2).toFixed(1)}" fill="url(#goldHalo)"/>`;
  s += `<circle class="gold-fruit" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="url(#goldFruit)" stroke="rgba(255,255,255,.5)" stroke-width="1"/>`;
  s += `<circle cx="${(cx - r * .32).toFixed(1)}" cy="${(cy - r * .34).toFixed(1)}" r="${(r * .3).toFixed(1)}" fill="#fdf4d2" opacity=".95"/>`;
  return s;
}

// 一朵 5 瓣小花
function flowerHTMLAt(cx, cy, r, alpha, g) {
  const petals = 5;
  const warm = Math.max(0, Math.min(1, (g - .12) / .88));
  let out = `<g class="tree-flower" opacity="${alpha.toFixed(2)}">`;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(a) * r * .74;
    const py = cy + Math.sin(a) * r * .74;
    out += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r * .92).toFixed(1)}" fill="${i % 2 ? 'url(#petalA)' : 'url(#petalB)'}"/>`;
  }
  out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * .56).toFixed(1)}" fill="url(#heartG)"/>`;
  out += `<circle cx="${(cx - r * .16).toFixed(1)}" cy="${(cy - r * .18).toFixed(1)}" r="${(r * .15).toFixed(1)}" fill="#fff" opacity="${(0.5 + warm * .3).toFixed(2)}"/>`;
  out += `</g>`;
  return out;
}

function groundLife(g) {
  const season = [...document.body.classList].find(name => name.startsWith('season-'))?.slice(7) || 'spring';
  const life = Math.max(0, Math.min(1, g / 0.25));
  let out = `<g class="ground-life" opacity="${(0.3 + life * 0.7).toFixed(2)}">`;

  const grass = [
    [92, 403, -18], [112, 407, -10], [208, 406, 12], [229, 402, 20],
  ];
  grass.forEach(([x, y, tilt], i) => {
    out += `<path class="ground-sway" style="--delay:${i * .35}s" d="M${x},${y} Q${x + tilt * .35},${y - 10} ${x + tilt},${y - 17}" fill="none" stroke="#73966f" stroke-width="1.8" stroke-linecap="round"/>`;
  });

  out += '<ellipse cx="104" cy="411" rx="6" ry="2.5" fill="#8d8068" opacity=".42"/>';
  out += '<ellipse cx="218" cy="410" rx="8" ry="3" fill="#817963" opacity=".36"/>';

  if (season === 'spring') {
    out += '<circle cx="82" cy="395" r="2.6" fill="#edc4c4" opacity=".78"/>';
    out += '<circle cx="238" cy="397" r="2.2" fill="#f0d2a2" opacity=".72"/>';
  } else if (season === 'summer') {
    out += '<circle cx="83" cy="401" r="2.5" fill="#d7bb70" opacity=".58"/>';
    out += '<circle cx="239" cy="400" r="2.5" fill="#d7bb70" opacity=".58"/>';
  } else if (season === 'autumn') {
    out += '<path class="falling-leaf" style="--delay:.2s" d="M84 397 Q88 392 92 397 Q88 402 84 397Z" fill="#c98255" opacity=".82"/>';
    out += '<path class="falling-leaf" style="--delay:1.1s" d="M230 400 Q234 395 238 400 Q234 405 230 400Z" fill="#d3a04e" opacity=".78"/>';
  } else {
    out += '<path d="M82 402 Q88 397 94 402 Q88 405 82 402Z" fill="#eef3f0" opacity=".72"/>';
    out += '<path d="M226 402 Q234 397 241 402 Q234 405 226 402Z" fill="#eef3f0" opacity=".66"/>';
  }

  out += '</g>';
  return out;
}

export function betterCount() { return (getState().hearts || []).length; }
export function goldFruitIntended() { return Math.floor(betterCount() / BETTER_NEED); }

export function trackGoldFlag() {
  const state = getState();
  const before = state.goldFruits;
  const target = goldFruitIntended();
  if (target > 0 && target > before) {
    state.goldFruits = target;
    save();
    setTimeout(() => toast('树梢结出一颗金色的果实 ✨ 它为你高兴。'), 400);
  }
}

function noteLeaf() {
  const text = (getState().noteText || '').trim();
  if (!text) return '';
  const short = text.length > 9 ? text.slice(0, 9) + '…' : text;
  return `<g class="note-leaf"><title>${text.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</title><path d="M173 359 C188 345 202 351 204 365 C190 370 180 367 173 359Z" fill="#bdd8a9" opacity=".92"/><path d="M176 360 Q188 359 200 357" fill="none" stroke="#7eaa78" stroke-width=".8" opacity=".7"/><text x="187" y="362" text-anchor="middle" font-size="3.6" fill="#4c7055">${short.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</text></g>`;
}

export function renderTree(g) {
  const root = $('treeRoot');
  if (!root) return;

  const baseX = 160;
  const soilY = 408;
  let html = '';

  html += groundLife(g);
  html += noteLeaf();

  // 土壤
  html += `<ellipse cx="${baseX}" cy="${soilY + 3}" rx="108" ry="16" fill="#5d4a33" opacity=".20" filter="url(#soft)"/>`;
  html += `<ellipse cx="${baseX}" cy="${soilY}" rx="90" ry="13" fill="#8a6a4e" opacity=".45"/>`;
  html += `<ellipse cx="${baseX}" cy="${soilY - 1}" rx="76" ry="11" fill="url(#soilgrad)" opacity=".95"/>`;
  html += `<ellipse cx="${baseX}" cy="${soilY - 3}" rx="54" ry="6" fill="url(#soilTop)" opacity=".85"/>`;

  const trunkH = 20 + g * 165;
  const trunkW = 2.5 + g * 9;

  if (g < 0.001) {
    html += `<ellipse cx="${baseX}" cy="${soilY - 2}" rx="10" ry="2.8" fill="#5d4a33" opacity=".4"/>`;
    html += `<ellipse cx="${baseX}" cy="${soilY - 5}" rx="8" ry="4.6" fill="#b78a52"/>`;
    html += `<ellipse cx="${baseX - .5}" cy="${soilY - 6.2}" rx="2.7" ry="4.3" fill="#c9a26b" opacity=".95"/>`;
    html += `<circle cx="${(baseX - 2.6).toFixed(1)}" cy="${(soilY - 6.6).toFixed(1)}" r="1.1" fill="#f6e9d2" opacity=".8"/>`;
    html += `<title>一颗种子，正在土里安静歇着。慢慢来，它会知道的。</title>`;
  } else if (g < 0.12) {
    const h = 4 + g * 55;
    const tipY = soilY - h;
    html += `<line x1="${baseX}" y1="${soilY + 1}" x2="${baseX}" y2="${tipY}"`
           + ` stroke="#7f9c70" stroke-width="3" stroke-linecap="round"/>`;
    html += `<ellipse cx="${baseX}" cy="${soilY - 1}" rx="${(3 + g * 6).toFixed(1)}" ry="1.6" fill="#6f9c70" opacity=".35"/>`;
    html += `<ellipse cx="${baseX - 7}" cy="${tipY - 1}" rx="7" ry="10" fill="url(#leafG0)" opacity=".95" transform="rotate(30 ${baseX - 7} ${tipY - 1})"/>`;
    html += `<ellipse cx="${baseX + 7}" cy="${tipY - 1}" rx="7" ry="10" fill="url(#leafG1)" opacity=".95" transform="rotate(-30 ${baseX + 7} ${tipY - 1})"/>`;
  } else {
    html += '<g class="tree-life">';
    const topY = soilY - trunkH;
    const hr = Math.max(0, g - 0.12) / 0.88;

    const trunkP = (s) => `M${(baseX - s / 2).toFixed(1)},${soilY} C ${(baseX - s).toFixed(1)},${(soilY - trunkH * .35).toFixed(1)} ${(baseX + s).toFixed(1)},${(soilY - trunkH * .6).toFixed(1)} ${baseX},${topY}`;
    html += `<path d="${trunkP(trunkW * 1.9)}" fill="none" stroke="#a97c50" stroke-width="${(trunkW * 1.45).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".25"/>`;
    html += `<path d="${trunkP(trunkW * 1.15)}" fill="none" stroke="#9a6c44" stroke-width="${(trunkW * 1.0).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>`;
    html += `<path d="${trunkP(trunkW)}" fill="none" stroke="#8a5f3b" stroke-width="${(trunkW * .72).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>`;
    html += `<path d="${trunkP(trunkW * .4)}" fill="none" stroke="#c39a6e" stroke-width="${Math.max(1, trunkW * .14).toFixed(1)}" stroke-linecap="round" opacity=".5"/>`;
    html += `<ellipse cx="${baseX}" cy="${soilY - 1}" rx="${(trunkW * .85).toFixed(1)}" ry="${(trunkW * .3).toFixed(1)}" fill="#7c5636" opacity=".8"/>`;

    const wrap = Math.max(0, Math.min(1, hr));
    const scY = soilY - trunkH * 0.26;
    const scarRx = Math.max(2.2, trunkW * .30 + g * .4);
    const scarA = Math.max(.06, .40 - g * .24);
    const ry = scarRx * .88;
    const innerCol = mixHex('#5e3f28', '#c89a70', .18 + wrap * .82);
    html += `<ellipse cx="${baseX}" cy="${scY}" rx="${(scarRx * 1.9).toFixed(1)}" ry="${(ry * 1.9).toFixed(1)}" fill="url(#scarRing)" opacity="${Math.min(.55, scarA + .12).toFixed(2)}"/>`;
    html += `<ellipse cx="${baseX}" cy="${scY}" rx="${scarRx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${innerCol}" opacity="${scarA.toFixed(2)}"/>`;
    html += `<path d="M${(baseX - scarRx).toFixed(1)},${(scY - 1).toFixed(1)} A ${scarRx.toFixed(1)} ${(ry * .72).toFixed(1)} 0 0 1 ${(baseX + scarRx).toFixed(1)},${(scY - 1).toFixed(1)}" fill="none" stroke="${mixHex('#d3ac86', '#e9cbaa', wrap)}" stroke-width="1.1" stroke-linecap="round" opacity="${Math.min(.9, scarA * 1.5).toFixed(2)}"/>`;

    html += flowerHTMLAt(baseX + trunkW + 2.5, scY - 2, 5.5 + hr * 6, 1.0, g);

    const crownCy = topY - 6 - hr * 14;
    const crownR = 14 + hr * 34;
    html += `<circle cx="${baseX}" cy="${(crownCy + 3).toFixed(1)}" r="${(crownR * 1.5).toFixed(1)}" fill="url(#leafG1)" opacity=".5"/>`;
    const blobs = Math.round(6 + hr * 26);
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * Math.PI * 2 + 0.4;
      const rr = crownR * (0.5 + 0.5 * (i % 3) * 0.24);
      const bx = baseX + Math.cos(a) * rr;
      const by = crownCy + Math.sin(a) * rr * 0.8;
      const s = crownR * (0.36 + ((i * 7) % 5) * 0.12);
      const gid = (i % 5 === 0) ? 'url(#leafG2)' : ((i % 3 === 0) ? 'url(#leafG1)' : 'url(#leafG0)');
      html += `<circle class="canopy-bloom" style="--leaf-index:${i}" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${s.toFixed(1)}" fill="${gid}"/>`;
    }
    html += `<circle cx="${baseX}" cy="${(crownCy + 8).toFixed(1)}" r="${(crownR * 1.0).toFixed(1)}" fill="url(#leafG0)" opacity=".95"/>`;
    html += `<circle cx="${baseX}" cy="${(crownCy - crownR * 0.5).toFixed(1)}" r="${(4 + hr * 10).toFixed(1)}" fill="url(#leafG1)"/>`;

    if (stageAt(g).key === 'bloom' || stageAt(g).key === 'fruit' || stageAt(g).key === 'canopy') {
      const nFl = Math.min(5, Math.floor((hr - .45) / .1) + 3);
      for (let i = 0; i < nFl; i++) {
        const a = 0.6 + i * 1.25;
        html += flowerHTMLAt(baseX + Math.cos(a) * crownR * 0.7, crownCy + Math.sin(a) * crownR * 0.55, 3.5 + (i % 2), 0.9, g);
      }
    }

    const goldN = Math.min(goldFruitIntended(), 3);
    if (goldN > 0 && hr > 0.1) {
      for (let k = 0; k < goldN; k++) {
        const tilt = -0.4 + k * 0.4;
        const gx = baseX + Math.cos(tilt) * crownR * 0.55;
        const gy = crownCy + 6 + Math.sin(tilt) * crownR * 0.5;
        html += goldFruit(gx, gy, 4.8 + hr * .8);
      }
    }
    html += '</g>';
  }

  root.innerHTML = html;
  const svg = $('treeSvg');
  if (svg) svg.setAttribute('aria-label', stageAt(g).label);
}
