// node test/t_ux165_chain.js : the logic of the v16.5 wave-1 chain piece (notes/ux-build/w1-chain-AS-BUILT.md) that
// runs without a page, read from src/app.js as it is: UX23's formula repairs (formulaFixes, editDist) and UX79's
// "what one undo step did" (histWhat, from two history snapshots). The page-level behaviour is test/ux165_chain_cmd.js.
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
global.Region = require('../src/region.js');
const APP = require('./src_text').appText();   // (src/app/*.js joined, as build.py does)
let n = 0, fails = 0;
const ok = (c, msg, got) => { n++; if (!c) { fails++; console.log('FAIL', msg, got === undefined ? '' : JSON.stringify(got)); } };
// one top-level function (or const) of app.js, from its first line to the line that closes it at the same indent
function cut(startRe, endLine) {
  const m = startRe.exec(APP);
  if (!m) throw new Error('not found: ' + startRe);
  const end = APP.indexOf(endLine, m.index);
  if (end < 0) throw new Error('no end for ' + startRe);
  return APP.slice(m.index, end + endLine.length);
}
const src = [
  cut(/^ {2}const FIX_FN = /m, '];\n'),
  cut(/^ {2}function editDist\(/m, '\n  }\n'),
  cut(/^ {2}function formulaFixes\(/m, '\n  }\n'),
  cut(/^ {2}function histWhat\(/m, "    return '';\n  }\n"),
].join('\n');
const fill = (s, o) => String(s).replace(/\{(\w+)\}/g, (m, k) => (o && k in o ? o[k] : m));
const SUB = '₀₁₂₃₄₅₆₇₈₉';
let NAMES = new Map();
const ctx = vm.createContext({
  Expr, Funcs, Region, JSON, Map, Set, Array, String, Object, Math,
  $t: (s, o) => fill(s, o), $tn: (one, many, k, o) => fill(k === 1 ? one : many, o),
  sub: (k) => String(k).split('').map((d) => SUB[+d] ?? d).join(''),
  defOf: (st) => Funcs.DEFS[st.type] || { label: String(st.type), params: [] },
  shapeNames: () => NAMES,
  Params: { display: (x) => x },
});
const F = vm.runInContext(src + '\n({ editDist, formulaFixes, histWhat })', ctx);

// ---- UX23: the repairs ----
ok(F.editDist('sin', 'sin') === 0 && F.editDist('sinn', 'sin') === 1 && F.editDist('', 'cos') === 3 && F.editDist('sun', 'sin') === 1, 'editDist: edits');
ok(F.editDist('sni', 'sin') === 1 && F.editDist('ocs', 'cos') === 1 && F.editDist('xepz', 'exp') === 2, 'editDist: two swapped letters are one slip');
const fx = (q) => F.formulaFixes(q).map((x) => x.t);
ok(fx('sin(z').includes('sin(z)'), 'close the bracket: sin(z -> sin(z)', F.formulaFixes('sin(z'));
ok(/^Close the bracket: sin\(z\)$/.test((F.formulaFixes('sin(z')[0] || {}).label), 'the row says what it does', F.formulaFixes('sin(z'));
ok(fx('cos z +').includes('cos z'), 'drop a trailing operator: cos z + -> cos z', F.formulaFixes('cos z +'));
ok(/^Drop the trailing \+: cos z$/.test((F.formulaFixes('cos z +')[0] || {}).label), 'drop row label', F.formulaFixes('cos z +'));
ok(fx('z^^2').includes('z^2'), 'one operator for a doubled one: z^^2 -> z^2', F.formulaFixes('z^^2'));
ok(fx('sni z').includes('sin z'), 'nearest function name: sni z -> sin z', F.formulaFixes('sni z'));
ok(fx('coss(z)').includes('cos(z)') || fx('coss(z)').includes('cosh(z)'), 'nearest function name: coss(z)', F.formulaFixes('coss(z)'));
ok(fx('ezp(z)').includes('exp(z)'), 'nearest function name: ezp(z) -> exp(z)', F.formulaFixes('ezp(z)'));
ok(F.formulaFixes('sin z').length === 0, 'a formula that parses gets no repair', F.formulaFixes('sin z'));
ok(F.formulaFixes('qqqqqq(z').every((x) => { try { Expr.parse(x.t, { allowRel: true }); return true; } catch (e) { return false; } }), 'every repair offered parses', F.formulaFixes('qqqqqq(z'));
ok(F.formulaFixes('((z+').length <= 3, 'at most three repairs');
ok(fx('|z-1| < (2').includes('|z-1| < (2)'), 'a set is repaired too: |z-1| < (2', F.formulaFixes('|z-1| < (2'));
ok(!fx('w^2(').length || fx('w^2(').every((t) => !/w/.test(t)), 'a repair never reads another variable than z', F.formulaFixes('w^2('));

// ---- UX79: what an undo step did ----
const snap = (o) => ({ s: JSON.stringify(Object.assign({ steps: [], params: [], shapes: [], targets: [] }, o)) });
const E = { type: 'exp', params: {}, on: true }, SIN = { type: 'sin', params: {}, on: true }, M = { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true };
const lbl = (t) => Funcs.DEFS[t].label;
const hw = (a, b) => F.histWhat(snap(a), snap(b));
ok(hw({ steps: [E] }, { steps: [E, SIN] }) === `add f₂ ${lbl('sin')}`, 'add a step at the end', hw({ steps: [E] }, { steps: [E, SIN] }));
ok(hw({ steps: [E, M] }, { steps: [SIN, E, M] }) === `add f₁ ${lbl('sin')}`, 'add a step in front', hw({ steps: [E, M] }, { steps: [SIN, E, M] }));
ok(hw({ steps: [E, SIN] }, { steps: [E] }) === `remove f₂ ${lbl('sin')}`, 'remove a step', hw({ steps: [E, SIN] }, { steps: [E] }));
ok(hw({ steps: [E] }, { steps: [E, SIN, M] }) === 'add f₂–f₃', 'add two steps', hw({ steps: [E] }, { steps: [E, SIN, M] }));
ok(hw({ steps: [E, SIN, M] }, { steps: [E] }) === 'remove 2 steps', 'remove two steps', hw({ steps: [E, SIN, M] }, { steps: [E] }));
ok(hw({ steps: [E, SIN] }, { steps: [SIN, E] }) === 'reorder the steps', 'reorder', hw({ steps: [E, SIN] }, { steps: [SIN, E] }));
ok(hw({ steps: [E, SIN] }, { steps: [E, M] }) === `replace f₂ with ${lbl('mobius')}`, 'replace', hw({ steps: [E, SIN] }, { steps: [E, M] }));
ok(hw({ steps: [E] }, { steps: [Object.assign({}, E, { on: false })] }) === 'bypass f₁', 'bypass');
ok(hw({ steps: [Object.assign({}, E, { on: false })] }, { steps: [E] }) === 'turn f₁ back on', 'turn back on');
const ZP = (z, p) => ({ type: 'zp', params: { zeros: z, poles: p, k: '1' }, on: true });
ok(hw({ steps: [ZP('1', '-1')] }, { steps: [ZP('1', '-1, 2')] }) === 'add pole p₂ of f₁', 'add a pole', hw({ steps: [ZP('1', '-1')] }, { steps: [ZP('1', '-1, 2')] }));
ok(hw({ steps: [ZP('1', '-1')] }, { steps: [ZP('1, i', '-1')] }) === 'add zero ζ₂ of f₁', 'add a zero', hw({ steps: [ZP('1', '-1')] }, { steps: [ZP('1, i', '-1')] }));
ok(hw({ steps: [ZP('1, i', '-1')] }, { steps: [ZP('1', '-1')] }) === 'remove a zero of f₁', 'remove a zero');
ok(hw({ steps: [ZP('1', '-1')] }, { steps: [ZP('2', '-1')] }) === 'move a zero of f₁', 'move a zero');
ok(hw({ steps: [ZP('1', '-1')] }, { steps: [ZP('1', '-2')] }) === 'move a pole of f₁', 'move a pole');
ok(hw({ steps: [M] }, { steps: [Object.assign({}, M, { params: Object.assign({}, M.params, { a: '2' }) })] }) === `change f₁ ${lbl('mobius')}`, 'edit a step\'s field');
ok(hw({ params: [] }, { params: [{ name: 'a', value: 1 }] }) === 'add the number a', 'add a number');
ok(hw({ params: [{ name: 'a', value: 1 }] }, { params: [] }) === 'delete the number a', 'delete a number');
ok(hw({ params: [{ name: 'a', value: 1 }] }, { params: [{ name: 'a', value: 2 }] }) === 'change a', 'change a number');
NAMES = new Map([['s1', 'Disc 1'], ['s2', 'Line 1']]);
const D1 = { id: 's1', kind: 'disc', c: [0, 0], r: 1 }, L1 = { id: 's2', kind: 'line', a: [0, 0], b: [1, 0] };
ok(hw({ shapes: [] }, { shapes: [D1] }) === 'add Disc 1', 'add a shape', hw({ shapes: [] }, { shapes: [D1] }));
ok(hw({ shapes: [D1, L1] }, { shapes: [D1] }) === 'delete Line 1', 'delete a shape');
ok(hw({ shapes: [D1] }, { shapes: [Object.assign({}, D1, { r: 2 })] }) === 'edit Disc 1', 'edit a shape');
ok(hw({ shapes: [] }, { shapes: [D1, L1] }) === 'add 2 shapes', 'add two shapes');
ok(hw({ steps: [E] }, { steps: [E] }) === '', 'nothing to say: empty');
ok(F.histWhat(null, snap({})) === '' && F.histWhat({ s: '{' }, snap({})) === '', 'a missing or broken snapshot: empty');

console.log(`t_ux165_chain: ${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
