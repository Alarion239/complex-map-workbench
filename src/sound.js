'use strict';
// Sound for Complex Map Workbench: the engine of notes/sound/prototype.html (revision 3, DESIGN §7 and §7.6), taken as
// it is. The app's hooks live in app.js (the "sound" block); the controls in page.html (#soundCtl, #sndPop).
// =====================================================================================================================
// Sound: the proposed src/sound.js. Web Audio synthesis only (no assets).
//   Revision 3 (click-free, DESIGN §7): the continuous voices are rendered sample by sample in an AudioWorklet (from a
//   Blob URL, else a data: URL); where neither is allowed, native nodes with anchored, append-only automation. No
//   cancelAndHoldAtTime anywhere: it was the source of the snaps heard while moving. An independent check (DESIGN §7.6)
//   then found two more snaps, both from stopping things while the pointer moves: Esc / hush stepped the bus back to 1
//   under a hover voice the moving pointer had re-gated, and stopping "Listen along" cut its buffer mid-waveform. Both
//   now fade on raised cosines; the voices' gate and duck start with zero slope.
//   On by default from v15 (Interface and Mathematical events; Snap ticks and Hear the function off), except on a test
//   page (?ns=), which stays off until a test turns it on; a stored choice always wins. The AudioContext is never
//   created at load: only after the user turns sound on, inside a gesture, or (when "on" is the default or was
//   remembered) inside the first activation gesture in this frame, so nothing plays before the first click or key. Nothing is ever queued while the
//   context is not running (one sound is allowed inside an active gesture, so "toggle on" is heard). Hidden tab:
//   silent and suspended. Preferences are per device (localStorage), never part of the saved or shared work.
// Tiers are split by WHAT TRIGGERS a cue, not by topic:
//   ui      Interface: a control the user operated (snap ticks are a separate switch, off by default)
//   events  Mathematical events: a deliberate action with mathematical content (deformation play / scrub, a loop
//           closed and its winding, listen along a curve)
//   sonify  Hear the function under the pointer (opt-in): the live voices and every cue driven by pointer position
//           (branch cut, zero/pole order, contour, turn bells, preimages collide)
// API: Sound.play(name, {pan, order, k, t, dir, pc, w, n, at, force, tier}) · Sound.turn({dir, pc, pan}) (count-bearing,
//      queued, never dropped silently) · Sound.tick({k, pan}) (contour, queued) · Sound.voice() · Sound.heightVoice()
//      Sound.curve(phi, lnAbs, dur, {bells, cuts, pc}) · Sound.hush() (Esc: stop everything now, setting unchanged)
//      Sound.set({on, vol, ui, snap, events, sonify}) · Sound.toggle() · Sound.prefs() · Sound.subscribe(fn)
//      Sound.state() · Sound.render(fn, dur) (offline, for tests) · Sound.CATALOG
//      Sound.pathStep(argStep, Fat, z0, T0, g0, z1, T1, g1, opts) · Sound.turns(L, ring) (the probe's arithmetic, pure)
// =====================================================================================================================
const Sound = (() => {
  // the app's lsk('cmw-sound'): a ?ns=name page (test tabs) keeps its own setting
  const NS = (() => { try { return new URLSearchParams(location.search).get('ns') || ''; } catch (e) { return ''; } })();
  const KEY = NS ? 'cmw-sound:' + NS : 'cmw-sound';
  const TIERS = ['ui', 'events', 'sonify'];
  // (v15, the user's defaults, notes/sound/README.md: sound on, Interface and Mathematical events on, Snap ticks and
  // Hear the function off. A ?ns= test page starts off, so the quality and perf suites stay silent unless a test turns
  // it on. These apply only when nothing is stored: a stored choice always wins.)
  const DEFAULTS = { on: !NS, vol: 0.7, ui: true, snap: false, events: true, sonify: false };
  const AC = window.AudioContext || window.webkitAudioContext;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // storage: a sandboxed frame without allow-same-origin throws on the mere access; then nothing is remembered
  let store = null;
  try { store = window.localStorage; store.getItem(KEY); } catch (e) { store = null; }
  const P = Object.assign({}, DEFAULTS);
  try {
    const s = store && JSON.parse(store.getItem(KEY) || 'null');
    if (s && typeof s === 'object') for (const k in DEFAULTS) if (typeof s[k] === typeof DEFAULTS[k]) P[k] = s[k];
  } catch (e) { /* corrupt: defaults */ }
  const save = () => { try { if (store) store.setItem(KEY, JSON.stringify(P)); } catch (e) { /* not remembered */ } };

  let ctx = null, G = null, hidden = document.visibilityState === 'hidden', activated = false, idleTimer = 0, lastGesture = -1e9, graceUsed = false;
  const subs = new Set();
  const state = () => ({ ...P, supported: !!AC, remembered: !!store, audio: ctx ? ctx.state : 'none', rate: ctx ? ctx.sampleRate : 0,
    latency: ctx ? (ctx.baseLatency || 0) + (ctx.outputLatency || 0) : 0, hidden, engine: G ? G.engine : 'none' });
  // (tests) prefer.worklet = false: the native-node voices in a live context too
  const prefer = { worklet: true };
  const emit = () => { const s = state(); for (const f of subs) { try { f(s); } catch (e) { /* a subscriber's bug is not ours */ } } };
  // a click or key in this page load (our own listeners), and the browser agrees the frame is activated: only then is a
  // context created or resumed. (Chrome keeps a frame's sticky activation across a reload; a remembered "on" still
  // waits for a gesture on the new page.)
  const mayStart = () => activated && (navigator.userActivation ? navigator.userActivation.hasBeenActive : true);
  const inGesture = () => (navigator.userActivation ? navigator.userActivation.isActive : performance.now() - lastGesture < 1000);

  // ---------------------------------------------------------------- graph
  // voices → (stereo panner, always) → tier (dry, and a send to a small synthetic room) → bus (hush) → master (volume)
  // → safety soft clip → speakers
  function graph(c, vol, opts = {}) {
    const master = c.createGain(); master.gain.value = vol;
    if (opts.noClip) master.connect(c.destination);
    else { const clip = c.createWaveShaper(); clip.curve = SOFTCLIP; clip.oversample = '2x'; master.connect(clip); clip.connect(c.destination); }
    const bus = c.createGain(); bus.connect(master);
    const room = c.createConvolver(); room.buffer = roomIR(c);
    // normalize = true scales this IR to about −12 dB; wet 2.0 puts the tail of a bell ~15–18 dB under its direct
    // sound (keys ≥ 28 dB): audible as a short dark ring, not as an effect
    const wet = c.createGain(); wet.gain.value = 2.0; room.connect(wet); wet.connect(bus);
    const tier = {};
    for (const k of TIERS) {
      const dry = c.createGain(), send = c.createGain(), on = opts.allOn || P[k] ? 1 : 0;
      dry.gain.value = on; send.gain.value = on; dry.connect(bus); send.connect(room);
      tier[k] = { dry, wet: send };
    }
    // the audition bus (a settings preview, the sound board): always open, still behind the master switch
    const ad = c.createGain(), aw = c.createGain(); ad.connect(bus); aw.connect(room);
    const aud = { dry: ad, wet: aw };
    const g = { c, master, bus, tier, noise: noiseBuf(c), active: new Set(), worklet: false, engine: 'loading', offline: false, flush: [] };
    g.audition = { c, master, bus, tier: { ui: aud, events: aud, sonify: aud }, noise: g.noise, active: g.active };
    return g;
  }
  // linear below 0.5 (−6 dBFS), a tanh knee above, never beyond 0.834 (−1.6 dBFS)
  // raised-cosine fades (zero slope at both ends) for the hush and for stopping "listen along"
  const FADE_DN = (() => { const n = 64, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = 0.5 + 0.5 * Math.cos(Math.PI * i / (n - 1)); return a; })();
  const FADE_UP = FADE_DN.slice().reverse();
  const SOFTCLIP = (() => { const n = 4097, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = 2 * i / (n - 1) - 1, m = Math.abs(x); a[i] = m < 0.5 ? x : Math.sign(x) * (0.5 + 0.39 * Math.tanh((m - 0.5) / 0.39)); } return a; })();
  function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function noiseBuf(c) { const n = c.sampleRate, b = c.createBuffer(1, n, n), d = b.getChannelData(0), r = prng(11); for (let i = 0; i < n; i++) d[i] = 2 * r() - 1; return b; }
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

  // ---------------------------------------------------------------- primitives
  // attack (linear), exponential decay to −60 dB in t60, then a linear ramp to exactly 0: clickless at both ends
  function env(p, t, peak, att, t60, hold = 0) {
    p.setValueAtTime(0, t);
    p.linearRampToValueAtTime(peak, t + att);
    if (hold) p.setValueAtTime(peak, t + att + hold);
    p.exponentialRampToValueAtTime(peak * 1e-3, t + att + hold + t60);
    p.linearRampToValueAtTime(0, t + att + hold + t60 + 0.01);
    return t + att + hold + t60 + 0.02;
  }
  const track = (G, src) => { G.active.add(src); src.onended = () => G.active.delete(src); };
  // a cue's output: ALWAYS through an equal-power panner (so pan 0 and pan 0.001 have the same level; cues capped at
  // ±0.4, about −6 dB in the far ear), dry into its tier, a send into the room. Without StereoPanner: mono at −3 dB,
  // the panner's centre level.
  function out(G, T, pan = 0, wet = 0, cap = 0.4) {
    const c = G.c, inp = c.createGain();
    let node = inp;
    if (c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan || 0, -cap, cap); inp.connect(p); node = p; inp.panner = p; }
    else inp.gain.value = Math.SQRT1_2;
    node.connect(G.tier[T].dry);
    if (wet) { const s = c.createGain(); s.gain.value = wet; node.connect(s); s.connect(G.tier[T].wet); }
    return inp;
  }
  function tone(G, dest, t, f, amp, o = {}) {
    const c = G.c, osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(f, t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || 0.06));
    const end = env(g.gain, t, amp, o.att || 0.003, o.t60 || 0.15, o.hold || 0);
    let node = osc;
    if (o.lp) {
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = o.lpQ || 0.4;
      lp.frequency.setValueAtTime(o.lp, t); if (o.lp1) lp.frequency.exponentialRampToValueAtTime(o.lp1, t + (o.lpT || 0.3));
      osc.connect(lp); node = lp;
    }
    node.connect(g); g.connect(dest);
    osc.start(t); osc.stop(end); track(G, osc);
    return end;
  }
  // a C¹ envelope (no corner anywhere: a sin² rise to the peak, then a decay whose slope starts at 0, a cos² taper to
  // exactly 0), as one value curve: for the scrub's detents and keys, which repeat while dragging (v15.1)
  function softEnv(p, t, peak, rise, t60) {
    const ts = rise / 2, dur = rise + t60 + ts, n = 256, a = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = dur * i / (n - 1), y = x - rise, z = (x - 0.8 * dur) / (0.2 * dur);
      let v = x < rise ? Math.pow(Math.sin(0.5 * Math.PI * x / rise), 2) : Math.pow(10, -3 * (y - ts * (1 - Math.exp(-y / ts))) / t60);
      if (z > 0) v *= Math.pow(Math.cos(0.5 * Math.PI * Math.min(1, z)), 2);
      a[i] = peak * v;
    }
    a[n - 1] = 0;
    p.value = 0; p.setValueCurveAtTime(a, t, dur);
    return t + dur + 0.005;
  }
  function softTone(G, dest, t, f, amp, rise, t60) {
    const c = G.c, osc = c.createOscillator(), g = c.createGain();
    osc.frequency.setValueAtTime(f, t);
    const end = softEnv(g.gain, t, amp, rise, t60);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(end); track(G, osc);
    return end;
  }
  let noiseOff = 0;
  // band-passed noise; f1: the band sweeps exponentially to f1 over `sweep` s
  function burst(G, dest, t, fc, q, amp, t60, o = {}) {
    const c = G.c, src = c.createBufferSource(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g = c.createGain();
    src.buffer = G.noise; bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(fc, t); if (o.f1) bp.frequency.exponentialRampToValueAtTime(o.f1, t + o.sweep);
    lp.type = 'lowpass'; lp.frequency.value = Math.min(6500, 1.9 * Math.max(fc, o.f1 || 0)); lp.Q.value = 0.5;
    const end = env(g.gain, t, amp, o.att || 0.0008, t60, o.hold || 0);
    src.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest);
    noiseOff = (noiseOff + 0.1373) % 0.85;
    src.start(t, noiseOff); src.stop(end); track(G, src);
    return end;
  }
  // UI "key": a sine with a breath of 2nd and 3rd harmonic that die sooner
  function key(G, d, t, f, amp, t60 = 0.13) {
    return Math.max(tone(G, d, t, f, amp, { t60 }), tone(G, d, t, 2 * f, amp * 0.16, { t60: t60 * 0.55 }), tone(G, d, t, 3 * f, amp * 0.05, { t60: t60 * 0.35 }));
  }
  // glass/bell: inharmonic partials 1, 2.76, 5.40 (a struck bar) with shorter decays up the series; partials above
  // 0.45·fs are left out (16 and 22.05 kHz contexts: Bluetooth hands-free, some Android devices)
  function bell(G, d, t, f, amp, t60 = 0.6) {
    const ny = 0.45 * G.c.sampleRate;
    let e = tone(G, d, t, f, amp, { t60, att: 0.002 });
    if (2.756 * f < ny) e = Math.max(e, tone(G, d, t, 2.756 * f, amp * 0.24, { t60: t60 * 0.45, att: 0.002 }));
    if (5.404 * f < ny) e = Math.max(e, tone(G, d, t, 5.404 * f, amp * 0.06, { t60: t60 * 0.2, att: 0.002 }));
    return e;
  }
  // wood: a lowpassed triangle, short
  const wood = (G, d, t, f, amp, t60 = 0.09, lp = 1100) => tone(G, d, t, f, amp, { type: 'triangle', lp, t60, att: 0.003 });

  // the palette: D major pentatonic around D4 (D E F♯ A B). While a live Shepard voice sounds, pitched events/sonify
  // cues are transposed by XF to the voice's current chroma (≤ ±6 semitones), so they form a consonance with it.
  let XF = 1;
  const D4 = 293.665, st0 = (n) => D4 * Math.pow(2, n / 12), st = (n) => XF * st0(n);
  const PENTA = [0, 2, 4, 7, 9], penta0 = (k) => st0(12 + 12 * Math.floor(k / 5) + PENTA[((k % 5) + 5) % 5]), penta = (k) => XF * penta0(k);
  // the Height scale: one contour of |F| = one pentatonic step; |F| = 1 is D5; A3 … A6 (clamped beyond)
  const HMIN = -7, HMAX = 8;
  const hNote = (u) => { const uc = clamp(u, HMIN, HMAX), j = Math.min(HMAX - 1, Math.floor(uc)), a = uc - j; return penta0(j) * Math.pow(penta0(j + 1) / penta0(j), a); };

  // ---------------------------------------------------------------- the catalog
  // tier, minimum gap between two starts (ms), label, what it means, the recipe; make(G, t, o) returns the end time
  const CATALOG = {
    // Interface: dry, small, wood and plastic
    snap: { tier: 'ui', gap: 125, label: 'Snap', what: 'The pointer settled on a grid point (separate switch, off by default)', recipe: 'noise band-passed at 1.9 kHz, Q 1.4, 25 ms',
      make: (G, t, o) => burst(G, out(G, 'ui', o.pan, 0), t, 1900, 1.4, 0.48, 0.025) },
    toggleOn: { tier: 'ui', gap: 60, label: 'Toggle on', what: 'A switch or option turned on', recipe: 'key A5',
      make: (G, t, o) => key(G, out(G, 'ui', o.pan, 0.04), t, st0(19), 0.20) },
    toggleOff: { tier: 'ui', gap: 60, label: 'Toggle off', what: 'A switch or option turned off', recipe: 'key E5, shorter',
      make: (G, t, o) => key(G, out(G, 'ui', o.pan, 0.04), t, st0(14), 0.21, 0.1) },
    stepAdd: { tier: 'ui', gap: 80, label: 'Add a step', what: 'A function joined the chain', recipe: 'keys D5 then A5, 55 ms apart',
      make: (G, t, o) => { const d = out(G, 'ui', o.pan, 0.05); return Math.max(key(G, d, t, st0(12), 0.16), key(G, d, t + 0.055, st0(19), 0.18)); } },
    stepRemove: { tier: 'ui', gap: 80, label: 'Remove a step', what: 'A function left the chain', recipe: 'keys A5 then D5',
      make: (G, t, o) => { const d = out(G, 'ui', o.pan, 0.05); return Math.max(key(G, d, t, st0(19), 0.17), key(G, d, t + 0.055, st0(12), 0.15, 0.11)); } },
    view: { tier: 'ui', gap: 80, label: 'Switch view', what: 'X → Y, Phase, Landscape: a degree of the scale each', recipe: 'soft tick and key D5 / F♯5 / A5',
      make: (G, t, o) => { const d = out(G, 'ui', o.pan, 0.03), i = clamp(o.k | 0, 0, 3); return Math.max(burst(G, d, t, 2200, 1.2, 0.2, 0.02), key(G, d, t + 0.004, st0([12, 16, 19, 21][i]), 0.24, 0.09)); } },
    exportDone: { tier: 'ui', gap: 300, label: 'Export ready', what: 'A figure or file is ready', recipe: 'a swish (noise swept 1 → 3 kHz, 120 ms), then key A5: "written"',
      make: (G, t, o) => { const d = out(G, 'ui', o.pan, 0.03); return Math.max(burst(G, d, t, 1000, 2.2, 0.24, 0.06, { f1: 3000, sweep: 0.12, att: 0.05, hold: 0.04 }), key(G, d, t + 0.13, st0(19), 0.25, 0.16)); } },
    error: { tier: 'ui', gap: 250, label: 'Error', what: 'Something could not be done (with the message)', recipe: 'two wooden D4 knocks with a 1.2 kHz body and a D5 overtone (survives phone speakers)',
      make: (G, t, o) => {
        const d = out(G, 'ui', o.pan, 0.03); let e = t;
        for (const [u, a] of [[0, 1], [0.075, 0.85]]) e = Math.max(e, wood(G, d, t + u, st0(0), 0.18 * a, 0.09, 2000), burst(G, d, t + u, 1200, 3, 0.5 * a, 0.05), tone(G, d, t + u, st0(12), 0.22 * a, { t60: 0.09, att: 0.002 }));
        return e; } },
    edge: { tier: 'ui', gap: 150, label: 'Edge', what: 'The keyboard probe reached the edge of the view', recipe: 'a soft wooden A5 knock with a 1.5 kHz contact',
      make: (G, t, o) => Math.max(wood(G, out(G, 'ui', o.pan, 0.02), t, st0(19), 0.16, 0.07, 2600), burst(G, out(G, 'ui', o.pan, 0), t, 1500, 2, 0.14, 0.015)) },

    // Mathematical events: deliberate actions; bells and glass, a small room
    morphStart: { tier: 'events', gap: 200, label: 'Deformation plays', what: 'H_t starts from t = 0 (once per play you start; never on loop repeats)', recipe: 'D5 + A5 swell (triangles), low-pass opening 700 Hz → 3.5 kHz over 0.3 s',
      make: (G, t, o) => { const d = out(G, 'events', o.pan, 0.15); return Math.max(tone(G, d, t, st(12), 0.075, { type: 'triangle', att: 0.09, t60: 0.5, lp: 700, lp1: 3500, lpT: 0.3, lpQ: 0.7 }), tone(G, d, t, st(19), 0.06, { type: 'triangle', att: 0.11, t60: 0.5, lp: 700, lp1: 3500, lpT: 0.3, lpQ: 0.7 })); } },
    // (v15.1: the v15 tick, a noise burst with a 0.8 ms attack, every 0.05 of t, made a 17-a-second rattle on a fast
    // drag, which the user heard as "cracking". Now scrub() below decides: detents only while the drag is slow, o.g
    // their weight; a fast drag is a soft continuous band instead. AS-BUILT.md "Scrub")
    morphTick: { tier: 'events', gap: 40, label: 'Deformation scrub', what: 'Dragging t slowly: a soft detent every 0.05 of t; t = 0, ½, 1 are soft keys D5, A5, D6. Dragging fast: no detents, a soft band of noise that follows the speed', recipe: 'detent: a small wooden tock (sine 1.0 → 1.4 kHz over t with a bar partial, 3 ms sin² rise, no corner in its envelope, each one ±3 % in pitch and ±1.5 dB); landmark: a sine key, 8 ms rise',
      make: (G, t, o) => {
        const d = out(G, 'events', o.pan, 0.04), u = clamp(+o.t || 0, 0, 1), q = Math.round(u * 2), mark = Math.abs(u * 2 - q) < 1e-6, ends = mark && q !== 1;
        const g = o.g == null ? 1 : clamp(+o.g, 0, 1), r1 = scrubRnd(), r2 = scrubRnd();
        let e = t;
        if (g > 0.02) {
          const f = 1000 * Math.pow(2, 0.5 * u) * (1 + 0.06 * (r1 - 0.5)), a = 0.075 * g * Math.pow(10, 1.5 * (r2 - 0.5) / 10);
          e = Math.max(softTone(G, d, t, f, a, 0.003, 0.04), softTone(G, d, t, 2.756 * f, 0.18 * a, 0.003, 0.018));
        }
        if (mark) e = Math.max(e, softTone(G, d, t, st([12, 19, 24][q]), ends ? 0.05 : 0.042, 0.008, ends ? 0.22 : 0.12), softTone(G, d, t, 2 * st([12, 19, 24][q]), ends ? 0.006 : 0.005, 0.008, 0.06));
        return e; } },
    morphEnd: { tier: 'events', gap: 300, label: 'Deformation arrives', what: 'H_t reached t = 1 (once per play you start)', recipe: 'glass D6 and F♯6',
      make: (G, t, o) => { const d = out(G, 'events', o.pan, 0.2); return Math.max(bell(G, d, t, st(24), 0.075, 0.8), bell(G, d, t + 0.03, st(28), 0.055, 0.8)); } },
    loopDone: { tier: 'events', gap: 200, label: 'Loop closed', what: 'Its winding number W as |W| pings, rising for W > 0, falling for W < 0; W = 0 a single soft knock', recipe: 'glass pings on the pentatonic, 125 ms apart, the first accented; > 8: a flourish',
      make: (G, t, o) => {
        const d = out(G, 'events', o.pan, 0.2), w = o.w | 0, n = Math.min(8, Math.abs(w));
        if (!w) return Math.max(wood(G, d, t, st(19), 0.15, 0.1, 2600), burst(G, d, t, 1500, 2, 0.1, 0.012));
        let e = t;
        for (let j = 0; j < n; j++) e = Math.max(e, bell(G, d, t + 0.125 * j, penta(w > 0 ? 5 + j : 5 - j), j ? 0.08 : 0.113, 0.35));
        if (Math.abs(w) > 8) e = Math.max(e, many(G, d, t + 0.125 * n, w > 0 ? 1 : -1));
        return e; } },

    // Hear the function under the pointer (opt-in): pointer-driven cues
    cut: { tier: 'sonify', gap: 120, label: 'Branch cut', what: 'The probe crossed a branch cut: F jumps there', recipe: 'a double tick stepping down, 3.2 then 2.0 kHz',
      make: (G, t, o) => { const d = out(G, o.tier || 'sonify', o.pan, 0.05); return Math.max(burst(G, d, t, 3200, 2.2, 0.52, 0.022), burst(G, d, t + 0.024, 2000, 2.2, 0.52, 0.03)); } },
    zero: { tier: 'sonify', gap: 250, label: 'Zero', what: 'The probe reached a zero; one ping per order (found by the argument principle on a small circle)', recipe: 'bell D6 × m; 110 ms apart (150 ms for m ≥ 3); the first +3 dB',
      make: (G, t, o) => { const d = out(G, 'sonify', o.pan, 0.2), m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.11; let e = t; for (let j = 0; j < m; j++) e = Math.max(e, bell(G, d, t + sp * j, st(24), j ? 0.092 : 0.13, 0.45)); return e; } },
    pole: { tier: 'sonify', gap: 250, label: 'Pole', what: 'The probe reached a pole; one thump per order', recipe: 'felt thump A4 → A3 with its octave at −6 dB and a 1.5 kHz felt contact, × m',
      make: (G, t, o) => {
        const d = out(G, 'sonify', o.pan, 0.12), m = clamp(o.order | 0 || 1, 1, 6), sp = m >= 3 ? 0.15 : 0.12; let e = t;
        for (let j = 0; j < m; j++) { const u = t + sp * j, a = j ? 1 : 1.41; e = Math.max(e, tone(G, d, u, st(7), 0.15 * a, { f1: st(-5), glide: 0.05, t60: 0.16, att: 0.003 }), tone(G, d, u, st(19), 0.125 * a, { f1: st(7), glide: 0.05, t60: 0.12, att: 0.003 }), burst(G, d, u, 1500, 2, 0.38 * a, 0.03)); }
        return e; } },
    dense: { tier: 'sonify', gap: 600, label: 'Many zeros or poles', what: 'More than two zeros/poles entered within 300 ms (a cluster): one quiet cue, then 600 ms of silence for them', recipe: 'three quiet glass ticks D6 E6 F♯6, 40 ms apart',
      make: (G, t, o) => { const d = out(G, 'sonify', o.pan, 0.15); let e = t; for (let j = 0; j < 3; j++) e = Math.max(e, bell(G, d, t + 0.04 * j, penta(5 + j), 0.03, 0.2)); return e; } },
    contour: { tier: 'sonify', gap: 0, label: 'Contour', what: 'The probe crossed a level line of |F| (Height): the tone\'s own note, an octave up', recipe: 'organ tick on the level\'s step of the Height scale, one octave up',
      make: (G, t, o) => { const d = out(G, 'sonify', o.pan, 0.03), f = 2 * hNote(clamp(o.k | 0, HMIN, HMAX)); return Math.max(tone(G, d, t, f, 0.10, { t60: 0.07, att: 0.002 }), tone(G, d, t, 2 * f, 0.05, { t60: 0.05, att: 0.002 }), tone(G, d, t, 3 * f, 0.03, { t60: 0.04, att: 0.002 }), burst(G, d, t, Math.min(5000, Math.max(1500, 2 * f)), 2, 0.09, 0.012)); } },
    turn: { tier: 'sonify', gap: 0, label: 'One full turn', what: 'arg F completed a turn and is "home": the loop\'s starting pitch class, two octaves above the tone; approached from below (up) or above (down)', recipe: 'a grace note a fifth below (up) or a fourth above (down), then glass on the home pitch class at 1.7–3.4 kHz',
      make: (G, t, o) => {
        const d = out(G, o.tier || 'sonify', o.pan, 0.2), up = (o.dir || 1) > 0;
        let f = SH.fLo * Math.pow(2, ((o.pc || 0) % 1 + 1) % 1); while (f < 1700) f *= 2;
        const g = up ? f * 2 / 3 : f * 4 / 3;
        return Math.max(bell(G, d, t, g, 0.045, 0.12), bell(G, d, t + 0.045, f, 0.105, 0.5)); } },
    turnMany: { tier: 'sonify', gap: 0, label: 'Many turns', what: 'More turns than can be counted live (> 8 queued): the count is shown, announced and played back exactly', recipe: 'a quick run of five glass notes, up or down',
      make: (G, t, o) => many(G, out(G, o.tier || 'sonify', o.pan, 0.2), t, (o.dir || 1) > 0 ? 1 : -1) },
    collide: { tier: 'sonify', gap: 300, label: 'Preimages collide', what: 'w crossed a critical value: two preimages merged (a preimage of multiplicity ≥ 2), never a count change at the view\'s edge', recipe: 'two glass tones a whole tone apart gliding into one',
      make: (G, t, o) => { const d = out(G, 'sonify', o.pan, 0.15), f = st(19); return Math.max(tone(G, d, t, f * Math.pow(2, 2 / 12), 0.08, { f1: f, glide: 0.18, t60: 0.5, att: 0.01 }), tone(G, d, t, f / Math.pow(2, 2 / 12), 0.08, { f1: f, glide: 0.18, t60: 0.5, att: 0.01 })); } },
  };
  function many(G, d, t, dir) { let e = t; for (let j = 0; j < 5; j++) e = Math.max(e, bell(G, d, t + 0.035 * j, penta(dir > 0 ? 5 + j : 9 - j), 0.035, 0.18)); return e; }
  // the detents' small variation (no two alike: a repeated identical sample is what makes a train sound mechanical)
  const scrubRnd = prng(29);

  // ---------------------------------------------------------------- lifecycle
  // Click-free scheduling (revision 3; DESIGN §7). Revision 2 clicked while the pointer moved: its ramp() was
  // cancelAndHoldAtTime(t) + linearRampToValueAtTime(v, t + d), per partial, per pointer event. When the previous ramp
  // had already ended at t (about every other event), there was nothing to cancel, so no anchor was inserted (as the
  // spec says) and the new ramp started from the previous event, in the past: the value jumped (offline, exactly on the
  // render clock: by up to 75 % of the ramp's range; live: up to 130 snaps a second, as loud as the voice). Now:
  //   1. the continuous voices are rendered in an AudioWorklet from per-sample-smoothed controls (a late message only
  //      adds latency); without one, native nodes with anchored, append-only automation in the future (Lane);
  //   2. every other param (volume, tiers, bus, duck, pan) only ever gets target curves started at now + LEAD (follow);
  //   3. a one-shot starts at now + LEAD, so its anchored attack never begins in the past.
  // LEAD: measured in Chrome with 256-frame callbacks, a step at currentTime + 6 ms still landed up to 2 ms late; at
  // ≥ 10 ms never (0 of 352): twice the callback period, at least 12 ms.
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
      // the voices' worklet loads in the background; until it is there (or where it is refused) voices use native nodes
      if (prefer.worklet) { const g = G; loadWorklet(ctx).then((ok) => { g.worklet = ok; g.engine = ok ? 'worklet' : 'nodes'; emit(); }); } else G.engine = 'nodes';
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
  // activation events (HTML: keydown, mousedown/pointerdown for a mouse, pointerup/touchend for touch, click)
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
    idleTimer = setTimeout(() => { if (ctx && ctx.state === 'running' && !liveVoices.size && !G.active.size) ctx.suspend().then(emit, () => {}); }, ms);
  }

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
    const t = ctx.currentTime + LEAD + (o.at || 0);
    const ch = tier !== 'ui' && !o.audition ? liveChroma(t) : null;
    XF = ch == null ? 1 : Math.pow(2, ch - Math.round(ch));
    let end;
    try { end = d.make(o.audition ? G.audition : G, t, o); } finally { XF = 1; }
    // the live voices give way: −6 dB for the cue's first 250 ms
    for (const v of liveVoices) v.duck(t, Math.min(0.25, end - t));
    touchIdle();
    return true;
  }
  // count-bearing cues are never dropped silently: they queue on the audio clock (turn bells ≤ 8/s; contour ticks
  // ≤ 12/s). Beyond 8 queued bells one "many turns" flourish plays and the exact count is shown, announced and played
  // back; contour ticks beyond 0.5 s of backlog coalesce (the Height tone itself is the staircase, one step a contour).
  // q.due: when each queued cue sounds (its slot + LEAD, as play() schedules it), oldest first
  const Q = { turn: { next: 0, gap: 0.125, cap: 8, many: 0, due: [] }, contour: { next: 0, gap: 0.083, cap: 6, many: 0, due: [] } };
  function queued(name, o) {
    if (!AC || !P.on || hidden || !P[o.tier || 'sonify'] || !canSchedule(false)) return false;
    const q = Q[name], now = ctx.currentTime, at = Math.max(now, q.next);
    // "beyond cap queued" counts the cues that have not sounded yet. (The check was at − now ≥ cap · gap. The audio
    // clock moves by whole render quanta, 5.3 ms at 48 kHz, even during one burst of calls: then the first bell, still
    // LEAD ahead, counted as played, and 12 turns gave 9 bells.) The flourish waits in the queue like a bell, and there
    // is one per backlog: another only after the pending one has played.
    while (q.due.length && q.due[0] <= now) q.due.shift();
    if (q.due.length >= q.cap) {
      if (name === 'turn' && !(q.many > now)) { q.many = q.next; play('turnMany', Object.assign({}, o, { at: q.next - now, force: true })); q.due.push(q.next + LEAD); q.next += 0.25; }
      return 'coalesced';
    }
    q.next = at + q.gap; q.due.push(at + LEAD);
    return play(name, Object.assign({}, o, { at: at - now, force: true }));
  }

  // ---------------------------------------------------------------- the deformation scrub (v15.1)
  // scrub(u0, u1): the slider moved t / its length from u0 to u1 (every input event). The speed, in detents (0.05 of
  // t) a second, is smoothed over 60 ms. Slow (≤ 3 a second): a soft detent at each 0.05 of t. Fast (≥ 6 a second):
  // no detents; a soft band of noise whose level and brightness follow the speed, as a finger sliding on a fine-
  // toothed surface sounds louder and brighter the faster it goes (Gaver's scraping). Between: a crossfade.
  // t = 0, ½ and 1 play a soft key at any speed, each at most once in 250 ms. An input after 150 ms of rest (a click
  // on the track, an arrow key) is a step: one detent, never speed. The band: looped noise → band-pass → low-pass →
  // two gains → events tier; each swell is a new band that rises exponentially (0.2 s from −80 dB), and fades 70 ms
  // after the last input or as soon as the drag slows to ≤ 3 detents a second, then is stopped (at −170 dB).
  const SCR = { pn: -1e9, v: 0, tex: null, rel: 0, mark: [-1e9, -1e9, -1e9] }, SR1 = 3, SR2 = 6;
  function scrub(u0, u1) {
    u0 = clamp(+u0 || 0, 0, 1); u1 = clamp(+u1 || 0, 0, 1);
    const now = performance.now(), dt = now - SCR.pn;
    SCR.pn = now;
    if (dt > 150) SCR.v = 0;
    else if (dt > 0.5) SCR.v += (Math.abs(u1 - u0) * 20000 / dt - SCR.v) * (1 - Math.exp(-dt / 60));
    if (!AC || !P.on || hidden || !P.events) return false;
    const d0 = Math.round(u0 * 20), d1 = Math.round(u1 * 20), v = SCR.v;
    let made = false;
    if (d1 !== d0) {
      const w = v <= SR1 ? 1 : v >= SR2 ? 0 : (SR2 - v) / (SR2 - SR1);
      // the landmark crossed on the way from d0 to d1 (the one nearest d1)
      let L = -1;
      for (const m of [0, 10, 20]) if (d1 > d0 ? m > d0 && m <= d1 : m < d0 && m >= d1) if (L < 0 || Math.abs(m - d1) < Math.abs(L - d1)) L = m;
      if (L >= 0 && now - SCR.mark[L / 10] >= 250) { SCR.mark[L / 10] = now; made = play('morphTick', { t: L / 20, g: L === d1 ? w : 0, force: true }); }
      else if (w > 0.02) made = play('morphTick', { t: d1 / 20, g: w });
    }
    scrubBand(u1, v);
    return made;
  }
  function scrubBand(u, v) {
    const lv = v <= SR1 ? 0 : Math.pow(clamp((v - SR1) / 30, 0, 1), 0.6);
    let x = SCR.tex;
    if (x && x.G !== G) x = SCR.tex = null;
    if (!lv) { if (x) bandRelease(x); return; }
    if (!canSchedule(false)) return;
    const c = ctx;
    if (!x) {
      // a new swell: g2 rises exponentially from −80 dB over 0.2 s (never faster than 20 dB in 50 ms, so even an
      // onset is a swell, not an edge), g1 carries the level
      const src = c.createBufferSource(), bp = c.createBiquadFilter(), lp = c.createBiquadFilter(), g1 = c.createGain(), g2 = c.createGain(), T = c.currentTime + LEAD;
      src.buffer = G.noise; src.loop = true;
      bp.type = 'bandpass'; bp.Q.value = 0.8; bp.frequency.value = 650 * Math.pow(2, 0.8 * u);
      lp.type = 'lowpass'; lp.frequency.value = 2600; lp.Q.value = 0.5;
      g1.gain.value = 0; g2.gain.value = 0;
      g2.gain.setValueAtTime(1e-4, T); g2.gain.exponentialRampToValueAtTime(1, T + 0.2);
      src.connect(bp); bp.connect(lp); lp.connect(g1); g1.connect(g2); g2.connect(out(G, 'events', 0, 0.03));
      noiseOff = (noiseOff + 0.1373) % 0.85;
      src.start(T, noiseOff);
      G.active.add(src);
      x = SCR.tex = { G, src, bp, g1, g2 };
      src.onended = () => { G.active.delete(src); if (SCR.tex === x) SCR.tex = null; };
    }
    follow(c, x.g1.gain, 0.09 * lv, 0.03);
    follow(c, x.bp.frequency, 650 * Math.pow(2, 0.8 * u) * (1 + 0.5 * lv), 0.05);
    clearTimeout(SCR.rel);
    SCR.rel = setTimeout(() => { SCR.v = 0; bandRelease(x); }, 70);
    touchIdle();
  }
  // the drag stopped or slowed: the band fades (both gains, τ 40 ms each) and is stopped 0.8 s later, at −170 dB
  function bandRelease(x) {
    if (SCR.tex === x) SCR.tex = null;
    if (x.rel) return;
    x.rel = true;
    const c = x.G.c;
    follow(c, x.g1.gain, 0, 0.04); follow(c, x.g2.gain, 0, 0.04);
    try { x.src.stop(c.currentTime + LEAD + 0.8); } catch (e) { /* stopped */ }
  }

  // ---------------------------------------------------------------- sonification voices
  // Shepard:N partials an octave apart, f = fLo · 2^pos, pos ∈ [0, N); a bell over pos (centre c, σ) fixes the timbre.
  // arg F in turns moves every pos by the same amount, so one turn moves each partial into its upper neighbour's place:
  // pitch class = arg F, seamlessly. fLo = D1, so arg F = 0 (F positive real) sounds D, the palette's tonic.
  // The bell is a Gaussian times a taper that is exactly 0, with zero slope, at both band edges (sin² over the outer
  // half octave, where the Gaussian is already below −52 dB): a partial leaving the top re-enters at the bottom at
  // exactly zero gain, so the wrap is inaudible by construction.
  // ln|F| moves the bell a little (±0.3 octave: "register", log F on the pitch helix) and the loudness from 60 % to
  // 100 %; the chroma climb, which carries the winding number, stays dominant.
  const SH = { N: 9, fLo: 36.70810, sigma: 0.95, c0: 4.1, swing: 0.3, amp: 0.028, edge: 0.5 };
  const lnc = (x) => Number.isFinite(x) ? x : (x > 0 ? 50 : -50);
  const shG = (pos, c) => { const d = (pos - c) / SH.sigma; return Math.exp(-0.5 * d * d); };
  const shTaper = (p) => { if (p <= 0 || p >= SH.N) return 0; const e = Math.min(p, SH.N - p); if (e >= SH.edge) return 1; const s = Math.sin(0.5 * Math.PI * e / SH.edge); return s * s; };
  const shBell = (pos, c) => shG(pos, c) * shTaper(pos);
  // partials fade out between 0.40 and 0.45 · fs (16 and 22.05 kHz contexts) instead of being cut
  const nyq = (f, fs) => { const r = f / fs; return r <= 0.40 ? 1 : r >= 0.45 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (r - 0.40) / 0.05); };
  const shCentre = (lnAbs) => SH.c0 + SH.swing * Math.tanh(lnc(lnAbs) / 2.5);
  const shLoud = (lnAbs) => 0.6 + 0.4 / (1 + Math.exp(-1.3 * (lnc(lnAbs) + 1)));
  const liveVoices = new Set(), Gl = () => G;
  let chromaVoice = null;
  const liveChroma = (t) => (chromaVoice && chromaVoice.sounding() ? chromaVoice.chroma(t) : null);
  // the Height voice's organ: harmonics 1–4 at 1/n, normalised to a peak of 1 (as createPeriodicWave does)
  const ORGAN = [1, 1 / 2, 1 / 3, 1 / 4];
  const ORGAN_NORM = (() => { let m = 0; for (let i = 0; i < 4096; i++) { const a = 2 * Math.PI * i / 4096; let s = 0; for (let n = 0; n < 4; n++) s += ORGAN[n] * Math.sin((n + 1) * a); m = Math.max(m, Math.abs(s)); } return 1 / m; })();

  // ---- the voices' AudioWorklet: every sample computed from per-sample-smoothed controls. Commands are time-stamped
  // ({at} in seconds of the context's clock) and applied at that sample, or on arrival if late: lateness adds latency,
  // never a step. Chroma moves by linear slews (deltas, so whole turns never matter); centre, loudness and pan by
  // one-pole smoothers; gate and duck by two cascaded one-poles (τ/2 each), so an onset or a fade starts with zero
  // slope (no corner in the envelope); each partial is a phase accumulator, continuous through any change.
  const WORKLET_SRC = `'use strict';
const N = ${SH.N}, FLO = ${SH.fLo}, ISIG = ${1 / SH.sigma}, EDGE = ${SH.edge}, AMP = ${SH.amp};
const ORG = [${ORGAN.join(', ')}], ONORM = ${ORGAN_NORM};
const TL = 4096, SINT = new Float32Array(TL + 1); for (let i = 0; i <= TL; i++) SINT[i] = Math.sin(2 * Math.PI * i / TL);
const sin1 = (p) => { const x = p * TL, i = x | 0; return SINT[i] + (SINT[i + 1] - SINT[i]) * (x - i); };
const GD = 8, GL = 8192, GT = new Float32Array(GL + 2); for (let i = 0; i <= GL + 1; i++) { const d = -GD + 2 * GD * i / GL; GT[i] = Math.exp(-0.5 * d * d); }
const gauss = (d) => { if (d <= -GD || d >= GD) return 0; const x = (d + GD) * (GL / (2 * GD)), i = x | 0; return GT[i] + (GT[i + 1] - GT[i]) * (x - i); };
const taper = (p) => { if (p <= 0 || p >= N) return 0; const e = p < N - p ? p : N - p; if (e >= EDGE) return 1; const s = Math.sin(0.5 * Math.PI * e / EDGE); return s * s; };
const P2 = new Float64Array(N); for (let k = 0; k < N; k++) P2[k] = Math.pow(2, k);
class Voice extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.kind = p.kind || 'shepard'; this.q = []; this.fs = sampleRate;
    this.s = 0; this.sFrom = 0; this.sTo = 0; this.sLen = 0; this.sPos = 0; this.fresh = true;
    this.c = ${SH.c0}; this.cT = this.c; this.ld = 1; this.ldT = 1; this.pan = 0; this.panT = 0;
    this.g = 0; this.g1 = 0; this.gT = 0; this.gA = this.coef(0.01); this.dk = 1; this.dk1 = 1; this.dkT = 1; this.dkA = this.coef(0.005); this.dkEnd = -1;
    this.aCL = this.coef(0.02); this.aPan = this.coef(0.03); this.aAmp = this.coef(0.012);
    this.ph = new Float64Array(N); this.end = -1;
    this.amp = 0; this.ampT = 0;   // height: organ level
    for (const c of p.cmds || []) this.push(c);
    this.port.onmessage = (e) => { for (const c of e.data) this.push(c); };
  }
  coef(tau) { return tau > 0 ? 1 - Math.exp(-1 / (tau * this.fs)) : 1; }
  quiet() { return this.g < 1e-4 && this.g1 < 1e-4; }
  push(c) { c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }
  apply(c, frame) {
    if (c.snap != null) {
      // a new start (the first set, a new function): the nearest equivalent of the chroma (whole turns are inaudible);
      // instant only while silent, otherwise a 12 ms glide
      let d = c.snap - this.s; d -= Math.round(d); this.sTo = this.s + d;
      if (this.quiet() || this.fresh) { this.s = this.sTo; this.sLen = 0; } else { this.sFrom = this.s; this.sLen = Math.round(0.012 * this.fs); this.sPos = 0; }
    }
    if (c.ds != null) { this.sFrom = this.s; this.sTo += c.ds; this.sLen = Math.max(1, Math.round(c.dur * this.fs)); this.sPos = 0; }
    if (c.lf != null) {
      // the Height voice: s is log2 of the frequency, slewed linearly (in pitch) to the target
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
      let y = 0;
      if (this.g > 1e-6 || this.g1 > 1e-6 || this.gT > 0) {
        if (height) {
          // s is log2 of the frequency here
          const f = Math.pow(2, this.s); let p = ph[0] + f * inv; p -= Math.floor(p); ph[0] = p;
          let acc = 0; for (let h = 0; h < 4; h++) { const fh = f * (h + 1); if (fh < 0.45 * fs) { let q = p * (h + 1); q -= Math.floor(q); acc += ORG[h] * sin1(q); } }
          y = acc * ONORM * this.amp * this.g * this.dk;
        } else {
          const si = Math.floor(this.s), u = this.s - si, b = FLO * Math.pow(2, u);
          let acc = 0;
          for (let k = 0; k < N; k++) {
            let kk = (k + si) % N; if (kk < 0) kk += N;
            const pos = kk + u, f = b * P2[kk];
            let p = ph[k] + f * inv; if (p >= 1) p -= Math.floor(p); ph[k] = p;
            let gk = gauss((pos - this.c) * ISIG);
            if (gk < 1e-9) continue;
            gk *= taper(pos);
            const r = f * inv; if (r > 0.40) gk *= r >= 0.45 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * (r - 0.40) / 0.05);
            acc += gk * sin1(p);
          }
          y = acc * AMP * this.ld * this.g * this.dk;
        }
      }
      // the equal-power pan law of a StereoPannerNode for a mono input (−3 dB each side at the centre)
      const th = (this.pan + 1) * Math.PI / 4;
      L[i] = y * Math.cos(th); if (R !== L) R[i] = y * Math.sin(th);
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
  // load the voices' worklet into a context: a Blob URL, else a data: URL; false where neither is allowed (a CSP
  // without blob:/data: for scripts, no AudioWorklet): the voices then use native nodes (anchored automation)
  let workletRefused = false;   // refused once (a CSP): not asked again in this page
  async function loadWorklet(c) {
    if (workletRefused || !c.audioWorklet || typeof AudioWorkletNode === 'undefined') return false;
    for (const u of workletURLs()) { try { await c.audioWorklet.addModule(u); return true; } catch (e) { /* refused: next */ } }
    workletRefused = true;
    return false;
  }

  // the voice's chroma as the main thread plans it: segments {t0, t1, s0, s1} on the context's clock (the worklet and
  // the node timeline both follow the same plan; only the cue transposition and the display read it)
  function Plan() {
    let segs = [], sEnd = null;
    const at = (t) => {
      if (sEnd === null) return 0;
      for (let i = segs.length - 1; i >= 0; i--) { const g = segs[i]; if (t >= g.t0) return t >= g.t1 || g.t1 <= g.t0 ? g.s1 : g.s0 + (g.s1 - g.s0) * (t - g.t0) / (g.t1 - g.t0); }
      return segs.length ? segs[0].s0 : sEnd;
    };
    return {
      at, end: () => sEnd, empty: () => sEnd === null,
      start(t, s) { segs = [{ t0: t, t1: t, s0: s, s1: s }]; sEnd = s; },
      // replan from t (the worklet: a new slew from where the voice is) or append at the end (the node timeline)
      replan(t, s1, t1) { const s0 = at(t); segs = segs.filter((g) => g.t1 > t - 0.5 && g.t0 < t); segs.push({ t0: t, t1, s0, s1 }); sEnd = s1; return s0; },
      append(t0, t1, s1) { const s0 = sEnd; segs.push({ t0, t1, s0, s1 }); if (segs.length > 64) segs.splice(0, segs.length - 64); sEnd = s1; return s0; },
      reset() { segs = []; sEnd = null; },
    };
  }

  // a voice's output: stereo already panned (the worklet) → its tier, dry and a small send to the room
  function outStereo(G, T, wet) {
    const c = G.c, inp = c.createGain();
    inp.connect(G.tier[T].dry);
    if (wet) { const s = c.createGain(); s.gain.value = wet; inp.connect(s); s.connect(G.tier[T].wet); }
    return inp;
  }

  // the main-thread side shared by both voices and both back ends: dt from the event clock, the backlog rule (never
  // reversed; whole turns beyond one dropped, since they sound identical; played at ≤ ~3 turns/s)
  function ShepardVoice(G, T = 'sonify') {
    const c = G.c, plan = Plan(), worklet = !!G.worklet && (G.offline || prefer.worklet);
    let off = 0, last = -1, lastWall = 0, dead = false, on = false, centre = SH.c0, loud = 1;
    const be = worklet ? WorkletBackend(G, T, 'shepard', 0.08) : NodeShepard(G, T);
    const v = {
      engine: worklet ? 'worklet' : 'nodes',
      // ph: arg F in turns, unwrapped along the probe's path; lnAbs = ln |F|; jump: F jumped (a cut); returns the whole
      // turns dropped
      set(ph, lnAbs, pn = 0, t, jump = false) {
        if (dead) return 0;
        const explicit = t != null; if (!explicit) t = c.currentTime;
        const wall = performance.now();
        const dt = explicit ? (last < 0 ? 0.02 : clamp(t - last, 0.008, 0.05)) : (last < 0 ? 0.02 : clamp((wall - lastWall) / 1000, 0.008, 0.05));
        last = t; lastWall = wall;
        centre = shCentre(lnAbs); loud = shLoud(lnAbs);
        let dropped = 0;
        if (plan.empty()) {
          off = Math.floor(ph); const f = ph - off;
          plan.start(t, f);
          be.start(t, f, centre, loud, clamp(pn, -0.3, 0.3), explicit);
          return 0;
        }
        const cur = be.from(plan, t, explicit);
        let back = ph - off - cur;
        if (Math.abs(back) > 1) { const w = Math.sign(back) * (Math.ceil(Math.abs(back)) - 1); off += w; back -= w; dropped = w; }
        // the backlog with its true sign: the frame interval plus 0.3 s per turn (≈ 3 turns/s at most); a jump (a branch
        // cut) as a 12 ms glide. (The worklet replans from where the voice is; the node timeline only appends, so there
        // a move ends one frame interval after now + LEAD, or later when 0.3 s per turn needs longer: no queue builds up.)
        const slow = jump ? 0 : 0.3 * Math.abs(back), dur = jump ? 0.012 : dt + slow;
        be.move(plan, t, cur, cur + back, dur, centre, loud, clamp(pn, -0.3, 0.3), explicit, jump ? 0.012 : dt, slow);
        return dropped;
      },
      gate(g, t, tau) { if (dead) return; on = !!g; if (on) chromaVoice = v; be.gate(on ? 1 : 0, t, tau != null ? tau : on ? 0.02 : 0.08); },
      duck: (t, hold) => { if (!dead && hold > 0) be.duck(t, hold); },
      sounding: () => on && !dead && !plan.empty(),
      chroma: (t = c.currentTime) => { const s = plan.at(t); return s - Math.floor(s); },
      silence() { v.gate(false, undefined, 0.01); plan.reset(); last = -1; },
      reset() { plan.reset(); last = -1; },
      partials: () => { const s = plan.at(c.currentTime), u = s - Math.floor(s); return Array.from({ length: SH.N }, (_, k) => ({ pos: k + u, amp: loud * shBell(k + u, centre) })); },
      centre: () => centre,
      stop(t) { if (dead) return; on = false; be.stop(t); dead = true; liveVoices.delete(v); if (chromaVoice === v) chromaVoice = null; if (G === Gl()) touchIdle(); },
    };
    liveVoices.add(v);
    return v;
  }
  // the landscape probe: an organ tone (harmonics 1–4 at 1/n, so it survives phone speakers) on the Height scale:
  // u = ln|F| / (2π/S), one contour of the drawn lines = one pentatonic step, |F| = 1 on D5, A3 … A6
  const HV = { amp: 0.042 };
  function HeightVoice(G, T = 'sonify') {
    const c = G.c, worklet = !!G.worklet && (G.offline || prefer.worklet), be = worklet ? WorkletBackend(G, T, 'height', 0.06) : NodeHeight(G, T);
    let dead = false, last = -1, lastWall = 0, loud = 1, on = false, started = false, gEnd = 0;
    const v = {
      engine: worklet ? 'worklet' : 'nodes',
      // glide: at least this long (s) for this move (a function swapped under a still probe). It is kept to its end:
      // the next frames' moves ask for the rest of it, not for one frame (review snddef-5)
      set(lnAbs, pn = 0, t, sectors = 12, glide = 0) {
        if (dead) return;
        const explicit = t != null; if (!explicit) t = c.currentTime;
        const wall = performance.now();
        const dt = explicit ? (last < 0 ? 0 : clamp(t - last, 0.008, 0.05)) : (last < 0 ? 0 : clamp((wall - lastWall) / 1000, 0.008, 0.05));
        last = t; lastWall = wall;
        const f = hNote(lnc(lnAbs) / (2 * Math.PI / sectors));
        loud = Math.min(1.5, Math.pow(587.33 / f, 0.35));   // a tilt: low notes a little louder (small speakers)
        if (!started) { started = true; be.start(t, Math.log2(f), 0, HV.amp * loud, clamp(pn, -0.3, 0.3), explicit); return; }
        const clk = explicit ? t : wall / 1000;
        if (glide > 0) gEnd = clk + glide;
        be.moveH(t, Math.log2(f), Math.max(dt, 0.008, glide, gEnd - clk), HV.amp * loud, clamp(pn, -0.3, 0.3), explicit);
      },
      gate(g, t, tau) { if (!dead) { on = !!g; be.gate(on ? 1 : 0, t, tau != null ? tau : on ? 0.02 : 0.08); } },
      duck: (t, hold) => { if (!dead && hold > 0) be.duck(t, hold); },
      sounding: () => on && !dead, chroma: () => null,
      // reset: a fresh start of the probe (a new point, a lost track). The pitch is absolute here, so only the frame
      // clock starts again; a swap's glide still running keeps its end, so a fresh start never cuts it to one short
      // move (review snddef-5)
      silence() { v.gate(false, undefined, 0.01); }, reset() { last = -1; },
      stop(t) { if (dead) return; on = false; be.stop(t); dead = true; liveVoices.delete(v); if (G === Gl()) touchIdle(); },
    };
    liveVoices.add(v);
    return v;
  }

  // ---- back end 1: the AudioWorklet (one node per voice; in an offline render the node is built when rendering starts,
  // with every command in its options, so renders are exact and deterministic)
  function WorkletBackend(G, T, kind, wet) {
    const c = G.c, o = outStereo(G, T, wet), pend = [];
    let node = null, stopT = null;
    const make = () => {
      node = new AudioWorkletNode(c, 'cmw-voice', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { kind, cmds: pend.splice(0) } });
      node.connect(o);
    };
    const post = (cmd) => { if (node) node.port.postMessage([cmd]); else pend.push(cmd); };
    if (G.offline) G.flush.push(make); else make();
    const now = (t) => (t != null ? t : c.currentTime);
    return {
      start(t, s, cc, loud, pan) { post(kind === 'height' ? { at: t, lf: s, amp: loud, pan } : { at: t, snap: s, cc, loud, pan }); },
      from: (plan, t) => plan.at(t),
      move(plan, t, cur, s1, dur, cc, loud, pan) { const s0 = plan.end(); plan.replan(t, s1, t + dur); post({ at: t, ds: s1 - s0, dur, cc, loud, pan }); },
      moveH(t, lf, dur, amp, pan) { post({ at: t, lf, dur, amp, pan }); },
      gate(g, t, tau) { post({ at: now(t), gate: g, tau }); },
      duck(t, hold) { post({ at: now(t), duck: hold }); },
      stop(t) { post({ at: now(t), stop: 1, tau: 0.05 }); stopT = now(t); if (!G.offline) setTimeout(() => { try { o.disconnect(); } catch (e) { /* gone */ } }, 800 + Math.max(0, stopT - c.currentTime) * 1000); },
    };
  }

  // ---- back end 2: native nodes with anchored, append-only automation (no AudioWorklet here). Every param that moves
  // continuously is a Lane: its own timeline (end time, end value); a move starts at max(now + LEAD, end), anchored with
  // setValueAtTime(end value) when there is a gap, and is never cancelled. Gate, duck and pan only get target curves.
  function Lane(p, v0) { p.value = v0; return { p, end: 0, v: v0 }; }
  function laneTo(L, v, T0, T1) {
    if (T0 > L.end + 1e-7) L.p.setValueAtTime(L.v, T0);
    if (T1 > T0 + 1e-7) L.p.linearRampToValueAtTime(v, T1); else L.p.setValueAtTime(v, T0);
    L.end = Math.max(T0, T1); L.v = v;
  }
  function laneSet(L, v, T) { L.p.setValueAtTime(v, T); L.end = T; L.v = v; }
  const leadOf = (c) => (typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext ? 0 : LEAD);
  // a target curve from wherever the param is, starting no earlier than now + LEAD (only for params that never get
  // linear ramps: cancelScheduledValues then removes only future targets, and a target starts from the running value)
  function follow(c, p, v, tau, t = 0) {
    const T = Math.max(t || 0, c.currentTime + leadOf(c));
    p.cancelScheduledValues(T);
    if (tau > 0) p.setTargetAtTime(v, T, tau); else p.setValueAtTime(v, T);
    return T;
  }
  function nodeCommon(G, T, wet) {
    const c = G.c, o = out(G, T, 0, wet, 0.3), vg = c.createGain(), dk = c.createGain();
    vg.gain.value = 0; vg.connect(dk); dk.connect(o);
    let stopped = false;
    return {
      c, o, vg, dk,
      pan(pn, t) { if (o.panner) follow(c, o.panner.pan, pn, 0.03, t); },
      gate(g, t, tau) { if (!stopped) follow(c, vg.gain, g, tau, t); },
      duck(t, hold) { const T0 = follow(c, dk.gain, 0.5, 0.01, t); dk.gain.setTargetAtTime(1, T0 + hold, 0.08); },
      stop(t, srcs) { const T0 = follow(c, vg.gain, 0, 0.05, t); stopped = true; for (const s of srcs) s.stop(T0 + 0.5); },
    };
  }
  function NodeShepard(G, T) {
    const cm = nodeCommon(G, T, 0.08), c = cm.c, N = SH.N, osc = [], det = [], gl = [];
    for (let k = 0; k < N; k++) {
      const os = c.createOscillator(), g = c.createGain();
      os.frequency.value = SH.fLo; os.connect(g); g.connect(cm.vg); os.start();
      osc.push(os); det.push(Lane(os.detune, 1200 * k)); gl.push(Lane(g.gain, 0));
    }
    let end = 0, cE = SH.c0, lE = 1, want = null, timer = 0;
    const gainOf = (pos, cc, l) => SH.amp * l * shBell(pos, cc) * nyq(SH.fLo * Math.pow(2, pos), c.sampleRate);
    // one segment from (T0, sE) to (T1, s1): each partial follows k + s (mod N), a breakpoint every 1/16 turn so the gain
    // follows the bell, and an exact split where a partial wraps (its gain is 0 there; the detune jumps there)
    function segment(T0, T1, sE, s1, c1, l1) {
      const m = Math.max(1, Math.ceil(Math.abs(s1 - sE) * 16));
      for (let k = 0; k < N; k++) {
        let tp = T0, sp = sE;
        for (let j = 1; j <= m; j++) {
          const a = j / m, tj = T0 + (T1 - T0) * a, sj = sE + (s1 - sE) * a, cj = cE + (c1 - cE) * a, lj = lE + (l1 - lE) * a;
          const p0 = k + sp, p1 = k + sj, w0 = Math.floor(p0 / N), w1 = Math.floor(p1 / N);
          if (w0 !== w1) {
            const up = w1 > w0, edge = (up ? w1 : w0) * N, tc = tp + (tj - tp) * ((edge - p0) / (p1 - p0));
            laneTo(det[k], 1200 * (up ? N : 0), tp, tc); laneTo(gl[k], 0, tp, tc);
            laneSet(det[k], 1200 * (up ? 0 : N), tc);
            tp = tc;
          }
          const pos = p1 - N * w1;
          laneTo(det[k], 1200 * pos, tp, tj); laneTo(gl[k], gainOf(pos, cj, lj), tp, tj);
          tp = tj; sp = sj;
        }
      }
      end = T1; cE = c1; lE = l1;
    }
    const be = {
      start(t, s, cc, loud, pan, explicit) {
        const T0 = explicit ? t : c.currentTime + LEAD;
        for (let k = 0; k < N; k++) { const pos = k + s; laneSet(det[k], 1200 * pos, T0); laneSet(gl[k], gainOf(pos, cc, loud), T0); }
        end = T0; cE = cc; lE = loud; cm.pan(pan, T0);
      },
      // the node timeline cannot be replanned: a move starts where the queue ends (≤ 20 ms ahead of now + LEAD; more is
      // held and sent when the queue drains, the newest target only)
      from: (plan) => plan.end(),
      move(plan, t, cur, s1, dur, cc, loud, pan, explicit, dt, slow) {
        if (explicit) { const T0 = Math.max(t, end), T1 = Math.max(T0 + slow, t + dt, T0 + 0.004); segment(T0, T1, plan.end(), s1, cc, loud); plan.append(T0, T1, s1); cm.pan(pan, T0); return; }
        want = { s1, dt, slow, cc, loud, pan, plan }; be.pump();
      },
      pump() {
        if (!want) return;
        const now = c.currentTime + LEAD, ahead = end - now;
        if (ahead > 0.02) { clearTimeout(timer); timer = setTimeout(be.pump, (ahead - 0.015) * 1000); return; }
        const w = want; want = null;
        const T0 = Math.max(now, end), T1 = Math.max(T0 + w.slow, now + w.dt, T0 + 0.004);
        segment(T0, T1, w.plan.end(), w.s1, w.cc, w.loud); w.plan.append(T0, T1, w.s1); cm.pan(w.pan, T0);
      },
      gate: cm.gate, duck: cm.duck,
      stop(t) { clearTimeout(timer); want = null; cm.stop(t, osc); },
    };
    return be;
  }
  function NodeHeight(G, T) {
    const cm = nodeCommon(G, T, 0.06), c = cm.c, os = c.createOscillator(), lg = c.createGain();
    os.setPeriodicWave(c.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, ...ORGAN])));
    os.frequency.value = 440; os.connect(lg); lg.connect(cm.vg); os.start();
    const det = Lane(os.detune, 0), amp = Lane(lg.gain, 0);
    const cents = (lf) => 1200 * (lf - Math.log2(440));
    let want = null, timer = 0;
    const be = {
      start(t, lf, _c, a, pan, explicit) { const T0 = explicit ? t : c.currentTime + LEAD; laneSet(det, cents(lf), T0); laneSet(amp, a, T0); cm.pan(pan, T0); },
      moveH(t, lf, dur, a, pan, explicit) {
        if (explicit) { const T0 = Math.max(t, det.end); laneTo(det, cents(lf), T0, T0 + dur); laneTo(amp, a, T0, T0 + dur); cm.pan(pan, T0); return; }
        want = { lf, dur, a, pan }; be.pump();
      },
      pump() {
        if (!want) return;
        const now = c.currentTime + LEAD, ahead = det.end - now;
        if (ahead > 0.02) { clearTimeout(timer); timer = setTimeout(be.pump, (ahead - 0.015) * 1000); return; }
        const w = want; want = null; const T0 = Math.max(now, det.end), T1 = Math.max(now + w.dur, T0 + 0.004);
        laneTo(det, cents(w.lf), T0, T1); laneTo(amp, w.a, T0, T1); cm.pan(w.pan, T0);
      },
      gate: cm.gate, duck: cm.duck,
      stop(t) { clearTimeout(timer); want = null; cm.stop(t, [os]); },
    };
    return be;
  }
  function liveVoice(kind) {
    if (!P.on || !P.sonify || hidden || !AC) return null;
    if (!canSchedule(false)) return null;
    clearTimeout(idleTimer);
    return kind === 'height' ? HeightVoice(G) : ShepardVoice(G);
  }

  // "listen along a curve": the arg (turns, unwrapped) and ln|F| sampled uniformly in time over dur seconds, synthesised
  // sample by sample with integrated phases (exact and phase-continuous), as one buffer
  function curveBuffer(c, phi, lnAbs, dur) {
    const fs = c.sampleRate, n = Math.ceil(dur * fs), M = phi.length, b = c.createBuffer(1, n, fs), y = b.getChannelData(0);
    const ph = new Float64Array(SH.N), fade = Math.round(0.03 * fs);
    for (let i = 0; i < n; i++) {
      const u = (i / (n - 1)) * (M - 1), j = Math.min(M - 2, Math.floor(u)), a = u - j;
      const f = phi[j] + (phi[j + 1] - phi[j]) * a, la = lnAbs[j] + (lnAbs[j + 1] - lnAbs[j]) * a;
      const cen = shCentre(la), ld = shLoud(la), e = Math.min(1, i / fade, (n - 1 - i) / fade);
      let s = 0;
      for (let k = 0; k < SH.N; k++) {
        let p = k + f; p -= SH.N * Math.floor(p / SH.N);
        const fk = SH.fLo * Math.pow(2, p);
        ph[k] += 2 * Math.PI * fk / fs;
        if (ph[k] > 1e6) ph[k] %= 2 * Math.PI;
        const g = shBell(p, cen) * nyq(fk, fs);
        if (g > 1e-5) s += g * Math.sin(ph[k]);
      }
      y[i] = SH.amp * ld * e * s;
    }
    return b;
  }
  // a deliberate action (a button, a key): the Mathematical events tier. Its bells (on the curve's starting pitch class)
  // and cut ticks go through the same tier, scheduled on the audio clock at least 100 ms apart. Returns
  // {t0, dur, stop()} or null.
  function curve(phi, lnAbs, dur, opts = {}) {
    if (!P.on || !P.events || hidden || !AC) return null;
    if (!canSchedule(false)) return null;
    const src = ctx.createBufferSource(), fade = ctx.createGain(); src.buffer = curveBuffer(ctx, phi, lnAbs, dur);
    src.connect(fade); fade.connect(out(G, 'events', 0, 0.1)); track(G, src);
    const t0 = ctx.currentTime + Math.max(0.03, LEAD + 0.01);
    src.start(t0);
    let next = 0;
    for (const b of opts.bells || []) { const at = Math.max(0.025 + b.t, next); next = at + 0.1; play('turn', { dir: b.dir, pc: opts.pc, at, force: true, tier: 'events' }); }
    for (const tt of opts.cuts || []) play('cut', { at: 0.025 + tt, force: true, tier: 'events' });
    clearTimeout(idleTimer); src.onended = () => { G.active.delete(src); touchIdle(); };
    // stop: a 12 ms raised-cosine fade from now + LEAD (no corner, no step), then the source: never cut mid-waveform
    let stopped = false;
    return { t0, dur, now: () => ctx.currentTime, stop() { if (stopped) return; stopped = true; try { const T = ctx.currentTime + LEAD; fade.gain.setValueCurveAtTime(FADE_DN, T, 0.012); src.stop(T + 0.02); } catch (e) { /* ended */ } } };
  }
  // Esc, hidden, off: everything stops now, queues are emptied, live voices are gated off; the setting is unchanged.
  // The bus goes down on a 12 ms raised cosine, every scheduled source is stopped inside the silent window that
  // follows, and the bus comes back on a 30 ms raised cosine 50 ms after the start: no step (revision 3 stepped it
  // back to 1, a snap under a hover voice that a still-moving pointer had re-gated) and no corner (a target curve
  // starts with a corner, heard as a tick at the stop). DESIGN §7.6. A hush during a hush joins its silent window, or
  // (in its return) starts a new one after it: value curves never overlap.
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
    const off = Math.max(now, t + 0.013);
    for (const s of G.active) { try { s.stop(off); } catch (e) { /* not started */ } }
    // the voices fade now (τ 4 ms, zero slope at the start), in command order: pointer events handled after this one
    // (bunched behind a busy main thread) re-gate the voice after it, never before a fade-out stamped at now + LEAD
    // (that order gave a 10 ms blip: the voice swelling, then cut)
    for (const v of liveVoices) v.gate(false, undefined, 0.004);
    Q.turn.next = Q.contour.next = 0; Q.turn.due.length = Q.contour.due.length = 0;
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
    emit();
  }

  // ---------------------------------------------------------------- the probe's arithmetic (pure; used by app.js)
  // arg F along a path in (z, t) (notes/sound/DEFORMATION.md). Fat(T) is the function at transport time T. The change
  // of arg of u ↦ Fat(T0 + u (T1 − T0))(z0 + u (z1 − z0)), u ∈ [0, 1], tracked exactly by argStep (Calc.argStep) on
  // the parameter u: a still probe (z1 = z0) follows t, a probe that moves while t runs follows both at once. g0, g1:
  // the values at the ends (known). Returns argStep's result {d, exact, why, evals}; why 'jump' is a cut of H_t
  // sweeping across the probe, 'zero' or 'pole' one passing exactly through it.
  function pathStep(argStep, Fat, z0, T0, g0, z1, T1, g1, opts) {
    const dx = z1.re - z0.re, dy = z1.im - z0.im, dT = T1 - T0;
    const P = (u) => { const s = u.re; return Fat(T0 + s * dT)({ re: z0.re + s * dx, im: z0.im + s * dy }); };
    return argStep(P, { re: 0, im: 0 }, g0, { re: 1, im: 0 }, g1, opts);
  }
  // the turns of a loop or a run {phi, k} (phi: arg in turns since it began): one call of ring(dir) per completed
  // turn; a turn back must first come back to the previous integer, so a wobble at a turn rings once. (A turn that
  // ends on the integer up to rounding counts: e^(2πi·3t)z tracks to 2.9999999999999982 turns.)
  function turns(L, ring) {
    let n = 0;
    while (L.phi >= L.k + 1 - 1e-9) { L.k++; n++; if (ring) ring(1); }
    while (L.phi <= L.k - 1 + 1e-9) { L.k--; n--; if (ring) ring(-1); }
    return n;
  }

  // offline rendering, for tests and waveform thumbnails (no output device, no activation needed)
  // opts.nodes: the native-node voices (the fallback where no AudioWorklet is allowed)
  async function render(fn, dur, opts = {}) {
    const rate = opts.rate || 48000, c = new OfflineAudioContext(2, Math.ceil(dur * rate), rate), g = graph(c, opts.vol != null ? opts.vol : 1, { allOn: true, noClip: opts.noClip });
    g.offline = true; g.worklet = !opts.nodes && await loadWorklet(c); g.engine = g.worklet ? 'worklet' : 'nodes';
    fn(g, 0.01, c);
    for (const f of g.flush) f();
    return c.startRendering();
  }

  return {
    play, turn: (o = {}) => queued('turn', o), tick: (o = {}) => queued('contour', o), hush, scrub, scrubState: () => ({ v: SCR.v, band: !!SCR.tex }),
    set, toggle: () => set({ on: !P.on }), prefs: () => ({ ...P }), state, subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    voice: () => liveVoice('phase'), heightVoice: () => liveVoice('height'), curve, curveBuffer, render, graph, CATALOG, SH, HV, ShepardVoice, HeightVoice,
    shG, shBell, shCentre, shLoud, hNote, loadWorklet, prefer, lead: () => LEAD, pathStep, turns, debug: () => ({ ctx, G, live: liveVoices.size, activated, active: G ? G.active.size : 0, queue: ctx ? { turn: Math.max(0, Q.turn.next - ctx.currentTime), contour: Math.max(0, Q.contour.next - ctx.currentTime) } : null }),
  };
})();
// the sound popover (page.html #sndPop) sits outside #app, which the app's walker translates: in another interface
// language its static strings are translated here, once, at load (src/i18n.js; English: nothing runs)
if (typeof document !== 'undefined' && typeof I18N !== 'undefined' && I18N.lang !== 'en') { const pop = document.getElementById('sndPop'); if (pop) I18N.applyStatic(pop); }
