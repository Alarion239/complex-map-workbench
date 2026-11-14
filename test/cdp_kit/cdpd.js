// QA daemon: keeps one headless Chrome (ANGLE Metal; Direct3D 11 on Windows, SwiftShader on Linux) alive over --remote-debugging-pipe and runs
// command files dropped into ./q (N.js -> N.out). Each command file is the body of an async function
// with helpers in scope (ev, shot, nav, view, key, click, drag, logs, send, S, sleep).
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const DIR = __dirname;
const Q = path.join(DIR, 'q');
fs.mkdirSync(Q, { recursive: true });
// (Windows: Chrome's own install path and ANGLE's Direct3D 11 back end, what Chrome uses there; Linux: google-chrome
// and SwiftShader, CPU WebGL2. CHROME_BIN, CMW_ANGLE and CMW_CHROME_ARGS override them, as in the CI scripts: ci/README.md)
const WIN = process.platform === 'win32', MAC = process.platform === 'darwin';
const CHROME = process.env.CHROME_BIN || (WIN ? path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe')
  : MAC ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : ['/usr/bin/google-chrome', '/usr/bin/chromium'].find((p) => fs.existsSync(p)) || 'google-chrome');
const ANGLE = process.env.CMW_ANGLE || (WIN ? 'd3d11' : MAC ? 'metal' : 'swiftshader');
const prof = fs.mkdtempSync(path.join(DIR, 'chprof-'));
// (the disk cache in the profile, not the system's cache folder: deleting the profile deletes it)
const ch = spawn(CHROME, ['--headless=new', `--use-angle=${ANGLE}`, `--user-data-dir=${prof}`, `--disk-cache-dir=${path.join(prof, 'cache')}`, '--remote-debugging-pipe',
  '--no-first-run', '--no-default-browser-check', '--ignore-gpu-blocklist', '--enable-gpu', '--hide-scrollbars=false',
  ...(ANGLE === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : []), ...(process.env.CMW_CHROME_ARGS || '').split(/\s+/).filter(Boolean), 'about:blank'],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
const wr = ch.stdio[3], rd = ch.stdio[4];
let id = 0, buf = '';
const pend = new Map();
const LOG = [];
// What last ended or replaced the page, for the error a call gets when the page goes under it ("Inspected target navigated
// or closed", "Cannot find context with specified id"): the main frame navigating or starting to load, or the page
// crashing or detaching. CAUSE_BACK_MS: how long before a call an event still explains its failure; CAUSE_WAIT_MS: how long
// a failed call waits for the event that explains it (the error can come first).
const CAUSE_BACK_MS = 5000, CAUSE_WAIT_MS = 500;
const GONE = /navigated or closed|Cannot find context with specified id/;
let CAUSE = null;
const noteCause = (text) => { CAUSE = { at: Date.now(), text }; LOG.push({ t: 'cdp', m: text }); };
rd.on('data', (d) => {
  buf += d.toString('utf8');
  let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (msg.id && pend.has(msg.id)) { const { res, rej } = pend.get(msg.id); pend.delete(msg.id); msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result); }
    else if (msg.method === 'Runtime.consoleAPICalled') LOG.push({ t: msg.params.type, m: msg.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ').slice(0, 400) });
    else if (msg.method === 'Runtime.exceptionThrown') LOG.push({ t: 'EXC', m: (msg.params.exceptionDetails.exception && msg.params.exceptionDetails.exception.description || msg.params.exceptionDetails.text).slice(0, 600) });
    else if (msg.method === 'Fetch.requestPaused') vendorAnswer(msg.params, msg.sessionId);
    else if (msg.method === 'Page.frameNavigated' && !msg.params.frame.parentId) noteCause(`Page.frameNavigated ${msg.params.frame.url}`);
    else if (msg.method === 'Page.frameStartedLoading' && !msg.params.parentFrameId) noteCause('Page.frameStartedLoading');
    else if (msg.method === 'Inspector.targetCrashed' || msg.method === 'Target.targetCrashed') noteCause(msg.method);
    else if (msg.method === 'Inspector.detached') noteCause(`Inspector.detached ${(msg.params && msg.params.reason) || ''}`.trim());
    else if (msg.method === 'Page.loadEventFired') { LOADS++; for (const w of loadWait.splice(0)) w(); }
    else if (msg.method === 'Log.entryAdded') LOG.push({ t: 'log-' + msg.params.entry.level, m: msg.params.entry.text.slice(0, 400) });
  }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const m = { id: ++id, method, params }; if (sessionId) m.sessionId = sessionId;
  const t0 = Date.now();
  // a call the page went under fails with the event that came first (or says none was seen)
  const fail = async (e) => {
    if (!GONE.test(e.message)) return rej(e);
    while (!(CAUSE && CAUSE.at >= t0 - CAUSE_BACK_MS) && Date.now() - t0 < CAUSE_WAIT_MS) await new Promise((r) => setTimeout(r, 10));
    const why = CAUSE && CAUSE.at >= t0 - CAUSE_BACK_MS ? CAUSE.text : `no navigation or crash event within ${CAUSE_BACK_MS} ms before or ${CAUSE_WAIT_MS} ms after the call`;
    rej(new Error(`${e.message} [${method}: ${why}]`));
  };
  pend.set(m.id, { res, rej: fail }); wr.write(JSON.stringify(m) + '\0');
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// (the page's load events, for H.go: how many so far, and who waits for the next)
let LOADS = 0;
const loadWait = [];
// [#444] CMW_VENDOR=1: the page's CDN files (MathJax, the PDF library, the Google Fonts) from vendor/ (vendor.js), for a
// machine with no route to the CDNs; a request it does not know goes on to the network. Off by default, and in CI.
const VENDOR = process.env.CMW_VENDOR === '1' ? require(path.join(DIR, 'vendor.js')) : null;
function vendorAnswer(p, sid) {
  // (H.holdSheet: the Google Fonts stylesheet request, vendored or not, goes on after HOLD.ms)
  if (HOLD.ms && /^https:\/\/fonts\.googleapis\.com\//.test(p.request.url)) { setTimeout(() => answerNow(p, sid), HOLD.ms); return; }
  answerNow(p, sid);
}
function answerNow(p, sid) {
  let a;
  // (a vendored file that is not LOCK.json's: the request fails and the suite's log says why, never a silent stand-in)
  try { a = VENDOR && VENDOR.answer(p.request.url); } catch (e) { LOG.push({ t: 'EXC', m: `CMW_VENDOR: ${e.message}` }); console.error(e.message); send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'Failed' }, sid).catch(() => {}); return; }
  if (!a) { send('Fetch.continueRequest', { requestId: p.requestId }, sid).catch(() => {}); return; }
  send('Fetch.fulfillRequest', { requestId: p.requestId, responseCode: 200, body: a.body.toString('base64'),
    responseHeaders: [{ name: 'content-type', value: a.type }, { name: 'access-control-allow-origin', value: '*' }, { name: 'cache-control', value: 'no-store' }] }, sid).catch(() => {});
}
// H.holdSheet(ms): the Google Fonts stylesheet request waits ms before it goes on (0 stops holding), for a page whose
// faces arrive after first paint
const HOLD = { ms: 0 };
let S = null;
const H = {};
H.holdSheet = async (ms) => {
  HOLD.ms = ms;
  const patterns = (VENDOR ? VENDOR.PATTERNS : []).concat(['https://fonts.googleapis.com/*']);
  await send('Fetch.enable', { patterns: patterns.map((urlPattern) => ({ urlPattern })) }, S);
  // (a sheet from the browser's cache never reaches the hold)
  await send('Network.enable', {}, S); await send('Network.setCacheDisabled', { cacheDisabled: ms > 0 }, S);
};
H.send = (m, p) => send(m, p, S);
// H.forgetCause(): the last navigation or crash is no longer what a failing call is explained by (for a check of the
// message a call gets when no event explains its failure)
H.forgetCause = () => { CAUSE = null; };
H.sleep = sleep;
// evaluates expr in the page and returns its value. In REPL mode a returned promise is not awaited by Runtime.evaluate
// (it comes back as {}), so a promise result is followed with Runtime.awaitPromise, within the same timeout. An object
// result is read by value from its handle, which is released at once.
// (#1328) an answer the kit cannot give as data: a page exception ({ __exc }) and a wait that ran out (H.settled's ok false).
// Each is recorded as a fault of the suite, and counts as handled once the suite reads what says so (`__exc`; `ok` or `at`),
// so a suite that checks the answer is as it was and one that reads on as if the page had answered fails at its end,
// with the expression or the wait and the text (kitFaults in its result; ci/browser.js failures()).
const FAULTS = [];
const faultAnswer = (ans, key, what) => {
  const f = { what, handled: false };
  FAULTS.push(f);
  const guarded = Object.assign({}, ans);
  for (const k of key) Object.defineProperty(guarded, k, { enumerable: true, configurable: true, get() { f.handled = true; return ans[k]; } });
  return guarded;
};
// faults(clear): the faults so far that the suite has not read (what the suite's result lists as kitFaults); clear forgets all
H.faults = (clear = false) => { const u = FAULTS.filter((x) => !x.handled).map((x) => x.what); if (clear) FAULTS.length = 0; return u; };
H.ev = async (expr, timeout = 20000) => {
  const r = await evRaw(expr, timeout);
  return r && typeof r === 'object' && Object.keys(r).length === 1 && typeof r.__exc === 'string' ? faultAnswer(r, ['__exc'], `ev ${JSON.stringify(String(expr).slice(0, 160))}: ${r.__exc.slice(0, 300)}`) : r;
};
const evRaw = async (expr, timeout = 20000) => {
  const t0 = Date.now();
  const group = 'ev';
  const fail = (d) => ({ __exc: (d.exception && d.exception.description) || d.text });
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: false, timeout, userGesture: true, replMode: true, objectGroup: group }, S);
  if (r.exceptionDetails) return fail(r.exceptionDetails);
  const o = r.result;
  if (!o.objectId) return o.value;
  try {
    let timer;
    const left = Math.max(1, timeout - (Date.now() - t0));
    const limit = new Promise((res) => { timer = setTimeout(() => res({ exceptionDetails: { text: `ev: the promise did not settle within ${timeout} ms` } }), left); });
    const settled = o.subtype === 'promise'
      ? await Promise.race([send('Runtime.awaitPromise', { promiseObjectId: o.objectId, returnByValue: true, userGesture: true }, S), limit])
      : await send('Runtime.callFunctionOn', { objectId: o.objectId, functionDeclaration: 'function () { return this; }', returnByValue: true }, S);
    clearTimeout(timer);
    if (settled.exceptionDetails) return fail(settled.exceptionDetails);
    return settled.result.value;
  } finally {
    // (the release only frees the page's references: the answer is already read, and when the page has reloaded or gone its group is gone too, so a failed release has nothing to report)
    send('Runtime.releaseObjectGroup', { objectGroup: group }, S).catch(() => {});
  }
};
// (the device pixel ratio: CMW_DPR, 1 by default; 2 is the Mac's screen)
const DPR = +process.env.CMW_DPR || 1;
H.view = async (w, h, dark, mobile) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: !!mobile }, S);
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] }, S);
  await send('Emulation.setTouchEmulationEnabled', { enabled: !!mobile, maxTouchPoints: mobile ? 5 : 1 }, S);
};
// (#363) a pattern load() seeded for a namespace is set again whenever that namespace's page is opened anew: the app
// itself opens every saved pattern as the phase
H.seeded = null;
H.reseed = async () => { const p = H.seeded && H.seeded.pattern; if (!p) return; for (let i = 0; i < 600; i++) { let r = null; try { r = await H.ev(`typeof __cmwSet === 'function' ? (__cmwSet('pattern', ${JSON.stringify(p)}), true) : false`); } catch (e) { r = null; } if (r === true) break; await sleep(100); } };
// [#504] H.go(url): navigate and wait for the new page's load event (at most `ms`), instead of a fixed sleep after it.
// It answers whether the load came in time; a page that did not load says so in the suite's log. A document whose body has stopped
// arriving (docStalled) after GO_STALL_MS is opened again, at most LOAD_RELOADS times in all, inside the same limit.
const GO_STALL_MS = 5000;
H.go = async (url, ms = 15000) => {
  const n = LOADS, t0 = Date.now();
  await send('Page.navigate', { url }, S);
  let ok = false, reloads = 0;
  while (!ok && Date.now() - t0 < ms) {
    const left = ms - (Date.now() - t0), step = reloads < LOAD_RELOADS ? Math.min(left, GO_STALL_MS) : left;
    let t;
    ok = await Promise.race([new Promise((r) => { if (LOADS > n) r(true); else loadWait.push(() => r(true)); }), new Promise((r) => { t = setTimeout(() => r(false), step); })]);
    clearTimeout(t);
    if (!ok && reloads < LOAD_RELOADS && await docStalled()) { reloads++; await send('Page.navigate', { url }, S); }
  }
  if (!ok) LOG.push({ t: 'warn', m: `H.go: no load event within ${ms} ms (${url}; reloads ${reloads})` });
  if (H.seeded && new RegExp('[?&]ns=' + H.seeded.ns + '(&|$)').test(url)) await H.reseed();   // (#363, as H.nav)
  return ok;
};
// H.nav(url): navigate and wait for the new page as H.load does for the app: its load event (H.go), then, for the app's page, its
// start-up (the app begins after the load event: the plane list answers) and the page quiet (H.settled, at most NAV_QUIET_MS).
// A page that is not the app's (a helper page, an old build) has no start-up to wait for. Answers whether the page came up in
// time; a page that did not says so in the suite's log (H.go, H.settled), as a check after nav sees the page as it is.
const NAV_QUIET_MS = 8000;
H.nav = async (url) => {
  const loaded = await H.go(url);
  const r = await H.settled({ max: NAV_QUIET_MS, until: `typeof window.__cmwSteps !== 'function' || (() => { try { return Array.isArray(__cmwSteps().planes); } catch (e) { return false; } })()` });
  return loaded && r.ok;
};
// [#504] H.settled(o): wait until the page is quiet, instead of a fixed sleep: after o.floor ms (default 0), until two
// animation frames find the document loaded, neither pane's last GPU frame pending, compiling or awaiting its Landscape refinement (__cmwPaneStatus; not
// with o.panes false, for a check that needs no GL frame),
// no finite animation or transition running (document.getAnimations(); an endless one, a spinner, never ends), and
// o.until (an expression, e.g. '!__cmwSteps().moving') true. At most o.max ms (default 8000): it then answers why not,
// and the suite's log says so, so a check after it sees the page as it is. Answers { ok, ms, busy, at }; at is ms when
// ok and -1 when not, for a check that reads the wait as a time (at >= 0). With o.only the page's quiet is not asked, only
// o.until (polled without animation frames, so on a hidden page too): the wait for one condition to come true.
H.settled = async (o = {}) => {
  if (o.floor) await sleep(o.floor);
  const max = o.max || 8000, until = o.until ? `() => (${o.until})` : 'null';
  const r = await H.ev(`await (async (until, max, panes, only) => {
    const t0 = performance.now(), frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    for (;;) {
      if (!only) await frames();
      const busy = [];
      if (!only) {
      if (document.readyState !== 'complete') busy.push('loading');
      if (panes && typeof window.__cmwPaneStatus === 'function') for (const p of ['L', 'R']) { const st = window.__cmwPaneStatus(p); if (st && (st.pending || st.compiling || st.refining)) busy.push('pane ' + p + (st.compiling ? ' compiling' : st.refining ? ' refining' : ' pending')); }
      const an = document.getAnimations().filter((a) => a.playState === 'running' && a.effect && Number.isFinite(a.effect.getComputedTiming().endTime));
      if (an.length) busy.push(an.length + ' animation(s)');
      }
      if (until) { let u; try { u = until(); } catch (e) { u = false; } if (!u) busy.push('until'); }
      const ms = Math.round(performance.now() - t0);
      if (!busy.length) return { ok: true, ms, busy };
      if (ms > max) return { ok: false, ms, busy };
      await new Promise((r) => setTimeout(r, 50));
    }
  })(${until}, ${max}, ${o.panes !== false}, ${!!o.only})`, max + 5000);
  if (!r || r.__exc || !r.ok) LOG.push({ t: 'warn', m: `H.settled: ${o.only ? 'condition not met' : 'not quiet'} after ${max} ms (${JSON.stringify(r)})` });
  const ans = r && r.busy ? Object.assign(r, { at: r.ok ? r.ms : -1 }) : { ok: false, ms: max, busy: [(r && r.__exc) || 'no answer'], at: -1 };
  return ans.ok ? ans : faultAnswer(ans, ['ok', 'at'], `H.settled ${o.until ? JSON.stringify(String(o.until).slice(0, 160)) : '(quiet)'} did not come within ${max} ms: ${JSON.stringify(ans.busy)}`);
};
// H.reloaded(old, readyExpr, { limitMs }): waits for the page a reload brings: a document other than the one that began at
// old (its performance.timeOrigin, read before the reload was asked for), loaded, with readyExpr (an expression, default
// true) true; an expression that throws (a hook of the app that is not up yet) is not true yet. A call the reload cuts off fails with the page-gone error (GONE); that error, and only that one, is the cue to
// ask again of the new page, any other error is thrown. After limitMs (RELOAD_LIMIT_MS by default) it throws, naming
// the parts still missing (newDocument, loaded, ready).
const RELOAD_LIMIT_MS = 20000, RELOAD_POLL_MS = 50;
// H.injectGone(n): the next n probes of H.reloaded fail with the page-gone error before they reach the page, as when the
// reload cuts them off (for a check that the wait asks again; it counts down to 0 by itself)
const FAULT = { gone: 0 };
H.injectGone = (n) => { FAULT.gone = n; };
const probe = (expr) => { if (FAULT.gone > 0) { FAULT.gone--; return Promise.reject(new Error('{"code":-32000,"message":"Inspected target navigated or closed"}')); } return H.ev(expr); };
H.reloaded = async (old, readyExpr = 'true', { limitMs = RELOAD_LIMIT_MS } = {}) => {
  const t0 = Date.now();
  let parts = null;
  for (;;) {
    try {
      const r = await probe(`({ newDocument: performance.timeOrigin !== ${old}, loaded: document.readyState === 'complete', ready: (() => { try { return !!(${readyExpr}); } catch (e) { return false; } })() })`);
      if (r && r.newDocument !== undefined) { parts = r; if (r.newDocument && r.loaded && r.ready) return true; }
    } catch (e) { if (!GONE.test(String((e && e.message) || e))) throw e; }
    if (Date.now() - t0 > limitMs) {
      const missing = parts ? Object.keys(parts).filter((k) => !parts[k]) : ['any answer'];
      throw new Error(`the page did not finish reloading within ${limitMs} ms (missing: ${missing.join(', ')}; ready: ${readyExpr})`);
    }
    await sleep(RELOAD_POLL_MS);
  }
};
H.shot = async (name, clip) => {
  const p = { format: 'png' }; if (clip) p.clip = Object.assign({ scale: 1 }, clip);
  const r = await send('Page.captureScreenshot', p, S);
  const f = path.join(DIR, 'shots', name + '.png'); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, Buffer.from(r.data, 'base64')); return f;
};
const KEYS = { Enter: [13, '\r'], Escape: [27, ''], Tab: [9, ''], Backspace: [8, ''], Delete: [46, ''], ArrowDown: [40, ''], ArrowUp: [38, ''], ArrowLeft: [37, ''], ArrowRight: [39, ''], F6: [117, ''], Home: [36, ''], End: [35, ''], ' ': [32, ' '] };
H.key = async (k, mods = 0) => {
  const kc = KEYS[k] ? KEYS[k][0] : k.toUpperCase().charCodeAt(0);
  const text = KEYS[k] ? KEYS[k][1] : (mods & ~8 ? '' : k);
  const code = KEYS[k] ? k : (/[a-z]/i.test(k) ? 'Key' + k.toUpperCase() : /[0-9]/.test(k) ? 'Digit' + k : '');
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: k, code, windowsVirtualKeyCode: kc, text, unmodifiedText: text, modifiers: mods }, S);
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: kc, modifiers: mods }, S);
};
H.type = async (s) => { await send('Input.insertText', { text: s }, S); };
H.click = async (x, y, opts = {}) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, S);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: opts.mods || 0 }, S);
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers: opts.mods || 0 }, S);
};
H.move = async (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, S);
// drag(x0, y0, x1, y1, n, dt, rel): press at (x0, y0), n moves along the line to (x1, y1) dt ms apart, release. rel = { x, y, moves }
// changes the end: the release is at (rel.x, rel.y) (default (x1, y1)), and only the first rel.moves of the n moves are sent
// (default all), as when a busy frame drops the last moves of a gesture.
H.drag = async (x0, y0, x1, y1, n = 12, dt = 16, rel = {}) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0, y: y0 }, S);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 }, S);
  const moves = rel.moves === undefined ? n : rel.moves;
  for (let i = 1; i <= moves; i++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n, button: 'left', buttons: 1 }, S); await sleep(dt); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rel.x === undefined ? x1 : rel.x, y: rel.y === undefined ? y1 : rel.y, button: 'left', clickCount: 1 }, S);
};
H.clickSel = async (sel) => {
  const r = await H.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return null; e.scrollIntoView({block:'nearest'}); const b=e.getBoundingClientRect(); return [b.left+b.width/2,b.top+b.height/2];})()`);
  if (!r || r.__exc) return 'nosel ' + sel;
  await H.click(r[0], r[1]); return r;
};
// choose(css, value): the steps view's choice button (Speed, Order) set the way a user sets it: its menu opened, the item for
// value picked (a menu a touch raised is deaf to a click for a moment, so the pick is tried again until the button holds value).
// Returns whether it does.
H.choose = async (sel, value) => {
  const q = `document.querySelector(${JSON.stringify(sel)})`, want = `${q} && ${q}.value === ${JSON.stringify(value)}`;
  for (let i = 0; i < 20 && !(await H.ev(want)); i++) {
    await H.ev(`(() => { const b = ${q}; if (!b) return 0; b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); b.click(); return 1; })()`);
    await H.settled({ until: `!!document.querySelector('#popHost .menu .mi')`, only: true, max: 400 });
    await H.ev(`(() => { const b = ${q}, c = b && b.choices.find((p) => p[0] === ${JSON.stringify(value)}), m = c && [...document.querySelectorAll('#popHost .menu .mi')].find((x) => x.querySelector('.mi-label').textContent === c[1]); if (!m) return 0; m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' })); m.click(); return 1; })()`);
    await H.settled({ until: want, only: true, max: 400 });
  }
  return !!(await H.ev(want));
};
const savedState = (st) => Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
// seed(ns, state): the saved state the app reads under ns on its first load, written from the helper page (a page of the same
// origin that starts no app); waits for the helper page's load event
H.seed = async (ns, st) => {
  await H.go('http://localhost:8793/gl-helpers.html');
  await H.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(savedState(st)))}); 1`);
};
// loadView(view, ns, state, { lang }): like load(), but the app's first load is in `view` ('classic' or 'steps') whatever the
// kit's pin is (load() opens the pinned view, and a page loaded there first saves that view's state under ns); with no view the
// page opens in the kit's pinned view (a suite tagged steps({ pin: true }) in ci/suite_views.js gets the steps view, and with
// another tag the classic one). Waits for the page's load event, and the caller waits for the app with settled({ until })
H.loadView = async (view, ns, st, o = {}) => {
  await H.seed(ns, st);
  await H.go(`http://localhost:8793/test.html?ns=${ns}${o.lang ? '&lang=' + o.lang : ''}${view ? '&view=' + view : ''}`);
};
// isSteps(): whether the page shows the steps view (a suite tagged for it starts with this check, so it fails under another tag)
H.isSteps = () => H.ev(`!!(window.__cmwSteps && __cmwSteps().on)`);
// load(ns, state, extra, view, { limitMs, stallMs, origin }): the page opened with the saved state, answering once it is loaded, its
// hooks are defined and the app has built the chain of the saved state: the plane list (__cmwSteps().planes, in either view)
// holds a plane for a step (two or more: the origin plane and the step's; a saved step shown alone leaves just those two, and
// the app adopts the whole chain at once), and a state with no active step asks no plane. The app starts after the page's
// load event (software GL, a busy machine), so a read right after the load event finds an empty chain. A page not ready within the one wait (a slow load, or a document replaced while the wait ran) is waited for
// again, and one not ready within limitMs (LOAD_LIMIT_MS by default) throws, so a suite never goes on with a page still loading.
// A document whose body has stopped arriving (still "loading" with its response not finished) after stallMs (LOAD_STALL_MS by
// default) is opened again, at most LOAD_RELOADS times in all, inside the same limit. origin: the server the pages come from
const LOAD_LIMIT_MS = 60000, LOAD_WAIT_MS = 20000, LOAD_STALL_MS = 15000, LOAD_RELOADS = 2;
// pageNow(): what the page says of itself, so a stall names where it is: the document's state, the navigation's own timings (ms
// since its start; 0 where an event has not come) and how many scripts and sheets it has, and how many planes its chain has built (null before the hook answers)
const pageNow = () => H.ev(`(() => { const n = performance.getEntriesByType('navigation')[0], t = n ? Object.fromEntries(['startTime', 'responseStart', 'responseEnd', 'domInteractive', 'domContentLoadedEventEnd', 'loadEventEnd'].map((k) => [k, Math.round(n[k])])) : null; return { readyState: document.readyState, href: location.href, nav: t, scripts: document.scripts.length, sheets: document.styleSheets.length, planes: (() => { try { return __cmwSteps().planes.length; } catch (e) { return null; } })() }; })()`).catch((e) => ({ __exc: String(e && e.message || e) }));
// docStalled(): the page is still "loading" with its response not finished (its body stopped arriving)
const docStalled = async () => { const pg = await pageNow(); return pg.readyState === 'loading' && !!pg.nav && pg.nav.responseEnd === 0; };
H.load = async (ns, st, extra, viewName, opts = {}) => {
  const origin = opts.origin || 'http://localhost:8793';
  await send('Page.navigate', { url: origin + '/gl-helpers.html' }, S); await sleep(400);
  const o = savedState(st);
  await H.ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); ${extra || ''}; 1`);
  const url = origin + '/test.html?ns=' + ns + (viewName ? '&view=' + viewName : '');
  await send('Page.navigate', { url }, S);
  const want = Array.isArray(o.steps) && o.steps.some((q) => q.on !== false) ? 2 : 0;
  const ready = `document.readyState === 'complete' && typeof window.__cmwPaneStatus === 'function' && (() => { try { return __cmwSteps().planes.length >= ${want}; } catch (e) { return false; } })()`;
  const limitMs = opts.limitMs || LOAD_LIMIT_MS, stallMs = opts.stallMs || LOAD_STALL_MS, t0 = Date.now();
  let r, reloads = 0, tNav = t0;
  do {
    r = await H.settled({ max: Math.max(1, Math.min(LOAD_WAIT_MS, stallMs, limitMs - (Date.now() - t0))), until: ready });
    if (!r.ok && reloads < LOAD_RELOADS && Date.now() - tNav >= stallMs) {
      if (await docStalled()) { reloads++; tNav = Date.now(); await send('Page.navigate', { url }, S); }
    }
  } while (!r.ok && Date.now() - t0 < limitMs);
  if (!r.ok) throw new Error(`H.load: ${ns}: the page is not ready after ${limitMs} ms (${want} planes wanted; ${JSON.stringify(r)}; reloads ${reloads}; page ${JSON.stringify(await pageNow())})`);
  // (#363) the app opens any saved pattern as the phase, the one region fill a user has; the suites that seed one of
  // the renderer's other patterns (solid, checker, polar, sphere, ...: the GPU and image checks) get it through the test
  // hook, as the steps view's own draws do (once the hook is defined: a slow page may still be starting)
  H.seeded = o.pattern && o.pattern !== 'phase' ? { ns: String(ns).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), pattern: o.pattern } : null;
  await H.reseed();
  return H.ev(`({lamps: __qa.lamps()})`);
};
H.img = async (clip) => { const p = { format: 'png' }; if (clip) p.clip = Object.assign({ scale: 1 }, clip); const r = await send('Page.captureScreenshot', p, S); return require(path.join(DIR, 'png.js'))(Buffer.from(r.data, 'base64')); };
H.logs = (clear = true) => { const l = LOG.slice(); if (clear) LOG.length = 0; return l; };
H.fs = fs; H.path = path; H.DIR = DIR; H.http = require('http');

(async () => {
  const t = await send('Target.createTarget', { url: 'about:blank' });
  const a = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  S = a.sessionId;
  await send('Runtime.enable', {}, S); await send('Page.enable', {}, S); await send('Log.enable', {}, S); await send('Inspector.enable', {}, S);
  if (VENDOR) { await send('Fetch.enable', { patterns: VENDOR.PATTERNS.map((urlPattern) => ({ urlPattern })) }, S); LOG.push({ t: 'info', m: 'CMW_VENDOR=1: the CDN files from vendor/' }); }
  await H.view(1440, 900, false);
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(DIR, 'qa_inject.js'), 'utf8') }, S);
  // (#443) the steps view pinned unless a page's URL asks for ?view=classic (pin_view.js); with CMW_VIEW=classic, the
  // classic view (ci/suite_views.js: a suite tagged classic(why) or not yet ported)
  const pin = (process.env.CMW_VIEW === 'classic' ? "window.__cmwPinView = 'classic';\n" : '') + fs.readFileSync(path.join(DIR, 'pin_view.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: pin }, S);
  fs.writeFileSync(path.join(DIR, 'q', 'READY'), 'ok');
  const done = new Set();
  for (;;) {
    const files = fs.readdirSync(Q).filter((f) => /^\d+\.js$/.test(f) && !done.has(f)).sort((x, y) => parseInt(x) - parseInt(y));
    for (const f of files) {
      done.add(f);
      const body = fs.readFileSync(path.join(Q, f), 'utf8');
      let out;
      FAULTS.length = 0;
      try {
        const fn = new (Object.getPrototypeOf(async function () {}).constructor)(...Object.keys(H), body);
        out = await fn(...Object.values(H));
      } catch (e) { out = { __daemonError: String(e && e.stack || e) }; }
      const unread = FAULTS.filter((x) => !x.handled).map((x) => x.what);
      if (unread.length && out && typeof out === 'object' && !Array.isArray(out)) out.kitFaults = unread;
      fs.writeFileSync(path.join(Q, f.replace('.js', '.out')), JSON.stringify(out, null, 1));
    }
    if (fs.existsSync(path.join(Q, 'QUIT'))) { ch.kill(); process.exit(0); }
    await sleep(80);
  }
})().catch((e) => { fs.writeFileSync(path.join(Q, 'FATAL'), String(e.stack || e)); ch.kill(); process.exit(1); });
