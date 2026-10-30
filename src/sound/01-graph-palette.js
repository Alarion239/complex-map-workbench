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

