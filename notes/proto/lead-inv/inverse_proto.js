'use strict';
// Lead prototype of src/inverse.js (notes/sphere-design/SPEC.md section 3): exact preimage enumeration for the
// whole catalog, CPU float64. Each catalog step is decomposed into primitive inverse ops (IOPs); every IOP has the
// app's own forward evaluation (fwd) and an enumerator pre(w, ref, ext) of ALL preimages that respect the forward
// step's branch (range level lvl >= 0 inside the forward step's range, distance-like, in the op's output units).
// Infinite families are enumerated as a window of 2M+1 members around the member nearest the reference point.
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
global.CX = global.CX || require(path.join(ROOT, 'src/cx.js'));
global.Expr = global.Expr || require(path.join(ROOT, 'src/parse.js'));
global.Funcs = global.Funcs || require(path.join(ROOT, 'src/funcs.js'));
const { C } = CX;
const PI = Math.PI, TAU = 2 * PI, DEG = PI / 180;
const { add, sub, mul, div, neg, conj, abs, exp, log, scale } = CX;
const ONE = C(1, 0), I = C(0, 1);

const M_WIN = 8;          // family window: m* - M .. m* + M
const LEAF_CAP = 48;      // leaves per pixel

// ---------------- primitive inverse ops ----------------
// member: {u, d (du/dw complex) | anti, lvl (op output units, +inside, unit gradient), lg (unit complex gradient of
// lvl in the op's output plane), lam (log u when known), idx}
const fam = (n) => n; // documentation helper
function opAff(a, b) {
  return { kind: 'AFF', a, b, fwd: (u) => add(mul(a, u), b), count: 'one',
    pre: (w) => [{ u: div(sub(w, b), a), d: CX.inv(a), lvl: Infinity }] };
}
function opMob(m) {
  const [a, b, c, d] = m, det = sub(mul(a, d), mul(b, c));
  return { kind: 'MOB', m, fwd: (u) => CX.mobApply(m, u), count: 'one',
    poles: CX.isZero(c) ? [] : [CX.neg(div(d, c))],
    pre: (w) => {
      const den = add(mul(neg(c), w), a);
      if (den.re === 0 && den.im === 0) return [];                      // w = a/c: the image of infinity
      return [{ u: div(sub(mul(d, w), b), den), d: div(det, mul(den, den)), lvl: Infinity }];
    } };
}
function opIpow(n, fwd) {
  return { kind: 'IPOW', n, fwd: fwd || ((u) => CX.ipow(u, n)), count: Math.abs(n), poles: n < 0 ? [C(0, 0)] : [],
    pre: (w) => {
      if (w.re === 0 && w.im === 0) return n > 0 ? [{ u: C(0, 0), d: C(Infinity, 0), lvl: Infinity, idx: 0 }] : [];
      const q = n > 0 ? w : CX.inv(w), an = Math.abs(n);
      const r = Math.pow(abs(q), 1 / an), t = Math.atan2(q.im, q.re), out = [];
      for (let j = 0; j < an; j++) {
        const th = (t + TAU * j) / an, u = C(r * Math.cos(th), r * Math.sin(th));
        out.push({ u, d: div(u, scale(w, n)), lvl: Infinity, idx: j });
      }
      return out;
    } };
}
// w = u^s on branch (theta, k): u = e^L, L = log_{theta,k} u, Im L in (lo, hi]; w = e^{s L}
function opRootPow(s, theta, k, fwd) {
  const beta = CX.inv(s), lo = theta - TAU + TAU * k, hi = theta + TAU * k, sAbs = abs(s);
  const bInt = beta.im === 0 && Math.abs(beta.re - Math.round(beta.re)) < 1e-12 && Math.round(beta.re) !== 0;
  const inf = Math.abs(beta.re) <= 1e-12 * abs(beta);
  const op = { kind: 'ROOTPOW', s, theta, k, fwd: fwd || ((u) => CX.pow(u, s, theta, k)),
    count: bInt ? 'one' : inf ? 'inf' : 'fin', undef: inf || s.im !== 0 ? [C(0, 0), null] : [], branch: [C(0, 0)],
    poles: s.re < 0 ? [C(0, 0)] : [] };
  const member = (bL, m, w) => {
    const L = C(bL.re - TAU * m * beta.im, bL.im + TAU * m * beta.re);
    const a = L.im - lo, b = hi - L.im;
    const u = exp(L);
    const g = mul(I, conj(div(beta, w)));                               // grad_w Im L (complex)
    const gl = abs(g) || 1, sg = a < b ? 1 : -1;
    return { u, d: div(mul(beta, u), w), lvl: Math.min(a, b) * sAbs * abs(w), lg: C(sg * g.re / gl, sg * g.im / gl), lam: L, idx: m };
  };
  op.pre = (w, ref) => {
    if (w.re === 0 && w.im === 0) return [];
    const bL = mul(beta, log(w));
    if (bInt) {                                                         // root-like: every m gives the same u
      const m = Math.round(((lo + hi) / 2 - bL.im) / (TAU * beta.re));
      return [member(bL, m, w)];
    }
    let m0, m1;
    if (!inf) {
      const xa = (lo - bL.im) / (TAU * beta.re), xb = (hi - bL.im) / (TAU * beta.re);
      m0 = Math.ceil(Math.min(xa, xb)) - 1; m1 = Math.floor(Math.max(xa, xb)) + 1;
      if (m1 - m0 > 2 * M_WIN) {
        const lr = ref && CX.isFin(ref) && abs(ref) > 0 ? Math.log(abs(ref)) : 0;
        const ms = Math.round((bL.re - lr) / (TAU * beta.im));
        m0 = Math.max(m0, ms - M_WIN); m1 = Math.min(m1, ms + M_WIN);
      }
    } else {
      const lr = ref && CX.isFin(ref) && abs(ref) > 0 ? Math.log(abs(ref)) : 0;
      const ms = Math.round((bL.re - lr) / (TAU * beta.im));
      m0 = ms - M_WIN; m1 = ms + M_WIN;
    }
    const out = [];
    for (let m = m0; m <= m1; m++) out.push(member(bL, m, w));
    return out;
  };
  return op;
}
// w = e^{u L0} (L0 = 1: exp)
function opExp(L0) {
  const isE = !L0;
  const Lc = L0 || ONE;
  return { kind: isE ? 'EXP' : 'EXPC', L0: Lc, fwd: isE ? CX.exp : (u) => CX.exp(mul(u, Lc)), count: 'inf', undef: [null], period: div(C(0, TAU), Lc),
    pre: (w, ref, ext) => {
      if (w.re === 0 && w.im === 0) return [];
      const Lw = log(w), out = [];
      const t = ref && CX.isFin(ref) ? sub(mul(ref, Lc), Lw) : C(0, 0);
      const ms = Math.round(t.im / TAU);
      let m0 = ms - M_WIN, m1 = ms + M_WIN;
      if (ext) [m0, m1] = ext(m0, m1, (m) => div(add(Lw, C(0, TAU * m)), Lc));
      const d = CX.inv(mul(Lc, w));
      for (let m = m0; m <= m1; m++) out.push({ u: div(add(Lw, C(0, TAU * m)), Lc), d, lvl: Infinity, idx: m });
      return out;
    } };
}
function opLog(theta, k, fwd) {
  const lo = theta - TAU + TAU * k, hi = theta + TAU * k;
  return { kind: 'LOG', theta, k, fwd: fwd || ((u) => CX.log(u, theta, k)), count: 'one', branch: [C(0, 0), null], poles: [C(0, 0)],
    pre: (w) => {
      const u = exp(w), a = w.im - lo, b = hi - w.im;
      return [{ u, d: u, lvl: Math.min(a, b), lg: a < b ? C(0, 1) : C(0, -1), lam: w }];
    } };
}
// periodic families: bases(w) -> [base u], period p (complex); member u = base + n p
function opPeriodic(kind, fwd, bases, period, dudw, exclude) {
  return { kind, fwd, count: 'inf', undef: [null], period,
    pre: (w, ref, ext) => {
      if (exclude && exclude(w)) return [];
      const out = [];
      let bi = 0;
      for (const b of bases(w)) {
        if (!CX.isFin(b)) { bi++; continue; }
        // member index along the period nearest the reference
        const pp = period, t = ref && CX.isFin(ref) ? div(sub(ref, b), pp) : C(0, 0);
        const ns = Math.round(t.re);
        let n0 = ns - M_WIN, n1 = ns + M_WIN;
        if (ext) [n0, n1] = ext(n0, n1, (n) => add(b, scale(pp, n)));
        for (let n = n0; n <= n1; n++) { const u = add(b, scale(pp, n)); out.push({ u, d: dudw(u, w), lvl: Infinity, idx: bi * 1000 + n }); }
        bi++;
      }
      return out;
    } };
}
const opSin = () => opPeriodic('SIN', CX.sin, (w) => { const a = CX.asin(w); return [a, sub(C(PI, 0), a)]; }, C(TAU, 0), (u) => CX.inv(CX.cos(u)));
const opCos = () => opPeriodic('COS', CX.cos, (w) => { const a = CX.acos(w); return [a, neg(a)]; }, C(TAU, 0), (u) => neg(CX.inv(CX.sin(u))));
const opTan = () => opPeriodic('TAN', CX.tan, (w) => [CX.atan(w)], C(PI, 0), (u, w) => CX.inv(add(ONE, mul(w, w))), (w) => w.re === 0 && Math.abs(w.im) === 1);
const opSinh = () => opPeriodic('SINH', CX.sinh, (w) => { const a = CX.asinh(w); return [a, sub(C(0, PI), a)]; }, C(0, TAU), (u) => CX.inv(CX.cosh(u)));
const opCosh = () => opPeriodic('COSH', CX.cosh, (w) => { const a = CX.acosh(w); return [a, neg(a)]; }, C(0, TAU), (u) => CX.inv(CX.sinh(u)));
const opTanh = () => opPeriodic('TANH', CX.tanh, (w) => [CX.atanh(w)], C(0, PI), (u, w) => CX.inv(sub(ONE, mul(w, w))), (w) => w.im === 0 && Math.abs(w.re) === 1);
// principal inverse trig as a forward step: u = g(w), range level on w
function opRange(kind, fwd, g, dg, lvl) {
  return { kind, fwd, count: 'one', pre: (w) => { const r = lvl(w); return [{ u: g(w), d: dg(w), lvl: r[0], lg: r[1] }]; } };
}
const sgn = (x) => (x < 0 ? -1 : 1);
const opAsin = () => opRange('ASIN', CX.asin, CX.sin, CX.cos, (w) => [PI / 2 - Math.abs(w.re), C(-sgn(w.re), 0)]);
const opAcos = () => opRange('ACOS', CX.acos, CX.cos, (w) => neg(CX.sin(w)), (w) => (w.re < PI - w.re ? [w.re, C(1, 0)] : [PI - w.re, C(-1, 0)]));
const opAtan = () => opRange('ATAN', CX.atan, CX.tan, (w) => { const c = CX.cos(w); return CX.inv(mul(c, c)); }, (w) => [PI / 2 - Math.abs(w.re), C(-sgn(w.re), 0)]);
const opAsinh = () => opRange('ASINH', CX.asinh, CX.sinh, CX.cosh, (w) => [PI / 2 - Math.abs(w.im), C(0, -sgn(w.im))]);
const opAcosh = () => opRange('ACOSH', CX.acosh, CX.cosh, CX.sinh, (w) => { const a = w.re, b = PI - Math.abs(w.im); return a < b ? [a, C(1, 0)] : [b, C(0, -sgn(w.im))]; });
const opAtanh = () => opRange('ATANH', CX.atanh, CX.tanh, (w) => { const c = CX.cosh(w); return CX.inv(mul(c, c)); }, (w) => [PI / 2 - Math.abs(w.im), C(0, -sgn(w.im))]);
function opJouk(fwd) {
  return { kind: 'JOUK', fwd, count: 2, poles: [C(0, 0)],
    pre: (w) => {
      const s = mul(CX.sqrt(sub(w, ONE)), CX.sqrt(add(w, ONE))), e = add(w, s);
      return [e, CX.inv(e)].map((u, idx) => { const u2 = mul(u, u); return { u, d: div(scale(u2, 2), sub(u2, ONE)), lvl: Infinity, idx }; });
    } };
}
function opIjouk(sg, fwd) {
  return { kind: 'IJOUK', fwd, count: 'one',
    pre: (w) => { const r = abs(w); return [{ u: scale(add(w, CX.inv(w)), 0.5), d: scale(sub(ONE, CX.inv(mul(w, w))), 0.5), lvl: sg > 0 ? r - 1 : 1 - r, lg: scale(w, (sg > 0 ? 1 : -1) / (r || 1)) }]; } };
}
const opConj = () => ({ kind: 'CONJ', fwd: CX.conj, count: 'one', pre: (w) => [{ u: conj(w), anti: true, lvl: Infinity }] });
// a u^2 + b u + c = w (stable quadratic)
function opQuad(a, b, c, fwd) {
  return { kind: 'QUAD', fwd, count: 2,
    pre: (w) => {
      const cc = sub(c, w), disc = CX.sqrt(sub(mul(b, b), scale(mul(a, cc), 4)));
      const sgn_ = (conj(b).re * disc.re + -conj(b).im * -disc.im) >= 0 ? 1 : -1;   // Re(conj(b) disc) >= 0
      const sd = Math.sign(b.re * disc.re + b.im * disc.im) < 0 ? neg(disc) : disc;
      const q = scale(add(b, sd), -0.5);
      const roots = (q.re === 0 && q.im === 0) ? [C(0, 0), C(0, 0)] : [div(q, a), div(cc, q)];
      return roots.map((u, idx) => ({ u, d: CX.inv(add(scale(mul(a, u), 2), b)), lvl: Infinity, idx }));
    } };
}
// p(u)/q(u) of degree 2 (coprime): p(u) - w q(u) = 0
function opRat2(p, q, fwd) {
  const pad = (co) => [...Array(3 - co.length).fill(C(0, 0)), ...co];
  const P = pad(p), Q = pad(q);
  const dp = (u) => add(scale(mul(P[0], u), 2), P[1]), dq = (u) => add(scale(mul(Q[0], u), 2), Q[1]);
  return { kind: 'RAT2', fwd, count: 2, poles: CX.polyRoots(q),
    pre: (w) => {
      const A = sub(P[0], mul(w, Q[0])), B = sub(P[1], mul(w, Q[1])), Cc = sub(P[2], mul(w, Q[2]));
      let roots;
      if (abs(A) <= 1e-14 * (abs(B) + abs(Cc))) roots = abs(B) > 0 ? [neg(div(Cc, B))] : [];
      else {
        const disc = CX.sqrt(sub(mul(B, B), scale(mul(A, Cc), 4)));
        const sd = (B.re * disc.re + B.im * disc.im) < 0 ? neg(disc) : disc;
        const qq = scale(add(B, sd), -0.5);
        roots = (qq.re === 0 && qq.im === 0) ? [C(0, 0)] : [div(qq, A), div(Cc, qq)];
      }
      return roots.map((u, idx) => {
        const pu = CX.polyEval(p, u), qu = CX.polyEval(q, u);
        const fp = div(sub(mul(dp(u), qu), mul(pu, dq(u))), mul(qu, qu));
        return { u, d: CX.inv(fp), lvl: Infinity, idx };
      });
    } };
}

// ---------------- decomposition of catalog steps ----------------
const INEL = (reason) => ({ ok: false, reason });
function stepOps(b) {
  const id = b.def.id, v = b.vals, P = b.props || {};
  if (b.op === 'deriv') return INEL('d/dz is not a map');
  if (P.constant) return INEL('constant map');
  switch (id) {
    case 'mul': return { ok: true, ops: [opAff(v.c, C(0, 0))] };
    case 'add': return { ok: true, ops: [opAff(ONE, v.c)] };
    case 'affine': return { ok: true, ops: [opAff(v.a, v.b)] };
    case 'recip': return { ok: true, ops: [opMob([C(0, 0), ONE, ONE, C(0, 0)])] };
    case 'mobius': if (!P.mobius) return INEL('Mobius map too close to degenerate'); return { ok: true, ops: [opMob([v.a, v.b, v.c, v.d])] };
    case 'blaschke': {
      if (!P.mobius) return INEL('degenerate');
      const e = C(Math.cos(v.phi * DEG), Math.sin(v.phi * DEG));
      return { ok: true, ops: [opMob([e, neg(mul(e, v.a)), neg(conj(v.a)), ONE])] };
    }
    case 'pown': if (v.n === 0) return INEL('constant'); return { ok: true, ops: [opIpow(v.n, b.f)] };
    case 'root': { const n = Math.max(2, v.n); return { ok: true, ops: [opRootPow(C(1 / n, 0), v.cut * DEG, ((v.k % n) + n) % n, b.f)] }; }
    case 'powa': return { ok: true, ops: [opRootPow(v.alpha, v.cut * DEG, v.k, b.f)] };
    case 'exp': return { ok: true, ops: [opExp(null)] };
    case 'log': return { ok: true, ops: [opLog(v.cut * DEG, v.k, b.f)] };
    case 'sin': return { ok: true, ops: [opSin()] };
    case 'cos': return { ok: true, ops: [opCos()] };
    case 'tan': return { ok: true, ops: [opTan()] };
    case 'sinh': return { ok: true, ops: [opSinh()] };
    case 'cosh': return { ok: true, ops: [opCosh()] };
    case 'tanh': return { ok: true, ops: [opTanh()] };
    case 'arcsin': return { ok: true, ops: [opAsin()] };
    case 'arccos': return { ok: true, ops: [opAcos()] };
    case 'arctan': return { ok: true, ops: [opAtan()] };
    case 'arsinh': return { ok: true, ops: [opAsinh()] };
    case 'arcosh': return { ok: true, ops: [opAcosh()] };
    case 'artanh': return { ok: true, ops: [opAtanh()] };
    case 'joukowski': return { ok: true, ops: [opJouk(b.f)] };
    case 'ijouk': return { ok: true, ops: [opIjouk(v.branch === 'interior' ? -1 : 1, b.f)] };
    case 'conj': return { ok: true, ops: [opConj()] };
    case 'poly': return polyOps(CX.polyTrim(v.co), b.f);
    case 'rational': {
      const p = CX.polyTrim(v.p), q = CX.polyTrim(v.q);
      if (q.length === 1) return polyOps(p.map((c) => div(c, q[0])), b.f);
      if (P.mobius) {
        const two = (co) => (co.length === 1 ? [C(0, 0), co[0]] : co);
        const [a, bb] = two(p), [c, d] = two(q);
        return { ok: true, ops: [opMob([a, bb, c, d])] };
      }
      if (P.degExact && P.deg === 2) return { ok: true, ops: [opRat2(p, q, b.f)] };
      return INEL(`rational map of degree ${P.deg}${P.degExact ? '' : ' (not exact)'}`);
    }
    case 'custom': return customOps(Expr.parse(v.expr), v.cut * DEG);
  }
  return INEL('unknown step ' + id);
}
function polyOps(c, f) {
  const d = c.length - 1;
  if (d <= 0) return INEL('constant');
  if (d === 1) return { ok: true, ops: [opAff(c[0], c[1])] };
  if (c.slice(1, d).every(CX.isZero)) return { ok: true, ops: [opIpow(d), opAff(c[0], c[d])] };
  if (d === 2) return { ok: true, ops: [opQuad(c[0], c[1], c[2], f)] };
  return INEL(`polynomial of degree ${d}`);
}
// a custom formula in which z occurs once: its nodes, outermost first, become ops (returned in forward order)
function customOps(ast, th) {
  const count = (n) => (n.t === 'var' ? 1 : ['a', 'b', 'n'].reduce((s, k) => s + (n[k] ? count(n[k]) : 0), 0));
  for (const vv of Expr.usesVars(ast)) if (vv !== 'z') return INEL('Re/Im/|z|/arg lose information');
  if (count(ast) !== 1) return INEL('z occurs more than once');
  const cval = (n) => Expr.compile(n)(C(0, 0));
  const dep = Expr.depends;
  const out = [];   // outermost first
  let n = ast;
  const nz = (v) => CX.isFin(v) && !CX.isZero(v);
  while (n.t !== 'var') {
    switch (n.t) {
      case 'neg': out.push(opAff(C(-1, 0), C(0, 0))); n = n.a; break;
      case 'add': if (dep(n.a)) { out.push(opAff(ONE, cval(n.b))); n = n.a; } else { out.push(opAff(ONE, cval(n.a))); n = n.b; } break;
      case 'sub': if (dep(n.a)) { out.push(opAff(ONE, neg(cval(n.b)))); n = n.a; } else { out.push(opAff(C(-1, 0), cval(n.a))); n = n.b; } break;
      case 'mul': { const c = dep(n.a) ? cval(n.b) : cval(n.a); if (!nz(c)) return INEL('constant'); out.push(opAff(c, C(0, 0))); n = dep(n.a) ? n.a : n.b; break; }
      case 'div':
        if (dep(n.a)) { const c = cval(n.b); if (!nz(c)) return INEL('constant'); out.push(opAff(CX.inv(c), C(0, 0))); n = n.a; }
        else { const c = cval(n.a); if (!nz(c)) return INEL('constant'); out.push(opMob([C(0, 0), c, ONE, C(0, 0)])); n = n.b; }
        break;
      case 'pow':
        if (!dep(n.b)) {
          const v = cval(n.b);
          if (v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096) { if (v.re === 0) return INEL('constant'); out.push(opIpow(v.re)); }
          else out.push(opRootPow(v, th, 0));
          n = n.a;
        } else if (!dep(n.a)) {
          const base = cval(n.a);
          if (!nz(base) || (base.re === 1 && base.im === 0)) return INEL('constant');
          out.push(base.re === Math.E && base.im === 0 ? opExp(null) : opExp(CX.log(base)));
          n = n.b;
        } else return INEL('variable base and exponent');
        break;
      case 'root': { const v = cval(n.n); out.push(opRootPow(CX.div(ONE, v), th, 0)); n = n.a; break; }
      case 'call': {
        const f = n.f;
        const T = { log: () => opLog(th, 0), sqrt: () => opRootPow(C(0.5, 0), th, 0), exp: () => opExp(null), sin: opSin, cos: opCos, tan: opTan, sinh: opSinh, cosh: opCosh, tanh: opTanh,
          asin: opAsin, acos: opAcos, atan: opAtan, asinh: opAsinh, acosh: opAcosh, atanh: opAtanh, conj: opConj };
        const RECIP = { cot: opTan, sec: opCos, csc: opSin, coth: opTanh };
        if (T[f]) out.push(T[f]());
        else if (RECIP[f]) { out.push(opMob([C(0, 0), ONE, ONE, C(0, 0)])); out.push(RECIP[f]()); }
        else return INEL(`${f} loses information`);
        n = n.a;
        break;
      }
      default: return INEL('node ' + n.t);
    }
  }
  return { ok: true, ops: out.reverse() };
}

// ---------------- the chain ----------------
// steps, built (app arrays); stages (a, b]; returns {ok, ops (forward order, with .step), reason}
function planChain(steps, built, a = 0, b = steps.length) {
  const ops = [];
  for (let k = a + 1; k <= b; k++) {
    const st = steps[k - 1], bb = built[k - 1];
    if (!st || st.on === false || !bb || bb.error || !bb.def) continue;   // identity, as GLChain
    const r = stepOps(bb);
    if (!r.ok) return { ok: false, reason: `step ${k}: ${r.reason}` };
    for (const o of r.ops) { o.step = k; ops.push(o); }
  }
  return { ok: true, ops };
}
// real 2x2 Jacobians [a, b, c, d] (row-major: [dx'/dx dx'/dy; dy'/dx dy'/dy])
const jC = (z) => [z.re, -z.im, z.im, z.re];
const jMul = (A, B) => [A[0] * B[0] + A[1] * B[2], A[0] * B[1] + A[1] * B[3], A[2] * B[0] + A[3] * B[2], A[2] * B[1] + A[3] * B[3]];
const J_CONJ = [1, 0, 0, -1];
// refs: the forward values of the reference point at each op's input; ext(i): pruning for op i (or null)
function makeRefs(plan, c0) {
  const refs = [];
  let z = c0;
  for (const o of plan.ops) { refs.push(z); z = o.fwd(z); }
  return refs;
}
// all leaves for pixel w (stage-b value); pxw: pixel size in w units. Returns [{z, J (dz/dw, real 2x2), lvl (px),
// lg (unit image-space gradient of the binding range level), lam, path}]
function enumerate(plan, w, refs, pxw, opts = {}) {
  const RAMP = opts.ramp ?? 1;
  let leaves = [{ u: w, J: [1, 0, 0, 1], lvl: Infinity, lg: null, lam: null, path: '' }];
  let peak = 1;
  for (let i = plan.ops.length - 1; i >= 0; i--) {
    const o = plan.ops[i], next = [];
    for (const lf of leaves) {
      if (!CX.isFin(lf.u)) continue;
      const sc = Math.sqrt(Math.abs(lf.J[0] * lf.J[3] - lf.J[1] * lf.J[2]));   // |dw_i/dw|
      for (const p of o.pre(lf.u, refs[i], opts.ext ? opts.ext(i) : null)) {
        const lv = p.lvl === Infinity ? Infinity : p.lvl / (sc * pxw);
        if (lv < -RAMP) continue;
        let lg = lf.lg;
        if (lv < lf.lvl && p.lg) {
          // image-space direction: grad_w lvl = J^T grad_{w_i} lvl
          const g = [lf.J[0] * p.lg.re + lf.J[2] * p.lg.im, lf.J[1] * p.lg.re + lf.J[3] * p.lg.im], gl = Math.hypot(g[0], g[1]) || 1;
          lg = [g[0] / gl, g[1] / gl];
        }
        const D = p.anti ? J_CONJ : jC(p.d);
        next.push({ u: p.u, J: jMul(D, lf.J), lvl: Math.min(lf.lvl, lv), lg, lam: i === 0 ? (p.lam || null) : null, path: lf.path + '.' + (p.idx ?? 0) });
      }
    }
    peak = Math.max(peak, next.length);
    leaves = next.length > LEAF_CAP && opts.cap !== false ? next.slice(0, LEAF_CAP) : next;
  }
  const out = leaves.map((l) => ({ z: l.u, J: l.J, lvl: l.lvl, lg: l.lg, lam: l.lam, path: l.path }));
  out.peak = peak;
  return out;
}

module.exports = { planChain, stepOps, enumerate, makeRefs, customOps, M_WIN, LEAF_CAP, ops: { opAff, opMob, opIpow, opRootPow, opExp, opLog, opSin, opCos, opTan, opSinh, opCosh, opTanh, opAsin, opAcos, opAtan, opAsinh, opAcosh, opAtanh, opJouk, opIjouk, opConj, opQuad, opRat2 } };
