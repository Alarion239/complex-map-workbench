'use strict';
// Inverse.singular: caps (<= cap per kind), timing, expected sets.
const L = require('./lib.js');
const { Inverse, chain, fmt, WIN0 } = L;
const cay = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } };
const T = (t, p) => ({ type: t, params: p });
const cases = {
  'e^{1/z} undef': [[T('recip'), T('exp')], ['undef']],
  'z^i undef': [[T('powa', { alpha: 'i' })], ['undef']],
  'log(z-1) branch': [[T('custom', { expr: '\\log(z-1)' })], ['branch']],
  'Cayley pole': [[cay], ['pole']],
  'exp∘Cayley undef': [[cay, T('exp')], ['undef']],
  'exp all': [[T('exp')], ['undef', 'branch', 'pole']],
  'sin all': [[T('sin')], ['undef', 'branch', 'pole']],
  'tan pole': [[T('tan')], ['pole']],
  'tan(1/z) all': [[T('recip'), T('tan')], ['undef', 'branch', 'pole']],
  'tan(tan z) all': [[T('tan'), T('tan')], ['undef', 'branch', 'pole']],
  'tan(e^z) all': [[T('exp'), T('tan')], ['undef', 'branch', 'pole']],
  'tan^4 all': [[T('tan'), T('tan'), T('tan'), T('tan')], ['undef', 'branch', 'pole']],
  'tan^8 all': [Array(8).fill(T('tan')), ['undef', 'branch', 'pole']],
  'tan^16 all': [Array(16).fill(T('tan')), ['undef', 'branch', 'pole']],
  'tanh/tan x8 all': [Array(8).fill(0).flatMap(() => [T('tanh'), T('tan')]), ['undef', 'branch', 'pole']],
  'sin^16 all': [Array(16).fill(T('sin')), ['undef', 'branch', 'pole']],
  '(tan,recip)x8 all': [Array(8).fill(0).flatMap(() => [T('tan'), T('recip')]), ['undef', 'branch', 'pole']],
  '(tan, z^i)x5 all': [Array(5).fill(0).flatMap(() => [T('tan'), T('powa', { alpha: 'i' })]), ['undef', 'branch', 'pole']],
};
for (const [name, [list, kinds]] of Object.entries(cases)) {
  const ch = chain(list);
  if (!ch.plan.ok) { console.log(name, 'ineligible', ch.plan.reason); continue; }
  let res, best = Infinity;
  for (let rep = 0; rep < 5; rep++) { const t0 = process.hrtime.bigint(); res = Inverse.singular(ch.plan, WIN0, kinds, 16); best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6); }
  const per = {};
  for (const e of res) per[e.kind] = (per[e.kind] || 0) + 1;
  const over = Object.values(per).some((c) => c > 16);
  const show = res.length <= 6 ? res.map((e) => `${e.kind}:${fmt(e.z)}`).join(', ') : '';
  console.log(`${name.padEnd(20)} ${ch.plan.ops.length} ops  ${best.toFixed(2)} ms  per kind ${JSON.stringify(per)}${over ? '  OVER CAP' : ''}${best > 2 ? '  > 2 ms' : ''}  ${show}`);
}
