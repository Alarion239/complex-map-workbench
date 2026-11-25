  // ---------------- the steps view's render-ahead frames (#1339): a slow glide's frames drawn while the gate waits ----------------
  // the render-ahead frames' key (#1339): every input a glide frame's pixels depend on but its place, and the motion M whose
  // places the frames are drawn at (HomRange.aheadPlaces' from, to, ms and ease, and the span it glides): the chain and its
  // order, the camera and the pane, the theme, the colour and display options, the view's scope, surface, colour plane and
  // look, the shapes, the targets, the selection and the language (the frames hold the labels). Frames drawn ahead under
  // another key are dropped. With M null, the chain's frames whatever the motion (svAheadCost's)
  function svAheadKey(pane, M) {
    return JSON.stringify([chainSig[nSteps()], svStepsSig(), !!S.homAll, S.srcView, pane.w, pane.h, pane.dpr, TH,
      S.dc, S.sectors, S.dcGrid, S.pattern, S.unit, S.sheets, S.outline, svOpacity(), SV.scope, SV.surf, svT(), SV.bare,
      hideStrokes, selected, S.shapes, S.targets, I18N.lang].concat(M ? [M.from, M.to, M.ms, M.eased, M.span] : []));
  }
  // A glide or a play whose frames cost more than AHEAD_MS to draw is drawn ahead, while the gate waits (svGated): frame k
  // of its schedule (HomRange.aheadPlaces: the place k·AHEAD_DT ms in, eased as svFrame eases a glide, linear as
  // svPlayFrame plays) is drawn off-screen as the screen draws it there (svRenderMoving) and kept as an ImageBitmap, and the
  // motion then shows frame floor(elapsed / AHEAD_DT) (HomRange.aheadIndex), one drawImage a frame (svAheadShow). A frame
  // is kept only when it is the exact frame at its own place: no hold, and between two planes the inverse pass's at its u.
  // One that is not is drawn again, at most AHEAD_TRIES times. What a motion does is decided from its chain's frame cost,
  // measured once (svAheadProbe): the first motion of a chain plays live at once, as it would without frames ahead, and
  // AHEAD_PROBE of its frames are drawn off-screen in idle moments after it ends, their median kept (svAheadCost). A later
  // motion of the chain then decides at once (svAheadPlan): at most AHEAD_MS it plays live; past AHEAD_WAIT_MAX_MS to draw
  // its frames, or past the memory budget to keep them, it plays live and says why once a chain and reason, with the next
  // words the view says (svAheadTail); else the gate waits while its frames are drawn. Only on the flat plane (the Stack's
  // floor included: its frames are drawn flat, and the Stack's camera maps the one shown, stackFloor), without
  // reduced motion, and only for a motion started from rest (svGo, svPlay): a press during a motion, a scrub, a speed
  // change, a Split and an edit play live
  const AHEAD_DT = 1000 / 60, AHEAD_MS = 14, AHEAD_PROBE = 3, AHEAD_TRIES = 3, AHEAD_WAIT_MAX_MS = 3000;
  // the gate's ahead part short of done until the last frame is made (svAheadPart); the longest a probe frame's GPU fence is
  // polled (ms); an idle moment's wait at most, and a timer's delay where the browser has no idle callback (ms)
  const AHEAD_PART_MAX = 0.99, AHEAD_FENCE_MAX_MS = 1000, AHEAD_IDLE_TIMEOUT_MS = 2000, AHEAD_IDLE_FALLBACK_MS = 50;
  // (a test hook's { ms, waitMs, cap }, each in place of AHEAD_MS, AHEAD_WAIT_MAX_MS and aheadBudget's when not null; null
  // in the app: svAheadTune)
  let svAheadTest = null;
  const aheadTest = (k) => (svAheadTest && svAheadTest[k] != null ? svAheadTest[k] : null);
  const aheadMs = () => (aheadTest('ms') != null ? aheadTest('ms') : AHEAD_MS);
  const aheadWaitMs = () => (aheadTest('waitMs') != null ? aheadTest('waitMs') : AHEAD_WAIT_MAX_MS);
  // the memory budget of a motion's frames (bytes): 256 MB, 512 MB where the browser reports 8 GB or more
  const aheadBudget = () => (aheadTest('cap') != null ? aheadTest('cap') : (/** @type {any} */ (navigator).deviceMemory >= 8 ? 512 : 256) * 2 ** 20);
  // the frames of the motion the gate waits on or plays: { M (from, to, ms, eased, span), key (svAheadKey), xs (the places),
  // N (the frames shown, 0..N−1: the motion ends at N), slots (by k: { bm, mf, cm, rec }), n (slots made), kept (each
  // slot made's glide path, kept when the slots go), tries (of the frame drawn next), state ('fill', 'done' or
  // 'live'), why (the reason it plays live: 'time', 'memory' or 'exact'; none when its frames
  // are cheap), t0 (the fill's start), cv (the scratch canvas), busy (a slice is posted), A (the motion record it shows,
  // once it shows one), paused ({el, x}: the play paused on it), shown, rejects, live (frames the screen drew while it
  // filled) }; or null
  let svAhead = null;
  // a chain's frame cost as its probe measured it (ms, by svAheadKey with no motion), and the reasons to play live said
  const svAheadCost = new Map(), svAheadSaid = new Set();
  // what the measured cost of M's chain says of motion M: null (not measured), 'live' (cheap: it plays live, as without
  // frames ahead), 'ahead' (its frames are drawn ahead), or the reason it plays live ('time', 'memory'). So a chain is
  // measured once: a later motion of it waits on no probe
  function svAheadPlan(M) {
    const c = svAheadCost.get(svAheadKey(paneL, null));
    if (c == null) return null;
    const N = Math.max(1, Math.ceil(M.ms / AHEAD_DT));
    return c <= aheadMs() ? 'live' : c * N > aheadWaitMs() ? 'time' : N * paneL.pw * paneL.ph * 4 > aheadBudget() ? 'memory' : 'ahead';
  }
  // whether motion M can be drawn ahead: on the flat plane, the Stack's floor included (its frames are the floor's flat
  // picture, which the Stack's camera maps as it shows them, so the camera is no part of their key)
  const svAheadCan = (M) => !!M && M.ms > 0 && stackAsFlat(() => svFlatSurf() && lFlat()) && !!GLR.ok && typeof OffscreenCanvas === 'function' && typeof MessageChannel === 'function' && !svReduced();
  function svAheadDrop() {
    const R = svAhead;
    svAhead = null;
    if (R) for (const s of R.slots) if (s && s.bm) s.bm.close();
  }
  // the gate's part for motion M (svReady(M)), or null when M is played live without waiting on its frames
  function svAheadPart(M) {
    if (!svAheadCan(M)) return null;
    if (svAheadPlan(M) !== 'ahead') return null;
    const R = svAhead;
    if (!R || R.key !== svAheadKey(paneL, M)) return { done: 0, total: 1 };
    return { done: R.state === 'done' || R.state === 'live' ? 1 : Math.min(AHEAD_PART_MAX, R.n / R.N), total: 1 };
  }
  // the frames of motion M made or going on: the fill's next slice posted, a frame a task through a MessageChannel, so the
  // gate's ring paints and Esc is read between two
  let svAheadCh = null;
  function svAheadRun(M) {
    const key = svAheadKey(paneL, M);
    if (!svAhead || svAhead.key !== key) {
      svAheadDrop();
      const xs = HomRange.aheadPlaces(M.from, M.to, M.ms, M.eased, AHEAD_DT);
      svAhead = { M, key, xs, N: xs.length - 1, slots: [], kept: [], n: 0, tries: 0, state: 'fill', why: null, t0: performance.now(), cv: null, busy: false, A: null, paused: null, shown: 0, rejects: 0, live: 0 };
    }
    const R = svAhead;
    if (R.state === 'fill' && !R.busy) {
      if (!svAheadCh) { svAheadCh = new MessageChannel(); svAheadCh.port1.onmessage = () => { svAheadSlice(); }; }
      R.busy = true;
      svAheadCh.port2.postMessage(0);
    }
  }
  // the frames given up: the motion plays live (why: the reason said, none when its frames are cheap)
  function svAheadLive(R, why) {
    R.state = 'live'; R.why = why;
    for (const s of R.slots) if (s && s.bm) s.bm.close();
    R.slots = []; R.cv = null;
  }
  // one slice of the fill: frame R.n drawn, and the next slice posted until the frames are made or given up
  function svAheadSlice() {
    const R = svAhead;
    if (!R) return;
    let next = false;
    try { next = svAheadFrame(R); } finally { R.busy = false; }
    if (svAhead !== R) return;
    if (next) svAheadRun(R.M);
    else if (R.state === 'done' || R.state === 'live') svGateTick();
  }
  // -> whether another frame is to be drawn
  function svAheadFrame(R) {
    const g = SV.gate;
    // (cancelled, or the gate waits on another motion or an edited chain: svGateTick starts that one's)
    if (!g || !g.M || R.state === 'done' || R.state === 'live' || svAheadKey(paneL, g.M) !== R.key) return false;
    const k = R.n, s = svAheadDraw(R, k);
    if (!s) {
      R.rejects++;
      if (++R.tries >= AHEAD_TRIES) { svAheadLive(R, 'exact'); return false; }
      return true;
    }
    R.tries = 0; R.slots[k] = s; R.n++; R.kept.push(s.rec ? s.rec.path : null);
    if (performance.now() - R.t0 > aheadWaitMs()) svAheadLive(R, 'time');
    else if (R.n >= R.N) { R.state = 'done'; R.cv = null; }
    return R.state === 'fill';
  }
  // draw() run as the screen draws motion M at k·AHEAD_DT ms, at place x: a copy of the motion record at that time is the
  // motion (so the frame is a glide's, with the glide's light points, and svLinkHold and svMotionDrawn write to the copy),
  // under SV.offscreen. Everything the frame writes is put back, the pane's pending frame (dirty.L) and renderAsks too, so a
  // visit asks for no live frame. -> draw(the copy)'s result
  function svAheadVisit(M, k, x, draw) {
    const keep = { x: SV.g.x, span: SV.span, anim: SV.anim, play: SV.play, mf: mfDrawn, cm: cutMarksL, ch: cutHandlesL, rec: svGlideRec, rest: svRestRec, held: svHeldOn, hb: svHoldB, dirty: dirty.L, asks: renderAsks };
    const A = { from: M.from, to: M.to, ms: M.ms, t0: 0, el: 0, held: null, drawn: null };
    svSetElapsed(A, k * AHEAD_DT);
    SV.offscreen++;
    try {
      SV.anim = A; SV.play = null; SV.span = M.span; SV.g.set(x);
      mfDrawn = null; cutMarksL = []; svGlideRec = null; svRestRec = null; svHeldOn = null;
      return draw(A);
    } finally {
      SV.anim = keep.anim; SV.play = keep.play; SV.span = keep.span; SV.g.set(keep.x);
      mfDrawn = keep.mf; cutMarksL = keep.cm; cutHandlesL = keep.ch; svGlideRec = keep.rec; svRestRec = keep.rest; svHeldOn = keep.held; svHoldB = keep.hb;
      dirty.L = keep.dirty; renderAsks = keep.asks;
      SV.offscreen--;
    }
  }
  // frame k of R drawn off-screen (svAheadVisit) into R's scratch canvas through a proxy of the left pane, its labels
  // placed at once (on the Stack, the floor's flat picture: a glide frame's draw reads nothing of the Stack) -> { bm: the
  // frame, mf, cm: its moving paths and cuts' marks, rec: its glide record }, or null when it is not the exact frame at
  // its place (R.reject says why)
  function svAheadDraw(R, k) {
    const pane = paneL, M = R.M, x = R.xs[k];
    if (!R.cv || R.cv.width !== pane.pw || R.cv.height !== pane.ph) R.cv = new OffscreenCanvas(pane.pw, pane.ph);
    const p = svProxy(pane, /** @type {any} */ (R.cv));
    p.labels = null;
    return svAheadVisit(M, k, x, (A) => {
      // (a hold is read as the screen's frame reads it, svDrawPlane on the flat plane: a frame that waits is drawn at the held
      // place and marks the copy held, A.held, so it is not kept)
      const asks = renderAsks, hold = svLinkHold();
      svRenderMoving(p, hold, asks);
      if (p.labels) flushLabels(p, p.labels);
      const bt = svBetween(x, M.span), still = bt.u <= SV_REST_U || bt.b === bt.a;
      // (R.reject: why the last frame was not kept: 'hold', a glide record's path and its reason ('mesh: <why the inverse pass
      // did not draw it>', 'none'), or 'place' (another frame's))
      R.reject = A.held ? 'hold' : still ? (!svRestRec || svRestRec.path === 'inverse' ? null : svRestRec.path)
        : !svGlideRec ? 'none' : svGlideRec.path !== 'inverse' ? `${svGlideRec.path}${svGlideRec.reason ? ': ' + svGlideRec.reason : ''}`
          : svGlideRec.b !== bt.b || svGlideRec.u !== bt.u ? 'place' : null;
      return R.reject ? null : { bm: R.cv.transferToImageBitmap(), mf: mfDrawn, cm: cutMarksL, rec: svGlideRec };
    });
  }
  // the motion under way is R's (its schedule, unremapped) -> the frame it shows now, or null
  function svAheadNow(pane) {
    const R = svAhead, A = svMotion();
    if (!R || R.state !== 'done' || !A || SV.offscreen || (SV.drag && SV.drag.moved)) return null;
    const M = R.M;
    if (A.from !== M.from || A.to !== M.to || A.ms !== M.ms || (A === SV.anim) !== M.eased || A.e0 || A.held) return null;
    if (svAheadKey(pane, M) !== R.key) { svAheadDrop(); return null; }
    R.A = A;
    return R.slots[HomRange.aheadIndex(svElapsed(A), AHEAD_DT, R.N - 1)] || null;
  }
  // the frame of the motion under way drawn ahead, shown on the pane: one copy, and the frame's records (its moving paths,
  // cuts' marks and glide record) as the frame drawn live leaves them. False when it has none
  function svAheadShow(pane) {
    const s = svAheadNow(pane);
    if (!s) return false;
    svHeldOn = null;
    pane.setView(S.srcView);
    pane.begin(TH.plane);
    pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.drawImage(s.bm, 0, 0); pane.ctx.restore();
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    mfDrawn = s.mf; cutMarksL = s.cm; cutHandlesL = []; svGlideRec = s.rec;
    svMotionDrawn(svMotion());
    svAhead.shown++;
    return true;
  }
  // motion M started: why it plays live is said once for a chain and reason, with the next words the view says (its
  // frames given up, svAheadLive's why, or its chain's measured cost, svAheadPlan's), and a chain whose cost is not known is
  // measured once the motion ends (svAheadProbe)
  let svAheadNote = null;
  function svAheadStart(M) {
    if (!M || !svAheadCan(M)) return;
    const R = svAhead, plan = svAheadPlan(M);
    if (plan == null) { svAheadProbeM = M; return; }
    const why = R && R.state === 'live' && R.key === svAheadKey(paneL, M) ? R.why : plan === 'time' || plan === 'memory' ? plan : null;
    if (!why || svAheadSaid.has(svAheadKey(paneL, null) + why)) return;
    svAheadSaid.add(svAheadKey(paneL, null) + why);
    svAheadNote = why === 'time' ? $t('The glide draws as it goes: its frames would take too long to prepare.') : why === 'memory' ? $t('The glide draws as it goes: its frames would not fit in memory.') : $t('The glide draws as it goes: a frame could not be prepared exactly.');
  }
  // words the view says, with the note of the motion that just started after them (m: the note, taken already)
  function svAheadTail(text, m = svAheadNote) {
    svAheadNote = null;
    return m ? `${text}. ${m}` : text;
  }
  // The chain's frame cost measured after motion svAheadProbeM ended: AHEAD_PROBE of its frames between its ends drawn
  // off-screen (svAheadDraw), one an idle moment, each timed to the GPU's finish (the fence is polled every few ms, so a
  // frame near AHEAD_MS reads a little high and is drawn ahead rather than played live), their median kept as the chain's
  // cost. It draws only once the chain is ready (svReady: its programs linked, its pole tracks and meshes made), so a frame
  // is not held for them; it waits for that at most AHEAD_PROBE_WAIT_MAX_MS. A frame that is not exact is not timed, and
  // after AHEAD_TRIES of them it gives up; a motion, a wait or an edit stops it. Either way the next motion's end measures
  // the chain again. svAheadProbeLog says how the last probe went
  const AHEAD_PROBE_WAIT_MAX_MS = 60000;
  let svAheadProbeM = null, svAheadProbing = false;
  // { state: 'waiting' (for the chain to be ready), 'drawing', 'done', 'gave up' (AHEAD_TRIES frames not exact, or the wait
  // past its cap: why), 'stopped' (a motion, a wait or an edit); frames: timed, rejects: each frame not kept's reason
  // (svAheadDraw's R.reject), waited: ms waiting for the chain, cost: the median kept }, or null before the first
  let svAheadProbeLog = null;
  const svAheadIdle = (f) => (window.requestIdleCallback ? window.requestIdleCallback(() => f(), { timeout: AHEAD_IDLE_TIMEOUT_MS }) : setTimeout(f, AHEAD_IDLE_FALLBACK_MS));
  function svAheadProbe() {
    const M = svAheadProbeM;
    if (!M || svAheadProbing || !svAheadCan(M) || svAheadPlan(M) != null) { svAheadProbeM = null; return; }
    svAheadProbeM = null; svAheadProbing = true;
    const key = svAheadKey(paneL, null), xs = HomRange.aheadPlaces(M.from, M.to, M.ms, M.eased, AHEAD_DT), N = xs.length - 1;
    const R = { M, xs, N, cv: null, reject: null }, ks = [N >> 2, N >> 1, (3 * N) >> 2].map((k) => Math.max(1, Math.min(N - 1, k)));
    const costs = [], t0 = performance.now(), log = svAheadProbeLog = { state: 'waiting', frames: 0, rejects: [], waited: 0, cost: null, why: null };
    const end = (state, why = null) => { svAheadProbing = false; log.state = state; log.why = why; };
    const step = async () => {
      if (SV.anim || SV.play || SV.gate || (SV.drag && SV.drag.moved) || svAheadKey(paneL, null) !== key || !svAheadCan(M)) { end('stopped'); return; }
      if (log.state === 'waiting') {
        log.waited = Math.round(performance.now() - t0);
        if (!svReady().ready) { if (log.waited > AHEAD_PROBE_WAIT_MAX_MS) end('gave up', 'not ready'); else svAheadIdle(step); return; }
        log.state = 'drawing';
      }
      const t1 = performance.now(), f = svAheadDraw(R, ks[costs.length]);
      if (!f) {
        log.rejects.push(R.reject);
        if (log.rejects.length >= AHEAD_TRIES) end('gave up', 'not exact'); else svAheadIdle(step);
        return;
      }
      f.bm.close();
      await GLR.gpuDone(AHEAD_FENCE_MAX_MS);
      costs.push(performance.now() - t1);
      log.frames = costs.length;
      if (costs.length < AHEAD_PROBE) { svAheadIdle(step); return; }
      if (svAheadKey(paneL, null) !== key) { end('stopped'); return; }
      log.cost = +costs.sort((a, b) => a - b)[costs.length >> 1].toFixed(2);
      svAheadCost.set(key, log.cost);
      end('done');
    };
    svAheadIdle(step);
  }
  // TEST-HOOK (dropped from the published page by build.py)
  // the frames' state: null, or { state, why, n, N, shown, rejects, live, recs: each slot made's glide path, slots: how many
  // are held }; the chain's measured frame cost (ms), null while it is not measured; the last probe's log (svAheadProbeLog);
  // and svAheadTest set ({ ms, waitMs, cap }, a key's null the app's own)
  const svAheadCostNow = () => { const c = svAheadCost.get(svAheadKey(paneL, null)); return c == null ? null : +c.toFixed(2); };
  const svAheadHook = () => { const R = svAhead; return R && { state: R.state, why: R.why, n: R.n, N: R.N, shown: R.shown, rejects: R.rejects, live: R.live, recs: R.kept.slice(), slots: R.slots.filter(Boolean).length }; };
  const svAheadProbeHook = () => svAheadProbeLog && Object.assign({}, svAheadProbeLog, { rejects: svAheadProbeLog.rejects.slice() });
  // what svAheadPlan says of the chain's glides at each speed over one and over two planes (svGo's time: the speed's a plane times the planes), with the inputs
  // it reads: the chain's cost, the pane's frame size, the three limits; null while the cost is not measured
  const svAheadPlanHook = () => {
    const c = svAheadCost.get(svAheadKey(paneL, null));
    if (c == null) return null;
    const rows = [];
    for (const speed of Object.keys(SV_SPEEDS)) {
      for (const planes of [1, 2]) {
        const ms = SV_SPEEDS[speed] * planes, N = Math.max(1, Math.ceil(ms / AHEAD_DT));
        rows.push({ speed, planes, ms, N, plan: svAheadPlan({ ms }), fillMs: +(c * N).toFixed(1), bytes: N * paneL.pw * paneL.ph * 4 });
      }
    }
    return { cost: +c.toFixed(2), pw: paneL.pw, ph: paneL.ph, dpr: paneL.dpr, liveMs: aheadMs(), waitMs: aheadWaitMs(), budget: aheadBudget(), rows };
  };
  const svAheadTune = (o) => { svAheadTest = Object.assign(svAheadTest || {}, o); };
  // TEST-HOOK
