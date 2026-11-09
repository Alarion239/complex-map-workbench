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
  // the frame's homotopy H_u at a point z of plane 0, per sheet (the sheets as __cmwLandEnum takes them): the forward ops of the plan the frame
  // inverts (Inverse.fwdOps), so H(z) is the w the frame draws z at. lam, the member's continued log coordinate (as __cmwLandEnum gives it), makes
  // H the one the frame draws: the plan's first op is a log (its output is lam) or a power u^s (its output is e^(s lam)), taken on the branch lam
  // is on, and the remaining ops are applied to that output instead of to the principal value at z (they differ at a member of the range ramp
  // outside its sheet's window); without lam every op is applied to z. dH is a central difference of H over HOM_DZ in z (the plan's ops carry no
  // derivative), exactD false. [{ sheet, H: [re, im] | null, dH: [re, im] | null, exactD }]
  const HOM_DZ = 1e-6;
  window.__cmwLandHom = (z, lam) => {
    const inp = render3D.exactIn;
    if (!inp) return null;
    const zc = C(z[0], z[1]), lc = lam ? C(lam[0], lam[1]) : null;
    // (the first op's output from the lifted log coordinate; null when that op is neither)
    const first = (o, l) => (o.kind === 'LOG' ? l : o.kind === 'ROOTPOW' ? CX.exp(CX.mul(l, o.p.s)) : null);
    const at = (sh, p, l) => {
      try {
        const o = sh.plan.ops[0], u = l && first(o, l), w = u ? Inverse.fwdOps({ ops: sh.plan.ops.slice(1) }, u) : Inverse.fwdOps(sh.plan, p);
        return CX.isFin(w) ? w : null;
      } catch (e) { return null; }
    };
    // (d lam = dz / z at the continued log)
    const lamAt = (p) => (lc ? CX.add(lc, CX.div(CX.sub(p, zc), zc)) : null);
    return [inp.exact].concat(inp.exact.more || []).map((sh, sheet) => {
      const pa = C(z[0] + HOM_DZ, z[1]), pb = C(z[0] - HOM_DZ, z[1]);
      const w = at(sh, zc, lc), a = at(sh, pa, lamAt(pa)), b = at(sh, pb, lamAt(pb));
      return { sheet, H: w ? [w.re, w.im] : null, dH: a && b ? [(a.re - b.re) / (2 * HOM_DZ), (a.im - b.im) / (2 * HOM_DZ)] : null, exactD: false };
    });
  };
  // the completeness count of the frame's reference: for one place w (plane 0's map value) and each sheet of the frame, the number of
  // preimages of w inside the box that the sheet's homotopy G has, by the winding of G - w around the boundary of the sheet's region R (in
  // the continued log coordinate when the plan's first op is a log or a power, else in z), plus the plan's poles inside R, against the members
  // __cmwLandEnum finds there. [{ sheet, N, P, members, ok, status }]; status 'ok', 'onContour' (w is on the boundary, the count is undefined),
  // 'unresolved' (the winding's step fell below the minimum) or 'cutInR' (a later multivalued op's cut crosses R). opts: noPoles omits P,
  // dropOne removes a member, hMin replaces WIND_H_MIN, onLip puts w on sheet 0's cut lip, nearContour puts w within WIND_NEAR of sheet 0's
  // boundary
  const WIND_ARG = Math.PI / 4, WIND_EPS_R = 1e-6, WIND_D_ON = 1e-9, WIND_H_MIN = 1e-12, WIND_CLOSE = 1e-6, WIND_PERIM = 4096, WIND_NEAR = 1e-4, WIND_SEG0 = 64, WIND_POLE_R = 1e-7, WIND_POLE_BIG = 1e3;
  window.__cmwLandWind = (wIn, opts = {}) => {
    const inp = render3D.exactIn, bx = render3D.box;
    if (!inp || !bx) return null;
    const hMin = opts.hMin == null ? WIND_H_MIN : opts.hMin;
    const sheets = [inp.exact].concat(inp.exact.more || []), TAU2 = 2 * Math.PI;
    const W = bx.x1 - bx.x0, Hh = bx.y1 - bx.y0, Lp = 2 * (W + Hh);
    // (the box boundary counter-clockwise from its bottom-left corner, by arc length s)
    const perim = (s) => {
      s = ((s % Lp) + Lp) % Lp;
      if (s < W) return C(bx.x0 + s, bx.y0);
      if (s < W + Hh) return C(bx.x1, bx.y0 + s - W);
      if (s < 2 * W + Hh) return C(bx.x1 - (s - W - Hh), bx.y1);
      return C(bx.x0, bx.y1 - (s - 2 * W - Hh));
    };
    const first = (o, l) => (o.kind === 'LOG' ? l : o.kind === 'ROOTPOW' ? CX.exp(CX.mul(l, o.p.s)) : null);
    const gAt = (sh, pt) => {
      const o = sh.plan.ops[0], u = pt.lam && first(o, pt.lam);
      const w = u ? Inverse.fwdOps({ ops: sh.plan.ops.slice(1) }, u) : Inverse.fwdOps(sh.plan, pt.z);
      return w;
    };
    const argd = (a, b) => Math.atan2(a.re * b.im - a.im * b.re, a.re * b.re + a.im * b.im);
    // the winding of G - w along a piece t -> {z, lam}, t in [0, 1]: the sum of the wrapped arg steps, each at most WIND_ARG with its midpoint between
    // the ends'; { sum, on, bad }
    const windPiece = (sh, w, f, len) => {
      let sum = 0, on = false;
      const g = (t) => { const v = CX.sub(gAt(sh, f(t)), w); if (!CX.isFin(v)) throw new Error('nonfinite'); if (CX.abs(v) < WIND_D_ON * (1 + CX.abs(w))) on = true; return v; };
      const stack = [];
      for (let i = WIND_SEG0; i > 0; i--) stack.push([(i - 1) / WIND_SEG0, i / WIND_SEG0]);
      while (stack.length) {
        const [t0, t1] = stack.pop(), a = g(t0), b = g(t1), d = argd(a, b), tm = (t0 + t1) / 2, m = g(tm), d1 = argd(a, m), d2 = argd(m, b);
        const ok = Math.abs(d) <= WIND_ARG && Math.abs(d1) <= Math.abs(d) + 1e-12 && Math.abs(d2) <= Math.abs(d) + 1e-12 && d1 * d >= 0 && d2 * d >= 0;
        if (ok) { sum += d; continue; }
        if ((t1 - t0) * len < hMin * len || (t1 - t0) < hMin) return { sum: 0, on, bad: true };
        stack.push([tm, t1], [t0, tm]);
      }
      return { sum, on, bad: false };
    };
    const lamOf = (sh, z) => { const o = sh.plan.ops[0]; return CX.log(z, o.p.theta, o.p.k); };
    return (() => {
      const probe = wIn && !opts.onLip && !opts.nearContour ? C(wIn[0], wIn[1]) : null;
      const ens = window.__cmwLandEnum([wIn || [0, 0]]), out = [];
      sheets.forEach((sh, k) => {
        const o = sh.plan.ops[0], multi = o && (o.kind === 'LOG' || o.kind === 'ROOTPOW');
        let w = probe, status = 'ok', N = 0;
        try {
          // (where the sheet's cut ray leaves the origin: Im lam = hi, the cut lips are Im lam = lo and hi)
          const lo = multi ? o.p.lo : 0, hi = multi ? o.p.hi : 0;
          const zeroIn = bx.x0 < 0 && 0 < bx.x1 && bx.y0 < 0 && 0 < bx.y1;
          // (the perimeter's crossings of the ray, by the jump of the windowed arg between neighbours)
          const cross = [];
          if (multi) {
            let prev = lamOf(sh, perim(0)).im;
            for (let i = 1; i <= WIND_PERIM; i++) {
              const cur = lamOf(sh, perim(Lp * i / WIND_PERIM)).im;
              if (Math.abs(cur - prev) > Math.PI) {
                let a = Lp * (i - 1) / WIND_PERIM, b = Lp * i / WIND_PERIM; const upA = prev > (lo + hi) / 2;
                for (let it = 0; it < 80; it++) { const m = (a + b) / 2; ((lamOf(sh, perim(m)).im > (lo + hi) / 2) === upA ? (a = m) : (b = m)); }
                cross.push({ s: (a + b) / 2, upBefore: upA });
              }
              prev = cur;
            }
          }
          const lip = (r0, r1, im) => (t) => { const lr = r0 + (r1 - r0) * t, z = C(Math.exp(lr) * Math.cos(im), Math.exp(lr) * Math.sin(im)); return { z, lam: C(lr, im) }; };
          const arc = (s0, s1) => (t) => { const z = perim(s0 + (s1 - s0) * t); return { z, lam: multi ? lamOf(sh, z) : null }; };
          const pieces = [];   // [[piece fns...] per component]
          if (!multi) pieces.push([[arc(0, Lp), Lp]]);
          else if (!cross.length) pieces.push([[arc(0, Lp), Lp]]);
          else if (zeroIn) {
            const c0 = cross[0], rc = CX.abs(perim(c0.s)), eps = WIND_EPS_R * Math.hypot(W, Hh), lr = Math.log(rc), le = Math.log(eps);
            pieces.push([[(t) => { const z = perim(c0.s + Lp * t); const l = lamOf(sh, z); return { z, lam: l.im <= lo + 1e-9 && t > 1 - 1e-9 ? C(l.re, hi) : l }; }, Lp], [lip(lr, le, hi), lr - le], [(t) => { const im = hi + (lo - hi) * t; return { z: C(eps * Math.cos(im), eps * Math.sin(im)), lam: C(le, im) }; }, hi - lo], [lip(le, lr, lo), lr - le]]);
          } else {
            // (0 outside the box and the ray through it: each piece of the boundary between two crossings with the lip back along the ray)
            for (let i = 0; i < cross.length; i++) {
              const a = cross[i], b = cross[(i + 1) % cross.length];
              const s1 = b.s > a.s ? b.s : b.s + Lp, ra = Math.log(CX.abs(perim(a.s))), rb = Math.log(CX.abs(perim(b.s)));
              const im = lamOf(sh, perim(a.s + (s1 - a.s) * 1e-9)).im;
              pieces.push([[arc(a.s, s1), s1 - a.s], [lip(rb, ra, im > (lo + hi) / 2 ? hi : lo), Math.abs(rb - ra)]]);
            }
          }
          if (opts.onLip && !multi) { out.push({ sheet: k, N: 0, P: 0, members: 0, ok: true, status: 'noCut' }); return; }
          if (opts.onLip && multi) { for (const lr of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) { const g0 = gAt(sh, { z: C(Math.exp(lr) * Math.cos(hi), Math.exp(lr) * Math.sin(hi)), lam: C(lr, hi) }); if (g0 && CX.isFin(g0)) { w = g0; break; } } }
          if (opts.nearContour) { const z = perim(Lp / 3); w = CX.add(gAt(sh, { z, lam: multi ? lamOf(sh, z) : null }), C(WIND_NEAR, 0)); }
          let total = 0;
          for (const comp of pieces) {
            let sum = 0;
            for (const [f, len] of comp) { const r = windPiece(sh, w, f, len || 1); if (r.on) status = 'onContour'; if (r.bad) status = status === 'ok' ? 'unresolved' : status; sum += r.sum; }
            const n = sum / TAU2;
            if (Math.abs(n - Math.round(n)) > WIND_CLOSE) status = status === 'ok' ? 'unresolved' : status;
            total += Math.round(n);
          }
          N = total;
        } catch (e) { status = String(e.message) === 'nonfinite' ? 'onContour' : 'error: ' + e.message; }
        // (the plan's poles inside the box, each counted by its order: the growth of |G| over WIND_POLE_R and ten times it. A singular point
        // that G does not blow up at is no pole; a pole on the sheet's cut ray is on the contour)
        let P = 0;
        if (!opts.noPoles) {
          try {
            const at = (q, r) => { const z = C(q.re + r, q.im), l = multi ? lamOf(sh, z) : null; return CX.abs(gAt(sh, { z, lam: l })); };
            for (const q of Inverse.singular(sh.plan, bx, ['pole'], 16)) {
              if (!(q.z.re >= bx.x0 && q.z.re <= bx.x1 && q.z.im >= bx.y0 && q.z.im <= bx.y1)) continue;
              const a = at(q.z, WIND_POLE_R), b = at(q.z, 10 * WIND_POLE_R), order = Math.log(a / b) / Math.log(10);
              if (a > WIND_POLE_BIG && order > 0.5) P += Math.round(order);
            }
          } catch (e) { P = 0; }
        }
        const mem = ((ens && ens[0]) || []).filter((m) => m.sheet === k && m.z[0] >= bx.x0 && m.z[0] <= bx.x1 && m.z[1] >= bx.y0 && m.z[1] <= bx.y1 && (!multi || !m.lam || (m.lam[1] > o.p.lo && m.lam[1] <= o.p.hi))).length - (opts.dropOne && k === 0 ? 1 : 0);
        out.push({ sheet: k, N, P, members: mem, ok: status === 'ok' && N + P === mem, status });
      });
      return out;
    })();
  };
  // the range ramp (pixels) the inverse admits members outside a sheet's window by: a member's lvl is at least -RAMP
  window.__cmwLandRamp = () => Inverse.RAMP;
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
