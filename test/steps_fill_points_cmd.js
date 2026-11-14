// The steps view's carried colour mid-glide, the cut fill drawn from its point pass (GLR.fillPointsStats), held a quarter
// and half way through the glide of a step whose path has a cut the sheets continue (Sheets of the logarithm, Square
// root and its sheets). Inside regions, on the example's own chain, the inverse pass draws the frame (the step's
// homotopy inverted by its exact ops), the exact picture with no mesh fill. The inverse pass draws such a glide
// Everywhere too, so the Everywhere cases put a step it does not invert before the cut's step (z^3 + z: a polynomial
// of degree 3) and glide through the cut's step (plane 1 to 2), where the carried mesh draws the frame:
// - once the fill's programs have linked, every frame's fill is drawn from its point pass (the fill never evaluates its
//   places itself), none with the sheet program standing in;
// - no frame stands in after the point pass has drawn for the same fill program, from the page's first frame on: a
//   program build switches to the point pass at most once;
// - the frame held at a place is the same, pixel for pixel, after the thread is parked elsewhere and back.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && typeof GLR.fillPointsStats === "function"' }); };
const steps = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); 1`); await settled({ max: 20000 }); };
// canvasL's pixels kept as held_frames.js's grab keeps them (__heldPx[tag]), read only once the panes' frames are drawn
// and from a fresh pair of reads (two equal reads can both precede a frame still pending)
const held = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const grab = async (tag) => {
  await settled({ max: 30000 });
  await ev('(window.__heldPx || (window.__heldPx = {}))._prev = null; 1');
  return held.grab(tag);
};
// (the exact difference: every pixel whose RGBA differs at all counts)
const diff = (a, b) => ev(`(() => { const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}]; let px = 0, max = 0;
  for (let i = 0; i < A.length; i += 4) { let m = 0; for (let c = 0; c < 4; c++) m = Math.max(m, Math.abs(A[i + c] - B[i + c])); if (m) px++; if (m > max) max = m; }
  return { px, max, of: A.length / 4 }; })()`);
// (a redraw of both panes under the setting just made)
const redraw = () => ev('__cmwHideStrokes(false), 1');
// (at rest: the tiling's fix-up landed and no SphereMesh job is running or queued)
const rest = '__cmwSvFixed() && !__cmwSphere().running && !__cmwSphere().jobs.length';
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
for (const name of ['Sheets of the logarithm', 'Square root and its sheets']) {
  const ex = names.indexOf(name);
  ok(`${name}: the example is found`, ex >= 0, names.length);
  if (ex < 0) continue;
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=cfpt${Date.now()}`);
  await ready();
  await ev(`__cmwExample(${ex}); 1`);
  await adopted();
  await settled({ max: 20000 });
  for (const scope of ['in', 'all']) for (const x of [0.25, 0.5]) {
    const tag = `${name} ${scope} ${x}`;
    // (Everywhere: the cubic put first, once; the cut's step is then step 2)
    if (scope === 'all' && x === 0.25) { await ev(`__cmwAddStep('custom', { expr: 'z^3+z' }, 0), 1`); await settled({ max: 20000 }); }
    const p0 = scope === 'all' ? 1 : 0;
    await steps({ scope, surf: 'plane', go: p0, now: true });
    await steps({ scope, surf: 'plane', park: p0 + x });
    // (parked: the tiling's fix-up lands once and the region mask's SphereMesh after it, each changing the frame, so
    // the frames are read after them; the redraw between the two waits asks for a mesh the parked frame did not)
    await settled({ max: 60000, until: rest });
    await redraw();
    await settled({ max: 60000, until: rest });
    // (and the fill's mask, which the fill draws through once linked: the sheet program stands in until then)
    await settled({ max: 30000, until: 'GLR.chainProgs().includes("regionKSCptm")' });
    const path = await ev('(() => { const g = __cmwSteps().glide; return g && g.path; })()');
    if (scope === 'in') { info[tag] = { path }; ok(`${tag}: the inverse pass draws the frame`, path === 'inverse', info[tag]); continue; }
    const st0 = await ev('GLR.fillPointsStats()');
    await redraw();
    const a = await grab('here');
    // (parked elsewhere on the same glide and back: the frame at x drawn anew)
    await steps({ scope, surf: 'plane', park: p0 + 0.75 });
    await settled({ max: 60000, until: rest });
    await steps({ scope, surf: 'plane', park: p0 + x });
    await settled({ max: 60000, until: rest });
    await redraw();
    const b = await grab('back');
    const st1 = await ev('GLR.fillPointsStats()');
    const d = a && b ? await diff('here', 'back') : null;
    info[tag] = { path, d, st0, st1 };
    ok(`${tag}: the left pane settles`, a && b, { a, b });
    ok(`${tag}: the carried mesh draws the frame, its fill from its point pass in every frame once linked`, path === 'mesh' && st1.runs > st0.runs && st1.frames.points > st0.frames.points && st1.frames.standIn === st0.frames.standIn, info[tag]);
    ok(`${tag}: no frame stands in after the point pass has drawn for the same fill program`, st1.reverts === 0, info[tag]);
    ok(`${tag}: the frame held there is the same after parking elsewhere and back`, !!d && d.px === 0, info[tag]);
  }
}
return { pass: fails.length === 0, fails, info };
