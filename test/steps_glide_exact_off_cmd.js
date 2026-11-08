// The steps view with Exact images off: a glide frame at the end of its step is the parked plane's frame. With the switch
// off the parked plane is drawn on the carried meshes, so a glide frame drawn by the inverse pass would pop to the mesh when
// the thread parks. The glide stays on the carried mesh instead (the glide's record, __cmwSteps().glide.path, is not
// 'inverse'), and the frame held at u = END_U differs from the parked plane's in no more pixels (by more than DIFF_TOL,
// 32/255) than the control's does, plus EXTRA_FRAC of the pane.
// The control: with Exact images on the glide is the inverse pass's frame (path 'inverse') and so is the parked plane's. Its
// own difference, the glide markers and the lines the held frame draws differently, is the baseline.
// The case is z² on two discs, the carried colour with Inside regions (steps_opacity_mesh_cmd.js's page), glided from plane 0
// to plane 1.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const DEFAULT_PORT = '8793';
const DIFF_TOL = 32;          // (compare in test/lib/held_frames.js: the largest channel difference, of 255, that counts as a different pixel)
const EXTRA_FRAC = 0.002;     // the share of the pane the exact-off frames may differ by beyond the control's baseline: 0.0008 with the glide on the carried mesh, 0.0063 with the inverse pass's frame
const VIEW_W = 1200, VIEW_H = 800;   // (the views shard's pane, as steps_glide_look_cmd.js)
const SETTLE_MAX_MS = 60000;  // the page's start-up, a rest frame and a held frame each settle within it
const END_U = 0.9999;         // the held frame's place on the rail: the glide's end, where its frame and the parked plane's differ by a fraction of a pixel
const CASES = [
  { tag: 'Exact images on (control)', exact: true, path: 'inverse' },
  { tag: 'Exact images off', exact: false, path: 'carried mesh' },
];
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, DEFAULT_PORT])[1];
const { hold, grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// z² on a disc about 0.3+0.1i (each w of its image is covered twice) and a small disc about 1.4
const openPage = async (exact) => {
  const ns = 'svexoff' + Date.now();
  const st = { v3: true, v4: true, v5: true, v6: true, exactImages: exact, alpha: 1,
    shapes: [{ id: 's2', kind: 'disc', c: [0.3, 0.1], r: 1, ci: 0, visible: true }, { id: 's3', kind: 'disc', c: [1.4, 0], r: 0.3, ci: 1, visible: true }],
    steps: [{ type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=en&view=steps` });
  await settled({ max: SETTLE_MAX_MS, until: `typeof __cmwSteps === 'function' && typeof __cmwSvX === 'function' && !!window.GLR && !!document.querySelector('#svStrip .sv-wholemap')` });
  await ev(`document.querySelector('.sv-cp').click(); 1`);
  await settled({});
  await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]').click(); 1`);
  await settled({ max: SETTLE_MAX_MS, until: `__cmwSteps().stage === 1 && !__cmwSteps().moving && __cmwSvFixed()` });
  await ev(`[...document.querySelectorAll('.pane-head button')].find((b) => b.textContent.trim() === 'Inside regions').click(); 1`);
  await settled({ max: SETTLE_MAX_MS, until: '__cmwSvFixed()' });
};
// (at rest on plane i, its frame drawn)
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: SETTLE_MAX_MS, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
await view(VIEW_W, VIEW_H, false, false);
// (the share of the pane's pixels, and their count, that two kept frames, each as __heldPx[tag], differ in by more than DIFF_TOL)
const countDiff = (a, b) => ev(`(() => { const A = __heldPx[${JSON.stringify(a)}], B = __heldPx[${JSON.stringify(b)}]; let n = 0; for (let i = 0; i < A.length; i += 4) if (Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > ${DIFF_TOL}) n++; return { n, of: A.length / 4 }; })()`);
let baseline = null;
for (const c of CASES) {
  const r = info[c.tag] = {};
  try {
    await openPage(c.exact);
    await rest(0);
    const held = (await hold(END_U)).ok, still = await grab('H');
    r.path = await ev('(() => { const g = __cmwSteps().glide; return g ? g.path : null; })()');
    await ev('window.__svScrubUp(), 1');
    await rest(1);
    const settledP = await grab('P');
    r.held = held; r.still = still; r.settledP = settledP;
    ok(`${c.tag}: the glide is drawn by the ${c.path}`, c.exact ? r.path === 'inverse' : r.path !== 'inverse', r.path);
    if (held && still && settledP) {
      r.diff = await countDiff('H', 'P');
      if (c.exact) baseline = r.diff.n;
      else ok(`${c.tag}: the frame held at u = ${END_U} differs from the parked plane's in at most ${EXTRA_FRAC * 100} % of the pane's pixels beyond the control's ${baseline}`,
        baseline != null && r.diff.n <= baseline + EXTRA_FRAC * r.diff.of, { baseline, diff: r.diff });
    } else ok(`${c.tag}: the held and the parked frames are read`, false, r);
  } catch (e) { ok(`${c.tag}: the case runs to its end`, false, String(e && e.message || e).slice(0, 300)); }
}
return { pass: fails.length === 0, fails, info };
