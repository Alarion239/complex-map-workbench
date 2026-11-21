'use strict';
// node test/t_sv_sing.js : the steps view's pole search with sing (svPolesIn(F, box, n, lim, E, true), the Landscape's
// patch search, src/app/19-steps-view.js) finds the points where F is unbounded without being a pole, and only those.
// svSingNewton keeps a point only where Newton's method on h/h' settled and |F| near it is past SV_SING_BIG and grows
// towards it:
// - found: a root of a Möbius step at its pole (the dipole (z - i)/(z + i) to the powers 1/2 and 1/4: |F| ~ |z + i|^-a), the
//   logarithm at 0, 1/sqrt(z - 1 - 2i) at 1 + 2i; (z - 8i)/(z + 8i) to the powers 1/2, 1/3 and 1/4 over the height poles'
//   ring and grid, where the grid's start by -8i lies on the root's cut and Newton's iterates come within a step of it;
// - not found: exp(sqrt z) and 30 exp(sqrt z), where Newton on h/h' reflects (h/h' = -2 sqrt z sends z to -z) and never
//   settles; 20 + sqrt z at 0, a branch point where |F| stays near 20.
// Each of the two clauses alone rejects all three (their |F| does not grow towards the points either, and Newton on h/h'
// does not settle at 20 + sqrt z's 0, where h/h' has a zero of order 1/2), so these rows hold the pair, not each clause.
// The search's text is taken from the app's source (its constants and the searches it calls) and run on CX.
const C = (re, im) => ({ re, im });
const CX = require('../src/cx.js');
const { appText, braced } = require('./src_text');

let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, info); } };

const APP = appText();
const from = APP.indexOf('  const SV_POLE_K = '), at = APP.indexOf('  function* svPolesIn(');
if (from < 0 || at < 0) throw new Error('src/app: no SV_POLE_K or svPolesIn');
const open = APP.indexOf(') {', at) + 2, end = open + braced(APP, open, 'svPolesIn').length;
const { svPolesIn, svDrain } = new Function('CX', 'C', `${APP.slice(from, end)}\nreturn { svPolesIn, svDrain };`)(CX, C);

const box = (h) => ({ x0: -h, x1: h, y0: -h, y1: h });
const found = (F, bx) => { const E = { n: 0, at: 0 }; return svDrain(svPolesIn(F, bx, 16, bx, E, true)); };
const near = (list, p, tol = 1e-4) => list.some((z) => Math.hypot(z.re - p.re, z.im - p.im) <= tol * (1 + Math.hypot(p.re, p.im)));
const pw = (z, a) => { const r = Math.hypot(z.re, z.im), t = Math.atan2(z.im, z.re); return C(r ** a * Math.cos(a * t), r ** a * Math.sin(a * t)); };
const dipole = (z) => CX.div(CX.sub(z, C(0, 1)), CX.add(z, C(0, 1)));
const dipole8 = (z) => CX.div(CX.sub(z, C(0, 8)), CX.add(z, C(0, 8)));
const fmt = (list) => list.map((z) => `${z.re.toFixed(4)}${z.im >= 0 ? '+' : ''}${z.im.toFixed(4)}i`).join(' ');

for (const a of [0.5, 0.25]) for (const h of [1.7, 5.8]) {
  const out = found((z) => pw(dipole(z), a), box(h));
  check(`the dipole to the power ${a} on ±${h}: its point -i is found`, near(out, C(0, -1)), fmt(out));
}
// (the height poles' search, svLandHeightPoles: a 64 x 64 grid over the far patches' inner ring, ±25.1 for the box
// ±7.2 x ±6.15. Its column through 0 runs along the root's cut from -8i to 8i, and its one start by -8i is on it)
const ring = box(25.102);
for (const a of [0.5, 1 / 3, 0.25]) {
  const E = { n: 0, at: 0 }, out = svDrain(svPolesIn((z) => pw(dipole8(z), a), ring, 64, ring, E, true));
  check(`(z - 8i)/(z + 8i) to the power ${a.toFixed(3)} on the ±25.1 ring, grid 64: its point -8i is found`, near(out, C(0, -8)), fmt(out));
}
{
  const out = found((z) => CX.log(z), box(2));
  check('log z on ±2: its point 0 is found', near(out, C(0, 0)), fmt(out));
}
{
  const out = found((z) => CX.inv(CX.sqrt(CX.sub(z, C(1, 2)))), box(4));
  check('1/sqrt(z - 1 - 2i) on ±4: its point 1 + 2i is found', near(out, C(1, 2)), fmt(out));
}
{
  const out = found((z) => CX.exp(CX.sqrt(z)), { x0: -7.2, x1: 7.2, y0: -6.15, y1: 6.15 });
  check('exp(sqrt z) on 14.4 x 12.3: no point (Newton on h/h\' reflects and never settles)', out.length === 0, fmt(out));
}
{
  const out = found((z) => CX.mul(C(30, 0), CX.exp(CX.sqrt(z))), box(5.8));
  check('30 exp(sqrt z) on ±5.8: no point', out.length === 0, fmt(out));
}
{
  const out = found((z) => CX.add(C(20, 0), CX.sqrt(z)), box(2));
  check('20 + sqrt z on ±2: no point at its branch point 0, where |F| stays near 20', !near(out, C(0, 0), 1e-3), fmt(out));
}

console.log(bad ? `${bad} of ${n} checks failed` : `all ${n} checks pass`);
process.exit(bad ? 1 : 0);
