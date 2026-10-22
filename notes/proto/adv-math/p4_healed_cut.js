'use strict';
// Adversarial check 4: a cut of an intermediate step that a LATER step heals (the composite is continuous across it).
// E.g. [log, exp] (the palette's "Inverse of f_k" builds exactly these chains), [sqrt, z^2], [root 3, z^3].
// Per pixel straddling the healed cut, the SAME z comes back twice (members on both sides of the cut), with
// complementary range levels +d and -d px. SPEC 4.2 coverage union takes U = max(cv) = 0.5 + d, so the pixel's
// coverage is ~0.5..1 instead of 1: a half-transparent crack line along the healed cut, through the interior of the
// fill (no region boundary there, so the facing rule does not apply). Today's forward path evaluates the
// continuous composite and has no crack. Uses the lead's CPU reference renderer (render.js), unchanged.
//   node notes/proto/adv-math/p4_healed_cut.js
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const R = require(path.join(ROOT, 'notes/proto/lead-inv/render.js'));
const { C } = CX;
const W = R.W, H = R.H;
function scene(name, steps, shape, view, cutTest) {
  const sc = { name, shapes: [shape], steps, srcView: { cx: view.cx, cy: view.cy, s: view.s }, sing: [], rightView: view, group: 'x' };
  const r = R.render(sc, view, 'solid');
  // interior pixels (>= 3 px inside the shape, measured in w = z since the composite is the identity)
  const L = require(path.join(ROOT, 'src/region.js')).levelOf(shape);
  let nIn = 0, low = 0, minCov = 1, onCut = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const w = C(view.cx + (i + 0.5 - W / 2) / view.s, view.cy - (j + 0.5 - H / 2) / view.s);
    if (!(L(w) > 3 / view.s)) continue;
    nIn++;
    const c = r.cov[j * W + i];
    if (c < 0.99) { low++; if (cutTest(w, 1 / view.s)) onCut++; }
    minCov = Math.min(minCov, c);
  }
  console.log(`${name.padEnd(40)} interior px ${nIn}, coverage < 0.99: ${low} (on the healed cut: ${onCut}), min coverage ${minCov.toFixed(3)}`);
}
const disc = { kind: 'disc', c: [-1, 0], r: 0.6 };
const negAxis = (w, px) => w.re < 0 && Math.abs(w.im) < 1.5 * px;
scene('[log, exp] disc at -1', [{ type: 'log', params: { cut: 180, k: 0 } }, { type: 'exp', params: {} }], disc, { cx: -1, cy: 0.3 / 150, s: 150 }, negAxis);
scene('[sqrt (root 2), z^2] disc at -1', [{ type: 'root', params: { n: 2, cut: 180, k: 0 } }, { type: 'pown', params: { n: 2 } }], disc, { cx: -1, cy: 0.3 / 150, s: 150 }, negAxis);
scene('[root 3, z^3] disc at -1', [{ type: 'root', params: { n: 3, cut: 180, k: 0 } }, { type: 'pown', params: { n: 3 } }], disc, { cx: -1, cy: 0.3 / 150, s: 150 }, negAxis);
scene('control: [exp] disc at -1 (no cut)', [{ type: 'mul', params: { c: '1' } }], disc, { cx: -1, cy: 0.3 / 150, s: 150 }, negAxis);
