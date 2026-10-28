// The catalog's steps on the CPU (src/funcs.js on src/cx.js) against certified values (notes/arb/reference.json, written
// by tools/arb_reference.py with Arb ball arithmetic; notes/arb/FINDINGS.md): each step's worst error over the hard
// points, normwise and per component, in ulp (2^-52), must stay within its limit. The limits only tighten: when a
// change makes a step more accurate, lower its limit to about twice the new worst (tools/arb_compare.js prints them).
// A large limit is a known loss that is not fixed yet (notes/arb/FINDINGS.md): log near |z| = 1, the inverse functions
// at small arguments, Joukowski, polynomials and rationals near their zeros wait for a float log1p and an error-free
// product on the GPU (the GLSL twins must change with them); a Möbius map's tiny component; the formula parser's
// z^2 + 1/z near its zeros; the small part of a power next to its cut (root, powa: its GPU twin must change with it).
//   node test/t_arb_reference.js
const fs = require('fs');
const { measure, REFERENCE, fmtU } = require('../tools/arb_compare.js');

// step: [normwise, per component] in ulp
const LIMITS = {
  mul: [4, 8], add: [4, 8], affine: [4, 8], recip: [4, 8], mobius: [4, 2e18], blaschke: [4, 5e7], pown: [4, 8],
  root: [4, 6e299], powa: [4, 6e299], exp: [4, 8], log: [4e7, 1e16],
  sin: [4, 8], cos: [4, 8], tan: [4, 8], sinh: [4, 8], cosh: [4, 8], tanh: [4, 8],
  arcsin: [9e11, 1e16], arccos: [3e6, 1e16], arctan: [4e11, 1e16], arsinh: [1e16, 1e16], arcosh: [4e4, 1e16], artanh: [1e16, 1e16],
  joukowski: [6e8, 1e16], ijouk: [4, 3e11], conj: [4, 8], poly: [5e6, 4e15], rational: [5e6, 1e16], zp: [4, 1e16],
  custom: [3e8, 4e8],
};

const R = JSON.parse(fs.readFileSync(REFERENCE, 'utf8'));
let n = 0, fails = 0;
const ok = (name, c, info) => { n++; if (!c) { fails++; console.log('FAIL', name, info === undefined ? '' : JSON.stringify(info)); } };
const rows = measure(R);
ok('every step of the reference has a limit, and every limit a step', rows.every((r) => LIMITS[r.id]) && Object.keys(LIMITS).every((id) => R.steps[id]), rows.map((r) => r.id).filter((id) => !LIMITS[id]));
for (const r of rows) {
  const [ln, lc] = LIMITS[r.id] || [0, 0];
  if (r.error) { ok(`${r.id} builds`, false, r.error); continue; }
  ok(`${r.id}: every point measured`, r.n === R.points.length, r.n);
  ok(`${r.id}: finite where the reference is, infinite past the double range`, !r.bad.length, r.bad);
  ok(`${r.id}: normwise ${fmtU(r.norm.u)} ulp <= ${ln}`, r.norm.u <= ln, r.norm.at);
  ok(`${r.id}: per component ${fmtU(r.comp.u)} ulp <= ${lc}`, r.comp.u <= lc, r.comp.at);
}
console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
