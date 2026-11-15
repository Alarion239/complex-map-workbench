// A chain that __cmwExample loads is adopted at the left pane's next render, which resets the steps view's scope (for this example,
// to inside the regions: 'in').
// A suite that sets the scope right after the example races that render; H.adopted (test/cdp_kit/cdpd.js) waits for the adoption, so
// the scope set after it is kept:
//   - control: a scope set before the render, with no wait, is overwritten by the adoption (the race the wait is for). The page's
//     animation frames are held until the scope is set (and PAUSE_MS has passed, longer than any delay a slow runner makes between two
//     calls), so the control does not depend on how fast the calls are;
//   - the page's animation frames are held back LATE_MS, so that the render comes after the suite's next call: the scope set after
//     adopted() is still there when the page is quiet.
// It runs in the steps view. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const LATE_MS = 400, PAUSE_MS = 1500, EXAMPLE = 1, SET = 'all', ADOPTED = 'in';   // (SET: a scope other than the one the adoption gives)
await view(1440, 900, false, false);
await load('kitadopted' + Date.now(), { shapes: [], steps: [] });
// the scope after the example and a set of SET: with the frames held until the set (the control, no wait), or late by LATE_MS while the
// suite waits for the adoption
const HOLD = `(() => { const raf = window.requestAnimationFrame.bind(window); window.__rafOrig = window.__rafOrig || raf; window.__rafQ = []; window.requestAnimationFrame = (f) => (window.__rafQ.push(f), 0); return 1; })()`;
const LATE = `(() => { const raf = window.requestAnimationFrame.bind(window); window.__rafOrig = window.__rafOrig || raf; window.requestAnimationFrame = (f) => setTimeout(() => window.__rafOrig(f), ${LATE_MS}); return 1; })()`;
const RELEASE = `(() => { window.requestAnimationFrame = window.__rafOrig; for (const f of (window.__rafQ || []).splice(0)) window.__rafOrig(f); return 1; })()`;
const scopeAfter = async (waitForAdoption) => {
  await ev(waitForAdoption ? LATE : HOLD);
  try {
    await ev(`__cmwExample(${EXAMPLE}), 1`);
    if (waitForAdoption) await adopted(); else await sleep(PAUSE_MS);
    await ev(`__cmwSteps({ scope: '${SET}' }), 1`);
    if (!waitForAdoption) await ev(RELEASE);
    await settled({ until: `__cmwSteps().adopted`, max: 60000 });
  } finally { await ev(RELEASE); }
  await settled({ max: 30000 });
  return ev('__cmwSteps().scope');
};
info.control = await scopeAfter(false);
ok('control: a scope set right after the example, with no wait, is overwritten by its adoption', info.control === ADOPTED, info.control);
info.waited = await scopeAfter(true);
ok('the scope set after adopted() is kept', info.waited === SET, info.waited);
return { pass: fails.length === 0, fails, info };
