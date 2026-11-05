// The steps view's globe past the colour plane shows the same picture at rest and at the end of the glide into it, on a
// step with no inverse plan. Plane w1 of z^2 is the colour plane; w2 = w1 + 0.2 conj(w1) is a formula that is not
// analytic, so its glide takes the carried mesh and the globe at rest on w2 must too (as the plane does):
//  - at rest on w2 the globe's last frame is the carried mesh (__cmwSvGlobe(): path 'mesh'), in colour;
//  - at u = 0.998 of the glide w1 -> w2 it is the resting globe of w2 within a mean of 1.5 levels on the whole frame
//    (the colour lines move by a fraction of a pixel); the glide's start, u = 0.002, is the resting globe of w1
//    within a mean of 3 levels (there the mesh's triangles are compared with the exact picture, per pixel).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, results}.
const fails = [], R = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const quiet = () => settled({
  max: 20000,
  until: "window.__cmwSteps && !__cmwSteps().moving && !(window.__cmwSphere && __cmwSphere().running)",
});
const grab = (tag) => ev(`(() => { const c = document.getElementById('canvasL'), s = document.createElement('canvas');
  s.width = c.width; s.height = c.height;
  const g = s.getContext('2d', { willReadFrequently: true }); g.drawImage(c, 0, 0);
  (window.__svc = window.__svc || {})[${JSON.stringify(tag)}] = g.getImageData(0, 0, s.width, s.height).data;
  return 1;
})()`);
const differ = (a, b) => ev(`(() => {
  const A = window.__svc[${JSON.stringify(a)}], B = window.__svc[${JSON.stringify(b)}];
  let n = 0, sum = 0, sat = 0;
  for (let i = 0; i < A.length; i += 4) {
    n++;
    sum += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
    if (Math.max(B[i], B[i + 1], B[i + 2]) - Math.min(B[i], B[i + 1], B[i + 2]) > 40) sat++;
  }
  return { mean: +(sum / n).toFixed(3), coloured: +(sat / n).toFixed(4) }; })()`);
// (the last globe frame's carry path, once the programs have linked)
const pathIs = async (want) => {
  let g = null;
  for (let i = 0; i < 40; i++) { g = await ev('__cmwSvGlobe(0, 0)'); if (g && g.path === want) break; await sleep(250); }
  return g;
};
await view(1200, 800, false, false);
const ns = 'svsr' + Date.now();
await seed(ns, {
  v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, rightMode: 'image',
  shapes: [{ id: 'd1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'pown', params: { n: 2 }, on: true }, { type: 'custom', params: { expr: 'z+0.2*conj(z)', cut: 180 }, on: true }],
});
await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
await settled({ max: 60000, until: `typeof __cmwSteps === 'function' && typeof __cmwSvGlobe === 'function'` });
await ev(`__cmwSteps({ go: 1, now: true, surf: 'sphere', scope: 'all', T: 1 }); 1`); await quiet();
await grab('rest1');
await ev(`__cmwSteps({ go: 2, now: true }); 1`); await quiet();
R.rest2 = await pathIs('mesh');
await grab('rest2');
R.rest2.differ = await differ('rest1', 'rest2');
ok('at rest on w2 (no inverse plan) the globe is the carried mesh', !!R.rest2 && R.rest2.path === 'mesh', R.rest2);
ok('at rest on w2 the globe is in colour', R.rest2.differ.coloured > 0.05, R.rest2.differ);
await ev(`__cmwSteps({ x: 1.998 }); 1`); await quiet();
R.end = await pathIs('mesh');
await grab('end');
R.end.differ = await differ('rest2', 'end');
ok('just before w2 the moving globe is the carried mesh', !!R.end && R.end.path === 'mesh', R.end);
ok('just before w2 the moving globe is the resting globe of w2 (a mean within 1.5 levels)', R.end.differ.mean <= 1.5, R.end.differ);
await ev(`__cmwSteps({ go: 1, now: true }); 1`); await quiet();
await ev(`__cmwSteps({ x: 1.002 }); 1`); await quiet();
await grab('start');
R.start = { differ: await differ('rest1', 'start') };
ok('just past w1 the moving globe is the resting globe of w1 (a mean within 3 levels)', R.start.differ.mean <= 3, R.start);
R.logs = (await logs()).filter((l) => /error|exception/i.test(l.t) && !/Failed to load resource/.test(l.m)).slice(0, 5);
ok('no errors in the console', R.logs.length === 0, R.logs);
return { pass: fails.length === 0, fails, results: R };
