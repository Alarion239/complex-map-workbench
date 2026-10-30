  // ---------------------------------------------------------------- materializing a target as a ref
  // point and handle targets are refs as they are; a crossing becomes a meet point (a helper when a drawing tool made
  // it on its own), a curve a point on the curve. Returns {ref, shapes: [new shapes to create first]}
  // ([v16.5 rail] a target on a display curve makes that curve's fixed shape first, or reuses one: o.made, by key)
  function materialize(t, side, o = {}) {
    if (!t) return null;
    if (t.cls === 'point') return { ref: t.ref, shapes: [] };
    const target = side === 'R', pre = [];
    if (t.cls === 'cross') {
      const def = { op: 'meet', args: t.ref.meet.map((r) => (r.disp ? dispRef(r.disp, side, o.made || {}, pre) : r)) };
      if (t.ref.seed) def.seed = t.ref.seed; else def.index = t.ref.index;
      const p = A.newShape('point', { p: t.z.slice(), def }, target);
      if (o.helper) { p.helper = true; p.owner = o.owner; }
      return { ref: { s: p.id }, shapes: pre.concat([p]) };
    }
    if (t.cls === 'curve') {
      const def = { op: 'glider', args: [t.disp ? dispRef(t.disp, side, o.made || {}, pre) : t.ref] };
      const extra = { p: t.z.slice(), def };
      if (t.seed) def.seed = t.seed; else extra.t = t.t;
      const p = A.newShape('point', extra, target);
      return { ref: { s: p.id }, shapes: pre.concat([p]) };
    }
    return null;
  }

  // ---------------------------------------------------------------- the drawing tools: bind at press and release
  // the handle keys a tool's press and release write (SPEC 4.2)
  const START = { segment: 'a', line: 'a', ray: 'a', halfplane: 'a', rect: 'a', arc: 'a', circle: 'c', disc: 'c', annulus: 'c', sector: 'c' };
  const END = { segment: 'b', line: 'b', ray: 'b', halfplane: 'b', rect: 'b', arc: 'b', circle: 'r', disc: 'r' };
  // editDown's draw start: the snapped start point (a complex) or null; the target is kept for the release
  function drawStart(pane, side, tool, x, y) {
    gestSnap = null;
    if (!START[tool]) return null;
    const cl = classesFor(tool, 'draw');
    const t = cl ? snapAt(side, x, y, cl) : null;
    gestSnap = { start: t, end: null, side };
    setRing(side, t);
    return t ? { re: t.z[0], im: t.z[1] } : null;
  }
  // onMove 'draw': the snapped end (a complex) or null
  function drawMove(pane, side, tool, x, y) {
    if (!gestSnap || !END[tool]) { if (ring) setRing(side, null); return null; }
    const cl = classesFor(tool, 'draw');
    const t = cl ? snapAt(side, x, y, cl) : null;
    gestSnap.end = t;
    setRing(side, t);
    return t ? { re: t.z[0], im: t.z[1] } : null;
  }
  // onUp 'draw', before addShape(s): bind the snapped ends; the helpers are pushed into the list first (one undo step)
  function drawEnd(s, target) {
    const g = gestSnap;
    gestSnap = null;
    setRing(null, null);
    if (!g || !s) return;
    const list = target ? S().targets : S().shapes;
    const at = {};
    const put = (key, t) => {
      if (!key || !t) return;
      const m = materialize(t, target ? 'R' : 'L', { helper: true, owner: s.id });
      if (!m) return;
      for (const x of m.shapes) list.push(x);
      at[key] = m.ref;
    };
    put(START[s.kind === 'polygon' ? '' : s.kind], g.start);
    put(END[s.kind], g.end);
    if (Object.keys(at).length) s.at = at;
  }
  // the Polygon tool: each vertex snaps and binds (SPEC 4.2); the draft keeps the targets by vertex index
  function vertexPick(d, side, x, y) {
    const cl = classesFor('polygon', 'draw');
    const t = cl ? snapAt(side, x, y, cl) : null;
    if (!t) return null;
    (d.cmAt || (d.cmAt = {}))[d.pts.length] = t;
    return { re: t.z[0], im: t.z[1] };
  }
  function bindVertices(pg, cmAt, target) {
    const list = target ? S().targets : S().shapes, at = {};
    for (const [i, t] of Object.entries(cmAt)) {
      if (+i >= pg.pts.length) continue;
      const m = materialize(t, target ? 'R' : 'L', { helper: true, owner: pg.id });
      if (!m) continue;
      for (const x of m.shapes) list.push(x);
      at['v' + i] = m.ref;
    }
    if (Object.keys(at).length) pg.at = at;
  }
  // the Point tool's press (SPEC 4.2): true when it did something other than a free point
  function pointDown(pane, side, x, y) {
    const cl = classesFor('point', 'draw');
    if (!cl) return false;
    const t = snapAt(side, x, y, cl);
    if (!t || t.cls === 'grid') return false;   // ([v16.5 rail] a lattice point: the app's snapZ, the same point)
    const target = side === 'R';
    if (t.cls === 'point' && t.ref.s && !t.ref.h) {
      // [review user-14] never silent: the chip says the point is already there (Alt, or Snap off, places a new one)
      A.select(t.ref.s);
      setRing(side, t, $t('{x} is already here', { x: refName(t.ref) }));
      // (touch has no Alt: the escape is the Snap switch of the tools sheet, said once a session, [v16.5 fix rail-6] at the
      // release of a tap that did not move: a drag from here moves the point, it never asks for another; moveUp says it)
      return 'existing';   // ([v16.5 rail SPEC 6] the app lets a drag from here move it: slide it on its curve, or pull it off)
    }
    if (t.cls === 'point' && typeof t.ref.zp === 'string') return false;   // (onDown already dragged the zero)
    if (t.cls === 'point') {
      const p = A.newShape('point', { p: t.z.slice(), at: { p: t.ref } }, target);
      api.cm.create([p], { target });
      return true;
    }
    const m = materialize(t, side, {});
    if (!m) return false;
    api.cm.create(m.shapes, { target });
    A.tourEmit('construct-added', { op: t.cls === 'cross' ? 'meet' : 'glider' });
    return true;
  }
  pointDown.told = false;   // (the Snap-off tip, once a session: moveUp)

  // ---------------------------------------------------------------- dragging handles onto targets, built things
  function handleMove(d, side, x, y) {
    const s = d.shape;
    // ([v16.5 rail SPEC 1.2] a selected free point dragged by its handle: the free point's drag, from the point itself)
    if (s && s.kind === 'point' && d.key === 'p' && !s.def && !s.at) {
      if (!d.fd) d.fd = { p0: s.p.slice(), z0: s.p.slice(), ex: null };
      const pane = A.setView(side);
      freeDrag(d, pane, side, x, y);
      return { re: s.p[0], im: s.p[1] };
    }
    // (a free point never merges onto a point [C22])
    if (!s || s.kind === 'point' || (!POS.test(d.key) && !/^r[12]?$/.test(d.key))) return null;
    const cl = classesFor('select', 'handle');
    if (!cl) { if (ring) setRing(side, null); d.snapT = null; return null; }
    let ex;
    try { ex = graph().excluded(s.id, d.key); } catch (e) { ex = new Set(); }
    ex.add(s.id);
    const t = snapAt(side, x, y, Object.assign({}, cl, { exclude: ex }));
    d.snapT = t;
    setRing(side, t);
    return t ? { re: t.z[0], im: t.z[1] } : null;
  }
  // a press on a bound handle of the selected shape goes to what is beneath (SPEC 4.3): a point shape (it moves), or
  // another shape's handle (it drags); a zero is taken by the press first (zpHit). {shape, key?} | null
  function boundUnder(sel, pane, x, y) {
    if (!sel || !sel.at) return null;
    for (const [k, hz] of Region.handlesOf(sel)) {
      const r = sel.at[k];
      if (!r) continue;
      const [hx, hy] = pane.w2s(hz);
      if (Math.abs(hx - x) >= 8 || Math.abs(hy - y) >= 8) continue;
      const t = r.s ? find(r.s) : null;
      if (!t) continue;
      if (!r.h && t.kind === 'point') return { shape: t };
      if (r.h && !t.def && !(t.at && t.at[r.h])) return { shape: t, key: r.h };
    }
    return null;
  }
  // onUp 'handle': bind the dropped handle (the helpers first)
  function handleUp(d) {
    if (d && d.fd) { freeUp(d); setRing(null, null); return; }   // ([v16.5 rail] a free point's drop)
    const t = d.snapT;
    setRing(null, null);
    if (!t || !d.moved || !d.shape) return;
    const s = d.shape, target = !!d.target, list = target ? S().targets : S().shapes;
    const m = materialize(t, target ? 'R' : 'L', { helper: true, owner: s.id });
    if (!m) return;
    for (const x of m.shapes) list.splice(list.indexOf(s), 0, x);
    (s.at || (s.at = {}))[d.key] = m.ref;
  }
  // onMove 'move' (a shape dragged by its body). True when this took the gesture: a point on a curve slides along it,
  // a fixed constructed point stays and says why, a shape built on free points moves them, other built shapes pan
  function moveDrag(d, pane, side, x, y) {
    const s = d.shape;
    // [v16.3 review user-1] the unit circle or an axis made a shape for a construction stays put: the press pans
    if (s && fixedName(s)) {
      if (!d.cmWarned) { d.cmWarned = true; lastToast = A.toast($t('This is {x}: it stays fixed. To move it, choose Make free in ⋯.', { x: fixedRef(s) })); }
      d.cm = 'pan';
      return 'pan';
    }
    // [v16.5 rail SPEC 1.2] a free point (or one pulled off its rail in this gesture) drags with snapping and attaches at
    // the drop; any other free shape moved by its body snaps its anchor
    if (s && d.cm !== 'pan' && (d.cmFree || (s.kind === 'point' && !s.def && !s.at))) return freeDrag(d, pane, side, x, y);
    if (s && d.cm !== 'pan' && !s.def && !s.at) return anchorMove(d, pane, side, x, y);
    if (!s || !(s.def || s.at)) return false;
    const z = pane.s2w(x, y), Z = [z.re, z.im];
    if (d.cm === 'pan') return false;
    // [v16.5 rail SPEC 2] a point on a curve slides on it, and a pull frees it
    if (s.def && s.def.op === 'glider') return railDrag(d, pane, side, Z);
    // [v16.5 rail SPEC 2.4] a meet point (a crossing the Point tool or a snap made, Intersect's): its rail is one place
    if (s.kind === 'point' && s.def && s.def.op === 'meet') return railDrag(d, pane, side, Z);
    if (s.kind === 'point' && s.def) {
      // the reason by the point being dragged, where the user is looking
      if (!d.cmWarned) { d.cmWarned = true; pointChip(side, s.id, $t('{x} is built from {y}: drag those', { x: shapeLabel(s), y: rootsText(s) })); }
      return true;
    }
    let roots = null;
    try { roots = Constr.moveRoots(S(), s.id); } catch (e) { roots = null; }
    if (roots && roots.length) {
      const dz = { re: z.re - d.z0.re, im: z.im - d.z0.im };
      if (!d.moved && Math.hypot(dz.re, dz.im) * pane.view.s < 3) return true;
      for (const id of roots) { const p = find(id); if (p && isXY(p.p)) p.p = [p.p[0] + dz.re, p.p[1] + dz.im]; }
      d.z0 = z; d.moved = true;
      if (d.target) A.targetsChanged(false); else A.shapesChanged(false);
      return true;
    }
    // built on a zero, a handle of another shape or a curve: the press pans X; the chip once per session
    d.cm = 'pan';
    if (!moveChipShown) {
      moveChipShown = true;
      pointChip(side, s.id, $t('Built on {x}: drag those, or Make free', { x: rootsText(s) || shapeLabel(s) }), [d.z0.re, d.z0.im]);
    }
    return 'pan';
  }

  // ---------------------------------------------------------------- [v16.5 rail] sliding, pulling off, attaching
  // the state at the press, kept for Esc and a second finger (2.6): the app's last undo step is that state, so a cancel
  // restores it; a gesture that changed nothing makes no step
  function railDrag(d, pane, side, Z) {
    const s = d.shape, touch = touchNow(), sc = pane.view.s, now = performance.now();
    d.cmPress = true;
    // (a number moves it: it never slides or comes off)
    if (s.bind && s.bind.t) {
      if (!d.cmWarned) { d.cmWarned = true; setRing(side, { cls: 'rail', z: s.p, chip: $t('{x} follows {a}: change {a}', { x: pointName(s), a: s.bind.t }) }, null); }
      return true;
    }
    const meet = s.def.op === 'meet';
    let e = null, pc = null, p3 = null, pr = null;
    if (meet) { if (isXY(s.p)) pr = { z: s.p.slice() }; }
    else {
      e = find(s.def.args[0].s);
      pc = e && piecesOf(e)[s.def.args[0].part];
      if (!pc) return true;
      p3 = pc.c3 ? pts3Of(e, isT(s) ? 1 : 0) : null;
      try { pr = Constr.projectPiece(pc, Z, p3); } catch (er) { pr = null; }
    }
    if (!pr || !isXY(pr.z)) return true;
    // the pull: the pointer's distance from the rail, in px (Alt frees at once)
    const dist = Math.hypot(pr.z[0] - Z[0], pr.z[1] - Z[1]) * sc;
    const pull = altNow() ? { zone: 'free', state: null } : Constr.railPull(d.cmPull, dist, now, touch);
    d.cmPull = pull.state;
    // (a pull held still: the dwell ends without another pointer event, so a timer looks again then)
    clearTimeout(d.cmDwellT);
    if (pull.state) d.cmDwellT = setTimeout(() => { if (A.drag() === d && !d.cmFree) { A.setView(side); railDrag(d, pane, side, Z); } }, Math.max(0, Constr.RAIL.dwell - (now - pull.state.since)) + 8);
    if (pull.zone === 'free') { letGo(d, side, Z); return freeDrag(d, pane, side, null, null, Z); }
    const Rr = touch ? Constr.RAIL.touch : Constr.RAIL.mouse;
    const k = pull.zone === 'stretch' ? 0.35 + 0.65 * Math.max(0, Math.min(1, (dist - Rr.glide) / (Rr.free - Rr.glide))) : 0;
    const nm = pointName(s);
    if (meet) {
      rail = { side, pc: null, ink: null, stretch: pull.zone === 'stretch' ? { a: pr.z, b: Z, k } : null };
      setRing(side, pull.zone === 'stretch' ? { cls: 'rail', z: pr.z, chip: $t('Pull further to free {x}', { x: nm }) } : null, null);
      A.requestRender('OL', 'OR');
      return true;
    }
    const tg = { cls: 'curve', ref: s.def.args[0], z: pr.z.slice(), t: pr.t, seed: pr.seed, pc };
    if (A.snapOn() && !altNow()) { let ex = null; try { ex = graph().excluded(s.id); } catch (er) { ex = null; } const dt = detentAt(side, tg, touch, ex, e, { self: s.id }); if (dt) Object.assign(tg, dt); }
    // (a detent caught: the snap tick, the separate switch, off by default [4.4])
    if (tg.dAt && tg.dAt !== d.cmDet && A.snapTick) A.snapTick();
    d.cmDet = tg.dAt || null;
    rail = { side, pc, ink: A.shapeInk(e).edge, stretch: pull.zone === 'stretch' ? { a: tg.z, b: Z, k } : null };
    const cn = fixedRef(e) || curveName(s.def.args[0]);
    setRing(side, { cls: 'rail', z: tg.z, chip: pull.zone === 'stretch' ? $t('Pull further to free {x}', { x: nm }) : tg.dAt ? $t('on {c} at {a}', { c: cn, a: tg.dAt }) : $t('on {x}', { x: cn }) }, null);
    // [v16.3 review user-4] the recompute waits for the frame, as a free point's drag: the handler keeps the last
    // target, the frame applies it once (moveUp applies one still pending at the release)
    d.cmPend = tg.seed ? { seed: tg.seed } : { t: tg.t }; d.moved = true; d.cmLive = true;
    if (!d.cmRaf) d.cmRaf = requestAnimationFrame(() => glideFlush(d));
    A.requestRender('OL', 'OR');
    return true;
  }
  // the pull let go (2.4): the point keeps its id, name, colour and dependents, loses its definition (live: the gesture's
  // one undo step comes at the release) and jumps to the pointer; "z₂ is free" by it for 1.2 s, the sound detach
  function letGo(d, side, Z) {
    const s = d.shape;
    clearTimeout(d.cmDwellT);
    if (d.cmRaf) { cancelAnimationFrame(d.cmRaf); d.cmRaf = 0; }
    d.cmPend = null; d.cmPull = null;
    rail = null;
    api.cm.makeFree(s.id, { live: true });
    s.p = Z.slice();
    d.cmFree = true; d.moved = true;
    d.fd = { p0: Z.slice(), z0: Z.slice(), ex: null };
    if (!d.cmGlobe) pointChip(side, s.id, $t('{x} is free', { x: pointName(s) }));
    A.cue('detach');
  }
  // a chip by a point for 1.2 s ("z₂ is free", "m is built from z₀, z₁: drag those"); at Z (world) when the shape is
  // not a point: there the pressed spot, which a pan keeps under the pointer
  function pointChip(side, id, text, Z) {
    const until = performance.now() + 1200;
    freeChip = { side, id, text, until, Z: Z || null };
    A.requestRender('OL', 'OR');
    setTimeout(() => { if (freeChip && freeChip.until === until) { freeChip = null; A.requestRender('OL', 'OR'); } }, 1250);
  }
  // a free point's drag (1.2): onto a crossing, a curve (a display curve too), a zero or a handle, or the grid; a point
  // shape there gets the warn ring and no snap (no merging, C22). What is drawn is where it lands. Alt or Snap off: raw
  function freeDrag(d, pane, side, x, y, Zp) {
    const s = d.shape;
    const z = Zp ? null : pane.s2w(x, y), Z = Zp || [z.re, z.im], sc = pane.view.s;
    d.cmPress = true;
    if (!d.fd) d.fd = { p0: s.p.slice(), z0: [d.z0.re, d.z0.im], ex: null };
    if (!d.fd.ex) { let ex; try { ex = graph().excluded(s.id); } catch (er) { ex = new Set(); } ex.add(s.id); d.fd.ex = ex; }
    if (!d.moved && Math.hypot(Z[0] - d.fd.z0[0], Z[1] - d.fd.z0[1]) * sc < 3) return true;
    const want = [d.fd.p0[0] + Z[0] - d.fd.z0[0], d.fd.p0[1] + Z[1] - d.fd.z0[1]];
    let p = want, t = null;
    if (A.snapOn() && !altNow()) {
      const [wx, wy] = pane.w2sxy(want[0], want[1]);
      t = snapAt(side, wx, wy, { points: true, cross: true, curves: true, disp: true, grid: true, exclude: d.fd.ex, pend: false, self: s.id });
      if (t && t.cls === 'point' && t.ref && (t.ref.img || Number.isInteger(t.ref.pend))) t = null;
      if (t && t.cls === 'point' && t.ref.s && !t.ref.h) {
        // (raw: never onto the same lattice point as the point already there)
        setRing(side, t, $t('{x} is already here', { x: refName(t.ref) }));
        p = want; t = null;
      } else { if (t) p = t.z; setRing(side, t); }
    } else if (ring) setRing(side, null);
    d.fdT = t;
    s.p = p.slice(); d.moved = true;
    if (isT(s)) A.targetsChanged(false); else A.shapesChanged(false);
    return true;
  }
  // the drop of a free point (2.5): on a crossing it becomes that meet point, on a curve a point on it (a display curve's
  // shape made first), on a zero or a handle it binds; one undo step with the drag (live: the app commits at the release)
  function freeUp(d) {
    const t = d.fdT, s = d.shape;
    d.fdT = null;
    if (!t || !s || !d.moved || altNow() || !A.snapOn() || !find(s.id) || t.cls === 'grid') return;
    const side = isT(s) ? 'R' : 'L', list = isT(s) ? S().targets : S().shapes;
    if (t.cls === 'point') { if (t.ref && !t.ref.img && !(t.ref.s && !t.ref.h)) { api.cm.bind(s.id, 'p', t.ref, { live: true }); A.cue('attach'); } return; }
    const pre = [];
    let def = null;
    if (t.cls === 'cross') { def = { op: 'meet', args: t.ref.meet.map((r) => (r.disp ? dispRef(r.disp, side, null, pre) : r)) }; if (t.ref.seed) def.seed = t.ref.seed; else def.index = t.ref.index; }
    else if (t.cls === 'curve') def = { op: 'glider', args: [t.disp ? dispRef(t.disp, side, null, pre) : t.ref] };
    if (!def) return;
    for (const c of pre) list.splice(list.indexOf(s), 0, c);
    const patch = { def, live: true };
    if (t.cls === 'curve') { if (t.seed) patch.seed = t.seed; else patch.t = t.t; }
    if (api.cm.setDef(s.id, patch) === false) { for (const c of pre) { const i = list.indexOf(c); if (i >= 0) list.splice(i, 1); } return; }
    A.cue('attach');
  }
  // a free shape moved by its body (UX94, 1.2): its anchor, the position handle nearest the press, snaps to points,
  // crossings and the grid ("the corner you grabbed lands on 1 + i"); a move never binds
  function anchorMove(d, pane, side, x, y) {
    const s = d.shape, z = pane.s2w(x, y), Z = [z.re, z.im], sc = pane.view.s;
    d.cmPress = true;
    if (!d.am) {
      let best = null, bd = Infinity;
      try { for (const [k, hz] of Region.handlesOf(s)) { if (!POS.test(k)) continue; const dd = Math.hypot(hz.re - d.z0.re, hz.im - d.z0.im); if (dd < bd) { bd = dd; best = k; } } } catch (er) { best = null; }
      let ex; try { ex = graph().excluded(s.id); } catch (er) { ex = new Set(); } ex.add(s.id);
      d.am = { key: best, z0: [d.z0.re, d.z0.im], ex };
    }
    if (!d.moved && Math.hypot(Z[0] - d.am.z0[0], Z[1] - d.am.z0[1]) * sc < 3) return true;
    const cur = d.am.key ? (Region.handlesOf(s).find((h) => h[0] === d.am.key) || [])[1] : null;
    if (!cur) {
      // (no anchor: a freehand or formula curve moves by the pointer, raw)
      const prev = d.am.last || d.am.z0;
      Region.translate(s, { re: Z[0] - prev[0], im: Z[1] - prev[1] });
      d.am.last = Z; d.moved = true;
      if (isT(s)) A.targetsChanged(false); else A.shapesChanged(false);
      return true;
    }
    if (!d.am.h0) d.am.h0 = [cur.re, cur.im];
    const want = [d.am.h0[0] + Z[0] - d.am.z0[0], d.am.h0[1] + Z[1] - d.am.z0[1]];
    let p = want;
    if (A.snapOn() && !altNow()) {
      const [wx, wy] = pane.w2sxy(want[0], want[1]);
      const t = snapAt(side, wx, wy, { points: true, cross: true, curves: false, grid: true, exclude: d.am.ex, pend: false });
      if (t && !(t.ref && t.ref.img)) p = t.z;
      setRing(side, t && !(t.ref && t.ref.img) ? t : null);
    } else if (ring) setRing(side, null);
    const dz = { re: p[0] - cur.re, im: p[1] - cur.im };
    if (dz.re || dz.im) Region.translate(s, dz);
    d.moved = true;
    if (isT(s)) A.targetsChanged(false); else A.shapesChanged(false);
    return true;
  }
  // [v16.5 rail SPEC 1.2 (b)] a point on a curve dragged on an editable globe: the globe pick projected onto its piece,
  // the pull measured on the screen (gScreen), the same zones. 'slid' | 'freed' (the drag goes on as a free point's)
  function globeSlide(d, side, g, x, y, gc) {
    const s = d.shape;
    d.cmGlobe = true; d.cmPress = true;
    if (s.bind && s.bind.t) return 'slid';
    const e = find(s.def.args[0].s), pc = e && piecesOf(e)[s.def.args[0].part];
    if (!pc || !g || !g.z) return 'slid';
    const Z = [g.z.re, g.z.im], p3 = pc.c3 ? pts3Of(e, isT(s) ? 1 : 0) : null;
    let pr = null;
    try { pr = Constr.projectPiece(pc, Z, p3); } catch (er) { pr = null; }
    if (!pr || !isXY(pr.z)) return 'slid';
    let q = null;
    try { q = A.gScreen(gc, Region.Globe.lift(pr.z[0], pr.z[1])); } catch (er) { q = null; }
    const dist = q ? Math.hypot(q[0] - x, q[1] - y) : 0;
    const pull = altNow() ? { zone: 'free', state: null } : Constr.railPull(d.cmPull, dist, performance.now(), touchNow());
    d.cmPull = pull.state;
    if (pull.zone === 'free') { letGo(d, side, Z); return 'freed'; }
    d.cmPend = pr.seed ? { seed: pr.seed } : { t: pr.t }; d.cmLive = true;
    if (!d.cmRaf) d.cmRaf = requestAnimationFrame(() => glideFlush(d));
    return 'slid';
  }
  // [v16.5 rail SPEC 1.2 (c)] the Point tool on a drawn curve on an editable globe (6 px, 14 for a finger: `hit` is the
  // app's globeCurveHit): a point on it, the globe pick projected onto the piece nearest on the screen. True when it made
  // one (one undo step). The display curves are the graticule there, not targets
  function globePoint(side, g, x, y, gc, hit) {
    if (!g || !g.z || !gc || !A.snapOn() || altNow()) return false;
    const target = side === 'R', t = globeCurveAt(side, g, x, y, gc, hit);
    if (!t) return false;
    const m = materialize(t, side, {});
    if (!m) return false;
    api.cm.create(m.shapes, { target });
    A.tourEmit('construct-added', { op: 'glider' });
    return true;
  }
  // the drawn curve under a globe press (6 px, 14 for a finger), as a curve target {cls: 'curve', ref, z, t, seed, pc}:
  // the globe pick projected onto the piece nearest on the screen ([v16.5 fix rail-5] globePoint and globeClick)
  function globeCurveAt(side, g, x, y, gc, hit) {
    if (!g || !g.z || !gc || !hit) return null;
    const st = S(), target = side === 'R', list = target ? st.targets : st.shapes, tol = touchNow() ? 14 : 6;
    const Z = [g.z.re, g.z.im];
    let best = null, bd = tol;
    for (const e of list.slice().reverse()) {
      if (e.visible === false || e.kind === 'point' || GRID.has(e.kind) || e.kind === 'formula' || !hit(e, tol)) continue;
      piecesOf(e).forEach((pc, part) => {
        let pr = null, q = null;
        try { pr = Constr.projectPiece(pc, Z, pc.c3 ? pts3Of(e, target ? 1 : 0) : null); } catch (er) { pr = null; }
        if (!pr || !isXY(pr.z)) return;
        try { q = A.gScreen(gc, Region.Globe.lift(pr.z[0], pr.z[1])); } catch (er) { q = null; }
        const dd = q ? Math.hypot(q[0] - x, q[1] - y) : Infinity;
        if (dd <= bd) { bd = dd; best = { e, part, pr, pc }; }
      });
    }
    if (!best) return null;
    return { cls: 'curve', ref: { s: best.e.id, part: best.part }, z: best.pr.z.slice(), t: best.pr.t, seed: best.pr.seed, pc: best.pc };
  }
  // Esc during a drag, or a second finger (2.6): back to the press state, no undo step. True when it cancelled one
  function cancelDrag() {
    const d = A && A.drag ? A.drag() : null;
    if (!d || (d.mode !== 'move' && d.mode !== 'handle') || !d.cmPress) return false;
    if (d.cmRaf) { cancelAnimationFrame(d.cmRaf); d.cmRaf = 0; }
    clearTimeout(d.cmDwellT);
    d.cmPend = null; rail = null; freeChip = null; ring = null;
    A.abortDrag();
    if (d.moved) A.revert();
    A.requestRender('OL', 'OR');
    return true;
  }
  function glideFlush(d) {
    d.cmRaf = 0;
    const pr = d.cmPend, s = d.shape;
    d.cmPend = null;
    if (!pr || !s || !find(s.id)) return;
    if (pr.seed) api.cm.setDef(s.id, { seed: pr.seed, live: true }); else api.cm.setDef(s.id, { t: pr.t, live: true });
  }
  // onUp 'move': a glider's target still waiting for its frame is applied before the gesture's undo step; ([v16.5 rail])
  // a free point's drop attaches it
  function moveUp(d) {
    if (d && d.cmTell && !d.moved && !pointDown.told) { pointDown.told = true; lastToast = A.toast($t('To place a point next to another, turn Snap off in the tools sheet.')); }
    if (d) clearTimeout(d.cmDwellT);
    if (d && d.cmRaf) { cancelAnimationFrame(d.cmRaf); glideFlush(d); }
    if (d && (d.cmFree || d.fd)) freeUp(d);
    if (d && d.cmPress) { rail = null; if (ring) setRing(null, null); A.requestRender('OL', 'OR'); }
  }
  // [review user-13] what can be dragged to change s: its definitions followed down to free points, free handles,
  // zeros and free curves (never a fixed point that would refuse the drag in turn)
  function rootsText(s) {
    let rs = [];
    try { rs = Constr.dragRoots(S(), s.id); } catch (e) { rs = []; }
    if (!rs.length) rs = s.def ? s.def.args : Object.values(s.at || {});
    return [...new Set(rs.map((r) => refName(r)))].join(', ');
  }
  // ---------------------------------------------------------------- the four tools
  // [v16.5 UX52] a pick's refusal is said in the construction chip, in the warning colour, for 2 s (by the pointer, not
  // at the bottom of the window); where no chip is shown, a toast. A tool change clears both
  // (wave 1 merge: the refusals say Tap on a touch screen, Click with a mouse, as the phone piece's UX17 asked of the
  // plane piece's lines; chipTouch() is the chip's own test)
  // ([v16.5 fix rail-7] it goes as soon as a pick is taken, the draft is backed up or cancelled, or Esc; [rail-8] the
  // refusal names the tool in full, warnTool, even where a narrow chip's label is the short one: "3 points needs distinct
  // points" reads as nonsense)
  function pickOk() { if (pickWarnMsg) { pickWarnMsg = null; clearTimeout(pickWarnT); A.requestRender('OL', 'OR'); } }
  const warnTool = (tool) => (toolName(tool) || '').replace(/\u00ad/g, '');
  function pickWarn(msg) {
    if (!chipSide()) { lastToast = A.toast(msg); return; }
    pickWarnMsg = msg;
    clearTimeout(pickWarnT);
    pickWarnT = setTimeout(() => { pickWarnMsg = null; A.requestRender('OL', 'OR'); }, 2000);
    A.requestRender('OL', 'OR');
  }
  function toolDown(pane, side, x, y) {
    // a click makes the pick (onUp, when the press did not move); a drag between picks pans
    return false;
  }
  function pickOf(side, x, y) {
    const tool = A.tool();
    const t = snapAt(side, x, y, { points: true, cross: true, curves: true, disp: true });
    const pane = A.setView(side);
    if (t) return t;
    const z0 = pane.s2w(x, y), z = A.snapOn() && !A.altHeld() ? A.snapZ(pane, z0) : z0;
    return { cls: 'free', z: [z.re, z.im], ref: null, tool };
  }
  // the next pick of a construction tool is the last one (the touch screen shows its preview under the finger while it is
  // down); the perpendicular's and the touching circle's curve is not counted among the picks
  function finalPick(side) {
    const tool = A.tool();
    if (!isCTool(tool) || !draftC || draftC.tool !== tool || draftC.side !== side) return false;
    if (CURVE1.has(tool) && !curve1Ok()) return false;
    return draftC.picks.length === NEED[tool] - 1;
  }
  // a click with a construction tool
  function click(pane, side, x, y) {
    const tool = A.tool();
    if (!isCTool(tool)) return false;
    if (side === 'L' && A.leftStage() > 0) return false;
    if (side === 'R' && !A.targetsEditable()) return false;
    // [v16.3 review user-11] the perpendicular or touching circle's draft (its curve, its points) is not dropped by a
    // click in the other plane that picks no curve there: that click does nothing
    if (draftC && draftC.tool === tool && draftC.side !== side && CURVE1.has(tool) && (draftC.picks.length || curve1Ok()) && !perpCurveAt(side, x, y)) return true;
    if (!draftC || draftC.tool !== tool || draftC.side !== side) draftC = { tool, side, picks: [], curve1: null, hover: null };
    // the perpendicular and the touching circle's first pick: the curve (an exact line or circle, or a shown display
    // curve); it stays picked for the next circle
    if (CURVE1.has(tool) && !curve1Ok()) {
      const c = perpCurveAt(side, x, y);
      if (!c) { pickWarn(chipTouch() ? $t('Tap a line or a circle.') : $t('Click a line or a circle.')); return true; }
      draftC.curve1 = c; draftC.picks = []; pickOk();
      A.requestRender('OL', 'OR');
      return true;
    }
    if (tool === 'touch') {
      const r = touchTargetC(side, x, y), t = r.t;
      if (r.warn) { pickWarn(r.warn); return true; }
      if (r.restart) { draftC.picks = []; draftC.carried = false; draftC.doneK = null; }
      if (t.ref && t.ref.img && !A.yWhole()) { pickWarn($t('Draw in X to use {x}', { x: pointName(find(t.ref.img)) })); return true; }
      draftC.hoverT = null;
      if (t.cls === 'ring') { finishTouch(side, t); return true; }
      draftC.picks.push(t); pickOk();
      if (draftC.picks.length >= NEED.touch) finishTouch(side, null); else A.requestRender('OL', 'OR');
      return true;
    }
    let t = pickOf(side, x, y);
    if (tool === 'meet') {
      if (t.cls === 'cross') { finishMeetCross(t, side); return true; }
      // a pick on a point is not a curve: the curve under it is wanted
      if (t.cls !== 'curve' || !t.ref) { const c = snapAt(side, x, y, { points: false, cross: false, curves: true }); if (!c) { pickWarn(chipTouch() ? $t('Tap a crossing of two curves, or a curve.') : $t('Click a crossing of two curves, or a curve.')); return true; } t = c; }
      if (!draftC.curve1) { draftC.curve1 = t; pickOk(); A.requestRender('OL', 'OR'); return true; }
      if (t.ref.s === draftC.curve1.ref.s && t.ref.part === draftC.curve1.ref.part) return true;
      finishMeetCurves(draftC.curve1, t, side);
      return true;
    }
    // midpoint / bisector: a click on a segment's stroke takes its ends
    if ((tool === 'midpoint' || tool === 'bisector') && !draftC.picks.length && t.cls === 'curve' && t.ref) {
      const s = find(t.ref.s);
      if (s && s.kind === 'segment' && !s.def) {
        draftC.picks = [{ ref: { s: s.id, h: 'a' }, z: s.a.slice() }, { ref: { s: s.id, h: 'b' }, z: s.b.slice() }];
        finish(side);
        return true;
      }
    }
    // a co-argument pick: distinct points only ([v16.5 rail SPEC 3.2] a press on an earlier pick; two places on one curve
    // are two points)
    if (dupPick(t)) {
      pickWarn($t('{x} needs distinct points', { x: warnTool(tool) }));   // ([v16.5 UX52] in the chip, by the pointer)
      setRing(side, t, true);   // ([v16.5 fix rail-7] the chip says it now; the ring only warns, without a second label)
      return true;
    }
    if (t.ref && t.ref.img && !A.yWhole()) { pickWarn($t('Draw in X to use {x}', { x: pointName(find(t.ref.img)) })); return true; }
    draftC.picks.push(t); pickOk();
    if (draftC.picks.length >= NEED[tool]) finish(side); else { A.requestRender('OL', 'OR'); }
    return true;
  }
  const toolName = (id) => ({ circle3: $t('Circle through 3 points'), meet: $t('Intersect'), midpoint: $t('Midpoint'), bisector: $t('Perpendicular bisector'), perp: $t('Perpendicular circle'), touch: $t('Touching circle'), hyper: $t('Hyperbolic line') }[id] || id);
