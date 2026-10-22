'use strict';
// Review fix M4: exact early stop with a Mobius between the family and z (lower-bound rule, walk.js), against the
// full-window truth, over random left views (as notes/proto/adv-math/p2b_search.js), plus the AFF-prefix families.
//   node notes/proto/lead-rev/r2_earlystop.js
const W2 = require('./walk.js');
const { C } = CX;
let seed = 99; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const same = (a, b) => a.length === b.length && a.every((x, i) => CX.abs(CX.sub(x.z, b[i].z)) <= 1e-9 * (1 + CX.abs(x.z)));
function trial(stepList, shape, sing, win, view, K, mode) {
  const { plan } = W2.planOf(stepList);
  const prep = W2.prepare(plan, shape, win, { sing, naiveStop: mode === 'naive', noMobStop: mode === 'nostop' });
  const truthPrep = W2.prepare(plan, shape, win, { sing });
  let px = 0, wrong = 0, wrongTop = 0, vis = 0, gap = 0, untr = 0;
  for (let j = 0; j < 516; j += 6) for (let i = 0; i < 410; i += 6) {
    const w = C(view.cx + (i + 0.5 - 205) / view.s, view.cy - (j + 0.5 - 258) / view.s);
    const tr = W2.walk(plan, truthPrep, w, 1 / view.s, { K, full: 60 }).found.slice(0, K);
    if (!tr.length) continue;
    px++;
    const r = W2.walk(plan, prep, w, 1 / view.s, { K });
    vis += r.visited;
    const got = r.found.slice(0, K);
    if (!same(got, tr)) { wrong++; if (!r.truncated) untr++; if (!got.length || CX.abs(CX.sub(got[0].z, tr[0].z)) > 1e-9) { wrongTop++; gap = Math.max(gap, got.length ? got[0].D - tr[0].D : Infinity); } }
  }
  return { px, wrong, wrongTop, vis, gap, untr };
}
const CASES = [
  ['e^{1/z} on |z|<1', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 1 }, [C(0, 0)], 0],
  ['exp(Cayley) on |z+i|<1.5', [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'exp' }], { kind: 'disc', c: [0, -1], r: 1.5 }, [C(0, -1)], -1],
  ['exp(H)', [{ type: 'exp' }], { kind: 'halfplane', a: [0, 0], b: [1, 0] }, [], 1],
  ['z^i(H)', [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }], { kind: 'halfplane', a: [0, 0], b: [1, 0] }, [C(0, 0)], 1],
  ['tan(2z+1) on |z|<3', [{ type: 'affine', params: { a: '2', b: '1' } }, { type: 'tan' }], { kind: 'disc', c: [0, 0], r: 3 }, [], 0],
];
for (const [name, steps, shape, sing, cy0] of CASES) {
  for (const mode of (process.env.MODES || 'naive,lb').split(',')) {
    if (mode === 'naive' && !/1\/z|Cayley/.test(name)) continue;
    for (const K of [1, 3]) {
      let tot = 0, totW = 0, totT = 0, vis = 0, worst = 0, gap = 0, untr = 0;
      seed = 99;
      for (let t = 0; t < 40; t++) {
        const s = 60 * Math.pow(50, rnd()), cx = (rnd() * 2 - 1) * 0.8, cy = (rnd() * 2 - 1) * 0.8 + cy0;
        const win = { x0: cx - 205 / s, x1: cx + 205 / s, y0: cy - 258 / s, y1: cy + 258 / s };
        const r = trial(steps, shape, sing, win, { cx: 0, cy: 0, s: 40 }, K, mode);
        gap = Math.max(gap, r.gap); untr += r.untr; tot += r.px; totW += r.wrong; totT += r.wrongTop; vis += r.vis; worst = Math.max(worst, r.wrong / Math.max(1, r.px));
      }
      console.log(`${name.padEnd(26)} ${mode.padEnd(5)} K=${K}: 40 random left views, front-K mismatches ${totW}/${tot} (${(100 * totW / tot).toFixed(2)} %, wrong front sheet ${totT}), worst view ${(100 * worst).toFixed(1)} %, leaves/px ${(vis / tot).toFixed(1)}, mismatches without truncation ${untr}, max front-D gap ${gap.toFixed(4)} octave`);
    }
  }
}
