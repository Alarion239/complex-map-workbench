  // ---------------- exact images: the inverse path (SPEC 2.1, 2.2, 10) ----------------
  // A mapped area is drawn per pixel through the closed-form inverse of the chain (GLR.drawInverse) when the map and
  // the shape allow it; otherwise forward, as before (mesh + fix-ups). Phase flags (SPEC 11.0): P2 enabled the right
  // plane (flat); P3 the globes (Y Sphere, role R; X Sphere, role L, also at stage 0) and the left plane at a focused
  // stage (role L, flat). Thumbnails (role null) draw like the right plane.
  const PHASE = { R: { flat: true, globe: true }, L: { flat: true, globe: true } };
  const forceFwd = new Set();          // shape ids drawn forward whatever their eligibility (tests: mixed paths)
  let hideStrokes = false;             // tests: the flat panes' shape strokes left out (the crack test reads the fill under them)
  // the figure export's art layer (figure.js, artRender): fills only (no grid, axes, strokes, points, cuts, rulers,
  // chevrons, roots, field of view, deformation tint or outline, landscape labels); printInk: the print tones of
  // the fills; artLand: the landscape's camera, read back for the figure's vector floor labels
  let artMode = false, printInk = null, artLand = null;
  // (export round 3) the globe's camera in the art layer: the figure draws the globe's labels, points and paths as vectors
  let artGlobe = null;
  // (export review r3, video) the camera is recorded for every export render, also in the screen's light look
  let artCam = false;
  // (export review r3, editor-9) open sets whose globe boundary the figure draws itself, dashed (the GL lines of a
  // sphere cannot dash): their lines are left out of the art layer
  let artSkip = null;
  // (export review r3, verify-editor-8) a video frame of a globe: the figure draws the sphere's labels itself
  let artNoLab = false;
  let offRender = false;               // renderOff (figure export) is drawing: no cost guard, no half resolution
  // a map spec that applies no live step: drawn without the chain, as today (GLR's isIdent)
  function isIdentMap(m) {
    const mode = m.mode || 0;
    const lo = mode === 0 ? (m.a || 0) + 1 : (m.base || 0) + 1, hi = Math.max(mode === 1 ? (m.hi || 0) : (m.b || 0), mode === 1 || mode === 3 ? (m.post || 0) : 0);
    for (let k = Math.max(1, lo); k <= Math.min(hi, nSteps()); k++) if (stepActive(k)) return false;
    return true;
  }
  // SPEC 10.5: a paused homotopy at a step boundary is the stage map it equals (mode 0), so the transport open and
  // paused there shows the exact image and closing it does not pop. Only while nothing plays, and only for steps whose
  // homotopy has H_0 = id and H_1 = f exactly (Inverse.homExact); the linear homotopy is exact at its ends.
  function normalizeMap(map) {
    const mode = map.mode || 0;
    if (!mode || morph.playing || trans.k) return map;
    const t = map.t, base = map.base || 0;
    // (v16: with a bracket's post, H_t = Q o G_t o P is a still map only at its end, and only once the bracketed steps
    // after the running one are inactive: the stages base..post; its start skips the running step but not the post)
    if ((mode === 1 || mode === 3) && (map.post || 0) > (map.b || 0)) {
      if (t !== 1) return map;
      const lo = mode === 1 ? (map.hi || 0) - 1 : map.a || 0;
      if (mode === 1) for (let j = (map.hi || 0) + 1; j <= (map.b || 0); j++) if (stepActive(j)) return map;
      for (let j = lo + 1; j <= (mode === 1 ? map.hi || 0 : map.b || 0); j++) {
        if (stepActive(j) && (isDeriv(j) || !(Inverse.homExact(S.steps[j - 1])))) return map;
      }
      return { mode: 0, a: base, b: map.post };
    }
    if (mode === 1) {
      const k = map.hi || 0, st = S.steps[k - 1];
      if (st && st.on !== false && !isDeriv(k) && !(Inverse.homExact(st))) return map;
      if (t === 1) return { mode: 0, a: base, b: k };
      if (t === 0) return { mode: 0, a: base, b: Math.max(base, k - 1) };
    } else if (mode === 2) {
      if (t === 0) return { mode: 0, a: base, b: map.a || 0 };
      if (t === 1) return { mode: 0, a: base, b: map.b || 0 };
    } else if (mode === 3) {
      // all at once: exact at its ends when every step's homotopy is (Inverse.homExact)
      for (let k = (map.a || 0) + 1; k <= (map.b || 0); k++) {
        const st = S.steps[k - 1];
        if (stepActive(k) && (isDeriv(k) || !(Inverse.homExact(st)))) return map;
      }
      if (t === 0) return { mode: 0, a: base, b: map.a || 0 };
      if (t === 1) return { mode: 0, a: base, b: map.b || 0 };
    }
    return map;
  }
  // Inverse.planChain per stage range and chain signature (parameter values included: a scrub makes new plans)
  const invPlans = new Map();
  function invPlan(a, b) {
    const ck = `${a}|${b}|${chainSig[nSteps()]}`;
    let p = invPlans.get(ck);
    if (!p) {
      try { p = Inverse.planChain(S.steps, built, a, b); } catch (e) { p = { ok: false, reason: 'plan: ' + (e && e.message), ops: [] }; }
      p._ck = ck;
      if (invPlans.size >= 32) invPlans.clear();
      invPlans.set(ck, p);
    }
    return p;
  }
  // the shape-level preparation (SPEC 3.6) and the image box of the scissor (4.8), cached by plan, clipWin and shape;
  // prepMs: the preparation work of the current frame (SPEC 10.2: past 4 ms, an uncached bounded shape waits a frame)
  const invPreps = new Map(), invSings = new Map();
  let prepMs = 0, prepDeferred = false;
  const winKey = () => `${clipWin.x0},${clipWin.x1},${clipWin.y0},${clipWin.y1}`;
  function shapeBounded(s) {
    if (s.complement) return false;
    let b = null;
    try { b = s.kind === 'formula' ? Region.formulaBox(s) : Region.bboxOf(s); } catch (e) { b = null; }
    return !!b && [b.x0, b.x1, b.y0, b.y1].every(Number.isFinite);
  }
  function invSing(plan) {
    const k = plan._ck + '|' + winKey();
    let v = invSings.get(k);
    if (!v) {
      try { v = Inverse.accumulation(plan, clipWin); } catch (e) { v = []; }
      if (invSings.size >= 32) invSings.clear();
      invSings.set(k, v);
    }
    return v;
  }
  function invPrep(plan, s, budget) {
    const key = `${plan._ck}|${winKey()}|${shapeKey(s)}`;
    let e = invPreps.get(key);
    if (e) { invPreps.delete(key); invPreps.set(key, e); return e; }
    if (budget && prepMs > 4 && shapeBounded(s)) { prepDeferred = true; return null; }
    const t0 = performance.now();
    let prep;
    try { prep = Inverse.prepare(plan, { win: clipWin, shape: s, sing: invSing(plan) }); } catch (err) { prep = { ok: false, reason: 'prepare: ' + (err && err.message) }; }
    prepMs += performance.now() - t0;
    e = { key, prep, box: undefined };
    invPreps.set(key, e);
    if (invPreps.size > 64) invPreps.delete(invPreps.keys().next().value);
    return e;
  }
  // SPEC 4.8: a conservative w-box of a bounded shape's image (rigorous disc enclosures through the whole op list:
  // Inverse.imageBox; cuts and folds inside the shape are covered), or null (unbounded, or a pole in reach: no scissor)
  // While the user scrubs (every frame a new plan: the cache misses for every shape), only the first, coarser pass
  // runs (still a conservative enclosure: a slightly larger scissor); the refinement follows on the first quiet frame
  // (P2 review: eight polygons cost 4 ms of main thread per scrub frame).
  const BOX_RE = { kind: 'add', e: C(1, 0) }, BOX_IM = { kind: 'add', e: C(0, 1) };
  function invBox(e, plan, s, budget) {
    if (e.box !== undefined && !(e.boxCoarse && !interacting())) return e.box;
    if (budget && prepMs > 2) return e.box !== undefined ? e.box : null;
    const coarse = !!budget && interacting();
    let box = null;
    if (shapeBounded(s) && plan.ops.length) {
      const t0 = performance.now();
      try {
        const one = (coord) => {
          let r = Inverse.imageBox(plan.ops, s, coord, Infinity, { cap: 256 });
          if (r.empty || !(Number.isFinite(r.lo) && Number.isFinite(r.hi))) return null;
          if (r.hi > r.lo && !coarse) {
            const q = Inverse.imageBox(plan.ops, s, coord, (r.hi - r.lo) / 64, { cap: 1024 });
            if (!q.empty && Number.isFinite(q.lo) && Number.isFinite(q.hi)) r = q;
          }
          return r;
        };
        const x = one(BOX_RE), y = x && one(BOX_IM);
        if (x && y) box = { x0: x.lo, x1: x.hi, y0: y.lo, y1: y.hi };
      } catch (err) { box = null; }
      prepMs += performance.now() - t0;
    }
    e.box = box; e.boxCoarse = coarse;
    return box;
  }
  // ---- the cost guard (SPEC 10.12): the GPU time of each live pane's frame against a fixed 60 Hz budget (the user's
  // rule: "60 fps is enough"; the display's refresh plays no part). When a pane's motion frames stay over it, their
  // inverse passes render at half resolution; only if that is not enough do the pane's bounded clean shapes go forward
  // (the last resort). A level is left by a probe of the finer one (hysteresis; GLR.CostGuard). Per scene and chain
  // structure, B class and dpr (the guard key).
  // The budget per pane follows the perf suite's 60 fps frame of 14 ms (compare_perf.py BUDGET60, the lead's decision of
  // 2026-10-20): a frame is the pane's reading + 2.2 ms (main thread, blit, sync) + 1.8 ms (the other pane's forward
  // redraw at dpr 2), so 14 - 2.2 - 1.8 = 10 ms; the exit stays 3 ms below it. Under the user's rule ("60 fps is
  // enough"; motion frames must look like rest frames) half resolution is only the safety net for a GPU whose measured
  // frames would leave 60 fps, never a prediction (the predicted floor of 13.14 is withdrawn: full-resolution frames of
  // the heaviest panes, exp(H) and z^i(H) at alpha <= 0.5 and dpr 2, measured 12.6-14.6 ms p95 on the suite's M4).
  const GUARD_OPTS = { budget: 10, exit: 7 };
  let guard = GLR.CostGuard ? GLR.CostGuard(GUARD_OPTS) : null;
  const paneState = () => ({ view: '', t: 0, inv: false, motion: false, lv: 0, qs: [], reads: [], readsLv: 0, nq: 0, key: '', demoted: false, halfT: 0, half: false, full: false, burst: 0, lastMotion: -1e9 });
  const paneG = { R: paneState(), L: paneState() };
  const guardLog = [];   // the last measurements fed to the guard (for the test hooks)
  // a shape the guard may demote: bounded and clean (its image box is finite: no pole or essential singularity in reach)
  const guardDemotes = (role, s, plan, e) => !!guard && (role === 'R' || role === 'L') && guard.state(role).demote && invBox(e, plan, s) !== null;
  // once per live pane frame, before its fills: feed the guard (timer results, or the frame lag) -> {half}
  // Measurement refinements (the policy itself is GLR.CostGuard's): the first GUARD_GRACE motion frames after a pause
  // do not count (an idle Apple GPU runs at a low clock for its first frames: 8 ms readings for a 3 ms pass), and each
  // reading is the median of the pane's last 3 at the same level (one slow frame is not a trend). Each reading carries
  // the level its frame was drawn at (0 full, 1 half, 2 half and demoted; -1: neither, ignored). A pane whose last
  // frame was drawn at half resolution is redrawn at full resolution as soon as the input ends (pointer up, or 45 ms
  // without input). Without timer queries the guard reads the frame's lag (the time from the request of an animation
  // frame to its start: a GPU behind its frames delays them) instead of the time between two frames of the pane, which
  // for input-driven frames is the input's spacing (a notched wheel, a slow drag: 80 ms intervals demoted cheap scenes,
  // P2 review). Half resolution is used only within continuous motion (the previous frame of the pane less than
  // HALF_SETTLE ms ago): an isolated event (a wheel notch) draws at full resolution, never soft then sharp.
  const GUARD_GRACE = 4, GUARD_EVERY = 2, HALF_SETTLE = 45;
  let rafReqT = 0, frameLag = 0;
  const drawnLevel = (demoted, half) => (demoted ? (half ? 2 : -1) : half ? 1 : 0);
  // the live panes that drew inverse passes in this animation frame, and their measured entries: when both panes drew
  // them, each reading gets half of the frame's GPU budget (frame() marks the entries at its end)
  const invPaneQ = { L: null, R: null, drew: { L: false, R: false } };
  // SPEC 10.12 (13.14): the level a pane's inverse passes need in motion, predicted from their structure: 1 (half
  // resolution) when GLR.inverseEstimate puts the pane's passes over HALF_EST ms of the suite's M4 at full clock. The
  // GPU's clock follows its load (a frame with twice the work took 1 ms longer, 13.14), so a pane whose exact passes
  // do not fit the GPU's low clock runs its motion frames at the 60 fps ceiling, and the timer readings show the clock
  // rather than the work; the measured guard needed ~14 motion frames to trip besides. The prediction makes the
  // motion frames of a heavy pane (exp(H), z^i(H) at alpha <= 0.5 and dpr 2) cheap from the first contiguous frame;
  // still frames, thumbnails and exports stay full resolution and exact, and a slower GPU still trips the guard.
  const HALF_EST = 2.2;
  function predictLevel(list, map, role, pane, recs) {
    if (!GLR.inverseEstimate) return 0;
    const px = pane.pw * pane.ph, k = pane.view.s * pane.dpr;
    let est = 0;
    for (const s of list) {
      if (kindType(s) !== 'area') continue;
      const p = pathOf(s, map, role, 'flat', { recs, budget: true });
      if (p.path !== 'inverse') continue;
      const b = p.e && p.e.box;
      const a = b && [b.x0, b.x1, b.y0, b.y1].every(Number.isFinite) ? Math.min(px, Math.max(0, (b.x1 - b.x0) * k + 8) * Math.max(0, (b.y1 - b.y0) * k + 8)) : px;
      est += GLR.inverseEstimate(p.prep, S.alpha * dimK(s), S.alpha, a);
    }
    return est > HALF_EST ? 1 : 0;
  }
  function guardFrame(side, pane, key, floor = 0) {
    const g = paneG[side];
    const now = performance.now();
    const contiguous = g.t > 0 && now - g.t < HALF_SETTLE;
    const vk = `${pane.view.cx},${pane.view.cy},${pane.view.s},${pane.pw}x${pane.ph}`;
    let motion = vk !== g.view || !!drag || tweens.length > 0 || now - lastChangeT < 200;
    g.view = vk;
    if (g.full) { g.full = false; motion = false; }          // the settle frame after half-resolution motion
    if (key !== g.key) { g.key = key; g.demoted = false; g.reads = []; guard.frame(side, { key }); }
    if (motion) {
      if (now - g.lastMotion > 300) g.burst = 0;
      // a new motion burst: the guard may probe the finer level for it (hysteresis)
      if (++g.burst === 1) guard.burst(side, now);
      g.lastMotion = now;
    }
    const counts = motion && g.burst > GUARD_GRACE;
    const timed = GLR.timer && GLR.timer.available;
    // (results are polled only while brackets are outstanding: the poll's disjoint check is a GL query of its own)
    if (timed) {
      for (const r of paneG.R.qs.length || paneG.L.qs.length ? GLR.timer.poll() : []) {
        const q = paneG[r.tag];
        if (!q) continue;
        const i = q.qs.findIndex((x) => Math.abs(x.t - r.t) < 2);
        const e = i >= 0 ? q.qs[i] : null;
        if (i >= 0) q.qs.splice(0, i + 1);
        if (!e || !e.inv) continue;                            // a frame without inverse passes says nothing
        // (the median of the last 3 readings at the same level)
        if (e.lv !== q.readsLv) { q.reads = []; q.readsLv = e.lv; }
        q.reads.push(r.ms); if (q.reads.length > 3) q.reads.shift();
        const ms = q.reads.length < 3 ? r.ms : q.reads.slice().sort((x, y) => x - y)[1];
        const gs = guard.frame(r.tag, { key: q.key, motion: e.motion, gpuMs: ms, inverse: true, level: e.lv, share: e.share || 1, t: now });
        guardLog.push([r.tag, +r.ms.toFixed(2), e.motion, `${e.lv}>${gs.level}`, gs.over]); if (guardLog.length > 160) guardLog.shift();
      }
    } else if (g.t && now - g.t < 250) {
      const gs = guard.frame(side, { key, motion: g.motion, gpuMs: null, intervalMs: frameLag, inverse: g.inv, level: g.lv, t: now });
      guardLog.push([side, 'lag', +frameLag.toFixed(1), g.motion && g.inv, `${g.lv}>${gs.level}`]); if (guardLog.length > 160) guardLog.shift();
    }
    g.t = now; g.motion = counts; g.inv = false;
    if (guard.setFloor) guard.setFloor(side, floor, now);
    const st = guard.state(side);
    if (st.demote && !g.demoted) { g.demoted = true; scheduleFix(); }
    if (!st.demote && g.demoted) { g.demoted = false; requestRender(side); }   // recovered: the shapes return to inverse
    return { motion: counts, half: st.half && motion && contiguous, demoted: st.demote, timed };
  }
  // the view is in continuous motion (a drag, a tween, a transition, a playing morph, a wheel, a slider or a scrub of
  // changes): an inverse program never drawn yet is not drawn now (its first draw stalls the GPU process), another
  // ready B class or the forward stand-in takes its place (gl.js drawInverse) and it is warmed at the next quiet
  // moment. A single discrete change (an example, a toggle) or a hover is not motion: its program draws as soon as it
  // is ready (P2 review gate: holding it back added 200-300 ms to every example load)
  function interacting() {
    const now = performance.now();
    return !!(drag || tweens.length || camTweens.length || trans.k || (morph.playing && morph.open) || now - motionInT < 150 || now - scrubT < 150 || camSpin());
  }
  // a camera still turning after its drag was let go (its momentum) moves too: those frames were drawn as rest frames,
  // each at a new distance, and All sheets at the Max mesh rebuilt their refinement in every one (r3 review speed-1)
  function camSpin() {
    try { for (const c of [cam, camL, camS]) if (c && (Math.abs(c.vyaw) > 1e-4 || Math.abs(c.vpitch) > 1e-4)) return true; } catch (e) { /* (before the cameras exist) */ }
    return false;
  }
  // An inverse program that landed is warmed (GLR.warmInverse: a one-pixel draw with a real pass's state builds its
  // Metal pipeline, the 75-205 ms first-draw stall of the GPU process) as soon as nothing moves: at once when its compile
  // lands (GLR.onReady) or a live frame finds it cold, else polled every 100 ms until the motion ends; then the panes
  // redraw with it. Live frames never draw a cold program (drawInverse coldOk false: the forward stand-in or another
  // warm B class shows meanwhile), so the stall never lands inside a pan, a zoom, a transition or a frame.
  // Half-resolution pipelines (a refused half draw asked for one; full resolution draws meanwhile) are not urgent: they
  // are warmed only after WARM_HALF_IDLE ms without motion (drags, wheels, sliders, scrubs; a hover does not count, or
  // a pointer resting on a pane would hold it off for good), so their stall does not meet the next gesture (P2 gate: a
  // 117 ms wheel latency when one landed between two wheel gestures).
  // (A pane predicted to need half resolution, predictLevel, gets its half pipelines with its first warm-up, or at the
  // next quiet moment: its motion frames are half resolution from the first gesture on.)
  const WARM_HALF_IDLE = 1000;
  let warmT = 0, warmDue = 0;
  const halfPred = { L: 0, R: 0 };
  function scheduleWarm(delay = 100) {
    const due = performance.now() + delay;
    if (warmT) { if (due >= warmDue) return; clearTimeout(warmT); }
    warmDue = due;
    warmT = setTimeout(() => {
      warmT = 0;
      const need = GLR.ok && GLR.inverseColdState ? GLR.inverseColdState() : 0;
      if (!need) return;
      if (interacting()) { scheduleWarm(); return; }
      const idle = performance.now() - Math.max(motionInT, scrubT);
      const pred = halfPred.L > 0 || halfPred.R > 0;
      if (pred && GLR.wantHalf) GLR.wantHalf();
      if (need === 1 && !pred && idle < WARM_HALF_IDLE) { scheduleWarm(Math.max(50, WARM_HALF_IDLE - idle)); return; }
      if (GLR.warmInverse(need === 1 || pred)) requestRender('L', 'R', 'T');
    }, delay);
  }
  // the settle frame of a pane that drew half resolution in motion
  function halfSettle(side, ms) {
    const g = paneG[side];
    clearTimeout(g.halfT);
    g.halfT = setTimeout(() => { g.halfT = 0; if (!g.half) return; g.half = false; g.full = true; requestRender(side); }, ms);
  }
  window.addEventListener('pointerup', () => { for (const k of ['R', 'L']) if (paneG[k].half) halfSettle(k, 0); }, { capture: true, passive: true });
  // the logical path a live view last drew a shape with: a shape that turns forward needs its fix-ups (SPEC 10.4)
  const lastPath = new Map();
  function notePath(role, id, path) {
    const k = role + '|' + id, prev = lastPath.get(k);
    if (prev === path) return;
    lastPath.set(k, path);
    if (path === 'forward' && prev && prev !== 'forward') scheduleFix();
    if (path === 'inverse') dropStandIn(k);
  }
  // (v16.1) the forward stand-ins a live pane drew for a shape while its inverse program compiled: role|id -> [[res,
  // cacheKey], ...]. Once that shape draws inverse there, their map-cache evaluations are freed (GLR.dropCached); before
  // v16 a mesh rebuild soon after the load freed them by chance (gate v16 perf: sphere.logUHP held 1.2 MB more)
  const standIns = new Map();
  function noteStandIn(role, id, pairs) {
    const k = role + '|' + id, have = standIns.get(k) || [];
    for (const q of pairs) if (q[0] && q[1] && !have.some((h) => h[0] === q[0] && h[1] === q[1])) have.push(q);
    if (have.length) standIns.set(k, have);
  }
  function dropStandIn(k) {
    const have = standIns.get(k);
    if (!have) return;
    standIns.delete(k);
    if (GLR.dropCached) for (const [res, key] of have) GLR.dropCached(res, key);
  }
  let invFailKey = '', invThrew = false;
  let thumbNotFinal = false;   // a thumbnail drew a forward stand-in for an inverse program still compiling
  let sideDraw = false;    // renderExampleThumb: a side chain (GLR side mode) is drawing
  // live panes that drew a forward stand-in while the inverse program compiled: any draw that finds the program
  // ready (a thumbnail can finish its link first, without GLR.onReady) redraws them
  const invWaiting = new Set();
  let lastRecs = null;     // the shape records of the last packShapes (GLR.packShapes: once per scene draw)
  // SPEC 2.2: the path of area shape s under map in a view (role 'R' | 'L' | null: thumbnail; viewKind 'flat' |
  // 'globe') -> {path: 'inverse' | 'pending' | 'forward', reason, m (normalised map), plan, prep, e}. Drawing asks
  // without o.status ('inverse' = eligible: drawInverse decides between drawn, pending and error); fix-up gating and
  // the test hooks ask with o.status (the program's state, without starting a compile).
  function pathOf(s, map, role, viewKind = 'flat', o = {}) {
    const F = (reason) => ({ path: 'forward', reason });
    if (!GLR.ok || !GLR.drawInverse) return F('no WebGL2 inverse renderer');
    const m = normalizeMap(map);
    if ((m.mode || 0) !== 0) return F(morph.playing || trans.k ? 'homotopy playing' : 'paused inside a step (homotopy)');
    // (on a globe an identity map draws inverse too: the walk is the pixel's own point, so a region through infinity
    // covers the north pole exactly, where the lifted mesh left a hole; panels.md 11, the stage-0 globe inverse)
    if (isIdentMap(m) && viewKind !== 'globe') return F('identity map');
    if (S.exactImages === false) return F('exact images off');
    if (!(PHASE[role || 'R'] || {})[viewKind]) return F(`${role || 'R'} ${viewKind}: not in this phase`);
    const plan = invPlan(m.a || 0, m.b || 0);
    if (!plan.ok) return F(plan.reason || 'no inverse');
    if (s._err) return F('invalid shape');
    if (forceFwd.has(s.id)) return F('forced forward');
    const recs = o.recs || lastRecs, rec = recs && recs.get(s.id);
    if (rec && !rec.ok) return rec.pending ? { path: 'pending', reason: rec.reason } : F(rec.reason || 'shape record');
    const e = invPrep(plan, s, !!o.budget);
    if (!e) return F('preparation deferred a frame');
    if (!e.prep.ok) return F(e.prep.reason || 'shape not eligible');
    if (!offRender && viewKind === 'flat' && guardDemotes(role, s, plan, e)) return F('cost guard');
    const out = { path: 'inverse', reason: null, m, plan, prep: e.prep, e };
    if (o.status) {
      const st = GLR.inverseStatus(S.alpha, viewKind), info = GLR.inverseInfo;
      // the query itself can land a compile (no GLR.onReady then): redraw the panes still showing a stand-in
      if (st === 'ready' && invWaiting.size) { const w = [...invWaiting]; invWaiting.clear(); requestRender(...w, 'T'); }
      if (st === 'pending' || (st === 'none' && info && info.ok)) { out.path = 'pending'; out.reason = 'compiling'; }
      else if (st === 'error') return F('inverse program failed to compile');
      else if (st === 'none') return F((info && info.reason) || 'no inverse program');
    }
    return out;
  }
  // starts the inverse compile for map (mode 0) when some visible area shape of the right plane could draw inverse
  function requestInverseFor(map) {
    if (!GLR.inverseRequest || !GLR.packShapes || S.exactImages === false || !PHASE.R.flat) return;
    if (isIdentMap(map) || !invPlan(map.a || 0, map.b || 0).ok) return;
    const list = S.shapes.filter((s) => s.visible !== false && kindType(s) === 'area' && !s._err);
    if (!list.length) return;
    cmFormAnchor('X');
    GLR.packShapes(S.shapes.filter((s) => s.visible !== false));
    if (GLR.inverseRequest(S.alpha, 'flat') === 'pending') invWaiting.add('R');
  }
  // a short message over a plane (GPU problems, an idle Cauchy or Integral view): a level-2 chip like the DOM ones
  // (--overlay, 1px --line-strong, --shadow-1, --r-2, --ink-2 text), wrapped to at most 360px, below the centre
  function paneNote(pane, text) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.font = `13px ${TH.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const maxW = Math.max(80, Math.min(360, pane.w - 48));
    const lines = [];
    let line = '';
    for (const w of String(text).split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    const tw = Math.min(pane.w - 16, Math.max(...lines.map((t) => ctx.measureText(t).width)));
    const bw = Math.round(tw + 24), bh = lines.length * 18 + 14;
    const x0 = Math.round(pane.w / 2 - bw / 2) + 0.5, y0 = Math.round(Math.min(pane.h - bh - 56, pane.h / 2 + 28)) + 0.5;   // below the centre, clear of a point at the view's middle
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, bw, bh, 3); else ctx.rect(x0, y0, bw, bh);
    ctx.shadowColor = TH.dark ? '#00000066' : '#121A201A'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.fillStyle = withAlpha(TH.surface, 0.92); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = TH.lineStrong; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = TH.ink2;
    lines.forEach((t, i) => ctx.fillText(t, pane.w / 2, y0 + 7 + 9 + i * 18));
    ctx.restore();
  }
  // after a GPU frame: say why shapes are missing when the chain's shader failed (spec 8.6), and (issue #72) that the
  // GPU is still preparing the frame's programs when it has waited for them over 1.5 s (a cold link on Direct3D 11
  // takes seconds, or minutes; the browser's program cache keeps them for later visits)
  const gpuWait = new Map();   // screen pane (paneL, paneR) -> when its frames began waiting for programs
  function glStatusNote(pane) {
    const st = GLR.frameStatus ? GLR.frameStatus() : null;
    if (st && st.error) { paneNote(pane, st.error); setLed(pane === paneL ? 'L' : 'R', 'err', st.error); }
    // (the screen's panes only: an export's off-screen pane is drawn once and dropped)
    if (pane !== paneL && pane !== paneR) return;
    if (!st || !st.pending) { gpuWait.delete(pane); return; }
    const now = performance.now();
    // (the first waiting frame: one more frame when the 1.5 s are up, if nothing landed by then)
    if (!gpuWait.has(pane)) { gpuWait.set(pane, now); setTimeout(() => requestRender(pane === paneL ? 'L' : 'R'), 1600); return; }
    const n = GLR.pendingLinks || 0;
    if (n && now - gpuWait.get(pane) > 1500) paneNote(pane, $t('Preparing the GPU… (first time only; shaders left: {n})', { n }));
  }
  // Draw graph paper, fills and curves of every visible shape under the GPU map 'map'.
  // opt: {thin (thumbnail), L, cache, domain, noGrid, under (draws before the fills), arcF/arcKey (CPU map for dashes)}
  function drawScene(pane, map, role, opt = {}) {
    const list = S.shapes.filter((s) => s.visible !== false);
    // exact images (SPEC 10.2): when this map may draw inverse, the frame's shape records are packed once, and each
    // area shape takes its path in list order (inverse and forward passes interleave, so list order holds across paths)
    const m0 = normalizeMap(map);
    const live = (role === 'R' || role === 'L') && !offRender && !opt.thin;
    let recs = null, gf = null, timing = false, invN = 0;
    const halfDraws0 = GLR.inverseHalfDraws || 0;
    if (GLR.ok && GLR.packShapes && S.exactImages !== false && (PHASE[role || 'R'] || {}).flat
      && (m0.mode || 0) === 0 && !isIdentMap(m0) && invPlan(m0.a || 0, m0.b || 0).ok) {
      cmFormAnchor('X');
      recs = GLR.packShapes(list).recs;
      if (!sideDraw) lastRecs = recs;
      if (live && guard) {
        const info = GLR.inverseInfo;
        // (the key includes the B class of the opacity: a trip at alpha 0.3 does not hold at alpha 1, P2 review)
        // (no predicted floor: motion stays at full resolution unless the measured frames leave the 60 fps budget;
        // predictLevel stays as a test hook)
        const floor = 0;
        halfPred[role] = 0;
        gf = guardFrame(role, pane, `${info ? info.key : ''}|${m0.a || 0}|${m0.b || 0}|${list.map((x) => x.id + x.kind).join(',')}|${pane.dpr}|B${GLR.inverseB ? GLR.inverseB(S.alpha) : ''}`, floor);
      }
    }
    // Who may start an inverse compile (SPEC 4.4): the live panes and exports (drawInverse starts it once the chain's
    // forward programs have landed). Thumbnails and gallery images only use a program that is already ready: a
    // thumbnail compile during a playing deformation stalled it, and compiled programs that no pane needed
    let invGate = null;
    if (recs && !live && !offRender) {
      const st0 = GLR.inverseStatus(S.alpha, 'flat');
      if (st0 !== 'ready') invGate = st0 === 'pending' ? 'pending' : 'forward';
    }
    // the cost guard's measurement: one TIME_ELAPSED bracket over the pane's whole frame, from before its clear to just
    // before the blit. A query that begins or ends inside a Metal render pass splits it (the reading then carries the
    // split's load and store, and the frame pays for it: +1-2 ms per measured frame at dpr 2 when it ended after the
    // fills, before the strokes); the blit ends the pass anyway. Only counting motion frames are measured, every
    // GUARD_EVERY-th one; still frames, which the guard ignores, never pay for it
    if (gf && gf.timed && gf.motion && paneG[role].nq++ % GUARD_EVERY === 0) {
      const q = paneG[role].qs;
      q.push({ t: performance.now(), motion: gf.motion, inv: false, lv: -1, dem: !!gf.demoted, hd0: GLR.inverseHalfDraws || 0 });
      if (q.length > 32) q.shift();
      timing = GLR.timer.begin(role);
      if (!timing) q.pop();
    }
    const cell = patternCell();
    // a half-resolution motion frame (the cost guard, SPEC 10.12): the leading run of inverse passes (in list order,
    // from the first shape drawn inverse to the next one that is not) goes into the half-size target BEFORE the pane's
    // main pass begins, and is upsampled at the run's place (GLR.beginHalfPre / compositeHalf, 13.14): binding the half
    // target inside the main pass split it, a store and a reload of the multisampled frame that cost as much as half
    // resolution saved. A pass that cannot draw at half resolution yet ends the run and draws in the main pass.
    let preIds = null, preDone = false;
    if (gf && gf.half && GLR.beginHalfPre && !invGate && GLR.beginHalfPre(pane.pw, pane.ph)) {
      preIds = new Set();
      for (const s of list) {
        if (kindType(s) !== 'area') continue;
        const p = pathOf(s, map, role, 'flat', { recs, budget: live });
        if (p.path !== 'inverse') { if (preIds.size) break; continue; }
        const box = invBox(p.e, p.plan, s, live);
        const sc = box ? GLR.scissorOf(box, pane.view, pane.dpr, 4) : null;
        if (sc && !sc[2]) { preIds.add(s.id); continue; }       // its image misses the pane: nothing to draw
        let alpha = S.alpha;
        alpha *= dimK(s);
        const ink = shapeInk(s);
        let res = 'error';
        try {
          res = GLR.drawInverse({
            map: p.m, plan: p.plan, prep: p.prep, shape: s, viewKind: 'flat', view: pane.view, dpr: pane.dpr,
            look: { color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha, alphaOwn: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), stretch: { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) } },
            scissor: sc, half: true, halfPre: true, motion: live && interacting(), coldOk: offRender,
          });
        } catch (err) { res = 'error'; }
        if (res !== 'drawn') break;                             // drawn in the main pass, from here on
        preIds.add(s.id);
        invN++;
        if (invWaiting.size) { const w = [...invWaiting].filter((x) => x !== role || !live); invWaiting.clear(); requestRender(...w, 'T'); }
      }
    }
    GLR.begin(pane.pw, pane.ph);
    if (GLR.drawGrid && !opt.noGrid && !artMode) {
      GLR.drawGrid({ view: pane.view, dpr: pane.dpr, plane: TH.planeRGB, minor: GLR.hexRGB(TH.gridMinor), medium: GLR.hexRGB(TH.gridMedium), major: GLR.hexRGB(TH.gridMajor), axis: TH.axisRGB, unit: S.unit && !opt.thin && !opt.noUnit, unitAlpha: 0.55 });
    }
    if (opt.under) opt.under();
    // the transform-feedback cache key includes the map mode and t, so any still frame may be cached; thumbnails
    // are kept as bitmaps, so they skip the map cache (GLR evaluates them into a scratch texture, as it does the
    // frames of a homotopy); a thumbnail never waits for a compile (a 250 ms stall
    // right after adding a step): it is redrawn when the program is ready (renderThumb, GLR.onReady)
    const cache = opt.cache !== false && !opt.thin;
    const sync = false;
    let arcFn = null;
    const arcF = () => arcFn || (arcFn = opt.arcF || cpuMap(map));
    const arcKey = opt.arcKey || mapKeyOf(map);
    const stretch = { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) };
    if (live) prepDeferred = false;
    for (const s of list) {
      if (kindType(s) !== 'area') continue;
      const r = shapeGPU(s);
      const ink = shapeInk(s);
      let alpha = S.alpha;
      alpha *= dimK(s);
      // drawn in the half-resolution pre-pass: its layer is upsampled here, at the run's first shape
      if (preIds && preIds.has(s.id)) {
        if (!preDone) { GLR.compositeHalf(); preDone = true; }
        if (live) notePath(role, s.id, 'inverse');
        continue;
      }
      let lp = 'forward';
      if (recs) {
        const p = pathOf(s, map, role, 'flat', { recs, budget: live });
        lp = p.path;
        if (p.path === 'inverse' && invGate) {
          lp = invGate === 'pending' ? 'pending' : 'forward';
          if (invGate === 'pending') { if (live) invWaiting.add(role); else thumbNotFinal = true; }
        } else if (p.path === 'inverse') {
          const box = invBox(p.e, p.plan, s, live);
          const sc = box ? GLR.scissorOf(box, pane.view, pane.dpr, 4) : null;
          // an image that misses the pane draws nothing (counted as drawn)
          if (sc && !sc[2]) { if (live) notePath(role, s.id, 'inverse'); continue; }
          let res = 'error';
          try {
            res = GLR.drawInverse({
              map: p.m, plan: p.plan, prep: p.prep, shape: s, viewKind: 'flat', view: pane.view, dpr: pane.dpr,
              look: { color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha, alphaOwn: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), stretch },
              scissor: sc, half: !!(gf && gf.half), motion: live && interacting(), coldOk: offRender,
            });
          } catch (err) { if (!invThrew) { invThrew = true; console.error('exact images: inverse pass failed; drawing forward', err); } }
          if (res === 'drawn') {
            invN++;
            if (live) notePath(role, s.id, 'inverse');
            // the program landed (possibly inside this very call, without GLR.onReady): redraw the other panes that drew
            // a stand-in, and the thumbnails (one drawn forward meanwhile has a stale signature)
            if (invWaiting.size) { const w = [...invWaiting].filter((x) => x !== role || !live); invWaiting.clear(); requestRender(...w, 'T'); }
            continue;
          }
          lp = res === 'pending' ? 'pending' : 'forward';
          if (res === 'pending') { if (live) invWaiting.add(role); else thumbNotFinal = true; }
          // a failed compile (silent: console only) draws forward from now on, with its fix-ups (SPEC 4.4, 10.4)
          if (res === 'error' && GLR.inverseStatus(S.alpha, 'flat') === 'error') {
            const k = (GLR.inverseInfo || {}).key || '';
            if (k !== invFailKey) { invFailKey = k; scheduleFix(); }
          }
        }
        if (live) notePath(role, s.id, lp);
      }
      // the dragged shape's fix-up keeps up with the drag; the pair drawn is the current mesh with its fix-up, or the
      // last complete pair while the current one's is on its way (never an unfixed mesh in motion)
      if (live && role) liveFix(s, r);
      // SPEC 8: a published SphereMesh valid for this view replaces the GPU draw and its fix-ups; while a rebuild runs
      // the old one is drawn inside its guard box, the GPU image around it (exports: the meshes prepareExport built)
      const smd = (live || offRender) && role ? smFor(s, r, role, 'flat', map, pane, 0, live && lp !== 'pending') : null;
      if (smd && smd.e && (!smd.e.data.n || smRes(smd.e))) { if (smd.e.data.n) GLR.drawPreMapped(smd.e.res, smLook(s, pane, alpha, map)); continue; }   // (n 0: nothing of it shows)
      let smOld = null, smOut = null;
      if (smd && smd.old && smRes(smd.old)) {
        const sc = GLR.scissorOf(smd.old.guardBox, pane.view, pane.dpr, 0);
        if (sc === null) { GLR.drawPreMapped(smd.old.res, smLook(s, pane, alpha, map)); continue; }
        if (sc[2] > 0) {
          smOld = sc;
          // the pane around the guard box: up to four rects
          smOut = [[0, 0, pane.pw, sc[1]], [0, sc[1] + sc[3], pane.pw, pane.ph - sc[1] - sc[3]], [0, sc[1], sc[0], sc[3]], [sc[0] + sc[2], sc[1], pane.pw - sc[0] - sc[2], sc[3]]].filter((q) => q[2] > 0 && q[3] > 0);
        }
      }
      const pf = pairFor(s, r, role), pm = pf.p, fx = pf.fx;
      if (!pm.meshRes) { if (smOld) GLR.drawPreMapped(smd.old.res, Object.assign(smLook(s, pane, alpha, map), { scissor: smOld })); continue; }
      // feather only the sides where a stretched mesh is truncated far away, never a real boundary
      let fade = null;
      if (pm.mesh && pm.mesh.stretched && pm.mesh.outer) {
        if (!pm.fadeBox) {
          const o = pm.mesh.outer, op = pm.mesh.open, BIG = 1e30;
          pm.fadeBox = { x0: op.x0 ? o.x0 : -BIG, x1: op.x1 ? o.x1 : BIG, y0: op.y0 ? o.y0 : -BIG, y1: op.y1 ? o.y1 : BIG, w: 0.04 * Math.max(o.x1 - o.x0, o.y1 - o.y0) };
        }
        fade = pm.fadeBox;
      }
      const st = {
        map, view: pane.view, dpr: pane.dpr, L: opt.L || MESH_L, color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB,
        alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), skip: fx ? fx.skip : null, stretch, fade, sync,
        // the fix-up's skip flags are bound per draw and do not change the mapped values: not part of the key
        cacheKey: cache ? `${pm.meshKey}|${mapKeyOf(map)}` : null,
      };
      if (smOut) st.scissors = smOut;
      GLR.drawRegion(pm.meshRes, st);
      const xKey = cache && fx && fx.extraRes ? `x|${fx.mapKey}|${mapKeyOf(map)}` : null;
      if (fx && fx.extraRes) GLR.drawRegion(fx.extraRes, Object.assign({}, st, { skip: null, L: 1, cacheKey: xKey }));
      if (live && role && lp === 'pending' && st.cacheKey) noteStandIn(role, s.id, [[pm.meshRes, st.cacheKey], [fx && fx.extraRes, xKey]]);
      if (smOld) GLR.drawPreMapped(smd.old.res, Object.assign(smLook(s, pane, alpha, map), { scissor: smOld }));
    }
    if (gf) {
      const g = paneG[role];
      g.inv = invN > 0;
      // a half-resolution motion frame is followed by a full one once the motion stops
      g.half = !!(gf.half && invN && (GLR.inverseHalfDraws || 0) > halfDraws0);
      g.lv = drawnLevel(gf.demoted, g.half);
      if (g.half) halfSettle(role, 45);
    }
    // a bounded shape whose preparation waited (frame budget) is drawn inverse on the next frame
    if (live && prepDeferred) { prepDeferred = false; requestRender(role); }
    const halo = GLR.hexRGB(TH.halo);
    for (const s of hideStrokes || artMode ? [] : list) {
      if (kindType(s) === 'point') continue;
      const r0 = shapeGPU(s);
      // the strokes that go with the fill drawn (a hold's own strokes while it stands in for the current mesh)
      const r = role && r0.hold && kindType(s) === 'area' ? linesOf(r0, pairFor(s, r0, role).p) : r0;
      if (!r.lineRes) continue;
      const ink = shapeInk(s);
      const grid = s.kind === 'cgrid' || s.kind === 'pgrid';
      const area = kindType(s) === 'area';
      let w = opt.thin ? 1 : grid ? 1 : area ? 1.5 : 2;
      let cw = opt.thin ? 0 : grid ? 2.5 : area ? 3.5 : 4;
      if (!opt.thin && s.id === selected && opt.domain) { w += 0.75; cw += 0.75; }
      if (!opt.thin && s.id === hoverShape) { w += 0.5; cw += 0.5; }
      const st = { map, view: pane.view, dpr: pane.dpr, M: opt.thin ? 4 : 8, width: w * pane.dpr, color: GLR.hexRGB(ink.edge), alpha: grid ? 0.8 : 1, sync, cacheKey: cache ? `${r.lineKey}|${mapKeyOf(map)}` : null };
      if (cw) st.casing = { color: halo, alpha: TH.haloA, width: cw * pane.dpr };
      // open sets: the boundary is not included, drawn dashed 5/3.5 (spec 6.5)
      if (area && r.open && !opt.thin) { st.dash = [5, 3.5]; st.arc = arcOf(r, arcF(), arcKey); }
      GLR.drawLines(r.lineRes, st);
    }
    if (GLR.flushHalf) GLR.flushHalf();
    // (half: what the frame drew, not what it asked for: a program not yet warm for half resolution draws full)
    if (timing) { GLR.timer.end(); const q = paneG[role].qs; if (q.length) { const e = q[q.length - 1]; e.inv = invN > 0; e.lv = drawnLevel(e.dem, (GLR.inverseHalfDraws || 0) > e.hd0); if (e.inv) invPaneQ[role] = e; } }
    if (live && invN) invPaneQ.drew[role] = true;
    // a ready inverse program that waits for its first draw (or its first half-resolution draw) is warmed at a quiet
    // moment, then the panes redraw with it (P2 review: no 75-200 ms first-draw stall inside a drag or a transition).
    // Thumbnails too: a thumbnail's status query can land a compile (no GLR.onReady then) and find it cold.
    if (recs && !offRender && GLR.inverseColdWaiting) scheduleWarm(interacting() ? 100 : 0);
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (!opt.thin) glStatusNote(pane);
  }
  const PRIMES = ['', '′', '″', '‴'];
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  let figMode = false; // set while a figure is drawn: image points read F(z₀) rather than z₀″
  let figVec = false; // the figure draws the deformation's outline, paths and labels as vectors (the morph figure)
  // a formula as plain text for a tooltip outside English (review eng-10): Tour's reading of TeX, the screen's comma
  const texTitle = (tex) => {
    try {
      const p = Tour._t && Tour._t.texPlain;
      if (!p) return tex;
      // (a fraction of two single symbols or numbers is π/2, not (π)/2: verify-8)
      const one = '(\\\\(?:pi|infty|alpha|gamma|zeta|theta)|[A-Za-z0-9]+(?:\\.[0-9]+)?)';
      const t = I18N.notation(tex).replace(new RegExp(`\\\\[dt]?frac\\{${one}\\}\\{${one}\\}`, 'g'), '$1/$2').replace(/\\times(?![A-Za-z])/g, ' × ').replace(/\\operatorname\{([^{}]+)\}\s*/g, '$1 ').replace(/\\(?:left|right)(?![A-Za-z])\.?/g, '').replace(/\\(?:text|mathrm|textrm)\{([^{}]*)\}/g, '$1')
        .replace(/\\(?:overline|bar)\{([^{}]*)\}/g, (m, a) => (a.length === 1 ? a + '\u0304' : `conj(${a})`)).replace(/\\bar\s*([A-Za-z])/g, '$1\u0304');
      // (× for \times, and a minus sign for '-' except in a Russian word such as «Лог-полярные»)
      return p(t).replace(/(\d)\.(\d)/g, '$1,$2').replace(/-/g, (m, i, str) => (/[А-Яа-яЁё]/.test(str[i - 1] || '') && /[А-Яа-яЁё]/.test(str[i + 1] || '') ? m : '−'));
    } catch (e) { return tex; }
  };
  // an example's word label ('trailing edge') is stored in English and translated where it is shown, so a caption in
  // the other language and a save reopened in the other language read right (review math-5); a user's label is as typed
  const EX_LABELS = new Set(['trailing edge']);
  const exLabel = (l) => (l && EX_LABELS.has(l) ? $t(l) : l);
  // [UX54] a point keeps its subscript for life (gaps allowed): s.num, stored with the shape. Helpers have none. A save
  // with no numbers (earlier builds) takes them from the order, as those builds named the points (the visible ones,
  // then the hidden ones); a point without one (new, pasted, a helper made visible) or with a copy's takes the next
  // after the largest. renumber: every point by its order again (the command palette's Renumber points)
  const numbered = (s) => !!s && s.kind === 'point' && !s.helper;
  function numberPoints(list = S.shapes, renumber = false) {
    const pts = list.filter(numbered);
    let ch = false;
    const set = (s, n) => { if (s.num !== n) { s.num = n; ch = true; } };
    if (renumber || !pts.some((s) => Number.isInteger(s.num))) {
      let n = 0;
      for (const s of pts) if (s.visible !== false) set(s, n++);
      for (const s of pts) if (s.visible === false) set(s, n++);
      return ch;
    }
    const used = new Set(), need = [];
    for (const s of pts) {
      if (Number.isInteger(s.num) && s.num >= 0 && !used.has(s.num)) used.add(s.num);
      else need.push(s);
    }
    let n = used.size ? Math.max(...used) + 1 : 0;
    for (const s of need) set(s, n++);
    return ch;
  }
  // Renumber points, Renumber zeros and poles (the command palette): tidy names again, by order; one undo step
  function renumberPoints() {
    if (!numberPoints(S.shapes, true)) { toast($t('The points are numbered in order already.')); return; }
    shapesChanged(true); commit(); requestRender('L', 'R', 'OL', 'OR');
    undoToast($t('Points renumbered.'));
  }
  function renumberZp() {
    let ch = false;
    for (const st of S.steps) if (Constr.zpRenumber(st)) ch = true;
    if (!ch) { toast($t('The zeros and poles are numbered in order already.')); return; }
    buildPipeline(); updateFocusUI(); commit(); requestRender('L', 'R', 'OL', 'OR');
    undoToast($t('Zeros and poles renumbered.'));
  }
  // the number the next new point takes
  const nextPointNum = () => { let n = -1; for (const s of S.shapes) if (numbered(s) && Number.isInteger(s.num)) n = Math.max(n, s.num); return n + 1; };
  function pointLabel(s, idx, primes) {
    // (v15, review design-6: a new point is z₀, z₁, …; a plain lowercase letter would read as a shared number)
    const base = exLabel(s.label) || 'z' + sub(Number.isInteger(s.num) ? s.num : idx);
    // (a one-panel figure of the deformation draws H_t at the current t: its moving points read H_t(z₀))
    if (figMode && primes > 0 && morphOn() && !figVec) return `Hₜ(${base})`;
    if (primes < 0) return `Hₜ(${base})`;   // (a bracket's moving point with a live post: morphPrimes)
    if (figMode && primes > 0) return `${S.focus === 0 && primes === nSteps() ? 'F' : S.focus > 0 ? `f${sub(S.focus)}` : `w${sub(primes)}`}(${base})`;
    return base + (primes < 4 ? PRIMES[primes] : '⁽' + String(primes).split('').map((d) => SUP[+d]).join('') + '⁾');
  }
