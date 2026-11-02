// The steps view's carried colour, against the exact colour pulled back pixel by pixel. Each case is a plane w1
// coloured from z ("colour of z, carried"), at rest or parked mid-glide, Inside regions or Everywhere: at each point w,
// of the points z landing there (the region's, or all), the front one under the steps view's sheet key (the region
// tiling's: Inverse.sheetKey and Inverse.front in the page, with __cmwSvKey's parameters) must be the one whose colour
// w shows, the colour plane z shows at z. The reference is plane z itself, Everywhere, coloured from z, in the same
// camera (or zoomed out, for points past it). A point counts as wrong when its pixel differs by more than 14 in a
// channel from all 9 pixels around z's (a phase edge or a contour between two pixels is not an error). Left out: points
// whose front point jumps when w is moved 1.5 px (a seam of that choice), and points near outlines, cuts and labels.
// - The Joukowski airfoil w = (z + 1/z) / 2 with its region, the outside of the circle through 1: at rest, Inside
//   regions (and every region point coloured, past the window too) and Everywhere; Everywhere held mid-glide at 0.25;
//   Everywhere parked and held at x = 1/2, where the path pulls points from past the camera's window into the view
//   (their reference read with plane z zoomed out), and the front point along t.
// - w = z^n, n = 2, 3, on the annulus 0.6 < |z| < 1.6 about 0 (its image covers n times): at rest and parked halfway
//   (the power path H_t(z) = z^(1 + (n - 1) t), principal), Inside regions and Everywhere.
// - F = sin(((e^z - 1) / (e^z + 1))^2), Everywhere at rest on its last plane: the whole plane near a family of poles.
// - w = tan z, Everywhere parked halfway: a family of poles; the key and the ring stay bounded, the pane covered.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
// (quiet: no GL frame pending, the tiling's fix-up landed under a parked map, and no SphereMesh job left; up to 60 s,
// as SwiftShader meshes the SV role's SphereMesh of an exp or sin chain in tens of seconds on the CPU renderer)
const wait = async () => { await settled({ max: 60000, until: '__cmwSvFixed() && !__cmwSphere().running && !__cmwSphere().jobs.length' }); };
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwLPx === "function" && typeof __cmwSvKey === "function" && typeof __cmwSvFixed === "function" && typeof __cmwSphere === "function"' }); };
const steps = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); __cmwSteps({ T: 0 }); 1`); await wait(); };
// the points of a grid over the inner 80 % of the pane, and whether z is where plane z's picture shows it
const paneOf = async () => ev('(() => { const q = __cmwLPx([]); return { v: q.view, w: q.pw / q.dpr, h: q.ph / q.dpr }; })()');
const grid = (P, nx, ny) => { const out = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push([P.v.cx + (i / (nx - 1) - 0.5) * 0.8 * P.w / P.v.s, P.v.cy + (j / (ny - 1) - 0.5) * 0.8 * P.h / P.v.s]); return out; };
const shown = (P, z) => Math.abs(z[0] - P.v.cx) <= 0.45 * P.w / P.v.s && Math.abs(z[1] - P.v.cy) <= 0.45 * P.h / P.v.s;
// for each list of points z, the index of the front one under the key of plane b (Inverse.sheetKey and Inverse.front in
// the page; sing: the key's points in place of plane b's), -1 for none
const fronts = async (lists, b, sing) => ev(`(() => {
  const k = Object.assign(__cmwSvKey(${b}), ${sing ? `{ sing: ${JSON.stringify(sing)} }` : '{}'}), prep = { win: k.win, R: k.R, rs: k.rs, sing: k.sing.map((p) => CX.C(p[0], p[1])) };
  return ${JSON.stringify(lists)}.map((L) => {
    let bi = -1, bc = null;
    L.forEach((p, i) => { const z = CX.C(p[0], p[1]), c = { z, D: Inverse.sheetKey(prep, z, null), lam: null }; if (!bc || Inverse.front(c, bc)) { bc = c; bi = i; } });
    return bi;
  });
})()`);
// the colours at the points W of the state `at` against plane z's at the points Z: {n, wrong, paper, worst, state}
// at.hold: the thread held at x mid-glide (a scrub on the rail not let go: the gliding path, no fix-up), as a user
// holding the thread; the frame is read once its programs are linked and two frames are alike
async function hold(x) {
  await ev(`(() => {
    const rail = document.querySelector('.sv-rail'), ns = [...document.querySelectorAll('.sv-track .sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    const i = Math.floor(${x}), cx = ns[i][0] + (ns[i + 1][0] - ns[i][0]) * (${x} - i), cy = ns[0][1];
    const ev = (type, px) => rail.dispatchEvent(new PointerEvent(type, { pointerId: 71, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true, bubbles: true, clientX: px, clientY: cy }));
    ev('pointerdown', ns[0][0] - 2); ev('pointermove', ns[0][0] + 10); ev('pointermove', cx);
    window.__svScrubUp = () => ev('pointerup', cx);
    return 1;
  })()`);
  await settled({ max: 30000, until: `GLR.pendingLinks === 0 && Math.abs(__cmwSvX() - ${x}) < 0.01 && __cmwSteps().moving` });
}
async function compare(at, W, Z) {
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  const ref = await ev(`__cmwLPx(${JSON.stringify(Z)}).px`);
  if (at.hold != null) { await steps({ scope: at.scope, surf: 'plane', go: 0, now: true }); await hold(at.hold); } else { await steps(Object.assign({ surf: 'plane' }, at)); }
  const state = await ev('__cmwSteps()'), got = await ev(`__cmwLPx(${JSON.stringify(W)}).px`);
  if (at.hold != null) { await ev('window.__svScrubUp(); 1'); await wait(); }
  let n = 0, wrong = 0, paper = 0, worst = 0;
  const ex = [];
  for (let k = 0; k < W.length; k++) {
    if (!got[k] || !ref[k]) continue;
    n++;
    const p = got[k][4];
    if (Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) < 6) { paper++; if (ex.length < 6) ex.push({ paper: true, w: W[k].map((v) => +v.toFixed(3)), z: Z[k].map((v) => +v.toFixed(3)), got: p.slice(0, 3) }); }
    let best = 1e9;
    for (const q of ref[k]) best = Math.min(best, Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])));
    worst = Math.max(worst, best);
    if (best > 14) { wrong++; if (ex.length < 6) ex.push({ w: W[k].map((v) => +v.toFixed(3)), z: Z[k].map((v) => +v.toFixed(3)), got: p.slice(0, 3), want: ref[k][4].slice(0, 3) }); }
  }
  return { n, wrong, paper, worst, ex, state: { x: state.x, T: state.T, scope: state.scope } };
}
// one case: cand(w) -> the points landing at w ([{z, out}], out: near an outline, a cut or a label, left out). A point w
// is also left out where the front point jumps (a seam of the key's choice): its front differs by more than 0.06 from
// the front 1.5 px away in any direction
async function check(tag, at, b, P, pts, cand, min) {
  const d = 1.5 / P.v.s, nb = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]];
  const C = pts.flatMap((w) => nb.map(([a, e]) => cand([w[0] + a, w[1] + e])));
  // (mid-glide, the key of the glide's frame at t: its points are the glide map's poles at t, __cmwSvKey(b, t))
  const xt = at.hold != null ? at.hold : at.park, t = xt != null ? xt - Math.floor(xt) : 0;
  const F = await fronts(C.map((c) => c.map((e) => e.z)), b, t > 0 ? (await ev(`__cmwSvKey(${b}, ${t})`)).sing : null);
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
  const x = at.hold != null ? at.hold : at.park != null ? at.park : at.go;
  // (a thread held by a scrub lands where the pointer is, within a hundredth of a plane, not exactly on x)
  ok(`${tag}: at x = ${x}, coloured from z`, Math.abs(r.state.x - x) < (at.hold != null ? 0.01 : 1e-9) && r.state.T === 0, r.state);
  ok(`${tag}: the front point's colour, at most 1 % wrong`, r.n > min && r.wrong <= 0.01 * r.n, info[tag]);
  ok(`${tag}: no point on the bare paper (no tears, no window edge)`, r.paper === 0, info[tag]);
}

// plane z's camera zoomed by f about the pane's centre (a wheel turn there), once the camera has settled
async function zoom(f) {
  const b = await ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
  const s0 = (await paneOf()).v.s;
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b[0], y: b[1] });
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: b[0], y: b[1], deltaX: 0, deltaY: -Math.log(f) / 0.0016 });
  await settled({ max: 20000, until: `Math.abs(__cmwLPx([]).view.s / ${s0} - ${f}) < 0.02` });
  await wait();
}
// The Joukowski path at x = 1/2, Everywhere: H_t, t = 1/2 (tanh((1 + t) artanh z - i pi t / 2) on the disc,
// coth((1 + t) arcoth z) outside it), pulls points from twice the camera's window into the view (the far preimage of w
// is about 1.5 w), and its pole on the disc, z = -i tan(pi / 6), sends the disc's points beside it far out. The key at t
// counts that pole (__cmwSvKey(1, t)), so the front point at w is the far one wherever it is not near the centre, and
// the frame must show its colour: from the carried points past the whole plane's mesh. Over the inner 90 % of the pane,
// parked and held at x = 1/2: the frame at the camera, and the reference colours of the front points (plane z, coloured
// from z) read after zooming plane z out by 0.4, where they are shown. And the front point along t in [0.3, 0.7] in
// steps of 0.01 at points w across the pane: it changes with t only once at a time, never back on the next step. Last on
// its page: the zoom leaves clipWin wider
async function far(P0, c, r, outside) {
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const lg = (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])], ex = (a) => [Math.exp(a[0]) * Math.cos(a[1]), Math.exp(a[0]) * Math.sin(a[1])];
  const atanh = (z) => { const l = lg(div([1 + z[0], z[1]], [1 - z[0], -z[1]])); return [l[0] / 2, l[1] / 2]; };
  const tanh = (y) => { const e = ex([2 * y[0], 2 * y[1]]); return div([e[0] - 1, e[1]], [e[0] + 1, e[1]]); };
  const inv = (z) => div([1, 0], z);
  const Ht = (t) => (z) => (z[0] * z[0] + z[1] * z[1] < 1 ? tanh([(1 + t) * atanh(z)[0], (1 + t) * atanh(z)[1] - Math.PI / 2 * t]) : inv(tanh(mul([1 + t, 0], atanh(inv(z))))));
  // the points at w along H_t: each branch's inverse over k, kept where H_t gives w back (within 1e-7), each with its
  // branch and k as its name; left out: near the circle's outline (0.12), the unit circle (H_t's seam, 0.08) and the label
  const candAt = (t) => (w) => {
    const out = [], aw = atanh(w), ac = atanh(inv(w)), H = Ht(t);
    for (let k = -3; k <= 3; k++) {
      const two = [['d' + k, tanh([aw[0] / (1 + t), (aw[1] + Math.PI / 2 * t + Math.PI * k) / (1 + t)])], ['e' + k, inv(tanh([ac[0] / (1 + t), (ac[1] + Math.PI * k) / (1 + t)]))]];
      for (const [name, z] of two) {
        if (!z.every(Number.isFinite)) continue;
        const h = H(z);
        if (Math.hypot(h[0] - w[0], h[1] - w[1]) > 1e-7 || out.some((e) => Math.hypot(e.z[0] - z[0], e.z[1] - z[1]) < 1e-9)) continue;
        out.push({ z, name, out: Math.abs(outside(z)) < 0.12 || Math.abs(Math.hypot(z[0], z[1]) - 1) < 0.08 || Math.hypot(w[0] - 1.6, w[1] - 0.1) < 1.1 });
      }
    }
    return out;
  };
  // (the key at t: plane w1's, its point J's pole z = 0, and the path's pole on the disc, -i tan(pi (1 - t) / (2 (1 +
  // t))), there from t = 1/3 on, where it leaves the unit circle: H_t has no other pole)
  const poleAt = (t) => (t > 1 / 3 ? [[0, 0], [0, -Math.tan(Math.PI * (1 - t) / (2 * (1 + t)))]] : [[0, 0]]);
  const cand = candAt(0.5), pts = [];
  for (let j = 0; j < 32; j++) for (let i = 0; i < 48; i++) pts.push([P0.v.cx + (i / 47 - 0.5) * 0.9 * P0.w / P0.v.s, P0.v.cy + (j / 31 - 0.5) * 0.9 * P0.h / P0.v.s]);
  // (the front point at each w and 1.5 px away: a point whose front jumps there is on a seam of the key's choice, left out)
  const d = 1.5 / P0.v.s, nb = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]];
  const C5 = pts.flatMap((w) => nb.map(([a, e]) => cand([w[0] + a, w[1] + e])));
  const F5 = await fronts(C5.map((L) => L.map((e) => e.z)), 1, poleAt(0.5));
  const W = [], Z = [];
  let farN = 0;
  pts.forEach((w, k) => {
    const f = F5[5 * k] < 0 ? null : C5[5 * k][F5[5 * k]];
    if (!f || f.out) return;
    if ([1, 2, 3, 4].some((j) => { const i = 5 * k + j, g = F5[i] < 0 ? null : C5[i][F5[i]]; return !g || Math.hypot(g.z[0] - f.z[0], g.z[1] - f.z[1]) > 0.06; })) return;
    W.push(w); Z.push(f.z);
    if (!shown(P0, f.z)) farN++;
  });
  // (both frames first, then the reference: zooming out widens clipWin, the whole plane's mesh, for good)
  const frames = [];
  for (const at of [{ scope: 'all', park: 0.5 }, { scope: 'all', hold: 0.5 }]) {
    if (at.hold != null) { await steps({ scope: 'all', surf: 'plane', go: 0, now: true }); await hold(at.hold); } else await steps(Object.assign({ surf: 'plane' }, at));
    frames.push({ at, state: await ev('__cmwSteps()'), got: await ev(`__cmwLPx(${JSON.stringify(W)}).px`), ring: await ev('__cmwSvRing()') });
    if (at.hold != null) { await ev('window.__svScrubUp(); 1'); await wait(); }
  }
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  await zoom(0.4);
  const P1 = await paneOf(), ref = await ev(`__cmwLPx(${JSON.stringify(Z)}).px`);
  for (const { at, state, got, ring } of frames) {
    const tag = `Joukowski all ${at.hold != null ? 'held' : 'parked'} 0.5, the points from past the camera`;
    let n = 0, wrong = 0, paper = 0, worst = 0, hidden = 0;
    for (let k = 0; k < W.length; k++) {
      if (!shown(P1, Z[k])) { hidden++; continue; }
      if (!got[k] || !ref[k]) continue;
      n++;
      const p = got[k][4];
      if (Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]) < 6) paper++;
      let best = 1e9;
      for (const q of ref[k]) best = Math.min(best, Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])));
      worst = Math.max(worst, best);
      if (best > 14) wrong++;
    }
    info[tag] = { n, wrong, paper, worst, hidden, far: farN, ring, x: state.x, moving: state.moving };
    ok(`${tag}: at x = 0.5, coloured from z`, Math.abs(state.x - 0.5) < 0.01 && state.T === 0, state);
    ok(`${tag}: front points past the camera's window are checked`, farN > 200 && hidden === 0, info[tag]);
    ok(`${tag}: the ring of carried points past the whole plane's mesh is drawn`, !!ring && ring.m >= 1.5 && ring.m <= 4, ring);
    ok(`${tag}: the front point's colour, at most 1 % wrong`, n > 800 && wrong <= 0.01 * n, info[tag]);
    ok(`${tag}: no point on the bare paper`, paper === 0, info[tag]);
  }
  // the steps view's key at t (__cmwSvKey(1, t)) has plane w1's point and the path's pole, no other, for t in [0.3, 0.7]
  const keyOff = [];
  for (let s = 30; s <= 70; s += 5) {
    const got = (await ev(`__cmwSvKey(1, ${s / 100})`)).sing, want = poleAt(s / 100);
    if (got.length !== want.length || got.some((p, i) => Math.hypot(p[0] - want[i][0], p[1] - want[i][1]) > 2e-3)) keyOff.push({ t: s / 100, got, want });
  }
  ok("Joukowski key along t: its points are J's pole and the path's pole at t", keyOff.length === 0, keyOff);
  // the front along t: at 40 points w over the pane, t = 0.30 .. 0.70
  const ws = [];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 8; i++) ws.push([P0.v.cx + (i / 7 - 0.5) * 0.9 * P0.w / P0.v.s, P0.v.cy + (j / 4 - 0.5) * 0.9 * P0.h / P0.v.s]);
  const seq = ws.map(() => []);
  for (let s = 30; s <= 70; s++) {
    const cs = ws.map(candAt(s / 100)), F = await fronts(cs.map((L) => L.map((e) => e.z)), 1, (await ev(`__cmwSvKey(1, ${s / 100})`)).sing);
    cs.forEach((L, k) => seq[k].push(F[k] < 0 ? null : L[F[k]].z));
  }
  // (a step of t moves a point by about |z| / 100: the front jumps when it moves more than a tenth of 1 + |z|, and
  // flips back when the next step's front is the one before the jump again)
  const far1 = (a, b) => !a || !b || Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.1 * (1 + Math.hypot(b[0], b[1]));
  let flick = 0, changes = 0;
  const flicks = [];
  seq.forEach((q, k) => {
    for (let i = 1; i < q.length; i++) if (far1(q[i], q[i - 1])) changes++;
    for (let i = 1; i + 1 < q.length; i++) if (far1(q[i], q[i - 1]) && !far1(q[i + 1], q[i - 1])) { flick++; flicks.push({ w: ws[k], t: (30 + i) / 100, z: [q[i - 1], q[i], q[i + 1]] }); }
  });
  info['Joukowski key along t'] = { points: ws.length, changes, flick, flicks: flicks.slice(0, 4) };
  ok('Joukowski key along t: the front point never flips back on the next step of t', flick === 0, info['Joukowski key along t']);
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
  // (the example's disc, its centre and radius as 15-examples-guide.js gives them)
  const c = [-0.12, 0.1], r = 1.1244998888, outside = (z) => Math.hypot(z[0] - c[0], z[1] - c[1]) - r;
  // (the trailing edge's mark and its label in w, which the page draws over the colour: 1.1, 77 px at this view's 70 px
  // per unit, around them)
  const labelAt = (w) => Math.hypot(w[0] - 1.6, w[1] - 0.1) < 1.1;
  const both = (w) => {
    const ax = w[0] * w[0] - w[1] * w[1] - 1, ay = 2 * w[0] * w[1], m = Math.hypot(ax, ay);
    const sx = Math.sqrt(Math.max(0, (m + ax) / 2)), sy = (ay < 0 ? -1 : 1) * Math.sqrt(Math.max(0, (m - ax) / 2));
    // (near the circle's image (the outlines), the cut [-1, 1] (the unit circle), the trailing edge's mark and label)
    const lab = labelAt(w);
    return [[w[0] + sx, w[1] + sy], [w[0] - sx, w[1] - sy]].map((z) => ({ z, out: lab || Math.abs(outside(z)) < 0.12 || Math.abs(Math.hypot(z[0], z[1]) - 1) < 0.08 }));
  };
  await check('Joukowski in rest', { scope: 'in', go: 1, now: true }, 1, P, pts, (w) => both(w).filter((e) => outside(e.z) > 0), 400);
  // (Inside regions: every region point coloured, past the reference's window too)
  const A = pts.filter((w) => both(w).some((e) => outside(e.z) > 0.12) && !labelAt(w));
  const all = await ev(`__cmwLPx(${JSON.stringify(A)}).px`);
  const paper = all.filter((q) => q && Math.max(q[4][0], q[4][1], q[4][2]) - Math.min(q[4][0], q[4][1], q[4][2]) < 6).length;
  info['Joukowski in rest'].regionPoints = { n: all.length, paper };
  ok('Joukowski in rest: every region point is coloured, past the window too', all.length > 1500 && paper === 0, { n: all.length, paper });
  await check('Joukowski all rest', { scope: 'all', go: 1, now: true }, 1, P, pts, both, 400);
  // held mid-glide at x = 0.25: the path H_t (t = 0.25), tanh((1 + t) artanh z - i pi t / 2) on the disc and
  // coth((1 + t) arcoth z) outside it; its points at w from each branch's inverse over k, kept where the forward
  // formula gives w back; near the circle's outline, plane z's axes and the label left out (along the path's cut, the
  // lower semicircle, the image is checked up to the seam: the sheet program continues each triangle on its centre's
  // branch and clips it at the circle)
  {
    const t = 0.25, mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
    const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
    const lg = (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])], ex = (a) => [Math.exp(a[0]) * Math.cos(a[1]), Math.exp(a[0]) * Math.sin(a[1])];
    const atanh = (z) => { const l = lg(div([1 + z[0], z[1]], [1 - z[0], -z[1]])); return [l[0] / 2, l[1] / 2]; };
    const tanh = (y) => { const e = ex([2 * y[0], 2 * y[1]]); return div([e[0] - 1, e[1]], [e[0] + 1, e[1]]); };
    const inv = (z) => div([1, 0], z);
    const H = (z) => (z[0] * z[0] + z[1] * z[1] < 1 ? tanh([(1 + t) * atanh(z)[0], (1 + t) * atanh(z)[1] - Math.PI / 2 * t]) : inv(tanh(mul([1 + t, 0], atanh(inv(z))))));
    // (a candidate is a point at w when the forward formula gives w back within HIT, the float error of the inverse and
    // forward formulas; two within SAME are one point; left out: within OUTLINE of the circle's outline in z, the rest
    // cases' margin, 8.4 px at this view's 70 px per unit (the outline's 1.5 px stroke and 3.5 px halo, and the 1.5 px
    // the seam test moves w), and within AXIS of plane z's axes, 2.8 px, the 1 px lines the reference draws over the
    // colour and their antialiased edge; and labelAt(w))
    const HIT = 1e-7, SAME = 1e-9, OUTLINE = 0.12, AXIS = 0.04;
    const heldCand = (w) => {
      const out = [], aw = atanh(w), ac = atanh(inv(w));
      for (let k = -3; k <= 3; k++) {
        for (const z of [tanh([aw[0] / (1 + t), (aw[1] + Math.PI / 2 * t + Math.PI * k) / (1 + t)]), inv(tanh([ac[0] / (1 + t), (ac[1] + Math.PI * k) / (1 + t)]))]) {
          if (!z.every(Number.isFinite)) continue;
          const h = H(z);
          if (Math.hypot(h[0] - w[0], h[1] - w[1]) > HIT || out.some((e) => Math.hypot(e.z[0] - z[0], e.z[1] - z[1]) < SAME)) continue;
          const near = Math.abs(outside(z)) < OUTLINE || Math.min(Math.abs(z[0]), Math.abs(z[1])) < AXIS;
          out.push({ z, out: near || labelAt(w) });
        }
      }
      return out;
    };
    await check('Joukowski all held 0.25', { scope: 'all', hold: 0.25 }, 1, P, pts, heldCand, 400);
    // (and densely over the stretch where the image of the cut, the lower semicircle, runs: Re w in [-3, -0.5],
    // Im w in [-3.5, -0.3], 50 x 50)
    const cutPts = [];
    for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++) cutPts.push([-3 + 2.5 * i / 49, -3.5 + 3.2 * j / 49]);
    await check('Joukowski all held 0.25, along the cut', { scope: 'all', hold: 0.25 }, 1, P, cutPts, heldCand, 1000);
  }
  await far(P, c, r, outside);
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

// ---- a chain with a family of poles: F = sin(((e^z - 1) / (e^z + 1))^2) Everywhere at rest, on its last plane ----
// (the whole plane's cells near the Möbius pole preimages i pi (2m + 1) are stretched past what a tessellated mesh
// draws: the tiling's SphereMesh draws it)
{
  const ns = `cexms${Date.now()}`;
  const st = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 90 }, shapes: [], steps: [{ type: 'exp', params: {} }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }, { type: 'pown', params: { n: 2 } }, { type: 'sin', params: {} }] };
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await ready();
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  const P = await paneOf(), pts = grid(P, 36, 24);
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const log = (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])];
  const sqrt = (a) => { const r = Math.hypot(a[0], a[1]), x = Math.sqrt(Math.max(0, (r + a[0]) / 2)), y = Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [x, a[1] < 0 ? -y : y]; };
  const asin = (w) => { const l = log(add(mul([0, 1], w), sqrt(sub([1, 0], mul(w, w))))); return [l[1], -l[0]]; };
  const atanh = (u) => { const l = log(div(add([1, 0], u), sub([1, 0], u))); return [l[0] / 2, l[1] / 2]; };
  // the points landing at w: sin v = w (v = asin w + 2 pi k, or pi - asin w + 2 pi k), u = ±sqrt v, z = 2 artanh u +
  // 2 pi i m, inside |Re z| < 9, |Im z| < 7; near the poles i pi (2m + 1) left out
  const cand = (w) => {
    const a = asin(w), out = [], seen = new Set();
    for (let k = -30; k <= 30; k++) for (const v of [[a[0] + 2 * Math.PI * k, a[1]], [Math.PI - a[0] + 2 * Math.PI * k, -a[1]]]) {
      const r = sqrt(v);
      for (const u of [r, [-r[0], -r[1]]]) {
        const z0 = atanh(u);
        for (let m = -2; m <= 2; m++) {
          const z = [2 * z0[0], 2 * z0[1] + 2 * Math.PI * m];
          const id = `${z[0].toFixed(7)},${z[1].toFixed(7)}`;
          if (!(Math.abs(z[0]) < 9 && Math.abs(z[1]) < 7) || seen.has(id)) continue;
          seen.add(id);
          let pole = Infinity;
          for (let j = -3; j <= 2; j++) pole = Math.min(pole, Math.hypot(z[0], z[1] - Math.PI * (2 * j + 1)));
          out.push({ z, out: pole < 0.15 });
        }
      }
    }
    return out;
  };
  await check('exp, Möbius, square, sin all rest', { scope: 'all', go: 4, now: true }, 4, P, pts, cand, 150);
  info['exp, Möbius, square, sin all rest'].mesh = await ev('__cmwSphere().entries.filter((e) => /\\|SV\\|/.test(e.slot)).map((e) => ({ n: e.n, partial: e.partial, budgetWhy: e.budgetWhy, work: e.work, ms: e.ms }))');
}

// ---- a family of poles: w = tan z, Everywhere, parked halfway (its path's poles sweep in from far out) ----
// The key's points stay at most 4 and finite, the ring (if the map pulls far points in) at most 4 times the window, the
// glide's pole tracks are made once for the glide (the second key is read from the memo, at once), and no point of the
// inner 90 % of the pane is on the bare paper
{
  const ns = `cextan${Date.now()}`;
  const st = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps: [{ type: 'tan', params: {} }] };
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await ready();
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  const P = await paneOf(), pts = [];
  for (let j = 0; j < 30; j++) for (let i = 0; i < 44; i++) pts.push([P.v.cx + (i / 43 - 0.5) * 0.9 * P.w / P.v.s, P.v.cy + (j / 29 - 0.5) * 0.9 * P.h / P.v.s]);
  await steps({ scope: 'all', surf: 'plane', park: 0.5 });
  const k = await ev('(() => { const t0 = performance.now(); const a = __cmwSvKey(1, 0.5); const t1 = performance.now(); __cmwSvKey(1, 0.5); return { sing: a.sing, again: performance.now() - t1, ring: __cmwSvRing() }; })()');
  const px = await ev(`__cmwLPx(${JSON.stringify(pts)}).px`);
  const paper = px.filter((q) => q && Math.max(q[4][0], q[4][1], q[4][2]) - Math.min(q[4][0], q[4][1], q[4][2]) < 6).length;
  info['tan all parked 0.5'] = Object.assign(k, { paper, n: px.filter(Boolean).length });
  ok('tan all parked 0.5: the key has at most 4 points, all finite', Array.isArray(k.sing) && k.sing.length <= 4 && k.sing.every((p) => p.every(Number.isFinite)), k);
  ok('tan all parked 0.5: the ring, if any, reaches at most 4 times the window', !k.ring || (k.ring.m >= 1.5 && k.ring.m <= 4), k.ring);
  ok("tan all parked 0.5: the glide's pole tracks are kept for it (a second key at once)", k.again < 5, k);
  ok('tan all parked 0.5: no point of the inner 90 % on the bare paper', paper === 0 && info['tan all parked 0.5'].n > 1000, info['tan all parked 0.5']);
}
return { pass: fails.length === 0, fails, info };
