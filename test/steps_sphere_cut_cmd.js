// The steps view's glide on the Sphere surface has no isolated off-colour pixels along the image of a cut: z^2 and a
// disc, Everywhere, the colour on w1, parked at u = 0.25, 0.5 and 0.75, the net and the strokes hidden. z^2's glide
// carries its cut across the globe, where the inverse pass picks the front sheet pixel by pixel; a pixel that picks the
// other sheet shows a dot of that sheet's colour (a dim red on the green and olive field). A pixel is isolated when
// it is more than ISOLATED levels from the median of its eight neighbours in some channel while those eight agree
// (their channels spread by less than SPREAD levels). The count is at most MAX_ISOLATED at each u and at rest.
// (lavapipe: 0 at rest and at each u; SwiftShader with the crack: 0, 4, 73 and 99)
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const ISOLATED = 60, SPREAD = 40, MAX_ISOLATED = 10;
// (quiet: the programs and jobs are ready, no glide or play is under way and the sphere is idle; __cmwSteps().moving is also
// true for a place parked between two planes, which is a still view, so it is not the wait)
const QUIET_UNTIL = "window.__cmwSteps && __cmwSteps().ready.ready && !__cmwSteps().anim && !__cmwSteps().play && !(window.__cmwSphere && __cmwSphere().running)";
const quiet = () => settled({
  max: 20000,
  until: QUIET_UNTIL,
});
const isolated = () => ev(`(() => {
  const c = document.getElementById('canvasL'), s = document.createElement('canvas');
  s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  const d = g.getImageData(0, 0, s.width, s.height).data, W = s.width, H = s.height, nb = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
  let n = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = 4 * (y * W + x);
    let spread = 0, off = 0;
    for (let ch = 0; ch < 3; ch++) {
      const v = nb.map(([dx, dy]) => d[4 * ((y + dy) * W + x + dx) + ch]).sort((a, b) => a - b);
      spread = Math.max(spread, v[7] - v[0]);
      off = Math.max(off, Math.abs(d[i + ch] - (v[3] + v[4]) / 2));
    }
    if (spread < ${SPREAD} && off > ${ISOLATED}) n++;
  }
  return n; })()`);
await view(1200, 800, false, false);
const ns = 'svcut' + Date.now();
await seed(ns, {
  pattern: 'phase', outline: true, lines: false, unit: false, alpha: 1, v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd0', kind: 'disc', c: [0.2, 0.6], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }], targets: [],
});
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function'` });
await ev(`__cmwSet('morphPaths', false), __cmwHideStrokes(true), __cmwSteps({ scope: 'all', surf: 'sphere', go: 0, now: true, T: 1, bare: true }), 1`);
await quiet();
R.rest = await isolated();
ok('at rest on plane z the globe has no isolated pixels', R.rest <= MAX_ISOLATED, R.rest);
R.parked = {};
for (const u of [0.25, 0.5, 0.75]) {
  await ev(`__cmwSteps({ park: ${u} }); 1`);
  await quiet();
  let g = null;
  for (let i = 0; i < 40; i++) { g = await ev('__cmwSvGlobe(0, 0)'); if (g && g.path === 'inverse') break; await sleep(250); }
  R.parked[u] = { path: g && g.path, isolated: await isolated() };
  ok(`u = ${u}: the globe is drawn by the inverse pass`, !!g && g.path === 'inverse', g);
  ok(`u = ${u}: at most ${MAX_ISOLATED} isolated pixels (the dot of the other sheet along the cut's image)`, R.parked[u].isolated <= MAX_ISOLATED, R.parked[u]);
}
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
