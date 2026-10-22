'use strict';
// Review fix M6: the revised Λ rule (SPEC rev 2, 4.3) for candidates carrying Λ = log z with |Re Λ| > 60.
//  Re Λ > +60 (z ~ infinity): asymptotic cone (direction e^{i Im Λ}) for halfplanes and r = 0 sectors; bounded kinds
//   outside; complements of bounded kinds inside.
//  Re Λ < -60 (z ~ 0): the tangent cone at 0 for boundaries through 0 (halfplane line through 0, sector apex at 0);
//   otherwise the sign of the level AT z = 0.
// Truth: exact limits of the level sign along z = e^{u + iv}. Views zoomed out 32x and 64x on log of the shape.
//   node notes/proto/lead-rev/r5_lambda.js
const PI = Math.PI;
const cross = (d, x, y) => d[0] * y - d[1] * x;
function kindsOf(sh) {
  if (sh.kind === 'halfplane') {
    const d0 = [sh.b[0] - sh.a[0], sh.b[1] - sh.a[1]], l = Math.hypot(...d0), d = [d0[0] / l, d0[1] / l];
    const ca = cross(d, sh.a[0], sh.a[1]);
    return {
      // level(z) = cross(d, z) - ca; exact sign for z = r e^{iv}
      truth: (u, v) => { const cd = cross(d, Math.cos(v), Math.sin(v)); const r = Math.exp(u); const big = r * cd, val = big - ca; if (r === 0) return Math.abs(ca) > 0 ? -ca > 0 : cd > 0; if (!Number.isFinite(r)) return cd !== 0 ? cd > 0 : -ca > 0; return val > 0; },
      thru0: Math.abs(ca) <= 1e-12, dir: (v) => cross(d, Math.cos(v), Math.sin(v)) > 0, at0: () => -ca > 0, bounded: false,
    };
  }
  if (sh.kind === 'disc') {
    const L0 = sh.r - Math.hypot(sh.c[0], sh.c[1]);
    return { truth: (u, v) => { const r = Math.exp(u); return sh.r - Math.hypot(r * Math.cos(v) - sh.c[0], r * Math.sin(v) - sh.c[1]) > 0; }, thru0: Math.abs(L0) <= 1e-12, dir: () => false, at0: () => L0 > 0, bounded: true };
  }
  if (sh.kind === 'sector0') {                                         // apex sh.c, angles t1..t2 (<180), r = 0
    const inAng = (x, y) => { let a = Math.atan2(y, x) - sh.t1; a = ((a % (2 * PI)) + 2 * PI) % (2 * PI); return a > 0 && a < sh.t2 - sh.t1; };
    const apex0 = Math.hypot(sh.c[0], sh.c[1]) <= 1e-12;
    return { truth: (u, v) => { const r = Math.exp(u); return r === 0 ? (apex0 ? inAng(Math.cos(v), Math.sin(v)) : inAng(-sh.c[0], -sh.c[1])) : inAng(r * Math.cos(v) - sh.c[0], r * Math.sin(v) - sh.c[1]); },
      thru0: apex0, dir: (v) => inAng(Math.cos(v), Math.sin(v)), at0: () => inAng(-sh.c[0], -sh.c[1]), bounded: false };
  }
}
function run(name, sh, view, rule) {
  const K = kindsOf(sh);
  let spill = 0, holes = 0, n = 0;
  for (let j = 0; j < 516; j += 2) for (let i = 0; i < 410; i += 2) {
    const u = view.cx + (i + 0.5 - 205) / view.s, v = view.cy - (j + 0.5 - 258) / view.s;
    if (!(v > -PI && v <= PI)) continue;
    n++;
    const truth = K.truth(u, v);
    let got;
    if (Math.abs(u) <= 60) got = truth;
    else if (rule === 'old') got = K.bounded ? false : K.dir(v);
    else if (u > 60) got = K.bounded ? false : K.dir(v);
    else got = K.thru0 ? K.dir(v) : K.at0();
    if (got && !truth) spill++;
    if (!got && truth) holes++;
  }
  return { n, spill, holes };
}
const SH = [
  ['H (Im z > 0) [control]', { kind: 'halfplane', a: [0, 0], b: [1, 0] }],
  ['Im z > 1', { kind: 'halfplane', a: [0, 1], b: [1, 1] }],
  ['Re z < -1', { kind: 'halfplane', a: [-1, 0], b: [-1, 1] }],
  ['Re z > 1', { kind: 'halfplane', a: [1, 1], b: [1, 0] }],
  ['Im z > -1 (contains 0)', { kind: 'halfplane', a: [0, -1], b: [1, -1] }],
  ['disc |z-0.5|<1 (contains 0)', { kind: 'disc', c: [0.5, 0], r: 1 }],
  ['disc |z-3|<1', { kind: 'disc', c: [3, 0], r: 1 }],
  ['sector apex 0, 20..100 deg', { kind: 'sector0', c: [0, 0], t1: 20 * PI / 180, t2: 100 * PI / 180 }],
  ['sector apex 1+i, 20..100 deg', { kind: 'sector0', c: [1, 1], t1: 20 * PI / 180, t2: 100 * PI / 180 }],
];
for (const [f, nm] of [[32, '32x'], [64, '64x']]) for (const [name, sh] of SH) {
  const view = { cx: 0, cy: 0, s: 60 / f };
  const o = run(name, sh, view, 'old'), r = run(name, sh, view, 'new');
  console.log(`log of ${name.padEnd(30)} out ${nm}: px ${o.n}; SPEC rev1 rule: spill ${o.spill}, holes ${o.holes} | rev2 rule: spill ${r.spill}, holes ${r.holes}`);
}
