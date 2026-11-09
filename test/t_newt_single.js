// Node check of the single-root skip (src/invops.js opNewt, src/inverse.js newtOps): a step that declares degreeOne
// (one root of H_t(u) = w at most, checked numerically over a grid of seeds) skips the identity-seeded member's walk
// where member 0 has already hit, which is the same root, so the members are the full path's and the walk's work is
// saved. Run: node test/t_newt_single.js
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

// the glide's t, early to near its end, with the most work per pixel the skipped path may do as a part of the full path's (H
// calls): member 1 walks about 32 (1 - t) stages and member 0 the rest, so the skip saves most early and little late
const MAX_WORK = { 0.1: 0.5, 0.5: 0.7, 0.9: 0.95, 0.9999: 0.99 };
const T_LIST = Object.keys(MAX_WORK).map(Number);
const GRID = 24, RMIN = 1.02, RMAX = 3;   // the scan: GRID^2 points of RMIN < |w| < RMAX
const same = (a, b) => Math.hypot(a.re - b.re, a.im - b.im) <= 1e-9 * (1 + Math.hypot(a.re, a.im));
const pts = [];
for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) { const r = RMIN + (RMAX - RMIN) * i / (GRID - 1), a = 2 * Math.PI * (j + 0.5) / GRID; pts.push({ re: r * Math.cos(a), im: r * Math.sin(a) }); }
const calls = { n: 0 };
const buildOp = (type, t, degreeOne) => {
  const s = { type, params: Funcs.defaults(type), on: true }, b = Funcs.build(s), h0 = b.hom;
  b.hom = (st) => { const g = h0(st); return (z) => { calls.n++; return g(z); }; };
  if (degreeOne === false) b.degreeOne = false;
  const hk = Inverse.homOps(b, t);
  return hk.ops.find((o) => o.kind === 'NEWT');
};
for (const type of ['dh', 'bottcher']) {
  for (const t of T_LIST) {
    const skip = buildOp(type, t), full = buildOp(type, t, false);
    check(`${type} t=${t}: has NEWT ops`, !!skip && !!full);
    if (!skip || !full) continue;
    let ws = 0, wf = 0, diff = 0, nm = 0;
    for (const w of pts) {
      calls.n = 0; const a = skip.pre(w); ws += calls.n;
      calls.n = 0; const b = full.pre(w); wf += calls.n;
      nm += b.length;
      if (a.length !== b.length || a.some((e) => !b.some((g) => same(e.u, g.u)))) diff++;
    }
    check(`${type} t=${t}: the skipped path has the full path's members at every scanned point (${diff} differ of ${pts.length})`, diff === 0 && nm > 0);
    check(`${type} t=${t}: and does at most ${MAX_WORK[t]} of its work (${(ws / wf).toFixed(2)})`, ws <= MAX_WORK[t] * wf, JSON.stringify({ ws, wf }));
  }
}
// controls: a step that declares degreeOne but has two roots over a w (z + a / z, a above the tangency test's reach: two
// preimages of every w) fails the numeric check and keeps the full path; a polynomial step keeps its two members
{
  const A = 40;   // |f(z) / z - 1| = A / |z|^2 = 0.04 at |z| = NEWT_RAY.R: the identity test passes, the map is two-to-one
  const s = { type: 'dh', params: Funcs.defaults('dh'), on: true }, b = Funcs.build(s);
  const f = (z) => ({ re: z.re + A * z.re / (z.re * z.re + z.im * z.im), im: z.im - A * z.im / (z.re * z.re + z.im * z.im) });
  b.f = f; b.hom = (t) => (z) => { const w = f(z); return { re: (1 - t) * z.re + t * w.re, im: (1 - t) * z.im + t * w.im }; };
  const op = Inverse.homOps(b, 0.5).ops.find((o) => o.kind === 'NEWT');
  check('a two-to-one step declaring degreeOne is not accepted as single-root (its ops carry no skip)', !!op && !(op.p.back || []).some((q) => q.single) && (op.p.back || []).some((q) => q.ray), JSON.stringify(op && op.p.back && op.p.back.map((q) => [q.ray, q.single])));
  const q = Inverse.homOps(Funcs.build({ type: 'poly', params: Funcs.defaults('poly'), on: true }), 0.5).ops.find((o) => o.kind === 'NEWT');
  check('a polynomial step keeps its roots as members (no skip)', !!q && !(q.p.back || []).some((x) => x.single));
}
{
  const ws = Inverse.singleRootW(), BOX = 3.5;
  const has = (x, y) => ws.some((w) => Math.abs(w.re - x) < 1e-12 && Math.abs(w.im - y) < 1e-12);
  const spots = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) spots.push([BOX * x, BOX * y]);
  check('the single-root check samples the place box: its 4 corners, 4 edge midpoints and centre', spots.every(([x, y]) => has(x, y)), JSON.stringify(ws.length));
}
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
