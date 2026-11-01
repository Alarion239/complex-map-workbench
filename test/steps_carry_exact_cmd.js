// The steps view's carried colour against the exact one, one judge for both scopes, at rest and parked between planes:
// past the colour plane T a plane shows the colour plane's colours carried by the points, so a point w of the shown
// frame must have the colour of the front one of its points in plane z (the region tiling's sheet key), the wheel at the
// arg of that point's image in T. The shared check carryCompare (test/cdp_kit/carry_compare.js) lists the points from
// the frame's own maps (__cmwSvFrame), ranks them by its key (Inverse.sheetKey, Inverse.front) and reads the left pane
// in the Phase style. The cases:
// - 8 long chains (Möbius maps, powers, roots, log, Joukowski, translations; of exp's and sin's families the members
//   m = -6 … 6, or -2 … 2 where exp's and sin's families multiply past the 512 points listed), Everywhere, on the last
//   plane at rest, at three colour planes each;
// - the Joukowski airfoil example, Inside regions (its region: outside the circle through 1) and Everywhere, plane w1 at
//   rest coloured from z, and Everywhere parked at 0.3 and 0.6 (the deformation's poles and its disc branch's tanh pole
//   in the window);
// - w = z^2, z^3 on the annulus 0.6 < |z| < 1.6 (the image covers n times), Inside regions and Everywhere, at rest and
//   parked halfway.
// Each passes with at most MAX_BAD of its samples wrong, every sample's points listed, and none left on the bare paper;
// then a lost and restored GL context draws exact again. The rows of steps_carry_inregion_cmd.js (the Joukowski and
// annulus cases) keep its thresholds or stricter: a tolerance of 14 per channel, over 400 (Joukowski) or 200 (the
// powers) samples judged, and over 1500 region points coloured, none on the paper, Inside regions at rest.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = { cases: {} };
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const MAX_BAD = 0.01;   // the share of a case's samples that may be wrong (antialiased seams, the probe's rounding)
const MIN_N = 100;      // the samples a case must judge
const M = (a, b, c, d) => ({ type: 'mobius', params: { a, b, c, d }, on: true });
const P = (n) => ({ type: 'pown', params: { n }, on: true });
const A = (c) => ({ type: 'add', params: { c }, on: true });
const R = (n) => ({ type: 'root', params: { n, cut: 180, k: 0 }, on: true });
const CAY = M('1', '-i', '1', 'i');
const E = { type: 'exp', params: {}, on: true }, SIN = { type: 'sin', params: {}, on: true }, J = { type: 'joukowski', params: {}, on: true };
const CHAINS = {
  'Cayley, cube, exp, Möbius': [CAY, P(3), E, M('1', '-1', '1', '1')],
  'exp, Möbius, square, sin': [E, M('1', '-1', '1', '1'), P(2), SIN],
  'square, log, Cayley, cube, exp': [P(2), { type: 'log', params: { cut: 180, k: 0 }, on: true }, CAY, P(3), E],
  'Joukowski, square, sin, +i, square': [J, P(2), SIN, A('i'), P(2)],
  'Joukowski, square, +i, √, Cayley': [J, P(2), A('i'), R(2), CAY],
  'z/10, square, Cayley, cube': [M('1', '0', '0', '10'), P(2), CAY, P(3)],
  'Cayley, cube, +i/2, square, Möbius': [CAY, P(3), A('0.5i'), P(2), M('1', '-1', '1', '1')],
  'the rabbit, three times': [P(2), A('-0.1226+0.7449i'), P(2), A('-0.1226+0.7449i'), P(2), A('-0.1226+0.7449i')],
};
// (the chains whose families' members are listed to m = ±2: their periods, 2π, still cover the window)
const FAM = { 'exp, Möbius, square, sin': 2 };
// (a state opened in its own namespace, in the steps view, Phase colours)
const open = async (st) => {
  const id = 'sce' + Date.now() + Math.floor(Math.random() * 1e6);
  await view(1280, 800, false, false);
  await go(`http://localhost:${PORT}/gl-helpers.html`);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${id}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await go(`http://localhost:${PORT}/test.html?ns=${id}&lang=en&view=steps`);
  await settled({ until: 'typeof __cmwSvFrame === "function" && typeof __cmwSteps === "function"', max: 30000 });
  await ev(`__cmwSet('dc', 'phase'); 1`);
};
// (the left pane drawn and unchanged over a quiet page: the parked frame's fix-up lands a few idle slices after it is
// first drawn)
const steady = async () => {
  const sig = '(() => { const c = document.getElementById("canvasL"); return Array.from(c.getContext("2d").getImageData(0, 0, c.width, c.height).data.filter((v, i) => i % 4093 === 0)).join(","); })()';
  let prev = null;
  for (let i = 0; i < 20; i++) {
    await settled({ until: 'GLR.pendingLinks === 0 && !__cmwSteps().play && !__cmwSteps().anim', max: 20000 });
    const now = await ev(sig);
    if (now === prev) return true;
    prev = now;
  }
  return false;
};
// (the view brought to { go | park, T, scope } and asked again until it holds, as a state the page loads late puts the
// view back on its first plane; then the programs linked and the plane drawn again)
const reach = async (name, o) => {
  const want = `__cmwSteps().T === ${o.T} && __cmwSteps().scope === ${JSON.stringify(o.scope)} && !__cmwSteps().play && !__cmwSteps().anim && ${o.park != null ? `Math.abs(__cmwSteps().x - ${o.park}) < 1e-9` : `__cmwSteps().i === ${o.go} && Math.abs(__cmwSteps().x - ${o.go}) < 1e-9`}`;
  let there = false;
  for (let i = 0; i < 20 && !there; i++) {
    await ev(`__cmwSteps({ T: ${o.T}, scope: ${JSON.stringify(o.scope)}, surf: 'plane' }); __cmwSteps(${JSON.stringify(o.park != null ? { park: o.park } : { go: o.go, now: true })}); 1`);
    there = (await settled({ until: want, max: 3000 })).ok && await ev(want);
  }
  ok(`${name}: the view is there`, there, await ev('__cmwSteps()'));
  if (!there) return false;
  ok(`${name}: the frame is drawn and holds still`, await steady(), null);
  return true;
};
const judge = async (name, o = {}) => {
  const r = await carryCompare(o);
  info.cases[name] = r;
  ok(`${name}: every sample's points are listed`, r && r.unlisted === 0, r && { unlisted: r.unlisted });
  ok(`${name}: the carried colour is the exact one (at most ${MAX_BAD * 100} % of ${r && r.considered} samples off)`, r && r.considered >= (o.min || MIN_N) && r.rate <= MAX_BAD, r);
  ok(`${name}: no sample on the bare paper`, r && r.blank === 0 && r.paper === 0 && r.filled >= (o.filled || 0), r);
  return r;
};

// the long chains, Everywhere, at rest on the last plane
for (const [name, steps] of Object.entries(CHAINS)) {
  const last = steps.length, Ts = [...new Set([0, Math.floor(last / 2), last - 1])];
  await open({ v3: true, v4: true, v5: true, v6: true, shapes: [], steps, nextId: 50, focus: 0, dc: 'phase', srcView: { cx: 0, cy: 0, s: 90 } });
  for (const T of Ts) {
    const key = `${name} / T = ${T}`;
    if (await reach(key, { go: last, T, scope: 'all' })) await judge(key, FAM[name] ? { fam: FAM[name] } : {});
  }
}

// the Joukowski airfoil example: its region is the outside of the circle |z - c| = r
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const EX = names.indexOf('Joukowski airfoil');
ok('the Joukowski example is found', EX >= 0, names.length);
if (EX >= 0) {
  await open({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0 });
  await ev(`__cmwExample(${EX}); 1`);
  await settled({ until: '__cmwSteps().planes.length === 2', max: 20000 });
  await ev(`__cmwSet('dc', 'phase'); 1`);
  const own = { outside: [-0.12, 0.1, 1.1244998888] };
  // (the circle, outlined over the colour, and the trailing edge's mark and label)
  const skip = { circles: [[-0.12, 0.1, 1.1244998888]], eps: 0.08 }, skipW = { discs: [[1.6, 0.1, 1.1]] };
  if (await reach('Joukowski, Inside regions, w1 at rest', { go: 1, T: 0, scope: 'in' })) await judge('Joukowski, Inside regions, w1 at rest', { own, skip, skipW, nx: 60, ny: 40, tol: 14, min: 401, filled: 1501 });
  // (Everywhere at rest: each point against its front preimage under the shared key)
  if (await reach('Joukowski, Everywhere, w1 at rest', { go: 1, T: 0, scope: 'all' })) await judge('Joukowski, Everywhere, w1 at rest', { skip, skipW, nx: 60, ny: 40, tol: 14, min: 401 });
  // (parked, Everywhere: H_u's poles and its disc branch's tanh pole in the window)
  for (const park of [0.3, 0.6]) {
    const key = `Joukowski, Everywhere, parked at ${park}`;
    if (await reach(key, { park, T: 0, scope: 'all' })) await judge(key, { nx: 32, ny: 20, skip, skipW, nex: 60 });
  }
}

// (multiple coverings) w = z^n on the annulus 0.6 < |z| < 1.6, its image covering n times
for (const n of [2, 3]) {
  await open({ v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', dc: 'phase', srcView: { cx: 0, cy: 0, s: 90 }, shapes: [{ id: 1, kind: 'annulus', c: [0, 0], r1: 0.6, r2: 1.6 }], steps: [{ type: 'pown', params: { n } }] });
  const own = { annulus: [0.6, 1.6] };
  // (the annulus's circles, outlined over the colour on every plane)
  const skip = { circles: [[0, 0, 0.6], [0, 0, 1.6]], eps: 0.08 };
  for (const [scope, park] of [['in', null], ['all', null], ['in', 0.5], ['all', 0.5]]) {
    const key = `z^${n} ${scope === 'in' ? 'Inside regions' : 'Everywhere'} ${park == null ? 'at rest' : 'parked at ' + park}`;
    // (parked, the principal power z^p, p = 1 + (n - 1) u: its cut, arg z = ±π, lands on arg w = ±pπ, where either side may
    // show)
    const p = 1 + (n - 1) * (park || 0), skipW = park == null ? null : { rays: [p * Math.PI, -p * Math.PI], eps: 0.06 };
    if (await reach(key, park == null ? { go: 1, T: 0, scope } : { park, T: 0, scope })) await judge(key, Object.assign({ skip, skipW, nx: 44, ny: 30, tol: 14, min: 201 }, scope === 'in' ? { own } : {}));
  }
}

// a lost GL context: once the browser gives it back, the carry draws exact again (the last case, sampled again)
await ev('(() => { const x = GLR.gl.getExtension("WEBGL_lose_context"); window.__sclc = x; x.loseContext(); return 1; })()');
await settled({ until: 'GLR.lost', max: 5000, panes: false });
await ev('window.__sclc.restoreContext(); 1');
await settled({ until: '!GLR.lost && GLR.ok', max: 10000, panes: false });
ok('after a lost and restored GL context: the frame is drawn and holds still', await steady(), null);
await judge('after a lost and restored GL context', { nx: 32, ny: 20, skip: { circles: [[0, 0, 0.6], [0, 0, 1.6]], eps: 0.08 } });
// (every case judged: a page that stopped answering must not pass by judging none; 8 chains' 2-3 colour planes, 4 of
// Joukowski, 8 of the powers and the restored context)
const want = Object.values(CHAINS).reduce((n, st) => n + new Set([0, Math.floor(st.length / 2), st.length - 1]).size, 0) + 4 + 8 + 1;
ok('every case was judged', Object.keys(info.cases).length === want, { judged: Object.keys(info.cases).length, want });
const all = Object.values(info.cases).filter(Boolean);
info.summary = `${all.filter((r) => r.considered >= MIN_N && r.rate <= MAX_BAD && r.blank === 0).length} of ${all.length} cases pass`;
return { pass: fails.length === 0, fails, info };
