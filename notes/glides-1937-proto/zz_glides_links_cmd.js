// (scratch harness for #1937's design study A; never committed) a six-step chain's glides in turn, each held at its
// middle the first time: how long the hold waits (links included: lavapipe and SwiftShader link synchronously), how
// many programs the page has made, and the held frame's cost
const info = {};
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { hold, grab, keep, UNHELD } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const OUT = process.env.GP_OUT, TAG = process.env.GP_TAG || 'base';
const W = +(process.env.GP_W || 900), Hh = +(process.env.GP_H || 600);
const CHAINS = {
  mixed: [{ type: 'pown', params: { n: 2 } }, { type: 'exp', params: {} }, { type: 'tan', params: {} }, { type: 'pown', params: { n: -2 } }, { type: 'joukowski', params: {} }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }],
};
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const openState = async (state, tag) => {
  const ns = `${tag}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  const r = await settled({ max: 90000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && typeof __cmwTime === "function" && !!window.GLR' });
  if (!r.ok) throw new Error('hooks not up: ' + JSON.stringify(r));
};
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); return settled({ max: 180000, until: `!__cmwSteps().moving && __cmwSvX() === ${i} && ${UNHELD}` }); };
const timeIt = async () => { const r = []; for (let i = 0; i < 3; i++) r.push(await ev('__cmwTime(2).left', 600000)); return [...r].sort((a, b) => a - b)[1]; };
await view(W, Hh, false, false);
for (const [name, ch] of Object.entries(CHAINS)) {
  const R = info[name] = { glides: [] };
  try {
    await openState({ v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps: ch.map((s) => Object.assign({ on: true }, s)) }, 'gl' + name);
    await ev(`__cmwSet('morphPaths', false), __cmwSteps({ scope: 'all', surf: 'plane' }), 1`);
    if (process.env.GP_T) await ev(`__cmwSteps({ T: ${+process.env.GP_T} }), 1`);
    if (process.env.GP_FLAGS) await ev(`${process.env.GP_FLAGS}; 1`);
    await rest(0);
    R.progs0 = await ev('GLR.landProgs().length');
    for (let b = 1; b <= ch.length; b++) {
      await rest(b - 1);
      const p0 = await ev('GLR.landProgs().length');
      const t0 = Date.now();
      const h = await hold(b - 0.5);
      const waitMs = Date.now() - t0;
      const g = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, u: g.u, why: g.reason || null }; })()');
      const ms = await timeIt();
      R.glides.push({ b, held: h.ok, waitMs, newProgs: (await ev('GLR.landProgs().length')) - p0, path: g && g.path, why: g && g.why, ms });
      await ev('window.__svScrubUp && window.__svScrubUp(), 1');
    }
    R.progs1 = await ev('GLR.landProgs().length');
  } catch (e) { R.error = String(e && e.stack || e); }
  fs.writeFileSync(path.join(OUT, `${TAG}-links-${name}.json`), JSON.stringify(R, null, 1));
}
return { pass: true, fails: [], info };
