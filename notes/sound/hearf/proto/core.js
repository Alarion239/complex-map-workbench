'use strict';
// =====================================================================================================================
// hearf/options.html: the DOM-free core. Functions, the exact arg tracker, the scripted gestures, and the five sound
// controllers (today's Shepard voice and options 1–4 of hearf/OPTIONS.md). A controller turns probe frames into
// time-stamped commands for three sinks: 'eng' (the hf-engine worklet), 'voice' and 'drone' (timbres.js voices).
// The same code drives the page and the node measurement (hearf/tools/measure.js).
// =====================================================================================================================
const HFCore = (() => {
  const TAU = 2 * Math.PI;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const wrapPi = (a) => a - TAU * Math.round(a / TAU);

  // ---------------------------------------------------------------- the functions
  // f(x, y, o): o[0] + i o[1] = F(x + iy); d(x, y, o): F'. zeros / poles: [x, y, order]. view: centre and half-width.
  // deform: the still probe and the loop used by the deformation H_t = (1 − t) z + t F(z) (checked by tools/deform.js).
  function cdiv(a, b, c, d, o) { const q = c * c + d * d; o[0] = (a * c + b * d) / q; o[1] = (b * c - a * d) / q; return o; }
  const FUNCS = [
    { id: 'z2m1', label: 'z² − 1', f: (x, y, o) => { o[0] = x * x - y * y - 1; o[1] = 2 * x * y; return o; }, d: (x, y, o) => { o[0] = 2 * x; o[1] = 2 * y; return o; },
      zeros: [[1, 0, 1], [-1, 0, 1]], poles: [], view: [0, 0, 2], sweep: 'h',
      deform: { probe: [0.5, 0.03], loop: [1, 0, 0.5], note: 'the zero of H_t runs from 0 to 1 along the axis: under the probe at t ≈ 0.40, into the loop at the same moment' } },
    { id: 'mob', label: '(z − 1)/(z + 1)', f: (x, y, o) => cdiv(x - 1, y, x + 1, y, o), d: (x, y, o) => { const a = (x + 1) * (x + 1) - y * y, b = 2 * (x + 1) * y; return cdiv(2, 0, a, b, o); },
      zeros: [[1, 0, 1]], poles: [[-1, 0, 1]], view: [0, 0, 2], sweep: 'h',
      deform: { probe: [0.414, 0.03], loop: [1, 0, 0.5], note: 'the zero runs from 0 to 1: under the probe at t ≈ 0.50, into the loop at t ≈ 0.60' } },
    { id: 'exp', label: 'eᶻ', f: (x, y, o) => { const e = Math.exp(x); o[0] = e * Math.cos(y); o[1] = e * Math.sin(y); return o; }, d: (x, y, o) => { const e = Math.exp(x); o[0] = e * Math.cos(y); o[1] = e * Math.sin(y); return o; },
      zeros: [], poles: [], view: [0, 0, 4], sweep: 'v',
      deform: { probe: [-0.567, 0.06], loop: [-1.2, 0, 0.6], note: 'the zero of H_t starts at 0 and escapes to −∞ (eᶻ has none): under the probe at t ≈ 0.50, inside the loop from t ≈ 0.50 to 0.93' } },
    { id: 'z3', label: 'z³', f: (x, y, o) => { o[0] = x * x * x - 3 * x * y * y; o[1] = 3 * x * x * y - y * y * y; return o; }, d: (x, y, o) => { o[0] = 3 * (x * x - y * y); o[1] = 6 * x * y; return o; },
      zeros: [[0, 0, 3]], poles: [], view: [0, 0, 1.5], sweep: 'h',
      deform: { probe: [0.03, 0.816], loop: [0, 0, 0.6], note: 'two zeros come in from infinity along the imaginary axis: past the probe at t ≈ 0.60, into the loop together at t ≈ 0.74' } },
    { id: 'dz', label: 'z²/(z − 1)', f: (x, y, o) => cdiv(x * x - y * y, 2 * x * y, x - 1, y, o), d: (x, y, o) => { const a = x * x - y * y - 2 * x, b = 2 * x * y - 2 * y, c = (x - 1) * (x - 1) - y * y, e = 2 * (x - 1) * y; return cdiv(a, b, c, e, o); },
      zeros: [[0, 0, 2]], poles: [[1, 0, 1]], view: [0, 0, 2], sweep: 'h',
      deform: { probe: [0.5, 0.03], loop: [0, 0, 0.3], note: 'a zero leaves the pole at 1 and runs to 0: under the probe at t = 0.5, into the loop at t = 0.7' } },
    { id: 'sin', label: 'sin z', f: (x, y, o) => { o[0] = Math.sin(x) * Math.cosh(y); o[1] = Math.cos(x) * Math.sinh(y); return o; }, d: (x, y, o) => { o[0] = Math.cos(x) * Math.cosh(y); o[1] = -Math.sin(x) * Math.sinh(y); return o; },
      zeros: [[0, 0, 1], [Math.PI, 0, 1], [-Math.PI, 0, 1]], poles: [], view: [0, 0, 4], sweep: 'h',
      deform: { probe: [3.4, 0.04], loop: [Math.PI, 0, 0.5], note: 'zeros arrive from the right and left edges at t ≈ 0.84: past the probe at t ≈ 0.93, into the loop at t ≈ 0.88' } },
    // the principal square root: a branch point at 0 (order ½) and a cut on the negative real axis, where arg F jumps by
    // half a turn. The sweep crosses the cut; the loop around 0 gains half a turn per lap, then jumps back at the cut.
    { id: 'sqrt', label: '√z', cut: true,
      f: (x, y, o) => { const r = Math.hypot(x, y); o[0] = Math.sqrt(0.5 * (r + x)); o[1] = (y < 0 ? -1 : 1) * Math.sqrt(0.5 * (r - x)); return o; },
      d: (x, y, o) => { const r = Math.hypot(x, y), a = Math.sqrt(0.5 * (r + x)), b = (y < 0 ? -1 : 1) * Math.sqrt(0.5 * (r - x)); return cdiv(1, 0, 2 * a, 2 * b, o); },
      zeros: [[0, 0, 0.5]], poles: [], view: [0, 0, 2], sweep: 'vcut',
      deform: { probe: [-0.6, 0.03], loop: [0, 0, 0.5], note: 'the zero stays at 0 while the cut on the negative axis opens: the probe sits just above it, and from t > 0 the loop crosses the cut, so it has no winding number' } },
  ];
  const byId = Object.fromEntries(FUNCS.map((f) => [f.id, f]));
  // H_t (t == null: F itself)
  function ev(fn, t, x, y, o) { fn.f(x, y, o); if (t != null && t < 1) { o[0] = (1 - t) * x + t * o[0]; o[1] = (1 - t) * y + t * o[1]; } return o; }
  function evd(fn, t, x, y, o) { fn.d(x, y, o); if (t != null && t < 1) { o[0] = (1 - t) + t * o[0]; o[1] = t * o[1]; } return o; }

  // ---------------------------------------------------------------- the exact arg tracker
  // Δ arg along g(s), s ∈ [0, 1] (g writes H into o): bisect wherever a wrapped step exceeds 1/8 turn
  // A step that is still over 1/8 turn after 16 bisections is a jump (the app's Calc.argStep 'jump'): on this page's
  // functions, only √z's cut. trackSeg raises JUMP; the callers read it (and ignore it unless fn.cut).
  const tmp = [0, 0];
  let JUMP = false;
  function argAt(g, s) { g(s, tmp); const a = Math.atan2(tmp[1], tmp[0]); return Number.isFinite(a) && (tmp[0] !== 0 || tmp[1] !== 0) ? a : NaN; }
  function trackSeg(g, s0, s1, a0, a1, depth) {
    const d = wrapPi(a1 - a0);
    if (Math.abs(d) < Math.PI / 4) return d;
    if (depth >= 16) { JUMP = true; return d; }
    const sm = 0.5 * (s0 + s1), am = argAt(g, sm);
    if (Number.isNaN(am)) return d;
    return trackSeg(g, s0, sm, a0, am, depth + 1) + trackSeg(g, sm, s1, am, a1, depth + 1);
  }

  // ---------------------------------------------------------------- the probe: z (and t) → unwrapped arg, speed, rate
  class Probe {
    constructor() { this.reset(); }
    reset() { this.z = null; this.t = null; this.phi = 0; this.T = 0; this.ln = 0; this.v = [0, 0]; this.speed = 0; this.rate = 0; this.dphi = 0; this.first = true; this.jump = false; }
    // fn, position, deformation t (or null), time T (s), pixels per unit. jump: arg F jumped on this step (a cut); the
    // jump is kept in phi (as the app does: the voice glides it in 12 ms) but is not turning, so it sets no rate
    move(fn, x, y, t, T, ppu) {
      const o = ev(fn, t, x, y, [0, 0]); const a = Math.atan2(o[1], o[0]), m = Math.hypot(o[0], o[1]);
      this.v = o; this.ln = Math.log(m); this.jump = false;
      if (this.z === null || !Number.isFinite(a)) { this.z = [x, y]; this.t = t; this.phi = a / TAU; this.T = T; this.dphi = 0; this.speed = 0; this.rate = 0; this.first = true; return this; }
      const [x0, y0] = this.z, t0 = this.t, dt = Math.max(1e-3, T - this.T);
      const g = (s, oo) => ev(fn, t0 == null ? t : t0 + s * (t - t0), x0 + s * (x - x0), y0 + s * (y - y0), oo);
      JUMP = false;
      const a0 = argAt(g, 0), d = Number.isNaN(a0) ? wrapPi(a - this.phi * TAU) : trackSeg(g, 0, 1, a0, a, 0);
      this.jump = JUMP && !!fn.cut;
      this.dphi = d / TAU; this.phi += this.dphi;
      this.speed = Math.hypot(x - x0, y - y0) * ppu / dt; this.rate = this.jump ? 0 : Math.abs(this.dphi) / dt;
      this.z = [x, y]; this.t = t; this.T = T; this.first = false;
      return this;
    }
  }

  // ---------------------------------------------------------------- closed curves: exact W and the phase spectrum
  // pts: [[x, y], …] (closed implicitly), resampled to M points evenly in arc length
  function resample(pts, M) {
    const n = pts.length, L = [0];
    for (let i = 1; i <= n; i++) { const a = pts[i - 1], b = pts[i % n]; L.push(L[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1])); }
    const tot = L[n], out = []; if (tot <= 0) return null;
    let j = 0;
    for (let k = 0; k < M; k++) {
      const s = tot * k / M; while (j < n - 1 && L[j + 1] < s) j++;
      const a = pts[j], b = pts[(j + 1) % n], u = (s - L[j]) / Math.max(1e-12, L[j + 1] - L[j]);
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
    return { pts: out, len: tot };
  }
  // the phase signal e^{2πi φ(s)} on M arc-length samples, its DFT b_k (k = −8 … 20) and the exact winding number W.
  // Played compressed (hfmath-3): φ̃(s) = W s + λ (φ(s) − W s), λ the largest ≤ 1 with RMS(φ − W s) λ ≤ 0.12 turn. The
  // mean of φ̃′ is still W, so the spectral centre Σ k|b_k|² stays exactly W; the spread shrinks, so W is also the
  // strongest harmonic: the note you hear. ok is false (and the caller holds its last sound) when the curve passes
  // within a pixel of a zero or pole (Newton distance |H/H′|), or jumps (a cut): there W is undefined.
  function curveSpectrum(fn, t, pts, M, ppu) {
    const r = resample(pts, M); if (!r) return null;
    const P = r.pts, re = new Float64Array(M), im = new Float64Array(M), ph = new Float64Array(M), o = [0, 0], od = [0, 0];
    let W = 0, a0 = null, aPrev = 0, bad = false, near = Infinity;
    JUMP = false;
    for (let j = 0; j < M; j++) {
      ev(fn, t, P[j][0], P[j][1], o); const m = Math.hypot(o[0], o[1]);
      if (!(m > 0) || !Number.isFinite(m)) { bad = true; re[j] = 0; im[j] = 0; continue; }
      re[j] = o[0] / m; im[j] = o[1] / m;
      if (ppu) { evd(fn, t, P[j][0], P[j][1], od); const dm = Math.hypot(od[0], od[1]); if (dm > 0 && Number.isFinite(dm)) near = Math.min(near, m / dm * ppu); }
      const a = Math.atan2(o[1], o[0]);
      if (j === 0) { a0 = a; aPrev = a; continue; }
      const p = P[j - 1], q = P[j], g = (s, oo) => ev(fn, t, p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1]), oo);
      W += trackSeg(g, 0, 1, aPrev, a, 0); aPrev = a; ph[j] = W / TAU;
    }
    if (a0 !== null) { const p = P[M - 1], q = P[0], g = (s, oo) => ev(fn, t, p[0] + s * (q[0] - p[0]), p[1] + s * (q[1] - p[1]), oo); W += trackSeg(g, 0, 1, aPrev, a0, 0); }
    const jump = JUMP && !!fn.cut;
    const Wn = W / TAU, Wi = Math.round(Wn), ok = !bad && !jump && Math.abs(Wn - Wi) < 0.05 && near >= 1;
    let lam = 1;
    if (ok) {
      let mu = 0, e = 0; for (let j = 0; j < M; j++) mu += ph[j] - Wi * j / M; mu /= M;
      for (let j = 0; j < M; j++) { const dv = ph[j] - Wi * j / M - mu; e += dv * dv; }
      const rms = Math.sqrt(e / M); lam = rms > 0.12 ? 0.12 / rms : 1;
      if (lam < 1) for (let j = 0; j < M; j++) { const p = (a0 / TAU) + Wi * j / M + lam * (ph[j] - Wi * j / M - mu); re[j] = Math.cos(TAU * p); im[j] = Math.sin(TAU * p); }
    }
    const b = {};
    for (let k = -8; k <= 20; k++) {
      let sr = 0, si = 0;
      for (let j = 0; j < M; j++) { const th = -TAU * k * j / M, c = Math.cos(th), s = Math.sin(th); sr += re[j] * c - im[j] * s; si += re[j] * s + im[j] * c; }
      b[k] = Math.hypot(sr, si) / M;
    }
    return { b, W: Wi, Wraw: Wn, ok, lam, jump, near, len: r.len };
  }
  // the ring: F on a circle of radius r around (x, y), raw (unit RMS), coefficients c_k, and the ring's own exact
  // winding number W (zeros − poles inside, by the argument principle; ok false at a cut or a zero on the ring)
  function ringSpectrum(fn, t, x, y, r) {
    let M = 64; const o = [0, 0];
    const sample = (M) => { const re = new Float64Array(M), im = new Float64Array(M), mg = new Float64Array(M);
      for (let j = 0; j < M; j++) { const th = TAU * j / M; ev(fn, t, x + r * Math.cos(th), y + r * Math.sin(th), o); re[j] = o[0]; im[j] = o[1]; mg[j] = Math.hypot(o[0], o[1]); }
      return { re, im, mg }; };
    let S = sample(M);
    const med = (a) => { const s = Array.from(a).filter(Number.isFinite).sort((p, q) => p - q); return s.length ? s[s.length >> 1] : NaN; };
    let md = med(S.mg), mx = Math.max(...Array.from(S.mg).filter(Number.isFinite));
    if (mx > 8 * md) { M = 128; S = sample(M); md = med(S.mg); }
    if (!(md > 0) || !Number.isFinite(md)) return null;
    const cap = 30 * md; let e = 0;
    for (let j = 0; j < M; j++) { let m = S.mg[j]; if (!Number.isFinite(m)) { S.re[j] = cap; S.im[j] = 0; m = cap; } if (m > cap) { S.re[j] *= cap / m; S.im[j] *= cap / m; } e += S.re[j] * S.re[j] + S.im[j] * S.im[j]; }
    const nrm = 1 / Math.sqrt(e / M);
    const c = {};
    for (let k = -M / 2; k < M / 2; k++) {
      let sr = 0, si = 0;
      for (let j = 0; j < M; j++) { const th = -TAU * k * j / M, cc = Math.cos(th), s = Math.sin(th); sr += S.re[j] * cc - S.im[j] * s; si += S.re[j] * s + S.im[j] * cc; }
      c[k] = Math.hypot(sr, si) * nrm / M;
    }
    // the ring's winding number, tracked exactly around the M samples
    JUMP = false; let Wa = 0, bad = false;
    const angle = (j) => Math.atan2(S.im[j], S.re[j]);
    for (let j = 0; j < M; j++) {
      const j1 = (j + 1) % M; if (!Number.isFinite(S.mg[j]) || !(S.mg[j] > 0)) { bad = true; break; }
      const th0 = TAU * j / M, dth = TAU / M, g = (s, oo) => ev(fn, t, x + r * Math.cos(th0 + s * dth), y + r * Math.sin(th0 + s * dth), oo);
      Wa += trackSeg(g, 0, 1, angle(j), angle(j1), 0);
    }
    const Wn = Wa / TAU, W = Math.round(Wn);
    return { c, M, W, ok: !bad && !(JUMP && fn.cut) && Math.abs(Wn - W) < 0.05 };
  }
  // coefficients → the singer's harmonic amplitudes: harmonic n = 4 + k, Lanczos taper above 12 (or 6 away from
  // `centre`). Coefficients below the scale (n ≤ 0) are dropped, not folded onto D3 (hfmath-7: that made a false
  // "triple pole")
  const NH = 24;
  function toAmps(coef, kmin, kmax, opts = {}) {
    const A = new Array(NH).fill(0);
    for (let k = kmin; k <= kmax; k++) {
      const v = coef[k] || 0, n = 4 + k;
      if (n <= 0 || n > NH) continue;
      let w = 1;
      if (opts.centre != null) { const d = Math.abs(k - opts.centre) - 6; if (d > 0) w = sinc(d / 7); }
      else if (n > 12) w = sinc((n - 12) / 13);
      A[n - 1] = v * w;
    }
    return A;
  }
  // option 3's spectrum (hfmath-4): the note is harmonic 4 + W(ring), exact by the argument principle; the Taylor/Laurent
  // coefficients only colour it, each capped under the note (rich −5 dB, light −12 dB and halved), so a zero or pole
  // outside the ring never sounds like one inside. The note's neighbours are at least −14 dB, so the whistle is a
  // resonance on the voice, not a lone partial (snd-1). Unit energy (Σ A² = 1), so the colour setting does not change
  // the loudness (snd-5).
  function ringAmps(sp, light) {
    const W = sp.ok ? clamp(sp.W, -3, NH - 4) : 0, n0 = 4 + W, c = sp.c, cw = Math.max(c[W] || 0, 1e-9);
    const cap = light ? 0.25 : 0.56, sc = light ? 0.5 : 1, A = new Array(NH).fill(0);
    for (let k = -3; k < sp.M / 2; k++) {
      const n = 4 + k; if (n < 1 || n > NH || k === W) continue;
      const w = n > 12 ? sinc((n - 12) / 13) : 1;
      A[n - 1] = Math.min(cap, sc * (c[k] || 0) / cw) * w;
    }
    A[n0 - 1] = 1;
    if (n0 > 1) A[n0 - 2] = Math.max(A[n0 - 2], 0.2);
    if (n0 < NH) A[n0] = Math.max(A[n0], 0.2);
    let e = 0; for (const a of A) e += a * a; const s = 1 / Math.sqrt(e); for (let i = 0; i < NH; i++) A[i] *= s;
    return { A, W, n0, ok: sp.ok };
  }
  // the low notes lose most of their level on a phone or laptop speaker (snd-3): +2, +3, +4 dB for harmonics 3, 2, 1
  // (half of the review's +4/+6/+8: the vowel hum and the note's skirt already carry them through harmonics 2–6, and
  // more would make poles 4–6 dB louder than zeros on headphones)
  const LOWMK = [1, Math.pow(10, 4 / 20), Math.pow(10, 3 / 20), Math.pow(10, 2 / 20)];
  const lowMake = (n0) => (n0 >= 1 && n0 <= 3 ? LOWMK[n0] : 1);
  function sinc(x) { if (x === 0) return 1; const p = Math.PI * x; return Math.max(0, Math.sin(p) / p); }
  const NOTE_OF_H = { 1: 'D3', 2: 'D4', 3: 'A4', 4: 'D5', 5: 'F♯5', 6: 'A5', 7: 'C6', 8: 'D6', 9: 'E6', 10: 'F♯6', 11: 'G♯6', 12: 'A6' };
  const INTERVAL_OF_H = { 1: 'two octaves down', 2: 'an octave down', 3: 'a fourth down', 4: 'home', 5: 'a major third up', 6: 'a fifth up', 7: 'a “blue” seventh up', 8: 'an octave up' };

  // ---------------------------------------------------------------- palette B's cues (v2/board/engine_b.js), main-thread part
  function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let R = prng(7);
  const rnd = (a, b) => a + (b - a) * R();
  const vdb = (db) => Math.pow(10, rnd(-db, db) / 20);
  const cents = (c) => Math.pow(2, c / 1200);
  const seed32 = () => (R() * 4294967296) >>> 0;
  const FS = 48000;
  const D4 = 293.665, st = (n) => D4 * Math.pow(2, n / 12);
  const MAT = {
    wood: { r: [1, 3.93, 9.2], a: [1, 0.22, 0.06], d: [1, 0.32, 0.12], b: [0, 0, 0], knock: 0.10, kf: 1800 },
    glass: { r: [1, 2.32, 4.25, 6.63], a: [1, 0.34, 0.14, 0.05], d: [1, 0.55, 0.30, 0.17], b: [0.8, 1.6, 2.5, 3.1], knock: 0.025, kf: 4000 },
    skin: { r: [1, 1.593, 2.136, 2.296], a: [1, 0.45, 0.25, 0.18], d: [1, 0.6, 0.45, 0.4], b: [0, 0, 0, 0], knock: 0.22, kf: 1500 },
  };
  const mallet = (f, tau) => 1 / (1 + Math.pow(2 * f * tau, 2));
  const tauOf = (vel, soft) => soft * Math.pow(clamp(vel, 0.05, 1), -0.2) * 0.001;
  function strike(P, d, f0, mat, o) {
    const M = MAT[mat], vel = clamp((o.vel == null ? 0.7 : o.vel) * rnd(0.92, 1.08), 0.05, 1), tau = tauOf(vel, o.soft || 1.2);
    const dt = o.detune == null ? 3 : o.detune, f = f0 * cents(rnd(-dt, dt));
    const g = (o.amp || 0.1) * vel * vdb(o.var == null ? 1 : o.var), t60 = (o.t60 || 0.3) * rnd(0.88, 1.12), w0 = mallet(f, tau);
    for (let j = 0; j < M.r.length; j++) {
      const fj = f * M.r[j]; if (fj >= 0.45 * FS) continue;
      const aj = g * M.a[j] * mallet(fj, tau) / w0 * (j ? vdb(1.5) : 1), tj = t60 * M.d[j];
      if (M.b[j]) { const bb = M.b[j] * rnd(0.8, 1.25), ph = R(), r2 = rnd(0.3, 0.6);
        P.push({ k: 'm', d, f: fj - bb / 2, a: aj * (1 - r2), t60: tj, tau, ph, drop: o.drop });
        P.push({ k: 'm', d, f: fj + bb / 2, a: aj * r2, t60: tj * 0.9, tau, ph, drop: o.drop });
      } else P.push({ k: 'm', d, f: fj, a: aj, t60: tj, tau, ph: 0, drop: o.drop });
    }
    if (M.knock) P.push({ k: 'n', d, dur: Math.max(0.002, 2.5 * tau), fc: Math.min(M.kf * (0.6 + 0.8 * vel), 6000), a: g * M.knock * (o.knock == null ? 1 : o.knock), seed: seed32() });
  }
  // a plucked string as modes (the spectrum a Karplus–Strong string settles into): harmonics 1–8, slightly stretched,
  // low-passed by `bright`, the upper ones shorter, a 0.4 ms ring-in and a 2 ms contact noise
  // o.dark (the harp, snd-7): a gut/nylon string rather than steel: harmonics fall as 1/n, the low-pass at most
  // min(4 kHz, 3 f0), nothing above 5 kHz, the contact noise at most 3 kHz
  function pluck(P, d, f0, o) {
    const f = f0 * cents(rnd(-3, 3)), g = (o.amp || 0.1) * vdb(o.dark ? 1.0 : 1.5), t60 = o.t60 || 0.4;
    let fcut = -Math.log(1 - clamp(o.bright == null ? 0.5 : o.bright, 0.05, 0.95)) * FS / TAU;
    if (o.dark) fcut = Math.min(fcut, 4000, 3 * f0);
    const hs = []; let norm = 0;
    for (let n = 1; n <= 8; n++) { const fn = f * n * (1 + 0.0008 * n * n); if (fn > (o.dark ? 5000 : 0.45 * FS)) break; const a = 1 / Math.sqrt(1 + Math.pow(fn / fcut, 2)) / (o.dark ? n : Math.sqrt(n)); hs.push([fn, a, t60 / (1 + 0.35 * (n - 1))]); norm += a; }
    for (const [fn, a, tj] of hs) P.push({ k: 'm', d, f: fn, a: 1.6 * g * a / norm, t60: tj * rnd(0.9, 1.1), tau: 0.0004, ph: R() });
    P.push({ k: 'n', d, dur: 0.002, fc: Math.min(2 * fcut, o.dark ? 3000 : 6000), a: 0.1 * g, seed: seed32() });
  }
  const TRIM = { zero: -0.35, pole: 0.1, cut: 3.99, turn: -0.43, zeroWood: 0 };   // cut: B's −3.25, re-measured here (tools/calib.js)
  const CUE = {
    zero: { wet: 0.2, make: (P, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.11; for (let j = 0; j < m; j++) strike(P, sp * j, st(24), 'glass', { vel: 0.6 * (j ? 0.75 : 1), soft: 0.8, t60: 0.55, amp: 0.21, detune: 2 }); } },
    // the glass harp's zero ping (snd-6): the same D6 in wood, so it is not one more glass D among the harp's
    zeroWood: { wet: 0.16, make: (P, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.11; for (let j = 0; j < m; j++) strike(P, sp * j, st(24), 'wood', { vel: 0.6 * (j ? 0.75 : 1), soft: 1.0, t60: 0.22, amp: 0.3, detune: 2 }); } },
    // palette B's branch-cut tick (v2/board/engine_b.js): a double tick stepping down, F♯6 then D6
    cut: { wet: 0.08, make: (P) => { pluck(P, 0, st(28), { t60: 0.09, bright: 0.22, amp: 0.16 }); pluck(P, 0.035, st(24), { t60: 0.12, bright: 0.18, amp: 0.16 }); } },
    pole: { wet: 0.14, make: (P, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.12, v = 0.7; for (let j = 0; j < m; j++) { strike(P, sp * j, st(7), 'skin', { vel: v * (j ? 0.75 : 1), soft: 1.6, t60: 0.16, amp: 0.36, drop: 1.5, knock: 3.5 }); strike(P, sp * j, st(-5), 'skin', { vel: v * (j ? 0.75 : 1), soft: 2.4, t60: 0.2, amp: 0.06, drop: 1.5, knock: 0 }); strike(P, sp * j, st(19), 'wood', { vel: v * (j ? 0.75 : 1), soft: 1.4, t60: 0.07, amp: 0.13, drop: 1, detune: 2 }); } } },
    turn: { wet: 0.2, make: (P, o) => { let f = 36.7081 * Math.pow(2, ((o.pc || 0) % 1 + 1) % 1); while (f < 1700) f *= 2; const up = (o.dir || 1) > 0; strike(P, 0, up ? f * 2 / 3 : f * 4 / 3, 'glass', { vel: 0.35, soft: 0.8, t60: 0.14, amp: 0.12, detune: 0 }); strike(P, 0.045, f, 'glass', { vel: 0.7, soft: 0.7, t60: 0.6, amp: 0.15, detune: 0 }); } },
  };
  // one shared factor for the cues here (this page has no tier graph)
  const CUE_GAIN = 0.9;   // → zero −31.0, pole −30.5, turn −30.1 LUFS-M (palette B's events: −31)
  function cue(name, at, o = {}) {
    const c = CUE[name], P = []; c.make(P, o);
    return { k: 'cue', at, parts: P, wet: c.wet, pan: o.pan || 0, gain: CUE_GAIN * Math.pow(10, (TRIM[name] || 0) / 20) };
  }

  // ---------------------------------------------------------------- level constants (calibrated: tools/measure.js)
  const LV = {
    harp: 0.0918,    // one harp note at velocity 0.7, |F| = 1 → −32 LUFS-M (the darker gut string of snd-7)
    glass: 0.091,    // the glass variant, the same
    hv: 0.83,        // the singer (unit-energy spectrum over the vowel hum) → −32 LUFS-M; the curve's release note is +1 dB
  };

  // the Shepard plan of src/sound.js / timbres.js (ShepardVoice.set): the chroma slews to the unwrapped arg, whole turns
  // beyond one are dropped (≤ about 3 turns a second), a half turn takes 0.15 s more than the frame
  function ShPlan() {
    let segs = [], sEnd = null, off = 0, last = -1;
    const at = (t) => { for (let i = segs.length - 1; i >= 0; i--) { const g = segs[i]; if (t >= g.t0) return t >= g.t1 || g.t1 <= g.t0 ? g.s1 : g.s0 + (g.s1 - g.s0) * (t - g.t0) / (g.t1 - g.t0); } return segs.length ? segs[0].s0 : sEnd; };
    return {
      set(ph, t, jump) {
        const dt = last < 0 ? 0.02 : clamp(t - last, 0.008, 0.05); last = t;
        if (sEnd === null) { off = Math.floor(ph); const f = ph - off; segs = [{ t0: t, t1: t, s0: f, s1: f }]; sEnd = f; return { snap: f }; }
        const cur = at(t); let back = ph - off - cur;
        if (Math.abs(back) > 1) { const w = Math.sign(back) * (Math.ceil(Math.abs(back)) - 1); off += w; back -= w; }
        // a jump (a cut) as a 12 ms glide, as the app's voice does
        const dur = jump ? 0.012 : dt + 0.3 * Math.abs(back), s1 = cur + back, s0 = sEnd;
        segs = segs.filter((g) => g.t1 > t - 0.5 && g.t0 < t); segs.push({ t0: t, t1: t + dur, s0: cur, s1 }); sEnd = s1;
        return { ds: s1 - s0, dur };
      },
      reset() { segs = []; sEnd = null; last = -1; },
    };
  }
  const lnc = (x) => (Number.isFinite(x) ? x : x > 0 ? 50 : -50);
  const shCentre = (ln) => 4.1 + 0.3 * Math.tanh(lnc(ln) / 2.5);
  const shLoud = (ln) => 0.6 + 0.4 / (1 + Math.exp(-1.3 * (lnc(ln) + 1)));

  // a Schmitt trigger on the integer crossings of the unwrapped arg (the turn bell): fires once per crossing of n
  class Turns {
    constructor(h = 1 / 96) { this.h = h; this.n = null; }
    reset() { this.n = null; }
    step(phi) {   // returns [{n, dir}]
      const out = [];
      if (this.n === null) { this.n = Math.floor(phi); return out; }
      while (phi > this.n + 1 + this.h) { this.n++; out.push({ n: this.n, dir: 1 }); }
      while (phi < this.n - this.h) { out.push({ n: this.n, dir: -1 }); this.n--; }
      return out;
    }
  }
  // proximity to zeros and poles (8 px in, re-armed beyond 16 px). Static: the listed ones. Deformation (t < 1): the
  // poles of F stay (t > 0); the zeros of H_t move, so a zero is "near" when the Newton distance |H / H′| < 8 px
  class Near {
    constructor() { this.armed = new Map(); this.inside = false; }
    reset() { this.armed.clear(); this.inside = false; }
    step(fn, x, y, t, ppu) {
      const ev_ = []; let inside = false;
      const check = (key, d, kind, m) => {
        const px = d * ppu; if (px < 8) inside = true;
        const was = this.armed.get(key);
        if (px < 8 && was !== false) { this.armed.set(key, false); ev_.push({ kind, m }); }
        else if (px > 16 && was === false) this.armed.set(key, true);
      };
      if (t == null || t >= 1) for (const [a, b, m] of fn.zeros) check('z' + a + ',' + b, Math.hypot(x - a, y - b), 'zero', m);
      else if (t > 0) { const o = ev(fn, t, x, y, [0, 0]), d = evd(fn, t, x, y, [0, 0]); check('zn', Math.hypot(o[0], o[1]) / Math.max(1e-12, Math.hypot(d[0], d[1])), 'zero', 1); }
      else check('z0', Math.hypot(x, y), 'zero', 1);
      if (t == null || t > 0) for (const [a, b, m] of fn.poles) check('p' + a + ',' + b, Math.hypot(x - a, y - b), 'pole', m);
      this.inside = inside;
      return ev_;
    }
  }

  // ---------------------------------------------------------------- the gestures (the same for every option)
  // Each: dur (s) and at(u) → {x, y, t (deformation) | null, pen}. The pen is down for the loops and the sweep
  // (option 4 hears the stroke); the deformation holds the probe still and runs t from 0 to 1.
  // 'zero': a simple zero (or √z's branch point), never a multiple one, so the two loop buttons never play the same
  // loop under different words (hfmath-2); 'dzero': a zero of order ≥ 2
  function target(fn, kind) {
    if (kind === 'pole') return fn.poles[0] || null;
    if (kind === 'dzero') return fn.zeros.find((z) => z[2] >= 2) || null;
    return fn.zeros.find((z) => z[2] === 1) || fn.zeros.find((z) => z[2] < 1) || null;
  }
  // the visit: a zero (simple if there is one), then a pole, or else another zero
  function visitTargets(fn) {
    const a = fn.zeros.find((z) => z[2] === 1) || fn.zeros[0]; if (!a) return [];
    const b = fn.poles[0] || fn.zeros.find((z) => z !== a);
    return b ? [a, b] : [a];
  }
  const ORD = ['', 'simple', 'double', 'triple'];
  const pointName = (p, pole) => (p[2] < 1 ? 'branch point' : (p[2] > 1 ? ORD[p[2]] + ' ' : '') + (pole ? 'pole' : 'zero'));
  const smooth = (x) => x * x * (3 - 2 * x);
  function gesture(fn, kind) {
    const [cx, cy, hw] = fn.view;
    if (kind === 'sweep') {
      const dur = 6;
      // eᶻ: a diagonal, so arg F = Im z climbs a turn while |F| = e^{Re z} grows from e^−3.6 to e^3.6 (hfmath-8: growth)
      if (fn.sweep === 'v') return { kind, dur, caption: 'a slow diagonal sweep from ' + fmtZ(cx - 0.9 * hw, cy - 0.9 * hw) + ' to ' + fmtZ(cx + 0.9 * hw, cy + 0.9 * hw) + ': arg F = Im z climbs about a turn while |F| = e^{Re z} grows from e^−3.6 to e^3.6', at: (u) => ({ x: cx - 0.9 * hw + 1.8 * hw * u / dur, y: cy - 0.9 * hw + 1.8 * hw * u / dur, t: null, pen: true }) };
      // √z: a vertical line across the cut on the negative axis
      if (fn.sweep === 'vcut') { const x = cx - 0.4 * hw; return { kind, dur, caption: 'a slow sweep down the line Re z = ' + fmtZ(x, 0) + ', across the cut on the negative axis', at: (u) => ({ x, y: cy + 0.9 * hw - 1.8 * hw * u / dur, t: null, pen: true }) }; }
      // 0.03 of the half-width (6 px on a laptop, 5 on a phone) above the axis: inside the 8 px ping radius and close
      // enough for option 3's ring to hold each zero (hfmath-5, hfmath-9)
      const y = cy + 0.03 * hw; return { kind, dur, caption: 'a slow sweep along Im z = ' + (0.03 * hw).toFixed(2) + ', just above the zeros and poles', at: (u) => ({ x: cx - 0.9 * hw + 1.8 * hw * u / dur, y, t: null, pen: true }) };
    }
    if (kind === 'visit') {
      // glide in, rest beside the point (0.03 of the half-width away, with the 1 px tremor of a resting hand, so the
      // options that fall silent when you stop keep sounding), glide on, rest, glide out (snd-2)
      const tg = visitTargets(fn); if (!tg.length) return null;
      const o = 0.03 * hw, wob = 0.006 * hw, near = (p) => [p[0] + o * Math.cos(1.05), p[1] + o * Math.sin(1.05)];
      const R1 = near(tg[0]), P0 = [tg[0][0] + 0.5 * hw * Math.cos(2.2), tg[0][1] + 0.5 * hw * Math.sin(2.2)];
      const ph = [{ k: 'g', a: P0, b: R1, d: 1.2 }, { k: 'r', p: R1, d: 1.3 }];
      if (tg[1]) { const R2 = near(tg[1]); ph.push({ k: 'g', a: R1, b: R2, d: 1.6 }, { k: 'r', p: R2, d: 1.3 }, { k: 'g', a: R2, b: [tg[1][0] + 0.5 * hw * Math.cos(0.9), tg[1][1] + 0.5 * hw * Math.sin(0.9)], d: 0.9 }); }
      else ph.push({ k: 'g', a: R1, b: [tg[0][0] + 0.5 * hw * Math.cos(0.9), tg[0][1] + 0.5 * hw * Math.sin(0.9)], d: 1.0 });
      const dur = ph.reduce((s, p) => s + p.d, 0);
      const names = tg.map((p) => pointName(p, fn.poles.includes(p)) + ' at ' + fmtZ(p[0], p[1]));
      return { kind, dur, targets: tg, caption: 'glide to the ' + names[0] + ', rest a second beside it' + (tg[1] ? ', glide to the ' + names[1] + ', rest, glide away' : ', glide away'),
        at: (u) => { let s = clamp(u, 0, dur);
          for (const p of ph) { if (s <= p.d || p === ph[ph.length - 1]) { const v = clamp(s / p.d, 0, 1);
            if (p.k === 'g') { const w = smooth(v); return { x: p.a[0] + (p.b[0] - p.a[0]) * w, y: p.a[1] + (p.b[1] - p.a[1]) * w, t: null, pen: true }; }
            const th = TAU * 2 * s; return { x: p.p[0] + wob * (Math.cos(th) - 1), y: p.p[1] + wob * Math.sin(th), t: null, pen: true }; }
            s -= p.d; }
          return null; } };
    }
    if (kind === 'zero' || kind === 'pole' || kind === 'dzero') {
      const tg = target(fn, kind); if (!tg) return null;
      const r = 0.3 * hw, dur = 4, laps = 2;
      const what = pointName(tg, kind === 'pole');
      return { kind, dur, centre: tg, r, laps, caption: 'two laps around the ' + what + ' at ' + fmtZ(tg[0], tg[1]) + ', counter-clockwise, 2 s a lap',
        // starting at 25°, not on the real axis: there these real functions have arg F = 0 exactly, on the harp's D line,
        // where the Schmitt trigger cannot count the first crossing (OPTIONS §3)
        at: (u) => { const a = 0.4363 + TAU * laps * u / dur; return { x: tg[0] + r * Math.cos(a), y: tg[1] + r * Math.sin(a), t: null, pen: true }; } };
    }
    if (kind === 'deform') {
      const D = fn.deform, dur = 5;
      return { kind, dur, loop: D.loop, probe: D.probe, caption: 'H_t = (1 − t) z + t F(z), t from 0 to 1 in 5 s; the probe holds still at ' + fmtZ(D.probe[0], D.probe[1]) + (D.note ? '. ' + D.note : ''),
        at: (u) => ({ x: D.probe[0], y: D.probe[1], t: clamp(u / dur, 0, 1), pen: false }) };
    }
    if (kind === 'view') {
      const dur = 4, rmax = Math.SQRT2 * hw;
      return { kind, dur, caption: 'a circle grows from the centre of the view to its corners in 4 s', grow: true,
        at: (u) => ({ x: cx, y: cy, t: null, pen: false, r: Math.max(0.01 * hw, rmax * clamp(u / dur, 0, 1)) }) };
    }
    return null;
  }
  const fmtZ = (x, y) => { const r = (v) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : Math.abs(v - Math.PI) < 1e-9 ? 'π' : Math.abs(v + Math.PI) < 1e-9 ? '−π' : v.toFixed(2)).replace('-', '−');
    if (Math.abs(y) < 1e-12) return r(x); if (Math.abs(x) < 1e-12) return r(y) + 'i'; return r(x) + (y < 0 ? ' − ' : ' + ') + r(Math.abs(y)) + 'i'; };

  // ---------------------------------------------------------------- the controllers
  // out: {eng(cmd), voice(cmd), drone(cmd)}; every command carries its time `at` (the context's clock)
  // frame fr: {fn, x, y, t, T (time of this frame, s), ppu, pen, stroke, probe (Probe), near (events), nearInside}

  // activity (OPTIONS §2): max(pointer speed / 300 px s⁻¹, |Δ arg| rate / 0.5 turn s⁻¹), clamped, smoothed (τ 60 ms)
  class Activity {
    constructor() { this.a = 0; this.T = null; this.lastActive = -1; }
    reset() { this.a = 0; this.T = null; this.lastActive = -1; }
    step(pr, T) {
      const raw = pr.first ? 0 : clamp(Math.max(pr.speed / 300, pr.rate / 0.5), 0, 1), dt = this.T == null ? 0.016 : Math.max(0.001, T - this.T);
      this.T = T; this.a += (raw - this.a) * (1 - Math.exp(-dt / 0.06));
      if (raw > 0.02) this.lastActive = T;
      return this.a;
    }
  }
  // the zero and pole pings, and the cut tick (at most one per 120 ms, as palette B's gap). zeroAs: the glass harp's
  // wood zero ping
  const pings = (out, fr, T, zeroAs) => {
    for (const e of fr.near || []) out.eng(cue(e.kind === 'zero' && zeroAs ? zeroAs : e.kind, T, { order: e.m }));
    if (fr.cut) out.eng(cue('cut', T));
  };

  // Today: the app's Shepard voice (9 sines), held 1.6 s after the last motion, the turn bell, the pings
  class Today {
    constructor(out) { this.out = out; this.plan = ShPlan(); this.turns = new Turns(); this.on = false; this.lastMove = -1; this.vol = 1; this.info = ''; }
    begin() { this.plan.reset(); this.turns.reset(); this.on = false; }
    frame(fr) {
      const pr = fr.probe, T = fr.T, o = this.out;
      const moving = !pr.first && (pr.speed > 2 || pr.rate > 0.01);
      if (moving || pr.first) this.lastMove = T;
      const p = this.plan.set(pr.phi, T, pr.jump);
      o.eng(Object.assign({ k: 'sh', at: T, cc: shCentre(pr.ln), loud: shLoud(pr.ln) * this.vol }, p));
      if (!this.on && (moving || pr.first)) { o.eng({ k: 'sh', at: T, gate: 1, tau: 0.02 }); this.on = true; }
      if (this.on && T - this.lastMove > 1.6) { o.eng({ k: 'sh', at: T, gate: 0, tau: 0.35 }); this.on = false; }
      if (pr.jump) this.turns.reset();   // a jump at a cut is not a turn: no bell
      for (const c of this.turns.step(pr.phi)) o.eng(cue('turn', T, { pc: 0, dir: c.dir }));
      pings(o, fr, T);
      const pc = ((pr.phi % 1) + 1) % 1;
      this.info = 'arg F = ' + (Math.round(pc * 360) % 360) + '°  ·  pitch class ' + pcName(pc) + '  ·  |F| = ' + fmtAbs(pr.ln);
    }
    end(T) { if (this.on) this.out.eng({ k: 'sh', at: T, gate: 0, tau: 0.35 }); this.on = false; this.plan.reset(); this.turns.reset(); }
    stop(T) { this.out.eng({ k: 'sh', at: T, gate: 0, tau: 0.02 }); this.on = false; this.plan.reset(); this.turns.reset(); }
  }
  const PCN = ['D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B', 'C', 'C♯'];
  const pcName = (pc) => PCN[Math.round(pc * 12) % 12];
  const fmtAbs = (ln) => { const m = Math.exp(ln); return !Number.isFinite(m) ? '∞' : m >= 100 || m < 0.01 ? m.toExponential(1) : m.toFixed(m < 1 ? 3 : 2); };

  // Option 1: the sung point. arg F as the pitch class (today's mapping) on a timbres.js instrument, bowed by activity,
  // over a drone on D (15 dB under); the turn bell and the pings stay. |F| sets the register only.
  class Sung {
    constructor(out, o = {}) { this.out = out; this.drone = o.drone !== false; this.plan = ShPlan(); this.turns = new Turns(); this.act = new Activity(); this.on = false; this.vol = 1; this.info = ''; this.dcc = null; this.dvol = null; }
    begin(T) { this.plan.reset(); this.turns.reset(); this.act.reset(); this.on = false; this.dcc = null; this.dvol = this.vol; this.out.drone({ at: T, snap: 0, cc: 4.1, loud: 0.178 * this.vol, pan: 0 }); }
    frame(fr) {
      const pr = fr.probe, T = fr.T, o = this.out, a = this.act.step(pr, T);
      const cc = shCentre(pr.ln), loud = (0.55 + 0.45 * Math.sqrt(a)) * this.vol;
      const p = this.plan.set(pr.phi, T, pr.jump);
      o.voice(Object.assign({ at: T, cc, loud, pan: 0 }, p));
      // the drone follows the register, and the volume slider while a tone is held (snd-10)
      if (this.drone && (this.dcc === null || Math.abs(cc - this.dcc) > 0.01 || this.dvol !== this.vol)) { o.drone({ at: T, cc, loud: 0.178 * this.vol }); this.dcc = cc; this.dvol = this.vol; }
      if (!this.on && a > 0.02 && !pr.first) { o.voice({ at: T, gate: 1, tau: 0.04 }); if (this.drone) o.drone({ at: T, gate: 1, tau: 0.08 }); this.on = true; }
      if (this.on && T - this.act.lastActive > 0.12) this.release(T);
      if (pr.jump) this.turns.reset();
      for (const c of this.turns.step(pr.phi)) o.eng(cue('turn', T, { pc: 0, dir: c.dir }));
      pings(o, fr, T);
      const pc = ((pr.phi % 1) + 1) % 1;
      this.info = 'arg F = ' + (Math.round(pc * 360) % 360) + '°  ·  sung ' + pcName(pc) + ' over the drone D  ·  activity ' + Math.round(100 * a) + ' %';
    }
    release(T) { if (!this.on) return; this.out.voice({ at: T, gate: 0, tau: 0.16 }); if (this.drone) this.out.drone({ at: T, gate: 0, tau: 0.16 }); this.on = false; }
    end(T) { this.release(T); this.plan.reset(); this.turns.reset(); this.act.reset(); }
    stop(T) { this.out.voice({ at: T, gate: 0, tau: 0.02 }); this.out.drone({ at: T, gate: 0, tau: 0.02 }); this.on = false; this.plan.reset(); this.turns.reset(); }
  }

  // Option 2: the phase harp. Crossing arg F = 0°, 60°, 120°, 210°, 270° (lines 0, 2, 4, 7, 9 of 12) plucks D, E, F♯, A, B.
  const HARP_TH = [0, 1 / 6, 1 / 3, 7 / 12, 3 / 4], HARP_ST = [0, 2, 4, 7, 9], HARP_NAME = ['D', 'E', 'F♯', 'A', 'B'];
  const thr = (i) => Math.floor(i / 5) + HARP_TH[((i % 5) + 5) % 5];
  class Harp {
    constructor(out, o = {}) { this.out = out; this.mat = o.mat || 'string'; this.c = null; this.h = 1 / 96; this.recent = []; this.vol = 1; this.info = ''; this.last = ''; this.T0 = null; this.phi0 = 0; this.count = { up: 0, down: 0 }; }
    begin() { this.c = null; this.recent = []; this.T0 = null; this.count = { up: 0, down: 0 }; this.last = ''; }
    cellOf(phi) { let i = Math.floor(phi) * 5; while (thr(i + 1) <= phi) i++; while (thr(i) > phi) i--; return i; }
    frame(fr) {
      const pr = fr.probe, T = fr.T, o = this.out;
      pings(o, fr, T, this.mat === 'glass' ? 'zeroWood' : null);
      // a jump at a cut is not turning: re-seat the harp on the new colour without plucking
      if (this.c === null || pr.first || pr.jump) { this.c = this.cellOf(pr.phi); this.T0 = T; this.phi0 = pr.phi; return; }
      const P0 = this.phi0, P1 = pr.phi, T0 = this.T0, h = this.h, fired = [];
      const tAt = (th) => (P1 === P0 ? T : T0 + clamp((th - P0) / (P1 - P0), 0, 1) * (T - T0));
      while (P1 > thr(this.c + 1) + h) { this.c++; fired.push({ i: this.c, dir: 1, t: tAt(thr(this.c)) }); }
      while (P1 < thr(this.c) - h) { fired.push({ i: this.c, dir: -1, t: tAt(thr(this.c)) }); this.c--; }
      this.T0 = T; this.phi0 = P1;
      const rateT = pr.rate;   // turns per second
      // the "D only" zone near a zero or pole stops a trembling hand's flutter; a still probe (the deformation) has no
      // tremor, so there every string plays (hfmath-1)
      const shaky = fr.nearInside && pr.speed > 0;
      for (const n of fired) {
        this.recent = this.recent.filter((x) => x > n.t - 0.5); this.recent.push(n.t);
        // notes per second: counted over the last 0.5 s, or implied by how fast arg F turns now (5 strings a turn), so
        // the first notes of a sudden run are already played lighter
        const rate = Math.max(this.recent.length / 0.5, 5 * rateT), j = ((n.i % 5) + 5) % 5, isD = j === 0, dOnly = shaky || this.recent.length / 0.5 > 24;
        if (n.dir > 0) this.count.up += isD ? 1 : 0; else this.count.down += isD ? 1 : 0;
        if (!isD && dOnly) continue;
        // a velocity floor of 0.55 (glass 0.6), so a slow turn is not 5 dB under the calibration (snd-5)
        const v0 = this.mat === 'glass' ? 0.6 : 0.55;
        let vel = v0 + (0.85 - v0) * clamp(Math.log10(Math.max(rateT, 0.1) / 0.1), 0, 1);
        // a run is played lighter, as a harpist would: above 2.5 notes a second each note's amplitude falls as
        // rate^−0.6, so a run (whose notes ring into each other) is about as loud as a slow melody (tools/measure.js);
        // above 14 notes a second, a soft wash
        if (rate > 2.5) vel *= Math.pow(2.5 / rate, 0.6);
        if (rate > 14) vel *= 14 / rate;
        this.note(j, vel, n.t, pr.ln, n.dir, isD && dOnly);
        this.last = HARP_NAME[j] + (n.dir > 0 ? ' ↑' : ' ↓');
      }
      const W = this.count.up - this.count.down;
      this.info = 'last note ' + (this.last || '—') + '  ·  low Ds: ' + this.count.up + ' up, ' + this.count.down + ' down (net ' + (W > 0 ? '+' : W < 0 ? '−' : '') + Math.abs(W) + (fr.fn.cut ? ' crossings of D: √z has no winding number)' : ' turns)');
    }
    // sign: in the D-only zones an up-crossing D also sounds the A above, a down-crossing D the A below (hfmath-12)
    note(j, vel, at, ln, dir, sign) {
      const cen = 0.5 * Math.tanh(lnc(ln) / 2.5), isD = j === 0, base = 73.416 * Math.pow(2, HARP_ST[j] / 12), bright = 0.2 + 0.25 * clamp((vel - 0.4) / 0.45, 0, 1);
      const amp = (this.mat === 'glass' ? LV.glass : LV.harp) * vel * this.vol * (isD ? 1.26 : 1);
      const pan = 0.12 * dir;
      for (let oc = 0; oc < 6; oc++) {
        const f = base * Math.pow(2, oc); if (f > 2400) break;
        const d = (Math.log2(f / 587.33) - cen) / 0.7, w = Math.exp(-0.5 * d * d); if (w < 0.0316) continue;
        this.string(f, amp * w, vel, bright, at, pan);
        if (sign && w > 0.5) this.string(f * Math.pow(2, (dir > 0 ? 7 : -5) / 12), 0.3 * amp * w, vel, bright, at + 0.03, pan);
      }
      // the turn's accent: D4 (not D3, which a phone speaker loses; snd-3), always a plucked string
      if (isD) this.string(293.66, 0.5 * amp, vel, bright, at, pan, true);
    }
    string(f, a, vel, bright, at, pan, pluckIt) {
      const P = [];
      // (glass: every partial rings as long as the fundamental's share, so fewer of them at once: 8, for the CPU budget)
      // (strike() scales by vel itself: divided out here, so vel sets only the mallet's hardness and a run is not
      // softened twice)
      if (this.mat === 'glass' && !pluckIt) strike(P, 0, f, 'glass', { vel, soft: 0.8, t60: 1.1 * Math.pow(f / 587.33, -0.5), amp: a / clamp(vel, 0.05, 1), detune: 2 });
      else pluck(P, 0, f, { t60: 1.8 * Math.pow(f / 587.33, -0.5), bright, amp: a * (this.mat === 'glass' ? LV.harp / LV.glass : 1), dark: true });
      // the room: 0.12 (was 0.18), drier, as the allpass room can ring on plucks (snd-11)
      this.out.eng({ k: 'cue', at, parts: P, wet: 0.12, pan, str: this.mat === 'glass' ? 8 : 12, gain: 1 });
    }
    end() { this.c = null; }
    stop(T) { this.out.eng({ k: 'hush', at: T }); this.c = null; }
  }

  // Option 3: the ring. F on a 20 px circle around the pointer. The note is harmonic 4 + W of a sung D3, W the ring's
  // exact winding number: home D5, a simple zero inside F♯5, a double zero A5, a simple pole A4, …; the Taylor/Laurent
  // coefficients colour it (ringAmps)
  class Ring {
    // colour 'light': the Taylor colour 12 dB under the note and halved (OPTIONS §4's knob, re-cut for the exact note);
    // both settings have unit energy, so they are equally loud (snd-5)
    constructor(out, o = {}) { this.out = out; this.light = o.colour === 'light'; this.act = new Activity(); this.on = false; this.vol = 1; this.info = ''; this.ringR = 0; }
    begin() { this.act.reset(); this.on = false; }
    frame(fr) {
      const pr = fr.probe, T = fr.T, o = this.out, a = this.act.step(pr, T);
      const r = 20 / fr.ppu; this.ringR = r;
      const sp = ringSpectrum(fr.fn, fr.t, fr.x, fr.y, r);
      pings(o, fr, T);
      if (!sp) return;
      const R_ = ringAmps(sp, this.light);
      o.eng({ k: 'hv', at: T, amps: R_.A, slew: 0.03, lvl: LV.hv * lowMake(R_.n0) * this.vol, hum: HUM_LV, vow: 0 });
      if (!this.on && a > 0.02 && !pr.first) { o.eng({ k: 'hv', at: T, gate: 1, t1: 0.01 }); this.on = true; }
      if (this.on && T - this.act.lastActive > 0.12) this.release(T);
      this.info = 'the ring (20 px) holds ' + (R_.ok ? wMeaning(R_.W) + ' → ' + noteOf(R_.n0) : 'a cut or a zero on the ring: no exact count, home D5');
    }
    release(T) { if (!this.on) return; this.out.eng({ k: 'hv', at: T, gate: 0, t1: 0.0975 }); this.on = false; }
    end(T) { this.release(T); this.act.reset(); }
    stop(T) { this.out.eng({ k: 'hv', at: T, gate: 0, t1: 0.008 }); this.on = false; }
  }
  // what a W means, and the note names (for the readouts; hfmath-13)
  const noteOf = (n) => (n < 1 ? 'below the scale' : (NOTE_OF_H[n] || 'harmonic ' + n));
  function wMeaning(W) {
    if (W === 0) return 'W = 0 (no zero or pole inside, or as many of each)';
    const k = Math.abs(W), what = W > 0 ? (k === 1 ? 'one zero' : k + ' zeros') : (k === 1 ? 'one pole' : k + ' poles');
    return 'W = ' + (W > 0 ? '+' : '−') + k + ' (' + what + ' inside, counted with order)';
  }
  function describe(A, what) {
    let n = 1, e = 0; for (let i = 0; i < A.length; i++) { e += A[i] * A[i]; if (A[i] > A[n - 1]) n = i + 1; }
    const share = e > 0 ? A[n - 1] * A[n - 1] / e : 0;
    return what + ': strongest harmonic ' + n + ' = ' + (NOTE_OF_H[n] || ('harmonic ' + n)) + ' (' + (INTERVAL_OF_H[n] || 'high') + '), ' + Math.round(100 * share) + ' % of the energy';
  }
  // the singer's hum: a sung vowel 7 dB under the note (snd-1; was a near-sine 18 dB under). /u/ for the ring, /a/ for
  // curves (snd-8: the two options get different bodies)
  const HUM_LV = 0.45;

  // Option 4: curves sing. A closed curve is played as its phase signal; the centre of the spectrum is its winding
  // number W, heard as harmonic 4 + W of D3 (compressed so it is also the strongest: curveSpectrum). Live while
  // drawing (closed by the chord, 4 dB under), a 2.4 s note on release, continuous under the deformation, and "hear the
  // view" (a growing circle). Its body differs from option 3's: an /a/ vowel, a slow 120 ms bowed attack, and a 0.3 s
  // bloom into the release note.
  class Curve {
    constructor(out) { this.out = out; this.on = false; this.vol = 1; this.info = ''; this.W = null; this.mode = null; }
    begin() { this.on = false; this.W = null; this.mode = null; this.bad = null; }
    play(fn, t, pts, T, lvl, M, lt, fr) {
      const sp = curveSpectrum(fn, t, pts, M, fr && fr.ppu);
      if (!sp) return null;
      // W undefined (a zero or pole within a pixel of the curve, or a cut): hold the last sound for an instant
      // (hfmath-6: no spurious W is sung), and fade out if it lasts (a curve across a cut has no W at all)
      if (!sp.ok) {
        this.info = sp.jump ? 'the curve crosses a cut: F jumps there, so it has no winding number' : 'a zero or pole on the curve: no winding number this instant';
        if (this.bad == null) this.bad = T;
        if (this.on && T - this.bad > 0.15) { this.out.eng({ k: 'hv', at: T, gate: 0, t1: 0.05 }); this.on = false; }
        this.W = null; return sp;
      }
      this.bad = null;
      const W = sp.W, n0 = 4 + W;
      const A = toAmps(sp.b, -8, 20, { centre: W });
      this.out.eng({ k: 'hv', at: T, amps: A, slew: lt ? 0.12 : 0.05, lvl: lvl * lowMake(n0) * this.vol, lt: lt || 0.03, hum: HUM_LV, vow: 1 });
      if (!this.on) { this.out.eng({ k: 'hv', at: T, gate: 1, t1: 0.04 }); this.on = true; }
      this.W = sp.ok ? sp.W : null;
      if (sp.ok) {
        // on the scripted loops, W as order × laps so far (hfmath-11: two laps round a simple zero is W = 2, not a double
        // zero)
        const g = fr && fr.g, c = g && g.laps && g.centre, m = c ? c[2] * (fr.fn.poles.includes(c) ? -1 : 1) : 0, k = m ? sp.W / m : NaN;
        const head = c && Number.isInteger(k) && k > 0 ? 'W = ' + sgn(sp.W) + ': a ' + pointName(c, m < 0) + ', ' + k + (k === 1 ? ' lap' : ' laps') : wMeaning(sp.W);
        this.info = head + ' → ' + noteOf(n0) + (sp.lam < 0.95 ? '  ·  arg F swings unevenly along the curve, so it is played smoothed (×' + sp.lam.toFixed(2) + ')' : '');
      }
      return sp;
    }
    frame(fr) {
      const T = fr.T;
      if (fr.loop) { this.mode = 'loop'; return this.play(fr.fn, fr.t, circlePts(fr.loop, 128), T, LV.hv * 0.89, 256, 0, fr); }
      if (fr.grow != null) { this.mode = 'view'; return this.play(fr.fn, fr.t, circlePts([fr.x, fr.y, fr.grow], 128), T, LV.hv * 0.89, 256, 0, fr); }
      if (fr.pen && fr.stroke && fr.stroke.length > 2) {
        this.mode = 'draw';
        let L = 0; for (let i = 1; i < fr.stroke.length; i++) L += Math.hypot(fr.stroke[i][0] - fr.stroke[i - 1][0], fr.stroke[i][1] - fr.stroke[i - 1][1]);
        if (L * fr.ppu < 30) return null;
        return this.play(fr.fn, fr.t, fr.stroke, T, LV.hv * 0.71, 256, 0, fr);   // live: 4 dB under the release note
      }
      return null;
    }
    // the release note: a 0.3 s bloom, hold 1.2 s, T60 1.2 s; level 1 dB over the live level
    end(T, fr) {
      if (fr && ((fr.stroke && fr.stroke.length > 2 && this.mode === 'draw') || this.mode === 'loop' || this.mode === 'view')) {
        const pts = this.mode === 'draw' ? fr.stroke : this.mode === 'loop' ? circlePts(fr.loop, 256) : circlePts([fr.x, fr.y, fr.grow], 256);
        let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        if (L * fr.ppu >= 30) {
          // sounding already (the live note): it swells into the release note (level and spectrum slew, no new attack);
          // from silence: a bowed attack of 120 ms
          const wasOn = this.on;
          const sp = this.play(fr.fn, fr.t, pts, T, LV.hv * 1.12, 512, 0.3, fr);
          if (sp && sp.ok) {
            if (!wasOn) this.out.eng({ k: 'hv', at: T, gate: 1, t1: 0.04 });
            this.out.eng({ k: 'hv', at: T + 1.4, gate: 0, t1: 0.13 });
            this.on = false; this.mode = null; return;
          }
        }
      }
      if (this.on) this.out.eng({ k: 'hv', at: T, gate: 0, t1: 0.05 });
      this.on = false; this.mode = null;
    }
    stop(T) { this.out.eng({ k: 'hv', at: T, gate: 0, t1: 0.008 }); this.on = false; this.mode = null; }
  }
  const circlePts = (c, n) => Array.from({ length: n }, (_, j) => [c[0] + c[2] * Math.cos(TAU * j / n), c[1] + c[2] * Math.sin(TAU * j / n)]);

  // ---------------------------------------------------------------- the option list (one line each, for the switch)
  const OPTIONS = [
    { id: 'today', name: 'Today', line: 'The app’s current voice: nine sine octaves whose pitch class is arg F, for comparison.' },
    { id: 'sung', name: '1 · Sung point', line: 'arg F as a note on a real instrument, over a drone on D; it sounds only while you move.' },
    { id: 'harp', name: '2 · Phase harp', line: 'Each colour line you cross plucks D, E, F♯, A or B; count the low Ds to count the turns. The rhythm is the scale’s spacing, not arg F’s.' },
    { id: 'ring', name: '3 · The ring', line: 'A sung D with a whistled overtone that counts what is inside a small ring round the pointer: F♯ for a zero, A for a double zero, A below for a pole. It does not hear |F|.' },
    { id: 'curve', name: '4 · Curves sing', line: 'A closed curve sings one note: its winding number (the sign and a small W by ear; the readout gives the number). Draw a loop, or run the deformation. It does not hear |F|.' },
  ];
  // what to listen for, per option, function and gesture (OPTIONS.md §7), written from the gesture's own facts: the
  // target's order, the laps, the sign of arg H_t's turn at the deformation's probe and the loop's W steps (hfmath-1, -2)
  const DEF = {};
  function deformFacts(fn) {
    if (DEF[fn.id]) return DEF[fn.id];
    const g = gesture(fn, 'deform'), pr = new Probe(); let phi0 = null;
    for (let k = 0; k <= 400; k++) { const p = g.at(g.dur * k / 400); pr.move(fn, p.x, p.y, p.t, k / 80, 100); if (phi0 === null) phi0 = pr.phi; }
    const raw = []; for (let k = 0; k <= 100; k++) { const sp = curveSpectrum(fn, k / 100, circlePts(g.loop, 128), 256); raw.push(sp && sp.ok ? sp.W : null); }
    const Ws = []; for (const w of raw) if (w !== null && Ws[Ws.length - 1] !== w) Ws.push(w);
    if (raw[raw.length - 1] === null && raw.slice(-10).every((w) => w === null)) Ws.push(null);
    return (DEF[fn.id] = { dphi: pr.phi - phi0, Ws });
  }
  const turnsTxt = (x) => { const a = Math.abs(x); return a > 0.4 && a < 0.6 ? 'half a turn' : a > 0.2 && a < 0.3 ? 'a quarter turn' : a.toFixed(2) + ' of a turn'; };
  const sgn = (w) => (w > 0 ? '+' : w < 0 ? '−' : '') + Math.abs(w);
  const RING_LOOP = 'the wrong gesture for this option: the loop stays far outside the 20 px ring, so you hear D5 (nothing inside) with a little colour. Try “Visit”.';
  function listenFor(opt, fn, kind) {
    const g = gesture(fn, kind); if (!g) return '';
    const cut = !!fn.cut, exp = fn.id === 'exp', hasPole = fn.poles.length > 0;
    if (kind === 'sweep') {
      if (exp) return { today: 'a slow climb of about a turn, one bell as it passes D, rising in register and loudness as |F| = e^{Re z} grows', sung: 'the instrument climbs about a turn over the drone, its register rising with |F|', harp: 'a slow rising scale with one low D, its register rising with |F|', ring: 'a steady D5: eᶻ has no zeros or poles, and this option does not hear |F|', curve: 'the stroke, closed by its chord, encloses nothing: a steady D5' }[opt];
      if (cut) return { today: 'a glide with arg F; at the cut a quick jump and a double tick', sung: 'the instrument glides with arg F; at the cut a quick jump and a double tick', harp: 'a note or two, then a double tick at the cut and no notes for the jump: a jump is not turning', ring: 'D5 over the hum, rough where the ring straddles the cut', curve: 'D5 until the stroke crosses the cut, then silence: a curve across a cut has no winding number' }[opt];
      const pts = 'a glass ping at each zero' + (hasPole ? ', a soft drum at each pole' : '');
      return { today: 'a sine glide that climbs or falls with arg F; a bell each time it passes D (arg 0); quick swoops and ' + pts, sung: 'the instrument slides with arg F over the drone (unison with the drone: arg F = 0); quick swoops and ' + pts, harp: 'a few notes where the line crosses colour, quick runs at each zero' + (hasPole ? ' and pole' : '') + ' (right beside them, only the Ds), and ' + pts, ring: 'D5 over the hum; F♯5 while a simple zero is inside the ring' + (fn.zeros.some((z) => z[2] === 2) ? ', A5 for the double zero' : '') + (fn.zeros.some((z) => z[2] === 3) ? ', C6 for the triple zero' : '') + (hasPole ? ', A4 for a pole' : '') + '; the colour brightens as one comes near', curve: 'the stroke, closed by its chord, encloses nothing: a steady D5' }[opt];
    }
    if (kind === 'visit') {
      const tg = g.targets, nm = (p) => pointName(p, fn.poles.includes(p)), W = (p) => (p[2] < 1 ? null : fn.poles.includes(p) ? -p[2] : p[2]);
      const cues = 'a glass ping at the zero' + (tg[1] && fn.poles.includes(tg[1]) ? ', a soft drum at the pole' : tg[1] ? ', another at the second zero' : '');
      if (opt === 'ring') return 'D5 while gliding; ' + tg.map((p) => (W(p) === null ? 'a rough, uncounted tone beside the ' + nm(p) + ' (√z has no whole count)' : noteOf(4 + W(p)) + ' beside the ' + nm(p) + ' (W = ' + sgn(W(p)) + ')')).join('; ') + '; ' + cues;
      return { today: 'the glide slows to a gentle wobble beside each point; ' + cues, sung: 'the instrument glides in and wobbles softly beside each point; ' + cues, harp: cues + ', and only a note or two: the harp hears arg F turning, not where you are', curve: '' }[opt];
    }
    if (kind === 'zero' || kind === 'pole' || kind === 'dzero') {
      const tg = g.centre, m = tg[2], pole = kind === 'pole', s = pole ? -1 : 1, what = pointName(tg, pole), L = g.laps;
      if (opt === 'ring') return RING_LOOP;
      if (m < 1) return { today: 'each lap: a climb of half a turn with a bell where it passes D, then a quick drop and a double tick at the cut', sung: 'each lap: a half-turn climb over the drone, then a quick drop and a double tick at the cut', harp: 'each lap: D and E going up, then a double tick at the cut; here the Ds count crossings, not a winding number (√z has none)', curve: 'D5 until the stroke crosses the cut, then silence: a curve across a cut has no winding number' }[opt];
      const n = L * m, ord = m > 1 ? ' (order ' + m + ' × ' + L + ' laps)' : ' (' + L + ' laps)', ordW = m > 1 ? ': order ' + m + ' × ' + L + ' laps' : ': ' + L + ' laps';
      return { today: n + ' endless ' + (s > 0 ? 'climbs' : 'falls') + ', a bell at each turn' + ord, sung: n + ' ' + (s > 0 ? 'climbing' : 'falling') + ' cycles over the drone, a bell at each D' + ord, harp: 'the ' + (s > 0 ? 'rising' : 'falling') + ' scale D E F♯ A B ' + n + ' times, ' + (m === 1 ? 'one low D' : m + ' low Ds') + ' a lap (net ' + sgn(s * n) + ')',
        curve: 'D5 until the dashed chord that closes your stroke passes the ' + what + ' (half a lap), then ' + noteOf(4 + s * m) + ' (W = ' + sgn(s * m) + '); ' + noteOf(4 + s * n) + ' (W = ' + sgn(s * n) + ordW + ') after a lap and a half, held on release' }[opt];
    }
    if (kind === 'deform') {
      const df = deformFacts(fn), up = df.dphi > 0, how = cut ? 'as the cut opens just under the probe' : 'as the zero of H_t passes under the probe (arg H_t turns ' + (up ? 'up' : 'down') + ')';
      if (opt === 'curve') return df.Ws.length < 2 ? 'one steady note' : 'the loop’s note: ' + df.Ws.map((w) => (w === null ? 'silence (the loop now crosses the cut, so it has no winding number)' : noteOf(4 + w) + ' (W = ' + sgn(w) + ')')).join(' → ') + (cut ? '' : '; it changes when a zero of H_t crosses the loop');
      return { today: 'the tone glides ' + (up ? 'up' : 'down') + ' ' + turnsTxt(df.dphi) + ' ' + how + (cut ? '' : ', with a ping'), sung: 'silence, then a ' + (up ? 'rising' : 'falling') + ' glide of ' + turnsTxt(df.dphi) + ' over the drone ' + how, harp: 'silence, then a short ' + (up ? 'rising' : 'falling') + ' run ' + how + '; the probe is still, so every string plays', ring: cut ? 'D5, roughening as the cut opens beside the probe' : 'D5, then F♯5 (W = +1) while the zero of H_t is inside the ring, then D5 again' }[opt];
    }
    if (kind === 'view' && opt === 'curve') {
      const pts = fn.zeros.map((z) => [Math.hypot(z[0], z[1]), z[2]]).concat(fn.poles.map((p) => [Math.hypot(p[0], p[1]), -p[2]])).filter((p) => p[0] < Math.SQRT2 * fn.view[2] && Number.isInteger(p[1])).sort((a, b) => a[0] - b[0]);
      if (!pts.length) return 'eᶻ has no zeros or poles: the note stays D5 however large the circle grows (it was the spread of arg F that used to move it)';
      const seq = [0]; let w = 0, i = 0; while (i < pts.length) { const r = pts[i][0]; while (i < pts.length && Math.abs(pts[i][0] - r) < 1e-9) { w += pts[i][1]; i++; } if (w !== seq[seq.length - 1]) seq.push(w); }
      return 'the note is the growing circle’s winding number: ' + seq.map((w) => noteOf(4 + w) + ' (W = ' + sgn(w) + ')').join(' → ') + (seq.length === 1 ? ' throughout, because the zero and the pole enter together' : '; it steps as each zero or pole is swallowed');
    }
    return '';
  }
  // the reading key under the portrait, per option (hfmath-13)
  const KEY = {
    today: 'Colour is arg F; red is arg F = 0, heard as D. Climbing = arg F increasing (counter-clockwise round a zero).',
    sung: 'Colour is arg F; red is arg F = 0 = D, unison with the drone. Climbing = arg F increasing.',
    harp: 'The five light lines are the strings; the brightest one, in the red, is D (arg F = 0). Up the scale = arg F increasing.',
    ring: 'D5 home (nothing inside) · F♯5 +1 · A5 +2 · C6 +3 · A4 −1 · D4 −2 · D3 −3, counted inside the ring.',
    curve: 'D5 home (W = 0) · F♯5 +1 · A5 +2 · C6 +3 · A4 −1 · D4 −2 · D3 −3: W = zeros − poles inside the curve.',
  };

  // ---------------------------------------------------------------- a session: positions (a gesture or the hand) → frames
  // out: the sinks; opt: an OPTIONS id; set: {kind, drone, mat, home}. pos: {x, y, t, pen, r}. T: the context's clock.
  const MAKERS = { today: (o) => new Today(o), sung: (o, s) => new Sung(o, s), harp: (o, s) => new Harp(o, s), ring: (o, s) => new Ring(o, s), curve: (o) => new Curve(o) };
  class Session {
    constructor(out, opt, set = {}) { this.out = out; this.opt = opt; this.ctl = MAKERS[opt](out, set); this.probe = new Probe(); this.near = new Near(); this.stroke = []; this.fr = null; this.g = null; this.active = false; this.lastCut = -1; }
    set vol(v) { this.ctl.vol = v; }
    start(T, fn, g) { this.fn = fn; this.g = g || null; this.probe.reset(); this.near.reset(); this.stroke = []; this.fr = null; this.lastCut = -1; this.ctl.begin(T); this.active = true; }
    frame(T, pos, ppu) {
      if (!this.active) return null;
      const fn = this.fn, pr = this.probe.move(fn, pos.x, pos.y, pos.t, T, ppu);
      const near = this.near.step(fn, pos.x, pos.y, pos.t, ppu);
      if (pos.pen) { const l = this.stroke[this.stroke.length - 1]; if (!l || Math.hypot(pos.x - l[0], pos.y - l[1]) * ppu > 0.5) this.stroke.push([pos.x, pos.y]); }
      const cut = pr.jump && (this.lastCut < 0 || T - this.lastCut > 0.12); if (cut) this.lastCut = T;
      const fr = (this.fr = { fn, x: pos.x, y: pos.y, t: pos.t, T, ppu, pen: !!pos.pen, stroke: this.stroke, probe: pr, near, nearInside: this.near.inside, cut, g: this.g,
        loop: this.g && this.g.kind === 'deform' ? this.g.loop : null, grow: this.g && this.g.kind === 'view' ? pos.r : null });
      this.ctl.frame(fr);
      return fr;
    }
    end(T) { if (!this.active) return; this.active = false; this.ctl.end(T, this.fr); }
    stop(T) { this.active = false; this.ctl.stop(T); }
    get info() { return this.ctl.info; }
  }

  return { TAU, clamp, FUNCS, byId, ev, evd, Probe, Near, Session, gesture, target, Today, Sung, Harp, Ring, Curve, OPTIONS, listenFor, KEY, LV, curveSpectrum, ringSpectrum, ringAmps, toAmps, circlePts, fmtZ, NOTE_OF_H, HARP_TH, cue, deformFacts, setSeed: (s) => { R = prng(s); } };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = HFCore;
