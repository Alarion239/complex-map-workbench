  // ---------------- interaction ----------------
  function snapZ(pane, z, force, touch) {
    if (!S.snap && !force) return z;
    if (!force && (altHeld || (Construct.altNow && Construct.altNow()))) return z;   // ([v16.5 rail] Alt: raw)
    // the finest graph-paper tier that is clearly drawn: [v16.5 rail SPEC 1.3] gl.js's tiers, halves included (0.5, 1, 5,
    // 10, 50, 100 times a power of ten), at least 14 px apart; within 9 px of a lattice point (12 px for a finger)
    const sc = pane.view.s;
    const step = Constr.gridStep ? Constr.gridStep(sc) : (() => { const d0 = Math.pow(10, Math.ceil(Math.log10(8 / sc))); return [1, 5, 10, 50, 100].map((m) => d0 * m).find((st) => st * sc >= 14) || d0 * 100; })();
    const gx = Math.round(z.re / step) * step, gy = Math.round(z.im / step) * step;
    const [x, y] = pane.w2sxy(gx, gy), [x0, y0] = pane.w2s(z);
    // (wave 1 merge: the press's own pointer, UX09's ptrTouch, where there was one; else Construct's last pointer)
    const fing = touch != null ? touch : ptrTouch != null ? ptrTouch : Construct.touchNow ? Construct.touchNow() : false;
    if (Math.hypot(x - x0, y - y0) < (fing ? 12 : 9)) return C(+gx.toPrecision(12), +gy.toPrecision(12));
    return z;
  }
  const evXY = (pane, e) => { const r = pane.ocanvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let drag = null;
  const touches = new Map(); // pointerId -> [x, y] for pinch zoom
  let pinched = null;         // (v16.4) a pinch in progress zoomed ('zoom') or turned a globe ('orbit')
  // a pane that orbits a camera (U-b): X Landscape (cam), X Sphere (camL), Y Sphere (camS)
  const is3DSide = (side) => (side === 'L' ? lLand() || lGlobe() : rGlobe());
  const is3D = () => rGlobe();
  const cam3 = () => camS;
  const camOf = (side) => (side === 'R' ? camS : lLand() ? cam : leftCam());
  const camBaseOf = (c) => (c === camS ? CAMS : c === cam ? CAM3 : leftCamBase());
  // the orbit camera of the left plane's sphere view (renderSphereLeft keeps it fitted, like camS)
  const leftCam = () => camL;
  const leftCamBase = () => CAML;
  // the landscape may be seen from the side and from below; the spheres from any latitude
  const pitchMin = (c) => (c === cam ? -60 * DEG : -88 * DEG);
  // nothing to press at (x, y) of a flat plane: no shape or target, no zero or pole, no cut handle
  function emptyAt(pane, side, x, y) {
    if (side === 'L' ? !lFlat() : !rImage()) return false;
    pane.setView(side === 'L' ? leftView() : V.right);
    if (side === 'L' && (cutHandlesL.some((hd) => Math.hypot(hd.x - x, hd.y - y) < 12) || (zpStep() && zpHit(x, y, 11)))) return false;
    const target = side === 'R', list = target ? (targetsEditable() ? S.targets : []) : leftStage() === 0 ? S.shapes : [];
    const z = pane.s2w(x, y), tol = 7 / pane.view.s, win = target ? targetWin() : clipWin;
    for (const s of list) { if (s.visible === false) continue; try { if (Region.hitTest(s, z, tol, win)) return false; } catch (e) { /* */ } }
    return true;
  }
  function zoomPane(pane, side, x, y, f) {
    if (is3DSide(side)) { const c = camOf(side); if (c) { const fit = camBaseOf(c).dist; c.dist = Math.min(4 * fit, Math.max(0.4 * fit, c.dist / f)); requestRender(side); } return; }
    if (side === 'L') {
      pane.setView(leftView()); pane.zoomAt(x, y, f);
      if (leftStage() > 0) leftAuto = false;
      sourceViewChanged();
      requestRender('L');
    } else {
      pane.setView(V.right); pane.zoomAt(x, y, f); rightAuto = false; requestRender('R');
    }
  }
  // a two-finger drag moves a flat plane by the way its midpoint went (the pinch zooms about it): every tool, on touch
  function panPane(pane, side, dx, dy) {
    if (is3DSide(side)) return;
    const v = side === 'L' ? leftView() : V.right;
    v.cx -= dx / v.s; v.cy += dy / v.s;
    if (side === 'L') { if (leftStage() > 0) leftAuto = false; sourceViewChanged(); requestRender('L'); } else { rightAuto = false; requestRender('R'); }
  }
  // the outer 16 px of a phone's plane only pans (or turns a globe): Android's edge-swipe Back then never cancels half a shape
  const EDGE_PX = 16;
  const edgeTouch = (pane, x, y) => ptrTouch && touchUI() && (x < EDGE_PX || y < EDGE_PX || x > pane.w - EDGE_PX || y > pane.h - EDGE_PX);
  // the shape drawn last: a drawing tool's press on it moves or reshapes it, a press elsewhere draws (touch)
  let justDrawn = null;
  // a point bound to a free number (bind.p is exactly its name) moves the number when it is dragged, as a handle or by its
  // body: the point follows through the number's change. The drop attaches nothing (no rail, no binding): the point is
  // the number's, and only the grid snaps it. True when the number took the move.
  function numberPointDrag(drag, pane, z) {
    const s = drag.shape;
    if (!s || s.kind !== 'point' || (drag.mode === 'handle' && drag.key !== 'p')) return false;
    const bn = boundNumber(s, 'p'), pr = bn && Params.list().find((q) => q.name === bn);
    if (!pr || pr.expr) return false;
    if (drag.mode === 'move' && !drag.moved && Math.hypot(z.re - drag.z0.re, z.im - drag.z0.im) * pane.view.s < 3) return true;
    if (!drag.bnOff) drag.bnOff = drag.mode === 'move' ? [s.p[0] - drag.z0.re, s.p[1] - drag.z0.im] : [0, 0];
    pane.setView(leftView());
    const zn = snapZ(pane, C(z.re + drag.bnOff[0], z.im + drag.bnOff[1]));
    drag.boundNum = bn; drag.moved = true;
    Params.set(bn, { re: zn.re, im: zn.im }, { live: true });
    return true;
  }
  // Space held turns a globe in every tool, Alt suspends snapping on it (P3b, panels.md 9.5); a field being typed in
  // keeps its Space
  const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  // While a globe is editable, Space is the turn key only: a button (or a row) that kept the focus after a mouse click
  // does not take it as a press (a second Undo, a hidden shape). A control focused from the keyboard (Tab, arrows)
  // keeps Space as its press. (:focus-visible cannot tell them apart here: a key press makes the focused element match
  // it before its keydown is dispatched.)
  let spaceEaten = false, lastInput = 'pointer', focusVia = 'pointer';
  document.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);
  document.addEventListener('keydown', (e) => { if (!(e.code === 'Space' || e.key === ' ')) lastInput = 'key'; }, true);
  document.addEventListener('focusin', () => { focusVia = lastInput; }, true);
  const eatSpace = (e) => {
    if (!(globeEdit('L') || globeEdit('R'))) return false;
    const a = document.activeElement;
    if (a && a !== document.body && focusVia === 'key') return false;
    e.preventDefault(); e.stopPropagation();
    if (a && a !== document.body && typeof a.blur === 'function') a.blur();
    return true;
  };
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.key === ' ') && !typing(e.target)) { spaceHeld = true; if (eatSpace(e)) spaceEaten = true; }
    if (e.key === 'Alt') altHeld = true;
  }, true);
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') { spaceHeld = false; if (spaceEaten) { e.preventDefault(); e.stopPropagation(); spaceEaten = false; } }
    if (e.key === 'Alt') altHeld = false;
  }, true);
  window.addEventListener('blur', () => { spaceHeld = false; altHeld = false; });
  function setupPane(pane, side) {
    const cv = pane.ocanvas;
    // a right click: the plane menu of the object there (a right-button pan that moved opens nothing; a touch opens it
    // with a long press, below). While drawing, it cancels the drawing instead (issue #13)
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (touches.size || performance.now() - holdMenuT < 900) return;
      // (the right button pressed during a left-button drag that draws: that drawing goes)
      if (drag && (drag.mode === 'draw' || drag.mode === 'gdraw')) { cancelDrawing(); setCursor(pane, side); return; }
      if ((lastPan.moved && performance.now() - lastPan.t < 500) || (drag && (drag.moved || drag.far))) return;
      // (the menu a key opened: the contextmenu event the key sends after it opens nothing more)
      if (PlaneMenu.justOpened()) return;
      const [x, y] = evXY(pane, e);
      // (macOS sends contextmenu at the right button's press: the menu waits for its release, so a right-drag still
      // pans; up, below, opens it when the press did not move)
      if (drag && (e.buttons & 2)) { drag.menuAt = { x, y }; return; }
      if (rightClickAt(pane, side, x, y)) { drag = null; setCursor(pane, side); }
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = evXY(pane, e);
      const k = e.ctrlKey ? 0.012 : 0.0016;
      zoomPane(pane, side, x, y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : k)));
      // (v16.4) a wheel zoom ends 250 ms after its last tick
      clearTimeout(pane.tourWheelT); pane.tourWheelT = setTimeout(() => tourViewMoved(side, 'zoom'), 250);
    }, { passive: false });
    // touch has no hover: the long press (INTERFACE.md "Long-press", v15). A still finger (8 px slop) fills a ring for
    // 450 ms; then its gesture is undone and becomes a probe (readouts, gauge). Sliding on probes; a release without
    // sliding opens the plane menu at the ring's point. A second finger, or a move before the ring is full, cancels it.
    let hold = null, ring = null;
    const PM = () => PlaneMenu;
    const endHold = () => { if (hold) { clearTimeout(hold.t); hold = null; } if (PM()) PM().ringStop(); };
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, evXY(pane, e));
        if (touches.size === 2) {
          ring = null;
          endHold();
          // a second finger ends the one-finger gesture; an edit it already made is kept as its own undo step ([v16.5 rail
          // SPEC 2.6] a point's or a shape's move goes back to its press state, no step)
          if (drag && (drag.mode === 'move' || drag.mode === 'handle') && Construct.cancelDrag && Construct.cancelDrag()) { /* cancelled */ }
          else if (drag && (drag.mode === 'cut' || ((drag.mode === 'move' || drag.mode === 'handle' || drag.mode === 'gmove' || drag.mode === 'ghandle' || drag.mode === 'zp') && drag.moved))) onUp(pane, side, e);
          if (drag && drag.mode === 'gdraw') { draft = null; requestRender(side); }
          drag = null; draft = draft && draft.kind === 'polygon' ? draft : null; return;
        }
      }
      onDown(pane, side, e);
      // (on the right: the Phase portrait, the image plane and the globe, whose hold probes w like a mouse hover)
      // (the landscape too with the plane menu: its hold probes the relief like a mouse hover; a still finger on a zero
      // or a pole of X gets the menu of that mark)
      const probeable = side === 'L' ? !lLand() || !!PM() : true;
      // (v16.5 UX49: with a construction tool, a finger on something it picks (a point, a line, a circle) picks it when
      // it lifts, however long it was held: a slow, careful tap opened the plane's menu and lost the pick. Over empty
      // space the long press still opens the menu)
      const cPick = e.pointerType === 'touch' && Construct.isTool(tool) && (() => { const [px, py] = evXY(pane, e); return !!Construct.snapAt(side, px, py, { points: true, cross: true, curves: true }); })();
      if (e.pointerType === 'touch' && drag && probeable && !cPick && drag.mode !== 'cut' && drag.mode !== 'handle' && drag.mode !== 'ghandle' && (drag.mode !== 'zp' || (PM() && !drag.added))) {
        const d0 = drag, [x0, y0] = evXY(pane, e);
        endHold();
        ring = null;
        if (PM()) PM().ringStart(e.clientX, e.clientY);
        hold = { id: e.pointerId, x: x0, y: y0, ev: e, t: setTimeout(() => {
          const ev = hold && hold.ev;
          hold = null;
          if (drag !== d0 || d0.moved || touches.size !== 1) { if (PM()) PM().ringStop(); return; }
          // undo what the touch began (a draft, a small pan), then probe under the finger, or open the integral
          // menu of a curve there. A drawing in progress (this touch's, a polygon's, a construction's picks) is
          // cancelled, and the release opens no menu (issue #13)
          const cancelled = cancelDrawing();
          if (d0.mode === 'panL') { const v = leftView(); v.cx = d0.cx; v.cy = d0.cy; requestRender('L', 'R'); }
          if (d0.mode === 'panR') { V.right.cx = d0.cx; V.right.cy = d0.cy; requestRender('R'); }
          if (d0.mode === 'orbit') { const c = d0.cam || camOf(side); c.yaw = d0.yaw; c.pitch = d0.pitch; c.vyaw = c.vpitch = 0; requestRender(side); }
          const r = cv.getBoundingClientRect();
          if (!PM() && !cancelled && openIntegralMenu(pane, side, x0, y0, r.left + x0, r.top + y0)) { drag = null; holdMenuT = performance.now(); setCursor(pane, side); return; }
          // the ring is full: a release without sliding opens the plane menu (up, below); sliding probes
          if (PM()) { ring = { id: ev.pointerId, x: x0, y: y0, slid: false, cancelled }; PM().ringFull(); }
          drag = { mode: 'probe' };
          onMove(pane, side, ev);
          // (Hear the function: the long press that engages the probe plays the pressed point, spec 3.9)
          sndQueryClick(pane, side, x0, y0);
        }, PM() ? 450 : 500) };
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (hold && e.pointerId === hold.id) {
        const [x, y] = evXY(pane, e);
        if (Math.hypot(x - hold.x, y - hold.y) > (PM() ? 8 : 6)) endHold(); else hold.ev = e;
      }
      if (ring && e.pointerId === ring.id && !ring.slid) {
        const [x, y] = evXY(pane, e);
        if (Math.hypot(x - ring.x, y - ring.y) > 8) { ring.slid = true; if (PM()) PM().ringStop(); }
      }
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        const prev = [...touches.values()];
        touches.set(e.pointerId, evXY(pane, e));
        if (touches.size === 2) {
          const now = [...touches.values()];
          const d0 = Math.hypot(prev[0][0] - prev[1][0], prev[0][1] - prev[1][1]);
          const d1 = Math.hypot(now[0][0] - now[1][0], now[0][1] - now[1][1]);
          if (d0 > 0 && d1 > 0) { zoomPane(pane, side, (now[0][0] + now[1][0]) / 2, (now[0][1] + now[1][1]) / 2, d1 / d0); if (d1 !== d0) pinched = pinched || 'zoom'; }
          // (two fingers pan as well as pinch: the midpoint's own move)
          { const pmx = (now[0][0] + now[1][0] - prev[0][0] - prev[1][0]) / 2, pmy = (now[0][1] + now[1][1] - prev[0][1] - prev[1][1]) / 2; if (pmx || pmy) { panPane(pane, side, pmx, pmy); pinched = pinched || 'pan'; } }
          // a two-finger drag turns a globe (P3b, P6: one finger draws there)
          if (side === 'L' ? lGlobe() : rGlobe()) {
            const c = camOf(side);
            const mx = (now[0][0] + now[1][0] - prev[0][0] - prev[1][0]) / 2, my = (now[0][1] + now[1][1] - prev[0][1] - prev[1][1]) / 2;
            if (c && (mx || my)) { pinched = 'orbit'; c.yaw -= mx * 0.35 * DEG; c.pitch = Math.max(pitchMin(c), Math.min(88 * DEG, c.pitch + my * 0.35 * DEG)); c.vyaw = c.vpitch = 0; requestRender(side); }
          }
          return;
        }
      }
      onMove(pane, side, e);
    });
    const up = (e) => {
      if (hold && e.pointerId === hold.id) endHold();
      const rg = ring && e.pointerId === ring.id ? ring : null;
      if (rg) { ring = null; if (PM()) PM().ringStop(); }
      const dm = drag && drag.menuAt && e.type === 'pointerup' ? drag : null;
      touches.delete(e.pointerId); onUp(pane, side, e);
      // (v16.4) a pinch (or a two-finger turn of a globe) ends when its fingers lift
      if (pinched && touches.size < 2) { const how = pinched; pinched = null; tourViewMoved(side, how); }
      // a right press that did not move (macOS): its menu now
      if (dm && !dm.far && !dm.moved && rightClickAt(pane, side, dm.menuAt.x, dm.menuAt.y)) setCursor(pane, side);
      // a long press released without sliding: the plane menu at the ring's point (none after it cancelled a drawing)
      if (rg && !rg.slid && !rg.cancelled && e.type === 'pointerup' && !touches.size && planeMenuAt(pane, side, rg.x, rg.y, true)) { holdMenuT = performance.now(); setCursor(pane, side); }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (!drag) Construct.leave(side); if (side === 'R') { rHover = null; setHoverW(null); requestRender('OL', 'OR'); } if (!drag) { sndHoverOff(); probe = null; hoverCut = 0; zpHover = null; setReadouts(null); requestRender('OL', 'OR', rGlobe() ? 'R' : null, lGlobe() || lLand() ? 'L' : null); } });
    cv.addEventListener('dblclick', (e) => {
      if (draft && draft.kind === 'polygon' && (side === 'R') === !!draft.target) { finishPolygon(); return; }
      // a double-click on an edge of a closed polygon adds a vertex there
      if (!is3DSide(side) && !Construct.isTool(tool) && (side === 'L' ? lFlat() && leftStage() === 0 : rImage() && targetsEditable())) {
        const [ex, ey] = evXY(pane, e);
        pane.setView(side === 'R' ? V.right : leftView());
        for (const s of (side === 'R' ? S.targets : S.shapes).filter((q) => q.visible !== false && polyEditable(q)).reverse()) {
          const eg = polyEdgeAt(pane, s, ex, ey, 7);
          if (eg && polyAddVertex(s, eg.i, eg.z)) { selected = s.id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL', 'OR'); undoToast($t('Vertex added.')); return; }
        }
      }
      // a double-click that turned the globe (or the landscape) brings the camera home; one that drew, picked or moved a
      // shape on an editable globe keeps the user's view
      if (is3DSide(side)) { const c = camOf(side); if (c && (!globeEdit(side) || gTurnPress[side])) tweenCam(c, camBaseOf(c)); return; }
      // a flat plane: centre the view at the point (issue #13), when the press pressed empty plane (a left pan that
      // did not move); one that drew, picked, or moved a shape, a mark or a cut handle leaves the view where it is (this
      // replaces v16.5's double-click zoom, UX66; the branch cut still moves by its red handle only)
      const lp = lastPress;
      if (!lp || lp.side !== side || (lp.mode !== 'panL' && lp.mode !== 'panR') || lp.far || lp.pb) return;
      if (Construct.isTool(tool)) return;
      const [x, y] = evXY(pane, e);
      if (!emptyAt(pane, side, x, y)) return;
      pane.setView(side === 'R' ? V.right : leftView());
      const z = pane.s2w(x, y);
      if (CX.isFin(z)) centerView(side, z);
    });
  }
  // The z-window used for meshing unbounded regions follows the left view, with some slack.
  // The re-centre happens once, at the end of the gesture (motion-vs-rest cause 2): while a press is held (a left pan,
  // a drag) it waits for pointer-up (onUp calls sourceViewChanged.flush); a wheel or a key zoom applies it after 200 ms
  // without view changes. The meshes rebuilt for the new window keep their old (mesh, fix-up) pair on screen until
  // their own fix-ups land (shapeGPU's hold), so no unfixed intermediate is ever drawn.
  function sourceViewChanged() {
    if (leftStage() !== 0 || solo() === 'R') return;
    clearTimeout(sourceViewChanged.t);
    sourceViewChanged.pending = true;
    sourceViewChanged.t = setTimeout(sourceViewChanged.apply, 200);
  }
  sourceViewChanged.flush = () => {
    if (!sourceViewChanged.pending) return;
    clearTimeout(sourceViewChanged.t);
    sourceViewChanged.t = setTimeout(sourceViewChanged.apply, 0);
  };
  sourceViewChanged.apply = () => {
      // the press is still held: onUp flushes it (checked again later in case the press ends without an onUp)
      if (drag) { sourceViewChanged.t = setTimeout(sourceViewChanged.apply, 200); return; }
      sourceViewChanged.pending = false;
      if (leftStage() !== 0 || solo() === 'R') return;
      // (v15.1: while X is a phone's inset, its window at its large size: review-phone-swap swap-7)
      const b = (Phone.largeBox && Phone.largeBox()) || paneL.box();
      // rounded outward to 1e-4 of the window's own size (rounding to significant digits of the coordinates
      // collapsed deep views far from 0 to zero width)
      const q = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 1e-4;
      if (!(q > 0) || !Number.isFinite(q)) return;
      const nb = { x0: Math.floor(b.x0 / q) * q, x1: Math.ceil(b.x1 / q) * q, y0: Math.floor(b.y0 / q) * q, y1: Math.ceil(b.y1 / q) * q };
      if (!goodWin(nb)) return;
      const ow = clipWin.x1 - clipWin.x0, nw = nb.x1 - nb.x0;
      const shift = Math.max(Math.abs((nb.x0 + nb.x1 - clipWin.x0 - clipWin.x1) / 2), Math.abs((nb.y0 + nb.y1 - clipWin.y0 - clipWin.y1) / 2));
      const aspect = Math.abs((nb.y1 - nb.y0) / nw - (clipWin.y1 - clipWin.y0) / ow);
      if (!goodWin(clipWin) || nw / ow > 1.35 || ow / nw > 1.35 || shift > 0.3 * Math.min(ow, nw) || aspect > 0.15) {
        clipWin = nb;
        setOpt('clipWin', clipWin);
        if (rightAuto && rImage()) fitRight(true);
        requestRender('L', 'R', 'T');
      }
      save();
  };
  function setCut(k, deg, snap15) {
    const st = S.steps[k - 1], b = built[k - 1];
    // unwrap against the current cut, so the seam turns continuously (to 190°, not to −170° on the same sheet)
    const old = Number(st.params.cut);
    let d = Number.isFinite(old) ? old + ((((deg - old) % 360) + 540) % 360 - 180) : deg;
    if (snap15) { const r = Math.round(d / 15) * 15; if (Math.abs(r - d) < 3) d = r; }
    d = Math.round(d * 10) / 10;
    // θ + 360m on sheet k is θ on sheet k + m: keep θ in (−180°, 180°] and carry the turns into the sheet, so
    // only the swept sector changes value and the card's (cut, sheet) names the evaluated branch
    if (b && b.def && b.def.params.some((q) => q.key === 'k')) {
      const m = Math.ceil((d - 180) / 360);
      if (m) {
        d = Math.round((d - 360 * m) * 10) / 10;
        let kk = Math.round(+st.params.k || 0) + m;
        if (st.type === 'root') { const n = Math.max(2, Math.round(+st.params.n || 2)); kk = ((kk % n) + n) % n; }
        st.params.k = kk;
        syncParam(k, 'k', '');
      }
    }
    st.params.cut = d;
    // (v16.5 UX33: every θ field of step k follows the seam, the Inspector's too, not only the cards')
    syncParam(k, 'cut', '');
    chainChanged(false);
  }
  function setCursor(pane, side) {
    let c = 'default';
    const gDraw = (sd) => globeEdit(sd) && tool !== 'select' && !GLOBE_OFF.has(tool) && tool !== 'formula';
    const gEditDrag = drag && /^g(draw|handle|move)$/.test(drag.mode);
    // the 10 px around ∞ hold no point and no vertex (panels.md 9.7): not-allowed there for the Point and Polygon
    // tools and while a point or a vertex is dragged
    const gDrawCur = (sd) => (gInf[sd] && (tool === 'point' || tool === 'polygon') ? 'not-allowed' : 'crosshair');
    const gEditCur = (sd) => (drag.mode === 'gdraw' ? 'crosshair' : gInf[sd] ? 'not-allowed' : 'grabbing');
    if (side === 'R') c = gEditDrag ? gEditCur('R') : rGlobe() ? (gDraw('R') && !drag ? gDrawCur('R') : drag ? 'grabbing' : 'grab')
      : targetsEditable() && !drag && tool !== 'select' ? 'crosshair' : (drag ? 'grabbing' : 'grab');
    else if (lGlobe() && gEditDrag) c = gEditCur('L');
    else if (lGlobe() && gDraw('L') && !drag) c = gDrawCur('L');
    else if (lGlobe() && leftStage() > 0 && tool !== 'select' && !drag) c = 'not-allowed';
    // the landscape takes no drawing (panels.md 9.1)
    else if (lLand() && tool !== 'select' && tool !== 'formula' && !drag) c = 'not-allowed';
    else if (!lFlat()) c = drag ? 'grabbing' : 'grab';
    // P4: shapes are drawn in the z-plane; at focus k >= 2 a drawing tool does not draw over X (nothing jumps)
    else if (leftStage() > 0 && tool !== 'select' && !drag) c = 'not-allowed';
    else if (drag && (drag.mode === 'panL' || drag.mode === 'zp')) c = 'grabbing';
    else if (hoverCut || zpHover) c = 'pointer';
    else if (leftStage() > 0) c = 'grab';
    else c = tool === 'select' ? 'default' : 'crosshair';
    pane.ocanvas.style.cursor = c;
  }
  // the last press that ended on a plane: {side, mode, far, pb} (a double-click centres only after an empty-plane press)
  let lastPress = null;
  function onDown(pane, side, e) {
    lastPress = null;
    const [x, y] = evXY(pane, e);
    ptrTouch = e.pointerType === 'touch' || e.pointerType === 'pen';
    Construct.pointer(e);   // (v16: touch radii, Alt)
    pane.ocanvas.setPointerCapture(e.pointerId);
    const panBtn = e.button === 1 || e.button === 2 || (e.shiftKey && e.altKey) || edgeTouch(pane, x, y);
    if (side === 'R') {
      // a press ends the hover: the preimages come back with the next hover
      if (hov.w) { setHoverW(null); requestRender('OL'); }
      // the w-globe takes targets (P3b)
      if (is3D() && globeEdit('R')) { globeDown(pane, side, e, x, y); gestureProbeOff(); setCursor(pane, side); return; }
      if (is3D()) {
        const c = cam3();
        c.vyaw = 0; c.vpitch = 0;
        drag = { mode: panBtn || e.shiftKey ? 'pan3' : 'orbit', cam: c, side: 'R', x, y, lx: x, ly: y, yaw: c.yaw, pitch: c.pitch, tx: c.tx, ty: c.ty };
      } else {
        // Image: the w-plane targets are drawn and edited here with the same tools
        if (targetsEditable() && !panBtn) {
          pane.setView(V.right);
          if (editDown(pane, 'R', pane.s2w(x, y), x, y)) { setCursor(pane, side); return; }
        }
        drag = { mode: 'panR', x, y, cx: V.right.cx, cy: V.right.cy, pb: panBtn };
      }
      setCursor(pane, side);
      return;
    }
    // left pane: the z-globe at stage 0 takes shapes (P3b); at a focused stage a drawing tool draws nothing there, as
    // in the plane (P4: the Whole chain button pulses); the landscape only turns
    if (lGlobe() && globeEdit('L')) { globeDown(pane, side, e, x, y); gestureProbeOff(); setCursor(pane, side); return; }
    if (lGlobe() && leftStage() > 0 && tool !== 'select' && !panBtn) pulseWhole();
    if (!lFlat()) {
      const c = camOf('L');
      if (c) { c.vyaw = 0; c.vpitch = 0; drag = { mode: panBtn || e.shiftKey ? 'pan3' : 'orbit', cam: c, side: 'L', x, y, lx: x, ly: y, yaw: c.yaw, pitch: c.pitch, tx: c.tx, ty: c.ty }; }
      setCursor(pane, side);
      return;
    }
    pane.setView(leftView());
    const z = pane.s2w(x, y);
    if (panBtn) { drag = { mode: 'panL', x, y, cx: leftView().cx, cy: leftView().cy, pane, pb: true }; setCursor(pane, side); return; }
    // the zeros and poles of a zeros-and-poles step acting here: a press drags one (and selects it: Delete removes it);
    // Shift-click adds a zero, Shift-⌘ (Ctrl) click a pole, and the press goes on dragging it
    if (zpStep()) {
      // (a handle of the selected shape on the same spot wins: a disc about 0 of radius 1 under the default zeros)
      const selSh = leftStage() === 0 && tool === 'select' && selected ? S.shapes.find((s) => s.id === selected) : null;
      const onSel = !!selSh && (ptrTouch ? !!handleAt(pane, selSh, x, y) : Region.handlesOf(selSh).some(([hk, hz]) => { if (selSh.at && selSh.at[hk]) return false; const [hx, hy] = pane.w2s(hz); return Math.abs(hx - x) < 8 && Math.abs(hy - y) < 8; }));
      const zh = onSel || (tool !== 'select' && tool !== 'point') ? null : zpHit(x, y, e.pointerType === 'touch' ? 22 : 11);   // (v16 [C1]: other tools pick a zero)
      if (zh) {
        zpSel = { k: zh.k, kind: zh.kind, i: zh.i };
        if (selected) { selected = null; buildShapeList(); requestRender('L', 'R'); }
        drag = { mode: 'zp', k: zh.k, kind: zh.kind, i: zh.i, x0: x, y0: y, x, y, moved: false, off: false };
        setCursor(pane, side); requestRender('OL');
        return;
      }
      if (e.shiftKey && !e.altKey && e.button === 0) {
        const kind = e.metaKey || e.ctrlKey ? 'poles' : 'zeros', k = zpStep().k;
        const i = zpAdd(k, kind, zpRound(pane, snapZ(pane, z)));
        if (i >= 0) { drag = { mode: 'zp', k, kind, i, x0: x, y0: y, x, y, moved: true, off: false, added: true }; setCursor(pane, side); requestRender('OL'); return; }
        return;   // (refused at the cap, with a toast: still a zero gesture, so it selects no shape and keeps the step's Inspector)
      }
      if (zpSel) { zpSel = null; requestRender('OL'); }
    }
    // cut handles have priority
    for (const hnd of cutHandlesL) {
      if (Math.hypot(hnd.x - x, hnd.y - y) < 12) { drag = { mode: 'cut', step: hnd.step, p: hnd.p }; return; }
    }
    // shapes are drawn in the z-plane: a drawing tool used on a step's input plane returns to it first
    // (P4: nothing jumps mid-gesture; the Whole chain button pulses once to show the way back)
    if (leftStage() > 0 && tool !== 'select') { pulseWhole(); return; }
    if (leftStage() === 0 && editDown(pane, 'L', z, x, y)) return;
    drag = { mode: 'panL', x, y, cx: leftView().cx, cy: leftView().cy, pane };
    setCursor(pane, side);
  }
  // Tools and selection on a plane's own shapes: the domain's on the left (at stage 0), the targets on the right
  // (Preimage). Returns true when the press was used (a draft, a new point, a handle or a shape to move).
  function editDown(pane, side, z, x, y) {
    const target = side === 'R';
    const list = target ? S.targets : S.shapes, win = target ? targetWin() : clipWin, ov = target ? 'OR' : 'OL';
    if (Construct.isTool(tool)) return Construct.toolDown(pane, side, x, y);   // (v16: picks are clicks, onUp)
    // polygon drafting
    if (tool === 'polygon') {
      if (!draft || !!draft.target !== target) draft = { kind: 'polygon', pts: [], target };
      if (draft.pts.length >= 3) {
        const [fx, fy] = pane.w2sxy(draft.pts[0][0], draft.pts[0][1]);
        if (Math.hypot(fx - x, fy - y) < (ptrTouch ? 24 : 12)) { finishPolygon(); return true; }
      }
      const cmT = Construct.vertexPick(draft, side, x, y);   // (v16: a vertex binds to a point)
      const zz = cmT || snapZ(pane, z);
      draft.pts.push([zz.re, zz.im]);
      requestRender(ov);
      return true;
    }
    // (touch, a drawing tool: a press on the shape just drawn moves it, or reshapes it by a handle; a press elsewhere draws)
    if (ptrTouch && tool !== 'select' && tool !== 'point' && justDrawn && selected === justDrawn) {
      const js = list.find((q) => q.id === justDrawn);
      if (js) {
        const jk = handleAt(pane, js, x, y);
        if (jk) { drag = { mode: 'handle', shape: js, key: jk, target }; return true; }
        let onBody = false;
        try { onBody = !!Region.hitTest(js, z, 18 / pane.view.s, win); } catch (e) { onBody = false; }
        if (onBody) { drag = { mode: 'move', shape: js, z0: z, moved: false, target }; requestRender(ov); return true; }
      }
    }
    if (tool !== 'select') {
      if (tool === 'point') {
        const pd = Construct.pointDown(pane, side, x, y);   // (v16: a crossing, a curve, a point)
        // ([v16.5 rail SPEC 6] a press on an existing point selects it, and a drag from there moves it as the Select tool
        // would: along its curve, off it by a pull, or a free point with snapping. A click alone changes nothing)
        if (pd === 'existing') { const ps = list.find((s) => s.id === selected && s.kind === 'point'); if (ps) drag = { mode: 'move', shape: ps, z0: z, moved: false, target, cmTell: Construct.touchNow() }; }   // ([v16.5 fix rail-6] cmTell: a finger's tap that does not move says how to place another, at the release)
        if (pd) return true;
      }
      // [UX47] the second click (or tap) of a two-click shape: its end, here; a drag from it still moves the end
      if (draft && draft.pending && !draft.globe && draft.kind === tool && !!draft.target === target) {
        const zp = Construct.drawMove(pane, side, tool, x, y) || snapZ(pane, z);
        Object.assign(draft.shape, Region.defaultsFor(tool, draft.z0, zp));
        draft.pending = false;
        drag = { mode: 'draw', target, second: true };
        requestRender(ov);
        return true;
      }
      if (draft && draft.pending) dropPending();
      const cmZ = tool !== 'point' ? Construct.drawStart(pane, side, tool, x, y) : null;   // (v16: the press binds the start [C19])
      const zz = cmZ || snapZ(pane, z);
      if (tool === 'point') { addShape(newShape('point', { p: [zz.re, zz.im] }, target), target); return true; }
      const shape = newShape(tool === 'lasso' ? 'polygon' : tool, tool === 'curve' || tool === 'lasso' ? { pts: [[zz.re, zz.im]] } : Region.defaultsFor(tool, zz, zz), target);
      draft = { kind: tool, shape, z0: zz, color: shape.color, target };
      drag = { mode: 'draw', target };
      requestRender(ov);
      return true;
    }
    // handles of the selected shape
    const sel = list.find((s) => s.id === selected);
    const cmU = sel ? Construct.boundUnder(sel, pane, x, y) : null;   // (v16: a bound handle's press goes to what is beneath)
    if (cmU) { if (cmU.key) { drag = { mode: 'handle', shape: cmU.shape, key: cmU.key, target }; return true; } selected = cmU.shape.id; zpSel = null; buildShapeList(); drag = { mode: 'move', shape: cmU.shape, z0: z, moved: false, target }; requestRender(ov); return true; }
    if (sel) {
      const hk = handleAt(pane, sel, x, y);
      if (hk) { drag = { mode: 'handle', shape: sel, key: hk, target }; return true; }
    }
    // [v16.5 UX09] a finger picks a line or a curve within 18 px (a mouse within 7)
    const tol = (ptrTouch ? 18 : 7) / pane.view.s;
    // topmost first, points before curves (a 3-point circle passes through its points: v16 verify-1), filled areas last
    const hitRank = (s) => (kindType(s) === 'point' ? 0 : kindType(s) === 'area' ? 2 : 1);
    const cands = list.filter((s) => s.visible !== false).reverse()
      .sort((a, b) => hitRank(a) - hitRank(b));
    let hit = null;
    const under = [];
    for (const s of cands) {
      try { if (Region.hitTest(s, z, tol, win)) { under.push(s); if (!altHeld) break; } } catch (e) { /* a damaged formula never hits */ }
    }
    // (UX42: Alt-click on shapes that cover each other goes to the next one under the pointer, round again at the last)
    hit = altHeld && under.length > 1 && under.some((s) => s.id === selected) ? under[(under.findIndex((s) => s.id === selected) + 1) % under.length] : under[0] || null;
    if (hit) {
      // (touch: the first press on a shape with area or curves only selects it, and a drag from it pans; the next one moves it. A point is a small, deliberate target: a drag moves it)
      const firstTap = ptrTouch && selected !== hit.id && kindType(hit) !== 'point';
      if (selected !== hit.id) { selected = hit.id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL'); }
      if (firstTap) drag = target ? { mode: 'panR', x, y, cx: V.right.cx, cy: V.right.cy } : { mode: 'panL', x, y, cx: leftView().cx, cy: leftView().cy, pane };
      else drag = { mode: 'move', shape: hit, z0: z, moved: false, target };
      requestRender(ov);
      return true;
    }
    if (selected) { selected = null; buildShapeList(); requestRender('L', 'R'); }
    return false;
  }
  // ---------------- drawing on the globes (panels.md 9, phase P3b) ----------------
  // X Sphere at stage 0 takes shapes, Y Sphere takes targets, with the same tools as the planes. Everything works from
  // the picked point P of the sphere first (Region.Globe) and needs z only to store planar parameters. Circle and Disc
  // build caps (stored as disc, complement of a disc or half-plane; circle or line); Annulus, Sector and Polar grid
  // are off on the globes (the user's decision, panels.md 9.2).
  const GL3 = Region.Globe;
  const globeEdit = (side) => (side === 'L' ? lGlobe() && leftStage() === 0 && solo() !== 'R' : rGlobe() && !morphOn() && solo() !== 'L');
  const GLOBE_OFF = new Set(['annulus', 'sector', 'pgrid']);
  // the snap net of a tool (panels.md 9.5, P8): round kinds snap to the polar net, Cartesian kinds to the lifted lattice;
  // the globe's graticule draws the net of the active tool (the polar net with Select)
  const ROUND_TOOLS = new Set(['select', 'point', 'circle', 'disc', 'formula', 'annulus', 'sector', 'pgrid']);
  const globeNet = () => (ROUND_TOOLS.has(tool) ? 'polar' : 'cart');
  let spaceHeld = false, altHeld = false;
  // per side: the last press on an editable globe turned it (a double-click then resets the camera); the last point
  // placed on a globe ({id, t})
  const gTurnPress = { L: false, R: false };
  // per side: the pointer is within 10 px of ∞ where the tool or the dragged handle cannot put a point (cursor)
  const gInf = { L: false, R: false };
  function setGInf(pane, side, v) { if (gInf[side] !== v) { gInf[side] = v; setCursor(pane, side); } }
  let lastGlobePoint = null;
  let gSnapMark = null;          // {side, P}: the snapped point of the gesture in progress (a ring, lifted)
  const rimPhi = new Map();      // shape id -> the angle of its rim handle about the cap centre (panels.md 9.4)
  // the camera of a globe pane as the last frame drew it: {pane, c, MVP, eye, R (silhouette radius, CSS px)}
  function globeCam(side) {
    const pane = side === 'L' ? paneL : paneR, c = camOf(side);
    if (!pane || !c || !GLR.camera || !(pane.w > 0 && pane.h > 0)) return null;
    const pc = GLR.camera(c, pane.w, pane.h), D = Math.hypot(...pc.eye);
    const R = D > 1 ? Math.tan(Math.asin(1 / D)) / Math.tan((c.fov || 28 * DEG) / 2) * pane.h / 2 : pane.h / 2;
    return { pane, c, MVP: pc.MVP, eye: pc.eye, R };
  }
  // a point of the sphere on screen (CSS px), or null on the far hemisphere
  function gScreen(gc, P) {
    const tv = [gc.eye[0] - P[0], gc.eye[1] - P[1], gc.eye[2] - P[2]];
    if (tv[0] * P[0] + tv[1] * P[1] + tv[2] * P[2] <= 0) return null;
    return project(gc.pane, gc.MVP, P);
  }
  // the point of the Riemann sphere under pane pixel (x, y) of a globe orbited by camera c: {P, z (null within 1e-9 of
  // N), limb}. Off the globe: null, or with clamp the globe's point nearest the ray (a drag carried past the limb).
  function pickGlobe(pane, c, x, y, clamp) {
    if (!pane || !(pane.w > 0 && pane.h > 0) || !c) return null;
    const ex = c.tx + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw), ey = c.ty + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), ez = c.tz + c.dist * Math.sin(c.pitch);
    const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((t) => t / l); };
    const f = nrm([c.tx - ex, c.ty - ey, c.tz - ez]);
    const r = nrm([f[1], -f[0], 0]);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const th = Math.tan((c.fov || 28 * DEG) / 2), nx = (2 * x / pane.w - 1) * th * pane.w / pane.h, ny = (1 - 2 * y / pane.h) * th;
    const d = nrm([0, 1, 2].map((k) => f[k] + nx * r[k] + ny * u[k]));
    const e = [ex, ey, ez];
    const b = e[0] * d[0] + e[1] * d[1] + e[2] * d[2], cc = e[0] * e[0] + e[1] * e[1] + e[2] * e[2] - 1;
    const disc = b * b - cc;
    let P, limb = false;
    if (disc >= 0 && -b - Math.sqrt(disc) > 0) { const t = -b - Math.sqrt(disc); P = [0, 1, 2].map((k) => e[k] + t * d[k]); }
    else if (clamp) { P = [0, 1, 2].map((k) => e[k] - b * d[k]); limb = true; }
    else return null;
    P = nrm(P);
    return { P, z: GL3.finiteOf(P), limb };
  }
  // ∞ cannot hold a point or a vertex: the 10 px around N are off the plane for them (panels.md 9.7)
  function nearInf(gc, x, y) { const q = gScreen(gc, [0, 0, 1]); return !!q && Math.hypot(q[0] - x, q[1] - y) <= 10; }
  // the rim handle's angle about the cap centre: remembered per shape, else the rim point that faces the camera most
  function rimPhiOf(s, gc) {
    if (rimPhi.has(s.id)) return rimPhi.get(s.id);
    const cap = GL3.capOf(s);
    if (!cap || !gc) return 0;
    let best = 0, bd = -Infinity;
    for (let i = 0; i < 24; i++) { const t = TAU * i / 24, P = GL3.rimPoint(cap.C, cap.h, t), d = GL3.dot3(P, gc.eye) - 1; if (d > bd) { bd = d; best = t; } }
    return best;
  }
  const globeHandles = (s, gc) => { try { return GL3.globeHandlesOf(s, GL3.capFamily(s) ? rimPhiOf(s, gc) : 0); } catch (e) { return []; } };
  // the ∞ snap of a cap (panels.md 9.3, 9.5): the rim within 8 px of arc of N goes through N exactly (h = C_z). It is
  // also the precision guard that bounds r (r <~ 20 sin a at a 150 px globe), so it holds with Snap off too.
  function infSnapH(gc, Cv, h) {
    const C = GL3.norm3(Cv);
    const a = Math.acos(Math.max(-1, Math.min(1, C[2]))), al = Math.acos(Math.max(-1, Math.min(1, h)));
    return Math.abs(a - al) * (gc ? gc.R : 150) <= 8 ? C[2] : h;
  }
  // a cap's centre moved so that its rim passes N (the ∞ snap of a move: the azimuth kept, the polar angle = its
  // radius); null when the rim is not within 8 px of arc of N (or passes it already)
  function infSnapC(gc, Cv, h) {
    const C = GL3.norm3(Cv);
    if (infSnapH(gc, C, h) !== C[2] || C[2] === h) return null;
    const al = Math.acos(Math.max(-1, Math.min(1, h))), az = Math.atan2(C[1], C[0]);
    return [Math.sin(al) * Math.cos(az), Math.sin(al) * Math.sin(az), h];
  }
  // snapping on a globe (panels.md 9.5; Snap on, Alt suspends it): handles of other shapes 8 px, then the marked points
  // 0, 1, i, -1, -i (and ∞ for rims and centres) 10 px, then the net of the kind: the polar net for round kinds
  // (intersections 6 px, single lines 4 px), the lifted Cartesian lattice (the plane's own snap) for the others.
  // role: 'centre' | 'rim' | 'round' | 'cart'. Returns {P, z, snapped}
  function globeSnap(gc, side, g, role, self) {
    if (!g || !gc || !S.snap || altHeld) return g;
    const q0 = gScreen(gc, g.P);
    if (!q0) return g;
    const dist = (P) => { const q = gScreen(gc, P); return q ? Math.hypot(q[0] - q0[0], q[1] - q0[1]) : Infinity; };
    const best = (cands, rad) => { let b = null, bd = rad; for (const P of cands) { const d = dist(P); if (d <= bd) { bd = d; b = P; } } return b; };
    const out = (P) => { const Pn = GL3.norm3(P); gSnapMark = { side, P: Pn }; return { P: Pn, z: GL3.finiteOf(Pn), snapped: true, pt: true }; };
    const others = [];
    for (const s of side === 'R' ? S.targets : S.shapes) {
      if (s === self || s.visible === false) continue;
      for (const [k, P] of globeHandles(s, gc)) if (k !== 'rim') others.push(P);
    }
    let P = best(others, 8);
    if (P) return out(P);
    const marks = [[0, 0, -1], GL3.lift(1, 0), GL3.lift(0, 1), GL3.lift(-1, 0), GL3.lift(0, -1)];
    if (role === 'centre' || role === 'rim') marks.push([0, 0, 1]);
    P = best(marks, 10);
    if (P) return out(P);
    const z = g.z;
    if (!z) return g;
    if (role === 'cart') {
      // the finest graph-paper tier that is clearly drawn at the pointer (snapZ's rule with the globe's local scale)
      const eps = 1e-4 * Math.max(1, CX.abs(z));
      const sx = dist(GL3.lift(z.re + eps, z.im)) / eps, sy = dist(GL3.lift(z.re, z.im + eps)) / eps, sc = Math.min(sx, sy);
      if (!(sc > 0) || !Number.isFinite(sc)) return g;
      // ([v16.5 rail SPEC 1.3] the drawn tiers, halves included, as the lifted lattice draws them: Constr.gridStep)
      const d0 = Math.pow(10, Math.ceil(Math.log10(8 / sc)));
      const step = Constr.gridStep ? Constr.gridStep(sc) : [1, 5, 10, 50, 100].map((m) => d0 * m).find((st) => st * sc >= 14) || d0 * 100;
      const gx = +(Math.round(z.re / step) * step).toPrecision(12), gy = +(Math.round(z.im / step) * step).toPrecision(12);
      const Pg = GL3.lift(gx, gy);
      if (dist(Pg) < 9) { gSnapMark = { side, P: Pg }; return { P: Pg, z: C(gx, gy), snapped: true }; }
      return g;
    }
    // the polar net: meridians every 15 deg, parallels |z| = 2^k, |k| <= 3
    const r = CX.abs(z), th = Math.atan2(z.im, z.re);
    const tm = Math.round(th / (15 * DEG)) * 15 * DEG, k = Math.round(Math.log2(r));
    const pz = (rr, t) => { const x = rr * Math.cos(t), y = rr * Math.sin(t); return [Math.abs(x) < 1e-15 * rr ? 0 : x, Math.abs(y) < 1e-15 * rr ? 0 : y]; };
    const at = (rr, t) => { const [x, y] = pz(rr, t); return { P: GL3.lift(x, y), z: C(x, y) }; };
    // an intersection within 6 px first, then the nearer single line within 4 px
    const lines = [];
    let hit = null;
    if (Math.abs(k) <= 3) { const rp = Math.pow(2, k), X = at(rp, tm); if (dist(X.P) <= 6) hit = X; lines.push(at(rp, th)); }
    if (!hit) {
      if (r > 0) lines.push(at(r, tm));
      let bd = 4;
      for (const L of lines) { const dd = dist(L.P); if (dd <= bd) { bd = dd; hit = L; } }
    }
    if (!hit) return g;
    gSnapMark = { side, P: hit.P };
    return { P: hit.P, z: hit.z, snapped: true };
  }
  // the readout chip of a globe draft or edit: the set with its kind tag (panels.md 9.4: the kind change through ∞ is
  // visible as it happens), or the dimensions of other kinds
  function capSetHtml(s) {
    const f = (x) => { const t = fmtR(x, 3); return (/[.,]/.test(t) && !t.includes('×') ? t.replace(/0+$/, '').replace(/[.,]$/, '') : t).replace(/^−0$/, '0'); };
    const zc = (c) => { const re = c[0], im = c[1]; if (Math.hypot(re, im) < 1e-12) return '<i>z</i>'; return `|<i>z</i> − (${fmtCxHtml(C(re, im), 3)})|`; };
    const tag = (t) => ` <span class="rk">[${t}]</span>`;
    if (s.kind === 'disc' || s.kind === 'circle') {
      const rel = s.kind === 'circle' ? '=' : s.complement ? '&gt;' : '&lt;';
      const lhs = Math.hypot(s.c[0], s.c[1]) < 1e-12 ? '|<i>z</i>|' : zc(s.c);
      return `${lhs} ${rel} ${f(s.r)}${tag(s.kind === 'circle' ? 'circle' : s.complement ? $t('complement of a disc') : 'disc')}`;
    }
    if (s.kind === 'halfplane' || s.kind === 'line') {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = Math.hypot(dx, dy) || 1, n = [-dy / l, dx / l], t = n[0] * s.a[0] + n[1] * s.a[1];
      const rel = s.kind === 'line' ? '=' : '&gt;', rev = s.kind === 'line' ? '=' : '&lt;';
      const kind = tag(s.kind === 'line' ? 'line' : 'half-plane');
      if (Math.abs(n[0]) < 1e-9) return `Im <i>z</i> ${n[1] > 0 ? rel : rev} ${f(t * Math.sign(n[1]))}${kind}`;
      if (Math.abs(n[1]) < 1e-9) return `Re <i>z</i> ${n[0] > 0 ? rel : rev} ${f(t * Math.sign(n[0]))}${kind}`;
      // Re(conj(n) z) with n = e^(i theta): Re(e^(-i theta) z)
      const ang = Math.atan2(n[1], n[0]) / DEG, sup = ang < 0 ? `${f(-ang)}°` : `−${f(ang)}°`;
      return `Re(<i>e</i><sup>${sup}<i>i</i></sup><i>z</i>) ${rel} ${f(t)}${kind}`;
    }
    return '';
  }
  function globeChip(side, s) {
    const el = $(side === 'L' ? 'leftReadout' : 'rightReadout');
    if (!el || el.classList.contains('copied')) return;
    let t = s ? capSetHtml(s) : '';
    if (s && !t) {
      const P = (a) => C(a[0], a[1]);
      if (s.kind === 'rect' || s.kind === 'cgrid') t = `${fmtR(Math.abs(s.b[0] - s.a[0]), 3)} × ${fmtR(Math.abs(s.b[1] - s.a[1]), 3)}`;
      else if (['segment', 'ray', 'arc'].includes(s.kind)) { const d = CX.sub(P(s.b), P(s.a)); t = `${fmtR(CX.abs(d), 3)} ∠ ${fmtR(Math.atan2(d.im, d.re) / DEG, 1)}°`; }
      else if (s.kind === 'point') t = rk('', fmtCxHtml(P(s.p)));
    }
    if (t) el.innerHTML = `<span class="rp"><span class="rv">${t}</span></span>`;
  }
  // the shape fields a globe edit may change (a kind change through ∞ drops the old kind's fields)
  const GEOM_KEYS = ['kind', 'a', 'b', 'c', 'r', 'complement', 'p', 'm', 'pts'];
  function setGeom(s, from) {
    for (const k of GEOM_KEYS) if (k !== 'kind') delete s[k];
    for (const k of GEOM_KEYS) if (from[k] !== undefined) s[k] = JSON.parse(JSON.stringify(from[k]));
  }
  // curves of shape s within tol px of (x, y) on the globe (its sphere curves, front-facing pieces)
  function globeCurveHit(gc, s, x, y, tol) {
    let curves = [];
    try { curves = Region.sphereCurvesOf(s, 160, viewBox(S.srcView)); } catch (e) { curves = []; }
    for (const c of curves) {
      const n = c.pts.length, m = c.closed ? n : n - 1;
      let qa = gScreen(gc, c.pts[0]);
      for (let i = 0; i < m; i++) {
        const qb = gScreen(gc, c.pts[(i + 1) % n]);
        if (qa && qb) {
          const dx = qb[0] - qa[0], dy = qb[1] - qa[1], L = dx * dx + dy * dy;
          const t = L > 0 ? Math.max(0, Math.min(1, ((x - qa[0]) * dx + (y - qa[1]) * dy) / L)) : 0;
          if (Math.hypot(qa[0] + t * dx - x, qa[1] + t * dy - y) <= tol) return true;
        }
        qa = qb;
      }
    }
    return false;
  }
  // a press on an editable globe: a draft, a point, a handle or a shape to move; otherwise the globe turns
  function globeDown(pane, side, e, x, y) {
    const c = camOf(side), gc = globeCam(side);
    const target = side === 'R', list = target ? S.targets : S.shapes, ov = side;
    altHeld = !!e.altKey; gSnapMark = null;
    gTurnPress[side] = false;
    const turn = () => { gTurnPress[side] = true; c.vyaw = 0; c.vpitch = 0; drag = { mode: e.button === 2 || e.shiftKey ? 'pan3' : 'orbit', cam: c, side, x, y, lx: x, ly: y, yaw: c.yaw, pitch: c.pitch, tx: c.tx, ty: c.ty }; };
    // the middle button, Space held or the right button turn (or pan) the globe in every tool (panels.md 9.5)
    const g = pickGlobe(pane, c, x, y);
    if (!gc || !g || e.button === 1 || e.button === 2 || spaceHeld || (e.shiftKey && e.altKey) || edgeTouch(pane, x, y)) { turn(); return; }
    if (GLOBE_OFF.has(tool) || tool === 'formula') { turn(); return; }
    if (Construct.isTool(tool)) { turn(); drag.cmPick = true; return; }   // (v16: a click picks, onUp; a drag turns)
    if (tool === 'polygon') {
      if (nearInf(gc, x, y)) return;
      const gs = globeSnap(gc, side, g, 'cart');
      if (!gs.z) return;
      if (!draft || draft.kind !== 'polygon' || draft.globe !== side) draft = { kind: 'polygon', pts: [], target, globe: side };
      if (draft.pts.length >= 3) {
        const q = gScreen(gc, GL3.lift(draft.pts[0][0], draft.pts[0][1]));
        if (q && Math.hypot(q[0] - x, q[1] - y) < (ptrTouch ? 24 : 12)) { finishPolygon(); return; }
      }
      draft.pts.push([gs.z.re, gs.z.im]);
      requestRender(ov, 'O' + side);
      return;
    }
    if (tool === 'point') {
      if (nearInf(gc, x, y)) return;
      const gs = globeSnap(gc, side, g, 'round');
      if (!gs.z) return;
      // the second press of a double-click places no second point on the first
      const last = list[list.length - 1], now = performance.now();
      // ([v16.5 rail SPEC 1.2 (c)] on a drawn curve (no point or mark took the press): a point on that curve)
      if (!gs.pt && Construct.globePoint && Construct.globePoint(side, g, x, y, gc, (s, tol) => globeCurveHit(gc, s, x, y, tol))) {
        const pl = list[list.length - 1];
        lastGlobePoint = pl ? { id: pl.id, t: now } : null; gSnapMark = null;
        return;
      }
      if (lastGlobePoint && last && lastGlobePoint.id === last.id && now - lastGlobePoint.t < 600) {
        const Pl = GL3.lift(last.p[0], last.p[1]);
        if (Math.hypot(Pl[0] - gs.P[0], Pl[1] - gs.P[1], Pl[2] - gs.P[2]) < 1e-9) return;
      }
      const pt = newShape('point', { p: [gs.z.re, gs.z.im] }, target);
      addShape(pt, target);
      lastGlobePoint = { id: pt.id, t: now };
      gSnapMark = null;
      return;
    }
    // (touch, a drawing tool: a press on the shape just drawn, on its handle or on it, moves or reshapes it; elsewhere draws)
    if (ptrTouch && justDrawn && selected === justDrawn) {
      const js = list.find((q) => q.id === justDrawn);
      if (js) {
        for (const [key, P] of globeHandles(js, gc)) {
          const q = gScreen(gc, P);
          if (q && Math.hypot(q[0] - x, q[1] - y) <= 18) { drag = { mode: 'ghandle', shape: js, key, target, side, x, y }; return; }
        }
        if (globeCurveHit(gc, js, x, y, 10) || GL3.globeInside(js, g.P)) { drag = { mode: 'gmove', shape: js, P0: g.P, z0: g.z, s0: JSON.parse(JSON.stringify(js)), moved: false, target, side, x, y }; requestRender('O' + side); return; }
      }
    }
    // [UX47] the second click of a two-click shape on this globe: its end (the rim of a circle) at the press
    if (draft && draft.pending && draft.globe === side && draft.kind === tool) {
      draft.pending = false;
      drag = { mode: 'gdraw', target, side, x, y, second: true };
      globeMove(pane, side, e, x, y);
      return;
    }
    if (draft && draft.pending) dropPending();
    if (tool === 'disc' || tool === 'circle') {
      const gs = globeSnap(gc, side, g, 'centre');
      const Cv = gs.P;
      const shape = newShape(tool, {}, target);
      GL3.applyCap(shape, Cv, Math.cos(GL3.CAP_MIN));
      draft = { kind: tool, shape, cap: true, C: Cv, color: shape.color, target, globe: side, x, y };
      drag = { mode: 'gdraw', target, side, x, y };
      requestRender(ov, 'O' + side);
      return;
    }
    if (tool !== 'select') {
      const gs = globeSnap(gc, side, g, 'cart');
      if (!gs.z) { turn(); return; }
      const zz = gs.z;
      const shape = newShape(tool === 'lasso' ? 'polygon' : tool, tool === 'curve' || tool === 'lasso' ? { pts: [[zz.re, zz.im]] } : Region.defaultsFor(tool, zz, zz), target);
      draft = { kind: tool, shape, z0: zz, color: shape.color, target, globe: side, x, y };
      drag = { mode: 'gdraw', target, side, x, y };
      requestRender(ov, 'O' + side);
      return;
    }
    // Select: handles of the selected shape (8 px), then curves and area rims (6 px), then areas (topmost first)
    const sel = list.find((s) => s.id === selected);
    if (sel) {
      for (const [key, P] of globeHandles(sel, gc)) {
        const q = gScreen(gc, P);
        if (q && Math.hypot(q[0] - x, q[1] - y) <= (ptrTouch ? 18 : 8)) { drag = { mode: 'ghandle', shape: sel, key, target, side, x, y }; return; }
      }
    }
    const vis = list.filter((s) => s.visible !== false).reverse();
    let hit = null;
    // (points first, then curves: a curve through a point never takes its press, v16 verify-1)
    for (const s of vis) {
      if (kindType(s) !== 'point') continue;
      const q = gScreen(gc, GL3.lift(s.p[0], s.p[1])); if (q && Math.hypot(q[0] - x, q[1] - y) <= 7) { hit = s; break; }
    }
    if (!hit) for (const s of vis) if (kindType(s) !== 'point' && globeCurveHit(gc, s, x, y, 6)) { hit = s; break; }
    if (!hit) for (const s of vis) if (GL3.globeInside(s, g.P)) { hit = s; break; }
    // (touch: a press on a shape with area or curves that is not selected turns the globe, and a tap only selects it; the selected shape moves, and so does a point)
    if (hit && ptrTouch && selected !== hit.id && kindType(hit) !== 'point') { turn(); drag.gsel = hit.id; return; }
    if (hit) {
      if (selected !== hit.id) { selected = hit.id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL'); }
      drag = { mode: 'gmove', shape: hit, P0: g.P, z0: g.z, s0: JSON.parse(JSON.stringify(hit)), moved: false, target, side, x, y };
      requestRender('O' + side);
      return;
    }
    if (selected) { selected = null; buildShapeList(); requestRender('L', 'R'); }
    turn();
  }
  // a globe gesture (draw, handle, move) hides the probe: no ring or readout stays at the press point while the shape
  // moves away; the next hover after release probes again
  function gestureProbeOff() {
    if (!drag || !/^g(draw|handle|move)$/.test(drag.mode)) return;
    const had = !!probe || !!rHover;
    probe = null;
    if (rHover) { rHover = null; setHoverW(null); }
    if (had) { setReadouts(null); requestRender('L', 'OL', 'OR', rGlobe() ? 'R' : null); }
  }
  // a pointer move of a globe gesture (draw, handle, move)
  function globeMove(pane, side, e, x, y) {
    const d = drag, c = camOf(side), gc = globeCam(side);
    altHeld = !!e.altKey; gSnapMark = null;
    const g = pickGlobe(pane, c, x, y, true);
    if (!g || !gc) return;
    // a draft is in neither list until release: only its globe and the chip change (as a planar draft touches only
    // its overlay); a stored shape that changes updates the lists and both panes
    const changed = (s) => {
      if (d.mode !== 'gdraw') { if (d.target) targetsChanged(false); else shapesChanged(false); }
      globeChip(side, s);
      requestRender(side, 'O' + side);
    };
    if (d.mode === 'gdraw' && draft) {
      const s = draft.shape;
      if (draft.cap) {
        // the rim through the pointer (h = P.C), snapped, then through ∞ when N is within 8 px of arc of it
        const gs = globeSnap(gc, side, g, 'rim', s);
        const lim = Math.cos(GL3.CAP_MIN);
        let h = Math.max(-lim, Math.min(lim, GL3.dot3(gs.P, draft.C)));
        const hs = infSnapH(gc, draft.C, h);
        if (hs !== h) { h = hs; gSnapMark = { side, P: [0, 0, 1] }; }
        GL3.applyCap(s, draft.C, h);
        rimPhi.set(s.id, GL3.rimAngle(draft.C, gs.P));
        changed(s);
        return;
      }
      if (draft.kind === 'curve' || draft.kind === 'lasso') {
        if (!g.z || nearInf(gc, x, y)) return;
        const last = s.pts[s.pts.length - 1], q = gScreen(gc, GL3.lift(last[0], last[1]));
        if (!q || Math.hypot(q[0] - x, q[1] - y) >= 3) s.pts.push([g.z.re, g.z.im]);
        requestRender(side, 'O' + side);
        return;
      }
      const gs = globeSnap(gc, side, g, 'cart');
      if (!gs.z) return;
      Object.assign(s, Region.defaultsFor(draft.kind, draft.z0, gs.z));
      changed(s);
      return;
    }
    if (d.mode === 'ghandle') {
      const s = d.shape;
      if (GL3.capFamily(s) && (d.key === 'C' || d.key === 'rim')) {
        if (d.key === 'C') {
          // the centre moved with h kept; a rim that comes within 8 px of arc of N goes through N (the ∞ snap of
          // panels.md 9.3, as for a drawn rim and a slide: it bounds r)
          const gs = globeSnap(gc, side, g, 'centre', s);
          let snapInf = false;
          GL3.setGlobeHandle(s, 'C', gs.P, { infSnap: (Cn, h) => { const Cs = infSnapC(gc, Cn, h); snapInf = !!Cs; return Cs; } });
          if (snapInf) gSnapMark = { side, P: [0, 0, 1] };
        } else {
          const gs = globeSnap(gc, side, g, 'rim', s);
          const cap = GL3.capOf(s);
          if (!cap) return;
          const lim = Math.cos(GL3.CAP_MIN);
          let h = Math.max(-lim, Math.min(lim, GL3.dot3(gs.P, cap.C)));
          const hs = infSnapH(gc, cap.C, h);
          if (hs !== h) { h = hs; gSnapMark = { side, P: [0, 0, 1] }; }
          GL3.setGlobeHandle(s, 'rim', gs.P, { h });
          rimPhi.set(s.id, GL3.rimAngle(cap.C, gs.P));
        }
      } else {
        // ([v16.5 rail SPEC 1.2 (b)] a selected point on a curve dragged by its handle: the same slide and pull as by its
        // body; once pulled off it drags as a free point's handle)
        if (s.kind === 'point' && s.def && s.def.op === 'glider' && Construct.globeSlide) {
          if (Construct.globeSlide(d, side, g, x, y, gc)) { d.moved = true; changed(s); return; }
        }
        const vertex = s.kind === 'point' || /^v\d/.test(d.key);
        setGInf(pane, side, vertex && nearInf(gc, x, y));
        if (gInf[side]) return;
        const gs = globeSnap(gc, side, g, s.kind === 'point' ? 'round' : 'cart', s);
        if (!gs.z) return;
        if (s.kind === 'point' && d.key === 'p' && numberPointGlobe(d, gs.z)) return;
        Region.setHandle(s, d.key, gs.z);
      }
      d.moved = true;
      changed(s);
      return;
    }
    if (d.mode === 'gmove') {
      const s = d.shape;
      if (!d.moved && Math.hypot(x - d.x, y - d.y) < 3) return;
      // ([v16.5 rail SPEC 1.2 (b)] a point on a curve slides on its rail on the globe too; a pull frees it, and the drag
      // goes on as a free point's from where it came off)
      if (s.kind === 'point' && s.def && s.def.op === 'glider' && Construct.globeSlide) {
        const r = Construct.globeSlide(d, side, g, x, y, gc);
        if (r === 'freed') { d.s0 = JSON.parse(JSON.stringify(s)); d.P0 = g.P; }
        if (r) { d.moved = true; changed(s); return; }
      }
      if (s.kind === 'point' || GL3.capFamily(s)) {
        // the rotation about P0 x P1 that takes the press point to the pointer, applied to the shape as pressed (the
        // kind follows the geometry: a disc slid over ∞ becomes the complement of a disc, a line slid off ∞ a circle)
        setGInf(pane, side, s.kind === 'point' && nearInf(gc, x, y));
        if (gInf[side]) return;
        const t = JSON.parse(JSON.stringify(d.s0));
        if (!GL3.rotateShape(t, GL3.rotationTo(d.P0, g.P))) return;
        if (s.kind === 'point' && numberPointGlobe(d, C(t.p[0], t.p[1]))) return;
        const cap = GL3.capFamily(t) ? GL3.capOf(t) : null;
        const Cs = cap ? infSnapC(gc, cap.C, cap.h) : null;
        if (Cs) { GL3.applyCap(t, Cs, Cs[2]); gSnapMark = { side, P: [0, 0, 1] }; }
        setGeom(s, t);
      } else {
        // planar kinds translate in the plane by the difference of the planar picks
        if (!g.z) return;
        if (!d.zl) d.zl = d.z0 || g.z;
        Region.translate(s, CX.sub(g.z, d.zl));
        d.zl = g.z;
      }
      d.moved = true;
      changed(s);
    }
  }
  // a point bound to a free number moved on a globe: the number takes the place (the point follows through the number's
  // change), as numberPointDrag does on the plane; nothing attaches on the drop. True when the number took the move.
  function numberPointGlobe(d, z) {
    const s = d.shape, bn = !d.target && boundNumber(s, 'p'), pr = bn && Params.list().find((q) => q.name === bn);
    if (!pr || pr.expr) return false;
    d.boundNum = bn; d.moved = true;
    Params.set(bn, { re: z.re, im: z.im }, { live: true });
    return true;
  }
  // the end of a globe gesture: a draft becomes a shape (or a target) when it has a size on screen; an edit is one undo step
  function globeUp(pane, side, d) {
    if ((d.mode === 'gmove' || d.mode === 'ghandle') && d.cmGlobe && Construct.moveUp) Construct.moveUp(d);   // ([v16.5 rail] a slide's last frame)
    gSnapMark = null; gInf[side] = false;
    setReadouts(null);
    if (d.mode === 'gdraw' && draft) {
      const s = draft.shape, kind = draft.kind, gc = globeCam(side);
      const cap = draft.cap ? GL3.capOf(s) : null;
      let ok = true;
      if (cap) ok = Math.acos(Math.max(-1, Math.min(1, cap.h))) * (gc ? gc.R : 150) > 4;
      else if (kind === 'curve' || kind === 'lasso') {
        ok = s.pts.length >= (kind === 'lasso' ? 3 : 2);
        if (s.pts.length > 400) { const step = s.pts.length / 400; s.pts = Array.from({ length: 400 }, (_, i) => s.pts[Math.floor(i * step)]); }
      } else {
        const qs = gc ? Region.handlesOf(s).map(([, z]) => gScreen(gc, GL3.lift(z.re, z.im))).filter(Boolean) : [];
        ok = qs.length > 1 && Math.max(...qs.map((q) => Math.hypot(q[0] - qs[0][0], q[1] - qs[0][1]))) > 4;
      }
      if (!ok && !d.second && TWO_CLICK.has(kind)) { holdPending(); return; }
      draft = null;
      if (ok) { addShape(s, !!d.target); justDrawn = s.id; } else { rimPhi.delete(s.id); requestRender(side, 'OL', 'OR'); }
      return;
    }
    if ((d.mode === 'ghandle' || d.mode === 'gmove') && d.moved) {
      if (d.boundNum) Params.rest(d.boundNum);
      if (d.target) targetsChanged(true);
      else { if (rightAuto && autoFit()) fitRight(true); scheduleFix(); shapesChanged(true); }
      commit();
    }
    requestRender(side, 'O' + side);
  }
  // the overlay of an editable globe: the selected shape's handles (lifted, facing hemisphere only, today's style),
  // a polygon draft's vertices, and the snap ring
  function drawGlobeEdit(side) {
    const gc = globeCam(side);
    if (!gc) return;
    const ctx = gc.pane.octx, list = side === 'R' ? S.targets : S.shapes;
    // the selected shape, and a shape being drawn here (panels.md 9.4: the draft with its handles, so a cap shows the
    // spherical centre it is built around)
    const sel = list.find((x) => x.id === selected);
    const dr = draft && draft.globe === side && draft.shape && draft.kind !== 'curve' && draft.kind !== 'lasso' ? draft.shape : null;
    ctx.save();
    for (const s of [sel, dr]) {
      if (!s) continue;
      const k = shapeInk(s).edge;
      for (const [key, P] of globeHandles(s, gc)) {
        const q = gScreen(gc, P);
        if (!q) continue;
        ctx.fillStyle = TH.surface; ctx.strokeStyle = k; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (key === 'c' || key === 'C' || key === 'm') ctx.arc(q[0], q[1], 3.5, 0, TAU); else ctx.rect(q[0] - 3.5, q[1] - 3.5, 7, 7);
        ctx.fill(); ctx.stroke();
      }
    }
    if (draft && draft.globe === side && draft.kind === 'polygon') {
      ctx.fillStyle = draft.target ? shapeInk({ ci: TARGET_CI[S.targets.length % TARGET_CI.length] }).edge : TH.c[S.shapes.length % 8].edge;
      for (const p of draft.pts) { const q = gScreen(gc, GL3.lift(p[0], p[1])); if (q) ctx.fillRect(q[0] - 3, q[1] - 3, 6, 6); }
    }
    if (gSnapMark && gSnapMark.side === side) {
      const q = gScreen(gc, gSnapMark.P);
      if (q) {
        ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = TH.accent; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // a draft on a globe as GLR.drawPreimage draws it through the identity map (exact per pixel): an area at the draft
  // alpha with its rim, a curve in the shape's edge colour, an open polygon as its polyline to the pointer
  function globeDraftPass(side) {
    if (!draft || draft.globe !== side) return null;
    let s = draft.shape;
    if (draft.kind === 'polygon') {
      const pts = draft.pts.slice();
      if (draft.hover) pts.push([draft.hover.re, draft.hover.im]);
      if (pts.length < 2) return null;
      s = { kind: 'curve', pts, ci: draft.target ? TARGET_CI[S.targets.length % TARGET_CI.length] : S.shapes.length % 8 };
    }
    if (!s || kindType(s) === 'point') return null;
    const ink = shapeInk(s), area = kindType(s) === 'area';
    const t = Object.assign({}, s, { color: GLR.hexRGB(area ? ink.c0 : ink.edge), edge: GLR.hexRGB(ink.edge), alpha: area ? 0.35 : 1, width: 1.5 * (side === 'L' ? paneL : paneR).dpr });
    return { map: IDENT, targets: [t], halo: GLR.hexRGB(TH.halo) };
  }
  // ([v16.5 check app-7] while a point of X is dragged, the readout reads the point, not the place it was pressed at; in
  // the frame, after a point on a curve has been put where the drag leaves it)
  let dragProbeRaf = 0;
  function dragProbe() {
    if (dragProbeRaf) return;
    dragProbeRaf = requestAnimationFrame(() => {
      dragProbeRaf = 0;
      const d = drag, s = d && d.shape;
      if (!d || d.mode !== 'move' || d.target || !d.moved || !s || s.kind !== 'point' || !Array.isArray(s.p)) return;
      probe = { re: s.p[0], im: s.p[1] };
      setReadouts(probe);
    });
  }
  function onMove(pane, side, e) {
    const [x, y] = evXY(pane, e);
    if (drag && drag.mode !== 'probe') { // a touch probe (long press) moves like a hover
      if (drag.x != null && !drag.far && Math.hypot(x - drag.x, y - drag.y) > 4) drag.far = true;   // (a pan, not a click)
      if (drag.mode === 'gdraw' || drag.mode === 'ghandle' || drag.mode === 'gmove') { globeMove(pane, drag.side, e, x, y); return; }
      if (drag.mode === 'orbit') {
        const c = drag.cam || cam3();
        const dyaw = -(x - drag.lx) * 0.35 * DEG, dpitch = (y - drag.ly) * 0.35 * DEG;
        c.yaw += dyaw;
        c.pitch = Math.max(pitchMin(c), Math.min(88 * DEG, c.pitch + dpitch));
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { c.vyaw = dyaw * 0.6; c.vpitch = dpitch * 0.6; }
        drag.lx = x; drag.ly = y;
        requestRender(drag.side === 'L' ? 'L' : 'R');
        return;
      }
      if (drag.mode === 'pan3') {
        const c = drag.cam || cam3();
        const k = c.dist / pane.h * 1.2;
        const dx = (x - drag.x) * k, dy = (y - drag.y) * k;
        c.tx = drag.tx + dx * Math.sin(c.yaw) + dy * Math.cos(c.yaw);
        c.ty = drag.ty - dx * Math.cos(c.yaw) + dy * Math.sin(c.yaw);
        requestRender(drag.side === 'L' ? 'L' : 'R');
        return;
      }
      // a construction tool's last pick on a touch screen: the finger slides to adjust it, the dashed preview follows, and
      // lifting makes the pick (the view stays put)
      if ((drag.mode === 'panR' || drag.mode === 'panL') && ptrTouch && Construct.isTool(tool) && Construct.finalPick(side)) { drag.cdrag = true; Construct.hover(pane, side, x, y, e); return; }
      if (drag.mode === 'panR') {
        V.right.cx = drag.cx - (x - drag.x) / V.right.s;
        V.right.cy = drag.cy + (y - drag.y) / V.right.s;
        rightAuto = false;
        requestRender('R');
        return;
      }
      if (drag.mode === 'panL') {
        const v = leftView();
        v.cx = drag.cx - (x - drag.x) / v.s;
        v.cy = drag.cy + (y - drag.y) / v.s;
        if (leftStage() > 0) leftAuto = false;
        sourceViewChanged();
        requestRender('L');
        return;
      }
      // a target (Preimage) lives in the right plane
      pane.setView(drag.target ? V.right : leftView());
      const z = pane.s2w(x, y);
      if (drag.mode === 'cut') {
        setCut(drag.step, Math.atan2(z.im - drag.p.im, z.re - drag.p.re) / DEG, S.snap);
        return;
      }
      // a zero or a pole follows the pointer (snapped like the shape handles); off the plane it waits at the edge, and
      // a release there removes it
      if (drag.mode === 'zp') {
        drag.x = x; drag.y = y;
        if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) < 3) return;
        drag.moved = true;
        const off = x < -4 || y < -4 || x > pane.w + 4 || y > pane.h + 4;
        if (off !== drag.off) { drag.off = off; requestRender('OL'); }
        if (!off) zpSet(drag.k, drag.kind, drag.i, zpRound(pane, snapZ(pane, z)));
        else requestRender('OL');
        return;
      }
      // a point bound to a free number, pressed selected (a handle) or not (its body): the number moves
      if ((drag.mode === 'handle' || drag.mode === 'move') && !drag.target && numberPointDrag(drag, pane, z)) return;
      if (drag.mode === 'handle') {
        const cmZ = Construct.handleMove(drag, drag.target ? 'R' : 'L', x, y);   // (v16: onto a point, binds at the release)
        pane.setView(drag.target ? V.right : leftView());
        Region.setHandle(drag.shape, drag.key, cmZ || snapZ(pane, z));
        drag.moved = true;
        if (drag.target) targetsChanged(false); else shapesChanged(false);
        return;
      }
      if (drag.mode === 'move') {   // (v16 [C18]: built shapes)
        const r = Construct.moveDrag(drag, pane, drag.target ? 'R' : 'L', x, y);
        if (r === 'pan') { const v = drag.target ? V.right : leftView(); Object.assign(drag, { mode: drag.target ? 'panR' : 'panL', x, y, cx: v.cx, cy: v.cy, pane }); setCursor(pane, side); return; }
        if (r) { dragProbe(); return; }
      }
      if (drag.mode === 'move') {
        const dz = CX.sub(z, drag.z0);
        if (!drag.moved && Math.hypot(dz.re, dz.im) * pane.view.s < 3) return;
        Region.translate(drag.shape, dz);
        drag.z0 = z; drag.moved = true;
        if (drag.target) targetsChanged(false); else shapesChanged(false);
        dragProbe();
        return;
      }
      if (drag.mode === 'draw' && draft) {
        const zz = Construct.drawMove(pane, drag.target ? 'R' : 'L', draft.kind, x, y) || (pane.setView(drag.target ? V.right : leftView()), snapZ(pane, z));
        const s = draft.shape;
        if (draft.kind === 'curve' || draft.kind === 'lasso') {
          if (draft.kind === 'lasso' && !drag.target) sndMove(x, y, z, 'loop');
          const last = s.pts[s.pts.length - 1];
          const [lx, ly] = pane.w2sxy(last[0], last[1]);
          if (Math.hypot(lx - x, ly - y) >= 3) s.pts.push([z.re, z.im]);
        } else {
          Object.assign(s, Region.defaultsFor(draft.kind, draft.z0, zz));
          if (draft.kind === 'sector') {
            const ang = Math.atan2(zz.im - draft.z0.im, zz.re - draft.z0.re) / DEG;
            s.t1 = Math.round(ang - 30); s.t2 = Math.round(ang + 30);
          }
        }
        requestRender(drag.target ? 'OR' : 'OL');
        return;
      }
    }
    // hover
    if (side === 'L' && lLand()) {
      // the landscape probes the point of X under the pointer on the relief (or its floor): the needle, the readout
      // and the image in Y follow it
      const z = pickLand(x, y);
      sndMove(x, y, z, 'pointer');
      if (!z && !probe) return;
      probe = z;
      setReadouts(probe);
      requestRender('L', 'OR', rGlobe() ? 'R' : null);
      return;
    }
    // the Point and Polygon tools over the 10 px around ∞ of an editable globe: not-allowed (panels.md 9.7)
    if ((side === 'L' ? lGlobe() : rGlobe()) && (gInf[side] || ((tool === 'point' || tool === 'polygon') && globeEdit(side)))) {
      const gc = globeCam(side);
      setGInf(pane, side, !!gc && (tool === 'point' || tool === 'polygon') && globeEdit(side) && nearInf(gc, x, y));
    }
    // [UX47] a two-click shape waiting for its second point follows the pointer (snapped as a drag's end is)
    if (draft && draft.pending && !drag) pendingHover(pane, side, e, x, y);
    // a polygon draft on a globe follows the pointer (snapped as its vertices are)
    if (draft && draft.kind === 'polygon' && draft.globe === side && is3DSide(side)) {
      const gc = globeCam(side), g = pickGlobe(pane, camOf(side), x, y);
      altHeld = !!e.altKey; gSnapMark = null;
      const gs = g && gc ? globeSnap(gc, side, g, 'cart') : null;
      draft.hover = gs && gs.z ? gs.z : null;
      requestRender(side, 'O' + side);
    }
    if (side === 'L' && lGlobe()) {
      // the z-globe probes the point of the plane under the pointer (none off the globe)
      const z = typeof pickSphereLeft === 'function' ? pickSphereLeft(x, y) : null;
      sndMove(x, y, z, 'pointer');
      if (!z && !probe) return;
      probe = z;
      setReadouts(probe);
      requestRender('L', 'OR', rGlobe() ? 'R' : null);
      return;
    }
    if (side === 'L') {
      const hc = (cutHandlesL.find((hd) => Math.hypot(hd.x - x, hd.y - y) < 12) || {}).step || 0;
      if (hc !== hoverCut) { hoverCut = hc; setCursor(pane, side); }
      const zh = zpHit(x, y);
      if (!zpSame(zpHover, zh && zh.k, zh && zh.kind, zh && zh.i)) { zpHover = zh ? { k: zh.k, kind: zh.kind, i: zh.i } : null; setCursor(pane, side); }
      if (draft && draft.kind === 'polygon' && !draft.target) { pane.setView(leftView()); draft.hover = snapZ(pane, pane.s2w(x, y)); }
    }
    if (side === 'R' && draft && draft.kind === 'polygon' && draft.target) { pane.setView(V.right); draft.hover = snapZ(pane, pane.s2w(x, y)); }
    Construct.hover(pane, side, x, y, e);   // (v16: the snap ring before the press)
    if (side === 'L') {
      pane.setView(leftView());
      probe = pane.s2w(x, y);
      setReadouts(probe);
      sndMove(x, y, probe, 'pointer');
      // the w-globe's probe ring and projection ray are drawn by GL with the globe
      requestRender('OL', 'OR', rGlobe() ? 'R' : null);
    } else {
      // a point w of the image plane (or of the w-globe): its preimages show in X
      let w;
      if (rImage()) { pane.setView(V.right); w = pane.s2w(x, y); } else w = pickSphere(pane, camS, x, y);
      if (probe) { probe = null; setReadouts(null); }
      rHover = w;
      const ro = $('rightReadout');
      const vout = S.focus === 0 ? '<i>w</i>' : `<i>w</i>${sub(S.focus)}`;
      if (w && ro && !ro.classList.contains('copied')) ro.innerHTML = rk(vout, fmtCxHtml(w)) + rk(`|${vout}|`, fmtR(CX.abs(w)));
      if (!w && ro && !ro.classList.contains('copied')) ro.innerHTML = idleRight();
      copyValue.R = w ? CX.fmt(w, 6).replace(/\s/g, '') : '';
      // (not while the plane shows a deformation: its points are no values of F)
      setHoverW(w && !morphOn() && !trans.k ? w : null);
      if (solo() === 'R' && morphOn()) sndMove(x, y, w, 'merged');
      if (w && tourL.probe) tourEmit('probe', { pane: 'R', w: [w.re, w.im] });
      requestRender('OL', 'OR');
    }
  }
  // number formatting for readouts: 4 decimals in [1e-3, 1e4), otherwise a ×10ⁿ form; real minus signs
  // (dp: decimals, 4 by default; a narrow readout uses fewer)
  function fmtR(x, dp = 4) {
    if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : 'NaN';
    const ax = Math.abs(x);
    let t;
    if (ax === 0 || (ax >= 1e-3 && ax < 1e4)) t = x.toFixed(dp);
    else { const [m, e] = x.toExponential(2).split('e'); t = `${m}×10${String(+e).split('').map((d) => (d === '-' ? '⁻' : SUP[+d])).join('')}`; }
    // display only (copied values use CX.fmt): the decimal comma in Russian (GLOSSARY 2.3)
    return I18N.num(t.replace('-', '−'));
  }
  // fixed-width readout; a component that is rounding noise next to the other (9×10⁻¹⁷ + 1.5i) reads 0
  // (atol: below it a component is 0 too; the left readout passes a billionth of X's pixel, so a probe that lands a
  // rounding error off an axis reads 0.0000, not 7.11×10⁻¹⁵, review regress-5)
  function fmtCxHtml(w, dp = 4, atol = 0) {
    if (!CX.isFin(w)) return '∞';
    const tol = Math.max(atol, 1e-12 * Math.max(Math.abs(w.re), Math.abs(w.im)));
    const re = Math.abs(w.re) < tol ? 0 : w.re, im = Math.abs(w.im) < tol ? 0 : w.im;
    return `${fmtR(re, dp)} ${im < 0 ? '−' : '+'} ${fmtR(Math.abs(im), dp)}<i>i</i>`;
  }
  const rk = (k, v) => `<span class="rp">${k ? `<span class="rk">${k}</span> ` : ''}<span class="rv">${v}</span></span>`;
  let rHover = null; // a point hovered in the right (image) plane
  const copyValue = { L: '', R: '' };
  function setReadouts(z) {
    const lr = $('leftReadout'), ro = $('rightReadout');
    if (!lr || !ro) return;
    const lk = leftStage();
    const vin = lk === 0 ? '<i>z</i>' : `<i>w</i>${sub(lk)}`;
    if (!z) {
      if (!lr.classList.contains('copied') && !hov.w) lr.innerHTML = idleLeft();
      if (!ro.classList.contains('copied')) ro.innerHTML = idleRight();
      legendNeedle = null; legendMod = null; requestRender('G');
      return;
    }
    const degs = (a, dp) => fmtR(a / DEG, dp).replace(/0+$/, '').replace(/[.,]$/, '') + '°';
    const zTol = 1e-9 / Math.max(1e-300, (leftView() && leftView().s) || 1);
    // (|z| and arg read the same rounded point as z itself: 0, not 7.11×10⁻¹⁵ and 90°, when z reads 0.0000 + 0.0000i)
    const zt = Math.max(zTol, 1e-12 * Math.max(Math.abs(z.re), Math.abs(z.im)));
    const zr = { re: Math.abs(z.re) < zt ? 0 : z.re, im: Math.abs(z.im) < zt ? 0 : z.im };
    copyValue.L = CX.fmt(z, 6).replace(/\s/g, '');
    // X Phase: the painted function (F, or its homotopy at t while the deformation transport is open) as modulus and
    // angle, with a swatch of its colour; the legend's needle and modulus tick follow it
    let wOnce;   // ([v16.5 fix regress-6] F(z) of the probe, evaluated once per move for both readouts)
    if (lPhase()) {
      const hv = homView();
      const wl = (hv ? hv.F : focusF())(z);
      const ok = CX.isFin(wl);
      const sw = ok ? `<span class="sw" style="background:${phaseCss(wl)}"></span> ` : '';
      // panels.md 2: z, |z|, arg, then F as modulus and angle with its swatch (first, so it is never cut); where the
      // chip is too narrow for that (a pane under about 560px), z and F with fewer digits
      const fv = (dp) => rk(fnHtml(), ok ? `${sw}${fmtR(CX.abs(wl), dp)} ∠ ${degs(Math.atan2(wl.im, wl.re), dp)}` : '∞');
      const forms = [
        () => rk(vin, fmtCxHtml(z, 4, zTol)) + rk(`|${vin}|`, fmtR(CX.abs(zr))) + rk('arg', degs(Math.atan2(zr.im, zr.re))) + fv(4),
        () => rk(vin, fmtCxHtml(z, 4, zTol)) + fv(4),
        () => rk(vin, fmtCxHtml(z, 3, zTol)) + fv(2),
      ];
      for (let i = 0; i < forms.length; i++) {
        lr.innerHTML = forms[i]();
        if (i === forms.length - 1 || lr.scrollWidth <= lr.clientWidth + 1) break;
      }
      legendNeedle = ok ? Math.atan2(wl.im, wl.re) : null; legendMod = CX.abs(wl); requestRender('G'); // needle on the next frame
    } else {
      // [v16.5 UX10] one readout: "z = …" (with |z| and arg when they fit) and, on a second line, "w = F(z) = …", so F(z)
      // is read beside z (the phone, where Y is an inset; X expanded, where Y is hidden)
      // (the key's "=" and parentheses in the maths face, as its letters: B612 Mono's "(" reads as "[" [UX105])
      const wz = wOnce = focusF()(z), wv = S.focus === 0 ? '<i>w</i>' : `<i>w</i>${sub(S.focus)}`, m = (t) => `<span class="rm">${t}</span>`;
      const wl = (dp) => `<span class="rln">${rk(`${wv} ${m('=')} ${fnHtml()}${m('(')}${vin}${m(')')} ${m('=')}`, CX.isFin(wz) ? fmtCxHtml(wz, dp) : '∞')}</span>`;
      const forms = [
        () => `<span class="rln">${rk(`${vin} ${m('=')}`, fmtCxHtml(z, 4, zTol)) + rk(`|${vin}|`, fmtR(CX.abs(zr))) + rk('arg', degs(Math.atan2(zr.im, zr.re)))}</span>` + wl(4),
        () => `<span class="rln">${rk(`${vin} ${m('=')}`, fmtCxHtml(z, 4, zTol)) + rk(`|${vin}|`, fmtR(CX.abs(zr), 3)) + rk('arg', degs(Math.atan2(zr.im, zr.re), 2))}</span>` + wl(4),
        () => `<span class="rln">${rk(`${vin} ${m('=')}`, fmtCxHtml(z, 4, zTol))}</span>` + wl(4),
        () => `<span class="rln">${rk(`${vin} ${m('=')}`, fmtCxHtml(z, 3, zTol))}</span>` + wl(3),
      ];
      // (a line fits when its text, measured to the fraction of a pixel, does: scrollWidth rounds, and a line 0.4 px too
      // long was cut with an ellipsis at 1366 px)
      const fits = (c) => { const rg = document.createRange(); rg.selectNodeContents(c); return rg.getBoundingClientRect().width <= c.getBoundingClientRect().width + 0.01; };
      for (let i = 0; i < forms.length; i++) {
        lr.innerHTML = forms[i]();
        if (i === forms.length - 1 || [...lr.children].every(fits)) break;
      }
      // (a finger found the hold-and-slide: the scale chip stops teaching it)
      if (ptrTouch && !probeLearned()) { try { localStorage.setItem('cmw-probe-learned', '1'); } catch (e) { /* */ } probeLearnedV = true; }
    }
    // Y: the image of the probe (F at t = end)
    const w = wOnce !== undefined ? wOnce : focusF()(z);
    copyValue.R = CX.isFin(w) ? CX.fmt(w, 6).replace(/\s/g, '') : '';
    const vout = S.focus === 0 ? '<i>w</i>' : `<i>w</i>${sub(S.focus)}`;
    if (rImage()) {
      // F' at the current probe (never a cached value from an earlier pointer position)
      const F = focusF(), hh = 1e-6 * Math.max(1, CX.abs(z));
      const d = CX.scale(CX.sub(F(C(z.re + hh, z.im)), F(C(z.re - hh, z.im))), 1 / (2 * hh));
      const fd = CX.isFin(d) ? (CX.abs(d) < 1e-9 ? $t('critical point') : `${fmtR(CX.abs(d))} ∠ ${fmtR(Math.atan2(d.im, d.re) / DEG).replace(/0+$/, '').replace(/[.,]$/, '')}°`) : '—';
      let clamp = '';
      if (tool === 'select' && !morphOn() && CX.isFin(d) && paneL && paneR) {
        const rimg = CX.abs(d) * (10 / paneL.view.s) * V.right.s;
        const factor = rimg > 120 ? 120 / rimg : rimg < 3 && rimg > 0 ? 3 / rimg : 1;
        if (factor !== 1) clamp = rk($t('gauge'), '×' + I18N.num(CX.fmtNum(factor, 3)));
      }
      ro.innerHTML = rk(vout, fmtCxHtml(w)) + rk(`${fnHtml()}′`, fd) + clamp;
    } else {
      ro.innerHTML = rk(vout, fmtCxHtml(w)) + rk(`|${vout}|`, fmtR(CX.abs(w)));
    }
  }
  // the phase colour of w as a CSS colour (the legend wheel's, arg 0 = red at 1)
  function phaseCss(w) {
    return `rgb(${keyRGB(Math.atan2(w.im, w.re)).map((v) => Math.round(255 * v)).join(',')})`;
  }
  // idle readouts show the scale; refreshed after every render when nothing is probed (the left readout keeps the
  // preimage count while the right plane is hovered)
  function idleReadouts() {
    // (a globe gesture's chip shows the set being drawn or edited until release)
    if (probe || (drag && /^g(draw|handle|move)$/.test(drag.mode))) return;
    const lr = $('leftReadout'), ro = $('rightReadout');
    const a = idleLeft(), b = idleRight();
    if (!hov.w && !lr.classList.contains('copied') && lr.innerHTML !== a) lr.innerHTML = a;
    if (!rHover && !ro.classList.contains('copied') && ro.innerHTML !== b) ro.innerHTML = b;
  }
  function copyReadout(side) {
    const el = $(side === 'L' ? 'leftReadout' : 'rightReadout');
    const v = copyValue[side];
    if (!v) return;
    const done = () => { el.classList.add('copied'); el.innerHTML = rk('', $t('Copied')); setTimeout(() => { el.classList.remove('copied'); setReadouts(probe); }, 900); };
    try { navigator.clipboard.writeText(v).then(done, done); } catch (e) { done(); }
  }
  // [UX47] Line, Segment, Ray and Circle by two clicks (or taps) as well as by a drag: a press that does not move keeps
  // its start (draft.pending) and says so; the dashed preview follows the pointer; the next press in the same plane is
  // the end. Another tool, Esc, a right-click or a press elsewhere drops it
  const TWO_CLICK = new Set(['line', 'segment', 'ray', 'circle']);
  function holdPending() {
    draft.pending = true;
    toast(ptrTouch ? $t('Tap the second point, or drag') : $t('Click the second point, or drag'));
    requestRender('OL', 'OR', draft.globe ? draft.globe : null);
  }
  function dropPending() {
    if (!draft || !draft.pending) return;
    if (!draft.globe) Construct.drawEnd(null, !!draft.target);   // (its snapped start binds nothing)
    draft = null;
    requestRender('L', 'OL', 'OR', rGlobe() ? 'R' : null);
  }
  function pendingHover(pane, side, e, x, y) {
    if (draft.globe) {
      if (draft.globe !== side || !is3DSide(side)) return;
      drag = { mode: 'gdraw', target: !!draft.target, side, x, y };
      try { globeMove(pane, side, e, x, y); } finally { drag = null; }
      return;
    }
    if ((side === 'R') !== !!draft.target) return;
    pane.setView(draft.target ? V.right : leftView());
    const zp = Construct.drawMove(pane, side, draft.kind, x, y) || snapZ(pane, pane.s2w(x, y));
    Object.assign(draft.shape, Region.defaultsFor(draft.kind, draft.z0, zp));
    requestRender(side === 'R' ? 'OR' : 'OL');
  }
  function onUp(pane, side, e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    lastPress = { side, mode: d.mode, far: !!d.far, pb: !!d.pb };
    tourDragEnd(d);
    if (d.gsel && d.mode === 'orbit' && !d.far) { selected = d.gsel; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL', 'OR'); }
    // a left-view change made during the press re-centres the meshing window now (gesture end)
    sourceViewChanged.flush();
    setCursor(pane, side);
    // a pan or an orbit that moved: the contextmenu that may follow its right-button release opens nothing
    if (/^(pan|orbit)/.test(d.mode)) lastPan = { t: performance.now(), moved: !!d.far };
    // (v16.4) the user's pan or orbit, once it moved: the tour's view tasks (notes/tour/INTEGRATION.md 9)
    if (/^(pan|orbit)/.test(d.mode) && d.far) tourViewMoved(d.side || side, d.mode === 'orbit' ? 'orbit' : 'pan');
    if (sndP.on && sndP.snap && S.snap && !altHeld && ((d.mode === 'draw' && draft && draft.kind !== 'curve' && draft.kind !== 'lasso') || ((d.mode === 'handle' || d.mode === 'zp') && d.moved) || (d.mode === 'move' && d.fd && d.moved))) soundCue('snap');   // ([v16.5 rail] a free point's drop too)
    if (d.mode === 'gdraw' || d.mode === 'ghandle' || d.mode === 'gmove') { globeUp(pane, d.side || side, d); return; }
    if (d.mode === 'probe') { sndLift(); sndHoverOff(); probe = null; rHover = null; setHoverW(null); setReadouts(null); requestRender('OL', 'OR', is3D() ? 'R' : null); return; }
    // Hear the function: a click on a still point (a press and release with no drag, the Select tool, an empty spot of
    // the plane; not the pan button's press) plays that point (spec 3.9); a finger's is the long press (the hold, in the pointerdown handler)
    if (e && e.pointerType !== 'touch' && e.type === 'pointerup' && (e.button | 0) === 0 && !(e.shiftKey && e.altKey) && tool === 'select' && !d.far && !d.menuAt && !d.pb && (d.mode === 'panL' || d.mode === 'panR' || (d.mode === 'orbit' && d.side === 'L'))) { const [qx, qy] = evXY(pane, e); sndQueryClick(pane, side, qx, qy); }
    if (d.mode === 'handle' && !d.boundNum) Construct.handleUp(d); if (d.mode === 'move' && Construct.moveUp) Construct.moveUp(d); if ((d.mode === 'panL' || d.mode === 'panR') && (!d.far || d.cdrag) && !d.pb && Construct.isTool(tool)) { const [ux, uy] = evXY(pane, e); Construct.click(pane, side, ux, uy); } if (d.cmPick && !d.far) { const [ux, uy] = evXY(pane, e); Construct.globeClick(d.side || side, ux, uy); }   // (v16: bind a dropped handle; a click picks)
    // a target: no meshes to refine and no refit (the right plane is where it was drawn)
    if (d.target && (d.mode === 'handle' || d.mode === 'move')) { if (d.moved) { targetsChanged(true); commit(); } return; }
    if (d.mode === 'orbit' && d.side === 'L') { requestRender('L'); return; }
    // a zero or a pole: released off the plane it is removed; one undo step per gesture (an added one included)
    if (d.mode === 'zp') {
      if (d.off) { zpRemove(d.k, d.kind, d.i); return; }
      if (d.moved) {
        if (rightAuto && autoFit()) fitRight(true);
        scheduleFix();
        commit();
      }
      requestRender('L', 'R', 'T', 'OL');
      return;
    }
    if (d.mode === 'cut' || d.mode === 'handle' || d.mode === 'move') {
      if (rightAuto && autoFit()) fitRight(true);
      scheduleFix();
      requestRender('L', 'R', 'T');
    }
    if (d.mode === 'orbit') { requestRender('R'); return; }
    if (d.mode === 'cut') { commit(); return; }
    if (d.mode === 'handle' || d.mode === 'move') { if (d.moved) { if (d.boundNum) Params.rest(d.boundNum); shapesChanged(true); commit(); } return; }
    if (d.mode === 'draw' && draft) {
      const s = draft.shape;
      const kind = draft.kind;
      let ok = true;
      if (kind === 'curve' || kind === 'lasso') {
        ok = s.pts.length >= (kind === 'lasso' ? 3 : 2);
        if (s.pts.length > 400) { const step = s.pts.length / 400; s.pts = Array.from({ length: 400 }, (_, i) => s.pts[Math.floor(i * step)]); }
      } else {
        const hs = Region.handlesOf(s).map((x) => x[1]);
        const span = Math.max(...hs.map((p) => CX.abs(CX.sub(p, hs[0]))));
        ok = span * pane.view.s > 4;
      }
      if (!ok && !d.second && TWO_CLICK.has(kind)) { holdPending(); return; }
      draft = null;
      if (kind === 'lasso' && !d.target) { if (ok) sndLoopDone(s.pts); else snd.loop = null; }
      Construct.drawEnd(ok ? s : null, !!d.target);   // (v16: the snapped ends bind)
      if (ok) { shapeVia = 'draw'; try { addShape(s, !!d.target); justDrawn = s.id; } finally { shapeVia = null; } } else requestRender('OL', 'OR');
    }
  }
  function finishPolygon() {
    if (!draft || draft.kind !== 'polygon') return;
    const pts = draft.pts, target = !!draft.target, cmAt = draft.cmAt;
    draft = null;
    if (pts.length >= 3) { const pg = newShape('polygon', { pts }, target); if (cmAt) Construct.bindVertices(pg, cmAt, target); addShape(pg, target); }
    else requestRender('OL', 'OR');
  }

