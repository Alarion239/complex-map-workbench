// A glide frame's plots under its carried colour (plane b's picture at rest, plane a's no-value colour over it) read
// nothing of u, so the steps view draws them once a glide and draws them back from a kept layer (svPlotsUnder,
// GLR.layerKeep / layerDraw). The colour layer alone (bare), z² from plane z to w₁, Everywhere, the Plane surface:
// - the frame held at u = MID drawn from the kept layer is the one drawn with the plots fresh (SV.plotsKeep 0), not a
//   pixel more than SAME_TOL apart, and so is the frame at u = OTHER, drawn back with no fresh draw;
// - each change the plots read draws them fresh once, and that frame is the fresh frame: the theme, the pane's size,
//   the device pixel ratio, and a step's parameter edited mid-glide;
// - at rest the layer is dropped, and a glide interrupted and turned back draws the plots fresh when it is held again.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const MID = 0.5, OTHER = 0.3, SAME_TOL = 0;
const READY = 'typeof __cmwSteps === "function" && typeof __cmwTime === "function" && !!window.GLR';
await view(1440, 900, false, false);
await loadView('steps', 'plotskeep' + Date.now(), { shapes: [], steps: [{ type: 'pown', params: { n: 2 }, on: true }], sheets: false });
await settled({ max: 30000, until: READY });
await ev(`__cmwSet('morphPaths', false); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true }); 1`);
await settled({ max: 60000 });
const plots = () => ev('__cmwSteps().plots');
// the frame held at u with the kept layer on (keep 1) or the plots drawn fresh (keep 0), kept as tag; the plots' counts
// before and after
const frameAt = async (u, keep, tag) => {
  await ev(`__cmwSteps({ plotsKeep: ${keep}, x: ${u} }); 1`);
  await settled({ max: 60000 });
  const before = await plots();
  await ev('__cmwTime(1), 1');
  await settled({ max: 60000 });
  ok(`${tag}: the frame is still`, !!(await grab(tag)), null);
  return { before, after: await plots() };
};
// a frame drawn from the kept layer against the same frame with the plots fresh: { kept, fresh, cmp }
const pair = async (u, tag) => {
  const kept = await frameAt(u, 1, tag);
  await frameAt(u, 0, tag + 'F');
  return { kept, cmp: await compare(tag, tag + 'F') };
};
const same = (c) => !!c && c.max <= SAME_TOL;
// ---- the first glide frame keeps the plots, the next draws them back ----
{
  await frameAt(MID, 1, 'warm');
  const r = info.mid = await pair(MID, 'mid');
  ok(`u = ${MID}: the plots are drawn back from the kept layer, not drawn again`, r.kept.after.kept > r.kept.before.kept && r.kept.after.drawn === r.kept.before.drawn && r.kept.after.held, r.kept);
  ok(`u = ${MID}: the frame drawn from the kept layer is the frame with the plots fresh (at most ${SAME_TOL} apart in a channel)`, same(r.cmp), r.cmp);
  const o = info.other = await pair(OTHER, 'other');
  ok(`u = ${OTHER}: the same layer serves another place of the glide, and the frame is the fresh one`, o.kept.after.drawn === o.kept.before.drawn && same(o.cmp), o);
}
// ---- each change the plots read draws them fresh once ----
const changes = [
  ['the theme', `document.documentElement.setAttribute('data-theme', 'dark'), 1`, `document.documentElement.setAttribute('data-theme', 'light'), 1`],
  ['the pane\'s size', null, null],
  ['the device pixel ratio', null, null],
  ['a step\'s parameter', `__cmwStepParam(0, 'n', 3), 1`, `__cmwStepParam(0, 'n', 2), 1`],
];
for (const [what, on, off] of changes) {
  await frameAt(MID, 1, 'pre');
  if (what === 'the pane\'s size') await view(1200, 800, false, false);
  else if (what === 'the device pixel ratio') await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: (await ev('devicePixelRatio')) === 1 ? 2 : 1, mobile: false });
  else await ev(on);
  await settled({ max: 60000 });
  const r = info[what] = await pair(MID, 'chg');
  ok(`${what} changed mid-glide: the plots are drawn fresh once`, r.kept.after.drawn === r.kept.before.drawn + 1, r.kept);
  ok(`${what} changed mid-glide: that frame is the frame with the plots fresh`, same(r.cmp), r.cmp);
  if (what === 'the pane\'s size' || what === 'the device pixel ratio') await view(1440, 900, false, false);
  else await ev(off);
  await settled({ max: 60000 });
}
// ---- at rest the layer is dropped; a glide turned back draws the plots fresh when held again ----
{
  await frameAt(MID, 1, 'pre');
  await ev('__cmwSteps({ go: 1, now: true }); 1');
  await settled({ max: 60000 });
  const rest = info.rest = await plots();
  ok('at rest on plane w₁ no layer is kept', rest && rest.held === false, rest);
  await ev('__cmwSteps({ go: 0 }); 1');
  await settled({ max: 2000, until: '__cmwSteps().moving' });
  await ev('__cmwSteps({ go: 1 }); 1');
  await settled({ max: 60000, until: '!__cmwSteps().moving' });
  const r = info.turned = await pair(MID, 'turned');
  ok('after a glide turned back, the frame held mid-glide is the frame with the plots fresh', same(r.cmp), r);
}
info.cost = { kept: await ev(`(__cmwSteps({ plotsKeep: 1, x: ${MID} }), __cmwTime(1), __cmwTime(4).left)`), fresh: await ev(`(__cmwSteps({ plotsKeep: 0, x: ${MID} }), __cmwTime(4).left)`) };
await ev('__cmwSteps({ plotsKeep: 1, bare: false }); 1');
return { pass: fails.length === 0, fails, info };
