'use strict';
// Lead check: what the sphere-native mesher costs on the scenes the PERF suite gates (alpha 0.85 -> K = 3, checker
// pattern) and on the examples that would move to the sphere path. CPU ms = median of 3 after a warm-up.
//   node notes/proto/lead/perf_scenes.js [--mesher=sphere-native|lead] [filter...]
const path = require('path');
const args = process.argv.slice(2);
const which = (args.find((a) => a.startsWith('--mesher=')) || '--mesher=lead').slice(9);
const files = args.filter((a) => !a.startsWith('--'));
const { Mesher } = require(which === 'lead' ? './sphm_lead.js' : '../sphere-native/sphm.js');
const Region = require('../../../src/region.js');
const { C } = CX;
const PI = Math.PI;
const W = 410, H = 516;
const step = (type, params = {}) => { const b = Funcs.build({ type, params: Object.assign(Funcs.defaults(type), params) }); if (b.error) throw new Error(b.error); return b; };
const chainOf = (...bs) => ({ F: (z) => { for (const b of bs) z = b.f(z); return z; }, steps: bs });
const Hp = { kind: 'halfplane', a: [0, 0], b: [1, 0] };

function fit(F, shape, left) {   // a robust box of the image of the left window's part of the shape (like fitRight)
  const L = Region.levelOf(shape), xs = [], ys = [];
  const hw = W / 2 / left.s, hh = H / 2 / left.s;
  for (let i = 0; i < 80; i++) for (let j = 0; j < 80; j++) {
    const z = C(left.cx - hw + 2 * hw * (i + 0.5) / 80, left.cy - hh + 2 * hh * (j + 0.5) / 80);
    if (!(L(z) > 0)) continue;
    const w = F(z); if (!CX.isFin(w)) continue; xs.push(w.re); ys.push(w.im);
  }
  xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
  const q = (a, p) => a[Math.floor(p * (a.length - 1))];
  const x0 = q(xs, 0.03), x1 = q(xs, 0.97), y0 = q(ys, 0.03), y1 = q(ys, 0.97);
  const s = 0.86 * Math.min(W / (x1 - x0), H / (y1 - y0));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s };
}
const SC = [
  { name: 'perf.default', shape: { kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, ch: chainOf(step('exp'), step('mobius', { a: '1', b: '-1', c: '1', d: '1' })), left: { cx: 0, cy: 0, s: 52 }, view: { cx: 0, cy: 0, s: 170 }, cell: 1 },
  { name: 'perf.logUHP', shape: Hp, ch: chainOf(step('log', { cut: 180, k: 0 })), left: { cx: 0, cy: 0.5, s: 60 }, view: { cx: -0.18, cy: PI / 2, s: 97 }, cell: 1 },
  { name: 'perf.chain4', shape: { kind: 'disc', c: [0.3, 0.2], r: 1.2 }, ch: chainOf(step('add', { c: '0.3+0.2i' }), step('pown', { n: 2 }), step('mobius', { a: '1', b: '-i', c: '1', d: 'i' }), step('log', { cut: 180, k: 0 })), left: { cx: 0, cy: 0, s: 70 }, view: null, cell: 0.2 },
  { name: 'ex2.quadrant_sq', shape: { kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, ch: chainOf(step('pown', { n: 2 })), left: { cx: 0.6, cy: 0.6, s: 70 }, view: { cx: 0, cy: 2, s: 60 }, cell: 1 },
  { name: 'ex3.joukowski', shape: { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }, ch: chainOf(step('joukowski')), left: { cx: 0, cy: 0, s: 70 }, view: { cx: 0, cy: 0, s: 117 }, cell: 1 },
  { name: 'ex6.sin_halfstrip', shape: { kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, ch: chainOf(step('sin')), left: { cx: 0, cy: 1.25, s: 105 }, view: { cx: 0, cy: 2, s: 50 }, cell: 0.5 },
  { name: 'ex7.sqrt_disc', shape: { kind: 'disc', c: [0, 0], r: 2 }, ch: chainOf(step('root', { n: 2, cut: 180, k: 0 })), left: { cx: 0, cy: 0, s: 70 }, view: { cx: 0.7, cy: 0, s: 150 }, cell: 0.5 },
  { name: 'ex8.cayley_cube', shape: Hp, ch: chainOf(step('mobius', { a: '1', b: '-i', c: '1', d: 'i' }), step('pown', { n: 3 })), left: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 190 }, cell: 1 },
  { name: 'gold.annulus_log', shape: { kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, ch: chainOf(step('log', { cut: 180, k: 0 })), left: { cx: 0, cy: 0, s: 70 }, view: { cx: 0, cy: 0, s: 72 }, cell: 0.5 },
  { name: 'gold.disc_cube', shape: { kind: 'disc', c: [0.6, 0.3], r: 0.8 }, ch: chainOf(step('pown', { n: 3 })), left: { cx: 0.4, cy: 0.2, s: 120 }, view: { cx: 0.15, cy: 1, s: 74.5 }, cell: 0.2 },
  { name: 'acc.sqrt_slit', shape: { kind: 'formula', expr: '|z|>0' }, ch: chainOf(step('root', { n: 2, cut: 180, k: 0 })), left: { cx: 0, cy: 0, s: 70 }, view: { cx: 1, cy: 0, s: 120 }, cell: 1, pattern: 'solid', alpha: 1 },
  { name: 'acc.zi_H', shape: Hp, ch: chainOf(step('powa', { alpha: 'i', cut: 180, k: 0 })), left: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 190 }, cell: 1, pattern: 'polar', alpha: 1 },
  { name: 'acc.zi_H_a085', shape: Hp, ch: chainOf(step('powa', { alpha: 'i', cut: 180, k: 0 })), left: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 190 }, cell: 1, pattern: 'polar' },
  { name: 'acc.expH', shape: Hp, ch: chainOf(step('exp')), left: { cx: 0, cy: 1, s: 60 }, view: { cx: 0, cy: 0, s: 30 }, cell: 1, pattern: 'solid', alpha: 1 },
  { name: 'acc.e1z_disc', shape: { kind: 'disc', c: [0, 0], r: 1 }, ch: chainOf(step('recip'), step('exp')), left: { cx: 0, cy: 0, s: 120 }, view: { cx: 0, cy: 0, s: 60 }, cell: 1, pattern: 'solid', alpha: 1 },
];
const sel = SC.filter((c) => !files.length || files.some((f) => c.name.includes(f)));
const opts = {};
for (const a of args) { const m = /^--(\w+)=(.*)$/.exec(a); if (m && m[1] !== 'mesher') opts[m[1]] = isNaN(+m[2]) ? m[2] : +m[2]; }
const passOpts = Object.assign({}, opts); delete passOpts.inj; delete passOpts.sw;
function run(cs) {
  const left = Object.assign({ W, H }, cs.left);
  const view = Object.assign({ kind: 'flat', W, H }, cs.view || fit(cs.ch.F, cs.shape, left));
  const inj = opts.inj === 0 ? false : Funcs.composeProps(cs.ch.steps.map((b) => b.props)).injective;
  const M = Mesher(Object.assign({ F: cs.ch.F, steps: opts.sw === 0 ? null : cs.ch.steps, injective: inj, shape: cs.shape, left, view, pattern: cs.pattern || 'checker', cell: cs.cell, alpha: cs.alpha ?? 0.85 }, passOpts));
  const st = M.run(20000);
  return { st, M, view };
}
run(sel[0]);
for (const cs of sel) {
  const ms = [];
  let last;
  for (let k = 0; k < 3; k++) { last = run(cs); ms.push(last.st.ms); }
  if (opts.counts) console.log(JSON.stringify(last.st.counts), JSON.stringify(last.M.summary().leaves));
  ms.sort((a, b) => a - b);
  const s = last.M.summary(), c = last.st.counts;
  console.log(`${cs.name.padEnd(20)} ${ms[1].toFixed(1).padStart(7)} ms  nodes ${String(s.nodes).padStart(7)} evals ${String(s.evals).padStart(7)} tris ${String(last.M.output().length).padStart(6)} sprobe ${s.stepProbes || 0}  sat ${c.sat} gsat ${c.globalSat} gap ${c.gap} cut ${c.cutClip || 0} view ${JSON.stringify(last.view).replace(/"kind":"flat",|"W":410,"H":516,?/g, '')}${last.st.budgetHit ? ' BUDGET' : ''}`);
}
