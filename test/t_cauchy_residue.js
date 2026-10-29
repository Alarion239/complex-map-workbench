// The Cauchy integral by the residue theorem (issue #235; src/calc.js cauchyPlan, cauchyValue, windingAt, simplifyLoop):
//   Φ(z) = n(γ, z) F(z) − Σ_k n(γ, p_k) PP_{p_k}(z)
// (a) windingAt against the sum of angles, on random polygons, self-crossing ones included;
// (b) the plan for 1/z, z + 1/z, (z + 1)/z², 1/(z² + 1), a pole outside the curve, a curve traversed clockwise and twice,
//     a figure eight (n = +1 and −1), a hand-drawn wobbly circle, an entire function, a dozen poles: the poles, their
//     orders, their principal parts, and Φ against the quadrature (Calc.cauchy) at random points;
// (c) the cases that must not use the formula: e^(1/z) and a square root (unverified: the quadrature stays), a pole on
//     the curve and F not finite on it (onCurve), a curve of two points;
// (d) simplifyLoop keeps the winding number of every point more than the tolerance from the polygon.
// Run: node test/t_cauchy_residue.js
global.CX = require('../src/cx.js');
const Calc = require('../src/calc.js');
const C = CX.C;
let n = 0, bad = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } };
const circle = (c, r, k, phase = 0) => Array.from({ length: k }, (_, i) => C(c.re + r * Math.cos(phase + 2 * Math.PI * i / k), c.im + r * Math.sin(phase + 2 * Math.PI * i / k)));
const inv = (z) => CX.div(C(1, 0), z);
const sub = (a, b) => C(a.re - b.re, a.im - b.im);
// a seeded generator
let seed = 12345;
const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const angleSum = (pts, z) => {
  let t = 0;
  for (let k = 0; k < pts.length; k++) {
    const a = sub(pts[k], z), b = sub(pts[(k + 1) % pts.length], z);
    t += Math.atan2(a.re * b.im - a.im * b.re, a.re * b.re + a.im * b.im);
  }
  return Math.round(t / (2 * Math.PI));
};

// ---- (a) winding numbers
{
  let wrong = 0, tested = 0, nonTrivial = 0;
  for (let trial = 0; trial < 60; trial++) {
    const m = 3 + Math.floor(rnd() * 14), pts = Array.from({ length: m }, () => C(rnd() * 4 - 2, rnd() * 4 - 2));
    for (let i = 0; i < 40; i++) {
      const z = C(rnd() * 5 - 2.5, rnd() * 5 - 2.5);
      if (Calc.points(pts).length < 3) continue;
      const w = Calc.windingAt(pts, z), a = angleSum(pts, z);
      tested++; if (w !== a) wrong++; if (Math.abs(w) > 1) nonTrivial++;
    }
  }
  check('windingAt equals the angle sum on random polygons', wrong === 0, `${wrong} of ${tested}`);
  check('(the random polygons do reach |n| > 1)', nonTrivial > 0, nonTrivial);
  const sq = [C(0, 0), C(1, 0), C(1, 1), C(0, 1)];
  check('windingAt: a square counter-clockwise 1, clockwise −1, outside 0', Calc.windingAt(sq, C(0.5, 0.5)) === 1 && Calc.windingAt([...sq].reverse(), C(0.5, 0.5)) === -1 && Calc.windingAt(sq, C(2, 0.5)) === 0);
  check('windingAt: a vertex level with z counts once (the ray through a vertex)', Calc.windingAt(sq, C(0.5, 1)) + Calc.windingAt(sq, C(0.5, 0)) === 1 && Calc.windingAt(sq, C(-0.5, 0)) === 0);
}

// ---- (b) the plan against the quadrature
const agree = (name, F, poly, expect) => {
  const plan = Calc.cauchyPlan(F, poly);
  check(`${name}: the formula is verified`, plan.ok, plan.why);
  if (!plan.ok) return plan;
  if (expect) check(`${name}: poles, orders, windings`, JSON.stringify(plan.poles.map((q) => [Math.round(q.z.re * 1e6) / 1e6, Math.round(q.z.im * 1e6) / 1e6, q.order, q.n]).sort()) === JSON.stringify(expect.sort()), plan.poles.map((q) => [q.z.re, q.z.im, q.order, q.n]));
  const pts = plan.loops[0];
  let worst = 0, k = 0;
  for (let i = 0; i < 40; i++) {
    const z = C(rnd() * 6 - 3, rnd() * 6 - 3);
    if (Calc.windingAt(pts, z) === undefined || plan.poles.some((q) => Math.hypot(q.z.re - z.re, q.z.im - z.im) < 0.05)) continue;
    const dBound = Math.min(...pts.map((p) => Math.hypot(p.re - z.re, p.im - z.im)));
    if (dBound < 0.05) continue;
    const a = Calc.cauchyValue(F, plan, z), b = Calc.cauchy(F, pts, z);
    worst = Math.max(worst, Math.hypot(a.re - b.re, a.im - b.im) / (1 + Math.hypot(b.re, b.im))); k++;
  }
  check(`${name}: Φ by the residue formula equals the quadrature at ${k} points (worst ${worst.toExponential(1)})`, k > 10 && worst < 1e-9, worst);
  return plan;
};
agree('1/z, unit circle', inv, circle(C(0, 0), 1, 64), [[0, 0, 1, 1]]);
agree('z + 1/z', (z) => CX.add(z, inv(z)), circle(C(0, 0), 1, 64), [[0, 0, 1, 1]]);
agree('(z + 1)/z²', (z) => CX.div(CX.add(z, C(1, 0)), CX.mul(z, z)), circle(C(0, 0), 1, 64), [[0, 0, 2, 1]]);
agree('1/(z² + 1), radius 2', (z) => CX.div(C(1, 0), CX.add(CX.mul(z, z), C(1, 0))), circle(C(0, 0), 2, 96), [[0, 1, 1, 1], [0, -1, 1, 1]]);
agree('1/(z² + 1), radius 0.5 (no pole inside)', (z) => CX.div(C(1, 0), CX.add(CX.mul(z, z), C(1, 0))), circle(C(0, 0), 0.5, 64), []);
agree('1/z around 3 (the pole outside)', inv, circle(C(3, 0), 0.5, 64), []);
agree('exp z (entire)', (z) => CX.exp(z), circle(C(0.3, 0.2), 1.4, 64), []);
{
  agree('1/z, clockwise', inv, circle(C(0, 0), 1, 64).reverse(), [[0, 0, 1, -1]]);
  const p2 = Calc.cauchyPlan(inv, [...circle(C(0, 0), 1, 64), ...circle(C(0, 0), 1, 64)]);
  check('1/z, traversed twice: n = 2', p2.ok && p2.poles.length === 1 && p2.poles[0].n === 2, p2.why);
  check('(inside the curve traversed twice Φ = 2 (F − PP) = 0 for 1/z, since F = PP)', p2.ok && CX.abs(Calc.cauchyValue(inv, p2, C(0.5, 0))) < 1e-12);
  const p3 = Calc.cauchyPlan((z) => CX.add(z, inv(z)), [...circle(C(0, 0), 1, 64), ...circle(C(0, 0), 1, 64)]);
  check('z + 1/z traversed twice: Φ = 2z inside', p3.ok && CX.abs(sub(Calc.cauchyValue((z) => CX.add(z, inv(z)), p3, C(0.5, 0.25)), C(1, 0.5))) < 1e-12);
}
{
  // a figure eight: the right lobe counter-clockwise (n = 1), the left clockwise (n = −1)
  const eight = Array.from({ length: 160 }, (_, i) => { const t = 2 * Math.PI * i / 160; return C(1.5 * Math.sin(t), 0.9 * Math.sin(t) * Math.cos(t) * 2); });
  const F = (z) => CX.add(inv(sub(z, C(0.8, 0))), CX.mul(C(2, 0), inv(sub(z, C(-0.8, 0)))));
  const wR = Calc.windingAt(eight, C(0.8, 0.0001)), wL = Calc.windingAt(eight, C(-0.8, 0.0001));
  check('the figure eight: the two lobes wind the other way round', wR === -wL && Math.abs(wR) === 1, [wR, wL]);
  const pl = agree('figure eight, a pole in each lobe', F, eight, null);
  check('(their windings are +1 and −1, the residues 1 and 2)', pl.ok && pl.poles.length === 2 && pl.poles.map((q) => q.n).sort().join() === '-1,1', pl.poles && pl.poles.map((q) => q.n));
}
{
  // a hand-drawn wobbly circle: 500 vertices, jitter; F = z (entire) and F = 1/(z − 0.1)
  const wob = Array.from({ length: 500 }, (_, i) => { const t = 2 * Math.PI * i / 500, r = 1 + 0.15 * Math.sin(3 * t) + 0.01 * (rnd() - 0.5); return C(r * Math.cos(t), r * Math.sin(t)); });
  const p1 = agree('wobbly circle, F = z', (z) => z, wob, []);
  agree('wobbly circle, F = 1/(z − 0.1)', (z) => inv(sub(z, C(0.1, 0))), wob, [[0.1, 0, 1, 1]]);
  // outside, exactly 0 for F = z (the node quadrature missed 0 by 1e-3 here)
  check('wobbly circle, F = z: Φ is exactly 0 outside', p1.ok && Calc.cauchyValue((z) => z, p1, C(1.7, 0.9)).re === 0 && Calc.cauchyValue((z) => z, p1, C(1.7, 0.9)).im === 0);
}
{
  // a dozen poles on a circle of radius 0.6, all inside the unit circle
  const ps = Array.from({ length: 12 }, (_, k) => C(0.6 * Math.cos(2 * Math.PI * k / 12 + 0.2), 0.6 * Math.sin(2 * Math.PI * k / 12 + 0.2)));
  const F = (z) => ps.reduce((s, p, k) => CX.add(s, CX.div(C(k + 1, 0), sub(z, p))), C(0, 0));
  const pl = agree('twelve simple poles', F, circle(C(0, 0), 1, 96), null);
  check('twelve poles found, with residues 1…12', pl.ok && pl.poles.length === 12 && pl.poles.map((q) => Math.round(q.a[0].re)).sort((a, b) => a - b).join() === '1,2,3,4,5,6,7,8,9,10,11,12', pl.ok ? pl.poles.length : pl.why);
}
{
  // an annulus (the boundary of a region with a hole): the outer circle counter-clockwise, the inner clockwise
  const loops = [circle(C(0, 0), 2, 96), circle(C(0, 0), 0.7, 64).reverse()];
  const F = (z) => CX.add(inv(sub(z, C(1.2, 0))), inv(sub(z, C(0.1, 0.1))));   // a pole in the annulus, one in the hole
  const pl = Calc.cauchyPlan(F, { loops });
  check('an annulus: only the pole in the ring counts (n = 1; the one in the hole has n = 0)', pl.ok && pl.poles.length === 1 && Math.abs(pl.poles[0].z.re - 1.2) < 1e-9 && pl.poles[0].n === 1, pl.ok ? pl.poles : pl.why);
  let worst = 0;
  for (const z of [C(0.3, 0.2), C(1.5, 1.2), C(-1.1, 0.4), C(3, 2), C(0, 0)]) {
    let q = C(0, 0); for (const l of loops) { const v = Calc.cauchy(F, l, z); q = C(q.re + v.re, q.im + v.im); }
    const a = Calc.cauchyValue(F, pl, z); worst = Math.max(worst, CX.abs(sub(a, q)));
  }
  check('the annulus: Φ = the quadrature over both boundary circles', pl.ok && worst < 1e-9, worst);
}
// ---- (c) the cases that keep the quadrature or say "not available"
{
  const e = Calc.cauchyPlan((z) => CX.exp(inv(z)), circle(C(0, 0), 1, 64));
  check('e^(1/z): an essential singularity is unverified (the quadrature stays)', !e.ok && e.why === 'unverified', e);
  const s = Calc.cauchyPlan((z) => CX.sqrt(z), circle(C(0, 0), 1, 64));
  check('√z: the branch cut makes the formula unverified', !s.ok && s.why === 'unverified', s);
  const on = Calc.cauchyPlan((z) => inv(sub(z, C(1, 0))), circle(C(0, 0), 1, 64));
  check('a pole on the curve: not available', !on.ok && on.why === 'onCurve', on);
  const ring = circle(C(0, 0), 1, 64), mid = C(0.5 * (ring[0].re + ring[1].re), 0.5 * (ring[0].im + ring[1].im));
  const near = Calc.cauchyPlan((z) => inv(sub(z, mid)), ring);
  check('a pole on an edge of the curve (not at a vertex): not available', !near.ok && near.why === 'onCurve', near);
  const out = Calc.cauchyPlan((z) => inv(sub(z, C(1.001, 0))), ring);
  check('a pole just outside the curve is fine: no winding, no term', out.ok && out.poles.length === 0, out.why);
  check('two points are not a curve', Calc.cauchyPlan((z) => z, [C(0, 0), C(1, 0)]).why === 'curve');
  const nf = Calc.cauchyPlan((z) => CX.div(C(1, 0), CX.mul(z, C(0, 0))), circle(C(0, 0), 1, 64));
  check('F not finite on the curve: not available', !nf.ok && nf.why === 'onCurve', nf);
}
// ---- (d) simplifying the polygon keeps the winding number away from it
{
  const wob = Array.from({ length: 1200 }, (_, i) => { const t = 2 * Math.PI * i / 1200, r = 1 + 0.2 * Math.sin(5 * t) + 0.004 * (rnd() - 0.5); return C(r * Math.cos(t), r * Math.sin(t)); });
  const tol = 0.01, s = Calc.simplifyLoop(wob, tol);
  check(`simplifyLoop: 1200 vertices → ${s.length}`, s.length < 400 && s.length > 20, s.length);
  let wrong = 0, tested = 0;
  for (let i = 0; i < 4000; i++) {
    const z = C(rnd() * 3.4 - 1.7, rnd() * 3.4 - 1.7);
    const d = Math.min(...wob.map((p) => Math.hypot(p.re - z.re, p.im - z.im)));
    if (d < 3 * tol) continue;
    tested++; if (Calc.windingAt(s, z) !== Calc.windingAt(wob, z)) wrong++;
  }
  check('simplifyLoop: the winding number of every point 3 tol from the curve is the same', wrong === 0 && tested > 1000, `${wrong} of ${tested}`);
  check('simplifyLoop: a short polygon and tol 0 are returned as they are', Calc.simplifyLoop([C(0, 0), C(1, 0), C(1, 1)], 0.1).length === 3 && Calc.simplifyLoop(wob, 0).length === 1200);
}
// ---- (e) the fast path: the same plan for a moved curve or a slightly changed F, without the search and the check
{
  const F = (z) => CX.add(inv(sub(z, C(0.3, 0.1))), CX.mul(C(2, 0), inv(sub(z, C(-0.4, 0.2)))));
  const full = Calc.cauchyPlan(F, circle(C(0, 0), 1, 128));
  check('(e) the full plan has its memo: the box, two poles with their principal parts', full.ok && full.memo && full.memo.verdict === 'ok' && full.memo.all.length === 2, full.why);
  // the curve moves (a drag) and grows: the fast plan equals a full one
  let worst = 0, cnt = 0;
  for (const [c, r] of [[C(0.1, 0), 1], [C(-0.2, 0.1), 1.1], [C(0.15, -0.1), 0.9], [C(0.3, 0.1), 0.12]]) {
    const ring = circle(c, r, 128), fast = Calc.cauchyPlanFast(F, ring, full.memo), slow = Calc.cauchyPlan(F, ring);
    if (!fast || !fast.ok) { worst = Infinity; continue; }
    for (const z of [C(0.5, 0.9), C(-1.4, 0.3), C(0.05, -0.2), C(2, 2)]) {
      if (distToRing(ring, z) < 0.05) continue;
      cnt++; worst = Math.max(worst, CX.abs(sub(Calc.cauchyValue(F, fast, z), Calc.cauchyValue(F, slow, z))));
    }
    check(`(e) a curve moved to ${c.re},${c.im} r=${r}: the poles inside are the same as in the full plan`, JSON.stringify(fast.poles.map((q) => [q.z.re, q.z.im, q.n]).sort()) === JSON.stringify(slow.poles.map((q) => [q.z.re, q.z.im, q.n]).sort()), [fast.poles.length, slow.poles.length]);
  }
  check(`(e) the fast plan's Φ equals the full plan's at ${cnt} points (worst ${worst.toExponential(1)})`, cnt > 8 && worst < 1e-12, worst);
  // out of the box: null (the caller plans in full)
  check('(e) a curve that leaves the memo\'s box gets no fast plan', Calc.cauchyPlanFast(F, circle(C(0, 0), 3, 64), full.memo) === null);
  // a curve dragged over a pole of the memo: on the curve
  const onP = Calc.cauchyPlanFast(F, circle(C(0.3 - 0.5, 0.1), 0.5, 128, 0), full.memo);
  check('(e) a curve passing through a pole is "onCurve" (the pole at 0.3 + 0.1i is the circle\'s point at angle 0)', onP && !onP.ok && onP.why === 'onCurve', onP);
  // F changes a little (a slider): the poles are followed
  const G = (z) => CX.add(inv(sub(z, C(0.32, 0.11))), CX.mul(C(2, 0), inv(sub(z, C(-0.43, 0.17)))));
  const memoG = Calc.cauchyTrack(G, full.memo), ring = circle(C(0, 0), 1, 128), fastG = memoG && Calc.cauchyPlanFast(G, ring, memoG), slowG = Calc.cauchyPlan(G, ring);
  check('(e) the tracked poles are the moved ones', !!memoG && memoG.all.some((q) => Math.abs(q.z.re - 0.32) < 1e-9 && Math.abs(q.z.im - 0.11) < 1e-9) && memoG.all.some((q) => Math.abs(q.z.re + 0.43) < 1e-9 && Math.abs(q.z.im - 0.17) < 1e-9), memoG && memoG.all.map((q) => [q.z.re, q.z.im]));
  check('(e) the tracked plan equals the full one for the new F', !!fastG && fastG.ok && CX.abs(sub(Calc.cauchyValue(G, fastG, C(0.7, 0.8)), Calc.cauchyValue(G, slowG, C(0.7, 0.8)))) < 1e-12);
  // a pole that moved far or vanished: the track gives up
  const H = (z) => inv(sub(z, C(0.9, 0.9)));
  check('(e) a pole that jumped far: no track (the caller plans in full)', Calc.cauchyTrack(H, full.memo) === null);
  // unverified F stays unverified on the fast path (no search, no check)
  const E = (z) => CX.exp(inv(z)), ue = Calc.cauchyPlan(E, circle(C(0, 0), 1, 64));
  const fe = Calc.cauchyPlanFast(E, circle(C(0.05, 0), 1, 64), ue.memo);
  check('(e) e^(1/z): the full plan is unverified and its memo keeps that', !ue.ok && ue.memo && ue.memo.verdict === 'unverified' && !!fe && !fe.ok && fe.why === 'unverified' && fe.fast === true, fe);
  // speed: the fast plan of a 600-gon and 8 poles is a few milliseconds
  const ps = Array.from({ length: 8 }, (_, k) => C(0.5 * Math.cos(k), 0.5 * Math.sin(k)));
  const F8 = (z) => ps.reduce((a, p, k) => CX.add(a, CX.div(C(k + 1, 0), sub(z, p))), C(0, 0));
  const big = circle(C(0, 0), 1, 600), m8 = Calc.cauchyPlan(F8, big).memo;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 20; i++) Calc.cauchyPlanFast(F8, circle(C(0.01 * i, 0), 1, 600), m8);
  const msPer = Number(process.hrtime.bigint() - t0) / 1e6 / 20;
  check(`(e) the fast plan of a 600-gon with 8 poles takes ${msPer.toFixed(2)} ms (under 3)`, msPer < 3, msPer);
}
function distToRing(ring, z) { let d = Infinity; for (const p of ring) d = Math.min(d, Math.hypot(p.re - z.re, p.im - z.im)); return d; }
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
