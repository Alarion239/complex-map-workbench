// A classic-era save and link, written by the classic build of d49396c2 (the parent of the saves PR, #436, 764274d6), open
// in the steps view on the same picture. The fixtures are text files under test/fixtures/:
//   classic_d49396c2_save.json  the build's own save of a state with three steps, a formula area, a selected step (2), a
//                               solo right pane and a right-pane camera (the build drops homRange and figMorph: they came
//                               later). It was made by opening that state in the build and taking its settled save.
//   classic_d49396c2_link.txt   the same state as a link: 1.<base64url of deflate-raw {v:1, s}>, encoded by that build's codec
//                               (identical in d49396c2 and now: params.js encodeLink).
// The classic build shows the picture as X → Y on the plane (view main xy, surface plane), so the steps view opens it at the
// last plane, coloured inside the area, with the chain's planes and the selected step kept. A command file for a CDP daemon
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

// (a) the link: the steps view opens it from the URL alone
{
  const ns = 'clfx' + Date.now();
  await openAt(`${BASE}/test.html?ns=${ns}&view=steps#cmw=${LINK}`);
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
