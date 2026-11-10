  // the zeros and poles of the step acting on X: handles in page coordinates, the selection, the step's parameters
  window.__cmwZp = () => { const r = paneL.ocanvas.getBoundingClientRect(), zs = zpStep(); return { k: zs ? zs.k : 0, sel: zpSel, params: zs ? Object.assign({}, zs.st.params) : null, handles: zpHandlesL.map((q) => ({ kind: q.kind, i: q.i, x: r.left + q.x, y: r.top + q.y })), pane: { left: r.left, top: r.top, w: paneL.w, h: paneL.h }, glKey: (() => { try { return String(GLChain.build(S.steps, built).key).length + ':' + String(GLChain.build(S.steps, built).key).slice(-80); } catch (e) { return null; } })() }; };
  window.__cmwTime = (n = 5) => {
    const t = (f, pane) => { f(); pane.ctx.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < n; i++) { f(); pane.ctx.getImageData(0, 0, 1, 1); } return +((performance.now() - t0) / n).toFixed(2); };
    // (a merged view shows one pane: the hidden one is not timed)
    const one = solo();
    return { left: one === 'R' ? null : t(renderLeft, paneL), right: one === 'L' ? null : t(renderRight, paneR), overlay: t(() => renderOverlays(), paneL), mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), meshN: S.meshN };
  };
  window.__cmwInfo = () => [...gpu.entries()].map(([id, r]) => ({ id, tris: r.meshRes && r.meshRes.n, segs: r.lineRes && r.lineRes.n, fixR: r.fix.R && r.fix.R.extraRes && r.fix.R.extraRes.n, fixL: r.fix.L && r.fix.L.extraRes && r.fix.L.extraRes.n, hold: !!r.hold, live: !!r.live, liveStat: r.liveStat, pool: r.lpool ? r.lpool.size : 0, base: r.meshKey ? +String(r.meshKey).split('|')[1] : null, buildMs: r.buildMs }));
  // per area shape and role: is a hold drawn, and do its strokes belong to another geometry than its fill (U-a review)
  window.__cmwHoldCheck = () => S.shapes.filter((s) => kindType(s) === 'area' && gpu.get(s.id)).flatMap((s) => ['L', 'R'].map((role) => {
    const r = gpu.get(s.id), pm = pairFor(s, r, role).p, L = linesOf(r, pm);
    const held = pm !== r;
    return { id: s.id, role, held, mismatch: held && pm.skey !== r.skey && L === r };
  }));
  window.__cmwFigureState = () => figureState();   // what a link or a scene file carries
  window.__cmwSet = (k, v) => {
    // the view fields of earlier builds (the suites set rightMode in many scenes): applied through the migration table,
    // on top of the old fields that name the current view (panels.md 10)
    if (Views.LEGACY.includes(k)) {
      const o = Object.assign(Views.toLegacy(S.view, S.dc, S.landPlain), { [k]: v, dc: S.dc });
      Views.migrate(o);
      setOpt('view', o.view); setOpt('dc', o.dc); setOpt('landPlain', !!o.landPlain);
      applyLayout(); viewChanged('L'); viewChanged('R');
      return;
    }
    if (k === 'view') { setOpt('view', Views.clean(v)); applyLayout(); viewChanged('L'); viewChanged('R'); return; }
    S[k] = v; if (k === 'meshN') { dropAllGPU(); } if (k === 'exactImages') scheduleFix(); requestRender('L', 'R');
  };
  // U-b: the panes' views; setView(side, surf) and setPhase(on) as the controls and keys call them
  window.__cmwView = () => Views.clean(S.view);
  // (U-b's calls: X's surface 'land' is the Landscape view now; Plane or Sphere on X from the Landscape opens X → Y)
  window.__cmwSetView = (side, surf) => { if (side === 'L' && surf === 'land') return setMain('land'); if (side === 'L' && lLand()) setMain('xy'); return setView(side, surf); };
  window.__cmwSetPhase = (on) => setPhase(on);
  // merged views (merged-views.md): the top bar's view ('xy' | 'phase' | 'land') and the layout the panes are in
  window.__cmwSetMain = (m) => setMain(m);
  // a shape's own colour as its curve is drawn (its ink's edge), as a hex string
  /** @type {any} */ (window).__cmwInk = (id) => { const s = S.shapes.find((x) => x.id === id); return s ? shapeInk(s).edge : null; };
  // (walls tests, #168 review) a step's parameter set as its field sets it (live, chainChanged(false)): a log's cut
  /** @type {any} */ (window).__cmwToast = (msg, label, o) => toast(msg, label, () => {}, false, o);   // (a message with an optional action that does nothing)
  /** @type {any} */ (window).__cmwAddStep = (type, params, at) => { addStep(type, params, at); return S.steps.length; };   // (a step added as the palette adds it (at: addStep's): its toast "Added f₃ …  Show alone  Undo" shows; answers how many steps there are)
  /** @type {any} */ (window).__cmwStepParam = (k, key, v) => { const st = S.steps[k]; if (!st) return false; st.params[key] = v; chainChanged(false); return true; };
  // the label pass's count and time, and what the last pass of the left plane placed
  /** @type {any} */ (window).__cmwLabelStats = { n: 0, ms: 0 };
  setLabelProbe((ms, curves) => { const s = /** @type {any} */ (window).__cmwLabelStats; s.n++; s.ms += ms; (s.list = s.list || []).push({ ms: +ms.toFixed(2), curves }); });
  /** @type {any} */ (window).__cmwLabelsPlaced = () => (paneL.labelsPlaced || []).map((q) => ({ text: q.text, x: Math.round(q.x0 * 10) / 10, y: Math.round(q.y0 * 10) / 10 }));
  window.__cmwLayout = () => { const mg = Views.merged(S.view, morphOn()), one = solo(); return { main: S.view.main, deform: !!morph.open, merged: mg, shown: one ? [one] : ['L', 'R'], wL: paneL.w, wR: paneR.w }; };
  // which pane ('L' | 'R') shows the picture an earlier build's rightMode named (the perf suite drags that pane)
  window.__cmwPaneOf = (mode, sphereMode) => Views.paneOf(mode, sphereMode);
  // the old layout's other pane for that picture (the shapes plane beside an old Phase or Landscape view): null when
  // the view is one merged panel here (the perf suite then measures X's plane in X → Y, the same picture)
  window.__cmwOtherPane = (mode, sphereMode) => (Views.merged(S.view, morphOn()) ? null : Views.paneOf(mode, sphereMode) === 'L' ? 'R' : 'L');
  // exact images (SPEC 10.1): the path of every visible area shape in every visible view: [{id, role, viewKind, path, reason}]
  window.__cmwSphere = () => ({ entries: [...sm.entries.values()].map((e) => ({ key: e.key, slot: e.slot, why: e.why, view: e.view, guardBox: e.guardBox, gpu: !!(e.res && e.res.n), ...e.info })), jobs: [...sm.jobs.values()].map((j) => ({ key: j.key, slot: j.slot, why: j.why, ms: +j.ms.toFixed(1), slices: j.slices, nodes: j.mesh ? j.mesh.nodes : 0 })), want: [...sm.want.entries()], running: sm.running, stats: Object.assign({}, sm.stats), cpuBytes: sm.cpuBytes, preBytes: GLR.preBytes, lastExport: sm.lastExport || null });
  // the SphereMesh verdict (SPEC 8.1) of every visible area shape for the right pane's map (12.3: invariant under right-view zooms)
  window.__cmwSmVerdict = (role = 'R') => S.shapes.filter((s) => s.visible !== false && kindType(s) === 'area').map((s) => ({ id: s.id, why: smNeed(s, gpu.get(s.id), role, normalizeMap(stageMap(role === 'SV' ? svStage() : role === 'R' ? rightStage() : leftStage()))) }));
  window.__cmwSmReset = () => { for (const e of [...sm.entries.values()]) smDrop(e); for (const j of [...sm.jobs.values()]) smCancel(j); sm.want.clear(); Object.assign(sm.stats, { built: 0, ms: 0, slices: 0, maxSlice: 0, cancelled: 0, partial: 0 }); requestRender('L', 'R'); return true; };
  // (issue #72) a screen pane's own last GPU frame (glStatusNote): {pending, compiling, error, exact, t}, null before one
  window.__cmwPaneStatus = (role = 'R') => (paneGl[role] ? Object.assign({}, paneGl[role]) : null);
  window.__cmwPaths = () => {
    const views = [], out = [];
    if (SV.on) views.push(['L', SV.surf === 'sphere' ? 'globe' : 'flat', stageMap(leftStage())]);   // (the steps view has one plane, the shown one: role L, a globe on the Sphere surface)
    else if (solo() !== 'L') {
      if (rImage()) views.push(['R', 'flat', trans.k ? transState().map : morphOn() ? morphState(false).map : stageMap(rightStage())]);
      else { const hv = homView(); views.push(['R', 'globe', hv ? (hv.imageMap || hv.map) : stageMap(rightStage())]); }
    }
    // (X draws the shapes' areas in its plane and on its globe; the portrait, the phase globe and the landscape outline them)
    if (!SV.on && solo() !== 'R' && (lPlain() || (lGlobe() && !lPhase()))) views.push(['L', lGlobe() ? 'globe' : 'flat', stageMap(leftStage())]);
    // (the steps view draws its regions solid, at full opacity: the program it needs is that one's)
    (SV.on ? withSolidRegions : (f) => f())(() => { for (const [role, viewKind, map] of views) for (const s of S.shapes) {
      if (s.visible === false || kindType(s) !== 'area') continue;
      const p = pathOf(s, map, role, viewKind, { status: true }); out.push({ id: s.id, role, viewKind, path: p.path, reason: p.reason || null });
    } });
    return out;
  };
  // shape ids that draw forward whatever their eligibility (mixed-path tests); [] clears
  window.__cmwHideStrokes = (on) => { hideStrokes = !!on; requestRender('L', 'R'); return hideStrokes; };
  window.__cmwForceForward = (ids) => { forceFwd.clear(); for (const id of ids || []) forceFwd.add(id); scheduleFix(); requestRender('L', 'R'); return [...forceFwd]; };
  // the plane point w under a Sphere-view pixel (CSS px of the right pane), null off the globe
  window.__cmwSphereW = (x, y) => { const w = pickSphere(paneR, camS, x, y); return w ? [w.re, w.im] : null; };
  // the level predictLevel would give the right pane's passes (13.14's estimate; no longer a floor) and its estimate
  window.__cmwPredict = () => { const list = S.shapes.filter((x) => x.visible !== false); return predictLevel(list, stageMap(rightStage()), 'R', paneR, lastRecs); };
  // per shape: the line key, whether the settle-time refinement is in (SPEC 9.1), segments and pieces drawn
  window.__cmwLines = () => [...gpu.entries()].map(([id, r]) => ({ id, refined: !!r.refKey && r.refKey.startsWith(r.lineKey + '|'), current: (() => { const sp = lineSpecNow(); return !sp || r.refKey === r.lineKey + '|' + sp.key; })(), segs: r.lineRes ? r.lineRes.n : 0, pieces: r.lpolys ? r.lpolys.length : 0, refMs: r.refMs, running: !!lineJob.running,
    // ([#325] the drawn polylines' size and a weighted sum of their coordinates: a sliced refinement must give the same)
    pts: r.lpolys ? r.lpolys.reduce((n, p) => n + p.length, 0) : 0, sum: r.lpolys ? r.lpolys.reduce((a, p) => p.reduce((b, x, i) => b + x * ((i % 7) + 1), a), 0) : 0 }));
  // the cost guard per pane, the timer and the display interval estimate
  window.__cmwGuard = () => ({ R: guard ? guard.state('R') : null, L: guard ? guard.state('L') : null, timer: !!(GLR.timer && GLR.timer.available), inverseDraws: GLR.inverseDraws, log: guardLog.slice() });
  // a fresh cost guard with policy options (GLR.CostGuard opts, e.g. {budget: 1e9}: measure only), for measurements
  window.__cmwGuardOpts = (o) => { if (!GLR.CostGuard) return null; guard = GLR.CostGuard(Object.assign({}, GUARD_OPTS, o || {})); for (const g of Object.values(paneG)) { g.key = ''; g.reads = []; g.demoted = false; } guardLog.length = 0; requestRender('L', 'R'); return guard.state('R'); };
  // the look drawScene gives shape id (colours as hex), the pattern cell, the right view, clipWin and the plane colour
  window.__cmwLook = (id, side = 'R') => { const s = S.shapes.find((x) => x.id === id); if (!s) return null; const k = shapeInk(s); const L = side === 'L'; return { color: k.c0, color2: k.alt, edge: k.edge, ink: TH.ink, alpha: S.alpha, pattern: S.pattern, cell: patternCell(), lines: S.lines, sphN: sphN(), plane: TH.plane, view: Object.assign({}, L ? leftView() : V.right), win: Object.assign({}, clipWin), dpr: (L ? paneL : paneR).dpr, W: (L ? paneL : paneR).pw, H: (L ? paneL : paneR).ph, stage: L ? leftStage() : rightStage() }; };
  // P3: the z-globe's point under a pane pixel (as __cmwSphereW for the w-globe), and a globe's camera set directly
  // P3b: the shapes and targets as stored; the CSS pixel of the plane point (x, y) on a side's globe (null behind it)
  window.__cmwShapes = () => JSON.parse(JSON.stringify({ shapes: S.shapes, targets: S.targets, selected }, noRuntime)); window.__cmwStroke = (id, opt) => { const s = S.shapes.concat(S.targets).find((q) => q.id === id); const k = s && shapeStroke(s, 1, opt || {}); return k && { width: k.width, alpha: k.alpha, casing: k.casing && k.casing.width, casingAlpha: k.casing && k.casing.alpha }; };
  window.__cmwGlobeXY = (side, x, y) => { const gc = globeCam(side); if (!gc) return null; const P = Number.isFinite(x) ? Region.Globe.lift(x, y) : [0, 0, 1]; return gScreen(gc, P); };
  window.__cmwGlobeSnap = (side, x, y, role) => { const gc = globeCam(side), g = pickGlobe(side === 'L' ? paneL : paneR, camOf(side), x, y); const r = g && gc ? globeSnap(gc, side, g, role) : null; gSnapMark = null; return r ? { z: r.z && [r.z.re, r.z.im], snapped: !!r.snapped, g: g.z && [g.z.re, g.z.im], R: gc.R } : null; };
  // the number of inked overlay pixels within r CSS px of the world point z = [re, im] on a pane's overlay (a drawn handle is ink)
  window.__cmwOverlayInk = (side, z, r = 8) => { const p = side === 'R' ? paneR : paneL, [x, y] = p.w2s({ re: z[0], im: z[1] }), k = p.ocanvas.width / p.w; const d = p.octx.getImageData(Math.max(0, Math.round((x - r) * k)), Math.max(0, Math.round((y - r) * k)), Math.round(2 * r * k), Math.round(2 * r * k)).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n; };
  window.__cmwSelect = (id) => { selected = id; if (id) zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL', 'OR'); };
  window.__cmwGlobeHandles = (side) => { const gc = globeCam(side); const s = (side === 'R' ? S.targets : S.shapes).find((x) => x.id === selected); return s && gc ? globeHandles(s, gc).map(([k, P]) => [k, gScreen(gc, P)]) : []; };
  window.__cmwSphereWL = (x, y) => { const w = pickSphere(paneL, camOf('L'), x, y); return w ? [w.re, w.im] : null; };
  // (#440 test/sv_globe_mask_cmd.js) the left pane's points under its pixels, on the globe or the flat plane: pane-local
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
  window.__cmwCam = (side, o) => { const c = camOf(side); if (o) { Object.assign(c, o, { vyaw: 0, vpitch: 0 }); requestRender(side); } return { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx || 0, ty: c.ty || 0, tz: c.tz || 0, fov: c.fov }; };
  // what the live panes last drew each shape with: {'R|s1': 'inverse' | 'pending' | 'forward', ...}
  window.__cmwDrawn = () => Object.fromEntries(lastPath);
  // the scissor w-box of shape id's image under the right plane's map (SPEC 4.8; null: no scissor)
  window.__cmwInvBox = (id) => {
    const s = S.shapes.find((x) => x.id === id);
    if (!s) return null;
    const p = pathOf(s, stageMap(rightStage()), 'R', 'flat');
    return p.e ? invBox(p.e, p.plan, s) : null;
  };
  // (-> whether example i is now the current one: false past the last example)
  window.__cmwExample = (i) => { loadExample(i); return currentExample === i; };
  // the selection, the step shown alone, the temporary Inspector and X's view
  window.__cmwCards = () => ({ sel: selOf(), focus: S.focus, temp: tempInsp, main: { view: Object.assign({}, paneL.view), w: paneL.w, h: paneL.h, dpr: paneL.dpr } });
  // (#235: what the Cauchy style draws from, and a switch to draw the quadrature where the formula holds)
  /** @type {any} */ (window).__cmwCauchy = () => { const cp = cauchyPlot(); return cp ? { name: cp.name, formula: !!(cp.plan && cp.plan.ok), fast: !!(cp.plan && cp.plan.fast), why: cp.plan && !cp.plan.ok ? cp.plan.why : null, poles: cp.plan && cp.plan.ok ? cp.plan.poles.map((q) => ({ z: [q.z.re, q.z.im], order: q.order, n: q.n })) : [] } : null; };
  /** @type {any} */ (window).__cmwCauchyQuad = (v) => { INT.setCauchyQuad(v); requestRender('L'); };
  // (the Cauchy style's draw time: n frames of the left pane, each read back so the GPU has finished; ms per frame)
  /** @type {any} */ (window).__cmwCauchyBench = (n) => { const g = GLR.gl, px = new Uint8Array(4), t0 = performance.now(); for (let i = 0; i < n; i++) { renderColor(paneL); g.readPixels(0, 0, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px); } return (performance.now() - t0) / n; };
  /** @type {any} */ (window).__cmwCauchyOpt = (show, plus) => { setOpt('cauchyShow', show); setOpt('cauchyPlus', !!plus); requestRender('L'); save(); };
  // P3 (SPEC 10.6, 12.4 (h)): the figure export as the dialog runs it (opt: {panels, widthIn, caption, alive}), and one
  // panel drawn off-screen at print size (a PNG data URL)
  window.__cmwBuildFigure = (opt) => buildFigure(Object.assign({ panels: ['L', 'R'], widthIn: 7, caption: false }, opt || {}));
  // item 2 (the deformation picture): open/close and scrub the transport; the screen's path selection
  // (v16 deformation range, SPEC 13.3) kind 'H' (the image side at T), 'H0', 'F' (the chain), 'cpuMap' (a map spec's
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
  window.__cmwMorph = (o) => { if (o && o.togglePlay) togglePlay(); if (o && 'range' in o) setHomRange(o.range, { preview: !!o.preview }); if (o && o.open != null) { if (o.open) openTransport(); else closeTransport(); } if (o && o.T != null) { morph.T = o.T; morph.seg = null; morph.u = 0; morph.playing = false; syncTransport(); scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); } if (o && o.playing != null) { morph.playing = !!o.playing; requestRender('R'); } return { open: morph.open, T: morph.T, playing: morph.playing, on: morphOn() }; };
  // (#246) the step glide: press ‹ (d -1) or › (+1) as the phone's chain row does; read where it is
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
    const sel = mfCache.rsel && mfCache.rkey === mfScreenKey(paneR).key ? mfCache.rsel : mfCache.sel;
    if (!sel) return null;
    const P = (w) => paneR.w2s(w);
    const Fc = new Map(), Fat = (T) => { let f = Fc.get(T); if (!f) { f = morphAt(T); Fc.set(T, f); } return f; };
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
    const ex = 0.75 * PATHS.sep, d = 0.7 * PATHS.dTest, nogo = mfNogo(paneR);
    let sep = 0;
    // (only a path's own start and end are exempt, within ex: the review's measure; another path's end is not.
    // sepLong: the share within 2 dTest, for paths longer than longK dS)
    let sepLong = 0;
    for (const { k, ls } of polys) {
      if (!ls.length) continue;
      const lr = ls[ls.length - 1], ends = [ls[0][0], lr[lr.length - 1]];
      let n = 0, near = 0, far = 0;
      for (const l of ls) for (const p of resamplePx(l, 3)) {
        if (p[0] < 0 || p[1] < 0 || p[0] > paneR.w || p[1] > paneR.h - 8 || nogo.some((R) => p[0] >= R.x0 && p[0] <= R.x1 && p[1] >= R.y0 && p[1] <= R.y1) || ends.some((q) => mDist(p, q) < ex)) continue;
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
  window.__cmwMorphCache = () => ({ ready: !!(mfCache.sel && mfCache.key === mfScreenKey(paneR).key && (mfCache.vkey === mfScreenKey(paneR).vkey || mfViewOk(paneR))), job: !!mfCache.job, zs: mfCache.sel ? mfCache.sel.kept.map((k) => [k.sp.z.re, k.sp.z.im]) : null, rej: mfCache.sel ? mfCache.sel.rej : null, away: mfCache.sel ? mfCache.sel.away : null, hint: mfGlobeAway(), prev: mfCache.prev ? mfCache.prev.sel.kept.length : 0 });
  window.__cmwLastFigure = () => Figure.last();
  window.__cmwFigPathsSel = () => (mfFigCache.sel ? { n: mfFigCache.sel.kept.length, nCands: mfFigCache.sel.nCands, cap: mfFigCache.sel.budget, rej: mfFigCache.sel.rej } : null);
  window.__cmwFig = Figure;
  window.__cmwTeX = TeX;
  /** @type {any} */ (window).__cmwCapParts = () => { const c = figCapParts(); return { Fname: c.Fname, raw: c.raw, formula: c.formula, mapTex: c.mapTex }; };
  window.__cmwPrepareExport = (panels, alive) => prepareExport(panels || ['L', 'R'], alive);
  window.__cmwRenderOff = (side, w, h, dpr) => renderOff(side, w, h, dpr).toDataURL('image/png');
  // client coordinates of plane point (re, im) in the left ('L') or right ('R') plane, as last drawn
  // v16.5 wave 1 plane (test/ux165_plane_cmd.js): the open draft, the handle size in use
  window.__cmwDraft = () => (draft ? { kind: draft.kind, pts: (draft.pts || []).map((p) => p.slice()) } : null);
  window.__cmwHandles = () => ({ size: fingerNow() ? 12 : 7, touch: ptrTouch });
  window.__cmwW2S = (side, re, im) => { const p = side === 'L' ? paneL : paneR; const r = p.ocanvas.getBoundingClientRect(); const v = p.view; return [r.left + p.w / 2 + (re - v.cx) * v.s, r.top + p.h / 2 - (im - v.cy) * v.s]; };
  // sound (notes/sound): the app side of the engine, for test/sound_cmd.js
  window.__cmwSound = (o) => { if (o && o.zp) { zpSet(o.zp[0], o.zp[1], o.zp[2], C(o.zp[3], o.zp[4])); return 1; } if (o && o.hAt) { const F = sndFAt(o.hAt[0]), w = F(C(o.hAt[1], o.hAt[2])); return [w.re, w.im]; } if (o && o.pick) { const r = paneL.ocanvas.getBoundingClientRect(), z = lLand() ? pickLand(o.pick[0] - r.left, o.pick[1] - r.top) : null; return z ? [z.re, z.im] : null; } if (o && o.perEval) snd.perEval = o.perEval; if (o && o.pathT) { const [T0, T1] = o.pathT; morph.T = T1; snd.T = T1; requestRender('R'); soundFunctionChanged({ at: (u) => sndFAt(T0 + u * (T1 - T0)) }); return 1; } if (o && o.listen) sndListen(o.listen, o.closed !== false); if (o && o.loop) sndLoopDone(o.loop); if (o && o.lastLoop) snd.lastLoop = { pts: o.lastLoop, closed: true }; return { hear: SND && SND.hear ? SND.hear.state() : null, glide: SND ? !!SND.state().glide : false, rope: snd.rope ? [snd.rope.x, snd.rope.y, snd.rope.src] : null, ptype: snd.ptype, listenFn: snd.play && snd.play.fn ? { counts: snd.play.h.counts || null, dur: snd.play.dur, mode: snd.play.h.mode || '' } : null, sing: SND ? SND.singState() : null, cv: { on: snd.cv.on, W: snd.cv.W, T: snd.cv.T }, sang: snd.sang, listenHarp: snd.play && snd.play.h.harp ? { up: snd.play.h.harp.up, down: snd.play.h.harp.down, notes: snd.play.h.harp.notes, dur: snd.play.dur, piece: !!snd.play.piece } : null, phi: snd.phi, near: snd.near, gestT: snd.gestT, loop: snd.loop ? { phi: snd.loop.phi, k: snd.loop.k } : null, lastLoop: !!snd.lastLoop, play: !!snd.play, auto: snd.auto, morphArm: snd.morphArm, kz: snd.kz, kbd: snd.kbd, kloop: snd.kloop ? snd.kloop.length : 0, perEval: snd.perEval, tracker: snd.tracker, live: ($('sndLive') || {}).textContent || '', run: snd.run ? { phi: snd.run.phi, k: snd.run.k, jumps: snd.run.jumps } : null, rest: snd.rest ? { z: [snd.rest.z.re, snd.rest.z.im], src: snd.rest.src } : null, T: snd.T, fcN: snd.fcN, fcGen: snd.fcGen,  g: snd.g ? [snd.g.re, snd.g.im] : null }; };
  // v16 constructions (CORE): the graph's order, the forms, the last recompute, the events; o.call runs a cm call,
  // o.state(...) replaces S's shapes / targets / steps through the load path (sanitizeState), o.anchor sets the GPU anchor
  window.__cmwC = (o) => {
    if (o && o.call) { const a = cmApi(); const r = a[o.call](...(o.args || [])); return r === undefined ? null : JSON.parse(JSON.stringify(r, noRuntime)); }
    if (o && o.anchor) { GLR.setFormAnchor(o.anchor); requestRender('L', 'R'); return 1; }
    const g = Constr.graph(S), all = S.shapes.concat(S.targets);
    const cms = /** @type {any} */ (cmSync), last = cms.last ? { ids: cms.last.ids, kindChanged: cms.last.kindChanged, undefChanged: cms.last.undefChanged } : null;
    return { order: g.order, cyclic: g.cyclic, last, forms: Object.fromEntries(all.filter((s) => s._g).map((s) => [s.id, s._g])), atInf: all.filter((s) => s._atInf).map((s) => s.id), events: Construct.events.map((e) => e.type), freed: /** @type {any} */ (cmLoad).freed || 0, steps: S.steps.map((st) => ({ uid: st.uid, zpIds: st.zpIds || null })), stats: Constr.lastRecompute };
  };
  // v16 constructions (INTERFACE): the ring, the draft, the session's Curve | Region; o.fill sets it
  window.__cmwCI = (o) => { if (o && o.gs) { const [side, P] = o.gs, gc = globeCam(side), q = gc && gScreen(gc, P), r = (side === 'R' ? paneR : paneL).ocanvas.getBoundingClientRect(); return q ? [r.left + q[0], r.top + q[1]] : null; } if (o && o.fill) Construct.fill = o.fill; if (o && o.snap) { const [side, x, y, opt] = o.snap; const t = Construct.snapAt(side, x, y, opt || {}); return t ? { cls: t.cls, z: t.z, ref: t.ref } : null; } if (o && o.names) return S.shapes.concat(S.targets).map((s) => ({ id: s.id, kind: s.kind, name: Construct.shapeLabel(s), def: Construct.defText(s), why: s.cundef ? Construct.reasonText(s.cundef) : null })); if (o && o.shapes) return { hi, n: hist.length, tool, selected, zeros: S.steps[0] ? S.steps[0].params.zeros : null, list: S.shapes.concat(S.targets).map((s) => Object.assign(JSON.parse(JSON.stringify(s, noRuntime)), { inf: !!s._atInf, A: s._g ? s._g.A : null })) }; return Construct.debug(); };
  window.__cmwCapText = (panels) => pcTidy(figureCaption(panels || ['L'])).map((x) => (x.t != null ? x.t : x.m != null ? `$${x.m}$` : x.b || '')).join('');
  // (#846) the steps view's carried landscape in the last frame: {u, s (plane a), mu, box}, or null for a surface at
  // rest; box: the last frame's block, carried or not
  // the last Landscape frame's height-axis labels, as their screen y (CSS px)
  window.__cmwLandTicks = () => (render3D.ticks || []).slice();
  // the height ruler's labels as placed, { v: value, hz: world height }, and the frame's own height function of a value
  window.__cmwLandTickMarks = () => (render3D.tickMarks || []).map((m) => ({ v: m.v, hz: m.hz }));
  window.__cmwLandHeightOf = (v) => (render3D.frameHeight ? render3D.frameHeight(v) : null);
  // the left key's kind and the caption it draws now (the key is drawn here, so a read never waits for a frame)
  window.__cmwLegend = () => { drawLegend(); return { kind: legendKind('L'), caption: legendState.L.caption || null, ring: legendState.L.ring }; };
  // (the enumerator's pixel size as a fraction of the box; its buffer; a frame vertex's z, relative to |z| + 1 (it is single precision), and
  // height, world units, within which an enumerated member is the one it draws)
  const LAND_ENUM_PIX = 512, LAND_ENUM_B = 8, LAND_ENUM_Z_TOL = 1.5e-3, LAND_ENUM_H_TOL = 0.02, LAND_ENUM_SAME_Z = 1e-5, LAND_ENUM_NEAR = 2;
  window.__cmwLandScale = () => render3D.scale || null;
  // true: Steps-view Landscape glide frames draw the carried mesh instead of the exact inverse; false (the default) restores it
  window.__cmwLandMeshOnly = (on) => { svLandMeshOnly = !!on; requestRender('L', 'R'); return svLandMeshOnly; };
  window.__cmwLandCarry = (box) => (box ? render3D.box || null : render3D.carried || null);
  // TEMP-DEBUG-HOOK

  // TEMP-DEBUG-HOOK (removed before publishing)
  // (the test hooks go on: a block of their own, as t_publish caps a block's length)
  // the last frame's carried landscape over its block, on the CPU: an nx x ny grid of points over the block, each covered
  // when it lies in the image of a carried triangle the draw keeps (LAND_CARRY_VS: its corners' images finite, its edges at
  // most lim long), of the box grid (cells x cells vertices over src), of a pole patch or of the far patch (patchN x patchN vertices,
  // CARRY_Z; left out with patches false, the far patch left out with patches 'poles'), and of the patches more ([x, y, r0, r1] each, the same parametrisation, on the
  // CPU only). {n, bare: the points no kept triangle covers, at: the first of them}, or null with no carry. (The heights'
  // step limit, LAND_CARRY_VS's uStep, is left out: it drops cells only in Re F and Im F)
  window.__cmwLandCover = (nx = 480, ny = 400, patches = /** @type {boolean | string} */ (true), more = []) => {
    const c = render3D.carried;
    if (!c || !c.map || c.sheets) return null;
    const F = cpuMap(c.map), b = c.box, cov = new Uint8Array(nx * ny);
    const kx = (nx - 1) / (b.x1 - b.x0), ky = (ny - 1) / (b.y1 - b.y0), lim2 = c.lim * c.lim;
    // (a grid of n x n vertices at place(i, j) of plane s: its images, then its two triangles a cell)
    const grid = (n, place) => {
      const P = new Float64Array(2 * n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const z = place(i, j), w = F(C(z[0], z[1])), o = 2 * (j * n + i);
        if (CX.isFin(w)) { P[o] = w.re; P[o + 1] = w.im; } else P[o] = P[o + 1] = NaN;
      }
      const at = (i, j) => 2 * (j * n + i);
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        tri(P, at(i, j), at(i + 1, j), at(i + 1, j + 1));
        tri(P, at(i, j), at(i + 1, j + 1), at(i, j + 1));
      }
    };
    const tri = (P, a, d, e) => {
      const ax = P[a], ay = P[a + 1], bx = P[d], by = P[d + 1], cx = P[e], cy = P[e + 1];
      if (!(Number.isFinite(ax) && Number.isFinite(bx) && Number.isFinite(cx))) return;
      if ((ax - bx) ** 2 + (ay - by) ** 2 > lim2 || (bx - cx) ** 2 + (by - cy) ** 2 > lim2 || (cx - ax) ** 2 + (cy - ay) ** 2 > lim2) return;
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
    };
    const s = c.src, n = c.cells;
    grid(n, (i, j) => [s.x0 + (i / (n - 1)) * (s.x1 - s.x0), s.y0 + (j / (n - 1)) * (s.y1 - s.y0)]);
    for (const [px, py, r0, r1, N] of (patches ? (c.polar || []).slice(0, c.patches || 0).concat(c.far && patches !== 'poles' ? c.far : []) : []).concat(more)) {
      const m = (N || c.patchN || 96) - 1;
      grid(m + 1, (i, j) => { const th = (-2 * Math.PI * i) / m, r = r0 * Math.pow(r1 / r0, j / m); return [px + r * Math.cos(th), py + r * Math.sin(th)]; });
    }
    let bare = 0;
    const at = [];
    for (let k = 0; k < nx * ny; k++) if (!cov[k]) { bare++; if (at.length < 8) at.push([+(b.x0 + (k % nx) / kx).toFixed(3), +(b.y0 + Math.floor(k / nx) / ky).toFixed(3)]); }
    return { n: nx * ny, bare, at };
  };
  // the height error of the last carried Landscape frame's far patches, on the CPU: each cell of a far patch outside the pole patches'
  // discs ([x, y, r0, r1]; with skipPatches false, whole) whose centre's image lies in the block, its four corners' heights L = ln(1 + |h(z)|) (h = svHeightF: plane s to the height plane) averaged, the
  // chord's height at the cell, against L at its centre; {cells, bad: the cells whose chord is off by more than tol, worst, at:
  // the worst cell's centre and corners' mean and exact L}, per patch of c.far (of 'polar': per pole patch, each at its own
  // resolution, none left out), or null with no carry
  window.__cmwLandFarErr = (tol = 0.25, skipPatches = true, of = 'far') => {
    const c = render3D.carried;
    if (!c || !c.map || c.sheets || !c.far) return null;
    const F = cpuMap(c.map), h = svHeightF(c.s), b = c.box, L = (z) => { const v = h(z); return CX.isFin(v) ? Math.log(1 + CX.abs(v)) : NaN; };
    return (of === 'polar' ? (c.polar || []).slice(0, c.patches || 0).map((q) => [...q, c.patchN]) : c.far).map(([px, py, r0, r1, N]) => {
      const m = (N || c.patchN || 96) - 1, at = (i, j) => { const th = (-2 * Math.PI * i) / m, r = r0 * Math.pow(r1 / r0, j / m); return C(px + r * Math.cos(th), py + r * Math.sin(th)); };
      const out = { cells: 0, bad: 0, worst: 0, at: null }, V = new Float64Array((m + 1) * (m + 1));
      for (let j = 0; j <= m; j++) for (let i = 0; i <= m; i++) V[j * (m + 1) + i] = L(at(i, j));
      for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
        const zc = at(i + 0.5, j + 0.5), w = F(zc);
        if (of === 'far' && skipPatches && (c.polar || []).slice(0, c.patches || 0).some(([qx, qy, , q1]) => Math.hypot(zc.re - qx, zc.im - qy) < q1)) continue;
        if (!CX.isFin(w) || w.re < b.x0 || w.re > b.x1 || w.im < b.y0 || w.im > b.y1) continue;
        const a0 = V[j * (m + 1) + i], a1 = V[j * (m + 1) + i + 1], a2 = V[(j + 1) * (m + 1) + i], a3 = V[(j + 1) * (m + 1) + i + 1], Lc = L(zc);
        if (!Number.isFinite(a0 + a1 + a2 + a3 + Lc)) continue;
        const mean = (a0 + a1 + a2 + a3) / 4, e = Math.abs(mean - Lc);
        out.cells++;
        if (e > tol) out.bad++;
        if (e > out.worst) { out.worst = e; out.at = [+zc.re.toFixed(3), +zc.im.toFixed(3), +mean.toFixed(3), +Lc.toFixed(3)]; }
      }
      out.worst = +out.worst.toFixed(3);
      return out;
    });
  };
  // (#846) the last Landscape frame's Inside-regions mask at the point (x, y) of its plane: 0 to 1 (1: in the carried
  // region set), null outside its box or with no mask
  window.__cmwLandMask = (x, y) => landMaskAlpha(render3D.mask, x, y);
  // a Landscape frame's pane position (CSS px) of the place (x, y) of its box at height h: pk {box, info, w, h}
  const landWorldPx = (pk, x, y, h) => {
    const b = pk.box, [ax, ay] = pk.info.aspect;
    return project(pk, pk.info.MVP, [(2 * (x - b.x0) / (b.x1 - b.x0) - 1) * ax, (2 * (y - b.y0) / (b.y1 - b.y0) - 1) * ay, h]);
  };
  // the last Landscape frame's pane position (CSS px) of the surface point over (x, y) of its plane, null with no pick data
  window.__cmwLandSurfacePx = (x, y) => {
    const pk = render3D.pick;
    if (!pk || !pk.info) return null;
    const w = pk.F(C(x, y));
    return landWorldPx(pk, x, y, pk.info.heightOf(landValue(w)));
  };
  // the last Landscape frame's pane position (CSS px) of the floor point under the place (x, y) of its box (the plane the
  // frame draws, carried or at rest), null when no frame is drawn
  window.__cmwLandFloorPx = (x, y) => {
    const f = render3D.floor;
    return f ? landWorldPx(f, x, y, f.info.floorZ) : null;
  };
  // the last Landscape frame's height reading: F (the shown plane's point -> the plane's value), height(w) (a value's drawn
  // height, as the frame draws it) and the plane's box; null with no pick data
  window.__cmwLandPick = () => {
    const pk = render3D.pick;
    return pk && pk.info ? { F: pk.F, height: (w) => pk.info.heightOf(landValue(w)), box: pk.box } : null;
  };
  // the height the last Landscape frame draws for the plane's value v (its own scale and knee, the glide's blend): [re, im] -> height
  window.__cmwLandFrameHeight = (v) => (render3D.frameHeight ? render3D.frameHeight(landValue({ re: v[0], im: v[1] })) : null);
  // the left pane's Landscape frame redrawn once as the relief alone on a transparent frame (the figure's coverage render, artRelief: no
  // floor, plate, marks or labels), the same carry, view and camera: the alpha plane of the pane's canvas kept as window.__cmwLandRelief.cov
  // (one byte a pixel, w x h; 255 where the relief covers the pixel), and the frame then drawn again as before. -> { w, h, n: covered pixels },
  // or null with no Landscape frame
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
      Object.assign(window.__cmwLandRelief, { cov, w: cv.width, h: cv.height, land: artLand });
      return { w: cv.width, h: cv.height, n };
    } finally {
      artMode = keep.artMode; artRelief = keep.artRelief;
      renderLeft();
    }
  };
  // the pane position (CSS px) of the point over (x, y) of the plane of the relief at height h, in the frame window.__cmwLandRelief last
  // drew (its camera and box), null before it or where the point is behind the camera
  window.__cmwLandProject = (x, y, h) => {
    const L = window.__cmwLandRelief && window.__cmwLandRelief.land;
    if (!L) return null;
    const b = L.box, [ax, ay] = L.aspect;
    return project(L, L.MVP, [(2 * (x - b.x0) / (b.x1 - b.x0) - 1) * ax, (2 * (y - b.y0) / (b.y1 - b.y0) - 1) * ay, h]);
  };
  window.__cmwLandSheets = () => ({ drawn: render3D.sheetsInfo || null, shown: sheetsShown(), deformOk: deformSheetsOk(), linear: !!render3D.linear, title: paneTitles().left });
  window.__cmwCutCurves = () => carriedCuts.map((c) => Object.assign({}, c));   // (test/sv_cut_curve_cmd.js)
  window.__cmwCutHandles = () => { const r = paneL.ocanvas.getBoundingClientRect(); return cutHandlesL.map((hd) => ({ step: hd.step, x: r.left + hd.x, y: r.top + hd.y, deg: hd.deg, w: hd.F ? hd.F(hd.q) : null, carried: !!(hd.F || hd.fwd), wz: hd.q ? { re: hd.q.re, im: hd.q.im } : null })); };   // (v16.5 test/ux165_chain_cmd.js)
  // TEMP-DEBUG-HOOK

  // TEMP-DEBUG-HOOK (removed before publishing)
  // (the test hooks go on: a second block, as t_publish caps a block's length)
  // the last carried frame's grid as drawn at probe places: per place the layers [{ h, member, w, z, f, sheet, matches }]; matches is 1 plus how many other members, of another z, fit the layer's z and height and lie within LAND_ENUM_NEAR times the nearest one's distance (the nearest is taken; more than 1 is ambiguous); f and sheet are
  // those of the enumerator's member (__cmwLandEnum) at the vertex's own place that has its z and its height (null: none has)
  // the last exact carried frame's edges crossed twice (a branch point on an edge): the triangles holding them are left out
  window.__cmwLandDrops = () => (GLR.landDrops ? GLR.landDrops() : null);
  window.__cmwLandCutEdges = () => (GLR.landCutEdges ? GLR.landCutEdges() : null);
  window.__cmwLandFrameVerts = (pts) => {
    const g = render3D.box && render3D.carried ? GLR.landFrameVerts(pts, render3D.box) : null;
    return g ? g.map((ls) => ls.map((l) => {
      const ms = l.z ? (window.__cmwLandEnum([l.w]) || [[]])[0] : [], at = (m) => Math.hypot(m.z[0] - l.z[0], m.z[1] - l.z[1]) <= LAND_ENUM_Z_TOL * (Math.hypot(l.z[0], l.z[1]) + 1);
      const dz = (q) => Math.hypot(q.z[0] - l.z[0], q.z[1] - l.z[1]);
      const cand = ms.filter((q) => at(q) && Math.abs(q.h - l.h) <= LAND_ENUM_H_TOL).sort((a, b) => dz(a) - dz(b)), m = cand[0];
      return Object.assign({}, l, { f: m ? m.f : null, sheet: m ? m.sheet : null, matches: m ? 1 + cand.filter((q) => q !== m && Math.hypot(q.z[0] - m.z[0], q.z[1] - m.z[1]) > LAND_ENUM_SAME_Z && dz(q) <= LAND_ENUM_NEAR * dz(m)).length : 0 });
    })) : g;
  };
  // the last carried frame's cut edges per layer: [{ cuts, box, pp: [patch] }], each grid { n, jumps, w } (the jump texels of its three edge textures and the places of the first few); null with no carried frame
  window.__cmwLandEdgeCounts = () => (render3D.carried ? GLR.landEdgeCounts() : null);
  window.__cmwLandSeamMiss = () => (render3D.carried ? GLR.landSeamMiss() : null);
  // the shown plane's map at a point z of plane 0 ([re, im] -> [re, im]), from the inverse inputs the last carried frame drew
  // from; null when there are none
  window.__cmwLandForward = (z) => { const F = render3D.exactIn && render3D.exactIn.F, f = F ? F(C(z[0], z[1])) : null; return f && CX.isFin(f) ? [f.re, f.im] : null; };
  // the parked All-sheets reference at a point z of plane 0 ([re, im]): per forward combo of the colour map's distinct sheets
  // (sheetUniqOf, window S.sheetW) [{ combo, z, f, h }], f the sheet's value at z (Funcs.sheetEval, as the parked frame draws it)
  // and h its height at the last frame's scale; [] with no frame or no sheets
  window.__cmwLandRefSheets = (z) => {
    const hOf = render3D.frameHeight, ex = render3D.exactIn, W = Math.max(1, Math.min(4, Math.round(S.sheetW) || 2));
    if (!hOf || !ex || typeof Funcs.sheetEval !== 'function') return [];
    const fm = SV.on ? svMapAt(0) : endMap(), zc = C(z[0], z[1]);
    return sheetUniqOf(fm, W).map((combo) => {
      let f = null;
      try { f = Funcs.sheetEval(S.steps, built, fm.b, zc, zc, combo, W, { a: fm.a || 0 }); } catch (e) { f = null; }
      return { combo, z: [z[0], z[1]], f: f && CX.isFin(f) ? [f.re, f.im] : null, h: f && CX.isFin(f) ? hOf(landValue(f)) : null };
    });
  };
  // the CPU enumerator's members at probe places, from the inverse inputs the last carried frame drew from: per place
  // [{ z, f, h, member, sheet, D, lvl, lam, front? }] sheet by sheet (the frame's own sheet first, then those beside it), each sheet's members
  // front to back; f is the value of plane 0's map at z and h its drawn height, D the member's depth key. f and h are the drawn
  // ones for the frame's own sheet (sheet 0); a member on a sheet beside it has its value on that sheet's branch of the step, so
  // its z and D are the reference there, not f and h. lvl: the member's level inside its sheet's window in pixels (negative: a member of the range
  // ramp just outside it); lam: [re, im] its continued log coordinate, the member's own sheet's H is exact there. front: true marks the one member the frame draws with sheets off. Null when the frame was not drawn by the inverse path
  window.__cmwLandEnum = (pts) => {
    const inp = render3D.exactIn, hOf = render3D.frameHeight, bx = render3D.box;
    if (!inp || !hOf || !bx) return null;
    const ex = inp.exact, F = inp.F;
    const pix = (bx.x1 - bx.x0) / LAND_ENUM_PIX, sheets = [ex].concat(ex.more || []);
    return pts.map(([x, y]) => {
      const out = [];
      sheets.forEach((sh, sheet) => {
        let r = null;
        try { r = Inverse.enumerate(sh.plan, sh.prep, C(x, y), pix, { K: LAND_ENUM_B, B: LAND_ENUM_B, all: true, leaves: false }); } catch (e) { r = null; }
        // (a sheet beside the frame's own: the chain with that step's branch moved by the sheet's shift, a turn of the argument per
        // shift for a root, 2 pi i per shift added for a log)
        const at = sh.shift && sh.shift.vals ? built.findIndex((bb) => bb.vals === sh.shift.vals) : -1, id = at >= 0 ? built[at].def.id : null;
        const ang = TAU * (sh.shift ? sh.shift.dk : 0), turn = id === 'root' ? C(Math.cos(ang / built[at].vals.n), Math.sin(ang / built[at].vals.n)) : null;
        const Fs = at < 0 ? F : (z) => {
          for (let i = 1; i <= svHT(0); i++) {
            const f = stepFn(i);
            if (!f) continue;
            z = f(z);
            if (i - 1 === at) z = turn ? CX.mul(z, turn) : id === 'log' ? CX.add(z, C(0, ang)) : z;
          }
          return z;
        };
        if (r) r.entries.forEach((e, member) => {
          const f = Fs(e.z);
          out.push({ z: [e.z.re, e.z.im], f: CX.isFin(f) ? [f.re, f.im] : null, h: CX.isFin(f) ? hOf(landValue(f)) : null, member, sheet, D: e.D, lvl: e.lvl, lam: e.lam ? [e.lam.re, e.lam.im] : null });
        });
      });
      // the member the frame draws with sheets off: the first sheet's front member (the sheets are taken in order, the frame's own
      // first; the depth keys of different sheets are never compared, they only order the members within one sheet)
      if (out.length) out[0].front = true;
      return out;
    });
  };
  // The scene's own definition of the glide's homotopy H_u from plane 0 to the plane shown at u (the map the carried mesh and the steps view
  // draw: svBetween's, from base 0), on surface number combo of the cell centred at zc (default z): Funcs.sheetMapEval, [re, im] or null where
  // it is not finite. __cmwLandSceneCombos() answers { n, W }, the surfaces the map has (Funcs.sheetMapCombos), or null when the map cannot be
  // drawn as sheets; both read the scene's state alone, never the inverse plan
  // (sceneMapOver: a map a control reads the scene of instead of the glide's)
  let sceneMapOver = null;
  const sceneMap = () => {
    if (sceneMapOver) return sceneMapOver;
    const g = svBetween();
    return g.all ? { mode: 3, a: g.a, b: g.b, t: g.u, base: 0 } : { mode: 1, base: 0, hi: g.b, t: g.u };
  };
  window.__cmwLandSceneCombos = () => {
    const W = Math.max(1, Math.min(4, Math.round(S.sheetW) || 2)), m = sceneMap();
    return typeof Funcs.sheetMapPieces === 'function' && Funcs.sheetMapPieces(S.steps, built, m) ? { n: Funcs.sheetMapCombos(S.steps, built, m, W), W } : null;
  };
  window.__cmwLandScene = (z, combo, zcIn) => {
    const W = Math.max(1, Math.min(4, Math.round(S.sheetW) || 2)), zc = C((zcIn || z)[0], (zcIn || z)[1]);
    let f = null;
    try { f = Funcs.sheetMapEval(S.steps, built, sceneMap(), zc, C(z[0], z[1]), combo, W); } catch (e) { f = null; }
    return f && CX.isFin(f) ? [f.re, f.im] : null;
  };
  // Corrupts the plan the CPU reference reads (the frame itself is already drawn from the true one): 'shiftOut' moves the output of the
  // plan's last op by PLAN_SHIFT on every sheet, in the op's forward map, its preimage rule and its pole test alike, and prepares the plan the
  // way the page does, so Inverse.enumerate and Inverse.fwdOps agree with each other and disagree with the scene; 'restore' puts the true plan and
  // preparation back. True when it applied, false otherwise (no frame from the inverse path, a corruption already in place, or a last op whose
  // preimages are neither listed by pre nor a log family)
  const PLAN_SHIFT = 0.25;
  let planKept = null;
  window.__cmwLandCorruptPlan = (kind) => {
    const inp = render3D.exactIn;
    if (kind === 'restore') {
      if (planKept) planKept.forEach((k) => { k.sh.plan = k.plan; k.sh.prep = k.prep; });
      planKept = null;
      return true;
    }
    if (!inp || planKept || kind !== 'shiftOut') return false;
    const sheets = [inp.exact].concat(inp.exact.more || []), d = C(PLAN_SHIFT, 0), back = (w) => CX.sub(w, d);
    const moved = (o) => {
      const c = Object.assign({}, o, { fwd: (u) => CX.add(o.fwd(u), d), infAt: o.infAt && ((w) => o.infAt(back(w))) });
      if (o.fam && o.fam.type === 'log') c.fam = Object.assign({}, o.fam, { L0: (w) => o.fam.L0(back(w)), member: (w, m, l0) => o.fam.member(back(w), m, l0) });
      else if (!o.fam && o.pre) c.pre = (w) => o.pre(back(w));
      else return null;
      return c;
    };
    const next = sheets.map((sh) => {
      const last = sh.plan.ops[sh.plan.ops.length - 1], m = last && moved(last);
      return m ? Object.assign({}, sh.plan, { ops: sh.plan.ops.slice(0, -1).concat(m) }) : null;
    });
    if (next.some((p) => !p)) return false;
    planKept = sheets.map((sh) => ({ sh, plan: sh.plan, prep: sh.prep }));
    sheets.forEach((sh, i) => {
      sh.plan = next[i];
      sh.prep = Inverse.prepare(next[i], { win: clipWin, shape: SV_ALL, sing: Inverse.keySing(next[i], clipWin) });
    });
    return true;
  };
  // TEMP-DEBUG-HOOK

  // TEMP-DEBUG-HOOK (removed before publishing)
  // (the test hooks go on: a further block, as t_publish caps a block's length)
  // ---- The scene's reference for an exact Landscape glide frame ----
  // Everything below reads the scene's own definition of the glide's homotopy H_u (__cmwLandScene: Funcs.sheetMapEval on the map the steps
  // view draws) and never the inverse plan. __cmwLandEnum's members are candidates only; a candidate counts when it is certified here, and the
  // completeness of the members is the winding of H_u - w around the leaves of the box (anchored continuation, so no cut of a plan enters).
  // SCN: CERT, the relative |H_u(z) - w| a member is within (LAND_ENUM_Z_TOL's value: the candidate's z is as exact as the frame's); TIE, how
  // much nearer the best surface must be than the next, or the surface is ambiguous; ARG, the largest argument a winding step turns;
  // SEG, a leaf edge's first steps; DEPTH0 and DEPTH_MAX, the quadtree's first and last depths; LEAF_MAX, the leaves after which no leaf is cut further; SPLIT and JIT, the share of a leaf its cut falls at and the shift of the first grid's inner lines (a cut that is not the middle keeps a branch point off a leaf's edge); SHRINK, the rings a branch leaf's values are also read on (each half the one before); LIP, the factor its range is widened by over the largest difference of neighbouring samples; CUT_EDGE, the relative distance within which a crossing of a leaf's edge by the cut circle is taken as the edge's corner; CONV, the largest share of the first half of those rings' change that the second half may still change a value by for the branch to be algebraic (finite, converging); MIN_STEP, the smallest step of an edge
  // (a unit edge; the control raises it to 1); CLOSE, the relative distance within which a closed contour returns to its first value; ON, the relative |H_u - w| that
  // puts w on a contour; NEAR, the relative gap of a value from w that the control calls near; REL, the largest relative change of a
  // value across a step of the closure test; POLE_BIG and POLE_R, a pole's |H_u| and the radius it is read at; POLE_GRID, the pole search's
  // grid; SAME_Z, the relative distance under which two candidates are one z; RAY_LIP, how far from a power path's cut ray each of its two sides is read (the principal power takes the upper side's value on the ray itself); SAME_V and SAME_PTS, the relative difference of two surfaces' values under which they are one at each of SAME_PTS squared places of the box
  const SCN = { CERT: 1.5e-3, TIE: 4, ARG: Math.PI / 4, SEG: 16, DEPTH0: 2, DEPTH_MAX: 30, LEAF_MAX: 1024, SPLIT: 0.4713, JIT: 0.0137, SHRINK: 12, LIP: 2, CONV: 0.5, CUT_EDGE: 1e-9, MIN_STEP: 1e-12, CLOSE: 1e-6, ON: 1e-9, NEAR: 1e-4, REL: 0.25, POLE_BIG: 1e3, POLE_R: 1e-7, POLE_GRID: 16, SAME_Z: 1e-5, SAME_V: 1e-9, SAME_PTS: 3, RAY_LIP: 1e-9 };
  // the steps whose path has no pole at 0 < t <= 1 (a polynomial's zoom is entire, a root, a power or a log is a branch step with no pole where its power is positive)
  const POLE_FREE = ['mul', 'add', 'affine', 'pown', 'root', 'powa', 'exp', 'log', 'poly'];
  // The z at which a branch step's input equals its node, pulled back through the steps before it from their definitions: chain lists those steps as
  // [{ id, m }] (m the matrix [a, b, c, d] of a 'mobius' step, complex entries). No step: the node itself; one Möbius step: its inverse at the node,
  // (d node - b) / (a - c node), null when that is at infinity; any other chain: 'unread' (no search stands in for it)
  const zeroOf = (chain, node) => {
    if (!chain.length) return node;
    if (chain.length === 1 && chain[0].id === 'mobius' && chain[0].m) {
      const [a, b, c, d] = chain[0].m, den = CX.sub(a, CX.mul(c, node));
      return CX.isZero(den) ? null : CX.div(CX.sub(CX.mul(d, node), b), den);
    }
    return 'unread';
  };
  window.__cmwLandZerosOf = (chain, node) => {
    const z = zeroOf(chain.map((s) => ({ id: s.id, m: s.m ? s.m.map((v) => C(v[0], v[1])) : null })), C(node[0], node[1]));
    return z === 'unread' || z === null ? z : [z.re, z.im];
  };
  // the scenes of the last SCENE_MEMO distinct (map, box, sheet width, chain) states, oldest dropped first: a caller that moves u between calls finds the earlier u's scene again
  const SCENE_MEMO = 4, sceneMemos = new Map();
  // the scene of the last frame: { map, W, K, own, rank, g(k, zc, z), box, leaves, poles }; null when the map cannot be drawn as sheets or
  // there is no carried frame. K surfaces (Funcs.sheetMapCombos), own the combo of the frame's own sheet (every piece on its own cut's
  // sheet), rank(k) how far k's last piece is from its own sheet (0 own, then 1, 1, 2, 2, ...: the order the page tries the sheets in)
  const sceneOf = () => {
    const bx = render3D.box;
    if (!bx || !render3D.carried || typeof Funcs.sheetMapEval !== 'function') return null;
    const map = sceneMap(), W = Math.max(1, Math.min(4, Math.round(S.sheetW) || 2));
    // (the key is the map's own fields, joined: the map the steps view gives has six; a control's map override is keyed whole)
    const key = sceneMapOver ? JSON.stringify([map, bx.x0, bx.x1, bx.y0, bx.y1, W, chainSig[nSteps()]]) : [map.mode, map.a, map.b, map.t, map.hi, map.base, bx.x0, bx.x1, bx.y0, bx.y1, W, chainSig[nSteps()]].join('|');
    const memo = sceneMemos.get(key);
    if (memo) return memo;
    const pcs = Funcs.sheetMapPieces(S.steps, built, map);
    if (!pcs) return null;
    const K = Funcs.sheetMapCombos(S.steps, built, map, W), radix = pcs.map((e) => (e.n > 0 ? e.n : 2 * W + 1));
    let own = 0, r = 1;
    pcs.forEach((e, i) => { if (e.n <= 0) own += W * r; r *= radix[i]; });
    const last = pcs.length - 1, below = radix.slice(0, last).reduce((a, b) => a * b, 1);
    const rank = (k) => {
      if (last < 0) return 0;
      const d = Math.floor(k / below) % radix[last], off = pcs[last].n > 0 ? Math.min(d, pcs[last].n - d) : Math.abs(d - W);
      return off;
    };
    const g = (k, zc, z) => {
      try { const f = Funcs.sheetMapEval(S.steps, built, map, zc, z, k, W); return CX.isFin(f) ? f : null; } catch (e) { return null; }
    };
    // The distinct surfaces: digits that give the same function (a rational path exponent repeats a sheet) count once, the one nearest the
    // frame's own sheet standing for them; two are the same when their values agree at SAME_PTS places of the box, each read on its own cell
    const same = (a, b) => CX.abs(CX.sub(a, b)) <= SCN.SAME_V * (1 + CX.abs(a));
    const probe = [];
    for (let j = 0; j < SCN.SAME_PTS; j++) for (let i = 0; i < SCN.SAME_PTS; i++) probe.push(C(bx.x0 + (bx.x1 - bx.x0) * (i + 0.5) / SCN.SAME_PTS, bx.y0 + (bx.y1 - bx.y0) * (j + 0.5) / SCN.SAME_PTS));
    const vals = Array.from({ length: K }, (_, k) => probe.map((z) => g(k, z, z)));
    const ks = [];
    Array.from({ length: K }, (_, k) => k).sort((a, b) => rank(a) - rank(b) || a - b).forEach((k) => {
      if (!ks.some((q) => vals[q].every((v, i) => (v && vals[k][i] ? same(v, vals[k][i]) : v === vals[k][i])))) ks.push(k);
    });
    let poles = [];
    try { poles = svDrain(svPolesIn(cpuMap(map), bx, SCN.POLE_GRID, bx, { n: 0, at: 0 }, true)) || []; } catch (e) { poles = []; }
    const liveK = (k) => S.steps[k - 1] && S.steps[k - 1].on !== false && built[k - 1] && !built[k - 1].error;
    // The exact poles of a Möbius first step (the steps view's own search is a 16-point grid, which a pole between its points escapes): its path's matrix
    // M(t) has its pole at -M[3] / M[2]; { poles, exact } both: exactPoles, the ones read from the matrix, kept apart so that a control can drop them
    const exactPoles = [];
    {
      const first = Array.from({ length: S.steps.length }, (_, i) => i + 1).find(liveK), bf = first ? built[first - 1] : null, how = first ? Funcs.sheetMapHow(map, first) : 0;
      if (bf && bf.def && bf.def.id === 'mobius' && bf.vals && how && map.mode === 1 && !(map.t <= 0)) {
        const m = [bf.vals.a, bf.vals.b, bf.vals.c, bf.vals.d], path = CX.mobPath(m), M = how === 1 || map.t >= 1 ? m : path ? path(map.t) : null;
        if (M && !CX.isZero(M[2])) {
          const pl = CX.neg(CX.div(M[3], M[2]));
          if (pl.re >= bx.x0 && pl.re <= bx.x1 && pl.im >= bx.y0 && pl.im <= bx.y1) exactPoles.push(pl);
        }
      }
    }
    // Whether the scene's poles are all read: every liveK step the map applies is one whose path has no pole (POLE_FREE: entire at every t > 0, or a branch step
    // whose power is positive), a Möbius first step (its moving pole is above), a Joukowski step (its pole is the origin), or a recognised formula of such
    // steps; any other step may carry poles this scene does not read, and its counts are unresolved
    const stepKinds = (b) => (b.def && b.def.id === 'custom' && b.rec ? b.rec.built.flatMap(stepKinds) : [b.def ? b.def.id : '?']);
    const unread = [], firstLive = Array.from({ length: S.steps.length }, (_, i) => i + 1).find(liveK);
    for (let k = 1; k <= S.steps.length; k++) {
      if (!liveK(k) || !Funcs.sheetMapHow(map, k)) continue;
      const bk = built[k - 1];
      for (const id of stepKinds(bk)) {
        const read = POLE_FREE.includes(id) || id === 'joukowski' || (id === 'mobius' && k === firstLive && bk.vals && CX.mobPath([bk.vals.a, bk.vals.b, bk.vals.c, bk.vals.d]));
        if (!read) unread.push(id);
      }
    }
    if (built.some((b, i) => b && liveK(i + 1) && Funcs.sheetMapHow(map, i + 1) && b.nat && b.nat.kind === 'jouk')) { const o = C(0, 0); if (!poles.some((p) => CX.abs(p) < SCN.SAME_Z)) exactPoles.push(o); }
    for (const q of exactPoles) if (!poles.some((p) => CX.abs(CX.sub(p, q)) < SCN.SAME_Z * (1 + CX.abs(q)))) poles.push(q);
    // The cut of H_u itself: a step with a Joukowski path, alone and last in the map (its input is the z-plane), takes its disk's formula inside
    // the circle |z| = JOUK_R (Funcs.joukInside) and the exterior's outside; cut = { side(inside)(z), R } then, with g of each side
    let cut = null;
    const hiStep = map.mode === 1 ? map.hi : 0, bb = hiStep ? built[hiStep - 1] : null, live = (k) => S.steps[k - 1] && S.steps[k - 1].on !== false && built[k - 1] && !built[k - 1].error;
    if (bb && bb.nat && bb.nat.kind === 'jouk' && K === 1 && !Array.from({ length: hiStep - 1 }, (_, i) => i + 1).some(live) && typeof Funcs.joukAt === 'function') {
      const t = map.t, lc = bb.nat.scaled && bb.natData ? bb.natData.lc : null, kk = lc ? CX.exp(Funcs.natSc(lc, t)) : null;
      cut = { R: Funcs.JOUK_R, side: (inside) => { const J = Funcs.joukAt(t, inside); return (z) => { const v = J(z); return v && CX.isFin(v) ? (kk ? CX.mul(kk, v) : v) : null; }; } };
    }
    // The kind of a branch point of H_u, from the catalogue's steps the map applies at its time t: 'log' when a piece is a log taken in full
    // (t = 1) or a power whose exponent 1 + (alpha - 1) t has no positive real part (G is unbounded at the branch point), else 'algebraic' (roots,
    // powers with a positive real exponent, the Joukowski path: G stays finite)
    const kindScene = pcs.some((e) => {
      const st = built[e.k - 1], id = st && st.def && st.def.id;
      if (id === 'log') return !(map.t < 1);
      if (id === 'powa') { const a = st.vals.alpha, ex = C(1 + (a.re - 1) * map.t, a.im * map.t); return !(ex.re > 0); }
      return false;
    }) ? 'log' : 'algebraic';
    // The input of each branch step: { poles, f }, f(k, zc, z) the map's steps before that step applied to z on surface k from the cell centred at zc,
    // minus the step's branch point (0 for log, root, powa and a power with a cut of its own on the integer exponent at 0 < t < 1; the centre of
    // a (z - c)^n path), poles the input's poles (svPolesIn on the map of the steps before it). The branch point is where f is 0; the leaf's loop winds it
    // exactly when the branch point is inside, whatever the size of the step's cut jump
    const bpts = pcs.filter((e) => { const st = built[e.k - 1], id = st && st.def && st.def.id; return id === 'log' || id === 'root' || id === 'powa'; }).map((e) => ({ k: e.k, node: C(0, 0) }));
    if (map.t > 0 && map.t < 1) {
      for (let k = 1; k <= S.steps.length; k++) {
        const bb = built[k - 1];
        if (!live(k) || Funcs.sheetMapHow(map, k) !== 2) continue;
        if (bb.def && bb.def.id === 'pown' && (bb.vals.n >= 0 || map.t < 0.5)) bpts.push({ k, node: C(0, 0) });
        else if (bb.nat && bb.nat.kind === 'pow' && bb.natData) bpts.push({ k, node: bb.natData.c });
      }
    }
    // The global cut of a power path inside a recognised formula (a chain of steps, at 0 < t < 1 the step the time falls in runs its own path, the
    // principal power z^(1 + (n - 1)s)): the negative real axis of that step's argument, a ray from its centre along -x when the step is the formula's
    // first and no live step comes before the formula. rays[]: { x, y } the ray's end, also a branch point; rayBlind: such a path lies where its argument
    // is not the z-plane, so its cut is a curve this scene does not read
    const rays = [];
    let rayBlind = false;
    if (map.t > 0 && map.t < 1) {
      for (let k = 1; k <= S.steps.length; k++) {
        const bb = built[k - 1];
        if (!live(k) || Funcs.sheetMapHow(map, k) !== 2 || !(bb.def && bb.def.id === 'custom' && bb.rec)) continue;
        const subs = bb.rec.built, x = map.t * subs.length, j = Math.min(subs.length - 1, Math.floor(x)), sb = subs[j];
        if (!(x - j > 0) || !sb) continue;
        const pw = sb.nat && sb.nat.kind === 'pow' && sb.natData ? sb.natData.c : sb.def && sb.def.id === 'pown' ? C(0, 0) : null;
        if (!pw) continue;
        if (j > 0 || Array.from({ length: k - 1 }, (_, i) => i + 1).some(live)) rayBlind = true;
        else { rays.push({ x: pw.re, y: pw.im }); bpts.push({ k, node: pw }); }
      }
    }
    const inputs = bpts.filter((e, i, a) => a.findIndex((x) => x.k === e.k && CX.abs(CX.sub(x.node, e.node)) === 0) === i).map((e) => {
      let ip = [];
      try { ip = e.k > 1 ? svDrain(svPolesIn(cpuMap({ mode: 0, a: 0, b: e.k - 1 }), bx, SCN.POLE_GRID, bx, { n: 0, at: 0 }, true)) || [] : []; } catch (er) { ip = []; }
      return { poles: ip, f: (kk, zc, z) => { try { const f = Funcs.sheetMapEval(S.steps.slice(0, e.k - 1), built.slice(0, e.k - 1), map, zc, z, kk, W); return CX.isFin(f) ? CX.sub(f, e.node) : null; } catch (er) { return null; } } };
    });
    // The exact zeros of the branch steps' inputs (where a branch step's input meets its node) in the box, read from the definitions of the steps before it;
    // zerosUnread lists the chains it cannot read, which fail loudly
    const exactZeros = [], zerosUnread = [];
    for (const e of bpts.filter((q, i, a) => a.findIndex((x) => x.k === q.k && CX.abs(CX.sub(x.node, q.node)) === 0) === i)) {
      const before = [];
      for (let j = 1; j < e.k; j++) {
        if (!liveK(j) || !Funcs.sheetMapHow(map, j)) continue;
        const bj = built[j - 1], id = bj.def ? bj.def.id : '?';
        before.push({ id, m: id === 'mobius' && bj.vals ? [bj.vals.a, bj.vals.b, bj.vals.c, bj.vals.d] : null });
      }
      const z = zeroOf(before, e.node);
      if (z === 'unread') zerosUnread.push(before.map((s) => s.id).join('>') + '>' + (built[e.k - 1].def ? built[e.k - 1].def.id : '?'));
      else if (z && z.re >= bx.x0 && z.re <= bx.x1 && z.im >= bx.y0 && z.im <= bx.y1) exactZeros.push({ k: e.k, z });
    }
    // The zeros of the inputs of the branch steps past the glide's span (the lift the frame's height is read from): pulled back with the glide's own step at
    // its progress, a Möbius through M(t) and not the end matrix; a non-Möbius step before the branch step, or two steps, is unread
    const liftZeros = [], liftUnread = [];
    if (map.mode === 1 && map.hi >= 1) {
      for (let k = map.hi + 1; k <= S.steps.length; k++) {
        const bk = built[k - 1], idk = bk && bk.def ? bk.def.id : '?';
        if (!liveK(k) || !(idk === 'log' || idk === 'root' || idk === 'powa' || idk === 'pown')) continue;
        const before = [];
        for (let j = 1; j < k; j++) {
          if (!liveK(j)) continue;
          const bj = built[j - 1], id = bj.def ? bj.def.id : '?', m = id === 'mobius' && bj.vals ? [bj.vals.a, bj.vals.b, bj.vals.c, bj.vals.d] : null;
          const path = m ? CX.mobPath(m) : null, at = j === map.hi && map.t < 1 ? (path ? path(map.t) : null) : m;
          before.push({ id, m: id === 'mobius' && !at ? null : at });
        }
        const z = zeroOf(before, C(0, 0));
        if (z === 'unread') liftUnread.push(before.map((s) => s.id).join('>') + '>' + idk);
        else if (z && z.re >= bx.x0 && z.re <= bx.x1 && z.im >= bx.y0 && z.im <= bx.y1) liftZeros.push({ k, z });
      }
    }
    const scene = { key, map, W, K, exactZeros, zerosUnread, liftZeros, liftUnread, own, rank, g, ks, inputs, rays, rayBlind, exactPoles, polesUnread: unread, box: bx, poles, cut, kindScene, leaves: null };
    sceneMemos.set(key, scene);
    if (sceneMemos.size > SCENE_MEMO) sceneMemos.delete(sceneMemos.keys().next().value);
    return scene;
  };
  const argd = (a, b) => Math.atan2(a.re * b.im - a.im * b.re, a.re * b.re + a.im * b.im);
  const cmax = (z) => Math.max(1, CX.abs(z));
  // the loop round a rectangle r, counter-clockwise from its lower left corner: its four edges as pieces t -> z, t in [0, 1]
  const rectLoop = (r) => {
    const P = [C(r.x0, r.y0), C(r.x1, r.y0), C(r.x1, r.y1), C(r.x0, r.y1)];
    return P.map((a, e) => { const b = P[(e + 1) % 4]; return (t) => C(a.re + (b.re - a.re) * t, a.im + (b.im - a.im) * t); });
  };
  // The loops round the two parts of a rectangle r that the circle |z| = R cuts: { inside, outside }, each a list of closed loops, a loop a list
  // of pieces t -> z, t in [0, 1]; null when the circle does not cross r. The part inside the circle is walked counter-clockwise (its arcs
  // counter-clockwise), the part outside too (its arcs clockwise). An edge's crossing at a corner is a corner.
  const cutLoops = (R, r) => {
    const P = [C(r.x0, r.y0), C(r.x1, r.y0), C(r.x1, r.y1), C(r.x0, r.y1)], hits = [];
    for (let e = 0; e < 4; e++) {
      const a = P[e], d = CX.sub(P[(e + 1) % 4], a), dd = d.re * d.re + d.im * d.im, ad = a.re * d.re + a.im * d.im, disc = ad * ad - dd * (a.re * a.re + a.im * a.im - R * R);
      if (disc <= 0) continue;
      for (const sg of [-1, 1]) {
        const tt = (-ad + sg * Math.sqrt(disc)) / dd;
        if (tt > SCN.CUT_EDGE && tt < 1 - SCN.CUT_EDGE) { const z = C(a.re + d.re * tt, a.im + d.im * tt); hits.push({ s: e + tt, z, ang: Math.atan2(z.im, z.re) }); }
      }
    }
    if (hits.length < 2) return null;
    hits.sort((p, q) => p.s - q.s);
    const inDisk = (z) => z.re * z.re + z.im * z.im < R * R;
    // (the boundary between hit i and the next: the corners on the way, its midpoint's side)
    const bpieces = hits.map((h, i) => {
      const n = hits[(i + 1) % hits.length], pts = [h.z];
      let e = Math.floor(h.s) + 1;
      const end = n.s > h.s ? n.s : n.s + 4;
      for (; e <= Math.floor(end - 1e-12); e++) pts.push(P[e % 4]);
      pts.push(n.z);
      const len = pts.slice(1).reduce((a, q, j) => a + CX.abs(CX.sub(q, pts[j])), 0), at = (t) => {
        let m = t * len;
        for (let j = 1; j < pts.length; j++) { const l = CX.abs(CX.sub(pts[j], pts[j - 1])); if (m <= l || j === pts.length - 1) { const f = l ? Math.min(1, m / l) : 0; return C(pts[j - 1].re + (pts[j].re - pts[j - 1].re) * f, pts[j - 1].im + (pts[j].im - pts[j - 1].im) * f); } m -= l; }
        return pts[pts.length - 1];
      };
      return { from: h, to: n, f: at, inside: inDisk(at(0.5)) };
    });
    const byAng = hits.slice().sort((p, q) => p.ang - q.ang), inR = (z) => z.re >= r.x0 && z.re <= r.x1 && z.im >= r.y0 && z.im <= r.y1;
    const arcs = [];   // counter-clockwise arcs of the circle inside r, from hit a to hit b
    byAng.forEach((a, i) => {
      const b = byAng[(i + 1) % byAng.length], span = b.ang > a.ang ? b.ang - a.ang : b.ang - a.ang + 2 * Math.PI, mid = a.ang + span / 2;
      if (inR(C(R * Math.cos(mid), R * Math.sin(mid)))) arcs.push({ from: a, to: b, f: (t) => C(R * Math.cos(a.ang + span * t), R * Math.sin(a.ang + span * t)) });
    });
    const arcFrom = (h, rev) => arcs.find((a) => (rev ? a.to : a.from) === h);
    const loopsOf = (inside) => {
      const out = [], used = new Set(), mine = bpieces.filter((b) => b.inside === inside);
      for (const start of mine) {
        if (used.has(start)) continue;
        const loop = [];
        let cur = start;
        for (let guard = 0; cur && !used.has(cur) && guard < 64; guard++) {
          used.add(cur); loop.push(cur.f);
          const end = cur.to, arc = arcFrom(end, !inside);
          if (!arc) return null;
          loop.push(inside ? arc.f : (t) => arc.f(1 - t));
          cur = mine.find((b) => b.from === (inside ? arc.to : arc.from));
        }
        out.push(loop);
      }
      return out;
    };
    const inside = loopsOf(true), outside = loopsOf(false);
    return inside && outside && inside.length + outside.length > 0 ? { inside, outside } : null;
  };
  // the sum of the arguments' turns of g(z) - w along the piece f (t in [0, 1]) with steps of at most ARG; control(v, nv) bounds a step's size
  // by the values' change as well. { sum, on, bad }
  const windOpen = (g, f, w, control, minStep = SCN.MIN_STEP) => {
    let t = 0, h = 1 / SCN.SEG, v = g(f(0)), sum = 0, on = false;
    if (!v) return { bad: true };
    if (CX.abs(CX.sub(v, w)) < SCN.ON * (1 + CX.abs(w))) on = true;
    while (t < 1) {
      const t1 = Math.min(1, t + h), nv = g(f(t1));
      if (nv && control(v, nv)) {
        sum += argd(CX.sub(v, w), CX.sub(nv, w));
        if (CX.abs(CX.sub(nv, w)) < SCN.ON * (1 + CX.abs(w))) on = true;
        v = nv; t = t1; h = Math.min(h * 2, 1 / SCN.SEG);
        continue;
      }
      h /= 2;
      if (h < minStep) return { bad: true, on };
    }
    return { sum, on, bad: false };
  };
  // a cut leaf (the circle crosses it) whose two parts' loops can be walked with g's values finite and changing by steps of at most REL
  const cutLeaf = (sc, r) => {
    const loops = cutLoops(sc.cut.R, r);
    if (!loops) return null;
    const rel = (v, nv) => CX.abs(CX.sub(nv, v)) <= SCN.REL * (CX.abs(v) + CX.abs(nv) + 1e-12);
    for (const [side, set] of /** @type {[boolean, any[]][]} */ ([[true, loops.inside], [false, loops.outside]])) {
      const g = sc.cut.side(side);
      for (const loop of set) for (const f of loop) if (windOpen(g, f, C(0, 0), (v, nv) => rel(v, nv)).bad) return null;
    }
    return loops;
  };
  // TEMP-DEBUG-HOOK

  // TEMP-DEBUG-HOOK (removed before publishing)
  // (the test hooks go on: a further block, as t_publish caps a block's length)
  // the state of a rectangle r as a leaf of the scene: 'closed' (every surface's value runs round r's loop in steps of at most REL, no branch step's
  // input winds round 0 or comes near it, and r holds no pole of a branch step's input: the winding of H_u - w then counts the pairs in r), 'crossed' (a branch
  // step's input runs round the loop with winding 0 yet reaches the ray opposite its value at the centre, where the anchored surface jumps: not a
  // leaf that can be counted) or 'branch'. opts.noInputs, opts.noPoleTest and opts.noContinuity leave the inputs, the poles and the continuity out of the test
  const leafState = (sc, r, opts = {}) => {
    const c = C((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2);
    let crossed = false;
    for (const k of sc.ks) {
      const g = (z) => sc.g(k, c, z), vc = g(c);
      if (!vc) return 'branch';
      const rel = (v, nv) => CX.abs(CX.sub(nv, v)) <= SCN.REL * (CX.abs(CX.sub(v, vc)) + CX.abs(CX.sub(nv, vc)) + SCN.CLOSE * cmax(vc));
      if (!opts.noContinuity) for (const f of rectLoop(r)) if (windOpen(g, f, C(0, 0), rel).bad) return 'branch';
      if (opts.noInputs) continue;
      for (const inp of sc.inputs) {
        const u = (z) => inp.f(k, c, z), u0 = u(c);
        if (!u0) return 'branch';
        // (the turn of the input's argument from its value at the centre, summed along the loop: its end is the winding, and |turn| reaching
        // pi means the loop meets the ray opposite the centre's value, the local cut)
        let sum = 0, turn = 0, reach = 0;
        const ctl = (v, nv) => {
          if (!(CX.abs(CX.sub(nv, v)) <= SCN.REL * (CX.abs(v) + CX.abs(nv)))) return false;
          turn += argd(v, nv);
          reach = Math.max(reach, Math.abs(turn));
          return true;
        };
        const first = u(rectLoop(r)[0](0));
        if (!first) return 'branch';
        turn = argd(u0, first);
        for (const f of rectLoop(r)) {
          const wd = windOpen(u, f, C(0, 0), ctl);
          if (wd.bad || wd.on) return 'branch';
          sum += wd.sum;
        }
        if (Math.abs(sum) > Math.PI) return 'branch';
        if (reach >= Math.PI) crossed = true;
      }
    }
    // (a pole of a branch step's input is inside: the winding of the input counts its zeros less its poles)
    if (!opts.noPoleTest && sc.inputs.some((inp) => inp.poles.some((p) => p.re >= r.x0 && p.re < r.x1 && p.im >= r.y0 && p.im < r.y1))) return 'branch';
    return crossed ? 'crossed' : 'closed';
  };
  // the leaves of the box: a quadtree cut until the continuation of every surface round a leaf returns to its own value (no branch point
  // inside), at most DEPTH_MAX deep; a leaf that still does not close is a branch leaf. [{ x0, x1, y0, y1, c, closed, poles }]
  const sceneLeaves = (sc) => {
    if (sc.leaves) return sc.leaves;
    const out = [], b = sc.box, n0 = 1 << SCN.DEPTH0;
    // (the circle of H_u's own cut crosses the rectangle: the leaf is a cut leaf whatever the size of the jump)
    const crosses = (r) => {
      if (!sc.cut) return false;
      const nx = Math.min(Math.max(0, r.x0), r.x1), ny = Math.min(Math.max(0, r.y0), r.y1);
      const far = Math.max(...[[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]].map(([x, y]) => Math.hypot(x, y)));
      return Math.hypot(nx, ny) < sc.cut.R && sc.cut.R < far;
    };
    // (the global cut of a custom power path runs through the rectangle: its parts above and below the ray, each closed on its own, are the leaf's
    // parts; the ray's end inside the rectangle, or a part that does not close, cuts the rectangle further)
    const rayParts = (r) => {
      if (sc.noTest && sc.noTest.noRay) return null;
      const ry = sc.rays.find((q) => q.y > r.y0 && q.y < r.y1 && r.x0 < q.x);
      if (!ry) return null;
      if (r.x1 > ry.x) return 'split';
      const parts = [{ x0: r.x0, x1: r.x1, y0: ry.y + SCN.RAY_LIP, y1: r.y1 }, { x0: r.x0, x1: r.x1, y0: r.y0, y1: ry.y - SCN.RAY_LIP }];
      return parts.every((q) => leafState(sc, q, sc.noTest) === 'closed') ? parts : 'split';
    };
    const cut = (r, d) => {
      const rp = rayParts(r), x = crosses(r), two = x ? cutLeaf(sc, r) : null;
      const st = x || rp ? 'branch' : leafState(sc, r, sc.noTest), ok = st === 'closed' || Array.isArray(rp);
      if (ok || two || d >= SCN.DEPTH_MAX || out.length >= SCN.LEAF_MAX) {
        out.push(Object.assign({ c: C((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2), closed: ok, crossed: st === 'crossed', two, parts: Array.isArray(rp) ? rp : null, poles: sc.poles.filter((p) => p.re >= r.x0 && p.re < r.x1 && p.im >= r.y0 && p.im < r.y1) }, r));
        return;
      }
      const mx = r.x0 + (r.x1 - r.x0) * SCN.SPLIT, my = r.y0 + (r.y1 - r.y0) * SCN.SPLIT;
      for (const [x0, x1] of [[r.x0, mx], [mx, r.x1]]) for (const [y0, y1] of [[r.y0, my], [my, r.y1]]) cut({ x0, x1, y0, y1 }, d + 1);
    };
    const line = (i) => (i === 0 ? 0 : i === n0 ? 1 : i / n0 + SCN.JIT);
    for (let j = 0; j < n0; j++) for (let i = 0; i < n0; i++) {
      cut({ x0: b.x0 + (b.x1 - b.x0) * line(i), x1: b.x0 + (b.x1 - b.x0) * line(i + 1), y0: b.y0 + (b.y1 - b.y0) * line(j), y1: b.y0 + (b.y1 - b.y0) * line(j + 1) }, SCN.DEPTH0);
    }
    return (sc.leaves = out);
  };
  // the kind of a branch leaf's point: the scene's (sc.kindScene, from the steps the map applies) is the classifier; the values at a fixed rim
  // point as the rim shrinks about the leaf's centre are a cross-check (the change over the second half of the SHRINK rings at most CONV times
  // the first half's: converging), and a leaf where they disagree with the scene's 'algebraic' is 'disagree', which is reported as a failure.
  // 'algebraic', 'log' or 'disagree'
  const leafKind = (sc, l) => {
    if (l.kind) return l.kind;
    const at = (q, k) => { const f = Math.pow(0.5, q); return sc.g(k, C(l.c.re - (l.x1 - l.x0) / 2 * f, l.c.im - (l.y1 - l.y0) / 2 * f), C(l.c.re - (l.x1 - l.x0) / 2 * f, l.c.im - (l.y1 - l.y0) / 2 * f)); };
    const h = SCN.SHRINK / 2;
    l.kind = 'algebraic';
    for (const k of sc.ks) {
      const a = at(0, k), b = at(h, k), c = at(SCN.SHRINK, k);
      if (!a || !b || !c) { l.kind = 'log'; break; }
      const d1 = CX.abs(CX.sub(b, a)), d2 = CX.abs(CX.sub(c, b));
      if (d2 > SCN.CONV * d1 && d2 > SCN.CLOSE * cmax(c)) { l.kind = 'log'; break; }
    }
    l.numeric = l.kind;
    l.kind = sc.kindScene === 'log' ? 'log' : l.numeric === 'log' ? 'disagree' : 'algebraic';
    return l.kind;
  };
  const leafOf = (sc, z) => sceneLeaves(sc).find((l) => z.re >= l.x0 && z.re <= l.x1 && z.im >= l.y0 && z.im <= l.y1) || null;
  // the surfaces of H_u at z on the cell centred at zc, nearest w first: [{ k, miss }], miss the relative |H_u(z) - w|
  const sceneMiss = (sc, w, zc, z) => {
    const out = [];
    for (const k of sc.ks) {
      const h = sc.g(k, zc, z);
      if (h) out.push({ k, miss: CX.abs(CX.sub(h, w)) / (1 + CX.abs(w)) });
    }
    return out.sort((p, q) => p.miss - q.miss);
  };
  // the candidate z's surface on the leaf's cell: the one within CERT of w and clearly nearest (the next at least TIE times as far); null otherwise
  const sceneCertify = (sc, w, z) => {
    const l = leafOf(sc, z), m = sceneMiss(sc, w, l && l.closed ? l.c : z, z);
    return m.length && m[0].miss <= SCN.CERT && (m.length === 1 || m[0].miss * SCN.TIE <= m[1].miss) ? { k: m[0].k, miss: m[0].miss, miss2: m.length > 1 ? m[1].miss : Infinity, leaf: l } : null;
  };
  // The scene's members at probe places w ([re, im] each): per place the certified candidates of __cmwLandEnum (one per z and surface, the
  // frame's own sheet first) [{ z, f, h, k, own, rank, front, miss }]. own: the member is on the frame's own sheet at its own cell (zc = z);
  // front marks the one member the frame draws with sheets off: the own-sheet member nearest the camera, or with none the nearest sheet's.
  // window.__cmwLandRejected is the number of candidates of the last call that no surface certified. Null when the frame has no scene
  window.__cmwLandMembers = (pts) => {
    const sc = sceneOf(), ens = window.__cmwLandEnum(pts), fl = render3D.floor, bx = render3D.box;
    if (!sc || !ens || !fl || !fl.info) return null;
    const info = fl.info, depth = (m) => {
      const c = GLR.M4.apply(info.MVP, [(2 * (m.z[0] - bx.x0) / (bx.x1 - bx.x0) - 1) * info.aspect[0], (2 * (m.z[1] - bx.y0) / (bx.y1 - bx.y0) - 1) * info.aspect[1], m.h]);
      return c[2] / c[3];
    };
    let rejectedAll = 0;
    const res = pts.map((w, i) => {
      const wc = C(w[0], w[1]), out = [];
      let rejected = 0;
      for (const m of ens[i]) {
        const z = C(m.z[0], m.z[1]), cert = sceneCertify(sc, wc, z);
        if (!cert) { rejected++; continue; }
        if (out.some((x) => x.k === cert.k && Math.hypot(x.z[0] - m.z[0], x.z[1] - m.z[1]) <= SCN.SAME_Z * (1 + Math.hypot(m.z[0], m.z[1])))) continue;
        const at = sceneMiss(sc, wc, z, z), own = at.length > 0 && at[0].k === sc.own && at[0].miss <= SCN.CERT;
        out.push({ z: m.z, f: m.f, h: m.h, k: cert.k, own, rank: sc.rank(cert.k), miss: cert.miss, miss2: cert.miss2, member: m.member, src: m.sheet, lvl: m.lvl, cell: cert.leaf && cert.leaf.closed ? [cert.leaf.c.re, cert.leaf.c.im] : m.z });
      }
      // (window.__cmwLandFarFront, a control: the farthest member marked front instead of the nearest)
      const far = !!window.__cmwLandFarFront, front = out.reduce((best, m) => (!best || (far ? m.rank > best.rank || (m.rank === best.rank && depth(m) > depth(best)) : m.rank < best.rank || (m.rank === best.rank && depth(m) < depth(best))) ? m : best), null);
      if (front) front.front = true;
      out.sort((p, q) => (q.front ? 1 : 0) - (p.front ? 1 : 0));
      rejectedAll += rejected;
      return out;
    });
    window.__cmwLandRejected = rejectedAll;
    return res;
  };
  // the range ramp (pixels) the inverse admits members outside a sheet's window by: a member's lvl is at least -RAMP
  window.__cmwLandRamp = () => Inverse.RAMP;
  // the frame's homotopy H_u at a point z of plane 0 on every surface of the scene, evaluated on the cell centred at cell ([re, im]; z when
  // omitted): [{ sheet: k, H: [re, im] | null, dH: [re, im] | null, exactD }]; dH is a central difference over HOM_DZ in z at the same cell, exactD false
  const HOM_DZ = 1e-6;
  // opts: sheets, the surfaces to read (an array of k; default all K), and dH, false for no central difference (default true: three evaluations per
  // surface; one without). __cmwLandHomMany(list) answers a list of [z, cell, opts] in one call
  window.__cmwLandHom = (z, cell, opts) => {
    const sc = sceneOf();
    if (!sc) return null;
    const zc = C(z[0], z[1]), cc = cell ? C(cell[0], cell[1]) : zc, wantD = !opts || opts.dH !== false, ks = opts && opts.sheets ? opts.sheets : null, out = [];
    const a = wantD ? C(z[0] + HOM_DZ, z[1]) : null, b = wantD ? C(z[0] - HOM_DZ, z[1]) : null;
    for (let i = 0, n = ks ? ks.length : sc.K; i < n; i++) {
      const k = ks ? ks[i] : i, h = sc.g(k, cc, zc), ha = wantD ? sc.g(k, cc, a) : null, hb = wantD ? sc.g(k, cc, b) : null;
      out.push({ sheet: k, H: h ? [h.re, h.im] : null, dH: ha && hb ? [(ha.re - hb.re) / (2 * HOM_DZ), (ha.im - hb.im) / (2 * HOM_DZ)] : null, exactD: false });
    }
    return out;
  };
  const BATCH_MAX = 2000;   // (the entries of one __cmwLandHomMany call: its reply crosses the debugging protocol in one message)
  window.__cmwLandHomMany = (list) => {
    if (list.length > BATCH_MAX) throw new Error('__cmwLandHomMany: ' + list.length + ' entries, at most ' + BATCH_MAX);
    return list.map(([z, cell, opts]) => window.__cmwLandHom(z, cell, opts));
  };
  // the scene's leaf holding z ([re, im]) and the cell the scene reads there: { c: [re, im] | null, closed, x0, x1, y0, y1 } (c the leaf's centre when it is closed,
  // else null: a point reads its own cell); null with no scene or no leaf. __cmwLandCellsAt answers a list of z, at most CELLS_MAX, in one call
  const CELLS_MAX = 5000;
  const cellAt = (sc, z) => {
    const l = leafOf(sc, C(z[0], z[1]));
    return l ? { c: l.closed ? [l.c.re, l.c.im] : null, closed: !!l.closed, x0: l.x0, x1: l.x1, y0: l.y0, y1: l.y1 } : null;
  };
  window.__cmwLandCellAt = (z) => { const sc = sceneOf(); return sc ? cellAt(sc, z) : null; };
  window.__cmwLandCellsAt = (list) => {
    if (list.length > CELLS_MAX) throw new Error('__cmwLandCellsAt: ' + list.length + ' places, at most ' + CELLS_MAX);
    const sc = sceneOf();
    return sc ? list.map((z) => cellAt(sc, z)) : null;
  };
  // the argument of the first branch step's input at z, continued from the cell centred at cell (z when omitted) along the straight segment on
  // surface k: { arg, lo, s, bad } with lo the start of the step's window at that cell (the argument at the cell's centre less pi: the anchored cut
  // lies opposite the centre's value) and s = (arg - lo) / 2 pi, in (0, 1] inside the window; principal reads the argument of the input's value at z
  // instead (a control); bad: the input vanishes, has no value, or turns more than pi/2 in one step of the segment. Null when the scene has no branch step
  const STRIP_STEPS = 256;
  window.__cmwLandStrip = (z, cell, k, principal) => {
    const sc = sceneOf();
    if (!sc || !sc.inputs.length) return null;
    const inp = sc.inputs[0], zc = C(z[0], z[1]), cc = cell ? C(cell[0], cell[1]) : zc, u0 = inp.f(k, cc, cc);
    if (!u0 || CX.abs(u0) === 0) return { bad: true };
    let arg = Math.atan2(u0.im, u0.re), prev = u0, bad = false;
    const lo = arg - Math.PI;
    for (let i = 1; i <= STRIP_STEPS; i++) {
      const v = inp.f(k, cc, C(cc.re + (zc.re - cc.re) * i / STRIP_STEPS, cc.im + (zc.im - cc.im) * i / STRIP_STEPS));
      if (!v || CX.abs(v) === 0) return { bad: true };
      const d = argd(prev, v);
      if (Math.abs(d) > Math.PI / 2) bad = true;
      arg += d; prev = v;
    }
    if (principal) arg = Math.atan2(prev.im, prev.re);
    return { arg, lo, s: (arg - lo) / (2 * Math.PI), bad };
  };
  // the scene's plane record: the plane s the glide's carry is built on (the earlier of plane a and the colour plane, or plane 0 when a d/dz step
  // or All sheets lies in the way) and the box its parked frame draws, [x0, x1, y0, y1] from the steps view's own view of
  // that plane (leftView(s)); { s, box }. pl overrides s (for a control that reads another plane's box)
  window.__cmwLandPlane = (pl) => {
    const g = svBetween(), T0 = svT(), e = g.b == null ? g.a : g.b, s0 = Math.min(g.a, T0);
    // (the plane the carry is built on: s0, or plane 0 when All sheets draws a multivalued chain or a d/dz step lies between s0 and a plane the frame reads)
    const s = pl != null ? pl : S.sheets && multiSheet() || [e, T0, svHT(g.a), svHT(e)].some((t) => t > s0 && derivIn(s0, t)) ? 0 : s0, v = leftView(s), b = v && landBox(v);
    return b ? { s, box: [b.x0, b.x1, b.y0, b.y1] } : null;
  };
  // the steps of the map (the glide's, or opts.map) whose poles the scene does not read; empty: every pole is read
  window.__cmwLandPolesUnread = (map) => {
    sceneMapOver = map || null;
    try { const sc = sceneOf(); return sc ? sc.polesUnread.slice() : null; } finally { sceneMapOver = null; }
  };
  // the exact zeros of the branch steps' inputs in the frame's box (the glide's map, or opts map): { zeros: [[re, im, k]], unread: [chain] }; drop: true leaves the list out (a control)
  window.__cmwLandZeros = (map, drop) => {
    sceneMapOver = map || null;
    try { const sc = sceneOf(); return sc ? { zeros: drop ? [] : sc.exactZeros.map((q) => [q.z.re, q.z.im, q.k]), unread: sc.zerosUnread.slice() } : null; } finally { sceneMapOver = null; }
  };
  // the zeros of the branch steps' inputs past the glide's span, with the glide's step at its progress: { zeros: [[re, im, k]], unread: [chain] }; drop as above
  window.__cmwLandLiftZeros = (map, drop) => {
    sceneMapOver = map || null;
    try { const sc = sceneOf(); return sc ? { zeros: drop ? [] : sc.liftZeros.map((q) => [q.z.re, q.z.im, q.k]), unread: sc.liftUnread.slice() } : null; } finally { sceneMapOver = null; }
  };
  // the surfaces of the scene: K digits, and how many of them are distinct functions (the others repeat a sheet)
  window.__cmwLandSurfaces = () => { const sc = sceneOf(); return sc ? { K: sc.K, distinct: sc.ks.length } : null; };
  // the state of the rectangle [x0, x1] x [y0, y1] as a leaf ('closed', 'crossed' or 'branch'); opts: noInputs, noPoleTest, noContinuity (leafState)
  // opts.map: the scene of that map spec ({ mode: 1, base: 0, hi, t }) instead of the glide's
  window.__cmwLandLeafState = (x0, x1, y0, y1, opts) => {
    sceneMapOver = opts && opts.map || null;
    try { const sc = sceneOf(); return sc ? leafState(sc, { x0, x1, y0, y1 }, opts || {}) : null; } finally { sceneMapOver = null; }
  };
  // TEMP-DEBUG-HOOK

  // TEMP-DEBUG-HOOK (removed before publishing)
  // (the test hooks go on: a further block, as t_publish caps a block's length)
  // the scene's singular points over the frame's box: { poles: [[re, im]], branch: [[re, im]] }, the poles the steps view finds on the glide's
  // map and the centres of the leaves no surface closes round (a branch point inside) with their kind, [re, im, 'algebraic' | 'log']
  window.__cmwLandSing = () => {
    const sc = sceneOf();
    return sc ? { poles: sc.poles.map((p) => [p.re, p.im]), branch: sceneLeaves(sc).filter((l) => !l.closed).map((l) => [l.c.re, l.c.im, leafKind(sc, l)]) } : null;
  };
  // the completeness count of the frame's reference at one place w (plane 0's map value): over the leaves of the box, the pairs (z, surface)
  // the winding of H_u - w counts (the sum over surfaces of the winding round the leaf plus its poles, each by its order) against the pairs the
  // certified members make in it. A leaf no surface closes round (a branch point) holds no pair when w is farther from the mean of its boundary
  // values than all of them are (the maximum principle on its cover); a pole in it, or a w that is not, leaves the count unresolved.
  // [{ sheet: 'all', N, P, members, ok, status, leaves, branchLeaves, cutLeaves, bad }]; status 'ok', 'onContour' (w is a value on a leaf contour: the
  // count is undefined there), 'branchLog' (a leaf holds a log-type branch point: G is unbounded in it, so no bound excludes w), 'kindDisagree' (the shrinking rim's values do not converge where the steps say the branch point is algebraic: no enclosure is trusted) or 'unresolved' (a step fell below MIN_STEP, a closed contour did not close, or an unresolved leaf may hold a pair).
  // opts: poleShift moves the exact poles by that much along the imaginary axis, noExactPoles drops the poles read from a Möbius step's matrix, noRay cuts no leaf at the cut of a custom power path, noInputs cuts the leaves without the winding of the branch steps' inputs, noPoleTest without the test for a pole in a closed leaf, noDedupe counts coincident surfaces each, noPoles omits P, dropOne removes a member, cutDelta moves the cut circle's radius for the parts' loops by that much, onContour puts w on a leaf contour, nearContour puts w within NEAR of one with MIN_STEP
  // unreachable
  window.__cmwLandWind = (wIn, opts = {}) => {
    const sc0 = sceneOf();
    if (!sc0) return null;
    // (noInputs: the leaves are cut by the continuity of the surfaces alone, so a leaf that holds a branch point with a tiny cut jump counts as closed)
    const sc = opts.noInputs || opts.noPoleTest || opts.noDedupe || opts.noRay || opts.noExactPoles || opts.poleShift ? Object.assign({}, sc0, { poles: opts.noExactPoles ? sc0.poles.filter((p) => !sc0.exactPoles.includes(p)) : opts.poleShift ? sc0.poles.map((p) => (sc0.exactPoles.includes(p) ? C(p.re, p.im + opts.poleShift) : p)) : sc0.poles, noTest: { noInputs: !!opts.noInputs, noPoleTest: !!opts.noPoleTest, noRay: !!opts.noRay }, ks: opts.noDedupe ? Array.from({ length: sc0.K }, (_, k) => k) : sc0.ks, leaves: null }) : sc0;
    const leaves = sceneLeaves(sc), first = leaves.find((l) => l.closed) || leaves[0];
    let w = wIn ? C(wIn[0], wIn[1]) : null;
    if (opts.onContour || opts.nearContour) {
      const z = C(first.x0, first.y0), v = sc.g(0, z, z);
      w = !v ? w : opts.onContour ? v : CX.add(v, C(SCN.NEAR * cmax(v), 0));
    }
    if (!w) return null;
    const ms = window.__cmwLandMembers([[w.re, w.im]])[0] || [];
    let status = 'ok', N = 0, P = 0, branchLeaves = 0, bad = 0;
    const tally = [];
    const minStep = opts.nearContour ? 1 : SCN.MIN_STEP;
    // (a leaf the cut of a custom power path runs through is counted as its parts, each a closed leaf of its own)
    const units = leaves.flatMap((l) => (l.parts ? l.parts.map((q) => Object.assign({ c: C((q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2), closed: true, two: null, poles: l.poles.filter((p) => p.re >= q.x0 && p.re < q.x1 && p.im >= q.y0 && p.im < q.y1) }, q)) : [l]));
    if (sc.rayBlind || (sc.polesUnread.length && !opts.noPolesCheck)) status = 'unresolved';
    for (const l of units) {
      if (l.two) {
        // (a leaf the circle crosses: each part's loops walked with its own side's formula; the parts' windings and poles add up)
        const loopsTwo = opts.cutDelta ? cutLoops(sc.cut.R + opts.cutDelta, l) || l.two : l.two, relc = (v, nv) => CX.abs(CX.sub(nv, v)) <= SCN.REL * (CX.abs(v) + CX.abs(nv) + 1e-12);
        for (const [side, set] of [[true, loopsTwo.inside], [false, loopsTwo.outside]]) {
          const g = sc.cut.side(side);
          for (const loop of set) {
            let sum = 0;
            let loopOk = true;
            for (const f of loop) {
              const q = windOpen(g, f, w, (v, nv) => Math.abs(argd(CX.sub(v, w), CX.sub(nv, w))) <= SCN.ARG && relc(v, nv), minStep);
              if (q.bad) { loopOk = false; break; }
              sum += q.sum;
              if (q.on) status = 'onContour';
            }
            if (!loopOk) { bad++; status = status === 'ok' ? 'unresolved' : status; continue; }
            const n = sum / (2 * Math.PI);
            if (Math.abs(n - Math.round(n)) > SCN.CLOSE * 1e3) { status = status === 'ok' ? 'unresolved' : status; continue; }
            N += Math.round(n);
          }
          if (!opts.noPoles) {
            for (const p of l.poles.filter((q) => Funcs.joukInside(q) === side)) {
              const at = (r) => { const h = g(C(p.re + r, p.im)); return h ? CX.abs(h) : 0; }, a = at(SCN.POLE_R), b = at(10 * SCN.POLE_R), order = Math.log(a / b) / Math.log(10);
              if (a > SCN.POLE_BIG && order > 0.5) { N += Math.round(order); P += Math.round(order); }
            }
          }
        }
        continue;
      }
      if (!l.closed) {
        branchLeaves++;
        // (a leaf whose input meets the local cut with winding 0 is not one the count can use)
        if (l.crossed) { status = status === 'ok' ? 'unresolved' : status; continue; }
        // (the values of every surface at the leaf's rim and on SHRINK rings each half the one before about its centre, and the largest
        // difference of neighbouring samples: the range the leaf's values are within, widened by LIP times that difference)
        const vals = [];
        let step = 0;
        for (let q = 0; q <= SCN.SHRINK; q++) {
          const f = Math.pow(0.5, q), hx = (l.x1 - l.x0) / 2 * f, hy = (l.y1 - l.y0) / 2 * f;
          const rim = [C(l.c.re - hx, l.c.im - hy), C(l.c.re + hx, l.c.im - hy), C(l.c.re + hx, l.c.im + hy), C(l.c.re - hx, l.c.im + hy)];
          for (const k of sc.ks) {
            let prev = null;
            for (let e = 0; e < 4; e++) for (let t = 0; t < SCN.SEG; t++) {
              const z = C(rim[e].re + (rim[(e + 1) % 4].re - rim[e].re) * t / SCN.SEG, rim[e].im + (rim[(e + 1) % 4].im - rim[e].im) * t / SCN.SEG), v = sc.g(k, z, z);
              if (!v) continue;
              vals.push(v);
              if (prev) step = Math.max(step, CX.abs(CX.sub(v, prev)));
              prev = v;
            }
          }
        }
        const mean = vals.reduce((a, v) => CX.add(a, v), C(0, 0)), vc = C(mean.re / vals.length, mean.im / vals.length);
        const spread = vals.reduce((a, v) => Math.max(a, CX.abs(CX.sub(v, vc))), 0) + SCN.LIP * step;
        const kind = leafKind(sc, l);
        if (kind !== 'algebraic') status = status === 'onContour' ? status : kind === 'log' ? 'branchLog' : 'kindDisagree';
        else if (l.poles.length || !(CX.abs(CX.sub(w, vc)) > spread * (1 + SCN.NEAR))) status = status === 'ok' ? 'unresolved' : status;
        continue;
      }
      for (const k of sc.ks) {
        let sum = 0, on = false, loopOk = true;
        const g = (z) => sc.g(k, l.c, z), vc = g(l.c) || C(0, 0), ctl = (v, nv) => Math.abs(argd(CX.sub(v, w), CX.sub(nv, w))) <= SCN.ARG && CX.abs(CX.sub(nv, v)) <= SCN.REL * (CX.abs(CX.sub(v, vc)) + CX.abs(CX.sub(nv, vc)) + SCN.CLOSE * cmax(vc));
        for (const f of rectLoop(l)) {
          const q = windOpen(g, f, w, ctl, minStep);
          if (q.on) on = true;
          if (q.bad) { loopOk = false; break; }
          sum += q.sum;
        }
        if (on) { status = 'onContour'; continue; }
        if (!loopOk) { bad++; status = status === 'ok' ? 'unresolved' : status; continue; }
        const n = sum / (2 * Math.PI);
        if (Math.abs(n - Math.round(n)) > SCN.CLOSE * 1e3) { status = status === 'ok' ? 'unresolved' : status; continue; }
        N += Math.round(n);
        if (Math.round(n)) tally.push({ k, x: [l.x0, l.x1], y: [l.y0, l.y1], n: Math.round(n) });
        if (!opts.noPoles) {
          for (const p of l.poles) {
            const at = (r) => { const h = sc.g(k, l.c, C(p.re + r, p.im)); return h ? CX.abs(h) : 0; }, a = at(SCN.POLE_R), b = at(10 * SCN.POLE_R), order = Math.log(a / b) / Math.log(10);
            if (a > SCN.POLE_BIG && order > 0.5) { N += Math.round(order); P += Math.round(order); }
          }
        }
      }
    }
    // (a certified member in a branch leaf contradicts the leaf's exclusion of w: the count is unresolved)
    if (ms.some((m) => { const l = leafOf(sc, C(m.z[0], m.z[1])); return l && !l.closed && !l.two; })) status = status === 'ok' ? 'unresolved' : status;
    const mem = ms.filter((m) => { const l = leafOf(sc, C(m.z[0], m.z[1])); return l && (l.closed || l.two); }).length - (opts.dropOne ? 1 : 0);
    return [{ sheet: 'all', N, P, members: mem, ok: status === 'ok' && N === mem, status, leaves: leaves.length, branchLeaves, cutLeaves: leaves.filter((l) => l.two).length, bad, polesUnread: sc.polesUnread, tally, memberLeaves: ms.map((m) => { const l = leafOf(sc, C(m.z[0], m.z[1])); return l ? { x: [l.x0, l.x1], y: [l.y0, l.y1], closed: l.closed } : null; }) }];
  };
  /** @type {any} */ (window).__cmwLPx = (pts) => { const v = paneL.view, d = paneL.dpr, W = paneL.pw, H = paneL.ph, img = paneL.canvas.getContext('2d').getImageData(0, 0, W, H).data; const px = pts.map(([x, y]) => { const i = Math.floor(W / 2 + (x - v.cx) * v.s * d), j = Math.floor(H / 2 - (y - v.cy) * v.s * d); if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1) return null; const out = []; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const n = 4 * ((j + b) * W + i + a); out.push([img[n], img[n + 1], img[n + 2], img[n + 3]]); } return out; }); return { view: { cx: v.cx, cy: v.cy, s: v.s }, dpr: d, pw: W, ph: H, px }; };   // (the left pane's pixels at points of its plane: for each [x, y], the 3 x 3 device pixels around it, [r, g, b, a] each, row by row, or null off the pane; and the view they were read in)
  /** @type {any} */ (window).__cmwSvRing = (builds) => (builds ? [...gpu].reduce((n, [id, r]) => n + (id.startsWith(SV_RING.id) ? r.builds || 0 : 0), svPolarBuilds) : svRingMemo && svRingMemo.ring ? { m: svRingMemo.ring.polar ? svRingMemo.ring.id : svRingMemo.m, c: svRingMemo.ring.c.slice(), r1: svRingMemo.ring.r1, r2: svRingMemo.ring.r2 } : null); Object.defineProperty(window, '__svCarryProbe', { configurable: true, get: () => GLR.carryProbes(), set: (f) => { GLR.carryProbes(f || null); requestRender('L'); } }); /** @type {any} */ (window).__svCarryProbeSettings = { base: {}, cacheOnly: { noFill: true, noKCDraw: true }, noCarry: { noCarry: true }, oldGrid: { oldGrid: true }, noFix: { noFix: true }, noRay: { noRay: true }, mixBeta0: { mixBeta0: true }, mixSwitch: { mixSwitch: true }, clipOff: { clipOff: true }, clipLinear: { clipLinear: true }, noSeam: { noSeam: true } };   // (__cmwSvRing: the steps view's outer ring of carried points, Everywhere (svRingFor): {m (a polar ring's: its id), c, r1, r2} or null; builds: its meshes' builds in all, the polar ones' too. the carry probes, perf's svq units: __svCarryProbe = one of the settings' flags, or null; GLR.carryProbes)
  /** @type {any} */ (window).__cmwSvKey = (b, t, whole) => { const P = t == null ? null : svPoleTracks(b, svSheetKey(b).win); if (P && whole) svPoleMake(P, Infinity, null); const k = t == null ? svSheetKey(b == null ? svStage() : b) : svSheetKeyAt(b, t); return { win: Object.assign({}, k.win), R: k.R, rs: k.rs, sing: (k.sing || []).map((p) => [p.re, p.im]), tracks: P ? { k: P.k, of: SV_POLE_K + 1, seed: P.found ? P.found.j : null } : null, busy: svPoleBusy }; };   // (the steps view's sheet key for plane b (default: shown), as svSheetKey; with t, the glide's (svSheetKeyAt), tracks {k, of, seed}: its pole tracks' next step of t (whole: made whole first) and the seed step a frame's search finished last; busy: the idle job runs)
  /** @type {any} */ (window).__cmwSvFixed = () => svFixDone(); /** @type {any} */ (window).__cmwSvWarm = () => ({ sig: svWarmSig, at: svWarmAt, now: chainSig[nSteps()] }); /** @type {any} */ (window).__cmwSvX = () => SV.g.x;   // (__cmwSvFixed: the carried colour has the tiling's fix-up under its parked map, true with none asked; __cmwSvWarm: svWarmCarry's chain its warm draw was last made for, and when; __cmwSvX: the thread's place alone, cheap enough for a per-frame poll)
  window.__cmwStageBox = () => paneBox(paneL, leftView());
  // the steps view's globe: whether its last frame drew the carried colour and by which path ('inverse' or 'mesh'),
  // and where the point (re, im) of the glide's plane a is at the glide's u (H_u of svBetween; the point itself at
  // rest); H: that map ({re, im} -> {re, im}, the identity at rest); eye and key: the last frame's camera position and
  // key light direction (drawSphere's, world coordinates)
  window.__cmwSvGlobe = (re, im) => {
    const g = svBetween(), z = C(re, im), w = g.H ? g.H(z) : z, si = leftSphereInfo;
    return { carried: !!(si && si.carried), path: (si && si.carryPath) || null, a: g.a, b: g.b, u: g.u, w: w && CX.isFin(w) ? [w.re, w.im] : null, H: g.H || ((q) => q), eye: si ? si.eye : null, key: si ? si.key : null };
  };
  // the steps view's paths: Paths on, the deformation source (svPathsSource), the last frame's moving points (how many,
  // and how far in px the farthest is from H_T(z) of its start z; globeHeads: how many on a globe; globeError: what
  // the globe's paths threw, or null), the selection's size and whether it is this source's; ahead: how many
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
    return { on: S.morphPaths !== false, src: src1, T: d ? d.T : null, heads, globeHeads, globeError, err, kept, ready, ahead: mfAhead.sel === mfCache.sel && !mfAhead.job ? mfAhead.done.size : 0 };
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
  // the steps view: where it is, what it shows; o moves it (go, park, x: the thread's place without the snap to a plane, T,
  // scope, surf, play, loop, order, span, range; bare: the colour layer alone; clock: ms of glide time a frame, 0 the wall
  // clock); glide: the last glide frame's record (svGlideRec)
  /** @type {any} */ (window).__cmwSteps = (o) => { if (o && o.go != null) svGo(o.go, !!o.now); if (o && o.x != null) { SV.g.set(o.x); requestRender('L'); } if (o && 'bare' in o) { SV.bare = !!o.bare; requestRender('L'); } if (o && 'clock' in o) SV.clock = o.clock > 0 ? +o.clock : null; if (o && o.park != null) { SV.g.set(o.park); svLetGo(); } if (o && o.T != null) svSetT(o.T); if (o && o.scope) { SV.scope = o.scope; svSync(); requestRender('L'); } if (o && o.surf) { SV.surf = o.surf; svApply(); } if (o && o.play != null) { o.play ? svPlay() : svPause(true); } if (o && 'loop' in o) svSetLoop(!!o.loop); if (o && o.order) svSetOrder(o.order); if (o && 'span' in o) SV.span = o.span && svAllOk(o.span[0], o.span[1]) ? { x0: o.span[0], x1: o.span[1] } : null; if (o && 'range' in o) { if (o.range) svSetRange(o.range[0], o.range[1], false); else svClearRange(); } return { ready: svReady(), on: SV.on, svSpeed: S.sv ? S.sv.speed : null, homRange: S.homRange ? [S.homRange.a, S.homRange.b] : null, play: !SV.play ? null : SV.play.slide ? 'slide' : 'glide', loop: SV.loop, range: svRange(), i: SV.i, x: SV.g.x, sel: S.sel, all: svBetween().all, between: svBetween().map, span: SV.span ? { x0: SV.span.x0, x1: SV.span.x1 } : null, homAll: !!S.homAll, moving: svMoving(), speed: SV.speed, anim: SV.anim, T: svT(), scope: SV.scope, surf: SV.surf, planes: svPlanes(), stage: leftStage(), main: S.view.main, paint: SV.on ? svPaint() : null, core: SV.core, lColor: lColor(), solo: solo(), focus: S.focus, map: focusMap(), label: svLabel(), names: { title: svTitleParts(), call: svMapCall('text'), key: svKeyName() }, paths: svPathsHook(), glide: svGlideRec, win: (() => { const v = leftView(); return [v.cx, v.cy, v.s]; })() }; };
  // (#363) the regions' display: their fill (always the phase for the user), grid lines, their step, chevrons, opacity
  // the loaded settings and ids, read back plain (a getter: the suites that load a saved state with a key left out or set oddly read what the load made of it)
  /** @type {any} */ (window).__cmwKeys = () => ({ alpha: S.alpha, meshN: S.meshN, nextId: S.nextId, shapeIds: S.shapes.map((s) => s.id), targetIds: S.targets.map((t) => t.id), shapeCi: S.shapes.map((s) => s.ci), shapeColor: S.shapes.map((s) => s.color || null), v3: !!S.v3, v4: !!S.v4, v5: !!S.v5, v6: !!S.v6, focus: S.focus });
  window.__cmwRegions = () => ({ pattern: S.pattern, lines: !!S.lines, patternScale: S.patternScale, chev: !!S.chev, alpha: S.alpha });
  window.__cmwState = () => ({ cam: { yaw: cam.yaw, pitch: cam.pitch, d: cam.dist / CAM3.dist, tx: cam.tx, ty: cam.ty }, camL: { yaw: camL.yaw, pitch: camL.pitch, d: camL.dist / CAML.dist, tx: camL.tx, ty: camL.ty }, mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), dc: S.dc, landPlain: !!S.landPlain, wKey: !!S.wKey, focus: S.focus, morph: { open: morph.open, T: morph.T, playing: morph.playing }, targets: S.targets.length, hov: hov.list ? hov.list.map((r) => [r.z.re, r.z.im, r.mult]) : null, intPop: intPop ? intPop.id : null, sheets: S.sheets, height: S.height, meshN: S.meshN, homView: homView() }); // TEMP-DEBUG-HOOK
