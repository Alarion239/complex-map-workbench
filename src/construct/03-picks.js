  // ---------------------------------------------------------------- the perpendicular circle's curve (notes/orthogonal-circle/SPEC.md 4)
  // an exact line or circle at the pointer, else the nearest shown display curve within the curve radius: the unit
  // circle when it is on, the real and the imaginary axis (every flat plane draws them). A display curve is kept as
  // make: it becomes a shape when the circle is made (never on hover: newShape uses up an id).
  // {cls: 'curve', ref, z, pc, t} | {cls: 'curve', ref: null, z, label, make, pc} | null
  function perpCurveAt(side, x, y, touch) {
    const t = snapAt(side, x, y, { points: false, cross: false, curves: true, exact: true, touch });
    if (t) return t;
    const pane = A.setView(side), zc = pane.s2w(x, y), Z = [zc.re, zc.im], sc = pane.view.s;
    const lim = radii(touch != null ? touch : touchNow()).c, cands = [];
    if (S().unit) { const r = Math.hypot(Z[0], Z[1]); cands.push({ d: Math.abs(r - 1) * sc, label: FIXREF.unit(), make: { kind: 'circle', c: [0, 0], r: 1, fixed: 'unit' }, z: r > 0 ? [Z[0] / r, Z[1] / r] : [1, 0] }); }
    cands.push({ d: Math.abs(Z[1]) * sc, label: $t('the real axis'), make: { kind: 'line', a: [0, 0], b: [1, 0], fixed: 'real' }, z: [Z[0], 0] });
    cands.push({ d: Math.abs(Z[0]) * sc, label: $t('the imaginary axis'), make: { kind: 'line', a: [0, 0], b: [0, 1], fixed: 'imag' }, z: [0, Z[1]] });
    let best = null;
    for (const c of cands) if (c.d <= lim && (!best || c.d < best.d)) best = c;
    if (!best) return null;
    let pc = null;
    try { pc = Constr.pieces(Object.assign({ id: '', ci: 0, visible: true }, best.make), env())[0] || null; } catch (e) { pc = null; }
    return { cls: 'curve', ref: null, z: best.z, label: best.label, make: best.make, pc };
  }
  // the draft's curve still exists (an undo may have removed it): else the draft drops it
  function curve1Ok() {
    const c = draftC && draftC.curve1;
    if (!c) return false;
    if (c.make || (c.ref && find(c.ref.s))) return true;
    draftC.curve1 = null;
    return false;
  }
  // the piece of the draft's curve
  function curve1Piece(c) {
    if (!c) return null;
    if (c.make) return c.pc || null;
    const s = c.ref && find(c.ref.s);
    return (s && piecesOf(s)[c.ref.part]) || null;
  }
  // the draft curve's name ("Circle 1", "side 2 of Polygon 1", "the unit circle"); (the chip reads it every
  // frame, so it is kept while the curve, the lists' lengths and the language stay)
  let c1Memo = { key: '', name: '' };
  const curve1Name = () => {
    const c = draftC && draftC.curve1;
    if (!c) return '?';
    if (!c.ref) return c.label || '?';
    const key = `${c.ref.s}|${c.ref.part}|${S().shapes.length}|${S().targets.length}|${I18N.lang}`;
    if (c1Memo.key !== key) c1Memo = { key, name: curveName(c.ref) };
    return c1Memo.name;
  };
  // ---------------------------------------------------------------- the touching circle's picks (TANGENT-SPEC.md 4)
  // a target on C by construction (the T test): C's own stroke, a crossing with C, a point on C (CORE's onCurveByRefs,
  // through bound handles). A free point that lies on C by its floats is not on C
  function onC(t) {
    const c = draftC && draftC.curve1;
    if (!t || !c) return false;
    if (t.onMake) return true;
    if (!c.ref) return false;                       // (a display curve: only its own stroke is on it)
    const same = (r) => !!r && r.s === c.ref.s && r.part === c.ref.part;
    if (t.cls === 'curve') return same(t.ref);
    if (t.cls === 'cross') return t.ref.meet.some(same);
    if (t.cls === 'point' && t.ref) { try { return Constr.onCurveByRefs(S(), t.ref, c.ref); } catch (e) { return false; } }
    return false;
  }
  // C's stroke at the pointer, within the curve radius: a point on C (on a display curve: onMake, its ref is set when
  // the curve becomes a shape)
  function strokeOnC(side, x, y) {
    const c = draftC.curve1, pc = curve1Piece(c);
    if (!pc) return null;
    const pane = A.setView(side), zc = pane.s2w(x, y), Z = [zc.re, zc.im];
    if (!(pieceDist(pc, Z) * pane.view.s <= radii(touchNow()).c)) return null;
    let pr = null;
    try { pr = Constr.projectPiece(pc, Z, pc.c3 && c.ref ? pts3Of(find(c.ref.s), side === 'R' ? 1 : 0) : null); } catch (e) { pr = null; }
    if (!pr || !isXY(pr.z)) return null;
    const t = { cls: 'curve', ref: c.ref || null, z: pr.z.slice(), t: pr.t, seed: pr.seed, pc };
    if (!c.ref) Object.assign(t, { onMake: true, label: c.label });
    return t;
  }
  // the name a pick has, or will take when it becomes a point (a new point is the next z_n, or the next target letter)
  function pickName(p, side) {
    if (p && p.cls === 'point' && p.ref) return refName(p.ref);
    const st = S();
    if (side === 'R') return A.targetLabel({}, st.targets.filter((x) => x.kind === 'point').length);
    return A.pointLabel({ num: A.nextPointNum() }, 0, 0);
  }
  // after T: the tangent at T as a line form (C a circle), else null
  function hintForm(T) {
    const pc = curve1Piece(draftC && draftC.curve1);
    if (!pc || pc.kind !== 'circle' || !pc.G || !isXY(T)) return null;
    try { const r = Constr.touchForm(pc.G, T, Constr.INF); return r && r.G ? r.G : null; } catch (e) { return null; }
  }
  // the tangent hint at the pointer, within the point radius: P = ∞. A target, not a snap: Snap off keeps it (it is drawn,
  // so it can be clicked); Alt skips it, to place P near the tangent on purpose
  function hintAt(side, x, y, Tp) {
    if (altNow()) return null;
    const pc = curve1Piece(draftC && draftC.curve1);
    if (!pc || pc.kind !== 'circle' || !pc.G || !isXY(Tp.z)) return null;
    const pane = A.setView(side), zc = pane.s2w(x, y);
    let h = null;
    try { h = Constr.tangentNear(pc.G, Tp.z, [zc.re, zc.im]); } catch (e) { h = null; }
    if (!h || !(h.d * pane.view.s <= radii(touchNow()).p)) return null;
    return { cls: 'hint', ref: { inf: 1 }, z: h.z, G: h.G, label: $t('the tangent at {a}', { a: pickName(Tp, side) }) };
  }
  // the tangent at T in one step, without aiming at the dashed line: the chip's Tangent line and Enter, once T is
  // picked on a circle
  const tangentReady = (side) => !!draftC && draftC.tool === 'touch' && (!side || draftC.side === side) && draftC.picks.length === 1 && draftC.picks[0].role === 'T' && !!hintForm(draftC.picks[0].z);
  function tangentNow() {
    if (!tangentReady()) return false;
    const T = draftC.picks[0];
    draftC.hoverT = null;
    draftC.picks.push({ cls: 'hint', ref: { inf: 1 }, z: T.z.slice(), role: 'P' });
    pickOk();
    finishTouch(draftC.side, null);
    return true;
  }
  // after P: the tangents from P to C (C a circle, P outside it), each with its touching point on C's piece
  function ringsOf(P) {
    const pc = curve1Piece(draftC && draftC.curve1);
    if (!pc || pc.kind !== 'circle' || !pc.G || !isXY(P)) return [];
    const out = [];
    for (const k of [0, 1]) {
      let r = null;
      try { r = Constr.tangentForm(pc.G, P, k); } catch (e) { r = null; }
      if (r && r.G && isXY(r.tp) && Constr.onPiece(pc, r.tp)) out.push({ k, G: r.G, tp: r.tp });
    }
    return out;
  }
  // the rings still offered: after a ring's tangent is made, P stays picked with the other ring [v16.3 review user-5]
  const ringsLeft = (P) => ringsOf(P).filter((r) => !(draftC && draftC.doneK && draftC.doneK.includes(r.k)));
  // a ring at the pointer, within the point radius: the tangent from P with index k
  function ringAt(side, x, y, Pp) {
    const pane = A.setView(side);
    let best = null, bd = radii(touchNow()).p;
    for (const r of ringsLeft(Pp.z)) { const [sx, sy] = pane.w2sxy(r.tp[0], r.tp[1]), dd = Math.hypot(sx - x, sy - y); if (dd < bd) { bd = dd; best = r; } }
    return best ? { cls: 'ring', ref: null, z: best.tp.slice(), k: best.k, G: best.G, label: $t('a tangent from {p}', { p: pickName(Pp, side) }) } : null;
  }
  // what a click at (x, y) takes now: {t} (t.role 'T' or 'P'; a hint, a ring) or {t?, warn} (the toast it gives, the
  // target it refuses). First X: T when it is on C, else P. After T: points and crossings, the tangent hint, strokes, a
  // free point; on C is refused. After P: a ring, a point or crossing on C, C's stroke; anything else is refused
  function touchTarget(side, x, y) {
    const d = draftC, P0 = d.picks[0], c1 = d.curve1;
    const pane = A.setView(side), zc = pane.s2w(x, y), Z = [zc.re, zc.im];
    const dup = dupPick;   // ([v16.5 rail SPEC 3.2])
    const distinct = () => $t('{x} needs distinct points', { x: toolName('touch') });
    // (a display curve is no shape yet: its stroke is looked for beside the snap targets, the nearer stroke wins)
    const withMake = (t) => {
      if (!c1.make || !(t.cls === 'free' || t.cls === 'curve')) return t;
      const c = strokeOnC(side, x, y);
      // ([v16.5 rail] C's own stroke wins over another display curve under it: at 1, the unit circle over the real axis)
      return c && (t.cls === 'free' || t.disp || pieceDist(c.pc, Z) <= pieceDist(t.pc, Z)) ? c : t;
    };
    if (!P0) { const t = withMake(pickOf(side, x, y)); return { t: Object.assign({}, t, { role: onC(t) ? 'T' : 'P' }) }; }
    if (P0.role === 'T') {
      const t = snapAt(side, x, y, { points: true, cross: true, curves: false }) || hintAt(side, x, y, P0) || withMake(pickOf(side, x, y));
      if (dup(t)) return { t, warn: distinct() };
      if (t.cls !== 'hint' && onC(t)) return { t, warn: chipTouch() ? $t('Tap a point off {c}.', { c: curve1Name() }) : $t('Click a point off {c}.', { c: curve1Name() }) };
      return { t: Object.assign({}, t, { role: 'P' }) };
    }
    const rg = ringAt(side, x, y, P0);
    if (rg) return { t: rg };
    const t = snapAt(side, x, y, { points: true, cross: true, curves: false });
    if (dup(t)) return { t, warn: distinct() };
    if (t && onC(t)) return { t: Object.assign({}, t, { role: 'T' }) };
    const c = strokeOnC(side, x, y);
    if (c) return { t: Object.assign(c, { role: 'T' }) };
    return { t, warn: chipTouch() ? $t('Tap a point on {c}.', { c: curve1Name() }) : $t('Click a point on {c}.', { c: curve1Name() }) };
  }
  // [v16.3 review user-5] after a ring's tangent, P stays picked (carried): a click it would refuse starts the next circle
  // instead, as a first pick ({t, restart: true})
  function touchTargetC(side, x, y) {
    const r = touchTarget(side, x, y);
    if (!r.warn || !draftC.carried || draftC.picks.length !== 1) return r;
    const keep = draftC.picks;
    draftC.picks = [];
    let r2;
    try { r2 = touchTarget(side, x, y); } finally { draftC.picks = keep; }
    return Object.assign(r2, { restart: true });
  }
  // the touching circle (or, from a ring, the tangent and its touching point): the new points first, then K, one undo
  // step; a display curve becomes a shape first, and K takes the colour after it. The curve stays picked
  function finishTouch(side, ring) {
    const d = draftC, target = side === 'R', c1 = d.curve1, pc = curve1Piece(c1);
    const pre = [], shapes = [], out = [];
    let cref = c1.ref;
    if (c1.make) { const C = A.newShape(c1.make.kind, JSON.parse(JSON.stringify(c1.make)), target); pre.push(C); cref = { s: C.id, part: 0 }; }
    const refOf = (p) => {
      if (p.cls === 'hint') return { inf: 1 };
      if (p.cls === 'free') { const q = A.newShape('point', { p: p.z.slice() }, target); shapes.push(q); return { s: q.id }; }
      const m = materialize(p.onMake ? Object.assign({}, p, { ref: cref }) : p, side, { made: c1.make && pre[0] ? { [c1.make.fixed]: pre[0] } : {} });
      shapes.push(...m.shapes);
      return m.ref;
    };
    const Tp = d.picks.find((p) => p.role === 'T');
    let Pp = d.picks.find((p) => p.role === 'P'), s, pRef = null;
    // P on the tangent at T (within TAN_EPS px): the touching circle is that tangent, touch(C, T, ∞), not a circle of
    // radius ~10¹⁶
    if (!ring && Pp && Pp.cls !== 'hint' && pc && pc.kind === 'circle' && pc.G && isXY(Tp.z) && isXY(Pp.z)) {
      let h = null;
      try { h = Constr.tangentNear(pc.G, Tp.z, Pp.z); } catch (e) { h = null; }
      if (h && h.d * A.setView(side).view.s <= TAN_EPS) Pp = { cls: 'hint', ref: { inf: 1 }, z: h.z, role: 'P' };
    }
    if (ring) {
      let g = null;
      try { g = Constr.shapeOf(ring.G); } catch (e) { g = null; }
      pRef = refOf(Pp);
      s = A.newShape('line', Object.assign(g && g.kind === 'line' ? { a: g.a, b: g.b } : { a: Pp.z.slice(), b: ring.z.slice() }, { def: { op: 'tangent', args: [cref, pRef], index: ring.k, fill: 'none' } }), target);
      out.push(s, A.newShape('point', { p: ring.z.slice(), def: { op: 'meet', args: [{ s: s.id, part: 0 }, cref], index: 0 } }, target));
    } else {
      const tr = refOf(Tp), pr = refOf(Pp);
      let g = null;
      try { const r = pc && pc.G ? Constr.touchForm(pc.G, Tp.z, pr.inf ? Constr.INF : Pp.z) : null; g = r && r.G ? Constr.shapeOf(r.G) : null; } catch (e) { g = null; }
      const base = g ? (g.kind === 'line' ? { a: g.a, b: g.b } : { c: g.c, r: g.r }) : { c: Tp.z.slice(), r: 1 };
      s = A.newShape(g ? g.kind : 'circle', Object.assign(base, { def: { op: 'touch', args: [cref, tr, pr], fill: 'none', nk: g && g.kind === 'line' ? 'line' : 'circle' } }), target);
      out.push(s);
    }
    if (pre.length) s.ci = A.nextCi(target, 1);
    draftC = null;
    holdRing();
    api.cm.create(pre.concat(shapes, out), { target });
    draftC = { tool: 'touch', side, picks: [], curve1: { cls: 'curve', ref: cref, z: c1.z }, hover: null, keptC: true };
    // (a ring: P stays picked, with the other ring still offered; the second tangent is one click [v16.3 review user-5])
    if (ring && pRef && find(pRef.s)) Object.assign(draftC, { picks: [{ cls: 'point', ref: pRef, z: Pp.z.slice(), role: 'P' }], carried: true, doneK: (d.doneK || []).concat([ring.k]) });
    A.requestRender('OL', 'OR');
    A.tourEmit('construct-added', { op: ring ? 'tangent' : 'touch' });
  }
  // the picks as refs (new free points, meet points and points on curves made in the same undo step)
  function refsOfPicks(side, made) {
    const shapes = [], refs = [];
    const target = side === 'R';
    for (const p of draftC.picks) {
      if (p.cls === 'free') { const s = A.newShape('point', { p: p.z.slice() }, target); shapes.push(s); refs.push({ s: s.id }); continue; }
      const m = materialize(p, side, { made });
      shapes.push(...m.shapes); refs.push(m.ref);
    }
    return { shapes, refs };
  }
  function finish(side) {
    const d = draftC, tool = d.tool, target = side === 'R';
    // ([v16.5 rail] a display curve picked as C becomes one shape, made first: the picks on it are points on it)
    const made = {};
    if (CURVE1.has(tool) && d.curve1 && d.curve1.make) made[d.curve1.make.fixed] = A.newShape(d.curve1.make.kind, JSON.parse(JSON.stringify(d.curve1.make)), target);
    const { shapes, refs } = refsOfPicks(side, made);
    const P = d.picks.map((p) => p.z);
    const pre = [];
    let s, next = null;
    if (tool === 'circle3') {
      let G = null;
      try { G = Constr.circle3(P[0], P[1], P[2]); } catch (e) { G = null; }
      const g = G ? Constr.geomOf(G) : null;
      const fin = P.find(isXY) || [0, 0];
      const base = g && !g.line ? { c: g.c, r: g.r } : { c: fin.slice(), r: 1 };
      s = A.newShape(fillMode === 'in' ? 'disc' : 'circle', Object.assign(base, { def: { op: 'circle3', args: refs, fill: fillMode } }), target);
    } else if (tool === 'perp' || tool === 'hyper') {
      // K's starting fields (recompute sets them exactly); a display curve becomes a shape first, in the same undo step,
      // and K then takes the next colour
      const c1 = d.curve1, pc = curve1Piece(c1);
      let cref = c1.ref;
      if (c1.make) { const C = made[c1.make.fixed] || A.newShape(c1.make.kind, JSON.parse(JSON.stringify(c1.make)), target); pre.push(C); cref = { s: C.id, part: 0 }; }
      let g = null;
      try { const r = pc && pc.G && isXY(P[0]) && isXY(P[1]) ? Constr.perpForm(pc.G, P[0], P[1], pc) : null; g = r && r.G ? Constr.shapeOf(r.G) : null; } catch (e) { g = null; }
      const base = g ? (g.kind === 'line' ? { a: g.a, b: g.b } : { c: g.c, r: g.r }) : { c: (P.find(isXY) || [0, 0]).slice(), r: 1 };
      // [v16.4 segments] the chip on Inside: the arc on the side SPEC 2.2 chooses, named as an Arc
      // ([v16.5 UX55] the Hyperbolic line tool is always Inside; Outside is the other side; the result is a Hyperbolic line)
      let seg = 0;
      const sm = effSeg(tool);
      // ([issue #70] Between z0 and z1: def.between, the segment from the first point to the second; no side to choose)
      if (sm !== 'whole' && sm !== 'between') { try { seg = Constr.segSideOf(pre[0] || find(cref.s), pc, P[0], P[1]); } catch (e) { seg = 0; } if (sm === 'out') seg = -seg; }
      s = A.newShape(g ? g.kind : 'circle', Object.assign(base, { def: Object.assign({ op: 'perp', args: [cref].concat(refs), fill: 'none', nk: seg || sm === 'between' ? 'hyper' : g && g.kind === 'line' ? 'line' : 'circle' }, seg ? { seg } : {}, sm === 'between' ? { between: 1 } : {}) }), target);
      if (pre.length) s.ci = A.nextCi(target, 1);
      next = { tool, side, picks: [], curve1: { cls: 'curve', ref: cref, z: c1.z }, hover: null, keptC: true };
    } else if (tool === 'midpoint') {
      s = A.newShape('point', { p: isXY(P[0]) && isXY(P[1]) ? [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2] : [0, 0], def: { op: 'midpoint', args: refs } }, target);
    } else {
      s = A.newShape('line', { a: isXY(P[0]) ? P[0].slice() : [0, 0], b: isXY(P[1]) ? P[1].slice() : [1, 0], def: { op: 'bisector', args: refs } }, target);
    }
    draftC = null;
    holdRing();
    api.cm.create(pre.concat(shapes, [s]), { target });
    // (the perpendicular circle: the curve stays picked; Backspace with no points, or Esc, drops it)
    if (next) draftC = next;
    A.requestRender('OL', 'OR');
    A.tourEmit('construct-added', { op: tool === 'hyper' ? 'perp' : tool, tool });
  }
  function holdRing() { ringHold = lastEv ? [lastEv.clientX, lastEv.clientY] : null; ring = null; }
  function finishMeetCross(t, side) {
    const m = materialize(t, side, {});
    draftC = null;
    holdRing();
    api.cm.create(m.shapes, { target: side === 'R' });
    A.requestRender('OL', 'OR');
    A.tourEmit('construct-added', { op: 'meet' });
  }
  // two curves: both points (one for two lines), those defined now
  function finishMeetCurves(c1, c2, side) {
    draftC = null;
    const a = find(c1.ref.s), b = find(c2.ref.s);
    const pa = a && piecesOf(a)[c1.ref.part], pb = b && piecesOf(b)[c2.ref.part];
    const target = side === 'R';
    const out = [];
    if (pa && pb && (pa.kind === 'traced' || pb.kind === 'traced')) {
      const m = Constr.meetNear(pa, pb, c2.z, null);
      if (m) out.push(A.newShape('point', { p: m.z.slice(), def: { op: 'meet', args: [c1.ref, c2.ref], seed: m.seed || m.z } }, target));
    } else if (pa && pb) {
      let ms = [];
      try { ms = Constr.meets(pa, pb); } catch (e) { ms = []; }
      for (const m of ms) {
        if (!isXY(m.z) || !Constr.onPiece(pa, m.z) || !Constr.onPiece(pb, m.z)) continue;
        if (out.some((q) => Math.hypot(q.p[0] - m.z[0], q.p[1] - m.z[1]) < 1e-12)) continue;   // (tangency: one point)
        out.push(A.newShape('point', { p: m.z.slice(), def: { op: 'meet', args: [c1.ref, c2.ref], index: m.index } }, target));
      }
    }
    A.requestRender('OL', 'OR');
    // [v16.5 UX101] two parallel lines meet only at ∞: said so, not "here"
    if (!out.length) { pickWarn(pa && pb && pa.kind === 'line' && pb.kind === 'line' ? $t('These lines are parallel: they meet only at ∞') : $t('The curves do not meet here')); A.requestRender('OL', 'OR'); return; }
    holdRing();
    api.cm.create(out, { target });
    A.tourEmit('construct-added', { op: 'meet' });
  }
  // ---------------------------------------------------------------- picks on an editable globe (SPEC 12)
  // The same point targets as the plane (points, other shapes' handles, f₁'s zeros and poles; in Y the images F(z₀)),
  // projected to the globe, and N (∞) for Circle through 3 points: circle(P, Q, ∞) is the line through P and Q. A pick on
  // the globe elsewhere makes a free point there. (Crossings and curves are picked in the plane.)
  function globeTargets(side) {
    const st = S(), out = [];
    const list = side === 'R' ? st.targets : st.shapes;
    for (const s of list) {
      if (s.visible === false) continue;
      if (s.kind === 'point') { if (!s._atInf && isXY(s.p)) out.push({ z: s.p, ref: { s: s.id } }); continue; }
      if (s.def || GRID.has(s.kind)) continue;
      let hs = [];
      try { hs = Region.handlesOf(s); } catch (e) { hs = []; }
      for (const [k, hz] of hs) if (POS.test(k) && !(s.at && s.at[k])) out.push({ z: [hz.re, hz.im], ref: { s: s.id, h: k } });
    }
    if (side === 'L' && A.leftStage() === 0) {
      const f1 = st.steps[0];
      if (f1 && f1.type === 'zp' && f1.on !== false && f1.uid && f1.zpIds) for (const kind of ['zeros', 'poles']) {
        const vs = env().zpAll ? env().zpAll(f1, kind) : [];
        vs.forEach((z, i) => { const id = f1.zpIds[kind] && f1.zpIds[kind][i]; if (z && id) out.push({ z, ref: { zp: f1.uid, kind, id, i, step: 0 } }); });
      }
    }
    if (side === 'R') { const F = env().F; for (const s of st.shapes) if (s.kind === 'point' && s.visible !== false && !s.helper && !s._atInf && F) { const w = F(s.p); if (w) out.push({ z: w, ref: { img: s.id } }); } }
    return out;
  }
  function globeClick(side, x, y) {
    const tool = A.tool();
    if (!isCTool(tool)) return false;
    const gp = A.globePick(side, x, y);
    if (!gp || !gp.g) return false;
    // ([v16.5 fix rail-5] the curve tools pick their curves in the plane: said as it is, never "Click a line or a circle"
    // on a press that is on one)
    if (tool === 'meet' || CURVE1.has(tool)) { pickWarn($t('Switch to the plane to pick the curve')); return true; }
    const R = radii(touchNow()).p;
    let best = null, bd = R;
    const consider = (P, ref, z) => { const q = A.gScreen(gp.gc, P); if (!q) return; const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = { cls: 'point', ref, z }; } };
    if (!draftC || draftC.tool !== tool || draftC.side !== side) draftC = { tool, side, picks: [], curve1: null, hover: null };
    // ([v16.5 rail SPEC 3.2] the draft's picks that become points are targets: a press on one is refused)
    draftC.picks.forEach((p, i) => { if (p.cls !== 'point' && isXY(p.z)) consider(Region.Globe.lift(p.z[0], p.z[1]), { pend: i }, p.z.slice()); });
    for (const t of globeTargets(side)) consider(Region.Globe.lift(t.z[0], t.z[1]), t.ref, t.z.slice());
    if (tool === 'circle3') consider([0, 0, 1], { inf: 1 }, Constr.INF);
    // ([v16.5 fix rail-5] a pick on a drawn curve is a point on it, as on the plane: the construction is exact on it)
    if (!best && !altNow()) best = globeCurveAt(side, gp.g, x, y, gp.gc, gp.hit);
    if (!best) { if (!gp.g.z) return true; best = { cls: 'free', z: [gp.g.z.re, gp.g.z.im], ref: null }; }
    if (dupPick(best)) { pickWarn($t('{x} needs distinct points', { x: warnTool(tool) })); return true; }   // ([v16.5 UX52])
    draftC.picks.push(best); pickOk();
    if (draftC.picks.length >= NEED[tool]) finish(side); else A.requestRender('OL', 'OR');
    return true;
  }
  function cancel() { pickOk(); if (!draftC) return false; draftC = null; A.requestRender('OL', 'OR'); return true; }
  // a construction in progress: picks made, or its curve picked (what Esc and a right-click cancel)
  const drafting = () => !!(draftC && (draftC.picks.length || draftC.curve1));
  function back() {
    pickOk();
    if (!draftC) return false;
    if (draftC.tool === 'meet') { if (!draftC.curve1) return cancel(); draftC.curve1 = null; }
    else if (CURVE1.has(draftC.tool) && !draftC.picks.length) { if (!draftC.curve1) return cancel(); draftC.curve1 = null; }
    else if (!draftC.picks.length) return cancel();
    else { draftC.picks.pop(); draftC.hoverT = null; }
    A.requestRender('OL', 'OR');
    return true;
  }
  // [v16.5 UX15] Undo (its button, ⌘Z, the phone's Undo) while the draft has picks of its own: the last pick goes, as
  // Backspace, never earlier work. The curve kept from the last circle (keptC) and a P carried after a tangent are no
  // picks of this draft: Undo then undoes that construction as usual. Returns the pick's name ('' when it has none), or
  // null when Undo is the app's
  function undoPickable() {
    const d = draftC;
    if (!d || d.tool !== A.tool() || d.carried) return false;
    return d.picks.length > 0 || (!!d.curve1 && !d.keptC);
  }
  function undoPick() {
    if (!undoPickable()) return null;
    const d = draftC, p = d.picks.length ? d.picks[d.picks.length - 1] : d.curve1;
    let what = '';
    try {
      what = p.cls === 'curve' && !d.picks.length ? (p.ref ? curveName(p.ref) : p.label || '')
        : p.ref && (p.cls === 'point' || p.cls === 'cross') ? refName(p.ref) : p.cls === 'curve' && p.ref ? $t('a point on {c}', { c: curveName(p.ref) }) : '';
    } catch (e) { what = ''; }
    back();
    return what === '?' ? '' : what;
  }

