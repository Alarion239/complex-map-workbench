// @ts-check
'use strict';
// Part 1 of the constructions (constr.js's header): the proof of concept, kept whole (its 84 tests run against Constr
// in test/t_constr.js): the exact predicate, forms, meets with the entering rule, Moebius gliders, a named-node graph
// with formulas. Moved out of constr.js (issue #20, the file-size budget) as a factory constr.js calls where this part
// stood, with the names of its own this part reads (reanchor is the v16 core's); constr.js takes the names back.
const ConstrPoc = (host) => {
  const { EPS, INF, isInf, reanchor } = host;
  const isXY = (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

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
  /** @returns {[bigint, number] | null} */
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
    if (/[\u0400-\u04FF]/.test(s)) { const e = /** @type {any} */ (new FormulaError('Use Latin letters for names')); e.ru = 'Используйте латинские буквы'; throw e; }
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
  /** @returns {any[] & { coincide?: boolean }} */
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
  const coincideMark = () => { const r = /** @type {any[] & { coincide?: boolean }} */ ([null, null]); r.coincide = true; return r; };
  /** @returns {any[] & { coincide?: boolean }} */
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

  return {
    get exactCalls() { return exactCalls; },
    isXY, decompose, ldexp, orient, decOf, orientD, add, sub, mul, div, scl, abs, dot, cross, latin, parse, namesOf,
    analyze, evalAst, gc, isLine, fOf, geomOf, circle3, line2, withPts, circleCP, circleCR, bisector, crossing, meets,
    meets0, onCurve, paramNear, mob3inv, project, projectForm, apollonius, steiner, equationCurve, CURVE_KINDS,
    POINT_KINDS, graph, fromJSON, shapeOf, FormulaError
  };
};
export { ConstrPoc };
