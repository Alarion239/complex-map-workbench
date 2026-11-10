// A repeated step's parked plane, Inside regions (#1472): a plane shows the image of the regions under the whole step, so
// under Newton's map for z³ − 1 repeated twenty times (gallery 28) the plane after the step is coloured at w exactly where
// some chain of twenty backward steps from w ends in the region.
// - coverage: at a grid of pixels 20 px apart, the pixel is coloured iff an independent CPU search finds a chain of
//   backward roots of N (2z³ − 3wz² + 1 = 0, Durand–Kerner in float64, depth first, every root visited) from w to a point of
//   the region. A root set is certified (pairwise distinct, small residual, Vieta's sum and product) and each link is
//   certified by evaluating N forward on it (|N(z) − w| ≤ CHAIN_TOL (1 + |w|)); a root set or link that does not certify,
//   or a search that hits its node cap, is `unresolved` and fails the row, never counts as empty. Samples whose answer
//   changes within EDGE_PX of the pixel are the image's edge, are counted, and are at most EDGE_MAX_SHARE of a row. For the example's square [−2, 2]² every pixel is predicted
//   coloured (the square holds the near-pole preimages of every w);
// - a region that bites both ways, [0.6, 1.6] × [−0.5, 0.5] around the root 1 repeated twice (no pole inside, so the image
//   is a bounded set): the reference predicts some pixels coloured and some not, and the plane matches per pixel in both
//   directions, so a drawing that colours everything, or nothing, fails;
// - control: the same reference with one backward root dropped from every step must predict differently from the whole
//   one, else the rows cannot see a missing root; each row records the plane's own path (__cmwSteps().paths).
// A sample is coloured when its pixel lies nearer the same plane drawn Everywhere (scope 'all') than the paper (the plane
// with no region); one within AMBIG_TOL of both (the colour plane's own light rings, near the paper) is ambiguous, not
// scored, counted, and at most FAINT_MAX_SHARE of a row.
// - the renderer's own unresolved pixels: the gallery plane holds none of the grey no-value hatch (#1444's measure), and,
//   as its control, a search starved to STARVED_NODES root solves (__cmwRept({ nodes })) hatches most of it; each row's
//   info carries the CPU twin's root solves and pruned children at its samples (__cmwRept({ ws }), info only).
// A command file for a CDP daemon (test/cdp_kit README). Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const PITCH = 20;          // px between the sampled pixels
const AXIS_OFF = 10;       // px: the grid sits between the axis lines, whose ink is not the plane's colour
const EDGE_PX = 1.5;       // px: a sample whose reference answer changes within this distance is on the image's edge and is not scored
const EDGE_MAX_SHARE = 0.05;   // most samples of a row that may be unscored edge samples
const AMBIG_TOL = 24;      // RGB distance: a pixel whose distances to the Everywhere colour and to the paper differ by less is ambiguous
const FAINT_MAX_SHARE = 0.05;   // most samples of a row that may be ambiguous
// the grey no-value hatch (#1444's measure): the channels within HATCH_SPREAD of each other, between HATCH_LO and HATCH_HI
const HATCH_SPREAD = 3, HATCH_LO = 100, HATCH_HI = 130;
const STARVED_NODES = 5;   // root solves per pixel of the control's starved search (the gallery needs 20)
const STARVED_MIN_SHARE = 0.5;   // least share of the plane's pixels the starved search hatches
const CHAIN_TOL = 1e-6;    // relative error of a certified backward link
const NODE_CAP = 4e5;      // nodes of the backward search before it reads `unresolved`
const CHAIN_N = 20;        // the repeat count of the scene
const REPEAT_LEN = 1;      // steps in the repeated block
const MARGIN = 0.14;       // share of the canvas, as the rulers' margin, left out of the sample
const STEP_EXPR = 'z-(z^3-1)/(3*z^2)';
const CUT_DEG = 180;       // the formula step's cut direction
const BITE_N = 2;          // the bite scene's repeat count: its image is a bounded set the grid resolves
const BITE = { a: [0.6, -0.5], b: [1.6, 0.5] };
const SQUARE = { a: [-2, -2], b: [2, 2] };   // the gallery example's region
const VIEW_W = 1200, VIEW_H = 800, VIEW_SCALE = 140;   // px: the page, and the scene's px per unit
const NEXT_ID = 50;        // the state's next shape id
const SETTLE_LONG = 60000, SETTLE_SHORT = 30000;   // ms: the waits for the page and for the plane
const LIST_MAX = 8;        // disagreements listed in a failure
// the cubic of one backward step, N(z) = w ⇔ 2z³ − 3wz² + 1 = 0 (CUBIC_A = 3/2 per unit of w, CUBIC_C = 1/2 of the monic form)
const CUBIC_A = 1.5, CUBIC_C = 0.5, ROOTS = 3, TINY = 1e-300;
const DK_ITER = 200, DK_START = [[0.4, 0.9], [-0.9, 0.3], [0.7, -0.6]];
const WEAK_ITER = 3;       // Durand–Kerner passes of the control: too few to certify any root set
const ROOT_SEP = 1e-12;    // smallest relative distance between two certified roots
const ROOT_RES = 1e-9;     // relative residual a certified root may have
const VIETA_TOL = 1e-9;    // relative error of the roots' sum and product
const CONTROL_SAMPLES = 20;   // grid samples the weak-iteration control reads
const ready = () => settled({ max: SETTLE_LONG, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
await view(VIEW_W, VIEW_H, false, false);
const stateFor = (rect, n) => ({ v3: true, v4: true, v5: true, v6: true, exactImages: true, nextId: NEXT_ID, focus: 0, srcView: { cx: 0, cy: 0, s: VIEW_SCALE },
  shapes: rect === 'paper' ? [] : [{ id: 's1', kind: 'rect', a: rect.a, b: rect.b, ci: 0, visible: true }],
  steps: [{ type: 'custom', params: { expr: STEP_EXPR, cut: CUT_DEG }, on: true, repeat: { n, len: REPEAT_LEN } }] });
const open = async (rect, n) => {
  const ns = 'sp' + Date.now();
  await go(`http://localhost:${PORT}/gl-helpers.html`); await settled({ panes: false });
  if (rect) await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(stateFor(rect, n)))}); 1`);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}&lang=en`);
  await ready();
  if (!rect) { await ev(`__cmwExample(${names.indexOf('Newton’s method for z³ − 1')}); 1`); await settled({ max: SETTLE_LONG, panes: false }); await ready(); }
  await ev(`__cmwSteps({ scope: 'in' }); 1`); await settled({ max: SETTLE_SHORT, panes: false });
  await ev(`__cmwSteps({ go: 1, now: true }); 1`); await settled({ max: SETTLE_LONG, until: '!__cmwSteps().anim && !__cmwSteps().play' });
  await settled({ max: SETTLE_LONG, until: '__cmwSteps().ready && __cmwSteps().ready.ready' });
};
const sample = (ws) => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], x = c.getContext('2d'), r = c.getBoundingClientRect();
  const m = Math.round(Math.min(c.width, c.height) * ${MARGIN}), out = [];
  for (const [re, im] of ${JSON.stringify(ws)}) {
    const p = __cmwW2S('L', re, im); if (!p) { out.push(null); continue; }
    const px = Math.round((p[0] - r.left) * c.width / r.width), py = Math.round((p[1] - r.top) * c.height / r.height);
    if (px < m || py < m || px >= c.width - m || py >= c.height - m) { out.push(null); continue; }
    const d = x.getImageData(px, py, 1, 1).data; out.push([d[0], d[1], d[2]]);
  }
  return out;
})()`);
// the paper at plane points ws: the same chain and view with no region (every pixel the paper and its grid), cached per window
const papers = new Map();
const paperAt = async (win, reps, ws) => {
  const key = JSON.stringify([win, reps]);
  if (!papers.has(key)) {
    await open('paper', reps);
    const W = await ev('__cmwSteps().win');
    papers.set(key, JSON.stringify(W) === JSON.stringify(win) ? await sample(ws) : ws.map(() => null));
  }
  return papers.get(key);
};
const grid = (win) => {
  const [cx, cy, s] = win, W = VIEW_W / 2, H = VIEW_H / 2, ws = [];
  for (let j = -Math.floor(H / PITCH); j <= Math.floor(H / PITCH); j++) for (let i = -Math.floor(W / PITCH); i <= Math.floor(W / PITCH); i++) ws.push([cx + (i * PITCH + AXIS_OFF) / s, cy - (j * PITCH + AXIS_OFF) / s]);
  return ws;
};
// the roots of 2z³ − 3wz² + 1 = 0 by Durand–Kerner, certified: pairwise distinct, each with a small residual, and the sum and
// product of Vieta; null when any of that fails (the search then reads `unresolved`, it never skips a root)
const roots3 = (wr, wi, iters = DK_ITER) => {
  const a = [-CUBIC_A * wr, -CUBIC_A * wi], p = (zr, zi) => { const z2r = zr * zr - zi * zi, z2i = 2 * zr * zi, z3r = z2r * zr - z2i * zi, z3i = z2r * zi + z2i * zr; return [z3r + (a[0] * z2r - a[1] * z2i) + CUBIC_C, z3i + (a[0] * z2i + a[1] * z2r)]; };
  let z = DK_START.map((q) => q.slice());
  for (let it = 0; it < iters; it++) z = z.map((zi, i) => {
    const f = p(zi[0], zi[1]); let dr = 1, di = 0;
    z.forEach((zj, j) => { if (j === i) return; const er = zi[0] - zj[0], ei = zi[1] - zj[1]; [dr, di] = [dr * er - di * ei, dr * ei + di * er]; });
    const q = dr * dr + di * di || TINY; return [zi[0] - (f[0] * dr + f[1] * di) / q, zi[1] - (f[1] * dr - f[0] * di) / q];
  });
  const mod = (q) => Math.hypot(q[0], q[1]), big = Math.max(...z.map(mod));
  if (z.some((q) => !Number.isFinite(q[0]) || !Number.isFinite(q[1]))) return null;
  for (let i = 0; i < ROOTS; i++) {
    const r = p(z[i][0], z[i][1]);
    if (mod(r) > ROOT_RES * (2 * mod(z[i]) ** 3 + 3 * Math.hypot(wr, wi) * mod(z[i]) ** 2 + 1)) return null;
    for (let j = i + 1; j < ROOTS; j++) if (Math.hypot(z[i][0] - z[j][0], z[i][1] - z[j][1]) <= ROOT_SEP * (1 + big)) return null;
  }
  const sr = z[0][0] + z[1][0] + z[2][0], si = z[0][1] + z[1][1] + z[2][1];
  const m01 = [z[0][0] * z[1][0] - z[0][1] * z[1][1], z[0][0] * z[1][1] + z[0][1] * z[1][0]], pr = m01[0] * z[2][0] - m01[1] * z[2][1], pi = m01[0] * z[2][1] + m01[1] * z[2][0];
  if (Math.hypot(sr - CUBIC_A * wr, si - CUBIC_A * wi) > VIETA_TOL * (1 + CUBIC_A * Math.hypot(wr, wi) + ROOTS * big)) return null;
  if (Math.hypot(pr + CUBIC_C, pi) > VIETA_TOL * (1 + CUBIC_C + big ** ROOTS)) return null;
  return z;
};
const Nfwd = (z) => { const z2r = z[0] * z[0] - z[1] * z[1], z2i = 2 * z[0] * z[1], z3r = z2r * z[0] - z2i * z[1], z3i = z2r * z[1] + z2i * z[0], dr = 3 * z2r, di = 3 * z2i, q = dr * dr + di * di; return [z[0] - ((z3r - 1) * dr + z3i * di) / q, z[1] - (z3i * dr - (z3r - 1) * di) / q]; };
const inRect = (z, R) => z[0] >= R.a[0] && z[0] <= R.b[0] && z[1] >= R.a[1] && z[1] <= R.b[1];
// -> 1 (a certified chain into R), 0 (the search is exhausted: every root of every step visited), -1 (unresolved: the node cap, or a
// root set that does not certify); drop: the root index left out of every step; iters: Durand–Kerner passes
const chain = (w, R, drop, n, iters = DK_ITER) => {
  let nodes = 0, bad = false;
  const go = (v, depth) => {
    if (depth === 0) return inRect(v, R);
    if (++nodes > NODE_CAP) { bad = true; return false; }
    const all = roots3(v[0], v[1], iters);
    if (!all) { bad = true; return false; }
    for (const [i, z] of all.entries()) {
      if (i === drop) continue;
      const f = Nfwd(z);
      if (!(Math.hypot(f[0] - v[0], f[1] - v[1]) <= CHAIN_TOL * (1 + Math.hypot(v[0], v[1])))) { bad = true; return false; }
      if (go(z, depth - 1)) return true;
      if (bad) return false;
    }
    return false;
  };
  const r = go(w, n);
  return r ? 1 : bad ? -1 : 0;
};
const row = async (label, rect, dropRoot, reps = CHAIN_N) => {
  await open(rect, reps);
  const B = await ev('(() => { const s = __cmwSteps(); return { win: s.win, paths: s.paths, scope: s.scope }; })()');
  if (!B || !B.win) { ok(label + ': plane window', false, JSON.stringify(B)); return null; }
  const R = rect || SQUARE, ws = grid(B.win), pin = await sample(ws);
  const twin = await ev(`__cmwRept ? __cmwRept({ ws: ${JSON.stringify(ws)} }) : null`);
  await ev(`__cmwSteps({ scope: 'all' }); 1`); await settled({ max: SETTLE_LONG, panes: true });
  const pall = await sample(ws), pap = await paperAt(B.win, reps, ws);
  // coloured: nearer the Everywhere colour than the paper; null: off the canvas, or ambiguous (FAINT)
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  let faint = 0;
  const got = pin.map((c, k) => {
    if (!c || !pall[k] || !pap[k]) return null;
    const da = dist(c, pall[k]), dp = dist(c, pap[k]);
    if (Math.abs(da - dp) < AMBIG_TOL) { faint++; return null; }
    return da < dp ? 1 : 0;
  });
  let n = 0, agree = 0, pred1 = 0, got1 = 0, unres = 0, edge = 0; const bad = [];
  ws.forEach((w, k) => {
    if (got[k] == null) return;
    const p = chain(w, R, dropRoot, reps), e = EDGE_PX / B.win[2];
    if (p < 0) { unres++; return; }
    if ([[e, 0], [-e, 0], [0, e], [0, -e]].some(([dx, dy]) => chain([w[0] + dx, w[1] + dy], R, dropRoot, reps) !== p)) { edge++; return; }
    n++; pred1 += p; got1 += got[k];
    if (p === got[k]) agree++; else if (bad.length < LIST_MAX) bad.push({ w: w.map((v) => +v.toFixed(3)), predicted: p, plane: got[k] });
  });
  info[label] = { samples: n, agree, predictedColoured: pred1, planeColoured: got1, unresolved: unres, edge, faint, twin, paths: B.paths, disagreements: bad };
  return { n, agree, pred1, got1, unres, edge, faint, ws, win: B.win, paths: B.paths };
};
const main = await row('gallery square', null);
if (main) {
  ok('gallery square: no unresolved reference sample', main.unres === 0, main.unres);
  ok('gallery square: edge samples are few', main.edge <= EDGE_MAX_SHARE * (main.n + main.edge + main.unres), `${main.edge} edge of ${main.n + main.edge + main.unres}`);
  ok('gallery square: the reference predicts every sample coloured', main.pred1 === main.n, `${main.pred1}/${main.n}`);
  ok('gallery square: the plane colours what a chain of backward roots reaches', main.agree === main.n, `${main.agree}/${main.n} agree, plane colours ${main.got1}`);
  ok('gallery square: ambiguous samples are few', main.faint <= FAINT_MAX_SHARE * (main.n + main.edge + main.unres + main.faint), `${main.faint} ambiguous`);
}
// the renderer's own unresolved pixels: the grey no-value hatch over the plane canvas (#1444's measure)
const hatchCount = () => ev(`(() => {
  const cs = [...document.querySelectorAll('#plotL canvas')].sort((p, q) => q.width * q.height - p.width * p.height), c = cs[0], d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let h = 0;
  for (let i = 0; i < d.length; i += 4) if (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) <= ${HATCH_SPREAD} && d[i] >= ${HATCH_LO} && d[i] <= ${HATCH_HI}) h++;
  return { hatch: h, pixels: d.length / 4 };
})()`);
{
  await open(null, CHAIN_N);
  const h0 = await hatchCount();
  ok('gallery square: the plane draws no unresolved hatch', h0.hatch === 0, h0);
  const hooked = await ev('typeof __cmwRept === "function"');
  if (hooked) { await ev(`__cmwRept({ nodes: ${STARVED_NODES} }); 1`); await settled({ max: SETTLE_LONG, panes: true }); }
  const h1 = await hatchCount();
  if (hooked) { await ev('__cmwRept({ nodes: 0 }); 1'); await settled({ max: SETTLE_LONG, panes: true }); }
  info['starved search'] = Object.assign({ nodes: STARVED_NODES, hooked }, h1);
  ok(`control: a search starved to ${STARVED_NODES} root solves hatches at least ${STARVED_MIN_SHARE * 100} % of the plane`, hooked && h1.hatch >= STARVED_MIN_SHARE * h1.pixels, h1);
}
const bite = await row('bite region', BITE, -1, BITE_N);
if (bite) {
  ok('bite region: no unresolved reference sample', bite.unres === 0, bite.unres);
  ok('bite region: edge samples are few', bite.edge <= EDGE_MAX_SHARE * (bite.n + bite.edge + bite.unres), `${bite.edge} edge of ${bite.n + bite.edge + bite.unres}`);
  ok('bite region: the reference predicts both coloured and empty pixels', bite.pred1 > 0 && bite.pred1 < bite.n, `${bite.pred1}/${bite.n}`);
  ok('bite region: the plane matches the reference per pixel, both ways', bite.agree === bite.n, `${bite.agree}/${bite.n} agree ` + JSON.stringify(info["bite region"].disagreements));
  ok('bite region: ambiguous samples are few', bite.faint <= FAINT_MAX_SHARE * (bite.n + bite.edge + bite.unres + bite.faint), `${bite.faint} ambiguous`);
}
// control: the reference with one backward root dropped must disagree with the exact plane (the row sees a missing root)
const dropped = await row('bite region, root 0 dropped', BITE, 0, BITE_N);
if (dropped && bite) ok('control: a dropped root changes the reference', dropped.agree < bite.agree || dropped.pred1 !== bite.pred1, JSON.stringify({ dropped: dropped.agree, whole: bite.agree }));
// control: with too few Durand–Kerner passes no root set certifies, and the reference reads unresolved (never a wrong answer)
if (bite) {
  const weak = bite.ws.slice(0, CONTROL_SAMPLES).map((w) => chain(w, BITE, -1, BITE_N, WEAK_ITER));
  ok('control: ' + WEAK_ITER + ' Durand–Kerner passes read unresolved', weak.every((v) => v === -1), JSON.stringify(weak));
}
return { pass: fails.length === 0, fails, info };
