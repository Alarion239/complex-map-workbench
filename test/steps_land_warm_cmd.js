// The steps view's landing on the next plane after a rest: the rest programs of the planes a press can land on (the
// planes either side of the one shown) are made ready while it rests, so the first frame at rest on such a plane links
// none. Two one-step chains with the colour plane first, so that plane w1 at rest is drawn by the carry core: z^2 (the
// carried colour by the inverse pass) and the Douady–Hubbard map (the carried meshes, in layers below full opacity). For
// each, at rest on plane z until the view is ready and its warm jobs are done (__cmwSteps().invWarm), the thread is put on
// plane w1 at once (go 1, now) and its frame drawn:
// - no program is made from the rest to that frame (GLR.landProgs, every name);
// - the longest main-thread task from the move to the frame (a PerformanceObserver's long tasks) is at most LAND_K times
//   the second landing's in the same page, plus LAND_ADD_MS (the second landing is back on plane z and on w1 again, every
//   program made): on lavapipe at 1200 x 800 without the warm-up the first is 382-431 ms against 55-148 ms.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { wordsOff, UNHELD } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const LAND_K = 2, LAND_ADD_MS = 60;
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
  await ev(`__cmwSet('morphPaths', false), __cmwSet('sheets', false), __cmwSteps({ scope: 'all', surf: 'plane', bare: true, T: 0 }), 1`);
};
const READY = '__cmwSteps().invWarm && __cmwSteps().ready.ready && GLR.pendingLinks === 0';
const progs = () => ev("GLR.landProgs().map((x) => x.split(' ')[0])");
// (the thread put on plane i at once, its frame drawn and the page quiet; the long tasks from the move to then)
const jump = async (i) => {
  await ev(`(() => { window.__longT = []; window.__longObs = new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longT.push(Math.round(e.duration)); }); window.__longObs.observe({ entryTypes: ['longtask'] }); return 1; })()`);
  await ev(`__cmwSteps({ go: ${i}, now: true }), 1`);
  const s = await settled({ max: 120000, until: `!__cmwSteps().moving && __cmwSvX() === ${i} && ${UNHELD}` });
  await settled({ max: 30000 });
  const long = await ev('(() => { window.__longObs.disconnect(); return window.__longT; })()');
  return { ok: s.ok, long, max: Math.max(0, ...long) };
};
await view(1200, 800, false, false);
for (const [name, step] of [['z^2', { type: 'pown', params: { n: 2 } }], ['Douady–Hubbard', { type: 'dh', params: { N: 64 } }]]) {
  await open(step, `land${name.length}`);
  await jump(0);
  const r = await settled({ max: 120000, until: READY });
  ok(`${name}: plane z rests with its warm jobs done`, r.ok, r);
  const p0 = await progs();
  const first = await jump(1);
  const made = (await progs()).filter((x) => !p0.includes(x));
  await jump(0);
  await settled({ max: 120000, until: READY });
  const second = await jump(1);
  const k = info[name] = { first, second, made, warmMs: r.ms };
  ok(`${name}: the first landing on plane w1 makes no program`, first.ok && made.length === 0, k);
  ok(`${name}: the first landing's longest task is at most ${LAND_K} times the second's plus ${LAND_ADD_MS} ms`, first.ok && second.ok && first.max <= LAND_K * second.max + LAND_ADD_MS, k);
}
return { pass: fails.length === 0, fails, info };
