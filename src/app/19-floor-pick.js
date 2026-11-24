  // ---------------- the floor picker: the Pick tool in the steps view ----------------
  // On the plane shown, the floor (stage k = leftStage()), with the target's plane T = svT() past it, the Pick tool picks
  // on the floor; F = rangeF(k, T).
  // - A press at z₀ lights its twins: every z with F(z) = F(z₀). They come from exactPre, all of them, where the steps
  //   have finitely many inverse branches; otherwise a search finds those in view.
  // - A drag out from z₀ draws a disc of plane T about F(z₀) through F(z), whose preimage patches the pulled-back layer
  //   lights (stagePullbacks). It is added as one edit when the pointer lifts.
  // - A press on a lit patch (F(z) inside an area of a later plane) drags that area, so that its point under the pointer
  //   stays under it (Region.translate by the change of the area's map at the pointer), and every patch follows.
  // - A press on Look down's ring of the target (over a patch too) or on one of its lines drags the target with the
  //   pointer: they are drawn in the target's own coordinates at the floor's places.
  // The view pans with two fingers, the right or middle button, the wheel and the edge strip, as with any tool.
  // From the keyboard, with the plane focused, Enter lights the twins of the selected point of the floor, or else of the
  // view's centre; Enter again adds the disc about their image (PICK_KEY_PX at z₀ on the floor), selected, for the
  // Inspector and the arrows. The tool shows only where it picks (pickAvail); elsewhere its button keeps its place,
  // hidden (syncGlobeTools).
  const PICK_SLOP = 4;                 // CSS px a press moves before it is a drag
  const PICK_KEY_PX = 40;              // a disc added from the keyboard: its radius on the floor, in CSS px at z₀
  const PICK_DOT = 4.5, PICK_RING = 6; // CSS px: the pressed point's dot, its twins' rings
  const PICK_SEARCH_MS = 120;          // the search's budget where the steps have no exact inverse
  const PICK_SEARCH_MAX = 40;          // the most twins the search lists
  let floorPick = null;                // the lit twins: {sig, k, T, z0, w, zs: [{z, mult}], more}
  // whether the Pick tool picks here: the steps view's flat plane or the Stack (19-stack-pick.js), with the target's plane
  // past it, or the Landscape's sheets on a plane past their source plane (19-land-pick.js)
  const pickAvail = () => !!(SV.on && (((lFlat() || stackOn()) && svT() > leftStage()) || landPickOn()));
  const pickSig = () => `${leftStage()}|${svT()}|${chainSig[nSteps()]}`;
  // the preimages of w on plane k over plane T: {w, zs: [{z, mult}], more} (more: the search may have missed some); exact
  // where the steps have finitely many inverse branches, else a search of the view of at most ms; null where w is not
  // finite
  function pickFibre(k, T, w, ms = PICK_SEARCH_MS) {
    if (!w || !CX.isFin(w)) return null;
    const ex = exactPre(k, T, [w.re, w.im]);
    if (ex) return { w, zs: ex.zs.map((z, i) => ({ z, mult: ex.mult[i] })), more: false };
    paneL.setView(leftView());
    let sols = null;
    try { sols = zerosPolesTimed(rangeF(k, T), paneL.box(), { target: w, max: PICK_SEARCH_MAX }, ms); } catch (e) { sols = null; }
    const zs = (sols || []).filter((r) => r && r.z && CX.isFin(r.z) && r.kind !== 'pole').map((r) => ({ z: r.z, mult: r.mult || 1 }));
    return { w, zs, more: !sols || !!(sols.truncated || sols.incomplete) };
  }
  // the twins of z₀ on plane k over plane T: {w, zs, more} (pickFibre's of F(z₀), its search at most ms), or null where
  // F(z₀) is not finite
  function pickTwins(k, T, z0, ms = PICK_SEARCH_MS) {
    const t = pickFibre(k, T, rangeF(k, T)(z0), ms);
    if (!t) return null;
    // (the pressed point is one of them, whatever the search found)
    if (!t.zs.some((r) => CX.abs(CX.sub(r.z, z0)) <= 1e-6 * (1 + CX.abs(z0)))) t.zs.push({ z: z0, mult: 1 });
    return t;
  }
  // lights the twins of z₀ (its search at most ms) and, with say, says how many there are in the steps view's live region
  function pickLight(k, T, z0, ms = PICK_SEARCH_MS, say = true) {
    const t = pickTwins(k, T, z0, ms);
    floorPick = t ? Object.assign({ sig: pickSig(), k, T, z0 }, t) : null;
    const live = SV.els && SV.els.live;
    if (live && t && say) {
      const n = t.zs.length, plane = svName(k);
      live.textContent = t.more ? $t('{n} preimages found on {plane}, and there may be more', { n, plane }) : $tn('{n} preimage on {plane}', '{n} preimages on {plane}', n, { n, plane });
    }
    requestRender('OL');
  }
  // the area of a later plane whose pulled-back patch holds z (the last drawn, on top), or null
  function pickPatch(k, z) {
    for (let i = S.shapes.length - 1; i >= 0; i--) {
      const s = S.shapes[i], st = shapeStage(s);
      if (s.visible === false || st <= k || kindType(s) !== 'area') continue;
      const w = rangeF(k, st)(z);
      if (CX.isFin(w) && Region.levelOf(s)(w) > 0) return s;
    }
    return null;
  }
  // a press with the Pick tool at z (x, y in the pane): Look down's ring of the target, then a lit patch, then a line of
  // Look down drags its disc, anywhere else the twins light and a drag draws a disc; true when the press is the picker's.
  // The ring and the lines are drawn in the target's own coordinates at the floor's places, so they drag the target with
  // the pointer (F the identity); a patch drags its area so that the area's point under the pointer stays under it
  function pickDown(pane, z, x, y) {
    if (tool !== 'pick' || !pickAvail()) return false;
    const k = leftStage(), patch = !lookHit(x, y, false) && pickPatch(k, z), s = patch || lookHit(x, y);
    if (s) {
      const F = patch ? rangeF(k, shapeStage(s)) : (w) => w;
      selected = s.id; zpSel = null; buildShapeList();
      drag = { mode: 'pickMove', shape: s, F, w: F(z), x0: x, y0: y, moved: false };
    } else {
      const T = svT(), F = rangeF(k, T), w0 = F(z);
      if (!CX.isFin(w0)) return true;
      pickLight(k, T, z);
      drag = { mode: 'pickOut', T, F, w0, x0: x, y0: y, disc: null, moved: false };
    }
    setCursor(pane, 'L');
    return true;
  }
  // the pointer at (x, y) of the pane while a press of the picker is held (d.level: on the Stack, the level it holds)
  function pickMove(d, pane, x, y) {
    if (!d.moved && Math.hypot(x - d.x0, y - d.y0) < PICK_SLOP) return;
    d.moved = true;
    pane.setView(leftView());
    const p = d.level ? stackPickAt(pane, d.level, x, y) : pane.s2w(x, y), w = p && d.F(p);
    if (!w || !CX.isFin(w)) return;
    if (d.mode === 'pickMove') { Region.translate(d.shape, CX.sub(w, d.w)); d.w = w; }
    else if (!d.disc) {
      // (the disc is in the chain's shapes while it is drawn, so its patches show; it is added as one edit on release)
      d.disc = newShape('disc', { c: [d.w0.re, d.w0.im], r: CX.abs(CX.sub(w, d.w0)), stage: d.T });
      pushShape(d.disc);
      if (SV.sig != null) SV.sig = svSigNow();
    } else d.disc.r = CX.abs(CX.sub(w, d.w0));
    shapesChanged(false);
    requestRender('L', 'OL');
  }
  // the press of the picker lifted: a dragged area is one edit, a drawn disc one added shape
  function pickUp(d) {
    if (!d.moved) return;
    if (d.mode === 'pickOut' && d.disc) {
      setShapes(S.shapes.filter((s) => s !== d.disc));
      if (!(d.disc.r > 0)) { shapesChanged(true); return; }
      shapeVia = 'draw';
      addShape(d.disc);
      shapeVia = null;
      return;
    }
    shapesChanged(true);
    commit();
  }
  // the press of the picker ended by a second finger: a disc it was drawing goes, with no edit
  function pickCancel(d) {
    if (!d.disc) return;
    setShapes(S.shapes.filter((s) => s !== d.disc));
    shapesChanged(true);
  }
  // Enter with the Pick tool on the focused plane: the twins of the selected point of the floor, or of the view's centre,
  // then the disc about their image; true when it acted
  function pickKey() {
    if (tool !== 'pick' || !pickAvail()) return false;
    if (landPickOn()) return landPickKey();
    const k = leftStage(), T = svT(), sel = findShape(selected);
    paneL.setView(leftView());
    const b = paneL.box(), z0 = sel && sel.kind === 'point' && shapeStage(sel) === k ? C(sel.p[0], sel.p[1]) : C((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
    const lit = floorPick && floorPick.sig === pickSig() && CX.abs(CX.sub(floorPick.z0, z0)) <= 1e-12 * (1 + CX.abs(z0));
    if (!lit) { pickLight(k, T, z0); return true; }
    const [x, y] = paneL.w2s(z0), r = CX.abs(CX.sub(rangeF(k, T)(paneL.s2w(x + PICK_KEY_PX, y)), floorPick.w));
    if (!(r > 0 && Number.isFinite(r))) return true;
    addShape(newShape('disc', { c: [floorPick.w.re, floorPick.w.im], r, stage: T }));
    svSay($t('Disc added on {w}, about the image of the lit point', { w: svName(T) }));
    return true;
  }
  // the lit twins while they are the chain's and the Pick tool's, else null
  function floorPickNow() {
    if (floorPick && (floorPick.sig !== pickSig() || tool !== 'pick')) floorPick = null;
    return floorPick;
  }
  // the lit twins over the floor: the pressed point a dot, its twins rings (an overlay of the steps view's plane)
  function drawFloorPick(pane) {
    if (!floorPickNow()) return;
    const ctx = pane.octx, b = pane.box(), z0 = floorPick.z0;
    ctx.save();
    for (const { z } of floorPick.zs) {
      if (!inBoxZ(z, b, 0)) continue;
      const [x, y] = pane.w2s(z), own = CX.abs(CX.sub(z, z0)) <= 1e-6 * (1 + CX.abs(z0));
      ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo;
      ctx.beginPath(); ctx.arc(x, y, own ? PICK_DOT : PICK_RING, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.75; ctx.strokeStyle = TH.probe; ctx.fillStyle = TH.probe;
      ctx.beginPath(); ctx.arc(x, y, own ? PICK_DOT : PICK_RING, 0, TAU);
      if (own) ctx.fill(); else ctx.stroke();
    }
    ctx.restore();
  }
  // TEST-HOOK (dropped from the published page by build.py): the lit twins, and the Pick button's state
  window.__cmwPick = () => ({ avail: pickAvail(), shown: !!document.querySelector('.tool[data-tool="pick"]:not(.tool-na)'), tool, lit: floorPick ? { k: floorPick.k, T: floorPick.T, z0: [floorPick.z0.re, floorPick.z0.im], w: [floorPick.w.re, floorPick.w.im], zs: floorPick.zs.map((r) => [r.z.re, r.z.im, r.mult]), more: floorPick.more } : null, live: (SV.els && SV.els.live && SV.els.live.textContent) || '' });
  // TEST-HOOK
