// H.load (test/cdp_kit/cdpd.js) answers once the app has built the steps chain of the saved state, however long that
// takes. Here the page is slowed (the CPU throttled) so that its start-up outlasts any fixed wait:
// the plane list read right after load() holds the origin plane and one plane per step, and the answer carries the lamps.
// The page's start is also held back (its DOMContentLoaded handlers run LATE_MS later, so its load event comes first), as
// software GL and a busy machine can do: a load() that returns on the page's load event alone reads an empty chain.
// Control: a page whose chain is not built within the call's limit (o.limitMs) fails load(), naming the planes it wanted.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const RATE = 20, LATE_MS = 4000, SHORT_LIMIT_MS = 2500;   // the CPU slowed this many times; the app's start held back this long after the page's load event
const ST = { shapes: [], steps: [{ type: 'recip', params: {}, on: true }, { type: 'sin', params: {}, on: true }] };
const PLANES = 1 + ST.steps.length;   // (planes in the chain; load() waits for CHAIN_PLANES of them)
const hold = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const add = document.addEventListener;
  document.addEventListener = function (type, fn, opt) {
    if (type !== 'DOMContentLoaded') return add.call(this, type, fn, opt);
    return add.call(this, type, () => setTimeout(fn, ${LATE_MS}), opt);
  };
})();` });
await send('Emulation.setCPUThrottlingRate', { rate: RATE });
const t0 = Date.now();
let r = null, err = null, now = null;
try {
  r = await load('kitload' + Date.now(), ST);
  now = await ev(`({ on: !!(window.__cmwSteps && __cmwSteps().on), planes: __cmwSteps().planes.length })`);
} catch (e) { err = String(e); }
const ms = Date.now() - t0;
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
// (control: the app's start is still held LATE_MS after the load event, longer than this limit)
let err2 = null;
try { await load('kitloadlimit' + Date.now(), ST, '', null, { limitMs: SHORT_LIMIT_MS }); } catch (e) { err2 = String(e && e.message || e); }
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: hold.identifier });
info.ms = ms; info.limit = err2;
ok(`a page slowed ${RATE} times starts later than ${LATE_MS} ms`, ms > LATE_MS, ms);
ok('load() did not throw', !err, err);
ok('the steps chain is built when load() returns', !!now && now.on && now.planes >= PLANES, now);
ok('a chain not built within the limit fails load(), naming the limit and the planes wanted', !!err2 && new RegExp('not ready after ' + SHORT_LIMIT_MS + ' ms \\(' + CHAIN_PLANES + ' planes wanted').test(err2), err2);
ok('load() answered with the lamps', !!r && typeof r.lamps === 'string' && !r.__exc, r);
return { pass: fails.length === 0, fails, info };
