// Natural paths (funcs.js, 2026-10-22): every step's homotopy H_t is analytic for each t (Cauchy-Riemann off its
// cuts), H_0 = id and H_1 = f exactly, continuous at both ends (including the tiny t of the first frames, where the
// series replace the cancelling forms), Joukowski closes the unit circle onto [-1, 1], the inverse Joukowski paths end
// on their branch, the rational zoom path never degenerates (no zero meets a pole: (z - 1)/(z - 2) collapses the plane
// to a point at t = 0.38 under the roots formula with a pole flying in), custom formulas are recognised, and the
// zeros-and-poles helper agrees with the catalog. Run: node test/t_natpaths.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const F = require('../src/funcs.js');
const { C } = CX;
let checks = 0, failed = 0;
const check = (name, cond, got) => { checks++; if (!cond) { failed++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pts = Array.from({ length: 80 }, () => C(rnd() * 5 - 2.5, rnd() * 5 - 2.5));
const S = (type, params = {}) => F.build({ type, params: Object.assign(F.defaults(type), params) });
const rel = (a, b) => CX.abs(CX.sub(a, b)) / (1 + CX.abs(b));

const TYPES = ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'arsinh', 'arcosh', 'artanh', 'joukowski', 'exp', 'log'];
const STEPS = TYPES.map((t) => [t, S(t)]).concat([
  ['ijouk exterior', S('ijouk', { branch: 'exterior' })], ['ijouk interior', S('ijouk', { branch: 'interior' })],
  ['poly z^3 - z', S('poly')], ['poly (z-1)(z-2)(z+3i)', S('poly', { co: '1, -3+3i, 2-9i, 6i' })],
  ['rational default', S('rational')], ['rational (z-2)/(z-1)', S('rational', { p: '1, -2', q: '1, -1' })], ['rational (z-1)/(z-2)', S('rational', { p: '1, -1', q: '1, -2' })],
  ['rational 1/(z^2+1)', S('rational', { p: '1', q: '1, 0, 1' })], ['custom cos z', S('custom', { expr: '\\cos z' })], ['custom rational', S('custom', { expr: '\\frac{z^2-1}{z^2+1}' })],
  ['custom e^z', S('custom', { expr: 'e^{z}' })], ['custom log z cut 90', S('custom', { expr: '\\log z', cut: 90 })], ['custom z^{-7}', S('custom', { expr: 'z^{-7}' })],
]);

// (a) the ends, exact; (b) continuity at the ends (t = 1e-7, 1 - 1e-7) and at the first frames (t = 4e-6);
// (c) analytic at t = 0.3, 0.5, 0.8 (CR by central differences, away from cuts: a jump makes both sides disagree)
for (const [name, b] of STEPS) {
  check(`${name}: built`, !b.error && typeof b.hom === 'function', b.error);
  if (b.error) continue;
  check(`${name}: a natural path (not the straight line)`, !!b.nat || ['exp', 'log'].includes(name), b.nat);
  let e0 = 0, e1 = 0, c0 = 0, c1 = 0, cr = 0, n = 0;
  for (const z of pts) {
    const f = b.f(z);
    if (!CX.isFin(f) || CX.abs(f) > 1e6) continue;
    e0 = Math.max(e0, CX.abs(CX.sub(b.hom(0)(z), z)));
    e1 = Math.max(e1, rel(b.hom(1)(z), f));
    c0 = Math.max(c0, rel(b.hom(4e-6)(z), z), rel(b.hom(1e-7)(z), z));
    c1 = Math.max(c1, rel(b.hom(1 - 1e-7)(z), f));
    for (const t of [0.3, 0.5, 0.8]) {
      const H = b.hom(t), h = 1e-6;
      const fx = CX.scale(CX.sub(H(C(z.re + h, z.im)), H(C(z.re - h, z.im))), 1 / (2 * h));
      const fy = CX.scale(CX.sub(H(C(z.re, z.im + h)), H(C(z.re, z.im - h))), 1 / (2 * h));
      if (!CX.isFin(fx) || !CX.isFin(fy) || CX.abs(fx) > 1e5) continue;
      n++;
      if (CX.abs(CX.sub(fy, CX.mul(C(0, 1), fx))) > 1e-4 * (1 + CX.abs(fx))) cr++;
    }
  }
  check(`${name}: H_0 = id`, e0 === 0, e0);
  check(`${name}: H_1 = f`, e1 < 1e-15, e1);
  check(`${name}: continuous at t = 0 (first frames)`, c0 < 1e-4, c0);
  check(`${name}: continuous at t = 1`, c1 < 1e-5, c1);
  // (a point next to a cut fails CR: at most a few of the samples)
  check(`${name}: analytic (Cauchy-Riemann)`, cr <= Math.max(2, 0.04 * n), { cr, n });
}

// (d) Joukowski: the unit circle closes onto [-1, 1] continuously (a lens through +-1), exterior stays outside
const J = S('joukowski');
let prevIm = Infinity, mono = true;
for (const t of [0.1, 0.3, 0.5, 0.7, 0.9, 0.99, 0.999999]) {
  let mx = 0;
  for (let k = 1; k < 64; k++) { const w = J.hom(t)(C(Math.cos(k * Math.PI / 64), Math.sin(k * Math.PI / 64))); mx = Math.max(mx, Math.abs(w.im)); }
  if (!(mx < prevIm)) mono = false;
  prevIm = mx;
}
check('Joukowski: the circle flattens monotonically onto [-1, 1]', mono && prevIm < 1e-5, prevIm);
check('Joukowski: +-1 fixed for every t', [0.2, 0.6].every((t) => rel(J.hom(t)(C(1, 0)), C(1, 0)) < 1e-12 && rel(J.hom(t)(C(-1, 0)), C(-1, 0)) < 1e-12));
check('Joukowski: large z keeps its digits (z/(1+t))', rel(J.hom(0.5)(C(1e9, -3e8)), CX.scale(C(1e9, -3e8), 1 / 1.5)) < 1e-9);
// (e) inverse Joukowski: just before t = 1 on the right branch everywhere (Re z < 0 too)
for (const br of ['exterior', 'interior']) {
  const b = S('ijouk', { branch: br });
  let e = 0;
  for (const z of pts) if (Math.abs(z.im) > 1e-3) e = Math.max(e, rel(b.hom(1 - 1e-9)(z), b.f(z)));
  check(`inverse Joukowski ${br}: ends on its branch`, e < 1e-6, e);
}
// (f) the rational zoom path never degenerates: |H_t'| > 0 at generic points for every t (a zero meeting a pole
// would make H_t constant)
for (const [p, q] of [['1, -2', '1, -1'], ['1, -1', '1, -2'], ['1, 0, -1', '1, 0, 1'], ['1', '1, 0, 1'], ['2, 1', '1, 0, 0, -1']]) {
  const b = S('rational', { p, q });
  let worst = Infinity;
  for (let i = 1; i < 100; i++) {
    const t = i / 100, H = b.hom(t), z = C(0.31, 0.47), h = 1e-6;
    const d = CX.abs(CX.scale(CX.sub(H(C(z.re + h, z.im)), H(C(z.re - h, z.im))), 1 / (2 * h)));
    worst = Math.min(worst, d);
  }
  check(`rational ${p} / ${q}: never constant`, worst > 1e-3, worst);
}
// (g) polynomials: the zoom path (a real centre with f'(p) > 0 for real coefficients: the path commutes with
// conjugation), the power path for a (z - c)^n, as the z^n step
const dH = (H, z) => CX.scale(CX.sub(H(C(z.re + 1e-6, z.im)), H(C(z.re - 1e-6, z.im))), 1 / 2e-6);
const conjSym = (b, t, zs) => zs.every((z) => rel(b.hom(t)(CX.conj(z)), CX.conj(b.hom(t)(z))) < 1e-12);
const P3 = S('poly', { co: '1, -3+3i, 2-9i, 6i' });
check('poly: the zoom path', P3.nat.kind === 'ratzoom' && P3.nat.dq === 0, P3.nat);
for (const co of ['1, 0, 1', '1, 0, -1, 0', '1, -2, 0', '1, -4, 3']) {
  const b = S('poly', { co });
  check(`poly ${co}: a real centre, f'(p) > 0, conjugation-symmetric`, b.nat.kind === 'ratzoom' && b.natData.p.im === 0 && b.natData.lam.re > 0 && [0.3, 0.5, 0.8].every((t) => conjSym(b, t, pts.slice(0, 20))), b.natData && b.natData.p);
}
// the default z^3 - z: H_0.5'(0) != 0 (under the old roots path a zero passed the fixed zero 0 there)
check('poly z^3 - z: H_0.5\'(0) != 0', CX.abs(dH(S('poly').hom(0.5), C(0, 0))) > 0.1);
// (z - 1)(z - 3): one critical point, p + (2 - p)/t, never a double zero at a generic t
const P13 = S('poly', { co: '1, -4, 3' });
check('poly (z-1)(z-3): H_t\' vanishes only at p + (2 - p)/t', [0.268, 0.5, 0.8].every((t) => { const c = CX.add(P13.natData.p, CX.scale(CX.sub(C(2, 0), P13.natData.p), 1 / t)); return CX.abs(dH(P13.hom(t), c)) < 1e-5 && CX.abs(dH(P13.hom(t), C(0.2679, 0))) > 1e-3; }));
for (const [name, b] of [['poly 1, 0, 0', S('poly', { co: '1, 0, 0' })], ['custom z^2', S('custom', { expr: 'z^2' })], ['custom z^3', S('custom', { expr: 'z^{3}' })]]) {
  const n = name.endsWith('3') ? 3 : 2, pw = S('pown', { n });
  check(`${name}: the power path of z^${n}`, b.nat && b.nat.kind === 'pow' && pts.every((z) => rel(b.hom(0.4)(z), pw.hom(0.4)(z)) < 1e-12), b.nat);
}
const Pc = S('poly', { co: '2, -4, 2' });
check('poly 2(z-1)^2: the power path about 1', Pc.nat.kind === 'pow' && rel(Pc.hom(0.5)(C(3, 1)), CX.add(C(0.5, 0), CX.mul(C(Math.SQRT2, 0), CX.pow(C(2, 1), C(1.5, 0), Math.PI, 0)))) < 1e-12);
// (g2) cos: the strip 0 < Re z < pi (arccos's range) never folds: |H_t'| > 0 on it for every t, and the pairs that the
// old path about -pi/2 sent to one point stay apart
const CO = S('cos');
let mcos = Infinity;
for (const t of [0.2, 0.4, 0.5, 0.7, 0.9, 0.99]) for (let i = 1; i < 30; i++) for (let j = -9; j <= 9; j++) mcos = Math.min(mcos, CX.abs(dH(CO.hom(t), C((i / 30) * Math.PI, j / 10))));
check('cos: |H_t\'| > 0 on (0, pi) x (-1, 1) for every t', mcos > 0.05, mcos);
check('cos: the old fold pairs stay apart', [0.4, 0.5, 0.7, 0.9].every((t) => { const zc = Math.PI / (2 * t) - Math.PI / 2, d = C(0.3, 0.2); return CX.abs(CX.sub(CO.hom(t)(CX.add(C(zc, 0), d)), CO.hom(t)(CX.sub(C(zc, 0), d)))) > 0.05; }));
// (g3) Joukowski on the disk: continuous across (-1, 1) and injective (pairs of disk points stay apart)
const JD = S('joukowski');
check('Joukowski: no tear across (-1, 1) inside the disk', [0.3, 0.5, 0.8].every((t) => [-0.6, 0, 0.5].every((x) => CX.abs(CX.sub(JD.hom(t)(C(x, 1e-9)), JD.hom(t)(C(x, -1e-9)))) < 1e-6)));
check('Joukowski: the disk points the principal branch overlapped stay apart', CX.abs(CX.sub(JD.hom(0.5)(C(-0.2723, -0.4193)), JD.hom(0.5)(C(-0.3405, 0.6683)))) > 0.05);
let mjd = Infinity;
for (const t of [0.3, 0.5, 0.8]) for (let r = 0.05; r < 0.95; r += 0.1) for (let k = 0; k < 24; k++) mjd = Math.min(mjd, CX.abs(dH(JD.hom(t), C(r * Math.cos(k * Math.PI / 12), r * Math.sin(k * Math.PI / 12)))));
check('Joukowski: |H_t\'| > 0 on the disk', mjd > 1e-3, mjd);
check('Joukowski: H_t(0) is finite for t < 1 (the pole arrives at t = 1)', CX.isFin(JD.hom(0.9)(C(0, 0))));
// (h) all at once = the composition of the paths at one t; its ends are id and F
const chain = [S('joukowski'), S('cos'), S('rational')];
const allAt = (t) => (z) => chain.reduce((w, b) => b.hom(t)(w), z);
const Fz = (z) => chain.reduce((w, b) => b.f(w), z);
check('all at once: H_0 = id, H_1 = F', pts.every((z) => CX.abs(CX.sub(allAt(0)(z), z)) === 0 && (!CX.isFin(Fz(z)) || rel(allAt(1)(z), Fz(z)) < 1e-14)));
// (i) the same map deforms the same way however it was entered (degree 1: the Moebius group; c J: the Joukowski
// path; z^n: the power path), and any analytic formula gets a natural path
const same = (b1, b2, ts = [0.3, 0.6]) => ts.every((t) => pts.every((z) => { const u = b1.hom(t)(z), v = b2.hom(t)(z); return !CX.isFin(v) || CX.abs(v) > 1e6 || rel(u, v) < 1e-9; }));
check('custom 1/z = the recip step', S('custom', { expr: '\\frac{1}{z}' }).nat.kind === 'mob' && same(S('custom', { expr: '\\frac{1}{z}' }), S('recip')));
check('rational (z-1)/(z-2) = the Moebius step', same(S('rational', { p: '1, -1', q: '1, -2' }), S('mobius', { a: '1', b: '-1', c: '1', d: '-2' })));
check('custom (z+1/z)/2 = the Joukowski step', same(S('custom', { expr: '\\frac{1}{2}\\left(z+\\frac{1}{z}\\right)' }), S('joukowski')));
const R2 = S('rational');
check('default rational (z^2+1)/z = 2J: the Joukowski path times 2^t, conjugation-symmetric outside the disk (the disk branch puts the cut on the lower semicircle)', R2.nat.kind === 'jouk' && [0.3, 0.5].every((t) => conjSym(R2, t, pts.slice(0, 30).filter((z) => CX.abs(z) > 1.05))) && rel(R2.hom(0.5)(C(2, 1)), CX.scale(JD.hom(0.5)(C(2, 1)), Math.SQRT2)) < 1e-12);
for (const e of ['e^{2z}', '\\sin(2z)', '2\\sin z', '\\cos z+1', '\\sqrt{z}', 'z^{1/2}', '\\sin(2z)+z', 'z\\,e^{z}']) {
  const b = S('custom', { expr: e });
  check(`custom ${e}: a natural path (the generic zoom), real centre for a real map`, b.nat && b.nat.kind === 'gzoom' && b.natData.p.im === 0 && conjSym(b, 0.5, pts.slice(0, 20).filter((z) => Math.abs(z.im) > 0.05)), b.nat);
}
check('custom sqrt z: zoom about 1 (its cut flies in from -infinity)', S('custom', { expr: '\\sqrt{z}' }).natData.p.re === 1);
const zp = F.zerosPolesNat(C(1, 0), [C(2, 0)], [C(1, 0)], (z) => CX.div(CX.sub(z, C(2, 0)), CX.sub(z, C(1, 0))));
check('zeros and poles of degree 1: the Moebius path of the rational step', zp.nat.kind === 'mob' && same(zp, S('rational', { p: '1, -2', q: '1, -1' })));
// (j) captions: every catalog step names its path; the fallback says it is a straight line and why
for (const t of Object.keys(F.DEFS)) {
  const b = S(t);
  if (b.error || b.op === 'deriv') continue;
  const r = b.homTex ? b.homTex('z') : null;
  check(`${t}: a caption phrase`, !!r && typeof r.tex === 'string' && r.tex.length > 10, r);
}
const cst = S('poly', { co: '3' });
check('a constant: the straight line, said so', !cst.nat && /straight-line/.test(cst.homTex('z').tex) && /no natural path/.test(cst.homTex('z').tex));
const odd = S('custom', { expr: '\\overline{z}+z' });
check('a formula that is not analytic: the straight line, said so', !odd.nat && /not analytic/.test(odd.homTex('z').tex), odd.homTex && odd.homTex('z').tex);
// all at once (finding: one letter, two meanings): the caption names f_k and p_k when asked
const rt = S('rational', { p: '1, 0, -1', q: '1, 0, 1' }).homTex('u', { f: 'f_{2}', p: 'p_{2}' }).tex, ct = S('cosh').homTex('u', { p: 'p_{1}' }).tex;
check('captions take the names f_k, p_k', /zoom/.test(rt) && !/[^_]f\(|[(+]p[)+-]/.test(rt.replace(/f_\{2\}/g, 'F').replace(/p_\{2\}/g, 'P')) && /p_\{1\}=/.test(ct), { rt, ct });
// (k) gate r1: a zoom centre lies off every cut of the formula, also where two cuts cancel (sqrt(z-1) sqrt(z+1) with
// the cut at 0 is analytic on (1, inf), but a point within float32 rounding of p = 2 put the factors on different sides)
for (const cut of [0, 360, 180, 90]) {
  const b = S('custom', { expr: '(z-1)^{1/2}(z+1)^{1/2}', cut });
  const p = b.natData && b.natData.p, th = (cut * Math.PI) / 180;
  const offAll = !!p && [-1, 1].every((s) => {
    const w = CX.add(p, C(s, 0));
    const d = Math.abs((((Math.atan2(w.im, w.re) - th) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    return CX.abs(w) > 0 && Math.min(d, 2 * Math.PI - d) >= 1e-3;
  });
  // each factor continuous within float32 rounding of p, so a GPU point next to p takes the CPU's sides
  const eps = 1e-7 * (1 + (p ? CX.abs(p) : 0));
  const cont = !!p && [-1, 1].every((s) => Array.from({ length: 8 }, (_, k) => C(Math.cos((k * Math.PI) / 4) * eps, Math.sin((k * Math.PI) / 4) * eps)).every((u) => {
    const a = CX.powReal(CX.add(p, C(s, 0)), 0.5, th), c = CX.powReal(CX.add(CX.add(p, u), C(s, 0)), 0.5, th);
    return CX.abs(CX.sub(a, c)) < 1e-3;
  }));
  check(`custom sqrt(z-1)sqrt(z+1) cut ${cut}: a generic zoom about a centre off both cuts`, b.nat && b.nat.kind === 'gzoom' && offAll && cont, p);
}
// the GPU's form above degree 24: u (q0 P[p,x] - p0 Q[p,x]) / n1 by synthetic division equals u N(e) of the CPU
{
  const quot = (cs, p, x) => { let b = C(0, 0), r = C(0, 0); for (let k = 0; k < cs.length - 1; k++) { b = CX.add(CX.mul(b, p), cs[k]); r = CX.add(CX.mul(r, x), b); } return r; };
  const horner = (cs, x) => cs.reduce((a, c) => CX.add(CX.mul(a, x), c), C(0, 0));
  const co = Array.from({ length: 31 }, () => C(rnd() * 2 - 1, rnd() * 2 - 1)), qo = Array.from({ length: 4 }, () => C(rnd() * 2 - 1, rnd() * 2 - 1));
  for (const [name, P, Q] of [['poly degree 30', co, [C(1, 0)]], ['rational 30/3', co, qo], ['rational 3/30', qo, co]]) {
    const d = F.ratZoomData(P, Q);
    let worst = d && d.n1 && d.p0 ? 0 : Infinity;
    if (worst === 0) for (const e of [C(1e-6, 2e-7), C(0.01, -0.003), C(0.4 * d.rN, 0.1 * d.rN)]) {
      const x = CX.add(d.p, e);
      const dd = CX.div(CX.sub(CX.mul(d.q0, quot(d.P, d.p, x)), CX.mul(d.p0, quot(d.Q, d.p, x))), d.n1);
      worst = Math.max(worst, rel(dd, horner(d.N, e)));
    }
    check(`${name}: the divided-difference form of N`, d && worst < 1e-9, worst);
  }
}

console.log(`\n${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
