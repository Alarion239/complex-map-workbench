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
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ns = 'svl' + Date.now();
// zeta, a circle and a point: the circle's 600 samples go through zeta's map, the point has a label
const st = { v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0], r: 0.8, ci: 0, visible: true }, { id: 'sp', kind: 'point', p: [0.4, 0.3], ci: 1, visible: true }],
  steps: [{ type: 'zeta', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } };
const open = async () => {
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && typeof __cmwLabelStats === 'object'` }); await settle(800);
};
const ctl = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
const stats = () => ev(`(() => { const s = __cmwLabelStats; return { n: s.n, ms: s.ms, list: s.list || [] }; })()`);
const zero = () => ev(`(__cmwLabelStats.n = 0, __cmwLabelStats.ms = 0, __cmwLabelStats.list = [], 1)`);
const placed = () => ev(`__cmwLabelsPlaced()`);
const same = (a, b) => a.length === b.length && a.every((q, i) => q.text === b[i].text && Math.abs(q.x - b[i].x) < 0.6 && Math.abs(q.y - b[i].y) < 0.6);
// a glide from plane 0 to plane 1 and back, the label passes counted while it is under way
const glideCost = async () => {
  await ctl({ go: 0, now: true }); await settle(700);
  await zero();
  await ctl({ go: 1 });
  for (let i = 0; i < 120 && (await ctl({})).moving; i++) await sleep(50);
  const s = await stats();
  return { n: s.n, per: s.n ? s.ms / s.n : 0, list: s.list };
};
for (const scope of ['all', 'in']) {
  // (the plane drawn again at rest: the other scope and back; a plain requestRender is not taken as a change)
  const redraw = async () => { await ctl({ scope: scope === 'all' ? 'in' : 'all' }); await settle(500); await zero(); await ctl({ scope }); await settle(600); };
  await open();
  await ctl({ scope, go: 1, now: true }); await settle(900);
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
  await ctl({ go: 0, now: true }); await settle(700);
  const g = await glideCost();
  info[`${scope} glide`] = { n: g.n, per: +g.per.toFixed(3), list: g.list };
  // (the passes of a glide: the frames on the move, then the one it lands in, which is a pass at rest. The time of each is
  // in the info; what the check holds to is the curves a pass samples through the map, which is what the time is)
  const mv = g.list.slice(0, -1), land = g.list[g.list.length - 1] || { curves: 0 };
  ok(`${scope}: label passes ran while the view moved`, mv.length >= 2, g);
  ok(`${scope}: a pass while the view moves samples no curve`, mv.every((p) => p.curves === 0), g.list);
  ok(`${scope}: the frame the glide lands in is a pass at rest: it samples the curve`, land.curves >= 1, g.list);
  await settle(900);
  const landed = await placed();
  await redraw();
  const fresh = await placed();
  ok(`${scope}: the labels where the glide landed are the ones a fresh render gives`, same(landed, fresh) && same(fresh, A), { landed, fresh, A });
  // parked between two planes: at rest, so exact: the same as a new render of that view
  await ctl({ park: 0.5 }); await settle(900);
  const pk = await placed();
  await redraw();
  const pk2 = await placed();
  ok(`${scope}: a view parked between two planes has its labels exact`, same(pk, pk2), { pk, pk2 });
}
return { pass: fails.length === 0, fails, info };
