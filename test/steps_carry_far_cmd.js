// (Set to 100 % opacity: the front point's colour alone is read; the Opacity slider's 85 % default mixes the layers behind.)
// The steps view's carried colour mid-glide, Everywhere, where the glide pulls points from past the camera's window into
// the view, and the sheet key at t (the glide map's poles at t beside plane b's points, __cmwSvKey(b, t)), against the
// exact colour pulled back pixel by pixel as steps_carry_inregion_cmd.js reads it, the reference zoomed out for points
// past the camera.
// Paths are off in every page: the glide's paths t -> H_t(z) are drawn over the colour, which is what is read.
// - The Joukowski airfoil w = (z + 1/z) / 2, Everywhere parked and held at x = 1/2 (drawn by the inverse pass; the front
//   point under the key with the path's pole), and the front point along t from 0.3 to 0.7.
// - w = tan z, Everywhere parked halfway: a family of poles; the key and the ring stay bounded, the pane covered.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
// (quiet: no GL frame pending, and the tiling's fix-up landed under a parked map)
const wait = async () => { await settled({ max: 20000, until: '__cmwSvFixed()' }); };
// every hook the suite calls is defined, and the page is quiet: a page still starting fails here, not in a later read
const HOOKS = ['__cmwSet', '__cmwSteps', '__cmwExample', '__cmwCards', '__cmwSvKey', '__cmwSvFixed', '__cmwSvRing', '__cmwSvWarm', '__cmwSvX', '__cmwAddStep'];
const ready = async () => {
  const r = await settled({ max: 30000, until: HOOKS.map((h) => `typeof ${h} === "function"`).join(' && ') });
  if (!r.ok) throw new Error('the page hooks are not up after the navigation: ' + JSON.stringify(r));
};
// a navigation with no load event, and an { __exc } answer, fail the suite where they happen: a thrown error is the suite's failure
const goOk = async (url) => { if (!(await go(url))) throw new Error('no load event for ' + url); };
const need = (r, what) => { if (r && r.__exc !== undefined) throw new Error(what + ' failed: ' + r.__exc); return r; };
const setup = async (expr) => need(await ev(expr), expr.slice(0, 60));
const steps = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); __cmwSteps({ T: 0 }); 1`); await wait(); };
// the left pane's pixels (lpx), its camera and size (paneOf), the pixel compare (tally), the front point (fronts) and the Joukowski
// path (joukPath): test/lib/carry_kit.js
const { lpx, paneOf, exampleNames, tally, bareCount, grid, shown, fronts, joukPath } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// the held thread (hold; window.__svScrubUp lets go): test/lib/held_frames.js
const { hold } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
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
// The Joukowski path's candidates at t and its key's points: joukPath of the kit; left out besides the circle's outline: the
// unit circle (H_t's seam, 0.08) and the label (1.1 around the trailing edge's mark, 77 px at this view's 70 px per unit)
const joukFar = (outside) => joukPath(outside, (z, w) => Math.abs(Math.hypot(z[0], z[1]) - 1) < 0.08 || Math.hypot(w[0] - 1.6, w[1] - 0.1) < 1.1);
// The Joukowski path at x = 1/2, Everywhere, pulls points from twice the camera's window into the view (the far preimage
// of w is about 1.5 w), and its pole on the disc, z = -i tan(pi / 6), sends the disc's points beside it far out. The
// key at t counts that pole, so the front point at w is the far one wherever it is not near the centre, and the frame
// must show its colour: from the carried points past the whole plane's mesh. Over the inner 90 % of the pane (48 x 32
// points), parked and held at x = 1/2: the frame at the camera, and the reference colours of the front points (plane
// z, coloured from z) read after zooming plane z out by 0.4, where they are shown. Last on its page: plane z is left
// zoomed out, and the zoom leaves clipWin wider
async function farFrames(P0, J) {
  const cand = J.candAt(0.5), pts = grid(P0, 48, 32, 0.9);
  // (the front point at each w and 1.5 px away: a point whose front moves more than 0.06 there, 4 px at this view's
  // 70 px per unit, is on a seam of the key's choice, left out)
  const d = 1.5 / P0.v.s, nb = [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]];
  const C5 = pts.flatMap((w) => nb.map(([a, e]) => cand([w[0] + a, w[1] + e])));
  const F5 = await fronts(C5.map((L) => L.map((e) => e.z)), 1, J.poleAt(0.5));
  const at5 = (k, j) => (F5[5 * k + j] < 0 ? null : C5[5 * k + j][F5[5 * k + j]]);
  const W = [], Z = [];
  let farN = 0;
  pts.forEach((w, k) => {
    const f = at5(k, 0);
    if (!f || f.out || [1, 2, 3, 4].some((j) => { const g = at5(k, j); return !g || Math.hypot(g.z[0] - f.z[0], g.z[1] - f.z[1]) > 0.06; })) return;
    W.push(w); Z.push(f.z);
    if (!shown(P0, f.z)) farN++;
  });
  // (both frames first, then the reference: zooming out widens clipWin, the whole plane's mesh, for good)
  const frames = [];
  for (const at of [{ scope: 'all', park: 0.5 }, { scope: 'all', hold: 0.5 }]) {
    if (at.hold != null) { await steps({ scope: 'all', surf: 'plane', go: 0, now: true }); await hold(at.hold); } else await steps(Object.assign({ surf: 'plane' }, at));
    frames.push({ at, state: await ev('__cmwSteps()'), got: (await lpx(W)).px, ring: await ev('__cmwSvRing()') });
    if (at.hold != null) { await ev('window.__svScrubUp(); 1'); await wait(); }
  }
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  await zoom(0.4);
  const P1 = await paneOf(), ref = (await lpx(Z)).px;
  for (const { at, state, got, ring } of frames) {
    const tag = `Joukowski all ${at.hold != null ? 'held' : 'parked'} 0.5, the points from past the camera`;
    let hidden = 0;
    const { n, wrong, paper, worst } = tally(got, ref, { skip: (k) => { const h = !shown(P1, Z[k]); if (h) hidden++; return h; } });
    info[tag] = { n, wrong, paper, worst, hidden, far: farN, ring, x: state.x, moving: state.moving };
    ok(`${tag}: at x = 0.5, coloured from z`, Math.abs(state.x - 0.5) < 0.01 && state.T === 0, state);
    // (of the 1536 points, about 1450 are kept and about 900 of them have their front point past the camera's window:
    // at least 200 such points, so the case is about them, and at least 800 points compared in all)
    ok(`${tag}: front points past the camera's window are checked`, farN > 200 && hidden === 0, info[tag]);
    // (Joukowski's homotopy is inverted by Newton seeded from its own points over w: the inverse pass draws the frame
    // pixel by pixel, every point past the window included, so no ring of carried points is drawn; tan z's case below
    // keeps one)
    ok(`${tag}: the inverse pass draws the frame`, !!state.glide && state.glide.path === 'inverse', { glide: state.glide, ring });
    ok(`${tag}: the front point's colour, at most 1 % wrong`, n > 800 && wrong <= 0.01 * n, info[tag]);
    ok(`${tag}: no point on the bare paper`, paper === 0, info[tag]);
  }
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
    const cs = ws.map(J.candAt(s / 100)), F = await fronts(cs.map((L) => L.map((e) => e.z)), 1, (await ev(`__cmwSvKey(1, ${s / 100})`)).sing);
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
{
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  // the region: outside the circle |z - c| = r (the example's disc, its centre and radius as 15-examples-guide.js gives
  // them)
  const c = [-0.12, 0.1], r = 1.1244998888, outside = (z) => Math.hypot(z[0] - c[0], z[1] - c[1]) - r;
  const P0 = await paneOf(), J = joukFar(outside);
  await keyAlongT(P0, J);
  await farFrames(P0, J);
}

// ---- a family of poles: w = tan z, Everywhere, parked halfway (its path's poles sweep in from far out) ----
// The key's points stay at most 4 and finite, the ring (if the map pulls far points in) at most 4 times the window, the
// glide's pole tracks are made once for the glide (the second key is read from the memo, at once), and no point of the
// inner 90 % of the pane is on the bare paper
{
  const ns = `cextan${Date.now()}`;
  const st = { v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', srcView: { cx: 0, cy: 0, s: 60 }, shapes: [], steps: [{ type: 'tan', params: {} }] };
  await goOk(`http://localhost:${PORT}/gl-helpers.html`);
  await setup(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await goOk(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
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
return { pass: fails.length === 0, fails, info };
