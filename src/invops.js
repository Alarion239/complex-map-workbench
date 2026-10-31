// @ts-check
'use strict';
// The inverse's primitive ops and the catalog's decomposition into them (notes/sphere-design/SPEC.md, sections 3.2
// and 3.3): moved out of inverse.js (issue #20, the file-size budget), which takes these names back at the top of
// its closure (const { ... } = InvOps), so Inverse and glsl.js's walker read them as before. A closure of its own,
// as every module of src/ is, so that the test pages that inline the sources into one script see one name, InvOps.
const InvOps = (() => {
  const { C } = CX;
  const { add, sub, mul, div, neg, conj, abs, exp, log, scale, isFin, isZero } = CX;
  const PI = Math.PI, TAU = 2 * PI, DEG = PI / 180, LN2 = Math.LN2;
  const ONE = C(1, 0), ZERO = C(0, 0), I = C(0, 1);
  const IPOW_MAX = 16;       // the integer powers budget (SPEC 3.1; Inverse.IPOW_MAX)
  const sgn = (x) => (x < 0 ? -1 : 1);

  // =====================================================================================================
  // 1. Primitive ops (SPEC 3.2). The CPU and the GLSL share these semantics exactly.
  // =====================================================================================================
  // Op: {kind, p (parameters, for glsl.js), fwd(u) -> w, pre(w) -> Member[] (single-valued and finite ops),
  //      fam: null | {type: 'fin', count} | {type: 'add', p, nb, bases(w) -> (C|null)[], member(w, b, m, base)}
  //               | {type: 'log', beta, S, lo, hi, inf, radial, count, L0(w), member(w, m, L0)},
  //      undef, branch: (C|null)[] (null = infinity) input points; poles: C[] (input points mapped to infinity);
  //      lattice: {base, step} | null (a pole lattice); infPre: infinity is a preimage of infinity; infAt(w): infinity
  //      is a preimage of the finite point w}
  // Member: {u, d: du/dw | anti: true, lvl (output units, +Infinity: no range), lg: unit gradient of lvl (output
  //      plane) | null, lam: log u | null, dlam: d(log u)/dw (with lam), m}
  // Parameters in p (read by glsl.js's uInv allocator): AFF {a, b}; MOB {m: [a, b, c, d]}; IPOW {n};
  //      ROOTPOW {s, beta, theta, k, lo, hi, mode: 'int' | 'finite' | 'inf'}; EXPC {L0}; LOG {theta, k, lo, hi};
  //      IJOUK {sg}; QUAD {a, b, c}; RAT2 {P: [p2, p1, p0], Q: [q2, q1, q0]}; the others {}.
  function op(kind, p, fwd, o) {
    return Object.assign({ kind, p, fwd, fam: null, undef: [], branch: [], poles: [], lattice: null, infPre: true, infAt: null }, o);
  }
  const ONEM = (u, d, extra) => Object.assign({ u, d, lvl: Infinity, lg: null, lam: null, dlam: null }, extra);

  function opAff(a, b) {
    const ia = CX.inv(a);
    return op('AFF', { a, b }, (u) => add(mul(a, u), b), { pre: (w) => [ONEM(div(sub(w, b), a), ia)] });
  }
  function opMob(m) {
    const [a, b, c, d] = m, det = sub(mul(a, d), mul(b, c)), cz = isZero(c);
    return op('MOB', { m }, (u) => CX.mobApply(m, u), {
      poles: cz ? [] : [neg(div(d, c))], infPre: cz,
      infAt: (w) => { const den = add(mul(neg(c), w), a); return den.re === 0 && den.im === 0; },
      pre: (w) => {
        const den = add(mul(neg(c), w), a);
        if (den.re === 0 && den.im === 0) return [];                       // w = a/c: the image of infinity
        return [ONEM(div(sub(mul(d, w), b), den), div(det, mul(den, den)))];
      },
    });
  }
  function opIpow(n, fwd) {
    const an = Math.abs(n);
    return op('IPOW', { n }, fwd || ((u) => CX.ipow(u, n)), {
      fam: { type: 'fin', count: an }, poles: n < 0 ? [ZERO] : [], infPre: n > 0,
      infAt: (w) => n < 0 && isZero(w),
      pre: (w) => {
        if (w.re === 0 && w.im === 0) return n > 0 ? [ONEM(ZERO, C(Infinity, 0), { m: 0, mult: an })] : [];
        const q = n > 0 ? w : CX.inv(w);
        const r = Math.pow(abs(q), 1 / an), t = Math.atan2(q.im, q.re), out = [];
        for (let j = 0; j < an; j++) {
          const th = (t + TAU * j) / an, u = C(r * Math.cos(th), r * Math.sin(th));
          out.push(ONEM(u, div(u, scale(w, n)), { m: j }));
        }
        return out;
      },
    });
  }
  // w = u^s on the branch (theta, k): L = log_{theta,k} u, Im L in (lo, hi]; members L_m = beta (Log w + 2 pi i m)
  function opRootPow(s, theta, k, fwd) {
    const beta = CX.inv(s), lo = theta - TAU + TAU * k, hi = theta + TAU * k, sAbs = abs(s);
    const mode = beta.im === 0 && Math.abs(beta.re - Math.round(beta.re)) < 1e-12 && Math.round(beta.re) !== 0 ? 'int'
      : Math.abs(beta.re) <= 1e-12 * abs(beta) ? 'inf' : 'finite';
    const S = C(-TAU * beta.im, TAU * beta.re);                          // L_m = L_0 + m S
    const L0 = (w) => mul(beta, log(w));
    const member = (w, m, l0) => {
      const L = C(l0.re + m * S.re, l0.im + m * S.im);
      const a = L.im - lo, b = hi - L.im, u = exp(L);
      const g = mul(I, conj(div(beta, w))), gl = abs(g) || 1, sg_ = a < b ? 1 : -1;
      const dl = div(beta, w);
      return { u, d: mul(dl, u), lvl: Math.min(a, b) * sAbs * abs(w), lg: C(sg_ * g.re / gl, sg_ * g.im / gl), lam: L, dlam: dl, m };
    };
    const o = op('ROOTPOW', { s, beta, theta, k, lo, hi, mode }, fwd || ((u) => CX.pow(u, s, theta, k)), {
      undef: mode === 'inf' || s.im !== 0 ? [ZERO, null] : [], branch: [ZERO, null],
      poles: s.re < 0 ? [ZERO] : [], infPre: s.re > 0,
      infAt: (w) => s.re < 0 && isZero(w),
    });
    if (mode === 'int') {
      o.pre = (w) => {
        if (w.re === 0 && w.im === 0) return [];
        const l0 = L0(w);
        return [member(w, Math.round(((lo + hi) / 2 - l0.im) / (TAU * beta.re)), l0)];
      };
    } else {
      o.fam = { type: 'log', beta, S, lo, hi, inf: mode === 'inf', radial: mode === 'inf' || Math.abs(beta.re) <= Math.abs(beta.im) / 8,
        count: mode === 'inf' ? Infinity : Math.ceil(1 / Math.abs(beta.re)) + 3, L0, member };
      o.pre = () => [];
    }
    return o;
  }
  // additive families: bases(w) (member 0 of each base, null when undefined), member u = base + m p
  function famAdd(p, nb, bases, dudw) {
    return { type: 'add', p, nb, bases, member: (w, b, m, base) => { const u = add(base, scale(p, m)); return ONEM(u, dudw(u, w), { m }); } };
  }
  function opExp(Lc) {
    if (!Lc) {
      return op('EXP', {}, CX.exp, {
        undef: [null], fam: famAdd(C(0, TAU), 1, (w) => (isZero(w) ? [] : [log(w)]), (u, w) => CX.inv(w)), pre: () => [],
      });
    }
    return op('EXPC', { L0: Lc }, (u) => CX.exp(mul(u, Lc)), {
      undef: [null], fam: famAdd(div(C(0, TAU), Lc), 1, (w) => (isZero(w) ? [] : [div(log(w), Lc)]), (u, w) => CX.inv(mul(Lc, w))), pre: () => [],
    });
  }
  function opLog(theta, k, fwd) {
    const lo = theta - TAU + TAU * k, hi = theta + TAU * k;
    return op('LOG', { theta, k, lo, hi }, fwd || ((u) => CX.log(u, theta, k)), {
      branch: [ZERO, null], poles: [ZERO],
      pre: (w) => {
        const u = exp(w), a = w.im - lo, b = hi - w.im;
        return [{ u, d: u, lvl: Math.min(a, b), lg: a < b ? C(0, 1) : C(0, -1), lam: w, dlam: ONE }];
      },
    });
  }
  // Family bases: cancellation-free principal inverse trig (review P1, finding 2). CX.asin evaluates
  // -i log(iw + sqrt(1 - w^2)); in half the plane iw and sqrt(1 - w^2) nearly cancel and the base loses about
  // 2 log10|w| digits (float64: misses the 3.10 tolerance from |w| ~ 1e4; float32: wrong from |w| ~ 100). Here
  // t1 = iw + s and t2 = s - iw (s = sqrt(1 - w^2)) satisfy t1 t2 = 1, so log t1 = -log t2, and the factor of larger
  // modulus is the sum without cancellation. atan: (i/2)(log(1 - iw) - log(1 + iw)) only for |w| <= 1, else
  // sign(Re w) pi/2 - atan(1/w). The values are CX's principal values away from the cuts (any solution would do: the
  // family enumerates base + m p for every base). The GLSL bases (INV_LIB, SPEC 4.1) must use these same forms.
  // CX.acosh (log(w + sqrt(w - 1) sqrt(w + 1))) is already cancellation-free and is kept.
  function asinS(w) {
    const s = CX.sqrt(sub(ONE, mul(w, w))), iw = C(-w.im, w.re);
    const t1 = add(iw, s), t2 = sub(s, iw);
    const l = abs(t1) >= abs(t2) ? log(t1) : neg(log(t2));
    return C(l.im, -l.re);
  }
  const acosS = (w) => sub(C(PI / 2, 0), asinS(w));
  const asinhS = (w) => { const s = asinS(C(-w.im, w.re)); return C(s.im, -s.re); };        // -i asin(i w)
  function atanS(w) {
    const small = (v) => { const iv = C(-v.im, v.re), d = sub(log(sub(ONE, iv)), log(add(ONE, iv))); return C(-d.im / 2, d.re / 2); };
    if (!(abs(w) > 1)) return small(w);
    const t = small(CX.inv(w));
    return C((w.re < 0 ? -PI / 2 : PI / 2) - t.re, -t.im);
  }
  const atanhS = (w) => { const t = atanS(C(-w.im, w.re)); return C(t.im, -t.re); };        // -i atan(i w)
  const periodic = (kind, fwd, p, nb, bases, dudw, o) => op(kind, {}, fwd, Object.assign({ undef: [null], fam: famAdd(p, nb, bases, dudw), pre: () => [] }, o));
  const opSin = () => periodic('SIN', CX.sin, C(TAU, 0), 2, (w) => { const a = asinS(w); return [a, sub(C(PI, 0), a)]; }, (u) => CX.inv(CX.cos(u)));
  const opCos = () => periodic('COS', CX.cos, C(TAU, 0), 2, (w) => { const a = acosS(w); return [a, neg(a)]; }, (u) => neg(CX.inv(CX.sin(u))));
  const opTan = () => periodic('TAN', CX.tan, C(PI, 0), 1, (w) => (w.re === 0 && Math.abs(w.im) === 1 ? [] : [atanS(w)]),
    (u, w) => CX.inv(add(ONE, mul(w, w))), { infPre: false, lattice: { base: C(PI / 2, 0), step: C(PI, 0) } });
  const opSinh = () => periodic('SINH', CX.sinh, C(0, TAU), 2, (w) => { const a = asinhS(w); return [a, sub(C(0, PI), a)]; }, (u) => CX.inv(CX.cosh(u)));
  const opCosh = () => periodic('COSH', CX.cosh, C(0, TAU), 2, (w) => { const a = CX.acosh(w); return [a, neg(a)]; }, (u) => CX.inv(CX.sinh(u)));
  const opTanh = () => periodic('TANH', CX.tanh, C(0, PI), 1, (w) => (w.im === 0 && Math.abs(w.re) === 1 ? [] : [atanhS(w)]),
    (u, w) => CX.inv(sub(ONE, mul(w, w))), { infPre: false, lattice: { base: C(0, PI / 2), step: C(0, PI) } });
  // Saturation points (P2 review): u = tanh w tends to +-1 (tan w to +-i) far out in its strip, and float32 rounds u to the
  // point itself long before the strip ends (tanh 8 = 1 - 2.3e-7): a shape through +-1 then lost its image there. The
  // members of ATANH / ATAN carry the offset from their anchor, computed without cancellation, with its logarithm (no
  // underflow for any w) and d(log offset)/dw:
  //   tanh w = s - 2 s e / (1 + e), s = sgn Re w, e = exp(-2 s w) (|e| <= 1); log offset = ln 2 + i pi [s > 0] - 2 s w -
  //   log(1 + e); its derivative -2 s / (1 + e). tan w = -i tanh(i w). anc.a: anchor 0 (+1, or -i for tan) or 1.
  function tanhAnc(w) {
    const sg = w.re >= 0 ? 1 : -1;
    const e = exp(C(-2 * sg * w.re, -2 * sg * w.im)), ope = add(ONE, e);
    const d = scale(div(e, ope), -2 * sg), lo = log(ope);
    return { a: sg > 0 ? 0 : 1, pu: C(sg, 0), d, l: C(LN2 - 2 * sg * w.re - lo.re, (sg > 0 ? PI : 0) - 2 * sg * w.im - lo.im), dl: scale(CX.inv(ope), -2 * sg) };
  }
  function tanAnc(w) {
    const t = tanhAnc(C(-w.im, w.re));
    return { a: t.a, pu: C(0, -t.pu.re), d: C(t.d.im, -t.d.re), l: C(t.l.re, t.l.im - PI / 2), dl: C(-t.dl.im, t.dl.re) };
  }
  // principal inverse trig functions as forward steps: u = g(w), range level on w
  const opRange = (kind, fwd, g, dg, lvl, o) => op(kind, {}, fwd, Object.assign({
    pre: (w) => { const r = lvl(w); return [{ u: g(w), d: dg(w), lvl: r[0], lg: r[1], lam: null, dlam: null, anc: o && o.ancOf ? o.ancOf(w) : null }]; },
  }, o));
  const P1 = [C(1, 0), C(-1, 0)], PI_ = [C(0, 1), C(0, -1)];
  const opAsin = () => opRange('ASIN', CX.asin, CX.sin, CX.cos, (w) => [PI / 2 - Math.abs(w.re), C(-sgn(w.re), 0)], { branch: P1.concat([null]) });
  const opAcos = () => opRange('ACOS', CX.acos, CX.cos, (w) => neg(CX.sin(w)), (w) => (w.re < PI - w.re ? [w.re, C(1, 0)] : [PI - w.re, C(-1, 0)]), { branch: P1.concat([null]) });
  const opAtan = () => opRange('ATAN', CX.atan, CX.tan, (w) => { const c = CX.cos(w); return CX.inv(mul(c, c)); }, (w) => [PI / 2 - Math.abs(w.re), C(-sgn(w.re), 0)], { branch: PI_.slice(), poles: PI_.slice(), infPre: false, ancOf: tanAnc, anchors: [C(0, -1), C(0, 1)] });
  const opAsinh = () => opRange('ASINH', CX.asinh, CX.sinh, CX.cosh, (w) => [PI / 2 - Math.abs(w.im), C(0, -sgn(w.im))], { branch: PI_.concat([null]) });
  const opAcosh = () => opRange('ACOSH', CX.acosh, CX.cosh, CX.sinh, (w) => { const a = w.re, b = PI - Math.abs(w.im); return a < b ? [a, C(1, 0)] : [b, C(0, -sgn(w.im))]; }, { branch: P1.concat([null]) });
  const opAtanh = () => opRange('ATANH', CX.atanh, CX.tanh, (w) => { const c = CX.cosh(w); return CX.inv(mul(c, c)); }, (w) => [PI / 2 - Math.abs(w.im), C(0, -sgn(w.im))], { branch: P1.slice(), poles: P1.slice(), infPre: false, ancOf: tanhAnc, anchors: [C(1, 0), C(-1, 0)] });
  function opJouk(fwd) {
    return op('JOUK', {}, fwd || ((u) => scale(add(u, CX.inv(u)), 0.5)), {
      fam: { type: 'fin', count: 2 }, poles: [ZERO],
      pre: (w) => {
        const s = mul(CX.sqrt(sub(w, ONE)), CX.sqrt(add(w, ONE))), e = add(w, s);
        return [e, CX.inv(e)].map((u, m) => { const u2 = mul(u, u); return ONEM(u, div(scale(u2, 2), sub(u2, ONE)), { m }); });
      },
    });
  }
  function opIjouk(sg, fwd) {
    return op('IJOUK', { sg }, fwd, {
      branch: P1.slice(), infPre: sg > 0,
      pre: (w) => {
        const r = abs(w), u = scale(add(w, CX.inv(w)), 0.5);
        if (!isFin(u)) return [];
        return [{ u, d: scale(sub(ONE, CX.inv(mul(w, w))), 0.5), lvl: sg > 0 ? r - 1 : 1 - r, lg: scale(w, (sg > 0 ? 1 : -1) / (r || 1)), lam: null, dlam: null }];
      },
    });
  }
  const opConj = () => op('CONJ', {}, CX.conj, { pre: (w) => [{ u: conj(w), anti: true, lvl: Infinity, lg: null, lam: null, dlam: null }] });
  // a u^2 + b u + c = w (stable quadratic)
  function opQuad(a, b, c, fwd) {
    return op('QUAD', { a, b, c }, fwd || ((u) => add(mul(add(mul(a, u), b), u), c)), {
      fam: { type: 'fin', count: 2 },
      pre: (w) => {
        const cc = sub(c, w), disc = CX.sqrt(sub(mul(b, b), scale(mul(a, cc), 4)));
        const sd = (b.re * disc.re + b.im * disc.im) < 0 ? neg(disc) : disc;        // Re(conj(b) s) >= 0
        const q = scale(add(b, sd), -0.5);
        const roots = (q.re === 0 && q.im === 0) ? [ZERO, ZERO] : [div(q, a), div(cc, q)];
        return roots.map((u, m) => ONEM(u, CX.inv(add(scale(mul(a, u), 2), b)), { m }));
      },
    });
  }
  // p(u)/q(u) of degree 2 (coprime): p(u) - w q(u) = 0
  function opRat2(p, q, fwd) {
    const pad = (co) => [...Array(Math.max(0, 3 - co.length)).fill(ZERO), ...co];
    const P = pad(p), Q = pad(q);
    const dp = (u) => add(scale(mul(P[0], u), 2), P[1]), dq = (u) => add(scale(mul(Q[0], u), 2), Q[1]);
    // the value at infinity (p.length <= q.length): p2/q2 at equal degrees, 0 when the numerator is lower
    const wInf = p.length > q.length ? null : p.length === q.length ? div(p[0], q[0]) : ZERO;
    return op('RAT2', { P, Q }, fwd || ((u) => div(CX.polyEval(p, u), CX.polyEval(q, u))), {
      fam: { type: 'fin', count: 2 }, poles: q.length > 1 ? CX.polyRoots(q) : [], infPre: p.length > q.length,
      infAt: (w) => !!wInf && w.re === wInf.re && w.im === wInf.im,
      pre: (w) => {
        const A = sub(P[0], mul(w, Q[0])), B = sub(P[1], mul(w, Q[1])), Cc = sub(P[2], mul(w, Q[2]));
        let roots;
        if (abs(A) <= 1e-14 * (abs(B) + abs(Cc))) roots = abs(B) > 0 ? [neg(div(Cc, B))] : [];
        else {
          const disc = CX.sqrt(sub(mul(B, B), scale(mul(A, Cc), 4)));
          const sd = (B.re * disc.re + B.im * disc.im) < 0 ? neg(disc) : disc;
          const qq = scale(add(B, sd), -0.5);
          roots = (qq.re === 0 && qq.im === 0) ? [ZERO] : [div(qq, A), div(Cc, qq)];
        }
        // (B = C = 0: the double root 0, listed once with its multiplicity; the one root of a w at infinity is simple)
        const dbl = roots.length === 1 && abs(A) > 1e-14 * (abs(B) + abs(Cc));
        return roots.map((u, m) => {
          const pu = CX.polyEval(p, u), qu = CX.polyEval(q, u);
          const fp = div(sub(mul(dp(u), qu), mul(pu, dq(u))), mul(qu, qu));
          return ONEM(u, CX.inv(fp), dbl ? { m, mult: 2 } : { m });
        });
      },
    });
  }

  // =====================================================================================================
  // 2. Catalog decomposition (SPEC 3.3)
  // =====================================================================================================
  const INEL = (reason) => ({ ok: false, reason });
  const OK = (ops) => ({ ok: true, ops });
  // Inverse.stepOps(b) -> {ok: true, ops} | {ok: false, reason}; b: a Funcs.build() result
  function stepOps(b) {
    if (!b || b.error || !b.def) return INEL(b && b.error ? b.error : 'no step');
    const id = b.def.id, v = b.vals, P = b.props || {};
    if (b.op === 'deriv' || id === 'deriv') return INEL('d/dz is not a map');
    if (P.constant) return INEL('constant map');
    switch (id) {
      case 'mul': return OK([opAff(v.c, ZERO)]);
      case 'add': return OK([opAff(ONE, v.c)]);
      case 'affine': return OK([opAff(v.a, v.b)]);
      case 'recip': return OK([opMob([ZERO, ONE, ONE, ZERO])]);
      case 'mobius': if (!P.mobius) return INEL('Möbius map too close to degenerate'); return OK([opMob([v.a, v.b, v.c, v.d])]);
      case 'blaschke': {
        if (!P.mobius) return INEL('degenerate disk automorphism');
        const e = C(Math.cos(v.phi * DEG), Math.sin(v.phi * DEG));
        return OK([opMob([e, neg(mul(e, v.a)), neg(conj(v.a)), ONE])]);
      }
      case 'pown':
        if (v.n === 0) return INEL('constant map');
        if (Math.abs(v.n) > IPOW_MAX) return INEL(`integer power |n| > ${IPOW_MAX}`);
        return OK([opIpow(v.n, b.f)]);
      case 'root': { const n = Math.max(2, v.n); return OK([opRootPow(C(1 / n, 0), v.cut * DEG, ((v.k % n) + n) % n, b.f)]); }
      case 'powa': if (isZero(v.alpha)) return INEL('constant map'); return OK([opRootPow(v.alpha, v.cut * DEG, v.k, b.f)]);
      case 'exp': return OK([opExp(null)]);
      case 'log': return OK([opLog(v.cut * DEG, v.k, b.f)]);
      case 'sin': return OK([opSin()]);
      case 'cos': return OK([opCos()]);
      case 'tan': return OK([opTan()]);
      case 'sinh': return OK([opSinh()]);
      case 'cosh': return OK([opCosh()]);
      case 'tanh': return OK([opTanh()]);
      case 'arcsin': return OK([opAsin()]);
      case 'arccos': return OK([opAcos()]);
      case 'arctan': return OK([opAtan()]);
      case 'arsinh': return OK([opAsinh()]);
      case 'arcosh': return OK([opAcosh()]);
      case 'artanh': return OK([opAtanh()]);
      case 'joukowski': return OK([opJouk(b.f)]);
      case 'ijouk': return OK([opIjouk(v.branch === 'interior' ? -1 : 1, b.f)]);
      case 'conj': return OK([opConj()]);
      case 'poly': return polyOps(CX.polyTrim(v.co), b.f);
      case 'rational': {
        const p = CX.polyTrim(v.p), q = CX.polyTrim(v.q);
        if (q.length === 1) return polyOps(p.map((c) => div(c, q[0])), b.f);
        if (P.mobius) {
          const two = (co) => (co.length === 1 ? [ZERO, co[0]] : co);
          const [a, bb] = two(p), [c, d] = two(q);
          return OK([opMob([a, bb, c, d])]);
        }
        if (P.degExact && P.deg === 2) return OK([opRat2(p, q, b.f)]);
        return INEL(`rational map of degree ${P.deg}${P.degExact ? '' : ' (not known exactly)'}`);
      }
      case 'zp': {
        // a zeros-and-poles step: coprime by construction (coincident pairs cancelled in Funcs), exact degree
        const { P: p, Q: q } = b.zp;
        if (q.length === 1) {
          const r = polyOps(p.map((c) => div(c, q[0])), b.f);
          return r.ok ? r : INEL(`${r.reason} (the exact renderer inverts degree ≤ 2)`);
        }
        if (P.mobius) {
          const two = (co) => (co.length === 1 ? [ZERO, co[0]] : co);
          const [a, bb] = two(p), [c, d] = two(q), m = [a, bb, c, d];
          if (CX.mobDetZero(m) || CX.mobRel(m) < CX.MOB_EPS) return INEL('Möbius map too close to degenerate');
          return OK([opMob(m)]);
        }
        if (P.degExact && P.deg === 2) return OK([opRat2(p, q, b.f)]);
        return INEL(`rational map of degree ${P.deg} (the exact renderer inverts degree ≤ 2)`);
      }
      case 'custom': {
        // a formula recognized as catalog steps (Funcs, src/recognize.js): their ops, when every one has them
        if (b.rec) {
          const ops = [];
          for (const sb of b.rec.built) { const r = stepOps(sb); if (!r.ok) { ops.length = 0; break; } ops.push(...r.ops); }
          if (ops.length) return OK(ops);
        }
        let ast = b.ast;
        if (!ast) { try { ast = Expr.parse(v.expr); } catch (e) { return INEL(e.message); } }
        return customOps(ast, v.cut * DEG);
      }
    }
    return INEL('no inverse enumerator for ' + id);
  }
  function polyOps(c, f) {
    const d = c.length - 1;
    if (d <= 0) return INEL('constant map');
    if (d === 1) return OK([opAff(c[0], c[1])]);
    if (d === 2) return OK([opQuad(c[0], c[1], c[2], f)]);
    if (c.slice(1, d).every(isZero)) {
      if (d > IPOW_MAX) return INEL(`integer power |n| > ${IPOW_MAX}`);
      return OK([opIpow(d), opAff(c[0], c[d])]);
    }
    return INEL(`polynomial of degree ${d}`);
  }
  // ---- rational custom formulas (SPEC 3.3, rev 3) ----
  // A subtree in which z occurs more than once (both operands of a + - × ÷ depend on z) is brought to a normal form
  // P/Q with P, Q coprime: polynomials with term bounds (the cancellation bookkeeping of Expr.polyExpand) and, in
  // parallel, EXACT coefficients (BigInt Gaussian rationals: a literal is its decimal, 0.1 = 1/10; any other constant
  // is its double's shortest decimal). Common powers of z and the exact gcd (primitive pseudo-remainder Euclid over
  // Z[i]) are divided out exactly, whatever the multiplicities; then a float stage removes only a simple, isolated
  // root that the two share to rounding (z^2 - 1/9 over z - 1/3... written with different constants) and refuses
  // ('nearly share a root') anything between RAT_COMMON and RAT_APART or inside a root cluster. The preimages of w are
  // then the roots of P(u) - w Q(u) = 0, and no root has Q(u) = 0. The removed common roots r (removable singularities,
  // where the formula itself is 0/0) ARE roots for w = lim R(z) at r: they are kept as the op's holes and left out of
  // pullFinite (point and singular-point pull-backs), matching the natural domain.
  // Degree 1: MOB; degree 2: RAT2 (QUAD when Q is constant), whose stable quadratic also covers the degree drop at the
  // value at infinity; P/Q = R(z^g) with g > 1: IPOW(g) then R. Other degrees go forward with the reason.
  const RAT_EXP_MAX = 64;          // degree cap of the expansion (intermediate products)
  const RAT_DEG_MAX = 32;          // degree cap of the normal form (IPOW 16 under a degree-2 R)
  const RAT_SNAP = 1e-12;          // a coefficient below RAT_SNAP x the sum of its terms' sizes is rounding noise: 0
  const RAT_COMMON = 1e-11;        // |T(r)| <= RAT_COMMON sum_k |t_k| |r|^k: r is a common root
  const RAT_APART = 1e-6;          // above this relative size P and Q are certainly apart at r; in between: ambiguous
  const isGI = (v) => Number.isInteger(v.re) && Number.isInteger(v.im) && Math.abs(v.re) < 2 ** 53 && Math.abs(v.im) < 2 ** 53;
  class RatErr extends Error { constructor(m, nr) { super(m); this.nr = !!nr; } }   // nr: a part not rational in z
  // polynomials with term bounds: {c: C[] (lowest degree first), m: number[] (sum of the sizes of the terms summed into
  // each coefficient), ex: every coefficient exact (Gaussian integers, products below 2^53)}
  // exact parts x: {n: [re, im] BigInt pairs (lowest degree first), d: BigInt > 0} (value n / d), or null when too
  // large (RAT_XBITS); lit: every constant is a literal (no e, pi or function value)
  const RAT_XBITS = 6000;
  const babs = (a) => (a < 0n ? -a : a);
  const bgcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a; };
  const bbits = (a) => (a === 0n ? 0 : babs(a).toString(16).length * 4);
  function decRat(s) {                                                  // a decimal string -> [n, d]
    const m = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(String(s).trim());
    if (!m || !(m[2] || m[3])) return null;
    const fr = m[3] || '', e = (m[4] ? parseInt(m[4], 10) : 0) - fr.length;
    if (!(Math.abs(e) <= 400)) return null;
    let n = BigInt((m[2] || '0') + fr);
    if (m[1] === '-') n = -n;
    return e >= 0 ? [n * 10n ** BigInt(e), 1n] : [n, 10n ** BigInt(-e)];
  }
  function xK(v, lit) {
    if (!isFin(v)) return null;
    const re = (lit && decRat(lit)) || decRat(String(v.re)), im = decRat(String(v.im));
    if (!re || !im) return null;
    const d = (re[1] * im[1]) / bgcd(re[1], im[1]);
    return { n: [[re[0] * (d / re[1]), im[0] * (d / im[1])]], d };
  }
  /** @param {ExactPart | null} X @returns {ExactPart | null} */
  function xRed(X) {
    let g = X.d;
    for (const [a, b] of X.n) { if (g === 1n) break; g = bgcd(bgcd(g, a), b); }
    if (g > 1n) { X.n = X.n.map(([a, b]) => [a / g, b / g]); X.d /= g; }
    if (bbits(X.d) > RAT_XBITS || X.n.some(([a, b]) => bbits(a) > RAT_XBITS || bbits(b) > RAT_XBITS)) return null;
    return X;
  }
  /** @param {ExactPart | null} A @param {ExactPart | null} B @returns {ExactPart | null} */
  function xLin(A, B, sg) {
    if (!A || !B) return null;
    const n = [], len = Math.max(A.n.length, B.n.length), s = BigInt(sg);
    for (let i = 0; i < len; i++) {
      const a = A.n[i] || [0n, 0n], b = B.n[i] || [0n, 0n];
      n.push([a[0] * B.d + s * b[0] * A.d, a[1] * B.d + s * b[1] * A.d]);
    }
    return xRed({ n, d: A.d * B.d });
  }
  /** @param {ExactPart | null} A @param {ExactPart | null} B @returns {ExactPart | null} */
  function xMul(A, B) {
    if (!A || !B) return null;
    /** @type {GInt[]} */
    const n = Array.from({ length: A.n.length + B.n.length - 1 }, () => [0n, 0n]);
    for (let i = 0; i < A.n.length; i++) {
      const [a, b] = A.n[i];
      if (!a && !b) continue;
      for (let j = 0; j < B.n.length; j++) { const [c, d] = B.n[j], t = n[i + j]; t[0] += a * c - b * d; t[1] += a * d + b * c; }
    }
    return xRed({ n, d: A.d * B.d });
  }
  // Gaussian integers [re, im]: products, exact quotients, gcd (Euclid with the rounded quotient)
  /** @param {GInt} x @param {GInt} y @returns {GInt} */
  const gMul = (x, y) => [x[0] * y[0] - x[1] * y[1], x[0] * y[1] + x[1] * y[0]];
  /** @param {GInt} x @param {GInt} y @returns {GInt} */
  const gSub = (x, y) => [x[0] - y[0], x[1] - y[1]];
  /** @param {GInt} x */
  const gZ = (x) => x[0] === 0n && x[1] === 0n;
  /** @param {bigint} a @param {bigint} b */
  const fdiv = (a, b) => { const q = a / b; return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q; };
  /** @param {bigint} a @param {bigint} b */
  const rdiv = (a, b) => fdiv(2n * a + b, 2n * b);                   // nearest integer to a / b (b > 0)
  /** @param {GInt} x @param {GInt} y @returns {GInt} */
  function gDivR(x, y) {                                                // x / y rounded (Gaussian), y != 0
    const N = y[0] * y[0] + y[1] * y[1], t0 = x[0] * y[0] + x[1] * y[1], t1 = x[1] * y[0] - x[0] * y[1];
    return [rdiv(t0, N), rdiv(t1, N)];
  }
  /** @param {GInt} x @param {GInt} y @returns {GInt | null} */
  function gDivX(x, y) {                                                // x / y exactly, or null
    const N = y[0] * y[0] + y[1] * y[1], t0 = x[0] * y[0] + x[1] * y[1], t1 = x[1] * y[0] - x[0] * y[1];
    return t0 % N === 0n && t1 % N === 0n ? [t0 / N, t1 / N] : null;
  }
  /** @param {GInt} x @param {GInt} y @returns {GInt} */
  function gGcd(x, y) { while (!gZ(y)) [x, y] = [y, gSub(x, gMul(gDivR(x, y), y))]; return x; }
  /** @param {GInt[]} A */
  const xTrim = (A) => { const a = A.slice(); while (a.length && gZ(a[a.length - 1])) a.pop(); return a; };
  /** @param {GInt[]} A */
  function xPrim(A) {                                                   // A / its content (Z[i] gcd of the coefficients)
    /** @type {GInt} */
    let g = [0n, 0n];
    for (const c of A) { g = gGcd(c, g); if (babs(g[0]) + babs(g[1]) === 1n) return A; }
    return gZ(g) ? A : A.map((c) => gDivX(c, g));
  }
  function xPrem(A, B) {                                                // lc(B)^k A mod B (low-first, trimmed)
    let R = A.slice();
    const db = B.length - 1, lb = B[db];
    while (R.length && R.length - 1 >= db) {
      const dr = R.length - 1, lr = R[dr], s = dr - db;
      R = R.map((c) => gMul(lb, c));
      for (let i = 0; i <= db; i++) R[i + s] = gSub(R[i + s], gMul(lr, B[i]));
      R = xTrim(R);
    }
    return R;
  }
  const xBig = (A) => A.some(([a, b]) => bbits(a) > 4 * RAT_XBITS || bbits(b) > 4 * RAT_XBITS);
  function xGcd(A, B) {                                                 // primitive gcd (low-first), or null (too large)
    A = xPrim(xTrim(A)); B = xPrim(xTrim(B));
    if (A.length < B.length) [A, B] = [B, A];
    for (let guard = 0; B.length && guard < 4 * RAT_DEG_MAX; guard++) {
      const R = xPrem(A, B);
      A = B; B = R.length ? xPrim(R) : [];
      if (xBig(A) || xBig(B)) return null;
    }
    return B.length ? null : A;
  }
  function xDiv(A, G) {                                                 // A / G exactly (G divides A), or null
    const dg = G.length - 1, dq = A.length - 1 - dg, R = A.slice(), q = new Array(Math.max(0, dq + 1));
    if (dq < 0) return null;
    for (let k = dq; k >= 0; k--) {
      const c = gDivX(R[k + dg], G[dg]);
      if (!c) return null;
      q[k] = c;
      for (let i = 0; i <= dg; i++) R[k + i] = gSub(R[k + i], gMul(c, G[i]));
    }
    return R.every(gZ) ? q : null;
  }
  // low-first exact integer polynomials -> high-first doubles, both scaled by one power of 2 (their ratio exact to
  // rounding); null when they cannot share a finite scale
  function xToF(A, B) {
    const bits = Math.max(...A.concat(B).map(([a, b]) => Math.max(bbits(a), bbits(b))));
    const sh = Math.max(0, bits - 900), bs = BigInt(sh);
    const f = (X) => X.map(([a, b]) => C(Number(a >> bs), Number(b >> bs))).reverse();
    const P = f(A), Q = f(B);
    return P.concat(Q).every(isFin) ? [P, Q] : null;
  }
  const pK = (v, ex, lit) => ({ c: [v], m: [abs(v)], ex: !!ex && isGI(v), x: xK(v, lit), lit: !!ex });
  const pFin = (A) => {
    if (!A.m.every(Number.isFinite) || !A.c.every(isFin)) throw new RatErr('a coefficient overflows');
    if (A.ex && !A.m.every((x) => x < 2 ** 53)) A.ex = false;
    return A;
  };
  function pLin(A, B, sg) {
    const n = Math.max(A.c.length, B.c.length), c = [], m = [];
    for (let i = 0; i < n; i++) {
      const a = A.c[i] || ZERO, b = B.c[i] || ZERO;
      c.push(C(a.re + sg * b.re, a.im + sg * b.im));
      m.push((A.m[i] || 0) + (B.m[i] || 0));
    }
    return pFin({ c, m, ex: A.ex && B.ex, x: xLin(A.x, B.x, sg), lit: A.lit && B.lit });
  }
  function pMul(A, B) {
    const n = A.c.length + B.c.length - 1;
    if (n - 1 > RAT_EXP_MAX) throw new RatErr(`degree above ${RAT_EXP_MAX}`);
    const c = Array.from({ length: n }, () => C(0, 0)), m = new Array(n).fill(0);
    for (let i = 0; i < A.c.length; i++) {
      if (A.m[i] === 0) continue;
      for (let j = 0; j < B.c.length; j++) {
        if (B.m[j] === 0) continue;
        const a = A.c[i], b = B.c[j], t = c[i + j];
        t.re += a.re * b.re - a.im * b.im; t.im += a.re * b.im + a.im * b.re;
        m[i + j] += A.m[i] * B.m[j];
      }
    }
    return pFin({ c, m, ex: A.ex && B.ex, x: xMul(A.x, B.x), lit: A.lit && B.lit });
  }
  const pNeg = (A) => ({ c: A.c.map(neg), m: A.m.slice(), ex: A.ex, x: A.x && { n: A.x.n.map(([a, b]) => [-a, -b]), d: A.x.d }, lit: A.lit });
  const pSame = (A, B) => A.c.length === B.c.length && A.c.every((x, i) => x.re === B.c[i].re && x.im === B.c[i].im && A.m[i] === B.m[i])
    && (!A.x === !B.x) && (!A.x || (A.x.d === B.x.d && A.x.n.every((p, i) => p[0] === B.x.n[i][0] && p[1] === B.x.n[i][1])));
  const ONE_K = () => pK(ONE, true);
  // a constant subtree that the polynomial arithmetic below evaluates exactly (literals, i, + - × ÷, integer powers)
  const constRat = (n) => (n.t === 'num' ? n.name !== 'e' && n.name !== 'pi'
    : ['neg', 'add', 'sub', 'mul', 'div'].includes(n.t) ? ['a', 'b'].every((k) => !n[k] || constRat(n[k]))
    : n.t === 'pow' ? constRat(n.a) && (() => { const e = Expr.compile(n.b)(ZERO); return e.im === 0 && Number.isInteger(e.re) && Math.abs(e.re) <= RAT_EXP_MAX; })() : false);
  // only constants written with Gaussian-integer literals, + - × and non-negative integer powers are exact
  const constExact = (n) => (n.t === 'num' ? n.name !== 'e' && n.name !== 'pi'
    : ['neg', 'add', 'sub', 'mul'].includes(n.t) ? ['a', 'b'].every((k) => !n[k] || constExact(n[k])) : false);
  // the rational form {P, Q} of a subtree; throws RatErr (with the reason) when it is not rational in z
  function ratGo(n) {
    if (!Expr.depends(n)) {
      const v = Expr.compile(n)(ZERO);
      if (!isFin(v)) throw new RatErr('a constant is not finite');
      if (n.t === 'num') return { P: pK(v, constExact(n), n.lit), Q: ONE_K() };
      if (!constRat(n)) { const K = pK(v, false); K.lit = false; return { P: K, Q: ONE_K() }; }
      if (n.t === 'div') {                                          // a constant quotient: exact, as P/Q
        const A = ratGo(n.a), B = ratGo(n.b);
        if (B.P.c.every(isZero)) throw new RatErr('a constant is not finite');
        return { P: pMul(A.P, B.Q), Q: pMul(A.Q, B.P) };
      }
    }
    switch (n.t) {
      case 'var': if (n.n !== 'z') break; return { P: { c: [ZERO, ONE], m: [0, 1], ex: true, x: { n: [[0n, 0n], [1n, 0n]], d: 1n }, lit: true }, Q: ONE_K() };
      case 'neg': { const A = ratGo(n.a); return { P: pNeg(A.P), Q: A.Q }; }
      case 'add': case 'sub': {
        const A = ratGo(n.a), B = ratGo(n.b), sg = n.t === 'add' ? 1 : -1;
        if (pSame(A.Q, B.Q)) return { P: pLin(A.P, B.P, sg), Q: A.Q };
        return { P: pLin(pMul(A.P, B.Q), pMul(B.P, A.Q), sg), Q: pMul(A.Q, B.Q) };
      }
      case 'mul': { const A = ratGo(n.a), B = ratGo(n.b); return { P: pMul(A.P, B.P), Q: pMul(A.Q, B.Q) }; }
      case 'div': {
        const A = ratGo(n.a), B = ratGo(n.b);
        if (B.P.c.every(isZero)) throw new RatErr('division by 0');
        return { P: pMul(A.P, B.Q), Q: pMul(A.Q, B.P) };
      }
      case 'pow': {
        if (Expr.depends(n.b)) throw new RatErr(Expr.depends(n.a) ? 'variable base and exponent' : 'a power with z in the exponent', true);
        const e = Expr.compile(n.b)(ZERO);
        if (!(e.im === 0 && Number.isInteger(e.re))) throw new RatErr('a non-integer power', true);
        if (Math.abs(e.re) > RAT_EXP_MAX) throw new RatErr(`degree above ${RAT_EXP_MAX}`);
        const A = ratGo(n.a);
        let [P, Q] = e.re < 0 ? [A.Q, A.P] : [A.P, A.Q];
        if (e.re < 0 && Q.c.every(isZero)) throw new RatErr('division by 0');
        let rp = ONE_K(), rq = ONE_K();
        for (let k = Math.abs(e.re); k > 0; k >>= 1) {
          if (k & 1) { rp = pMul(rp, P); rq = pMul(rq, Q); }
          if (k > 1) { P = pMul(P, P); Q = pMul(Q, Q); }
        }
        return { P: rp, Q: rq };
      }
      case 'root': throw new RatErr('a root', true);
      case 'call': throw new RatErr(n.f === 'conj' ? 'a conjugate' : n.f === 'abs' ? '|z|' : `\\${n.f}`, true);
    }
    throw new RatErr(`a ${n.t} node`, true);
  }
  // the noise mask of a polynomial: coefficient i is rounding noise (below RAT_SNAP x its terms' sizes) unless every
  // constant is a literal (then the exact value decides)
  const noise = (A, lit) => A.c.map((x, i) => !lit && !A.ex && !(abs(x) > RAT_SNAP * A.m[i]));
  // high-first coefficient arrays with rounding noise set to 0, trimmed at the top
  function ratCoeffs(A, lit) {
    const nz = noise(A, lit), c = A.c.map((x, i) => (nz[i] ? ZERO : x));
    while (c.length > 1 && isZero(c[c.length - 1])) c.pop();
    return c.reverse();
  }
  const polyBound = (co, r) => { const ar = abs(r); let s = 0; for (const x of co) s = s * ar + abs(x); return s; };
  function polish(co, r) {                                              // Newton on co, while it improves
    const d = co.slice(0, -1).map((x, i) => scale(x, co.length - 1 - i));
    let best = abs(CX.polyEval(co, r));
    for (let it = 0; it < 8 && best > 0; it++) {
      const s = div(CX.polyEval(co, r), CX.polyEval(d, r));
      if (!isFin(s)) break;
      const r2 = sub(r, s), v = abs(CX.polyEval(co, r2));
      if (!(v < best)) break;
      r = r2; best = v;
    }
    return r;
  }
  // co / (z - r) and the remainder's size relative to co's terms at r
  function deflate(co, r) {
    const out = [co[0]];
    for (let i = 1; i < co.length; i++) out.push(add(co[i], mul(r, out[i - 1])));
    const rem = out.pop();
    return { q: out, rel: abs(rem) / (polyBound(co, r) || 1) };
  }
  // the roots of co (high-first) with each cluster (roots within 1e-3 (1 + |r|) of each other: a multiple root that
  // polyRoots splits by about EPS^(1/m)) replaced by its mean, m times: [{r, m}]
  function rootClusters(co) {
    const rs = CX.polyRoots(co).filter(isFin), used = new Uint8Array(rs.length), out = [];
    for (let i = 0; i < rs.length; i++) {
      if (used[i]) continue;
      const grp = [rs[i]];
      used[i] = 1;
      for (let grow = true; grow;) {
        grow = false;
        for (let j = 0; j < rs.length; j++) {
          if (used[j]) continue;
          if (grp.some((q) => abs(sub(q, rs[j])) <= 1e-3 * (1 + abs(q)))) { grp.push(rs[j]); used[j] = 1; grow = true; }
        }
      }
      let m = grp.reduce((acc, q) => add(acc, q), ZERO);
      m = scale(m, 1 / grp.length);
      // a root of multiplicity k is a simple root of the (k-1)-th derivative: polish the mean there
      let dk = co;
      for (let k = 1; k < grp.length && dk.length > 1; k++) dk = dk.slice(0, -1).map((x, i) => scale(x, dk.length - 1 - i));
      out.push({ r: dk.length > 1 ? polish(dk, m) : m, m: grp.length });
    }
    return out;
  }
  // Inverse.rationalForm(ast) -> {ok, P, Q (high-first, coprime, scaled by a power of 2), deg, exact, removed: C[]
  // (common roots divided out, with multiplicity: removable singularities)} | {ok: false, reason}
  function rationalForm(ast) {
    let R;
    try { R = ratGo(ast); } catch (e) { if (e instanceof RatErr) return Object.assign(INEL(e.message), { notRational: e.nr }); throw e; }
    const lit = R.P.lit && R.Q.lit;
    let P = ratCoeffs(R.P, lit), Q = ratCoeffs(R.Q, lit);
    if (Q.every(isZero)) return INEL('division by 0');
    if (P.every(isZero)) return INEL('constant map');
    const removed = [];
    // the exact stage: P/Q = (Pn Qd) / (Qn Pd), noise coefficients zeroed as in the floats, common powers of z and the
    // exact gcd divided out
    let XP = null, XQ = null;
    if (R.P.x && R.Q.x) {
      const nP = noise(R.P, lit), nQ = noise(R.Q, lit);
      XP = xTrim(R.P.x.n.map(([a, b], i) => (nP[i] ? [0n, 0n] : [a * R.Q.x.d, b * R.Q.x.d])));
      XQ = xTrim(R.Q.x.n.map(([a, b], i) => (nQ[i] ? [0n, 0n] : [a * R.P.x.d, b * R.P.x.d])));
      if (!XQ.length) return INEL('division by 0');
      if (!XP.length) return INEL('constant map');
      while (XP.length > 1 && XQ.length > 1 && gZ(XP[0]) && gZ(XQ[0])) { XP = XP.slice(1); XQ = XQ.slice(1); }
      if (Math.max(XP.length, XQ.length) - 1 > RAT_DEG_MAX) return INEL(`rational formula of degree above ${RAT_DEG_MAX}`);
      const G = XP.length > 1 && XQ.length > 1 ? xGcd(XP, XQ) : [[1n, 0n]];
      const P2 = G && G.length > 1 ? xDiv(XP, G) : null, Q2 = G && G.length > 1 ? xDiv(XQ, G) : null;
      if (G && G.length > 1 && P2 && Q2) {
        const gf = xToF(G, [[1n, 0n]]);
        if (gf) for (const c of rootClusters(gf[0])) for (let k = 0; k < c.m; k++) removed.push(c.r);
        XP = P2; XQ = Q2;
      }
      const f = G ? xToF(XP, XQ) : null;
      if (f) [P, Q] = f;
      else { XP = XQ = null; }
    }
    if (!XP) {
      // floats only (exact parts too large): common powers of z
      while (P.length > 1 && Q.length > 1 && isZero(P[P.length - 1]) && isZero(Q[Q.length - 1])) { P = P.slice(0, -1); Q = Q.slice(0, -1); }
      if (Math.max(P.length, Q.length) - 1 > RAT_DEG_MAX) return INEL(`rational formula of degree above ${RAT_DEG_MAX}`);
    }
    // the float stage: a simple, isolated root of the lower-degree S that T shares to rounding is divided out (with a
    // remainder check); a shared root inside a cluster, a remainder above rounding, or a relative |T(r)| between
    // RAT_COMMON and RAT_APART refuses the formula. What is left is coprime by the scale-invariant test: every root
    // (cluster mean) r of S has |T(r)| > RAT_APART sum_k |t_k| |r|^k.
    for (let guard = 0; guard <= RAT_DEG_MAX && P.length > 1 && Q.length > 1; guard++) {
      const pLow = P.length <= Q.length, S = pLow ? P : Q, T = pLow ? Q : P;
      let common = null, ambiguous = false;
      for (const { r, m } of rootClusters(S)) {
        const rel = abs(CX.polyEval(T, r)) / (polyBound(T, r) || 1);
        if (rel <= RAT_COMMON && m === 1) { common = r; break; }
        if (!(rel > RAT_APART)) ambiguous = true;
      }
      if (common) {
        const dp = deflate(P, common), dq = deflate(Q, common);
        if (!(dp.rel <= 1e-9 && dq.rel <= 1e-9)) return INEL('numerator and denominator nearly share a root');
        P = dp.q; Q = dq.q; removed.push(common);
        continue;
      }
      if (ambiguous) return INEL('numerator and denominator nearly share a root');
      break;
    }
    if (P.every(isZero) || P.length === 1 && Q.length === 1) return INEL('constant map');
    // a power of 2 that brings the largest coefficient near 1 (exact; keeps float32 in range)
    const mx = Math.max(...P.concat(Q).map(abs)), sc = Math.pow(2, -Math.round(Math.log2(mx)));
    if (sc !== 1 && Number.isFinite(sc) && sc > 0) { P = P.map((x) => scale(x, sc)); Q = Q.map((x) => scale(x, sc)); }
    if (!P.concat(Q).every(isFin)) return INEL('a coefficient overflows');
    return { ok: true, P, Q, deg: Math.max(P.length, Q.length) - 1, exact: lit && !!XP && !removed.length, removed };
  }
  // the gcd of the exponents of the non-constant terms of P and Q (high-first arrays): P/Q = R(z^g)
  function ratGcd(P, Q) {
    let g = 0;
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    for (const co of [P, Q]) co.forEach((x, i) => { const e = co.length - 1 - i; if (e > 0 && !isZero(x)) g = gcd(g, e); });
    return g;
  }
  const subPow = (co, g) => co.filter((x, i) => (co.length - 1 - i) % g === 0);
  // ops (forward order) of the coprime P/Q; f: its forward map (the formula's own code) or null
  function ratOps(P, Q, f) {
    const dp = P.length - 1, dq = Q.length - 1, d = Math.max(dp, dq);
    if (d <= 0) return INEL('constant map');
    if (dq === 0) {
      const c = P.map((x) => div(x, Q[0]));
      if (d === 1) return OK([opAff(c[0], c[1])]);
      if (d === 2) return OK([opQuad(c[0], c[1], c[2], f)]);
    } else {
      if (d === 1) {
        const two = (co) => (co.length === 1 ? [ZERO, co[0]] : co);
        const [a, b] = two(P), [c, dd] = two(Q), m = [a, b, c, dd];
        if (CX.mobDetZero(m) || CX.mobRel(m) < CX.MOB_EPS) return INEL('Möbius map too close to degenerate');
        return OK([opMob(m)]);
      }
      if (d === 2) return OK([opRat2(P, Q, f)]);
    }
    const g = ratGcd(P, Q);
    if (g > 1 && g <= IPOW_MAX) {
      const r = ratOps(subPow(P, g), subPow(Q, g), null);
      if (r.ok) return OK([opIpow(g)].concat(r.ops));
    }
    const how = g > IPOW_MAX ? `; a function of z^${g}, |n| > ${IPOW_MAX}` : g > 1 ? `; degree ${d / g} in z^${g}` : '';
    return INEL(`${dq === 0 ? 'polynomial' : 'rational'} formula of degree ${d} (the exact renderer inverts degree ≤ 2, also of a power z^k${how})`);
  }
  // a custom formula: its nodes, outermost first, become ops (returned in forward order); a node whose operands both
  // depend on z must be rational in z (its whole subtree becomes one rational op, or IPOW and one)
  function customOps(ast, th) {
    for (const vv of Expr.usesVars(ast)) if (vv !== 'z') return INEL('Re, Im, |z| and arg lose information');
    if (Expr.hasBool(ast)) return INEL('comparison in a map');
    const cval = (n) => Expr.compile(n)(ZERO);
    const dep = Expr.depends;
    const nz = (x) => isFin(x) && !isZero(x);
    const out = [];
    let n = ast;
    while (n.t !== 'var') {
      if (n.t === 'root' && dep(n.n)) return INEL('a root with z in the index');
      if (n.t === 'pow' && dep(n.a) && dep(n.b)) return INEL('variable base and exponent');
      if (n.a && n.b && dep(n.a) && dep(n.b)) {
        const rf = rationalForm(n);
        if (!rf.ok) return INEL(rf.notRational ? `z occurs more than once in a part that is not rational in z (${rf.reason})` : rf.reason);
        const fwd = Expr.compile(n, { theta: th });
        const r = ratOps(rf.P, rf.Q, fwd);
        if (!r.ok) return INEL(r.reason);
        // the removable singularities: input points of the subtree's first op (forward order), left out of pullFinite
        if (rf.removed.length) r.ops[0] = Object.assign({}, r.ops[0], { holes: rf.removed.slice() });
        // the subtree's ops in forward order: pushed outermost first
        for (let i = r.ops.length - 1; i >= 0; i--) out.push(r.ops[i]);
        break;
      }
      switch (n.t) {
        case 'neg': out.push(opAff(C(-1, 0), ZERO)); n = n.a; break;
        case 'add': if (dep(n.a)) { out.push(opAff(ONE, cval(n.b))); n = n.a; } else { out.push(opAff(ONE, cval(n.a))); n = n.b; } break;
        case 'sub': if (dep(n.a)) { out.push(opAff(ONE, neg(cval(n.b)))); n = n.a; } else { out.push(opAff(C(-1, 0), cval(n.a))); n = n.b; } break;
        case 'mul': { const c = dep(n.a) ? cval(n.b) : cval(n.a); if (!nz(c)) return INEL('constant factor 0'); out.push(opAff(c, ZERO)); n = dep(n.a) ? n.a : n.b; break; }
        case 'div':
          if (dep(n.a)) { const c = cval(n.b); if (!nz(c)) return INEL('division by 0'); out.push(opAff(CX.inv(c), ZERO)); n = n.a; }
          else { const c = cval(n.a); if (!nz(c)) return INEL('constant factor 0'); out.push(opMob([ZERO, c, ONE, ZERO])); n = n.b; }
          break;
        case 'pow':
          if (!dep(n.b)) {
            const v = cval(n.b);
            if (!isFin(v)) return INEL('non-finite exponent');
            if (v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096) {
              if (v.re === 0) return INEL('constant map');
              if (Math.abs(v.re) > IPOW_MAX) return INEL(`integer power |n| > ${IPOW_MAX}`);
              out.push(opIpow(v.re));
            } else out.push(opRootPow(v, th, 0));
            n = n.a;
          } else if (!dep(n.a)) {
            const base = cval(n.a);
            if (!nz(base) || (base.re === 1 && base.im === 0)) return INEL('constant map');
            out.push(base.re === Math.E && base.im === 0 ? opExp(null) : opExp(log(base)));
            n = n.b;
          } else return INEL('variable base and exponent');
          break;
        case 'root': { const v = cval(n.n); if (!nz(v)) return INEL('root of index 0'); out.push(opRootPow(CX.div(ONE, v), th, 0)); n = n.a; break; }
        case 'call': {
          const f = n.f;
          const T = { log: () => opLog(th, 0), sqrt: () => opRootPow(C(0.5, 0), th, 0), exp: () => opExp(null), sin: opSin, cos: opCos, tan: opTan, sinh: opSinh, cosh: opCosh, tanh: opTanh,
            asin: opAsin, acos: opAcos, atan: opAtan, asinh: opAsinh, acosh: opAcosh, atanh: opAtanh, conj: opConj };
          const RECIP = { cot: opTan, sec: opCos, csc: opSin, coth: opTanh };
          if (T[f]) out.push(T[f]());
          else if (RECIP[f]) { out.push(opMob([ZERO, ONE, ONE, ZERO])); out.push(RECIP[f]()); }
          else if (f === 'gamma' || f === 'zeta' || f === 'digamma') return INEL(`${f} takes each value infinitely often`);
          else return INEL(`${f} loses information`);
          n = n.a;
          break;
        }
        default: return INEL('node ' + n.t);
      }
    }
    if (!out.length) return OK([opAff(ONE, ZERO)]);                       // f(z) = z
    return OK(out.reverse());
  }

  return {
    IPOW_MAX, op, opAff, opMob, opIpow, opRootPow, opExp, opLog, asinS, acosS, asinhS, atanS, atanhS, opSin, opCos,
    opTan, opSinh, opCosh, opTanh, tanhAnc, tanAnc, P1, PI_, opAsin, opAcos, opAtan, opAsinh, opAcosh, opAtanh,
    opJouk, opIjouk, opConj, opQuad, opRat2, stepOps, rationalForm
  };
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
export { InvOps };
