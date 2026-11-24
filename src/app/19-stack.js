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
  const STACK_GLASS_H = 0.5;                  // the glass's height above the floor, a share of the pane's shorter side
  const STACK_TINT_A = 0.3, STACK_EDGE_A = 0.45;   // the glass's tint and the box's edges seen side-on; times cos(pitch)
  const STACK_ORDER = ['floor', 'floor marks', 'tubes', 'lines', 'glass', 'glass marks', 'picks', 'labels'];
  let stackCv = null;                         // the floor's picture as the flat plane drew it last (svCanvas's)
  let stackDrawn = null;                      // the last frame: {order: its layers as drawn, camera, floor, glass: the levels' maps, marks, tubes (with ms: their draw time), picks}
  let stackFlat = false;                      // the Stack's floor is being drawn flat (stackDrawPlane)
  // On a phone the box fits the plane's room that is left in sight: above the context bar, and beside Look down's key
  // while it is open (above it, right of it or below it, whichever lets the box be largest), STACK_ROOM_GAP css px clear
  // of the key; right of the key, the room stops short of the plane's button column by its lane (STACK_ROOM_LANE, as
  // phone.css's). Tilted to STACK_ROOM_PITCH and below, the box fits that room; from there to straight down it eases back
  // to the whole pane, so that straight down the map is still the identity and the frame Look down's.
  const STACK_ROOM_GAP = 6, STACK_ROOM_LANE = 66, STACK_ROOM_PITCH = 60 * DEG;
  let stackRooms = null;                      // [[x0, y0, x1, y1], ...] in the pane's css px; null: the whole pane
  // the Stack is shown, and its camera draws: not while its floor is drawn flat, which the flat plane's own draw does
  const stackOn = () => SV.on && SV.surf === 'stack' && !stackFlat;
  // the shown plane is drawn as the flat plane: the Plane surface, or the Stack's floor while it is drawn flat. floor:
  // the Stack's floor counts whenever the Stack is shown (the inverse jobs that warm its flat draw)
  const svFlatSurf = (floor = false) => SV.surf === 'plane' || (SV.surf === 'stack' && (floor || stackFlat));
  // cos(pitch): how far the camera is from straight down, 0 there exactly
  const stackTilt = (camera) => (camera.pitch >= 90 * DEG ? 0 : Math.cos(camera.pitch));
  // The camera's map of a level of the box in pane, up = 0 the floor or 1 the glass: [a, b, c, d, e, f] as setTransform
  // takes them, from the flat plane's css px to the pane's. The box (the pane's rectangle, the glass H above it) is
  // turned by −yaw about the pane's centre, seen at pitch, and scaled by k to fit its room (stackRoom: the pane, or on a
  // phone the room left in sight), never up, about the room's centre (cx, cy); seen straight down with yaw 0 the map is
  // the identity. In the pane's css px (y down), a point (x, y) of the level goes to
  //   X' = co·X − si·Y, Y' = si·X + co·Y, with X = x − w/2, Y = h/2 − y, co = cos yaw, si = −sin yaw;
  //   (cx + k·X', cy − k·(sin pitch·Y' + cos pitch·(up − 1/2)·H)).
  function stackLevel(pane, camera, up) {
    const w = pane.w, h = pane.h, H = STACK_GLASS_H * Math.min(w, h);
    const cp = stackTilt(camera), sp = cp === 0 ? 1 : Math.sin(camera.pitch), co = Math.cos(camera.yaw), si = -Math.sin(camera.yaw);
    const R = stackRoom(pane, camera), k = stackFit(pane, camera, R), cx = (R[0] + R[2]) / 2, cy = (R[1] + R[3]) / 2;
    return [k * co, -k * sp * si, k * si, k * sp * co, cx - k * (co * w / 2 + si * h / 2), cy + k * sp * (si * w / 2 - co * h / 2) - k * cp * (up - 0.5) * H];
  }
  // the scale, never above 1, at which the camera's view of pane's box fits the room R = [x0, y0, x1, y1] (css px)
  function stackFit(pane, camera, R) {
    const w = pane.w, h = pane.h, H = STACK_GLASS_H * Math.min(w, h), cp = stackTilt(camera), sp = cp === 0 ? 1 : Math.sin(camera.pitch);
    const co = Math.abs(Math.cos(camera.yaw)), si = Math.abs(Math.sin(camera.yaw)), ax = (w / 2) * co + (h / 2) * si, ay = (w / 2) * si + (h / 2) * co;
    return Math.min(1, (R[2] - R[0]) / 2 / ax, (R[3] - R[1]) / 2 / (ay * sp + H * cp / 2));
  }
  // the room [x0, y0, x1, y1] (css px) the camera fits pane's box into: of stackRooms, the one it is largest in, eased to
  // the whole pane from STACK_ROOM_PITCH up to straight down; the whole pane where there are none
  function stackRoom(pane, camera) {
    const whole = [0, 0, pane.w, pane.h], cp = stackTilt(camera), u = stackRooms && cp > 0 ? Math.min(1, cp / Math.cos(STACK_ROOM_PITCH)) : 0;
    if (u === 0) return whole;
    const best = stackRooms.reduce((a, b) => (stackFit(pane, camera, b) > stackFit(pane, camera, a) ? b : a));
    return whole.map((v, i) => v + u * (best[i] - v));
  }
  // The rooms the box may fit on a phone (stackRooms), measured again when Look down's key or the plane changes size, the
  // key is folded or unfolded, or the root's classes change (fitLookKey); the Stack is drawn again when they move
  function stackMeasureRooms() {
    const o = $('overlayL'), host = $('plotL');
    let rooms = null;
    if (document.documentElement.classList.contains('ph') && o && host) {
      const r = o.getBoundingClientRect(), w = r.width, h = r.height - (parseFloat(getComputedStyle(host).getPropertyValue('--ph-lift')) || 0);
      const k = lookKey && !lookKey.hidden && !lookKey.classList.contains('folded') ? lookKey.getBoundingClientRect() : null, g = STACK_ROOM_GAP;
      rooms = [[0, 0, w, h]];
      if (k && k.width > 0) {
        const x1 = k.right - r.left, y0 = k.top - r.top, y1 = k.bottom - r.top;
        rooms = [[0, 0, w, Math.min(h, y0 - g)], [x1 + g, 0, w - STACK_ROOM_LANE, h], [0, y1 + g, w, h]].filter(([a, b, c, d]) => c - a > 1 && d - b > 1);
      }
      rooms = rooms.length ? rooms.map((q) => q.map((v) => Math.round(v))) : null;
    }
    if (JSON.stringify(rooms) === JSON.stringify(stackRooms)) return;
    stackRooms = rooms;
    if (stackOn()) requestRender('L');
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
    stackAsFlat(() => stackFloor(pane, flat, stackCam));
    return true;
  }
  // f() run as the Stack's floor is drawn flat: on the Stack, under stackFlat, so lFlat() and svFlatSurf() read the flat
  // plane's (the floor's own draw, and whether a glide's frames can be drawn ahead, svAheadCan); elsewhere as it is.
  // -> f's result
  function stackAsFlat(f) {
    if (!SV.on || SV.surf !== 'stack' || stackFlat) return f();
    stackFlat = true;
    try { return f(); } finally { stackFlat = false; }
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
    // (the connectors, by the kind the key's switch shows. Curved, the lines to the target rise along them, through the
    // levels' maps at their heights, as far as the tubes stand up (tubeFade): straight down they are the lines from the
    // floor to the glass that Look down draws, as they are straight)
    let tubes = null, picks = null;
    const ln = mk ? stackLinks(s, linkMode(), mk.zsZ, mk.critZ) : null, up = tubeFade(tilt);
    const link = (path) => path.map((p, J) => {
      const t = J / LINK_N, m = F.map((v, n) => v + t * (G[n] - v)), z = path[0], w = path[LINK_N];
      const [x, y] = pane.w2s(C((1 - up) * (z.re + t * (w.re - z.re)) + up * p.re, (1 - up) * (z.im + t * (w.im - z.im)) + up * p.im));
      return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
    });
    const lines = ln && ln.mode === 'curved' && up > 0 ? Object.assign({ link: (i) => ln.zs[i] && link(ln.zs[i]) }, lv) : lv;
    const layers = {
      'floor marks': () => mk && drawLookLayer(ctx, mk, lv, 'floor'),
      tubes: () => { if (!mk) return; const t0 = performance.now(); tubes = drawStackTubes(pane, ctx, s, F, G, tilt, ln); if (tubes) tubes.ms = performance.now() - t0; },
      lines: () => { edges(); if (mk) drawLookLayer(ctx, mk, lines, 'lines'); },
      glass,
      'glass marks': () => mk && drawLookLayer(ctx, mk, lv, 'glass'),
      picks: () => { picks = drawStackPicks(pane, ctx, F, G); },
      labels: () => { if (tubes) drawStackLabels(ctx, tubes.labels, tubes.fade, stackRoom(pane, camera)); },
    };
    const order = ['floor'];
    for (const layer of STACK_ORDER.slice(1)) { layers[layer](); order.push(layer); }
    return { order, camera: { yaw: camera.yaw, pitch: camera.pitch }, floor: F, glass: G, marks: !!mk, tubes, picks, links: ln ? ln.mode : null, plane: TH.plane };
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
