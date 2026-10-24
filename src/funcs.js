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
  const fmtDeg = (x) => I18N.num(String(+x.toFixed(1)).replace('-', '−'));
  // a half-open interval of angles, (a°, b°]; in Russian a semicolon when an end has a decimal comma (GLOSSARY 2.3)
  const degIv = (a, b) => { const x = fmtDeg(a), y = fmtDeg(b); return `(${x}°${I18N.lang === 'ru' && /,/.test(x + y) ? '; ' : ', '}${y}°]`; };

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
  const joukHom = (t) => (z) => (z.re * z.re + z.im * z.im < 1 ? serS('tanh', CX.sub(sc(serS('atanh', z), 1 + t), C(0, HPI * t))) : cothX(sc(arcothS(z), 1 + t)));
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
  const logHomTex = (cut, k) => (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=(%{v}^{1-t}-1)/(1-t)+1-t$ for $0\\le t<1$, $H_1(%{v})=\\log %{v}$ (%{cut})', { v, cut: branchWords(cut, k) }) });
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

  // ---- parameter helpers ----
  const cutParams = [
    { key: 'cut', label: $t('cut angle'), type: 'angle', def: 180 },
    { key: 'k', label: $t('sheet'), type: 'int', def: 0 },
  ];
  // a list field's items, read by one rule in both languages, so saved work survives a language switch (review
  // math-1, verify-1; GLOSSARY 2.3: lists of decimals take «;»): with a ';' outside brackets the items are split on
  // ';' and a comma between two digits is a decimal comma (0,5; -1 is 0.5 and -1); without one, on commas as before.
  // Only text typed into the field in the Russian interface is checked further (typedList): there a comma between two
  // digits with no ';' (0,5, -1) is refused with the hint, never read silently as two items.
  const RU_LIST = () => typeof I18N !== 'undefined' && I18N.lang === 'ru';
  // the list texts with a comma between two digits and no ';' that the user typed into a step's field in Russian
  // (step -> {key: Set of texts}); a saved or switched text is not in it, so it is read by the common rule. An undo
  // carries a step's set to the step restored at its place (typedKeep), so a refused text never comes back unchecked
  const typedLists = new WeakMap();
  const refusable = (s) => splitAt(s, ';').length < 2 && /\d,\d/.test(s);
  function typedList(step, key, text) {
    const s = String(text ?? '');
    if (!RU_LIST() || !step || typeof step !== 'object' || !refusable(s)) return;
    const m = typedLists.get(step) || {};
    (m[key] = m[key] || new Set()).add(s);
    typedLists.set(step, m);
  }
  function typedKeep(from, to) {
    if (!RU_LIST() || !Array.isArray(from) || !Array.isArray(to)) return;
    from.forEach((a, i) => { const m = a && typedLists.get(a), b = to[i]; if (m && b && typeof b === 'object' && b.type === a.type) typedLists.set(b, m); });
  }
  const typedHere = (step, key, raw) => RU_LIST() && !!step && !!((typedLists.get(step) || {})[key] || { has: () => false }).has(String(raw ?? ''));
  function splitAt(str, sep) {
    const parts = [];
    let depth = 0, cur = '';
    for (const ch of String(str ?? '')) {
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth--;
      if (ch === sep && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
    }
    parts.push(cur);
    return parts;
  }
  function listParts(str) {
    const semi = splitAt(str, ';');
    return semi.length > 1 ? semi.map((s) => s.replace(/(\d),(?=\d)/g, '$1.')) : splitAt(str, ',');
  }
  function listComma(str, typed) {
    if (typed && refusable(String(str ?? ''))) throw new Error($t('Use a decimal point: 0.5; separate the values with a comma and a space, or with ;'));
  }
  function parseCoeffs(str, typed) {
    // split on commas outside brackets (or on ';': listParts)
    listComma(str, typed);
    const parts = listParts(str);
    const trimmed = parts.map((s) => s.trim());
    if (trimmed.length > 1 && trimmed.some((s) => !s.length)) throw new Error($t('A coefficient is missing between two commas'));
    const co = trimmed.filter((s) => s.length).map((s) => Expr.constValue(s));
    if (!co.length) throw new Error($t('Enter at least one coefficient'));
    return co;
  }
  // ---- zeros and poles (the 'zp' step) ----
  // a list of complex values as typed (commas outside brackets; empty items dropped): the raw item strings
  function splitList(str) {
    return listParts(str).map((s) => s.trim()).filter((s) => s.length);
  }
  // at most 24 zeros and 24 poles (degree 24, as Write by zeros and poles allows; past it a drag misses 60 fps)
  const ZP_MAX = 24;
  function parseCxList(str, typed) {
    listComma(str, typed);
    return splitList(str).map((s, i) => {
      let v;
      try { v = Expr.constValue(s); } catch (e) { throw new Error($t('value {i}: {msg}', { i: i + 1, msg: e.message })); }
      if (!CX.isFin(v)) throw new Error($t('value {i} is not a finite number', { i: i + 1 }));
      return v;
    });
  }
  // a value as a list item: the exact shortest decimal, no spaces (parses back to exactly v)
  const zpItem = (v) => CX.fmtExact(C(v.re === 0 ? 0 : v.re, v.im === 0 ? 0 : v.im)).replace(/\s+/g, '');
  // a zero and a pole at exactly the same point cancel (a removable singularity, filled in): what is left
  function zpCancel(zeros, poles) {
    const zs = zeros.slice(), ps = [], gone = [];
    for (const p of poles) {
      const i = zs.findIndex((z) => z.re === p.re && z.im === p.im);
      if (i >= 0) { gone.push(zs.splice(i, 1)[0]); } else ps.push(p);
    }
    return { zs, ps, gone };
  }
  // a ∏ (z − r) expanded (coefficients, highest degree first)
  const zpExpand = (a, rs) => rs.reduce((co, r) => polyMul(co, [C(1, 0), CX.neg(r)]), [a]);
  // the factored TeX: a ∏ (x − ζ_k)^{m} / ∏ (x − p_j)^{m} (equal values as powers, the factor x first)
  function zpFactors(list, x) {
    const groups = [];
    for (const r of list) {
      const g = groups.find((q) => q.r.re === r.re && q.r.im === r.im);
      if (g) g.m++; else groups.push({ r, m: 1 });
    }
    groups.sort((p, q) => CX.isZero(q.r) - CX.isZero(p.r));
    return groups.map(({ r, m }) => {
      // x − r term by term: z − 1 − i, z + 0.5i (never z − (1 + i))
      let t = x.s;
      for (const part of [C(-r.re, 0), C(0, -r.im)]) {
        if (CX.isZero(part)) continue;
        const ps = CX.tex(part);
        t += compoundTex(ps) ? `+${paren(ps)}` : ps.startsWith('-') ? ps : `+${ps}`;
      }
      const base = CX.isZero(r) ? x : { s: t, p: 0 };
      return m === 1 ? base : powTex(base, m);
    });
  }
  function zpProd(fs, alone) {
    if (!fs.length) return null;
    if (fs.length === 1 && alone) return fs[0];
    return { s: fs.map((f) => (f.p >= 3 ? f.s : paren(f.s))).join(''), p: 3 };
  }
  function zpTex(a, zs, ps, x) {
    if (!zs.length && !ps.length) { const s = CX.tex(a); return { s, p: compoundTex(s) ? 0 : 4 }; }
    const num = zpProd(zpFactors(zs, x), true), den = zpProd(zpFactors(ps, x), true);
    const body = den ? { s: `\\frac{${num ? num.s : '1'}}{${den.s}}`, p: 4 } : num;
    return mulTex(a, body);
  }
  // Funcs.toZerosPoles(step): a polynomial or rational step (or a custom rational formula) as a 'zp' step, by the
  // roots of its numerator and denominator (computed numerically, rounded to 12 digits where that keeps the map to
  // 1e-9): {step, note} or {error}. Funcs.fromZerosPoles(step): a 'zp' step expanded into a polynomial or rational
  // step (exact coefficients of the expansion): {step} or {error}.
  function toZerosPoles(step) {
    const b = build(step);
    if (b.error) return { error: b.error };
    let P, Q;
    const v = b.vals, id = b.def.id;
    if (id === 'poly') { P = CX.polyTrim(v.co); Q = [C(1, 0)]; }
    else if (id === 'rational') { P = CX.polyTrim(v.p); Q = CX.polyTrim(v.q); }
    else if (id === 'custom') {
      let pq = null;
      try { const ast = Expr.parse(v.expr); if (Expr.classify(ast).rational) pq = ratOf(ast); } catch (e) { pq = null; }
      if (!pq) return { error: $t('Only a polynomial or a rational formula can be written by its zeros and poles') };
      [P, Q] = pq;
    } else return { error: $t('{label} is not a polynomial or a rational map', { label: b.def.label }) };
    if (P.every(CX.isZero)) return { error: $t('The zero function has no zeros or poles to drag') };
    if (P.length > ZP_MAX + 1 || Q.length > ZP_MAX + 1) return { error: $t('Degree above {max}: too many zeros and poles to drag', { max: ZP_MAX }) };
    const a = CX.div(P[0], Q[0]);
    const clean = (r) => {
      const s = 1e-12 * Math.max(1, CX.abs(r));
      return C(Math.abs(r.re) < s ? 0 : +r.re.toPrecision(12), Math.abs(r.im) < s ? 0 : +r.im.toPrecision(12));
    };
    const roots = (co) => (co.length > 1 ? CX.polyRoots(co) : []);
    const raw = [roots(P), roots(Q)];
    if (!raw.every((l) => l.every(CX.isFin))) return { error: $t('The roots could not be computed') };
    const tidy = raw.map((l) => l.map(clean));
    const ok = (zs, ps) => {
      const f = (z) => { let n = a; for (const r of zs) n = CX.mul(n, CX.sub(z, r)); let d = C(1, 0); for (const r of ps) d = CX.mul(d, CX.sub(z, r)); return CX.div(n, d); };
      return [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2)].every((z) => { const g = b.f(z), h = f(z); return !CX.isFin(g) || CX.abs(CX.sub(g, h)) <= 1e-9 * (1 + CX.abs(g)); });
    };
    const [zs, ps] = ok(tidy[0], tidy[1]) ? tidy : raw;
    const params = { a: zpItem(clean(a)), zeros: zs.map(zpItem).join(', '), poles: ps.map(zpItem).join(', ') };
    if (!ok(zs, ps)) return { error: $t('The zeros and poles found do not reproduce this map (its roots are too clustered)') };
    return { step: { type: 'zp', params }, note: `${$tn('{n} zero', '{n} zeros', zs.length)}, ${$tn('{n} pole', '{n} poles', ps.length)}` };
  }
  function fromZerosPoles(step) {
    const b = build(step);
    if (b.error) return { error: b.error };
    if (b.def.id !== 'zp') return { error: $t('Not a zeros-and-poles step') };
    const { P, Q } = b.zp;
    const co = (l) => l.map(fmtC).join(', ');
    if (Q.length === 1) return { step: { type: 'poly', params: { co: co(P.map((c) => CX.div(c, Q[0]))) } } };
    return { step: { type: 'rational', params: { p: co(P), q: co(Q) } } };
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
  const NOTE_CONST = $t('This map is constant, so it has no inverse');
  const times = (d) => (d === 2 ? $t('twice') : $tn('{n} times', '{n} times', d));
  const NOTE_PRE = $t('use the Preimage view to see every solution of f(z) = w');
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
    return { inverse: null, inverseNote: $t('A polynomial of degree {d} takes most values {times}, so it has no single inverse; {note}', { d, times: times(d), note: NOTE_PRE }) };
  }
  function rationalInverse(p, q, P) {
    if (P.constant) return { inverse: null, inverseNote: NOTE_CONST };
    if (P.mobius) {
      const two = (co) => (co.length === 1 ? [C(0, 0), co[0]] : co);
      const [a, b] = two(p), [c, d] = two(q);
      const m = [a, b, c, d];
      if (!CX.mobDetZero(m) && CX.mobRel(m) >= CX.MOB_EPS) return { inverse: { type: 'mobius', params: { a: fmtC(d), b: fmtC(CX.neg(b)), c: fmtC(CX.neg(c)), d: fmtC(a) } } };
    }
    if (P.degExact && P.deg >= 2) return { inverse: null, inverseNote: $t('This rational map has degree {d}, so it takes most values {times} and has no single inverse; {note}', { d: P.deg, times: times(P.deg), note: NOTE_PRE }) };
    return { inverse: null, inverseNote: $t('This rational map is not known to be one-to-one, so no inverse is offered; {note}', { note: NOTE_PRE }) };
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

  const DEFS = {};
  const def = (d) => { DEFS[d.id] = d; };

  // ---------------- Linear & Möbius ----------------
  def({
    id: 'mul', group: $t('Linear & Möbius'), label: $t('Multiply by c'), menuTex: 'c\\,z',
    params: [{ key: 'c', label: 'c', type: 'cx', def: '2' }],
    build({ c }) {
      const nz = !CX.isZero(c);
      return {
        f: (z) => CX.mul(c, z),
        hom: nz ? mobHom([c, C(0, 0), C(0, 0), C(1, 0)]) : null,
        homTex: nz ? (v) => mobHomTex([c, C(0, 0), C(0, 0), C(1, 0)], v) : null,
        tex: (a) => mulTex(c, a),
        props: nz ? props(ALL) : CONSTANT,
        inverse: nz ? { type: 'mul', params: { c: fmtC(CX.inv(c)) } } : null,
        inverseNote: nz ? null : NOTE_CONST,
      };
    },
  });
  def({
    id: 'add', group: $t('Linear & Möbius'), label: $t('Translate by c'), menuTex: 'z+c',
    params: [{ key: 'c', label: 'c', type: 'cx', def: '1' }],
    build({ c }) {
      return {
        f: (z) => CX.add(z, c),
        hom: (t) => (z) => CX.add(z, CX.scale(c, t)),
        homTex: (v = 'z') => ({ tex: $t('the translations $H_t(%{v})=%{v}+tc$, $c=%{c}$', { v, c: CX.tex(c, 3) }), mobius: true }),
        tex: (a) => addTex(a, c),
        props: props(ALL),
        inverse: { type: 'add', params: { c: fmtC(CX.neg(c)) } },
      };
    },
  });
  def({
    id: 'affine', group: $t('Linear & Möbius'), label: $t('Affine'), menuTex: 'az+b',
    params: [{ key: 'a', label: 'a', type: 'cx', def: '1+i' }, { key: 'b', label: 'b', type: 'cx', def: '0' }],
    build({ a, b }) {
      const nz = !CX.isZero(a);
      return {
        f: (z) => CX.add(CX.mul(a, z), b),
        hom: nz ? mobHom([a, b, C(0, 0), C(1, 0)]) : null,
        homTex: nz ? (v) => mobHomTex([a, b, C(0, 0), C(1, 0)], v) : null,
        tex: (x) => addTex(mulTex(a, x), b),
        props: nz ? props(ALL) : CONSTANT,
        inverse: nz ? { type: 'affine', params: { a: fmtC(CX.inv(a)), b: fmtC(CX.neg(CX.div(b, a))) } } : null,
        inverseNote: nz ? null : NOTE_CONST,
      };
    },
  });
  def({
    id: 'recip', group: $t('Linear & Möbius'), label: $t('Inversion'), menuTex: '1/z',
    params: [],
    build() {
      return {
        f: (z) => CX.inv(z),
        hom: mobHom([C(0, 0), C(1, 0), C(1, 0), C(0, 0)]),
        homTex: (v) => mobHomTex([C(0, 0), C(1, 0), C(1, 0), C(0, 0)], v),
        tex: (a) => ({ s: `\\frac{1}{${a.s}}`, p: 4 }),
        props: props({ analytic: true, rational: true, mobius: true, injective: true, deg: 1, degExact: true }),
        poles: [C(0, 0)],
        domain: (v) => `${v}\\neq 0`,
        inverse: { type: 'recip', params: {} },
      };
    },
  });
  function mobiusBuild(a, b, c, d) {
    if (CX.isZero(c) && CX.isZero(d)) throw new Error($t('Denominator is zero (c = d = 0)'));
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
      f: degenerate && !cz ? ((k) => () => k)(CX.div(a, c)) : (z) => CX.mobApply(m, z),
      hom: mob ? mobHom(m) : null,
      homTex: mob ? (v) => mobHomTex(m, v) : null,
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
      // (a constant map has no pole: −d/c is a removable singularity, so it gets no pole mark; review math-6)
      poles: pole && !degenerate ? [pole] : [],
      domain: pole ? (v) => `${v}\\neq ${CX.tex(pole)}` : null,
      inverse: !mob ? null : { type: 'mobius', params: { a: fmtC(d), b: fmtC(CX.neg(b)), c: fmtC(CX.neg(c)), d: fmtC(a) } },
      inverseNote: mob ? null : degenerate ? $t('ad − bc = 0 makes this map constant, so it has no inverse')
        : $t('ad − bc is too close to 0 to tell whether this map is invertible'),
    };
  }
  def({
    id: 'mobius', group: $t('Linear & Möbius'), label: $t('Möbius'), menuTex: '\\frac{az+b}{cz+d}',
    params: [
      { key: 'a', label: 'a', type: 'cx', def: '1' }, { key: 'b', label: 'b', type: 'cx', def: '-i' },
      { key: 'c', label: 'c', type: 'cx', def: '1' }, { key: 'd', label: 'd', type: 'cx', def: 'i' },
    ],
    presets: [
      { label: $t('Cayley  (z−i)/(z+i)'), params: { a: '1', b: '-i', c: '1', d: 'i' } },
      { label: $t('Inverse Cayley  i(1+z)/(1−z)'), params: { a: 'i', b: 'i', c: '-1', d: '1' } },
      { label: $t('Half-plane → disk  (z−1)/(z+1)'), params: { a: '1', b: '-1', c: '1', d: '1' } },
      { label: $t('Disk → right half-plane  (1+z)/(1−z)'), params: { a: '1', b: '1', c: '-1', d: '1' } },
    ],
    build({ a, b, c, d }) { return mobiusBuild(a, b, c, d); },
  });
  def({
    id: 'blaschke', group: $t('Linear & Möbius'), label: $t('Disk automorphism'), menuTex: 'e^{i\\varphi}\\frac{z-a}{1-\\bar a z}',
    params: [{ key: 'a', label: 'a', type: 'cx', def: '0.5' }, { key: 'phi', label: 'φ', type: 'angle', def: 0 }],
    build({ a, phi }) {
      const e = C(Math.cos(phi * DEG), Math.sin(phi * DEG));
      const r = mobiusBuild(e, CX.neg(CX.mul(e, a)), CX.neg(CX.conj(a)), C(1, 0));
      const rot = Math.abs(phi) % 360 < 1e-12;
      const ra = CX.abs(a);
      if (ra >= 1) r.branchNote = ra === 1 ? $t('|a| = 1 makes this map degenerate') : $t('|a| > 1: this map swaps the disk with its exterior, so it is not an automorphism of the disk');
      r.tex = (x) => {
        const num = addTex(x, CX.neg(a));
        const ac = CX.conj(a);
        const den = CX.isZero(ac) ? { s: '1', p: 4 } : addTex(mulTex(CX.neg(ac), x), C(1, 0));
        const fr = CX.isZero(ac) ? num : { s: `\\frac{${num.s}}{${den.s}}`, p: 4 };
        return rot ? fr : { s: `e^{${CX.texNum(phi * DEG, 4)}i}${fr.p >= 4 ? fr.s : paren(fr.s)}`, p: 1 };
      };
      // the inverse is again a disk automorphism: a' = −e^{iφ} a, φ' = −φ
      if (r.inverse) r.inverse = { type: 'blaschke', params: { a: fmtC(CX.neg(CX.mul(e, a))), phi: phi === 0 ? 0 : -phi } };
      else if (ra === 1) r.inverseNote = $t('|a| = 1 makes this map constant, so it has no inverse');
      return r;
    },
  });

  // ---------------- Powers & roots ----------------
  def({
    id: 'pown', group: $t('Powers & roots'), label: $t('Integer power'), menuTex: 'z^n',
    // |n| <= 4096, like an integer exponent in a custom formula: z^n is computed exactly as labelled
    params: [{ key: 'n', label: 'n', type: 'int', def: 2, min: -4096, max: 4096 }],
    build({ n }) {
      const an = Math.abs(n);
      let P;
      if (n === 0) P = CONSTANT;
      else if (n > 0) P = props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: n === 1, mobius: n === 1, deg: n, degExact: true });
      else P = props({ analytic: true, rational: true, injective: n === -1, mobius: n === -1, deg: an, degExact: true });
      let hom, homTex;
      if (n >= 0) { hom = powHom(C(n, 0), PI, 0); homTex = (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=%{v}^{%{e}}$ (principal branch)', { v, e: expoTex(n) }) }); }
      else {
        const h1 = powHom(C(an, 0), PI, 0), inv = mobHom([C(0, 0), C(1, 0), C(1, 0), C(0, 0)]);
        homTex = (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=%{v}^{%{e}}$ for $0\\le t\\le 1/2$ (principal branch), then the elliptic Möbius transformations from the identity to $1/w$', { v, e: expoTex(1 + 2 * (an - 1)) }) });
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
        inverseNote: n === 0 ? $t('z⁰ = 1 is constant, so it has no inverse') : null,
        f: (z) => CX.ipow(z, n),
        hom, homTex, props: P,
        tex: (a) => (n === 1 ? a : n === 0 ? { s: '1', p: 4 } : n < 0 ? { s: `\\frac{1}{${an === 1 ? a.s : atom(a) + '^{' + an + '}'}}`, p: 4 } : powTex(a, n)),
        poles: n < 0 ? [C(0, 0)] : [],
        domain: n < 0 ? (v) => `${v}\\neq 0` : null,
        inverse,
      };
    },
  });
  def({
    id: 'root', group: $t('Powers & roots'), label: $t('n-th root'), menuTex: '\\sqrt[n]{z}', hasCut: true,
    params: [{ key: 'n', label: 'n', type: 'int', def: 2, min: 2 }, ...cutParams],
    build({ n, cut, k }) {
      n = Math.max(2, n);
      const th = cut * DEG;
      const kk = ((k % n) + n) % n;
      return {
        f: (z) => CX.powReal(z, 1 / n, th, kk),
        hom: powHom(C(1 / n, 0), th, kk),
        homTex: (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=%{v}^{1-(%{m}/%{n})t}$ (%{cut})', { v, m: n - 1, n, cut: branchWords(cut, kk) }) }),
        tex: (a) => ({ s: n === 2 ? `\\sqrt{${a.s}}` : `\\sqrt[${n}]{${a.s}}`, p: 4 }),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: $t('sheet {k} of {n}', { k: kk, n }),
        inverse: { type: 'pown', params: { n } },
      };
    },
  });
  def({
    id: 'powa', group: $t('Powers & roots'), label: $t('Complex power'), menuTex: 'z^{\\alpha}', hasCut: true,
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
        inverseNote: inverse ? null : a2 === 0 ? $t('z⁰ = 1 is constant, so it has no inverse')
          : $t('A complex exponent winds around 0, so its inverse would need a spiral branch cut; use the Preimage view'),
        f: (z) => CX.pow(z, alpha, th, k),
        hom: powHom(alpha, th, k),
        homTex: (v = 'z') => ({ tex: alpha.im === 0 ? $t('the homotopy $H_t(%{v})=%{v}^{%{e}}$ (%{cut})', { v, e: expoTex(alpha.re), cut: branchWords(cut, k) }) : $t('the homotopy $H_t(%{v})=%{v}^{1+(\\alpha-1)t}$, $\\alpha=%{alpha}$ (%{cut})', { v, alpha: CX.tex(alpha, 3), cut: branchWords(cut, k) }) }),
        tex: (a) => powTex(a, CX.tex(alpha)),
        props: props({ analytic: true, injective: inj }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: $t('sheet {k}', { k }),
        inverse,
      };
    },
  });

  // ---------------- Exponential ----------------
  def({
    id: 'exp', group: $t('Exponential & log'), label: $t('Exponential'), menuTex: 'e^{z}',
    params: [],
    build() {
      return {
        f: CX.exp, hom: expHom, homTex: expHomTex,
        tex: (a) => ({ s: `e^{${a.s}}`, p: 3 }),
        props: props({ analytic: true, entire: true }),
        inverse: { type: 'log', params: { cut: 180, k: 0 } },
      };
    },
  });
  def({
    id: 'log', group: $t('Exponential & log'), label: $t('Logarithm'), menuTex: '\\log z', hasCut: true,
    params: [...cutParams],
    build({ cut, k }) {
      const th = cut * DEG;
      return {
        f: (z) => CX.log(z, th, k), hom: logHom(th, k), homTex: logHomTex(cut, k),
        tex: (a) => fn('\\log', a),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'ray', p: C(0, 0), ang: th, editable: true }],
        domain: (v) => `\\arg ${v}\\neq ${CX.texNum(cut, 2)}^\\circ`,
        branchNote: `Im ∈ ${degIv(cut - 360 + 360 * k, cut + 360 * k)}`,
        inverse: { type: 'exp', params: {} },
      };
    },
  });

  // ---------------- Trigonometric ----------------
  const trig = [
    ['sin', $t('Sine'), '\\sin', CX.sin, true, 'arcsin'],
    ['cos', $t('Cosine'), '\\cos', CX.cos, true, 'arccos'],
    ['tan', $t('Tangent'), '\\tan', CX.tan, false, 'arctan'],
    ['sinh', $t('Hyperbolic sine'), '\\sinh', CX.sinh, true, 'arsinh'],
    ['cosh', $t('Hyperbolic cosine'), '\\cosh', CX.cosh, true, 'arcosh'],
    ['tanh', $t('Hyperbolic tangent'), '\\tanh', CX.tanh, false, 'artanh'],
  ];
  for (const [id, label, tx, F, entire, invId] of trig) {
    def({
      id, group: $t('Trigonometric'), label, menuTex: `${tx} z`, params: [],
      build() {
        const r = {
          f: F, hom: ends(F, ZOOM[id]), homTex: (v = 'z', o) => ({ tex: ZOOM_TEX[id](v, o) }), nat: { kind: 'zoom', fn: id }, tex: (a) => fn(tx, a),
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
    ['arcsin', $t('Arcsine'), '\\arcsin', CX.asin, realCuts, 'sin', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
    ['arccos', $t('Arccosine'), '\\arccos', CX.acos, realCuts, 'cos', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
    ['arctan', $t('Arctangent'), '\\arctan', CX.atan, imagCuts, 'tan', (v) => `${v}\\notin i(-\\infty,-1]\\cup i[1,\\infty)`],
    ['arsinh', $t('Inverse sinh'), '\\operatorname{arsinh}', CX.asinh, imagCuts, 'sinh', (v) => `${v}\\notin i(-\\infty,-1]\\cup i[1,\\infty)`],
    ['arcosh', $t('Inverse cosh'), '\\operatorname{arcosh}', CX.acosh, [R(C(1, 0), PI)], 'cosh', (v) => `${v}\\notin(-\\infty,1]`],
    ['artanh', $t('Inverse tanh'), '\\operatorname{artanh}', CX.atanh, realCuts, 'tanh', (v) => `${v}\\notin(-\\infty,-1]\\cup[1,\\infty)`],
  ];
  for (const [id, label, tx, F, cuts, invId, dom] of itrig) {
    def({
      id, group: $t('Inverse trigonometric'), label, menuTex: `${tx} z`, params: [],
      build() {
        return {
          f: F, hom: ends(F, ZOOM[id]), homTex: (v = 'z', o) => ({ tex: ZOOM_TEX[id](v, o) }), nat: { kind: 'zoom', fn: id }, tex: (a) => fn(tx, a),
          props: props({ analytic: true, injective: true }),
          cuts, domain: dom, branchNote: $t('principal branch'),
          inverse: { type: invId, params: {} },
        };
      },
    });
  }

  // ---------------- Special ----------------
  def({
    id: 'joukowski', group: $t('Special'), label: $t('Joukowski'), menuTex: '\\tfrac12\\left(z+\\tfrac1z\\right)', params: [],
    build() {
      const f = (z) => CX.scale(CX.add(z, CX.inv(z)), 0.5);
      return {
        f, hom: ends(f, joukHom), nat: { kind: 'jouk' }, homTex: joukTex,
        tex: (a) => ({ s: `\\frac{1}{2}\\left(${a.s}+\\frac{1}{${a.s}}\\right)`, p: 1 }),
        props: props({ analytic: true, rational: true, proper: true, deg: 2, degExact: true }),
        poles: [C(0, 0)], domain: (v) => `${v}\\neq 0`,
        inverse: { type: 'ijouk', params: { branch: 'exterior' } },
      };
    },
  });
  def({
    id: 'ijouk', group: $t('Special'), label: $t('Inverse Joukowski'), menuTex: 'z\\pm\\sqrt{z^2-1}',
    params: [{ key: 'branch', label: $t('branch'), type: 'choice', def: 'exterior', choices: [['exterior', '|w| > 1'], ['interior', '|w| < 1']] }],
    build({ branch }) {
      const sg = branch === 'interior' ? -1 : 1;
      const f = (z) => CX.ijouk(z, sg);   // z + sg s, the interior branch as 1 / (z + s) (no cancellation)
      return {
        f, hom: ends(f, ijoukHom(sg)), nat: { kind: 'ijouk' },
        homTex: (v = 'z') => ({ tex: sg > 0 ? $t('the homotopy $H_t(%{v})=\\coth\\bigl((1-t/2)\\operatorname{arcoth}%{w}\\bigr)$, that is $C^{-1}\\bigl((C%{w})^{1-t/2}\\bigr)$ with $C(%{v})=\\frac{%{v}-1}{%{v}+1}$ (principal branch)', { v, w: vTex(v) }) : $t('the homotopy $H_t(%{v})=\\coth\\bigl((1-t/2)\\operatorname{arcoth}%{w}-\\pi i t/2\\bigr)$, that is $C^{-1}\\bigl(e^{\\pi i t}(C%{w})^{1-t/2}\\bigr)$ with $C(%{v})=\\frac{%{v}-1}{%{v}+1}$ (principal branch)', { v, w: vTex(v) }) }),
        // exactly what is evaluated: z ± √(z−1)·√(z+1) with principal roots (not √(z²−1), which differs on Re z < 0)
        tex: (a) => ({ s: `${a.s}${sg > 0 ? '+' : '-'}\\sqrt{${a.s}-1}\\,\\sqrt{${a.s}+1}`, p: 0 }),
        props: props({ analytic: true, injective: true }),
        cuts: [{ kind: 'seg', a: C(-1, 0), b: C(1, 0) }],
        domain: (v) => `${v}\\notin[-1,1]`, branchNote: branch === 'interior' ? $t('image in the unit disk') : $t('image outside the unit disk'),
        inverse: { type: 'joukowski', params: {} },
      };
    },
  });
  def({
    id: 'conj', group: $t('Special'), label: $t('Conjugation'), menuTex: '\\bar z', params: [],
    build() {
      return {
        f: CX.conj,
        hom: (t) => (z) => C(z.re, z.im * (1 - 2 * t)),
        homTex: (v = 'z') => ({ tex: $t('the homotopy $H_t(%{v})=\\operatorname{Re} %{v}+i(1-2t)\\operatorname{Im} %{v}$', { v }), segment: true }),
        tex: (a) => ({ s: `\\overline{${a.s}}`, p: 4 }),
        props: props({ proper: true, injective: true }),
        inverse: { type: 'conj', params: {} },
      };
    },
  });

  // ---------------- Polynomial, rational, custom ----------------
  def({
    id: 'poly', group: $t('Polynomial & custom'), label: $t('Polynomial'), menuTex: 'a_nz^n+\\dots+a_0',
    params: [{ key: 'co', label: $t('coefficients aₙ, …, a₀'), type: 'coeffs', def: '1, 0, -1, 0' }],
    build({ co }) {
      const c = CX.polyTrim(co);
      const d = c.length - 1;
      const P = d === 0 ? CONSTANT : props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: d === 1, mobius: d === 1, deg: d, degExact: true });
      const f = (z) => CX.polyEval(c, z);
      const nat = d >= 1 ? polyNat(c, f) : null;
      return {
        f, hom: nat ? nat.hom : linHom(f), homTex: nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (a constant has no natural path)', { v }), segment: true }),
        nat: nat ? nat.nat : null, natData: nat ? nat.natData : null,
        tex: (a) => polyTex(c, a), props: P,
        ...polyInverse(c),
      };
    },
  });
  def({
    id: 'rational', group: $t('Polynomial & custom'), label: $t('Rational'), menuTex: '\\frac{p(z)}{q(z)}',
    params: [{ key: 'p', label: $t('numerator p: coefficients'), type: 'coeffs', def: '1, 0, 1' }, { key: 'q', label: $t('denominator q: coefficients'), type: 'coeffs', def: '1, 0' }],
    build({ p, q }) {
      p = CX.polyTrim(p); q = CX.polyTrim(q);
      const dp = p.length - 1, dq = q.length - 1;
      const f = (z) => CX.div(CX.polyEval(p, z), CX.polyEval(q, z));
      if (q.length === 1 && CX.isZero(q[0])) throw new Error($t('Denominator is zero'));
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
      const nat = P.constant ? null : rationalNat(p, q, f);
      return {
        f, hom: nat ? nat.hom : linHom(f), homTex: nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (this map has no natural path)', { v }), segment: true }),
        nat: nat ? nat.nat : null, natData: nat ? nat.natData : null,
        tex: (a) => ({ s: `\\frac{${polyTex(p, a).s}}{${polyTex(q, a).s}}`, p: 4 }),
        props: P, poles, domain: dq > 0 ? (v) => `q(${v})\\neq 0` : null,
        ...rationalInverse(p, q, P),
      };
    },
  });
  // f(z) = a ∏ (z − ζ_k) / ∏ (z − p_j), the zeros and poles dragged in the input plane (notes/ui-design/zeros-poles.md).
  // Given as points, the numerator and denominator are coprime unless a zero and a pole coincide exactly (they cancel:
  // a removable singularity, filled in), so the degree max(#zeros, #poles) is exact.
  def({
    id: 'zp', group: $t('Polynomial & custom'), label: $t('Zeros and poles'), menuTex: 'a\\frac{\\prod(z-\\zeta_k)}{\\prod(z-p_j)}',
    params: [{ key: 'a', label: 'a', type: 'cx', def: '1' }, { key: 'zeros', label: $t('zeros'), type: 'cxlist', def: '1, -1' }, { key: 'poles', label: $t('poles'), type: 'cxlist', def: '0' }],
    build({ a, zeros, poles }) {
      if (zeros.length > ZP_MAX || poles.length > ZP_MAX) throw new Error($tn('At most {n} zeros and {n} poles', 'At most {n} zeros and {n} poles', ZP_MAX));
      const { zs, ps, gone } = zpCancel(zeros, poles);
      const nz = zs.length, np = ps.length, deg = Math.max(nz, np);
      const aZero = CX.isZero(a);
      const P = zpExpand(a, zs), Q = zpExpand(C(1, 0), ps);
      // evaluated as a ∏ ((z − ζ_k)/(z − p_k)) × the unpaired factors (no overflow of either product alone); ∞ at a pole
      // (a = 0: the constant 0 everywhere, the poles included: 0 · ∏/∏ has only removable singularities)
      const f = aZero ? () => C(0, 0) : (z) => {
        for (const p of ps) if (p.re === z.re && p.im === z.im) return C(Infinity, Infinity);
        let w = a;
        for (let i = 0; i < deg; i++) {
          if (i < nz && i < np) w = CX.mul(w, CX.div(CX.sub(z, zs[i]), CX.sub(z, ps[i])));
          else if (i < nz) w = CX.mul(w, CX.sub(z, zs[i]));
          else w = CX.div(w, CX.sub(z, ps[i]));
        }
        return w;
      };
      let Pr;
      if (aZero || deg === 0) Pr = props({ analytic: true, rational: true, deg: 0, degExact: true, constant: true, entire: aZero || !np, polynomial: aZero || !np });
      else if (!np) Pr = props({ analytic: true, entire: true, rational: true, polynomial: true, proper: true, injective: nz === 1, mobius: nz === 1, deg: nz, degExact: true });
      else Pr = props({ analytic: true, rational: true, deg, degExact: true, proper: nz > np, injective: deg === 1, mobius: deg === 1 });
      const nat = Pr.constant ? null : zerosPolesNat(a, zs, ps, f);
      // the caption names the zeros as the card does (ζ, p) and the zoom centre c (ratPath with the zp options)
      const homTex = nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (a constant has no natural path)', { v }), segment: true });
      const domain = np && !aZero ? (v) => (np <= 3 ? `${v}\\notin\\{${[...new Set(ps.map((p) => CX.tex(p)))].join(',')}\\}` : `${v}\\neq p_j`) : null;
      const inv = Pr.constant ? { inverse: null, inverseNote: NOTE_CONST } : np ? rationalInverse(P, Q, Pr) : polyInverse(P);
      const notes = [];
      if (gone.length) { const at = [...new Set(gone.map((g) => CX.fmt(g, 4)))].join(', '); notes.push(gone.length === 1 ? $t('A zero and a pole cancel at {at}', { at }) : $tn('{n} zero–pole pairs cancel at {at}', '{n} zero–pole pairs cancel at {at}', gone.length, { at })); }
      if (aZero) notes.push(np ? $t('a = 0 makes the map the constant 0 (the poles too: they are removable)') : $t('a = 0 makes the map constant'));
      return {
        f, hom: nat ? nat.hom : linHom(f), homTex,
        nat: nat ? nat.nat : null, natData: nat ? nat.natData : null,
        tex: (x) => (aZero ? { s: '0', p: 4 } : zpTex(a, zs, ps, x)),
        props: Pr, poles: aZero ? [] : ps.slice(), domain,
        zp: { a, zeros: zs, poles: ps, gone, P, Q },
        branchNote: notes.length ? notes.join('; ') : null,
        ...inv,
      };
    },
  });
  def({
    id: 'custom', group: $t('Polynomial & custom'), label: $t('Custom formula'), menuTex: 'f(z)\\ \\text{(LaTeX)}',
    params: [{ key: 'expr', label: 'f(z) =', type: 'expr', def: 'z^2+\\frac{1}{z}' }, { key: 'cut', label: $t('cut angle for log, √, powers'), type: 'angle', def: 180 }],
    hasCut: 'maybe',
    build({ expr, cut }) {
      const ast = Expr.parse(expr);
      if (Expr.hasBool(ast)) throw new Error($t('A function cannot contain comparisons'));
      const vars = Expr.usesVars(ast);
      for (const v of vars) if (v !== 'z') throw new Error($t('Use z (or w) as the variable{hint}', { hint: v === 'x' || v === 'y' ? $t('; write Re z, Im z for real parts') : '' }));
      const th = cut * DEG;
      const f = Expr.compile(ast, { theta: th });
      // a formula that is undefined at every generic point (z/0, log 0, ...) is an error, not a map
      const probes = [C(0.37, -0.81), C(-1.3, 0.6), C(2.1, 1.7), C(-0.45, -2.2), C(0.9, 0.05)];
      if (!probes.some((p) => CX.isFin(f(p)))) throw new Error($t('The formula is undefined for every z (check for a division by zero or a logarithm of 0)'));
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
      let nat = null;
      try { nat = cls.dep && !P.constant ? customNat(ast, f, cut, cls.analytic) : null; } catch (e) { nat = null; }
      return {
        f, hom: nat ? nat.hom : linHom(f),
        homTex: nat ? nat.homTex : (v = 'z') => ({ tex: $t('the straight-line homotopy $H_t(%{v})=(1-t)%{v}+t\\,f(%{v})$ (%{why})', { v, why: cls.dep && !P.constant ? $t('this formula is not analytic, so it has no natural path') : $t('a constant has no natural path') }), segment: true }),
        nat: nat ? nat.nat : null, natData: nat ? nat.natData || null : null,
        tex: (a) => Expr.toTex(ast, a),
        props: P,
        usesCut: cls.branch,
        domain: cls.branch ? (v) => $t('%{v}\\ \\text{off the branch cuts of the formula}', { v }) : (cls.entire ? null : (v) => $t('\\text{the formula is defined at } %{v}', { v })),
        branchNote: cls.branch ? $t('log, √ and powers use arg ∈ {iv}', { iv: degIv(cut - 360, cut) }) : null,
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
    id: 'deriv', group: $t('Calculus'), label: 'd/dz', menuTex: '\\frac{d}{dz}', params: [], op: 'deriv',
    build() {
      return {
        op: 'deriv',
        f: NAN_F, hom: null,
        tex: (a) => (plainVar(a.s) ? { s: `\\frac{d${a.s === 'z' ? '' : ' '}${a.s}}{dz}`, p: 4 } : { s: `\\frac{d}{dz}\\left(${a.s}\\right)`, p: 3 }),
        props: Object.assign(props(), { deriv: true }),
        cuts: [], poles: [], domain: null,
        inverse: null,
        inverseNote: $t('d/dz differentiates the chain so far; it is not a map of w, so it has no inverse'),
      };
    },
  });

  const GROUPS = [$t('Linear & Möbius'), $t('Powers & roots'), $t('Exponential & log'), $t('Trigonometric'), $t('Inverse trigonometric'), $t('Special'), $t('Polynomial & custom'), $t('Calculus')];

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
  const NOTATION = I18N.lang !== 'en';
  const TEX_CUT_NOTE = $t('\\quad\\text{(truncated: the expanded formula is too long, so the later steps are left out)}');
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
    if (!d) return { error: $t('Unknown function {f}', { f: step.type }) };
    const v = {};
    try {
      for (const q of d.params) {
        const raw = step.params[q.key] ?? q.def;
        switch (q.type) {
          case 'cx': try { v[q.key] = Expr.constValue(raw); } catch (e) { throw new Error(`${q.label}: ${e.message}`); } break;
          case 'int': {
            const x = Math.round(Number(raw));
            if (!Number.isFinite(x)) throw new Error($t('{label} must be an integer', { label: q.label }));
            v[q.key] = Math.min(q.max ?? Infinity, Math.max(q.min ?? -Infinity, x));
            break;
          }
          case 'angle': { const x = Number(raw); if (!Number.isFinite(x)) throw new Error($t('{label} must be a number', { label: q.label })); v[q.key] = x; break; }
          case 'coeffs': try { v[q.key] = parseCoeffs(raw, typedHere(step, q.key, raw)); } catch (e) { throw new Error(`${q.label}: ${e.message}`); } break;
          case 'cxlist': try { v[q.key] = parseCxList(raw, typedHere(step, q.key, raw)); } catch (e) { throw new Error(`${q.label}: ${e.message}`); } break;
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
      // homotopy captions in the Russian interface: Russian notation (tg, sh, ln, arcth) in their math, at call time
      // (an English caption made under I18N.using('en') stays English). The generators stay English; English skips this.
      if (NOTATION && typeof b.homTex === 'function') { const h = b.homTex; b.homTex = (...a) => { const r = h(...a); return r && typeof r.tex === 'string' ? Object.assign({}, r, { tex: I18N.notation(r.tex) }) : r; }; }
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
      throw new Error($t("Cannot evaluate '{x}'", { x: n.t }));
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
    DEFS, GROUPS, PROP_KEYS, defaults, build, natData, ZOOM, ratZoomData, ratZoomAt, ratPath, polyNat, rationalNat, zerosPolesNat, monomialOf, ZP_MAX, splitList, parseCxList, typedList, typedKeep, zpItem, toZerosPoles, fromZerosPoles, mobHomTex, composeProps, derivProps, props, polyTex, numericPolyDegree, derivativeStep, derivAst,
    stageFunctions, circleAt, circleRel, SHEET_MAX, sheetCount, branchNode, stepSheets, sheetSteps, sheetCombos, sheetEval,
  };
})();
if (typeof module !== 'undefined') module.exports = Funcs;
