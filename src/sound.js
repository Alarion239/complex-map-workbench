'use strict';
// Sound for Complex Map Workbench (v15.2: notes/sound/AS-BUILT-v152.md). The app's hooks live in app.js (the "sound"
// block); the controls in page.html (#soundCtl, #sndPop).
// =====================================================================================================================
// What the sounds are made of: palette B (notes/sound/v2/DESIGN.md, board.html with board-fixes.md), the user's choice
// ("I like everything except for hearing the function"): every cue is a list of small struck, plucked, blown or bowed
// parts (wood, kalimba tine, woodblock, felt, glass, a metal bar), each play a new strike (a PRNG per play: level, mallet,
// decay, a few cents of pitch where pitch carries no meaning), softer when repeated, harder when the gesture was fast.
// Hearing the function: Sound.hear and Sound.along (the final design, below); and
//   * curves sing: a closed curve's phase signal e^{2πiφ(s)} played as one sung note whose harmonic 4 + W of D3 is its
//     winding number W (D5 for 0, F♯5 for 1, A5 for 2, A4 for −1, …).
// The engine: one AudioWorklet node ("cmw-synth") renders every one-shot part, the scrub and motion texture, the
// composition's harp strings (12 at most; the oldest fades in 30 ms) and the singer, sample by sample: the main thread posts
// parameters only, every part starts and ends at exactly 0 (raised cosines), a late message adds latency, never a step.
// No AudioParam automation for any of them.
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
//   sonify  Hear the function under the pointer (opt-in): Sound.hear, the loop's note while the deformation plays, and
//           every cue driven by pointer position (branch cut, zero/pole order, contour, preimages collide)
// API: Sound.play(name, {pan, order, k, q, w, vel, at, force, tier, tag}) · Sound.turn(o) · Sound.tick(o) (queued,
//      count-bearing) · Sound.harpAlong(phi, la, dur, o) · Sound.alongCount(phi, closed, lines) (Play the composition) ·
//      Sound.sing(A, n0, o) · Sound.singOff(o) · Sound.curveAmps(ph, W) · Sound.scrub(u0, u1) · Sound.scrubEnd() ·
//      Sound.motion(u, rate) · Sound.motionEnd() · Sound.hush() (Esc) · Sound.stopTag(tag) ·
//      Sound.set({on, vol, ui, snap, events, sonify}) · Sound.toggle() · Sound.prefs() · Sound.subscribe(fn) ·
//      Sound.state() · Sound.render(fn, dur) (offline) · Sound.cueTo(G, name, t, o) · Sound.CATALOG ·
//      Sound.pathStep(argStep, Fat, z0, T0, g0, z1, T1, g1, opts) · Sound.turns(L, ring) (the probe's arithmetic)
// Hear the function, the final design (the user's: "i want to hear the function, not actively just make music fit the
// math"; perfwin/sound/polish/FINAL.md, the prototype compare.js final-notes and final-glide): everything audible is
// caused by F through the fixed map in HT_LIB (below), plus declared timbre choices and declared safety limits (the
// crowding gain, the merge and strum caps, the repeat gap, the crack gap, the limiter on the bus).
//      Sound.hear.{seat, step, cut, pathless, gap, cue, query, end, state, active, log} (the live stream, sonify tier;
//      samples {t, phi, ln, pan, n, src}) · Sound.along(smp, {tag, n, closed}) (Listen along: the function along a
//      curve, events tier) · Sound.HT (the pure core: constants, law, crowd, copies, events, glideCtl, gate, Live,
//      throughZP) · Sound.set({glide}) (Notes or the continuous Glide; the Glide needs the worklet engine).
//      harpAlong with a score plays the composition (the old pointer harp and the Height voice are gone).
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

  // ---------------------------------------------------------------- Hear the function: the Glide (spec 3.10)
  // One continuous voice of 7 octave copies, pitch class = arg F (φ in turns, unwrapped; one octave per turn), rendered
  // in the synth processor. Controls {k: 'gl', at, phi, mode, a, b, pan, until, rel, fade, tier, tag} from the main
  // thread: mode 'slew' (linear from the last post to this one, then the 5 ms one-pole), 'step' (φ steps at `at`),
  // 'cut' / 'seat' (φ and φ̃ jump; a 'seat' with fade while the voice rings: a 25 ms raised-cosine fade with f, pan
  // and b held, 25 ms of silence, then a fresh attack), 'stop' (a 12 ms fade, then silent). a: the level
  // (LV.glide·10^((dbV3 + GL4.db)/20)); b: brightness; until: the gate (the env attacks with τ 20 ms while the clock
  // is before it, else decays with T60 0.8 s or rel). Per copy: w_j = exp(−d²/2), d = (log2 f_j − log2 440)/0.45,
  // GN = sqrt(0.45·√π / Σ exp(−d_j²)) (unit summed power), a 12 ms one-pole on the amplitude, harmonics h ≤ 24 below
  // 0.45 fs at h^−(3 − 2.5b) (the Chebyshev recurrence), an equal-power pan through 30 ms. Never ducked
  function Glide(fs) {
    const kPh = 1 - Math.exp(-1 / (0.005 * fs)), kA = 1 - Math.exp(-1 / (0.02 * fs)), kAmp = 1 - Math.exp(-1 / (0.012 * fs)), kPan = 1 - Math.exp(-1 / (0.03 * fs));
    const LD2 = Math.log2(73.4162), LA4 = Math.log2(440), SIG = 0.45, NS = 0.45 * Math.sqrt(Math.PI), seatN = Math.round(0.025 * fs), stopN = Math.round(0.012 * fs);
    const P2 = [1, 2, 4, 8, 16, 32, 64], A = new Float64Array(7), W7 = new Float64Array(7), TH = new Float64Array(7), WH = new Float64Array(25), NR = new Float64Array(7), HJ = new Float64Array(7), HOLD = new Float64Array(7);
    const g = { q: [], cur: null, pend: null, ph: 0, env: 0, panS: 0, gn: 1, wN: -2, tier: 2, tag: undefined, untilF: -1, kd: Math.exp(-6.9078 / (0.8 * fs)), blk: 0, stop: -1, bLast: -1, bS: 0, live: false };
    function take(c) { g.cur = c; g.untilF = Math.round((c.until || 0) * fs); g.kd = Math.exp(-6.9078 / ((c.rel || 0.8) * fs)); if (c.tier != null) g.tier = c.tier; g.tag = c.tag; }
    function apply(c) {
      // (stop: what sounds fades; a control arriving during the fade waits for its end, then starts afresh. A tagged
      // stop or close is for its own group only: the live stream's never reach a Listen along's Glide, nor its theirs)
      if ((c.mode === 'stop' || c.mode === 'close') && c.tag != null && g.tag != null && c.tag !== g.tag) return;
      if (c.mode === 'stop') { if (g.live && g.stop < 0) g.stop = 0; return; }
      if (g.stop >= 0) { g.after = c; return; }
      if (c.mode === 'close') { g.untilF = Math.round((c.until || 0) * fs); return; }   // the gate closes; φ, level, pan held
      g.stop = -1;
      if (c.mode === 'seat' && c.fade && g.live && g.cur && g.env > 1e-4 && !g.blk) { g.blk = 2 * seatN; HOLD.set(A); take(c); g.pend = c; return; }
      if (g.blk) { take(c); return; }
      if (!g.live || !g.cur || c.mode === 'cut' || c.mode === 'seat') g.ph = c.phi;
      if (!g.live) { g.panS = c.pan || 0; g.bS = c.b || 0; g.bLast = -1; }
      g.live = true;
      take(c);
    }
    return {
      cmd(c, f) { c.f = f; let i = g.q.length; while (i > 0 && g.q[i - 1].f > c.f) i--; g.q.splice(i, 0, c); },
      // (a tag's clear drops that tag's queued controls even while another group sounds; it fades the voice only when
      // the voice is that tag's)
      clear(tag) {
        if (tag != null) { g.q = g.q.filter((c) => c.tag !== tag); if (g.after && g.after.tag === tag) g.after = null; if (g.tag !== tag) return; } else { g.q = []; g.after = null; }
        if (g.live && g.stop < 0) g.stop = 0;
      },
      on: () => g.live || g.q.length > 0,
      env: () => g.env,
      run(outs, f0, n, wet) {
        if (!g.live && !(g.q.length && g.q[0].f < f0 + n)) return false;
        let any = false;
        for (let j = 0; j < n; j++) {
          const x = f0 + j;
          while (g.q.length && g.q[0].f <= x) apply(g.q.shift());
          if (!g.live || !g.cur) continue;
          const c = g.cur;
          let mul = 1;
          if (g.blk) {   // a seat while ringing: the fade (f, pan, b held), then silence, then the new place from env 0
            const k = 2 * seatN - g.blk;
            mul = k < seatN ? 0.5 * (1 + Math.cos(Math.PI * (k + 1) / seatN)) : 0;
            if (--g.blk === 0) { g.ph = (g.pend || c).phi; g.env = 0; g.pend = null; g.panS = c.pan || 0; g.bS = c.b || 0; }
          } else {
            const nx = g.q.length ? g.q[0] : null;
            const pt = nx && nx.mode === 'slew' && nx.f > c.f && c.mode !== 'close' ? c.phi + (nx.phi - c.phi) * (x - c.f) / (nx.f - c.f) : c.phi;
            g.ph += (pt - g.ph) * kPh;
            g.env = x < g.untilF ? g.env + (1 - g.env) * kA : g.env * g.kd;
            g.panS += ((c.pan || 0) - g.panS) * kPan;
            g.bS += ((c.b || 0) - g.bS) * kPh;
          }
          // the harmonic weights at the brightness b̃ (b smoothed over 5 ms, as φ̃: a control's b at once was a step in
          // the waveform's harmonics, a click at fast changes of |F|), each copy's highest harmonic below 0.45 fs: once a
          // block, or when b̃ moved 0.002 (the 24th harmonic by under 2 %). A seat's fade holds b̃ with the pitch and pan
          // (compare.js [A14]: f, p, b held)
          const bNow = g.bS;
          if (j === 0 || Math.abs(bNow - g.bLast) > 0.002) {
            g.bLast = bNow; const p = 3 - 2.5 * Math.max(0, Math.min(1, bNow || 0));
            for (let h = 1; h <= 24; h++) WH[h] = Math.pow(h, -p);
            for (let k = 0; k < 7; k++) { const fj = Math.pow(2, LD2 + ((((g.ph + k) % 7) + 7) % 7)); let H = 0, s = 0; while (H < 24 && (H + 1) * fj < 0.45 * fs) { H++; s += WH[H]; } HJ[k] = H; NR[k] = s > 0 ? 1 / s : 0; }
          }
          if (g.stop >= 0) { mul *= g.stop >= stopN ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * g.stop / stopN); g.stop++; }
          // the copies' frequencies (one pow: f_k = D2·2^frac(φ̃)·2^((⌊φ̃⌋ + k) mod 7)) every sample; their weights and
          // the unit-power gain every 16 samples (φ̃ moves little in 0.33 ms; the amplitude is smoothed over 12 ms)
          const fl = Math.floor(g.ph), base = 73.4162 * Math.pow(2, g.ph - fl) / fs;
          if ((j & 15) === 0 || g.wN !== x - 1) {
            let qs = 0;
            for (let k = 0; k < 7; k++) { const lf = LD2 + ((((g.ph + k) % 7) + 7) % 7), d = (lf - LA4) / SIG, w = Math.exp(-0.5 * d * d); W7[k] = w; qs += w * w; }
            g.gn = Math.sqrt(NS / qs);
          }
          g.wN = x;
          const lvl = (c.a || 0) * g.gn * g.env;
          let y = 0, peak = 0;
          // (a seat's fade is the raised cosine itself, from the held amplitudes to exactly 0, then exactly 0: smoothed
          // over 12 ms it still sounded 2-3 % at the end of the silence, where pitch, pan and brightness move to the new
          // place, a click)
          for (let k = 0; k < 7; k++) { const tgt = g.blk ? HOLD[k] * mul : W7[k] * lvl * mul; A[k] = g.blk ? tgt : A[k] + (tgt - A[k]) * kAmp; if (A[k] > peak) peak = A[k]; }
          const floorA = 1e-5 * peak;
          for (let k = 0; k < 7; k++) {
            TH[k] += base * P2[(((fl + k) % 7) + 7) % 7]; TH[k] -= Math.floor(TH[k]);
            if (A[k] <= floorA || A[k] < 1e-9 || !HJ[k]) continue;
            const th = 2 * Math.PI * TH[k], s1 = Math.sin(th);
            let acc = WH[1] * s1;
            // (a copy under 1e-3 of the loudest, −60 dB, sounds its fundamental only: its harmonics are under −80 dB)
            if (A[k] >= 1e3 * floorA) { const c2 = 2 * Math.cos(th); let sm = 0, sp = s1; for (let h = 2; h <= HJ[k]; h++) { const sn = c2 * sp - sm; sm = sp; sp = sn; acc += WH[h] * sn; } }
            y += A[k] * acc * NR[k];
          }
          const th = (Math.max(-0.4, Math.min(0.4, g.panS)) + 1) * Math.PI / 4, gl = Math.cos(th), gr = Math.sin(th);
          const D = outs[2 * g.tier], Wt = outs[2 * g.tier + 1];
          if (D && D[0]) { D[0][j] += y * gl; if (D[1] && D[1] !== D[0]) D[1][j] += y * gr; }
          if (Wt && Wt[0]) { Wt[0][j] += y * gl * wet; if (Wt[1] && Wt[1] !== Wt[0]) Wt[1][j] += y * gr * wet; }
          any = true;
          // silent and closed: idle (no work until the next control)
          if (g.stop >= stopN || (peak < 1e-8 && g.env < 1e-7 && !g.blk && x >= g.untilF && !g.q.length)) { g.live = false; g.cur = null; g.stop = -1; A.fill(0); g.env = 0; if (g.after) { const a = g.after; g.after = null; apply(a); } }
        }
        return any;
      },
    };
  }
  // ---------------------------------------------------------------- the declared safety limiter (spec 3.0, 5.2)
  // Limiter(fs, ceil): a peak limiter on the bus (every tier and the room's return, before the master volume): ceiling
  // ceil (linear, at its input), 2 ms look-ahead (la samples of delay), the gain the running mean over la + 1 samples
  // of the window minimum of the needed gain, a 150 ms release. process(L, R, n) in place; st: {acted, n, minG, la}.
  // The prototype's limiter() streamed: the same gains, la samples later
  function Limiter(fs, ceil) {
    const la = Math.max(1, Math.round(0.002 * fs)), W = la + 1, Q = W + 1, rel = Math.exp(-1 / (0.15 * fs));
    const dL = new Float32Array(W), dR = new Float32Array(W), mr = new Float64Array(W).fill(1), qi = new Float64Array(Q), qv = new Float64Array(Q);
    let i = 0, acc = W, g = 1, h = 0, t = 0;
    const st = { acted: 0, n: 0, minG: 1, la };
    return {
      st,
      process(L, R, n) {
        for (let j = 0; j < n; j++, i++) {
          const xl = L[j], xr = R ? R[j] : xl, p = Math.max(Math.abs(xl), Math.abs(xr)), need = p > ceil ? ceil / p : 1;
          while (t > h && qv[(t - 1) % Q] >= need) t--;
          qi[t % Q] = i; qv[t % Q] = need; t++;
          while (qi[h % Q] <= i - W) h++;
          const m = qv[h % Q], k = i % W;
          acc += m - mr[k]; mr[k] = m;
          const a = acc / W;
          g = a < g ? a : a + (g - a) * rel;
          const r = (i + 1) % W, ol = dL[r], or = dR[r];
          dL[k] = xl; dR[k] = xr;
          L[j] = ol * g; if (R) R[j] = or * g;
          st.n++; if (g < 0.999) st.acted++; if (g < st.minG) st.minG = g;
        }
      },
    };
  }
  return { sin1, prng, rc, Mode, Noise, Air, Bow, MAKE, partEnd, Tex, Singer, NH, F0, Glide, Limiter };
}

// ---------------------------------------------------------------- Hear the function: the pure core (HT_LIB)
// The fixed map from F to sound (perfwin/sound/polish/FINAL.md, the prototype compare.js `final-notes` and
// `final-glide`; the spec HEAR-THE-FUNCTION-SPEC.md 3.0-3.12). Main thread only, never stringified into the worklet:
// no audio here, only decisions. Every constant is HT's; the reasons are FINAL.md's (ids in brackets).
//   * a marimba note each time arg F crosses one of the n drawn colour lines (k/n turns, Schmitt band HB): pitch class
//     12k/n semitones above D, octave copies under a fixed Gaussian on A4; loudness dbV3(ln|F|); each note at the
//     crowding gain so that a stream's power follows |F|, not its event rate (R0); crossings faster than 1/minIoi merge
//     into one onset, bunched ones are spread minIoi apart (a strum, at most one pointer step + minIoi late);
//   * while the colour holds (no line for RE_QUIET), |F| crossing a band edge (ln|F| = 2πk/n) repeats the held note
//     at the new loudness: at most one per repGap (a blocked one deferred), dropped inside an order cue's figure or
//     when a colour line follows within graceGap; on one leg the level never steps back by more than repMono;
//   * a branch cut: a crack (at most one per cutGap, at the R0 rule), then two short notes, the colours either side;
//   * the Glide: one continuous voice of 7 octave copies, pitch class = arg F, level and brightness from dbV3, a gate
//     with hysteresis from the motion of log F.
// Deterministic: no randomness here; the renderer seeds every strike from (pitch class, copy).
function HT_LIB() {
  const TAU = 2 * Math.PI, clamp = (x, a, b) => Math.max(a, Math.min(b, x)), mod = (x, m) => ((x % m) + m) % m;
  const fz = Object.freeze;
  // the Glide (GL4 in compare.js): σ of its Gaussian (octaves), its level under a note (dB), attack (s, 3τ), T60 (s),
  // the gate's windows (s) and hold fraction of a JND, the φ one-pole (s), the prototype's tail, the seat fade + hold
  // (s); rel: the T60 of a keyboard stroke (spec 3.15)
  const GL4 = fz({ sigma: 0.45, db: -2.5, att: 0.06, t60: 0.8, on: 0.25, hold: 0.25, holdJnd: 0.4, phSmooth: 0.005, tail: 1.2, seatFade: fz([0.025, 0.025]), rel: 0.2 });
  // the levels, from the prototype's calibration (report.json; spec 3.0): LV.note = CAL.M2 (a marimba E at |F| = 1
  // alone is 2 dB under today's harp E), LV.crack = 1.6·CAL.T1up, LV.glide = CAL.V3, LV.query = CAL.Q1
  const LV = fz({ note: 0.15205475297324958, crack: 0.24638824416951874, glide: 0.03565506682311055, query: 0.06621707675973322 });
  const HT = fz({
    n: 12, rope: 3, ropeTouch: 5, HB: 1 / 96, D2: 73.4162, A4: 440, sigma: 0.55, fMax: 2600, wMin: 0.0316,
    rateHalf: 0.1, minIoi: 0.005, lateMin: 0.045, keyGap: 0.1, holdMax: 0.1, RE_QUIET: 0.25, repGap: 0.125, repMono: 0.5,
    cueWin: fz([0, 0.15]), graceGap: 0.03, cutGap: 0.125, cutDb: 3, cutHold: 0.082, cutNotes: fz([0.012, 0.082]),
    glCrackDb: -3, glCueDb: -3, cueZeroDb: -6, cuePoleDb: 0, orderGap: 0.25, maxOrder: 8, R0: 5, lineTol: 1e-9,
    PAN: 0.3, PAN_MAX: 0.4, short: 0.15, t60: 0.45, t60Exp: -0.6, vel: 0.6, softA: 2.6, softB: 1.2,
    wet: fz({ note: 0.16, crack: 0.04, glide: 0.14, query: 0.12 }), crackHz: 3100, active: 0.9,
    pathless: fz({ dphi: 0.25 }), GL4, LV,
    // a slow finger's crossing waits this long (ms) to be confirmed (the hooks' sndHold; a provisional rule, #266)
    confirmMs: 80,
  });
  // the loudness law dbV3 (dB against |F| = 1): −8 dB at zeros, +4 dB at poles, 1.91 dB per neper at |F| = 1
  const law = (ln) => (!Number.isFinite(ln) ? (ln > 0 ? 4 : -8) : ln < 0 ? 8 * Math.tanh(ln / (8 / (12 / TAU))) : 4 * Math.tanh(ln / (4 / (12 / TAU))));
  // the crowding gain: each event at power min(1, R0/rate), so a stream's power stays that of R0 events a second
  const crowd = (r) => 10 * Math.log10(Math.min(1, HT.R0 / Math.max(r, 1e-9)));
  // a note's gain at a crossing rate r: the R0 rule, and a merged burst's onset at the burst's power [A2]
  const noteGain = (r) => crowd(r) + 10 * Math.log10(Math.max(1, r * HT.minIoi));
  // the octave copies of pitch class c (semitones above D) under the fixed Gaussian on A4 (σ 0.55 octave), copies under
  // −30 dB dropped, unit power
  function copies(c) {
    const out = [];
    for (let k = 0; k < 7; k++) { const f = HT.D2 * Math.pow(2, c / 12 + k); if (f > HT.fMax) break; const d = Math.log2(f / HT.A4) / HT.sigma, w = Math.exp(-0.5 * d * d); if (w >= HT.wMin) out.push({ f, w }); }
    const s = 1 / Math.sqrt(out.reduce((a, o) => a + o.w * o.w, 0));
    for (const o of out) o.w *= s;
    return out;
  }
  const seed = (a, b) => (0x51ed + 977 * a + 31 * b) >>> 0;
  // the mallet's softness and the brightness of the Glide, both from the same dbV3 number
  const soft = (db) => HT.softA - HT.softB * clamp((db + 12) / 18, 0, 1);
  const bright = (db) => 0.1 + 0.2 * clamp((db + 12) / 18, 0, 1);
  const glideAmp = (ln) => LV.glide * Math.pow(10, (law(ln) + GL4.db) / 20);
  // a figure of an order cue: m pings or thumps from t (0.15 s apart for m ≥ 3, else 0.11 zero / 0.12 pole), plus
  // cueWin[1] after its last one [B5]
  const figure = (o) => [o.t - HT.cueWin[0], o.t + (Math.max(1, o.m) - 1) * (o.m >= 3 ? 0.15 : o.zero ? 0.11 : 0.12) + HT.cueWin[1]];
  // the shared 'zp' gap of the order cues [A8], as play() keeps it
  function cueGap(cues) { let last = -1e9; return (cues || []).filter((o) => { if (o.t - last < HT.orderGap) return false; last = o.t; return true; }); }

  // ---------------------------------------------------------------- crossings (compare.js crossings())
  // smp: [{t, phi (turns, tracked exactly), ln, pan, gap?, seat?, cut?}]; smp.onLine or o.onLine [B10]. The lines of
  // arg F (k/n turns) and of ln|F| (2πk/n nepers), each with a Schmitt band HB; t, ln and pan interpolated in the step.
  // A cut or a seat crosses nothing; a cut is its own event. st (Live): the running cells, carried across calls
  function crossStep(st, q, p, N, OL, ev, HB = HT.HB) {
    const mu = p.ln / TAU;
    if (st.ca === null || p.cut || p.seat || !q) {
      if (p.cut && q) ev.push({ kind: 'cut', t: p.t, phi0: q.phi, ln0: q.ln, phi1: p.phi, ln1: p.ln, pan: p.pan, dir: 0 });
      st.ca = Math.floor(p.phi * N); st.cm = Math.floor(mu * N); st.onA = st.onM = null;
      if (OL) { const ka = Math.round(p.phi * N), km = Math.round(mu * N); if (Math.abs(p.phi * N - ka) <= HT.lineTol) { st.ca = ka; st.onA = ka; } if (Math.abs(mu * N - km) <= HT.lineTol) { st.cm = km; st.onM = km; } }
      return;
    }
    // [V2] a stroke seated on a line that leaves it upward past the band has left it
    if (OL) { if (st.onA !== null && p.phi > st.onA / N + HB) st.onA = null; if (st.onM !== null && mu > st.onM / N + HB) st.onM = null; }
    const at = (x0, x1, th) => (x1 === x0 ? 1 : clamp((th - x0) / (x1 - x0), 0, 1));
    const qp = q.pan || 0, pp = p.pan || 0;
    const push = (kind, u, line, dir, ln) => ev.push({ kind, t: q.t + u * (p.t - q.t), line, dir, ln, pan: qp + u * (pp - qp) });
    while (p.phi > (st.ca + 1) / N + HB) { st.ca++; st.onA = null; const u = at(q.phi, p.phi, st.ca / N); push('arg', u, st.ca, 1, q.ln + u * (p.ln - q.ln)); }
    while (p.phi < st.ca / N - HB) { if (st.ca === st.onA) { st.ca--; st.onA = null; continue; } const u = at(q.phi, p.phi, st.ca / N); push('arg', u, st.ca, -1, q.ln + u * (p.ln - q.ln)); st.ca--; }
    const mq = q.ln / TAU;
    while (mu > (st.cm + 1) / N + HB) { st.cm++; st.onM = null; push('mod', at(mq, mu, st.cm / N), st.cm, 1, st.cm * TAU / N); }
    while (mu < st.cm / N - HB) { if (st.cm === st.onM) { st.cm--; st.onM = null; continue; } push('mod', at(mq, mu, st.cm / N), st.cm, -1, st.cm * TAU / N); st.cm--; }
  }
  function crossings(smp, N = HT.n, onLine) {
    const ev = [], OL = onLine != null ? !!onLine : !!smp.onLine, st = { ca: null, cm: null, onA: null, onM: null };
    let q = null;
    for (const p of smp) {
      if (p.gap) { st.ca = st.cm = null; q = null; continue; }
      crossStep(st, q, p, N, OL, ev);
      q = p;
    }
    return ev.sort((a, b) => a.t - b.t);
  }

  // ---------------------------------------------------------------- the decisions (compare.js finalNotes 521-630)
  // One decider for the batch (events) and the live stream (Live): E gives what the decisions read about the stream,
  // by time: rate(t, key, k, before) (events a second of that line family, ±rateHalf; before: just before t, for a cut),
  // stroke(t) (its stroke id), hold(t) (the hand's step gap, the strum's span), phiAt(t), at(t) ({gap, stroke, pan}
  // at a deferred repeat's due time) and argSoon(t) (a colour line within graceGap after t). out(entry) gets every
  // decided event in the prototype's LOG shape (t, at = t0 + t, k, c, db, g, ln, ...) plus pan (and short).
  function Decider(o) {
    const N = o.n || HT.n, t0 = o.t0 || 0, E = o.env, out = o.out, figs = cueGap(o.cues).map(figure);
    const S = { last: null, lastRep: null, lastNote: -1e9, pend: null, lastCut: -1e9, mono: null };
    const C = { lines: 0, notes: 0, merged: 0, late: 0, reps: 0, deferred: 0, repCue: 0, repGrace: 0, cracks: 0, cutMerged: 0, dUp: 0, dDown: 0, crowdDbMin: 0 };
    const inCue = (t) => figs.some(([a, b]) => t >= a && t <= b);
    const play = (tt, c, db, pan, g, short, k, extra) => out(Object.assign({ t: tt, at: t0 + tt, k, c, db, g, pan }, short ? { short: true } : null, extra));
    // [A3] a repeat crowded by the rate actually played (≤ 1/repGap: floor −2.04 dB); [B6] repMono on its leg
    const repeat = (t, line, ln, pan, er, extra) => {
      let g = crowd(Math.min(er, 1 / HT.repGap));
      if (HT.repMono && extra.dir) {
        const sk = E.stroke(t), L0 = law(ln) + g, lt = S.last ? S.last.t : -1e9, m = S.mono;
        if (m && m.stroke === sk && m.dir === extra.dir && m.after === lt) { const cap = HT.repMono, L1 = extra.dir > 0 ? Math.max(L0, Math.min(m.lvl, L0 + cap)) : Math.min(L0, Math.max(m.lvl, L0 - cap)); if (L1 !== L0) { extra.mono = +(L1 - L0).toFixed(3); g = L1 - law(ln); } m.lvl = L1; }
        else S.mono = { stroke: sk, dir: extra.dir, lvl: L0, after: lt };
      }
      C.crowdDbMin = Math.min(C.crowdDbMin, +g.toFixed(1)); C.reps++;
      play(t, 12 * mod(line, N) / N, law(ln), pan, g, false, 'rep', Object.assign({ ln, er }, extra));
    };
    // [A4] a repeat the gap blocked plays at the end of the gap, if the hand is still in that stroke and no colour line
    // or cut came first
    const flush = (tt) => {
      if (!S.pend || S.pend.due > tt) return;
      const p = S.pend; S.pend = null;
      const a = E.at(p.due);
      if (!a || a.gap || a.stroke !== p.stroke) return;
      if (inCue(p.due)) { C.repCue++; out({ t: p.due, at: t0 + p.due, k: 'rep-cue', defer: 1 }); return; }
      if (HT.graceGap && E.argSoon(p.due)) { C.repGrace++; out({ t: p.due, at: t0 + p.due, k: 'rep-grace', defer: 1 }); return; }
      C.deferred++; S.lastRep = { t: p.due, stroke: p.stroke };
      repeat(p.due, p.line, p.ln, a.pan, p.er, { defer: 1, dir: p.dir });
    };
    function arg(e) {
      const k = mod(e.line, N), at = t0 + e.t; C.lines++;
      if (k === 0) { if (e.dir > 0) C.dUp++; else C.dDown++; }
      S.last = { line: e.line, t: e.t, stroke: E.stroke(e.t) }; S.pend = null;
      const r = E.rate(e.t, 'phi', 1), merge = r * HT.minIoi > 1 && e.t - S.lastNote < HT.minIoi;
      if (merge) { C.merged++; out({ t: e.t, at, k: 'merged', c: 12 * k / N }); return; }
      const g = noteGain(r);
      C.crowdDbMin = Math.min(C.crowdDbMin, +g.toFixed(1));
      const tn = Math.max(e.t, S.lastNote + HT.minIoi);   // [A2b] a strum, minIoi apart
      // [B14] at most one pointer step (≤ holdMax) + minIoi late, never more than lateMin on a sampled pointer
      if (tn - e.t > Math.max(HT.lateMin, Math.min(HT.holdMax, E.hold(e.t)) + HT.minIoi)) { C.merged++; C.late++; out({ t: e.t, at, k: 'merged', c: 12 * k / N, late: 1 }); return; }
      C.notes++;
      play(tn, 12 * k / N, law(e.ln), e.pan, g, false, 'note', { ln: e.ln, dir: e.dir, rate: r, late: +(tn - e.t).toFixed(6) });
      S.lastNote = tn;
    }
    function cut(e) {
      const at = t0 + e.t;
      // [V4] a crack at most once per cutGap; one inside it plays nothing (the held line still follows the jump)
      if (HT.cutGap && e.t - S.lastCut < HT.cutGap) { C.cutMerged++; out({ t: e.t, at, k: 'cut-merged' }); S.last = { line: Math.floor(e.phi1 * N + HT.lineTol), t: e.t + HT.cutHold, stroke: E.stroke(e.t) }; S.pend = null; return; }
      const cutG = crowd(1 / Math.max(1e-6, e.t - S.lastCut)); S.lastCut = e.t;
      C.cracks++; out({ t: e.t, at, k: 'crack', g: cutG, pan: e.pan });
      S.last = { line: Math.floor(e.phi1 * N + HT.lineTol), t: e.t + HT.cutHold, stroke: E.stroke(e.t) }; S.pend = null;   // [A5] [V1]
      // [A6] the two notes at the stream's crowding gain (the slower side) + cutDb, + the crack's own R0 gain
      const cg = HT.cutDb + cutG + Math.min(crowd(E.rate(e.t, 'phi', 1, true)), crowd(E.rate(e.t, 'phi', 1)));
      const c0 = 12 * mod(e.phi0, 1), c1 = 12 * mod(e.phi1, 1);
      out({ t: e.t, at, k: 'cut', cg, c0, c1, db0: law(e.ln0), db1: law(e.ln1), ln0: e.ln0, ln1: e.ln1 });
      play(e.t + HT.cutNotes[0], c0, law(e.ln0), e.pan, cg, true, 'cutnote', { ln: e.ln0, side: 0 });
      play(e.t + HT.cutNotes[1], c1, law(e.ln1), e.pan, cg, true, 'cutnote', { ln: e.ln1, side: 1 });
    }
    function edge(e) {
      const sk = E.stroke(e.t), held = S.last && S.last.stroke === sk;
      if (held && e.t - S.last.t < HT.RE_QUIET) return;   // notes are flowing: their loudness carries |F|
      const line = held ? S.last.line : Math.floor(E.phiAt(e.t) * N + HT.lineTol), er = E.rate(e.t, 'ln', TAU);   // [V1]
      // (+1 µs: nine deferred repeats exactly repGap apart stay strictly under 8 a second)
      if (S.lastRep && e.t - S.lastRep.t < HT.repGap) { S.pend = { due: S.lastRep.t + HT.repGap + 1e-6, stroke: sk, line, ln: e.ln, er, dir: e.dir }; return; }
      if (inCue(e.t)) { C.repCue++; out({ t: e.t, at: t0 + e.t, k: 'rep-cue' }); return; }   // [B5]
      if (HT.graceGap && E.argSoon(e.t)) { C.repGrace++; out({ t: e.t, at: t0 + e.t, k: 'rep-grace' }); return; }   // [B12]
      S.lastRep = { t: e.t, stroke: sk };
      repeat(e.t, line, e.ln, e.pan, er, { dir: e.dir });
    }
    return {
      S, C, flush, figs,
      take(e) { flush(e.t); if (e.kind === 'arg') arg(e); else if (e.kind === 'cut') cut(e); else if (e.kind === 'mod') edge(e); },
      addCue(c) { const f = figure(c); figs.push(f); return f; },
      // a gap: the stroke ends; a deferred repeat coming due later is dropped
      gap() { S.pend = null; },
      reset() { S.last = null; S.lastRep = null; S.lastNote = -1e9; S.pend = null; S.lastCut = -1e9; S.mono = null; figs.length = 0; },
    };
  }

  // ---------------------------------------------------------------- the batch (Listen along, the tests)
  // events(smp, o) → LOG (the shape of the prototype's wav/<scene>--final-notes.log.json, plus pan and short).
  // smp: [{t, phi, ln, pan, gap?, seat?, cut?, hold?, src?, z?, zh?}] uniformly sampled (o.rate a second, default
  // 1000, t from smp[0].t); hold: the hand's step gap there (else from z/zh as the prototype, else 1/rate; src 'key':
  // keyGap). o: {n, cues: [{t, m, zero}], t0, onLine}. Returns the log with .counts
  function strokesOf(smp) { const s = new Float64Array(smp.length); let k = 0; smp.forEach((p, i) => { if (p.gap || p.seat) k++; s[i] = k; }); return s; }
  function events(smp, o = {}) {
    const N = o.n || HT.n, RATE = o.rate || 1000, n = smp.length, T0s = n ? smp[0].t : 0, LOG = [];
    if (!n) { LOG.counts = Decider({ n: N, env: {}, out: () => {} }).C; return LOG; }
    if (o.onLine != null) smp.onLine = !!o.onLine;
    const ev = crossings(smp, N);
    const idx = (t) => clamp(Math.round((t - T0s) * RATE), 0, n - 1);
    const stroke = strokesOf(smp), half = Math.round(HT.rateHalf * RATE);
    // rateAt (compare.js 181-188): ±half samples, not across a gap, a seat or a cut
    const rateAt = (i, key, k) => {
      i = clamp(i, 0, n - 1);
      if (smp[i].gap) return 0;
      let a = i, b = i;
      for (let s = 0; s < half && a > 0 && !smp[a - 1].gap && !smp[a].seat && !smp[a].cut; s++) a--;
      for (let s = 0; s < half && b < n - 1 && !smp[b + 1].gap && !smp[b + 1].seat && !smp[b + 1].cut; s++) b++;
      return b > a ? N * Math.abs(smp[b][key] - smp[a][key]) / ((b - a) / RATE) / k : 0;
    };
    // [B14] the pointer step carrying each sample (how long the hand held its last position), the longest in 100 ms
    const hold = new Float64Array(n); {
      let lastMove = 0, gap = 1 / RATE; const hz = (p) => p.zh || p.z;
      for (let i = 0; i < n; i++) {
        const a = smp[i], b = i ? smp[i - 1] : null;
        if (a.hold != null) gap = a.hold;
        else if (a.src === 'key') gap = HT.keyGap;
        else if (a.gap || !b || b.gap) { lastMove = i; gap = 1 / RATE; }
        else { const za = hz(a), zb = hz(b); if (za && zb && (za[0] !== zb[0] || za[1] !== zb[1])) { gap = (i - lastMove) / RATE; lastMove = i; } }
        hold[i] = gap;
      }
      const sg = Float64Array.from(hold), W = Math.round(HT.holdMax * RATE);
      for (let i = 0; i < n; i++) { let m = sg[i]; for (let k = Math.max(0, i - W); k < i; k++) if (sg[k] > m) m = sg[k]; hold[i] = m; }
    }
    const argT = ev.filter((x) => x.kind === 'arg').map((x) => x.t);
    const argSoon = (t) => { let lo = 0, hi = argT.length; while (lo < hi) { const m = (lo + hi) >> 1; if (argT[m] < t) lo = m + 1; else hi = m; } return lo < argT.length && argT[lo] < t + HT.graceGap; };
    const env = {
      rate: (t, key, k, before) => { const i = idx(t); return rateAt(before ? Math.max(0, i - 1) : i, key, k); },
      stroke: (t) => stroke[idx(t)], hold: (t) => hold[idx(t)], phiAt: (t) => smp[idx(t)].phi,
      at: (t) => { const j = idx(t); return { gap: !!smp[j].gap, stroke: stroke[j], pan: smp[j].pan || 0 }; }, argSoon,
    };
    const D = Decider({ n: N, t0: o.t0 || 0, cues: o.cues, env, out: (e) => LOG.push(e) });
    for (const e of ev) D.take(e);
    D.flush(Infinity);
    LOG.counts = D.C;
    return LOG;
  }

  // ---------------------------------------------------------------- the Glide's controls (compare.js finalGlide 631-677)
  // glideCtl(smp, o) → {ctl: posts [{at, phi, mode, a, b, pan, until, rel}], env, db (every sample), cracks (LOG),
  // seats}. o: {n, t0, rate, step (s between posts, 0.005)}. env/db reproduce the prototype's glEnv/glDb exactly
  function glideCtl(smp, o = {}) {
    const RATE = o.rate || 1000, n = smp.length, t0 = o.t0 || 0, N = o.n || HT.n, LOG = [];
    const out = { ctl: [], env: new Float64Array(n), db: new Float64Array(n), cracks: LOG, seats: [] };
    if (!n) return out;
    { let lastCut = -1e9;   // [V4] the crack: the same gap and R0 rule; [B11] glCrackDb in the renderer
      for (const e of crossings(smp, N)) if (e.kind === 'cut') { if (HT.cutGap && e.t - lastCut < HT.cutGap) { LOG.push({ t: e.t, at: t0 + e.t, k: 'cut-merged' }); continue; } const g = crowd(1 / Math.max(1e-6, e.t - lastCut)); lastCut = e.t; LOG.push({ t: e.t, at: t0 + e.t, k: 'crack', g, pan: e.pan }); } }
    // phi, ln and pan held across gaps
    const phi = new Float64Array(n), ln = new Float64Array(n), pan = new Float64Array(n);
    { let a = 0, b = 0, c = 0; const k0 = smp.findIndex((p) => !p.gap); if (k0 >= 0) { a = smp[k0].phi; b = smp[k0].ln; c = smp[k0].pan || 0; } smp.forEach((p, i) => { if (!p.gap) { a = p.phi; b = p.ln; c = p.pan || 0; } phi[i] = a; ln[i] = b; pan[i] = c; }); }
    // [B3] the gate: on once log F moved ≥ 1 JND (3° or 0.05 neper) within GL4.on, held while it moved holdJnd of a
    // JND within GL4.hold; [A13] only within the stroke (every 4th sample, as the prototype)
    const s0 = new Float64Array(n); smp.forEach((p, i) => { s0[i] = p.gap || p.seat ? i : i ? s0[i - 1] : 0; });
    const moved = (i, win, j = 1) => { if (smp[i].gap) return false; const W = Math.round(win * RATE); for (let k = Math.max(s0[i], i - W); k < i; k += 4) { const q = smp[k]; if (q.gap) continue; if (Math.abs(phi[i] - q.phi) * 360 >= 3 * j || Math.abs(ln[i] - q.ln) >= 0.05 * j) return true; } return false; };
    const gateOn = new Float64Array(n); { let on = false; for (let i = 0; i < n; i++) { on = moved(i, GL4.on) || (on && moved(i, GL4.hold, GL4.holdJnd)); gateOn[i] = on ? 1 : 0; } }
    const ka = 1 - Math.exp(-1 / (GL4.att / 3 * RATE)), kd = Math.exp(-6.9078 / (GL4.t60 * RATE));
    const env = out.env; { let v = 0; for (let i = 0; i < n; i++) { v = gateOn[i] ? v + (1 - v) * ka : v * kd; env[i] = v; } }
    // [A14] a re-seat while the voice rings: fade + silence, then a fresh attack
    const sf = GL4.seatFade.map((x) => Math.round(x * RATE));
    for (let i = 1; i < n; i++) if (smp[i].seat && env[i - 1] > 1e-4) out.seats.push(i);
    if (out.seats.length) {
      const blk = new Float64Array(n);
      for (const q of out.seats) blk.fill(1, q, Math.min(n, q + sf[0] + sf[1]));
      let v = 0; for (let i = 0; i < n; i++) { v = blk[i] ? 0 : gateOn[i] ? v + (1 - v) * ka : v * kd; env[i] = v; }
    }
    for (let i = 0; i < n; i++) out.db[i] = law(ln[i]) + GL4.db;
    // the posts: every o.step (5 ms), at every gate change, seat and cut. until: the gate's next closing (the worklet's
    // env attacks while currentTime < until), or now while it is off
    const nextOff = new Float64Array(n); { let j = n; for (let i = n - 1; i >= 0; i--) { if (!gateOn[i]) j = i; nextOff[i] = j; } }
    const step = Math.max(1, Math.round((o.step || 0.005) * RATE)), T = (i) => t0 + smp[0].t + i / RATE, seatSet = new Set(out.seats);
    let lastPost = -1e9;
    for (let i = 0; i < n; i++) {
      const p = smp[i], mode = p.gap ? null : p.cut ? 'cut' : (p.seat || i === 0) ? 'seat' : 'slew';
      const change = i > 0 && gateOn[i] !== gateOn[i - 1];
      if (!(i - lastPost >= step || change || mode === 'cut' || mode === 'seat' || i === n - 1)) continue;
      lastPost = i;
      out.ctl.push({ at: T(i), phi: phi[i], mode: mode || 'slew', a: glideAmp(ln[i]), b: bright(law(ln[i])), pan: pan[i], until: gateOn[i] ? T(nextOff[i]) : T(i), fade: seatSet.has(i) ? 1 : 0 });
    }
    return out;
  }
  // [B3] the live gate from the stroke's history hist [{t, phi, ln}] (oldest first, this stroke only) at time t:
  // → {on, until} (probe time; until = the latest moment 0.4 JND away + GL4.hold while on, else t)
  function gate(hist, t, on) {
    const cur = hist.length ? hist[hist.length - 1] : null;
    if (!cur) return { on: false, until: t };
    const away = (q, j) => Math.abs(cur.phi - q.phi) * 360 >= 3 * j || Math.abs(cur.ln - q.ln) >= 0.05 * j;
    let full = false, part = -1e9;
    for (let i = hist.length - 2; i >= 0; i--) { const q = hist[i]; if (q.t < t - GL4.on && q.t < t - GL4.hold) break; if (q.t >= t - GL4.on && away(q, 1)) full = true; if (q.t >= t - GL4.hold && part < -1e8 && away(q, GL4.holdJnd)) part = q.t; }
    const nowOn = full || (on && part > -1e8);
    return { on: nowOn, until: nowOn ? Math.max(t, (part > -1e8 ? part : t) + GL4.hold) : t };
  }

  // ---------------------------------------------------------------- a zero or a pole on the step, not a cut (FINAL A16)
  // throughZPAlong(P, g0, g1): P(u) = F at the step's point u ∈ [0, 1] ({re, im}); 40 bisections toward the jump of
  // arg F, then |F| 2^m-fold from w to 2w on both sides (a zero) or halving (a pole) at w = 64·(b − a); a cut keeps |F|
  // smooth. At most 44 calls of P. A non-finite midpoint is true
  const okv = (g) => !!g && Number.isFinite(g.re) && Number.isFinite(g.im) && (g.re !== 0 || g.im !== 0) && Number.isFinite(Math.hypot(g.re, g.im));
  function throughZPAlong(P, g0, g1) {
    const dArg = (p, q) => { let d = Math.atan2(q.im, q.re) - Math.atan2(p.im, p.re); d -= TAU * Math.round(d / TAU); return Math.abs(d); };
    let a = 0, b = 1, ga = g0, gb = g1;
    for (let k = 0; k < 40; k++) { const m = (a + b) / 2, gm = P(m); if (!okv(gm)) return true; if (dArg(ga, gm) >= dArg(gm, gb)) { b = m; gb = gm; } else { a = m; ga = gm; } }
    const c = (a + b) / 2, w = 64 * (b - a), q = (s) => { const p1 = P(c + s * w), p2 = P(c + 2 * s * w); return okv(p1) && okv(p2) ? Math.hypot(p2.re, p2.im) / Math.hypot(p1.re, p1.im) : 1; };
    const ra = q(-1), rb = q(1);
    return (ra > 1.6 && rb > 1.6) || (ra < 0.625 && rb < 0.625);
  }
  const throughZP = (F, z0, g0, z1, g1) => throughZPAlong((u) => F({ re: z0.re + (z1.re - z0.re) * u, im: z0.im + (z1.im - z0.im) * u }), g0, g1);

  // ---------------------------------------------------------------- the live stream (Sound.hear)
  // new Live({n}): fed the probe's samples (t in seconds, page clock) one at a time; returns the decided events, in
  // probe time, for the caller to schedule. The same Decider as events(); what differs is only what a live stream can
  // know: the rate is measured over the past rateHalf and extrapolated over the next (the last step's slope; a key
  // step's 0; a cut's 0: its step is the jump, so the cut's notes take the rate before it), and a repeat waits
  // graceGap (or flush(t) from a timer) before its grace test runs. As the batch's window, the rate's never spans a
  // cut (spec 3.12: lo ≥ the last cut; a cut's "before" rate, and a window that reaches a later cut, end at the value
  // just before its jump, the last step's slope carried to the cut).
  function Live(o = {}) {
    let N = o.n || HT.n;
    const out = [], hist = [];   // hist: this stroke's samples {t, phi, ln, pan} (≥ 0.3 s kept)
    let stroke = 0, prev = null, src = 'hand', w = 0, cell = { ca: null, cm: null, onA: null, onM: null }, waiting = [], args = [], holdH = [], glOn = false, open = false;
    let cuts = [];   // this stroke's cuts {t, phi, ln}: the values just before the jump (the last 0.5 s kept)
    const valAt = (t, key) => {
      if (!hist.length) return 0;
      if (t >= hist[hist.length - 1].t) { const h = hist[hist.length - 1]; return h[key] + (key === 'phi' ? w * (t - h.t) : (prev && prev.wl ? prev.wl * (t - h.t) : 0)); }
      if (t <= hist[0].t) return hist[0][key];
      let i = hist.length - 1; while (i > 0 && hist[i - 1].t > t) i--;
      const a = hist[i - 1], b = hist[i], u = b.t > a.t ? (t - a.t) / (b.t - a.t) : 1;
      return a[key] + u * (b[key] - a[key]);
    };
    const env = {
      rate: (t, key, k, before) => {
        if (!hist.length) return 0;
        let a = Math.max(hist[0].t, t - HT.rateHalf), b = before ? t : t + HT.rateHalf, vb = null;
        for (const c of cuts) {
          if (before ? c.t < t : c.t <= t) a = Math.max(a, c.t);
          else if (c.t <= b) { b = c.t; vb = c[key]; break; }
        }
        if (b <= a) return 0;
        return N * Math.abs((vb == null ? valAt(b, key) : vb) - valAt(a, key)) / (b - a) / k;
      },
      stroke: () => stroke,
      hold: (t) => { let m = 1e-3; for (const h of holdH) if (h.t >= t - HT.holdMax && h.g > m) m = h.g; return src === 'key' ? HT.keyGap : m; },
      phiAt: (t) => valAt(t, 'phi'),
      at: () => (open ? { gap: false, stroke, pan: prev ? prev.pan : 0 } : { gap: true, stroke: -1, pan: 0 }),
      argSoon: (t) => args.some((x) => x >= t && x < t + HT.graceGap),
    };
    const D = Decider({ n: N, t0: 0, cues: [], env, out: (e) => out.push(e) });
    // the repeats wait for graceGap of the stream (or a later colour line) before they are decided
    // (all: the stroke ends at T: a deferred repeat due later is dropped)
    const settle = (T, all) => {
      while (waiting.length && (all || waiting[0].t + HT.graceGap <= T)) D.take(waiting.shift());
      const p = D.S.pend;
      if (p && (all ? p.due <= T : p.due + HT.graceGap <= T)) D.flush(p.due);
      else if (p && all) D.S.pend = null;
    };
    function seatAt(s) {
      settle(s.t, true);
      stroke++; hist.length = 0; holdH.length = 0; args = []; cuts = []; w = 0; glOn = false; open = true;
      cell = { ca: null, cm: null, onA: null, onM: null };
      const p = { t: s.t, phi: s.phi, ln: s.ln, pan: s.pan || 0, seat: true };
      crossStep(cell, null, p, N, true, []);   // [B10] seatOnLine
      prev = p; hist.push(p); src = s.src || 'hand';
    }
    const glide = (mode) => { const g = gate(hist, prev.t, glOn); glOn = g.on; const db = law(prev.ln); return { phi: prev.phi, mode, a: glideAmp(prev.ln), b: bright(db), pan: prev.pan, until: g.until, rel: src === 'key' ? GL4.rel : 0 }; };
    function feed(s, cutFlag) {
      const ev = [];
      let p = { t: s.t, phi: s.phi, ln: s.ln, pan: s.pan || 0, cut: !!cutFlag };
      // a key step is a jump: the probe held its place until just before the step; a hand that rested longer than
      // holdMax moved only in the last holdMax
      const dt = s.t - prev.t, span = s.src === 'key' ? 0.001 : HT.holdMax;
      if (!cutFlag && dt > span + 1e-9) { const h = { t: s.t - span, phi: prev.phi, ln: prev.ln, pan: prev.pan }; crossStep(cell, prev, h, N, true, ev); hist.push(h); prev = h; }
      holdH.push({ t: s.t, g: Math.min(HT.holdMax, Math.max(1e-3, s.t - prev.t)) });
      while (holdH.length && holdH[0].t < s.t - HT.holdMax - 0.05) holdH.shift();
      // (a finger's lift, s.lift: the side of each line alone, no Schmitt band: no jitter follows it)
      crossStep(cell, prev, p, N, true, ev, s.lift ? 0 : HT.HB);
      const dts = p.t - prev.t;
      if (cutFlag) {
        // the values just before the jump: the last step's slope carried to the cut (at most holdMax: a hand that
        // rested moved only in the last holdMax)
        const u = Math.min(Math.max(0, dts), HT.holdMax);
        cuts.push({ t: p.t, phi: prev.phi + w * u, ln: prev.ln + (prev.wl || 0) * u });
        while (cuts.length > 1 && cuts[0].t < p.t - 0.5) cuts.shift();
      }
      w = s.src === 'key' || cutFlag || dts <= 0 ? 0 : (p.phi - prev.phi) / dts;
      p.wl = s.src === 'key' || cutFlag || dts <= 0 ? 0 : (p.ln - prev.ln) / dts;
      src = s.src || src; prev = p; hist.push(p);
      while (hist.length > 2 && hist[1].t < p.t - 0.3) hist.shift();
      ev.sort((a, b) => a.t - b.t);
      let arg = 0, modN = 0, dUp = 0, dDown = 0;
      for (const e of ev) {
        if (e.kind === 'arg') { arg++; args.push(e.t); if (((e.line % N) + N) % N === 0) { if (e.dir > 0) dUp++; else dDown++; } }
        else if (e.kind === 'mod') modN++;
        if (e.kind === 'mod') { waiting.push(e); continue; }
        // a colour line or a cut decides every repeat waiting before it (its grace test is now known)
        while (waiting.length && waiting[0].t <= e.t) D.take(waiting.shift());
        D.take(e);
      }
      args = args.filter((x) => x > p.t - 0.5);
      settle(p.t, false);
      return { arg, mod: modN, dUp, dDown };
    }
    const take = () => out.splice(0);
    return {
      get n() { return N; }, get stroke() { return open; }, get src() { return src; }, D,
      seat(s) { if (s.n && s.n !== N) N = s.n; seatAt(s); return { r: { arg: 0, mod: 0, dUp: 0, dDown: 0 }, ev: take(), gl: glide('seat') }; },
      step(s) {
        if (!open || (s.n && s.n !== N)) return this.seat(Object.assign({}, s, { n: s.n || N }));
        if (s.t < prev.t) s = Object.assign({}, s, { t: prev.t });
        const r = feed(s, false);
        return { r, ev: take(), gl: glide(s.src === 'key' ? 'step' : 'slew') };
      },
      cut(s) {
        if (!open) return this.seat(s);
        feed(s, true);
        return { r: { arg: 0, mod: 0, dUp: 0, dDown: 0 }, ev: take(), gl: glide('cut') };
      },
      // F changed with no path: the nearest turn; small → a step, else the two cut notes without a crack and a seat
      pathless(s) {
        if (!open) return this.seat(s);
        const phi = s.phi + Math.round(prev.phi - s.phi), s2 = Object.assign({}, s, { phi });
        if (Math.abs(phi - prev.phi) < HT.pathless.dphi && Math.abs(s.ln - prev.ln) < TAU / N) return this.step(s2);
        settle(s.t, true);
        const t = Math.max(s.t, prev.t), c0 = 12 * mod(prev.phi, 1), c1 = 12 * mod(phi, 1), cg = HT.cutDb;
        out.push({ t, at: t, k: 'cutnote', c: c0, db: law(prev.ln), g: cg, pan: s.pan || 0, short: true, ln: prev.ln, side: 0, leap: 1 });
        out.push({ t: t + HT.cutNotes[1] - HT.cutNotes[0], at: t + HT.cutNotes[1] - HT.cutNotes[0], k: 'cutnote', c: c1, db: law(s.ln), g: cg, pan: s.pan || 0, short: true, ln: s.ln, side: 1, leap: 1 });
        const ev = take(), r = this.seat(s2);
        return { r: Object.assign(r.r, { leap: true }), ev: ev.concat(r.ev), gl: r.gl };
      },
      gap(t) { if (open) settle(t, true); D.gap(); open = false; hist.length = 0; glOn = false; const ev = take(); return { ev, gl: null }; },
      // a timer: decide what waits once the stream is quiet (a repeat's grace window, a deferred repeat's due time)
      flush(t) { if (open) settle(t, false); return take(); },
      cue(c) { return D.addCue(c); },
      end() { D.reset(); waiting = []; args = []; open = false; hist.length = 0; glOn = false; out.length = 0; },
      pending() { return waiting.length ? waiting[0].t + HT.graceGap : D.S.pend ? D.S.pend.due + HT.graceGap : null; },
      state() { return { stroke: open, src, held: D.S.last ? { k: D.S.last.line, t: D.S.last.t } : null, pend: D.S.pend ? { due: D.S.pend.due, k: D.S.pend.line } : null, lastNote: D.S.lastNote, lastRep: D.S.lastRep ? D.S.lastRep.t : null, lastCrack: D.S.lastCut, glOn }; },
    };
  }

  return { HT, law, crowd, noteGain, copies, seed, soft, bright, glideAmp, figure, cueGap, crossings, events, glideCtl, gate, throughZP, throughZPAlong, Live, Decider };
}

const Sound = (() => {
  // the app's lsk('cmw-sound'): a ?ns=name page (test tabs) keeps its own setting
  const NS = (() => { try { return new URLSearchParams(location.search).get('ns') || ''; } catch (e) { return ''; } })();
  const KEY = NS ? 'cmw-sound:' + NS : 'cmw-sound';
  const TIERS = ['ui', 'events', 'sonify'], TI = { ui: 0, events: 1, sonify: 2, aud: 3 };
  // (v15, the user's defaults, notes/sound/README.md: sound on, Interface and Mathematical events on, Snap ticks and
  // Hear the function off. A ?ns= test page starts off, so the quality and perf suites stay silent unless a test turns
  // it on. These apply only when nothing is stored: a stored choice always wins.)
  // glide: Hear the function as one continuous voice instead of notes (a per-device preference; never in a link)
  const DEFAULTS = { on: !NS, vol: 0.7, ui: true, snap: false, events: true, sonify: false, glide: false };
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
    latency: ctx ? (ctx.baseLatency || 0) + (ctx.outputLatency || 0) : 0, hidden, engine: G ? G.engine : 'none',
    glide: !!(P.glide && G && G.engine === 'worklet'), glideOk: !(G && G.engine === 'nodes') && typeof AudioWorkletNode !== 'undefined' });
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
    const bus = c.createGain();
    // the declared safety limiter between the bus (every tier, the room's return) and the master (limitOn): until the
    // worklet loads, a 2 ms delay (the limiter's look-ahead) holds its place
    let limit = null;
    if (c.createDelay && !opts.noLimit) { const d = c.createDelay(0.01), dg = c.createGain(); d.delayTime.value = Math.max(1, Math.round(0.002 * c.sampleRate)) / c.sampleRate; bus.connect(d); d.connect(dg); dg.connect(master); limit = { d, dg, node: null, comp: null, lg: null }; }
    else bus.connect(master);
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
    const g = { c, master, bus, tier, aud, limit, active: new Set(), worklet: false, synth: null, engine: 'loading', offline: false, flush: [] };
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
    // (knock 0: no contact noise; its seed is still drawn, so the PRNG's sequence is unchanged)
    if (M.knock) { const sd = seed32(); if (o.knock !== 0) Pt.push({ k: 'n', d, dur: Math.max(0.002, 2.5 * tau), fc: Math.min(M.kf * (0.6 + 0.8 * vel), 6000), a: g * M.knock * (o.knock == null ? 1 : o.knock), seed: sd }); }
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
    // [v16.5 rail SPEC 4.4] a point put on a curve or a crossing by a drop, and one pulled off its curve (one per gesture)
    attach: { tier: 'ui', gap: 150, wet: 0.06, label: 'Point attached', what: 'A point landed on a curve or a crossing: tines E5 then A5, 30 ms apart',
      make: (Pt) => { strike(Pt, 0, st0(14), 'tine', { vel: 0.45, soft: 1.4, t60: 0.14, amp: 0.2, detune: 6 }); strike(Pt, 0.03 + rnd(-0.003, 0.003), st0(19), 'tine', { vel: 0.5, soft: 1.2, t60: 0.18, amp: 0.2, detune: 6 }); } },
    // (E5, not edge's A4: a lone skin strike at A4 loses 7.5 dB through the phone-speaker model, E5 stays audible there)
    detach: { tier: 'ui', gap: 150, wet: 0.05, label: 'Point freed', what: 'A point was pulled off its curve: a felt tap with a pitch drop, E5',
      make: (Pt) => strike(Pt, 0, st0(14), 'skin', { vel: 0.6, soft: 1.8, t60: 0.1, amp: 0.17, drop: 1.5, knock: 3.5 }) },

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
      make: (Pt, o) => { const m = clamp(o.order | 0 || 1, 1, 8), sp = m >= 3 ? 0.15 : 0.11; for (let j = 0; j < m; j++) strike(Pt, sp * j, st(24), 'glass', { vel: (o.vel == null ? 0.6 : o.vel) * (j ? 0.75 : 1), soft: 0.8, t60: 0.55, amp: 0.21, detune: 2 }); } },
    pole: { tier: 'sonify', gap: 250, wet: 0.14, label: 'Pole', what: 'The probe reached a pole; one felt thump per order',
      make: (Pt, o) => { const m = clamp(o.order | 0 || 1, 1, 8), sp = m >= 3 ? 0.15 : 0.12, v = o.vel == null ? 0.7 : o.vel; for (let j = 0; j < m; j++) { strike(Pt, sp * j, st(7), 'skin', { vel: v * (j ? 0.75 : 1), soft: 1.6, t60: 0.16, amp: 0.36, drop: 1.5, knock: 3.5 }); strike(Pt, sp * j, st(-5), 'skin', { vel: v * (j ? 0.75 : 1), soft: 2.4, t60: 0.2, amp: 0.06, drop: 1.5, knock: 0 }); strike(Pt, sp * j, st(19), 'wood', { vel: v * (j ? 0.75 : 1), soft: 1.4, t60: 0.07, amp: 0.13, drop: 1, detune: 2 }); } } },
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
  const TRIM = { toggleOn: -1.07, toggleOff: -0.4, stepAdd: 0.06, stepRemove: -0.72, view: 2.75, exportDone: -1.8, error: -0.82, edge: -2.23, snap: -2.85, attach: 0.71, detach: 0.01, morphStart: 1.91, morphEnd: -0.59, loopDone: 0.48, zero: -0.35, pole: 0.1, dense: 0.35, cut: -3.25, turn: -0.43, turnMany: -1.43, contour: -1.52, collide: 0.5 };
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
    this.sg = L.Singer(this.fs, p.seed || 4242); this.nFade = Math.round(0.012 * this.fs); this.gl = L.Glide(this.fs);
    this.stat = { cues: 0, late: 0, maxLateMs: 0, steals: 0, maxStrings: 0, maxCues: 0 };
    for (const c of p.cmds || []) this.push(c);
    this.port.onmessage = (e) => { if (e.data === 'stat') { this.port.postMessage(this.stat); return; } for (const c of e.data) this.push(c); };
  }
  push(c) { if (c.k === 'clear') { this.clear(c.tag); return; } if (c.k === 'gl') { this.gl.cmd(c, Math.round((c.at || 0) * this.fs)); return; } c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }
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
    this.gl.clear(all ? undefined : tag);
    if (all) { for (const T of this.tex.values()) { T.fade = 0; this.dying.push(T); } this.tex.clear(); this.sg.hush(); }
    else if (this.sg.h.tag === tag) this.sg.hush();
  }
  drop(ci) { const cue = this.cues[ci]; this.cues.splice(ci, 1); if (cue.str) { const k = this.strs.indexOf(cue); if (k >= 0) this.strs.splice(k, 1); } }
  start(c, f0) {
    const fs = this.fs, sh = c.f < f0 ? f0 - c.f : 0;
    if (sh) { this.stat.late++; this.stat.maxLateMs = Math.max(this.stat.maxLateMs, 1000 * sh / fs); }
    this.stat.cues++;
    const cue = { tier: c.tier, pan: c.pan || 0, g: c.g == null ? 1 : c.g, wet: c.wet || 0, tag: c.tag, str: !!c.str, key: c.key || 0, grp: c.grp || '', fade: -1, fadeN: this.nFade,
      parts: c.parts.map((p) => ({ sf: c.f + sh + Math.round((p.d || 0) * fs), v: L.MAKE[p.k](p, fs), live: true })) };
    // the harp's strings: at most 12 at once (c.cap: a composed piece's, notes/sea-song); the oldest fades out over
    // 30 ms (raised cosine) when one more starts. c.key (a piece's string, its MIDI note): a string plucked again is
    // damped first, as a harpist re-plucks one string (notes/sea-song/r3)
    if (cue.str) {
      const strs = this.strs;
      if (cue.key) for (let i = strs.length - 1; i >= 0; i--) if (strs[i].key === cue.key && strs[i].grp === cue.grp) { const o = strs.splice(i, 1)[0]; if (o.fade < 0) { o.fade = 0; o.fadeN = Math.round(0.03 * fs); } this.stat.steals++; }
      // (c.grp: string groups, each under its own cap: Hear the function's marimba bars ('ht') damp only each other)
      for (let cnt = strs.reduce((a, s) => a + (s.grp === cue.grp ? 1 : 0), 0); cnt >= (c.cap || 12); cnt--) { const o = strs.splice(strs.findIndex((s) => s.grp === cue.grp), 1)[0]; if (o.fade < 0) { o.fade = 0; o.fadeN = Math.round(0.03 * fs); } this.stat.steals++; }
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
    this.gl.run(outs, f0, n, 0.14);
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
// the declared safety limiter on the bus (L.Limiter): every tier and the room's return, before the master volume
class Limit extends AudioWorkletProcessor {
  constructor(o) { super(); const p = (o && o.processorOptions) || {}; this.lim = L.Limiter(sampleRate, p.ceil || 0.363); this.port.onmessage = (e) => { if (e.data === 'stat') this.port.postMessage(this.lim.st); }; }
  process(ins, outs) {
    const i = ins[0] || [], o = outs[0], n = o[0].length, a = i[0], b = i[1] || i[0];
    if (a) o[0].set(a); else o[0].fill(0);
    if (o[1]) { if (b) o[1].set(b); else o[1].fill(0); }
    this.lim.process(o[0], o[1] || null, n);
    return true;
  }
}
registerProcessor('cmw-limit', Limit);`;
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
    // (#271) the main-thread render takes 30–70 ms: inside an input handler it is handed to the next task, and its start
    // stays no earlier than now + LEAD (fallbackCue's own rule), so the attack is not cut
    if (!g.offline && inInput()) {
      let end = 0; for (const p of cue.parts) end = Math.max(end, LIB.partEnd(p));
      // (a hush or stopTag before it runs drops it: g.later)
      const job = { tag: cue.tag }; (g.later || (g.later = new Set())).add(job);
      setTimeout(() => { if (g.later.delete(job) && g.c.state !== 'closed') fallbackCue(g, cue, t); }, 0);
      return Math.max(t, g.c.currentTime + LEAD) + end;
    }
    return fallbackCue(g, cue, t);
  }
  // in an input event's handler: the activation gesture is live and the event being dispatched is a UI event
  const inInput = () => inGesture() && typeof UIEvent !== 'undefined' && window.event instanceof UIEvent;
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
      ctx.onstatechange = () => { if (ctx.state === 'running') { graceUsed = false; flushPend(); } emit(); };
      LEAD = Math.max(0.012, 2 * (ctx.baseLatency || 0.005));
      G = graph(ctx, 0);
      // the worklet loads in the background; until it is there (or where it is refused) the fallback renders cues
      if (prefer.worklet) { const g = G; loadWorklet(ctx).then((ok) => { g.worklet = ok; if (ok) g.synth = makeSynth(g); g.engine = ok ? 'worklet' : 'nodes'; limitOn(g); emit(); }); } else { G.engine = 'nodes'; limitOn(G); }
      applyGains(true);
    }
    if (ctx.state !== 'running') ctx.resume().then(emit, () => {});
    emit();
    return true;
  }
  // may a sound be scheduled now? Only on a running clock: a suspended or iOS-"interrupted" context would release a
  // backlog as a burst on resume. The one exception: a single sound inside an active gesture (the "on" confirmation).
  function canSchedule(grace, wait) {
    if (ctx && ctx.state === 'running') return true;
    // the context is due one frame after this gesture: a one-shot waits for it (play queues it); anything else creates
    // it now, as before
    if (pendT) { if (wait) return 'wait'; ensureNow(); return canSchedule(grace); }
    if (!ensure()) return false;
    if (ctx.state === 'running') return true;
    if (grace && !graceUsed && inGesture()) { graceUsed = true; return true; }
    return false;
  }
  // The first gesture's context (#271): new AudioContext() takes ~55 ms, so it is created just after the gesture, not
  // inside it: the click's own frame paints first, and the gesture still counts (Chrome and Firefox keep transient
  // activation ~5 s, WebKit carries it through timers ~1 s). One-shots asked for meanwhile wait in pendQ (one per
  // catalog entry, with its intended start) and sound against the new clock. Safety net (old iOS): once a context
  // exists, or a deferred start made none, a gesture calls ensure() synchronously, as before.
  /** @type {{ raf: number, to: any, late: any } | null} */
  let pendT = null;
  let syncNext = false;
  const pendQ = new Map();
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 16);
  const unraf = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
  function ensureNow() {
    if (pendT) { unraf(pendT.raf); clearTimeout(pendT.to); clearTimeout(pendT.late); pendT = null; }
    const tried = !!AC && P.on && !hidden && mayStart(), ok = ensure();
    if (tried && !ctx) syncNext = true;
    if (!ok) pendQ.clear(); else flushPend();
    return ok;
  }
  function deferEnsure() {
    if (pendT) return;
    const run = () => { if (pendT) ensureNow(); };
    pendT = { raf: 0, to: 0, late: 0 };
    const p = pendT;
    p.raf = raf(() => { p.to = setTimeout(run, 0); });
    // (no frame comes, e.g. a throttled page: at most 250 ms later)
    p.late = setTimeout(run, 250);
  }
  // the queued one-shots, once the clock runs (a statechange calls this again). The click's frame comes first: on a
  // first frame that links shaders (the Deformation's) the start cue sounds with that frame's paint, not at the click.
  // A cue that could not start within 1.5 s of its request is dropped: it would no longer belong to its gesture
  function flushPend() {
    if (!pendQ.size || pendT) return;
    if (!ctx) { pendQ.clear(); return; }
    const now = performance.now() / 1000, run = ctx.state === 'running';
    for (const [name, q] of [...pendQ]) {
      if (now - q.asked > 1.5) { pendQ.delete(name); continue; }
      if (!run && !q.o.grace) continue;
      pendQ.delete(name);
      play(name, Object.assign({}, q.o, { at: Math.max(0, q.due - now) }));
    }
  }
  const onActivate = (e) => {
    if (e.type === 'keydown' && e.key === 'Escape') return;
    activated = true; lastGesture = performance.now();
    if (!P.on || hidden || (ctx && ctx.state === 'running')) return;
    if (ctx || syncNext) { syncNext = false; ensureNow(); } else deferEnsure();
  };
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
      if (G.active.size || singOn || ctx.currentTime < busyUntil) { touchIdle(5000); return; }
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
    const cs = canSchedule(!!o.grace, true);
    if (cs === 'wait') { if (!pendQ.has(name)) { const a = performance.now() / 1000; pendQ.set(name, { o, asked: a, due: a + (o.at || 0) }); } return true; }
    if (!cs) return false;
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
  // Harp(lines): a piece's own lines (notes/sea-song), or HARP_LINES
  function Harp(lines) { return { c: null, phi: 0, recent: [], up: 0, down: 0, notes: 0, k: 0, L: linesOk(lines) ? lines.slice() : HARP_LINES }; }
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
    if (st.c === null) { st.c = cellL(phi, st.L); st.phi = phi; return []; }
    const h = o.h > HARP_H ? Math.min(0.125, o.h) : HARP_H;
    const P0 = st.phi, dt = clamp(o.dt || 0.016, 0.008, 0.1), fired = harpCross(st, P0, phi, h);
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

  const leadOf = (c) => (typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext ? 0 : LEAD);
  // a target curve from wherever the param is, starting no earlier than now + LEAD
  function follow(c, p, v, tau, t = 0) {
    const T = Math.max(t || 0, c.currentTime + leadOf(c));
    p.cancelScheduledValues(T);
    if (tau > 0) p.setTargetAtTime(v, T, tau); else p.setValueAtTime(v, T);
    return T;
  }
  // Esc, hidden, off: everything stops now, queues are emptied, the voices are gated off; the setting is unchanged.
  // The synth drops what is queued and fades what sounds in 12 ms (raised cosine); the bus dips on a 12 ms raised cosine
  // and comes back on a 30 ms one 50 ms later; every fallback source stops inside the silent window. A hush during a
  // hush joins its silent window, or (in its return) starts a new one after it: value curves never overlap.
  function hush() {
    pendQ.clear();
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
    if (G.later) G.later.clear();
    HH.along = null;
    const off = Math.max(now, t + 0.013);
    for (const s of G.active) { try { s.stop(off); } catch (e) { /* not started */ } }
    Q.turn.next = Q.contour.next = 0; Q.turn.due.length = Q.contour.due.length = 0;
    SC.tex = false; motionOn = false; singOn = false; singTier = ''; singOffAt = 0; busyUntil = 0;
    hearEnd();
  }
  // stop one tagged group (a "listen along"): what has not sounded is dropped, what sounds fades in 12 ms. The fallback's
  // sources fade on their own gain (a 12 ms raised cosine) and stop after it: a stop alone cut a ringing string's wave
  // (review sound-4)
  function stopTag(tag) {
    if (HH.along && HH.along.tag === tag) HH.along = null;
    for (const [name, q] of [...pendQ]) if (q.o.tag === tag) pendQ.delete(name);
    if (!ctx || !G) return;
    if (G.synth) G.synth.post([{ k: 'clear', tag }]);
    if (G.later) for (const j of G.later) if (j.tag === tag) G.later.delete(j);
    const t = ctx.currentTime + LEAD;
    for (const s of G.active) {
      if (s.tag !== tag) continue;
      try { if (s.out) s.out.gain.setValueCurveAtTime(FADE_DN, t, 0.012); } catch (e) { /* a fade already scheduled */ }
      try { s.stop(t + 0.013); } catch (e) { /* ended */ }
    }
    if (singTier === 'events') { singOn = false; singTier = ''; singOffAt = 0; }
  }


  // ---------------------------------------------------------------- Hear the function (spec 3; perfwin FINAL.md)
  // The decisions are HT_LIB's (pure, tested against the prototype's logs); here they are rendered and scheduled.
  // Notes: the marimba (htNote), the crack (htCrack), the query; Glide: the worklet's Glide (L.Glide) with the crack
  // and the cues 3 dB down. Live: Sound.hear (sonify tier); Listen along: Sound.along (events tier).
  const HTL = HT_LIB(), HT = HTL.HT;
  const glideOn = () => !!(P.glide && G && G.engine === 'worklet');
  // one note at pitch class c (semitones above D): 2 or 3 octave copies under the A4 Gaussian, each the app's 'wood'
  // strike with no knock (vel 0.6, soft from dbV3, T60 0.45·(f/440)^−0.6 or 0.15 short), seeded by (pitch class, copy):
  // the bars as damped strings (cap = the copies, group 'ht': each note damps the one before over 30 ms)
  function htNote(g, at, c, db, gdb, pan, tier, tag, short) {
    FS = g.c.sampleRate;
    const cps = HTL.copies(c), sf = HTL.soft(db);
    let end = at;
    cps.forEach((cp, j) => {
      R = prng(HTL.seed(3000 + Math.round(c * 100), j));
      const Pt = [], amp = HT.LV.note * Math.pow(10, (db + gdb) / 20) * cp.w, t60 = short ? HT.short : HT.t60 * Math.pow(cp.f / HT.A4, HT.t60Exp);
      strike(Pt, 0, cp.f, 'wood', { vel: HT.vel, soft: sf, t60, amp, detune: 0, var: 0, knock: 0 });
      end = Math.max(end, emitCue(g, { tier: TI[tier], pan: clamp(pan || 0, -HT.PAN_MAX, HT.PAN_MAX), wet: HT.wet.note, g: 1, parts: Pt, tag, str: 1, cap: cps.length, grp: 'ht' }, at));
    });
    return end;
  }
  // the crack at a branch cut: a woodblock at 3100 Hz, 8 ms, seeded; gdb: the R0 gain of cracks (and −3 dB in Glide)
  function htCrack(g, at, pan, gdb, tier, tag) {
    FS = g.c.sampleRate; R = prng(HTL.seed(7001, 0));
    const Pt = []; strike(Pt, 0, HT.crackHz, 'block', { vel: 1, soft: 0.4, t60: 0.008, amp: HT.LV.crack * Math.pow(10, gdb / 20), detune: 0, var: 0 });
    return emitCue(g, { tier: TI[tier], pan: clamp(pan || 0, -HT.PAN_MAX, HT.PAN_MAX), wet: HT.wet.crack, g: 1, parts: Pt, tag }, at);
  }
  // the Glide's query: short bowed copies under the D5 Gaussian (σ 0.7), at the Glide's level
  function htQueryBowed(g, at, c, db, pan, tier, tag) {
    FS = g.c.sampleRate;
    const out = [];
    for (let k = 0; k < 7; k++) { const f = HT.D2 * Math.pow(2, c / 12 + k); if (f > 2600) break; const d = Math.log2(f / 587.33) / 0.7, w = Math.exp(-0.5 * d * d); if (w >= HT.wMin) out.push({ f, w }); }
    const s = 1 / Math.sqrt(out.reduce((a, o) => a + o.w * o.w, 0));
    let end = at;
    out.forEach((cp, j) => { R = prng(HTL.seed(9000 + Math.round(c * 100), j)); const Pt = []; bowed(Pt, 0, cp.f, { att: 0.03, hold: 0.06, t60: 0.55, amp: HT.LV.query * Math.pow(10, (db + HT.GL4.db) / 20) * cp.w * s }); end = Math.max(end, emitCue(g, { tier: TI[tier], pan: clamp(pan || 0, -HT.PAN_MAX, HT.PAN_MAX), wet: HT.wet.query, g: 1, parts: Pt, tag }, at)); });
    return end;
  }
  // a decided event (HT_LIB's LOG shape) at audio time `at`
  function htRender(g, e, at, tier, tag, glide) {
    if (e.k === 'crack') return htCrack(g, at, e.pan, e.g + (glide ? HT.glCrackDb : 0), tier, tag);
    if (glide) return at;
    if (e.k === 'note' || e.k === 'rep' || e.k === 'cutnote') return htNote(g, at, e.c, e.db, e.g, e.pan, tier, tag, !!e.short);
    return at;
  }
  // an order cue (spec 3.8): m ≤ 8 pings (zero) or thumps (pole), fixed velocity, the zero 6 dB down, −3 dB more in
  // Glide, seed 7, no repetition softening; through play()'s shared 'zp' gap and dense rule unless `at` is given
  function htCue(c, glide, at, tier) {
    const m = Math.round(Math.abs(c.m)), zero = !!c.zero;
    if (m > HT.maxOrder) return 'over';
    const o = { order: m, vel: zero ? 0.6 : 0.7, gainDb: (zero ? HT.cueZeroDb : HT.cuePoleDb) + (glide ? HT.glCueDb : 0), seed: 7, noRep: true, pan: clamp(c.pan || 0, -HT.PAN_MAX, HT.PAN_MAX) };
    if (at != null) { cueTo(G, zero ? 'zero' : 'pole', at, Object.assign(o, { tier })); return 'played'; }
    const r = play(zero ? 'zero' : 'pole', o);
    return r === 'dense' ? 'dense' : r ? 'played' : 'gap';
  }

  // ---- Listen along: Sound.along(smp, o)
  // smp: [{t (s from 0), phi, ln, pan, gap?, seat?, cut?}], one a millisecond. o: {tag, n, closed, cues?, queries?}
  // (cues [{t, m, zero, pan}] and queries [{t, phi, ln, pan}]: for renders and tests; Listen along has neither)
  function along(smp, o = {}) {
    if (!AC || !P.on || hidden || !P.events || !smp || smp.length < 2 || !canSchedule()) return null;
    const N = o.n || HT.n, tag = o.tag, glide = glideOn(), t0 = ctx.currentTime + Math.max(0.03, LEAD + 0.01);
    const T0 = smp[0].t, dur = smp[smp.length - 1].t - T0, rate = (smp.length - 1) / Math.max(1e-9, dur);
    const cues = HTL.cueGap((o.cues || []).filter((c) => Math.abs(c.m) <= HT.maxOrder));
    let end = t0 + dur, log;
    const counts = { notes: 0, reps: 0, cracks: 0 };
    if (!glide) {
      log = HTL.events(smp, { n: N, cues, t0: t0 - T0, rate });
      for (const e of log) end = Math.max(end, htRender(G, e, e.at, 'events', tag, false));
      counts.notes = log.counts.notes; counts.reps = log.counts.reps; counts.cracks = log.counts.cracks;
    } else {
      const gc = HTL.glideCtl(smp, { n: N, t0: t0 - T0, rate });
      log = gc.cracks;
      for (const e of log) if (e.k === 'crack') { counts.cracks++; htRender(G, e, e.at, 'events', tag, true); }
      G.synth.post(gc.ctl.map((c) => Object.assign({ k: 'gl', tier: TI.events, tag }, c)));
      end += HT.GL4.tail;
      HH.along = { tag, end: end - HT.GL4.tail + 0.05 };
      log.glide = gc;
    }
    for (const c of cues) { htCue(c, glide, t0 + c.t - T0, 'events'); log.push({ t: c.t, at: t0 + c.t - T0, k: c.zero ? 'cue:zero' : 'cue:pole', m: c.m }); }
    for (const q of o.queries || []) { const c = 12 * (((q.phi % 1) + 1) % 1), db = HTL.law(q.ln), at = t0 + q.t - T0; if (glide) htQueryBowed(G, at, c, db, q.pan, 'events', tag); else htNote(G, at, c, db, 0, q.pan, 'events', tag, false); log.push({ t: q.t, at, k: 'query', c, db }); }
    busy(end + 1);
    return { t0, dur, now: () => ctx.currentTime, mode: glide ? 'glide' : 'notes', counts, log };
  }

  // ---- the live stream: Sound.hear
  const HH = { live: HTL.Live({ n: HT.n }), off: null, timer: 0, logFn: null, lastOnset: -1e9, gl: { on: false, until: 0, at: 0, rel: 0 }, counts: null, along: null };
  const hc0 = () => ({ notes: 0, merged: 0, late: 0, reps: 0, deferred: 0, repCue: 0, repGrace: 0, cracks: 0, cutMerged: 0, dUp: 0, dDown: 0, seats: 0 });
  HH.counts = hc0();
  const hearOk = () => !!(AC && P.on && P.sonify && !hidden && canSchedule());
  // A(t): the stroke's audio time for probe time t (spec 3.12): one offset per stroke, never decreasing, so that A(t)
  // is never in the past and never more than LEAD + 0.1 s ahead
  function hearAt(t) {
    const now = ctx.currentTime, lo = now + LEAD - t, hi = now + LEAD + 0.1 - t;
    if (HH.off == null) HH.off = now + LEAD + 1 / 60 - t;
    HH.off = clamp(Math.max(HH.off, lo), lo, hi);
    return t + HH.off;
  }
  function hearLog(e) { if (HH.logFn) { try { HH.logFn(e); } catch (x) { /* the subscriber's */ } } }
  function hearOut(evs) {
    const glide = glideOn();
    let end = 0;
    for (const e of evs) {
      const at = Math.max(hearAt(e.t), ctx.currentTime + LEAD);
      e.at = at;
      const k = e.k, C = HH.counts;
      if (k === 'note') C.notes++; else if (k === 'merged') { C.merged++; if (e.late) C.late++; } else if (k === 'rep') { C.reps++; if (e.defer) C.deferred++; }
      else if (k === 'rep-cue') C.repCue++; else if (k === 'rep-grace') C.repGrace++; else if (k === 'crack') C.cracks++; else if (k === 'cut-merged') C.cutMerged++;
      if (k === 'note' || k === 'rep' || k === 'cutnote' || k === 'crack') { end = Math.max(end, htRender(G, e, at, 'sonify', 'hear', glide)); if (!glide || k === 'crack') HH.lastOnset = Math.max(HH.lastOnset, at); }
      hearLog(e);
    }
    if (end) busy(end);
  }
  function hearGl(gl, mode, t, fade) {
    if (!gl || !glideOn() || !G.synth) return;
    // (a Listen along in the Glide owns the one voice until it ends or is stopped: the live stream is not heard over it)
    if (HH.along && ctx.currentTime < HH.along.end) return;
    const at = Math.max(hearAt(t), ctx.currentTime + LEAD), until = gl.until > t ? at + (gl.until - t) : at;
    const c = { k: 'gl', at, phi: gl.phi, mode, a: gl.a, b: gl.b, pan: clamp(gl.pan || 0, -HT.PAN_MAX, HT.PAN_MAX), until, rel: gl.rel || 0, fade: fade ? 1 : 0, tier: TI.sonify, tag: 'hear' };
    G.synth.post([c]);
    HH.gl = { on: until > at, until, at, rel: gl.rel || HT.GL4.t60 };
    busy(until + 2);
    hearLog(Object.assign({}, c, { k: 'gl' }));
  }
  // a timer for what waits (a repeat's 30 ms grace decision, a deferred repeat's due time), on the page clock
  function hearTimer(tNow) {
    clearTimeout(HH.timer); HH.timer = 0;
    const p = HH.live.pending();
    if (p == null) return;
    const base = performance.now() / 1000 - tNow;
    HH.timer = setTimeout(() => { HH.timer = 0; if (!hearOk()) return; const t = performance.now() / 1000 - base; hearOut(HH.live.flush(t)); hearTimer(t); }, Math.max(1, (p - tNow) * 1000 + 1));
  }
  const glEnvNow = () => { if (!ctx || !HH.gl.until) return 0; const now = ctx.currentTime; if (now < HH.gl.until) return 1; return Math.exp(-6.9078 * (now - HH.gl.until) / (HH.gl.rel || HT.GL4.t60)); };
  function hearSmp(s) { return { t: +s.t, phi: +s.phi, ln: +s.ln, pan: clamp(+s.pan || 0, -HT.PAN_MAX, HT.PAN_MAX), n: s.n | 0 || HT.n, src: s.src || 'hand', lift: !!s.lift }; }
  const R0 = () => ({ arg: 0, mod: 0, dUp: 0, dDown: 0 });
  function hearCall(kind, s) {
    if (!hearOk()) { if (HH.live.stroke) hearGap(s && s.t); return null; }
    const smp = hearSmp(s);
    if (!Number.isFinite(smp.t) || !Number.isFinite(smp.phi) || !Number.isFinite(smp.ln)) { hearGap(smp.t); return null; }
    const wasOpen = HH.live.stroke, ringing = glEnvNow() > 1e-4;
    if (kind === 'seat' || !wasOpen) HH.off = null;
    const r = HH.live[kind](smp);
    if (kind === 'seat' || !wasOpen) HH.counts.seats++;
    hearOut(r.ev);
    const mode = kind === 'cut' ? 'cut' : kind === 'seat' || !wasOpen || (r.r && r.r.leap) ? 'seat' : smp.src === 'key' ? 'step' : 'slew';
    hearGl(r.gl, mode, smp.t, mode === 'seat' && ringing);
    HH.counts.dUp += r.r.dUp || 0; HH.counts.dDown += r.r.dDown || 0;
    hearTimer(smp.t);
    return Object.assign(R0(), r.r);
  }
  function hearGap(t) {
    const tt = Number.isFinite(t) ? t : performance.now() / 1000;
    // the Glide's gate closes now: it rings down (T60 0.8 s, or 0.2 s after a key stroke)
    if (HH.live.stroke && ctx) { hearOut(HH.live.gap(tt).ev); if (glideOn() && G.synth && HH.gl.until > ctx.currentTime) { const now = ctx.currentTime + LEAD; G.synth.post([{ k: 'gl', at: now, mode: 'close', until: now, tag: 'hear' }]); HH.gl.until = now; hearLog({ k: 'gl', at: now, mode: 'close', until: now }); } }
    else HH.live.gap(tt);
    clearTimeout(HH.timer); HH.timer = 0; HH.off = null;
  }
  function hearEnd() {
    HH.live.end(); clearTimeout(HH.timer); HH.timer = 0; HH.off = null;
    if (G && G.synth && ctx) G.synth.post([{ k: 'gl', at: ctx.currentTime + LEAD, mode: 'stop', tag: 'hear' }]);
    HH.gl = { on: false, until: 0, at: 0, rel: 0 };
  }
  const hear = {
    seat: (s) => hearCall('seat', s),
    step: (s) => hearCall('step', s),
    cut: (s) => hearCall('cut', s),
    pathless: (s) => hearCall('pathless', s),
    gap: (t) => { hearGap(t); },
    cue(c) {
      if (!c || !hearOk()) return null;
      if (Math.abs(c.m) > HT.maxOrder) return 'over';
      const r = htCue(c, glideOn());
      if (r === 'played') { HH.live.cue({ t: +c.t, m: Math.round(Math.abs(c.m)), zero: !!c.zero }); hearLog({ k: c.zero ? 'cue:zero' : 'cue:pole', t: c.t, m: c.m }); }
      return r;
    },
    query(q) {
      if (!q || !hearOk()) return false;
      const phi = +q.phi, ln = +q.ln;
      if (!Number.isFinite(phi) || Number.isNaN(ln)) return false;
      const at = ctx.currentTime + LEAD, c = 12 * (((phi % 1) + 1) % 1), db = HTL.law(ln);
      const end = glideOn() ? htQueryBowed(G, at, c, db, q.pan, 'sonify', 'hearq') : htNote(G, at, c, db, 0, q.pan, 'sonify', 'hearq', false);
      HH.lastOnset = at; busy(end); hearLog({ k: 'query', t: performance.now() / 1000, at, c, db });
      return true;
    },
    end: hearEnd,
    state() {
      const s = HH.live.state();
      return { mode: glideOn() ? 'glide' : 'notes', stroke: s.stroke, src: s.src, held: s.held, pend: s.pend, lastNote: s.lastNote, lastRep: s.lastRep, lastCrack: s.lastCrack,
        glide: { on: glEnvNow() >= 1, until: HH.gl.until, env: glEnvNow() }, counts: Object.assign({}, HH.counts) };
    },
    active: () => !!ctx && (ctx.currentTime - HH.lastOnset < HT.active || (glideOn() && glEnvNow() > 0.5)),
    log: (fn) => { HH.logFn = typeof fn === 'function' ? fn : null; },
  };
  // the declared limiter's placement: bus → [a 2 ms delay until the worklet loads, then cmw-limit, 12 ms crossfade]
  // → master; without a worklet a guarded DynamicsCompressorNode; a context without DelayNode keeps bus → master
  const LIM_CEIL = Math.pow(10, -8.8 / 20);
  function limitOn(g) {
    const Lm = g.limit; if (!Lm || Lm.node || Lm.comp) return;
    const c = g.c;
    if (g.worklet) { try { Lm.node = new AudioWorkletNode(c, 'cmw-limit', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { ceil: LIM_CEIL } }); } catch (e) { Lm.node = null; } }
    if (!Lm.node && c.createDynamicsCompressor) { try { const k = c.createDynamicsCompressor(); k.threshold.value = -8.8; k.knee.value = 0; k.ratio.value = 20; k.attack.value = 0.002; k.release.value = 0.15; Lm.comp = k; } catch (e) { Lm.comp = null; } }
    const nd = Lm.node || Lm.comp; if (!nd) return;
    Lm.lg = c.createGain(); Lm.lg.gain.value = 0; g.bus.connect(nd); nd.connect(Lm.lg); Lm.lg.connect(g.master);
    if (g.offline) { Lm.lg.gain.value = 1; Lm.dg.gain.value = 0; return; }
    const t = c.currentTime + LEAD;
    try { Lm.lg.gain.setValueCurveAtTime(FADE_UP, t, 0.012); Lm.dg.gain.setValueCurveAtTime(FADE_DN, t, 0.012); } catch (e) { Lm.lg.gain.value = 1; Lm.dg.gain.value = 0; }
  }
  function limitStat() {
    const nd = G && G.limit && G.limit.node;
    if (!nd || !nd.port) return Promise.resolve(null);
    return new Promise((res) => { const prev = nd.port.onmessage; let done = false; nd.port.onmessage = (e) => { if (done) return; done = true; nd.port.onmessage = prev; res(e.data); }; nd.port.postMessage('stat'); setTimeout(() => { if (!done) { done = true; res(null); } }, 500); });
  }

  // ---------------------------------------------------------------- settings
  function set(o, opts = {}) {
    const was = P.on, wasGlide = P.glide, wasSonify = P.sonify;
    for (const k in o) if (k in DEFAULTS && typeof o[k] === typeof DEFAULTS[k]) P[k] = k === 'vol' ? clamp(o[k], 0, 1) : o[k];
    save();
    if (P.on && !was) { activated = true; lastGesture = performance.now(); ensureNow(); applyGains(true); if (!opts.quiet) play('toggleOn', { force: true, grace: true }); }
    else if (!P.on && was && ctx) {
      // off is immediate and silent: the icon and aria-pressed confirm it
      hush();
      follow(ctx, G.master.gain, 0, 0.003);
      setTimeout(() => { if (!P.on && ctx && ctx.state === 'running') ctx.suspend().then(emit, () => {}); }, 60);
    } else applyGains();
    // a mode change, or Hear the function off: the stroke ends (the next call seats)
    if (P.glide !== wasGlide || (wasSonify && !P.sonify)) hearEnd();
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
  // (opts.noLimit: the graph without the declared limiter, whose 2 ms look-ahead delays everything: a cue's own envelope)
  async function render(fn, dur, opts = {}) {
    const rate = opts.rate || 48000, c = new OfflineAudioContext(2, Math.ceil(dur * rate), rate), g = graph(c, opts.vol != null ? opts.vol : 1, { allOn: true, noClip: opts.noClip, noLimit: opts.noLimit });
    g.offline = true; g.worklet = !opts.nodes && await loadWorklet(c); g.engine = g.worklet ? 'worklet' : 'nodes';
    if (g.worklet) g.synth = makeSynth(g);
    limitOn(g);
    fn(g, 0.01, c);
    for (const f of g.flush) f();
    return c.startRendering();
  }

  return {
    play, turn: (o = {}) => queued('turn', o), tick: (o = {}) => queued('contour', o), hush, stopTag,
    scrub, scrubEnd, scrubState: () => ({ v: SC.v, tex: SC.tex }), motion, motionEnd,
    harpAlong,
    harpStep, harpNote, pieceNote, Harp, cellOf, alongCount, curveAmps, singable, sing, singCmds, singOff, singState: () => ({ on: singOn, tier: singTier }),
    set, toggle: () => set({ on: !P.on }), prefs: () => ({ ...P }), state, subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    render, graph, cueTo, CATALOG, TRIM, MAT, LV, hNote, loadWorklet, prefer, lead: () => LEAD, pathStep, turns, LIB, WORKLET_SRC,
    hear, along, HT: HTL, htNote, htCrack,
    seed: (n) => { seedBase = n >>> 0; cueN = 0; }, cueHook: (f) => { cueHook = f || null; },
    stat: () => Promise.all([G && G.synth ? G.synth.stat() : Promise.resolve(null), limitStat()]).then(([a, b]) => (a || b ? Object.assign({}, a, { limit: b ? { actedPct: b.n ? 100 * b.acted / b.n : 0, minDb: 20 * Math.log10(b.minG) } : null }) : null)),
    debug: () => ({ ctx, G, activated, active: G ? G.active.size : 0, synth: !!(G && G.synth), queue: ctx ? { turn: Math.max(0, Q.turn.next - ctx.currentTime), contour: Math.max(0, Q.contour.next - ctx.currentTime) } : null }),
  };
})();
// the sound popover (page.html #sndPop) sits outside #app, which the app's walker translates: in another interface
// language its static strings are translated here, once, at load (src/i18n.js; English: nothing runs)
if (typeof document !== 'undefined' && typeof I18N !== 'undefined' && I18N.lang !== 'en') { const pop = document.getElementById('sndPop'); if (pop) I18N.applyStatic(pop); }
export { HT_LIB, SND_LIB, Sound };
