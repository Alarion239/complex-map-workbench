// A repeated step's parked plane, Inside regions (#1472): a plane shows the image of the regions under the whole step, so
// under Newton's map for z³ − 1 repeated twenty times (gallery 28) the plane after the step is coloured at w exactly where
// some chain of twenty backward steps from w ends in the region.
// - coverage: at a grid of pixels 20 px apart, the pixel is coloured iff an independent CPU search finds a chain of
//   backward roots of N (2z³ − 3wz² + 1 = 0, Durand–Kerner in float64, depth first) from w to a point of the region, each
//   link certified by evaluating N forward on it (|N(z) − w| ≤ CHAIN_TOL (1 + |w|)); a search that hits its node cap is
//   `unresolved` and fails the row, never counts as empty. For the example's square [−2, 2]² every pixel is predicted
//   coloured (the square holds the near-pole preimages of every w);
// - a region that bites both ways, [0.6, 1.6] × [−0.5, 0.5] around the root 1 repeated twice (no pole inside, so the image
//   is a bounded set): the reference predicts some pixels coloured and some not, and the plane matches per pixel in both
//   directions, so a drawing that colours everything, or nothing, fails;
// - control: the same reference with one backward root dropped from every step must predict differently from the whole
//   one, else the rows cannot see a missing root; each row records the plane's own path (__cmwSteps().paths).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const PITCH = 20;          // px between the sampled pixels
const AXIS_OFF = 10;       // px: the grid sits between the axis lines, whose ink is not the plane's colour
const EDGE_PX = 1.5;       // px: a sample whose reference answer changes within this distance is on the image's edge and is not scored
const COLOURED = 40;       // channel spread above which a pixel counts as coloured (the plane's grey is neutral)
const CHAIN_TOL = 1e-6;    // relative error of a certified backward link
const NODE_CAP = 4e5;      // nodes of the backward search before it reads `unresolved`
const CHAIN_N = 20;        // the repeat count of the scene
const MARGIN = 0.14;       // share of the canvas, as the rulers' margin, left out of the sample
const STEP_EXPR = 'z-(z^3-1)/(3*z^2)';
const BITE_N = 2;          // the bite scene's repeat count: its image is a bounded set the grid resolves
const BITE = { a: [0.6, -0.5], b: [1.6, 0.5] };
const ready = () => settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
await view(1200, 800, false, false);
const stateFor = (rect, n) => ({ v3: true, v4: true, v5: true, v6: true, exactImages: true, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 140 },
  shapes: [{ id: 's1', kind: 'rect', a: rect.a, b: rect.b, ci: 0, visible: true }],
  steps: [{ type: 'custom', params: { expr: STEP_EXPR, cut: 180 }, on: true, repeat: { n, len: 1 } }] });
const open = async (rect, n) => {
  const ns = 'sp' + Date.now();
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  if (rect) await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(stateFor(rect, n)))}); 1`);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}&lang=en`);
  await ready();
  if (!rect) { await ev(`__cmwExample(${names.indexOf('Newton’s method for z³ − 1')}); 1`); await settled({ max: 60000, panes: false }); await ready(); }
  await ev(`__cmwSteps({ scope: 'in' }); 1`); await settled({ max: 30000, panes: false });
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: 60000, until: '!__cmwSteps().anim && !__cmwSteps().play' });
  await settled({ max: 60000, until: '__cmwSteps().ready && __cmwSteps().ready.ready' });
};
const sample = (ws) => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c.getContext('2d'), r = c.getBoundingClientRect();
  const m = Math.round(Math.min(c.width, c.height) * ${MARGIN}), out = [];
  for (const [re, im] of ${JSON.stringify(ws)}) {
    const p = __cmwW2S('L', re, im); if (!p) { out.push(null); continue; }
    const px = Math.round((p[0] - r.left) * c.width / r.width), py = Math.round((p[1] - r.top) * c.height / r.height);
    if (px < m || py < m || px >= c.width - m || py >= c.height - m) { out.push(null); continue; }
    const d = x.getImageData(px, py, 1, 1).data; out.push(Math.max(d[0], d[1], d[2]) - Math.min(d[0], d[1], d[2]) > ${COLOURED} ? 1 : 0);
  }
  return out;
})()`);
const grid = (win) => {
  const [cx, cy, s] = win, W = 1200 / 2, H = 800 / 2, ws = [];
  for (let j = -Math.floor(H / PITCH); j <= Math.floor(H / PITCH); j++) for (let i = -Math.floor(W / PITCH); i <= Math.floor(W / PITCH); i++) ws.push([cx + (i * PITCH + AXIS_OFF) / s, cy - (j * PITCH + AXIS_OFF) / s]);
  return ws;
};
// roots of 2z³ − 3wz² + 1 = 0 (Durand–Kerner)
const roots3 = (wr, wi) => {
  const a = [-1.5 * wr, -1.5 * wi], p = (zr, zi) => { const z2r = zr * zr - zi * zi, z2i = 2 * zr * zi, z3r = z2r * zr - z2i * zi, z3i = z2r * zi + z2i * zr; return [z3r + (a[0] * z2r - a[1] * z2i) + 0.5, z3i + (a[0] * z2i + a[1] * z2r)]; };
  let z = [[0.4, 0.9], [-0.9, 0.3], [0.7, -0.6]];
  for (let it = 0; it < 200; it++) z = z.map((zi, i) => {
    const f = p(zi[0], zi[1]); let dr = 1, di = 0;
    z.forEach((zj, j) => { if (j === i) return; const er = zi[0] - zj[0], ei = zi[1] - zj[1]; [dr, di] = [dr * er - di * ei, dr * ei + di * er]; });
    const q = dr * dr + di * di || 1e-300; return [zi[0] - (f[0] * dr + f[1] * di) / q, zi[1] - (f[1] * dr - f[0] * di) / q];
  });
  return z;
};
const Nfwd = (z) => { const z2r = z[0] * z[0] - z[1] * z[1], z2i = 2 * z[0] * z[1], z3r = z2r * z[0] - z2i * z[1], z3i = z2r * z[1] + z2i * z[0], dr = 3 * z2r, di = 3 * z2i, q = dr * dr + di * di; return [z[0] - ((z3r - 1) * dr + z3i * di) / q, z[1] - (z3i * dr - (z3r - 1) * di) / q]; };
const inRect = (z, R) => z[0] >= R.a[0] && z[0] <= R.b[0] && z[1] >= R.a[1] && z[1] <= R.b[1];
// the forward images' bounding boxes of a region without a pole (N^k of a grid of it, grown by 25 %): a backward link outside
// the box of its depth cannot reach the region; a region holding the pole has none
const boxes = (R, n) => {
  if (R.a[0] <= 0 && R.b[0] >= 0 && R.a[1] <= 0 && R.b[1] >= 0) return null;
  let pts = []; for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) pts.push([R.a[0] + (R.b[0] - R.a[0]) * i / 40, R.a[1] + (R.b[1] - R.a[1]) * j / 40]);
  const out = [];
  for (let k = 0; k <= n; k++) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), gx = 0.25 * (x1 - x0) + 1e-3, gy = 0.25 * (y1 - y0) + 1e-3;
    out.push({ a: [x0 - gx, y0 - gy], b: [x1 + gx, y1 + gy] });
    pts = pts.map(Nfwd);
  }
  return out;
};
// -> 1 (a certified chain into R), 0 (the search is exhausted), -1 (the node cap: unresolved); drop: the root index left out of every step
const chain = (w, R, bx, drop, n) => {
  let nodes = 0, cap = false;
  const go = (v, depth) => {
    if (depth === 0) return inRect(v, R);
    if (++nodes > NODE_CAP) { cap = true; return false; }
    const rs = roots3(v[0], v[1]).filter((_, i) => i !== drop);
    for (const z of rs) {
      const f = Nfwd(z);
      if (!(Math.hypot(f[0] - v[0], f[1] - v[1]) <= CHAIN_TOL * (1 + Math.hypot(v[0], v[1])))) continue;
      if (bx && !inRect(z, bx[depth - 1])) continue;
      if (go(z, depth - 1)) return true;
      if (cap) return false;
    }
    return false;
  };
  const r = go(w, n);
  return r ? 1 : cap ? -1 : 0;
};
const row = async (label, rect, dropRoot, reps = CHAIN_N) => {
  await open(rect, reps);
  const B = await ev('(() => { const s = __cmwSteps(); return { win: s.win, paths: s.paths, scope: s.scope }; })()');
  if (!B || !B.win) { ok(label + ': plane window', false, JSON.stringify(B)); return null; }
  const R = rect || { a: [-2, -2], b: [2, 2] }, bx = boxes(R, reps), ws = grid(B.win), got = await sample(ws);
  let n = 0, agree = 0, pred1 = 0, got1 = 0, unres = 0, edge = 0; const bad = [];
  ws.forEach((w, k) => {
    if (got[k] == null) return;
    const p = chain(w, R, bx, dropRoot, reps), e = EDGE_PX / B.win[2];
    if (p >= 0 && [[e, 0], [-e, 0], [0, e], [0, -e]].some(([dx, dy]) => chain([w[0] + dx, w[1] + dy], R, bx, dropRoot, reps) !== p)) { edge++; return; }
    if (p < 0) { unres++; return; }
    n++; pred1 += p; got1 += got[k];
    if (p === got[k]) agree++; else if (bad.length < 8) bad.push({ w: w.map((v) => +v.toFixed(3)), predicted: p, plane: got[k] });
  });
  info[label] = { samples: n, agree, predictedColoured: pred1, planeColoured: got1, unresolved: unres, edge, paths: B.paths, disagreements: bad };
  return { n, agree, pred1, got1, unres, paths: B.paths };
};
const main = await row('gallery square', null);
if (main) {
  ok('gallery square: no unresolved reference sample', main.unres === 0, main.unres);
  ok('gallery square: the reference predicts every sample coloured', main.pred1 === main.n, `${main.pred1}/${main.n}`);
  ok('gallery square: the plane colours what a chain of backward roots reaches', main.agree === main.n, `${main.agree}/${main.n} agree, plane colours ${main.got1}`);
}
const bite = await row('bite region', BITE, -1, BITE_N);
if (bite) {
  ok('bite region: no unresolved reference sample', bite.unres === 0, bite.unres);
  ok('bite region: the reference predicts both coloured and empty pixels', bite.pred1 > 0 && bite.pred1 < bite.n, `${bite.pred1}/${bite.n}`);
  ok('bite region: the plane matches the reference per pixel, both ways', bite.agree === bite.n, `${bite.agree}/${bite.n} agree ` + JSON.stringify(info["bite region"].disagreements));
}
// control: the reference with one backward root dropped must disagree with the exact plane (the row sees a missing root)
const dropped = await row('bite region, root 0 dropped', BITE, 0, BITE_N);
if (dropped && bite) ok('control: a dropped root changes the reference', dropped.agree < bite.agree || dropped.pred1 !== bite.pred1, JSON.stringify({ dropped: dropped.agree, whole: bite.agree }));
return { pass: fails.length === 0, fails, info };
