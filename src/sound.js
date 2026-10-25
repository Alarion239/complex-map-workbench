'use strict';
// Sound for Complex Map Workbench (v15.2: notes/sound/AS-BUILT-v152.md). The app's hooks live in app.js (the "sound"
// block); the controls in page.html (#soundCtl, #sndPop).
// =====================================================================================================================
// What the sounds are made of: palette B (notes/sound/v2/DESIGN.md, board.html with board-fixes.md), the user's choice
// ("I like everything except for hearing the function"): every cue is a list of small struck, plucked, blown or bowed
// parts (wood, kalimba tine, woodblock, felt, glass, a metal bar), each play a new strike (a PRNG per play: level, mallet,
// decay, a few cents of pitch where pitch carries no meaning), softer when repeated, harder when the gesture was fast.
// Hearing the function, the user's choice (notes/sound/hearf, options 2 and 4):
//   * the phase harp for the pointer: silent while still; a plucked note each time arg F crosses one of five phase
//     lines (0°, 60°, 120°, 210°, 270°: D, E, F♯, A, B); a loop round a zero plays a rising scale, round a pole a falling
//     one; the low Ds counted up minus down are the winding number;
//   * curves sing: a closed curve's phase signal e^{2πiφ(s)} played as one sung note whose harmonic 4 + W of D3 is its
//     winding number W (D5 for 0, F♯5 for 1, A5 for 2, A4 for −1, …).
// The engine: one AudioWorklet node ("cmw-synth") renders every one-shot part, the scrub and motion texture, the
// harp's strings (12 at most; the oldest fades in 30 ms) and the singer, sample by sample: the main thread posts
// parameters only, every part starts and ends at exactly 0 (raised cosines), a late message adds latency, never a step.
// No AudioParam automation for any of them. The Height voice (the Landscape) keeps its own worklet node ("cmw-voice").
// Where no AudioWorklet is allowed (a CSP without blob:/data: scripts), one-shots and harp strings are rendered into a
// buffer on the main thread from the same code; the texture and the singer then stay silent (the loop pings play).
//   Sound is on by default (Interface and Mathematical events; Snap ticks and Hear the function off), except on a test
//   page (?ns=), which stays off until a test turns it on; a stored choice always wins. The AudioContext is never
//   created at load: only after the user turns sound on, inside a gesture, or (when "on" is the default or was
//   remembered) inside the first activation gesture in this frame, so nothing plays before the first click or key.
//   Nothing is ever queued while the context is not running (one sound is allowed inside an active gesture, so
//   "toggle on" is heard). Hidden tab: silent and suspended. Preferences are per device (localStorage).
// Tiers are split by WHAT TRIGGERS a cue, not by topic:
//   ui      Interface: a control the user operated (snap ticks are a separate switch, off by default)
//   events  Mathematical events: a deliberate action with mathematical content (deformation play / scrub, a loop
//           closed and its winding, listen along a curve)
//   sonify  Hear the function under the pointer (opt-in): the harp, the loop's note while the deformation plays, and
//           every cue driven by pointer position (branch cut, zero/pole order, contour, preimages collide)
// API: Sound.play(name, {pan, order, k, q, w, vel, at, force, tier, tag}) · Sound.turn(o) · Sound.tick(o) (queued,
//      count-bearing) · Sound.harp(phi, o) · Sound.harpReset(phi) · Sound.harpAlong(phi, la, dur, o) · Sound.alongCount(phi, closed, lines) ·
//      Sound.sing(A, n0, o) · Sound.singOff(o) · Sound.curveAmps(ph, W) · Sound.scrub(u0, u1) · Sound.scrubEnd() ·
//      Sound.motion(u, rate) · Sound.motionEnd() · Sound.heightVoice() · Sound.hush() (Esc) · Sound.stopTag(tag) ·
//      Sound.set({on, vol, ui, snap, events, sonify}) · Sound.toggle() · Sound.prefs() · Sound.subscribe(fn) ·
//      Sound.state() · Sound.render(fn, dur) (offline) · Sound.cueTo(G, name, t, o) · Sound.CATALOG ·
//      Sound.pathStep(argStep, Fat, z0, T0, g0, z1, T1, g1, opts) · Sound.turns(L, ring) (the probe's arithmetic)
// =====================================================================================================================

// The synthesis library: the parts, the texture and the singer. Its source runs twice: in the AudioWorklet (inlined
// into WORKLET_SRC) and on the main thread (the fallback renderer and the node tests). Pure: no Web Audio here.
function SND_LIB() {
  'use strict';
  const TL = 4096, SINT = new Float32Array(TL + 1);
  for (let i = 0; i <= TL; i++) SINT[i] = Math.sin(2 * Math.PI * i / TL);
  const sin1 = (p) => { const x = p * TL, i = x | 0; return SINT[i] + (SINT[i + 1] - SINT[i]) * (x - i); };   // p in [0, 1)
  function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rc = (x) => 0.5 - 0.5 * Math.cos(Math.PI * x);   // raised cosine 0 → 1 over x in [0, 1]

  // ---- one-shot parts. run(y, from, to) adds into the mono scratch y; returns true while it has more to play
  // 'm' a decaying mode: a raised-cosine ring-in over the mallet contact τ, exp(−6.9078 t / T60), a raised-cosine fade to
  // exactly 0 over its last 12 ms; an optional pitch drop (felt) relaxing with a 60 ms time constant. Without a drop it
  // runs as a rotating phasor (the same samples to within 1e-6, about twice as fast: every harp string)
  function Mode(c, fs) { return c.drop ? ModeT(c, fs) : ModeR(c, fs); }
  function ModeR(c, fs) {
    const nAtt = Math.max(1, Math.round(c.tau * fs)), nDec = Math.max(16, Math.round(c.t60 * fs)), n = nAtt + nDec, nF = Math.min(Math.round(0.012 * fs), nDec), a = c.a;
    const k = Math.exp(-6.9078 / nDec), w = 2 * Math.PI * c.f / fs, cr = Math.cos(w), sr = Math.sin(w), p0 = 2 * Math.PI * (c.ph || 0);
    let i = 0, e = 1, re = Math.cos(p0), im = Math.sin(p0);
    return { run(y, from, to) {
      let j = from;
      while (j < to && i < n) {
        if (i < nAtt) {
          const end = Math.min(to, j + (nAtt - i));
          for (; j < end; j++, i++) { const t = re * cr - im * sr; im = re * sr + im * cr; re = t; y[j] += a * rc(i / nAtt) * im; }
        } else if (i <= n - nF) {
          const end = Math.min(to, j + (n - nF + 1 - i)); let ae = a * e;
          for (; j < end; j++, i++) { const t = re * cr - im * sr; im = re * sr + im * cr; re = t; y[j] += ae * im; ae *= k; }
          e = ae / a;
          const m = re * re + im * im; if (m < 0.999999 || m > 1.000001) { const s = 1 / Math.sqrt(m); re *= s; im *= s; }
        } else {
          const end = Math.min(to, j + (n - i));
          for (; j < end; j++, i++) { const t = re * cr - im * sr; im = re * sr + im * cr; re = t; y[j] += a * e * rc((n - 1 - i) / Math.max(1, nF - 1)) * im; e *= k; }
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
        if (i >= n - nF) g *= rc((n - 1 - i) / Math.max(1, nF - 1));
        let fi = f; if (r !== 1) { fi *= r + (1 - r) * dg; dg *= kd; }
        p += fi; if (p >= 1) p -= 1;
        y[j] += a * g * sin1(p); i++;
      }
      return i < n;
    } };
  }
  // 'n' the contact: Hann-windowed white noise, one-pole low-pass at fc, one-pole high-pass at 250 Hz
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
  // 'air': white noise into a Chamberlin band-pass gliding fa → fb (exponential), a raised-cosine envelope (rise att·dur,
  // fall the rest; exactly 0 at both ends), a 6–10 Hz random flutter of depth fl
  function Air(c, fs) {
    const n = Math.max(16, Math.round(c.dur * fs)), R = prng(c.seed), att = c.att == null ? 0.5 : c.att, q = c.q, iq = 1 / Math.sqrt(q), fl0 = c.fl || 0.15, ratio = c.fb / c.fa;
    let i = 0, lo = 0, bp = 0, F = 0, fl = 0, flt = 0;
    return { run(y, from, to) {
      for (let j = from; j < to; j++) {
        if (i >= n) return false;
        const u = i / (n - 1);
        if ((i & 7) === 0) { const fc = Math.min(c.fa * Math.pow(ratio, u), 0.2 * fs); F = 2 * Math.sin(Math.PI * fc / fs); }
        const hp = 2 * R() - 1 - lo - bp / q; bp += F * hp; lo += F * bp;
        if ((i & 63) === 0) flt = 2 * R() - 1; fl += (flt - fl) * 0.004;
        const e = u < att ? rc(u / att) : 1 - rc((u - att) / (1 - att));
        y[j] += c.a * e * (1 + fl0 * fl) * bp * iq; i++;
      }
      return i < n;
    } };
  }
  // 'bow': bowed glass, 3 detuned sines (vs: [ratio, amp, phase]), raised-cosine attack, hold, exponential release, a
  // 20 ms raised-cosine fade to 0; an optional glide f0 → f1 on a raised cosine over `glide` s
  function Bow(c, fs) {
    const n1 = Math.max(1, Math.round(c.att * fs)), n2 = n1 + Math.round(c.hold * fs), n = n2 + Math.round(c.t60 * fs), nF = Math.round(0.02 * fs), k = Math.exp(-6.9078 / (n - n2));
    const nG = Math.max(1, Math.round((c.glide || 0.2) * fs)), lr = c.f1 ? Math.log(c.f1 / c.f0) : 0, vs = c.vs.map(([r, a, p]) => ({ f: c.f0 * r / fs, a, p }));
    let i = 0, e = 1, gl = 1;
    return { run(y, from, to) {
      for (let j = from; j < to; j++) {
        if (i >= n) return false;
        let g; if (i < n1) g = rc(i / n1); else if (i < n2) g = 1; else { g = e; e *= k; }
        if (i >= n - nF) g *= rc((n - 1 - i) / Math.max(1, nF - 1));
        if (lr && i <= nG) gl = Math.exp(lr * rc(i / nG));
        let s = 0; for (const v of vs) { v.p += v.f * gl; if (v.p >= 1) v.p -= Math.floor(v.p); s += v.a * sin1(v.p); }
        y[j] += c.a * g * s; i++;
      }
      return i < n;
    } };
  }
  const MAKE = { m: Mode, n: Noise, air: Air, bow: Bow };
  const partEnd = (p) => (p.d || 0) + (p.k === 'm' ? p.tau + p.t60 : p.k === 'n' || p.k === 'air' ? p.dur : p.att + p.hold + p.t60 + 0.02);

  // the scrub and motion texture (DESIGN v2 §3, §4): pink-ish noise into two band-passes (fc follows t: 380 Hz at t = 0,
  // 1.75 kHz at t = 1; the second 2.3× up at 0.35), a 3.5 kHz output low-pass, a 15 % flutter; level from the smoothed
  // speed of t (attack 25 ms, release 160 ms): silent below 0.1 t/s and when the hand holds still (no update for `hold`)
  function Tex(fs, seed) {
    const R = prng(seed), aA = 1 - Math.exp(-1 / (0.025 * fs)), aP = 1 - Math.exp(-2 * Math.PI * 900 / fs), aO = 1 - Math.exp(-2 * Math.PI * 3500 / fs), aG = 1 - Math.exp(-1 / (0.006 * fs)), aT = 1 - Math.exp(-32 / (0.02 * fs));
    return { v: 0, vT: 0, t: 0, tT: 0, g: 0, g1: 0, gT: 0, amp: 0.06, tier: 1, wet: 0.12, pan: 0, last: 0, hold: 0.09 * fs, aR: 1 - Math.exp(-1 / (0.16 * fs)), end: false, fresh: true,
      lo1: 0, bp1: 0, lo2: 0, bp2: 0, pk: 0, ol: 0, fl: 0, flt: 0, F1: 0, F2: 0, i: 0, fade: -1,
      set(c, frame) {
        if (c.amp != null) this.amp = c.amp; if (c.tier != null) this.tier = c.tier; if (c.wet != null) this.wet = c.wet; if (c.pan != null) this.pan = c.pan;
        if (c.hold != null) this.hold = c.hold * fs;
        if (c.t != null) { this.tT = c.t; if (this.fresh) this.t = c.t; }
        if (c.v != null) this.vT = c.v;
        if (c.end) { this.end = true; this.vT = 0; this.aR = 1 - Math.exp(-1 / ((c.rel || 0.16) * fs)); }
        else { this.end = false; this.aR = 1 - Math.exp(-1 / (0.16 * fs)); }
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
          this.g1 += (this.gT - this.g1) * aG; this.g += (this.g1 - this.g) * aG;
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

  // the singer (curves sing, notes/sound/hearf option 4): one phase at D3 with a living f0 (jitter, shimmer, a 5.2 Hz
  // vibrato of ±20 cents while the spectrum rests, ±8 while it moves), harmonics n = 1 … 24 of amplitudes A_n (each
  // slewed by a one-pole) over a sung /a/ vowel (the hum, about 7 dB under the note), breath noise band-passed at the
  // strongest harmonic and gated by the glottal phase. Gate: two one-poles in cascade (a fade starts with zero slope).
  const NH = 24, F0 = 146.8324;
  function vowel(F1, F2, F3) {
    const a = new Float64Array(NH + 1); let e = 0;
    const res = (f, F, B, g) => g / Math.sqrt(1 + Math.pow((f - F) / B, 2));
    for (let n = 1; n <= NH; n++) { const f = n * F0; a[n] = (0.2 + res(f, F1, 90, 1) + res(f, F2, 120, 0.7) + res(f, F3, 300, 1.3) + res(f, 3400, 350, 0.8)) / n; e += a[n] * a[n]; }
    for (let n = 1; n <= NH; n++) a[n] /= Math.sqrt(e);
    return a;
  }
  const HUMV = [vowel(400, 800, 2500), vowel(700, 1150, 2600)];
  function Singer(fs, seed) {
    const R = prng(seed || 12345), coef = (tau) => (tau > 0 ? 1 - Math.exp(-1 / (tau * fs)) : 1);
    const h = { A: new Float64Array(NH + 1), AT: new Float64Array(NH + 1), phi: new Float64Array(NH + 1), H: new Float64Array(NH + 1), ph: 0, g: 0, g1: 0, gT: 0, gA: coef(0.01), aA: coef(0.03),
      lvl: 1, lvlT: 1, aL: coef(0.03), jit: 0, jitT: 0, jitNext: 0, shim: 1, shimT: 1, vp: 0, vd: 0, lastChange: 0, bF: 0, bFT: 0, blo: 0, bbp: 0, humT: 0.45, hum: 0.45, vow: 1, vowT: 1, live: false, tier: 1, tag: null, gN: 0 };
    for (let n = 1; n <= NH; n++) { h.H[n] = HUMV[1][n]; h.phi[n] = R(); }
    const quiet = () => h.g < 1e-4 && h.g1 < 1e-4;
    return {
      h,
      tier: () => h.tier,
      silent: () => !h.live || (h.g < 1e-6 && h.g1 < 1e-6 && h.gT === 0),
      cmd(c, fr) {
        // its tier and tag change only while it is silent (a sounding voice never jumps to another output)
        if (c.tier != null && quiet()) h.tier = c.tier;
        if (c.tag !== undefined && quiet()) h.tag = c.tag;
        if (c.amps) {
          let ch = 0, mx = 0, nm = 4;
          for (let n = 1; n <= NH; n++) { const a = c.amps[n - 1] || 0; ch += Math.abs(a - h.AT[n]); h.AT[n] = a; if (a > mx) { mx = a; nm = n; } }
          if (ch > 0.06) h.lastChange = fr;
          h.bFT = Math.min(0.2 * fs, nm * F0) / fs;
          if (!h.live || quiet()) { for (let n = 1; n <= NH; n++) h.A[n] = h.AT[n]; h.bF = h.bFT; }
          h.live = true;
        }
        if (c.slew) h.aA = coef(c.slew);
        if (c.lvl != null) { h.lvlT = c.lvl; h.aL = coef(c.lt || 0.03); if (quiet()) h.lvl = c.lvl; }
        if (c.hum != null) h.humT = c.hum;
        if (c.vow != null) { h.vowT = c.vow; if (quiet()) h.vow = c.vow; }
        if (c.gate != null && !(c.gate === 0 && c.n != null && c.n < h.gN)) { h.gT = c.gate; h.gA = coef(c.t1 || 0.01); if (c.gate > 0 && c.n != null) h.gN = c.n; }
      },
      hush() { h.gT = 0; h.gA = coef(0.004); },
      // samples [0, n) into the dry and wet scratch (equal in both ears; the room send 0.22)
      run(D, Wt, n, f0) {
        if (!h.live) return false;
        if (h.g < 1e-6 && h.g1 < 1e-6 && h.gT === 0) { h.g = h.g1 = 0; return false; }
        const A = h.A, AT = h.AT, phi = h.phi, inv = 1 / fs, steadyN = 0.4 * fs;
        for (let i = 0; i < n; i++) {
          const fr = f0 + i;
          if ((fr & 15) === 0) {
            if (fr >= h.jitNext) { h.jitT = 0.002 * (2 * R() - 1); h.jitNext = fr + Math.round((0.02 + 0.02 * R()) * fs); }
            h.jit += (h.jitT - h.jit) * 0.0177;
            const vT = fr - h.lastChange > steadyN ? 1 : 0.4;
            h.vd += (vT - h.vd) * (vT > h.vd ? 0.0013 : 0.0066);
            h.bF += (h.bFT - h.bF) * 0.03;
            h.hum += (h.humT - h.hum) * 0.01;
            if (h.vow !== h.vowT) { h.vow += (h.vowT - h.vow) * 0.01; if (Math.abs(h.vowT - h.vow) < 1e-4) h.vow = h.vowT; }
            const u = HUMV[0], aa = HUMV[1], v = h.vow; for (let k = 1; k <= NH; k++) h.H[k] = u[k] + (aa[k] - u[k]) * v;
          }
          h.g1 += (h.gT - h.g1) * h.gA; h.g += (h.g1 - h.g) * h.gA;
          h.lvl += (h.lvlT - h.lvl) * h.aL;
          h.shim += (h.shimT - h.shim) * 0.001;
          h.vp += 5.2 * inv; if (h.vp >= 1) h.vp -= 1;
          const fm = (1 + h.jit) * (1 + 0.01162 * h.vd * sin1(h.vp));
          let ph = h.ph + F0 * fm * inv;
          if (ph >= 1) { ph -= 1; h.shimT = Math.pow(10, (2 * R() - 1) * 0.5 / 20); }
          h.ph = ph;
          let y = 0;
          for (let k = 1; k <= NH; k++) {
            const a = (A[k] += (AT[k] - A[k]) * h.aA) + h.hum * h.H[k];
            if (a < 1e-5) continue;
            let p = k * ph + phi[k]; p -= Math.floor(p);
            y += a * sin1(p);
          }
          const F = 2 * Math.sin(Math.PI * h.bF), w = 2 * R() - 1;
          const hp = w - h.blo - h.bbp / 6; h.bbp += F * hp; h.blo += F * h.bbp;
          const open = 0.35 + 0.65 * (0.5 - 0.5 * sin1(ph < 0.5 ? ph + 0.5 : ph - 0.5));
          y += 0.246 * h.bbp * open;
          const v = y * h.g * h.lvl * h.shim * 0.0251;
          D[i] += v; Wt[i] += 0.22 * v;
        }
        return true;
      },
    };
  }
  return { sin1, prng, rc, Mode, Noise, Air, Bow, MAKE, partEnd, Tex, Singer, NH, F0 };
}

const Sound = (() => {
  // the app's lsk('cmw-sound'): a ?ns=name page (test tabs) keeps its own setting
  const NS = (() => { try { return new URLSearchParams(location.search).get('ns') || ''; } catch (e) { return ''; } })();
  const KEY = NS ? 'cmw-sound:' + NS : 'cmw-sound';
  const TIERS = ['ui', 'events', 'sonify'], TI = { ui: 0, events: 1, sonify: 2, aud: 3 };
  // (v15, the user's defaults, notes/sound/README.md: sound on, Interface and Mathematical events on, Snap ticks and
  // Hear the function off. A ?ns= test page starts off, so the quality and perf suites stay silent unless a test turns
  // it on. These apply only when nothing is stored: a stored choice always wins.)
  const DEFAULTS = { on: !NS, vol: 0.7, ui: true, snap: false, events: true, sonify: false };
  const AC = window.AudioContext || window.webkitAudioContext;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const TAU = 2 * Math.PI;
  const LIB = SND_LIB();
  // storage: a sandboxed frame without allow-same-origin throws on the mere access; then nothing is remembered
  let store = null;
  try { store = window.localStorage; store.getItem(KEY); } catch (e) { store = null; }
  const P = Object.assign({}, DEFAULTS);
  try {
    const s = store && JSON.parse(store.getItem(KEY) || 'null');
    if (s && typeof s === 'object') for (const k in DEFAULTS) if (typeof s[k] === typeof DEFAULTS[k]) P[k] = s[k];
  } catch (e) { /* corrupt: defaults */ }
  const save = () => { try { if (store) store.setItem(KEY, JSON.stringify(P)); } catch (e) { /* not remembered */ } };

  let ctx = null, G = null, hidden = document.visibilityState === 'hidden', activated = false, idleTimer = 0, lastGesture = -1e9, graceUsed = false, busyUntil = 0;
  const subs = new Set();
  const state = () => ({ ...P, supported: !!AC, remembered: !!store, audio: ctx ? ctx.state : 'none', rate: ctx ? ctx.sampleRate : 0,
    latency: ctx ? (ctx.baseLatency || 0) + (ctx.outputLatency || 0) : 0, hidden, engine: G ? G.engine : 'none' });
  // (tests) prefer.worklet = false: the main-thread fallback in a live context too
  const prefer = { worklet: true };
  const emit = () => { const s = state(); for (const f of subs) { try { f(s); } catch (e) { /* a subscriber's bug is not ours */ } } };
  // a click or key in this page load (our own listeners), and the browser agrees the frame is activated: only then is a
  // context created or resumed. (Chrome keeps a frame's sticky activation across a reload; a remembered "on" still
  // waits for a gesture on the new page.)
  const mayStart = () => activated && (navigator.userActivation ? navigator.userActivation.hasBeenActive : true);
  const inGesture = () => (navigator.userActivation ? navigator.userActivation.isActive : performance.now() - lastGesture < 1000);

  // ---------------------------------------------------------------- graph
  // the synth's tier outputs and the voices → tier (dry, and a send to a small synthetic room) → bus (hush) → master
  // (volume) → safety soft clip → speakers
  function graph(c, vol, opts = {}) {
    const master = c.createGain(); master.gain.value = vol;
    if (opts.noClip) master.connect(c.destination);
    else { const clip = c.createWaveShaper(); clip.curve = SOFTCLIP; clip.oversample = '2x'; master.connect(clip); clip.connect(c.destination); }
    const bus = c.createGain(); bus.connect(master);
    const room = c.createConvolver(); room.buffer = roomIR(c);
    // normalize = true scales this IR to about −12 dB; wet 2.0 puts the tail of a bell ~15–18 dB under its direct sound
    const wet = c.createGain(); wet.gain.value = 2.0; room.connect(wet); wet.connect(bus);
    const tier = {};
    for (const k of TIERS) {
      const dry = c.createGain(), send = c.createGain(), on = opts.allOn || P[k] ? 1 : 0;
      dry.gain.value = on; send.gain.value = on; dry.connect(bus); send.connect(room);
      tier[k] = { dry, wet: send };
    }
    // the audition bus (a settings preview): always open, still behind the master switch
    const ad = c.createGain(), aw = c.createGain(); ad.connect(bus); aw.connect(room);
    const aud = { dry: ad, wet: aw };
    const g = { c, master, bus, tier, aud, active: new Set(), worklet: false, synth: null, engine: 'loading', offline: false, flush: [] };
    g.audition = { c, master, bus, tier: { ui: aud, events: aud, sonify: aud }, active: g.active };
    return g;
  }
  const FADE_DN = (() => { const n = 64, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 + 0.5 * Math.cos(Math.PI * i / (n - 1)); return a; })();
  const FADE_UP = FADE_DN.slice().reverse();
  // linear below 0.5 (−6 dBFS), a tanh knee above, never beyond 0.834 (−1.6 dBFS)
  const SOFTCLIP = (() => { const n = 4097, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = 2 * i / (n - 1) - 1, m = Math.abs(x); a[i] = m < 0.5 ? x : Math.sign(x) * (0.5 + 0.39 * Math.tanh((m - 0.5) / 0.39)); } return a; })();
  const prng = LIB.prng;
  // a dark, short room (T60 0.75 s, 6 ms pre-delay), darker as it decays, faded out at its end
  function roomIR(c) {
    const fs = c.sampleRate, n = Math.round(fs * 0.9), b = c.createBuffer(2, n, fs);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch), r = prng(101 + ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / fs, u = t - 0.006;
        const env = u < 0 ? 0 : Math.exp(-6.9 * u / 0.75) * Math.min(1, u / 0.004) * Math.min(1, (n - i) / (0.03 * fs));
        lp += (2 * r() - 1 - lp) * (0.12 + 0.55 * Math.exp(-t / 0.07));
        d[i] = lp * env;
      }
    }
    return b;
  }
  // a fallback cue's output: an equal-power panner (cues capped at ±0.4), dry into its tier, a send into the room
  function out(G, T, pan = 0, wet = 0, cap = 0.4) {
    const c = G.c, inp = c.createGain();
    let node = inp;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan || 0, -cap, cap); inp.connect(p); node = p; inp.panner = p; }
    else inp.gain.value = Math.SQRT1_2;
    node.connect(G.tier[T].dry);
    if (wet) { const s = c.createGain(); s.gain.value = wet; node.connect(s); s.connect(G.tier[T].wet); }
    return inp;
  }

  // ---------------------------------------------------------------- palette B (DESIGN v2 §1, §2)
  // variation: a PRNG per play (seeded from a per-engine base and a counter; tests set Sound.seed(n))
  let R = prng(1), seedBase = (Date.now() * 2654435761) >>> 0, cueN = 0;
  const rnd = (a, b) => a + (b - a) * R();
  const vdb = (db) => Math.pow(10, rnd(-db, db) / 20);
  const cents = (c) => Math.pow(2, c / 1200);
  const seed32 = () => (R() * 4294967296) >>> 0;
  let FS = 48000;
  const D4 = 293.665, st0 = (n) => D4 * Math.pow(2, n / 12), st = st0;
  const PENTA = [0, 2, 4, 7, 9], penta = (k) => st0(12 + 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5]);
  // the Height scale: one contour of |F| = one pentatonic step; |F| = 1 is D5; A3 … A6 (clamped beyond)
  const HMIN = -7, HMAX = 8;
  const hNote = (u) => { const uc = clamp(u, HMIN, HMAX), j = Math.min(HMAX - 1, Math.floor(uc)), a = uc - j; return penta(j) * Math.pow(penta(j + 1) / penta(j), a); };
  const MAT = {
    wood: { r: [1, 3.93, 9.2], a: [1, 0.22, 0.06], d: [1, 0.32, 0.12], b: [0, 0, 0], knock: 0.10, kf: 1800 },
    tine: { r: [1, 6.267, 17.55], a: [1, 0.10, 0.025], d: [1, 0.22, 0.08], b: [0, 0, 0], knock: 0.05, kf: 2500 },
    glass: { r: [1, 2.32, 4.25, 6.63], a: [1, 0.34, 0.14, 0.05], d: [1, 0.55, 0.30, 0.17], b: [0.8, 1.6, 2.5, 3.1], knock: 0.025, kf: 4000 },
    bar: { r: [1, 2.756, 5.404, 8.933], a: [1, 0.26, 0.08, 0.025], d: [1, 0.45, 0.20, 0.10], b: [0.5, 1.2, 0, 0], knock: 0.03, kf: 3500 },
    skin: { r: [1, 1.593, 2.136, 2.296], a: [1, 0.45, 0.25, 0.18], d: [1, 0.6, 0.45, 0.4], b: [0, 0, 0, 0], knock: 0.22, kf: 1500 },
    block: { r: [1, 2.4, 3.9], a: [1, 0.45, 0.2], d: [1, 0.5, 0.3], b: [0, 0, 0], knock: 0.30, kf: 1200 },
  };
  // the mallet: contact τ = soft · vel^−0.2 ms (Hertzian); each mode weighted by 1 / (1 + (2fτ)²)
  const mallet = (f, tau) => 1 / (1 + Math.pow(2 * f * tau, 2));
  const tauOf = (vel, soft) => soft * Math.pow(clamp(vel, 0.05, 1), -0.2) * 0.001;
  function strike(Pt, d, f0, mat, o) {
    const M = MAT[mat], vel = clamp((o.vel == null ? 0.7 : o.vel) * rnd(0.92, 1.08), 0.05, 1), tau = tauOf(vel, o.soft || 1.2);
    const dt = o.detune == null ? 3 : o.detune, f = f0 * cents(rnd(-dt, dt));
    const g = (o.amp || 0.1) * vel * vdb(o.var == null ? 1 : o.var), t60 = (o.t60 || 0.3) * rnd(0.88, 1.12), w0 = mallet(f, tau);
    for (let j = 0; j < M.r.length; j++) {
      const fj = f * M.r[j]; if (fj >= 0.45 * FS) continue;
      const aj = g * M.a[j] * mallet(fj, tau) / w0 * (j ? vdb(1.5) : 1), tj = t60 * M.d[j];
      if (M.b[j]) {   // a split pair beating at b Hz, both halves in phase at the strike: the ring "breathes"
        const bb = M.b[j] * rnd(0.8, 1.25), ph = R(), r2 = rnd(0.3, 0.6);
        Pt.push({ k: 'm', d, f: fj - bb / 2, a: aj * (1 - r2), t60: tj, tau, ph, drop: o.drop });
        Pt.push({ k: 'm', d, f: fj + bb / 2, a: aj * r2, t60: tj * 0.9, tau, ph, drop: o.drop });
      } else Pt.push({ k: 'm', d, f: fj, a: aj, t60: tj, tau, ph: 0, drop: o.drop });
    }
    if (M.knock) Pt.push({ k: 'n', d, dur: Math.max(0.002, 2.5 * tau), fc: Math.min(M.kf * (0.6 + 0.8 * vel), 6000), a: g * M.knock * (o.knock == null ? 1 : o.knock), seed: seed32() });
  }
  // a plucked string as modes (the spectrum a Karplus–Strong string settles into): harmonics 1–8, slightly stretched,
  // low-passed by `bright`, the upper ones shorter, a 0.4 ms ring-in and a 2 ms contact noise. o.dark (the harp): a gut
  // string, harmonics falling as 1/n under min(4 kHz, 3 f0), nothing above 5 kHz, the contact at most 3 kHz. o.tune (the
  // harp's strings, notes/sea-song/r2 and r3): in tune. No detune of its own (the note's tuning is already in f0),
  // harmonic partials (exactly n·f0) and fixed start phases, as a real pluck has: partials that meet another string's
  // (an octave copy, a chord's octave or fifth) add the same way every time, with no slow beat and no level left to
  // chance. Partial n starts at PH_ODD of n's odd part plus o.ph0 turns: n and 2n of one string start alike, and the
  // octave copies of the pointer's harp (ph0 a quarter turn an octave) meet in quadrature, so they add in power, as
  // independent strings do on average, every time, and do not all start rising together, which would be a click (the
  // other cues keep 1 + 0.0008 n² and random phases). o.oct (a piece's note): the
  // 2nd partial at this level of the fundamental and with its decay, the soft octave for small speakers, on the string
  // itself, a steady doubling
  const oddPart = (n) => { while (!(n & 1)) n >>= 1; return n; }, PH_ODD = { 1: 0, 3: 0.5, 5: 0.25, 7: 0.75 };
  function pluck(Pt, d, f0, o) {
    const f = o.tune ? f0 : f0 * cents(rnd(-3, 3)), g = (o.amp || 0.1) * vdb(o.dark ? 1.0 : 1.5), t60 = o.t60 || 0.4;
    let fcut = -Math.log(1 - clamp(o.bright == null ? 0.5 : o.bright, 0.05, 0.95)) * FS / TAU;
    if (o.dark) fcut = Math.min(fcut, 4000, 3 * f0);
    const hs = []; let norm = 0;
    for (let n = 1; n <= 8; n++) { const fn = o.tune ? f * n : f * n * (1 + 0.0008 * n * n); if (fn > (o.dark ? 5000 : 0.45 * FS)) break; const a = 1 / Math.sqrt(1 + Math.pow(fn / fcut, 2)) / (o.dark ? n : Math.sqrt(n)); hs.push([fn, a, t60 / (1 + 0.35 * (n - 1))]); norm += a; }
    const jit = hs.map(() => rnd(0.9, 1.1));
    if (o.oct > 0 && hs.length > 1) { hs[1][1] = o.oct * hs[0][1]; hs[1][2] = hs[0][2]; jit[1] = jit[0]; }
    hs.forEach(([fn, a, tj], i) => Pt.push({ k: 'm', d, f: fn, a: 1.6 * g * a / norm, t60: tj * jit[i], tau: 0.0004, ph: o.tune ? (PH_ODD[oddPart(i + 1)] + (o.ph0 || 0)) % 1 : R() }));
    Pt.push({ k: 'n', d, dur: 0.002, fc: Math.min(2 * fcut, o.dark ? 3000 : 6000), a: 0.1 * g, seed: seed32() });
  }
  const air = (Pt, d, dur, fa, fb, q, amp, o = {}) => Pt.push({ k: 'air', d, dur, fa, fb, q, a: amp, att: o.att, fl: o.fl, seed: seed32() });
  const bowed = (Pt, d, f0, o) => Pt.push({ k: 'bow', d, f0, f1: o.f1, glide: o.glide, att: o.att || 0.2, hold: o.hold || 0.1, t60: o.t60 || 0.6, a: (o.amp || 0.05) * vdb(1),
    vs: [[-5, 0.34], [0.3, 0.4], [5.5, 0.26]].map(([c, a]) => [cents(c + rnd(-1.5, 1.5)), a, R()]) });
  function many(Pt, d, dir) { for (let j = 0; j < 5; j++) strike(Pt, d + 0.035 * j + (j ? rnd(-0.003, 0.003) : 0), penta(dir > 0 ? 5 + j : 9 - j), 'glass', { vel: 0.4, soft: 0.8, t60: 0.2, amp: 0.10 }); }

  // the catalog: tier, the minimum gap between two starts (ms), the room send, count-bearing (never softened by
  // repetition), label and meaning (tests, the lab), make(parts, o). Recipes: DESIGN v2 §2 and board.html (unchanged)
  const CATALOG = {
    snap: { tier: 'ui', gap: 125, wet: 0.05, label: 'Snap', what: 'The pointer settled on a grid point (separate switch, off by default)',
      make: (Pt, o) => strike(Pt, 0, 2100, 'block', { vel: o.vel == null ? 0.5 : o.vel, soft: 0.5, t60: 0.03, amp: 0.28, detune: 60, var: 2.5 }) },
    toggleOn: { tier: 'ui', gap: 60, wet: 0.08, label: 'Toggle on', what: 'A switch or option turned on: a kalimba tine, A5',
      make: (Pt, o) => strike(Pt, 0, st0(19), 'tine', { vel: o.vel == null ? 0.65 : o.vel, soft: 1.1, t60: 0.24, amp: 0.265, detune: 6 }) },
    toggleOff: { tier: 'ui', gap: 60, wet: 0.08, label: 'Toggle off', what: 'A switch or option turned off: a darker tine, E5',
      make: (Pt, o) => strike(Pt, 0, st0(14), 'tine', { vel: o.vel == null ? 0.5 : o.vel, soft: 1.8, t60: 0.15, amp: 0.36, detune: 6 }) },
    stepAdd: { tier: 'ui', gap: 80, wet: 0.08, label: 'Add a step', what: 'A function joined the chain: tines D5 then A5',
      make: (Pt) => { strike(Pt, 0, st0(12), 'tine', { vel: 0.55, soft: 1.3, t60: 0.2, amp: 0.205, detune: 6 }); strike(Pt, 0.058 + rnd(-0.004, 0.004), st0(19), 'tine', { vel: 0.65, soft: 1.1, t60: 0.26, amp: 0.22, detune: 6 }); } },
    stepRemove: { tier: 'ui', gap: 80, wet: 0.08, label: 'Remove a step', what: 'A function left the chain: tines A5 then D5',
      make: (Pt) => { strike(Pt, 0, st0(19), 'tine', { vel: 0.62, soft: 1.2, t60: 0.2, amp: 0.27, detune: 6 }); strike(Pt, 0.058 + rnd(-0.004, 0.004), st0(12), 'tine', { vel: 0.5, soft: 1.8, t60: 0.14, amp: 0.24, detune: 6 }); } },
    view: { tier: 'ui', gap: 80, wet: 0.08, label: 'Switch view', what: 'X → Y, Phase, Landscape: a card of air, then a wooden bar on a degree of the scale',
      make: (Pt, o) => { air(Pt, 0, 0.05, 2600, 3400, 1.4, 0.03, { att: 0.3 }); strike(Pt, 0.02, st0([12, 16, 19, 21][clamp(o.k | 0, 0, 3)]), 'wood', { vel: 0.6, soft: 1.6, t60: 0.22, amp: 0.20, detune: 6 }); } },
    exportDone: { tier: 'ui', gap: 300, wet: 0.10, label: 'Export ready', what: 'A figure or file is ready: a paper slide, then glass A5 and E6',
      make: (Pt) => { air(Pt, 0, 0.2, 700, 2200, 1.1, 0.16, { att: 0.55, fl: 0.25 }); strike(Pt, 0.17, st0(19), 'glass', { vel: 0.55, soft: 0.9, t60: 0.6, amp: 0.32 }); strike(Pt, 0.19, st0(26), 'glass', { vel: 0.45, soft: 0.9, t60: 0.45, amp: 0.14 }); } },
    error: { tier: 'ui', gap: 250, wet: 0.06, label: 'Error', what: 'Something could not be done (with the message): two woodblock knocks, the second lower',
      make: (Pt) => { for (const [u, a, c] of [[0, 1, 0], [0.088 + rnd(-0.005, 0.005), 0.85, -25]]) { strike(Pt, u, st0(0) * cents(c), 'block', { vel: 0.8 * a, soft: 0.9, t60: 0.09, amp: 0.26, knock: 5 }); strike(Pt, u, st0(12) * cents(c), 'block', { vel: 0.7 * a, soft: 0.9, t60: 0.06, amp: 0.40, knock: 0 }); } } },
    edge: { tier: 'ui', gap: 150, wet: 0.05, label: 'Edge', what: 'The keyboard probe reached the edge of the view: a felt tap and a block tick',
      make: (Pt) => { strike(Pt, 0, st0(7), 'skin', { vel: 0.6, soft: 1.8, t60: 0.1, amp: 0.17, drop: 1, knock: 3.5 }); strike(Pt, 0, st0(19), 'block', { vel: 0.5, soft: 0.8, t60: 0.05, amp: 0.34 }); } },

    morphStart: { tier: 'events', gap: 200, wet: 0.22, label: 'Deformation plays', what: 'H_t starts from t = 0 (once per play you start; never on loop repeats): an inhale under two bowed glasses',
      make: (Pt) => { air(Pt, 0, 0.6, 600, 2600, 0.9, 0.04, { att: 0.45, fl: 0.3 }); bowed(Pt, 0, st(12), { att: 0.22, hold: 0.12, t60: 0.7, amp: 0.05 }); bowed(Pt, 0.03, st(19), { att: 0.25, hold: 0.1, t60: 0.7, amp: 0.04 }); } },
    morphEnd: { tier: 'events', gap: 300, wet: 0.25, label: 'Deformation arrives', what: 'H_t reached t = 1 (once per play you start): a wooden body, glass D6 and F♯6; harder at a faster play',
      make: (Pt, o) => { const v = o.vel == null ? 0.6 : o.vel; strike(Pt, 0, st(0), 'wood', { vel: 0.5, soft: 2.2, t60: 0.5, amp: 0.10 }); strike(Pt, 0.012, st(24), 'glass', { vel: v, soft: 0.9, t60: 1.0, amp: 0.13 }); strike(Pt, 0.04, st(28), 'glass', { vel: v * 0.85, soft: 0.9, t60: 0.9, amp: 0.095 }); } },
    // the scrub's landmarks: t = 0, ¼, ½, ¾, 1 (the texture carries the speed; scrub() below)
    landmark: { tier: 'events', gap: 0, wet: 0.15, count: true, label: 'Deformation landmark', what: 'Dragging t across 0, ¼, ½, ¾ or 1: a wooden note D5, F♯5, A5, B5, D6, harder when faster',
      make: (Pt, o) => { const q = clamp(o.q | 0, 0, 4); strike(Pt, 0, st([12, 16, 19, 21, 24][q]), 'wood', { vel: o.vel == null ? 0.5 : o.vel, soft: 1.8, t60: q === 0 || q === 4 ? 0.45 : 0.3, amp: 0.065 }); } },
    loopDone: { tier: 'events', gap: 200, wet: 0.22, count: true, label: 'Loop closed', what: 'Its winding number W as |W| glass pings, rising for W > 0, falling for W < 0; W = 0 a single soft knock (with Hear the function on, the loop sings instead)',
      make: (Pt, o) => {
        const w = o.w | 0, n = Math.min(8, Math.abs(w));
        if (!w) return strike(Pt, 0, st(19), 'block', { vel: 0.5, soft: 1.2, t60: 0.08, amp: 0.270 });
        for (let j = 0; j < n; j++) strike(Pt, 0.125 * j + (j ? rnd(-0.003, 0.003) : 0), penta(w > 0 ? 5 + j : 5 - j), 'glass', { vel: j ? 0.62 - 0.02 * j : 0.85, soft: 0.8, t60: 0.5, amp: 0.11, detune: 2 });
        if (Math.abs(w) > 8) many(Pt, 0.125 * n, w > 0 ? 1 : -1);
      } },

    // (o.one: the first pluck only, a composed piece's drum: notes/sea-song)
    cut: { tier: 'sonify', gap: 120, wet: 0.08, label: 'Branch cut', what: 'The probe crossed a branch cut: F jumps there. Two muted plucks stepping down',
      make: (Pt, o) => { pluck(Pt, 0, st(28), { t60: 0.09, bright: 0.22, amp: 0.16 }); if (!o.one) pluck(Pt, 0.035, st(24), { t60: 0.12, bright: 0.18, amp: 0.16 }); } },
    zero: { tier: 'sonify', gap: 250, wet: 0.2, label: 'Zero', what: 'The probe reached a zero; one glass ping per order (the argument principle on a small circle), harder when approached faster',
      make: (Pt, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.11; for (let j = 0; j < m; j++) strike(Pt, sp * j, st(24), 'glass', { vel: (o.vel == null ? 0.6 : o.vel) * (j ? 0.75 : 1), soft: 0.8, t60: 0.55, amp: 0.21, detune: 2 }); } },
    pole: { tier: 'sonify', gap: 250, wet: 0.14, label: 'Pole', what: 'The probe reached a pole; one felt thump per order',
      make: (Pt, o) => { const m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.12, v = o.vel == null ? 0.7 : o.vel; for (let j = 0; j < m; j++) { strike(Pt, sp * j, st(7), 'skin', { vel: v * (j ? 0.75 : 1), soft: 1.6, t60: 0.16, amp: 0.36, drop: 1.5, knock: 3.5 }); strike(Pt, sp * j, st(-5), 'skin', { vel: v * (j ? 0.75 : 1), soft: 2.4, t60: 0.2, amp: 0.06, drop: 1.5, knock: 0 }); strike(Pt, sp * j, st(19), 'wood', { vel: v * (j ? 0.75 : 1), soft: 1.4, t60: 0.07, amp: 0.13, drop: 1, detune: 2 }); } } },
    dense: { tier: 'sonify', gap: 600, wet: 0.15, label: 'Many zeros or poles', what: 'More than two zeros or poles within 300 ms (a cluster): one quiet cue, then 600 ms of silence for them',
      make: (Pt) => { for (let j = 0; j < 3; j++) strike(Pt, 0.04 * j + (j ? rnd(-0.004, 0.004) : 0), penta(5 + j), 'glass', { vel: 0.35, soft: 0.8, t60: 0.2, amp: 0.085 }); } },
    contour: { tier: 'sonify', gap: 0, wet: 0.05, count: true, label: 'Contour', what: 'The probe crossed a level line of |F| (Landscape): a wooden bar on the Height note, an octave up',
      make: (Pt, o) => strike(Pt, 0, 2 * hNote(clamp(o.k | 0, HMIN, HMAX)), 'wood', { vel: o.vel == null ? 0.5 : o.vel, soft: 1.4, t60: 0.09, amp: 0.25, detune: 2 }) },
    // (the queued count-bearing bell of v15; the harp's low D is the turn now, so the app no longer rings it)
    turn: { tier: 'sonify', gap: 0, wet: 0.2, count: true, label: 'One full turn', what: 'arg F completed a turn: a grace note, then glass on the home pitch class (no pitch variation)',
      make: (Pt, o) => { let f = 36.7081 * Math.pow(2, ((o.pc || 0) % 1 + 1) % 1); while (f < 1700) f *= 2; const up = (o.dir || 1) > 0; strike(Pt, 0, up ? f * 2 / 3 : f * 4 / 3, 'glass', { vel: 0.35, soft: 0.8, t60: 0.14, amp: 0.12, detune: 0 }); strike(Pt, 0.045, f, 'glass', { vel: 0.7, soft: 0.7, t60: 0.6, amp: 0.15, detune: 0 }); } },
    turnMany: { tier: 'sonify', gap: 0, wet: 0.2, count: true, label: 'Many turns', what: 'More turns than can be counted live (> 8 queued): a quick run of five glass notes',
      make: (Pt, o) => many(Pt, 0, (o.dir || 1) > 0 ? 1 : -1) },
    collide: { tier: 'sonify', gap: 300, wet: 0.18, label: 'Preimages collide', what: 'w crossed a critical value: two preimages merged. Two bowed glasses gliding into one',
      make: (Pt) => { const f = st(19); bowed(Pt, 0, f * Math.pow(2, 2 / 12), { f1: f, glide: 0.22, att: 0.04, hold: 0.1, t60: 0.5, amp: 0.06 }); bowed(Pt, 0, f / Math.pow(2, 2 / 12), { f1: f, glide: 0.22, att: 0.04, hold: 0.1, t60: 0.5, amp: 0.06 }); } },
  };
  // level trims (dB) from the level match against v15's palette (notes/sound/v2/MEASUREMENTS.md, board.html)
  const TRIM = { toggleOn: -1.07, toggleOff: -0.4, stepAdd: 0.06, stepRemove: -0.72, view: 2.75, exportDone: -1.8, error: -0.82, edge: -2.23, snap: -2.85, morphStart: 1.91, morphEnd: -0.59, loopDone: 0.48, zero: -0.35, pole: 0.1, dense: 0.35, cut: -3.25, turn: -0.43, turnMany: -1.43, contour: -1.52, collide: 0.5 };
  // the calibrated levels of hearing the function (notes/sound/hearf/PROTOTYPE.md): one harp note at velocity 0.7 and
  // |F| = 1 is −32 ± 2.5 LUFS-M, a D (with its accent) 2 to 5 dB over E; the singer's unit-energy spectrum at lvl 1 is
  // −32 LUFS-M (the release note +1 dB). The harp's copies now have fixed phases (pluck: their coinciding partials in
  // quadrature, notes/sea-song/r3), and the folded D accent: seeds 1–8 give E −34.1 to −32.9, D −31.0 to −29.9, D − E
  // 2.6 to 3.7 dB (round 2, random phases: E −34.6 to −30.3, D − E −0.5 to +6.6)
  const LV = { harp: 0.0831, hv: 0.83 };

  // ---------------------------------------------------------------- the synth node (or the fallback)
  // the worklet's source: the library, the synth processor (6 tier outputs + the audition pair), the Height voice
  const WORKLET_SRC = `'use strict';
const L = (${SND_LIB.toString()})();
class Synth extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.fs = sampleRate; this.q = []; this.cues = []; this.strs = []; this.tex = new Map(); this.dying = [];
    this.y = new Float32Array(128); this.sd = new Float32Array(128); this.sw = new Float32Array(128);
    this.sg = L.Singer(this.fs, p.seed || 4242); this.nFade = Math.round(0.012 * this.fs);
    this.stat = { cues: 0, late: 0, maxLateMs: 0, steals: 0, maxStrings: 0, maxCues: 0 };
    for (const c of p.cmds || []) this.push(c);
    this.port.onmessage = (e) => { if (e.data === 'stat') { this.port.postMessage(this.stat); return; } for (const c of e.data) this.push(c); };
  }
  push(c) { if (c.k === 'clear') { this.clear(c.tag); return; } c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }
  // {k: 'clear'} (Esc, off, a hidden tab): queued commands are dropped, parts that have not started are dropped, and
  // what sounds fades to 0 on a 12 ms raised cosine; the texture and the singer too. {k: 'clear', tag}: only that tag's
  // cues (a "listen along" stopped)
  clear(tag) {
    const all = tag == null, now = currentFrame;
    this.q = all ? [] : this.q.filter((c) => c.tag !== tag);
    for (let ci = this.cues.length - 1; ci >= 0; ci--) {
      const cue = this.cues[ci];
      if (!all && cue.tag !== tag) continue;
      cue.parts = cue.parts.filter((p) => p.live && p.sf < now);
      if (!cue.parts.length) { this.drop(ci); continue; }
      if (cue.fade < 0) { cue.fade = 0; cue.fadeN = this.nFade; }
    }
    if (all) { for (const T of this.tex.values()) { T.fade = 0; this.dying.push(T); } this.tex.clear(); this.sg.hush(); }
    else if (this.sg.h.tag === tag) this.sg.hush();
  }
  drop(ci) { const cue = this.cues[ci]; this.cues.splice(ci, 1); if (cue.str) { const k = this.strs.indexOf(cue); if (k >= 0) this.strs.splice(k, 1); } }
  start(c, f0) {
    const fs = this.fs, sh = c.f < f0 ? f0 - c.f : 0;
    if (sh) { this.stat.late++; this.stat.maxLateMs = Math.max(this.stat.maxLateMs, 1000 * sh / fs); }
    this.stat.cues++;
    const cue = { tier: c.tier, pan: c.pan || 0, g: c.g == null ? 1 : c.g, wet: c.wet || 0, tag: c.tag, str: !!c.str, key: c.key || 0, fade: -1, fadeN: this.nFade,
      parts: c.parts.map((p) => ({ sf: c.f + sh + Math.round((p.d || 0) * fs), v: L.MAKE[p.k](p, fs), live: true })) };
    // the harp's strings: at most 12 at once (c.cap: a composed piece's, notes/sea-song); the oldest fades out over
    // 30 ms (raised cosine) when one more starts. c.key (a piece's string, its MIDI note): a string plucked again is
    // damped first, as a harpist re-plucks one string (notes/sea-song/r3)
    if (cue.str) {
      const strs = this.strs;
      if (cue.key) for (let i = strs.length - 1; i >= 0; i--) if (strs[i].key === cue.key) { const o = strs.splice(i, 1)[0]; if (o.fade < 0) { o.fade = 0; o.fadeN = Math.round(0.03 * fs); } this.stat.steals++; }
      while (strs.length >= (c.cap || 12)) { const o = strs.shift(); if (o.fade < 0) { o.fade = 0; o.fadeN = Math.round(0.03 * fs); } this.stat.steals++; }
      strs.push(cue); if (strs.length > this.stat.maxStrings) this.stat.maxStrings = strs.length;
    }
    this.cues.push(cue); if (this.cues.length > this.stat.maxCues) this.stat.maxCues = this.cues.length;
  }
  fadeY(o, y, n) { const N = o.fadeN || this.nFade; for (let j = 0; j < n; j++) { const k = o.fade + j; y[j] *= k >= N ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * k / N); } o.fade += n; return o.fade >= N; }
  mix(outs, tier, pan, g, wet, y, n) {
    const th = (Math.max(-0.4, Math.min(0.4, pan)) + 1) * Math.PI / 4, gl = g * Math.cos(th), gr = g * Math.sin(th);
    const D = outs[2 * tier], W = outs[2 * tier + 1];
    if (D && D[0]) { const A = D[0], B = D[1] || D[0]; for (let j = 0; j < n; j++) { A[j] += y[j] * gl; if (B !== A) B[j] += y[j] * gr; } }
    if (wet && W && W[0]) { const A = W[0], B = W[1] || W[0], wl = gl * wet, wr = gr * wet; for (let j = 0; j < n; j++) { A[j] += y[j] * wl; if (B !== A) B[j] += y[j] * wr; } }
  }
  process(_, outs) {
    const f0 = currentFrame, n = outs[0][0].length, y = this.y, fs = this.fs;
    while (this.q.length && this.q[0].f < f0 + n) {
      const c = this.q.shift();
      if (c.k === 'cue') this.start(c, f0);
      else if (c.k === 'tex') { let T = this.tex.get(c.id); if (!T) { T = L.Tex(fs, c.seed || 7); this.tex.set(c.id, T); } T.set(c, Math.max(c.f, f0)); }
      else if (c.k === 'hv') this.sg.cmd(c, Math.max(c.f, f0));
    }
    for (let ci = this.cues.length - 1; ci >= 0; ci--) {
      const cue = this.cues[ci]; y.fill(0); let more = false, any = false;
      for (const p of cue.parts) {
        if (!p.live) continue;
        if (p.sf >= f0 + n) { more = true; continue; }
        any = true; p.live = p.v.run(y, Math.max(0, p.sf - f0), n); if (p.live) more = true;
      }
      let gone = false; if (cue.fade >= 0) { if (any) gone = this.fadeY(cue, y, n); else gone = true; }
      if (any) this.mix(outs, cue.tier, cue.pan, cue.g, cue.wet, y, n);
      if (!more || gone) this.drop(ci);
    }
    for (let di = this.dying.length - 1; di >= 0; di--) {
      const T = this.dying[di]; T.run(y, f0, n); const gone = this.fadeY(T, y, n); this.mix(outs, T.tier, T.pan, 1, T.wet, y, n);
      if (gone) this.dying.splice(di, 1);
    }
    for (const [id, T] of this.tex) {
      if (T.silent(f0)) { if (T.end || f0 - T.last > 30 * fs) this.tex.delete(id); continue; }
      T.run(y, f0, n); this.mix(outs, T.tier, T.pan, 1, T.wet, y, n);
    }
    const sd = this.sd, sw = this.sw;
    sd.fill(0); sw.fill(0);
    if (this.sg.run(sd, sw, n, f0)) {
      const D = outs[2 * this.sg.tier()], W = outs[2 * this.sg.tier() + 1];
      if (D && D[0]) { const A = D[0], B = D[1] || D[0]; for (let j = 0; j < n; j++) { A[j] += sd[j]; if (B !== A) B[j] += sd[j]; } }
      if (W && W[0]) { const A = W[0], B = W[1] || W[0]; for (let j = 0; j < n; j++) { A[j] += sw[j]; if (B !== A) B[j] += sw[j]; } }
    }
    return true;
  }
}
registerProcessor('cmw-synth', Synth);
// the Height voice (the Landscape): an organ tone (harmonics 1–4 at 1/n), every sample from per-sample-smoothed
// controls; s is log2 of the frequency, slewed linearly; gate and duck by two cascaded one-poles (zero slope at onset)
const ORG = [1, 1 / 2, 1 / 3, 1 / 4]; let ONORM = 0;
for (let i = 0; i < 4096; i++) { const a = 2 * Math.PI * i / 4096; let s = 0; for (let h = 0; h < 4; h++) s += ORG[h] * Math.sin((h + 1) * a); ONORM = Math.max(ONORM, Math.abs(s)); }
ONORM = 1 / ONORM;
class Voice extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.q = []; this.fs = sampleRate; this.s = 0; this.sFrom = 0; this.sTo = 0; this.sLen = 0; this.sPos = 0; this.fresh = true; this.ph = 0;
    this.pan = 0; this.panT = 0; this.g = 0; this.g1 = 0; this.gT = 0; this.gA = this.coef(0.01); this.dk = 1; this.dk1 = 1; this.dkT = 1; this.dkA = this.coef(0.005); this.dkEnd = -1;
    this.aPan = this.coef(0.03); this.aAmp = this.coef(0.012); this.end = -1; this.amp = 0; this.ampT = 0;
    for (const c of p.cmds || []) this.push(c);
    this.port.onmessage = (e) => { for (const c of e.data) this.push(c); };
  }
  coef(tau) { return tau > 0 ? 1 - Math.exp(-1 / (tau * this.fs)) : 1; }
  quiet() { return this.g < 1e-4 && this.g1 < 1e-4; }
  push(c) { c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }
  apply(c, frame) {
    if (c.lf != null) { if (this.fresh || this.quiet()) { this.s = this.sTo = c.lf; this.sLen = 0; } else { this.sFrom = this.s; this.sTo = c.lf; this.sLen = Math.max(1, Math.round((c.dur || 0.008) * this.fs)); this.sPos = 0; } }
    if (c.pan != null) { this.panT = c.pan; if (this.fresh) this.pan = c.pan; }
    if (c.amp != null) { this.ampT = c.amp; if (this.fresh || this.quiet()) this.amp = c.amp; }
    if (c.gate != null) { this.gT = c.gate; this.gA = this.coef(c.tau / 2); }
    if (c.duck != null) { this.dkT = 0.5; this.dkA = this.coef(0.005); this.dkEnd = frame + Math.round(c.duck * this.fs); }
    if (c.stop) { this.gT = 0; this.gA = this.coef((c.tau || 0.05) / 2); this.end = frame + Math.round(0.5 * this.fs); }
    this.fresh = false;
  }
  process(_, outputs) {
    const out = outputs[0], Lc = out[0], Rc = out[1] || out[0], n = Lc.length, f0 = currentFrame, fs = this.fs, inv = 1 / fs;
    for (let i = 0; i < n; i++) {
      const fr = f0 + i;
      while (this.q.length && this.q[0].f <= fr) this.apply(this.q.shift(), fr);
      if (this.dkEnd >= 0 && fr >= this.dkEnd) { this.dkT = 1; this.dkA = this.coef(0.04); this.dkEnd = -1; }
      if (this.sLen > 0) { this.sPos++; if (this.sPos >= this.sLen) { this.s = this.sTo; this.sLen = 0; } else this.s = this.sFrom + (this.sTo - this.sFrom) * (this.sPos / this.sLen); }
      this.pan += (this.panT - this.pan) * this.aPan;
      this.g1 += (this.gT - this.g1) * this.gA; this.g += (this.g1 - this.g) * this.gA;
      this.dk1 += (this.dkT - this.dk1) * this.dkA; this.dk += (this.dk1 - this.dk) * this.dkA; this.amp += (this.ampT - this.amp) * this.aAmp;
      let y = 0;
      if (this.g > 1e-6 || this.g1 > 1e-6 || this.gT > 0) {
        const f = Math.pow(2, this.s); let p = this.ph + f * inv; p -= Math.floor(p); this.ph = p;
        let acc = 0; for (let h = 0; h < 4; h++) { const fh = f * (h + 1); if (fh < 0.45 * fs) { let q = p * (h + 1); q -= Math.floor(q); acc += ORG[h] * L.sin1(q); } }
        y = acc * ONORM * this.amp * this.g * this.dk;
      }
      const th = (this.pan + 1) * Math.PI / 4;
      Lc[i] = y * Math.cos(th); if (Rc !== Lc) Rc[i] = y * Math.sin(th);
    }
    return this.end < 0 || f0 < this.end;
  }
}
registerProcessor('cmw-voice', Voice);`;
  let workletURL = null;
  const workletURLs = () => {
    const u = [];
    try { if (!workletURL) workletURL = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' })); u.push(workletURL); } catch (e) { /* no Blob URLs */ }
    u.push('data:text/javascript;charset=utf-8,' + encodeURIComponent(WORKLET_SRC));
    return u;
  };
  // load the worklet into a context: a Blob URL, else a data: URL; false where neither is allowed (a CSP without
  // blob:/data: for scripts, no AudioWorklet): then the main-thread fallback
  let workletRefused = false;
  async function loadWorklet(c) {
    if (workletRefused || !c.audioWorklet || typeof AudioWorkletNode === 'undefined') return false;
    for (const u of workletURLs()) { try { await c.audioWorklet.addModule(u); return true; } catch (e) { /* refused: next */ } }
    workletRefused = true;
    return false;
  }
  // the synth node of a graph: 8 outputs (dry and wet of ui, events, sonify and the audition bus). Offline: made when
  // rendering starts, with every command in its options (exact and deterministic renders)
  function makeSynth(g) {
    const c = g.c, pend = [];
    let node = null;
    const make = () => {
      node = new AudioWorkletNode(c, 'cmw-synth', { numberOfInputs: 0, numberOfOutputs: 8, outputChannelCount: [2, 2, 2, 2, 2, 2, 2, 2], processorOptions: { cmds: pend.splice(0), seed: (seedBase ^ 0x5bd1e995) >>> 0 } });
      [g.tier.ui, g.tier.events, g.tier.sonify, g.aud].forEach((T, k) => { node.connect(T.dry, 2 * k); node.connect(T.wet, 2 * k + 1); });
    };
    if (g.offline) g.flush.push(make); else make();
    return { post(list) { if (node) node.port.postMessage(list); else pend.push(...list); }, node: () => node, stat: () => new Promise((res) => { if (!node) return res(null); const prev = node.port.onmessage; node.port.onmessage = (e) => { node.port.onmessage = prev; res(e.data); }; node.port.postMessage('stat'); }) };
  }
  // the fallback: the cue's parts rendered into a buffer on the main thread (the same code), played once
  function fallbackCue(g, cue, t) {
    const c = g.c, fs = c.sampleRate;
    let end = 0; for (const p of cue.parts) end = Math.max(end, LIB.partEnd(p));
    const n = Math.max(1, Math.ceil(end * fs) + 2), b = c.createBuffer(1, n, fs), y = b.getChannelData(0);
    for (const p of cue.parts) { const s = Math.round((p.d || 0) * fs); LIB.MAKE[p.k](p, fs).run(y, s, n); }
    if (cue.g !== 1) for (let i = 0; i < n; i++) y[i] *= cue.g;
    const src = c.createBufferSource(); src.buffer = b;
    const T = cue.tier === 3 ? g.audition : g, tn = TIERS[cue.tier === 3 ? 0 : cue.tier];
    // (its own gain, so that stopping a tagged group fades it first: review sound-4)
    src.out = out(T, tn, cue.pan, cue.wet);
    src.connect(src.out);
    src.tag = cue.tag;
    // rendering took main-thread time: a start already in the past would cut into the attack, so it starts no earlier
    // than now + LEAD, and the click regression's log has the true start (review sound-4)
    const t1 = g.offline ? t : Math.max(t, c.currentTime + LEAD);
    if (cueHook && !g.offline) { try { cueHook(t1, cue); } catch (e) { /* the test's */ } }
    src.start(t1); g.active.add(src); src.onended = () => g.active.delete(src);
    return t1 + end;
  }
  // (tests: the click regression logs every one-shot's scheduled start, so a detection at a note's own attack is told
  // from a snap)
  let cueHook = null;
  function emitCue(g, cue, t) {
    if (g.synth && (g.offline || prefer.worklet)) {
      if (cueHook && !g.offline) { try { cueHook(t, cue); } catch (e) { /* the test's */ } }
      g.synth.post([Object.assign({ k: 'cue', at: t }, cue)]); let e = 0; for (const p of cue.parts) e = Math.max(e, LIB.partEnd(p)); return t + e; }
    return fallbackCue(g, cue, t);
  }
  // one cue of the catalog into a graph at time t (no guards: play() has them; offline renders and the lab call this)
  const reps = new Map();
  function cueTo(g, name, t, o = {}) {
    const d = CATALOG[name]; if (!d) return t;
    FS = g.c.sampleRate;
    R = prng(o.seed != null ? o.seed : (seedBase + 0x9E3779B9 * ++cueN) >>> 0);
    // repetition softens: −1 dB per repeat within 2 s, down to −4 dB (not count-bearing cues, not auditions)
    let rg = 0;
    if (!d.count && !o.noRep && !o.audition && !g.offline) { const r = reps.get(name), k = r && t - r.t < 2 ? Math.min(4, r.k + 1) : 0; reps.set(name, { t, k }); rg = -k; }
    const Pt = [];
    d.make(Pt, o);
    const tier = o.audition ? 3 : TI[o.tier || d.tier];
    return emitCue(g, { tier, pan: clamp(o.pan || 0, -0.4, 0.4), wet: d.wet, g: Math.pow(10, (rg + (TRIM[name] || 0) + (o.gainDb || 0)) / 20), parts: Pt, tag: o.tag }, t);
  }

  // ---------------------------------------------------------------- lifecycle
  // Click-free scheduling: every one-shot starts at now + LEAD (its ring-in never begins in the past); the synth renders
  // from parameters, so a late message only adds latency. LEAD: measured in Chrome with 256-frame callbacks, a step at
  // currentTime + 6 ms still landed up to 2 ms late; at ≥ 10 ms never: twice the callback period, at least 12 ms.
  let LEAD = 0.012;
  const volGain = (v) => v * v;   // a squared taper is close to perceptual: 0.7 → −6.2 dB, 0.5 → −12 dB, 0.1 → −40 dB
  function applyGains(fast) {
    if (!G) return;
    const t = ctx.currentTime;
    follow(ctx, G.master.gain, P.on && !hidden ? volGain(P.vol) : 0, fast ? 0.004 : 0.03, t);
    for (const k of TIERS) { follow(ctx, G.tier[k].dry.gain, P[k] ? 1 : 0, 0.03, t); follow(ctx, G.tier[k].wet.gain, P[k] ? 1 : 0, 0.03, t); }
  }
  // create or resume, only in or after an activation gesture in this frame
  function ensure() {
    if (!AC || !P.on || hidden || !mayStart()) return false;
    if (!ctx || ctx.state === 'closed') {
      try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* not iOS 16.4+ */ }
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = null; return false; }
      ctx.onstatechange = () => { if (ctx.state === 'running') graceUsed = false; emit(); };
      LEAD = Math.max(0.012, 2 * (ctx.baseLatency || 0.005));
      G = graph(ctx, 0);
      // the worklet loads in the background; until it is there (or where it is refused) the fallback renders cues
      if (prefer.worklet) { const g = G; loadWorklet(ctx).then((ok) => { g.worklet = ok; if (ok) g.synth = makeSynth(g); g.engine = ok ? 'worklet' : 'nodes'; emit(); }); } else G.engine = 'nodes';
      applyGains(true);
    }
    if (ctx.state !== 'running') ctx.resume().then(emit, () => {});
    emit();
    return true;
  }
  // may a sound be scheduled now? Only on a running clock: a suspended or iOS-"interrupted" context would release a
  // backlog as a burst on resume. The one exception: a single sound inside an active gesture (the "on" confirmation).
  function canSchedule(grace) {
    if (ctx && ctx.state === 'running') return true;
    if (!ensure()) return false;
    if (ctx.state === 'running') return true;
    if (grace && !graceUsed && inGesture()) { graceUsed = true; return true; }
    return false;
  }
  const onActivate = (e) => { if (e.type === 'keydown' && e.key === 'Escape') return; activated = true; lastGesture = performance.now(); if (P.on && !hidden && (!ctx || ctx.state !== 'running')) ensure(); };
  for (const ev of ['pointerdown', 'pointerup', 'keydown', 'touchend', 'click']) window.addEventListener(ev, onActivate, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    hidden = document.visibilityState === 'hidden';
    if (ctx) {
      if (hidden) { applyGains(true); hush(); setTimeout(() => { if (hidden && ctx.state === 'running') ctx.suspend().then(emit, () => {}); }, 60); }
      else if (P.on && mayStart()) { ctx.resume().then(emit, () => {}); applyGains(); }
    }
    emit();
  });
  window.addEventListener('pagehide', () => { if (ctx && ctx.state === 'running') { hush(); ctx.suspend().then(emit, () => {}); } });
  // an idle engine sleeps (no audio device kept awake); the next request wakes it
  function touchIdle(ms = 30000) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (!ctx || ctx.state !== 'running') return;
      if (liveVoices.size || G.active.size || singOn || ctx.currentTime < busyUntil) { touchIdle(5000); return; }
      ctx.suspend().then(emit, () => {});
    }, ms);
  }
  const busy = (end) => { if (end > busyUntil) busyUntil = end; touchIdle(); };

  // ---------------------------------------------------------------- one-shots
  const lastStart = new Map(), recent = [], zpTry = [];
  let zpQuietUntil = 0;
  function play(name, o = {}) {
    const d = CATALOG[name];
    if (!d || !AC || !P.on || hidden) return false;
    const tier = o.tier || d.tier;
    if (!o.audition && (!P[tier] || (name === 'snap' && !P.snap))) return false;
    if (!canSchedule(!!o.grace)) return false;
    const now = performance.now(), sched = !!o.force || o.at > 0;
    // zeros and poles are never forced: a shared gap, and a cluster (≥ 3 entries in 300 ms: sin(1/z), z⁵⁰ − 1,
    // Blaschke products) becomes one quiet "dense" cue followed by 600 ms of silence for them
    if ((name === 'zero' || name === 'pole') && !o.audition) {
      while (zpTry.length && now - zpTry[0] > 300) zpTry.shift();
      zpTry.push(now);
      if (now < zpQuietUntil) return false;
      // (returns 'dense' when the cluster cue played instead: the app says so once, review snddef-4)
      if (zpTry.length >= 3) { zpQuietUntil = now + 600; return play('dense', { pan: o.pan }) && 'dense'; }
      if (now - (lastStart.get('zp') || -1e9) < d.gap) return false;
      lastStart.set('zp', now);
    } else if (!o.force && now - (lastStart.get(name) || -1e9) < d.gap) return false;
    // a storm guard for decorative one-shots: at most 14 a second. Scheduled and forced (count-bearing) cues neither
    // count against it nor are refused by it.
    while (recent.length && now - recent[0] > 1000) recent.shift();
    if (!sched && recent.length >= 14 && name !== 'error') return false;
    lastStart.set(name, now); if (!sched) recent.push(now);
    const t = ctx.currentTime + LEAD + (o.at || 0), end = cueTo(G, name, t, o);
    // the Height voice gives way: −6 dB for the cue's first 250 ms
    for (const v of liveVoices) v.duck(t, Math.min(0.25, end - t));
    busy(end);
    return true;
  }
  // count-bearing cues are never dropped silently: they queue on the audio clock (bells ≤ 8/s; contour ticks ≤ 12/s).
  // Beyond 8 queued bells one "many turns" flourish plays; contour ticks beyond 0.5 s of backlog coalesce (the Height
  // tone itself is the staircase). q.due: when each queued cue sounds (its slot + LEAD), oldest first
  const Q = { turn: { next: 0, gap: 0.125, cap: 8, many: 0, due: [] }, contour: { next: 0, gap: 0.083, cap: 6, many: 0, due: [] } };
  function queued(name, o) {
    if (!AC || !P.on || hidden || !P[o.tier || 'sonify'] || !canSchedule(false)) return false;
    const q = Q[name], now = ctx.currentTime, at = Math.max(now, q.next);
    while (q.due.length && q.due[0] <= now) q.due.shift();
    if (q.due.length >= q.cap) {
      if (name === 'turn' && !(q.many > now)) { q.many = q.next; play('turnMany', Object.assign({}, o, { at: q.next - now, force: true })); q.due.push(q.next + LEAD); q.next += 0.25; }
      return 'coalesced';
    }
    q.next = at + q.gap; q.due.push(at + LEAD);
    return play(name, Object.assign({}, o, { at: at - now, force: true }));
  }

  // ---------------------------------------------------------------- the deformation: scrub and motion (DESIGN v2 §3–4)
  // scrub(u0, u1): the slider moved t / its length from u0 to u1 (every input event). The texture follows the speed
  // (t per second) and t; the landmarks t = 0, ¼, ½, ¾, 1 ring a wooden note, harder when faster (forced, never
  // dropped). (board-fixes: a landmark re-arms only after t has left it by 0.02, 0.05 at the ends, beyond the slider's
  // 0.03 snap; the same landmark at most once in 150 ms; one input event rings at most one, the one nearest where t
  // lands: a resting, trembling hand, the snap zone and a jump do not machine-gun.) scrubEnd(): the hand let go.
  const SC = { last: null, v: 0, armed: [true, true, true, true, true], lmLast: [-1e9, -1e9, -1e9, -1e9, -1e9], tex: false };
  function scrub(u0, u1) {
    u0 = clamp(+u0 || 0, 0, 1); u1 = clamp(+u1 || 0, 0, 1);
    const wall = performance.now() / 1000, dtw = SC.last == null ? 0.016 : clamp(wall - SC.last, 0.008, 0.1);
    SC.last = wall;
    const v = SC.v = Math.abs(u1 - u0) / dtw;
    let best = -1;
    for (let q = 0; q <= 4; q++) {
      const m = q / 4;
      if (!SC.armed[q] && Math.abs(u0 - m) >= (q === 0 || q === 4 ? 0.05 : 0.02)) SC.armed[q] = true;
      if (((u0 < m && u1 >= m) || (u0 > m && u1 <= m)) && (best < 0 || Math.abs(u1 - m) < Math.abs(u1 - best / 4))) best = q;
    }
    if (!AC || !P.on || hidden || !P.events) { if (best >= 0) SC.armed[best] = false; return false; }
    if (!canSchedule(false)) return false;
    if (G.synth) { G.synth.post([{ k: 'tex', id: 1, at: ctx.currentTime + LEAD, v, t: u1, amp: 0.06, tier: 1, wet: 0.12, hold: 0.09, seed: 11 }]); SC.tex = true; busy(ctx.currentTime + 1); }
    let made = false;
    if (best >= 0) {
      const wq = wall * 1000;
      if (SC.armed[best] && wq - SC.lmLast[best] >= 150) { made = play('landmark', { q: best, vel: clamp(0.3 + 0.25 * Math.log2(1 + v), 0.3, 0.85), force: true }); SC.lmLast[best] = wq; }
      SC.armed[best] = false;
    }
    return made;
  }
  function scrubEnd() {
    SC.last = null; SC.v = 0;
    if (SC.tex && G && G.synth && ctx) G.synth.post([{ k: 'tex', id: 1, at: ctx.currentTime + LEAD, v: 0, end: true, rel: 0.16 }]);
    SC.tex = false;
  }
  // the motion bed: while the deformation plays its first pass, the same texture driven by the playback (t / length,
  // its rate in t / length per second); it fades on arrival (motionEnd)
  let motionOn = false;
  function motion(u, rate) {
    if (!AC || !P.on || hidden || !P.events || !G || !G.synth || !ctx || ctx.state !== 'running') return false;
    G.synth.post([{ k: 'tex', id: 2, at: ctx.currentTime + LEAD, v: rate, t: clamp(u, 0, 1), amp: 0.06, tier: 1, wet: 0.12, hold: 0.25, seed: 23 }]);
    motionOn = true; busy(ctx.currentTime + 1);
    return true;
  }
  function motionEnd() {
    if (motionOn && G && G.synth && ctx) G.synth.post([{ k: 'tex', id: 2, at: ctx.currentTime + LEAD, v: 0, end: true, rel: 0.13 }]);
    motionOn = false;
  }

  // ---------------------------------------------------------------- hearing the function: the phase harp (option 2)
  // The five lines arg F = 0°, 60°, 120°, 210°, 270° (lines 0, 2, 4, 7 and 9 of the default 12 sectors) pluck D, E, F♯,
  // A, B. A Schmitt trigger on each line (h = 1/96 turn): an up note when the unwrapped arg rises past θ + h having last
  // been below θ − h, a down note the other way; so a tremor under 7.5° across a line plays nothing, and the low Ds
  // counted up minus down are exactly the winding number of any closed path that starts more than 3.75° from arg 0.
  // A harp's lines are lines of the Phase key: line s (0 … 11) at arg F = 30°·s plucks D + s semitones. The pointer's
  // harp has five, HARP_LINES; a composed piece (notes/sea-song/r2) has its own, exactly the pitch classes its score uses.
  // v15.2 (review sound-3): the pointer's harp widens the band to what 2.5 px of the probe turn arg F (o.h: the app's
  // |F'/F| · 2.5 px, at most 1/8 turn), so a finger held still near a zero, where a pixel turns arg F by more than 7.5°,
  // plucks nothing; the count is the same (the trigger's state moves one line at a time, whatever the band)
  const HARP_LINES = [0, 2, 4, 7, 9], HARP_H = 1 / 96;
  const thrL = (L, i) => { const n = L.length; return Math.floor(i / n) + L[((i % n) + n) % n] / 12; };
  const cellL = (phi, L) => { let i = Math.floor(phi) * L.length; while (thrL(L, i + 1) <= phi) i++; while (thrL(L, i) > phi) i--; return i; };
  const cellOf = (phi) => cellL(phi, HARP_LINES);
  const linesOk = (L) => Array.isArray(L) && L.length >= 2 && L.length <= 12 && L.every((v, i) => Number.isInteger(v) && v >= 0 && v < 12 && (!i || v > L[i - 1]));
  // the crossings of the lines from cell c as the arg goes P0 → P1: [{i, dir, u}] (u: where along the step, 0 … 1)
  function harpCross(st, P0, P1, h = HARP_H) {
    const fired = [], L = st.L, tAt = (th) => (P1 === P0 ? 1 : clamp((th - P0) / (P1 - P0), 0, 1));
    while (P1 > thrL(L, st.c + 1) + h) { st.c++; fired.push({ i: st.c, dir: 1, u: tAt(thrL(L, st.c)) }); }
    while (P1 < thrL(L, st.c) - h) { fired.push({ i: st.c, dir: -1, u: tAt(thrL(L, st.c)) }); st.c--; }
    return fired;
  }
  // a seated probe's lap (v15.2.1, review verify-1): a probe seated inside a line's band (a long press, a first point)
  // that comes back to its seat's arg k whole turns on finds the trigger still a line short there (it waits for the
  // band), so a lap that stops where it began never sounded its D (a touch 15 px from a zero, from 3° or 8° above the
  // D line; at 6 px, inside the D-only zone, the lap was silent). Arriving within the band of φ_s + k, the trigger is
  // brought to its seat's cell + 5k in the direction of travel (5: the pointer's lines; st.L.length), plucking the line
  // between, as harpClose does for drawn loops; once per arrival (a hand held at the lap's end does not chatter). The
  // count is the state's, so nothing is counted twice. Only the pointer's harp (HP) has a lap: lap = {phi, c, k}
  function lapClose(st, P0, P1, h, fired) {
    const L = st.lap, k = Math.round(P1 - L.phi);
    if (k === L.k || !(Math.abs(P1 - (L.phi + k)) <= h)) return;
    L.k = k;
    const c = L.c + st.L.length * k;
    if (P1 > P0) while (st.c < c) { st.c++; fired.push({ i: st.c, dir: 1, u: 1 }); }
    else if (P1 < P0) while (st.c > c) { fired.push({ i: st.c, dir: -1, u: 1 }); st.c--; }
  }
  const lapSeat = (st, phi) => { if (st.lap) st.lap = st.c === null ? { phi: 0, c: null, k: 0 } : { phi, c: st.c, k: 0 }; };
  // Harp(lines): a piece's own lines (notes/sea-song); Harp(true): the pointer's harp, on HARP_LINES and with a lap
  function Harp(lines) { return { c: null, phi: 0, recent: [], up: 0, down: 0, notes: 0, k: 0, L: linesOk(lines) ? lines.slice() : HARP_LINES, lap: lines === true ? { phi: 0, c: null, k: 0 } : null }; }
  const HP = Harp(true);
  // one note: the pitch class (s semitones above D) in octave copies (D2 … 2.4 kHz) under a Gaussian over log2 f
  // (σ 0.7 octave, centred on D5 + 0.5·tanh(ln|F| / 2.5): lower near zeros, higher near poles), copies under −30 dB
  // dropped (usually 3 remain); each a dark plucked string (T60 1.8 s at D5, ∝ f^−0.5), in tune: one detune (±1.5 cents)
  // shared by all its strings, so its octaves are pure (notes/sea-song/r2). A D is +1.8 dB (×1.23; ×1.26 put the old
  // harp's D at −29.4 LUFS-M, 0.1 dB over its −32 ± 2.5 window: review sound-5) and has the turn's accent on
  // its D4 copy: that string is louder by the accent (half the note's level, added in power, as two independent strings
  // added on average), one string and not a second one at the same pitch, whose sum would depend on the phases
  // (notes/sea-song/r3). sign: in the D-only zone an up D also sounds the A above, a down D the A below
  function harpString(g, f, a, at, bright, pn, tier, tag, cap, oct, key, ph0) {
    R = prng((seedBase + 0x9E3779B9 * ++cueN) >>> 0);
    const Pt = []; pluck(Pt, 0, f, { t60: 1.8 * Math.pow(f / 587.33, -0.5), bright, amp: a, dark: true, tune: true, oct, ph0 });
    return emitCue(g, Object.assign({ tier: TI[tier], pan: pn, wet: 0.12, g: 1, parts: Pt, tag, str: 1 }, cap ? { cap } : {}, key ? { key } : {}), at);
  }
  function harpNote(g, s, vel, t, ln, dir, sign, pan, tier, tag, cap) {
    const cen = 0.5 * Math.tanh((Number.isFinite(ln) ? ln : ln > 0 ? 50 : -50) / 2.5), isD = s === 0, base = 73.416 * Math.pow(2, s / 12), bright = 0.2 + 0.25 * clamp((vel - 0.4) / 0.45, 0, 1);
    const amp = LV.harp * vel * (isD ? 1.23 : 1), pn = clamp((pan || 0) + 0.12 * dir, -0.4, 0.4);
    let end = t;
    FS = g.c.sampleRate;
    R = prng((seedBase + 0x9E3779B9 * ++cueN) >>> 0);
    const det = cents(rnd(-1.5, 1.5));
    const string = (f, a, at, oc) => { end = Math.max(end, harpString(g, f * det, a, at, bright, pn, tier, tag, cap, 0, 0, 0.25 * oc)); };
    for (let oc = 0; oc < 6; oc++) {
      const f = base * Math.pow(2, oc); if (f > 2400) break;
      const d = (Math.log2(f / 587.33) - cen) / 0.7, w0 = Math.exp(-0.5 * d * d), acc = isD && oc === 2 ? 0.5 : 0;
      if (w0 < 0.0316 && !acc) continue;
      const w = w0 < 0.0316 ? 0 : w0;
      string(f, amp * Math.hypot(w, acc), t, oc);
      if (sign && w > 0.5) string(f * Math.pow(2, (dir > 0 ? 7 : -5) / 12), 0.3 * amp * w, t + 0.03, oc);
    }
    return end;
  }
  // a composed piece's note (notes/sea-song/r3): one string at the written pitch, m in MIDI (A4 = 440 Hz; a fraction is
  // the score's own tuning, e.g. its just fifth), no detune: a pitch is always the same string, plucked again (key) and
  // never two near-unisons. Its octave for small speakers is its own 2nd partial at dbl of the fundamental (one string,
  // a fixed level), not a second string. PIECE_G: about the level of the two strings it replaces (1.25 at round 2's
  // LV.harp, 0.0918)
  const PIECE_G = 1.38;
  function pieceNote(g, m, vel, t, dir, pan, tier, tag, cap, dbl) {
    const bright = 0.2 + 0.25 * clamp((vel - 0.4) / 0.45, 0, 1), amp = LV.harp * PIECE_G * vel, pn = clamp((pan || 0) + 0.12 * dir, -0.4, 0.4);
    FS = g.c.sampleRate;
    return harpString(g, 440 * Math.pow(2, (m - 69) / 12), amp, t, bright, pn, tier, tag, cap, dbl > 0 ? dbl : 0, Math.round(m));
  }
  // a harp step: the arg went from st.phi to phi over dt seconds of the probe, played from t0 on the audio clock (the
  // notes spread over the step as the crossings were). o: {ln, pan, dt, shaky (the D-only zone near a zero or pole,
  // while the pointer moves), h (the band, turns: HARP_H … 1/8), tier, tag, vel, note, dbl, cap}. o.vel (a composed
  // curve's stored dynamics, notes/sea-song): the k-th crossing (st.k) sounds at velocity o.vel[k], in place of the rate
  // rules and the D-only thinning; under 0.02 it is silent (it still counts, and takes no string). o.note (a piece's
  // written notes, MIDI, one per crossing, 0 for a crossing that is not a written note: silent): pieceNote in place of
  // the octave copies; o.dbl its octave string's level. o.cap: the strings kept at once (a number, or one per crossing: a
  // piece's theme keeps one note ringing, its chords four, notes/sea-song/r3). The lines are the harp's own (st.L).
  // Returns the crossings (tests count the Ds)
  function harpStep(st, g, t0, phi, o) {
    if (st.c === null) { st.c = cellL(phi, st.L); st.phi = phi; lapSeat(st, phi); return []; }
    const h = o.h > HARP_H ? Math.min(0.125, o.h) : HARP_H;
    const P0 = st.phi, dt = clamp(o.dt || 0.016, 0.008, 0.1), fired = harpCross(st, P0, phi, h);
    if (st.lap && st.lap.c !== null) lapClose(st, P0, phi, h, fired);
    st.phi = phi;
    if (!fired.length) return fired;
    const rateT = Math.abs(phi - P0) / dt;   // turns per second
    for (const n of fired) {
      const nL = st.L.length, s = st.L[((n.i % nL) + nL) % nL], isD = s === 0, at = t0 + n.u * dt, vk = o.vel ? o.vel[st.k] : undefined, mk = o.note ? o.note[st.k] : undefined, ck = Array.isArray(o.cap) ? o.cap[st.k] : o.cap;
      st.k++;
      while (st.recent.length && st.recent[0] < at - 0.5) st.recent.shift();
      st.recent.push(at);
      // notes per second: over the last 0.5 s, or implied by how fast arg F turns now (5 strings a turn), so the first
      // notes of a sudden run are already lighter; above 24 a second only the Ds sound (the count survives)
      const rate = Math.max(st.recent.length / 0.5, 5 * rateT), dOnly = vk == null && (!!o.shaky || st.recent.length / 0.5 > 24);
      if (isD) { if (n.dir > 0) st.up++; else st.down++; }
      if (!isD && dOnly) continue;
      if ((vk != null && vk < 0.02) || (o.note && !(mk > 0))) continue;
      let vel = 0.55 + 0.3 * clamp(Math.log10(Math.max(rateT, 0.1) / 0.1), 0, 1);
      if (rate > 2.5) vel *= Math.pow(2.5 / rate, 0.6);
      if (rate > 14) vel *= 14 / rate;
      // (review v16 sound-picture-1: a still probe under a changing F, a zero passing beside it, hears its sweep: the
      // fast-run rule is for a hand that sweeps, so here the notes keep at least 0.25, about 12 dB under a normal note,
      // not 30)
      if (o.still) vel = Math.max(vel, 0.25);
      if (vk != null) vel = clamp(vk, 0, 1);
      st.notes++;
      if (g) busy(mk > 0 ? pieceNote(g, mk, vel, at, n.dir, o.pan, o.tier || 'sonify', o.tag, ck, o.dbl) : harpNote(g, s, vel, at, o.ln, n.dir, isD && dOnly, o.pan, o.tier || 'sonify', o.tag, ck));
    }
    return fired;
  }
  // the pointer's harp (Hear the function): phi is the probe's unwrapped arg in turns
  function harp(phi, o = {}) {
    if (!AC || !P.on || hidden || !P.sonify || !canSchedule(false)) { HP.c = null; return null; }
    return harpStep(HP, G, ctx.currentTime + LEAD, phi, o);
  }
  // a loop drawn with the pointer or the keys closed (review math-4): the trigger is brought to the state it had at the
  // loop's first point, shifted by the loop's W whole turns (c = c0 + 5W, five lines), and the lines between are plucked now. Its low
  // Ds counted up minus down are then exactly W wherever the loop began: a start inside a line's band no longer loses
  // (or doubles) that line's D. The caller re-seats on the probe's own arg afterwards (harpReset)
  function harpClose(c, o = {}) {
    if (HP.c === null || !Number.isInteger(c) || c === HP.c) return [];
    if (!AC || !P.on || hidden || !P.sonify || !canSchedule(false)) { HP.c = null; return []; }
    return harpStep(HP, G, ctx.currentTime + LEAD, 0.5 * (thrL(HP.L, c) + thrL(HP.L, c + 1)), Object.assign({ dt: 0.1 }, o));
  }
  // a fresh start, a cut or a swap: re-seat on the colour under the probe, without a note
  function harpReset(phi) { HP.c = phi == null || !Number.isFinite(phi) ? null : cellOf(phi); HP.phi = phi; lapSeat(HP, phi); }
  // a closed curve (listen along): seated as if it had arrived at its start from its own end (shifted by its whole
  // turns), so a curve that starts exactly on a line sounds that line once, at the start, and not again when it closes
  // there: its low Ds are its winding number wherever it starts
  function alongSeat(st, phi, closed, t0) {
    const n = phi.length;
    if (closed && n > 2) { const W = phi[n - 1] - phi[0], p0 = phi[n - 2] - W; st.c = cellL(p0, st.L); harpCross(st, p0, phi[0]); st.phi = phi[0]; }
    else harpStep(st, null, t0, phi[0], {});
  }
  // the crossings listen along would play on these samples (nothing sounds), on the default lines or a piece's own:
  // a stored velocity list must match it
  function alongCount(phi, closed, lines) {
    const st = Harp(lines);
    alongSeat(st, phi, closed, 0);
    let k = 0;
    for (let j = 1; j < phi.length; j++) { k += harpCross(st, st.phi, phi[j]).length; st.phi = phi[j]; }
    return k;
  }
  // "listen along": the harp played along a curve's samples (phi: unwrapped turns, la: ln|F|, uniform in time over dur
  // s), scheduled now on the audio clock, tagged so that stopping it drops what has not sounded. Returns the D count.
  // o: {tag, closed, cuts (tick times, s), pan, lines, vel, note, dbl (a composed curve's own lines, and its velocities
  // and written notes, one per crossing: harpStep; the app passes them only when alongCount agrees), cap (its strings at
  // once: a number or one per crossing), tickDb (its drum: one gain per cut, dB; each tick then a single pluck)}
  function harpAlong(phi, la, dur, o = {}) {
    if (!AC || !P.on || hidden || !P.events || !canSchedule(false)) return null;
    const st = Harp(o.lines), n = phi.length, t0 = ctx.currentTime + Math.max(0.03, LEAD + 0.01), dt = dur / Math.max(1, n - 1);
    alongSeat(st, phi, o.closed, t0);
    for (let j = 1; j < n; j++) harpStep(st, G, t0 + (j - 1) * dt, phi[j], { ln: la[j], pan: o.pan || 0, dt, tier: 'events', tag: o.tag, vel: o.vel, note: o.note, dbl: o.dbl, cap: o.cap });
    const td = o.tickDb && o.cuts && o.tickDb.length === o.cuts.length ? o.tickDb : null;
    (o.cuts || []).forEach((tt, i) => play('cut', Object.assign({ at: Math.max(0.03, LEAD + 0.01) - LEAD + tt, force: true, tier: 'events', tag: o.tag }, td ? { gainDb: td[i], one: true, noRep: true } : {})));
    busy(t0 + dur + 2);
    return { t0, up: st.up, down: st.down, notes: st.notes, now: () => ctx.currentTime };
  }

  // ---------------------------------------------------------------- curves sing (option 4)
  // ph: the unwrapped arg in turns at M points evenly spaced in arc length around a closed curve (the start not
  // repeated at the end), W its winding number. The phase signal e^{2πiφ̃(s)}, played compressed: φ̃(s) = W s +
  // λ (φ(s) − W s − mean), λ the largest ≤ 1 with an RMS deviation ≤ 0.12 turn; its mean slope is still W, so the
  // spectral centre Σ k|b_k|² stays exactly W while the spread shrinks, and W is the strongest harmonic: the note.
  // b_k for k = −8 … 20 → harmonic n = 4 + k of D3 (n ≤ 0 dropped), a Lanczos taper beyond 6 from W. Returns {A, n0}
  function curveAmps(ph, W) {
    const M = ph.length, NH = LIB.NH, re = new Float64Array(M), im = new Float64Array(M), dv = new Float64Array(M);
    let mu = 0; for (let j = 0; j < M; j++) { dv[j] = ph[j] - ph[0] - W * j / M; mu += dv[j]; } mu /= M;
    let e = 0; for (let j = 0; j < M; j++) { dv[j] -= mu; e += dv[j] * dv[j]; }
    const rms = Math.sqrt(e / M), lam = rms > 0.12 ? 0.12 / rms : 1;
    for (let j = 0; j < M; j++) { const p = TAU * (W * j / M + lam * dv[j]); re[j] = Math.cos(p); im[j] = Math.sin(p); }
    const A = new Array(NH).fill(0);
    for (let k = -8; k <= 20; k++) {
      const n = 4 + k; if (n <= 0 || n > NH) continue;
      // Σ x_j e^{−2πi k j / M}, the twiddle by rotation
      const w = -TAU * k / M, cr = Math.cos(w), ci = Math.sin(w);
      let tr = 1, ti = 0, sr = 0, si = 0;
      for (let j = 0; j < M; j++) { sr += re[j] * tr - im[j] * ti; si += re[j] * ti + im[j] * tr; const t = tr * cr - ti * ci; ti = tr * ci + ti * cr; tr = t; }
      let wt = 1; const dd = Math.abs(k - W) - 6; if (dd > 0) { const x = Math.PI * dd / 7; wt = Math.max(0, Math.sin(x) / x); }
      A[n - 1] = Math.hypot(sr, si) / M * wt;
    }
    return { A, n0: 4 + W, lam };
  }
  // a winding number the singer can sing: its harmonic 4 + W of D3 is one of 1 … NH (W = −3 … 20). Outside, curveAmps
  // has no note (only the hum would sound), so the callers play the pings or speak W instead (review sound-2)
  const singable = (W) => Number.isInteger(W) && 4 + W >= 1 && 4 + W <= LIB.NH;
  // low notes lose most of their level on a phone or laptop speaker: +2, +3, +4 dB on harmonics 3, 2, 1
  const LOWMK = [1, Math.pow(10, 4 / 20), Math.pow(10, 3 / 20), Math.pow(10, 2 / 20)];
  const lowMake = (n0) => (n0 >= 1 && n0 <= 3 ? LOWMK[n0] : 1);
  let singOn = false, singOffAt = 0, singTier = '', singSeq = 0;
  // the singer's commands for one note (also the lab's offline renders): the spectrum, its level (the release note 1 dB
  // over the calibrated −32, the live note 1 dB under), a gate on (o.gate: its sequence number, 0 for none) and, for a
  // release, the gate off 1.5 s later
  function singCmds(A, n0, mode, T, tier, o = {}) {
    const rel = mode === 'release', lvl = LV.hv * (rel ? 1.12 : 0.89) * lowMake(n0);
    const cmds = [{ k: 'hv', at: T, amps: A, slew: rel ? (o.sounding ? 0.12 : 0.05) : 0.05, lvl, lt: rel ? 0.3 : 0.03, hum: 0.45, vow: 1, tier: TI[tier], tag: o.tag == null ? null : o.tag }];
    if (o.gate) cmds.push({ k: 'hv', at: T, gate: 1, t1: 0.04, n: o.gate });
    if (rel && o.gate) cmds.push({ k: 'hv', at: T + 1.5, gate: 0, t1: 0.13, n: o.gate, tag: o.tag });
    return cmds;
  }
  // the singer: o.mode 'live' (the deformation: the note follows each new spectrum, slews 50 ms) or 'release' (a loop
  // drawn, a curve listened to: a 0.3 s bloom into the note, hold 1.2 s, then a T60 of 1.2 s); o.tier, o.at (s from
  // now), o.tag. The singer belongs to one tier at a time (it switches only while silent)
  function sing(A, n0, o = {}) {
    const tier = o.tier || 'sonify';
    if (!AC || !P.on || hidden || !P[tier] || !G || !G.synth || !canSchedule(false)) return false;
    const now = ctx.currentTime, T = now + LEAD + (o.at || 0);
    if (singOn && now >= singOffAt && singOffAt > 0) singOn = false;
    const rel = o.mode === 'release';
    // gates carry a sequence number: a release's own gate-off (1.5 s later) is ignored once a newer note has begun
    const gateOn = !singOn || rel || singOffAt > 0;
    G.synth.post(singCmds(A, n0, o.mode, T, tier, { sounding: singOn, gate: gateOn ? ++singSeq : 0, tag: o.tag }));
    singOffAt = rel ? T + 2.8 : 0;
    singOn = true; singTier = tier;
    busy(T + (rel ? 3 : 1));
    return true;
  }
  // the live note fades (τ 50 ms per stage, or 8 ms when fast)
  function singOff(o = {}) {
    if (!singOn || !G || !G.synth || !ctx) { singOn = false; return; }
    if (singOffAt > 0 && !o.force) return;   // a release note ends by itself
    G.synth.post([{ k: 'hv', at: ctx.currentTime + LEAD, gate: 0, t1: o.fast ? 0.008 : 0.05, n: singSeq }]);
    singOn = false; singTier = ''; singOffAt = 0;
  }

  // ---------------------------------------------------------------- the Height voice (the Landscape)
  // an organ tone (harmonics 1–4 at 1/n, so it survives phone speakers) on the Height scale: u = ln|F| / (2π/S), one
  // contour of the drawn lines = one pentatonic step, |F| = 1 on D5, A3 … A6
  const liveVoices = new Set(), Gl = () => G;
  const ORGAN = [1, 1 / 2, 1 / 3, 1 / 4];
  const lnc = (x) => (Number.isFinite(x) ? x : x > 0 ? 50 : -50);
  const HV = { amp: 0.042 };
  function HeightVoice(g, T = 'sonify') {
    const c = g.c, worklet = !!g.worklet && (g.offline || prefer.worklet), be = worklet ? WorkletBackend(g, T, 0.06) : NodeHeight(g, T);
    let dead = false, last = -1, lastWall = 0, loud = 1, on = false, started = false, gEnd = 0;
    const v = {
      engine: worklet ? 'worklet' : 'nodes',
      // glide: at least this long (s) for this move (a function swapped under a still probe), kept to its end
      set(lnAbs, pn = 0, t, sectors = 12, glide = 0) {
        if (dead) return;
        const explicit = t != null; if (!explicit) t = c.currentTime;
        const wall = performance.now();
        const dt = explicit ? (last < 0 ? 0 : clamp(t - last, 0.008, 0.05)) : (last < 0 ? 0 : clamp((wall - lastWall) / 1000, 0.008, 0.05));
        last = t; lastWall = wall;
        const f = hNote(lnc(lnAbs) / (2 * Math.PI / sectors));
        loud = Math.min(1.5, Math.pow(587.33 / f, 0.35));   // a tilt: low notes a little louder (small speakers)
        if (!started) { started = true; be.start(t, Math.log2(f), HV.amp * loud, clamp(pn, -0.3, 0.3), explicit); return; }
        const clk = explicit ? t : wall / 1000;
        if (glide > 0) gEnd = clk + glide;
        be.moveH(t, Math.log2(f), Math.max(dt, 0.008, glide, gEnd - clk), HV.amp * loud, clamp(pn, -0.3, 0.3), explicit);
      },
      gate(gt, t, tau) { if (!dead) { on = !!gt; be.gate(on ? 1 : 0, t, tau != null ? tau : on ? 0.02 : 0.08); } },
      duck: (t, hold) => { if (!dead && hold > 0) be.duck(t, hold); },
      sounding: () => on && !dead,
      silence() { v.gate(false, undefined, 0.01); }, reset() { last = -1; },
      stop(t) { if (dead) return; on = false; be.stop(t); dead = true; liveVoices.delete(v); if (g === Gl()) touchIdle(); },
    };
    liveVoices.add(v);
    return v;
  }
  function outStereo(g, T, wet) {
    const c = g.c, inp = c.createGain();
    inp.connect(g.tier[T].dry);
    if (wet) { const s = c.createGain(); s.gain.value = wet; inp.connect(s); s.connect(g.tier[T].wet); }
    return inp;
  }
  function WorkletBackend(g, T, wet) {
    const c = g.c, o = outStereo(g, T, wet), pend = [];
    let node = null, stopT = null;
    const make = () => {
      node = new AudioWorkletNode(c, 'cmw-voice', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { cmds: pend.splice(0) } });
      node.connect(o);
    };
    const post = (cmd) => { if (node) node.port.postMessage([cmd]); else pend.push(cmd); };
    if (g.offline) g.flush.push(make); else make();
    const now = (t) => (t != null ? t : c.currentTime);
    return {
      start(t, s, amp, pan) { post({ at: t, lf: s, amp, pan }); },
      moveH(t, lf, dur, amp, pan) { post({ at: t, lf, dur, amp, pan }); },
      gate(gt, t, tau) { post({ at: now(t), gate: gt, tau }); },
      duck(t, hold) { post({ at: now(t), duck: hold }); },
      stop(t) { post({ at: now(t), stop: 1, tau: 0.05 }); stopT = now(t); if (!g.offline) setTimeout(() => { try { o.disconnect(); } catch (e) { /* gone */ } }, 800 + Math.max(0, stopT - c.currentTime) * 1000); },
    };
  }
  // the fallback: native nodes with anchored, append-only automation (no AudioWorklet here). A move starts at
  // max(now + LEAD, end), anchored with setValueAtTime(end value) when there is a gap, and is never cancelled
  function Lane(p, v0) { p.value = v0; return { p, end: 0, v: v0 }; }
  function laneTo(Ln, v, T0, T1) {
    if (T0 > Ln.end + 1e-7) Ln.p.setValueAtTime(Ln.v, T0);
    if (T1 > T0 + 1e-7) Ln.p.linearRampToValueAtTime(v, T1); else Ln.p.setValueAtTime(v, T0);
    Ln.end = Math.max(T0, T1); Ln.v = v;
  }
  function laneSet(Ln, v, T) { Ln.p.setValueAtTime(v, T); Ln.end = T; Ln.v = v; }
  const leadOf = (c) => (typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext ? 0 : LEAD);
  // a target curve from wherever the param is, starting no earlier than now + LEAD
  function follow(c, p, v, tau, t = 0) {
    const T = Math.max(t || 0, c.currentTime + leadOf(c));
    p.cancelScheduledValues(T);
    if (tau > 0) p.setTargetAtTime(v, T, tau); else p.setValueAtTime(v, T);
    return T;
  }
  function NodeHeight(g, T) {
    const c = g.c, o = out(g, T, 0, 0.06, 0.3), vg = c.createGain(), dk = c.createGain();
    vg.gain.value = 0; vg.connect(dk); dk.connect(o);
    let stopped = false;
    const os = c.createOscillator(), lg = c.createGain();
    os.setPeriodicWave(c.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, ...ORGAN])));
    os.frequency.value = 440; os.connect(lg); lg.connect(vg); os.start();
    const det = Lane(os.detune, 0), amp = Lane(lg.gain, 0);
    const cents2 = (lf) => 1200 * (lf - Math.log2(440));
    const pan = (pn, t) => { if (o.panner) follow(c, o.panner.pan, pn, 0.03, t); };
    let want = null, timer = 0;
    const be = {
      start(t, lf, a, pn, explicit) { const T0 = explicit ? t : c.currentTime + LEAD; laneSet(det, cents2(lf), T0); laneSet(amp, a, T0); pan(pn, T0); },
      moveH(t, lf, dur, a, pn, explicit) {
        if (explicit) { const T0 = Math.max(t, det.end); laneTo(det, cents2(lf), T0, T0 + dur); laneTo(amp, a, T0, T0 + dur); pan(pn, T0); return; }
        want = { lf, dur, a, pn }; be.pump();
      },
      pump() {
        if (!want) return;
        const now = c.currentTime + LEAD, ahead = det.end - now;
        if (ahead > 0.02) { clearTimeout(timer); timer = setTimeout(be.pump, (ahead - 0.015) * 1000); return; }
        const w = want; want = null; const T0 = Math.max(now, det.end), T1 = Math.max(now + w.dur, T0 + 0.004);
        laneTo(det, cents2(w.lf), T0, T1); laneTo(amp, w.a, T0, T1); pan(w.pn, T0);
      },
      gate(gt, t, tau) { if (!stopped) follow(c, vg.gain, gt, tau, t); },
      duck(t, hold) { const T0 = follow(c, dk.gain, 0.5, 0.01, t); dk.gain.setTargetAtTime(1, T0 + hold, 0.08); },
      stop(t) { clearTimeout(timer); want = null; const T0 = follow(c, vg.gain, 0, 0.05, t); stopped = true; os.stop(T0 + 0.5); },
    };
    return be;
  }
  function heightVoice() {
    if (!P.on || !P.sonify || hidden || !AC) return null;
    if (!canSchedule(false)) return null;
    clearTimeout(idleTimer);
    return HeightVoice(G);
  }

  // Esc, hidden, off: everything stops now, queues are emptied, the voices are gated off; the setting is unchanged.
  // The synth drops what is queued and fades what sounds in 12 ms (raised cosine); the bus dips on a 12 ms raised cosine
  // and comes back on a 30 ms one 50 ms later; every fallback source stops inside the silent window. A hush during a
  // hush joins its silent window, or (in its return) starts a new one after it: value curves never overlap.
  function hush() {
    if (!ctx || !G) return;
    const now = ctx.currentTime + LEAD, at = G.hushAt == null ? -1 : G.hushAt;
    let t = at;
    if (!(now <= at + 0.035)) {
      t = Math.max(now, at + 0.081);
      try { G.bus.gain.setValueCurveAtTime(FADE_DN, t, 0.012); G.bus.gain.setValueCurveAtTime(FADE_UP, t + 0.05, 0.03); }
      catch (e) { t = follow(ctx, G.bus.gain, 0, 0.004); G.bus.gain.setTargetAtTime(1, t + 0.05, 0.015); }
      G.hushAt = t;
    }
    if (G.synth) G.synth.post([{ k: 'clear' }]);
    const off = Math.max(now, t + 0.013);
    for (const s of G.active) { try { s.stop(off); } catch (e) { /* not started */ } }
    // the voices fade now (τ 4 ms, zero slope at the start)
    for (const v of liveVoices) v.gate(false, undefined, 0.004);
    Q.turn.next = Q.contour.next = 0; Q.turn.due.length = Q.contour.due.length = 0;
    HP.c = null; SC.tex = false; motionOn = false; singOn = false; singTier = ''; singOffAt = 0; busyUntil = 0;
  }
  // stop one tagged group (a "listen along"): what has not sounded is dropped, what sounds fades in 12 ms. The fallback's
  // sources fade on their own gain (a 12 ms raised cosine) and stop after it: a stop alone cut a ringing string's wave
  // (review sound-4)
  function stopTag(tag) {
    if (!ctx || !G) return;
    if (G.synth) G.synth.post([{ k: 'clear', tag }]);
    const t = ctx.currentTime + LEAD;
    for (const s of G.active) {
      if (s.tag !== tag) continue;
      try { if (s.out) s.out.gain.setValueCurveAtTime(FADE_DN, t, 0.012); } catch (e) { /* a fade already scheduled */ }
      try { s.stop(t + 0.013); } catch (e) { /* ended */ }
    }
    if (singTier === 'events') { singOn = false; singTier = ''; singOffAt = 0; }
  }

  // ---------------------------------------------------------------- settings
  function set(o, opts = {}) {
    const was = P.on;
    for (const k in o) if (k in DEFAULTS && typeof o[k] === typeof DEFAULTS[k]) P[k] = k === 'vol' ? clamp(o[k], 0, 1) : o[k];
    save();
    if (P.on && !was) { activated = true; lastGesture = performance.now(); ensure(); applyGains(true); if (!opts.quiet) play('toggleOn', { force: true, grace: true }); }
    else if (!P.on && was && ctx) {
      // off is immediate and silent: the icon and aria-pressed confirm it
      hush(); for (const v of [...liveVoices]) v.stop();
      follow(ctx, G.master.gain, 0, 0.003);
      setTimeout(() => { if (!P.on && ctx && ctx.state === 'running') ctx.suspend().then(emit, () => {}); }, 60);
    } else applyGains();
    if (!P.sonify) HP.c = null;
    emit();
  }

  // ---------------------------------------------------------------- the probe's arithmetic (pure; used by app.js)
  // arg F along a path in (z, t) (notes/sound/DEFORMATION.md). Fat(T) is the function at transport time T. The change
  // of arg of u ↦ Fat(T0 + u (T1 − T0))(z0 + u (z1 − z0)), u ∈ [0, 1], tracked exactly by argStep (Calc.argStep).
  function pathStep(argStep, Fat, z0, T0, g0, z1, T1, g1, opts) {
    const dx = z1.re - z0.re, dy = z1.im - z0.im, dT = T1 - T0;
    const Pf = (u) => { const s = u.re; return Fat(T0 + s * dT)({ re: z0.re + s * dx, im: z0.im + s * dy }); };
    return argStep(Pf, { re: 0, im: 0 }, g0, { re: 1, im: 0 }, g1, opts);
  }
  // the turns of a loop or a run {phi, k}: one call of ring(dir) per completed turn; a turn back must first come back to
  // the previous integer, so a wobble at a turn counts once (a turn that ends on the integer up to rounding counts)
  function turns(Ln, ring) {
    let n = 0;
    while (Ln.phi >= Ln.k + 1 - 1e-9) { Ln.k++; n++; if (ring) ring(1); }
    while (Ln.phi <= Ln.k - 1 + 1e-9) { Ln.k--; n--; if (ring) ring(-1); }
    return n;
  }

  // offline rendering, for tests (no output device, no activation needed). opts.nodes: the main-thread fallback
  async function render(fn, dur, opts = {}) {
    const rate = opts.rate || 48000, c = new OfflineAudioContext(2, Math.ceil(dur * rate), rate), g = graph(c, opts.vol != null ? opts.vol : 1, { allOn: true, noClip: opts.noClip });
    g.offline = true; g.worklet = !opts.nodes && await loadWorklet(c); g.engine = g.worklet ? 'worklet' : 'nodes';
    if (g.worklet) g.synth = makeSynth(g);
    fn(g, 0.01, c);
    for (const f of g.flush) f();
    return c.startRendering();
  }

  return {
    play, turn: (o = {}) => queued('turn', o), tick: (o = {}) => queued('contour', o), hush, stopTag,
    scrub, scrubEnd, scrubState: () => ({ v: SC.v, tex: SC.tex }), motion, motionEnd,
    harp, harpReset, harpClose, harpAlong, harpState: () => ({ up: HP.up, down: HP.down, notes: HP.notes, c: HP.c }), harpCount: () => { const r = { up: HP.up, down: HP.down, notes: HP.notes }; HP.up = HP.down = HP.notes = 0; return r; },
    harpStep, harpNote, pieceNote, Harp, cellOf, alongCount, curveAmps, singable, sing, singCmds, singOff, singState: () => ({ on: singOn, tier: singTier }),
    set, toggle: () => set({ on: !P.on }), prefs: () => ({ ...P }), state, subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    heightVoice, render, graph, cueTo, CATALOG, TRIM, MAT, LV, HV, HeightVoice, hNote, loadWorklet, prefer, lead: () => LEAD, pathStep, turns, LIB, WORKLET_SRC,
    seed: (n) => { seedBase = n >>> 0; cueN = 0; }, cueHook: (f) => { cueHook = f || null; },
    stat: () => (G && G.synth ? G.synth.stat() : Promise.resolve(null)),
    debug: () => ({ ctx, G, live: liveVoices.size, activated, active: G ? G.active.size : 0, synth: !!(G && G.synth), queue: ctx ? { turn: Math.max(0, Q.turn.next - ctx.currentTime), contour: Math.max(0, Q.contour.next - ctx.currentTime) } : null }),
  };
})();
// the sound popover (page.html #sndPop) sits outside #app, which the app's walker translates: in another interface
// language its static strings are translated here, once, at load (src/i18n.js; English: nothing runs)
if (typeof document !== 'undefined' && typeof I18N !== 'undefined' && I18N.lang !== 'en') { const pop = document.getElementById('sndPop'); if (pop) I18N.applyStatic(pop); }
