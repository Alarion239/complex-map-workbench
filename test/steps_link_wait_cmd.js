// The steps view's glide over a step whose homotopy the inverse pass inverts (Sheets of the logarithm, plane 0 to 1,
// Inside regions) while the inverse pass's program is still linking: GLR.drawInverse answers 'pending' for the glide's
// first LINK_MS, and GLR.inverseState with it (a renderer with parallel compile answers so until the link lands; this one links at once, so the
// suite stands in for the wait). The glide waits for the link on its first plane, and no frame is drawn by the carried
// mesh. Each animation frame is read in a requestAnimationFrame loop: the thread's place and the glide's record
// (__cmwSteps().glide, a new record for each frame drawn between the planes):
// - no frame's path is the carried mesh;
// - while the link is pending the thread stays on plane 0;
// - once it has linked, the glide runs, its frames between the planes drawn by the inverse pass (one at least: a
//   software renderer's first draw of the program takes most of the glide's time), and arrives on plane 1.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const LINK_MS = 400;
await view(1200, 800, false, false);
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const ex = names.indexOf('Sheets of the logarithm');
ok('the example is found', ex >= 0, names.length);
if (ex >= 0) {
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=lkw${Date.now()}`);
  await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwExample(${ex}); 1`);
  await settled({ max: 30000 });
  await ev(`__cmwSteps({ scope: 'in', surf: 'plane', go: 0, now: true }); 1`);
  await settled({ max: 30000 });
  await ev(`(() => {
    const R = window.__lkw = { frames: [], last: null, done: false, t0: performance.now(), draw: GLR.drawInverse, state: GLR.inverseState };
    const linking = () => performance.now() - R.t0 < ${LINK_MS};
    GLR.drawInverse = (st) => (linking() ? 'pending' : R.draw(st));
    GLR.inverseState = (st) => (linking() ? 'pending' : R.state(st));
    const tick = () => {
      const s = __cmwSteps(), g = s.glide, t = Math.round(performance.now() - R.t0), f = { t, x: +s.x.toFixed(3) };
      if (g && g !== R.last) { R.last = g; Object.assign(f, { u: +g.u.toFixed(3), path: g.path, reason: g.reason }); }
      R.frames.push(f);
      if (!R.done) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    __cmwSteps({ go: 1 });
    return 1;
  })()`);
  await settled({ max: 60000, until: '!__cmwSteps().moving && performance.now() - window.__lkw.t0 > 1000' });
  const r = await ev('(() => { const R = window.__lkw; R.done = true; GLR.drawInverse = R.draw; GLR.inverseState = R.state; return { frames: R.frames, x: __cmwSteps().x }; })()');
  const drawn = r.frames.filter((f) => f.path), mesh = drawn.filter((f) => f.path === 'mesh');
  const early = r.frames.filter((f) => f.t < LINK_MS - 50), moved = early.filter((f) => f.x > 1e-6);
  const inv = drawn.filter((f) => f.path === 'inverse' && f.u > 1e-6 && f.u < 1 - 1e-6);
  info.run = { log: r.frames.map((f) => f.t + ':' + f.x + (f.path ? ':' + f.path : '')).join(' '), frames: r.frames.length, drawn: drawn.length, mesh: mesh.length, inverse: inv.length, meshFrames: mesh.slice(0, 3), early: early.length, moved: moved.slice(0, 3), x: r.x };
  ok('no frame of the glide is drawn by the carried mesh', mesh.length === 0, info.run);
  ok('while the link is pending the thread stays on plane 0', early.length > 0 && moved.length === 0, info.run);
  ok('once linked, the inverse pass draws the frames between the planes', inv.length >= 1, info.run);
  ok('the glide arrives on plane 1', r.x === 1, info.run);
}
return { pass: fails.length === 0, fails, info };
