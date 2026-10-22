// verify panels.md 9.3: cap {P.C >= h} <-> disc / complement / half-plane, and the inverse formula,
// with the conjugate lift P(z) = (2x, -2y, |z|^2 - 1)/(|z|^2 + 1) (review B2) and B = C_x - i C_y.
const lift = (x, y) => { const q = x * x + y * y; return [2 * x / (q + 1), -2 * y / (q + 1), (q - 1) / (q + 1)]; };
function shapeOfCap(C, h) {
  const A = C[2] - h, B = [C[0], -C[1]], sa = Math.sqrt(1 - h * h);
  if (Math.abs(A) < 1e-12) { const nb = B[0] ** 2 + B[1] ** 2, a = [B[0] * h / nb, B[1] * h / nb]; return { kind: 'halfplane', a, b: [a[0] + B[1], a[1] - B[0]] }; } // b = a - iB
  const c = [B[0] / (h - C[2]), B[1] / (h - C[2])], r = sa / Math.abs(h - C[2]);
  return { kind: 'disc', c, r, complement: A > 0 };
}
function inside(s, x, y) {
  if (s.kind === 'disc') { const d = Math.hypot(x - s.c[0], y - s.c[1]) < s.r; return s.complement ? !d : d; }
  const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1]; return dx * (y - s.a[1]) - dy * (x - s.a[0]) > 0;
}
function capOf(s) {
  let a, b, d;
  if (s.kind === 'disc') { a = -1; b = s.c; d = s.r * s.r - (s.c[0] ** 2 + s.c[1] ** 2); if (s.complement) { a = -a; b = [-b[0], -b[1]]; d = -d; } }
  else { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = Math.hypot(dx, dy); const n = [-dy / l, dx / l]; const t = n[0] * s.a[0] + n[1] * s.a[1]; a = 0; b = n; d = -2 * t; }
  const mu = 1 / Math.sqrt(b[0] ** 2 + b[1] ** 2 + (a - d) ** 2 / 4);
  return { C: [mu * b[0], -mu * b[1], mu * (a - d) / 2], h: -mu * (a + d) / 2 };
}
let bad = 0, maxe = 0;
for (let it = 0; it < 3000; it++) {
  let C = [Math.random() - .5, Math.random() - .5, Math.random() - .5]; const l = Math.hypot(...C); C = C.map((v) => v / l);
  let h = Math.random() * 1.8 - 0.9; if (it % 10 === 0) h = C[2];
  const s = shapeOfCap(C, h);
  for (let k = 0; k < 20; k++) { const x = (Math.random() - .5) * 8, y = (Math.random() - .5) * 8; const P = lift(x, y); const m = P[0] * C[0] + P[1] * C[1] + P[2] * C[2] - h; if (Math.abs(m) > 1e-6 && (m > 0) !== inside(s, x, y)) bad++; }
  const back = capOf(s); maxe = Math.max(maxe, Math.hypot(back.C[0] - C[0], back.C[1] - C[1], back.C[2] - C[2]), Math.abs(back.h - h));
}
console.log('membership mismatches', bad, 'round-trip max error', maxe.toExponential(2));

// orientation (review B2): the screen Jacobian of z -> lift(z) seen from outside, at random front-facing points
// and random camera directions; with an orientation-preserving view, det > 0 everywhere.
let neg = 0, tot = 0;
for (let it = 0; it < 2000; it++) {
  let V = [Math.random() - .5, Math.random() - .5, Math.random() - .5]; const lv = Math.hypot(...V); V = V.map((v) => v / lv);
  // a right-handed camera basis (r, u) with r x u = V (looking at the sphere from outside, along -V)
  let r = [V[1], -V[0], 0]; const lr = Math.hypot(...r) || 1; r = r.map((v) => v / lr);
  const u = [V[1] * r[2] - V[2] * r[1], V[2] * r[0] - V[0] * r[2], V[0] * r[1] - V[1] * r[0]];
  const x = (Math.random() - .5) * 6, y = (Math.random() - .5) * 6, P = lift(x, y);
  if (P[0] * V[0] + P[1] * V[1] + P[2] * V[2] <= 0.05) continue;
  const e = 1e-6, Px = lift(x + e, y), Py = lift(x, y + e);
  const sc = (Q) => [Q[0] * r[0] + Q[1] * r[1] + Q[2] * r[2], Q[0] * u[0] + Q[1] * u[1] + Q[2] * u[2]];
  const s0 = sc(P), sx = sc(Px), sy = sc(Py);
  const det = (sx[0] - s0[0]) * (sy[1] - s0[1]) - (sx[1] - s0[1]) * (sy[0] - s0[0]);
  tot++; if (det <= 0) neg++;
}
console.log('front-facing points with an orientation-reversing view', neg, 'of', tot);
