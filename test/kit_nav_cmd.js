// H.nav (test/cdp_kit/cdpd.js) answers once the page it opened is there: its load event has come and, for the app's page, the app
// has started and is quiet. A slow page is waited for, not read while it loads.
//   - the CPU is throttled (a rate scaled to this machine) so that the page's load outlasts SLOW_MS (a fixed wait would read it
//     loading): after nav the document is complete;
//   - the app's start is held LATE_MS after the page's load event (its DOMContentLoaded handlers run that much later, as a
//     slow machine does): after nav the app answers, its plane list is there.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SLOW_MS = 2600, TARGET_MS = 4500, MAX_RATE = 20, LATE_MS = 4000;   // (the throttled load must take longer than SLOW_MS, or the check says nothing)
const URL = (tag) => `http://localhost:${PORT}/test.html?ns=kitnav${tag}${Date.now()}&view=steps`;
await view(1440, 900, false, false);
// (the throttle is scaled to this machine: an unthrottled nav takes `base`, and a faster machine needs a stronger slowdown; if the
// first rate is not enough, the second is twice it)
let tb = Date.now();
await nav(URL('base'));
const base = Date.now() - tb;
let rate = Math.min(MAX_RATE, Math.max(2, Math.ceil(TARGET_MS / Math.max(base, 300))));
info.base = base;
info.slow = null;
for (let i = 0; i < 2 && !(info.slow && info.slow.ms > SLOW_MS); i++) {
  await send('Emulation.setCPUThrottlingRate', { rate });
  try {
    const t0 = Date.now();
    await nav(URL('slow'));
    info.slow = { rate, readyState: await ev('document.readyState'), ms: Date.now() - t0 };
  } finally { await send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
  rate = Math.min(MAX_RATE, rate * 2);
}
ok('nav returns on a loaded page when the page is slowed (throttled so that its load outlasts a fixed wait)', info.slow.readyState === 'complete' && info.slow.ms > SLOW_MS, info.slow);
const late = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const add = document.addEventListener;
  document.addEventListener = function (type, fn, opt) {
    if (type !== 'DOMContentLoaded') return add.call(this, type, fn, opt);
    return add.call(this, type, () => setTimeout(fn, ${LATE_MS}), opt);
  };
})();` });
try {
  const t0 = Date.now();
  await nav(URL('late'));
  info.late = { planes: await ev('__cmwSteps().planes.length'), ms: Date.now() - t0 };
  ok(`nav returns once the app has started, which its page begins ${LATE_MS} ms after its load event`, typeof info.late.planes === 'number' && info.late.planes >= 1 && info.late.ms >= LATE_MS, info.late);
} finally { await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: late.identifier }); }
return { pass: fails.length === 0, fails, info };
