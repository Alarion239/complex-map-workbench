// The steps view's glide on the Sphere surface carries the colour with the points, as the plane does (#846): between
// plane z and plane w1 of z^2, coloured from w1, a point z0 of plane z keeps its colour as it moves to H_u(z0). Parked
// at u = 0.25, 0.5 and 0.75:
//  - the globe's last frame drew the carried colour per pixel, through the inverse pass (__cmwSvGlobe(): path
//    'inverse': z^2's homotopy has an inverse plan);
//  - at the globe's pixel of H_u(z0) the colour's hue is the hue at z0's pixel at rest on plane z, for at least three
//    of four sample points (hue as chromaticity, each channel over their sum: the globe's light scales a colour with
//    its place on the sphere, and a sample may fall on a grid line). A cross-fade of the two planes' own globes shows a
//    blend of their colours at H_u(z0) instead.
// The ends: at u = 0.002 (the thread set there, __cmwSteps({ x }), past the park's snap) the frame is the resting globe
// of plane z, and at u = 0.998 that of plane w1, within a mean of 1.5 levels on the whole frame, as steps_glide_inverse
// checks the plane's ends (the colour lines move by a fraction of a pixel): the colour is the moving point's own, not
// a blend of two globes.
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const quiet = () => settled({
  floor: 400, max: 20000,
  until: "window.__cmwSteps && !__cmwSteps().moving && !(window.__cmwSphere && __cmwSphere().running)",
});
// (the left pane's colour at the globe's point (x, y) of the plane, read from the canvas; null off the pane)
const pixelAt = (x, y) => ev(`(() => {
  const q = __cmwGlobeXY('L', ${x}, ${y}), c = document.getElementById('canvasL');
  if (!q) return null;
  const k = c.width / c.getBoundingClientRect().width, px = Math.round(q[0] * k), py = Math.round(q[1] * k);
  if (px < 0 || py < 0 || px >= c.width || py >= c.height) return null;
  const s = document.createElement('canvas'); s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  return Array.from(g.getImageData(px, py, 1, 1).data.slice(0, 3));
})()`);
const chroma = (p) => { const t = p[0] + p[1] + p[2] || 1; return [p[0] / t, p[1] / t, p[2] / t]; };
const cdist = (p, q) => {
  const a = chroma(p), b = chroma(q);
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
};
const sat = (p) => Math.max(...p) - Math.min(...p);
await view(1200, 800, false, false);
const ns = 'svsc' + Date.now();
await send('Page.navigate', { url: `${BASE}/gl-helpers.html` }); await sleep(350);
const st = {
  v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }],
};
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
await send('Page.navigate', { url: `${BASE}/test.html?ns=${ns}&view=steps` });
const ready = `typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function'`;
for (let i = 0; i < 40 && !(await ev(ready)); i++) await sleep(250);
await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere', scope: 'all', T: 1 }); 1`); await quiet();
const Z = [[0.3, 0.3], [0.6, 0.2], [0.4, -0.2], [0.2, 0.5]];
const rest = [];
for (const [x, y] of Z) rest.push(await pixelAt(x, y));
R.rest = rest;
ok('at rest on plane z: the sample points are in colour on the globe', rest.every((p) => p && sat(p) > 40), rest);
// (the left canvas kept under a name; two kept frames' mean difference per pixel (levels of 255, the channels' mean)
// and the share of pixels that differ by more than 32)
const grab = (tag) => ev(`(() => { const c = document.getElementById('canvasL'), s = document.createElement('canvas');
  s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  (window.__svc = window.__svc || {})[${JSON.stringify(tag)}] = g.getImageData(0, 0, s.width, s.height).data;
  return 1;
})()`);
const differ = (a, b) => ev(`(() => {
  const A = window.__svc[${JSON.stringify(a)}], B = window.__svc[${JSON.stringify(b)}];
  let n = 0, m = 0, sum = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]));
    n++;
    sum += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
    if (d > 32) m++;
  }
  return { mean: +(sum / n).toFixed(3), over32: +(m / n).toFixed(5) }; })()`);
await grab('rest');
await ev(`__cmwSteps({ x: 0.002 }); 1`);
await sleep(300);
await quiet();
for (let i = 0; i < 40 && (await ev('__cmwSvGlobe(0, 0).path')) !== 'inverse'; i++) await sleep(250);
await grab('start');
R.start = { path: await ev('__cmwSvGlobe(0, 0).path'), differ: await differ('rest', 'start') };
ok('just past plane z the moving globe is the resting globe (a mean within 1.5 levels), with no blend',
  R.start.path === 'inverse' && R.start.differ.mean <= 1.5, R.start);
R.parked = {};
for (const u of [0.25, 0.5, 0.75]) {
  await ev(`__cmwSteps({ park: ${u} }); 1`);
  await sleep(300);
  await quiet();
  let g = null;
  for (let i = 0; i < 40; i++) {
    g = await ev('__cmwSvGlobe(0, 0)');
    if (g && g.path === 'inverse') break;
    await sleep(250);
  }
  const rows = [];
  for (let j = 0; j < Z.length; j++) {
    const h = await ev(`__cmwSvGlobe(${Z[j][0]}, ${Z[j][1]})`), p = h && h.w ? await pixelAt(h.w[0], h.w[1]) : null;
    rows.push({ z: Z[j], w: h && h.w, p, d: p && rest[j] ? +cdist(p, rest[j]).toFixed(3) : null });
  }
  R.parked[u] = { carried: !!(g && g.carried), u: g && g.u, rows };
  ok(`u = ${u}: the globe draws the carried colour per pixel (the inverse pass)`, !!(g && g.path === 'inverse'), g);
  const near = rows.filter((r) => r.d != null && r.d <= 0.06).length;
  ok(`u = ${u}: a point keeps its colour's hue as it moves (3 of 4 within 0.06)`, near >= 3, rows);
}
// (the other end: just before plane w1, against plane w1 at rest)
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await quiet();
await grab('rest1');
await ev(`__cmwSteps({ x: 0.998 }); 1`);
await sleep(300);
await quiet();
for (let i = 0; i < 40 && (await ev('__cmwSvGlobe(0, 0).path')) !== 'inverse'; i++) await sleep(250);
await grab('end');
R.end = { path: await ev('__cmwSvGlobe(0, 0).path'), differ: await differ('rest1', 'end') };
ok('just before plane w1 the moving globe is the resting globe of w1 (a mean within 1.5 levels on the whole frame)',
  R.end.path === 'inverse' && R.end.differ.mean <= 1.5, R.end);
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
