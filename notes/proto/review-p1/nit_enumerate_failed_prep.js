'use strict';
// NIT: Inverse.enumerate on a Prep with ok = false (here N = [4, Infinity]) never terminates without opts.full.
const L = require('./lib.js');
const { Inverse, C } = L;
const ch = L.chain([{ type: 'sin' }, { type: 'powa', params: { alpha: '0.5i' } }]);
const shape = { kind: 'disc', c: [0.3, 0], r: 0.6 };
const push0 = Array.prototype.push;
Array.prototype.push = function (...a) { if (this.length > 2e6) { push0.call(this, ...a); throw new Error('array grew past 2e6 elements'); } return push0.apply(this, a); };
let t0 = Date.now();
const prep = Inverse.prepare(ch.plan, { win: L.WIN0, shape });
console.log('prepare', Date.now() - t0, 'ms ok', prep.ok, prep.reason, 'N', prep.N, 'need', prep.need, 'rspec', JSON.stringify(prep.rspec.map((s) => s && { kind: s.kind, lo: s.lo, hi: s.hi, farCover: s.farCover })), 'stopOp', prep.stopOp, 'sing', prep.sing.map(L.fmt));
const z = C(0.01, 0.02), w = ch.F(z);
console.log('z', L.fmt(z), 'w', L.fmt(w));
t0 = Date.now();
try { const r = Inverse.enumerate(ch.plan, prep, w, 1e-4, { K: 16, B: 16 }); console.log('enumerate', Date.now() - t0, 'ms visited', r.visited, 'U', r.U); }
catch (e) { console.log('enumerate threw after', Date.now() - t0, 'ms:', e.message, e.stack.split('\n').slice(1, 4).join(' | ')); }
