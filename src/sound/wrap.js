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
    const N = o.n || HT.n, RATE = o.rate || 1000, n = smp.length, T0s = n ? smp[0].t : 0, LOG = /** @type {any[] & { counts?: any }} */ ([]);
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
  // @parts: src/sound/NN-*.js go here, in order (build.py; test/src_text.js joins them the same way)
})();
// the sound popover (page.html #sndPop) sits outside #app, which the app's walker translates: in another interface
// language its static strings are translated here, once, at load (src/i18n.js; English: nothing runs)
if (typeof document !== 'undefined' && typeof I18N !== 'undefined' && I18N.lang !== 'en') { const pop = document.getElementById('sndPop'); if (pop) I18N.applyStatic(pop); }
export { HT_LIB, SND_LIB, Sound };
