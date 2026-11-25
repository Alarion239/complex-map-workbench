// The test hooks before the app has started (#2444): every window.__cmw* hook is set as soon as the bundle runs, but the
// page state S stays null until init(), which waits for DOMContentLoaded. A hook called in between answers not-ready
// instead of throwing: __cmwSteps() { ready: { ready: false } }, the others null. The page's start is held back here
// (its DOMContentLoaded handlers run LATE_MS later, as kit_load_cmd holds them), so the window is seconds long:
// - the hooks are defined while the app has not started (the window is there to read);
// - every __cmw* function, called with no arguments, answers and throws nothing;
// - __cmwSteps() answers { ready: { ready: false } };
// - control: once the page has started, __cmwSteps() reads the started page (its planes).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LATE_MS = 6000;
const hold = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  const add = document.addEventListener;
  document.addEventListener = function (type, fn, opt) {
    if (type !== 'DOMContentLoaded') return add.call(this, type, fn, opt);
    return add.call(this, type, () => setTimeout(fn, ${LATE_MS}), opt);
  };
})();` });
await view(1200, 800, false, false);
await go(`http://localhost:${PORT}/test.html?ns=hooksearly${Date.now()}`);
await settled({ only: true, max: 10000, until: `typeof window.__cmwSteps === 'function'` });
// (every hook, called once with no arguments, while the app has not started: what it answered, or what it threw)
const early = await ev(`(() => {
  const out = { started: !!document.querySelector('#svStrip .sv-plane'), names: [], threw: [], steps: null };
  for (const k of Object.keys(window).filter((k) => k.startsWith('__cmw') && typeof window[k] === 'function').sort()) {
    out.names.push(k);
    try { const v = window[k](); if (k === '__cmwSteps') out.steps = JSON.parse(JSON.stringify(v)); } catch (e) { out.threw.push(k + ': ' + String(e && e.message || e).slice(0, 120)); }
  }
  return out;
})()`);
info.early = { started: early.started, hooks: early.names.length, threw: early.threw.slice(0, 20), nThrew: early.threw.length, steps: early.steps };
ok('the hooks are defined before the app has started', early.names.length > 50 && !early.started, info.early);
ok('every hook answers before the app has started, none throws', early.threw.length === 0, info.early);
ok('__cmwSteps() answers not-ready before the app has started', !!early.steps && !!early.steps.ready && early.steps.ready.ready === false, early.steps);
await settled({ only: true, max: LATE_MS + 30000, until: `!!document.querySelector('#svStrip .sv-plane') && Array.isArray(__cmwSteps().planes) && __cmwSteps().planes.length > 1` });
const late = await ev(`(() => { const s = __cmwSteps(); return { planes: Array.isArray(s.planes) ? s.planes.length : null }; })()`);
info.late = late;
ok('control: once the page has started, __cmwSteps() reads it (its planes)', !!late && late.planes > 1, late);
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: hold.identifier });
return { pass: fails.length === 0, fails, info };
