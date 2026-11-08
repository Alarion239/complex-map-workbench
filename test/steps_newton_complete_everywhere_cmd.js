// The steps view's 2D Everywhere glide under a Newton inverse:
// - the partial sums of the exponential (an exact-degree polynomial: its Newton op finds every root of the step's
//   homotopy, so its members are complete) glides by the inverse pass between its planes, and its end frames are
//   the parked plane's near the end (away from the colour lines more than 6 levels off in a channel on at most
//   0.2 % of the pixels), and near the start (u = 1e-5) the parked plane 0's;
// - the control, a Newton inverse that is not complete (the zeta example's, with no seeds): its Everywhere glide keeps
//   the carried mesh, whatever the gate on complete ops lets through.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
const { GI_REF } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const ready = () => settled({ max: 60000, until: 'typeof __cmwExample === "function" && typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#svStrip")' });
// (the page's helpers: the left pane's pixels, and the comparison of a frame with the CPU reference)
const HELP = `window.__gi = window.__gi || {};
window.__giGrab = () => { const cv = document.querySelector('#canvasL'), c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const g = c.getContext('2d'); g.drawImage(cv, 0, 0); return { W: c.width, H: c.height, d: g.getImageData(0, 0, c.width, c.height).data }; };
window.__giStat = (A, B) => { let n = 0, over = 0, sum = 0, max = 0; for (let i = 0; i < A.d.length; i += 4) { n++; let m = 0; for (let c = 0; c < 3; c++) { const d = Math.abs(A.d[i + c] - B.d[i + c]); sum += d; m = Math.max(m, d); } max = Math.max(max, m); if (m > 6) over++; } return { n, max, mean: +(sum / 3 / n).toFixed(3), over: +(over / n).toFixed(5) }; };
window.__giSmooth = (A, B) => { const W = A.W, H = A.H; let n = 0, over = 0; for (let y = 3; y < H - 3; y += 3) for (let x = 3; x < W - 3; x += 3) { if (__giRange(A.d, W, x, y) > 12 || __giRange(B.d, W, x, y) > 12) continue; n++; const i = 4 * (y * W + x); let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(A.d[i + c] - B.d[i + c])); if (m > 6) over++; } return { n, over: +(over / Math.max(1, n)).toFixed(5) }; };
${GI_REF}
1`;
// the frame at thread place x, once a frame there was drawn (by either path), and its record
// (max: a software renderer takes minutes over a frame of the Mountain King's plane F; ms: until that frame)
const at = async (x, want, max = 60000) => {
  const t0 = Date.now();
  await ev(`__cmwSteps({ x: ${x} }), 1`);
  const until = `(() => { const g = __cmwSteps().glide; return !!g && Math.abs(${Math.floor(x)} + g.u - ${x}) < 1e-9 && ${want ? `g.path === '${want}'` : 'true'}; })()`;
  await settled({ max, until });
  const ms = Date.now() - t0;
  await ev('await new Promise((r) => setTimeout(r, 1500)), 1');
  const g = await ev('(() => { const g = __cmwSteps().glide; return g ? { b: g.b, u: g.u, path: g.path, reason: g.reason } : null; })()');
  return g && Object.assign(g, { ms });
};
const park = async (k) => {
  await ev(`__cmwSteps({ park: ${k} }), 1`);
  await settled({ max: 60000, until: `__cmwSteps().x === ${k}` });
  await ev('await new Promise((r) => setTimeout(r, 2500)), 1');
};

const SCOPE_ALL = JSON.stringify({ scope: 'all', surf: 'plane' });
// ---- the partial sums of the exponential, Everywhere ----
{
  const ex = names.indexOf('Partial sums of the exponential');
  ok('the Partial sums of the exponential example is found', ex >= 0, names.length);
  await go(`${BASE}/test.html?ns=nc${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(HELP);
  await ev(`__cmwExample(${ex}), 1`);
  await ev(`__cmwSteps(${SCOPE_ALL}), 1`);
  await settled({ max: 60000, until: 'GLR.pendingLinks === 0 && !__cmwSteps().anim' });
  await park(0); await ev('window.__gi.p0 = __giGrab(), 1');
  await park(1); await ev('window.__gi.p1 = __giGrab(), 1');
  for (const x of [0.4, 0.5, 0.6]) {
    const g = await at(x, 'inverse');
    info[`sums x ${x}`] = g;
    ok(`partial sums, Everywhere, at x = ${x}: drawn by the inverse pass`, !!g && g.path === 'inverse', g);
  }
  {
    // (a glide at u moves a point by about u times |F - z|, many band widths where F is large: the frame is the parked
    // plane 0's only as u tends to 0)
    const x = 0.00001, g = await at(x, 'inverse');
    const r = await ev('__giSmooth(__giGrab(), window.__gi.p0)');
    info[`sums start ${x}`] = { g, r };
    ok(`partial sums, Everywhere, at x = ${x}: drawn by the inverse pass`, !!g && g.path === 'inverse', g);
    ok(`partial sums, Everywhere, at x = ${x}: the parked plane 0's frame (away from the lines > 6 on <= 0.2 %)`, r.n > 10000 && r.over <= 0.002, r);
  }
  {
    const x = 0.999, g = await at(x, 'inverse');
    const r = await ev('__giSmooth(__giGrab(), window.__gi.p1)');
    info[`sums end ${x}`] = { g, r };
    ok(`partial sums, Everywhere, at x = ${x}: drawn by the inverse pass`, !!g && g.path === 'inverse', g);
    ok(`partial sums, Everywhere, at x = ${x}: the parked plane's frame (away from the lines > 6 on <= 0.2 %)`, r.n > 10000 && r.over <= 0.002, r);
  }
}
// ---- control: a Newton inverse with no seeds keeps the carried mesh ----
{
  const ex = names.indexOf('Zeros of the zeta function');
  ok('the zeta example is found', ex >= 0, names.length);
  await go(`${BASE}/test.html?ns=nz${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(`__cmwExample(${ex}), 1`);
  await ev(`__cmwSteps(${SCOPE_ALL}), 1`);
  await settled({ max: 60000, until: 'GLR.pendingLinks === 0 && !__cmwSteps().anim' });
  const g = await at(0.5, 'mesh');
  info['zeta control'] = g;
  ok('zeta, Everywhere (a Newton inverse with neither seeds nor every root): the carried mesh, for the reason "Everywhere under a Newton inverse with neither seeds nor every root"', !!g && g.path === 'mesh' && g.reason === 'Everywhere under a Newton inverse with neither seeds nor every root', g);
}
return { pass: fails.length === 0, fails, info };
