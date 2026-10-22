'use strict';
// Catalog of chainable functions: evaluation, LaTeX, guaranteed properties, branch cuts, homotopies.
const Funcs = (() => {
  const { C } = CX;
  const DEG = Math.PI / 180;
  const paren = Expr.paren;
  const PI = Math.PI;

  const PROP_KEYS = ['analytic', 'entire', 'rational', 'polynomial', 'mobius', 'proper', 'injective'];
  const props = (o = {}) => Object.assign({
    analytic: false, entire: false, rational: false, polynomial: false, mobius: false, proper: false, injective: false,
    deg: null, degExact: false, constant: false,
  }, o);
  const ALL = { analytic: true, entire: true, rational: true, polynomial: true, mobius: true, proper: true, injective: true, deg: 1, degExact: true };
  const CONSTANT = props({ analytic: true, entire: true, rational: true, polynomial: true, deg: 0, degExact: true, constant: true });

  const atom = (a) => (a.p >= 4 ? a.s : paren(a.s));
  // bare: a function applied without parentheses (\sin z), see Expr.toTex
  const fn = (name, a) => (a.p >= 4 && a.s.length <= 4 ? { s: `${name} ${a.s}`, p: 3, bare: true } : { s: `${name}${paren(a.s)}`, p: 3 });
  const powTex = (a, e) => ({ s: `${a.p >= 4 && !a.s.startsWith('\\frac') ? a.s : paren(a.s)}^{${e}}`, p: 3 });
  const compoundTex = Expr.compoundTex;
  function coefTex(c) {
    const s = CX.tex(c);
    return compoundTex(s) ? paren(s) : s;
  }
  function mulTex(c, a) {
    if (CX.eq(c, C(1, 0), 1e-12)) return a;
    if (CX.eq(c, C(-1, 0), 1e-12)) return { s: '-' + (a.p <= 1 ? paren(a.s) : a.s), p: 2, bare: a.bare && a.p > 1 };
    const cs = coefTex(c);
    const as = a.p <= 2 ? paren(a.s) : a.s;
    return { s: `${cs}${/^[0-9.]/.test(as) ? '\\cdot ' : '\\,'}${as}`, p: cs.startsWith('-') ? 2 : 1, bare: a.bare && a.p > 2 };
  }
  function addTex(a, c) {
    if (CX.isZero(c)) return a;
    const s = CX.tex(c);
    const compound = compoundTex(s);
    if (!compound && s.startsWith('-')) return { s: `${a.s}${s}`, p: 0 };
    return { s: `${a.s}+${compound ? paren(s) : s}`, p: 0 };
  }
  // parameter text for an inverse: parses back to exactly c (never 1.0000e-5 rounded to 5 digits)
  const fmtC = (c) => CX.fmtExact(c);
  // angles in plain-text notes: one decimal at most, U+2212 minus
  const fmtDeg = (x) => String(+x.toFixed(1)).replace('-', '−');

  // ---- homotopies (t in [0,1] -> z => w), identity at t=0, the map at t=1 ----
  function mobHom(m) {
    const path = CX.mobPath(m);
    if (!path) return null;
    return (t) => { const M = path(t); return (z) => CX.mobApply(M, z); };
  }
  const linHom = (f) => (t) => (z) => CX.add(CX.scale(z, 1 - t), CX.scale(f(z), t));
  const powHom = (alpha, theta, k) => (t) => {
    const s = CX.add(C(1, 0), CX.scale(CX.sub(alpha, C(1, 0)), t));
    return (z) => CX.pow(z, s, theta, k);
  };

  // ---- parameter helpers ----
  const cutParams = [
    { key: 'cut', label: 'cut angle', type: 'angle', def: 180 },
    { key: 'k', label: 'sheet', type: 'int', def: 0 },
  ];
  function parseCoeffs(str) {
    // split on commas outside brackets
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of String(str)) {
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    const trimmed = parts.map((s) => s.trim());
    if (trimmed.length > 1 && trimmed.some((s) => !s.length)) throw new Error('A coefficient is missing between two commas');
    const co = trimmed.filter((s) => s.length).map((s) => Expr.constValue(s));
    if (!co.length) throw new Error('Enter at least one coefficient');
    return co;
  }
  function polyTex(co, a) {
    co = CX.polyTrim(co);
    const n = co.length - 1;
    const terms = [];
    co.forEach((c, i) => {
      const k = n - i;
      if (CX.isZero(c)) return;
      let v = k === 0 ? '' : k === 1 ? atom(a) : `${atom(a)}^{${k}}`;
      let cs = CX.tex(c);
      const compound = compoundTex(cs);
      if (k > 0 && cs === '1') cs = '';
      else if (k > 0 && cs === '-1') cs = '-';
      else if (compound && (k > 0 || terms.length)) cs = paren(cs);
      if (k > 0 && cs && cs !== '-' && /^[0-9.]/.test(v)) cs += '\\cdot ';
      else if (k > 0 && cs && cs !== '-') cs += '\\,';
      terms.push(cs + v);
    });
    if (!terms.length) return { s: '0', p: 4 };
    let s = terms[0];
    for (let i = 1; i < terms.length; i++) s += terms[i].startsWith('-') ? terms[i] : '+' + terms[i];
    return { s, p: terms.length > 1 ? 0 : (s.startsWith('-') ? 2 : 1) };
  }
  // exact degree of polynomial-like function via sampling + DFT
  function numericPolyDegree(f, bound) {
    const N = bound + 1;
    const vals = [];
    for (let j = 0; j < N; j++) vals.push(f(C(Math.cos(2 * PI * j / N), Math.sin(2 * PI * j / N))));
    if (!vals.every(CX.isFin)) return null;
    const co = [];
    for (let m = 0; m < N; m++) {
      let s = C(0, 0);
      for (let j = 0; j < N; j++) s = CX.add(s, CX.mul(vals[j], C(Math.cos(-2 * PI * j * m / N), Math.sin(-2 * PI * j * m / N))));
      co.push(CX.scale(s, 1 / N));
    }
    const mx = Math.max(1e-300, ...co.map(CX.abs));
    let d = 0;
    for (let m = 0; m < N; m++) if (CX.abs(co[m]) > 1e-9 * Math.max(1, mx)) d = m;
    // verify reconstruction at an off-circle point
    const zt = C(0.37, -0.81);
    let r = C(0, 0);
    for (let m = N - 1; m >= 0; m--) r = CX.add(CX.mul(r, zt), co[m]);
    const ft = f(zt);
    if (CX.abs(CX.sub(r, ft)) > 1e-7 * (1 + CX.abs(ft))) return null;
    return d;
  }

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
  // Are p and q certainly coprime? The computed roots of q are clustered (a root of multiplicity m comes back
  // as m points about eps^(1/m) apart). Pellet's test on the Taylor expansion of q around each cluster
  // proves that the disc |z − c| < R holds exactly that many roots, so the discs hold all of q's roots, and
  // |p(c)| > Σ_{j≥1} |p_j| R^j proves p has no zero in the disc. Returns {coprime, centers} (centers: one per
  // cluster, for the pole markers).
  function coprimeTest(p, q, roots) {
    const left = roots.slice(), clusters = [];
    while (left.length) {
      const cl = [left.pop()];
      for (let grow = true; grow;) {
        grow = false;
        for (let j = left.length - 1; j >= 0; j--) {
          if (cl.some((r) => CX.abs(CX.sub(r, left[j])) < 1e-3 * (1 + CX.abs(r)))) { cl.push(left.splice(j, 1)[0]); grow = true; }
        }
      }
      const c = CX.scale(cl.reduce(CX.add, C(0, 0)), 1 / cl.length);
      const rad = Math.max(...cl.map((r) => CX.abs(CX.sub(r, c))));
      clusters.push({ c, m: cl.length, R: Math.max((2 * cl.length + 2) * rad, 1e-7 * (1 + CX.abs(c))) });
    }
    const centers = clusters.map((x) => x.c);
    const pZero = p.every(CX.isZero);
    const ok = !pZero && clusters.every(({ c, m, R }) => {
      const tq = taylorAt(q, c);
      let dom = 0, rest = 0;
      tq.t.forEach((x, j) => {
        const Rj = Math.pow(R, j);
        if (j === m) dom = (CX.abs(x) - tq.e[j]) * Rj; else rest += (CX.abs(x) + tq.e[j]) * Rj;
      });
      if (!(dom > rest)) return false;
      const tp = taylorAt(p, c);
      let tail = 0;
      for (let j = 1; j < tp.t.length; j++) tail += (CX.abs(tp.t[j]) + tp.e[j]) * Math.pow(R, j);
      return CX.abs(tp.t[0]) - tp.e[0] > tail;
    });
    return { coprime: ok, centers };
  }

  // ---- inverses that are not a catalog entry, and why there is none ----
  const XN = Expr.N;
  const NOTE_CONST = 'This map is constant, so it has no inverse';
  const times = (d) => (d === 2 ? 'twice' : `${d} times`);
  const NOTE_PRE = 'use the Preimage view to see every solution of f(z) = w';
  const texOf = (ast) => Expr.toTex(Expr.simplify(ast)).s;
  // a z^n + b inverts to the principal root ((w − b)/a)^{1/n}, a branch of the inverse like ⁿ√ for zⁿ
  function polyInverse(c) {
    const d = c.length - 1;
    if (d === 0) return { inverse: null, inverseNote: NOTE_CONST };
    if (d === 1) return { inverse: { type: 'affine', params: { a: fmtC(CX.inv(c[0])), b: fmtC(CX.neg(CX.div(c[1], c[0]))) } } };
    if (c.slice(1, d).every(CX.isZero)) {
      const u = XN.div(XN.sub(XN.z(), XN.num(c[d])), XN.num(c[0]));
      const r = d === 2 ? XN.call('sqrt', u) : XN.root(XN.real(d), u);
      return { inverse: { type: 'custom', params: { expr: texOf(r), cut: 180 } } };
    }
    return { inverse: null, inverseNote: `A polynomial of degree ${d} takes most values ${times(d)}, so it has no single inverse; ${NOTE_PRE}` };
  }
  function rationalInverse(p, q, P) {
    if (P.constant) return { inverse: null, inverseNote: NOTE_CONST };
    if (P.mobius) {
      const two = (co) => (co.length === 1 ? [C(0, 0), co[0]] : co);
      const [a, b] = two(p), [c, d] = two(q);
      const m = [a, b, c, d];
      if (!CX.mobDetZero(m) && CX.mobRel(m) >= CX.MOB_EPS) return { inverse: { type: 'mobius', params: { a: fmtC(d), b: fmtC(CX.neg(b)), c: fmtC(CX.neg(c)), d: fmtC(a) } } };
    }
    if (P.degExact && P.deg >= 2) return { inverse: null, inverseNote: `This rational map has degree ${P.deg}, so it takes most values ${times(P.deg)} and has no single inverse; ${NOTE_PRE}` };
    return { inverse: null, inverseNote: `This rational map is not known to be one-to-one, so no inverse is offered; ${NOTE_PRE}` };
  }
  function customInverse(ast, th) {
    try {
      const r = Expr.invert(ast, { theta: th });
      const expr = Expr.toTex(r.ast).s;
      Expr.parse(expr);
      return { inverse: { type: 'custom', params: { expr, cut: 180 } }, inverseKind: r.kind };
    } catch (e) {
      return { inverse: null, inverseNote: e.message };
    }
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
      if (nb.error) return { error: `The derivative could not be built: ${nb.error}` };
      return { step: { type: 'custom', params: { expr, cut: d.cut } }, note: `Derivative of “${b.def.label}”${d.extra}` };
    } catch (e) {
      return { error: e.message };
    }
  }
  // f′ of one built step as an expression tree in z (the step's input) with the cut angle (degrees) that its branch
  // nodes use: {ast, cut, extra} or {error}. The tree keeps exact numbers (no TeX round trip). opts.stable: a form
  // that evaluates without cancellation where the readable one cancels (for evaluation, not for display).
  function derivAst(b, opts = {}) {
    if (!b || b.error || !b.def) return { error: b && b.error ? b.error : 'No step' };
    if (b.op === 'deriv') return { error: 'd/dz is an operator on the chain, not a map of w; add a second d/dz for the second derivative' };
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
          cut = v.cut; extra = `; same cut (${fmtDeg(v.cut)}°) and sheet ${v.k}`;
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
          cut = v.cut; extra = `; same cut (${fmtDeg(v.cut)}°) and sheet ${v.k}`;
          break;
        }
        case 'exp': ast = call('exp', z()); break;
        case 'log': ast = div(one(), z()); extra = '; the same on every sheet'; break;
        case 'sin': ast = call('cos', z()); break;
        case 'cos': ast = neg(call('sin', z())); break;
        case 'tan': ast = div(one(), sq(call('cos', z()))); break;
        case 'sinh': ast = call('cosh', z()); break;
        case 'cosh': ast = call('sinh', z()); break;
        case 'tanh': ast = div(one(), sq(call('cosh', z()))); break;
        case 'arcsin': case 'arccos': {
          const r = div(one(), call('sqrt', sub(one(), sq(z()))));
          ast = id === 'arcsin' ? r : neg(r);
          extra = '; principal branch, like the original';
          break;
        }
        case 'arctan': ast = div(one(), add(one(), sq(z()))); break;
        case 'arsinh': ast = div(one(), call('sqrt', add(sq(z()), one()))); extra = '; principal branch, like the original'; break;
        case 'arcosh': ast = div(one(), mul(call('sqrt', sub(z(), one())), call('sqrt', add(z(), one())))); extra = '; principal branch, like the original'; break;
        case 'artanh': ast = div(one(), sub(one(), sq(z()))); break;
        case 'joukowski': ast = sub(div(one(), real(2)), div(one(), mul(real(2), sq(z())))); break;
        case 'ijouk': {
          const s = () => mul(call('sqrt', sub(z(), one())), call('sqrt', add(z(), one())));
          const t = div(z(), s());
          // interior: 1 − z/s cancels for large |z| (it is ~1/(2z²)); since (z − s)(z + s) = 1 it equals −1/((z + s) s)
          if (v.branch === 'interior' && opts.stable) ast = neg(div(one(), mul(add(z(), s()), s())));
          else ast = v.branch === 'interior' ? sub(one(), t) : add(one(), t);
          extra = '; same branch as the original';
          break;
        }
        case 'conj': return { error: 'Conjugation z̄ is not holomorphic, so it has no complex derivative' };
        case 'poly': ast = polyAst(polyDer(CX.polyTrim(v.co))); break;
        case 'rational': {
          const p = CX.polyTrim(v.p), q = CX.polyTrim(v.q);
          if (q.length === 1) ast = polyAst(polyDer(p).map((c) => CX.div(c, q[0])));
          else ast = div(polyAst(polySub(polyMul(polyDer(p), q), polyMul(p, polyDer(q)))), sq(polyAst(q)));
          break;
        }
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
          if (b.usesCut) extra = `; same cut (${fmtDeg(cut)}°) as the original`;
          break;
        }
        default: return { error: `No derivative is known for ${b.def.label}` };
      }
      return { ast, cut, extra };
    } catch (e) {
      return { error: e.message };
    }
  }

  const DEFS = {};
  const def = (d) => { DEFS[d.id] = d; };

  // ---------------- Linear & Möbius ----------------
  def({
    id: 'mul', group: 'Linear & Möbius', label: 'Multiply by c', menuTex: 'c\\,z',
    params: [{ key: 'c', label: 'c', type: 'cx', def: '2' }],
    build({ c }) {
      const nz = !CX.isZero(c);
      return {
        f: (z) => CX.mul(c, z),
        hom: nz ? mobHom([c, C(0, 0), C(0, 0), C(1, 0)]) : null,
        tex: (a) => mulTex(c, a),
        props: nz ? props(ALL) : CONSTANT,
        inverse: nz ? { type: 'mul', params: { c: fmtC(CX.inv(c)) } } : null,
        inverseNote: nz ? null : NOTE_CONST,
      };
    },
  });
  def({
    id: 'add', group: 'Linear & Möbius', label: 'Translate by c', menuTex: 'z+c',
    params: [{ key: 'c', label: 'c', type: 'cx', def: '1' }],
    build({ c }) {
      return {
        f: (z) => CX.add(z, c),
        hom: (t) => (z) => CX.add(z, CX.scale(c, t)),
        tex: (a) => addTex(a, c),
        props: props(ALL),
        inverse: { type: 'add', params: { c: fmtC(CX.neg(c)) } },
      };
    },
  });
  def({
    id: 'affine', group: 'Linear & Möbius', label: 'Affine', menuTex: 'az+b',
    params: [{ key: 'a', label: 'a', type: 'cx', def: '1+i' }, { key: 'b', label: 'b', type: 'cx', def: '0' }],
    build({ a, b }) {
      const nz = !CX.isZero(a);
      return {
        f: (z) => CX.add(CX.mul(a, z), b),
        hom: nz ? mobHom([a, b, C(0, 0), C(1, 0)]) : null,
        tex: (x) => addTex(mulTex(a, x), b),
        props: nz ? props(ALL) : CONSTANT,
        inverse: nz ? { type: 'affine', params: { a: fmtC(CX.inv(a)), b: fmtC(CX.neg(CX.div(b, a))) } } : null,
        inverseNote: nz ? null : NOTE_CONST,
      };
    },
  });
  def({
    id: 'recip', group: 'Linear & Möbius', label: 'Inversion', menuTex: '1/z',
    params: [],
    build() {
      return {
        f: (z) => CX.inv(z),
        hom: mobHom([C(0, 0), C(1, 0), C(1, 0), C(0, 0)]),
        tex: (a) => ({ s: `\\frac{1}{${a.s}}`, p: 4 }),
        props: props({ analytic: true, rational: true, mobius: true, injective: true, deg: 1, degExact: true }),
        poles: [C(0, 0)],
        domain: (v) => `${v}\\neq 0`,
        inverse: { type: 'recip', params: {} },
      };
    },
  });
  function mobiusBuild(a, b, c, d) {
    if (CX.isZero(c) && CX.isZero(d)) throw new Error('Denominator is zero (c = d = 0)');
    const m = [a, b, c, d];
    const cz = CX.isZero(c);
    // ad − bc exactly 0: constant (away from the pole). Clearly nonzero against the scale of the entries
    // (scale invariant): a Möbius map. In between (10√2, 10, 20, 10√2, where rounding hides whether the exact
    // map is constant), claim only what holds either way.
    const degenerate = CX.mobDetZero(m);
    const mob = !degenerate && CX.mobRel(m) >= CX.MOB_EPS;
    const pole = cz ? null : CX.neg(CX.div(d, c));
    const P = degenerate ? props({ analytic: true, rational: true, deg: 0, degExact: true, constant: true, entire: cz, polynomial: cz })
      : mob ? props({ analytic: true, rational: true, mobius: true, injective: true, deg: 1, degExact: true, entire: cz, polynomial: cz, proper: cz })
        : props({ analytic: true, rational: true, deg: 1, degExact: false });
    return {
      f: (z) => CX.mobApply(m, z),
      hom: mob ? mobHom(m) : null,
      tex: (x) => {
        const num = addTex(mulTex(a, x), b);
        if (cz) {
          const dinv = CX.inv(d);
          return addTex(mulTex(CX.mul(a, dinv), x), CX.mul(b, dinv));
        }
        const den = addTex(mulTex(c, x), d);
        return { s: `\\frac{${num.s}}{${den.s}}`, p: 4 };
      },
      props: P,
      poles: pole ? [pole] : [],
      domain: pole ? (v) => `${v}\\neq ${CX.tex(pole)}` : null,
      inverse: !mob ? null : { type: 'mobius', params: { a: fmtC(d), b: fmtC(CX.neg(b)), c: fmtC(CX.neg(c)), d: fmtC(a) } },
      inverseNote: mob ? null : degenerate ? 'ad − bc = 0 makes this map constant, so it has no inverse'
        : 'ad − bc is too close to 0 to tell whether this map is invertible',
    };
  }
  def({
    id: 'mobius', group: 'Linear & Möbius', label: 'Möbius', menuTex: '\\frac{az+b}{cz+d}',
    params: [
      { key: 'a', label: 'a', type: 'cx', def: '1' }, { key: 'b', label: 'b', type: 'cx', def: '-i' },
      { key: 'c', label: 'c', type: 'cx', def: '1' }, { key: 'd', label: 'd', type: 'cx', def: 'i' },
    ],
    presets: [
      { label: 'Cayley  (z−i)/(z+i)', params: { a: '1', b: '-i', c: '1', d: 'i' } },
      { label: 'Inverse Cayley  i(1+z)/(1−z)', params: { a: 'i', b: 'i', c: '-1', d: '1' } },
      { label: 'Half-plane → disk  (z−1)/(z+1)', params: { a: '1', b: '-1', c: '1', d: '1' } },
      { label: 'Disk → right half-plane  (1+z)/(1−z)', params: { a: '1', b: '1', c: '-1', d: '1' } },
    ],
    build({ a, b, c, d }) { return mobiusBuild(a, b, c, d); },
  });
  def({
    id: 'blaschke', group: 'Linear & Möbius', label: 'Disk automorphism', menuTex: 'e^{i\\varphi}\\frac{z-a}{1-\\bar a z}',
    params: [{ key: 'a', label: 'a', type: 'cx', def: '0.5' }, { key: 'phi', label: 'φ', type: 'angle', def: 0 }],
    build({ a, phi }) {
      const e = C(Math.cos(phi * DEG), Math.sin(phi * DEG));
      const r = mobiusBuild(e, CX.neg(CX.mul(e, a)), CX.neg(CX.conj(a)), C(1, 0));
      const rot = Math.abs(phi) % 360 < 1e-12;
      const ra = CX.abs(a);
      if (ra >= 1) r.branchNote = ra === 1 ? '|a| = 1 makes this map degenerate' : '|a| > 1: this map swaps the disk with its exterior, so it is not an automorphism of the disk';
      r.tex = (x) => {
        const num = addTex(x, CX.neg(a));
        const ac = CX.conj(a);
        const den = CX.isZero(ac) ? { s: '1', p: 4 } : addTex(mulTex(CX.neg(ac), x), C(1, 0));
        const fr = CX.isZero(ac) ? num : { s: `\\frac{${num.s}}{${den.s}}`, p: 4 };
        return rot ? fr : { s: `e^{${CX.texNum(phi * DEG, 4)}i}${fr.p >= 4 ? fr.s : paren(fr.s)}`, p: 1 };
      };
      // the inverse is again a disk automorphism: a' = −e^{iφ} a, φ' = −φ
      if (r.inverse) r.inverse = { type: 'blaschke', params: { a: fmtC(CX.neg(CX.mul(e, a))), phi: phi === 0 ? 0 : -phi } };
      else if (ra === 1) r.inverseNote = '|a| = 1 makes this map constant, so it has no inverse';
      return r;
    },
  });

  // ---------------- Powers & roots ----------------
  def({
    id: 'pown', group: 'Powers & roots', label: 'Integer power', menuTex: 'z^n',
    // |n| <= 4096, like an integer exponent in a custom formula: z^n is computed exactly as labelled
    params: [{ key: 'n', label: 'n', type: 'int', def: 2, min: -4096, max: 4096 }],
    build({ n }) {
      const an = Math.abs(n);
      let P;
      if (n === 0) P = CONSTANT;
      else if (n > 0) P = props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: n === 1, mobius: n === 1, deg: n, degExact: true });
      else P = props({ analytic: true, rational: true, injective: n === -1, mobius: n === -1, deg: an, degExact: true });
      let hom;
      if (n >= 0) hom = powHom(C(n, 0), PI, 0);
      else {
        const h1 = powHom(C(an, 0), PI, 0), inv = mobHom([C(0, 0), C(1, 0), C(1, 0), C(0, 0)]);
        hom = (t) => {
          if (t < 0.5) return h1(2 * t);
          const g = inv(2 * t - 1);
          return (z) => g(CX.ipow(z, an));
        };
      }
      let inverse = null;
      if (n >= 2) inverse = { type: 'root', params: { n, cut: 180, k: 0 } };
      else if (n === 1 || n === -1) inverse = { type: 'pown', params: { n } };
      else if (n <= -2) inverse = { type: 'powa', params: { alpha: fmtC(C(1 / n, 0)), cut: 180, k: 0 } };
      return {
        inverseNote: n === 0 ? 'z⁰ = 1 is constant, so it has no inverse' : null,
        f: (z) => CX.ipow(z, n),
        hom, props: P,
        tex: (a) => (n === 1 ? a : n === 0 ? { s: '1', p: 4 } : n < 0 ? { s: `\\frac{1}{${an === 1 ? a.s : atom(a) + '^{' + an + '}'}}`, p: 4 } : powTex(a, n)),
        poles: n < 0 ? [C(0, 0)] : [],
        domain: n < 0 ? (v) => `${v}\\neq 0` : null,
        inverse,
      };
    },
  });
  def({
    id: 'root', group: 'Powers & roots', label: 'n-th root', menuTex: '\\sqrt[n]{z}', hasCut: true,
    params: [{ key: 'n', label: 'n', type: 'int', def: 2, min: 2 }, ...cutParams],
    build({ n, cut, k }) {
      n = Math.max(2, n);
      const th = cut * DEG;
      const kk = ((k % n) + n) % n;
      return {
        f: (z) => CX.powReal(z, 1 / n, th, kk),
        hom: powHom(C(1 / n, 0), th, kk),
        tex: (a) => ({ s: n === 2 ? `\\sqrt{${a.s}}` : `\\sqrt[${n}]{${a.s}}`, p: 4 }),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: `sheet ${kk} of ${n}`,
        inverse: { type: 'pown', params: { n } },
      };
    },
  });
  def({
    id: 'powa', group: 'Powers & roots', label: 'Complex power', menuTex: 'z^{\\alpha}', hasCut: true,
    params: [{ key: 'alpha', label: 'α', type: 'cx', def: '1.5' }, ...cutParams],
    build({ alpha, cut, k }) {
      const th = cut * DEG;
      const a2 = CX.abs2(alpha);
      const inj = a2 > 0 && Math.abs(alpha.re) >= a2;
      // Inverse z^{1/α} on the branch that undoes this one. Log here has arg in (φ − 360°, φ] with
      // φ = cut + 360k, so z^α has arg α·(that range). For real α > 0 the inverse's arg range ends at αφ; for α < 0
      // the range flips and ends at αφ + 360·min(1, |α|). Then f(f⁻¹(w)) = w when |α| ≥ 1, and f⁻¹(f(z)) = z
      // when |α| ≤ 1 (the injective case). A complex α would need a spiral cut: no inverse is offered.
      let inverse = null;
      if (a2 > 0 && alpha.im === 0) {
        const al = alpha.re, phi = cut + 360 * k;
        const X = al > 0 ? al * phi : al * phi + 360 * Math.min(1, -al);
        const k2 = Math.ceil((X - 180) / 360);
        inverse = { type: 'powa', params: { alpha: fmtC(C(1 / al, 0)), cut: +(X - 360 * k2).toFixed(9), k: k2 } };
      }
      return {
        inverseNote: inverse ? null : a2 === 0 ? 'z⁰ = 1 is constant, so it has no inverse'
          : 'A complex exponent winds around 0, so its inverse would need a spiral branch cut; use the Preimage view',
        f: (z) => CX.pow(z, alpha, th, k),
        hom: powHom(alpha, th, k),
        tex: (a) => powTex(a, CX.tex(alpha)),
        props: props({ analytic: true, injective: inj }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: `sheet ${k}`,
        inverse,
      };
    },
  });

  // ---------------- Exponential ----------------
  def({
    id: 'exp', group: 'Exponential & log', label: 'Exponential', menuTex: 'e^{z}',
    params: [],
    build() {
      return {
        f: CX.exp,
        hom: (t) => {
          if (t < 1e-6) return (z) => z;
          return (z) => CX.add(CX.scale(CX.sub(CX.exp(CX.scale(z, t)), C(1, 0)), 1 / t), C(t, 0));
        },
        tex: (a) => ({ s: `e^{${a.s}}`, p: 3 }),
        props: props({ analytic: true, entire: true }),
        inverse: { type: 'log', params: { cut: 180, k: 0 } },
      };
    },
  });
  def({
    id: 'log', group: 'Exponential & log', label: 'Logarithm', menuTex: '\\log z', hasCut: true,
    params: [...cutParams],
    build({ cut, k }) {
      const th = cut * DEG;
      return {
        f: (z) => CX.log(z, th, k),
        hom: (t) => {
          const u = 1 - t;
          if (u < 1e-6) return (z) => CX.log(z, th, k);
          return (z) => CX.add(CX.scale(CX.sub(CX.powReal(z, u, th, k), C(1, 0)), 1 / u), C(u, 0));
        },
        tex: (a) => fn('\\log', a),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: `Im ∈ (${fmtDeg(cut - 360 + 360 * k)}°, ${fmtDeg(cut + 360 * k)}°]`,
        inverse: { type: 'exp', params: {} },
      };
    },
  });

  // ---------------- Trigonometric ----------------
  const trig = [
    ['sin', 'Sine', '\\sin', CX.sin, true, 'arcsin'],
    ['cos', 'Cosine', '\\cos', CX.cos, true, 'arccos'],
    ['tan', 'Tangent', '\\tan', CX.tan, false, 'arctan'],
    ['sinh', 'Hyperbolic sine', '\\sinh', CX.sinh, true, 'arsinh'],
    ['cosh', 'Hyperbolic cosine', '\\cosh', CX.cosh, true, 'arcosh'],
    ['tanh', 'Hyperbolic tangent', '\\tanh', CX.tanh, false, 'artanh'],
  ];
  for (const [id, label, tx, F, entire, invId] of trig) {
    def({
      id, group: 'Trigonometric', label, menuTex: `${tx} z`, params: [],
      build() {
        const r = {
          f: F, hom: linHom(F), tex: (a) => fn(tx, a),
          props: props({ analytic: true, entire }),
          inverse: { type: invId, params: {} },
        };
        if (id === 'tan') r.domain = (v) => `\\cos ${v}\\neq 0`;
        if (id === 'tanh') r.domain = (v) => `\\cosh ${v}\\neq 0`;
        return r;
      },
    });
  }
  const R = (p, ang) => ({ kind: 'ray', p, ang, editable: false });
  const realCuts = [R(C(1, 0), 0), R(C(-1, 0), PI)];
  const imagCuts = [R(C(0, 1), PI / 2), R(C(0, -1), -PI / 2)];
  const itrig = [
    ['arcsin', 'Arcsine', '\\arcsin', CX.asin, realCuts, 'sin', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
    ['arccos', 'Arccosine', '\\arccos', CX.acos, realCuts, 'cos', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
    ['arctan', 'Arctangent', '\\arctan', CX.atan, imagCuts, 'tan', (v) => `${v}\\notin i(-\\infty,-1]\\cup i[1,\\infty)`],
    ['arsinh', 'Inverse sinh', '\\operatorname{arsinh}', CX.asinh, imagCuts, 'sinh', (v) => `${v}\\notin i(-\\infty,-1]\\cup i[1,\\infty)`],
    ['arcosh', 'Inverse cosh', '\\operatorname{arcosh}', CX.acosh, [R(C(1, 0), PI)], 'cosh', (v) => `${v}\\notin(-\\infty,1]`],
    ['artanh', 'Inverse tanh', '\\operatorname{artanh}', CX.atanh, realCuts, 'tanh', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
  ];
  for (const [id, label, tx, F, cuts, invId, dom] of itrig) {
    def({
      id, group: 'Inverse trigonometric', label, menuTex: `${tx} z`, params: [],
      build() {
        return {
          f: F, hom: linHom(F), tex: (a) => fn(tx, a),
          props: props({ analytic: true, injective: true }),
          cuts, domain: dom, branchNote: 'principal branch',
          inverse: { type: invId, params: {} },
        };
      },
    });
  }

  // ---------------- Special ----------------
  def({
    id: 'joukowski', group: 'Special', label: 'Joukowski', menuTex: '\\tfrac12\\left(z+\\tfrac1z\\right)', params: [],
    build() {
      const f = (z) => CX.scale(CX.add(z, CX.inv(z)), 0.5);
      return {
        f, hom: linHom(f),
        tex: (a) => ({ s: `\\frac{1}{2}\\left(${a.s}+\\frac{1}{${a.s}}\\right)`, p: 1 }),
        props: props({ analytic: true, rational: true, proper: true, deg: 2, degExact: true }),
        poles: [C(0, 0)], domain: (v) => `${v}\\neq 0`,
        inverse: { type: 'ijouk', params: { branch: 'exterior' } },
      };
    },
  });
  def({
    id: 'ijouk', group: 'Special', label: 'Inverse Joukowski', menuTex: 'z\\pm\\sqrt{z^2-1}',
    params: [{ key: 'branch', label: 'branch', type: 'choice', def: 'exterior', choices: [['exterior', '|w| > 1'], ['interior', '|w| < 1']] }],
    build({ branch }) {
      const sg = branch === 'interior' ? -1 : 1;
      const f = (z) => CX.ijouk(z, sg);   // z + sg s, the interior branch as 1 / (z + s) (no cancellation)
      return {
        f, hom: linHom(f),
        // exactly what is evaluated: z ± √(z−1)·√(z+1) with principal roots (not √(z²−1), which differs on Re z < 0)
        tex: (a) => ({ s: `${a.s}${sg > 0 ? '+' : '-'}\\sqrt{${a.s}-1}\\,\\sqrt{${a.s}+1}`, p: 0 }),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'seg', a: C(-1, 0), b: C(1, 0) }],
        domain: (v) => `${v}\\notin[-1,1]`, branchNote: branch === 'interior' ? 'image in the unit disk' : 'image outside the unit disk',
        inverse: { type: 'joukowski', params: {} },
      };
    },
  });
  def({
    id: 'conj', group: 'Special', label: 'Conjugation', menuTex: '\\bar z', params: [],
    build() {
      return {
        f: CX.conj,
        hom: (t) => (z) => C(z.re, z.im * (1 - 2 * t)),
        tex: (a) => ({ s: `\\overline{${a.s}}`, p: 4 }),
        props: props({ proper: true, injective: true }),
        inverse: { type: 'conj', params: {} },
      };
    },
  });

  // ---------------- Polynomial, rational, custom ----------------
  def({
    id: 'poly', group: 'Polynomial & custom', label: 'Polynomial', menuTex: 'a_nz^n+\\dots+a_0',
    params: [{ key: 'co', label: 'coefficients aₙ, …, a₀', type: 'coeffs', def: '1, 0, -1, 0' }],
    build({ co }) {
      const c = CX.polyTrim(co);
      const d = c.length - 1;
      const P = d === 0 ? CONSTANT : props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: d === 1, mobius: d === 1, deg: d, degExact: true });
      return {
        f: (z) => CX.polyEval(c, z), hom: linHom((z) => CX.polyEval(c, z)),
        tex: (a) => polyTex(c, a), props: P,
        ...polyInverse(c),
      };
    },
  });
  def({
    id: 'rational', group: 'Polynomial & custom', label: 'Rational', menuTex: '\\frac{p(z)}{q(z)}',
    params: [{ key: 'p', label: 'numerator p: coefficients', type: 'coeffs', def: '1, 0, 1' }, { key: 'q', label: 'denominator q: coefficients', type: 'coeffs', def: '1, 0' }],
    build({ p, q }) {
      p = CX.polyTrim(p); q = CX.polyTrim(q);
      const dp = p.length - 1, dq = q.length - 1;
      const f = (z) => CX.div(CX.polyEval(p, z), CX.polyEval(q, z));
      if (q.length === 1 && CX.isZero(q[0])) throw new Error('Denominator is zero');
      const pZero = p.length === 1 && CX.isZero(p[0]);
      let coprime = false, poles = [];
      if (dq === 0) coprime = true;
      else {
        // the exact degree max(dp, dq) is claimed only when no root of q can also be a root of p
        const t = coprimeTest(p, q, CX.polyRoots(q));
        coprime = t.coprime;
        poles = t.centers;
      }
      const deg = Math.max(dp, dq);
      let P;
      if (pZero) P = props({ analytic: true, rational: true, deg: 0, degExact: true, constant: true, entire: dq === 0, polynomial: dq === 0 });
      else if (dq === 0) {
        P = dp === 0 ? CONSTANT : props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: dp === 1, mobius: dp === 1, deg: dp, degExact: true });
      } else {
        P = props({ analytic: true, rational: true, deg, degExact: coprime });
        if (coprime) {
          P.proper = dp > dq;
          P.injective = P.mobius = deg === 1;
          if (deg === 0) P.constant = true;
        }
      }
      return {
        f, hom: linHom(f),
        tex: (a) => ({ s: `\\frac{${polyTex(p, a).s}}{${polyTex(q, a).s}}`, p: 4 }),
        props: P, poles, domain: dq > 0 ? (v) => `q(${v})\\neq 0` : null,
        ...rationalInverse(p, q, P),
      };
    },
  });
  def({
    id: 'custom', group: 'Polynomial & custom', label: 'Custom formula', menuTex: 'f(z)\\ \\text{(LaTeX)}',
    params: [{ key: 'expr', label: 'f(z) =', type: 'expr', def: 'z^2+\\frac{1}{z}' }, { key: 'cut', label: 'cut angle for log, √, powers', type: 'angle', def: 180 }],
    hasCut: 'maybe',
    build({ expr, cut }) {
      const ast = Expr.parse(expr);
      if (Expr.hasBool(ast)) throw new Error('A function cannot contain comparisons');
      const vars = Expr.usesVars(ast);
      for (const v of vars) if (v !== 'z') throw new Error(`Use z (or w) as the variable${v === 'x' || v === 'y' ? '; write Re z, Im z for real parts' : ''}`);
      const th = cut * DEG;
      const f = Expr.compile(ast, { theta: th });
      // a formula that is undefined at every generic point (z/0, log 0, ...) is an error, not a map
      const probes = [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2), C(0.9, 0.05)];
      if (!probes.some((p) => CX.isFin(f(p)))) throw new Error('The formula is undefined for every z (check for a division by zero or a logarithm of 0)');
      const cls = Expr.classify(ast);
      let P;
      if (!cls.dep) P = CONSTANT;
      else {
        P = props({ analytic: cls.analytic, entire: cls.entire, rational: cls.rational, polynomial: cls.poly });
        if (cls.poly) {
          // exact expansion into coefficients: the degree is claimed exact only when no coefficient above the
          // highest certainly nonzero one may be nonzero; otherwise only deg ≤ (cls.deg is an upper bound too)
          const e = Expr.polyDegree(ast, 4096);
          if (e && e.lo === e.hi) {
            const d = Math.max(0, e.hi);
            P.deg = d; P.degExact = true;
            if (d === 0) { P.constant = true; }
            else { P.proper = true; P.injective = P.mobius = d === 1; }
          } else {
            P.deg = e ? e.hi : cls.deg; P.degExact = false;
            P.proper = !!e && e.lo >= 1;
          }
        }
      }
      return {
        f, hom: linHom(f),
        tex: (a) => Expr.toTex(ast, a),
        props: P,
        usesCut: cls.branch,
        domain: cls.branch ? (v) => `${v}\\ \\text{off the branch cuts of the formula}` : (cls.entire ? null : (v) => `\\text{the formula is defined at } ${v}`),
        branchNote: cls.branch ? `log, √ and powers use arg ∈ (${fmtDeg(cut - 360)}°, ${fmtDeg(cut)}°]` : null,
        ...customInverse(ast, th),
      };
    },
  });

  // ---------------- Calculus: d/dz, an operator on the chain so far ----------------
  // Stage maps G_k are functions of z: G_0(z) = z, G_k = f_k ∘ G_{k−1} for a map, G_k = (G_{k−1})′ for d/dz. A d/dz
  // step is not a map of w_{k−1}: f and the homotopy are NaN (callers use the stage functions, stageFunctions).
  const NAN_F = () => C(NaN, NaN);
  const plainVar = (s) => /^(?:z|w_\{?\d+\}?)$/.test(s);
  def({
    id: 'deriv', group: 'Calculus', label: 'd/dz', menuTex: '\\frac{d}{dz}', params: [], op: 'deriv',
    build() {
      return {
        op: 'deriv',
        f: NAN_F, hom: null,
        tex: (a) => (plainVar(a.s) ? { s: `\\frac{d${a.s === 'z' ? '' : ' '}${a.s}}{dz}`, p: 4 } : { s: `\\frac{d}{dz}\\left(${a.s}\\right)`, p: 3 }),
        props: Object.assign(props(), { deriv: true }),
        cuts: [], poles: [], domain: null,
        inverse: null,
        inverseNote: 'd/dz differentiates the chain so far; it is not a map of w, so it has no inverse',
      };
    },
  });

  const GROUPS = ['Linear & Möbius', 'Powers & roots', 'Exponential & log', 'Trigonometric', 'Inverse trigonometric', 'Special', 'Polynomial & custom', 'Calculus'];

  function defaults(type) {
    const d = DEFS[type];
    const p = {};
    for (const q of d.params) p[q.key] = q.def;
    return p;
  }

  // A composite formula is built by feeding each step's TeX into the next. A step that writes its argument twice
  // (Möbius, Joukowski, a polynomial) doubles the length, so a long chain grew without bound (60 steps of sin and
  // Möbius: a RangeError). Past TEX_CAP characters the next step stops composing: it passes the text on with a note
  // that the later steps are left out, marked .cut, and every later step passes it on unchanged (still longer than
  // the app's 700-character limit, so the app lists the steps one by one instead).
  const TEX_CAP = 6000;
  const TEX_CUT_NOTE = '\\quad\\text{(truncated: the expanded formula is too long, so the later steps are left out)}';
  function capTex(tex) {
    return (a) => {
      if (a && a.cut) return a;
      if (a && typeof a.s === 'string' && a.s.length > TEX_CAP) return { s: a.s + TEX_CUT_NOTE, p: 0, cut: true };
      return tex(a);
    };
  }
  // Evaluate raw params and build. Returns built object or {error}.
  function build(step) {
    const d = DEFS[step.type];
    if (!d) return { error: `Unknown function ${step.type}` };
    const v = {};
    try {
      for (const q of d.params) {
        const raw = step.params[q.key] ?? q.def;
        switch (q.type) {
          case 'cx': try { v[q.key] = Expr.constValue(raw); } catch (e) { throw new Error(`${q.label}: ${e.message}`); } break;
          case 'int': {
            const x = Math.round(Number(raw));
            if (!Number.isFinite(x)) throw new Error(`${q.label} must be an integer`);
            v[q.key] = Math.min(q.max ?? Infinity, Math.max(q.min ?? -Infinity, x));
            break;
          }
          case 'angle': { const x = Number(raw); if (!Number.isFinite(x)) throw new Error(`${q.label} must be a number`); v[q.key] = x; break; }
          case 'coeffs': try { v[q.key] = parseCoeffs(raw); } catch (e) { throw new Error(`${q.label}: ${e.message}`); } break;
          default: v[q.key] = raw;
        }
      }
      // a cut at θ + 360m on sheet k is the cut at θ on sheet k + m: normalise θ into (−180°, 180°] and carry the
      // turns into k, so (cut, k) names the evaluated branch uniquely and a θ outside that range keeps its values
      if (Number.isFinite(v.cut) && Number.isInteger(v.k)) {
        const m = Math.ceil((v.cut - 180) / 360);
        if (m) { v.cut -= 360 * m; v.k += m; }
        if (Number.isInteger(v.n) && d.id === 'root') { const n = Math.max(2, v.n); v.k = ((v.k % n) + n) % n; }
      }
      const b = d.build(v);
      if (typeof b.tex === 'function') b.tex = capTex(b.tex);
      b.def = d;
      b.vals = v;
      b.cuts = b.cuts || [];
      b.poles = b.poles || [];
      return b;
    } catch (e) {
      return { error: e.message, def: d };
    }
  }

  // B ∘ A for the props of two maps (A applied first)
  function compose2(A, B) {
    const r = props();
    for (const k of PROP_KEYS) r[k] = !!(A[k] && B[k]);
    r.constant = !!(A.constant || B.constant);
    if (r.rational && A.deg != null && B.deg != null) {
      r.deg = A.deg * B.deg;
      r.degExact = !!(A.degExact && B.degExact) || (r.deg === 0 && ((A.deg === 0 && !!A.degExact) || (B.deg === 0 && !!B.degExact)));
    }
    return r;
  }
  // What is guaranteed for F′ given what is guaranteed for F. Holomorphy (on the same domain), entire, rational and
  // polynomial carry over. A polynomial of degree d (exact or an upper bound) has a derivative of degree d − 1 (same
  // kind); a rational map of degree ≤ d has a derivative of degree ≤ 2d ((p′q − pq′)/q²); a constant's is 0. Proper
  // only for a polynomial of exact degree ≥ 2 (F′ then has exact degree ≥ 1), Möbius and injective only for exact
  // degree 2 (F′ is then az + b with a ≠ 0). Nothing else is claimed.
  function derivProps(P) {
    const r = props({ analytic: !!P.analytic, entire: !!P.entire, rational: !!P.rational, polynomial: !!P.polynomial });
    if (!r.analytic) return props(); // F′ of a map that is not holomorphic (z̄, |z|) is not a complex derivative
    const polyExact = r.polynomial && P.degExact && P.deg != null;
    if (P.constant || (polyExact && P.deg <= 1)) {
      r.constant = true;
      if (r.rational) { r.deg = 0; r.degExact = true; }
      return r;
    }
    if (r.polynomial && P.deg != null) { r.deg = Math.max(0, P.deg - 1); r.degExact = !!P.degExact; }
    else if (r.rational && P.deg != null) { r.deg = 2 * P.deg; r.degExact = false; }
    if (polyExact && P.deg >= 2) r.proper = true;
    if (polyExact && P.deg === 2) r.mobius = r.injective = true;
    return r;
  }
  // Props of the chain: a left fold over the active steps' props, a d/dz entry ({deriv: true}) mapping the props so
  // far to those of their derivative.
  function composeProps(list) {
    let acc = props(ALL);
    for (const p of list) acc = p && p.deriv ? derivProps(acc) : compose2(acc, p || props());
    return acc;
  }

  // ---------------- stage functions (CPU) ----------------
  const isLive = (steps, built, k) => {
    const st = steps[k - 1], b = built[k - 1];
    return !!st && st.on !== false && !!b && !b.error && !!b.def;
  };
  // f′ of one built step as a CPU function of its input, or null (no derivative is known)
  const derivFnCache = new WeakMap();
  function stepDerivFn(b) {
    if (derivFnCache.has(b)) return derivFnCache.get(b);
    let f = null;
    const d = derivAst(b, { stable: true });
    if (!d.error) { try { f = Expr.compile(d.ast, { theta: d.cut * DEG }); } catch (e) { f = null; } }
    derivFnCache.set(b, f);
    return f;
  }
  // the 8th roots of unity, exactly as on the GPU
  const H2 = Math.SQRT1_2;
  const U8 = [C(1, 0), C(H2, H2), C(0, 1), C(-H2, H2), C(-1, 0), C(-H2, -H2), C(0, -1), C(H2, -H2)];
  // G′(z) by the circle formula (1/(N r)) Σ_j G(z + r ω^j) ω^{−j}, N = 8, r = rel (1 + |z|): the Cauchy integral by
  // the trapezoid rule, exact up to the Taylor terms of order 9, 17, ... (r⁸ a₉) and rounding (eps |G| / r)
  function circleAt(g, z, rel) {
    const r = rel * (1 + Math.hypot(z.re, z.im));
    let sr = 0, si = 0;
    for (const u of U8) {
      const w = g(C(z.re + r * u.re, z.im + r * u.im));
      sr += w.re * u.re + w.im * u.im; si += w.im * u.re - w.re * u.im;
    }
    return C(sr / (8 * r), si / (8 * r));
  }
  // radius of a circle formula whose input carries L − 1 circle formulas already (L = 1: an exact G)
  const CIRCLE_REL = 1e-3, CIRCLE_GROW = 4;
  const circleRel = (L) => CIRCLE_REL * Math.pow(CIRCLE_GROW, Math.max(0, L - 1));
  // Funcs.stageFunctions(steps, built) -> [G_0, ..., G_n], CPU functions of z: G_0(z) = z, G_k = f_k ∘ G_{k−1} for a
  // map, G_{k−1} itself for a bypassed or failed step, and G_k = G_{k−1}′ for a d/dz step: by the exact chain rule
  // Π f_j′(w_{j−1}) while no d/dz precedes (and every step has a known derivative), else by the circle formula.
  // G.levels[k] is the circle nesting level of stage k (0: exact). opts (for tests that model the GPU):
  // circleRel(L) replaces the radius rule, exact: false forbids the exact chain rule.
  function stageFunctions(steps, built, opts = {}) {
    const relOf = opts.circleRel || circleRel;
    const G = [(z) => z];
    const levels = [0];
    let seenD = false, L = 0;
    const pre = []; // live maps before the first d/dz
    for (let k = 1; k <= steps.length; k++) {
      const b = built[k - 1];
      if (!isLive(steps, built, k)) { G.push(G[k - 1]); levels.push(L); continue; }
      if (b.op === 'deriv') {
        const prev = G[k - 1];
        let g = null;
        if (!seenD && opts.exact !== false) {
          const ders = pre.map(stepDerivFn);
          if (ders.every(Boolean)) {
            const fs = pre.map((x) => x.f);
            g = (z) => {
              let D = C(1, 0);
              for (let j = 0; j < fs.length; j++) { D = CX.mul(D, ders[j](z)); z = fs[j](z); }
              return D;
            };
            L = 0;
          }
        }
        if (!g) { L += 1; const rel = relOf(L); g = (z) => circleAt(prev, z, rel); }
        seenD = true;
        G.push(g);
      } else {
        if (!seenD) pre.push(b);
        const prev = G[k - 1], f = b.f;
        G.push((z) => f(prev(z)));
      }
      levels.push(L);
    }
    G.levels = levels;
    return G;
  }

  // ---------------- whole Riemann surfaces: local cuts, every sheet ----------------
  // Each multivalued piece (an n-th root, log, a complex power, a branch node of a custom formula) is evaluated with
  // a LOCAL cut opposite the cell centre zc (cut angle = arg of the piece's input at zc + 180°, so the cut never
  // crosses the cell) and on a chosen sheet. Over all sheets the union of the cells is the covering surface.
  const SHEET_MAX = 24;
  // branches of z^s: q for a real s = p/q (q ≤ 24; 1 for an integer), 0 (infinitely many: a window) otherwise
  function sheetCount(s) {
    if (typeof s === 'number') s = C(s, 0);
    if (!s || s.im !== 0 || !Number.isFinite(s.re)) return 0;
    for (let q = 1; q <= SHEET_MAX; q++) {
      const y = s.re * q;
      if (Math.abs(y - Math.round(y)) <= 1e-9 * Math.max(1, Math.abs(y))) return q;
    }
    return 0;
  }
  const constOf = (n) => Expr.compile(n)(C(0, 0));
  // how a node of a custom formula depends on the branch: null (single-valued, as constants, integer powers and
  // c^{g(z)} with the principal log of c), else {kind, n} (n sheets, 0: infinitely many)
  function branchNode(n) {
    if (!Expr.depends(n)) return null;
    if (n.t === 'call' && n.f === 'log') return { kind: 'log', n: 0 };
    if (n.t === 'call' && n.f === 'sqrt') return { kind: 'sqrt', n: 2 };
    if (n.t === 'root') { const s = CX.div(CX.ONE, constOf(n.n)); return { kind: 'root', s, n: sheetCount(s) }; }
    if (n.t === 'pow') {
      if (!Expr.depends(n.b)) {
        const v = constOf(n.b);
        if (v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096) return null;
        return { kind: 'powc', v, n: sheetCount(v) };
      }
      if (!Expr.depends(n.a)) return null;
      return { kind: 'powv', n: 0 };
    }
    return null;
  }
  // pair evaluator of a custom formula for the sheet view: f(c, w, S) -> [value at c, value at w], every branch node
  // on the local cut opposite its input at c and on sheet S[i] (i: the node's index in evaluation order, children
  // first, a before b). Mirrors Expr.compile node by node. nodes: [{kind, n}].
  function pairCompile(ast, theta) {
    const nodes = [];
    const cutOf = (c) => Math.atan2(c.im, c.re) + PI;
    function go(n) {
      if (!Expr.depends(n)) { const v = constOf(n); return () => [v, v]; }
      switch (n.t) {
        case 'var': { const f = Expr.compile(n); return (c, w) => [f(c), f(w)]; }
        case 'neg': { const A = go(n.a); return (c, w, S) => { const a = A(c, w, S); return [CX.neg(a[0]), CX.neg(a[1])]; }; }
        case 'add': case 'sub': case 'mul': case 'div': {
          const A = go(n.a), B = go(n.b), op = CX[n.t];
          return (c, w, S) => { const a = A(c, w, S), b = B(c, w, S); return [op(a[0], b[0]), op(a[1], b[1])]; };
        }
        case 'pow': {
          const bn = branchNode(n);
          if (!Expr.depends(n.b)) {
            const A = go(n.a);
            if (!bn) { const k = constOf(n.b).re; return (c, w, S) => { const a = A(c, w, S); return [CX.ipow(a[0], k), CX.ipow(a[1], k)]; }; }
            const i = nodes.push(bn) - 1, v = bn.v;
            return (c, w, S) => { const a = A(c, w, S), th = cutOf(a[0]), s = S[i]; return [CX.pow(a[0], v, th, s), CX.pow(a[1], v, th, s)]; };
          }
          if (!Expr.depends(n.a)) {
            const B = go(n.b), base = constOf(n.a);
            if (base.re === Math.E && base.im === 0) return (c, w, S) => { const b = B(c, w, S); return [CX.exp(b[0]), CX.exp(b[1])]; };
            const Lg = CX.log(base);
            return (c, w, S) => { const b = B(c, w, S); return [CX.exp(CX.mul(b[0], Lg)), CX.exp(CX.mul(b[1], Lg))]; };
          }
          const A = go(n.a), B = go(n.b);
          const i = nodes.push(bn) - 1;
          return (c, w, S) => { const a = A(c, w, S), b = B(c, w, S), th = cutOf(a[0]), s = S[i]; return [CX.pow(a[0], b[0], th, s), CX.pow(a[1], b[1], th, s)]; };
        }
        case 'root': {
          const A = go(n.a), bn = branchNode(n), i = nodes.push(bn) - 1, s1 = bn.s;
          return (c, w, S) => { const a = A(c, w, S), th = cutOf(a[0]), s = S[i]; return [CX.pow(a[0], s1, th, s), CX.pow(a[1], s1, th, s)]; };
        }
        case 'call': {
          const A = go(n.a);
          if (n.f === 'log' || n.f === 'sqrt') {
            const i = nodes.push(branchNode(n)) - 1, lg = n.f === 'log';
            return (c, w, S) => {
              const a = A(c, w, S), th = cutOf(a[0]), s = S[i];
              return lg ? [CX.log(a[0], th, s), CX.log(a[1], th, s)] : [CX.powReal(a[0], 0.5, th, s), CX.powReal(a[1], 0.5, th, s)];
            };
          }
          const F = Expr.compile({ t: 'call', f: n.f, a: { t: 'var', n: 'z' } }, { theta });
          return (c, w, S) => { const a = A(c, w, S); return [F(a[0]), F(a[1])]; };
        }
      }
      throw new Error(`Cannot evaluate '${n.t}'`);
    }
    const f = go(ast);
    return { f, nodes };
  }
  const pairCache = new WeakMap();
  function pairOf(b) {
    if (!pairCache.has(b)) pairCache.set(b, pairCompile(Expr.parse(b.vals.expr), b.vals.cut * DEG));
    return pairCache.get(b);
  }
  // the multivalued pieces of one built step, in the order their sheet digits are read: [{n}] (n sheets, 0: a
  // window of 2W + 1 sheets, 1: single-valued after all, e.g. an integer exponent)
  function stepSheets(b) {
    if (!b || b.error || !b.def || b.op === 'deriv') return [];
    const id = b.def.id, v = b.vals;
    if (id === 'root') { const n = Math.max(2, v.n); return [{ n: n <= SHEET_MAX ? n : 0 }]; }
    if (id === 'powa') return [{ n: sheetCount(v.alpha) }];
    if (id === 'log') return [{ n: 0 }];
    if (id === 'custom') { try { return pairOf(b).nodes.map((x) => ({ n: x.n })); } catch (e) { return []; } }
    return [];
  }
  // Funcs.sheetSteps(steps, built) -> [{k, n, node}]: the multivalued pieces of the live steps (n sheets, 0 for
  // infinitely many); node is the index of the branch node within a custom formula (0 otherwise)
  function sheetSteps(steps, built) {
    const out = [];
    for (let k = 1; k <= steps.length; k++) {
      if (!isLive(steps, built, k)) continue;
      stepSheets(built[k - 1]).forEach((e, node) => { if (e.n !== 1) out.push({ k, n: e.n, node }); });
    }
    return out;
  }
  // number of surfaces of the steps in (a, b] with window W: the product of the sheet counts (2W + 1 for an infinite
  // one); cap: at most SHEET_MAX (pass Infinity for the raw product)
  function sheetCombos(steps, built, W = 2, b = steps.length, cap = SHEET_MAX, a = 0) {
    let p = 1;
    for (const e of sheetSteps(steps, built)) if (e.k > a && e.k <= b) p *= e.n > 0 ? e.n : 2 * W + 1;
    return Math.min(p, cap);
  }
  // Funcs.sheetEval(steps, built, b, zc, z, combo, W) -> G_b(z) on surface number combo of the cell centred at zc.
  // combo is read as mixed-radix digits, lowest first, one per multivalued piece of the live steps 1..b in chain
  // order (sheetSteps; within a custom formula in evaluation order): radix n for n sheets (sheet = digit), 2W + 1 for
  // infinitely many (sheet = digit − W). A d/dz step differentiates the stage before it on the same surface by the
  // circle formula. Mirrored on the GPU by chainSheet. opts.a > 0: the steps in (a, b] only, z and zc points of the
  // w_a-plane, digits for their pieces only (GPU: chainSheetRange); NaN when a d/dz lies in (a, b].
  function sheetEval(steps, built, b, zc, z, combo = 0, W = 2, opts = {}) {
    const relOf = opts.circleRel || circleRel;
    b = Math.max(0, Math.min(b | 0, steps.length));
    const a0 = Math.max(0, Math.min(opts.a | 0, b));
    const S = [];
    let c = Math.max(0, Math.floor(+combo || 0));
    if (a0 > 0) for (let k = a0 + 1; k <= b; k++) if (isLive(steps, built, k) && built[k - 1].op === 'deriv') return C(NaN, NaN);
    for (let k = a0 + 1; k <= b; k++) {
      if (!isLive(steps, built, k)) continue;
      S[k] = stepSheets(built[k - 1]).map((e) => {
        const r = e.n > 0 ? e.n : 2 * W + 1;
        const d = c % r;
        c = Math.floor(c / r);
        return e.n > 0 ? d : d - W;
      });
    }
    // circle levels of the d/dz steps (every d/dz is a circle formula here)
    const lev = [];
    let L = 0;
    for (let k = 1; k <= b; k++) if (isLive(steps, built, k) && built[k - 1].op === 'deriv') lev[k] = ++L;
    function step(k, pr) {
      const bb = built[k - 1], id = bb.def.id, s = S[k];
      const c0 = pr[0], w0 = pr[1];
      if (id === 'root' || id === 'powa' || id === 'log') {
        const th = Math.atan2(c0.im, c0.re) + PI, sh = s[0];
        if (id === 'root') { const e = 1 / Math.max(2, bb.vals.n); return [CX.powReal(c0, e, th, sh), CX.powReal(w0, e, th, sh)]; }
        if (id === 'powa') { const a = bb.vals.alpha; return [CX.pow(c0, a, th, sh), CX.pow(w0, a, th, sh)]; }
        return [CX.log(c0, th, sh), CX.log(w0, th, sh)];
      }
      if (id === 'custom') return pairOf(bb).f(c0, w0, s);
      return [bb.f(c0), bb.f(w0)];
    }
    function stage(k, zc0, z0) {
      let p = 0;
      for (let j = k; j >= 1; j--) if (isLive(steps, built, j) && built[j - 1].op === 'deriv') { p = j; break; }
      let pr;
      if (!p) pr = [zc0, z0];
      else {
        const rel = relOf(lev[p]);
        const g = (t) => stage(p - 1, zc0, t)[1];
        pr = [circleAt(g, zc0, rel), circleAt(g, z0, rel)];
      }
      for (let j = p + 1; j <= k; j++) if (isLive(steps, built, j)) pr = step(j, pr);
      return pr;
    }
    if (a0 > 0) {
      let pr = [zc, z];
      for (let k = a0 + 1; k <= b; k++) if (isLive(steps, built, k)) pr = step(k, pr);
      return pr[1];
    }
    return stage(b, zc, z)[1];
  }

  return {
    DEFS, GROUPS, PROP_KEYS, defaults, build, composeProps, derivProps, props, polyTex, numericPolyDegree, derivativeStep, derivAst,
    stageFunctions, circleAt, circleRel, SHEET_MAX, sheetCount, branchNode, stepSheets, sheetSteps, sheetCombos, sheetEval,
  };
})();
if (typeof module !== 'undefined') module.exports = Funcs;
