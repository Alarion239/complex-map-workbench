// (Set to 100 % opacity: the front point's colour alone is read; the Opacity slider's 85 % default mixes the layers behind.)
// The steps view's carried colour mid-glide, Everywhere, where the glide pulls points from past the camera's window into
// the view, and the sheet key at t (the glide map's poles at t beside plane b's points, __cmwSvKey(b, t)), against the
// exact picture (held_frames' judge), its reference zoomed out for points past the camera.
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
// the left pane's pixels (lpx), its camera and size (paneOf), the front point (fronts) and the Joukowski path (joukPath):
// test/lib/carry_kit.js
const { lpx, paneOf, bareCount, grid, fronts, joukPath } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'carry_kit.js'), 'utf8'));
// the held thread (hold; window.__svScrubUp lets go), the kept frames (grab), their cross-fade (fade) and the exact
// picture's judge (judge): test/lib/held_frames.js
const { hold, grab, fade, judge, JUDGE_MIN_N } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
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
await adopted();
{
  await steps({ scope: 'all', surf: 'plane', go: 0, now: true });
  // the region: outside the circle |z - c| = r (the example's disc, its centre and radius as 15-examples-guide.js gives
  // them)
  const c = [-0.12, 0.1], r = 1.1244998888, outside = (z) => Math.hypot(z[0] - c[0], z[1] - c[1]) - r;
  // (the Joukowski path's candidates at t and its key's points: joukPath of the kit; the key along t reads every candidate)
  const P0 = await paneOf(), J = joukPath(outside, () => false);
  await keyAlongT(P0, J);
  await farFrames(P0);
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
