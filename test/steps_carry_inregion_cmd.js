// The steps view's carried colour, against the exact colour pulled back pixel by pixel. Each case is a plane w1
// coloured from z ("colour of z, carried"), at rest or parked mid-glide, Inside regions or Everywhere: at each point w,
// of the points z landing there (the region's, or all), the front one under the steps view's sheet key (the region
// tiling's: Inverse.sheetKey and Inverse.front in the page, with __cmwSvKey's parameters) must be the one whose colour
// w shows, the colour plane z shows at z. The reference is plane z itself, Everywhere, coloured from z, in the same
// camera. A point counts as wrong when its pixel differs by more than 14 in a channel from all 9 pixels around z's (a
// phase edge or a contour between two pixels is not an error). Left out: points whose front point jumps when w is
// moved 1.5 px (a seam of that choice), and points near outlines, cuts and labels.
// - The Joukowski airfoil w = (z + 1/z) / 2 with its region, the outside of the circle through 1: at rest, Inside regions
//   (and every region point coloured, past the window too) and Everywhere.
// - w = z^n, n = 2, 3, on the annulus 0.6 < |z| < 1.6 about 0 (its image covers n times): at rest and parked halfway
//   (the power path H_t(z) = z^(1 + (n - 1) t), principal), Inside regions and Everywhere.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
// (quiet: no GL frame pending, and the tiling's fix-up landed under a parked map)
const wait = async () => { await settled({ max: 20000, until: '__cmwSvFixed()' }); };
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwLPx === "function" && typeof __cmwSvKey === "function" && typeof __cmwSvFixed === "function"' }); };
const steps = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); __cmwSteps({ T: 0 }); 1`); await wait(); };
// the points of a grid over the inner 80 % of the pane, and whether z is where plane z's picture shows it
const paneOf = async () => ev('(() => { const q = __cmwLPx([]); return { v: q.view, w: q.pw / q.dpr, h: q.ph / q.dpr }; })()');
const grid = (P, nx, ny) => { const out = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([P.v.cx + (i / (nx - 1) - 0.5) * 0.8 * P.w / P.v.s, P.v.cy + (j / (ny - 1) - 0.5) * 0.8 * P.h / P.v.s]); return out; };
const shown = (P, z) => Math.abs(z[0] - P.v.cx) <= 0.45 * P.w / P.v.s && Math.abs(z[1] - P.v.cy) <= 0.45 * P.h / P.v.s;
// for each list of points z, the index of the front one under the key of plane b (Inverse.sheetKey and Inverse.front in
// the page), -1 for none
const fronts = async (lists, b) => ev(`(() => {
  const k = __cmwSvKey(${b}), prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])) };
  return ${JSON.stringify(lists)}.map((L) => {
    let bi = -1, bc = null;
    L.forEach((p, i) => { const z = CX.C(p[0], p[1]), c = { z, D: Inverse.sheetKey(prep, z, null), lam: null }; if (!bc || Inverse.front(c, bc)) { bc = c; bi = i; } });
    return bi;
  });
})()`);
// the colours at the points W of the state `at` against plane z's at the points Z: {n, wrong, paper, worst, state}
async function compare(at, W, Z) {
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  const ref = await ev(`__cmwLPx(${JSON.stringify(Z)}).px`);
  await steps(Object.assign({ surf: 'plane' }, at));
  const state = await ev('__cmwSteps()'), got = await ev(`__cmwLPx(${JSON.stringify(W)}).px`);
  let n = 0, wrong = 0, paper = 0, worst = 0;
  for (let k = 0; k < W.length; k++) {
    if (!got[k] || !ref[k]) continue;
    n++;
    const p = got[k][4];
    if (Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) < 6) paper++;
    let best = 1e9;
    for (const q of ref[k]) best = Math.min(best, Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])));
    worst = Math.max(worst, best);
    if (best > 14) wrong++;
  }
  return { n, wrong, paper, worst, state: { x: state.x, T: state.T, scope: state.scope } };
}
// one case: cand(w) -> the points landing at w ([{z, out}], out: near an outline, a cut or a label, left out). A point w
// is also left out where the front point jumps (a seam of the key's choice): its front differs by more than 0.06 from
// the front 1.5 px away in any direction
async function check(tag, at, b, P, pts, cand, min) {
  const d = 1.5 / P.v.s, nb = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]];
  const C = pts.flatMap((w) => nb.map(([a, e]) => cand([w[0] + a, w[1] + e])));
  const F = await fronts(C.map((c) => c.map((e) => e.z)), b);
  const at5 = (k, j) => { const i = 5 * k + j; return F[i] < 0 ? null : C[i][F[i]]; };
  const W = [], Z = [];
  let left = 0;
  pts.forEach((w, k) => {
    const f = at5(k, 0);
    if (!f) return;
    const jump = [1, 2, 3, 4].some((j) => { const g = at5(k, j); return !g || Math.hypot(g.z[0] - f.z[0], g.z[1] - f.z[1]) > 0.06; });
    if (f.out || jump) { left++; return; }
    if (shown(P, f.z)) { W.push(w); Z.push(f.z); }
  });
  const r = await compare(at, W, Z);
  info[tag] = Object.assign(r, { leftOut: left });
  const x = at.park != null ? at.park : at.go;
  ok(`${tag}: at x = ${x}, coloured from z`, Math.abs(r.state.x - x) < 1e-9 && r.state.T === 0, r.state);
  ok(`${tag}: the front point's colour, at most 1 % wrong`, r.n > min && r.wrong <= 0.01 * r.n, info[tag]);
  ok(`${tag}: no point on the bare paper (no tears, no window edge)`, r.paper === 0, info[tag]);
}

// ---- the Joukowski airfoil ----
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const EX = names.indexOf('Joukowski airfoil');
ok('the Joukowski example is found', EX >= 0, names.length);
await go(`http://localhost:${PORT}/test.html?view=steps&ns=cex${Date.now()}`);
await ready();
await ev(`__cmwExample(${EX}); 1`);
await wait();
{
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  const P = await paneOf(), pts = grid(P, 60, 40);
  // the region: outside the circle |z - c| = r; the points at w: z = w ± sqrt(w^2 - 1)
  const c = [-0.12, 0.1], r = 1.1244998888, outside = (z) => Math.hypot(z[0] - c[0], z[1] - c[1]) - r;
  const both = (w) => {
    const ax = w[0] * w[0] - w[1] * w[1] - 1, ay = 2 * w[0] * w[1], m = Math.hypot(ax, ay);
    const sx = Math.sqrt(Math.max(0, (m + ax) / 2)), sy = (ay < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (m - ax) / 2));
    // (near the circle's image (the outlines), the cut [-1, 1] (the unit circle), the trailing edge's mark and label)
    const lab = Math.hypot(w[0] - 1.6, w[1] - 0.1) < 1.1;
    return [[w[0] + sx, w[1] + sy], [w[0] - sx, w[1] - sy]].map((z) => ({ z, out: lab || Math.abs(outside(z)) < 0.12 || Math.abs(Math.hypot(z[0], z[1]) - 1) < 0.08 }));
  };
  await check('Joukowski in rest', { scope: 'in', go: 1, now: true }, 1, P, pts, (w) => both(w).filter((e) => outside(e.z) > 0), 400);
  // (Inside regions: every region point coloured, past the reference's window too)
  const A = pts.filter((w) => both(w).some((e) => outside(e.z) > 0.12) && Math.hypot(w[0] - 1.6, w[1] - 0.1) >= 1.1);
  const all = await ev(`__cmwLPx(${JSON.stringify(A)}).px`);
  const paper = all.filter((q) => q && Math.max(q[4][0], q[4][1], q[4][2]) - Math.min(q[4][0], q[4][1], q[4][2]) < 6).length;
  info['Joukowski in rest'].regionPoints = { n: all.length, paper };
  ok('Joukowski in rest: every region point is coloured, past the window too', all.length > 1500 && paper === 0, { n: all.length, paper });
  await check('Joukowski all rest', { scope: 'all', go: 1, now: true }, 1, P, pts, both, 400);
}

// ---- multiple coverings: w = z^n on an annulus about 0 ----
for (const n of [2, 3]) {
  const ns = `cexz${n}${Date.now()}`;
  const st = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 90 }, shapes: [{ id: 1, kind: 'annulus', c: [0, 0], r1: 0.6, r2: 1.6 }], steps: [{ type: 'pown', params: { n } }] };
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await ready();
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  const P = await paneOf(), pts = grid(P, 44, 30);
  const inA = (z) => { const m = Math.hypot(z[0], z[1]); return m > 0.6 && m < 1.6; };
  for (const [scope, park] of [['in', null], ['all', null], ['in', 0.5], ['all', 0.5]]) {
    const p = 1 + (n - 1) * (park == null ? 1 : park);
    // the points landing at w: |w|^(1/p) e^(i (arg w + 2 pi k) / p) with |arg| <= pi (the principal power); near the
    // annulus's circles and the power's cut left out
    const cand = (w) => {
      const r = Math.hypot(w[0], w[1]), a = Math.atan2(w[1], w[0]), out = [];
      for (let k = -n; k <= n; k++) {
        const t = (a + 2 * Math.PI * k) / p;
        if (!(Math.abs(t) <= Math.PI)) continue;
        const z = [r ** (1 / p) * Math.cos(t), r ** (1 / p) * Math.sin(t)], m = Math.hypot(z[0], z[1]);
        if (scope === 'in' && !inA(z)) continue;
        out.push({ z, out: Math.abs(m - 0.6) < 0.08 || Math.abs(m - 1.6) < 0.08 || Math.PI - Math.abs(t) < 0.06 });
      }
      return out;
    };
    await check(`z^${n} ${scope} ${park == null ? 'rest' : 'parked ' + park}`, park == null ? { scope, go: 1, now: true } : { scope, park }, 1, P, pts, cand, 200);
  }
}
return { pass: fails.length === 0, fails, info };
