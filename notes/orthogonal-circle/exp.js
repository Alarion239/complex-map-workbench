// Experiment for DESIGN.md: the circle through P and Q perpendicular to C, two ways.
//   A: circle3(P, Q, P*) with P* the inverse of P in C (the definition proposed in the task)
//   B: the null vector of three linear conditions on the form (A, Bx, By, C): f(P) = 0, f(Q) = 0, <f, G> = 0
// Measured exactly: cos of the angle between K and C, from the float coefficients, in BigInt (no evaluation error);
// the distances of P and Q from K, relative to |P - Q|. Run: node notes/orthogonal-circle/exp.js
'use strict';
const path = require('path');
const K = require(path.join(__dirname, '../v16.1-candidate/src/constr.js'));
const INF = K.INF, isInf = K.isInf;

// ---------------------------------------------------------------- exact dyadic numbers m * 2^e (BigInt m)
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
function D(x) {
  if (x === 0) return { m: 0n, e: 0 };
  F64[0] = x;
  const lo = U32[0], hi = U32[1], ex = (hi >>> 20) & 0x7ff;
  let m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), e;
  if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; }
  return { m: hi >>> 31 ? -m : m, e };
}
const dmul = (a, b) => ({ m: a.m * b.m, e: a.e + b.e });
function dadd(a, b) {
  if (a.m === 0n) return b; if (b.m === 0n) return a;
  if (a.e < b.e) [a, b] = [b, a];
  return { m: (a.m << BigInt(a.e - b.e)) + b.m, e: b.e };
}
const dneg = (a) => ({ m: -a.m, e: a.e });
const dsub = (a, b) => dadd(a, dneg(b));
function dnum(a) {
  if (a.m === 0n) return 0;
  const neg = a.m < 0n, M = neg ? -a.m : a.m, sh = Math.max(0, M.toString(2).length - 60);
  return (neg ? -1 : 1) * Number(M >> BigInt(sh)) * 2 ** (a.e + sh);
}
// a form G = {A, B, C, o} re-anchored exactly at o2 (dyadic coefficients)
function dForm(G, o2) {
  const A = D(G.A), Bx = D(G.B[0]), By = D(G.B[1]), C = D(G.C);
  const dx = dsub(D(o2[0]), D(G.o[0])), dy = dsub(D(o2[1]), D(G.o[1]));
  const B2x = dadd(Bx, dmul(A, dx)), B2y = dadd(By, dmul(A, dy));
  const C2 = dadd(dadd(dmul(A, dadd(dmul(dx, dx), dmul(dy, dy))), dmul(D(2), dadd(dmul(Bx, dx), dmul(By, dy)))), C);
  return { A, Bx: B2x, By: B2y, C: C2 };
}
// cos of the angle between two forms (exact numerator and norms, one rounding at the end)
function cosAngle(G1, G2) {
  const o = G2.o, a = dForm(G1, o), b = dForm(G2, o);
  const ip = dsub(dadd(dmul(a.Bx, b.Bx), dmul(a.By, b.By)), dmul(D(0.5), dadd(dmul(a.A, b.C), dmul(b.A, a.C))));
  const n1 = dsub(dadd(dmul(a.Bx, a.Bx), dmul(a.By, a.By)), dmul(a.A, a.C));
  const n2 = dsub(dadd(dmul(b.Bx, b.Bx), dmul(b.By, b.By)), dmul(b.A, b.C));
  return dnum(ip) / Math.sqrt(dnum(n1) * dnum(n2));
}
// distance of z from the curve of G (exact f, |grad f| in float), and z = INF: |A| (0 when the curve is a line)
function distTo(G, z) {
  if (isInf(z)) return Math.abs(G.A);
  const a = dForm(G, z);                      // anchored at z: f(z) = C
  const g = Math.hypot(dnum(a.Bx), dnum(a.By));
  return Math.abs(dnum(a.C)) / (2 * g);
}

// ---------------------------------------------------------------- the two definitions
// P* = P - f(P) g / |g|^2, g = A (P - o) + B (inversion in a circle, reflection in a line); INF at the centre
function inv(G, P) {
  if (isInf(P)) return G.A === 0 ? INF : K.geomOf(G).c;
  const u = [P[0] - G.o[0], P[1] - G.o[1]];
  const f = G.A * (u[0] * u[0] + u[1] * u[1]) + 2 * (G.B[0] * u[0] + G.B[1] * u[1]) + G.C;
  const g = [G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]], g2 = g[0] * g[0] + g[1] * g[1];
  if (!(g2 > 0)) return INF;
  return [P[0] - f * g[0] / g2, P[1] - f * g[1] / g2];
}
const defA = (G, P, Q) => K.circle3(P, Q, inv(G, P));
// B: rows lift(P), lift(Q), pol(G) in the frame of G's anchor; the null vector by cofactors; anchored at P after
const lift = (z, o) => (isInf(z) ? [1, 0, 0, 0] : (() => { const u = [z[0] - o[0], z[1] - o[1]]; return [u[0] * u[0] + u[1] * u[1], 2 * u[0], 2 * u[1], 1]; })());
const det3 = (a, b, c) => a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
function defB(G, P, Q) {
  const o = G.o, r1 = lift(P, o), r2 = lift(Q, o), r3 = [-G.C / 2, G.B[0], G.B[1], -G.A / 2];
  const col = (r, j) => r.filter((_, k) => k !== j);
  const v = [0, 1, 2, 3].map((j) => (j % 2 ? -1 : 1) * det3(col(r1, j), col(r2, j), col(r3, j)));
  // v = (A, Bx, By, C); sign: K agrees with circle3(P, Q, P*) for P inside C (checked below), else continuous
  const g = gcN(-v[0], [-v[1], -v[2]], -v[3], o);
  if (!g) return null;
  // anchor at the first finite point, C = 0 there (it passes through it exactly, as circle3 does)
  const p = !isInf(P) ? P : Q;
  const du = [p[0] - g.o[0], p[1] - g.o[1]];
  return { A: g.A, B: [g.B[0] + g.A * du[0], g.B[1] + g.A * du[1]], C: 0, o: p.slice() };
}
// B2: anchored at P (C = 0 there: f(P) = 0 by construction); the remaining two conditions on (A, Bx, By) are
// (|d|^2, 2d) . (A, B) = 0 (through Q, d = Q - P) and (-C'/2, B') . (A, B) = 0 (perpendicular to G anchored at P:
// G' = (A', B', C')), so (A, B) is their cross product: A = 2 cross(d, B'), B = (-dy C' - |d|^2 B'y, |d|^2 B'x + dx C')
function gAt(G, P, exact) {
  if (exact) { const a = dForm(G, P); return { A: G.A, B: [dnum(a.Bx), dnum(a.By)], C: dnum(a.C) }; }
  const u = [P[0] - G.o[0], P[1] - G.o[1]];
  return { A: G.A, B: [G.B[0] + G.A * u[0], G.B[1] + G.A * u[1]], C: G.A * (u[0] * u[0] + u[1] * u[1]) + 2 * (G.B[0] * u[0] + G.B[1] * u[1]) + G.C };
}
function perp2(G, P, Q, exact) {
  let sg = 1;
  if (isInf(P)) { [P, Q] = [Q, P]; sg = -1; }
  if (isInf(P)) return null;
  const H = gAt(G, P, exact);
  let A, Bx, By;
  if (isInf(Q)) { A = 0; Bx = -H.B[1]; By = H.B[0]; }
  else {
    const d = [Q[0] - P[0], Q[1] - P[1]], dd = d[0] * d[0] + d[1] * d[1];
    A = 2 * (d[0] * H.B[1] - d[1] * H.B[0]);
    Bx = -d[1] * H.C - dd * H.B[1];
    By = dd * H.B[0] + d[0] * H.C;
  }
  const g = gcN(sg * SIGN * A, [sg * SIGN * Bx, sg * SIGN * By], 0, P);
  return g;
}
let SIGN = 1;
// Z: the same cross product with every step exact (dyadic BigInt: d = Q - P, G re-anchored at P, the products), one
// rounding per coefficient at the end; a float filter in front of it in the app (below: how often it is needed)
let zExact = 0, zFloat = 0;
const FILTER = process.env.FILTER === undefined ? 0 : +process.env.FILTER;   // 0 (the proposal): always exact; 1e-3: a float filter
function perpZ(G, P, Q) {
  let sg = 1;
  if (isInf(P)) { [P, Q] = [Q, P]; sg = -1; }
  if (isInf(P)) return null;
  // G re-anchored at P exactly (one rounding per coefficient); the cross product in float when B clears its rounding
  // bound by 1e4 (so |cos| <= ~1e-12), else exactly
  const a = dForm(G, P), H = { B: [dnum(a.Bx), dnum(a.By)], C: dnum(a.C) };
  if (!isInf(Q)) {
    const d = [Q[0] - P[0], Q[1] - P[1]], dd = d[0] * d[0] + d[1] * d[1];
    const t = Math.abs(d[1] * H.C) + Math.abs(dd * H.B[1]) + Math.abs(dd * H.B[0]) + Math.abs(d[0] * H.C);
    const A = 2 * (d[0] * H.B[1] - d[1] * H.B[0]), Bx = -d[1] * H.C - dd * H.B[1], By = dd * H.B[0] + d[0] * H.C;
    if (FILTER && Math.hypot(Bx, By) > FILTER * t) { zFloat++; return gcN(sg * A, [sg * Bx, sg * By], 0, P); }
  }
  zExact++;
  let A, Bx, By;
  if (isInf(Q)) { A = { m: 0n, e: 0 }; Bx = dneg(a.By); By = a.Bx; }
  else {
    const dx = dsub(D(Q[0]), D(P[0])), dy = dsub(D(Q[1]), D(P[1])), dd = dadd(dmul(dx, dx), dmul(dy, dy));
    A = dmul(D(2), dsub(dmul(dx, a.By), dmul(dy, a.Bx)));
    Bx = dsub(dneg(dmul(dy, a.C)), dmul(dd, a.By));
    By = dadd(dmul(dd, a.Bx), dmul(dx, a.C));
  }
  if (A.m === 0n && Bx.m === 0n && By.m === 0n) return null;      // the pencil (Q = P*) or P = Q, exactly
  return gcN(sg * dnum(A), [sg * dnum(Bx), sg * dnum(By)], 0, P);
}
const flipF = (g) => (g ? { A: -g.A, B: [-g.B[0], -g.B[1]], C: -g.C, o: g.o } : g);
const defZ = perpZ;
const defB2 = (G, P, Q) => perp2(G, P, Q, true);
const defB2f = (G, P, Q) => perp2(G, P, Q, false);
function gcN(A, B, C, o) {
  const N2 = B[0] * B[0] + B[1] * B[1] - A * C;
  if (!(N2 > 0) || !Number.isFinite(N2)) return null;
  const s = 1 / Math.sqrt(N2);
  return { A: A * s, B: [B[0] * s, B[1] * s], C: C * s, o: o.slice() };
}

// ---------------------------------------------------------------- cases
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const R = (a, b) => a + (b - a) * rnd();
const circle = (c, r) => ({ A: 1 / r, B: [0, 0], C: -r, o: c.slice() });
const lineG = (a, b) => K.line2(a, b);
const rep = (label, Gs) => {
  // Gs: [{G, P, Q}] -> worst |cos| and worst incidence for A and B; undefined counts
  const out = { A: { cos: 0, inc: 0, undef: 0 }, B: { cos: 0, inc: 0, undef: 0 }, X: { cos: 0, inc: 0, undef: 0 }, Y: { cos: 0, inc: 0, undef: 0 }, Z: { cos: 0, inc: 0, undef: 0 } };
  for (const { G, P, Q } of Gs) for (const [k, fn] of [['A', defA], ['B', defB], ['X', defB2], ['Y', defB2f], ['Z', defZ]]) {
    let H = null; try { H = fn(G, P, Q); } catch (e) { H = null; }
    if (!H) { out[k].undef++; continue; }
    const c = Math.abs(cosAngle(H, G));
    const L = isInf(P) || isInf(Q) ? 1 : Math.hypot(P[0] - Q[0], P[1] - Q[1]);
    const inc = Math.max(isInf(P) ? 0 : distTo(H, P) / L, isInf(Q) ? 0 : distTo(H, Q) / L);
    if (!(c <= out[k].cos)) out[k].cos = c;
    if (!(inc <= out[k].inc)) out[k].inc = inc;
  }
  const f = (x) => (x === 0 ? '0' : x.toExponential(1));
  const c = (k) => `${f(out[k].cos).padStart(8)} ${f(out[k].inc).padStart(8)} ${String(out[k].undef).padStart(4)}`;
  console.log(`${label.slice(0, 46).padEnd(46)}|${c('A')} |${c('B')} |${c('X')} |${c('Y')} |${c('Z')}`);
  return out;
};
const randG = () => (rnd() < 0.7 ? circle([R(-5, 5), R(-5, 5)], R(0.1, 5)) : lineG([R(-5, 5), R(-5, 5)], [R(-5, 5), R(-5, 5)]));
const randP = () => [R(-6, 6), R(-6, 6)];
const nrm = (G, z) => { const u = [z[0] - G.o[0], z[1] - G.o[1]], g = [G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]], l = Math.hypot(g[0], g[1]); return [g[0] / l, g[1] / l]; };
const onC = (G, t) => { const g = K.geomOf(G); return g.line ? [g.p[0] + t * g.d[0], g.p[1] + t * g.d[1]] : [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)]; };

console.log('worst |cos angle(K, C)|, worst distance of P, Q from K / |PQ| (exact from the float coefficients), undefined count');
console.log('A = circle3(P, Q, P*); B = null vector at G\'s anchor; X = cross product at P, G re-anchored exactly; Y = the same, re-anchored in float; Z = the proposal: X with every step exact (BigInt), one rounding per coefficient\n');
console.log(''.padEnd(46) + '|' + ['A', 'B', 'X', 'Y', 'Z'].map((k) => ('   ' + k + ': cos      inc  und')).join(' |'));
rep('random (10 000; 70 % circles, 30 % lines)', Array.from({ length: 10000 }, () => ({ G: randG(), P: randP(), Q: randP() })));
for (const k of [2, 4, 6, 8, 10, 12, 14, 16]) {
  const d = 10 ** -k;
  rep(`P at 1e-${k} from C (2000)`, Array.from({ length: 2000 }, () => { const G = randG(), t = R(0, 6.28), z = onC(G, t), n = nrm(G, z), s = rnd() < 0.5 ? 1 : -1; return { G, P: [z[0] + s * d * n[0], z[1] + s * d * n[1]], Q: randP() }; }));
}
rep('P exactly on C (r = 5, 13, 25: Pythagorean)', [[5, 3, 4], [13, 5, 12], [25, 7, 24], [25, 15, 20]].flatMap(([r, a, b]) => [[a, b], [-a, b], [b, -a], [-b, -a]].map((P) => ({ G: circle([0, 0], r), P, Q: randP() }))));
rep('P exactly on C, C a line', Array.from({ length: 200 }, () => { const a = [Math.round(R(-5, 5)), Math.round(R(-5, 5))], b = [a[0] + 1 + Math.round(R(0, 3)), a[1] + Math.round(R(-3, 3))]; const t = Math.round(R(-4, 4)); return { G: lineG(a, b), P: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], Q: randP() }; }));
rep('P and Q both exactly on C (ideal points)', [[5, 3, 4, -4, 3], [5, 3, 4, 5, 0], [13, 5, 12, -12, -5], [5, 0, 5, 0, -5]].map(([r, a, b, c, d]) => ({ G: circle([0, 0], r), P: [a, b], Q: [c, d] })));
for (const k of [3, 6, 9, 12]) rep(`P at 1e-${k} from the centre`, Array.from({ length: 1000 }, () => { const c = [R(-5, 5), R(-5, 5)], r = R(0.1, 5), t = R(0, 6.28); return { G: circle(c, r), P: [c[0] + 10 ** -k * Math.cos(t), c[1] + 10 ** -k * Math.sin(t)], Q: randP() }; }));
rep('P exactly at the centre (the line c Q)', Array.from({ length: 1000 }, () => { const c = [R(-5, 5), R(-5, 5)]; return { G: circle(c, R(0.1, 5)), P: c.slice(), Q: randP() }; }));
for (const k of [3, 6, 9]) rep(`Q at 1e-${k} from P* (near the pencil)`, Array.from({ length: 1000 }, () => { const G = randG(), P = randP(), S = inv(G, P); return { G, P, Q: isInf(S) ? randP() : [S[0] + 10 ** -k * R(-1, 1), S[1] + 10 ** -k * R(-1, 1)] }; }));
for (const k of [3, 6, 9]) rep(`Q at 1e-${k} from P`, Array.from({ length: 1000 }, () => { const G = randG(), P = randP(); return { G, P, Q: [P[0] + 10 ** -k * R(-1, 1), P[1] + 10 ** -k * R(-1, 1)] }; }));
rep('Q = P* exactly (unit circle 0.5 / 2; real line i / -i)', [{ G: circle([0, 0], 1), P: [0.5, 0], Q: [2, 0] }, { G: lineG([0, 0], [1, 0]), P: [0, 1], Q: [0, -1] }, { G: circle([0, 0], 1), P: [0.25, 0.25], Q: [2, 2] }]);
rep('Q = INF (the line through P perp. to C)', Array.from({ length: 1000 }, () => ({ G: randG(), P: randP(), Q: INF })));
rep('huge C (r = 1e9, P, Q near the curve)', Array.from({ length: 1000 }, () => { const c = [0, 1e9], G = circle(c, 1e9); return { G, P: randP(), Q: randP() }; }));
rep('tiny C (r = 1e-6 at 1+i, P, Q within 1e-5)', Array.from({ length: 1000 }, () => { const c = [1, 1], G = circle(c, 1e-6); return { G, P: [1 + R(-1e-5, 1e-5), 1 + R(-1e-5, 1e-5)], Q: [1 + R(-1e-5, 1e-5), 1 + R(-1e-5, 1e-5)] }; }));
rep('gcircle C: circle3 of nearly collinear points', Array.from({ length: 1000 }, () => { const G = K.circle3([-3, 0.1], [3, 0.1 + R(-1, 1) * 1e-9], [R(-2, 2), 0.1]); return { G, P: randP(), Q: randP() }; }));
rep('C far away: unit circle at 1e6 + 1e6 i, P, Q near it', Array.from({ length: 1000 }, () => { const c = [1e6, 1e6]; return { G: circle(c, 1), P: [c[0] + R(-2, 2), c[1] + R(-2, 2)], Q: [c[0] + R(-2, 2), c[1] + R(-2, 2)] }; }));

// ---------------------------------------------------------------- continuity: P crosses C; the level of K at fixed points
console.log(`\nZ: float path ${zFloat}, exact path ${zExact}`);
console.log('\ncontinuity: P = (1 + s, 0.3) crosses the unit circle near s = -0.0461 (C: |z| = 1), Q = -0.2 + 0.5i');
{
  const G = circle([0, 0], 1), Q = [-0.2, 0.5], probes = [[0.3, -0.4], [-0.7, 0.1], [2, 2]];
  const s0 = Math.sqrt(1 - 0.09) - 1;
  for (const [k, fn] of [['A', defA], ['B', defB], ['X', defB2], ['Z', defZ]]) {
    let jump = 0, undef = 0, prev = null, flips = 0;
    for (let i = -2000; i <= 2000; i++) {
      const P = [1 + s0 + i * 1e-7, 0.3];
      let H = null; try { H = fn(G, P, Q); } catch (e) { H = null; }
      if (!H) { undef++; continue; }
      const lv = probes.map((z) => K.fOf(H, z));
      if (prev) { jump = Math.max(jump, ...lv.map((x, j) => Math.abs(x - prev[j]))); if (Math.sign(H.A) !== Math.sign(prev.A)) flips++; }
      prev = Object.assign(lv, { A: H.A });
    }
    console.log(`  ${k}: largest change of the level at 3 probes per 1e-7 step ${jump.toExponential(2)}; undefined steps ${undef}; sign(A) flips ${flips}`);
  }
  // exactly on: P = (0.6, 0.8) is not exact in binary; use r = 5, P = (3, 4)
  const G5 = circle([0, 0], 5);
  let a = null; try { a = defA(G5, [3, 4], [1, 1]); } catch (e) { a = 'throw'; }
  const b = defB(G5, [3, 4], [1, 1]);
  console.log(`  P exactly on C (r = 5, P = 3 + 4i): A gives ${a ? 'a curve' : 'undefined (P* = P: two points coincide)'}; B gives cos ${cosAngle(b, G5).toExponential(1)}`);
}
console.log('\norientation: X agrees with circle3(P, Q, P*) when P is inside C?');
{
  let same = 0, opp = 0, sameOut = 0, oppOut = 0;
  for (let i = 0; i < 2000; i++) {
    const G = randG(), P = randP(), Q = randP();
    const a = defA(G, P, Q), b = defB2(G, P, Q);
    if (!a || !b) continue;
    const z = [R(-6, 6), R(-6, 6)];
    const sa = Math.sign(K.fOf(a, z)), sb = Math.sign(K.fOf(b, z));
    const inside = K.fOf(G, P) < 0;
    if (inside) { if (sa === sb) same++; else opp++; } else { if (sa === sb) sameOut++; else oppOut++; }
  }
  console.log(`  P inside: same ${same}, opposite ${opp};  P outside: same ${sameOut}, opposite ${oppOut}`);
}
// timing
{
  const G = circle([0.3, -0.2], 1.7), P = [0.4, 0.1], Q = [-1.1, 0.6];
  const n = 200000; let t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) defB2f(G, [P[0] + i * 1e-9, P[1]], Q);
  const tY = Number(process.hrtime.bigint() - t0) / n; t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) defB2(G, [P[0] + i * 1e-9, P[1]], Q);
  const tB = Number(process.hrtime.bigint() - t0) / n;
  t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) defA(G, [P[0] + i * 1e-9, P[1]], Q);
  const tA = Number(process.hrtime.bigint() - t0) / n;
  t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) defZ(G, [P[0] + i * 1e-9, P[1]], Q);
  const tZ = Number(process.hrtime.bigint() - t0) / n;
  console.log(`\ntime per evaluation: Z ${tZ.toFixed(0)} ns, A (circle3) ${tA.toFixed(0)} ns, X (exact re-anchor, BigInt) ${tB.toFixed(0)} ns, Y (float) ${tY.toFixed(0)} ns`);
}
