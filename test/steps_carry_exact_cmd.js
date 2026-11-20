// The steps view's carried colour against the exact colour: the one carry-vs-exact suite, in parts (CMW_ONLY=<part> runs
// one, as CI does: ci/browser_suites.js; none set, every part in turn). Each part is a case list over the same kits
// (test/lib/carry_kit.js: the left pane's pixels, the front points and their measure; test/lib/held_frames.js: the held
// thread and the exact picture's judge) and the same page setup below.
// (100 % opacity in every part: the front point's colour alone is read; the Opacity slider's 85 % default mixes the
// layers behind.)
//
// ---- part glide ----
// The steps view's carried colour of a parked glide frame, graded against the exact picture of that frame (held_frames'
// judge: plane z's parked frame pulled through H_u's inverse, the front sheet by the glide's own key). The default example
// (exp, then (z - 1)/(z + 1)), the thread held at u = 0.25, 0.5 and 0.75 between plane z and plane w1:
//  - the frame is drawn by the inverse pass and the judge passes: at least JUDGE_MIN_N pixels compared, at most JUDGE_OVER
//    of them more than JUDGE_TOL apart in a channel (the colour lines are left out);
//  - negative control: the cross-fade of plane z's and plane w1's parked frames at the same u (the picture a glide that
//    blended the two planes would show) does not pass the same judge;
//  - the inverse pass's sheet key has the period of the steps view's key at u (__cmwSvKey(1, u)): the steps before the
//    glide's step, none here, not exp's path's own 2 pi i / u.
//
// ---- part inregion ----
// The steps view's carried colour, against the exact colour pulled back pixel by pixel. Each case is a plane w1
// coloured from z ("colour of z, carried"), at rest or parked mid-glide, Inside regions or Everywhere: at each point w,
// of the points z landing there (the region's, or all), the front one under the steps view's sheet key (the region
// tiling's: Inverse.sheetKey and Inverse.front in the page, with __cmwSvKey's parameters) must be the one whose colour
// w shows, the colour plane z shows at z. The reference is plane z itself, Everywhere, coloured from z, in the same
// camera. A point counts as wrong when its pixel differs by more than 14 in a channel from all 9 pixels around z's (a
// phase edge or a contour between two pixels is not an error). Left out: points whose front point jumps when w is
// moved 1.5 px (a seam of that choice), and points near outlines, cuts and labels.
// Paths are off in every page: the glide's paths t -> H_t(z) are drawn over the colour, which is what is read.
// - The Joukowski airfoil w = (z + 1/z) / 2 with its region, the outside of the circle through 1: at rest, Inside
//   regions (and every region point coloured, past the window too) and Everywhere; Everywhere held mid-glide at 0.25.
// - w = z^n, n = 2, 3, on the annulus 0.6 < |z| < 1.6 about 0 (its image covers n times): at rest and parked halfway
//   (the power path H_t(z) = z^(1 + (n - 1) t), principal), Inside regions and Everywhere. For n = 2, the bare frames
//   (__cmwSteps({ bare: true }), the colour layer alone) Inside regions, parked halfway (the inverse pass's frame) and at
//   rest on plane w1 (the exact colour under the regions' mask), have no outlines: leaving the shapes' strokes out
//   (__cmwHideStrokes) changes no pixel by more than DIFF_TOL; control: not bare, it changes the frame.
// - F = sin(((e^z - 1) / (e^z + 1))^2), Everywhere at rest on its last plane: the whole plane near a family of poles.
//
// ---- part far ----
// The steps view's carried colour mid-glide, Everywhere, where the glide pulls points from past the camera's window into
// the view, and the sheet key at t (the glide map's poles at t beside plane b's points, __cmwSvKey(b, t)), against the
// exact picture (held_frames' judge), its reference zoomed out for points past the camera.
// Paths are off in every page: the glide's paths t -> H_t(z) are drawn over the colour, which is what is read.
// - The Joukowski airfoil w = (z + 1/z) / 2, Everywhere parked and held at x = 1/2 (drawn by the inverse pass; the front
//   point under the key with the path's pole), and the front point along t from 0.3 to 0.7.
// - w = tan z, Everywhere parked halfway: a family of poles; the key and the ring stay bounded, the pane covered.
//
// ---- part chains ----
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
//
// ---- part planes ----
// The steps view's carried colour where the region meshes carry the whole plane: parked mid-glide, at each point
// w the colour of the point z that lands there must be the colour plane's colour of z, which plane z shows at z when
// it is coloured from the same colour plane (the reference, at rest on plane z, Everywhere, in the same camera). A point
// counts as wrong when its pixel differs by more than 14 in a channel from all 9 pixels around z's (a phase edge or a
// contour between two pixels is not an error); at most 1 % may be, and none may sit on the bare paper.
// Each frame is one the carried meshes draw (svCarryRegions), which the suite checks: the glide's record says 'mesh'.
// - Beside a region defined on a later plane (a disc on w₁), a region of plane z, Inside regions, coloured from z,
//   parked at x = 1/2 under z + 0.2 conj(z) (not analytic: its glide runs the straight line, and no inverse pass draws
//   it): the whole plane is carried and the moving regions keep it; the points checked are the plane-z region's, at
//   1.1 x + 0.9 i y.
// - A d/dz between plane z and the colour plane (z², d/dz, exp; coloured from w₃: exp(2z) at z), Everywhere, parked at
//   x = 5/2, past the d/dz (plane w₂'s points 2z on exp's zoom path at t = 1/2: 2(e^z − 1) + 1/2); the colour evaluates
//   the chain through the d/dz.
// A command file for a CDP daemon (test/cdp_kit README); CI runs its parts in the views and formulas shards
// (ci/browser_shards.js). Prints {pass, fails, info}.
const ONLY = process.env.CMW_ONLY || '';
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { lpx, paneOf, tally, bareCount, grid, shown, fronts, joukPath, chainPoints, carryRead } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// the held thread (hold; window.__svScrubUp lets go), the kept frames (grab), their cross-fade (fade), their compare and
// the exact picture's judge: test/lib/held_frames.js
const { hold, grab, fade, judge, JUDGE_MIN_N, compare: compareFrames } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// a navigation with no load event, and an { __exc } answer, fail the suite where they happen: a thrown error is the suite's failure
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const need = (r, what) => { if (r && r.__exc !== undefined) throw new Error(what + ' failed: ' + r.__exc); return r; };
const setup = async (expr) => need(await ev(expr), expr.slice(0, 60));
// a page opened in the steps view on a saved state (state: v3 ... steps, shapes, srcView), under a namespace of its own
// that starts with tag
const openState = async (state, tag) => {
  const ns = `${tag}${Date.now()}`;
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await setup(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
};
// The waits of the parts that read frames past the colour plane (inregion, chains):
// (quiet: no GL frame pending, the tiling's fix-up landed under a parked map, and no SphereMesh job left; up to 60 s,
// as the CPU renderer meshes the SV role's SphereMesh of an exp or sin chain in tens of seconds)
const wait = async () => { await settled({ max: 60000, until: '__cmwSvFixed() && !__cmwSphere().running && !__cmwSphere().jobs.length' }); };
// (every hook those parts call is defined: a page still starting fails here, not in a later read)
const ready = async () => {
  const r = await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSvKey === "function" && typeof __cmwSvFixed === "function" && typeof __cmwSphere === "function"' });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
};
const steps = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); __cmwSteps({ T: 0 }); 1`); await wait(); };
// the front point's colour against plane z's (carryRead's measure: test/lib/carry_kit.js): cand(w) -> the points landing
// at w ([{z, out}], out: near an outline, a cut or a label, left out)
const { measure } = carryRead({ steps, wait, hold });
await view(1200, 800, false, false);

// ---- part glide ----
async function glidePart() {
  const HELD_U = [0.25, 0.5, 0.75];
  await go(`http://localhost:${PORT}/test.html?ns=cex${Date.now()}&view=steps`);
  await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
  await ev(`__cmwSet('morphPaths', false), __cmwSet('alpha', 1), __cmwSteps({ scope: 'all', surf: 'plane', bare: false }), 1`);
  // (at rest on plane i, its frame drawn)
  const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
  await rest(1);
  ok('plane w1 parked frame settles', await grab('R1'), null);
  await rest(0);
  ok('plane z parked frame settles', await grab('R0'), null);
  for (const u of HELD_U) {
    { const h = await hold(u); ok(`u = ${u}: the thread is held`, h.ok, h); }
    ok(`u = ${u}: the moving frame settles`, await grab('M' + u), null);
    const g = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, b: g.b, per: g.per }; })()');
    ok(`u = ${u}: the frame is the inverse pass's`, !!g && g.path === 'inverse', g);
    const kper = (await ev(`__cmwSvKey(1, ${u})`)).per;
    ok(`u = ${u}: the inverse pass's sheet key has the period of the steps view's key at u`, !!g && JSON.stringify(g.per) === JSON.stringify(kper), { pass: g && g.per, key: kper });
    const j = await judge('R0', 'M' + u);
    info['judge u=' + u] = j;
    ok(`u = ${u}: the carried colour is the exact picture's (judge passes)`, j.pass, j);
    ok(`u = ${u}: the cross-fade frame exists`, await fade('R0', 'R1', u, 'X' + u), null);
    const c = await judge('R0', 'X' + u);
    info['control u=' + u] = c;
    ok(`u = ${u}: negative control: a cross-fade of the two planes' frames does not pass the judge`, !c.pass && c.n >= JUDGE_MIN_N, c);
    await ev('window.__svScrubUp(), 1');
    await rest(0);
  }
}

// ---- part inregion ----
async function inregionPart() {
  // (the least share of the frame the annulus's two outlines cover, not bare)
  const OUTLINE_MIN = 0.001;
  async function check(tag, at, b, P, pts, cand, min, exact = false) {
    const r = await measure(at, b, P, pts, cand);
    info[tag] = r;
    const x = at.hold != null ? at.hold : at.park != null ? at.park : at.go;
    // (a thread held by a scrub lands where the pointer is, within a hundredth of a plane, not exactly on x)
    ok(`${tag}: at x = ${x}, coloured from z`, Math.abs(r.state.x - x) < (at.hold != null ? 0.01 : 1e-9) && r.state.T === 0, r.state);
    ok(`${tag}: the front point's colour, ${exact ? 'none' : 'at most 1 %'} wrong`, r.n > min && r.wrong <= (exact ? 0 : 0.01 * r.n), info[tag]);
    ok(`${tag}: no point on the bare paper (no tears, no window edge)`, r.paper === 0, info[tag]);
  }

  // the carried colour of the frame mid-glide, parked (at.park) or held (at.hold), graded by the judge against the exact picture of
  // plane z's parked frame (held_frames' judge: the frame pulled back through H_u's inverse by the glide's own sheet key)
  async function judged(tag, at, seeds) {
    // (the colour layer alone, as the other suites that grade a frame against the exact picture read it: outlines and labels are drawn over the colour at places that differ between the frames)
    await ev('__cmwSteps({ bare: true }), 1');
    await steps({ scope: at.scope, surf: 'plane', go: 0, now: true });
    ok(`${tag}: plane z's parked frame settles`, await grab('R0'), null);
    await steps({ scope: at.scope, surf: 'plane', go: 1, now: true });
    ok(`${tag}: plane w1's parked frame settles`, await grab('R1'), null);
    await steps({ scope: at.scope, surf: 'plane', go: 0, now: true });
    if (at.hold != null) { const h = await hold(at.hold); ok(`${tag}: the thread is held at x = ${at.hold}`, h.ok, h); } else { await steps(Object.assign({ surf: 'plane' }, at)); }
    ok(`${tag}: the moving frame settles`, await grab('M'), null);
    const state = await ev('__cmwSteps()'), g = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, u: g.u }; })()');
    const j = await judge('R0', 'M', { seeds });
    if (at.hold != null) { await ev('window.__svScrubUp(); 1'); await wait(); }
    await ev('__cmwSteps({ bare: false }), 1');
    info[tag] = { j, g, x: state.x, T: state.T };
    // (a thread held by a scrub lands where the pointer is, within a hundredth of a plane, not exactly on x)
    const x = at.hold != null ? at.hold : at.park;
    ok(`${tag}: at x = ${x}, coloured from z`, Math.abs(state.x - x) < (at.hold != null ? 0.01 : 1e-9) && state.T === 0, info[tag]);
    ok(`${tag}: the frame is the exact picture (the judge passes)`, j.pass, info[tag]);
    // negative control: the cross-fade of the two planes' parked frames at the same u is not the exact picture
    const xt = at.hold != null ? at.hold : at.park, u = xt - Math.floor(xt);
    ok(`${tag}: the cross-fade frame exists`, await fade('R0', 'R1', u, 'X'), null);
    const c = await judge('R0', 'X', { seeds });
    info[tag].control = c;
    ok(`${tag}: negative control: a cross-fade of the two planes' frames does not pass the judge`, !c.pass && c.n >= JUDGE_MIN_N, info[tag]);
  }

  // (the reference's Newton seeds for the Joukowski frame: the default 8 x 6 grid misses roots in the band under the real axis,
  // where the front root it then picks is a later sheet's)
  const JOUK_SEEDS = [48, 32];
  // ---- the Joukowski airfoil ----
  const names = exampleNames();
  const EX = names.indexOf('Joukowski airfoil');
  ok('the Joukowski example is found', EX >= 0, names.length);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=cex${Date.now()}`);
  await ready();
  await ev("__cmwSet('morphPaths', false), __cmwSet('alpha', 1), 1");
  await ev(`__cmwExample(${EX}); 1`);
  await adopted();
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
    const all = (await lpx(A)).px;
    const paper = bareCount(all).paper;
    info['Joukowski in rest'].regionPoints = { n: all.length, paper };
    ok('Joukowski in rest: every region point is coloured, past the window too', all.length > 1500 && paper === 0, { n: all.length, paper });
    await check('Joukowski all rest', { scope: 'all', go: 1, now: true }, 1, P, pts, both, 400);
    // held mid-glide at x = 0.25: the path H_t (t = 0.25), tanh((1 + t) artanh z - i pi t / 2) on the disc and
    // coth((1 + t) arcoth z) outside it; its points at w from each branch's inverse over k, kept where the forward
    // formula gives w back; near the circle's outline, plane z's axes and the label left out (along the path's cut, the
    // lower semicircle, the image is checked up to the seam: the sheet program continues each triangle on its centre's
    // branch and clips it at the circle)
    {
      // (left out: within AXIS of plane z's axes, 2.8 px at this view's 70 px per unit, the 1 px lines the reference draws
      // over the colour and their antialiased edge; and labelAt(w); the outline's margin OUTLINE is the rest cases', 8.4 px:
      // the outline's 1.5 px stroke and 3.5 px halo, and the 1.5 px the seam test moves w)
      const AXIS = 0.04;
      const heldCand = joukPath(outside, (z, w) => Math.min(Math.abs(z[0]), Math.abs(z[1])) < AXIS || labelAt(w)).candAt(0.25);
      await judged('Joukowski all held 0.25', { scope: 'all', hold: 0.25 }, JOUK_SEEDS);
      // (and densely over the stretch where the image of the cut, the lower semicircle, runs: Re w in [-3, -0.5],
      // Im w in [-3.5, -0.3], 50 x 50; none wrong: the triangles the cut tears keep the enhanced style's modulus bands
      // where the exact colour has them)
      const cutPts = [];
      for (let j = 0; j < 50; j++) for (let i = 0; i < 50; i++) cutPts.push([-3 + 2.5 * i / 49, -3.5 + 3.2 * j / 49]);
      await check('Joukowski all held 0.25, along the cut', { scope: 'all', hold: 0.25 }, 1, P, cutPts, heldCand, 1000, true);
    }
  }

  // ---- multiple coverings: w = z^n on an annulus about 0 ----
  for (const n of [2, 3]) {
    const st = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 90 }, shapes: [{ id: 1, kind: 'annulus', c: [0, 0], r1: 0.6, r2: 1.6 }], steps: [{ type: 'pown', params: { n } }] };
    await openState(st, `cexz${n}`);
    await ready();
    await ev("__cmwSet('morphPaths', false), __cmwSet('alpha', 1), 1");
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
      const tag = `z^${n} ${scope} ${park == null ? 'rest' : 'parked ' + park}`;
      if (park == null) await check(tag, { scope, go: 1, now: true }, 1, P, pts, cand, 200); else await judged(tag, { scope, park });
    }
    if (n === 2) {
      for (const [tag, at] of [['parked 0.5', { park: 0.5 }], ['rest on w1', { go: 1, now: true }]]) {
        // the share of the frame's pixels the shapes' strokes change (compareFrames' frac), bare or not
        const strokes = async (bare) => {
          await ev(`__cmwSteps({ bare: ${bare} }), 1`);
          await steps(Object.assign({ scope: 'in', surf: 'plane' }, at));
          const on = await grab('strokes');
          await ev('__cmwHideStrokes(true), 1');
          await wait();
          const off = await grab('no strokes');
          await ev('__cmwHideStrokes(false), __cmwSteps({ bare: false }), 1');
          await wait();
          return on && off ? compareFrames('strokes', 'no strokes') : null;
        };
        const bare = await strokes(true), drawn = await strokes(false), g = await ev('(() => { const g = __cmwSteps().glide; return g && { path: g.path, u: g.u }; })()');
        info[`z^2 in ${tag}, bare`] = { bare, drawn, g };
        ok(`z^2 in ${tag}: the bare frame has no outlines (the strokes change no pixel)`, !!bare && bare.frac === 0, info[`z^2 in ${tag}, bare`]);
        ok(`z^2 in ${tag}: control: not bare, the strokes change the frame`, !!drawn && drawn.frac > OUTLINE_MIN, info[`z^2 in ${tag}, bare`]);
      }
    }
  }

  // ---- a chain with a family of poles: F = sin(((e^z - 1) / (e^z + 1))^2) Everywhere at rest, on its last plane ----
  // (the whole plane's cells near the Möbius pole preimages i pi (2m + 1) are stretched past what a tessellated mesh
  // draws: the tiling's SphereMesh draws it)
  {
    const st = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 90 }, shapes: [], steps: [{ type: 'exp', params: {} }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }, { type: 'pown', params: { n: 2 } }, { type: 'sin', params: {} }] };
    await openState(st, 'cexms');
    await ready();
    await ev("__cmwSet('morphPaths', false), __cmwSet('alpha', 1), 1");
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
}

// ---- part far ----
async function farPart() {
  // (quiet: no GL frame pending, and the tiling's fix-up landed under a parked map)
  const wait = async () => { await settled({ max: 20000, until: '__cmwSvFixed()' }); };
  // every hook the suite calls is defined, and the page is quiet: a page still starting fails here, not in a later read
  const HOOKS = ['__cmwSet', '__cmwSteps', '__cmwExample', '__cmwCards', '__cmwSvKey', '__cmwSvFixed', '__cmwSvRing', '__cmwSvWarm', '__cmwSvX', '__cmwAddStep'];
  const ready = async () => {
    const r = await settled({ max: 30000, until: HOOKS.map((h) => `typeof ${h} === "function"`).join(' && ') });
    if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
  };
  const steps = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); __cmwSteps({ T: 0 }); 1`); await wait(); };
  // (the judge's Newton seeds over the wide frame's window: [columns, rows])
  const FAR_SEEDS = [16, 12];
  // plane z's camera zoomed by f about the pane's centre (a wheel turn there, whose deltaY zooms by exp(-0.0016 deltaY),
  // as 14-interaction.js's wheel handler scales a pixel-mode wheel), once the camera has settled
  async function zoom(f) {
    const b = await ev(`(() => { const r = document.getElementById('plotL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    const s0 = (await paneOf()).v.s;
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b[0], y: b[1] });
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: b[0], y: b[1], deltaX: 0, deltaY: -Math.log(f) / 0.0016 });
    await settled({ max: 20000, until: `Math.abs(__cmwCards().main.view.s / ${s0} - ${f}) < 0.02` });
    await wait();
  }
  // The Joukowski path at x = 1/2, Everywhere, pulls points from twice the camera's window into the view (the far preimage
  // of w is about 1.5 w), and its pole on the disc, z = -i tan(pi / 6), sends the disc's points beside it far out. The
  // key at t counts that pole, so the front point at w is the far one wherever it is not near the centre, and the frame
  // must show its colour: from the carried points past the whole plane's mesh. Parked and held at x = 1/2, the frame at
  // the camera is graded by held_frames' judge against plane z's parked frame zoomed out by 0.4 (FAR_ZOOM), where those
  // points are shown: the exact picture, with at least FAR_MIN of the pixels compared having their front point past the
  // camera's window, and none whose front point the wide frame cannot show. Control: the cross-fade of plane z's and plane
  // w1's parked frames at the camera, at 1/2, does not pass the same judge. The colour layer alone (__cmwSteps({ bare:
  // true })), as the other judged suites read it: outlines and labels are drawn over it at places that differ between the
  // frames. Last on its page: plane z is left zoomed out, and the zoom leaves clipWin wider
  const FAR_ZOOM = 0.4, FAR_MIN = 200;
  async function farFrames(P0) {
    const pts = grid(P0, 48, 32, 0.9);
    await setup('__cmwSteps({ bare: true }), 1');
    await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
    ok("Joukowski all: plane z's parked frame settles", await grab('R0'), null);
    await steps({ scope: 'all', surf: 'plane', go: 1, now: true });
    ok("Joukowski all: plane w1's parked frame settles", await grab('R1'), null);
    // (both frames first, then the reference: zooming out widens clipWin, the whole plane's mesh, for good)
    const frames = [];
    for (const at of [{ scope: 'all', park: 0.5 }, { scope: 'all', hold: 0.5 }]) {
      const tag = 'M' + frames.length;
      if (at.hold != null) { await steps({ scope: 'all', surf: 'plane', go: 0, now: true }); await hold(at.hold); } else await steps(Object.assign({ surf: 'plane' }, at));
      ok(`Joukowski all ${at.hold != null ? 'held' : 'parked'} 0.5: the frame settles`, await grab(tag), null);
      frames.push({ at, tag, state: await ev('__cmwSteps()'), paper: bareCount((await lpx(pts)).px), ring: await ev('__cmwSvRing()') });
      if (at.hold != null) { await ev('window.__svScrubUp(); 1'); await wait(); }
    }
    await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
    await zoom(FAR_ZOOM);
    ok("Joukowski all: plane z's parked frame, zoomed out, settles", await grab('R0w'), null);
    for (const { at, tag: m, state, paper, ring } of frames) {
      const tag = `Joukowski all ${at.hold != null ? 'held' : 'parked'} 0.5, the points from past the camera`;
      const j = await judge('R0w', m, { seeds: FAR_SEEDS });
      info[tag] = { j, paper, ring, x: state.x, moving: state.moving };
      ok(`${tag}: at x = 0.5, coloured from z`, Math.abs(state.x - 0.5) < 0.01 && state.T === 0, state);
      ok(`${tag}: front points past the camera's window are graded, and every front point is shown`, j.far >= FAR_MIN && j.none === 0, info[tag]);
      // (Joukowski's homotopy is inverted by Newton seeded from its own points over w: the inverse pass draws the frame
      // pixel by pixel, every point past the window included, so no ring of carried points is drawn; tan z's case below
      // keeps one)
      ok(`${tag}: the inverse pass draws the frame`, !!state.glide && state.glide.path === 'inverse', { glide: state.glide, ring });
      ok(`${tag}: the frame is the exact picture (the judge passes)`, j.pass, info[tag]);
      ok(`${tag}: no point of the inner 90 % on the bare paper`, paper.paper === 0 && paper.n > 1000, info[tag]);
    }
    ok('Joukowski all 0.5: the cross-fade frame exists', await fade('R0', 'R1', 0.5, 'X'), null);
    const c = await judge('R0w', 'X', { seeds: FAR_SEEDS, as: frames[0].tag });
    info['Joukowski all 0.5, control'] = c;
    ok("Joukowski all 0.5: control: a cross-fade of the two planes' frames does not pass the judge", !c.pass && c.n >= JUDGE_MIN_N, c);
    await setup('__cmwSteps({ bare: false }), 1');
  }
  // The key along t in [0.3, 0.7]: the steps view's key at t (__cmwSvKey(1, t)) has plane w1's point and the path's pole,
  // no other (within 2e-3: the page reads the pole between its 64 steps of t on a line, off the curve by under 1e-3
  // here); and at 40 points w across the pane, in steps of 0.01, the front point changes with t only once at a time,
  // never back on the next step
  async function keyAlongT(P0, J) {
    // (the key reads the glide's pole tracks once the idle moments have made them whole; until then it reads a fallback)
    const whole = await settled({ max: 30000, until: '(() => { const k = __cmwSvKey(1, 0.5); return !!k.tracks && k.tracks.k === k.tracks.of; })()' });
    ok("Joukowski key along t: the idle moments make plane w1's pole tracks whole", whole.ok, whole);
    const keyOff = [];
    for (let s = 30; s <= 70; s += 5) {
      const got = (await ev(`__cmwSvKey(1, ${s / 100})`)).sing, want = J.poleAt(s / 100);
      if (got.length !== want.length || got.some((p, i) => Math.hypot(p[0] - want[i][0], p[1] - want[i][1]) > 2e-3)) keyOff.push({ t: s / 100, got, want });
    }
    ok("Joukowski key along t: its points are J's pole and the path's pole at t", keyOff.length === 0, keyOff);
    const ws = grid(P0, 8, 5, 0.9), seq = ws.map(() => []);
    for (let s = 30; s <= 70; s++) {
      const cs = ws.map(J.candAt(s / 100)), F = await fronts(cs.map((L) => L.map((e) => e.z)), 1, null, s / 100);
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
  const names = exampleNames();
  const EX = names.indexOf('Joukowski airfoil');
  ok('the Joukowski example is found', EX >= 0, names.length);
  await goOk(`http://localhost:${PORT}/test.html?view=steps&ns=cfar${Date.now()}`);
  await ready();
  await setup("__cmwSet('morphPaths', false), __cmwSet('alpha', 1), 1");
  await setup(`__cmwExample(${EX}); 1`);
  await wait();
  await adopted();
  {
    await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
    // the region: outside the circle |z - c| = r (the example's disc, its centre and radius as 15-examples-guide.js gives
    // them)
    const c = [-0.12, 0.1], r = 1.1244998888, outside = (z) => Math.hypot(z[0] - c[0], z[1] - c[1]) - r;
    // (the Joukowski path's candidates at t and its key's points: joukPath of the kit; the key along t reads every candidate)
    const P0 = await paneOf(), J = joukPath(outside);
    await keyAlongT(P0, J);
    await farFrames(P0);
  }

  // ---- a family of poles: w = tan z, Everywhere, parked halfway (its path's poles sweep in from far out) ----
  // The key's points stay at most 4 and finite, the ring (if the map pulls far points in) at most 4 times the window, the
  // glide's pole tracks are made once for the glide (the second key is read from the memo, at once), and no point of the
  // inner 90 % of the pane is on the bare paper
  {
    const st = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps: [{ type: 'tan', params: {} }] };
    await openState(st, 'cextan');
    await ready();
    await setup("__cmwSet('morphPaths', false), __cmwSet('alpha', 1), 1");
    await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
    const P = await paneOf(), pts = grid(P, 44, 30, 0.9);
    await steps({ scope: 'all', surf: 'plane', park: 0.5 });
    const k = await ev('(() => { const t0 = performance.now(); const a = __cmwSvKey(1, 0.5); const t1 = performance.now(); __cmwSvKey(1, 0.5); return { sing: a.sing, again: performance.now() - t1, ring: __cmwSvRing() }; })()');
    const px = (await lpx(pts)).px;
    const paper = bareCount(px).paper;
    info['tan all parked 0.5'] = Object.assign(k, { paper, n: bareCount(px).n });
    ok('tan all parked 0.5: the key has at most 4 points, all finite', Array.isArray(k.sing) && k.sing.length <= 4 && k.sing.every((p) => p.every(Number.isFinite)), k);
    ok('tan all parked 0.5: the ring, if any, reaches at most 4 times the window', !k.ring || (k.ring.m >= 1.5 && k.ring.m <= 4), k.ring);
    // (at once: under 5 ms, where making the tracks again is a whole grid search per seed step, tens of ms or more)
    ok("tan all parked 0.5: the glide's pole tracks are kept for it (a second key at once)", k.again < 5, k);
    ok('tan all parked 0.5: no point of the inner 90 % on the bare paper', paper === 0 && info['tan all parked 0.5'].n > 1000, info['tan all parked 0.5']);
  }
  // The warm draw of the glide's carried colour (svWarmCarry) waits until the chain and the input have been still for 2 s:
  // on a renderer that makes a program's machine code at its first draw it takes the main thread for a second or more,
  // which just after an edit would hold back what the edit shows (phone_toast_chain_cmd's "Added" message)
  {
    const before = await ev('__cmwSvWarm()'), t0 = await ev('performance.now()');
    await setup(`__cmwAddStep('exp'), 1`);
    let w = null;
    for (let i = 0; i < 80; i++) { w = await ev('__cmwSvWarm()'); if (w.sig === w.now && w.sig !== before.sig) break; await sleep(250); }
    info.warm = { before, w, after: w ? Math.round(w.at - t0) : null };
    ok('warm: the warm draw is made for the chain just edited', !!w && w.sig === w.now && w.sig !== before.sig, info.warm);
    ok('warm: it is made no sooner than 2 s after the edit', !!w && w.at - t0 >= 2000, info.warm);
  }
}

// ---- part chains ----
async function chainsPart() {
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
    const s = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView, shapes, steps: chainSteps };
    await openState(s, `ccc${tag}`);
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
}

// ---- part planes ----
async function planesPart() {
  // (quiet: the tiling's fix-up landed, every program linked, and a frame drawn after that, which the link's own redraw
  // asks for)
  const wait = async () => {
    await settled({ max: 60000, until: '__cmwSvFixed() && GLR.pendingLinks === 0' });
    await ev('await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))), 1');
  };
  const open = async (state, tag) => {
    await openState(state, `cpl${tag}`);
    await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof __cmwSvFixed === "function" && !!window.GLR' });
    await ev("__cmwSet('morphPaths', false), __cmwSet('alpha', 1), 1");
  };
  const step = (type, params) => ({ type, params: params || {}, on: true });
  const base = (steps, shapes) => ({ v3: true, v4: true, v5: true, v6: true, shapes, steps, nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 90 } });
  // the points z of an n x n grid over the pane's middle 90 % that pick(z) keeps, and their places w = place(z), where
  // those show on the pane
  const pairs = (P, n, pick, place) => {
    const W = [], Z = [];
    for (const z of grid(P, n, n, 0.9)) {
      if (!pick(z)) continue;
      const w = place(z);
      if (w && w.every(Number.isFinite) && shown(P, w)) { W.push(w); Z.push(z); }
    }
    return { W, Z };
  };
  // at: the frame's state (park: the thread's place); T: the colour plane; path: the
  // glide record's path the frame must have (the carried meshes': 'mesh'), null for a frame that writes no record
  async function check(tag, at, T, W, Z, min, path) {
    await ev(`__cmwSteps(${JSON.stringify({ scope: 'all', surf: 'plane', go: 0, now: true, T })}); 1`);
    await wait();
    const ref = (await lpx(Z)).px;
    await ev(`__cmwSteps(${JSON.stringify(Object.assign({ surf: 'plane', T }, at))}); 1`);
    await wait();
    const state = await ev('__cmwSteps()'), got = (await lpx(W)).px;
    const fmt = (v) => v.map((q) => +q.toFixed(3));
    info[tag] = Object.assign(tally(got, ref, { note: (k) => ({ w: fmt(W[k]), z: fmt(Z[k]) }) }), { state: { x: state.x, T: state.T, scope: state.scope, core: state.core, all: state.all, between: state.between, glide: state.glide && { path: state.glide.path, reason: state.glide.reason, u: state.glide.u } } });
    ok(`${tag}: parked at x = ${at.park}, coloured from w${T}`, Math.abs(state.x - at.park) < 1e-9 && state.T === T, info[tag].state);
    ok(`${tag}: the colour plane's colour of each point, at most 1 % wrong`, info[tag].n >= min && info[tag].wrong <= 0.01 * info[tag].n, info[tag]);
    ok(`${tag}: no point on the bare paper`, info[tag].paper === 0, info[tag]);
    if (path) ok(`${tag}: drawn by the carried meshes (the glide's path '${path}')`, !!state.glide && state.glide.path === path, info[tag].state);
  }

  // ---- beside a region of a later plane (a disc on w₁), a region of plane z, under a step with no inverse ----
  {
    // (z + 0.2 conj(z): not analytic, so its glide runs the straight line and no inverse pass draws it; at t = 1/2 the
    // points z = x + iy land at 1.1 x + 0.9 i y)
    const D0 = { c: [-1.2, 0.6], r: 0.6 };
    await open(base([step('custom', { expr: 'z+0.2*conj(z)', cut: 180 })], [{ id: 's0', kind: 'disc', c: D0.c, r: D0.r, ci: 1, visible: true },
      { id: 's1', kind: 'disc', c: [1.5, 0], r: 0.8, stage: 1, ci: 0, visible: true }]), 'l');
    const P = await paneOf();
    // (0.12 inside its rim, so the outline is clear)
    const { W, Z } = pairs(P, 90, (z) => Math.hypot(z[0] - D0.c[0], z[1] - D0.c[1]) < D0.r - 0.12, (z) => [1.1 * z[0], 0.9 * z[1]]);
    await check('beside a region of w1, Inside regions', { scope: 'in', park: 0.5 }, 0, W, Z, 100, 'mesh');
  }

  // ---- a d/dz between plane z and the colour plane, glided past it ----
  {
    await open(base([step('pown', { n: 2 }), step('deriv'), step('exp')], []), 'd');
    const P = await paneOf();
    // (x = 5/2: plane w₂'s points 2z on exp's zoom path at t = 1/2, w = 2(e^z - 1) + 1/2, kept to |Im z| < 2.5 and
    // Re z > -1.2, where e^z does not squeeze the plane into a few pixels; the points z + 2 pi i k that land there too
    // have z's colour, exp(2z) having the period pi i)
    // (the colour exp(2z) steps at its band edges, |exp(2z)| a power of 1.69, and its 12 sectors' edges: points within
    // 0.02 of one are left out, where a place a pixel off shows the next band)
    const clear = (z) => { const bx = 2 * z[0] / Math.log(1.69), by = z[1] / (Math.PI / 12); return Math.abs(bx - Math.round(bx)) * Math.log(1.69) / 2 > 0.02 && Math.abs(by - Math.round(by)) * Math.PI / 12 > 0.02; };
    // (the frame is nearest plane w₃, which is coloured: the colour plot's grid is drawn over it at the integers of w
    // (colourGrid's step at this zoom), so a place within 2.5 px of one is left out too)
    const offGrid = (v) => Math.abs(v - Math.round(v)) * P.v.s > 2.5;
    const place = (z) => { const e = Math.exp(z[0]), w = [2 * (e * Math.cos(z[1]) - 1) + 0.5, 2 * e * Math.sin(z[1])]; return w.every(offGrid) ? w : null; };
    const past = pairs(P, 60, (z) => clear(z) && Math.abs(z[1]) < 2.5 && z[0] > -1.2, place);
    await check('a d/dz before the colour plane, glided past it', { scope: 'all', park: 2.5 }, 3, past.W, past.Z, 200, 'mesh');
  }
}

const PARTS = { glide: glidePart, inregion: inregionPart, far: farPart, chains: chainsPart, planes: planesPart };
if (ONLY && !PARTS[ONLY]) throw new Error(`CMW_ONLY: no part ${ONLY} (${Object.keys(PARTS).join(', ')})`);
for (const [name, run] of Object.entries(PARTS)) if (!ONLY || ONLY === name) await run();
return { pass: fails.length === 0, fails, info };
