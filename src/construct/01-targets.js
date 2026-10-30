  let api = null;          // CORE: {cm}
  let A = null;            // the app's adapter (app.js cmUiApi)
  const events = [];
  const TAU = 2 * Math.PI;
  // ([v16.5 UX55] the seventh: Hyperbolic line, the Perpendicular circle with only its arc on the points' side of C)
  // the segment choice of the tool: the Perpendicular circle's four (Whole | Inside | Outside | Between), the Hyperbolic line's two
  const effSeg = (tool) => (tool === 'hyper' ? hyperMode : segMode);
  const CTOOLS = ['circle3', 'meet', 'midpoint', 'bisector', 'perp', 'touch', 'hyper'];
  // (perp: P and Q are the picks; its curve is draftC.curve1, as Intersect's first curve: notes/orthogonal-circle/SPEC.md 4;
  // touch: T and P, either order, on the curve draftC.curve1: notes/orthogonal-circle/TANGENT-SPEC.md 4)
  const NEED = { circle3: 3, midpoint: 2, bisector: 2, meet: 2, perp: 2, touch: 2, hyper: 2 };
  // the tools whose first pick is a line or a circle that stays picked
  const CURVE1 = new Set(['perp', 'touch', 'hyper']);
  const GRID = new Set(['cgrid', 'pgrid']);
  const POS = /^(p|a|b|m|c|v\d+)$/;
  const SUBD = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (k) => String(k).split('').map((d) => SUBD[+d] ?? d).join('');
  const isXY = (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  let ring = null;         // the current snap: {side, z, ref, cls, chip, touch, warn}
  let draftC = null;       // a construction tool's picks: {tool, side, picks: [{ref, z, make}], curve1, hover}
  let fillMode = 'in';     // Curve | Region for Circle through 3 points (the session's choice; Region by default)
  let hyperMode = 'in';    // [issue #70] the Hyperbolic line tool: Inside (the whole line) | Between (the segment between the two points)
  let segMode = 'whole';   // [v16.4 segments] Whole | Inside | Outside ([v16.5 UX55]) for the Perpendicular circle (the session's choice; never saved)
  let pickWarnMsg = null, pickWarnT = 0, lastToast = null, howOpen = false;   // [v16.5 UX52] a pick's refusal, shown in the chip for 2 s; [UX48] the how-to unfolded
  let lastEv = null;       // the last pointer event over a plane (touch, Alt)
  let moveChipShown = false;
  let gestSnap = null;     // a drawing gesture's snaps: {start, end} targets
  let rail = null;         // [v16.5 rail] a point sliding on its curve: {side, pc, ink, stretch: {a, b, k} | null}
  let freeChip = null;     // a chip by a point for 1.2 s ("z₂ is free" after a pull, "built from … drag those"): {side, id, text, until, Z}
  const pcache = new Map();

  // ---------------------------------------------------------------- small helpers
  const S = () => A.S();
  const find = (id) => S().shapes.find((x) => x.id === id) || S().targets.find((x) => x.id === id) || null;
  const isT = (s) => !!s && S().targets.includes(s);
  const touchNow = () => !!lastEv && (lastEv.pointerType === 'touch' || lastEv.pointerType === 'pen');
  // [v16.5 rail SPEC 1.1] the radii in screen px: points p, curves c (a finger 14, was 10), the grid lattice g, a rail's
  // detents det
  const radii = (touch) => (touch ? { p: 22, c: 14, g: 12, det: 10 } : { p: 8, c: 6, g: 9, det: 6 });
  const TAN_EPS = 0.5;     // the touching circle's P this close to the tangent at T (px) makes the tangent line
  const altNow = () => !!(A.altHeld() || (lastEv && lastEv.altKey));
  const env = () => (api && api.cm ? api.cm.env() : {});
  const graph = () => Constr.graph(S());
  const isCTool = (t) => CTOOLS.includes(t);
  // a circle given by points (3 points, the perpendicular circle's 2, a touching circle's T and finite P): the Curve |
  // Region controls, Use complement, the glider parameter (CORE's pts3). Tangent lines stay out, as bisector does
  const isCirc3 = (s) => !!(s && s.def && (s.def.op === 'circle3' || s.def.op === 'perp' || (s.def.op === 'touch' && !(s.def.args[2] && s.def.args[2].inf))));
  // [review regress-4] the pieces of a shape, cached on a cheap signature of the fields pieces read (a long point list,
  // a freehand stroke of 2000 points, by its length and every 64th point: it is moved whole), never a JSON.stringify
  // of the whole shape per pointer move; a formula curve also by the window it is traced in
  function pieceSig(s) {
    const pts = Array.isArray(s.pts) ? s.pts : null;
    let ps = '';
    if (pts) { const k = pts.length <= 64 ? 1 : 64; ps = pts.length + ':'; for (let i = 0; i < pts.length; i += k) ps += pts[i] + ';'; ps += pts[pts.length - 1]; }
    // (a touching circle's or a tangent's piece also carries C's form, tch: K's form can stay while C's changes)
    const tc = s._g && s._g.tch, g = s._g ? s._g.A + ',' + s._g.B + ',' + s._g.C + ',' + s._g.o + (tc ? '|' + tc.G.A + ',' + tc.G.B + ',' + tc.G.C + ',' + tc.G.o + ',' + tc.tp : '') : '';
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
    if (pc.kind === 'circle' && !pc.closed && !pc.arc3 && !pc.seg) {
      const dx = z[0] - pc.c[0], dy = z[1] - pc.c[1], rr = Math.hypot(dx, dy);
      const u = ((((Math.atan2(dy, dx) - pc.a0) % TAU) + TAU) % TAU);
      if (u <= pc.span) return Math.abs(rr - pc.r);
      const e = (a) => Math.hypot(pc.c[0] + pc.r * Math.cos(a) - z[0], pc.c[1] + pc.r * Math.sin(a) - z[1]);
      return Math.min(e(pc.a0), e(pc.a0 + pc.span));
    }
    return Constr.pieceDist(pc, z);
  }
  // Whether two pieces lie on each other around z (a curve drawn exactly on a display curve, e.g. a path along |z| = 1),
  // so that a "crossing" meetNear reports there is none. The points of pa 6 px off z along it (found by projecting the
  // four probes z +- 6 px onto pa; a probe that lands near z says nothing) must lie within 0.5 px of pb. A real crossing
  // leaves them 6 px * sin(angle) apart: only one under about 5 degrees counts as coincident. sc: px per world unit.
  function coincideAt(pa, pb, z, sc) {
    const e = 6 / sc, tol = 0.5 / sc;
    let n = 0;
    for (const [dx, dy] of [[e, 0], [-e, 0], [0, e], [0, -e]]) {
      let pr = null;
      try { pr = Constr.projectPiece(pa, [z[0] + dx, z[1] + dy]); } catch (err) { pr = null; }
      if (!pr || !isXY(pr.z) || Math.hypot(pr.z[0] - z[0], pr.z[1] - z[1]) < e / 2) continue;
      if (pieceDist(pb, pr.z) > tol) return false;
      n++;
    }
    return n >= 2;
  }
  // the three defining points of a circle3 (for the glider parameter; one may be ∞), as CORE's pts3Of [math-12]; a
  // perpendicular circle's M(R) map at P
  function pts3Of(s, plane) {
    if (!isCirc3(s)) return null;
    try { return Constr.pts3(S(), s, plane, env()); } catch (e) { return null; }
  }

  // ---------------------------------------------------------------- names and texts
  // a point shape's plane label (z₀ by its stored number, a user label; helpers have none), as drawPoints names it
  function pointName(s) {
    const st = S();
    if (isT(s)) { const pts = st.targets.filter((x) => x.kind === 'point'); return A.targetLabel(s, pts.indexOf(s)); }
    if (Number.isInteger(s.num)) return A.pointLabel(s, s.num, 0);
    let i = 0;
    for (const x of st.shapes) { if (x === s) break; if (x.kind === 'point' && x.visible !== false && !x.helper) i++; }
    return A.pointLabel(s, i, 0);
  }
  function shapeLabel(s) {
    if (!s) return '?';
    // ([v16.5 fix rail-4] the unit circle or an axis made a shape is called what it is, in X and in Y, as the snap chip
    // calls it; it takes no number from the user's own circles and lines)
    const fx = fixedRef(s);
    if (fx) return fx;
    if (s.kind === 'point') { if (s.helper && s.def && s.def.op === 'meet') return meetName(s); return pointName(s); }
    if (isT(s)) { const c = {}; let n = 0; for (const x of S().targets) { if (fixedName(x)) continue; const k = nameKind(x); c[k] = (c[k] || 0) + 1; if (x === s) n = c[k]; } return $t('Target {x} {x2}', { x: kindLabel(nameKind(s)).toLowerCase(), x2: n }); }
    return A.shapeNames().get(s.id) || Region.KINDS[s.kind].label;
  }
  const nameById = (id) => shapeLabel(find(id));
  // a name kind's word: a Region kind's label, or [v16.5 UX55] 'Hyperbolic line'
  const kindLabel = (nk) => (nk === 'hyper' ? $t('Hyperbolic line') : Region.KINDS[nk].label);
  // a zero's or pole's mark by its number n (Constr.zpNum); a reason's mark {kind, i, n?} by markNum
  const zMark = (kind, n) => (kind === 'poles' ? 'p' : 'ζ') + sub(n);
  const markNum = (m) => (Number.isInteger(m.n) ? m.n : (m.i | 0) + 1);
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
      case 'hyper': return $tx('gen-kind', 'Hyperbolic line');
      case 'circle': return $tx('gen-kind', 'Circle');
      case 'disc': return $tx('gen-kind', 'Disc');
      case 'annulus': return $tx('gen-kind', 'Annulus');
      case 'sector': return $tx('gen-kind', 'Sector');
    }
    return null;
  }
  // (v16.3 review user-9: the kind a perpendicular or touching circle is named by, app.js's nameKind)
  // ([v16.4 segments] Inside C only renames nothing: an arc or a ray of a perpendicular circle keeps its nk; one made
  // with the chip on Inside is an Arc, nk 'arc')
  function nameKind(s) {
    const nk = s.def && (s.def.op === 'perp' || s.def.op === 'touch') ? s.def.nk : null;
    if ((nk !== 'circle' && nk !== 'line' && nk !== 'arc' && nk !== 'hyper') || !['circle', 'line', 'disc', 'halfplane', 'arc', 'ray'].includes(s.kind)) return s.kind;
    const region = s.kind === 'disc' || s.kind === 'halfplane';
    if (nk === 'arc' || nk === 'hyper') return region ? s.kind : nk;
    if (s.kind === 'arc' || s.kind === 'ray') return nk;
    return nk === 'circle' ? (region ? 'disc' : 'circle') : (region ? 'halfplane' : 'line');
  }
  function genName(s) {
    const nm = shapeLabel(s), m = /\s(\d+)$/.exec(nm), k = isT(s) ? null : genKind(nameKind(s));
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
  // [v16.3 review user-1] the unit circle and the axes picked as a construction's curve become fixed shapes (no handles,
  // no body drag; Make free unlocks them): they read as what they are
  const FIXED = { unit: () => $t('the unit circle'), real: () => $t('the real axis'), imag: () => $t('the imaginary axis') };
  const fixedName = (s) => (s && !s.def && !s.at && FIXED[s.fixed] ? FIXED[s.fixed]() : null);
  // ([v16.5 check app-4] the same names inside a sentence ("on {c}", "perpendicular to {c}"): ctx 'ref', the same in
  // English and Russian; Italian gives them their article, "la circonferenza unitaria", which i18n.js joins to the
  // preposition before it ("sulla", "alla"), while the row title stays Pietro's "Circonferenza unitaria")
  const FIXREF = { unit: () => $tx('ref', 'the unit circle'), real: () => $tx('ref', 'the real axis'), imag: () => $tx('ref', 'the imaginary axis') };
  const fixedRef = (s) => (s && !s.def && !s.at && FIXREF[s.fixed] ? FIXREF[s.fixed]() : null);
  // [v16.5 rail SPEC 1.1] the display curves as snap targets: the unit circle when it is shown and the two axes are curves
  // to put points on. One becomes that fixed shape when it is used, in the same undo step (the plane's shape of that
  // name, visible or hidden, is reused, never duplicated); nothing is made on hover
  const DISP = { unit: () => ({ kind: 'circle', c: [0, 0], r: 1, fixed: 'unit' }), real: () => ({ kind: 'line', a: [0, 0], b: [1, 0], fixed: 'real' }), imag: () => ({ kind: 'line', a: [0, 0], b: [0, 1], fixed: 'imag' }) };
  const dispPcs = {};
  function dispPiece(k) {
    if (!(k in dispPcs)) { try { dispPcs[k] = Constr.pieces(Object.assign({ id: '', ci: 0, visible: true }, DISP[k]()), {})[0] || null; } catch (e) { dispPcs[k] = null; } }
    return dispPcs[k];
  }
  const fixedShape = (side, k) => (side === 'R' ? S().targets : S().shapes).find((x) => x.fixed === k && !x.def && !x.at) || null;
  // the display curves of a pane no visible shape stands for: [{key, pc, shape: its hidden fixed shape | null}]
  function dispCurves(side) {
    const out = [];
    for (const k of ['unit', 'real', 'imag']) {
      if (k === 'unit' && !S().unit) continue;
      const sh = fixedShape(side, k);
      if (sh && sh.visible !== false) continue;
      const pc = dispPiece(k);
      if (pc) out.push({ key: k, pc, shape: sh });
    }
    return out;
  }
  // the curve ref of display curve k: its shape (made in this step, or the plane's), else a new one pushed to shapes
  function dispRef(k, side, made, shapes) {
    let sh = (made && made[k]) || fixedShape(side, k);
    if (!sh) { sh = A.newShape(DISP[k]().kind, DISP[k](), side === 'R'); if (made) made[k] = sh; shapes.push(sh); }
    return { s: sh.id, part: 0 };
  }
  // a number pair as the chip writes it: "0.5 + i", in Russian and Italian «0,5 + i» (v16.5 merge: I18N.comma, the
  // decimal-comma languages)
  const fmtZl = (z) => { const t = fmtZ(z); return typeof I18N !== 'undefined' && (I18N.comma ? I18N.comma() : I18N.lang === 'ru') ? t.replace(/(\d)\.(\d)/g, '$1,$2') : t; };
  function curveName(ref) {
    if (ref && ref.disp) return FIXREF[ref.disp] ? FIXREF[ref.disp]() : '?';   // ([v16.5 rail] a display curve)
    const s = find(ref.s);
    if (!s) return '?';
    const n = piecesOf(s).length;
    return n > 1 ? $t('side {n} of {x}', { n: ref.part + 1, x: shapeLabel(s) }) : shapeLabel(s);
  }
  function refName(ref, cs) {
    if (!ref) return '?';
    if (ref.inf) return '∞';
    if (typeof ref.zp === 'string') return zMark(ref.kind, Constr.zpNum((S().steps || []).find((x) => x.uid === ref.zp), ref.kind, zpIndex(ref)));
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
    const mark = a.mark ? zMark(a.mark.kind, markNum(a.mark)) : '';
    switch (u.code) {
      case 'coincide': return $t('The points coincide');
      case 'coincide3': return $t('Two of the points coincide');
      case 'nomeet': return $t('The curves do not meet here');
      case 'coincideCurves': return $t('The curves coincide here, so their crossings are not defined');
      case 'lineInf': return $t('A line needs two finite points');
      // ([issue #70] Between z0 and z1: the points are on different sides of the curve)
      case 'betweenSides': return $t('The points are on different sides of the curve, so there is no segment between them');
      // (the perpendicular circle: Q is P's mirror image in the curve; the curve is not a line or a circle)
      case 'pencil': return $t('The points are symmetric in the curve: every circle through both is perpendicular to it');
      case 'notCircle': return a.x ? $t('{x} is not a line or a circle', { x: nameById(a.x) }) : $t('An argument is undefined');
      // (a tangent from a point inside its circle)
      case 'inside': return $t('The point is inside the circle, so no line through it touches the circle');
      // (the touching point left its curve: a rectangle's corner on another side now [v16.3 review math-1])
      case 'offCurve': return $t('The touching point is not on {c}', { c: typeof a.x === 'string' ? curveName({ s: a.x, part: a.part | 0 }) : '?' });
      case 'handleInf': return $t('Only a line can pass through ∞');
      case 'tRange': return $t('The point is off the end of its curve');
      case 'zpRemoved':
        // [review user-6] by its value: a zero added back elsewhere is not the one that was removed
        if (a.v) return a.mark && a.mark.kind === 'poles' ? $t('The pole at {v} was removed', { v: fmtZ(a.v) }) : $t('The zero at {v} was removed', { v: fmtZ(a.v) });
        return $t('{mark} was removed', { mark });
      case 'stepRemoved': return $t('The step of {mark} was removed', { mark });
      case 'zpNotF1': return a.mark && a.mark.kind === 'poles' ? $t('{mark} is a pole of {f} now: only the zeros and poles of f₁ lie in the z-plane', { mark, f: 'f' + sub(a.f || 2) }) : $t('{mark} is a zero of {f} now: only the zeros and poles of f₁ lie in the z-plane', { mark, f: 'f' + sub(a.f || 2) });
      case 'argUndef': {
        const x = a.x == null ? null : typeof a.x === 'string' ? nameById(a.x) : a.x.mark ? zMark(a.x.mark.kind, markNum(a.x.mark)) : null;
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
  // [v16.3 review user-13] the curve a perpendicular or touching circle is built on: a region by its boundary ("the circle
  // of Disc 1"), a curve by its name
  function cName(ref) {
    const s = ref && find(ref.s);
    if (s && !s.fixed && (s.kind === 'disc' || s.kind === 'halfplane') && piecesOf(s).length === 1) return s.kind === 'disc' ? $t('the circle of {x}', { x: shapeLabel(s) }) : $t('the edge of {x}', { x: shapeLabel(s) });
    return curveName(ref);
  }
  // [v16.3 review user-2] the touching point of a tangent from P: the meet point of the tangent and its curve made with
  // it (by its name), or null
  function tangentPoint(s) {
    const c = s.def.args[0], same = (r) => !!r && r.part === 0 && r.s === s.id, onC = (r) => !!r && r.s === c.s && r.part === c.part;
    const m = (isT(s) ? S().targets : S().shapes).find((x) => x.kind === 'point' && x.def && x.def.op === 'meet' && !x.helper && x.visible !== false && x.def.args.some(same) && x.def.args.some(onC));
    return m ? pointName(m) : null;
  }
  // short: a row (the curve first, so the cut-off end is the least needed part [v16.3 review user-10]); else the
  // Inspector's long form
  function defText(s, short) {
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
        // (a touching point: both indices are the same point)
        if (touchMeet(s)) return $t('{c1} ∩ {c2}, where they touch', { c1, c2 });
        if (d.index === 'finite' || d.seed) return `${c1} ∩ ${c2}`;
        return d.index === 1 ? $t('{c1} ∩ {c2}, second point', { c1, c2 }) : $t('{c1} ∩ {c2}, first point', { c1, c2 });
      }
      case 'glider': return $t('on {curve}', { curve: curveName(d.args[0]) });
      case 'midpoint': return $t('midpoint of {a}, {b}', { a: refName(d.args[0]), b: refName(d.args[1]) });
      case 'bisector': return $t('bisector of {a}, {b}', { a: refName(d.args[0]), b: refName(d.args[1]) });
      case 'perp': {
        const p = { a: N(1), b: N(2), c: cName(d.args[0]) };
        // [issue #70] Between z0 and z1: the hyperbolic segment from P to Q, in C's inside or outside (the side of the arc's middle)
        if (d.between === 1 && d.fill !== 'in' && s._seg) {
          const w = betweenWord(s);
          return w === 'in' ? $t('hyperbolic segment from {a} to {b}, inside {c}', p) : w === 'out' ? $t('hyperbolic segment from {a} to {b}, outside {c}', p) : $t('hyperbolic segment from {a} to {b}, on one side of {c}', p);
        }
        // [v16.4 segments] a perpendicular circle inside its curve only; [v16.5 UX55] one sentence in the row and the Inspector
        if (d.seg && d.fill !== 'in') {
          const si = segInfo(s), w = si && si.word;
          if (!segThru(s, si)) {
            // (review user-6: a point off the drawn side; the line passes through its mirror image, so the row names K)
            const pk = { c: p.c, k: s._g && s._g.A === 0 ? $t('on the line through {a} and {b}', p) : $t('on the circle through {a} and {b}', p) };
            return w === 'in' ? $t('hyperbolic line inside {c}, {k}', pk) : w === 'out' ? $t('hyperbolic line outside {c}, {k}', pk) : $t('hyperbolic line on one side of {c}, {k}', pk);
          }
          return w === 'in' ? $t('hyperbolic line inside {c}, through {a} and {b}', p) : w === 'out' ? $t('hyperbolic line outside {c}, through {a} and {b}', p) : $t('hyperbolic line on one side of {c}, through {a} and {b}', p);
        }
        if (short) {
          if (d.fill !== 'in') return s.kind === 'line' ? $t('line perpendicular to {c}, through {a} and {b}', p) : $t('perpendicular to {c}, through {a} and {b}', p);
          if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return $t('the half-plane left of {a} → {b}', { a: refName(d.args[i]), b: refName(d.args[j]) }); }
          return s.complement ? $t('outside a circle perpendicular to {c}, through {a} and {b}', p) : $t('disc perpendicular to {c}, through {a} and {b}', p);
        }
        if (d.fill !== 'in') return s.kind === 'line' ? $t('the line through {a} and {b}, perpendicular to {c}', p) : $t('through {a} and {b}, perpendicular to {c}', p);
        if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return $t('the half-plane left of {a} → {b}', { a: refName(d.args[i]), b: refName(d.args[j]) }); }
        if (s.complement) return $t('outside the circle through {a} and {b}, perpendicular to {c}', p);
        return $t('the disc through {a} and {b}, perpendicular to {c}', p);
      }
      // the touching circle: {a} is T (nominative: «точка касания — {a}»), {b} is P (after "through", ctx acc)
      case 'touch': {
        const p = { a: refName(d.args[1]), b: N(2), c: cName(d.args[0]) };
        if (d.args[2] && d.args[2].inf) return $tx('row', 'the tangent to {c} at {a}', p);
        if (d.fill !== 'in') return s.kind === 'line' ? $t('the line through {b}, touching {c} at {a}', p) : $t('through {b}, touching {c} at {a}', p);
        if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return $t('the half-plane left of {a} → {b}', { a: refName(d.args[i]), b: refName(d.args[j]) }); }
        if (s.complement) return $t('outside the circle through {b}, touching {c} at {a}', p);
        return $t('the disc through {b}, touching {c} at {a}', p);
      }
      // [v16.3 review user-2] by its touching point (made with it, in the same undo step), never "left" or "right" (they
      // read mirrored on screen when P is above C); without that point, by its number
      case 'tangent': {
        const p = { c: cName(d.args[0]), p: N(1) }, t = tangentPoint(s);
        if (t && short) return $t('tangent to {c} at {t}, through {p}', Object.assign(p, { t }));
        return t ? $t('the tangent to {c} through {p}, touching at {t}', Object.assign(p, { t })) : $t('tangent {n} to {c} through {p}', Object.assign(p, { n: d.index === 1 ? 2 : 1 }));
      }
    }
    return null;
  }
  // a meet point of two curves that touch by construction (a touching circle or a tangent and its curve, two touching
  // circles of one curve at one point): CORE's meet rule gives the touching point for both indices
  function touchMeet(s) {
    const d = s && s.def;
    if (!d || d.op !== 'meet' || d.seed) return false;
    // (v16.3 review regress-1: only a touching circle or a tangent touches by construction; any other meet row does no
    // piece work here)
    const tc = (r) => { const c = r && find(r.s); return !!(c && c.def && (c.def.op === 'touch' || c.def.op === 'tangent')); };
    if (!tc(d.args[0]) && !tc(d.args[1])) return false;
    const pc = (r) => { const c = r && find(r.s); return c && !c.cundef ? piecesOf(c)[r.part] : null; };
    const a = pc(d.args[0]), b = pc(d.args[1]);
    try { return !!(a && b && Constr.touchAt(a, b) != null); } catch (e) { return false; }
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
  // o: {points, cross, curves, exclude: Set, touch, exact, disp, grid, pend, detent}; returns {cls, ref, z, pc?, t?} | null.
  // exact: curves whose piece is an exact line or circle only (the perpendicular circle's curve: never a freehand or a
  // formula curve). [v16.5 rail] disp: the display curves too (1.1); grid: a lattice point when nothing else is near
  // ({cls: 'grid'}, 1.3); a curve target sits on its nearest detent (1.4) unless detent is false; while a construction's
  // draft is open, its picks that will become points are point targets ({pend: i}, 3.2) unless pend is false
  function snapAt(side, x, y, o = {}) {
    const st = S();
    if (!st) return null;
    const pane = A.setView(side);
    const zc = pane.s2w(x, y), Z = [zc.re, zc.im], sc = pane.view.s;
    const list = side === 'R' ? st.targets : st.shapes;
    const ex = o.exclude || new Set();
    const touch = o.touch != null ? o.touch : touchNow();
    const R = radii(touch);
    const dpx = (z) => { const [sx, sy] = pane.w2sxy(z[0], z[1]); return Math.hypot(sx - x, sy - y); };
    if (o.points !== false) {
      let best = null, bd = R.p;
      const consider = (z, ref) => { if (!isXY(z)) return; const d = dpx(z); if (d < bd) { bd = d; best = { cls: 'point', ref, z: z.slice() }; } };
      if (o.pend !== false && draftC && draftC.side === side && isCTool(A.tool()) && draftC.tool === A.tool()) draftC.picks.forEach((p, i) => { if (p.cls !== 'point' && isXY(p.z)) consider(p.z, { pend: i }); });
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
    // ([v16.5 fix user-2] a curve within the grid's own radius wins over a lattice point: a press just off the unit
    // circle is on the circle, never "grid point 1 + 0.5i"; a lattice point on the curve is one of its detents)
    const gridOn = !!o.grid && A.snapOn() && !altNow(), cR = gridOn ? Math.max(R.c, R.g) : R.c;
    if (o.cross !== false || o.curves) {
      const lim = Math.max(R.p, cR) / sc;
      for (const s of list) {
        if (s.visible === false || ex.has(s.id) || s.kind === 'point' || GRID.has(s.kind) || s.kind === 'formula') continue;
        const pcs = piecesOf(s), bx = boxesOf(s);
        pcs.forEach((pc, part) => {
          if (o.exact && ((pc.kind !== 'line' && pc.kind !== 'circle') || !pc.G)) return;
          const b = bx[part];
          if (b && (Z[0] < b.x0 - lim || Z[0] > b.x1 + lim || Z[1] < b.y0 - lim || Z[1] > b.y1 + lim)) return;   // (the box prefilter)
          const d = pieceDist(pc, Z);
          if (d <= lim) near.push({ s, part, pc, d });
        });
      }
      // [v16.5 rail] the display curves (a hidden fixed shape of that name stands for its curve)
      if (o.disp) for (const dc of dispCurves(side)) {
        if (dc.shape && ex.has(dc.shape.id)) continue;
        const d = pieceDist(dc.pc, Z);
        if (d > lim) continue;
        if (dc.shape) near.push({ s: dc.shape, part: 0, pc: piecesOf(dc.shape)[0] || dc.pc, d, dsp: true });
        else near.push({ s: null, disp: dc.key, part: 0, pc: dc.pc, d, dsp: true });
      }
    }
    const nref = (n) => (n.disp ? { disp: n.disp } : { s: n.s.id, part: n.part });
    // ([v16.5 fix rail-1] the unit circle and the axes, shown or made fixed shapes: bg(n) is 'unit', 'real' or 'imag')
    const bg = (n) => n.disp || (n.s && n.s.fixed && !n.s.def && !n.s.at ? n.s.fixed : null);
    // ([v16.5 rail] a drawn curve wins over a display curve in range: crossings of two drawn curves first, then those
    // with a display curve; a drawn curve first, then a display curve. The display curves are the background)
    if (o.cross !== false && near.length > 1) {
      let best = null, bd = R.p, bdD = R.p, bestD = null;
      const h = R.p / sc, box = { x0: Z[0] - h, x1: Z[0] + h, y0: Z[1] - h, y1: Z[1] + h };
      for (let i = 0; i < near.length; i++) for (let j = i + 1; j < near.length; j++) {
        const a = near[i], b = near[j];
        // (two display curves crossing, at 0, ±1, ±i: no crossing target; the nearer one takes the press, its detent
        // puts the point there)
        if (a.s === b.s || (a.dsp && b.dsp) || (bg(a) && bg(b))) continue;
        let m = null;
        try { m = Constr.meetNear(a.pc, b.pc, Z, box); } catch (e) { m = null; }
        if (!m || !isXY(m.z) || coincideAt(a.pc, b.pc, m.z, sc)) continue;   // (two curves on each other do not cross)
        const d = dpx(m.z), t = { cls: 'cross', ref: { meet: [nref(a), nref(b)], index: m.index, seed: m.seed }, z: m.z.slice() };
        if (a.dsp || b.dsp) { if (d < bdD) { bdD = d; bestD = t; if (a.disp || b.disp) t.disp = true; } }
        else if (d < bd) { bd = d; best = t; }
      }
      if (best || bestD) return best || bestD;
    }
    if (o.curves) {
      let best = null, bd = cR / sc;
      for (const n of near) if (!n.dsp && n.d <= bd) { bd = n.d; best = n; }
      if (!best) for (const n of near) if (n.dsp && n.d <= bd) { bd = n.d; best = n; }
      // ([v16.5 fix rail-1] at 1, i, −1, −i an axis and the unit circle meet: a press within 4 px (6 for a finger) of the
      // circle as well as of the axis goes to the circle, whose detent puts the point exactly there; a press clearly on
      // the axis, away from the circle, stays the axis's)
      if (best && (bg(best) === 'real' || bg(best) === 'imag')) {
        const tie = (touch ? 6 : 4) / sc, u = near.find((n) => bg(n) === 'unit' && n.d <= cR / sc && n.d - best.d <= tie);
        if (u) best = u;
      }
      if (best) {
        const p3 = best.s ? pts3Of(best.s, side === 'R' ? 1 : 0) : null;
        let pr = null;
        try { pr = Constr.projectPiece(best.pc, Z, best.pc.c3 ? p3 : null); } catch (e) { pr = null; }
        if (pr && isXY(pr.z)) {
          const t = { cls: 'curve', ref: best.disp ? null : { s: best.s.id, part: best.part }, z: pr.z.slice(), t: pr.t, seed: pr.seed, pc: best.pc };
          if (best.disp) Object.assign(t, { disp: best.disp, label: FIXREF[best.disp]() });
          // [v16.5 rail SPEC 1.4] a point placed on a curve takes its nearest detent
          // ([v16.5 fix user-2] a placement's window is half a slide's: the rail stays reachable between detents)
          if (o.detent !== false && A.snapOn() && !altNow()) { const dt = detentAt(side, t, touch, ex, best.s, { place: true, self: o.self }); if (dt) Object.assign(t, dt); }
          return t;
        }
      }
    }
    // [v16.5 rail SPEC 1.3] the grid: a lattice point of the finest drawn tier, within 9 px (12 px for a finger)
    if (gridOn) {
      const g = A.snapZ(pane, zc, false, touch);
      if (g && (g.re !== zc.re || g.im !== zc.im)) return { cls: 'grid', ref: null, z: [g.re, g.im] };
    }
    return null;
  }
  // [v16.5 rail SPEC 1.4] the detent of a rail nearest tg (a curve target {pc, t, z}) within 6 px (10 for a finger): the
  // rail's crossings with the other shown curves, its own defining points, every 15° of a plain circle or arc, the lattice
  // points on a line. {t, z, dAt: what the chip says it is at} | null
  // ([v16.5 fix] o.place: a placement, half a slide's window (user-2); the angle step and the lattice window adapt to the
  // zoom (Constr.angleDetent, latticeDetentR: rail-2); never a detent on a co-argument of a construction built on the
  // dragged point o.self (ex: graph().excluded), which would make it undefined there (rail-3))
  function detentAt(side, tg, touch, ex, railS, o = {}) {
    const pc = tg.pc;
    if (!pc || pc.kind === 'traced' || pc.kind === 'none' || !Number.isFinite(tg.t) || !isXY(tg.z)) return null;
    const pane = A.setView(side), sc = pane.view.s, R = radii(touch).det, h = R / sc, f = o.place ? 0.5 : 1;
    const avoid = [];
    if (ex) for (const id of ex) { if (id === o.self) continue; const q = find(id); if (q && q.kind === 'point' && !q._atInf && isXY(q.p)) avoid.push(q.p); }
    const clash = (z) => avoid.some((q) => Math.abs(q[0] - z[0]) <= 1e-9 * Math.max(1, Math.abs(z[0])) && Math.abs(q[1] - z[1]) <= 1e-9 * Math.max(1, Math.abs(z[1])));
    const p3 = railS && pc.c3 ? pts3Of(railS, side === 'R' ? 1 : 0) : null;
    if (pc.c3 && (!p3 || p3 === 'inf')) return null;
    const at = (t) => { let z = null; try { z = Constr.glide(pc, t, p3); } catch (e) { z = null; } return isXY(z) ? z : null; };
    const cands = [];
    const add = (t, label, zz, rr) => { const z = at(t); if (!z || clash(z)) return; const d = Math.hypot(z[0] - tg.z[0], z[1] - tg.z[1]) * sc; if (d <= (rr != null ? rr : R) * f) cands.push({ t, z, d, label: label || fmtZl(zz || z) }); };
    // 1. its crossings with the other shown curves (the point stays on its rail: it only stops there)
    const list = side === 'R' ? S().targets : S().shapes, others = [];
    const box = { x0: tg.z[0] - h, x1: tg.z[0] + h, y0: tg.z[1] - h, y1: tg.z[1] + h };
    for (const s of list) {
      if (s.visible === false || s === railS || (ex && ex.has(s.id)) || s.kind === 'point' || GRID.has(s.kind) || s.kind === 'formula') continue;
      const bx = boxesOf(s);
      piecesOf(s).forEach((q, i) => { const b = bx[i]; if (b && (box.x1 < b.x0 || box.x0 > b.x1 || box.y1 < b.y0 || box.y0 > b.y1)) return; others.push(q); });
    }
    for (const dc of dispCurves(side)) if (dc.key !== tg.disp && !(railS && dc.shape === railS)) others.push(dc.pc);
    for (const q of others) {
      if (q === pc) continue;
      let m = null;
      try { m = Constr.meetNear(pc, q, tg.z, box); } catch (e) { m = null; }
      if (!m || !isXY(m.z) || coincideAt(pc, q, m.z, sc)) continue;
      let pr = null;
      try { pr = Constr.projectPiece(pc, m.z, p3); } catch (e) { pr = null; }
      if (pr && Number.isFinite(pr.t)) add(pr.t, null, m.z);
    }
    // 2. its own defining points and handles
    if (pc.poly) add(Math.round(tg.t));
    else if (pc.seg) { add(0); add(1); }
    else if (pc.arc3) { add(0); add(0.5); add(1); }
    else if (p3 && p3.mr) add(0);
    else if (p3) { add(0); add(0.25); add(0.5); }
    else if (pc.kind === 'line' && !(railS && railS._g)) { add(0); if (pc.hi !== 0) add(1); }
    // 3. a plain circle or arc: every 15°, 30°, 45° or 90° from the centre's +x direction, the finest that leaves the rail
    // free between detents at this zoom (on the unit circle at 0: 1, i, −1, −i exactly)
    const ad = pc.kind === 'circle' && !p3 && !pc.seg ? Constr.angleDetent(pc.r * sc, R) : null;
    if (ad) {
      const step = ad.deg * Math.PI / 180, n = 360 / ad.deg, unit = pc.c[0] === 0 && pc.c[1] === 0 && pc.r === 1;
      const th = Math.atan2(tg.z[1] - pc.c[1], tg.z[0] - pc.c[0]);
      for (const k of [Math.floor(th / step), Math.ceil(th / step)]) {
        const kk = ((k % n) + n) % n, deg = kk * ad.deg, label = unit && deg % 90 === 0 ? ['1', 'i', '−1', '−i'][deg / 90] : `${deg}°`;
        if (pc.closed && pc.a0 === 0 && !pc.arc3) { add(deg / 15 / 24, label, null, ad.R); continue; }
        const zk = [pc.c[0] + pc.r * Math.cos(k * step), pc.c[1] + pc.r * Math.sin(k * step)];
        if (!Constr.onPiece(pc, zk)) continue;
        let pr = null;
        try { pr = Constr.projectPiece(pc, zk); } catch (e) { pr = null; }
        if (pr && Number.isFinite(pr.t)) add(pr.t, label, null, ad.R);
      }
    }
    // 4. a line, ray or segment: the lattice points of the grid on it
    if (pc.kind === 'line' && !pc.poly && !pc.arc3 && !pc.seg && !p3) {
      const st = Constr.gridStep(sc), d = [pc.b[0] - pc.a[0], pc.b[1] - pc.a[1]], L = Math.hypot(d[0], d[1]);
      const gx = Math.round(tg.z[0] / st), gy = Math.round(tg.z[1] / st);
      if (L > 0) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const g = [+((gx + i) * st).toPrecision(12), +((gy + j) * st).toPrecision(12)];
        if (Math.abs(d[0] * (g[1] - pc.a[1]) - d[1] * (g[0] - pc.a[0])) / L > 1e-9 * st) continue;
        let pr = null;
        try { pr = Constr.projectPiece(pc, g); } catch (e) { pr = null; }
        if (pr && Number.isFinite(pr.t) && isXY(pr.z) && Math.hypot(pr.z[0] - g[0], pr.z[1] - g[1]) <= 1e-9 * st) add(pr.t, null, g, Constr.latticeDetentR(st * sc, R));
      }
    }
    if (!cands.length) return null;
    cands.sort((u, v) => u.d - v.d);
    const c = cands[0];
    return { t: c.t, z: c.z.slice(), dAt: c.label, seed: undefined };
  }
  // [v16.5 rail SPEC 3.2] two picks are one point only when both are points that exist (z₀ twice). A pick that becomes a
  // new point (on a curve, at a crossing, a free one) is never "the same" as another: a press on it again snaps to it as
  // a pending pick ({pend: i}), and that is refused. Two places on one curve are always two points
  function samePick(a, b) {
    if (!a || !b || !a.ref || !b.ref || a.cls !== 'point' || b.cls !== 'point') return false;
    return Constr.refKey(a.ref) === Constr.refKey(b.ref);
  }
  const dupPick = (t) => !!t && !!t.ref && (Number.isInteger(t.ref.pend) || (!!draftC && draftC.picks.some((p) => samePick(p, t))));
  // the classes a tool snaps to (SPEC 4.1 [C16]); null: no snapping now (Alt, Snap off for a drawing tool)
  // ([v16.5 rail] the Point tool and the construction picks also take the display curves and the grid; a drawing tool's
  // ends keep to points and crossings of drawn curves, C16a: a segment's end never becomes a hidden glider)
  function classesFor(tool, role) {
    const alt = altNow();
    if (alt) return null;
    if (isCTool(tool)) return { points: true, cross: true, curves: true, disp: true, grid: A.snapOn() };
    if (!A.snapOn()) return null;
    if (tool === 'point') return { points: true, cross: true, curves: true, disp: true, grid: true };
    if (role === 'handle') return { points: true, cross: true, curves: false };
    return { points: true, cross: true, curves: false };
  }
  const chipOf = (t) => (!t ? '' : t.chip ? t.chip : t.cls === 'grid' ? $t('grid point {z}', { z: fmtZl(t.z) })
    : t.dAt ? $t('on {c} at {a}', { c: t.label || refName(t.ref), a: t.dAt }) : $t('on {x}', { x: t.label || refName(t.ref) }));
  // (a finished construction hides the ring and chip until the pointer moves on [review user-10])
  let ringHold = null;
  function setRing(side, t, warn) {
    const n = t ? { side, z: t.z, ref: t.ref, cls: t.cls, chip: typeof warn === 'string' ? warn : warn ? '' : chipOf(t), touch: touchNow(), warn: !!warn } : null;
    if (n && ringHold && lastEv && Math.hypot(lastEv.clientX - ringHold[0], lastEv.clientY - ringHold[1]) < 4) n.held = true;
    else if (ringHold && lastEv && Math.hypot(lastEv.clientX - ringHold[0], lastEv.clientY - ringHold[1]) >= 4) ringHold = null;
    const k = (r) => (r ? `${r.side}|${r.z[0]}|${r.z[1]}|${r.chip}|${!!r.held}` : '');
    if (k(n) !== k(ring)) { ring = n; A.requestRender('OL', 'OR'); }
  }

