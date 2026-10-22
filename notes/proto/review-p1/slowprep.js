'use strict';
// prepare() cost: imageBox has no evaluation cap (SPEC 3.8: <= 4,096 evaluations of G per shape)
const L = require('./lib.js');
const { Inverse } = L;
const T = (t, p) => ({ type: t, params: p });
const cases = [
  ['exp∘exp, disc |z-(2+1i)|<1.5', [T('exp'), T('exp')], { kind: 'disc', c: [2, 1], r: 1.5 }],
  ['e^{sin z}, rect [-74.7,-70.9]x[8.6,11.4]', [T('custom', { expr: '\\exp(\\sin z)' })], { kind: 'rect', a: [-74.73008650109642, 11.436176072543574], b: [-70.90558154412265, 8.646771965728874] }],
  ['tan(z^3), disc at 38.6+48.1i r 0.071', [T('pown', { n: 3 }), T('tan')], { kind: 'disc', c: [38.558224653153786, 48.08174555566242], r: 0.07101528231938994 }],
  ['sinh(z^2+4) -> blaschke, |z|<28.5', [T('poly', { co: '1, 0, 4' }), T('sinh'), T('blaschke', { a: '-0.561649-0.436241i', phi: -102 })], { kind: 'formula', expr: '|z|<28.542' }],
  ['cos(cosh-ish) [IJOUK,COSH,EXP] rect', [T('ijouk'), T('cosh'), T('exp')], { kind: 'rect', a: [5.570733782635415, 27.32268475337078], b: [4.446218338643014, 27.83884941271788] }],
  ['[cosh, z^{0.3+i}, tan] disc', [T('cosh'), T('powa', { alpha: '0.3+i', cut: -400, k: 2 }), T('tan')], { kind: 'disc', c: [-30.690736570717178, -19.209544043619914], r: 0.24817679990892894 }],
];
for (const [name, list, shape] of cases) {
  const ch = L.chain(list);
  const t0 = Date.now();
  const p = Inverse.prepare(ch.plan, { win: L.WIN0, shape });
  const ms = Date.now() - t0;
  const ev = p.rspec.map((s) => (s && s.evals) || 0).reduce((a, b) => a + b, 0);
  console.log(`${name.padEnd(42)} ${String(ms).padStart(5)} ms, G evaluations in imageBox ${ev}, ok=${p.ok}${p.reason ? ' (' + p.reason + ')' : ''}`);
}
