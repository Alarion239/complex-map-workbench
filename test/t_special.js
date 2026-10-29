// The Gamma function, the digamma function and the Riemann zeta function (issue #4): CX.gamma, CX.lgamma, CX.digamma
// and CX.zeta against reference values (mpmath, 30 digits), the parser's names (\Gamma(z), Γ(z), Gamma(z), gamma(z),
// \zeta(s), ζ(s), zeta(s), digamma(z)) with the Greek letters still names without parentheses, Γ′ = Γψ, the catalog
// steps (props, poles, the deformation) and the recognizer (\Gamma(z^2+1) as its steps).
// Run: node test/t_special.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
global.Inverse = require('../src/inverse.js');
global.Recognize = require('../src/recognize.js');
const C = CX.C;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const rel = (a, b) => CX.abs(CX.sub(a, b)) / Math.max(CX.abs(b), 1e-300);
const close = (name, got, want, tol) => check(name, rel(got, want) <= tol, `${got.re} ${got.im} vs ${want.re} ${want.im}: rel ${rel(got, want)}`);

// ---- 1. values (mpmath 1.3, mp.dps = 30, rounded to double)
const G = [
  [C(0.5, 0), C(Math.sqrt(Math.PI), 0), 1e-15],
  [C(1, 1), C(0.49801566811835607, -0.15494982830181067), 1e-14],
  [C(5, 0), C(24, 0), 0],
  [C(-0.5, 0), C(-2 * Math.sqrt(Math.PI), 0), 1e-14],
  [C(0.5, 60), C(-2.798647966373748e-41, -8.884724694223934e-42), 1e-12],
  [C(-4.5, 3), C(-6.3291548223932555e-06, 2.1771258578877144e-05), 1e-13],
  [C(30, -20), C(1.5609654275290076e+28, 1.0795336401868512e+27), 1e-13],
  [C(171.5, 0), C(9.4833675668248e+307, 0), 1e-12],
];
for (const [z, w, tol] of G) close(`Γ(${z.re}${z.im ? `${z.im > 0 ? '+' : ''}${z.im}i` : ''})`, CX.gamma(z), w, tol);
check('Γ at its poles 0, -1, -7: ∞', [0, -1, -7].every((k) => !CX.isFin(CX.gamma(C(k, 0)))));
check('Γ(n) = (n-1)! exactly for n = 1 … 20', Array.from({ length: 20 }, (_, k) => k + 1).every((m) => { let f = 1; for (let j = 2; j < m; j++) f *= j; return CX.gamma(C(m, 0)).re === f; }));
// Γ(z) Γ(1 - z) = π / sin(πz), and exp(lgamma) = Γ
for (const z of [C(0.3, 0.7), C(-2.6, 1.1), C(4.2, -9)]) {
  close(`reflection at ${z.re}+${z.im}i`, CX.mul(CX.gamma(z), CX.gamma(CX.sub(CX.ONE, z))), CX.div(C(Math.PI, 0), CX.sin(CX.scale(z, Math.PI))), 1e-13);
  close(`exp lgamma = Γ at ${z.re}+${z.im}i`, CX.exp(CX.lgamma(z)), CX.gamma(z), 1e-13);
}
const PSI = [
  [C(1, 0), C(-0.5772156649015329, 0), 1e-15],
  [C(-0.5, 0), C(0.03648997397857652, 0), 1e-13],
  [C(3, -7), C(2.0053501836409526, -1.227292283668212), 1e-14],
  [C(-12.3, 0.4), C(3.008291199046411, 2.9225041053903253), 1e-13],
];
for (const [z, w, tol] of PSI) close(`ψ(${z.re}${z.im ? `${z.im > 0 ? '+' : ''}${z.im}i` : ''})`, CX.digamma(z), w, tol);
const Z = [
  [C(2, 0), C(Math.PI * Math.PI / 6, 0), 1e-15],
  [C(0, 0), C(-0.5, 0), 1e-15],
  [C(-1, 0), C(-1 / 12, 0), 1e-14],
  [C(0.5, 0), C(-1.4603545088095868, 0), 1e-14],
  [C(-3, 2), C(0.0218497264804625, 0.047174437273089426), 1e-13],
  [C(-20.5, 0), C(-108.21747505877606, 0), 1e-13],
  [C(0.5, 100), C(2.692619885681324, -0.020386029602598162), 1e-13],
  [C(0.5, 1000), C(0.35633436719439604, 0.9319978312329936), 1e-11],
  [C(-30, 40), C(-3.56576263662707e+25, 2.2413875840084126e+25), 1e-12],
  [C(0.2, -300), C(-0.9589013174399432, -2.934028966207679), 1e-12],
  // on Re s = 1 where 1 − 2^{1−s} = 0 (the alternating series' 0/0): s = 1 + 2πi/ln 2 as a double
  [C(1, 9.064720283654388), C(1.3465795428363172, 0.1098831367962695), 1e-14],
];
for (const [s, w, tol] of Z) close(`ζ(${s.re}${s.im ? `${s.im > 0 ? '+' : ''}${s.im}i` : ''})`, CX.zeta(s), w, tol);
check('ζ(1) = ∞', !CX.isFin(CX.zeta(C(1, 0))));
check('ζ at the trivial zeros -2, -4, -10: 0', [-2, -4, -10].every((k) => CX.abs(CX.zeta(C(k, 0))) === 0));
for (const t of [14.134725141734693, 21.022039638771556, 25.01085758014569]) check(`|ζ(1/2 + ${t}i)| ≈ 0`, CX.abs(CX.zeta(C(0.5, t))) < 1e-13, CX.abs(CX.zeta(C(0.5, t))));
check('ζ beyond |Im s| = ZETA_MAX: NaN, never a wrong value', Number.isNaN(CX.zeta(C(0.5, CX.ZETA_MAX + 1)).re));
// the conjugate symmetry ζ(s̄) = ζ(s)‾ and continuity across Re s = 0 (where the two formulas meet)
close('ζ(s̄) = conj ζ(s)', CX.zeta(C(0.3, -17)), CX.conj(CX.zeta(C(0.3, 17))), 1e-14);
close('ζ continuous across Re s = 0', CX.zeta(C(-1e-9, 5)), CX.zeta(C(1e-9, 5)), 1e-8);

// ---- 2. the parser
const ev = (src, z) => Expr.compile(Expr.parse(src))(z);
const z0 = C(0.7, 0.4);
for (const src of ['\\Gamma(z)', '\\Gamma\\left(z\\right)', 'Γ(z)', 'Gamma(z)', 'gamma(z)', '\\operatorname{Gamma}(z)']) close(`${src} reads as Γ(z)`, ev(src, z0), CX.gamma(z0), 0);
for (const src of ['\\zeta(z)', 'ζ(z)', 'zeta(z)', '\\zeta\\left(z\\right)']) close(`${src} reads as ζ(z)`, ev(src, z0), CX.zeta(z0), 0);
close('digamma(z) reads as ψ(z)', ev('digamma(z)', z0), CX.digamma(z0), 0);
close('zeta(1/2 + i z) composes', ev('zeta(1/2 + i z)', C(14.134725141734693, 0)), CX.zeta(C(0.5, 14.134725141734693)), 0);
// TeX reads back: Γ, ζ, ψ (as \operatorname{\psi}) and ζ′ (as \zeta')
for (const src of ['\\Gamma(z^2+1)', '\\zeta\\left(\\frac{1}{2}+i\\,z\\right)', 'digamma(z)', "zeta'(z)", "\\zeta'(z)", "ζ'(z)"]) {
  let back = null;
  try { back = Expr.toTex(Expr.parse(src)).s; } catch (e) { back = String(e); }
  check(`TeX of ${src} reads back`, !!back && Expr.sameAst(Expr.parse(back), Expr.parse(src)), back);
}
close("zeta'(z) is ζ′", ev("zeta'(z)", z0), CX.zetaDeriv(z0), 0);
{
  const d = Expr.diff(Expr.parse('\\zeta(z)'));
  check("(ζ(z))′ = ζ′(z), written \\zeta'", Expr.toTex(d).s === "\\zeta'\\left(z\\right)", Expr.toTex(d).s);
}
// Γ and ζ without parentheses stay Greek letters: shared-number names when names are on, an error without
{
  let e1 = null;
  try { Expr.parse('\\zeta z'); } catch (e) { e1 = e; }
  check('\\zeta without parentheses is not the function', !!e1, e1 && e1.message);
  const names = new Map([['ζ1', 2], ['γ', 3]]);
  Expr.setNames({ get: (k) => names.get(k), display: (k) => k });
  try {
    check('ζ₁ is still a shared number (ζ₁ z at z = 1: 2)', ev('ζ_1 z', C(1, 0)).re === 2, ev('ζ_1 z', C(1, 0)));
    check('a bare gamma is still the shared number γ', ev('gamma z', C(1, 0)).re === 3, ev('gamma z', C(1, 0)));
    close('gamma(z) is Γ even with names on', ev('gamma(z)', z0), CX.gamma(z0), 0);
  } finally { Expr.setNames(null); }
}
const cls = Expr.classify(Expr.parse('\\Gamma(z)'));
check('Γ(z): analytic, not entire', cls.analytic && !cls.entire, JSON.stringify(cls));
check('Γ(Re z), ζ(Re z) are real', Expr.realOf(Expr.parse('\\Gamma(\\operatorname{Re} z)')).real && Expr.realOf(Expr.parse('\\zeta(\\operatorname{Re} z)')).real && !Expr.realOf(Expr.parse('\\Gamma(z)')).real);
{
  const d = Expr.diff(Expr.parse('\\Gamma(z^2)'));
  const z = C(0.6, -0.3), h = 1e-6, f = (x) => CX.gamma(CX.mul(x, x));
  const fd = CX.scale(CX.sub(f(CX.add(z, C(h, 0))), f(CX.sub(z, C(h, 0)))), 0.5 / h);
  close("(Γ(z²))′ = 2z Γ(z²) ψ(z²)", Expr.compile(d)(z), fd, 1e-8);
}
{
  let msg = '';
  try { Expr.invert(Expr.parse('\\Gamma(z)')); } catch (e) { msg = e.message; }
  check('Γ has no inverse, and says why', /infinitely often/.test(msg), msg);
}

// ---- 3. the catalog steps
const S = (type) => Funcs.build({ type, params: Funcs.defaults(type) });
const g = S('gamma'), zt = S('zeta');
check('Γ step: analytic, not entire, not injective', g.props.analytic && !g.props.entire && !g.props.injective, JSON.stringify(g.props));
check('Γ step: poles 0, -1, …, -40', g.poles.length === 41 && g.poles[3].re === -3);
check('Γ step: the zoom path about p = 2', g.nat && g.nat.kind === 'gzoom' && Funcs.natData(g).p.re === 2, g.nat);
close('Γ step: the path ends at Γ', g.hom(1)(z0), CX.gamma(z0), 1e-12);
check('ζ step: the pole 1, the straight line and why', zt.poles.length === 1 && zt.poles[0].re === 1 && !zt.nat && /ζ′/.test(zt.homTex('z').tex), zt.homTex('z').tex);
check('both in the Special group', Funcs.DEFS.gamma.group === Funcs.DEFS.joukowski.group && Funcs.DEFS.zeta.group === Funcs.DEFS.joukowski.group);
check('stepOps: no inverse enumerator', !Inverse.stepOps(g).ok && !Inverse.stepOps(zt).ok);

// ---- 4. the recognizer: \Gamma(z^2+1) as its steps
{
  const r = Recognize.chain(Expr.parse('\\Gamma(z^2+1)'));
  const ids = r ? r.steps.map((s) => s.type) : null;
  check('\\Gamma(z^2+1) recognized, ending in the Γ step', !!ids && ids[ids.length - 1] === 'gamma', JSON.stringify(ids));
  const r2 = Recognize.chain(Expr.parse('\\zeta(z)'));
  check('\\zeta(z) recognized as the ζ step', !!r2 && r2.steps.length === 1 && r2.steps[0].type === 'zeta', JSON.stringify(r2 && r2.steps));
}

// [issue #277] ζ and ζ′ with their Euler–Maclaurin sums from the multiplicative k^{−s} table: against 30-digit values
// (mpmath 1.4.1), to the error the double sum already had (about 3e-14 for |Im s| < 10, 1e-12 for |Im s| < 1000, relative
// to 1 + |ζ|), on both sides of Re s = 0 and at the first zero
{
  const ZD = [
    [2, 0, 1.6449340668482264, 0.0, -0.9375482543158438, 0.0],
    [0.5, 14.134725141734695, -1.0483650805588237e-16, 6.585259277605158e-16, 0.7832965118670311, 0.12469982974817058],
    [0.3, 7.5, 1.1355037440048248, 0.43920591302766054, -0.029304776509644925, -0.2461065311519459],
    [1.5, -40, 0.8769085364699138, 0.2577122734439876, 0.04389919617361452, -0.3050318713744837],
    [0.8, 300, 0.9650434173419983, -0.07397036410234557, 0.8779487567765294, -1.0930298758549815],
    [2.2, -999.5, 0.9687252784080783, 0.11820164149850415, 0.03457329153862778, -0.03546001739870509],
    [-3.5, 25, -144.82352766897517, -208.36842631554603, 164.51733162422843, 318.23402282234736],
  ];
  const e = (v, w) => CX.abs(CX.sub(v, w)) / (1 + CX.abs(w));
  for (const [x, y, zr, zi, dr, di] of ZD) {
    const s = C(x, y), tol = Math.abs(y) < 10 ? 1e-13 : Math.abs(y) < 100 ? 1e-12 : 4e-12;
    check(`ζ(${x}${y < 0 ? '' : '+'}${y}i) and ζ′ against 30 digits`, e(CX.zeta(s), C(zr, zi)) <= tol && e(CX.zetaDeriv(s), C(dr, di)) <= tol, [e(CX.zeta(s), C(zr, zi)), e(CX.zetaDeriv(s), C(dr, di))]);
  }
}

console.log(`t_special: ${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
