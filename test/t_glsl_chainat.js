'use strict';
// The map modes' walk of the chain (GLChain.build's chainAt): a step in full, or on its path at t = 1, is its map
// (_f); a path with the t = 1 shortcut is otherwise taken without it (_hr, the path's own body); no step's path is
// called at a constant t = 1.0 (LLVM 21, in Mesa 26's llvmpipe, compiled the walk with a root's path at 1.0 before
// sin's path at t to NaN on AMD Zen 4/5 machines, #1735). A straight-line path (no shortcut) calls the map in full.
// The map and the path are each written once in chainAt (FXC inlines every call). Run: node test/t_glsl_chainat.js
const vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
const { source } = require('./src_text');
const NAMES = { cx: 'CX', symbolic: 'Symbolic', parse: 'Expr', derivs: 'Derivs', natpaths: 'NatPaths', sheets: 'Sheets', formulasteps: 'FormulaSteps', funcs: 'Funcs', invops: 'InvOps', invpatterns: 'InvPatterns', inverse: 'Inverse', recognize: 'Recognize', calc: 'Calc', glslroots: 'GLRoots', glsl: 'GLChain' };
for (const f of Object.keys(NAMES)) vm.runInContext(source(f + '.js', path.join(root, 'src'), { esm: 'strip' }) + `\n;globalThis.${NAMES[f]} = ${NAMES[f]};`, ctx, { filename: f + '.js' });
const { Funcs, GLChain } = ctx;
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got) : '')); } };

const S = (type, params = {}) => ({ type, params, on: true });
const fnBody = (src, name) => { const i = src.indexOf(`vec2 ${name}(`); if (i < 0) return null; const j = src.indexOf('\n}\n', i); return src.slice(i, j + 2); };
const CHAINS = {
  'sin∘√ (the Zen 4/5 case)': [S('root', { n: 2 }), S('sin')],
  'sin∘∛, cut -90': [S('root', { n: 3, cut: -90 }), S('sin')],
  'exp, Möbius, z²': [S('exp'), S('mobius', { a: '1', b: '-1', c: '1', d: '1' }), S('pown', { n: 2 })],
  'a formula (straight-line path) then cos': [S('custom', { expr: 'z^2+1' }), S('cos')],
};
for (const [name, steps] of Object.entries(CHAINS)) {
  const gc = GLChain.build(steps, steps.map((x) => Funcs.build(x)));
  const src = gc.source, at = fnBody(src, 'chainAt');
  ok(`${name}: chainAt is generated`, !!at, src.slice(0, 200));
  if (!at) continue;
  ok(`${name}: no step's path at a constant t = 1.0 for a step with the shortcut`, ![...at.matchAll(/(\w+)_h\(z, how == 1 \? 1\.0 : t\)/g)].some((m) => fnBody(src, m[1] + '_h').includes('if (t == 1.0)')), at);
  for (let k = 1; k <= steps.length; k++) {
    const line = (at.split('\n').find((l) => l.includes(`if (k == ${k})`)) || '');
    const P = (/(\w+)_(?:f|h|hr)\(/.exec(line) || [])[1];
    if (!P) { ok(`${name}: step ${k} has its line in chainAt`, false, at); continue; }
    const h = fnBody(src, P + '_h') || '', hr = fnBody(src, P + '_hr');
    if (h.includes('if (t == 1.0)')) {
      ok(`${name}: step ${k} (a path with the t = 1 shortcut): in full or at t = 1 its map, else its path without the shortcut`, line.includes(`how == 1 || t == 1.0 ? ${P}_f(z) : ${P}_hr(z, t)`), line);
      ok(`${name}: step ${k}: ${P}_hr is the path's body without the shortcut`, !!hr && !hr.includes('if (t == 1.0)') && hr.replace(`${P}_hr`, '') === h.replace(`${P}_h`, '').replace(/\n {2}if \(t == 1\.0\) return \w+_f\(z\);/, ''), { h, hr });
    }
    // (each of the map and the path once in the step's line: FXC inlines both)
    ok(`${name}: step ${k}: its map and its path appear at most once each in chainAt`, (line.match(new RegExp(`${P}_f\\(`, 'g')) || []).length <= 1 && (line.match(new RegExp(`${P}_hr?\\(`, 'g')) || []).length <= 1, line);
  }
}

// A Repeat block's step (repPlan) handles t = 1 in its own path (t >= 1 is its map), so it takes no shortcut and no
// _hr copy: its loop, whose trip count is a uniform, is written twice in the program (its map and its path), not three
// times. A third copy made Metal's compiler run the loop wrong (#1911: 'repeat mobius x4' off by 10^3-10^4 on macOS)
{
  const steps = [S('affine', { a: '0.5', b: '0' }), Object.assign(S('mobius', { a: '1', b: '0.3', c: '-0.3', d: '1' }), { repeat: { n: 4, len: 1 } })];
  const gc = GLChain.build(steps, Funcs.applyRepeats(steps, steps.map((x) => Funcs.build(x))));
  const src = gc.source, at = fnBody(src, 'chainAt') || '', h = fnBody(src, 'cxs2_h') || '';
  ok('a repeated step: no _hr copy of its path', !fnBody(src, 'cxs2_hr'), src.slice(src.indexOf('vec2 cxs2_f'), src.indexOf('vec2 chainStep')));
  ok('a repeated step: its path takes no t = 1 shortcut (its own body handles t >= 1)', !h.includes('if (t == 1.0)'), h);
  ok('a repeated step: its uniform-bounded loop is written twice (its map and its path)', (src.match(/for \(int k = 0; k < int\(uChain\[\d+\]\.x\); k\+\+\)/g) || []).length === 2, (src.match(/for \(int k = 0; k < int\(uChain\[\d+\]\.x\); k\+\+\)/g) || []).length);
  ok('a repeated step: in chainAt, its path (at 1.0 in full, which the path answers with its map)', at.includes('if (k == 2) return cxs2_h(z, how == 1 ? 1.0 : t);'), at);
}

console.log(`t_glsl_chainat: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
