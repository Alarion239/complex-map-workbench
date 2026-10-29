// test/glsl_tiers.js, the GLSL test pages' tiers and parts: the hash is stable (fixed values), a chain's part depends
// on its name only (adding chains moves none), the tiers follow the rules (hand-written chains core, an eighth of each
// random family core, SLOW deep), ?legacy=1 keeps the old index parts and every chain, and the adv page's core
// sections. Node, no browser. Run: node test/t_glsl_tiers.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = fs.readFileSync(path.join(__dirname, 'glsl_tiers.js'), 'utf8');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got).slice(0, 400) : '')); } };
const load = (search = '') => { const ctx = { window: {}, location: { search }, URLSearchParams }; vm.runInNewContext(SRC, ctx); return ctx.window.GLSLTiers; };

const T = load();
// FNV-1a 32: fixed values (a change here would move every chain to another part)
ok('hash of "" is the FNV offset basis', T.hashName('') === 0x811c9dc5);
ok('hash of "a"', T.hashName('a') === 0xe40c292c, T.hashName('a').toString(16));
ok('hash of "default exp"', T.hashName('default exp') === T.hashName('default exp') && T.hashName('default exp') !== T.hashName('default exq'));
ok('hash of a name with non-ASCII characters is stable', T.hashName('series Σ zⁿ/n!') === load().hashName('series Σ zⁿ/n!'));
// parts by name: adding chains moves none
const names = Array.from({ length: 400 }, (_, i) => `multi#${i} exp>sin`);
const before = names.map((n) => T.partOf(n, 8)), after = ['new chain', ...names].slice(1).map((n) => T.partOf(n, 8));
ok('a chain\'s part depends on its name only', before.every((p, i) => p === after[i]));
const counts = [0, 0, 0, 0, 0, 0, 0, 0];
for (const p of before) counts[p]++;
ok('the parts are balanced (400 chains in 8: each 30-70)', counts.every((c) => c >= 30 && c <= 70), counts);
// tiers
ok('hand-written chains are core', ['default exp', 'nat joukowski > cos > rational', 'special zeta', 'series step Laurent', 'recurrence u^2+z from 0', 'repeat z^2+c x3', 'err custom parse', 'sheets log', 'z^3 d d'].every((n) => T.tierOf('glsl', n) === 'core'));
const fam = (p) => Array.from({ length: 800 }, (_, i) => `${p}${i} x`);
for (const p of ['rand ', 'multi#', 'dmulti#', 'cut ', 'sheet ']) {
  const core = fam(p).filter((n) => T.tierOf('glsl', n) === 'core').length;
  ok(`glsl random family "${p}": about an eighth core (${core} of 800)`, core >= 70 && core <= 130, core);
}
const inv = fam('rand#').filter((n) => T.tierOf('inverse', n) === 'core').length;
ok(`inverse random family: about an eighth core (${inv} of 800)`, inv >= 70 && inv <= 130, inv);
ok('every adv chain is core', fam('multi#').every((n) => T.tierOf('adv', n) === 'core'));
ok('the tier of a name never changes', T.tierOf('glsl', 'multi#17 exp>sin') === load('?tier=core').tierOf('glsl', 'multi#17 exp>sin'));
// keep: tier and part
const C = load('?tier=core&parts=4&part=2');
ok('core part 3/4 keeps a core chain of part 2 only', C.keep('glsl', 'default exp', 0) === (T.partOf('default exp', 4) === 2));
const D = load('?tier=deep');
const deepName = fam('multi#').find((n) => T.tierOf('glsl', n) === 'deep');
ok('deep keeps a deep chain and not a core one', D.keep('glsl', deepName, 5) && !D.keep('glsl', 'default exp', 0));
ok('all keeps every chain (one part)', fam('rand ').every((n, i) => T.keep('glsl', n, i)));
ok('an unknown tier is all', load('?tier=fast').TIER === 'all');
// legacy: index parts, every chain, every section
const L = load('?legacy=1&parts=8&part=3&tier=core');
ok('legacy: by index', L.keep('glsl', 'whatever', 3) && L.keep('glsl', 'whatever', 11) && !L.keep('glsl', 'whatever', 4));
ok('legacy: tier all, every adv section', L.TIER === 'all' && ['direct', 'keys', 'compile', 'main'].every(L.section));
// adv sections
ok('core keeps keys and main, not direct and compile', ['keys', 'main'].every(C.section) && !C.section('direct') && !C.section('compile'));
ok('all and deep keep every section', ['direct', 'keys', 'compile', 'main'].every(T.section) && ['direct', 'compile'].every(D.section));

console.log(`t_glsl_tiers: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
