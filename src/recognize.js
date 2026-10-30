'use strict';
// Formula recognition (notes/formula-recognition/DESIGN.md): a custom formula F, as a parsed tree, read as a chain of
// catalog steps h_n ∘ … ∘ h_1 that IS the formula: the same composition of the same functions, with every log, root and
// non-integer power on the formula's cut θ (sheet 0) and the inverse trigonometric and hyperbolic functions on their
// principal cuts, exactly as Expr.compile evaluates them. Nothing is rewritten through an identity that moves a cut
// (√(z²) stays √ of z², log(e^z) stays log of e^z); the only identities used are those of entire functions and of
// rational functions (exact normal form, Inverse.rationalForm, refused when a removable point would be filled in), and
// log(1+u) − log(1−u) = 2 artanh u, which is the very formula CX.atanh evaluates (θ = 180° only).
//
// Recognize.chain(ast, cutDeg, opts) -> {steps: [{type, vals}], groups: [{from, to, src}], partial, tape} | null
//   steps: catalog steps in forward order, with evaluated parameter values (Funcs.buildVals builds them without parsing);
//   a part with no catalog reading is {type: 'custom', vals: {ast}} (the subtree as a function of its own input).
//   groups: consecutive steps [from, to) that together are one piece of the formula as written; src is that piece as a
//   function of the group's input (var z). Expr.compile(src) replays the formula's own arithmetic, signed zeros and
//   overflow included, so the CPU values at the end of every group are the formula's bit for bit (review math-1..3).
//   A step whose input is the value of a subtree of the formula as written carries that subtree as step.inp (a function
//   of the formula's z): every log, root, power, inverse trigonometric step and formula part has one, so the
//   deformation feeds it the formula's own value, signed zero included, and it reads the formula's side of its cut
//   even inside a group (review verify-1).
//   null: nothing to gain (no catalog step, or the formula is z itself, or a constant map): the formula stays as it is.
// Shared numbers (num nodes with .param) never decide the structure (review math-5, frperf-1/2): every decision that
// reads a value (a zero or unit coefficient, two equal subtrees, a degree) is recorded on a tape at generic values of
// the shared numbers (opts.tape = {mode: 'rec'}), and replayed at the current values (opts.tape = {mode: 'play', list}):
// the chain keeps its step types while a slider moves. A value where the formula really changes kind (a constant map,
// a removable point, a lower degree) is refused at that value.
const Recognize = (() => {
  const C = CX.C;
  const ONE = C(1, 0), ZERO = C(0, 0);
  const DEG = Math.PI / 180;
  class Refuse extends Error {}
  const dep = (n) => Expr.depends(n);
  const cval = (n) => Expr.compile(n)(ZERO);       // a constant subtree: its principal value (as Expr.compile)
  const hasParam = (n) => !!n && typeof n === 'object' && (n.param != null || ['a', 'b', 'n'].some((k) => hasParam(n[k])));
  const isZ = (n) => n.t === 'var' && n.n === 'z';
  const VZ = () => ({ t: 'var', n: 'z' });
  const fin = (v) => CX.isFin(v);
  const S = (type, vals = {}) => ({ type, vals });
  // Möbius-type steps are carried as matrices while reading, merged, and named at the end
  const M = (m) => ({ type: '#mob', m });
  const ID = () => M([ONE, ZERO, ZERO, ONE]);
  const custom = (ast) => S('custom', { ast });
  // the items made for one node of the formula: one group, src = that node as a function of its operand
  const own = (items, src) => { const g = { src }; for (const it of items) it.g = g; return items; };
  // the first item's input is the value of the formula's subtree inp (kept when an inner reading already set it)
  const fed = (items, inp) => { if (items.length && !items[0].inp) items[0].inp = inp; return items; };

  // ---- the tape: value-dependent decisions, recorded at generic values of the shared numbers and replayed ----
  let TAPE = null;
  function pick(tag, cur) {
    if (!TAPE) return cur;
    if (TAPE.mode === 'rec') { TAPE.list.push([tag, cur]); return cur; }
    const e = TAPE.list[TAPE.i++];
    if (!e || e[0] !== tag) throw new Refuse('shape');
    return e[1];
  }
  // a yes/no decision whose recorded answer must hold now (a structural equality that a value cannot create)
  function must(tag, cur) {
    const r = pick(tag, cur);
    if (r && !cur) throw new Refuse('shape');
    return r;
  }
  // a decision whose recorded answer must equal the current one (else the formula changes kind at this value)
  function same_(tag, cur) {
    const r = pick(tag, cur);
    if (JSON.stringify(r) !== JSON.stringify(cur)) throw new Refuse('shape');
    return r;
  }

  // ---- the spine: a node with one operand depending on z becomes one catalog step after the steps of that operand ----
  const TRIG = { sin: 'sin', cos: 'cos', tan: 'tan', sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', exp: 'exp',
    asin: 'arcsin', acos: 'arccos', atan: 'arctan', asinh: 'arsinh', acosh: 'arcosh', atanh: 'artanh', conj: 'conj', gamma: 'gamma', zeta: 'zeta' };
  const RECIP = { cot: 'tan', sec: 'cos', csc: 'sin', coth: 'tanh' };   // Expr.compile: 1/tan, 1/cos, 1/sin, 1/tanh
  const INV = () => M([ZERO, ONE, ONE, ZERO]);
  // z^v for a constant v, as Expr.compile evaluates it: ipow for an integer |v| <= 4096, else powReal / pow on cut θ
  function power(v, param, cut) {
    if (!fin(v)) throw new Refuse('non-finite exponent');
    if (CX.isZero(v)) throw new Refuse('constant map');
    if (param) return [S('powa', { alpha: v, cut, k: 0 })];
    if (v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096) {
      if (v.re === 1) return [ID()];          // ipow(u, 1): kept as an identity item, so its group is replayed
      if (v.re === -1) return [INV()];
      return [S('pown', { n: v.re })];
    }
    if (v.im === 0 && v.re > 0 && v.re < 1) {
      const n = Math.round(1 / v.re);
      if (n >= 2 && 1 / n === v.re) return [S('root', { n, cut, k: 0 })];   // powReal(z, 1/n): root(n) evaluates the same
    }
    return [S('powa', { alpha: v, cut, k: 0 })];
  }
  // ast with the operand slot `key` replaced by z (the part's own input)
  const withZ = (n, key) => Object.assign({}, n, { [key]: VZ() });
  function go(n, cut) {
    if (n.t === 'var') return isZ(n) ? [] : own([custom(n)], n);
    const two = n.a && n.b && dep(n.a) && dep(n.b);
    if (two) { const r = multi(n, cut); return own(fed(r || [custom(n)], VZ()), n); }
    const step = (key, items) => [...go(n[key], cut), ...own(fed(items, n[key]), withZ(n, key))];
    switch (n.t) {
      case 'neg': return step('a', [M([C(-1, 0), ZERO, ZERO, ONE])]);
      case 'add': { const k = dep(n.a) ? 'a' : 'b'; return step(k, [M([ONE, cval(n[k === 'a' ? 'b' : 'a']), ZERO, ONE])]); }
      case 'sub':
        if (dep(n.a)) return step('a', [M([ONE, CX.neg(cval(n.b)), ZERO, ONE])]);
        return step('b', [M([C(-1, 0), cval(n.a), ZERO, ONE])]);
      case 'mul': {
        const k = dep(n.a) ? 'a' : 'b';
        const v = cval(n[k === 'a' ? 'b' : 'a']);
        if (!fin(v) || CX.isZero(v)) throw new Refuse('constant factor');
        return step(k, [M([v, ZERO, ZERO, ONE])]);
      }
      case 'div':
        if (dep(n.a)) {
          const v = cval(n.b);
          if (!fin(v) || CX.isZero(v)) throw new Refuse('division by 0');
          return step('a', [M([CX.inv(v), ZERO, ZERO, ONE])]);
        } else {
          const v = cval(n.a);
          if (!fin(v) || CX.isZero(v)) throw new Refuse('constant numerator 0');
          return step('b', [M([ZERO, v, ONE, ZERO])]);
        }
      case 'pow':
        if (!dep(n.b)) return step('a', power(cval(n.b), hasParam(n.b), cut));
        if (!dep(n.a)) {
          const base = cval(n.a);
          if (!fin(base) || CX.isZero(base) || (base.re === 1 && base.im === 0)) throw new Refuse('constant base');
          // c^{u} = e^{u Log c}, the principal Log c (Expr.compile); e^{u} itself (a shared base is never e by value)
          if (!hasParam(n.a) && base.re === Math.E && base.im === 0) return step('b', [S('exp')]);
          return step('b', [M([CX.log(base), ZERO, ZERO, ONE]), S('exp')]);
        }
        return own(fed([custom(n)], VZ()), n);
      case 'root': {
        if (dep(n.n)) return own(fed([custom(n)], VZ()), n);
        const nv = cval(n.n);
        if (!fin(nv) || CX.isZero(nv)) throw new Refuse('root index');
        return step('a', power(CX.div(ONE, nv), hasParam(n.n), cut));
      }
      case 'call': {
        const f = n.f;
        if (f === 'log') return step('a', [S('log', { cut, k: 0 })]);
        if (f === 'sqrt') return step('a', [S('root', { n: 2, cut, k: 0 })]);
        if (TRIG[f]) return step('a', [S(TRIG[f])]);
        if (RECIP[f]) return step('a', [S(RECIP[f]), INV()]);
        // |u|, Re u, Im u, arg u: not a catalog map; the part after u stays a formula of its own input
        return step('a', [custom(withZ(n, 'a'))]);
      }
    }
    return own(fed([custom(n)], VZ()), n);
  }

  // ---- a product of integer powers of affine factors: c ∏ (a_k z + b_k)^{m_k} (review frperf-3) ----
  // u = a z + b exactly as typed (z, 2z, z/3, z − 1, 1 − z, −(z+i), …): {a, b}, or null
  function affine(n) {
    if (isZ(n)) return { a: ONE, b: ZERO };
    if (!dep(n)) return null;
    switch (n.t) {
      case 'neg': { const r = affine(n.a); return r && { a: CX.neg(r.a), b: CX.neg(r.b) }; }
      case 'add': case 'sub': {
        const s = n.t === 'add' ? 1 : -1;
        const A = dep(n.a) ? affine(n.a) : { a: ZERO, b: cval(n.a) }, B = dep(n.b) ? affine(n.b) : { a: ZERO, b: cval(n.b) };
        if (!A || !B) return null;
        return { a: CX.add(A.a, CX.scale(B.a, s)), b: CX.add(A.b, CX.scale(B.b, s)) };
      }
      case 'mul': {
        if (dep(n.a) && dep(n.b)) return null;
        const [u, c] = dep(n.a) ? [n.a, n.b] : [n.b, n.a];
        const r = affine(u), v = cval(c);
        return r && { a: CX.mul(v, r.a), b: CX.mul(v, r.b) };
      }
      case 'div': {
        if (dep(n.b)) return null;
        const r = affine(n.a), v = cval(n.b);
        return r && { a: CX.div(r.a, v), b: CX.div(r.b, v) };
      }
    }
    return null;
  }
  // a polynomial or rational expression in z alone (no function call, no z in an exponent)
  const ratLeaf = (n) => (!dep(n) ? true : isZ(n) ? true : ['add', 'sub', 'mul', 'div'].includes(n.t) ? ratLeaf(n.a) && ratLeaf(n.b)
    : n.t === 'neg' ? ratLeaf(n.a) : n.t === 'pow' ? intExp(n.b) !== null && ratLeaf(n.a) : false);
  const intExp = (b) => {
    if (dep(b) || hasParam(b)) return null;
    const v = cval(b);
    return v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 64 ? v.re : null;
  };
  // the multiplicative skeleton: z-dependent leaves with their integer exponents, and the constant factor
  function skeleton(n, m, out) {
    if (!dep(n)) { out.c = CX.mul(out.c, CX.ipow(cval(n), m)); return; }
    switch (n.t) {
      case 'neg': if (m % 2) out.c = CX.neg(out.c); skeleton(n.a, m, out); return;
      case 'mul': skeleton(n.a, m, out); skeleton(n.b, m, out); return;
      case 'div': skeleton(n.a, m, out); skeleton(n.b, -m, out); return;
      case 'pow': { const k = intExp(n.b); if (k !== null && k !== 0) { skeleton(n.a, m * k, out); return; } break; }
    }
    out.leaves.push({ ast: n, m });
  }
  // -> undefined (not a product of several factors: read on), null (keep the formula), or the items
  function factored(n, cut) {
    if (n.t !== 'mul' && n.t !== 'div' && n.t !== 'pow') return undefined;
    const sk = { c: ONE, leaves: [] };
    skeleton(n, 1, sk);
    if (sk.leaves.length < 2) return undefined;
    if (!sk.leaves.every((l) => ratLeaf(l.ast))) return undefined;      // e^z e^z, sin z cos z: the identities below
    const lin = sk.leaves.map((l) => ({ m: l.m, af: affine(l.ast), ast: l.ast }));
    if (lin.some((l) => !l.af)) {
      // polynomial factors that are not affine: the expanded normal form would cancel near a repeated factor (float32
      // Horner on the GPU, review frperf-3), so a power of one, or the same factor twice, keeps the formula
      const nonAff = lin.filter((l) => !l.af);
      const rep = nonAff.some((l) => Math.abs(l.m) >= 2) || nonAff.some((l, i) => nonAff.some((q, j) => j > i && Expr.sameAst(l.ast, q.ast)));
      return pick('fzn', rep) ? null : undefined;
    }
    // a factor whose z-coefficient is 0 at this value (az + 1 at a = 0) is a constant there: the normal form reads it
    if (lin.some((l) => CX.isZero(l.af.a))) {
      const k = pick('fz', 'thru0');
      if (k !== 'thru' && k !== 'thru0') throw new Refuse('shape');
      return undefined;
    }
    let c = sk.c;
    const roots = [];
    for (const l of lin) {
      c = CX.mul(c, CX.ipow(l.af.a, l.m));
      const r = CX.neg(CX.div(l.af.b, l.af.a));
      let q = roots.find((x) => CX.isZero(CX.sub(x.r, r)));
      if (!q) roots.push(q = { r, m: 0, pos: false, neg: false });
      q.m += l.m; if (l.m > 0) q.pos = true; else q.neg = true;
    }
    if (!fin(c) || CX.isZero(c) || roots.some((x) => !fin(x.r))) throw new Refuse('degenerate product');
    const zs = [], ps = [];
    for (const x of roots) for (let k = 0; k < Math.abs(x.m); k++) (x.m > 0 ? zs : ps).push(x.r);
    const deg = Math.max(zs.length, ps.length);
    const cur = roots.some((x) => x.pos && x.neg) ? 'rem'            // a zero and a pole cancel: a removable point
      : roots.length === 1 ? 'one'
        : deg >= 3 || roots.some((x) => Math.abs(x.m) >= 2) ? 'zp' : 'thru';
    const kind = pick('fz', cur);
    // a value where roots coincide keeps the recorded reading ('thru' reads on, zp takes repeated zeros); a cancellation
    // that only this value makes is a removable point here: refused at this value
    if (cur === 'rem' && kind !== 'rem') throw new Refuse('removable point at this value');
    if (kind === 'rem') return null;
    if (kind === 'one') {
      if (cur !== 'one') throw new Refuse('shape');
      const x = roots[0];
      return [M([ONE, CX.neg(x.r), ZERO, ONE]), ...power(C(x.m, 0), false, cut), M([c, ZERO, ZERO, ONE])];
    }
    if (kind === 'zp') {
      if (zs.length > 24 || ps.length > 24) return null;           // Funcs.ZP_MAX
      return [S('zp', { a: c, zeros: zs, poles: ps })];
    }
    if (kind !== 'thru') throw new Refuse('shape');
    return undefined;                                             // 'thru': two simple factors, the normal form reads them
  }

  // ---- nodes with z in both operands: the exact rational normal form, or an identity of entire functions ----
  const expArg = (n) => (n.t === 'call' && n.f === 'exp' ? n.a : n.t === 'pow' && !dep(n.a) && n.a.t === 'num' && n.a.v.re === Math.E && n.a.v.im === 0 && !hasParam(n.a) ? n.b : null);
  // u as c·X with a constant c (−X, cX, Xc, X/c): {c, X}
  function scal(u) {
    if (u.t === 'neg') { const r = scal(u.a); return { c: CX.neg(r.c), X: r.X }; }
    if (u.t === 'mul' && !dep(u.a) && dep(u.b)) { const r = scal(u.b); return { c: CX.mul(cval(u.a), r.c), X: r.X }; }
    if (u.t === 'mul' && dep(u.a) && !dep(u.b)) { const r = scal(u.a); return { c: CX.mul(cval(u.b), r.c), X: r.X }; }
    if (u.t === 'div' && dep(u.a) && !dep(u.b)) { const r = scal(u.a); return { c: CX.div(r.c, cval(u.b)), X: r.X }; }
    return { c: ONE, X: u };
  }
  const same = (a, b) => must('same', Expr.sameAst(a, b));
  const eqC = (a, b) => a.re === b.re && a.im === b.im;
  const callOf = (n, fs) => (n.t === 'call' && fs.includes(n.f) ? n : null);
  // a rational node read from its normal form: the formula, evaluated in doubles, must have the normal form's degree
  // (an exact decimal cancellation, (0.1+0.2−0.3)z³, or a snapped non-literal coefficient leaves the doubles a term the
  // normal form does not have: review math-6). Compared far out, where the highest terms dominate.
  function degreeHolds(n, P, Q) {
    const dp = P.length - 1, dq = Q.length - 1;
    // a polynomial: its expansion in doubles (Expr.polyDegree: hi is the highest coefficient that may be nonzero)
    const hi = (x) => { const e = Expr.polyDegree(x); return e ? e.hi : null; };
    if (dq === 0) { const h = hi(n); return h === null || h <= dp; }
    if (n.t === 'div') { const ha = hi(n.a), hb = hi(n.b); if (ha !== null && hb !== null) return ha <= dp && hb <= dq; }
    const f = Expr.compile(n), d = Math.max(dp, dq, 1);
    const R = Math.min(1e8, 10 ** (280 / d));
    for (const t of [0.3, 2.1, -1.2]) {
      const z = C(R * Math.cos(t), R * Math.sin(t));
      const u = f(z), v = CX.div(CX.polyEval(P, z), CX.polyEval(Q, z));
      if (fin(u) !== fin(v)) return false;
      if (fin(u) && !(CX.abs(CX.sub(u, v)) <= 1e-9 * CX.abs(u))) return false;
    }
    return true;
  }
  // the formula is typed as sums of monomials c z^k (a polynomial, or a quotient of two): its own evaluation adds the
  // same terms as Horner on the expanded coefficients does, so the 'poly' and 'rational' steps lose nothing
  const mono = (n) => isZ(n) || (n.t === 'neg' && mono(n.a)) || (n.t === 'pow' && isZ(n.a) && intExp(n.b) !== null)
    || ((n.t === 'mul' || n.t === 'div') && (mono(n.a) || !dep(n.a)) && (mono(n.b) || !dep(n.b)));
  const typedExpanded = (n) => !dep(n) || mono(n) || (n.t === 'neg' && typedExpanded(n.a))
    || ((n.t === 'add' || n.t === 'sub') && typedExpanded(n.a) && typedExpanded(n.b))
    || (n.t === 'mul' && ((!dep(n.a) && typedExpanded(n.b)) || (!dep(n.b) && typedExpanded(n.a))))
    || (n.t === 'div' && typedExpanded(n.a) && typedExpanded(n.b));
  // a 'poly' or 'rational' step evaluates the expanded coefficients by Horner (float32 on the GPU), which cancels
  // catastrophically near a repeated or clustered root (z(z−1)^4 − (z−1)^4 = (z−1)^5: a relative error of 1e4 at
  // |z − 1| = 0.01). Unless the formula is itself typed expanded, such a step is used only for degree ≤ 4 with
  // well-separated roots (review frperf-3), and where Horner is well conditioned near every root: its relative error is
  // about κ ε with κ = Σ|c_k||z|^k / |p(z)|, and κ ≤ HORNER_KAPPA at 0.01 from each root (review verify-3: roots far
  // from 0 make large coefficients, (z−10)² + (z−11)² = 2z² − 42z + 221 has κ ≈ 4e4 there, z² − 1 has κ ≈ 100).
  // Otherwise the formula stays as typed.
  const HORNER_KAPPA = 1e4;
  const hornerBound = (co, z) => { const r = CX.abs(z); let s = 0; for (const x of co) s = s * r + CX.abs(x); return s; };
  function hornerSafe(n, items) {
    const hs = items.filter((it) => it.type === 'poly' || it.type === 'rational');
    if (!hs.length || typedExpanded(n)) return true;
    for (const it of hs) {
      for (const co of it.type === 'poly' ? [it.vals.co] : [it.vals.p, it.vals.q]) {
        if (co.length - 1 > 4) return false;
        const rs = CX.polyRoots(co);
        for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
          if (!(CX.abs(CX.sub(rs[i], rs[j])) >= 1e-3 * (1 + Math.max(CX.abs(rs[i]), CX.abs(rs[j]))))) return false;
        }
        for (const r of rs) for (let k = 0; k < 8; k++) {
          const z = CX.add(r, C(0.01 * Math.cos(k * Math.PI / 4), 0.01 * Math.sin(k * Math.PI / 4)));
          if (!(hornerBound(co, z) <= HORNER_KAPPA * CX.abs(CX.polyEval(co, z)))) return false;
        }
      }
    }
    return true;
  }
  // The formula is undefined at every zero of a z-dependent divisor inside it (a division's denominator, a negative
  // power's base: CX.div by 0 is NaN). The rational reading P/Q is the same function elsewhere, so it must have a pole
  // at each of those points; otherwise it fills in a removable point that the normal form cancelled inside a sub-term
  // (z/z + z = (z + z²)/z: rationalForm divides the common z out without listing it in removed; review verify-2).
  function clusterMeans(co) {
    const rs = co.length > 1 ? CX.polyRoots(co).filter(fin) : [], used = rs.map(() => false), out = [];
    for (let i = 0; i < rs.length; i++) {
      if (used[i]) continue;
      let s = rs[i], m = 1;
      for (let j = i + 1; j < rs.length; j++) {
        if (!used[j] && CX.abs(CX.sub(rs[j], rs[i])) <= 1e-3 * (1 + CX.abs(rs[i]))) { used[j] = true; s = CX.add(s, rs[j]); m++; }
      }
      out.push(CX.scale(s, 1 / m));     // a multiple root that polyRoots splits: the mean of its cluster
    }
    return out;
  }
  function polesHold(n, Q) {
    const dens = [];
    const walk = (m) => {
      if (!m || typeof m !== 'object' || !dep(m)) return;
      if (m.t === 'div' && dep(m.b)) dens.push(m.b);
      if (m.t === 'pow' && !dep(m.b)) { const e = cval(m.b); if (e.im === 0 && Number.isInteger(e.re) && e.re < 0) dens.push(m.a); }
      for (const k of ['a', 'b']) walk(m[k]);
    };
    walk(n);
    if (!dens.length) return true;
    const poles = clusterMeans(Q);
    for (const d of dens) {
      const rf = Inverse.rationalForm(d);
      if (!rf.ok) { if (rf.reason === 'constant map') continue; return false; }   // z/z: its own divisor z is listed
      for (const x of clusterMeans(rf.P)) if (!poles.some((q) => CX.abs(CX.sub(q, x)) <= 1e-6 * (1 + CX.abs(x)))) return false;
    }
    return true;
  }
  function multi(n, cut) {
    // 0. a product of powers of affine factors: product form (zp), or one root: affine, power, scale
    const fz = factored(n, cut);
    if (fz !== undefined) return fz;
    // 1. rational in z: P/Q coprime, exact where the constants are; refused when a common root was divided out (the
    //    formula is 0/0 there, a catalog step would fill the point in)
    if (Inverse.rationalForm) {
      const rf = Inverse.rationalForm(n);
      const cur = rf.ok ? (rf.removed && rf.removed.length ? 'rem' : 'ok') : rf.notRational ? 'no' : 'bad';
      const kind = same_('rat', cur);
      if (kind === 'rem' || kind === 'bad') return null;
      if (kind === 'ok') {
        const gen = !TAPE || TAPE.mode === 'rec';
        if (!pick('deg', gen ? degreeHolds(n, rf.P, rf.Q) : null)) return null;
        // a removable point inside a sub-term: the formula stays (at the current values, as 'rat': a value that makes
        // one, z/(z − a)·(z − a) + … at a = 0, is refused there)
        if (!same_('ph', polesHold(n, rf.Q))) return null;
        const items = ratChain(rf.P, rf.Q);
        // decided at generic values of the shared numbers, like the degree (the step's shape never flickers)
        if (items && !pick('hc', gen ? hornerSafe(n, items) : null)) return null;
        return items;
      }
    }
    const A = n.a, B = n.b;
    // 2. e^{A} e^{B} = e^{A+B}, e^{A}/e^{B} = e^{A−B} (entire, no branch)
    if (n.t === 'mul' || n.t === 'div') {
      const ea = expArg(A), eb = expArg(B);
      if (ea && eb) return go({ t: 'call', f: 'exp', a: { t: n.t === 'mul' ? 'add' : 'sub', a: ea, b: eb } }, cut);
    }
    // 3. e^{cX} ± e^{−cX} = 2 cosh(cX), 2 sinh(cX); with c = ±i, 2 cos X and ±2i sin X
    if (n.t === 'add' || n.t === 'sub') {
      const ea = expArg(A), eb = expArg(B);
      if (ea && eb) {
        const p = scal(ea), q = scal(eb);
        if (same(p.X, q.X) && must('negc', eqC(q.c, CX.neg(p.c))) && !CX.isZero(p.c)) {
          const c = p.c, X = p.X, plus = n.t === 'add';
          const pre = go(X, cut);
          const I = (s) => C(0, s);
          if (must('ic', c.re === 0 && Math.abs(c.im) === 1)) {
            // e^{iX} + e^{−iX} = 2 cos X; e^{±iX} − e^{∓iX} = ±2i sin X
            if (plus) return [...pre, S('cos'), M([C(2, 0), ZERO, ZERO, ONE])];
            return [...pre, S('sin'), M([I(2 * c.im), ZERO, ZERO, ONE])];
          }
          return [...pre, M([c, ZERO, ZERO, ONE]), S(plus ? 'cosh' : 'sinh'), M([C(2, 0), ZERO, ZERO, ONE])];
        }
      }
      // sin u + cos u = √2 sin(u + π/4); cos u − sin u = √2 cos(u + π/4)
      const sa = callOf(A, ['sin', 'cos']), sb = callOf(B, ['sin', 'cos']);
      if (sa && sb && sa.f !== sb.f && same(sa.a, sb.a)) {
        const pre = go(sa.a, cut), q = M([ONE, C(Math.PI / 4, 0), ZERO, ONE]), r2 = M([C(Math.SQRT2, 0), ZERO, ZERO, ONE]);
        if (n.t === 'add') return [...pre, q, S('sin'), r2];
        if (sa.f === 'cos') return [...pre, q, S('cos'), r2];
      }
      // log(1+u) − log(1−u) = 2 artanh u: CX.atanh evaluates exactly ½(log(1+u) − log(1−u)) on the principal cut
      if (n.t === 'sub' && Math.abs(cut - 180) < 1e-12 && A.t === 'call' && A.f === 'log' && B.t === 'call' && B.f === 'log') {
        const one = (x) => x.t === 'num' && !x.param && x.v.re === 1 && x.v.im === 0;
        const up = A.a.t === 'add' ? (one(A.a.a) ? A.a.b : one(A.a.b) ? A.a.a : null) : null;
        const um = B.a.t === 'sub' && one(B.a.a) ? B.a.b : null;
        if (up && um && same(up, um)) return [...go(up, cut), Object.assign(S('artanh'), { inp: up }), M([C(2, 0), ZERO, ZERO, ONE])];
      }
    }
    // 4. sin u / cos u = tan u, cos u / sin u = 1/tan u (and sinh, cosh); sin u · cos u = ½ sin 2u (and sinh, cosh)
    if (n.t === 'div') {
      const pa = callOf(A, ['sin', 'cos', 'sinh', 'cosh']), pb = callOf(B, ['sin', 'cos', 'sinh', 'cosh']);
      if (pa && pb && same(pa.a, pb.a)) {
        const pre = go(pa.a, cut);
        if (pa.f === 'sin' && pb.f === 'cos') return [...pre, S('tan')];
        if (pa.f === 'cos' && pb.f === 'sin') return [...pre, S('tan'), INV()];
        if (pa.f === 'sinh' && pb.f === 'cosh') return [...pre, S('tanh')];
        if (pa.f === 'cosh' && pb.f === 'sinh') return [...pre, S('tanh'), INV()];
      }
    }
    if (n.t === 'mul') {
      const pa = callOf(A, ['sin', 'cos', 'sinh', 'cosh']), pb = callOf(B, ['sin', 'cos', 'sinh', 'cosh']);
      if (pa && pb && same(pa.a, pb.a)) {
        const fs = [pa.f, pb.f].sort().join(','), dbl = M([C(2, 0), ZERO, ZERO, ONE]), half = M([C(0.5, 0), ZERO, ZERO, ONE]);
        if (fs === 'cos,sin') return [...go(pa.a, cut), dbl, S('sin'), half];
        if (fs === 'cosh,sinh') return [...go(pa.a, cut), dbl, S('sinh'), half];
      }
    }
    return null;
  }

  // ---- the catalog reading of a coprime P/Q (coefficients highest first) ----
  const trim = (co) => { let i = 0; while (i < co.length - 1 && CX.isZero(co[i])) i++; return co.slice(i); };
  function ratGcd(P, Q) {
    let g = 0;
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    for (const co of [P, Q]) co.forEach((x, i) => { const e = co.length - 1 - i; if (e > 0 && !CX.isZero(x)) g = gcd(g, e); });
    return g;
  }
  const subPow = (co, g) => co.filter((x, i) => (co.length - 1 - i) % g === 0);
  function ratChain(P, Q) {
    P = trim(P); Q = trim(Q);
    const dp = P.length - 1, dq = Q.length - 1, d = Math.max(dp, dq);
    same_('d', d);                               // a lower degree at this value: the formula changes kind here
    if (d <= 0) return null;
    if (d > 1) same_('pq', [dp, dq]);            // (degree 1 is one Möbius matrix, whatever its zero entries)
    if (d === 1) {
      const two = (co) => (co.length === 1 ? [ZERO, co[0]] : co);
      const [a, b] = two(P), [c, dd] = two(Q);
      return [M([a, b, c, dd])];
    }
    if (dq === 0) {
      const co = P.map((x) => CX.div(x, Q[0]));
      // a z^n + b (z·z, z z z + 1): the power step, as z^n + b is read
      if (must('pa', co.slice(1, dp).every(CX.isZero))) return [S('pown', { n: dp }), M([co[0], co[dp], ZERO, ONE])];
      return [S('poly', { co })];
    }
    // R(z^g): z^g, then R (a coefficient that is 0 only at this value keeps the generic g)
    const gNow = ratGcd(P, Q), g = pick('g', gNow);
    if (g > 1 && gNow % g !== 0) throw new Refuse('shape');
    if (g > 1 && g <= 4096) {
      const r = ratChain(subPow(P, g), subPow(Q, g));
      if (r) return [S('pown', { n: g }), ...r];
    }
    // the Joukowski family (a simple pole at z0 and one at ∞): α u + γ + β/u with u = z − z0 is
    // (2αs) J(u/s) + γ, s² = β/α, J(v) = ½(v + 1/v)
    if (dp === 2 && dq === 1) {
      const [p2, p1, p0] = P, [q1, q0] = Q;
      const z0 = CX.neg(CX.div(q0, q1));
      const Pz0 = CX.add(CX.mul(CX.add(CX.mul(p2, z0), p1), z0), p0);
      const al = CX.div(p2, q1), ga = CX.div(CX.add(p1, CX.mul(CX.scale(p2, 2), z0)), q1), be = CX.div(Pz0, q1);
      const s = CX.sqrt(CX.div(be, al));
      const ok = fin(al) && fin(be) && fin(ga) && !CX.isZero(al) && !CX.isZero(be) && fin(s) && !CX.isZero(s);
      if (!must('jk', ok)) return null;
      const is = CX.inv(s);
      return [M([is, CX.neg(CX.mul(z0, is)), ZERO, ONE]), S('joukowski'), M([CX.scale(CX.mul(al, s), 2), ga, ZERO, ONE])];
    }
    return [S('rational', { p: P, q: Q })];
  }

  // ---- merging the Möbius-type steps, and naming them ----
  const mobMul = (A, B) => [CX.add(CX.mul(A[0], B[0]), CX.mul(A[1], B[2])), CX.add(CX.mul(A[0], B[1]), CX.mul(A[1], B[3])),
    CX.add(CX.mul(A[2], B[0]), CX.mul(A[3], B[2])), CX.add(CX.mul(A[2], B[1]), CX.mul(A[3], B[3]))];
  // the generic name a value may specialise (a recorded 'affine' at a value where the scale is 1 stays 'affine')
  const WIDER = { affine: [null, 'mul', 'add'], mobius: [null, 'mul', 'add', 'affine', 'recip'], mul: [null], add: [null] };
  function nameMob(m) {
    if (!m.every(fin) || CX.mobDetZero(m) || !(CX.mobRel(m) >= CX.MOB_EPS)) throw new Refuse('degenerate Möbius map');
    const [a, b, c, d] = m;
    let cur;
    const A = eqC(d, ONE) ? a : CX.div(a, d), B = eqC(d, ONE) ? b : CX.div(b, d);
    if (CX.isZero(c)) cur = eqC(A, ONE) && CX.isZero(B) ? null : CX.isZero(B) ? 'mul' : eqC(A, ONE) ? 'add' : 'affine';
    else cur = CX.isZero(a) && CX.isZero(d) && eqC(b, c) ? 'recip' : 'mobius';
    const name = pick('mob', cur);
    if (name !== cur && !(WIDER[name] || []).includes(cur)) throw new Refuse('shape');
    switch (name) {
      case null: return null;                                      // the identity
      case 'mul': return S('mul', { c: A });
      case 'add': return S('add', { c: B });
      case 'affine': return S('affine', { a: A, b: B });
      case 'recip': return S('recip');
      default: return S('mobius', { a, b, c, d });
    }
  }
  // a run of Möbius factors whose product loses a factor's pole: the formula is 1/(1/0) = NaN there (a removable
  // point the merged matrix would fill in, review math-3), so the reading is refused
  function runPolesHold(run, prod) {
    let acc = null;
    const pole = CX.isZero(prod[2]) ? null : CX.neg(CX.div(prod[3], prod[2]));
    for (const m of run) {
      if (!CX.isZero(m[2])) {
        const u0 = CX.neg(CX.div(m[3], m[2]));
        // the input x of the run with acc(x) = u0
        const x0 = acc ? CX.mobApply([acc[3], CX.neg(acc[1]), CX.neg(acc[2]), acc[0]], u0) : u0;
        if (fin(x0) && !(pole && CX.abs(CX.sub(x0, pole)) <= 1e-9 * (1 + CX.abs(pole)))) return false;
      }
      acc = acc ? mobMul(m, acc) : m;
    }
    return true;
  }
  function merge(list) {
    // the groups in chain order; gi[i] is item i's group
    const gs = [], gi = [];
    for (const it of list) {
      if (!gs.length || gs[gs.length - 1].ref !== it.g) gs.push({ ref: it.g, src: it.g.src, alive: true });
      gi.push(gs.length - 1);
    }
    // groups a..b (consecutive) become one: the later pieces composed onto the earlier
    const root = (k) => { while (gs[k].to !== undefined) k = gs[k].to; return k; };
    const unite = (a, b) => {
      a = root(a); b = root(b);
      if (a === b) return;
      const [lo, hi] = a < b ? [a, b] : [b, a];
      for (let k = lo + 1; k <= hi; k++) if (gs[k].to === undefined) { gs[lo].src = subst(gs[k].src, gs[lo].src); gs[k].to = lo; }
    };
    const out = [];   // {s, first: item index}
    let run = [], runIdx = [];
    const flush = (nextIdx) => {
      if (!run.length) return;
      let acc = null;
      for (const m of run) acc = acc ? mobMul(m, acc) : m;
      if (run.length > 1 && !runPolesHold(run, acc)) throw new Refuse('removable point in a merged Möbius map');
      for (const i of runIdx) unite(gi[runIdx[0]], gi[i]);
      const s = nameMob(acc);
      if (s) out.push({ s, first: runIdx[0] });
      else if (nextIdx < list.length) unite(gi[runIdx[0]], gi[nextIdx]);    // the identity: its pieces go with the next step
      else if (runIdx[0] > 0) unite(gi[runIdx[0] - 1], gi[runIdx[0]]);       // or with the one before
      run = []; runIdx = [];
    };
    list.forEach((s, i) => {
      if (s.type === '#mob') { run.push(s.m); runIdx.push(i); return; }
      flush(i);
      out.push({ s, first: i });
    });
    flush(list.length);
    // adjacent formula parts are one formula: the later part with z replaced by the earlier
    const res = [];
    for (const o of out) {
      const prev = res[res.length - 1];
      if (o.s.type === 'custom' && prev && prev.s.type === 'custom') { prev.s.vals = { ast: subst(o.s.vals.ast, prev.s.vals.ast) }; unite(gi[prev.first], gi[o.first]); }
      else res.push(o);
    }
    const steps = res.map((o) => o.s), groups = [];
    res.forEach((o, j) => {
      const g = root(gi[o.first]), last = groups[groups.length - 1];
      if (last && last.g === g) last.to = j + 1;
      else groups.push({ g, from: j, to: j + 1 });
    });
    return { steps, groups: groups.map((x) => ({ from: x.from, to: x.to, src: gs[x.g].src })) };
  }
  function subst(ast, by) {
    if (!ast || typeof ast !== 'object') return ast;
    if (ast.t === 'var' && ast.n === 'z') return by;
    const o = Object.assign({}, ast);
    for (const k of ['a', 'b', 'n']) if (o[k]) o[k] = subst(o[k], by);
    return o;
  }

  // ---- shared numbers: the key of a tree without their values, and the tree at generic values ----
  const key = (ast, cut) => JSON.stringify(ast, function (k, v) { return k === 'pos' || k === 'len' || (k === 'v' && this.param != null) ? undefined : v; }) + '@' + cut;
  const GEN = [[0.7390851332151607, 1.324717957244746, 0.5671432904097838, 1.465571231876768, 0.6823278038280193, 1.7548776662466927],
    [1.2207440846057596, 0.8017118471377938, 1.6180339887498949, 0.4501836112948736, 1.1673039782614187, 0.5960631221178598]];
  function generic(ast, set) {
    const names = [];
    const walk = (n) => {
      if (!n || typeof n !== 'object') return n;
      if (n.t === 'num' && n.param != null) {
        let i = names.indexOf(n.param);
        if (i < 0) { names.push(n.param); i = names.length - 1; }
        return Object.assign({}, n, { v: C(GEN[set][i % GEN[set].length] + 0.013 * Math.floor(i / GEN[set].length), 0) });
      }
      const o = Object.assign({}, n);
      for (const k of ['a', 'b', 'n']) if (o[k]) o[k] = walk(o[k]);
      return o;
    };
    return walk(ast);
  }

  // the steps that make a recognition worth it: anything beyond the Möbius-type maps (a power, a root, exp, log, the
  // trigonometric family, Joukowski, a polynomial or rational step), or a Möbius map typed as a formula
  const MOBT = new Set(['mul', 'add', 'affine', 'recip', 'mobius']);
  function chain(ast, cutDeg = 180, opts = {}) {
    if (!ast || !dep(ast) || Expr.hasBool(ast)) return null;
    const tape = opts.tape ? { mode: opts.tape.mode, list: opts.tape.mode === 'rec' ? [] : opts.tape.list, i: 0 } : null;
    let r;
    TAPE = tape;
    try { r = merge(go(ast, cutDeg)); } catch (e) { if (e instanceof Refuse) return null; throw e; } finally { TAPE = null; }
    if (tape && tape.mode === 'play' && tape.i !== tape.list.length) return null;
    const { steps, groups } = r;
    if (!steps.length) return null;
    const cat = steps.filter((s) => s.type !== 'custom');
    if (!cat.length) return null;
    const partial = cat.length < steps.length;
    // a formula part with only Möbius-type maps around it gains nothing (its own path and code are as good)
    if (partial && cat.every((s) => MOBT.has(s.type))) return null;
    return { steps, groups, partial, tape: tape ? tape.list : null };
  }
  return { chain, ratChain, key, generic, hasParam, DEG };
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Inverse } from './inverse.js';
export { Recognize, Recognize as 'module.exports' };
