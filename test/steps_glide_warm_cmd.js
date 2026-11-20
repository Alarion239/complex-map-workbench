// The steps view's first glide frame after a rest (#1937, design A, PR 4): the glides of the plane shown are made ready
// while it rests (svPrestartInv: their inverse programs asked for, then each glide's frame drawn once into the GL canvas),
// so the first frame of a glide links no inverse program and waits no longer than a frame already drawn would.
// One-step chains with the colour plane first (plane w1 at rest is drawn by the inverse pass too): z^2, Joukowski, tan and
// z^-2, whose homotopy's second half (u > 1/2) has a program of its own. For each, at rest on plane z until the view is
// ready and its glides' jobs are done (__cmwSteps().invWarm), the thread held at u (held_frames.js's hold, which waits for
// the frame and its links) the first time:
// - the carried colour's warm draw (svWarmCarry's speck) counts as made (__cmwSvWarm().at) only once a GPU fence asked
//   for after it (GLR.gpuDone) has resolved: its commands run then, not in the first glide frame's copy to its pane;
// - the frame is the inverse pass's;
// - no inverse program was made from the rest to the held frame (GLR.landProgs' inv| and invS| entries);
// - the hold took at most FIRST_MS (lavapipe: 545-2655 ms before the warm-up, about 80-130 ms with it).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the exact shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, wordsOff, UNHELD } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
// a page opened in the steps view on the one-step chain step, Everywhere, the colour plane first, its labels off
const open = async (step, tag) => {
  const ns = `${tag}${Date.now()}`;
  const state = { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 },
    shapes: [{ id: 'd1', kind: 'disc', c: [0.4, 0.2], r: 0.8, ci: 0, visible: true }], steps: [Object.assign({ on: true }, step)] };
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const r = await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
  await wordsOff();
  // (the warm draw's time, its drawRegion told by svWarmCarry's arguments (the speck's map at t = 1/2 of the first step,
  // no limit), and each fence's ask and answer, kept as __warmT and __fences)
  await ev(`(() => {
    const draw = GLR.drawRegion, done = GLR.gpuDone;
    window.__warmT = null; window.__fences = [];
    GLR.drawRegion = function (res, o) { if (o && o.lim === 1e30 && o.map && o.map.mode === 1 && o.map.hi === 1 && o.map.t === 0.5) window.__warmT = performance.now(); return draw.apply(this, arguments); };
    GLR.gpuDone = function () { const f = { t0: performance.now(), t1: null }; window.__fences.push(f); return done.apply(this, arguments).then((r) => { f.t1 = performance.now(); return r; }); };
    return 1;
  })()`);
  await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane', bare: false, T: 0 }), 1`);
};
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 120000, until: `!__cmwSteps().moving && __cmwSvX() === ${i} && ${UNHELD}` }); };
const invProgs = () => ev("GLR.landProgs().filter((x) => /^invS?\\|/.test(x)).map((x) => x.split(' ')[0])");
await view(1200, 800, false, false);

const FIRST_MS = 150;
for (const [name, step, us] of [['z^2', { type: 'pown', params: { n: 2 } }, [0.25]], ['Joukowski', { type: 'joukowski' }, [0.25]], ['tan', { type: 'tan' }, [0.25]],
  ['z^-2', { type: 'pown', params: { n: -2 } }, [0.25, 0.75]]]) {
  await open(step, `warm${name}`);
  for (const u of us) {
    await rest(0);
    const r = await settled({ max: 120000, until: '__cmwSteps().invWarm && __cmwSteps().ready.ready && GLR.pendingLinks === 0' });
    ok(`${name} u = ${u}: plane z rests with its glides made ready`, r.ok, r);
    if (u === us[0]) {
      const w = info[`${name} warm draw`] = await ev(`(() => { const t = window.__warmT, at = __cmwSvWarm().at; return { drawn: t, made: at, fenced: window.__fences.some((f) => f.t0 >= t && f.t1 != null && f.t1 <= at) }; })()`);
      ok(`${name}: the carried colour's warm draw counts as made only after a fence asked for after it has resolved`, w.drawn != null && w.made >= w.drawn && w.fenced, w);
    }
    const p0 = await invProgs();
    const t0 = Date.now();
    const h = await hold(u);
    const ms = Date.now() - t0, p1 = await invProgs();
    const g = await ev('(() => { const g = __cmwSteps().glide; return g && { b: g.b, u: g.u, path: g.path, reason: g.reason }; })()');
    const k = { ms, made: p1.filter((x) => !p0.includes(x)), held: h.ok, glide: g };
    info[`${name} u=${u}`] = k;
    ok(`${name} u = ${u}: the first frame is the inverse pass's`, h.ok && !!g && g.path === 'inverse', k);
    ok(`${name} u = ${u}: the first frame makes no inverse program`, k.made.length === 0, k);
    ok(`${name} u = ${u}: the first frame waits at most ${FIRST_MS} ms`, ms <= FIRST_MS, k);
    await ev('window.__svScrubUp(), 1');
  }
}

return { pass: fails.length === 0, fails, info };
