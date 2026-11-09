// Node check of the orbit bookkeeping of DH's and Böttcher's H in the shader (src/glsl.js, the 'dh' / 'bottcher' plan): the
// first DH_REG orbit points are kept in variables and a later one is recomputed from z by the same steps. Its twin here,
// written with the plan's own control flow over CX's operations, equals CX.bottcher bit for bit on a dense grid, tail
// points (orbits longer than DH_REG) included; a twin with the recomputation off by one fails (control). Run: node test/t_dh_orbit.js
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
const check = (name, ok, info = '') => { if (!ok) { bad++; console.log('FAIL', name, info); } };

const C = CX.C, add = CX.add, mul = CX.mul, div = CX.div, sqrt = CX.sqrt, neg = CX.neg;
const DH_REG = 8, DH_R = 1e4, N = 64;
// the shader's walk: reg[k] for k < DH_REG, the orbit again from z for the others (skew: the recomputation starts one step late)
const twin = (z0, c, skew = 0) => {
  const reg = [];
  let w = z0, n = -1;
  for (let k = 0; k <= N; k++) {
    if (k < DH_REG) reg[k] = w;
    if (Math.hypot(w.re, w.im) > DH_R) { n = k; break; }
    if (k >= N) break;
    w = add(mul(w, w), c);
  }
  if (n < 0) return C(NaN, NaN);
  let p = mul(w, sqrt(add(C(1, 0), div(div(c, w), w))));
  for (let j = 1; j <= n; j++) {
    const r = sqrt(p), q = n - j;
    let o;
    if (q < DH_REG) o = reg[q];
    else { o = z0; for (let i = 0; i < q + skew; i++) o = add(mul(o, o), c); }
    p = r.re * o.re + r.im * o.im >= 0 ? r : neg(r);
  }
  return p;
};
const same = (a, b) => (Number.isNaN(a.re) && Number.isNaN(b.re)) || (a.re === b.re && a.im === b.im);
const G = 160, W = 3;
let tail = 0, nbad = 0, badSkew = 0, tot = 0;
for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
  const z = C(-W + 2 * W * (i + 0.5) / G, -W + 2 * W * (j + 0.5) / G);
  for (const c of [z, C(-1, 0), C(0.3, 0.6)]) {
    tot++;
    const ref = CX.bottcher(z, c, N);
    if (!same(twin(z, c), ref)) nbad++;
    // (the orbit's length n of this point: a tail point has n > DH_REG)
    let w = z, n = 0; while (Math.hypot(w.re, w.im) <= DH_R && n < N) { w = add(mul(w, w), c); n++; }
    if (n > DH_REG && n < N) { tail++; if (!same(twin(z, c, 1), ref)) badSkew++; }
  }
}
check(`the register twin equals CX.bottcher bit for bit at ${tot} points (${nbad} differ)`, nbad === 0);
check(`the grid has tail points past the registers (${tail})`, tail >= 100);
check(`the control, a recomputation one step late, differs at tail points (${badSkew} of ${tail})`, badSkew > 0);
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
