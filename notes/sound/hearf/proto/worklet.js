'use strict';
// =====================================================================================================================
// hearf/options.html: the sound engine ("hf-engine"), one AudioWorklet processor for everything that is not the
// timbres.js voice (option 1 uses v2/timbres.js's "cmw-timbre" for its voice and its drone).
//   * cues and plucked strings: palette B's modal parts ('m' a decaying mode with a raised-cosine ring-in, 'n' a
//     Hann-windowed contact noise), posted as {k: 'cue', at, parts, pan, wet, str}. A string (str: 1) counts toward the
//     harp's polyphony of 12; the oldest is faded out over 30 ms (raised cosine) when a 13th arrives.
//   * the harmonic singer (options 3 and 4): one phase Φ at D3 with a living f0 (jitter, shimmer, a 5.2 Hz vibrato of
//     ±20 cents, ±8 while the spectrum moves), harmonics n = 1 … 24 of amplitudes A_n (each slewed by a one-pole) over a
//     sung vowel (the hum: harmonics 1–24 under formants, /u/ for the ring, /a/ for curves, about 7 dB under the note),
//     breath noise band-passed at the strongest harmonic and gated by the glottal phase, a short allpass room.
//     {k: 'hv', at, amps, gate, t1 (per-stage τ of the gate's two one-poles), lvl, slew, hum, vow (0 /u/, 1 /a/)}
//   * today's Shepard voice (the app's src/sound.js SH: 9 sines an octave apart under a fixed bell) for comparison:
//     {k: 'sh', at, snap | ds + dur, cc, loud, gate, tau}
//   * {k: 'vol', at, v}: the page's volume (smoothed, 30 ms); {k: 'hush', at}: everything fades in 20 ms (option switch).
// Click-free by construction: every gain, level and amplitude moves through one-pole smoothers (gates through two in
// cascade, so a fade starts with zero slope), pitch only by linear slews of a continuous phase, every part starts and
// ends at exactly 0. No AudioParam automation anywhere: a late command is applied on arrival, which adds latency, never
// a step.
// =====================================================================================================================
function HF_WORKLET() {
  'use strict';
  const TL = 4096, SINT = new Float32Array(TL + 1);
  for (let i = 0; i <= TL; i++) SINT[i] = Math.sin(2 * Math.PI * i / TL);
  const sin1 = (p) => { const x = p * TL, i = x | 0; return SINT[i] + (SINT[i + 1] - SINT[i]) * (x - i); };   // p ∈ [0, 1)
  function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rc = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);

  // ---- palette B's parts (v2/board/engine_b.js), unchanged in behaviour. A mode without a pitch drop (every harp string
  // and most cue partials) runs as a rotating phasor in three segments (ring-in, decay, the 12 ms fade to 0): the same
  // samples as B's table oscillator to within 1e-6, about twice as fast
  function Mode(c, fs) {
    if (!c.drop) return ModeR(c, fs);
    return ModeT(c, fs);
  }
  function ModeR(c, fs) {
    const nAtt = Math.max(1, Math.round(c.tau * fs)), nDec = Math.max(16, Math.round(c.t60 * fs)), n = nAtt + nDec, nF = Math.min(Math.round(0.012 * fs), nDec), a = c.a;
    const k = Math.exp(-6.9078 / nDec), w = 2 * Math.PI * c.f / fs, cr = Math.cos(w), sr = Math.sin(w), p0 = 2 * Math.PI * (c.ph || 0);
    let i = 0, e = 1, re = Math.cos(p0), im = Math.sin(p0);
    // advance first (B's oscillator increments the phase before it reads): sample i is sin(p0 + (i + 1) w)
    return { run(y, from, to) {
      let j = from;
      while (j < to && i < n) {
        if (i < nAtt) {   // ring-in (raised cosine)
          const end = Math.min(to, j + (nAtt - i));
          for (; j < end; j++, i++) { const t = re * cr - im * sr; im = re * sr + im * cr; re = t; y[j] += a * rc(i / nAtt) * im; }
        } else if (i <= n - nF) {   // decay
          const end = Math.min(to, j + (n - nF + 1 - i)); let ae = a * e;
          for (; j < end; j++, i++) { const t = re * cr - im * sr; im = re * sr + im * cr; re = t; y[j] += ae * im; ae *= k; }
          e = ae / a;
          const m = re * re + im * im; if (m < 0.999999 || m > 1.000001) { const s = 1 / Math.sqrt(m); re *= s; im *= s; }
        } else {   // the last 12 ms: a raised-cosine fade to exactly 0
          const end = Math.min(to, j + (n - i));
          for (; j < end; j++, i++) { const t = re * cr - im * sr; im = re * sr + im * cr; re = t; y[j] += a * e * rc((n - i) / nF) * im; e *= k; }
        }
      }
      return i < n;
    } };
  }
  function ModeT(c, fs) {
    const nAtt = Math.max(1, Math.round(c.tau * fs)), nDec = Math.max(16, Math.round(c.t60 * fs)), n = nAtt + nDec, nF = Math.min(Math.round(0.012 * fs), nDec);
    let i = 0, e = 1, p = c.ph || 0, dg = 1;
    const k = Math.exp(-6.9078 / nDec), f = c.f / fs, r = c.drop ? Math.pow(2, -c.drop / 12) : 1, kd = Math.exp(-1 / ((c.tdrop || 0.06) * fs)), a = c.a;
    return { run(y, from, to) {
      for (let j = from; j < to; j++) {
        if (i >= n) return false;
        let g;
        if (i < nAtt) g = rc(i / nAtt); else { g = e; e *= k; }
        if (i > n - nF) g *= rc((n - i) / nF);
        let fi = f; if (r !== 1) { fi *= r + (1 - r) * dg; dg *= kd; }
        p += fi; if (p >= 1) p -= 1;
        y[j] += a * g * sin1(p); i++;
      }
      return i < n;
    } };
  }
  function Noise(c, fs) {
    const n = Math.max(8, Math.round(c.dur * fs)), a = 1 - Math.exp(-2 * Math.PI * c.fc / fs), h = Math.exp(-2 * Math.PI * 250 / fs), R = prng(c.seed);
    let i = 0, lp = 0, hx = 0, hy = 0;
    return { run(y, from, to) {
      for (let j = from; j < to; j++) {
        if (i >= n) return false;
        lp += a * (2 * R() - 1 - lp); const v = h * (hy + lp - hx); hx = lp; hy = v;
        y[j] += c.a * v * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1))); i++;
      }
      return i < n;
    } };
  }
  const MAKE = { m: Mode, n: Noise };

  // ---- today's Shepard bell (src/sound.js SH)
  const N = 9, FLO = 36.7081, ISIG = 1 / 0.95, EDGE = 0.5, SHAMP = 0.0184;   // the app's 0.028, matched to its measured −32.8 LUFS-M (tools/calib.js)
  const GD = 8, GL = 8192, GT = new Float32Array(GL + 2); for (let i = 0; i <= GL + 1; i++) { const d = -GD + 2 * GD * i / GL; GT[i] = Math.exp(-0.5 * d * d); }
  const gauss = (d) => { if (d <= -GD || d >= GD) return 0; const x = (d + GD) * (GL / (2 * GD)), i = x | 0; return GT[i] + (GT[i + 1] - GT[i]) * (x - i); };
  const taper = (p) => { if (p <= 0 || p >= N) return 0; const e = p < N - p ? p : N - p; if (e >= EDGE) return 1; const s = Math.sin(0.5 * Math.PI * e / EDGE); return s * s; };
  const P2 = new Float64Array(N); for (let k = 0; k < N; k++) P2[k] = Math.pow(2, k);

  // ---- the harmonic singer
  const NH = 24, F0 = 146.8324;   // D3
  // the hum as a sung vowel (snd-1): a 1/n source under three formants, unit energy. /u/–/o/ (F1 400, F2 800, F3 2.5 kHz
  // and F4 3.4 kHz carry the singer’s ring) and /a/ (700, 1150, 2.6 kHz). The note's harmonic stays the strongest above the 3rd.
  function vowel(F1, F2, F3) {
    const a = new Float64Array(NH + 1); let e = 0;
    const res = (f, F, B, g) => g / Math.sqrt(1 + Math.pow((f - F) / B, 2));
    for (let n = 1; n <= NH; n++) { const f = n * F0; a[n] = (0.2 + res(f, F1, 90, 1) + res(f, F2, 120, 0.7) + res(f, F3, 300, 1.3) + res(f, 3400, 350, 0.8)) / n; e += a[n] * a[n]; }
    for (let n = 1; n <= NH; n++) a[n] /= Math.sqrt(e);
    return a;
  }
  const HUMV = [vowel(400, 800, 2500), vowel(700, 1150, 2600)];

  class Engine extends AudioWorkletProcessor {
    constructor(o) {
      super();
      const p = (o && o.processorOptions) || {};
      const fs = (this.fs = sampleRate); this.inv = 1 / fs;
      this.R = prng(p.seed || 12345);
      this.q = []; this.groups = []; this.strs = []; this.y = new Float32Array(128); this.dL = new Float32Array(128); this.dR = new Float32Array(128); this.wL = new Float32Array(128); this.wR = new Float32Array(128);
      this.stat = { quanta: 0, cues: 0, late: 0, maxLateMs: 0, steals: 0, maxGroups: 0, maxStrings: 0 };
      this.vol = p.vol != null ? p.vol : 1; this.volT = this.vol; this.aVol = this.coef(0.03);
      // harmonic voice
      const h = (this.hv = { A: new Float64Array(NH + 1), AT: new Float64Array(NH + 1), phi: new Float64Array(NH + 1), ph: 0, g: 0, g1: 0, gT: 0, gA: this.coef(0.01), aA: this.coef(0.03),
        lvl: 1, lvlT: 1, aL: 0.0007, jit: 0, jitT: 0, jitNext: 0, shim: 1, shimT: 1, vp: 0, vd: 0, lastChange: 0, bF: 0, bFT: 0, blo: 0, bbp: 0, nmax: 4, humT: 0.45, hum: 0.45, vow: 0, vowT: 0, H: new Float64Array(NH + 1), live: false });
      for (let n = 1; n <= NH; n++) h.H[n] = HUMV[0][n];
      for (let n = 1; n <= NH; n++) h.phi[n] = this.R();
      // today's Shepard voice
      this.sh = { s: 0, sFrom: 0, sTo: 0, sLen: 0, sPos: 0, fresh: true, c: 4.1, cT: 4.1, ld: 1, ldT: 1, g: 0, g1: 0, gT: 0, gA: this.coef(0.01), ph: new Float64Array(N).map(() => this.R()), aCL: this.coef(0.02) };
      // the room: per channel 4 Schroeder allpasses in series (after timbres.js), a one-pole darkening of the wet path
      const DL = [0.0047, 0.0083, 0.0127, 0.0211], DR = [0.0053, 0.0091, 0.0139, 0.0229], t60 = 0.55;
      const mk = (D) => D.map((d) => { const n = Math.round(d * fs); return { b: new Float32Array(n), i: 0, g: Math.min(0.72, Math.pow(10, -3 * d / (t60 / 3))) }; });
      this.apL = mk(DL); this.apR = mk(DR); this.rlL = 0; this.rlR = 0; this.rk = 1 - Math.exp(-2 * Math.PI * 4200 / fs);
      for (const c of p.cmds || []) this.push(c);
      this.port.onmessage = (e) => { if (e.data === 'stat') { this.port.postMessage(this.stat); return; } for (const c of e.data) this.push(c); };
    }
    coef(tau) { return tau > 0 ? 1 - Math.exp(-1 / (tau * this.fs)) : 1; }
    push(c) { c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }

    cue(c, f0) {
      // late: the whole cue moves to now (it still starts from 0)
      const sh = c.f < f0 ? f0 - c.f : 0; if (sh) { this.stat.late++; this.stat.maxLateMs = Math.max(this.stat.maxLateMs, 1000 * sh / this.fs); }
      this.stat.cues++;
      const start = c.f + sh, parts = [];
      for (const pt of c.parts) { const M = MAKE[pt.k]; if (M) parts.push({ s: start + Math.round((pt.d || 0) * this.fs), p: M(pt, this.fs) }); }
      const th = (Math.max(-0.4, Math.min(0.4, c.pan || 0)) + 1) * Math.PI / 4;
      const g = { parts, gl: Math.cos(th) * (c.gain || 1), gr: Math.sin(th) * (c.gain || 1), wet: c.wet || 0, str: !!c.str, fade: -1, fadeN: Math.round(0.03 * this.fs), t: start };
      // the live strings in order of age, kept as a list (no filter() per string on the audio thread; snd-9)
      if (g.str) {
        const cap = c.str > 1 ? c.str : 12, strs = this.strs;
        while (strs.length >= cap) { strs.shift().fade = 0; this.stat.steals++; }   // the oldest: a 30 ms raised-cosine fade
        strs.push(g);
        if (strs.length > this.stat.maxStrings) this.stat.maxStrings = strs.length;
      }
      this.groups.push(g);
      if (this.groups.length > this.stat.maxGroups) this.stat.maxGroups = this.groups.length;
    }
    apply(c, fr) {
      if (c.k === 'cue') return this.cue(c, fr);
      if (c.k === 'vol') { this.volT = c.v; return; }
      if (c.k === 'hush') {
        const h = this.hv; h.gT = 0; h.gA = this.coef(0.01);
        const s = this.sh; s.gT = 0; s.gA = this.coef(0.01);
        for (const g of this.groups) if (g.fade < 0) { g.fade = 0; g.fadeN = Math.round(0.02 * this.fs); }
        this.strs.length = 0;
        return;
      }
      if (c.k === 'hv') {
        const h = this.hv;
        if (c.amps) {
          let ch = 0, mx = 0, nm = 4;
          for (let n = 1; n <= NH; n++) { const a = c.amps[n - 1] || 0; ch += Math.abs(a - h.AT[n]); h.AT[n] = a; if (a > mx) { mx = a; nm = n; } }
          if (ch > 0.06) h.lastChange = fr;
          h.nmax = nm; h.bFT = Math.min(0.2 * this.fs, nm * F0) / this.fs;
          if (!h.live || (h.g < 1e-4 && h.g1 < 1e-4)) { for (let n = 1; n <= NH; n++) h.A[n] = h.AT[n]; h.bF = h.bFT; }
          h.live = true;
        }
        if (c.slew) h.aA = this.coef(c.slew);
        if (c.lvl != null) { h.lvlT = c.lvl; h.aL = this.coef(c.lt || 0.03); if (h.g < 1e-4 && h.g1 < 1e-4) h.lvl = c.lvl; }
        if (c.hum != null) h.humT = c.hum;
        if (c.vow != null) { h.vowT = c.vow; if (h.g < 1e-4 && h.g1 < 1e-4) h.vow = c.vow; }
        if (c.gate != null) { h.gT = c.gate; h.gA = this.coef(c.t1 || 0.01); }
        return;
      }
      if (c.k === 'sh') {
        const s = this.sh, quiet = s.g < 1e-4 && s.g1 < 1e-4;
        if (c.snap != null) { let d = c.snap - s.s; d -= Math.round(d); s.sTo = s.s + d; if (quiet || s.fresh) { s.s = s.sTo; s.sLen = 0; } else { s.sFrom = s.s; s.sLen = Math.round(0.012 * this.fs); s.sPos = 0; } }
        if (c.ds != null) { s.sFrom = s.s; s.sTo += c.ds; s.sLen = Math.max(1, Math.round(c.dur * this.fs)); s.sPos = 0; }
        if (c.cc != null) { s.cT = c.cc; s.ldT = c.loud; if (s.fresh || quiet) { s.c = s.cT; s.ld = s.ldT; } }
        if (c.gate != null) { s.gT = c.gate; s.gA = this.coef((c.tau || 0.02) / 2); }
        s.fresh = false;
      }
    }

    // the harmonic singer, samples [a, b) of the quantum into dL/dR (dry) and wL/wR (room send)
    runHV(a0, b0, f0) {
      const h = this.hv, A = h.A, AT = h.AT, phi = h.phi, aA = h.aA, inv = this.inv, R = this.R, fs = this.fs;
      if (!h.live) return;
      if (h.g < 1e-6 && h.g1 < 1e-6 && h.gT === 0) { h.g = h.g1 = 0; return; }
      const steadyN = 0.4 * fs;
      for (let i = a0; i < b0; i++) {
        const fr = f0 + i;
        if ((fr & 15) === 0) {
          // jitter: a new target in ±0.2 % every ~30 ms, followed with τ 30 ms; vibrato 5.2 Hz, ±20 cents while steady
          // and ±8 while the spectrum moves (a singer does not stop vibrato between notes; snd-1)
          if (fr >= h.jitNext) { h.jitT = 0.002 * (2 * R() - 1); h.jitNext = fr + Math.round((0.02 + 0.02 * R()) * fs); }
          h.jit += (h.jitT - h.jit) * 0.0177;   // 1 − exp(−16 / (0.03 fs))
          const vT = fr - h.lastChange > steadyN ? 1 : 0.4;
          h.vd += (vT - h.vd) * (vT > h.vd ? 0.0013 : 0.0066);   // up τ 0.25 s, down τ 0.05 s
          h.bF += (h.bFT - h.bF) * 0.03;
          h.hum += (h.humT - h.hum) * 0.01;
          if (h.vow !== h.vowT) { h.vow += (h.vowT - h.vow) * 0.01; if (Math.abs(h.vowT - h.vow) < 1e-4) h.vow = h.vowT; }
          const u = HUMV[0], aa = HUMV[1], v = h.vow; for (let n = 1; n <= NH; n++) h.H[n] = u[n] + (aa[n] - u[n]) * v;
        }
        h.g1 += (h.gT - h.g1) * h.gA; h.g += (h.g1 - h.g) * h.gA;
        h.lvl += (h.lvlT - h.lvl) * h.aL;
        h.shim += (h.shimT - h.shim) * 0.001;
        h.vp += 5.2 * inv; if (h.vp >= 1) h.vp -= 1;
        const fm = (1 + h.jit) * (1 + 0.01162 * h.vd * sin1(h.vp));   // 20 cents = 1.162 %
        let ph = h.ph + F0 * fm * inv;
        if (ph >= 1) { ph -= 1; h.shimT = Math.pow(10, (2 * R() - 1) * 0.5 / 20); }   // shimmer ±0.5 dB per period
        h.ph = ph;
        let y = 0;
        for (let k = 1; k <= NH; k++) {
          const a = (A[k] += (AT[k] - A[k]) * aA) + h.hum * h.H[k];
          if (a < 1e-5) continue;
          let p = k * ph + phi[k]; p -= Math.floor(p);
          y += a * sin1(p);
        }
        // breath: white noise band-passed (Chamberlin, q 6) at the strongest harmonic, louder in the open half period
        const F = 2 * Math.sin(Math.PI * h.bF), w = 2 * R() - 1;
        const hp = w - h.blo - h.bbp / 6; h.bbp += F * hp; h.blo += F * h.bbp;
        const open = 0.35 + 0.65 * (0.5 - 0.5 * sin1(ph < 0.5 ? ph + 0.5 : ph - 0.5));
        y += 0.246 * h.bbp * open;   // −24 dB re the voice (tools: breath check in PROTOTYPE.md)
        const G = h.g * h.lvl * h.shim * 0.0251;   // unit-RMS spectrum at lvl 1 → −32 LUFS-M (tools/calib.js)
        const v = y * G;
        this.dL[i] += v; this.dR[i] += v; this.wL[i] += 0.22 * v; this.wR[i] += 0.22 * v;
      }
    }
    // today's Shepard voice
    runSH(a0, b0) {
      const s = this.sh, inv = this.inv, ph = s.ph;
      if (s.g < 1e-6 && s.g1 < 1e-6 && s.gT === 0) { s.g = s.g1 = 0; for (let i = a0; i < b0; i++) { if (s.sLen > 0) { s.sPos++; if (s.sPos >= s.sLen) { s.s = s.sTo; s.sLen = 0; } else s.s = s.sFrom + (s.sTo - s.sFrom) * (s.sPos / s.sLen); } } return; }
      for (let i = a0; i < b0; i++) {
        if (s.sLen > 0) { s.sPos++; if (s.sPos >= s.sLen) { s.s = s.sTo; s.sLen = 0; } else s.s = s.sFrom + (s.sTo - s.sFrom) * (s.sPos / s.sLen); }
        s.c += (s.cT - s.c) * s.aCL; s.ld += (s.ldT - s.ld) * s.aCL;
        s.g1 += (s.gT - s.g1) * s.gA; s.g += (s.g1 - s.g) * s.gA;
        const si = Math.floor(s.s), u = s.s - si, b = FLO * Math.pow(2, u);
        let y = 0;
        for (let k = 0; k < N; k++) {
          let kk = (k + si) % N; if (kk < 0) kk += N;
          const f = b * P2[kk]; let p = ph[k] + f * inv; p -= Math.floor(p); ph[k] = p;
          const pos = kk + u; let gk = gauss((pos - s.c) * ISIG); if (gk < 2e-4) continue; gk *= taper(pos);
          const r = f * inv; if (r > 0.40) gk *= r >= 0.45 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (r - 0.40) / 0.05);
          y += gk * sin1(p);
        }
        const v = y * SHAMP * s.ld * s.g;
        this.dL[i] += v; this.dR[i] += v; this.wL[i] += 0.08 * v; this.wR[i] += 0.08 * v;
      }
    }
    process(_, outs) {
      const out = outs[0], L = out[0], Rt = out[1] || out[0], n = L.length, f0 = currentFrame, y = this.y, dL = this.dL, dR = this.dR, wL = this.wL, wR = this.wR;
      this.stat.quanta++;
      dL.fill(0); dR.fill(0); wL.fill(0); wR.fill(0);
      // commands: applied at their sample (the cues are placed by their own start frame inside the quantum)
      let pos = 0;
      while (this.q.length && this.q[0].f < f0 + n) {
        const c = this.q.shift();
        if (c.k === 'cue') { this.cue(c, f0); continue; }
        const at = Math.max(0, c.f - f0);
        if (at > pos) { this.slice(pos, at, f0); pos = at; }   // the voices up to the command's sample
        this.apply(c, f0 + at);
      }
      if (pos < n) this.slice(pos, n, f0);
      // cues and strings
      for (let gi = 0; gi < this.groups.length; gi++) {
        const g = this.groups[gi];
        y.fill(0);
        let alive = false;
        for (const pt of g.parts) {
          if (pt.done) continue;
          const from = Math.max(0, pt.s - f0); if (from >= n) { alive = true; continue; }
          if (pt.p.run(y, from, n)) alive = true; else pt.done = true;
        }
        if (g.fade >= 0) {
          for (let j = 0; j < n; j++) { const x = g.fade >= g.fadeN ? 0 : 1 - rc(g.fade / g.fadeN); y[j] *= x; g.fade++; }
          if (g.fade >= g.fadeN) alive = false;
        }
        const gl = g.gl, gr = g.gr, wl = gl * g.wet, wr = gr * g.wet;
        for (let j = 0; j < n; j++) { const v = y[j]; dL[j] += v * gl; dR[j] += v * gr; wL[j] += v * wl; wR[j] += v * wr; }
        if (!alive) { this.groups.splice(gi, 1); gi--; if (g.str) { const k = this.strs.indexOf(g); if (k >= 0) this.strs.splice(k, 1); } }
      }
      // the room and the output
      const apL = this.apL, apR = this.apR, rk = this.rk;
      for (let i = 0; i < n; i++) {
        let xl = wL[i], xr = wR[i];
        for (let j = 0; j < apL.length; j++) {
          const a = apL[j], d = a.b[a.i], v = xl + a.g * d; a.b[a.i] = v; xl = d - a.g * v; if (++a.i >= a.b.length) a.i = 0;
          const c = apR[j], e = c.b[c.i], w = xr + c.g * e; c.b[c.i] = w; xr = e - c.g * w; if (++c.i >= c.b.length) c.i = 0;
        }
        this.rlL += rk * (xl - this.rlL); this.rlR += rk * (xr - this.rlR);
        this.vol += (this.volT - this.vol) * this.aVol;
        let l = (dL[i] + this.rlL) * this.vol, r = (dR[i] + this.rlR) * this.vol;
        // a soft safety clip above 0.5 (normal levels peak near 0.06)
        if (l > 0.5) l = 0.5 + 0.5 * Math.tanh((l - 0.5) * 2); else if (l < -0.5) l = -0.5 - 0.5 * Math.tanh((-l - 0.5) * 2);
        if (r > 0.5) r = 0.5 + 0.5 * Math.tanh((r - 0.5) * 2); else if (r < -0.5) r = -0.5 - 0.5 * Math.tanh((-r - 0.5) * 2);
        L[i] = l; if (Rt !== L) Rt[i] = r;
      }
      return true;
    }
    slice(a, b, f0) { this.runHV(a, b, f0); this.runSH(a, b); }
  }
  registerProcessor('hf-engine', Engine);
}
if (typeof module !== 'undefined' && module.exports) module.exports = HF_WORKLET;
