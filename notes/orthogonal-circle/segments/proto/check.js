// Prototype of SPEC.md section 2 (the arc of a perpendicular circle K on one side of C), on the v16.3 core
// (work/xvhs/src/constr.js, read only). Run: node notes/orthogonal-circle/segments/proto/check.js <path to src>
'use strict';
const path = require('path');
const SRC = process.argv[2];
global.CX = require(path.join(SRC, 'cx.js'));
const K = require(path.join(SRC, 'constr.js'));
const INF = K.INF, isInf = K.isInf;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const f = (G, z) => { const u = [z[0] - G.o[0], z[1] - G.o[1]]; return G.A * (u[0] * u[0] + u[1] * u[1]) + 2 * (G.B[0] * u[0] + G.B[1] * u[1]) + G.C; };
const gr = (G, z) => { const u = [z[0] - G.o[0], z[1] - G.o[1]]; return 2 * Math.hypot(G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]); };
const dist = (G, z) => Math.abs(f(G, z)) / (gr(G, z) || 1);          // distance to the curve, to first order
const hyp = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// the chordal distance on the Riemann sphere (infinity included): continuity of an end that passes through infinity
const chord = (a, b) => { const q = (z) => (isInf(z) ? 0 : 1 / Math.sqrt(1 + z[0] * z[0] + z[1] * z[1])); if (isInf(a) && isInf(b)) return 0; if (isInf(a) || isInf(b)) return 2 * q(isInf(a) ? b : a); return 2 * hyp(a, b) * q(a) * q(b); };
const unit = { A: 1, B: [0, 0], C: -1, o: [0, 0] };
const realAxis = { A: 0, B: [0, -1], C: 0, o: [0, 0] };              // f = -2 Im z: f < 0 above (the left of 0 -> 1)

// seg(Gc, P, Q, side): the piece data of SPEC 2. side = +1: the arc where f_Gc < 0; -1: where f_Gc > 0
function seg(Gc, P, Q, side) {
  const r = K.perpForm(Gc, P, Q);
  if (r.undef) return { undef: r.undef };
  const G = r.G, pc = { kind: G.A === 0 ? 'line' : 'circle', G };
  const p3 = { mr: isInf(P) ? Q : P, s: isInf(P) || isInf(Q) ? 1 : hyp(P, Q), sg: 1 };
  const m = K.meets2(G, Gc);                                          // the existing rule: K's form first, then C's
  const uOf = (z) => (isInf(z) ? K.projectPiece(pc, [1e300, 0], p3) && 0.5 : K.projectPiece(pc, z, p3).t);
  // (for a line K the point at infinity is u = 1/2 of the M(R) map anchored at P)
  const u = m.map((z) => (isInf(z) ? 0.5 : uOf(z)));
  const at = (uu) => K.glide(pc, uu, p3);
  const span = (a, b) => ((((b - a) % 1) + 1) % 1);
  // the two arcs: u0 -> u1 and u1 -> u0 (increasing u); the side test at the middle (at 1/4 if the middle is infinity)
  const sideOf = (a, b) => { let z = at(a + span(a, b) / 2); if (!Array.isArray(z)) z = at(a + span(a, b) / 4); return Math.sign(f(Gc, z)) === -side; };
  const [s0, s1, e0, e1] = sideOf(u[0], u[1]) ? [u[0], u[1], m[0], m[1]] : [u[1], u[0], m[1], m[0]];
  const D = span(s0, s1);
  const glide = (t) => (t <= 0 ? e0 : t >= 1 ? e1 : at(s0 + t * D));
  const tOf = (z) => { const v = span(s0, uOf(z)); return v <= D ? v / D : NaN; };
  return { G, ends: [e0, e1], glide, tOf, D };
}

// 1. the disc model: random P, Q in |z| < 1
let worstEnd = 0, worstIn = 0, through = 0;
for (let i = 0; i < 2000; i++) {
  const rp = () => { const r = Math.sqrt(Math.random()) * 0.98, a = Math.random() * 6.283; return [r * Math.cos(a), r * Math.sin(a)]; };
  const P = rp(), Q = rp(), s = seg(unit, P, Q, +1);
  if (s.undef) continue;
  for (const e of s.ends) worstEnd = Math.max(worstEnd, dist(unit, e), dist(s.G, e));
  for (let k = 1; k < 20; k++) { const z = s.glide(k / 20); if (!(Math.hypot(z[0], z[1]) < 1)) worstIn++; }
  const tp = s.tOf(P), tq = s.tOf(Q);
  if (tp > 0 && tp < 1 && tq > 0 && tq < 1) through++;
}
console.log('disc model: worst end distance', worstEnd.toExponential(1), '| interior samples outside', worstIn, '| arcs through P and Q', through, '/ 2000');
ok(worstEnd < 4e-15 && worstIn === 0 && through === 2000, 'disc model');

// 2. a diameter (the decimal line case): P, Q on a line through 0
{
  const s = seg(unit, [0.3, 0.2], [0.6, 0.4], +1);
  console.log('diameter: K line', s.G.A === 0, 'ends', s.ends.map((z) => z.map((x) => +x.toFixed(15))), 'mid', s.glide(0.5));
  ok(s.G.A === 0 && Math.abs(Math.hypot(...s.ends[0]) - 1) < 1e-15 && Math.abs(Math.hypot(...s.ends[1]) - 1) < 1e-15, 'chord');
  const o = seg(unit, [0.3, 0.2], [0.6, 0.4], -1);                    // the other side: two rays through infinity
  const ms = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => o.glide(t));
  ok(ms.every((z) => !Array.isArray(z) || Math.hypot(z[0], z[1]) > 1), 'two rays: outside');
  console.log('diameter, outside: samples', ms.map((z) => (Array.isArray(z) ? z.map((x) => +x.toPrecision(4)) : 'inf')));
}

// 3. the half-plane model: a semicircle, and a vertical ray (PQ perpendicular to R)
{
  const s = seg(realAxis, [0.5, 1], [2, 0.5], +1);
  ok(s.ends.every((e) => Math.abs(e[1]) < 1e-15) && [0.25, 0.5, 0.75].every((t) => s.glide(t)[1] > 0), 'semicircle above');
  const v = seg(realAxis, [1, 1], [1, 2], +1);
  console.log('vertical: K line', v.G.A === 0, 'ends', v.ends, 't=0.5', v.glide(0.5));
  ok(v.G.A === 0 && v.ends.some(isInf) && [0.25, 0.5, 0.75].every((t) => v.glide(t)[1] > 0), 'vertical ray above');
}

// 4. continuity through the line case: the disc model, P on a diameter for a moment; a glider at t = 0.3 and the ends
for (const [name, Gc, Pf, Q] of [
  ['disc, P across the diameter through Q', unit, (x) => [0.3 + x, 0.2 - 1.5 * x], [0.6, 0.4]],
  ['half-plane, Q across the vertical through P', realAxis, (x) => [1 + x, 2], [1, 1]],
]) {
  let worst = 0, worstE = 0, prev = null;
  for (let k = -200; k <= 200; k++) {
    const x = k * 1e-4, s = seg(Gc, Pf(x), Q, +1);
    if (s.undef) { ok(false, name + ' undefined at ' + x); continue; }
    const g = s.glide(0.3), ends = s.ends;
    if (prev) {
      worst = Math.max(worst, hyp(g, prev.g));
      for (let j = 0; j < 2; j++) worstE = Math.max(worstE, chord(ends[j], prev.ends[j]));
    }
    prev = { g, ends };
  }
  console.log(name + ': glider step', worst.toExponential(2), '| end step (chordal)', worstE.toExponential(2), '(point step 1.8e-4 / 1e-4)');
  ok(worst < 5e-3 && worstE < 5e-3, name);
}

// 5. P dragged across C with the side fixed: no undefined frame, the arc stays inside
{
  let bad = 0;
  for (let k = 0; k <= 400; k++) {
    const r = 0.9 + k * 0.0005, P = [r * Math.cos(1), r * Math.sin(1)], s = seg(unit, P, [0.2, -0.3], +1);
    if (s.undef || ![0.2, 0.5, 0.8].every((t) => Math.hypot(...s.glide(t)) < 1)) bad++;
  }
  ok(bad === 0, 'P across C');
  console.log('P across C (r 0.9 .. 1.1): bad frames', bad);
}
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
