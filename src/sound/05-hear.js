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
