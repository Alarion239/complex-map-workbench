'use strict';
// [sinh, tanh, exp] of a half-plane: Inverse.prepare runs out of memory (found by sc_fuzz.js seed 2)
const L = require('./lib.js');
const { Inverse } = L;
const ch = L.chain([{ type: 'sinh' }, { type: 'tanh' }, { type: 'exp' }]);
const shape = { kind: 'halfplane', a: [-61.19755066987013, 52.765891492723426], b: [-61.56234194373471, 51.834802170202614] };
const win = { x0: 81.05743554753285, x1: 87.89076888086619, y0: 52.70746595720176, y1: 61.30746595720176 };
const push0 = Array.prototype.push;
Array.prototype.push = function (...a) { if (this.length > 2e6) { push0.call(this, ...a); throw new Error('array grew past 2e6 elements'); } return push0.apply(this, a); };
const t0 = Date.now();
try { const p = Inverse.prepare(ch.plan, { win, shape }); console.log('ok', p.ok, p.reason, Date.now() - t0, 'ms'); }
catch (e) { console.log(e.stack.split('\n').slice(0, 8).join('\n')); }
