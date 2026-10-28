'use strict';
// Constructions: the interface (v16, notes/constructions-v16/SPEC.md 4-7, 9-12, 15, 16; owned by INTERFACE).
// CORE (constr.js, app.js's cm block) owns the model; this file owns what the user touches and reads:
//   - snap targets: every point on the page (point shapes, other shapes' handles, the zeros and poles of f₁, the images
//     F(z₀) in Y), the crossings of two drawn curves (found locally, at the pointer), and the curves themselves;
//   - the ring and its chip ("on z₂"), at 8 px (mouse) or 22 px (touch);
//   - binding: a drawing tool's handles bind at the press and at the release, a handle dragged onto a target binds,
//     the Point tool makes a meet point on a crossing and a point on a curve on a stroke;
//   - the six tools (Circle through 3 points, Intersect, Midpoint, Perpendicular bisector, Perpendicular circle, Touching
//     circle): picks,
//     the draft chip with Curve | Region, the dashed preview, Backspace and Esc;
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
  // ([v16.5 UX55] the seventh: Hyperbolic line, the Perpendicular circle with only its arc on the points' side of C)
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
        if (!m || !isXY(m.z)) continue;
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
      if (!m || !isXY(m.z)) continue;
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
  // the draft curve's name ("Circle 1", "side 2 of Polygon 1", "the unit circle"); ([v16.5] the chip reads it every
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
      const sm = tool === 'hyper' ? 'in' : segMode;
      if (sm !== 'whole') { try { seg = Constr.segSideOf(pre[0] || find(cref.s), pc, P[0], P[1]); } catch (e) { seg = 0; } if (sm === 'out') seg = -seg; }
      s = A.newShape(g ? g.kind : 'circle', Object.assign(base, { def: Object.assign({ op: 'perp', args: [cref].concat(refs), fill: 'none', nk: seg ? 'hyper' : g && g.kind === 'line' ? 'line' : 'circle' }, seg ? { seg } : {}) }), target);
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

  // ---------------------------------------------------------------- the chip (the draft chip of the plane drawn in)
  // [review user-2, picture-4] the counter first (it says which pick is next), then the tool (its tile label on a
  // narrow pane or touch), then Esc; the chip wraps to two lines rather than cut the counter
  // (v16.3 review user-7: the English tile is «Orthogonal», one line, as the Russian «Ортогональная»; «perpendicular»
  // stays the bisector's sense)
  const toolShort = (id) => ({ circle3: $t('3-pt circle'), meet: $t('Intersect'), midpoint: $t('Midpoint'), bisector: $t('Bisector'), perp: $t('Perpendicular'), touch: $t('Touching'), hyper: $t('Hyperbolic') }[id] || id);
  // [v16.3 review user-12] the chip's touch form (no "Esc cancels", a ×) from its first frame when the tool was chosen
  // by touch, or on a coarse pointer before any pointer event over a plane
  let lastPressTouch = null;
  const coarse = () => { try { return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches); } catch (e) { return false; } };
  const chipTouch = () => (lastEv ? touchNow() || (lastPressTouch === true && lastPressAt > lastEvAt) : lastPressTouch != null ? lastPressTouch : coarse());
  let lastPressAt = 0, lastEvAt = 0;
  // [v16.5 UX48] what to pick next, in one plain sentence, then the count, the tool, and on a keyboard how to back up
  // ("⌫ undo pick · Esc" once the draft has picks of its own, else "Esc cancels"); a finger has × and Undo instead
  // (noEsc: without that keyboard tail, for a chip that would wrap with it and fits one line without it [v16.3.1])
  function chipText(narrow, noEsc) {
    const tool = A.tool();
    if (!isCTool(tool)) return '';
    // (the tile's soft hyphen never reaches the chip: it would break the chip's line there [v16.3 review user-8])
    const touch = chipTouch(), tn = (narrow || touch ? toolShort(tool) : toolName(tool)).replace(/­/g, '');
    const d = draftC && draftC.tool === tool ? draftC : null;
    const tail = touch || noEsc ? '' : ' · ' + (undoPickable() ? $t('⌫ undo pick · Esc') : $t('Esc cancels'));
    const of = (n, m) => ' · ' + $t('{n} of {m}', { n, m });
    let what, cnt = '';
    if (tool === 'meet') { const n = d && d.curve1 ? 2 : 1; what = n === 1 ? $t('Pick where two curves cross, or the first curve') : $t('Pick the second curve'); cnt = of(n, 2); }
    else if (CURVE1.has(tool) && !(d && curve1Ok())) what = tool === 'hyper' ? $t('Pick the boundary: a line or a circle') : $t('Pick a line or a circle');
    else if (tool === 'touch' && d && d.picks.length) {
      // (the touching circle: after P, the touching point on C; after T, P or the tangent when C is a circle)
      if (d.picks[0].role === 'P') what = ringsLeft(d.picks[0].z).length ? $t('Pick the touching point on {c}, or a ring for a tangent', { c: curve1Name() }) : $t('Pick the touching point on {c}', { c: curve1Name() });
      else { const pc = curve1Piece(d.curve1); what = pc && pc.kind === 'circle' ? $t('Pick a point off {c}, or the dashed tangent', { c: curve1Name() }) : $t('Pick a point off {c}', { c: curve1Name() }); }
      cnt = of(2, 2);
    } else if (tool === 'touch') { what = $t('Pick the touching point on {c}, or a point off it', { c: curve1Name() }); cnt = of(1, 2); }
    else {
      const n = (d ? d.picks.length : 0) + 1, m = NEED[tool];
      // ([v16.5 fix user-6] after the curve: a point on that curve is as good as one anywhere, and the chip says so)
      what = (tool === 'midpoint' || tool === 'bisector') && n === 1 ? $t('Pick a point, an empty spot or a segment')
        : CURVE1.has(tool) && d && curve1Ok() ? $t('Pick a point (on {c} or anywhere)', { c: curve1Name() }) : $t('Pick a point or an empty spot');
      cnt = of(n, m);
    }
    lastCnt = cnt.replace(/^ · /, '');
    return what + cnt + ' · ' + tn + tail;
  }
  // the head's chip for the tool in use (the sentence stays on the plane): its name and how far the picks have got
  let lastCnt = '';
  function toolChip() {
    const tool = A && A.tool();
    if (!tool || !isCTool(tool)) return null;
    chipText(true, true);
    return { name: toolName(tool).replace(/\u00ad/g, ''), count: lastCnt };
  }
  const howTo = (tool) => { const r = toolRows().find((x) => x[0] === tool); return r ? r[3] : ''; };
  // the plane whose draft chip a construction tool uses (updateDraftChips shows it)
  let hoverSide = 'L';
  const chipNarrow = { L: false, R: false }, chipBot = { L: 0, R: 0 }, chipH = { L: 0, R: 0 };
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
      const plot = el.parentElement, pw = plot ? plot.clientWidth : 0, narrow = pw > 0 && pw < 560;
      chipNarrow[side] = narrow;
      // ([v16.5 fix rail-9] until wave 2's D10 puts it in the pane head, a desktop's chip never sits where the picks go:
      // it moves to the plane's foot while the pointer, a pick or the picked circle is in its band at the top and none of
      // them in the band at the foot, and back up the other way round; its size is measured when its text changes)
      if (!document.documentElement.classList.contains('ph') && chipBot[side] > 0 && draftC && draftC.side === side) {
        const pn = A.setView(side), ys = [], H = pn.h, top = [0, chipBot[side] + 24], foot = [H - 32 - chipH[side] - 24, H];
        if (isXY(draftC.hover)) ys.push(draftC.hover);
        for (const p of draftC.picks) if (isXY(p.z)) ys.push(p.z);
        const yy = ys.map((z) => pn.w2sxy(z[0], z[1])[1]).filter(Number.isFinite);
        let cy = null;
        const pc1 = draftC.curve1 ? curve1Piece(draftC.curve1) : null;
        if (pc1 && pc1.kind === 'circle' && isXY(pc1.c) && pc1.r > 0) cy = [pn.w2sxy(pc1.c[0], pc1.c[1] + pc1.r)[1], pn.w2sxy(pc1.c[0], pc1.c[1] - pc1.r)[1]];
        const hit = (b) => yy.some((y) => y >= b[0] && y <= b[1]) || (!!cy && cy[0] < b[1] && cy[1] > b[0]);
        const ht = hit(top), hf = hit(foot), low = el.classList.contains('cm-low');
        if (ht && !hf && !low) el.classList.add('cm-low');
        else if (hf && !ht && low) el.classList.remove('cm-low');
      } else if (el.classList.contains('cm-low') && !(draftC && draftC.side === side)) el.classList.remove('cm-low');
      const txt = chipText(narrow);
      const kept = CURVE1.has(tool) && draftC && draftC.tool === tool && draftC.side === side && curve1Ok() ? curve1Name() : '';
      // (pw, the plane's width, for every tool [v16.3.1: the one-line rule below re-measures the wrap when it changes]; it
      // also covers the Orthogonal chip's 8 px bucket that the Whole | Inside fit was rebuilt on [v16.4]. [v16.5 check
      // app-5] the chip's place too: at the plane's foot it is narrower, and the rule must measure it there)
      const tan = tool === 'touch' && tangentReady(side);
      const sig = `${txt}|${tool}|${fillMode}|${segMode}|${I18N.lang}|${chipTouch()}|${narrow}|${pw}|${kept}|${tan}|${pickWarnMsg || ''}|${howOpen}|${el.classList.contains('cm-low')}`;
      if (box.dataset.sig !== sig) {
        box.dataset.sig = sig;
        box.innerHTML = '';
        box.classList.toggle('cm-tch', chipTouch());
        // (each part after the first keeps its words together: "1 of 2", "Esc cancels" never break [v16.5])
        const ct = A.h('span', { class: 'cm-t' });
        // (the keyboard tail "⌫ undo pick · Esc" is one part: "Esc" never goes alone onto a line of its own)
        const tailU = $t('⌫ undo pick · Esc');
        const fillT = (s) => {
          ct.textContent = '';
          const parts = s.endsWith(' · ' + tailU) ? s.slice(0, -tailU.length - 3).split(' · ').concat([tailU]) : s.split(' · ');
          parts.forEach((p, i) => { if (i) ct.append(' · '); ct.append(i ? A.h('span', { class: 'cm-nw' }, p) : p); });
        };
        fillT(txt);
        box.append(ct);
        // [v16.5 UX100] the curve kept for the next circle, as a token: its × un-picks only the curve
        if (kept) box.append(A.h('span', { class: 'cm-tok' }, A.h('span', null, $t('on {c}', { c: kept })), A.h('button', { type: 'button', class: 'cm-tokx', 'aria-label': $t('Pick another curve'), title: $t('Pick another curve'), html: '×', onclick: (e) => { e.stopPropagation(); if (draftC) { draftC.curve1 = null; draftC.picks = []; draftC.carried = false; draftC.doneK = null; } A.requestRender('OL', 'OR'); } })));
        // [v16.5 UX48] a small ? unfolds the tool's how-to inside the chip
        const how = howTo(tool);
        if (how) box.append(A.h('button', { type: 'button', class: 'cm-q' + (howOpen ? ' on' : ''), 'aria-expanded': String(howOpen), 'aria-label': $t('How to use {x}', { x: toolName(tool) }), title: $t('How to use {x}', { x: toolName(tool) }), html: '?', onclick: (e) => { e.stopPropagation(); howOpen = !howOpen; A.requestRender('OL', 'OR'); } }));
        if (tool === 'circle3') {
          // (a narrow pane: two icons, a circle and a filled disc, with their names as labels; [v16.5 UX51] a finger: the words)
          const icons = narrow && !chipTouch();
          const seg = A.h('span', { class: 'cm-seg' + (icons ? ' cm-icons' : '') + (chipTouch() ? ' cm-touch' : ''), role: 'group', 'aria-label': $t('Curve or region') });
          for (const [v, lab] of [['none', $tx('construct', 'Curve')], ['in', $tx('construct', 'Region')]]) {
            const b = A.h('button', { type: 'button', class: 'cm-sb' + (fillMode === v ? ' on' : ''), 'aria-pressed': String(fillMode === v), 'aria-label': lab, title: lab, onclick: (e) => { e.stopPropagation(); fillMode = v; A.requestRender('OL', 'OR'); } });
            if (icons) b.innerHTML = v === 'in' ? '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="currentColor" fill-opacity=".35" stroke="currentColor" stroke-width="1.4"/></svg>' : '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
            else b.textContent = lab;
            seg.append(b);
          }
          box.append(seg);
        }
        let segBox = null;
        const mkSeg = (icons) => {
          // [v16.4 segments] Whole | Inside: words, or two icons (the orthogonal arc whole or inside only) on touch and when
          // the words do not fit the chip's free width (review user-4: measured below, after the text)
          const seg = A.h('span', { class: 'cm-seg' + (icons ? ' cm-icons' : '') + (chipTouch() ? ' cm-touch' : ''), role: 'group', 'aria-label': $t('Whole or inside') });
          for (const [v, lab] of [['whole', $tx('side', 'Whole')], ['in', $tx('side', 'Inside')], ['out', $tx('side', 'Outside')]]) {
            // ([v16.5 UX55] the same three choices as the Inspector's: Outside is the other side of the curve)
            const tip = v === 'in' ? $t("Inside: only the arc inside the curve (for a line, on the first point's side)") : v === 'out' ? $t("Outside: only the arc outside the curve (for a line, on the other side from the first point)") : $t('Whole: the whole circle');
            const b = A.h('button', { type: 'button', class: 'cm-sb' + (segMode === v ? ' on' : ''), 'aria-pressed': String(segMode === v), 'aria-label': lab, title: tip, onclick: (e) => { e.stopPropagation(); segMode = v; A.requestRender('OL', 'OR'); } });
            if (icons) b.innerHTML = SEG_ICON[v]; else b.textContent = lab;
            seg.append(b);
          }
          return seg;
        };
        // ([v16.5 UX51] words on touch too: the chip takes two lines rather than drop them)
        if (tool === 'perp') box.append(segBox = mkSeg(false));
        // the touching circle after T on a circle: the tangent at T in one click (or Enter)
        if (tan) box.append(A.h('span', { class: 'cm-seg cm-tan' + (chipTouch() ? ' cm-touch' : '') }, A.h('button', { type: 'button', class: 'cm-sb', title: $t('The tangent at {a} (Enter)', { a: pickName(draftC.picks[0], side) }), onclick: (e) => { e.stopPropagation(); tangentNow(); } }, $t('Tangent line'))));
        if (chipTouch()) box.append(A.h('button', { type: 'button', class: 'cm-x', 'aria-label': $t('Cancel'), html: '×', onclick: (e) => { e.stopPropagation(); cancel(); A.setTool('select'); } }));
        if (segBox && !chipTouch() && plot) {
          // (the words fit when the text stays on one line and the chip inside its plane)
          const t = box.firstElementChild, fs = parseFloat(getComputedStyle(t).fontSize) || 12;
          if (t.offsetHeight > 2.6 * fs || el.getBoundingClientRect().right > plot.getBoundingClientRect().right - 8) segBox.replaceWith(mkSeg(true));
        }
        // [v16.3.1] a chip that wraps keeps one line without its keyboard tail ("Esc cancels", or v16.5's "⌫ undo pick ·
        // Esc") when that is enough (the touching circle's "…, or a ring for a tangent" in X at 1440 x 900); when it is
        // not, the whole text on two lines, else (it would be cut at two) the shorter one. (v16.4.1: after the Whole |
        // Inside choice above, so a chip that is one line with the icons keeps its tail, as in v16.4. v16.5: before the
        // refusal and the how-to lines below, and before rail-9 measures the chip)
        const noEsc = chipText(narrow, true);
        if (noEsc !== txt) {
          const lines = () => { const lh = parseFloat(getComputedStyle(ct).lineHeight) || 16; return ct.scrollHeight / lh; };
          const n = lines(), most = el.classList.contains('cm-low') ? 3 : 2;   // (the lines the place allows [check app-5])
          if (n > 1.5) { fillT(noEsc); if (lines() > 1.5 && n < most + 0.5) fillT(txt); }
        }
        // [v16.5 UX52] a refused pick, here for 2 s; [UX48] the how-to
        if (pickWarnMsg) box.append(A.h('span', { class: 'cm-warn', role: 'status' }, pickWarnMsg));
        if (howOpen && how) box.append(A.h('span', { class: 'cm-how' }, how));
        // ([v16.5 fix rail-9] the chip's foot in its top place, for the band the picks keep clear of)
        if (!el.classList.contains('cm-low')) chipBot[side] = el.offsetTop + el.offsetHeight;
        chipH[side] = el.offsetHeight;
      }
    }
  }

  // ---------------------------------------------------------------- the overlay: the ring, its chip, the preview
  // [v16.5 UX101] a crossing gone to ∞ (its two lines made parallel) is not lost from the plane: a hollow marker sits at
  // the plane's edge where each line leaves it, toward ∞, with "∞" beside it (its row says why)
  function drawInfMarks(pane, side, ctx, TH) {
    const list = side === 'R' ? S().targets : S().shapes;
    for (const s of list) {
      if (s.kind !== 'point' || !s._atInf || s.visible === false || !s.def || s.def.op !== 'meet') continue;
      for (const r of s.def.args.slice(0, 2)) {
        const c = r && find(r.s), pc = c && piecesOf(c)[r.part];
        if (!pc || pc.kind !== 'line' || !isXY(pc.a) || !isXY(pc.b)) continue;
        const [ax, ay] = pane.w2sxy(pc.a[0], pc.a[1]), [bx, by] = pane.w2sxy(pc.b[0], pc.b[1]);
        let dx = bx - ax, dy = by - ay;
        const L = Math.hypot(dx, dy);
        if (!(L > 0)) continue;
        dx /= L; dy /= L;
        // the line's point nearest the pane's centre, then out along the line both ways to 14 px inside the edge
        const cx = pane.w / 2, cy = pane.h / 2, t0 = (cx - ax) * dx + (cy - ay) * dy, px = ax + t0 * dx, py = ay + t0 * dy, m = 14;
        if (px < m || py < m || px > pane.w - m || py > pane.h - m) continue;
        ctx.save();
        for (const sg of [1, -1]) {
          const ux = sg * dx, uy = sg * dy;
          let t = Infinity;
          if (ux > 1e-9) t = Math.min(t, (pane.w - m - px) / ux); else if (ux < -1e-9) t = Math.min(t, (m - px) / ux);
          if (uy > 1e-9) t = Math.min(t, (pane.h - m - py) / uy); else if (uy < -1e-9) t = Math.min(t, (m - py) / uy);
          if (!Number.isFinite(t)) continue;
          const x = px + t * ux, y = py + t * uy;
          ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
          ctx.lineWidth = 1.5; ctx.strokeStyle = TH.ink; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
          // (an arrowhead on the ring, pointing out of the plane)
          ctx.beginPath(); ctx.moveTo(x + ux * 6 - uy * 3.5 - ux * 3, y + uy * 6 + ux * 3.5 - uy * 3); ctx.lineTo(x + ux * 9, y + uy * 9); ctx.lineTo(x + ux * 6 + uy * 3.5 - ux * 3, y + uy * 6 - ux * 3.5 - uy * 3); ctx.stroke();
          ctx.font = `italic 500 13px ${TH.math || 'serif'}`; ctx.fillStyle = TH.ink; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
          ctx.fillText('∞', x - ux * 14 + uy * 10, y - uy * 14 - ux * 10);
        }
        ctx.restore();
        break;
      }
    }
  }
  function drawOverlay(pane, side) {
    const ctx = pane.octx, TH = A.TH();
    drawInfMarks(pane, side, ctx, TH);
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
    // [v16.5 rail SPEC 4.1] a point sliding on its curve: the rail wide and faint; pulled off it: the stretch line and the
    // ghost dot at the pointer
    if (rail && rail.side === side) drawRail(pane, ctx, TH);
    if (freeChip && freeChip.side === side) {
      const p = find(freeChip.id), at = freeChip.Z || (p && isXY(p.p) ? p.p : null);
      // (one chip row higher when the ring's chip shows too: the freed point dragged over a curve or a lattice point says
      // both, "z₂ is free" above "on the real axis")
      const dy = ring && ring.side === side && !ring.held && ring.chip ? 26 : 0;
      if (at && performance.now() < freeChip.until) { const [fx, fy] = pane.w2sxy(at[0], at[1]); ctx.save(); drawChip(pane, ctx, TH, fx, fy - dy, 11, freeChip.text, touchNow(), false); ctx.restore(); }
    }
    if (!ring || ring.side !== side || ring.held) return;
    const [x, y] = pane.w2sxy(ring.z[0], ring.z[1]);
    ctx.save();
    // [review picture-5] the ring sits outside every point mark (a dot reaches 5 px, a ring mark 6.25 px, the selection
    // ring 8 px): r = 11 (13 on touch) with its halo and a faint accent fill, so a snap reads at a glance; ([v16.5 rail])
    // a grid catch is lighter: r = 7, no fill; a point sliding on its rail has its chip only
    const grid = ring.cls === 'grid', bare = ring.cls === 'rail';
    const rr = grid ? 7 : ring.touch ? 13 : 11, acc = ring.warn ? TH.warn : TH.accent;
    if (!bare && !grid) { ctx.globalAlpha = 0.14; ctx.fillStyle = acc; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    if (!bare) {
      ctx.lineWidth = grid ? 3 : 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
      ctx.lineWidth = grid ? 1.25 : 1.75; ctx.strokeStyle = acc; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
    }
    if (ring.chip) drawChip(pane, ctx, TH, x, y, bare ? 11 : rr, ring.chip, ring.touch, ring.warn);
    ctx.restore();
  }
  // the chip [review user-10, picture-6]: above and to the LEFT of the target (a point's label is placed below or to
  // its right first), 12 px clear of the ring, on whole pixels, inside the pane on all four sides; a finger: 48 px up
  function drawChip(pane, ctx, TH, x, y, rr, text, touch, warn) {
    ctx.font = `500 12px ${TH.ui}`;
    const w = Math.ceil(ctx.measureText(text).width) + 14, hgt = 22;
    let cx = x - rr - 6 - w, cy = touch ? y - 48 - hgt / 2 : y - rr - 6 - hgt;
    if (cx < 4) cx = x + rr + 6;
    if (cy < 4) cy = y + rr + 6;
    cx = Math.round(Math.max(4, Math.min(pane.w - 4 - w, cx)));
    cy = Math.round(Math.max(4, Math.min(pane.h - 4 - hgt, cy)));
    ctx.fillStyle = TH.surface; ctx.strokeStyle = TH.line; ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx + 0.5, cy + 0.5, w, hgt, 6); else ctx.rect(cx + 0.5, cy + 0.5, w, hgt);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = warn ? TH.warn : TH.ink; ctx.textBaseline = 'middle';
    ctx.fillText(text, cx + 7, cy + hgt / 2 + 1);
    lastChip = { text, x: cx, y: cy, w, h: hgt, at: [x, y], pw: pane.w, ph: pane.h };
  }
  let lastChip = null;
  // [v16.5 rail SPEC 4.1] the rail 6 px wide at 25 % of its curve's ink; the stretch line dashed 4/3, 1.5 px, accent, its
  // opacity from 0.35 to 1 as the pull nears the let-go; a hollow ghost dot (r = 4) at the pointer
  function drawRail(pane, ctx, TH) {
    ctx.save();
    if (rail.pc && rail.ink) { ctx.strokeStyle = rail.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 6; ctx.setLineDash([]); strokePiece(pane, ctx, rail.pc); ctx.globalAlpha = 1; }
    const st = rail.stretch;
    if (st && isXY(st.a) && isXY(st.b)) {
      const [ax, ay] = pane.w2sxy(st.a[0], st.a[1]), [bx, by] = pane.w2sxy(st.b[0], st.b[1]);
      ctx.globalAlpha = st.k; ctx.strokeStyle = TH.accent; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.setLineDash([]); ctx.lineWidth = 1.25; ctx.beginPath(); ctx.arc(bx, by, 4, 0, TAU); ctx.stroke();
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
    // (a perpendicular or touching circle on a display curve: that curve becomes the next shape, and K the one after it)
    const k = CURVE1.has(d.tool) && d.curve1 && d.curve1.make ? 1 : 0;
    const ink = A.shapeInk({ ci: A.nextCi ? A.nextCi(side === 'R', k) : ((side === 'R' ? S().targets.length : S().shapes.length) + k) % 8 });
    const color = ink.edge;
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.5;
    const P = d.picks.map((p) => p.z);
    // the perpendicular or touching circle's curve, 4 px wide at 35 % (as Intersect's first curve), under its picks
    const ppc = CURVE1.has(d.tool) && curve1Ok() ? curve1Piece(d.curve1) : null;
    if (ppc) { ctx.lineWidth = 4; ctx.globalAlpha = 0.35; strokePiece(pane, ctx, ppc); ctx.globalAlpha = 1; ctx.lineWidth = 1.5; }
    // [v16.3 review user-3] the touching circle's marks in dark mode: the accent (the new shape's colour is too dim on
    // the picked curve's glow), and a halo of the plane's colour under each pick
    const mark = d.tool === 'touch' && TH.dark ? TH.accent : color;
    for (const p of d.picks) {
      const [x, y] = pane.w2sxy(p.z[0], p.z[1]);
      if (d.tool === 'touch') { ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.stroke(); ctx.lineWidth = 1.5; ctx.strokeStyle = color; }
      ctx.fillStyle = mark; ctx.beginPath(); ctx.arc(x, y, d.tool === 'touch' ? 4 : 3.5, 0, TAU); ctx.fill();
    }
    // a finger hides what it picked, so each pick wears a ring and its number (UX50)
    if (touchNow()) {
      ctx.font = `600 11px ${TH.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      d.picks.forEach((p, i) => {
        const [x, y] = pane.w2sxy(p.z[0], p.z[1]);
        ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = mark; ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.strokeText(String(i + 1), x + 13, y - 13);
        ctx.fillStyle = mark; ctx.fillText(String(i + 1), x + 13, y - 13);
      });
    }
    if (d.tool === 'meet' && d.curve1) {
      const s = find(d.curve1.ref.s), pc = s && piecesOf(s)[d.curve1.ref.part];
      if (pc) { ctx.lineWidth = 4; ctx.globalAlpha = 0.35; strokePiece(pane, ctx, pc); ctx.globalAlpha = 1; }
    }
    const hv = d.hover;
    ctx.setLineDash([4, 3]);
    if (d.tool === 'touch') { if (ppc && ppc.G) drawTouch(pane, ctx, d, ppc, hv, TH, mark); }
    else if (ppc && ppc.G && hv && P.length === 1 && isXY(P[0])) {
      // K through P and the pointer (nothing while it is undefined: the pointer at P, or at P's mirror image)
      let r = null;
      try { r = Constr.perpForm(ppc.G, P[0], hv, ppc); } catch (e) { r = null; }   // (the piece: the decimal rules, as the made K [v16.3 review math-3, math-4])
      if (r && r.G) {
        // [v16.4 segments] Inside: the arc the click will make, from the same sampler
        const q = segMode === 'in' ? previewSeg(d, ppc, r.G, P[0], hv) : null;
        if (q) strokeSeg(pane, ctx, q); else if (segMode !== 'in') strokeForm(pane, ctx, r.G);
      }
    } else if (hv && d.tool === 'circle3' && P.length === 2) {
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
  // the touching circle's preview (dashed, in the new shape's colour; drawn with no pointer too, since touch has no
  // hover): after T, the tangent at T thin at 50 %; after P, the tangents from P and their rings (hollow, 5 px). K
  // through the pointer (after P: touching C at the pointer's nearest point on C); a snapped hint or ring at full
  // strength instead. Nothing where K is undefined
  // [v16.3 review user-3] the hint and the rings: in dark mode in the accent at full strength; each ring 2 px wide on a
  // halo of the plane's colour (it shows over the picked curve's glow), 6 px (8 px on touch)
  function drawTouch(pane, ctx, d, pc, hv, TH, mark) {
    const P0 = d.picks[0], ht = d.hoverT || null;
    if (!P0 || !isXY(P0.z)) return;
    const dark = !!TH.dark;
    const line = (G, full) => { ctx.save(); ctx.strokeStyle = mark; ctx.lineWidth = full || dark ? 1.5 : 1; ctx.globalAlpha = full || dark ? 1 : 0.5; strokeForm(pane, ctx, G); ctx.restore(); };
    let K = null;
    if (P0.role === 'T') {
      const H = hintForm(P0.z), snapped = !!ht && ht.cls === 'hint';
      if (H) line(H, snapped);
      if (hv && !snapped) { try { const r = Constr.touchForm(pc.G, P0.z, hv); K = r && r.G; } catch (e) { K = null; } }
    } else {
      const snapped = !!ht && ht.cls === 'ring';
      const rr = touchNow() || chipTouch() ? 8 : 6;
      for (const r of ringsLeft(P0.z)) {
        const full = snapped && ht.k === r.k;
        line(r.G, full);
        const [x, y] = pane.w2sxy(r.tp[0], r.tp[1]);
        ctx.save(); ctx.setLineDash([]);
        ctx.lineWidth = 4; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
        ctx.lineWidth = 2; ctx.strokeStyle = mark; ctx.globalAlpha = full || dark ? 1 : 0.6; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke(); ctx.restore();
      }
      if (hv && !snapped) {
        let T = ht && ht.role === 'T' ? ht.z : null;
        if (!T) { try { const pr = Constr.projectPiece(pc, hv, pc.c3 && d.curve1.ref ? pts3Of(find(d.curve1.ref.s), d.side === 'R' ? 1 : 0) : null); T = pr && isXY(pr.z) ? pr.z : null; } catch (e) { T = null; } }
        if (T) { try { const r = Constr.touchForm(pc.G, T, P0.z); K = r && r.G; } catch (e) { K = null; } }
      }
    }
    if (K) strokeForm(pane, ctx, K);
  }
  // a generalized circle, exact at any radius: a line clipped to the pane; a circle by ctx.arc below 1e6 px; beyond, its
  // M(R) samples (Constr.sampleMR), broken where they leave a margin around the pane (no huge canvas coordinates)
  function strokeForm(pane, ctx, G) {
    const g = Constr.geomOf(G);
    ctx.beginPath();
    if (g.line) { const L = clipLine(pane, g.p, g.d); if (L) { ctx.moveTo(L[0], L[1]); ctx.lineTo(L[2], L[3]); } }
    else if (g.r * pane.view.s < 1e6) { const [cx, cy] = pane.w2sxy(g.c[0], g.c[1]); ctx.arc(cx, cy, g.r * pane.view.s, 0, TAU); }
    else {
      const pts = Constr.sampleMR(G, pane.box(), 2 / pane.view.s), m = 4 * Math.hypot(pane.w, pane.h);
      let on = false;
      for (let i = 0; i < pts.length; i += 2) {
        const [x, y] = pane.w2sxy(pts[i], pts[i + 1]);
        if (!(x > -m && x < pane.w + m && y > -m && y < pane.h + m)) { on = false; continue; }
        if (on) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        on = true;
      }
    }
    ctx.stroke();
  }
  // [v16.4 segments] the arc of a perpendicular circle (Constr.segCurves' samples, cut where they leave a margin around
  // the pane), and the draft's: K through P and the pointer on the side the chip's Inside chooses
  function strokeSeg(pane, ctx, q) {
    const box = pane.box(), step = 2 / pane.view.s, m = 4 * Math.hypot(pane.w, pane.h);
    ctx.beginPath();
    for (const c of Region.segCurvesOf(q, box)) {
      const pts = c.gsamp ? c.gsamp(box, step) : Region.sampleCurve(c, box);   // (a circle's arc: by its angle; a line's: the chord or long rays)
      let on = false;
      for (let i = 0; i < pts.length; i += 2) {
        const [x, y] = pane.w2sxy(pts[i], pts[i + 1]);
        if (!(x > -m && x < pane.w + m && y > -m && y < pane.h + m)) { on = false; continue; }
        if (on) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        on = true;
      }
    }
    ctx.stroke();
  }
  function previewSeg(d, pc, G, P, Q) {
    try {
      const C = d.curve1.ref ? find(d.curve1.ref.s) : d.curve1.make, Gc = Constr.gcOf(C, pc);
      const q = Gc ? Constr.segOf(G, pc.G, Gc, Constr.segSideOf(C, pc, P, Q), P, Q, false) : null;
      return q && !q.undef ? q : null;
    } catch (e) { return null; }
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
    if (pc.seg) { strokeSeg(pane, ctx, pc.seg); return; }
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
    if (e) { lastEv = e; lastEvAt = performance.now(); }
    const tool = A.tool();
    if (isCTool(tool) && hoverSide !== side && !draftC) { hoverSide = side; A.requestRender('OL', 'OR'); }
    if (tool === 'select' || tool === 'formula' || tool === 'curve' || tool === 'lasso' || tool === 'cgrid' || tool === 'pgrid') { if (ring) setRing(null, null); return; }
    if ((side === 'L' && (A.leftStage() > 0 || !A.lFlat())) || (side === 'R' && !A.targetsEditable())) { if (ring) setRing(null, null); return; }
    const cl = classesFor(tool, 'draw');
    let t = cl ? snapAt(side, x, y, cl) : null;
    if (isCTool(tool)) {
      if (!draftC || draftC.side !== side) draftC = draftC && (draftC.picks.length || (CURVE1.has(draftC.tool) && draftC.curve1)) ? draftC : { tool, side, picks: [], curve1: null, hover: null };
      // (the perpendicular or touching circle before its curve: the ring on an exact curve or a display curve, "on the
      // unit circle")
      if (CURVE1.has(tool) && !curve1Ok()) t = cl ? perpCurveAt(side, x, y) : null;
      const pane2 = A.setView(side);
      const z0 = pane2.s2w(x, y);
      // (the touching circle after its curve: the target a click takes, the tangent hint and the rings among them; a
      // refused target shows its toast as the chip)
      if (tool === 'touch' && curve1Ok()) {
        // (the other plane: a click there starts a new draft, so its ring is a curve's; no preview in the draft's plane)
        if (draftC.side !== side) { draftC.hover = null; draftC.hoverT = null; A.requestRender('OL', 'OR'); setRing(side, cl ? perpCurveAt(side, x, y) : null); return; }
        const r = cl ? touchTargetC(side, x, y) : null, tt = r && r.t && r.t.cls !== 'free' ? r.t : null;
        draftC.hover = r && r.restart ? null : tt && !r.warn ? tt.z.slice() : [z0.re, z0.im];
        draftC.hoverT = r && !r.warn && !r.restart ? r.t : null;
        A.requestRender('OL', 'OR');
        if (tt && r.warn) { setRing(side, tt, r.warn); return; }
        if (tt && tt.ref && tt.ref.img && !A.yWhole()) { setRing(side, tt, $t('Draw in X to use {x}', { x: pointName(find(tt.ref.img)) })); return; }
        setRing(side, tt);
        return;
      }
      draftC.hover = t ? t.z.slice() : [z0.re, z0.im];
      // ([v16.5 fix rail-7] one message: once the press was refused the chip says it, and the ring by the pointer only warns)
      if (dupPick(t)) { const w = $t('{x} needs distinct points', { x: warnTool(tool) }); setRing(side, t, pickWarnMsg === w ? true : w); return; }
      if (t && tool === 'meet' && t.cls === 'point') t = snapAt(side, x, y, { points: false, cross: true, curves: true });
      if (t && tool === 'meet' && t.cls === 'curve' && !t.ref) t = null;   // ([v16.5 rail] Intersect takes a display curve's crossings, not the curve)
      if (t && t.ref && t.ref.img && !A.yWhole()) { setRing(side, t, $t('Draw in X to use {x}', { x: pointName(find(t.ref.img)) })); return; }
      A.requestRender('OL', 'OR');
    }
    setRing(side, t);
  }
  function pointer(e) { lastEv = e; lastEvAt = performance.now(); }
  // the pointer left a plane: no hover preview and no ring there [review picture-3]
  function leave(side) {
    let ch = false;
    if (draftC && draftC.side === side && draftC.hover) { draftC.hover = null; draftC.hoverT = null; ch = true; }
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
  // (v16.3.1) a load before the app's adapter is set (the page opening a saved figure): its toast waits for ui()
  // the family (kind, or complement) of each three-point circle at its last recompute
  const famSeen = new Map();
  let freedLater = false;
  const freedToast = () => setTimeout(() => A.toast($t('Some constructions could not be read and were opened as plain shapes.')), 0);
  function on(type, data) {
    events.push({ type, data });
    if (events.length > 50) events.shift();
    if (!A) { if (type === 'loadFreed') freedLater = true; return; }
    if (type === 'loadFreed') freedToast();
    // [review user-8] removing a zero that constructions use: the toast offers Undo, as a delete's does
    if (type === 'zpRemoved' && data && data.undef && data.undef.length) setTimeout(() => {
      const n = data.undef.length;
      A.undoToast($tn('{n} shape is now undefined.', '{n} shapes are now undefined.', n));
    }, 0);
    // the tour's "Drag z2 across the line": a circle's family changes when its kind does (disc, half-plane) and also when
    // only its complement flips (disc, outside), which leaves the kind alone
    if (type === 'recomputed' && data && data.ids) {
      for (const id of data.ids) {
        const s = find(id);
        if (!s || !s.def || s.def.op !== 'circle3') continue;
        const fam = s.kind === 'disc' && s.complement ? 'complement' : s.kind, was = famSeen.get(id);
        famSeen.set(id, fam);
        if (fam !== was && (was !== undefined || (data.kindChanged && data.kindChanged.includes(id)))) A.tourEmit('construct-family', { kind: fam });
      }
    }
  }
  // the zero being dragged off the plane: what a release does to the constructions on it
  function zpOffNote(k, kind, i) {
    const st = S().steps[k - 1];
    if (!st || !st.zpIds || !st.zpIds[kind]) return '';
    let plan;
    try { plan = Constr.zeroRemovePlan(S(), { zp: st.uid, kind, id: st.zpIds[kind][i] }); } catch (e) { return ''; }
    const n = plan.undef.length;
    return n ? $tn('Release to remove {mark}; {n} shape will be undefined', 'Release to remove {mark}; {n} shapes will be undefined', n, { mark: zMark(kind, Constr.zpNum(st, kind, i)) }) : '';
  }

  // ---------------------------------------------------------------- rows, ⋯ items, hover links
  // updateShapeList's cell: true when this wrote it (a definition, a reason)
  function row(s, r) {
    // ([v16.5 fix rail-4] a fixed unit circle or axis: its row is titled by that name, so the cell shows its equation)
    if (!(s.def || s.at || s.cundef || s._atInf)) { if (r.box) r.box.classList.remove('cm-linked'); return false; }
    const d = r.d;
    let text = null, cls = 'cm-def';
    if (s.cundef) { text = reasonText(s.cundef); cls = 'err-msg'; }
    else if (s._atInf) text = s._note === 'parallel' ? `${pointName(s)} = ∞ · ${$t('They meet only at ∞')}` : `${pointName(s)} = ∞`;
    else if (s.def) text = defText(s, true);
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
    if (!(s.def || s.at || s.helper || fixedName(s))) return;
    const add = [];
    if (fixedName(s)) add.push({ label: $t('Make free'), run: () => unfix(s) });
    if (isCirc3(s)) {
      const i = items.findIndex((it) => it && it.label && (it.label === $t('Use complement') || it.label === $t('Use the set itself')));
      if (i >= 0) items.splice(i, 1);
      if (s.def.fill === 'in') add.push({ label: $t('Use complement'), run: () => api.cm.setDef(s.id, { flip: !s.def.flip }) });
      add.push({ label: s.def.fill === 'in' ? $tx('construct', 'Curve') : $tx('construct', 'Region'), run: () => setFill(s, s.def.fill === 'in' ? 'none' : 'in') });
      // [v16.4 segments] Inside C only: on (SPEC 2.2's side), the other side, the whole circle
      const info = s.def.op === 'perp' && s.def.fill !== 'in' ? segInfo(s) : null;
      // (review math-6: the words of the side it turns on; a disc C drawn as its complement turns on its region, outside)
      const dw = info && (info.sides.find((x) => x[1] === info.dflt) || [])[0];
      if (info && !s.def.seg) add.push({ label: info.line ? $t('One side of {c} only', { c: cName(s.def.args[0]) }) : dw === 'out' ? $t('Outside {c} only', { c: cName(s.def.args[0]) }) : $t('Inside {c} only', { c: cName(s.def.args[0]) }), run: () => setSeg(s, info.dflt) });
      if (info && s.def.seg) add.push({ label: $t('Other side'), run: () => setSeg(s, -s.def.seg) }, { label: $t('Whole circle'), run: () => setSeg(s, 0) });
    }
    if (s.def && s.def.op === 'meet' && s.def.index !== 'finite' && !s.def.seed && !touchMeet(s)) add.push({ label: $t('Other point'), run: () => api.cm.setDef(s.id, { index: s.def.index === 1 ? 0 : 1 }) });
    if (s.helper) add.push({ label: $t('Show as point'), run: () => { delete s.helper; delete s.owner; A.shapesChanged(true); A.commit(); } });
    if (s.def || s.at) add.push({ label: $t('Make free'), run: () => api.cm.makeFree(s.id) });
    if (add.length) items.unshift(...add, 'sep');
    // Delete: the cascade count
    // [review user-7] the row's Delete by what it is (its icon, its label), never by a style flag
    const del = items.find((it) => it && typeof it === 'object' && (it.icon === 'trash' || it.label === $t('Delete')));
    if (del) { try { const n = Constr.deletePlan(S(), [s.id]).del.length - 1; if (n > 0) del.label = $tn('Delete (and {n} built on it)', 'Delete (and {n} built on it)', n); } catch (e) { /* */ } }
  }
  // Make free on a fixed unit circle or axis: its handles and its drag come back (one undo step)
  function unfix(s) { delete s.fixed; if (isT(s)) A.targetsChanged(true); else A.shapesChanged(true); A.commit(); }
  // Curve | Region of a 3-point circle: the kind changes, the definition stays
  function setFill(s, fill) {
    // [v16.4 segments] Region turns Inside C only off (its gliders keep their points)
    if (fill === 'in' && s.def.seg) { try { Constr.setSeg(S(), s.id, 0, env()); } catch (e) { delete s.def.seg; } }
    s.def.fill = fill;
    s.kind = fill === 'in' ? (s.kind === 'line' ? 'halfplane' : 'disc') : (s.kind === 'halfplane' ? 'line' : 'circle');
    if (fill !== 'in') delete s.complement;
    api.cm.setDef(s.id, { fill });
  }
  // [v16.4 segments] Inside C only: 1 | -1 (a side of C's form) or 0 (the whole circle), its gliders kept on the drawn
  // curve (Constr.setSeg), one undo step
  function setSeg(s, v) {
    try { Constr.setSeg(S(), s.id, v, env()); } catch (e) { if (v) s.def.seg = v; else delete s.def.seg; }
    api.cm.setDef(s.id, {});
  }
  // the sides of a perpendicular circle's curve and their words (Constr.segSides), or null
  function segInfo(s) { try { return Constr.segSides(S(), s.id, env()); } catch (e) { return null; } }
  // [v16.4 review math-7, user-6] P and Q both finite and strictly on the drawn side of C (not on C, not past it): only
  // then does the hyperbolic line pass through them as points of its plane
  function segThru(s, info) {
    if (!info || !info.seg || !s.def) return false;
    const plane = isT(s) || s._capT ? 1 : 0;
    return [s.def.args[1], s.def.args[2]].every((r) => {
      if (!r || r.inf) return false;
      let z = null;
      try { const res = Constr.resolve(S(), r, plane, env()); z = res && res.z; } catch (e) { z = null; }
      return isXY(z) && !Constr.onCarrier(info.Gc, z, null) && info.seg * Constr.fOf(info.Gc, z) < 0;
    });
  }
  const sideLabel = (w) => ({ in: $tx('side', 'Inside'), out: $tx('side', 'Outside'), above: $tx('side', 'Above'), below: $tx('side', 'Below'), left: $tx('side', 'Left'), right: $tx('side', 'Right') }[w] || w);
  // (the chip's icons: a thin circle and the arc orthogonal to it (centre (8, 18), radius 8: 10^2 = 6^2 + 8^2), whole, or
  // inside only, its ends (3.2, 11.6) and (12.8, 11.6) on both curves)
  const SEG_ICON = {
    whole: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="6" stroke-width="1" stroke-opacity=".45"/><path d="M0.254 16A8 8 0 0 1 15.746 16" stroke-width="1.4"/></svg>',
    in: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="6" stroke-width="1" stroke-opacity=".45"/><path d="M3.2 11.6A8 8 0 0 1 12.8 11.6" stroke-width="1.4"/></svg>',
    // ([v16.5 UX55] Outside: the two ends of the same arc, outside the circle)
    out: '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor"><circle cx="8" cy="8" r="6" stroke-width="1" stroke-opacity=".45"/><path d="M0.254 16A8 8 0 0 1 3.2 11.6M12.8 11.6A8 8 0 0 1 15.746 16" stroke-width="1.4"/></svg>',
  };
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
    const t = snapAt(side, ctx.x, ctx.y, { points: true, cross: true, curves: true, touch, disp: true });
    const target = side === 'R';
    if (t && t.cls === 'cross') items.push({ label: $t('Mark the intersection'), run: () => { const m = materialize(t, side, {}); api.cm.create(m.shapes, { target }); A.tourEmit('construct-added', { op: 'meet' }); } });
    if (t && t.cls === 'curve') items.push({ label: $t('Point on this curve'), run: () => { const m = materialize(t, side, {}); api.cm.create(m.shapes, { target }); A.tourEmit('construct-added', { op: 'glider' }); } });
    if (t && t.cls === 'curve' && t.disp) { t.make = DISP[t.disp](); }   // ([v16.5 rail] a display curve: made with the point)
    // (issue #13: only what acts on the shape there; the tools that start from it, Perpendicular circle, Touching
    // circle, Circle through 3 points and Midpoint, are the toolbar's)
    if (t && t.cls === 'point') {
      // a free point on a curve: put it on the curve
      const p = t.ref.s && !t.ref.h ? find(t.ref.s) : null;
      if (p && !p.def && !p.at) {
        // [review math-6] never a curve built on this point (a cycle): the point and everything built on it are excluded
        let ex;
        try { ex = new Set([p.id, ...graph().users(p.id)]); } catch (e) { ex = new Set([p.id]); }
        const c = snapAt(side, ctx.x, ctx.y, { points: false, cross: false, curves: true, disp: true, touch, exclude: ex });
        // ([v16.5 rail] a display curve too: its fixed shape is made, or the plane's reused, in the same undo step)
        if (c) items.push({ label: $t('Put on this curve'), run: () => {
          const pre = [], list = side === 'R' ? S().targets : S().shapes;
          const def = { op: 'glider', args: [c.disp ? dispRef(c.disp, side, null, pre) : c.ref] };
          if (c.seed) def.seed = c.seed;
          for (const x of pre) list.splice(list.indexOf(p), 0, x);
          if (api.cm.setDef(p.id, { def, t: c.t }) === false) for (const x of pre) { const i = list.indexOf(x); if (i >= 0) list.splice(i, 1); }
        } });
      }
    }
    // a constructed shape under the press: Make free
    // ([v16.5 UX56] named: a point on a curve and the curve are both under the press)
    const hit = hitShape(side, ctx.x, ctx.y);
    if (hit && (hit.def || hit.at)) items.push({ label: $t('Make {x} free', { x: shapeLabel(hit) }), run: () => api.cm.makeFree(hit.id) });
    else if (hit && fixedName(hit)) items.push({ label: $t('Make {x} free', { x: shapeLabel(hit) }), run: () => unfix(hit) });
    return items;
  }
  function hitShape(side, x, y) {
    const pane = A.setView(side), z = pane.s2w(x, y), tol = 7 / pane.view.s;
    const list = (side === 'R' ? S().targets : S().shapes).filter((s) => s.visible !== false).slice().reverse().sort((a, b) => (b.kind === 'point') - (a.kind === 'point'));
    for (const s of list) { try { if (Region.hitTest(s, z, tol, A.win(side))) return s; } catch (e) { /* */ } }
    return null;
  }

  // ---------------------------------------------------------------- the Inspector's Construction view (SPEC 7)
  function inspectorSig() {
    const id = A && A.selected();
    const s = id && find(id);
    if (!s || !(s.def || s.at)) return null;
    return `C#${s.id}#${s.kind}#${s.def ? s.def.op + s.def.fill + s.def.index + (s.def.seg || '') : 'at'}#${I18N.lang}#${!!s.cundef}`;
  }
  // [review user-15] what t means on the curve a point slides on, and the range a number for it should take
  function tMeaning(s) {
    const r = s.def && s.def.args && s.def.args[0], c = r && find(r.s);
    if (!c) return null;
    const pc = piecesOf(c)[r.part];
    if (!pc || pc.kind === 'none' || pc.kind === 'traced') return null;
    if (c.def && c.def.op === 'perp' && pc.seg) return { text: $t('0 and 1 at its ends on {c}', { c: cName(c.def.args[0]) }), range: [0, 1] };
    if (c.def && c.def.op === 'perp') return { text: $t('0 at {p}, ½ opposite it', { p: refName(c.def.args[1]) }), range: [0, 1] };
    // (a touching circle: perp's map anchored at T; the tangent at T and a tangent from P: plain line gliders from T or P)
    if (c.def && c.def.op === 'touch' && !(c.def.args[2] && c.def.args[2].inf)) return { text: $t('0 at {p}, ½ opposite it', { p: refName(c.def.args[1]) }), range: [0, 1] };
    if (c.def && (c.def.op === 'touch' || c.def.op === 'tangent')) return { text: $t('0 at {p}; t is the distance from it', { p: refName(c.def.args[1]) }), range: [-10, 10] };
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
    if (isCirc3(s)) {
      const seg = h('div', { class: 'seg cm-iseg', role: 'group' });
      for (const [v, lab] of [['none', $tx('construct', 'Curve')], ['in', $tx('construct', 'Region')]]) seg.append(h('button', { type: 'button', class: (s.def.fill === 'in') === (v === 'in') ? 'on' : '', 'aria-pressed': String((s.def.fill === 'in') === (v === 'in')), onclick: () => setFill(s, v) }, lab));
      fields.append(seg);
      // [v16.4 segments] Whole | Inside | Outside (a line: Above | Below, or Left | Right): the side drawn now is on
      const info = s.def.op === 'perp' && s.def.fill !== 'in' ? segInfo(s) : null;
      if (info) {
        const now = s.def.seg === 1 || s.def.seg === -1 ? s.def.seg : 0, sg = h('div', { class: 'seg cm-iseg cm-iside', role: 'group', 'aria-label': $t('Whole or inside') });
        for (const [v, lab] of [[0, $tx('side', 'Whole')]].concat(info.sides.map(([w, v]) => [v, sideLabel(w)]))) sg.append(h('button', { type: 'button', class: now === v ? 'on' : '', 'aria-pressed': String(now === v), onclick: () => setSeg(s, v) }, lab));
        fields.append(h('div', { class: 'cm-ibreak' }), sg);
      }
      if (s.def.fill === 'in') fields.append(h('label', { class: 'cm-icheck' }, h('input', { type: 'checkbox', checked: s.complement ? true : null, onchange: () => api.cm.setDef(s.id, { flip: !s.def.flip }) }), $t('Use complement')));
    }
    if (s.def && s.def.op === 'meet' && s.def.index !== 'finite' && !s.def.seed && !touchMeet(s)) fields.append(h('button', { type: 'button', class: 'btn', onclick: () => api.cm.setDef(s.id, { index: s.def.index === 1 ? 0 : 1 }) }, $t('Other point')));
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
    const d = s.def, plane = isT(s) || s._capT ? 1 : 0;
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
    // {c}: C's carrier, a circle or a line in the genitive (a 3-point, perpendicular or touching circle drawn as a curve by
    // its own phrase; any other piece by its circle or its line: a polygon side is the line it lies on)
    const carrier = (ref) => {
      const C = find(ref.s), pc = C && piecesOf(C)[ref.part];
      let c = curveName(ref);
      if (C && pc && A.capPhrase) {
        if (isCirc3(C) && C.def.fill !== 'in') c = A.capPhrase(C, 'gen');
        else if (pc.kind === 'circle' && isXY(pc.c)) c = A.capPhrase({ id: '', kind: 'circle', c: pc.c.slice(), r: pc.r }, 'gen');
        else if (pc.kind === 'line' && isXY(pc.a) && isXY(pc.b)) c = A.capPhrase({ id: '', kind: 'line', a: pc.a.slice(), b: pc.b.slice() }, 'gen');
      }
      return c;
    };
    // the touching circle ({a}: T, {b}: P), the tangent at T, the tangent from P
    if (d.op === 'tangent') return { src: 'the tangent to {c} through {p}', params: { c: carrier(d.args[0]), p: P(1) } };
    if (d.op === 'touch') {
      const p = { a: P(1), b: P(2), c: carrier(d.args[0]) };
      if (d.args[2] && d.args[2].inf) return { src: 'the tangent to {c} at {a}', params: { c: p.c, a: p.a } };
      if (d.fill !== 'in') return s.kind === 'line' ? { src: 'the line through {b} touching {c} at {a}', params: p } : { src: 'the circle through {b} touching {c} at {a}', params: p };
      if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return { src: 'the half-plane to the left of the line from {a} to {b}', params: { a: P(i), b: P(j) } }; }
      if (s.complement) return { src: 'the outside of the circle through {b} touching {c} at {a}', params: p };
      return { src: 'the disc bounded by the circle through {b} touching {c} at {a}', params: p };
    }
    if (d.op === 'perp') {
      const p = { a: P(1), b: P(2), c: carrier(d.args[0]) };
      // [v16.4 segments SPEC 6.2] the hyperbolic line in the domain {r} (C's open side, as maths); through P and Q when both
      // lie on the drawn arc, else on K ({k}: K's whole caption, in the genitive)
      if (d.seg && d.fill !== 'in' && s._seg) {
        const info = segInfo(s), C = find(d.args[0].s), cpc = C && piecesOf(C)[d.args[0].part], kpc = piecesOf(s)[0];
        let r = null;
        try {
          // (review math-3: the outside of a circle is a disc of the sphere, infinity included)
          if (info && cpc && cpc.kind === 'circle' && isXY(cpc.c)) { r = Region.KINDS.disc.tex({ kind: 'disc', c: cpc.c, r: cpc.r }); if (info.word === 'out') r = `\\{${r.replace(/</g, '>')}\\}\\cup\\{\\infty\\}`; }
          else if (info && cpc && cpc.kind === 'line' && isXY(cpc.a) && isXY(cpc.b)) {
            const L = [cpc.a[0] - (cpc.b[1] - cpc.a[1]), cpc.a[1] + (cpc.b[0] - cpc.a[0])], left = info.seg * Constr.fOf(info.Gc, L) < 0;
            r = Region.KINDS.halfplane.tex({ kind: 'halfplane', a: left ? cpc.a : cpc.b, b: left ? cpc.b : cpc.a });
          }
        } catch (e) { r = null; }
        if (r) {
          // (review math-7: through P and Q only when both are points of the domain; review user-2, user-3: close: the phrase
          // ends with a comma when more words follow it)
          if (kpc && segThru(s, info)) return { src: 'the hyperbolic line through {a} and {b} in the domain {r}', params: { a: p.a, b: p.b, r: { m: r } }, close: true };
          const g = Constr.geomOf(s._g), copy = Object.assign({ id: '', _capT: isT(s), def: Object.assign({}, d, { seg: undefined }) }, g.line ? { kind: 'line', a: g.p, b: [g.p[0] + g.d[0], g.p[1] + g.d[1]] } : { kind: 'circle', c: g.c, r: g.r });
          delete copy.def.seg;
          const k = A.capPhrase ? A.capPhrase(copy, 'gen') : curveName({ s: s.id, part: 0 });
          return { src: 'the hyperbolic line in the domain {r} on {k}', params: { r: { m: r }, k }, close: true };
        }
      }
      if (d.fill !== 'in') return s.kind === 'line' ? { src: 'the line through {a} and {b} perpendicular to {c}', params: p } : { src: 'the circle through {a} and {b} perpendicular to {c}', params: p };
      if (s.kind === 'halfplane') { const [i, j] = hpOrder(s); return { src: 'the half-plane to the left of the line from {a} to {b}', params: { a: P(i), b: P(j) } }; }
      if (s.complement) return { src: 'the outside of the circle through {a} and {b} perpendicular to {c}', params: p };
      return { src: 'the disc bounded by the circle through {a} and {b} perpendicular to {c}', params: p };
    }
    return null;
  }
  // (the caption templates, for the Russian table's call-site scan: capT translates them at run time)
  const CAPTIONS = () => [$t('the line through {a}, {b} and {c}'), $t('the circle through {a}, {b} and {c}'), $t('the half-plane to the left of the line from {a} to {b}'),
    $t('the half-plane to the right of the line from {a} to {b}'), $t('the line through {a} and {b}'), $t('the segment from {a} to {b}'), $t('the ray from {a} through {b}'),
    $t('the outside of the circle through {a}, {b} and {c}'), $t('the disc bounded by the circle through {a}, {b} and {c}'), $t('the intersection {x} of {c1} and {c2}'),
    $t('the midpoint {x} of {a} and {b}'), $t('the point {x} on {c}'), $t('the perpendicular bisector of {a} and {b}'),
    $t('the circle through {a} and {b} perpendicular to {c}'), $t('the line through {a} and {b} perpendicular to {c}'),
    $t('the disc bounded by the circle through {a} and {b} perpendicular to {c}'), $t('the outside of the circle through {a} and {b} perpendicular to {c}'),
    $t('the circle through {b} touching {c} at {a}'), $t('the line through {b} touching {c} at {a}'), $t('the disc bounded by the circle through {b} touching {c} at {a}'),
    $t('the outside of the circle through {b} touching {c} at {a}'), $t('the tangent to {c} at {a}'), $t('the tangent to {c} through {p}'),
    $t('the hyperbolic line through {a} and {b} in the domain {r}'), $t('the hyperbolic line in the domain {r} on {k}')];

  // ---------------------------------------------------------------- the tool rows, the grid, the CSS, the keys
  const tsvg = (inner) => `<svg class="tic" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const dot = (x, y) => `<circle cx="${x}" cy="${y}" r="1.9" fill="currentColor" stroke="none"/>`;
  const ICON = {
    circle3: tsvg('<circle cx="10" cy="10.5" r="6.5"/>' + dot(4.4, 7.3) + dot(15.6, 7.3) + dot(10, 17)),
    meet: tsvg('<path d="M3 15.5L17 4.5M3 6.5c4 0 9 3 14 9"/><circle cx="10.1" cy="9.4" r="2.6" fill="none" stroke-width="1.3"/>'),
    midpoint: tsvg('<path d="M3.5 14.5l13-9"/>' + dot(3.5, 14.5) + dot(16.5, 5.5) + '<circle cx="10" cy="10" r="2.3" fill="none" stroke-width="1.3"/>'),
    bisector: tsvg('<path d="M3.5 13.5l13-7" stroke-opacity=".55"/>' + dot(3.5, 13.5) + dot(16.5, 6.5) + '<path d="M6.6 2.5l6.8 15"/><path d="M10.9 9.5l.7 1.5-1.5.7"/>'),
    // a line, a half-circle on it (centre (10, 14.5), r 5.5) with two dots on it, a right-angle mark at its right foot
    perp: tsvg('<path d="M2.5 14.5h15"/><path d="M4.5 14.5a5.5 5.5 0 0 1 11 0"/><path d="M15.5 12.4h2.1v2.1" stroke-width="1.1"/>' + dot(6.1, 10.62) + dot(12.8, 9.77)),
    // a circle and a smaller one touching it from outside, a dot at the touching point (exactly on both)
    touch: tsvg('<circle cx="8" cy="10" r="5.5"/><circle cx="16" cy="10" r="2.5"/>' + dot(13.5, 10)),
    // [v16.5 UX55] a circle (the boundary, faint) and the arc of a hyperbolic line inside it, with its two points
    hyper: tsvg('<circle cx="10" cy="10" r="7.5" stroke-opacity=".5"/><path d="M4.7 15.3A7.5 7.5 0 0 1 15.3 15.3" transform="translate(0 -4.6)"/>' + dot(7.6, 9.2) + dot(12.4, 9.2)),
  };
  function toolRows() {
    return [
      ['circle3', $t('Circle through 3 points'), 'E', $t('Pick three points: points on the page, crossings, or empty spots. The circle and its disc follow them.'), 'construct', $t('3-pt circle')],
      ['meet', $t('Intersect'), 'I', $t('Click a crossing of two curves, or one curve and then another.'), 'construct', $t('Intersect')],
      ['midpoint', $t('Midpoint'), 'U', $t('Pick two points, or a segment.'), 'construct', $t('Midpoint')],
      ['bisector', $t('Perpendicular bisector'), 'Q', $t('Pick two points, or a segment: the line of the points equally far from both.'), 'construct', $t('Bisector')],
      ['perp', $t('Perpendicular circle'), 'W', $t('Pick a line or a circle, then two points: the circle through them crosses it at right angles. The curve stays picked for the next one.'), 'construct', $t('⊥ circle')],
      ['touch', $t('Touching circle'), 'J', $t('Pick a line or a circle, then the point where the new circle touches it and a point it passes through, in either order. Click the dashed tangent or press Tangent line for the tangent line, or a ring for a tangent from the point. The curve stays picked for the next one.'), 'construct', $t('Touching')],
      ['hyper', $t('Hyperbolic line'), 'Y', $t('Pick the boundary (a line or a circle), then two points on one side of it: the hyperbolic line through them, the arc of the circle at right angles to the boundary. The boundary stays picked for the next one.'), 'construct', $t('Hyperbolic')],
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
.draft-chip.cm-on.cm-low { top: auto !important; bottom: 32px; left: 8px; translate: none; max-width: calc(100% - 64px); }
/* ([v16.5 check app-5] at the foot the chip clears the plane's buttons, 48 px narrower than at the top: its sentence may
   take a third line there rather than be cut; the one-line rule in syncChip measures it in this place) */
.draft-chip.cm-on.cm-low .cm-chip > .cm-t { -webkit-line-clamp: 3; }
.cm-seg { display: inline-flex; border: 1px solid var(--line); border-radius: var(--r-2, 6px); overflow: hidden; }
.cm-sb { border: 0; background: transparent; color: var(--ink-2); font: var(--t-label); padding: 2px 8px; cursor: pointer; }
.cm-sb.on { background: var(--inverse); color: var(--inverse-ink); }
/* [v16.4 review user-5] touch: each segment button takes taps 40px tall, with the same look */
.cm-seg.cm-touch { overflow: visible; }
.cm-seg.cm-touch .cm-sb { position: relative; }
.cm-seg.cm-touch .cm-sb:first-child { border-radius: 5px 0 0 5px; }
.cm-seg.cm-touch .cm-sb:last-child { border-radius: 0 5px 5px 0; }
.cm-seg.cm-touch .cm-sb::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 40px; transform: translateY(-50%); }
.cm-x { border: 0; background: transparent; color: var(--ink-2); font-size: 18px; line-height: 1; width: 28px; height: 28px; cursor: pointer; }
/* [v16.5 UX48, UX51, UX52, UX100] the chip wraps (text, then its controls; a refusal or the how-to on a line of its own); the
   kept curve's token; the ? */
.empty-chip > .cm-chip { flex-wrap: wrap; row-gap: 4px; }
/* (the chip's words let the plane take the pointer, as the polygon's chip does: only its buttons take a press, so a
   pick under its second line still lands) */
.draft-chip.cm-on, .empty-chip > .cm-chip { pointer-events: none; }
.cm-chip button { pointer-events: auto; }
.cm-chip > .cm-tok, .cm-chip > .cm-q { flex: 0 0 auto; }
/* (a mouse chip with only its words and the ?: the ? stays beside the words, not alone on a line below them) */
.cm-chip:not(.cm-tch):not(:has(> .cm-seg, > .cm-tok)) > .cm-t { flex: 1 1 0; }
.cm-tok { display: inline-flex; align-items: center; gap: 2px; height: 22px; border: 1px solid var(--line); border-radius: 999px; padding: 0 1px 0 8px; font: var(--t-label); color: var(--ink-2); white-space: nowrap; background: var(--surface); }
.cm-tokx, .cm-q { position: relative; border: 0; background: transparent; color: var(--ink-2); cursor: pointer; font: 600 13px/1 var(--f-ui); width: 20px; height: 20px; border-radius: 999px; padding: 0; }
.cm-q { border: 1px solid var(--line); font-size: 11.5px; }
.cm-q.on { background: var(--inverse); color: var(--inverse-ink); border-color: var(--inverse); }
.cm-tokx:hover, .cm-q:not(.on):hover { color: var(--accent); border-color: var(--accent); }
.cm-chip > .cm-warn, .cm-chip > .cm-how { flex: 1 0 100%; font: var(--t-label); white-space: normal; text-align: left; padding: 0 0 2px; }
.cm-chip > .cm-warn { color: var(--warn); font-weight: 600; }
.cm-chip > .cm-how { color: var(--ink-2); max-width: 52ch; }
/* a finger: words in the segments, every control taps 44 px */
.cm-chip.cm-tch .cm-sb { min-width: 44px; }
.cm-chip.cm-tch :is(.cm-x, .cm-tokx, .cm-q)::after { content: ''; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }
.cm-chip.cm-tch .cm-x { position: relative; width: 32px; height: 32px; }
/* (a finger: the × beside the words on the first line, the choices on the second) */
.cm-chip.cm-tch > .cm-t { flex: 1 1 calc(100% - 48px); }
.cm-chip.cm-tch > .cm-x { order: 1; margin-left: auto; }
.cm-chip.cm-tch > :is(.cm-tok, .cm-q, .cm-seg) { order: 2; }
.cm-chip.cm-tch > :is(.cm-warn, .cm-how) { order: 3; }
/* (between the lines the choices' 40 px taps win over the ×'s 44 px tap: a finger a little high on Outside never
   cancels the construction) */
.empty-chip > .cm-chip.cm-tch { row-gap: 8px; }
.cm-chip.cm-tch > .cm-seg { position: relative; z-index: 1; }
.cm-t > .cm-nw { white-space: nowrap; }
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
@media (min-width: 768px) { :root:not(.ph) .cm-tight3 > .rail-label { display: none; } }
/* [v16.5 UX55] last, the Hyperbolic line tile leaves the rail (it stays in the drawer's Construct grid and in ⌘K) */
#railTools.cm-tight4 > .rail-tool[data-tool="hyper"] { display: none; }
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
.cm-ibreak { flex-basis: 100%; height: 0; }
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
    if (e.key === 'Escape' && A && cancelDrag()) { e.preventDefault(); e.stopPropagation(); return; }   // ([v16.5 rail SPEC 2.6])
    if (e.key === 'Escape' && A) pickOk();   // ([v16.5 fix rail-7] Esc takes the refusal away, whatever else it closes)
    if (!draftC || !A) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    // (a draft without picks lets Esc through: it closes what the app's Esc closes)
    const has = !!(draftC.picks.length || draftC.curve1);
    if (e.key === 'Escape' && has) { cancel(); e.preventDefault(); e.stopPropagation(); }
    else if (e.key === 'Backspace' && has) { back(); e.preventDefault(); e.stopPropagation(); }
    // (Enter after the touching circle's T: nothing else is pending there; a focused button keeps its own Enter)
    else if (e.key === 'Enter' && !(t && t.tagName === 'BUTTON') && tangentNow()) { e.preventDefault(); e.stopPropagation(); }
  }
  // the tablet rail (SPEC 5.4): when it would overflow the panel, Grid and Polar grid leave it first (they stay in the
  // drawer), then Freehand and Lasso; (v16.3, the fifth Construct tool) then the rail's vertical "Region tools" label,
  // which v16.2 already cut by 10 px at 1024 × 768 (the count above it and the open key stay)
  function fitRail() {
    const rail = document.getElementById('railTools');
    if (!rail || !rail.offsetParent) return;
    const box = rail.closest('.panel') || rail.parentElement;
    const over = () => box.scrollHeight > box.clientHeight + 1;
    rail.classList.remove('cm-tight1', 'cm-tight2', 'cm-tight4');
    if (rail.parentElement) rail.parentElement.classList.remove('cm-tight3');
    if (over()) rail.classList.add('cm-tight1');
    if (over()) rail.classList.add('cm-tight2');
    if (over() && rail.parentElement) rail.parentElement.classList.add('cm-tight3');
    if (over()) rail.classList.add('cm-tight4');
  }
  function ui(adapter) {
    A = adapter;
    css();
    try { const rail = document.getElementById('railTools'); if (rail && window.ResizeObserver) { const ro = new ResizeObserver(() => fitRail()); ro.observe(rail.closest('.panel') || rail.parentElement); } } catch (e) { /* */ }
    window.addEventListener('keydown', keydown, true);
    window.addEventListener('pointerdown', (e) => { lastPressTouch = e.pointerType === 'touch' || e.pointerType === 'pen'; lastPressAt = performance.now(); }, true);
    if (typeof PlaneMenu !== 'undefined') PlaneMenu.register('constructions', menuItems);
    if (freedLater) { freedLater = false; freedToast(); }
  }
  // the command palette: the six tools; Make free and Use complement for a selected construction (SPEC 5.6)
  function paletteActs() {
    const out = CTOOLS.map((id) => [toolName(id), () => A.setTool(id), '']);
    const s = A.selected() && find(A.selected());
    if (s && (s.def || s.at)) out.push([$t('Make free'), () => api.cm.makeFree(s.id), '']);
    if (isCirc3(s) && s.def.fill === 'in') out.push([$t('Use complement'), () => api.cm.setDef(s.id, { flip: !s.def.flip }), '']);
    return out;
  }
  // a tool change: the draft goes, the chip follows
  function toolChanged() {
    if (draftC && draftC.tool !== A.tool()) draftC = null;
    gestSnap = null; ring = null;
    // [v16.5 UX52] what the last tool said goes with it
    pickWarnMsg = null; clearTimeout(pickWarnT); howOpen = false;
    if (lastToast && lastToast.isConnected) lastToast.remove();
    lastToast = null;
  }
  // TEMP-DEBUG-HOOK (removed before publishing)
  function debug() {
    return { chipBot: Object.assign({}, chipBot), hover: draftC && draftC.hover, chipRect: lastChip, rail: rail ? { side: rail.side, stretch: rail.stretch ? { a: rail.stretch.a, b: rail.stretch.b, k: rail.stretch.k } : null } : null, freeChip: freeChip ? freeChip.text : null, ring: ring ? { side: ring.side, z: ring.z, ref: ring.ref, cls: ring.cls, chip: ring.chip, warn: ring.warn } : null, draft: draftC ? { tool: draftC.tool, side: draftC.side, picks: draftC.picks.map((p) => ({ cls: p.cls, z: p.z, ref: p.ref, role: p.role })), curve1: draftC.curve1 && draftC.curve1.ref, hoverT: draftC.hoverT ? { cls: draftC.hoverT.cls, k: draftC.hoverT.k, z: draftC.hoverT.z } : null, rings: draftC.tool === 'touch' && draftC.picks[0] && draftC.picks[0].role === 'P' ? ringsOf(draftC.picks[0].z).map((r) => ({ k: r.k, tp: r.tp })) : null, hint: draftC.tool === 'touch' && draftC.picks[0] && draftC.picks[0].role === 'T' ? hintForm(draftC.picks[0].z) : null } : null, fill: fillMode, seg: segMode, events: events.map((e) => e.type) };
  }
  // TEMP-DEBUG-HOOK
  // (every entry point is inert until the app's adapter arrives: init() builds the tools before Construct.ui runs)
  const g = (f, d) => (...a) => (A && api ? f(...a) : d);
  return {
    init(a) { api = a; },
    on, ui, toolRows, toolChip: () => toolChip(), ICON, buildGrid, CTOOLS, isTool: isCTool,
    vertexPick: g(vertexPick, null), bindVertices: g(bindVertices), globeClick: g(globeClick, false), boundUnder: g(boundUnder, null), snapAt: g(snapAt, null), drawStart: g(drawStart, null), drawMove: g(drawMove, null), drawEnd: g(drawEnd), pointDown: g(pointDown, false),
    handleMove: g(handleMove, null), handleUp: g(handleUp), moveUp: g(moveUp), moveDrag: g(moveDrag, false), cancelDrag: g(cancelDrag, false), globeSlide: g(globeSlide, null), globePoint: g(globePoint, false), touchNow: () => touchNow(), altNow: () => !!A && altNow(), samePick, click: g(click, false), toolDown: g(toolDown, false), cancel: g(cancel, false), back: g(back, false), drafting: g(drafting, false), undoPick: g(undoPick, null), undoPickable: g(undoPickable, false), hint: g(() => chipText(true, true), ''),
    hover: g(hover), finalPick: g(finalPick, false), pointer, leave: g(leave), drawOverlay: g(drawOverlay), syncChip: g(syncChip), chipSide: g(chipSide, null), toolChanged: g(toolChanged), deleteMessage: g(deleteMessage, null), zpOffNote: g(zpOffNote, ''),
    row: g(row, false), rowMenu: g(rowMenu), markLinks: g(markLinks), orderRows: g(orderRows), linked: g(linked, new Set()),
    fixedName: (s) => (A ? fixedName(s) : null), defText: g(defText, null), reasonText: g(reasonText, ''), refName: g(refName, ''), shapeLabel: g(shapeLabel, ''), pointName: g(pointName, ''), followsText: g(followsText, ''), phrase: g(phrase, null), menuItems: g(menuItems, []),
    inspectorSig: g(inspectorSig, null), inspectorBuild, inspectorFill, usedBy: g((id) => { try { return [...graph().users(id)]; } catch (e) { return []; } }, []), setFill, paletteActs: g(paletteActs, []), CAPTIONS,
    // TEMP-DEBUG-HOOK (removed before publishing)
    debug,
    // TEMP-DEBUG-HOOK
    pointMark: (s) => (s.helper ? 'helper' : s.def && s.def.op !== 'glider' ? 'ring' : null),
    get api() { return api; },
    get events() { return events.slice(); },
    get fill() { return fillMode; }, set fill(v) { fillMode = v === 'none' ? 'none' : 'in'; },
    get seg() { return segMode; }, set seg(v) { segMode = v === 'in' || v === 'out' ? v : 'whole'; },
    setSeg: g(setSeg),
  };
})();
if (typeof module !== 'undefined') module.exports = Construct;
