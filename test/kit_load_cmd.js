// H.load (test/cdp_kit/cdpd.js) answers once the app has built the steps chain of the saved state, however long that
// takes. Here the page is slowed (the CPU throttled) so that its start-up outlasts the fixed wait a load used to be given:
// the plane list read right after load() holds the origin plane and one plane per step, and the answer carries the lamps.
// A page that never starts fails with the page's own error.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const RATE = 20, OLD_WAIT_MS = 2500;   // the CPU slowed this many times; the shortest wait a slow start is meant to outlast
const ST = { shapes: [], steps: [{ type: 'recip', params: {}, on: true }] };
const PLANES = 1 + ST.steps.length;
await send('Emulation.setCPUThrottlingRate', { rate: RATE });
const t0 = Date.now();
let r = null, err = null, now = null;
try {
  r = await load('kitload' + Date.now(), ST);
  now = await ev(`({ on: !!(window.__cmwSteps && __cmwSteps().on), planes: __cmwSteps().planes.length })`);
} catch (e) { err = String(e); }
const ms = Date.now() - t0;
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
info.ms = ms;
ok(`a page slowed ${RATE} times starts later than ${OLD_WAIT_MS} ms`, ms > OLD_WAIT_MS, ms);
ok('load() did not throw', !err, err);
ok('the steps chain is built when load() returns', !!now && now.on && now.planes >= PLANES, now);
ok('load() answered with the lamps', !!r && typeof r.lamps === 'string' && !r.__exc, r);
return { pass: fails.length === 0, fails, info };
