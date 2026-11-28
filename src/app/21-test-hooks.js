  // the zeros and poles of the step acting on X: handles in page coordinates, the selection, the step's parameters
  window.__cmwZp = () => { const r = paneL.ocanvas.getBoundingClientRect(), zs = zpStep(); return { k: zs ? zs.k : 0, sel: zpSel, params: zs ? Object.assign({}, zs.st.params) : null, handles: zpHandlesL.map((q) => ({ kind: q.kind, i: q.i, x: r.left + q.x, y: r.top + q.y })), pane: { left: r.left, top: r.top, w: paneL.w, h: paneL.h }, glKey: (() => { try { return String(GLChain.build(S.steps, built).key).length + ':' + String(GLChain.build(S.steps, built).key).slice(-80); } catch (e) { return null; } })() }; };
  window.__cmwTime = (n = 5) => {
    const t = (f, pane) => { f(); pane.ctx.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < n; i++) { f(); pane.ctx.getImageData(0, 0, 1, 1); } return +((performance.now() - t0) / n).toFixed(2); };
    // (X's pane alone is drawn: Y's is not timed)
    return { left: t(renderLeft, paneL), right: null, overlay: t(() => renderOverlays(), paneL), mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), meshN: S.meshN };
  };
  window.__cmwInfo = () => [...gpu.entries()].map(([id, r]) => ({ id, tris: r.meshRes && r.meshRes.n, segs: r.lineRes && r.lineRes.n, fixR: r.fix.R && r.fix.R.extraRes && r.fix.R.extraRes.n, fixL: r.fix.L && r.fix.L.extraRes && r.fix.L.extraRes.n, hold: !!r.hold, live: !!r.live, liveStat: r.liveStat, pool: r.lpool ? r.lpool.size : 0, base: r.meshKey ? +String(r.meshKey).split('|')[1] : null, buildMs: r.buildMs }));
  // per area shape and role: is a hold drawn, and do its strokes belong to another geometry than its fill
  window.__cmwHoldCheck = () => S.shapes.filter((s) => kindType(s) === 'area' && gpu.get(s.id)).flatMap((s) => ['L', 'R'].map((role) => {
    const r = gpu.get(s.id), pm = pairFor(s, r, role).p, L = linesOf(r, pm);
    const held = pm !== r;
    return { id: s.id, role, held, mismatch: held && pm.skey !== r.skey && L === r };
  }));
  window.__cmwFigureState = () => figureState();   // what a link or a scene file carries
  // o.keepClip (srcView): leave clipWin where it was; otherwise it follows the new view as after a pan or zoom
  window.__cmwSet = (k, v, o) => {
    // the saved view fields (the suites set rightMode in many scenes): applied through the migration table,
    // on top of the old fields that name the current view (panels.md 10)
    if (Views.LEGACY.includes(k)) {
      const o = Object.assign(Views.toLegacy(S.view, S.dc, S.landPlain), { [k]: v, dc: S.dc });
      Views.migrate(o);
      setOpt('view', o.view); setOpt('dc', o.dc); setOpt('landPlain', !!o.landPlain);
      applyLayout(); viewChanged('L'); viewChanged('R');
      return;
    }
    if (k === 'view') { setOpt('view', Views.clean(v)); applyLayout(); viewChanged('L'); viewChanged('R'); return; }
    S[k] = v; if (k === 'meshN') { dropAllGPU(); } requestRender('L', 'R');
    if (k === 'srcView' && !(o && o.keepClip)) { clearTimeout(sourceViewChanged.t); sourceViewChanged.pending = false; paneL.setView(leftView()); recentreClip(); }
  };
  // whether the views are still moving to where an action leaves them: X's meshing window still to re-centre (a pan or
  // zoom's sourceViewChanged, 200 ms after the last change, or at pointer-up), or a plane's or a globe camera's tween
  // running; a suite waits for it to be false instead of sleeping (test/lib/wait_kit.js viewsQuiet)
  window.__cmwViewsBusy = () => !!(sourceViewChanged.pending || tweens.length || camTweens.length);
  // the panes' views; setView(side, surf) and setPhase(on) as the controls and keys call them
  window.__cmwView = () => Views.clean(S.view);
  // (X's surface 'land' is the Landscape view; Plane or Sphere on X from the Landscape opens X → Y)
  window.__cmwSetView = (side, surf) => { if (side === 'L' && surf === 'land') return setMain('land'); if (side === 'L' && lLand()) setMain('xy'); return setView(side, surf); };
  window.__cmwSetPhase = (on) => setPhase(on);
  // merged views (merged-views.md): the top bar's view ('xy' | 'phase' | 'land') and the layout the panes are in
  window.__cmwSetMain = (m) => setMain(m);
  // a shape's own colour as its curve is drawn (its ink's edge), as a hex string
  /** @type {any} */ (window).__cmwInk = (id) => { const s = S.shapes.find((x) => x.id === id); return s ? shapeInk(s).edge : null; };
  /** @type {any} */ (window).__cmwToast = (msg, label, o) => toast(msg, label, () => {}, false, o);   // (a message with an optional action that does nothing)
  /** @type {any} */ (window).__cmwAddStep = (type, params, at) => { addStep(type, params, at); return S.steps.length; };   // (a step added as the palette adds it (at: addStep's): its toast "Added f₃ …  Show alone  Undo" shows; answers how many steps there are)
  // (walls tests) a step's parameter set as its field sets it (live, chainChanged(false)): a log's cut
  /** @type {any} */ (window).__cmwStepParam = (k, key, v) => { const st = S.steps[k]; if (!st) return false; st.params[key] = v; chainChanged(false); return true; };
  // the label pass's count and time, and what the last pass of the left plane placed ({ text, x, y, x1, y1, leader }: its box in the pane's px, and whether a leader joins it to a point that a control covers)
  /** @type {any} */ (window).__cmwLabelStats = { n: 0, ms: 0 };
  setLabelProbe((ms, curves) => { const s = /** @type {any} */ (window).__cmwLabelStats; s.n++; s.ms += ms; (s.list = s.list || []).push({ ms: +ms.toFixed(2), curves }); });
  /** @type {any} */ (window).__cmwLabelsPlaced = () => (paneL.labelsPlaced || []).map((q) => ({ text: q.text, x: Math.round(q.x0 * 10) / 10, y: Math.round(q.y0 * 10) / 10, x1: Math.round(q.x1 * 10) / 10, y1: Math.round(q.y1 * 10) / 10, leader: !!q.leader }));
  window.__cmwLayout = () => { const mg = Views.merged(S.view); return { main: S.view.main, deform: !!morph.open, merged: mg, shown: [solo()], wL: paneL.w, wR: paneR.w }; };
  // which pane ('L' | 'R') shows the picture rightMode names (the perf suite drags that pane)
  window.__cmwPaneOf = (mode, sphereMode) => Views.paneOf(mode, sphereMode);
  // the old layout's other pane for that picture (the shapes plane beside an old Phase or Landscape view): null when
  // the view is one merged panel here (the perf suite then measures X's plane in X → Y, the same picture)
  window.__cmwOtherPane = (mode, sphereMode) => (Views.merged(S.view) ? null : Views.paneOf(mode, sphereMode) === 'L' ? 'R' : 'L');
  // (the z-plane's meshing window, the left pane's size and the source view it is the window of: tests compare them)
  window.__cmwClipWin = () => ({ win: Object.assign({}, clipWin), pane: [paneL.w, paneL.h], srcView: Object.assign({}, S.srcView), pending: !!sourceViewChanged.pending, dflt: clipDefault });
  // exact images (SPEC 10.1): the path of every visible area shape in every visible view: [{id, role, viewKind, path, reason}]
  // (entries: each published mesh, its slot `<shape id>|<role>|<kind>` and what its job spent; end: why the job ended,
  // 'done', 'work' or 'nodes' (its deterministic budgets) or 'budgetMs' (the safety stop, cap ms of CPU: a partial mesh
  // that depends on the machine's speed))
  window.__cmwSphere = () => ({ cap: SM_MS_CAP, entries: [...sm.entries.values()].map((e) => ({ key: e.key, slot: e.slot, why: e.why, view: e.view, guardBox: e.guardBox, gpu: !!(e.res && e.res.n), ...e.info, end: e.info.budgetWhy === 'time' ? 'budgetMs' : e.info.budgetWhy || 'done' })), jobs: [...sm.jobs.values()].map((j) => ({ key: j.key, slot: j.slot, why: j.why, ms: +j.ms.toFixed(1), slices: j.slices, nodes: j.mesh ? j.mesh.nodes : 0 })), want: [...sm.want.entries()], running: sm.running, kick: !!sm.kickT, stats: Object.assign({}, sm.stats), cpuBytes: sm.cpuBytes, preBytes: GLR.preBytes, lastExport: sm.lastExport || null });   // (kick: a frame is still due to ask for the jobs the motion frames could not, smKick)
  // the SphereMesh verdict (SPEC 8.1) of every visible area shape for the right pane's map (12.3: invariant under right-view zooms)
  window.__cmwSmVerdict = (role = 'R') => S.shapes.filter((s) => s.visible !== false && kindType(s) === 'area').map((s) => ({ id: s.id, why: smNeed(s, gpu.get(s.id), role, normalizeMap(stageMap(role === 'SV' ? svStage() : role === 'R' ? rightStage() : leftStage()))) }));
  window.__cmwSmReset = () => { for (const e of [...sm.entries.values()]) smDrop(e); for (const j of [...sm.jobs.values()]) smCancel(j); sm.want.clear(); Object.assign(sm.stats, { built: 0, ms: 0, slices: 0, maxSlice: 0, cancelled: 0, partial: 0 }); requestRender('L', 'R'); return true; };
  // (issue #72) a screen pane's own last GPU frame (glStatusNote): {pending, rept, compiling, error, exact, t}, null before one
  window.__cmwPaneStatus = (role = 'R') => (paneGl[role] ? Object.assign({}, paneGl[role]) : null);
  window.__cmwSumRun = (role = 'L', work) => { if (work) { sumWork = work; sumRuns.clear(); requestRender('L', 'R'); } const r = sumRuns.get(role === 'R' ? paneR : paneL); return r ? { taken: r.view !== null, hit: r.hit, spent: r.spent, tried: r.tried } : null; };   // (the pane's last sample of infinite sums that do not converge, sumWatch; work: the terms a sample may evaluate from now on, and a new sample)
  // the glide tile (#1533): shown, its box and the plane's (page px), what it keeps clear of, the spot it takes for
  // its size now (svTileSpot), or null, and the morph it shows (#2409), or null
  // (sync: laid out at once, as svTileLater's job does; trace: true starts a record of each layout and typesetting, with
  // whether it was made where a layout may be (now) and when (t, performance.now()), false ends it; the record so far is the result's trace)
  window.__cmwTile = (sync, trace) => {
    if (trace != null) svTile.trace = trace ? [] : null;
    if (sync) svTileSync(true, true);
    const el = svTile.el, P = $('plotL').getBoundingClientRect(), r = el && !el.hidden ? el.getBoundingClientRect() : null;
    const box = (o) => [Math.round(o.left), Math.round(o.top), Math.round(o.right), Math.round(o.bottom)];
    const obs = svTileObstacles($('plotL'));
    return { shown: !!r && el.style.visibility !== 'hidden', box: r && box(r), plot: box(P), obstacles: obs.map(box), spot: el ? svTileSpot(P, el.offsetWidth, el.offsetHeight, obs) : null, key: svTile.key, fit: [svTile.a && !svTile.a.hidden, svTile.b && !svTile.b.hidden], offscreen: !!SV.offscreen, q: svTile.q, idle: svTile.idle, trace: svTile.trace ? svTile.trace.slice() : null, fits: [svTile.fitA, svTile.fitB],
      // (the morph shown: its glyph pairs and, for each part, its role (a pair, 'out' the first's alone, 'in' the second's,
      // 'nameOut' and 'nameIn' the name's index), its class, its affines at the two ends and now, its opacity now and its
      // box in the page's px)
      morph: svTile.m && !svTile.m.hidden && svTile.morph ? { pairs: svTile.morph.pairs, parts: svTile.morph.parts.map((p) => ({ role: p.role, k: p.k, a: p.a, b: p.b,
        now: (/matrix\(([^)]*)\)/.exec(p.el.getAttribute('transform') || '') || [0, ''])[1].split(' ').map(Number), op: +p.el.getAttribute('opacity'), box: box(p.el.getBoundingClientRect()) })) } : null };
  };
  window.__cmwNoteBox = (role = 'L') => { const b = (role === 'R' ? paneR : paneL).noteBox; return b ? Object.assign({}, b) : null; };   // (the pane's note's box in its last frame, paneNote's, in the pane's CSS px)
  window.__cmwPointName = (id, primes) => { const s = S.shapes.find((x) => x.id === id); if (!s) return null; const keep = figMode; figMode = true; try { return pointLabel(s, 0, primes); } finally { figMode = keep; } };   // (a point's name as a figure writes it, shown primes maps further than the plane it lies on)
  window.__cmwCompileBox = () => (compileBox ? Object.assign({}, compileBox) : null);   // (the compiling note's box, in the pane's CSS px, where it was last drawn)
  // the colour plot's, the phase globe's or the Landscape's stand-in (colourStandIn, globeStandIn, landStandIn, and landCarryStandIn for
  // a carried frame at rest): the cell of its finest level done (css px; null before one; 0 on the globe and the Landscape, whose
  // levels have no cell), whether it is the globe's or the Landscape's, whether it is a carried frame's (carry), and its
  // nodes, its evaluations, CPU ms, slices, the first slice and the longest after it (ms) and why it stopped (null while
  // it runs); null when none
  /** @type {any} */ (window).__cmwStandIn = () => { const j = standInJob, g = j && j.grid; return j ? { cell: g ? g.cell : null, globe: !!j.globe, land: !!j.land, carry: !!j.H, nodes: g ? g.nx * g.ny : 0, n: j.n, ms: +j.ms.toFixed(1), slices: j.slices, firstSlice: +j.firstSlice.toFixed(1), maxSlice: +j.maxSlice.toFixed(1), end: j.end } : null; };
  /** @type {any} */ (window).__cmwCarryStandIn = (n = 9) => { const j = standInJob, g = j && j.H ? j.grid : null; if (!g) return null; const out = []; for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { const i = 2 * (Math.round(b * (g.ny - 1) / (n - 1)) * g.nx + Math.round(a * (g.nx - 1) / (n - 1))); out.push({ fx: Math.round(a * (g.nx - 1) / (n - 1)) / (g.nx - 1), fy: Math.round(b * (g.ny - 1) / (n - 1)) / (g.ny - 1), w: [g.w[i], g.w[i + 1]], q: [g.q[i], g.q[i + 1]] }); } return { box: j.land, nx: g.nx, nodes: out }; };   // (tests) the finest level done of a carried Landscape's stand-in, n x n of its nodes: the box's fractions, the value w and the place q
  window.__cmwPaths = () => {
    const views = [], out = [];
    if (SV.on) views.push(['L', SV.surf === 'sphere' ? 'globe' : 'flat', stageMap(leftStage())]);   // (the steps view has one plane, the shown one: role L, a globe on the Sphere surface)
    // (X draws the shapes' areas in its plane and on its globe; the portrait, the phase globe and the landscape outline them)
    if (!SV.on && (lPlain() || (lGlobe() && !lPhase()))) views.push(['L', lGlobe() ? 'globe' : 'flat', stageMap(leftStage())]);
    // (the steps view draws its regions solid, at full opacity: the program it needs is that one's)
    (SV.on ? withSolidRegions : (f) => f())(() => { for (const [role, viewKind, map] of views) for (const s of S.shapes) {
      if (s.visible === false || kindType(s) !== 'area') continue;
      const p = pathOf(s, map, role, viewKind, { status: true }); out.push({ id: s.id, role, viewKind, path: p.path, reason: p.reason || null });
    } });
    return out;
  };
  // shape ids that draw forward whatever their eligibility (mixed-path tests); [] clears
  window.__cmwHideStrokes = (on) => { hideStrokes = !!on; requestRender('L', 'R'); return hideStrokes; };
  window.__cmwHideStrokesGet = () => hideStrokes;   // the state __cmwHideStrokes set, read back
  window.__cmwForceForward = (ids) => { forceFwd.clear(); for (const id of ids || []) forceFwd.add(id); scheduleFix(); requestRender('L', 'R'); return [...forceFwd]; };
  // the level predictLevel would give the right pane's passes (13.14's estimate; not a floor) and its estimate
  window.__cmwPredict = () => { const list = S.shapes.filter((x) => x.visible !== false); return predictLevel(list, stageMap(rightStage()), 'R', paneR, lastRecs); };
  // per shape: the line key, whether the settle-time refinement is in (SPEC 9.1), segments and pieces drawn
  window.__cmwLines = () => [...gpu.entries()].map(([id, r]) => ({ id, refined: !!r.refKey && r.refKey.startsWith(r.lineKey + '|'), current: (() => { const sp = lineSpecNow(); return !sp || r.refKey === r.lineKey + '|' + sp.key; })(), segs: r.lineRes ? r.lineRes.n : 0, pieces: r.lpolys ? r.lpolys.length : 0, refMs: r.refMs, running: !!lineJob.running,
    // (the drawn polylines' size and a weighted sum of their coordinates: a sliced refinement must give the same)
    pts: r.lpolys ? r.lpolys.reduce((n, p) => n + p.length, 0) : 0, sum: r.lpolys ? r.lpolys.reduce((a, p) => p.reduce((b, x, i) => b + x * ((i % 7) + 1), a), 0) : 0 }));
  // the cost guard per pane, the timer and the display interval estimate
  window.__cmwGuard = () => ({ R: guard ? guard.state('R') : null, L: guard ? guard.state('L') : null, timer: !!(GLR.timer && GLR.timer.available), inverseDraws: GLR.inverseDraws, log: guardLog.slice() });
  // a fresh cost guard with policy options (GLR.CostGuard opts, e.g. {budget: 1e9}: measure only), for measurements
  window.__cmwGuardOpts = (o) => { if (!GLR.CostGuard) return null; guard = GLR.CostGuard(Object.assign({}, GUARD_OPTS, o || {})); for (const g of Object.values(paneG)) { g.key = ''; g.reads = []; g.demoted = false; } guardLog.length = 0; requestRender('L', 'R'); return guard.state('R'); };
  // the look drawScene gives shape id (colours as hex), the pattern cell, X's view, clipWin and the plane colour
  // a traced curve of a later plane as the inverse pass strokes it (invTrace): {tol (used), base (TRACE_TOL's), n (its
  // vertices), samples (shapeGPU's r.polys, flat), lines (the simplified polylines)}, or null
  window.__cmwTrace = (id) => { const s = S.shapes.find((x) => x.id === id), lines = s && invTrace(s), rec = lines && traces.get(shapeGPU(s).polys); return rec ? { tol: rec.tol, base: rec.base, n: lines.reduce((k, p) => k + p.length, 0), samples: shapeGPU(s).polys.map((p) => Array.from(p)), lines } : null; };
  window.__cmwLook = (id) => { const s = S.shapes.find((x) => x.id === id); if (!s) return null; const k = shapeInk(s); return { color: k.c0, color2: k.alt, edge: k.edge, ink: TH.ink, alpha: S.alpha, pattern: S.pattern, cell: patternCell(), lines: S.lines, sphN: sphN(), plane: TH.plane, halo: TH.halo, haloA: TH.haloA, view: Object.assign({}, leftView()), win: Object.assign({}, clipWin), dpr: paneL.dpr, W: paneL.pw, H: paneL.ph, stage: leftStage() }; };
  // P3: the globe's point under a pixel of X's pane (null off the globe), and a globe's camera set directly
  // P3b: the shapes and targets as stored; the CSS pixel of the plane point (x, y) on a side's globe (null behind it)
  window.__cmwShapes = () => JSON.parse(JSON.stringify({ shapes: S.shapes, targets: S.targets, selected }, noRuntime)); window.__cmwStroke = (id, opt) => { const s = S.shapes.concat(S.targets).find((q) => q.id === id); const k = s && shapeStroke(s, 1, opt || {}); return k && { width: k.width, alpha: k.alpha, casing: k.casing && k.casing.width, casingAlpha: k.casing && k.casing.alpha }; };
  window.__cmwGlobeXY = (side, x, y) => { const gc = globeCam(side); if (!gc) return null; const P = Number.isFinite(x) ? Region.Globe.lift(x, y) : [0, 0, 1]; return gScreen(gc, P); };
  window.__cmwGlobeSnap = (side, x, y, role) => { const gc = globeCam(side), g = pickGlobe(side === 'L' ? paneL : paneR, camOf(side), x, y); const r = g && gc ? globeSnap(gc, side, g, role) : null; gSnapMark = null; return r ? { z: r.z && [r.z.re, r.z.im], snapped: !!r.snapped, g: g.z && [g.z.re, g.z.im], R: gc.R } : null; };
  // the number of inked overlay pixels within r CSS px of the world point z = [re, im] on a pane's overlay (a drawn handle is ink)
  window.__cmwOverlayInk = (side, z, r = 8) => { const p = side === 'R' ? paneR : paneL, [x, y] = p.w2s({ re: z[0], im: z[1] }), k = p.ocanvas.width / p.w; const d = p.octx.getImageData(Math.max(0, Math.round((x - r) * k)), Math.max(0, Math.round((y - r) * k)), Math.round(2 * r * k), Math.round(2 * r * k)).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
  /** @type {any} */ (window).__cmwTeach = () => { probeTeachUntil = performance.now() + 60000; const lr = $('leftReadout'); lr.innerHTML = idleLeft(); return !!lr.querySelector('.rteach'); };   // (the phone's first idle readout of a session, with its teaching hint, as the page builds it)
  /** @type {any} */ (window).__cmwPaneNote = (key, vars) => { paneNote(paneL, $t(key, vars)); return paneL.noteBox; };   // (a note drawn on the left plane, its box)
  window.__cmwSelect = (id) => { selected = id; if (id) zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL', 'OR'); };
  window.__cmwGlobeHandles = (side) => { const gc = globeCam(side); const s = (side === 'R' ? S.targets : S.shapes).find((x) => x.id === selected); return s && gc ? globeHandles(s, gc).map(([k, P]) => [k, gScreen(gc, P)]) : []; };
  window.__cmwSphereWL = (x, y) => { const w = pickSphere(paneL, camOf('L'), x, y); return w ? [w.re, w.im] : null; };
  // (test/sv_globe_mask_cmd.js) the left pane's points under its pixels, on the globe or the flat plane: pane-local
  // CSS px, every step px from x0, y0 in a w × h block; a flat [re, im, …] list, NaN where no point (off the globe)
  window.__cmwLeftZ = (x0, y0, w, h, step = 1) => {
    const out = [], globe = lGlobe();
    if (!globe) paneL.setView(leftView());
    for (let y = y0; y < y0 + h; y += step) for (let x = x0; x < x0 + w; x += step) {
      const z = globe ? pickSphere(paneL, camOf('L'), x, y) : paneL.s2w(x, y);
      if (z && CX.isFin(z)) out.push(z.re, z.im); else out.push(NaN, NaN);
    }
    return out;
  };
  // the left pane's Landscape frame redrawn once as the relief alone on a transparent frame (the figure's coverage render, artRelief: no
  // floor, plate, marks or labels), the same carry, view and camera: the alpha plane of the pane's canvas kept as window.__cmwLandRelief.cov
  // (one byte a pixel, w x h; 255 where the relief covers the pixel), and the frame then drawn again as before. -> { w, h, n: covered pixels },
  // or null with no canvas
  window.__cmwLandRelief = () => {
    const cv = /** @type {any} */ (document.getElementById('canvasL'));
    if (!cv) return null;
    const keep = { artMode, artRelief };
    try {
      artMode = true; artRelief = true;
      // (the frame starts from a clear canvas: a transparent fill leaves what is drawn there)
      paneL.ctx.setTransform(1, 0, 0, 1, 0, 0); paneL.ctx.clearRect(0, 0, cv.width, cv.height);
      renderLeft();
      const q = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data, cov = new Uint8Array(cv.width * cv.height);
      let n = 0;
      for (let i = 0; i < cov.length; i++) { cov[i] = q[4 * i + 3]; if (cov[i] > 0) n++; }
      Object.assign(window.__cmwLandRelief, { cov, w: cv.width, h: cv.height });
      return { w: cv.width, h: cv.height, n };
    } finally {
      artMode = keep.artMode; artRelief = keep.artRelief;
      renderLeft();
    }
  };
  window.__cmwCam = (side, o) => { const c = camOf(side); if (o) { Object.assign(c, o, { vyaw: 0, vpitch: 0 }); requestRender(side); } return { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx || 0, ty: c.ty || 0, tz: c.tz || 0, fov: c.fov }; };
  window.__cmwGlobeDisk = (side) => { const g = globeCam(side); return g ? { R: g.R, w: g.pane.w, h: g.pane.h } : null; };   // (a globe pane's silhouette radius R, and the pane's size, in CSS px: the app's own globeCam)
  // what the live panes last drew each shape with: {'R|s1': 'inverse' | 'pending' | 'forward', ...}
  window.__cmwDrawn = () => Object.fromEntries(lastPath);
  // the scissor w-box of shape id's image under the right plane's map (SPEC 4.8; null: no scissor)
  window.__cmwInvBox = (id) => {
    const s = S.shapes.find((x) => x.id === id);
    if (!s) return null;
    const p = pathOf(s, stageMap(rightStage()), 'R', 'flat');
    return p.e ? invBox(p.e, p.plan, s) : null;
  };
  // TEST-HOOK

  // TEST-HOOK (dropped from the published page by build.py)
  // (the test hooks go on: a block of their own, as t_publish caps a block's length)
  // (-> whether example i is now the current one: false past the last example)
  window.__cmwExample = (i) => { loadExample(i); return currentExample === i; };
  // the selection, the step shown alone, the temporary Inspector and X's view
  window.__cmwBusy = (on) => { fixJob.running = !!on; updateLeds(); return fixJob.running; };   // (the LEDs' busy state, as a running fix job sets it; false lets them rest)
  window.__cmwCards = () => ({ sel: selOf(), focus: S.focus, temp: tempInsp, main: { view: Object.assign({}, paneL.view), w: paneL.w, h: paneL.h, dpr: paneL.dpr } });
  // (#235: what the Cauchy style draws from, and a switch to draw the quadrature where the formula holds)
  // the Cauchy style's residue data as the carried colour takes it (plan, edges, part shown, chain length), or null
  /** @type {any} */ (window).__cmwCauchyCarry = () => svCauchyCarry();
  /** @type {any} */ (window).__cmwCauchy = () => { const cp = cauchyPlot(); return cp ? { name: cp.name, formula: !!(cp.plan && cp.plan.ok), fast: !!(cp.plan && cp.plan.fast), why: cp.plan && !cp.plan.ok ? cp.plan.why : null, poles: cp.plan && cp.plan.ok ? cp.plan.poles.map((q) => ({ z: [q.z.re, q.z.im], order: q.order, n: q.n })) : [] } : null; };
  /** @type {any} */ (window).__cmwCauchyQuad = (v) => { INT.setCauchyQuad(v); requestRender('L'); };
  // (the Cauchy style's draw time: n frames of the left pane, each read back so the GPU has finished; ms per frame)
  /** @type {any} */ (window).__cmwCauchyBench = (n) => { const g = GLR.gl, px = new Uint8Array(4), t0 = performance.now(); for (let i = 0; i < n; i++) { renderColor(paneL); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); } return (performance.now() - t0) / n; };
  /** @type {any} */ (window).__cmwCauchyOpt = (show, plus) => { setOpt('cauchyShow', show); setOpt('cauchyPlus', !!plus); requestRender('L'); save(); };
  // (SPEC 10.6, 12.4 (h)) the figure export of X's panel (opt: {widthIn, caption, alive}), and X drawn off-screen at
  // print size (a PNG data URL)
  window.__cmwBuildFigure = (opt) => buildFigure(Object.assign({ widthIn: 7, caption: false }, opt || {}));
  // the deformation's range (__cmwMorph) and the screen's path selection
  // kind 'H' (the image side at T), 'H0', 'F' (the chain), 'cpuMap' (a map spec's
  // CPU twin): pts [[x, y]] -> [[re, im]] (null for a non-finite value)
  window.__cmwEval = (kind, specOrT, pts) => {
    const T0 = morph.T;
    let F;
    try {
      if (kind === 'H') { if (specOrT != null) morph.T = specOrT; F = morphState(false).F; }
      else if (kind === 'H0') F = morphState(false).H0F;
      else if (kind === 'F') F = stageF(nSteps());
      else if (kind === 'cpuMap') F = cpuMap(specOrT);
    } finally { morph.T = T0; }
    return F ? pts.map((q) => { const w = F(C(q[0], q[1])); return CX.isFin(w) ? [w.re, w.im] : null; }) : null;
  };
  window.__cmwRange = () => ({ stored: S.homRange ? JSON.parse(JSON.stringify(S.homRange)) : null, ok: homRangeOk(), stops: HR.stops(S), start: rangeStart('text'), parts: rangeParts() });
  // the deformation's bracket (range: null is every step) and the time the steps view keeps in morph.T
  window.__cmwMorph = (o) => { if (o && 'range' in o) setHomRange(o.range, { preview: !!o.preview }); return { T: morph.T }; };
  // the step glide: press ‹ (d -1) or › (+1) as the phone's chain row does; read where it is
  /** @type {any} */ (window).__cmwGlide = (d) => { if (d) glideStep(d); return { open: morph.open, T: trans.glide ? glide.x : morph.T, x: glide.x, v: glide.v, target: glide.target, moving: glide.moving(), since: glide.since, max: morphLen(), playing: morph.playing, peek: trans.glide, at: trans.at, stage: rightStage(), yHtml: yHtml() }; };
  window.__cmwMorphSel = async (o) => { if (!morphOn()) return null; const t0 = performance.now(); const sel = await morphSelScreenNow(paneR, !!(o && o.force)); const wall = performance.now() - t0; if (!sel) return null; const end = S.focus > 0 ? S.focus : nSteps(); const base = S.focus > 0 ? S.focus - 1 : 0; return { ms: sel.ms, wall, budget: sel.budget, n: sel.kept.length, nCands: sel.nCands, kept: sel.kept.map((k) => { const w = stageF(end)(k.sp.z), w0 = stageF(base)(k.sp.z), a = k.s[0].w, b = k.s[k.s.length - 1].w; return { z: [k.sp.z.re, k.sp.z.im], kind: k.sp.kind, start: k.l[0], end: k.l[k.l.length - 1], path: k.l, F: [w.re, w.im], W0: [w0.re, w0.im], Ws: [a.re, a.im], We: [b.re, b.im], meet: !!k.meet }; }), log: sel.log.map(([c, why]) => [c.sp.z.re, c.sp.z.im, c.sp.kind, why]) }; };
  // paths-aesthetics (test/deform_nat_cmd.js): the screen's kept paths measured in its px. seg: the longest drawn
  // segment; jump: the largest distance of H at a segment's mid time from the segment's midpoint (segments over 3 px:
  // a jump across a cut would be about half the segment); ang: the largest angle between drawn segments over 0.3 px,
  // turn: that angle over the mean length of its two segments (rad/px; p99 and max), kink: the largest angle between
  // two segments both over 1.5 px (the trace refines a turn into short chords: a kink is a corner it left); sep: per
  // path, the share of its 3 px samples (away from the paths' ends, the transport and the legend) within 0.7 dTest of
  // another path, in the px it was chosen in (the worst path); heads: the last frame's moving points vs H_T(z) (px)
  window.__cmwPathsCheck = () => {
    // (measured as the paths were chosen: in the view of their pane then (mfCache.v0), under the homotopy they were
    // traced with (mfCache.src: the steps view's, whose T counts from its segment's first plane))
    const src = mfCache.src, v0 = mfCache.v0;
    const sel = mfCache.rsel && src && mfCache.rkey === mfScreenKey(paneL, src).key ? mfCache.rsel : mfCache.sel;
    if (!sel || !src || !v0) return null;
    const P = (w) => [v0.w / 2 + (w.re - v0.cx) * v0.s, v0.h / 2 - (w.im - v0.cy) * v0.s];
    const Fc = new Map(), Fat = (T) => { let f = Fc.get(T); if (!f) { f = src.Fat(T); Fc.set(T, f); } return f; };
    let seg = 0, jump = 0, ang = 0, kink = 0, nSeg = 0, kinkStep = 0;
    const turns = [], polys = [], nodeT = pathMarkTimes(sel.Tend || morphLen()).nodes;
    const g = SegGrid(6);
    for (const k of sel.kept) {
      const ls = [];
      for (const r of k.runs) {
        const l = r.map((q) => P(q.w));
        ls.push(r.map((q) => q.p));
        for (let i = 1; i < r.length; i++) g.add(r[i - 1].p, r[i].p, k);
        for (let i = 1; i < l.length; i++) {
          const a = l[i - 1], b = l[i], L = mDist(a, b);
          nSeg++; seg = Math.max(seg, L);
          if (L > 3) { const m = P(Fat(0.5 * (r[i - 1].T + r[i].T))(k.sp.z)); jump = Math.max(jump, mDist(m, [0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1])])); }
          if (i >= 2) {
            const o = l[i - 2], L0 = mDist(o, a);
            // (a step's end, one after another, is a corner of H itself: it is marked with a bar and counted apart)
            const atNode = nodeT.some((t) => Math.abs(r[i - 1].T - t) < 1e-9);
            if (L0 > 0.3 && L > 0.3) { const q = Math.acos(Math.max(-1, Math.min(1, ((a[0] - o[0]) * (b[0] - a[0]) + (a[1] - o[1]) * (b[1] - a[1])) / (L0 * L)))); if (atNode) { kinkStep = Math.max(kinkStep, q); continue; } ang = Math.max(ang, q); turns.push(q / (0.5 * (L0 + L))); if (L0 >= 1.5 && L >= 1.5) kink = Math.max(kink, q); }
          }
        }
      }
      polys.push({ k, ls });
    }
    const ex = 0.75 * PATHS.sep, d = 0.7 * PATHS.dTest, nogo = src.nogo ? src.nogo(paneL) : [];
    let sep = 0;
    // (only a path's own start and end are exempt, within ex: the review's measure; another path's end is not.
    // sepLong: the share within 2 dTest, for paths longer than longK dS)
    let sepLong = 0;
    for (const { k, ls } of polys) {
      if (!ls.length) continue;
      const lr = ls[ls.length - 1], ends = [ls[0][0], lr[lr.length - 1]];
      let n = 0, near = 0, far = 0;
      for (const l of ls) for (const p of resamplePx(l, 3)) {
        if (p[0] < 0 || p[1] < 0 || p[0] > v0.w || p[1] > v0.h - 8 || nogo.some((R) => p[0] >= R.x0 && p[0] <= R.x1 && p[1] >= R.y0 && p[1] <= R.y1) || ends.some((q) => mDist(p, q) < ex)) continue;
        n++; if (g.near(p, d, k) < d) near++; if (g.near(p, PATHS.longD * PATHS.dTest, k) < PATHS.longD * PATHS.dTest) far++;
      }
      if (n) sep = Math.max(sep, near / n);
      if (n && (k.lenPx || 0) > PATHS.longK * PATHS.dS) sepLong = Math.max(sepLong, far / n);
    }
    // the review's other measures: the shortest path, the largest retrace share, an end dot's or a ring's nearest
    // other line, a ring's nearest other end, the turn at a step's end
    // (ownLine: a ring's or an end dot's distance from its own path's line beyond its first / before its last dS)
    let minLen = Infinity, retr = 0, endLine = Infinity, ringLine = Infinity, ringEnd = Infinity, ownLine = Infinity;
    for (const { k, ls } of polys) {
      if (!ls.length) continue;
      minLen = Math.min(minLen, k.lenPx || 0);
      {
        const q0 = ls[0][0], lq = ls[ls.length - 1], qe = k.runs[k.runs.length - 1].slice(-1)[0].T >= sel.Tend - 1e-9 ? lq[lq.length - 1] : null;
        let L = 0, acc = 0;
        for (const l of ls) for (let i = 1; i < l.length; i++) L += mDist(l[i], l[i - 1]);
        for (const l of ls) for (let i = 1; i < l.length; i++) { const a0 = acc; acc += mDist(l[i], l[i - 1]); if (a0 > PATHS.dS) ownLine = Math.min(ownLine, segD(q0, l[i - 1], l[i])); if (qe && acc < L - PATHS.dS) ownLine = Math.min(ownLine, segD(qe, l[i - 1], l[i])); }
      }
      retr = Math.max(retr, retraceShare(ls.flatMap((l) => resamplePx(l, 3)), 2, 6));
      const lr = ls[ls.length - 1], s0 = ls[0][0], e0 = k.runs[k.runs.length - 1].slice(-1)[0].T >= sel.Tend - 1e-9 ? lr[lr.length - 1] : null;
      for (const o of polys) {
        if (o.k === k || !o.ls.length) continue;
        for (const l of o.ls) for (let i = 1; i < l.length; i++) { if (e0) endLine = Math.min(endLine, segD(e0, l[i - 1], l[i])); ringLine = Math.min(ringLine, segD(s0, l[i - 1], l[i])); }
        const ol = o.ls[o.ls.length - 1];
        ringEnd = Math.min(ringEnd, mDist(s0, ol[ol.length - 1]));
      }
    }
    turns.sort((a, b) => a - b);
    let heads = 0;
    if (mfDrawn) for (const h of mfDrawn.heads) { const q = P(Fat(mfDrawn.T)(C(h[2], h[3]))); heads = Math.max(heads, mDist(q, h)); }
    return { ownLine, arrowMin: sel.arrowMin, kinkStep, minLen, retrace: retr, endLine, ringLine, ringEnd, sepLong, ink: sel.ink, cap: sel.budget, n: sel.kept.length, nSeg, seg, jump, ang, kink, turnP99: turns.length ? turns[Math.floor(0.99 * (turns.length - 1))] : 0, turnMax: turns.length ? turns[turns.length - 1] : 0, sep, heads, nHeads: mfDrawn ? mfDrawn.heads.length : 0, T: mfDrawn ? mfDrawn.T : null, kinds: sel.kept.reduce((a, q) => { a[q.sp.kind] = (a[q.sp.kind] || 0) + 1; return a; }, {}) };
  };
  window.__cmwMorphCache = () => ({ ready: !!(mfCache.sel && mfCache.key === mfScreenKey(paneR).key && (mfCache.vkey === mfScreenKey(paneR).vkey || mfViewOk(paneR, classicSource()))), job: !!mfCache.job, zs: mfCache.sel ? mfCache.sel.kept.map((k) => [k.sp.z.re, k.sp.z.im]) : null, rej: mfCache.sel ? mfCache.sel.rej : null, away: mfCache.sel ? mfCache.sel.away : null, prev: mfCache.prev ? mfCache.prev.sel.kept.length : 0 });
  window.__cmwLastFigure = () => Figure.last();
  window.__cmwFigPathsSel = () => (mfFigCache.sel ? { n: mfFigCache.sel.kept.length, nCands: mfFigCache.sel.nCands, cap: mfFigCache.sel.budget, rej: mfFigCache.sel.rej } : null);
  window.__cmwFig = Figure;
  window.__cmwTeX = TeX;
  /** @type {any} */ (window).__cmwCapParts = () => { const c = figCapParts(); return { Fname: c.Fname, raw: c.raw, formula: c.formula, mapTex: c.mapTex }; };
  // (side 'L': X's pane, the only one drawn)
  window.__cmwRenderOff = (side, w, h, dpr) => { if (side !== 'L') throw new Error('only X (side L) is drawn'); return renderOff(w, h, dpr).toDataURL('image/png'); };
  // client coordinates of plane point (re, im) in the left ('L') or right ('R') plane, as last drawn
  // (test/ux165_plane_cmd.js) the open draft, the handle size in use
  window.__cmwDraft = () => (draft ? { kind: draft.kind, pts: (draft.pts || []).map((p) => p.slice()) } : null);
  window.__cmwHandles = () => ({ size: fingerNow() ? 12 : 7, touch: ptrTouch });
  window.__cmwW2S = (side, re, im) => { const p = side === 'L' ? paneL : paneR; const r = p.ocanvas.getBoundingClientRect(); const v = p.view; return [r.left + p.w / 2 + (re - v.cx) * v.s, r.top + p.h / 2 - (im - v.cy) * v.s]; };
  // TEST-HOOK

  // TEST-HOOK (dropped from the published page by build.py)
  // (the test hooks go on: a block of their own, as t_publish caps a block's length)
  // a Repeat chain's exact plane (#1472): o.nodes sets the GPU's node budget of a REPT search (GLR.setReptNodes; 0: its
  // own), o.poison a non-finite root at every first node ('nan' | 'inf'; null: none; GLR.setReptPoison), for the
  // unresolved hatch's controls; o.tiles the root solves of a REPT draw's tile (GLR.setReptTileSolves; 0: its own),
  // o.fast its first pass's budget (GLR.setReptFastNodes; 0: its own), o.holdB its second pass held (GLR.holdReptB);
  // o.tileStats: the tile account since the last read (GLR.reptTiles); o.lose: the GL context lost, then restored at
  // the next task (WEBGL_lose_context); o.ci: the first shape's colour index (a look change, the cache's control);
  // o.outline: the refinements of a Repeat's outlines run so far, and the last one's vertices (outlineRes);
  // o.land: the Landscape mask's unresolved pixels (null: no mask) and the mask's pixels marked no-value (opaque and
  // dark, svLandMask); o.ws [[re, im]]: the CPU twin of the left plane's
  // REPT searches (Inverse.enumerate) at those plane points, per shape drawn by a REPT plan: the most and the total root
  // solves, the pruned children, and the pixels covered, empty and unresolved
  window.__cmwRept = (o) => {
    if (o && o.tileStats) return GLR.reptTiles();
    if (o && o.lose) {
      const x = GLR.gl && GLR.gl.getExtension('WEBGL_lose_context');
      if (!x) return false;
      x.loseContext(); setTimeout(() => x.restoreContext(), 0);
      return true;
    }
    if (o && 'ci' in o) { setShapes(S.shapes.map((s, i) => (i === 0 ? Object.assign({}, s, { ci: o.ci }) : s))); requestRender('L', 'R'); return 1; }
    if (o && ('nodes' in o || 'poison' in o || 'tiles' in o || 'fast' in o || 'holdB' in o)) {
      if ('fast' in o) GLR.setReptFastNodes(o.fast);
      if ('holdB' in o) GLR.holdReptB(o.holdB);
      if ('nodes' in o) GLR.setReptNodes(o.nodes);
      if ('poison' in o) GLR.setReptPoison(o.poison);
      if ('tiles' in o) GLR.setReptTileSolves(o.tiles);
      svLandMaskC = null; requestRender('L', 'R');
    }
    if (o && o.outline) return { runs: reptOutlineRuns, verts: reptOutlineVerts };
    if (o && o.land) {
      if (!svLandMaskC) return { unresolved: null, marked: null };
      const cv = svLandMaskC.cv, d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let marked = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] >= 128 && d[i] < 128) marked++;
      return { unresolved: svLandMaskC.unres, marked };
    }
    if (!o || !o.ws) return null;
    const map0 = stageMap(leftStage()), pix = 1 / (paneL.view.s * paneL.dpr), out = [];
    for (const s of S.shapes) {
      const m = shapeMap(s, map0), p = m && pathOf(s, m, 'L');
      if (!p || p.path !== 'inverse' || !p.plan.ops.some((x) => x.kind === 'REPT')) continue;
      const r = { shape: s.id, nodesMax: 0, nodes: 0, pruned: 0, covered: 0, empty: 0, unresolved: 0 };
      for (const [re, im] of o.ws) {
        const e = Inverse.enumerate(p.plan, p.prep, C(re, im), pix, { leaves: false }).rept;
        r.nodesMax = Math.max(r.nodesMax, e.nodes); r.nodes += e.nodes; r.pruned += e.pruned;
        if (e.verdict > 0) r.covered++; else if (e.verdict === 0) r.empty++; else r.unresolved++;
      }
      out.push(r);
    }
    return out;
  };
  // sound (notes/sound): the app side of the engine, for test/sound_cmd.js
  window.__cmwSound = (o) => { if (o && o.zp) { zpSet(o.zp[0], o.zp[1], o.zp[2], C(o.zp[3], o.zp[4])); return 1; } if (o && o.hAt) { const F = sndFAt(o.hAt[0]), w = F(C(o.hAt[1], o.hAt[2])); return [w.re, w.im]; } if (o && o.pick) { const r = paneL.ocanvas.getBoundingClientRect(), z = lLand() ? pickLand(o.pick[0] - r.left, o.pick[1] - r.top) : null; return z ? [z.re, z.im] : null; } if (o && o.perEval) snd.perEval = o.perEval; if (o && o.pathT) { const [T0, T1] = o.pathT; morph.T = T1; snd.T = T1; requestRender('R'); soundFunctionChanged({ at: (u) => sndFAt(T0 + u * (T1 - T0)) }); return 1; } if (o && o.listen) sndListen(o.listen, o.closed !== false); if (o && o.loop) sndLoopDone(o.loop); if (o && o.lastLoop) snd.lastLoop = { pts: o.lastLoop, closed: true }; return { hear: SND && SND.hear ? SND.hear.state() : null, glide: SND ? !!SND.state().glide : false, rope: snd.rope ? [snd.rope.x, snd.rope.y, snd.rope.src] : null, ptype: snd.ptype, listenFn: snd.play && snd.play.fn ? { counts: snd.play.h.counts || null, dur: snd.play.dur, mode: snd.play.h.mode || '' } : null, sing: SND ? SND.singState() : null, cv: { on: snd.cv.on, W: snd.cv.W, T: snd.cv.T }, sang: snd.sang, listenHarp: snd.play && snd.play.h.harp ? { up: snd.play.h.harp.up, down: snd.play.h.harp.down, notes: snd.play.h.harp.notes, dur: snd.play.dur, piece: !!snd.play.piece } : null, phi: snd.phi, near: snd.near, gestT: snd.gestT, loop: snd.loop ? { phi: snd.loop.phi, k: snd.loop.k } : null, lastLoop: !!snd.lastLoop, play: !!snd.play, auto: snd.auto, morphArm: snd.morphArm, kz: snd.kz, kbd: snd.kbd, kloop: snd.kloop ? snd.kloop.length : 0, perEval: snd.perEval, tracker: snd.tracker, live: ($('sndLive') || {}).textContent || '', run: snd.run ? { phi: snd.run.phi, k: snd.run.k, jumps: snd.run.jumps } : null, rest: snd.rest ? { z: [snd.rest.z.re, snd.rest.z.im], src: snd.rest.src } : null, T: snd.T, fcN: snd.fcN, fcGen: snd.fcGen,  g: snd.g ? [snd.g.re, snd.g.im] : null }; };
  // constructions (CORE): the graph's order, the forms, the last recompute, the events; o.call runs a cm call,
  // o.state(...) replaces S's shapes / targets / steps through the load path (sanitizeState), o.anchor sets the GPU anchor
  window.__cmwC = (o) => {
    if (o && o.call) { const a = cmApi(); const r = a[o.call](...(o.args || [])); return r === undefined ? null : JSON.parse(JSON.stringify(r, noRuntime)); }
    if (o && o.anchor) { GLR.setFormAnchor(o.anchor); requestRender('L', 'R'); return 1; }
    const g = Constr.graph(S), all = S.shapes.concat(S.targets);
    const cms = /** @type {any} */ (cmSync), last = cms.last ? { ids: cms.last.ids, kindChanged: cms.last.kindChanged, undefChanged: cms.last.undefChanged } : null;
    return { order: g.order, cyclic: g.cyclic, last, forms: Object.fromEntries(all.filter((s) => s._g).map((s) => [s.id, s._g])), atInf: all.filter((s) => s._atInf).map((s) => s.id), events: Construct.events.map((e) => e.type), freed: /** @type {any} */ (cmLoad).freed || 0, steps: S.steps.map((st) => ({ uid: st.uid, zpIds: st.zpIds || null })), stats: Constr.lastRecompute };
  };
  // constructions (INTERFACE): the ring, the draft, the session's Curve | Region; o.fill sets it
  window.__cmwCI = (o) => { if (o && o.gs) { const [side, P] = o.gs, gc = globeCam(side), q = gc && gScreen(gc, P), r = (side === 'R' ? paneR : paneL).ocanvas.getBoundingClientRect(); return q ? [r.left + q[0], r.top + q[1]] : null; } if (o && o.fill) Construct.fill = o.fill; if (o && o.snap) { const [side, x, y, opt] = o.snap; const t = Construct.snapAt(side, x, y, opt || {}); return t ? { cls: t.cls, z: t.z, ref: t.ref } : null; } if (o && o.names) return S.shapes.concat(S.targets).map((s) => ({ id: s.id, kind: s.kind, name: Construct.shapeLabel(s), def: Construct.defText(s), why: s.cundef ? Construct.reasonText(s.cundef) : null })); if (o && o.shapes) return { hi, n: hist.length, tool, selected, zeros: S.steps[0] ? S.steps[0].params.zeros : null, list: S.shapes.concat(S.targets).map((s) => Object.assign(JSON.parse(JSON.stringify(s, noRuntime)), { inf: !!s._atInf, A: s._g ? s._g.A : null })) }; return Construct.debug(); };
  // X's figure caption as text, or with 'listGen' its shapes' list in the genitive, the one a plane past the colour plane's
  // caption names ("the images of …")
  window.__cmwCapText = (part) => pcTidy(part === 'listGen' ? figCapParts().shapeListGen : figureCaption()).map((x) => (x.t != null ? x.t : x.m != null ? `$${x.m}$` : x.b || '')).join('');
  // (#846) the steps view's carried landscape in the last frame: {u, s (plane a), mu, box}, or null for a surface at
  // rest; box: the last frame's block, carried or not
  // the last Landscape frame's height-axis labels, as their screen y (CSS px)
  window.__cmwLandTicks = () => (render3D.ticks || []).slice();
  // the last Landscape frame's axis names (the plane's Re and Im, the height's), as boxes [x, y, w, h] in CSS px of the pane's canvas
  window.__cmwLandNames = () => (render3D.names || []).map((r) => r.slice());
  // the left key's kind and the caption it draws now (the key is drawn here, so a read never waits for a frame): the
  // caption's ink box in the key's px (capBox) and how much it is narrowed (capK, 1 for not at all; both null when the
  // caption is not drawn), the ring's −i label's box (labelBox, null with no ring or none drawn), and the carried key's
  // line: its lines, its room and its widest word in the font the key draws it in. Under the tall bar: the height the key
  // is drawn compact to (fitH, 0 for the full key), the carried key's compact lines, whether the caption is drawn
  // (capDrawn), the ring (geo), where its "1" ends (oneEnd), the strip's ink boxes (stripInk) and how much its word is
  // narrowed (wordK)
  const legendWidest = (side) => { const st = legendState[side], c = document.createElement('canvas').getContext('2d'); c.font = st.ui; return st.words ? Math.max(...st.words.map((w) => c.measureText(w).width)) : 0; };
  window.__cmwLegend = () => { drawLegend(); const st = legendState.L; return { kind: legendKind('L'), caption: st.caption || null, ring: st.ring, lines: st.lines || 0, room: st.room, widest: legendWidest('L'), capBox: st.capBox || null, capK: st.capK ?? null, labelBox: st.labelBox || null, fitH: st.fitH || 0, compactLines: st.fitH ? st.compactLines || null : null, capDrawn: !!st.capDrawn, geo: st.geo || null, oneEnd: st.oneEnd, stripInk: st.stripInk || null, wordK: st.wordK }; };
  // The camera of the steps view's Landscape (the source plane's view) and its mirror V.left: __cmwLandViews() answers { src, left } ({ cx, cy, s } each, a copy).
  // { zoom: f } runs the app's own zoom of the left plane (zoomPane, the wheel's), about its centre, so the steps view must be showing the plane (not the
  // Landscape); { leftScale } multiplies the mirror's s first (the control: the glide's box does not follow the mirror's history)
  window.__cmwLandViews = (o) => {
    if (o && o.leftScale) V.left.s *= o.leftScale;
    if (o && o.zoom) zoomPane(paneL, 'L', paneL.w / 2, paneL.h / 2, o.zoom);
    return { src: Object.assign({}, S.srcView), left: Object.assign({}, V.left) };
  };
  window.__cmwLandCarry = (box) => (box ? render3D.box || null : render3D.carried || null);
  // the seams svPatchSeam has measured (svLandPoleMemo.runs: a seam is measured again only for a new map or box, or a pole or
  // branch point that moved); with redraw, a frame of both panes is asked for first
  window.__cmwLandSeams = (redraw) => { if (redraw) requestRender('L', 'R'); return { runs: svLandPoleMemo.runs }; };
  // TEST-HOOK

  // TEST-HOOK (dropped from the published page by build.py)
  // (the test hooks go on: a block of their own, as t_publish caps a block's length)
  // the gap column of a far ring with its copies' strip (ring.dup, svDupTheta) of n x n vertices: the cells between it and
  // the next span the strip and are left out (LAND_CARRY_VS); -1 for a ring without one
  const landGapCol = (ring, n) => (ring && ring.dup ? GLR.dupGap(n) : -1);
  // whether the plane point (x, y) lies in the disc of one of the carry c's pole patches ([x, y, r0, r1], out to r1), which
  // that patch covers
  const inPoleDisc = (c, x, y) => (c.polar || []).slice(0, c.patches || 0).some(([qx, qy, , q1]) => Math.hypot(x - qx, y - qy) < q1);
  // the seamed pole patches' discs of the carry c, [x, y, r] each, whose box triangles that patch draws (LAND_CARRY_VS's uDisc)
  const landSeamDiscs = (c) => (c.polar || []).filter((p) => p.seam).slice(0, GLR.CARRY_DISCS).map((p) => [p[0], p[1], GLR.CARRY_DISC_IN * p[3]]);
  // the place step of an n x n grid with images P (x at 2v, y at 2v + 1; NaN where not finite) along the edge from (i, j) to
  // (i + di, j + dj), as LAND_CARRY_NRM_VS's stepOf: -1 when either end is off the grid or not finite
  const landStep = (n, P) => {
    const fin = (i, j) => i >= 0 && j >= 0 && i < n && j < n && Number.isFinite(P[2 * (j * n + i)]);
    return (i, j, di, dj) => (fin(i, j) && fin(i + di, j + dj) ? Math.hypot(P[2 * ((j + dj) * n + i + di)] - P[2 * (j * n + i)], P[2 * ((j + dj) * n + i + di) + 1] - P[2 * (j * n + i) + 1]) : -1);
  };
  // The jump bits of an n x n carried grid's vertices with images P (x at 2v, y at 2v + 1; NaN where not finite), as
  // LAND_CARRY_NRM_VS sets them: bit 1 for the edge v -> v + (1, 0), 2 for v -> v + (0, 1), 4 for v -> v + (1, 1), when
  // its step on the plane is over w and over J times the larger of the steps of the edges before it and after it along
  // the same line (of those that are finite; none: no jump); all 0 with J 0
  const landJumpBits = (n, P, J, w) => {
    const B = new Uint8Array(n * n);
    if (!(J > 0)) return B;
    const step = landStep(n, P);
    const jump = (i, j, di, dj) => { const s = step(i, j, di, dj), m = Math.max(step(i - di, j - dj, di, dj), step(i + di, j + dj, di, dj)); return m >= 0 && s > w && s > J * m; };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) B[j * n + i] = (jump(i, j, 1, 0) ? 1 : 0) | (jump(i, j, 0, 1) ? 2 : 0) | (jump(i, j, 1, 1) ? 4 : 0);
    return B;
  };
  // The triangles the last carried frame's draw keeps (LAND_CARRY_VS), on the CPU, grid by grid: the box ('box', cells x
  // cells vertices over src, less the triangles whose corners all lie in one seamed patch's disc, which that patch draws),
  // then as patches says (true: all; 'poles': no far ring; false: none) the pole patches ('pole' k) and the far rings
  // ('far' k, less the cells of the gap column of the ring's copies' strip, landGapCol), each n x n vertices
  // at svPatchZ, then the patches more ('more' k, [x, y, r0, r1], the same parametrisation, on the CPU only). A triangle is
  // kept when its corners' images under the carry's map F are finite and its edges are at most c.lim long; with step (the
  // heights' step limit, LAND_CARRY_VS's uStep: 0.3 H for Re F and Im F) and hgt (a plane point's drawn height), also when
  // its corners' heights are finite and span at most step; and, under the frame's jump rule (c.jump {J, w}), when none of
  // its edges crosses a jump (landJumpBits). visit(g, a, d, e) for each, with its corners' vertices a, d, e
  // (vertex v at grid place (v % n, floor(v / n))) and g {name, n, place, Z, P, Hv}: place (i, j) -> [x, y], fractional
  // places too; Z and P, the vertices' points and images (x at 2v, y at 2v + 1); Hv, their heights with hgt, or null
  const landKeptTris = (c, F, visit, { patches = /** @type {boolean | string} */ (true), more = [], step = Infinity, hgt = null } = {}) => {
    const lim2 = c.lim * c.lim;
    const grid = (name, n, place, discs = [], ring = null) => {
      const P = new Float64Array(2 * n * n), Z = new Float64Array(2 * n * n), Hv = hgt ? new Float64Array(n * n) : null;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const z = place(i, j), zc = C(z[0], z[1]), w = F(zc), v = j * n + i;
        Z[2 * v] = z[0]; Z[2 * v + 1] = z[1];
        if (CX.isFin(w)) { P[2 * v] = w.re; P[2 * v + 1] = w.im; } else P[2 * v] = P[2 * v + 1] = NaN;
        if (Hv) Hv[v] = hgt(zc);
      }
      const g = { name, n, place, Z, P, Hv }, B = landJumpBits(n, P, c.jump ? c.jump.J : 0, c.jump ? c.jump.w : Infinity);
      const keep = (a, d, e, jumps) => {
        if (jumps) return;
        const o = [2 * a, 2 * d, 2 * e];
        if (discs.some(([x, y, r]) => o.every((k) => Math.hypot(Z[k] - x, Z[k + 1] - y) < r))) return;
        if (!o.every((k) => Number.isFinite(P[k]))) return;
        for (let m = 0; m < 3; m++) { const k = o[m], q = o[(m + 1) % 3]; if ((P[k] - P[q]) ** 2 + (P[k + 1] - P[q + 1]) ** 2 > lim2) return; }
        if (Hv && step < Infinity) { const hs = [Hv[a], Hv[d], Hv[e]]; if (!hs.every(Number.isFinite) || Math.max(...hs) - Math.min(...hs) > step) return; }
        visit(g, a, d, e);
      };
      const gap = landGapCol(ring, n);
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        if (i === gap) continue;
        const v = j * n + i;
        keep(v, v + 1, v + n + 1, (B[v] & 5) | (B[v + 1] & 2));
        keep(v, v + n + 1, v + n, (B[v] & 6) | (B[v + n] & 1));
      }
    };
    const s = c.src, n = c.cells, discs = landSeamDiscs(c);
    grid('box', n, (i, j) => [s.x0 + (i / (n - 1)) * (s.x1 - s.x0), s.y0 + (j / (n - 1)) * (s.y1 - s.y0)], discs);
    const ring = (name) => (p, k) => { const m = p[4] || c.patchN || 96; grid(name + k, m, (i, j) => svPatchZ(p, i, j, m), [], p.dup ? p : null); };
    if (patches) (c.polar || []).slice(0, c.patches || 0).forEach(ring('pole'));
    if (patches && patches !== 'poles') (c.far || []).forEach(ring('far'));
    more.forEach(ring('more'));
  };
  // the last frame's carried landscape over its block, on the CPU: an nx x ny grid of points over the block, each covered
  // when it lies in the image of a triangle the draw keeps (landKeptTris, as patches and more say; the heights' step limit,
  // LAND_CARRY_VS's uStep, is left out: it drops cells only in Re F and Im F). where (x, y) -> boolean: the points counted
  // (all by default). {n, bare: the points no kept triangle covers, at: the first of them}, or null with no carry
  window.__cmwLandCover = (nx = 480, ny = 400, patches = /** @type {boolean | string} */ (true), more = [], where = null) => {
    const c = render3D.carried;
    if (!c || !c.map || c.sheets) return null;
    const b = c.box, cov = new Uint8Array(nx * ny);
    const kx = (nx - 1) / (b.x1 - b.x0), ky = (ny - 1) / (b.y1 - b.y0);
    landKeptTris(c, cpuMap(c.map), ({ P }, a, d, e) => {
      const ax = P[2 * a], ay = P[2 * a + 1], bx = P[2 * d], by = P[2 * d + 1], cx = P[2 * e], cy = P[2 * e + 1];
      const i0 = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - b.x0) * kx)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bx, cx) - b.x0) * kx));
      const j0 = Math.max(0, Math.ceil((Math.min(ay, by, cy) - b.y0) * ky)), j1 = Math.min(ny - 1, Math.floor((Math.max(ay, by, cy) - b.y0) * ky));
      const D = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (i0 > i1 || j0 > j1 || D === 0) return;
      const eps = -1e-9 * Math.abs(D);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = b.x0 + i / kx, y = b.y0 + j / ky;
        const u = ((bx - x) * (cy - y) - (cx - x) * (by - y)) * Math.sign(D), v = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) * Math.sign(D), w = ((ax - x) * (by - y) - (bx - x) * (ay - y)) * Math.sign(D);
        if (u >= eps && v >= eps && w >= eps) cov[j * nx + i] = 1;
      }
    }, { patches, more });
    let bare = 0, counted = 0;
    const at = [];
    for (let k = 0; k < nx * ny; k++) {
      const x = b.x0 + (k % nx) / kx, y = b.y0 + Math.floor(k / nx) / ky;
      if (where && !where(x, y)) continue;
      counted++;
      if (!cov[k]) { bare++; if (at.length < 8) at.push([+x.toFixed(3), +y.toFixed(3)]); }
    }
    return { n: counted, bare, at };
  };
  // the height error of the last carried Landscape frame's far patches, on the CPU: each cell of a far patch outside the pole patches'
  // discs ([x, y, r0, r1]; with skipPatches false, whole) whose centre's image lies in the block, its four corners' heights L = ln(1 + |h(z)|) (h: the carry's height map, plane s into the colour plane) averaged, the
  // chord's height at the cell, against L at its centre; {cells, bad: the cells whose chord is off by more than tol, worst, at:
  // the worst cell's centre and corners' mean and exact L, copies and copiesBad: the cells the outer ring leaves out to the box
  // and the inner ring, its gap column's, which span the strip of its copies (landGapCol), and those of them off by more
  // than tol, not in cells or bad}, per patch of c.far (of 'polar': per pole patch, each at its own resolution, none left
  // out), each at its grid's points (svPatchZ), or null with no carry. (It reads only the height, at a cell's centre: not
  // where the cell stands in the block, nor its error on the screen, which __cmwLandChordPx reads)
  window.__cmwLandFarErr = (tol = 0.25, skipPatches = true, of = 'far') => {
    const c = render3D.carried;
    if (!c || !c.map || c.sheets || !c.far) return null;
    const F = cpuMap(c.map), h = cpuMap(c.hmap), b = c.box, L = (z) => { const v = h(z); return CX.isFin(v) ? Math.log(1 + CX.abs(v)) : NaN; };
    return (of === 'polar' ? (c.polar || []).slice(0, c.patches || 0).map((q) => [...q, c.patchN]) : c.far).map((ring) => {
      const m = (ring[4] || c.patchN || 96) - 1, at = (i, j) => { const z = svPatchZ(ring, i, j, m + 1); return C(z[0], z[1]); };
      const gap = of === 'polar' ? -1 : landGapCol(ring, m + 1);
      const out = { cells: 0, bad: 0, worst: 0, at: null, copies: 0, copiesBad: 0 }, V = new Float64Array((m + 1) * (m + 1));
      for (let j = 0; j <= m; j++) for (let i = 0; i <= m; i++) V[j * (m + 1) + i] = L(at(i, j));
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
        const zc = at(i + 0.5, j + 0.5), w = F(zc);
        if (of === 'far' && skipPatches && inPoleDisc(c, zc.re, zc.im)) continue;
        if (!CX.isFin(w) || w.re < b.x0 || w.re > b.x1 || w.im < b.y0 || w.im > b.y1) continue;
        const a0 = V[j * (m + 1) + i], a1 = V[j * (m + 1) + i + 1], a2 = V[(j + 1) * (m + 1) + i], a3 = V[(j + 1) * (m + 1) + i + 1], Lc = L(zc);
        if (!Number.isFinite(a0 + a1 + a2 + a3 + Lc)) continue;
        const mean = (a0 + a1 + a2 + a3) / 4, e = Math.abs(mean - Lc);
        if (i === gap) { out.copies++; if (e > tol) out.copiesBad++; continue; }
        out.cells++;
        if (e > tol) out.bad++;
        if (e > out.worst) { out.worst = e; out.at = [+zc.re.toFixed(3), +zc.im.toFixed(3), +mean.toFixed(3), +Lc.toFixed(3)]; }
      }
      out.worst = +out.worst.toFixed(3);
      return out;
    });
  };
  // the last Landscape frame's Inside-regions mask at the point (x, y) of its plane: 0 to 1 (1: in the carried
  // region set), null outside its box or with no mask
  window.__cmwLandMask = (x, y) => landMaskAlpha(render3D.mask, x, y);
  // a Landscape frame's pane position (CSS px) of the place (x, y) of its box at height h: pk {box, info, w, h}
  const landWorldPx = (pk, x, y, h) => {
    const b = pk.box, [ax, ay] = pk.info.aspect;
    return project(pk, pk.info.MVP, [(2 * (x - b.x0) / (b.x1 - b.x0) - 1) * ax, (2 * (y - b.y0) / (b.y1 - b.y0) - 1) * ay, h]);
  };
  // the last Landscape frame's pane position (CSS px) of the surface point over (x, y) of its plane, null with no pick data
  // or no surface there
  window.__cmwLandSurfacePx = (x, y) => {
    const pk = render3D.pick;
    if (!pk || !pk.info) return null;
    const w = pk.F(C(x, y));
    return w ? landWorldPx(pk, x, y, pk.info.heightOf(landValue(w))) : null;
  };
  // The chord error of the last carried Landscape frame on the screen, on the CPU, per grid the draw keeps triangles of
  // (landKeptTris, with the draw's height step, c.step): each kept triangle whose centroid's image lies in the block is sampled
  // at its centroid and its three edges' midpoints, at the same fractional grid place (i, j); there the chord (its
  // corners' images and drawn heights, interpolated) and the exact surface point (F(z) at the height of h(z), z the
  // grid's point at that place) are each projected onto the pane (landWorldPx, the frame's floor camera). A triangle's
  // error is the largest distance between the two, in css px; placement and height, its parts: the exact point against
  // the chord's place at the exact height, and against the exact place at the chord's height. o {tol: px (3), where:
  // (x, y) -> boolean on the centroid's point of plane s, the triangles counted (all by default)}. Per grid name
  // ({box, pole k, far k}): {tris: the triangles counted, off: those over tol, worst: the largest error (px), at: its
  // centroid's image and point [w.re, w.im, z.re, z.im], place and height: the off triangles whose placement or height
  // part is over tol, inDisc: a far ring's kept triangles whose centroid lies in a pole patch's disc, which that patch
  // covers (not counted)}, or null with no carried frame
  window.__cmwLandChordPx = ({ tol = 3, where = null } = {}) => {
    const c = render3D.carried, f = render3D.floor;
    if (!c || !c.map || c.sheets || !f) return null;
    const F = cpuMap(c.map), h = cpuMap(c.hmap), info = f.info, b = c.box;
    const hgt = (z) => { const v = h(z); return CX.isFin(v) ? info.heightOf(landValue(v)) : NaN; };
    // (the draw's own height step for the frame, carryStep: none for ln |F| and |F|)
    const step = c.step != null && c.step < 1e30 ? c.step : Infinity;
    const px = (x, y, ht) => landWorldPx(f, x, y, ht), d = (p, q) => (p && q ? Math.hypot(p[0] - q[0], p[1] - q[1]) : 0);
    const out = {};
    const SAMPLES = [[1 / 3, 1 / 3, 1 / 3], [0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]];
    landKeptTris(c, F, ({ name, n, place, P, Hv }, ...vs) => {
      const r = out[name] || (out[name] = { tris: 0, off: 0, worst: 0, at: null, place: 0, height: 0, inDisc: 0 });
      const hs = vs.map((v) => Hv[v]);
      if (!hs.every(Number.isFinite)) return;
      const wx = (P[2 * vs[0]] + P[2 * vs[1]] + P[2 * vs[2]]) / 3, wy = (P[2 * vs[0] + 1] + P[2 * vs[1] + 1] + P[2 * vs[2] + 1]) / 3;
      if (wx < b.x0 || wx > b.x1 || wy < b.y0 || wy > b.y1) return;
      const ij = vs.map((v) => [v % n, Math.floor(v / n)]), zAt = (k) => place(...[0, 1].map((m) => k[0] * ij[0][m] + k[1] * ij[1][m] + k[2] * ij[2][m]));
      const zc = zAt(SAMPLES[0]);
      if (name.startsWith('far') && inPoleDisc(c, zc[0], zc[1])) { r.inDisc++; return; }
      if (where && !where(zc[0], zc[1])) return;
      let e = 0, ep = 0, eh = 0, atW = null;
      for (const k of SAMPLES) {
        const z = zAt(k), zz = C(z[0], z[1]), w = F(zz), hx = hgt(zz);
        if (!CX.isFin(w) || !Number.isFinite(hx)) continue;
        const cx = k[0] * P[2 * vs[0]] + k[1] * P[2 * vs[1]] + k[2] * P[2 * vs[2]], cy = k[0] * P[2 * vs[0] + 1] + k[1] * P[2 * vs[1] + 1] + k[2] * P[2 * vs[2] + 1];
        const ch = k[0] * hs[0] + k[1] * hs[1] + k[2] * hs[2], q = px(w.re, w.im, hx);
        e = Math.max(e, d(px(cx, cy, ch), q)); ep = Math.max(ep, d(px(cx, cy, hx), q)); eh = Math.max(eh, d(px(w.re, w.im, ch), q));
        if (!atW) atW = [w.re, w.im];
      }
      r.tris++;
      if (e > tol) { r.off++; if (ep > tol) r.place++; if (eh > tol) r.height++; }
      if (e > r.worst) { r.worst = e; r.at = [...(atW || [wx, wy]), ...zc].map((v) => +v.toFixed(3)); }
    }, { step, hgt });
    for (const r of Object.values(out)) r.worst = +r.worst.toFixed(1);
    return out;
  };
  // The jump rule of the last carried Landscape frame's grids (landJumpBits, LAND_CARRY_NRM_VS) against the carry's map, on the
  // CPU. An edge's ratio is its step on the plane over the larger of its neighbours' along the same line. The box's edges
  // within a seamed patch's disc, which that patch draws, are not read. An edge over the
  // rule's floor c.jump.w with a ratio over RATIO_SURE (or no finite neighbour) is put to an oracle: the map sampled at
  // ORACLE_K points along the edge in plane s, then the widest step between neighbours halved ORACLE_HALVE times; the
  // edge crosses a jump of the map when that step is still over the floor (a continuous map's steps shrink to nothing).
  // An edge with a smaller ratio is taken as continuous. Per grid name: {edges: those over the floor, jumps: of them the
  // oracle's, flagged: those the rule flags, missed: jumps it does not flag, extra: flags on continuous edges, maxCont:
  // the largest ratio of a continuous edge, minJump: the smallest of a jump, across: the kept triangles (landKeptTris,
  // with the rule) with an edge across a jump}, or null with no carried frame. g: the grids read (all by default)
  window.__cmwLandJumps = (g = null) => {
    const c = render3D.carried;
    if (!c || !c.map || c.sheets || !c.jump) return null;
    const F = cpuMap(c.map), w = c.jump.w, out = {}, RATIO_SURE = 1.5, ORACLE_K = 16, ORACLE_HALVE = 24;
    const discs = landSeamDiscs(c);
    const at = (x0, y0, x1, y1, t) => F(C(x0 + t * (x1 - x0), y0 + t * (y1 - y0)));
    const jumpy = (Z, a, b) => {
      const [x0, y0, x1, y1] = [Z[2 * a], Z[2 * a + 1], Z[2 * b], Z[2 * b + 1]], d = (p, q) => (CX.isFin(p) && CX.isFin(q) ? CX.abs(CX.sub(p, q)) : Infinity);
      let lo = 0, hi = 1 / ORACLE_K, best = -1;
      for (let k = 0; k < ORACLE_K; k++) { const e = d(at(x0, y0, x1, y1, k / ORACLE_K), at(x0, y0, x1, y1, (k + 1) / ORACLE_K)); if (e > best) { best = e; lo = k / ORACLE_K; hi = (k + 1) / ORACLE_K; } }
      for (let k = 0; k < ORACLE_HALVE; k++) {
        const m = (lo + hi) / 2, fl = at(x0, y0, x1, y1, lo), fm = at(x0, y0, x1, y1, m), fh = at(x0, y0, x1, y1, hi);
        if (d(fl, fm) >= d(fm, fh)) hi = m; else lo = m;
      }
      return d(at(x0, y0, x1, y1, lo), at(x0, y0, x1, y1, hi)) > w;
    };
    const memo = new Map();
    landKeptTris(c, F, ({ name, n, Z, P }, ...vs) => {
      if (g && !g.includes(name)) return;
      let r = out[name];
      if (!r) {
        r = out[name] = { edges: 0, jumps: 0, flagged: 0, missed: 0, extra: 0, maxCont: 0, minJump: Infinity, across: 0 };
        const B = landJumpBits(n, P, c.jump.J, w), J = new Set();
        const step = landStep(n, P);
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) for (const [di, dj, bit] of [[1, 0, 1], [0, 1, 2], [1, 1, 4]]) {
          const s = step(i, j, di, dj);
          if (!(s > w)) continue;
          const a0 = j * n + i, b0 = (j + dj) * n + i + di;
          if (name === 'box' && discs.some(([x, y, rr]) => [a0, b0].every((v) => Math.hypot(Z[2 * v] - x, Z[2 * v + 1] - y) < rr))) continue;
          const m = Math.max(step(i - di, j - dj, di, dj), step(i + di, j + dj, di, dj)), ratio = m > 0 ? s / m : Infinity;
          const a = j * n + i, b = (j + dj) * n + i + di, jmp = ratio > RATIO_SURE ? jumpy(Z, a, b) : false, fl = !!(B[a] & bit);
          r.edges++;
          if (jmp) { r.jumps++; J.add(a * 8 + bit); if (Number.isFinite(ratio)) r.minJump = Math.min(r.minJump, ratio); if (!fl) r.missed++; } else { if (Number.isFinite(ratio)) r.maxCont = Math.max(r.maxCont, ratio); if (fl) r.extra++; }
          if (fl) r.flagged++;
        }
        memo.set(name, J);
      }
      // (the triangle's edges as (vertex, bit): v -> v + (1, 0) bit 1, v -> v + (0, 1) bit 2, v -> v + (1, 1) bit 4)
      const J = memo.get(name), [v0, v1, v2] = vs, hf0 = v1 === v0 + 1;
      const es = hf0 ? [v0 * 8 + 1, v1 * 8 + 2, v0 * 8 + 4] : [v0 * 8 + 4, v2 * 8 + 1, v0 * 8 + 2];
      if (es.some((e) => J.has(e))) r.across++;
    }, {});
    for (const r of Object.values(out)) { r.maxCont = +r.maxCont.toFixed(2); r.minJump = Number.isFinite(r.minJump) ? +r.minJump.toFixed(2) : null; }
    return out;
  };
  // the value the last Landscape frame's height reads over the point (x, y) of its plane (the probe's: the image in the
  // colour plane of the point there, svLandPickF on a carried frame), [re, im], or null with no pick data or no surface there
  window.__cmwLandHeightAt = (x, y) => {
    const pk = render3D.pick, w = pk && pk.F ? pk.F(C(x, y)) : null;
    return w ? [w.re, w.im] : null;
  };
  // the last Landscape frame's pane position (CSS px) of the floor point under the place (x, y) of its box (the plane the
  // frame draws, carried or at rest), null when no frame is drawn
  window.__cmwLandFloorPx = (x, y) => {
    const f = render3D.floor;
    return f ? landWorldPx(f, x, y, f.info.floorZ) : null;
  };
  // whether the last Landscape frame drew its relief from the stand-in (landStandIn) while landTF and land link
  window.__cmwLandStandIn = () => !!(render3D.floor && render3D.floor.info.standIn);
  window.__cmwLandSheets = () => ({ drawn: render3D.sheetsInfo || null, shown: sheetsShown(), linear: !!render3D.linear, title: paneTitles().left, layers: render3D.layers ?? null, layerFrames: GLR.landLayerFrames() });
  window.__cmwCutCurves = () => carriedCuts.map((c) => Object.assign({}, c));   // (test/sv_cut_curve_cmd.js)
  window.__cmwCutMarks = () => { const r = paneL.ocanvas.getBoundingClientRect(); return cutMarksL.map((hd) => ({ step: hd.step, x: r.left + hd.x, y: r.top + hd.y })); };   // (the handles a frame between two planes draws, which take no input; test/steps_glide_cut_cmd.js)
  window.__cmwCutHandles = () => { const r = paneL.ocanvas.getBoundingClientRect(); return cutHandlesL.map((hd) => ({ step: hd.step, x: r.left + hd.x, y: r.top + hd.y, deg: hd.deg, w: hd.F ? hd.F(hd.q) : null, carried: !!(hd.F || hd.fwd), wz: hd.q ? { re: hd.q.re, im: hd.q.im } : null })); };   // (test/ux165_chain_cmd.js)
  // TEST-HOOK

  // TEST-HOOK (dropped from the published page by build.py)
  // (the test hooks go on: a second block, as t_publish caps a block's length)
  /** @type {any} */ (window).__cmwSvRingMade = (j) => { const P = svPlanes(); let made = 0, left = 0, unbuilt = 0; for (let k = 0; k + 1 < P.length; k++) { if (j != null && k !== j) continue; for (const { key } of svGlideRingKeys(k)) { const m = svRingSizes.get(key); if (m === undefined) left++; else { made++; if (m && m.polar && !svPolarRes.has(svPolarId(m))) unbuilt++; } } } return { made, left, unbuilt, glides: Math.max(0, P.length - 1), polar: svPolarRes.size, sizes: svRingSizes.size }; };   // (__cmwSvRingMade: the ring sizes of every glide of the chain (of glide j alone, given j), made or left, and the made polar ones whose mesh is not built, at the view the frames between planes draw in; the polar meshes kept and the sizes kept)
  /** @type {any} */ (window).__cmwSvRing = (builds) => (builds ? [...gpu].reduce((n, [id, r]) => n + (id.startsWith(SV_RING.id) ? r.builds || 0 : 0), svPolarBuilds) : svRingMemo && svRingMemo.ring ? { m: svRingMemo.ring.polar ? svRingMemo.ring.id : svRingMemo.m, c: svRingMemo.ring.c.slice(), r1: svRingMemo.ring.r1, r2: svRingMemo.ring.r2 } : null); Object.defineProperty(window, '__svCarryProbe', { configurable: true, get: () => GLR.carryProbes(), set: (f) => { const was = !!(GLR.carryProbes() || {}).powOnePhase; GLR.carryProbes(f || null); Funcs.setOnePhase(!!(f && f.powOnePhase)); if (was !== !!(f && f.powOnePhase)) { dropAllGPU(); rebuild(); if (f && f.powOnePhase) chainSig = chainSig.map((x) => x + '|powOnePhase'); } requestRender('L'); } }); /** @type {any} */ (window).__svCarryProbeSettings = { base: {}, cacheOnly: { noFill: true, noKCDraw: true }, noCarry: { noCarry: true }, powOnePhase: { powOnePhase: true } };   // (__cmwSvRing: the steps view's outer ring of carried points, Everywhere (svRingFor): {m (a polar ring's: its id), c, r1, r2} or null; builds: its meshes' builds in all, the polar ones' too. the carry probes, perf's svq units: __svCarryProbe = one of the settings' flags, or null; GLR.carryProbes; powOnePhase: powa's one-phase glide for a real exponent below 0 (Funcs.setOnePhase), the chain rebuilt, a control)
  /** @type {any} */ (window).__cmwSvKey = (b, t, whole) => { const P = t == null ? null : svPoleTracks(b, svSheetKey(b).win); if (P && whole) svPoleMake(P, Infinity, null); const k = t == null ? svSheetKey(b == null ? svStage() : b) : svSheetKeyAt(b, t); return { win: Object.assign({}, k.win), R: k.R, rs: k.rs, sing: (k.sing || []).map((p) => [p.re, p.im]), per: k.per ? [k.per.re, k.per.im] : null, tracks: P ? { k: P.k, of: SV_POLE_K + 1, seed: P.found ? P.found.j : null } : null, busy: svPoleBusy }; };   // (the steps view's sheet key for plane b (default: shown), as svSheetKey (per: its period, [re, im] or null); with t, the glide's (svSheetKeyAt), tracks {k, of, seed}: its pole tracks' next step of t (whole: made whole first) and the seed step a frame's search finished last; busy: the idle job runs)
  /** @type {any} */ (window).__cmwSvFixed = () => svFixDone(); /** @type {any} */ (window).__cmwSvWarm = () => ({ sig: svWarmSig, at: svWarmAt, now: chainSig[nSteps()] }); /** @type {any} */ (window).__cmwSvX = () => SV.g.x;   // (__cmwSvFixed: the carried colour has the tiling's fix-up under its parked map, true with none asked; __cmwSvWarm: svWarmCarry's chain its warm draw was last made for, and when; __cmwSvX: the thread's place alone, cheap enough for a per-frame poll)
  window.__cmwStageBox = () => paneBox(paneL, leftView());
  // the Line integral popover of shape id, opened as the palette's item opens it (the layout matrix's state; true when it opened)
  window.__cmwIntegrate = (id) => !!integrateShape(id);
  // the steps view's globe: whether its last frame drew the carried colour and by which path ('inverse' or 'mesh'),
  // and where the point (re, im) of the glide's plane a is at the glide's u (H_u of svBetween; the point itself at
  // rest); H: that map ({re, im} -> {re, im}, the identity at rest); eye and key: the last frame's camera position and
  // key light direction (drawSphere's, world coordinates); meshWin: the window of the sheet key the last carried mesh
  // was built with (svGlobeMesh), and clipWin, the tiling's; sheets: the sheet combos the last glide frame drew, the
  // principal one counted (null: no carried colour); cut: the path whose copies the last frame drew only where the
  // principal sheet is not opaque ('inverse' or 'mesh', SV.glideStencil), or null
  window.__cmwSvGlobe = (re, im) => {
    const g = svBetween(), z = C(re, im), w = g.H ? g.H(z) : z, si = leftSphereInfo;
    return { carried: !!(si && si.carried), path: (si && si.carryPath) || null, cut: (si && si.cut) || null, a: g.a, b: g.b, u: g.u, w: w && CX.isFin(w) ? [w.re, w.im] : null, H: g.H || ((q) => q), eye: si ? si.eye : null, key: si ? si.key : null, meshWin: svGlobeKeyRec ? Object.assign({}, svGlobeKeyRec.win) : null, clipWin: Object.assign({}, clipWin), sheets: svGlobeSheetsRec };
  };
  // the steps view's paths: Paths on, the deformation source (svPathsSource), the last frame's moving points (how many,
  // and how far in px the farthest is from H_T(z) of its start z; globeHeads: how many on a globe; globeEpoch: how many
  // times the globe's paths were chosen again for an orbit (mfGlobe.epoch); chosen: how many choices have landed;
  // keptZ: the kept starts z ([re, im]); globeError: what the globe's paths threw, or
  // null), the selection's size and whether it is this source's; ahead: how many
  // neighbouring segments' re-traces are made ahead for the selection (none while that job runs)
  const svPathsHook = () => {
    const src = svPathsSource(), d = mfDrawn;
    let err = 0;
    // (in the plane's own view, the one the paths are drawn in; the pane's view is put back as it was)
    if (src && d) {
      const v0 = paneL.view;
      paneL.setView(S.srcView);
      try {
        for (const q of d.heads) err = Math.max(err, mDist(paneL.w2s(src.Fat(d.T)(C(q[2], q[3]))), q));
      } finally { paneL.setView(v0); }
    }
    const src1 = src ? { T: src.T, Tend: src.Tend, startId: src.startId, seq: src.seq } : null;
    const ready = !!(src && mfCache.sel && mfCache.key === mfScreenKey(paneL, src).key);
    const kept = mfCache.sel ? mfCache.sel.kept.length : 0;
    const heads = d ? d.heads.length : 0;
    const globeHeads = mfGlobeDrawn ? mfGlobeDrawn.heads : 0, globeError = (mfGlobeDrawn && mfGlobeDrawn.error) || null;
    return { on: S.morphPaths !== false, src: src1, T: d ? d.T : null, heads, globeHeads, globeEpoch: mfGlobe.epoch, chosen: mfCache.chosen || 0, keptZ: mfCache.sel ? mfCache.sel.kept.map((k) => [k.sp.z.re, k.sp.z.im]) : null, globeError, err, kept, ready, ahead: mfAhead.sel === mfCache.sel && !mfAhead.job ? mfAhead.done.size : 0 };
  };
  // the steps view's paths figure without the typesetting: the paths chosen for the shown plane's step at a figure's size,
  // and how far their ends are from the planes' images of their starts (the previous plane's, and the shown one's); keepIm:
  // only the paths starting below that imaginary part are kept and named
  /** @type {any} */ (window).__cmwSvPaths = async (keepIm) => {
    const f = svPathsFig();
    if (!f || f.i == null) return f;
    const P = svPlanes(), box = f.surf === 'sphere' ? srcWindowBox() : paneBox(paneL, leftView()), w = 600, h = w * (box.y1 - box.y0) / (box.x1 - box.x0);
    const r = await figMorphPaths({ src: f.src, z: f.z, end: f.end, box, w, h, lang: 'en', keep: keepIm == null ? undefined : (z) => z.im < keepIm });
    if (!r) return null;
    const F0 = rangeF(0, P[f.i - 1]), F1 = rangeF(0, P[f.i]), Fa = f.Fat(0), Fb = f.Fat(1);
    let e0 = 0, e1 = 0;
    for (const k of r.kept) {
      const z = C(k.z[0], k.z[1]), d = (a, b) => Math.hypot(a.re - b.re, a.im - b.im) / Math.max(1, Math.hypot(b.re, b.im));
      e0 = Math.max(e0, d(Fa(z), F0(z))); e1 = Math.max(e1, d(Fb(z), F1(z)));
    }
    return { i: f.i, n: r.kept.length, ims: r.kept.map((k) => k.z[1]).sort((a, b) => a - b), e0, e1, sentence: r.sentenceTex, caption: r.captionTex };
  };
  // the phase palette as its menu sets it (setPalette: the legend and both panes drawn again), or just read; -> the palette's id
  /** @type {any} */ (window).__cmwPalette = (id) => { if (id != null) setPalette(id); return GLR.palette(); };
  // the render-ahead frames (#1339) against the screen: frame k drawn ahead, and the left pane drawn live now as the screen
  // draws the motion's frame j (renderLeft in svAheadVisit, with no frame drawn ahead to show, its labels placed at once), its
  // pixels compared -> { n: bytes compared, diff: bytes that differ, first: the first one's index, rec: the live frame's glide
  // record }, or null without frame k
  /** @type {any} */ (window).__cmwAhead = (k, j = k) => {
    const R = svAhead;
    if (!R || !R.slots[k]) return null;
    const W = paneL.pw, H = paneL.ph, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const cx = c.getContext('2d');
    cx.drawImage(R.slots[k].bm, 0, 0);
    const A = cx.getImageData(0, 0, W, H).data;
    const live = svAheadVisit(R.M, j, R.xs[j], () => {
      svAhead = null;
      try {
        renderLeft();
        if (paneL.labels) flushLabels(paneL, paneL.labels);
        return { px: paneL.ctx.getImageData(0, 0, W, H).data, rec: svGlideRec && { path: svGlideRec.path, b: svGlideRec.b, u: svGlideRec.u } };
      } finally { svAhead = R; }
    });
    requestRender('L');
    const B = live.px;
    let diff = 0, first = -1;
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) { if (first < 0) first = i; diff++; }
    return { n: A.length === B.length ? A.length : 0, diff, first, rec: live.rec };
  };
  // the steps view: where it is, what it shows; o moves it (go, park, x: the thread's place without the snap to a plane, T,
  // scope, surf, play, loop, order, span, range; bare: the colour layer alone; clock: ms of glide time a frame, 0 the wall
  // clock; holdJobs: true (the idle jobs of svReady) or a list of its part names count as unfinished; holdWarm: its warm draw does; warmInv: false stops the warm-up of the glides at rest
  // (svPrestartInv; true back on); gate: false switches the Play gate off (true back on); play: false
  // ends a wait of the gate too; moving counts a wait; poleFrameMs: a frame's pole search budget; dropTracks: every pole track forgotten; glideSheets: 1 draws a glide's chain as it is alone,
  // without the other sheets' copies (SV.glideSheets); glideOrder: 'painter' draws a glide's copies in painter's order,
  // anything else front to back (SV.glideSat); glideStencil: 1 draws the sphere's copies only where the
  // principal sheet is not opaque (SV.glideStencil); glideSeams: 0 draws a Landscape glide's copies without their
  // seams (SV.glideSeams, svGlideSeams); glideFade: the copies' alpha, fixed over the glide (SV.glideFade; null:
  // the fade over u); restPaint: 0 leaves out the arrival plane's picture under a glide's carried colour (SV.restPaint);
  // plotsKeep: 0 draws a glide frame's plots under its carried colour every frame, never from the kept layer
  // (SV.plotsKeep); plots (read): the frames that drew them and that drew them back, and whether a layer is kept
  // (svPlotsUse);
  // landBranches: 0 draws the carried Landscape without its patches about the map's branch points (SV.landBranches,
  // svLandPatches); ahead: { ms, waitMs, cap, cost }, the render-ahead frames' cost at most which a motion plays live, their
  // longest wait and their memory budget in bytes, each null for the app's own, and the chain's frame cost, set once); glide: the last glide frame's record
  // (svGlideRec), ahead: the render-ahead frames' state (svAheadHook), aheadCost: the chain's frame cost (its probe's, raised by a fill)
  // (svAheadCostNow), aheadProbe: how its last probe went (svAheadProbeLog), aheadPlan: svAheadPlan's decision for the chain's glides at each speed with its inputs (svAheadPlanHook), the four read only when asked (getters: the
  // chain's key, svAheadKey, is long to make, and a suite may read the glide once a pixel), hold: the plane whose glide waits for its pole
  // tracks (svHoldB), rest: the last plane at rest's (svRestRec);
  // playRec: a play's schedule ({ from, to, ms, t0, el: its time since it started from from, at t0 }), null without a play or for a
  // slide; rebased: the schedule the last new speed set (svPlayRebase), with rebaseMinSpan, the least span it is timed over;
  // invWarm: the glides of the plane shown made ready at rest (svPrestartInv's jobs for it done); invGlides: those glides
  // ([b, u] each part, svInvGlides), whose inverse programs svReady counts; fits: the head's fits so
  // far that ran past their key (SV.fits); ready (svReady, peeked) and invGlides are read only when asked too (getters:
  // svReady's inverse part asks each glide's programs, and a suite may read the glide once a pixel)
  // the Play gate's 10 s message for a part (null: no part named), and the part it would name now
  /** @type {any} */ (window).__cmwGateStill = (part) => svGateStill(part);
  /** @type {any} */ (window).__cmwGateMissing = () => svGateMissing();
  // (x moves the thread's position and nothing else: SV.i stays, so a frame held between planes is drawn with the source view while the labels
  // read the plane's own view, V.left. To read the labels against the picture freeze a glide with clock, as steps_glide_labels does)
  /** @type {any} */ (window).__cmwSteps = (o) => { if (o && o.go != null) svGo(o.go, !!o.now); if (o && 'poleFrameMs' in o) SV.poleFrameMs = o.poleFrameMs; if (o && o.dropTracks) svDropTracks(); if (o && o.x != null) { SV.g.set(o.x); requestRender('L'); } if (o && 'bare' in o) { SV.bare = !!o.bare; requestRender('L'); } if (o && 'glideSheets' in o) { SV.glideSheets = o.glideSheets; requestRender('L'); } if (o && 'glideOrder' in o) { SV.glideSat = o.glideOrder === 'painter' ? 0 : 1; requestRender('L'); } if (o && 'glideStencil' in o) { SV.glideStencil = o.glideStencil; requestRender('L'); } if (o && 'restPaint' in o) { SV.restPaint = o.restPaint; requestRender('L'); } if (o && 'plotsKeep' in o) { SV.plotsKeep = o.plotsKeep; requestRender('L'); } if (o && 'glideSeams' in o) { SV.glideSeams = o.glideSeams; requestRender('L'); } if (o && 'landBranches' in o) { SV.landBranches = o.landBranches; requestRender('L'); } if (o && 'glideFade' in o) { SV.glideFade = o.glideFade; requestRender('L'); } if (o && 'tieBand' in o) { svTieBandSet = o.tieBand; requestRender('L'); } if (o && 'clock' in o) SV.clock = o.clock > 0 ? +o.clock : null; if (o && o.park != null) { SV.g.set(o.park); svLetGo(); } if (o && o.T != null) svSetT(o.T); if (o && o.scope) { SV.scope = o.scope; svPrestartSoon(300); svSync(); requestRender('L'); } if (o && o.surf) { SV.surf = o.surf; svPrestartSoon(300); svApply(); } if (o && 'holdJobs' in o) svJobsHoldSet(o.holdJobs); if (o && 'holdWarm' in o) svWarmHoldSet(o.holdWarm); if (o && 'warmInv' in o) svInvWarmOffSet(!o.warmInv); if (o && 'ahead' in o) svAheadTune(o.ahead); if (o && 'gate' in o) svGateOffSet(!o.gate); if (o && o.play != null) { if (o.play) svPlay(); else { svGateEnd(); svPause(true); } } if (o && 'loop' in o) svSetLoop(!!o.loop); if (o && o.order) svSetOrder(o.order); if (o && 'span' in o) SV.span = o.span && svAllOk(o.span[0], o.span[1]) ? { x0: o.span[0], x1: o.span[1] } : null; if (o && 'range' in o) { if (o.range) svSetRange(o.range[0], o.range[1], false); else svClearRange(); } return { get ready() { return svReady(null, true); }, on: SV.on, plots: { drawn: svPlotsUse.drawn, kept: svPlotsUse.kept, held: svPlotsKey !== null }, svSpeed: S.sv ? S.sv.speed : null, homRange: S.homRange ? [S.homRange.a, S.homRange.b] : null, play: !SV.play ? null : SV.play.slide ? 'slide' : 'glide', playRec: SV.play && !SV.play.slide ? { from: SV.play.from, to: SV.play.to, ms: SV.play.ms, t0: SV.play.t0, el: svElapsed(SV.play) } : null, rebased: SV.rebased || null, rebaseMinSpan: SV_REBASE_MIN_SPAN, loop: SV.loop, range: svRange(), i: SV.i, x: SV.g.x, sel: S.sel, all: svBetween().all, between: svBetween().map, span: SV.span ? { x0: SV.span.x0, x1: SV.span.x1, stepT: SV.span.stepT || null } : null, restored: SV.restored || null, fits: SV.fits, homAll: !!S.homAll, moving: svMoving() || svGateWaiting(), speed: SV.speed, anim: SV.anim, T: svT(), scope: SV.scope, surf: SV.surf, adopted: !SV.on || SV.sig === svSigNow(), planes: svPlanes(), stage: leftStage(), main: S.view.main, paint: SV.on ? svPaint() : null, core: SV.core, lColor: lColor(), solo: solo(), focus: S.focus, map: focusMap(), label: svLabel(), names: { title: svTitleParts(), call: svMapCall('text'), key: svKeyName() }, note: paneL.noteBox || null, paths: svPathsHook(), glide: svGlideRec, get ahead() { return svAheadHook(); }, get aheadCost() { return svAheadCostNow(); }, get aheadPlan() { return svAheadPlanHook(); }, get aheadProbe() { return svAheadProbeHook(); }, hold: svHoldB, rest: svRestRec, tieBand: svTieBand(), carryPre: svCarryPre, resolved: GLR.carryResolveFrames ? GLR.carryResolveFrames() : 0, invWarm: svInvWarmKey === svInvKey() && !svInvJobs.length && !svInvFlushing, get invGlides() { return svInvGlides().map((g) => [g.b, g.u]); }, restU: SV_REST_U, restUMin: SV_REST_U_MIN, win: (() => { const v = leftView(); return [v.cx, v.cy, v.s]; })() }; };
  // the description, ring and state a waiting control takes for a gauge of v (a share, or null: unknown), or for gauges
  // vs one after another ([v0, v1, ...], one look each), on a button apart from the page (svWaitLook): the wait's words
  // for a screen reader at any gauge, the unknown one included -> the last look's { desc, fill, wait }
  /** @type {any} */ (window).__cmwWaitSay = (v) => { const b = document.createElement('button'), vs = Array.isArray(v) ? v : [v], w = { btn: b, gauge: () => vs[0], fill: 0 }; for (const x of vs) { w.gauge = () => x; svWaitLook(w); } return { desc: b.getAttribute('aria-description'), fill: +b.style.getPropertyValue('--wait'), wait: b.dataset.wait }; };
  // (#363) the regions' display: their fill (always the phase for the user), grid lines, their step, chevrons, opacity
  // the loaded settings and ids, read back plain (a getter: the suites that load a saved state with a key left out or set oddly read what the load made of it)
  /** @type {any} */ (window).__cmwKeys = () => ({ alpha: S.alpha, meshN: S.meshN, nextId: S.nextId, shapeIds: S.shapes.map((s) => s.id), targetIds: S.targets.map((t) => t.id), shapeCi: S.shapes.map((s) => s.ci), shapeColor: S.shapes.map((s) => s.color || null), v3: !!S.v3, v4: !!S.v4, v5: !!S.v5, v6: !!S.v6, focus: S.focus });
  window.__cmwRegions = () => ({ pattern: S.pattern, lines: !!S.lines, patternScale: S.patternScale, chev: !!S.chev, alpha: S.alpha });
  window.__cmwState = () => ({ cam: { yaw: cam.yaw, pitch: cam.pitch, d: cam.dist / CAM3.dist, tx: cam.tx, ty: cam.ty }, camL: { yaw: camL.yaw, pitch: camL.pitch, d: camL.dist / CAML.dist, tx: camL.tx, ty: camL.ty }, mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), dc: S.dc, landPlain: !!S.landPlain, wKey: !!S.wKey, focus: S.focus, morph: { open: morph.open, T: morph.T, playing: morph.playing }, targets: S.targets.length, hov: hov.list ? hov.list.map((r) => [r.z.re, r.z.im, r.mult]) : null, intPop: intPop ? intPop.id : null, sheets: S.sheets, height: S.height, meshN: S.meshN, homView: homView() }); // TEST-HOOK

  // TEST-HOOK (dropped from the published page by build.py)
  // A probe of the members the steps view's NEWT roots pass computes (GLR.newtRoots). __cmwNewtProbe() puts it on: each
  // pass then keeps its frame's st. __cmwNewtProbe(pts) draws a pass of that st again with a main that writes member 0 of
  // the NEWT op as the op's _roots lists it (its k[0], r[0]: the program the page compiles, with the page's chain data),
  // reads that target back and gives, for each [fx, fy] (fractions of the pass's width and height from the left and
  // bottom), the pixel's w, the GPU's member 0 there and the CPU's, Inverse's op.pre(w) member 0 of the plan's NEWT op:
  // [{w, gpu: [re, im] | null, cpu: [re, im] | null, t}]; null while its program compiles, [] before a pass was seen. The
  // extra pass is keyed apart from the page's own, so a frame's pass never takes it for the previous frame's
  {
    let last = null, on = false;
    const NONE_MIN = 1e37;
    /** @type {any} */ (window).__cmwNewtProbe = (pts) => {
      const gl = GLR.gl;
      if (!on) {
        on = true;
        const orig = GLR.newtRoots;
        GLR.newtRoots = function (st) { const r = orig.apply(this, arguments); if (r && r.state === 'drawn' && !st.probe) last = { st, orig }; return r; };
      }
      if (!pts) return null;
      if (!last) return [];
      const { st, orig } = last, nr = st.inv.nr, c = +/uInv\[(\d+)\]\.x/.exec(nr.main)[1], P = `ix${nr.j}`;
      const main = `
void main() {
  vec2 f = gl_FragCoord.xy - uVp.xy - 0.5 * uVp.zw;
  vec2 w = uCenter + (f * uInvScale + uCenterLo);
  ixPixW = w; ixNrTexel = ivec2(gl_FragCoord.xy - uVp.xy);
  ${P}_roots(w, uInv[${c}].x);
  o = vec4(${P}_k[0] ? ${P}_r[0] : vec2(3.0e38), 0.0, 0.0);
}
`;
      const W = Math.round(st.pw), H = Math.round(st.ph), draw = gl.drawArrays;
      let buf = null;
      gl.drawArrays = function (...a) { draw.apply(this, a); gl.readBuffer(gl.COLOR_ATTACHMENT0); buf = new Float32Array(4 * W * H); gl.readPixels(0, 0, W, H, gl.RGBA, gl.FLOAT, buf); };
      let r;
      try { r = orig.call(GLR, Object.assign({}, st, { probe: true, inv: Object.assign({}, st.inv, { key: st.inv.key + '|probe', nr: { j: nr.j, targets: 1, main } }) })); } finally { gl.drawArrays = draw; }
      if (r.state === 'pending') return null;
      if (r.state !== 'drawn' || !buf) return [];
      const v = st.view, k = 1 / (v.s * st.dpr), op = st.plan.ops.find((o) => o.kind === 'NEWT');
      return pts.map(([fx, fy]) => {
        const i = Math.min(W - 1, Math.floor(fx * W)), j = Math.min(H - 1, Math.floor(fy * H)), q = 4 * (j * W + i);
        const w = { re: v.cx + (i + 0.5 - W / 2) * k, im: v.cy + (j + 0.5 - H / 2) * k };
        const m0 = op && op.pre(w).find((m) => m.m === 0);
        return { w: [w.re, w.im], gpu: Math.abs(buf[q]) < NONE_MIN ? [buf[q], buf[q + 1]] : null, cpu: m0 ? [m0.u.re, m0.u.im] : null, t: st.t };
      });
    };
  }
  // TEST-HOOK

  // TEST-HOOK (dropped from the published page by build.py): the hooks before the app has started. They are set as the
  // bundle runs, but the page state S stays null until init(), which waits for DOMContentLoaded; a suite polls them right
  // after a load. While S is null each answers not-ready instead of reading it: __cmwSteps() { ready: { ready: false } },
  // the others null. Every __cmw* hook set by now is wrapped here: this file's and the files' before it, which the bundle
  // has run by now
  {
    const W = /** @type {any} */ (window), notReady = { __cmwSteps: () => ({ ready: { ready: false } }) };
    for (const k of Object.keys(W)) {
      const f = W[k];
      if (!k.startsWith('__cmw') || typeof f !== 'function') continue;
      W[k] = Object.assign(function (...a) { return S ? f.apply(this, a) : notReady[k] ? notReady[k]() : null; }, f);
    }
  }
  // TEST-HOOK
