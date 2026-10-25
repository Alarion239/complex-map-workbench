'use strict';
// Constructions: the interface (v16, notes/constructions-v16/SPEC.md 4-7, 9-12, 15, 16; owned by INTERFACE).
// CORE (constr.js, app.js's cm block) owns the model; this file owns what the user touches and reads:
//   - snap targets: every point on the page (point shapes, other shapes' handles, the zeros and poles of f₁, the images
//     F(z₀) in Y), the crossings of two drawn curves (found locally, at the pointer), and the curves themselves;
//   - the ring and its chip ("on z₂"), at 8 px (mouse) or 22 px (touch);
//   - binding: a drawing tool's handles bind at the press and at the release, a handle dragged onto a target binds,
//     the Point tool makes a meet point on a crossing and a point on a curve on a stroke;
//   - the four tools (Circle through 3 points, Intersect, Midpoint, Perpendicular bisector): picks, the draft chip
//     with Curve | Region, the dashed preview, Backspace and Esc;
//   - dragging what is built: a point on a curve slides, a fixed point says what it is built from, a shape built on
//     free points moves them (else the press pans);
//   - texts: definitions, undefined reasons, the delete toasts; the rows, the ⋯ items, the plane menu's group, the
//     Inspector's Construction view, export phrases; the tour's events.
// app.js calls in through one guarded line per hook (typeof Construct !== 'undefined'); its adapter is Construct.ui(A).
const Construct = (() => {
  let api = null;          // CORE: {cm}
  let A = null;            // the app's adapter (app.js cmUiApi)
  const events = [];
  const TAU = 2 * Math.PI;
  const CTOOLS = ['circle3', 'meet', 'midpoint', 'bisector'];
  const NEED = { circle3: 3, midpoint: 2, bisector: 2, meet: 2 };
  const GRID = new Set(['cgrid', 'pgrid']);
  const POS = /^(p|a|b|m|c|v\d+)$/;
  const SUBD = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (k) => String(k).split('').map((d) => SUBD[+d] ?? d).join('');
  const isXY = (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  let ring = null;         // the current snap: {side, z, ref, cls, chip, touch, warn}
  let draftC = null;       // a construction tool's picks: {tool, side, picks: [{ref, z, make}], curve1, hover}
  let fillMode = 'in';     // Curve | Region for Circle through 3 points (the session's choice; Region by default)
  let lastEv = null;       // the last pointer event over a plane (touch, Alt)
  let moveChipShown = false;
  let gestSnap = null;     // a drawing gesture's snaps: {start, end} targets
  const pcache = new Map();

  // ---------------------------------------------------------------- small helpers
  const S = () => A.S();
  const find = (id) => S().shapes.find((x) => x.id === id) || S().targets.find((x) => x.id === id) || null;
  const isT = (s) => !!s && S().targets.includes(s);
  const touchNow = () => !!lastEv && (lastEv.pointerType === 'touch' || lastEv.pointerType === 'pen');
  const radii = (touch) => (touch ? { p: 22, c: 10 } : { p: 8, c: 6 });
  const env = () => (api && api.cm ? api.cm.env() : {});
  const graph = () => Constr.graph(S());
  const isCTool = (t) => CTOOLS.includes(t);
  // [review regress-4] the pieces of a shape, cached on a cheap signature of the fields pieces read (a long point list,
  // a freehand stroke of 2000 points, by its length and every 64th point: it is moved whole), never a JSON.stringify
  // of the whole shape per pointer move; a formula curve also by the window it is traced in
  function pieceSig(s) {
    const pts = Array.isArray(s.pts) ? s.pts : null;
    let ps = '';
    if (pts) { const k = pts.length <= 64 ? 1 : 64; ps = pts.length + ':'; for (let i = 0; i < pts.length; i += k) ps += pts[i] + ';'; ps += pts[pts.length - 1]; }
    const g = s._g ? s._g.A + ',' + s._g.B + ',' + s._g.C + ',' + s._g.o : '';
    const w = s.kind === 'fcurve' && A.win ? JSON.stringify(A.win('L')) : '';
    return s.kind + '|' + ps + '|' + g + '|' + [s.a, s.b, s.c, s.m, s.p, s.r, s.r1, s.r2, s.t1, s.t2, s.expr, s.complement].join(';') + '|' + w;
  }
  function piecesOf(s) {
    const key = pieceSig(s);
    const c = pcache.get(s.id);
    if (c && c.key === key && c.s === s) return c.pcs;
    let pcs = [];
    try { pcs = Constr.pieces(s, env()); } catch (e) { pcs = []; }
    const boxes = pcs.map((pc) => { try { return Constr.pieceBox(pc); } catch (e) { return null; } });
    pcache.set(s.id, { key, pcs, boxes, s });
    return pcs;
  }
  const boxesOf = (s) => { piecesOf(s); const c = pcache.get(s.id); return c ? c.boxes : []; };
  // the world distance from z to a piece: exact at any radius (the form), CORE's pieceDist [math-1]
  function pieceDist(pc, z) {
    if (!pc || pc.kind === 'none') return Infinity;
    if (pc.kind === 'circle' && !pc.closed && !pc.arc3) {
      const dx = z[0] - pc.c[0], dy = z[1] - pc.c[1], rr = Math.hypot(dx, dy);
      const u = ((((Math.atan2(dy, dx) - pc.a0) % TAU) + TAU) % TAU);
      if (u <= pc.span) return Math.abs(rr - pc.r);
      const e = (a) => Math.hypot(pc.c[0] + pc.r * Math.cos(a) - z[0], pc.c[1] + pc.r * Math.sin(a) - z[1]);
      return Math.min(e(pc.a0), e(pc.a0 + pc.span));
    }
    return Constr.pieceDist(pc, z);
  }
  // the three defining points of a circle3 (for the glider parameter; one may be ∞), as CORE's pts3Of [math-12]
  function pts3Of(s, plane) {
    if (!s || !s.def || s.def.op !== 'circle3') return null;
    try { return Constr.pts3(S(), s, plane, env()); } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- names and texts
  // a point shape's plane label (z₀, a user label; helpers have none), as drawPoints counts
  function pointName(s) {
    const st = S();
    if (isT(s)) { const pts = st.targets.filter((x) => x.kind === 'point'); return A.targetLabel(s, pts.indexOf(s)); }
    let i = 0;
    for (const x of st.shapes) { if (x === s) break; if (x.kind === 'point' && x.visible !== false && !x.helper) i++; }
    return A.pointLabel(s, i, 0);
  }
  function shapeLabel(s) {
    if (!s) return '?';
    if (s.kind === 'point') { if (s.helper && s.def && s.def.op === 'meet') return meetName(s); return pointName(s); }
    if (isT(s)) { const c = {}; let n = 0; for (const x of S().targets) { c[x.kind] = (c[x.kind] || 0) + 1; if (x === s) n = c[x.kind]; } return $t('Target {x} {x2}', { x: Region.KINDS[s.kind].label.toLowerCase(), x2: n }); }
    return A.shapeNames().get(s.id) || Region.KINDS[s.kind].label;
  }
  const nameById = (id) => shapeLabel(find(id));
  const zMark = (kind, i) => (kind === 'poles' ? 'p' : 'ζ') + sub(i + 1);
  function zpIndex(ref) {
    const st = (S().steps || []).find((x) => x.uid === ref.zp);
    const ids = st && st.zpIds && st.zpIds[ref.kind];
    const i = ids ? ids.indexOf(ref.id) : -1;
    return i >= 0 ? i : (Number.isInteger(ref.i) ? ref.i : 0);
  }
  // [review user-12] a shape's name in the genitive ("многоугольника 1"; English: as the row), for a handle named after
  // "through" (the accusative forms below, ctx 'acc'); a name that is not "Kind n" stays as it is
  function genKind(kind) {
    switch (kind) {
      case 'polygon': return $tx('gen-kind', 'Polygon');
      case 'rect': return $tx('gen-kind', 'Rectangle');
      case 'segment': return $tx('gen-kind', 'Segment');
      case 'line': return $tx('gen-kind', 'Line');
      case 'ray': return $tx('gen-kind', 'Ray');
      case 'halfplane': return $tx('gen-kind', 'Half-plane');
      case 'arc': return $tx('gen-kind', 'Arc');
      case 'circle': return $tx('gen-kind', 'Circle');
      case 'disc': return $tx('gen-kind', 'Disc');
      case 'annulus': return $tx('gen-kind', 'Annulus');
      case 'sector': return $tx('gen-kind', 'Sector');
    }
    return null;
  }
  function genName(s) {
    const nm = shapeLabel(s), m = /\s(\d+)$/.exec(nm), k = isT(s) ? null : genKind(s.kind);
    return m && k ? `${k} ${m[1]}` : nm;
  }
  function handleName(s, h, cs) {
    if (cs === 'acc') {
      const x = genName(s);
      if (/^v\d+$/.test(h)) return $tx('acc', 'vertex {n} of {x}', { n: +h.slice(1) + 1, x });
      if (h === 'c') return $tx('acc', 'the centre of {x}', { x });
      if (h === 'm') return $tx('acc', 'the middle of {x}', { x });
      if (s.kind === 'rect') return $tx('acc', 'corner {n} of {x}', { n: h === 'a' ? 1 : 2, x });
      if (h === 'a') return $tx('acc', 'the start of {x}', { x });
      if (h === 'b') return $tx('acc', 'the end of {x}', { x });
      return shapeLabel(s);
    }
    const x = shapeLabel(s);
    if (/^v\d+$/.test(h)) return $t('vertex {n} of {x}', { n: +h.slice(1) + 1, x });
    if (h === 'c') return $t('the centre of {x}', { x });
    if (h === 'm') return $t('the middle of {x}', { x });
    if (s.kind === 'rect') return $t('corner {n} of {x}', { n: h === 'a' ? 1 : 2, x });
    if (h === 'a') return $t('the start of {x}', { x });
    if (h === 'b') return $t('the end of {x}', { x });
    return x;
  }
  const fmtZ = (z) => { try { return CX.fmt(CX.C(z[0], z[1])).replace(/-/g, '−'); } catch (e) { return String(z); } };
  function curveName(ref) {
    const s = find(ref.s);
    if (!s) return '?';
    const n = piecesOf(s).length;
    return n > 1 ? $t('side {n} of {x}', { n: ref.part + 1, x: shapeLabel(s) }) : shapeLabel(s);
  }
  function refName(ref, cs) {
    if (!ref) return '?';
    if (ref.inf) return '∞';
    if (typeof ref.zp === 'string') return zMark(ref.kind, zpIndex(ref));
    if (typeof ref.img === 'string') { const s = find(ref.img); return s ? pointName(s) + (S().steps.length < 4 ? ['', '′', '″', '‴'][S().steps.length] : '″') : '?'; }
    if (ref.meet) return `${curveName(ref.meet[0])} ∩ ${curveName(ref.meet[1])}`;
    if (ref.part != null) return curveName(ref);
    const s = find(ref.s);
    if (!s) return '?';
    return ref.h ? handleName(s, ref.h, cs) : shapeLabel(s);
  }
  // a list of names after "through": "z₀, z₁ and ζ₁" ({a}, {b} and {c} in the templates)
  function meetName(s) {
    const a = s.def.args;
    return `${curveName(a[0])} ∩ ${curveName(a[1])}`;
  }
  // the reason an undefined construction gives (SPEC 3.1)
  function reasonText(u) {
    if (!u) return '';
    const a = u.args || {};
    const mark = a.mark ? zMark(a.mark.kind, a.mark.i | 0) : '';
    switch (u.code) {
      case 'coincide': return $t('The points coincide');
      case 'coincide3': return $t('Two of the points coincide');
      case 'nomeet': return $t('The curves do not meet here');
      case 'coincideCurves': return $t('The curves coincide here, so their crossings are not defined');
      case 'lineInf': return $t('A line needs two finite points');
      case 'handleInf': return $t('Only a line can pass through ∞');
      case 'tRange': return $t('The point is off the end of its curve');
      case 'zpRemoved':
        // [review user-6] by its value: a zero added back elsewhere is not the one that was removed
        if (a.v) return a.mark && a.mark.kind === 'poles' ? $t('The pole at {v} was removed', { v: fmtZ(a.v) }) : $t('The zero at {v} was removed', { v: fmtZ(a.v) });
        return $t('{mark} was removed', { mark });
      case 'stepRemoved': return $t('The step of {mark} was removed', { mark });
      case 'zpNotF1': return a.mark && a.mark.kind === 'poles' ? $t('{mark} is a pole of {f} now: only the zeros and poles of f₁ lie in the z-plane', { mark, f: 'f' + sub(a.f || 2) }) : $t('{mark} is a zero of {f} now: only the zeros and poles of f₁ lie in the z-plane', { mark, f: 'f' + sub(a.f || 2) });
      case 'argUndef': {
        const x = a.x == null ? null : typeof a.x === 'string' ? nameById(a.x) : a.x.mark ? zMark(a.x.mark.kind, a.x.mark.i | 0) : null;
        return x ? $t('{x} is undefined', { x }) : $t('An argument is undefined');
      }
    }
    return $t('An argument is undefined');
  }
  // the definition of a shape with def (rows, the Inspector), or null
  // the two finite defining points of a half-plane through 3 points in the order its region is left of [math-9]: the
  // region is the form's left side, so it is "left of P -> Q" only while the form's direction agrees with Q - P
  function hpOrder(s) {
    const d = s.def, plane = isT(s) ? 1 : 0;
    const R = d.args.map((r, i) => ({ i, r: Constr.resolve(S(), r, plane, env()) })).filter((x) => x.r && x.r.z);
    if (R.length < 2) return [0, 1];
    const [P, Q] = R;
    const G = s._g, g = G && G.A === 0 ? Constr.geomOf(G) : null;
    if (!g) return [P.i, Q.i];
    const dd = g.d[0] * (Q.r.z[0] - P.r.z[0]) + g.d[1] * (Q.r.z[1] - P.r.z[1]);
    return dd < 0 ? [Q.i, P.i] : [P.i, Q.i];
  }
  function defText(s) {
    const d = s.def;
    if (!d) return null;
    const N = (i) => refName(d.args[i], 'acc');
    switch (d.op) {
      case 'circle3': {
        if (d.fill !== 'in') return s.kind === 'line' ? $t('the line through {a}, {b}, {c}', { a: N(0), b: N(1), c: N(2) }) : $t('through {a}, {b}, {c}', { a: N(0), b: N(1), c: N(2) });
        if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return $t('the half-plane left of {a} → {b}', { a: refName(d.args[i]), b: refName(d.args[j]) }); }
        if (s.complement) return $t('outside the circle through {a}, {b}, {c}', { a: N(0), b: N(1), c: N(2) });
        return $t('the disc through {a}, {b}, {c}', { a: N(0), b: N(1), c: N(2) });
      }
      case 'meet': {
        const c1 = curveName(d.args[0]), c2 = curveName(d.args[1]);
        if (d.index === 'finite' || d.seed) return `${c1} ∩ ${c2}`;
        return d.index === 1 ? $t('{c1} ∩ {c2}, second point', { c1, c2 }) : $t('{c1} ∩ {c2}, first point', { c1, c2 });
      }
      case 'glider': return $t('on {curve}', { curve: curveName(d.args[0]) });
      case 'midpoint': return $t('midpoint of {a}, {b}', { a: refName(d.args[0]), b: refName(d.args[1]) });
      case 'bisector': return $t('bisector of {a}, {b}', { a: refName(d.args[0]), b: refName(d.args[1]) });
    }
    return null;
  }
  // [review user-5] a line, segment, ray or half-plane bound at both ends reads by its points ("line through z₀ and z₁")
  function boundText(s) {
    if (!s.at || !s.at.a || !s.at.b || s.def) return null;
    const a = refName(s.at.a), b = refName(s.at.b), aa = refName(s.at.a, 'acc'), ba = refName(s.at.b, 'acc');
    switch (s.kind) {
      case 'line': return $t('line through {a} and {b}', { a: aa, b: ba });
      case 'segment': return $t('segment from {a} to {b}', { a, b });
      case 'ray': return $t('ray from {a} through {b}', { a, b: ba });
      case 'halfplane': return s.complement ? $t('the half-plane right of {a} → {b}', { a, b }) : $t('the half-plane left of {a} → {b}', { a, b });
    }
    return null;
  }
  function followsText(s) {
    if (!s.at) return '';
    const xs = [...new Set(Object.values(s.at).map(refName))];
    return $t('follows {x}', { x: xs.join(', ') });
  }

  // ---------------------------------------------------------------- snap targets (SPEC 4.1)
  // o: {points, cross, curves, exclude: Set, touch}; returns {cls, ref, z, pc?, t?} | null
  function snapAt(side, x, y, o = {}) {
    const st = S();
    if (!st) return null;
    const pane = A.setView(side);
    const zc = pane.s2w(x, y), Z = [zc.re, zc.im], sc = pane.view.s;
    const list = side === 'R' ? st.targets : st.shapes;
    const ex = o.exclude || new Set();
    const R = radii(o.touch != null ? o.touch : touchNow());
    const dpx = (z) => { const [sx, sy] = pane.w2sxy(z[0], z[1]); return Math.hypot(sx - x, sy - y); };
    if (o.points !== false) {
      let best = null, bd = R.p;
      const consider = (z, ref) => { if (!isXY(z)) return; const d = dpx(z); if (d < bd) { bd = d; best = { cls: 'point', ref, z: z.slice() }; } };
      for (const s of list) {
        if (s.visible === false || ex.has(s.id)) continue;
        if (s.kind === 'point') { if (!s._atInf) consider(s.p, { s: s.id }); continue; }
        if (s.def || GRID.has(s.kind)) continue;
        let hs = [];
        try { hs = Region.handlesOf(s); } catch (e) { hs = []; }
        for (const [k, hz] of hs) { if (!POS.test(k) || (s.at && s.at[k])) continue; consider([hz.re, hz.im], { s: s.id, h: k }); }
      }
      if (side === 'L' && A.leftStage() === 0) {
        const zs = A.zpStep();
        if (zs && zs.k === 1 && zs.st.uid && zs.st.zpIds) {
          for (const kind of ['zeros', 'poles']) (zs.items[kind] || []).forEach((z, i) => {
            const id = zs.st.zpIds[kind] && zs.st.zpIds[kind][i];
            if (z && id) consider([z.re, z.im], { zp: zs.st.uid, kind, id, i, step: 0 });
          });
        }
      }
      if (side === 'R' && A.yWhole()) {
        const F = env().F;
        for (const s of st.shapes) if (s.kind === 'point' && s.visible !== false && !s.helper && !s._atInf && F) { const w = F(s.p); if (w) consider(w, { img: s.id }); }
      }
      if (best) return best;
    }
    // curves near the pointer (their pieces): crossings first, then the stroke
    const near = [];
    if (o.cross !== false || o.curves) {
      const lim = Math.max(R.p, R.c) / sc;
      for (const s of list) {
        if (s.visible === false || ex.has(s.id) || s.kind === 'point' || GRID.has(s.kind) || s.kind === 'formula') continue;
        const pcs = piecesOf(s), bx = boxesOf(s);
        pcs.forEach((pc, part) => {
          const b = bx[part];
          if (b && (Z[0] < b.x0 - lim || Z[0] > b.x1 + lim || Z[1] < b.y0 - lim || Z[1] > b.y1 + lim)) return;   // (the box prefilter)
          const d = pieceDist(pc, Z);
          if (d <= lim) near.push({ s, part, pc, d });
        });
      }
    }
    if (o.cross !== false && near.length > 1) {
      let best = null, bd = R.p;
      const h = R.p / sc, box = { x0: Z[0] - h, x1: Z[0] + h, y0: Z[1] - h, y1: Z[1] + h };
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
        const a = near[i], b = near[j];
        if (a.s === b.s) continue;
        let m = null;
        try { m = Constr.meetNear(a.pc, b.pc, Z, box); } catch (e) { m = null; }
        if (!m || !isXY(m.z)) continue;
        const d = dpx(m.z);
        if (d < bd) { bd = d; best = { cls: 'cross', ref: { meet: [{ s: a.s.id, part: a.part }, { s: b.s.id, part: b.part }], index: m.index, seed: m.seed }, z: m.z.slice() }; }
      }
      if (best) return best;
    }
    if (o.curves) {
      let best = null, bd = R.c / sc;
      for (const n of near) if (n.d <= bd) { bd = n.d; best = n; }
      if (best) {
        const p3 = pts3Of(best.s, side === 'R' ? 1 : 0);
        let pr = null;
        try { pr = Constr.projectPiece(best.pc, Z, best.pc.c3 ? p3 : null); } catch (e) { pr = null; }
        if (pr && isXY(pr.z)) return { cls: 'curve', ref: { s: best.s.id, part: best.part }, z: pr.z.slice(), t: pr.t, seed: pr.seed, pc: best.pc };
      }
    }
    return null;
  }
  // the classes a tool snaps to (SPEC 4.1 [C16]); null: no snapping now (Alt, Snap off for a drawing tool)
  function classesFor(tool, role) {
    const alt = A.altHeld() || (lastEv && lastEv.altKey);
    if (alt) return null;
    if (isCTool(tool)) return { points: true, cross: true, curves: true };
    if (!A.snapOn()) return null;
    if (tool === 'point') return { points: true, cross: true, curves: true };
    if (role === 'handle') return { points: true, cross: true, curves: false };
    return { points: true, cross: true, curves: false };
  }
  const chipOf = (t) => (t ? $t('on {x}', { x: refName(t.ref) }) : '');
  // (a finished construction hides the ring and chip until the pointer moves on [review user-10])
  let ringHold = null;
  function setRing(side, t, warn) {
    const n = t ? { side, z: t.z, ref: t.ref, cls: t.cls, chip: warn || chipOf(t), touch: touchNow(), warn: !!warn } : null;
    if (n && ringHold && lastEv && Math.hypot(lastEv.clientX - ringHold[0], lastEv.clientY - ringHold[1]) < 4) n.held = true;
    else if (ringHold && lastEv && Math.hypot(lastEv.clientX - ringHold[0], lastEv.clientY - ringHold[1]) >= 4) ringHold = null;
    const k = (r) => (r ? `${r.side}|${r.z[0]}|${r.z[1]}|${r.chip}|${!!r.held}` : '');
    if (k(n) !== k(ring)) { ring = n; A.requestRender('OL', 'OR'); }
  }

  // ---------------------------------------------------------------- materializing a target as a ref
  // point and handle targets are refs as they are; a crossing becomes a meet point (a helper when a drawing tool made
  // it on its own), a curve a point on the curve. Returns {ref, shapes: [new shapes to create first]}
  function materialize(t, side, o = {}) {
    if (!t) return null;
    if (t.cls === 'point') return { ref: t.ref, shapes: [] };
    const target = side === 'R';
    if (t.cls === 'cross') {
      const def = { op: 'meet', args: t.ref.meet };
      if (t.ref.seed) def.seed = t.ref.seed; else def.index = t.ref.index;
      const p = A.newShape('point', { p: t.z.slice(), def }, target);
      if (o.helper) { p.helper = true; p.owner = o.owner; }
      return { ref: { s: p.id }, shapes: [p] };
    }
    if (t.cls === 'curve') {
      const def = { op: 'glider', args: [t.ref] };
      const extra = { p: t.z.slice(), def };
      if (t.seed) def.seed = t.seed; else extra.t = t.t;
      const p = A.newShape('point', extra, target);
      return { ref: { s: p.id }, shapes: [p] };
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
    if (!t) return false;
    const target = side === 'R';
    if (t.cls === 'point' && t.ref.s && !t.ref.h) {
      // [review user-14] never silent: the chip says the point is already there (Alt, or Snap off, places a new one)
      A.select(t.ref.s);
      setRing(side, t, $t('{x} is already here', { x: refName(t.ref) }));
      // (touch has no Alt: the escape is the Snap switch of the tools sheet, said once a session)
      if (touchNow() && !pointDown.told) { pointDown.told = true; A.toast($t('To place a point next to another, turn Snap off in the tools sheet.')); }
      return true;
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

  // ---------------------------------------------------------------- dragging handles onto targets, built things
  function handleMove(d, side, x, y) {
    const s = d.shape;
    // (a free point drags to the grid only, never onto a point or a curve [C22]: no merging)
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
    if (!s || !(s.def || s.at)) return false;
    const z = pane.s2w(x, y), Z = [z.re, z.im];
    if (d.cm === 'pan') return false;
    if (s.def && s.def.op === 'glider') {
      const e = find(s.def.args[0].s);
      const pc = e && piecesOf(e)[s.def.args[0].part];
      if (!pc) return true;
      let pr = null;
      try { pr = Constr.projectPiece(pc, Z, pc.c3 ? pts3Of(e, isT(s) ? 1 : 0) : null); } catch (er) { pr = null; }
      if (!pr) return true;
      if (s.bind && s.bind.t) return true;   // (a number moves it)
      if (pr.seed) api.cm.setDef(s.id, { seed: pr.seed, live: true }); else api.cm.setDef(s.id, { t: pr.t, live: true });
      d.moved = true; d.cmLive = true;
      return true;
    }
    if (s.kind === 'point' && s.def) {
      if (!d.cmWarned) { d.cmWarned = true; A.toast($t('{x} is built from {y}: drag those', { x: shapeLabel(s), y: rootsText(s) })); }
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
      A.toast($t('Built on {x}: drag those, or Make free', { x: rootsText(s) || shapeLabel(s) }));
    }
    return 'pan';
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
  function toolDown(pane, side, x, y) {
    // a click makes the pick (onUp, when the press did not move); a drag between picks pans
    return false;
  }
  function pickOf(side, x, y) {
    const tool = A.tool();
    const t = snapAt(side, x, y, { points: true, cross: true, curves: true });
    const pane = A.setView(side);
    if (t) return t;
    const z0 = pane.s2w(x, y), z = A.snapOn() && !A.altHeld() ? A.snapZ(pane, z0) : z0;
    return { cls: 'free', z: [z.re, z.im], ref: null, tool };
  }
  // a click with a construction tool
  function click(pane, side, x, y) {
    const tool = A.tool();
    if (!isCTool(tool)) return false;
    if (side === 'L' && A.leftStage() > 0) return false;
    if (side === 'R' && !A.targetsEditable()) return false;
    if (!draftC || draftC.tool !== tool || draftC.side !== side) draftC = { tool, side, picks: [], curve1: null, hover: null };
    let t = pickOf(side, x, y);
    if (tool === 'meet') {
      if (t.cls === 'cross') { finishMeetCross(t, side); return true; }
      // a pick on a point is not a curve: the curve under it is wanted
      if (t.cls !== 'curve') { const c = snapAt(side, x, y, { points: false, cross: false, curves: true }); if (!c) { A.toast($t('Click a crossing of two curves, or a curve.')); return true; } t = c; }
      if (!draftC.curve1) { draftC.curve1 = t; A.requestRender('OL', 'OR'); return true; }
      if (t.ref.s === draftC.curve1.ref.s && t.ref.part === draftC.curve1.ref.part) return true;
      finishMeetCurves(draftC.curve1, t, side);
      return true;
    }
    // midpoint / bisector: a click on a segment's stroke takes its ends
    if ((tool === 'midpoint' || tool === 'bisector') && !draftC.picks.length && t.cls === 'curve') {
      const s = find(t.ref.s);
      if (s && s.kind === 'segment' && !s.def) {
        draftC.picks = [{ ref: { s: s.id, h: 'a' }, z: s.a.slice() }, { ref: { s: s.id, h: 'b' }, z: s.b.slice() }];
        finish(side);
        return true;
      }
    }
    // a co-argument pick: distinct points only
    if (t.ref && draftC.picks.some((p) => p.ref && Constr.refKey(p.ref) === Constr.refKey(t.ref))) {
      A.toast($t('{x} needs distinct points', { x: toolName(tool) }));
      return true;
    }
    if (t.ref && t.ref.img && !A.yWhole()) { A.toast($t('Draw in X to use {x}', { x: pointName(find(t.ref.img)) })); return true; }
    draftC.picks.push(t);
    if (draftC.picks.length >= NEED[tool]) finish(side); else { A.requestRender('OL', 'OR'); }
    return true;
  }
  const toolName = (id) => ({ circle3: $t('Circle through 3 points'), meet: $t('Intersect'), midpoint: $t('Midpoint'), bisector: $t('Perpendicular bisector') }[id] || id);
  // the picks as refs (new free points, meet points and points on curves made in the same undo step)
  function refsOfPicks(side) {
    const shapes = [], refs = [];
    const target = side === 'R';
    for (const p of draftC.picks) {
      if (p.cls === 'free') { const s = A.newShape('point', { p: p.z.slice() }, target); shapes.push(s); refs.push({ s: s.id }); continue; }
      const m = materialize(p, side, {});
      shapes.push(...m.shapes); refs.push(m.ref);
    }
    return { shapes, refs };
  }
  function finish(side) {
    const d = draftC, tool = d.tool, target = side === 'R';
    const { shapes, refs } = refsOfPicks(side);
    const P = d.picks.map((p) => p.z);
    let s;
    if (tool === 'circle3') {
      let G = null;
      try { G = Constr.circle3(P[0], P[1], P[2]); } catch (e) { G = null; }
      const g = G ? Constr.geomOf(G) : null;
      const fin = P.find(isXY) || [0, 0];
      const base = g && !g.line ? { c: g.c, r: g.r } : { c: fin.slice(), r: 1 };
      s = A.newShape(fillMode === 'in' ? 'disc' : 'circle', Object.assign(base, { def: { op: 'circle3', args: refs, fill: fillMode } }), target);
    } else if (tool === 'midpoint') {
      s = A.newShape('point', { p: isXY(P[0]) && isXY(P[1]) ? [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2] : [0, 0], def: { op: 'midpoint', args: refs } }, target);
    } else {
      s = A.newShape('line', { a: isXY(P[0]) ? P[0].slice() : [0, 0], b: isXY(P[1]) ? P[1].slice() : [1, 0], def: { op: 'bisector', args: refs } }, target);
    }
    draftC = null;
    holdRing();
    api.cm.create(shapes.concat([s]), { target });
    A.requestRender('OL', 'OR');
    A.tourEmit('construct-added', { op: tool });
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
    if (!out.length) { A.toast($t('The curves do not meet here')); A.requestRender('OL', 'OR'); return; }
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
    if (tool === 'meet') { A.toast($t('Click a crossing of two curves, or a curve.')); return true; }
    const R = radii(touchNow()).p;
    let best = null, bd = R;
    const consider = (P, ref, z) => { const q = A.gScreen(gp.gc, P); if (!q) return; const d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; best = { cls: 'point', ref, z }; } };
    for (const t of globeTargets(side)) consider(Region.Globe.lift(t.z[0], t.z[1]), t.ref, t.z.slice());
    if (tool === 'circle3') consider([0, 0, 1], { inf: 1 }, Constr.INF);
    if (!best) { if (!gp.g.z) return true; best = { cls: 'free', z: [gp.g.z.re, gp.g.z.im], ref: null }; }
    if (!draftC || draftC.tool !== tool || draftC.side !== side) draftC = { tool, side, picks: [], curve1: null, hover: null };
    if (best.ref && draftC.picks.some((p) => p.ref && Constr.refKey(p.ref) === Constr.refKey(best.ref))) { A.toast($t('{x} needs distinct points', { x: toolName(tool) })); return true; }
    draftC.picks.push(best);
    if (draftC.picks.length >= NEED[tool]) finish(side); else A.requestRender('OL', 'OR');
    return true;
  }
  function cancel() { if (!draftC) return false; draftC = null; A.requestRender('OL', 'OR'); return true; }
  function back() {
    if (!draftC) return false;
    if (draftC.tool === 'meet') { if (!draftC.curve1) return cancel(); draftC.curve1 = null; }
    else if (!draftC.picks.length) return cancel();
    else draftC.picks.pop();
    A.requestRender('OL', 'OR');
    return true;
  }

  // ---------------------------------------------------------------- the chip (the draft chip of the plane drawn in)
  // [review user-2, picture-4] the counter first (it says which pick is next), then the tool (its tile label on a
  // narrow pane or touch), then Esc; the chip wraps to two lines rather than cut the counter
  const toolShort = (id) => ({ circle3: $t('3 points'), meet: $t('Intersect'), midpoint: $t('Midpoint'), bisector: $t('Bisector') }[id] || id);
  function chipText(narrow) {
    const tool = A.tool();
    if (!isCTool(tool)) return '';
    const touch = touchNow(), tn = narrow || touch ? toolShort(tool) : toolName(tool);
    const tail = touch ? '' : ' · ' + $t('Esc cancels');
    if (tool === 'meet') {
      const n = draftC && draftC.curve1 ? 2 : 1;
      return $t('A crossing, or curve {n} of 2', { n }) + ' · ' + tn + tail;
    }
    const n = (draftC && draftC.tool === tool ? draftC.picks.length : 0) + 1, m = NEED[tool];
    return $t('Point {n} of {m}', { n, m }) + ' · ' + tn + tail;
  }
  // the plane whose draft chip a construction tool uses (updateDraftChips shows it)
  let hoverSide = 'L';
  function chipSide() {
    if (!A || !isCTool(A.tool())) return null;
    const side = draftC ? draftC.side : hoverSide;
    if (side === 'L' && (A.leftStage() > 0 || !(A.lFlat() || A.globeEdit('L')))) return null;
    if (side === 'R' && !A.targetsEditable()) return null;
    return side;
  }
  function syncChip() {
    if (!A) return;
    const cs = chipSide();
    for (const side of ['L', 'R']) {
      const el = document.getElementById(side === 'L' ? 'draftChipL' : 'draftChipR');
      if (!el) continue;
      const tool = A.tool();
      const on = cs === side;
      let box = el.querySelector('.cm-chip');
      if (!on) { if (box) { box.remove(); el.classList.remove('cm-on'); el.firstElementChild && (el.firstElementChild.hidden = false); } continue; }
      if (!box) {
        box = document.createElement('span');
        box.className = 'cm-chip';
        el.append(box);
      }
      el.classList.add('cm-on');
      if (el.firstElementChild && el.firstElementChild !== box) el.firstElementChild.hidden = true;
      const plot = el.parentElement, narrow = !!plot && plot.clientWidth > 0 && plot.clientWidth < 560;
      const txt = chipText(narrow);
      const sig = `${txt}|${tool}|${fillMode}|${I18N.lang}|${touchNow()}|${narrow}`;
      if (box.dataset.sig !== sig) {
        box.dataset.sig = sig;
        box.innerHTML = '';
        box.append(A.h('span', { class: 'cm-t' }, txt));
        if (tool === 'circle3') {
          // (a narrow pane or touch: two icons, a circle and a filled disc, with their names as labels)
          const icons = narrow || touchNow();
          const seg = A.h('span', { class: 'cm-seg' + (icons ? ' cm-icons' : ''), role: 'group', 'aria-label': $t('Curve or region') });
          for (const [v, lab] of [['none', $tx('construct', 'Curve')], ['in', $tx('construct', 'Region')]]) {
            const b = A.h('button', { type: 'button', class: 'cm-sb' + (fillMode === v ? ' on' : ''), 'aria-pressed': String(fillMode === v), 'aria-label': lab, title: lab, onclick: (e) => { e.stopPropagation(); fillMode = v; A.requestRender('OL', 'OR'); } });
            if (icons) b.innerHTML = v === 'in' ? '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.4"/></svg>' : '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
            else b.textContent = lab;
            seg.append(b);
          }
          box.append(seg);
        }
        if (touchNow()) box.append(A.h('button', { type: 'button', class: 'cm-x', 'aria-label': $t('Cancel'), html: '×', onclick: (e) => { e.stopPropagation(); cancel(); A.setTool('select'); } }));
      }
    }
  }

  // ---------------------------------------------------------------- the overlay: the ring, its chip, the preview
  function drawOverlay(pane, side) {
    const ctx = pane.octx, TH = A.TH();
    // during a gesture only, an undefined construction shows its last good shape, dashed at 30 % [C11b]
    if (A.dragging()) drawGhosts(pane, side, ctx);
    // a construction tool's picks and its dashed preview through the pointer
    if (draftC && draftC.side === side) drawPreview(pane, side, ctx, TH);
    // the selected shape's bound handles: small rings (a bound handle has no square)
    const sel = A.selected() && find(A.selected());
    // [review user-9] a selected construction shows what it is built from: a ring on each defining point, its curves
    // drawn wide and faint (so "drag those" is visible, on touch too)
    if (sel && (sel.def || sel.at) && (side === 'R') === isT(sel) && !A.dragging()) drawSources(pane, side, ctx, sel, TH);
    if (sel && sel.at && (side === 'R') === isT(sel)) {
      ctx.save();
      for (const [k, hz] of Region.handlesOf(sel)) {
        if (!sel.at[k]) continue;
        const [hx, hy] = pane.w2s(hz);
        ctx.lineWidth = 1.25; ctx.strokeStyle = A.shapeInk(sel).edge;
        ctx.beginPath(); ctx.arc(hx, hy, 5.5, 0, TAU); ctx.stroke();
      }
      ctx.restore();
    }
    if (!ring || ring.side !== side || ring.held) return;
    const [x, y] = pane.w2sxy(ring.z[0], ring.z[1]);
    ctx.save();
    // [review picture-5] the ring sits outside every point mark (a dot reaches 5 px, a ring mark 6.25 px, the selection
    // ring 8 px): r = 11 (13 on touch) with its halo and a faint accent fill, so a snap reads at a glance
    const rr = ring.touch ? 13 : 11, acc = ring.warn ? TH.warn : TH.accent;
    ctx.globalAlpha = 0.14; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.75; ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    // the chip [review user-10, picture-6]: above and to the LEFT of the target (a point's label is placed below or to
    // its right first), 12 px clear of the ring, on whole pixels, inside the pane on all four sides; a finger: 48 px up
    if (ring.chip) {
      ctx.font = `500 12px ${TH.ui}`;
      const w = Math.ceil(ctx.measureText(ring.chip).width) + 14, hgt = 22;
      let cx = x - rr - 6 - w, cy = ring.touch ? y - 48 - hgt / 2 : y - rr - 6 - hgt;
      if (cx < 4) cx = x + rr + 6;
      if (cy < 4) cy = y + rr + 6;
      cx = Math.round(Math.max(4, Math.min(pane.w - 4 - w, cx)));
      cy = Math.round(Math.max(4, Math.min(pane.h - 4 - hgt, cy)));
      ctx.fillStyle = TH.surface; ctx.strokeStyle = TH.line; ctx.lineWidth = 1;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx + 0.5, cy + 0.5, w, hgt, 6); else ctx.rect(cx + 0.5, cy + 0.5, w, hgt);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = ring.warn ? TH.warn : TH.ink; ctx.textBaseline = 'middle';
      ctx.fillText(ring.chip, cx + 7, cy + hgt / 2 + 1);
    }
    ctx.restore();
  }
  // the defining points (rings) and curves (wide, faint) of a selected construction [user-9]
  function drawSources(pane, side, ctx, sel, TH) {
    const plane = side === 'R' ? 1 : 0;
    const refs = sel.def ? sel.def.args : Object.values(sel.at || {});
    ctx.save();
    for (const r of refs) {
      if (!r || r.inf) continue;
      if (r.part != null) {
        const c = find(r.s), pc = c && piecesOf(c)[r.part];
        if (pc && pc.kind !== 'none') { ctx.strokeStyle = TH.accent; ctx.globalAlpha = 0.3; ctx.lineWidth = 6; ctx.setLineDash([]); strokePiece(pane, ctx, pc); ctx.globalAlpha = 1; }
        continue;
      }
      let z = null;
      try { const res = Constr.resolve(S(), r, plane, env()); z = res && res.z; } catch (e) { z = null; }
      if (!isXY(z)) continue;
      const [x, y] = pane.w2sxy(z[0], z[1]);
      if (x < -20 || y < -20 || x > pane.w + 20 || y > pane.h + 20) continue;
      ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = TH.accent; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  function drawGhosts(pane, side, ctx) {
    const list = side === 'R' ? S().targets : S().shapes;
    const box = pane.box();
    for (const s of list) {
      if (!s.cundef || !s.cHid) continue;
      ctx.save();
      ctx.globalAlpha = 0.3; ctx.strokeStyle = A.shapeInk(s).edge; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      if (s.kind === 'point') { if (isXY(s.p)) { const [x, y] = pane.w2sxy(s.p[0], s.p[1]); ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke(); } }
      else {
        let cs = [];
        try { cs = Region.curvesOf(s, box); } catch (e) { cs = []; }
        ctx.beginPath();
        for (const c of cs) {
          const n = Math.max(48, Math.min(400, c.n0 || 64));
          for (let i = 0; i <= n; i++) { const z = c.f(i / n); if (!z || !Number.isFinite(z.re)) continue; const [x, y] = pane.w2s(z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  function drawPreview(pane, side, ctx, TH) {
    const d = draftC;
    // [review picture-3] the colour the new shape will take, for its stroke and its fill alike
    const ink = A.shapeInk({ ci: A.nextCi ? A.nextCi(side === 'R') : (side === 'R' ? S().targets.length : S().shapes.length) % 8 });
    const color = ink.edge;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    const P = d.picks.map((p) => p.z);
    for (const p of d.picks) {
      const [x, y] = pane.w2sxy(p.z[0], p.z[1]);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
    }
    if (d.tool === 'meet' && d.curve1) {
      const s = find(d.curve1.ref.s), pc = s && piecesOf(s)[d.curve1.ref.part];
      if (pc) { ctx.lineWidth = 4; ctx.globalAlpha = 0.35; strokePiece(pane, ctx, pc); ctx.globalAlpha = 1; }
    }
    const hv = d.hover;
    ctx.setLineDash([4, 3]);
    if (hv && d.tool === 'circle3' && P.length === 2) {
      let G = null;
      try { G = Constr.circle3(P[0], P[1], hv); } catch (e) { G = null; }
      if (G) {
        // the form the click will make (CORE's creation rule, SPEC 2.3): the disc, or the half-plane left of P -> Q
        const g0 = Constr.geomOf(G);
        if (G.A < 0 || (G.A === 0 && g0.d[0] * (P[1][0] - P[0][0]) + g0.d[1] * (P[1][1] - P[0][1]) < 0)) G = { o: G.o, A: -G.A, B: [-G.B[0], -G.B[1]], C: -G.C };
        const g = Constr.geomOf(G), fill = fillMode === 'in';
        const big = 4 * Math.hypot(pane.w, pane.h) / pane.view.s;
        if (g.line) {
          const L = clipLine(pane, g.p, g.d);
          if (fill) {
            // the region: the side of the line where the form is negative (against B), as a clipped polygon
            const c0 = pane.s2w(pane.w / 2, pane.h / 2), dl = Math.hypot(g.d[0], g.d[1]), u = [g.d[0] / dl, g.d[1] / dl], bl = Math.hypot(G.B[0], G.B[1]), nI = [-G.B[0] / bl, -G.B[1] / bl];
            const t0 = (c0.re - g.p[0]) * u[0] + (c0.im - g.p[1]) * u[1], q = (t) => [g.p[0] + (t0 + t) * u[0], g.p[1] + (t0 + t) * u[1]];
            const a = q(-big), b = q(big), corners = [a, b, [b[0] + big * nI[0], b[1] + big * nI[1]], [a[0] + big * nI[0], a[1] + big * nI[1]]];
            ctx.beginPath(); corners.forEach((z, i) => { const [x, y] = pane.w2sxy(z[0], z[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath();
            ctx.globalAlpha = 0.18; ctx.fillStyle = ink.c0; ctx.fill(); ctx.globalAlpha = 1;
          }
          if (L) { ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); ctx.stroke(); }
        } else {
          const [cx, cy] = pane.w2sxy(g.c[0], g.c[1]), r = g.r * pane.view.s;
          if (r < 1e6) {
            if (fill) {
              ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
              if (G.A < 0) ctx.rect(-pane.w, -pane.h, 3 * pane.w, 3 * pane.h);    // (the outside: even-odd with the pane)
              ctx.globalAlpha = 0.18; ctx.fillStyle = ink.c0; ctx.fill('evenodd'); ctx.globalAlpha = 1;
            }
            ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
          }
        }
      }
    } else if (hv && P.length === 1 && (d.tool === 'circle3' || d.tool === 'midpoint' || d.tool === 'bisector')) {
      const [x0, y0] = pane.w2sxy(P[0][0], P[0][1]), [x1, y1] = pane.w2sxy(hv[0], hv[1]);
      ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.globalAlpha = 1;
      if (d.tool === 'midpoint') { ctx.setLineDash([]); ctx.beginPath(); ctx.arc((x0 + x1) / 2, (y0 + y1) / 2, 4, 0, TAU); ctx.stroke(); }
      if (d.tool === 'bisector' && (x0 !== x1 || y0 !== y1)) {
        const m = [(P[0][0] + hv[0]) / 2, (P[0][1] + hv[1]) / 2], dd = [-(hv[1] - P[0][1]), hv[0] - P[0][0]];
        const L = clipLine(pane, m, dd);
        if (L) { ctx.beginPath(); ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); ctx.stroke(); }
      }
    }
    ctx.restore();
  }
  function clipLine(pane, p, d) {
    const L = Math.hypot(d[0], d[1]);
    if (!(L > 0)) return null;
    const u = [d[0] / L, d[1] / L], R = 2 * Math.hypot(pane.w, pane.h) / pane.view.s;
    const c = pane.s2w(pane.w / 2, pane.h / 2), t0 = (c.re - p[0]) * u[0] + (c.im - p[1]) * u[1];
    const a = pane.w2sxy(p[0] + (t0 - R) * u[0], p[1] + (t0 - R) * u[1]), b = pane.w2sxy(p[0] + (t0 + R) * u[0], p[1] + (t0 + R) * u[1]);
    return [a[0], a[1], b[0], b[1]];
  }
  function strokePiece(pane, ctx, pc) {
    ctx.beginPath();
    if (pc.kind === 'line') {
      const lo = Number.isFinite(pc.lo) ? pc.lo : -1e3, hi = Number.isFinite(pc.hi) ? pc.hi : 1e3;
      if (!Number.isFinite(pc.lo) || !Number.isFinite(pc.hi)) { const L = clipLine(pane, pc.a, [pc.b[0] - pc.a[0], pc.b[1] - pc.a[1]]); if (L) { ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); } }
      else { const a = pane.w2sxy(pc.a[0] + lo * (pc.b[0] - pc.a[0]), pc.a[1] + lo * (pc.b[1] - pc.a[1])), b = pane.w2sxy(pc.a[0] + hi * (pc.b[0] - pc.a[0]), pc.a[1] + hi * (pc.b[1] - pc.a[1])); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
    } else if (pc.kind === 'circle') {
      const [cx, cy] = pane.w2sxy(pc.c[0], pc.c[1]);
      ctx.arc(cx, cy, pc.r * pane.view.s, -pc.a0, -(pc.a0 + pc.span), true);
    } else (pc.pts || []).forEach((p, i) => { const q = pane.w2sxy(p[0], p[1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    ctx.stroke();
  }

  // ---------------------------------------------------------------- hover (no button): the ring before the press
  function hover(pane, side, x, y, e) {
    if (e) lastEv = e;
    const tool = A.tool();
    if (isCTool(tool) && hoverSide !== side && !draftC) { hoverSide = side; A.requestRender('OL', 'OR'); }
    if (tool === 'select' || tool === 'formula' || tool === 'curve' || tool === 'lasso' || tool === 'cgrid' || tool === 'pgrid') { if (ring) setRing(null, null); return; }
    if ((side === 'L' && (A.leftStage() > 0 || !A.lFlat())) || (side === 'R' && !A.targetsEditable())) { if (ring) setRing(null, null); return; }
    const cl = classesFor(tool, 'draw');
    let t = cl ? snapAt(side, x, y, cl) : null;
    if (isCTool(tool)) {
      if (!draftC || draftC.side !== side) draftC = draftC && draftC.picks.length ? draftC : { tool, side, picks: [], curve1: null, hover: null };
      const pane2 = A.setView(side);
      const z0 = pane2.s2w(x, y);
      draftC.hover = t ? t.z.slice() : [z0.re, z0.im];
      if (t && t.ref && draftC.picks.some((p) => p.ref && Constr.refKey(p.ref) === Constr.refKey(t.ref))) { setRing(side, t, $t('{x} needs distinct points', { x: toolName(tool) })); return; }
      if (t && tool === 'meet' && t.cls === 'point') t = snapAt(side, x, y, { points: false, cross: true, curves: true });
      if (t && t.ref && t.ref.img && !A.yWhole()) { setRing(side, t, $t('Draw in X to use {x}', { x: pointName(find(t.ref.img)) })); return; }
      A.requestRender('OL', 'OR');
    }
    setRing(side, t);
  }
  function pointer(e) { lastEv = e; }
  // the pointer left a plane: no hover preview and no ring there [review picture-3]
  function leave(side) {
    let ch = false;
    if (draftC && draftC.side === side && draftC.hover) { draftC.hover = null; ch = true; }
    if (ring && ring.side === side) { ring = null; ch = true; }
    if (ch) A.requestRender('OL', 'OR');
  }

  // ---------------------------------------------------------------- deletes, toasts
  // deleteShape's toast: "Deleted Circle 1 and 3 shapes built on it." / "2 shapes no longer follow it." (null: v15's)
  function deleteMessage(id) {
    const st = S();
    if (!st.shapes.concat(st.targets).some((s) => s.at || s.def)) return null;
    let plan;
    try { plan = Constr.deletePlan(st, [id]); } catch (e) { return null; }
    const n = plan.del.length - 1, f = new Set(plan.freed.map((x) => x.id)).size;
    if (!n && !f) return null;
    const x = nameById(id);
    const parts = [];
    if (n) parts.push($tn('Deleted {x} and {n} shape built on it.', 'Deleted {x} and {n} shapes built on it.', n, { x }));
    else parts.push(isT(find(id)) ? $t('Target deleted.') : $t('Shape deleted.'));
    if (f) parts.push($tn('{n} shape no longer follows it.', '{n} shapes no longer follow it.', f));
    return parts.join(' ');
  }
  function on(type, data) {
    events.push({ type, data });
    if (events.length > 50) events.shift();
    if (!A) return;
    if (type === 'loadFreed') setTimeout(() => A.toast($t('Some constructions could not be read and were opened as plain shapes.')), 0);
    // [review user-8] removing a zero that constructions use: the toast offers Undo, as a delete's does
    if (type === 'zpRemoved' && data && data.undef && data.undef.length) setTimeout(() => {
      const n = data.undef.length;
      A.undoToast($tn('{n} shape is now undefined.', '{n} shapes are now undefined.', n));
    }, 0);
    if (type === 'recomputed' && data && data.kindChanged && data.kindChanged.length) {
      for (const id of data.kindChanged) { const s = find(id); if (s && s.def && s.def.op === 'circle3') A.tourEmit('construct-family', { kind: s.kind === 'disc' && s.complement ? 'complement' : s.kind }); }
    }
  }
  // the zero being dragged off the plane: what a release does to the constructions on it
  function zpOffNote(k, kind, i) {
    const st = S().steps[k - 1];
    if (!st || !st.zpIds || !st.zpIds[kind]) return '';
    let plan;
    try { plan = Constr.zeroRemovePlan(S(), { zp: st.uid, kind, id: st.zpIds[kind][i] }); } catch (e) { return ''; }
    const n = plan.undef.length;
    return n ? $tn('Release to remove {mark}; {n} shape will be undefined', 'Release to remove {mark}; {n} shapes will be undefined', n, { mark: zMark(kind, i) }) : '';
  }

  // ---------------------------------------------------------------- rows, ⋯ items, hover links
  // updateShapeList's cell: true when this wrote it (a definition, a reason)
  function row(s, r) {
    if (!(s.def || s.at || s.cundef || s._atInf)) { if (r.box) r.box.classList.remove('cm-linked'); return false; }
    const d = r.d;
    let text = null, cls = 'cm-def';
    if (s.cundef) { text = reasonText(s.cundef); cls = 'err-msg'; }
    else if (s._atInf) text = s._note === 'parallel' ? `${pointName(s)} = ∞ · ${$t('They meet only at ∞')}` : `${pointName(s)} = ∞`;
    else if (s.def) text = defText(s);
    else if (s.at) text = boundText(s);
    if (text == null) {
      // a shape with only at: its equation (v15) and a link glyph; the tooltip says what it follows
      const sig = 'at|' + followsText(s);
      if (r.box) r.box.classList.add('cm-linked');
      if (r.row && !r.row.querySelector('.cm-link')) { const g = A.h('span', { class: 'cm-link', 'aria-hidden': 'true', html: LINK }); const nm = r.row.querySelector('.shape-name'); if (nm) nm.append(g); }
      if (r.row) { const g = r.row.querySelector('.cm-link'); if (g) g.title = followsText(s); }
      d.dataset.cm = sig;
      return false;
    }
    const sig = cls + '|' + text;
    if (d.dataset.cm !== sig) {
      d.dataset.cm = sig; d.dataset.tex = '';
      d.innerHTML = '';
      d.append(A.h('span', { class: cls }, text));
    }
    // [review user-11] the whole definition in the tooltip, the equation under it (the cell wraps to two lines)
    if (d.title && !d.title.startsWith(text)) d.title = text + '\n' + d.title; else if (!d.title) d.title = text;
    if (s.at && !s.def && r.row && !r.row.querySelector('.cm-link')) { const g = A.h('span', { class: 'cm-link', 'aria-hidden': 'true', html: LINK }); const nm = r.row.querySelector('.shape-name .k'); if (nm) nm.after(g); }
    if (s.at && r.row) { const g = r.row.querySelector('.cm-link'); if (g) g.title = followsText(s); if (r.box) r.box.classList.add('cm-linked'); }
    if (r.box) r.box.classList.toggle('cm-helper', !!s.helper);
    const eye = r.row && r.row.querySelector('.eye');
    if (eye) eye.disabled = !!s.cundef;
    return true;
  }
  const LINK = '<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M5 7l2-2M4.2 5.6L3 6.8a1.6 1.6 0 0 0 2.2 2.2l1.2-1.2M7.8 6.4L9 5.2A1.6 1.6 0 0 0 6.8 3L5.6 4.2"/></svg>';
  // the row's ⋯ menu: Make free, Use complement (flip), Other point, Show as point, Curve | Region
  function rowMenu(s, items) {
    if (!(s.def || s.at || s.helper)) return;
    const add = [];
    if (s.def && s.def.op === 'circle3') {
      const i = items.findIndex((it) => it && it.label && (it.label === $t('Use complement') || it.label === $t('Use the set itself')));
      if (i >= 0) items.splice(i, 1);
      if (s.def.fill === 'in') add.push({ label: $t('Use complement'), run: () => api.cm.setDef(s.id, { flip: !s.def.flip }) });
      add.push({ label: s.def.fill === 'in' ? $tx('construct', 'Curve') : $tx('construct', 'Region'), run: () => setFill(s, s.def.fill === 'in' ? 'none' : 'in') });
    }
    if (s.def && s.def.op === 'meet' && s.def.index !== 'finite' && !s.def.seed) add.push({ label: $t('Other point'), run: () => api.cm.setDef(s.id, { index: s.def.index === 1 ? 0 : 1 }) });
    if (s.helper) add.push({ label: $t('Show as point'), run: () => { delete s.helper; delete s.owner; A.shapesChanged(true); A.commit(); } });
    if (s.def || s.at) add.push({ label: $t('Make free'), run: () => api.cm.makeFree(s.id) });
    if (add.length) items.unshift(...add, 'sep');
    // Delete: the cascade count
    // [review user-7] the row's Delete by what it is (its icon, its label), never by a style flag
    const del = items.find((it) => it && typeof it === 'object' && (it.icon === 'trash' || it.label === $t('Delete')));
    if (del) { try { const n = Constr.deletePlan(S(), [s.id]).del.length - 1; if (n > 0) del.label = $tn('Delete (and {n} built on it)', 'Delete (and {n} built on it)', n); } catch (e) { /* */ } }
  }
  // Curve | Region of a 3-point circle: the kind changes, the definition stays
  function setFill(s, fill) {
    s.def.fill = fill;
    s.kind = fill === 'in' ? (s.kind === 'line' ? 'halfplane' : 'disc') : (s.kind === 'halfplane' ? 'line' : 'circle');
    if (fill !== 'in') delete s.complement;
    api.cm.setDef(s.id, { fill });
  }
  // the shapes linked to id (its sources, transitively, and what is built on it)
  function linked(id) {
    const out = new Set([id]);
    try {
      const g = graph();
      for (const u of g.users(id)) out.add(u);
      const st = [id];
      while (st.length) { const x = st.pop(); for (const d of g.sources(x)) if (!out.has(d)) { out.add(d); st.push(d); } }
    } catch (e) { /* */ }
    return out;
  }
  // helpers' rows go under their owner's row (SPEC 10; the list order, and so the names, stay as they are)
  function orderRows() {
    const host = document.getElementById('shapeList');
    if (!host) return;
    for (const s of S().shapes.concat(S().targets)) {
      if (!s.helper || !s.owner) continue;
      const me = host.querySelector(`.shape[data-id="${s.id}"]`), ow = host.querySelector(`.shape[data-id="${s.owner}"]`);
      if (me && ow && ow.nextSibling !== me) ow.after(me);
    }
  }
  // rows of the shapes linked to the hovered (or, on touch, the selected) one take --accent-soft
  function markLinks(id) {
    const ids = id && find(id) && (find(id).def || find(id).at || graph().users(id).size) ? linked(id) : null;
    for (const el of document.querySelectorAll('#shapeList .shape[data-id]')) el.classList.toggle('cm-link-on', !!ids && ids.has(el.dataset.id) && el.dataset.id !== id);
  }

  // ---------------------------------------------------------------- the plane menu's group (SPEC 11)
  function menuItems(ctx) {
    if (!A || ctx.surface !== 'flat') return [];
    const side = ctx.side;
    if (side === 'L' && (A.leftStage() > 0 || ctx.plane !== 'X')) return [];
    if (side === 'R' && !A.targetsEditable()) return [];
    const touch = !!ctx.touch, items = [];
    const t = snapAt(side, ctx.x, ctx.y, { points: true, cross: true, curves: true, touch });
    const target = side === 'R';
    if (t && t.cls === 'cross') items.push({ label: $t('Mark the intersection'), run: () => { const m = materialize(t, side, {}); api.cm.create(m.shapes, { target }); A.tourEmit('construct-added', { op: 'meet' }); } });
    if (t && t.cls === 'curve') items.push({ label: $t('Point on this curve'), run: () => { const m = materialize(t, side, {}); api.cm.create(m.shapes, { target }); A.tourEmit('construct-added', { op: 'glider' }); } });
    if (t && t.cls === 'point') {
      const start = (tool) => () => { A.setTool(tool); draftC = { tool, side, picks: [t], curve1: null, hover: null }; A.requestRender('OL', 'OR'); };
      items.push({ label: $t('Circle through this point…'), run: start('circle3') });
      items.push({ label: $t('Midpoint with…'), run: start('midpoint') });
      // a free point on a curve: put it on the curve
      const p = t.ref.s && !t.ref.h ? find(t.ref.s) : null;
      if (p && !p.def && !p.at) {
        // [review math-6] never a curve built on this point (a cycle): the point and everything built on it are excluded
        let ex;
        try { ex = new Set([p.id, ...graph().users(p.id)]); } catch (e) { ex = new Set([p.id]); }
        const c = snapAt(side, ctx.x, ctx.y, { points: false, cross: false, curves: true, touch, exclude: ex });
        if (c) items.push({ label: $t('Put on this curve'), run: () => { const def = { op: 'glider', args: [c.ref] }; if (c.seed) def.seed = c.seed; api.cm.setDef(p.id, { def, t: c.t }); } });
      }
    }
    // a constructed shape under the press: Make free
    const hit = hitShape(side, ctx.x, ctx.y);
    if (hit && (hit.def || hit.at)) items.push({ label: $t('Make free'), run: () => api.cm.makeFree(hit.id) });
    return items;
  }
  function hitShape(side, x, y) {
    const pane = A.setView(side), z = pane.s2w(x, y), tol = 7 / pane.view.s;
    const list = (side === 'R' ? S().targets : S().shapes).filter((s) => s.visible !== false).slice().reverse();
    for (const s of list) { try { if (Region.hitTest(s, z, tol, A.win(side))) return s; } catch (e) { /* */ } }
    return null;
  }

  // ---------------------------------------------------------------- the Inspector's Construction view (SPEC 7)
  function inspectorSig() {
    const id = A && A.selected();
    const s = id && find(id);
    if (!s || !(s.def || s.at)) return null;
    return `C#${s.id}#${s.kind}#${s.def ? s.def.op + s.def.fill + s.def.index : 'at'}#${I18N.lang}#${!!s.cundef}`;
  }
  // [review user-15] what t means on the curve a point slides on, and the range a number for it should take
  function tMeaning(s) {
    const r = s.def && s.def.args && s.def.args[0], c = r && find(r.s);
    if (!c) return null;
    const pc = piecesOf(c)[r.part];
    if (!pc || pc.kind === 'none' || pc.kind === 'traced') return null;
    if (c.def && c.def.op === 'circle3') {
      const [p, q, rr] = c.def.args.map((x) => refName(x));
      return { text: $t('0 at {p}, ¼ at {q}, ½ at {r}', { p, q, r: rr }), range: [0, 1] };
    }
    if (pc.poly) { const n = pc.poly.pts.length; return { text: $t('sides: 0 at vertex 1, {n} once round', { n }), range: [0, n] }; }
    if (pc.kind === 'circle' && pc.closed) return { text: $t('turns, 0 at the right'), range: [0, 1] };
    return { text: $t('0 = start, 1 = end'), range: [0, 1] };
  }
  function inspectorBuild() {
    const s = find(A.selected());
    const h = A.h;
    const head = h('div', { class: 'ihead cm-ihead' }, h('span', { class: 'swatch', 'data-kind': A.kindType(s), style: A.swatchStyle(s) }), h('span', { class: 'ttl' }, shapeLabel(s)));
    const def = h('div', { class: 'cm-idef' });
    const warn = h('div', { class: 'cm-iwarn', role: 'status' });
    const uses = h('div', { class: 'cm-ichips' }), used = h('div', { class: 'cm-ichips' });
    const fields = h('div', { class: 'cm-ifields' });
    const acts = h('div', { class: 'cm-iacts' });
    const root = h('div', { class: 'cm-insp' }, head, h('div', { class: 'cm-ilabel' }, $t('Construction')), def, warn,
      h('div', { class: 'cm-ilabel' }, $t('Uses')), uses, h('div', { class: 'cm-ilabel' }, $t('Used by')), used, fields, acts);
    // a chip per shape (hover: highlighted in X; click: selected), plain for a zero or ∞
    const chip = (id, label) => (id ? h('button', { type: 'button', class: 'cm-chipbtn', onclick: () => A.select(id), onpointerenter: () => A.hoverShape(id), onpointerleave: () => A.hoverShape(null) }, label || nameById(id)) : h('span', { class: 'cm-chipbtn cm-plain' }, label));
    // fields
    if (s.def && s.def.op === 'circle3') {
      const seg = h('div', { class: 'seg cm-iseg', role: 'group' });
      for (const [v, lab] of [['none', $tx('construct', 'Curve')], ['in', $tx('construct', 'Region')]]) seg.append(h('button', { type: 'button', class: (s.def.fill === 'in') === (v === 'in') ? 'on' : '', 'aria-pressed': String((s.def.fill === 'in') === (v === 'in')), onclick: () => setFill(s, v) }, lab));
      fields.append(seg);
      if (s.def.fill === 'in') fields.append(h('label', { class: 'cm-icheck' }, h('input', { type: 'checkbox', checked: s.complement ? true : null, onchange: () => api.cm.setDef(s.id, { flip: !s.def.flip }) }), $t('Use complement')));
    }
    if (s.def && s.def.op === 'meet' && s.def.index !== 'finite' && !s.def.seed) fields.append(h('button', { type: 'button', class: 'btn', onclick: () => api.cm.setDef(s.id, { index: s.def.index === 1 ? 0 : 1 }) }, $t('Other point')));
    if (s.def && s.def.op === 'glider' && Number.isFinite(s.t)) {
      const meaning = tMeaning(s);
      const inp = h('input', { class: 'inp mono cm-it', value: s.bind && s.bind.t ? s.bind.t : String(+s.t.toPrecision(6)), 'aria-label': 't' + (meaning ? ' (' + meaning.text + ')' : ''), spellcheck: 'false' });
      const err = h('div', { class: 'field-err cm-ierr', role: 'alert', hidden: true });
      const showErr = (m) => { inp.classList.toggle('bad', !!m); inp.setAttribute('aria-invalid', String(!!m)); err.textContent = m || ''; err.hidden = !m; };
      // a number, or a formula in the shared numbers (v15's bind: t = a moves the point along its curve with a).
      // [review user-1] a new name makes the number first, as v15's other fields do ("Re z = a"), starting at the
      // point's t and with the curve's range [user-15]; bad input says why under the field
      inp.addEventListener('change', () => {
        const txt = inp.value.trim().replace(/−/g, '-');
        let v = Number(txt), added = null;
        if (txt && !Number.isFinite(v) && typeof Params !== 'undefined') {
          const u = Params.unknownIn(txt);
          if (u.length > 1) { showErr($t('One new name at a time: {x}', { x: u.map(Params.display).join(', ') })); return; }
          if (u.length === 1) {
            const c = Params.check(u[0]);
            if (c.error) { showErr(c.error); return; }
            const [lo, hi] = meaning ? meaning.range : [0, 1];
            try { Params.add(c.name, { value: +s.t.toPrecision(6), min: lo, max: hi }); added = c.name; } catch (e) { showErr(e.message); return; }
          }
          try { v = Params.evalReal(txt); } catch (e) { showErr(e && e.message ? e.message : $t('This is not a number')); return; }
        }
        if (!Number.isFinite(v)) { showErr($t('This is not a number')); return; }
        showErr(null);
        A.bindField(s, 't', txt);
        api.cm.setDef(s.id, { t: v });
        if (added) setTimeout(() => A.undoToast($t('Added the number {x}', { x: Params.display(added) })), 0);
      });
      fields.append(h('label', { class: 'cm-ifield' }, h('i', null, 't'), inp, meaning ? h('span', { class: 'cm-imean' }, meaning.text) : null), err);
    }
    acts.append(h('button', { type: 'button', class: 'btn', onclick: () => api.cm.makeFree(s.id) }, $t('Make free')));
    let n = 0;
    try { n = Constr.deletePlan(S(), [s.id]).del.length - 1; } catch (e) { n = 0; }
    acts.append(h('button', { type: 'button', class: 'btn danger', onclick: () => A.deleteShape(s.id) }, n ? $tn('Delete (and {n} built on it)', 'Delete (and {n} built on it)', n) : $t('Delete')));
    const E = { kind: 'construct', root, def, warn, uses, used, id: s.id, chip };
    return E;
  }
  function inspectorFill(E) {
    const s = find(E.id);
    if (!s) return;
    const t = s.def ? defText(s) : followsText(s);
    if (E.def.textContent !== t) E.def.textContent = t;
    const w = s.cundef ? reasonText(s.cundef) : '';
    if (E.warn.textContent !== w) E.warn.textContent = w;
    E.warn.hidden = !w;
    let g;
    try { g = graph(); } catch (e) { return; }
    const refs = s.def ? s.def.args : s.at ? Object.values(s.at) : [];
    const src = [];
    for (const r of refs) { const nm = refName(r), id = r.meet ? null : r.s || r.img || null; if (!src.some((x) => x[1] === nm)) src.push([id, nm]); }
    const us = [...g.users(s.id)];
    const sig = src.map((x) => x.join(':')).join(',') + '|' + us.join(',') + '|' + I18N.lang;
    if (E.uses.dataset.sig !== sig) {
      E.uses.dataset.sig = sig;
      E.uses.replaceChildren(...(src.length ? src.map(([id, nm]) => E.chip(id, nm)) : [A.h('span', { class: 'cm-none' }, '—')]));
      E.used.replaceChildren(...(us.length ? us.map((id) => E.chip(id)) : [A.h('span', { class: 'cm-none' }, '—')]));
    }
  }

  // ---------------------------------------------------------------- export phrases (SPEC 12)
  // a caption phrase for capT: {src, params}; values are text or {m: TeX} (the app sets the maths: z₂ = −1 − 1.5i)
  const SUBR = { '₀': 0, '₁': 1, '₂': 2, '₃': 3, '₄': 4, '₅': 5, '₆': 6, '₇': 7, '₈': 8, '₉': 9 };
  // a point's name as TeX (z₂ -> z_{2}, ζ₁ -> \zeta_{1}, z₀″ -> z_{0}''), or null for a name in words
  function nameTex(nm) {
    if (/^[A-Za-z]$/.test(nm)) return nm;            // (a user's one-letter label)
    const m = /^([a-zζ])([₀-₉]+)([′″‴]*)$/u.exec(nm);
    if (!m) return nm === '∞' ? '\\infty' : null;
    const base = m[1] === 'ζ' ? '\\zeta' : m[1];
    return `${base}_{${[...m[2]].map((c) => SUBR[c]).join('')}}${"'".repeat([...m[3]].reduce((n, c) => n + ('′″‴'.indexOf(c) + 1), 0))}`;
  }
  // [review picture-7] a caption names each point once with its value (a point shape's own phrase does: "the point
  // $z_0=-1.5$"), so a definition names point shapes by their label only (the figure labels them), a zero by name and
  // value, a handle by its value; curves by their maths (the app's own phrase of the curve, in the genitive), never by
  // a row name; a line bound at both ends by its points
  function phrase(s, texOf) {
    if (!s || !(s.def || s.at)) return null;
    const d = s.def, plane = isT(s) ? 1 : 0;
    const val = (r) => { try { const res = Constr.resolve(S(), r, plane, env()); return res && res.z ? res.z : null; } catch (e) { return null; } };
    const R = (r) => {
      if (!r) return '?';
      if (r.inf) return { m: '\\infty' };
      const z = val(r);
      if (r.s && !r.h && r.part == null) {
        const p = find(r.s), t = p ? nameTex(pointName(p)) : null;
        if (t && p.visible !== false && !p.helper) return { m: t };
        return z ? { m: texOf(z) } : refName(r);
      }
      const t = nameTex(refName(r));
      if (t) return { m: z ? `${t}=${texOf(z)}` : t };
      return z ? { m: texOf(z) } : refName(r);
    };
    const self = () => { const t = nameTex(pointName(s)); return t ? { m: isXY(s.p) ? `${t}=${texOf(s.p)}` : t } : pointName(s); };
    const CM = (ref) => {
      const c = find(ref.s);
      if (!c) return '?';
      const pcs = piecesOf(c), pc = pcs[ref.part];
      if (pcs.length > 1 && pc && pc.kind === 'line' && Number.isFinite(pc.lo) && Number.isFinite(pc.hi)) {
        const a = Constr.glide(Object.assign({}, pc, { poly: null, arc3: null }), pc.lo), b = Constr.glide(Object.assign({}, pc, { poly: null, arc3: null }), pc.hi);
        if (A.capPhrase && isXY(a) && isXY(b)) return A.capPhrase({ id: '', kind: 'segment', a, b }, 'gen');
      }
      return A.capPhrase ? A.capPhrase(c, 'gen') : curveName(ref);
    };
    if (!d) {
      if (!s.at || !s.at.a || !s.at.b) return null;
      const a = R(s.at.a), b = R(s.at.b);
      switch (s.kind) {
        case 'line': return { src: 'the line through {a} and {b}', params: { a, b } };
        case 'segment': return { src: 'the segment from {a} to {b}', params: { a, b } };
        case 'ray': return { src: 'the ray from {a} through {b}', params: { a, b } };
        case 'halfplane': return s.complement ? { src: 'the half-plane to the right of the line from {a} to {b}', params: { a, b } } : { src: 'the half-plane to the left of the line from {a} to {b}', params: { a, b } };
      }
      return null;
    }
    const P = (i) => R(d.args[i]);
    if (d.op === 'circle3') {
      if (d.fill !== 'in') return s.kind === 'line' ? { src: 'the line through {a}, {b} and {c}', params: { a: P(0), b: P(1), c: P(2) } } : { src: 'the circle through {a}, {b} and {c}', params: { a: P(0), b: P(1), c: P(2) } };
      if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return { src: 'the half-plane to the left of the line from {a} to {b}', params: { a: P(i), b: P(j) } }; }
      if (s.complement) return { src: 'the outside of the circle through {a}, {b} and {c}', params: { a: P(0), b: P(1), c: P(2) } };
      return { src: 'the disc bounded by the circle through {a}, {b} and {c}', params: { a: P(0), b: P(1), c: P(2) } };
    }
    if (d.op === 'meet') return { src: 'the intersection {x} of {c1} and {c2}', params: { x: self(), c1: CM(d.args[0]), c2: CM(d.args[1]) } };
    if (d.op === 'midpoint') return { src: 'the midpoint {x} of {a} and {b}', params: { x: self(), a: P(0), b: P(1) } };
    if (d.op === 'glider') return { src: 'the point {x} on {c}', params: { x: self(), c: CM(d.args[0]) } };
    if (d.op === 'bisector') return { src: 'the perpendicular bisector of {a} and {b}', params: { a: P(0), b: P(1) } };
    return null;
  }
  // (the caption templates, for the Russian table's call-site scan: capT translates them at run time)
  const CAPTIONS = () => [$t('the line through {a}, {b} and {c}'), $t('the circle through {a}, {b} and {c}'), $t('the half-plane to the left of the line from {a} to {b}'),
    $t('the half-plane to the right of the line from {a} to {b}'), $t('the line through {a} and {b}'), $t('the segment from {a} to {b}'), $t('the ray from {a} through {b}'),
    $t('the outside of the circle through {a}, {b} and {c}'), $t('the disc bounded by the circle through {a}, {b} and {c}'), $t('the intersection {x} of {c1} and {c2}'),
    $t('the midpoint {x} of {a} and {b}'), $t('the point {x} on {c}'), $t('the perpendicular bisector of {a} and {b}')];

  // ---------------------------------------------------------------- the tool rows, the grid, the CSS, the keys
  const tsvg = (inner) => `<svg class="tic" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="1.9" fill="currentColor" stroke="none"/>`;
  const ICON = {
    circle3: tsvg('<circle cx="10" cy="10.5" r="6.5"/>' + dot(4.4, 7.3) + dot(15.6, 7.3) + dot(10, 17)),
    meet: tsvg('<path d="M3 15.5L17 4.5M3 6.5c4 0 9 3 14 9"/><circle cx="10.1" cy="9.4" r="2.6" fill="none" stroke-width="1.3"/>'),
    midpoint: tsvg('<path d="M3.5 14.5l13-9"/>' + dot(3.5, 14.5) + dot(16.5, 5.5) + '<circle cx="10" cy="10" r="2.3" fill="none" stroke-width="1.3"/>'),
    bisector: tsvg('<path d="M3.5 13.5l13-7" stroke-opacity=".55"/>' + dot(3.5, 13.5) + dot(16.5, 6.5) + '<path d="M6.6 2.5l6.8 15"/><path d="M10.9 9.5l.7 1.5-1.5.7"/>'),
  };
  function toolRows() {
    return [
      ['circle3', $t('Circle through 3 points'), '', $t('Pick three points: points on the page, crossings, or empty spots. The circle and its disc follow them.'), 'construct', $t('3 points')],
      ['meet', $t('Intersect'), '', $t('Click a crossing of two curves, or one curve and then another.'), 'construct', $t('Intersect')],
      ['midpoint', $t('Midpoint'), '', $t('Pick two points, or a segment.'), 'construct', $t('Midpoint')],
      ['bisector', $t('Perpendicular bisector'), '', $t('Pick two points, or a segment: the line of the points equally far from both.'), 'construct', $t('Bisector')],
    ];
  }
  const CSS = `
.cm-head { display: flex; align-items: center; margin: 10px 0 4px; font: var(--t-label); color: var(--muted); letter-spacing: .02em; }
.empty-chip > .cm-chip { display: inline-flex; align-items: center; gap: 8px; pointer-events: auto; overflow: visible; min-width: 0; flex: 1 1 auto; }
.cm-chip > .cm-t { overflow: hidden; min-width: 0; flex: 0 1 auto; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.25; }
.draft-chip.cm-on { height: auto; min-height: 32px; padding-top: 3px; padding-bottom: 3px; width: max-content; }
.cm-seg.cm-icons .cm-sb { display: inline-flex; align-items: center; padding: 2px 6px; }
.cm-chip > .cm-seg, .cm-chip > .cm-x { flex: 0 0 auto; }
.draft-chip.cm-on { pointer-events: auto; padding: 0 4px 0 10px; }
.cm-seg { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r-2, 6px); overflow: hidden; }
.cm-sb { border: 0; background: transparent; color: var(--ink-2); font: var(--t-label); padding: 2px 8px; cursor: pointer; }
.cm-sb.on { background: var(--inverse); color: var(--inverse-ink); }
.cm-x { border: 0; background: transparent; color: var(--ink-2); font-size: 18px; line-height: 1; width: 28px; height: 28px; cursor: pointer; }
.shape .d .cm-def { color: var(--ink-2); font: var(--t-label); }
/* [review user-11] a definition (or a reason) wraps to two lines in its row instead of being cut */
.shape-row:has(> .shape-name .cm-def, > .shape-name .d[data-cm] > .err-msg) { height: auto; min-height: 32px; padding-top: 4px; padding-bottom: 4px; }
.shape-name:has(.cm-def, .d[data-cm] > .err-msg) { align-items: baseline; flex-wrap: wrap; white-space: normal; -webkit-mask-image: none; mask-image: none; }
/* [v16 verify-4] too narrow beside the name: the definition takes the row's full width under it */
.shape-name .d:has(> .cm-def, > .err-msg)[data-cm] { flex: 1 1 8em; min-width: 0; }
.shape .d[data-cm] > .cm-def, .shape .d[data-cm] > .err-msg { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; line-height: 15px; }
.shape.cm-helper > .shape-row { padding-left: 18px; }
.shape .cm-link { display: inline-flex; vertical-align: middle; margin-left: 4px; color: var(--muted); }
.shape.cm-link-on > .shape-row { background: var(--accent-soft); }
.rail-sep { width: 18px; height: 1px; background: var(--line); margin: 4px 0; flex: 0 0 auto; }
#railTools.cm-tight1 > .rail-tool:is([data-tool="cgrid"], [data-tool="pgrid"]), #railTools.cm-tight2 > .rail-tool:is([data-tool="curve"], [data-tool="lasso"]) { display: none; }
.cm-insp { display: flex; flex-direction: column; gap: 4px; }
.cm-ihead { margin-bottom: 4px; }
.cm-ilabel { font: var(--t-label); color: var(--muted); margin-top: 8px; }
.cm-idef { font: var(--t-body); color: var(--ink); }
.cm-iwarn { color: var(--warn); font: var(--t-label); }
.cm-ichips { display: flex; flex-wrap: wrap; gap: 4px; }
.cm-chipbtn { border: 1px solid var(--line); background: var(--surface); color: var(--ink); border-radius: 999px; padding: 2px 8px; font: var(--t-label); cursor: pointer; }
.cm-chipbtn:not(.cm-plain):hover { border-color: var(--accent); color: var(--accent); }
.cm-chipbtn.cm-plain { cursor: default; }
.cm-none { color: var(--muted); font: var(--t-label); }
.cm-ifields, .cm-iacts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px; }
.cm-icheck, .cm-ifield { display: inline-flex; align-items: center; gap: 6px; font: var(--t-label); color: var(--ink-2); }
.cm-it { width: 90px; }
.field.cm-boundf { display: flex; align-items: center; gap: 6px; }
.field.cm-boundf > .cm-bound { flex: 1 1 auto; min-width: 0; color: var(--ink-2); background: var(--surface-2, transparent); cursor: default; }
.field.cm-boundf > .cm-free { flex: 0 0 auto; }
.cm-imean { color: var(--muted); font: var(--t-label); }
.cm-ierr { color: var(--warn); font: var(--t-label); width: 100%; }
.ph-tiles > .cm-ph { grid-column: 1 / -1; margin: 8px 0 2px; }
@media (max-width: 767px) { #secDraw > #cmHead, #secDraw > #constructTools { display: none; } }
:root.ph #secDraw > #cmHead, :root.ph #secDraw > #constructTools { display: none !important; }   /* (phone.css shows #secDraw > .tools with !important) */
:root.ph .draft-chip.cm-on { left: 8px; translate: none; max-width: calc(100% - 68px); }
`;
  function buildGrid() {
    const tools = document.getElementById('tools');
    if (!tools || document.getElementById('constructTools')) return document.getElementById('constructTools');
    css();
    const head = document.createElement('div');
    Object.assign(head, { className: 'cm-head', id: 'cmHead', textContent: $t('Construct') });
    head.setAttribute('role', 'heading'); head.setAttribute('aria-level', '3');
    const grid = document.createElement('div');
    Object.assign(grid, { className: 'tools', id: 'constructTools' });
    grid.setAttribute('role', 'toolbar'); grid.setAttribute('aria-label', $t('Construction tools'));
    tools.after(head, grid);
    return grid;
  }
  function css() { if (!document.getElementById('cmStyle')) { const st = document.createElement('style'); st.id = 'cmStyle'; st.textContent = CSS; document.head.append(st); } }
  function keydown(e) {
    if (!draftC || !A) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // (a draft without picks lets Esc through: it closes what the app's Esc closes)
    const has = !!(draftC.picks.length || draftC.curve1);
    if (e.key === 'Escape' && has) { cancel(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Backspace' && has) { back(); e.preventDefault(); e.stopPropagation(); }
  }
  // the tablet rail (SPEC 5.4): when it would overflow the panel, Grid and Polar grid leave it first (they stay in the
  // drawer), then Freehand and Lasso
  function fitRail() {
    const rail = document.getElementById('railTools');
    if (!rail || !rail.offsetParent) return;
    const box = rail.closest('.panel') || rail.parentElement;
    const over = () => box.scrollHeight > box.clientHeight + 1;
    rail.classList.remove('cm-tight1', 'cm-tight2');
    if (over()) rail.classList.add('cm-tight1');
    if (over()) rail.classList.add('cm-tight2');
  }
  function ui(adapter) {
    A = adapter;
    css();
    try { const rail = document.getElementById('railTools'); if (rail && window.ResizeObserver) { const ro = new ResizeObserver(() => fitRail()); ro.observe(rail.closest('.panel') || rail.parentElement); } } catch (e) { /* */ }
    window.addEventListener('keydown', keydown, true);
    if (typeof PlaneMenu !== 'undefined') PlaneMenu.register('constructions', menuItems);
  }
  // the command palette: the four tools; Make free and Use complement for a selected construction (SPEC 5.6)
  function paletteActs() {
    const out = CTOOLS.map((id) => [toolName(id), () => A.setTool(id), '']);
    const s = A.selected() && find(A.selected());
    if (s && (s.def || s.at)) out.push([$t('Make free'), () => api.cm.makeFree(s.id), '']);
    if (s && s.def && s.def.op === 'circle3' && s.def.fill === 'in') out.push([$t('Use complement'), () => api.cm.setDef(s.id, { flip: !s.def.flip }), '']);
    return out;
  }
  // a tool change: the draft goes, the chip follows
  function toolChanged() { if (draftC && draftC.tool !== A.tool()) draftC = null; gestSnap = null; ring = null; }
  // TEMP-DEBUG-HOOK (removed before publishing)
  function debug() {
    return { ring: ring ? { side: ring.side, z: ring.z, ref: ring.ref, cls: ring.cls, chip: ring.chip } : null, draft: draftC ? { tool: draftC.tool, side: draftC.side, picks: draftC.picks.map((p) => ({ cls: p.cls, z: p.z, ref: p.ref })), curve1: draftC.curve1 && draftC.curve1.ref } : null, fill: fillMode, events: events.map((e) => e.type) };
  }
  // TEMP-DEBUG-HOOK
  // (every entry point is inert until the app's adapter arrives: init() builds the tools before Construct.ui runs)
  const g = (f, d) => (...a) => (A && api ? f(...a) : d);
  return {
    init(a) { api = a; },
    on, ui, toolRows, ICON, buildGrid, CTOOLS, isTool: isCTool,
    vertexPick: g(vertexPick, null), bindVertices: g(bindVertices), globeClick: g(globeClick, false), boundUnder: g(boundUnder, null), snapAt: g(snapAt, null), drawStart: g(drawStart, null), drawMove: g(drawMove, null), drawEnd: g(drawEnd), pointDown: g(pointDown, false),
    handleMove: g(handleMove, null), handleUp: g(handleUp), moveDrag: g(moveDrag, false), click: g(click, false), toolDown: g(toolDown, false), cancel: g(cancel, false), back: g(back, false),
    hover: g(hover), pointer, leave: g(leave), drawOverlay: g(drawOverlay), syncChip: g(syncChip), chipSide: g(chipSide, null), toolChanged: g(toolChanged), deleteMessage: g(deleteMessage, null), zpOffNote: g(zpOffNote, ''),
    row: g(row, false), rowMenu: g(rowMenu), markLinks: g(markLinks), orderRows: g(orderRows), linked: g(linked, new Set()),
    defText: g(defText, null), reasonText: g(reasonText, ''), refName: g(refName, ''), shapeLabel: g(shapeLabel, ''), pointName: g(pointName, ''), followsText: g(followsText, ''), phrase: g(phrase, null), menuItems: g(menuItems, []),
    inspectorSig: g(inspectorSig, null), inspectorBuild, inspectorFill, setFill, paletteActs: g(paletteActs, []), CAPTIONS,
    // TEMP-DEBUG-HOOK (removed before publishing)
    debug,
    // TEMP-DEBUG-HOOK
    pointMark: (s) => (s.helper ? 'helper' : s.def && s.def.op !== 'glider' ? 'ring' : null),
    get api() { return api; },
    get events() { return events.slice(); },
    get fill() { return fillMode; }, set fill(v) { fillMode = v === 'none' ? 'none' : 'in'; },
  };
})();
if (typeof module !== 'undefined') module.exports = Construct;
