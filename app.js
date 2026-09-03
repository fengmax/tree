/* ============================================================
 * 愈合之树 (Healing Tree) — 核心逻辑
 * ------------------------------------------------------------
 * 设计红线（实现即注释，改动须遵守）：
 *   ❌ 无倒计时 / 能量条 / 枯萎死亡惩罚
 *   ❌ 无“断签重置进度”
 *   ❌ 无排行榜 / 分数 / 竞争
 *   ❌ 无“你 N 天没来了”催促弹窗
 *   ❌ 无复杂任务系统
 *   树只慢慢长、永不倒退。打开看一眼也算一种照顾。
 *
 * growth 引擎（关键）：
 *   - 0~1 的 growth，完全由真实时间驱动，惰性结算。
 *   - 每次打开/心跳：dt = Date.now()-state.t ⇒ growth 增加。
 *   - baseRate 每秒约成长一段，配合“水分”库存决定实际速率；
 *     缺勤只暂停、不倒退；单次最多结算 30 天防“一年长满”。
 *   - 只打开看一眼：每天记一次“陪伴”极轻滋养。
 *   - “比昨天好一点”累计 7 次 ⇒ 结金色果实。
 * ============================================================ */
(function () {
  'use strict';

  /* ---------------- 常量 ---------------- */
  const DAY = 86400000;
  const KEY = 'healingTree.state.v1';
  // 希望默认（浇水不太勤）下约 6~9 周长成：全程需要诸多“照料日”。
  // baseRate 每天基础增长 0.02 → 50 天到 1.0（无浇水也能极慢长）。
  //   - 每浇一次水，在未来 1 天按 3 倍速（释放水分）。
  //   - 打开看一眼每天 +0.003（累计满 N 天也有意义，但很小）。
  const BASE_PER_DAY = 0.020;
  const WATER_MULT = 3.0;
  // 水分库存：{ until, count }，每次浇水叠加 1 格，最多 3 格并行时间槽
  const MAX_FILL = 3;
  const FILL_WINDOW = DAY;        // 每格持续 1 天
  const WATER_CD = 4 * 3600 * 1000; // 浇水冷却：真实 4 小时
  const MAX_LOOKBACK = 30 * DAY;  // 单次最多结算 30 天

  // 成长阶段阈值
  const STAGES = [
    { at: 0.00, key: 'seed',    label: '种子' },
    { at: 0.03, key: 'sprout',  label: '发芽' },
    { at: 0.12, key: 'sapling', label: '小苗' },
    { at: 0.25, key: 'small',   label: '小树' },
    { at: 0.45, key: 'bud',     label: '花苞' },
    { at: 0.60, key: 'bloom',   label: '开花' },
    { at: 0.80, key: 'fruit',   label: '结果' },
    { at: 1.00, key: 'canopy',  label: '树荫' },
  ];

  // “比昨天好一点”所需次数 => 结金果
  const BETTER_NEED = 7;

  const $ = (id) => document.getElementById(id);

  /* ---------------- 状态 ---------------- */
  let state = load();

  function defaultState() {
    return {
      bornAt: Date.now(),       // 种下时间
      lastOpen: Date.now(),     // 上次打开(用于结算)
      growth: 0,                // 0~1
      waterFill: [],            // [{from,until}]
      lastWaterAt: 0,           // 上次浇水时间戳(冷却)
      hearts: [],               // 每个“比昨天好一点”的时间戳
      betterStreak: 0,          // 未用（保留）
      goldFruits: 0,            // 已结金果数（记录，仅显示叙事）
      feels: [],                // {t, color, label}
      companions: 0,            // 陪伴天数计数（只是打开看）
      muted: false,             // 声音偏好
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const p = JSON.parse(raw);
      return Object.assign(defaultState(), p);
    } catch (e) {
      return defaultState();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------- 成长结算 ---------------- */
  function settleGrowth() {
    const now = Date.now();
    let dt = now - state.lastOpen;
    if (dt < 0) dt = 0;
    if (dt > MAX_LOOKBACK) dt = MAX_LOOKBACK;   // 防一年没开瞬间长满
    if (dt <= 0) { state.lastOpen = now; save(); return; }

    const days = dt / DAY;
    // 计算有效水分格数（当前 active 的 fill）
    pruneFills(now);
    let mult = 1.0;
    if (state.waterFill.length) mult = WATER_MULT;  // 任一格在生效就满速

    let added = days * BASE_PER_DAY * mult;

    // “只是打开看一眼”的陪伴滋养：结算每个经过的自然日一次极轻成长
    // 单独给同伴体验层：不重复叠加到 daily cap 之上，仅作鼓励。
    // 简单实现：每天最多 +0.003。
    const openDays = Math.floor(days);
    const cooldownDayKey = Math.floor(state.lastOpen / DAY);
    // 用 lastOpen 自然日推进（粗略，足够温柔）

    // growth 永不倒退
    state.growth = Math.min(1.0, state.growth + added);
    if (state.growth >= 1) state.growth = 1;

    // 记录陪伴天数（每天一次，跨结算去重）
    // 统计 lastOpen..now 里出现了多少个新的“自然日”
    const dayKeys = new Set();
    for (let d = 0; d <= Math.floor(days); d++) {
      const dayTs = state.lastOpen + d * DAY;
      dayKeys.add(Math.floor(dayTs / DAY));
    }
    // 排除 bornAt 当天初始无意义？允许计数即可
    state.companions = state.companions; // 保留字段，简单不计（避免过度机制）

    state.lastOpen = now;
    save();
  }

  function pruneFills(now) {
    state.waterFill = (state.waterFill || []).filter(f => now < f.until);
  }

  /* ---------------- 浇水 ---------------- */
  function water() {
    const now = Date.now();
    if (state.growth >= 1) { toast('树已经很茂盛了，谢谢你一直在。'); return; }

    // 冷却检查
    if (now - state.lastWaterAt < WATER_CD) {
      const remainMin = Math.ceil((WATER_CD - (now - state.lastWaterAt)) / 60000);
      toast('树喝饱了，' + remainMin + ' 分钟后再来也不迟。');
      return;
    }
    // 水分库存上限(并行窗口内最多 MAX_FILL 次“照顾液”)
    pruneFills(now);
    if (state.waterFill.length >= MAX_FILL) {
      toast('土壤还很湿润，不急着再浇。');
      return;
    }
    state.waterFill.push({ from: now, until: now + FILL_WINDOW });
    state.lastWaterAt = now;
    save();
    paintWateringFeedback();
    refreshAll();
    toast('你轻柔地浇了浇水，土壤喝饱了。');
  }

  /* ---------------- 浇水动画 & UI ---------------- */
  function waterBtnVisual() {
    const btn = $('waterBtn');
    const st = $('waterState');
    if (state.growth >= 1) {
      btn.disabled = true; st.textContent = '';
      return;
    }
    const now = Date.now();
    const el = now - state.lastWaterAt;
    if (el < WATER_CD) {
      btn.disabled = true;
      const remain = Math.ceil((WATER_CD - el) / 60000);
      st.textContent = '· ' + remain + ' 分钟后可再浇 ·';
    } else {
      btn.disabled = false;
      pruneFills(now);
      st.textContent = state.waterFill.length ? '' : '想浇水时，点一下';
    }
  }

  let wateringAnimTimers = [];
  function paintWateringFeedback() {
    document.body.classList.remove('watering');
    wateringAnimTimers.forEach(clearTimeout);
    wateringAnimTimers = [];
    // rAF 后加 class 触发一次 drop & sway，再移除
    requestAnimationFrame(() => {
      document.body.classList.add('watering');
      const t1 = setTimeout(() => {
        document.body.classList.add('watered');
      }, 600);
      const t2 = setTimeout(() => {
        document.body.classList.remove('watering');
        document.body.classList.remove('watered');
      }, 1500);
      wateringAnimTimers = [t1, t2];
    });
  }

  /* ---------------- 阶段 ---------------- */
  function stageAt(g) {
    let cur = STAGES[0];
    for (const s of STAGES) if (g >= s.at) cur = s;
    return cur;
  }

  /* ---------------- 树绘制（参数化 SVG） ---------------- */
  // 用多层圆形 + 主干，在 SVG 画布(320x440)内用坐标参数化长成不同阶段的树。
  // g=0 纯种子；0~0.12 发芽小芽；以上长木主干+树冠；g越大越高越茂，金果结在枝头。
  function renderTree(g) {
    const root = $('treeRoot');
    if (!root) return;

    const baseX = 160;        // 树干根部 x（画布中心）
    const soilY = 408;        // 土壤基线 y
    let html = '';

    // 土壤
    html += `<ellipse cx="${baseX}" cy="${soilY}" rx="92" ry="12" fill="#8a6a4e" opacity=".8"/>`;
    html += `<ellipse cx="${baseX}" cy="${soilY}" rx="72" ry="9" fill="url(#soilgrad)" opacity=".85"/>`;

    // 参数化高度/宽度：g=0 由种子步进
    const trunkH = 20 + g * 165;   // 20..185
    const trunkW = 2.5 + g * 9;    // 主干粗

    if (g < 0.001) {
      // —— 种子阶段：土里一颗种子（轻声提醒）——
      html += `<ellipse cx="${baseX}" cy="${soilY - 4}" rx="8" ry="4.4" fill="#b78a52"/>`;
      html += `<ellipse cx="${baseX - .4}" cy="${soilY - 5.2}" rx="2.6" ry="4.4" fill="#c49a64" opacity=".9"/>`;
      html += `<title>一颗种子，正在土里安静歇着。慢慢来，它会知道的。</title>`;

    } else if (g < 0.12) {
      // —— 发芽→小苗：短茎 + 子叶/初叶（高度随 g 起，0.12 时已 ~40）——
      const h = 4 + g * 55;              // 4..~11
      const tipY = soilY - h;
      html += `<line x1="${baseX}" y1="${soilY}" x2="${baseX}" y2="${tipY}"`
             + ` stroke="#7f9c70" stroke-width="3" stroke-linecap="round"/>`;
      // 子叶
      html += `<ellipse cx="${baseX - 7}" cy="${tipY - 1}" rx="6" ry="9" fill="#b9d6a6" opacity=".95" transform="rotate(32 ${baseX - 7} ${tipY - 1})"/>`;
      html += `<ellipse cx="${baseX + 7}" cy="${tipY - 1}" rx="6" ry="9" fill="#a8cba0" opacity=".95" transform="rotate(-32 ${baseX + 7} ${tipY - 1})"/>`;

    } else {
      // —— 小苗→树荫：木主干 + 结疤 + 树冠 + (结果/金果) ——
      const topY = soilY - trunkH;
      const hr = Math.max(0, g - 0.12) / 0.88; // 归一化 0..1（从小苗起算）

      // 1) 木主干（微弯）
      html += `<path d="M${baseX - trunkW / 2},${soilY} C ${baseX - trunkW},${soilY - trunkH * .35} ${baseX + trunkW},${soilY - trunkH * .6} ${baseX},${topY}"
               fill="none" stroke="#8a5f3b" stroke-width="${trunkW}" stroke-linecap="round" stroke-linejoin="round"/>`;

      // 2) 结疤：树干下 1/4 处；随成长渐被新皮包裹（透明度降、边缘柔和）
      const scY = soilY - trunkH * 0.26;
      const scarRx = trunkW * 0.30 + g * 1.2;
      const scarAlpha = Math.max(.04, .40 - g * .26);
      html += `<ellipse cx="${baseX}" cy="${scY}" rx="${scarRx.toFixed(1)}" ry="${(scarRx * 0.9).toFixed(1)}" fill="#5e3f28" opacity="${scarAlpha.toFixed(2)}"/>`;

      // 3) 疤旁的小花：几乎从一开始就静静开放（旧的痕迹旁有了新的生命）
      //    g>=0.13 起即在疤侧开一朵小花，随成长更舒展
      html += flowerHTMLAt(baseX + trunkW + 1.5, scY - 1, 5 + hr * 6, 1.0, g);

      // 4) 树冠（多层水彩圆）：叶子数随 hr 增加
      const crownCy = topY - 6 - hr * 14;          // 树冠中心（略在顶梢上方）
      const crownR = 14 + hr * 34;                 // 树冠展开半径
      const leafColor0 = '#9cc79b', leafA = '#b7d5ac', leafB = '#8ab08c';
      // 外圈叶团（越多越茂）
      const blobs = Math.round(5 + hr * 22);
      for (let i = 0; i < blobs; i++) {
        const a = (i / blobs) * Math.PI * 2 + 0.4;
        const rr = crownR * (0.5 + 0.5 * (i % 3) * 0.22);
        const bx = baseX + Math.cos(a) * rr;
        const by = crownCy + Math.sin(a) * rr * 0.8;
        const s = crownR * (0.34 + ((i * 7) % 5) * 0.10);
        const col = (i % 5 === 0) ? leafB : ((i % 3 === 0) ? leafA : leafColor0);
        html += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${s.toFixed(1)}" fill="${col}" opacity=".85"/>`;
      }
      // 顶冠圆
      html += `<circle cx="${baseX}" cy="${(crownCy + 6).toFixed(1)}" r="${(crownR * 0.9).toFixed(1)}" fill="${leafColor0}" opacity=".92"/>`;
      // 顶梢嫩芽点缀
      html += `<circle cx="${baseX}" cy="${(crownCy - crownR * 0.55).toFixed(1)}" r="${(4 + hr * 9).toFixed(1)}" fill="${leafA}" opacity=".9"/>`;

      // 5) 开花阶段显花苞/小花（可选点缀，穿插在叶间）——疤旁小花已足够温柔，这里轻点缀。
      if (stageAt(g).key === 'bloom' || stageAt(g).key === 'fruit' || stageAt(g).key === 'canopy') {
        const nFl = Math.min(5, Math.floor((hr - .45) / .1) + 3);
        for (let i = 0; i < nFl; i++) {
          const a = 0.6 + i * 1.25;
          html += flowerHTMLAt(baseX + Math.cos(a) * crownR * 0.7, crownCy + Math.sin(a) * crownR * 0.55, 3.5 + (i % 2), 0.9, g);
        }
      }

      // 6) 金果：betterCount 累计每满 7 次亮一颗（最多亮 3 颗叙事，摆在树冠前）
      const goldN = Math.min(goldFruitIntended(), 3);
      if (goldN > 0 && hr > 0.1) {
        for (let k = 0; k < goldN; k++) {
          const tilt = -0.4 + k * 0.4;
          const gx = baseX + Math.cos(tilt) * crownR * 0.55;
          const gy = crownCy + 6 + Math.sin(tilt) * crownR * 0.5;
          html += sphere(gx, gy, 5.4, '#e7c64f', '#fff6d8');
        }
      }
    }

    root.innerHTML = `
      <radialGradient id="soilgrad" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#9c7a55"/><stop offset="100%" stop-color="#6f5234"/>
      </radialGradient>` + html;
  }

  // 小圆形（带高光）的水彩果/花苞
  function sphere(cx, cy, r, base, hl) {
    let s = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${base}" stroke="rgba(255,255,255,.6)" stroke-width="${(r * 0.22).toFixed(1)}"/>`;
    s += `<circle cx="${(cx - r * 0.3).toFixed(1)}" cy="${(cy - r * 0.3).toFixed(1)}" r="${(r * 0.28).toFixed(1)}" fill="${hl}" opacity=".9"/>`;
    return s;
  }

  // 一朵 5 瓣小花，带中心点；scale 随时间(hr)柔和放大
  function flowerHTMLAt(cx, cy, r, alpha, g) {
    const petals = 5;
    let out = `<g opacity="${alpha.toFixed(2)}">`;
    for (let i = 0; i < petals; i++) {
      const a = (i / petals) * Math.PI * 2 - Math.PI / 2;
      const px = cx + Math.cos(a) * r * 0.72;
      const py = cy + Math.sin(a) * r * 0.72;
      out += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${(r * 0.85).toFixed(1)}" fill="#f3cfc3" opacity=".8"/>`;
    }
    out += `<circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="#f7b98a"/>`;
    out += `</g>`;
    return out;
  }

  // 金果数判定：better 次数向下取整除以 7（每满 7 次结一颗）
  function betterCount() { return (state.hearts || []).length; }
  function goldFruitIntended() { return Math.floor(betterCount() / BETTER_NEED); }
  function trackGoldFlag() {
    // 在 better +1 后，若达到下一颗金果 → toast 甜蜜提示
    const before = state.goldFruits;
    const target = goldFruitIntended();
    if (target > 0 && target > before) {
      state.goldFruits = target;   // 记录叙事层达到的数量
      save();
      setTimeout(() => toast('树梢结出一颗金色的果实 ✨ 它为你高兴。'), 400);
    }
  }

  /* ---------------- 昼夜背景/粒子 ---------------- */
  function hourNow() { return new Date().getHours(); }
  function setTheme() {
    const h = hourNow();
    const b = document.body;
    if (h >= 6 && h < 17) b.className = 'theme-day';
    else if (h >= 17 && h < 19) b.className = 'theme-dusk';
    else b.className = 'theme-night';
    // 时段文案
    const w = $('timeOfDay');
    if (w) {
      if (h < 6) w.textContent = '夜深了，陪伴你的是一颗安静的树';
      else if (h < 12) w.textContent = '清晨的光透过叶隙，树醒了';
      else if (h < 14) w.textContent = '正午，树影正好歇脚';
      else if (h < 17) w.textContent = '午后，风轻轻摇着枝叶';
      else if (h < 19) w.textContent = '黄昏，天边染上温柔的颜色';
      else w.textContent = '夜晚，星星与树的低语';
    }
  }

  // 粒子：夜晚星星+萤火虫 / 白天光斑
  const particleCanvas = $('particles');
  let Pctx = null, particles = [], PRAF;

  function initParticles() {
    if (!particleCanvas) return;
    Pctx = particleCanvas.getContext('2d');
    resizeP();
    window.addEventListener('resize', resizeP);
    loopP();
  }
  function resizeP() {
    if (!Pctx) return;
    particleCanvas.width = innerWidth;
    particleCanvas.height = innerHeight;
  }
  function isNight() { const h = hourNow(); return h >= 19 || h < 6; }
  function loopP() {
    cancelAnimationFrame(PRAF);
    Pctx && Pctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
    if (isNight()) drawStarField(Pctx);
    PRAF = requestAnimationFrame(loopP);
  }
  function drawStarField(c) {
    const { width: w, height: h } = c.canvas;
    const ts = Date.now() / 1000;
    const n = 60;
    for (let i = 0; i < n; i++) {
      const x = (i * 97) % w;
      const y = (i * 41) % (h * 0.7);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(ts * 0.8 + i * 7));
      c.globalAlpha = tw * 0.9;
      c.fillStyle = '#f5f2d8';
      c.beginPath();
      c.arc(x, y, i % 5 === 0 ? 1.7 : 1.0, 0, Math.PI * 2);
      c.fill();
    }
    // 萤火虫（缓慢飘）
    const fm = 12;
    for (let i = 0; i < fm; i++) {
      const id = i * 53;
      const x = ((id * 0.37) % w) + Math.sin(ts * 0.3 + i) * 22;
      const y = (h * 0.35) + ((i * 67) % (h * 0.5)) + Math.cos(ts * 0.24 + i * 3) * 18;
      const a = 0.18 + 0.5 * Math.abs(Math.sin(ts * (0.7 + (i % 3) * 0.2) + i));
      c.globalAlpha = a;
      c.fillStyle = '#eaff9a';
      c.beginPath(); c.arc(x, y, 1.9, 0, Math.PI * 2); c.fill();
      c.globalAlpha = a * 0.4;
      c.beginPath(); c.arc(x, y, 4.2, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }

  /* ---------------- 声音（可选静音/软环境声） ---------------- */
  let audioCtx = null, noiseNodes = null, soundOn = false;
  function ensureAudio() {
    if (state.muted) return;
    if (audioCtx) { startNoise(); return; }
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch(e){ return; }
    audioCtx.resume && audioCtx.resume();
    startNoise();
  }
  function startNoise() {
    if (soundOn || !audioCtx) return;
    try {
      noiseNodes = {};
      const len = audioCtx.sampleRate * 2;
      const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // 柔和风声（低通噪声）
      const src = audioCtx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const lp = audioCtx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      const g = audioCtx.createGain(); g.gain.value = 0.05;
      src.connect(lp).connect(g).connect(audioCtx.destination);
      src.start();
      noiseNodes.src = src; noiseNodes.gain = g;
      soundOn = true;
    } catch (e) { soundOn = false; }
  }
  function stopNoise() {
    if (noiseNodes && noiseNodes.src) { try { noiseNodes.src.stop(); } catch(e){} noiseNodes = null; }
    soundOn = false;
  }
  function setMuted(m) {
    state.muted = m; save();
    if (m) { stopNoise(); audioCtx && audioCtx.suspend && audioCtx.suspend(); $('muteBtn').textContent = '🔇'; }
    else { ensureAudio(); $('muteBtn').textContent = '🔊'; }
  }

  /* ---------------- Toast（轻提示） ---------------- */
  let toastEl = null, toastTimers = [];
  function toast(msg) {
    let el = toastEl;
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
      toastEl = el;
    }
    el.textContent = msg;
    el.classList.add('show');
    toastTimers.forEach(clearTimeout);
    let tt = setTimeout(() => el.classList.remove('show'), 2600);
    toastTimers = [tt];
  }

  /* ---------------- 呼吸引导 ---------------- */
  let breathStop = false, breathTimers = [];
  function openBreath() {
    $('breathOverlay').hidden = false;
    const word = $('breathWord');
    const tip = $('breathTip');
    const ring = $('breathRing');
    tip.textContent = '跟着圈，慢慢吸气 4 秒，再缓缓呼出 6 秒。';
    let phase = 'inhale';
    ring.className = 'breath-ring inhale';
    word.textContent = '吸气';
    let done = false;
    const cycle = () => {
      if (breathStop || done) return;
      if (phase === 'inhale') {
        ring.className = 'breath-ring inhale';
        word.textContent = '吸气';
        let t = setTimeout(() => { phase = 'exhale'; cycle(); }, 4000);
        breathTimers.push(t);
      } else {
        ring.className = 'breath-ring exhale';
        word.textContent = '呼气';
        let t2 = setTimeout(() => { phase = 'inhale'; cycle(); }, 6000);
        breathTimers.push(t2);
      }
    };
    cycle();
    // 60 秒自动收起
    const endT = setTimeout(() => closeBreath(), 60000);
    breathTimers.push(endT);
  }
  function closeBreath() {
    breathStop = true;
    breathTimers.forEach(clearTimeout);
    breathTimers = [];
    $('breathOverlay').hidden = true;
    breathStop = false;
  }

  /* ---------------- 感受记录 ---------------- */
  function openFeel() {
    $('feelOverlay').hidden = false;
    // 今日是否已记过“比昨天好一点”
    renderMood();
  }
  function todayKey() { return new Date().toDateString(); }
  function lastBetterToday() {
    const tk = todayKey();
    return (state.hearts || []).some(t => new Date(t).toDateString() === tk);
  }
  function renderMood() {
    const bw = $('betterWrap');
    const note = $('goldNote');
    // 已记则不再出现不重复刷
    if (lastBetterToday()) { bw.hidden = true; }
    else { bw.hidden = false;
      const left = BETTER_NEED - (betterCount() % BETTER_NEED || BETTER_NEED);
      // 下次金果所需剩余
      const since = betterCount() % BETTER_NEED;
      note.textContent = since === 0 ? `再记录 7 次“比昨天好一点”，树会结金果` :
        `已攒 ${since}/7，再 ${BETTER_NEED - since} 次树梢会亮起金光`;
    }
  }
  function recordFeel(color, label) {
    state.feels = state.feels || [];
    if (state.feels.some(f => new Date(f.t).toDateString() === todayKey())) {
      // 当天已有感受：只更新不重复计数（避免刷叶）
      toast('今天已经记过了，树都记得。');
      return false;
    }
    state.feels.push({ t: Date.now(), color, label });
    save();
    refreshAll(); // 长出一片叶/小花，视觉轻变
    toast('记下了，树梢轻轻摇了摇。');
    return true;
  }
  function recordBetter() {
    if (lastBetterToday()) { toast('今天已记过“好一点”啦。'); return; }
    state.hearts = state.hearts || [];
    state.hearts.push(Date.now());
    save();
    trackGoldFlag();
    $('feelOverlay').hidden = true;
    refreshAll();
    toast('好，比昨天好一点，这就很好。');
  }

  /* ---------------- 低频“看见”陪伴 ---------------- */
  // 每隔一阵在树旁显示极轻的一行字，不打扰
  function gentleWhisper() {
    const totalBetter = betterCount();
    let text = '';
    if (state.lastWaterAt === 0 && state.hearts.length === 0 && state.growth < 0.01) {
      text = '树在等你，它没有怪你。';
    } else if (state.growth >= 1) {
      text = '树已成荫。谢谢你陪它这么久。';
    } else if (totalBetter >= BETTER_NEED) {
      text = '树梢的金果，是你一天天攒下的温柔。';
    } else text = '慢慢来，树会知道的。';
    const qn = $('quietNote');
    if (qn) { qn.textContent = text; qn.hidden = false; }
  }

  /* ---------------- 刷新 UI ---------------- */
  function refreshAll() {
    settleGrowth();           // 保证基于最新时间
    setTheme();
    renderTree(state.growth);
    waterBtnVisual();
    gentleWhisper();
    renderGoldCrownNote();
  }
  function renderGoldCrownNote() {
    // 若有金果叙事，在 greeting 下可增加一行小字（可选）
  }

  /* ---------------- 事件绑定 ---------------- */
  function bindEvents() {
    let waterFirstTap = false;
    $('waterBtn').addEventListener('click', () => {
      ensureAudio();          // 首次点击解锁音频（浏览器策略）
      water();
    });
    $('breathBtn').addEventListener('click', openBreath);
    $('feelBtn').addEventListener('click', openFeel);
    $('breathClose').addEventListener('click', closeBreath);
    $('feelClose').addEventListener('click', () => { $('feelOverlay').hidden = true; });
    $('muteBtn').addEventListener('click', () => {
      ensureAudio();
      setMuted(!state.muted);
    });
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
    [$('breathOverlay'), $('feelOverlay')].forEach(ov => {
      ov.addEventListener('click', (e) => { if (e.target === ov) ov.hidden = true; if (ov === $('breathOverlay')) closeBreath(); });
    });
    // 离开/隐藏自动保存
    document.addEventListener('visibilitychange', () => { if (document.hidden) { settleGrowth(); } else { refreshAll(); } });
  }

  /* ---------------- 启动 ---------------- */
  function start() {
    settleGrowth();     // 打开即结算（成长随真实时间）
    bindEvents();
    initParticles();
    setTheme();
    // 静音偏好恢复
    if (state.muted) $('muteBtn').textContent = '🔇';
    refreshAll();
    // 欢迎语
    const gr = $('greeting');
    const first = state.feels && state.feels.length === 0 && state.lastWaterAt === 0;
    gr.textContent = first ? '你来了。' : normalizeGreeting();
    // 低频自动保存
    setInterval(() => save(), 30000);
  }

  function normalizeGreeting() {
    // 根据时段打招呼，温和
    return '你来了。';
  }

  // 注入 toast 样式
  const _st = document.createElement('style');
  _st.textContent = `.toast{position:fixed;left:50%;bottom:110px;transform:translateX(-50%) translateY(20px);
    background:rgba(255,255,255,.92);color:var(--ink);padding:10px 18px;border-radius:999px;
    font-size:.85rem;box-shadow:0 8px 24px rgba(50,60,50,.18);opacity:0;transition:.35s ease;z-index:50;
    max-width:80vw;pointer-events:none}
    .toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
    body.watered .tree-svg{filter:drop-shadow(0 0 8px rgba(120,190,230,.35))} body .water-state{display:block}`;
  document.head.appendChild(_st);

  document.addEventListener('DOMContentLoaded', start);
})();
