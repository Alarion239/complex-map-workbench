// The Recurrence step (issue #6, part A): u_0 a formula in z, u_{k+1} = g(u_k, z), the map z ↦ u_N. Its values against
// a plain loop, ∞ where an orbit escapes (never NaN), NaN for a bad N, the guarantees (a polynomial of exact degree when
// it is short enough to write out, analytic otherwise), d/dz, the TeX, the GPU key (a new N is the same program) and
// the messages.
// Run: node test/t_recurrence.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const C = CX.C;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const rel = (a, b) => CX.abs(CX.sub(a, b)) / Math.max(CX.abs(b), 1e-300);
const R = (u0, g, N, cut = 180) => Funcs.DEFS.recurrence.build({ u0, g, N, cut });
const err = (u0, g, N) => { try { R(u0, g, N); return null; } catch (e) { return e.message; } };
const loop = (z, u, step, N) => { for (let k = 0; k < N; k++) u = step(u, z); return u; };
const sq = (u, z) => CX.add(CX.mul(u, u), z);

// ---- 1. values
for (const z of [C(0.1, 0.2), C(-0.7, 0.3), C(0.3, -0.5)]) {
  const got = R('z', 'u^2+z', 5).f(z), want = loop(z, z, sq, 5);
  check(`u² + z from z, N = 5, at ${z.re}${z.im >= 0 ? '+' : ''}${z.im}i`, rel(got, want) < 1e-14, `${got.re} ${got.im}`);
}
check('N = 0 is u₀', rel(R('\\sin z', 'u^2', 0).f(C(0.4, 0.1)), CX.sin(C(0.4, 0.1))) < 1e-15);
const newton = R('z', 'u-\\frac{u^3-1}{3u^2}', 30);
check('Newton for z³ − 1 from −1 + 0.2i reaches e^{2πi/3}', rel(newton.f(C(-1, 0.2)), C(-0.5, Math.sqrt(3) / 2)) < 1e-12);
check('Newton from 2 reaches 1', rel(newton.f(C(2, 0)), C(1, 0)) < 1e-15);
check('a shared rule in sin: u/2 + sin z tends to 2 sin z', rel(R('z', '\\frac{u}{2}+\\sin z', 60).f(C(0.3, 0.2)), CX.scale(CX.sin(C(0.3, 0.2)), 2)) < 1e-12);

// ---- 2. escape: ∞, never NaN; NaN only for a bad N
const M = R('0', 'u^2+z', 100);
const esc = M.f(C(1, 1));
check('Mandelbrot: z = 1 + i escapes to ∞', esc.re === Infinity && esc.im === Infinity, JSON.stringify(esc));
check('Mandelbrot: z = −1 stays (period 2)', CX.isFin(M.f(C(-1, 0))) && CX.abs(M.f(C(-1, 0))) < 2);
check('Mandelbrot: z = 2 escapes even with N = 256', R('0', 'u^2+z', 256).f(C(2, 0)).re === Infinity);
check('an orbit that is NaN stays NaN', Number.isNaN(R('z', '\\frac{u}{u}+z', 3).f(C(0, 0)).re));
check('N past 256 compiles to NaN', Number.isNaN(Expr.compile(Expr.iterate(Expr.parse('z'), Expr.parse('u^2+z', { bound: ['u'] }), Expr.parse('257')))(C(0, 0)).re));
check('N = 2.5 compiles to NaN', Number.isNaN(Expr.compile(Expr.iterate(Expr.parse('z'), Expr.parse('u^2+z', { bound: ['u'] }), Expr.parse('2.5')))(C(0, 0)).re));

// ---- 3. guarantees
const p3 = R('z', 'u^2+z', 3).props;
check('u² + z from z, N = 3: a polynomial of exact degree 8', p3.polynomial && p3.deg === 8 && p3.degExact, JSON.stringify(p3));
const p10 = R('z', 'u^2+z', 10).props;
check('N = 10: degree 1024, exact', p10.polynomial && p10.deg === 1024 && p10.degExact, JSON.stringify(p10));
const p40 = R('0', 'u^2+z', 40).props;
check('N = 40: entire, not taken for a polynomial (degree 2^39)', p40.entire && !p40.polynomial, JSON.stringify(p40));
const pz = R('z', '2u', 4).props;
check('2u from z, N = 4: 16z, injective (Möbius)', pz.polynomial && pz.deg === 1 && pz.injective, JSON.stringify(pz));
const pN = newton.props;
check('Newton: analytic, not entire', pN.analytic && !pN.entire, JSON.stringify(pN));
check('a recurrence has no inverse, and says why', R('z', 'u^2+z', 3).inverse === null && /recurrence/.test(R('z', 'u^2+z', 3).inverseNote));

// ---- 4. d/dz, TeX, the GPU key
const d = Expr.compile(Expr.diff(R('z', 'u^2+z', 3).ast));
const h = 1e-6, z0 = C(0.2, 0.1), f3 = R('z', 'u^2+z', 3).f;
const fd = CX.scale(CX.sub(f3(CX.add(z0, C(h, 0))), f3(CX.sub(z0, C(h, 0)))), 1 / (2 * h));
check('d/dz of a short recurrence (written out) against a difference quotient', rel(d(z0), fd) < 1e-8, `${d(z0).re} ${fd.re}`);
check('d/dz of a long one with u used twice is refused, in words', (() => { try { Expr.diff(newton.ast); return false; } catch (e) { return /too many steps/.test(e.message); } })());
const tex = R('z', 'u^2+z', 3).tex({ s: 'z', p: 4 }).s;
check('TeX: u_{3}, u_0 = z, u_{k+1} = u_k^2 + z', tex === 'u_{3},\\ u_0=z,\\ u_{k+1}=u_k^{2}+z', tex);
const k1 = JSON.stringify(Object.assign({}, R('0', 'u^2+z', 7).ast, { hi: '#N' })), k2 = JSON.stringify(Object.assign({}, R('0', 'u^2+z', 9).ast, { hi: '#N' }));
check('the trees of N = 7 and N = 9 differ only in N', k1 === k2);

// ---- 5. messages
check('an empty start', /start u₀/.test(err('', 'u', 2) || ''));
check('an empty rule', /rule/.test(err('z', ' ', 2) || ''));
check('u in the start', /letter of the rule/.test(err('u+1', 'u', 2) || ''), err('u+1', 'u', 2));
check('N = 300', /from 0 to 256/.test(err('z', 'u', 300) || ''));
check('Re z in the rule', /Re z/.test(err('z', 'u+x', 2) || ''), err('z', 'u+x', 2));
check('u outside the step is still an unknown symbol', (() => { try { Expr.parse('u+z'); return false; } catch (e) { return /Unknown symbol/.test(e.message); } })());
check('a sum inside a rule keeps its own index', rel(R('z', 'u+\\sum_{n=1}^{3} n', 2).f(C(0, 0)), C(12, 0)) < 1e-15);

// ---- 6. iter(g, u, u₀, N) in a formula: the Mandelbrot set and a filled Julia set as regions
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
check('iter(u^2+z, u, z, 3) is the recurrence', same(Expr.parse('iter(u^2+z, u, z, 3)'), R('z', 'u^2+z', 3).ast));
const M64 = Expr.compileLevel(Expr.parse('|iter(u^2+z, u, 0, 64)| \\le 2', { allowRel: true }));
check('the Mandelbrot set: −1, 0.25 and i in, 1 + i and 0.5 out', M64(C(-1, 0)) >= 0 && M64(C(0.25, 0)) >= 0 && M64(C(0, 1)) >= 0 && !(M64(C(1, 1)) >= 0) && !(M64(C(0.5, 0)) >= 0));
const K = Expr.compileLevel(Expr.parse('|iter(u^2-0.75, u, z, 64)| \\le 2', { allowRel: true }));
check('the filled Julia set of z² − 0.75: 0 and its fixed point 1.5 in, 1.6 out', K(C(0, 0)) >= 0 && K(C(1.5, 0)) >= 0 && !(K(C(1.6, 0)) >= 0));
const tm = Expr.toTex(Expr.parse('|iter(u^2+z, u, 0, 64)| \\le 2', { allowRel: true })).s;
check('inside a formula: \\operatorname{iter}(…), which reads back', tm.includes('\\operatorname{iter}\\left(u^{2}+z,\\ u,\\ 0,\\ 64\\right)') && same(Expr.parse(tm, { allowRel: true }), Expr.parse('|iter(u^2+z, u, 0, 64)| \\le 2', { allowRel: true })), tm);
const perr = (q) => { try { Expr.parse(q); return null; } catch (e) { return e.message; } };
check('iter: the letter must be free (z is refused)', !!perr('iter(u^2, z, 0, 3)'));
check('iter: u in the start is refused', !!perr('iter(u^2, u, u, 3)'));

console.log(bad ? `${bad} of ${n} checks fail` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);
