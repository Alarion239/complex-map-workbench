// Experiment for TANGENT-DESIGN.md. Run: node notes/orthogonal-circle/tangent-scratch/texp.js
//  touch(C, T, P): the generalized circle of C's tangent pencil at T through P (anchored at T, exact cross product)
//  tangent(C, P, k): the line through P touching the circle C (k = 0: touching on the left of P -> centre)
// Measured exactly from the float coefficients (BigInt): delta = 1 - |cos(K, C)| (0 = tangent), the gap g = delta * rho
// (rho = 1 / relative curvature: the distance the curves are apart or overlap at T), g / S (S = the coordinate scale),
// and the incidence of T and P on K (/ S).
'use strict';
const path = require('path');
const K = require(path.join(__dirname, '../../v16.2-candidate/src/constr.js'));
const INF = K.INF, isInf = K.isInf;
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
function dadd(a, b) { if (a.m === 0n) return b; if (b.m === 0n) return a; if (a.e < b.e) [a, b] = [b, a]; return { m: (a.m << BigInt(a.e - b.e)) + b.m, e: b.e }; }
const dneg = (a) => ({ m: -a.m, e: a.e });
const dsub = (a, b) => dadd(a, dneg(b));
function dnum(a) { if (a.m === 0n) return 0; const neg = a.m < 0n, M = neg ? -a.m : a.m, sh = Math.max(0, M.toString(2).length - 60); return (neg ? -1 : 1) * Number(M >> BigInt(sh)) * 2 ** (a.e + sh); }
function dForm(G, o2) {
  const A = D(G.A), Bx = D(G.B[0]), By = D(G.B[1]), C = D(G.C);
  const dx = dsub(D(o2[0]), D(G.o[0])), dy = dsub(D(o2[1]), D(G.o[1]));
  const B2x = dadd(Bx, dmul(A, dx)), B2y = dadd(By, dmul(A, dy));
  const C2 = dadd(dadd(dmul(A, dadd(dmul(dx, dx), dmul(dy, dy))), dmul(D(2), dadd(dmul(Bx, dx), dmul(By, dy)))), C);
  return { A, Bx: B2x, By: B2y, C: C2 };
}
// 1 - |cos| exactly: (n1 n2 - ip^2) / (n1 n2 (1 + |cos|)), the numerator in BigInt
function deltaOf(G1, G2) {
  const o = G2.o, a = dForm(G1, o), b = dForm(G2, o);
  const ip = dsub(dadd(dmul(a.Bx, b.Bx), dmul(a.By, b.By)), dmul(D(0.5), dadd(dmul(a.A, b.C), dmul(b.A, a.C))));
  const n1 = dsub(dadd(dmul(a.Bx, a.Bx), dmul(a.By, a.By)), dmul(a.A, a.C));
  const n2 = dsub(dadd(dmul(b.Bx, b.Bx), dmul(b.By, b.By)), dmul(b.A, b.C));
  const num = dsub(dmul(n1, n2), dmul(ip, ip));          // > 0: they cross; < 0: apart; 0: tangent
  const N = dnum(n1) * dnum(n2), c = dnum(ip) / Math.sqrt(N);
  return { delta: dnum(num) / N / (1 + Math.abs(c)), cos: c };
}
function distTo(G, z) {
  if (isInf(z)) return Math.abs(G.A);
  const a = dForm(G, z), g = Math.hypot(dnum(a.Bx), dnum(a.By));
  return Math.abs(dnum(a.C)) / (2 * g);
}
function gcN(A, B, C, o) {
  const N2 = B[0] * B[0] + B[1] * B[1] - A * C;
  if (!(N2 > 0) || !Number.isFinite(N2)) return null;
  const s = 1 / Math.sqrt(N2);
  return { A: A * s, B: [B[0] * s, B[1] * s], C: C * s, o: o.slice() };
}

// ---------------------------------------------------------------- the constructions
// touch: K anchored at T, C_K = 0; rows (|d|^2, 2d) [through P] and (0, B'y, -B'x) [normal parallel to C's at T]:
// (A, B) = (-2 d.B', |d|^2 B'), every step exact (B' = C's B re-anchored at T), one rounding per coefficient
function touchZ(G, T, P) {
  if (isInf(T)) {                       // T = inf on a line C: the line through P parallel to C (oriented like C)
    if (G.A !== 0 || isInf(P)) return null;
    return gcN(0, G.B, 0, P);
  }
  const a = dForm(G, T);
  let A, Bx, By;
  if (isInf(P)) { A = { m: 0n, e: 0 }; Bx = a.Bx; By = a.By; }
  else {
    const dx = dsub(D(P[0]), D(T[0])), dy = dsub(D(P[1]), D(T[1])), dd = dadd(dmul(dx, dx), dmul(dy, dy));
    A = dmul(D(-2), dadd(dmul(dx, a.Bx), dmul(dy, a.By)));
    Bx = dmul(dd, a.Bx); By = dmul(dd, a.By);
  }
  if (A.m === 0n && Bx.m === 0n && By.m === 0n) return null;
  return gcN(dnum(A), [dnum(Bx), dnum(By)], 0, T);
}
// the naive float version (for comparison): the same formula with C re-anchored in float
function touchF(G, T, P) {
  const u = [T[0] - G.o[0], T[1] - G.o[1]], B = [G.B[0] + G.A * u[0], G.B[1] + G.A * u[1]];
  if (isInf(P)) return gcN(0, B, 0, T);
  const d = [P[0] - T[0], P[1] - T[1]], dd = d[0] * d[0] + d[1] * d[1];
  return gcN(-2 * (d[0] * B[0] + d[1] * B[1]), [dd * B[0], dd * B[1]], 0, T);
}
// the textbook way: centre on T's normal, c = T + rho n with rho = |P - T|^2 / (2 (P - T).n), K = circleCP(c, T)
function touchC(G, T, P) {
  const u = [T[0] - G.o[0], T[1] - G.o[1]], B = [G.B[0] + G.A * u[0], G.B[1] + G.A * u[1]], L = Math.hypot(B[0], B[1]), n = [B[0] / L, B[1] / L];
  const d = [P[0] - T[0], P[1] - T[1]], rho = (d[0] * d[0] + d[1] * d[1]) / (2 * (d[0] * n[0] + d[1] * n[1]));
  if (!Number.isFinite(rho)) return null;
  return K.circleCP([T[0] + rho * n[0], T[1] + rho * n[1]], T);
}
// tangent from P to a circle C: anchored at P, n = (N B' + s J B') sigma / |B'|^2, s = sqrt(A f(P)), N^2 = |B'|^2 - A f(P)
// (B', f(P) exact, then rounded); k = 0 or 1 picks the branch. Returns {K, T}
function tangentZ(G, P, k) {
  if (G.A === 0) return { K: gcN(0, G.B, 0, P), T: INF };
  const a = dForm(G, P);
  const Bx = dnum(a.Bx), By = dnum(a.By);
  const s2d = dmul(D(G.A), a.C), s2 = dnum(s2d);
  if (s2 < 0) return null;                                    // P inside
  const b2d = dadd(dmul(a.Bx, a.Bx), dmul(a.By, a.By)), b2 = dnum(b2d), N = Math.sqrt(dnum(dsub(b2d, s2d))), s = Math.sqrt(s2);
  const t = k ? -1 : 1;
  const nx = (N * Bx - t * s * By) / b2, ny = (N * By + t * s * Bx) / b2;
  const Kf = gcN(0, [nx, ny], 0, P);
  // T = P + (t s / A) u, u = J n (the line's direction)
  const ux = -ny, uy = nx, tt = t * s / G.A * 1;
  // (B'.u = -t s by construction; t* = -(B'.u)/A)
  const bu = Bx * ux + By * uy, ts = -bu / G.A;
  return { K: Kf, T: [P[0] + ts * ux, P[1] + ts * uy], s, tt };
}
// textbook tangent: T from the polar meet, K = line2(P, T)
function tangentC(G, P, k) {
  const g = K.geomOf(G); const c = g.c, r = g.r;
  const v = [P[0] - c[0], P[1] - c[1]], d2 = v[0] * v[0] + v[1] * v[1];
  if (d2 < r * r) return null;
  const h = Math.sqrt(d2 - r * r), t = k ? -1 : 1;
  const T = [c[0] + (r * r * v[0] - t * r * h * v[1]) / d2, c[1] + (r * r * v[1] + t * r * h * v[0]) / d2];
  return { K: K.line2(P, T), T };
}

// ---------------------------------------------------------------- measuring
let seed = 11;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const R = (a, b) => a + (b - a) * rnd();
const circle = (c, r) => ({ A: 1 / r, B: [0, 0], C: -r, o: c.slice() });
const lineG = (a, b) => K.line2(a, b);
const randC = () => (rnd() < 0.75 ? circle([R(-5, 5), R(-5, 5)], R(0.1, 5)) : lineG([R(-5, 5), R(-5, 5)], [R(-5, 5), R(-5, 5)]));
const randP = () => [R(-6, 6), R(-6, 6)];
const onC = (G, t) => { const g = K.geomOf(G); return g.line ? [g.p[0] + t * g.d[0], g.p[1] + t * g.d[1]] : [g.c[0] + g.r * Math.cos(t), g.c[1] + g.r * Math.sin(t)]; };
const nrm = (G, z) => { const u = [z[0] - G.o[0], z[1] - G.o[1]], g = [G.A * u[0] + G.B[0], G.A * u[1] + G.B[1]], l = Math.hypot(g[0], g[1]); return [g[0] / l, g[1] / l]; };
const absz = (z) => (isInf(z) ? 0 : Math.hypot(z[0], z[1]));
const f = (x) => (x === 0 ? '0' : x.toExponential(1));
function rep(label, cases, fns) {
  const cols = fns.map(() => ({ d: 0, g: 0, inc: 0, und: 0, neg: 0 }));
  for (const cs of cases) fns.forEach(([, fn], i) => {
    let out = null; try { out = fn(cs); } catch (e) { out = null; }
    const Kf = out && (out.K || out);
    if (!Kf || !Kf.B) { cols[i].und++; return; }
    const { delta, cos } = deltaOf(Kf, cs.G);
    if (cos < 0) cols[i].neg++;
    const kap = Math.abs(Kf.A - Math.sign(cos) * cs.G.A), rho = kap > 0 ? 1 / kap : Infinity;
    const pts = [cs.T, cs.P, out.T].filter((z) => z && !isInf(z));
    const S = Math.max(1e-300, ...pts.map(absz), cs.G.A ? Math.hypot(...K.geomOf(cs.G).c) + 1 / Math.abs(cs.G.A) : 0, ...pts.map((z) => (cs.T && !isInf(cs.T) ? Math.hypot(z[0] - cs.T[0], z[1] - cs.T[1]) : 0)));
    const g = rho === Infinity ? 0 : Math.abs(delta) * rho / S;
    const inc = Math.max(0, ...pts.map((z) => distTo(Kf, z) / S));
    const c = cols[i];
    if (!(Math.abs(delta) <= c.d)) c.d = Math.abs(delta);
    if (!(g <= c.g)) c.g = g;
    if (!(inc <= c.inc)) c.inc = inc;
  });
  console.log(label.slice(0, 44).padEnd(44) + cols.map((c, i) => `| ${fns[i][0]}: ${f(c.d).padStart(7)} ${f(c.g).padStart(7)} ${f(c.inc).padStart(7)} ${String(c.und).padStart(3)}${c.neg ? ' neg' + c.neg : ''}`).join(' '));
}
const TOUCH = [['Z', (c) => touchZ(c.G, c.T, c.P)], ['F', (c) => touchF(c.G, c.T, c.P)], ['ctr', (c) => touchC(c.G, c.T, c.P)]];
console.log('touch(C, T, P). Columns per method: |delta| = |1 - |cos||, gap / S, incidence of T, P on K / S, undefined count (neg: cos < 0)');
console.log('Z = exact cross product (proposed); F = the same in float; ctr = centre on the normal + circleCP\n');
rep('random: T a float glider on C, P random', Array.from({ length: 10000 }, () => { const G = randC(); return { G, T: onC(G, R(-6, 6)), P: randP() }; }), TOUCH);
rep('T exactly on C (Pythagorean), P random', [[5, 3, 4], [13, 5, 12], [25, 7, 24], [25, 15, 20]].flatMap(([r, a, b]) => [[a, b], [-a, b], [b, -a], [-b, -a]].map((T) => ({ G: circle([0, 0], r), T, P: randP() }))), TOUCH);
for (const k of [3, 6, 9, 12]) rep(`P at 1e-${k} from T (random direction)`, Array.from({ length: 2000 }, () => { const G = randC(), T = onC(G, R(-6, 6)), a = R(0, 6.28); return { G, T, P: [T[0] + 10 ** -k * Math.cos(a), T[1] + 10 ** -k * Math.sin(a)] }; }), TOUCH);
for (const k of [3, 6, 9]) rep(`P at 1e-${k} from T along the tangent`, Array.from({ length: 2000 }, () => { const G = randC(), T = onC(G, R(-6, 6)), n = nrm(G, T), s = R(-1, 1) < 0 ? -1 : 1; return { G, T, P: [T[0] - s * 10 ** -k * n[1], T[1] + s * 10 ** -k * n[0]] }; }), TOUCH);
for (const k of [4, 8, 12, 16]) rep(`P at 1e-${k} from C (far from T)`, Array.from({ length: 2000 }, () => { const G = randC(), T = onC(G, R(-6, 6)), z = onC(G, R(-6, 6)), n = nrm(G, z), s = rnd() < 0.5 ? 1 : -1; return { G, T, P: [z[0] + s * 10 ** -k * n[0], z[1] + s * 10 ** -k * n[1]] }; }), TOUCH);
rep('P exactly on C (K = C), Pythagorean', [[5, [3, 4], [-4, 3]], [5, [3, 4], [5, 0]], [13, [5, 12], [-12, -5]]].map(([r, T, P]) => ({ G: circle([0, 0], r), T, P })), TOUCH);
rep('P = inf (the tangent line at T)', Array.from({ length: 2000 }, () => { const G = randC(); return { G, T: onC(G, R(-6, 6)), P: INF }; }), TOUCH.slice(0, 2));
rep('C a line, T on it (grid), P random', Array.from({ length: 1000 }, () => { const a = [Math.round(R(-5, 5)), Math.round(R(-5, 5))], b = [a[0] + 1 + Math.round(R(0, 3)), a[1] + Math.round(R(-3, 3))], t = Math.round(R(-4, 4)); return { G: lineG(a, b), T: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], P: randP() }; }), TOUCH);
rep('C a line, T = inf (the parallel through P)', Array.from({ length: 500 }, () => ({ G: lineG(randP(), randP()), T: INF, P: randP() })), TOUCH.slice(0, 1));
rep('huge C (r = 1e9), T glider, P near', Array.from({ length: 1000 }, () => { const G = circle([0, 1e9], 1e9), T = onC(G, -Math.PI / 2 + R(-1e-9, 1e-9)); return { G, T, P: randP() }; }), TOUCH);
rep('tiny C (r = 1e-6 at 1+i), P within 1e-5', Array.from({ length: 1000 }, () => { const G = circle([1, 1], 1e-6), T = onC(G, R(0, 6.28)); return { G, T, P: [1 + R(-1e-5, 1e-5), 1 + R(-1e-5, 1e-5)] }; }), TOUCH);
rep('C far (unit circle at 1e6(1+i)), P near', Array.from({ length: 1000 }, () => { const G = circle([1e6, 1e6], 1), T = onC(G, R(0, 6.28)); return { G, T, P: [1e6 + R(-2, 2), 1e6 + R(-2, 2)] }; }), TOUCH);
rep('C = circle3 of nearly collinear points', Array.from({ length: 1000 }, () => { const G = K.circle3([-3, 0.1], [3, 0.1 + R(-1, 1) * 1e-9], [R(-2, 2), 0.1]); return { G, T: [3, 0.1 + 1e-9 * 0], P: randP() }; }).map((c) => Object.assign(c, { T: c.G.pts[1] })), TOUCH);

console.log('\ntangent(C, P, k), both branches. Z = exact B\', f(P), then the closed form; ctr = T from the centre, line2(P, T)');
const TAN = [['Z0', (c) => tangentZ(c.G, c.P, 0)], ['Z1', (c) => tangentZ(c.G, c.P, 1)], ['ctr', (c) => tangentC(c.G, c.P, 0)]];
const randCirc = () => circle([R(-5, 5), R(-5, 5)], R(0.1, 5));
const outside = (G) => { for (;;) { const P = randP(); if (K.fOf(G, P) > 0) return P; } };
rep('random, P outside', Array.from({ length: 10000 }, () => { const G = randCirc(); return { G, P: outside(G) }; }), TAN);
for (const k of [2, 6, 10, 14, 16]) rep(`P at 1e-${k} outside C`, Array.from({ length: 2000 }, () => { const G = randCirc(), z = onC(G, R(0, 6.28)), n = nrm(G, z); return { G, P: [z[0] + 10 ** -k * n[0], z[1] + 10 ** -k * n[1]] }; }), TAN);
rep('P exactly on C (Pythagorean): the tangent at P', [[5, 3, 4], [13, 5, 12], [25, 7, 24]].flatMap(([r, a, b]) => [[a, b], [-a, b], [b, -a]].map((P) => ({ G: circle([0, 0], r), P }))), TAN);
for (const k of [3, 6, 9]) rep(`P far: 1e${k} r away`, Array.from({ length: 1000 }, () => { const G = randCirc(), a = R(0, 6.28), d = 10 ** k / G.A; return { G, P: [K.geomOf(G).c[0] + d * Math.cos(a), K.geomOf(G).c[1] + d * Math.sin(a)] }; }), TAN);
rep('huge C (r = 1e9), P outside near', Array.from({ length: 1000 }, () => ({ G: circle([0, 1e9], 1e9), P: [R(-6, 6), -R(0.001, 6)] })), TAN);
rep('tiny C (r = 1e-6 at 1+i), P within 1e-5', Array.from({ length: 1000 }, () => { const G = circle([1, 1], 1e-6); return { G, P: outside2(G) }; }), TAN);
function outside2(G) { for (;;) { const P = [1 + R(-1e-5, 1e-5), 1 + R(-1e-5, 1e-5)]; if (K.fOf(G, P) > 0) return P; } }
rep('C far (unit circle at 1e6(1+i)), P near', Array.from({ length: 1000 }, () => { const G = circle([1e6, 1e6], 1); let P; do P = [1e6 + R(-3, 3), 1e6 + R(-3, 3)]; while (K.fOf(G, P) <= 0); return { G, P }; }), TAN);

// branch: k = 0 touches on the left of P -> centre?
{
  let left = 0, right = 0;
  for (let i = 0; i < 2000; i++) { const G = randCirc(), P = outside(G), o = tangentZ(G, P, 0); const c = K.geomOf(G).c; const s = K.orient(P, c, o.T); if (s > 0) left++; else right++; }
  console.log(`\nbranch k = 0: T left of P -> c in ${left}, right in ${right}`);
}

// ---------------------------------------------------------------- the meets of K with C today (no tangency rule)
console.log('\nmeets(K, C) with the existing solver (K = touch, T a float glider): none / two points (split / S)');
{
  let none = 0, two = 0, worst = 0, n = 0, coinc = 0;
  for (let i = 0; i < 5000; i++) {
    const G = randC(), T = onC(G, R(-6, 6)), P = randP(), Kf = touchZ(G, T, P);
    if (!Kf) continue; n++;
    const m = K.meets2(Kf, G);
    if (m.coincide) { coinc++; continue; }
    if (m[0] == null || m[1] == null) { none++; continue; }
    two++;
    if (!isInf(m[0]) && !isInf(m[1])) { const sp = Math.hypot(m[0][0] - m[1][0], m[0][1] - m[1][1]) / Math.max(1, absz(T)); if (sp > worst) worst = sp; }
  }
  console.log(`  ${n} pairs: no meet ${none}, two meets ${two} (largest split / S ${f(worst)}), coincide ${coinc}`);
}

// ---------------------------------------------------------------- continuity
console.log('\ncontinuity (Z): the level at 3 probes per step');
function sweep(label, n, h, mk) {
  let jump = 0, und = 0, prev = null, flips = 0, lines = 0;
  const probes = [[0.3, -0.4], [-0.7, 0.1], [2, 2]];
  for (let i = -n; i <= n; i++) {
    const Kf = mk(i * h);
    if (!Kf) { und++; continue; }
    if (Kf.A === 0) lines++;
    const lv = probes.map((z) => K.fOf(Kf, z));
    if (prev) { jump = Math.max(jump, ...lv.map((x, j) => Math.abs(x - prev[j]))); if (Math.sign(Kf.A) * Math.sign(prev.A) < 0) flips++; }
    prev = Object.assign(lv, { A: Kf.A });
  }
  console.log(`  ${label}: largest change ${jump.toExponential(2)} per ${h} step; undefined ${und}; sign(A) flips ${flips}; exact lines ${lines}`);
}
const U = circle([0, 0], 1);
// T glides along the unit circle through the angle where P is on T's tangent line (P = (1, 1): T = 1 and T = i)
sweep('T = e^(it) through t = 0 (P = 1 + i on the tangent at 1)', 2000, 1e-7, (t) => touchZ(U, [Math.cos(t), Math.sin(t)], [1, 1]));
sweep('P = (1.3 + s, 0.2) crosses the unit circle? no: P crosses the tangent at T = 1', 2000, 1e-7, (s) => touchZ(U, [1, 0], [1 + s, 0.4]));
sweep('P = (0.6 + s, 0.8) crosses the unit circle (T = -1)', 2000, 1e-7, (s) => touchZ(U, [-1, 0], [0.6 + s, 0.8]));
sweep('P passes T = 1 along x = 1 + s, y = 1e-3 (near T)', 2000, 1e-7, (s) => touchZ(U, [1, 0], [1 + s, 1e-3]));
sweep('C a line y = 0, T = (t, 0) -> large t (T toward inf), P = 0.3 + i', 1000, 1e3, (t) => touchZ(lineG([0, 0], [1, 0]), [t * 1e3, 0], [0.3, 1]));
sweep('tangent from P = (1 + s, 0): P approaches the unit circle', 1000, 1e-9, (s) => { const o = tangentZ(U, [1.000001 + s, 0], 0); return o && o.K; });

// timing
{
  const G = circle([0.3, -0.2], 1.7), T = onC(G, 0.4), P = [-1.1, 0.6], n = 200000;
  let t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) touchZ(G, T, [P[0] + i * 1e-9, P[1]]);
  const tz = Number(process.hrtime.bigint() - t0) / n; t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) tangentZ(G, [3 + i * 1e-9, 1], 0);
  const tt = Number(process.hrtime.bigint() - t0) / n;
  console.log(`\ntime per evaluation: touch ${tz.toFixed(0)} ns, tangent ${tt.toFixed(0)} ns`);
}
