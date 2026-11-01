// The steps view's carried colour against the exact one (#551, #584, #590), one judge for both scopes, at rest and parked
// between planes: past the colour plane T a plane shows the colour plane's colours carried by the points, so a point w
// of the shown frame must have the colour of the front one of its points in plane z (the region tiling's sheet key),
// the wheel at the arg of that point's image in T. The shared check carryCompare (test/cdp_kit/carry_compare.js) lists
// the points (__cmwSvPre: Inverse.pointPre through the plan z → b, and parked, the deformation H_u solved first),
// ranks them by the steps view's key (__cmwSvKey: Inverse.sheetKey, Inverse.front) and reads the left pane in the
// Phase style. The cases:
// - 8 long chains (Möbius maps, powers, roots, log, Joukowski, translations; of exp's and sin's families the members
//   m = -6 … 6), Everywhere, on the last plane at rest, at three colour planes each;
// - the Joukowski airfoil example, Inside regions (its region: outside the circle through 1) and Everywhere, plane w1 at
//   rest coloured from z, and Everywhere parked at 0.3 and 0.6 (the deformation's poles in the window: the staircases of #551);
// - w = z^2, z^3 on the annulus 0.6 < |z| < 1.6 (the image covers n times), Inside regions and Everywhere, at rest and
//   parked halfway.
// Each passes with at most MAX_BAD of its samples wrong and none left on the bare paper; then a lost and restored GL
// context draws exact again.
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
// (a state opened in its own namespace, in the steps view, Phase colours)
const open = async (st) => {
  const id = 'sce' + Date.now() + Math.floor(Math.random() * 1e6);
  await view(1280, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(300);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${id}', ${JSON.stringify(JSON.stringify(st))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${id}&lang=en&view=steps` }); await sleep(2500);
  for (let i = 0; i < 120 && !(await ev('typeof __cmwSvPre === "function"').catch(() => false)); i++) await sleep(250);
  await ev(`__cmwSet('dc', 'phase'); 1`);
};
// (the view brought to { go | park, T, scope } and asked again until it holds, as a state the page loads late puts the
// view back on its first plane; then the programs linked and the plane drawn again)
const reach = async (name, o) => {
  let there = false, sv = null;
  for (let i = 0; i < 50 && !there; i++) {
    sv = await ev('__cmwSteps()');
    there = sv.T === o.T && sv.scope === o.scope && !sv.play && !sv.anim && (o.park != null ? Math.abs(sv.x - o.park) < 1e-9 : sv.i === o.go && Math.abs(sv.x - o.go) < 1e-9);
    if (!there) {
      await ev(`__cmwSteps({ T: ${o.T}, scope: ${JSON.stringify(o.scope)}, surf: 'plane' }); __cmwSteps(${JSON.stringify(o.park != null ? { park: o.park } : { go: o.go, now: true })}); 1`);
      await sleep(250);
    }
  }
  ok(`${name}: the view is there`, there, sv);
  if (!there) return false;
  for (let i = 0; i < 100; i++) { if (await ev('GLR.pendingLinks === 0')) break; await sleep(100); }
  await sleep(400);
  await settled({ max: 20000 });
  await ev(`__cmwSteps({ surf: 'plane' }); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  return true;
};
const judge = async (name, o = {}) => {
  const r = await carryCompare(o);
  info.cases[name] = r;
  // (a chain whose preimages here are too many to list, as exp first and sin after it: no samples, said in info)
  if (r && r.unlisted > 500 && !o.must) { r.note = 'the preimages cannot be listed here (more than 512)'; return r; }
  ok(`${name}: the carried colour is the exact one (at most ${MAX_BAD * 100} % of ${r && r.considered} samples off)`, r && r.considered >= MIN_N && r.rate <= MAX_BAD, r);
  ok(`${name}: no sample on the bare paper`, r && r.blank === 0, r);
  return r;
};

// the long chains, Everywhere, at rest on the last plane
for (const [name, steps] of Object.entries(CHAINS)) {
  const last = steps.length, Ts = [...new Set([0, Math.floor(last / 2), last - 1])];
  await open({ v3: true, v4: true, v5: true, v6: true, shapes: [], steps, nextId: 50, focus: 0, dc: 'phase', srcView: { cx: 0, cy: 0, s: 90 } });
  for (const T of Ts) {
    const key = `${name} / T = ${T}`;
    if (await reach(key, { go: last, T, scope: 'all' })) await judge(key);
  }
}

// (shaders' case, #584) the Joukowski airfoil example: its region is the outside of the circle |z - c| = r
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const EX = names.indexOf('Joukowski airfoil');
ok('the Joukowski example is found', EX >= 0, names.length);
if (EX >= 0) {
  await open({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0 });
  await ev(`__cmwExample(${EX}); 1`);
  await sleep(1500);
  await ev(`__cmwSet('dc', 'phase'); 1`);
  const own = '(z) => Math.hypot(z[0] + 0.12, z[1] - 0.1) > 1.1244998888';
  // (the circle, outlined over the colour, and the trailing edge's mark and label, as shaders' case left them out)
  const skip = '(z) => Math.abs(Math.hypot(z[0] + 0.12, z[1] - 0.1) - 1.1244998888) < 0.08';
  if (await reach('Joukowski, Inside regions, w1 at rest', { go: 1, T: 0, scope: 'in' })) await judge('Joukowski, Inside regions, w1 at rest', { own, skip, skipW: '(w) => Math.hypot(w[0] - 1.6, w[1] - 0.1) < 1.1', must: true });
  // (shaders' #587 review: Everywhere at rest, each point against its front preimage under the shared key)
  if (await reach('Joukowski, Everywhere, w1 at rest', { go: 1, T: 0, scope: 'all' })) await judge('Joukowski, Everywhere, w1 at rest', { skip, skipW: '(w) => Math.hypot(w[0] - 1.6, w[1] - 0.1) < 1.1', must: true });
  // (#551 the staircases: H_u's poles in the window while parked, Everywhere)
  for (const park of [0.3, 0.6]) {
    const key = `Joukowski, Everywhere, parked at ${park}`;
    if (await reach(key, { park, T: 0, scope: 'all' })) await judge(key, { nx: 32, ny: 20, skip, must: true });
  }
}

// (shaders' case, #584, multiple coverings) w = z^n on the annulus 0.6 < |z| < 1.6, its image covering n times
for (const n of [2, 3]) {
  await open({ v3: true, v4: true, nextId: 50, focus: 0, rightMode: 'image', dc: 'phase', srcView: { cx: 0, cy: 0, s: 90 }, shapes: [{ id: 1, kind: 'annulus', c: [0, 0], r1: 0.6, r2: 1.6 }], steps: [{ type: 'pown', params: { n } }] });
  const own = '(z) => { const m = Math.hypot(z[0], z[1]); return m > 0.6 && m < 1.6; }';
  // (the annulus's circles, outlined over the colour on every plane)
  const skip = '(z) => { const m = Math.hypot(z[0], z[1]); return Math.abs(m - 0.6) < 0.08 || Math.abs(m - 1.6) < 0.08; }';
  for (const [scope, park] of [['in', null], ['all', null], ['in', 0.5], ['all', 0.5]]) {
    const key = `z^${n} ${scope === 'in' ? 'Inside regions' : 'Everywhere'} ${park == null ? 'at rest' : 'parked at ' + park}`;
    // (parked, the principal power z^p, p = 1 + (n - 1) u: its cut, arg z = ±π, lands on arg w = ±pπ, where either side may
    // show)
    const p = 1 + (n - 1) * (park || 0), skipW = park == null ? null : `(w) => [${p} * Math.PI, ${-p} * Math.PI].some((a) => { const d = Math.atan2(w[1], w[0]) - a; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) < 0.06; })`;
    if (await reach(key, park == null ? { go: 1, T: 0, scope } : { park, T: 0, scope })) await judge(key, Object.assign({ must: true, skip, skipW }, park == null ? {} : { nx: 32, ny: 20 }, scope === 'in' ? { own } : {}));
  }
}

// (perf on #574) a lost GL context: once the browser gives it back, the carry draws exact again (the last case, sampled
// again)
await ev('(() => { const x = GLR.gl.getExtension("WEBGL_lose_context"); window.__sclc = x; x.loseContext(); return 1; })()');
await sleep(500);
await ev('window.__sclc.restoreContext(); 1');
await sleep(1500);
for (let i = 0; i < 100; i++) { if (await ev('GLR.pendingLinks === 0')) break; await sleep(100); }
await sleep(400);
await ev(`__cmwSteps({ surf: 'plane' }); new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
await judge('after a lost and restored GL context', { nx: 32, ny: 20, must: true, skip: '(z) => { const m = Math.hypot(z[0], z[1]); return Math.abs(m - 0.6) < 0.08 || Math.abs(m - 1.6) < 0.08; }' });
const all = Object.values(info.cases).filter((r) => r && !r.note);
info.summary = `${all.filter((r) => r.considered >= MIN_N && r.rate <= MAX_BAD && r.blank === 0).length} of ${all.length} cases pass`;
return { pass: fails.length === 0, fails, info };
