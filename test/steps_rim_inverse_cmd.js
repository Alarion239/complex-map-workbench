// (Set to 100 % opacity: the front point's colour alone is read; the Opacity slider's 85 % default mixes the layers behind.)
// The steps view's inverse frame at the image of a path's cut is smooth, with no streaks inside: the Joukowski airfoil,
// Everywhere, the colour on w₁, parked at x = 1/4, once the tiling's fix-up has landed. The path tears along the lower
// unit semicircle, and the points just inside it land on the lower lobe's rim. Two measures of the left pane's pixels,
// at dpr 1 and 2, the grid, the outlines and the labels hidden (a gridline is a run of pixels that stands apart, and the
// largest colour step in its row):
// - the rim: along each row of a band across the lobe's left rim, the column of the largest colour step; its second
//   difference row to row, summed (a smooth rim moves a pixel or so a row; a sawtooth of the mesh's pieces jumps);
// - streaks: runs of one or two pixels, across or down, whose colour stands apart from the pixels on both sides of them
//   while those two agree (a crack between two pieces, the sheet behind showing through).
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { exampleNames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const names = exampleNames();
const ex = names.indexOf('Joukowski airfoil');
ok('the example is found', ex >= 0, names.length);
// (in CSS pixels of the left pane, at the example's view in a 1200 x 800 window: the band across the lobe's left rim,
// and the box of the lobe whose streaks are counted)
const RIM = { x0: 245, x1: 330, y0: 440, y1: 550 }, LOBE = { x0: 250, x1: 590, y0: 420, y1: 565 };
// (the limits: the measures' values on the frame are 53 and 3 at dpr 1, 105 and 1 at dpr 2; with the grid drawn, 1339
// and 610, 7265 and 1225)
const LIM = { 1: { rim: 100, streaks: 10 }, 2: { rim: 200, streaks: 20 } };
const measure = () => ev(`(() => {
  const c = document.getElementById('canvasL'), k = c.width / c.clientWidth, d = window.__heldPx.rim, W = c.width;
  const at = (x, y) => 4 * (y * W + x);
  const diff = (i, j) => Math.max(Math.abs(d[i] - d[j]), Math.abs(d[i + 1] - d[j + 1]), Math.abs(d[i + 2] - d[j + 2]));
  const R = ${JSON.stringify(RIM)}, L = ${JSON.stringify(LOBE)}, px = (v) => Math.round(v * k);
  const xs = [];
  for (let y = px(R.y0); y < px(R.y1); y++) {
    let best = -1, bx = 0;
    for (let x = px(R.x0); x < px(R.x1) - 1; x++) { const i = at(x, y), j = at(x + 1, y), s = Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]); if (s > best) { best = s; bx = x; } }
    xs.push(bx);
  }
  let rim = 0;
  for (let i = 1; i < xs.length - 1; i++) rim += Math.abs(xs[i + 1] - 2 * xs[i] + xs[i - 1]);
  let streaks = 0;
  const T = 12;
  for (let y = px(L.y0); y < px(L.y1); y++) for (let x = px(L.x0) + 1; x < px(L.x1) - 3; x++) for (const w of [1, 2]) {
    const a = at(x - 1, y);
    if (diff(a, at(x + w, y)) <= T / 2 && diff(at(x, y), a) > T && (w === 1 || diff(at(x + 1, y), a) > T)) streaks++;
  }
  for (let x = px(L.x0); x < px(L.x1); x++) for (let y = px(L.y0) + 1; y < px(L.y1) - 3; y++) for (const w of [1, 2]) {
    const a = at(x, y - 1);
    if (diff(a, at(x, y + w)) <= T / 2 && diff(at(x, y), a) > T && (w === 1 || diff(at(x, y + 1), a) > T)) streaks++;
  }
  return { rim, streaks, w: c.width, h: c.height };
})()`);
if (ex >= 0) {
  for (const dpr of [1, 2]) {
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 800, deviceScaleFactor: dpr, mobile: false });
    await go(`http://localhost:${PORT}/test.html?view=steps&ns=rim${dpr}${Date.now()}`);
    await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && typeof __cmwSvFixed === "function" && !!window.GLR' });
    await ev(`__cmwExample(${ex}); 1`);
    await adopted();
    await ev("__cmwSet('alpha', 1), 1");
    await settled({ max: 20000 });
    await ev('__cmwHideStrokes(true), 1');
    await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true, T: 1, bare: true })}); 1`);
    await settled({ max: 20000 });
    await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', park: 0.25, T: 1 })}); 1`);
    await settled({ max: 30000, until: '__cmwSvFixed()' });
    const fixed = await ev('__cmwSvFixed()');
    const st = await grab('rim');
    const m = await measure();
    info[`dpr ${dpr}`] = m;
    ok(`dpr ${dpr}: the fix-up landed and the pane settled`, fixed && st, { fixed, st });
    ok(`dpr ${dpr}: the pane is drawn at that dpr`, m.w >= 860 * dpr, m);
    ok(`dpr ${dpr}: the lower lobe's rim is smooth (no sawtooth of the mesh's pieces)`, m.rim <= LIM[dpr].rim, m);
    ok(`dpr ${dpr}: no streaks inside the lobe`, m.streaks <= LIM[dpr].streaks, m);
  }
  await view(1200, 800, false, false);
}
return { pass: fails.length === 0, fails, info };
