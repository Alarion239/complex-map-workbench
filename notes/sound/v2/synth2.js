'use strict';
// Sound v2 (proposal, notes/sound/v2/DESIGN.md): physically modelled cues, rendered sample by sample into short
// buffers, with variation on every play. Nothing here is in the app. Pure functions of (cue, options, random seed).
//   strike()  a modal bank (wood, kalimba tine, glass, metal bar, felt membrane) hit by a mallet whose contact time sets
//             the brightness (soft = long contact = dark); the modes ring in with a raised cosine over that contact time
//   pluck()   Karplus-Strong string, excited by one period of filtered noise (no hard onset)
//   air()     filtered noise with a raised-cosine envelope (paper, breath, swish)
//   texture() the scrub: air whose level follows the speed of t and whose band follows t; no impulses
//   shepard() the "glass choir" Shepard tone: 3 detuned voices per octave partial, slow drift, delayed vibrato, breath
// Every function writes into a mono or stereo Float64Array at a sample offset; render() turns a cue into an AudioBuffer.
const V2 = (() => {
  const TAU = 2 * Math.PI;
  let FS = 48000;
  function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let R = prng(12345);
  const seed = (s) => { R = prng(s); };
  const rnd = (a, b) => a + (b - a) * R();
  const vdb = (db) => Math.pow(10, rnd(-db, db) / 20);          // ± db, uniform in dB
  const cents = (c) => Math.pow(2, c / 1200);
  const D4 = 293.665, st = (n) => D4 * Math.pow(2, n / 12);
  const PENTA = [0, 2, 4, 7, 9], penta = (k) => st(12 + 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5]);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------------------------------------------------------------- materials (mode ratio, amplitude, T60 factor, beat Hz)
  // wood: a tuned marimba bar (1 : 3.9 : 9.2); tine: a kalimba tine, clamped-free (1 : 6.27 : 17.55); glass: a struck
  // wine glass (about 1 : 2.32 : 4.25 : 6.63, each mode a split pair that beats); bar: a free metal bar
  // (1 : 2.756 : 5.404 : 8.933, the current "bell"); skin: a felt-struck membrane (Bessel ratios 1 : 1.59 : 2.14 : 2.30);
  // block: a woodblock (1 : 2.4 : 3.9), very damped
  const MAT = {
    wood: { r: [1, 3.93, 9.2], a: [1, 0.22, 0.06], d: [1, 0.32, 0.12], b: [0, 0, 0], knock: 0.10, kf: 1800 },
    tine: { r: [1, 6.267, 17.55], a: [1, 0.10, 0.025], d: [1, 0.22, 0.08], b: [0, 0, 0], knock: 0.05, kf: 2500 },
    glass: { r: [1, 2.32, 4.25, 6.63], a: [1, 0.34, 0.14, 0.05], d: [1, 0.55, 0.30, 0.17], b: [0.8, 1.6, 2.5, 3.1], knock: 0.025, kf: 4000 },
    bar: { r: [1, 2.756, 5.404, 8.933], a: [1, 0.26, 0.08, 0.025], d: [1, 0.45, 0.20, 0.10], b: [0.5, 1.2, 0, 0], knock: 0.03, kf: 3500 },
    skin: { r: [1, 1.593, 2.136, 2.296], a: [1, 0.45, 0.25, 0.18], d: [1, 0.6, 0.45, 0.4], b: [0, 0, 0, 0], knock: 0.22, kf: 1500 },
    block: { r: [1, 2.4, 3.9], a: [1, 0.45, 0.2], d: [1, 0.5, 0.3], b: [0, 0, 0], knock: 0.30, kf: 1200 },
  };
  // the mallet: a raised-cosine force pulse of length tau; its spectrum, smoothed, is 1/(1 + (2 f tau)²). Harder (faster)
  // strikes have shorter contact (Hertz: tau ∝ v^-1/5) and so more high modes: velocity → brightness.
  const mallet = (f, tau) => 1 / (1 + Math.pow(2 * f * tau, 2));
  const tauOf = (vel, soft) => soft * Math.pow(clamp(vel, 0.05, 1), -0.2) * 0.001;   // ms → s; soft = contact at vel 1

  // one decaying sinusoid into y (mono), from sample i0: raised-cosine ring-in over tau, exp decay to -60 dB in t60,
  // a raised-cosine fade over the last 12 ms, exactly 0 after
  function mode(y, i0, f, amp, t60, tau, ph = 0, fdrop = 0, tdrop = 0.06) {
    if (f >= 0.45 * FS || amp <= 0) return;
    const nAtt = Math.max(1, Math.round(tau * FS)), nDec = Math.round(t60 * FS), nF = Math.round(0.012 * FS), n = nAtt + nDec;
    const k = 6.9078 / nDec; let p = ph;
    for (let i = 0; i < n && i0 + i < y.length; i++) {
      const e = i < nAtt ? 0.5 - 0.5 * Math.cos(Math.PI * i / nAtt) : Math.exp(-k * (i - nAtt));
      const fade = i > n - nF ? 0.5 - 0.5 * Math.cos(Math.PI * (n - i) / nF) : 1;
      const fi = fdrop ? f * Math.pow(2, -fdrop / 12 * (1 - Math.exp(-i / (tdrop * FS)))) : f;
      p += TAU * fi / FS; y[i0 + i] += amp * e * fade * Math.sin(p);
    }
  }
  // a short noise burst (contact): Hann window of n samples, one-pole low-pass at fc, one-pole high-pass at 250 Hz
  function noiseBurst(y, i0, dur, fc, amp) {
    const n = Math.max(8, Math.round(dur * FS)), a = 1 - Math.exp(-TAU * fc / FS), h = Math.exp(-TAU * 250 / FS);
    let lp = 0, hpx = 0, hpy = 0;
    for (let i = 0; i < n && i0 + i < y.length; i++) {
      lp += a * (2 * R() - 1 - lp); const hy = h * (hpy + lp - hpx); hpx = lp; hpy = hy;
      y[i0 + i] += amp * hy * (0.5 - 0.5 * Math.cos(TAU * i / (n - 1)));
    }
  }
  // strike a material: f0 fundamental, o = {vel 0..1, soft (contact ms at vel 1), t60 (fundamental), amp, drop (semitones
  // the pitch falls after the strike: a felt membrane's tension relaxing), detune (cents, random ±), var (dB, random ±)}
  function strike(y, i0, f0, mat, o) {
    const M = MAT[mat], vel = clamp((o.vel == null ? 0.7 : o.vel) * rnd(0.88, 1.12), 0.05, 1), tau = tauOf(vel, o.soft || 1.2);
    const dt = o.detune ?? 3, f = f0 * cents(rnd(-dt, dt));
    const g = (o.amp || 0.1) * vel * vdb(o.var == null ? 1.5 : o.var), t60 = (o.t60 || 0.3) * rnd(0.88, 1.12), w0 = mallet(f, tau);
    for (let j = 0; j < M.r.length; j++) {
      const fj = f * M.r[j], aj = g * M.a[j] * mallet(fj, tau) / w0 * vdb(2), tj = t60 * M.d[j];
      if (M.b[j]) {                     // a split pair beating at b Hz: the ring "breathes"
        const bb = M.b[j] * rnd(0.8, 1.25);
        const ph = rnd(0, TAU), r2 = rnd(0.3, 0.6);   // both halves start in phase (the strike excites them together); they drift apart and beat
        mode(y, i0, fj - bb / 2, aj * (1 - r2), tj, tau, ph, o.drop); mode(y, i0, fj + bb / 2, aj * r2, tj * 0.9, tau, ph, o.drop);
      } else mode(y, i0, fj, aj, tj, tau, 0, o.drop);
    }
    if (M.knock) noiseBurst(y, i0, Math.max(0.002, 2.5 * tau), Math.min(M.kf * (0.6 + 0.8 * vel), 6000), g * M.knock * (o.knock == null ? 1 : o.knock));
  }
  // Karplus-Strong: the loop is one period of delay with a two-point average and a loss rho per period (T60), tuned by
  // a first-order allpass; the excitation is one period of noise, low-passed by `bright`, Hann-windowed (no hard onset)
  function pluck(y, i0, f0, o) {
    const f = f0 * cents(rnd(-3, 3)), P = FS / f - 0.5, L = Math.floor(P), fr = P - L, c = (1 - fr) / (1 + fr);
    const rho = Math.pow(10, -3 / (f * (o.t60 || 0.4))), g = (o.amp || 0.1) * vdb(1.5);
    const n = Math.round(((o.t60 || 0.4) + 0.02) * FS), buf = new Float64Array(L + 2), a = clamp(o.bright == null ? 0.5 : o.bright, 0.05, 1);
    const nE = Math.max(L, Math.round(0.003 * FS)); let lp = 0, ap1x = 0, ap1y = 0, w = 0, prev = 0, peak = 1e-9; const out = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let x = 0; if (i < nE) { lp += a * (2 * R() - 1 - lp); x = lp * (0.5 - 0.5 * Math.cos(TAU * i / (nE - 1))) * L / nE; }
      const d = buf[w]; const avg = 0.5 * (d + prev); prev = d;
      const ap = c * avg + ap1x - c * ap1y; ap1x = avg; ap1y = ap;
      const v = x + rho * ap; buf[w] = v; w = (w + 1) % L; out[i] = v; peak = Math.max(peak, Math.abs(v));
    }
    const nF = Math.round(0.015 * FS);
    for (let i = 0; i < n && i0 + i < y.length; i++) y[i0 + i] += g * out[i] / peak * (i > n - nF ? 0.5 - 0.5 * Math.cos(Math.PI * (n - i) / nF) : 1);
  }
  // filtered noise with a raised-cosine envelope: a two-pole band-pass (SVF) whose centre glides from fa to fb (exp),
  // q, plus a slow flutter (6-10 Hz, depth fl) so it is never a static hiss
  function air(y, i0, dur, fa, fb, q, amp, o = {}) {
    const n = Math.round(dur * FS), att = o.att == null ? 0.5 : o.att; let lo = 0, bp = 0, fl = 0, flt = 0;
    for (let i = 0; i < n && i0 + i < y.length; i++) {
      const u = i / n, fc = fa * Math.pow(fb / fa, u), F = 2 * Math.sin(Math.PI * Math.min(fc, 0.2 * FS) / FS);
      const hp = 2 * R() - 1 - lo - bp / q; bp += F * hp; lo += F * bp;
      if (i % 64 === 0) flt = 2 * R() - 1; fl += (flt - fl) * 0.004;
      const e = u < att ? 0.5 - 0.5 * Math.cos(Math.PI * u / att) : 0.5 + 0.5 * Math.cos(Math.PI * (u - att) / (1 - att));
      y[i0 + i] += amp * e * (1 + (o.fl || 0.15) * fl) * bp / Math.sqrt(q);
    }
  }
  // a bowed-glass tone (a swell): 3 detuned sines (±5 cents and a beating pair), raised-cosine attack, hold, exp release
  function bowed(y, i0, f0, o) {
    const att = o.att || 0.2, hold = o.hold || 0.1, t60 = o.t60 || 0.6, g = (o.amp || 0.05) * vdb(1);
    const n1 = Math.round(att * FS), n2 = n1 + Math.round(hold * FS), n = n2 + Math.round(t60 * FS), nF = Math.round(0.02 * FS), k = 6.9078 / (n - n2);
    const vs = [[-5, 0.34], [0.3, 0.4], [5.5, 0.26]].map(([c, a]) => ({ f: f0 * cents(c + rnd(-1.5, 1.5)), a, p: rnd(0, TAU) }));
    for (let i = 0; i < n && i0 + i < y.length; i++) {
      const e = i < n1 ? 0.5 - 0.5 * Math.cos(Math.PI * i / n1) : i < n2 ? 1 : Math.exp(-k * (i - n2));
      const fade = i > n - nF ? 0.5 - 0.5 * Math.cos(Math.PI * (n - i) / nF) : 1;
      let s = 0; for (const v of vs) { const gl = o.f1 ? Math.pow(o.f1 / f0, 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, i / ((o.glide || 0.2) * FS)))) : 1; v.p += TAU * v.f * gl / FS; s += v.a * Math.sin(v.p); }
      y[i0 + i] += g * e * fade * s;
    }
  }

  // ---------------------------------------------------------------- the catalog (v2). make(y, o) writes into mono y
  // (o.vel: gesture speed 0..1 where the app has one; every play draws new variation)
  const S = (s) => Math.round(s * FS);
  const CAT = {
    snap: { tier: 'ui', dur: 0.08, wet: 0.05, make: (y, o) => strike(y, 0, 2100, 'block', { vel: o.vel ?? 0.5, soft: 0.5, t60: 0.03, amp: 0.28, detune: 60, var: 2.5 }) },
    toggleOn: { tier: 'ui', dur: 0.35, wet: 0.08, make: (y, o) => strike(y, 0, st(19), 'tine', { vel: o.vel ?? 0.65, soft: 1.1, t60: 0.24, amp: 0.265, detune: 6 }) },
    toggleOff: { tier: 'ui', dur: 0.3, wet: 0.08, make: (y, o) => strike(y, 0, st(14), 'tine', { vel: o.vel ?? 0.5, soft: 1.8, t60: 0.15, amp: 0.36, detune: 6 }) },
    stepAdd: { tier: 'ui', dur: 0.4, wet: 0.08, make: (y, o) => { strike(y, 0, st(12), 'tine', { vel: 0.55, soft: 1.3, t60: 0.2, amp: 0.205, detune: 6 }); strike(y, S(0.058 + rnd(-0.004, 0.004)), st(19), 'tine', { vel: 0.65, soft: 1.1, t60: 0.26, amp: 0.22, detune: 6 }); } },
    stepRemove: { tier: 'ui', dur: 0.4, wet: 0.08, make: (y, o) => { strike(y, 0, st(19), 'tine', { vel: 0.62, soft: 1.2, t60: 0.2, amp: 0.27, detune: 6 }); strike(y, S(0.058 + rnd(-0.004, 0.004)), st(12), 'tine', { vel: 0.5, soft: 1.8, t60: 0.14, amp: 0.24, detune: 6 }); } },
    view: { tier: 'ui', dur: 0.35, wet: 0.08, make: (y, o) => { air(y, 0, 0.05, 2600, 3400, 1.4, 0.03, { att: 0.3 }); strike(y, S(0.02), st([12, 16, 19, 21][clamp(o.k | 0, 0, 3)]), 'wood', { vel: 0.6, soft: 1.6, t60: 0.22, amp: 0.20, detune: 6 }); } },
    exportDone: { tier: 'ui', dur: 0.9, wet: 0.10, make: (y, o) => { air(y, 0, 0.2, 700, 2200, 1.1, 0.16, { att: 0.55, fl: 0.25 }); strike(y, S(0.17), st(19), 'glass', { vel: 0.55, soft: 0.9, t60: 0.6, amp: 0.32 }); strike(y, S(0.19), st(26), 'glass', { vel: 0.45, soft: 0.9, t60: 0.45, amp: 0.14 }); } },
    error: { tier: 'ui', dur: 0.35, wet: 0.06, make: (y, o) => { for (const [u, a, c] of [[0, 1, 0], [0.088 + rnd(-0.005, 0.005), 0.85, -25]]) { strike(y, S(u), st(0) * cents(c), 'block', { vel: 0.8 * a, soft: 0.9, t60: 0.09, amp: 0.26, knock: 5 }); strike(y, S(u), st(12) * cents(c), 'block', { vel: 0.7 * a, soft: 0.9, t60: 0.06, amp: 0.40, knock: 0 }); } } },
    edge: { tier: 'ui', dur: 0.3, wet: 0.05, make: (y, o) => { strike(y, 0, st(7), 'skin', { vel: 0.6, soft: 1.8, t60: 0.1, amp: 0.17, drop: 1, knock: 3.5 }); strike(y, 0, st(19), 'block', { vel: 0.4, soft: 0.8, t60: 0.04, amp: 0.2 }); } },
    morphStart: { tier: 'events', dur: 1.3, wet: 0.22, make: (y, o) => { air(y, 0, 0.6, 600, 2600, 0.9, 0.04, { att: 0.45, fl: 0.3 }); bowed(y, 0, st(12), { att: 0.22, hold: 0.12, t60: 0.7, amp: 0.05 }); bowed(y, S(0.03), st(19), { att: 0.25, hold: 0.1, t60: 0.7, amp: 0.04 }); } },
    morphEnd: { tier: 'events', dur: 1.6, wet: 0.25, make: (y, o) => { strike(y, 0, st(0), 'wood', { vel: 0.5, soft: 2.2, t60: 0.5, amp: 0.10 }); strike(y, S(0.012), st(24), 'glass', { vel: o.vel ?? 0.6, soft: 0.9, t60: 1.0, amp: 0.13 }); strike(y, S(0.04), st(28), 'glass', { vel: (o.vel ?? 0.6) * 0.85, soft: 0.9, t60: 0.9, amp: 0.095 }); } },
    landmark: { tier: 'events', dur: 0.6, wet: 0.15, make: (y, o) => { const q = clamp(o.q | 0, 0, 4); strike(y, 0, st([12, 16, 19, 21, 24][q]), 'wood', { vel: o.vel ?? 0.5, soft: 1.8, t60: q === 0 || q === 4 ? 0.45 : 0.3, amp: 0.065 }); } },
    loopDone: { tier: 'events', dur: 1.6, wet: 0.22, make: (y, o) => {
      const w = o.w | 0, n = Math.min(8, Math.abs(w));
      if (!w) return strike(y, 0, st(19), 'block', { vel: 0.5, soft: 1.2, t60: 0.08, amp: 0.35 });
      for (let j = 0; j < n; j++) strike(y, S(0.125 * j + (j ? rnd(-0.003, 0.003) : 0)), penta(w > 0 ? 5 + j : 5 - j), 'glass', { vel: j ? 0.62 - 0.02 * j : 0.85, soft: 0.8, t60: 0.5, amp: 0.11, detune: 2 });
    } },
    cut: { tier: 'sonify', dur: 0.25, wet: 0.08, make: (y, o) => { pluck(y, 0, st(28), { t60: 0.09, bright: 0.22, amp: 0.16 }); pluck(y, S(0.035), st(24), { t60: 0.12, bright: 0.18, amp: 0.16 }); } },
    zero: { tier: 'sonify', dur: 1.4, wet: 0.2, make: (y, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.11; for (let j = 0; j < m; j++) strike(y, S(sp * j), st(24), 'glass', { vel: (o.vel ?? 0.6) * (j ? 0.75 : 1), soft: 0.8, t60: 0.55, amp: 0.21, detune: 2 }); } },
    pole: { tier: 'sonify', dur: 1.0, wet: 0.14, make: (y, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.12; for (let j = 0; j < m; j++) { strike(y, S(sp * j), st(7), 'skin', { vel: (o.vel ?? 0.7) * (j ? 0.75 : 1), soft: 1.6, t60: 0.16, amp: 0.36, drop: 1.5, knock: 3.5 }); strike(y, S(sp * j), st(-5), 'skin', { vel: (o.vel ?? 0.7) * (j ? 0.75 : 1), soft: 2.4, t60: 0.2, amp: 0.06, drop: 1.5, knock: 0 }); } } },
    dense: { tier: 'sonify', dur: 0.6, wet: 0.15, make: (y, o) => { for (let j = 0; j < 3; j++) strike(y, S(0.04 * j + rnd(-0.004, 0.004)), penta(5 + j), 'glass', { vel: 0.35, soft: 0.8, t60: 0.2, amp: 0.085 }); } },
    contour: { tier: 'sonify', dur: 0.25, wet: 0.05, make: (y, o) => strike(y, 0, 2 * (o.f || st(12)), 'wood', { vel: o.vel ?? 0.5, soft: 1.4, t60: 0.09, amp: 0.25, detune: 2 }) },
    turn: { tier: 'sonify', dur: 1.0, wet: 0.2, make: (y, o) => { let f = 36.7081 * Math.pow(2, ((o.pc || 0) % 1 + 1) % 1); while (f < 1700) f *= 2; const up = (o.dir || 1) > 0; strike(y, 0, up ? f * 2 / 3 : f * 4 / 3, 'glass', { vel: 0.35, soft: 0.8, t60: 0.14, amp: 0.12, detune: 0 }); strike(y, S(0.045), f, 'glass', { vel: 0.7, soft: 0.7, t60: 0.6, amp: 0.15, detune: 0 }); } },
    turnMany: { tier: 'sonify', dur: 0.8, wet: 0.2, make: (y, o) => { for (let j = 0; j < 5; j++) strike(y, S(0.035 * j + rnd(-0.003, 0.003)), penta((o.dir || 1) > 0 ? 5 + j : 9 - j), 'glass', { vel: 0.4, soft: 0.8, t60: 0.2, amp: 0.10 }); } },
    collide: { tier: 'sonify', dur: 1.0, wet: 0.18, make: (y, o) => { const f = st(19); bowed(y, 0, f * Math.pow(2, 2 / 12), { f1: f, glide: 0.22, att: 0.04, hold: 0.1, t60: 0.5, amp: 0.06 }); bowed(y, 0, f / Math.pow(2, 2 / 12), { f1: f, glide: 0.22, att: 0.04, hold: 0.1, t60: 0.5, amp: 0.06 }); } },
  };

  // ---------------------------------------------------------------- the scrub texture (replaces the 0.05 detent ticks)
  // path: [[time s, t], ...] (slider events). Speed v = |dt/dtime| in t-units per second, smoothed (attack 25 ms,
  // release 160 ms). Level = smoothstep above 0.1/s, (v / 2.5)^0.6, capped at 1. Band: centre 380 · 2^(2.2 t) Hz
  // (t = 0: 380 Hz, t = 1: 1.75 kHz), q 1.6, a second band 2.3× up at 0.35, + 15 % flutter at 6-10 Hz. Landmarks
  // (t = 0, ¼, ½, ¾, 1 crossed or reached) strike the wood bar at D5 F♯5 A5 B5 D6, velocity from v. An end reached at
  // speed adds a felt bump. Returns mono samples; landmark strikes are written into the same buffer.
  function texture(y, path, o = {}) {
    const n = y.length, amp = o.amp || 0.06; let j = 0, v = 0, lo1 = 0, bp1 = 0, lo2 = 0, bp2 = 0, fl = 0, flt = 0, tPrev = path[0][1];
    const aA = 1 - Math.exp(-1 / (0.025 * FS)), aR = 1 - Math.exp(-1 / (0.16 * FS)), aP = 1 - Math.exp(-TAU * 900 / FS), aO = 1 - Math.exp(-TAU * 3500 / FS); let pk = 0, ol = 0;
    const marks = [];
    for (let k = 1; k < path.length; k++) {
      const [ta, ua] = path[k - 1], [tb, ub] = path[k];
      for (let q = 0; q <= 4; q++) { const m = q / 4; if ((ua < m && ub >= m) || (ua > m && ub <= m) || (ub === m && ua !== m)) marks.push({ at: tb, q, v: Math.abs(ub - ua) / Math.max(1e-3, tb - ta) }); }
    }
    for (let i = 0; i < n; i++) {
      const tm = i / FS; while (j < path.length - 2 && path[j + 1][0] <= tm) j++;
      const [ta, ua] = path[j], [tb, ub] = path[Math.min(j + 1, path.length - 1)];
      const target = tm > tb || tb === ta ? 0 : Math.abs(ub - ua) / (tb - ta);
      v += (target - v) * (target > v ? aA : aR);
      const u = tb === ta ? ub : ua + (ub - ua) * clamp((tm - ta) / (tb - ta), 0, 1);
      const x = clamp((v - 0.1) / 0.3, 0, 1), lvl = x * x * (3 - 2 * x) * Math.min(1, Math.pow(v / 2.5, 0.6));
      const fc = 380 * Math.pow(2, 2.2 * clamp(u, 0, 1)) * (1 + 0.12 * lvl);
      const F1 = 2 * Math.sin(Math.PI * fc / FS), F2 = 2 * Math.sin(Math.PI * Math.min(2.3 * fc, 0.2 * FS) / FS); pk += aP * (2 * R() - 1 - pk); const w = 3 * pk;
      let hp = w - lo1 - bp1 / 1.6; bp1 += F1 * hp; lo1 += F1 * bp1;
      hp = w - lo2 - bp2 / 1.6; bp2 += F2 * hp; lo2 += F2 * bp2;
      if (i % 64 === 0) flt = 2 * R() - 1; fl += (flt - fl) * 0.004;
      ol += aO * ((bp1 + 0.35 * bp2) / Math.sqrt(1.6) - ol); y[i] += amp * lvl * (1 + 0.15 * fl) * ol;
    }
    for (const m of o.noMarks ? [] : marks) {
      const vel = clamp(0.3 + 0.25 * Math.log2(1 + m.v), 0.3, 0.85), i0 = Math.round(m.at * FS);
      const tmp = new Float64Array(Math.round(0.6 * FS)); CAT.landmark.make(tmp, { q: m.q, vel });
      for (let i = 0; i < tmp.length && i0 + i < n; i++) y[i0 + i] += tmp[i];
      if ((m.q === 0 || m.q === 4) && m.v > 0.8) strike(y, i0, st(-12), 'skin', { vel: clamp(m.v / 4, 0.3, 0.8), soft: 3, t60: 0.15, amp: 0.35, drop: 1 });
    }
    return marks.length;
  }

  // ---------------------------------------------------------------- the "glass choir" Shepard tone (offline, for listening
  // and measurement; the app's worklet would run the same per-sample loop). chroma(time) in turns, lnAbs(time).
  // 9 octave partials (D1 · 2^pos, the same Gaussian bell over pos as now, σ 0.95, centre 4.1 + 0.3 tanh(ln|F|/2.5)),
  // each made of 3 voices at -5.5, +0.3, +5.2 cents (mean 0: the pitch class is unbiased) that drift ±2.5 cents
  // (smoothed noise, ~0.15 Hz) and shimmer ±0.8 dB (~0.3 Hz); one shared vibrato at 5.1 Hz whose depth grows to
  // ±9 cents with a 0.7 s time constant while the chroma is steady (< 0.05 turn/s) and sinks in 0.15 s when it moves;
  // the centre wanders ±0.06 octave at 0.04 Hz; breath: noise band-passed at the bell's centre frequency, q 0.8, at
  // about -24 dB re the tone. Voices spread L / C / R (±0.25). warm = false gives the current pure-sine Shepard.
  function shepard(L, Rr, chroma, lnAbs, o = {}) {
    const N = 9, FLO = 36.7081, SIG = 0.95, warm = o.warm !== false, amp = o.amp || 0.028, n = L.length, i0 = o.i0 || 0;
    const det = warm ? [-3.5, 0, 3.5] : [0], va = warm ? [0.13, 0.74, 0.13] : [1], pan = warm ? [-0.25, 0, 0.25] : [0];
    const P = new Float64Array(N * det.length).map(() => rnd(0, TAU));
    const drift = Array.from({ length: N * det.length }, () => ({ v: 0, t: 0, a: 0, at: 0 }));
    let vibD = 0, vibP = rnd(0, TAU), cw = 0, cwt = 0, lo = 0, bp = 0, prevC = chroma(0), slow = 0;
    const taper = (p) => { if (p <= 0 || p >= N) return 0; const e = Math.min(p, N - p); if (e >= 0.5) return 1; const s = Math.sin(Math.PI * e); return s * s; };
    for (let i = 0; i < n; i++) {
      const tm = i / FS, c = chroma(tm), la = lnAbs(tm), u = c - Math.floor(c);
      const rate = Math.abs(c - prevC) * FS; prevC = c; slow += ((rate < 0.05 ? 1 : 0) - slow) * (1 - Math.exp(-1 / ((rate < 0.05 ? 0.7 : 0.15) * FS)));
      if (warm) { vibD = 6 * slow; vibP += TAU * 5.1 / FS; if (i % 131072 === 0) cwt = rnd(-1, 1); cw += (cwt - cw) * (1 / (2 * FS)); }
      const centre = 4.1 + 0.3 * Math.tanh(la / 2.5) + 0.06 * cw, loud = 0.6 + 0.4 / (1 + Math.exp(-1.3 * (la + 1)));
      const vib = warm ? cents(vibD * Math.sin(vibP)) : 1;
      let sl = 0, sr = 0;
      for (let k = 0; k < N; k++) {
        const pos = k + u, d = (pos - centre) / SIG, g = Math.exp(-0.5 * d * d) * taper(pos) * loud; if (g < 1e-5) continue;
        const f = FLO * Math.pow(2, pos);
        for (let m = 0; m < det.length; m++) {
          const ix = k * det.length + m, D = drift[ix];
          if (warm) { if (i % 65536 === (ix * 2503) % 65536) { D.t = rnd(-1.5, 1.5); D.at = rnd(-0.06, 0.06); } D.v += (D.t - D.v) * (1 / (0.8 * FS)); D.a += (D.at - D.a) * (1 / (0.8 * FS)); }
          const fi = f * cents(det[m] + D.v) * vib; if (fi > 0.45 * FS) continue;
          P[ix] += TAU * fi / FS; const s = g * va[m] * (1 + D.a) * Math.sin(P[ix]);
          sl += s * Math.cos((pan[m] + 1) * Math.PI / 4); sr += s * Math.sin((pan[m] + 1) * Math.PI / 4);
        }
      }
      if (warm) {   // breath at the bell's centre
        const fc = FLO * Math.pow(2, centre), F = 2 * Math.sin(Math.PI * fc / FS), hp = 2 * R() - 1 - lo - bp / 0.8; bp += F * hp; lo += F * bp;
        const b = 0.035 * loud * bp; sl += b * 0.7; sr += b * 0.7;
      }
      L[i0 + i] += amp * sl; Rr[i0 + i] += amp * sr;
    }
  }

  return { CAT, MAT, strike, pluck, air, bowed, texture, shepard, seed, st, penta, setRate: (r) => { FS = r; }, rate: () => FS };
})();
