// Node check that the external ray's landing is conditional on the CPU (src/invops.js, opNewt): the seed walks back
// plain first, and the ray only runs for a w where that walk misses. With the ray's stage test made impossible
// (Inverse.NEWT_RAY.TOL = 0 fails every stage), a w far from the set keeps its member, since the plain walk solves it,
// and a w near the set loses it, since only the ray reaches it. Run: node test/t_newt_ray_cond.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
const { source } = require('./src_text');
const names = (fs.readFileSync(path.join(__dirname, 't_gl_inverse.js'), 'utf8').match(/const NAMES = (\{.*\});/) || [])[1];
const MAP = eval('(' + names + ')');
for (const f of Object.keys(MAP)) vm.runInContext(source(f + '.js', path.join(root, 'src'), { esm: 'strip' }) + `\n;globalThis.${MAP[f]} = ${MAP[f]};`, ctx, { filename: f + '.js' });
const { Funcs, Inverse } = ctx;
let bad = 0;
const check = (name, ok, info = '') => { if (!ok) { bad++; console.log('FAIL', name, info); } };

const T = 0.9;                       // a glide frame where member 0 misses near the set and the seed solves some of those places
const GRID = 48, RMIN = 1.02, RMAX = 3;   // the scan: GRID^2 points of RMIN < |w| < RMAX
const MIN_PLAIN = 1;                 // plain-walk members the scan must find (member 1 solving where member 0 does not)
const pts = [];
for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) { const r = RMIN + (RMAX - RMIN) * i / (GRID - 1), a = 2 * Math.PI * (j + 0.5) / GRID; pts.push({ re: r * Math.cos(a), im: r * Math.sin(a) }); }
for (const type of ['dh', 'bottcher']) {
  const s = { type, params: Funcs.defaults(type), on: true }, b = Funcs.build(s), hk = Inverse.homOps(b, T);
  const op = hk.ops.find((o) => o.kind === 'NEWT');
  check(`${type}: has a NEWT op`, !!op);
  if (!op) continue;
  const seeded = (w) => op.pre(w).some((e) => e.m === 1);
  const old = Inverse.NEWT_RAY.TOL;
  const base = pts.map(seeded);
  Inverse.NEWT_RAY.TOL = 0;              // every ray stage fails: only the plain walk's members remain
  const plain = pts.map(seeded);
  Inverse.NEWT_RAY.TOL = old;
  const nPlain = plain.filter(Boolean).length, nBase = base.filter(Boolean).length;
  check(`${type}: the plain walk alone solves at least ${MIN_PLAIN} seeded members (ray stages failing)`, nPlain >= MIN_PLAIN, JSON.stringify({ nPlain, nBase }));
  check(`${type}: every plain-walk member is also found with the ray enabled`, plain.every((p, i) => !p || base[i]));
  check(`${type}: the ray reaches members the plain walk misses (control)`, nBase > nPlain, JSON.stringify({ nPlain, nBase }));
}
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
