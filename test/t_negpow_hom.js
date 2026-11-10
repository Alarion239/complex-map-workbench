// The glide of a real negative exponent never passes through a constant map: H_t is z^{|a|}'s power path for t <= 1/2,
// then the elliptic Möbius arc from the identity to 1/w, so H_0 = id and H_1 = f on the step's own branch. The
// one-phase path z^{1+(a-1)t} has exponent 0 at t = 1/(1-a) and is the control. Positive exponents and pown n < 0 keep
// their paths to the last bit. Run: node test/t_negpow_hom.js
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const F = require('../src/funcs.js');
const { C } = CX;
let checks = 0, failed = 0;
const check = (name, cond, got) => { checks++; if (!cond) { failed++; console.log('FAIL', name, got === undefined ? '' : JSON.stringify(got)); } };

const GRID = 600;          // u = i / GRID
const BOX = 4;             // the points fill [-2, 2]^2
const SPREAD_MIN = 1e-2 * BOX;
const END_TOL = 1e-12;     // |H_1 - f| <= END_TOL (1 + |f|)
const NPTS = 64;
const U_SAME = [0.25, 0.5, 0.75];
const CUT_DEG = 180;

let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
// off the cut (the negative real axis) and off 0
const IM_SPAN = 0.9, IM_MIN = 0.05;   // |Im z| in [IM_MIN, IM_MIN + IM_SPAN] of half the box: off the cut and 0
const pts = Array.from({ length: NPTS }, () => C(rnd() * BOX - BOX / 2, (rnd() * IM_SPAN + IM_MIN) * (rnd() < 0.5 ? 1 : -1) * BOX / 2));
const S = (type, params = {}) => F.build({ type, params: Object.assign(F.defaults(type), params) });
const alphaStep = (a) => S('powa', { alpha: String(a), cut: CUT_DEG });
const formulaStep = (expr) => S('custom', { expr });

const spread = (h) => { const w0 = h(pts[0]); let m = 0; for (const z of pts) m = Math.max(m, CX.abs(CX.sub(h(z), w0))); return m; };
const minSpread = (hom) => { let m = Infinity, at = 0; for (let i = 0; i <= GRID; i++) { const s = spread(hom(i / GRID)); if (s < m) { m = s; at = i / GRID; } } return { m, at }; };

const CASES = [
  ['K1 powa -1/2', alphaStep(-0.5), -0.5],
  ['K2 formula z^(-1/2)', formulaStep('z^{-1/2}'), -0.5],
  ['K3 powa -3/2', alphaStep(-1.5), -1.5],
];
for (const [name, st, a] of CASES) {
  const r = minSpread(st.hom);
  check(`${name}: never a constant map (min SPREAD ${r.m.toExponential(2)} at u=${r.at.toFixed(4)})`, r.m > SPREAD_MIN, r);
  let worst = 0;
  for (const z of pts) { const f = st.f(z); worst = Math.max(worst, CX.abs(CX.sub(st.hom(1)(z), f)) / (1 + CX.abs(f))); }
  check(`${name}: H_1 = f`, worst <= END_TOL, worst);
  let w0 = 0;
  for (const z of pts) w0 = Math.max(w0, CX.abs(CX.sub(st.hom(0)(z), z)));
  check(`${name}: H_0 = id`, w0 <= END_TOL, w0);
  // control: the one-phase path is a constant map at t = 1/(1-a) (u = 2/3 for -1/2)
  const one = (t) => (z) => CX.pow(z, C(1 + (a - 1) * t, 0), Math.PI, 0);
  const c = minSpread(one);
  check(`${name}: control, the one-phase path collapses (min SPREAD ${c.m.toExponential(2)} at u=${c.at.toFixed(4)})`, c.m <= SPREAD_MIN, c);
  check(`${name}: control collapses within 1/${GRID} of u = 1/(1-a)`, Math.abs(c.at - 1 / (1 - a)) <= 1 / GRID + 1e-12, c.at);
}

// no-change controls, equal to the path they have today to the last bit
const same = (name, st, ref) => {
  for (const u of U_SAME) for (const z of pts) {
    const g = st.hom(u)(z), e = ref(u)(z);
    if (!(Object.is(g.re, e.re) && Object.is(g.im, e.im))) { check(`${name}: H_u identical at u=${u}`, false, { z, g, e }); return; }
  }
  check(`${name}: H_u identical at u in ${U_SAME}`, true);
};
const powPos = (a) => (t) => (z) => CX.pow(z, C(1 + (a - 1) * t, 0), Math.PI, 0);
same('z^(1/2)', alphaStep(0.5), powPos(0.5));
same('z^2 (powa)', alphaStep(2), powPos(2));
same('pown -2', S('pown', { n: -2 }), (t) => {
  if (t < 0.5) return powPos(2)(2 * t);
  const M = CX.mobPath([C(0, 0), C(1, 0), C(1, 0), C(0, 0)])(2 * t - 1), inv = (z) => CX.mobApply(M, z);
  return (z) => inv(CX.ipow(z, 2));
});
// K4 recognises as translate then pown -2: already two-phase, so it never collapses and ends on f
{
  const st = formulaStep('(z-0.5)^{-2}'), r = minSpread(st.hom);
  check(`K4 formula (z-0.5)^(-2): never a constant map (min SPREAD ${r.m.toExponential(2)})`, r.m > SPREAD_MIN, r);
  let worst = 0;
  for (const z of pts) { const f = st.f(z); worst = Math.max(worst, CX.abs(CX.sub(st.hom(1)(z), f)) / (1 + CX.abs(f))); }
  check('K4 formula (z-0.5)^(-2): H_1 = f', worst <= END_TOL, worst);
}

console.log(`${checks - failed}/${checks} ok`);
process.exit(failed ? 1 : 0);
