// A glide frame's plots under its carried colour (plane b's picture at rest, plane a's no-value colour over it) read
// nothing of u, so the steps view draws them once a glide and draws them back from a kept layer (svPlotsUnder,
// GLR.layerKeep / layerDraw). The colour layer alone (bare), the Douady–Hubbard map from plane z to w₁, Everywhere, the
// Plane surface: its points never reach the inside of the unit disc, which shows plane w₁'s picture, the plots under the
// colour.
// - Control: at u = MID the frame without plane w₁'s picture (SV.restPaint 0) differs from it at at least SHOWN_MIN
//   pixels, so the plots are on the frame and the rows below can see a stale layer;
// - the frame held at u = MID drawn from the kept layer is the one drawn with the plots fresh (SV.plotsKeep 0), not a
//   pixel more than SAME_TOL apart, and so is the frame at u = OTHER, drawn back with no fresh draw;
// - each change the plots read draws them fresh, and the frame then drawn back from the layer is the fresh frame: the
//   theme, SV.restPaint (a test hook's), the pane's size, the device pixel ratio (with the window a pixel wider: a ratio
//   alone resizes no pane), and the DH step's N edited mid-glide (its programs relink and the view draws a still frame,
//   which drops the layer). The size and ratio rows hold by GLR.layerDraw's own size check as well as by the key;
// - only the chain's signature changed: the DH step then Möbius, coloured by w₂ (T, the last plane), held between z and
//   w₁, Möbius's a edited mid-glide: the plots (plane w₁'s picture is w₂'s colour through Möbius) and the frame change,
//   nothing relinks and no still frame is drawn, and the plots are drawn fresh by the key alone;
// - at rest the layer is dropped: on a plane the view draws still, and on a plane past the colour plane (T = z), which
//   the glide's own path draws at u = 0; a glide interrupted and turned back draws the plots fresh when it is held again.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the shard ci/browser_shards.js names.
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, compare } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const MID = 0.9, OTHER = 0.6, SAME_TOL = 0, SHOWN_MIN = 2000;
const READY = 'typeof __cmwSteps === "function" && typeof __cmwTime === "function" && !!window.GLR';
await view(1440, 900, false, false);
await loadView('steps', 'plotskeep' + Date.now(), { shapes: [], steps: [{ type: 'dh', params: { N: 24 }, on: true }], sheets: false });
await settled({ max: 30000, until: READY });
await ev(`__cmwSet('morphPaths', false); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true }); 1`);
await settled({ max: 60000 });
const plots = () => ev('__cmwSteps().plots');
// the frame held at u with the kept layer on (keep 1) or the plots drawn fresh (keep 0), kept as tag; the plots' counts
// before and after
// (with the layer on, it waits for a glide frame drawn after x is set that kept a layer: after an edit that relinks, the
// first frames may be drawn still or with a program pending, and keep nothing)
const frameAt = async (u, keep, tag) => {
  const n0 = await ev('(p => p.drawn + p.kept)(__cmwSteps().plots)');
  await ev(`__cmwSteps({ plotsKeep: ${keep}, x: ${u} }); 1`);
  await settled(keep ? { max: 60000, until: `(p => p.drawn + p.kept > ${n0} && p.held)(__cmwSteps().plots)` } : { max: 60000 });
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
  await ev('__cmwSteps({ restPaint: 0 }); 1');
  await frameAt(MID, 0, 'bareB');
  await ev('__cmwSteps({ restPaint: 1 }); 1');
  await frameAt(MID, 0, 'withB');
  const shown = info.shown = await compare('bareB', 'withB');
  ok(`control: at u = ${MID} plane w₁'s picture shows on the frame (at least ${SHOWN_MIN} pixels)`, !!shown && shown.frac * shown.px >= SHOWN_MIN, shown);
  const r = info.mid = await pair(MID, 'mid');
  ok(`u = ${MID}: the plots are drawn back from the kept layer, not drawn again`, r.kept.after.kept > r.kept.before.kept && r.kept.after.drawn === r.kept.before.drawn && r.kept.after.held, r.kept);
  ok(`u = ${MID}: the frame drawn from the kept layer is the frame with the plots fresh (at most ${SAME_TOL} apart in a channel)`, same(r.cmp), r.cmp);
  const o = info.other = await pair(OTHER, 'other');
  ok(`u = ${OTHER}: the same layer serves another place of the glide, and the frame is the fresh one`, o.kept.after.drawn === o.kept.before.drawn && same(o.cmp), o);
}
// ---- each change the plots read draws them fresh once ----
const changes = [
  ['the theme', `document.documentElement.setAttribute('data-theme', 'dark'), 1`, `document.documentElement.setAttribute('data-theme', 'light'), 1`],
  ['SV.restPaint', '__cmwSteps({ restPaint: 0 }), 1', '__cmwSteps({ restPaint: 1 }), 1'],
  ['the pane\'s size', null, null],
  ['the device pixel ratio', null, null],
  ['the DH step\'s N (a relink)', `__cmwStepParam(0, 'N', 12), 1`, `__cmwStepParam(0, 'N', 24), 1`],
];
for (const [what, on, off] of changes) {
  await frameAt(MID, 1, 'pre');
  const p0 = await plots(), dpr0 = await ev('devicePixelRatio');
  if (what === 'the pane\'s size') await view(1200, 800, false, false);
  else if (what === 'the device pixel ratio') await send('Emulation.setDeviceMetricsOverride', { width: 1441, height: 900, deviceScaleFactor: dpr0 === 1 ? 2 : 1, mobile: false });
  else await ev(on);
  await settled({ max: 60000 });
  const r = info[what] = Object.assign(await pair(MID, 'chg'), { p0, dpr: [dpr0, await ev('devicePixelRatio')] });
  ok(`${what} changed mid-glide: the plots are drawn fresh`, r.kept.before.drawn > p0.drawn, r);
  ok(`${what} changed mid-glide: the next frame draws them back from the layer`, r.kept.after.drawn === r.kept.before.drawn && r.kept.after.kept > r.kept.before.kept, r.kept);
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
{
  // (plane w₁ past the colour plane z: the view draws it at rest by the glide's own path, at u = 0)
  await ev('__cmwSteps({ T: 0, go: 0, now: true }); 1');
  await settled({ max: 60000 });
  await frameAt(MID, 1, 'preT');
  await ev('__cmwSteps({ go: 1, now: true }); 1');
  await settled({ max: 60000 });
  await ev('__cmwTime(1), 1');
  await settled({ max: 60000 });
  const r = info.restT = await ev('({ plots: __cmwSteps().plots, core: __cmwSteps().core, paint: __cmwSteps().paint })');
  ok('at rest on plane w₁ past the colour plane: the glide\'s path draws it', r.core === 'carry' && r.paint === 'push', r);
  ok('at rest on plane w₁ past the colour plane: no layer is kept', r.plots.held === false, r);
}
// ---- only the chain's signature changed: the key alone draws the plots fresh ----
{
  await loadView('steps', 'plotskeepsig' + Date.now(), { shapes: [], steps: [{ type: 'dh', params: { N: 24 }, on: true }, { type: 'mobius', params: { a: '1', b: '0', c: '0', d: '1' }, on: true }], sheets: false });
  await settled({ max: 30000, until: READY });
  await ev(`__cmwSet('morphPaths', false); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true, bare: true }); 1`);
  await settled({ max: 60000 });
  const X = MID;
  await ev('__cmwSteps({ restPaint: 0 }); 1');
  await frameAt(X, 0, 'sigBare');
  await ev('__cmwSteps({ restPaint: 1 }); 1');
  await frameAt(X, 0, 'sigWith');
  const shown = info.sigShown = await compare('sigBare', 'sigWith');
  ok(`control: DH then Möbius, at x = ${X} plane w₁'s picture shows on the frame (at least ${SHOWN_MIN} pixels)`, !!shown && shown.frac * shown.px >= SHOWN_MIN, shown);
  await frameAt(X, 1, 'sigPre');
  const p0 = await plots();
  // (each frame for 30 frames after the edit: the view's core and the programs still linking)
  const trace = await ev(`new Promise((res) => { const out = []; __cmwStepParam(1, 'a', '1.2'); let n = 0; const f = () => { out.push([__cmwSteps().core, GLR.pendingLinks]); if (++n < 30) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); })`, 60000);
  await settled({ max: 60000 });
  const r = info.sig = Object.assign(await pair(X, 'sig'), { T: await ev('__cmwSteps().T'), p0, still: trace.filter((t) => t[0] !== 'carry').length, pending: Math.max(...trace.map((t) => t[1])) });
  const moved = info.sigMoved = await compare('sigPre', 'sig');
  ok(`Möbius's a edited mid-glide: the frame changed (at least ${SHOWN_MIN} pixels), so a stale layer would show`, !!moved && moved.frac * moved.px >= SHOWN_MIN, moved);
  ok('Möbius\'s a edited mid-glide: nothing relinks and no still frame is drawn', r.still === 0 && r.pending === 0, { still: r.still, pending: r.pending });
  ok('Möbius\'s a edited mid-glide (only the chain\'s signature changed): the plots are drawn fresh', r.kept.before.drawn > p0.drawn, r);
  ok('Möbius\'s a edited mid-glide: the next frame draws them back from the layer', r.kept.after.drawn === r.kept.before.drawn && r.kept.after.kept > r.kept.before.kept, r.kept);
  ok('Möbius\'s a edited mid-glide: that frame is the frame with the plots fresh', same(r.cmp), r.cmp);
}
await ev('__cmwSteps({ plotsKeep: 1, bare: false }); 1');
return { pass: fails.length === 0, fails, info };
