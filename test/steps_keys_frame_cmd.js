// The saved-state keys unitLevel, spin, compact, chev, fov and exactImages, read from a saved state in the steps view
// (#1188, #1498): what each changes on the page and, for the keys the steps view does not read, that loading one changes nothing.
// - unitLevel: true draws the Landscape's unit level plane (the frame differs from the one without it, over more than
//   MIN_CHANGED pixels of the pane);
// - spin, compact, chev, fov: the steps view reads none of them: the plane's frame and the Landscape's are the frame of the
//   page without it (a guard against one gaining an effect there);
// - exactImages, true or false: an old save's switch (exact images are always on), read and ignored: the same frames.
// Every comparison has a control: the same state loaded twice draws the same frame (at most INERT_MAX pixels differ by more than
// TOL), so a difference is the key's. A command file for a CDP daemon (test/cdp_kit README); CI runs it in the misc-3 shard (ci/browser_shards.js). Prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const TOL = 8;              // a channel's difference (of 255) from which two pixels differ
const MIN_CHANGED = 50;     // pixels of the pane a key that changes the frame changes at least
const INERT = ['spin', 'compact', 'chev', 'fov', 'exactImages'];
const INERT_MAX = 5;        // pixels a key the steps view does not read may change (the control's bound)
const REST_WAIT = 15000;    // ms: the longest the frame takes to rest once drawn
await view(1200, 800, false, false);
const STATE = (extra) => Object.assign({ v3: true, v4: true, v5: true, v6: true,
  shapes: [{ id: 's2', kind: 'disc', c: [0.3, 0.1], r: 1, ci: 0, visible: true }, { id: 's3', kind: 'disc', c: [1.4, 0], r: 0.3, ci: 1, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } }, extra);
// the page of a saved state in the steps view, left pane drawn: the plane w₁ with Inside regions ('plane'), or the Landscape ('land')
const open = async (extra, surf) => {
  const ns = 'svkeys' + Date.now() + Math.floor(Math.random() * 1e4);
  await loadView('steps', ns, STATE(extra), { lang: 'en' });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!window.GLR && !!document.querySelector('#svStrip .sv-wholemap')` });
  if (surf === 'land') {
    await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 1, now: true }); 1`);
    await settled({ max: 60000 });
  } else {
    await ev(`document.querySelector('.sv-cp').click(); 1`); await settled({});
    await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]').click(); 1`);
    await settled({ max: 15000, until: `__cmwSteps().stage === 1 && !__cmwSteps().moving && __cmwSvFixed()` });
    await ev(`document.querySelector('#svHead .sv-scope [data-v="in"]').click(); 1`);
    await settled({ max: 60000, until: `__cmwSvFixed() && (() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
  }
  await settled({ max: REST_WAIT });
  const shapes = await ev(`(__cmwFigureState() || {}).shapes ? __cmwFigureState().shapes.length : -1`);
  if (shapes !== 2) throw new Error(`the saved scene did not load (shapes: ${JSON.stringify(shapes)})`);
  const r = await ev(`(() => { const b = document.getElementById('canvasL').getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; })()`);
  const state = await ev(`(() => { const f = __cmwFigureState() || {}; return { unitLevel: f.unitLevel, spin: f.spin, compact: f.compact, chev: f.chev, fov: f.fov }; })()`);
  return { im: await img(r), state };
};
// the pixels of the two frames that differ by more than TOL in some channel
const changed = (a, b) => {
  const A = a.data || a, B = b.data || b; let n = 0;
  for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > TOL) n++;
  return n;
};
for (const surf of ['plane', 'land']) {
  const base = await open({}, surf), again = await open({}, surf);
  const control = changed(base.im, again.im);
  info[surf] = { control };
  ok(`${surf}: the same state loaded twice draws the same frame (the control)`, control <= INERT_MAX, control);
  if (surf === 'land') {
    const p = await open({ unitLevel: true }, surf);
    info[surf].unitLevel = changed(base.im, p.im);
    ok(`${surf}: unitLevel true is what the state carries`, p.state.unitLevel === true && !base.state.unitLevel, [p.state.unitLevel, base.state.unitLevel]);
    ok(`${surf}: unitLevel true changes the frame (over ${MIN_CHANGED} pixels)`, info[surf].unitLevel > MIN_CHANGED, info[surf].unitLevel);
  }
  for (const k of INERT) {
    for (const v of [true, false]) {
      const p = await open({ [k]: v }, surf);
      const n = changed(base.im, p.im);
      info[surf][k + String(v)] = n;
      // DELETE row in #622: remove this check with the key.
      ok(`${surf}: ${k} ${v} draws the frame without it (not over the control)`, n <= INERT_MAX, n);
    }
  }
}
if (process.env.CMW_PRINT) fs.writeFileSync(process.env.CMW_PRINT, JSON.stringify({ info, fails }));
return { pass: fails.length === 0, fails, info };
