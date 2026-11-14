// H.load (test/cdp_kit/cdpd.js) returns only when the page it opened is ready: loaded, with its test hooks defined. A page slow
// to load (here the Google Fonts stylesheet held HOLD_MS, past the 20 s one wait of settled) is waited for, and a page that does
// not become ready within the call's limit (o.limitMs, 60 s by default) is an error that says so, not a return on a page still
// loading, whose hooks are then undefined for whatever the suite asks next.
//   - a load of a page held HOLD_MS answers on a loaded page with its hooks;
//   - control: the same load with a limit (DIAG_LIMIT_MS) shorter than the hold throws, naming the limit, and describes the page;
//   - control: when the page cannot answer that read, the throw still names the limit and carries the read error;
//   - a document whose body stops after STALL_BYTES is opened again after stallMs and the load answers on a ready page;
//   - control: a server that stops every answer gets two more openings, and the load throws naming the limit;
//   - go opens a stalled document again (GO_STALL_MS), and answers false when none ever finishes.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// (DIAG_LIMIT_MS: long enough for the 5 MB document to finish parsing on a loaded machine, so the page the throw describes is
// the one held by its sheet, and shorter than HOLD_MS)
const HOLD_MS = 25000, SHORT_LIMIT_MS = 3000, DIAG_LIMIT_MS = 15000, STALL_BYTES = 1 << 20, STALL_MS = 2000, STALL_LIMIT_MS = 12000;
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
  try { await load('kitloadlimit' + t0, STATE, '', null, { limitMs: DIAG_LIMIT_MS }); } catch (e) { err = String(e && e.message || e); }
  info.limit = { err, ms: Date.now() - t0 };
  ok('load: a page that is not ready within its limit throws, naming the limit', !!err && new RegExp('not ready after ' + DIAG_LIMIT_MS + ' ms').test(err), info.limit);
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
  await holdSheet(0);
  // (a document whose body stops arriving: a server for dist/ that sends STALL_BYTES of test.html and then nothing)
  const DIST = path.join(DIR, '..', '..', 'dist');
  const serveDist = async (stalled) => {
    const srv = http.createServer((req, res) => {
      const f = path.join(DIST, req.url.split('?')[0]), buf = fs.readFileSync(f), isTest = req.url.startsWith('/test.html');
      res.setHeader('Content-Type', 'text/html'); res.setHeader('Content-Length', buf.length);
      if (isTest) srv.tests++;
      if (isTest && stalled(srv.tests)) res.write(buf.subarray(0, STALL_BYTES)); else res.end(buf);
    });
    srv.tests = 0;
    await new Promise((done) => srv.listen(0, done));
    srv.origin = 'http://localhost:' + srv.address().port;
    return srv;
  };
  let srv = await serveDist((n) => n === 1);
  try {
    t0 = Date.now();
    await load('kitloadreload' + t0, STATE, '', null, { origin: srv.origin, stallMs: STALL_MS, limitMs: STALL_LIMIT_MS });
    info.reload = { page: await ev(PAGE), tests: srv.tests, ms: Date.now() - t0 };
    ok('load: a document whose body stops arriving is opened again, and the load answers on a ready page', info.reload.page === 'complete,function,function,true' && srv.tests === 2, info.reload);
  } catch (e) { ok('load: a document whose body stops arriving is opened again', false, String(e && e.message || e)); }
  finally { srv.closeAllConnections(); srv.close(); }
  srv = await serveDist(() => true);
  err = null;
  try { await load('kitloadforever' + Date.now(), STATE, '', null, { origin: srv.origin, stallMs: STALL_MS, limitMs: STALL_LIMIT_MS }); } catch (e) { err = String(e && e.message || e); }
  finally { srv.closeAllConnections(); srv.close(); }
  info.forever = { err, tests: srv.tests };
  ok('load: control: a server that stops every answer is opened again twice, then throws, naming the limit', !!err && new RegExp('not ready after ' + STALL_LIMIT_MS + ' ms').test(err) && /reloads 2;/.test(err) && srv.tests === 3, info.forever);
  // (go, which nav, seed and loadView use, opens a stalled document again too, and answers false when none ever finishes)
  const GO_LIMIT_MS = 12000;
  srv = await serveDist((n) => n === 1);
  try {
    t0 = Date.now();
    const loaded = await go(srv.origin + '/test.html?ns=kitgoreload' + t0, GO_LIMIT_MS);
    info.goReload = { loaded, tests: srv.tests, ms: Date.now() - t0 };
    ok('go: a document whose body stops arriving is opened again, and go answers true', loaded === true && srv.tests === 2, info.goReload);
  } finally { srv.closeAllConnections(); srv.close(); }
  srv = await serveDist(() => true);
  try {
    t0 = Date.now();
    const loaded = await go(srv.origin + '/test.html?ns=kitgoforever' + t0, GO_LIMIT_MS);
    info.goForever = { loaded, tests: srv.tests, ms: Date.now() - t0 };
    ok('go: control: a server that stops every answer is opened again twice, then go answers false within its limit', loaded === false && srv.tests === 3 && info.goForever.ms < GO_LIMIT_MS + 3000, info.goForever);
  } finally { srv.closeAllConnections(); srv.close(); }
} finally { await holdSheet(0); }
return { pass: fails.length === 0, fails, info };
