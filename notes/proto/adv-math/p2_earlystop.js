'use strict';
// Adversarial check 2: SPEC 3.6 early stop claims "D grows monotonically outward for every catalog family when only
// AFF/MOB ops lie between the family and z". With a MOB between the family and z, the members of one base lie on a
// CIRCLE (e.g. e^{1/z}: z_m = 1/(Log w + 2 pi i m)), and the distance from a circle to an off-centre window box is
// not monotone along it: D can rise and then fall again. A direction then stops (D > D_K) before a member with a
// smaller key: the composited front sheet is wrong (pattern seams; with alpha < 1, wrong sheet mix).
// GPU scan order of SPEC 4.1: per base, m*, m*+1, m*-1, m*+2, ...; a direction stops at its first member with D > D_K.
//   node notes/proto/adv-math/p2_earlystop.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require(path.join(ROOT, 'notes/proto/lead-inv/inverse_proto.js'));
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;

function keyFn(win, sing) {
  const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2, rs = R / 8;
  return (z) => {
    const dx = Math.max(win.x0 - z.re, 0, z.re - win.x1), dy = Math.max(win.y0 - z.im, 0, z.im - win.y1);
    let D = Math.log2(1 + Math.hypot(dx, dy) / R);
    for (const p of sing) D += Math.max(0, Math.log2(rs / Math.hypot(z.re - p.re, z.im - p.im)));
    return D;
  };
}
function scene(name, stepList, shape, win, sing, view, K) {
  const steps = stepList.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true }));
  const built = steps.map((s) => Funcs.build(s));
  const plan = INV.planChain(steps, built);
  const L = Region.levelOf(shape);
  let c0 = C((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2);
  let refs = INV.makeRefs(plan, c0);
  if (!refs.every(CX.isFin) || !CX.isFin(plan.ops.reduce((z, o) => o.fwd(z), c0))) { const Rw = (win.x1 - win.x0) / 4; c0 = C(c0.re + Rw * Math.cos(0.3), c0.im + Rw * Math.sin(0.3)); refs = INV.makeRefs(plan, c0); }
  const key = keyFn(win, sing);
  const pxw = 1 / view.s, Wd = 410, Ht = 516;
  let px = 0, mismatch = 0, wrongTop = 0, ex = null;
  for (let j = 0; j < Ht; j += 3) for (let i = 0; i < Wd; i += 3) {
    const w = C(view.cx + (i + 0.5 - Wd / 2) / view.s, view.cy - (j + 0.5 - Ht / 2) / view.s);
    const leaves = INV.enumerate(plan, w, refs, pxw, { cap: false });
    if (!leaves.length) continue;
    const recs = leaves.map((lf) => {
      const comps = lf.path.split('.').filter(Boolean).map(Number);
      const idx = comps[comps.length - 1] ?? 0, br = Math.round(idx / 1000);
      const cov = CX.isFin(lf.z) && L(lf.z) > 0 && lf.lvl > 0;
      return { br, m: idx - 1000 * br, D: CX.isFin(lf.z) ? key(lf.z) : Infinity, cov, z: lf.z };
    });
    const cmp = (a, b) => (a.D !== b.D ? a.D - b.D : (a.z.im !== b.z.im ? b.z.im - a.z.im : b.z.re - a.z.re));   // SPEC 5.2 tie rule
    const truth = recs.filter((r) => r.cov).sort(cmp).slice(0, K);
    if (!truth.length) continue;
    px++;
    const byBr = new Map();
    for (const r of recs) { if (!byBr.has(r.br)) byBr.set(r.br, []); byBr.get(r.br).push(r); }
    const found = [];
    const DK = () => (found.length >= K ? found[K - 1].D : Infinity);
    for (const list of byBr.values()) {          // bases scanned one after another (SPEC 4.1 loop nest)
      list.sort((a, b) => a.m - b.m);
      const mid = Math.floor(list.length / 2);
      let dP = false, dM = false;
      for (let t = 0; t < list.length; t++) {
        const plus = (t & 1) === 0, idx = mid + (plus ? 1 : -1) * Math.floor((t + 1) / 2);
        if (idx < 0 || idx >= list.length) { if (plus) dP = true; else dM = true; if (dP && dM) break; continue; }
        if (plus ? dP : dM) { if (dP && dM) break; continue; }
        const r = list[idx];
        if (r.cov) { found.push(r); found.sort(cmp); }
        if (r.D > DK()) { if (plus) dP = true; else dM = true; }
      }
    }
    const got = found.slice(0, K);
    const bad = got.length !== truth.length || got.some((x, q) => x !== truth[q]);
    if (bad) { mismatch++; if (got[0] !== truth[0]) { wrongTop++; if (!ex || (got[0].D > truth[0].D && ex.tie)) ex = { tie: got[0].D === truth[0].D, w, got: got.map((r) => [r.m, r.D.toFixed(3), CX.fmt(r.z)]), truth: truth.map((r) => [r.m, r.D.toFixed(3), CX.fmt(r.z)]), seq: byBr.values().next().value.map((r) => [r.m, r.D.toFixed(2), r.cov ? 'c' : '-']) }; } }
  }
  console.log(`${name.padEnd(52)} K=${K}: front-K mismatches ${mismatch}/${px}, wrong FRONT sheet ${wrongTop}`);
  if (ex) console.log('   example', JSON.stringify(ex));
}
const box = (cx, cy, s) => ({ x0: cx - 205 / s, x1: cx + 205 / s, y0: cy - 258 / s, y1: cy + 258 / s });
const disc = { kind: 'disc', c: [0, 0], r: 1 };
const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
for (const K of [1, 3]) {
  scene('e^{1/z} disc, left view at 0 (SPEC scene)', [{ type: 'recip' }, { type: 'exp' }], disc, box(0, 0, 120), [C(0, 0)], { cx: 0, cy: 0, s: 60 }, K);
  scene('e^{1/z} disc, left view at 0.6+0.1i, s=600', [{ type: 'recip' }, { type: 'exp' }], disc, box(0.6, 0.1, 600), [C(0, 0)], { cx: 0, cy: 0, s: 60 }, K);
  scene('e^{1/z} disc, left view at 0.05+0.05i, s=3000', [{ type: 'recip' }, { type: 'exp' }], disc, box(0.05, 0.05, 3000), [C(0, 0)], { cx: 0, cy: 0, s: 60 }, K);
  scene('e^{1/z} disc, left view at 0.3, s=400', [{ type: 'recip' }, { type: 'exp' }], disc, box(0.3, 0, 400), [C(0, 0)], { cx: 0, cy: 0, s: 60 }, K);
  scene('e^{1/z} disc, left view at -0.2+0.4i, s=300', [{ type: 'recip' }, { type: 'exp' }], disc, box(-0.2, 0.4, 300), [C(0, 0)], { cx: 0, cy: 0, s: 30 }, K);
  scene('exp of Cayley (H), left view at 0.3+1i', [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'exp' }], H, box(0.3, 1, 120), [C(0, -1)], { cx: 0, cy: 0, s: 60 }, K);
}
