'use strict';
// Random search over left-view placements for e^{1/z} (MOB before EXP) and exp((z-i)/(z+i)) (Cayley before EXP):
// early stop (SPEC 3.6 / 4.1 scan order) vs full window front sheet, with the 5.2 tie rule. Reports the worst D gap.
const path = require('path');
const ROOT = path.resolve(__dirname, '../../..');
const INV = require(path.join(ROOT, 'notes/proto/lead-inv/inverse_proto.js'));
const Region = require(path.join(ROOT, 'src/region.js'));
const { C } = CX;
let seed = 99; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function trial(stepList, shape, sing, win, view, K) {
  const steps = stepList.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params || {}), on: true }));
  const plan = INV.planChain(steps, steps.map((s) => Funcs.build(s)));
  const L = Region.levelOf(shape);
  const R = Math.hypot(win.x1 - win.x0, win.y1 - win.y0) / 2, rs = R / 8;
  const key = (z) => { const dx = Math.max(win.x0 - z.re, 0, z.re - win.x1), dy = Math.max(win.y0 - z.im, 0, z.im - win.y1); let D = Math.log2(1 + Math.hypot(dx, dy) / R); for (const p of sing) D += Math.max(0, Math.log2(rs / Math.hypot(z.re - p.re, z.im - p.im))); return D; };
  const refs = INV.makeRefs(plan, C((win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2));
  const cmp = (a, b) => (a.D !== b.D ? a.D - b.D : (a.z.im !== b.z.im ? b.z.im - a.z.im : b.z.re - a.z.re));
  let px = 0, wrong = 0, gapMax = 0;
  for (let j = 0; j < 516; j += 6) for (let i = 0; i < 410; i += 6) {
    const w = C(view.cx + (i + 0.5 - 205) / view.s, view.cy - (j + 0.5 - 258) / view.s);
    const lv = INV.enumerate(plan, w, refs, 1 / view.s, { cap: false });
    const recs = lv.map((lf) => ({ z: lf.z, D: CX.isFin(lf.z) ? key(lf.z) : Infinity, cov: CX.isFin(lf.z) && L(lf.z) > 0 }));
    const truth = recs.filter((r) => r.cov).sort(cmp);
    if (!truth.length) continue; px++;
    const mid = Math.floor(recs.length / 2); const found = []; let dP = false, dM = false;
    for (let t = 0; t < recs.length; t++) {
      const plus = (t & 1) === 0, idx = mid + (plus ? 1 : -1) * Math.floor((t + 1) / 2);
      if (idx < 0 || idx >= recs.length) { if (plus) dP = true; else dM = true; if (dP && dM) break; continue; }
      if (plus ? dP : dM) { if (dP && dM) break; continue; }
      const r = recs[idx]; if (r.cov) { found.push(r); found.sort(cmp); }
      if (found.length >= K && r.D > found[K - 1].D) { if (plus) dP = true; else dM = true; }
    }
    if (found[0] !== truth[0]) { wrong++; gapMax = Math.max(gapMax, found[0].D - truth[0].D); }
  }
  return { px, wrong, gapMax };
}
for (const [name, steps, shape, sing] of [
  ['e^{1/z} on |z|<1', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 1 }, [C(0, 0)]],
  ['exp(Cayley) on |z+i|<1.5', [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'exp' }], { kind: 'disc', c: [0, -1], r: 1.5 }, [C(0, -1)]]]) {
  let worst = { frac: 0 }, tot = 0, totW = 0, gmax = 0;
  for (let t = 0; t < 40; t++) {
    const s = 60 * Math.pow(50, rnd()), cx = (rnd() * 2 - 1) * 0.8, cy = (rnd() * 2 - 1) * 0.8 + (sing[0].im);
    const win = { x0: cx - 205 / s, x1: cx + 205 / s, y0: cy - 258 / s, y1: cy + 258 / s };
    const r = trial(steps, shape, sing, win, { cx: 0, cy: 0, s: 40 }, 1);
    tot += r.px; totW += r.wrong; gmax = Math.max(gmax, r.gapMax);
    if (r.wrong / r.px > worst.frac) worst = { frac: r.wrong / r.px, cx, cy, s, gap: r.gapMax };
  }
  console.log(`${name}: 40 random left views: wrong front sheet ${totW}/${tot} px (${(100 * totW / tot).toFixed(2)} %), max D gap ${gmax.toFixed(3)} octaves; worst view ${JSON.stringify(worst)}`);
}
