// @ts-check
'use strict';
// Derivatives (f′ of one step as a custom formula on the same branch) and the polynomial algebra they and the natural
// paths use: moved out of funcs.js (issue #20, the file-size budget), which takes these names back at the top of its
// closure (const { ... } = Derivs). build and fmtDeg are funcs.js's own: it hands them over once, Derivs.init.
const Derivs = (() => {
  const { C } = CX;
  const DEG = Math.PI / 180;
  const PI = Math.PI;
  const XN = Expr.N;
  const texOf = (ast) => Expr.toTex(Expr.simplify(ast)).s;
  /** @type {any} */
  let build = null;
  /** @type {any} */
  let fmtDeg = null;
  const init = (o) => { build = o.build; fmtDeg = o.fmtDeg; };

  // Taylor coefficients of p (highest degree first) at c, t[j] = p^(j)(c)/j!, each with a rounding bound e[j]
  function taylorAt(p, c) {
    const t = [], e = [];
    let a = p.slice(), b = p.map(CX.abs);
    const rc = CX.abs(c), u = 4 * (p.length + 1) * Number.EPSILON;
    for (let j = 0; j < p.length; j++) {
      let r = C(0, 0), rb = 0;
      const qa = [], qb = [];
      for (let i = 0; i < a.length; i++) { r = CX.add(CX.mul(r, c), a[i]); rb = rb * rc + b[i]; qa.push(r); qb.push(rb); }
      t.push(qa.pop()); e.push(u * (j + 1) * qb.pop());
      a = qa; b = qb;
    }
    return { t, e };
  }

  // ---- derivatives: f′ of one step as a custom formula on the same branch ----
  const snap = (v) => C(Math.abs(v.re) < 1e-15 ? 0 : v.re, Math.abs(v.im) < 1e-15 ? 0 : v.im);
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  // e^{2πik/n} exactly: ±1, ±i, or e^{\frac{2\pi i}{3}} written out
  function unitRootAst(k, n) {
    const g = gcd(2 * k, n), p = ((2 * k / g) % (2 * n / g) + 2 * n / g) % (2 * n / g), q = n / g;
    if (q === 1) return XN.real(p % 2 ? -1 : 1);
    if (q === 2) return p % 4 === 1 ? XN.num(C(0, 1)) : XN.num(C(0, -1));
    const PI_ = { t: 'num', v: C(Math.PI, 0), name: 'pi' }, I_ = { t: 'num', v: C(0, 1), name: 'i' }, E_ = { t: 'num', v: C(Math.E, 0), name: 'e' };
    return XN.pow(E_, XN.div(XN.mul(XN.mul(XN.real(p), PI_), I_), XN.real(q)));
  }
  // coefficient arrays, highest degree first
  const polyDer = (co) => co.slice(0, -1).map((c, i) => CX.scale(c, co.length - 1 - i));
  function polyMul(a, b) {
    const r = Array.from({ length: a.length + b.length - 1 }, () => C(0, 0));
    a.forEach((x, i) => b.forEach((y, j) => { r[i + j] = CX.add(r[i + j], CX.mul(x, y)); }));
    return r;
  }
  function polySub(a, b) {
    const n = Math.max(a.length, b.length);
    const pad = (x) => [...Array(n - x.length).fill(C(0, 0)), ...x];
    const A = pad(a), B = pad(b);
    return A.map((x, i) => CX.sub(x, B[i]));
  }
  // P/Q (coefficients, highest degree first) of a rational expression tree in z, or null when it is not one
  // (only constants, z, + − × ÷ and integer powers; degrees up to 60)
  function ratOf(ast) {
    const add = (a, b) => { const n = Math.max(a.length, b.length), pad = (x) => [...Array(n - x.length).fill(C(0, 0)), ...x]; const A = pad(a), B = pad(b); return A.map((x, i) => CX.add(x, B[i])); };
    const go = (n) => {
      if (!Expr.depends(n)) { const v = Expr.compile(n)(C(0, 0)); if (!CX.isFin(v)) throw new Error('nonfinite'); return [[v], [C(1, 0)]]; }
      switch (n.t) {
        case 'var': if (n.n !== 'z') throw new Error('var'); return [[C(1, 0), C(0, 0)], [C(1, 0)]];
        case 'neg': { const [P, Q] = go(n.a); return [P.map(CX.neg), Q]; }
        case 'add': case 'sub': {
          const [P1, Q1] = go(n.a), [P2, Q2] = go(n.b);
          const a = polyMul(P1, Q2), b = polyMul(P2, Q1);
          return [n.t === 'add' ? add(a, b) : polySub(a, b), polyMul(Q1, Q2)];
        }
        case 'mul': { const [P1, Q1] = go(n.a), [P2, Q2] = go(n.b); return [polyMul(P1, P2), polyMul(Q1, Q2)]; }
        case 'div': { const [P1, Q1] = go(n.a), [P2, Q2] = go(n.b); return [polyMul(P1, Q2), polyMul(Q1, P2)]; }
        case 'pow': {
          if (Expr.depends(n.b)) throw new Error('pow');
          const e = Expr.compile(n.b)(C(0, 0));
          if (e.im !== 0 || !Number.isInteger(e.re) || Math.abs(e.re) > 30) throw new Error('pow');
          let [P, Q] = go(n.a);
          if (e.re < 0) [P, Q] = [Q, P];
          let rp = [C(1, 0)], rq = [C(1, 0)];
          for (let i = 0; i < Math.abs(e.re); i++) { rp = polyMul(rp, P); rq = polyMul(rq, Q); }
          return [rp, rq];
        }
        default: throw new Error('not rational');
      }
    };
    try {
      let [P, Q] = go(ast);
      P = CX.polyTrim(P); Q = CX.polyTrim(Q);
      if (P.length > 61 || Q.length > 61 || CX.isZero(Q[0])) return null;
      return [P, Q];
    } catch (e) { return null; }
  }
  function polyAst(co) {
    co = CX.polyTrim(co.length ? co : [C(0, 0)]);
    const n = co.length - 1;
    let s = null;
    co.forEach((c, i) => {
      const k = n - i;
      if (CX.isZero(c)) return;
      const t = k === 0 ? XN.num(c) : XN.mul(XN.num(c), k === 1 ? XN.z() : XN.pow(XN.z(), XN.real(k)));
      s = s ? XN.add(s, t) : t;
    });
    return s || XN.real(0);
  }
  // Funcs.derivativeStep(step) -> {step: {type: 'custom', params: {expr, cut}}, note} or {error}
  function derivativeStep(step) {
    const b = build(step);
    if (b.error) return { error: b.error };
    const d = derivAst(b);
    if (d.error) return { error: d.error };
    try {
      const expr = texOf(d.ast);
      const nb = build({ type: 'custom', params: { expr, cut: d.cut } });
      if (nb.error) return { error: $t('The derivative could not be built: {msg}', { msg: nb.error }) };
      return { step: { type: 'custom', params: { expr, cut: d.cut } }, note: $t('Derivative of “{label}”{extra}', { label: b.def.label, extra: d.extra }) };
    } catch (e) {
      return { error: e.message };
    }
  }
  // f′ of one built step as an expression tree in z (the step's input) with the cut angle (degrees) that its branch
  // nodes use: {ast, cut, extra} or {error}. The tree keeps exact numbers (no TeX round trip). opts.stable: a form
  // that evaluates without cancellation where the readable one cancels (for evaluation, not for display).
  function derivAst(b, opts = {}) {
    if (!b || b.error || !b.def) return { error: b && b.error ? b.error : $t('No step') };
    if (b.op === 'deriv') return { error: $t('d/dz is an operator on the chain, not a map of w; add a second d/dz for the second derivative') };
    if (b.repeat) return { error: $t('A repeat has no derivative formula here; d/dz after it is computed numerically') };
    const v = b.vals, id = b.def.id;
    const { z, num, real, neg, add, sub, mul, div, pow, call, root } = XN;
    const sq = (a) => pow(a, real(2));
    const one = () => real(1);
    let ast, cut = 180, extra = '';
    try {
      switch (id) {
        case 'mul': ast = num(v.c); break;
        case 'add': ast = one(); break;
        case 'affine': ast = num(v.a); break;
        case 'recip': ast = neg(div(one(), sq(z()))); break;
        case 'mobius': {
          const det = CX.sub(CX.mul(v.a, v.d), CX.mul(v.b, v.c));
          ast = CX.isZero(v.c) ? num(CX.div(v.a, v.d)) : div(num(det), sq(add(mul(num(v.c), z()), num(v.d))));
          break;
        }
        case 'blaschke': {
          const e = snap(C(Math.cos(v.phi * DEG), Math.sin(v.phi * DEG)));
          const k = snap(CX.scale(e, 1 - CX.abs2(v.a)));
          ast = div(num(k), sq(sub(one(), mul(num(CX.conj(v.a)), z()))));
          break;
        }
        case 'pown': ast = mul(real(v.n), pow(z(), real(v.n - 1))); break;
        case 'root': {
          const n = Math.max(2, v.n);
          ast = div(mul(unitRootAst(v.k, n), n === 2 ? call('sqrt', z()) : root(real(n), z())), mul(real(n), z()));
          cut = v.cut; extra = $t('; same cut ({cut}°) and sheet {k}', { cut: fmtDeg(v.cut), k: v.k });
          break;
        }
        case 'powa': {
          // α z^{α−1} on sheet k: α e^{2πikα} times z^{α−1} on sheet 0 of the same cut
          const al = v.alpha;
          let turn = CX.exp(CX.scale(CX.mul(C(0, 2 * PI), al), v.k));
          if (al.im === 0) {
            // e^{2πi t} with t = kα mod 1, exact at quarter turns
            const t = (((v.k * al.re) % 1) + 1) % 1;
            turn = Number.isInteger(4 * t) ? [C(1, 0), C(0, 1), C(-1, 0), C(0, -1)][4 * t] : C(Math.cos(2 * PI * t), Math.sin(2 * PI * t));
          }
          const factor = v.k ? num(CX.mul(al, turn)) : num(al);
          const e1 = CX.sub(al, C(1, 0));
          const ex = Number.isInteger(e1.re) && e1.im === 0 ? real(e1.re) : CX.numExact(e1.re).length <= 10 && CX.numExact(e1.im).length <= 10 ? num(e1) : sub(num(al), one());
          ast = mul(factor, pow(z(), ex));
          cut = v.cut; extra = $t('; same cut ({cut}°) and sheet {k}', { cut: fmtDeg(v.cut), k: v.k });
          break;
        }
        case 'exp': ast = call('exp', z()); break;
        case 'log': ast = div(one(), z()); extra = $t('; the same on every sheet'); break;
        case 'sin': ast = call('cos', z()); break;
        case 'cos': ast = neg(call('sin', z())); break;
        case 'tan': ast = div(one(), sq(call('cos', z()))); break;
        case 'sinh': ast = call('cosh', z()); break;
        case 'cosh': ast = call('sinh', z()); break;
        case 'tanh': ast = div(one(), sq(call('cosh', z()))); break;
        case 'arcsin': case 'arccos': {
          const r = div(one(), call('sqrt', sub(one(), sq(z()))));
          ast = id === 'arcsin' ? r : neg(r);
          extra = $t('; principal branch, like the original');
          break;
        }
        case 'arctan': ast = div(one(), add(one(), sq(z()))); break;
        case 'arsinh': ast = div(one(), call('sqrt', add(sq(z()), one()))); extra = $t('; principal branch, like the original'); break;
        case 'arcosh': ast = div(one(), mul(call('sqrt', sub(z(), one())), call('sqrt', add(z(), one())))); extra = $t('; principal branch, like the original'); break;
        case 'artanh': ast = div(one(), sub(one(), sq(z()))); break;
        case 'joukowski': ast = sub(div(one(), real(2)), div(one(), mul(real(2), sq(z())))); break;
        case 'gamma': ast = mul(call('gamma', z()), call('digamma', z())); break;   // Γ′ = Γ ψ
        case 'zeta': ast = call('zetad', z()); break;
        case 'ijouk': {
          const s = () => mul(call('sqrt', sub(z(), one())), call('sqrt', add(z(), one())));
          const t = div(z(), s());
          // interior: 1 − z/s cancels for large |z| (it is ~1/(2z²)); since (z − s)(z + s) = 1 it equals −1/((z + s) s)
          if (v.branch === 'interior' && opts.stable) ast = neg(div(one(), mul(add(z(), s()), s())));
          else ast = v.branch === 'interior' ? sub(one(), t) : add(one(), t);
          extra = $t('; same branch as the original');
          break;
        }
        case 'conj': return { error: $t('Conjugation z̄ is not holomorphic, so it has no complex derivative') };
        // ([issue #260] Φ′ is not a formula of the language: d/dz after Φ_M or φ_c uses the circle formula)
        case 'dh': case 'bottcher': return { error: $t('Φ has no derivative formula here; d/dz after it is computed numerically') };
        case 'poly': ast = polyAst(polyDer(CX.polyTrim(v.co))); break;
        case 'rational': {
          const p = CX.polyTrim(v.p), q = CX.polyTrim(v.q);
          if (q.length === 1) ast = polyAst(polyDer(p).map((c) => CX.div(c, q[0])));
          else ast = div(polyAst(polySub(polyMul(polyDer(p), q), polyMul(p, polyDer(q)))), sq(polyAst(q)));
          break;
        }
        case 'zp': {
          const { P, Q } = b.zp;
          if (Q.length === 1) ast = polyAst(polyDer(P));
          else ast = div(polyAst(CX.polyTrim(polySub(polyMul(polyDer(P), Q), polyMul(P, polyDer(Q))))), sq(polyAst(Q)));
          break;
        }
        // ([issue #5] a series step: its formula, term by term)
        case 'series': ast = Expr.diff(b.ast); cut = 180; break;
        // ([issue #6] a recurrence: the derivative of the formula it writes out, when it is short enough)
        case 'recurrence': ast = Expr.diff(b.ast, { theta: v.cut * DEG }); cut = v.cut; break;
        case 'custom': {
          cut = v.cut;
          const src = Expr.parse(v.expr);
          // a rational formula is differentiated on its expanded numerator and denominator: (P′Q − PQ′)/Q²,
          // which reads 2i/(z+i)² for (z−i)/(z+i) instead of an unsimplified quotient rule
          const cls = Expr.classify(src), pq = cls.rational && !cls.branch ? ratOf(src) : null;
          if (pq) {
            const [P, Q] = pq;
            if (Q.length === 1) ast = polyAst(polyDer(P).map((c) => CX.div(c, Q[0])));
            else {
              const N = CX.polyTrim(polySub(polyMul(polyDer(P), Q), polyMul(P, polyDer(Q))));
              ast = div(polyAst(N), sq(polyAst(Q)));
            }
          } else ast = Expr.diff(src, { theta: cut * DEG });
          if (b.usesCut) extra = $t('; same cut ({cut}°) as the original', { cut: fmtDeg(cut) });
          break;
        }
        default: return { error: $t('No derivative is known for {label}', { label: b.def.label }) };
      }
      return { ast, cut, extra };
    } catch (e) {
      return { error: e.message };
    }
  }
  return { init, XN, texOf, taylorAt, polyMul, ratOf, derivAst, derivativeStep };
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
export { Derivs };
