// A float32 model of the GPU's evaluation of the elliptic Möbius path A^t (w -> 1/w's path, A = [0 1; 1 0]) near t = 1,
// where cos(t pi/2) is small: the direct form cosh(t lam) I + sinh(t lam) J loses its relative accuracy to the absolute
// error of the GPU's cos (a trig bound E and the argument's rounding), the reflected form A^t = A A^-s with s = 1 - t
// (cosh(s lam) near 1 and sinh(s lam) by series, cosh lam and sinh lam precomputed in double) does not. The model injects
// E into every trig value. Run: node test/t_mobpath_f32.js
global.CX = require('../src/cx.js');
const { C } = CX;
let checks = 0, failed = 0;
const check = (name, cond, got) => { checks++; if (!cond) { failed++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } };
const f = Math.fround;
const TRIG_ERR = 1e-6;            // the absolute error of cos and sin (D3D's bound and the argument's rounding)
const REL_TOL = 1e-4;             // the relative error of the path's value the reflected form must meet
const T_NEAR = [0.9, 0.999, 0.9999, 0.99999];
const Z_ABS = [0.03, 0.01, 0.1];  // |z| of the points: w = z^2.5 is small, 1/w large, the sensitive end
const ESS = 2.5;
const SERIES_BELOW = 0.01;        // |s lam|^2 below which sinh is its series (as the shader)
const c32 = (z) => C(f(z.re), f(z.im));
const mul = (a, b) => c32(CX.mul(a, b)), add = (a, b) => c32(CX.add(a, b)), sub = (a, b) => c32(CX.sub(a, b));
// cosh and sinh of a purely imaginary argument i y with the trig error: cos y, i sin y
const coshI = (y) => C(f(Math.cos(f(y)) + TRIG_ERR), 0);
const sinhI = (y) => C(0, f(Math.sin(f(y)) + TRIG_ERR));
const sinhSeries = (a) => {   // a (1 + a^2/6 + a^4/120 + a^6/5040) in float32 complex
  const a2 = mul(a, a);
  let s = C(f(1 / 5040), 0);
  for (const k of [1 / 120, 1 / 6, 1]) s = add(C(f(k), 0), mul(a2, s));
  return mul(a, s);
};
const LAM = Math.PI / 2;          // A = [0 1; 1 0]: lam = i pi/2, ch = cosh lam = 0, sh = sinh lam = i
const J = [C(0, 0), C(-1, 0), C(-1, 0), C(0, 0)];   // J = N / sh, N = A - (tr/2) I of A scaled to det 1
const applyM = (m, w) => CX.div(add(mul(m[0], w), m[1]), add(mul(m[2], w), m[3]));
const direct = (t, w) => {
  const ch = coshI(t * LAM), st = sinhI(t * LAM);
  return applyM([add(ch, mul(st, J[0])), mul(st, J[1]), mul(st, J[2]), add(ch, mul(st, J[3]))], w);
};
const reflected = (t, w) => {
  const s = 1 - t, y = f(s * LAM);
  const C1 = y * y >= SERIES_BELOW ? coshI(y) : C(f(1 - y * y / 2 + y * y * y * y / 24), 0);
  const S1 = y * y >= SERIES_BELOW ? sinhI(y) : sinhSeries(C(0, y));
  const ch = C(0, 0), sh = C(0, 1);   // cosh lam, sinh lam precomputed in double
  const U = sub(mul(ch, C1), mul(sh, S1)), V = sub(mul(sh, C1), mul(ch, S1));
  return applyM([add(U, mul(V, J[0])), mul(V, J[1]), mul(V, J[2]), add(U, mul(V, J[3]))], w);
};
let worstDirect = 0, worstRefl = 0;
for (const t of T_NEAR) for (const r of Z_ABS) {
  const w = c32(CX.pow(C(0, r), C(ESS, 0), Math.PI, 0));
  const M = CX.mobPath([C(0, 0), C(1, 0), C(1, 0), C(0, 0)])(t), want = CX.mobApply(M, w);
  const rel = (g) => CX.abs(CX.sub(g, want)) / CX.abs(want);
  worstDirect = Math.max(worstDirect, rel(direct(t, w)));
  worstRefl = Math.max(worstRefl, rel(reflected(t, w)));
}
check(`the reflected form keeps the relative error under ${REL_TOL} (worst ${worstRefl.toExponential(2)})`, worstRefl < REL_TOL, worstRefl);
check(`control: the direct form misses ${REL_TOL} near t = 1 (worst ${worstDirect.toExponential(2)})`, worstDirect > REL_TOL, worstDirect);
console.log(`${checks - failed}/${checks} ok`);
process.exit(failed ? 1 : 0);
