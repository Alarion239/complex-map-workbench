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
      if (prefer.worklet) { const g = G; loadWorklet(ctx).then((ok) => { g.worklet = ok; if (ok) g.synth = makeSynth(g); g.engine = ok ? 'worklet' : 'nodes'; limitOn(g); emit(); if (g === G) flushPend(); }); } else { G.engine = 'nodes'; limitOn(G); }
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
    // the context is due just after this gesture: a one-shot waits for it (play queues it); anything else creates it
    // now, as before
    if (pendT) { if (wait) return 'wait'; ensureNow(); return canSchedule(grace); }
    if (!ensure()) return false;
    if (ctx.state === 'running') return true;
    if (grace && !graceUsed && inGesture()) { graceUsed = true; return true; }
    // (a context the deferred start made that is not running yet, e.g. Firefox's: a one-shot waits for its statechange)
    if (wait && performance.now() - bornAt < 1500) return 'wait';
    return false;
  }
  // The first gesture's context (#271): new AudioContext() takes ~55 ms, so it is created just after the gesture, not
  // inside it, by a timer created in the activating event itself: WebKit carries a gesture only to a timer created while
  // it is processed (a timer created in a requestAnimationFrame callback has none); Chrome and Firefox keep transient
  // activation ~5 s. The work timer (0 ms) is (re)armed by click, keydown, pointerup and touchend, so for a click it
  // runs in the task after the click's; a mouse pointerdown arms only the backstop (250 ms: a press held into a drag).
  // A touch pointerdown arms nothing (it is not an activation). One-shots asked for meanwhile wait in pendQ (one per
  // catalog entry, with its intended start) and sound against the new clock, through the worklet once it has loaded.
  // Safety net (old iOS): once a context exists, or a deferred start made none, a gesture calls ensure() synchronously.
  /** @type {{ to: any, late: any } | null} */
  let pendT = null;
  let syncNext = false, bornAt = -1e9, pendDrop = 0;
  const pendQ = new Map();
  function ensureNow() {
    const deferred = !!pendT;
    if (pendT) { clearTimeout(pendT.to); clearTimeout(pendT.late); pendT = null; }
    const had = ctx, tried = !!AC && P.on && !hidden && mayStart(), ok = ensure();
    if (tried && !ctx) syncNext = true;
    if (deferred && ctx && ctx !== had) bornAt = performance.now();
    if (!ok) pendQ.clear(); else flushPend();
    return ok;
  }
  function deferEnsure(work) {
    const run = () => { if (pendT) ensureNow(); };
    if (!pendT) pendT = { to: 0, late: setTimeout(run, 250) };
    if (work) { clearTimeout(pendT.to); pendT.to = setTimeout(run, 0); }
  }
  // the queued one-shots, once the clock runs and the worklet has settled (a statechange and loadWorklet's end call
  // this again): on the first gesture the cue is the worklet's, not a main-thread render. A cue that could not start
  // within 1.5 s of its request is dropped: it would no longer belong to its gesture
  function flushPend() {
    if (!pendQ.size || pendT) return;
    if (!ctx) { pendQ.clear(); return; }
    const now = performance.now() / 1000, run = ctx.state === 'running', loading = G && G.engine === 'loading';
    for (const [name, q] of [...pendQ]) {
      if (now - q.asked > 1.5) { pendQ.delete(name); continue; }
      if ((!run || loading) && !q.o.grace) continue;
      pendQ.delete(name);
      play(name, Object.assign({}, q.o, { at: Math.max(0, q.due - now) }));
    }
    // (what still waits is dropped at 1.5 s even if nothing calls this again)
    if (pendQ.size && !pendDrop) pendDrop = setTimeout(() => { pendDrop = 0; flushPend(); }, 1600);
  }
  const onActivate = (e) => {
    if (e.type === 'keydown' && e.key === 'Escape') return;
    activated = true; lastGesture = performance.now();
    if (!P.on || hidden || (ctx && ctx.state === 'running')) return;
    if (ctx || syncNext) { syncNext = false; ensureNow(); return; }
    if (e.type !== 'pointerdown') deferEnsure(true);
    else if (!e.pointerType || e.pointerType === 'mouse') deferEnsure(false);
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
    let cs = canSchedule(!!o.grace, true);
    // (behind cues still waiting for the worklet: Hear's zero ping of a still probe must not sound before the start cue
    // of the M that started the deformation)
    if (cs === true && pendQ.size && G && G.engine === 'loading') cs = 'wait';
    // (one per catalog entry: a second request while the first waits is refused)
    if (cs === 'wait') { if (pendQ.has(name)) return false; const a = performance.now() / 1000; pendQ.set(name, { o, asked: a, due: a + (o.at || 0) }); return true; }
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

