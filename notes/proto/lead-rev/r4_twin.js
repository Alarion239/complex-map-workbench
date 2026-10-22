'use strict';
// Review fix M5: inter-candidate twin merge (SPEC rev 2, 4.2). Two leaves that coincide (|z_a - z_b| <= |dX|+|dY|)
// with opposing binding range gradients (lg_a . lg_b < -0.5) are the two sides of an intermediate cut that a later
// step heals: they are merged into one entry with cv = min(1, cv_a + cv_b). Coverage computed as render.js (solid).
//   node notes/proto/lead-rev/r4_twin.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require(path.join(ROOT, 'notes/proto/lead-inv/inverse_proto.js'));
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;
const W = 410, H = 516;
function coverage(plan, refs, L, w, pxw, merge) {
  const leaves = INV.enumerate(plan, w, refs, pxw, {});
  const cv = [];
  for (const lf of leaves) {
    const z = lf.z; if (!CX.isFin(z)) continue;
    const J = lf.J, dX = C(J[0] * pxw, J[2] * pxw), dY = C(J[1] * pxw, J[3] * pxw);
    const l0 = L(z), lx = (L(CX.add(z, dX)) - L(CX.sub(z, dX))) / 2, ly = (L(CX.add(z, dY)) - L(CX.sub(z, dY))) / 2, gl = Math.hypot(lx, ly);
    let sreg = gl > 0 ? l0 / gl : (l0 > 0 ? Infinity : -Infinity);
    let c;
    if (lf.lg && Number.isFinite(lf.lvl) && gl > 0 && (lx * lf.lg[0] + ly * lf.lg[1]) / gl < -0.5) c = Math.min(sreg, 0.5) + Math.min(lf.lvl, 0.5);
    else c = Math.min(sreg, lf.lvl) + 0.5;
    c = Math.min(1, Math.max(0, c));
    if (c <= 0) continue;
    cv.push({ c, z, fp: CX.abs(dX) + CX.abs(dY), lg: lf.lg, lvl: lf.lvl });
  }
  if (merge) {
    for (let a = 0; a < cv.length; a++) for (let b = a + 1; b < cv.length; b++) {
      const A = cv[a], B = cv[b];
      if (!A || !B || A.c >= 1 || B.c >= 1 || !A.lg || !B.lg) continue;
      if (CX.abs(CX.sub(A.z, B.z)) <= Math.max(A.fp, B.fp) && A.lg[0] * B.lg[0] + A.lg[1] * B.lg[1] < -0.5) { A.c = Math.min(1, A.c + B.c); cv[b] = null; }
    }
  }
  let U = 0; for (const e of cv) if (e) U = Math.max(U, e.c);
  return U;
}
function scene(name, steps, shape, view, merge, interiorTest) {
  const st = steps.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true }));
  const plan = INV.planChain(st, st.map((s) => Funcs.build(s)));
  const refs = INV.makeRefs(plan, C(view.cx + 0.01, view.cy + 0.01));
  const L = Region.levelOf(shape);
  let nIn = 0, low = 0, minC = 1, nOut = 0, spill = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const w = C(view.cx + (i + 0.5 - W / 2) / view.s, view.cy - (j + 0.5 - H / 2) / view.s);
    const tIn = interiorTest(w, 1 / view.s);
    if (tIn === 0) continue;
    const U = coverage(plan, refs, L, w, 1 / view.s, merge);
    if (tIn > 0) { nIn++; if (U < 0.99) low++; minC = Math.min(minC, U); } else { nOut++; if (U > 0.01) spill++; }
  }
  return `${name.padEnd(34)} ${merge ? 'merge' : 'rev1 '}: interior px ${nIn}, coverage < 0.99: ${String(low).padStart(3)}, min ${minC.toFixed(3)}; exterior px ${nOut}, spill ${spill}`;
}
const disc = { kind: 'disc', c: [-1, 0], r: 0.6 };
const dIn = (w, px) => { const d = 0.6 - Math.hypot(w.re + 1, w.im); return d > 3 * px ? 1 : d < -3 * px ? -1 : 0; };
for (const off of [0, 0.25, 0.5]) {
  const view = { cx: -1, cy: off / 150, s: 150 };
  for (const merge of [false, true]) {
    console.log(`offset ${off} px  ` + scene('[log, exp] disc at -1', [{ type: 'log', params: { cut: 180, k: 0 } }, { type: 'exp' }], disc, view, merge, dIn));
    console.log(`offset ${off} px  ` + scene('[root 2, z^2] disc at -1', [{ type: 'root', params: { n: 2, cut: 180, k: 0 } }, { type: 'pown', params: { n: 2 } }], disc, view, merge, dIn));
    console.log(`offset ${off} px  ` + scene('[root 3, z^3] disc at -1', [{ type: 'root', params: { n: 3, cut: 180, k: 0 } }, { type: 'pown', params: { n: 3 } }], disc, view, merge, dIn));
  }
}
// controls: the facing rule case log(H) at Im w = +-pi, and z^i(H) rims must not change
const Hs = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const strip = (w, px) => { const d = Math.min(w.im, Math.PI - w.im); return d > 2 * px ? 1 : d < -2 * px ? -1 : 0; };
for (const merge of [false, true]) console.log('control  ' + scene('log(H) strip', [{ type: 'log', params: { cut: 180, k: 0 } }], Hs, { cx: 0, cy: 1.5, s: 60 }, merge, strip));
const ann = (w, px) => { const r = Math.hypot(w.re, w.im), d = Math.min(r - Math.exp(-Math.PI), 1 - r); return d > 2 * px ? 1 : d < -2 * px ? -1 : 0; };
for (const merge of [false, true]) console.log('control  ' + scene('z^i(H) annulus', [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }], Hs, { cx: 0, cy: 0, s: 190 }, merge, ann));
