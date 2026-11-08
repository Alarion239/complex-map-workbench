// H.load (test/cdp_kit/cdpd.js) answers once the app has started, however long that takes: it used to read the page's test
// hooks after a fixed 2.2 s, so a slow page (software GL, a busy machine) came back as an exception object and the suite's
// next read found an element null. Here the page is slowed (the CPU throttled) so that its start-up outlasts 2.2 s:
// load() still answers with the chain's cards. A page that never starts fails with the page's own error.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const RATE = 20, OLD_WAIT_MS = 2500;   // the CPU slowed this many times
const ST = { shapes: [], steps: [{ type: 'recip', params: {}, on: true }] };
await send('Emulation.setCPUThrottlingRate', { rate: RATE });
const t0 = Date.now();
let r = null, err = null;
try { r = await load('kitload' + Date.now(), ST); } catch (e) { err = String(e); }
const ms = Date.now() - t0;
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
info.ms = ms;
ok(`a page slowed ${RATE} times starts later than the old fixed wait`, ms > OLD_WAIT_MS, ms);
ok('load() answered with the chain\'s cards, not an exception object', !err && r && !r.__exc && r.cards.length > 0, { err, r });
return { pass: fails.length === 0, fails, info };
