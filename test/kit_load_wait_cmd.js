// H.load (test/cdp_kit/cdpd.js) returns only when the page it opened is ready: loaded, with its test hooks defined. A page slow
// to load (here the Google Fonts stylesheet held HOLD_MS, past the 20 s one wait of settled) is waited for, and a page that does
// not become ready within the call's limit (o.limitMs, 60 s by default) is an error that says so, not a return on a page still
// loading, whose hooks are then undefined for whatever the suite asks next.
//   - a load of a page held HOLD_MS answers on a loaded page with its hooks;
//   - control: the same load with a limit shorter than the hold throws, naming the limit, and describes the page;
//   - control: when the page cannot answer that read, the throw still names the limit and carries the read error.
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
  // (the held sheet keeps `load` from firing: the page is interactive, its navigation's loadEventEnd 0)
  ok('load: the throw names the page: its readyState, and its navigation timings with the load event not yet come', !!err && /"readyState":"interactive"/.test(err) && /"nav":\{[^}]*"domInteractive":[1-9]\d*[^}]*"loadEventEnd":0\}/.test(err), info.limit);
  // (control: when the page cannot answer the read, the throw still names the limit, and carries the read's own error)
  const STUB = 'the page read is refused';
  const stub = await send('Page.addScriptToEvaluateOnNewDocument', { source: `performance.getEntriesByType = () => { throw new Error('${STUB}'); };` });
  let err2 = null;
  try { t0 = Date.now(); await load('kitloadread' + t0, STATE, '', null, { limitMs: SHORT_LIMIT_MS }); } catch (e) { err2 = String(e && e.message || e); }
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: stub.identifier });
  info.read = { err: err2 };
  ok('load: a page whose read fails still throws the named limit, with the read error in the message', !!err2 && new RegExp('not ready after ' + SHORT_LIMIT_MS + ' ms').test(err2) && err2.includes(STUB), info.read);
} finally { await holdSheet(0); }
return { pass: fails.length === 0, fails, info };
