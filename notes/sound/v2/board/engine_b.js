'use strict';
// =====================================================================================================================
// Sound v2 ("B"): the new palette of notes/sound/v2/DESIGN.md as an engine, for the sound board (board.html).
// Nothing here is in the app. It shares the app's graph (Sound.graph: panner law, tiers, the small dark room, the
// soft clipper) and the app's Shepard voice protocol (Sound.ShepardVoice: the exact chroma plan, gate, duck), so only
// what the sounds are made of differs.
//   * one AudioWorklet node ("cmwb-synth") renders every one-shot and the scrub texture sample by sample. The main
//     thread posts parameters only ({k: 'cue', at, parts: [...]}); variation is drawn on the main thread from a
//     per-play PRNG, so a seeded play is exact and repeatable. Every part starts at exactly 0 (raised-cosine ring-in
//     over the mallet contact, Hann-windowed noise) and ends at exactly 0 (a raised-cosine fade): a late message adds
//     latency, never a step. No AudioParam automation anywhere in B (the shared graph's gains only get the app's
//     follow() targets, through Sound).
//   * one AudioWorklet node per Shepard voice ("cmw-voice", the same command protocol as the app's): the glass choir.
//   Parts: 'm' a decaying mode (modal synthesis), 'n' a contact noise burst, 'air' band-passed noise gliding,
//   'bow' a bowed-glass tone (3 detuned sines). The texture ('tex') is a persistent voice that follows the speed of t.
// =====================================================================================================================
function B_WORKLET() {
  'use strict';
  const TL = 4096, SINT = new Float32Array(TL + 1);
  for (let i = 0; i <= TL; i++) SINT[i] = Math.sin(2 * Math.PI * i / TL);
  const sin1 = (p) => { const x = p * TL, i = x | 0; return SINT[i] + (SINT[i + 1] - SINT[i]) * (x - i); };   // p in [0, 1)
  function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rc = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);   // raised cosine 0 → 1 over x ∈ [0, 1]

  // ---- one-shot parts. run(y, from, to) adds into the mono scratch y; returns true while it has more to play
  function Mode(c, fs) {
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
  // contact: Hann-windowed white noise, one-pole low-pass at fc, one-pole high-pass at 250 Hz
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
  // air: white noise into a Chamberlin band-pass gliding fa → fb (exponential), raised-cosine envelope (rise att·dur,
  // fall the rest; exactly 0 at both ends), a 6-10 Hz random flutter of depth fl
  function Air(c, fs) {
    const n = Math.max(16, Math.round(c.dur * fs)), R = prng(c.seed), att = c.att == null ? 0.5 : c.att, q = c.q, iq = 1 / Math.sqrt(q), fl0 = c.fl || 0.15, ratio = c.fb / c.fa;
    let i = 0, lo = 0, bp = 0, F = 0, fl = 0, flt = 0;
    return { run(y, from, to) {
      for (let j = from; j < to; j++) {
        if (i >= n) return false;
        const u = i / n;
        if ((i & 7) === 0) { const fc = Math.min(c.fa * Math.pow(ratio, u), 0.2 * fs); F = 2 * Math.sin(Math.PI * fc / fs); }
        const hp = 2 * R() - 1 - lo - bp / q; bp += F * hp; lo += F * bp;
        if ((i & 63) === 0) flt = 2 * R() - 1; fl += (flt - fl) * 0.004;
        const e = u < att ? rc(u / att) : 1 - rc((u - att) / (1 - att));
        y[j] += c.a * e * (1 + fl0 * fl) * bp * iq; i++;
      }
      return i < n;
    } };
  }
  // bowed glass: 3 detuned sines (vs: [ratio, amp, phase]), raised-cosine attack, hold, exponential release, a 20 ms
  // raised-cosine fade to 0; an optional glide f0 → f1 on a raised cosine over `glide` s
  function Bow(c, fs) {
    const n1 = Math.max(1, Math.round(c.att * fs)), n2 = n1 + Math.round(c.hold * fs), n = n2 + Math.round(c.t60 * fs), nF = Math.round(0.02 * fs), k = Math.exp(-6.9078 / (n - n2));
    const nG = Math.max(1, Math.round((c.glide || 0.2) * fs)), lr = c.f1 ? Math.log(c.f1 / c.f0) : 0, vs = c.vs.map(([r, a, p]) => ({ f: c.f0 * r / fs, a, p }));
    let i = 0, e = 1, gl = 1;
    return { run(y, from, to) {
      for (let j = from; j < to; j++) {
        if (i >= n) return false;
        let g; if (i < n1) g = rc(i / n1); else if (i < n2) g = 1; else { g = e; e *= k; }
        if (i > n - nF) g *= rc((n - i) / nF);
        if (lr && i <= nG) gl = Math.exp(lr * rc(i / nG));
        let s = 0; for (const v of vs) { v.p += v.f * gl; if (v.p >= 1) v.p -= Math.floor(v.p); s += v.a * sin1(v.p); }
        y[j] += c.a * g * s; i++;
      }
      return i < n;
    } };
  }
  const MAKE = { m: Mode, n: Noise, air: Air, bow: Bow };

  // the scrub / motion texture: pink-ish noise into two band-passes (fc follows t: 380 Hz at t = 0, 1.75 kHz at t = 1;
  // the second 2.3× up at 0.35), a 3.5 kHz output low-pass, a 15 % flutter; level from the smoothed speed of t
  // (attack 25 ms, release 160 ms): silent below 0.1 t/s and when the hand holds still (no update for `hold` s)
  function Tex(fs, seed) {
    const R = prng(seed), aA = 1 - Math.exp(-1 / (0.025 * fs)), aP = 1 - Math.exp(-2 * Math.PI * 900 / fs), aO = 1 - Math.exp(-2 * Math.PI * 3500 / fs), aG = 1 - Math.exp(-1 / (0.006 * fs)), aT = 1 - Math.exp(-32 / (0.02 * fs));
    return { v: 0, vT: 0, t: 0, tT: 0, g: 0, g1: 0, gT: 0, amp: 0.06, tier: 1, wet: 0.12, pan: 0, last: 0, hold: 0.09 * fs, aR: 1 - Math.exp(-1 / (0.16 * fs)), end: false, fresh: true,
      lo1: 0, bp1: 0, lo2: 0, bp2: 0, pk: 0, ol: 0, fl: 0, flt: 0, F1: 0, F2: 0, i: 0,
      set(c, frame) {
        if (c.amp != null) this.amp = c.amp; if (c.tier != null) this.tier = c.tier; if (c.wet != null) this.wet = c.wet; if (c.pan != null) this.pan = c.pan;
        if (c.hold != null) this.hold = c.hold * fs;
        if (c.t != null) { this.tT = c.t; if (this.fresh) this.t = c.t; }
        if (c.v != null) this.vT = c.v;
        if (c.end) { this.end = true; this.vT = 0; this.aR = 1 - Math.exp(-1 / ((c.rel || 0.16) * fs)); }
        else this.aR = 1 - Math.exp(-1 / (0.16 * fs));
        this.last = frame; this.fresh = false;
      },
      silent(f0) { if (f0 - this.last > this.hold) this.vT = 0; return this.g < 1e-6 && this.g1 < 1e-6 && this.gT === 0 && this.v < 0.02 && this.vT < 0.02; },
      run(y, f0, n) {
        for (let j = 0; j < n; j++) {
          if (f0 + j - this.last > this.hold) this.vT = 0;
          this.v += (this.vT - this.v) * (this.vT > this.v ? aA : this.aR);
          if ((this.i++ & 31) === 0) {
            const v = this.v, x = Math.min(1, Math.max(0, (v - 0.1) / 0.3)), lvl = x * x * (3 - 2 * x) * Math.min(1, Math.pow(v / 2.5, 0.6));
            this.t += (this.tT - this.t) * aT;
            const fc = 380 * Math.pow(2, 2.2 * Math.min(1, Math.max(0, this.t))) * (1 + 0.12 * lvl);
            this.F1 = 2 * Math.sin(Math.PI * fc / fs); this.F2 = 2 * Math.sin(Math.PI * Math.min(2.3 * fc, 0.2 * fs) / fs);
            this.gT = this.amp * lvl;
          }
          this.g1 += (this.gT - this.g1) * aG; this.g += (this.g1 - this.g) * aG;   // two one-poles: every swell starts with zero slope
          this.pk += aP * (2 * R() - 1 - this.pk); const w = 3 * this.pk;
          let hp = w - this.lo1 - this.bp1 / 1.6; this.bp1 += this.F1 * hp; this.lo1 += this.F1 * this.bp1;
          hp = w - this.lo2 - this.bp2 / 1.6; this.bp2 += this.F2 * hp; this.lo2 += this.F2 * this.bp2;
          if ((this.i & 63) === 0) this.flt = 2 * R() - 1; this.fl += (this.flt - this.fl) * 0.004;
          this.ol += aO * ((this.bp1 + 0.35 * this.bp2) * 0.7906 - this.ol);
          y[j] = this.g * (1 + 0.15 * this.fl) * this.ol;
        }
      },
    };
  }

  // outputs: 2·tier = dry, 2·tier + 1 = the room send (already scaled by the cue's wet); each stereo
  class Synth extends AudioWorkletProcessor {
    constructor(o) {
      super();
      this.fs = sampleRate; this.q = []; this.cues = []; this.tex = new Map(); this.y = new Float32Array(128); this.stat = { cues: 0, late: 0, maxLateMs: 0 };
      const p = (o && o.processorOptions) || {};
      for (const c of p.cmds || []) this.push(c);
      this.port.onmessage = (e) => { if (e.data === 'stat') { this.port.postMessage(this.stat); return; } for (const c of e.data) this.push(c); };
    }
    push(c) { c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }
    mix(outs, tier, pan, g, wet, y, n) {
      const th = (Math.max(-0.4, Math.min(0.4, pan)) + 1) * Math.PI / 4, gl = g * Math.cos(th), gr = g * Math.sin(th);
      const D = outs[2 * tier], W = outs[2 * tier + 1];
      if (D && D[0]) { const L = D[0], Rr = D[1] || D[0]; for (let j = 0; j < n; j++) { L[j] += y[j] * gl; if (Rr !== L) Rr[j] += y[j] * gr; } }
      if (wet && W && W[0]) { const L = W[0], Rr = W[1] || W[0], wl = gl * wet, wr = gr * wet; for (let j = 0; j < n; j++) { L[j] += y[j] * wl; if (Rr !== L) Rr[j] += y[j] * wr; } }
    }
    process(_, outs) {
      const f0 = currentFrame, n = outs[0][0].length, y = this.y, fs = this.fs;
      while (this.q.length && this.q[0].f < f0 + n) {
        const c = this.q.shift();
        if (c.k === 'cue') {
          // late (the message arrived after its time): the whole cue moves to now; it still starts from 0
          const sh = c.f < f0 ? f0 - c.f : 0; if (sh) { this.stat.late++; this.stat.maxLateMs = Math.max(this.stat.maxLateMs, 1000 * sh / fs); }
          this.stat.cues++;
          this.cues.push({ tier: c.tier, pan: c.pan || 0, g: c.g == null ? 1 : c.g, wet: c.wet || 0, parts: c.parts.map((p) => ({ sf: c.f + sh + Math.round((p.d || 0) * fs), v: MAKE[p.k](p, fs), live: true })) });
        } else if (c.k === 'tex') {
          let T = this.tex.get(c.id); if (!T) { T = Tex(fs, c.seed || 7); this.tex.set(c.id, T); }
          T.set(c, Math.max(c.f, f0));
        }
      }
      for (let ci = this.cues.length - 1; ci >= 0; ci--) {
        const cue = this.cues[ci]; y.fill(0); let more = false, any = false;
        for (const p of cue.parts) {
          if (!p.live) continue;
          if (p.sf >= f0 + n) { more = true; continue; }
          any = true; p.live = p.v.run(y, Math.max(0, p.sf - f0), n); if (p.live) more = true;
        }
        if (any) this.mix(outs, cue.tier, cue.pan, cue.g, cue.wet, y, n);
        if (!more) this.cues.splice(ci, 1);
      }
      for (const [id, T] of this.tex) {
        if (T.silent(f0)) { if (T.end || f0 - T.last > 30 * fs) this.tex.delete(id); continue; }
        T.run(y, f0, n); this.mix(outs, T.tier, T.pan, 1, T.wet, y, n);
      }
      return true;
    }
  }
  registerProcessor('cmwb-synth', Synth);

  // ---- the glass choir: the app's Shepard voice (same commands, same chroma, gate, duck, pan), each octave partial
  // made of 3 voices (−3.5, 0, +3.5 cents; 0.13 / 0.74 / 0.13; panned −0.25 / 0 / +0.25 around the voice's pan) whose
  // detune drifts ±1.5 cents and level ±0.06 (new targets every ~1.4 s, 0.8 s smoother); a shared 5.1 Hz vibrato of
  // 6 cents × s, s → 1 (τ 0.7 s) while the chroma moves slower than 0.05 turn/s, → 0 (τ 0.15 s) when it moves; the
  // bell's centre wanders ±0.06 octave (timbre only); breath: noise band-passed at the bell's centre, −24 dB.
  // The 'height' kind is the app's organ, unchanged.
  const N = 9, FLO = 36.7081, ISIG = 1 / 0.95, EDGE = 0.5, AMP = 0.028 * 1.22;
  const ORG = [1, 1 / 2, 1 / 3, 1 / 4]; let ONORM = 0;
  for (let i = 0; i < 4096; i++) { const a = 2 * Math.PI * i / 4096; let s = 0; for (let h = 0; h < 4; h++) s += ORG[h] * Math.sin((h + 1) * a); ONORM = Math.max(ONORM, Math.abs(s)); }
  ONORM = 1 / ONORM;
  const GD = 8, GL = 8192, GT = new Float32Array(GL + 2); for (let i = 0; i <= GL + 1; i++) { const d = -GD + 2 * GD * i / GL; GT[i] = Math.exp(-0.5 * d * d); }
  const gauss = (d) => { if (d <= -GD || d >= GD) return 0; const x = (d + GD) * (GL / (2 * GD)), i = x | 0; return GT[i] + (GT[i + 1] - GT[i]) * (x - i); };
  const taper = (p) => { if (p <= 0 || p >= N) return 0; const e = p < N - p ? p : N - p; if (e >= EDGE) return 1; const s = Math.sin(0.5 * Math.PI * e / EDGE); return s * s; };
  const P2 = new Float64Array(N); for (let k = 0; k < N; k++) P2[k] = Math.pow(2, k);
  const DET = [-3.5, 0, 3.5], VA = [0.13, 0.74, 0.13], SPR = [-0.25, 0, 0.25], CENT = Math.LN2 / 1200, M = 3;
  class Voice extends AudioWorkletProcessor {
    constructor(o) {
      super();
      const p = (o && o.processorOptions) || {};
      this.kind = p.kind || 'shepard'; this.q = []; this.fs = sampleRate;
      this.s = 0; this.sFrom = 0; this.sTo = 0; this.sLen = 0; this.sPos = 0; this.fresh = true;
      this.c = 4.1; this.cT = this.c; this.ld = 1; this.ldT = 1; this.pan = 0; this.panT = 0;
      this.g = 0; this.g1 = 0; this.gT = 0; this.gA = this.coef(0.01); this.dk = 1; this.dk1 = 1; this.dkT = 1; this.dkA = this.coef(0.005); this.dkEnd = -1;
      this.aCL = this.coef(0.02); this.aPan = this.coef(0.03); this.aAmp = this.coef(0.012);
      this.end = -1; this.amp = 0; this.ampT = 0;
      // the choir's own state
      const R = (this.R = prng(p.seed || ((currentFrame * 2654435761) >>> 0) || 1));
      this.ph = new Float64Array(N * M).map(() => R());
      this.dv = new Float64Array(N * M); this.dvT = new Float64Array(N * M); this.da = new Float64Array(N * M); this.daT = new Float64Array(N * M);
      this.nextD = new Float64Array(N * M).map(() => currentFrame + R() * 1.4 * this.fs);
      this.slow = 0; this.sPrev = 0; this.vibP = R(); this.cw = 0; this.cwT = 0; this.cwNext = 0; this.lo = 0; this.bp = 0; this.bF = 0.08; this.ctl = 0;
      this.PL = new Float64Array(M); this.PR = new Float64Array(M);
      this.aD = 1 - Math.exp(-32 / (0.8 * this.fs)); this.aCw = 1 - Math.exp(-32 / (2 * this.fs)); this.aUp = this.coef(0.7); this.aDn = this.coef(0.15);
      for (const c of p.cmds || []) this.push(c);
      this.port.onmessage = (e) => { for (const c of e.data) this.push(c); };
    }
    coef(tau) { return tau > 0 ? 1 - Math.exp(-1 / (tau * this.fs)) : 1; }
    quiet() { return this.g < 1e-4 && this.g1 < 1e-4; }
    push(c) { c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }
    apply(c, frame) {
      if (c.snap != null) {
        let d = c.snap - this.s; d -= Math.round(d); this.sTo = this.s + d;
        if (this.quiet() || this.fresh) { this.s = this.sTo; this.sLen = 0; this.sPrev = this.s; } else { this.sFrom = this.s; this.sLen = Math.round(0.012 * this.fs); this.sPos = 0; }
      }
      if (c.ds != null) { this.sFrom = this.s; this.sTo += c.ds; this.sLen = Math.max(1, Math.round(c.dur * this.fs)); this.sPos = 0; }
      if (c.lf != null) {
        if (this.fresh || this.quiet()) { this.s = this.sTo = c.lf; this.sLen = 0; } else { this.sFrom = this.s; this.sTo = c.lf; this.sLen = Math.max(1, Math.round((c.dur || 0.008) * this.fs)); this.sPos = 0; }
      }
      if (c.cc != null) { this.cT = c.cc; this.ldT = c.loud; if (this.fresh || this.quiet()) { this.c = this.cT; this.ld = this.ldT; } }
      if (c.pan != null) { this.panT = c.pan; if (this.fresh) this.pan = c.pan; }
      if (c.amp != null) { this.ampT = c.amp; if (this.fresh || this.quiet()) this.amp = c.amp; }
      if (c.gate != null) { this.gT = c.gate; this.gA = this.coef(c.tau / 2); }
      if (c.duck != null) { this.dkT = 0.5; this.dkA = this.coef(0.005); this.dkEnd = frame + Math.round(c.duck * this.fs); }
      if (c.stop) { this.gT = 0; this.gA = this.coef((c.tau || 0.05) / 2); this.end = frame + Math.round(0.5 * this.fs); }
      this.fresh = false;
    }
    control(fr) {
      // every 32 samples: drift, colour, pans, breath band (all slow; steps of < 0.1 % of their range)
      const R = this.R, fs = this.fs;
      for (let ix = 0; ix < N * M; ix++) {
        if (fr >= this.nextD[ix]) { this.dvT[ix] = 3 * R() - 1.5; this.daT[ix] = 0.12 * R() - 0.06; this.nextD[ix] = fr + (0.9 + R()) * fs; }
        this.dv[ix] += (this.dvT[ix] - this.dv[ix]) * this.aD; this.da[ix] += (this.daT[ix] - this.da[ix]) * this.aD;
      }
      if (fr >= this.cwNext) { this.cwT = 2 * R() - 1; this.cwNext = fr + (2.2 + R()) * fs; }
      this.cw += (this.cwT - this.cw) * this.aCw;
      for (let m = 0; m < M; m++) { const th = (Math.max(-0.6, Math.min(0.6, this.pan + SPR[m])) + 1) * Math.PI / 4; this.PL[m] = Math.cos(th); this.PR[m] = Math.sin(th); }
      this.bF = 2 * Math.sin(Math.PI * Math.min(FLO * Math.pow(2, this.c + 0.06 * this.cw), 0.2 * fs) / fs);
    }
    process(_, outputs) {
      const out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length, f0 = currentFrame, fs = this.fs, inv = 1 / fs, ph = this.ph;
      const height = this.kind === 'height';
      for (let i = 0; i < n; i++) {
        const fr = f0 + i;
        while (this.q.length && this.q[0].f <= fr) this.apply(this.q.shift(), fr);
        if (this.dkEnd >= 0 && fr >= this.dkEnd) { this.dkT = 1; this.dkA = this.coef(0.04); this.dkEnd = -1; }
        if (this.sLen > 0) { this.sPos++; if (this.sPos >= this.sLen) { this.s = this.sTo; this.sLen = 0; } else this.s = this.sFrom + (this.sTo - this.sFrom) * (this.sPos / this.sLen); }
        this.c += (this.cT - this.c) * this.aCL; this.ld += (this.ldT - this.ld) * this.aCL; this.pan += (this.panT - this.pan) * this.aPan;
        this.g1 += (this.gT - this.g1) * this.gA; this.g += (this.g1 - this.g) * this.gA;
        this.dk1 += (this.dkT - this.dk1) * this.dkA; this.dk += (this.dk1 - this.dk) * this.dkA; this.amp += (this.ampT - this.amp) * this.aAmp;
        let yl = 0, yr = 0;
        if (this.g > 1e-6 || this.g1 > 1e-6 || this.gT > 0) {
          if (height) {
            const f = Math.pow(2, this.s); let p = ph[0] + f * inv; p -= Math.floor(p); ph[0] = p;
            let acc = 0; for (let h = 0; h < 4; h++) { const fh = f * (h + 1); if (fh < 0.45 * fs) { let q = p * (h + 1); q -= Math.floor(q); acc += ORG[h] * sin1(q); } }
            const y = acc * ONORM * this.amp * this.g * this.dk, th = (this.pan + 1) * Math.PI / 4; yl = y * Math.cos(th); yr = y * Math.sin(th);
          } else {
            if ((this.ctl++ & 31) === 0) this.control(fr);
            const rate = Math.abs(this.s - this.sPrev) * fs; this.sPrev = this.s;
            this.slow += ((rate < 0.05 ? 1 : 0) - this.slow) * (rate < 0.05 ? this.aUp : this.aDn);
            this.vibP += 5.1 * inv; if (this.vibP >= 1) this.vibP -= 1;
            const vib = 1 + 6 * this.slow * CENT * sin1(this.vibP);
            const si = Math.floor(this.s), u = this.s - si, b = FLO * Math.pow(2, u), cen = this.c + 0.06 * this.cw;
            let al = 0, ar = 0;
            for (let k = 0; k < N; k++) {
              let kk = (k + si) % N; if (kk < 0) kk += N;
              const pos = kk + u, f = b * P2[kk];
              let gk = gauss((pos - cen) * ISIG);
              if (gk < 1e-9) { for (let m = 0; m < M; m++) { const ix = k * M + m; let p = ph[ix] + f * inv; if (p >= 1) p -= Math.floor(p); ph[ix] = p; } continue; }
              gk *= taper(pos);
              const r = f * inv; if (r > 0.40) gk *= r >= 0.45 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (r - 0.40) / 0.05);
              for (let m = 0; m < M; m++) {
                const ix = k * M + m, fi = f * (1 + (DET[m] + this.dv[ix]) * CENT) * vib;
                let p = ph[ix] + fi * inv; if (p >= 1) p -= Math.floor(p); ph[ix] = p;
                const s = gk * VA[m] * (1 + this.da[ix]) * sin1(p);
                al += s * this.PL[m]; ar += s * this.PR[m];
              }
            }
            // breath at the bell's centre (q 0.8), equal in both ears
            const hp = 2 * this.R() - 1 - this.lo - this.bp / 0.8; this.bp += this.bF * hp; this.lo += this.bF * this.bp;
            const br = 0.035 * 0.7071 * this.bp;
            const G = AMP * this.ld * this.g * this.dk; yl = (al + br) * G; yr = (ar + br) * G;
          }
        }
        L[i] = yl; if (R !== L) R[i] = yr;
      }
      return this.end < 0 || f0 < this.end;
    }
  }
  registerProcessor('cmw-voice', Voice);
}

const SoundB = (() => {
  const TIERS = ['ui', 'events', 'sonify'], TI = { ui: 0, events: 1, sonify: 2 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const TAU = 2 * Math.PI;
  const SRC = '(' + B_WORKLET.toString() + ')();';
  let url = null;
  async function loadModule(c) {
    const urls = [];
    try { if (!url) url = URL.createObjectURL(new Blob([SRC], { type: 'text/javascript' })); urls.push(url); } catch (e) { /* no Blob URLs */ }
    urls.push('data:text/javascript;charset=utf-8,' + encodeURIComponent(SRC));
    for (const u of urls) { try { await c.audioWorklet.addModule(u); return true; } catch (e) { /* next */ } }
    return false;
  }

  // ---------------------------------------------------------------- variation (a PRNG per play)
  function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let R = prng(1);
  const rnd = (a, b) => a + (b - a) * R();
  const vdb = (db) => Math.pow(10, rnd(-db, db) / 20);
  const cents = (c) => Math.pow(2, c / 1200);
  const seed32 = () => (R() * 4294967296) >>> 0;
  let XF = 1, FS = 48000;
  const D4 = 293.665, st0 = (n) => D4 * Math.pow(2, n / 12), st = (n) => XF * st0(n);
  const PENTA = [0, 2, 4, 7, 9], penta = (k) => XF * st0(12 + 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5]);

  // ---------------------------------------------------------------- materials (DESIGN §1.1)
  const MAT = {
    wood: { r: [1, 3.93, 9.2], a: [1, 0.22, 0.06], d: [1, 0.32, 0.12], b: [0, 0, 0], knock: 0.10, kf: 1800 },
    tine: { r: [1, 6.267, 17.55], a: [1, 0.10, 0.025], d: [1, 0.22, 0.08], b: [0, 0, 0], knock: 0.05, kf: 2500 },
    glass: { r: [1, 2.32, 4.25, 6.63], a: [1, 0.34, 0.14, 0.05], d: [1, 0.55, 0.30, 0.17], b: [0.8, 1.6, 2.5, 3.1], knock: 0.025, kf: 4000 },
    bar: { r: [1, 2.756, 5.404, 8.933], a: [1, 0.26, 0.08, 0.025], d: [1, 0.45, 0.20, 0.10], b: [0.5, 1.2, 0, 0], knock: 0.03, kf: 3500 },
    skin: { r: [1, 1.593, 2.136, 2.296], a: [1, 0.45, 0.25, 0.18], d: [1, 0.6, 0.45, 0.4], b: [0, 0, 0, 0], knock: 0.22, kf: 1500 },
    block: { r: [1, 2.4, 3.9], a: [1, 0.45, 0.2], d: [1, 0.5, 0.3], b: [0, 0, 0], knock: 0.30, kf: 1200 },
  };
  const mallet = (f, tau) => 1 / (1 + Math.pow(2 * f * tau, 2));
  const tauOf = (vel, soft) => soft * Math.pow(clamp(vel, 0.05, 1), -0.2) * 0.001;
  // the primitives write parts (d: delay in s inside the cue)
  function strike(P, d, f0, mat, o) {
    const M = MAT[mat], vel = clamp((o.vel == null ? 0.7 : o.vel) * rnd(0.92, 1.08), 0.05, 1), tau = tauOf(vel, o.soft || 1.2);
    const dt = o.detune == null ? 3 : o.detune, f = f0 * cents(rnd(-dt, dt));
    const g = (o.amp || 0.1) * vel * vdb(o.var == null ? 1 : o.var), t60 = (o.t60 || 0.3) * rnd(0.88, 1.12), w0 = mallet(f, tau);
    for (let j = 0; j < M.r.length; j++) {
      const fj = f * M.r[j]; if (fj >= 0.45 * FS) continue;
      const aj = g * M.a[j] * mallet(fj, tau) / w0 * (j ? vdb(1.5) : 1), tj = t60 * M.d[j];
      if (M.b[j]) {   // a split pair beating at b Hz, both halves in phase at the strike: the ring "breathes"
        const bb = M.b[j] * rnd(0.8, 1.25), ph = R(), r2 = rnd(0.3, 0.6);
        P.push({ k: 'm', d, f: fj - bb / 2, a: aj * (1 - r2), t60: tj, tau, ph, drop: o.drop });
        P.push({ k: 'm', d, f: fj + bb / 2, a: aj * r2, t60: tj * 0.9, tau, ph, drop: o.drop });
      } else P.push({ k: 'm', d, f: fj, a: aj, t60: tj, tau, ph: 0, drop: o.drop });
    }
    if (M.knock) P.push({ k: 'n', d, dur: Math.max(0.002, 2.5 * tau), fc: Math.min(M.kf * (0.6 + 0.8 * vel), 6000), a: g * M.knock * (o.knock == null ? 1 : o.knock), seed: seed32() });
  }
  // a muted pluck as a modal string (harmonics, slightly stretched, low-passed by `bright`, the upper ones shorter):
  // the spectrum a Karplus-Strong string settles into, in the same one primitive as the strikes
  function pluck(P, d, f0, o) {
    const f = f0 * cents(rnd(-3, 3)), g = (o.amp || 0.1) * vdb(1.5), t60 = o.t60 || 0.4, fcut = -Math.log(1 - clamp(o.bright == null ? 0.5 : o.bright, 0.05, 0.95)) * FS / TAU;
    const hs = []; let norm = 0;
    for (let n = 1; n <= 8; n++) { const fn = f * n * (1 + 0.0008 * n * n); if (fn > 0.45 * FS) break; const a = 1 / Math.sqrt(1 + Math.pow(fn / fcut, 2)) / Math.sqrt(n); hs.push([fn, a, t60 / (1 + 0.35 * (n - 1))]); norm += a; }
    for (const [fn, a, tj] of hs) P.push({ k: 'm', d, f: fn, a: 1.6 * g * a / norm, t60: tj * rnd(0.9, 1.1), tau: 0.0004, ph: R() });
    P.push({ k: 'n', d, dur: 0.002, fc: Math.min(2 * fcut, 6000), a: 0.1 * g, seed: seed32() });
  }
  const air = (P, d, dur, fa, fb, q, amp, o = {}) => P.push({ k: 'air', d, dur, fa, fb, q, a: amp, att: o.att, fl: o.fl, seed: seed32() });
  const bowed = (P, d, f0, o) => P.push({ k: 'bow', d, f0, f1: o.f1, glide: o.glide, att: o.att || 0.2, hold: o.hold || 0.1, t60: o.t60 || 0.6, a: (o.amp || 0.05) * vdb(1),
    vs: [[-5, 0.34], [0.3, 0.4], [5.5, 0.26]].map(([c, a]) => [cents(c + rnd(-1.5, 1.5)), a, R()]) });

  // ---------------------------------------------------------------- the catalog (DESIGN §2). trim: dB, from the
  // level match against A (MEASUREMENTS.md); count: count-bearing, never softened by repetition (§1.4)
  const S = (s) => s;
  const CAT = {
    snap: { tier: 'ui', gap: 125, wet: 0.05, make: (P, o) => strike(P, 0, 2100, 'block', { vel: o.vel == null ? 0.5 : o.vel, soft: 0.5, t60: 0.03, amp: 0.28, detune: 60, var: 2.5 }) },
    toggleOn: { tier: 'ui', gap: 60, wet: 0.08, make: (P, o) => strike(P, 0, st0(19), 'tine', { vel: o.vel == null ? 0.65 : o.vel, soft: 1.1, t60: 0.24, amp: 0.265, detune: 6 }) },
    toggleOff: { tier: 'ui', gap: 60, wet: 0.08, make: (P, o) => strike(P, 0, st0(14), 'tine', { vel: o.vel == null ? 0.5 : o.vel, soft: 1.8, t60: 0.15, amp: 0.36, detune: 6 }) },
    stepAdd: { tier: 'ui', gap: 80, wet: 0.08, make: (P) => { strike(P, 0, st0(12), 'tine', { vel: 0.55, soft: 1.3, t60: 0.2, amp: 0.205, detune: 6 }); strike(P, S(0.058 + rnd(-0.004, 0.004)), st0(19), 'tine', { vel: 0.65, soft: 1.1, t60: 0.26, amp: 0.22, detune: 6 }); } },
    stepRemove: { tier: 'ui', gap: 80, wet: 0.08, make: (P) => { strike(P, 0, st0(19), 'tine', { vel: 0.62, soft: 1.2, t60: 0.2, amp: 0.27, detune: 6 }); strike(P, S(0.058 + rnd(-0.004, 0.004)), st0(12), 'tine', { vel: 0.5, soft: 1.8, t60: 0.14, amp: 0.24, detune: 6 }); } },
    view: { tier: 'ui', gap: 80, wet: 0.08, make: (P, o) => { air(P, 0, 0.05, 2600, 3400, 1.4, 0.03, { att: 0.3 }); strike(P, 0.02, st0([12, 16, 19, 21][clamp(o.k | 0, 0, 3)]), 'wood', { vel: 0.6, soft: 1.6, t60: 0.22, amp: 0.20, detune: 6 }); } },
    exportDone: { tier: 'ui', gap: 300, wet: 0.10, make: (P) => { air(P, 0, 0.2, 700, 2200, 1.1, 0.16, { att: 0.55, fl: 0.25 }); strike(P, 0.17, st0(19), 'glass', { vel: 0.55, soft: 0.9, t60: 0.6, amp: 0.32 }); strike(P, 0.19, st0(26), 'glass', { vel: 0.45, soft: 0.9, t60: 0.45, amp: 0.14 }); } },
    error: { tier: 'ui', gap: 250, wet: 0.06, make: (P) => { for (const [u, a, c] of [[0, 1, 0], [0.088 + rnd(-0.005, 0.005), 0.85, -25]]) { strike(P, u, st0(0) * cents(c), 'block', { vel: 0.8 * a, soft: 0.9, t60: 0.09, amp: 0.26, knock: 5 }); strike(P, u, st0(12) * cents(c), 'block', { vel: 0.7 * a, soft: 0.9, t60: 0.06, amp: 0.40, knock: 0 }); } } },
    edge: { tier: 'ui', gap: 150, wet: 0.05, make: (P) => { strike(P, 0, st0(7), 'skin', { vel: 0.6, soft: 1.8, t60: 0.1, amp: 0.17, drop: 1, knock: 3.5 }); strike(P, 0, st0(19), 'block', { vel: 0.5, soft: 0.8, t60: 0.05, amp: 0.34 }); } },
    morphStart: { tier: 'events', gap: 200, wet: 0.22, make: (P) => { air(P, 0, 0.6, 600, 2600, 0.9, 0.04, { att: 0.45, fl: 0.3 }); bowed(P, 0, st(12), { att: 0.22, hold: 0.12, t60: 0.7, amp: 0.05 }); bowed(P, 0.03, st(19), { att: 0.25, hold: 0.1, t60: 0.7, amp: 0.04 }); } },
    morphEnd: { tier: 'events', gap: 300, wet: 0.25, make: (P, o) => { const v = o.vel == null ? 0.6 : o.vel; strike(P, 0, st(0), 'wood', { vel: 0.5, soft: 2.2, t60: 0.5, amp: 0.10 }); strike(P, 0.012, st(24), 'glass', { vel: v, soft: 0.9, t60: 1.0, amp: 0.13 }); strike(P, 0.04, st(28), 'glass', { vel: v * 0.85, soft: 0.9, t60: 0.9, amp: 0.095 }); } },
    landmark: { tier: 'events', gap: 0, wet: 0.15, count: true, make: (P, o) => { const q = clamp(o.q | 0, 0, 4); strike(P, 0, st([12, 16, 19, 21, 24][q]), 'wood', { vel: o.vel == null ? 0.5 : o.vel, soft: 1.8, t60: q === 0 || q === 4 ? 0.45 : 0.3, amp: 0.065 }); } },
    endBump: { tier: 'events', gap: 0, wet: 0.1, count: true, make: (P, o) => strike(P, 0, st0(-12), 'skin', { vel: clamp(o.vel == null ? 0.5 : o.vel, 0.3, 0.8), soft: 3, t60: 0.15, amp: 0.35, drop: 1 }) },
    loopDone: { tier: 'events', gap: 200, wet: 0.22, count: true, make: (P, o) => {
      const w = o.w | 0, n = Math.min(8, Math.abs(w));
      if (!w) return strike(P, 0, st(19), 'block', { vel: 0.5, soft: 1.2, t60: 0.08, amp: 0.270 });
      for (let j = 0; j < n; j++) strike(P, 0.125 * j + (j ? rnd(-0.003, 0.003) : 0), penta(w > 0 ? 5 + j : 5 - j), 'glass', { vel: j ? 0.62 - 0.02 * j : 0.85, soft: 0.8, t60: 0.5, amp: 0.11, detune: 2 });
      if (Math.abs(w) > 8) many(P, 0.125 * n, w > 0 ? 1 : -1);
    } },
    cut: { tier: 'sonify', gap: 120, wet: 0.08, make: (P) => { pluck(P, 0, st(28), { t60: 0.09, bright: 0.22, amp: 0.16 }); pluck(P, 0.035, st(24), { t60: 0.12, bright: 0.18, amp: 0.16 }); } },
    zero: { tier: 'sonify', gap: 250, wet: 0.2, make: (P, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.11; for (let j = 0; j < m; j++) strike(P, sp * j, st(24), 'glass', { vel: (o.vel == null ? 0.6 : o.vel) * (j ? 0.75 : 1), soft: 0.8, t60: 0.55, amp: 0.21, detune: 2 }); } },
    pole: { tier: 'sonify', gap: 250, wet: 0.14, make: (P, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.12, v = o.vel == null ? 0.7 : o.vel; for (let j = 0; j < m; j++) { strike(P, sp * j, st(7), 'skin', { vel: v * (j ? 0.75 : 1), soft: 1.6, t60: 0.16, amp: 0.36, drop: 1.5, knock: 3.5 }); strike(P, sp * j, st(-5), 'skin', { vel: v * (j ? 0.75 : 1), soft: 2.4, t60: 0.2, amp: 0.06, drop: 1.5, knock: 0 }); strike(P, sp * j, st(19), 'wood', { vel: v * (j ? 0.75 : 1), soft: 1.4, t60: 0.07, amp: 0.13, drop: 1, detune: 2 }); } } },
    dense: { tier: 'sonify', gap: 600, wet: 0.15, make: (P) => { for (let j = 0; j < 3; j++) strike(P, 0.04 * j + (j ? rnd(-0.004, 0.004) : 0), penta(5 + j), 'glass', { vel: 0.35, soft: 0.8, t60: 0.2, amp: 0.085 }); } },
    contour: { tier: 'sonify', gap: 0, wet: 0.05, count: true, make: (P, o) => strike(P, 0, 2 * Sound.hNote(clamp(o.k | 0, -7, 8)), 'wood', { vel: o.vel == null ? 0.5 : o.vel, soft: 1.4, t60: 0.09, amp: 0.25, detune: 2 }) },
    turn: { tier: 'sonify', gap: 0, wet: 0.2, count: true, make: (P, o) => { let f = 36.7081 * Math.pow(2, ((o.pc || 0) % 1 + 1) % 1); while (f < 1700) f *= 2; const up = (o.dir || 1) > 0; strike(P, 0, up ? f * 2 / 3 : f * 4 / 3, 'glass', { vel: 0.35, soft: 0.8, t60: 0.14, amp: 0.12, detune: 0 }); strike(P, 0.045, f, 'glass', { vel: 0.7, soft: 0.7, t60: 0.6, amp: 0.15, detune: 0 }); } },
    turnMany: { tier: 'sonify', gap: 0, wet: 0.2, count: true, make: (P, o) => many(P, 0, (o.dir || 1) > 0 ? 1 : -1) },
    collide: { tier: 'sonify', gap: 300, wet: 0.18, make: (P) => { const f = st(19); bowed(P, 0, f * Math.pow(2, 2 / 12), { f1: f, glide: 0.22, att: 0.04, hold: 0.1, t60: 0.5, amp: 0.06 }); bowed(P, 0, f / Math.pow(2, 2 / 12), { f1: f, glide: 0.22, att: 0.04, hold: 0.1, t60: 0.5, amp: 0.06 }); } },
  };
  function many(P, d, dir) { for (let j = 0; j < 5; j++) strike(P, d + 0.035 * j + (j ? rnd(-0.003, 0.003) : 0), penta(dir > 0 ? 5 + j : 9 - j), 'glass', { vel: 0.4, soft: 0.8, t60: 0.2, amp: 0.10 }); }
  // level trims (dB) measured against A (notes/sound/v2/MEASUREMENTS.md); 0 until calibrated
  const TRIM = {'toggleOn': -1.07, 'toggleOff': -0.4, 'stepAdd': 0.06, 'stepRemove': -0.72, 'view': 2.75, 'exportDone': -1.8, 'error': -0.82, 'edge': -2.23, 'snap': -2.85, 'morphStart': 1.91, 'morphEnd': -0.59, 'loopDone': 0.48, 'zero': -0.35, 'pole': 0.1, 'dense': 0.35, 'cut': -3.25, 'turn': -0.43, 'turnMany': -1.43, 'contour': -1.52, 'collide': 0.5};   // (calibrated 2026-10-24, 6 plays each)
  const partEnd = (p) => (p.d || 0) + (p.k === 'm' ? p.tau + p.t60 : p.k === 'n' || p.k === 'air' ? p.dur : p.att + p.hold + p.t60);

  // ---------------------------------------------------------------- an engine bound to one graph (live or offline)
  // G: Sound.graph(c, vol); G.offline: commands are collected and handed to the nodes when rendering starts
  function Engine(G, opts = {}) {
    const c = G.c, pend = [], voices = new Set();
    FS = c.sampleRate;
    let node = null, LEAD = Math.max(0.012, 2 * (c.baseLatency || 0.005)), cueN = 0, seedBase = opts.seed != null ? opts.seed : ((Date.now() * 2654435761) >>> 0);
    const mk = () => {
      node = new AudioWorkletNode(c, 'cmwb-synth', { numberOfInputs: 0, numberOfOutputs: 6, outputChannelCount: [2, 2, 2, 2, 2, 2], processorOptions: { cmds: pend.splice(0) } });
      TIERS.forEach((T, k) => { node.connect(G.tier[T].dry, 2 * k); node.connect(G.tier[T].wet, 2 * k + 1); });
    };
    if (G.offline) G.flush.push(mk); else mk();
    const post = (list) => { if (node) node.port.postMessage(list); else pend.push(...list); };
    const now = () => (G.offline ? 0 : c.currentTime + LEAD);
    const log = [];   // (tests) every cue: [name, at]
    const lastStart = new Map(), recent = [], zpTry = [], reps = new Map();
    let zpQuietUntil = 0, chromaVoice = null;
    const tierOn = (T) => !opts.tiers || opts.tiers[T];
    // o: {pan, at (s from now), t0 (absolute clock, offline), force, vel, k, q, w, order, dir, pc, tier, seed}
    function play(name, o = {}) {
      const d = CAT[name]; if (!d) return false;
      const tier = o.tier || d.tier;
      if (!o.audition && !tierOn(tier)) return false;
      if (!G.offline) {
        const wall = performance.now(), sched = !!o.force || o.at > 0;
        if ((name === 'zero' || name === 'pole') && !o.audition) {
          while (zpTry.length && wall - zpTry[0] > 300) zpTry.shift();
          zpTry.push(wall);
          if (wall < zpQuietUntil) return false;
          if (zpTry.length >= 3) { zpQuietUntil = wall + 600; return play('dense', { pan: o.pan }) && 'dense'; }
          if (wall - (lastStart.get('zp') || -1e9) < d.gap) return false;
          lastStart.set('zp', wall);
        } else if (!o.force && wall - (lastStart.get(name) || -1e9) < d.gap) return false;
        while (recent.length && wall - recent[0] > 1000) recent.shift();
        if (!sched && recent.length >= 14 && name !== 'error') return false;
        lastStart.set(name, wall); if (!sched) recent.push(wall);
      }
      const t = (o.t0 != null ? o.t0 : now()) + (o.at || 0);
      // repetition softens: −1 dB per repeat within 2 s, down to −4 dB (not count-bearing cues)
      let rg = 0;
      if (!d.count && !o.noRep) { const r = reps.get(name), k = r && t - r.t < 2 ? Math.min(4, r.k + 1) : 0; reps.set(name, { t, k }); rg = -k; }
      R = prng(o.seed != null ? o.seed : (seedBase + 0x9E3779B9 * ++cueN) >>> 0);
      const ch = tier !== 'ui' && chromaVoice && chromaVoice.sounding() ? chromaVoice.chroma(t) : null;
      XF = ch == null ? 1 : Math.pow(2, ch - Math.round(ch));
      const P = [];
      try { d.make(P, o); } finally { XF = 1; }
      const g = Math.pow(10, (rg + (TRIM[name] || 0) + (o.gainDb || 0)) / 20);
      post([{ k: 'cue', at: t, tier: TI[tier], pan: clamp(o.pan || 0, -0.4, 0.4), wet: d.wet, g, parts: P }]);
      log.push([name, t, [...new Set(P.map((p) => Math.round(1e4 * (p.d || 0)) / 1e4))]]);
      let end = t; for (const p of P) end = Math.max(end, t + partEnd(p));
      for (const v of voices) v.duck(t, Math.min(0.25, end - t));
      return true;
    }
    // count-bearing cues queue on the audio clock (the app's rule: turn bells ≤ 8/s and a flourish beyond 8 queued;
    // contour ticks ≤ 12/s)
    const Q = { turn: { next: 0, gap: 0.125, cap: 8, many: 0, due: [] }, contour: { next: 0, gap: 0.083, cap: 6, many: 0, due: [] } };
    function queued(name, o) {
      if (!tierOn(o.tier || 'sonify')) return false;
      const q = Q[name], tn = G.offline ? (o.t0 || 0) : c.currentTime, at = Math.max(tn, q.next);
      while (q.due.length && q.due[0] <= tn) q.due.shift();
      if (q.due.length >= q.cap) {
        if (name === 'turn' && !(q.many > tn)) { q.many = q.next; play('turnMany', Object.assign({}, o, { at: q.next - tn, force: true })); q.due.push(q.next + LEAD); q.next += 0.25; }
        return 'coalesced';
      }
      q.next = at + q.gap; q.due.push(at + LEAD);
      return play(name, Object.assign({}, o, { at: at - tn, force: true }));
    }
    // ---- the scrub (replaces the detent every 0.05 of t): the texture follows the speed of t; landmark notes at
    // t = 0, ¼, ½, ¾, 1 (forced); an end reached faster than 0.8 t/s adds a felt bump. tm: an explicit clock (offline)
    let sLast = null, mode = 'B';
    function scrub(T0, T1, tm) {
      const wall = tm != null ? tm : performance.now() / 1000, dtw = sLast == null ? 0.016 : clamp(wall - sLast, 0.008, 0.1); sLast = wall;
      const v = Math.abs(T1 - T0) / dtw, at = tm != null ? tm : now();
      if (mode === 'B' && tierOn('events')) post([{ k: 'tex', id: 1, at, v, t: T1, amp: 0.06, tier: 1, wet: 0.12, hold: 0.09, seed: 11 }]);
      for (let q = 0; q <= 4; q++) {
        const m = q / 4;
        if ((T0 < m && T1 >= m) || (T0 > m && T1 <= m)) {
          play('landmark', { q, vel: clamp(0.3 + 0.25 * Math.log2(1 + v), 0.3, 0.85), force: true, t0: at });
        }
      }
    }
    function scrubEnd(tm) { sLast = null; post([{ k: 'tex', id: 1, at: tm != null ? tm : now(), v: 0, end: true, rel: 0.16 }]); }
    // ---- the motion bed: while the deformation plays its first pass, the texture driven by the playback (×0.6)
    function motion(t, rate, tm) { if (tierOn('events')) post([{ k: 'tex', id: 2, at: tm != null ? tm : now(), v: rate, t, amp: 0.06, tier: 1, wet: 0.12, hold: 0.25, seed: 23 }]); }
    function motionEnd(tm) { post([{ k: 'tex', id: 2, at: tm != null ? tm : now(), v: 0, end: true, rel: 0.13 }]); }
    // ---- the glass choir (the app's ShepardVoice on this graph, with the choir in its worklet)
    function voice() {
      if (!tierOn('sonify')) return null;
      const v = Sound.ShepardVoice(G, 'sonify'); voices.add(v); chromaVoice = v;
      const st = v.stop; v.stop = (t) => { voices.delete(v); if (chromaVoice === v) chromaVoice = null; st(t); };
      return v;
    }
    return { play, turn: (o = {}) => queued('turn', o), tick: (o = {}) => queued('contour', o), scrub, scrubEnd, motion, motionEnd, voice, log, setMode: (m) => { mode = m; }, mode: () => mode,
      stat: () => new Promise((res) => { if (!node) return res(null); node.port.onmessage = (e) => res(e.data); node.port.postMessage('stat'); }), node: () => node, lead: () => LEAD };
  }

  // ---------------------------------------------------------------- the live engine: its own AudioContext (made in a
  // gesture), the app's graph and settings law (volume squared), sleeping after 30 s idle
  const P = { on: true, vol: 0.7, ui: true, events: true, sonify: true };
  let ctx = null, G = null, E = null, loading = null, idle = 0;
  async function ensure() {
    if (ctx && ctx.state !== 'closed') { if (ctx.state !== 'running') ctx.resume(); return !!E; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC({ latencyHint: 'interactive' });
    G = Sound.graph(ctx, 0);
    G.master.gain.setTargetAtTime(P.vol * P.vol, ctx.currentTime + 0.012, 0.01);
    loading = loadModule(ctx).then((ok) => { if (!ok) return false; G.worklet = true; G.engine = 'worklet'; E = Engine(G, { tiers: P }); return true; });
    return loading;
  }
  const touch = () => { clearTimeout(idle); idle = setTimeout(() => { if (ctx && ctx.state === 'running') ctx.suspend(); }, 30000); };
  const live = (f) => (...a) => { if (!E || !P.on) return false; if (ctx.state !== 'running') ctx.resume(); touch(); return f(...a); };
  function set(o) {
    Object.assign(P, o);
    if (G) G.master.gain.setTargetAtTime(P.on ? P.vol * P.vol : 0, ctx.currentTime + 0.012, 0.03);
  }

  // ---------------------------------------------------------------- offline rendering (tests, measurements)
  async function render(fn, dur, opts = {}) {
    const rate = opts.rate || 48000, c = new OfflineAudioContext(2, Math.ceil(dur * rate), rate), g = Sound.graph(c, opts.vol != null ? opts.vol : 1, { allOn: true, noClip: opts.noClip });
    g.offline = true; g.worklet = await loadModule(c); g.engine = 'worklet';
    const e = Engine(g, { seed: opts.seed != null ? opts.seed : 1 });
    if (opts.mode) e.setMode(opts.mode);
    await fn(e, 0.01, c, g);
    for (const f of g.flush) f();
    const b = await c.startRendering(); b.log = e.log; return b;
  }

  return {
    ensure, set, prefs: () => ({ ...P }), state: () => ({ audio: ctx ? ctx.state : 'none', ready: !!E }),
    play: live((n, o) => E.play(n, o)), turn: live((o) => E.turn(o)), tick: live((o) => E.tick(o)),
    scrub: live((a, b) => E.scrub(a, b)), scrubEnd: live(() => E.scrubEnd()), motion: live((t, r) => E.motion(t, r)), motionEnd: live(() => E.motionEnd()),
    voice: live(() => E.voice()), setMode: (m) => { if (E) E.setMode(m); }, engine: () => E, ctx: () => ctx,
    render, CAT, MAT, TRIM, SRC, B_WORKLET,
  };
})();
