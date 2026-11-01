// @ts-check
'use strict';
// The catalog's homotopies and natural paths (notes/ui-design/natural-paths.md), and the deformation caption's phrases
// for them: moved out of funcs.js (issue #20, the file-size budget), which takes these names back at the top of its
// closure (const { ... } = NatPaths), so Funcs and its callers read them as before. A closure of its own, as every
// module of src/ is, so that the test pages that inline the sources into one script see one name, NatPaths.
const NatPaths = (() => {
  const { C } = CX;
  const DEG = Math.PI / 180;
  const PI = Math.PI;
  const { taylorAt, ratOf, polyMul } = Derivs;

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
  // ---- homotopy phrases for the deformation caption (notes/ui-design/morph-figure.md 5) ----
  // homTex(v) -> {tex, mobius}: text with inline $math$ in the variable v; mobius: the paths are arcs of circles or
  // segments (the caption measures them before it says so). A Möbius path F^t (CX.mobPath) is named by its fixed points
  // and the branch of its multiplier, read off the path itself (the total turn of H_t'(p) over 0 <= t <= 1).
  // x i t in TeX, x a rational multiple of pi when it is one: 2\pi i t/3
  function piIt(x) {
    const r = x / Math.PI;
    for (let q = 1; q <= 12; q++) {
      const p = Math.round(r * q);
      if (p !== 0 && Math.abs(r * q - p) < 1e-9) return `${p < 0 ? '-' : ''}${Math.abs(p) === 1 ? '' : Math.abs(p)}\\pi i t${q === 1 ? '' : '/' + q}`;
    }
    return `${CX.texNum(x, 3)}\\,i t`;
  }
  function mobHomTex(m, v = 'z') {
    const path = CX.mobPath(m);
    if (!path) return null;
    const [a, b, c, d] = CX.mobScaled(m);
    const fx = CX.tex.bind(null);
    const T = (z) => fx(z, 3);
    let fixed;
    if (CX.isZero(c)) fixed = CX.abs(CX.sub(d, a)) < 1e-12 * (CX.abs(a) + CX.abs(d)) ? [null] : [CX.div(b, CX.sub(d, a)), null];
    else {
      const B = CX.sub(d, a), disc = CX.sqrt(CX.add(CX.mul(B, B), CX.scale(CX.mul(c, b), 4)));
      const z1 = CX.div(CX.sub(disc, B), CX.scale(c, 2)), z2 = CX.div(CX.neg(CX.add(disc, B)), CX.scale(c, 2));
      fixed = CX.abs(CX.sub(z1, z2)) < 1e-7 * (1 + CX.abs(z1)) ? [z1] : [z1, z2];
    }
    if (fixed.length === 1) {
      if (fixed[0] === null) { const tc = CX.div(b, d); return { tex: $t('the translations $H_t(%{v})=%{v}+tc$, $c=%{c}$', { v, c: T(tc) }), mobius: true }; }
      return { tex: $t('the parabolic Möbius transformations $H_t=F^t$ with fixed point $p=%{p}$', { p: T(fixed[0]) }), mobius: true };
    }
    const p = fixed[0], q = fixed[1];
    // H_t'(p) along the path, unwrapped: log H_1'(p) = ln k + i theta
    const dAt = (t) => { const M = path(t); const det = CX.sub(CX.mul(M[0], M[3]), CX.mul(M[1], M[2])); const den = CX.add(CX.mul(M[2], p), M[3]); return CX.div(det, CX.mul(den, den)); };
    let th = 0, prev = 0;
    for (let i = 1; i <= 400; i++) {
      const g = dAt(i / 400), an = Math.atan2(g.im, g.re);
      let da = an - prev;
      while (da > Math.PI) da -= 2 * Math.PI;
      while (da < -Math.PI) da += 2 * Math.PI;
      th += da; prev = an;
    }
    const lnk = Math.log(CX.abs(dAt(1)));
    const fixT = $t('fix $p=%{p}$ and %{q}', { p: T(p), q: q ? `$q=${T(q)}$` : '$\\infty$' });
    if (Math.abs(lnk) < 1e-9) return { tex: $t("the elliptic Möbius transformations $H_t$ that %{fixT}, with $H_t'(p)=e^{%{k}}$", { fixT, k: piIt(th) }), mobius: true };
    if (Math.abs(th) < 1e-9) return { tex: $t("the hyperbolic Möbius transformations $H_t$ that %{fixT}, with $H_t'(p)=k^t$, $k=%{k}$", { fixT, k: CX.texNum(Math.exp(lnk), 4) }), mobius: true };
    return { tex: $t("the loxodromic Möbius transformations $H_t$ that %{fixT}, with $H_t'(p)=e^{%{k}}$", { fixT, k: `${CX.texNum(lnk, 3)}t${th < 0 ? '-' : '+'}${piIt(Math.abs(th))}` }), mobius: true };
  }
  // the branch of a power homotopy, as words
  const branchWords = (cut, k) => (Math.abs(cut - 180) < 1e-9 && !k ? $t('principal branch') : $t('branch with the cut at $\\arg=%{cut}^\\circ$, sheet %{k}', { cut: CX.texNum(cut, 2), k }));
  // (v16.1 review user-1) a root's, power's or log's path while the Landscape draws it on every sheet (homTex's
  // o.sheets): no branch is named, since each surface takes its own
  const branchOr = (o, cut, k) => (o && o.sheets ? $t('on every sheet') : branchWords(cut, k));
  // z^{1 + (alpha - 1) t} with a real exponent: 1 + (n - 1) t written out
  function expoTex(al) {
    const s = al - 1;
    if (Math.abs(s) < 1e-12) return '1';
    const a = Math.abs(s), num = Math.abs(a - Math.round(a)) < 1e-12 ? (Math.round(a) === 1 ? '' : String(Math.round(a))) : CX.texNum(a, 4);
    return `1${s < 0 ? '-' : '+'}${num}t`;
  }

  // ---- natural paths (notes/ui-design/natural-paths.md) ----
  // Every natural path H_t is analytic in z for each t (off its cut), H_0 = id and H_1 = f exactly (the ends are the
  // identity and the map itself), and injective where f is. GLChain mirrors each one (glsl.js natPlan), with the same
  // small-argument series, so CPU and GPU agree. Zoom paths: f seen through a magnifier about a point p,
  //   H_t(z) = (1 − t) p + t f(p) + f′(p)^{t−1} (f(p + t(z − p)) − f(p)) / t,
  // so H_t → z as t → 0 (only the linear part at p is seen) and H_1 = f; the zeros, poles and cuts of f fly in from
  // infinity, radially about p, and none of them ever meet (they are images of distinct points under one similarity).
  const ends = (f, H) => (t) => (t <= 0 ? (z) => z : t >= 1 ? f : H(t));
  const HPI = PI / 2, ASH1 = Math.log(1 + Math.SQRT2), SQ2 = Math.SQRT2;
  // odd Taylor series a (1 + c3 a² + c5 a⁴ + …) for |a| < 0.1 (relative error < 1e-16): the inverse functions and
  // sin, tan, ... at the tiny arguments of the first frames, where their log / exp forms cancel
  const SER = {
    sin: [-1 / 6, 1 / 120, -1 / 5040, 1 / 362880, -1 / 39916800, 1 / 6227020800],
    sinh: [1 / 6, 1 / 120, 1 / 5040, 1 / 362880, 1 / 39916800, 1 / 6227020800],
    tan: [1 / 3, 2 / 15, 17 / 315, 62 / 2835, 1382 / 155925, 21844 / 6081075],
    tanh: [-1 / 3, 2 / 15, -17 / 315, 62 / 2835, -1382 / 155925, 21844 / 6081075],
    asin: [1 / 6, 3 / 40, 15 / 336, 105 / 3456, 945 / 42240, 10395 / 599040],
    asinh: [-1 / 6, 3 / 40, -15 / 336, 105 / 3456, -945 / 42240, 10395 / 599040],
    atan: [-1 / 3, 1 / 5, -1 / 7, 1 / 9, -1 / 11, 1 / 13],
    atanh: [1 / 3, 1 / 5, 1 / 7, 1 / 9, 1 / 11, 1 / 13],
  };
  const FN = { sin: CX.sin, sinh: CX.sinh, tan: CX.tan, tanh: CX.tanh, asin: CX.asin, asinh: CX.asinh, atan: CX.atan, atanh: CX.atanh };
  function serS(name, a) {
    if (a.re * a.re + a.im * a.im >= 0.01) return FN[name](a);
    const c = SER[name], a2 = CX.mul(a, a);
    let s = C(c[5], 0);
    for (let i = 4; i >= 0; i--) s = CX.add(C(c[i], 0), CX.mul(a2, s));
    return CX.add(a, CX.mul(a, CX.mul(a2, s)));
  }
  // log(1 + v), principal, without the cancellation of 1 + v for small v
  function log1pS(v) {
    if (v.re * v.re + v.im * v.im >= 0.01) return CX.log(CX.add(C(1, 0), v));
    let s = C(0, 0);
    for (let k = 14; k >= 1; k--) s = CX.add(C((k % 2 ? 1 : -1) / k, 0), CX.mul(v, s));
    return CX.mul(v, s);
  }
  const sc = CX.scale;
  // the zoom paths of the trigonometric functions and their inverses (p = 0 unless noted; f′(p) = 1 except arccos)
  const ZOOM = {
    sin: (t) => (z) => sc(serS('sin', sc(z, t)), 1 / t),
    sinh: (t) => (z) => sc(serS('sinh', sc(z, t)), 1 / t),
    tan: (t) => (z) => sc(serS('tan', sc(z, t)), 1 / t),
    tanh: (t) => (z) => sc(serS('tanh', sc(z, t)), 1 / t),
    // cos about p = π/2, where cos′ = −1 (cos(π/2 + e) = −sin e; principal (−1)^{t−1} = −e^{iπt}):
    // H_t = (1 − t)π/2 + e^{iπt} sin(t(z − π/2))/t. Its critical points π/2 ± π/(2t), … stay outside the strip
    // 0 < Re z < π (the strip arccos maps onto) for every t < 1, so that strip never folds
    cos: (t) => (z) => CX.add(C((1 - t) * HPI, 0), CX.mul(C(Math.cos(PI * t), Math.sin(PI * t)), sc(serS('sin', sc(CX.sub(z, C(HPI, 0)), t)), 1 / t))),
    // cosh about p = arsinh 1 (cosh′ p = 1, cosh p = √2): cosh(p + e) − cosh p = 2 sinh(p + e/2) sinh(e/2)
    cosh: (t) => (z) => {
      const h = sc(CX.sub(z, C(ASH1, 0)), t / 2);
      return CX.add(sc(CX.mul(CX.sinh(CX.add(C(ASH1, 0), h)), serS('sinh', h)), 2 / t), C((1 - t) * ASH1 + t * SQ2, 0));
    },
    arcsin: (t) => (z) => sc(serS('asin', sc(z, t)), 1 / t),
    arsinh: (t) => (z) => sc(serS('asinh', sc(z, t)), 1 / t),
    arctan: (t) => (z) => sc(serS('atan', sc(z, t)), 1 / t),
    artanh: (t) => (z) => sc(serS('atanh', sc(z, t)), 1 / t),
    // arccos about 0, where arccos′ = −1: H_t = tπ/2 + e^{iπt} arcsin(tz)/t (the principal (−1)^{t−1} = e^{iπ(t−1)})
    arccos: (t) => (z) => CX.add(C(t * HPI, 0), CX.mul(C(Math.cos(PI * t), Math.sin(PI * t)), sc(serS('asin', sc(z, t)), 1 / t))),
    // arcosh about q = √2 (arcosh′ √2 = 1, arcosh √2 = p): arcosh(q + d) − p = log(1 + v),
    // v = d (1 + (x + √2)/(s(x) + 1)) / (1 + √2), s(x) = √(x − 1) √(x + 1), x = q + d (s(√2) = 1, no cancellation)
    arcosh: (t) => (z) => {
      const d = sc(CX.sub(z, C(SQ2, 0)), t), x = CX.add(C(SQ2, 0), d);
      const s = CX.mul(CX.sqrt(CX.sub(x, C(1, 0))), CX.sqrt(CX.add(x, C(1, 0))));
      const den = CX.add(s, C(1, 0));
      const v = CX.abs(den) > 1e-3 ? sc(CX.mul(d, CX.add(C(1, 0), CX.div(CX.add(x, C(SQ2, 0)), den))), 1 / (1 + SQ2)) : CX.sub(sc(CX.add(x, s), 1 / (1 + SQ2)), C(1, 0));
      return CX.add(sc(log1pS(v), 1 / t), C((1 - t) * SQ2 + t * ASH1, 0));
    },
  };
  const ZOOM_TEX = {
    sin: (v) => $t('the zoom homotopy $H_t(%{v})=\\sin(t%{v})/t$', { v }),
    sinh: (v) => $t('the zoom homotopy $H_t(%{v})=\\sinh(t%{v})/t$', { v }),
    tan: (v) => $t('the zoom homotopy $H_t(%{v})=\\tan(t%{v})/t$', { v }),
    tanh: (v) => $t('the zoom homotopy $H_t(%{v})=\\tanh(t%{v})/t$', { v }),
    cos: (v) => $t("the zoom homotopy $H_t(%{v})=(1-t)\\pi/2+e^{\\pi i t}\\sin\\bigl(t(%{v}-\\pi/2)\\bigr)/t$ about $\\pi/2$, where $\\cos'=-1$ (principal power, so it turns by $\\pi$; the strip $0<\\operatorname{Re}%{v}<\\pi$ never folds)", { v }),
    cosh: (v, o) => { const p = nmOf(o).p; return $t("the zoom homotopy $H_t(%{v})=\\bigl(\\cosh(%{p}+t(%{v}-%{p}))-\\sqrt2\\bigr)/t+(1-t)%{p}+t\\sqrt2$ about $%{p}=\\operatorname{arsinh}1$, where $\\cosh'=1$", { v, p }); },
    arcsin: (v) => $t('the zoom homotopy $H_t(%{v})=\\arcsin(t%{v})/t$ (principal branch)', { v }),
    arsinh: (v) => $t('the zoom homotopy $H_t(%{v})=\\operatorname{arsinh}(t%{v})/t$ (principal branch)', { v }),
    arctan: (v) => $t('the zoom homotopy $H_t(%{v})=\\arctan(t%{v})/t$ (principal branch)', { v }),
    artanh: (v) => $t('the zoom homotopy $H_t(%{v})=\\operatorname{artanh}(t%{v})/t$ (principal branch)', { v }),
    arccos: (v) => $t('the zoom homotopy $H_t(%{v})=t\\pi/2+e^{\\pi i t}\\arcsin(t%{v})/t$ (principal branch)', { v }),
    arcosh: (v, o) => { const p = nmOf(o).p; return $t('the zoom homotopy $H_t(%{v})=\\bigl(\\operatorname{arcosh}(\\sqrt2+t(%{v}-\\sqrt2))-%{p}\\bigr)/t+(1-t)\\sqrt2+t%{p}$ about $\\sqrt2$, $%{p}=\\operatorname{arcosh}\\sqrt2$ (principal branch)', { v, p }); },
  };
  // Joukowski J = coth ∘ 2 ∘ arcoth (J = C⁻¹((Cz)²) with the Cayley map C(z) = (z − 1)/(z + 1), since C⁻¹(e^x) = −coth(x/2)):
  // H_t(z) = coth((1 + t) arcoth z), arcoth z = artanh(1/z), principal: the power homotopy u^{1+t} of u = Cz, cut on
  // [−1, 1]; the unit circle closes onto [−1, 1] as a lens of two circular arcs through ±1. The inverse Joukowski map
  // runs it backwards: coth((1 − t/2) arcoth z), and the interior branch turns by −πt/2 inside the coth (the
  // elliptic rotation u → −u of the Cayley plane, which is z → 1/z) so that H_1 = 1/(exterior) = tanh(arcoth(z)/2).
  const arcothS = (z) => serS('atanh', CX.inv(z));
  const cothX = (w) => CX.inv(serS('tanh', w));
  // Inside the unit disk (Cz in the left half-plane) the branch arg Cz ∈ (π/2, 3π/2) instead of the principal one, so
  // the path is continuous and injective on the disk too (J is): with arcoth z = artanh z − iπ/2 there and
  // coth(x − iπ/2) = tanh x, H_t(z) = tanh((1 + t) artanh z − iπt/2) for |z| < 1. One branch arg Cz ∈ (−π/2, 3π/2)
  // in all: its cut is the lower unit semicircle (between the disk and the exterior); the upper one closes onto [−1, 1].
  // joukAt(t, inside): the disk's formula (inside) or the exterior's, for every z (the landscape continues the branch
  // of a cell's centre across the circle: Sheets localCutHom)
  const joukAt = (t, inside) => (z) => (inside ? serS('tanh', CX.sub(sc(serS('atanh', z), 1 + t), C(0, HPI * t))) : cothX(sc(arcothS(z), 1 + t)));
  const joukHom = (t) => (z) => joukAt(t, z.re * z.re + z.im * z.im < 1)(z);
  const ijoukHom = (sg) => (t) => (z) => cothX(CX.sub(sc(arcothS(z), 1 - t / 2), C(0, sg < 0 ? HPI * t : 0)));
  // names in a caption phrase: o = {f, p, c, a} (all at once and in turn, several steps: f_k, p_k, ..., so that one
  // sentence never gives one letter two meanings)
  const nmOf = (o = {}) => ({ f: o.f || 'f', p: o.p || 'p', c: o.c || 'c', a: o.a || 'a' });
  // the Joukowski path as words (J_t; c·J: c^t J_t)
  const joukWords = (v) => $t('$C^{-1}\\bigl((C%{w})^{1+t}\\bigr)$ with $C(%{v})=\\frac{%{v}-1}{%{v}+1}$ and $\\arg C%{w}\\in(-\\pi/2,3\\pi/2)$: $\\coth\\bigl((1+t)\\operatorname{arcoth}%{w}\\bigr)$ outside the unit circle, $\\tanh\\bigl((1+t)\\operatorname{artanh}%{w}-\\pi i t/2\\bigr)$ inside (cut on the lower unit semicircle; the upper one closes onto $[-1,1]$)', { v, w: vTex(v) });
  const joukTex = (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=%{rest}', { v, rest: joukWords(v) }).replace(`=$C^{-1}`, `=C^{-1}`) });
  // the candidate centres of a zoom path: zeros by modulus, ties by argument
  function rootsOrder(roots) {
    const r = roots.slice();
    r.sort((p, q) => {
      const a = CX.abs(p), b = CX.abs(q);
      if (Math.abs(a - b) > 1e-9 * Math.max(1, a, b)) return a - b;
      return Math.atan2(p.im, p.re) - Math.atan2(q.im, q.re);
    });
    return r;
  }
  // A rational map P/Q (Q = [1]: a polynomial) by the zoom path about p. Near p (|e| < rN, e = t(z − p)) in the form
  //   H_t(z) = (1 − t) p + t f(p) + λ^t u N(e) Q(p) / Q(p + e),  u = z − p, λ = f′(p),
  // N(e) = (P(p + e) Q(p) − P(p) Q(p + e)) / (e (P′Q − PQ′)(p)) (N(0) = 1) by its Taylor coefficients at p, computed
  // once in double, so a tiny t never cancels; farther out (where those terms would cancel) directly,
  //   H_t(z) = (1 − t) p + t f(p) + λ^{t−1} (P(x)/Q(x) − f(p)) / t,  x = p + e.
  // rN = 1/(4 max_j |N_j|^{1/j}): the shifted terms shrink geometrically there. H_t is injective on every region
  // star-shaped about p where f is injective (p + t(R − p) ⊂ R), and the poles and critical points of H_t are
  // p + (q − p)/t for those q of f: they fly in from infinity along the rays from p and never meet.
  // The centre p: opts.cands first, in their order (the zeros-and-poles step passes its zeros as listed, exactly, so the
  // centre is ζ₁ and moves with it, and never jumps while another zero is dragged; f(p) = 0 exactly then);
  // otherwise the simple zeros by modulus, then 0, 1, −1, 2, −2, ½, −½, i, −i. For real coefficients (and no opts.cands)
  // a real centre with f′(p) > 0 comes first, then any real one: the path then commutes with conjugation.
  const FALLBACK = [C(0, 0), C(1, 0), C(-1, 0), C(2, 0), C(-2, 0), C(0.5, 0), C(-0.5, 0), C(0, 1), C(0, -1), C(1, 1), C(-1, -1)];
  function ratZoomData(P, Q, opts = {}) {
    P = CX.polyTrim(P); Q = CX.polyTrim(Q);
    const dp = P.length - 1, dq = Q.length - 1;
    if ((dp === 0 && CX.isZero(P[0])) || Math.max(dp, dq) < 1 || (dq === 0 && CX.isZero(Q[0]))) return null;
    const M = Math.max(dp, dq);
    const sP = P.reduce((m, c) => Math.max(m, CX.abs(c)), 0), sQ = Q.reduce((m, c) => Math.max(m, CX.abs(c)), 0);
    const real = !opts.cands && P.every((c) => c.im === 0) && Q.every((c) => c.im === 0);
    let cands;
    if (opts.cands) cands = opts.cands.map((p) => ({ p, zero: !!opts.zeros }));
    else {
      let zs = dp >= 1 ? rootsOrder(CX.polyRoots(P)).filter(CX.isFin) : [];
      if (real) zs = zs.map((r) => (Math.abs(r.im) <= 1e-9 * (1 + Math.abs(r.re)) ? C(r.re, 0) : r));
      cands = zs.map((p) => ({ p, zero: false }));
    }
    cands.push(...FALLBACK.map((p) => ({ p, zero: false })));
    const at = ({ p, zero }) => {
      const tp = taylorAt(P, p).t, tq = taylorAt(Q, p).t;
      if (zero) tp[0] = C(0, 0);
      const q0 = tq[0];
      if (!(CX.abs(q0) > 1e-6 * sQ * Math.max(1, Math.pow(CX.abs(p), dq)))) return null;
      const n = [];
      for (let j = 0; j <= M; j++) n.push(CX.sub(CX.mul(j <= dp ? tp[j] : C(0, 0), q0), CX.mul(tp[0], j <= dq ? tq[j] : C(0, 0))));
      const n1 = n[1];
      if (!(CX.abs(n1) > 1e-9 * Math.max(1e-300, sP * sQ) * Math.max(1, Math.pow(CX.abs(p), M)))) return null;
      const lam = CX.div(n1, CX.mul(q0, q0));
      if (!CX.isFin(lam) || CX.isZero(lam)) return null;
      // coefficients highest first for Horner
      const N = []; for (let j = M; j >= 1; j--) N.push(CX.div(n[j], n1));
      let mx = 0;
      for (let j = 2; j <= M; j++) mx = Math.max(mx, Math.pow(CX.abs(CX.div(n[j], n1)), 1 / (j - 1)));
      const rN = mx > 0 ? 0.25 / mx : Infinity;
      // (n1 and p0 = P(p), 0 at an exact zero: for the GPU's divided-difference form of the same N above degree 24)
      return { p, fp: CX.div(tp[0], q0), ll: CX.log(lam), lam, N, rN, P, Q, q0, n1, p0: tp[0], zero };
    };
    if (real) {
      for (const pass of [0, 1]) {
        for (const c of cands) {
          if (c.p.im !== 0) continue;
          const d = at(c);
          // (a real centre where f(p)/f′(p) is huge, as for 0.001z² + 1000 at 1, would cancel in the GPU's
          // float32 far form: then the zeros, f(p) = 0, come first after all)
          if (d && (pass || d.lam.re > 0) && CX.abs(d.fp) <= 100 * CX.abs(d.lam) * (1 + CX.abs(d.p))) return d;
        }
      }
    }
    for (const c of cands) { const d = at(c); if (d) return d; }
    return null;
  }
  function ratZoomAt(d, t, z) {
    const u = CX.sub(z, d.p), e = sc(u, t), x = CX.add(d.p, e);
    const c = CX.add(sc(d.p, 1 - t), sc(d.fp, t)), Qx = CX.polyEval(d.Q, x);
    if (CX.abs(e) < d.rN) return CX.add(c, CX.mul(CX.exp(sc(d.ll, t)), CX.div(CX.mul(CX.mul(u, CX.polyEval(d.N, e)), d.q0), Qx)));
    return CX.add(c, sc(CX.mul(CX.exp(sc(d.ll, t - 1)), CX.sub(CX.div(CX.polyEval(d.P, x), Qx), d.fp)), 1 / t));
  }
  const vTex = (v) => (v.length > 1 ? `(${v})` : v);
  // the zoom path's caption (opts.zp: the zeros-and-poles step, whose centre is c, p naming its poles)
  function zoomTex(d, poly, opts = {}) {
    return (v = 'z', o) => {
      const n = nmOf(o), p = opts.zp ? n.c : n.p, f = n.f;
      const where = d.zero ? $t(', a zero of $%{f}$', { f }) : '';
      const fly = poly ? $t('the critical points of $%{f}$ fly in from infinity along the rays from $%{p}$', { f, p }) : $t('the poles and critical points of $%{f}$ fly in from infinity along the rays from $%{p}$ (each $q$ at $%{p}+(q-%{p})/t$) and never meet', { f, p });
      return { tex: $t("the zoom homotopy $H_t(%{v})=(1-t)%{p}+t%{f}(%{p})+%{f}'(%{p})^{t-1}\\bigl(%{f}(%{p}+t(%{v}-%{p}))-%{f}(%{p})\\bigr)/t$ about $%{p}=%{c}$%{where} (principal power): %{fly}", { v, p, f, c: CX.tex(d.p, 3), where, fly }) };
    };
  }
  // a (z − c)^n (n ≥ 2) from its coefficients (highest first): {a, c, n} or null
  function monomialOf(P) {
    const n = P.length - 1;
    if (n < 2 || CX.isZero(P[0])) return null;
    const a = P[0], c = CX.neg(CX.div(P[1], CX.scale(a, n)));
    let bin = 1, pw = C(1, 0), err = 0, sc0 = 0;
    for (let k = 0; k <= n; k++) {
      const ex = CX.scale(CX.mul(a, pw), bin);
      err = Math.max(err, CX.abs(CX.sub(P[k], ex))); sc0 = Math.max(sc0, CX.abs(ex), CX.abs(P[k]));
      pw = CX.mul(pw, CX.neg(c)); bin = (bin * (n - k)) / (k + 1);
    }
    return err <= 1e-12 * sc0 ? { a, c, n } : null;
  }
  // the power path of a (z − c)^n, as the z^n step: H_t(z) = (1 − t) c + a^t (z − c)^{1+(n−1)t} (principal a^t and power)
  function powPath({ a, c, n }, f) {
    const la = CX.log(a), one = CX.eq(a, C(1, 0), 0), c0 = CX.isZero(c);
    return {
      hom: ends(f, (t) => (z) => CX.add(sc(c, 1 - t), CX.mul(CX.exp(sc(la, t)), CX.pow(CX.sub(z, c), C(1 + (n - 1) * t, 0), PI, 0)))),
      nat: { kind: 'pow' }, natData: { la, c, n },
      homTex: (v = 'z', o) => {
        const nm = nmOf(o), base = c0 ? v : `(${v}-${nm.c})`;
        const lead = c0 ? '' : `(1-t)${nm.c}+`;
        const parts = [one ? '' : `$${nm.a}=${CX.tex(a, 3)}$`, c0 ? '' : `$${nm.c}=${CX.tex(c, 3)}$`].filter(Boolean).join(', ');
        return { tex: $t('the power homotopy $H_t(%{v})=%{lead}%{at}%{base}^{%{e}}$%{parts} (principal branch)', { v, lead, at: one ? '' : `${nm.a}^t`, base, e: expoTex(n), parts: parts ? ', ' + parts : '' }) };
      },
    };
  }
  // c J(z) = c (z² + 1)/(2z) from P/Q (dp = 2, dq = 1): c or null
  function joukOf(P, Q) {
    const s = Math.max(...P.map(CX.abs), ...Q.map(CX.abs));
    if (CX.abs(Q[1]) > 1e-14 * s || CX.abs(P[1]) > 1e-12 * s || CX.abs(CX.sub(P[0], P[2])) > 1e-12 * s) return null;
    return CX.div(CX.add(P[0], P[2]), Q[0]);
  }
  // The natural path of a rational map P/Q (coefficients, highest first; Q constant: a polynomial), by what it is, so that
  // equal maps deform alike however they were entered: degree 1, the Möbius one-parameter group (as the affine and
  // Möbius steps); a (z − c)^n, the power path (as z^n); c J, the Joukowski path times c^t; otherwise the zoom path.
  // {hom, homTex, nat, natData} or null (a constant). opts: ratZoomData's, and mono ({a, c, n}: known exactly)
  function ratPath(P, Q, f, opts = {}) {
    P = CX.polyTrim(P); Q = CX.polyTrim(Q);
    if ((Q.length === 1 && CX.isZero(Q[0])) || (P.length === 1 && CX.isZero(P[0]))) return null;
    if (Q.length === 1) { P = P.map((c) => CX.div(c, Q[0])); Q = [C(1, 0)]; }
    const dp = P.length - 1, dq = Q.length - 1;
    if (dp === 0 && dq === 0) return null;
    if (dp <= 1 && dq <= 1) {
      const m = [dp ? P[0] : C(0, 0), P[dp], dq ? Q[0] : C(0, 0), Q[dq]];
      const h = mobHom(m);
      if (!h) return null;
      return { hom: ends(f, h), homTex: (v = 'z') => mobHomTex(m, v), nat: { kind: 'mob' }, natData: { m } };
    }
    if (dq === 0) {
      const mo = opts.mono || monomialOf(P);
      if (mo) return powPath(mo, f);
    }
    const cj = dp === 2 && dq === 1 ? joukOf(P, Q) : null;
    if (cj && CX.isFin(cj) && !CX.isZero(cj)) {
      const lc = CX.log(cj), one = CX.eq(cj, C(1, 0), 1e-15);
      return {
        hom: ends(f, (t) => { const J = joukHom(t), k = CX.exp(sc(lc, t)); return (z) => CX.mul(k, J(z)); }),
        nat: { kind: 'jouk', scaled: true }, natData: { lc },
        homTex: one ? joukTex : (v = 'z', o) => ({ tex: $t('the homotopy $H_t(%{v})=%{o}^tJ_t(%{v})$, $%{o}=%{cj}$ (principal power), where $J_t(%{v})=%{rest}', { v, o: nmOf(o).c, cj: CX.tex(cj, 3), rest: joukWords(v).slice(1) }) }),
      };
    }
    const d = ratZoomData(P, Q, opts);
    if (!d) return null;
    return { hom: ends(f, (t) => (z) => ratZoomAt(d, t, z)), nat: { kind: 'ratzoom', dp, dq }, natData: d, homTex: zoomTex(d, dq === 0, opts) };
  }
  // a rational map given by numerator and denominator (kept for callers): ratPath
  const rationalNat = (P, Q, f) => ratPath(P, Q, f);
  const polyNat = (co, f) => ratPath(co, [C(1, 0)], f);
  // the exponential's zoom path about 0 (exp′ 0 = 1) and the logarithm's, the reverse family
  const expHom = (t) => {
    if (t < 1e-6) return (z) => z;
    return (z) => CX.add(CX.scale(CX.sub(CX.exp(CX.scale(z, t)), C(1, 0)), 1 / t), C(t, 0));
  };
  const expHomTex = (v = 'z') => ({ tex: $t('the zoom homotopy $H_t(%{v})=(e^{t%{v}}-1)/t+t$ for $0<t\\le 1$, $H_0(%{v})=%{v}$', { v }) });
  const logHom = (th, k) => (t) => {
    if (t <= 0) return (z) => z;
    const u = 1 - t;
    if (u < 1e-6) return (z) => CX.log(z, th, k);
    return (z) => CX.add(CX.scale(CX.sub(CX.powReal(z, u, th, k), C(1, 0)), 1 / u), C(u, 0));
  };
  const logHomTex = (cut, k) => (v = 'z', o) => ({ tex: $t('the homotopy $H_t(%{v})=(%{v}^{1-t}-1)/(1-t)+1-t$ for $0\\le t<1$, $H_1(%{v})=\\log %{v}$ (%{cut})', { v, cut: branchOr(o, cut, k) }) });
  // The zoom path of any other analytic formula, about a point p where f is analytic with f′(p) ≠ 0 (f′ from Expr.diff):
  //   H_t(z) = (1 − t) p + t f(p) + f′(p)^{t−1} (f(p + t(z − p)) − f(p)) / t   (principal power),
  // and below t₀ ≥ 10⁻³ (where f(x) − f(p) would cancel in float32 on the GPU) the blend z + (t/t₀)(H_{t₀}(z) − z),
  // still analytic in z. p: the first of 0, 1, −1, 2, … with no cut through it; a real map (f(z̄) = conj f(z) at
  // probes) gets a real centre, f′(p) > 0 first, so that the path commutes with conjugation. GLChain inlines f there.
  const GZ_T0 = 1e-3;
  // The multivalued pieces of a formula, as {kind, w} with w its operand compiled: the logarithm, roots and non-integer
  // powers on the formula's cut θ ('theta'), the inverse trigonometric and hyperbolic functions on their principal cuts.
  // A zoom centre must lie off every one of these cuts, not only where f is analytic: where two cuts cancel
  // (√(z−1)·√(z+1) on (1, ∞) with the cut at 0°) f is analytic, but f(p + t(z − p)) for a tiny t is decided by
  // which side of each cut a point within float32 rounding of p falls, and the GPU then puts the factors on
  // different sides (−√3 for √3: H_t off by 2√3/t).
  const FIXED_CUT = { asin: 'real', acos: 'real', atanh: 'real', acosh: 'acosh', atan: 'imag', asinh: 'imag' };
  function cutOperands(ast, theta) {
    const out = [];
    const walk = (n) => {
      if (!n || !Expr.depends(n)) return;
      let kind = null;
      if (n.t === 'pow') {
        if (!Expr.depends(n.b)) {
          const v = Expr.compile(n.b)(C(0, 0));
          if (!(v.im === 0 && Number.isInteger(v.re) && Math.abs(v.re) <= 4096)) kind = 'theta';
        } else if (Expr.depends(n.a)) kind = 'theta';
      } else if (n.t === 'root') kind = 'theta';
      else if (n.t === 'call') kind = n.f === 'log' || n.f === 'sqrt' ? 'theta' : FIXED_CUT[n.f] || null;
      if (kind) out.push({ kind, w: Expr.compile(n.a, { theta }) });
      for (const k of ['a', 'b', 'n']) if (n[k]) walk(n[k]);
    };
    walk(ast);
    return out;
  }
  // p is at least 10⁻³ (in angle, or relative to 1 + |w|) away from every cut of cutOperands, and off the branch points
  function offCuts(ops, theta, p) {
    for (const { kind, w } of ops) {
      const v = w(p);
      if (!CX.isFin(v)) return false;
      const r = CX.abs(v), x = v.re, y = v.im;
      if (kind === 'theta') {
        const d = Math.abs((((Math.atan2(y, x) - theta) % (2 * PI)) + 2 * PI) % (2 * PI));
        if (!(r > 0) || Math.min(d, 2 * PI - d) < 1e-3) return false;
        continue;
      }
      const ax = Math.abs(x), ay = Math.abs(y);
      const dist = kind === 'real' ? (ax >= 1 ? ay : Math.hypot(ax - 1, y))
        : kind === 'imag' ? (ay >= 1 ? ax : Math.hypot(x, ay - 1))
          : (x <= 1 ? ay : Math.hypot(x - 1, y)); // acosh: (−∞, 1]
      if (!(dist >= 1e-3 * (1 + r))) return false;
    }
    return true;
  }
  function genericZoomNat(ast, f, cut) {
    let df, ops;
    try { df = Expr.compile(Expr.diff(ast, { theta: cut * DEG }), { theta: cut * DEG }); ops = cutOperands(ast, cut * DEG); } catch (e) { return null; }
    const probes = [C(0.37, 0.81), C(-1.3, 0.6), C(2.1, 1.7), C(0.45, -2.2)];
    const real = probes.every((q) => { const a = f(CX.conj(q)), b = f(q); return CX.isFin(a) && CX.isFin(b) && CX.abs(CX.sub(a, CX.conj(b))) <= 1e-9 * (1 + CX.abs(b)); });
    const at = (p) => {
      if (!offCuts(ops, cut * DEG, p)) return null;
      let fp = f(p), lam = df(p);
      if (!CX.isFin(fp) || !CX.isFin(lam) || !(CX.abs(lam) > 1e-6) || !(CX.abs(lam) < 1e6) || CX.abs(fp) > 1e12) return null;
      // analytic about p (no cut through it): f(p + u) ≈ f(p) + λu around a small circle
      const dl = 1e-4 * (1 + CX.abs(p));
      for (let k = 0; k < 8; k++) {
        const u = C(Math.cos((k * PI) / 4) * dl, Math.sin((k * PI) / 4) * dl), w = f(CX.add(p, u));
        if (!CX.isFin(w) || CX.abs(CX.sub(CX.sub(w, fp), CX.mul(lam, u))) > 0.1 * CX.abs(lam) * dl) return null;
      }
      if (real && p.im === 0) { fp = C(fp.re, 0); lam = C(lam.re, 0); }
      return { p, fp, lam };
    };
    let d = null;
    if (real) {
      for (const pass of [0, 1]) {
        for (const p of FALLBACK) {
          if (p.im !== 0) continue;
          const r = at(p);
          if (r && (pass || r.lam.re > 0)) { d = r; break; }
        }
        if (d) break;
      }
    }
    if (!d) for (const p of FALLBACK) { d = at(p); if (d) break; }
    if (!d) return null;
    const { p, fp } = d, ll = CX.log(d.lam), al = CX.abs(d.lam);
    // t₀: from where the GPU's float32 f(x) − f(p) (and x = p + t(z − p)) keeps H_t within 10⁻⁴(1 + |p|):
    // ε₃₂ (|f(p)| + |λ||p|) |λ|^{t−1}/t; none below ½ (z^{1/4096}: f(p)/λ = 4096 cancels too much): the straight line
    const err = (t) => 6e-8 * (CX.abs(fp) + al * CX.abs(p)) * Math.pow(al, t - 1) / t, tol = 1e-4 * (1 + CX.abs(p));
    let t0 = GZ_T0;
    while (t0 < 0.5 && err(t0) > tol) t0 *= 1.25;
    if (err(t0) > tol) return null;
    const Ht = (t) => (z) => CX.add(CX.add(sc(p, 1 - t), sc(fp, t)), sc(CX.mul(CX.exp(sc(ll, t - 1)), CX.sub(f(CX.add(p, sc(CX.sub(z, p), t))), fp)), 1 / t));
    const H = (t) => {
      if (t >= t0) return Ht(t);
      const h0 = Ht(t0), s = t / t0;
      return (z) => CX.add(z, sc(CX.sub(h0(z), z), s));
    };
    return {
      hom: ends(f, H), nat: { kind: 'gzoom' }, natData: { p, fp, ll, t0 },
      homTex: (v = 'z', o) => {
        const { f: F, p: q } = nmOf(o);
        return { tex: $t("the zoom homotopy $H_t(%{v})=(1-t)%{q}+t%{F}(%{q})+%{F}'(%{q})^{t-1}\\bigl(%{F}(%{q}+t(%{v}-%{q}))-%{F}(%{q})\\bigr)/t$ about $%{q}=%{p}$ (principal power; below $t=%{t0}$, linear in $t$): the singularities and cuts of $%{F}$ fly in from infinity along the rays from $%{q}$", { v, q, F, p: CX.tex(p, 3), t0: CX.texNum(t0, 2) }) };
      },
    };
  }
  // A custom formula's natural path: a catalog map applied to z itself (its own path), e^z, log z (on the formula's
  // cut, sheet 0), a rational expression (ratPath: by what it is, as the catalog steps), and otherwise, when analytic,
  // the generic zoom path. null: not analytic, or a constant (the straight line). {hom, homTex, nat, natData}
  const CUSTOM_ZOOM = { sin: 'sin', cos: 'cos', tan: 'tan', sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', asin: 'arcsin', acos: 'arccos', atan: 'arctan', asinh: 'arsinh', acosh: 'arcosh', atanh: 'artanh' };
  function customNat(ast, f, cut, analytic) {
    const isZ = (n) => !!n && n.t === 'var' && n.n === 'z';
    if (ast.t === 'call' && isZ(ast.a) && CUSTOM_ZOOM[ast.f]) {
      const id = CUSTOM_ZOOM[ast.f];
      return { hom: ends(f, ZOOM[id]), homTex: (v = 'z', o) => ({ tex: ZOOM_TEX[id](v, o) }), nat: { kind: 'zoom', fn: id } };
    }
    if ((ast.t === 'call' && ast.f === 'exp' && isZ(ast.a)) || (ast.t === 'pow' && ast.a.t === 'num' && ast.a.v.re === Math.E && ast.a.v.im === 0 && isZ(ast.b))) {
      return { hom: ends(f, expHom), homTex: expHomTex, nat: { kind: 'exp' } };
    }
    if (ast.t === 'call' && ast.f === 'log' && isZ(ast.a)) return { hom: ends(f, logHom(cut * DEG, 0)), homTex: logHomTex(cut, 0), nat: { kind: 'log' } };
    const pq = ratOf(ast);
    if (pq) return ratPath(pq[0], pq[1], f);
    return analytic ? genericZoomNat(ast, f, cut) : null;
  }
  // A map given by its zeros and poles, f(z) = a ∏ (z − ζ_k) / ∏ (z − p_j) (the step that drags them): ratPath of the
  // expanded numerator and denominator, with the exact zeros as the zoom centres in their listed order (so the centre
  // is ζ₁ itself, f(c) = 0 exactly, and it moves continuously with ζ₁ and stays put while the others are dragged), and
  // the power path when every zero is the same point and there is no pole. null: a = 0, or a constant.
  function zerosPolesNat(a, zeros, poles, f) {
    if (!CX.isFin(a) || CX.isZero(a) || (!zeros.length && !poles.length)) return null;
    const expand = (rs) => rs.reduce((co, r) => polyMul(co, [C(1, 0), CX.neg(r)]), [C(1, 0)]);
    const same = zeros.length >= 2 && !poles.length && zeros.every((z) => z.re === zeros[0].re && z.im === zeros[0].im);
    return ratPath(expand(zeros).map((c) => CX.mul(c, a)), expand(poles), f, { cands: zeros, zeros: true, zp: true, mono: same ? { a, c: zeros[0], n: zeros.length } : null });
  }
  // the data GLChain writes for a natural path (null: the straight line)
  function natData(b) { return b && b.natData ? b.natData : null; }


  return { mobHom, mobHomTex, linHom, powHom, expHom, expHomTex, logHom, logHomTex, joukAt, joukHom, ijoukHom, joukTex, vTex, expoTex, branchOr, ends, sc, ZOOM, ZOOM_TEX, natData, genericZoomNat, customNat, polyNat, ratPath, ratZoomAt, ratZoomData, rationalNat, monomialOf, zerosPolesNat };
})();
import { CX } from './cx.js';
import { Expr } from './parse.js';
import { Derivs } from './derivs.js';
export { NatPaths };
