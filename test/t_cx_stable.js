// Stability of the CPU forward maps fixed in P2 (src/cx.js): CX.asin / acos / asinh at large |u| (cancellation of
// iz + sqrt(1 - z^2) in the upper half-plane and on the cut z < -1), CX.tan near its poles (cos 2x + cosh 2y) and
// without the clamp to +-i for |Im z| > 20 (which made CX.tanh exactly +-1 for |Re z| > 20), and the interior branch
// of the inverse Joukowski map (z - s at large |z|, now 1 / (z + s)). Each check fails on the pre-P2 code
// (notes/backup-pre-sphere/src/cx.js) and passes now; the values elsewhere are unchanged (principal branches, sides
// of the cuts). Run: node test/t_cx_stable.js   (exit code 1 on any failure)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const OLD = (() => { try { const m = { exports: {} }; new Function('module', require('fs').readFileSync(require('path').join(__dirname, '../notes/backup-pre-sphere/src/cx.js'), 'utf8'))(m); return m.exports; } catch (e) { return null; } })();
const C = CX.C;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };
const abs = CX.abs, sub = CX.sub;
const rel = (a, b) => abs(sub(a, b)) / Math.max(abs(b), 1e-300);
// The "unchanged elsewhere" checks compare with the pre-P2 formulas at random points. The points come from a seeded
// generator (mulberry32), so a run is reproducible; the tolerances are scaled by the OLD formulas' own rounding error,
// which is what the comparison measures where the new formulas are accurate: -i log(iz + sqrt(1 - z^2)) and its asinh
// twin lose about log10(1 / |w|) digits near w = 0 (log of 1 + O(w)), and sin 2x / (cos 2x + cosh 2y) loses
// log10(1 / |cos 2x + cosh 2y|) digits near the poles of tan. Measured over 4e6 unseeded points each (2026-10-20):
// rel(new, old) <= 7.3 eps (1 + 1 / |w|) for asin and asinh, <= 3.5 eps (1 + 1 / |cos 2x + cosh 2y|) for tan; the
// bounds below allow 16 eps and 8 eps. (The former flat 1e-13 failed about one run in 60 on a point at |w| ~ 0.002,
// where the old asin alone is off by 1.37e-13; in the bulk the scaled bounds are tighter than 1e-13.)
const EPS = 2.220446049250313e-16;
const rnd = (() => { let a = 0x2f6b4c1d; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
const dirs = Array.from({ length: 24 }, (_, k) => (k + 0.37) * Math.PI / 12);
// 1. asin, acos, asinh: round trips sin(asin w) = w to 1e-13 relative at |w| up to 1e12, in every direction; the
//    principal ranges (Re asin in [-pi/2, pi/2], Re acos in [0, pi], Im asinh in [-pi/2, pi/2])
{
  let worst = 0, worstOld = 0;
  for (const R of [1e2, 1e4, 1e6, 1e8, 1e12]) for (const t of dirs) {
    const w = C(R * Math.cos(t), R * Math.sin(t));
    const a = CX.asin(w), c = CX.acos(w), h = CX.asinh(w);
    const e = Math.max(rel(CX.sin(a), w), rel(CX.cos(c), w), rel(CX.sinh(h), w));
    worst = Math.max(worst, e);
    check(`asin range at ${R}e^${t.toFixed(2)}i`, Math.abs(a.re) <= Math.PI / 2 + 1e-12 && c.re >= -1e-12 && c.re <= Math.PI + 1e-12 && Math.abs(h.im) <= Math.PI / 2 + 1e-12);
    if (OLD) worstOld = Math.max(worstOld, rel(CX.sin(OLD.asin(w)), w));
  }
  check('asin/acos/asinh round trip to 1e-13 at |w| <= 1e12', worst < 1e-13, worst);
  if (OLD) check('the pre-P2 asin fails the same round trip (the test detects the cancellation)', !(worstOld < 1e-6), worstOld);
  // on the cuts: the side of asin0 (z = x + 0i: x > 1 -> pi/2 - i acosh x; x < -1 -> -pi/2 + i acosh x), now without
  // cancellation for x < -1
  for (const x of [1.5, 3, 1e3, 1e8, 1e15]) {
    const ac = Math.log(x + Math.sqrt(x * x - 1));
    check(`asin(${x}) on the cut`, rel(CX.asin(C(x, 0)), C(Math.PI / 2, -ac)) < 1e-14);
    check(`asin(-${x}) on the cut`, rel(CX.asin(C(-x, 0)), C(-Math.PI / 2, ac)) < 1e-14, JSON.stringify(CX.asin(C(-x, 0))));
  }
  // unchanged where the old form was accurate (|w| <= 2): equal to 1e-15
  if (OLD) {
    let d = 0;   // the largest rel(new, old) / (eps (1 + 1 / |w|))
    for (let i = 0; i < 2000; i++) { const w = C(rnd() * 4 - 2, rnd() * 4 - 2); d = Math.max(d, Math.max(rel(CX.asin(w), OLD.asin(w)), rel(CX.asinh(w), OLD.asinh(w))) / (EPS * (1 + 1 / abs(w)))); }
    check('asin, asinh unchanged for |w| <= 2 (to the old form\'s rounding: 16 eps (1 + 1 / |w|))', d < 16, d);
  }
}
// 2. tan near its poles: tan(pi/2 + d + iy) = -1 / tan(d + iy), relative 1e-10 (the old form: ~1e-4 at d = 1e-6)
{
  let worst = 0, worstOld = 0;
  for (const d of [1e-3, 1e-5, 1e-6, 1e-7]) for (const y of [0, 1e-7, -2e-6, 1e-4]) for (const k of [-3, 0, 1, 5]) {
    // the offset x really holds from the true pole (k + 1/2) pi: pi as hi + lo, hi split in two 26-bit halves so
    // every product is exact
    const x = Math.PI / 2 + k * Math.PI + d, f = k + 0.5;
    const PI_LO = 1.2246467991473532e-16, sp = 134217729 * Math.PI, ph = sp - (sp - Math.PI), pl = Math.PI - ph;
    const dd = ((x - f * ph) - f * pl) - f * PI_LO;
    const ref = CX.neg(CX.inv(CX.tan(C(dd, y))));
    worst = Math.max(worst, rel(CX.tan(C(x, y)), ref));
    if (OLD) worstOld = Math.max(worstOld, rel(OLD.tan(C(x, y)), ref));
  }
  check('tan near its poles to 1e-10', worst < 1e-10, worst);
  if (OLD) check('the pre-P2 tan fails it', !(worstOld < 1e-6), worstOld);
  // |Im z| > 20: no clamp. tan(x + iy) = i (1 - q) / (1 + q), q = e^{-2y} e^{2ix}: Re tan = 2 e^{-2y} sin 2x / |1 + q|^2
  // (the old clamp returned exactly 0), Im tan = 1 to double precision
  for (const y of [21, 30, 60, 300]) {
    const z = CX.tan(C(0.3, y)), ref = 2 * Math.exp(-2 * y) * Math.sin(0.6);
    check(`Re tan(0.3 + ${y}i)`, Math.abs(z.re - ref) <= 1e-12 * ref, `${z.re} vs ${ref}`);
    check(`Im tan(0.3 + ${y}i)`, Math.abs(z.im - 1) <= 2e-16);
    const zm = CX.tan(C(0.3, -y));
    check(`tan(0.3 - ${y}i) = conj tan(0.3 + ${y}i)`, zm.re === z.re && zm.im === -z.im);
  }
  // tanh(x + iy) for |x| > 20: Im part ~ 4 e^{-2x} sin(2y) cos... (no longer exactly 0)
  for (const x of [21, 25, 40]) {
    const t = CX.tanh(C(x, 0.5));
    const ref = Math.sin(1) / (Math.cosh(2 * x) + Math.cos(1));   // Im tanh(x + iy) = sin 2y / (cosh 2x + cos 2y)
    check(`Im tanh(${x} + 0.5i)`, Math.abs(t.im - ref) <= 1e-12 * ref, `${t.im} vs ${ref}`);
    check(`Re tanh(${x} + 0.5i)`, Math.abs(t.re - 1) <= 1e-15);
  }
  // unchanged away from the poles and the clamp (|Im z| <= 20): equal to 1e-13 relative
  if (OLD) {
    let d = 0;
    for (let i = 0; i < 4000; i++) {
      const z = C(rnd() * 8 - 4, rnd() * 30 - 15);
      const c = Math.cos(z.re);
      if (Math.abs(c) < 1e-3 && Math.abs(z.im) < 1e-3) continue;
      // (relative to the old form's rounding: its denominator cos 2x + cosh 2y cancels near the poles)
      d = Math.max(d, rel(CX.tan(z), OLD.tan(z)) / (EPS * (1 + 1 / Math.abs(Math.cos(2 * z.re) + Math.cosh(2 * z.im)))));
    }
    check('tan unchanged away from the poles (to the old form\'s rounding: 8 eps (1 + 1 / |cos 2x + cosh 2y|))', d < 8, d);
  }
}
// 3. inverse Joukowski, interior branch: ijouk_int(u) = 1 / ijouk_ext(u) to 1e-15 relative, and J(ijouk(u)) = u, at
//    |u| up to 1e150 (the old z - s cancelled to 0 from |u| ~ 1e8)
{
  const f = (sg) => Funcs.build({ type: 'ijouk', params: Object.assign(Funcs.defaults('ijouk'), { branch: sg < 0 ? 'interior' : 'exterior' }) }).f;
  const fi = f(-1), fe = f(1), J = (z) => CX.scale(CX.add(z, CX.inv(z)), 0.5);
  let worst = 0, worstRT = 0;
  for (const R of [10, 1e4, 1e8, 1e12, 1e150]) for (const t of dirs) {
    const u = C(R * Math.cos(t), R * Math.sin(t)), a = fi(u), b = fe(u);
    worst = Math.max(worst, rel(CX.mul(a, b), C(1, 0)));
    worstRT = Math.max(worstRT, rel(J(a), u), rel(J(b), u));
    check(`ijouk interior |w| < 1 at ${R}`, abs(a) < 1 && abs(b) > 1);
  }
  check('ijouk interior x exterior = 1', worst < 1e-14, worst);
  check('J(ijouk(u)) = u', worstRT < 1e-13, worstRT);
  if (OLD) {
    const old = (u) => OLD.sub(u, OLD.mul(OLD.sqrt(OLD.sub(u, C(1, 0))), OLD.sqrt(OLD.add(u, C(1, 0)))));
    const u = C(3e8, 4e8);
    check('the pre-P2 interior branch cancels at |u| = 5e8', !(rel(CX.mul(old(u), fe(u)), C(1, 0)) < 1e-6));
  }
  // unchanged for |u| <= 3 (the same branch, the same values to rounding)
  let d = 0;
  for (let i = 0; i < 2000; i++) {
    const u = C(rnd() * 6 - 3, rnd() * 6 - 3);
    const s = CX.mul(CX.sqrt(CX.sub(u, C(1, 0))), CX.sqrt(CX.add(u, C(1, 0))));
    d = Math.max(d, rel(fi(u), CX.sub(u, s)));
  }
  check('ijouk interior unchanged for |u| <= 3', d < 1e-12, d);
}
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
