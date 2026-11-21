// H.ev's timeout (test/cdp_kit/cdpd.js): a page call that outruns it is a named fault, not a bare -32603 that ends the suite.
//   - a busy loop longer than the limit answers { __exc } that names the limit and the time it took, and counts as a fault of the
//     suite until the answer is read (the fault's record, kitFaults, names the expression's start);
//   - control: a loop shorter than the limit answers its value;
//   - the pixel reads of test/lib/held_frames.js (snap, grab) have their own, longer limit: a getImageData that takes longer than ev's
//     default 20 s (here a stub that busy-waits OVER_MS) still answers, and the same page call under ev's default is the named fault.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const LIMIT_MS = 1000, LONG_LOOP_MS = 3000, SHORT_LOOP_MS = 200, OVER_MS = 22000;
const busy = (ms) => `(() => { const t = performance.now(); while (performance.now() - t < ${ms}); return 'done'; })()`;
await go(`http://localhost:${PORT}/test.html?view=steps&ns=kitevtimeout${Date.now()}`);
await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.getElementById('canvasL')` });
const t0 = Date.now();
const over = await ev(busy(LONG_LOOP_MS), LIMIT_MS);
info.over = { exc: over && over.__exc, ms: Date.now() - t0 };
ok('a page call that outruns the limit answers { __exc }', !!over && typeof over.__exc === 'string', info.over);
ok('the fault names the limit', !!over && new RegExp(`timeout of ${LIMIT_MS} ms`).test(over.__exc || ''), info.over);
ok('it came back near the limit, not after the loop', Date.now() - t0 < LONG_LOOP_MS + 1000, info.over);
const fine = await ev(busy(SHORT_LOOP_MS), LIMIT_MS);
ok('control: a loop under the limit answers its value', fine === 'done', fine);
// (a read the GPU keeps waiting on: getImageData over OVER_MS)
await ev(`(() => { const g = CanvasRenderingContext2D.prototype.getImageData; CanvasRenderingContext2D.prototype.getImageData = function (...a) { const t = performance.now(); while (performance.now() - t < ${OVER_MS}); return g.apply(this, a); }; return 1; })()`);
const { snap } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const r = await snap('slow');
ok(`snap answers when the pixel read takes ${OVER_MS} ms`, r === true, r);
const plain = await ev(`(() => { const c = document.getElementById('canvasL'); c.getContext('2d').getImageData(0, 0, 1, 1); return 'read'; })()`);
info.plain = plain && plain.__exc ? plain.__exc.slice(0, 120) : plain;
ok('control: the same read under ev\'s default limit is the named fault', !!plain && /outran its timeout of 20000 ms/.test(plain.__exc || ''), info.plain);
return { pass: fails.length === 0, fails, info };
