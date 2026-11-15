  // ---------------- render scheduling ----------------
  const dirty = { L: false, OL: false, OR: false, P: false, G: false }; // G: the legend chip
  let rafId = 0;
  function requestRender(...which) {
    for (const w of which.length ? which : ['L']) if (w) dirty[w] = true;
    if (!rafId) { rafId = requestAnimationFrame(frame); rafReqT = performance.now(); }
  }
  let lastInputT = 0, motionInT = 0;
  // motionInT: the last CONTINUOUS input (a wheel, a pointer moved with a button down, a range slider's input, a held
  // key); a hover or a single click is not motion (interacting(): a ready inverse program is not held back for it)
  for (const ev of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'input']) window.addEventListener(ev, (/** @type {any} */ e) => {
    const t = performance.now();
    lastInputT = t;
    if (ev === 'wheel' || (ev === 'pointermove' && e.buttons) || (ev === 'input' && e.target && e.target.type === 'range') || (ev === 'keydown' && e.repeat)) motionInT = t;
  }, { passive: true, capture: true });
  // ---------------- the start-up bar (issue #245) ----------------
  // A thin bar at the top of the page while the programs of the first frames and of the background warm-up (WARM, in
  // the init part) are still linking: counted from the GPU layer's own program lists (GLR.warmStatus), never from
  // timers. It shows only when work is still pending 300 ms after it began (GLR.warmBarStep), so a warm program cache
  // shows nothing, and it never takes input. warmDriver: set by the init part, {finished(), phase()}.
  let warmDriver = null, warmS = null, warmBarT = 0, warmLast = '';
  function warmCounts() {
    const st = GLR.warmStatus(S.homAll ? [3] : [1]);
    // (every warm-up group started and nothing compiling: a program that is still not linked never will be, e.g. one
    // the chain cannot have; the bar must not wait for it)
    const fin = !!(warmDriver && warmDriver.finished()) && !st.pending;
    if (fin) st.done = st.total;
    // (the total is unknown while the chain's programs are not listed yet and something is compiling: the sweep, not a number)
    st.unknown = !st.known && st.pending > 0;
    st.phase = !st.known ? 'first' : warmDriver ? warmDriver.phase() : 'first';
    return st;
  }
  function warmUpdate() {
    warmBarT = 0;
    const el = $('warmBar');
    if (!el || !GLR.ok || !GLR.warmStatus) return;
    const st = warmCounts();
    warmS = GLR.warmBarStep(warmS, st, performance.now());
    const pct = Math.round(warmS.frac * 100);
    const sig = `${warmS.visible}|${warmS.indet}|${pct}|${st.done}|${st.total}|${I18N.lang}`;
    if (sig !== warmLast) {
      warmLast = sig;
      el.hidden = !warmS.visible;
      el.classList.toggle('indet', warmS.indet);
      el.style.setProperty('--warm', warmS.frac.toFixed(3));
      el.setAttribute('aria-label', $t('Preparing the page'));
      if (warmS.indet) { el.removeAttribute('aria-valuenow'); el.removeAttribute('aria-valuetext'); }
      else { el.setAttribute('aria-valuenow', String(pct)); el.setAttribute('aria-valuetext', $t('Preparing {done} of {total} shaders, first time only', { done: st.done, total: st.total })); }
    }
    // (it ticks while there is work or the bar is up; a frame that waits for a program, or a program that lands, starts it again)
    if (warmS.visible || st.total > st.done || st.unknown) warmBarT = setTimeout(warmUpdate, 150);
  }
  function warmKick() { if (!warmBarT) warmBarT = setTimeout(warmUpdate, 0); }
  // TEMP-DEBUG-HOOK (removed before publishing)
  // test hook: the counts, the phase, whether the bar shows and how far it is
  /** @type {any} */ (window).__cmwWarm = () => {
    if (!GLR.ok || !GLR.warmStatus) return { done: 0, total: 0, pending: 0, visible: false, phase: 'none', frac: 0 };
    const st = warmCounts();
    return { done: st.done, total: st.total, pending: st.pending, visible: !!(warmS && warmS.visible), phase: st.phase, frac: warmS ? warmS.frac : 0, indet: !!(warmS && warmS.indet), groups: st.groups };
  };
  // TEMP-DEBUG-HOOK
  // cameras: 28° telephoto. dist is the fit distance for the bounding sphere at the pane's aspect; render3D and
  // the globes refit it every frame (refitCam), so zoom limits (0.4–4 × dist) and resets stay relative to the fit.
  const CAM3 = { yaw: -38 * DEG, pitch: 30 * DEG, dist: 1.77 / Math.sin(14 * DEG) * 1.05, tx: 0, ty: 0, tz: -0.04, fov: 28 * DEG };
  const cam = Object.assign({ vyaw: 0, vpitch: 0 }, CAM3);
  const camTweens = [];
  // a new fit distance (pane resized, box aspect or height scale changed) rescales the user's zoom with it
  // v16.5 UX106: the Landscape camera's fitted distance. The block's bounding sphere fits the pane's narrower side; on a
  // portrait phone that left the surface a small picture in the middle (about 230 × 330 px of a 412 × 680 plane). There
  // the block's own corners, as the default camera sees them, are fitted to the width and to the height, never farther
  // than the sphere's fit. Every other pane keeps the sphere's fit, and every picture it drew.
  function landFitDist(geo, pane) {
    const sph = GLR.fitDist(geo.radius, CAM3.fov, pane.w, pane.h, 1.05);
    if (!(Phone.isOn && Phone.isOn()) || !(pane.w > 0 && pane.h > pane.w * 1.05)) return sph;
    const y = CAM3.yaw, p = CAM3.pitch;
    const u = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p)];   // from the target to the eye
    const rl = Math.hypot(u[0], u[1]) || 1, r = [-u[1] / rl, u[0] / rl, 0];        // the screen's right (f × z, f = -u)
    const up = [-r[1] * u[2], r[0] * u[2], r[1] * u[0] - r[0] * u[1]];               // the screen's up (r × f)
    const tv = Math.tan(CAM3.fov / 2), th = tv * pane.w / pane.h, m = 1.02;          // (the plate holds the labels)
    let d = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const z of [geo.floorZ, geo.H]) {
      const q = [sx * geo.ext[0], sy * geo.ext[1], z - geo.center[2]];
      const dot = (a) => a[0] * q[0] + a[1] * q[1] + a[2] * q[2];
      d = Math.max(d, dot(u) + Math.abs(dot(r)) * m / th, dot(u) + Math.abs(dot(up)) * m / tv);
    }
    return d > 0 && isFinite(d) ? Math.min(sph, d) : sph;
  }
  function refitCam(c, base, fit) {
    if (!(fit > 0 && fit < 1e6) || Math.abs(fit - base.dist) <= 1e-9 * fit) return;   // (a collapsed pane gives no fit)
    const k = fit / base.dist;
    c.dist *= k;
    for (const tw of camTweens) if (tw.c === c) { tw.from.dist *= k; tw.to.dist *= k; }
    base.dist = fit;
  }
  function tweenCam(c, target) {
    for (let i = camTweens.length - 1; i >= 0; i--) if (camTweens[i].c === c) camTweens.splice(i, 1);
    const to = Object.assign({}, { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx, ty: c.ty }, target);
    c.vyaw = c.vpitch = 0;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(c, to); requestRender('L'); return; }
    // take the short way round in yaw
    let dy = (to.yaw - c.yaw) % TAU; if (dy > Math.PI) dy -= TAU; if (dy < -Math.PI) dy += TAU;
    camTweens.push({ c, from: { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx, ty: c.ty }, to: Object.assign(to, { yaw: c.yaw + dy }), t0: performance.now(), ms: 400 });
    requestRender('L');
  }
  function frame(ts) {
    rafId = 0;
    let again = false;
    liveMsUsed = 0;
    const frameT0 = performance.now();
    frameStartT = frameT0;
    // (the time from the request to this callback: the rAF timestamp is the frame's begin time, which can precede the
    // request)
    frameLag = Math.max(0, performance.now() - rafReqT);
    prepMs = 0;
    // camera tweens and inertia in 3D views
    for (let i = camTweens.length - 1; i >= 0; i--) {
      const tw = camTweens[i];
      const u = Math.min(1, (performance.now() - tw.t0) / tw.ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      for (const k of ['yaw', 'pitch', 'dist', 'tx', 'ty']) tw.c[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (u >= 1) camTweens.splice(i, 1);
      dirty.L = true;
      again = true;
    }
    // (the landscape and the z-globe orbit)
    const cc = lLand() ? cam : lGlobe() ? leftCam() : null;
    if (cc && !drag && (Math.abs(cc.vyaw) > 1e-4 || Math.abs(cc.vpitch) > 1e-4)) {
      cc.yaw += cc.vyaw;
      cc.pitch = Math.max(pitchMin(cc), Math.min(88 * DEG, cc.pitch + cc.vpitch));
      cc.vyaw *= 0.9; cc.vpitch *= 0.9;
      // (the turn has died away: one rest frame once nothing else moves, camSpin)
      if (!(Math.abs(cc.vyaw) > 1e-4 || Math.abs(cc.vpitch) > 1e-4)) { cc.vyaw = cc.vpitch = 0; setTimeout(() => { if (!interacting()) requestRender('L'); }, 170); }
      dirty.L = true;
      again = true;
    }
    if (tweens.length) { stepTweens(ts); again = true; }
    if (svFrame(ts)) again = true;
    // overlays and marker rulers once per frame, after the plane was redrawn
    const ov = dirty.L || dirty.OL || dirty.OR;
    const leg = dirty.G; // the legend repaints only when its key or the needle changed
    dirty.G = false;
    if (dirty.L) { dirty.L = false; try { renderLeft(); } catch (e) { console.error(e); } }
    dirty.OL = dirty.OR = false;
    invPaneQ.L = null; invPaneQ.drew.L = false;
    if (ov) try { renderOverlays(); } catch (e) { console.error(e); }
    sndFrame();   // (sound: a re-pick under a still pointer waits for a frame drawn at the new layout)
    if (leg) try { drawLegend(); } catch (e) { console.error(e); }
    idleReadouts();
    if (dirty.P) { dirty.P = false; renderProps(); }
    // a shape drag whose frames run over the 60 fps budget twice takes the drag-time mesh cap (baseRes)
    if (drag && (drag.mode === 'handle' || drag.mode === 'move') && !drag.capMesh && performance.now() - frameT0 + frameLag > FRAME_BUDGET_MS + 2) {
      if ((drag.slow = (drag.slow || 0) + 1) >= 2) { drag.capMesh = true; dirty.L = true; again = true; }
    }
    // (a requestRender during this frame may already have asked for the next one: never two frame chains at once)
    if (again && !rafId) { rafId = requestAnimationFrame(frame); rafReqT = performance.now(); }
  }
  // smooth view transitions
  const tweens = [];
  function tweenView(view, target, ms = 260, onDone) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].view === view) tweens.splice(i, 1);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(view, target); if (onDone) onDone(); requestRender('L'); return; }
    tweens.push({ view, from: { cx: view.cx, cy: view.cy, s: view.s }, to: target, t0: performance.now(), ms, onDone });
    requestRender();
  }
  // a view switch lands the plane tweens of X's view at once (they would move the next view's plane otherwise)
  function cancelTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.view !== S.srcView && tw.view !== V.left) continue;
      Object.assign(tw.view, tw.to); tweens.splice(i, 1); if (tw.onDone) tw.onDone();
    }
  }
  function stepTweens(ts) {
    const now = performance.now();
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const u = Math.min(1, (now - tw.t0) / tw.ms);
      const e = 1 - Math.pow(1 - u, 3);
      // (a zoom about the point the start and end views share, Pane.tweenAt; a plain pan when the scale stays)
      const v = Pane.tweenAt(tw.from, tw.to, e);
      tw.view.cx = v.cx; tw.view.cy = v.cy; tw.view.s = v.s;
      if (u >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
    }
    dirty.L = true;
  }
  // compute a fitted view for a pane without applying it
  function fittedView(pane, k, extraKs, F) {
    const saved = pane.view;
    const tmp = { cx: saved.cx, cy: saved.cy, s: saved.s };
    pane.setView(tmp);
    fitPane(pane, k, extraKs, F);
    pane.setView(saved);
    return tmp;
  }

  // change notifications
  let lastLeftSig = '';
  // a change that follows another within 150 ms, or comes from a drag, is part of a scrub: MathJax waits for a pause
  let lastChangeT = 0, scrubT = 0;
  function noteChange() {
    const now = performance.now();
    if (drag || now - lastChangeT < 150) { TeX.hush(); scrubT = now; }
    lastChangeT = now;
  }
  // ([#243, #241] what the last chain change cost, ms, all of it and the fit of the view in it (a series' fit samples
  // it on the CPU): a live change (a slider dragged) of a chain whose fit costs more than FIT_LIVE_MS keeps the view
  // until the drag ends, whose change at rest fits it; a field and a slider of a costly chain wait for a pause or the
  // next frame (paramField, onParamChange))
  let chainMs = 0, fitMs = 0;
  const FIT_LIVE_MS = 12;
  const chainCost = () => chainMs;
  function chainChanged(structural, o) {
    const t0 = performance.now();
    noteChange();
    rebuild();
    cmChain();   // (v16: step uids, zero ids, constructions on f1's zeros and F(z0))
    soundFunctionChanged();
    if (structural) chainRebuilt();
    const fit = !(o && o.live && fitMs > FIT_LIVE_MS), tf = performance.now();
    const ls = leftStage() + ':' + chainSig[leftStage()];
    if (fit && leftStage() > 0 && leftAuto && ls !== lastLeftSig) { paneL.setView(V.left); fitPane(paneL, leftStage()); }
    if (fit) { lastLeftSig = ls; fitMs = performance.now() - tf; }
    svChainChanged();
    scheduleFix();
    updateLeds();
    refreshIntPop();
    if (Params.syncUnused) Params.syncUnused();   // ([v16.5 fix user-1] "Not used yet" follows the chain)
    requestRender('L', 'P');
    chainMs = performance.now() - t0;
  }
  function shapesChangedAll(structural) { shapesChanged(structural); }
  function shapesChanged(structural) {
    if (cmShapes()) structural = true;   // (v16 constructions)
    if (numberPoints()) structural = true;
    noteChange();
    if (structural) {
      updateFocusUI();
      buildShapeList();
    } else updateShapeList();
    scheduleFix();
    refreshIntPop();
    requestRender('L');
  }
  // the view of pane that fits box b (a default box when b is empty), without applying it
  function boxView(pane, b) {
    const saved = pane.view, tmp = { cx: saved.cx, cy: saved.cy, s: saved.s };
    pane.setView(tmp);
    if (!pane.fitBox(b, 0.07)) pane.fitBox({ x0: -2, x1: 2, y0: -2, y1: 2 });
    pane.setView(saved);
    return tmp;
  }
  function setFocus(k, quiet) {
    phHold();
    setFocusStep(k);
    if (k > 0) setSel(k);   // (v15: showing a step alone selects it)
    leftAuto = true;
    if (leftStage() > 0) { paneL.setView(V.left); fitPane(paneL, leftStage()); lastLeftSig = leftStage() + ':' + chainSig[leftStage()]; }
    // the deformation starts over for the new focus
    morph.T = 0; morph.seg = null;
    updateFocusUI();
    // the target group's heading and formulas name the variable of the focus's plane (wₖ with step k focused, P13)
    if (S.targets && S.targets.length) buildShapeList();
    scheduleFix();
    refreshIntPop();
    requestRender('L', 'P');
    save();
    if (!quiet) tourEmit('step-focused', { k });
  }

