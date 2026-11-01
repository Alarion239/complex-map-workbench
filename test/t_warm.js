// The start-up bar's counting and rules (issue #245; src/gl/04-programs-resources.js, no GPU):
//   (a) warmCount: the groups' ids count once each, done = linked or failed, pending = compiling, programs outside the
//       lists that are compiling count in the total and never in done, so the count is full only when nothing is left;
//   (b) async cases: a program that finishes between two reads, a group whose list changes mid warm-up (a new chain),
//       a total that grows, a failed program;
//   (c) warmBarStep: shows only when work is still pending 300 ms after it began (a warm cache shows nothing), never
//       goes back, never passes 100 %, is indeterminate while the total is unknown, hides 400 ms after the work is
//       done, and a later piece of work starts a new round.
// Run: node test/t_warm.js
const vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const ctx = { console, performance: { now: () => 0 }, setTimeout, clearTimeout };
vm.createContext(ctx);
const { source } = require('./src_text');
const NAMES = { cx: 'CX', symbolic: 'Symbolic', parse: 'Expr', derivs: 'Derivs', natpaths: 'NatPaths', sheets: 'Sheets', formulasteps: 'FormulaSteps', funcs: 'Funcs', invops: 'InvOps', invpatterns: 'InvPatterns', inverse: 'Inverse', calc: 'Calc', glsl: 'GLChain', regionlines: 'RegionLines', region: 'Region', palette: 'Palette', gl: 'GLR' };
for (const f of Object.keys(NAMES)) vm.runInContext(source(f + '.js', path.join(root, 'src'), { esm: 'strip' }) + `\n;globalThis.${NAMES[f]} = ${NAMES[f]};`, ctx, { filename: f + '.js' });
const { warmCount, warmBarStep } = ctx.GLR._src;
let bad = 0, n = 0;
const check = (name, ok, info = '') => { n++; if (!ok) { bad++; console.log('FAIL', name, typeof info === 'string' ? info : JSON.stringify(info)); } };
const eq = (a, b, name) => check(name, JSON.stringify(a) === JSON.stringify(b), `${JSON.stringify(a)} != ${JSON.stringify(b)}`);

// ---- (a) the count ----
{
  const G = [['2d', ['a|static', 'b|static', 'm|static']], ['globe', ['s|static', 'm|static']], ['land', ['t|k|m0']]];
  const st = (m) => (id) => m[id];
  let c = warmCount(G, st({}), []);
  eq([c.done, c.total, c.pending], [0, 5, 0], 'nothing started: 0 of 5 (a program in two groups counts once)');
  eq(c.groups, { '2d': { done: 0, total: 3 }, globe: { done: 0, total: 1 }, land: { done: 0, total: 1 } }, 'the shared program counts in the first group');
  c = warmCount(G, st({ 'a|static': 'ready', 'b|static': 'pending', 'm|static': 'pending' }), []);
  eq([c.done, c.total, c.pending], [1, 5, 2], 'one linked, two compiling');
  c = warmCount(G, st({ 'a|static': 'ready', 'b|static': 'error' }), []);
  eq([c.done, c.pending], [2, 0], 'a failed program is done: nothing more will come of it');
  // programs outside the lists that are compiling: in the total and pending, never done
  c = warmCount(G, st({ 'a|static': 'ready', 'b|static': 'ready', 'm|static': 'ready', 's|static': 'ready', 't|k|m0': 'ready' }), ['inv|x', 'a|static', 'inv|x']);
  eq([c.done, c.total, c.pending], [5, 6, 1], 'an inverse program compiling keeps the count short of full (once, and a listed one is not counted twice)');
  c = warmCount(G, st({ 'a|static': 'ready', 'b|static': 'ready', 'm|static': 'ready', 's|static': 'ready', 't|k|m0': 'ready' }), []);
  eq([c.done, c.total], [5, 5], 'all linked, nothing else compiling: full');
}
// ---- (b) the async cases ----
{
  const states = {};
  let ids = ['x|k1|m1', 'y|k1|m1'];
  const read = () => warmCount([['modes', ids]], (id) => states[id], []);
  states['x|k1|m1'] = 'pending'; states['y|k1|m1'] = 'pending';
  const r0 = read();
  states['x|k1|m1'] = 'ready';   // a program finishes between two reads
  const r1 = read();
  states['y|k1|m1'] = 'ready';
  const r2 = read();
  eq([r0.done, r1.done, r2.done], [0, 1, 2], 'a program finishing between reads: done only goes up');
  check('the pending count follows', r0.pending === 2 && r1.pending === 1 && r2.pending === 0);
  // a new chain mid warm-up: the group's list is the new chain's; the old ones are no longer counted
  ids = ['x|k2|m1', 'y|k2|m1', 'z|k2|m1'];
  const r3 = read();
  eq([r3.done, r3.total], [0, 3], 'a chain change mid warm-up: the new chain\'s programs, none linked yet (the total grew)');
  check('(the bar holds its fill when the total grows)', warmBarStep({ t0: 0, frac: 1, visible: true, indet: false, doneAt: -1, working: true }, { done: r3.done, total: r3.total }, 500).frac === 1);
}
// ---- (c) the bar's rule ----
{
  const run = (steps, o) => { let s = null; const out = []; for (const [t, st] of steps) { s = warmBarStep(s, st, t, o); out.push(s); } return out; };
  // a warm cache: everything lands within 300 ms: the bar never shows
  let r = run([[0, { done: 0, total: 10 }], [100, { done: 4, total: 10 }], [250, { done: 10, total: 10 }], [400, { done: 10, total: 10 }], [900, { done: 10, total: 10 }]]);
  check('a warm cache (all linked within 300 ms): the bar never shows', r.every((s) => !s.visible), r.map((s) => s.visible));
  // a cold start: shows at 300 ms, fills, is full, hides 400 ms later
  r = run([[0, { done: 0, total: 10 }], [299, { done: 1, total: 10 }], [300, { done: 1, total: 10 }], [1000, { done: 5, total: 10 }], [2000, { done: 10, total: 10 }], [2300, { done: 10, total: 10 }], [2400, { done: 10, total: 10 }], [2500, { done: 10, total: 10 }]]);
  eq(r.map((s) => s.visible), [false, false, true, true, true, true, false, false], 'a cold start: hidden until 300 ms, shown while work is pending, hidden 400 ms after the work is done');
  check('the fill at the end of a round is full, then resets', r[4].frac === 1 && r[5].frac === 1 && r[6].frac === 0, r.map((s) => s.frac));
  // monotone, never above 1, holds when the total grows
  r = run([[0, { done: 0, total: 4 }], [400, { done: 2, total: 4 }], [500, { done: 2, total: 12 }], [600, { done: 3, total: 12 }], [700, { done: 9, total: 12 }], [800, { done: 12, total: 12 }]]);
  const fr = r.map((s) => s.frac);
  check('the fill never goes back, even when the total grows', fr.every((v, i) => !i || v >= fr[i - 1]), fr);
  check('the fill stays in [0, 1]', fr.every((v) => v >= 0 && v <= 1), fr);
  check('a total that grew holds the fill (0.5 of 4, then 2 of 12 and 3 of 12 stay at 0.5)', fr[1] === 0.5 && fr[2] === 0.5 && fr[3] === 0.5, fr);
  r = run([[0, { done: 7, total: 5 }]]);
  check('done above total (a stale read) is still at most 100 %', r[0].frac <= 1, r[0].frac);
  // an unknown total is indeterminate, and counts as work
  r = run([[0, { done: 0, total: 0, unknown: true }], [400, { done: 0, total: 6, unknown: true }], [500, { done: 2, total: 8, unknown: false }]]);
  eq(r.map((s) => [s.visible, s.indet]), [[false, true], [true, true], [true, false]], 'an unknown total sweeps (once shown); a known one fills');
  // nothing to do: never shows, whatever the clock says
  r = run([[0, { done: 0, total: 0 }], [5000, { done: 0, total: 0 }]]);
  check('no programs at all (no parallel compile): no bar', r.every((s) => !s.visible && !s.indet), r);
  // a later piece of work (a new chain structure) starts a new round, with its own 300 ms
  r = run([[0, { done: 0, total: 5 }], [300, { done: 2, total: 5 }], [900, { done: 5, total: 5 }], [1400, { done: 5, total: 5 }], [1500, { done: 5, total: 5 }],
    [2000, { done: 5, total: 8 }], [2200, { done: 5, total: 8 }], [2300, { done: 6, total: 8 }], [3000, { done: 8, total: 8 }], [3500, { done: 8, total: 8 }]]);
  eq(r.map((s) => s.visible), [false, true, true, false, false, false, false, true, true, false], 'a later round shows only if it lasts 300 ms');
  // custom delay and hold
  r = run([[0, { done: 0, total: 2 }], [50, { done: 0, total: 2 }]], { delay: 40, hold: 10 });
  check('the delay and the hold can be set', r[1].visible === true);
}
console.log(`${n - bad}/${n} passed`);
process.exit(bad ? 1 : 0);
