  // ---- [issue #4] Γ, ψ, ζ and ζ′ in float32, after CX.lgamma, CX.digamma, CX.zeta, CX.zetaDeriv: put in front of a
  // chain's (or a region formula's) source only when it calls them, so no other program compiles them (specialLib)
  const GAMMA_LIB = `
// sin(πz) and sin(πs/2) with the real part reduced by the period first (float32 keeps the phase)
vec2 cx_pimod(vec2 z) { return vec2(CX_PI * (z.x - 2.0 * floor(0.5 * z.x)), CX_PI * z.y); }
vec2 cx_halfpimod(vec2 s) { return vec2(CX_HALF_PI * (s.x - 4.0 * floor(0.25 * s.x)), CX_HALF_PI * s.y); }
// log sin w, some branch, without overflow for large |Im w|
vec2 cx_logsin(vec2 w) {
  if (abs(w.y) <= 10.0) return clog(csin(w), CX_PI, 0.0);
  float s = w.y > 0.0 ? 1.0 : -1.0;
  vec2 q = cexp(vec2(-2.0 * s * w.y, 2.0 * s * w.x));
  return vec2(s * w.y, -s * w.x) + clog(vec2(1.0, 0.0) - q, CX_PI, 0.0) + vec2(-0.6931471805599453, s * CX_HALF_PI);
}
// log Γ(z), Re z >= 1/2: Lanczos g = 5 (Godfrey's coefficients, accurate past float32)
vec2 cx_lgamma1(vec2 z) {
  vec2 t = z + vec2(5.5, 0.0);
  vec2 tmp = t - cmul(z + vec2(0.5, 0.0), clog(t, CX_PI, 0.0));
  vec2 ser = vec2(1.000000000190015, 0.0);
  ser += cdiv(vec2(76.18009172947146, 0.0), z + vec2(1.0, 0.0));
  ser += cdiv(vec2(-86.50532032941677, 0.0), z + vec2(2.0, 0.0));
  ser += cdiv(vec2(24.01409824083091, 0.0), z + vec2(3.0, 0.0));
  ser += cdiv(vec2(-1.231739572450155, 0.0), z + vec2(4.0, 0.0));
  ser += cdiv(vec2(0.001208650973866179, 0.0), z + vec2(5.0, 0.0));
  ser += cdiv(vec2(-0.000005395239384953, 0.0), z + vec2(6.0, 0.0));
  return clog(cdiv(ser * 2.5066282746310005, z), CX_PI, 0.0) - tmp;
}
// log Γ(z): the reflection log π − log sin(πz) − log Γ(1 − z) for Re z < 1/2; a pole: Re = +inf. (issue #72) One call
// of cx_lgamma1, its argument chosen first: FXC (Direct3D 11) inlines every call, and the Lanczos body was there twice
vec2 cx_lgamma(vec2 z) {
  bool refl = z.x < 0.5;
  if (refl && z.y == 0.0 && z.x == floor(z.x)) return vec2(cx_inf(), 0.0);
  vec2 L = cx_lgamma1(refl ? vec2(1.0, 0.0) - z : z);
  return refl ? vec2(1.1447298858494002, 0.0) - cx_logsin(cx_pimod(z)) - L : L;
}
// Γ(z): exp(log Γ); beyond float32 the point at infinity (cx_isinf)
vec2 cx_gamma(vec2 z) {
  if (!cfin(z)) return vec2(cx_nan());
  vec2 L = cx_lgamma(z);
  if (L.x > 88.7) return vec2(cx_inf());
  return cexp(L);
}
// ψ(z): the reflection ψ(1 − z) − π cot(πz), the recurrence up to |z| >= 10, the asymptotic series
vec2 cx_digamma(vec2 z) {
  if (!cfin(z)) return vec2(cx_nan());
  vec2 acc = vec2(0.0);
  if (z.x < 0.5) {
    if (z.y == 0.0 && z.x == floor(z.x)) return vec2(cx_inf());
    acc = -CX_PI * cinv(ctan(cx_pimod(z)));
    z = vec2(1.0, 0.0) - z;
  }
  for (int i = 0; i < max(12, uNoUnroll); i++) { if (cx_abs(z) >= 10.0) break; acc -= cinv(z); z += vec2(1.0, 0.0); }
  vec2 w2 = cinv(cmul(z, z));
  vec2 ser = cmul(w2, vec2(1.0 / 12.0, 0.0) + cmul(w2, vec2(-1.0 / 120.0, 0.0) + cmul(w2, vec2(1.0 / 252.0, 0.0) + cmul(w2, vec2(-1.0 / 240.0, 0.0)))));
  return acc + clog(z, CX_PI, 0.0) - 0.5 * cinv(z) - ser;
}
`;
  // The entries of ZETA_LIB's table of ln k (k < ZETA_LN_K_COUNT, four to a uniform row; the host fills it, logK in src/gl/04-programs-resources.js)
  const ZETA_LN_K_COUNT = 132;
  // ζ, ζ′ (they need Γ's part: log sin, Lanczos, ψ)
  const ZETA_LIB = `
// ζ on the GPU up to |Im s| = CX_ZETA_TMAX (beyond: NaN, a blank, never a wrong value; the CPU goes further)
const float CX_ZETA_TMAX = 120.0;
// ln k for k < ${ZETA_LN_K_COUNT}, four to a row: the host fills it once with the GPU's own log (logK, src/gl/04-programs-resources.js), so a term
// reads what log(float(k)) gives, not a log of its own. Entry 0 (unused by the sums) is 1 once the host has filled it; a program
// whose host did not (a test page's) holds zeros there and takes the log itself
uniform highp vec4 uLogK[${ZETA_LN_K_COUNT / 4}];
float cx_lnk(int k, bool tab) {
  if (tab && k < ${ZETA_LN_K_COUNT}) return uLogK[k >> 2][k & 3];
  return log(float(k));
}
const float CX_EMC[6] = float[6](0.08333333333333333, -0.001388888888888889, 0.0000330687830687831, -8.267195767195768e-7, 2.08767569878681e-8, -5.284190138687493e-10);
// Euler–Maclaurin, N = |Im s| + 10, six Bernoulli terms; P_j N^{1-2j} kept as one factor Q (no overflow). Re s >= 0
vec2 cx_zetaEM(vec2 s) {
  if (s.x == 1.0 && s.y == 0.0) return vec2(cx_inf());
  int N = int(ceil(abs(s.y))) + 10;
  vec2 sum = vec2(0.0);
  bool tab = uLogK[0].x != 0.0;
  for (int k = 1; k < max(200, uNoUnroll); k++) { if (k >= N) break; sum += cexp(-s * cx_lnk(k, tab)); }
  float fN = float(N), lnN = log(fN);
  vec2 Nms = cexp(-s * lnN);
  sum += 0.5 * Nms + cdiv(Nms * fN, s - vec2(1.0, 0.0));
  vec2 Q = s / fN, bt = CX_EMC[0] * Q;
  for (int j = 1; j < 6; j++) {
    Q = cmul(Q, cmul(s + vec2(float(2 * j - 1), 0.0), s + vec2(float(2 * j), 0.0))) / (fN * fN);
    bt += CX_EMC[j] * Q;
  }
  return sum + cmul(bt, Nms);
}
// ζ′ by the same sum differentiated term by term (Q as above, R = P′_j N^{1-2j})
vec2 cx_zetaEMd(vec2 s) {
  if (s.x == 1.0 && s.y == 0.0) return vec2(cx_inf());
  int N = int(ceil(abs(s.y))) + 10;
  vec2 sum = vec2(0.0);
  bool tab = uLogK[0].x != 0.0;
  for (int k = 2; k < max(200, uNoUnroll); k++) { if (k >= N) break; float lk = cx_lnk(k, tab); sum -= cexp(-s * lk) * lk; }
  float fN = float(N), lnN = log(fN);
  vec2 Nms = cexp(-s * lnN), r = cinv(s - vec2(1.0, 0.0));
  sum -= 0.5 * lnN * Nms + cmul(Nms * fN, r * lnN + cmul(r, r));
  vec2 Q = s / fN, R = vec2(1.0 / fN, 0.0), bt = CX_EMC[0] * (R - lnN * Q);
  for (int j = 1; j < 6; j++) {
    vec2 q = cmul(s + vec2(float(2 * j - 1), 0.0), s + vec2(float(2 * j), 0.0)), qd = 2.0 * s + vec2(float(4 * j - 1), 0.0);
    R = (cmul(R, q) + cmul(Q, qd)) / (fN * fN);
    Q = cmul(Q, q) / (fN * fN);
    bt += CX_EMC[j] * (R - lnN * Q);
  }
  return sum + cmul(bt, Nms);
}
// ζ(s): Euler–Maclaurin for Re s >= 0; the functional equation 2^s π^{s-1} sin(πs/2) Γ(1 − s) ζ(1 − s), in log form.
// (issue #72) cx_zetaEM, its 200-term loop and all, is called once (at s or at 1 − s)
vec2 cx_zeta(vec2 s) {
  if (!cfin(s) || abs(s.y) > CX_ZETA_TMAX) return vec2(cx_nan());
  bool fe = s.x < 0.0;
  if (fe && s.y == 0.0 && s.x == 2.0 * floor(0.5 * s.x)) return vec2(0.0);
  vec2 one = vec2(1.0, 0.0) - s;
  vec2 Z = cx_zetaEM(fe ? one : s);
  if (!fe) return Z;
  vec2 L = s * 0.6931471805599453 + (s - vec2(1.0, 0.0)) * 1.1447298858494002 + cx_logsin(cx_halfpimod(s)) + cx_lgamma1(one);
  if (L.x > 88.7) return vec2(cx_inf());
  return cmul(cexp(L), Z);
}
// ζ′(s): for Re s < 0, from ζ = χ ζ(1 − s): χ (L′ ζ(1 − s) − ζ′(1 − s)), near the real axis without the log form
vec2 cx_zetad(vec2 s) {
  if (!cfin(s) || abs(s.y) > CX_ZETA_TMAX) return vec2(cx_nan());
  // (issue #72: cx_zetaEMd and cx_lgamma1 called once each)
  vec2 one = vec2(1.0, 0.0) - s, z1d = cx_zetaEMd(s.x >= 0.0 ? s : one);
  if (s.x >= 0.0) return z1d;
  vec2 z1 = cx_zetaEM(one), lg1 = cx_lgamma1(one);
  vec2 base = vec2(0.6931471805599453 + 1.1447298858494002, 0.0) - cx_digamma(one);
  vec2 hs = cx_halfpimod(s);
  if (abs(s.y) < 1.0) {
    vec2 A = cexp(s * 0.6931471805599453 + (s - vec2(1.0, 0.0)) * 1.1447298858494002 + lg1);
    vec2 sn = csin(hs), cs = ccos(hs);
    return cmul(A, cmul(cmul(sn, base), z1) + CX_HALF_PI * cmul(cs, z1) - cmul(sn, z1d));
  }
  vec2 L = s * 0.6931471805599453 + (s - vec2(1.0, 0.0)) * 1.1447298858494002 + cx_logsin(hs) + lg1;
  if (L.x > 88.7) return vec2(cx_inf());
  vec2 Ld = base + CX_HALF_PI * cinv(ctan(hs));
  return cmul(cexp(L), cmul(Ld, z1) - z1d);
}
`;
  // [issue #5] the series' helpers: w^e for an integer e held as a float (binary powers, at most 31 squarings; |e| past
  // 2^31 only for |w| <= 1, where it is 0, or 1 on the circle)
  const IPOWI_LIB = `
vec2 cx_ipowi(vec2 w, float e) {
  if (e == 0.0) return vec2(1.0, 0.0);
  if (e == 1.0) return w;
  float n = abs(e);
  vec2 r = vec2(1.0, 0.0), b = w;
  if (n > 2147483647.0) { float a = cx_abs(w); r = a < 1.0 ? vec2(0.0) : a == 1.0 ? vec2(1.0, 0.0) : vec2(cx_inf()); return r; }
  for (int i = 0; i < max(31, uNoUnroll); i++) {
    if (mod(n, 2.0) == 1.0) r = cmul(r, b);
    n = floor(0.5 * n);
    if (n == 0.0) break;
    b = cmul(b, b);
  }
  return e < 0.0 ? cinv(r) : r;
}
`;
  // n! and the binomial coefficient (they need Γ's part)
  const FACT_LIB = `
vec2 cx_fact(vec2 z) { return cx_gamma(z + vec2(1.0, 0.0)); }
// (issue #72: the three log Γ through one call site)
vec2 cx_binom(vec2 a, vec2 b) {
  vec2 acc = vec2(0.0);
  for (int i = 0; i < max(3, uNoUnroll); i++) {
    vec2 L = cx_lgamma((i == 0 ? a : i == 1 ? b : a - b) + vec2(1.0, 0.0));
    acc = i == 0 ? L : acc - L;
    if (i == 2) break;
  }
  return cexp(acc);
}
`;
  // the parts a source calls and those they need, in order: Γ does not bring ζ
  // along, nor w^e (a series) Γ and ζ
  const specialLib = (src) => {
    const zeta = /\bcx_zetad?\(/.test(src), fact = /\bcx_(fact|binom)\(/.test(src);
    const gamma = zeta || fact || /\bcx_(gamma|lgamma|digamma)\(/.test(src);
    return (gamma ? GAMMA_LIB : '') + (zeta ? ZETA_LIB : '') + (/\bcx_ipowi\(/.test(src) ? IPOWI_LIB : '') + (fact ? FACT_LIB : '');
  };
  const withSpecial = (src) => specialLib(src) + src;

  // ---- natural paths (Funcs: ZOOM, joukHom, ratPath, genericZoomNat): h bodies in z and t, mirroring the CPU ----
  // nat: the built step's descriptor {kind, fn | n | dp, dq}; returns {h, write(put, b)} or null (no GPU path: the
  // straight line). Data that depend on the parameters (zeros, the zoom centre) are uniforms, filled from b.natData;
  // a flag cell .x = 0 (no data: a constant, a zero leading coefficient) falls back to the straight line, like the CPU.
  const ASH1 = Math.log(1 + Math.SQRT2), SQ2 = Math.SQRT2;
  const ZOOM_GL = {
    sin: 'return cx_sinS(z * t) / t;', sinh: 'return cx_sinhS(z * t) / t;', tan: 'return cx_tanS(z * t) / t;', tanh: 'return cx_tanhS(z * t) / t;',
    arcsin: 'return cx_asinS(z * t) / t;', arsinh: 'return cx_asinhS(z * t) / t;', arctan: 'return cx_atanS(z * t) / t;', artanh: 'return cx_atanhS(z * t) / t;',
    cos: 'return vec2((1.0 - t) * CX_HALF_PI, 0.0) + cmul(vec2(cos(CX_PI * t), sin(CX_PI * t)), cx_sinS((z - vec2(CX_HALF_PI, 0.0)) * t) / t);',
    arccos: 'return vec2(t * CX_HALF_PI, 0.0) + cmul(vec2(cos(CX_PI * t), sin(CX_PI * t)), cx_asinS(z * t) / t);',
  };
  const NAT_NMAX = 24; // the zoom path's shifted-form coefficients as uniforms up to this degree (Funcs.ZP_MAX)
  function natPlan(P, nat, A, extra = {}) {
    if (!nat) return null;
    const T0 = 'if (t <= 0.0) return z;\n  ';
    switch (nat.kind) {
      case 'zoom': {
        if (ZOOM_GL[nat.fn]) return { h: T0 + ZOOM_GL[nat.fn], write() {} };
        if (nat.fn === 'cosh') {
          return {
            h: `${T0}const float P = ${flt(ASH1)}, Q = ${flt(SQ2)};
  vec2 h = (z - vec2(P, 0.0)) * (0.5 * t);
  return cmul(csinh(vec2(P, 0.0) + h), cx_sinhS(h)) * (2.0 / t) + vec2((1.0 - t) * P + t * Q, 0.0);`,
            write() {},
          };
        }
        if (nat.fn === 'arcosh') {
          return {
            h: `${T0}const float P = ${flt(ASH1)}, Q = ${flt(SQ2)};
  vec2 d = (z - vec2(Q, 0.0)) * t, x = vec2(Q, 0.0) + d;
  vec2 s = cmul(csqrtp(x - vec2(1.0, 0.0)), csqrtp(x + vec2(1.0, 0.0)));
  vec2 den = s + vec2(1.0, 0.0);
  vec2 v = cx_abs(den) > 1e-3 ? cmul(d, vec2(1.0, 0.0) + cdiv(x + vec2(Q, 0.0), den)) * (1.0 / (1.0 + Q)) : (x + s) * (1.0 / (1.0 + Q)) - vec2(1.0, 0.0);
  return cx_log1p(v) / t + vec2((1.0 - t) * Q + t * P, 0.0);`,
            write() {},
          };
        }
        return null;
      }
      case 'jouk': {
        // inside the unit disk the branch arg Cz in (pi/2, 3pi/2): tanh((1 + t) artanh z - i pi t/2) (Funcs joukHom);
        // c J (nat.scaled): times c^t, lc = log c a uniform
        const J = (c) => `vec2 J = dot(${c}, ${c}) < 1.0 ? cx_tanhS(cx_atanhS(z) * (1.0 + t) - vec2(0.0, CX_HALF_PI * t))`
          + ' : cinv(cx_tanhS(cx_atanhS(cinv(z)) * (1.0 + t)));';
        // (hc: the branch of the triangle's centre zc, continued across the unit circle; dom: z's side of that circle
        // as seen from zc, positive on zc's side, where the continuation is the path itself)
        const dom = 'float g = dot(z, z) - 1.0;\n  return dot(zc, zc) < 1.0 ? -g : g;';
        if (!nat.scaled) return { h: `${T0}${J('z')}\n  return J;`, hc: `${T0}${J('zc')}\n  return J;`, dom, write() {} };
        const lc = A.cell();
        return { h: `${T0}${J('z')}\n  return cmul(cexp(${lc.v} * t), J);`, hc: `${T0}${J('zc')}\n  return cmul(cexp(${lc.v} * t), J);`, dom, write(put, b) { const d = Funcs.natData(b); putC(put, lc, d && d.lc ? d.lc : C(0, 0)); } };
      }
      // the Moebius one-parameter group (degree 1, however entered): the path slots of the affine and Moebius steps
      case 'mob': {
        const path = pathSlots(A);
        return { h: pathHom(P, path), own1: true, write(put, b) { const d = Funcs.natData(b); path.write(put, d && d.m ? mobPathData(d.m) : null); } };
      }
      // a (z - c)^n: (1 - t) c + a^t (z - c)^{1+(n-1)t}, principal (Funcs powPath)
      case 'pow': {
        const c = A.cell(), la = A.cell(), n = A.cell();
        return {
          h: `${T0}return ${c.v} * (1.0 - t) + cmul(cexp(${la.v} * t), cpowr(z - ${c.v}, 1.0 + (${n.x} - 1.0) * t, CX_PI, 0.0));`,
          // (the same path on the local cut opposite its input at the cell centre zc, sheet 0: chainSheetHom)
          hc: `${T0}return ${c.v} * (1.0 - t) + cmul(cexp(${la.v} * t), cpowr(z - ${c.v}, 1.0 + (${n.x} - 1.0) * t, carg(zc - ${c.v}) + CX_PI, 0.0));`,
          write(put, b) { const d = Funcs.natData(b); putC(put, c, d ? d.c : C(0, 0)); putC(put, la, d ? d.la : C(0, 0)); put(n.c, d ? d.n : 1, 0); },
        };
      }
      // any other analytic formula: f inlined at p + t(z - p) (Funcs genericZoomNat); below t0 (>= 1e-3) the blend
      // z + (t/t0)(H_t0(z) - z), as the CPU
      case 'gzoom': {
        const p = A.cell(), fp = A.cell(), ll = A.cell(), g = A.cell();
        // (one call of f, at the point below t0 too and at t = 1, where the path is f(z) itself: FXC
        // inlines every call, and a formula's f can be tens of KB; the values are H(max(t, t0)))
        return {
          own1: true, h: `${T0}float t0 = ${g.x}, tt = t == 1.0 ? 1.0 : max(t, t0);\n  vec2 fa = ${P}_f(t == 1.0 ? z : ${p.v} + (z - ${p.v}) * tt);\n  if (t == 1.0) return fa;\n  vec2 h = ${p.v} * (1.0 - tt) + ${fp.v} * tt + cmul(cexp(${ll.v} * (tt - 1.0)), fa - ${fp.v}) / tt;\n  return t < t0 ? z + (h - z) * (t / t0) : h;`,
          write(put, b) { const d = Funcs.natData(b); for (const [cell, k] of [[p, 'p'], [fp, 'fp'], [ll, 'll']]) putC(put, cell, d ? d[k] : C(0, 0)); put(g.c, d && d.t0 ? d.t0 : 1e-3, 0); },
        };
      }
      case 'ijouk': {
        const sg = extra.sg;
        return { h: `${T0}return cinv(cx_tanhS(cx_atanhS(cinv(z)) * (1.0 - 0.5 * t) - vec2(0.0, ${sg.x} < 0.0 ? CX_HALF_PI * t : 0.0)));`, write() {} };
      }
      case 'exp': return { h: 'if (t < 1e-6) return z;\n  return cx_expm1(z * t) * (1.0 / t) + vec2(t, 0.0);', write() {} };
      case 'log': {
        const c = extra.cut;
        return {
          h: `if (t <= 0.0) return z;
  float u = 1.0 - t;
  if (u < 1e-6) return clog(z, ${c}, 0.0);
  if (z.x == 0.0 && z.y == 0.0) return vec2(u - 1.0 / u, 0.0);
  return cx_expm1(clog(z, ${c}, 0.0) * u) * (1.0 / u) + vec2(u, 0.0);`,
          write() {},
        };
      }
      case 'ratzoom': {
        const M = Math.max(nat.dp, nat.dq), dp = nat.dp, dq = nat.dq;
        // flag.x: data present, flag.y: rN (the shifted form's radius); q0 = Q(p)
        const flag = A.cell(), p = A.cell(), fp = A.cell(), ll = A.cell(), q0 = A.cell();
        // P and Q: the step's own coefficient cells when it has them with these very values (extra.shared: the poly
        // step, Q = 1; a rational step with a non-constant denominator), so the path adds no uniforms per coefficient,
        // and the far form is P_f itself; otherwise cells of its own (the zeros-and-poles step, a custom formula)
        const sh = extra.shared || null;
        const Pc = sh ? sh.P : Array.from({ length: dp + 1 }, () => A.cell());
        const Qc = sh ? sh.Q : Array.from({ length: dq + 1 }, () => A.cell());
        // Near p: up to degree NAT_NMAX the Taylor coefficients N of the shifted form (exact to float32 rounding,
        // computed once in double); above it, so that a polynomial of a thousand terms needs no second thousand
        // uniforms, the same quantity as divided differences, u N(e) = u (q0 P[p,x] − p0 Q[p,x]) / n1 with
        // P[p,x] = (P(x) − P(p))/(x − p) by synthetic division (no cancellation at x = p either); kn = q0/n1, p0 = P(p)
        // (0 at an exact zero), the remainder of the division dropped as the CPU drops it
        const useN = M <= NAT_NMAX;
        const Nc = useN ? Array.from({ length: M }, () => A.cell()) : [];
        const kn = useN ? null : A.cell(), p0 = useN || !Qc ? null : A.cell();
        const horner = (cs, nm, at) => `vec2 ${nm} = vec2(0.0);\n` + cs.map((c) => `  ${nm} = cmul(${nm}, ${at}) + ${c.v};`).join('\n');
        // the quotient of the polynomial with coefficients cs (highest first) by (x - p), at x: a loop over the
        // uniform array when the cells are consecutive (the step's own coefficients), else unrolled
        const quot = (cs, nm) => {
          const n = cs.length - 1;
          if (n < 1) return `vec2 ${nm} = vec2(0.0);`;
          const c0 = cs[0].c;
          if (cs.every((c, i) => c.c === c0 + i) && n > 8) {
            return `vec2 ${nm} = vec2(0.0), ${nm}b = vec2(0.0);
  for (int k = 0; k < ${n}; k++) {
    int ci = ${c0} + k;
    vec4 s = uChain[ci >> 1];
    ${nm}b = cmul(${nm}b, ${p.v}) + ((ci & 1) == 0 ? s.xy : s.zw);
    ${nm} = cmul(${nm}, x) + ${nm}b;
  }`;
          }
          return `vec2 ${nm} = vec2(0.0), ${nm}b = vec2(0.0);\n` + cs.slice(0, n).map((c) => `  ${nm}b = cmul(${nm}b, ${p.v}) + ${c.v}; ${nm} = cmul(${nm}, x) + ${nm}b;`).join('\n');
        };
        const near = useN
          ? `${horner(Nc, 'n', 'e')}
    return c + cmul(cexp(${ll.v} * t), cdiv(cmul(cmul(u, n), ${q0.v}), q));`
          : `${quot(Pc, 'dP')}
    ${Qc ? `${quot(Qc, 'dQ')}\n    vec2 dd = cmul(${q0.v}, dP) - cmul(${p0.v}, dQ);` : 'vec2 dd = dP;'}
    return c + cmul(cexp(${ll.v} * t), cdiv(cmul(cmul(u, dd), ${kn.v}), q));`;
        const far = sh ? `${P}_f(x)` : Qc ? 'cdiv(pp, q)' : 'pp';
        const h = `${T0}if (${flag.x} < 0.5) { ${LIN(P)} }
  vec2 u = z - ${p.v}, e = u * t, x = ${p.v} + e;
  vec2 c = ${p.v} * (1.0 - t) + ${fp.v} * t;
  ${Qc ? horner(Qc, 'q', 'x') : 'vec2 q = vec2(1.0, 0.0);'}
  if (cx_abs(e) < ${flag.y}) {
    ${near}
  }
  ${sh ? '' : horner(Pc, 'pp', 'x')}
  return c + cmul(cexp(${ll.v} * (t - 1.0)), ${far} - ${fp.v}) / t;`;
        return {
          h,
          write(put, b) {
            const d = Funcs.natData(b);
            const ok = !!d && d.N && d.N.length === M && d.P.length === dp + 1 && d.Q.length === dq + 1;
            put(flag.c, ok ? 1 : 0, ok ? Math.min(d.rN, 3e38) : 0);
            for (const [c, v] of [[p, ok ? d.p : C(0, 0)], [fp, ok ? d.fp : C(0, 0)], [ll, ok ? d.ll : C(0, 0)], [q0, ok ? d.q0 : C(0, 0)]]) putC(put, c, v);
            Nc.forEach((c, k) => putC(put, c, ok ? d.N[k] : C(0, 0)));
            if (kn) putC(put, kn, ok ? CX.div(d.q0, d.n1) : C(0, 0));
            if (p0) putC(put, p0, ok ? d.p0 : C(0, 0));
            if (sh) return; // the step writes its coefficients itself
            Pc.forEach((c, k) => putC(put, c, ok ? d.P[k] : C(0, 0)));
            if (Qc) Qc.forEach((c, k) => putC(put, c, ok ? d.Q[k] : C(0, 0)));
          },
        };
      }
    }
    return null;
  }

  // ---- per-step code generation ----
  // Returns {sig, f, h, write(put)}: f is the body of vec2 P_f(vec2 z), h of vec2 P_h(vec2 z, float t).
  function stepPlan(P, b, A) {
    const v = b.vals;
    const type = b.def.id;
    const trig = { sin: 'csin', cos: 'ccos', tan: 'ctan', sinh: 'csinh', cosh: 'ccosh', tanh: 'ctanh', arcsin: 'casin', arccos: 'cacos', arctan: 'catan', arsinh: 'casinh', arcosh: 'cacosh', artanh: 'catanh' };
    if (trig[type]) {
      const np = natPlan(P, b.nat, A);
      return { sig: [type], f: `return ${trig[type]}(z);`, h: np ? np.h : LIN(P), own1: !!(np && np.own1), write() {} };
    }
    switch (type) {
      case 'mul': {
        const c = A.cell(), path = pathSlots(A);
        return {
          sig: [type], f: `return cmul(${c.v}, z);`, h: pathHom(P, path), own1: true,
          write(put) { putC(put, c, v.c); path.write(put, CX.isZero(v.c) ? null : mobPathData([v.c, C(0, 0), C(0, 0), C(1, 0)])); },
        };
      }
      case 'add': {
        const c = A.cell();
        return { sig: [type], f: `return z + ${c.v};`, h: `return z + ${c.v} * t;`, write(put) { putC(put, c, v.c); } };
      }
      case 'affine': {
        const a = A.cell(), bb = A.cell(), path = pathSlots(A);
        return {
          sig: [type], f: `return cmul(${a.v}, z) + ${bb.v};`, h: pathHom(P, path), own1: true,
          write(put) { putC(put, a, v.a); putC(put, bb, v.b); path.write(put, CX.isZero(v.a) ? null : mobPathData([v.a, v.b, C(0, 0), C(1, 0)])); },
        };
      }
      case 'recip': {
        const path = pathSlots(A);
        return { sig: [type], f: 'return cinv(z);', h: pathHom(P, path), own1: true, write(put) { path.write(put, mobPathData([C(0, 0), C(1, 0), C(1, 0), C(0, 0)])); } };
      }
      case 'mobius': case 'blaschke': {
        let m;
        if (type === 'mobius') m = [v.a, v.b, v.c, v.d];
        else {
          const e = C(Math.cos(v.phi * DEG), Math.sin(v.phi * DEG));
          m = [e, CX.neg(CX.mul(e, v.a)), CX.neg(CX.conj(v.a)), C(1, 0)];
        }
        // the map is invariant under scaling; a power of two (exact) brings entries beyond float32 range back.
        // The path gets the unscaled matrix, like CX.mobPath (which scales it the same way itself).
        let ms = m;
        const mx = Math.max(...m.map((x) => Math.max(Math.abs(x.re), Math.abs(x.im))));
        if (mx > 0 && Number.isFinite(mx)) {
          const s = 2 ** -Math.round(Math.log2(mx));
          if (s !== 1 && s > 0 && Number.isFinite(s)) ms = m.map((x) => CX.scale(x, s));
        }
        const s0 = A.slot(), s1 = A.slot(), s2 = A.slot(), s3 = A.slot(), path = pathSlots(A);
        return {
          sig: [type], f: `return cx_mobstep(z, ${s0.v}, ${s1.v}, ${s2.v}, ${s3.v});`, h: pathHom(P, path), own1: true,
          write(put) {
            for (let i = 0; i < 4; i++) put(s0.c + i, ms[i].re, ms[i].im);
            const sd = mobStepData(ms);
            put(s2.c, sd.mode, 0); put(s2.c + 1, sd.k.re, sd.k.im);
            put(s3.c, sd.alpha.re, sd.alpha.im); put(s3.c + 1, sd.beta.re, sd.beta.im);
            path.write(put, mobPathData(m));
          },
        };
      }
      case 'pown': {
        // q = (n, n < 0, hi, lo): n as a float for the homotopy exponent, and the exact int32 bits of
        // ToInt32(|n|) as two 16-bit halves (Funcs.build keeps |n| <= 4096, so that is just |n|, as in CX.ipow)
        const q = A.slot(), path = pathSlots(A);
        const m = `highp uint mh = uint(${q.v}.z), ml = uint(${q.v}.w);\n  highp int m = int((mh << 16u) | ml);`;
        // (one call each of cpowr, cx_ipow32 and the path, so FXC, which inlines every call, writes each once)
        const ph = (cut) => `float n = ${q.v}.x;
  if (n >= 0.0 || t < 0.5) return cpowr(z, n >= 0.0 ? 1.0 + (n - 1.0) * t : 1.0 + (-n - 1.0) * (2.0 * t), ${cut}, 0.0);
  ${m}
  // inversion path applied to z^|n|; for |z| > 1 via u = (1/z)^|n|, since z^|n| itself may overflow float32
  bool inv = dot(z, z) > 1.0;
  return ${path.callu('cx_ipow32(z, inv, m)', '2.0 * t - 1.0', 'inv')};`;
        return {
          sig: [type], f: `if (${q.v}.x == 0.0) return vec2(1.0, 0.0);\n  ${m}\n  return cx_ipow32(z, ${q.v}.y > 0.5, m);`,
          h: ph('CX_PI'),
          // (the path z^(1 + (n - 1)t) has a cut for 0 < t < 1: in chainSheetHom it runs on the local cut opposite its
          // input at the cell centre zc, sheet 0, so the landscape's edge pass finds that cut by continuation)
          hc: ph('carg(zc) + CX_PI'),
          write(put) {
            const u = (Math.abs(v.n) | 0) >>> 0; // ToUint32(ToInt32(|n|))
            put(q.c, v.n, v.n < 0 ? 1 : 0); put(q.c + 1, u >>> 16, u & 0xffff);
            path.write(put, mobPathData([C(0, 0), C(1, 0), C(1, 0), C(0, 0)]));
          },
        };
      }
      case 'root': {
        const cut = A.cell(), al = A.cell();
        return {
          sig: [type], f: `return cpowr(z, ${al.x}, ${cut.x}, ${cut.y});`,
          h: `return cpowr(z, 1.0 + (${al.x} - 1.0) * t, ${cut.x}, ${cut.y});`,
          write(put) {
            const n = Math.max(2, v.n);
            put(cut.c, v.cut * DEG, ((v.k % n) + n) % n);
            put(al.c, 1 / n, 0);
          },
        };
      }
      case 'powa': {
        const cut = A.cell(), al = A.cell();
        return {
          sig: [type], f: `return cpow(z, ${al.v}, ${cut.x}, ${cut.y});`,
          h: `return cpow(z, vec2(1.0 + (${al.x} - 1.0) * t, ${al.y} * t), ${cut.x}, ${cut.y});`,
          write(put) { put(cut.c, v.cut * DEG, v.k); putC(put, al, v.alpha); },
        };
      }
      case 'exp':
        return {
          sig: [type], f: 'return cexp(z);',
          h: 'if (t < 1e-6) return z;\n  return cx_expm1(z * t) * (1.0 / t) + vec2(t, 0.0);', write() {},
        };
      case 'log': {
        const cut = A.cell();
        return {
          sig: [type], f: `return clog(z, ${cut.x}, ${cut.y});`,
          h: `if (t <= 0.0) return z;
  float u = 1.0 - t;
  if (u < 1e-6) return clog(z, ${cut.x}, ${cut.y});
  if (z.x == 0.0 && z.y == 0.0) return vec2(u - 1.0 / u, 0.0);
  return cx_expm1(clog(z, ${cut.x}, ${cut.y}) * u) * (1.0 / u) + vec2(u, 0.0);`,
          write(put) { put(cut.c, v.cut * DEG, v.k); },
        };
      }
      case 'joukowski': {
        const np = natPlan(P, b.nat, A);
        return { sig: [type], f: 'return (z + cinv(z)) * 0.5;', h: np ? np.h : LIN(P), own1: !!(np && np.own1), hc: np && np.hc, dom: np && np.dom, write() {} };
      }
      case 'ijouk': {
        const sg = A.cell();
        // interior branch z - s equals 1/(z + s) since (z - s)(z + s) = 1; the latter avoids cancellation
        return {
          sig: [type],
          f: `vec2 e = z + cmul(csqrtp(z - vec2(1.0, 0.0)), csqrtp(z + vec2(1.0, 0.0)));\n  return ${sg.x} > 0.0 ? e : cinv(e);`,
          h: (natPlan(P, b.nat, A, { sg }) || { h: LIN(P) }).h, write(put) { put(sg.c, v.branch === 'interior' ? -1 : 1, 0); },
        };
      }
      case 'conj':
        return { sig: [type], f: 'return vec2(z.x, -z.y);', h: 'return vec2(z.x, z.y * (1.0 - 2.0 * t));', write() {} };
      // [issue #4] Γ deforms along the generic zoom path (its data are uniforms), ζ along the straight line
      case 'gamma': {
        const np = natPlan(P, b.nat, A);
        return { sig: [type, b.nat ? b.nat.kind : 'lin'], f: 'return cx_gamma(z);', h: np ? np.h : LIN(P), own1: !!(np && np.own1), write(put) { if (np) np.write(put, b); } };
      }
      case 'zeta':
        return { sig: [type], f: 'return cx_zeta(z);', h: LIN(P), write() {} };
      // Φ_M(z) = φ_z(z) and φ_c(z) as CX.bottcher: the orbit to |w| > 10⁴ kept in an array (N ≤ 64, a
      // uniform; neither loop unrolls), then back by the square root nearest each orbit point. float32 holds
      // w² to 10⁸ and c/w² without overflow. φ_c is NaN where |φ_c| ≤ e^{G_c(0)}, a uniform. (The escape test on |w|²
      // and the roots by length(), whose argument stays below 10⁸ here, not by cx_abs and csqrtp: 1.7 times faster on
      // SwiftShader; the root keeps csqrtp's form, with no cancellation)
      case 'dh': case 'bottcher': {
        const nn = A.cell(), jc = type === 'bottcher' ? A.cell() : null;
        const NM = Funcs.DH_NMAX;
        return {
          sig: [type],
          f: `vec2 orb[${NM + 1}];
  vec2 c = ${jc ? jc.v : 'z'}, w = z;
  int n = -1;
  for (int k = 0; k < max(${NM + 1}, uNoUnroll); k++) {
    orb[k] = w;
    if (dot(w, w) > 1e8) { n = k; break; }
    if (float(k) >= ${nn.x}) break;
    w = cmul(w, w) + c;
  }
  if (n < 0) return vec2(cx_nan());
  vec2 p = cmul(w, csqrtp(vec2(1.0, 0.0) + cdiv(cdiv(c, w), w)));
  for (int j = 1; j < max(${NM + 1}, uNoUnroll); j++) {
    if (j > n) break;
    float m = length(p), t = sqrt(0.5 * (m + abs(p.x)));
    vec2 r = p.x >= 0.0 ? vec2(t, p.y / (2.0 * t)) : vec2(abs(p.y) / (2.0 * t), p.y >= 0.0 ? t : -t), o = orb[n - j];
    p = dot(r, o) >= 0.0 ? r : -r;
  }
  ${jc ? `if (!(cx_abs(p) > ${nn.y})) return vec2(cx_nan());\n  ` : ''}return p;`,
          h: LIN(P),
          write(put) { put(nn.c, v.N, jc ? b.dh.rho : 0); if (jc) putC(put, jc, v.c); },
        };
      }
      case 'poly': case 'rational': {
        const lists = type === 'poly' ? [CX.polyTrim(v.co)] : [CX.polyTrim(v.p), CX.polyTrim(v.q)];
        const cells = lists.map((co) => co.map(() => A.cell()));
        const horner = (cs, nm) => `vec2 ${nm} = vec2(0.0);\n` + cs.map((c) => `  ${nm} = cmul(${nm}, z) + ${c.v};`).join('\n');
        const f = type === 'poly' ? `${horner(cells[0], 'p')}\n  return p;` : `${horner(cells[0], 'p')}\n  ${horner(cells[1], 'q')}\n  return cdiv(p, q);`;
        // the zoom path reads P and Q from these cells when they hold exactly its P and Q (a constant denominator
        // divides the numerator there, so a rational step with one keeps cells of its own)
        const shared = type === 'poly' ? { P: cells[0], Q: null } : lists[1].length > 1 ? { P: cells[0], Q: cells[1] } : null;
        const np = natPlan(P, b.nat, A, { shared });
        return {
          sig: [type, ...lists.map((l) => l.length), b.nat ? b.nat.kind : 'lin'], f, h: np ? np.h : LIN(P), own1: !!(np && np.own1), hc: np && np.hc, dom: np && np.dom,
          write(put) { lists.forEach((co, j) => co.forEach((c, i) => putC(put, cells[j][i], c))); if (np) np.write(put, b); },
        };
      }
      case 'zp': {
        // a ∏ (z − ζ_k)/(z − p_k) × the unpaired factors, as Funcs evaluates it (no overflow of either product alone);
        // the values are uniforms, so dragging a zero or a pole never recompiles (the counts are the signature)
        const zp = b.zp, nz = zp.zeros.length, np = zp.poles.length, deg = Math.max(nz, np);
        const a = A.cell(), zc = zp.zeros.map(() => A.cell()), pc = zp.poles.map(() => A.cell());
        let f = `if (${a.v} == vec2(0.0)) return vec2(0.0);\n  `; // a = 0: the constant 0, the poles too (removable)
        for (const c of pc) f += `if (z == ${c.v}) return vec2(cx_inf());\n  `;
        f += `vec2 w = ${a.v};\n`;
        for (let i = 0; i < deg; i++) {
          if (i < nz && i < np) f += `  w = cmul(w, cdiv(z - ${zc[i].v}, z - ${pc[i].v}));\n`;
          else if (i < nz) f += `  w = cmul(w, z - ${zc[i].v});\n`;
          else f += `  w = cdiv(w, z - ${pc[i].v});\n`;
        }
        f += '  return w;';
        const np2 = natPlan(P, b.nat, A);
        return {
          sig: [type, nz, np, b.nat ? b.nat.kind : 'lin'], f, h: np2 ? np2.h : LIN(P), own1: !!(np2 && np2.own1), hc: np2 && np2.hc, dom: np2 && np2.dom,
          write(put) {
            putC(put, a, zp.a);
            zc.forEach((c, i) => putC(put, c, zp.zeros[i]));
            pc.forEach((c, i) => putC(put, c, zp.poles[i]));
            if (np2) np2.write(put, b);
          },
        };
      }
      case 'series':
      case 'recurrence':
      case 'custom': {
        if (b.rec) return b.repeat ? repPlan(P, b, A) : recPlan(P, b, A);
        const ast = b.ast || Expr.parse(v.expr);
        const cut = A.cell();
        const TH = cut.x;
        const writers = [], lines = [], shape = [];
        const baked = [];
        const res = genCustom(ast, P, A, TH, writers, lines, baked, shape);
        const np = natPlan(P, b.nat, A, { cut: TH });
        return {
          sig: [type, astSig(ast), b.nat ? JSON.stringify(b.nat) : 'lin', baked, pairBaked(ast), ...(shape.length ? [shape.join()] : [])], f: `${lines.join('\n').trimStart()}\n  return ${res};`, h: np ? np.h : LIN(P), own1: !!(np && np.own1), hc: np && np.hc, dom: np && np.dom,
          write(put) { const th = v.cut * DEG; put(cut.c, th, 0); for (const w of writers) w(put, th); if (np) np.write(put, b); },
        };
      }
    }
    return null;
  }

