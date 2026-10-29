  // ---------------- regions on the GPU ----------------
  let clipWin = { x0: -4, x1: 4, y0: -4, y1: 4 };
  const kindType = (s) => Region.KINDS[s.kind].type;
  const shapeKey = (s) => JSON.stringify([s.kind, s.p, s.a, s.b, s.c, s.m, s.r, s.r1, s.r2, s.t1, s.t2, s.pts, s.expr, s.complement, s.n, s.nc, s.nr]);
  const MESH_L = 4; // every base triangle is split into MESH_L^2 triangles on the GPU
  const fullRes = () => Math.max(10, Math.min(480, Math.round(S.meshN / MESH_L)));   // Max (1920): 480 base cells per side
  // The drag-time mesh cap (meshN 240 while a shape is moved or reshaped) applies only when the drag's frames would
  // leave the 60 fps budget (motion-vs-rest, minor finding: a capped mesh is a coarser look than the rest frame): when
  // the shape's last full-resolution mesh took more than DRAG_BUILD_MS to build (each drag frame rebuilds it), or once
  // two frames of this drag have run over the budget. The cap then holds until the drag ends (one look per gesture).
  const DRAG_BUILD_MS = 4, FRAME_BUDGET_MS = 14;   // compare_perf.py BUDGET60: a frame <= 14 ms
  function baseRes(s, r) {
    const full = fullRes();
    if (!(drag && (drag.mode === 'handle' || drag.mode === 'move'))) return full;
    const cap = Math.max(10, Math.round(240 / MESH_L));
    if (full <= cap) return full;
    if (!drag.capMesh && drag.shape === s && r && r.buildMs && r.buildMs[full] > DRAG_BUILD_MS) drag.capMesh = true;
    // (only the dragged shape: the others keep their meshes, and their looks, through the drag)
    return drag.capMesh && drag.shape === s ? cap : full;
  }
  const gpu = new Map(); // shape id -> {meshKey, mesh, meshRes, lineKey, lineRes, polys, refKey, fix: {L, R}, hold, live}
  function destroyFix(r) {
    for (const k of Object.keys(r.fix || {})) { const f = r.fix[k]; if (f && f.extraRes) GLR.destroy(f.extraRes); }
    r.fix = {};
  }
  // ---- the (mesh, fix-up) pairs on screen (motion-vs-rest causes 2 and 3) ----
  // A forward-drawn mesh is never shown without its fix-up while a fixed pair of the same shape exists:
  // - r.hold: the last complete pair {mesh, meshRes, meshKey, fix, fadeBox, skey, lref}. It is drawn for a role in place
  //   of a newer mesh whose fix-up for that role has not landed yet, when it shows the same shape (a re-centred clipWin,
  //   another base resolution) or the shape is being dragged (its live fix-up then lands within a frame or two).
  // - the strokes go with the fill drawn: a pair (the hold, a live job's mesh) names in lref the lineKey of the strokes
  //   it was drawn with; when the strokes are rebuilt (a drag move, a re-centre) the old ones are kept in r.lpool while
  //   a pair names them, and a hold is drawn with them (U-a review: the fill one position behind its outline in a drag).
  //   The new strokes are drawn once the current mesh is (fill and outline trail together, never apart).
  // - r.live: the dragged shape's fix-up job, advanced inside the motion frames (LIVE_SLICE ms per frame) instead of
  //   waiting for the pointer-up; a newer mesh does not cancel it: it finishes its own mesh, which becomes the hold,
  //   and the next job takes the newest mesh. After the pointer-up it runs on (r.liveTail) until the last mesh is fixed.
  // LIVE_SLICE ms per frame at least; more while the frame so far leaves room under LIVE_FRAME_MS (of the 14 ms 60 fps
  // budget), so a fix-up that fits lands in the frame that built its mesh and no hold frame is drawn (U-a review)
  const LIVE_SLICE = 4, LIVE_FRAME_MS = 9;
  let liveMsUsed = 0;   // the live fix-up time spent in this animation frame (frame() resets it)
  let frameStartT = -1e9;   // performance.now() at the start of the current animation frame
  const dragsShape = (s) => !!(drag && drag.shape === s && !drag.target && (drag.mode === 'move' || drag.mode === 'handle'));
  const liveOn = (s, r) => !!(r && (r.live || r.liveTail)) || dragsShape(s);
  function freePair(p) {
    if (!p) return;
    for (const k of Object.keys(p.fix || {})) { const f = p.fix[k]; if (f && f.extraRes) GLR.destroy(f.extraRes); }
    GLR.destroy(p.meshRes);
  }
  // the kept strokes no pair names any more are freed (all of them with all = true)
  function gcLines(r, all) {
    if (!r.lpool || !r.lpool.size) return;
    for (const [k, L] of [...r.lpool]) {
      if (!all && ((r.hold && r.hold.lref === k) || (r.live && r.live.lref === k))) continue;
      GLR.destroy(L.lineRes); r.lpool.delete(k);
    }
  }
  // the strokes to draw with the pair pm (from pairFor): the current ones, or the kept ones a hold was drawn with
  function linesOf(r, pm) {
    if (pm === r || !pm || pm.lref === undefined || pm.lref === r.lineKey) return r;
    const L = r.lpool && r.lpool.get(pm.lref);
    return L || r;
  }
  function dropHold(r) { const h = r.hold; r.hold = null; freePair(h); }
  function dropLive(r) {
    const j = r.live;
    r.live = null; r.liveTail = false;
    if (j && j.owned) freePair({ meshRes: j.meshRes, fix: j.fixDone });
  }
  // the current mesh is being replaced: keep it as the hold when it is complete, hand it to the live job that is fixing
  // it, or free it
  function retireMesh(r) {
    const job = r.live && !r.live.owned && r.live.meshKey === r.meshKey ? r.live : null;
    if (job) Object.assign(job, { owned: true, fixDone: r.fix, fadeBox: r.fadeBox, skey: r.skey });
    else if (r.meshRes && Object.values(r.fix || {}).some((f) => f && f.res && f.meshKey === r.meshKey)) {
      dropHold(r);
      r.hold = { mesh: r.mesh, meshRes: r.meshRes, meshKey: r.meshKey, fix: r.fix, fadeBox: r.fadeBox, skey: r.skey, lref: r.lineKey };
    } else { destroyFix(r); GLR.destroy(r.meshRes); }
    r.fix = {};
  }
  // the pair drawn for role: the current mesh with its fix-up, or the hold while the current one has none yet
  function pairFor(s, r, role) {
    const fx = role && r.fix[role] && r.fix[role].meshKey === r.meshKey ? r.fix[role] : null;
    const h = r.hold;
    if (fx || !role || !h || !h.fix[role] || !h.meshRes) return { p: r, fx };
    if (h.skey !== r.skey && !liveOn(s, r)) return { p: r, fx: null };
    // (a hold of another geometry whose strokes are gone is not drawn: a fill apart from its outline is worse)
    if (h.skey !== r.skey && h.lref !== r.lineKey && !(r.lpool && r.lpool.has(h.lref))) return { p: r, fx: null };
    return { p: h, fx: h.fix[role] };
  }
  // the roles whose fix-up of shape s is missing for its current mesh and map
  function liveNeeds(s, r) {
    const out = [];
    for (const tg of fixTargets()) {
      if (tg.need && !tg.need(s)) continue;
      const f = r.fix[tg.role];
      if (f && f.meshKey === r.meshKey && f.mapKey === tg.key) continue;
      out.push(tg);
    }
    return out;
  }
  function bindLive(r, job, res) {
    const make = (old) => {
      const fx = old && old.skip ? old : { meshKey: job.meshKey, skip: GLR.createSkip(job.meshRes, res.flags) };
      if (old && old.skip) GLR.setSkip(fx.skip, res.flags);
      if (fx.extraRes) GLR.destroy(fx.extraRes);
      fx.extraRes = res.extra.length ? GLR.createMesh(res.extra) : null;
      fx.mapKey = job.mapKey; fx.res = res;
      return fx;
    };
    if (!job.owned && job.meshKey === r.meshKey) {
      const old = r.fix[job.role];
      r.fix[job.role] = make(old && old.meshKey === r.meshKey ? old : null);
      // a hold that the current mesh now covers in every role it was drawn for is no longer needed
      if (r.hold && Object.keys(r.hold.fix).every((k) => r.fix[k] && r.fix[k].meshKey === r.meshKey)) dropHold(r);
    } else if (r.fix[job.role] && r.fix[job.role].meshKey === r.meshKey) {
      // the newest mesh already has its own fix-up for this role: the finished older pair is not needed
      freePair({ meshRes: job.meshRes, fix: job.fixDone });
    } else {
      // the job's mesh was replaced while it ran: the finished pair becomes the hold until the newest mesh has its own
      const fix = job.fixDone || {};
      const old = fix[job.role];
      fix[job.role] = make(old && old.meshKey === job.meshKey ? old : null);
      dropHold(r);
      r.hold = { mesh: job.mesh, meshRes: job.meshRes, meshKey: job.meshKey, fix, fadeBox: job.fadeBox || null, skey: job.skey, lref: job.lref };
    }
    gcLines(r);
    requestRender(job.role);
  }
  // advance the dragged shape's fix-up inside this frame (at most LIVE_SLICE ms per frame for all panes)
  function liveFix(s, r) {
    if (!GLR.ok || kindType(s) !== 'area') return;
    const dragging = dragsShape(s);
    if (dragging) r.liveTail = true;
    if (!r.liveTail && !r.live) return;
    const t0 = performance.now();
    for (;;) {
      if (!r.live) {
        const need = r.mesh && r.meshRes ? liveNeeds(s, r) : [];
        if (!need.length) { if (!dragging) r.liveTail = false; liveMsUsed += performance.now() - t0; return; }
        const tg = need[0];
        const budget = { ms: 0 };
        r.live = { role: tg.role, mapKey: tg.key, budget, gen: fixGen(r.mesh, tg.F, budget), mesh: r.mesh, meshRes: r.meshRes, meshKey: r.meshKey, skey: r.skey, lref: r.lineKey, owned: false };
      }
      const now = performance.now();
      const left = Math.max(LIVE_SLICE - liveMsUsed - (now - t0), LIVE_FRAME_MS - (now - frameStartT));
      if (left < 0.25) break;
      const job = r.live;
      job.budget.ms = left;
      let st;
      try { st = job.gen.next(); } catch (e) { console.error('live fix-up', e); dropLive(r); return; }
      job.ms = (job.ms || 0) + performance.now() - now; job.frames = (job.frames || 0) + 1;
      if (!st.done) break;
      r.liveStat = [+job.ms.toFixed(1), job.frames];
      r.live = null;
      bindLive(r, job, st.value);
    }
    liveMsUsed += performance.now() - t0;
    // not finished: the next frame goes on with it (also after the pointer-up, with no input to ask for frames)
    requestRender('L', 'R');
  }
  function dropShapeGPU(id) {
    lastPath.delete('R|' + id); lastPath.delete('L|' + id);
    smDropShape(id);
    const r = gpu.get(id);
    if (!r) return;
    destroyFix(r);
    dropHold(r); dropLive(r); gcLines(r, true);
    GLR.destroy(r.meshRes); GLR.destroy(r.lineRes);
    gpu.delete(id);
  }
  function dropAllGPU() { for (const id of [...gpu.keys()]) dropShapeGPU(id); }
  // o: curvesOf options ({reach: 'sphere'}: the settle-time refinement, SPEC 9.1; formula contours then carry the
  // stretched mesh's outer box, so the ones that end on it continue as rays)
  function sourceCurves(s, mesh, o) {
    let out = [];
    try { out = Region.curvesOf(s, clipWin, o); } catch (e) { out = []; }
    if (s.kind === 'formula' && mesh) {
      for (const c of mesh.contours) {
        const pc = Region.polyCurve(c.pts, false);
        if (pc && o && o.reach === 'sphere' && mesh.stretched && mesh.outer && !c.closed) Object.assign(pc, { outer: mesh.outer, openSides: mesh.open, cell: mesh.cell });
        if (pc) out.push(pc);
      }
    }
    return out;
  }
  // a usable meshing window: finite, positive size (a degenerate one, e.g. restored from old saved state, would
  // leave every unbounded shape without a mesh)
  const goodWin = (w) => !!w && w.x1 - w.x0 > 0 && w.y1 - w.y0 > 0 && Number.isFinite(w.x0 + w.x1 + w.y0 + w.y1);
  function shapeGPU(s) {
    if (!goodWin(clipWin)) { clipWin = viewBox(S.srcView); if (!goodWin(clipWin)) clipWin = { x0: -4, x1: 4, y0: -4, y1: 4 }; setOpt('clipWin', clipWin); }
    let r = gpu.get(s.id);
    if (!r) { r = { fix: {} }; gpu.set(s.id, r); }
    const t = kindType(s);
    const sk = shapeKey(s);
    if (t === 'area') {
      const base = baseRes(s, r);
      let bb = null;
      try { bb = Region.bboxOf(s); } catch (e) { bb = null; }
      const ww = clipWin.x1 - clipWin.x0, wh = clipWin.y1 - clipWin.y0;
      const stretched = !bb || (bb.x1 - bb.x0) > 3 * ww || (bb.y1 - bb.y0) > 3 * wh;
      const key = sk + '|' + base + (stretched ? '|' + JSON.stringify(clipWin) : '');
      if (r.meshKey !== key) {
        let mesh = null;
        const tb = performance.now();
        try { mesh = Region.buildMesh(s, clipWin, base); s._err = null; } catch (err) { s._err = err.message; mesh = null; }
        // (the build time at each resolution: the drag-time cap reads the full-resolution one)
        (r.buildMs || (r.buildMs = {}))[base] = performance.now() - tb;
        retireMesh(r);
        r.mesh = mesh;
        r.meshKey = key;
        r.skey = sk;
        r.fadeBox = null;
        r.meshRes = mesh && mesh.tri.length && GLR.ok ? GLR.createMesh(Region.meshInstances(mesh)) : null;
        scheduleFix();
      }
      // a hold of another geometry is shown only while the shape's live fix-up runs
      if (r.hold && r.hold.skey !== sk && !liveOn(s, r)) dropHold(r);
    } else if (r.meshRes || r.mesh) {
      // a shape that is no longer an area (its id reused) gives back its mesh and map caches
      destroyFix(r); dropHold(r); dropLive(r); GLR.destroy(r.meshRes);
      r.meshRes = r.mesh = r.meshKey = null;
    }
    // a curve formula that no longer classifies as a curve (old saved state, a newer parser) says why in its row
    if (s.kind === 'fcurve') { try { Region.curveDesc(s); s._err = null; } catch (e) { s._err = e.message; } }
    if (t !== 'point') {
      const lkey = sk + '|' + JSON.stringify(clipWin) + (s.kind === 'formula' ? '|' + r.meshKey : '');
      if (r.lineKey !== lkey) {
        // a pair still on screen (the hold) or on its way to it (the live job's mesh) keeps the strokes it was drawn
        // with: fill and strokes then change together, when the new mesh's fix-up lands (a re-centred clipWin, a drag)
        if (r.lineKey !== undefined && ((r.hold && r.hold.lref === r.lineKey) || (r.live && r.live.lref === r.lineKey)) && !(r.lpool && r.lpool.has(r.lineKey))) {
          (r.lpool || (r.lpool = new Map())).set(r.lineKey, { lineRes: r.lineRes, lineKey: r.lineKey, open: r.open, lpolys: r.lpolys, lorigin: r.lorigin, arcs: r.arcs });
          r.lineRes = null;
        }
        const polys = sourceCurves(s, r.mesh).map((c) => Region.sampleCurve(c, clipWin)).filter((p) => p.length >= 4);
        // sent relative to the window centre (precision far from 0 and at deep zoom)
        const origin = [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2];
        // P4 review: the refined samples (SPEC 9.1) are built right here when they fit the frame's budget (a shape
        // drag, a new clipWin after a left-plane pan or zoom, an edit), so motion frames and rest frames draw the same
        // strokes. Today's samples are drawn only when the refinement does not fit (the settle job then swaps it in).
        // r.polys keeps today's samples whatever is drawn: labels, chevrons, fits and hit tests read them (SPEC 9.1:
        // every other caller as today); r.lpolys holds the drawn ones (createLines order, dash arcs).
        const ref = refineNow(s, r, lkey, origin);
        const lp = ref ? ref.polys : polys;
        GLR.destroy(r.lineRes);
        r.lineRes = lp.length && GLR.ok ? GLR.createLines(lp, origin) : null;
        r.polys = polys; r.lpolys = lp; r.lorigin = origin;
        r.lineKey = lkey;
        r.lskey = sk;
        r.refKey = ref ? ref.key : undefined;
        r.arcs = null;
        r.open = t === 'area' && Region.isOpen(s);
        if (!ref) scheduleLines();
      }
    }
    gcLines(r);
    return r;
  }

  // ---------------- maps (what each view shows) ----------------
  const stageMap = (k) => ({ mode: 0, a: 0, b: k });
  // the focused map at t = end, on the left plane (a focused d/dz step's stage is a map of z)
  const endMap = () => (S.focus === 0 ? { mode: 0, a: 0, b: nSteps() } : focusDeriv() ? { mode: 0, a: 0, b: S.focus } : { mode: 0, a: S.focus - 1, b: S.focus });
  // what the right plane plots over the left plane (Phase, Landscape, the phase sphere): the focused map, or, while
  // the deformation transport is open, its homotopy at t
  const focusMap = endMap;
  // The deformation transport, for the renderer: null when closed. map/F: H_t as a map of the left plane (the plot
  // of Phase, Landscape and the phase sphere; map.base names that plane's stage when it is not the z-plane);
  // imageMap/imageF: H_t of the shapes' z-plane (Image, the regions sphere).
  // (v16 deformation range, notes/deform-range/SPEC.md 3: the arithmetic is src/homrange.js; these keep their names)
  const HR = HomRange.make({ n: () => S.steps.length, stepFn, isDeriv, stepActive, stageF, rangeF, built: () => built, C, sig: () => chainSig[nSteps()] + '|' + S.steps.map((st) => st.uid || '').join(',') });
  // the bracket a…b (S.homRange) in its normal form, or null (absent, focus k, or no step outside it)
  const homRangeOk = () => HR.resolve(S);
  const rangeKey = () => { const r = homRangeOk(); return r ? `${r.a}-${r.b}` : ''; };
  // the bracket's pre and post: the active steps before a and after b (at focus 0 with a bracket)
  function rangeParts() { return partsOf(homRangeOk()); }
  function partsOf(r) {
    if (!r) return null;
    const pre = [], post = [];
    for (let k = 1; k < r.a; k++) if (stepActive(k)) pre.push(k);
    for (let k = r.b + 1; k <= nSteps(); k++) if (stepFn(k)) post.push(k);
    return { a: r.a, b: r.b, pre, post };
  }
  function homView() {
    if (!morphOn()) return null;
    const r = morphState(true), a = morphState(false);
    const rg = homRangeOk();
    return { map: r.map, F: r.F, key: r.key, t: morph.T, imageMap: a.map, imageF: a.F, range: rg ? { a: rg.a, b: rg.b } : null, H0F: a.H0F, H0Map: a.H0Map, start: S.focus > 1 || (S.focus === 0 && !!rg) };
  }
  function morphRange() { return HR.range(S); }
  const morphOn = () => morph.open && morphRange().steps.length > 0;
  // All at once (S.homAll): H_t = h_{n,t} o ... o h_{1,t} with one t in [0, 1] for every step (map mode 3); offered
  // for two or more steps without a d/dz (a d/dz is an operator on the chain, not a map with a homotopy of its own).
  // morphLen: the end of the transport's time, m steps one after another, or 1.
  const allAtOnce = () => { const R = morphRange(); return HR.allAtOnce(S, R); };
  const morphLen = () => (allAtOnce() ? 1 : morphRange().steps.length);
  // the primes of a point's label under the deformation: the stages before the bracket, the bracketed steps begun (all
  // of them at once for t > 0) and the post (SPEC 3.2; at focus k and with no bracket, as before)
  // (review v16 math-4: with a bracket the count is the stage reached, bypassed steps included, so the end reads n
  // primes as the static F-image does; with a live post the moving point Q(G_t(P(z₀))) is no stage of the chain
  // (H_0(z₀) = f_3(z₀) in a pullback is not w_1(z₀) = z₀′), so it reads Hₜ(z₀): -1, pointLabel)
  const morphPrimes = () => {
    const R = morphRange();
    if (!R.r) return R.lo + (allAtOnce() ? (morph.T > 0 ? R.steps.length : 0) : Math.ceil(morph.T)) + (R.p1 - R.b);
    const p = rangeParts();
    if (p && p.post.length) return -1;
    const m = R.steps.length, j = allAtOnce() ? (morph.T > 0 ? m : 0) : Math.min(m, Math.ceil(morph.T));
    return j >= m ? R.p1 : j > 0 ? R.steps[j - 1] : R.lo;
  };
  // (exact ends, as homrange.js lerpE and gl.js MAP_STAGE: review v16 math-2)
  const lerpF = (F0, F1, t) => (t <= 0 ? F0 : t >= 1 ? F1 : (z) => { const a = F0(z), b = F1(z); return C((1 - t) * a.re + t * b.re, (1 - t) * a.im + t * b.im); });
  // the natural homotopy of step k at t, a map of its input plane (a straight line when the step has none: a constant
  // or a formula that is not recognisably a catalog map, funcs.js); the identity at t <= 0 and f at t >= 1 (D3)
  const homF = (k, t) => HR.homF(k, t);
  // GPU map spec, CPU function and a label for the current morph time. rel: the source points live in the plot's
  // own plane (the left plane, the input of a focused step: map.base = its stage) instead of the shapes' z-plane;
  // base: an explicit source stage (the merged plane's probe with a pre). A d/dz step deforms along the straight line
  // from G_{k−1} to G_k. With a bracket the steps after it act in full (map.post, map.b).
  function morphState(rel, base) {
    const s = HR.state(S, morph.T, rel, base), L = s.label;
    const rg = L.kind === 'all' && L.part ? homRangeOk() : null;
    const label = L.kind === 'none' ? $t('no active steps')
      : L.kind === 'all' ? (rg ? $t('steps {range} at once · t = {t}', { range: `${rg.a}–${rg.b}`, t: I18N.num(L.t.toFixed(2)) }) : $t('all steps · t = {t}', { t: I18N.num(L.t.toFixed(2)) }))
        : $t('step {k} · {name} · t = {t}', { k: L.k, name: built[L.k - 1] && built[L.k - 1].def ? built[L.k - 1].def.label : '', t: I18N.num(L.t.toFixed(2)) });
    return { map: s.map, F: s.F, label, key: s.key, H0F: s.H0F, H0Map: s.H0Map };
  }
  // the one setter of the bracket (SPEC 3.2): r = {a, b} or null (every step); normalised; the deformation starts over
  // at t = 0 as for a new focus (the play state is kept); saved unless a preview (a drag's snaps); not an undo step
  function setHomRange(r, opt = {}) {
    const before = rangeKey();
    if (r && Number.isInteger(r.a) && Number.isInteger(r.b)) { const nr = HR.normal(r.a, r.b); if (nr) HR.write(S, nr); else deleteOpt('homRange'); } else deleteOpt('homRange');
    const after = rangeKey();
    if (before !== after || opt.force) {
      morph.T = 0; morph.seg = null; morph.u = 0;
      if (!opt.preview) scheduleFix();   // (a drag's fix-ups wait for the release)
      soundFunctionChanged();
      if (opt.preview) {
        // (a drag's snap: the planes and the title only, a uniform change; the cards, the transport and the fit follow
        // at the release, setHomRange(…, {force}))
        requestRender('L', 'R');
        const t = paneTitles();
        if ($('rightTitle').innerHTML !== t.right) $('rightTitle').innerHTML = t.right;
      } else {
        if (rightAuto && morphOn() && rImage()) fitRight();
        buildDock();
        requestRender('L', 'R', 'T');
        updateFocusUI();
        updateCards();
      }
    }
    updateBracket();
    if (!opt.preview) save();
    const g = homRangeOk();
    tourEmit('deformation-range', g ? { a: g.a, b: g.b } : { a: 1, b: nSteps() });
    return g;
  }

  // ---------------- fix-ups: refine triangles that straddle cuts or touch poles ----------------
  // Runs on the CPU after interaction settles; a stale fix-up stays visually correct because the GPU
  // re-validates every refined triangle with the current map.
  const fixJob = { token: 0, timer: 0 };
  function scheduleFix() {
    clearTimeout(fixJob.timer);
    fixJob.token++;
    fixJob.timer = setTimeout(runFix, 160);
    scheduleLines();
  }
  // need(s): some visible consumer of the role draws shape s forward (SPEC 10.4: the flat pane and the globe of role
  // R, the left plane or the left globe of role L); a shape every consumer draws inverse (or is about to: pending)
  // needs no fix-up
  function fixTargets() {
    const out = [];
    const lk = leftStage();
    const needs = (map, role, kind) => (s) => pathOf(s, map, role, kind, { status: true }).path === 'forward';
    if (lk > 0 && solo() !== 'R') out.push({ role: 'L', F: stageF(lk), key: 'S' + chainSig[lk], need: needs(stageMap(lk), 'L', lGlobe() ? 'globe' : 'flat') });
    if (solo() !== 'L') {
      // (Y always shows the images: in its plane or on its globe)
      const imgs = true;
      const kind = rGlobe() ? 'globe' : 'flat';
      if (imgs && morphOn()) {
        if (!morph.playing) { const ms = morphState(false); out.push({ role: 'R', F: ms.F, key: 'M' + chainSig[nSteps()] + ms.key + S.focus, need: needs(ms.map, 'R', kind) }); }
      } else if (imgs && rightStage() > 0) {
        const k = rightStage();
        out.push({ role: 'R', F: stageF(k), key: 'S' + chainSig[k], need: needs(stageMap(k), 'R', kind) });
      }
    }
    return out;
  }
  const yieldNow = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  // a yield between idle slices without the 4 ms clamp of nested setTimeout(0) (which held the SphereMesh driver at
  // about 40% duty: 3 ms of work per 7.6 ms): a background-priority task (scheduler.postTask: rendering and input run
  // first), else a MessageChannel message. Frames still render between slices.
  const yieldCh = new MessageChannel(), yieldQ = [];
  yieldCh.port1.onmessage = () => { const r = yieldQ.shift(); if (r) r(); };
  const yieldTask = () => (typeof scheduler !== 'undefined' && scheduler && typeof scheduler.postTask === 'function'
    ? scheduler.postTask(() => {}, { priority: 'background' })
    : new Promise((r) => { yieldQ.push(r); yieldCh.port2.postMessage(0); }));
  // fix-ups never compete with motion: a homotopy, a view or camera tween, a drag or a playing morph
  const fixBusy = () => !!(trans.k || tweens.length || camTweens.length || drag || (morph.playing && morph.open));
  const FIX_SLICE = 5; // ms of work between yields (spec 8.3: idle slices of at most 6 ms)
  // the idle job: the fix-up of one mesh in FIX_SLICE ms slices, waiting out any motion between them; null when the
  // job went stale (fixJob.token moved on)
  async function computeFix(mesh, F, token) {
    const g = fixGen(mesh, F, { ms: FIX_SLICE });
    for (;;) {
      const st = g.next();
      if (st.done) return st.value;
      await yieldNow();
      while (fixBusy() && token === fixJob.token) await yieldNow(60);
      if (token !== fixJob.token) return null;
    }
  }
  // The fix-up computation as a generator: it yields (to its driver) whenever it has run for slice ms since it was
  // last resumed, and returns {flags, extra}. Two drivers: computeFix (the idle job above) and liveFix (the shape
  // being dragged, advanced inside its motion frames, so its fix-up keeps up with the drag).
  function* fixGen(mesh, F, slice) {
    const SRC = mesh.src, T = mesh.tri, nv = SRC.length / 2, nt = T.length / 3;
    const W = new Float64Array(nv * 2);
    let t0 = performance.now();
    const due = () => performance.now() - t0 > slice.ms;
    for (let i = 0; i < nv; i++) {
      const w = F(C(SRC[2 * i], SRC[2 * i + 1]));
      W[2 * i] = w.re; W[2 * i + 1] = w.im;
      // ([#243] every 8 images: one of a series summed to 4096 terms takes about a millisecond)
      if ((i & 7) === 7 && due()) { yield; t0 = performance.now(); }
    }
    const LIM = 1e12;
    const ok = (x, y) => Math.abs(x) < LIM && Math.abs(y) < LIM;
    const flags = new Float32Array(nt);
    const extra = [];
    let budget = 200000;
    const maxDepth = 5;
    // SPEC 8.1: trouble (the shape needs a SphereMesh): a vertex without a finite image, or a piece still failing the
    // midpoint test at depth 5 (view-independent: the mesh and the map only)
    let trouble = false;
    // depth-first subdivision of one bad triangle (up to 4^5 pieces) on an explicit stack, so the time slice is
    // checked inside it too
    const stack = [];
    function* refine(ax0, ay0, bx0, by0, cx0, cy0, wa0, wb0, wc0) {
      stack.length = 0;
      stack.push([ax0, ay0, bx0, by0, cx0, cy0, wa0, wb0, wc0, 0]);
      let n = 0;
      while (stack.length) {
        const [ax, ay, bx, by, cx, cy, wa, wb, wc, depth] = stack.pop();
        if (ok(wa.re, wa.im) && ok(wb.re, wb.im) && ok(wc.re, wc.im)) {
          const e = Math.max(Math.hypot(wa.re - wb.re, wa.im - wb.im), Math.hypot(wb.re - wc.re, wb.im - wc.im), Math.hypot(wc.re - wa.re, wc.im - wa.im));
          const wm = F(C((ax + bx + cx) / 3, (ay + by + cy) / 3));
          budget--;
          if (Math.hypot(wm.re - (wa.re + wb.re + wc.re) / 3, wm.im - (wa.im + wb.im + wc.im) / 3) <= 0.2 * e) {
            extra.push(ax, ay, bx, by, cx, cy);
            continue;
          }
        }
        if (depth >= maxDepth || budget <= 0) { trouble = true; continue; }
        const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2;
        const wab = F(C(abx, aby)), wbc = F(C(bcx, bcy)), wca = F(C(cax, cay));
        budget -= 3;
        // pushed in reverse, so the pieces are visited in the same order as the recursive version
        stack.push([abx, aby, bcx, bcy, cax, cay, wab, wbc, wca, depth + 1]);
        stack.push([cax, cay, bcx, bcy, cx, cy, wca, wbc, wc, depth + 1]);
        stack.push([abx, aby, bx, by, bcx, bcy, wab, wb, wbc, depth + 1]);
        stack.push([ax, ay, abx, aby, cax, cay, wa, wab, wca, depth + 1]);
        if ((++n & 15) === 0 && due()) { yield; t0 = performance.now(); }
      }
    }
    for (let t = 0; t < nt; t++) {
      const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
      const ax = W[2 * a], ay = W[2 * a + 1], bx = W[2 * b], by = W[2 * b + 1], cx = W[2 * c], cy = W[2 * c + 1];
      const nfin = (ok(ax, ay) ? 1 : 0) + (ok(bx, by) ? 1 : 0) + (ok(cx, cy) ? 1 : 0);
      let bad = nfin < 3;
      if (nfin < 3) trouble = true;
      if (nfin === 0) { flags[t] = 1; continue; } // entirely out of range: nothing to recover
      if (!bad) {
        const e = Math.max(Math.hypot(ax - bx, ay - by), Math.hypot(bx - cx, by - cy), Math.hypot(cx - ax, cy - ay));
        const wm = F(C((SRC[2 * a] + SRC[2 * b] + SRC[2 * c]) / 3, (SRC[2 * a + 1] + SRC[2 * b + 1] + SRC[2 * c + 1]) / 3));
        bad = !(Math.hypot(wm.re - (ax + bx + cx) / 3, wm.im - (ay + by + cy) / 3) <= 0.2 * e);
      }
      if (bad) {
        flags[t] = 1;
        if (budget > 0) yield* refine(SRC[2 * a], SRC[2 * a + 1], SRC[2 * b], SRC[2 * b + 1], SRC[2 * c], SRC[2 * c + 1], C(ax, ay), C(bx, by), C(cx, cy));
        else flags[t] = 0;
      }
      if ((t & 63) === 63 && due()) { yield; t0 = performance.now(); }
    }
    return { flags, extra: new Float32Array(extra), trouble };
  }
  async function runFix() {
    if (!GLR.ok) return;
    // started during motion: try again once it is over (the token stays, so the job is not lost)
    if (fixBusy()) { clearTimeout(fixJob.timer); fixJob.timer = setTimeout(runFix, 120); return; }
    const token = fixJob.token;
    fixJob.running = true; updateLeds();
    try { await runFixInner(token); } finally { if (token === fixJob.token) { fixJob.running = false; updateLeds(); } }
  }
  async function runFixInner(token) {
    for (const tg of fixTargets()) {
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) !== 'area') continue;
        const r = gpu.get(s.id);
        if (!r || !r.mesh || !r.meshRes) continue;
        // the dragged shape's fix-ups are the live driver's (liveFix), also for the tail after the pointer-up
        if (r.live || r.liveTail) continue;
        if (tg.need && !tg.need(s)) continue;
        const old = r.fix[tg.role];
        if (old && old.mapKey === tg.key && old.meshKey === r.meshKey) continue;
        // the other plane may already have refined this mesh for the same map (after adding a step, the left
        // plane shows the stage the right one just refined)
        const twin = Object.values(r.fix).find((f) => f && f.res && f.mapKey === tg.key && f.meshKey === r.meshKey);
        const res = twin ? twin.res : await computeFix(r.mesh, tg.F, token);
        if (!res || token !== fixJob.token || r.meshKey === undefined || !r.meshRes) return;
        let fx = old && old.meshKey === r.meshKey ? old : null;
        if (!fx) fx = { meshKey: r.meshKey, skip: GLR.createSkip(r.meshRes, res.flags) };
        else GLR.setSkip(fx.skip, res.flags);
        if (fx.extraRes) GLR.destroy(fx.extraRes);
        fx.extraRes = res.extra.length ? GLR.createMesh(res.extra) : null;
        fx.mapKey = tg.key; fx.res = res;
        r.fix[tg.role] = fx;
        if (r.hold && Object.keys(r.hold.fix).every((k) => r.fix[k] && r.fix[k].meshKey === r.meshKey)) dropHold(r);
        requestRender(tg.role);
      }
    }
  }

  // ---------------- the forward fallback: SphereMesh (SPEC 8, P5) ----------------
  // An area shape drawn forward (an ineligible chain or shape, exact images off, the cost guard's last resort, a morph
  // paused inside a step) that is unbounded or stretched (bboxOf null, or wider than 3 windows), or whose fix-up found
  // trouble (fixGen: a vertex without a finite image, or a piece still failing the midpoint test at depth 5; the
  // verdict depends on the shape, the map and the window, never on the right view), is drawn from a SphereMesh: the
  // sphere-native NVB mesher of src/sphere.js, refined on the CPU in the image metric, drawn as pre-mapped triangles
  // (GLR.createPreMesh / drawPreMapped). Playing homotopy frames (morph, transitions) keep today's GPU path, and so
  // does a pending inverse compile (it may show an already published mesh of the same content).
  // Jobs: one per key (shape, role, view kind, map, window, K, pattern; view), run one at a time in SM_SLICE ms idle
  // slices that wait out any motion (fixBusy, interacting), with their own keys: scheduleFix's token does not cancel
  // them; LED busy. A job is built for the view where the interaction settled. A flat mesh stays valid while the view
  // lies inside its guard box (the view it was built for, enlarged SM_GUARD times) and its zoom within 2x; a globe mesh
  // while the globe's radius is within 2x. While a rebuild runs, the old mesh of the same content is drawn inside its
  // guard box and today's GPU image (with its fix-ups) around it (8.8). K is that of the shape's alpha (not 8.8's
  // hover-dimmed alpha / 2: at alpha 0.85 that is K = 11 against 3, and exp(H) took 3.5x the work, 2.6 s against 0.74 s
  // at guard 1), so hovering the shape list reruns nothing and a dimmed infinitely-sheeted image may show its 4th and
  // later sheets faintly. The guard is 2 (8.8 says 3: the band's sheets cost 3.2x a guard-1 mesh, against 2.5x at 2).
  // Memory: one mesh per slot (shape, role, view kind) at rest: a slot's new mesh drops the slot's older ones (other
  // content, other views) when it publishes; SM_CPU_BYTES of published meshes (LRU) and GLR's preBytes (32 MB) only
  // bound the transients. Export meshes are dropped once the figure is drawn.
  // Budget (8.4, made deterministic): SphereMesh.APP's map evaluations (a stage-wise step probe counts 12) and nodes,
  // so the drawn mesh is the same whatever the machine's load; SM_MS_CAP CPU ms is a safety stop only. (The wall-clock
  // 1.5 s of 8.4 expired on every P5 scene, so the drawn meshes were partial and changed with the load.)
  const SM_APP = SphereMesh.APP || { maxWork: 250000, maxNodes: 300000, guard: 2 };
  const smWork = () => (SM_APP.workOf ? SM_APP.workOf(SphereMesh.kOf(S.alpha)) : SM_APP.maxWork);
  const SM_GUARD = SM_APP.guard, SM_SLICE = 5, SM_CPU_BYTES = 32 * 1024 * 1024, SM_LIVE_NODES = 1500000, SM_NODES = SM_APP.maxNodes, SM_MS_CAP = 10000;
  const sm = { entries: new Map(), jobs: new Map(), want: new Map(), running: false, kickT: 0, cpuBytes: 0, exportPartial: 0, exportGen: 0, stats: { built: 0, ms: 0, slices: 0, maxSlice: 0, cancelled: 0, partial: 0 } };
  const smOn = () => GLR.ok && !!GLR.createPreMesh;
  function smStretched(s) {
    let bb = null;
    try { bb = Region.bboxOf(s); } catch (e) { bb = null; }
    const ww = clipWin.x1 - clipWin.x0, wh = clipWin.y1 - clipWin.y0;
    return !bb || (bb.x1 - bb.x0) > 3 * ww || (bb.y1 - bb.y0) > 3 * wh;
  }
  // the built steps of a still map (stage-wise limits), or null (a homotopy frame or a d/dz in range: probes)
  function smSteps(m) {
    if ((m.mode || 0) !== 0) return null;
    const out = [];
    for (let k = (m.a || 0) + 1; k <= (m.b || 0); k++) {
      if (isDeriv(k)) return null;
      if (stepFn(k)) out.push(built[k - 1]);
    }
    return out;
  }
  function smInjective(m) {
    if ((m.mode || 0) !== 0) return false;
    const list = [];
    for (let k = (m.a || 0) + 1; k <= (m.b || 0); k++) { if (isDeriv(k)) list.push({ deriv: true }); else if (stepFn(k)) list.push(built[k - 1].props); }
    try { return !!Funcs.composeProps(list).injective; } catch (e) { return false; }
  }
  // (issue #72, I) a still map whose area programs have had nothing to draw this long (the chain's first version still
  // linking: seconds on Direct3D 11) is drawn from a SphereMesh meanwhile, the CPU-mapped mesh with programs that do
  // not carry the chain; not before, so a fast link never shows it
  // (a stand-in for seconds: a coarse mesh, SM_LINK_WORK map evaluations, kept apart from the full meshes by its key)
  const SM_LINKING_MS = 250, SM_LINK_WORK = 20000;
  // SPEC 8.1: why shape s (drawn forward for role under the normalised map m) needs a SphereMesh, or null
  function smNeed(s, r, role, m) {
    if (!smOn() || s._err || kindType(s) !== 'area' || (role !== 'R' && role !== 'L')) return null;
    if (!offRender && (m.mode || 0) === 0 && !isIdentMap(m) && GLR.bareMs && GLR.bareMs(m) > SM_LINKING_MS) return 'linking';
    if ((m.mode || 0) !== 0) {
      // a homotopy frame: never while it plays; paused, only when the shape is drawn forward at an end of the step
      // (a shape drawn exactly at both ends shows today's GPU image while paused inside the step: the mesh changed
      // 0.00% of its pixels there, at 200 ms of CPU and a mesh per paused T)
      if (morph.playing || trans.k) return null;
      const ends = homEnds(m);
      // (an identity end draws the region itself: exact)
      if (!ends || ends.every((e) => isIdentMap(e) || pathOf(s, e, role, 'flat').path !== 'forward')) return null;
    }
    if (isIdentMap(m)) return null;
    if (smStretched(s)) return 'unbounded';
    const f = r && r.fix && r.fix[role];
    const fk = (m.mode || 0) === 0 && !(m.a || 0) ? 'S' + chainSig[m.b || 0] : null;
    if (f && f.res && f.meshKey === r.meshKey && (!fk || f.mapKey === fk) && f.res.trouble) return 'trouble';
    return null;
  }
  // the two still maps a paused homotopy frame lies between (normalizeMap's ends), or null
  function homEnds(m) {
    const base = m.base || 0;
    if ((m.post || 0) > (m.mode === 1 ? m.b || m.hi || 0 : m.b || 0)) return null;   // (v16: a bracket's post: no still ends)
    if (m.mode === 1) { const k = m.hi || 0; return [{ mode: 0, a: base, b: Math.max(base, k - 1) }, { mode: 0, a: base, b: k }]; }
    if (m.mode === 2 || m.mode === 3) return [{ mode: 0, a: base, b: m.a || 0 }, { mode: 0, a: base, b: m.b || 0 }];
    return null;
  }
  // the content of a mesh (everything but the view); with win false, without the meshing window (the stand-in rule)
  function smContent(s, role, kind, m, win = true) {
    const pid = (GLR.PATTERNS || {})[S.pattern] ?? 1;
    return `${s.id}|${shapeKey(s)}|${role}|${kind}|${mapKeyOf(m)}|K${SphereMesh.kOf(S.alpha)}|p${pid}|${patternCell()}|${S.lines ? 1 : 0}` + (win ? `|${winKey()}` : '');
  }
  // the meshing window as the mesher's source view: clipWin at a nominal SM_WIN_PX px across (it is the left pane's box
  // when it was last re-centred), so the source metric depends on clipWin alone (an export's scaled views share it)
  const SM_WIN_PX = 480;
  function smLeft() {
    const w = clipWin.x1 - clipWin.x0, h = clipWin.y1 - clipWin.y0, sv = SM_WIN_PX / Math.max(w, h);
    return { cx: (clipWin.x0 + clipWin.x1) / 2, cy: (clipWin.y0 + clipWin.y1) / 2, s: sv, W: w * sv, H: h * sv };
  }
  // the globe's radius on screen, device px (as sphereView's contact shadow)
  function globeRpx(pane, c, base) {
    const pc = GLR.camera(c, pane.w, pane.h), D = Math.hypot(...pc.eye);
    return D > 1 ? Math.tan(Math.asin(1 / D)) / Math.tan(base.fov / 2) * pane.h / 2 * pane.dpr : 0;
  }
  // the mesher's view of a pane: flat in device px, or the globe's radius
  function smView(kind, pane, R) {
    if (kind === 'globe') return R > 4 ? { kind: 'sphere', R } : null;
    return { kind: 'flat', cx: pane.view.cx, cy: pane.view.cy, s: pane.view.s * pane.dpr, W: pane.pw, H: pane.ph, guard: SM_GUARD };
  }
  const smViewKey = (v) => (v.kind === 'sphere' ? `R${v.R.toFixed(2)}` : `${v.cx},${v.cy},${v.s},${v.W}x${v.H}`);
  function smValid(e, v) {
    if (e.view.kind !== v.kind) return false;
    if (v.kind === 'sphere') return v.R <= 2 * e.view.R && e.view.R <= 2 * v.R;
    if (!(v.s <= 2 * e.view.s && e.view.s <= 2 * v.s)) return false;
    const g = e.guardBox, hw = v.W / 2 / v.s, hh = v.H / 2 / v.s;
    return !!g && v.cx - hw >= g.x0 && v.cx + hw <= g.x1 && v.cy - hh >= g.y0 && v.cy + hh <= g.y1;
  }
  // the GL buffers of a published mesh (uploaded at its first draw; again after an eviction or a context loss)
  function smRes(e) {
    if (!e.res || !e.res.n) e.res = e.data.n ? GLR.createPreMesh(e.data) : null;
    return e.res;
  }
  // the draw state of a pre-mapped mesh (the look of drawScene's forward draw)
  function smLook(s, pane, alpha, map) {
    const ink = shapeInk(s);
    return { view: pane.view, dpr: pane.dpr, color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha, pattern: S.pattern, cell: patternCell(), lines: S.lines, sphN: sphN(),
      stretch: { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) }, key: map ? smKeyOf(map) : null };
  }
  // SPEC 5 for a flat forward mesh (gl.js drawPreMapped): the inverse path's sheet key D (clipWin, its R and rs, the
  // accumulation set P of the chain's plan) and its tie rule, per sample, so the front sheet is the one the exact image
  // shows; null for a chain with no inverse plan (the mesh's own far-to-near leaf order, 8.6)
  function smKeyOf(map) {
    const m = normalizeMap(map);
    if ((m.mode || 0) !== 0 || isIdentMap(m)) return null;
    const plan = invPlan(m.a || 0, m.b || 0);
    if (!plan || !plan.ok) return null;
    const R = Math.hypot(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0) / 2;
    return { win: clipWin, R, rs: R / 8, sing: invSing(plan) };
  }
  // SPEC 8.8: what to draw for forward shape s in a view -> null (today's GPU path) | {e} (a published mesh valid for
  // the view: drawn alone) | {old} (the old mesh of the same content while its rebuild runs: inside its guard box, the
  // GPU image around it). allowJob: a job may be requested for this view (live panes; not a pending compile).
  function smFor(s, r, role, kind, map, pane, R, allowJob) {
    const m = normalizeMap(map);
    const why = smNeed(s, r, role, m);
    if (!why) return null;
    const v = smView(kind, pane, R);
    if (!v) return null;
    const lk = why === 'linking' ? '|link' : '';
    const ck = smContent(s, role, kind, m) + lk, ck0 = smContent(s, role, kind, m, false) + lk;
    // (the stand-in during a rebuild may come from another meshing window: a left pan re-centred clipWin, which
    // changes the mesh's sheet order but not the image: still far nearer to it than today's GPU draw)
    let best = null, old = null;
    for (const e of sm.entries.values()) {
      if (e.ck0 !== ck0) continue;
      if (!best && e.ck === ck && smValid(e, v)) best = e;
      if (!old || (e.ck === ck) > (old.ck === ck) || ((e.ck === ck) === (old.ck === ck) && e.t > old.t)) old = e;
    }
    const slot = `${s.id}|${role}|${kind}`;
    if (best) {
      best.t = performance.now();
      if (!offRender && sm.want.get(slot)) { const j = sm.jobs.get(sm.want.get(slot)); if (j && j.ck === ck) smCancel(j); sm.want.delete(slot); }
      return { e: best, why };
    }
    // (a linking chain's stand-in is asked for whatever the exact path's state: its own program waits on the same links)
    if ((allowJob || why === 'linking') && !offRender) smRequest(slot, ck, s, role, kind, m, v, why);
    return old ? { old, why } : { why };
  }
  function smCancel(job) {
    if (job.mesh) job.mesh.dispose();
    job.mesh = null; job.cancelled = true;
    sm.jobs.delete(job.key);
    sm.stats.cancelled++;
  }
  // a job for (slot, content, view): requested by a draw; it starts once the interaction has settled
  function smRequest(slot, ck, s, role, kind, m, v, why) {
    if (interacting() || fixBusy()) { smKick(); return; }
    const key = ck + '|' + smViewKey(v);
    const prev = sm.want.get(slot);
    if (prev === key && sm.jobs.has(key)) return;
    if (prev && prev !== key) { const j = sm.jobs.get(prev); if (j) smCancel(j); }
    sm.want.set(slot, key);
    if (!sm.jobs.has(key)) {
      const F = cpuMap(m), steps = smSteps(m);
      const cfg = {
        steps, F, injective: smInjective(m), shape: JSON.parse(JSON.stringify(s)),
        left: smLeft(),
        view: v, Kmax: SphereMesh.kOf(S.alpha),
        pattern: { id: (GLR.PATTERNS || {})[S.pattern] ?? 1, cell: patternCell(), lines: !!S.lines },
        maxWork: why === 'linking' ? Math.min(SM_LINK_WORK, smWork()) : smWork(), budgetMs: SM_MS_CAP, maxNodes: SM_NODES,
      };
      sm.jobs.set(key, { key, ck, ck0: smContent(s, role, kind, m, false) + (why === 'linking' ? '|link' : ''), slot, role, kind, view: v, why, cfg, mesh: null, ms: 0, slices: 0, t0: performance.now() });
    }
    smPumpLater();
  }
  // a frame after the interaction settles requests the jobs the motion frames could not
  function smKick() {
    clearTimeout(sm.kickT);
    sm.kickT = setTimeout(() => { if (interacting() || fixBusy()) smKick(); else requestRender('L', 'R'); }, 160);
  }
  let smPumpT = 0;
  function smPumpLater() { if (!smPumpT && !sm.running) smPumpT = setTimeout(() => { smPumpT = 0; smPump(); }, 0); }
  // the idle driver: one job at a time, SM_SLICE ms per slice, waiting out any motion between slices
  async function smPump() {
    if (sm.running) return;
    sm.running = true; updateLeds();
    try {
      for (;;) {
        let job = null;
        for (const key of sm.want.values()) { const j = sm.jobs.get(key); if (j && !j.cancelled) { job = j; break; } }
        if (!job) break;
        while ((fixBusy() || interacting()) && !job.cancelled) await yieldNow(60);
        if (job.cancelled || sm.want.get(job.slot) !== job.key) { if (!job.cancelled) smCancel(job); continue; }
        // live nodes across the jobs kept (one runs at a time; SPEC 8.4: 1.5M live)
        let liveN = 0;
        for (const j of sm.jobs.values()) if (j.mesh && j !== job) liveN += j.mesh.nodes;
        if (liveN > SM_LIVE_NODES) for (const j of [...sm.jobs.values()]) if (j !== job && j.mesh && sm.want.get(j.slot) !== j.key) smCancel(j);
        // (the pre-mapped programs link in the background while the job runs, not at the mesh's first draw)
        if (!job.mesh && GLR.prestart) GLR.prestart(job.kind === 'globe' ? ['regionSP'] : ['regionP']);
        const t0 = performance.now();
        let st;
        try {
          // (the mesher's set-up, its coverage grids, takes a slice of its own; a step aims at SM_SLICE - 2 ms, so a
          // long leaf at its end stays within the 6 ms of a slice)
          if (!job.mesh) { job.mesh = SphereMesh.create(job.cfg); st = { done: false }; }
          else st = job.mesh.step(SM_SLICE - 2);
        } catch (err) { console.error('SphereMesh', err); st = { done: true, failed: true }; }
        const dt = performance.now() - t0;
        job.ms += dt; job.slices++;
        sm.stats.slices++; sm.stats.ms += dt; if (dt > sm.stats.maxSlice) sm.stats.maxSlice = dt;
        if (dt > 6) (sm.stats.long || (sm.stats.long = [])).push([+dt.toFixed(1), job.slices, job.mesh ? job.mesh.phase : -1]);
        if (st.done) smFinish(job, st);
        await yieldTask();
      }
    } finally { sm.running = false; updateLeds(); }
  }
  function smFinish(job, st) {
    sm.jobs.delete(job.key);
    if (sm.want.get(job.slot) === job.key) sm.want.delete(job.slot);
    if (st.failed || !job.mesh) { if (job.mesh) job.mesh.dispose(); return; }
    const data = job.mesh.publish(), stats = job.mesh.stats();
    job.mesh.dispose();
    const bytes = (data.pos ? data.pos.byteLength : 0) + (data.pos3 ? data.pos3.byteLength : 0) + data.attr.byteLength + data.tri.byteLength;
    const e = { key: job.key, ck: job.ck, ck0: job.ck0, slot: job.slot, role: job.role, kind: job.kind, view: job.view, guardBox: data.guardBox, data, res: null, t: performance.now(), bytes, why: job.why, exp: !!job.exp, expGen: job.expGen || 0,
      info: { n: data.n, partial: !!data.partial, nodes: stats.nodes, work: stats.work, ms: +job.ms.toFixed(1), slices: job.slices, settleMs: +(performance.now() - job.t0).toFixed(0), budgetWhy: stats.budgetWhy } };
    // one mesh per slot: the slot's older meshes (another content: pattern, alpha, lines, a paused T, the map; or
    // another view) go now; the new one is the stand-in of the slot's next rebuild
    for (const x of [...sm.entries.values()]) if (x.slot === e.slot) smDrop(x);
    sm.entries.set(e.key, e); sm.cpuBytes += bytes;
    sm.stats.built++; if (data.partial) sm.stats.partial++;
    // memory: the least recently drawn published meshes go first
    if (sm.cpuBytes > SM_CPU_BYTES) for (const x of [...sm.entries.values()].sort((a, b) => a.t - b.t)) { if (sm.cpuBytes <= SM_CPU_BYTES) break; if (x !== e) smDrop(x); }
    requestRender(job.role === 'L' ? 'L' : 'R');
  }
  // the export meshes, once the figure is drawn (or abandoned)
  function smDropExport(gen = null) { for (const e of [...sm.entries.values()]) if (e.exp && (gen == null || e.expGen === gen)) smDrop(e); }
  function smDrop(e) {
    if (sm.entries.get(e.key) === e) { sm.entries.delete(e.key); sm.cpuBytes -= e.bytes; }
    if (e.res) GLR.destroy(e.res);
    e.res = null;
  }
  // a shape removed (or every shape: a context loss drops the GL buffers only, the CPU data re-uploads)
  function smDropShape(id) {
    for (const e of [...sm.entries.values()]) if (e.slot.startsWith(id + '|')) smDrop(e);
    for (const j of [...sm.jobs.values()]) if (j.slot.startsWith(id + '|')) smCancel(j);
    for (const k of [...sm.want.keys()]) if (k.startsWith(id + '|')) sm.want.delete(k);
  }
  // SPEC 10.6: the meshes an export's flat panels draw with, at the export's resolution (prepareExport): every
  // forward shape that needs one, sliced and cancellable (alive), stored like the screen's (slot '...|x', flagged exp)
  // until the figure is drawn (smDropExport). Budget: 4x the screen's work and 2x its nodes (deterministic); a mesh
  // that still ends on a budget is reported (sm.exportPartial -> the figure's partial flag and the dialog's note).
  // Its slices count in sm.stats (maxSlice, long) like the screen's.
  async function smPrepareExport(panes, alive, gen = 0) {
    sm.exportPartial = 0; sm.lastExport = [];
    for (const { role, pane, map } of panes) {
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) !== 'area') continue;
        const r = gpu.get(s.id) || shapeGPU(s);
        if (pathOf(s, map, role, 'flat', { status: true }).path !== 'forward') continue;
        const m = normalizeMap(map);
        if (!smNeed(s, r, role, m)) continue;
        const v = smView('flat', pane, 0), ck = smContent(s, role, 'flat', m);
        const have = [...sm.entries.values()].find((e) => e.ck === ck && smValid(e, v));
        if (have) { if (have.exp) have.expGen = gen; continue; }
        const mesh = SphereMesh.create({
          steps: smSteps(m), F: cpuMap(m), injective: smInjective(m), shape: JSON.parse(JSON.stringify(s)),
          left: smLeft(),
          view: v, Kmax: SphereMesh.kOf(S.alpha), pattern: { id: (GLR.PATTERNS || {})[S.pattern] ?? 1, cell: patternCell(), lines: !!S.lines },
          maxWork: smWork() * 4, budgetMs: SM_MS_CAP * 3, maxNodes: SM_NODES * 2,
        });
        const t0 = performance.now();
        let cpu = 0, slices = 0, st;
        for (;;) {
          if (!alive()) { mesh.dispose(); return false; }
          const a = performance.now();
          st = mesh.step(SM_SLICE - 2);
          const dt = performance.now() - a;
          cpu += dt; slices++;
          sm.stats.slices++; sm.stats.ms += dt; if (dt > sm.stats.maxSlice) sm.stats.maxSlice = dt;
          if (dt > 6) (sm.stats.long || (sm.stats.long = [])).push([+dt.toFixed(1), slices, 'export']);
          if (st.done) break;
          await yieldTask();
        }
        if (st.partial) sm.exportPartial++;
        { const x = mesh.stats(); sm.lastExport.push({ n: mesh.publish().n, partial: !!st.partial, budgetWhy: x.budgetWhy, nodes: x.nodes, work: x.work, ms: +cpu.toFixed(1), slices, view: v }); }
        smFinish({ key: ck + '|' + smViewKey(v), ck, ck0: smContent(s, role, 'flat', m, false), slot: `${s.id}|${role}|flat|x`, role, kind: 'flat', view: v, why: 'export', exp: true, expGen: gen, mesh, ms: cpu, slices, t0 }, { done: true });
      }
    }
    return alive();
  }

  // ---------------- lines: reach and singular points, on settle only (SPEC 9.1, P4) ----------------
  // Motion frames keep today's lineKey and samples (a scrub never resamples, re-uploads or re-caches a line). Once the
  // interaction has settled (LINE_QUIET ms after the last input or change, nothing moving), this idle job builds each
  // line's refined samples (Region.Lines.refine: long curves reach expandBox(clipWin, 1e28) with their tails stopped
  // where the stage maps leave 1e19, samples toward the chain's singular points, formula contours continued as rays)
  // and swaps them in. A refinement is keyed by the line's own key (shape and clipWin), the drawn stages' structure and
  // the structural singular points (rounded to 1e-9 of the window size), so a small parameter change reuses it. It
  // stays drawn through later motion (its samples are fixed in the source plane like today's). A new line key (the
  // shape or clipWin changed) is refined at once in shapeGPU when it fits the frame (refineNow, P4 review); only a
  // shape whose refinement does not fit draws today's samples until this job swaps the refined ones in.
  const lineJob = { token: 0, timer: 0, running: 0 };
  const LINE_QUIET = 150, LINE_SLICE = 5;
  function scheduleLines() {
    clearTimeout(lineJob.timer);
    lineJob.token++;
    lineJob.timer = setTimeout(runLines, 0);
  }
  const lineWait = () => {
    const now = performance.now();
    if (fixBusy() || interacting()) return 60;
    return Math.max(0, LINE_QUIET - (now - Math.max(motionInT, scrubT, lastChangeT)));
  };
  // the stage maps the lines are drawn under (the right plane's, the left plane's when it shows a stage); their plan
  // gives the singular points (a chain's later stages list every earlier op's points too)
  function lineSpec() {
    const ks = [...new Set([rightStage(), leftStage()])].filter((k) => k > 0 && !isIdentMap(stageMap(k))).sort((a, b) => a - b);
    if (!ks.length) return null;
    const top = ks[ks.length - 1];
    const plan = invPlan(0, top);
    const W = Math.max(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0), q = 1e-9 * W;
    let sing = null, sk = 'scan|' + chainSig[top];
    if (plan.ok) {
      try { sing = Inverse.singular(plan, clipWin, ['undef', 'branch', 'pole'], 16); } catch (e) { sing = []; }
      sk = sing.map((e) => e.kind[0] + Math.round(e.z.re / q) + ',' + Math.round(e.z.im / q)).join(';');
    }
    const struct = ks.map((k) => k + ':' + S.steps.slice(0, k).map((st) => (st.on === false ? '-' : st.type)).join(',')).join('/');
    return { Fs: ks.map((k) => stageF(k)), sing, key: struct + '|' + sk };
  }
  // lineSpec() for the current stages, chain and clipWin (Inverse.singular is not free: a shape drag rebuilds its
  // lines every frame with the same spec)
  let lineSpecC = { key: null, spec: null };
  function lineSpecNow() {
    const k = `${rightStage()}|${leftStage()}|${chainSig[nSteps()]}|${S.steps.map((st) => (st.on === false ? '-' : st.type)).join(',')}|${winKey()}`;
    if (lineSpecC.key !== k) { let spec = null; try { spec = lineSpec(); } catch (e) { spec = null; } lineSpecC = { key: k, spec }; }
    return lineSpecC.spec;
  }
  // the refined polylines of shape s (every curve; today's samples for a curve whose refinement throws)
  function refinePolys(s, mesh, spec, origin) {
    const polys = [];
    for (const c of sourceCurves(s, mesh, { reach: 'sphere' })) {
      let ps = [];
      try { ps = Region.Lines.refine([c], spec.Fs, spec.sing, { win: clipWin, origin, maxInsert: 8192, maxEval: 2048 }); } catch (e) { console.error('line refinement', e); ps = [Region.sampleCurve(c, clipWin)]; }
      for (const p of ps) if (p.length >= 4) polys.push(p);
    }
    return polys;
  }
  // The synchronous refinement of a new line key (shapeGPU): {polys, key}, or null when there is nothing to refine or
  // it does not fit: LINE_CAP ms per frame during a drag, LINE_FRAME ms otherwise, judged by the shape's last cost
  // (force: no cap, the figure export)
  const LINE_CAP = 6, LINE_FRAME = 8;
  const lineBudget = { t: -1e9, ms: 0 };
  function refineNow(s, r, lkey, origin, force) {
    if (!GLR.ok || !Region.Lines) return null;
    const spec = lineSpecNow();
    if (!spec) return null;
    const now = performance.now();
    if (now - lineBudget.t > 12) { lineBudget.t = now; lineBudget.ms = 0; }
    if (!force && lineBudget.ms + (r.refMs || 0) > (drag ? LINE_CAP : LINE_FRAME)) return null;
    const polys = refinePolys(s, r.mesh, spec, origin);
    const ms = performance.now() - now;
    r.refMs = ms; lineBudget.ms += ms;
    return { polys, key: lkey + '|' + spec.key };
  }
  // the figure export (prepareExport): every visible shape's lines refined for the current spec, one shape at a time,
  // yielding to the page between shapes once 8 ms have passed (SPEC 10.6: the export never blocks the dialog); alive():
  // false when the export was cancelled (an option changed, the dialog closed) -> false then
  async function refineAllNow(alive = () => true) {
    if (!GLR.ok || !Region.Lines) return true;
    let t0 = performance.now();
    for (const s of S.shapes) {
      if (!alive()) return false;
      const spec = lineSpecNow();
      if (!spec) return true;
      if (s.visible === false || kindType(s) === 'point') continue;
      const r = gpu.get(s.id);
      if (!r || !r.lineKey || r.refKey === r.lineKey + '|' + spec.key) continue;
      const origin = r.lorigin || [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2];
      swapLines(r, refinePolys(s, r.mesh, spec, origin), origin);
      r.refKey = r.lineKey + '|' + spec.key;
      if (performance.now() - t0 > 8) { await new Promise((res) => setTimeout(res, 0)); t0 = performance.now(); }
    }
    return alive();
  }
  // swap in refined polylines (nothing uploaded when they equal the drawn ones)
  function swapLines(r, polys, origin) {
    const old = r.lpolys || [];
    const same = old.length === polys.length && polys.every((p, i) => p.length === old[i].length && p.every((x, k) => x === old[i][k]));
    if (same) return;
    const res = polys.length ? GLR.createLines(polys, origin) : null;
    GLR.destroy(r.lineRes);
    r.lineRes = res; r.lpolys = polys; r.lorigin = origin; r.arcs = null;
    requestRender('L', 'R', 'T');
  }
  async function runLines() {
    lineJob.timer = 0;
    if (!GLR.ok || !Region.Lines) return;
    const wait = lineWait();
    if (wait > 0) { lineJob.timer = setTimeout(runLines, Math.max(20, wait)); return; }
    const token = lineJob.token;
    const spec = lineSpecNow();
    if (!spec) return;
    const todo = [];
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const r = gpu.get(s.id);
      if (!r || !r.lineKey || r.refKey === r.lineKey + '|' + spec.key) continue;
      todo.push([s, r]);
    }
    if (!todo.length) return;
    lineJob.running = token; updateLeds();
    let t0 = performance.now();
    // yield to the page, wait out any motion; true when this job went stale meanwhile
    const rest = async () => {
      await yieldNow();
      while (lineWait() > 0 && token === lineJob.token) await yieldNow(40);
      t0 = performance.now();
      return token !== lineJob.token;
    };
    try {
      const origin = [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2];
      for (const [s, r] of todo) {
        const lkey = r.lineKey, key = lkey + '|' + spec.key;
        const curves = sourceCurves(s, r.mesh, { reach: 'sphere' });
        const polys = [];
        for (const c of curves) {
          let ps = [];
          try { ps = Region.Lines.refine([c], spec.Fs, spec.sing, { win: clipWin, origin, maxInsert: 8192, maxEval: 2048 }); } catch (e) { console.error('line refinement', e); ps = [Region.sampleCurve(c, clipWin)]; }
          for (const p of ps) if (p.length >= 4) polys.push(p);
          if (performance.now() - t0 > LINE_SLICE && await rest()) return;
        }
        if (token !== lineJob.token) return;
        if (r.lineKey !== lkey || gpu.get(s.id) !== r) continue;     // rebuilt meanwhile: its own job follows
        // the same samples as drawn (bounded curves away from singular points): nothing to upload
        swapLines(r, polys, origin);
        r.refKey = key;
        if (performance.now() - t0 > LINE_SLICE && await rest()) return;
      }
    } finally {
      if (lineJob.running === token) { lineJob.running = 0; updateLeds(); }
    }
  }

  // ---------------- drawing ----------------
  // Pattern cell size depends on the shapes (not the view), so it stays put while panning and zooming.
  let cellBase = 0, cellKey = '';
  let cellSay = false, cellSaid = false;   // [v16.5 UX91] an added shape may refit the cell: said once a session
  // (v16 review picture-2) a constructed region far larger than the window (a 3-point disc near collinear) counts as
  // unbounded, as its limit the half-plane does: the cell then stays continuous through the collinear case, never
  // "cell 1×10⁶" (the threshold is the M(R) one, Region.MR_RATIO window diagonals)
  const cmHuge = (s, b) => !!(s._g && b && Math.max(b.x1 - b.x0, b.y1 - b.y0) > (Region.MR_RATIO || 50) * Math.hypot(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0));
  function patternCell() {
    // ([v16.5 fix user-3] keyed on the regions alone, which are all it is fitted to: a curve, a point or a construction
    // added never refits it, which with no bounded region read the window of that moment)
    const key = S.shapes.filter((s) => kindType(s) === 'area').map((s) => { if (!s._g) return shapeKey(s); let b = null; try { b = Region.bboxOf(s); } catch (e) { b = null; } return shapeKey(s) + (cmHuge(s, b) ? '~' : ''); }).join('|');
    if (key !== cellKey || !cellBase) {
      cellKey = key;
      let size = 0;
      for (const s of S.shapes) {
        if (kindType(s) !== 'area') continue;
        let b = null;
        try { b = Region.bboxOf(s); } catch (e) { b = null; }
        if (b && !cmHuge(s, b)) size = Math.max(size, b.x1 - b.x0, b.y1 - b.y0);
      }
      if (!size) size = Math.max(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0);
      const was = cellBase;
      cellBase = Axes.niceStep(size / 10);
      // [v16.5 UX91] a shape the user just added refits the pattern on everything: said once, with where to change it
      if (cellSay && was && was !== cellBase && S.pattern !== 'sphere') {
        const x = I18N.num(CX.fmtNum(cellBase * (S.patternScale || 1), 4).replace('-', '−'));
        setTimeout(() => toast($t('The pattern cell is now {x}, fitted to the shapes; Display → Cell changes it.', { x })), 0);
        cellSaid = true;
      }
      cellSay = false;
    }
    return cellBase * (S.patternScale || 1);
  }
  let hoverShape = null;
  // the strength of shape s's fill: v15 dims the others to 50 % while a row is hovered; (v16 review user-9, SPEC 10)
  // a construction hovered (or, on touch, selected) keeps it, what it is built from and what is built on it, and
  // dims every other shape to 30 %
  let dimMemo = { id: null, t: -1, set: null };
  function cmFocusSet() {
    if (!S) return null;
    let tu = false;
    try { tu = touchUI(); } catch (e) { tu = false; }
    const id = hoverShape || (tu ? selected : null);
    if (!id) return null;
    const now = performance.now();
    if (dimMemo.id === id && now - dimMemo.t < 12) return dimMemo.set;
    let set = null;
    const sh = S.shapes.find((x) => x.id === id) || S.targets.find((x) => x.id === id);
    try { if (sh && (sh.def || sh.at || Constr.graph(S).users(id).size)) set = Construct.linked(id); } catch (e) { set = null; }
    dimMemo = { id, t: now, set };
    return set;
  }
  function dimK(s) {
    const f = cmFocusSet();
    if (f) return f.has(s.id) ? 1 : 0.3;
    return hoverShape && hoverShape !== s.id ? 0.5 : 1;
  }
  const mapKeyOf = (map) => `${map.mode}|${map.a || 0}|${map.b || 0}|${map.hi || 0}|${map.t || 0}|${map.base || 0}|${chainSig[Math.max(map.b || 0, map.hi || 0, map.post || 0)] || ''}|${map.post || 0}`;
  // the CPU twin of a GPU map spec (dash phases of mapped strokes follow its arc length); map.base: the stage of the
  // source plane of a homotopy (0, the z-plane, by default)
  function cpuMap(map) { return HR.cpuMap(map); }   // (v16: with map.post, src/homrange.js)
  // Per segment of r.lineRes (createLines order): the arc length of the curve under F at the segment start and the
  // segment's length, so dashes keep their rhythm along the mapped curve (cached per map key)
  function arcOf(r, F, key) {
    if (!r.arcs) r.arcs = new Map();
    let a = r.arcs.get(key);
    if (a) { r.arcs.delete(key); r.arcs.set(key, a); return a; }
    // anchored at each polyline's point nearest the clipWin centre (P4 review: reach tails start up to 1e28 away,
    // where float32 does not resolve a dash period; the anchor is the same for today's and the refined samples)
    const data = Region.Lines.arcs(r.lpolys || r.polys || [], F, r.lorigin || [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2], Math.hypot(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0) / 2);
    a = { key: `${r.lineKey}|${key}`, data };
    r.arcs.set(key, a);
    if (r.arcs.size > 4) r.arcs.delete(r.arcs.keys().next().value);
    return a;
  }
