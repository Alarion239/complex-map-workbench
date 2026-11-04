// The steps view's glide on the Sphere surface carries the colour with the points, as the plane does (#846): between
// plane z and plane w1 of z^2, coloured from w1, a point z0 of plane z keeps its colour as it moves to H_u(z0). Parked
// at u = 0.25, 0.5 and 0.75:
//  - the globe's last frame drew the carried colour (__cmwSvGlobe().carried);
//  - at the globe's pixel of H_u(z0) the colour's hue is the hue at z0's pixel at rest on plane z, for at least three of
//    four sample points (hue as chromaticity, each channel over their sum: the globe's light scales a colour with its
//    place on the sphere, and a sample may fall on a grid line). A cross-fade of the two planes' own globes shows a
//    blend of their colours at H_u(z0) instead.
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
const cdist = (p, q) => { const a = chroma(p), b = chroma(q); return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]); };
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
for (let i = 0; i < 40 && !(await ev(`typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function'`)); i++) await sleep(250);
await ev(`__cmwSteps({ go: 0, now: true, surf: 'sphere', scope: 'all', T: 1 }); 1`); await quiet();
const Z = [[0.3, 0.3], [0.6, 0.2], [0.4, -0.2], [0.2, 0.5]];
const rest = [];
for (const [x, y] of Z) rest.push(await pixelAt(x, y));
R.rest = rest;
ok('at rest on plane z: the sample points are in colour on the globe', rest.every((p) => p && sat(p) > 40), rest);
R.parked = {};
for (const u of [0.25, 0.5, 0.75]) {
  await ev(`__cmwSteps({ park: ${u} }); 1`);
  await sleep(300);
  await quiet();
  let g = null;
  for (let i = 0; i < 40; i++) { g = await ev('__cmwSvGlobe(0, 0)'); if (g && g.carried) break; await sleep(250); }
  const rows = [];
  for (let j = 0; j < Z.length; j++) {
    const h = await ev(`__cmwSvGlobe(${Z[j][0]}, ${Z[j][1]})`), p = h && h.w ? await pixelAt(h.w[0], h.w[1]) : null;
    rows.push({ z: Z[j], w: h && h.w, p, d: p && rest[j] ? +cdist(p, rest[j]).toFixed(3) : null });
  }
  R.parked[u] = { carried: !!(g && g.carried), u: g && g.u, rows };
  ok(`u = ${u}: the globe draws the carried colour`, !!(g && g.carried), g);
  ok(`u = ${u}: a point keeps its colour's hue as it moves (3 of 4 within 0.06)`, rows.filter((r) => r.d != null && r.d <= 0.06).length >= 3, rows);
}
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
