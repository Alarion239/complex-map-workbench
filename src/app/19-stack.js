  // ---------------- the Stack: the plane shown as a floor, the target's plane as glass above it ----------------
  // The Stack is a surface of the steps view (SV.surf 'stack'). The floor is the plane shown (leftStage()), drawn as the
  // flat plane draws it, at rest or gliding; the glass is the selected disc's plane, a level above the floor in the
  // floor's own coordinates, where Look down's glass marks lie (19-lookdown.js). The camera (Tilt) is orthographic: yaw
  // turns the box about its upright axis, pitch is the view's angle above the floor, from STACK_PITCH_MIN to 90°
  // (straight down). Each level is a plane, so the camera sees it as an affine map of the flat plane's css px
  // (stackLevel). The levels are drawn in one fixed order, STACK_ORDER, whatever the camera:
  // - the floor's picture, on the main canvas;
  // - then on the overlay: the floor's marks, the tubes (19-stack-tubes.js), the box's edges and the lines from the
  //   floor to the glass, the glass (its tint and rim), the glass's marks, the picks (19-stack-pick.js), and the tubes'
  //   labels.
  // The camera is never under the floor, so a higher level is always nearer to it: the fixed order is the order in depth.
  // Seen straight down with yaw 0 both levels' maps are the identity, and the frame is Look down's.
  const STACK_PITCH_MIN = 10 * DEG;
  // Tilt, the camera the Stack opens with (dist, tx and ty are fields the orbit and its reset read; the levels do not)
  const STACK_CAM = { yaw: -30 * DEG, pitch: 35 * DEG, dist: 1, tx: 0, ty: 0 };
  const stackCam = Object.assign({ vyaw: 0, vpitch: 0 }, STACK_CAM);
  // Look down, the Stack's other camera: straight down with yaw 0, where the frame is Look down's
  const STACK_DOWN = { yaw: 0, pitch: 90 * DEG };
  let stackCamSet = false;                    // the Stack's camera was opened by a state or turned in this page
  const STACK_GLASS_H = 0.5;                  // the glass's height above the floor, a share of the pane's shorter side
  const STACK_TINT_A = 0.3, STACK_EDGE_A = 0.45;   // the glass's tint and the box's edges seen side-on; times cos(pitch)
  const STACK_ORDER = ['floor', 'floor marks', 'tubes', 'lines', 'glass', 'glass marks', 'picks', 'labels'];
  let stackCv = null;                         // the floor's picture as the flat plane drew it last (svCanvas's)
  let stackDrawn = null;                      // the last frame: {order: its layers as drawn, camera, floor, glass: the levels' maps, marks, tubes (with ms: their draw time), picks}
  let stackFlat = false;                      // the Stack's floor is being drawn flat (stackDrawPlane)
  // the Stack is shown, and its camera draws: not while its floor is drawn flat, which the flat plane's own draw does
  const stackOn = () => SV.on && SV.surf === 'stack' && !stackFlat;
  // the shown plane is drawn as the flat plane: the Plane surface, or the Stack's floor while it is drawn flat. floor:
  // the Stack's floor counts whenever the Stack is shown (the inverse jobs that warm its flat draw)
  const svFlatSurf = (floor = false) => SV.surf === 'plane' || (SV.surf === 'stack' && (floor || stackFlat));
  // cos(pitch): how far the camera is from straight down, 0 there exactly
  const stackTilt = (camera) => (camera.pitch >= 90 * DEG ? 0 : Math.cos(camera.pitch));
  // The camera's map of a level of the box in pane, up = 0 the floor or 1 the glass: [a, b, c, d, e, f] as setTransform
  // takes them, from the flat plane's css px to the pane's. The box (the pane's rectangle, the glass H above it) is
  // turned by −yaw about the pane's centre, seen at pitch, and scaled to fit the pane, never up; seen straight down with
  // yaw 0 the map is the identity. In the pane's css px (y down), a point (x, y) of the level goes to
  //   X' = co·X − si·Y, Y' = si·X + co·Y, with X = x − w/2, Y = h/2 − y, co = cos yaw, si = −sin yaw;
  //   (w/2 + k·X', h/2 − k·(sin pitch·Y' + cos pitch·(up − 1/2)·H)).
  function stackLevel(pane, camera, up) {
    const w = pane.w, h = pane.h, H = STACK_GLASS_H * Math.min(w, h);
    const cp = stackTilt(camera), sp = cp === 0 ? 1 : Math.sin(camera.pitch), co = Math.cos(camera.yaw), si = -Math.sin(camera.yaw);
    const ax = (w / 2) * Math.abs(co) + (h / 2) * Math.abs(si), ay = (w / 2) * Math.abs(si) + (h / 2) * Math.abs(co);
    const k = Math.min(1, (w / 2) / ax, (h / 2) / (ay * sp + H * cp / 2));
    return [k * co, -k * sp * si, k * si, k * sp * co, w / 2 - k * (co * w / 2 + si * h / 2), h / 2 + k * sp * (si * w / 2 - co * h / 2) - k * cp * (up - 0.5) * H];
  }
  // The parts inside the box of a path through it: pts [[x, y, t], ...] in the flat plane's css px at heights t (0 the
  // floor, 1 the glass), the box being pane's rectangle at every height; a straight strand is its two ends, a curved one
  // its samples. -> {runs: the paths' parts inside, each [[x, y, t], ...]; ends: the points where a part meets the box's
  // side, the off-view mark's place}
  function stackClipPath(pane, pts) {
    const runs = [], ends = [];
    let cur = null;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      let u0 = 0, u1 = 1;
      for (const [p, q, L] of [[a[0], b[0], pane.w], [a[1], b[1], pane.h]]) {
        const d = q - p;
        if (Math.abs(d) < 1e-12) { if (p < 0 || p > L) { u0 = 1; u1 = 0; } continue; }
        const lo = (0 - p) / d, hi = (L - p) / d;
        u0 = Math.max(u0, Math.min(lo, hi)); u1 = Math.min(u1, Math.max(lo, hi));
      }
      if (u0 > u1) { if (cur) { runs.push(cur); cur = null; } continue; }
      const at = (u) => a.map((v, j) => v + u * (b[j] - v));
      if (!cur) { cur = [at(u0)]; if (u0 > 0) ends.push(cur[0]); }
      cur.push(at(u1));
      if (u1 < 1) { ends.push(cur[cur.length - 1]); runs.push(cur); cur = null; }
    }
    if (cur) runs.push(cur);
    return { runs, ends };
  }
  // the Stack's camera as the state keeps it (S.sv.cam, Views.cleanSv): [yaw, pitch] in degrees, to 0.01°
  const stackCamSaved = () => [stackCam.yaw, stackCam.pitch].map((a) => Math.round((a / DEG) * 100) / 100);
  // opens the Stack's camera on saved ([yaw, pitch] in degrees, S.sv.cam), or with none on its own: Look down on a phone,
  // where the Stack opens flat and exact, and Tilt elsewhere
  function stackCamOpen(saved) {
    const c = saved ? { yaw: saved[0] * DEG, pitch: saved[1] * DEG } : document.documentElement.classList.contains('ph') ? STACK_DOWN : STACK_CAM;
    Object.assign(stackCam, { yaw: c.yaw, pitch: c.pitch, vyaw: 0, vpitch: 0 });
    stackCamSet = true;
  }
  // the Stack's camera's preset: 'down' at Look down (straight down, yaw 0), else 'tilt'
  const stackViewNow = () => (stackTilt(stackCam) === 0 && Math.abs(Math.sin(stackCam.yaw)) < 1e-9 && Math.cos(stackCam.yaw) > 0 ? 'down' : 'tilt');
  // turns the Stack's camera to a preset, 'tilt' (STACK_CAM) or 'down' (Look down), in a short tween (at once when motion is
  // reduced: tweenCam)
  function stackView(name) {
    stackCamSet = true;
    tweenCam(stackCam, name === 'down' ? STACK_DOWN : { yaw: STACK_CAM.yaw, pitch: STACK_CAM.pitch });
  }
  // The Stack chosen (the Surface menu, the palette): its camera opens as stackCamOpen says the first time in the page,
  // and with no target to show (a selected disc of a later plane) the first such disc is selected; with none, a starter
  // disc is added on the next plane (one edit, said in the live region), about F(c) for c a quarter of the view off its
  // centre (off a critical point there, as z² has at 0), of radius STACK_START_R of the view's width through F′(c), so
  // that its patches and tubes land in view, but at most STACK_START_GAP of the way to the nearest critical value, so
  // that its pieces are apart (z³ − 1.2z + 0.3 shows three). With no later plane nothing is added
  const STACK_START_R = 0.12, STACK_START_GAP = 0.6;
  function stackChosen() {
    if (!stackCamSet) stackCamOpen(null);
    const k = leftStage(), sel = findShape(selected);
    if (readoutOn(sel)) return;
    const own = S.shapes.find((q) => q.visible !== false && readoutOn(q));
    if (own) { selected = own.id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL'); return; }
    const T = svPlanes().find((st) => st > k);
    if (T == null) return;
    const F = rangeF(k, T);
    paneL.setView(leftView());
    const b = paneL.box(), W = b.x1 - b.x0, H = b.y1 - b.y0, mid = C((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    const cr = stageCritical(k, T, b), vals = cr && cr.values.known ? cr.values.list.map((v) => v.w).filter((w) => w && CX.isFin(w)) : [];
    for (const [u, v] of [[0.25, 0], [0.25, 0.15], [-0.25, 0.15], [0, 0.25]]) {
      const c = C(mid.re + u * W, mid.im + v * H), h = 1e-4 * W, w = F(c);
      const d = CX.abs(CX.sub(F(C(c.re + h, c.im)), F(C(c.re - h, c.im)))) / (2 * h), gap = Math.min(Infinity, ...vals.map((v) => CX.abs(CX.sub(v, w))));
      const r = Math.min(STACK_START_R * W * d, STACK_START_GAP * gap);
      if (!CX.isFin(w) || !(r > 0) || !Number.isFinite(r)) continue;
      addShape(newShape('disc', { c: [w.re, w.im], r, stage: T }));
      svSay($t('A starter disc added on {w}, with its preimage on {z}', { w: svName(T), z: svName(k) }));
      return;
    }
  }
  // a level of the marks (drawLookLayer's) from its map m
  const stackMarkLevel = (m) => ({
    at: (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]],
    path: (ctx, build) => { const t = ctx.getTransform(); ctx.transform(m[0], m[1], m[2], m[3], m[4], m[5]); build(); ctx.setTransform(t); },
  });
  // The Stack's floor on pane's main canvas: flat(pane) draws the plane as the flat plane does, its labels placed at
  // once, and that picture is mapped by the floor's level. A flat frame that keeps the pane's picture (a held glide's,
  // svHeldKept) draws nothing, and the picture it drew last is mapped again
  function stackFloor(pane, flat, camera) {
    const begun = pane.begun;
    flat(pane);
    if (pane.labels) flushLabels(pane, pane.labels);
    if (pane.begun !== begun || !stackCv) { stackCv = svCanvas(stackCv, pane); stackCv.getContext('2d').drawImage(pane.canvas, 0, 0); }
    const m = stackLevel(pane, camera, 0), ctx = pane.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = TH.plane; ctx.fillRect(0, 0, pane.pw, pane.ph);
    ctx.setTransform(m[0], m[1], m[2], m[3], m[4] * pane.dpr, m[5] * pane.dpr);
    ctx.drawImage(stackCv, 0, 0);
    ctx.restore();
  }
  // the steps view's left plane on the Stack (renderLeft's): the floor drawn flat by flat(p) and seen by the Stack's
  // camera. False when the Stack is not shown
  function stackDrawPlane(pane, flat) {
    if (!stackOn()) return false;
    stackFlat = true;
    try { stackFloor(pane, flat, stackCam); } finally { stackFlat = false; }
    return true;
  }
  // The Stack's layers after the floor on ctx (css px, pane's overlay), for the flat view of pane: the floor's marks, the
  // tubes, the box's edges and the lines, the glass, the glass's marks, the picks, the tubes' labels (STACK_ORDER). The marks are Look down's, for the selected
  // disc while its readout card shows (lookMarksOn). Returns the frame's record (stackDrawn's)
  function stackMarks(pane, ctx, camera) {
    const s = findShape(selected), on = lookMarksOn(s), mk = on ? lookMarks(pane, s) : null;
    const F = stackLevel(pane, camera, 0), G = stackLevel(pane, camera, 1), lv = { floor: stackMarkLevel(F), glass: stackMarkLevel(G) };
    const tilt = stackTilt(camera), corners = [[0, 0], [pane.w, 0], [pane.w, pane.h], [0, pane.h]];
    const fc = corners.map((p) => lv.floor.at(...p)), gc = corners.map((p) => lv.glass.at(...p));
    const poly = (pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
    const edges = () => {
      // (seen straight down the edges lie on the pane's border and the glass is the plane itself: neither is drawn)
      if (tilt === 0) return;
      ctx.save(); ctx.globalAlpha = STACK_EDGE_A * tilt; ctx.strokeStyle = TH.ink; ctx.lineWidth = 1;
      poly(fc); ctx.stroke();
      ctx.beginPath(); fc.forEach(([x, y], i) => { ctx.moveTo(x, y); ctx.lineTo(...gc[i]); }); ctx.stroke();
      ctx.restore();
    };
    const glass = () => {
      if (tilt === 0) return;
      ctx.save(); poly(gc);
      ctx.globalAlpha = STACK_TINT_A * tilt; ctx.fillStyle = TH.plane; ctx.fill();
      ctx.globalAlpha = STACK_EDGE_A * tilt; ctx.strokeStyle = TH.ink; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    };
    let tubes = null, picks = null;
    const layers = {
      'floor marks': () => mk && drawLookLayer(ctx, mk, lv, 'floor'),
      tubes: () => { if (!mk) return; const t0 = performance.now(); tubes = drawStackTubes(pane, ctx, s, F, G, tilt, mk.critZ); if (tubes) tubes.ms = performance.now() - t0; },
      lines: () => { edges(); if (mk) drawLookLayer(ctx, mk, lv, 'lines'); },
      glass,
      'glass marks': () => mk && drawLookLayer(ctx, mk, lv, 'glass'),
      picks: () => { picks = drawStackPicks(pane, ctx, F, G); },
      labels: () => { if (tubes) drawStackLabels(ctx, tubes.labels, tubes.fade, pane.w); },
    };
    const order = ['floor'];
    for (const layer of STACK_ORDER.slice(1)) { layers[layer](); order.push(layer); }
    return { order, camera: { yaw: camera.yaw, pitch: camera.pitch }, floor: F, glass: G, marks: !!mk, tubes, picks, plane: TH.plane };
  }
  // the Stack's overlay on the left pane (renderOverlays'), with Look down's key chip when the marks show. False when the
  // Stack is not shown
  function stackDrawOverlay(pane) {
    if (!stackOn()) return false;
    stackDrawn = stackMarks(pane, pane.octx, stackCam);
    syncLookKey(stackDrawn.marks, true, !!stackDrawn.tubes);
    return true;
  }
  // TEST-HOOK (dropped from the published page by build.py): the Stack's state, its last frame and the glass's hovered or
  // pinned point (hov: {w, zs, pinned}); o.pick: [x, y] (the pane's css px) gives the levels' points under it (stackPick:
  // floor {p, z}, glass {p, w}, each with on) and the level a hover, a click and a held press there pick; o.same: {yaw, pitch}
  // draws the Stack's frame at that camera for the left pane as it is now, the floor on its main canvas and the rest on
  // a canvas of the overlay's size, and counts the device px where each differs from the pane's own frame before it
  // ({main, over, px}); the pane is drawn again after
  window.__cmwStack = (o) => {
    const cx = (q) => q && [q.re, q.im];
    if (o && o.pick) {
      const [x, y] = o.pick, hit = stackPick(paneL, x, y);
      return { floor: hit.floor && { p: hit.floor.p, z: cx(hit.floor.z), on: hit.floor.on }, glass: hit.glass && { p: hit.glass.p, w: cx(hit.glass.w), on: hit.glass.on }, hover: stackPickLevel(paneL, hit, x, y, 'hover'), click: stackPickLevel(paneL, hit, x, y, 'click'), hold: stackPickLevel(paneL, hit, x, y, 'hold') };
    }
    if (o && o.same) {
      const pane = paneL, grab = (cv) => cv.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, cv.width, cv.height).data;
      const main0 = grab(pane.canvas), over0 = grab(pane.ocanvas);
      const camera = Object.assign({}, STACK_CAM, o.same);
      pane.setView(leftView());
      stackFloor(pane, (p) => svDrawPlane(p, drawLeft), camera);
      const ov = document.createElement('canvas');
      ov.width = pane.ocanvas.width; ov.height = pane.ocanvas.height;
      const octx = ov.getContext('2d', { willReadFrequently: true });
      octx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
      pane.setView(leftView());
      stackMarks(pane, octx, camera);
      const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) n++; return n; };
      const r = { main: diff(main0, grab(pane.canvas)), over: diff(over0, grab(ov)), px: main0.length / 4 };
      requestRender('L');
      return r;
    }
    const hv = stackHovNow();
    return { on: stackOn(), camera: { yaw: stackCam.yaw, pitch: stackCam.pitch }, drawn: stackDrawn && JSON.parse(JSON.stringify(stackDrawn)), lflat: lFlat(), hov: hv && { w: cx(hv.w), zs: hv.zs.map((r) => [...cx(r.z), r.mult]), more: hv.more, pinned: hv.pinned } };
  };
  // TEST-HOOK
