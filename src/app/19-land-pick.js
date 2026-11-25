  // ---------------- the pick on the Landscape's sheets ----------------
  // A carried Landscape at rest on a plane k past its source plane s (svLandRest: plane s's points carried to k) has a
  // sheet over each point w of plane k for each point of s carried to w: s's preimages of w in its box, each at its own
  // height (render3D.pick.fibre). With the Pick tool, a press on one sheet picks its point z of plane s
  // (pickLandSheet), and its twins, every point of s with the same image w, light on their own sheets. They are the
  // floor picker's lit twins (pickLight(s, k, z), floorPick), so a pick here is the pick of z on plane s that the floor
  // picker and the Stack make. The gestures are the Stack's (19-stack-pick.js) on the Landscape's camera, which a drag
  // turns:
  // - a click or a tap (a press that moves less than STACK_PICK_SLOP, or STACK_PICK_SLOP_TOUCH for a finger, and lifts
  //   before STACK_HOLD_MS) lights the twins of the point under the pointer and says how many in the live region;
  // - a press held STACK_HOLD_MS follows the pointer over the sheets, the twins lit as it moves, and says them where it
  //   lifts (the page's "hold and slide" grammar);
  // - a press that moves before that turns the camera, as with any tool; the right or middle button and Shift pan it.
  // The pressed point is a dot and its twins rings, at their points on their sheets, a ring dashed where a nearer sheet
  // hides its point (found once the camera keeps still); marks within LAND_PICK_NEAR of each other are one, with the
  // count of the points it stands for beside it. Esc puts the twins out; Enter, with the plane focused, lights the twins of the point under
  // the pane's centre (pickKey).
  const LAND_PICK_DASH = [3, 3];       // css px: the dashes of a twin's ring that a nearer sheet hides
  const LAND_PICK_NEAR = 2 * PICK_RING; // css px: marks nearer than this on the screen are drawn as one, ×n
  // (a twin is hidden when the ray to it meets a point of s further from it than this, of the box's size)
  const LAND_PICK_HIDE = 1e-6;
  // (the hidden flags, a ray's march each, are found once the camera has kept still this long)
  const LAND_PICK_STILL_MS = 200;
  // (the lit twins' hidden flags, kept while the twins and the camera stay: {key, hidden})
  let landPickHide = null;
  // (the camera's last key, when it changed, and the redraw that waits for it to settle: {key, at, wait})
  let landPickCam = null;

  // a hint of phrases joined by " · ", each kept on one line (its spaces no-break, but after a comma, where a phrase
  // too long for a phone's readout, as ru «удерживайте и ведите, чтобы прочитать», may break), so a hint wraps between them
  function landPickPhrases(s) { return s.split(' · ').map((p) => p.replace(/([^,]) /g, '$1\u00a0')).join(' · '); }
  // whether the Pick tool picks on the Landscape's sheets: the steps view's Landscape at rest on a plane past its source
  // plane, whose last frame drew its sheets
  function landPickOn() {
    if (!SV.on || SV.surf !== 'land' || !lLand() || svMoving()) return false;
    const pk = render3D.pick;
    return !!(pk && pk.fibre);
  }
  // A press on the Landscape (its orbit drag d, at (x, y) of pane; touch: a finger's): with the Pick tool, a click
  // lights the twins of the point under it and a hold follows the pointer (d.landPick); a move before the hold leaves d
  // to turn the camera
  function landPickArm(d, pane, x, y, touch) {
    if (tool !== 'pick' || !landPickOn()) return;
    const lp = { x0: x, y0: y, slop: touch ? STACK_PICK_SLOP_TOUCH : STACK_PICK_SLOP, held: false, z: null };
    lp.timer = setTimeout(() => { if (drag === d && d.landPick === lp) landPickHold(lp, x, y); }, STACK_HOLD_MS);
    d.landPick = lp;
  }
  // the point of the sheet under (x, y), its twins lit as a held press's (unsaid: said where it lifts)
  function landPickHold(lp, x, y) {
    const hit = pickLandSheet(x, y);
    lp.held = true;
    if (!hit) return;
    lp.z = hit.z;
    probe = hit.w;
    setReadouts(hit.w);
    pickLight(render3D.pick.fibre.s, leftStage(), hit.z, STACK_PICK_MS, false);
  }
  // the pointer at (x, y) while a press of d is held: true when the pick takes the move (a held press follows the pointer
  // over the sheets); false when the press is the camera's (it moved past the slop before the hold)
  function landPickMove(d, x, y) {
    const lp = d.landPick;
    if (!lp) return false;
    if (lp.held) { landPickHold(lp, x, y); return true; }
    if (Math.hypot(x - lp.x0, y - lp.y0) < lp.slop) return true;
    clearTimeout(lp.timer);
    d.landPick = null;
    return false;
  }
  // a press of d lifted: a click lights the twins of the point under it; a held press leaves them lit where it lifted,
  // and says how many
  function landPickUp(d) {
    const lp = d.landPick;
    if (!lp) return;
    clearTimeout(lp.timer);
    d.landPick = null;
    if (!landPickOn()) return;
    const s = render3D.pick.fibre.s, k = leftStage();
    if (lp.held) { if (lp.z) pickLight(s, k, lp.z); return; }
    const hit = pickLandSheet(lp.x0, lp.y0);
    if (hit) { probe = hit.w; setReadouts(hit.w); pickLight(s, k, hit.z); }
  }
  // Esc on the Landscape: puts out the lit twins; true when it did
  function landPickOff() {
    if (!landPickOn() || !floorPickNow()) return false;
    floorPick = null;
    requestRender('L');
    return true;
  }
  // Enter with the Pick tool on the focused Landscape: lights the twins of the sheet's point under the pane's centre; true
  // when it acted
  function landPickKey() {
    if (tool !== 'pick' || !landPickOn()) return false;
    const pk = render3D.pick, hit = pickLandSheet(pk.w / 2, pk.h / 2);
    if (hit) pickLight(pk.fibre.s, leftStage(), hit.z);
    else svSay($t('No sheet under the centre of the view'));
    return true;
  }
  // the lit twins on the Landscape's sheets, for drawLandPicks and the tests: [{z, x, y, own, hidden}] in pane css px (a
  // point behind the camera is left out), or null while none are lit here
  function landPickMarks(pane) {
    const pk = render3D.pick, lit = floorPickNow();
    if (!pk || !pk.fibre || !lit || lit.k !== pk.fibre.s || lit.T !== leftStage()) return null;
    const info = pk.info, box = pk.box, [ax, ay] = info.aspect || [1, 1], top = Math.abs(info.top || 1) * 1.3;
    const wx = ((lit.w.re - box.x0) / (box.x1 - box.x0) - 0.5) * 2 * ax, wy = ((lit.w.im - box.y0) / (box.y1 - box.y0) - 0.5) * 2 * ay;
    const size = Math.max(box.x1 - box.x0, box.y1 - box.y0), c = pk.cam;
    const camKey = `${c.yaw},${c.pitch},${c.dist},${c.tx},${c.ty},${c.tz}|${pane.w}x${pane.h}`, key = `${lit.z0.re},${lit.z0.im}|${camKey}`;
    const marks = [];
    for (const { z } of lit.zs) {
      const v = pk.fibre.H(z), h0 = CX.isFin(v) ? info.heightOf(landValue(v)) : top, h = Number.isFinite(h0) ? Math.min(h0, top) : top;
      const q = project(pane, info.MVP, [wx, wy, h]);
      if (!q) continue;
      marks.push({ z, x: q[0], y: q[1], own: CX.abs(CX.sub(z, lit.z0)) <= 1e-6 * (1 + CX.abs(lit.z0)) });
    }
    // (a twin is hidden where the ray to its point meets another sheet's point first. The flags are kept while the
    // twins and the camera stay; while the camera turns the marks are drawn plain, and the flags are found once it has
    // kept still LAND_PICK_STILL_MS)
    const now = performance.now();
    // (a camera seen for the first time has kept still: the twins of a first pick are found at once)
    if (!landPickCam || landPickCam.key !== camKey) landPickCam = { key: camKey, at: landPickCam ? now : -Infinity, wait: landPickCam && landPickCam.wait };
    if (!landPickHide || landPickHide.key !== key) {
      if (now - landPickCam.at < LAND_PICK_STILL_MS) {
        if (!landPickCam.wait) landPickCam.wait = setTimeout(() => { if (landPickCam) landPickCam.wait = null; requestRender('L'); }, LAND_PICK_STILL_MS);
        marks.forEach((m) => { m.hidden = false; });
        return landPickNear(marks);
      }
      landPickHide = { key, hidden: marks.map((m) => { const hit = pickLandSheet(m.x, m.y); return !hit || CX.abs(CX.sub(hit.z, m.z)) > LAND_PICK_HIDE * size + 1e-9; }) };
    }
    marks.forEach((m, i) => { m.hidden = !!landPickHide.hidden[i]; });
    return landPickNear(marks);
  }
  // marks nearer than LAND_PICK_NEAR on the screen as one, with n, the points it stands for: twins near the pressed point
  // go under its dot, and twins' rings near each other under the first of them, drawn whole when any of them shows; a
  // mark under another is not drawn
  function landPickNear(marks) {
    const own = marks.find((m) => m.own);
    if (own) {
      const near = marks.filter((q) => !q.own && Math.hypot(q.x - own.x, q.y - own.y) < LAND_PICK_NEAR);
      own.n = 1 + near.length;
      for (const q of near) q.under = true;
    }
    for (const m of marks) {
      if (m.own || m.under) continue;
      const near = marks.filter((q) => q !== m && !q.own && !q.under && Math.hypot(q.x - m.x, q.y - m.y) < LAND_PICK_NEAR);
      m.n = 1 + near.length;
      for (const q of near) { q.under = true; if (!q.hidden) m.hidden = false; }
    }
    return marks;
  }
  // the lit twins over the Landscape's sheets on pane's 2D context: the floor picker's marks (pickMark) at the points on
  // their sheets, the pressed point a dot and its twins rings, a ring dashed where a nearer sheet hides its point, and
  // ×n beside a mark that stands for n points
  function drawLandPicks(pane) {
    const marks = landPickMarks(pane);
    if (!marks) return;
    const ctx = pane.ctx;
    ctx.save();
    for (const m of marks) {
      if (m.under) continue;
      pickMark(ctx, m.x, m.y, m.own, { dash: m.hidden && !m.own ? LAND_PICK_DASH : null });
      if (m.n > 1) {
        ctx.font = `11px ${TH.ui}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = TH.probe;
        haloText(ctx, `×${m.n}`, m.x + PICK_RING + 4, m.y, TH.halo);
      }
    }
    ctx.restore();
  }
  // TEST-HOOK (dropped from the published page by build.py): the Landscape's pick: whether it picks here, the sheet's point
  // under (x, y) when asked, the pane's size the pick measures in (Enter's centre is half of it), and the lit twins' marks
  window.__cmwLandPick = (x, y) => {
    const hit = x != null ? pickLandSheet(x, y) : null, pk = render3D.pick;
    return { on: landPickOn(), s: landPickOn() ? pk.fibre.s : null, size: pk ? [pk.w, pk.h] : null, hit: hit ? { z: [hit.z.re, hit.z.im], w: [hit.w.re, hit.w.im], h: hit.h } : null, marks: (landPickMarks(paneL) || []).map((m) => ({ z: [m.z.re, m.z.im], x: m.x, y: m.y, own: m.own, hidden: m.hidden, n: m.n || 1, under: !!m.under })) };
  };
  // TEST-HOOK
