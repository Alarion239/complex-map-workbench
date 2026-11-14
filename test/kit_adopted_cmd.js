// A chain that __cmwExample loads is adopted at the left pane's next render, which resets the steps view's scope (for this example,
// to inside the regions: 'in').
// A suite that sets the scope right after the example races that render; H.adopted (test/cdp_kit/cdpd.js) waits for the adoption, so
// the scope set after it is kept. The page's animation frames are held back LATE_MS, so that the render comes after the suite's
// next call:
//   - control: a scope set at once, with no wait, is overwritten by the adoption (the race the wait is for);
//   - the scope set after adopted() is still there when the page is quiet.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const LATE_MS = 400, EXAMPLE = 1, SET = 'all', ADOPTED = 'in';   // (SET: a scope other than the one the adoption gives)
await view(1440, 900, false, false);
await load('kitadopted' + Date.now(), { shapes: [], steps: [] });
const scopeAfter = async (waitForAdoption) => {
  await ev(`(() => { const raf = window.requestAnimationFrame.bind(window); window.__rafOrig = window.__rafOrig || raf; window.requestAnimationFrame = (f) => setTimeout(() => window.__rafOrig(f), ${LATE_MS}); return 1; })()`);
  try {
    await ev(`__cmwExample(${EXAMPLE}), 1`);
    if (waitForAdoption) await adopted();
    await ev(`__cmwSteps({ scope: '${SET}' }), 1`);
    await settled({ until: `__cmwSteps().adopted`, max: 60000 });
  } finally { await ev(`window.requestAnimationFrame = window.__rafOrig, 1`); }
  await settled({ max: 30000 });
  return ev('__cmwSteps().scope');
};
info.control = await scopeAfter(false);
ok('control: a scope set right after the example, with no wait, is overwritten by its adoption', info.control === ADOPTED, info.control);
info.waited = await scopeAfter(true);
ok('the scope set after adopted() is kept', info.waited === SET, info.waited);
return { pass: fails.length === 0, fails, info };
