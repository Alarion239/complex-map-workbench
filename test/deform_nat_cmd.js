// The natural paths of the deformation in the steps view (behind ?view=steps): the paths t -> H_t(z) drawn from the
// glide's own run of planes, measured in screen px, and an old straight-line save migrating:
// - a save with the removed straight-line option opens on the natural paths (no `hom`, no all at once), and its
//   Playback popover's order select is off for one step;
// - five scenes (Joukowski, a rational map, exp of a strip, a chain of three steps, a zero and a pole) park mid-glide
//   with paths drawn: 3 to 18 of them, no jump, no kink, smooth, separated, the same points at every t, and a glide over the
//   chain one run of its steps;
// - a phone-width pane keeps a few separated paths.
// The Paths toggle and the order select have their own suites (steps_paths_cmd, steps_order_cmd).
// A command file for a CDP daemon (test/cdp_kit
// README); prints { pass, fails, paths }.
const fails = [], errs = [];
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const NS = 'svnat' + Date.now();
const SV = (o) => ev(`__cmwSteps(${JSON.stringify(o)})`);
const base = (sc, extra) => Object.assign({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, pattern: 'checker' }, sc, extra);
const open = async (st, ns) => {
  await loadView('steps', ns, st, { lang: 'en' });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip')` });
};
const { S, parked } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'steps_paths_kit.js'), 'utf8'))({ ev, settled });
const zsAt = async () => JSON.stringify((await ev('__cmwMorphCache()')).zs);

// 1. an old save with the straight line: migrated to the natural paths, the order select off for one step
await view(1440, 900, false, false);
await open(base({ hom: 'linear', shapes: [{ id: 's1', kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true, visible: true }, { id: 's2', kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888, visible: true }],
  steps: [{ type: 'joukowski', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 70 } }), NS + 'old');
const p0 = await parked(0.5);
ok('old linear save: the paths of the natural run are drawn', !!p0.src && p0.on && p0.heads > 0 && !p0.src.seq, p0);
const old = await ev(`(() => { const p = __cmwP(); const s = document.querySelector('#svStrip .sv-order'); return { hom: 'hom' in p, homAll: p.homAll, order: s ? { dis: s.getAttribute('aria-disabled') === 'true', tip: s.dataset.tip } : null, homSel: !!document.getElementById('homSel') }; })()`);
ok('old linear save: no straight-line option, no all at once, the order select off for one step', !old.hom && !old.homAll && !old.homSel && old.order && old.order.dis && /two steps or more/.test(old.order.tip), old);

// 2. the paths: evenly spaced, smooth, split at cuts, the same points at every t and while a glide plays
const PA = {
  jouk: { x: 0.5, shapes: [{ id: 's1', kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }, { id: 's2', kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888 }], steps: [{ type: 'joukowski', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 70 } },
  rational: { x: 0.5, shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.5], b: [1.5, 1.5], n: 6 }], steps: [{ type: 'rational', params: { p: '1, 0, -1', q: '1, 0, 1' }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } },
  expstrip: { x: 0.5, shapes: [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 } },
  chain3: { x: 1.5, shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'pown', params: { n: 2 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } },
  zp: { x: 0.5, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.5 }], steps: [{ type: 'zp', params: { a: '1', zeros: '0.8, -0.8', poles: '0.5i' }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } },
};
const paRes = {};
for (const [id, sc] of Object.entries(PA)) {
  await open(base({ shapes: sc.shapes.map((s) => Object.assign({ visible: true }, s)), steps: sc.steps, srcView: sc.srcView, homAll: !!sc.homAll }), NS + id);
  const p = await parked(sc.x);
  await ev('await __cmwMorphSel()', 60000);
  const c = await ev('__cmwPathsCheck()');
  if (!c) { ok(`paths ${id}: a selection`, false, c); continue; }
  const zs0 = await zsAt();
  // (expstrip: X is a strip 30 px tall at this zoom; its points left of 0 all end at the wedge's apex (one end dot
  // there), those right of about 3 leave the view at once: 3 paths is the honest count. chain3: three long arcs of
  // about 570 px fill the ink cap, which holds from the second path on: 3)
  const nMin = id === 'expstrip' || id === 'chain3' ? 3 : 4;
  ok(`paths ${id}: ${nMin} to 18 paths`, c.n >= nMin && c.n <= 18, c.n);
  ok(`paths ${id}: no jump drawn (a segment's mid time within 1 px of its midpoint)`, c.jump < 1, c.jump);
  ok(`paths ${id}: no kink (segments over 1.5 px meet at under 20 degrees)`, c.kink < 0.35, c.kink);
  ok(`paths ${id}: smooth (99 % of the turning under 0.3 rad per px)`, c.turnP99 < 0.3, c.turnP99);
  ok(`paths ${id}: separated (each path at most 10 % within 0.7 dTest of another, away from the ends)`, c.sep <= 0.1, c.sep);
  ok(`paths ${id}: the moving points are at H_T(z) of their start`, p.heads >= 3 && p.err < 1.5, p);
  // the same points at every T: parked elsewhere in the run, then while a glide plays
  const xs = sc.steps.length > 1 ? [1.2, 1.8] : [0.15, 0.85];
  for (const x of xs) { await parked(x); ok(`paths ${id}: the same points at x = ${x}`, (await zsAt()) === zs0, null); }
  // a glide from the first plane to the last: the first frame mid-glide with paths drawn, kept where the wait found it
  // (the glide moves on meanwhile; the panes are never quiet during one). The run is the chain's own, with the same
  // points as parked. The glide's clock is the test hook's, 300 ms a frame (about 15 frames of a Slower glide): each
  // frame is drawn the app's way, but a runner whose frames take seconds still has frames mid-glide
  await ev(`__cmwSteps({ go: 0, now: true }), 1`);
  await settled({ max: 10000, until: `!__cmwSteps().moving` });
  await choose('#svStrip .sv-speed', 'slower');
  const last = sc.steps.length;
  await ev(`window.__svGlide = null; __cmwSteps({ clock: 300 }); __cmwSteps({ go: ${last} }), 1`);
  await settled({ panes: false, max: 30000, until: `(() => { const s = __cmwSteps(); if (s.anim && s.paths.src && s.paths.heads > 0 && s.paths.T > 0.05) window.__svGlide = { paths: s.paths, zs: JSON.stringify(__cmwMorphCache().zs), all: s.all }; return !!window.__svGlide || !s.moving; })()` });
  const pl = await ev('window.__svGlide || null');
  ok(`paths ${id}: paths are drawn mid-glide, their moving points at H_T(z)`, !!pl && pl.paths.err < 1.5, pl);
  if (pl && last === 1) ok(`paths ${id}: the same points while a glide plays`, pl.zs === zs0, null);
  if (pl && last > 1) ok(`paths ${id}: a glide over ${last} steps is one run of them`, pl.paths.src.Tend === last && pl.paths.src.seq === true && pl.paths.src.startId === true, pl.paths.src);
  await settled({ max: 30000, until: `!__cmwSteps().moving` });
  await ev('__cmwSteps({ clock: 0 }), 1');
  paRes[id] = { n: c.n, kinds: c.kinds, jump: +c.jump.toFixed(3), kink: +c.kink.toFixed(3), turnP99: +c.turnP99.toFixed(3), sep: +c.sep.toFixed(3), err: +p.err.toFixed(3) };
}

// 3. a phone-width pane keeps a few separated paths
await view(390, 844, false, true);
const R = PA.rational;
await open(base({ shapes: R.shapes.map((s) => Object.assign({ visible: true }, s)), steps: R.steps, srcView: R.srcView }), NS + 'phone');
await parked(0.5);
await ev('await __cmwMorphSel()', 60000);
const cph = await ev('__cmwPathsCheck()');
ok('paths on a phone: a few, separated', cph && cph.n >= 3 && cph.n <= 12 && cph.sep <= 0.1, cph && { n: cph.n, sep: cph.sep });
paRes.phone = cph && { n: cph.n, sep: +cph.sep.toFixed(3) };
await view(1440, 900, false, false);

errs.push(...(await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')));
ok('no exceptions or console errors', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, paths: paRes };
