// The steps view's Inside regions under a cost guard that always trips: the regions' mask is not a frame the guard
// measures or demotes, so a pan leaves the guard at full resolution and shows colour only inside the regions while it
// moves. The areas past the cap of four, drawn forward, keep their fill, once their sphere meshes are built and after the pan.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'curves_kit.js'), 'utf8'))({ ev, send, go, load, shot, settled, view, fs, DIR, ok, R });
const { BASE, settle } = K;
await view(1440, 900);
const six = ['|z| < 1', '|z-1| < 0.5', '|z+1| < 0.5', '|z-i| < 0.5', '|z+i| < 0.5', '|z-2| < 0.3']
  .map((e, i) => ({ id: 'f' + i, kind: 'formula', expr: e, ci: i, visible: true }));
await load('curves-areas-guard', Object.assign({}, BASE, {
  shapes: six, targets: [], steps: [{ type: 'pown', params: { n: 2 } }],
}));
await ev(`__cmwSteps({ go: Math.max(...__cmwSteps().planes), now: true, scope: 'in' })`);
await settled({ until: `__cmwPaths().length >= 6 && __cmwPaths().every((p) => p.path !== 'pending')`, max: 20000 });
// (the forward areas' sphere meshes are built in the background: a published mesh must not take the fill away)
await settled({ until: `__cmwSphere().jobs.length === 0`, max: 20000 });
await settle();
// (the colour of the plane's pixel at world point w, read from the colour canvas)
const pixelAt = (re, im) => ev(`(() => {
  const c = document.getElementById('canvasL'), b = c.getBoundingClientRect(), p = __cmwW2S('L', ${re}, ${im}), k = c.width / b.width;
  const x = Math.round((p[0] - b.left) * k), y = Math.round((p[1] - b.top) * k);
  if (x < 0 || y < 0 || x >= c.width || y >= c.height) return null;
  const s = document.createElement('canvas'); s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  return Array.from(g.getImageData(x, y, 1, 1).data);
})()`);
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
// points outside every image: w = -5 + 4i, 3 - 4i, -5 - 4i
const OUT = [[-5, 4], [3, -4], [-5, -4]];
const paper = await pixelAt(...OUT[0]);
// (the sixth area, |z - 2| < 0.3, is the disc around w = 4, drawn forward: past the cap of four it stays filled once its
// sphere mesh is built, with no guard in play)
const first6 = await pixelAt(4.2, 0.5);
R.first = { paper, first6 };
ok('the sixth area, a forward one, stays filled once its sphere mesh is built', !!first6 && !!paper && dist(first6, paper) > 60, R.first);
await ev(`__cmwGuardOpts({ budget: 0.01, exit: 0.005 })`);
const c = await ev(`__cmwW2S('L', 0, 0)`);
const mouse = (type, x, y, buttons = 0) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 });
await mouse('mouseMoved', c[0] + 200, c[1] + 150);
await mouse('mousePressed', c[0] + 200, c[1] + 150, 1);
for (let i = 1; i <= 25; i++) {
  await mouse('mouseMoved', c[0] + 200 - 4 * i, c[1] + 150 - 2 * i, 1);
  await sleep(30);
}
// (while the pane is moving: colour only inside the regions)
const mid = [];
for (const [re, im] of OUT) mid.push(await pixelAt(re, im));
ok('mid-pan: no colour outside the regions', mid.every((p) => p && paper && dist(p, paper) < 30), { paper, mid });
await mouse('mouseReleased', c[0] + 100, c[1] + 100);
await settle();
const g = await ev('__cmwGuard()');
R.guard = g && g.L;
ok('the guard stays at full resolution for the mask', !!g && g.L.level === 0 && !g.L.half && !g.L.stuck, R.guard);
const six6 = await pixelAt(4.2, 0.5);
R.sixth = { paper, six6 };
ok('after the pan the sixth area keeps its fill', !!six6 && !!paper && dist(six6, paper) > 60, R.sixth);
const paths = (await ev('__cmwPaths()')).filter((p) => p.role === 'L').map((p) => p.path);
ok('at rest: the first four areas inverse, the fifth and sixth forward', paths.length === 6 && paths.slice(0, 4).every((p) => p === 'inverse') && paths.slice(4).every((p) => p === 'forward'), paths);
R.logs = (await logs()).filter((l) => /EXC|error/i.test(l.t));
ok('no page errors (the guarded pan)', !R.logs.length, R.logs);
return { pass: !fails.length, fails, results: R };
