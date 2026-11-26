  // ---------------- exact images: the inverse path (SPEC 2.1, 2.2, 10) ----------------
  // A mapped area is drawn per pixel through the closed-form inverse of the chain (GLR.drawInverse) when the map and
  // the shape allow it; otherwise forward (mesh + fix-ups). Phase flags (SPEC 11.0): the right
  // plane (flat), the globes (Y Sphere, role R; X Sphere, role L, also at stage 0) and the left plane at a focused
  // stage (role L, flat). Thumbnails (role null) draw like the right plane.
  const PHASE = { R: { flat: true, globe: true }, L: { flat: true, globe: true } };
  const forceFwd = new Set();          // shape ids drawn forward whatever their eligibility (tests: mixed paths)
  let hideStrokes = false;             // tests (window.__cmwHideStrokes): the shapes' strokes left out, flat, on the globes, on the Landscape's floor and in the steps view, and the steps view's layer of later planes' regions over the colour (the crack test and sv_globe_mask read the fill under them, p3_review and steps_glide_outline the stroke's own pixels)
  // the figure export's art layer (figure.js, artRender): fills only (no grid, axes, strokes, points, cuts, rulers,
  // chevrons, roots, field of view, deformation tint or outline, landscape labels); printInk: the print tones of
  // the fills; artLand: the landscape's camera, read back for the figure's vector floor labels
  let artMode = false, printInk = null, artLand = null;
  // the globe's camera in the art layer: the figure draws the globe's labels, points and paths as vectors
  let artGlobe = null;
  // (video) the camera is recorded for every export render, also in the screen's light look
  let artCam = false;
  // the art layer's coverage render of the Landscape: the relief alone, no floor plate, box or shadow
  let artRelief = false;
  // open sets whose globe boundary the figure draws itself, dashed (the GL lines of a
  // sphere cannot dash): their lines are left out of the art layer
  let artSkip = null;
  // a video frame of a globe: the figure draws the sphere's labels itself
  let artNoLab = false;
  let offRender = false;               // renderOff (figure export) is drawing: no cost guard, no half resolution
  // a map spec that applies no live step: drawn without the chain (GLR's isIdent)
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
    if (!mode || morph.playing) return map;
    const t = map.t, base = map.base || 0;
    // (with a bracket's post, H_t = Q o G_t o P is a still map only at its end, and only once the bracketed steps
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
  // Inverse.planChain per stage range and chain signature (parameter values included: a scrub makes new plans). A plan
  // whose options are not the chain's (a range that holds a repeat alone, Inverse.rangeOpts) carries its own inverse op
  // list, p.inv (GLChain.buildInverse with the plan's options: a program beside the chain's, marked rest so that it is
  // warmed as the chain's own, GLR.warmInverse), which its draws pass on
  const invPlans = new Map();
  function invPlan(a, b) {
    const ck = `${a}|${b}|${chainSig[nSteps()]}`;
    let p = invPlans.get(ck);
    if (!p) {
      try {
        p = Inverse.planChain(S.steps, built, a, b);
        if (p.ok && p.opts.rept && !Inverse.chainOpts(S.steps, built).rept) p.inv = Object.assign(GLChain.buildInverse(S.steps, built, p.opts), { rest: true });
      } catch (e) { p = { ok: false, reason: 'plan: ' + (e && e.message), ops: [] }; }
      p._ck = ck;
      if (invPlans.size >= 32) invPlans.clear();
      invPlans.set(ck, p);
    }
    return p;
  }
  // the unresolved pixels of the area shapes that map draws by a REPT plan, hatched over the frame open in pane: a region
  // mask's pass leaves them uncovered and marks them (drawScene's opt.fills, GLR.drawInverse), so the picture painted
  // through the mask shows them here
  function reptHatch(pane, map) {
    if (reptExact(map) && GLR.reptHatchFill && GLR.reptHatchFill(pane.dpr) === true) hatchNotes.set(pane, hatchedNote());
  }
  // whether map's chain holds a Repeat block that no exact plan takes: its copies are more ops than a plan holds (planChain's
  // tooLong), and drawn forward through every copy they leave no image to read, so the plane says so (refusedHatch, its note)
  function repeatRefused(map) {
    if (!repeatIn(map)) return false;
    const m = normalizeMap(map), plan = invPlan(m.a || 0, m.b || 0);
    return !plan.ok && !!plan.tooLong;
  }
  // whether map (the plain map, mode 0) carries through a live Repeat block of more than one copy in its range,
  // whatever op its plan draws it with: a REPT op when the repeat is the chain's one live step, the copies' own ops
  // beside another step (Inverse.chainOpts)
  function repeatIn(map) {
    const m = normalizeMap(map);
    return (m.mode || 0) === 0 && S.steps.slice(m.a || 0, m.b || 0).some((st) => st.on !== false && st.repeat && st.repeat.n > 1);
  }
  // what a pane's open frame says of the no-value hatch it drew (reptHatch, refusedHatch), by pane: glStatusNote says it at the
  // frame's end
  const hatchNotes = new Map();
  // the two things a hatch says: a refused repeat's, and a REPT plan's own unresolved pixels (the Plane and the Landscape say them the same)
  const refusedNote = () => $t('This repeated step is too long to draw exactly, so the image of the regions is not known here and the plane is hatched. Fewer copies draw exactly.');
  const hatchedNote = () => $t('Where the plane is hatched, the exact image could not be found.');
  // the no-value hatch over the whole plane drawn in pane for map when its repeat is refused (no image of the regions is known
  // anywhere), after the picture painted through the regions' mask
  function refusedHatch(pane, map) {
    if (repeatRefused(map) && GLR.hatchAll && GLR.hatchAll(pane.dpr)) hatchNotes.set(pane, refusedNote());
  }
  // whether map's exact plan is a REPT op (a Repeat chain drawn by its certified root search)
  function reptExact(map) {
    const m = normalizeMap(map);
    if ((m.mode || 0) !== 0) return false;
    const plan = invPlan(m.a || 0, m.b || 0);
    return plan.ok && plan.ops.some((o) => o.kind === 'REPT');
  }
  // The pieces GLR.drawLines draws each segment of an outline in (its st.M); the most CSS px a piece may span on a
  // pane under a Repeat; the halvings a segment may take to get there; the vertices a refined outline may have
  const OUTLINE_M = 8, REPT_PIECE_PX = 4, REPT_DEPTH = 10, REPT_VERTS = 65536;
  // (for the test hook: the refinements outlineRes has run, a pan within a cell runs none, and the last one's
  // vertices)
  let reptOutlineRuns = 0, reptOutlineVerts = 0;
  // The lines a shape's outline is drawn by on pane under map (r: its shapeGPU record; pane: {view, w, h}, a screen
  // pane or the Landscape floor's stand-in, kept in its own slot of r.rept), with the record openDash reads for them:
  // {res, rec}, or null for none. r's own lines, but under a Repeat (repeatIn: a REPT op or its copies' ops, beside
  // another step), whose copies' expansion can scatter the boundary carried forward: there the drawn polylines
  // (r.lpolys) are refined for the view, each segment halved (at most REPT_DEPTH times) until every one of its pieces
  // maps, on the CPU twin, to finite ends at most REPT_PIECE_PX px apart, or lies with both ends past the same side of
  // a box around the pane, where it draws nothing on it. A segment that does not get there (the gallery's Repeat ×20),
  // or more than REPT_VERTS vertices, and the shape has no outline: the exact fill's own edge is its only one. The rule
  // is the resolution at the view, not the number of copies: the bite at ×2 keeps its outline, zoomed in as at rest. A
  // Repeat no exact plan takes (repeatRefused) has no outline either: its boundary carried through every copy is as
  // scattered, over the hatch. Cached on r per pane by its lines and map, the scale's half octave (refined for its
  // largest scale, so the pieces stay within REPT_PIECE_PX at every scale of it) and the pane's size and place to a
  // pane: the box is the view at the half octave's smallest scale about that place, widened by a pane on each side, so
  // a pan refines again only once it crosses a pane
  function outlineRes(map, r, pane, slot = pane === paneR ? 'R' : 'L') {
    // (one refined outline per pane, so the two panes do not take each other's; given back when the map leaves the
    // Repeat, or the Repeat is refused)
    const had = r.rept && r.rept[slot], inRep = repeatIn(map), refused = inRep && repeatRefused(map);
    if (!inRep || refused) {
      if (had) { GLR.destroy(had.res); r.rept[slot] = null; }
      return r.lineRes && !refused ? { res: r.lineRes, rec: r } : null;
    }
    const ps = r.lpolys, v = pane.view;
    if (!ps || !ps.length) return null;
    const oct = Math.floor(2 * Math.log2(v.s)), sHi = 2 ** ((oct + 1) / 2), sLo = 2 ** (oct / 2);
    const hw = pane.w / 2 / sLo, hh = pane.h / 2 / sLo, gx = Math.round(v.cx / (2 * hw)), gy = Math.round(v.cy / (2 * hh));
    const key = `${r.lineKey}|${r.refKey}|${mapKeyOf(map)}|${oct}|${pane.w}x${pane.h}|${gx},${gy}`;
    if (had && had.key === key) return had.out;
    reptOutlineRuns++;
    if (had) GLR.destroy(had.res);
    const F = cpuMap(map), lim = REPT_PIECE_PX / sHi, cx = 2 * gx * hw, cy = 2 * gy * hh;
    const x0 = cx - 3 * hw, x1 = cx + 3 * hw, y0 = cy - 3 * hh, y1 = cy + 3 * hh;
    // (the sides of the box a point lies past, one bit each)
    const past = (w) => (w.re < x0 ? 1 : 0) | (w.re > x1 ? 2 : 0) | (w.im < y0 ? 4 : 0) | (w.im > y1 ? 8 : 0);
    let verts = 0;
    // the segment a-b (source points, ws their images) into out, halved until its pieces pass; false when it cannot
    const refineSeg = (ax, ay, wa, bx, by, wb, depth, out) => {
      const dx = bx - ax, dy = by - ay;
      let ok = true, p = wa;
      for (let k = 1; k <= OUTLINE_M && ok; k++) {
        const q = k === OUTLINE_M ? wb : F(CX.C(ax + dx * k / OUTLINE_M, ay + dy * k / OUTLINE_M));
        if (!Number.isFinite(p.re + p.im + q.re + q.im)) return false;
        if (!(past(p) & past(q)) && Math.hypot(q.re - p.re, q.im - p.im) > lim) ok = false;
        p = q;
      }
      if (ok) { out.push(bx, by); return ++verts <= REPT_VERTS; }
      if (depth >= REPT_DEPTH) return false;
      const mx = ax + dx / 2, my = ay + dy / 2, wm = F(CX.C(mx, my));
      return refineSeg(ax, ay, wa, mx, my, wm, depth + 1, out) && refineSeg(mx, my, wm, bx, by, wb, depth + 1, out);
    };
    const polys = [];
    let ok = true;
    for (const p of ps) {
      const out = [p[0], p[1]];
      let wa = F(CX.C(p[0], p[1]));
      for (let i = 2; i + 1 < p.length && ok; i += 2) {
        const wb = F(CX.C(p[i], p[i + 1]));
        ok = refineSeg(p[i - 2], p[i - 1], wa, p[i], p[i + 1], wb, 0, out);
        wa = wb;
      }
      if (!ok) break;
      polys.push(Float64Array.from(out));
    }
    reptOutlineVerts = verts;
    const res = ok && polys.length && GLR.ok ? GLR.createLines(polys, r.lorigin) : null;
    const rec = { open: r.open, lpolys: polys, lorigin: r.lorigin, lineKey: key, arcs: null };
    (r.rept || (r.rept = {}))[slot] = { key, res, out: res ? { res, rec } : null };
    return r.rept[slot].out;
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
      try { v = Inverse.keySing(plan, clipWin); } catch (e) { v = []; }
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
  // (eight polygons cost 4 ms of main thread per scrub frame).
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
  // the w-box that scissors the globe pass of a bounded shape s on inverse path p (gl.js globeScissorOf): invBox's, or the
  // shape's own box through the identity (stage 0); null for an unbounded shape or a box that cannot be promised
  function globeImageBox(p, s, budget) {
    if (!shapeBounded(s)) return null;
    if (p.plan.ops.length) return invBox(p.e, p.plan, s, budget);
    try { return Region.bboxOf(s); } catch (err) { return null; }
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
  // for input-driven frames is the input's spacing (a notched wheel, a slow drag: 80 ms intervals demoted cheap scenes).
  // Half resolution is used only within continuous motion (the previous frame of the pane less than
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
  // the view is in continuous motion (a drag, a tween, a playing morph, a wheel, a slider or a scrub of
  // changes): an inverse program never drawn yet is not drawn now (its first draw stalls the GPU process), another
  // ready B class or the forward stand-in takes its place (gl.js drawInverse) and it is warmed at the next quiet
  // moment. A single discrete change (an example, a toggle) or a hover is not motion: its program draws as soon as it
  // is ready (holding it back adds 200-300 ms to every example load)
  function interacting() {
    const now = performance.now();
    // (a number's slider held: its frames come further apart than 150 ms when the chain is costly)
    return !!(drag || tweens.length || camTweens.length || (morph.playing && morph.open) || now - motionInT < 150 || now - scrubT < 150 || camSpin() || (Params.sliding && Params.sliding()));
  }
  // a camera still turning after its drag is let go (its momentum) moves too: its frames would otherwise be drawn as rest frames,
  // each at a new distance, and All sheets at the Max mesh would rebuild their refinement in every one
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
  // a pointer resting on a pane would hold it off for good), so their stall does not meet the next gesture (a
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
      if (GLR.warmInverse(need === 1 || pred)) requestRender('L', 'R');
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
  // the forward stand-ins a live pane drew for a shape while its inverse program compiled: role|id -> [[res,
  // cacheKey], ...]. Once that shape draws inverse there, their map-cache evaluations are freed (GLR.dropCached).
  // (a mesh rebuild soon after the load would free them only by chance: sphere.logUHP held 1.2 MB more)
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
  let sideDraw = false;    // renderExampleThumb: a side chain (GLR side mode) is drawing
  // live panes that drew a forward stand-in while the inverse program compiled: any draw that finds the program
  // ready (a thumbnail can finish its link first, without GLR.onReady) redraws them
  const invWaiting = new Set();
  // a screen pane's last GPU frame, as glStatusNote saw it: {pending, rept (a REPT draw of it still drawing its tiles, one
  // cause of pending), compiling, error, note (why its plot has no value: a finite sum past the GPU's budget), exact (shapes it
  // drew with a stand-in while their inverse program compiled), t}. frameStatus() is the last begin's or viewport's, which
  // may be the other pane's; the quality harness reads this pane's own (a test hook)
  const paneGl = { L: null, R: null };
  let invPendN = 0;   // shapes of the frame being drawn on a live pane that waited for their inverse program
  let lastRecs = null;     // the shape records of the last packShapes (GLR.packShapes: once per scene draw)
  // SPEC 2.2: the path of area shape s under map in a view (role 'R' | 'L' | null: thumbnail; viewKind 'flat' |
  // 'globe') -> {path: 'inverse' | 'pending' | 'forward', reason, m (normalised map), plan, prep, e, inv (the plan's own
  // inverse op list, invPlan's p.inv, or null: the chain's)}. Drawing asks without o.status ('inverse' = eligible:
  // drawInverse decides between drawn, pending and error); fix-up gating and the test hooks ask with o.status (the
  // program's state, without starting a compile).
  function pathOf(s, map, role, viewKind = 'flat', o = {}) {
    const F = (reason) => ({ path: 'forward', reason });
    if (!GLR.ok || !GLR.drawInverse) return F('no WebGL2 inverse renderer');
    const m = normalizeMap(map);
    if ((m.mode || 0) !== 0) return F(morph.playing ? 'homotopy playing' : 'paused inside a step (homotopy)');
    // (on a globe an identity map draws inverse too: the walk is the pixel's own point, so a region through infinity
    // covers the north pole exactly, where the lifted mesh left a hole; panels.md 11, the stage-0 globe inverse)
    if (isIdentMap(m) && viewKind !== 'globe') return F('identity map');
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
    const out = { path: 'inverse', reason: null, m, plan, prep: e.prep, e, inv: plan.inv || null };
    if (o.status) {
      const st = GLR.inverseStatus(S.alpha, viewKind, out.inv), info = out.inv || GLR.inverseInfo;
      // the query itself can land a compile (no GLR.onReady then): redraw the panes still showing a stand-in
      if (st === 'ready' && invWaiting.size) { const w = [...invWaiting]; invWaiting.clear(); requestRender(...w); }
      if (st === 'pending' || (st === 'none' && info && info.ok)) { out.path = 'pending'; out.reason = 'compiling'; }
      else if (st === 'error') return F('inverse program failed to compile');
      else if (st === 'none') return F((info && info.reason) || 'no inverse program');
    }
    return out;
  }
  // The inverse path of area shape s under the glide's map H_t o F_{k-1} (mode 1, hi k): the
  // plan of stages (a, k] with step k standing for its homotopy at t (Inverse.homBuilt), its own inverse op list
  // (GLChain.buildInverse: another program, the op values its uniforms) and the shape's preparation. Same answer as
  // pathOf's: {path: 'inverse' | 'forward', reason, m, plan, prep, inv}. singAt(): the key's points for a plan whose
  // ops' poles are not the homotopy's, a NEWT op (none for keySing to pull back) or an op marked glideKey (Joukowski's
  // exact chain, whose poles are its Cayley map's): the glide's, as the carried mesh keys its sheets (svSheetKeyAt), so
  // both draw the same point in front
  // (its plans, preparations and keySing in invHoms, apart from invPrep's: a glide makes a plan for each u, which in
  // invPreps would push out the parked planes' preparations and run under invPrep's per-frame budget)
  const invHoms = new Map(), invHomNewt = new Map();
  // the glide plans invHoms keeps (a glide makes one for each u; an All-at-once span its own): at the cap the map is cleared,
  // and the next frame's plan is made again
  const INV_HOMS_MAX = 8;
  // How many (a, k, chain) entries the map below keeps: it holds the t-free parts of the entries a session has glided between. A glide
  // asks for its own (a, k) with the current chain, so a few pairs are in use, and eight leaves room for the pairs of a chain scrubbed
  // back and forth; at the cap the whole map is cleared, which is safe because the next glide builds its part once
  const INV_HOM_SKELS_MAX = 8;
  // The part of a glide's plans that is the same at every t, per (a, k, chain): the chain's built steps, each live one
  // standing for itself with its ops decomposed once with the chain's options (Inverse.chainOpts; Inverse.stepOps reads
  // __homOps), and so the steps of a formula recognized as a chain of them (b.rec, which step k's homotopy walks at t),
  // so the plan, the inverse op list and step k's homotopy at a new t decompose no step again. Its ops are shared by the
  // homotopy's ops at every t, where one op can sit at another node (a recognised formula's sub-step comes after its
  // predecessors' ops once the glide has passed them); each plan made from it copies them (planChain), so it keeps its
  // own step, node and j
  const invHomSkels = new Map();
  function invHomOnce(b, opts) {
    if (!b || b.error || !b.def) return b;
    const r = Inverse.stepOps(b, opts);
    const o = Object.assign({}, b, { __homOps: () => r });
    if (b.rec && b.rec.built) o.rec = Object.assign({}, b.rec, { built: b.rec.built.map((sb) => invHomOnce(sb, opts)) });
    return o;
  }
  // whether a live d/dz step lies between planes a and k, so that invHomBase(a, k) is the substitute chain
  function invHomPastDdz(a, k) {
    for (let j = a + 1; j < k; j++) if (stepActive(j) && isDeriv(j)) return true;
    return false;
  }
  // the chain a glide from plane a into plane k is planned over: the chain itself; or, with a d/dz step between them,
  // the chain that stands in for it (invDerivChain: every live step before the d/dz off, and in the d/dz's place the
  // derivative of their composition, by the chain rule).
  // {steps, built}, or {reason} where no such chain can be made
  function invHomBase(a, k) {
    return invHomPastDdz(a, k) ? invDerivChain(k) : { steps: S.steps, built };
  }
  // the built steps of invHomBase(a, k), each live one decomposed once (invHomOnce); null where that chain cannot be
  // made
  function invHomSkeleton(a, k) {
    const sk = `${a}|${k}|${chainSig[nSteps()]}`;
    let bs = invHomSkels.get(sk);
    if (!bs) {
      const c = invHomBase(a, k);
      if (!c.steps) return null;
      const opts = Inverse.chainOpts(c.steps, c.built);
      bs = c.built.map((b, i) => (!c.steps[i] || c.steps[i].on === false ? b : invHomOnce(b, opts)));
      if (invHomSkels.size >= INV_HOM_SKELS_MAX) invHomSkels.clear();
      invHomSkels.set(sk, bs);
    }
    return bs;
  }
  // The period in z of the glide's map H_t o F_{k-1} from plane a, or null: Inverse.keyPeriod of its plan at t (step k
  // standing for its homotopy, as invHomPath's plan), so the steps before k's where they have one, which H_t keeps,
  // and where they are affine, that of step k's path at t (tan's, tan(t z) / t about its centre, has pi / t): the key
  // at t -> 1 meets plane k's. A step with no inverse plan at t: the steps before k's. Planned on invHomBase's chain, as
  // invHomPath's plan is (the substitute one past a d/dz step). Kept per (a, k, t, chain, and which of the two chains),
  // as a glide's frames ask for each t a few times
  const invHomPers = new Map();
  function invHomPer(a, k, t) {
    const sub = invHomPastDdz(a, k), ck = `${a}|${k}|${t}|${chainSig[nSteps()]}|${sub ? 'ddz' : 'own'}`;
    if (invHomPers.has(ck)) return invHomPers.get(ck);
    let per = null;
    try {
      const base = invHomBase(a, k), bs = base.steps && invHomSkeleton(a, k);
      if (bs) {
        const hk = Inverse.homOps(bs[k - 1], t), bh = bs.slice();
        let plan = null;
        if (hk && hk.ok) { bh[k - 1] = Inverse.homBuilt(bs[k - 1], hk); plan = Inverse.planChain(base.steps, bh, a, k); }
        per = plan && plan.ok ? Inverse.keyPeriod(plan)
          : k - 1 > a ? Inverse.keyPeriod(sub ? Inverse.planChain(base.steps, bs, a, k - 1) : invPlan(a, k - 1)) : null;
      }
    } catch (e) { per = null; }
    if (invHomPers.size >= 4096) invHomPers.clear();
    invHomPers.set(ck, per);
    return per;
  }
  function invHomPath(s, a, k, t, singAt) {
    const F = (reason) => ({ path: 'forward', reason });
    if (!GLR.ok || !GLR.drawInverse || !GLChain.buildInverse) return F('no inverse renderer');
    // (a NEWT op's seeds sit about the shape's anchor: its plan is the shape's, the other plans are shared; whether the
    // step has a NEWT op at t is remembered, as finding out decomposes the step)
    const base = invHomBase(a, k), skel = invHomSkeleton(a, k);
    if (!base.steps || !skel) return F(base.reason || 'no chain to plan');
    const bk = `${a}|${k}|${t}|${chainSig[nSteps()]}`;
    let hk = null, byShape = invHomNewt.get(bk);
    if (byShape === undefined) {
      try { hk = Inverse.homOps(skel[k - 1], t); } catch (e) { hk = null; }
      byShape = !!(hk && hk.ok && hk.ops.some((o) => o.kind === 'NEWT'));
      if (invHomNewt.size >= 4096) invHomNewt.clear();
      invHomNewt.set(bk, byShape);
    }
    const ck = bk + (byShape ? `|${shapeKey(s)}|${winKey()}` : '');
    let h = invHoms.get(ck);
    if (!h) {
      const bs = skel, bh = bs.slice();
      // (ops of its own for each plan: the anchor is set on them)
      if (!hk) try { hk = Inverse.homOps(bs[k - 1], t); } catch (e) { hk = null; }
      let anchor = null;
      if (byShape && hk) try { anchor = Inverse.shapeAnchor(Inverse.planChain(base.steps, bs, a, k - 1), s, clipWin); } catch (e) { anchor = null; }
      if (anchor) for (const o of hk.ops) if (o.kind === 'NEWT') o.p.anchor = anchor;
      bh[k - 1] = Inverse.homBuilt(bs[k - 1], hk);
      h = invOwnPlan(base.steps, bh, a, k);
      // (the key's period: the glide map's at t, invHomPer, as svSheetKeyAt's)
      h.per = invHomPer(a, k, t);
      if (invHoms.size >= INV_HOMS_MAX) invHoms.clear();
      invHoms.set(ck, h);
    }
    const own = singAt && h.plan.ok && h.plan.ops.some((o) => o.kind === 'NEWT' || o.glideKey) ? singAt() : null;
    return invOwnPath(h, s, a, k, own);
  }
  // A chain that stands in for the chain itself from plane a to plane b (a glide's homotopy in its step's place,
  // invHomPath; a d/dz step's derivative formula, invDerivPath), planned with its own inverse program:
  // {plan, inv, preps, sing, per}, plan.ok false with the reason where the plan or the program cannot be made; per: the
  // sheet key's period (Inverse.keyPeriod), which the caller may set, undefined for the plan's own
  function invOwnPlan(steps, bs, a, b) {
    let plan, inv;
    try { plan = Inverse.planChain(steps, bs, a, b); } catch (e) { plan = { ok: false, reason: 'plan: ' + (e && e.message) }; }
    try { inv = plan.ok ? GLChain.buildInverse(steps, bs) : null; } catch (e) { inv = null; plan = { ok: false, reason: 'inverse: ' + (e && e.message) }; }
    if (plan.ok && !(inv && inv.ok)) plan = { ok: false, reason: (inv && inv.reason) || 'no inverse program' };
    return { plan, inv, preps: new Map(), sing: null, per: undefined };
  }
  // the inverse path of area shape s from plane a to plane b through h (invOwnPlan's), prepared once for each window and
  // shape: the sheet key's singular points own (a glide's NEWT op, the caller's), else the plan's own (Inverse.keySing,
  // weighted by h.wOf when the plan has one), and its period h.per
  function invOwnPath(h, s, a, b, own) {
    const F = (reason) => ({ path: 'forward', reason });
    if (!h.plan.ok) return F(h.plan.reason);
    const wk = winKey() + '|' + shapeKey(s) + (own ? '|' + own.map((p) => p.re + ',' + p.im).join(';') : '');
    let prep = h.preps.get(wk);
    if (!prep) {
      try {
        if (!own && (!h.sing || h.sing.k !== winKey())) h.sing = { k: winKey(), v: Inverse.keySing(h.plan, clipWin, h.per, h.wOf || null) };
        prep = Inverse.prepare(h.plan, { win: clipWin, shape: s, sing: own || h.sing.v, per: h.per });
      } catch (err) { prep = { ok: false, reason: 'prepare: ' + (err && err.message) }; }
      h.preps.set(wk, prep);
    }
    if (!prep.ok) return F(prep.reason || 'shape not eligible');
    return { path: 'inverse', reason: null, m: { mode: 0, a, b }, plan: h.plan, prep, inv: h.inv };
  }
  // A plane b past a d/dz step k: its points are D(z) carried on by the steps after k, D = (f_{k-1} ∘ … ∘ f_1)′, a map of
  // z. The chain with D in step k's place, the steps before it off, plans that map from z and builds its own inverse
  // program, as a glide's homotopy stands in for its step (invHomPath). D is the derivative formula of the live steps
  // before the d/dz, the chain rule composed into one formula (Funcs.chainDerivativeStep); {steps, built, k, h} (h: its
  // plan, invOwnPlan's, made at the first path asked of it) or {reason}
  const invDerivs = new Map();
  // (its entries, one for each plane past the d/dz of a chain: the planes of a few chains; at the cap the map is cleared,
  // and a plane's chain is made again when it is next drawn)
  const INV_DERIVS_MAX = 8;
  function invDerivChain(b) {
    const ck = `${b}|${chainSig[nSteps()]}`;
    let r = invDerivs.get(ck);
    if (r) return r;
    const ks = [];
    for (let j = 1; j <= b; j++) if (stepActive(j) && isDeriv(j)) ks.push(j);
    const k = ks[0], before = [];
    for (let j = 1; k && j < k; j++) if (stepActive(j)) before.push(j);
    if (ks.length !== 1) r = { reason: ks.length ? 'more than one d/dz step' : 'no d/dz step' };
    else if (!before.length) r = { reason: 'a d/dz step of the identity' };
    else {
      const d = Funcs.chainDerivativeStep(before.map((j) => S.steps[j - 1]));
      const db = d && d.step ? Funcs.build(d.step) : null;
      if (!db || db.error) r = { reason: (d && d.error) || (db && db.error) || 'no derivative formula' };
      else {
        const steps = S.steps.map((st, i) => (i + 1 < k && st ? Object.assign({}, st, { on: false }) : i + 1 === k ? Object.assign({ on: true }, d.step) : st));
        const bs = built.slice();
        bs[k - 1] = db;
        r = { steps, built: bs, k };
      }
    }
    if (invDerivs.size >= INV_DERIVS_MAX) invDerivs.clear();
    invDerivs.set(ck, r);
    return r;
  }
  // the inverse path of area shape s on plane b past a d/dz step, at rest (pathOf's answer, with its own plan and program)
  function invDerivPath(s, b) {
    if (!GLR.ok || !GLR.drawInverse || !GLChain.buildInverse) return { path: 'forward', reason: 'no inverse renderer' };
    const c = invDerivChain(b);
    if (!c.steps) return { path: 'forward', reason: c.reason };
    if (!c.h) c.h = invOwnPlan(c.steps, c.built, 0, b);
    return invOwnPath(c.h, s, 0, b, null);
  }
  // The inverse path of area shape s under an All-at-once glide's map (mode 3) at u: the plan of stages (a, b] in which
  // each active step k of the span (lo, b] stands for its homotopy at its own time t_k = HR.stepTime(stepT, k, u)
  // (Inverse.homBuilt: no ops at t_k = 0, the step itself at 1) and every step up to lo for itself; its inverse op list
  // (GLChain.buildInverse, invOwnPlan) and the shape's preparation (invOwnPath). Same answer as invHomPath's, and its key's
  // period as invHomPer takes it: Inverse.keyPeriod of the span's plan at u, so the key at u -> 1 meets plane b's (eᶻ's
  // homotopy has 2 pi i / t); with no plan, the steps' up to lo. Its key's points: those of each step k of the span weigh
  // t_k (h.wOf, Inverse.keySing), so that the key goes from plane lo's at u = 0 to plane b's at u = 1 with no jump, a
  // pole that step k's homotopy brings in from infinity coming in with no weight (where it lands beside a pole of an
  // earlier step, as Cayley's pulled back through Joukowski lands beside 0, the two would count twice up to t_k = 0).
  // Forward where a step's homotopy has no exact inverse at its time or a NEWT op (those spans keep the carried meshes)
  function invSpanPath(s, a, lo, b, u, stepT, singAt) {
    const F = (reason) => ({ path: 'forward', reason });
    if (!GLR.ok || !GLR.drawInverse || !GLChain.buildInverse) return F('no inverse renderer');
    const ts = [];
    for (let k = lo + 1; k <= b; k++) if (S.steps[k - 1] && S.steps[k - 1].on !== false) ts.push([k, HR.stepTime(stepT, k, u)]);
    const ck = `span|${a}|${lo}|${b}|${ts.map(([k, t]) => k + ':' + t).join(',')}|${chainSig[nSteps()]}`;
    let h = invHoms.get(ck);
    if (!h) {
      const bs = invHomSkeleton(a, b), bh = bs.slice();
      let plan = null;
      for (const [k, t] of ts) {
        if (t >= 1) continue;
        let hk = null;
        try { hk = Inverse.homOps(bs[k - 1], t); } catch (e) { hk = null; }
        if (!hk || !hk.ok) { plan = { ok: false, reason: `step ${k}'s homotopy: ${(hk && hk.reason) || 'no inverse'}` }; break; }
        if (hk.ops.some((o) => o.kind === 'NEWT')) { plan = { ok: false, reason: `step ${k}'s homotopy is inverted by Newton's method` }; break; }
        bh[k - 1] = Inverse.homBuilt(bs[k - 1], hk);
      }
      h = plan ? { plan, inv: null, preps: new Map(), sing: null, per: undefined } : invOwnPlan(S.steps, bh, a, b);
      h.per = h.plan.ok ? Inverse.keyPeriod(h.plan) : lo > a ? Inverse.keyPeriod(invPlan(a, lo)) : null;
      const tOf = new Map(ts);
      h.wOf = (o) => (tOf.has(o.step) ? Math.min(1, tOf.get(o.step)) : 1);
      if (invHoms.size >= INV_HOMS_MAX) invHoms.clear();
      invHoms.set(ck, h);
    }
    const own = singAt && h.plan.ok && h.plan.ops.some((o) => o.kind === 'NEWT' || o.glideKey) ? singAt() : null;
    return invOwnPath(h, s, a, b, own);
  }

  // the words of text in lines no wider than maxW as ctx sets them (its font), each word on the line until the next would
  // pass maxW (a word wider than maxW is a line of its own)
  function wrapWords(ctx, text, maxW) {
    const lines = [];
    let line = '';
    for (const w of String(text).split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  // wrapWords at the narrowest width that keeps the line count of the wrap at maxW: the lines come out of even length, no word alone
  // on the last (the canvas's text-wrap: balance)
  function balanceWords(ctx, text, maxW) {
    const lines = wrapWords(ctx, text, maxW);
    if (lines.length < 2) return lines;
    let lo = 0, hi = maxW, best = lines;
    while (hi - lo > 1) {
      const mid = (lo + hi) / 2, t = wrapWords(ctx, text, mid);
      if (t.length === lines.length) { best = t; hi = mid; } else lo = mid;
    }
    return best;
  }
  // a short message over a plane (GPU problems, an idle Cauchy or Integral view): a level-2 chip like the DOM ones
  // (--overlay, 1px --line-strong, --shadow-1, --r-2, --ink-2 text), wrapped to at most 360px, below the centre
  const NOTE_GAP = 4;   // the room a note keeps from a message above which it stands
  const NOTE_ROOM_MIN = 160;   // the least room, in px, a note is laid out in beside the chips over its plane (narrower, it keeps its centred place)
  const PH_RAIL = 56;   // a phone plane's key column and the gap before it: 8 px from the plane's right edge + the 44 px key (.viewstack and .vbtn in phone.css) + 4 px
  // where a message standing over the plane begins, in the pane's CSS px from its top (Infinity: none over it)
  function messageTop(pane) {
    const msg = document.querySelector('#toastHost .toast');
    if (!msg || !msg.getClientRects().length) return Infinity;
    const mr = msg.getBoundingClientRect(), pr = pane.canvas.getBoundingClientRect();
    return mr.right > pr.left && mr.left < pr.right && mr.bottom > pr.top ? mr.top - pr.top - NOTE_GAP : Infinity;
  }
  // the chips that stand over the plane's plot (its readout, its colour key) as boxes in the pane's CSS px, those that are laid out
  function chipBoxes(pane) {
    const side = pane === paneL ? 'left' : 'right', pr = pane.canvas.getBoundingClientRect();
    return [side + 'Readout', side + 'Legend'].map((id) => document.getElementById(id)).filter((el) => el && el.getClientRects().length).map((el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left - pr.left, right: r.right - pr.left, top: r.top - pr.top, bottom: r.bottom - pr.top };
    });
  }
  function paneNote(pane, text) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.font = `13px ${TH.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // (a phone's note is centred in the room left of the key column and wraps to that width)
    const free = pane.w - (document.documentElement.classList.contains('ph') && !pane.canvas.closest('.ph-inset') ? PH_RAIL : 0);
    // the note's box centred in the room from left to right: below the centre, clear of a point at the view's middle, and clear of a message
    // standing over the plane (the note moves up only when it has to, and stays inside the pane); the 1 px below: the box is drawn on the
    // half pixel and its stroke is a pixel wide
    const lay = (left, right) => {
      const room = right - left, lines = balanceWords(ctx, text, Math.max(80, Math.min(360, room - 48)));
      const bw = Math.round(Math.min(room - 16, Math.max(...lines.map((t) => ctx.measureText(t).width))) + 24), bh = lines.length * 18 + 14;
      const y0 = Math.round(Math.max(NOTE_GAP, Math.min(pane.h - bh - 56, pane.h / 2 + 28, messageTop(pane) - bh - 1))) + 0.5;
      return { lines, bw, bh, y0, tx: (left + right) / 2, x0: Math.round((left + right) / 2 - bw / 2) + 0.5 };
    };
    let n = lay(0, free);
    // (a pane too short for note and message has the box meet the chips over the plane: it stands in the room between those it meets, wrapped to it)
    const meets = (o) => n.x0 - NOTE_GAP < o.right && n.x0 + n.bw + NOTE_GAP > o.left && n.y0 - NOTE_GAP < o.bottom && n.y0 + n.bh + NOTE_GAP > o.top;
    const chips = chipBoxes(pane);
    let left = 0, right = free;
    for (let pass = 0; pass < chips.length; pass++) {
      const hit = chips.filter(meets);
      if (!hit.length) break;
      for (const o of hit) { if (o.left + o.right < free) left = Math.max(left, o.right + NOTE_GAP); else right = Math.min(right, o.left - NOTE_GAP); }
      if (right - left < NOTE_ROOM_MIN) break;
      n = lay(left, right);
    }
    const { lines, bw, bh, y0, x0, tx } = n;
    pane.noteBox = { x: x0, y: y0, w: bw, h: bh, tx, lines: lines.slice() };   // (the box as drawn, where its words are centred, in the pane's CSS px, and its lines: read by the layout checks)
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, bw, bh, 3); else ctx.rect(x0, y0, bw, bh);
    ctx.shadowColor = TH.dark ? '#00000066' : '#121A201A'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.fillStyle = withAlpha(TH.surface, 0.92); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = TH.lineStrong; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = TH.ink2;
    lines.forEach((t, i) => ctx.fillText(t, tx, y0 + 7 + 9 + i * 18));
    ctx.restore();
  }
  // after a GPU frame: say why shapes are missing when the chain's shader failed (spec 8.6); that the picture is not
  // the new one yet while a program of it compiles (frameStatus().compiling: an earlier version, the deformation's
  // start or nothing stands in; on Direct3D 11 a cold program takes 0.5 to 3 s). That note waits 300 ms, so a quick
  // link shows none, and goes when the program lands (onReady draws the pane again). A frame that has
  // waited for its programs over 1.5 s says instead that the GPU is still preparing them (a cold link on Direct3D 11
  // takes seconds, or minutes; the browser's program cache keeps them for later visits).
  const compileT = new Map();   // pane -> since when its draws stand in for a compiling program
  const overNote = (n) => $t('This sum has more terms than the GPU draws ({n} of at most {cap}), so the pane is left blank. Lower its upper limit to draw it.', { n, cap: GLChain.FINITE_CAP });
  // An infinite sum that does not converge within its term cap leaves the plot blank where it does. The GPU stops at SER_GPU_LOOP
  // terms and so does the CPU's evaluation (Expr's SER_CAP; SUM_STAT.out counts the sums that end NaN without converging), so the
  // page evaluates the steps the colour plot applies at points of the window and says so when some did not converge. The points
  // are a sample of SUM_GRID, taken in a lattice order (SUM_STEP is coprime to their number) so that any prefix of them spans the
  // window, and cut by the terms they evaluate (SUM_WORK), not by the clock: the same window gives the same points on any
  // machine. A small area can be missed, so the note says "part". The sample is taken once the window and the chain have rested
  // for SUM_IDLE_MS (a drag or a slider does not wait on it), and kept per pane for the chain and window it was taken at.
  const SUM_GRID = [24, 16], SUM_STEP = 235, SUM_IDLE_MS = 250;
  let sumWork = 150000;   // the terms a sample may evaluate (it stops after the point that passes them; a test sets it, __cmwSumRun)
  const sumRuns = new Map();   // pane -> { chain, view, hit, spent, tried, timer }: the last sample (see sumSay; tried: points where an infinite sum ran)
  // (hit: points where an infinite sum did not converge within SER_CAP terms; spent: points where the sums took more than
  // the GPU's SER_GPU_TERMS in all; the note names the limit or limits the sample met, and for the second says what to do)
  const sumSay = (r) => (r.hit && r.spent
    ? $t('Part of this plane is blank. An infinite sum does not converge there within {terms} terms, and other sums need more than the {budget} terms the GPU adds at a point. Try a lower upper limit on a finite sum.', { terms: Expr.SER_CAP, budget: GLChain.TERMS_BUDGET })
    : r.spent
      ? $t('Part of this plane is blank: the sums there need more than the {budget} terms the GPU adds at a point. Try a lower upper limit on a finite sum.', { budget: GLChain.TERMS_BUDGET })
      : $t('Part of this plane is blank: an infinite sum does not converge there within {terms} terms.', { terms: Expr.SER_CAP }));
  // the sample of the pane's colour plot for its map, at its window: null when a step of the map is a derivative (it has no function of its own)
  function sumSample(pane, map) {
    const [lo, hi] = GLR.stepsOf(map), fs = [];
    for (let k = Math.max(1, lo); k <= Math.min(hi, nSteps()); k++) {
      if (isDeriv(k)) return null;
      const f = stepFn(k);
      if (f) fs.push(f);
    }
    const stat = Expr.SUM_STAT, n = SUM_GRID[0] * SUM_GRID[1], t0 = stat.terms;
    let hit = 0, spent = 0, tried = 0;
    for (let p = 0; p < n && (p === 0 || stat.terms - t0 < sumWork); p++) {
      const c = (p * SUM_STEP) % n;
      let z = pane.s2w(((c % SUM_GRID[0]) + 0.5) * pane.w / SUM_GRID[0], (Math.floor(c / SUM_GRID[0]) + 0.5) * pane.h / SUM_GRID[1]);
      const inf0 = stat.inf, out0 = stat.out, over0 = stat.over;
      stat.left = Expr.SER_BUDGET;   // (the pixel's terms, as the GPU counts them: armed for this point only)
      try { for (const f of fs) { z = f(z); if (!CX.isFin(z)) break; } } finally { stat.left = Infinity; }
      if (stat.inf > inf0) { tried++; if (stat.out > out0) hit++; if (stat.over > over0) spent++; }
    }
    return { hit, spent, tried };
  }
  // called with the colour plot's map each time the pane draws it: the pane's last sample if it is of this chain and map (one
  // at another window stands until the new one is taken), and a new one is due after SUM_IDLE_MS if the window changed
  function sumWatch(pane, map) {
    const range = GLR.stepsOf(map), chain = chainSig[Math.min(range[1], chainSig.length - 1)] + '|' + range,
      v = pane.view, view = [v.cx, v.cy, v.s, pane.w, pane.h].join(',');
    let r = sumRuns.get(pane);
    if (!r || r.chain !== chain) { if (r && r.timer) clearTimeout(r.timer); sumRuns.set(pane, (r = { chain, view: null, hit: 0, spent: 0, tried: 0, timer: 0 })); }
    if (r.view === view || r.timer) return;
    const role = pane === paneL ? 'L' : 'R';
    const take = () => {
      r.timer = 0;
      if (sumRuns.get(pane) !== r) return;
      if (interacting()) { r.timer = setTimeout(take, SUM_IDLE_MS); return; }
      const now = pane.view, nowKey = [now.cx, now.cy, now.s, pane.w, pane.h].join(',');
      let out = null;
      try { out = sumSample(pane, map); } catch (e) { out = null; }
      const was = sumNote(pane);
      r.view = nowKey; r.hit = out ? out.hit : 0; r.spent = out ? out.spent : 0; r.tried = out ? out.tried : 0;
      if (was !== sumNote(pane)) requestRender(role);
    };
    r.timer = setTimeout(take, SUM_IDLE_MS);
  }
  // the pane shows paper, not the colour plot (the Cauchy style's reason): a sample of the plot is of nothing drawn, so it is dropped
  const sumDrop = (pane) => { const r = sumRuns.get(pane); if (r && r.timer) clearTimeout(r.timer); sumRuns.delete(pane); };
  // the pane's note for it: '' when the sample found no point that did not converge or took more than the budget
  const sumNote = (pane) => { const r = sumRuns.get(pane); return r && (r.hit || r.spent) ? sumSay(r) : ''; };
  // whether each screen pane's "Compiling…" note is drawn: its LED says so (updateLeds), where a screen reader hears it
  const compileShown = { L: false, R: false };
  function setCompileShown(role, on) {
    if (compileShown[role] === on) return;
    compileShown[role] = on;
    updateLeds();
  }
  const gpuWait = new Map();   // screen pane (paneL, paneR) -> when its frames began waiting for programs
  // (quiet: the status is recorded and no note is drawn or timed: a frame that is the colour layer alone, the steps view's bare glide)
  function glStatusNote(pane, quiet) {
    const st = GLR.frameStatus ? GLR.frameStatus() : null;
    const hatched = hatchNotes.get(pane) || '';
    if (!quiet) hatchNotes.delete(pane);
    if (!quiet && st && st.error) { paneNote(pane, st.error); setLed(pane === paneL ? 'L' : 'R', 'err', st.error); }
    // (a finite sum with more terms than the GPU takes, GLChain.FINITE_CAP, leaves the plot with no value: the pane, its
    // LED and the plane's description say why; the description where the LED is hidden too, on a phone)
    const note = st && !st.error ? (st.over ? overNote(st.over) : sumNote(pane) || hatched) : '';
    if (!quiet && note) { paneNote(pane, note); setLed(pane === paneL ? 'L' : 'R', 'err', note); paneSay(pane, 'note', note); }
    // (the screen's panes only: an export's off-screen pane is drawn once and dropped)
    if (pane !== paneL && pane !== paneR) return;
    const now = performance.now(), role = pane === paneL ? 'L' : 'R';
    // (a REPT draw still drawing its tiles in any of the pane's GL frames: pending too)
    const rept = !!(GLR.reptPendingTake && GLR.reptPendingTake());
    // (a note that comes or goes changes the LED's state and tip with it)
    const noted = paneGl[role] && paneGl[role].note;
    paneGl[role] = { pending: !!(st && st.pending) || rept, rept, refining: !!(st && st.refining), compiling: !!(st && st.compiling), error: (st && st.error) || '', note, exact: invPendN, t: now };
    invPendN = 0;
    if ((noted || '') !== note) updateLeds();
    if (quiet) return;
    if (st && st.pending) warmKick();   // (the start-up bar counts the same programs)
    if (!st || !st.pending) gpuWait.delete(pane);
    // (the first waiting frame: one more frame when the 1.5 s are up, if nothing landed by then)
    // (and one at 300 ms: a chain with no earlier version is drawn from a SphereMesh once its link has waited 250 ms,
    // whether or not the frame counts as compiling)
    else if (!gpuWait.has(pane)) { gpuWait.set(pane, now); for (const ms of [300, 1600]) setTimeout(() => requestRender(role), ms); }
    else {
      const n = (GLR.warmStatus ? GLR.warmStatus([1]).pending : GLR.pendingLinks) || 0;   // (the bar's own count)
      if (n && now - gpuWait.get(pane) > 1500) { paneNote(pane, $t('Preparing the GPU… (first time only; shaders left: {n})', { n })); return; }
    }
    if (!st || st.error || !st.compiling || offRender || artMode || sideDraw) { compileT.delete(pane); setCompileShown(role, false); return; }
    const t0 = compileT.get(pane);
    if (t0 === undefined) {
      compileT.set(pane, now);
      setTimeout(() => { if (compileT.has(pane)) requestRender(role); }, 320);
    } else if (now - t0 >= 300) {
      // (not while the Play gate's message is up: it says the programs are not ready, and the note would lie under it)
      if (svGateMessageUp()) compileBox = null; else compileNote(pane);
      setCompileShown(role, true);
    }
  }
  // the compiling note: small and quiet, in the pane's lower left corner (compileBox: where it was last drawn, in the pane's CSS px)
  let compileBox = null;
  function compileNote(pane) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.font = `11px ${TH.ui}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const text = $t('Compiling…');
    const bw = Math.ceil(ctx.measureText(text).width) + 14, bh = 18, x0 = 8.5, y0 = Math.round(pane.h - bh - 8) + 0.5;
    compileBox = { x: x0, y: y0, w: bw, h: bh };
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, bw, bh, 9); else ctx.rect(x0, y0, bw, bh);
    // (the surface fill alone is the paper's own colour on paper in the light theme: the outline keeps the pill's shape there)
    ctx.fillStyle = withAlpha(TH.surface, 0.82); ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = TH.lineStrong; ctx.stroke();
    ctx.fillStyle = TH.muted;
    ctx.fillText(text, x0 + 7, y0 + bh / 2 + 0.5);
    ctx.restore();
  }
  // the shape records of the visible shapes of plane 0 (the inverse pass's, GLR.packShapes), with extra ones after
  // them (the steps view's whole-plane region); staged: the shapes of the later planes too
  function packRecs(extra = [], staged = false) { return GLR.packShapes(S.shapes.filter((x) => x.visible !== false && (staged || !shapeStage(x))).concat(extra), { trace: invTrace, dash: invDashTrace }).recs; }
  // the visible area shapes, in list order
  const visibleAreas = () => S.shapes.filter((x) => x.visible !== false && kindType(x) === 'area');
  // the stroke of a shape's curve, in the shape's own colour on a plane of any colouring: its width and its halo casing by what
  // the shape is (a curve, a region's edge, a grid line), thicker when it is selected on its plane (opt.domain: the source
  // plane; opt.plane: the stage drawn) or hovered, none of the casing when opt.thin; opt.still: the globes' lines, with neither emphasis and a grid drawn as any curve
  function shapeStroke(s, dpr, opt = {}) {
    const ink = shapeInk(s);
    const grid = !opt.still && (s.kind === 'cgrid' || s.kind === 'pgrid');
    const area = kindType(s) === 'area';
    let width = opt.thin ? 1 : grid ? 1 : area ? 1.5 : 2;
    let casingWidth = opt.thin ? 0 : grid ? 2.5 : area ? 3.5 : 4;
    if (!opt.thin && !opt.still && s.id === selected && (opt.domain || (opt.plane > 0 && shapeStage(s) === opt.plane))) { width += 0.75; casingWidth += 0.75; }
    if (!opt.thin && !opt.still && s.id === hoverShape) { width += 0.5; casingWidth += 0.5; }
    const st = { width: width * dpr, color: GLR.hexRGB(ink.edge), alpha: grid ? 0.8 : 1 };
    if (casingWidth) st.casing = { color: GLR.hexRGB(TH.halo), alpha: TH.haloA, width: casingWidth * dpr };
    return st;
  }
  // Draw graph paper, fills and curves of every visible shape under the GPU map 'map'.
  // opt: {thin (thumbnail), L, cache, domain, noGrid, under (draws before the fills), arcF/arcKey (CPU map for dashes),
  // fills (the fills alone, no strokes: a mask of the regions), skip (a predicate: the shapes left out)}
  function drawScene(pane, map, role, opt = {}) {
    const list = S.shapes.filter((s) => s.visible !== false && !(opt.skip && opt.skip(s)));
    // exact images (SPEC 10.2): when this map may draw inverse, the frame's shape records are packed once, and each
    // area shape takes its path in list order (inverse and forward passes interleave, so list order holds across paths)
    const m0 = normalizeMap(map);
    const live = (role === 'R' || role === 'L') && !offRender && !opt.thin;
    // (opt.sm: the SphereMesh role of the steps view's region mask, 'SV', drawn in the left pane: its meshes are asked
    // for and its paths noted under 'SV', as a live pane's, in place of the pane's role. Without it smRole is role)
    const smRole = opt.sm || role || null, smLive = live || (!!opt.sm && !offRender);
    // (the pane redrawn when an inverse program it waits on lands: a live pane's own role; the steps view's mask is
    // drawn in the left pane)
    const waitRole = live ? role : opt.sm && !offRender ? 'L' : null;
    let recs = null, gf = null, timing = false, invN = 0;
    const halfDraws0 = GLR.inverseHalfDraws || 0;
    if (GLR.ok && GLR.packShapes && (PHASE[role || 'R'] || {}).flat
      && (m0.mode || 0) === 0 && !isIdentMap(m0) && invPlan(m0.a || 0, m0.b || 0).ok) {
      cmFormAnchor('X');
      // (the shapes of an intermediate plane are drawn forward: no records for them)
      recs = packRecs();
      if (!sideDraw) lastRecs = recs;
      // (a region mask, opt.fills, is not a frame of the pane's picture: the cost guard neither measures nor demotes it)
      if (live && guard && !opt.fills) {
        const info = GLR.inverseInfo;
        // (the key includes the B class of the opacity: a trip at alpha 0.3 does not hold at alpha 1)
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
    if (recs && !smLive && !offRender) {
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
        if (shapeStage(s)) { if (preIds.size) break; continue; }
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
            map: p.m, plan: p.plan, prep: p.prep, inv: p.inv, shape: s, viewKind: 'flat', view: pane.view, dpr: pane.dpr,
            look: { color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha, alphaOwn: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), stretch: { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) } },
            scissor: sc, half: true, halfPre: true, motion: live && interacting(), coldOk: offRender, rept: opt.fills ? 1 : 0,
          });
        } catch (err) { res = 'error'; }
        if (res !== 'drawn') break;                             // drawn in the main pass, from here on
        preIds.add(s.id);
        invN++;
        if (invWaiting.size) { const w = [...invWaiting].filter((x) => x !== role || !live); invWaiting.clear(); if (w.length) requestRender(...w); }
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
    // right after adding a step): it is redrawn when the program is ready (GLR.onReady)
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
      // a shape of an intermediate plane: its own map (none: not drawn in this plane), its mesh drawn forward
      const sm = shapeMap(s, map);
      if (!sm) continue;
      if (sm !== map) {
        if (preIds && preIds.size && !preDone) { GLR.compositeHalf(); preDone = true; }
        if (r.meshRes) {
          GLR.drawRegion(r.meshRes, {
            map: sm, view: pane.view, dpr: pane.dpr, L: opt.L || MESH_L, color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB,
            alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), skip: null, stretch, fade: null, sync, cacheKey: cache ? `${r.meshKey}|${mapKeyOf(sm)}` : null,
          });
        }
        continue;
      }
      // drawn in the half-resolution pre-pass: its layer is upsampled here, at the run's first shape
      if (preIds && preIds.has(s.id)) {
        if (!preDone) { GLR.compositeHalf(); preDone = true; }
        if (smLive) notePath(smRole, s.id, 'inverse');
        continue;
      }
      let lp = 'forward';
      if (recs) {
        const p = pathOf(s, map, role, 'flat', { recs, budget: live });
        lp = p.path;
        if (p.path === 'inverse' && invGate) {
          lp = invGate === 'pending' ? 'pending' : 'forward';
          if (invGate === 'pending' && waitRole) { invWaiting.add(waitRole); invPendN++; }
        } else if (p.path === 'inverse') {
          const box = invBox(p.e, p.plan, s, live);
          const sc = box ? GLR.scissorOf(box, pane.view, pane.dpr, 4) : null;
          // an image that misses the pane draws nothing (counted as drawn)
          if (sc && !sc[2]) { if (smLive) notePath(smRole, s.id, 'inverse'); continue; }
          let res = 'error';
          try {
            res = GLR.drawInverse({
              map: p.m, plan: p.plan, prep: p.prep, inv: p.inv, shape: s, viewKind: 'flat', view: pane.view, dpr: pane.dpr,
              look: { color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha, alphaOwn: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), stretch },
              scissor: sc, half: !!(gf && gf.half), motion: live && interacting(), coldOk: offRender, rept: opt.fills ? 1 : 0, whole: offRender,
            });
          } catch (err) { if (!invThrew) { invThrew = true; console.error('exact images: inverse pass failed; drawing forward', err); } }
          if (res === 'drawn') {
            invN++;
            if (smLive) notePath(smRole, s.id, 'inverse');
            // the program landed (possibly inside this very call, without GLR.onReady): redraw the other panes that drew
            // a stand-in, and the thumbnails (one drawn forward meanwhile has a stale signature)
            if (invWaiting.size) { const w = [...invWaiting].filter((x) => x !== waitRole); invWaiting.clear(); if (w.length) requestRender(...w); }
            continue;
          }
          lp = res === 'pending' ? 'pending' : 'forward';
          if (res === 'pending' && waitRole) { invWaiting.add(waitRole); invPendN++; }
          // a failed compile (silent: console only) draws forward from now on, with its fix-ups (SPEC 4.4, 10.4)
          if (res === 'error' && GLR.inverseStatus(S.alpha, 'flat') === 'error') {
            const k = (GLR.inverseInfo || {}).key || '';
            if (k !== invFailKey) { invFailKey = k; scheduleFix(); }
          }
        }
        if (smLive) notePath(smRole, s.id, lp);
      }
      // the dragged shape's fix-up keeps up with the drag; the pair drawn is the current mesh with its fix-up, or the
      // last complete pair while the current one's is on its way (never an unfixed mesh in motion)
      if (live && role) liveFix(s, r);
      // SPEC 8: a published SphereMesh valid for this view replaces the GPU draw and its fix-ups; while a rebuild runs
      // the old one is drawn inside its guard box, the GPU image around it (exports: the meshes prepareExport built)
      const smd = (smLive || offRender) && smRole
        ? smFor(s, r, smRole, 'flat', map, pane, 0, smLive && lp !== 'pending') : null;
      // (n 0: nothing of it shows; but a formula area's level is only sampled, at the meshing window's feature
      // resolution, so its empty mesh proves nothing and the GPU draws it)
      if (smd && smd.e && (smd.e.data.n ? smRes(smd.e) : s.kind !== 'formula')) {
        if (smd.e.data.n) GLR.drawPreMapped(smd.e.res, smLook(s, pane, alpha, map));
        if (smd.why === 'linking' && GLR.markPending) GLR.markPending();
        continue;
      }
      let smOld = null, smOut = null;
      if (smd && smd.old && smRes(smd.old)) {
        const so = GLR.standInOf(smd.old.guardBox, pane.view, pane.dpr);
        if (so === 'whole') { GLR.drawPreMapped(smd.old.res, smLook(s, pane, alpha, map)); continue; }
        if (so) { smOld = so.sc; smOut = so.around; }
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
    for (const s of hideStrokes || artMode || opt.fills ? [] : list) {
      if (kindType(s) === 'point') continue;
      const r0 = shapeGPU(s);
      const sm = shapeMap(s, map);
      if (!sm) continue;
      // the strokes that go with the fill drawn (a hold's own strokes while it stands in for the current mesh)
      const r = role && r0.hold && kindType(s) === 'area' && sm === map ? linesOf(r0, pairFor(s, r0, role).p) : r0;
      if (!r.lineRes) continue;
      const area = kindType(s) === 'area';
      const st = Object.assign({ map: sm, view: pane.view, dpr: pane.dpr, M: opt.thin ? 4 : 8, sync, cacheKey: cache ? `${r.lineKey}|${mapKeyOf(sm)}` : null, cpu: () => cpuMap(sm) }, shapeStroke(s, pane.dpr, opt));
      // open sets: the boundary is not included, drawn dashed 5/3.5 (spec 6.5)
      if (area && r.open && !opt.thin) { st.dash = OPEN_DASH; st.arc = sm === map ? arcOf(r, arcF(), arcKey) : arcOf(r, cpuMap(sm), mapKeyOf(sm)); }
      GLR.drawLines(r.lineRes, st);
    }
    if (GLR.flushHalf) GLR.flushHalf();
    // (half: what the frame drew, not what it asked for: a program not yet warm for half resolution draws full)
    if (timing) { GLR.timer.end(); const q = paneG[role].qs; if (q.length) { const e = q[q.length - 1]; e.inv = invN > 0; e.lv = drawnLevel(e.dem, (GLR.inverseHalfDraws || 0) > e.hd0); if (e.inv) invPaneQ[role] = e; } }
    if (live && invN) invPaneQ.drew[role] = true;
    // a ready inverse program that waits for its first draw (or its first half-resolution draw) is warmed at a quiet
    // moment, then the panes redraw with it (no 75-200 ms first-draw stall inside a drag or a transition).
    // Thumbnails too: a thumbnail's status query can land a compile (no GLR.onReady then) and find it cold.
    if (recs && !offRender && GLR.inverseColdWaiting) scheduleWarm(interacting() ? 100 : 0);
    // (opt.over: drawn into the same frame after the shapes, before it is shown)
    if (opt.over) opt.over();
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (!opt.thin) glStatusNote(pane);
  }
  const PRIMES = ['', '′', '″', '‴'];
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  let figMode = false; // set while a figure is drawn: image points read F(z₀) rather than z₀″
  // a formula as plain text for a tooltip outside English: Tour's reading of TeX, the screen's comma
  const texTitle = (tex) => {
    try {
      // (without the tour's reader: the commands and braces dropped, never the source as it is)
      const p = (Tour._t && Tour._t.texPlain) || ((x) => x.replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim());
      // (a fraction of two single symbols or numbers is π/2, not (π)/2)
      const one = '(\\\\(?:pi|infty|alpha|gamma|zeta|theta)|[A-Za-z0-9]+(?:\\.[0-9]+)?)';
      const t = I18N.notation(tex).replace(new RegExp(`\\\\[dt]?frac\\{${one}\\}\\{${one}\\}`, 'g'), '$1/$2').replace(/\\times(?![A-Za-z])/g, ' × ').replace(/\\operatorname\{([^{}]+)\}\s*/g, '$1 ').replace(/\\(?:left|right)(?![A-Za-z])\.?/g, '').replace(/\\(?:text|mathrm|textrm)\{([^{}]*)\}/g, '$1')
        .replace(/\\(?:overline|bar)\{([^{}]*)\}/g, (m, a) => (a.length === 1 ? a + '\u0304' : `conj(${a})`)).replace(/\\bar\s*([A-Za-z])/g, '$1\u0304');
      // (× for \times, and a minus sign for '-' except in a Russian word such as «Лог-полярные»; the decimal comma only
      // where the language writes one: English keeps 0.5)
      const pt = p(t);
      return (I18N.comma() ? pt.replace(/(\d)\.(\d)/g, '$1,$2') : pt).replace(/-/g, (m, i, str) => (/[А-Яа-яЁё]/.test(str[i - 1] || '') && /[А-Яа-яЁё]/.test(str[i + 1] || '') ? m : '−'));
    } catch (e) { return String(tex).replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim(); }
  };
  // an example's word label ('trailing edge') is stored in English and translated where it is shown, so a caption in
  // the other language and a save reopened in the other language read right; a user's label is as typed
  const EX_LABELS = new Set(['trailing edge']);
  const exLabel = (l) => (l && EX_LABELS.has(l) ? $t(l) : l);
  // a point keeps its subscript for life (gaps allowed): s.num, stored with the shape. Helpers have none. A save
  // with no numbers takes them from the order, naming the points (the visible ones,
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
    chainRebuilt(); commit(); requestRender('L', 'R', 'OL', 'OR');
    undoToast($t('Zeros and poles renumbered.'));
  }
  // the number the next new point takes
  const nextPointNum = () => { let n = -1; for (const s of S.shapes) if (numbered(s) && Number.isInteger(s.num)) n = Math.max(n, s.num); return n + 1; };
  function pointLabel(s, idx, primes) {
    // (a new point is z₀, z₁, …; a plain lowercase letter would read as a shared number)
    const bn = s.bind ? boundNumber(s) : '';
    // (a point is named for the plane it was drawn on, and its number: z₀ on z, w₁,₁ on w₁; the comma keeps the plane's subscript and
    // the number's apart, as w₁₁ would read as one)
    const st = shapeStage(s), num = sub(Number.isInteger(s.num) ? s.num : idx);
    const base = exLabel(s.label) || (bn ? Params.display(bn) : (st > 0 ? `w${sub(st)},` : 'z') + num);
    // (a one-panel figure of the deformation draws H_t at the current t: its moving points read H_t(z₀))
    if (figMode && primes > 0 && morphOn()) return `Hₜ(${base})`;
    if (primes < 0) return `Hₜ(${base})`;   // (a bracket's moving point with a live post: morphPrimes)
    // (a figure's carried point reads as the image on the plane it is shown on: primes counts the maps from the point's own plane, so
    // that plane is stage + primes; F is the whole map from z)
    if (figMode && primes > 0) {
      // (F for a point of z on the last plane; the focused step's f_k for the image of a point of the plane before it; else the plane
      // shown, w_k, whatever step is focused)
      const k = st + primes, f = st === 0 && k === nSteps() ? 'F' : S.focus > 0 && primes === 1 && k === S.focus ? `f${sub(k)}` : `w${sub(k)}`;
      return `${f}(${base})`;
    }
    return base + (primes < 4 ? PRIMES[primes] : '⁽' + String(primes).split('').map((d) => SUP[+d]).join('') + '⁾');
  }
