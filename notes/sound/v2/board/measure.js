// Measurements of both palettes, evaluated in board.html by the CDP harness (window.__M). Offline renders through the
// app's graph (panner, tier, room) at 100 % volume, no clipper, 48 kHz: A = Sound (src/sound.js v15), B = SoundB.
window.__M = (() => {
  const FS = 48000, TAU = 2 * Math.PI;
  function biq(x, b, a) { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
  const KW = [[[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]], [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]]];
  function hpRBJ(f, q) { const w = TAU * f / FS, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al; return [[(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0], [1, -2 * c / a0, (1 - al) / a0]]; }
  const PHONE = [hpRBJ(550, 0.5412), hpRBJ(550, 1.3066)];
  const ch = (buf) => [buf.getChannelData(0), buf.getChannelData(1)];
  function kw(buf, phone) { return ch(buf).map((x0) => { let x = x0; for (const [b, a] of KW.concat(phone ? PHONE : [])) x = biq(x, b, a); return x; }); }
  // loudest window of `win` s (momentary 0.4, short-term 3), BS.1770 K-weighted, both channels
  function lufs(buf, phone, win = 0.4) { const c = kw(buf, phone), n = c[0].length, p = new Float64Array(n + 1); for (let i = 0; i < n; i++) p[i + 1] = p[i] + c[0][i] ** 2 + c[1][i] ** 2; const w = Math.round(win * FS); let m = 0; if (n < w) m = p[n] / w; else for (let i = 0; i + w <= n; i += 480) m = Math.max(m, (p[i + w] - p[i]) / w); return -0.691 + 10 * Math.log10(m + 1e-30); }
  function mono(buf) { const [L, R] = ch(buf), m = new Float64Array(L.length); for (let i = 0; i < m.length; i++) m[i] = 0.5 * (L[i] + R[i]); return m; }
  function fft(re, im) { const n = re.length; for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } } for (let len = 2; len <= n; len <<= 1) { const a = -TAU / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const p = i + j, q = p + len / 2, xr = re[q] * cr - im[q] * ci, xi = re[q] * ci + im[q] * cr; re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } } }
  // the metrics of one render
  function measure(buf, o = {}) {
    const x = mono(buf), n = x.length, h = 48, env = new Float64Array(Math.floor(n / h));
    let pk = 0; for (const [L, R] of [ch(buf)]) for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i]));
    for (let k = 0; k < env.length; k++) { let s = 0; for (let i = k * h; i < (k + 1) * h; i++) s += x[i] * x[i]; env[k] = Math.sqrt(s / h); }
    let emax = 0; for (const e of env) emax = Math.max(emax, e);
    let ss = 0, na = 0; for (const e of env) if (e > emax * 0.01) { ss += e * e; na++; }
    const rms = Math.sqrt(ss / Math.max(1, na));
    // transients: a 2 ms window ≥ 9 dB over the 20 ms before it and above −50 dB re the loudest ms
    let tr = 0; for (let k = 22; k < env.length - 2; k++) { let e2 = 0, e20 = 0; for (let j = 0; j < 2; j++) e2 += env[k + j] ** 2; for (let j = 2; j < 22; j++) e20 += env[k - j] ** 2; e2 /= 2; e20 /= 20; if (env[k] > emax * 0.00316 && e2 > 7.94 * (e20 + 1e-20)) { tr++; k += 20; } }
    // spectrum: power-weighted over 2048-sample Hann frames within 40 dB of the loudest frame
    const N = 2048, re = new Float64Array(N), im = new Float64Array(N), frames = [];
    for (let s = 0; s + N <= n; s += N / 2) { for (let i = 0; i < N; i++) { re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(TAU * i / (N - 1))); im[i] = 0; } fft(re, im); const P = new Float64Array(N / 2); let e = 0; for (let k = 1; k < N / 2; k++) { P[k] = re[k] ** 2 + im[k] ** 2; e += P[k]; } frames.push([e, P]); }
    let fmax = 0; for (const f of frames) fmax = Math.max(fmax, f[0]);
    let cen = 0, tot = 0, h25 = 0, h5 = 0;
    for (const [e, P] of frames) { if (e < fmax * 1e-4) continue; for (let k = 1; k < N / 2; k++) { const f = k * FS / N; cen += f * P[k]; tot += P[k]; if (f >= 2000 && f < 5000) h25 += P[k]; if (f >= 5000) h5 += P[k]; } }
    const dur = n / FS, r = (v, d = 1) => +v.toFixed(d);
    const out = { lufs: r(lufs(buf)), peak_dBFS: r(20 * Math.log10(pk + 1e-12)), crest_dB: r(20 * Math.log10(pk / (rms + 1e-12))), centroid_Hz: Math.round(cen / tot), harsh_2to5k_pct: r(100 * h25 / tot), above5k_pct: r(100 * h5 / tot), phone_loss_dB: r(lufs(buf) - lufs(buf, true)), transients_per_s: r(tr / (o.span || dur)) };
    if (o.st) out.shortTerm3s = r(lufs(buf, false, Math.min(3, dur)));
    return out;
  }
  // spectro-temporal fingerprint: 1/6-octave bands 100 Hz – 12 kHz × 10 ms frames, dB; the distance between two plays is
  // the RMS difference (dB) over cells within 45 dB of either play's loudest cell, after removing the overall level
  function spectro(buf) {
    const x = mono(buf), N = 1024, hop = 480, re = new Float64Array(N), im = new Float64Array(N), edges = [];
    for (let f = 100; f < 12000; f *= Math.pow(2, 1 / 6)) edges.push(f);
    const S = [];
    for (let s = 0; s + N <= x.length; s += hop) { for (let i = 0; i < N; i++) { re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(TAU * i / (N - 1))); im[i] = 0; } fft(re, im); const row = new Float64Array(edges.length - 1); for (let k = 1; k < N / 2; k++) { const f = k * FS / N; let b = Math.floor(Math.log2(f / 100) * 6); if (b >= 0 && b < row.length) row[b] += re[k] ** 2 + im[k] ** 2; } S.push(row.map((v) => 10 * Math.log10(v + 1e-20))); }
    return S;
  }
  function dist(A, B) {
    const n = Math.min(A.length, B.length); let ma = -1e9, mb = -1e9;
    for (let i = 0; i < n; i++) for (let k = 0; k < A[i].length; k++) { ma = Math.max(ma, A[i][k]); mb = Math.max(mb, B[i][k]); }
    let la = 0, lb = 0, cnt = 0; const cells = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < A[i].length; k++) if (A[i][k] > ma - 45 || B[i][k] > mb - 45) cells.push([Math.max(A[i][k], ma - 60), Math.max(B[i][k], mb - 60)]);
    for (const [a, b] of cells) { la += a; lb += b; cnt++; } const off = (la - lb) / cnt;
    let s = 0; for (const [a, b] of cells) s += (a - b - off) ** 2;
    return +Math.sqrt(s / cnt).toFixed(2);
  }
  // ---- renders
  const rA = (fn, dur) => Sound.render(fn, dur, { rate: FS, noClip: true });
  const rB = (fn, dur, o = {}) => SoundB.render(fn, dur, Object.assign({ noClip: true }, o));
  const cueA = (name, o, dur = 1.8) => rA((g, t) => Sound.CATALOG[name].make(g, t, Object.assign({ pan: 0 }, o)), dur);
  const cueB = (name, o, seed, dur = 1.8) => rB((e, t) => { e.play(name, Object.assign({ t0: t, seed, noRep: true }, o)); }, dur, { seed });
  const CUES = [['toggleOn', {}], ['toggleOff', {}], ['stepAdd', {}], ['stepRemove', {}], ['view', { k: 1 }], ['exportDone', {}], ['error', {}], ['edge', {}], ['snap', {}],
    ['morphStart', {}], ['morphEnd', {}], ['loopDone', { w: 2 }], ['loopDone', { w: 0 }], ['zero', { order: 2 }], ['pole', { order: 1 }], ['dense', {}], ['cut', {}], ['turn', { pc: 0, dir: 1 }], ['turnMany', { dir: 1 }], ['contour', { k: 0 }], ['collide', {}]];
  const key = (n, o) => n + (o.w != null ? '_w' + o.w : o.order ? '_m' + o.order : '');
  // calibration: B's mean LUFS-M over `k` plays vs A's
  async function calib(k = 6) {
    const out = {};
    for (const [n, o] of CUES) { const a = lufs(await cueA(n, o)); let s = 0; for (let j = 0; j < k; j++) s += lufs(await cueB(n, o, 900 + j)); out[key(n, o)] = { A: +a.toFixed(2), B: +(s / k).toFixed(2), trim: +(a - s / k).toFixed(2) }; }
    return out;
  }
  async function cues() {
    const out = {};
    for (const [n, o] of CUES) {
      const a = await cueA(n, o), a2 = await cueA(n, o), bs = [];
      for (let j = 0; j < 4; j++) bs.push(await cueB(n, o, 101 + j));
      const SA = spectro(a), SA2 = spectro(a2), SB = bs.map(spectro), LB = bs.map((b) => lufs(b));
      const mb = bs.map((b) => measure(b)), avg = {};
      for (const f of Object.keys(mb[0])) avg[f] = +(mb.reduce((s, m) => s + m[f], 0) / mb.length).toFixed(1);
      out[key(n, o)] = { A: Object.assign(measure(a), { rep_dist_dB: dist(SA, SA2), level_spread_dB: 0 }),
        B: Object.assign(avg, { rep_dist_dB: +((dist(SB[0], SB[1]) + dist(SB[1], SB[2]) + dist(SB[2], SB[3])) / 3).toFixed(2), level_spread_dB: +(Math.max(...LB) - Math.min(...LB)).toFixed(1) }) };
    }
    return out;
  }
  // ---- the scrub: slider events at 60 Hz (±3 ms jitter) along t(time); A = app.js sndScrub + Sound.play's 40 ms gap and
  // storm guard (14 a second; landmarks forced); B = SoundB scrub (texture + landmark notes); C = notes only
  function path(kind) {
    const pts = []; let r = 7; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
    const T = { slow: 4, medium: 1.2, fast: 0.5 }[kind], tot = kind === 'wiggle' ? 3 : 2 * T;
    for (let k = 0; k * (1 / 60) <= tot + 1e-9; k++) {
      const tm = k / 60 + (k ? (rnd() - 0.5) * 0.006 : 0);
      let u; if (kind === 'wiggle') u = 0.5 + 0.13 * Math.sin(TAU * 1.3 * tm) * Math.min(1, tm / 0.3); else { const x = tm <= T ? tm / T : 2 - tm / T; u = 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x))); }
      const rr = Math.round(u); if (Math.abs(u - rr) < 0.03) u = rr;
      pts.push([0.05 + tm, u]);
    }
    return { pts, tot };
  }
  function ticksA(pts) {
    const ticks = []; let last = -1e9; const recent = [];
    for (let k = 1; k < pts.length; k++) {
      const [tm, u] = pts[k], d0 = Math.round(pts[k - 1][1] * 20), d1 = Math.round(u * 20); if (d1 === d0) continue;
      const force = d1 % 5 === 0, now = tm * 1000;
      if (!force && now - last < 40) continue;
      while (recent.length && now - recent[0] > 1000) recent.shift();
      if (!force && recent.length >= 14) continue;
      last = now; if (!force) recent.push(now); ticks.push([tm, d1 / 20]);
    }
    return ticks;
  }
  const scrubA = (p, dur) => rA((g, t) => { for (const [tm, u] of ticksA(p.pts)) Sound.CATALOG.morphTick.make(g, t + tm, { t: u, pan: 0 }); }, dur);
  const scrubB = (p, dur, mode) => rB((e, t) => { for (let k = 1; k < p.pts.length; k++) e.scrub(p.pts[k - 1][1], p.pts[k][1], t + p.pts[k][0]); e.scrubEnd(t + p.pts[p.pts.length - 1][0] + 0.02); }, dur, { mode, seed: 5 });
  async function scrubs() {
    const out = {};
    for (const kind of ['slow', 'medium', 'fast', 'wiggle']) {
      const p = path(kind), dur = p.tot + 1.0, o = { st: true, span: p.tot };
      const a = await scrubA(p, dur), b = await scrubB(p, dur, 'B'), c = await scrubB(p, dur, 'C');
      out[kind] = { A: Object.assign({ cues: ticksA(p.pts).length }, measure(a, o)), B: Object.assign({ notes: b.log.length }, measure(b, o)), C: measure(c, o) };
    }
    return out;
  }
  // the deformation played (2 s): A swell + arrival; B swell + motion bed (first pass) + arrival
  async function morphPlay() {
    const dur = 4, a = await rA((g, t) => { Sound.CATALOG.morphStart.make(g, t, {}); Sound.CATALOG.morphEnd.make(g, t + 2, {}); }, dur);
    const b = await rB((e, t) => { e.play('morphStart', { t0: t }); for (let k = 0; k <= 120; k++) e.motion(k / 120, 0.5, t + k / 60); e.motionEnd(t + 2); e.play('morphEnd', { t0: t + 2, vel: 0.6 }); }, dur, { seed: 9 });
    const bm = await rB((e, t) => { for (let k = 0; k <= 120; k++) e.motion(k / 120, 0.5, t + k / 60); e.motionEnd(t + 2); }, dur, { seed: 9 });
    return { A: measure(a, { st: true }), B: measure(b, { st: true }), B_motion_bed_only: measure(bm, { st: true }) };
  }
  // ---- the Shepard voice: A (the app's) and B (glass choir), through the same ShepardVoice protocol, 60 Hz updates
  function chromaTrack(buf) { const x = mono(buf), N = 4096, re = new Float64Array(N), im = new Float64Array(N), out = []; for (let s = 0; s + N <= x.length; s += 2048) { for (let i = 0; i < N; i++) { re[i] = x[s + i] * (0.5 - 0.5 * Math.cos(TAU * i / (N - 1))); im[i] = 0; } fft(re, im); let cx = 0, cy = 0; for (let k = 2; k < N / 2; k++) { const f = k * FS / N; if (f < 60 || f > 5000) continue; const m = Math.hypot(re[k], im[k]), ph = Math.log2(f / 36.7081); cx += m * Math.cos(TAU * ph); cy += m * Math.sin(TAU * ph); } out.push([(s + N / 2) / FS, Math.atan2(cy, cx) / TAU]); } return out; }
  function ripple(buf, t0, t1) { const x = mono(buf), w = Math.round(0.05 * FS), v = []; for (let s = Math.round(t0 * FS); s + w <= Math.round(t1 * FS); s += w) { let e = 0; for (let i = 0; i < w; i++) e += x[s + i] ** 2; v.push(10 * Math.log10(e / w)); } return +(Math.max(...v) - Math.min(...v)).toFixed(2); }
  const SHP = { still: { dur: 2.2, c: () => 0.25, l: () => 0 }, loop: { dur: 6, c: (t) => (t < 0.5 ? 0 : t < 4.5 ? 2 * (0.5 - 0.5 * Math.cos(Math.PI * (t - 0.5) / 4)) : 2), l: (t) => (t < 0.5 || t > 4.5 ? 0 : -0.6 * Math.sin(Math.PI * (t - 0.5) / 2) ** 2) } };
  function drive(v, t, p, moving) {
    // still: one set (a resting pointer sends nothing), gate on, the app's 1.6 s stillness fade; loop: a set every frame
    if (!moving) { v.set(p.c(0), p.l(0), 0, t); v.gate(true, t); v.gate(false, t + 1.6, 0.35); return; }
    for (let k = 0; k * (1 / 60) <= p.dur - 0.3; k++) { const tm = k / 60; v.set(p.c(tm), p.l(tm), 0, t + tm); if (!k) v.gate(true, t); }
    v.gate(false, t + p.dur - 0.3, 0.35);
  }
  async function shepard() {
    const out = {};
    for (const kind of ['still', 'loop']) {
      const p = SHP[kind];
      const a = await rA((g, t) => drive(Sound.ShepardVoice(g), t, p, kind === 'loop'), p.dur);
      const b = await rB((e, t) => drive(e.voice(), t, p, kind === 'loop'), p.dur, { seed: 3 });
      const rb = (buf) => {
        const tr = chromaTrack(buf);
        if (kind === 'still') { const e = tr.filter(([t]) => t > 0.3 && t < 1.5).map(([, c]) => { let d = c - 0.25; d -= Math.round(d); return Math.abs(d) * 1200; }); return { chroma_err_max_cents: +Math.max(...e).toFixed(1), chroma_err_mean_cents: +(e.reduce((s, v) => s + v, 0) / e.length).toFixed(1), ripple_0p3_to_1p5s_dB: ripple(buf, 0.3, 1.5) }; }
        let u = 0, prev = null; for (const [t, c] of tr) { if (t < 0.3 || t > 5.4) continue; if (prev != null) { let d = c - prev; d -= Math.round(d); u += d; } prev = c; } return { turns_read: +u.toFixed(3), ripple_4p6_to_5p4s_dB: ripple(buf, 4.6, 5.4) };
      };
      out[kind] = { A: Object.assign(measure(a), rb(a)), B: Object.assign(measure(b), rb(b)) };
    }
    return out;
  }
  // offline renders handed back as interleaved Float32 (base64) for the click detectors
  function b64(buf) { const [L, R] = ch(buf), a = new Float32Array(2 * L.length); for (let i = 0; i < L.length; i++) { a[2 * i] = L[i]; a[2 * i + 1] = R[i]; } const u8 = new Uint8Array(a.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  async function renders() {
    const p = path('wiggle'), q = path('fast'), sh = SHP.loop, out = {};
    out.scrubA_wiggle = b64(await scrubA(p, p.tot + 1)); out.scrubB_wiggle = b64(await scrubB(p, p.tot + 1, 'B'));
    out.scrubA_fast = b64(await scrubA(q, q.tot + 1)); out.scrubB_fast = b64(await scrubB(q, q.tot + 1, 'B'));
    out.voiceA_loop = b64(await rA((g, t) => drive(Sound.ShepardVoice(g), t, sh, true), sh.dur)); out.voiceB_loop = b64(await rB((e, t) => drive(e.voice(), t, sh, true), sh.dur, { seed: 3 }));
    return out;
  }
  return { calib, cues, scrubs, morphPlay, shepard, renders, measure, lufs, path, ticksA };
})();
