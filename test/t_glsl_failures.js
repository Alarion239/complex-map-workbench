// ci/glsl_failures.js, the failures of a GLSL page as short text. The fixture is a failing inverse page of the Windows
// gate (a recorded walk failure of chain `rand#172 recip>recip>powa`, three of its rows with their real numbers): the
// page's result as JSON cut at 6000 characters ends inside a row and has none of the fields after it; the summary has
// every row, the counts and the fields after them. Node, no browser.
// Run: node test/t_glsl_failures.js
'use strict';
const { failureLines, fenced } = require('../ci/glsl_failures');
let pass = 0, fail = 0;
const ok = (name, cond, got) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name + (got !== undefined ? ' ' + JSON.stringify(got).slice(0, 600) : '')); } };

const STEPS = [['recip', {}], ['recip', {}], ['powa', { alpha: '0.008', cut: 90, k: 2 }]];
const SHAPE = '{"id":1,"kind":"disc","c":[0.8611344522796571,-2.0899182313587517],"r":1.2127959100995214}';
const WIN = { x0: -5.004206871381202, x1: 5.193346770247617, y0: -6.8150226213040135, y1: 6.018971717916646 };
const row = (w, gpu, cpu) => ({ chain: 'rand#172 recip>recip>powa', steps: STEPS, shape: SHAPE, win: WIN, w, pix: 0.000023453630650284904, alpha: 1, bad: [`leaf 0 lvl gpu ${gpu} cpu ${cpu}`] });
const fails = [
  row([1.0058742761611938, 0.09185135364532471], 949.3941650390625, 948.9614466314695),
  row([1.0055485963821411, 0.09170592576265335], 953.9886474609375, 953.5565243774365),
  row([1.0038121938705444, 0.09487950801849365], 811.1634521484375, 810.7226543436661),
  row([1.0041, 0.0951], 812.5, 812.0),
];
// (more rows of two other chains, as the page records up to 40: the real result held enough rows to pass 6000 characters before its last fields)
const other = (n) => Object.assign(row([1 + n / 100, 0.1], 700 + n, 699.5 + n), { chain: `rand#${173 + (n >> 2)} recip>powa` });
for (let n = 0; n < 6; n++) fails.push(other(n));
const result = {
  cases: 4000, compared: 123456, failCount: fails.length, fails, byChain: { 'rand#172 recip>recip>powa': 4, 'rand#173 recip>powa': 4, 'rand#174 recip>powa': 2 },
  anchors: { points: 10, compared: 10, failCount: 0, fails: [] },
  clip: { lines: 30, compared: 30, failCount: 0, fails: [] },
  fs: { flat: true, sphere: false }, flip: { ok: false, why: 'the flip moved 3 px' }, errors: [], ms: 99000,
};

// the result as JSON cut at 6000 characters loses the fields after the walk's list
const cutJson = JSON.stringify(result, null, 1).slice(0, 6000);
ok('the cut JSON ends inside the list of the walk\'s failures', cutJson.includes('"fails"') && !cutJson.includes('"byChain"') && !cutJson.includes('"flip"') && !cutJson.includes('"fs"'));
ok('the cut JSON has not the last row', !cutJson.includes('705.5'));

// the summary has every row, its numbers and the fields after the list
const { lines, left } = failureLines('inverse', result);
const text = lines.join('\n');
ok('nothing is left out', left === 0, left);
for (const [gpu, cpu] of [[949.3941650390625, 948.9614466314695], [953.9886474609375, 953.5565243774365], [811.1634521484375, 810.7226543436661], [812.5, 812], [705, 704.5]]) ok(`the leaf level gpu ${gpu} cpu ${cpu} is there`, text.includes(`leaf 0 lvl gpu ${gpu} cpu ${cpu}`));
ok('the per-chain counts are there', text.includes('rand#172 recip>recip>powa: 4') && text.includes('rand#174 recip>powa: 2'));
ok('the fullscreen shader fields are there', text.includes('flat true, sphere false'));
ok('the flip is there', text.includes('flip: {"ok":false'));
ok('the steps of the chain show its powa parameters', text.includes('recip > recip > powa{"alpha":"0.008","cut":90,"k":2}'));
ok('the whole summary is far shorter than the cut JSON', text.length < cutJson.length / 2, [text.length, cutJson.length]);
ok('the heading has the page\'s count', lines.includes('walk: 10'), lines.slice(0, 8));
ok('no line of the summary is cut', !/…/.test(text));

// a row that repeats the chain, steps and shape of the one before it leaves them out
ok('the steps are listed once per chain', (text.match(/steps recip/g) || []).length === 3, (text.match(/steps recip/g) || []).length);
ok('the shape is listed once per chain', (text.match(/shape \{/g) || []).length === 3);
ok('every row keeps its own point', ['(1.00587, 0.0918514)', '(1.00555, 0.0917059)', '(1.00381, 0.0948795)', '(1.0041, 0.0951)'].every((w) => text.includes(`w ${w}`)), text);

// the cap on rows says how many are left out
const many = Object.assign({}, result, { failCount: 30, fails: Array.from({ length: 30 }, (_, i) => Object.assign(row([1, i], 1, 2), { chain: `rand#${i} x` })) });
const capped = failureLines('inverse', many, { rows: 5 });
ok('at 5 rows, 25 are left out', capped.left === 25, capped.left);
ok('the heading and the list say so', capped.lines.includes('walk: 30') && capped.lines.some((l) => /… 25 more recorded, not listed/.test(l)), capped.lines.slice(0, 30));
ok('exactly 5 rows are listed', capped.lines.filter((l) => /^- rand#\d+ x$/.test(l)).length === 5);

// the page records fewer rows than it counts
const fewer = failureLines('inverse', Object.assign({}, result, { failCount: 90, fails: fails.slice(0, 2) }));
ok('the heading has the count and the number recorded', fewer.lines.includes('walk: 90 (2 recorded)'), fewer.lines.slice(0, 3));

// a long text is cut with the number of characters left out
const long = failureLines('glsl', { errors: ['x'.repeat(3000)], failCount: 0 });
ok('a long error says what was left out', long.lines.some((l) => /^- x{400}… \(\+2600 chars\)$/.test(l)), long.lines.map((l) => l.slice(-30)));
const manyErr = failureLines('glsl', { errors: Array.from({ length: 14 }, (_, i) => `e${i}`) });
ok('errors past ten are counted', manyErr.left === 4 && manyErr.lines.includes('  … 4 more not listed'), manyErr.lines);

// the glsl and adv pages
const g = failureLines('adv', {
  failCount: 2, failByChain: { 'default exp': 2 }, errors: ['key check failed: a'],
  failures: [{ chain: 'default exp', steps: [{ type: 'exp', params: {}, on: true }], row: 'main', point: [1, 2], cpu: [0.5, 0.25], gpu: [0.5, 0.2], err: 0.05 }, { chain: 'default exp', row: 'main', point: [3, 4], cpu: [1, 1], gpu: [1, 3], wantBlank: true }],
  singular: { checked: 10, badCount: 1, bad: [{ chain: 'sinc', bad: ['at 0: NaN'] }] },
}).lines.join('\n');
ok('adv: the errors, the per-chain count, the values and the singular points', ['errors: 1', '- key check failed: a', 'default exp: 2', 'values: 2', 'cpu (0.5, 0.25); gpu (0.5, 0.2); err 0.05', 'singular points: 1', 'at 0: NaN'].every((x) => g.includes(x)), g);
ok('adv: the steps are in the form of the page\'s rows', g.includes('steps exp'), g);

// the dh page: only the rows that differ
const dh = failureLines('dh', { orbit: { rows: [{ set: 'a', points: 5, arrayVsRegistersDiffer: 0 }, { set: 'b', points: 5, arrayVsRegistersDiffer: 2 }] }, stop: { rows: [{ chain: 'c', set: 'd', points: 3, early: { over: 0, nanDiff: 1 } }, { chain: 'e', set: 'f', points: 3, early: { over: 0, nanDiff: 0 } }] }, errors: [] }).lines.join('\n');
ok('dh: the differing rows are listed, the equal ones not', dh.includes('orbit: 1') && dh.includes('- b') && dh.includes('stop: 1') && dh.includes('- c / d') && !dh.includes('- a') && !dh.includes('e / f'), dh);

// a page that ran clean has nothing to say; a page that did not run says why
ok('a clean result has no lines', failureLines('inverse', { failCount: 0, fails: [], clip: { failCount: 0, fails: [] }, fs: { flat: true, sphere: true }, flip: { ok: true }, errors: [] }).lines.length === 0);
ok('a setup problem is the first line', failureLines('glsl', { setup: 'timeout after 14400 s' }).lines[0] === 'did not run: timeout after 14400 s');

// the Markdown fence cannot be closed by the text inside
const f = fenced(['a ``` b', 'c']);
ok('the fence is longer than the longest run of backticks in the text', f.startsWith('````\n') && f.endsWith('\n````'), f);
ok('a text without backticks gets a three-backtick fence', fenced(['a']).startsWith('```\n'));

console.log(`glsl_failures: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
