'use strict';
// Adversarial check 1: the family window is centred on clipWin's centre (SPEC 3.6), with M = 8 for the inner family
// and M = 2 for every other window family (3.4). A bounded shape that lies more than M periods from the reference
// (or whose outer-family image spans more than 2M+1 outer periods) loses preimages: its image is partly or wholly
// missing, where today's forward mesh (bbox-gridded, independent of clipWin) draws it.
// For each scene: sample N points z in the shape, w = F(z) (the app's own step f), and ask the SPEC enumerator
// (lead prototype, same window/centre rule) whether ANY covering preimage is found. "missed" = w in the true image
// but no enumerated member lies in the shape.
//   node notes/proto/adv-math/p1_window_miss.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require(path.join(ROOT, 'notes/proto/lead-inv/inverse_proto.js'));
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;

function planOf(stepList) {
  const steps = stepList.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true }));
  const built = steps.map((s) => Funcs.build(s));
  const plan = INV.planChain(steps, built);
  if (!plan.ok) throw new Error(plan.reason);
  return { plan, F: (z) => plan.ops.reduce((u, o) => o.fwd(u), z) };
}
// SPEC 3.4 caps: inner window family M = 8 (reduced to >= 4 while bound > 64), every other window family M = 2.
// The prototype hard-codes M_WIN = 8 everywhere, so emulate outer M = 2 with an ext() that narrows the window.
function specExt(plan) {
  const fam = plan.ops.map((o, i) => (o.count === 'inf' ? i : -1)).filter((i) => i >= 0);
  const inner = fam.length ? fam[0] : -1;
  let Mi = 8;
  const nbOf = (o) => (['SIN', 'COS', 'SINH', 'COSH'].includes(o.kind) ? 2 : 1);
  const bound = () => fam.reduce((p, i) => p * nbOf(plan.ops[i]) * (2 * (i === inner ? Mi : 2) + 1), 1);
  while (bound() > 64 && Mi > 4) Mi--;
  return (i) => {
    if (plan.ops[i].count !== 'inf') return null;
    const M = i === inner ? Mi : 2;
    return (m0, m1) => { const c = (m0 + m1) / 2; return [c - M, c + M]; };
  };
}
function run(name, stepList, shape, win, N = 4000) {
  const { plan, F } = planOf(stepList);
  const L = Region.levelOf(shape);
  const c0 = C((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2);
  const refs = INV.makeRefs(plan, c0);
  const ext = specExt(plan);
  const bb = Region.bboxOf(shape);
  let n = 0, miss = 0, seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (n < N) {
    const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
    if (!(L(z) > 1e-6)) continue;
    const w = F(z);
    if (!CX.isFin(w)) continue;
    n++;
    const leaves = INV.enumerate(plan, w, refs, 1e-3, { ext, cap: false });
    if (!leaves.some((lf) => CX.isFin(lf.z) && L(lf.z) > -1e-9 && lf.lvl > -0.5)) miss++;
  }
  console.log(`${name.padEnd(46)} missed ${miss}/${n} (${(100 * miss / n).toFixed(1)} % of the true image samples)`);
}
const WIN0 = { x0: -3.4, x1: 3.4, y0: -4.3, y1: 4.3 };            // default-like left view (s = 60)
const WIDE = { x0: -80, x1: 80, y0: -100, y1: 100 };              // left plane zoomed out (s ~ 2.6)
run('exp, disc r=1 at 60i, left view at 0 (wide)', [{ type: 'exp' }], { kind: 'disc', c: [0, 60], r: 1 }, WIDE);
run('tan, disc r=1 at 30, left view at 0 (wide)', [{ type: 'tan' }], { kind: 'disc', c: [30, 0], r: 1 }, WIDE);
run('sin, rect [20,40]x[0,1], left view at 0 (wide)', [{ type: 'sin' }], { kind: 'rect', a: [20, 0], b: [40, 1] }, WIDE);
run('exp, disc at 60i, left view panned to the disc', [{ type: 'exp' }], { kind: 'disc', c: [0, 60], r: 1 }, { x0: -3, x1: 3, y0: 57, y1: 63 });
run('exp∘exp, disc r=0.1 at 3+0.9i, default view', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [3, 0.9], r: 0.1 }, WIN0);
run('exp∘exp, disc r=1 at 3, default view', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [3, 0], r: 1 }, WIN0);
run('sin∘exp, disc r=0.3 at 2.5+0.5i, default view', [{ type: 'exp' }, { type: 'sin' }], { kind: 'disc', c: [2.5, 0.5], r: 0.3 }, WIN0);
run('exp∘exp, rect [0,3]x[-1,1] (in view)', [{ type: 'exp' }, { type: 'exp' }], { kind: 'rect', a: [0, -1], b: [3, 1] }, WIN0);
run('control: exp, disc r=1 at 2i, default view', [{ type: 'exp' }], { kind: 'disc', c: [0, 2], r: 1 }, WIN0);

// e^{z^2} (palette formula, also custom): SPEC 3.4's pseudo-code gives EXP M = 2 (the inner multivalued op is IPOW,
// a finite family, so EXP is "every other window family"); SPEC 12.1 (c) says 34 leaves (M = 8). Both shown.
function runM(name, stepList, shape, win, Mexp) {
  const { plan, F } = planOf(stepList);
  const L = Region.levelOf(shape);
  const refs = INV.makeRefs(plan, C((win.x0 + win.x1) / 2 + 1e-3, (win.y0 + win.y1) / 2 + 1e-3));
  const ext = (i) => (plan.ops[i].count === 'inf' ? (m0, m1) => { const c = (m0 + m1) / 2; return [c - Mexp, c + Mexp]; } : null);
  const bb = Region.bboxOf(shape);
  let n = 0, miss = 0, seed = 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  while (n < 3000) {
    const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
    if (!(L(z) > 1e-6)) continue;
    const w = F(z); if (!CX.isFin(w)) continue; n++;
    const leaves = INV.enumerate(plan, w, refs, 1e-3, { ext, cap: false });
    if (!leaves.some((lf) => CX.isFin(lf.z) && L(lf.z) > -1e-9)) miss++;
  }
  console.log(`${name.padEnd(46)} EXP M=${Mexp}: missed ${miss}/${n}`);
}
const ez2 = [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }];
for (const M of [2, 8]) {
  runM('e^{z^2}, disc r=0.3 at 3+3i, default view', ez2, { kind: 'disc', c: [3, 3], r: 0.3 }, WIN0, M);
  runM('e^{z^2}, disc r=0.3 at 3.3+4.1i, default view', ez2, { kind: 'disc', c: [3.3, 4.1], r: 0.3 }, WIN0, M);
}

// scaled arguments shrink the window in z: e^{10z} has period 2pi/10 in Im z, so M = 8 reaches only +-5.3 units
const OUT2 = { x0: -6.8, x1: 6.8, y0: -8.6, y1: 8.6 };            // left view zoomed out 2x (s = 30)
run('e^{10z}, disc r=0.3 at 6.5i, left view out 2x', [{ type: 'custom', params: { expr: 'e^{10z}', cut: 180 } }], { kind: 'disc', c: [0, 6.5], r: 0.3 }, OUT2);
run('sin(5z), disc r=0.3 at 6, left view out 2x', [{ type: 'custom', params: { expr: '\\sin(5z)', cut: 180 } }], { kind: 'disc', c: [6, 0.3], r: 0.3 }, OUT2);
run('tan(4z), rect [5,6.5]x[-1,1], left view out 2x', [{ type: 'custom', params: { expr: '\\tan(4z)', cut: 180 } }], { kind: 'rect', a: [5, -1], b: [6.5, 1] }, OUT2);
