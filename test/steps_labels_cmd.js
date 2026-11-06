// The steps view's labels keep off no curve while the view moves, and are exact at rest (behind ?view=steps):
// - the label pass keeps the labels off the curves by sampling each curve through the plane's map, up to 600 evaluations a
//   curve. A view on the move, a glide or a scrub, places its labels with no curve
//   to keep off: its passes sample none (the perf run's sv.glide.zeta times them);
// - the frame a glide lands in, and a view parked between two planes, are at rest: their labels are the ones a fresh
//   render at that place gives (the same texts at the same places), in Everywhere and in Inside regions.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
// (waits for the page to be quiet: no glide or play under way, the panes' frames drawn; `extra` is one more condition)
const quiet = (extra) => settled({ max: 20000, until: `(() => { const s = __cmwSteps(); return !s.anim && !s.play${extra ? ' && (' + extra + ')' : ''}; })()` });
const ns = 'svl' + Date.now();
// zeta, a circle and a point: the circle's 600 samples go through zeta's map, the point has a label
const st = { v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0], r: 0.8, ci: 0, visible: true }, { id: 'sp', kind: 'point', p: [0.4, 0.3], ci: 1, visible: true },
  // (#1059) four points on the circle, where its curve runs through the labels' north-east and south-west spots: a full placement
  // moves some of them off those spots, which a pass on the move does not (it keeps the spot it had)
  ...[45, 135, 225, 315].map((deg, i) => ({ id: 'q' + i, kind: 'point', p: [0.3 + 0.8 * Math.cos(deg * Math.PI / 180), 0.8 * Math.sin(deg * Math.PI / 180)], ci: 1, visible: true }))],
  steps: [{ type: 'zeta', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
  sv: { speed: 'slow' } };   // (a glide that lasts: a slow runner draws few frames of a quick one, and the check needs frames on the move)
const open = async () => {
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && typeof __cmwLabelStats === 'object'` }); await quiet();
  // (a first glide links its shader program and draws no frame meanwhile: one there and back before anything is counted)
  await ctl({ go: 1 }); await quiet(); await ctl({ go: 0, now: true }); await quiet();
};
const ctl = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
const stats = () => ev(`(() => { const s = __cmwLabelStats; return { n: s.n, ms: s.ms, list: s.list || [] }; })()`);
const zero = () => ev(`(__cmwLabelStats.n = 0, __cmwLabelStats.ms = 0, __cmwLabelStats.list = [], 1)`);
const placed = () => ev(`__cmwLabelsPlaced()`);
// two renders of one view place a label at the same spot: the hook rounds a place to 0.1 px, and the measured text width of a
// second render can differ in its last digit, which moves a place by a few tenths of a pixel at most
const PLACE_TOLERANCE_PX = 0.6;
const same = (a, b) => a.length === b.length && a.every((q, i) => q.text === b[i].text && Math.abs(q.x - b[i].x) < PLACE_TOLERANCE_PX && Math.abs(q.y - b[i].y) < PLACE_TOLERANCE_PX);
// a glide from plane 0 to plane 1 and back, the label passes counted while it is under way
const glideCost = async () => {
  await ctl({ go: 0, now: true }); await quiet();
  await zero();
  await ctl({ go: 1 });
  await quiet();
  const s = await stats();
  return { n: s.n, per: s.n ? s.ms / s.n : 0, list: s.list };
};
for (const scope of ['all', 'in']) {
  // (the plane drawn again at rest: the other scope and back; a plain requestRender is not taken as a change)
  const redraw = async () => { await ctl({ scope: scope === 'all' ? 'in' : 'all' }); await quiet(); await zero(); await ctl({ scope }); await quiet('__cmwLabelStats.n >= 1'); };
  await open();
  await ctl({ scope, go: 1, now: true }); await quiet();
  // (this scope's first glide links its own program: one there and back, then the plane the checks start from)
  await ctl({ go: 0 }); await quiet(); await ctl({ go: 1, now: true }); await quiet();
  // a pass at rest: the plane drawn again once
  await redraw();
  const r0 = await stats();
  const restPer = r0.n ? r0.ms / r0.n : 0;
  ok(`${scope}: a pass at rest samples the curve`, r0.list.length >= 1 && r0.list.every((p) => p.curves >= 1), r0.list);
  info[`${scope} rest`] = { n: r0.n, per: +restPer.toFixed(2), list: r0.list };
  ok(`${scope}: a pass at rest runs`, r0.n >= 1, r0);
  const A = await placed();
  ok(`${scope}: the labels at rest are placed (the point's)`, A.length >= 1, A);
  // a glide to plane 0 and back to 1: moving passes are cheap, the landing's are the rest's
  await ctl({ go: 0, now: true }); await quiet();
  const g = await glideCost();
  info[`${scope} glide`] = { n: g.n, per: +g.per.toFixed(3), list: g.list };
  // (the passes of a glide: the frames on the move, then the one it lands in, which is a pass at rest. The time of each is
  // in the info; what the check holds to is the curves a pass samples through the map, which is what the time is)
  const mv = g.list.slice(0, -1), land = g.list[g.list.length - 1] || { curves: 0 };
  ok(`${scope}: label passes ran while the view moved`, mv.length >= 2, g);
  ok(`${scope}: a pass while the view moves samples no curve`, mv.every((p) => p.curves === 0), g.list);
  ok(`${scope}: the frame the glide lands in is a pass at rest: it samples the curve`, land.curves >= 1, g.list);
  await quiet();
  const landed = await placed();
  await redraw();
  const fresh = await placed();
  ok(`${scope}: the labels where the glide landed are the ones a fresh render gives`, same(landed, fresh) && same(fresh, A), { landed, fresh, A });
  // parked between two planes: at rest, so exact: the same as a new render of that view
  await ctl({ park: 0.5 }); await quiet();
  const pk = await placed();
  await redraw();
  const pk2 = await placed();
  ok(`${scope}: a view parked between two planes has its labels exact`, same(pk, pk2), { pk, pk2 });
}
// (#1059) a scrub held still between two planes (Inside regions, u = .5), then let go: the labels the held picture has, once its
// full placement ran, are the ones the release leaves: no label changes side on the release
// (a pointer held on the rail, as a user holding it: the rail's pointer events, the release is window.__svScrubUp)
const holdAt = async (x) => ev(`(() => {
    const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const i = Math.floor(${x}), cx = ns[i][0] + (ns[i + 1][0] - ns[i][0]) * (${x} - i), cy = ns[0][1];
    const ev = (type, px) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 72, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px, clientY: cy }));
    ev('pointerdown', ns[0][0] - 2); ev('pointermove', ns[0][0] + 10); ev('pointermove', cx);
    window.__holdT0 = performance.now();
    window.__svScrubUp = () => ev('pointerup', cx);
    return 1;
  })()`);
// (the held picture's full pass: a pass that samples the curves, after the picture has been still for 200 ms)
// (the hold is 200 ms: past the 120 ms still-time after which the picture gets its full placement, with the frame it takes to draw;
// the wait ends on the held pass itself, so this is the minimum, not a fixed sleep)
const HOLD_MS = 200;
await open();
await ctl({ scope: 'in', go: 0, now: true }); await quiet(); await ctl({ go: 0 }); await quiet();
await zero();
await holdAt(0.5);
await settled({ max: 30000, until: `performance.now() - window.__holdT0 >= ${HOLD_MS} && __cmwLabelStats.list.length >= 1 && __cmwLabelStats.list[__cmwLabelStats.list.length - 1].curves >= 1` });
const heldLabels = await placed();
ok('held still: the point has a label', heldLabels.length >= 1, heldLabels);
await ev('window.__svScrubUp && window.__svScrubUp(), 1');
await quiet();
const released = await placed();
ok('release: no label moves', same(heldLabels, released), { heldLabels, released });
return { pass: fails.length === 0, fails, info };
