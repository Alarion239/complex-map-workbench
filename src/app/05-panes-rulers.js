  // ---------------- view fitting ----------------
  function robustBox(xs, ys) {
    if (xs.length < 2) return null;
    const q = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];
    const sx = Float64Array.from(xs).sort(), sy = Float64Array.from(ys).sort();
    const full = { x0: sx[0], x1: sx[sx.length - 1], y0: sy[0], y1: sy[sy.length - 1] };
    const rob = { x0: q(sx, 0.01), x1: q(sx, 0.99), y0: q(sy, 0.01), y1: q(sy, 0.99) };
    const pick = (a0, a1, b0, b1) => ((a1 - a0) <= 2.5 * Math.max(b1 - b0, 1e-12) ? [a0, a1] : [b0, b1]);
    const [x0, x1] = pick(full.x0, full.x1, rob.x0, rob.x1);
    const [y0, y1] = pick(full.y0, full.y1, rob.y0, rob.y1);
    const b = { x0, x1, y0, y1 };
    const w = b.x1 - b.x0, hh = b.y1 - b.y0, m = Math.max(w, hh, 1e-9);
    // (review math-9: an image that is a point up to rounding, a constant map, is framed ±1 around it, not zoomed to
    // the rounding scale; the floor is relative to the point, 1e-9 of max(1, |w|))
    const c = Math.max(1, Math.abs((b.x0 + b.x1) / 2), Math.abs((b.y0 + b.y1) / 2));
    if (Math.max(w, hh) < 1e-9 * c) { const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2; return { x0: mx - 1, x1: mx + 1, y0: my - 1, y1: my + 1 }; }
    if (w < m * 0.05) { b.x0 -= m * 0.1; b.x1 += m * 0.1; }
    if (hh < m * 0.05) { b.y0 -= m * 0.1; b.y1 += m * 0.1; }
    return b;
  }
  // CPU samples of what a stage shows, restricted to the part that comes from the visible z-window
  // ([#253] k: the plane sampled; a shape of a later plane is left out, of an earlier one its image is sampled)
  function stageSamples(F0, xs, ys, k, few) { const it = stageSampler(F0, xs, ys, k, few); while (!it.next().done) { /* the samples go to xs, ys */ } }
  // the same, a step at a time: it yields every 16 samples ([#243] a costly fit runs in slices, fitRightSliced); few:
  // an eighth of the samples (a chain card's picture of a costly chain)
  function* stageSampler(F0, xs, ys, k, few) {
    const per = few ? 8 : 1;
    const core = Region.expandBox(clipWin, 1.05);
    const inCore = (x, y) => x >= core.x0 && x <= core.x1 && y >= core.y0 && y <= core.y1;
    let got = 0;
    const push = (w) => { if (CX.isFin(w) && Math.abs(w.re) < 1e9 && Math.abs(w.im) < 1e9) { xs.push(w.re); ys.push(w.im); } return ++got % 16 === 0; };
    for (const s of S.shapes) {
      if (s.visible === false) continue;
      const t = kindType(s);
      // ([v16.5 fix user-3] the curves and points of a construction, and the unit circle or an axis made a shape, are
      // lines to build with: Y's fit follows the user's own shapes and regions, never a large orthogonal circle's image)
      if ((s.def || s.fixed) && t !== 'area') continue;
      const F = shapeF(s, F0, k);
      if (!F) continue;
      if (t === 'point') { if (push(F(C(s.p[0], s.p[1])))) yield; continue; }
      const r = shapeGPU(s);
      if (t === 'area' && r.mesh) {
        const src = r.mesh.src, nv = src.length / 2;
        const stride = Math.max(1, Math.floor(nv * per / 2500));
        for (let i = 0; i < nv; i += stride) {
          const x = src[2 * i], y = src[2 * i + 1];
          if (r.mesh.stretched && !inCore(x, y)) continue;
          if (push(F(C(x, y)))) yield;
        }
      }
      // (a traced curve formula, like a formula area, counts by its part in the meshing window: its tails run out to
      // the far box)
      let unbounded = s.kind === 'line' || s.kind === 'ray' || s.kind === 'fcurve';
      if (t === 'area') { try { unbounded = !Region.bboxOf(s); } catch (e) { unbounded = true; } }
      for (const p of r.polys || []) {
        const n = p.length / 2, stride = Math.max(1, Math.floor(n * per / 400));
        for (let i = 0; i < n; i += stride) { const x = p[2 * i], y = p[2 * i + 1]; if ((!unbounded || inCore(x, y)) && push(F(C(x, y)))) yield; }
      }
    }
  }
  function fitPane(pane, k, extraKs = [], F, few) {
    const xs = [], ys = [];
    stageSamples(F || stageF(k), xs, ys, k, few);
    for (const k2 of extraKs) stageSamples(stageF(k2), xs, ys, k2);
    const b = robustBox(xs, ys);
    if (b) pane.fitBox(b, 0.07);
    else pane.fitBox({ x0: -2, x1: 2, y0: -2, y1: 2 });
  }

  // ---------------- panes ----------------
  let paneL, paneR;
  let cutHandlesL = [];
  let hoverCut = 0;
  // the zeros and poles of a 'zp' step in its input plane (drawZpHandles): screen positions, the hovered one and the
  // selected one (Delete removes it); {k, kind: 'zeros' | 'poles', i}
  let zpHandlesL = [], zpHover = null, zpSel = null;
  function leftView() { return leftStage() === 0 ? S.srcView : V.left; }
  // (v15.1, build/phone-swap.md: on a phone the inset draws its plane's view smaller; before the views are parked,
  // replaced or saved, the inset gets its large view back, and it is drawn small again when the task ends)
  function phHold() { if (Phone.hold) Phone.hold(); }
  // a lost context (GPU reset) usually comes back: say so, and keep the unsupported message for a failed init
  function noGL(pane) {
    paneNote(pane, GLR.lost ? $t('The graphics card was reset. Restoring the view…') : $t('This view needs WebGL2, which this browser does not provide.'));
  }
  // graph paper: the GL grid when available, otherwise 2D lines
  function paper(pane) {
    pane.begin(TH.plane);
    if (!GLR.drawGrid || !GLR.ok) Axes.draw(pane, TH, { unitCircle: S.unit, labels: false });
  }
  function renderLeft() {
    const pane = paneL;
    // ((#366 prototype) between two planes of the steps view: the glide's own frame, 19)
    // (and at rest on a plane past the colour plane, whose colour is the colour plane's carried forward)
    if (SV.on && svMoving()) { if (svParked()) svCheck(); if (svMoving()) { svRenderMoving(pane); return; } }
    if (SV.on) { svCheck(); if (!svColoured() && SV.surf === 'plane' && lFlat()) { svRenderMoving(pane); return; } }
    pane.setView(leftView());
    // (Landscape is not on this pane now: its refinement's textures go, issue #50)
    if (!lLand() && GLR.releaseLandscape) GLR.releaseLandscape();
    // X Plane + Phase: the phase portrait of the map in focus (U-b; earlier the right pane's Phase view)
    // (its shapes outlined, the target preimages, the points and the editable cuts drawn over it, as in X Plane)
    if (lColor()) { leftSphereInfo = null; cutHandlesL = renderColor(pane) || []; if (hasTargets()) { updateRoots(); drawRoots(pane); } return; }
    // X Landscape: the relief of the height over X
    if (lLand()) {
      cutHandlesL = []; leftSphereInfo = null; render3D(pane);
      // the relief has no place for the target preimages (they show in X Plane and Sphere): said, not dropped silently
      if (hasTargets() && GLR.ok) sphereCaption(pane, $t('Target preimages show in X → Y and Phase (1, 2)'));
      return;
    }
    // X Sphere: this plane on the Riemann sphere, with its shapes or (Phase) the phase portrait (orbit only; drawing on
    // the globes is P3b)
    if (lGlobe()) {
      cutHandlesL = [];
      let info = null;
      if (typeof renderSphereLeft === 'function') info = renderSphereLeft(pane);
      else { paper(pane); paneNote(pane, $t('The sphere view of this plane is not available in this build.')); }
      leftSphereInfo = info;
      // the targets' roots (solved over the flat view's window) are lifted to the globe; renderSphereLeft paints
      // the pulled-back target regions on it
      if (hasTargets()) {
        updateRoots();
        if (info) drawRoots(pane, sphereProj(pane, info));
      }
      return;
    }
    leftSphereInfo = null;
    paper(pane);
    const k = leftStage();
    const F = stageF(k);
    if (k > 0) noteStageWin(k, pane.box());
    if (GLR.ok) drawScene(pane, stageMap(k), 'L', { domain: k === 0, plane: k }); else noGL(pane);
    if (GLR.ok) stagePullbacks(pane, k);
    // the w-plane targets pulled back by the focused map, in every view
    if (hasTargets()) drawPullback(pane, endMap(), preimageTargets(false));
    drawChevrons(pane, F, k);
    cutHandlesL = drawCuts(pane, k, true, false);
    drawPoints(pane, F, { primes: k, domain: k === 0, k, editK: k });
    updatePre('L', pane, k); drawPre(pane, 'L', k);
    if (hasTargets()) { updateRoots(); drawRoots(pane); }
    drawRulers(paneL, 'L');
    // overlays are drawn once per frame, after both planes (frame)
  }
  // probes, handles, drafts, gauges: the only things redrawn on hover
  // the one gesture that needs a word while it is in progress: an open polygon draft names how to close it
  // (a level-2 chip at the top centre of the pane it is drawn in; it goes with the draft)
  // (an empty plane shows nothing over it, at the user's request of 2026-10-22)
  function updateDraftChips() {
    syncModeChips();
    const poly = !!(draft && draft.kind === 'polygon' && draft.pts && draft.pts.length);
    const cl = $('draftChipL'), cr = $('draftChipR');
    const cmSide = Construct.chipSide();   // (v16: a construction tool's chip)
    if (cl) { const on = (poly && !draft.target) || cmSide === 'L'; if (cl.hidden === on) cl.hidden = !on; }
    if (cr) { const on = (poly && !!draft.target) || cmSide === 'R'; if (cr.hidden === on) cr.hidden = !on; }
    // [v16.5 UX14, UX95] how to close and back up, in the words of the pointer in use (a finger has no Enter)
    if (poly) {
      const sp = (draft.target ? cr : cl) && (draft.target ? cr : cl).firstElementChild;
      const txt = fingerNow() ? $t('Tap the first point to close · Undo removes the last point') : $t('Click the first point or press Enter to close · ⌫ removes the last point');
      if (sp && sp.textContent !== txt) sp.textContent = txt;
    }
    Construct.syncChip();
    // P3b: the globes take drawing (panels.md 9). What still draws nothing says so: the landscape, a planar-centred
    // tool on a globe (Annulus, Sector, Polar grid: 'Draw in Plane'), the z-globe at a focused stage (P4)
    const sc = $('sphereChipL');
    if (sc) {
      const drawing = tool !== 'select' && solo() !== 'R';
      const where = lLand() ? $t('the landscape') : $t('the Riemann sphere');
      const toolName = (TOOLS.find((t) => t[0] === tool) || [])[1] || '';
      let msg = '';
      if (drawing && lLand()) msg = $t('Drawing is off on {where}; choose X → Y (1) to draw.', { where });
      else if (drawing && lGlobe() && GLOBE_OFF.has(tool)) msg = $t('{toolName} draws in Plane, not on the sphere.', { toolName });
      else if (drawing && lGlobe() && leftStage() > 0) msg = $t('On the globe, shapes are drawn in the z-plane: choose Plane to draw in this plane, or Show F.');
      // (v16.5 UX71) listening: the chip says what plays, and its Stop button ends it (Esc too)
      let act = null;
      if (!msg) { msg = listenChipMsg(); if (msg) act = { stop: true }; }
      // (review v16 verify-7: the Mountain King's hint, with its Listen button, in X's title row, over no plane; only
      // where that row is not shown, here, while nothing else is said here)
      const q = pieceHint(), inHead = syncPieceHint(q);
      if (!msg && q && !inHead) { act = q; msg = q.msg; }
      const on = !!msg;
      if (sc.firstChild.textContent !== msg) sc.firstChild.textContent = msg;
      let ab = sc.querySelector('.chip-act');
      const kind = act ? (act.stop ? 'stop' : 'listen') : '';
      if (ab && ab.dataset.kind !== kind) { ab.remove(); ab = null; }
      if (act && !ab) {
        ab = act.stop ? h('button', { class: 'toast-act chip-act chip-stop', type: 'button', 'data-kind': 'stop', 'data-tip': $t('Stop listening  Esc'), 'aria-label': $t('Stop listening'), onclick: () => { sndStopPlay(true); updateDraftChips(); } }, $t('Stop'))
          : h('button', { class: 'toast-act chip-act', type: 'button', 'data-kind': 'listen', onclick: () => { const q = pieceHint(); snd.hint = null; clearTimeout(snd.hintT); updateDraftChips(); if (q) q.go(); } }, $t('Listen'));
        sc.append(ab);
      } else if (!act && ab) ab.remove();
      sc.classList.toggle('has-act', !!act);
      if (sc.hidden === on) sc.hidden = !on;
    }
    const sr = $('sphereChipR');
    if (sr) {
      const toolName = (TOOLS.find((t) => t[0] === tool) || [])[1] || '';
      // (the merged deformation plane or globe draws nothing: said, merged-views review)
      const on = tool !== 'select' && solo() !== 'L' && (morphOn() || (rGlobe() && GLOBE_OFF.has(tool)));
      const msg = !on ? '' : morphOn() ? $t('Drawing is off in the deformation (M).') : $t('{toolName} draws in Plane (⇧3), not on the sphere.', { toolName });
      if (sr.firstChild.textContent !== msg) sr.firstChild.textContent = msg;
      // (v16.5 UX102) the way out is a button: the deformation turns off and the chosen tool stays
      const want = on && morphOn();
      let ab = sr.querySelector('.chip-act');
      if (want && !ab) { ab = h('button', { class: 'toast-act chip-act chip-draw', type: 'button', 'data-tip': $t('Turn the deformation off and draw  M'), onclick: () => { const tl = tool; closeTransport(); if (tool !== tl) setTool(tl); updateDraftChips(); } }, $t('Turn off and draw')); sr.append(ab); }
      else if (!want && ab) ab.remove();
      sr.classList.toggle('has-act', want);
      if (sr.hidden === on) sr.hidden = !on;
    }
    syncGlobeTools();
  }
  // Annulus, Sector and Polar grid are dimmed while X shows its globe (panels.md 9.2: tooltip 'Draw in Plane')
  // and every draw tool while X → Y shows the merged deformation, where X's pane is hidden (merged-views review)
  let globeToolsOff = null;
  function syncGlobeTools() {
    const merged = S.view.main === 'xy' && morphOn(), off = lGlobe();
    const k = `${merged}|${off}`;
    if (k === globeToolsOff) return;
    globeToolsOff = k;
    for (const b of document.querySelectorAll('.tool[data-tool]')) {
      if (b.dataset.tool === 'select') continue;
      const g = merged || (off && GLOBE_OFF.has(b.dataset.tool));
      b.classList.toggle('globe-off', g);
      const base = b.dataset.tipBase || (b.dataset.tipBase = b.dataset.tip || '');
      b.dataset.tip = merged ? $t('{base} · Turn off Deformation (M) to draw', { base }) : g ? $t('{base} · Draw in Plane', { base }) : base;
    }
  }
  function renderOverlays() {
    const showL = solo() !== 'R', showR = solo() !== 'L';
    updateDraftChips();
    updateUndo();
    ctxChanged();
    if (showL) { paneL.setView(leftView()); paneL.beginOverlay(); }
    if (showR) {
      paneR.setView(V.right);
      paneR.beginOverlay();
    }
    const sphL = !lFlat(); // the sphere and landscape views of X have no flat overlays
    const projL = lGlobe() && leftSphereInfo ? sphereProj(paneL, leftSphereInfo) : null;
    zpHandlesL = [];
    if (showL && !sphL) {
      drawCutHandles(paneL, cutHandlesL);
      drawZpHandles(paneL);
      if (leftStage() === 0) { drawHandles(paneL); if (!draft || !draft.target) drawDraft(paneL); Construct.drawOverlay(paneL, 'L'); if (tool !== 'select' && probe) drawCrosshair(paneL, draft && !draft.target && draft.cursor || probe); }
      // ([#253] a plane of the chain: its own shapes' handles and the draft; constructions are the z-plane's)
      else { drawHandles(paneL, planeShapes()); if (!draft || !draft.target) drawDraft(paneL); if (tool !== 'select' && probe) drawCrosshair(paneL, draft && !draft.target && draft.cursor || probe); }
      // (over the phase portrait the probe is white on a dark casing, as the portrait's own lines)
      // (not over a zero or pole under the pointer, or one being dragged: the handle is what the pointer holds)
      if (probe && !zpHover && !(drag && drag.mode === 'zp')) { if (lColor()) drawProbe(paneL, probe, '#FFFFFF', TH.dcCasing); else drawProbe(paneL, probe, TH.probe); }
    }
    // the curve of an open integral popover, with its direction (X: its plane or its globe)
    if (intPop && showL && !lLand()) drawIntHighlight(paneL, projL);
    if (intPop && showR && rImage() && !morphOn() && !trans.k) { paneR.setView(V.right); drawIntHighlight(paneR, null, rangeF(leftStage(), rightStage())); }
    // the preimages of the hovered point of the right plane
    if (showL && hov.w && hov.list && !lLand()) drawHoverPreimages(paneL, projL);
    // Image: the w-plane targets are drawn and edited in the right plane like shapes in the domain
    // the globes' handles, polygon vertices and snap ring (P3b)
    if (showL && lGlobe() && globeEdit('L')) drawGlobeEdit('L');
    if (showR && rGlobe() && globeEdit('R')) drawGlobeEdit('R');
    if (showR && rImage() && targetsEditable()) {
      paneR.setView(V.right);
      drawHandles(paneR, S.targets);
      if (draft && draft.target) drawDraft(paneR);
      Construct.drawOverlay(paneR, 'R');   // (v16)
      if (tool !== 'select' && rHover) drawCrosshair(paneR, rHover);
    }
    if (showR && rHover && !drag && rImage()) { paneR.setView(V.right); drawProbe(paneR, rHover, TH.probe); }
    if (showR && rHover && !drag && rGlobe()) drawSphereMark(paneR, rHover);
    if (showR) sndOverlay();
    if (probe && showR) {
      if (rImage() && !trans.k && !morphOn()) {
        paneR.setView(V.right);
        const F = focusF();
        if (showL && !sphL && tool === 'select') drawGauge(paneL, paneR, probe, F);
        drawProbe(paneR, F(probe), TH.probe);
      }
    }
    if (showL && !sphL) drawRulers(paneL, 'L', true);
    if (showR && rImage()) drawRulers(paneR, 'R', true);
  }
  // ---- rulers: ticks and labels along the bottom and left edges, plus cursor markers ----
  // Ruler sizes come from a ResizeObserver, never from a layout read per frame, and the static layer (ticks and
  // labels) lives in an offscreen canvas, so a probe move costs one blit plus the two markers.
  const rulerCache = { L: null, R: null };
  const rulerOff = { L: null, R: null };
  const rulerSize = new Map(); // ruler canvas -> [w, h] of its content box in CSS px (the CSS border is the edge line)
  const rulerSeen = { L: { vis: null, corner: null }, R: { vis: null, corner: null } };
  let rulerRO = null;
  function rulerDims(cv) {
    let s = rulerSize.get(cv);
    if (!s) {
      if (!rulerRO && window.ResizeObserver) {
        rulerRO = new ResizeObserver((es) => {
          let changed = false;
          for (const e of es) {
            const o = rulerSize.get(e.target), w = e.contentRect.width, hh = e.contentRect.height;
            if (!o || o[0] !== w || o[1] !== hh) { rulerSize.set(e.target, [w, hh]); changed = true; }
          }
          if (changed) requestRender('L', 'R');
        });
      }
      s = [cv.clientWidth, cv.clientHeight]; // first sight only
      rulerSize.set(cv, s);
      if (rulerRO) rulerRO.observe(cv);
    }
    return s;
  }
  // the 1-2-5 step at or above raw (labels never closer than asked for)
  function ceilStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m <= 1 + 1e-9 ? 1 : m <= 2 + 1e-9 ? 2 : m <= 5 + 1e-9 ? 5 : 10) * p;
  }
  // an imaginary ruler label centred at (0, 0): its number in the ruler's face, its i in the maths italic
  function imLabel(ctx, t, small) {
    if (!/i$/.test(t)) { ctx.fillText(t, 0, 0); return; }
    const num = t.slice(0, -1), f0 = ctx.font, fi = `italic 500 ${small ? 10 : 11}px ${TH.math}`;
    const wn = num ? ctx.measureText(num).width : 0;
    ctx.font = fi; const wi = ctx.measureText('i').width; ctx.font = f0;
    const x0 = -(wn + wi + (num ? 0.5 : 0)) / 2;
    ctx.textAlign = 'left';
    if (num) ctx.fillText(num, x0, 0);
    ctx.font = fi; ctx.fillText('i', x0 + wn + (num ? 0.5 : 0), 0); ctx.font = f0;
    ctx.textAlign = 'center';
  }
  function drawRulers(pane, side, markersOnly) {
    if (artMode) return;
    const rx = $(side === 'L' ? 'rulerLX' : 'rulerRX'), ry = $(side === 'L' ? 'rulerLY' : 'rulerRY');
    if (!rx || !ry) return;
    const seen = rulerSeen[side];
    const show = side === 'R' ? rImage() : lFlat();
    if (seen.vis !== show) { rx.style.visibility = ry.style.visibility = show ? '' : 'hidden'; seen.vis = show; }
    const corner = $(side === 'L' ? 'cornerL' : 'cornerR');
    // write the corner only when it changes: a write followed by a layout read forced a layout every frame
    // (the steps view's plane name with a real subscript: the corner is 18 px wide, which cut the Unicode one)
    const cornerHtml = !show ? '' : side === 'L' ? (SV.on ? svNameHtml(leftStage()) : wHtml(leftStage())) : (yAtF() ? '<i>w</i>' : wHtml(rightStage()));
    if (corner && seen.corner !== cornerHtml) { corner.innerHTML = cornerHtml; seen.corner = cornerHtml; }
    if (!show) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const [xw, xh] = rulerDims(rx), [yw, yh] = rulerDims(ry);
    if (!(xw >= 1 && xh >= 1 && yw >= 1 && yh >= 1)) return;
    const fit = (cv, w, hh) => { const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(hh * dpr)); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; } };
    const v = pane.view;
    const draw = (cv, W, Hh, horiz) => {
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = TH.panel; ctx.fillRect(0, 0, W, Hh);
      // tick and label sizes follow the ruler thickness: 18px rulers (17 inside the edge) or 14px on phones
      const th = horiz ? Hh : W, small = th < 16;
      const tiers = small ? [2, 3, 4] : [3, 5, 7], tmax = tiers[2];
      const len = horiz ? W : Hh;
      const toPx = (val) => (horiz ? pane.w / 2 + (val - v.cx) * v.s : pane.h / 2 - (val - v.cy) * v.s);
      const lo = horiz ? v.cx - pane.w / 2 / v.s : v.cy - pane.h / 2 / v.s, hi = horiz ? v.cx + pane.w / 2 / v.s : v.cy + pane.h / 2 / v.s;
      // ([v16.5 UX105] the UI face: "0.5", not B612 Mono's "0. 5"; an imaginary label's i in the maths italic, so the
      // turned label "2i" never reads "21")
      ctx.font = `${small ? 9 : 10}px ${TH.ui}`;
      // labels at the 1-2-5 step that keeps them >= 72px (bottom) or 48px (left) apart, rounded up, and further up
      // when the widest label would not fit its slot
      let major = ceilStep((horiz ? 72 : 48) / v.s);
      // as many digits as the tick step needs to tell neighbouring labels apart (deep zoom away from 0 included)
      const fmt = (x) => {
        if (Math.abs(x) < major * 1e-6) return '0';
        const ax = Math.abs(x), em = Math.floor(Math.log10(major) + 1e-9);
        if (ax >= 1e5 || (ax < 1e-3 && major < 1e-4)) {
          const sig = Math.min(15, Math.max(1, Math.floor(Math.log10(ax)) - em + 1));
          let [m, e] = x.toExponential(sig - 1).split('e');
          if (m.includes('.')) m = m.replace(/\.?0+$/, '');
          return `${I18N.num(m)}×10${String(+e).split('').map((d) => (d === '-' ? '⁻' : SUP[+d])).join('')}`.replace('-', '−');
        }
        let t = x.toFixed(Math.min(Math.max(0, -em), 14));
        if (t.includes('.')) t = t.replace(/\.?0+$/, ''); // minimum decimals: 2, 1.5, 0.25
        return I18N.num(t.replace('-', '−'));
      };
      // imaginary labels read 2i, i, −i, −0.5i (decided from the value, not the formatted text)
      const label = (val) => {
        const t = fmt(val);
        if (horiz || t === '0') return t;
        if (Math.abs(val - 1) < major * 1e-6) return 'i';
        if (Math.abs(val + 1) < major * 1e-6) return '−i';
        return t + 'i';
      };
      for (let guard = 0; guard < 12; guard++) {
        const ends = [Math.ceil(lo / major) * major, Math.floor(hi / major) * major];
        const wmax = Math.max(...ends.map((x) => ctx.measureText(label(x)).width));
        if (major * v.s >= wmax + 12) break;
        major = ceilStep(major * 1.5);
      }
      const medium = major / 2, minor = major / 10;
      ctx.strokeStyle = TH.rulerTick; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [step, size] of [[minor, tiers[0]], [medium, tiers[1]], [major, tiers[2]]]) {
        if (step * v.s < 6) continue;
        const i0 = Math.ceil(lo / step), i1 = Math.floor(hi / step);
        if (i1 - i0 > 800) continue;
        for (let i = i0; i <= i1; i++) {
          const p = Math.round(toPx(i * step) * dpr) / dpr + 0.5 / dpr;
          if (horiz) { ctx.moveTo(p, 0); ctx.lineTo(p, size); } else { ctx.moveTo(W, p); ctx.lineTo(W - size, p); }
        }
      }
      ctx.lineWidth = 1 / dpr; // ticks are 1 device px
      ctx.stroke();
      ctx.fillStyle = TH.label;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      // bottom: baseline 1px above the outer edge; left (rotated −90°, glyph tops face outward): the baseline
      // sits just outside the longest tick, so the ink stays inside [0, W]
      const base = horiz ? Hh - 1 : W - tmax - 1.5;
      const i0 = Math.ceil(lo / major), i1 = Math.floor(hi / major);
      if (i1 - i0 < 200) for (let i = i0; i <= i1; i++) {
        const p = toPx(i * major);
        if (p < 12 || p > len - 12) continue;
        const t = label(i * major), hw = ctx.measureText(t).width / 2;
        if (p - hw < 1 || p + hw > len - 1) continue;
        if (horiz) ctx.fillText(t, p, base);
        else { ctx.save(); ctx.translate(base, p); ctx.rotate(-Math.PI / 2); imLabel(ctx, t, small); ctx.restore(); }
      }
    };
    // the static part is drawn once per view into offscreen canvases; every call then blits it
    const fontsOk = document.fonts ? document.fonts.status : '';
    const key = `${v.cx},${v.cy},${v.s},${pane.w},${pane.h},${xw},${yw},${xh},${yh},${dpr},${TH.panel},${TH.label},${fontsOk}`;
    let off = rulerOff[side];
    if (!off) off = rulerOff[side] = { x: document.createElement('canvas'), y: document.createElement('canvas') };
    if (!rulerCache[side] || rulerCache[side].key !== key) {
      fit(off.x, xw, xh); fit(off.y, yw, yh);
      draw(off.x, xw, xh, true); draw(off.y, yw, yh, false);
      rulerCache[side] = { key };
    }
    fit(rx, xw, xh); fit(ry, yw, yh);
    const cx = rx.getContext('2d'), cy = ry.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0); cy.setTransform(1, 0, 0, 1, 0, 0);
    cx.drawImage(off.x, 0, 0); cy.drawImage(off.y, 0, 0);
    // cursor markers: the probe in the left plane, its image in the right
    let mk = null;
    if (probe) {
      if (side === 'L') mk = probe;
      else if (rImage()) { const w = focusF()(probe); if (CX.isFin(w)) mk = w; }
    }
    if (mk) {
      const px = pane.w / 2 + (mk.re - v.cx) * v.s, py = pane.h / 2 - (mk.im - v.cy) * v.s;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cy.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.fillStyle = TH.accent; cy.fillStyle = TH.accent;
      // a 5×4 triangle pointing into the plot
      if (px >= 0 && px <= xw) { cx.beginPath(); cx.moveTo(px - 2.5, 4); cx.lineTo(px + 2.5, 4); cx.lineTo(px, 0); cx.fill(); }
      if (py >= 0 && py <= yh) { cy.beginPath(); cy.moveTo(yw - 4, py - 2.5); cy.lineTo(yw - 4, py + 2.5); cy.lineTo(yw, py); cy.fill(); }
    }
  }
  function setLed(side, state, tip) {
    const el = $(side === 'L' ? 'leftLed' : 'rightLed');
    if (!el) return;
    el.className = 'led ' + state;
    el.setAttribute('data-tip', tip || { ok: $t('Up to date'), busy: $t('Refining near cuts and poles'), err: $t('Evaluation failed') }[state]);
    el.setAttribute('aria-label', el.getAttribute('data-tip'));
    el.removeAttribute('title');
  }
  // a hairline runs along the top of the plots when work takes longer than 300 ms
  let hairTimer = 0;
  function setHairline(on) {
    if (on) {
      if (!hairTimer) hairTimer = setTimeout(() => { $('hairL').hidden = false; $('hairR').hidden = false; }, 300);
    } else {
      clearTimeout(hairTimer); hairTimer = 0;
      $('hairL').hidden = true; $('hairR').hidden = true;
    }
  }
  function updateLeds() {
    const errStep = S.steps.findIndex((st, i) => st.on !== false && built[i] && built[i].error);
    const busy = fixJob.running || !!lineJob.running || sm.running;
    setHairline(!!busy);
    const errTip = errStep >= 0 ? `f${sub(errStep + 1)}: ${built[errStep].error}` : '';
    // without WebGL2 neither plane can show its regions: both LEDs report the failure (spec 5.14)
    if (!GLR.ok) { setLed('L', 'err', $t('WebGL2 is unavailable, so regions cannot be drawn')); setLed('R', 'err', $t('WebGL2 is unavailable, so regions cannot be drawn')); return; }
    setLed('L', busy ? 'busy' : 'ok');
    setLed('R', errStep >= 0 ? 'err' : busy ? 'busy' : 'ok', errTip || undefined);
  }
  function renderColor(pane) {
    pane.setView(leftView());
    if (!GLR.ok) { pane.begin(TH.plane); noGL(pane); return; }
    pane.begin(TH.plane);
    GLR.begin(pane.pw, pane.ph);
    // the Cauchy style (st.cauchy: the nodes of the selected closed curve, F inside, 0 outside); with the Morph
    // transport open (homView: the homotopy at its time t), the phase portrait of H_t (the Cauchy style then shows H_t)
    const hv = typeof homView === 'function' ? homView() : null;
    const cz = !hv && S.dc === 'cauchy' && typeof cauchyDraw === 'function' ? cauchyDraw(pane.view.s) : null;
    const cst = { map: hv ? hv.map : focusMap(), view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(pane), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: cz };
    // (the steps view's Inside regions: the colour only inside the regions of this plane, on the GPU, else in 2D; 19)
    if (!(svMaskOn() && svMaskGPU(pane, cst))) { GLR.drawColorPlot(cst); if (svMaskOn()) svMaskColour(pane, cst); }
    const cauchyIdle = S.dc === 'cauchy' && !cz && !hv;
    if (S.outline && !artMode) {
      const map0 = stageMap(leftStage());
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) === 'point') continue;
        const map = shapeMap(s, map0);
        if (!map) continue;
        const r = shapeGPU(s);
        if (!r.lineRes) continue;
        // open sets dashed (spec 6.8)
        const dash = r.open ? { dash: [5, 3.5], arc: arcOf(r, cpuMap(map), mapKeyOf(map)) } : null;
        GLR.drawLines(r.lineRes, Object.assign({ map, view: pane.view, dpr: pane.dpr, M: 8, width: 1.3 * pane.dpr, color: GLR.hexRGB(TH.dcCasing), alpha: 0.9, casing: { color: [1, 1, 1], alpha: 0.95, width: 3 * pane.dpr }, cacheKey: `${r.lineKey}|${mapKeyOf(map)}` }, dash));
      }
    }
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    glStatusNote(pane);
    if (artMode) return []; // the figure's art layer: no screen grid, axes, targets, cuts or points
    // major grid and axes in white over the colors
    const ctx = pane.ctx, b = pane.box(), st = Axes.niceStep(110 / pane.view.s);
    ctx.save();
    ctx.strokeStyle = TH.dcLine; ctx.globalAlpha = TH.dcLineA; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.ceil(b.x0 / st); i <= Math.floor(b.x1 / st) && i - Math.ceil(b.x0 / st) < 400; i++) { const x = Math.round(pane.w2sxy(i * st, 0)[0]) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, pane.h); }
    for (let j = Math.ceil(b.y0 / st); j <= Math.floor(b.y1 / st) && j - Math.ceil(b.y0 / st) < 400; j++) { const y = Math.round(pane.w2sxy(0, j * st)[1]) + 0.5; ctx.moveTo(0, y); ctx.lineTo(pane.w, y); }
    ctx.stroke();
    const [ox, oy] = pane.w2sxy(0, 0);
    const axes = () => { ctx.beginPath(); ctx.moveTo(0, Math.round(oy) + 0.5); ctx.lineTo(pane.w, Math.round(oy) + 0.5); ctx.moveTo(Math.round(ox) + 0.5, 0); ctx.lineTo(Math.round(ox) + 0.5, pane.h); ctx.stroke(); };
    ctx.globalAlpha = 0.4; ctx.strokeStyle = TH.dcCasing; ctx.lineWidth = 2.5; axes();
    ctx.globalAlpha = TH.dcAxisA; ctx.strokeStyle = TH.dcLine; ctx.lineWidth = 1.25; axes();
    ctx.restore();
    // as in X Plane (panels.md 1, target preimages in every X view): the w-plane targets pulled back by the focused
    // map (area fills at half strength, so the portrait reads through them; their edges as drawn), the points, and
    // the cuts with their handles
    const k = leftStage();
    if (hasTargets()) drawPullback(pane, endMap(), preimageTargets(false).map((t) => (t.alpha < 1 ? Object.assign(t, { alpha: t.alpha * 0.5 }) : t)));
    const handles = drawCuts(pane, k, true, false);
    drawPoints(pane, stageF(k), { primes: k, domain: k === 0, k, editK: k });
    if (cauchyIdle) paneNote(pane, $t('Cauchy style: select a closed curve or a bounded region to see its Cauchy integral.'));
    else if (cz && cz.plan && cz.plan.why === 'onCurve') paneNote(pane, $t('Cauchy style: F is not finite on the curve (a pole on it), so its Cauchy integral is not defined.'));
    drawRulers(pane, pane === paneL ? 'L' : 'R');
    return handles;
  }
  function dcGridStep() { return S.dcGrid || 0.5; }
  // backdrop for 3D views (spec 6.9): vertical gradient --land-top -> --land-bottom, times a vignette 1 - 0.06 r^2
  // (r = 1 at the corners)
  function backdrop(pane) {
    const ctx = pane.ctx;
    if (figMode) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pane.w, pane.h); return; } // print: plain paper
    const g = ctx.createLinearGradient(0, 0, 0, pane.h);
    g.addColorStop(0, TH.landTop); g.addColorStop(1, TH.landBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, pane.w, pane.h);
    const r = Math.hypot(pane.w, pane.h) / 2;
    const vg = ctx.createRadialGradient(pane.w / 2, pane.h / 2, 0, pane.w / 2, pane.h / 2, r);
    for (let i = 0; i <= 8; i++) { const t = i / 8, v = Math.round(255 * (1 - 0.06 * t * t)); vg.addColorStop(t, `rgb(${v},${v},${v})`); }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, pane.w, pane.h);
    ctx.restore();
  }
  // median |F| over the box (used to scale |F|, Re F and Im F heights)
  let muCache = { key: '', mu: 1 };
  function medianAbs(box) {
    const key = `${chainSig[nSteps()]}|${S.focus}|${box.x0},${box.x1},${box.y0},${box.y1}|${S.height}`;
    if (muCache.key === key) return muCache.mu;
    const F = typeof plotF === 'function' ? plotF() : focusF(), vals = [];   // the focused map at t = end (a steady scale while morphing)
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
      const w = F(C(box.x0 + (i + 0.5) / 32 * (box.x1 - box.x0), box.y0 + (j + 0.5) / 32 * (box.y1 - box.y0)));
      const v = S.height === 're' ? Math.abs(w.re) : S.height === 'im' ? Math.abs(w.im) : CX.abs(w);
      if (Number.isFinite(v)) vals.push(v);
    }
    vals.sort((a, b) => a - b);
    const mu = vals.length ? Math.max(1e-6, vals[Math.floor(vals.length / 2)]) : 1;
    muCache = { key, mu };
    return mu;
  }
  // the landscape's domain: the left view box, aspect preserved (spec 6.9), trimmed to at most 2:1 about its centre
  function landBox() {
    // (a figure's art: the window figure.js chose, snapped to round numbers; the screen never takes this path)
    if (artMode && artLandBox) return artLandBox;
    const vb = leftPaneBox();
    const mx = (vb.x0 + vb.x1) / 2, my = (vb.y0 + vb.y1) / 2;
    let w = vb.x1 - vb.x0, h = vb.y1 - vb.y0;
    if (w > 2 * h) w = 2 * h; else if (h > 2 * w) h = 2 * w;
    return { x0: mx - w / 2, x1: mx + w / 2, y0: my - h / 2, y1: my + h / 2 };
  }
  function render3D(pane) {
    pane.begin(TH.plane);
    if (!GLR.ok) { noGL(pane); return; }
    backdrop(pane);
    const box = landBox();
    // the Morph transport (homView): the surface of H_t; All sheets (S.sheets, window S.sheetW): the whole covering
    // surface of the focused map instead of its cut principal branch; while deforming, H_t on the sheets that become
    // F's (notes/v16-user5/SHEETS-DESIGN.md), unless a step it applies has no sheet form (deformSheetsOk)
    const hv = typeof homView === 'function' ? homView() : null;
    // (v16.1 review math-5: while deforming, F's digits, given F's last step; math-6: a single-valued F, as √ then z²,
    // draws its principal branch, multiSheet null)
    const sheets = S.sheets && (!hv || deformSheetsOk()) && multiSheet() ? { W: Math.max(1, Math.min(4, Math.round(S.sheetW) || 2)), end: hv ? endMap().b : 0 } : null;
    let mu = S.height === 'log' ? 1 : medianAbs(box);
    // all sheets with height Re F / Im F: the scale from the 90th percentile of the values over every surface drawn
    // (the sheets of log stack 2 pi i apart: the principal branch's scale, or even the median, flattened the outer
    // ones into stacked plates), so the height is nearly linear in the value and every turn keeps its pitch; the
    // block is made taller by how far the surfaces stack (the spread of the values over all of them against the
    // principal one's, x 0.8, within 1..4.5), so a helicoid reads as one. Cached per chain, focus, box, height, window.
    let lscale = S.lscale || 1;
    render3D.linear = false;
    // (while deforming with sheets, v16.1 review math-4: the same block as F's static All sheets, and a scale that ends
    // at F's (verify-2, below: it follows H_t), so the end frame is the static one; the linear height then has a
    // soft knee instead of the clamp (the Knee modes: linear up to the scale, levelling off to 1.25 of it), so values of
    // H_t far beyond F's sheets, as sin z at t = 0 of sin √z, level off smoothly instead of meeting the clamp in walls,
    // and a log window keeps its pitch instead of the compressed height's plates)
    const fm = focusMap(), si = sheets && GLR.sheetInfo ? GLR.sheetInfo(fm, sheets.W) : null;
    if (si && S.height !== 'log' && typeof Funcs.sheetEval === 'function') {
      const lin = S.height === 're' || S.height === 'im';
      const key = `${chainSig[nSteps()]}|${S.focus}|${box.x0},${box.x1},${box.y0},${box.y1}|${S.height}|${sheets.W}|${si.K}`;
      const c = render3D.muS || (render3D.muS = { key: '', mu: 1 });
      const q = (a, f) => a[Math.min(a.length - 1, Math.max(0, Math.floor(f * a.length)))];
      const zAt = (i, j) => C(box.x0 + (i + 0.5) / 12 * (box.x1 - box.x0), box.y0 + (j + 0.5) / 12 * (box.y1 - box.y0));
      const hOf = (w) => (w ? (S.height === 're' ? w.re : S.height === 'im' ? w.im : CX.abs(w)) : NaN);
      if (c.key !== key) {
        const vals = [], sv = [], sv0 = [];
        for (let k = 0; k < si.K; k++) for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
          const z = zAt(i, j);
          let w = null;
          try { w = Funcs.sheetEval(S.steps, built, fm.b, z, z, k, sheets.W, { a: fm.a || 0 }); } catch (e) { w = null; }
          const x = hOf(w);
          if (!Number.isFinite(x)) continue;
          vals.push(Math.abs(x)); sv.push(x);
          if (k === 0) sv0.push(x);
        }
        for (const a of [vals, sv, sv0]) a.sort((x, y) => x - y);
        // linear heights over all sheets: the scale is (nearly) the largest value, so the surfaces fill the block
        c.key = key; c.mu = vals.length ? Math.max(1e-6, q(vals, lin ? 0.98 : 0.5)) : mu;
        const s0 = sv0.length ? q(sv0, 0.95) - q(sv0, 0.05) : 0, s1 = sv.length ? q(sv, 0.95) - q(sv, 0.05) : 0;
        c.boost = lin && s0 > 0 && s1 > 0 ? Math.max(1, Math.min(4.5, 0.8 * s1 / s0)) : 1;
      }
      mu = c.mu;
      // (v16.1 verify-2: F's scale for every t flattened H_t where F's sheets are much taller, as log then sin, where
      // H_t looked like one flat sheet, and walled it where they are much lower, as sin √z near t = 0. The scale now
      // follows H_t: the same percentile over the drawn surfaces at 9 times of the transport (each computed once, when
      // first needed), interpolated in log between them; the last is F's own (at the end the surfaces are F's, bit for
      // bit), so the end frame is still the static one. The block (boost) stays F's.)
      // (v16.2, review rv162-1: with many sheets one time's scale is K x 144 evaluations, about 8 ms at K = 24 on the
      // Mac, so computing each inside the frame that first needs it dropped frames on the first play. The 8 times are
      // now filled in idle time, one row of 12 points at a time, from the frame that opens the key on, ahead of t; a
      // frame that needs a time not yet filled finishes it from where the idle work stopped. Same points, same values,
      // same percentile: the scale is unchanged, only when it is computed moves.)
      if (hv && c.mu > 0 && typeof Funcs.sheetMapEval === 'function') {
        const L = morphLen(), N = 8, T = Math.max(0, Math.min(L, +hv.t || 0));
        const hk = `${key}|${rangeKey()}|${allAtOnce() ? 1 : 0}|${L}|${leftStage()}|${sheets.end}`;
        const x = T / L * N, j = Math.min(N - 1, Math.floor(x)), f = x - j;
        let h = render3D.muH && render3D.muH.key === hk ? render3D.muH : null;
        if (!h) {
          // what the evaluations read when they run (the rest of the key is fixed in the closure below): idle work
          // stops when this no longer matches, so a value is only ever computed for the state of its key
          const sig = () => `${chainSig[nSteps()]}|${S.focus}|${S.height}|${rangeKey()}|${allAtOnce() ? 1 : 0}|${morphLen()}|${leftStage()}`;
          const cmu = c.mu, K = si.K, W = sheets.W, end = sheets.end, s0 = sig();
          h = render3D.muH = { key: hk, mu: [], part: [], sig, s0 };
          // fill time j (from where it stopped); with over(), stop after the row that runs past it and return false
          h.fill = (jt, over) => {
            if (jt >= N) return true;
            if (h.mu[jt] !== undefined) return true;
            const p = h.part[jt] || (h.part[jt] = { r: 0, v: [], mp: null, bad: false });
            if (!p.bad) {
              try {
                if (!p.mp) p.mp = HR.state(S, jt / N * L, true).map;
                for (; p.r < K * 12; p.r++) {
                  if (over && over()) return false;
                  const k = Math.floor(p.r / 12), jj = p.r % 12;
                  for (let i = 0; i < 12; i++) {
                    const z = zAt(i, jj), xv = hOf(Funcs.sheetMapEval(S.steps, built, p.mp, z, z, k, W, end));
                    if (Number.isFinite(xv)) p.v.push(Math.abs(xv));
                  }
                }
              } catch (e) { p.bad = true; }
            }
            const v = p.bad ? [] : p.v;
            v.sort((a, b) => a - b);
            h.mu[jt] = v.length ? Math.max(1e-6, q(v, lin ? 0.98 : 0.5)) : cmu;
            h.part[jt] = null;
            return true;
          };
          const ric = typeof requestIdleCallback === 'function' ? requestIdleCallback : (cb) => setTimeout(() => cb(null), 16);
          const work = (dl) => {
            if (render3D.muH !== h || h.sig() !== h.s0) return;
            const t0 = performance.now();
            const over = () => (dl && typeof dl.timeRemaining === 'function' ? dl.timeRemaining() < 2 : performance.now() - t0 > 3);
            // ahead of the transport's current time first, then the rest
            const from = Math.max(0, Math.min(N - 1, h.from || 0));
            for (let d = 0; d < N; d++) if (!h.fill((from + d) % N, over)) { ric(work); return; }
          };
          h.from = j;
          ric(work);
        }
        h.from = j;
        const at = (jt) => {
          if (jt >= N) return c.mu;
          if (h.mu[jt] === undefined) h.fill(jt, null);
          return h.mu[jt];
        };
        mu = f <= 0 ? at(j) : f >= 1 ? at(j + 1) : Math.exp((1 - f) * Math.log(at(j)) + f * Math.log(at(j + 1)));
      }
      lscale *= c.boost || 1;
      if (lin) render3D.linear = true;
    }
    // 28 degree camera fitted to the bounding sphere of the block and its plate at this pane's aspect
    const geo = GLR.landGeom(box, lscale);
    refitCam(cam, CAM3, landFitDist(geo, pane));
    const view = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, tx: cam.tx, ty: cam.ty, tz: geo.center[2], fov: CAM3.fov };
    GLR.begin(pane.pw, pane.ph);
    const cells = S.meshN >= 1920 ? 512 : S.meshN >= 480 ? 384 : 256;   // spec 6.9: 256² vertices, 384² at Fine and above, 512² at Max
    // source outlines printed on the floor, in the plane the landscape is built on (stage focus - 1)
    const outlines = [];
    const omap0 = stageMap(leftStage());
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const omap = shapeMap(s, omap0);
      if (!omap) continue;
      const r = shapeGPU(s);
      if (r.lineRes) outlines.push({ res: r.lineRes, color: GLR.hexRGB(shapeInk(s).edge), map: omap, cacheKey: `${r.lineKey}|${mapKeyOf(omap)}` });
    }
    const info = GLR.drawLandscape({
      map: hv ? hv.map : focusMap(), box, cam: view, heightMode: render3D.linear ? `${S.height}${hv ? 'Knee' : 'Lin'}` : S.height, scale: lscale, mu, material: landMaterial(), unitLevel: !!S.unitLevel && !artMode, sectors: S.sectors || 12, floorPrint: !artMode, seaLine: !artMode,
      cells, sheets, outlines: artMode ? [] : outlines, probe: probe ? { x: probe.re, y: probe.im } : null, bg: GLR.hexRGB(TH.landBottom),
      // (the refinement of steep walls: capped while something moves, in full at rest and in every figure or film)
      motion: !offRender && interacting(), full: offRender || figMode,
      colors: {
        floor: GLR.hexRGB(TH.landFloor), box: GLR.hexRGB(TH.landBox), modLine: GLR.hexRGB(TH.landMod), argLine: GLR.hexRGB(TH.landArg), plaster: GLR.hexRGB(TH.plaster),
        shadow: GLR.hexRGB(TH.landShadow), shadowA: TH.landShadowA, hemiSky: GLR.hexRGB(TH.hemiSky), hemiGround: GLR.hexRGB(TH.hemiGround), accent: GLR.hexRGB(TH.accent),
        minor: GLR.hexRGB(TH.gridMinor), medium: GLR.hexRGB(TH.gridMedium), major: GLR.hexRGB(TH.gridMajor), landBottom: GLR.hexRGB(TH.landBottom),
        cut: GLR.hexRGB(TH.cut), probe: GLR.hexRGB(TH.probe),
        // the figure's art layer: a white plate with its contact shadow, no graph paper, no footprint (figure.js draws
        // the footprint and the labels as vectors)
        ...(artMode ? { floor: [1, 1, 1], box: [1, 1, 1], minor: [1, 1, 1], medium: [1, 1, 1], major: [1, 1, 1] } : {}),
      },
    });
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (info && (artMode || artCam)) artLand = { MVP: info.MVP, aspect: info.aspect, floorZ: info.floorZ, eye: info.eye, top: info.top, box, w: pane.w, h: pane.h };
    if (info && !artMode) draw3DLabels(pane, info, box);
    render3D.sheetsInfo = info ? info.sheets : null;   // (what the last frame drew: tests)
    // what pickLand needs to find the point of X under the pointer (the last frame's camera, block and heights)
    render3D.pick = info && !figMode ? { cam: view, box, info, w: pane.w, h: pane.h, F: hv ? hv.F : focusF() } : render3D.pick;
    glStatusNote(pane);
  }
  // the point of X under pane pixel (x, y) of the landscape (its probe: the needle from the floor to (z, h(z)) and the
  // readout): the first crossing of the pointer's ray with the relief (the principal branch, marched then bisected),
  // else the floor of the block; null off the block
  function pickLand(x, y) {
    const pk = render3D.pick;
    if (!pk || !(pk.w > 0 && pk.h > 0) || !pk.info || !pk.info.heightOf) return null;
    const c = pk.cam, info = pk.info, box = pk.box, [ax, ay] = info.aspect || [1, 1];
    const e = [c.tx + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw), c.ty + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), c.tz + c.dist * Math.sin(c.pitch)];
    const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((t) => t / l); };
    const f = nrm([c.tx - e[0], c.ty - e[1], c.tz - e[2]]);
    const r = nrm([f[1], -f[0], 0]);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const th = Math.tan((c.fov || 28 * DEG) / 2), nx = (2 * x / pk.w - 1) * th * pk.w / pk.h, ny = (1 - 2 * y / pk.h) * th;
    const d = nrm([0, 1, 2].map((k) => f[k] + nx * r[k] + ny * u[k]));
    const at = (t) => [e[0] + t * d[0], e[1] + t * d[1], e[2] + t * d[2]];
    const toZ = (p) => C(box.x0 + (p[0] / ax / 2 + 0.5) * (box.x1 - box.x0), box.y0 + (p[1] / ay / 2 + 0.5) * (box.y1 - box.y0));
    const top = Math.abs(info.top || 1) * 1.3, z0 = info.floorZ;
    const hAt = (p) => {
      const w = pk.F(toZ(p));
      if (!CX.isFin(w)) return top;
      const hh = info.heightOf(S.height === 're' ? w.re : S.height === 'im' ? w.im : CX.abs(w));
      return Number.isFinite(hh) ? hh : top;
    };
    // the ray's segment inside the block |x| <= ax, |y| <= ay, floor <= z <= top
    let t0 = 0, t1 = Infinity;
    for (const [k, lo, hi] of [[0, -ax, ax], [1, -ay, ay], [2, z0, top]]) {
      if (Math.abs(d[k]) < 1e-12) { if (e[k] < lo || e[k] > hi) return null; continue; }
      let a = (lo - e[k]) / d[k], b = (hi - e[k]) / d[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (!(t1 > t0)) return null;
    const N = 160;
    let tp = t0;
    for (let i = 0; i <= N; i++) {
      const t = t0 + (t1 - t0) * i / N, p = at(t);
      if (p[2] - hAt(p) > 0) { tp = t; continue; }
      if (i === 0) return toZ(p);
      let a = tp, b = t;
      for (let j = 0; j < 14; j++) { const m = (a + b) / 2, q = at(m); if (q[2] - hAt(q) > 0) a = m; else b = m; }
      return toZ(at(b));
    }
    const p = at(t1);
    return Math.abs(p[2] - z0) < 1e-6 * Math.max(1, Math.abs(z0)) + 1e-9 ? toZ(p) : null;
  }
  function project(pane, MVP, p) {
    const c = GLR.M4.apply(MVP, p);
    if (c[3] <= 1e-6) return null;
    return [(c[0] / c[3] * 0.5 + 0.5) * pane.w, (1 - (c[1] / c[3] * 0.5 + 0.5)) * pane.h];
  }
  // leaves the context's stroke state as it found it, so ticks drawn after a label keep --ruler-tick
  function haloText(ctx, t, x, y, halo) { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = halo || TH.landTop; ctx.strokeText(t, x, y); ctx.restore(); ctx.fillText(t, x, y); }
  // Labels of the landscape (spec 6.9), projected each frame: ticks on the two floor edges facing the camera, the
  // axis names, and a height ruler (values of the plotted quantity through the height map) on the back corner
  // that sits on the block's silhouette, so its labels never cover the relief.
  function draw3DLabels(pane, info, box) {
    const ctx = pane.ctx;
    const [ax, ay] = info.aspect || [1, 1];
    const z0 = info.floorZ, eye = info.eye;
    const P = (p) => project(pane, info.MVP, p);
    const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return l > 1e-6 ? [dx / l, dy / l] : [0, 1]; };
    const hexMix = (a, b, t) => { const A = GLR.hexRGB(a), B = GLR.hexRGB(b); return `rgb(${A.map((x, k) => Math.round(255 * (x + (B[k] - x) * t))).join(',')})`; };
    const bgAt = (y) => hexMix(TH.landTop, TH.landBottom, Math.min(1, Math.max(0, y / pane.h)));
    const taken = [];
    const free = (r) => r[0] > 1 && r[1] > 1 && r[0] + r[2] < pane.w - 1 && r[1] + r[3] < pane.h - 1 && !taken.some((q) => r[0] < q[0] + q[2] && q[0] < r[0] + r[2] && r[1] < q[1] + q[3] && q[1] < r[1] + r[3]);
    // seen from below the floor, the relief hangs over the floor's edges: a floor label inside the block's outline
    // on screen would print over the surface, so it is left out (floor: true)
    const below = eye[2] < z0;
    let hull = null;
    if (below) {
      const pts = [];
      for (const zz of [z0, info.top]) for (const [cx0, cy0] of [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]]) { const q = P([cx0, cy0, zz]); if (q) pts.push(q); }
      if (pts.length === 8) {
        // convex hull (monotone chain)
        pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lo = [], up = [];
        for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
        for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
        hull = lo.slice(0, -1).concat(up.slice(0, -1));
      }
    }
    const inHull = (x, y) => { if (!hull) return false; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false; } return true; };
    const overRelief = (r) => below && (!hull || [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]], [r[0] + r[2] / 2, r[1] + r[3] / 2]].some(([x, y]) => inHull(x, y)));
    // runs: [[text, italic], ...] set as one label, pushed from anchor a along the screen direction d by gap px
    const label = (runs, a, d, gap, font, halo, color, floor) => {
      const fontOf = (it) => (it ? `italic ${font}` : font);
      const ws = runs.map(([t, it]) => { ctx.font = fontOf(it); return ctx.measureText(t).width; });
      const w = ws.reduce((s, x) => s + x, 0), hh = 12;
      const ext = Math.abs(d[0]) * w / 2 + Math.abs(d[1]) * hh / 2;
      const cx = a[0] + d[0] * (gap + ext), cy = a[1] + d[1] * (gap + ext);
      // 3px clear of every other label (the ruler title never touches a tick label)
      const r = [cx - w / 2 - 3, cy - hh / 2 - 2, w + 6, hh + 4];
      if (!free(r) || (floor && overRelief(r))) return false;
      taken.push(r);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
      let x = cx - w / 2;
      runs.forEach(([t, it], i) => { ctx.font = fontOf(it); haloText(ctx, t, x, cy, halo || bgAt(cy)); x += ws[i]; });
      return true;
    };
    const micro = `400 10px ${TH.mono}`, math12 = `500 12px ${TH.math}`;
    const minus = (s) => I18N.num(s.replace(/-/g, '−'));   // tick labels: the decimal comma in Russian
    const ticks = (a0, a1) => { const st = Axes.niceStep((a1 - a0) / 4); const out = []; for (let k = Math.ceil(a0 / st - 1e-9); k * st <= a1 + 1e-9 * st; k++) out.push(+(k * st).toPrecision(10)); return out; };
    // the two floor edges facing the camera: y = sy·ay (carries Re z) and x = sx·ax (carries Im z)
    const sx = eye[0] < 0 ? -1 : 1, sy = eye[1] < 0 ? -1 : 1;
    ctx.save();
    ctx.lineWidth = 1; ctx.strokeStyle = TH.rulerTick; ctx.lineCap = 'butt';
    // an edge seen end-on (front or side views) carries no labels: they would only pile up
    const seen = (p0, p1) => { const a = P(p0), b = P(p1); return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0; };
    const edge = (vals, at, out, text) => {
      for (const v of vals) {
        const p = at(v), a = P(p), b = P([p[0] + out[0] * 0.06, p[1] + out[1] * 0.06, z0]);
        if (!a || !b) continue;
        const d = unit(a, b);
        if (!label([[text(v), false]], a, d, 6, micro, TH.landFloor, TH.label, true)) continue;
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + d[0] * 4, a[1] + d[1] * 4); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };
    const X = (x) => ((x - box.x0) / (box.x1 - box.x0) - 0.5) * 2 * ax, Y = (y) => ((y - box.y0) / (box.y1 - box.y0) - 0.5) * 2 * ay;
    const reVals = ticks(box.x0, box.x1), imVals = ticks(box.y0, box.y1);
    // a plate seen edge-on (the camera level with it, in side views of the open surface) carries none: its two
    // edges would stack their ticks on one line
    const q0 = P([-ax, -ay, z0]), q1 = P([ax, -ay, z0]), q2 = P([ax, ay, z0]), q3 = P([-ax, ay, z0]);
    const plateArea = q0 && q1 && q2 && q3 ? 0.5 * Math.abs((q2[0] - q0[0]) * (q3[1] - q1[1]) - (q2[1] - q0[1]) * (q3[0] - q1[0])) : 0;
    const plateExt = q0 && q1 && q2 && q3 ? Math.max(Math.hypot(q2[0] - q0[0], q2[1] - q0[1]), Math.hypot(q3[0] - q1[0], q3[1] - q1[1])) : 0;
    const flatOn = plateArea > 0.05 * plateExt * plateExt;
    const reOn = flatOn && seen([-ax, sy * ay, z0], [ax, sy * ay, z0]) > 70, imOn = flatOn && seen([sx * ax, -ay, z0], [sx * ax, ay, z0]) > 70;
    if (reOn) edge(reVals, (x) => [X(x), sy * ay, z0], [0, sy], (x) => minus(CX.fmtNum(x, 3)));
    if (imOn) edge(imVals, (y) => [sx * ax, Y(y), z0], [sx, 0], (y) => minus(CX.fmtNum(y, 3) + 'i').replace(/^1i$/, 'i').replace(/^−1i$/, '−i').replace(/^0i$/, '0'));
    // axis names beyond the tick labels, at the middle of each edge
    const title = (p, out, runs) => {
      const a = P(p), b = P([p[0] + out[0] * 0.06, p[1] + out[1] * 0.06, z0]);
      if (a && b) for (const gap of [24, 34, 46]) if (label(runs, a, unit(a, b), gap, math12, TH.landFloor, TH.ink2, true)) break;
    };
    const vz = leftStage() === 0 ? 'z' : `w${sub(leftStage())}`;
    if (reOn) title([0, sy * ay, z0], [0, sy], [['Re ', false], [vz, true]]);
    if (imOn) title([sx * ax, 0, z0], [sx, 0], [['Im ', false], [vz, true]]);
    // height ruler: of the two corners on the block's silhouette, the one farther from the camera
    const corners = [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]];
    const far = corners.reduce((m, c, i) => (Math.hypot(c[0] - eye[0], c[1] - eye[1]) > Math.hypot(corners[m][0] - eye[0], corners[m][1] - eye[1]) ? i : m), 0);
    const side = [corners[(far + 1) % 4], corners[(far + 3) % 4]];
    const rc = Math.hypot(side[0][0] - eye[0], side[0][1] - eye[1]) >= Math.hypot(side[1][0] - eye[0], side[1][1] - eye[1]) ? side[0] : side[1];
    const top = info.top;
    const r0 = P([rc[0], rc[1], z0]), r1 = P([rc[0], rc[1], top]), cc = P([0, 0, z0]);
    if (!r0 || !r1 || !cc) { ctx.restore(); return; }
    const dir = r0[0] < cc[0] ? -1 : 1;           // labels go outward, away from the block
    ctx.globalAlpha = 0.85; ctx.strokeStyle = TH.landBox; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke();
    ctx.globalAlpha = 1;
    const hOf = info.heightOf || ((v) => v);
    const fmt = (v) => minus(CX.fmtNum(v, 3));
    let vals;                                     // [value, label], in order of priority
    if (S.height === 'log' || !S.height) vals = [1, 10, 0.1, 100, 0.01].map((m) => [m, fmt(m)]);
    else {
      const b = Axes.niceStep(medianAbs(box));
      vals = (S.height === 'abs' ? [1, 0, 4, 2, 10, 0.5] : [0, 1, -1, 4, -4, 2, -2]).map((m) => [m * b, fmt(m * b)]);
    }
    ctx.strokeStyle = TH.rulerTick;
    for (const [v, lab] of vals) {
      const hz = hOf(v);
      if (!Number.isFinite(hz) || hz > top - 0.01 || hz < z0 + 0.01) continue;
      const a = P([rc[0], rc[1], hz]);
      if (!a) continue;
      if (!label([[lab, false]], a, [dir, 0], 8, micro, null, TH.label)) continue;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + dir * 5, a[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // a focused d/dz step plots its stage w_k (a function of z), any other step its own map f_k
    const Fn = morphOn() && lPaintsF() ? 'Hₜ' : S.focus === 0 ? 'F' : (typeof isDeriv === 'function' && isDeriv(S.focus) ? `w${sub(S.focus)}` : `f${sub(S.focus)}`);
    const tl = { log: [['|', false], [Fn, true], ['|', false]], abs: [['|', false], [Fn, true], ['|', false]], re: [['Re ', false], [Fn, true]], im: [['Im ', false], [Fn, true]] }[S.height || 'log'];
    // above the ruler; if a tick label is there, further up, then beside the top of the ruler
    // (from below the floor the relief hangs over the top of the ruler: beside it first, never over the surface)
    const up = (k) => [r1[0], r1[1] - k];
    // the block's outline on screen at the height of y, on the ruler's side (where a label clears the relief)
    const rim = (y) => {
      let x = r1[0];
      if (hull) for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length];
        if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
        const xi = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
        if (dir < 0 ? xi < x : xi > x) x = xi;
      }
      return [x, y];
    };
    const tries = below ? [[r1, [dir, 0], 10], [rim(r1[1]), [dir, 0], 6], [rim(r1[1] - 16), [dir, 0], 6], [up(16), [dir, 0], 10], [r1, [0, -1], 6], [r1, [0, -1], 16]]
      : [[r1, [0, -1], 6], [r1, [0, -1], 16], [r1, [dir, 0], 10], [up(16), [dir, 0], 10]];
    for (const [a, d, gap] of tries) if (label(tl, a, d, gap, math12, null, TH.ink2, below)) break;
    ctx.restore();
  }
  // Y Sphere: the images on the w-globe (U-b; the phase globe is X Sphere + Phase, renderSphereLeft)
  function renderSphere(pane) {
    // the Morph transport (homView): the regions under H_t
    const hv = typeof homView === 'function' ? homView() : null;
    // the w-plane targets on the globe (P3b): fills and outlines exactly per pixel (the preimage pass through the identity
    // map, as in Y Plane), points as marks; a target draft over them
    const edit = !hv && globeEdit('R');
    const post = [];
    if (edit && hasTargets()) post.push({ map: IDENT, targets: preimageTargets(false), halo: GLR.hexRGB(TH.halo) });
    const dp = edit ? globeDraftPass('R') : null;
    if (dp) post.push(dp);
    sphereView(pane, camS, CAMS, {
      imageMode: true, stage: rightStage(), plane: !!S.view.R.eq, role: 'R',
      probeW: probe ? (hv ? hv.F : focusF())(probe) : null, hom: hv,
      post, net: edit ? globeNet() : 'plain', targetPts: edit,
    });
  }
  // the conjugate lift of z = x + iy onto the Riemann sphere (panels.md 9.0; the GLSL lift in gl.js): 0 at the south
  // pole, infinity at the north pole, and seen from outside the globe keeps the plane's orientation
  function liftC(x, y) {
    const q2 = x * x + y * y;
    if (q2 > 1) { const iq = 1 / q2; return [2 * x * iq / (1 + iq), -2 * y * iq / (1 + iq), (1 - iq) / (1 + iq)]; }
    return [2 * x / (q2 + 1), -2 * y / (q2 + 1), (q2 - 1) / (q2 + 1)];
  }
  // the number of longitude sectors of the spherical checker (SPEC 6.3): 16 at pattern scale 1, even, 4 to 64
  const sphN = () => Math.max(4, Math.min(64, 2 * Math.round(8 / (S.patternScale || 1))));
  // the outcome of a globe's inverse pass (GLR.drawSphere onResult), as drawScene records a flat one
  function globeResult(role, s, res, live, fwd) {
    if (live && res === 'pending' && fwd) noteStandIn(role, s.id, fwd.map((f) => [f.res, f.st && f.st.cacheKey]));
    if (live) notePath(role, s.id, res === 'drawn' ? 'inverse' : res === 'pending' ? 'pending' : 'forward');
    if (res === 'pending') { if (live) { invWaiting.add(role); invPendN++; } else thumbNotFinal = true; }
    else if (res === 'drawn' && invWaiting.size) { const w = [...invWaiting].filter((x) => x !== role || !live); invWaiting.clear(); requestRender(...w, 'T'); }
    if (res === 'error' && GLR.inverseStatus(S.alpha, 'globe') === 'error') {
      const k = (GLR.inverseInfo || {}).key || '';
      if (k !== invFailKey) { invFailKey = k; scheduleFix(); }
    }
  }
  // A plane on the Riemann sphere, orbited by camera c (base: its fitted defaults). o.imageMode: the shapes of stage
  // o.stage lifted onto a plain globe with its graticule; otherwise the globe carries the phase portrait of the
  // focused map (or H_t with the Morph transport, o.hom) and the shapes are outlined. o.plane: the equatorial plane with the projection ray
  // of o.probeW; without it the probe is a dot on the globe. Returns the frame's {MVP, eye} or null.
  function sphereView(pane, c, base, o) {
    pane.begin(TH.plane);
    if (!GLR.ok) { noGL(pane); return null; }
    backdrop(pane);
    // 28 degree camera fitted to the globe and its labels at this pane's aspect (spec 6.10)
    // (with the equatorial plane on, frame more of the disc; its rim fades out, so the pane never cuts it hard)
    refitCam(c, base, GLR.fitDist(o.plane ? 1.75 : 1.16, base.fov, pane.w, pane.h, 1.05));
    // contact shadow (spec 6.10): an elliptical radial gradient, aspect 1.6 : 0.35, on the ground under the globe,
    // placed and sized from the globe's projection; it fades out as the camera drops below the ground
    const ctx = pane.ctx;
    {
      const pc = GLR.camera(c, pane.w, pane.h);
      const D = Math.hypot(...pc.eye);
      const c0 = project(pane, pc.MVP, [0, 0, 0]), cb = project(pane, pc.MVP, [0, 0, -1.03]);
      const k = Math.max(0, Math.min(1, (Math.sin(c.pitch) - 0.02) / 0.2));
      if (c0 && cb && D > 1 && k > 0) {
        const R = Math.tan(Math.asin(1 / D)) / Math.tan(base.fov / 2) * pane.h / 2;   // silhouette radius, px
        const flat = Math.max(0.6, Math.min(2.2, Math.sin(c.pitch) / Math.sin(18 * DEG)));
        const rr = 0.62 * R;
        ctx.save(); ctx.translate(cb[0], cb[1] + 0.04 * R); ctx.scale(1.6, 0.35 * flat);
        const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        const a = (TH.dark ? 0.28 : 0.18) * k;
        sg.addColorStop(0, withAlpha(TH.landShadow, a)); sg.addColorStop(0.45, withAlpha(TH.landShadow, a * 0.55)); sg.addColorStop(1, withAlpha(TH.landShadow, 0));
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    GLR.begin(pane.pw, pane.ph);
    const imageMode = o.imageMode;
    const regions = [], lines = [];
    // o.hom: the homotopy at time t (Morph transport): image mode lifts the shapes under H_t, phase mode paints H_t
    const hom = o.hom || null;
    // ((#366 prototype) o.lineMap: the steps view's glide moves the shapes in either paint, 19)
    const map = o.lineMap || (hom && imageMode ? (hom.imageMap || hom.map) : stageMap(o.stage));   // shapes live in the z-plane
    const cell = patternCell();
    const halo = GLR.hexRGB(TH.halo);
    // the same map cache keys as drawScene: orbiting the globe re-evaluates nothing (spec 8.1); homotopy frames go
    // to GLR's per-resource scratch evaluation instead (no cache entry per t)
    const cache = map.mode === 0, mk = mapKeyOf(map);
    // exact images on the globe (SPEC 4.6, 10.3): each area shape takes its path in list order, the inverse pass over
    // the globe's own triangles (every fragment exact, the poles ordinary pixels) or the lifted mesh; the frame's shape
    // records are packed once. o.role: 'R' the w-globe (Y Sphere), 'L' the z-globe (X Sphere, at stage 0 too)
    const role = o.role === 'L' ? 'L' : 'R', live = !offRender;
    const stretch = { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) };
    const smR = imageMode ? globeRpx(pane, c, base) : 0;   // the globe's radius, device px (SphereMesh's view)
    let recs = null;
    if (imageMode && GLR.packShapes && GLR.drawInverse && S.exactImages !== false && PHASE[role].globe
      && S.shapes.some((s) => s.visible !== false && kindType(s) === 'area')) {
      const m0 = normalizeMap(map);
      if ((m0.mode || 0) === 0 && invPlan(m0.a || 0, m0.b || 0).ok) {
        cmFormAnchor('X');
        recs = GLR.packShapes(S.shapes.filter((s) => s.visible !== false && !shapeStage(s))).recs;
        if (!sideDraw) lastRecs = recs;
        if (live) prepDeferred = false;
      }
    }
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point' || shapeStage(s)) continue;   // ([#253] the globes: the z-plane's shapes, flat planes first)
      const r = shapeGPU(s);
      const ink = shapeInk(s);
      const pf = imageMode && kindType(s) === 'area' && !hom ? pairFor(s, r, role) : { p: r, fx: null };   // fix-ups refine the static map
      if (imageMode && kindType(s) === 'area') {
        const fwd = [];
        // SPEC 8: a published SphereMesh of the globe (valid while the globe's radius is within 2x) replaces the lifted
        // mesh and its fix-ups; during a rebuild the old one is drawn (it covers the whole sphere)
        const pth = recs ? pathOf(s, map, role, 'globe', { recs, budget: live, status: true }).path : 'forward';
        const smd = !hom && (live || offRender) ? smFor(s, r, role, 'globe', map, pane, smR, live && pth === 'forward') : null;
        const sme = smd && (smd.e || smd.old);
        if (sme && !sme.data.n) { /* nothing of it shows on the globe */ } else if (sme && smRes(sme)) fwd.push({ pre: sme.res, st: Object.assign(smLook(s, pane, S.alpha), { view: null }) });
        else if (pf.p.meshRes) {
          const fx = pf.fx, pm = pf.p;
          const st = { map, dpr: pane.dpr, L: MESH_L, color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), skip: fx ? fx.skip : null, stretch,
            cacheKey: cache ? `${pm.meshKey}|${mk}` : null };
          fwd.push({ res: pm.meshRes, st });
          if (fx && fx.extraRes) fwd.push({ res: fx.extraRes, st: Object.assign({}, st, { skip: null, L: 1, cacheKey: cache ? `x|${fx.mapKey}|${mk}` : null }) });
        }
        const p = recs ? pathOf(s, map, role, 'globe', { recs, budget: live }) : null;
        if (p && p.path === 'inverse') {
          // a bounded shape's image box (in w; the shape's own box at stage 0) scissors its pass (gl.js globeScissorOf)
          let gbox = null;
          if (shapeBounded(s)) {
            if (p.plan.ops.length) gbox = invBox(p.e, p.plan, s, live);
            else { try { gbox = Region.bboxOf(s); } catch (err) { gbox = null; } }
          }
          regions.push({
            inv: { map: p.m, plan: p.plan, prep: p.prep, shape: s, dpr: pane.dpr, motion: live && interacting(), coldOk: offRender, globeBox: gbox,
              look: { color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha: S.alpha, alphaOwn: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), stretch } },
            fwd, onResult: (res) => globeResult(role, s, res, live, fwd),
          });
        } else {
          regions.push(...fwd);
          if (live && recs) notePath(role, s.id, p ? p.path : 'forward');
        }
      }
      const rl = linesOf(r, pf.p);
      if (rl.lineRes && !hideStrokes && !(artMode && artSkip && artSkip.has(s.id))) {
        const area = kindType(s) === 'area';
        lines.push({ res: rl.lineRes, st: { map, dpr: pane.dpr, M: 8, width: (area ? 1.5 : 2) * pane.dpr, color: imageMode ? GLR.hexRGB(ink.edge) : GLR.hexRGB(TH.dcCasing), alpha: 1, casing: { color: imageMode ? halo : [1, 1, 1], alpha: 0.85, width: (area ? 3.5 : 4) * pane.dpr }, cacheKey: cache ? `${rl.lineKey}|${mk}` : null } });
      }
    }
    // the deformation on Y's globe (merged-views.md: one globe): X's outline in grey under H_t(X), where the paths start
    // (at a focused step, the image of X at the step's input stage)
    if (hom && imageMode && role === 'R') {
      // (v16: with a bracket, H_0(∂X) = Q o P(∂X) through H0Map, SPEC 5.3)
      const base = S.focus > 0 ? S.focus - 1 : 0, bm = hom.range && hom.H0Map ? hom.H0Map : stageMap(base), bk = mapKeyOf(bm);
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) === 'point' || shapeStage(s)) continue;
        const r = shapeGPU(s), rl = linesOf(r, r);
        if (rl.lineRes) lines.unshift({ res: rl.lineRes, st: { map: bm, dpr: pane.dpr, M: 8, width: 1 * pane.dpr, color: GLR.hexRGB(TH.faint), alpha: 0.9, cacheKey: `${rl.lineKey}|${bk}` } });
      }
    }
    const info = GLR.drawSphere({
      map: o.colorMap || (hom ? hom.map : focusMap()), mode: imageMode ? 'image' : 'color', cam: c, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(),
      colors: { plane: TH.planeRGB, gridMajor: GLR.hexRGB(TH.gridMajor), axis: TH.axisRGB, ink: TH.inkRGB },
      shell: TH.planeRGB, ink: TH.dark ? [0.75, 0.8, 0.88] : [0.25, 0.3, 0.38],
      regions, lines, plane: !!o.plane, probe: o.plane && o.probeW ? { w: o.probeW } : null, pre: o.pre || null,
      post: (o.post || []).filter(Boolean), net: o.net || 'plain',
    });
    // a program that waits for its first draw is warmed at a quiet moment (as drawScene); a deferred preparation draws
    // inverse on the next frame
    if (recs && live && GLR.inverseColdWaiting) scheduleWarm(interacting() ? 100 : 0);
    if (recs && live && prepDeferred) { prepDeferred = false; requestRender(role); }
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    glStatusNote(pane);
    if (!info) return null;
    const lift = liftC;
    // (the figure's art layer: the camera, read back for the vector labels, points and paths; the canvas marks are left out)
    if (artMode || artCam) artGlobe = { MVP: info.MVP, eye: info.eye, w: pane.w, h: pane.h };
    if (artMode) return info;
    const facing = (p) => { const tv = [info.eye[0] - p[0], info.eye[1] - p[1], info.eye[2] - p[2]]; const l = Math.hypot(...tv) || 1; return (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / l; };
    // the region's points, lifted to the sphere
    const Fp = hom && imageMode ? (hom.imageF || hom.F) : stageF(o.stage);
    let pi = 0;
    const labels = [];
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) !== 'point' || shapeStage(s)) continue;
      const idx = pi++;
      const w = Fp(C(s.p[0], s.p[1]));
      const p = CX.isFin(w) ? lift(w.re, w.im) : [0, 0, 1];
      if (facing(p) <= 0) continue;
      const q = project(pane, info.MVP, p.map((v) => v * 1.01));
      if (!q) continue;
      ctx.fillStyle = shapeInk(s).edge; ctx.strokeStyle = TH.halo; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, TAU); ctx.stroke(); ctx.fill();
      // (under the deformation the primes count the steps begun, as on the merged plane: z₀′ for 0 < t <= 1)
      labels.push({ x: q[0], y: q[1], text: pointLabel(s, idx, hom && imageMode ? morphPrimes() : o.stage) });
    }
    // the w-plane's point targets on the w-globe (P3b), marked and labelled as in Y Plane
    if (o.targetPts) {
      let ti = 0;
      for (const s of S.targets || []) {
        if (kindType(s) !== 'point') continue;
        const idx = ti++;
        if (s.visible === false) continue;
        const p = lift(s.p[0], s.p[1]);
        if (facing(p) <= 0) continue;
        const q = project(pane, info.MVP, p.map((v) => v * 1.01));
        if (!q) continue;
        ctx.fillStyle = shapeInk(s).edge; ctx.strokeStyle = TH.halo; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, TAU); ctx.stroke(); ctx.fill();
        labels.push({ x: q[0], y: q[1], text: targetLabel(s, idx) });
      }
    }
    // the deformation's live paths t -> H_t(z) on the merged globe, over the sphere's front side
    if (hom && imageMode && role === 'R' && !figMode && S.morphPaths !== false && !morphHasDeriv()) {
      try {
        const Pg = (w) => { if (!w || !CX.isFin(w)) return null; const p = lift(w.re, w.im); return facing(p) > 0.02 ? project(pane, info.MVP, p.map((v) => v * 1.01)) : null; };
        drawMorphPathsX(pane, morphSelGlobe(pane, { MVP: info.MVP, eye: info.eye }), hom.imageF || hom.F, Pg);
      } catch (e) { console.error('deformation paths', e); }
    }
    if (labels.length) placeLabels(ctx, pane, labels);
    // without the plane, the probe is a ring on the globe
    if (!o.plane && o.probeW && CX.isFin(o.probeW)) {
      const p = lift(o.probeW.re, o.probeW.im);
      const q = facing(p) > 0 ? project(pane, info.MVP, p.map((v) => v * 1.01)) : null;
      if (q) {
        ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = TH.probe; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, TAU); ctx.stroke();
      }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 500 13px ${TH.math}`;
    const pts = [['0', [0, 0, -1]], ['∞', [0, 0, 1]], ['1', lift(1, 0)], ['i', lift(0, 1)], ['−1', lift(-1, 0)], ['−i', lift(0, -1)]];
    for (const [lab, p] of pts) {
      const f = facing(p);
      const u = Math.max(0, Math.min(1, (f - 0.05) / 0.25)), a = u * u * (3 - 2 * u);   // smoothstep(0.05, 0.3, n·v)
      if (a <= 0) continue;
      // poles: just beyond the globe; equator points: just above the |z| = 1 line, so the label never sits on it
      const q = project(pane, info.MVP, p[2] === 0 ? [p[0] * 1.06, p[1] * 1.06, 0.1] : p.map((v) => v * 1.1));
      if (!q) continue;
      // (a video frame: the figure draws these labels at full ink; their places still keep the point labels clear)
      if (artNoLab) { labelReg(pane).marks.push([q[0], q[1], 11]); continue; }
      ctx.globalAlpha = a;
      ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.strokeText(lab, q[0], q[1]);
      ctx.fillStyle = TH.label; ctx.fillText(lab, q[0], q[1]);
      if (a > 0.3) labelReg(pane).marks.push([q[0], q[1], 9]);   // point labels (placed after the frame) keep clear
    }
    ctx.globalAlpha = 1;
    return info;
  }
  // ---- X Sphere (S.view.L.surf 'sphere'): the left plane on the Riemann sphere, its shapes or its phase portrait ----
  // camL orbits it like camS (the app's drag, zoom and reset act on camL / CAML); sphereView keeps it fitted.
  // It starts below the equator, looking up at the south pole: the domain's shapes usually sit near 0.
  const CAML = { yaw: -60 * DEG, pitch: -24 * DEG, dist: 1.16 / Math.sin(14 * DEG) * 1.05, tx: 0, ty: 0, tz: 0, fov: 28 * DEG };
  const camL = Object.assign({ vyaw: 0, vpitch: 0 }, CAML);
  // the globe's pre passes: the targets' (pre) and ([#253]) those of the shapes of later planes (fills at half strength
  // over a phase portrait, as the targets')
  function preAll(pre, half) {
    const out = pre && pre.targets.length ? [pre] : [];
    for (const p of stagePreList(leftStage())) out.push(half ? Object.assign(p, { targets: p.targets.map((t) => (t.alpha < 1 ? Object.assign(t, { alpha: t.alpha * 0.5 }) : t)) }) : p);
    return out.length ? out : null;
  }
  function renderSphereLeft(pane) {
    // ((#366 prototype) the steps view's Inside regions on the globe, 19)
    if (svMaskOn() && lPhase()) return svSphereIn(pane);
    // X Sphere + Phase: the phase portrait of the map in focus on the globe (or of H_t with the transport open), the
    // shapes outlined (earlier the right pane's Sphere > Phase)
    // the w-plane targets pulled back by the focused map, painted on the globe (GLR.drawSphere st.pre) as in the flat
    // view, in both paints (over the portrait, area fills at half strength)
    const pre = typeof hasTargets === 'function' && hasTargets() && typeof preimageTargets === 'function'
      ? { map: endMap(), targets: preimageTargets(false), halo: GLR.hexRGB(TH.halo) } : null;
    if (lPhase()) {
      const hv = typeof homView === 'function' ? homView() : null;
      if (pre) pre.targets = pre.targets.map((t) => (t.alpha < 1 ? Object.assign(t, { alpha: t.alpha * 0.5 }) : t));
      return sphereView(pane, camL, CAML, { imageMode: false, stage: leftStage(), plane: !!xView().eq, probeW: probe || null, hom: hv, pre: preAll(pre, true), role: 'L', post: [globeDraftPass('L')], net: globeEdit('L') ? globeNet() : 'plain' });
    }
    // the left plane's point under the probe: the probe itself (it is kept in this plane's coordinates); a shape draft
    // drawn on the globe (P3b) over the shapes
    return sphereView(pane, camL, CAML, { imageMode: true, stage: leftStage(), plane: !!xView().eq, probeW: probe || null, pre: preAll(pre, false), role: 'L', post: [globeDraftPass('L')], net: globeEdit('L') ? globeNet() : 'plain' });
  }
  // a one-line note at the top of a sphere view, on a halo (what the globe leaves out)
  function sphereCaption(pane, text) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.font = `12px ${TH.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const y = pane.h - 14;   // at the foot of the pane (the readout sits at the top, the zoom buttons at the right)
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = TH.halo; ctx.strokeText(text, pane.w / 2, y);
    ctx.fillStyle = TH.muted; ctx.fillText(text, pane.w / 2, y);
    ctx.restore();
  }
  // the point of the left plane under pane pixel (x, y) (CSS px) of the sphere view: the ray from the eye through
  // the pixel meets the globe, and the stereographic projection from the north pole takes the hit to the plane.
  // null off the globe or at the north pole (infinity).
  function pickSphereLeft(x, y) { return pickSphere(paneL, camL, x, y); }
  let leftSphereInfo = null;   // the left globe's last frame {MVP, eye}: overlays lift their marks onto it
  function leftPaneBox() {
    const v = leftView(), P = solo() === 'R' ? paneR : paneL;
    return { x0: v.cx - P.w / 2 / v.s, x1: v.cx + P.w / 2 / v.s, y0: v.cy - P.h / 2 / v.s, y1: v.cy + P.h / 2 / v.s };
  }
  // (#385) the view controls: the view switch, Plane | Sphere, the Key switch, the Display options
  function setupViewControls() {
    // the view controls: the top bar's view switch (merged-views.md) and the panes' Plane | Sphere radios (U4)
    const vsw = $('viewSwitch');
    if (vsw) {
      for (const [v, l, k, html] of MAINS) vsw.append(h('button', { 'data-mode': v, role: 'radio', 'data-tip': `${l}  ${k}`, 'aria-label': l, html: `${VIEW_ICONS[v]}<span>${html}</span>`, onclick: () => setMain(v) }));
      vsw.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const i = MAINS.findIndex((x) => x[0] === S.view.main), j = Math.max(0, Math.min(MAINS.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        setMain(MAINS[j][0]); vsw.children[j].focus(); e.preventDefault();
      });
    }
    for (const side of ['L', 'R']) {
      const el = $(side === 'L' ? 'leftTabs' : 'rightTabs');
      for (const [v, l, k] of SURF[side]) el.append(h('button', { 'data-mode': v, role: 'radio', 'data-tip': k ? `${l}  ${k}` : l, 'aria-label': l, html: `${VIEW_ICONS[v]}<span>${l}</span>`, onclick: () => setView(side, v), ...(v === 'sphere' ? { onpointerenter: prestartGlobe, onfocus: prestartGlobe } : {}) }));
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const list = SURF[side], i = list.findIndex((x) => x[0] === (side === 'L' ? xView() : S.view.R).surf);
        const j = Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        setView(side, list[j][0]); el.children[j].focus(); e.preventDefault();
      });
    }
    // the Key switch in X's legend chip: the colour key painted in the Y plane
    const kc = $('wKeyChk');
    if (kc) kc.addEventListener('change', () => { setOpt('wKey', kc.checked); buildRightFoot(); requestRender('R'); save(); tourEmit('phase-key', { on: !!kc.checked }); });
    $('linesChk').addEventListener('change', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('lines', tg.checked); requestRender('L', 'R', 'T'); save(); });
    $('chevChk').addEventListener('change', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('chev', tg.checked); requestRender('L', 'R'); save(); });
    $('unitChk').addEventListener('change', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('unit', tg.checked); requestRender('L', 'R', 'T'); save(); });
    $('alphaRange').addEventListener('input', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('alpha', +tg.value); $('alphaVal').textContent = I18N.num(S.alpha.toFixed(2)); paintFader(tg); requestRender('L', 'R', 'T'); save(); });
    $('meshRange').addEventListener('input', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); showMeshVal(posToMesh(+tg.value)); });
    $('patScale').addEventListener('input', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('patternScale', 2 ** +tg.value); cellBase = 0; buildDisplay(); requestRender('L', 'R', 'T'); save(); });
    $('leftReadout').addEventListener('click', () => copyReadout('L'));
    $('rightReadout').addEventListener('click', () => copyReadout('R'));
    radioKeys($('patternSeg'));
  }
  // (#385) the panes' buttons: Fit, the legend chips, zoom (init: after applyLayout)
  function setupPaneButtons() {
    $('leftFit').addEventListener('click', () => {
      if (!lFlat()) { const c = camOf('L'); if (c) tweenCam(c, camBaseOf(c)); return; }
      paneL.setView(leftView());
      const target = fittedView(paneL, leftStage());
      if (leftStage() > 0) leftAuto = true;
      tweenView(leftView(), target, 260, () => sourceViewChanged());
    });
    $('rightFit').addEventListener('click', () => { rightAuto = true; fitRight(true, morphOn()); requestRender('R'); });
    // On a touch phone the legend chips start folded to their colour wheel and a tap unfolds them (merged-views
    // review: on a 356 px plot the key covered a third of the landscape); a tap on a folded or unfolded chip toggles
    for (const id of ['leftLegend', 'rightLegend']) {
      const el = $(id);
      if (!el) continue;
      try { if (matchMedia('(pointer: coarse)').matches && el.parentNode && !el.parentNode.classList.contains('pane-head')) el.classList.add('collapsed'); } catch (e) { /* no media queries */ }
      // ([#337] the pop-up in a pane head opens below the probe's readout and the notes it would cover)
      for (const ev of ['pointerenter', 'focusin', 'click']) el.addEventListener(ev, () => requestAnimationFrame(() => placeKeyPop(el)));
      el.addEventListener('click', (e) => { const tg = /** @type {HTMLElement} */ (e.target); if (tg.closest && tg.closest('.key-sw')) return; if (el.parentNode && el.parentNode.classList.contains('pane-head')) el.classList.toggle('open'); else if (document.documentElement.classList.contains('ph')) el.classList.toggle('collapsed'); });   // (#365: on a laptop Phase's key lies open on the plot)
    }
    for (const [side, pane] of [['left', paneL], ['right', paneR]]) {
      $(side + 'ZoomIn').innerHTML = ICONS.plus;
      $(side + 'ZoomOut').innerHTML = ICONS.minus;
      $(side + 'Fit').innerHTML = ICONS.fit;
      $(side + 'Solo').innerHTML = ICONS.expand;
      const zb = (f) => () => {
        const sd = side === 'left' ? 'L' : 'R';
        if (is3DSide(sd)) { zoomPane(pane, sd, pane.w / 2, pane.h / 2, f); return; }
        const v = sd === 'L' ? leftView() : V.right;
        pane.setView({ cx: v.cx, cy: v.cy, s: v.s });
        const target = { cx: v.cx, cy: v.cy, s: Math.min(1e9, Math.max(1e-6, v.s * f)) };
        if (sd === 'R') rightAuto = false; else if (leftStage() > 0) leftAuto = false;
        tweenView(v, target, 180, () => sourceViewChanged());
      };
      $(side + 'ZoomIn').addEventListener('click', zb(1.6));
      $(side + 'ZoomOut').addEventListener('click', zb(1 / 1.6));
    }
  }
