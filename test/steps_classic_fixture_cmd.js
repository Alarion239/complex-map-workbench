// A saved state and a link, each in the fixture files under test/fixtures/, open in the steps view on the same picture:
// the chain's planes, the place, the colour plane's scope and surface, the selected step, and the right-pane camera kept
// through a save. The fixtures and where they come from are in test/fixtures/README.md. A command file for a CDP daemon
// (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SAVE = JSON.parse(fs.readFileSync(DIR + '/../fixtures/classic_d49396c2_save.json', 'utf8'));
const LINK = fs.readFileSync(DIR + '/../fixtures/classic_d49396c2_link.txt', 'utf8').trim();
const READ = `(() => { const s = __cmwSteps(); return { on: s.on, x: s.x, T: s.T, scope: s.scope, surf: s.surf, planes: s.planes, sel: s.sel }; })()`;
const READY = "typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving";
// what the steps view must show for the classic picture (the rule of Views.svOf: X → Y with areas is Inside regions on the plane)
const WANT = { on: true, x: 0, T: 3, scope: 'in', surf: 'plane', planes: [0, 1, 2, 3], sel: 2 };
const openAt = async (url) => { await go(url); await settled({ max: 30000, until: READY }); };
// A link opens in a second load: openFigure writes the state and reloads the page. So the link read waits for that load's
// own open toast and the steps view on it, and the navigation the reload itself causes is waited through; any other error
// still fails the test (30 s deadline). The same wait as test/steps_link_migrate_cmd.js.
const NAV = /navigated or closed|is not defined/;
const reloadedFigure = async (toastText) => {
  const until = `(() => { const t = document.body && document.body.innerText || ''; return t.includes(${JSON.stringify(toastText)}) && typeof __cmwSteps === 'function' && __cmwSteps().on && !__cmwSteps().moving; })()`;
  for (let i = 0; i < 120; i++) {
    let r = null;
    try { r = await ev(until); } catch (e) { if (!NAV.test(String(e && e.message || e))) throw e; }
    if (r && r.__exc && NAV.test(String(r.__exc))) r = null;
    if (r === true) return;
    await sleep(250);
  }
  throw new Error(`the figure did not open: no "${toastText}" on the reloaded page`);
};

// (a) the link: the steps view opens it from the URL alone
{
  const ns = 'clfx' + Date.now();
  await go(`${BASE}/test.html?ns=${ns}&view=steps#cmw=${LINK}`);
  await reloadedFigure('Opened the figure from the link.');
  const got = await ev(READ);
  info.link = got;
  for (const k of Object.keys(WANT)) ok('link: ' + k, eq(got[k], WANT[k]), { k, want: WANT[k], got });
}

// (b) the save: the same state from localStorage, under the steps view. The kit's seed adds a rightMode default; the save
// has none (a view-only save), so it is set undefined (left out of the JSON).
{
  const ns = 'clfs' + Date.now();
  await loadView('classic', ns, Object.assign({}, SAVE, { rightMode: undefined }));
  await settled({ max: 15000, until: "typeof __cmwState === 'function'" });
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps`);
  const got = await ev(READ);
  info.save = got;
  for (const k of Object.keys(WANT)) ok('save: ' + k, eq(got[k], WANT[k]), { k, want: WANT[k], got });
  // the right-pane camera the classic save carried comes back in the steps view's own save
  await ev('window.dispatchEvent(new Event("pagehide")); 1');
  const key = JSON.stringify('complex-map-workbench-v1:' + ns);
  await settled({ max: 15000, panes: false, until: `(() => { const o = JSON.parse(localStorage.getItem(${key})); return !!(o && o.rightView); })()` });
  const rv = await ev(`(() => { const o = JSON.parse(localStorage.getItem(${key})); return o ? o.rightView : null; })()`);
  info.rightView = rv;
  ok('save: rightView kept', eq(rv, SAVE.rightView), rv);
}

return { pass: fails.length === 0, fails, info };
