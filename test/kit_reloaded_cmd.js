// reloaded(old, readyExpr) (test/cdp_kit/cdpd.js) waits for the page a reload brings: a document other than the one that
// began at old (its performance.timeOrigin), loaded, with readyExpr true; a call cut off by the reload is asked again of
// the new page; after limitMs it throws, naming the part still missing.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const RELOAD_AFTER_MS = 100;     // the page reloads itself this long after the wait starts
const SHORT_LIMIT_MS = 1500;     // a wait that is meant to give up
const READY = `typeof __cmwSteps === 'function' && Array.isArray(__cmwSteps().planes)`;   // (throws until the app has started)
await go(`http://localhost:${PORT}/test.html?view=steps`);
await settled({ only: true, max: 20000, until: READY });

// a reload that lands while the wait is in flight
const old = await ev('performance.timeOrigin');
await ev(`setTimeout(() => location.reload(), ${RELOAD_AFTER_MS}); 1`);
let err = null;
try { await reloaded(old, READY); } catch (e) { err = String(e && e.message || e); }
info.err = err;
ok('the wait returns once the new page is up', err === null, err);
const now = await ev(`({ origin: performance.timeOrigin, ready: ${READY}, rs: document.readyState })`);
ok('it is a new document', now.origin !== old, { old, now });
ok('loaded, and the ready expression is true', now.rs === 'complete' && now.ready === true, now);

// a probe the reload cuts off (a page-gone error before it reaches the page) is asked again, whenever the reload lands
const before = await ev('performance.timeOrigin');
await ev(`setTimeout(() => location.reload(), ${RELOAD_AFTER_MS}); 1`);
injectGone(1);
let cutErr = null;
try { await reloaded(before, READY); } catch (e) { cutErr = String(e && e.message || e); }
info.cutErr = cutErr;
ok('a probe cut off by the page-gone error is asked again', cutErr === null, cutErr);
ok('the injected cut was consumed by the wait (none is left to leak into the next suite)', goneLeft() === 0, goneLeft());

// a ready expression that throws while the page starts (a hook that is not up yet) is not true yet, and is not a failure of the wait
const GATE_MS = 600;   // the page defines its gate this long after it starts
const gate = await send('Page.addScriptToEvaluateOnNewDocument', { source: `setTimeout(() => { window.__gate = { open: true }; }, ${GATE_MS});` });
const beforeGate = await ev('performance.timeOrigin');
await ev(`setTimeout(() => location.reload(), ${RELOAD_AFTER_MS}); 1`);
let gateErr = null;
const t1 = Date.now();
try { await reloaded(beforeGate, 'window.__gate.open'); } catch (e) { gateErr = String(e && e.message || e); }
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: gate.identifier });
info.gate = { gateErr, ms: Date.now() - t1 };
ok('a ready expression that throws until the page has started is waited for, and the wait returns', gateErr === null && info.gate.ms >= GATE_MS, info.gate);

// a page that never reloads: the wait gives up and names what is missing
const same = await ev('performance.timeOrigin');
let gaveUp = null;
try { await reloaded(same, READY, { limitMs: SHORT_LIMIT_MS }); } catch (e) { gaveUp = String(e && e.message || e); }
info.gaveUp = gaveUp;
ok('a page that does not reload fails the wait', !!gaveUp, gaveUp);
ok('the message names the part missing and the limit', !!gaveUp && /newDocument/.test(gaveUp) && new RegExp(String(SHORT_LIMIT_MS)).test(gaveUp), gaveUp);

return { pass: fails.length === 0, fails, info };
