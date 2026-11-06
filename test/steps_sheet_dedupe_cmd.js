// All sheets draws coinciding sheets once. On the Landscape with All sheets on, the layers drawn (render3D.sheetsInfo.K)
// are the distinct sheets of the map's values:
// - √, cos, log: cos is even, so the √'s two branches coincide under each of the log's five (10 combos, 5 sheets):
//   5 layers at rest and parked in the glide to the next plane;
// - the count is the same at rest, mid-glide and near the end of the glide: no layer appears or goes;
// - √ then √ (distinct sheets): the count is the product, so nothing distinct is dropped.
// A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const drawn = () => ev('JSON.stringify((__cmwLandSheets().drawn) || null)').then((c) => JSON.parse(c));
const open = async (steps) => {
  const ns = 'sheetdedupe' + Date.now();
  await loadView('steps', ns, { shapes: [], steps, sheets: true, height: 'im' });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
  await settled({ max: 60000 });
};
const ROOT = { type: 'root', params: { n: 2 }, on: true }, LOG = { type: 'log', params: {}, on: true }, COS = { type: 'custom', params: { expr: 'cos(z)' }, on: true };
// the layers drawn at plane 0 at rest, parked at 0.5 and 0.98 of the glide to plane 1, and at plane 1 at rest
const counts = async (name, steps) => {
  await open(steps);
  const r = {};
  await rest(0); r.rest0 = (await drawn() || {}).K || 0;
  r.title = await ev('__cmwLandSheets().title.replace(/<[^>]*>/g, "")');
  await park(0.5); r.mid = (await drawn() || {}).K || 0;
  await park(0.98); r.near = (await drawn() || {}).K || 0;
  await rest(1); r.rest1 = (await drawn() || {}).K || 0;
  info[name] = r;
  return r;
};
// √, cos, log: cos is even, so the √'s two branches give the same surface under each of the log's five: 5 sheets, not 10
const a = await counts('root_cos_log', [ROOT, COS, LOG]);
ok('√, cos, log: the coinciding sheets are drawn once (5 layers at rest, not 10)', a.rest0 === 5, a);
ok('√, cos, log: the same 5 layers parked in the glide to the next plane and at that plane at rest', a.mid === 5 && a.near === 5 && a.rest1 === 5, a);
ok('√, cos, log: the pane title counts the 5 sheets drawn', /\b5 sheets\b/.test(a.title) && !/\b10 sheets\b/.test(a.title), a.title);
// √ then √: four distinct sheets, none dropped
const b = await counts('root_root', [ROOT, ROOT]);
ok('√ then √ (distinct sheets): all 4 are drawn at rest and parked in the glide', b.rest0 === 4 && b.mid === 4, b);
return { pass: !fails.length, fails, info };
