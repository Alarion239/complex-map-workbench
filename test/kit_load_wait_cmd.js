// H.load (test/cdp_kit/cdpd.js) returns only when the page it opened is ready: loaded, with its test hooks defined. A page slow
// to load (here the Google Fonts stylesheet held HOLD_MS, past the 20 s one wait of settled) is waited for, and a page that does
// not become ready within the call's limit (o.limitMs, 60 s by default) is an error that says so, not a return on a page still
// loading, whose hooks are then undefined for whatever the suite asks next.
//   - a load of a page held HOLD_MS answers on a loaded page with its hooks;
//   - control: the same load with a limit shorter than the hold throws, naming the limit.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const HOLD_MS = 25000, SHORT_LIMIT_MS = 3000;
const STATE = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 } };
const PAGE = `[document.readyState, typeof window.__cmwPaneStatus, typeof window.__cmwW2S, !!document.getElementById('canvasR')].join()`;
await view(1440, 900, false, false);
await holdSheet(HOLD_MS);
try {
  let t0 = Date.now();
  await load('kitloadwait' + t0, STATE);
  info.after = { page: await ev(PAGE), ms: Date.now() - t0 };
  ok('load: the page held ' + HOLD_MS + ' ms is loaded, with its hooks, when load returns', info.after.page === 'complete,function,function,true', info.after);
  let err = null;
  t0 = Date.now();
  try { await load('kitloadlimit' + t0, STATE, '', null, { limitMs: SHORT_LIMIT_MS }); } catch (e) { err = String(e && e.message || e); }
  info.limit = { err, ms: Date.now() - t0 };
  ok('load: a page that is not ready within its limit throws, naming the limit', !!err && new RegExp('not ready after ' + SHORT_LIMIT_MS + ' ms').test(err), info.limit);
} finally { await holdSheet(0); }
return { pass: fails.length === 0, fails, info };
