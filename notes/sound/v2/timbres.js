'use strict';
// =====================================================================================================================
// Hear the function: four instrument timbres for the Shepard voice (notes/sound/v2/TIMBRES.md).
//
// The user (2026-10-24) on palette B: "I like everything except for hearing the function. It still feels quite
// synthetic. Нет тембра." Every other cue of B stays as it is. This file only replaces what the Shepard voice is made of.
//
// The mathematics is the app's (src/sound.js, SH): 9 octave-spaced voices, f = D1 · 2^pos, pos = (k + s) mod 9, under
// one fixed bell over log-frequency (Gaussian, σ 0.95 octave, centre 4.1 + 0.3·tanh(ln|F| / 2.5), a sin² taper at the
// band edges, a fade below Nyquist). s is arg F in turns, so the pitch class follows arg F continuously and circularly;
// |F| sets loudness (0.6 to 1.0) and a little register. What changes: each of the 9 voices is now a whole instrument
// tone of ONE timbre (a bowed string, a sung vowel, a rubbed glass, a reed), not a sine, and every resonance (body
// modes, formants) is fixed in frequency, shared by all voices, so the spectral envelope does not move with pitch and
// the circular illusion holds exactly (voice k at s + 1 is voice k + 1 at s, harmonics and all).
//   T1 'cello'  bowed string: band-limited Helmholtz sawtooth per voice (PolyBLEP), rounded corner, slip-synchronous
//               bow noise, per-period jitter and shimmer, one player phase-locked across octaves (vibrato 5–6 Hz, irregular),
//               through one fixed 18-mode cello/viola body (A0 100 Hz, B1∓ 178/215 Hz, a bridge hill near 2 kHz).
//   T2 'choir'  sung "ah" ('oo' optional): 3 singers (−8, 0, +7 cents), each phase-locked across octaves, a KLGLOTT88 glottal flow
//               derivative (open quotient 0.62, BLEP at closure) with jitter, shimmer, own vibrato and drift, and
//               aspiration noise gated by the glottal opening; one fixed 5-formant cascade (Klatt), stereo.
//   T3 'glass'  glass harmonica: the rubbed (2,0) mode as a slowly beating doublet (0.5 to 1.6 Hz), weak friction
//               harmonics 2 and 3, the bowl's inharmonic modes 2.32× and 4.25× shimmering, finger noise around the
//               fundamental and a little rim hiss, a slow bloom, a longer room.
//   T4 'reed'   clarinet: band-limited square (odd harmonics) with a little sawtooth (evens), even harmonics filling in
//               above a fixed 1.8 kHz cut-off, fixed radiation peaks (1.4 kHz, 3.6 kHz), reed noise synchronous with the
//               reed opening, a tongued onset, a gentle 4.8 Hz vibrato (pitch ±5 cents and level ±3 %) while resting.
// Common to all: a short stereo room inside the voice (4-line FDN), click-free control (every gain, gate and duck by two
// cascaded one-pole smoothers, so onsets start with zero slope; pitch by linear slews of a continuous phase; every
// filter coefficient fixed or moving continuously), no AudioParam automation at all.
//
// The control interface is the app's voice protocol (time-stamped commands posted to the worklet, applied at their
// sample): {at, snap} {at, ds, dur} (pitch class, turns), {at, cc, loud} (register, level), {at, pan}, {at, gate, tau},
// {at, duck}, {at, stop}. Timbres.voice(...) returns setPitchClass / setLevel / setRegister / gate / stop on top of it;
// Timbres.ShepardVoice(G, T, kind) is a drop-in for the app's Sound.ShepardVoice (same plan, backlog rule and duck).
// =====================================================================================================================
function TIMBRE_WORKLET() {
  'use strict';
  const TL = 4096, SINT = new Float32Array(TL + 1);
  for (let i = 0; i <= TL; i++) SINT[i] = Math.sin(2 * Math.PI * i / TL);
  const sin1 = (p) => { const x = p * TL, i = x | 0; return SINT[i] + (SINT[i + 1] - SINT[i]) * (x - i); };   // p ∈ [0, 1)
  function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  // the app's bell (src/sound.js SH): N partials from D1, Gaussian σ 0.95 octave, sin² taper over the outer half octave
  const N = 9, FLO = 36.7081, ISIG = 1 / 0.95, EDGE = 0.5, CENT = Math.LN2 / 1200;
  const GD = 8, GL = 8192, GT = new Float32Array(GL + 2); for (let i = 0; i <= GL + 1; i++) { const d = -GD + 2 * GD * i / GL; GT[i] = Math.exp(-0.5 * d * d); }
  const gauss = (d) => { if (d <= -GD || d >= GD) return 0; const x = (d + GD) * (GL / (2 * GD)), i = x | 0; return GT[i] + (GT[i + 1] - GT[i]) * (x - i); };
  const taper = (p) => { if (p <= 0 || p >= N) return 0; const e = p < N - p ? p : N - p; if (e >= EDGE) return 1; const s = Math.sin(0.5 * Math.PI * e / EDGE); return s * s; };
  const P2 = new Float64Array(N); for (let k = 0; k < N; k++) P2[k] = Math.pow(2, k);
  // PolyBLEP residual of a step at phase 0 (a sawtooth's −2 step is corrected by −blep; a step of h by (h / 2)·blep);
  // t ∈ [0, 1) is the phase since the step, dt the phase step per sample (< 0.5)
  const blep = (t, dt) => { if (t < dt) { t /= dt; return t + t - t * t - 1; } if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; } return 0; };
  const GMIN = 2e-4;   // a voice under −74 dB of the bell's peak only advances its phase
  // the bell's gain for a voice at pos (fundamental f): Gaussian × taper × the fade from 0.40 to 0.45 · fs
  function bell(pos, cen, f, inv) {
    let g = gauss((pos - cen) * ISIG); if (g < GMIN) return 0;
    g *= taper(pos); const r = f * inv; if (r > 0.40) g *= r >= 0.45 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (r - 0.40) / 0.05);
    return g;
  }
  // biquads (RBJ). bp: constant 0 dB peak gain, y = b0 (x − x2) − a1 y1 − a2 y2
  function bpC(f, q, fs) { const w = 2 * Math.PI * f / fs, al = Math.sin(w) / (2 * q), a0 = 1 + al; return [al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0]; }
  function lpC(f, q, fs) { const w = 2 * Math.PI * f / fs, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al; return [(1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, -2 * c / a0, (1 - al) / a0]; }
  function pkC(f, q, db, fs) { const A = Math.pow(10, db / 40), w = 2 * Math.PI * f / fs, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al / A; return [(1 + al * A) / a0, -2 * c / a0, (1 - al * A) / a0, -2 * c / a0, (1 - al / A) / a0]; }
  function Biq(co) { return { b0: co[0], b1: co[1], b2: co[2], a1: co[3], a2: co[4], x1: 0, x2: 0, y1: 0, y2: 0 }; }
  const biq = (q, x) => { const y = q.b0 * x + q.b1 * q.x1 + q.b2 * q.x2 - q.a1 * q.y1 - q.a2 * q.y2; q.x2 = q.x1; q.x1 = x; q.y2 = q.y1; q.y1 = y; return y; };
  // Klatt resonator, unity gain at DC: y = A x + B y1 + C y2
  function Res(f, bw, fs) { const r = Math.exp(-Math.PI * bw / fs), B = 2 * r * Math.cos(2 * Math.PI * f / fs), C = -r * r; return { A: 1 - B - C, B, C, y1: 0, y2: 0 }; }
  const res = (q, x) => { const y = q.A * x + q.B * q.y1 + q.C * q.y2; q.y2 = q.y1; q.y1 = y; return y; };
  // a fixed bank of parallel body modes [f, Q, gain] on one input
  function Bank(modes, direct, fs) {
    const M = modes.length, b0 = new Float64Array(M), a1 = new Float64Array(M), a2 = new Float64Array(M), gn = new Float64Array(M), y1 = new Float64Array(M), y2 = new Float64Array(M);
    modes.forEach(([f, q, g], i) => { const c = bpC(Math.min(f, 0.45 * fs), q, fs); b0[i] = c[0]; a1[i] = c[1]; a2[i] = c[2]; gn[i] = g; });
    let x1 = 0, x2 = 0;
    return { run(x) { let y = direct * x; const d = x - x2; for (let i = 0; i < M; i++) { const v = b0[i] * d - a1[i] * y1[i] - a2[i] * y2[i]; y2[i] = y1[i]; y1[i] = v; y += gn[i] * v; } x2 = x1; x1 = x; return y; } };
  }

  // ---- the per-kind recipes. off: the bell's centre offset (octaves; the instrument's own register), amp: level (matched
  // to palette B's glass choir, LUFS-M at |F| = 1), att: the articulation follower (s), rel: gate-off time × this (for
  // normal fades only; silence and Esc stay fast), room: [wet, T60 s], vib: [depth cents, rate Hz, depth while moving]
  const KIND = {
    cello: { off: -0.8, amp: 0.0794, att: 0.075, rel: 1.6, room: [0.20, 0.42], vib: [14, 5.4, 0.25] },
    choir: { off: -0.6, amp: 0.0304, att: 0.06, rel: 1.6, room: [0.22, 0.5], vib: [20, 5.3, 0.25] },
    glass: { off: 0.3, amp: 0.0262, att: 0.14, rel: 2.5, room: [0.22, 0.9], vib: [3, 4.4, 0.0] },
    reed: { off: -0.6, amp: 0.0160, att: 0.035, rel: 1.4, room: [0.16, 0.4], vib: [5, 4.8, 0.0] },
  };
  // level compensation (dB) over pitch class (24 steps) × register (the app's bell centre 3.8, 3.95, 4.1, 4.25, 4.4), from
  // timbres/calibrate.js: the fixed resonances make some classes louder; this keeps loudness a function of |F| only
  const COMP = {
    cello: [-1.9, -1.4, -0.5, 0.1, 0.8, 1.5, 0.4, -0.6, -0.2, -0.2, -0.7, -0.8, -1.8, -3.5, -1.3, 0, 0.7, 2.5, 2, 2.2, 2.1, 0.2, -0.5, -1.6, -2, -1.5, -0.6, 0.1, 0.9, 1.7, 0.6, -0.2, 0.4, 0.3, -0.5, -0.7, -1.7, -3.5, -1.5, -0.2, 0.5, 2.3, 1.9, 2.1, 2.1, 0.1, -0.4, -1.4, -2, -1.7, -0.6, 0.1, 1, 1.8, 0.7, 0.1, 0.9, 0.6, -0.4, -0.7, -1.6, -3.4, -1.5, -0.4, 0.3, 2.2, 1.9, 2.1, 2.1, 0, -0.4, -1.2, -2, -1.7, -0.5, 0.2, 1.1, 1.9, 0.8, 0.3, 1.3, 0.9, -0.4, -0.6, -1.5, -3.3, -1.6, -0.5, 0.2, 2.1, 1.8, 2, 2, -0.1, -0.3, -0.9, -1.9, -1.8, -0.4, 0.2, 1.2, 1.9, 0.8, 0.4, 1.6, 1.2, -0.4, -0.6, -1.4, -3.1, -1.5, -0.7, 0.1, 2, 1.8, 1.9, 2, -0.3, -0.2, -0.7],
    choir: [-0.4, 0.9, -0.2, -0.6, 0, -0.2, -0.4, -1.5, -0.8, -0.3, -1.1, -0.3, 0.3, -1.3, -0.7, -0.1, -1.4, -1.4, -1.4, -1.8, -1.8, -1.4, -1.2, -0.9, -0.4, 1, 0.1, -0.2, 0.4, -0.2, 0, -0.9, -0.2, 0.3, -0.3, 0.5, 1, -0.5, -0.4, 0.9, -0.4, -0.8, -0.9, -1.4, -1.4, -1.4, -1.2, -0.4, -0.2, 0.7, 0.4, 0.1, 0.3, -0.1, 0.1, -0.6, 0.1, 0.2, 0.5, 1.3, 1.8, 0.3, 0.5, 1.7, 0.4, -0.2, -0.4, -0.7, -0.7, -0.9, -0.9, -0.1, -0.1, 0.7, 0.4, -0.3, 0.1, 0, -0.2, -0.9, -0.1, 0.2, 0.5, 1.7, 2.2, 1, 1.2, 2.4, 1.3, 0.8, 0.3, 0.1, 0.1, -0.1, -0.6, -0.1, 0.2, 0.7, -0.1, -1.4, -0.6, -0.3, -0.8, -1.6, -0.8, -0.4, -0.2, 1.5, 2.1, 1, 1.6, 3.1, 1.5, 1.6, 1, 0.9, 0.9, 0.5, -0.1, 0.2],
    glass: [0.4, -0.1, 0.6, -0.6, -0.3, 1.7, 1.2, -1, 0.7, 0.8, -0.1, 1.6, 0.4, -1, -0.6, 1.2, -0.2, 0.7, -0.1, 0.6, 1.2, 0.1, 0.7, 0.7, 0.3, -0.5, 0.5, -0.8, -0.4, 1.5, 1, -1.1, 0.4, 0.8, -0.2, 1.4, 0.3, -1, -0.8, 1.1, -0.4, 0.5, -0.3, 0.4, 0.9, -0.1, 0.6, 0.6, 0.1, -0.8, 0.4, -1, -0.5, 1.3, 0.9, -1.2, 0.1, 0.7, -0.3, 1.2, 0.1, -1, -0.9, 0.8, -0.6, 0.4, -0.5, 0.1, 0.6, -0.4, 0.4, 0.5, -0.1, -1.1, 0.3, -1.1, -0.6, 1, 0.7, -1.3, -0.3, 0.6, -0.5, 0.9, 0, -1, -1, 0.5, -0.8, 0.2, -0.8, -0.1, 0.3, -0.7, 0.2, 0.4, -0.2, -1.3, 0.1, -1.2, -0.7, 0.8, 0.4, -1.4, -0.7, 0.4, -0.7, 0.7, -0.1, -1.1, -1.1, 0.2, -1, 0, -1, -0.4, -0.1, -0.9, 0, 0.2],
    reed: [0.9, 1.3, 0.9, 0.8, 0.8, 1.3, 1.3, 0.3, 1.3, 1.2, 0.6, 1, 1, -0.1, 0.5, 0.9, 0.6, 0.6, 0.4, 1, 1.4, 1.1, 1.1, 1.2, 0.4, 0.7, 0.5, 0.3, 0.3, 0.9, 0.9, -0.1, 0.9, 0.9, 0.2, 0.7, 0.6, -0.4, 0.1, 0.6, 0.1, 0.2, -0.1, 0.5, 0.9, 0.5, 0.6, 0.8, -0.1, 0.1, 0.1, -0.2, -0.2, 0.5, 0.4, -0.5, 0.4, 0.6, -0.1, 0.4, 0.3, -0.8, -0.4, 0.3, -0.3, -0.2, -0.5, 0, 0.5, 0, 0, 0.4, -0.7, -0.5, -0.4, -0.8, -0.8, 0, -0.1, -0.9, 0, 0.2, -0.5, 0, -0.2, -1.2, -0.8, 0, -0.7, -0.6, -1, -0.5, 0.1, -0.6, -0.5, 0, -1.2, -1.3, -1, -1.5, -1.4, -0.5, -0.6, -1.4, -0.6, -0.1, -0.8, -0.4, -0.7, -1.6, -1.3, -0.3, -1.2, -1, -1.4, -1.1, -0.4, -1.1, -1.1, -0.4],
  };
  // the cello/viola body: low modes (A0 air, the B1 pair, the C-bridge region), then a dense set of fixed, irregularly
  // spaced wood modes (Q 18–26, alternating sign: resonances and anti-resonances), a bridge hill near 2 kHz
  const CELLO_BODY = [[100, 6, 0.4], [178, 7, 0.6], [215, 8, -0.5], [282, 8, 0.45], [345, 9, -0.4], [430, 11, 0.5], [512, 12, -0.42], [600, 13, 0.45], [700, 14, -0.4],
    [810, 15, 0.42], [940, 16, -0.36], [1075, 16, 0.38], [1230, 16, -0.34], [1400, 16, 0.4], [1590, 15, -0.36], [1800, 14, 0.42], [2050, 13, -0.36], [2330, 12, 0.38],
    [2650, 11, -0.28], [3050, 10, 0.22], [3550, 9, -0.14], [4100, 8, 0.1]];
  // bandwidths about twice a single singer's: a choir sums many vocal tracts whose formants differ by 5–10 %
  const VOWELS = { ah: [[730, 210], [1100, 230], [2650, 280], [3350, 340], [4000, 400]], oo: [[330, 150], [800, 190], [2450, 260], [3300, 330], [3950, 400]] };

  // ---- players as phase-locked ranks. A rank is one player: one master phase Φ at the bottom octave (FLO · 2^u), and its
  // voice in slot k (octave kk) has the phase frac(2^kk · Φ), so the octave voices of one player stay phase-locked: their
  // shared harmonics (voice k's 2nd = voice k + 1's 1st) never beat against each other, and the level stays steady.
  // Vibrato, drift, jitter and detune belong to the player, so they move all its octaves together. When u wraps (s
  // crosses a whole turn, every slot's octave index moves by one), Φ is halved or doubled, which keeps every voice's
  // phase continuous: frac(2^(kk+1) · Φ/2) = frac(2^kk · Φ).
  function Ranks(P, e, NR, rate, dr, det) {
    const R = P.R;
    e.NR = NR; e.PH = new Float64Array(NR).map(() => R()); e.jit = new Float64Array(NR).fill(1); e.fm = new Float64Array(NR).fill(1); e.si = 0; e.dP = new Float64Array(NR);
    P.players(e, NR, rate, dr, det);
  }
  function rankShift(e, si) {
    const d = si - e.si; if (d === 0) return; e.si = si; if (d > 12 || d < -12) return;
    for (let r = 0; r < e.NR; r++) { let p = e.PH[r]; if (d > 0) for (let j = 0; j < d; j++) p *= 0.5; else for (let j = 0; j < -d; j++) { p *= 2; p -= Math.floor(p); } e.PH[r] = p; }
  }
  // advance every rank's master by one sample (b = FLO · 2^u); jit: per master period, ± jr
  function rankStep(e, b, inv, R, jr) {
    for (let r = 0; r < e.NR; r++) { const d = b * e.fm[r] * e.jit[r] * inv; e.dP[r] = d; let p = e.PH[r] + d; if (p >= 1) { p -= 1; e.jit[r] = 1 + jr * (2 * R() - 1); } e.PH[r] = p; }
  }

  // ---- T1: the bowed string. One player: a phase-locked stack of octaves (a second player a few cents away made slow,
  // deep unison beats, 2.7 to 3.4 dB of level change; a soloist is also the truer cello)
  const CDET = [0], CVA = [1], NRC = 1;
  class Cello {
    constructor(P) {
      const fs = P.fs, M = N * NRC;
      Ranks(P, this, NRC, [5.0, 5.9], 2.5, CDET);
      this.pp = new Float64Array(M); this.am = new Float64Array(M).fill(1); this.amT = new Float64Array(M).fill(1);
      this.lp = new Float64Array(M); this.lc = new Float64Array(N).fill(0.5);
      this.body = Bank(CELLO_BODY, 0.12, fs); this.out = Biq(lpC(5200, 0.7071, fs)); this.nlp = 0; this.nk = 1 - Math.exp(-2 * Math.PI * 500 / fs);
    }
    control(P, i) {
      const s = P.S[i], si = Math.floor(s), u = s - si, b = FLO * Math.pow(2, u), art = P.A[i], inv = P.inv;
      P.vibrato(this, NRC, i);
      const br = (0.45 + 0.55 * art) * (0.8 + 0.25 * P.LD[i]);
      for (let k = 0; k < N; k++) { let kk = (k + si) % N; if (kk < 0) kk += N; const fc = Math.min(0.45 * P.fs, b * P2[kk] * 16 * br), x = 2 * Math.PI * fc * inv; this.lc[k] = x / (1 + x); }
    }
    run(P, n, Y) {
      const inv = P.inv, R = P.R, PH = this.PH, dP = this.dP, pp = this.pp, am = this.am, amT = this.amT, lp = this.lp, lc = this.lc;
      for (let i = 0; i < n; i++) {
        if ((P.ctl++ & 15) === 0) this.control(P, i);
        const s = P.S[i], si = Math.floor(s), u = s - si, b = FLO * Math.pow(2, u), cen = P.C[i];
        rankShift(this, si); rankStep(this, b, inv, R, 0.002);
        let src = 0, nz = 0;
        for (let k = 0; k < N; k++) {
          let kk = (k + si) % N; if (kk < 0) kk += N;
          const pos = kk + u, f = b * P2[kk], gk = bell(pos, cen, f, inv);
          if (gk === 0) continue;
          for (let r = 0; r < NRC; r++) {
            const ix = k * NRC + r, dt = P2[kk] * dP[r];
            let p = P2[kk] * PH[r]; p -= Math.floor(p);
            if (p < pp[ix]) amT[ix] = 1 + 0.04 * (2 * R() - 1);   // a new period: its own bow force (shimmer)
            pp[ix] = p;
            const saw = 2 * p - 1 - blep(p, dt);
            lp[ix] += lc[k] * (saw - lp[ix]); am[ix] += (amT[ix] - am[ix]) * 0.004;
            const a = gk * CVA[r] * am[ix];
            src += a * lp[ix];
            const q = p * 5; nz += a * (0.3 + (q < 1 ? 4 * q * (1 - q) : 0));   // the slip: noise peaks once a period
          }
        }
        const w = (2 * R() - 1) * nz * (0.07 + 0.25 * P.X[i]);
        this.nlp += this.nk * (w - this.nlp);
        Y[i] = biq(this.out, this.body.run(src + (w - this.nlp)));
      }
    }
  }

  // ---- T2: the choir. 3 singers, each a phase-locked stack of octaves; stereo (each singer placed a little apart)
  const SDET = [-8, 0, 7], SVA = [0.55, 1, 0.5], SPAN = [-0.22, 0, 0.22], OQ = 0.62, IOQ = 1 / OQ;
  class Choir {
    constructor(P, vowel) {
      const fs = P.fs, M = N * 3;
      Ranks(P, this, 3, [4.8, 5.9], 3, SDET);
      this.pp = new Float64Array(M); this.am = new Float64Array(M).fill(1); this.amT = new Float64Array(M).fill(1);
      const F = VOWELS[vowel] || VOWELS.ah;
      this.fL = F.map(([f, bw]) => Res(f, bw, fs)); this.fR = F.map(([f, bw]) => Res(f, bw, fs));
      this.tk = 1 - Math.exp(-2 * Math.PI * 3200 / fs); this.tL = 0; this.tR = 0; this.nhL = 0; this.nhR = 0; this.nk = 1 - Math.exp(-2 * Math.PI * 900 / fs);
      this.PL = new Float64Array(3); this.PR = new Float64Array(3); this.dcL = 0; this.dcR = 0; this.hk = 1 - Math.exp(-2 * Math.PI * 5000 / fs); this.hL = 0; this.hR = 0;
    }
    control(P, i) {
      P.vibrato(this, 3, i);
      for (let m = 0; m < 3; m++) { const th = (Math.max(-0.4, Math.min(0.4, P.pan + SPAN[m])) + 1) * Math.PI / 4; this.PL[m] = Math.cos(th); this.PR[m] = Math.sin(th); }
    }
    run(P, n, YL, YR) {
      const inv = P.inv, R = P.R, PH = this.PH, dP = this.dP, pp = this.pp, am = this.am, amT = this.amT, PL = this.PL, PR = this.PR;
      for (let i = 0; i < n; i++) {
        if ((P.ctl++ & 15) === 0) this.control(P, i);
        const s = P.S[i], si = Math.floor(s), u = s - si, b = FLO * Math.pow(2, u), cen = P.C[i];
        rankShift(this, si); rankStep(this, b, inv, R, 0.004);
        let vL = 0, vR = 0, nz = 0;
        for (let k = 0; k < N; k++) {
          let kk = (k + si) % N; if (kk < 0) kk += N;
          const pos = kk + u, f0 = b * P2[kk], gk = bell(pos, cen, f0, inv);
          if (gk === 0) continue;
          const side = gk >= 0.1 ? 1 : gk <= 0.02 ? 0 : (gk - 0.02) / 0.08;   // quiet octaves sing with one voice
          for (let m = 0; m < 3; m++) {
            if (m !== 1 && side === 0) continue;
            const ix = k * 3 + m, dt = P2[kk] * dP[m];
            let p = P2[kk] * PH[m]; p -= Math.floor(p);
            if (p < pp[ix]) amT[ix] = 1 + 0.06 * (2 * R() - 1);   // a new glottal period: shimmer
            pp[ix] = p;
            let e = 0, fl = 0.12;
            if (p < OQ) { const x = p * IOQ; e = x * (2 - 3 * x); fl = 0.35 + 2.6 * x * x * (1 - x); }
            let t = p - OQ; if (t < 0) t += 1; e += 0.5 * blep(t, dt);   // the closure: a step of +1, band-limited
            am[ix] += (amT[ix] - am[ix]) * 0.003;
            const a = gk * SVA[m] * (m === 1 ? 1 : side) * am[ix];
            vL += a * e * PL[m]; vR += a * e * PR[m]; nz += a * fl;
          }
        }
        const ng = nz * (0.10 + 0.25 * P.X[i]), wL = (2 * R() - 1) * ng, wR = (2 * R() - 1) * ng;
        this.nhL += this.nk * (wL - this.nhL); this.nhR += this.nk * (wR - this.nhR);
        const xl = vL + (wL - this.nhL), xr = vR + (wR - this.nhR);
        this.tL += this.tk * (xl - this.tL); this.tR += this.tk * (xr - this.tR);
        let yl = this.tL, yr = this.tR;
        for (let j = 0; j < 5; j++) { yl = res(this.fL[j], yl); yr = res(this.fR[j], yr); }
        // the higher resonances a 5-formant cascade leaves out (Klatt's higher-pole correction, roughly): the source above
        // ~5 kHz in parallel, so the voice keeps its air up to 8 kHz instead of ending at the 5th formant. Its polarity is
        // the one that adds to the cascade near the crossover (the other made a 14 dB notch at 3 kHz, the "ring" region)
        this.hL += this.hk * (xl - this.hL); this.hR += this.hk * (xr - this.hR);
        yl -= 0.2 * (xl - this.hL); yr -= 0.2 * (xr - this.hR);
        YL[i] = yl - this.dcL; YR[i] = yr - this.dcR; this.dcL += 0.0005 * (yl - this.dcL); this.dcR += 0.0005 * (yr - this.dcR);
      }
    }
  }

  // ---- T3: the glass harmonica
  class Glass {
    constructor(P) {
      const R = P.R, fs = P.fs;
      this.p1 = new Float64Array(N).map(() => R()); this.p2 = new Float64Array(N).map(() => R()); this.p3 = new Float64Array(N).map(() => R()); this.p4 = new Float64Array(N).map(() => R());
      this.beat = new Float64Array(N).map(() => 0.5 + 1.1 * R()); this.fm = new Float64Array(N).fill(1);
      this.m3 = new Float64Array(N); this.m3T = new Float64Array(N); this.m4 = new Float64Array(N); this.m4T = new Float64Array(N); this.nx = new Float64Array(N);
      P.players(this, N, [4.0, 4.8], 3);
      this.nl = 0; this.nl2 = 0; this.hb = Biq([0, 0, 0, 0, 0]); const c = bpC(3800, 0.8, fs); Object.assign(this.hb, { b0: c[0], b1: 0, b2: -c[0], a1: c[1], a2: c[2] });
      this.out = Biq(lpC(7500, 0.7071, fs)); this.ak = 1 - Math.exp(-16 / (0.06 * fs));
    }
    control(P, i) {
      const R = P.R, fr = P.f0 + i;
      P.vibrato(this, N, i);
      for (let k = 0; k < N; k++) {   // the bowl's inharmonic modes shimmer: new random levels about every 60 to 200 ms
        if (fr >= this.nx[k]) { this.m3T[k] = 0.035 + 0.05 * R(); this.m4T[k] = 0.012 + 0.02 * R(); this.nx[k] = fr + (0.06 + 0.14 * R()) * P.fs; }
        this.m3[k] += (this.m3T[k] - this.m3[k]) * this.ak; this.m4[k] += (this.m4T[k] - this.m4[k]) * this.ak;
      }
    }
    run(P, n, Y) {
      const inv = P.inv, R = P.R, p1 = this.p1, p2 = this.p2, p3 = this.p3, p4 = this.p4, fm = this.fm, beat = this.beat;
      for (let i = 0; i < n; i++) {
        if ((P.ctl++ & 15) === 0) this.control(P, i);
        const s = P.S[i], si = Math.floor(s), u = s - si, b = FLO * Math.pow(2, u), cen = P.C[i];
        let y = 0, pn = 0, gs = 0;
        for (let k = 0; k < N; k++) {
          let kk = (k + si) % N; if (kk < 0) kk += N;
          const pos = kk + u, f = b * P2[kk] * fm[k], dt = f * inv, gk = bell(pos, cen, f, inv);
          let a = p1[k] + dt; a -= Math.floor(a); p1[k] = a;
          let c = p2[k] + (f + beat[k]) * inv; c -= Math.floor(c); p2[k] = c;
          let d = p3[k] + 2.32 * dt; d -= Math.floor(d); p3[k] = d;
          let e = p4[k] + 4.25 * dt; e -= Math.floor(e); p4[k] = e;
          if (gk === 0) continue;
          const s1 = sin1(a); let h2 = 2 * a; h2 -= Math.floor(h2); let h3 = 3 * a; h3 -= Math.floor(h3);
          let v = s1 + 0.13 * sin1(c) + 0.08 * sin1(h2) + 0.03 * sin1(h3);
          const r3 = 2.32 * dt, r4 = 4.25 * dt;
          if (r3 < 0.4) v += this.m3[k] * sin1(d); if (r4 < 0.4) v += this.m4[k] * sin1(e);
          y += gk * v; pn += gk * s1; gs += gk;
        }
        // the wet finger: noise around each fundamental (ring-modulated low noise), and a little rim hiss
        const w1 = 2 * R() - 1, w2 = 2 * R() - 1;
        this.nl += 0.012 * (w1 - this.nl); this.nl2 += 0.012 * (this.nl - this.nl2);
        const air = 1.5 * pn * this.nl2 * (1 + 2 * P.X[i]) + 0.012 * gs * biq(this.hb, w2) * (1 + 3 * P.X[i]);
        Y[i] = biq(this.out, y + air) * P.A[i];   // the bloom: the glass speaks as the finger's friction builds
      }
    }
  }

  // ---- T4: the clarinet
  class Reed {
    constructor(P) {
      const R = P.R, fs = P.fs;
      this.ph = new Float64Array(N).map(() => R()); this.jit = new Float64Array(N).fill(1); this.am = new Float64Array(N).fill(1); this.amT = new Float64Array(N).fill(1);
      this.lp = new Float64Array(N); this.lc = new Float64Array(N).fill(0.5); this.fm = new Float64Array(N).fill(1); this.av = 1;
      P.players(this, N, [4.6, 5.1], 2);
      this.fill = Biq([0, 0, 0, 0, 0]); { const w = 2 * Math.PI * 1800 / fs, al = Math.sin(w) / (2 * 0.7071), c = Math.cos(w), a0 = 1 + al; Object.assign(this.fill, { b0: (1 + c) / 2 / a0, b1: -(1 + c) / a0, b2: (1 + c) / 2 / a0, a1: -2 * c / a0, a2: (1 - al) / a0 }); }
      this.e1 = Biq(pkC(1400, 0.9, 9, fs)); this.e2 = Biq(pkC(3600, 1.6, 2, fs)); this.lo = Biq(pkC(180, 0.7, -4, fs)); this.out = Biq(lpC(3600, 0.7071, fs));
      this.nb = Biq([0, 0, 0, 0, 0]); { const c = bpC(2600, 0.9, fs); Object.assign(this.nb, { b0: c[0], b1: 0, b2: -c[0], a1: c[1], a2: c[2] }); }
    }
    control(P, i) {
      const s = P.S[i], si = Math.floor(s), u = s - si, b = FLO * Math.pow(2, u), inv = P.inv;
      P.vibrato(this, N, i);
      // amplitude vibrato (the breath), ±3 % while resting, in phase with the pitch vibrato of the strongest voice
      this.av = 1 + 0.03 * P.slowV * sin1(this.vp[4]);
      const br = (0.5 + 0.5 * P.A[i]) * (0.75 + 0.35 * P.LD[i]);   // louder is brighter
      for (let k = 0; k < N; k++) { let kk = (k + si) % N; if (kk < 0) kk += N; const fc = Math.min(0.45 * P.fs, b * P2[kk] * 9 * br), x = 2 * Math.PI * fc * inv; this.lc[k] = x / (1 + x); }
    }
    run(P, n, Y) {
      const inv = P.inv, R = P.R, ph = this.ph, jit = this.jit, am = this.am, amT = this.amT, lp = this.lp, lc = this.lc, fm = this.fm;
      for (let i = 0; i < n; i++) {
        if ((P.ctl++ & 15) === 0) this.control(P, i);
        const s = P.S[i], si = Math.floor(s), u = s - si, b = FLO * Math.pow(2, u), cen = P.C[i];
        let src = 0, saws = 0, nz = 0;
        for (let k = 0; k < N; k++) {
          let kk = (k + si) % N; if (kk < 0) kk += N;
          const pos = kk + u, f = b * P2[kk] * fm[k] * jit[k], dt = f * inv, gk = bell(pos, cen, f, inv);
          let p = ph[k] + dt;
          if (gk === 0) { if (p >= 1) p -= Math.floor(p); ph[k] = p; continue; }
          if (p >= 1) { p -= 1; jit[k] = 1 + 0.001 * (2 * R() - 1); amT[k] = 1 + 0.02 * (2 * R() - 1); }
          ph[k] = p;
          let h = p + 0.5; if (h >= 1) h -= 1;
          const sq = (p < 0.5 ? 1 : -1) + blep(p, dt) - blep(h, dt), saw = 2 * p - 1 - blep(p, dt);
          lp[k] += lc[k] * (sq + 0.1 * saw - lp[k]); am[k] += (amT[k] - am[k]) * 0.004;
          src += gk * am[k] * lp[k]; saws += gk * saw; nz += gk * (p < 0.5 ? 1 : 0.25);   // the reed open half the period
        }
        const w = (2 * R() - 1) * nz * (0.05 + 0.5 * P.X[i]);
        let y = src * this.av + 0.18 * biq(this.fill, saws) + biq(this.nb, w);
        y = biq(this.out, biq(this.lo, biq(this.e2, biq(this.e1, y))));
        Y[i] = y;
      }
    }
  }

  // ---- the voice: the app's command protocol and smoothing (as src/sound.js's worklet), the kind's engine, the room
  class Timbre extends AudioWorkletProcessor {
    constructor(o) {
      super();
      const p = (o && o.processorOptions) || {};
      this.kind = KIND[p.kind] ? p.kind : 'cello'; const K = (this.K = KIND[this.kind]);
      this.q = []; this.fs = sampleRate; this.inv = 1 / sampleRate;
      this.s = 0; this.sFrom = 0; this.sTo = 0; this.sLen = 0; this.sPos = 0; this.fresh = true;
      this.c = 4.1; this.cT = this.c; this.ld = 1; this.ldT = 1; this.pan = 0; this.panT = 0;
      this.g = 0; this.g1 = 0; this.gT = 0; this.gA = this.coef(0.01); this.dk = 1; this.dk1 = 1; this.dkT = 1; this.dkA = this.coef(0.005); this.dkEnd = -1;
      this.aCL = this.coef(0.02); this.aPan = this.coef(0.03); this.end = -1;
      this.art = 0; this.aArt = this.coef(K.att); this.slowV = 0; this.sPrev = 0; this.aUp = this.coef(0.7); this.aDn = this.coef(0.15); this.ctl = 0; this.f0 = 0;
      this.R = prng(p.seed || ((currentFrame * 2654435761) >>> 0) || 1);
      this.gain = K.amp * (p.trim != null ? p.trim : 1);
      this.cmp = COMP[this.kind] ? Float32Array.from(COMP[this.kind]) : null; this.cg = 1; this.cgT = 1; this.aCg = this.coef(0.01);
      const B = 128; this.S = new Float64Array(B); this.C = new Float64Array(B); this.GN = new Float64Array(B); this.A = new Float64Array(B); this.X = new Float64Array(B); this.LD = new Float64Array(B);
      this.YL = new Float64Array(B); this.YR = new Float64Array(B);
      this.eng = this.kind === 'cello' ? new Cello(this) : this.kind === 'choir' ? new Choir(this, p.vowel) : this.kind === 'glass' ? new Glass(this) : new Reed(this);
      this.stereo = this.kind === 'choir';
      this.room(K.room[0], K.room[1]);
      this.tail = 0.5 + 1.2 * K.room[1];
      this.stat = { quanta: 0 };
      for (const c of p.cmds || []) this.push(c);
      this.port.onmessage = (e) => { for (const c of e.data) this.push(c); };
    }
    coef(tau) { return tau > 0 ? 1 - Math.exp(-1 / (tau * this.fs)) : 1; }
    // the compensation gain at chroma s and bell centre c: bilinear in (class, centre), circular in class
    comp(s, c) {
      const t = this.cmp, x = (s - Math.floor(s)) * 24, j0 = Math.floor(x) % 24, j1 = (j0 + 1) % 24, fx = x - Math.floor(x);
      let y = (c - 3.8) / 0.15; y = y < 0 ? 0 : y > 4 ? 4 : y; const i0 = Math.min(3, Math.floor(y)), fy = y - i0, a = i0 * 24, b = a + 24;
      const d = (t[a + j0] * (1 - fx) + t[a + j1] * fx) * (1 - fy) + (t[b + j0] * (1 - fx) + t[b + j1] * fx) * fy;
      return Math.pow(10, d / 20);
    }
    quiet() { return this.g < 1e-4 && this.g1 < 1e-4; }
    push(c) { c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }
    apply(c, frame) {
      if (c.snap != null) {
        let d = c.snap - this.s; d -= Math.round(d); this.sTo = this.s + d;
        if (this.quiet() || this.fresh) { this.s = this.sTo; this.sLen = 0; this.sPrev = this.s; } else { this.sFrom = this.s; this.sLen = Math.round(0.012 * this.fs); this.sPos = 0; }
      }
      if (c.ds != null) { this.sFrom = this.s; this.sTo += c.ds; this.sLen = Math.max(1, Math.round(c.dur * this.fs)); this.sPos = 0; }
      if (c.cc != null) { this.cT = c.cc; this.ldT = c.loud; if (this.fresh || this.quiet()) { this.c = this.cT; this.ld = this.ldT; } }
      if (c.pan != null) { this.panT = c.pan; if (this.fresh) this.pan = c.pan; }
      if (c.gate != null) { let tau = c.tau || 0.02; if (!c.gate && tau >= 0.05) tau *= this.K.rel; this.gT = c.gate; this.gA = this.coef(tau / 2); }
      if (c.duck != null) { this.dkT = 0.5; this.dkA = this.coef(0.005); this.dkEnd = frame + Math.round(c.duck * this.fs); }
      if (c.stop) { this.gT = 0; this.gA = this.coef((c.tau || 0.05) / 2); this.end = frame + Math.round(this.tail * this.fs); }
      if (c.trim != null) this.gain = this.K.amp * c.trim;
      this.fresh = false;
    }
    // each player's own vibrato (rate within [lo, hi] Hz, wandering ±0.35 Hz; depth wandering ±30 %) and intonation drift
    // (± dr cents, new targets every 0.9 to 1.9 s, 0.8 s smoother); det: fixed detunes (cents) by index mod det.length
    players(e, M, rate, dr, det) {
      const R = this.R;
      e.vp = new Float64Array(M).map(() => R()); e.vr = new Float64Array(M).map(() => rate[0] + (rate[1] - rate[0]) * R()); e.vr0 = Float64Array.from(e.vr); e.vrT = Float64Array.from(e.vr);
      e.vd = new Float64Array(M).fill(1); e.vdT = new Float64Array(M).fill(1); e.dv = new Float64Array(M); e.dvT = new Float64Array(M);
      e.nD = new Float64Array(M).map(() => R() * 1.4 * this.fs); e.dr = dr; e.det = det || [0]; e.M = M;
      e.kD = 1 - Math.exp(-16 / (0.8 * this.fs)); e.kV = 1 - Math.exp(-16 / (0.4 * this.fs));
    }
    vibrato(e, M, i) {
      const R = this.R, fr = this.f0 + i, K = this.K, step = 16 * this.inv;
      const depth = K.vib[0] * (K.vib[2] + (1 - K.vib[2]) * this.slowV), det = e.det, nd = det.length;
      for (let ix = 0; ix < M; ix++) {
        if (fr >= e.nD[ix]) { e.dvT[ix] = e.dr * (2 * R() - 1); e.vrT[ix] = e.vr0[ix] + 0.35 * (2 * R() - 1); e.vdT[ix] = 1 + 0.3 * (2 * R() - 1); e.nD[ix] = fr + (0.9 + R()) * this.fs; }
        e.dv[ix] += (e.dvT[ix] - e.dv[ix]) * e.kD; e.vr[ix] += (e.vrT[ix] - e.vr[ix]) * e.kV; e.vd[ix] += (e.vdT[ix] - e.vd[ix]) * e.kV;
        let v = e.vp[ix] + e.vr[ix] * step; if (v >= 1) v -= 1; e.vp[ix] = v;
        e.fm[ix] = Math.exp((det[ix % nd] + e.dv[ix] + depth * e.vd[ix] * sin1(v)) * CENT);
      }
    }
    // the short room: per channel a chain of 3 Schroeder allpasses (different delays left and right, so the two ears
    // decorrelate) and a one-pole darkening of the wet path. An allpass has a flat steady-state response, so the room
    // adds density and a ~0.2–0.5 s tail without the comb peaks a sparse feedback network would put on a pure tone.
    room(wet, t60) {
      const fs = this.fs, DL = [0.0047, 0.0083, 0.0127], DR = [0.0053, 0.0091, 0.0139];
      const mk = (D) => D.map((d) => { const n = Math.round(d * fs); return { b: new Float32Array(n), i: 0, g: Math.min(0.75, Math.pow(10, -3 * d / (t60 / 3))) }; });
      this.apL = mk(DL); this.apR = mk(DR); this.rwet = wet; this.rlL = 0; this.rlR = 0; this.rk = 1 - Math.exp(-2 * Math.PI * 4200 / fs);
    }
    process(_, outputs) {
      const out = outputs[0], L = out[0], Rt = out[1] || out[0], n = L.length, f0 = currentFrame, fs = this.fs;
      this.f0 = f0; this.stat.quanta++;
      let live = false;
      for (let i = 0; i < n; i++) {
        const fr = f0 + i;
        while (this.q.length && this.q[0].f <= fr) this.apply(this.q.shift(), fr);
        if (this.dkEnd >= 0 && fr >= this.dkEnd) { this.dkT = 1; this.dkA = this.coef(0.04); this.dkEnd = -1; }
        if (this.sLen > 0) { this.sPos++; if (this.sPos >= this.sLen) { this.s = this.sTo; this.sLen = 0; } else this.s = this.sFrom + (this.sTo - this.sFrom) * (this.sPos / this.sLen); }
        this.c += (this.cT - this.c) * this.aCL; this.ld += (this.ldT - this.ld) * this.aCL; this.pan += (this.panT - this.pan) * this.aPan;
        this.g1 += (this.gT - this.g1) * this.gA; this.g += (this.g1 - this.g) * this.gA;
        this.dk1 += (this.dkT - this.dk1) * this.dkA; this.dk += (this.dk1 - this.dk) * this.dkA;
        this.art += (this.g - this.art) * this.aArt;
        const rate = Math.abs(this.s - this.sPrev) * fs; this.sPrev = this.s;
        this.slowV += ((rate < 0.05 ? 1 : 0) - this.slowV) * (rate < 0.05 ? this.aUp : this.aDn);
        if (this.cmp && (fr & 15) === 0) this.cgT = this.comp(this.s, this.c);
        this.cg += (this.cgT - this.cg) * this.aCg;
        this.S[i] = this.s; this.C[i] = this.c + this.K.off; this.GN[i] = this.gain * this.cg * this.ld * this.g * this.dk; this.A[i] = this.art; this.LD[i] = this.ld;
        const x = this.g - this.art; this.X[i] = x > 0 ? x : 0;
        if (this.g > 1e-6 || this.g1 > 1e-6 || this.gT > 0) live = true;
      }
      const YL = this.YL, YR = this.YR, wet = this.rwet, apL = this.apL, apR = this.apR, rk = this.rk;
      if (live) {
        if (this.stereo) this.eng.run(this, n, YL, YR); else this.eng.run(this, n, YL);
        const th = (Math.max(-0.3, Math.min(0.3, this.pan)) + 1) * Math.PI / 4, cl = Math.cos(th), cr = Math.sin(th);
        for (let i = 0; i < n; i++) { const G = this.GN[i]; if (this.stereo) { YL[i] *= G; YR[i] *= G; } else { const y = YL[i] * G; YL[i] = y * cl; YR[i] = y * cr; } }
      } else { YL.fill(0); YR.fill(0); }
      // the room, fed by the voice after its gate, so a fade rings out in the room instead of stopping dead
      for (let i = 0; i < n; i++) {
        let xl = YL[i], xr = YR[i];
        for (let j = 0; j < 3; j++) {
          const a = apL[j], d = a.b[a.i], v = xl + a.g * d; a.b[a.i] = v; xl = d - a.g * v; if (++a.i >= a.b.length) a.i = 0;
          const c = apR[j], e = c.b[c.i], w = xr + c.g * e; c.b[c.i] = w; xr = e - c.g * w; if (++c.i >= c.b.length) c.i = 0;
        }
        this.rlL += rk * (xl - this.rlL); this.rlR += rk * (xr - this.rlR);
        L[i] = YL[i] + wet * this.rlL; if (Rt !== L) Rt[i] = YR[i] + wet * this.rlR;
      }
      return this.end < 0 || f0 < this.end;
    }
  }
  registerProcessor('cmw-timbre', Timbre);
}

// =====================================================================================================================
// The main thread
// =====================================================================================================================
const Timbres = (() => {
  const SRC = '(' + TIMBRE_WORKLET.toString() + ')();';
  const KINDS = ['cello', 'choir', 'glass', 'reed'];
  const NAMES = { cello: 'Cello (bowed string)', choir: 'Choir ("ah")', glass: 'Glass harmonica', reed: 'Clarinet' };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // the app's mappings (src/sound.js SH): register and loudness from ln|F|
  const lnc = (x) => (Number.isFinite(x) ? x : x > 0 ? 50 : -50);
  const centre = (lnAbs) => 4.1 + 0.3 * Math.tanh(lnc(lnAbs) / 2.5);
  const loudOf = (lnAbs) => 0.6 + 0.4 / (1 + Math.exp(-1.3 * (lnc(lnAbs) + 1)));
  const loaded = new WeakMap();
  // load the worklet into a context (a Blob URL, else a data: URL)
  function load(c) {
    if (loaded.has(c)) return loaded.get(c);
    const pr = (async () => {
      if (!c.audioWorklet) return false;
      const urls = [];
      try { urls.push(URL.createObjectURL(new Blob([SRC], { type: 'text/javascript' }))); } catch (e) { /* no Blob URLs */ }
      urls.push('data:text/javascript;charset=utf-8,' + encodeURIComponent(SRC));
      for (const u of urls) { try { await c.audioWorklet.addModule(u); return true; } catch (e) { /* next */ } }
      return false;
    })();
    loaded.set(c, pr); return pr;
  }
  function node(c, kind, opts = {}) {
    return new AudioWorkletNode(c, 'cmw-timbre', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: Object.assign({ kind, seed: opts.seed, vowel: opts.vowel, trim: opts.trim, cmds: opts.cmds || [] }) });
  }

  // ---- the simple control interface: one voice on a destination. Times are on the context's clock (default: now).
  //   setPitchClass(s, t, glide)   s = arg F in turns, continuous (unwrapped); the voice slews to it in `glide` s
  //   setLevel(lnAbs, t)           |F| → loudness 0.6…1 and register (the app's law)
  //   setRegister(cc, t)           the bell's centre (octaves above D1) directly, loudness unchanged
  //   gate(on, t, tau)  pan(p, t)  duck(hold, t)  stop(t)
  function voice(c, dest, kind, opts = {}) {
    const n = node(c, kind, opts); n.connect(dest);
    let sEnd = null, cc = 4.1, loud = 1;
    const now = (t) => (t != null ? t : c.currentTime + 0.012);
    const post = (cmd) => n.port.postMessage([cmd]);
    return {
      node: n, kind,
      setPitchClass(s, t, glide = 0.02) { if (sEnd === null) post({ at: now(t), snap: s - Math.floor(s), cc, loud }); else post({ at: now(t), ds: s - sEnd, dur: glide }); sEnd = s; },
      setLevel(lnAbs, t) { cc = centre(lnAbs); loud = loudOf(lnAbs); post({ at: now(t), cc, loud }); },
      setRegister(c2, t) { cc = c2; post({ at: now(t), cc, loud }); },
      pan(p, t) { post({ at: now(t), pan: clamp(p, -0.3, 0.3) }); },
      gate(on, t, tau) { post({ at: now(t), gate: on ? 1 : 0, tau: tau != null ? tau : on ? 0.02 : 0.08 }); },
      duck(hold, t) { post({ at: now(t), duck: hold }); },
      stop(t) { post({ at: now(t), stop: 1, tau: 0.05 }); setTimeout(() => { try { n.disconnect(); } catch (e) { /* gone */ } }, 3000 + Math.max(0, now(t) - c.currentTime) * 1000); },
    };
  }

  // ---- a drop-in for the app's Sound.ShepardVoice(G, T): the same main-thread logic (src/sound.js: the chroma plan, the
  // backlog rule — whole turns beyond one dropped, ≤ ~3 turns/s, a cut as a 12 ms glide —, gate, duck, chroma()), with
  // this worklet. G: Sound.graph(c, …) (its tier T, dry and a small room send, as the app's voices).
  function ShepardVoice(G, T, kind, opts = {}) {
    const c = G.c;
    let segs = [], sEnd = null;
    const at = (t) => { if (sEnd === null) return 0; for (let i = segs.length - 1; i >= 0; i--) { const g = segs[i]; if (t >= g.t0) return t >= g.t1 || g.t1 <= g.t0 ? g.s1 : g.s0 + (g.s1 - g.s0) * (t - g.t0) / (g.t1 - g.t0); } return segs.length ? segs[0].s0 : sEnd; };
    const inp = c.createGain(); inp.connect(G.tier[T].dry); const ws = c.createGain(); ws.gain.value = 0.08; inp.connect(ws); ws.connect(G.tier[T].wet);
    const pend = []; let nd = null;
    const make = () => { nd = node(c, kind, Object.assign({}, opts, { cmds: pend.splice(0) })); nd.connect(inp); };
    const post = (cmd) => { if (nd) nd.port.postMessage([cmd]); else pend.push(cmd); };
    if (G.offline) G.flush.push(make); else make();
    let off = 0, last = -1, lastWall = 0, dead = false, on = false, cc = 4.1, loud = 1;
    const v = {
      engine: 'worklet', kind,
      set(ph, lnAbs, pn = 0, t, jump = false) {
        if (dead) return 0;
        const explicit = t != null; if (!explicit) t = c.currentTime;
        const wall = performance.now();
        const dt = explicit ? (last < 0 ? 0.02 : clamp(t - last, 0.008, 0.05)) : (last < 0 ? 0.02 : clamp((wall - lastWall) / 1000, 0.008, 0.05));
        last = t; lastWall = wall; cc = centre(lnAbs); loud = loudOf(lnAbs);
        const pan = clamp(pn, -0.3, 0.3);
        if (sEnd === null) { off = Math.floor(ph); const f = ph - off; segs = [{ t0: t, t1: t, s0: f, s1: f }]; sEnd = f; post({ at: t, snap: f, cc, loud, pan }); return 0; }
        const cur = at(t); let back = ph - off - cur, dropped = 0;
        if (Math.abs(back) > 1) { const w = Math.sign(back) * (Math.ceil(Math.abs(back)) - 1); off += w; back -= w; dropped = w; }
        const dur = jump ? 0.012 : dt + 0.3 * Math.abs(back), s1 = cur + back, s0 = sEnd;
        segs = segs.filter((g) => g.t1 > t - 0.5 && g.t0 < t); segs.push({ t0: t, t1: t + dur, s0: cur, s1 }); sEnd = s1;
        post({ at: t, ds: s1 - s0, dur, cc, loud, pan });
        return dropped;
      },
      gate(g, t, tau) { if (dead) return; on = !!g; post({ at: t != null ? t : c.currentTime, gate: on ? 1 : 0, tau: tau != null ? tau : on ? 0.02 : 0.08 }); },
      duck: (t, hold) => { if (!dead && hold > 0) post({ at: t != null ? t : c.currentTime, duck: hold }); },
      sounding: () => on && !dead && sEnd !== null,
      chroma: (t = c.currentTime) => { const s = at(t); return s - Math.floor(s); },
      silence() { v.gate(false, undefined, 0.01); segs = []; sEnd = null; last = -1; },
      reset() { segs = []; sEnd = null; last = -1; },
      centre: () => cc,
      stop(t) { if (dead) return; on = false; const T0 = t != null ? t : c.currentTime; post({ at: T0, stop: 1, tau: 0.05 }); dead = true; if (!G.offline) setTimeout(() => { try { inp.disconnect(); } catch (e) { /* gone */ } }, 3000 + Math.max(0, T0 - c.currentTime) * 1000); },
    };
    return v;
  }

  // ---- make SoundB (the board's palette B) use a timbre for "hear the function": SoundB.voice() calls
  // Sound.ShepardVoice(G, 'sonify'); this routes that call here while pick() names a timbre ('' or 'glass-choir': B as is)
  function install(Sound, pick) {
    if (Sound.__timbres) return; Sound.__timbres = true;
    const orig = Sound.ShepardVoice;
    Sound.ShepardVoice = (G, T) => { const k = pick(); return KINDS.includes(k) ? ShepardVoice(G, T, k) : orig(G, T); };
  }
  return { SRC, KINDS, NAMES, load, node, voice, ShepardVoice, install, centre, loudOf, TIMBRE_WORKLET };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Timbres;
