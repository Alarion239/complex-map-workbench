'use strict';
// The sound board: the same demos drive A (the app's Sound, src/sound.js of v15) or B (SoundB, engine_b.js).
// Hooks mirror src/app.js: sndScrub (detents every 0.05 of t; landmarks forced), sndMorphStart / sndMorphArrive (once per
// play the user starts; loop repeats silent), the hover voice (gate, 1.6 s stillness fade, 6 s release), zero/pole
// order pings, turn bells while a loop is drawn (Sound.turns), the loop's winding on release.
(() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  let PAL = 'B', started = false, vol = 0.7;
  const pal = () => (PAL === 'A' ? Sound : SoundB);
  const play = (name, o = {}) => (started ? pal().play(name, o) : false);

  // ---------------------------------------------------------------- start (a gesture), palette, volume
  function start() {
    if (started) return; started = true;
    Sound.set({ on: true, vol, ui: true, snap: true, events: true, sonify: true }, { quiet: true });
    SoundB.set({ on: true, vol }); SoundB.ensure().then(() => { SoundB.setMode(bmode); status(); });
    status();
  }
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, start, { capture: true });
  function status() { $('status').textContent = !started ? 'Click anywhere to start sound.' : `Playing palette ${PAL}${PAL === 'B' && !SoundB.state().ready ? ' (loading…)' : ''}.`; }
  function setPal(p) {
    if (p === PAL) return; PAL = p; voiceOff(true);
    for (const b of document.querySelectorAll('.seg.pal button')) b.setAttribute('aria-pressed', String(b.dataset.p === p));
    document.body.classList.toggle('palA', p === 'A'); $('bmodeRow').style.opacity = p === 'B' ? 1 : 0.45;
    $('hint').textContent = p === 'A' ? 'Palette A: the sounds in the app today.' : 'Palette B: the new sounds. Each play is a little different.';
    status();
  }
  for (const b of document.querySelectorAll('.seg.pal button')) b.onclick = () => setPal(b.dataset.p);
  window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' && e.target.type === 'text') return; if (e.key === 'a' || e.key === 'A') setPal('A'); if (e.key === 'b' || e.key === 'B') setPal('B'); });
  $('vol').oninput = (e) => { vol = +e.target.value / 100; Sound.set({ vol }); SoundB.set({ vol }); };
  const segPick = (seg, btn) => { for (const b of seg.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === btn)); };

  // ---------------------------------------------------------------- 1. the deformation
  const cv = $('morphCv'), cx = cv.getContext('2d'), sl = $('tslider');
  let T = 0, playing = null, auto = null, bmode = 'B';
  function drawMorph() {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0); cx.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement), fg = css.getPropertyValue('--fg').trim(), mut = css.getPropertyValue('--mut').trim(), acc = css.getPropertyValue(PAL === 'A' ? '--a' : '--b').trim();
    const s = Math.min(w / 4.6, h / 4.2), ox = w / 2, oy = h / 2;
    const H = (x, y) => { const a = 1 - T; return [a * x + T * (x * x - y * y), a * y + T * 2 * x * y]; };   // H_t = (1 − t) z + t z²
    cx.lineWidth = 1;
    for (let k = -8; k <= 8; k++) for (const vert of [0, 1]) {
      cx.beginPath(); const c = k / 8;
      for (let j = 0; j <= 48; j++) { const u = -1 + 2 * j / 48, [X, Y] = vert ? H(c, u) : H(u, c); const px = ox + s * X, py = oy - s * Y; j ? cx.lineTo(px, py) : cx.moveTo(px, py); }
      cx.strokeStyle = k === 0 ? acc : mut; cx.globalAlpha = k === 0 ? 0.9 : 0.35; cx.stroke();
    }
    cx.globalAlpha = 1; cx.fillStyle = fg; cx.font = '12px ui-monospace, Menlo, monospace'; cx.fillText(`H_t(z) = (1 − t)·z + t·z²    t = ${T.toFixed(2)}`, 10, 18);
    $('tval').textContent = T.toFixed(2);
  }
  // the app's slider handler (src/app.js: snap within 0.03 of an integer; sndScrub(T0, T1) then T = v)
  function scrubTo(v) {
    const r = Math.round(v); if (Math.abs(v - r) < 0.03) v = r;
    if (started) {
      if (PAL === 'A') { const d0 = Math.round(T * 20), d1 = Math.round(v * 20); if (d1 !== d0) Sound.play('morphTick', { t: d1 / 20, force: d1 % 5 === 0 }); }
      else SoundB.scrub(T, v);
    }
    T = v; sl.value = String(v); drawMorph();
  }
  const scrubEnd = () => { if (started && PAL === 'B') SoundB.scrubEnd(); };
  sl.addEventListener('input', () => { stopPlay(); stopAuto(); scrubTo(+sl.value); });
  sl.addEventListener('change', scrubEnd); sl.addEventListener('pointerup', scrubEnd);
  // drag for me: 0 → 1 → 0 on a cosine (the recorded drags of listen.html), or a wiggle around ½, at the display's rate
  function stopAuto() { if (auto) { cancelAnimationFrame(auto.raf); auto = null; scrubEnd(); } }
  for (const b of document.querySelectorAll('[data-auto]')) b.onclick = () => {
    stopPlay(); stopAuto(); const k = b.dataset.auto, P = k === 'wiggle' ? 3 : 2 * +k, t0 = performance.now();
    if (k !== 'wiggle') scrubTo(0);
    const step = () => {
      const u = (performance.now() - t0) / 1000; if (u > P) { scrubTo(k === 'wiggle' ? T : 0); auto = null; scrubEnd(); return; }
      const v = k === 'wiggle' ? 0.5 + 0.13 * Math.sin(2 * Math.PI * 1.3 * u) * Math.min(1, u / 0.3) : (() => { const x = u <= +k ? u / +k : 2 - u / +k; return 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1)); })();
      scrubTo(v); auto.raf = requestAnimationFrame(step);
    };
    auto = { raf: requestAnimationFrame(step) };
  };
  for (const b of document.querySelectorAll('#bmodeSeg button')) b.onclick = () => { bmode = b.dataset.m; segPick($('bmodeSeg'), b); SoundB.setMode(bmode); };
  let dur = 2;
  for (const b of document.querySelectorAll('#durSeg button')) b.onclick = () => { dur = +b.dataset.d; segPick($('durSeg'), b); };
  // play: the swell once per play the user starts, the motion bed (B) on the first pass, the arrival once; loop repeats
  // are silent (the app's rule)
  function stopPlay() {
    if (!playing) return; cancelAnimationFrame(playing.raf);
    if (playing.first && PAL === 'B' && started) SoundB.motionEnd();
    playing = null; $('playBtn').textContent = '▶ Play';
  }
  $('playBtn').onclick = () => {
    if (playing) { stopPlay(); return; }
    stopAuto(); if (T >= 1) { T = 0; sl.value = '0'; }
    const p = playing = { first: true, t0: performance.now(), T0: T, rate: 1 / dur, pal: PAL };
    $('playBtn').textContent = '❚❚ Pause';
    play('morphStart', {});
    const step = () => {
      if (playing !== p) return;
      const u = (performance.now() - p.t0) / 1000; T = Math.min(1, p.T0 + u * p.rate); sl.value = String(T);
      if (p.first && p.pal === 'B' && started) SoundB.motion(T, p.rate);
      drawMorph();
      if (T >= 1) {
        if (p.first) { if (p.pal === 'B' && started) SoundB.motionEnd(); play('morphEnd', { vel: clamp(0.6 * Math.sqrt(2 * p.rate), 0.35, 0.9) }); p.first = false; }
        if ($('loopChk').checked) { p.t0 = performance.now() + 400; p.T0 = 0; T = 0; }
        else { stopPlay(); return; }
      }
      p.raf = requestAnimationFrame(step);
    };
    p.raf = requestAnimationFrame(step);
  };

  // ---------------------------------------------------------------- 2. hear the function
  const pc = $('planeCv'), px = pc.getContext('2d');
  const C = (re, im) => ({ re, im });
  const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re), div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const FNS = {
    sq: { F: (z) => mul(z, z), view: 1.6, zeros: [[C(0, 0), 2]], poles: [], name: 'F(z) = z²' },
    exp: { F: (z) => { const e = Math.exp(z.re); return C(e * Math.cos(z.im), e * Math.sin(z.im)); }, view: 3.2, zeros: [], poles: [], name: 'F(z) = eᶻ (arg F = Im z: move up and down)' },
    rat: { F: (z) => { const a = C(z.re - 1, z.im), b = C(z.re + 1, z.im), num = mul(a, mul(b, b)), den = C(z.re * z.re - z.im * z.im + 1, 2 * z.re * z.im); return div(num, den); }, view: 1.8, zeros: [[C(1, 0), 1], [C(-1, 0), 2]], poles: [[C(0, 1), 1], [C(0, -1), 1]], name: 'F(z) = (z − 1)(z + 1)² / (z² + 1)' },
  };
  let FN = FNS.sq, img = null;
  const toZ = (x, y) => { const w = pc.clientWidth, s = 2 * FN.view / w; return C((x - w / 2) * s, -(y - w / 2) * s); };
  const toPx = (z) => { const w = pc.clientWidth, s = w / (2 * FN.view); return [w / 2 + z.re * s, w / 2 - z.im * s]; };
  function paintPlane() {
    const W = pc.width, H = pc.height, id = px.createImageData(W, H), d = id.data, v = FN.view;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const z = C((i / W * 2 - 1) * v, (1 - j / H * 2) * v), f = FN.F(z), a = Math.atan2(f.im, f.re) / (2 * Math.PI), m = Math.log2(Math.hypot(f.re, f.im));
      const hue = (a + 1) % 1, band = Number.isFinite(m) ? m - Math.floor(m) : 0, L = 0.42 + 0.16 * band, S = 0.55;
      // HSL → RGB
      const q = L < 0.5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q, h2 = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 0.5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
      const o = 4 * (j * W + i); d[o] = 255 * h2(hue + 1 / 3); d[o + 1] = 255 * h2(hue); d[o + 2] = 255 * h2(hue - 1 / 3); d[o + 3] = 255;
    }
    img = id; drawPlane();
  }
  let loopPts = null;
  function drawPlane() {
    if (!img) return; px.setTransform(1, 0, 0, 1, 0, 0); px.putImageData(img, 0, 0);
    const k = pc.width / pc.clientWidth; px.setTransform(k, 0, 0, k, 0, 0);
    const dot = (z, fill) => { const [x, y] = toPx(z); px.beginPath(); px.arc(x, y, 5, 0, 2 * Math.PI); px.fillStyle = fill; px.fill(); px.lineWidth = 1.5; px.strokeStyle = fill === '#fff' ? '#000' : '#fff'; px.stroke(); };
    for (const [z] of FN.zeros) dot(z, '#fff'); for (const [z] of FN.poles) dot(z, '#000');
    if (loopPts && loopPts.length > 1) { px.beginPath(); loopPts.forEach((z, i) => { const [x, y] = toPx(z); i ? px.lineTo(x, y) : px.moveTo(x, y); }); px.strokeStyle = '#fff'; px.lineWidth = 2; px.stroke(); }
  }
  for (const b of document.querySelectorAll('#fnSeg button')) b.onclick = () => { FN = FNS[b.dataset.f]; segPick($('fnSeg'), b); voiceOff(false); paintPlane(); readout(); };
  // the probe: arg F unwrapped along the pointer's path (sub-steps so that no step turns more than a fraction of a turn)
  const argT = (z) => { const f = FN.F(z); return Math.atan2(f.im, f.re) / (2 * Math.PI); };
  const lnAbs = (z) => { const f = FN.F(z); return Math.log(Math.hypot(f.re, f.im)); };
  function dArg(z0, z1) {
    const n = clamp(Math.ceil(Math.hypot(z1.re - z0.re, z1.im - z0.im) / (FN.view / 60)), 1, 256); let s = 0, a0 = argT(z0);
    for (let i = 1; i <= n; i++) { const u = i / n, a1 = argT(C(z0.re + (z1.re - z0.re) * u, z0.im + (z1.im - z0.im) * u)); let d = a1 - a0; d -= Math.round(d); if (Number.isFinite(d)) s += d; a0 = a1; }
    return s;
  }
  const P = { voice: null, vpal: null, last: null, phi: 0, idle: 0, sleep: 0, near: new Map(), loop: null, lastT: 0, speed: 0, W: null };
  function voiceOff(release) {
    clearTimeout(P.idle);
    if (P.voice) { if (release) { P.voice.stop(); P.voice = null; } else { P.voice.gate(false); clearTimeout(P.sleep); P.sleep = setTimeout(() => { if (P.voice && !P.loop) { P.voice.stop(); P.voice = null; } }, 6000); } }
    P.last = null;
  }
  function readout() {
    const z = P.last; let t = FN.name + '\n';
    if (z) { const f = FN.F(z); t += `z = ${z.re.toFixed(2)} ${z.im < 0 ? '−' : '+'} ${Math.abs(z.im).toFixed(2)}i\narg F = ${(((P.phi % 1) + 1) % 1).toFixed(3)} turn   |F| = ${Math.hypot(f.re, f.im).toPrecision(3)}\n`; }
    if (P.loop) t += `drawing a loop: ${P.loop.phi.toFixed(2)} turns so far\n`; else if (P.W != null) t += `last loop: winding number ${P.W}\n`;
    $('readout').textContent = t;
  }
  function hover(x, y, src) {
    const z = toZ(x, y), now = performance.now();
    if (P.last) { const dpx = Math.hypot(...toPx(z).map((v, i) => v - toPx(P.last)[i])); P.speed = 0.7 * P.speed + 0.3 * dpx / Math.max(4, now - P.lastT); }
    P.lastT = now;
    const pan = clamp(0.4 * (x - pc.clientWidth / 2) / (pc.clientWidth / 2), -0.4, 0.4);
    if (P.last) { const d = dArg(P.last, z); P.phi += d; if (P.loop) { P.loop.phi += d; Sound.turns(P.loop, (dir) => { if (started) pal().turn({ dir, pc: P.loop.pc0, pan }); }); P.loop.pts.push(z); loopPts = P.loop.pts; drawPlane(); } }
    else P.phi = argT(z);
    P.last = z;
    if (!started || !$('sonChk').checked) { readout(); return; }
    if (!P.voice || P.vpal !== PAL) { if (P.voice) P.voice.stop(); P.voice = pal().voice(); P.vpal = PAL; }
    if (P.voice) { P.voice.set(P.phi, lnAbs(z), pan); P.voice.gate(true); }
    // zeros and poles within 9 px ring their order (re-armed beyond 16 px)
    for (const [list, name] of [[FN.zeros, 'zero'], [FN.poles, 'pole']]) for (const [zz, m] of list) {
      const [a, b] = toPx(zz), dd = Math.hypot(a - x, b - y), key = name + zz.re + ',' + zz.im;
      if (dd < 9 && !P.near.get(key)) { P.near.set(key, true); pal().play(name, { order: m, pan, vel: clamp(0.35 + 0.35 * Math.log2(1 + P.speed), 0.35, 0.95) }); }
      else if (dd > 16) P.near.delete(key);
    }
    clearTimeout(P.idle); P.idle = setTimeout(() => { if (P.voice && !P.loop) P.voice.gate(false, undefined, 0.35); }, 1600);
    clearTimeout(P.sleep); P.sleep = setTimeout(() => { if (P.voice && !P.loop) { P.voice.stop(); P.voice = null; } }, 6000);
    readout();
  }
  const rel = (e) => { const b = pc.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  pc.addEventListener('pointermove', (e) => { const [x, y] = rel(e); hover(x, y, P.loop ? 'loop' : 'pointer'); });
  pc.addEventListener('pointerleave', () => { if (!P.loop) { voiceOff(false); readout(); } });
  pc.addEventListener('pointerdown', (e) => {
    pc.setPointerCapture(e.pointerId); const [x, y] = rel(e); hover(x, y, 'pointer');
    P.loop = { phi: 0, k: 0, pc0: P.phi - Math.floor(P.phi), pts: [P.last] }; loopPts = P.loop.pts; drawPlane();
  });
  pc.addEventListener('pointerup', (e) => {
    if (!P.loop) return; const L = P.loop; P.loop = null;
    if (L.pts.length > 8) {
      // the winding number of the closed loop: the arg increments around it, closed back to its start
      let s = 0; for (let i = 1; i < L.pts.length; i++) s += dArg(L.pts[i - 1], L.pts[i]); s += dArg(L.pts[L.pts.length - 1], L.pts[0]);
      P.W = Math.round(s); if (started) pal().play('loopDone', { w: P.W });
    }
    setTimeout(() => { loopPts = null; drawPlane(); }, 900); readout();
  });
  $('sonChk').onchange = (e) => { if (started) { Sound.set({ sonify: e.target.checked }); SoundB.set({ sonify: e.target.checked }); play(e.target.checked ? 'toggleOn' : 'toggleOff'); } if (!e.target.checked) voiceOff(true); };

  // ---------------------------------------------------------------- 3. interface
  for (const t of document.querySelectorAll('.tg')) t.onchange = () => play(t.checked ? 'toggleOn' : 'toggleOff');
  const chips = $('chips'), STEPS = ['z²', 'z + 1', '1/z', 'eᶻ', 'sin z', '√z', 'z³ − 1'];
  let nStep = 0;
  function addChip(silent) {
    const c = document.createElement('span'); c.className = 'chip'; c.innerHTML = `<span>${STEPS[nStep++ % STEPS.length]}</span><button aria-label="Remove step">×</button>`;
    c.querySelector('button').onclick = () => { c.remove(); play('stepRemove'); };
    chips.appendChild(c); if (!silent) play('stepAdd');
  }
  addChip(true); addChip(true);
  $('addStep').onclick = () => addChip(false);
  for (const b of document.querySelectorAll('#viewSeg button')) b.onclick = () => { segPick($('viewSeg'), b); play('view', { k: +b.dataset.k }); };
  $('apply').onclick = () => {
    const s = $('fx').value.trim(); let depth = 0, ok = s.length > 0 && !/[+\-*/^(]$/.test(s);
    for (const ch of s) { if (ch === '(') depth++; if (ch === ')') depth--; if (depth < 0) ok = false; }
    if (depth) ok = false;
    const m = $('fxMsg'); if (ok) { m.textContent = 'Applied.'; m.className = 'msg'; } else { m.textContent = 'Cannot read this formula (try deleting the last character).'; m.className = 'msg err'; play('error'); }
  };
  $('fx').onkeydown = (e) => { if (e.key === 'Enter') $('apply').click(); };
  $('exportBtn').onclick = () => { $('exMsg').textContent = 'Rendering…'; setTimeout(() => { $('exMsg').textContent = 'Saved figure.png'; play('exportDone'); }, 450); };
  $('edgeBtn').onclick = () => play('edge', { pan: 0.4 });
  $('snapBtn').onclick = () => play('snap');

  // ---------------------------------------------------------------- 4. every cue
  const CUES = [
    ['toggleOn', {}, 'Toggle on'], ['toggleOff', {}, 'Toggle off'], ['stepAdd', {}, 'Add a step'], ['stepRemove', {}, 'Remove a step'], ['view', { k: 1 }, 'Switch view'],
    ['exportDone', {}, 'Export ready'], ['error', {}, 'Error'], ['edge', {}, 'Edge (keyboard probe)'], ['snap', {}, 'Snap (own switch, off by default)'],
    ['morphStart', {}, 'Deformation plays'], ['morphTick', { t: 0.5, force: true }, 'Slider: A detent at t = ½ / B landmark note'], ['morphEnd', {}, 'Deformation arrives'],
    ['loopDone', { w: 2 }, 'Loop closed, W = 2'], ['loopDone', { w: -3 }, 'Loop closed, W = −3'], ['loopDone', { w: 0 }, 'Loop closed, W = 0'],
    ['zero', { order: 1 }, 'Zero'], ['zero', { order: 2 }, 'Zero of order 2'], ['pole', { order: 1 }, 'Pole'], ['dense', {}, 'Many zeros or poles'],
    ['cut', {}, 'Branch cut'], ['turn', { pc: 0, dir: 1 }, 'One full turn (bell)'], ['turnMany', { dir: 1 }, 'Many turns'], ['contour', { k: 0 }, 'Contour (Height)'], ['collide', {}, 'Preimages collide'],
  ];
  const bName = (n) => (n === 'morphTick' ? 'landmark' : n), bOpts = (n, o) => (n === 'morphTick' ? { q: 2, vel: 0.5, force: true } : o);
  const cueA = (n, o) => { if (!started) return; Sound.play(n, Object.assign({ force: true, audition: true }, o)); };
  const cueB = (n, o) => { if (!started) return; SoundB.play(bName(n), Object.assign({ force: true, audition: true }, bOpts(n, o))); };
  const tb = document.querySelector('#cues tbody');
  for (const [n, o, label] of CUES) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td><td class="w">${Sound.CATALOG[n].what}</td><td class="btns"><button class="pa">A</button> <button class="pa">×4</button></td><td class="btns"><button class="pb">B</button> <button class="pb">×4</button></td>`;
    const [a1, a4, b1, b4] = tr.querySelectorAll('button');
    a1.onclick = () => cueA(n, o); b1.onclick = () => cueB(n, o);
    a4.onclick = () => { for (let i = 0; i < 4; i++) setTimeout(() => cueA(n, o), 700 * i); };
    b4.onclick = () => { for (let i = 0; i < 4; i++) setTimeout(() => cueB(n, o), 700 * i); };
    tb.appendChild(tr);
  }

  // ---------------------------------------------------------------- init
  const ro = new ResizeObserver(() => { drawMorph(); const w = Math.round(pc.clientWidth * (window.devicePixelRatio || 1)); if (w && Math.abs(pc.width - w) > 2) { pc.width = pc.height = Math.min(900, w); paintPlane(); } else drawPlane(); });
  ro.observe(cv); ro.observe(pc);
  drawMorph(); paintPlane(); readout(); setPal('A'); setPal('B');
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', drawMorph);
  // (tests) the same entry points the controls use
  window.__board = { setPal, scrubTo, scrubEnd, hover, start, play, FNS, setFn: (k) => document.querySelector(`#fnSeg button[data-f="${k}"]`).click(), state: () => ({ PAL, T, started, b: SoundB.state(), a: Sound.state() }), P };
})();
