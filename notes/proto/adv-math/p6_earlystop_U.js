'use strict';
// Adversarial check 6: SPEC 3.6/4.2 early stop counts any leaf with cv > 0 as "covering" when it builds D_K. On the
// rim of the front sheet (cv ~ 0.5) the scan stops before reaching a deeper sheet that covers the pixel FULLY, so
// the coverage union U = max(cv) is underestimated: the pixel is ~half transparent though the true image covers it.
// Emulation of the GPU scan order (m*, m*+1, m*-1, ...) with the stop rule, against the full window, using the
// lead's enumerator and the 4.2 coverage formula (plain min rule) on exp(H) (SPEC scene: left view (0,1), s 60).
//   node notes/proto/adv-math/p6_earlystop_U.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require(path.join(ROOT, 'notes/proto/lead-inv/inverse_proto.js'));
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;
function run(name, stepList, shape, srcView, view, sing, K) {
  const steps = stepList.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true }));
  const plan = INV.planChain(steps, steps.map((s) => Funcs.build(s)));
  const L = Region.levelOf(shape);
  const win = { x0: srcView.cx - 205 / srcView.s, x1: srcView.cx + 205 / srcView.s, y0: srcView.cy - 258 / srcView.s, y1: srcView.cy + 258 / srcView.s };
  const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2, rs = R / 8;
  const key = (z) => { const dx = Math.max(win.x0 - z.re, 0, z.re - win.x1), dy = Math.max(win.y0 - z.im, 0, z.im - win.y1); let D = Math.log2(1 + Math.hypot(dx, dy) / R); for (const p of sing) D += Math.max(0, Math.log2(rs / Math.hypot(z.re - p.re, z.im - p.im))); return D; };
  let c0 = C(srcView.cx, srcView.cy), refs = INV.makeRefs(plan, c0);
  if (!refs.every(CX.isFin) || !CX.isFin(plan.ops.reduce((z, o) => o.fwd(z), c0))) { c0 = C(c0.re + (win.x1 - win.x0) / 4 * Math.cos(0.3), c0.im + (win.x1 - win.x0) / 4 * Math.sin(0.3)); refs = INV.makeRefs(plan, c0); }
  const pxw = 1 / view.s;
  let n = 0, under = 0, worst = 1;
  for (let j = 0; j < 516; j++) for (let i = 0; i < 410; i++) {
    const w = C(view.cx + (i + 0.5 - 205) / view.s, view.cy - (j + 0.5 - 258) / view.s + 0.3 / view.s);
    const lv = INV.enumerate(plan, w, refs, pxw, { cap: false });
    const recs = lv.map((lf) => {
      const z = lf.z; if (!CX.isFin(z)) return { cv: 0, D: Infinity };
      const J = lf.J, dX = C(J[0] * pxw, J[2] * pxw), dY = C(J[1] * pxw, J[3] * pxw);
      const l0 = L(z), lx = (L(CX.add(z, dX)) - L(CX.sub(z, dX))) / 2, ly = (L(CX.add(z, dY)) - L(CX.sub(z, dY))) / 2, gl = Math.hypot(lx, ly);
      const sreg = gl > 0 ? l0 / gl : (l0 > 0 ? Infinity : -Infinity);
      return { cv: Math.min(1, Math.max(0, Math.min(sreg, lf.lvl) + 0.5)), D: key(z) };
    });
    const Ufull = recs.reduce((m, r) => Math.max(m, r.cv), 0);
    if (Ufull <= 0) continue;
    n++;
    const mid = Math.floor(recs.length / 2), found = []; let dP = false, dM = false, U = 0;
    for (let t = 0; t < recs.length; t++) {
      const plus = (t & 1) === 0, idx = mid + (plus ? 1 : -1) * Math.floor((t + 1) / 2);
      if (idx < 0 || idx >= recs.length) { if (plus) dP = true; else dM = true; if (dP && dM) break; continue; }
      if (plus ? dP : dM) { if (dP && dM) break; continue; }
      const r = recs[idx];
      if (r.cv > 0) { found.push(r.D); found.sort((a, b) => a - b); U = Math.max(U, r.cv); }
      if (found.length >= K && r.D > found[K - 1]) { if (plus) dP = true; else dM = true; }
    }
    if (U < Ufull - 0.05) { under++; worst = Math.min(worst, U / Ufull); }
  }
  console.log(`${name.padEnd(30)} K=${K}: covered px ${n}, early-stop coverage below full-window coverage: ${under} px (worst ratio ${worst.toFixed(2)})`);
}
const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
for (const K of [1, 3]) {
  run('exp(H)', [{ type: 'exp' }], H, { cx: 0, cy: 1, s: 60 }, { cx: 0, cy: 0, s: 60 }, [], K);
  run('e^{1/z} on |z|<1', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 1 }, { cx: 0, cy: 0, s: 120 }, { cx: 0, cy: 0, s: 60 }, [C(0, 0)], K);
}
