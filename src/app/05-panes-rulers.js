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
    // (an image that is a point up to rounding, a constant map, is framed ±1 around it, not zoomed to
    // the rounding scale; the floor is relative to the point, 1e-9 of max(1, |w|))
    const c = Math.max(1, Math.abs((b.x0 + b.x1) / 2), Math.abs((b.y0 + b.y1) / 2));
    if (Math.max(w, hh) < 1e-9 * c) { const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2; return { x0: mx - 1, x1: mx + 1, y0: my - 1, y1: my + 1 }; }
    if (w < m * 0.05) { b.x0 -= m * 0.1; b.x1 += m * 0.1; }
    if (hh < m * 0.05) { b.y0 -= m * 0.1; b.y1 += m * 0.1; }
    return b;
  }
  // CPU samples of what a stage shows, restricted to the part that comes from the visible z-window
  // (k: the plane sampled; a shape of a later plane is left out, of an earlier one its image is sampled)
  // (at most this many mesh vertices and this many points of a polygon go into a fit's samples)
  const MESH_SAMPLE_CAP = 2500, POLY_SAMPLE_CAP = 400;
  // the font size (px) of the sphere's marks (0, infinity, 1, i, -1, -i) on a pane
  const GLOBE_MARK_PX = 13;
  function stageSamples(F0, xs, ys, k) { const it = stageSampler(F0, xs, ys, k); while (!it.next().done) { /* the samples go to xs, ys */ } }
  // the same, a step at a time: it yields every 16 samples (a costly fit runs in slices, fitRightSliced)
  function* stageSampler(F0, xs, ys, k) {
    const core = Region.expandBox(clipWin, 1.05);
    const inCore = (x, y) => x >= core.x0 && x <= core.x1 && y >= core.y0 && y <= core.y1;
    let got = 0;
    const push = (w) => { if (CX.isFin(w) && Math.abs(w.re) < 1e9 && Math.abs(w.im) < 1e9) { xs.push(w.re); ys.push(w.im); } return ++got % 16 === 0; };
    for (const s of S.shapes) {
      if (s.visible === false) continue;
      const t = kindType(s);
      // (the curves and points of a construction, and the unit circle or an axis made a shape, are
      // lines to build with: Y's fit follows the user's own shapes and regions, never a large orthogonal circle's image)
      if ((s.def || s.fixed) && t !== 'area') continue;
      const F = shapeF(s, F0, k);
      if (!F) continue;
      if (t === 'point') { if (push(F(C(s.p[0], s.p[1])))) yield; continue; }
      const r = shapeGPU(s);
      if (t === 'area' && r.mesh) {
        const src = r.mesh.src, nv = src.length / 2;
        const stride = Math.max(1, Math.floor(nv / MESH_SAMPLE_CAP));
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
        const n = p.length / 2, stride = Math.max(1, Math.floor(n / POLY_SAMPLE_CAP));
        for (let i = 0; i < n; i += stride) { const x = p[2 * i], y = p[2 * i + 1]; if ((!unbounded || inCore(x, y)) && push(F(C(x, y)))) yield; }
      }
    }
  }
  function fitPane(pane, k, extraKs = [], F) {
    const xs = [], ys = [];
    stageSamples(F || stageF(k), xs, ys, k);
    for (const k2 of extraKs) stageSamples(stageF(k2), xs, ys, k2);
    const b = robustBox(xs, ys);
    if (b) pane.fitBox(b, 0.07);
    else pane.fitBox({ x0: -2, x1: 2, y0: -2, y1: 2 });
  }

  // ---------------- panes ----------------
  let paneL, paneR;
  let cutHandlesL = [];
  let cutMarksL = [];   // the cuts' handles on a frame between two planes: drawn like the editable ones, never hit-tested

  let hoverCut = 0;
  // the zeros and poles of a 'zp' step in its input plane (drawZpHandles): screen positions, the hovered one and the
  // selected one (Delete removes it); {k, kind: 'zeros' | 'poles', i}
  let zpHandlesL = [], zpHover = null, zpSel = null;
  // (k: the stage the left plane shows, default its own: z's view is S.srcView, a later stage's V.left)
  function leftView(k = leftStage()) { return k === 0 || (SV.on && svGliding()) ? S.srcView : V.left; }
  // (build/phone-swap.md: on a phone the inset draws its plane's view smaller; before the views are parked,
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
  // the left plane: the steps view draws it through svDrawPlane, which keeps this function's classic drawing (drawLeft) for
  // the planes it draws that way; on the Stack, svDrawPlane draws its floor (stackDrawPlane)
  function renderLeft() {
    const pane = paneL;
    if (SV.on) { mfDrawn = null; mfGlobeDrawn = null; if (!stackDrawPlane(pane, (p) => svDrawPlane(p, drawLeft))) svDrawPlane(pane, drawLeft); return; }
    drawLeft(pane);
  }
  // the classic drawing of the left plane: a flat coloured plane, X Phase, X Landscape and X Sphere, the steps view's
  // coloured planes and its globes and relief at rest among them
  function drawLeft(pane) {
    pane.setView(leftView());
    // (Landscape is not on this pane: its refinement's textures go)
    if (!lLand() && GLR.releaseLandscape) GLR.releaseLandscape();
    // X Plane + Phase: the phase portrait of the map in focus
    // (its shapes outlined, the target preimages, the points and the editable cuts drawn over it, as in X Plane)
    if (lColor()) { leftSphereInfo = null; cutHandlesL = renderColor(pane) || []; if (hasTargets()) { updateRoots(); drawRoots(pane); } return; }
    // X Landscape: the relief of the height over X
    if (lLand()) {
      cutHandlesL = []; leftSphereInfo = null; render3D(pane, SV.on ? svLandRest() : undefined);
      // the relief has no place for the target preimages (they show on the Plane and the Sphere): said, not dropped silently
      if (hasTargets() && GLR.ok) { const cap = $t('Target preimages show on the Plane and the Sphere'); paneCaption(pane, cap); paneSay(pane, 'land', cap); }
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
      // (the steps view's cuts: their image curves in this plane, on the globe)
      if (SV.on && info) { const k = leftStage(); drawCutCurvesAt(pane, (j0) => (j0 <= k && !derivIn(j0, k) ? rangeF(j0, k) : null), sphereProj(pane, info, 1), { k, jMin: 0, H: null }); }
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
    const cmSide = Construct.chipSide();   // (a construction tool's chip)
    if (cl) { const on = (poly && !draft.target) || cmSide === 'L'; if (cl.hidden === on) cl.hidden = !on; }
    if (cr) { const on = (poly && !!draft.target) || cmSide === 'R'; if (cr.hidden === on) cr.hidden = !on; }
    // how to close and back up, in the words of the pointer in use (a finger has no Enter)
    if (poly) {
      const sp = (draft.target ? cr : cl) && (draft.target ? cr : cl).firstElementChild;
      const txt = fingerNow() ? $t('Tap the first point to close · Undo removes the last point') : $t('Click the first point or press Enter to close · ⌫ removes the last point');
      if (sp && sp.textContent !== txt) sp.textContent = txt;
    }
    Construct.syncChip();
    // P3b: the globes take drawing (panels.md 9). What still draws nothing says so: the landscape, a planar-centred
    // tool on a globe (Annulus, Sector, Polar grid: 'Draw in Plane')
    const sc = $('sphereChipL');
    if (sc) {
      // (the Pick tool picks on the Landscape's sheets, 19-land-pick.js: it draws nothing there)
      const drawing = tool !== 'select' && !(tool === 'pick' && landPickOn());
      const where = lLand() ? $t('the landscape') : $t('the Riemann sphere');
      const toolName = (TOOLS.find((t) => t[0] === tool) || [])[1] || '';
      const pickHint = tool === 'pick' && landPickOn() && !document.documentElement.classList.contains('ph');
      let msg = '';
      if (drawing && lLand()) msg = $t('Drawing is off on {where}; choose X → Y (1) to draw.', { where });
      // (the Pick tool on the Landscape's sheets: its gestures, 19-land-pick.js, beside the readout's orbit hint; on a
      // phone the readout's hint says them, idleLeft, and no chip covers the plane's keys)
      else if (pickHint) msg = landPickPhrases(fingerNow() ? $t('Tap to pick · hold and slide to read') : $t('Click to pick · hold and slide to read'));
      else if (drawing && lGlobe() && GLOBE_OFF.has(tool)) msg = $t('{toolName} draws in Plane, not on the sphere.', { toolName });
      // listening: the chip says what plays, and its Stop button ends it (Esc too)
      let act = null;
      if (!msg) { msg = listenChipMsg(); if (msg) act = { stop: true }; }
      // (the Mountain King's hint, with its Listen button, in X's title row, over no plane; only
      // where that row is not shown, here, while nothing else is said here)
      const q = pieceHint(), inHead = syncPieceHint(q);
      if (!msg && q && !inHead) { act = q; msg = q.msg; }
      const on = !!msg;
      if (sc.firstChild.textContent !== msg) sc.firstChild.textContent = msg;
      let ab = /** @type {HTMLElement | null} */ (sc.querySelector('.chip-act'));
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
    syncGlobeTools();
  }
  // Annulus, Sector and Polar grid are dimmed while X shows its globe (panels.md 9.2: tooltip 'Draw in Plane'). The Pick tool
  // (19-floor-pick.js) is hidden where it does not pick (pickAvail), its button keeping its place (tool-na: the phone's
  // Tools sheet leaves it out), and put down there
  let globeToolsOff = null;
  function syncGlobeTools() {
    const off = lGlobe(), pick = pickAvail();
    const k = `${off}|${pick}`;
    if (k === globeToolsOff) return;
    globeToolsOff = k;
    for (const b of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('.tool[data-tool]'))) {
      if (b.dataset.tool === 'select') continue;
      if (b.dataset.tool === 'pick') { b.classList.toggle('tool-na', !pick); b.setAttribute('aria-hidden', String(!pick)); }
      const g = off && GLOBE_OFF.has(b.dataset.tool);
      b.classList.toggle('globe-off', g);
      // (dimmed, it says so: a press still explains, so it stays focusable)
      if (g) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      const base = b.dataset.tipBase || (b.dataset.tipBase = b.dataset.tip || '');
      b.dataset.tip = g ? $t('{base} · Draw in Plane', { base }) : base;
    }
    // (the tool grid's one Tab stop, roveGroups, skips a hidden tool)
    roveGroups();
    if (!pick && tool === 'pick') setTool('select');
  }
  function renderOverlays() {
    updateDraftChips();
    updateUndo();
    ctxChanged();
    paneL.setView(leftView()); paneL.beginOverlay();
    const sphL = !lFlat(); // the sphere, landscape and Stack views of X have no flat overlays
    const projL = lGlobe() && leftSphereInfo ? sphereProj(paneL, leftSphereInfo) : null;
    zpHandlesL = [];
    if (!sphL) {
      // (Look down's marks under the handles and the probe)
      drawLookDown(paneL);
      drawCutHandles(paneL, cutHandlesL);
      drawCutHandles(paneL, cutMarksL, true);
      drawZpHandles(paneL);
      if (leftStage() === 0) { drawHandles(paneL, planeShapes()); if (!draft || !draft.target) drawDraft(paneL); Construct.drawOverlay(paneL, 'L'); if (tool !== 'select' && probe) drawCrosshair(paneL, draft && !draft.target && draft.cursor || probe); }
      // (a plane of the chain: its own shapes' handles and the draft; constructions are the z-plane's)
      else { drawHandles(paneL, planeShapes()); if (!draft || !draft.target) drawDraft(paneL); if (tool !== 'select' && probe) drawCrosshair(paneL, draft && !draft.target && draft.cursor || probe); }
      // (over the phase portrait the probe is white on a dark casing, as the portrait's own lines)
      // (not over a zero or pole under the pointer, or one being dragged: the handle is what the pointer holds)
      if (probe && !zpHover && !(drag && drag.mode === 'zp')) { if (lColor()) drawProbe(paneL, probe, '#FFFFFF', TH.dcCasing); else drawProbe(paneL, probe, TH.probe); }
      if (SV.on) drawFloorPick(paneL);
    } else if (!stackDrawOverlay(paneL)) syncLookKey(false);
    // the curve of an open integral popover, with its direction (X: its plane or its globe)
    if (intPop && !lLand()) drawIntHighlight(paneL, projL);
    // the preimages of the hovered point w
    if (hov.w && hov.list && !lLand()) drawHoverPreimages(paneL, projL);
    // the globe's handles, polygon vertices and snap ring (P3b)
    if (lGlobe() && globeEdit('L')) drawGlobeEdit('L');
    if (!sphL) drawRulers(paneL, 'L', true);
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
    if (corner && seen.corner !== cornerHtml) { corner.innerHTML = cornerHtml ? `<span>${cornerHtml}</span>` : ''; seen.corner = cornerHtml; }   // (one grid item: the letter and its subscript share a line, not a row each)
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
      // (the UI face: "0.5", since the mono face (B612 Mono) cannot set it: "0. 5"; an imaginary label's i in the maths italic, so the
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
    ledSay(side, state, el.getAttribute('data-tip'));
  }
  // the LEDs' changes are said in the polite region #ledLive, together, once no LED's state has changed for LED_SAY_MS: each
  // with its pane's title before it when the pane has one; a pane that is not shown says nothing. A page that starts up
  // to date says nothing, and a state that comes and goes within the wait is not said
  const LED_SAY_MS = 500, ledSaid = {}, ledNow = {};
  let ledSayT = 0;
  function ledSay(side, state, tip) {
    // (what is said again is a different state, or a different error: busy is one state whatever its tip)
    const key = state === 'err' ? 'err|' + tip : state;
    const same = !!ledNow[side] && ledNow[side].key === key;
    ledNow[side] = { key, tip };
    if (same) return;
    clearTimeout(ledSayT);
    ledSayT = setTimeout(ledFlush, LED_SAY_MS);
  }
  function ledFlush() {
    const parts = [];
    // (a pane that is shown: its LED may not be, on a phone, whose pane heads show none, and its words are heard all the same)
    const shown = (side) => { const el = $(side === 'L' ? 'leftLed' : 'rightLed'), pane = el && el.closest('.pane'); return !!pane && pane.getClientRects().length > 0; };
    // (a pane whose title is hidden at this width, the right one in Russian at 1280 px, is named by its letter while two panes are shown:
    // the words alone would not say which pane they are about)
    const two = shown('L') && shown('R');
    for (const side of ['L', 'R']) {
      const n = ledNow[side];
      if (!n || !shown(side) || (ledSaid[side] === undefined ? 'ok' : ledSaid[side]) === n.key) continue;
      ledSaid[side] = n.key;
      const t = document.querySelector(side === 'L' ? '#leftTitle .ptitle' : '#rightTitle .ptitle'), title = t && t.getClientRects().length ? t.textContent.trim() : '';
      const name = title || (two ? (side === 'L' ? 'X' : 'Y') : '');
      parts.push(name ? `${name}: ${n.tip}` : n.tip);
    }
    const live = $('ledLive');
    if (live && parts.length) live.textContent = parts.join('. ');
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
    // (a pane whose last frame said why its plot has no value, glStatusNote's note, keeps saying it, as an error; one whose
    // "Compiling…" note is drawn is busy, and its LED says so: both notes are canvas text, which a screen reader does not read)
    const note = (side) => (paneGl[side] && paneGl[side].note) || '';
    const compTip = (side) => (compileShown[side] ? $t('Compiling…') : undefined);
    // (X is the one plane both views draw: its LED also reports a step that fails to build, which Y's hidden LED holds too)
    if (note('L') || errTip) setLed('L', 'err', note('L') || errTip);
    else setLed('L', busy || colourPending() || compileShown.L ? 'busy' : 'ok', colourPending() ? $t('Drawing a quick preview; the exact plot is still being built') : compTip('L'));
    setLed('R', errStep >= 0 || note('R') ? 'err' : busy || compileShown.R ? 'busy' : 'ok', errTip || note('R') || compTip('R'));
  }
  // the colour plot's grid: the major grid and the axes in white over the colours, in 2D over the pane's frame (the
  // steps view's frames between planes draw it too, so a glide's frames look like the plane's)
  function colourGrid(pane) {
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
  }
  function renderColor(pane) {
    pane.noteBox = null;   // (no note drawn yet in this frame: noGL, glStatusNote and the Cauchy notes each set it)
    pane.setView(leftView());
    if (!GLR.ok) { pane.begin(TH.plane); noGL(pane); return; }
    pane.begin(TH.plane);
    GLR.begin(pane.pw, pane.ph);
    // the Cauchy style (st.cauchy: the nodes of the selected closed curve, F inside, 0 outside)
    const cz = S.dc === 'cauchy' && typeof cauchyDraw === 'function' ? cauchyDraw(pane.view.s) : null;
    const cst = { map: S.dc === 'cauchy' ? cauchyMap() : focusMap(), view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: cz };
    // (the steps view's Inside regions: the colour only inside the regions of this plane, on the GPU, else in 2D; 19)
    // (the steps view draws the Cauchy style on plane z only, where its curve lies: with the colour plane elsewhere, or no
    // curve selected, the plane is paper with its reason)
    const cauchyWhy = SV.on ? svCauchyWhy(cz) : '';
    if (cauchyWhy) { paper(pane); setColourWaiting(false); }   // (paper waits on no program)
    else {
      // (while the plot's program links with nothing to stand in for it: its values on a grid, colourStandIn)
      cst.standIn = colourStandIn(pane, cst.map, GLR.colorProgName(cst));
      if (svMaskOn()) svColourIn(pane, cst); else GLR.drawColorPlot(cst);
    }
    const cauchyIdle = S.dc === 'cauchy' && !cz && !SV.on;
    // (the steps view, in both scopes: the regions of later planes pulled back here, a layer of their own over the colour,
    // under the outlines; left out with the strokes, hideStrokes)
    if (SV.on && !artMode && !hideStrokes) stagePullbacks(pane, leftStage(), true, true);
    // (with Outlines off the plane draws no curves but the selected shape's)
    if ((S.outline || selected) && !artMode && !hideStrokes) {
      const map0 = stageMap(leftStage());
      for (const s of S.shapes) {
        if (!outlineShown(s)) continue;
        const map = shapeMap(s, map0);
        if (!map) continue;
        const o = outlineRes(map, shapeGPU(s), pane);
        if (!o) continue;
        const dash = openDash(o.rec, map);
        GLR.drawLines(o.res, Object.assign({ map, view: pane.view, dpr: pane.dpr, M: OUTLINE_M, cpu: () => cpuMap(map) }, SV.on ? shapeStroke(s, pane.dpr, { domain: leftStage() === 0, plane: leftStage() }) : { width: 1.3 * pane.dpr, color: GLR.hexRGB(TH.dcCasing), alpha: 0.9, casing: { color: [1, 1, 1], alpha: 0.95, width: 3 * pane.dpr } }, { cacheKey: `${o.rec.lineKey}|${mapKeyOf(map)}` }, dash));
      }
    }
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (cauchyWhy) sumDrop(pane); else sumWatch(pane, cst.map);
    // (the grid under the pane's notes, which glStatusNote draws)
    if (!artMode) colourGrid(pane);   // (the figure's art layer: no screen grid, axes, targets, cuts or points)
    glStatusNote(pane);
    if (artMode) return [];
    // as in X Plane (panels.md 1, target preimages in every X view): the w-plane targets pulled back by the focused
    // map (area fills at half strength, so the portrait reads through them; their edges as drawn), the points, and
    // the cuts with their handles
    const k = leftStage();
    if (hasTargets()) drawPullback(pane, endMap(), halfFills(preimageTargets(false)));
    const handles = drawCuts(pane, k, true, false);
    drawPoints(pane, stageF(k), { primes: k, domain: k === 0, k, editK: k });
    // (the points of later planes, by their preimages here, as in X Plane)
    if (pane === paneL) { updatePre('L', pane, k); drawPre(pane, 'L', k); }
    if (cauchyWhy) paneNote(pane, cauchyWhy);
    else if (cauchyIdle) paneNote(pane, $t('Cauchy style: select a closed curve or a bounded region to see its Cauchy integral.'));
    else if (cz && cz.plan && cz.plan.why === 'onCurve') paneNote(pane, $t('Cauchy style: F is not finite on the curve (a pole on it), so its Cauchy integral is not defined.'));
    drawRulers(pane, pane === paneL ? 'L' : 'R');
    return handles;
  }
  function dcGridStep() { return S.dcGrid || 0.5; }
  // backdrop for 3D views (spec 6.9): vertical gradient --land-top -> --land-bottom, times a vignette 1 - 0.06 r^2
  // (r = 1 at the corners)
  function backdrop(pane) {
    const ctx = pane.ctx;
    if (artRelief) return; // the coverage render: a transparent backdrop, so the alpha is the relief's coverage
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
  // median |F| over the box (used to scale |F|, Re F and Im F heights): of the focused map at t = end (a steady scale
  // while morphing), or of map (a map spec of the left plane, with Fm its CPU twin): the steps view's planes. One
  // value cached per map
  const muCache = new Map();
  function medianAbs(box, map, Fm) {
    const mk = map ? mapKeyOf(map) : SV.on ? mapKeyOf(svMap()) : '';
    const key = `${chainSig[nSteps()]}|${S.focus}|${mk}|${box.x0},${box.x1},${box.y0},${box.y1}|${S.height}`;
    if (muCache.has(key)) return muCache.get(key);
    const F = map ? Fm : typeof plotF === 'function' ? plotF() : focusF(), vals = [];
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
      const w = F(C(box.x0 + (i + 0.5) / 32 * (box.x1 - box.x0), box.y0 + (j + 0.5) / 32 * (box.y1 - box.y0)));
      const v = S.height === 're' ? Math.abs(w.re) : S.height === 'im' ? Math.abs(w.im) : CX.abs(w);
      if (Number.isFinite(v)) vals.push(v);
    }
    vals.sort((a, b) => a - b);
    const mu = vals.length ? Math.max(1e-6, vals[Math.floor(vals.length / 2)]) : 1;
    if (muCache.size > 8) muCache.delete(muCache.keys().next().value);
    muCache.set(key, mu);
    return mu;
  }
  // the landscape's domain: the left view box, aspect preserved (spec 6.9), trimmed to at most 2:1 about its centre
  // (v: a view of the left plane, default its own: the steps view's glide asks for both planes')
  function landBox(v) {
    // (a figure's art: the window figure.js chose, snapped to round numbers; the screen never takes this path)
    if (artMode && artLandBox) return artLandBox;
    const vb = leftPaneBox(v);
    const mx = (vb.x0 + vb.x1) / 2, my = (vb.y0 + vb.y1) / 2;
    let w = vb.x1 - vb.x0, h = vb.y1 - vb.y0;
    if (w > 2 * h) w = 2 * h; else if (h > 2 * w) h = 2 * w;
    const b = { x0: mx - w / 2, x1: mx + w / 2, y0: my - h / 2, y1: my + h / 2 };
    // (a video frame: the window the still of that plane has, its edges rounded)
    return artLandRound && !artMode ? artLandRound(b) : b;
  }
  // carry (the steps view's Landscape as carried points, svLandCarry): {map, s, T, hT, hmap, plain, key, lim, u, a, b, vs, va, vb, rest}: plane
  // s's points moved by map (GLR.drawLandscape's carry), at the heights of the stages (s, hT] and in the colours of
  // (s, T]; its block and its height scale go from plane a's to plane b's over u (the box's centre linearly, its size
  // and the scale in log; b null: plane a's), so the block, its floor and its axes move smoothly from one plane's rest
  // frame to the other's. vs, va, vb: the views of planes s, a and b; rest: the plane at rest the frame is, or null
  // p to q at f in log (p, q > 0)
  const logLerp = (p, q, f) => Math.exp((1 - f) * Math.log(p) + f * Math.log(q));
  function carryBox(c) {
    const A = landBox(c.va), B = c.b == null ? A : landBox(c.vb), u = c.u;
    const mid = (p, q) => (1 - u) * p + u * q, geo = (p, q) => logLerp(p, q, u);
    const cx = mid((A.x0 + A.x1) / 2, (B.x0 + B.x1) / 2), cy = mid((A.y0 + A.y1) / 2, (B.y0 + B.y1) / 2);
    const hw = geo(A.x1 - A.x0, B.x1 - B.x0) / 2, hh = geo(A.y1 - A.y0, B.y1 - B.y0) / 2;
    return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
  }
  function render3D(pane, carry) {
    pane.noteBox = null;   // (no note drawn yet in this frame, as renderColor's)
    pane.begin(artRelief ? 'rgba(255,255,255,0)' : TH.plane);
    if (!GLR.ok) { noGL(pane); return; }
    backdrop(pane);
    const box = carry ? carryBox(carry) : landBox();
    // All sheets (S.sheets, window S.sheetW): the whole covering surface of the focused map instead of its cut
    // principal branch; a single-valued F, as √ then z², draws its principal branch (multiSheet null)
    // (uniq: the combos that are distinct sheets of the map drawn, so coinciding surfaces are drawn once)
    const sheetW = sheetWOf(S.sheetW);
    const sheetMap = landSheetsMap(carry ? carry.s : null);
    const sheets = S.sheets && multiSheet(sheetMap) ? { W: sheetW, end: 0, uniq: sheetUniqOf(sheetMap, sheetW) } : null;
    let mu = S.height === 'log' ? 1 : medianAbs(box);
    if (carry && S.height !== 'log') {
      const ma = medianAbs(landBox(carry.va), svHeightMap(carry.a), svHeightF(carry.a));
      const mb = carry.b == null ? ma : medianAbs(landBox(carry.vb), svHeightMap(carry.b), svHeightF(carry.b));
      mu = logLerp(ma, mb, carry.u);
    }
    // (the height ruler's labels step by this scale, the surface's own before All sheets' spread: between planes the
    // planes' scales blended as the surface's are, so the labels on arrival are the parked plane's)
    const rulerMu = mu;
    // all sheets with height Re F / Im F: the scale from the 90th percentile of the values over every surface drawn
    // (the sheets of log stack 2 pi i apart: the principal branch's scale, or even the median, flattened the outer
    // ones into stacked plates), so the height is nearly linear in the value and every turn keeps its pitch; the
    // block is made taller by how far the surfaces stack (the spread of the values over all of them against the
    // principal one's, x 0.8, within 1..4.5), so a helicoid reads as one. Cached per chain, focus, box, height, window.
    let lscale = S.lscale || 1;
    render3D.linear = false;
    // (the share of the compressed height in a carried frame's linear one, between its planes' looks at rest: GLR's
    // heightComp)
    let hComp = 0;
    const fm = carry ? carry.hmap : focusMap(), si = sheets && GLR.sheetInfo ? GLR.sheetInfo(fm, sheets.W) : null;
    if (si && S.height !== 'log' && typeof Funcs.sheetEval === 'function') {
      const lin = S.height === 're' || S.height === 'im';
      const q = (a, f) => a[Math.min(a.length - 1, Math.max(0, Math.floor(f * a.length)))];
      const mu0 = mu;
      const zAtIn = (bx) => (i, j) => C(bx.x0 + (i + 0.5) / 12 * (bx.x1 - bx.x0), bx.y0 + (j + 0.5) / 12 * (bx.y1 - bx.y0));
      const hOf = (w) => (w ? landValue(w) : NaN);
      // the scale and the block's boost of the surfaces of map fmK (K sheets) over bx, cached per (chain, map, box, height, window)
      const scaleOf = (fmK, bx) => {
        // the combos drawn: the distinct sheets of fmK
        const combos = sheetUniqOf(fmK, sheets.W);
        const ck = `${chainSig[nSteps()]}|${mapKeyOf(fmK)}|${S.focus}|${bx.x0},${bx.x1},${bx.y0},${bx.y1}|${S.height}|${sheets.W}|${combos.join(',')}`;
        const cache = render3D.muScales || (render3D.muScales = new Map());
        let r = cache.get(ck);
        if (r) return r;
        const zAtB = zAtIn(bx);
        const vals = [], sv = [], sv0 = [];
        for (const k of combos) for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
          const z = zAtB(i, j);
          // a sheet that cannot be evaluated at z (a throw) is no sample, like a non-finite value
          let w = null;
          try { w = Funcs.sheetEval(S.steps, built, fmK.b, z, z, k, sheets.W, { a: fmK.a || 0 }); } catch (e) { w = null; }
          const x = hOf(w);
          if (!Number.isFinite(x)) continue;
          vals.push(Math.abs(x)); sv.push(x);
          if (k === 0) sv0.push(x);
        }
        for (const a of [vals, sv, sv0]) a.sort((x, y) => x - y);
        // linear heights over all sheets: the scale is (nearly) the largest value, so the surfaces fill the block
        const s0 = sv0.length ? q(sv0, 0.95) - q(sv0, 0.05) : 0, s1 = sv.length ? q(sv, 0.95) - q(sv, 0.05) : 0;
        r = { mu: vals.length ? Math.max(1e-6, q(vals, lin ? 0.98 : 0.5)) : mu0, boost: lin && s0 > 0 && s1 > 0 ? Math.max(1, Math.min(4.5, 0.8 * s1 / s0)) : 1 };
        if (cache.size > 16) cache.delete(cache.keys().next().value);
        cache.set(ck, r);
        return r;
      };
      // a carried frame: each plane's look at rest, from plane a's to plane b's over u (the scale and boost in log), so
      // a frame depends on u alone and a glide parks on the plane's own look. A plane whose height map at rest (its
      // rest carry's, else svHeightMap) has sheets has their scale and block and, with Re or Im heights, the linear
      // height (lw 1); one without has the plane's median and the compressed height (lw 0), the sheets-off carry's
      // scale
      const restSheets = (k) => !!(GLR.sheetInfo && GLR.sheetInfo((svLandRest(k) || { hmap: svHeightMap(k) }).hmap, sheets.W));
      const ofPlane = (k, v) => (restSheets(k)
        ? Object.assign({ lw: lin ? 1 : 0 }, scaleOf(svHeightMap(k <= carry.T ? k : carry.s), landBox(v)))
        : { mu: medianAbs(landBox(v), svHeightMap(k), svHeightF(k)), boost: 1, lw: 0 });
      const c = carry ? (() => {
        const ra = ofPlane(carry.a, carry.va), rb = carry.b == null ? ra : ofPlane(carry.b, carry.vb);
        return { mu: logLerp(ra.mu, rb.mu, carry.u), boost: logLerp(ra.boost, rb.boost, carry.u), lw: ra.lw + (rb.lw - ra.lw) * carry.u };
      })() : Object.assign({ lw: lin ? 1 : 0 }, scaleOf(fm, box));
      mu = c.mu;
      lscale *= c.boost || 1;
      if (c.lw > 0) { render3D.linear = true; hComp = 1 - c.lw; }
    }
    // 28 degree camera fitted to the bounding sphere of the block and its plate at this pane's aspect
    const geo = GLR.landGeom(box, lscale);
    refitCam(cam, CAM3, landFitDist(geo, artCamAsp ? { w: pane.h * artCamAsp, h: pane.h } : pane));
    const view = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, tx: cam.tx, ty: cam.ty, tz: geo.center[2], fov: CAM3.fov };
    // (the carried grid: over plane s's block)
    const src = carry ? landBox(carry.vs) : null;
    const cells = S.meshN >= 1920 ? 512 : S.meshN >= 480 ? 384 : 256;   // spec 6.9: 256² vertices, 384² at Fine and above, 512² at Max
    // (the carried grid's patches about the glide map's poles and branch points and the height map's far poles: svLandPatches)
    const polar = carry ? svLandPatches(carry.map, src, cells, cpuMap(carry.hmap), 'h' + carry.s + ':' + carry.hT, !(carry.copies && carry.copies.length)) : null, far = carry ? svLandFar(src) : null;
    // (the steps view's Inside regions: the carried region set of the surface's plane, over its box; drawn before the
    // landscape's frame begins, as it takes a GL frame of its own)
    const mask = SV.on ? (carry ? (carry.plain ? svLandPlainMask() : svLandMask(carry.s, src)) : svLandMask(svStage(), box)) : null;
    // (a hatched surface says why, as the plane does: glStatusNote)
    if (mask && mask.unres > 0) hatchNotes.set(pane, mask.refused ? refusedNote() : hatchedNote());
    GLR.begin(pane.pw, pane.ph);
    // source outlines printed on the floor, in the plane the landscape is built on (stage focus - 1)
    const outlines = [];
    const omap0 = carry && carry.zmap ? carry.zmap : stageMap(leftStage());
    // (the steps view's Inside regions: a region's outline is thin and grey, on the floor under its surface's edge)
    const footprint = mask && mask.cut && !(carry && carry.plain) ? new Set(visibleAreas()) : null;
    // (the floor as a pane for outlineRes: its box across the pane's width, so a Repeat chain's carried outline is
    // drawn on the floor by the flat plane's rule, in a slot of its own)
    const floorPane = { view: { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, s: pane.w / (box.x1 - box.x0) }, w: pane.w, h: pane.h };
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const omap = SV.on ? svShapeMap(s, omap0) : shapeMap(s, omap0);
      if (!omap) continue;
      const o = outlineRes(omap, shapeGPU(s), floorPane, 'F');
      if (!o) continue;
      const cacheKey = `${o.rec.lineKey}|${mapKeyOf(omap)}`;
      outlines.push(footprint && footprint.has(s) ? { res: o.res, color: GLR.hexRGB(TH.landFootprint), map: omap, cacheKey, width: 1 }
        : { res: o.res, color: GLR.hexRGB(shapeInk(s).edge), map: omap, cacheKey });
    }
    const landMap = carry ? carry.hmap : focusMap();
    const info = GLR.drawLandscape({
      map: landMap, standIn: carry ? null : landStandIn(pane, landMap, box, !!si), carry: carry ? { map: carry.map, s: carry.s, T: carry.T, hT: carry.hT, u: carry.u, key: carry.key, lim: carry.lim, src, polar, far, copies: carry.copies || null, standIn: landCarryStandIn(pane, carry, src) } : null, box, cam: view, heightMode: render3D.linear ? `${S.height}Lin` : S.height, heightComp: hComp, scale: lscale, mu, material: landMaterial(), unitLevel: !!S.unitLevel && !artMode, sectors: S.sectors || 12, floorPrint: !artMode, seaLine: !artMode,
      cells, sheets, mask, outlines: artMode || hideStrokes ? [] : outlines, probe: probe ? { x: probe.re, y: probe.im, flat: landOffRegion(mask, probe) } : null, bg: GLR.hexRGB(TH.landBottom),
      // (the refinement of steep walls: capped while something moves, in full at rest and in every figure or film)
      motion: !offRender && interacting(), full: offRender || figMode, reliefOnly: artMode && artRelief,
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
    if (info && (artMode || artCam)) artLand = { MVP: info.MVP, aspect: info.aspect, floorZ: info.floorZ, eye: info.eye, top: info.top, heightOf: info.heightOf, mask: mask && mask.cut ? mask : null, box, w: pane.w, h: pane.h };
    if (info && !artMode) draw3DLabels(pane, info, box, rulerMu);
    render3D.sheetsInfo = info ? info.sheets : null;   // (what the last frame drew: tests)
    // (a frame of the CPU stand-in's relief draws the principal branch alone, so the title does not say the sheets until the frame
    // that draws them: its words follow this. An export's frame (offRender) never draws the stand-in and is not the screen's, so it
    // leaves it as the screen's last frame set it)
    const standing = !!(info && info.standIn);
    if (!offRender && standing !== !!render3D.standIn) { render3D.standIn = standing; if (S.sheets) { updateFocusUI(); svSync(); } }
    render3D.carried = info && info.carried ? { u: carry.u, s: carry.s, copies: info.copies || 0, copyAlpha: info.copyAlpha ?? null, hmap: carry.hmap, mu, box, sheets: !!info.sheets, sheetPlaces: !!info.sheetPlaces, plain: !!carry.plain, refined: !!(info.refine && info.refine.groups.length), polar, far: info.far, patches: info.patches, map: carry.map, lim: carry.lim, src, cells, patchN: info.patchN } : null;   // (the last frame's carry: tests)
    render3D.box = box;
    render3D.floor = info ? { info, box, w: pane.w, h: pane.h } : null;   // (the last frame's floor: tests)
    render3D.mask = info ? mask : null;   // (the last frame's Inside-regions mask: tests)
    // what pickLand needs to find the point of X under the pointer (the last frame's camera, block and heights)
    // (a carried frame of a plane at rest picks on the carried heights, svLandPickF; one between two planes has no probe.
    // fibre: on a plane past its source plane, its sheets over a point, which the Pick tool picks on: pickLandSheet)
    render3D.pick = carry && carry.rest == null ? null : info && !figMode ? { cam: view, box, info, mask, w: pane.w, h: pane.h, F: carry ? svLandPickF(carry, src) : focusF(), fibre: carry && carry.s < carry.rest ? svLandFibreF(carry, src, carry.rest) : null } : render3D.pick;
    // (the Pick tool's lit twins on the sheets, 19-land-pick.js)
    if (info && !artMode && !figMode && pane === paneL) drawLandPicks(pane);
    glStatusNote(pane);
  }
  render3D.linear = undefined; render3D.ticks = undefined; render3D.names = undefined; render3D.carried = undefined; render3D.box = undefined; render3D.mask = undefined; render3D.floor = undefined; render3D.muScales = undefined; render3D.sheetsInfo = undefined; render3D.standIn = undefined; render3D.pick = undefined;
  // the Landscape's Inside-regions mask m (the frame's, null without) at the point (x, y) of its plane: its alpha 0 to 1,
  // null with no mask, and outside its box null, or with clamp the alpha of the nearest edge texel (the shader's);
  // px: the mask's pixels (RGBA, row by row) when the caller has read them for many points, else this point's is read
  function landMaskAlpha(m, x, y, clamp, px) {
    if (!m) return null;
    let u = (x - m.box.x0) / (m.box.x1 - m.box.x0), v = (m.box.y1 - y) / (m.box.y1 - m.box.y0);
    if (clamp) { u = Math.min(Math.max(u, 0), 1 - Number.EPSILON); v = Math.min(Math.max(v, 0), 1 - Number.EPSILON); }
    if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) return null;
    const i = Math.floor(u * m.cv.width), j = Math.floor(v * m.cv.height);
    return (px ? px[4 * (j * m.cv.width + i) + 3] : m.cv.getContext('2d').getImageData(i, j, 1, 1).data[3]) / 255;
  }
  // whether the point z is outside the region set a cut surface (mask.cut) shows: nothing is drawn over it (the block's
  // edge, where a pick can land, takes the edge texel's alpha, as the surface does); px as landMaskAlpha's
  function landOffRegion(m, z, px) {
    const a = m && m.cut ? landMaskAlpha(m, z.re, z.im, true, px) : null;
    return a !== null && a < 0.5;
  }
  // the value the Landscape's height reads of the height map's image w: its real or imaginary part, else its modulus
  function landValue(w) { return S.height === 're' ? w.re : S.height === 'im' ? w.im : CX.abs(w); }
  // the relief of a Landscape as a function of the world point p = [x, y, z] over its block (info: the frame's, box: the window
  // of its plane, mask: the Inside-regions mask or null, F: the height map, null where no surface is over the point): toZ(p)
  // the point of the plane under p, and hAt(p) the relief's height there: below the floor off the region a cut surface
  // shows or where F is null, top where the value is not finite; off(p): whether p is off that region
  function landHeightField(info, box, mask, F) {
    const [ax, ay] = info.aspect || [1, 1];
    const toZ = (p) => C(box.x0 + (p[0] / ax / 2 + 0.5) * (box.x1 - box.x0), box.y0 + (p[1] / ay / 2 + 0.5) * (box.y1 - box.y0));
    const top = Math.abs(info.top || 1) * 1.3, z0 = info.floorZ;
    // (the mask's pixels, read once for the ray's samples)
    const mpx = mask && mask.cut ? mask.cv.getContext('2d').getImageData(0, 0, mask.cv.width, mask.cv.height).data : null;
    const hAt = (p) => {
      if (landOffRegion(mask, toZ(p), mpx)) return z0 - 1;
      const w = F(toZ(p));
      if (w === null) return z0 - 1;
      if (!CX.isFin(w)) return top;
      const hh = info.heightOf(landValue(w));
      return Number.isFinite(hh) ? hh : top;
    };
    return { toZ, hAt, top, z0, off: (p) => landOffRegion(mask, toZ(p), mpx) };
  }
  // the pointer's ray through pane pixel (x, y) of the landscape whose pick record is pk (render3D.pick): its point at(t),
  // and the segment [t0, t1] of it inside the block |x| <= ax, |y| <= ay, z0 <= z <= top; null where it misses the block
  function landRay(pk, x, y, z0, top) {
    const c = pk.cam, [ax, ay] = pk.info.aspect || [1, 1];
    const e = [c.tx + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw), c.ty + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), c.tz + c.dist * Math.sin(c.pitch)];
    const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((t) => t / l); };
    const f = nrm([c.tx - e[0], c.ty - e[1], c.tz - e[2]]);
    const r = nrm([f[1], -f[0], 0]);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const th = Math.tan((c.fov || 28 * DEG) / 2), nx = (2 * x / pk.w - 1) * th * pk.w / pk.h, ny = (1 - 2 * y / pk.h) * th;
    const d = nrm([0, 1, 2].map((k) => f[k] + nx * r[k] + ny * u[k]));
    const at = (t) => [e[0] + t * d[0], e[1] + t * d[1], e[2] + t * d[2]];
    let t0 = 0, t1 = Infinity;
    for (const [k, lo, hi] of [[0, -ax, ax], [1, -ay, ay], [2, z0, top]]) {
      if (Math.abs(d[k]) < 1e-12) { if (e[k] < lo || e[k] > hi) return null; continue; }
      let a = (lo - e[k]) / d[k], b = (hi - e[k]) / d[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    return t1 > t0 ? { at, t0, t1 } : null;
  }
  // the samples of a ray's march over the block, and the bisection's steps at a crossing
  const LAND_RAY_N = 160, LAND_RAY_BISECT = 14;
  // pickLandSheet's march: the sheets' points are found afresh from the fibre's grid every LAND_RAY_SEED samples, and are
  // followed from the last sample's in between (where the steps have no exact inverse)
  const LAND_RAY_SEED = 8;
  // the point of X under pane pixel (x, y) of the landscape (its probe: the needle from the floor to (z, h(z)) and the
  // readout): the first crossing of the pointer's ray with the relief (the principal branch, marched then bisected),
  // else the floor of the block; null off the block
  function pickLand(x, y) {
    const pk = render3D.pick;
    if (!pk || !(pk.w > 0 && pk.h > 0) || !pk.info || !pk.info.heightOf) return null;
    const { toZ, hAt, top, z0 } = landHeightField(pk.info, pk.box, pk.mask, pk.F);
    const ray = landRay(pk, x, y, z0, top);
    if (!ray) return null;
    const { at, t0, t1 } = ray, N = LAND_RAY_N;
    let tp = t0;
    for (let i = 0; i <= N; i++) {
      const t = t0 + (t1 - t0) * i / N, p = at(t);
      if (p[2] - hAt(p) > 0) { tp = t; continue; }
      if (i === 0) return toZ(p);
      let a = tp, b = t;
      for (let j = 0; j < LAND_RAY_BISECT; j++) { const m = (a + b) / 2, q = at(m); if (q[2] - hAt(q) > 0) a = m; else b = m; }
      return toZ(at(b));
    }
    const p = at(t1);
    return Math.abs(p[2] - z0) < 1e-6 * Math.max(1, Math.abs(z0)) + 1e-9 ? toZ(p) : null;
  }
  // The point under pane pixel (x, y) of a carried Landscape at rest on a plane k past its source plane s
  // (render3D.pick with fibre: a sheet over w for each point of s carried to w), on whichever sheet the pointer's ray
  // meets first: {z, w, h}, z the point of plane s, w its image, the point of plane k under it, and h its height; null
  // where the ray meets no sheet. The ray is marched as pickLand's. Each sample's sheets are followed from the last
  // sample's (the nearest point of s; the fibre's grid looked at every LAND_RAY_SEED samples), a sheet is met where the
  // ray passes from above it to below it, and that crossing is bisected on that sheet. A sheet that first shows below
  // the ray (the ray passes under its edge) is not met there
  function pickLandSheet(x, y) {
    const pk = render3D.pick;
    if (!pk || !pk.fibre || !(pk.w > 0 && pk.h > 0) || !pk.info || !pk.info.heightOf) return null;
    const info = pk.info, { toZ, top, z0, off } = landHeightField(info, pk.box, pk.mask, pk.F);
    const ray = landRay(pk, x, y, z0, top);
    if (!ray) return null;
    const { at, t0, t1 } = ray, N = LAND_RAY_N;
    const hOf = (v) => { if (!CX.isFin(v)) return top; const h = info.heightOf(landValue(v)); return Number.isFinite(h) ? h : top; };
    // (the sheets at the ray's point at t: {z, h, d}, d the ray's height above the sheet)
    const sheets = (t, seeds, fromGrid) => { const p = at(t); return off(p) ? [] : pk.fibre(toZ(p), seeds, fromGrid).map((s) => { const h = hOf(s.v); return { z: s.z, h, d: p[2] - h }; }); };
    const nearest = (list, z) => { let best = null, bd = Infinity; for (const s of list) { const dd = CX.abs(CX.sub(s.z, z)); if (dd < bd) { bd = dd; best = s; } } return best; };
    let prev = sheets(t0, null, true), tp = t0;
    for (let i = 1; i <= N; i++) {
      const t = t0 + (t1 - t0) * i / N, cur = sheets(t, prev.map((s) => s.z), i % LAND_RAY_SEED === 0);
      let hit = null;
      for (const s of cur) {
        const q = s.d <= 0 ? nearest(prev, s.z) : null;
        if (!q || q.d <= 0) continue;
        // (bisected on this sheet, followed from q)
        let a = tp, b = t, za = q.z, zb = s.z, hb = s.h;
        for (let j = 0; j < LAND_RAY_BISECT; j++) {
          const m = (a + b) / 2, sh = nearest(sheets(m, [za], false), za);
          if (!sh) break;
          if (sh.d > 0) { a = m; za = sh.z; } else { b = m; zb = sh.z; hb = sh.h; }
        }
        if (!hit || b < hit.t) hit = { t: b, z: zb, h: hb };
      }
      if (hit) return { z: hit.z, w: toZ(at(hit.t)), h: hit.h };
      prev = cur; tp = t;
    }
    return null;
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
  // that sits on the block's silhouette, so its labels never cover the relief. mu: the median |F| (or |Re F|, |Im F|)
  // the ruler's labels step by (render3D's)
  function draw3DLabels(pane, info, box, mu) {
    const ctx = pane.ctx;
    const [ax, ay] = info.aspect || [1, 1];
    const z0 = info.floorZ, eye = info.eye;
    const P = (p) => project(pane, info.MVP, p);
    const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return l > 1e-6 ? [dx / l, dy / l] : [0, 1]; };
    const hexMix = (a, b, t) => { const A = GLR.hexRGB(a), B = GLR.hexRGB(b); return `rgb(${A.map((x, k) => Math.round(255 * (x + (B[k] - x) * t))).join(',')})`; };
    const bgAt = (y) => hexMix(TH.landTop, TH.landBottom, Math.min(1, Math.max(0, y / pane.h)));
    const taken = [];
    // (the axis names' boxes, [x, y, w, h] in CSS px with their margins: Re and Im of the plane, the height's name; tests)
    const names = [];
    render3D.names = names;
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
      return r;
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
      if (a && b) for (const gap of [24, 34, 46]) { const r = label(runs, a, unit(a, b), gap, math12, TH.landFloor, TH.ink2, true); if (r) { names.push(r); break; } }
    };
    const vz = svName(leftStage());
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
      const b = Axes.niceStep(mu);
      vals = (S.height === 'abs' ? [1, 0, 4, 2, 10, 0.5] : [0, 1, -1, 4, -4, 2, -2]).map((m) => [m * b, fmt(m * b)]);
    }
    ctx.strokeStyle = TH.rulerTick;
    // (a label closer than a line and a half to one already placed, in the order of priority, is left out, so the
    // decades of a compressed top read evenly)
    const placed = [];
    render3D.ticks = placed;   // (the screen y of each label placed: tests)
    for (const [v, lab] of vals) {
      const hz = hOf(v);
      if (!Number.isFinite(hz) || hz > top - 0.01 || hz < z0 + 0.01) continue;
      const a = P([rc[0], rc[1], hz]);
      if (!a || placed.some((y) => Math.abs(y - a[1]) < 18)) continue;
      if (!label([[lab, false]], a, [dir, 0], 8, micro, null, TH.label)) continue;
      placed.push(a[1]);
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + dir * 5, a[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // a focused d/dz step plots its stage w_k (a function of z), any other step its own map f_k; the steps view names what
    // the height reads on the shown plane (svHeightName)
    const Fn = SV.on ? svHeightName('text') : S.focus === 0 ? 'F' : (typeof isDeriv === 'function' && isDeriv(S.focus) ? `w${sub(S.focus)}` : `f${sub(S.focus)}`);
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
    for (const [a, d, gap] of tries) { const r = label(tl, a, d, gap, math12, null, TH.ink2, below); if (r) { names.push(r); break; } }
    ctx.restore();
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
    if (res === 'pending' && live) { invWaiting.add(role); invPendN++; }
    else if (res === 'drawn' && invWaiting.size) { const w = [...invWaiting].filter((x) => x !== role || !live); invWaiting.clear(); if (w.length) requestRender(...w); }
    if (res === 'error' && GLR.inverseStatus(S.alpha, 'globe') === 'error') {
      const k = (GLR.inverseInfo || {}).key || '';
      if (k !== invFailKey) { invFailKey = k; scheduleFix(); }
    }
  }
  // the colour globe of o drawn over the pane's globe, kept inside the regions (regions drawn solid; o.only: only these): true
  // when its colour was drawn, false while the mask's program links (the caller asks again) or on an error
  function maskedGlobe(pane, c, base, o) {
    if (!(GLR.keepInAlpha && GLR.keepInAlpha(true))) return false;
    try {
      const mi = withSolidRegions(() => sphereView(pane, c, base, Object.assign({}, o, { imageMode: false, maskRegions: true })));
      return !!(mi && mi.carried);
    } catch (e) { console.error('globe region mask', e); return false; }
  }
  // A plane on the Riemann sphere, orbited by camera c (base: its fitted defaults). o.imageMode: the shapes of stage
  // o.stage lifted onto a plain globe with its graticule; otherwise the globe carries the phase portrait of the
  // focused map and the shapes are outlined. o.hom: the steps view's glide, its map and F (below). o.plane: the equatorial plane with the projection ray
  // of o.probeW; without it the probe is a dot on the globe. o.carried: the steps view's carried colour over the colour
  // globe (GLR.drawSphere's st.carried), o.carriedCopies the other sheets' under it (its st.carriedCopies; o.sheetCut: drawn
  // only where the principal sheet is not opaque, drawSphere's st.sheetCut, for the inverse pass's copies too); o.only: a Set of the shapes the globe's regions are drawn for (the rest left out); o.carryRegions: the steps view's carried colour by the inverse pass, the plain
  // globe under it (drawSphere's regions, each an inverse record with its carry), or with o.carryBase the colour globe of
  // o.colorMap under it (the arrival plane's rest colour under a glide). Returns the frame's {MVP, eye,
  // carried} (carried: that colour was drawn) or null.
  function sphereView(pane, c, base, o) {
    // (o.inRegions: the steps view's Inside regions: the globe with its regions, then over it the colour globe kept
    // inside them (o.maskRegions, GLR.drawSphere's GPU mask, the regions drawn solid), and the marks over both (not on the
    // figure's art layer, artMode, which draws them as vectors). While the mask's program links (a frame or two) the
    // regions' globe alone; the frame is asked again when it has)
    if (o.inRegions) {
      const look = Object.assign({}, o, { inRegions: false }), first = Object.assign({}, look, { imageMode: true, carried: null });
      const info = sphereView(pane, c, base, Object.assign({}, first, { marks: false }));
      const carried = maskedGlobe(pane, c, base, Object.assign(look, { pre: null }));
      if (info && !artMode) globeMarks(pane, info, first);
      return info && Object.assign({}, info, { carried });
    }
    // (o.maskRegions: drawn over the regions' globe already on the pane, in its colour inside the regions alone: no
    // backdrop, shadow or marks of its own)
    const over = !!o.maskRegions;
    if (!over) pane.begin(TH.plane);
    if (!GLR.ok) { if (!over) noGL(pane); return null; }
    if (!over) backdrop(pane);
    // 28 degree camera fitted to the globe and its labels at this pane's aspect (spec 6.10)
    // (with the equatorial plane on, frame more of the disc; its rim fades out, so the pane never cuts it hard)
    refitCam(c, base, GLR.fitDist(o.plane ? 1.75 : 1.16, base.fov, artCamAsp ? pane.h * artCamAsp : pane.w, pane.h, 1.05));
    // contact shadow (spec 6.10): an elliptical radial gradient, aspect 1.6 : 0.35, on the ground under the globe,
    // placed and sized from the globe's projection; it fades out as the camera drops below the ground
    const ctx = pane.ctx;
    if (!over) {
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
    // (o.maskRegions: the globe in colour, kept inside the regions, which are lifted as in image mode for its mask)
    const regionsOn = imageMode || !!o.maskRegions;
    const regions = [], lines = [];
    // o.hom: the steps view's glide ({map, imageMap, F, imageF}): image mode lifts the shapes under its map
    const hom = o.hom || null;
    // (o.lineMap: the steps view's glide moves the shapes in either paint, 19)
    const map = o.lineMap || (hom && imageMode ? (hom.imageMap || hom.map) : stageMap(o.stage));   // shapes live in the z-plane
    const cell = patternCell();
    // the same map cache keys as drawScene: orbiting the globe re-evaluates nothing (spec 8.1); homotopy frames go
    // to GLR's per-resource scratch evaluation instead (no cache entry per t)
    const cache = map.mode === 0, mk = mapKeyOf(map);
    // exact images on the globe (SPEC 4.6, 10.3): each area shape takes its path in list order, the inverse pass over
    // the globe's own triangles (every fragment exact, the poles ordinary pixels) or the lifted mesh; the frame's shape
    // records are packed once. o.role: 'R' the w-globe (Y Sphere), 'L' the z-globe (X Sphere, at stage 0 too)
    const role = o.role === 'L' ? 'L' : 'R', live = !offRender;
    const stretch = { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) };
    const smR = regionsOn ? globeRpx(pane, c, base) : 0;   // the globe's radius, device px (SphereMesh's view)
    let recs = null;
    if (regionsOn && GLR.packShapes && GLR.drawInverse && PHASE[role].globe
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
      if (s.visible === false || kindType(s) === 'point' || (o.only && !o.only.has(s))) continue;
      // a later plane's shape is drawn on the globes of its own plane and the planes after it, under its own map: in the
      // steps view's glide (o.lineMap) the glide's map from its plane (svShapeMap), in another homotopy none
      const sm = o.lineMap ? svShapeMap(s, map) : hom ? (shapeStage(s) ? null : map) : shapeMap(s, map);
      if (!sm) continue;
      const smk = sm === map ? mk : mapKeyOf(sm), recsOf = shapeStage(s) ? null : recs;   // (the packed records hold the z-plane's shapes only)
      const r = shapeGPU(s);
      const ink = shapeInk(s);
      const pf = regionsOn && kindType(s) === 'area' && !hom && !shapeStage(s) ? pairFor(s, r, role) : { p: r, fx: null };   // fix-ups refine the static map (a later plane's shape: its bare mesh)
      if (regionsOn && kindType(s) === 'area') {
        const fwd = [];
        // SPEC 8: a published SphereMesh of the globe (valid while the globe's radius is within 2x) replaces the lifted
        // mesh and its fix-ups; during a rebuild the old one is drawn (it covers the whole sphere)
        const pth = recsOf ? pathOf(s, sm, role, 'globe', { recs: recsOf, budget: live, status: true }).path : 'forward';
        const smd = !hom && !shapeStage(s) && (live || offRender) ? smFor(s, r, role, 'globe', sm, pane, smR, live && pth === 'forward') : null;
        const sme = smd && (smd.e || smd.old);
        if (sme && !sme.data.n) { /* nothing of it shows on the globe */ } else if (sme && smRes(sme)) fwd.push({ pre: sme.res, st: Object.assign(smLook(s, pane, S.alpha), { view: null }) });
        else if (pf.p.meshRes) {
          const fx = pf.fx, pm = pf.p;
          const st = { map: sm, dpr: pane.dpr, L: MESH_L, color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), skip: fx ? fx.skip : null, stretch,
            cacheKey: cache ? `${pm.meshKey}|${smk}` : null };
          fwd.push({ res: pm.meshRes, st });
          if (fx && fx.extraRes) fwd.push({ res: fx.extraRes, st: Object.assign({}, st, { skip: null, L: 1, cacheKey: cache ? `x|${fx.mapKey}|${smk}` : null }) });
        }
        const p = recsOf ? pathOf(s, sm, role, 'globe', { recs: recsOf, budget: live }) : null;
        if (p && p.path === 'inverse') {
          // a bounded shape's image box (in w; the shape's own box at stage 0) scissors its pass (gl.js globeScissorOf)
          const gbox = globeImageBox(p, s, live);
          regions.push({
            inv: { map: p.m, plan: p.plan, prep: p.prep, inv: p.inv, shape: s, dpr: pane.dpr, motion: live && interacting(), coldOk: offRender, globeBox: gbox,
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
        // (the globe's lines: the stroke of a shape's curve, without the selection's or the hover's emphasis; a phase portrait takes the
        // dc line colour on a white casing)
        const sk = shapeStroke(s, pane.dpr, { still: true });
        if (!imageMode) Object.assign(sk, { color: GLR.hexRGB(TH.dcCasing), casing: { color: [1, 1, 1], alpha: 0.85, width: sk.casing.width } });
        lines.push({ res: rl.lineRes, st: Object.assign({ map: sm, dpr: pane.dpr, M: 8 }, sk, { cacheKey: cache ? `${rl.lineKey}|${smk}` : null }) });
      }
    }
    // the deformation on Y's globe (merged-views.md: one globe): X's outline in grey under H_t(X), where the paths start
    // (at a focused step, the image of X at the step's input stage)
    if (hom && imageMode && role === 'R') {
      // (with a bracket, H_0(∂X) = Q o P(∂X) through H0Map, SPEC 5.3)
      const base = S.focus > 0 ? S.focus - 1 : 0, bm = hom.range && hom.H0Map ? hom.H0Map : stageMap(base), bk = mapKeyOf(bm);
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) === 'point' || shapeStage(s)) continue;
        const r = shapeGPU(s), rl = linesOf(r, r);
        if (rl.lineRes) lines.unshift({ res: rl.lineRes, st: { map: bm, dpr: pane.dpr, M: 8, width: 1 * pane.dpr, color: GLR.hexRGB(TH.faint), alpha: 0.9, cacheKey: `${rl.lineKey}|${bk}` } });
      }
    }
    const colorMap = o.colorMap || (hom ? hom.map : focusMap()), colorGlobe = !imageMode && (!o.carryRegions || !!o.carryBase);
    const info = GLR.drawSphere({
      map: colorMap, mode: colorGlobe ? 'color' : 'image', cam: c, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(),
      standIn: colorGlobe ? globeStandIn(pane, colorMap) : null,
      colors: { plane: TH.planeRGB, gridMajor: GLR.hexRGB(TH.gridMajor), axis: TH.axisRGB, ink: TH.inkRGB },
      shell: TH.planeRGB, ink: TH.dark ? [0.75, 0.8, 0.88] : [0.25, 0.3, 0.38],
      regions: imageMode ? regions : o.carryRegions || [], maskRegions: o.maskRegions ? regions : null, maskPre: o.maskRegions ? stagePreList(o.stage) : null, maskOver: o.maskRegions && !hideStrokes ? stagePreList(o.stage, true) : null, lines, plane: !!o.plane, probe: o.plane && o.probeW ? { w: o.probeW } : null, pre: o.pre || null,
      post: (o.post || []).filter(Boolean), net: o.net || 'plain', carried: o.carried || null, carriedCopies: o.carried && o.carriedCopies ? o.carriedCopies : null, sheetCut: !!o.sheetCut,
    });
    // a program that waits for its first draw is warmed at a quiet moment (as drawScene); a deferred preparation draws
    // inverse on the next frame
    if (recs && live && GLR.inverseColdWaiting) scheduleWarm(interacting() ? 100 : 0);
    if (recs && live && prepDeferred) { prepDeferred = false; requestRender(role); }
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (over) return info;
    glStatusNote(pane);
    if (!info) return null;
    // (the figure's art layer: the camera, read back for the vector labels, points and paths; the canvas marks are left out)
    if (artMode || artCam) artGlobe = { MVP: info.MVP, eye: info.eye, w: pane.w, h: pane.h };
    if (artMode || o.marks === false) return info;
    return globeMarks(pane, info, o);
  }
  // what sphereView draws over the globe's frame info ({MVP, eye}) on the pane's 2D context, with sphereView's options o:
  // the point shapes and the w-plane's point targets lifted to the sphere, the deformation's live paths, the labels, the
  // probe's ring and the sphere's marks (0, infinity, +-1, +-i, faded in by how far each faces the camera). o.marks false:
  // sphereView leaves them to its caller, which draws a pass over the frame first (the Inside regions' colour globe).
  // Returns info
  function globeMarks(pane, info, o) {
    const ctx = pane.ctx, lift = liftC, hom = o.hom || null, imageMode = o.imageMode, role = o.role === 'L' ? 'L' : 'R';
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
        const sel = morphSelGlobe(pane, { MVP: info.MVP, eye: info.eye });
        drawMorphPathsX(pane, sel, hom.imageF || hom.F, globeSelP(info, pane.w, pane.h, 0.02));
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
    ctx.font = `italic 500 ${GLOBE_MARK_PX}px ${TH.math}`;
    const pts = /** @type {[string, number[]][]} */ ([['0', [0, 0, -1]], ['∞', [0, 0, 1]], ['1', lift(1, 0)], ['i', lift(0, 1)], ['−1', lift(-1, 0)], ['−i', lift(0, -1)]]);
    // (a video frame fits the camera at the still's aspect, which can make the globe small against the marks' fixed size: its marks keep
    // off the globe's outline, as the still's do)
    const limb = artCamAsp ? GLR.globeLimb(info.eye, (p) => project(pane, info.MVP, p)) : null, centre = limb ? project(pane, info.MVP, [0, 0, 0]) : null;
    for (const [lab, p] of pts) {
      const f = facing(p);
      const a = smoothstep(0.05, 0.3, f);
      if (a <= 0) continue;
      // poles: just beyond the globe; equator points: just above the |z| = 1 line, so the label never sits on it
      let q = project(pane, info.MVP, p[2] === 0 ? [p[0] * 1.06, p[1] * 1.06, 0.1] : p.map((v) => v * 1.1));
      if (!q) continue;
      if (limb) {
        const half = ctx.measureText(lab).width / 2;
        q = GLR.clearOfLimb(q, (at) => ({ x0: at[0] - half, x1: at[0] + half, y0: at[1] - GLOBE_MARK_PX / 2, y1: at[1] + GLOBE_MARK_PX / 2 }), limb, centre);
        if (!q) continue;
      }
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
  // the globe's pre passes: the targets' (pre) and those of the shapes of later planes (fills at half strength
  // over a phase portrait, as the targets'; none with the strokes left out, hideStrokes)
  function preAll(pre, half) {
    const out = pre && pre.targets.length ? [pre] : [];
    // (the later planes' passes are the steps view's layer, left out with the strokes, hideStrokes)
    for (const p of hideStrokes ? [] : stagePreList(leftStage())) out.push(half ? Object.assign(p, { targets: halfFills(p.targets) }) : p);
    return out.length ? out : null;
  }
  // the globe's net: the snap net of the tool while the globe takes drawing, else the plain graticule. Every paint
  // of this globe draws it, the steps view's Inside regions too: the net belongs to the surface, in every scope
  const leftNet = () => (globeEdit('L') ? globeNet() : 'plain');
  // the w-plane targets pulled back by the focused map, painted on the globe (GLR.drawSphere st.pre) as in the flat
  // view, in both paints (over the portrait, area fills at half strength)
  const leftPre = () => (hasTargets() ? { map: endMap(), targets: preimageTargets(false), halo: GLR.hexRGB(TH.halo) } : null);
  // what the left globe draws over its picture at rest: the net, the targets pulled back, the probe and a shape draft
  // drawn on the globe (P3b) over the shapes (sphereView's options)
  const leftGlobeOver = () => ({ net: leftNet(), pre: preAll(leftPre(), false), probeW: probe || null, post: [globeDraftPass('L')] });
  function renderSphereLeft(pane) {
    // the steps view at rest on a plane past the colour plane: the colour carried to it, as the plane shows it (19)
    const carried = SV.on && !svColoured() ? svGlobeRest(pane, svStage()) : null;
    if (carried) return carried;
    const net = leftNet(), pre = leftPre();
    // X Sphere + Phase: the phase portrait of the map in focus on the globe, the shapes outlined
    // (the steps view's Inside regions on the globe, 19: the globe of regions carries the pulled-back
    // shapes of later planes as every globe does; the colour globe kept inside the regions does not repeat them)
    if (svMaskOn() && lPhase()) return sphereView(pane, camL, CAML, { inRegions: true, stage: svStage(), plane: !!xView().eq, role: 'L', pre: preAll(pre, false), net });
    if (lPhase()) {
      if (pre) pre.targets = halfFills(pre.targets);
      return sphereView(pane, camL, CAML, { imageMode: false, stage: leftStage(), plane: !!xView().eq, probeW: probe || null, pre: preAll(pre, true), role: 'L', post: [globeDraftPass('L')], net });
    }
    // the left plane's point under the probe: the probe itself (it is kept in this plane's coordinates)
    return sphereView(pane, camL, CAML, Object.assign({ imageMode: true, stage: leftStage(), plane: !!xView().eq, role: 'L' }, leftGlobeOver()));
  }
  // What a plane's canvas says only in drawn text, for a screen reader: the plane's description. A frame collects it
  // (paneSay, by part, while the pane draws), and paneSaid writes it, once the frame is drawn, to a hidden span beside the
  // canvas that the canvas's aria-describedby names (none while the frame says nothing). Only a frame that began a new
  // picture (Pane.begin) says anew: one that left the canvas as it was leaves the description too. A description is read
  // with the plane, not announced, so a count that follows the view does not interrupt. Parts: 'note' (why the plane has
  // no colours, glStatusNote's), 'land' (the Landscape's caption), 'pre' (the marked preimages of the later planes' points),
  // 'off' (the pieces of the later planes' regions' pullbacks that lie off the view)
  const PANE_SAY_ORDER = ['note', 'land', 'pre', 'off'];
  const paneSayAt = new Map();   // pane → { parts, begun, text }
  function paneSayOf(pane) {
    let q = paneSayAt.get(pane);
    if (!q) paneSayAt.set(pane, (q = { parts: {}, begun: 0, text: '' }));
    return q;
  }
  function paneSays(pane) { const q = paneSayOf(pane); q.parts = {}; q.begun = pane.begun; }
  function paneSay(pane, part, text) { paneSayOf(pane).parts[part] = text; }
  function paneSaid(pane) {
    const q = paneSayOf(pane), cv = pane.ocanvas;
    if (!cv || !cv.id || pane.begun === q.begun) return;
    const text = PANE_SAY_ORDER.map((k) => q.parts[k]).filter(Boolean).join(' ');
    if (text === q.text) return;
    q.text = text;
    srSay(cv, text, (sp) => cv.after(sp));
  }
  // el's hidden description: a span (class sr-only, id el.id + 'Say', placed once by put) holding text, which el's
  // aria-describedby names while text is not empty; the span's text and the attribute are written only when they change
  function srSay(el, text, put) {
    let sp = $(el.id + 'Say');
    if (!sp) { sp = h('span', { class: 'sr-only', id: el.id + 'Say' }); put(sp); }
    if (sp.textContent !== text) sp.textContent = text;
    if (!text) el.removeAttribute('aria-describedby');
    else if (el.getAttribute('aria-describedby') !== sp.id) el.setAttribute('aria-describedby', sp.id);
  }
  const CAPTION_PAD = 8, CAPTION_LINE = 15;   // CSS px: a caption's least gap to the pane's sides and its view buttons; its line height
  const CAPTION_REWRAPS = 3;   // the most times a caption is wrapped again for the taller band its lines take
  // the boxes of the view buttons over a pane (zoom, Fit, …, and a phone's keys: the globe, …), in the pane's CSS px
  function paneButtons(pane) {
    const cv = pane.ocanvas, host = cv && cv.parentElement;
    if (!host) return [];
    const c = cv.getBoundingClientRect(), out = [];
    for (const e of host.querySelectorAll('.vbtn, .ph-key')) { const r = e.getBoundingClientRect(); if (r.width && r.height) out.push({ l: r.left - c.left, r: r.right - c.left, t: r.top - c.top, b: r.bottom - c.top }); }
    return out;
  }
  // the half-width a line centred at mid may take in the band top … bottom of a pane (CSS px) beside the view buttons
  // (btns, paneButtons') the band meets, keeping CAPTION_PAD from them and from the pane's sides
  function roomBeside(btns, mid, top, bottom) {
    let half = mid - CAPTION_PAD;
    for (const b of btns) if (b.t < bottom && b.b > top) half = Math.min(half, b.r <= mid ? mid - b.r - CAPTION_PAD : b.l >= mid ? b.l - mid - CAPTION_PAD : 0);
    return half;
  }
  // a note at the foot of a pane, centred on a halo (what the view leaves out): its words wrap to the widest centred
  // lines that keep CAPTION_PAD from the pane's sides and from the view buttons beside the lines (a phone's buttons stand
  // over the foot)
  function paneCaption(pane, text) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.font = `12px ${TH.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const foot = pane.h - 14, mid = pane.w / 2, btns = paneButtons(pane);
    // (n lines: the width a centred line may take beside the buttons the band of n lines meets)
    const room = (n) => 2 * roomBeside(btns, mid, foot - n * CAPTION_LINE - CAPTION_PAD, foot + CAPTION_PAD);
    let lines = wrapWords(ctx, text, room(1));
    // (more lines take a taller band, which can meet more buttons: wrapped again for the band, at most CAPTION_REWRAPS times)
    for (let i = 0; i < CAPTION_REWRAPS; i++) { const next = wrapWords(ctx, text, room(lines.length)); if (next.length === lines.length) break; lines = next; }
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = TH.halo; ctx.fillStyle = TH.muted;
    lines.forEach((t, i) => { const y = foot - (lines.length - 1 - i) * CAPTION_LINE; ctx.strokeText(t, mid, y); ctx.fillText(t, mid, y); });
    ctx.restore();
  }
  // the point of the left plane under pane pixel (x, y) (CSS px) of the sphere view: the ray from the eye through
  // the pixel meets the globe, and the stereographic projection from the north pole takes the hit to the plane.
  // null off the globe or at the north pole (infinity).
  function pickSphereLeft(x, y) { return pickSphere(paneL, camL, x, y); }
  let leftSphereInfo = null;   // the left globe's last frame {MVP, eye}: overlays lift their marks onto it
  // (v: a view of the left plane, default its own)
  function leftPaneBox(v = leftView()) {
    const P = paneL;
    return { x0: v.cx - P.w / 2 / v.s, x1: v.cx + P.w / 2 / v.s, y0: v.cy - P.h / 2 / v.s, y1: v.cy + P.h / 2 / v.s };
  }
  // the view controls: the view switch, Plane | Sphere, the Key switch, the Display options
  // The fill opacity, S.alpha: the one setter of the regions' Opacity slider (#alphaRange) and the steps view's colour
  // popover (the .sv-opacity ranges, which show it in whole percents), each kept at the value
  function setFillOpacity(v) {
    setOpt('alpha', v);
    const r = /** @type {HTMLInputElement} */ ($('alphaRange'));
    r.value = String(S.alpha); paintFader(r);
    $('alphaVal').textContent = I18N.num(S.alpha.toFixed(2));
    for (const q of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll('.sv-opacity'))) syncOpacityRange(q);
    requestRender('L', 'R'); save();
  }
  function setupViewControls() {
    // the panes' Plane | Sphere radios (U4)
    for (const side of ['L', 'R']) {
      const el = $(side === 'L' ? 'leftTabs' : 'rightTabs');
      for (const [v, l, k] of SURF[side]) el.append(h('button', { 'data-mode': v, role: 'radio', 'data-tip': k ? `${l}  ${k}` : l, 'aria-label': l, html: `${VIEW_ICONS[v]}<span>${l}</span>`, onclick: () => setView(side, v), ...(v === 'sphere' ? { onpointerenter: prestartGlobe, onfocus: prestartGlobe } : {}) }));
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const list = SURF[side], i = list.findIndex((x) => x[0] === (side === 'L' ? xView() : S.view.R).surf);
        const j = Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        setView(side, list[j][0]); /** @type {HTMLElement} */ (el.children[j]).focus(); e.preventDefault();
      });
    }
    // the Key switch in X's legend chip: the colour key painted in the Y plane
    const kc = $('wKeyChk');
    if (kc) kc.addEventListener('change', () => { setOpt('wKey', kc.checked); buildRightFoot(); requestRender('R'); save(); tourEmit('phase-key', { on: !!kc.checked }); });
    $('linesChk').addEventListener('change', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('lines', tg.checked); requestRender('L', 'R'); drawLegend(); save(); });   // (Y's key chip names the grid's cell only while its lines are drawn)
    $('chevChk').addEventListener('change', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('chev', tg.checked); requestRender('L', 'R'); save(); });
    $('unitChk').addEventListener('change', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('unit', tg.checked); requestRender('L', 'R'); save(); });
    $('alphaRange').addEventListener('input', (e) => setFillOpacity(+/** @type {HTMLInputElement} */ (e.target).value));
    $('meshRange').addEventListener('input', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); showMeshVal(posToMesh(+tg.value)); });
    $('patScale').addEventListener('input', (e) => { const tg = /** @type {HTMLInputElement} */ (e.target); setOpt('patternScale', 2 ** +tg.value); cellBase = 0; buildDisplay(); requestRender('L', 'R'); save(); });
    $('leftReadout').addEventListener('click', () => copyReadout('L'));
    $('rightReadout').addEventListener('click', () => copyReadout('R'));
    // (where the primary pointer is coarse the chip is not a target, page.html's `.chip.readout` rule, so its "Click to copy" promises nothing a touch can do)
    try { if (matchMedia('(pointer: coarse)').matches) for (const id of ['leftReadout', 'rightReadout']) $(id).removeAttribute('title'); } catch (e) { /* no matchMedia: the title stays */ }
  }
  // the panes' buttons: Fit, the legend chips, zoom (init: after applyLayout)
  function setupPaneButtons() {
    $('leftFit').addEventListener('click', () => {
      if (!lFlat()) { const c = camOf('L'); if (c) tweenCam(c, camBaseOf(c)); return; }
      paneL.setView(leftView());
      const target = fittedView(paneL, leftStage());
      if (leftStage() > 0) leftAuto = true;
      tweenView(leftView(), target, 260, () => sourceViewChanged());
    });
    $('rightFit').addEventListener('click', () => { if ($('rightFit').getAttribute('aria-disabled') === 'true') return; rightAuto = true; fitRight(true); requestRender('R'); });
    // On a touch phone the legend chips start folded to their colour wheel and a tap unfolds them (on a 356 px plot the key covers a third of the landscape);
    // a tap on a folded or unfolded chip toggles
    for (const id of ['leftLegend', 'rightLegend']) {
      const el = $(id);
      if (!el) continue;
      try { if (matchMedia('(pointer: coarse)').matches && el.parentNode && !/** @type {HTMLElement} */ (el.parentNode).classList.contains('pane-head')) el.classList.add('collapsed'); } catch (e) { /* no media queries */ }
      // (the pop-up in a pane head opens below the probe's readout and the notes it would cover)
      for (const ev of ['pointerenter', 'focusin', 'click']) el.addEventListener(ev, () => requestAnimationFrame(() => placeKeyPop(el)));
      // (on a phone the chip lies in the plot, folded: it stays below the readout as it changes size. The readouts are
      // the pane's own plot's elements, wherever the chip stands when this runs (in the pane's head until the layout
      // places the keys), and they and the chip stay as long as the page does, so the observer is never disconnected;
      // it acts only while the root is .ph, and on a laptop the chip is placed when it is pressed)
      try {
        const pane = el.closest('.pane'), plot = pane && pane.querySelector('.plot'), ro = new ResizeObserver(() => { if (document.documentElement.classList.contains('ph')) requestAnimationFrame(() => placeKeyPop(el)); });
        if (plot) for (const e of plot.querySelectorAll(':scope > .chip.readout')) ro.observe(e);
      } catch (e) { /* no ResizeObserver */ }
      // (and as the context bar opens and closes: the root's ph-ctx-on and ph-ctx-tall; again when the bar's slide
      // has ended, its transform's transitionend, for the key is placed by where the bar stands)
      try {
        const rc = document.documentElement.classList, barState = () => (rc.contains('ph-ctx-on') ? 1 : 0) + (rc.contains('ph-ctx-tall') ? 2 : 0);
        let bar0 = barState(), ph0 = rc.contains('ph');
        new MutationObserver(() => { if (rc.contains('ph') !== ph0) { ph0 = !ph0; legendKeyButton(el, ''); } const b = barState(); if (b === bar0) return; bar0 = b; requestAnimationFrame(() => placeKeyPop(el)); }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        document.addEventListener('transitionend', (e) => { const t = /** @type {HTMLElement} */ (e.target); if (e.propertyName === 'transform' && t.classList && t.classList.contains('ph-ctx')) placeKeyPop(el); });
      } catch (e) { /* no MutationObserver */ }
      // (the key is a button on a phone: its aria-expanded follows the fold, whoever folds it; Enter and Space press it as a tap does)
      try { new MutationObserver(() => legendKeyButton(el, '')).observe(el, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* no MutationObserver */ }
      // (a key in a pane's head: its panel shows while the key is hovered, has the keyboard focus, or is kept open, and not while it is
      // shut, which Escape or a second Enter does until the focus leaves or the pointer comes back; see legendKeyButton)
      const inHead = () => !!el.parentNode && /** @type {HTMLElement} */ (el.parentNode).classList.contains('pane-head');
      el.addEventListener('keydown', (e) => {
        if (el.getAttribute('role') !== 'button') return;
        const press = e.target === el && (e.key === 'Enter' || e.key === ' ');
        if (inHead()) {
          // (Enter or Space keeps the panel open, and again closes it; Escape closes it; the focus stays on the key)
          const shown = el.classList.contains('open') || !el.classList.contains('shut');
          if (press || (e.key === 'Escape' && shown)) {
            e.preventDefault(); e.stopPropagation();
            const keep = press && !el.classList.contains('open');
            el.classList.toggle('open', keep); el.classList.toggle('shut', !keep);
          }
        } else if (press) { e.preventDefault(); el.click(); }
        // (Escape folds the open key, the focus on it or on its switch, and stays on the key: the folded key is the same element)
        else if (e.key === 'Escape' && !el.classList.contains('collapsed')) { e.preventDefault(); e.stopPropagation(); el.classList.add('collapsed'); el.focus(); }
      });
      // (a shut head key opens again at the next focus or hover; aria-expanded follows what is shown)
      for (const ev of ['focusin', 'focusout', 'pointerenter']) el.addEventListener(ev, () => { if (ev !== 'focusin' || !el.matches(':focus-visible')) el.classList.remove('shut'); legendKeyButton(el, ''); });
      // (a key the open key lies over takes no focus under it: it folds as the key takes focus. A plane key stands in the same plot)
      document.addEventListener('focusin', (e) => {
        const t = /** @type {HTMLElement} */ (e.target);
        if (el.getAttribute('role') !== 'button' || inHead() || el.classList.contains('collapsed') || el === t || el.contains(t) || !t.getBoundingClientRect || !el.parentNode || !el.parentNode.contains(t)) return;
        const a = el.getBoundingClientRect(), b = t.getBoundingClientRect();
        if (b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) el.classList.add('collapsed');
      });
      el.addEventListener('click', (e) => { const tg = /** @type {HTMLElement} */ (e.target); if (tg.closest && tg.closest('.key-sw')) return; if (el.parentNode && /** @type {HTMLElement} */ (el.parentNode).classList.contains('pane-head')) el.classList.toggle('open'); else if (document.documentElement.classList.contains('ph')) el.classList.toggle('collapsed'); });   // (on a laptop Phase's key lies open on the plot)
    }
    for (const [side, pane] of [['left', paneL], ['right', paneR]]) {
      $(side + 'ZoomIn').innerHTML = ICONS.plus;
      $(side + 'ZoomOut').innerHTML = ICONS.minus;
      $(side + 'Fit').innerHTML = ICONS.fit;
      $(side + 'Sph').addEventListener('click', () => stackSphere(side === 'left' ? 'L' : 'R'));
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
