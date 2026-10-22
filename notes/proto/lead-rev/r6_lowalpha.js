'use strict';
// Review fix M7: opacity at infinite multiplicity for low alpha (mask20: alpha = 0.2, K = B = 16).
// rev1: window m* +- 8 around the clipWin reference (inverse_proto.js enumerate), tail closure only when nCov > B.
// rev2: walk.js (ranges, two cursors, early stop at K) + tail closure when a truncated direction's last 3 members cover.
//   node notes/proto/lead-rev/r6_lowalpha.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require(path.join(ROOT, 'notes/proto/lead-inv/inverse_proto.js'));
const W2 = require('./walk.js');
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;
const alpha = 0.2, B = 16, K = Math.min(B, Math.ceil(Math.log(1 / 255) / Math.log(1 - alpha)));
function scene(name, steps, shape, srcWin, view, interior, sing) {
  const { plan } = W2.planOf(steps);
  const prep = W2.prepare(plan, shape, srcWin, { sing });
  const refs = INV.makeRefs(plan, prep.refs[0]);
  const L = Region.levelOf(shape);
  let n = 0, min1 = 1, min2 = 1, sum1 = 0, sum2 = 0, rays = new Map();
  for (let j = 0; j < 516; j += 3) for (let i = 0; i < 410; i += 3) {
    const w = C(view.cx + (i + 0.5 - 205) / view.s, view.cy - (j + 0.5 - 258) / view.s);
    if (!interior(w, 1 / view.s)) continue;
    n++;
    const old = INV.enumerate(plan, w, refs, 1 / view.s, {}).filter((lf) => CX.isFin(lf.z) && L(lf.z) > 0 && lf.lvl > 0).length;
    const o1 = old > B ? 1 : 1 - Math.pow(1 - alpha, Math.min(old, B));
    const r = W2.walk(plan, prep, w, 1 / view.s, { K });
    const nf = r.found.length;
    const o2 = r.tailInf ? 1 : 1 - Math.pow(1 - alpha, Math.min(nf, B));
    min1 = Math.min(min1, o1); min2 = Math.min(min2, o2); sum1 += o1; sum2 += o2;
    const ray = Math.round(Math.atan2(w.im, w.re) * 180 / Math.PI / 5) * 5;
    if (!rays.has(ray)) rays.set(ray, []); rays.get(ray).push(o1);
  }
  // opacity step along a ray (rev1): max difference of mean opacity between neighbouring 5-degree bins
  const bins = [...rays.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => v.reduce((s, x) => s + x, 0) / v.length);
  let step = 0; for (let i = 1; i < bins.length; i++) step = Math.max(step, Math.abs(bins[i] - bins[i - 1]));
  console.log(`${name.padEnd(12)} alpha ${alpha} K ${K} B ${B}: interior px ${n}; rev1 opacity min ${min1.toFixed(3)} mean ${(sum1 / n).toFixed(3)} (max step between 5-deg sectors ${step.toFixed(3)}) | rev2 opacity min ${min2.toFixed(3)} mean ${(sum2 / n).toFixed(3)}`);
}
const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const box = (v) => ({ x0: v.cx - 205 / v.s, x1: v.cx + 205 / v.s, y0: v.cy - 258 / v.s, y1: v.cy + 258 / v.s });
scene('expH', [{ type: 'exp' }], H, box({ cx: 0, cy: 1, s: 60 }), { cx: 0, cy: 0, s: 60 }, (w, px) => Math.hypot(w.re, w.im) > 3 * px, []);
scene('zi_H', [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }], H, box({ cx: 0, cy: 1, s: 60 }), { cx: 0, cy: 0, s: 190 },
  (w, px) => { const r = Math.hypot(w.re, w.im); return Math.min(r - Math.exp(-Math.PI), 1 - r) > 3 * px; }, [C(0, 0)]);
scene('e1z_disc', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 1 }, box({ cx: 0, cy: 0, s: 120 }), { cx: 0, cy: 0, s: 60 }, (w, px) => Math.hypot(w.re, w.im) > 3 * px, [C(0, 0)]);
