'use strict';
// hearf/options.html: the page. The phase portrait (the app's OKLCH wheel, h = 29° + arg F, computed per pixel on the
// CPU), the pointer, the scripted gestures, the option switch, and the audio graph: one "hf-engine" node and, for option
// 1, two timbres.js voices (the voice and the drone). No AudioParam automation: every level lives in the worklets.
(() => {
  const C = HFCore, TAU = Math.PI * 2, clamp = C.clamp;
  const $ = (s) => document.querySelector(s);
  const store = { get(k, d) { try { const v = localStorage.getItem('hearf.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('hearf.' + k, JSON.stringify(v)); } catch (e) { /* none */ } } };
  const S = {
    fn: C.byId[store.get('fn', 'z2m1')] || C.FUNCS[0],
    opt: store.get('opt', 'sung'),
    set: Object.assign({ kind: 'cello', drone: true, mat: 'string', colour: 'rich' }, store.get('set', {})),
    volDb: store.get('vol', 0),
  };
  if (!C.OPTIONS.some((o) => o.id === S.opt)) S.opt = 'sung';

  // ------------------------------------------------------------------ the portrait
  // the app's phase wheel (src/gl.js lutBytes): oklch(L, min(0.13, 0.97 Cmax(L, h)), h), h = 29° + arg
  const LUT_W = 256, LUT_H = 24;
  function oklabLin(L, a, b) { const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b; const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s]; }
  const enc1 = (x) => { x = clamp(x, 0, 1); return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };
  const inG = (c) => c.every((v) => v >= -1e-7 && v <= 1 + 1e-7);
  function cmax(L, h) { const ca = Math.cos(h), sa = Math.sin(h); let lo = 0, hi = 0.37; for (let i = 0; i < 22; i++) { const m = 0.5 * (lo + hi); if (inG(oklabLin(L, m * ca, m * sa))) lo = m; else hi = m; } return lo; }
  const LUT = new Uint8ClampedArray(LUT_W * LUT_H * 3), L0 = 0.42, L1 = 0.88;
  for (let j = 0; j < LUT_H; j++) { const L = L0 + (L1 - L0) * j / (LUT_H - 1);
    for (let i = 0; i < LUT_W; i++) { const h = 29 * Math.PI / 180 + TAU * (i + 0.5) / LUT_W, Cc = Math.min(0.13, 0.97 * cmax(L, h)), c = oklabLin(L, Cc * Math.cos(h), Cc * Math.sin(h)), o = 3 * (j * LUT_W + i);
      LUT[o] = enc1(c[0]) * 255; LUT[o + 1] = enc1(c[1]) * 255; LUT[o + 2] = enc1(c[2]) * 255; } }
  const pc = $('#pc'), ov = $('#ov'), box = $('#portrait'), pctx = pc.getContext('2d'), octx = ov.getContext('2d');
  const small = document.createElement('canvas'), sctx = small.getContext('2d');
  let css = 0, dpr = 1, grid = null, gridS = null;
  const ppu = () => css / (2 * S.fn.view[2]);
  const toPx = (x, y) => { const [cx, cy, hw] = S.fn.view; return [(x - cx + hw) / (2 * hw) * css, (cy + hw - y) / (2 * hw) * css]; };
  const toZ = (px, py) => { const [cx, cy, hw] = S.fn.view; return [cx - hw + 2 * hw * px / css, cy + hw - 2 * hw * py / css]; };
  // F on the pixel grid (once per function and size), so the deformation only mixes z and F per frame
  function makeGrid(N) {
    const [cx, cy, hw] = S.fn.view, zx = new Float32Array(N * N), zy = new Float32Array(N * N), fr = new Float32Array(N * N), fi = new Float32Array(N * N), o = [0, 0];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * N + i, x = cx - hw + 2 * hw * (i + 0.5) / N, y = cy + hw - 2 * hw * (j + 0.5) / N; zx[k] = x; zy[k] = y; S.fn.f(x, y, o); fr[k] = o[0]; fi[k] = o[1]; }
    return { N, zx, zy, fr, fi, img: new ImageData(N, N), A: new Float32Array(N * N), M: new Float32Array(N * N) };
  }
  // enhanced phase portrait: hue = arg, lightness stepped by 12 phase sectors and 12 modulus rings per e^{2π} (the app's
  // tiles); the harp's five strings (option 2) as light anti-aliased lines
  function paint(G, t) {
    const { N, zx, zy, fr, fi, img, A, M } = G, d = img.data, harp = S.opt === 'harp', dark = matchMedia('(prefers-color-scheme: dark)').matches;
    const s = t == null ? 1 : t, u = 1 - s, base = dark ? 0.6 : 0.68;
    for (let k = 0; k < N * N; k++) { const re = u * zx[k] + s * fr[k], im = u * zy[k] + s * fi[k]; A[k] = Math.atan2(im, re) / TAU * 12; M[k] = 0.5 * Math.log(re * re + im * im) / TAU * 12; }
    const HL = [0, 2, 4, 7, 9];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, a = A[k], m = M[k];
      if (!Number.isFinite(a) || !Number.isFinite(m)) { const o = 4 * k; d[o] = d[o + 1] = d[o + 2] = m > 0 ? 250 : 20; d[o + 3] = 255; continue; }
      const fa = a - Math.floor(a), fm = m - Math.floor(m);
      let L = base + 0.075 * (fa - 0.5) + 0.075 * (fm - 0.5);
      const hu = (((a / 12) % 1) + 1) % 1, li = clamp((L - L0) / (L1 - L0) * (LUT_H - 1), 0, LUT_H - 1);
      const ii = Math.min(LUT_W - 1, (hu * LUT_W) | 0), jj = Math.round(li), o = 3 * (jj * LUT_W + ii), q = 4 * k;
      let r = LUT[o], g = LUT[o + 1], b = LUT[o + 2];
      if (harp) {
        // distance to the nearest string (sector lines 0, 2, 4, 7, 9 of 12) in pixels, from the local gradient
        const an = i + 1 < N ? A[k + 1] : A[k - 1], am = j + 1 < N ? A[k + N] : A[k - N];
        const gx = an - a - 12 * Math.round((an - a) / 12), gy = am - a - 12 * Math.round((am - a) / 12), gr = Math.hypot(gx, gy) + 1e-9;
        const w = ((a % 12) + 12) % 12; let dm = 99; for (const h of HL) { let dd = Math.abs(w - h); dd = Math.min(dd, 12 - dd); if (dd < dm) dm = dd; }
        const cov = clamp(1.1 - dm / gr / (G.N > css ? 1.4 : 0.8), 0, 1) * (Math.abs(w) < 0.5 || Math.abs(w - 12) < 0.5 ? 1 : 0.8);
        if (cov > 0) { r += (255 - r) * cov * 0.85; g += (255 - g) * cov * 0.85; b += (255 - b) * cov * 0.85; }
      }
      d[q] = r; d[q + 1] = g; d[q + 2] = b; d[q + 3] = 255;
    }
    return img;
  }
  let lastT = undefined;
  function renderPortrait(t, quick) {
    if (!css) return;
    if (quick) {
      if (!gridS) gridS = makeGrid(Math.round(css / 1.5));   // the deformation's frames: 2.25× fewer pixels than CSS, bilinear up
      small.width = small.height = gridS.N; sctx.putImageData(paint(gridS, t), 0, 0);
      pctx.imageSmoothingEnabled = true; pctx.drawImage(small, 0, 0, pc.width, pc.height);
    } else {
      if (!grid) grid = makeGrid(pc.width);
      pctx.putImageData(paint(grid, t), 0, 0);
    }
    lastT = t;
  }
  function resize() {
    const r = box.getBoundingClientRect(); css = Math.round(r.width); dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(css * dpr); pc.width = pc.height = W; ov.width = ov.height = W; grid = gridS = null;
    renderPortrait(null, false); drawOverlay();
  }

  // ------------------------------------------------------------------ the overlay
  const OV = { pointer: null, path: null, ring: null, loop: null, stroke: null, grow: null };
  function drawOverlay() {
    const c = octx; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, css, css);
    const dark = matchMedia('(prefers-color-scheme: dark)').matches;
    // the gesture's path, faint and dashed
    if (OV.path) { c.save(); c.setLineDash([4, 5]); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.75)'; c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 2; c.beginPath(); OV.path.forEach(([x, y], i) => { const [px, py] = toPx(x, y); i ? c.lineTo(px, py) : c.moveTo(px, py); }); c.stroke(); c.restore(); }
    // zeros and poles (static; during the deformation the zeros move, so they are hidden)
    if (lastT == null) {
      for (const [x, y, m] of S.fn.zeros) { const [px, py] = toPx(x, y); c.beginPath(); c.arc(px, py, 5.5, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#1b1b1b'; c.stroke(); if (m !== 1) { const lb = m === 0.5 ? '½' : String(m); c.font = '600 11px system-ui'; c.fillStyle = '#fff'; c.strokeStyle = 'rgba(0,0,0,.65)'; c.lineWidth = 3; c.strokeText(lb, px + 7, py - 6); c.fillText(lb, px + 7, py - 6); } }
      for (const [x, y] of S.fn.poles) { const [px, py] = toPx(x, y); c.beginPath(); c.arc(px, py, 5.5, 0, TAU); c.fillStyle = '#1b1b1b'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke(); }
    }
    const ink = 'rgba(255,255,255,.95)', shade = 'rgba(0,0,0,.55)';
    const curve = (pts, w, closed) => { if (!pts || pts.length < 2) return; c.save(); c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); pts.forEach(([x, y], i) => { const [px, py] = toPx(x, y); i ? c.lineTo(px, py) : c.moveTo(px, py); }); if (closed) c.closePath();
      c.strokeStyle = shade; c.lineWidth = w + 2; c.stroke(); c.strokeStyle = ink; c.lineWidth = w; c.stroke(); c.restore(); };
    if (OV.loop) curve(C.circlePts(OV.loop, 96), 2, true);
    if (OV.grow) curve(C.circlePts(OV.grow, 128), 2, true);
    if (OV.stroke) { curve(OV.stroke, 2.2, false); if (OV.stroke.length > 2) { c.save(); c.setLineDash([2, 4]); curve([OV.stroke[OV.stroke.length - 1], OV.stroke[0]], 1, false); c.restore(); } }
    if (OV.ring) { const [px, py] = toPx(OV.ring[0], OV.ring[1]); c.beginPath(); c.arc(px, py, 20, 0, TAU); c.lineWidth = 1; c.strokeStyle = dark ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.7)'; c.stroke(); }
    if (OV.pointer) { const [px, py] = toPx(OV.pointer[0], OV.pointer[1]); c.beginPath(); c.arc(px, py, 5, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 2; c.strokeStyle = '#111'; c.stroke(); }
  }

  // ------------------------------------------------------------------ audio
  let ctx = null, eng = null, voice = null, drone = null, voiceKind = null, ready = null;
  const LEAD = 0.035;
  let anchor = null;   // the context clock, estimated smoothly from performance.now()
  function clock() {
    const now = performance.now();
    if (!anchor || Math.abs(ctx.currentTime - (anchor.ct + (now - anchor.pn) / 1000)) > 0.03) anchor = { ct: ctx.currentTime, pn: now };
    return anchor.ct + (now - anchor.pn) / 1000 + LEAD;
  }
  function ensureAudio() {
    if (ready) return ready;
    ready = (async () => {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error('no Web Audio');
      // iOS: play as media, so the ring/silent switch does not mute the page (snd-4)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
      ctx = new AC({ latencyHint: 'interactive' });
      const src = '(' + HF_WORKLET.toString() + ')();';
      let ok = false;
      for (const u of [URL.createObjectURL(new Blob([src], { type: 'text/javascript' })), 'data:text/javascript;charset=utf-8,' + encodeURIComponent(src)]) { try { await ctx.audioWorklet.addModule(u); ok = true; break; } catch (e) { /* next */ } }
      if (!ok || !(await Timbres.load(ctx))) throw new Error('AudioWorklet unavailable');
      eng = new AudioWorkletNode(ctx, 'hf-engine', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { vol: dbLin(S.volDb), seed: (Math.random() * 1e9) | 0 } });
      eng.connect(ctx.destination);
      if (ctx.state !== 'running') await ctx.resume();
      return true;
    })();
    return ready;
  }
  const dbLin = (db) => Math.pow(10, db / 20);
  // timbres.js voices for option 1 (made when the option or the instrument changes; the old ones fade, then go)
  function timbreVoices() {
    if (voice && voiceKind === S.set.kind) return;
    const old = [voice, drone].filter(Boolean);
    for (const n of old) { n.port.postMessage([{ at: 0, gate: 0, tau: 0.02 }]); setTimeout(() => { try { n.disconnect(); } catch (e) { /* gone */ } }, 400); }
    const mk = (seed) => { const n = new AudioWorkletNode(ctx, 'cmw-timbre', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { kind: S.set.kind, seed } }); n.connect(ctx.destination); return n; };
    voice = mk(7); drone = mk(9); voiceKind = S.set.kind;
  }
  // per-frame command batches
  const Q = { eng: [], voice: [], drone: [] };
  const sinks = { eng: (c) => Q.eng.push(c), voice: (c) => Q.voice.push(c), drone: (c) => Q.drone.push(c) };
  function flush() {
    if (eng && Q.eng.length) eng.port.postMessage(Q.eng.splice(0)); else Q.eng.length = 0;
    if (voice && Q.voice.length) voice.port.postMessage(Q.voice.splice(0)); else Q.voice.length = 0;
    if (drone && Q.drone.length) drone.port.postMessage(Q.drone.splice(0)); else Q.drone.length = 0;
  }

  // ------------------------------------------------------------------ sessions: a gesture or the hand
  let ses = null, run = null, live = null, raf = 0, tailUntil = 0;
  const meter = { ctlMs: 0, paintMs: 0, frames: 0 };   // (measured by the test harness)
  window.__hf = { meter, S, get ctx() { return ctx; }, play: (k) => playGesture(k), setOpt: (o) => selectOpt(o), setFn: (id) => selectFn(id) };
  function newSession() { const s = new C.Session(sinks, S.opt, S.set); s.vol = S.opt === 'sung' ? dbLin(S.volDb) : 1; return s; }
  function stopAll(fast = true) {
    if (ses && ctx) { const T = clock(); fast ? ses.stop(T) : ses.end(T); flush(); }
    ses = null; run = null; live = null; OV.path = OV.ring = OV.loop = OV.stroke = OV.grow = OV.pointer = null;
    for (const b of document.querySelectorAll('.gest')) b.setAttribute('aria-pressed', 'false');
    if (lastT != null) renderPortrait(null, false);
    drawOverlay();
  }
  async function playGesture(kind) {
    const g = C.gesture(S.fn, kind); if (!g) return;
    try { await ensureAudio(); } catch (e) { $('#gcap').textContent = 'Sound is not available here: ' + e.message; return; }
    setSoundUi(true);
    stopAll(true);
    if (S.opt === 'sung') timbreVoices();
    ses = newSession();
    ses.start(clock(), S.fn, g);
    run = { g, p0: performance.now() + 350, ended: false };
    // the path to show
    if (kind === 'deform') { OV.path = null; OV.loop = S.opt === 'curve' ? g.loop : null; }
    else if (kind === 'view') OV.path = null;
    else { const pts = []; for (let k = 0; k <= 160; k++) { const p = g.at(g.dur * k / 160); pts.push([p.x, p.y]); } OV.path = pts; }
    document.querySelector('.gest[data-k="' + kind + '"]').setAttribute('aria-pressed', 'true');
    $('#gcap').textContent = cap(g.caption) + '.';
    $('#what').innerHTML = '<b>Listen for:</b> ' + esc(C.listenFor(S.opt, S.fn, kind) || '');
    $('#hint').style.opacity = 0;
    loop();
  }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function frameAt(pos) {
    const t0 = performance.now();
    const fr = ses.frame(clock(), pos, ppu());
    meter.ctlMs += performance.now() - t0; meter.frames++;
    flush();
    return fr;
  }
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
  }
  function tick() {
    raf = 0;
    const now = performance.now();
    let keep = false;
    if (run && ses) {
      const u = (now - run.p0) / 1000, g = run.g;
      if (u < 0) { const p = g.at(0); OV.pointer = g.kind === 'view' || (g.kind === 'deform' && S.opt === 'curve') ? null : [p.x, p.y]; keep = true; }
      else {
        const p = g.at(Math.min(u, g.dur));
        if (u <= g.dur + 1e-9 || !run.ended) {
          const fr = frameAt(p);
          OV.pointer = g.kind === 'view' || (g.kind === 'deform' && S.opt === 'curve') ? null : [p.x, p.y];
          OV.ring = S.opt === 'ring' ? [p.x, p.y] : null;
          OV.stroke = S.opt === 'curve' && p.pen ? ses.stroke.slice() : null;
          OV.grow = g.kind === 'view' ? [p.x, p.y, p.r] : null;
          if (g.kind === 'deform' && (now - (run.lastPaint || 0) >= 32 || u > g.dur)) { run.lastPaint = now; const t0 = performance.now(); renderPortrait(p.t, true); meter.paintMs += performance.now() - t0; meter.paints = (meter.paints || 0) + 1; }   // 30 frames a second
          readout(fr, g.kind === 'deform' ? p.t : null, g.kind === 'view' ? p.r : null);
          if (u > g.dur) { ses.end(clock()); flush(); run.ended = true; tailUntil = now + 2600; if (g.kind === 'deform') renderPortrait(null, false); OV.ring = null; ses = null; run = null; for (const b of document.querySelectorAll('.gest')) b.setAttribute('aria-pressed', 'false'); }
        }
        keep = true;
      }
    } else if (live && ses) {
      // the hand: one frame per animation frame with the latest position (activity decays while it rests)
      const fr = frameAt(live.pos);
      OV.pointer = [live.pos.x, live.pos.y]; OV.ring = S.opt === 'ring' ? [live.pos.x, live.pos.y] : null; OV.stroke = S.opt === 'curve' && live.pos.pen ? ses.stroke.slice() : null;
      readout(fr, null);
      keep = true;
    }
    drawOverlay();
    if (keep || now < tailUntil) loop();
  }
  function readout(fr, t, r) {
    if (!fr) return;
    const pr = fr.probe, deg = Math.round(((pr.phi % 1) + 1) % 1 * 360) % 360, m = Math.exp(pr.ln), H = t != null ? 'H' : 'F', nb = (s) => s.replace(/ /g, '\u00a0');
    const seg = [];
    if (r != null) seg.push('<b>circle</b> |z| = ' + r.toFixed(2));
    else if (S.opt === 'curve' && fr.loop) seg.push('<b>loop</b> |z ' + (fr.loop[0] ? (fr.loop[0] > 0 ? '− ' : '+ ') + C.fmtZ(Math.abs(fr.loop[0]), 0) : '') + '| = ' + fr.loop[2]);
    else seg.push('<b>z</b> = ' + nb(C.fmtZ(+fr.x.toFixed(2), +fr.y.toFixed(2))));
    if (t != null) seg.push('<b>t</b> = ' + t.toFixed(2));
    if (r == null && !(S.opt === 'curve' && fr.loop)) { seg.push('<b>arg ' + H + '</b> = ' + deg + '°'); seg.push('<b>|' + H + '|</b> = ' + (!Number.isFinite(m) ? '∞' : m >= 100 || m < 0.01 ? m.toExponential(1) : m.toFixed(2))); }
    $('#readout').innerHTML = seg.map((x) => '<span class="nw">' + x + '</span>').join(' · ') + '<br>' + esc(ses ? ses.info : '');
  }
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  // the hand on the portrait
  function posOf(e) { const r = ov.getBoundingClientRect(); const [x, y] = toZ(e.clientX - r.left, e.clientY - r.top); return { x, y, t: null, pen: S.opt === 'curve' ? (e.buttons & 1) === 1 || e.pointerType === 'touch' : false }; }
  function startLive(e) {
    if (!ctx || !eng) return false;
    if (run) stopAll(true);
    if (S.opt === 'sung') timbreVoices();
    ses = newSession(); ses.start(clock(), S.fn, null);
    live = { pos: posOf(e) }; $('#hint').style.opacity = 0;
    loop(); return true;
  }
  ov.addEventListener('pointerdown', (e) => {
    if (!ctx) { ensureAudio().then(() => { setSoundUi(true); startLive(e); }).catch(() => {}); return; }
    ov.setPointerCapture(e.pointerId);
    if (S.opt === 'curve' || !live) { if (live && ses) { ses.end(clock()); flush(); } startLive(e); }
    if (live) live.pos = posOf(e);
  });
  ov.addEventListener('pointermove', (e) => {
    if (run) return;
    if (!live) { if (e.pointerType === 'mouse' && (S.opt !== 'curve' || (e.buttons & 1))) startLive(e); return; }
    const p = posOf(e); live.pos = p;
  });
  const endLive = () => { if (live && ses) { ses.end(clock()); flush(); tailUntil = performance.now() + 2600; } live = null; ses = null; OV.pointer = OV.ring = null; if (S.opt !== 'curve') OV.stroke = null; loop(); };
  ov.addEventListener('pointerup', (e) => { if (live && (S.opt === 'curve' || e.pointerType !== 'mouse')) endLive(); });
  ov.addEventListener('pointercancel', endLive);
  ov.addEventListener('pointerleave', (e) => { if (live && !(S.opt === 'curve' && (e.buttons & 1))) endLive(); });

  // ------------------------------------------------------------------ controls
  const ICON = {
    visit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 18 C 6 12, 6 8, 8 8 S 14 14, 16 14"/><circle cx="8" cy="8" r="2.2" fill="#fff" stroke="currentColor"/><circle cx="17.5" cy="14" r="2.2" fill="currentColor"/></svg>',
    sweep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 15 L21 9"/><circle cx="21" cy="9" r="1.6" fill="currentColor"/></svg>',
    zero: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2" fill="#fff" stroke="currentColor"/></svg>',
    pole: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/></svg>',
    dzero: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.8" fill="#fff"/></svg>',
    deform: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 18 C 8 6, 16 6, 20 18"/><path d="M4 12 h16" stroke-dasharray="2 3"/></svg>',
    view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5" stroke-dasharray="2 2.5"/><circle cx="12" cy="12" r="10" stroke-dasharray="2 2.5"/></svg>',
  };
  const GESTS = [['visit', 'Visit a zero, then a pole'], ['sweep', 'Slow sweep'], ['zero', 'Loop: a zero'], ['pole', 'Loop: a pole'], ['dzero', 'Loop: a double zero'], ['deform', 'Deform z → F'], ['view', 'Hear the view']];
  function buildFns() {
    const el = $('#fnChips'); el.innerHTML = '';
    for (const f of C.FUNCS) { const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = f.label; b.setAttribute('aria-pressed', String(f === S.fn)); b.onclick = () => selectFn(f.id); el.appendChild(b); }
  }
  function buildGests() {
    const el = $('#gests'); el.innerHTML = '';
    for (const [k, name] of GESTS) {
      const g = C.gesture(S.fn, k), b = document.createElement('button'); b.className = 'gest'; b.type = 'button'; b.dataset.k = k; b.setAttribute('aria-pressed', 'false');
      let sub = '';
      if (!g) sub = k === 'pole' ? 'no pole here' : k === 'dzero' ? 'no multiple zero' : k === 'zero' && S.fn.zeros.length ? 'no simple zero: see the next' : 'no zero here';
      else if (k === 'view' && S.opt !== 'curve') sub = 'option 4 only';
      else if (k === 'visit' && S.opt === 'curve') sub = 'options 1–3: 4 hears curves';
      else if (k === 'visit') { const t = g.targets, nm = (p) => (p[2] < 1 ? 'branch point' : (p[2] === 3 ? 'triple ' : p[2] === 2 ? 'double ' : '') + (S.fn.poles.includes(p) ? 'pole' : 'zero')); sub = t.length < 2 ? 'the ' + nm(t[0]) + ' only' : (nm(t[0]) !== 'zero' || nm(t[1]) !== 'pole') ? nm(t[0]) + ', then ' + nm(t[1]) : ''; }
      else if (k === 'zero' && g.centre[2] < 1) sub = 'the branch point';
      else if (k === 'dzero' && g.centre[2] > 1) sub = g.centre[2] === 3 ? 'the triple zero' : 'the double zero';
      b.innerHTML = ICON[k] + '<span>' + name + (sub ? '<small>' + sub + '</small>' : '') + '</span>';
      b.disabled = !g || (k === 'view' && S.opt !== 'curve') || (k === 'visit' && S.opt === 'curve');
      b.onclick = () => playGesture(k);
      el.appendChild(b);
    }
  }
  function buildOpts() {
    const el = $('#opts'); el.innerHTML = '';
    for (const o of C.OPTIONS) {
      const l = document.createElement('label'); l.className = 'opt' + (o.id === S.opt ? ' on' : '');
      l.innerHTML = '<input type="radio" name="opt" value="' + o.id + '"' + (o.id === S.opt ? ' checked' : '') + '><span class="dot"></span><span class="name">' + o.name + (o.id === 'today' ? '<span class="ref">reference</span>' : '') + '</span><span class="line">' + o.line + '</span>';
      l.querySelector('input').onchange = () => selectOpt(o.id);
      el.appendChild(l);
    }
    buildSettings();
  }
  function chipRow(label, items, cur, on) {
    const row = document.createElement('div'); row.className = 'setrow'; row.innerHTML = '<span>' + label + '</span>';
    const g = document.createElement('div'); g.className = 'chips'; g.setAttribute('role', 'group'); g.setAttribute('aria-label', label);
    for (const [v, t] of items) { const b = document.createElement('button'); b.className = 'chip'; b.type = 'button'; b.textContent = t; b.setAttribute('aria-pressed', String(v === cur)); b.onclick = () => on(v); g.appendChild(b); }
    row.appendChild(g); return row;
  }
  function buildSettings() {
    const el = $('#settings'); el.innerHTML = '';
    const upd = (k, v) => { S.set[k] = v; store.set('set', S.set); stopAll(true); buildSettings(); };
    if (S.opt === 'sung') {
      el.appendChild(chipRow('Instrument', [['cello', 'Cello'], ['choir', 'Choir'], ['glass', 'Glass harmonica'], ['reed', 'Clarinet']], S.set.kind, (v) => upd('kind', v)));
      el.appendChild(chipRow('Drone on D', [[true, 'On'], [false, 'Off']], S.set.drone, (v) => upd('drone', v)));
    } else if (S.opt === 'harp') el.appendChild(chipRow('Strings', [['string', 'Plucked string'], ['glass', 'Glass']], S.set.mat, (v) => upd('mat', v)));
    else if (S.opt === 'ring') el.appendChild(chipRow('Colour', [['rich', 'Rich'], ['light', 'Light']], S.set.colour, (v) => upd('colour', v)));
  }
  const setHint = () => { $('#hint').textContent = S.opt === 'curve' ? 'Press and draw a loop here' : 'Move here to listen'; };
  // option 1's two timbres.js nodes: faded and disconnected 0.5 s after leaving option 1, so they stop processing (snd-9)
  function dropTimbres() {
    for (const n of [voice, drone].filter(Boolean)) { n.port.postMessage([{ at: 0, gate: 0, tau: 0.02 }]); setTimeout(() => { try { n.disconnect(); } catch (e) { /* gone */ } }, 500); }
    voice = drone = null; voiceKind = null;
  }
  const setKey = () => { $('#key').textContent = C.KEY[S.opt] || ''; };
  function selectOpt(id) {
    if (id === S.opt) return; stopAll(true); if (S.opt === 'sung' && id !== 'sung') dropTimbres(); S.opt = id; store.set('opt', id); setHint(); setKey();
    buildOpts(); buildGests(); $('#lgHarp').hidden = id !== 'harp'; renderPortrait(null, false); drawOverlay();
    $('#what').textContent = ''; $('#gcap').textContent = 'Press a gesture to hear it.';
  }
  function selectFn(id) {
    const f = C.byId[id]; if (!f) return; stopAll(true); S.fn = f; store.set('fn', id); grid = gridS = null;
    buildFns(); buildGests(); renderPortrait(null, false); drawOverlay(); $('#readout').textContent = '';
  }
  function setSoundUi(on) { const b = $('#soundBtn'); b.textContent = on ? 'Sound on' : 'Turn sound on'; b.setAttribute('aria-pressed', String(on)); b.classList.toggle('primary', !on); }
  $('#soundBtn').onclick = async () => {
    if (ctx && ctx.state === 'running') { stopAll(true); await ctx.suspend(); setSoundUi(false); return; }
    try { await ensureAudio(); if (ctx.state !== 'running') await ctx.resume(); setSoundUi(true); } catch (e) { $('#gcap').textContent = 'Sound is not available here: ' + e.message; }
  };
  const vol = $('#vol'); vol.value = S.volDb; $('#volTxt').textContent = (S.volDb > 0 ? '+' : S.volDb < 0 ? '−' : '') + Math.abs(S.volDb) + ' dB';
  vol.oninput = () => {
    S.volDb = +vol.value; store.set('vol', S.volDb); $('#volTxt').textContent = (S.volDb > 0 ? '+' : S.volDb < 0 ? '−' : '') + Math.abs(S.volDb) + ' dB';
    if (eng) eng.port.postMessage([{ k: 'vol', at: 0, v: dbLin(S.volDb) }]);
    if (ses) ses.vol = S.opt === 'sung' ? dbLin(S.volDb) : 1;
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { renderPortrait(lastT, false); drawOverlay(); });
  new ResizeObserver(() => { const r = box.getBoundingClientRect(); if (Math.round(r.width) !== css) resize(); }).observe(box);
  buildFns(); buildOpts(); buildGests(); $('#lgHarp').hidden = S.opt !== 'harp'; setHint(); setKey();
  if (matchMedia('(pointer: coarse)').matches) $('#phoneNote').hidden = false;
  resize();
})();
