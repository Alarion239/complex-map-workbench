// (Set to 100 % opacity: the front point's colour alone is read; the Opacity slider's 85 % default mixes the layers behind.)
// The steps view's colour at rest on the planes past the colour plane of long chains, coloured from z ("colour of z,
// carried"), against the exact colour pulled back pixel by pixel (carryRead's measure, test/lib/carry_kit.js): at each
// point w, of the points z landing there (the region's under Inside regions, or all), the front one under the steps
// view's sheet key must be the one whose colour w shows, the colour plane z shows at z. The points z come from each
// step's inverse over every period within reach (chainPoints). A point counts as wrong when its pixel differs by more
// than 14 in a channel from all 9 pixels around z's; at most 1 % may be, and none may show the bare paper. Left out:
// points whose front point jumps when w is moved 1.5 px (a seam of that choice), points where the page draws over the
// colour (the outlines, the other shapes and the labels, on plane z or their images), and front points past plane z's
// window.
// Each case is read twice: as the page draws it (the inverse pass, at rest), and as the carried meshes draw it, the
// region tiling's machinery (svCarryRegions, which draws while the inverse pass compiles or where it cannot), with the
// inverse renderer taken from the page (GLR.drawInverse) for that read.
// Control: each case read against the front point the larger Im z decides (of all the points landing at w that plane z
// shows, the region's or not, so it can pick a copy of z outside the region) has over 1 % wrong: the check tells the
// two rules apart.
// - Strip to disk (exp, then (z - 1)/(z + 1); the strip |Im z| < pi/2): planes w1 and w2, Inside regions and Everywhere;
//   and w2 Everywhere over the whole pane against the copy nearest the centre (every point at w is a copy of one, all
//   as near a pole: the key ranks them by their distance to the centre alone);
// - exp, z^2, (z - i)/(z + i), z^3 with the disc |z - (0.3 + 0.2i)| < 1.2: planes w2, w3 and w4 Everywhere, w4 Inside regions;
// - sin, (z - 1)/(z + 1), z^2, (z - i)/(z + i) with the disc |z| < 1.4: plane w4 Everywhere and Inside regions;
// - exp, (z - 1)/(z + 1), z^3, (z - i)/(z + i), z^2 with the strip: plane w5 Everywhere and Inside regions.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the formulas shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
// (quiet: no GL frame pending, the tiling's fix-up landed, and no SphereMesh job left; up to 60 s, as the CPU renderer
// meshes the SphereMesh of an exp or sin chain in tens of seconds)
const wait = async () => { await settled({ max: 60000, until: '__cmwSvFixed() && !__cmwSphere().running && !__cmwSphere().jobs.length' }); };
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwLPx === "function" && typeof __cmwSvKey === "function" && typeof __cmwSvFixed === "function" && typeof __cmwSphere === "function"' }); };
const steps = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); __cmwSteps({ T: 0 }); 1`); await wait(); };
const { paneOf, exampleNames, grid, shown, chainPoints, carryRead } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const { measure } = carryRead({ steps, wait, hold });
// (every page, once it has adopted its chain's view: paths off, full opacity)
const prime = async () => { await ready(); await adopted(); await ev("__cmwSet('morphPaths', false), __cmwSet('alpha', 1), 1"); await wait(); };
// the share of wrong points a case may have, and the share its control must exceed
const MAX_WRONG = 0.01;
// (near the region's outline in z, 5 and 9 px at these views' 52 and 90 px per unit: the outline's antialiased edge and
// the 1.5 px the seam test moves w)
const EDGE = 0.1;
// (the axes, which plane z and the planes past it draw over the colour, within AXIS_PX; and plane z's zero, where every
// colour meets, within ZERO_PX: a pixel's colour there is not that of a point a pixel away)
const AXIS_PX = 3, ZERO_PX = 12;
// the front where every point landing at w is a copy of one point, all equally beside a pole (a chain periodic in z):
// the copy nearest the key's window centre (the window win of __cmwSvKey), whatever the key's points
const nearest = (win) => async (lists) => lists.map((L) => {
  const c = [(win.x0 + win.x1) / 2, (win.y0 + win.y1) / 2];
  let bi = -1;
  L.forEach((z, i) => { if (bi < 0 || Math.hypot(z[0] - c[0], z[1] - c[1]) < Math.hypot(L[bi][0] - c[0], L[bi][1] - c[1])) bi = i; });
  return bi;
});
// the control's front: of the points landing at w that plane z's pane P shows, the one with the larger Im z
const larger = (P) => async (lists) => lists.map((L) => {
  let bi = -1;
  L.forEach((z, i) => { if (shown(P, z) && (bi < 0 || z[1] > L[bi][1])) bi = i; });
  return bi;
});

// One chain (the page's steps, chainSteps) at rest on its planes: cases [{ b, scope, box, near }] (box: the plane's points
// read, 60 x 46 over [x0, x1, y0, y1]; 40 x 28 over the middle 90 % of the pane by default; near: the front point is the
// copy nearest the centre, nearest(), in place of the page's key), inR(z) the region (a signed
// distance to its outline, > 0 inside). The points z are looked for over plane z's window and its size again on each side (a point the key
// puts in front lies near the window's centre). min: the points a case compares at least. A point w is left out where
// the page draws over the colour: where any of its points z is within EDGE of the region's outline (the outline's
// image), near the axes of plane b at w or of plane z at any of its points z, near plane z's zero, and where
// o.drawn(w, b) or o.drawn(z, 0) for any of them (the other shapes, their images and their labels)
async function chain(name, chainSteps, cases, inR, min, o = {}) {
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  const P = await paneOf(), hw = 1.5 * P.w / P.v.s, hh = 1.5 * P.h / P.v.s;
  const cands = chainPoints(chainSteps, { x0: P.v.cx - hw, x1: P.v.cx + hw, y0: P.v.cy - hh, y1: P.v.cy + hh });
  const axis = (p) => Math.min(Math.abs(p[0]), Math.abs(p[1])) < AXIS_PX / P.v.s, zero = (z) => Math.hypot(z[0], z[1]) < ZERO_PX / P.v.s;
  const drawn = (p, b) => axis(p) || (b === 0 && zero(p)) || (!!o.drawn && o.drawn(p, b));
  for (const { b, scope, box, near } of cases) for (const mesh of [false, true]) {
    const tag = `${name}: w${b} ${scope === 'in' ? 'Inside regions' : 'Everywhere'}${near ? ', the copy nearest the centre' : ''}${mesh ? ', meshes' : ''}`;
    const pts = box ? grid({ v: { cx: (box[0] + box[1]) / 2, cy: (box[2] + box[3]) / 2, s: 1 }, w: box[1] - box[0], h: box[3] - box[2] }, 60, 46, 1) : grid(P, 40, 28, 0.9);
    const all = (w) => {
      const L = cands(w, b), out = drawn(w, b) || L.some((e) => Math.abs(inR(e.z)) < EDGE || drawn(e.z, 0));
      return L.map((e) => ({ z: e.z, out }));
    };
    const cand = scope === 'in' ? (w) => all(w).filter((e) => inR(e.z) > 0) : all;
    const at = { scope, go: b, now: true };
    if (mesh) await ev('window.__cmwInv = GLR.drawInverse, GLR.drawInverse = null, 1');
    const r = await measure(at, b, P, pts, cand, near ? nearest((await ev(`__cmwSvKey(${b})`)).win) : undefined);
    info[tag] = r;
    info[tag].path = (await ev('__cmwSteps().rest')) || null;
    ok(`${tag}: at rest on plane ${b}, coloured from z`, r.state.x === b && r.state.T === 0, r.state);
    ok(`${tag}: drawn by the ${mesh ? 'carried meshes' : 'inverse pass'}`, !!r.path && r.path.a === b && r.path.path === (mesh ? 'mesh' : 'inverse'), r.path);
    ok(`${tag}: the front point's colour, at most 1 % wrong`, r.n > min && r.wrong <= MAX_WRONG * r.n, r);
    ok(`${tag}: no point on the bare paper`, r.paper === 0, r);
    const c = await measure(at, b, P, pts, all, larger(P));
    info[tag].control = { n: c.n, wrong: c.wrong, leftOut: c.leftOut };
    if (mesh) await ev('GLR.drawInverse = window.__cmwInv, 1');
    ok(`${tag}: control: read against the larger Im z's colour, over 1 % wrong`, c.n > min && c.wrong > MAX_WRONG * c.n, info[tag].control);
  }
}
// a page with the chain chainSteps and the shapes, plane z's camera srcView
async function open(tag, shapes, chainSteps, srcView) {
  const ns = `ccc${tag}${Date.now()}`;
  const s = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView, shapes, steps: chainSteps };
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(s))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await prime();
}
const EXP = { type: 'exp', params: {} }, SIN = { type: 'sin', params: {} }, POW = (n) => ({ type: 'pown', params: { n } });
const MOB_STRIP = { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }, CAYLEY = { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } };
const strip = (z) => Math.PI / 2 - Math.abs(z[1]);

// ---- Strip to disk, the example (its chain: exp, then (z - 1)/(z + 1)) ----
{
  const names = exampleNames(), EX = names.indexOf('Strip to disk');
  ok('the Strip to disk example is found', EX >= 0, names.length);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=ccc${Date.now()}`);
  await prime();
  await ev(`__cmwExample(${EX}); 1`);
  await adopted();
  await wait();
  // (the example's line Im z = 0.8 and its point z0 = 0 with its label, on plane z and their images on w1 and w2, at
  // F(0) = 1 and 0: within 0.1 of the line, 5 px at this view's 52 px per unit, and 0.7 of the point, its label's
  // 20 px and more)
  const LABEL = 0.7, LINE = 0.1, z0At = [[0, 0], [1, 0], [0, 0]];
  const drawn = (p, b) => Math.hypot(p[0] - z0At[b][0], p[1] - z0At[b][1]) < LABEL || (b === 0 && Math.abs(p[1] - 0.8) < LINE);
  // (w2 Inside regions: the disc, the strip's image, which is small at this view)
  const disc = [-1.3, 1.3, -1, 1];
  // (w2 Everywhere over the whole pane: every point landing at w is a copy z + 2 pi i k of one, each beside a pole
  // i pi (2m + 1) of the Möbius step pulled back, as near as the others, so the front is the copy nearest the centre)
  await chain('Strip to disk', [EXP, MOB_STRIP], [{ b: 1, scope: 'in' }, { b: 1, scope: 'all' }, { b: 2, scope: 'in', box: disc }, { b: 2, scope: 'all', box: disc }, { b: 2, scope: 'all', near: true }], strip, 300, { drawn });
}
// ---- exp, z^2, Cayley, z^3 with a disc ----
{
  const c = [0.3, 0.2], r = 1.2, ch = [EXP, POW(2), CAYLEY, POW(3)];
  await open('sq', [{ id: 1, kind: 'disc', c, r }], ch, { cx: 0, cy: 0, s: 90 });
  await chain('exp, z^2, Cayley, z^3', ch, [{ b: 2, scope: 'all' }, { b: 3, scope: 'all' }, { b: 4, scope: 'all' }, { b: 4, scope: 'in' }], (z) => r - Math.hypot(z[0] - c[0], z[1] - c[1]), 300);
}
// ---- sin, Möbius, z^2, Cayley with a disc ----
{
  const r = 1.4, ch = [SIN, MOB_STRIP, POW(2), CAYLEY];
  await open('sin', [{ id: 1, kind: 'disc', c: [0, 0], r }], ch, { cx: 0, cy: 0, s: 90 });
  await chain('sin, Möbius, z^2, Cayley', ch, [{ b: 4, scope: 'all' }, { b: 4, scope: 'in' }], (z) => r - Math.hypot(z[0], z[1]), 300);
}
// ---- Strip to disk, then z^3, Cayley, z^2 ----
{
  const ch = [EXP, MOB_STRIP, POW(3), CAYLEY, POW(2)];
  await open('five', [{ id: 1, kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }], ch, { cx: 0, cy: 0, s: 52 });
  await chain('exp, Möbius, z^3, Cayley, z^2', ch, [{ b: 5, scope: 'all' }, { b: 5, scope: 'in' }], strip, 300);
}
return { pass: fails.length === 0, fails, info };
