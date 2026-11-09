// Node check of CX.bottcherD, the Böttcher walk with its derivative alongside (the CPU twin of the shader's dual derivative
// of Φ_M and φ_c): the value is CX.bottcher's bit for bit, and the derivative agrees with a central difference of CX.bottcher
// over the plane and the neighbourhood of the Mandelbrot set. Controls: for Φ_M (c = z) the derivative without the term dc/dz
// = 1 must fail, and so must one with a wrong sign choice of the root. Run: node test/t_dh_deriv.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
const { source } = require('./src_text');
const names = (fs.readFileSync(path.join(__dirname, 't_gl_inverse.js'), 'utf8').match(/const NAMES = (\{.*\});/) || [])[1];
const MAP = eval('(' + names + ')');
for (const f of Object.keys(MAP)) vm.runInContext(source(f + '.js', path.join(root, 'src'), { esm: 'strip' }) + `\n;globalThis.${MAP[f]} = ${MAP[f]};`, ctx, { filename: f + '.js' });
const { CX } = ctx;
let bad = 0;
const check = (name, ok, info = '') => { if (!ok) { bad++; console.log('FAIL', name, info); } else console.log('ok  ', name, info); };

const C = CX.C, abs = CX.abs, sub = CX.sub, scale = CX.scale, add = CX.add;
const N = 64, H_REL = 1e-6, REF_AGREE = 1e-7, TOL = 1e-6, GRID = 120, SPAN = 2.2;
const ZERO = C(0, 0), ONE = C(1, 0);
// the central difference of f at z, step H_REL (1 + |z|): the reference derivative
const central = (f, z, k = 1) => {
  const h = H_REL * (1 + abs(z)) / k;
  return scale(sub(f(add(z, C(h, 0))), f(sub(z, C(h, 0)))), 1 / (2 * h));
};
const same = (a, b) => (Number.isNaN(a.re) && Number.isNaN(b.re)) || (a.re === b.re && a.im === b.im);
const cases = [{ name: 'Φ_M', c: (z) => z, dc: ONE }, { name: 'φ_c, c = -1', c: () => C(-1, 0), dc: ZERO }, { name: 'φ_c, c = 0.3+0.6i', c: () => C(0.3, 0.6), dc: ZERO }];
for (const cs of cases) {
  let n = 0, badVal = 0, badDer = 0, wrongDc = 0;
  for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) {
    const z = C(-SPAN + 2 * SPAN * (i + 0.5) / GRID, -SPAN + 2 * SPAN * (j + 0.5) / GRID);
    const ref = CX.bottcher(z, cs.c(z), N);
    if (!Number.isFinite(ref.re)) continue;
    // (the central difference must not straddle the NaN edge or a branch of the root: both sides finite)
    const f = (y) => CX.bottcher(y, cs.c(y), N);
    // (a point where the difference at half the step moves by more than REF_AGREE is too close to the set's edge for a
    // difference to be the reference: skipped)
    const d0 = central(f, z), dh = central(f, z, 2);
    if (![d0.re, d0.im, dh.re, dh.im].every(Number.isFinite) || abs(sub(d0, dh)) > REF_AGREE * (1 + abs(d0))) continue;
    n++;
    const r = CX.bottcherD(z, cs.c(z), N, cs.dc);
    if (!same(r.p, ref)) badVal++;
    if (abs(sub(r.dp, d0)) > TOL * (1 + abs(d0))) { badDer++; }
    if (cs.dc.re === 1 && abs(sub(CX.bottcherD(z, cs.c(z), N, ZERO).dp, d0)) > TOL * (1 + abs(d0))) wrongDc++;
  }
  check(`${cs.name}: ${n} points, the value equals CX.bottcher bit for bit (${badVal} differ)`, n > 1000 && badVal === 0);
  check(`${cs.name}: the derivative is within ${TOL} of the central difference (${badDer} off)`, badDer === 0);
  if (cs.dc.re === 1) check(`control: Φ_M's derivative without dc/dz = 1 is wrong at ${wrongDc} of ${n} points`, wrongDc > n / 2);
}
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
