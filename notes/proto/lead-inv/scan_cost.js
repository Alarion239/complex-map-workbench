'use strict';
// GPU loop cost of the outward family scan with the saturation early stop (SPEC 4.4): members are visited m*, m*+1,
// m*-1, m*+2, ...; a direction stops at its first member whose key D exceeds D_K (the K-th smallest key among the
// covering members found so far) once K covering members are known (K = 1 for alpha 1, 3 for alpha 0.85).
// Also checks that the early stop never changes the composited front K (exactness of the stop rule).
//   node notes/proto/lead-inv/scan_cost.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require('./inverse_proto.js');
const R = require('./render.js');
const Region = require(path.join(ROOT, 'src/region.js'));
const Q = require(path.join(ROOT, 'test/regress/quality/scenes.js'));
const { C } = CX;
const W = 410, H = 516;
const scenes = [...R.NEW.map((s) => Object.assign({}, s, { view: s.rightView })), ...Q.SCENES.filter((s) => ['exp_strip', 'sin_halfstrip'].includes(s.name)).map((s) => Object.assign({}, s, { view: s.rightView }))];
for (const sc of scenes) for (const K of [1, 3]) {
  const steps = sc.steps.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: true }));
  const built = steps.map((s) => Funcs.build(s));
  const plan = INV.planChain(steps, built);
  const shape = sc.shapes[0], L = Region.levelOf(shape), win = Q.boxOf(sc.srcView);
  let c0 = C(sc.srcView.cx, sc.srcView.cy), refs = INV.makeRefs(plan, c0);
  if (!refs.every(CX.isFin) || !CX.isFin(plan.ops.reduce((z, o) => o.fwd(z), c0))) { const Rw = (win.x1 - win.x0) / 4; c0 = C(c0.re + Rw * Math.cos(0.3), c0.im + Rw * Math.sin(0.3)); refs = INV.makeRefs(plan, c0); }
  const key = R.keyFn(win, sc.sing || []);
  const pxw = 1 / sc.view.s;
  let scanned = 0, full = 0, mismatch = 0, px = 0, nonMono = 0;
  for (let j = 0; j < H; j += 2) for (let i = 0; i < W; i += 2) {
    const w = C(sc.view.cx + (i + 0.5 - W / 2) / sc.view.s, sc.view.cy - (j + 0.5 - H / 2) / sc.view.s);
    const leaves = INV.enumerate(plan, w, refs, pxw);
    if (!leaves.length) continue;
    px++;
    // member index of the (single) family op: the last path component; group by sub-branch (idx / 1000)
    const recs = leaves.map((lf) => {
      const comps = lf.path.split('.').filter(Boolean).map(Number);
      const idx = comps[comps.length - 1] ?? 0;
      const z = lf.z, J = lf.J, dX = C(J[0] * pxw, J[2] * pxw), dY = C(J[1] * pxw, J[3] * pxw);
      let cov = false;
      if (CX.isFin(z)) {
        const l0 = L(z), lx = (L(CX.add(z, dX)) - L(CX.sub(z, dX))) / 2, ly = (L(CX.add(z, dY)) - L(CX.sub(z, dY))) / 2, gl = Math.hypot(lx, ly);
        const s = gl > 0 ? l0 / gl : (l0 > 0 ? Infinity : -Infinity);
        cov = Math.min(s, lf.lvl) + 0.5 > 0;
      }
      const br = Math.round(idx / 1000);
      return { br, m: idx - 1000 * br, D: CX.isFin(z) ? key(z) : Infinity, cov };
    });
    full += recs.length;
    // truth: the K smallest covering keys
    const allCov = recs.filter((r) => r.cov).map((r) => r.D).sort((a, b) => a - b).slice(0, K);
    // outward scan per sub-branch: centre = middle member of the window
    const byBr = new Map();
    for (const r of recs) { if (!byBr.has(r.br)) byBr.set(r.br, []); byBr.get(r.br).push(r); }
    const found = [];
    let n = 0;
    const dirs = [];
    for (const list of byBr.values()) {
      list.sort((a, b) => a.m - b.m);
      const mid = Math.floor(list.length / 2);
      dirs.push({ list, i: mid, step: 1, done: false }, { list, i: mid - 1, step: -1, done: false });
    }
    const DK = () => (found.length >= K ? found[K - 1] : Infinity);
    let active = true;
    while (active) {
      active = false;
      for (const d of dirs) {
        if (d.done) continue;
        if (d.i < 0 || d.i >= d.list.length) { d.done = true; continue; }
        const r = d.list[d.i]; d.i += d.step; n++; active = true;
        if (r.cov) { found.push(r.D); found.sort((a, b) => a - b); }
        if (r.D > DK()) d.done = true;
      }
    }
    scanned += n;
    const got = found.slice(0, K);
    if (got.length !== allCov.length || got.some((x, q) => Math.abs(x - allCov[q]) > 1e-12)) mismatch++;
  }
  console.log(`${sc.name.padEnd(14)} K=${K}  members/px: full window ${(full / px).toFixed(1)}  early stop ${(scanned / px).toFixed(1)}  front-K mismatches ${mismatch}/${px}`);
}
