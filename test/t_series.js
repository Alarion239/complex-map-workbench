// Functions defined by series (issue #5, part A: the language and the CPU): \sum and \prod with a bound index
// (LaTeX, Σ, and the plain sum(expr, n, a, b)), ∞ limits, n! and \binom; their values against closed forms, the
// convergence rule (NaN outside the region of convergence, never a partial sum), the plans (power, Laurent, Dirichlet)
// and their regions, finite sums as polynomials, the derivative term by term, the TeX round trip and the messages.
// Run: node test/t_series.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const C = CX.C;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const rel = (a, b) => CX.abs(CX.sub(a, b)) / Math.max(CX.abs(b), 1e-300);
const at = (q, z) => Expr.compile(Expr.parse(q))(z);
const close = (name, got, want, tol) => check(name, rel(got, want) <= tol, `${got.re} ${got.im} vs ${want.re} ${want.im}: rel ${rel(got, want)}`);
const nan = (v) => Number.isNaN(v.re);
const err = (q) => { try { Expr.parse(q); return null; } catch (e) { return e.message; } };

// ---- 1. factorial and binomial
check('5! = 120, 0! = 1, 170! finite, 171! = ∞', CX.fact(C(5, 0)).re === 120 && CX.fact(C(0, 0)).re === 1 && CX.isFin(CX.fact(C(170, 0))) && CX.fact(C(171, 0)).re === Infinity);
close('(1/2)! = √π/2', CX.fact(C(0.5, 0)), C(Math.sqrt(Math.PI) / 2, 0), 1e-14);
check('binom(10, 3) = 120, binom(1000, 998) = 499500, binom(5, 7) = 0, binom(5, -1) = 0', CX.binom(C(10, 0), C(3, 0)).re === 120 && CX.binom(C(1000, 0), C(998, 0)).re === 499500 && CX.binom(C(5, 0), C(7, 0)).re === 0 && CX.binom(C(5, 0), C(-1, 0)).re === 0);
close('binom(1/2, 2) = −1/8', CX.binom(C(0.5, 0), C(2, 0)), C(-0.125, 0), 1e-15);
close('binom(2.5, 1.5) = Γ(3.5)/(Γ(2.5)Γ(2)) = 2.5', CX.binom(C(2.5, 0), C(1.5, 0)), C(2.5, 0), 1e-13);
close('5!z at z = i', at('5! z', C(0, 1)), C(0, 120), 0);
close('\\binom{5}{2} and binom(5, 2)', at('\\binom{5}{2}+binom(5, 2)', C(0, 0)), C(20, 0), 0);

// ---- 2. power series against closed forms
const E1 = '\\sum_{n=0}^{\\infty} \\frac{z^n}{n!}';
for (const z of [C(1, 0), C(-3, 2), C(10, 3), C(0, 10)]) close(`e^z from its series at ${z.re}${z.im >= 0 ? '+' : ''}${z.im}i`, at(E1, z), CX.exp(z), 1e-12);
close('sin z from its series', at('\\sum_{n=0}^{\\infty} \\frac{(-1)^n z^{2n+1}}{(2n+1)!}', C(2, 1)), CX.sin(C(2, 1)), 1e-13);
close('Σ z^n = 1/(1 − z) at 0.5', at('sum(z^n, n, 0)', C(0.5, 0)), C(2, 0), 1e-13);
close('Σ z^n = 1/(1 − z) at 0.3+0.6i', at('\\sum_{n\\ge 0} z^n', C(0.3, 0.6)), CX.div(CX.ONE, C(0.7, -0.6)), 1e-13);
close('Li₂(1/2) = π²/12 − (ln 2)²/2', at('\\sum_{n=1}^{\\infty} \\frac{z^n}{n^2}', C(0.5, 0)), C(Math.PI ** 2 / 12 - Math.LN2 ** 2 / 2, 0), 1e-14);
close('Σ (z−1)^n/n! = e^{z−1}: a centre', at('\\sum_{n=0}^{\\infty} \\frac{(z-1)^n}{n!}', C(2, 1)), CX.exp(C(1, 1)), 1e-13);
close('Σ z^{2^n} at 0.5+0.3i (a lacunary series)', at('\\sum_{n=0}^{\\infty} z^{2^n}', C(0.5, 0.3)), (() => { let s = C(0, 0), p = C(0.5, 0.3); for (let k = 0; k < 40; k++) { s = CX.add(s, p); p = CX.mul(p, p); } return s; })(), 1e-14);
// outside the disc: NaN, never a partial sum
check('Σ z^n/n² at 1.2: NaN (outside the disc)', nan(at('\\sum_{n=1}^{\\infty} \\frac{z^n}{n^2}', C(1.2, 0))));
check('Σ z^n at 1.01: NaN', nan(at('\\sum_{n=0}^{\\infty} z^n', C(1.01, 0))));
check('Σ z^n = 1/(1 − z) outside R: NaN at 2, −1.5, 1.2i (1/(1 − z) is finite there, the series is not)', [C(2, 0), C(-1.5, 0), C(0, 1.2)].every((z) => nan(at('\\sum_{n=0}^{\\infty} z^n', z))));
check('Σ z^{2^n} at 1.001: NaN (its natural boundary is |z| = 1)', nan(at('\\sum_{n=0}^{\\infty} z^{2^n}', C(1.001, 0))));
check('e^z at z = 1000: NaN (more than the cap of terms)', nan(at(E1, C(1000, 0))));
check('e^z at z = −40: NaN (the terms cancel: e^{40} against e^{−40})', nan(at(E1, C(-40, 0))));

// ---- 3. Laurent and Dirichlet series
// θ: Σ_{n∈ℤ} e^{−n²} z^n at z = 1 is θ₃(0, e^{−1}) = 1.7726372048266521530…
close('Σ_{n∈ℤ} e^{−n²} z^n at 1 (a theta function)', at('\\sum_{n\\in\\mathbb{Z}} e^{-n^2} z^n', C(1, 0)), C(1.772637204826652, 0), 1e-14);
close('Σ_{n=−∞}^{∞}: the same', at('\\sum_{n=-\\infty}^{\\infty} e^{-n^2} z^n', C(1, 0)), C(1.772637204826652, 0), 1e-14);
const Z = '\\sum_{n=1}^{\\infty} n^{-z}';
for (const z of [C(2, 0), C(1.5, 3), C(3, -10), C(1.1, 0)]) close(`Σ n^{−z} = ζ(z) at ${z.re}${z.im >= 0 ? '+' : ''}${z.im}i`, at(Z, z), CX.zeta(z), 1e-9);
close('Σ 1/n^z (the same series)', at('\\sum_{n=1}^{\\infty} \\frac{1}{n^z}', C(2, 1)), CX.zeta(C(2, 1)), 1e-9);
check('Σ n^{−z} at Re z = 0.5: NaN (left of σ = 1)', nan(at(Z, C(0.5, 3))));
close('Σ (−1)^{n+1} n^{−z} = (1 − 2^{1−z}) ζ(z) at 3', at('\\sum_{n=1}^{\\infty} (-1)^{n+1} n^{-z}', C(3, 0)), CX.mul(CX.sub(CX.ONE, C(2 ** -2, 0)), CX.zeta(C(3, 0))), 1e-10);

// ---- 4. constant sums, finite sums, products
close('Σ 1/n² = π²/6 (a constant: 2^16 terms and the rest as an integral)', at('\\sum_{n=1}^{\\infty} \\frac{1}{n^2}', C(0, 0)), C(Math.PI ** 2 / 6, 0), 1e-8);
close('Σ_{k=0}^{3} binom(3, k) z^k = (1 + z)³', at('\\sum_{k=0}^{3} \\binom{3}{k} z^k', C(2, 1)), CX.ipow(C(3, 1), 3), 1e-15);
close('Π_{k=1}^{5} (z − k)', at('\\prod_{k=1}^{5} (z-k)', C(0, 1)), [1, 2, 3, 4, 5].reduce((p, k) => CX.mul(p, C(-k, 1)), C(1, 0)), 1e-15);
for (const z of [C(0.5, 0), C(0.37, -0.81), C(2.5, 1)]) close(`Π (1 − z²/n²) = sin(πz)/(πz) at ${z.re}${z.im >= 0 ? '+' : ''}${z.im}i, within 1e-3 (512 factors and the rest as an integral)`, at('\\prod_{n=1}^{\\infty} (1 - z^2/n^2)', z), CX.div(CX.sin(CX.scale(z, Math.PI)), CX.scale(z, Math.PI)), 1e-3);
close('an empty sum is 0, an empty product 1', at('\\sum_{n=3}^{2} z + \\prod_{n=3}^{2} z', C(5, 0)), C(1, 0), 0);
close('a nested sum: Σ_{n=0}^{3} Σ_{k=0}^{n} z^k', at('\\sum_{n=0}^{3} \\sum_{k=0}^{n} z^k', C(2, 0)), C(1 + 3 + 7 + 15, 0), 0);
close('the index inside a function: Σ sin(n z)/2^n', at('\\sum_{n=1}^{\\infty} \\frac{\\sin(n z)}{2^n}', C(0.3, 0)), (() => { let s = 0; for (let k = 1; k < 80; k++) s += Math.sin(0.3 * k) / 2 ** k; return C(s, 0); })(), 1e-13);
close('an N limit from a number (the slider): Σ_{n=0}^{N}', (() => { Expr.setNames({ get: (x) => (x === 'N' ? 3 : undefined) }); try { return at('\\sum_{n=0}^{N} z^n', C(2, 0)); } finally { Expr.setNames(null); } })(), C(15, 0), 0);

// ---- 5. the plans and their regions
const info = (q) => Expr.seriesInfo(Expr.parse(q));
let si = info(E1);
check('e^z: a power series about 0 with R = ∞', si.length === 1 && si[0].kind === 'power' && si[0].R === Infinity && CX.isZero(si[0].c), si);
si = info('\\sum_{n=1}^{\\infty} \\frac{z^n}{n^2}');
check('Li₂: R ≈ 1 (within 1%)', si.length === 1 && Math.abs(si[0].R - 1) < 0.01, si);
si = info('\\sum_{n=0}^{\\infty} \\frac{(z-2i)^n}{3^n}');
check('Σ ((z − 2i)/3)^n: centre 2i, R = 3', si.length === 1 && rel(si[0].c, C(0, 2)) < 1e-15 && Math.abs(si[0].R - 3) < 1e-9, si);
si = info('\\sum_{n=0}^{\\infty} z^{2^n}');
check('Σ z^{2^n}: R = 1', si.length === 1 && Math.abs(si[0].R - 1) < 1e-9, si);
si = info('\\sum_{n\\in\\mathbb{Z}} \\frac{z^n}{2^{|n|}}');
check('Σ_{n∈ℤ} z^n/2^|n|: a Laurent series on 1/2 < |z| < 2', si.length === 1 && si[0].kind === 'laurent' && Math.abs(si[0].R - 2) < 1e-9 && Math.abs(si[0].r - 0.5) < 1e-9, si);
si = info(Z);
check('ζ as a Dirichlet series: σ = 1', si.length === 1 && si[0].kind === 'dirichlet' && Math.abs(si[0].sigma - 1) < 1e-9, si);
si = info('\\sum_{n=1}^{\\infty} n^2 n^{-z}');
check('Σ n² n^{−z}: σ = 3', si.length === 1 && Math.abs(si[0].sigma - 3) < 1e-6, si);
check('a generic term has no plan: Σ sin(nz)/2^n', info('\\sum_{n=1}^{\\infty} \\frac{\\sin(n z)}{2^n}').length === 0);

// ---- 6. guarantees: finite sums are polynomials, infinite series analytic, nothing more
let cl = Expr.classify(Expr.parse('\\sum_{k=0}^{3} \\binom{3}{k} z^k'));
check('a finite sum of powers is a polynomial of degree 3', cl.poly && cl.deg === 3 && cl.entire, cl);
const pd = Expr.polyDegree(Expr.parse('\\sum_{k=0}^{3} \\binom{3}{k} z^k'));
check('its degree is exact', pd && pd.lo === 3 && pd.hi === 3 && pd.exact, pd);
cl = Expr.classify(Expr.parse(E1));
check('e^z as a series: analytic, not claimed entire', cl.analytic && !cl.entire && !cl.poly, cl);
cl = Expr.classify(Expr.parse('\\sum_{n=1}^{\\infty} \\frac{\\sin(n z)}{2^n}'));
check('a generic sum: nothing claimed', !cl.analytic && !cl.entire, cl);

// ---- 7. the derivative term by term, the inverse refused
const d = Expr.diff(Expr.parse('\\sum_{n=1}^{\\infty} \\frac{z^n}{n^2}'));
close('(Li₂)′ = Σ z^{n−1}/n = −log(1 − z)/z', Expr.compile(d)(C(0.5, 0)), C(2 * Math.LN2, 0), 1e-12);
close('(e^z)′ from the series is e^z', Expr.compile(Expr.diff(Expr.parse(E1)))(C(1, 1)), CX.exp(C(1, 1)), 1e-12);
close('d/dz z! = z! ψ(z + 1) at 1: 1 − γ', Expr.compile(Expr.diff(Expr.parse('z!')))(C(1, 0)), C(1 - 0.5772156649015329, 0), 1e-12);
close('a finite product differentiates (written out)', Expr.compile(Expr.diff(Expr.parse('\\prod_{k=1}^{3} (z-k)')))(C(0, 0)), C(11, 0), 1e-15);
let inv = null;
try { Expr.invert(Expr.parse(E1)); } catch (e) { inv = e.message; }
check('a series has no inverse here, and says so', inv && /Preimage/.test(inv), inv);

// ---- 8. TeX: the round trip, and the sum as a factor
for (const q of [E1, '\\sum_{n\\in\\mathbb{Z}} e^{-n^2} z^n', Z, 'sum(z^n/n!, n, 0, inf)', '\\prod_{k=1}^{5} (z-k)', '\\sum_{n=0}^{\\infty} z^n + 1', '2\\sum_{n=0}^{\\infty} z^n \\cdot 3', '\\binom{z}{2} + 3!', 'Σ_{n≥1} z^n/n']) {
  const a = Expr.parse(q), t = Expr.toTex(a).s;
  let b = null;
  try { b = Expr.parse(t); } catch (e) { b = null; }
  check(`TeX round trip: ${q}`, b && Expr.sameAst(a, b), t);
}
check('a sum times a factor is wrapped', /^2\\,\\left\(\\sum/.test(Expr.toTex(Expr.parse('2\\sum_{n=0}^{\\infty} z^n \\cdot 3')).s));
check('the plain form reads as \\sum', Expr.toTex(Expr.parse('sum(z^n/n!, n, 0, inf)')).s === '\\sum_{n=0}^{\\infty} \\frac{z^{n}}{n!}');

// ---- 9. the language: the index is bound inside its sum only; messages
check('n outside a sum is what it was (an unknown symbol)', /Unknown symbol 'n'/.test(err('n z') || ''), err('n z'));
check('∞ outside a sum\'s limits is what it was', /Unknown command/.test(err('\\infty') || ''), err('\\infty'));
check('5! still parses; !! after an operator is the old error', err('5!') === null && /Unexpected '!'/.test(err(', !!z') || ''));
check('the index used after its sum: refused', /index of a sum/.test(err('\\sum_{n=0}^{3} z^n + n') || ''), err('\\sum_{n=0}^{3} z^n + n'));
check('z as an index: refused', /cannot be the index/.test(err('\\sum_{z=0}^{3} z') || ''), err('\\sum_{z=0}^{3} z'));
check('a sum without its index: refused', /needs its index/.test(err('\\sum z^n') || ''), err('\\sum z^n'));
check('∞ in the body: refused', /only be a limit/.test(err('\\sum_{n=0}^{3} \\infty') || ''), err('\\sum_{n=0}^{3} \\infty'));
check('a sum with no terms: refused', /Missing the terms/.test(err('\\sum_{n=0}^{3}') || ''), err('\\sum_{n=0}^{3}'));
check('k and m as indices; \\limits; ^ before _', err('\\sum_{k=1}^{4} \\sum\\limits^{2}_{m=0} k m z') === null);
check('the shared numbers keep their letters outside sums (a, k)', (() => { Expr.setNames({ get: (x) => (x === 'k' ? 2 : undefined) }); try { return Expr.compile(Expr.parse('k z + \\sum_{n=0}^{2} z^n'))(C(1, 0)).re === 5; } finally { Expr.setNames(null); } })());

// ---- 10. the Formula step: a series builds, with its guarantees (analytic, nothing more)
const b0 = Funcs.build({ type: 'custom', params: { expr: E1, cut: 180 }, on: true });
check('a Formula step with e^z as a series builds, analytic and not claimed entire', b0 && !b0.error && b0.props.analytic && !b0.props.entire, b0 && (b0.error || b0.props));
close('… and maps like e^z', b0.f(C(1, 1)), CX.exp(C(1, 1)), 1e-12);

// ---- 11. the Series step: power (from n = 1 when a_0 is undefined), Laurent and Dirichlet; its region drawn as cuts and
// written as the domain; its derivative term by term; its errors
const sb = (p) => Funcs.build({ type: 'series', params: Object.assign({ kind: 'power', an: '\\frac{1}{n!}', c: '0' }, p), on: true });
let s1 = sb({});
close('Series step: e^z from a_n = 1/n!', s1.f(C(1, 1)), CX.exp(C(1, 1)), 1e-12);
check('… no circle (R = ∞), no inverse, a note', !s1.cuts.length && !s1.inverse && /many times/.test(s1.inverseNote), s1.cuts);
s1 = sb({ an: '\\frac{1}{n^2}', c: '1' });
close('Series step: Li₂(z − 1) about c = 1, from n = 1', s1.f(C(1.5, 0)), at('\\sum_{n=1}^{\\infty} \\frac{z^n}{n^2}', C(0.5, 0)), 1e-12);
check('… its circle |z − 1| = R ≈ 1, and its domain', s1.cuts.length === 1 && s1.cuts[0].kind === 'circle' && Math.abs(s1.cuts[0].r - 1) < 0.01 && rel(s1.cuts[0].c, C(1, 0)) < 1e-15 && /\\left\|z-1\\right\|<R\\approx 1/.test(s1.domain('z')), [s1.cuts, s1.domain('z')]);
s1 = sb({ kind: 'laurent', an: '\\frac{1}{2^{|n|}}' });
check('Series step: a Laurent series on the annulus 1/2 < |z| < 2 (two circles)', s1.cuts.length === 2 && /r\\approx 0\.5<\\left\|z\\right\|<R\\approx 2/.test(s1.domain('z')), [s1.cuts, s1.domain('z')]);
s1 = sb({ kind: 'dirichlet', an: '1' });
close('Series step: ζ as a Dirichlet series', s1.f(C(2, 1)), CX.zeta(C(2, 1)), 1e-9);
check('… the line Re z = σ = 1, its TeX n^{−z}', s1.cuts.length === 1 && s1.cuts[0].kind === 'vline' && s1.cuts[0].x === 1 && s1.tex({ s: 'z', p: 4 }).s === '\\sum_{n=1}^{\\infty} n^{-z}', [s1.cuts, s1.tex({ s: 'z', p: 4 }).s]);
const ds = Funcs.derivAst(sb({}));
close('Series step: its derivative term by term (e^z)', Expr.compile(ds.ast)(C(0.3, 0.4)), CX.exp(C(0.3, 0.4)), 1e-12);
check('Series step: a_n with z is refused', /must not depend on z/.test(sb({ an: 'z' }).error || ''), sb({ an: 'z' }).error);
check('Series step: an empty a_n is refused', /formula in n/.test(sb({ an: '' }).error || ''), sb({ an: '' }).error);
check('Series step: in the catalog with its words for the palette', Funcs.DEFS.series && Funcs.DEFS.series.params.map((q) => q.key).join() === 'kind,an,c');

console.log(bad ? `${bad} of ${n} checks FAILED` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);
