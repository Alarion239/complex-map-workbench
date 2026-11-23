  // ---------------- picking in the Stack: the floor's and the glass's points under the pointer (#1988) ----------------
  // The Stack's levels are planes, each seen through its affine map (stackLevel), so the point of a level under the
  // pointer is that map's inverse at the pointer: a point of the flat plane's css px, and so a point z of the floor (the
  // plane shown) or a point w of the glass (the target's plane T = svT(), in the floor's own coordinates, as Look down's
  // glass marks are). The pick follows the floor picker (19-floor-pick.js). With the Pick tool, in this order:
  // - a press on a glass's mark, the target's ring, drags the target, its centre under the pointer as it moves;
  // - a press on a floor's mark (a lit patch, a lit twin's ring, a critical point's cross, seen through the glass) acts on
  //   the floor: a lit patch drags its area, as the floor picker's does;
  // - a click or a tap (a press that moves less than STACK_PICK_SLOP, or STACK_PICK_SLOP_TOUCH for a finger, and lifts
  //   before STACK_HOLD_MS) pins the point the hover showed: the glass's w where the glass lies under the pointer, with a
  //   strand down to each of its preimages, until Esc or the next pin; on the floor alone it lights the point's twins;
  // - a press held or dragged reads the floor: z₀'s strand rises to F(z₀) and dashed strands come down to its twins,
  //   following the pointer, and the readouts read z₀ (the page's "hold and slide" grammar).
  // A hover shows the level a click acts on: the glass's w with its strands where the glass lies under the pointer, the
  // floor's z elsewhere; over a mark the pointer is the move cursor, and the target's ring is drawn lit. With the Disc
  // tool, a press on the floor and a drag out draws a disc on T about F(z₀). Any tool reads the hovered point in the left
  // readout: z on the floor, w on the glass with its count of preimages. From the keyboard, with the plane focused and
  // the Pick tool, Shift+Enter pins the selected target's centre (or the view's centre) on the glass, and Enter lights the
  // floor's twins (pickKey).
  // The camera turns apart from the pick: a drag with any other tool, the right or middle button or Shift with the Pick
  // tool, or two fingers (14-interaction.js).
  const STACK_PICK_RING = 64;          // the target's ring as the pick sees it: a polygon of this many sides
  const STACK_PICK_SLOP = 4, STACK_PICK_SLOP_TOUCH = 8;   // css px a press moves before it is no click (a mouse's, a finger's)
  const STACK_HOLD_MS = 450;           // a still press held this long reads the floor (the plane's long press)
  const STACK_PICK_MS = 30;            // a hover's preimage search where the steps have no exact inverse (a pin's: PICK_SEARCH_MS)
  const STACK_PICK_DOT = 3.5, STACK_PICK_DASH = [5, 4];   // css px: a strand's end on the glass, a twin's dashes
  let stackHov = null;                 // the glass's point hovered or pinned: {sig, w, zs: [{z, mult}], more, pinned}
  let stackReadW = null;               // the glass's point the left readout reads (the idle readout leaves it, idleReadouts)
  let stackMarkHov = null;             // the mark the hover is over, with the Pick tool: 'ring' (the glass's), 'floor', or null

  // the point under (x, y) (pane css px) on the level with map m: the flat plane's css px, or null where m is singular
  function stackUnmap(m, x, y) {
    const det = m[0] * m[3] - m[1] * m[2];
    if (!(Math.abs(det) > 1e-12)) return null;
    const dx = x - m[4], dy = y - m[5];
    return [(m[3] * dx - m[2] * dy) / det, (m[0] * dy - m[1] * dx) / det];
  }
  // The Stack's levels under (x, y) of pane: {floor: {p, z, on}, glass: {p, w, on}}, p in the flat plane's css px, z and w
  // the points there, on whether p lies on the level's rectangle; a level whose map is singular is null
  function stackPick(pane, x, y, camera = stackCam) {
    pane.setView(leftView());
    const at = (up) => {
      const p = stackUnmap(stackLevel(pane, camera, up), x, y);
      return p && { p, pt: pane.s2w(p[0], p[1]), on: p[0] >= 0 && p[0] <= pane.w && p[1] >= 0 && p[1] <= pane.h };
    };
    const f = at(0), g = at(1);
    return { floor: f && { p: f.p, z: f.pt, on: f.on }, glass: g && { p: g.p, w: g.pt, on: g.on } };
  }
  // the selected disc when (x, y) is within LD_HIT / 2 css px of its ring on the glass (the target, while its marks show),
  // or null
  function stackRingAt(pane, x, y, camera = stackCam) {
    const s = findShape(selected);
    if (!lookMarksOn(s)) return null;
    const m = lookMarks(pane, s), G = stackLevel(pane, camera, 1);
    const pts = Array.from({ length: STACK_PICK_RING }, (_, i) => { const a = (TAU * i) / STACK_PICK_RING, u = m.c[0] + m.r * Math.cos(a), v = m.c[1] + m.r * Math.sin(a); return [G[0] * u + G[2] * v + G[4], G[1] * u + G[3] * v + G[5]]; });
    return pts.some((p, i) => segDist([x, y], p, pts[(i + 1) % pts.length]) <= LD_HIT / 2) ? s : null;
  }
  // whether a floor's mark lies under (x, y) at the floor's point z: a lit patch, a lit twin's ring or a critical point's
  // cross, seen through the floor's map
  function stackFloorMark(pane, x, y, z, camera = stackCam) {
    if (pickPatch(leftStage(), z)) return true;
    const F = stackLevel(pane, camera, 0), near = (q, r) => { const [u, v] = pane.w2s(q); return Math.hypot(F[0] * u + F[2] * v + F[4] - x, F[1] * u + F[3] * v + F[5] - y) <= r; };
    const lit = floorPickNow();
    if (lit && lit.zs.some((t) => near(t.z, PICK_RING + 4))) return true;
    const s = findShape(selected);
    return lookMarksOn(s) && lookMarks(pane, s).critZ.some((c) => near(c, LD_CROSS + 4));
  }
  // where neither level's marks are under the pointer and both levels are: the level a hover, a click or a held press
  // ('hover', 'click', 'hold') picks. A hover and a click the glass, the nearer level; a held press the floor
  const stackOverlap = (how) => (how === 'hold' ? 'floor' : 'glass');
  // the level the pointer at (x, y) picks for how (stackOverlap's), given the levels under it (stackPick's), or null off
  // both
  function stackPickLevel(pane, hit, x, y, how) {
    const f = hit.floor && hit.floor.on ? hit.floor : null, g = hit.glass && hit.glass.on ? hit.glass : null;
    if (!f && !g) return null;
    if (g && stackRingAt(pane, x, y)) return 'glass';
    if (f && stackFloorMark(pane, x, y, f.z)) return 'floor';
    return f && g ? stackOverlap(how) : f ? 'floor' : 'glass';
  }
  // the glass's point w hovered (pinned: clicked), with its preimages on the floor; null clears an unpinned one
  function stackHoverW(w, pinned = false) {
    if (stackHov && stackHov.pinned && !pinned && stackHov.sig === pickSig()) return;
    const k = leftStage(), T = svT(), t = w && T > k ? pickFibre(k, T, w, pinned ? PICK_SEARCH_MS : STACK_PICK_MS) : null;
    stackHov = t ? Object.assign({ sig: pickSig(), pinned }, t) : null;
    requestRender('OL');
  }
  // the glass's hovered or pinned point while it is the chain's and the Pick tool's, else null
  function stackHovNow() {
    if (stackHov && (stackHov.sig !== pickSig() || tool !== 'pick' || !stackOn())) stackHov = null;
    return stackHov;
  }
  // the pointer left the Stack: an unpinned hover goes, and the readout reads no point of the glass
  function stackHoverOff() {
    stackReadW = null;
    stackHoverW(null);
  }
  // Esc with a pinned point: unpins it; true when it did
  function stackUnpin() {
    if (!stackHov || !stackHov.pinned) return false;
    stackHov = null;
    requestRender('OL');
    return true;
  }
  // the left readout of the glass's point w: its count of preimages on the floor, as a hover of the right plane reads
  function stackReadoutW(w) {
    const lr = $('leftReadout');
    if (!lr || lr.classList.contains('copied')) return;
    const t = stackHov && stackHov.w === w ? stackHov : pickFibre(leftStage(), svT(), w, STACK_PICK_MS);
    const n = t ? t.zs.reduce((a, r) => a + (r.mult || 1), 0) : 0, where = '';
    const words = !t ? $tx('readout', 'at') : t.more ? $tn('at least {n} preimage{where} of', 'at least {n} preimages{where} of', n, { where }) : $tn('{n} preimage{where} of', '{n} preimages{where} of', n, { where });
    lr.innerHTML = `<span class="rp"><span class="rk"><span class="rw">${words}</span> <i>w</i>${sub(svT())}</span> <span class="rv">${fmtCxHtml(w)}</span></span>`;
    copyValue.L = CX.fmt(w, 6).replace(/\s/g, '');
  }
  // The pointer moved over the Stack with no press held: the hovered point in the readouts, and with the Pick tool the
  // glass's strands
  function stackHover(pane, x, y) {
    const hit = stackPick(pane, x, y), lv = stackPickLevel(pane, hit, x, y, 'hover');
    stackReadW = lv === 'glass' ? hit.glass.w : null;
    const mark = tool !== 'pick' || !lv ? null : lv === 'glass' ? (stackRingAt(pane, x, y) ? 'ring' : null) : stackFloorMark(pane, x, y, hit.floor.z) ? 'floor' : null;
    if (mark !== stackMarkHov) { stackMarkHov = mark; requestRender('OL'); }
    if (tool === 'pick') pane.ocanvas.style.cursor = mark ? 'move' : 'crosshair';
    if (lv === 'floor') {
      probe = hit.floor.z;
      setReadouts(probe);
      if (tool === 'pick') stackHoverW(null);
    } else {
      probe = null;
      setReadouts(null);
      if (tool === 'pick') stackHoverW(lv === 'glass' ? hit.glass.w : null);
      if (lv === 'glass') stackReadoutW(hit.glass.w);
    }
    requestRender('OL');
  }
  // A press with the Pick tool (or the Disc tool) at (x, y) of the Stack (touch: a finger's): true when it picked (and set
  // drag); false leaves the press to the camera
  function stackPickDown(pane, x, y, touch) {
    if ((tool !== 'pick' && tool !== 'disc') || !pickAvail()) return false;
    const hit = stackPick(pane, x, y), f = hit.floor && hit.floor.on ? hit.floor : null, g = hit.glass && hit.glass.on ? hit.glass : null;
    if (!f && !g) return false;
    const k = leftStage(), T = svT();
    if (tool === 'disc') {
      // (the Disc tool: a drag out on the floor draws the disc on T about the pressed point's image)
      if (!f) return false;
      const F = rangeF(k, T), w0 = F(f.z);
      if (!CX.isFin(w0)) return true;
      drag = { mode: 'pickOut', level: 'floor', T, F, w0, x0: x, y0: y, disc: null, moved: false };
      return true;
    }
    const ring = g && stackRingAt(pane, x, y);
    if (ring) {
      selected = ring.id; zpSel = null; buildShapeList();
      drag = { mode: 'pickMove', level: 'glass', shape: ring, F: (w) => w, w: g.w, x0: x, y0: y, moved: false };
      return true;
    }
    const patch = f && pickPatch(k, f.z);
    if (patch) {
      const F = rangeF(k, shapeStage(patch));
      selected = patch.id; zpSel = null; buildShapeList();
      drag = { mode: 'pickMove', level: 'floor', shape: patch, F, w: F(f.z), x0: x, y0: y, moved: false };
      return true;
    }
    const d = { mode: 'stackPress', hit, x0: x, y0: y, x, y, slop: touch ? STACK_PICK_SLOP_TOUCH : STACK_PICK_SLOP, held: false, moved: false, z: null, pane };
    d.timer = setTimeout(() => { if (drag === d && !d.moved) stackHold(d, pane, d.x0, d.y0); }, STACK_HOLD_MS);
    drag = d;
    return true;
  }
  // a held press reads the floor at (x, y): its point's strand, its twins and the readouts
  function stackHold(d, pane, x, y) {
    const z = stackPickAt(pane, 'floor', x, y);
    if (!z) return;
    d.held = true; d.z = z;
    if (stackHov && !stackHov.pinned) stackHov = null;
    stackReadW = null;
    probe = z;
    setReadouts(z);
    pickLight(leftStage(), svT(), z, STACK_PICK_MS, false);
  }
  // the pointer at (x, y) while a press of the Stack's pick is held: past the slop, it reads the floor under the pointer
  function stackPressMove(d, pane, x, y) {
    d.x = x; d.y = y;
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) < d.slop) return;
    d.moved = true;
    clearTimeout(d.timer);
    stackHold(d, pane, x, y);
  }
  // a press of the Stack's pick lifted: a click pins the point the hover showed (the glass's, else the floor's twins); a
  // held or dragged press leaves the floor's twins lit where it lifted, and says how many
  function stackPressUp(d) {
    clearTimeout(d.timer);
    const k = leftStage(), T = svT();
    if (d.held || d.moved) { if (d.z) pickLight(k, T, d.z); return; }
    const lv = stackPickLevel(d.pane, d.hit, d.x0, d.y0, 'click');
    if (lv === 'glass') { stackPin(d.hit.glass.w); return; }
    if (lv === 'floor') { stackHov = null; pickLight(k, T, d.hit.floor.z); }
  }
  // the point of the level a held press picks, under (x, y): the level's map inverted, on its rectangle or off it
  function stackPickAt(pane, level, x, y) {
    const hit = stackPick(pane, x, y), h = hit[level];
    return h ? (level === 'glass' ? h.w : h.z) : null;
  }
  // pins the glass's point w: its strands stay until Esc or the next pin; the readout and the live region say its count
  function stackPin(w) {
    stackHov = null;
    stackHoverW(w, true);
    stackReadW = w;
    stackReadoutW(w);
    const live = SV.els && SV.els.live, t = stackHov;
    if (live && t) {
      const n = t.zs.reduce((a, r) => a + (r.mult || 1), 0), plane = svName(leftStage());
      live.textContent = t.more ? $t('{n} preimages found on {plane}, and there may be more', { n, plane }) : $tn('{n} preimage on {plane}', '{n} preimages on {plane}', n, { n, plane });
    }
  }
  // Shift+Enter with the Pick tool on the focused Stack: pins the selected target's centre on the glass, or the view's
  // centre; true when it acted
  function stackPinKey() {
    if (tool !== 'pick' || !pickAvail() || !stackOn()) return false;
    const s = findShape(selected);
    paneL.setView(leftView());
    const b = paneL.box(), w = s && shapeStage(s) === svT() && Array.isArray(s.c) ? C(s.c[0], s.c[1]) : C((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    stackPin(w);
    return true;
  }
  // The picks over the Stack's levels on ctx (css px; maps F and G of the floor and the glass): the floor's lit point,
  // its strand up to its image and dashed strands down to its twins; the glass's hovered or pinned point, with a strand
  // down to each of its preimages
  function drawStackPicks(pane, ctx, F, G) {
    const lit = floorPickNow(), hv = stackHovNow(), s = stackMarkHov === 'ring' && tool === 'pick' ? findShape(selected) : null;
    const lookRing = s && lookMarksOn(s) ? lookMarks(pane, s) : null;
    if (!lit && !hv && !lookRing) return;
    const at = (m, q) => { const [u, v] = pane.w2s(q); return [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]]; };
    const line = (a, b, colour, w, dash) => {
      ctx.setLineDash(dash || []);
      ctx.lineWidth = w + 2.5; ctx.strokeStyle = TH.halo; ctx.globalAlpha = TH.haloA; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.strokeStyle = colour; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    };
    const ring = (p, r, colour, fill) => {
      const x = p[0], y = p[1];
      ctx.setLineDash([]);
      ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.75; ctx.strokeStyle = colour; ctx.fillStyle = colour; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
      if (fill) ctx.fill(); else ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'round';
    // (the target's ring under the pointer, lit: a press there drags it)
    if (lookRing) { ctx.lineWidth = 3.5; ctx.strokeStyle = TH.probe; ctx.beginPath(); stackMarkLevel(G).path(ctx, () => ctx.arc(lookRing.c[0], lookRing.c[1], lookRing.r, 0, TAU)); ctx.stroke(); }
    if (lit) {
      const z0 = lit.z0, top = at(G, lit.w), own = at(F, z0);
      for (const { z } of lit.zs) if (CX.abs(CX.sub(z, z0)) > 1e-6 * (1 + CX.abs(z0))) line(top, at(F, z), TH.probe, 1.5, STACK_PICK_DASH);
      line(own, top, TH.probe, 1.75);
      for (const { z } of lit.zs) { const own0 = CX.abs(CX.sub(z, z0)) <= 1e-6 * (1 + CX.abs(z0)); ring(at(F, z), own0 ? PICK_DOT : PICK_RING, TH.probe, own0); }
      ring(top, STACK_PICK_DOT, TH.probe, true);
    }
    if (hv) {
      const top = at(G, hv.w), w = hv.pinned ? 1.75 : 1.25;
      for (const { z } of hv.zs) line(top, at(F, z), TH.accent, w);
      for (const { z } of hv.zs) ring(at(F, z), PICK_RING, TH.accent, false);
      ring(top, STACK_PICK_DOT, TH.accent, true);
    }
    ctx.restore();
  }
