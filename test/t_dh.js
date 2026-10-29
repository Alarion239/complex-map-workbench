// The Douady–Hubbard map Φ_M and the Böttcher coordinate φ_c (issue #260): the steps against the certified 50-digit
// reference (test/fixtures/dh_reference.json, tools/dh_reference.py), NaN on M and below the critical potential, the
// landing points of external rays (from the literature, not from this code), rays that keep their angle and lose
// potential, and equipotentials that are simple closed curves which never cross each other.
// Run: node test/t_dh.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const C = CX.C;
const REF = require('./fixtures/dh_reference.json');
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const rel = (a, b) => CX.abs(CX.sub(a, b)) / Math.max(CX.abs(b), 1e-300);
const B = (type, params = {}) => Funcs.build({ type, params: Object.assign(Funcs.defaults(type), params) });
const ex = (z) => `${z.re}${z.im >= 0 ? '+' : ''}${z.im}i`;

// ---- 1. Φ_M and φ_{−1} against the reference, through the steps (N = 64, the GPU's limit)
const dh = B('dh');
for (const p of REF.points) {
  const z = C(p.z[0], p.z[1]), want = C(+p.phi[0], +p.phi[1]), got = dh.f(z);
  check(`Φ_M(${p.name}) to 1e−14`, rel(got, want) < 1e-14, `${ex(got)} vs ${ex(want)}`);
}
const bas = B('bottcher', { c: String(REF.julia.c[0]) });
for (const p of REF.julia.points) {
  const z = C(p.z[0], p.z[1]), want = C(+p.phi[0], +p.phi[1]), got = bas.f(z);
  check(`φ_{−1}(${p.name}) to 1e−14`, rel(got, want) < 1e-14, `${ex(got)} vs ${ex(want)}`);
}
check('the reference has 10 points of Φ_M and 5 of φ_{−1}', REF.points.length === 10 && REF.julia.points.length === 5);
// Φ_M(z) = z + 1/2 + O(1/z) at ∞
check('Φ_M(1000i) − 1000i → 1/2', CX.abs(CX.sub(CX.sub(dh.f(C(0, 1000)), C(0, 1000)), C(0.5, 0))) < 1e-3);
// Φ_M is real on the real axis beyond the tip and on (1/4, ∞)
check('Φ_M(−2.5) is real, < −1', dh.f(C(-2.5, 0)).im === 0 && dh.f(C(-2.5, 0)).re < -1);
check('Φ_M(0.5) is real, > 1', dh.f(C(0.5, 0)).im === 0 && dh.f(C(0.5, 0)).re > 1);
// the symmetry Φ_M(z̄) = conj Φ_M(z)
for (const z of [C(0.4, 0.3), C(-1.7, 0.05), C(-0.75, 0.08)]) check(`Φ_M(z̄) = conj Φ_M(z) at ${ex(z)}`, rel(dh.f(CX.conj(z)), CX.conj(dh.f(z))) < 1e-15);

// ---- 2. NaN on M, past N steps, below the critical potential
for (const z of [C(0, 0), C(-1, 0), C(0.25, 0), C(-2, 0), C(0, 1), C(-0.1, 0.65), C(0.3, 0.05)]) check(`Φ_M is NaN on M at ${ex(z)}`, Number.isNaN(dh.f(z).re));
check('0.26 needs more than 8 steps: NaN with N = 8, a value with N = 64', Number.isNaN(B('dh', { N: 8 }).f(C(0.26, 0)).re) && CX.isFin(dh.f(C(0.26, 0))));
check('N is clamped to 64', B('dh', { N: 1000 }).vals.N === 64 && B('bottcher', { N: 0 }).vals.N === 1);
check('φ_{−1} is NaN on the basilica (0, −1, α)', [C(0, 0), C(-1, 0), C(-0.6180339887, 0)].every((z) => Number.isNaN(bas.f(z).re)));
// c = 0.5 is outside M: φ_c is the conformal map of {G_c > G_c(0)} only, |φ_c| > |Φ_M(0.5)|^{1/2} = e^{G_c(0)}
const cant = B('bottcher', { c: '0.5' }), rho = Math.sqrt(CX.abs(dh.f(C(0.5, 0))));
check('c = 0.5: the critical radius is |Φ_M(c)|^{1/2}', Math.abs(cant.dh.rho - rho) < 1e-15, cant.dh.rho);
check('c = 0.5: φ_c(0.05i) (below the critical potential: 0 is a saddle of G_c) is NaN', Number.isNaN(cant.f(C(0, 0.05)).re));
check('c = 0.5: φ_c(2i) is defined, beyond the critical radius', CX.abs(cant.f(C(0, 2))) > rho);
// φ_c(c) = Φ_M(c): the two steps agree
for (const c of [C(0.4, 0.3), C(-1.7, 0.05)]) check(`φ_c(c) = Φ_M(c) at ${ex(c)}`, rel(B('bottcher', { c: `${c.re}+${c.im}i` }).f(c), dh.f(c)) < 1e-15);
// the functional equation φ_c(z² + c) = φ_c(z)²
for (const z of [C(0.3, 0.9), C(1.65, 0), C(-1.3, 0.3)]) check(`φ_{−1}(z² − 1) = φ_{−1}(z)² at ${ex(z)}`, rel(bas.f(CX.add(CX.mul(z, z), C(-1, 0))), CX.mul(bas.f(z), bas.f(z))) < 1e-13);

// ---- 3. the steps: TeX, guarantees, a shared c
check('TeX: \\Phi_M(z)', dh.tex({ s: 'z', p: 4 }).s === '\\Phi_M\\left(z\\right)', dh.tex({ s: 'z', p: 4 }).s);
check('TeX: \\varphi_{-1}(z)', bas.tex({ s: 'z', p: 4 }).s === '\\varphi_{-1}\\left(z\\right)', bas.tex({ s: 'z', p: 4 }).s);
check('both are analytic and one-to-one', dh.props.analytic && dh.props.injective && bas.props.analytic && bas.props.injective);
check('neither has an inverse step, and both say why', !dh.inverse && !bas.inverse && /one-to-one/.test(dh.inverseNote));
check('the straight-line homotopy, identity at t = 0', CX.abs(CX.sub(dh.hom(0)(C(0.4, 0.3)), C(0.4, 0.3))) === 0 && rel(dh.hom(1)(C(0.4, 0.3)), dh.f(C(0.4, 0.3))) < 1e-15);
// d/dz after Φ_M: no formula, so numerical (the circle formula), against Φ_M′ by central differences
{
  check('Φ_M has no derivative formula and says d/dz is numerical', /numerically/.test(Funcs.derivativeStep({ type: 'dh', params: Funcs.defaults('dh') }).error || ''));
  const steps = [{ type: 'dh', params: Funcs.defaults('dh'), on: true }, { type: 'deriv', params: Funcs.defaults('deriv'), on: true }];
  const G = Funcs.stageFunctions(steps, steps.map((s) => Funcs.build(s)));
  // (away from M: the circle formula's circle must not reach M, where Φ_M is NaN)
  for (const z of [C(1, 1), C(-2.2, 2), C(0.01, 1.02)]) {
    const h = 1e-6, fd = CX.scale(CX.sub(dh.f(CX.add(z, C(h, 0))), dh.f(CX.sub(z, C(h, 0)))), 0.5 / h);
    check(`d/dz Φ_M at ${ex(z)} (numerical) matches central differences`, rel(G[2](z), fd) < 1e-5, `${ex(G[2](z))} vs ${ex(fd)}`);
  }
}
Expr.setNames({ get: (nm) => (nm === 'a' ? C(-1, 0) : undefined), display: (nm) => nm });
const named = B('bottcher', { c: 'a' });
check('c = a (a shared number) evaluates at its value and prints its name', !named.error && rel(named.f(C(0.1, 0.75)), bas.f(C(0.1, 0.75))) < 1e-15 && named.tex({ s: 'z', p: 4 }).s === '\\varphi_{a}\\left(z\\right)', named.error || named.tex({ s: 'z', p: 4 }).s);
Expr.setNames(null);

// ---- 4. landing points (each from the literature; the rays are traced by CX.dhRay, 44 levels)
// Misiurewicz points, which the ray reaches geometrically: to 1e−8.
//  1/2 → −2 and 1/6 → i: A. Douady and J. H. Hubbard, Étude dynamique des polynômes complexes (Orsay notes, 1984–85);
//  1/4 → the root of c³ + 2c² + 2c + 2 with Im c > 0, ≈ −0.2281554936539612 + 1.115142508039938i, where the dynamic
//  ray 1/4 lands at the critical value (D. Schleicher, Rational parameter rays of the Mandelbrot set, Astérisque 261,
//  2000; the value: the Virginia Tech "Julia set zoo", f_{1/4})
// Roots of hyperbolic components (parabolic): the ray converges like 1/D, so its landing point is extrapolated, to 1e−2.
//  0 → 1/4 (the cusp); 1/3, 2/3 → −3/4; 1/7, 2/7 → −1/8 + (3√3/8)i; 1/15, 2/15 → 1/4 + i/2: the p/q-limb's root
//  e^{2πip/q}/2 − e^{4πip/q}/4 is the landing point of the two rays of period q (Douady–Hubbard, ibid.; J. Milnor,
//  Periodic orbits, external rays and the Mandelbrot set, Astérisque 261, 2000)
const cubic = (() => { let c = C(-0.2, 1.1); for (let i = 0; i < 50; i++) { const f = CX.add(CX.add(CX.mul(CX.mul(c, c), CX.add(c, C(2, 0))), CX.scale(c, 2)), C(2, 0)); const d = CX.add(CX.add(CX.scale(CX.mul(c, c), 3), CX.scale(c, 4)), C(2, 0)); c = CX.sub(c, CX.div(f, d)); } return c; })();
check('the root of c³ + 2c² + 2c + 2 is the cited −0.2281554936539612 + 1.115142508039938i', CX.abs(CX.sub(cubic, C(-0.2281554936539612, 1.115142508039938))) < 1e-14, ex(cubic));
const r3 = Math.sqrt(3);
const LAND = [
  [{ p: 1, q: 2 }, C(-2, 0), 1e-8], [{ p: 1, q: 6 }, C(0, 1), 1e-8], [{ p: 5, q: 6 }, C(0, -1), 1e-8], [{ p: 1, q: 4 }, cubic, 1e-8],
  [{ p: 0, q: 1 }, C(0.25, 0), 1e-2], [{ p: 1, q: 3 }, C(-0.75, 0), 1e-2], [{ p: 2, q: 3 }, C(-0.75, 0), 1e-2],
  [{ p: 1, q: 7 }, C(-0.125, 3 * r3 / 8), 1e-2], [{ p: 2, q: 7 }, C(-0.125, 3 * r3 / 8), 1e-2],
  [{ p: 1, q: 15 }, C(0.25, 0.5), 1e-2], [{ p: 2, q: 15 }, C(0.25, 0.5), 1e-2],
];
for (const [th, want, tol] of LAND) {
  const ray = CX.dhRay(th, { levels: 44 }), L = CX.dhLanding(ray);
  check(`the ray ${th.p}/${th.q} lands at ${ex(want)} (to ${tol})`, !!L && CX.abs(CX.sub(L.z, want)) < tol, L ? `${ex(L.z)}, off ${CX.abs(CX.sub(L.z, want))}` : 'no landing');
}
// the basilica c = −1: the rays 1/3, 2/3 land at the α fixed point (1 − √5)/2, the ray 0 at β = (1 + √5)/2
// (Douady–Hubbard, ibid.; Milnor, Dynamics in One Complex Variable, 3rd ed., §18)
const al = (1 - Math.sqrt(5)) / 2, be = (1 + Math.sqrt(5)) / 2;
for (const [th, want, tol] of [[{ p: 1, q: 3 }, al, 1e-2], [{ p: 2, q: 3 }, al, 1e-2], [{ p: 0, q: 1 }, be, 1e-6], [{ p: 1, q: 2 }, -be, 1e-6]]) {
  const L = CX.dhLanding(CX.dhRay(th, { c: C(-1, 0), levels: 44 }));
  check(`the basilica's ray ${th.p}/${th.q} lands at ${want.toFixed(6)} (to ${tol})`, !!L && CX.abs(CX.sub(L.z, C(want, 0))) < tol, L ? ex(L.z) : 'no landing');
}

// ---- 5. rays: each point has the ray's angle, the potential falls, Φ_M = e^{L} e^{2πiθ} to 1e−12
for (const th of [{ p: 1, q: 3 }, { p: 1, q: 7 }, 0.1234567, { p: 1, q: 4 }]) {
  const ray = CX.dhRay(th, { levels: 16 }), t = typeof th === 'number' ? th : th.p / th.q;
  let worst = 0, down = true;
  for (let i = 0; i < ray.pts.length; i += 7) {
    const w = CX.bottcher(ray.pts[i], ray.pts[i], 4000), want = CX.exp(C(ray.pot[i], 2 * Math.PI * t));
    worst = Math.max(worst, rel(w, want));
    if (i && !(ray.pot[i] < ray.pot[i - 7])) down = false;
  }
  check(`the ray ${typeof th === 'number' ? th : th.p + '/' + th.q}: Φ_M on it is e^{L + 2πiθ}`, worst < 1e-12, worst);
  check(`the ray ${typeof th === 'number' ? th : th.p + '/' + th.q}: its potential falls`, down);
}
// a dynamic ray of c = 0.5 (outside M) stops above the critical potential
{
  const r = CX.dhRay({ p: 1, q: 3 }, { c: C(0.5, 0), levels: 30 });
  check('c = 0.5: the dynamic ray stops above G_c(0) and does not land', !r.full && r.pot[r.pot.length - 1] > Math.log(rho) && !CX.dhLanding(r));
}

// ---- 6. equipotentials: on their level, simple, closed, nested without crossing
function crosses(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.re - p.re) * (r.im - p.im) - (q.im - p.im) * (r.re - p.re));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}
// (P open: its last point does not join its first)
function crossings(P, Q, self, open = false) {
  let k = 0;
  for (let i = 0; i < P.length - (open ? 1 : 0); i++) {
    const a = P[i], b = P[(i + 1) % P.length];
    for (let j = self ? i + 2 : 0; j < Q.length; j++) {
      if (self && i === 0 && j === Q.length - 1) continue;
      if (crosses(a, b, Q[j], Q[(j + 1) % Q.length])) k++;
    }
  }
  return k;
}
const LEVELS = [1.02, 1.05, 1.2, 2];
const EQ = LEVELS.map((r) => CX.dhEquipotential(Math.log(r)));
LEVELS.forEach((r, i) => {
  const P = EQ[i];
  let worst = 0;
  for (const z of P) worst = Math.max(worst, Math.abs(CX.abs(CX.bottcher(z, z, 4000)) - r));
  check(`|Φ_M| = ${r} on its equipotential (${P.length} points)`, P.length >= 128 && worst < 1e-12, worst);
  check(`the equipotential ${r} does not cross itself`, crossings(P, P, true) === 0);
});
for (let i = 0; i < LEVELS.length; i++) for (let j = i + 1; j < LEVELS.length; j++) {
  check(`the equipotentials ${LEVELS[i]} and ${LEVELS[j]} do not cross`, crossings(EQ[i], EQ[j], false) === 0);
}
// nested: the lower level lies inside the higher one (winding number about a point of M, 0)
const wind = (P, z) => { let s = 0; for (let i = 0; i < P.length; i++) { const a = CX.sub(P[i], z), b = CX.sub(P[(i + 1) % P.length], z); s += Math.atan2(a.re * b.im - a.im * b.re, a.re * b.re + a.im * b.im); } return Math.round(s / (2 * Math.PI)); };
check('each equipotential winds once around 0 ∈ M', EQ.every((P) => wind(P, C(0, 0)) === 1));
check('the level 1.02 lies inside the level 2', EQ[0].every((z) => wind(EQ[3], z) === 1));
// a Julia equipotential (the basilica) and the ray 1/3 cross it once
{
  const P = CX.dhEquipotential(Math.log(1.1), { c: C(-1, 0) }), ray = CX.dhRay({ p: 1, q: 3 }, { c: C(-1, 0), levels: 12 });
  check('the basilica\'s equipotential 1.1 is simple and winds once around 0', crossings(P, P, true) === 0 && wind(P, C(0, 0)) === 1);
  check('the ray 1/3 crosses it exactly once', crossings(ray.pts, P, false, true) === 1);
}

console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
