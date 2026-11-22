  // ---------------- the Stack: the plane shown as a floor, the target's plane as glass above it ----------------
  // The Stack is a surface of the steps view (SV.surf 'stack'). The floor is the plane shown (leftStage()), drawn as the
  // flat plane draws it, at rest or gliding; the glass is the selected disc's plane, a level above the floor in the
  // floor's own coordinates, where Look down's glass marks lie (19-lookdown.js). The camera (Tilt) is orthographic: yaw
  // turns the box about its upright axis, pitch is the view's angle above the floor, from STACK_PITCH_MIN to 90°
  // (straight down). Each level is a plane, so the camera sees it as an affine map of the flat plane's css px
  // (stackLevel). The levels are drawn in one fixed order, STACK_ORDER, whatever the camera:
  // - the floor's picture, on the main canvas;
  // - then on the overlay: the floor's marks, the box's edges and the lines from the floor to the glass, the glass (its
  //   tint and rim), and the glass's marks.
  // The camera is never under the floor, so a higher level is always nearer to it: the fixed order is the order in depth.
  // Seen straight down with yaw 0 both levels' maps are the identity, and the frame is Look down's.
  const STACK_PITCH_MIN = 10 * DEG;
  // Tilt, the camera the Stack opens with (dist, tx and ty are fields the orbit and its reset read; the levels do not)
  const STACK_CAM = { yaw: -30 * DEG, pitch: 35 * DEG, dist: 1, tx: 0, ty: 0 };
  const stackCam = Object.assign({ vyaw: 0, vpitch: 0 }, STACK_CAM);
  const STACK_GLASS_H = 0.5;                  // the glass's height above the floor, a share of the pane's shorter side
  const STACK_TINT_A = 0.3, STACK_EDGE_A = 0.45;   // the glass's tint and the box's edges seen side-on; times cos(pitch)
  const STACK_ORDER = ['floor', 'floor marks', 'lines', 'glass', 'glass marks'];
  let stackCv = null;                         // the floor's picture as the flat plane drew it last (svCanvas's)
  let stackDrawn = null;                      // the last frame: {order: its layers as drawn, camera, floor, glass: the levels' maps}
  const stackOn = () => SV.on && SV.surf === 'stack';
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
    // (the flat plane's own draw, as it draws on the Plane surface)
    SV.surf = 'plane';
    try { stackFloor(pane, flat, stackCam); } finally { SV.surf = 'stack'; }
    return true;
  }
  // The Stack's layers after the floor on ctx (css px, pane's overlay), for the flat view of pane: the floor's marks, the
  // box's edges and the lines, the glass, the glass's marks (STACK_ORDER). The marks are Look down's, for the selected
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
    const layers = {
      'floor marks': () => mk && drawLookLayer(ctx, mk, lv, 'floor'),
      lines: () => { edges(); if (mk) drawLookLayer(ctx, mk, lv, 'lines'); },
      glass,
      'glass marks': () => mk && drawLookLayer(ctx, mk, lv, 'glass'),
    };
    const order = ['floor'];
    for (const layer of STACK_ORDER.slice(1)) { layers[layer](); order.push(layer); }
    return { order, camera: { yaw: camera.yaw, pitch: camera.pitch }, floor: F, glass: G, marks: !!mk };
  }
  // the Stack's overlay on the left pane (renderOverlays'), with Look down's key chip when the marks show. False when the
  // Stack is not shown
  function stackDrawOverlay(pane) {
    if (!stackOn()) return false;
    stackDrawn = stackMarks(pane, pane.octx, stackCam);
    syncLookKey(stackDrawn.marks);
    return true;
  }
  // TEST-HOOK (dropped from the published page by build.py): the Stack's state and its last frame; o.same: {yaw, pitch}
  // draws the Stack's frame at that camera for the left pane as it is now, the floor on its main canvas and the rest on
  // a canvas of the overlay's size, and counts the device px where each differs from the pane's own frame before it
  // ({main, over, px}); the pane is drawn again after
  window.__cmwStack = (o) => {
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
    return { on: stackOn(), camera: { yaw: stackCam.yaw, pitch: stackCam.pitch }, drawn: stackDrawn && JSON.parse(JSON.stringify(stackDrawn)), lflat: lFlat() };
  };
  // TEST-HOOK
