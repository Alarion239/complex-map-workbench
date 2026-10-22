'use strict';
// renderCPU list-order compositing: render each shape alone over black (= premultiplied colour), composite them
// myself with "over" in list order, compare with renderCPU of the list over the plane colour.
const L = require('./lib.js');
const { Inverse } = L;
const ch = L.chain([{ type: 'powa', params: { alpha: 'i' } }]);
const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const D = { kind: 'disc', c: [0.4, 0.6], r: 0.5 };
const view = { cx: 0, cy: 0, s: 190, W: 120, H: 120, win: L.WIN0 };
for (const [la, lb] of [[{ alpha: 0.85, pattern: 'polar', color: '#3B6FD4' }, { alpha: 0.85, pattern: 'checker', color: '#D4553B', color2: '#E5A08C' }], [{ alpha: 0.2 }, { alpha: 0.5, color: '#22AA44' }]]) {
  const plane = '#FCFDFD';
  const both = Inverse.renderCPU(ch.plan, [D, H], view, [Object.assign({ plane }, la), Object.assign({ plane }, lb)]);
  const a = Inverse.renderCPU(ch.plan, [D], view, [Object.assign({}, la, { plane: '#000000' })]);
  const b = Inverse.renderCPU(ch.plan, [H], view, [Object.assign({}, lb, { plane: '#000000' })]);
  const P = [0xFC, 0xFD, 0xFD].map((x) => x / 255);
  let worst = 0, n = 0;
  for (let k = 0; k < view.W * view.H; k++) {
    const a1 = a.stats.alpha[k], a2 = b.stats.alpha[k], A = a2 + (1 - a2) * a1;
    for (let c = 0; c < 3; c++) {
      const C = b.rgba[4 * k + c] / 255 + (1 - a2) * (a.rgba[4 * k + c] / 255);
      const exp = 255 * (C + (1 - A) * P[c]);
      worst = Math.max(worst, Math.abs(exp - both.rgba[4 * k + c]));
    }
    n++;
  }
  console.log(`alpha ${la.alpha}/${lb.alpha}: ${n} px, worst channel difference vs my list-order composite ${worst.toFixed(2)}/255`);
}
