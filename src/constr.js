'use strict';
// Constructions (v16 CORE, notes/constructions-v16/SPEC.md; from notes/ui-redesign-2/constructions/poc/constr.js):
// exact geometry of generalized circles, refs to the points on the page, and the dependency graph of the app's
// constructed shapes. Plain JS, no DOM, no strings (undefined reasons are codes): window.Constr in the page,
// module.exports in node.
//
// Every curve is a GENERALIZED CIRCLE in an oriented, normalized Hermitian form about an anchor o:
//   f(z) = A |z - o|^2 + 2 Re(conj(B) (z - o)) + C,   |B|^2 - A C = 1,   the left side (interior) is f < 0.
// A = 0 is a line (a circle through infinity). Near the curve f/2 is the signed distance, at any radius, so a circle
// through three almost collinear points is as accurate as the line it tends to. Three EXACTLY collinear points
// (decided by an exact orientation predicate) give A = 0 exactly: a true line, never a huge circle. A point BUILT on
// line(P, Q) (a meet with it, a glider on it, the midpoint of P and Q) is collinear with P and Q by INCIDENCE, which
// the graph tracks: its rounded coordinates may be off the line, but circle(P, Q, X) is still exactly the line.
//
// Part 1 (the proof of concept, kept whole: its 84 tests run against this file in test/t_constr.js): the exact
// predicate, forms, meets with the entering rule, Moebius gliders, a named-node graph with formulas.
// Part 2 (v16 CORE, below "v16 CORE"): the app's shapes. A shape may carry s.at (bound handles) and s.def (a
// construction: circle3, meet, glider, midpoint, bisector); Constr.recompute writes their concrete fields, the
// runtime form s._g, s.cundef / s.cHid (undefined) and s._atInf (a point at infinity), in topological order.
const Constr = (function (factory) {
  const M = factory(); if (typeof window !== 'undefined') window.Constr = M;
  return M;
})(function () {
  const EPS = 2 ** -53;
  const INF = 'inf';                       // the point at infinity
  const isInf = (p) => p === INF;

  // ---------------------------------------------------------------- exact orientation
  // sign-exact (q - p) x (r - p): a float filter (Shewchuk's bound), else exact BigInt arithmetic on the doubles
  const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
  function decompose(x) {               // x = m * 2^e exactly
    if (x === 0) return [0n, 0];
    F64[0] = x;
    const lo = U32[0], hi = U32[1], ex = (hi >>> 20) & 0x7ff;
    let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), e;
    if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; }
    return [hi >>> 31 ? -m : m, e];
  }
  function ldexp(x, k) { while (k > 1000) { x *= 2 ** 1000; k -= 1000; } while (k < -1000) { x *= 2 ** -1000; k += 1000; } return x * 2 ** k; }
  let exactCalls = 0;
  function orient(p, q, r) {
    const l = (q[0] - p[0]) * (r[1] - p[1]), rr = (q[1] - p[1]) * (r[0] - p[0]), det = l - rr;
    const bound = (3 + 16 * EPS) * EPS * (Math.abs(l) + Math.abs(rr));
    if (Math.abs(det) > bound) return det;
    exactCalls++;
    const ds = [p[0], p[1], q[0], q[1], r[0], r[1]].map(decompose);
    const E = Math.min(...ds.filter((d) => d[0] !== 0n).map((d) => d[1]), 0);
    const B = ds.map(([m, e]) => m << BigInt(e - E));
    const [px, py, qx, qy, rx, ry] = B;
    const D = (qx - px) * (ry - py) - (qy - py) * (rx - px);
    if (D === 0n) return 0;
    // the value, rounded (it may overflow to +-Infinity or underflow: the sign is kept either way)
    const neg = D < 0n, M = neg ? -D : D, sh = Math.max(0, M.toString(16).length * 4 - 64);
    const v = ldexp(Number(M >> BigInt(sh)), 2 * E + sh);
    return (neg ? -1 : 1) * (v === 0 ? Number.MIN_VALUE : v);
  }
  // [review math-3] the orientation of the DECIMALS the user snapped or typed. Grid points are the doubles nearest
  // 0.1, 0.3, 0.6 …, and three such doubles on a decimal line are exactly collinear only about half the time. When
  // all six coordinates are 12-digit decimals (x === +x.toPrecision(12)), and the double predicate is within the
  // rounding of those decimals, the exact predicate runs on the decimals scaled to integers: 0 there is 0 here.
  function decOf(x) {
    if (x === 0) return [0n, 0];
    if (!Number.isFinite(x) || x !== +x.toPrecision(12)) return null;
    const m = /^(-?)(\d)\.(\d+)e([+-]\d+)$/.exec(x.toExponential(11));
    return m ? [BigInt(m[1] + m[2] + m[3]), +m[4] - 11] : null;
  }
  function decCollinear(p, q, r) {
    const ds = [p[0], p[1], q[0], q[1], r[0], r[1]].map(decOf);
    if (ds.some((d) => !d)) return false;
    const es = ds.filter((d) => d[0] !== 0n).map((d) => d[1]);
    if (!es.length) return true;
    const E = Math.min(...es);
    if (Math.max(...es) - E > 80) return false;
    const [px, py, qx, qy, rx, ry] = ds.map(([m, e]) => (m === 0n ? 0n : m * 10n ** BigInt(e - E)));
    return (qx - px) * (ry - py) - (qy - py) * (rx - px) === 0n;
  }
  function orientD(p, q, r) {
    const o = orient(p, q, r);
    if (o === 0) return 0;
    const M = Math.max(Math.abs(p[0]), Math.abs(p[1]), Math.abs(q[0]), Math.abs(q[1]), Math.abs(r[0]), Math.abs(r[1]));
    const L = (Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(r[0] - p[0]) + Math.abs(r[1] - p[1]));
    if (Math.abs(o) > 1e-11 * M * L) return o;
    return decCollinear(p, q, r) ? 0 : o;
  }

  // ---------------------------------------------------------------- complex numbers [re, im]
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const scl = (a, s) => [a[0] * s, a[1] * s];
  const abs = (a) => Math.hypot(a[0], a[1]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  const cexp = (a) => { const r = Math.exp(a[0]); return [r * Math.cos(a[1]), r * Math.sin(a[1])]; };
  const clog = (a) => [Math.log(abs(a)), Math.atan2(a[1], a[0])];
  const cpow = (a, b) => {
    if (b[1] === 0 && Number.isInteger(b[0]) && Math.abs(b[0]) <= 64) {
      let r = [1, 0], k = Math.abs(b[0]), x = a;
      while (k) { if (k & 1) r = mul(r, x); x = mul(x, x); k >>= 1; }
      return b[0] < 0 ? div([1, 0], r) : r;
    }
    if (a[0] === 0 && a[1] === 0) return [0, 0];
    return cexp(mul(b, clog(a)));
  };
  const csqrt = (a) => { const r = abs(a); const x = Math.sqrt((r + a[0]) / 2), y = Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [x, a[1] < 0 ? -y : y]; };
  const csin = (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])];
  const ccos = (a) => [Math.cos(a[0]) * Math.cosh(a[1]), -Math.sin(a[0]) * Math.sinh(a[1])];

  // ---------------------------------------------------------------- formulas
  // A small expression language for parameters, points and equations: + - * / ^, implicit products (2a, a b, 2(P+Q)),
  // |x|, functions (sin cos tan exp log sqrt abs re im arg conj), constants i, e, pi. A name is one letter with optional
  // digits (a, b, k, P, Q1). Reserved letters (the app's own meanings): z w x y r i e. (The app would use its own
  // Expr parser with a name scope instead: DESIGN.md, phase 1.)
  const RESERVED = new Set(['z', 'w', 'x', 'y', 'r', 'i', 'e']);
  const FUNCS = ['sqrt', 'conj', 'sin', 'cos', 'tan', 'exp', 'log', 'abs', 'arg', 'Re', 'Im', 're', 'im', 'ln'];
  class FormulaError extends Error {}
  // the Russian keyboard's look-alike letters become the Latin ones (а с е о р х у к, and the capitals); any other
  // Cyrillic letter is refused (a name must look the same to everyone: review-design 17)
  const HOMO = { 'а': 'a', 'с': 'c', 'е': 'e', 'о': 'o', 'р': 'p', 'х': 'x', 'у': 'y', 'к': 'k',
    'А': 'A', 'В': 'B', 'С': 'C', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M', 'О': 'O', 'Р': 'P', 'Т': 'T', 'Х': 'X' };
  function latin(src) {
    const s = String(src).replace(/[\u0400-\u04FF]/g, (c) => HOMO[c] || c);
    if (/[\u0400-\u04FF]/.test(s)) { const e = new FormulaError('Use Latin letters for names'); e.ru = 'Используйте латинские буквы'; throw e; }
    return s;
  }
  // opt.known: the names in scope. A run of two or more letters that is not a function is a product of names only
  // when EVERY letter is a known name or i, e, z ("ai" = a i); otherwise it is an error ("Unknown function sinc"),
  // never a set of new sliders (review-users 6). Without opt.known every run is refused.
  function tokenize(src, opt = {}) {
    const t = [];
    let i = 0;
    const s = latin(src).replace(/−/g, '-').replace(/·|×/g, '*').replace(/π/g, 'pi').replace(/\\pi/g, 'pi').replace(/\\left|\\right/g, '');
    while (i < s.length) {
      const ch = s[i];
      if (/\s/.test(ch)) { i++; continue; }
      const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s.slice(i));
      if (num) { t.push({ t: 'num', v: parseFloat(num[0]) }); i += num[0].length; continue; }
      if (/[A-Za-z\\]/.test(ch)) {
        const rest = s.slice(i).replace(/^\\/, '');
        const skip = s[i] === '\\' ? 1 : 0;
        // a function name not followed by another lowercase letter (Re z, Rez, sin(a), abs a)
        const fn = FUNCS.find((f) => rest.startsWith(f) && !/[a-y]/.test(rest[f.length] || ''));
        if (fn) { t.push({ t: 'fn', v: fn.toLowerCase() === 'ln' ? 'log' : fn.toLowerCase() }); i += fn.length + skip; continue; }
        if (rest.startsWith('pi') && !/[A-Za-z]/.test(rest[2] || '')) { t.push({ t: 'num', v: Math.PI }); i += 2 + skip; continue; }
        const run = /^[A-Za-z]{2,}/.exec(rest);
        if (run) {
          const ok = (c) => c === 'i' || c === 'e' || c === 'z' || (opt.known && opt.known.has(c));
          if (![...run[0]].every(ok)) throw new FormulaError(`Unknown function ${run[0]}`);
        }
        const nm = /^[A-Za-z](_?\d+)?/.exec(rest);
        const name = nm[0].replace('_', '');
        i += nm[0].length + skip;
        if (name === 'i') t.push({ t: 'cst', v: [0, 1] });
        else if (name === 'e') t.push({ t: 'cst', v: [Math.E, 0] });
        else t.push({ t: 'name', v: name });
        continue;
      }
      if ('+-*/^()|='.includes(ch)) { t.push({ t: 'op', v: ch }); i++; continue; }
      throw new FormulaError(`Unexpected '${ch}'`);
    }
    t.push({ t: 'eof' });
    return t;
  }
  function parse(src, opt) {
    const T = tokenize(src, opt);
    let p = 0, absDepth = 0;
    const peek = () => T[p], next = () => T[p++];
    const isOp = (k, v) => k.t === 'op' && k.v === v;
    const startsAtom = (k) => k.t === 'num' || k.t === 'cst' || k.t === 'name' || k.t === 'fn' || isOp(k, '(') || (isOp(k, '|') && absDepth === 0);
    function eq() {
      const a = sum();
      if (isOp(peek(), '=')) { next(); const b = sum(); return { t: 'eq', a, b }; }
      return a;
    }
    function sum() {
      let a = prod();
      while (isOp(peek(), '+') || isOp(peek(), '-')) { const o = next().v; a = { t: o === '+' ? 'add' : 'sub', a, b: prod() }; }
      return a;
    }
    function prod() {
      let a = unary();
      for (;;) {
        if (isOp(peek(), '*') || isOp(peek(), '/')) { const o = next().v; a = { t: o === '*' ? 'mul' : 'div', a, b: unary() }; continue; }
        if (startsAtom(peek())) { a = { t: 'mul', a, b: power() }; continue; }
        return a;
      }
    }
    function unary() { if (isOp(peek(), '-')) { next(); return { t: 'neg', a: unary() }; } if (isOp(peek(), '+')) { next(); return unary(); } return power(); }
    function power() { const a = atom(); if (isOp(peek(), '^')) { next(); return { t: 'pow', a, b: unary() }; } return a; }
    function atom() {
      const k = next();
      if (k.t === 'num') return { t: 'num', v: [k.v, 0] };
      if (k.t === 'cst') return { t: 'num', v: k.v };
      if (k.t === 'name') return { t: 'name', n: k.v };
      if (k.t === 'fn') {
        const a = isOp(peek(), '(') ? atom() : power();
        return { t: 'call', f: k.v, a };
      }
      if (isOp(k, '(')) { const e = sum(); if (!isOp(next(), ')')) throw new FormulaError("Expected ')'"); return e; }
      if (isOp(k, '|')) { absDepth++; const e = sum(); absDepth--; if (!isOp(next(), '|')) throw new FormulaError("Expected '|'"); return { t: 'call', f: 'abs', a: e }; }
      throw new FormulaError(k.t === 'eof' ? 'Unexpected end of formula' : `Unexpected '${k.v}'`);
    }
    const e = eq();
    if (peek().t !== 'eof') throw new FormulaError(`Unexpected '${peek().v}'`);
    return e;
  }
  // the free names of a formula (z is the equation variable, not a name)
  function namesOf(n, out = new Set()) {
    if (!n) return out;
    if (n.t === 'name') { if (n.n !== 'z') out.add(n.n); return out; }
    for (const k of ['a', 'b']) if (n[k]) namesOf(n[k], out);
    return out;
  }
  // the names of a field's formula, and the new one (at most one new name per edit: review-users 6)
  function analyze(src, known) {
    const ast = parse(src, { known: new Set(known) });
    const names = [...namesOf(ast)], fresh = names.filter((n) => !known.has(n));
    if (fresh.length > 1) throw new FormulaError(`One new name at a time: ${fresh.join(', ')}`);
    if (fresh.length && RESERVED.has(fresh[0])) throw new FormulaError(`${fresh[0]} is taken (z w x y r i e have their own meaning)`);
    return { ast, names, fresh: fresh[0] || null };
  }
  const usesZ = (n) => !!n && (n.t === 'name' ? n.n === 'z' : usesZ(n.a) || usesZ(n.b));
  const FN = {
    sqrt: csqrt, conj: (a) => [a[0], -a[1]], sin: csin, cos: ccos, tan: (a) => div(csin(a), ccos(a)), exp: cexp, log: clog,
    abs: (a) => [abs(a), 0], arg: (a) => [Math.atan2(a[1], a[0]), 0], re: (a) => [a[0], 0], im: (a) => [a[1], 0],
  };
  // evaluate with env(name) -> [re, im] (throws for unknown names)
  function evalAst(n, env) {
    switch (n.t) {
      case 'num': return n.v;
      case 'name': return env(n.n);
      case 'neg': { const a = evalAst(n.a, env); return [-a[0], -a[1]]; }
      case 'add': return add(evalAst(n.a, env), evalAst(n.b, env));
      case 'sub': return sub(evalAst(n.a, env), evalAst(n.b, env));
      case 'mul': return mul(evalAst(n.a, env), evalAst(n.b, env));
      case 'div': return div(evalAst(n.a, env), evalAst(n.b, env));
      case 'pow': return cpow(evalAst(n.a, env), evalAst(n.b, env));
      case 'call': return FN[n.f](evalAst(n.a, env));
    }
    throw new FormulaError('Cannot evaluate ' + n.t);
  }

  // ---------------------------------------------------------------- generalized circles
  // gc(A, B, C, o): normalize so that |B|^2 - A C = 1 (null when degenerate: a point circle or nothing)
  function gc(A, B, C, o) {
    const N2 = B[0] * B[0] + B[1] * B[1] - A * C;
    if (!(N2 > 0) || !Number.isFinite(N2)) return null;
    const s = 1 / Math.sqrt(N2);
    return { A: A * s, B: [B[0] * s, B[1] * s], C: C * s, o: o.slice() };
  }
  const isLine = (g) => g.A === 0;
  // f(z) of a generalized circle (negative inside, f/2 about the signed distance near the curve)
  const fOf = (g, z) => { const u = sub(z, g.o); return g.A * dot(u, u) + 2 * dot(g.B, u) + g.C; };
  // a circle's centre and radius, or a line's foot point (nearest the anchor) and its direction (interior on the left)
  function geomOf(g) {
    if (isLine(g)) return { line: true, p: sub(g.o, scl(g.B, g.C / 2)), d: [-g.B[1], g.B[0]] };
    return { line: false, c: sub(g.o, scl(g.B, 1 / g.A)), r: 1 / Math.abs(g.A), inside: g.A > 0 };
  }
  // the generalized circle through p, q, r (points [x, y] or INF), oriented p -> q -> r (its interior on the left):
  // the lifting of the plane to the paraboloid (|z|^2, x, y, 1), where circles are planes. Anchored at the first
  // finite point; A = orient(p, q, r) exactly (0 for collinear points or when one is infinity)
  function circle3(p, q, r, collinear = false) {
    const pts = [p, q, r];
    const nInf = pts.filter(isInf).length;
    if (nInf > 1) return null;
    if (nInf === 1) {
      // rotate so the infinite point is last (a cyclic shift keeps the orientation): the line p -> q
      while (!isInf(pts[2])) pts.push(pts.shift());
      return line2(pts[0], pts[1]);
    }
    const [P, Q, R] = pts;
    if ((P[0] === Q[0] && P[1] === Q[1]) || (Q[0] === R[0] && Q[1] === R[1]) || (P[0] === R[0] && P[1] === R[1])) return null;
    const q1 = sub(Q, P), r1 = sub(R, P), sq = dot(q1, q1), sr = dot(r1, r1);
    const A = collinear ? 0 : orientD(P, Q, R);
    const D = sr * q1[1] - sq * r1[1], E = sq * r1[0] - sr * q1[0];
    if (A === 0) {
      // [review math-3] collinear (exactly, by the decimals, or by incidence): the line through P and Q itself, its side
      // the one the lifting gives (left of P -> Q unless R lies between P and Q), so R's rounding never tilts it
      const lam = dot(r1, q1) / sq, sgn = lam > 0 && lam < 1 ? -1 : 1;
      return withPts(gc(0, [sgn * q1[1], -sgn * q1[0]], 0, P), [P, Q, R]);
    }
    // (e: the triangle's longest side, which meets0 reads to tell a circle whose points are collinear to rounding)
    const g = gc(A, [D / 2, E / 2], 0, P);
    if (g) g.e = Math.sqrt(Math.max(sq, sr, dot(sub(R, Q), sub(R, Q))));
    return withPts(g, [P, Q, R]);
  }
  // the line through p and q, directed p -> q (the interior on its left)
  function line2(p, q) {
    if (isInf(p) || isInf(q)) return null;
    const d = sub(q, p), L = abs(d);
    if (!(L > 0)) return null;
    return withPts(gc(0, [d[1] / L, -d[0] / L], 0, p), [p, q]);
  }
  // (v16.1, verify-3) a form keeps the points it was built through (g.pts): two curves built through the same two points
  // meet exactly there, whatever the conditioning (meets), where solving the forms lost up to 0.08 |PQ| for a circle
  // through nearly collinear points met with the line through two of them
  function withPts(g, pts) { if (g) g.pts = pts.map((z) => z.slice()); return g; }
  function sharedPts(g1, g2) {
    if (!g1 || !g2 || !g1.pts || !g2.pts) return null;
    const out = [];
    for (const a of g1.pts) if (isXY(a) && g2.pts.some((b) => isXY(b) && b[0] === a[0] && b[1] === a[1]) && !out.some((c) => c[0] === a[0] && c[1] === a[1])) out.push(a);
    return out.length === 2 ? [out[0].slice(), out[1].slice()] : null;
  }
  // centre c, through q (counterclockwise: the disc is the interior)
  function circleCP(c, q) {
    if (isInf(c) || isInf(q)) return null;
    const v = sub(q, c), rho = abs(v);
    if (!(rho > 0)) return null;
    return gc(1, v, 0, q);
  }
  function circleCR(c, rho) {
    if (isInf(c) || !(rho > 0) || !Number.isFinite(rho)) return null;
    return gc(1, [0, 0], -rho * rho, c);
  }
  function bisector(p, q) {
    if (isInf(p) || isInf(q)) return null;
    const d = sub(q, p), L = abs(d);
    if (!(L > 0)) return null;
    return gc(0, [d[0] / L, d[1] / L], 0, scl(add(p, q), 0.5));
  }
  // the intersections of two generalized circles: [z0, z1] (points, INF, or null where there is none). Order: along a
  // line's direction (line with anything); for two circles, z0 is left of the centre line c1 -> c2; two lines: the
  // finite crossing, then infinity (where every two lines meet). Equal curves: none.
  // the gradient of f at z, and the direction of travel along g at z (its interior on the left)
  const grad = (g, z) => { const u = sub(z, g.o); return [2 * (g.A * u[0] + g.B[0]), 2 * (g.A * u[1] + g.B[1])]; };
  const travel = (g, z) => { const v = grad(g, z); return [-v[1], v[0]]; };
  // > 0: curve 2 leaves the inside of curve 1 at z; < 0: it enters
  const crossing = (g1, g2, z) => dot(grad(g1, z), travel(g2, z));
  function meets(g1, g2) {
    const two = meets0(g1, g2);
    const [p, q] = two;
    if (p == null || q == null) return two;
    if (isInf(p) && isInf(q)) return two;
    // two lines: the finite crossing and infinity, which take the opposite roles
    if (isInf(q)) return crossing(g1, g2, p) <= 0 ? [p, INF] : [INF, p];
    const sh = isInf(p) ? null : sharedPts(g1, g2);
    if (sh) return crossing(g1, g2, sh[0]) <= 0 ? [sh[0], sh[1]] : [sh[1], sh[0]];
    return crossing(g1, g2, p) <= 0 ? [p, q] : [q, p];
  }
  // the two intersections, unordered. Solved in the Hermitian form of one curve along the other (a line, or the
  // smaller circle) so that a circle of radius 1e8 through nearly collinear points meets as accurately as the line it
  // tends to (rev 2: the centre-radius form lost 1e-3 there)
  const coincideMark = () => { const r = [null, null]; r.coincide = true; return r; };
  function meets0(g1, g2) {
    const a = geomOf(g1), b = geomOf(g2);
    if (a.line && b.line) {
      const den = cross(a.d, b.d);
      // [review v16 math-5] the same line to rounding (within 256 ulps of the coordinates at both anchors, at an angle
      // within 256 ulps): the crossing would be a point that rounding chose, so there is none ('the curves coincide')
      const la = abs(a.d), lb = abs(b.d), dl = 256 * EPS * Math.max(abs(a.p), abs(b.p), abs(sub(b.p, a.p)));
      if (Math.abs(den) <= 256 * EPS * la * lb && Math.abs(cross(sub(b.p, a.p), b.d)) <= dl * lb && Math.abs(cross(sub(a.p, b.p), a.d)) <= dl * la) return coincideMark();
      if (den === 0) return [INF, INF];            // parallel lines are tangent at infinity: they meet only there
      const t = cross(sub(b.p, a.p), b.d) / den;
      return [add(a.p, scl(a.d, t)), INF];
    }
    // f: the Hermitian curve; the other is walked: a line (z = p + t d) or the smaller circle (z = c + r e^{i phi})
    let f, w;
    if (a.line || b.line) { w = a.line ? a : b; f = a.line ? g2 : g1; }
    else { const first = Math.abs(g1.A) >= Math.abs(g2.A); w = first ? a : b; f = first ? g2 : g1; }
    if (w.line) {
      const d = scl(w.d, 1 / abs(w.d)), u = sub(w.p, f.o);
      const qa = f.A, qb = f.A * dot(u, d) + dot(f.B, d), qc = f.A * dot(u, u) + 2 * dot(f.B, u) + f.C;
      if (qa === 0) { if (qb === 0) return [null, null]; const t = -qc / (2 * qb); const z = add(w.p, scl(d, t)); return [z, INF]; }
      const disc = qb * qb - qa * qc;
      // [review v16 math-5] a 3-point circle whose points are collinear to rounding (it leaves a line by at most
      // 256 ulps of the coordinates over its triangle, longest side f.e: R snapped to a point of P Q that the graph
      // does not track), met with a line that keeps within that of it at the vertex of f (the line P Q): the meets
      // would be points that rounding chose, so there are none: 'the curves coincide' (meetsOf, evalNode)
      if (f.e > 0) {
        const dl = 256 * EPS * Math.max(abs(w.p), abs(f.o));
        if (Math.abs(qa) * f.e * f.e / 8 <= dl && Math.abs(disc) / (2 * Math.abs(qa)) <= dl) return coincideMark();
      }
      if (disc < -8 * EPS * (qb * qb + Math.abs(qa * qc))) return [null, null];
      const sq = Math.sqrt(Math.max(0, disc)), q = -(qb + (qb >= 0 ? sq : -sq));
      const t1 = q / qa, t2 = q !== 0 ? qc / q : t1;
      return [add(w.p, scl(d, t1)), add(w.p, scl(d, t2))];
    }
    // [review math-2] two circles: their radical axis L = A2 f1 - A1 f2 (f2 re-anchored at o1 exactly: B2 + A2 (o1 - o2),
    // C = f2(o1)) is a line form, so no centre enters; L then meets the smaller circle on the stable line path above
    const o1 = g1.o, B2 = add(g2.B, scl(sub(o1, g2.o), g2.A)), C2 = fOf(g2, o1);
    const L = gc(0, sub(scl(g1.B, g2.A), scl(B2, g1.A)), g2.A * g1.C - g1.A * C2, o1);
    if (!L) return [null, null];                      // concentric (or equal): no meet
    return meets0(L, Math.abs(g1.A) >= Math.abs(g2.A) ? g1 : g2);
  }
  // a point on a curve at parameter t (an angle on a circle, the distance from the anchor's foot along a line) and the
  // parameter nearest a point
  function onCurve(g, t) { const G = geomOf(g); return G.line ? add(G.p, scl(G.d, t)) : add(G.c, [G.r * Math.cos(t), G.r * Math.sin(t)]); }
  function paramNear(g, z) { const G = geomOf(g); return G.line ? dot(sub(z, G.p), G.d) : Math.atan2(z[1] - G.c[1], z[0] - G.c[0]); }

  // the Moebius map sending 0, 1, inf to P, Q, R, and its inverse: a real t runs along the generalized circle P, Q, R
  const mob3 = (P, Q, R, t) => {
    if (!Number.isFinite(t)) return R;
    const qp = sub(Q, P), rq = sub(R, Q);
    return div(add(scl(mul(R, qp), t), mul(P, rq)), add(scl(qp, t), rq));
  };
  const mob3inv = (P, Q, R, z) => { const w = div(mul(sub(R, Q), sub(z, P)), mul(sub(Q, P), sub(R, z))); return w[0]; };
  // the nearest point of a generalized circle to z
  function project(g, z) {
    const G = geomOf(g);
    if (G.line) return add(G.p, scl(G.d, dot(sub(z, G.p), G.d) / dot(G.d, G.d)));
    return projectForm(g, z);
  }
  // [review math-1] the point of a generalized circle nearest z, without its centre (c + r v/|v| loses eps |c|, a
  // whole unit at r = 1e16): from z, two Newton steps along the gradient of the Hermitian form. Along n = grad f / g
  // (g = |grad f|), f(z + s n) = f + g s + A s^2, and its small root -2 f / (g + sqrt(g^2 - 4 A f)) is the step to the
  // nearest point (exact for a line, and for a circle of any radius to a few ulps of |z - o|)
  function projectForm(G, z) {
    let p = [z[0], z[1]];
    for (let k = 0; k < 2; k++) {
      const ux = p[0] - G.o[0], uy = p[1] - G.o[1];
      const f = G.A * (ux * ux + uy * uy) + 2 * (G.B[0] * ux + G.B[1] * uy) + G.C;
      if (f === 0 || !Number.isFinite(f)) break;
      const gx = 2 * (G.A * ux + G.B[0]), gy = 2 * (G.A * uy + G.B[1]), g = Math.hypot(gx, gy);
      const nx = g > 0 ? gx / g : 1, ny = g > 0 ? gy / g : 0;           // (at a centre every direction is radial)
      const den = g + Math.sqrt(Math.max(0, g * g - 4 * G.A * f));
      if (!(den > 0)) break;
      const s = -2 * f / den;
      p = [p[0] + s * nx, p[1] + s * ny];
    }
    return p;
  }
  // |M(z)| = k for M(z) = (a z + b) / (c z + d): |a z + b|^2 - k^2 |c z + d|^2 = 0, a generalized circle (an
  // Apollonian circle of the zero and the pole of M); its inside is |M(z)| < k. Anchored at a point of the curve.
  const conj = (a) => [a[0], -a[1]], n2 = (a) => dot(a, a);
  function apollonius(a, b, c, d, k) {
    const k2 = k * k;
    const A = n2(a) - k2 * n2(c), B = sub(mul(conj(a), b), scl(mul(conj(c), d), k2)), C = n2(b) - k2 * n2(d);
    const g = gc(A, B, C, [0, 0]);
    return g && reanchor(g);
  }
  // arg M(z) = theta: the circle Im(e^{-i theta} M(z)) = 0 through the zero and the pole of M (a Steiner circle);
  // the curve is its arc where Re(e^{-i theta} M(z)) > 0, from the zero to the pole
  function steiner(a, b, c, d, theta) {
    const u = [Math.cos(theta), -Math.sin(theta)];
    const al = mul(u, mul(a, conj(d))), be = mul(u, mul(b, conj(c)));
    const A = mul(u, mul(a, conj(c)))[1], C = mul(u, mul(b, conj(d)))[1];
    const B = scl(mul([0, 1], sub(conj(al), be)), 0.5);
    const g = gc(A, B, C, [0, 0]);
    return g && { g: reanchor(g), from: scl(div(b, a), -1), to: scl(div(d, c), -1),
      onArc: (z) => { const m = div(add(mul(a, z), b), add(mul(c, z), d)); return mul(u, m)[0] > 0; } };
  }
  // an equation with parameters: Re z = E, Im z = E, |z - E| = E (and the sides swapped); E without z
  function equationCurve(ast, env) {
    if (ast.t !== 'eq') throw new FormulaError('Expected an equation such as Re z = a');
    let L = ast.a, R = ast.b;
    if (usesZ(R) && !usesZ(L)) [L, R] = [R, L];
    if (usesZ(R)) throw new FormulaError('Put z on one side only');
    const v = evalAst(R, env);
    if (Math.abs(v[1]) > 1e-12 * Math.max(1, Math.abs(v[0]))) throw new FormulaError('The right side must be real');
    const k = v[0];
    const isZ = (n) => n.t === 'name' && n.n === 'z';
    if (L.t === 'call' && (L.f === 're' || L.f === 'im') && isZ(L.a)) {
      return L.f === 're' ? gc(0, [1, 0], 0, [k, 0]) : gc(0, [0, 1], 0, [0, k]);
    }
    if (L.t === 'call' && L.f === 'abs') {
      let c = null;
      if (isZ(L.a)) c = [0, 0];
      else if (L.a.t === 'sub' && isZ(L.a.a) && !usesZ(L.a.b)) c = evalAst(L.a.b, env);
      else if (L.a.t === 'add' && isZ(L.a.a) && !usesZ(L.a.b)) c = scl(evalAst(L.a.b, env), -1);
      if (c) return k > 0 ? circleCR(c, k) : null;
    }
    throw new FormulaError('This proof of concept knows Re z = …, Im z = …, |z − c| = …');
  }

  // ---------------------------------------------------------------- the graph
  const KINDS = {
    param: { free: true }, list: { free: true }, value: {}, point: {}, line: { n: 2 }, circle3: { n: 3 }, circleCP: { n: 2 },
    circleCR: { n: 1 }, bisector: { n: 2 }, midpoint: { n: 2 }, meet: { n: 2 }, glider: { n: 1 }, equation: {},
  };
  const CURVE_KINDS = new Set(['line', 'circle3', 'circleCP', 'circleCR', 'bisector', 'equation']);
  const POINT_KINDS = new Set(['point', 'midpoint', 'meet', 'glider']);
  const NAME_RE = /^[A-Za-z](\d+)?$/;

  function graph() {
    const nodes = new Map();          // name -> node
    let order = null;                 // topological order (names), rebuilt after a structural change
    let topoIndex = new Map();
    const dirty = new Set();
    const stats = { evals: 0, lastMs: 0 };

    // a node's dependencies: its arguments and the free names of its formulas
    function depsOf(def) {
      const s = new Set(def.args || []);
      for (const key of ['expr', 'rexpr', 'src']) if (def[key] != null) { def['_' + key] = parse(def[key], { known: new Set(nodes.keys()) }); for (const n of namesOf(def['_' + key])) s.add(n); }
      return [...s];
    }
    function dependents(name) { const out = []; for (const n of nodes.values()) if (n.deps.includes(name)) out.push(n.name); return out; }
    function downstream(names) {
      const seen = new Set(), stack = [...names];
      while (stack.length) { const x = stack.pop(); if (seen.has(x)) continue; seen.add(x); for (const y of nodes.get(x).out) stack.push(y); }
      return seen;
    }
    function rebuild() {
      for (const n of nodes.values()) n.out = [];
      for (const n of nodes.values()) for (const d of n.deps) if (nodes.has(d)) nodes.get(d).out.push(n.name);
      // Kahn's algorithm, ties broken by insertion order (deterministic)
      const indeg = new Map([...nodes.values()].map((n) => [n.name, n.deps.filter((d) => nodes.has(d)).length]));
      const q = [...nodes.keys()].filter((k) => indeg.get(k) === 0), out = [];
      while (q.length) { const x = q.shift(); out.push(x); for (const y of nodes.get(x).out) { indeg.set(y, indeg.get(y) - 1); if (indeg.get(y) === 0) q.push(y); } }
      if (out.length !== nodes.size) throw new Error('cycle');      // add/redefine refuse cycles before this
      order = out; topoIndex = new Map(out.map((k, i) => [k, i]));
    }
    // a cycle: one of deps is name itself or depends on it; returns the path for the message
    function cyclePath(name, deps) {
      for (const d of deps) {
        if (d === name) return [name, name];
        const path = findPath(d, name);
        if (path) return [name, ...path];
      }
      return null;
    }
    function findPath(from, to) {      // a chain of dependencies from -> ... -> to
      const prev = new Map([[from, null]]), q = [from];
      while (q.length) {
        const x = q.shift();
        if (x === to) { const p = []; for (let y = x; y != null; y = prev.get(y)) p.unshift(y); return p; }
        const n = nodes.get(x);
        if (n) for (const d of n.deps) if (!prev.has(d)) { prev.set(d, x); q.push(d); }
      }
      return null;
    }
    function check(name, def) {
      if (!NAME_RE.test(name) || RESERVED.has(name)) throw new FormulaError(RESERVED.has(name) ? `${name} is taken (z w x y r i e have their own meaning)` : `A name is a letter, maybe with digits: a, k, P1`);
      const K = KINDS[def.kind];
      if (!K) throw new FormulaError('Unknown kind ' + def.kind);
      if (K.n && (def.args || []).length !== K.n) throw new FormulaError(`${def.kind} needs ${K.n} objects`);
      const deps = depsOf(def);
      for (const d of deps) if (!nodes.has(d) && d !== name) throw new FormulaError(`${d} is not defined`);
      const cyc = cyclePath(name, deps);
      if (cyc) throw new FormulaError(`${name} would depend on itself: ${cyc.join(' → ')}`);
      return deps;
    }
    function add(name, def) {
      if (nodes.has(name)) throw new FormulaError(`${name} already exists`);
      const deps = check(name, def);
      const d = Object.assign({}, def);
      nodes.set(name, { name, def: d, deps, out: [], val: undefined, err: null, note: null });
      rebuild();
      // a circle through three points is created as the disc, whatever the order of the taps (review-design 15,
      // review-users 7). The sign is stored; afterwards the orientation follows the points, so a drag through the
      // collinear case goes on continuously (disc, half-plane, outside). Use complement flips it.
      if (d.kind === 'circle3' && d.flip == null) {
        const p = d.args.map((a) => nodes.get(a).val);
        d.flip = p.every((x) => Array.isArray(x)) && !collinearBy(d.args) && orient(...p) < 0;
      }
      dirty.add(name);
      return update();
    }
    // incidence: the lines a point lies on by construction, as keys 'P|Q' of their defining points (and the keys of
    // the lines its defining points share). Structural, not numerical, so it survives rounding.
    const keyOf = (p, q) => [p, q].sort().join('|');
    function lineKeys(nm) {
      const n = nodes.get(nm);
      if (!n || n.def.kind !== 'line') return new Set();
      const [p, q] = n.def.args, s = new Set([keyOf(p, q)]);
      const a = incOf(p), b = incOf(q);
      for (const k of a) if (b.has(k)) s.add(k);
      return s;
    }
    function incOf(nm) {
      const n = nodes.get(nm);
      if (!n) return new Set();
      const d = n.def, s = new Set();
      if (d.kind === 'meet') for (const c of d.args) for (const k of lineKeys(c)) s.add(k);
      if (d.kind === 'glider') for (const k of lineKeys(d.args[0])) s.add(k);
      if (d.kind === 'midpoint') { s.add(keyOf(d.args[0], d.args[1])); const a = incOf(d.args[0]), b = incOf(d.args[1]); for (const k of a) if (b.has(k)) s.add(k); }
      return s;
    }
    function collinearBy([p, q, r]) {
      const ip = incOf(p), iq = incOf(q), ir = incOf(r);
      if (ir.has(keyOf(p, q)) || iq.has(keyOf(p, r)) || ip.has(keyOf(q, r))) return true;
      for (const k of ip) if (iq.has(k) && ir.has(k)) return true;
      return false;
    }
    // redefine: same name, new definition (refused if it would make a cycle)
    function redefine(name, def) {
      if (!nodes.has(name)) throw new FormulaError(`${name} is not defined`);
      const deps = check(name, def);
      const n = nodes.get(name);
      n.def = Object.assign({}, def); n.deps = deps;
      rebuild();
      dirty.add(name);
      return update();
    }
    // remove a node and everything that depends on it (the app shows them in the confirmation toast, with Undo)
    function remove(name) {
      const gone = [...downstream([name])];
      for (const g of gone) nodes.delete(g);
      rebuild();
      return gone;
    }
    // change a free value: a param, a list, a free point, a glider's parameter. Returns the recomputed names.
    function set(name, v) {
      const n = nodes.get(name);
      if (!n) throw new FormulaError(`${name} is not defined`);
      const d = n.def;
      if (d.kind === 'param') d.value = +v;            // a typed value may leave the slider's range (the range grows)
      else if (d.kind === 'list') d.values = v.slice();
      else if (d.kind === 'point' && d.expr == null) d.at = isInf(v) ? INF : [+v[0], +v[1]];
      else if (d.kind === 'glider') d.t = +v;
      else throw new FormulaError(`${name} is defined by its construction: drag what it depends on`);
      dirty.add(name);
      return update();
    }
    // drag an object to the point z: a free point moves, a glider slides along its curve
    function drag(name, z) {
      const n = nodes.get(name);
      if (n.def.kind === 'glider') { const g = nodes.get(n.def.args[0]).val; if (g && !Array.isArray(g)) return set(name, gliderParam(n.def.args[0], g, z)); return []; }
      return set(name, z);
    }
    const draggable = (name) => { const d = nodes.get(name).def; return (d.kind === 'point' && d.expr == null) || d.kind === 'glider'; };

    function env(n) {
      return (nm) => {
        const m = nodes.get(nm);
        if (!m) throw new FormulaError(`${nm} is not defined`);
        if (m.val == null) throw new FormulaError(`${nm} is undefined`);
        if (m.def.kind === 'list') { if (n._listVal == null) throw new FormulaError(`${nm} is a list: use it in an equation`); return [n._listVal, 0]; }
        if (isInf(m.val)) throw new FormulaError(`${nm} is at infinity`);
        if (typeof m.val === 'number') return [m.val, 0];
        if (Array.isArray(m.val) && typeof m.val[0] === 'number') return m.val;
        throw new FormulaError(`${nm} is a curve, not a number`);
      };
    }
    const pointVal = (nm) => { const m = nodes.get(nm); if (!m || m.val == null) return null; if (!(isInf(m.val) || (Array.isArray(m.val) && typeof m.val[0] === 'number' && POINT_KINDS.has(m.def.kind)))) throw new FormulaError(`${nm} is not a point`); return m.val; };
    const curveVal = (nm) => { const m = nodes.get(nm); if (!m || m.val == null) return null; if (!CURVE_KINDS.has(m.def.kind)) throw new FormulaError(`${nm} is not a curve`); if (Array.isArray(m.val)) throw new FormulaError(`${nm} is a family: pick one curve`); return m.val; };

    // a glider's parameter: through the points that define its curve when it has them (review-users 8)
    function curvePts(cn) { const c = nodes.get(cn).def; if (c.kind !== 'circle3' && c.kind !== 'line') return null; const p = c.args.map(pointVal); return p.some((x) => x == null || isInf(x)) ? null : p; }
    function gliderParam(cn, g, z) {
      const p = curvePts(cn), w = project(g, z);
      if (!p) return paramNear(g, z);
      if (p.length === 2) { const d = sub(p[1], p[0]); return dot(sub(w, p[0]), d) / dot(d, d); }
      return mob3inv(p[0], p[1], p[2], w);
    }
    function gliderAt(cn, g, t) {
      const p = curvePts(cn);
      if (!p) return onCurve(g, t);
      if (p.length === 2) return [p[0][0] + (p[1][0] - p[0][0]) * t, p[0][1] + (p[1][1] - p[0][1]) * t];   // (graph's add shadows the complex add here)
      return mob3(p[0], p[1], p[2], t);
    }
    function evaluate(n) {
      stats.evals++;
      const d = n.def;
      const P = () => d.args.map(pointVal);
      const any0 = (xs) => xs.some((x) => x == null);
      switch (d.kind) {
        case 'param': return d.value;
        case 'list': return d.values.slice();
        case 'value': { const v = evalAst(d._expr, env(n)); return Math.abs(v[1]) === 0 ? v[0] : v; }
        case 'point': {
          if (d.expr == null) return d.at;
          const v = evalAst(d._expr, env(n));
          if (!Number.isFinite(v[0]) || !Number.isFinite(v[1])) return INF;
          return v;
        }
        case 'line': { const p = P(); return any0(p) ? null : line2(...p); }
        case 'circle3': {
          const p = P(); if (any0(p)) return null;
          const g = circle3(...p, collinearBy(d.args));
          return g && d.flip ? { A: -g.A, B: [-g.B[0], -g.B[1]], C: -g.C, o: g.o } : g;
        }
        case 'circleCP': { const p = P(); return any0(p) ? null : circleCP(...p); }
        case 'circleCR': { const p = P(); if (any0(p)) return null; const v = evalAst(d._rexpr, env(n)); return circleCR(p[0], v[0]); }
        case 'bisector': { const p = P(); return any0(p) ? null : bisector(...p); }
        case 'midpoint': { const p = P(); if (any0(p)) return null; if (p.some(isInf)) return INF; return [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2]; }   // (a latent bug of rev 1: the graph's add shadowed the complex add)
        case 'meet': {
          const g = d.args.map(curveVal); if (any0(g)) return null;
          const m = meets(g[0], g[1]);
          n.note = isInf(m[0]) && isInf(m[1]) ? 'They meet only at ∞' : null;
          return m[d.index | 0];
        }
        case 'glider': { const g = curveVal(d.args[0]); return g ? gliderAt(d.args[0], g, d.t || 0) : null; }
        case 'equation': {
          // a list among its names: one curve per value (a family)
          const lists = [...namesOf(d._src)].filter((nm) => nodes.get(nm).def.kind === 'list');
          if (lists.length > 1) throw new FormulaError('Use at most one list in a family');
          if (!lists.length) return equationCurve(d._src, env(n));
          return nodes.get(lists[0]).val.map((k) => { n._listVal = k; try { return equationCurve(d._src, env(n)); } finally { n._listVal = null; } });
        }
      }
      throw new FormulaError('Unknown kind');
    }
    // recompute the dirty nodes and their dependents, in topological order; returns the names recomputed
    function update() {
      const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
      if (!order) rebuild();
      const todo = [...downstream([...dirty])].sort((a, b) => topoIndex.get(a) - topoIndex.get(b));
      dirty.clear();
      for (const nm of todo) {
        const n = nodes.get(nm);
        try { n.val = evaluate(n); n.err = n.val == null ? undefinedWhy(n) : null; } catch (e) { n.val = null; n.err = e.message; }
      }
      stats.lastMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
      return todo;
    }
    function undefinedWhy(n) {
      const bad = n.deps.find((d) => nodes.get(d) && nodes.get(d).val == null);
      if (bad) return `${bad} is undefined`;
      switch (n.def.kind) {
        case 'meet': return 'The curves do not meet here';
        case 'circle3': return 'Two of the points coincide';
        case 'line': case 'circleCP': case 'bisector': return 'The points coincide';
        default: return 'Undefined';
      }
    }
    // the saved form: definitions in dependency order (values of constructed objects are recomputed on load)
    function toJSON() {
      if (!order) rebuild();
      return { v: 1, nodes: order.map((nm) => { const d = nodes.get(nm).def, o = { name: nm }; for (const [k, v] of Object.entries(d)) if (k[0] !== '_') o[k] = v; return o; }) };
    }
    return {
      add, redefine, remove, set, drag, draggable, update, toJSON, stats,
      get: (nm) => nodes.get(nm), has: (nm) => nodes.has(nm), names: () => { if (!order) rebuild(); return order.slice(); },
      val: (nm) => nodes.get(nm).val, err: (nm) => nodes.get(nm).err, note: (nm) => nodes.get(nm).note, collinearBy,
      ancestors: (nm) => { const seen = new Set(), st = [...nodes.get(nm).deps]; while (st.length) { const x = st.pop(); if (seen.has(x)) continue; seen.add(x); st.push(...nodes.get(x).deps); } return seen; },
      dependentsOf: (nm) => { const s = downstream([nm]); s.delete(nm); return s; },
      directDependents: dependents,
    };
  }
  function fromJSON(o) {
    const G = graph();
    for (const n of o.nodes) { const def = Object.assign({}, n); delete def.name; G.add(n.name, def); }
    return G;
  }

  // ---------------------------------------------------------------- the app's shapes
  // A constructed curve becomes an ordinary Region shape (the renderers, the exact inverse renderer, the globe and
  // export need nothing new): a line {kind:'line', a, b} or a circle {kind:'circle', c, r}; its left side as an area: a
  // half-plane, a disc, or the complement of a disc
  function shapeOf(g, area = false) {
    if (!g) return null;
    const G = geomOf(g);
    if (G.line) return area ? { kind: 'halfplane', a: G.p, b: add(G.p, G.d) } : { kind: 'line', a: G.p, b: add(G.p, G.d) };
    if (!area) return { kind: 'circle', c: G.c, r: G.r };
    return G.inside ? { kind: 'disc', c: G.c, r: G.r } : { kind: 'disc', c: G.c, r: G.r, complement: true };
  }

  // =====================================================================================================
  // v16 CORE (notes/constructions-v16/SPEC.md): constructions on the app's own shapes. Everything below works on
  // the app's state {shapes, targets, steps, nextId} and its shape objects; no DOM, no strings (reasons are codes).
  // =====================================================================================================
  const TAU = 2 * Math.PI;
  const isXY = (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const eqP = (a, b) => a[0] === b[0] && a[1] === b[1];
  const flipG = (g) => (g ? Object.assign({ A: -g.A, B: [-g.B[0], -g.B[1]], C: -g.C, o: g.o.slice() }, g.e ? { e: g.e } : {}) : g);

  // ---------------------------------------------------------------- the exact form (SPEC 2.2)
  // the form of a shape's own fields: disc and circle (the disc, or its complement), half-plane and line (left side)
  function formOfFields(s) {
    if (!s) return null;
    if ((s.kind === 'disc' || s.kind === 'circle') && isXY(s.c) && s.r > 0 && Number.isFinite(s.r)) {
      // anchored at the centre: A = 1 / r, B = 0, C = -r (|B|^2 - AC = 1)
      const g = { A: 1 / s.r, B: [0, 0], C: -s.r, o: s.c.slice() };
      return s.kind === 'disc' && s.complement ? flipG(g) : g;
    }
    if ((s.kind === 'halfplane' || s.kind === 'line') && isXY(s.a) && isXY(s.b)) {
      const g = line2(s.a, s.b);
      return g && s.kind === 'halfplane' && s.complement ? flipG(g) : g;
    }
    return null;
  }
  // Constr.formOf(shape): the runtime gcircle form s._g when present, else the form of the shape's fields
  function formOf(s) { return (s && s._g) || formOfFields(s); }
  // [f, fx, fy] at z (float64, relative to o); f < 0 inside (the left side), f / 2 the signed distance near the curve
  function level(G, z) {
    const ux = z[0] - G.o[0], uy = z[1] - G.o[1];
    return [G.A * (ux * ux + uy * uy) + 2 * (G.B[0] * ux + G.B[1] * uy) + G.C, 2 * (G.A * ux + G.B[0]), 2 * (G.A * uy + G.B[1])];
  }
  // the same curve anchored at its point nearest z0 (exact algebra for a quadratic: B' = B + A (o' - o), C' = f(o'))
  // (one argument, the proof of concept's form: anchored at the point nearest 0, C = 0 exactly)
  function reanchor(G, z0) {
    if (z0 == null) { const o = projectForm(G, [0, 0]); return { A: G.A, B: add(G.B, scl(sub(o, G.o), G.A)), C: 0, o: o.slice() }; }
    const o2 = projectForm(G, z0);      // ([review math-1]: never through the centre)
    if (!isXY(o2)) return Object.assign({}, G);
    const du = [o2[0] - G.o[0], o2[1] - G.o[1]];
    const B2 = [G.B[0] + G.A * du[0], G.B[1] + G.A * du[1]];
    const C2 = level(G, o2)[0];
    const out = { A: G.A, B: B2, C: C2, o: o2 };
    if (G.thru0) out.thru0 = true;
    return out;
  }
  // the Moebius map with 0, 1, inf -> p, q, r: { map(t), inv(z) } (real t runs along the generalized circle p, q, r)
  function mob3obj(p, q, r) {
    return { map: (t) => mob3t(p, q, r, t), inv: (z) => mob3inv(p, q, r, z) };
  }
  const mob3t = (P, Q, R, t) => {
    if (!Number.isFinite(t)) return R;
    const qp = sub(Q, P), rq = sub(R, Q);
    return div(add(scl(mul(R, qp), t), mul(P, rq)), add(scl(qp, t), rq));
  };
  // [review math-12] the same map when one of P, Q, R is infinity (its limit, so a glider does not jump when a meet
  // of lines turns parallel): R = inf: P + t (Q - P); P = inf: R + (Q - R) / t; Q = inf: (R t - P) / (t - 1)
  function mob3x(P, Q, R, t) {
    if (!Number.isFinite(t)) return isInf(R) ? INF : R.slice();
    if (isInf(R)) return add(P, scl(sub(Q, P), t));
    if (isInf(P)) return t === 0 ? INF : add(R, scl(sub(Q, R), 1 / t));
    if (isInf(Q)) return t === 1 ? INF : scl(sub(scl(R, t), P), 1 / (t - 1));
    return mob3t(P, Q, R, t);
  }
  function mob3invx(P, Q, R, z) {
    let w;
    if (isInf(R)) w = div(sub(z, P), sub(Q, P));
    else if (isInf(P)) w = div(sub(R, Q), sub(R, z));
    else if (isInf(Q)) w = div(sub(z, P), sub(z, R));
    else return mob3inv(P, Q, R, z);
    return w[0];
  }
  // the M(R) parametrization of a form anchored on its curve (C = 0): z(tau) = o + i B tau / (1 - i A tau / 2):
  // arc length near o, the antipode (A != 0) or infinity (A = 0) at tau = inf; continuous through A = 0 (SPEC 2.2 [C7])
  function mR(G, tau) {
    if (!Number.isFinite(tau)) return G.A === 0 ? INF : [G.o[0] - 2 * G.B[0] / G.A, G.o[1] - 2 * G.B[1] / G.A];
    const num = [-G.B[1] * tau, G.B[0] * tau], den = [1, -G.A * tau / 2];
    const w = div(num, den);
    return [G.o[0] + w[0], G.o[1] + w[1]];
  }

  // ---------------------------------------------------------------- refs
  // ref: {s} a point shape | {s, h} a handle | {zp: uid, kind, id, i, step} a zero or pole of f1 | {inf: 1} |
  //      {s, part} a curve piece (meet, glider) | {img: id} F(z0) of X's point shape (targets only)
  const isPointRef = (r) => !!r && typeof r === 'object' && (r.inf === 1 || r.inf === true || typeof r.zp === 'string' || typeof r.img === 'string' || (typeof r.s === 'string' && r.part == null));
  const isCurveRef = (r) => !!r && typeof r === 'object' && typeof r.s === 'string' && Number.isInteger(r.part) && r.part >= 0;
  function refKey(r) {
    if (!r) return '?';
    if (r.inf) return 'inf';
    // [v16.5 rail SPEC 3.2] a construction's pending pick (a point target while the draft is open); a shown display curve
    // not yet a shape ({disp}); a crossing by its two curves and its index or seed (never 's:undefined')
    if (Number.isInteger(r.pend)) return `pend:${r.pend}`;
    if (typeof r.disp === 'string') return `d:${r.disp}`;
    if (Array.isArray(r.meet)) return `m:${r.meet.map(refKey).sort().join('|')}:${r.index != null ? r.index : isXY(r.seed) ? r.seed.map((v) => +v.toPrecision(12)).join(',') : '?'}`;
    if (typeof r.zp === 'string') return `zp:${r.zp}:${r.id}`;
    if (typeof r.img === 'string') return `img:${r.img}`;
    if (r.part != null) return `c:${r.s}:${r.part}`;
    return r.h ? `s:${r.s}:${r.h}` : `s:${r.s}`;
  }
  const lists = (state) => [Array.isArray(state.shapes) ? state.shapes : [], Array.isArray(state.targets) ? state.targets : []];
  function index(state) {
    const m = new Map();
    lists(state).forEach((L, plane) => L.forEach((s, i) => { if (s && s.id) m.set(s.id, { s, plane, i }); }));
    return m;
  }
  // the position handles of a shape (Region.handlesOf when the app's Region is loaded; the same keys otherwise)
  function handlePos(s, h) {
    if (Region.handlesOf && Region.KINDS && Region.KINDS[s.kind]) {
      try { const hs = Region.handlesOf(s); for (const [k, z] of hs) if (k === h) return [z.re, z.im]; } catch (e) { /* */ }
      return null;
    }
    if (/^v\d+$/.test(h)) { const p = s.pts && s.pts[+h.slice(1)]; return isXY(p) ? p.slice() : null; }
    if (h === 'r' && isXY(s.c)) return [s.c[0] + s.r, s.c[1]];
    if ((h === 'r1' || h === 'r2') && isXY(s.c)) return [s.c[0] + s[h], s.c[1]];
    return isXY(s[h]) ? s[h].slice() : null;
  }
  const handleKeys = (s) => {
    if (Region.handlesOf && Region.KINDS && Region.KINDS[s.kind]) { try { return Region.handlesOf(s).map((x) => x[0]); } catch (e) { return []; } }
    const out = [];
    for (const k of ['p', 'a', 'b', 'm', 'c']) if (isXY(s[k])) out.push(k);
    if (Array.isArray(s.pts)) s.pts.forEach((_, i) => out.push('v' + i));
    if (s.r != null) out.push('r');
    return out;
  };
  const RADIUS_KEYS = new Set(['r', 'r1', 'r2']);
  const U = (code, args) => ({ undef: { code, args: args || {} } });

  // ---------------------------------------------------------------- steps: uids and zero ids (SPEC 1.2 [C12])
  // ids come from the shapes' counter (state.nextId), with their own prefixes: steps 'f', zeros and poles 'q'
  // [review regress-1] the shapes' counter (state.nextId) is left alone: step and zero ids have their own prefixes,
  // and a run-time counter skips every id in use, including the ids of refs whose step or zero is gone (so a stale ref
  // never finds a new owner). Ids nothing refers to are not saved (stripIds), so a scene without constructions saves
  // and links as in v15.1
  function freshId(state, prefix, taken) {
    let n = Number.isInteger(state._idn) && state._idn > 0 ? state._idn : 1;
    while (taken.has(prefix + n)) n++;
    state._idn = n + 1;
    taken.add(prefix + n);
    return prefix + n;
  }
  function takenIds(state) {
    const t = new Set();
    for (const L of lists(state)) for (const s of L) {
      if (!s) continue;
      if (s.id) t.add(s.id);
      for (const { ref } of (isNode(s) ? refsOf(s) : [])) if (ref && typeof ref.zp === 'string') { t.add(ref.zp); if (typeof ref.id === 'string') t.add(ref.id); }
    }
    for (const st of state.steps || []) {
      if (st && typeof st.uid === 'string') t.add(st.uid);
      if (st && st.zpIds) for (const k of ['zeros', 'poles']) for (const id of st.zpIds[k] || []) t.add(id);
    }
    return t;
  }
  // the step uids some shape refers to (a zero, or a step by uid)
  function referencedSteps(state) {
    const out = new Set();
    for (const L of lists(state)) for (const s of L) if (s && isNode(s)) for (const { ref } of refsOf(s)) if (ref && typeof ref.zp === 'string') out.add(ref.zp);
    return out;
  }
  // Constr.idReplacer(state): a JSON.stringify replacer that leaves out uid and zpIds of the steps nothing refers to
  // (and run-time fields, as the app's noRuntime does) [review regress-1]
  function idReplacer(state) {
    const used = referencedSteps(state || {});
    return function (k, v) {
      if (typeof k === 'string' && k[0] === '_') return undefined;
      if ((k === 'uid' || k === 'zpIds') && this && typeof this === 'object' && 'params' in this && 'type' in this && !used.has(this.uid)) return undefined;
      return v;
    };
  }
  // syncSteps(state, env): every step gets a unique uid; every zeros-and-poles step zpIds parallel to its lists. A list
  // whose length changed is matched to its ids greedily by nearest value (ties by index) against the last values seen
  // (st._zpv, runtime); values left over get fresh ids, ids left over are removed. Returns true if anything changed.
  // [UX54] zpNums, parallel too, are the numbers the zeros and poles are called by (ζ₃, p₁): each keeps its number while
  // others come and go, a new one takes the next after the largest, and they are saved (a save without them, from an
  // earlier build, numbers by place, as that build did)
  function syncSteps(state, env) {
    let ch = false;
    const steps = Array.isArray(state.steps) ? state.steps : [];
    const taken = takenIds(state), seen = new Set();
    for (const st of steps) {
      if (!st || typeof st !== 'object') continue;
      if (typeof st.uid !== 'string' || !/^f\d+$/.test(st.uid) || seen.has(st.uid)) { if (st.uid != null) taken.delete(st.uid); st.uid = freshId(state, 'f', taken); ch = true; }
      seen.add(st.uid);
      if (st.type !== 'zp') { if (st.zpIds) { delete st.zpIds; ch = true; } continue; }
      if (!st.zpIds || typeof st.zpIds !== 'object') { st.zpIds = { zeros: [], poles: [] }; ch = true; }
      const prevV = st._zpv || {};
      const nowV = {};
      const nums0 = st.zpNums && typeof st.zpNums === 'object' ? st.zpNums : {};
      const nums = {};
      for (const kind of ['zeros', 'poles']) {
        const vals = env && env.zpAll ? env.zpAll(st, kind) : [];
        nowV[kind] = vals;
        let ids = Array.isArray(st.zpIds[kind]) ? st.zpIds[kind].filter((x) => typeof x === 'string') : [];
        if (new Set(ids).size !== ids.length) ids = [...new Set(ids)];
        // (the saved numbers, when they are a list of distinct positive integers as long as ids, or as the values)
        const n0 = Array.isArray(nums0[kind]) && nums0[kind].every((x) => Number.isInteger(x) && x > 0) && new Set(nums0[kind]).size === nums0[kind].length ? nums0[kind] : null;
        let nk = n0 && n0.length === ids.length ? n0.slice() : null;
        if (ids.length !== vals.length) {
          const old = Array.isArray(prevV[kind]) && prevV[kind].length === ids.length ? prevV[kind] : null;
          const out = new Array(vals.length).fill(null);
          if (old && vals.length) {
            // greedy nearest value: all (old, new) pairs by distance, ties by index
            const pairs = [];
            for (let i = 0; i < ids.length; i++) for (let j = 0; j < vals.length; j++) {
              const a = old[i], b = vals[j];
              const d = a && b ? Math.hypot(a[0] - b[0], a[1] - b[1]) : (a || b ? Infinity : 0);
              pairs.push([d, i, j]);
            }
            pairs.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
            const usedI = new Set();
            for (const [d, i, j] of pairs) { if (!(d < Infinity) || usedI.has(i) || out[j]) continue; usedI.add(i); out[j] = ids[i]; }
          } else for (let j = 0; j < Math.min(ids.length, vals.length); j++) out[j] = ids[j];
          for (let j = 0; j < out.length; j++) if (!out[j]) { out[j] = freshId(state, 'q', taken); rebindZero(state, st, kind, out[j], vals[j], ids); }
          // the numbers follow the ids; a load (no ids yet) keeps the saved ones; the new take the next after the largest
          if (!ids.length && n0 && n0.length === vals.length) nk = n0.slice();
          else {
            const byId = new Map(nk ? ids.map((id, i) => [id, nk[i]]) : []);
            nk = out.map((id) => (byId.has(id) ? byId.get(id) : null));
            let next = Math.max(0, ...nk.filter((x) => x != null)) + 1;
            nk = nk.map((x) => (x != null ? x : next++));
          }
          ids = out; ch = true;
        }
        if (!nk) nk = vals.map((v, i) => i + 1);
        st.zpIds[kind] = ids;
        nums[kind] = nk;
      }
      if (JSON.stringify(nums) !== JSON.stringify(nums0)) { st.zpNums = nums; ch = true; }
      st._zpv = nowV;
    }
    return ch;
  }
  // a zero (pole) new in the list, at the value a removed one last had: the refs that lost it take it again [user-6]
  function rebindZero(state, st, kind, id, v, live) {
    if (!isXY(v)) return;
    const tol = 1e-9 * (1 + Math.hypot(v[0], v[1]));
    for (const L of lists(state)) for (const s of L) {
      if (!s || !isNode(s)) continue;
      for (const { ref } of refsOf(s)) {
        if (!ref || ref.zp !== st.uid || ref.kind !== kind || live.includes(ref.id)) continue;
        const lv = lastZp.get(ref);
        if (lv && Math.hypot(lv[0] - v[0], lv[1] - v[1]) <= tol) ref.id = id;
      }
    }
  }
  // zpRemoveId(step, kind, i): the id of the removed zero or pole goes with it (call before the list loses item i)
  function zpRemoveId(st, kind, i) {
    if (!st || !st.zpIds || !Array.isArray(st.zpIds[kind])) return null;
    const [id] = st.zpIds[kind].splice(i, 1);
    if (st._zpv && Array.isArray(st._zpv[kind])) st._zpv[kind].splice(i, 1);
    if (st.zpNums && Array.isArray(st.zpNums[kind])) st.zpNums[kind].splice(i, 1);
    return id || null;
  }
  // the number zero (pole) i of a 'zp' step is called by: ζₙ, pₙ (zpNums, else its place, 1-based)
  function zpNum(st, kind, i) {
    const a = st && st.zpNums && st.zpNums[kind];
    return a && Number.isInteger(a[i]) ? a[i] : i + 1;
  }
  // renumber the zeros and poles of a 'zp' step by their places again (the card's Renumber)
  function zpRenumber(st) {
    if (!st || st.type !== 'zp' || !st.zpNums) return false;
    let ch = false;
    for (const kind of ['zeros', 'poles']) {
      const a = st.zpNums[kind];
      if (Array.isArray(a) && a.some((x, i) => x !== i + 1)) { st.zpNums[kind] = a.map((x, i) => i + 1); ch = true; }
    }
    return ch;
  }

  // ---------------------------------------------------------------- resolving a point ref
  // ctx: {state, idx (index()), env: {zp(st, kind, i) -> [x, y] | null, F(z) -> [x, y] | INF | null}}
  function zpMark(ref, st, i) {
    const j = Number.isInteger(i) ? i : (Number.isInteger(ref.i) ? ref.i : 0);
    // (n: its number now, so a reason still names a zero after it is removed)
    return { kind: ref.kind, i: j, n: zpNum(st, ref.kind, j), step: st ? (ctxStepIndex(st) + 1) : null };
  }
  let ctxSteps = null;
  // [review user-6] the last value each zero ref resolved to (run time): the reason names a removed zero by its value,
  // and a zero added back at that value takes the ref again (syncSteps)
  const lastZp = typeof WeakMap !== 'undefined' ? new WeakMap() : new Map();
  const ctxStepIndex = (st) => (ctxSteps ? ctxSteps.indexOf(st) : -1);
  function resolveIn(ctx, ref, plane) {
    if (!ref || typeof ref !== 'object') return U('argUndef', { x: null });
    if (ref.inf) return { inf: true };
    if (typeof ref.zp === 'string') {
      const steps = ctx.state.steps || [];
      ctxSteps = steps;
      const k = steps.findIndex((st) => st && st.uid === ref.zp);
      if (k < 0) return U('stepRemoved', { mark: zpMark(ref, null) });
      const st = steps[k];
      const ids = (st.zpIds && st.zpIds[ref.kind]) || [];
      const i = ids.indexOf(ref.id);
      if (i < 0) { const lv = lastZp.get(ref); return U('zpRemoved', lv ? { mark: zpMark(ref, st), v: lv.slice() } : { mark: zpMark(ref, st) }); }
      if (k !== 0 || st.type !== 'zp') return U('zpNotF1', { mark: zpMark(ref, st, i), f: k + 1 });
      const v = ctx.env && ctx.env.zp ? ctx.env.zp(st, ref.kind, i) : null;
      if (!isXY(v)) return U('argUndef', { x: { mark: zpMark(ref, st, i) } });
      lastZp.set(ref, v.slice());
      return { z: v.slice() };
    }
    if (typeof ref.img === 'string') {
      const e = ctx.idx.get(ref.img);
      if (!e || e.plane !== 0 || e.s.kind !== 'point') return U('argUndef', { x: ref.img });
      if (e.s.cundef || e.s.undef) return U('argUndef', { x: ref.img });
      if (e.s._atInf) return ctx.env && ctx.env.F ? norm(ctx.env.F(INF)) : U('argUndef', { x: ref.img });
      const w = ctx.env && ctx.env.F ? ctx.env.F(e.s.p) : null;
      return norm(w, ref.img);
    }
    const e = ctx.idx.get(ref.s);
    if (!e || e.plane !== plane) return U('argUndef', { x: ref.s });
    const s = e.s;
    if (s.cundef || s.undef) return U('argUndef', { x: s.id });
    if (!ref.h) {
      if (s.kind !== 'point') return U('argUndef', { x: s.id });
      if (s._atInf) return { inf: true };
      return isXY(s.p) ? { z: s.p.slice() } : U('argUndef', { x: s.id });
    }
    const z = handlePos(s, ref.h);
    return z ? { z } : U('argUndef', { x: s.id });
  }
  function norm(w, id) {
    if (w === INF) return { inf: true };
    if (isXY(w)) return { z: w.slice() };
    if (w && Number.isFinite(w.re) && Number.isFinite(w.im)) return { z: [w.re, w.im] };
    return U('argUndef', { x: id || null });
  }
  // Constr.resolve(state, ref, plane, env)
  function resolve(state, ref, plane, env) { return resolveIn({ state, idx: index(state), env: env || {} }, ref, plane | 0); }

  // ---------------------------------------------------------------- pieces of a shape's curves (SPEC 2.4, 2.5)
  // {part, kind: 'line'|'circle'|'traced', G, a, b, lo, hi (line: z = a + t (b - a), t in [lo, hi]), c, r, a0, span
  //  (circle: angles a0 .. a0 + span, ccw), closed, period, poly ({pts, closed}: the whole polygon, for gliders),
  //  pts (traced)}
  function linePiece(a, b, lo, hi, part, extra) {
    const G = line2(a, b);
    if (!G) return null;
    return Object.assign({ part, kind: 'line', G, a: a.slice(), b: b.slice(), lo, hi, closed: false, period: 0 }, extra || {});
  }
  function circlePiece(c, r, part, a0, span, G) {
    if (!(r > 0) || !isXY(c)) return null;
    const full = !(span < TAU);
    return { part, kind: 'circle', G: G || { A: 1 / r, B: [0, 0], C: -r, o: c.slice() }, c: c.slice(), r, a0: a0 || 0, span: full ? TAU : span, closed: full, period: full ? 1 : 0 };
  }
  // [review math-8] a slot that is gone (a side of zero length, a sector's missing edge): it keeps its part number, so
  // the parts after it are never renumbered, and it meets nothing
  const NONE = (part) => ({ part, kind: 'none', closed: false, period: 0 });
  // the traced components of a formula or freehand curve: [{pts: [[x, y]...], g?: (x, y) -> level}] (env.trace gives
  // components; an older env a flat list)
  function compsOf(tr) {
    if (!tr) return [];
    if (Array.isArray(tr) && tr.length && isXY(tr[0])) return [{ pts: tr }];
    return (Array.isArray(tr) ? tr : []).filter((c) => c && Array.isArray(c.pts) && c.pts.length >= 2);
  }
  function pieces(s, env) {
    if (!s) return [];
    const out = [];
    const push = (p) => { if (p) { p.part = out.length; out.push(p); } };
    const slot = (p) => { const k = out.length; out.push(p || NONE(k)); out[k].part = k; };
    if (s._g) {
      const G = s._g;
      if (G.A === 0) push(Object.assign(linePiece(geomOf(G).p, add(geomOf(G).p, geomOf(G).d), -Infinity, Infinity, 0) || {}, { G }));
      else { const g = geomOf(G); push(circlePiece(g.c, g.r, 0, 0, TAU, G)); }
      if (out[0] && s.def && (s.def.op === 'circle3' || s.def.op === 'perp' || (s.def.op === 'touch' && !(s.def.args[2] && s.def.args[2].inf)))) out[0].c3 = true;
      // [v16.4 segments] Inside C only: the arc (its carrier's kind, G and c3 kept), t from 0 to 1 between its ends
      if (out[0] && s._seg && s.def && s.def.op === 'perp' && (s.def.seg || s.def.between)) Object.assign(out[0], { seg: s._seg, closed: false, period: 0 });
      return out.filter((p) => p && p.kind);
    }
    switch (s.kind) {
      case 'line': case 'halfplane': if (isXY(s.a) && isXY(s.b)) push(linePiece(s.a, s.b, -Infinity, Infinity, 0)); break;
      case 'segment': if (isXY(s.a) && isXY(s.b)) push(linePiece(s.a, s.b, 0, 1, 0)); break;
      case 'ray': if (isXY(s.a) && isXY(s.b)) push(linePiece(s.a, s.b, 0, Infinity, 0)); break;
      case 'circle': case 'disc': if (isXY(s.c)) push(circlePiece(s.c, s.r, 0, 0, TAU)); break;
      case 'annulus': if (isXY(s.c)) { slot(circlePiece(s.c, Math.min(s.r1, s.r2), 0, 0, TAU)); slot(circlePiece(s.c, Math.max(s.r1, s.r2), 1, 0, TAU)); } break;
      case 'arc': {
        // [review math-7] the exact form of the circle through a, m, b (its huge radius loses nothing), tested and
        // parametrized through a, m, b; c, r and the angles are for drawing and distances only
        if (!(isXY(s.a) && isXY(s.m) && isXY(s.b))) break;
        const G = circle3(s.a, s.m, s.b);
        if (!G) break;
        const arc3 = [s.a.slice(), s.m.slice(), s.b.slice()], om = orientD(s.a, s.m, s.b);
        if (G.A === 0) { push(Object.assign(linePiece(s.a, s.b, 0, 1, 0), { G, gen: true, arc3, om })); break; }
        const g = geomOf(G);
        const ang = (p) => Math.atan2(p[1] - g.c[1], p[0] - g.c[0]);
        const ccw = (x, from) => ((((x - from) % TAU) + TAU) % TAU);
        const ta = ang(s.a), tb = ang(s.b), tm = ang(s.m);
        // from a counterclockwise when m comes before b, else from b
        if (ccw(tm, ta) < ccw(tb, ta)) push(Object.assign(circlePiece(g.c, g.r, 0, ta, ccw(tb, ta), G), { from: 'a', gen: true, arc3, om }));
        else push(Object.assign(circlePiece(g.c, g.r, 0, tb, ccw(ta, tb), G), { from: 'b', gen: true, arc3, om }));
        break;
      }
      case 'rect': case 'polygon': {
        let pts;
        if (s.kind === 'rect') {
          if (!(isXY(s.a) && isXY(s.b))) break;
          const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1]);
          pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
        } else pts = (s.pts || []).filter(isXY);
        const poly = { pts, closed: true };
        // one slot per side, part = the side's index [math-8]
        for (let i = 0; i < pts.length; i++) slot(linePiece(pts[i], pts[(i + 1) % pts.length], 0, 1, i, { poly, side: i }));
        break;
      }
      case 'sector': {
        // fixed slots [math-8]: 0 the first edge, 1 the arc, 2 the second edge
        if (!isXY(s.c)) break;
        const span = (((s.t2 - s.t1) % 360) + 360) % 360 || 360, t1 = s.t1 * Math.PI / 180, t2 = (s.t1 + span) * Math.PI / 180;
        const u1 = [Math.cos(t1), Math.sin(t1)], u2 = [Math.cos(t2), Math.sin(t2)];
        if (s.r > 0) {
          slot(span < 360 ? linePiece(s.c, add(s.c, scl(u1, s.r)), 0, 1, 0) : null);
          slot(circlePiece(s.c, s.r, 1, t1, span * Math.PI / 180));
          slot(span < 360 ? linePiece(add(s.c, scl(u2, s.r)), s.c, 0, 1, 2) : null);
        } else {
          slot(span < 360 ? linePiece(s.c, add(s.c, u1), 0, Infinity, 0) : null);
          slot(null);
          slot(span < 360 ? linePiece(s.c, add(s.c, u2), 0, Infinity, 2) : null);
        }
        break;
      }
      case 'curve': if (Array.isArray(s.pts) && s.pts.length >= 2) { const pts = s.pts.filter(isXY); push({ kind: 'traced', pts, comps: [{ pts }], closed: false, period: 0 }); } break;
      case 'fcurve': {
        // [review math-11] one piece, its components kept apart (never joined into one polyline: no phantom crossings),
        // each with its level function for the float64 Newton step
        const comps = compsOf(env && env.trace ? env.trace(s) : null);
        if (comps.length) push({ kind: 'traced', pts: comps[0].pts, comps, closed: false, period: 0, formula: true });
        break;
      }
    }
    return out;
  }
  // on the piece (to within a relative tolerance)? line: its t range; circle: its angular range; arc: the side of its
  // chord that holds m [math-7]
  function onPiece(pc, z) {
    if (!pc || pc.kind === 'none') return false;
    if (pc.seg) {
      // [v16.4 segments SPEC 2.4] the ends (bitwise, or within 1e-9 of the arc's size), else by u along the arc
      const q = pc.seg;
      if (z === INF) return q.ends.some(isInf) || (pc.G.A === 0 && segInU(q, 0.5));
      for (const e of q.ends) if (isXY(e) && (eqP(z, e) || abs(sub(z, e)) <= 1e-9 * q.L)) return true;
      return segInU(q, segU(q.H, q.k, z));
    }
    if (z === INF) return pc.kind === 'line' && (pc.hi === Infinity || pc.lo === -Infinity);
    if (pc.arc3 && pc.om !== 0) {
      const [a, , b] = pc.arc3;
      if (eqP(z, a) || eqP(z, b)) return true;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (Math.min(Math.hypot(z[0] - a[0], z[1] - a[1]), Math.hypot(z[0] - b[0], z[1] - b[1])) <= 1e-9 * L) return true;
      const oz = orient(a, z, b);
      return oz !== 0 && (oz > 0) === (pc.om > 0);
    }
    if (pc.kind === 'line') {
      if (pc.lo === -Infinity && pc.hi === Infinity) return true;
      const d = sub(pc.b, pc.a), L = dot(d, d), t = dot(sub(z, pc.a), d) / L, e = 1e-9;
      return t >= pc.lo - e && t <= pc.hi + e;
    }
    if (pc.kind === 'circle') {
      if (pc.closed) return true;
      const a = Math.atan2(z[1] - pc.c[1], z[0] - pc.c[0]);
      const x = ((((a - pc.a0) % TAU) + TAU) % TAU);
      return x <= pc.span + 1e-9 || x >= TAU - 1e-9;
    }
    return true;
  }
  // two pieces are "two lines" [C6] only by kind: lines, segments, rays, half-plane edges, polygon sides, bisectors,
  // 3-point circles that are lines by incidence. A 3-point circle or an arc that is a line for the moment keeps the
  // entering rule, which orders [p, inf] continuously through that instant [review math-5]
  const lineByKind = (pc) => pc.kind === 'line' && !pc.gen && (!pc.c3 || !!(pc.G && pc.G.byInc));
  // the meets of two pieces with the entering rule: [{z | INF | null, index}] (two lines: one, index 'finite') [C6]
  function meetsOf(pa, pb) {
    if (!pa || !pb || pa.kind === 'none' || pb.kind === 'none') return [];
    if (pa.kind === 'traced' || pb.kind === 'traced') return [];
    const tp = touchAt(pa, pb);
    if (tp != null) return lineByKind(pa) && lineByKind(pb) ? [{ z: tp, index: 'finite' }] : [{ z: tp, index: 0 }, { z: tp, index: 1 }];
    const sa = segAt(pa, pb);
    if (sa) return sa;
    // (review math-5) two hyperbolic lines of one C that share an end are limiting parallels: their carriers touch only
    // there, at an ideal point, which is no point of the plane, so neither index meets
    if (segParallel(pa, pb)) return lineByKind(pa) && lineByKind(pb) ? [{ z: null, index: 'finite' }] : [{ z: null, index: 0 }, { z: null, index: 1 }];
    if (lineByKind(pa) && lineByKind(pb)) {
      const m = meets0(pa.G, pb.G);
      return [{ z: m[0], index: 'finite' }];
    }
    const m = meets(pa.G, pb.G), out = [{ z: m[0], index: 0 }, { z: m[1], index: 1 }];
    if (m.coincide) out.coincide = true;
    return out;
  }
  // Constr.meets on pieces (spec name): [{z | INF, index}]
  function meetsPieces(pa, pb) { return meetsOf(pa, pb).filter((x) => x.z != null); }
  // polyline crossings of two traced (or sampled) pieces: per component [math-11]
  function polysOf(pc, box) {
    if (pc.kind === 'traced') return pc.comps || [{ pts: pc.pts }];
    // a carrier sampled finely inside the box (for a traced partner)
    const n = 400, out = [];
    if (pc.kind === 'line') {
      const c = Math.max(box.x1 - box.x0, box.y1 - box.y0) * 2, mid = [(box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2];
      const d = sub(pc.b, pc.a), L = abs(d), u = scl(d, 1 / L), t0 = dot(sub(mid, pc.a), u);
      let lo = t0 - c, hi = t0 + c;
      if (pc.lo > -Infinity) lo = Math.max(lo, pc.lo * L);
      if (pc.hi < Infinity) hi = Math.min(hi, pc.hi * L);
      for (let i = 0; i <= n; i++) out.push(add(pc.a, scl(u, lo + (hi - lo) * i / n)));
      return [{ pts: out }];
    }
    for (let i = 0; i <= n; i++) { const a = pc.a0 + pc.span * i / n; out.push([pc.c[0] + pc.r * Math.cos(a), pc.c[1] + pc.r * Math.sin(a)]); }
    return [{ pts: out }];
  }
  function segX(a, b, c, d) {
    const r = sub(b, a), s = sub(d, c), den = cross(r, s);
    if (den === 0) return null;
    const t = cross(sub(c, a), s) / den, u = cross(sub(c, a), r) / den;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add(a, scl(r, t)) : null;
  }
  function polyCross(P, Q) {
    const out = [];
    for (let i = 1; i < P.length; i++) for (let j = 1; j < Q.length; j++) {
      const a = P[i - 1], b = P[i], c = Q[j - 1], d = Q[j];
      if (Math.max(a[0], b[0]) < Math.min(c[0], d[0]) || Math.max(c[0], d[0]) < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) < Math.min(c[1], d[1]) || Math.max(c[1], d[1]) < Math.min(a[1], b[1])) continue;
      const x = segX(a, b, c, d);
      if (x) out.push({ z: x, h: Math.max(Math.hypot(b[0] - a[0], b[1] - a[1]), Math.hypot(d[0] - c[0], d[1] - c[1])) });
    }
    return out;
  }
  const bboxPts = (P) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return { x0, x1, y0, y1 }; };
  // the level function of a piece's component (a form: exact; a formula component: its g; freehand: none)
  function levelFn(pc, comp) {
    if (pc.kind === 'traced') return comp && typeof comp.g === 'function' ? comp.g : null;
    const G = pc.G;
    return G ? (x, y) => fOf(G, [x, y]) : null;
  }
  // [review math-11] Newton on two level functions from a polyline crossing, to float64 (central differences); the
  // estimate stays when it does not converge within the chord's reach h
  function newton2(z, fa, fb, h) {
    if (!fa || !fb) return z;
    let p = z.slice();
    for (let k = 0; k < 8; k++) {
      const e = 1e-7 * (1 + Math.abs(p[0]) + Math.abs(p[1]));
      const a = fa(p[0], p[1]), b = fb(p[0], p[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return z;
      if (a === 0 && b === 0) break;
      const ax = (fa(p[0] + e, p[1]) - fa(p[0] - e, p[1])) / (2 * e), ay = (fa(p[0], p[1] + e) - fa(p[0], p[1] - e)) / (2 * e);
      const bx = (fb(p[0] + e, p[1]) - fb(p[0] - e, p[1])) / (2 * e), by = (fb(p[0], p[1] + e) - fb(p[0], p[1] - e)) / (2 * e);
      const det = ax * by - ay * bx;
      if (!Number.isFinite(det) || det === 0) return z;
      const dx = (a * by - b * ay) / det, dy = (b * ax - a * bx) / det;
      p = [p[0] - dx, p[1] - dy];
      if (Math.hypot(dx, dy) <= 1e-15 * (1 + Math.abs(p[0]) + Math.abs(p[1]))) break;
    }
    return isXY(p) && Math.hypot(p[0] - z[0], p[1] - z[1]) <= 2 * h + 1e-12 ? p : z;
  }
  // the point of a level set nearest z (Newton along the gradient), within reach h of z
  function newton1(z, f, h) {
    if (!f) return z;
    let p = z.slice();
    for (let k = 0; k < 8; k++) {
      const e = 1e-7 * (1 + Math.abs(p[0]) + Math.abs(p[1]));
      const v = f(p[0], p[1]);
      if (!Number.isFinite(v)) return z;
      if (v === 0) break;
      const gx = (f(p[0] + e, p[1]) - f(p[0] - e, p[1])) / (2 * e), gy = (f(p[0], p[1] + e) - f(p[0], p[1] - e)) / (2 * e), g2 = gx * gx + gy * gy;
      if (!(g2 > 0)) return z;
      const dx = v * gx / g2, dy = v * gy / g2;
      p = [p[0] - dx, p[1] - dy];
      if (Math.hypot(dx, dy) <= 1e-15 * (1 + Math.abs(p[0]) + Math.abs(p[1]))) break;
    }
    return isXY(p) && Math.hypot(p[0] - z[0], p[1] - z[1]) <= 2 * h + 1e-12 ? p : z;
  }
  // the crossing of two pieces nearest z (traced pieces: the polyline crossing nearest the seed z, refined); box limits
  // the search ({x0, x1, y0, y1}, optional). Returns {z, index} | {z, seed} | null [C28]
  function meetNear(pa, pb, z, box) {
    if (!pa || !pb || pa.kind === 'none' || pb.kind === 'none') return null;
    const inBox = (p) => !box || (p[0] >= box.x0 && p[0] <= box.x1 && p[1] >= box.y0 && p[1] <= box.y1);
    if (pa.kind === 'traced' || pb.kind === 'traced') {
      const tp = pa.kind === 'traced' ? pa : pb;
      const b = box || bboxPts([].concat(...(tp.comps || [{ pts: tp.pts }]).map((c) => c.pts)));
      const xs = [];
      for (const ca of polysOf(pa, b)) for (const cb of polysOf(pb, b)) {
        for (const x of polyCross(ca.pts, cb.pts)) {
          const r = newton2(x.z, levelFn(pa, ca), levelFn(pb, cb), x.h);
          if (inBox(r)) xs.push(r);
        }
      }
      if (!xs.length) return null;
      xs.sort((p, q) => Math.hypot(p[0] - z[0], p[1] - z[1]) - Math.hypot(q[0] - z[0], q[1] - z[1]));
      return { z: xs[0], seed: xs[0] };
    }
    let best = null, bd = Infinity;
    for (const m of meetsOf(pa, pb)) {
      if (!m.z || m.z === INF || !onPiece(pa, m.z) || !onPiece(pb, m.z) || !inBox(m.z)) continue;
      const d = Math.hypot(m.z[0] - z[0], m.z[1] - z[1]);
      if (d < bd) { bd = d; best = { z: m.z, index: m.index }; }
    }
    return best;
  }
  // a point of a piece by its parameter (wraps on closed pieces) and the parameter of the point nearest z
  //   c3 (a circle through three points): S(t) = M(tan(pi t)), M(0, 1, inf) = P, Q, R: S(0) = P, S(1/4) = Q, S(1/2) = R
  //   (one of P, Q, R may be infinity: the limit map [math-12]); an arc a, m, b: S(t) = M(tan(pi t / 2)), M(0, 1, inf) =
  //   a, m, b: S(0) = a, S(1/2) = m, S(1) = b [math-7]
  function glide(pc, t, pts3) {
    if (!pc || !Number.isFinite(t) || pc.kind === 'none') return null;
    if (pc.kind === 'traced') return null;
    // [v16.4 segments] the arc: its ends bitwise at t <= 0 and t >= 1, else K's glider map at u0 + t D
    if (pc.seg) { const q = pc.seg; return t <= 0 ? cpz(q.ends[0]) : t >= 1 ? cpz(q.ends[1]) : segAtU(q, q.u0 + t * q.D); }
    if (pts3 && pts3.mr) {
      const u = (((t % 1) + 1) % 1), H = reanchorAt(pc.G, pts3.mr);
      return Math.abs(u - 0.5) < 1e-15 ? mR(H, Infinity) : mR(H, pts3.sg * pts3.s * Math.tan(Math.PI * u));
    }
    if (pts3) { const u = (((t % 1) + 1) % 1); if (Math.abs(u - 0.5) < 1e-15) return isInf(pts3[2]) ? INF : pts3[2].slice(); return mob3x(pts3[0], pts3[1], pts3[2], Math.tan(Math.PI * u)); }
    if (pc.arc3) {
      const [a, m, b] = pc.arc3;
      if (t <= 0) return a.slice();
      if (t >= 1) return b.slice();
      if (t === 0.5) return m.slice();
      return mob3t(a, m, b, Math.tan(Math.PI * t / 2));
    }
    if (pc.poly) {
      const P = pc.poly.pts, n = P.length;
      const u = pc.poly.closed ? ((t % n) + n) % n : t;
      const i = Math.min(n - 1, Math.max(0, Math.floor(u))), f = u - i, a = P[i], b = P[(i + 1) % n];
      return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
    }
    if (pc.kind === 'line') return [pc.a[0] + t * (pc.b[0] - pc.a[0]), pc.a[1] + t * (pc.b[1] - pc.a[1])];
    const u = pc.closed ? (((t % 1) + 1) % 1) : t, an = pc.a0 + u * (pc.closed ? TAU : pc.span);
    // [v16.5 rail SPEC 3.4] a whole circle from 0: cos and sin of the turn u, exact at the quarter turns, and the half-turn
    // partner the bitwise negation (a detent at i is i; t and t + 1/2 are antipodes)
    if (pc.closed && pc.a0 === 0) { const [cu, su] = turnCS(u); return [pc.c[0] + pc.r * cu, pc.c[1] + pc.r * su]; }
    return [pc.c[0] + pc.r * Math.cos(an), pc.c[1] + pc.r * Math.sin(an)];
  }
  // [v16.5 rail SPEC 3.4] the perpendicular circle through two gliders on C's own plain circle (no pts3, its t a turn
  // fraction) whose parameters are half a turn apart (to 2^-40): the line through C's centre and P, its normal on the side
  // of K's normal at P (the orientation of the circle it is the limit of). ctx: {idx}; G: perpForm's form. null: not that
  function antipodeLine(ctx, pc, cr, ra, rb, P, G) {
    if (!pc || pc.kind !== 'circle' || !pc.closed || pc.c3 || pc.arc3 || pc.seg || pc.a0 !== 0) return null;
    const tOf = (r) => {
      if (!r || typeof r.s !== 'string' || r.h || r.part != null) return null;
      const e = ctx.idx.get(r.s), d = e && e.s.def;
      if (!d || d.op !== 'glider' || !Array.isArray(d.args) || !d.args[0] || d.args[0].s !== cr.s || (d.args[0].part | 0) !== (cr.part | 0)) return null;
      return Number.isFinite(e.s.t) ? e.s.t : null;
    };
    const ta = tOf(ra), tb = tOf(rb);
    if (ta == null || tb == null) return null;
    const dt = tb - ta, f = dt - Math.floor(dt);
    if (!(Math.abs(f - 0.5) <= Math.pow(2, -40))) return null;
    const o = pc.c, v = sub(P, o), L = abs(v);
    if (!(L > 0)) return null;
    let n = [-v[1] / L, v[0] / L];
    if (n[0] * G.B[0] + n[1] * G.B[1] < 0) n = [-n[0], -n[1]];
    return gc(0, n, 0, o);
  }
  // (cos 2 pi u, sin 2 pi u) for u in [0, 1): reduced to a half turn and a quarter turn first
  function turnCS(u) {
    let sg = 1;
    if (u >= 0.5) { u -= 0.5; sg = -1; }
    let c, s;
    if (u < 0.25) { if (u === 0) { c = 1; s = 0; } else { const a = TAU * u; c = Math.cos(a); s = Math.sin(a); } }
    else { const v = u - 0.25; if (v === 0) { c = 0; s = 1; } else { const a = TAU * v; c = -Math.sin(a); s = Math.cos(a); } }
    return [sg * c + 0, sg * s + 0];
  }
  // ---------------------------------------------------------------- [v16.5 rail] the grid lattice and the pull off a rail
  // the finest drawn grid tier at least 14 px apart (gl.js drawGrid's tiers: 0.5, 1, 5, 10, 50, 100 times d0)
  const GRID_TIERS = [0.5, 1, 5, 10, 50, 100];
  function gridStep(s) {
    if (!(s > 0)) return 1;
    const d0 = Math.pow(10, Math.ceil(Math.log10(8 / s)));
    for (const m of GRID_TIERS) if (d0 * m * s >= 14) return +(d0 * m).toPrecision(12);
    return +(d0 * 100).toPrecision(12);
  }
  // [v16.5 fix rail-2, user-2] the detents may never quantize a rail: a circle drawn rPx px in radius takes the finest of
  // 15°, 30°, 45° and 90° whose arc is at least 5 detent radii R on screen, so one detent's window covers at most 40 % of
  // the rail (60 px per unit: 30° with a mouse, 90° with a finger, which then rests at 37°; 15° again zoomed in).
  // {deg, R} | null (a circle too small for any). A line's lattice detents: R capped at a fifth of the step
  const DETENT_DEG = [15, 30, 45, 90];
  function angleDetent(rPx, R) {
    if (!(rPx > 0) || !(R > 0)) return null;
    for (const deg of DETENT_DEG) { const arc = rPx * deg * Math.PI / 180; if (arc >= 5 * R) return { deg, R: Math.min(R, 0.2 * arc) }; }
    return null;
  }
  const latticeDetentR = (stepPx, R) => Math.max(0, Math.min(R, 0.2 * stepPx));
  // the zones of a pull (SPEC 2.3), in screen px: glide below glide; stretch up to free; let go at free held for dwell
  // ms, or at yank at once
  const RAIL = { mouse: { glide: 16, free: 40, yank: 80 }, touch: { glide: 24, free: 64, yank: 128 }, dwell: 120 };
  // railPull(state, d, now, touch) -> {zone: 'glide' | 'stretch' | 'free', state}: state is {since} (the time d first
  // reached free in the current run) or null; pure
  function railPull(state, d, now, touch) {
    const R = touch ? RAIL.touch : RAIL.mouse;
    if (!(d >= R.glide)) return { zone: 'glide', state: null };
    if (d >= R.yank) return { zone: 'free', state: null };
    if (d < R.free) return { zone: 'stretch', state: null };
    const since = state && Number.isFinite(state.since) ? state.since : now;
    return now - since >= RAIL.dwell ? { zone: 'free', state: null } : { zone: 'stretch', state: { since } };
  }
  function tRange(pc) {
    if (!pc || pc.kind === 'none') return [0, 0];
    if (pc.seg || pc.arc3) return [0, 1];
    if (pc.kind === 'line') return pc.poly ? [0, pc.poly.closed ? Infinity : pc.poly.pts.length - 1] : [pc.lo, pc.hi];
    if (pc.kind === 'circle') return pc.closed ? [-Infinity, Infinity] : [0, 1];
    return [0, 0];
  }
  function projectPiece(pc, z, pts3) {
    if (!pc || pc.kind === 'none') return null;
    if (pc.kind === 'traced') {
      let best = null, bd = Infinity, bc = null, bh = 0;
      for (const comp of pc.comps || [{ pts: pc.pts }]) {
        const P = comp.pts;
        for (let i = 1; i < P.length; i++) {
          const a = P[i - 1], b = P[i], d = sub(b, a), L = dot(d, d);
          const t = L > 0 ? Math.max(0, Math.min(1, dot(sub(z, a), d) / L)) : 0, q = add(a, scl(d, t));
          const dd = Math.hypot(q[0] - z[0], q[1] - z[1]);
          if (dd < bd) { bd = dd; best = q; bc = comp; bh = Math.sqrt(L); }
        }
      }
      if (!best) return null;
      const r = newton1(best, bc && typeof bc.g === 'function' ? bc.g : null, bh);     // [math-11] onto the level set
      return { seed: r, z: r };
    }
    if (pc.seg) {
      // [v16.4 segments] the nearest point of the carrier, by its u along the arc; off the arc, the nearer end (on the sphere)
      // (infinity, review math-2: u = 1/2; an infinite end is that end, else its t on the arc, else the nearer end)
      const q = pc.seg, w = isInf(z) ? INF : projectForm(pc.G, z), v = isInf(w) ? span1(q.u0, 0.5) : isXY(w) ? span1(q.u0, segU(q.H, q.k, w)) : NaN;
      const ie = isInf(z) ? q.ends.findIndex(isInf) : -1;
      const t = ie >= 0 ? ie : v <= q.D ? v / q.D : v >= 1 - 1e-12 ? 0 : (chordal(z, q.ends[0]) <= chordal(z, q.ends[1]) ? 0 : 1);
      return { t, z: glide(pc, t) };
    }
    if (pts3 && pts3.mr) {
      // tau of the nearest point w: w - o = i B tau / (1 - i A tau / 2), so tau = (w - o) / (i (B + A (w - o) / 2))
      const w = projectForm(pc.G, z), H = reanchorAt(pc.G, pts3.mr), v = sub(w, H.o);
      const den = [H.B[0] + H.A * v[0] / 2, H.B[1] + H.A * v[1] / 2], tau = div(v, [-den[1], den[0]])[0];
      let t = Math.atan(tau / (pts3.sg * pts3.s)) / Math.PI;
      if (!Number.isFinite(t)) t = 0.5;
      t = ((t % 1) + 1) % 1;
      return { t, z: glide(pc, t, pts3) };
    }
    if (pts3) {
      const w = projectForm(pc.G, z);
      let t = Math.atan(mob3invx(pts3[0], pts3[1], pts3[2], w)) / Math.PI;
      if (!Number.isFinite(t)) t = 0.5;
      t = ((t % 1) + 1) % 1;
      return { t, z: glide(pc, t, pts3) };
    }
    if (pc.arc3) {
      const [a, m, b] = pc.arc3;
      const w = projectForm(pc.G, z), tau = mob3inv(a, m, b, w);
      let t;
      if (tau >= 0 && tau < Infinity) t = 2 * Math.atan(tau) / Math.PI;
      else if (tau === Infinity) t = 1;
      else t = Math.hypot(z[0] - a[0], z[1] - a[1]) <= Math.hypot(z[0] - b[0], z[1] - b[1]) ? 0 : 1;
      return { t, z: glide(pc, t) };
    }
    if (pc.poly) {
      const P = pc.poly.pts, n = P.length;
      let best = null, bd = Infinity;
      for (let i = 0; i < (pc.poly.closed ? n : n - 1); i++) {
        const a = P[i], b = P[(i + 1) % n], d = sub(b, a), L = dot(d, d);
        const f = L > 0 ? Math.max(0, Math.min(1, dot(sub(z, a), d) / L)) : 0, q = add(a, scl(d, f));
        const dd = Math.hypot(q[0] - z[0], q[1] - z[1]);
        if (dd < bd) { bd = dd; best = { t: i + f, z: q }; }
      }
      return best;
    }
    if (pc.kind === 'line') {
      const d = sub(pc.b, pc.a), L = dot(d, d);
      let t = dot(sub(z, pc.a), d) / L;
      t = Math.max(pc.lo, Math.min(pc.hi, t));
      return { t, z: glide(pc, t) };
    }
    const an = Math.atan2(z[1] - pc.c[1], z[0] - pc.c[0]);
    let u = ((((an - pc.a0) % TAU) + TAU) % TAU) / (pc.closed ? TAU : pc.span);
    if (!pc.closed && u > 1) u = (u - 1) * pc.span < (TAU - pc.span) / 2 ? 1 : 0;
    return { t: u, z: glide(pc, u) };
  }
  // the distance from z to a piece (the snap): exact for a closed form, |f| / (|grad f| / 2 + 1), at any radius
  function pieceDist(pc, z) {
    if (!pc || pc.kind === 'none') return Infinity;
    if (pc.kind === 'circle' && pc.closed && pc.G) {
      const u = sub(z, pc.G.o), f = fOf(pc.G, z), g = 2 * Math.hypot(pc.G.A * u[0] + pc.G.B[0], pc.G.A * u[1] + pc.G.B[1]);
      return Math.abs(f) / (g / 2 + 1);
    }
    if (pc.kind === 'line' && !pc.arc3 && !pc.seg) {
      const d = [pc.b[0] - pc.a[0], pc.b[1] - pc.a[1]], L = d[0] * d[0] + d[1] * d[1];
      let t = ((z[0] - pc.a[0]) * d[0] + (z[1] - pc.a[1]) * d[1]) / L;
      t = Math.max(pc.lo, Math.min(pc.hi, t));
      return Math.hypot(pc.a[0] + t * d[0] - z[0], pc.a[1] + t * d[1] - z[1]);
    }
    if (pc.kind === 'traced') {
      let best = Infinity;
      for (const comp of pc.comps || [{ pts: pc.pts || [] }]) {
        const P = comp.pts;
        for (let i = 1; i < P.length; i++) {
          const a = P[i - 1], b = P[i], d = [b[0] - a[0], b[1] - a[1]], L = d[0] * d[0] + d[1] * d[1];
          const t = L > 0 ? Math.max(0, Math.min(1, ((z[0] - a[0]) * d[0] + (z[1] - a[1]) * d[1]) / L)) : 0;
          best = Math.min(best, Math.hypot(a[0] + t * d[0] - z[0], a[1] + t * d[1] - z[1]));
        }
      }
      return best;
    }
    const pr = projectPiece(pc, z);
    return pr && isXY(pr.z) ? Math.hypot(pr.z[0] - z[0], pr.z[1] - z[1]) : Infinity;
  }
  // a piece's bounding box (Infinity for unbounded pieces): the snap's prefilter [review regress-4]
  function pieceBox(pc) {
    if (!pc || pc.kind === 'none') return null;
    if (pc.kind === 'traced') return bboxPts([].concat(...(pc.comps || [{ pts: pc.pts }]).map((c) => c.pts)));
    if (pc.kind === 'line') {
      if (!(Number.isFinite(pc.lo) && Number.isFinite(pc.hi))) return { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity };
      const p = glide(Object.assign({}, pc, { arc3: null, poly: null }), pc.lo), q = glide(Object.assign({}, pc, { arc3: null, poly: null }), pc.hi);
      return bboxPts([p, q]);
    }
    if (pc.kind === 'circle') return Number.isFinite(pc.r) && pc.r < 1e12 ? { x0: pc.c[0] - pc.r, x1: pc.c[0] + pc.r, y0: pc.c[1] - pc.r, y1: pc.c[1] + pc.r } : { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: Infinity };
    return null;
  }

  // ---------------------------------------------------------------- the graph over the state (SPEC 3)
  const OPS = { circle3: { n: 3, pts: true }, perp: { n: 3, sig: ['c', 'p', 'p'] }, touch: { n: 3, sig: ['c', 'p', 'p'] }, tangent: { n: 2, sig: ['c', 'p'] }, midpoint: { n: 2, pts: true }, bisector: { n: 2, pts: true }, meet: { n: 2, curves: true }, glider: { n: 1, curves: true } };
  const POINT_OPS = new Set(['meet', 'glider', 'midpoint']);
  const isNode = (s) => !!s && ((s.at && typeof s.at === 'object') || (s.def && typeof s.def === 'object'));
  function refsOf(s) {
    const out = [];
    if (s.at && typeof s.at === 'object') for (const [k, r] of Object.entries(s.at)) out.push({ key: k, ref: r, at: true });
    if (s.def && Array.isArray(s.def.args)) s.def.args.forEach((r, i) => out.push({ key: i, ref: r, at: false }));
    return out;
  }
  // the shape ids a ref depends on (the shape of a handle, a point, a curve; X's point of an image ref)
  const refDep = (r) => (r && typeof r.s === 'string' ? r.s : r && typeof r.img === 'string' ? r.img : null);
  function structSig(state) {
    let sig = '';
    for (const L of lists(state)) {
      for (const s of L) if (s && isNode(s)) sig += s.id + JSON.stringify(s.at || 0) + (s.def ? s.def.op + JSON.stringify(s.def.args) : '') + ';';
      sig += '|';
    }
    return sig;
  }
  const graphCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function graphOf(state) {
    const sig = structSig(state);
    const c = graphCache && graphCache.get(state);
    if (c && c.sig === sig && c.shapes === state.shapes && c.targets === state.targets) return c;
    const idx = index(state);
    const nodes = new Map(), users = new Map();
    const all = [];
    lists(state).forEach((L) => L.forEach((s) => { if (s && s.id) all.push(s); }));
    for (const s of all) {
      if (!isNode(s)) continue;
      const deps = new Set(), zps = new Set();
      let img = false;
      for (const { ref } of refsOf(s)) {
        const d = refDep(ref);
        if (d && idx.has(d)) deps.add(d);
        if (ref && typeof ref.zp === 'string') zps.add(ref.zp);
        if (ref && typeof ref.img === 'string') img = true;
      }
      nodes.set(s.id, { id: s.id, s, deps, zps, img });
      for (const d of deps) { if (!users.has(d)) users.set(d, new Set()); users.get(d).add(s.id); }
    }
    // Kahn's algorithm, ties broken by list order (shapes, then targets)
    const pos = new Map(all.map((s, i) => [s.id, i]));
    const indeg = new Map();
    for (const n of nodes.values()) indeg.set(n.id, [...n.deps].filter((d) => nodes.has(d)).length);
    const ready = [...nodes.keys()].filter((k) => indeg.get(k) === 0).sort((a, b) => pos.get(a) - pos.get(b));
    const order = [];
    while (ready.length) {
      const x = ready.shift();
      order.push(x);
      for (const y of users.get(x) || []) {
        if (!nodes.has(y)) continue;
        indeg.set(y, indeg.get(y) - 1);
        if (indeg.get(y) === 0) {
          // insert by list order (ties by list order)
          let k = 0; while (k < ready.length && pos.get(ready[k]) < pos.get(y)) k++;
          ready.splice(k, 0, y);
        }
      }
    }
    const cyclic = new Set([...nodes.keys()].filter((k) => !order.includes(k)));
    const G = { sig, shapes: state.shapes, targets: state.targets, nodes, users, order, cyclic, idx };
    if (graphCache) graphCache.set(state, G);
    return G;
  }
  function closure(G, ids) {
    const seen = new Set(), st = [...ids];
    while (st.length) { const x = st.pop(); if (seen.has(x)) continue; seen.add(x); for (const y of G.users.get(x) || []) st.push(y); }
    return seen;
  }
  // Constr.graph(state): {order, users(id), sources(id), roots(id), excluded(id, key?)}
  function graph2(state) {
    const G = graphOf(state);
    const users = (id) => { const s = closure(G, [id]); s.delete(id); return s; };
    const sources = (id) => { const n = G.nodes.get(id); return n ? [...n.deps] : []; };
    const roots = (id) => {
      const out = new Set(), seen = new Set(), st = [id];
      while (st.length) {
        const x = st.pop();
        if (seen.has(x)) continue; seen.add(x);
        const n = G.nodes.get(x);
        if (!n || (x !== id && !n.deps.size && !n.zps.size)) { if (x !== id) out.add(x); continue; }
        for (const d of n.deps) st.push(d);
        if (n.zps.size) for (const z of n.zps) out.add('zp:' + z);
      }
      return out;
    };
    // the targets a gesture on shape id (handle key) may not use: itself, everything built on it, and the
    // co-arguments of every construction it (or that handle) defines [C11]
    const excluded = (id, key) => {
      const out = closure(G, [id]);
      for (const uid of G.users.get(id) || []) {
        const n = G.nodes.get(uid);
        if (!n) continue;
        const rs = refsOf(n.s);
        if (!rs.some(({ ref }) => refDep(ref) === id && (key == null || !ref.h || ref.h === key))) continue;
        for (const { ref } of rs) { const d = refDep(ref); if (d && d !== id) out.add(d); }
      }
      return out;
    };
    return { order: G.order.slice(), cyclic: [...G.cyclic], users, sources, roots, excluded, has: (id) => G.nodes.has(id) };
  }

  // ---------------------------------------------------------------- incidence (collinear by construction)
  function canonKey(ctx, ref, depth = 0) {
    if (!ref) return '?';
    if (depth > 32) return refKey(ref);
    if (typeof ref.s === 'string' && ref.part == null) {
      const e = ctx.idx.get(ref.s);
      if (e) {
        const k = ref.h || (e.s.kind === 'point' ? 'p' : null);
        if (k && e.s.at && e.s.at[k]) return canonKey(ctx, e.s.at[k], depth + 1);
      }
      return ref.h ? `s:${ref.s}:${ref.h}` : `s:${ref.s}`;
    }
    return refKey(ref);
  }
  const keyOf2 = (p, q) => [p, q].sort().join('|');
  function lineKeysOfCurve(ctx, cref, depth = 0) {
    const out = new Set();
    if (!cref || depth > 16) return out;
    const e = ctx.idx.get(cref.s);
    if (!e) return out;
    const s = e.s;
    const pcs = ctx.piecesOf(s);
    const pc = pcs[cref.part | 0];
    if (!pc || pc.kind !== 'line') return out;
    out.add(`L:${s.id}:${pc.part}`);
    if (['line', 'segment', 'ray', 'halfplane'].includes(s.kind) && !s.def && s.at && s.at.a && s.at.b) {
      const ka = canonKey(ctx, s.at.a), kb = canonKey(ctx, s.at.b);
      out.add(keyOf2(ka, kb));
      const ia = incOf(ctx, ka, depth + 1), ib = incOf(ctx, kb, depth + 1);
      for (const k of ia) if (ib.has(k)) out.add(k);
    }
    if (s.def && s.def.op === 'circle3' && s._g && s._g.A === 0 && s._g.byInc) {
      const ks = s.def.args.map((r) => canonKey(ctx, r));
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) out.add(keyOf2(ks[i], ks[j]));
    }
    return out;
  }
  function incOf(ctx, key, depth = 0) {
    const out = new Set();
    if (depth > 16) return out;
    const m = /^s:([^:]+)$/.exec(key);
    if (!m) return out;
    const e = ctx.idx.get(m[1]);
    if (!e || !e.s.def) return out;
    const d = e.s.def;
    if (d.op === 'meet') for (const c of d.args) for (const k of lineKeysOfCurve(ctx, c, depth + 1)) out.add(k);
    // [review math-4] a glider on a polygon or rectangle slides over every side: it is on no one side's line
    if (d.op === 'glider') {
      const ce = ctx.idx.get(d.args[0] && d.args[0].s), pc = ce ? ctx.piecesOf(ce.s)[d.args[0].part | 0] : null;
      if (!(pc && pc.poly)) for (const k of lineKeysOfCurve(ctx, d.args[0], depth + 1)) out.add(k);
    }
    if (d.op === 'midpoint') {
      const ka = canonKey(ctx, d.args[0]), kb = canonKey(ctx, d.args[1]);
      out.add(keyOf2(ka, kb));
      const ia = incOf(ctx, ka, depth + 1), ib = incOf(ctx, kb, depth + 1);
      for (const k of ia) if (ib.has(k)) out.add(k);
    }
    return out;
  }
  function collinearByRefs(ctx, refs) {
    const [p, q, r] = refs.map((x) => canonKey(ctx, x));
    const ip = incOf(ctx, p), iq = incOf(ctx, q), ir = incOf(ctx, r);
    if (ir.has(keyOf2(p, q)) || iq.has(keyOf2(p, r)) || ip.has(keyOf2(q, r))) return true;
    for (const k of ip) if (iq.has(k) && ir.has(k)) return true;
    return false;
  }

  // ---------------------------------------------------------------- evaluating one node
  const GEOM_FIELDS = ['p', 'a', 'b', 'c', 'r', 'complement'];
  function setKind(s, kind, fields) {
    const before = s.kind;
    for (const k of GEOM_FIELDS) if (!(k in fields) && k in s && (k !== 'p' || kind !== 'point')) delete s[k];
    s.kind = kind;
    let ch = before !== kind;
    for (const [k, v] of Object.entries(fields)) {
      if (Array.isArray(v)) { if (!Array.isArray(s[k]) || s[k][0] !== v[0] || s[k][1] !== v[1]) { s[k] = v.slice(); ch = true; } }
      else if (v === undefined) { if (k in s) { delete s[k]; ch = true; } }
      else if (s[k] !== v) { s[k] = v; ch = true; }
    }
    return { ch, kindChanged: before !== kind };
  }
  // the concrete fields of a form: curve ('circle' | 'line') or region ('disc' | 'halfplane' | complement)
  function fieldsOfForm(G, region, keepKind) {
    if (G.A === 0) {
      const g = geomOf(G);
      const kind = region ? 'halfplane' : 'line';
      return { kind: keepKind && ['line', 'halfplane'].includes(keepKind) && !region ? keepKind : kind, f: { a: g.p, b: add(g.p, g.d), c: undefined, r: undefined, complement: undefined } };
    }
    const g = geomOf(G);
    if (!region) return { kind: 'circle', f: { c: g.c, r: g.r, a: undefined, b: undefined, complement: undefined } };
    return { kind: 'disc', f: { c: g.c, r: g.r, a: undefined, b: undefined, complement: G.A < 0 ? true : undefined } };
  }
  // the ops whose def.flip is Use complement (a curve built on one undoes it: K never turns over) [v16.3 review math-2]
  const FLIPPED = ['circle3', 'perp', 'touch', 'tangent'];
  // T on the curve of the form G, to within rounding: the distance |f(T)| / |grad f(T)| at most 1e-12 S, S the figure's
  // size (|T|, |P|, |P - T|, C's centre and radius, or its anchor for a line) [v16.3 review math-1]
  function onCarrier(G, T, P) {
    const u = sub(T, G.o), f = G.A * dot(u, u) + 2 * dot(G.B, u) + G.C, gr = 2 * abs([G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]]);
    if (f === 0) return true;
    if (!(gr > 0)) return false;
    let S = Math.max(abs(T), abs(G.o), 1e-300);
    if (P && !isInf(P)) S = Math.max(S, abs(P), abs(sub(P, T)));
    if (G.A !== 0) { const g = geomOf(G); S = Math.max(S, abs(g.c) + g.r); }
    return Math.abs(f) / gr <= 1e-12 * S;
  }
  // evaluate shape s (a node). Returns {ch, kindChanged, undef: {code, args} | null, inf}
  function evalNode(ctx, s, plane) {
    const pt = (r) => resolveIn(ctx, r, plane);
    const fail = (u) => ({ undef: u.undef || u });
    const res = { ch: false, kindChanged: false, undef: null, inf: false };
    const def = s.def;
    if (def) {
      const op = def.op, args = Array.isArray(def.args) ? def.args : [];
      if (op === 'circle3' || op === 'midpoint' || op === 'bisector') {
        const R = args.map(pt);
        const bad = R.find((x) => x.undef);
        if (bad) return fail(bad);
        const P = R.map((x) => (x.inf ? INF : x.z));
        if (op === 'midpoint') {
          if (P.some(isInf)) { res.inf = true; return res; }
          const r = setKind(s, 'point', { p: [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2] });
          res.ch = r.ch; res.kindChanged = r.kindChanged; delete s._g;
          return res;
        }
        if (op === 'bisector') {
          if (P.some(isInf)) return fail(U('lineInf'));
          if (eqP(P[0], P[1])) return fail(U('coincide'));
          const G = bisector(P[0], P[1]);
          const ff = fieldsOfForm(G, s.kind === 'halfplane', s.kind);
          const r = setKind(s, ff.kind, ff.f);
          s._g = G;
          res.ch = r.ch; res.kindChanged = r.kindChanged;
          return res;
        }
        // circle3: the exact predicate decides A (0 for collinear points and by incidence); flip from creation
        const fin = P.filter((x) => !isInf(x));
        if (fin.length < 2) return fail(U('lineInf'));
        if ((fin.length === 3 && (eqP(P[0], P[1]) || eqP(P[1], P[2]) || eqP(P[0], P[2]))) || (fin.length === 2 && eqP(fin[0], fin[1]))) return fail(U('coincide3'));
        const inc = fin.length === 3 && collinearByRefs(ctx, args);
        let G = circle3(P[0], P[1], P[2], inc);
        if (!G) return fail(U('coincide3'));
        // at creation (SPEC 2.3): the disc whatever the order of the taps (sign(A) of the same form that is drawn, so
        // the decimal-collinear rule [math-3] holds here too); collinear points keep the left side of P -> Q [math-9]
        if (def.flip == null) def.flip = fin.length === 3 && (G.A < 0 || (G.A === 0 && dot(geomOf(G).d, sub(P[1], P[0])) < 0));
        if (def.flip) G = flipG(G);
        G.byInc = inc && G.A === 0;
        // (v16.3.1, verify-1: the three points the form was built through, for perpForm's decimal mirror test; a
        // flip keeps them, as a re-anchoring does)
        if (fin.length === 3) G.p3 = P.map((z) => z.slice());
        // the Lambda rule's thru0 from incidence [C9]: a defining point exactly at 0 (the anchor, C = 0 exactly)
        const zi = fin.findIndex((p) => p[0] === 0 && p[1] === 0);
        if (zi >= 0) { G = reanchorAt(G, fin[zi]); G.thru0 = true; }
        const ff = fieldsOfForm(G, def.fill === 'in');
        const r = setKind(s, ff.kind, ff.f);
        s._g = G;
        res.ch = r.ch || true; res.kindChanged = r.kindChanged;
        return res;
      }
      if (op === 'perp') {
        delete s._seg;
        const cr = args[0];
        if (!isCurveRef(cr)) return fail(U('argUndef', { x: null }));
        const e = ctx.idx.get(cr.s);
        if (!e || e.plane !== plane || e.s.cundef || e.s.undef) return fail(U('argUndef', { x: cr.s }));
        const pc = ctx.piecesOf(e.s)[cr.part];
        if (!pc || (pc.kind !== 'line' && pc.kind !== 'circle') || !pc.G) return fail(U('notCircle', { x: cr.s }));
        // the curve's own orientation: Use complement on a 3-point, perpendicular or touching circle does not turn K
        // over [v16.3 review math-2: one list for perp and touch]
        const cd = e.s.def, Gc = cd && cd.flip && FLIPPED.includes(cd.op) ? flipG(pc.G) : pc.G;
        const R = [args[1], args[2]].map(pt);
        const bad = R.find((x) => x.undef);
        if (bad) return fail(bad);
        const P = R[0].inf ? INF : R[0].z, Q = R[1].inf ? INF : R[1].z;
        const r = perpForm(Gc, P, Q, pc);
        if (r.undef) return fail(U(r.undef));
        let G = r.G;
        // [v16.5 rail SPEC 3.4] P and Q gliders on C's own plain circle, half a turn apart by their parameters: the diameter
        if (G.A !== 0 && !isInf(P) && !isInf(Q)) { const L = antipodeLine(ctx, pc, cr, args[1], args[2], P, G); if (L) G = L; }
        // at creation (SPEC 2.3, as circle3): the disc; a line keeps the left side of P -> Q
        if (def.flip == null) def.flip = !isInf(P) && !isInf(Q) && (G.A < 0 || (G.A === 0 && dot(geomOf(G).d, sub(Q, P)) < 0));
        if (def.flip) G = flipG(G);
        const fin = [P, Q].filter((z) => !isInf(z));
        if (fin.length === 2) { G.e = abs(sub(fin[1], fin[0])); withPts(G, fin); }
        if (G.o[0] === 0 && G.o[1] === 0) G.thru0 = true;
        // [issue #70] Between z0 and z1: the segment of K from P to Q (the side follows P: nothing stored)
        if (def.between === 1 && def.fill !== 'in') {
          const sd = betweenOf(G, pc.G, P, Q, !!def.flip);
          if (sd.undef) { delete s._seg; return fail(U(sd.undef)); }
          s._g = G; s._seg = sd;
          const rr = setKind(s, sd.kind, sd.fields);
          res.ch = true; res.kindChanged = rr.kindChanged;
          return res;
        }
        // [v16.4 segments SPEC 2] Inside C only: the arc of K on the side seg of Gc, its ends K ∩ C
        if ((def.seg === 1 || def.seg === -1) && def.fill !== 'in') {
          const sd = segOf(G, pc.G, Gc, def.seg, P, Q, !!def.flip);
          if (sd.undef) { delete s._seg; return fail(U(sd.undef)); }
          G.sg = { G: { A: pc.G.A, B: pc.G.B.slice(), C: pc.G.C, o: pc.G.o.slice() }, ends: sd.m };
          s._g = G; s._seg = sd;
          const rr = setKind(s, sd.kind, sd.fields);
          res.ch = true; res.kindChanged = rr.kindChanged;
          return res;
        }
        delete s._seg;
        const ff = fieldsOfForm(G, def.fill === 'in');
        const rr = setKind(s, ff.kind, Object.assign(ff.f, { m: undefined }));
        s._g = G;
        res.ch = true; res.kindChanged = rr.kindChanged;
        return res;
      }
      if (op === 'touch' || op === 'tangent') {
        const cr = args[0];
        if (!isCurveRef(cr)) return fail(U('argUndef', { x: null }));
        const e = ctx.idx.get(cr.s);
        if (!e || e.plane !== plane || e.s.cundef || e.s.undef) return fail(U('argUndef', { x: cr.s }));
        const pc = ctx.piecesOf(e.s)[cr.part];
        if (!pc || (pc.kind !== 'line' && pc.kind !== 'circle') || !pc.G) return fail(U('notCircle', { x: cr.s }));
        const cd = e.s.def, Gc = cd && cd.flip && FLIPPED.includes(cd.op) ? flipG(pc.G) : pc.G;
        const R = args.slice(1).map(pt);
        const bad = R.find((x) => x.undef);
        if (bad) return fail(bad);
        const Z = R.map((x) => (x.inf ? INF : x.z));
        // [v16.3 review math-1] T must lie on C's carrier (a rectangle's corner moves to other sides as its handles are
        // dragged; a crafted save): else K touches nothing, and the meet rule would report T as a crossing
        if (op === 'touch' && !isInf(Z[0]) && !onCarrier(pc.G, Z[0], Z[1])) return fail(U('offCurve', { x: cr.s, part: cr.part }));
        const r = op === 'touch' ? touchForm(Gc, Z[0], Z[1]) : tangentForm(Gc, Z[0], def.index === 1 ? 1 : 0);
        if (r.undef) return fail(U(r.undef, r.undef === 'notCircle' || r.undef === 'argUndef' ? { x: cr.s } : {}));
        let G = r.G;
        if (def.flip == null) def.flip = op === 'touch' && G.A < 0;
        if (def.flip) G = flipG(G);
        G.tch = { G: { A: pc.G.A, B: pc.G.B.slice(), C: pc.G.C, o: pc.G.o.slice() }, tp: isInf(r.tp) ? INF : r.tp.slice() };
        const fin = (op === 'touch' ? Z : [Z[0], r.tp]).filter((z) => !isInf(z));
        if (fin.length === 2) { G.e = abs(sub(fin[1], fin[0])); withPts(G, fin); }
        if (G.o[0] === 0 && G.o[1] === 0) G.thru0 = true;
        const ff = fieldsOfForm(G, def.fill === 'in');
        const rr = setKind(s, ff.kind, ff.f);
        s._g = G;
        res.ch = true; res.kindChanged = rr.kindChanged;
        return res;
      }
      if (op === 'meet' || op === 'glider') {
        const cs = [];
        for (const r of args) {
          if (!isCurveRef(r)) return fail(U('argUndef', { x: null }));
          const e = ctx.idx.get(r.s);
          if (!e || e.plane !== plane) return fail(U('argUndef', { x: r.s }));
          if (e.s.cundef || e.s.undef) return fail(U('argUndef', { x: r.s }));
          const pc = ctx.piecesOf(e.s)[r.part];
          if (!pc) return fail(U('argUndef', { x: r.s }));
          cs.push({ pc, s: e.s });
        }
        if (op === 'meet') {
          let z = null;
          if (def.seed && (cs[0].pc.kind === 'traced' || cs[1].pc.kind === 'traced')) {
            const m = meetNear(cs[0].pc, cs[1].pc, def.seed, null);
            z = m ? m.z : null;
            if (!z) return fail(U('nomeet'));
          } else {
            const ms = meetsOf(cs[0].pc, cs[1].pc);
            const want = def.index === 'finite' ? 'finite' : (def.index | 0);
            const m = ms.find((x) => x.index === want) || (want !== 'finite' && ms.length === 1 ? null : null);
            if (!m && ms.length === 1 && ms[0].index === 'finite') z = ms[0].z;          // a pair turned into two lines
            else if (m) z = m.z;
            // two lines turned into a pair with a circle (an older save's 'finite' on a 3-point circle): the meet nearest
            // the last value, so the point does not jump to the far crossing [review math-5]
            if (z == null && ms.length === 2 && def.index === 'finite') {
              const fin = ms.filter((x) => isXY(x.z) && onPiece(cs[0].pc, x.z) && onPiece(cs[1].pc, x.z));
              const last = isXY(s.p) && !s._atInf ? s.p : null;
              if (fin.length && last) z = fin.sort((u, v) => Math.hypot(u.z[0] - last[0], u.z[1] - last[1]) - Math.hypot(v.z[0] - last[0], v.z[1] - last[1]))[0].z;
              else z = fin.length ? fin[0].z : ms[0].z;
            }
            if (z == null) return fail(U(ms.coincide ? 'coincideCurves' : 'nomeet'));
            if (z === INF) {
              if (!onPiece(cs[0].pc, INF) || !onPiece(cs[1].pc, INF)) return fail(U('nomeet'));
              res.inf = true;
              s._note = ms.every((x) => x.z === INF) || (ms.length === 1 && ms[0].z === INF) ? 'parallel' : null;
              return res;
            }
            if (!onPiece(cs[0].pc, z) || !onPiece(cs[1].pc, z)) return fail(U('nomeet'));
          }
          delete s._note;
          const r = setKind(s, 'point', { p: z });
          res.ch = r.ch; res.kindChanged = r.kindChanged; delete s._g;
          return res;
        }
        // glider: t on the piece (wraps on closed pieces), or the projection of the seed on a traced piece
        const pc = cs[0].pc, cs0 = cs[0].s;
        let z;
        if (pc.kind === 'traced') {
          const pr = projectPiece(pc, isXY(def.seed) ? def.seed : (isXY(s.p) ? s.p : pc.pts[0]));
          if (!pr) return fail(U('nomeet'));
          z = pr.z;
        } else {
          const t = Number.isFinite(s.t) ? s.t : 0;
          const p3 = ctx.pts3Of(cs0, plane);
          if (p3 === 'inf') return fail(U('argUndef', { x: cs0.id }));
          const [lo, hi] = p3 ? [-Infinity, Infinity] : tRange(pc);
          if (!(t >= lo - 1e-12 && t <= hi + 1e-12)) return fail(U('tRange', { t }));
          z = glide(pc, t, p3);
          if (!isXY(z)) { res.inf = true; return res; }
        }
        const r = setKind(s, 'point', { p: z });
        res.ch = r.ch; res.kindChanged = r.kindChanged; delete s._g;
        return res;
      }
      return fail(U('argUndef', { x: null }));
    }
    // bound handles: positions first, then the radii through their points [C15]
    const at = s.at || {};
    const keys = Object.keys(at);
    for (const k of keys) {
      if (RADIUS_KEYS.has(k)) continue;
      const r = pt(at[k]);
      if (r.undef) return fail(r);
      if (r.inf) return fail(U(['line', 'segment', 'ray', 'halfplane'].includes(s.kind) ? 'lineInf' : 'handleInf', { key: k }));
      const z = r.z;
      if (/^v\d+$/.test(k)) {
        const i = +k.slice(1);
        if (!Array.isArray(s.pts) || i >= s.pts.length) return fail(U('argUndef', { x: null }));
        if (!eqP(s.pts[i], z)) { s.pts[i] = z.slice(); res.ch = true; }
      } else if (k === 'c' || k === 'p' || k === 'a' || k === 'b' || k === 'm') {
        if (!isXY(s[k]) || !eqP(s[k], z)) { s[k] = z.slice(); res.ch = true; }
      }
    }
    if (['line', 'segment', 'ray', 'halfplane', 'rect'].includes(s.kind) && at.a && at.b && isXY(s.a) && isXY(s.b) && eqP(s.a, s.b)) return fail(U('coincide'));
    for (const k of keys) {
      if (!RADIUS_KEYS.has(k)) continue;
      const r = pt(at[k]);
      if (r.undef) return fail(r);
      if (r.inf) return fail(U('handleInf', { key: k }));
      if (!isXY(s.c)) return fail(U('argUndef', { x: null }));
      const rr = Math.hypot(r.z[0] - s.c[0], r.z[1] - s.c[1]);
      if (!(rr > 0)) return fail(U('coincide'));
      if (s[k] !== rr) { s[k] = rr; res.ch = true; }
    }
    return res;
  }
  function reanchorAt(G, p) {
    const du = [p[0] - G.o[0], p[1] - G.o[1]];
    const out = Object.assign({}, G, { B: [G.B[0] + G.A * du[0], G.B[1] + G.A * du[1]], C: 0, o: p.slice() });
    return out;
  }

  // ---------------------------------------------------------------- Inside C only (notes/orthogonal-circle/segments/SPEC.md)
  // A perpendicular circle K with def.seg = 1 | -1 is the arc of K where seg f_Gc < 0 (Gc: C's piece form, the flip of a
  // constructed C undone), its ends K ∩ C. Runtime only: s._seg = {G, H, k, side, Gc, u0, D, ends: [start, end], m: [the
  // meets in Intersect's order K, C], L, kind, fields}; K's glider map z(u) = mR(H, k tan(pi u)) (H: K anchored at P, or Q
  // when P is infinity; k = sg |PQ|, as pts3In) runs from ends[0] (u0) to ends[1] (u0 + D)
  // the u of a point w of K, in [0, 1) (infinity: 1/2)
  function segU(H, k, w) {
    if (isInf(w)) return 0.5;
    const v = sub(w, H.o), den = [H.B[0] + H.A * v[0] / 2, H.B[1] + H.A * v[1] / 2], tau = div(v, [-den[1], den[0]])[0];
    let t = Math.atan(tau / k) / Math.PI;
    if (!Number.isFinite(t)) t = 0.5;
    return ((t % 1) + 1) % 1;
  }
  function segAtU(q, u) { u = ((u % 1) + 1) % 1; return Math.abs(u - 0.5) < 1e-15 ? mR(q.H, Infinity) : mR(q.H, q.k * Math.tan(Math.PI * u)); }
  const span1 = (a, b) => ((((b - a) % 1) + 1) % 1);
  const cpz = (z) => (isInf(z) ? INF : z.slice());
  // on the arc, by its u (the ends with a margin of 1e-12)
  const segInU = (q, u) => { const v = span1(q.u0, u); return v <= q.D + 1e-12 || v >= 1 - 1e-12; };
  // the chordal distance on the Riemann sphere (infinity included)
  function chordal(a, b) {
    const w = (z) => (isInf(z) ? 0 : 1 / Math.sqrt(1 + z[0] * z[0] + z[1] * z[1]));
    if (isInf(a) && isInf(b)) return 0;
    if (isInf(a) || isInf(b)) return 2 * w(isInf(a) ? b : a);
    return 2 * abs(sub(a, b)) * w(a) * w(b);
  }
  // segOf(G, GcP, Gc, side, P, Q, flip): K's form G, C's piece form GcP (the meets: Intersect's), Gc (the side)
  function segOf(G, GcP, Gc, side, P, Q, flip) {
    const m = meets(G, GcP);
    if (!m || m[0] == null || m[1] == null) return { undef: 'nomeet' };
    const fin = [P, Q].filter((z) => !isInf(z));
    if (!fin.length) return { undef: 'lineInf' };
    const k = (flip ? -1 : 1) * (fin.length === 2 ? abs(sub(fin[1], fin[0])) : 1);
    const q = { G, H: reanchorAt(G, fin[0]), k, side, Gc };
    const u = m.map((z) => segU(q.H, k, z));
    // the arc u0 -> u1 (u increasing) whose middle (its quarter when the middle is infinity) is on the side
    const sideOk = (a, b) => { let z = segAtU(q, a + span1(a, b) / 2); if (!isXY(z)) z = segAtU(q, a + span1(a, b) / 4); return isXY(z) && fOf(Gc, z) * side < 0; };
    const i0 = sideOk(u[0], u[1]) ? 0 : 1;
    q.u0 = u[i0]; q.D = span1(u[i0], u[1 - i0]);
    if (!(q.D > 0)) return { undef: 'nomeet' };
    q.ends = [cpz(m[i0]), cpz(m[1 - i0])]; q.m = [cpz(m[0]), cpz(m[1])];
    return segTail(q);
  }
  // the rest of a seg object once its ends, u0 and D are known: its middle, its size, and the shape's fields (the middle of
  // the arc, or its quarter when the middle is infinity)
  function segTail(q) {
    let mid = segAtU(q, q.u0 + q.D / 2);
    if (!isXY(mid)) mid = segAtU(q, q.u0 + q.D / 4);
    const fe = q.ends.filter(isXY);
    q.L = Math.max(...fe.map((e) => abs(sub(e, mid))), 1e-300);
    // the shape's fields, for code that knows only kinds (hit tests, Preimage packing, v16.2): an arc a, m, b, or a ray
    // from the finite end when the other is infinity (C and K both lines)
    if (fe.length === 2) { q.kind = 'arc'; q.fields = { a: q.ends[0].slice(), m: mid.slice(), b: q.ends[1].slice(), c: undefined, r: undefined, complement: undefined }; }
    else { q.kind = 'ray'; q.fields = { a: fe[0].slice(), b: mid.slice(), m: undefined, c: undefined, r: undefined, complement: undefined }; }
    return q;
  }
  // [issue #70] "Between z0 and z1": the true hyperbolic segment of K from P to Q (no tails): of the two arcs of K between
  // them, the one that K's two meets with C do not cut (P and Q on the same side of C, inside or outside). On opposite
  // sides each arc holds a meet: undefined ('betweenSides'). A point on C is an end of the segment. The same seg object as
  // segOf's (ends, u0, D, H, k), so gliders, crossings, hit tests, the images and the globe treat it as that arc.
  function betweenOf(G, GcP, P, Q, flip) {
    if (isInf(P) || isInf(Q)) return { undef: 'lineInf' };
    const m = meets(G, GcP);
    if (!m || m[0] == null || m[1] == null) return { undef: 'nomeet' };
    const dist = abs(sub(Q, P));
    if (!(dist > 0)) return { undef: 'coincide' };
    const k = (flip ? -1 : 1) * dist;
    const q = { G, H: reanchorAt(G, P), k };
    const uP = segU(q.H, k, P), uQ = segU(q.H, k, Q), um = m.map((z) => segU(q.H, k, z));
    // a meet strictly inside the arc from a to b (increasing u), with a margin so a meet at an end does not count
    const cut = (a, b) => um.some((u) => { const v = span1(a, u), D = span1(a, b); return v > 1e-12 && v < D - 1e-12; });
    const fwd = cut(uP, uQ), back = cut(uQ, uP);
    if (fwd === back) return { undef: 'betweenSides' };
    const [a, b] = fwd ? [uQ, uP] : [uP, uQ];
    q.u0 = a; q.D = span1(a, b);
    if (!(q.D > 0)) return { undef: 'coincide' };
    q.ends = fwd ? [cpz(Q), cpz(P)] : [cpz(P), cpz(Q)]; q.m = [cpz(m[0]), cpz(m[1])];
    return segTail(q);
  }
  // the form a perpendicular circle's side is measured against: C's piece form, a constructed C's flip undone
  const gcOf = (C, pc) => (pc && pc.G ? (C && C.def && C.def.flip && FLIPPED.includes(C.def.op) ? flipG(pc.G) : pc.G) : null);
  // the side drawn when the switch is turned on (SPEC 2.2): C drawn as a region, its region; a circle, its disc; a line,
  // P's side (Q's when P is on C or infinity; else above C, or left of it when C is steeper than 45 degrees)
  function segSideOf(C, pc, P, Q) {
    const Gc = gcOf(C, pc);
    if (!Gc) return 1;
    if (C && (C.kind === 'disc' || C.kind === 'halfplane')) {
      const R = C._g || formOfFields(C);
      const lam = R ? (R.A !== 0 || Gc.A !== 0 ? R.A * Gc.A : dot(R.B, Gc.B)) : 0;
      if (lam) return lam > 0 ? 1 : -1;
    }
    if (Gc.A !== 0) return Gc.A > 0 ? 1 : -1;
    for (const z of [P, Q]) if (isXY(z) && !onCarrier(Gc, z, null)) return fOf(Gc, z) < 0 ? 1 : -1;
    const g = geomOf(Gc), steep = Math.abs(g.d[1]) > Math.abs(g.d[0]);
    return fOf(Gc, add(g.p, steep ? [-1, 0] : [0, 1])) < 0 ? 1 : -1;
  }
  // the two sides of a perpendicular circle's C, by their words: {line, steep, Gc, sides: [[word, seg], [word, seg]],
  // seg (now: 0, 1, -1), dflt (segSideOf)} | null. A circle: in (bounded), out; a line: above, below (left, right when
  // steeper than 45 degrees)
  function segSides(state, id, env) {
    const ctx = makeCtx(state, env, null), e = ctx.idx.get(id), s = e && e.s, d = s && s.def;
    if (!d || d.op !== 'perp' || !isCurveRef(d.args[0])) return null;
    const ce = ctx.idx.get(d.args[0].s), C = ce && ce.s, pc = C && ctx.piecesOf(C)[d.args[0].part];
    if (!pc || (pc.kind !== 'line' && pc.kind !== 'circle')) return null;
    const Gc = gcOf(C, pc);
    if (!Gc) return null;
    const R = d.args.slice(1).map((r) => resolveIn(ctx, r, e.plane)), pt = (r) => (r && !r.undef && !r.inf ? r.z : null);
    const out = { line: Gc.A === 0, steep: false, Gc, seg: d.seg === 1 || d.seg === -1 ? d.seg : 0, dflt: segSideOf(C, pc, pt(R[0]), pt(R[1])) };
    if (Gc.A !== 0) out.sides = [['in', Gc.A > 0 ? 1 : -1], ['out', Gc.A > 0 ? -1 : 1]];
    else {
      const g = geomOf(Gc);
      out.steep = Math.abs(g.d[1]) > Math.abs(g.d[0]);
      const s1 = fOf(Gc, add(g.p, out.steep ? [-1, 0] : [0, 1])) < 0 ? 1 : -1;
      out.sides = out.steep ? [['left', s1], ['right', -s1]] : [['above', s1], ['below', -s1]];
    }
    out.word = out.seg ? out.sides.find((x) => x[1] === out.seg)[0] : null;
    return out;
  }
  // z's mirror image in the curve of the form G, on the sphere: a circle swaps its centre and infinity; a line keeps
  // infinity (review math-2)
  function mirrorIn(G, z) {
    if (isInf(z)) return G.A === 0 ? INF : geomOf(G).c.slice();
    if (!isXY(z)) return null;
    if (G.A === 0) { const f = fOf(G, z), b2 = dot(G.B, G.B); return b2 > 0 ? sub(z, scl(G.B, f / b2)) : null; }
    const g = geomOf(G), v = sub(z, g.c), d2 = dot(v, v);
    return d2 > 0 ? add(g.c, scl(v, g.r * g.r / d2)) : INF;
  }
  // Constr.setSeg(state, id, seg, env): Inside C only on (1 | -1) or off (0) on the perpendicular circle id, its gliders
  // moved so none leaves the drawn curve (SPEC 4): on, a glider off the drawn side goes to its mirror image in C (on K,
  // on the arc); the other side, every glider to its mirror image; off, every glider keeps its point. One state change
  // (the caller records one undo step). Returns the ids of K's gliders, or null
  function setSeg(state, id, seg, env) {
    const e = index(state).get(id), s = e && e.s, d = s && s.def;
    if (!d || d.op !== 'perp') return null;
    // (Whole while Between is on: Between goes off)
    if (d.between === 1 && !(seg === 1 || seg === -1)) return setBetween(state, id, false, env);
    const was = d.seg === 1 || d.seg === -1 ? d.seg : 0, now = seg === 1 || seg === -1 ? seg : 0;
    if (was === now) return [];
    const info = segSides(state, id, env), Gc = info && info.Gc;
    const gl = lists(state)[e.plane].filter((g) => g && g.def && g.def.op === 'glider' && Array.isArray(g.def.args) && g.def.args[0] && g.def.args[0].s === id);
    // (a glider at infinity is the point infinity: review math-2; f_Gc there has the sign of Gc.A, 0 for a line)
    const want = gl.map((g) => {
      const z = g._atInf ? INF : g.p;
      if (g.cundef || !(isInf(z) || isXY(z))) return null;
      if (!Gc || !now) return cpz(z);
      if (!was && now * (isInf(z) ? Gc.A : fOf(Gc, z)) <= 0) return cpz(z);
      return mirrorIn(Gc, z) || cpz(z);
    });
    if (now) { d.seg = now; d.fill = 'none'; delete d.between; } else delete d.seg;
    recompute(state, { all: true }, env);
    if (!s.cundef) {
      const ctx = makeCtx(state, env, null), p3 = now ? null : pts3In(ctx, s, e.plane);
      gl.forEach((g, i) => {
        const w = want[i], pc = w && ctx.piecesOf(s)[g.def.args[0].part];
        if (!pc) return;
        const mr = !now && pc.c3 && p3 && p3 !== 'inf' ? p3 : null;
        // (off, infinity: K's u = 1/2 when K's map is the M(R) one; else its t stays)
        if (isInf(w) && !now) { if (mr && mr.mr) g.t = 0.5; return; }
        const pr = projectPiece(pc, w, mr);
        if (pr && Number.isFinite(pr.t)) g.t = pr.t;
      });
      recompute(state, { all: true }, env);
    }
    return gl.map((g) => g.id);
  }
  // [issue #70] Constr.setBetween(state, id, on, env): Between z0 and z1 on (true) or off on the perpendicular circle id (on
  // clears Inside C only: the two are one choice). Its gliders move so none leaves the drawn curve: on, a glider off the
  // segment goes to its nearer end; off, every glider keeps its point. One state change (the caller records one undo
  // step). Returns the ids of K's gliders, or null
  function setBetween(state, id, on, env) {
    const e = index(state).get(id), s = e && e.s, d = s && s.def;
    if (!d || d.op !== 'perp') return null;
    const was = d.between === 1, now = !!on;
    if (was === now && !(now && (d.seg === 1 || d.seg === -1))) return [];
    const gl = lists(state)[e.plane].filter((g) => g && g.def && g.def.op === 'glider' && Array.isArray(g.def.args) && g.def.args[0] && g.def.args[0].s === id);
    const want = gl.map((g) => { const z = g._atInf ? INF : g.p; return g.cundef || !(isInf(z) || isXY(z)) ? null : cpz(z); });
    if (now) { d.between = 1; delete d.seg; d.fill = 'none'; } else delete d.between;
    recompute(state, { all: true }, env);
    if (!s.cundef) {
      const ctx = makeCtx(state, env, null), p3 = now ? null : pts3In(ctx, s, e.plane);
      gl.forEach((g, i) => {
        let w = want[i];
        const pc = w && ctx.piecesOf(s)[g.def.args[0].part];
        if (!pc) return;
        if (now && pc.seg && !onPiece(pc, w)) w = chordal(w, pc.seg.ends[0]) <= chordal(w, pc.seg.ends[1]) ? cpz(pc.seg.ends[0]) : cpz(pc.seg.ends[1]);
        const mr = !now && pc.c3 && p3 && p3 !== 'inf' ? p3 : null;
        if (isInf(w) && !now) { if (mr && mr.mr) g.t = 0.5; return; }
        const pr = projectPiece(pc, w, mr);
        if (pr && Number.isFinite(pr.t)) g.t = pr.t;
      });
      recompute(state, { all: true }, env);
    }
    return gl.map((g) => g.id);
  }
  // the drawn curve of a seg K on a circle (SPEC 6.1; a line's arc is Region.segCurvesOf's: the chord, or the line kinds'
  // long rays, review math-1, math-4): one open curve object. A circle no larger than 50 window diagonals (Region's
  // MR_RATIO): f by its angle, as a whole circle is drawn, the ends exact; a larger one: f the M(R) map of K anchored at the
  // window's foot (as Region's mrCurve), restricted to the arc, and gsamp sampleMR's samples of K (dense within 1.25x the
  // window, geometric beyond), those on the arc in order, the ends first and last, bitwise
  function segCurves(q, win) {
    if (!win || !(win.x1 - win.x0 > 0)) { const c = q.ends.find(isXY) || [0, 0], h = Math.max(1, q.L); win = { x0: c[0] - h, x1: c[0] + h, y0: c[1] - h, y1: c[1] + h }; }
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    const H = reanchor(q.G, [cx, cy]), H0 = Object.assign({}, H, { C: 0 });
    const tauOf = (z) => { if (isInf(z)) return Infinity; const v = sub(z, H0.o), den = [H0.B[0] + H0.A * v[0] / 2, H0.B[1] + H0.A * v[1] / 2]; return div(v, [-den[1], den[0]])[0]; };
    const phi = (z) => { const t = tauOf(z); return Number.isFinite(t) ? Math.atan(t / diag) : Math.PI / 2; };
    const mod = (x) => (((x % Math.PI) + Math.PI) % Math.PI);
    let mid = segAtU(q, q.u0 + q.D / 2);
    if (!isXY(mid)) mid = segAtU(q, q.u0 + q.D / 4);
    const C2 = (z) => (z ? { re: z[0], im: z[1] } : { re: NaN, im: NaN });
    const g = geomOf(q.G);
    if (!(g.r > 50 * diag)) {
      const ang = (z) => Math.atan2(z[1] - g.c[1], z[0] - g.c[0]), m2 = (x) => (((x % TAU) + TAU) % TAU);
      const as = ang(q.ends[0]), ae = ang(q.ends[1]), am = ang(mid);
      const Da = m2(am - as) < m2(ae - as) ? (m2(ae - as) || TAU) : -(m2(as - ae) || TAU);
      return [{ n0: 160, closed: false, cap: 'butt', gform: q.G, seg: true,
        f: (x) => (x <= 0 ? C2(q.ends[0]) : x >= 1 ? C2(q.ends[1]) : C2([g.c[0] + g.r * Math.cos(as + x * Da), g.c[1] + g.r * Math.sin(as + x * Da)])) }];
    }
    const ps = phi(q.ends[0]), pe = phi(q.ends[1]), pm = phi(mid);
    // the direction of increasing angle from the start: the one that meets the middle before the end
    const up = mod(pm - ps) < mod(pe - ps);
    const Dl = up ? mod(pe - ps) || Math.PI : -(mod(ps - pe) || Math.PI);
    const at = (p) => { const z = mR(H0, diag * Math.tan(p)); return isInf(z) || !isXY(z) ? null : z; };
    return [{ n0: 400, closed: false, cap: 'butt', gform: q.G, seg: true,
      f: (x) => (x <= 0 ? C2(q.ends[0]) : x >= 1 ? C2(q.ends[1]) : C2(at(ps + x * Dl))),
      gsamp: (w, step) => segSample(q, w || win, step) }];
  }
  // the samples of a seg curve on a huge circle (Float64Array [x0, y0, ...]): sampleMR's parameters at the window w
  function segSample(q, w, step) {
    const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2;
    const H = reanchor(q.G, [cx, cy]), H0 = Object.assign({}, H, { C: 0 });
    const ts = mrTaus(H, w, step);
    const tauOf = (z) => { if (isInf(z)) return Infinity; const v = sub(z, H0.o), den = [H0.B[0] + H0.A * v[0] / 2, H0.B[1] + H0.A * v[1] / 2]; return div(v, [-den[1], den[0]])[0]; };
    let mid = segAtU(q, q.u0 + q.D / 2);
    if (!isXY(mid)) mid = segAtU(q, q.u0 + q.D / 4);
    const t0 = tauOf(q.ends[0]), t1 = tauOf(q.ends[1]), tm = tauOf(mid);
    // on the projective line: the arc from t0 to t1 through tm, increasing (wrapping through infinity) or decreasing
    const inc = (a, b, x) => (a <= b ? x > a && x < b : x > a || x < b);
    const up = inc(t0, t1, tm);
    const inArc = (x) => (up ? inc(t0, t1, x) : inc(t1, t0, x));
    // the parameters in arc order: from t0 in the arc's direction to the list's end, then (when the arc passes through
    // infinity) from the list's other end; null marks infinity
    const n = ts.length, out = [], seq = [];
    const push = (z) => { out.push(z[0], z[1]); };
    let all = true;
    if (up) {
      let j = 0;
      while (j < n && !(ts[j] > t0)) j++;
      for (; j < n; j++) { if (!inArc(ts[j])) { all = false; break; } seq.push(ts[j]); }
      if (all && t0 > t1) { seq.push(null); for (let k = 0; k < n && inArc(ts[k]); k++) seq.push(ts[k]); }
    } else {
      let j = n - 1;
      while (j >= 0 && !(ts[j] < t0)) j--;
      for (; j >= 0; j--) { if (!inArc(ts[j])) { all = false; break; } seq.push(ts[j]); }
      if (all && t1 > t0) { seq.push(null); for (let k = n - 1; k >= 0 && inArc(ts[k]); k--) seq.push(ts[k]); }
    }
    // (through the antipode: the parameter infinity, a point of the circle)
    push(q.ends[0]);
    for (const x of seq) push(mR(H0, x === null ? Infinity : x));
    push(q.ends[1]);
    return new Float64Array(out);
  }

  // ---------------------------------------------------------------- the perpendicular circle (notes/orthogonal-circle/SPEC.md)
  // perpForm(Gc, P, Q): the generalized circle through P and Q that crosses the curve of the form Gc at right angles.
  // Lifted, a point z is the row (|z - o|^2, 2(z - o), 1) and a curve G the row (-C/2, B, -A/2): a form passes through
  // z when it is orthogonal to z's row, and crosses G at right angles when it is orthogonal to G's row. Anchored at P
  // (C = 0): (A, Bx, By) = (|d|^2, 2d) x (-C'/2, B'), d = Q - P, (A', B', C') = Gc re-anchored at P; Q = INF: (0, -B'y,
  // B'x). Every step is exact (dyadic BigInt on the doubles), with one rounding at the end, so the right angle holds to
  // the last rounding wherever P and Q are (on the curve, at its centre, next to P's mirror image P*). {G} | {undef}
  const dz = (x) => { const [m, e] = decompose(x); return { m, e }; };
  const dmul = (a, b) => ({ m: a.m * b.m, e: a.e + b.e });
  const dadd = (a, b) => { if (a.m === 0n) return b; if (b.m === 0n) return a; if (a.e < b.e) [a, b] = [b, a]; return { m: (a.m << BigInt(a.e - b.e)) + b.m, e: b.e }; };
  const dneg = (a) => ({ m: -a.m, e: a.e });
  const dsub = (a, b) => dadd(a, dneg(b));
  const TWO = { m: 2n, e: 0 };
  // dyadics to doubles under one common power of two (gc normalizes after: no overflow, no underflow of the largest)
  function dScaled(xs) {
    const len = (a) => (a.m < 0n ? -a.m : a.m).toString(2).length;
    const top = Math.max(...xs.filter((a) => a.m !== 0n).map((a) => len(a) + a.e));
    return xs.map((a) => {
      if (a.m === 0n) return 0;
      const neg = a.m < 0n, M = neg ? -a.m : a.m, sh = Math.max(0, len(a) - 64);
      return (neg ? -1 : 1) * ldexp(Number(M >> BigInt(sh)), sh + a.e - top);
    });
  }
  // [v16.3 review math-3, math-4] numbers as the decimals the user snapped or typed (decOf: 12 digits), scaled to integers
  // under one power of ten: BigInts, or null when one is not such a decimal (or the scales are too far apart)
  function decInts(xs) {
    const ds = xs.map(decOf);
    if (ds.some((d) => !d)) return null;
    const es = ds.filter((d) => d[0] !== 0n).map((d) => d[1]);
    if (!es.length) return ds.map(() => 0n);
    const E = Math.min(...es);
    if (Math.max(...es) - E > 80) return null;
    return ds.map(([m, e]) => (m === 0n ? 0n : m * 10n ** BigInt(e - E)));
  }
  // perpForm(Gc, P, Q, pc?): pc, C's piece, gives the decimals C was drawn with (a circle's centre and radius, a line's
  // two points) for the decimal rules below; without it (or when they are not decimals) only the exact rules apply
  function perpForm(Gc, P, Q, pc) {
    if (!Gc) return { undef: 'notCircle' };
    if (isInf(P) && isInf(Q)) return { undef: 'lineInf' };
    const zero = (z) => !isInf(z) && z[0] === 0 && z[1] === 0;
    // the anchor: P; Q when P is infinity, or when Q alone is exactly 0 (the Lambda rule's thru0 [C9]). Swapping the two
    // point rows turns the null vector over: sg = -1 keeps the curve's orientation
    let sg = 1;
    if (isInf(P) || (zero(Q) && !zero(P))) { [P, Q] = [Q, P]; sg = -1; }
    if (!isInf(Q) && eqP(P, Q)) return { undef: 'coincide' };
    const A0 = dz(Gc.A), Bx0 = dz(Gc.B[0]), By0 = dz(Gc.B[1]), C0 = dz(Gc.C);
    const ux = dsub(dz(P[0]), dz(Gc.o[0])), uy = dsub(dz(P[1]), dz(Gc.o[1]));
    const Bx1 = dadd(Bx0, dmul(A0, ux)), By1 = dadd(By0, dmul(A0, uy));
    const C1 = dadd(dadd(dmul(A0, dadd(dmul(ux, ux), dmul(uy, uy))), dmul(TWO, dadd(dmul(Bx0, ux), dmul(By0, uy)))), C0);
    let A, Bx, By;
    if (isInf(Q)) { A = { m: 0n, e: 0 }; Bx = dneg(By1); By = Bx1; }
    else {
      const dx = dsub(dz(Q[0]), dz(P[0])), dy = dsub(dz(Q[1]), dz(P[1])), dd = dadd(dmul(dx, dx), dmul(dy, dy));
      A = dmul(TWO, dsub(dmul(dx, By1), dmul(dy, Bx1)));
      Bx = dsub(dneg(dmul(dy, C1)), dmul(dd, By1));
      By = dadd(dmul(dd, Bx1), dmul(dx, C1));
    }
    if (A.m === 0n && Bx.m === 0n && By.m === 0n) return { undef: 'pencil' };      // Q = P* (or P at the centre, Q = INF)
    let [a, bx, by] = dScaled([A, Bx, By]);
    const fin2 = !isInf(P) && !isInf(Q);
    // [v16.3 review math-3, user-9] Q = P* in the decimals (the exact test above sees it only when P* is a double): a
    // circle C (c, r): P, Q collinear with c and (P - c).(Q - c) = r^2; a line C through a, b: Q - P perpendicular to
    // b - a and the midpoint of P Q on it. One configuration, one outcome: the pencil, as for 0.5 and 2
    if (fin2 && pc && pc.kind === 'circle' && Gc.A !== 0 && isXY(pc.c) && pc.r > 0 && orientD(pc.c, P, Q) === 0) {
      const v = decInts([P[0], P[1], Q[0], Q[1], pc.c[0], pc.c[1], pc.r]);
      if (v) { const [px, py, qx, qy, cx, cy, rr] = v; if ((px - cx) * (qx - cx) + (py - cy) * (qy - cy) === rr * rr) return { undef: 'pencil' }; }
    }
    // [v16.3.1, verify-1] C through three points p1, p2, p3 (a 3-point circle, an arc): its centre and radius are not
    // decimals, but its form is rational in the points. Anchored at p1, f(z) = A|u|^2 + D ux + E uy (circle3's A, D,
    // E); P, Q are mirror images when A u v* + (D - iE) u / 2 + (D + iE) v* / 2 = 0 (u = P - p1, v = Q - p1), both
    // parts tested exactly in the decimals scaled to integers. (A 0 here and not in the form, or the reverse, by
    // incidence: the decimals do not describe the form, and the rule is skipped)
    const p3 = pc && (pc.kind === 'circle' || pc.kind === 'line') ? pc.arc3 || (pc.G && pc.G.p3) || (pc.G && pc.G.pts && pc.G.pts.length === 3 ? pc.G.pts : null) : null;
    if (fin2 && p3 && p3.every(isXY)) {
      const v = decInts([p3[0][0], p3[0][1], p3[1][0], p3[1][1], p3[2][0], p3[2][1], P[0], P[1], Q[0], Q[1]]);
      if (v) {
        const [x1, y1, x2, y2, x3, y3, px, py, qx, qy] = v;
        const q1x = x2 - x1, q1y = y2 - y1, r1x = x3 - x1, r1y = y3 - y1, sq = q1x * q1x + q1y * q1y, sr = r1x * r1x + r1y * r1y;
        const A3 = q1x * r1y - q1y * r1x, D3 = sr * q1y - sq * r1y, E3 = sq * r1x - sr * q1x;
        const ux = px - x1, uy = py - y1, vx = qx - x1, vy = qy - y1;
        if ((A3 === 0n) === (Gc.A === 0)
          && 2n * A3 * (ux * vx + uy * vy) + D3 * (ux + vx) + E3 * (uy + vy) === 0n
          && 2n * A3 * (uy * vx - ux * vy) + D3 * (uy - vy) + E3 * (vx - ux) === 0n) return { undef: 'pencil' };
      }
    }
    if (fin2 && pc && pc.kind === 'line' && Gc.A === 0 && isXY(pc.a) && isXY(pc.b)) {
      const v = decInts([pc.a[0], pc.a[1], pc.b[0], pc.b[1], P[0], P[1], Q[0], Q[1]]);
      if (v) {
        const [ax, ay, bx2, by2, px, py, qx, qy] = v, ex = bx2 - ax, ey = by2 - ay;
        if ((qx - px) * ex + (qy - py) * ey === 0n) {
          if (ex * ((py - ay) + (qy - ay)) - ey * ((px - ax) + (qx - ax)) === 0n) return { undef: 'pencil' };
          // [v16.3 review math-4] P Q perpendicular to the line C in the decimals: K is the line P Q itself (the circle
          // of radius ~1e16 that rounding gives is not drawn, named a disc, or met at a finite far point), its side
          // from the rounded form, as the circle rule below
          if (a !== 0) {
            const d = sub(Q, P), L = abs(d), sn = Math.sign(bx * d[1] - by * d[0]);
            if (sn !== 0) { a = 0; bx = sn * d[1] / L; by = -sn * d[0] / L; }
          }
        }
      }
    }
    // [math-3] Gc anchored at its centre (B = 0: a circle, a disc, an annulus, a sector's arc): A = -2 A' orient(o, P, Q),
    // so K is the line P Q itself when the decimals the user snapped are collinear with the centre
    if (a !== 0 && !isInf(Q) && Gc.A !== 0 && Gc.B[0] === 0 && Gc.B[1] === 0 && orientD(Gc.o, P, Q) === 0) {
      const d = sub(Q, P), L = abs(d), sn = Math.sign(bx * d[1] - by * d[0]);
      if (sn !== 0) { a = 0; bx = sn * d[1] / L; by = -sn * d[0] / L; }
    }
    const G = gc(sg * a, [sg * bx, sg * by], 0, P);
    return G ? { G } : { undef: 'pencil' };
  }

  // ---------------------------------------------------------------- touching (notes/orthogonal-circle/TANGENT-SPEC.md)
  // a dyadic to a double (one rounding)
  const dnum1 = (a) => { if (a.m === 0n) return 0; const neg = a.m < 0n, M = neg ? -a.m : a.m, sh = Math.max(0, M.toString(2).length - 64); return (neg ? -1 : 1) * ldexp(Number(M >> BigInt(sh)), sh + a.e); };
  // Gc re-anchored at p, exactly: {A, Bx, By, C} dyadic (C = f(p))
  function atD(Gc, p) {
    const A0 = dz(Gc.A), Bx0 = dz(Gc.B[0]), By0 = dz(Gc.B[1]), C0 = dz(Gc.C);
    const ux = dsub(dz(p[0]), dz(Gc.o[0])), uy = dsub(dz(p[1]), dz(Gc.o[1]));
    return { A: A0, Bx: dadd(Bx0, dmul(A0, ux)), By: dadd(By0, dmul(A0, uy)), C: dadd(dadd(dmul(A0, dadd(dmul(ux, ux), dmul(uy, uy))), dmul(TWO, dadd(dmul(Bx0, ux), dmul(By0, uy)))), C0) };
  }
  // touchForm(Gc, T, P): the generalized circle touching Gc at T (a point of Gc) through P. Anchored at T (C = 0):
  // (A, B) = (-2 d.B', |d|^2 B'), d = P - T, B' = Gc's B at T; P = INF: (0, B'), the tangent at T. {G, tp} | {undef}
  function touchForm(Gc, T, P) {
    if (!Gc) return { undef: 'notCircle' };
    if (isInf(T) && isInf(P)) return { undef: 'lineInf' };
    if (isInf(T)) {
      if (Gc.A !== 0) return { undef: 'argUndef' };
      return { G: { A: 0, B: Gc.B.slice(), C: 0, o: P.slice() }, tp: INF };     // (C's B bitwise: exactly parallel)
    }
    if (!isInf(P) && eqP(P, T)) return { undef: 'coincide' };
    const c = atD(Gc, T);
    let A, Bx, By, o = T;
    if (isInf(P)) { A = { m: 0n, e: 0 }; Bx = c.Bx; By = c.By; }
    else {
      const dx = dsub(dz(P[0]), dz(T[0])), dy = dsub(dz(P[1]), dz(T[1])), dd = dadd(dmul(dx, dx), dmul(dy, dy));
      A = dmul({ m: -2n, e: 0 }, dadd(dmul(dx, c.Bx), dmul(dy, c.By)));
      Bx = dmul(dd, c.Bx); By = dmul(dd, c.By);
      // the Lambda rule [C9]: P alone exactly 0 -> anchored at P, exactly: B + A d, C = 0
      if (P[0] === 0 && P[1] === 0 && !(T[0] === 0 && T[1] === 0)) { Bx = dadd(Bx, dmul(A, dx)); By = dadd(By, dmul(A, dy)); o = P; }
    }
    if (A.m === 0n && Bx.m === 0n && By.m === 0n) return { undef: 'coincide' };
    const [a, bx, by] = dScaled([A, Bx, By]);
    const G = gc(a, [bx, by], 0, o);
    return G ? { G, tp: T.slice() } : { undef: 'coincide' };
  }
  // tangentNear(Gc, T, Z): the tangent at T to the circle Gc as a click target of the touching circle (TANGENT-SPEC.md
  // 4): {G, z, d}, the tangent, the foot of Z on it and Z's distance to it (world units). null: Gc a line or no tangent
  function tangentNear(Gc, T, Z) {
    if (!Gc || Gc.A === 0 || isInf(T) || isInf(Z)) return null;
    const r = touchForm(Gc, T, INF);
    if (!r.G) return null;
    const g = geomOf(r.G), L = Math.hypot(g.d[0], g.d[1]);
    if (!(L > 0)) return null;
    const u = [g.d[0] / L, g.d[1] / L], w = sub(Z, g.p), tt = dot(w, u);
    const z = [g.p[0] + tt * u[0], g.p[1] + tt * u[1]];
    return { G: r.G, z, d: Math.hypot(Z[0] - z[0], Z[1] - z[1]) };
  }
  // tangentForm(Gc, P, k): the line through P touching the circle Gc; k = 0 touches left of the ray P -> centre, k = 1
  // right. B', s^2 = A f(P), N^2 = |B'|^2 - s^2 exact; n = (N B' + sg s J B') / |B'|^2. A line Gc: its parallel, at INF
  function tangentForm(Gc, P, k) {
    if (!Gc) return { undef: 'notCircle' };
    if (isInf(P)) return { undef: 'lineInf' };
    if (Gc.A === 0) return { G: { A: 0, B: Gc.B.slice(), C: 0, o: P.slice() }, tp: INF };   // (C's B bitwise: exactly parallel)
    const c = atD(Gc, P), s2d = dmul(c.A, c.C);
    if (s2d.m < 0n) return { undef: 'inside' };
    const b2d = dadd(dmul(c.Bx, c.Bx), dmul(c.By, c.By));
    const Bx = dnum1(c.Bx), By = dnum1(c.By), b2 = dnum1(b2d), sq = Math.sqrt(dnum1(s2d)), N = Math.sqrt(dnum1(dsub(b2d, s2d)));
    const sg = k === 1 ? 1 : -1;
    const G = gc(0, [(N * Bx - sg * sq * By) / b2, (N * By + sg * sq * Bx) / b2], 0, P);
    if (!G) return { undef: 'coincide' };
    const u = [-G.B[1], G.B[0]], t = -(Bx * u[0] + By * u[1]) / Gc.A;
    return { G, tp: [P[0] + t * u[0], P[1] + t * u[1]] };
  }
  // the touching point of two pieces by construction (a touch or tangent piece and the curve it was built on, or two
  // touches of one curve at one point), else null
  const sameG = (a, b) => !!a && !!b && a.A === b.A && a.C === b.C && a.B[0] === b.B[0] && a.B[1] === b.B[1] && a.o[0] === b.o[0] && a.o[1] === b.o[1];
  function touchAt(pa, pb) {
    const ta = pa.G && pa.G.tch, tb = pb.G && pb.G.tch;
    if (ta && sameG(ta.G, pb.G)) return ta.tp;
    if (tb && sameG(tb.G, pa.G)) return tb.tp;
    if (ta && tb && sameG(ta.G, tb.G) && !isInf(ta.tp) && !isInf(tb.tp) && eqP(ta.tp, tb.tp)) return ta.tp;
    return null;
  }
  // [v16.4 segments SPEC 2.3] the meets of a seg K and the curve C it was built on: the drawn ends, bitwise (order K, C:
  // index i is the meet i of K's form with C's; order C, K: the entering rule reverses at a right angle, so i <-> 1 - i)
  function segAt(pa, pb) {
    const ka = pa.seg && pa.G && pa.G.sg, kb = pb.seg && pb.G && pb.G.sg;
    if (ka && sameG(ka.G, pb.G)) return [{ z: cpz(ka.ends[0]), index: 0 }, { z: cpz(ka.ends[1]), index: 1 }];
    if (kb && sameG(kb.G, pa.G)) return [{ z: cpz(kb.ends[1]), index: 0 }, { z: cpz(kb.ends[0]), index: 1 }];
    return null;
  }
  // two seg pieces on the same C with a common end (both infinity, or within 1e-9 of the larger arc's size)
  function segParallel(pa, pb) {
    const ka = pa.seg && pa.G && pa.G.sg, kb = pb.seg && pb.G && pb.G.sg;
    if (!ka || !kb || !sameG(ka.G, kb.G)) return false;
    const L = Math.max(pa.seg.L, pb.seg.L);
    return pa.seg.ends.some((e) => pb.seg.ends.some((f) => (isInf(e) && isInf(f)) || (isXY(e) && isXY(f) && (eqP(e, f) || abs(sub(e, f)) <= 1e-9 * L))));
  }
  // a point ref on a curve ref by construction (a glider on it, a meet with it, one of its defining points, a handle of
  // its shape at an end of the piece), through bound handles
  const POSK = /^(p|a|b|m|c|v\d+)$/;
  function onCurveByRefs(state, pref, cref) {
    if (!isPointRef(pref) || !isCurveRef(cref)) return false;
    const ctx = makeCtx(state, {}, null);
    const same = (c) => isCurveRef(c) && c.s === cref.s && c.part === cref.part;
    const k = canonKey(ctx, pref), m = /^s:([^:]+)$/.exec(k);
    const pe = m ? ctx.idx.get(m[1]) : null, d = pe && pe.s.def;
    if (d && ((d.op === 'glider' && same(d.args[0])) || (d.op === 'meet' && d.args.some(same)))) return true;
    const e = ctx.idx.get(cref.s);
    if (!e) return false;
    const C = e.s, cd = C.def, keys = new Set();
    if (cd && cd.op === 'circle3') cd.args.forEach((r) => keys.add(canonKey(ctx, r)));
    if (cd && (cd.op === 'perp' || cd.op === 'touch' || cd.op === 'tangent')) cd.args.slice(1).forEach((r) => { if (r && !r.inf) keys.add(canonKey(ctx, r)); });
    // (never a rectangle's corner: its corners are re-sorted from min/max, so a handle drag moves corner a to other
    // sides while the curve ref keeps its part [v16.3 review math-1])
    const pc = !cd && C.kind !== 'rect' ? ctx.piecesOf(C)[cref.part] : null;
    if (pc) {
      const ends = [pc.a, pc.b].concat(pc.arc3 || []).filter(isXY);
      for (const h of handleKeys(C)) { if (!POSK.test(h)) continue; const z = handlePos(C, h); if (z && ends.some((w) => eqP(w, z))) keys.add(canonKey(ctx, { s: C.id, h })); }
    }
    return keys.has(k);
  }

  // ---------------------------------------------------------------- recompute (SPEC 3)
  // Constr.recompute(state, changed, env) -> {ids, kindChanged, undefChanged, order}
  // changed: {all} | {shapes: [ids], zp: [step uids], chain: bool, params: bool}; env: {zp, zpAll, F, trace}
  function recompute(state, changed, env) {
    const G = graphOf(state);
    const ctx = makeCtx(state, env, G);
    let todo;
    if (!changed || changed.all) todo = G.order;
    else {
      const seeds = new Set(changed.shapes || []);
      const zp = new Set(changed.zp || []);
      for (const n of G.nodes.values()) {
        if ([...n.zps].some((u) => zp.has(u) || changed.zpAny)) seeds.add(n.id);
        if (n.img && changed.chain) seeds.add(n.id);
      }
      const cl = closure(G, seeds);
      todo = G.order.filter((id) => cl.has(id));
    }
    const out = { ids: [], kindChanged: [], undefChanged: [], order: G.order };
    for (const id of todo) {
      const n = G.nodes.get(id);
      if (!n || G.cyclic.has(id)) continue;
      const s = n.s, plane = ctx.idx.get(id).plane;
      let r;
      try { r = evalNode(ctx, s, plane); } catch (e) { r = { undef: { code: 'argUndef', args: { x: null } } }; }
      ctx.pieceCache.delete(s);
      const was = !!s.cundef, wasInf = !!s._atInf;
      if (r.undef) {
        const same = s.cundef && s.cundef.code === r.undef.code && JSON.stringify(s.cundef.args) === JSON.stringify(r.undef.args);
        if (!same) { s.cundef = r.undef; out.undefChanged.push(id); }
        // two owners [C2]: the graph hides it (cHid) when it is shown, or when the other owner hides it
        if (!s.cHid && (s.visible !== false || s.undefHid)) { s.visible = false; s.cHid = true; }
        if (!was) out.ids.push(id);
        continue;
      }
      if (was) {
        delete s.cundef; out.undefChanged.push(id);
        if (s.cHid) { delete s.cHid; if (!s.undefHid) s.visible = true; }
      }
      if (r.inf) { if (!wasInf) { s._atInf = true; r.ch = true; } } else if (wasInf) { delete s._atInf; r.ch = true; }
      if (r.ch || was) out.ids.push(id);
      if (r.kindChanged) out.kindChanged.push(id);
    }
    lastRecompute = { n: todo.length, ids: out.ids.length, at: Date.now() };
    return out;
  }
  let lastRecompute = null;
  function makeCtx(state, env, G) {
    const idx = G ? G.idx : index(state);
    const pieceCache = new Map();
    const ctx = { state, idx, env: env || {}, pieceCache };
    ctx.piecesOf = (s) => { if (!pieceCache.has(s)) pieceCache.set(s, pieces(s, ctx.env)); return pieceCache.get(s); };
    // the three points of a circle3 for its glider parameter, null when it is not a circle3; 'inf': an argument is
    // undefined. One of them may be infinity (INF): the limit map keeps the glider continuous [review math-12]
    ctx.pts3Of = (cs, plane) => pts3In(ctx, cs, plane);
    return ctx;
  }
  function pts3In(ctx, cs, plane) {
    // a perpendicular circle: the M(R) map anchored at P, scaled by |PQ|, its sign undoing the flip
    // (z(t) = mR(K at P, sg |PQ| tan(pi t)): P at 0, the point opposite P at 1/2, infinity there for a line)
    if (cs && cs.def && cs.def.op === 'perp') {
      if ((cs.def.seg || cs.def.between) && cs._seg) return null;           // (Inside C only, or Between: the arc's own t, 0 to 1 between its ends)
      const R = cs.def.args.slice(1).map((r) => resolveIn(ctx, r, plane));
      if (R.some((x) => x.undef)) return 'inf';
      const fin = R.filter((x) => !x.inf).map((x) => x.z);
      if (!fin.length) return 'inf';
      return { mr: fin[0], s: fin.length === 2 ? abs(sub(fin[1], fin[0])) : 1, sg: cs.def.flip ? -1 : 1 };
    }
    if (cs && cs.def && cs.def.op === 'touch') {
      if (cs.def.args[2] && cs.def.args[2].inf) return null;
      const R = cs.def.args.slice(1).map((r) => resolveIn(ctx, r, plane));
      if (R.some((x) => x.undef)) return 'inf';
      const fin = R.filter((x) => !x.inf).map((x) => x.z);
      if (!fin.length) return 'inf';
      return { mr: fin[0], s: fin.length === 2 ? abs(sub(fin[1], fin[0])) : 1, sg: cs.def.flip ? -1 : 1 };
    }
    if (!cs || !cs.def || cs.def.op !== 'circle3') return null;
    const R = cs.def.args.map((r) => resolveIn(ctx, r, plane));
    if (R.some((x) => x.undef)) return 'inf';
    if (R.filter((x) => x.inf).length > 1) return 'inf';
    return R.map((x) => (x.inf ? INF : x.z));
  }
  // Constr.pts3(state, shape, plane, env): the same, for the interface's projections
  function pts3(state, s, plane, env) {
    const r = pts3In({ state, idx: index(state), env: env || {} }, s, plane | 0);
    return r === 'inf' ? null : r;
  }

  // ---------------------------------------------------------------- validate (load), plans (SPEC 8, 9)
  // Constr.validate(state, env): fallbacks [C29], refs, argument types, cycles. Shapes that fail drop def and at
  // (their concrete fields stay). Returns {freed: n}
  function validate(state, env) {
    let freed = 0;
    const steps = Array.isArray(state.steps) ? state.steps : [];
    const uids = new Set(steps.map((st) => st && st.uid));
    const f1 = steps[0] && steps[0].type === 'zp' ? steps[0] : null;
    const idx = index(state);
    const free = (s) => {
      delete s.def; delete s.at; delete s.helper; delete s.owner;
      if (s.cHid) { delete s.cHid; if (!s.undefHid) s.visible = true; }
      delete s.cundef; delete s._g; delete s._atInf; delete s._seg;
      freed++;
    };
    const okPointRef = (r, plane) => {
      if (!isPointRef(r)) return false;
      if (r.inf) return true;
      if (typeof r.zp === 'string') {
        if (!['zeros', 'poles'].includes(r.kind) || typeof r.id !== 'string') {
          // fallback by index
          if (!['zeros', 'poles'].includes(r.kind) || !Number.isInteger(r.i)) return false;
        }
        if (!uids.has(r.zp)) {
          // [C29] a uid found nowhere: rebind to f1 when f1 is a zeros-and-poles step
          if (!f1) return true;          // stays (undefined: "the step was removed")
          r.zp = f1.uid;
        }
        const st = steps.find((x) => x && x.uid === r.zp);
        if (st && st.zpIds && Array.isArray(st.zpIds[r.kind]) && !st.zpIds[r.kind].includes(r.id)) {
          if (Number.isInteger(r.i) && r.i >= 0 && r.i < st.zpIds[r.kind].length && !st._idsKept) r.id = st.zpIds[r.kind][r.i];
        }
        return true;
      }
      if (typeof r.img === 'string') { const e = idx.get(r.img); return plane === 1 && !!e && e.plane === 0; }
      const e = idx.get(r.s);
      if (!e || e.plane !== plane) return false;
      if (r.h) return handleKeys(e.s).includes(r.h);
      return e.s.kind === 'point';
    };
    const okCurveRef = (r, plane) => {
      if (!isCurveRef(r)) return false;
      const e = idx.get(r.s);
      if (!e || e.plane !== plane) return false;
      return true;              // the piece count may follow the shape's kind (checked at recompute: undefined)
    };
    lists(state).forEach((L, plane) => {
      for (const s of L) {
        if (!s || !isNode(s)) continue;
        let ok = true;
        if (s.at != null) {
          if (typeof s.at !== 'object' || Array.isArray(s.at)) ok = false;
          else {
            const hk = handleKeys(s);
            for (const [k, r] of Object.entries(s.at)) if (!hk.includes(k) || !okPointRef(r, plane)) { ok = false; break; }
            if (ok && !Object.keys(s.at).length) delete s.at;
          }
        }
        if (ok && s.def != null) {
          const d = s.def, O = d && OPS[d.op];
          if (!O || !Array.isArray(d.args) || d.args.length !== O.n) ok = false;
          else if (O.pts && !d.args.every((r) => okPointRef(r, plane))) ok = false;
          else if (O.curves && !d.args.every((r) => okCurveRef(r, plane))) ok = false;
          else if (O.sig && !d.args.every((r, i) => (O.sig[i] === 'c' ? okCurveRef(r, plane) : okPointRef(r, plane)))) ok = false;
          else if (d.op === 'meet' && !(d.index === 0 || d.index === 1 || d.index === 'finite')) d.index = 0;
          else if (d.op === 'tangent' && !(d.index === 0 || d.index === 1)) d.index = 0;
          if (ok && ['circle3', 'perp', 'touch', 'tangent'].includes(d.op) && d.fill !== 'in') d.fill = 'none';
          if (ok && ['circle3', 'perp', 'touch', 'tangent'].includes(d.op) && d.flip != null) d.flip = !!d.flip;
          // [v16.4 segments] Inside C only: a perpendicular circle drawn as a curve, seg 1 or -1 (Region wins)
          if (ok && 'seg' in d && !(d.op === 'perp' && (d.seg === 1 || d.seg === -1) && d.fill !== 'in')) delete d.seg;
          // [issue #70] Between z0 and z1: between 1 on a perpendicular circle drawn as a curve; it wins over seg
          if (ok && 'between' in d && !(d.op === 'perp' && d.between === 1 && d.fill !== 'in')) delete d.between;
          if (ok && d.between === 1) delete d.seg;
          if (ok && d.op === 'glider' && !Number.isFinite(s.t)) s.t = 0;
          if (ok && d.seed != null && !isXY(d.seed)) delete d.seed;
        }
        if (ok && s.cundef && (typeof s.cundef !== 'object' || typeof s.cundef.code !== 'string')) delete s.cundef;
        if (!ok) free(s);
      }
    });
    // cycles: the shapes on a cycle become free
    const G = graphOf(state);
    for (const id of G.cyclic) { const e = idx.get(id); if (e) free(e.s); }
    // helpers whose owner is gone stay as ordinary points
    for (const L of lists(state)) for (const s of L) if (s && s.helper && !idx.has(s.owner)) { delete s.helper; delete s.owner; }
    return { freed };
  }
  // Constr.deletePlan(state, ids) -> {del, freed: [{id, key}], undef: []}: only definitions cascade [C17]; the at
  // bindings to a deleted shape are freed; helpers go with their owner when nothing else uses them [C16]
  function deletePlan(state, ids) {
    const G = graphOf(state);
    const del = new Set(ids);
    let grew = true;
    while (grew) {
      grew = false;
      for (const n of G.nodes.values()) {
        if (del.has(n.id) || !n.s.def) continue;
        if (n.s.def.args.some((r) => del.has(refDep(r)))) { del.add(n.id); grew = true; }
      }
      // helpers owned by deleted shapes that nothing kept uses
      for (const L of lists(state)) for (const s of L) {
        if (!s || !s.helper || del.has(s.id) || !del.has(s.owner)) continue;
        const usedBy = [...(G.users.get(s.id) || [])].filter((u) => !del.has(u));
        if (!usedBy.length) { del.add(s.id); grew = true; }
      }
    }
    const freed = [];
    for (const n of G.nodes.values()) {
      if (del.has(n.id) || !n.s.at) continue;
      for (const [k, r] of Object.entries(n.s.at)) if (del.has(refDep(r))) freed.push({ id: n.id, key: k });
    }
    return { del: [...del], freed, undef: [] };
  }
  // Constr.zeroRemovePlan(state, zref {zp, kind, id}) -> {undef: [ids], freed: [{id, key}]} [C12]
  function zeroRemovePlan(state, zref) {
    const G = graphOf(state);
    const hit = (r) => r && r.zp === zref.zp && r.kind === zref.kind && r.id === zref.id;
    const freed = [], direct = new Set();
    for (const n of G.nodes.values()) {
      if (n.s.at) for (const [k, r] of Object.entries(n.s.at)) if (hit(r)) freed.push({ id: n.id, key: k });
      if (n.s.def && n.s.def.args.some(hit)) direct.add(n.id);
    }
    const undef = [...closure(G, direct)].filter((id) => G.nodes.get(id) && G.nodes.get(id).s.def);
    return { undef, freed };
  }
  // apply a plan's freed bindings (the handle stays where it is and becomes free)
  function applyFreed(state, freed) {
    const idx = index(state);
    for (const { id, key } of freed) {
      const e = idx.get(id);
      if (!e || !e.s.at) continue;
      delete e.s.at[key];
      if (!Object.keys(e.s.at).length) delete e.s.at;
    }
  }
  // Constr.moveRoots(state, id) -> [free point ids] | null: translating those moves the shape and everything built on
  // them exactly (constructions commute with translation) [C18]
  function moveRoots(state, id) {
    const G = graphOf(state), idx = G.idx;
    const n0 = G.nodes.get(id);
    if (!n0) return null;
    const out = new Set(), seen = new Set(), st = [id];
    while (st.length) {
      const x = st.pop();
      if (seen.has(x)) continue; seen.add(x);
      const n = G.nodes.get(x);
      if (n) {
        for (const { ref } of refsOf(n.s)) {
          if (!ref || ref.inf) continue;
          if (typeof ref.zp === 'string' || typeof ref.img === 'string') return null;
          if (ref.h || ref.part != null) {
            const e = idx.get(ref.s);
            if (!e) return null;
            // a curve or handle of a constructed / bound shape: follow it; of a free shape: not a point root
            if (G.nodes.has(ref.s)) { st.push(ref.s); continue; }
            return null;
          }
          st.push(ref.s);
        }
        continue;
      }
      const e = idx.get(x);
      if (!e || e.s.kind !== 'point') return null;
      out.add(x);
    }
    const pos = [...idx.keys()];
    return [...out].sort((a, b) => pos.indexOf(a) - pos.indexOf(b));
  }
  // Constr.wouldCycle(state, id, refs): would shape id depending on these refs close a cycle (a ref to id itself or to
  // anything built on it)? [review math-6]
  function wouldCycle(state, id, refs) {
    const G = graphOf(state);
    const bad = closure(G, [id]);
    return (refs || []).some((r) => { const d = refDep(r); return d != null && bad.has(d); });
  }
  // Constr.dragRoots(state, id) -> [refs]: what the user can drag to change shape id, following definitions and bound
  // handles down to free points, free handles, zeros and free curves [review user-13]
  function dragRoots(state, id) {
    const idx = index(state), out = [], seen = new Set(), keys = new Set();
    const add = (r) => { const k = refKey(r); if (!keys.has(k)) { keys.add(k); out.push(r); } };
    const walk = (s, depth) => {
      if (!s || seen.has(s.id) || depth > 32) return;
      seen.add(s.id);
      for (const { ref } of refsOf(s)) visit(ref, depth + 1);
    };
    const visit = (r, depth) => {
      if (!r || r.inf) return;
      if (typeof r.zp === 'string') { add(r); return; }
      if (typeof r.img === 'string') { const e = idx.get(r.img); if (e) visit({ s: r.img }, depth); return; }
      const e = idx.get(r.s);
      if (!e) return;
      const t = e.s;
      if (r.part != null) { if (isNode(t)) walk(t, depth); else add({ s: t.id, part: r.part }); return; }
      if (r.h) { if (t.at && t.at[r.h]) visit(t.at[r.h], depth + 1); else add(r); return; }
      if (t.def) { walk(t, depth); return; }
      if (t.at && t.at.p) { visit(t.at.p, depth + 1); return; }
      add({ s: t.id });
    };
    const e = idx.get(id);
    if (e) walk(e.s, 0);
    return out;
  }
  // Constr.describe(state, id) -> {op, args, fill, flip, index, family, t, at, inf, undef, note} (no text)
  // Constr.setFlip(state, id, flip): Use complement on a 3-point, perpendicular or touching circle. Flipping K's form
  // reverses the entering rule of every meet on it (index 0 and 1 trade places), so the meet points on K swap their index
  // in the same step and stay where they are [v16.3 review math-5]. Returns the ids of the meets swapped
  function setFlip(state, id, flip) {
    const e = index(state).get(id), d = e && e.s.def;
    if (!d) return [];
    const was = !!d.flip, now = !!flip;
    d.flip = now;
    if (was === now || !FLIPPED.includes(d.op)) return [];
    const out = [];
    for (const L of lists(state)) for (const s of L) {
      const m = s && s.def;
      if (!m || m.op !== 'meet' || m.seed || !(m.index === 0 || m.index === 1) || !Array.isArray(m.args) || !m.args.some((r) => r && r.s === id)) continue;
      m.index = 1 - m.index; out.push(s.id);
    }
    return out;
  }
  function describe(state, id) {
    const e = index(state).get(id);
    if (!e) return null;
    const s = e.s, d = s.def || null;
    let family = s.kind;
    if (s.kind === 'disc' && s.complement) family = 'complement';
    return {
      op: d ? d.op : (s.at ? 'bound' : null), args: d ? d.args.slice() : [], at: s.at ? Object.assign({}, s.at) : null,
      fill: d && ['circle3', 'perp', 'touch'].includes(d.op) ? (d.fill === 'in' ? 'in' : 'none') : null, flip: d ? !!d.flip : null,
      seg: d && d.op === 'perp' ? (d.seg === 1 || d.seg === -1 ? d.seg : 0) : null,
      between: d && d.op === 'perp' ? (d.between === 1 ? 1 : 0) : null,
      index: d && (d.op === 'meet' || d.op === 'tangent') ? d.index : null, family, t: d && d.op === 'glider' ? s.t : null,
      inf: !!s._atInf, undef: s.cundef || null, note: s._note || null,
    };
  }
  // the M(R) samples of a huge circle or a gcircle near a window (SPEC 2.2 [C7]): Float64Array [x0, y0, ...],
  // dense (step) within the window's reach, geometric (ratio) beyond, closing through the antipode
  function sampleMR(G, win, step, far) {
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2;
    const H = reanchor(G, [cx, cy]);
    const H0 = Object.assign({}, H, { C: 0 });
    const all = mrTaus(H, win, step, far);
    const out = [];
    for (const x of all) { const z = mR(H0, x); out.push(z[0], z[1]); }
    if (H.A !== 0) { const z = mR(H0, Infinity); out.push(z[0], z[1]); const z0 = mR(H0, all[0]); out.push(z0[0], z0[1]); }
    return new Float64Array(out);
  }
  // sampleMR's parameters (ascending) for the form H re-anchored at the window's centre (segSample's too)
  function mrTaus(H, win, step, far) {
    const cx = (win.x0 + win.x1) / 2, cy = (win.y0 + win.y1) / 2, diag = Math.hypot(win.x1 - win.x0, win.y1 - win.y0);
    const d0 = Math.hypot(H.o[0] - cx, H.o[1] - cy);
    const inner = 0.625 * diag + d0;                       // |tau| within which the curve can meet the 1.25x window
    const ts = [0];
    for (let i = 1, n = Math.ceil(inner / step); i <= n; i++) ts.push(inner * i / n);
    let t = inner, h = step;
    const lim = H.A === 0 ? (far || 220) * diag / 2 : 1e28;
    while (t < lim && ts.length < 6000) { h *= 1.035; if (H.A !== 0 && Math.abs(H.A * t) > 8) h = t * 0.25; t += h; ts.push(Math.min(t, lim)); }
    return ts.slice(1).reverse().map((x) => -x).concat(ts);
  }

  return {
    // PoC (the 66 + 18 tests: test/t_constr.js)
    graph: (st) => (st && (Array.isArray(st.shapes) || Array.isArray(st.targets)) ? graph2(st) : graph()), fromJSON, parse, analyze, latin, namesOf, project: (a, z) => (a && a.kind ? projectPiece(a, z) : project(a, z)), apollonius, steiner, crossing, evalAst, FormulaError, INF, isInf,
    orient, circle3, line2, circleCP, circleCR, bisector, onCurve, paramNear, fOf, geomOf, isLine, shapeOf, equationCurve,
    CURVE_KINDS, POINT_KINDS, get exactCalls() { return exactCalls; },
    mob3t, mob3inv, meets2: meets, meets0,
    // v16 CORE (SPEC 20.2)
    formOf, formOfFields, level, reanchor, mob3: mob3obj, mR, sampleMR,
    pieces, meets: (a, b) => (a && a.G ? meetsPieces(a, b) : meets(a, b)), meetNear, project2: projectPiece, projectPiece, glide, onPiece, tRange,
    resolve, graphOf: graph2, recompute, validate, deletePlan, zeroRemovePlan, applyFreed, moveRoots, describe,
    syncSteps, zpRemoveId, zpNum, zpRenumber, refKey, isPointRef, isCurveRef, OPS, POINT_OPS,
    // v16.5 rail (notes/ux-build/rail/SPEC.md)
    gridStep, GRID_TIERS, DETENT_DEG, angleDetent, latticeDetentR, RAIL, railPull, turnCS, antipodeLine,
    // v16 review fixes
    orientD, projectForm, pieceDist, pieceBox, pts3, perpForm, touchForm, tangentForm, tangentNear, onCurveByRefs, touchAt, setFlip, wouldCycle, dragRoots, idReplacer, referencedSteps,
    // v16.4: Inside C only (notes/orthogonal-circle/segments/SPEC.md)
    segOf, betweenOf, segAt, segSideOf, segSides, setSeg, setBetween, segCurves, mirrorIn, gcOf, onCarrier,
    get lastRecompute() { return lastRecompute; },
  };
});
import { Region } from './region.js';
export { Constr, Constr as 'module.exports' };
