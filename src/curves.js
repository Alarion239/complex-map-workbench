'use strict';
// Curves: region formulas of dimension 1, the equations of Expr.classifyRelation ('curve'): Re z = 0, |z - 1| = 2,
// Re z^2 = 1, |z| = 1, Im z > 0 ... (notes/curves-design.md).
// - Curves.fromFormula(src | ast) -> a description: per piece (one equation, maybe restricted by inequalities) either
//   EXACT shapes of Region's curve kinds (line, ray, segment, circle, arc; point) or a traced implicit curve g = 0.
// - Curves.trace / sample / curvesOf / loops / isClosed (window dependent; cached per window): float64 polylines whose
//   every sample lies on the curve (edge crossings by bracketing to adjacent doubles, chord points projected onto the
//   curve), closed loops flagged and counterclockwise, open ends continued outward toward infinity.
// Needs CX and Expr; Region only for sampling the exact shapes (Region.curvesOf / sampleCurve / polyCurve).
const Curves = (() => {
  const { C } = CX;
  const EPS = 2.220446049250313e-16;
  const TAU = 2 * Math.PI;
  const FAR = 220; // as Region.FAR: unbounded curves reach this many window half-sizes beyond the view
  const RG = () => Region;
  const hyp = Math.hypot;
  const expandBox = (b, f) => {
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, hw = (b.x1 - b.x0) / 2 * f, hh = (b.y1 - b.y0) / 2 * f;
    return { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
  };
  const isConst = (n) => !Expr.depends(n) && !Expr.hasBool(n);
  const cval = (n) => { try { const v = Expr.compile(n)(C(0, 0)); return CX.isFin(v) ? v : null; } catch (e) { return null; } };
  const realC = (v) => !!v && (v.im === 0 || Math.abs(v.im) <= 1e-14 * Math.abs(v.re));
  // short decimals as typed (0.1 + 0.2 -> 0.3): a value within 4 ulp of its 12-digit rounding is that rounding
  const snap = (v, scale = Math.abs(v)) => {
    if (Math.abs(v) <= 1e-14 * scale) return 0;
    const r = Number(v.toPrecision(12));
    return Math.abs(r - v) <= 4 * EPS * Math.abs(v) ? r : v;
  };
  // test points of the numerical recognizers (not those of Expr: an independent sample)
  const PROBE = (() => {
    const out = [];
    let k = 0;
    for (const r of [0.29, 0.81, 1.53, 3.1, 6.7, 13.9, 41]) for (let j = 0; j < 7; j++, k++) { const t = 1.1 + 2.399963 * k; out.push(C(r * Math.cos(t), r * Math.sin(t))); }
    return out;
  })();

  // ---------- the equation's real function g = A - B ----------
  // NaN where a side is not finite, and (unless the sides are structurally real) where A - B is not real: a
  // 'partial' equation such as ln(Re z) = 0 lives where the difference is real. A 'complex' equation (z = \bar z,
  // \bar z = 1/z; dir = c from Expr.classifyRelation) gives g = Re(D conj c) with D = A - B, and g.h = Im(D conj c):
  // its curve is the part of g = 0 where h = 0 too (g = 0 alone adds lines through the zeros of Re(u conj c), where
  // D = s u). g.m is the size of the terms of the last value (|A| + |B|: g's rounding noise is about EPS times it).
  function evaluator(eq, real, dir) {
    const A = Expr.compile(eq.a), B = Expr.compile(eq.b), check = real !== 'structural';
    let g;
    if (real === 'complex') {
      const c = dir || C(1, 0);
      g = (x, y) => {
        g.n++;
        const z = C(x, y), a = A(z), b = B(z), dr = a.re - b.re, di = a.im - b.im;
        g.m = CX.abs(a) + CX.abs(b);
        const v = dr * c.re + di * c.im;
        return Number.isFinite(v) && Number.isFinite(g.m) ? v : NaN;
      };
      g.h = (x, y) => { const z = C(x, y), a = A(z), b = B(z); return (a.im - b.im) * c.re - (a.re - b.re) * c.im; };
    } else {
      g = (x, y) => {
        g.n++;
        const z = C(x, y), a = A(z), b = B(z), re = a.re - b.re;
        g.m = Math.abs(a.re) + Math.abs(a.im) + Math.abs(b.re) + Math.abs(b.im);
        if (!Number.isFinite(re)) return NaN;
        if (check && !(Math.abs(a.im - b.im) <= 1e-9 * g.m)) return NaN;
        return re;
      };
    }
    g.n = 0; g.m = 0;
    // the size of the terms g is the difference of (its rounding noise is about EPS times this)
    g.mag = (x, y) => { const z = C(x, y), a = A(z), b = B(z); return CX.abs(a) + CX.abs(b); };
    return g;
  }
  // E = 0 for |E| = 0, E^k = 0 (k > 0), \sqrt{E} = 0, -E = 0, cE = 0 when E is real: the zero set without the touching
  // sign (|Re z| = 0 never changes sign, Re z = 0 does)
  function stripTouch(eq) {
    let a = eq.a, b = eq.b;
    const zero = (n) => { const v = isConst(n) ? cval(n) : null; return !!v && v.re === 0 && v.im === 0; };
    if (zero(a)) [a, b] = [b, a];
    if (!zero(b)) return eq;
    for (;;) {
      // (only around a structurally real inner side: (i Re z)^2 = 0 keeps its square)
      const real = (n) => Expr.realOf(n).real;
      if (a.t === 'call' && a.f === 'abs' && real(a.a)) { a = a.a; continue; }
      if (a.t === 'call' && a.f === 'sqrt' && Expr.realOf(a.a).nonneg) { a = a.a; continue; }
      if (a.t === 'root' && Expr.realOf(a.a).nonneg) { a = a.a; continue; }
      if (a.t === 'neg' && real(a.a)) { a = a.a; continue; }
      if (a.t === 'pow' && isConst(a.b) && real(a.a)) { const k = cval(a.b); if (k && k.im === 0 && k.re > 0) { a = a.a; continue; } }
      if ((a.t === 'mul' || a.t === 'div') && isConst(a.b) && real(a.a)) { const k = cval(a.b); if (realC(k) && k.re !== 0) { a = a.a; continue; } }
      if (a.t === 'mul' && isConst(a.a) && real(a.b)) { const k = cval(a.a); if (realC(k) && k.re !== 0) { a = a.b; continue; } }
      break;
    }
    return a === eq.a && b === eq.b ? eq : { t: 'cmp', op: '=', a, b };
  }
  // ---------- rewriting equations whose zero set is touched rather than crossed ----------
  const NUM = (re, im = 0) => ({ t: 'num', v: C(re, im) });
  const ZV = { t: 'var', n: 'z' };
  const CALL = (f, a) => ({ t: 'call', f, a });
  const CMP = (op, a, b = NUM(0)) => ({ t: 'cmp', op, a, b });
  const AND = (a, b) => (a && b ? { t: 'and', a, b } : a || b);
  // x, y, r, theta as the calls they stand for
  const canon = (n) => (n.t === 'var' ? ({ x: CALL('re', ZV), y: CALL('im', ZV), r: CALL('abs', ZV), theta: CALL('arg', ZV) }[n.n] || n) : n);
  const isZeroConst = (n) => { const v = isConst(n) ? cval(n) : null; return !!v && v.re === 0 && v.im === 0; };
  // E of arg E or Im log E (Im Log E: the principal value, = arg E), else null
  const argOf = (X) => {
    X = canon(X);
    if (X.t === 'call' && X.f === 'arg') return X.a;
    if (X.t === 'call' && X.f === 'im' && X.a.t === 'call' && X.a.f === 'log') return X.a.a;
    return null;
  };
  // normalize(piece) -> [{eq, restrict, real, dir, kind: 'curve' | 'zeros', E?}] and notes: the forms that marching
  // squares can trace (g changes sign across the curve), each with the same meaning as the piece:
  // - a product = 0 (structurally real factors): one piece per factor ((Re z)^2 (Im z)^2 = 0: both axes);
  // - arg E = θ, Im log E = θ (E not affine; the affine ones are exact rays): Im(E e^{-iθ}) = 0 where
  //   Re(E e^{-iθ}) > 0 (arg(z^2) = π: the imaginary axis; no jump along arg's cut);
  // - |E| = ±Re E: Im E = 0 where ±Re E >= 0; |E| = ±Im E: Re E = 0 where ±Im E >= 0 (|z| = Re z: the positive axis);
  // - |E| = 0 with E complex: E = 0, a 'complex' curve (|z - \bar z| = 0) or isolated points (kind 'zeros':
  //   |z^2 - 1| = 0 is ±1).
  // E is analytic in z and depends on it: built from z, constants and holomorphic functions (no conj, Re, Im, |·|, arg)
  const NON_HOLO = new Set(['conj', 'abs', 're', 'im', 'arg']);
  function analytic(E) {
    let ok = true;
    const walk = (n) => {
      if (!ok || !n || typeof n !== 'object') return;
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.t === 'var' && n.n !== 'z' && n.n !== 'w') ok = false;
      if (n.t === 'call' && NON_HOLO.has(n.f)) ok = false;
      if (n.t === 'cmp' || n.t === 'and' || n.t === 'or' || n.t === 'not') ok = false;
      for (const k of Object.keys(n)) if (k !== 't' && n[k] && typeof n[k] === 'object') walk(n[k]);
    };
    walk(E);
    return ok && Expr.depends(E);
  }
  function normalize(pc, notes) {
    const out = [];
    const rewritable = pc.real === 'structural' || pc.real === 'numeric';
    const go = (eq, restrict, real, dir, depth) => {
      const base = () => out.push({ eq, restrict, real, dir, kind: 'curve' });
      if (depth > 12) return base();
      if (real === 'complex' || real === 'partial') return base();
      eq = stripTouch(eq);
      let a = canon(eq.a), b = canon(eq.b);
      if (isZeroConst(a)) [a, b] = [b, a];
      if (isZeroConst(b)) {
        // a product of real factors
        if (a.t === 'mul' && !isConst(a.a) && !isConst(a.b) && Expr.realOf(a.a).real && Expr.realOf(a.b).real) {
          go(CMP('=', a.a), restrict, real, dir, depth + 1);
          go(CMP('=', a.b), restrict, real, dir, depth + 1);
          return;
        }
        // |E| = 0, E complex (not affine: |z - c| = 0 is the exact point c): E = 0
        if (a.t === 'call' && a.f === 'abs' && !Expr.realOf(a.a).real && !affineOf(a.a)) {
          const e0 = CMP('=', a.a);
          let k;
          // an analytic E (z only, no conj / Re / Im / |·| / arg) that is not constant has isolated zeros, whatever its
          // degree (the numeric realness test can take z^30 - 1 for 'partial')
          const holo = analytic(a.a);
          try { k = holo ? { dim: 'error', error: Expr.REL_MSG.complex } : Expr.classifyRelation(e0); } catch (e) { k = { dim: 'error' }; }
          if (k.dim === 'curve') { const p = k.pieces[0]; return go(p.eq, restrict, p.real, p.dir, depth + 1); }
          if (k.dim === 'error' && k.error === Expr.REL_MSG.complex) {
            notes.add($t('This equation holds only at isolated points (where the expression inside |·| is 0): they are shown as points.'));
            out.push({ eq, restrict, real, dir, kind: 'zeros', E: a.a });
            return;
          }
          return base();
        }
      }
      // arg E = θ (not affine E)
      const iso = isolate({ a: eq.a, b: eq.b });
      if (iso && realC(iso.v)) {
        const E = argOf(iso.X);
        if (E && !affineOf(E)) {
          const v = iso.v.re;
          if (!(v > -Math.PI && v <= Math.PI)) { notes.add($t('arg takes values in (−π, π] (arg z = π is the negative real axis), so this equation has no points.')); return; }
          let cr = Math.cos(v), ci = -Math.sin(v);
          if (Math.abs(cr) < 1e-15) cr = 0;
          if (Math.abs(ci) < 1e-15) ci = 0;
          const F = cr === 1 && ci === 0 ? E : { t: 'mul', a: E, b: NUM(cr, ci) };
          return go(CMP('=', CALL('im', F)), AND(restrict, CMP('>', CALL('re', F))), 'structural', undefined, depth + 1);
        }
      }
      // |E| = ±Re E, |E| = ±Im E
      for (const [P, Q] of [[a, b], [b, a]]) {
        if (!(P.t === 'call' && P.f === 'abs')) continue;
        let sgn = 1, R = Q;
        if (R.t === 'neg') { sgn = -1; R = canon(R.a); }
        R = canon(R);
        if (!(R.t === 'call' && (R.f === 're' || R.f === 'im'))) continue;
        const E1 = P.a.t === 'var' && P.a.n === 'z' ? ZV : P.a;
        if (!Expr.sameAst(E1, R.a)) continue;
        const other = CALL(R.f === 're' ? 'im' : 're', R.a);
        return go(CMP('=', other), AND(restrict, CMP(sgn > 0 ? '>' : '<', R)), 'structural', undefined, depth + 1);
      }
      base();
    };
    if (rewritable) go(pc.eq, pc.restrict, pc.real, pc.dir, 0);
    else if (pc.real === 'complex') out.push({ eq: pc.eq, restrict: pc.restrict, real: pc.real, dir: pc.dir, kind: 'curve' });
    else out.push({ eq: stripTouch(pc.eq), restrict: pc.restrict, real: pc.real, dir: pc.dir, kind: 'curve' });
    return out;
  }

  // ---------- exact recognition ----------
  // E(z) = alpha z + beta (anti: alpha conj(z) + beta), numerically at the probe points; null otherwise
  function affineOf(E) {
    let f;
    try { f = Expr.compile(E); } catch (e) { return null; }
    const e0 = f(C(0, 0)), e1 = f(C(1, 0)), ei = f(C(0, 1));
    if (!CX.isFin(e0) || !CX.isFin(e1) || !CX.isFin(ei)) return null;
    const alpha = CX.sub(e1, e0), di = CX.sub(ei, e0);
    if (CX.isZero(alpha) && CX.isZero(di)) return null;
    const sc = CX.abs(alpha) + CX.abs(e0);
    let anti;
    if (CX.abs(CX.sub(di, C(-alpha.im, alpha.re))) <= 1e-13 * sc) anti = false;
    else if (CX.abs(CX.sub(di, C(alpha.im, -alpha.re))) <= 1e-13 * sc) anti = true;
    else return null;
    for (const p of PROBE) {
      const v = f(p), q = anti ? CX.conj(p) : p, w = CX.add(CX.mul(alpha, q), e0);
      if (!CX.isFin(v) || CX.abs(CX.sub(v, w)) > 1e-12 * (CX.abs(alpha) * CX.abs(p) + CX.abs(e0) + CX.abs(v))) return null;
    }
    // |alpha conj z + beta| = |conj(alpha) z + conj(beta)|: callers that only need |E| use the holomorphic form
    return { alpha, beta: e0, anti, hol: anti ? { alpha: CX.conj(alpha), beta: CX.conj(e0) } : { alpha, beta: e0 } };
  }
  // side = k |E| (k > 0 real constant; |z| for the variable r)
  function absSide(n) {
    let k = 1;
    for (;;) {
      if (n.t === 'var' && n.n === 'r') return { E: { t: 'var', n: 'z' }, k };
      if (n.t === 'call' && n.f === 'abs') return { E: n.a, k };
      if (n.t === 'mul' && isConst(n.a)) { const v = cval(n.a); if (!realC(v) || !(v.re > 0)) return null; k *= v.re; n = n.b; continue; }
      if (n.t === 'mul' && isConst(n.b)) { const v = cval(n.b); if (!realC(v) || !(v.re > 0)) return null; k *= v.re; n = n.a; continue; }
      if (n.t === 'div' && isConst(n.b)) { const v = cval(n.b); if (!realC(v) || !(v.re > 0)) return null; k /= v.re; n = n.a; continue; }
      return null;
    }
  }
  // the non-constant side X and the constant v with X = v (peeling + - * / by constants and positive powers of
  // non-negative sides), or null
  function isolate(eq) {
    let X, v;
    if (isConst(eq.b)) { X = eq.a; v = cval(eq.b); } else if (isConst(eq.a)) { X = eq.b; v = cval(eq.a); } else return null;
    if (!v) return null;
    for (;;) {
      if (X.t === 'neg') { v = CX.neg(v); X = X.a; continue; }
      if (X.t === 'add' || X.t === 'sub') {
        if (isConst(X.b)) { const k = cval(X.b); if (!k) return null; v = X.t === 'add' ? CX.sub(v, k) : CX.add(v, k); X = X.a; continue; }
        if (isConst(X.a)) { const k = cval(X.a); if (!k) return null; v = X.t === 'add' ? CX.sub(v, k) : CX.sub(k, v); X = X.b; continue; }
        return { X, v };
      }
      if (X.t === 'mul') {
        const [K, Y] = isConst(X.a) ? [X.a, X.b] : isConst(X.b) ? [X.b, X.a] : [null, null];
        if (!K) return { X, v };
        const k = cval(K);
        if (!k || CX.isZero(k)) return null;
        v = CX.div(v, k); X = Y; continue;
      }
      if (X.t === 'div' && isConst(X.b)) { const k = cval(X.b); if (!k || CX.isZero(k)) return null; v = CX.mul(v, k); X = X.a; continue; }
      if (X.t === 'pow' && isConst(X.b) && Expr.realOf(X.a).nonneg) {
        const p = cval(X.b);
        if (!realC(p) || !(p.re > 0) || !realC(v)) return { X, v };
        v = C(v.re >= 0 ? Math.pow(v.re, 1 / p.re) : -1, 0); X = X.a; continue;
      }
      return { X, v };
    }
  }
  // exact shapes' points: a coordinate within 4 ulp of a short decimal is that decimal, one below 1e-14 x scale is 0
  const pt = (z, scale = CX.abs(z)) => [snap(z.re, scale), snap(z.im, scale)];
  const fmtC = (z) => CX.fmt(z, 6);
  function circleShape(c, r) {
    if (!(r >= 0) || !Number.isFinite(r)) return { shapes: [], note: $t('The radius is negative, so the circle has no points.') };
    if (r === 0) return { shapes: [{ kind: 'point', p: pt(c) }], note: $t('A circle of radius 0 is the single point {c}.', { c: fmtC(c) }) };
    return { shapes: [{ kind: 'circle', c: pt(c), r }] };
  }
  // the line a x + b y + c = 0 as Region's {kind: 'line'}: a = the point nearest 0, b = a + the unit direction
  function lineShape(a, b, c) {
    const L = hyp(a, b);
    if (!(L > 0)) return null;
    const p0 = pt(C(-c * a / (L * L), -c * b / (L * L))), d = pt(C(-b / L, a / L), 1);
    return { shapes: [{ kind: 'line', a: p0, b: [p0[0] + d[0], p0[1] + d[1]] }] };
  }
  function recognize(eq) {
    // |E| = v (circle or point), arg E = v (ray)
    const iso = isolate(eq);
    if (iso && realC(iso.v)) {
      const v = iso.v.re;
      const ab = absSide(iso.X);
      if (ab) {
        const af = affineOf(ab.E);
        if (af) {
          const { alpha, beta } = af.hol, A = CX.abs(alpha);
          if (A > 0) return circleShape(CX.neg(CX.div(beta, alpha)), v / ab.k / A);
        }
      }
      // arg E = v, also Im log E = v and θ = v
      const argE = argOf(iso.X);
      if (argE) {
        const af = affineOf(argE);
        if (af && !CX.isZero(af.alpha)) {
          if (!(v > -Math.PI && v <= Math.PI)) return { shapes: [], note: $t('arg takes values in (−π, π] (arg z = π is the negative real axis), so this equation has no points.') };
          // arg(alpha w) = v, w = z - c (anti: arg(alpha conj w) = v)
          const c = af.anti ? CX.conj(CX.neg(CX.div(af.beta, af.alpha))) : CX.neg(CX.div(af.beta, af.alpha));
          const phi = af.anti ? -(v - CX.arg(af.alpha)) : v - CX.arg(af.alpha);
          const a = pt(c), u = pt(C(Math.cos(phi), Math.sin(phi)), 1);
          return { shapes: [{ kind: 'ray', a, b: [a[0] + u[0], a[1] + u[1]] }] };
        }
      }
    }
    // k1 |E1| = k2 |E2|: an Apollonius circle, or the perpendicular bisector
    if (!iso) {
      const s1 = absSide(eq.a), s2 = absSide(eq.b);
      if (s1 && s2) {
        const f1 = affineOf(s1.E), f2 = affineOf(s2.E);
        if (f1 && f2 && !CX.isZero(f1.alpha) && !CX.isZero(f2.alpha)) {
          const p = CX.neg(CX.div(f1.hol.beta, f1.hol.alpha)), q = CX.neg(CX.div(f2.hol.beta, f2.hol.alpha));
          const K1 = s1.k * CX.abs(f1.alpha), K2 = s2.k * CX.abs(f2.alpha), k = K2 / K1;
          if (Math.abs(k - 1) <= 1e-14) {
            // |z - p| = |z - q|: 2 Re(conj(q - p) z) = |q|^2 - |p|^2
            const d = CX.sub(q, p);
            return lineShape(2 * d.re, 2 * d.im, CX.abs2(p) - CX.abs2(q));
          }
          const k2 = k * k, c = CX.scale(CX.sub(p, CX.scale(q, k2)), 1 / (1 - k2));
          return circleShape(c, k * CX.abs(CX.sub(p, q)) / Math.abs(1 - k2));
        }
      }
    }
    // numerically: g = s (x^2 + y^2) + a x + b y + c (Re z = 1, x + 2y = 3, Re((1+i) z) = 1, |z|^2 = 4, z \bar z = 1)
    return quadric(eq);
  }
  // a complex equation (z = \bar z, z - \bar z = 2i, (1+i) Re z = 1+i): the quadric fit of Re(D conj c), kept only when
  // D = A - B vanishes on the shape it gives (otherwise traced)
  function recognizeComplex(eq, dir) {
    let A, B;
    try { A = Expr.compile(eq.a); B = Expr.compile(eq.b); } catch (e) { return null; }
    const D = (z) => { const a = A(z), b = B(z); return { re: a.re - b.re, im: a.im - b.im, m: CX.abs(a) + CX.abs(b) }; };
    const G = (z) => { const d = D(z); return d.re * dir.re + d.im * dir.im; };
    const rec = quadric(eq, G, (z) => D(z).m);
    if (!rec || !rec.shapes.length) return rec;
    const on = (z) => { const d = D(z); return Number.isFinite(d.m) && Math.hypot(d.re, d.im) <= 1e-9 * d.m + 1e-300; };
    for (const s of rec.shapes) {
      let test;
      if (s.kind === 'line') { const a = C(s.a[0], s.a[1]), d = C(s.b[0] - s.a[0], s.b[1] - s.a[1]); test = [-3.7, 0.4, 2.3, 11.9].map((t) => C(a.re + t * d.re, a.im + t * d.im)); }
      else if (s.kind === 'circle') test = [0.3, 1.9, 3.3, 4.4, 5.8].map((t) => C(s.c[0] + s.r * Math.cos(t), s.c[1] + s.r * Math.sin(t)));
      else test = [C(s.p[0], s.p[1])];
      if (!test.every(on)) return null;
    }
    return rec;
  }
  function quadric(eq, G0, M0) {
    let A, B;
    try { A = Expr.compile(eq.a); B = Expr.compile(eq.b); } catch (e) { return null; }
    const G = G0 || ((z) => { const a = A(z), b = B(z); return a.re - b.re; });
    const M = M0 || ((z) => { const a = A(z), b = B(z); return CX.abs(a) + CX.abs(b); });
    for (const p0 of [C(0, 0), C(0.375, 0.625)]) {
      const g0 = G(p0), gxp = G(C(p0.re + 1, p0.im)), gxm = G(C(p0.re - 1, p0.im)), gyp = G(C(p0.re, p0.im + 1)), gym = G(C(p0.re, p0.im - 1));
      if (![g0, gxp, gxm, gyp, gym].every(Number.isFinite)) continue;
      let s = (gxp + gxm) / 2 - g0;
      const sy = (gyp + gym) / 2 - g0;
      const scale = M(p0) + M(C(p0.re + 1, p0.im)) + M(C(p0.re, p0.im + 1)) + 1e-300;
      if (Math.abs(s - sy) > 1e-12 * scale) return null;
      let a = (gxp - gxm) / 2 - 2 * s * p0.re, b = (gyp - gym) / 2 - 2 * s * p0.im;
      let c = g0 - s * (p0.re * p0.re + p0.im * p0.im) - a * p0.re - b * p0.im;
      let fin = 0;
      for (const p of PROBE) {
        const v = G(p);
        if (!Number.isFinite(v)) continue;
        fin++;
        const r2 = p.re * p.re + p.im * p.im, w = s * r2 + a * p.re + b * p.im + c;
        const tol = 1e-11 * (Math.abs(s) * r2 + Math.abs(a * p.re) + Math.abs(b * p.im) + Math.abs(c) + M(p));
        if (!(Math.abs(v - w) <= tol)) return null;
      }
      if (fin < PROBE.length * 0.8) return null;
      const sc = Math.max(Math.abs(s), Math.abs(a), Math.abs(b), Math.abs(c));
      s = snap(s, sc); a = snap(a, sc); b = snap(b, sc); c = snap(c, sc);
      if (s === 0) return lineShape(a, b, c);
      const cen = C(-a / (2 * s), -b / (2 * s)), r2 = (a * a + b * b) / (4 * s * s) - c / s;
      if (Math.abs(r2) <= 1e-14 * CX.abs2(cen)) return circleShape(cen, 0);
      return circleShape(cen, r2 >= 0 ? Math.sqrt(r2) : -1);
    }
    return null;
  }
  // ---------- restriction of exact shapes: parameter intervals where R > 0, ends by bisection ----------
  function bisectParam(f, a, b) {
    // f(a) > 0 >= f(b) or the reverse; returns the parameter of the sign change (adjacent doubles)
    const fa = f(a) > 0;
    for (let i = 0; i < 200; i++) {
      const m = 0.5 * (a + b);
      if (m === a || m === b) break;
      if ((f(m) > 0) === fa) a = m; else b = m;
    }
    return fa ? a : b; // the end inside the restriction
  }
  // intervals of the parameter where f > 0, over the sorted samples us: [[lo, hi, loOpen, hiOpen]] (open: reaches the
  // first / last sample)
  function intervals(f, us) {
    const out = [];
    const u0 = us[0], u1 = us[us.length - 1];
    let prevU = u0, prevIn = f(u0) > 0, start = prevIn ? u0 : null, startOpen = prevIn;
    for (let k = 1; k < us.length; k++) {
      const u = us[k], inn = f(u) > 0;
      if (inn !== prevIn) {
        const ub = bisectParam(f, inn ? u : prevU, inn ? prevU : u);
        if (inn) { start = ub; startOpen = false; } else { out.push([start, ub, startOpen, false]); start = null; }
      }
      prevU = u; prevIn = inn;
    }
    if (prevIn) out.push([start, u1, startOpen, true]);
    return out;
  }
  const sortedUnique = (a) => { a.sort((p, q) => p - q); return a.filter((v, k) => k === 0 || v !== a[k - 1]); };
  // the bounding box of a restriction's area, from what it is made of: Re z / Im z (and any axis-parallel half-plane)
  // bounds, k|αz + β| < c discs; 'and' intersects, 'or' takes the hull; anything else is the whole plane
  const BOX_ALL = () => ({ x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity });
  function restrictBox(n) {
    if (!n) return BOX_ALL();
    if (n.t === 'and') { const a = restrictBox(n.a), b = restrictBox(n.b); return { x0: Math.max(a.x0, b.x0), x1: Math.min(a.x1, b.x1), y0: Math.max(a.y0, b.y0), y1: Math.min(a.y1, b.y1) }; }
    if (n.t === 'or') { const a = restrictBox(n.a), b = restrictBox(n.b); return { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1) }; }
    if (n.t !== 'cmp' || n.op === '=') return BOX_ALL();
    const less = n.op === '<' || n.op === '<=', lo = less ? n.a : n.b, hi = less ? n.b : n.a;
    // a disc: k |E| < c
    if (isConst(hi)) {
      const v = cval(hi), ab = absSide(lo), af = ab && affineOf(ab.E);
      if (v && realC(v) && af && !CX.isZero(af.hol.alpha)) {
        const c = CX.neg(CX.div(af.hol.beta, af.hol.alpha)), r = v.re / ab.k / CX.abs(af.hol.alpha);
        return r >= 0 ? { x0: c.re - r, x1: c.re + r, y0: c.im - r, y1: c.im + r } : { x0: 1, x1: 0, y0: 1, y1: 0 };
      }
    }
    // a half-plane a x + b y + c > 0 with a or b = 0
    let L;
    try { L = Expr.compileLevel(n); } catch (e) { return BOX_ALL(); }
    const l0 = L(C(0, 0)), la = L(C(1, 0)) - l0, lb = L(C(0, 1)) - l0;
    if (![l0, la, lb].every(Number.isFinite)) return BOX_ALL();
    for (const p of PROBE) { const v = L(p); if (!(Math.abs(v - (l0 + la * p.re + lb * p.im)) <= 1e-12 * (Math.abs(v) + Math.abs(l0) + Math.abs(la * p.re) + Math.abs(lb * p.im)))) return BOX_ALL(); }
    const b = BOX_ALL();
    if (lb === 0 && la !== 0) { if (la > 0) b.x0 = -l0 / la; else b.x1 = -l0 / la; }
    else if (la === 0 && lb !== 0) { if (lb > 0) b.y0 = -l0 / lb; else b.y1 = -l0 / lb; }
    return b;
  }
  const boxFinite = (b) => [b.x0, b.x1, b.y0, b.y1].every(Number.isFinite) && b.x0 <= b.x1 && b.y0 <= b.y1;
  // restriction of exact shapes to R > 0: [{shape, ends}]. The parameter is scanned uniformly over the whole shape
  // (lines and rays through t = S u / (1 - |u|)) and densely where the shape passes through each of the boxes (the
  // restriction's own box, the view), so small restricted pieces far from the shape's anchor are found; ends by
  // bisection. ends: 'clip' where the restriction cuts, 'inf', 'stop' at an arg ray's apex.
  function clipShapes(shapes, R, boxes = []) {
    const out = [];
    // (a box bounded on one side only still bounds a line's parameter, and a circle's own box bounds the rest)
    const fin = boxes.filter((b) => b && b.x0 <= b.x1 && b.y0 <= b.y1 && [b.x0, b.x1, b.y0, b.y1].some(Number.isFinite));
    for (const s of shapes) {
      if (s.kind === 'point') { if (R(C(s.p[0], s.p[1])) >= 0) out.push({ shape: s, ends: null }); continue; }
      if (s.kind === 'circle') {
        const c = C(s.c[0], s.c[1]), at = (t) => C(c.re + s.r * Math.cos(t), c.im + s.r * Math.sin(t)), sc = s.r + CX.abs(c);
        const us = [];
        for (let k = 0; k <= 2048; k++) us.push(TAU * k / 2048);
        for (const b0 of fin) {
          const b = { x0: Math.max(b0.x0, c.re - s.r), x1: Math.min(b0.x1, c.re + s.r), y0: Math.max(b0.y0, c.im - s.r), y1: Math.min(b0.y1, c.im + s.r) };
          if (!boxFinite(b)) continue;
          const bx = (b.x0 + b.x1) / 2, by = (b.y0 + b.y1) / 2, bh = hyp(b.x1 - b.x0, b.y1 - b.y0) / 2, dc = hyp(bx - c.re, by - c.im);
          if (dc - bh > s.r || dc + bh < s.r) continue; // the circle misses the box
          const phi = Math.atan2(by - c.im, bx - c.re), w = dc > bh ? Math.min(Math.PI, 1.5 * Math.asin(Math.min(1, bh / dc)) + 1e-9) : Math.PI;
          for (let k = 0; k <= 1024; k++) { let t = phi - w + 2 * w * k / 1024; t = ((t % TAU) + TAU) % TAU; us.push(t); }
        }
        const iv = intervals((t) => R(at(t)), sortedUnique(us));
        if (iv.length === 1 && iv[0][2] && iv[0][3]) { out.push({ shape: s, ends: null }); continue; }
        // an interval through t = 0 wraps: join the last with the first
        if (iv.length > 1 && iv[0][2] && iv[iv.length - 1][3]) { const f = iv.shift(); iv[iv.length - 1][1] = f[1] + TAU; }
        for (const [t0, t1] of iv) if (t1 > t0) out.push({ shape: { kind: 'arc', a: pt(at(t0), sc), m: pt(at((t0 + t1) / 2), sc), b: pt(at(t1), sc) }, ends: ['clip', 'clip'] });
        continue;
      }
      // lines and rays: z(t) = a + t d (d unit), t = S u / (1 - |u|) over u in (-1, 1) (a ray: [0, 1))
      const a = C(s.a[0], s.a[1]), d0 = C(s.b[0] - s.a[0], s.b[1] - s.a[1]), L = CX.abs(d0), d = CX.scale(d0, 1 / L);
      const S = Math.max(1, CX.abs(a)), U = 1 - 2 ** -20;
      const tOf = (u) => (u === 0 ? 0 : S * u / (1 - Math.abs(u))), uOf = (t) => t / (S + Math.abs(t));
      const at = (t) => C(a.re + t * d.re, a.im + t * d.im);
      const ray = s.kind === 'ray', u0 = ray ? 0 : -U, n = ray ? 4096 : 8192;
      const us = [];
      for (let k = 0; k <= n; k++) us.push(u0 + (U - u0) * k / n);
      for (const b of fin) {
        // the t-interval of the line inside the box (slabs), widened by a tenth
        let t0 = -Infinity, t1 = Infinity;
        for (const [p, q, lo, hi] of [[a.re, d.re, b.x0, b.x1], [a.im, d.im, b.y0, b.y1]]) {
          if (q === 0) { if (p < lo || p > hi) { t0 = 1; t1 = 0; } continue; }
          const ta = (lo - p) / q, tb = (hi - p) / q;
          t0 = Math.max(t0, Math.min(ta, tb)); t1 = Math.min(t1, Math.max(ta, tb));
        }
        if (!(t1 >= t0) || !Number.isFinite(t0 + t1)) continue;
        const pad = 0.1 * (t1 - t0) + 1e-12 * (Math.abs(t0) + Math.abs(t1));
        for (let k = 0; k <= 1024; k++) { const u = uOf(t0 - pad + (t1 - t0 + 2 * pad) * k / 1024); if (u >= u0 && u <= U) us.push(u); }
      }
      const iv = intervals((u) => R(at(tOf(u))), sortedUnique(us));
      for (const [ua, ub, o0, o1] of iv) {
        const apex = ray && ua === 0, lo = !ray && o0, hi = o1;
        const sc = S + Math.abs(tOf(ua)) + Math.abs(tOf(ub));
        const z0 = pt(at(tOf(ua)), sc), z1 = pt(at(tOf(ub)), sc);
        const e0 = apex ? 'stop' : 'clip';
        if (lo && hi) out.push({ shape: { kind: 'line', a: s.a.slice(), b: s.b.slice() }, ends: ['inf', 'inf'] });
        else if (hi) out.push({ shape: { kind: 'ray', a: z0, b: [z0[0] + d.re, z0[1] + d.im] }, ends: [e0, 'inf'] });
        else if (lo) out.push({ shape: { kind: 'ray', a: z1, b: [z1[0] - d.re, z1[1] - d.im] }, ends: ['clip', 'inf'] });
        else if (ub > ua) out.push({ shape: { kind: 'segment', a: z0, b: z1 }, ends: [e0, 'clip'] });
      }
    }
    return out;
  }
  // the ends of an unrestricted exact shape
  const shapeEnds = (s) => (s.kind === 'line' ? ['inf', 'inf'] : s.kind === 'ray' ? ['stop', 'inf'] : s.kind === 'circle' || s.kind === 'point' ? null : ['stop', 'stop']);

  // ---------- one-dimensional root finding ----------
  // a sign change of f between s = a and s = b (fa, fb finite, opposite signs): Illinois steps with a bisection every
  // fourth step, down to adjacent doubles. null at a jump (a branch cut or a pole: |f| does not go to 0 at the end)
  // or when f is undefined inside the bracket.
  function root1(f, a, b, fa, fb) {
    const big = Math.max(Math.abs(fa), Math.abs(fb));
    let lo = a, hi = b, flo = fa, fhi = fb, tlo = fa, thi = fb, side = 0;
    const neg = fa < 0;
    for (let it = 0; it < 160; it++) {
      const mid = 0.5 * (lo + hi);
      if (mid === lo || mid === hi) break;
      let m = it % 4 === 3 ? mid : lo - flo * (hi - lo) / (fhi - flo);
      if (!(m > Math.min(lo, hi) && m < Math.max(lo, hi))) m = mid;
      const fm = f(m);
      if (Number.isNaN(fm)) return null;
      if (fm === 0) return m;
      if ((fm < 0) === neg) { lo = m; flo = tlo = fm; if (side === -1) fhi *= 0.5; side = -1; } else { hi = m; fhi = thi = fm; if (side === 1) flo *= 0.5; side = 1; }
    }
    if (!(Math.min(Math.abs(tlo), Math.abs(thi)) <= 1e-5 * big)) return null;
    return Math.abs(tlo) <= Math.abs(thi) ? lo : hi;
  }
  const SCAN = [0.01, 0.04, 0.12, 0.25, 0.45, 0.7, 1];
  // the root of g on the line (mx, my) + s (nx, ny), |s| <= L, nearest to s = 0 (scanning both sides outward), as
  // {x, y, s}, or null
  function project(g, mx, my, nx, ny, L, f0) {
    const f = (s) => g(mx + s * nx, my + s * ny);
    if (f0 === undefined) f0 = f(0);
    if (f0 === 0) return { x: mx, y: my, s: 0 };
    let sp = 0, fp = f0, sm = 0, fm = f0;
    for (const k of SCAN) {
      const s = k * L;
      for (const sg of [1, -1]) {
        const v = f(sg * s), ps = sg > 0 ? sp : sm, pv = sg > 0 ? fp : fm;
        if (Number.isFinite(v) && Number.isFinite(pv) && (v < 0) !== (pv < 0)) {
          const r = root1(f, ps, sg * s, pv, v);
          if (r !== null) return { x: mx + r * nx, y: my + r * ny, s: r };
        }
        if (sg > 0) { sp = sg * s; fp = v; } else { sm = sg * s; fm = v; }
      }
    }
    return null;
  }
  // a critical point of g near (x, y) (Newton on the gradient, 4-point stencils at d = h/100): {x, y, g, det, l1, l2}
  function critical(g, x, y, h) {
    const d = h * 1e-2, dH = h * 0.05;
    let it = 0;
    for (; it < 40; it++) {
      const fx1 = g(x + d, y), fx2 = g(x - d, y), fx3 = g(x + 2 * d, y), fx4 = g(x - 2 * d, y);
      const fy1 = g(x, y + d), fy2 = g(x, y - d), fy3 = g(x, y + 2 * d), fy4 = g(x, y - 2 * d);
      const gx = (8 * (fx1 - fx2) - (fx3 - fx4)) / (12 * d), gy = (8 * (fy1 - fy2) - (fy3 - fy4)) / (12 * d);
      const g0 = g(x, y);
      const hxx = (g(x + dH, y) - 2 * g0 + g(x - dH, y)) / (dH * dH), hyy = (g(x, y + dH) - 2 * g0 + g(x, y - dH)) / (dH * dH);
      const hxy = (g(x + dH, y + dH) - g(x + dH, y - dH) - g(x - dH, y + dH) + g(x - dH, y - dH)) / (4 * dH * dH);
      const det = hxx * hyy - hxy * hxy;
      if (!Number.isFinite(gx + gy + det) || det === 0) return null;
      let dx = -(hyy * gx - hxy * gy) / det, dy = -(-hxy * gx + hxx * gy) / det;
      const st = hyp(dx, dy);
      if (st > h) { dx *= h / st; dy *= h / st; }
      x += dx; y += dy;
      if (st <= 4 * EPS * (Math.abs(x) + Math.abs(y)) + 1e-300) break;
      if (it > 6 && st <= 1e-13 * h) break;
    }
    const g0 = g(x, y);
    const hxx = (g(x + dH, y) - 2 * g0 + g(x - dH, y)) / (dH * dH), hyy = (g(x, y + dH) - 2 * g0 + g(x, y - dH)) / (dH * dH);
    const hxy = (g(x + dH, y + dH) - g(x + dH, y - dH) - g(x - dH, y + dH) + g(x - dH, y - dH)) / (4 * dH * dH);
    const det = hxx * hyy - hxy * hxy, tr = hxx + hyy, q = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    if (!Number.isFinite(g0 + det)) return null;
    return { x, y, g: g0, det, l1: tr / 2 + q, l2: tr / 2 - q };
  }
  // is the critical point S on the curve (within float64's resolution of g, or within tol of it)?
  function onCurve(g, S) {
    if (!S) return false;
    const noise = 64 * EPS * g.mag(S.x, S.y);
    if (Math.abs(S.g) <= noise) return true;
    const tol = Math.max(2e-10 * hyp(S.x, S.y), 1e-13);
    // g ~ eta + (l1 u^2 + l2 v^2) / 2: the distance to the zero set along the eigen-direction of opposite sign
    const l = S.g > 0 ? Math.min(S.l1, S.l2) : Math.max(S.l1, S.l2);
    if (!((S.g > 0 && l < 0) || (S.g < 0 && l > 0))) return false;
    return Math.sqrt(2 * Math.abs(S.g / l)) <= tol;
  }

  // ---------- tracing g = 0 ----------
  // trace(g, win, o) -> [{pts: number[] (x0, y0, x1, y1, ...), closed, ends: [e0, e1]}], ends: 'inf' (reached the FAR
  // box), 'nan' (ran into points where g is undefined), 'stop' (ends there: a branch point, a domain edge, the tail
  // budget), null for a closed loop. Marching squares over the window grid (expandBox(win, o.margin = 1.5), o.res = 200
  // cells along its longer side), cells with undefined corners or jumps subdivided 4 x 4 (o.depth = 3 levels), saddle
  // cells resolved at their critical point; chained, densified to o.step (the window diagonal / 700, as
  // Region.sampleCurve), open ends on the grid's edge continued outward along the curve.
  function trace(g, win, o = {}) {
    const B0 = expandBox(win, o.margin ?? 1.5);
    const W = B0.x1 - B0.x0, H = B0.y1 - B0.y0;
    if (!(W > 0 && H > 0) || !Number.isFinite(W + H + B0.x0 + B0.y0)) return [];
    const res = o.res ?? 200, maxDepth = o.depth ?? 3;
    const nx = Math.max(8, Math.round(res * W / Math.max(W, H))), ny = Math.max(8, Math.round(res * H / Math.max(W, H)));
    const hx = W / nx, hy = H / ny, h = Math.max(hx, hy), diag = hyp(win.x1 - win.x0, win.y1 - win.y0);
    // the grid is shifted by an irrational part of a cell (one more cell each way covers the box), so that 0, the
    // axes and other round points are never grid vertices or lines (a curve through a vertex next to a branch point)
    const B = { x0: B0.x0 - 0.3183098861837907 * hx, y0: B0.y0 - 0.2365726246546911 * hy };
    B.x1 = B.x0 + (nx + 1) * hx; B.y1 = B.y0 + (ny + 1) * hy;
    const step = o.step ?? diag / 700;
    const budget = g.n + (o.maxEval ?? 4e6);
    // wall-clock budget (o.maxMs): evaluations are not the only cost (chaining thousands of fragments is not)
    const t0 = Date.now(), maxMs = o.maxMs ?? 4000;
    const info = { flat: 0, truncated: false, touch: null };
    let lateN = 0;
    const late = () => { if (info.truncated) return true; if (++lateN % 64 === 0 && Date.now() - t0 > maxMs) info.truncated = true; return info.truncated; };
    const over = () => g.n >= budget || late();
    // the unit tangent of the level curve through (x, y) (central differences at scale sc), or null
    function tangent(x, y, sc) {
      const d = Math.max(1e-6 * sc, 1e-9 * (Math.abs(x) + Math.abs(y)), 1e-300);
      const gx = g(x + d, y) - g(x - d, y), gy = g(x, y + d) - g(x, y - d), L = hyp(gx, gy);
      return L > 0 && Number.isFinite(L) ? [-gy / L, gx / L] : null;
    }
    // ---- points, welded within wtol ----
    const P = [];
    const wtol = 1e-7 * h, wq = 4 * wtol, buckets = new Map();
    function addPt(x, y) {
      const kx = Math.floor(x / wq), ky = Math.floor(y / wq);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const L = buckets.get((kx + a) + ',' + (ky + b));
        if (L) for (const id of L) if (Math.abs(P[2 * id] - x) <= wtol && Math.abs(P[2 * id + 1] - y) <= wtol) return id;
      }
      const id = P.length / 2;
      P.push(x, y);
      const key = kx + ',' + ky;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(id);
      return id;
    }
    const segs = [];
    const seg = (ids) => { if (ids[0] !== ids[ids.length - 1]) segs.push(ids); };
    // a cell's arc from crossing a to crossing b, into out: when the chord is far from the curve, or the curve leaves
    // a or b at a steep angle to the chord (the tip of a V where two branches cross near the cell's edge, even when
    // the crossing itself lies just outside this cell; a cusp), the critical point there becomes a vertex of the arc,
    // shared by the V's of the neighbouring cells (welded), so the crossing is chained straight through like an X.
    // Returns true when no such point is on the curve (two curves closer than a cell: near-tangency; a tight bend),
    // so that the cell and its neighbours are marched again on a finer grid.
    function arc(a, b, hc, out) {
      if (a === b) return false;
      const ax = P[2 * a], ay = P[2 * a + 1], bx = P[2 * b], by = P[2 * b + 1], dx = bx - ax, dy = by - ay, L = hyp(dx, dy);
      const mx = ax + dx / 2, my = ay + dy / 2;
      const r = L > 0 ? project(g, mx, my, -dy / L, dx / L, 0.6 * L) : null;
      // (a smooth arc sags about L^2 kappa / 8 from its chord, far below L / 10 at cell size, and meets its chord at
      // less than 60 degrees unless it turns by more than 120 degrees inside the cell)
      let steep = false;
      if (L > 0 && r && Math.abs(r.s) <= 0.1 * L && L > 0.05 * hc) {
        const ta = tangent(ax, ay, hc), tb = tangent(bx, by, hc), ux = dx / L, uy = dy / L;
        steep = !!(ta && tb) && Math.min(Math.abs(ta[0] * ux + ta[1] * uy), Math.abs(tb[0] * ux + tb[1] * uy)) < 0.5;
      }
      if (L > 0 && (!r || Math.abs(r.s) > 0.1 * L || steep)) {
        const sc = Math.max(L, hc), S = critical(g, mx, my, sc);
        if (S && hyp(S.x - mx, S.y - my) <= 2 * sc && onCurve(g, S)) { const sid = addPt(S.x, S.y); out.push([a, sid], [sid, b]); return false; }
        out.push([a, b]);
        return true;
      }
      out.push([a, b]);
      return false;
    }
    const NONE = -1, REJ = -3, UNK = -2;
    // ---- marching squares on a uniform grid of a rectangle; bad cells recurse ----
    function march(x0, y0, x1, y1, mx, my, depth) {
      const X = (i) => (i === mx ? x1 : x0 + (x1 - x0) * i / mx), Y = (j) => (j === my ? y1 : y0 + (y1 - y0) * j / my);
      const V = new Float64Array((mx + 1) * (my + 1)), M = new Float64Array((mx + 1) * (my + 1));
      for (let j = 0; j <= my; j++) for (let i = 0; i <= mx; i++) { const k = j * (mx + 1) + i; V[k] = g(X(i), Y(j)); M[k] = g.m; }
      if (depth === 0) top = { V, M, mx, my, X, Y };
      const vat = (i, j) => V[j * (mx + 1) + i];
      // a vertex where g is rounding noise of its terms: the two sides agree there (an area where they agree throughout
      // is not a curve: its cells are skipped)
      const flat = (i, j) => { const k = j * (mx + 1) + i; return Math.abs(V[k]) <= 64 * EPS * M[k]; };
      const hC = new Int32Array(mx * (my + 1)).fill(UNK), vC = new Int32Array((mx + 1) * my).fill(UNK);
      // crossing on the edge from corner (i, j) along +x (horiz) or +y
      function cross(i, j, horiz) {
        const cache = horiz ? hC : vC, idx = horiz ? j * mx + i : j * (mx + 1) + i;
        if (cache[idx] !== UNK) return cache[idx];
        const i2 = horiz ? i + 1 : i, j2 = horiz ? j : j + 1;
        const va = vat(i, j), vb = vat(i2, j2);
        let r = NONE;
        if ((va >= 0) !== (vb >= 0) && !(flat(i, j) && flat(i2, j2))) {
          if (va === 0) r = addPt(X(i), Y(j));
          else if (vb === 0) r = addPt(X(i2), Y(j2));
          else if (horiz) { const y = Y(j), s = root1((x) => g(x, y), X(i), X(i2), va, vb); r = s === null ? REJ : addPt(s, y); }
          else { const x = X(i), s = root1((y) => g(x, y), Y(j), Y(j2), va, vb); r = s === null ? REJ : addPt(x, s); }
        }
        cache[idx] = r;
        return r;
      }
      // the cells' arcs (kept per cell until the suspect cells are marched again), suspect and recursed cells
      const cellSegs = new Array(mx * my), suspect = new Uint8Array(mx * my), sub = new Uint8Array(mx * my);
      for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) {
        if (late()) break;
        const v = [vat(i, j), vat(i + 1, j), vat(i + 1, j + 1), vat(i, j + 1)];
        const cx0 = X(i), cx1 = X(i + 1), cy0 = Y(j), cy1 = Y(j + 1), hc = Math.max(cx1 - cx0, cy1 - cy0), ci = j * mx + i;
        const out = cellSegs[ci] = [];
        if (flat(i, j) && flat(i + 1, j) && flat(i + 1, j + 1) && flat(i, j + 1)) { info.flat++; continue; }
        let bad = v.some(Number.isNaN);
        let e = null;
        if (!bad) {
          e = [cross(i, j, true), cross(i + 1, j, false), cross(i, j + 1, true), cross(i, j, false)];
          bad = e.includes(REJ);
        }
        if (bad) {
          // (a jump across the whole cell with no crossing of the curve on its edges: nothing to look for)
          const jumpOnly = e && !e.some((q) => q >= 0);
          if (depth < maxDepth && !over() && v.some(Number.isFinite) && !jumpOnly) { sub[ci] = 1; march(cx0, cy0, cx1, cy1, 4, 4, depth + 1); }
          else if (e) { const ok = e.filter((q) => q >= 0); if (ok.length === 2) arc(ok[0], ok[1], hc, out); }
          continue;
        }
        const ok = e.filter((q) => q >= 0);
        if (ok.length === 2) { if (arc(ok[0], ok[1], hc, out)) suspect[ci] = 1; continue; }
        if (ok.length !== 4) continue;
        // a saddle cell: its critical point decides between a crossing X and two separate arcs
        const S = critical(g, (cx0 + cx1) / 2, (cy0 + cy1) / 2, hc);
        const inside = S && S.x >= cx0 - 0.25 * hc && S.x <= cx1 + 0.25 * hc && S.y >= cy0 - 0.25 * hc && S.y <= cy1 + 0.25 * hc;
        if (inside && S.det < 0 && onCurve(g, S)) {
          const s = addPt(S.x, S.y);
          out.push([e[0], s, e[2]], [e[1], s, e[3]]);
          continue;
        }
        let cv = inside ? S.g : g((cx0 + cx1) / 2, (cy0 + cy1) / 2);
        if (Number.isNaN(cv)) cv = g((cx0 + cx1) / 2, (cy0 + cy1) / 2);
        // two arcs closer than a tenth of the cell: marched again finer
        if (inside && S.det < 0) { const l = Math.abs(S.g > 0 ? Math.min(S.l1, S.l2) : Math.max(S.l1, S.l2)); if (Math.sqrt(2 * Math.abs(S.g) / l) < 0.1 * hc) suspect[ci] = 1; }
        // the centre on the side of corners 0 and 2: they connect, the curve cuts off corners 1 and 3
        if ((cv >= 0) === (v[0] >= 0)) out.push([e[0], e[1]], [e[2], e[3]]); else out.push([e[3], e[0]], [e[1], e[2]]);
      }
      // suspect cells and their neighbours: marched again on a 4 x 4 grid (their arcs replaced); the region grows across
      // every edge on which the finer grid finds more crossings than this one did (two curves closer than a cell pass
      // between this grid's vertices unseen)
      if (depth < maxDepth && !over()) {
        const queue = [];
        for (let j = 0; j < my; j++) for (let i = 0; i < mx; i++) {
          if (!suspect[j * mx + i]) continue;
          for (let b = Math.max(0, j - 1); b <= Math.min(my - 1, j + 1); b++) for (let a = Math.max(0, i - 1); a <= Math.min(mx - 1, i + 1); a++) queue.push(b * mx + a);
        }
        const done = new Uint8Array(mx * my);
        let n = 0;
        while (queue.length && n < 4096 && !over()) {
          const ci = queue.pop();
          if (done[ci] || sub[ci]) continue;
          done[ci] = 1; n++;
          cellSegs[ci] = null;
          const i = ci % mx, j = (ci - i) / mx, x0c = X(i), x1c = X(i + 1), y0c = Y(j), y1c = Y(j + 1);
          const before = segs.length;
          march(x0c, y0c, x1c, y1c, 4, 4, depth + 1);
          const cnt = [0, 0, 0, 0];
          for (let k = before; k < segs.length; k++) for (const id of [segs[k][0], segs[k][segs[k].length - 1]]) {
            const x = P[2 * id], y = P[2 * id + 1];
            if (y === y0c) cnt[0]++; if (x === x1c) cnt[1]++; if (y === y1c) cnt[2]++; if (x === x0c) cnt[3]++;
          }
          const had = [cross(i, j, true), cross(i + 1, j, false), cross(i, j + 1, true), cross(i, j, false)].map((q) => (q >= 0 ? 1 : 0));
          const nb = [j > 0 ? ci - mx : -1, i < mx - 1 ? ci + 1 : -1, j < my - 1 ? ci + mx : -1, i > 0 ? ci - 1 : -1];
          for (let k = 0; k < 4; k++) if (cnt[k] > had[k] && nb[k] >= 0 && !done[nb[k]]) queue.push(nb[k]);
        }
      }
      for (const L of cellSegs) if (L) for (const s of L) seg(s);
    }
    let top = null;
    march(B.x0, B.y0, B.x1, B.y1, nx + 1, ny + 1, 0);
    // ---- chaining: pair the segment ends at every point (straightest pairs first at a crossing) ----
    const inc = new Map();
    segs.forEach((s, k) => {
      for (const end of [0, 1]) { const id = end ? s[s.length - 1] : s[0]; if (!inc.has(id)) inc.set(id, []); inc.get(id).push(2 * k + end); }
    });
    const partner = new Int32Array(2 * segs.length).fill(-1);
    const nbr = (he) => { const s = segs[he >> 1]; return he & 1 ? s[s.length - 2] : s[1]; };
    for (const [id, L] of inc) {
      if (L.length === 2) { partner[L[0]] = L[1]; partner[L[1]] = L[0]; continue; }
      if (L.length < 2) continue;
      const ang = L.map((he) => { const q = nbr(he); return Math.atan2(P[2 * q + 1] - P[2 * id + 1], P[2 * q] - P[2 * id]); });
      const pairs = [];
      for (let a = 0; a < L.length; a++) for (let b = a + 1; b < L.length; b++) {
        let d = Math.abs(ang[a] - ang[b]) % TAU;
        if (d > Math.PI) d = TAU - d;
        pairs.push([Math.PI - d, a, b]);
      }
      pairs.sort((p, q) => p[0] - q[0]);
      const used = new Set();
      for (const [, a, b] of pairs) if (!used.has(a) && !used.has(b)) { used.add(a); used.add(b); partner[L[a]] = L[b]; partner[L[b]] = L[a]; }
    }
    const seen = new Uint8Array(segs.length);
    const chains = [];
    function walk(he0) {
      const ids = [];
      let he = he0;
      for (;;) {
        const k = he >> 1, s = segs[k];
        seen[k] = 1;
        const seq = he & 1 ? s.slice().reverse() : s;
        for (let q = ids.length ? 1 : 0; q < seq.length; q++) ids.push(seq[q]);
        const far = he ^ 1, p = partner[far];
        if (p < 0) return { ids, closed: false };
        if (p === he0) return { ids, closed: true };
        if (seen[p >> 1]) return { ids, closed: false };
        he = p;
      }
    }
    for (let he = 0; he < 2 * segs.length; he++) if (!seen[he >> 1] && partner[he] < 0) chains.push(walk(he));
    for (let k = 0; k < segs.length; k++) if (!seen[k]) chains.push(walk(2 * k));
    // ---- densify: chord points projected onto the curve; a chord far from the curve gets its critical point, and
    // one with no such point is not part of the curve: the chain is cut there (its ends may be joined below) ----
    const polys = [];
    for (const c of chains) {
      const ids = c.ids, parts = [];
      let out = [P[2 * ids[0]], P[2 * ids[0] + 1]];
      for (let q = 1; q < ids.length; q++) {
        const ax = P[2 * ids[q - 1]], ay = P[2 * ids[q - 1] + 1], bx = P[2 * ids[q]], by = P[2 * ids[q] + 1];
        if (densify(ax, ay, bx, by, out) === false) { parts.push(out); out = [bx, by]; continue; }
        out.push(bx, by);
      }
      parts.push(out);
      if (parts.length === 1) { polys.push({ pts: out, closed: c.closed }); continue; }
      // a cut loop: its last part runs on into its first
      if (c.closed) { const last = parts.pop(); for (let q = 2; q < parts[0].length; q++) last.push(parts[0][q]); parts[0] = last; }
      for (const pp of parts) if (pp.length >= 4) polys.push({ pts: pp, closed: false });
    }
    function densify(ax, ay, bx, by, out, depth = 0) {
      const dx = bx - ax, dy = by - ay, L = hyp(dx, dy);
      if (!(L > 0) || over()) return;
      const n = Math.max(1, Math.ceil(L / step)), nx_ = -dy / L, ny_ = dx / L;
      const add = [];
      let bad = false;
      // a chord whose ends lie on two different curves (that pass closer than a cell, or touch): the curve leaves both
      // ends steeply to it. (Skipped where the gradient is small: at a crossing or a tangency point.)
      {
        const d = Math.max(1e-6 * L, 1e-9 * (Math.abs(ax) + Math.abs(ay) + Math.abs(bx) + Math.abs(by)));
        const grad = (x, y) => [g(x + d, y) - g(x - d, y), g(x, y + d) - g(x, y - d)];
        const ga = grad(ax, ay), gb = grad(bx, by), la = hyp(ga[0], ga[1]), lb = hyp(gb[0], gb[1]);
        if (la > 0.05 * lb && lb > 0.05 * la && Number.isFinite(la + lb)) {
          const ca = Math.abs(ga[1] * dx - ga[0] * dy) / (la * L), cb = Math.abs(gb[1] * dx - gb[0] * dy) / (lb * L);
          if (Math.max(ca, cb) < 0.64 && L > 0.5 * step) bad = true;
        }
      }
      for (let k = 1; !bad && k <= (n > 1 ? n - 1 : 1); k++) {
        const t = n > 1 ? k / n : 0.5;
        const r = project(g, ax + t * dx, ay + t * dy, nx_, ny_, 0.6 * L);
        if (!r || Math.abs(r.s) > (n > 1 ? 0.3 : 0.1) * L) { bad = true; break; }
        if (n > 1 || Math.abs(r.s) > 0.02 * L) add.push(r.x, r.y);
      }
      if (bad) {
        // a sharp corner inside the chord: the tip of a V (two branches crossing on a grid line) or a cusp
        const S = critical(g, ax + dx / 2, ay + dy / 2, L);
        // (S at an end of the chord is no corner inside it: a tangency point that the chord leaves along the other
        // curve)
        const inner = S && Math.min(hyp(S.x - ax, S.y - ay), hyp(S.x - bx, S.y - by)) > 1e-3 * L;
        if (inner && hyp(S.x - (ax + bx) / 2, S.y - (ay + by) / 2) <= L && onCurve(g, S)) {
          // (both halves densified in turn: a corner at a tangency of two curves is not a cell-long chord)
          if (depth >= 3) { out.push(S.x, S.y); return; }
          if (densify(ax, ay, S.x, S.y, out, depth + 1) === false) return false;
          out.push(S.x, S.y);
          return densify(S.x, S.y, bx, by, out, depth + 1);
        }
        // (a chord between two curves that touch or pass closer than a cell: not drawn)
        return L > 0.5 * step ? false : undefined;
      }
      for (let q = 0; q < add.length; q++) out.push(add[q]);
    }
    // ---- tails: open ends on the grid's edge continue outward along the curve ----
    const onEdge = (x, y) => x === B.x0 || x === B.x1 || y === B.y0 || y === B.y1;
    const inB = (x, y) => x > B.x0 && x < B.x1 && y > B.y0 && y < B.y1;
    const FB = expandBox(win, FAR), cxw = (win.x0 + win.x1) / 2, cyw = (win.y0 + win.y1) / 2;
    const outFar = (x, y) => !(x > FB.x0 && x < FB.x1 && y > FB.y0 && y < FB.y1);
    const COS_TURN = Math.cos(0.15), COS_TAN = Math.cos(0.25), maxTail = o.maxTail ?? 4000;
    // predictor-corrector along the curve from the end (x, y), heading (dx, dy): predicted along the tangent, corrected
    // onto the curve across it; a step is kept when it turns less than 0.15 rad and the tangent where it lands agrees
    // with the chord (a step across a crossing X that lands on the other branch does not). On failure the step is
    // first lengthened (to step over a crossing), then halved. Spacing grows to 3.5% of the distance from the window.
    // inner: {near(x, y, sig, dx, dy) -> an open end to join | null, sigMax, steps}: a run inside the grid between two
    // ends left apart (curves closer than the finest cells), joined when it reaches the other end
    function tail(x, y, dx, dy, inner = null) {
      const pts = [];
      let sig = inner ? inner.sigMax / 4 : Math.min(h, step * 4), nanStop = false;
      const TRY = [1, 2, 4, 0.5, 0.25, 0.125, 0.0625, 1 / 32, 1 / 64, 1 / 128, 1 / 512, 1 / 2048, 1 / 8192];
      for (let it = 0; it < (inner ? inner.steps : maxTail) && !over(); it++) {
        let t0 = tangent(x, y, sig);
        if (t0 && t0[0] * dx + t0[1] * dy < 0) t0 = [-t0[0], -t0[1]];
        const [px, py] = t0 && t0[0] * dx + t0[1] * dy >= COS_TAN ? t0 : [dx, dy];
        let done = false;
        for (const f of TRY) {
          const sg = sig * f, qx = x + sg * px, qy = y + sg * py;
          const r = project(g, qx, qy, -py, px, 0.5 * sg);
          if (!r) { if (Number.isNaN(g(qx, qy))) nanStop = true; continue; }
          const ex = r.x - x, ey = r.y - y, el = hyp(ex, ey);
          if (!(el > 0) || (ex * dx + ey * dy) / el < COS_TURN || Math.abs(r.s) > 0.35 * sg) continue;
          const t1 = tangent(r.x, r.y, sg);
          if (t1 && Math.abs(t1[0] * ex + t1[1] * ey) / el < COS_TAN) continue;
          pts.push(r.x, r.y);
          dx = ex / el; dy = ey / el; x = r.x; y = r.y;
          if (inner) {
            const F = inner.near(x, y, sg, dx, dy);
            if (F) return { pts, end: 'join', F };
            if (!inB(x, y)) return { pts, end: 'stop' };
            sig = Math.min(sg * 1.25, inner.sigMax);
            done = true;
            break;
          }
          if (outFar(x, y)) return { pts, end: 'inf' };
          if (inB(x, y)) return { pts, end: 'reenter' };
          sig = Math.min(sg * 1.25, Math.max(h, 0.035 * hyp(x - cxw, y - cyw)));
          nanStop = false; done = true;
          break;
        }
        if (!done) return { pts, end: nanStop ? 'nan' : 'stop' };
      }
      return { pts, end: 'stop' };
    }
    const open = [];
    const outDir = (x, y, px, py) => { const dx = x - px, dy = y - py, l = hyp(dx, dy); return l > 0 ? [dx / l, dy / l] : null; };
    polys.forEach((p, k) => {
      if (p.closed) return;
      const n = p.pts.length / 2;
      for (const e of [0, 1]) {
        const i = e ? n - 1 : 0, j = e ? n - 2 : 1;
        const x = p.pts[2 * i], y = p.pts[2 * i + 1];
        open.push({ key: 2 * k + e, x, y, edge: n >= 2 && onEdge(x, y), px: p.pts[2 * j], py: p.pts[2 * j + 1], dir: outDir(x, y, p.pts[2 * j], p.pts[2 * j + 1]) });
      }
    });
    const links = new Map(); // end key -> {to, path} | {end, path}
    // the open ends inside the grid, hashed by coarse cell (the joins below look within a cell: no O(n^2) pairing
    // when an input produces thousands of fragments)
    const hash = new Map(), hkey = (x, y) => Math.floor((x - B.x0) / h) + ',' + Math.floor((y - B.y0) / h);
    for (const E of open) if (!E.edge) { const k = hkey(E.x, E.y); if (!hash.has(k)) hash.set(k, []); hash.get(k).push(E); }
    const nearby = (x, y, f) => {
      const kx = Math.floor((x - B.x0) / h), ky = Math.floor((y - B.y0) / h);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const L = hash.get((kx + a) + ',' + (ky + b));
        if (L) for (const F of L) if (!links.has(F.key)) f(F);
      }
    };
    // a removable gap: two ends inside the grid a few finest cells apart, facing each other across an isolated point
    // where g is undefined (Im(1/z) = 1 at 0 when 0 is a grid vertex) are joined
    const gap = 4.5 * h / 4 ** maxDepth, COS_GAP = Math.cos(0.5);
    for (const E of open) {
      if (E.edge || links.has(E.key) || !E.dir) continue;
      if (late()) break;
      const dE = E.dir;
      let best = null, bd = Infinity;
      nearby(E.x, E.y, (F) => {
        if (F === E || !F.dir) return;
        const vx = F.x - E.x, vy = F.y - E.y, d = hyp(vx, vy), dF = F.dir;
        if (!(d > 0 && d <= gap) || d >= bd) return;
        if ((dE[0] * vx + dE[1] * vy) / d >= COS_GAP && -(dF[0] * vx + dF[1] * vy) / d >= COS_GAP) { best = F; bd = d; }
      });
      if (best) { links.set(E.key, { to: best.key, path: [] }); links.set(best.key, { to: E.key, path: [] }); }
    }
    // ends still apart inside the grid (two curves closer than the finest cells, where the grid saw neither; a cut
    // chord): followed along the curve in small steps until the run reaches an end that faces it
    const link = (E, F, path) => {
      links.set(E.key, { to: F.key, path });
      const rev = [];
      for (let q = path.length - 2; q >= 0; q -= 2) rev.push(path[q], path[q + 1]);
      links.set(F.key, { to: E.key, path: rev });
    };
    for (const E of open) {
      if (E.edge || links.has(E.key) || !E.dir || over()) continue;
      const dE = E.dir;
      const near = (x, y, sg, dx, dy) => {
        let hit = null;
        nearby(x, y, (F) => {
          if (hit || F === E) return;
          const dF = F.dir;
          if (dF && hyp(F.x - x, F.y - y) <= 1.5 * sg && dF[0] * dx + dF[1] * dy < -0.5) hit = F;
        });
        return hit;
      };
      const T = tail(E.x, E.y, dE[0], dE[1], { near, sigMax: h / 4, steps: 600 });
      if (T.end === 'join') link(E, T.F, T.pts.slice(0, T.pts.length - 2));
    }
    const edgeEnds = open.filter((E) => E.edge);
    for (const E of open) {
      if (links.has(E.key)) continue;
      if (!E.edge || !(o.tails ?? true) || late()) { links.set(E.key, { end: 'stop', path: [] }); continue; }
      const dx0 = E.x - E.px, dy0 = E.y - E.py, l0 = hyp(dx0, dy0);
      if (!(l0 > 0)) { links.set(E.key, { end: 'stop', path: [] }); continue; }
      const T = tail(E.x, E.y, dx0 / l0, dy0 / l0);
      if (T.end !== 'reenter') { links.set(E.key, { end: T.end, path: T.pts }); continue; }
      // re-entered the grid: join the nearest free open end on the edge
      const n = T.pts.length / 2, rx = T.pts[2 * n - 2], ry = T.pts[2 * n - 1];
      let best = null, bd = Infinity;
      for (const F of edgeEnds) {
        if (F.key === E.key || links.has(F.key)) continue;
        const d = hyp(F.x - rx, F.y - ry);
        if (d < bd) { bd = d; best = F; }
      }
      const lastStep = n >= 2 ? hyp(rx - T.pts[2 * n - 4], ry - T.pts[2 * n - 3]) : hyp(rx - E.x, ry - E.y);
      if (best && bd <= 2 * lastStep + 2 * h) {
        link(E, best, T.pts.slice(0, 2 * n - 2));
      } else links.set(E.key, { end: 'stop', path: T.pts.slice(0, 2 * n - 2) });
    }
    // ---- assemble: polylines joined through their tails ----
    const out = [];
    const done = new Uint8Array(polys.length);
    const append = (dst, src, from = 0) => { for (let q = from; q < src.length; q += 2) { const L = dst.length; if (L && dst[L - 2] === src[q] && dst[L - 1] === src[q + 1]) continue; dst.push(src[q], src[q + 1]); } };
    const forward = (k, e) => { const p = polys[k].pts; if (!e) return p; const r = []; for (let q = p.length - 2; q >= 0; q -= 2) r.push(p[q], p[q + 1]); return r; };
    function run(k0, e0, startEnd, cycle = false) {
      // from end e0 of poly k0 (a terminal, its tail first; or any end of a cycle of links), forward through the links
      const pts = [];
      const st = links.get(2 * k0 + e0);
      if (!cycle && st) for (let q = st.path.length - 2; q >= 0; q -= 2) pts.push(st.path[q], st.path[q + 1]);
      let k = k0, e = e0;
      for (let guard = 0; guard <= polys.length; guard++) {
        done[k] = 1;
        append(pts, forward(k, e));
        const far = links.get(2 * k + (1 - e));
        if (!far) return { pts, closed: false, ends: [startEnd, 'stop'] };
        append(pts, far.path);
        if (far.end) return { pts, closed: false, ends: [startEnd, far.end] };
        k = far.to >> 1; e = far.to & 1;
        if (k === k0 && e === e0) return { pts, closed: true, ends: null };
        if (done[k]) return { pts, closed: false, ends: [startEnd, 'stop'] };
      }
      return { pts, closed: false, ends: [startEnd, 'stop'] };
    }
    polys.forEach((p, k) => {
      if (done[k] || p.closed) return;
      for (const e of [0, 1]) {
        const I = links.get(2 * k + e);
        if (I && I.end && !done[k]) out.push(run(k, e, I.end));
      }
    });
    polys.forEach((p, k) => {
      if (done[k]) return;
      if (p.closed) { done[k] = 1; out.push({ pts: p.pts.slice(), closed: true, ends: null }); return; }
      // a cycle of links (a large loop leaving the grid and coming back)
      const r = run(k, 0, 'stop', true);
      if (r.closed) { const n = r.pts.length; if (r.pts[0] !== r.pts[n - 2] || r.pts[1] !== r.pts[n - 1]) r.pts.push(r.pts[0], r.pts[1]); }
      out.push(r);
    });
    // closed loops: counterclockwise, first point repeated at the end (a figure eight through a saddle of g stays one
    // loop for drawing; its signed area is rounding noise, so loops() splits it into simple loops for integrals)
    for (const c of out) {
      if (!c.closed) continue;
      const p = c.pts, n = p.length / 2;
      if (p[0] !== p[2 * n - 2] || p[1] !== p[2 * n - 1]) p.push(p[0], p[1]);
      if (signedArea(p) < 0) reversePts(p);
    }
    const result = /** @type {any[] & { info?: any }} */ (out.filter((c) => c.pts.length >= 4));
    // nothing crosses zero: is g touched instead (the sides meet without crossing)? Newton on the gradient from the
    // grid's smallest local minima of |g| / |terms|
    if (!result.length && top && !over()) {
      const { V, M: Mg, mx, my, X, Y } = top, cand = [];
      for (let j = 1; j < my; j++) for (let i = 1; i < mx; i++) {
        const k = j * (mx + 1) + i, v = Math.abs(V[k]);
        if (!Number.isFinite(v)) continue;
        if ([k - 1, k + 1, k - mx - 1, k + mx + 1].every((q) => !(Math.abs(V[q]) < v))) cand.push([v / (Mg[k] || 1), i, j]);
      }
      cand.sort((p, q) => p[0] - q[0]);
      for (const [, i, j] of cand.slice(0, 24)) {
        const S = critical(g, X(i), Y(j), h);
        if (S && hyp(S.x - X(i), S.y - Y(j)) <= 2 * h && Math.abs(S.g) <= 64 * EPS * g.mag(S.x, S.y)) { info.touch = [S.x, S.y]; break; }
      }
    }
    result.info = info;
    return result;
  }
  function signedArea(p) {
    let s = 0;
    for (let q = 0; q + 3 < p.length; q += 2) s += p[q] * p[q + 3] - p[q + 2] * p[q + 1];
    return s / 2;
  }
  function reversePts(p) {
    const n = p.length / 2;
    for (let a = 0, b = n - 1; a < b; a++, b--) {
      const x = p[2 * a], y = p[2 * a + 1];
      p[2 * a] = p[2 * b]; p[2 * a + 1] = p[2 * b + 1]; p[2 * b] = x; p[2 * b + 1] = y;
    }
  }
  // restriction of a traced polyline to R > 0; the cut points are on the curve and on R = 0 (bisection along the
  // chord, each trial point projected onto the curve). A sample where R only touches 0 between two samples inside
  // (arg(z^2) = π/2 is Im(-i z^2) = 0 where Re(-i z^2) > 0: 2xy touches 0 at the origin) stays inside; pieces shorter
  // than minLen are dropped.
  function clipTraced(c, R, g, minLen = 0) {
    const p = c.pts, n = p.length / 2;
    const r = new Float64Array(n);
    for (let i = 0; i < n; i++) r[i] = R(C(p[2 * i], p[2 * i + 1]));
    // (and, the other way round, a sample where R touches 0 from above between two samples outside, such as the
    // crossing of the other diagonal there, stays outside)
    const touch = [];
    for (let i = 0; i < n; i++) {
      const a = i > 0 ? i - 1 : c.closed ? n - 2 : -1, b = i < n - 1 ? i + 1 : c.closed ? 1 : -1;
      if (a < 0 || b < 0) continue;
      const s = Math.abs(r[a]) + Math.abs(r[b]);
      if (!(r[i] > 0) && r[a] > 0 && r[b] > 0 && r[i] >= -1e-12 * s) touch.push([i, Number.MIN_VALUE]);
      if (r[i] > 0 && !(r[a] > 0) && !(r[b] > 0) && r[i] <= 1e-12 * s) touch.push([i, 0]);
    }
    for (const [i, v] of touch) r[i] = v;
    let all = true, none = true;
    for (let i = 0; i < n; i++) { if (r[i] > 0) none = false; else all = false; }
    if (all) return [c];
    if (none) return [];
    // (the search across the chord reaches half the distance to its nearer end: near a crossing X at an end, other
    // branches are further than that)
    const onC = (ax, ay, bx, by, t) => {
      const dx = bx - ax, dy = by - ay, L = hyp(dx, dy), mx = ax + t * dx, my = ay + t * dy;
      const q = L > 0 ? project(g, mx, my, -dy / L, dx / L, 0.5 * L * Math.max(Math.min(t, 1 - t), 1e-9)) : null;
      return q && Math.abs(q.s) <= 0.3 * L ? q : { x: mx, y: my };
    };
    const cut = (i, j) => {
      const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * j], by = p[2 * j + 1];
      let lo = 0, hi = 1;
      const inLo = r[i] > 0;
      for (let it = 0; it < 64; it++) {
        const m = 0.5 * (lo + hi);
        if (m === lo || m === hi) break;
        const q = onC(ax, ay, bx, by, m);
        if ((R(C(q.x, q.y)) > 0) === inLo) lo = m; else hi = m;
      }
      return onC(ax, ay, bx, by, inLo ? lo : hi);
    };
    // a closed loop starts at a point outside, so no piece wraps around
    let idx = [...Array(n).keys()];
    if (c.closed) { const s = r.findIndex((v) => !(v > 0)); idx = [...Array(n - 1).keys()].map((q) => (q + s) % (n - 1)); idx.push(s); }
    const out = [];
    let cur = null, curStart = null;
    for (let q = 0; q < idx.length; q++) {
      const i = idx[q], inn = r[i] > 0;
      if (q > 0) {
        const i0 = idx[q - 1], was = r[i0] > 0;
        if (was !== inn) {
          // the chord from point i0 to point i (consecutive along the polyline; across the closing point of a loop)
          const Q = cut(i0, i);
          if (was) { cur.push(Q.x, Q.y); out.push({ pts: cur, closed: false, ends: [curStart, 'clip'] }); cur = null; }
          else { cur = [Q.x, Q.y]; curStart = 'clip'; }
        }
      }
      if (inn) {
        if (!cur) { cur = []; curStart = q === 0 && !c.closed ? (c.ends ? c.ends[0] : 'stop') : 'clip'; }
        cur.push(p[2 * i], p[2 * i + 1]);
      }
    }
    if (cur) out.push({ pts: cur, closed: false, ends: [curStart, c.closed ? 'clip' : (c.ends ? c.ends[1] : 'stop')] });
    const len = (q) => { let L = 0; for (let k = 2; k < q.length; k += 2) L += hyp(q[k] - q[k - 2], q[k + 1] - q[k - 1]); return L; };
    return out.filter((s) => s.pts.length >= 4 && (!(minLen > 0) || len(s.pts) >= minLen));
  }
  // the isolated zeros of a complex function E in (a margin around) the window: Newton on (Re E, Im E) from the local
  // minima of |E| on an N x N grid, kept where |E| is at its rounding level. out.incomplete: some zeros may be missing
  // (two found zeros closer than 3 grid cells: they crowd beyond the grid, as 1/(k pi) of sin(1/z) at 0; or fewer
  // zeros inside the box than the winding number of E around it, after a finer second grid)
  function zerosIn(E, win) {
    let out = zerosGrid(E, win, 128);
    const B = expandBox(win, 1.2), wn = windingIn(E, B, 1024);
    const inside = (z) => z.re > B.x0 && z.re < B.x1 && z.im > B.y0 && z.im < B.y1;
    if (wn !== null && out.filter(inside).length < wn) {
      const fine = zerosGrid(E, win, 384);
      if (fine.length > out.length) out = fine;
      if (out.filter(inside).length < wn) out.incomplete = true;
    }
    return out;
  }
  // the winding number of E around the box (zeros minus poles inside), or null when a step's phase change is not
  // resolved (above pi/2) or E is not finite and non-zero on the boundary
  function windingIn(E, B, n) {
    const pts = [];
    for (let k = 0; k < n; k++) pts.push([B.x0 + (B.x1 - B.x0) * k / n, B.y0]);
    for (let k = 0; k < n; k++) pts.push([B.x1, B.y0 + (B.y1 - B.y0) * k / n]);
    for (let k = 0; k < n; k++) pts.push([B.x1 - (B.x1 - B.x0) * k / n, B.y1]);
    for (let k = 0; k < n; k++) pts.push([B.x0, B.y1 - (B.y1 - B.y0) * k / n]);
    let tot = 0, prev = null;
    for (let k = 0; k <= pts.length; k++) {
      const [x, y] = pts[k % pts.length], v = E(C(x, y));
      if (!CX.isFin(v) || (v.re === 0 && v.im === 0)) return null;
      const a = Math.atan2(v.im, v.re);
      if (prev !== null) {
        let d = a - prev;
        d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
        if (Math.abs(d) > Math.PI / 2) return null;
        tot += d;
      }
      prev = a;
    }
    return Math.round(tot / (2 * Math.PI));
  }
  function zerosGrid(E, win, N) {
    const B = expandBox(win, 1.2), hx = (B.x1 - B.x0) / N, hy = (B.y1 - B.y0) / N;
    const F = (x, y) => E(C(x, y));
    const A = new Float64Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const v = CX.abs(F(B.x0 + i * hx, B.y0 + j * hy)); A[j * (N + 1) + i] = Number.isFinite(v) ? v : Infinity; }
    const cand = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const k = j * (N + 1) + i, v = A[k];
      if (!Number.isFinite(v)) continue;
      let min = true, big = 0;
      for (let b = -1; b <= 1 && min; b++) for (let a = -1; a <= 1; a++) {
        if ((!a && !b) || i + a < 0 || i + a > N || j + b < 0 || j + b > N) continue;
        const w = A[(j + b) * (N + 1) + i + a];
        if (w < v) { min = false; break; }
        if (Number.isFinite(w)) big = Math.max(big, w);
      }
      if (min) cand.push([v, i, j, big]);
    }
    cand.sort((p, q) => p[0] - q[0]);
    const out = /** @type {ZeroPoleList} */ ([]), hh = Math.max(hx, hy);
    for (const [, i, j, big] of cand.slice(0, 600)) {
      let x = B.x0 + i * hx, y = B.y0 + j * hy, ok = false;
      for (let it = 0; it < 80; it++) {
        const v = F(x, y), d = Math.max(1e-7 * hh, 1e-9 * (Math.abs(x) + Math.abs(y)));
        if (!CX.isFin(v)) break;
        if (v.re === 0 && v.im === 0) { ok = true; break; }
        const vx = F(x + d, y), vy = F(x, y + d);
        const a = (vx.re - v.re) / d, b = (vy.re - v.re) / d, c = (vx.im - v.im) / d, e = (vy.im - v.im) / d, det = a * e - b * c;
        if (!(Math.abs(det) > 0) || !Number.isFinite(det)) break;
        let dx = -(e * v.re - b * v.im) / det, dy = -(-c * v.re + a * v.im) / det;
        const st = hyp(dx, dy);
        if (st > 2 * hh) { dx *= 2 * hh / st; dy *= 2 * hh / st; }
        x += dx; y += dy;
        if (st <= 4 * EPS * (Math.abs(x) + Math.abs(y)) + 1e-300) { ok = true; break; }
      }
      if (!ok) continue;
      const v = CX.abs(F(x, y));
      if (!(v <= 1e-9 * (big || 1)) || !(x >= B.x0 && x <= B.x1 && y >= B.y0 && y <= B.y1)) continue;
      if (out.some((q) => hyp(q.re - x, q.im - y) <= 1e-9 * (hh + Math.abs(x) + Math.abs(y)))) continue;
      if (out.some((q) => hyp(q.re - x, q.im - y) < 3 * hh)) out.incomplete = true;
      out.push(C(snap(x, Math.abs(x) + Math.abs(y)), snap(y, Math.abs(x) + Math.abs(y))));
    }
    return out;
  }

  // a closed polyline (flat [x, y, ...], first point repeated) that crosses itself, as simple closed loops: split at
  // a crossing of two non-adjacent segments or at a repeated vertex, recursively (depth-bounded). Segments are bucketed
  // on a 64 x 64 grid over the loop's box, so a long loop costs about n, not n^2.
  function splitLoop(p, depth) {
    const n = p.length / 2 - 1;
    if (n < 6 || depth > 8) return [p];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i <= n; i++) { const x = p[2 * i], y = p[2 * i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const G = 64, cw = (x1 - x0) / G || 1, ch = (y1 - y0) / G || 1, cell = new Map();
    const cx = (x) => Math.min(G - 1, Math.max(0, Math.floor((x - x0) / cw))), cy = (y) => Math.min(G - 1, Math.max(0, Math.floor((y - y0) / ch)));
    const cut = (A, B) => [...splitLoop(A, depth + 1), ...splitLoop(B, depth + 1)];
    const seq = (a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(p[2 * i], p[2 * i + 1]); return o; };
    // a repeated vertex (not the closing one): two loops through it
    const seen = new Map();
    for (let i = 0; i < n; i++) {
      const key = p[2 * i] + ',' + p[2 * i + 1], j = seen.get(key);
      if (j !== undefined && i - j >= 3 && !(j === 0 && i === n)) return cut(seq(j, i), [...seq(i, n), ...seq(1, j)]);
      if (j === undefined) seen.set(key, i);
    }
    const orient = (ax, ay, bx, by, qx, qy) => (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
    for (let i = 0; i < n; i++) {
      const ax = p[2 * i], ay = p[2 * i + 1], bx = p[2 * i + 2], by = p[2 * i + 3];
      const i0 = cx(Math.min(ax, bx)), i1 = cx(Math.max(ax, bx)), j0 = cy(Math.min(ay, by)), j1 = cy(Math.max(ay, by));
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 256) continue;
      const near = new Set();
      for (let u = i0; u <= i1; u++) for (let v = j0; v <= j1; v++) { const l = cell.get(u * G + v); if (l) for (const q of l) near.add(q); }
      for (const j of near) {
        if (i - j < 2 || (j === 0 && i === n - 1)) continue;
        const cxa = p[2 * j], cya = p[2 * j + 1], dxa = p[2 * j + 2], dya = p[2 * j + 3];
        const d1 = orient(cxa, cya, dxa, dya, ax, ay), d2 = orient(cxa, cya, dxa, dya, bx, by);
        const d3 = orient(ax, ay, bx, by, cxa, cya), d4 = orient(ax, ay, bx, by, dxa, dya);
        if (!(d1 * d2 < 0 && d3 * d4 < 0)) continue;
        const t = d1 / (d1 - d2), X = [ax + t * (bx - ax), ay + t * (by - ay)];
        // segments j and i cross at X: the loops X, j+1 .. i, X and X, i+1 .. n, 1 .. j, X
        return cut([...X, ...seq(j + 1, i), ...X], [...X, ...seq(i + 1, n), ...seq(1, j), ...X]);
      }
      for (let u = i0; u <= i1; u++) for (let v = j0; v <= j1; v++) { const k = u * G + v; let l = cell.get(k); if (!l) cell.set(k, (l = [])); l.push(i); }
    }
    return [p];
  }

  // ---------- descriptions ----------
  class CurveError extends Expr.ParseError {}
  // Curves.dimOf(src | ast) -> {dim: 'area' | 'curve' | 'none' | 'error', error?}: never throws (a syntax error is
  // {dim: 'error', error, pos})
  function dimOf(input) {
    try {
      const ast = typeof input === 'string' ? Expr.parse(input, { allowRel: true }) : input;
      const c = Expr.classifyRelation(ast);
      return c.error ? { dim: c.dim, error: c.error } : { dim: c.dim };
    } catch (e) { return { dim: 'error', error: e.message, pos: e.pos }; }
  }
  function fromFormula(input, opts = {}) {
    const src = typeof input === 'string' ? input : null;
    const ast = src !== null ? Expr.parse(src, { allowRel: true }) : input;
    const cls = Expr.classifyRelation(ast);
    if (cls.dim !== 'curve') {
      const e = /** @type {any} */ (new CurveError(cls.dim === 'area' ? $t('This formula is an area (it has no equation): add it as a region') : cls.error, 0));
      e.dim = cls.dim;
      throw e;
    }
    const notes = new Set();
    const pieces = [];
    cls.pieces.forEach((pc0, k0) => {
      for (const nf of normalize(pc0, notes)) {
        const index = pieces.length;
        const R = nf.restrict ? Expr.compileLevel(nf.restrict) : null;
        const rbox = restrictBox(nf.restrict);
        const pc = { eq: pc0.eq, restrict: pc0.restrict, real: nf.real, form: nf.eq, formRestrict: nf.restrict, kind: nf.kind, R, rbox, exact: null, rec: null, tex: Expr.toTex(pc0.eq).s, index, of: k0, exCache: new Map() };
        if (nf.dir) pc.dir = nf.dir;
        if (nf.kind === 'zeros') {
          pc.Ef = Expr.compile(nf.E);
          pc.g = Object.assign(() => NaN, { n: 0 });
          pieces.push(pc);
          continue;
        }
        pc.g = evaluator(nf.eq, nf.real, nf.dir);
        const rec = opts.exact === false ? null : nf.real === 'complex' ? recognizeComplex(nf.eq, nf.dir) : recognize(nf.eq);
        if (rec) {
          pc.rec = rec;
          const items = R ? clipShapes(rec.shapes, R, [rbox]) : rec.shapes.map((sh) => ({ shape: sh, ends: shapeEnds(sh) }));
          pc.exact = items.map((it) => it.shape);
          pc.exactEnds = items.map((it) => it.ends);
          if (rec.note) notes.add(rec.note);
          if (R && rec.shapes.length && !items.length) notes.add($t('No point of the curve satisfies the restriction.'));
        }
        pieces.push(pc);
      }
    });
    const desc = { kind: 'curves', src, ast, tex: Expr.toTex(ast).s, pieces, exact: pieces.every((p) => !!p.exact), notes: [...notes], cache: new Map() };
    if (opts.win) traceDesc(desc, opts.win, opts);
    return desc;
  }
  // the shapes of the exact pieces
  const shapesOf = (desc) => desc.pieces.flatMap((p) => p.exact || []);
  const winKey = (win, o) => [win.x0, win.x1, win.y0, win.y1, o.res, o.margin, o.depth, o.step, o.maxTail, o.maxEval, o.maxMs, o.tails].join(',');
  // a restricted exact piece clipped again for the window (the dense parameter scan also covers the view): [{shape,
  // ends}]; null for a traced piece
  function exactFor(pc, win) {
    if (!pc.exact) return null;
    if (!pc.R) return pc.exact.map((sh, k) => ({ shape: sh, ends: pc.exactEnds[k] }));
    const key = [win.x0, win.x1, win.y0, win.y1].join(',');
    if (!pc.exCache.has(key)) {
      if (pc.exCache.size > 8) pc.exCache.clear();
      pc.exCache.set(key, clipShapes(pc.rec.shapes, pc.R, [pc.rbox, expandBox(win, 3)]));
    }
    return pc.exCache.get(key);
  }
  // an exact circle or arc sampled with fixed angular steps (Region.sampleCurve) is too coarse in a window much smaller
  // than its radius: chords near the window get points on the circle in between, down to the window diagonal / 700
  function refineRound(pts, s, win) {
    let c, r;
    if (s.kind === 'circle') { c = C(s.c[0], s.c[1]); r = s.r; } else {
      // the circle through a, m, b
      const [ax, ay] = s.a, [mx, my] = s.m, [bx, by] = s.b, d = 2 * (ax * (my - by) + mx * (by - ay) + bx * (ay - my));
      if (!(Math.abs(d) > 0)) return pts;
      const a2 = ax * ax + ay * ay, m2 = mx * mx + my * my, b2 = bx * bx + by * by;
      c = C((a2 * (my - by) + m2 * (by - ay) + b2 * (ay - my)) / d, (a2 * (bx - mx) + m2 * (ax - bx) + b2 * (mx - ax)) / d);
      r = hyp(ax - c.re, ay - c.im);
    }
    const step = hyp(win.x1 - win.x0, win.y1 - win.y0) / 700, E = expandBox(win, 2);
    const near = (x0, y0, x1, y1) => Math.max(x0, x1) >= E.x0 && Math.min(x0, x1) <= E.x1 && Math.max(y0, y1) >= E.y0 && Math.min(y0, y1) <= E.y1;
    let any = false;
    const out = [pts[0], pts[1]];
    for (let i = 2; i < pts.length; i += 2) {
      const x0 = pts[i - 2], y0 = pts[i - 1], x1 = pts[i], y1 = pts[i + 1], L = hyp(x1 - x0, y1 - y0);
      if (L > 2 * step && near(x0, y0, x1, y1)) {
        const t0 = Math.atan2(y0 - c.im, x0 - c.re);
        let dt = Math.atan2(y1 - c.im, x1 - c.re) - t0;
        if (dt > Math.PI) dt -= TAU; else if (dt < -Math.PI) dt += TAU;
        const n = Math.min(Math.ceil(L / step), 4096);
        for (let k = 1; k < n; k++) { const t = t0 + dt * k / n; out.push(c.re + r * Math.cos(t), c.im + r * Math.sin(t)); }
        any = true;
      }
      out.push(x1, y1);
    }
    return any ? new Float64Array(out) : pts;
  }
  const TRACE_NOTES = {
    flat: $t('The two sides agree on a whole region here; a region is not a curve, so it is left out.'),
    truncated: $t('The curve is too complicated to trace completely here: parts of it may be missing.'),
    someZeros: $t('Only some of the zeros are shown: here they crowd together (they pile up at a point) more closely than the view can separate, or there are more than could be found.'),
    touch: $t('The two sides only touch (they meet without crossing), so this equation cannot be traced: write it so that the sides cross, e.g. Re z = 0 rather than (Re z)^2 = 0.'),
  };
  // Curves.trace(desc, win, o) -> {polys: [{pts: Float64Array, closed, ends, piece, exact, shape?}], points: [{p, piece}],
  // notes: [string] (about this window's trace)} (cached on desc per window and options)
  function traceDesc(desc, win, o = {}) {
    const key = winKey(win, o);
    if (desc.cache.has(key)) return desc.cache.get(key);
    const polys = [], points = [], notes = new Set();
    const RGN = RG();
    const minLen = 1e-6 * hyp(win.x1 - win.x0, win.y1 - win.y0);
    for (const pc of desc.pieces) {
      if (pc.kind === 'zeros') {
        const zs = zerosIn(pc.Ef, win);
        if (zs.incomplete) notes.add(TRACE_NOTES.someZeros);
        for (const z of zs) if (!pc.R || pc.R(z) >= 0) points.push({ p: z, piece: pc.index });
        continue;
      }
      const ex = exactFor(pc, win);
      if (ex) {
        for (const { shape: s, ends } of ex) {
          if (s.kind === 'point') { points.push({ p: C(s.p[0], s.p[1]), piece: pc.index }); continue; }
          if (!RGN) throw new Error('Curves: Region is needed to sample exact shapes');
          for (const c of RGN.curvesOf(s, win)) {
            let pts = RGN.sampleCurve(c, win);
            if (s.kind === 'circle' || s.kind === 'arc') pts = refineRound(pts, s, win);
            if (pts.length < 4) continue;
            const closed = s.kind === 'circle';
            // a closed polyline repeats its first point exactly
            if (closed) { const m = pts.length; if (hyp(pts[m - 2] - pts[0], pts[m - 1] - pts[1]) <= 1e-9 * (s.r + hyp(pts[0], pts[1]))) { pts[m - 2] = pts[0]; pts[m - 1] = pts[1]; } }
            polys.push({ pts, closed, ends: closed ? null : ends, piece: pc.index, exact: true, shape: s });
          }
        }
        continue;
      }
      let cs = trace(pc.g, win, o);
      const info = cs.info;
      if (info.flat) notes.add(TRACE_NOTES.flat);
      if (info.truncated) notes.add(TRACE_NOTES.truncated);
      if (info.touch && !cs.length) notes.add(TRACE_NOTES.touch);
      // a complex equation: the part of Re(D conj c) = 0 where Im(D conj c) vanishes too
      let R = pc.R;
      if (pc.real === 'complex') {
        const g = pc.g, R0 = pc.R;
        R = (z) => { const f = 1e-7 * g.mag(z.re, z.im) - Math.abs(g.h(z.re, z.im)); return R0 ? Math.min(R0(z), f) : f; };
      }
      if (R) cs = cs.flatMap((c) => clipTraced(c, R, pc.g, pc.real === 'complex' ? 1e3 * minLen : minLen));
      for (const c of cs) polys.push({ pts: new Float64Array(c.pts), closed: c.closed, ends: c.ends, piece: pc.index, exact: false });
    }
    const r = { polys, points, notes: [...notes] };
    if (desc.cache.size > 8) desc.cache.clear();
    desc.cache.set(key, r);
    return r;
  }
  // Curves.sample(desc, win, o) -> [Float64Array] (as Region.sampleCurve; each with .closed, .ends, .inf = [bool, bool])
  function sample(desc, win, o) {
    return traceDesc(desc, win, o).polys.map((c) => Object.assign(c.pts, { closed: c.closed, ends: c.ends, inf: c.ends ? c.ends.map((e) => e === 'inf') : [false, false], piece: c.piece }));
  }
  // Curves.curvesOf(desc, win, o) -> Region curve objects ({f, n0, closed, ...}: Region.mapCurve, hitTest, the globe):
  // the exact shapes' own curves (Region.curvesOf, o.reach as there), the traced polylines as Region.polyCurve (with
  // c.traced, c.ends; with o.reach === 'sphere' an end that reaches the FAR box carries outer / openSides / cell, so
  // Lines.refine continues it as a ray toward infinity, as it does for formula contours)
  function curvesOf(desc, win, o) {
    const RGN = RG();
    const out = [];
    for (const pc of desc.pieces) {
      const ex = exactFor(pc, win);
      if (ex) for (const { shape: s } of ex) if (s.kind !== 'point') out.push(...RGN.curvesOf(s, win, o));
    }
    for (const c of traceDesc(desc, win, o).polys) {
      if (c.exact) continue;
      const n = c.pts.length / 2 - (c.closed ? 1 : 0), zs = [];
      for (let i = 0; i < n; i++) zs.push(C(c.pts[2 * i], c.pts[2 * i + 1]));
      const pc = RGN.polyCurve(zs, c.closed);
      if (!pc) continue;
      Object.assign(pc, { traced: true, ends: c.ends, piece: c.piece });
      if (o && o.reach === 'sphere' && c.ends && c.ends.includes('inf')) {
        const fb = expandBox(win, FAR), m = c.pts.length;
        const last = c.ends[1] === 'inf' ? hyp(c.pts[m - 2] - c.pts[m - 4], c.pts[m - 1] - c.pts[m - 3]) : 0;
        const first = c.ends[0] === 'inf' ? hyp(c.pts[2] - c.pts[0], c.pts[3] - c.pts[1]) : 0;
        Object.assign(pc, { outer: fb, openSides: { x0: true, x1: true, y0: true, y1: true }, cell: Math.max(first, last) });
      }
      out.push(pc);
    }
    return out;
  }
  // closed loops for integrals: simple and counterclockwise, first point repeated: [{pts: Float64Array, area, piece}].
  // A loop that crosses itself (the figure eight |z^2 - 1| = 1) is split at its crossings into simple loops, each
  // counterclockwise, so an integral around it does not depend on the trace window (Curves.simpleLoops)
  function simpleLoops(pts) {
    const parts = splitLoop(Array.from(pts), 0).filter((q) => q.length >= 8);
    for (const q of parts) if (signedArea(q) < 0) reversePts(q);
    return parts.map((q) => Float64Array.from(q));
  }
  function loops(desc, win, o) {
    const out = [];
    for (const c of traceDesc(desc, win, o).polys) if (c.closed) for (const q of simpleLoops(c.pts)) out.push({ pts: q, area: signedArea(q), piece: c.piece });
    return out;
  }
  // every component is a closed loop (the curve bounds: integrals around it make sense)
  function isClosed(desc, win, o) {
    const t = traceDesc(desc, win, o);
    return t.polys.length > 0 && t.polys.every((c) => c.closed);
  }
  return { fromFormula, dimOf, trace: traceDesc, sample, curvesOf, loops, simpleLoops, isClosed, shapesOf, traceImplicit: trace, recognize, evaluator, stripTouch, normalize, clipShapes, restrictBox, zerosIn, project, critical, root1, CurveError, FAR };
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Region } from './region.js';
export { Curves, Curves as 'module.exports' };
