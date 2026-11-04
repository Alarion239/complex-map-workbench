// The steps view's carried colour mid-glide with the cut fill's values from its point pass (GLR.fillPointsOn, on by
// default: the chain once per point of a torn sub-triangle) against the fill evaluating its own (off): the left pane's
// pixels identical, Inside regions and Everywhere, held at x = 1/4 and 1/2, on two chains whose path has a cut the
// sheets continue (Sheets of the logarithm, Square root and its sheets). Everywhere the carried mesh draws the frame
// (a Newton inverse covers two of H_t's points, not all of them) and the point pass ran (GLR.fillPointsRuns); Inside
// regions the inverse pass draws it (the homotopy inverted by Newton), the exact picture with no mesh fill.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const ready = async () => { await settled({ max: 30000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && typeof GLR.fillPointsOn === "function"' }); };
const steps = async (o) => { await ev(`__cmwSteps(${JSON.stringify(o)}); 1`); await settled({ max: 20000 }); };
// canvasL's pixels kept in the page as __fpx[tag] once two reads 100 ms apart agree, both taken after the panes' frames
// are drawn (two equal reads can both precede a frame still pending)
const grab = async (tag) => {
  await settled({ max: 30000 });
  await ev('(window.__fpx || (window.__fpx = {}))._prev = null; 1');
  for (let n = 0; n < 100; n++) {
    const same = await ev(`(() => { const c = document.getElementById('canvasL'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, g = window.__fpx || (window.__fpx = {}), p = g._prev;
      g._prev = d; if (!p || p.length !== d.length) return false; for (let i = 0; i < d.length; i++) if (p[i] !== d[i]) return false; g[${JSON.stringify(tag)}] = d; return true; })()`);
    if (same) return true;
    await sleep(100);
  }
  return false;
};
const diff = (a, b) => ev(`(() => { const A = window.__fpx[${JSON.stringify(a)}], B = window.__fpx[${JSON.stringify(b)}]; let px = 0, max = 0;
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
  await settled({ max: 20000 });
  for (const scope of ['in', 'all']) for (const x of [0.25, 0.5]) {
    const tag = `${name} ${scope} ${x}`;
    await steps({ scope, surf: 'plane', go: 0, now: true });
    await steps({ scope, surf: 'plane', park: x });
    // (parked: the tiling's fix-up lands once and the region mask's SphereMesh after it, each changing the frame, so
    // both settings are read after them; the redraw between the two waits asks for a mesh the parked frame did not)
    await settled({ max: 60000, until: rest });
    await redraw();
    await settled({ max: 60000, until: rest });
    // (the count read before the redraw is asked for: the frame may be drawn before the next evaluation)
    const n0 = await ev('GLR.fillPointsRuns()'), path = await ev('(() => { const g = __cmwSteps().glide; return g && g.path; })()');
    await ev('GLR.fillPointsOn(true), 1'); await redraw();
    const a = await grab('on');
    const n1 = await ev('GLR.fillPointsRuns()');
    await ev('GLR.fillPointsOn(false), 1'); await redraw();
    const b = await grab('off');
    await ev('GLR.fillPointsOn(true), 1'); await redraw();
    const d = a && b ? await diff('on', 'off') : null;
    info[tag] = { d, runs: n1 - n0, path };
    ok(`${tag}: the left pane settles under each setting`, a && b, { a, b });
    if (scope === 'all') ok(`${tag}: the carried mesh draws the frame, its fill taking its values from its point pass`, path === 'mesh' && n1 > n0, info[tag]);
    else ok(`${tag}: the inverse pass draws the frame`, path === 'inverse', info[tag]);
    ok(`${tag}: the pixels are the same as the fill evaluating its own`, !!d && d.px === 0, info[tag]);
  }
}
return { pass: fails.length === 0, fails, info };
