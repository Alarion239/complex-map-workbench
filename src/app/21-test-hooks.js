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
  window.__cmwSphere = () => ({ entries: [...sm.entries.values()].map((e) => ({ key: e.key, slot: e.slot, why: e.why, view: e.view, guardBox: e.guardBox, gpu: !!(e.res && e.res.n), ...e.info })), jobs: [...sm.jobs.values()].map((j) => ({ key: j.key, slot: j.slot, why: j.why, ms: +j.ms.toFixed(1), slices: j.slices, nodes: j.mesh ? j.mesh.nodes : 0 })), want: [...sm.want.entries()], running: sm.running, kick: !!sm.kickT, stats: Object.assign({}, sm.stats), cpuBytes: sm.cpuBytes, preBytes: GLR.preBytes, lastExport: sm.lastExport || null });   // (kick: a frame is still due to ask for the jobs the motion frames could not, smKick)
  // the SphereMesh verdict (SPEC 8.1) of every visible area shape for the right pane's map (12.3: invariant under right-view zooms)
  window.__cmwSmVerdict = (role = 'R') => S.shapes.filter((s) => s.visible !== false && kindType(s) === 'area').map((s) => ({ id: s.id, why: smNeed(s, gpu.get(s.id), role, normalizeMap(stageMap(role === 'SV' ? svStage() : role === 'R' ? rightStage() : leftStage()))) }));
  window.__cmwSmReset = () => { for (const e of [...sm.entries.values()]) smDrop(e); for (const j of [...sm.jobs.values()]) smCancel(j); sm.want.clear(); Object.assign(sm.stats, { built: 0, ms: 0, slices: 0, maxSlice: 0, cancelled: 0, partial: 0 }); requestRender('L', 'R'); return true; };
  // (issue #72) a screen pane's own last GPU frame (glStatusNote): {pending, compiling, error, exact, t}, null before one
  window.__cmwPaneStatus = (role = 'R') => (paneGl[role] ? Object.assign({}, paneGl[role]) : null);
  // the colour plot's stand-in (colourStandIn): the cell of its finest level done (css px; null before one) and its
  // nodes, its evaluations, CPU ms, slices, the first slice and the longest after it (ms) and why it stopped (null while
  // it runs); null when none
  /** @type {any} */ (window).__cmwStandIn = () => { const j = standInJob, g = j && j.grid; return j ? { cell: g ? g.cell : null, nodes: g ? g.nx * g.ny : 0, n: j.n, ms: +j.ms.toFixed(1), slices: j.slices, firstSlice: +j.firstSlice.toFixed(1), maxSlice: +j.maxSlice.toFixed(1), end: j.end } : null; };
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
  // the left key's kind and the caption it draws now (the key is drawn here, so a read never waits for a frame)
  window.__cmwLegend = () => { drawLegend(); return { kind: legendKind('L'), caption: legendState.L.caption || null, ring: legendState.L.ring }; };
  // The camera of the steps view's Landscape (the source plane's view) and its mirror V.left: __cmwLandViews() answers { src, left } ({ cx, cy, s } each, a copy).
  // { zoom: f } runs the app's own zoom of the left plane (zoomPane, the wheel's), about its centre, so the steps view must be showing the plane (not the
  // Landscape); { leftScale } multiplies the mirror's s first (the control: the glide's box does not follow the mirror's history)
  window.__cmwLandViews = (o) => {
    if (o && o.leftScale) V.left.s *= o.leftScale;
    if (o && o.zoom) zoomPane(paneL, 'L', paneL.w / 2, paneL.h / 2, o.zoom);
    return { src: Object.assign({}, S.srcView), left: Object.assign({}, V.left) };
  };
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
  window.__cmwLandSheets = () => ({ drawn: render3D.sheetsInfo || null, shown: sheetsShown(), deformOk: deformSheetsOk(), linear: !!render3D.linear, title: paneTitles().left });
  window.__cmwCutCurves = () => carriedCuts.map((c) => Object.assign({}, c));   // (test/sv_cut_curve_cmd.js)
  window.__cmwCutHandles = () => { const r = paneL.ocanvas.getBoundingClientRect(); return cutHandlesL.map((hd) => ({ step: hd.step, x: r.left + hd.x, y: r.top + hd.y, deg: hd.deg, w: hd.F ? hd.F(hd.q) : null, carried: !!(hd.F || hd.fwd), wz: hd.q ? { re: hd.q.re, im: hd.q.im } : null })); };   // (v16.5 test/ux165_chain_cmd.js)
  // TEMP-DEBUG-HOOK

  // TEMP-DEBUG-HOOK (removed before publishing)
  // (the test hooks go on: a second block, as t_publish caps a block's length)
  /** @type {any} */ (window).__cmwLPx = (pts) => { const v = paneL.view, d = paneL.dpr, W = paneL.pw, H = paneL.ph, img = paneL.canvas.getContext('2d').getImageData(0, 0, W, H).data; const px = pts.map(([x, y]) => { const i = Math.floor(W / 2 + (x - v.cx) * v.s * d), j = Math.floor(H / 2 - (y - v.cy) * v.s * d); if (i < 1 || j < 1 || i >= W - 1 || j >= H - 1) return null; const out = []; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const n = 4 * ((j + b) * W + i + a); out.push([img[n], img[n + 1], img[n + 2], img[n + 3]]); } return out; }); return { view: { cx: v.cx, cy: v.cy, s: v.s }, dpr: d, pw: W, ph: H, px }; };   // (the left pane's pixels at points of its plane: for each [x, y], the 3 x 3 device pixels around it, [r, g, b, a] each, row by row, or null off the pane; and the view they were read in)
  /** @type {any} */ (window).__cmwSvRingMade = (j) => { const P = svPlanes(); let made = 0, left = 0, unbuilt = 0; for (let k = 0; k + 1 < P.length; k++) { if (j != null && k !== j) continue; for (const { key } of svGlideRingKeys(k)) { const m = svRingSizes.get(key); if (m === undefined) left++; else { made++; if (m && m.polar && !svPolarRes.has(svPolarId(m))) unbuilt++; } } } return { made, left, unbuilt, glides: Math.max(0, P.length - 1), polar: svPolarRes.size, sizes: svRingSizes.size }; };   // (__cmwSvRingMade: the ring sizes of every glide of the chain (of glide j alone, given j), made or left, and the made polar ones whose mesh is not built, at the view the frames between planes draw in; the polar meshes kept and the sizes kept)
  /** @type {any} */ (window).__cmwSvRing = (builds) => (builds ? [...gpu].reduce((n, [id, r]) => n + (id.startsWith(SV_RING.id) ? r.builds || 0 : 0), svPolarBuilds) : svRingMemo && svRingMemo.ring ? { m: svRingMemo.ring.polar ? svRingMemo.ring.id : svRingMemo.m, c: svRingMemo.ring.c.slice(), r1: svRingMemo.ring.r1, r2: svRingMemo.ring.r2 } : null); Object.defineProperty(window, '__svCarryProbe', { configurable: true, get: () => GLR.carryProbes(), set: (f) => { GLR.carryProbes(f || null); requestRender('L'); } }); /** @type {any} */ (window).__svCarryProbeSettings = { base: {}, cacheOnly: { noFill: true, noKCDraw: true }, noCarry: { noCarry: true }, oldGrid: { oldGrid: true } };   // (__cmwSvRing: the steps view's outer ring of carried points, Everywhere (svRingFor): {m (a polar ring's: its id), c, r1, r2} or null; builds: its meshes' builds in all, the polar ones' too. the carry probes, perf's svq units: __svCarryProbe = one of the settings' flags, or null; GLR.carryProbes)
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
  // clock; poleFrameMs: a frame's pole search budget; dropTracks: every pole track forgotten); glide: the last glide frame's
  // record (svGlideRec), hold: the plane whose glide waits for its pole tracks (svHoldB), rest: the last plane at rest's (svRestRec)
  /** @type {any} */ (window).__cmwSteps = (o) => { if (o && o.go != null) svGo(o.go, !!o.now); if (o && 'poleFrameMs' in o) SV.poleFrameMs = o.poleFrameMs; if (o && o.dropTracks) svDropTracks(); if (o && o.x != null) { SV.g.set(o.x); requestRender('L'); } if (o && 'bare' in o) { SV.bare = !!o.bare; requestRender('L'); } if (o && 'clock' in o) SV.clock = o.clock > 0 ? +o.clock : null; if (o && o.park != null) { SV.g.set(o.park); svLetGo(); } if (o && o.T != null) svSetT(o.T); if (o && o.scope) { SV.scope = o.scope; svPrestartSoon(300); svSync(); requestRender('L'); } if (o && o.surf) { SV.surf = o.surf; svPrestartSoon(300); svApply(); } if (o && o.play != null) { o.play ? svPlay() : svPause(true); } if (o && 'loop' in o) svSetLoop(!!o.loop); if (o && o.order) svSetOrder(o.order); if (o && 'span' in o) SV.span = o.span && svAllOk(o.span[0], o.span[1]) ? { x0: o.span[0], x1: o.span[1] } : null; if (o && 'range' in o) { if (o.range) svSetRange(o.range[0], o.range[1], false); else svClearRange(); } return { ready: svReady(), on: SV.on, svSpeed: S.sv ? S.sv.speed : null, homRange: S.homRange ? [S.homRange.a, S.homRange.b] : null, play: !SV.play ? null : SV.play.slide ? 'slide' : 'glide', loop: SV.loop, range: svRange(), i: SV.i, x: SV.g.x, sel: S.sel, all: svBetween().all, between: svBetween().map, span: SV.span ? { x0: SV.span.x0, x1: SV.span.x1 } : null, homAll: !!S.homAll, moving: svMoving(), speed: SV.speed, anim: SV.anim, T: svT(), scope: SV.scope, surf: SV.surf, planes: svPlanes(), stage: leftStage(), main: S.view.main, paint: SV.on ? svPaint() : null, core: SV.core, lColor: lColor(), solo: solo(), focus: S.focus, map: focusMap(), label: svLabel(), names: { title: svTitleParts(), call: svMapCall('text'), key: svKeyName() }, paths: svPathsHook(), glide: svGlideRec, hold: svHoldB, rest: svRestRec, restU: SV_REST_U, restUMin: SV_REST_U_MIN, win: (() => { const v = leftView(); return [v.cx, v.cy, v.s]; })() }; };
  // (#363) the regions' display: their fill (always the phase for the user), grid lines, their step, chevrons, opacity
  // the loaded settings and ids, read back plain (a getter: the suites that load a saved state with a key left out or set oddly read what the load made of it)
  /** @type {any} */ (window).__cmwKeys = () => ({ alpha: S.alpha, meshN: S.meshN, nextId: S.nextId, shapeIds: S.shapes.map((s) => s.id), targetIds: S.targets.map((t) => t.id), shapeCi: S.shapes.map((s) => s.ci), shapeColor: S.shapes.map((s) => s.color || null), v3: !!S.v3, v4: !!S.v4, v5: !!S.v5, v6: !!S.v6, focus: S.focus });
  window.__cmwRegions = () => ({ pattern: S.pattern, lines: !!S.lines, patternScale: S.patternScale, chev: !!S.chev, alpha: S.alpha });
  window.__cmwState = () => ({ cam: { yaw: cam.yaw, pitch: cam.pitch, d: cam.dist / CAM3.dist, tx: cam.tx, ty: cam.ty }, camL: { yaw: camL.yaw, pitch: camL.pitch, d: camL.dist / CAML.dist, tx: camL.tx, ty: camL.ty }, mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), dc: S.dc, landPlain: !!S.landPlain, wKey: !!S.wKey, focus: S.focus, morph: { open: morph.open, T: morph.T, playing: morph.playing }, targets: S.targets.length, hov: hov.list ? hov.list.map((r) => [r.z.re, r.z.im, r.mult]) : null, intPop: intPop ? intPop.id : null, sheets: S.sheets, height: S.height, meshN: S.meshN, homView: homView() }); // TEMP-DEBUG-HOOK
