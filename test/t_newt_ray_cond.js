// Node check that the external ray's landing is conditional on the CPU (src/invops.js, opNewt): the seed walks back
// plain first, and the ray only runs for a w where that walk misses. With the ray's stage test made impossible
// (Inverse.NEWT_RAY.TOL = 0 fails every stage), a w far from the set keeps its member, since the plain walk solves it,
// and a w near the set loses it, since only the ray reaches it. Also: the landing's root does not depend on a stage count
// one off, as float32 can make it at the stage boundaries. Run: node test/t_newt_ray_cond.js
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
// The program counts the ray's stages in float32 (ceil(SUB log2(log R / log|w|))), which can come out one more or one fewer
// than the CPU's at a |w| where that value is an integer: the intermediate targets then differ, but the landing's last
// stage is |w| itself, and the map is one-to-one there, so both counts land on the same root. At each such |w| (k = 1 to
// SUB HALVINGS) and ANGLES arguments, the landing with k stages and with k + 1 ends on one root, within SAME of each other
// relatively, wherever both land; and both land at no fewer than MIN_BOTH of those w
{
  const { CX } = ctx, R = Inverse.NEWT_RAY, ANGLES = 8, SAME = 1e-9, MIN_BOTH = 200;
  const g0 = Math.log(R.R);
  for (const type of ['dh', 'bottcher']) {
    const f = Funcs.build({ type, params: Funcs.defaults(type), on: true }).f;
    const dH = (u) => { const h = 1e-6 * (1 + CX.abs(u)); return CX.scale(CX.sub(f(CX.add(u, CX.C(h, 0))), f(CX.sub(u, CX.C(h, 0)))), 0.5 / h); };
    // InvOps' rayLand with its stage count n given
    const land = (w, n) => {
      const gw = Math.log(CX.abs(w));
      let v = CX.scale(w, R.R / CX.abs(w));
      for (let s = 0; s <= n; s++) {
        const g = s >= n ? gw : Math.max(g0 * Math.pow(2, -s / R.SUB), gw), target = CX.scale(w, Math.exp(g) / CX.abs(w));
        let moved = Infinity;
        for (let it = 0; it < R.NEWT && CX.isFin(v); it++) { const nv = CX.sub(v, CX.div(CX.sub(f(v), target), dH(v))); moved = CX.abs(CX.sub(nv, v)); v = nv; }
        if (!CX.isFin(v) || !(moved <= R.TOL * (1 + CX.abs(v)))) return null;
      }
      return v;
    };
    let both = 0, apart = [];
    for (let k = 1; k < R.SUB * R.HALVINGS; k++) {
      const r = Math.exp(g0 * Math.pow(2, -k / R.SUB));
      for (let j = 0; j < ANGLES; j++) {
        const a = 2 * Math.PI * (j + 0.5) / ANGLES, w = CX.C(r * Math.cos(a), r * Math.sin(a));
        const u = land(w, k), v = land(w, k + 1);
        if (!u || !v) continue;
        both++;
        if (!(CX.abs(CX.sub(u, v)) <= SAME * (1 + CX.abs(u)))) apart.push({ k, a: +a.toFixed(3), d: CX.abs(CX.sub(u, v)) });
      }
    }
    check(`${type}: at the stage boundaries, the landings with k and k + 1 stages end on one root (both land at ${both} w)`, both >= MIN_BOTH && apart.length === 0, JSON.stringify({ both, apart: apart.slice(0, 4) }));
  }
}
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
