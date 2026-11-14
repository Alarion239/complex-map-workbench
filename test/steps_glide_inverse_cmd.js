// The steps view's glide frames between two planes, drawn per pixel by the inverse pass of the step's homotopy:
// - the default example (exp, then a Möbius map), parked between planes z and w₁ at u = 0.25, 0.5, 0.75: the frame is
//   the inverse pass's (__cmwSteps().glide.path), and matches a CPU reference: at a grid of pixels w, the front point z
//   of plane z with H_u(z) = w (Newton's method from seeds over the window; the front one by the inverse pass's own
//   sheet key), coloured as plane z's parked frame colours z; away from the colour lines (a pixel whose neighbourhood,
//   in the parked frame about z or in the glide's frame about w, spans more than 12 levels), more than 6 levels off in a
//   channel on at most 0.2 % of the pixels (the exact images' tolerance, steps_carry_cmd);
// - at u = 0.001 and 0.999 the frame is the parked plane's: within the same tolerance away from the lines, and on the
//   whole frame a mean within 1.5 levels (the colour lines move by a fraction of a pixel there);
// - the fallback, per step: a step whose homotopy is the straight line (a non-analytic formula, added after the
//   default's two) takes the carried mesh; the Mountain King's glide from z to u takes the inverse pass (its homotopy
//   runs a Möbius path, then a power path), its glide from u to F the carried mesh (its formula has no inverse).
// - the NEWT roots pass (the partial sum of the exponential) draws in the glide's frames without reading GL state back.
// The thread is set directly (__cmwSteps({ x })): a park near a plane snaps onto it.
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

await view(1440, 900, false, false);
// ---- the default example: exp, then (z - 1)/(z + 1) ----
await go(`${BASE}/test.html?ns=gi${Date.now()}&lang=en&view=steps`);
await ready();
await ev(HELP);
await ev('__cmwSteps({ bare: true }), 1');
await park(0); await ev('window.__gi.p0 = __giGrab(), 1');
await park(1); await ev('window.__gi.p1 = __giGrab(), 1');
for (const u of [0.25, 0.5, 0.75]) {
  const g = await at(u, 'inverse');
  const r = await ev('__giRef(window.__gi.p0, __giGrab(), 6, 8)');
  info[`default u ${u}`] = { g, r };
  ok(`default, z → w₁ at u = ${u}: drawn by the inverse pass`, !!g && g.path === 'inverse' && g.b === 1, g);
  ok(`default, z → w₁ at u = ${u}: the CPU reference's colours away from the lines (> 6 on <= 0.2 %)`, r.n > 2000 && r.over <= 0.002, r);
}
for (const [x, ref] of [[0.001, 'p0'], [0.999, 'p1']]) {
  const g = await at(x, 'inverse');
  const r = await ev(`(() => { const F = __giGrab(); return { all: __giStat(F, window.__gi.${ref}), smooth: __giSmooth(F, window.__gi.${ref}) }; })()`);
  info[`default x ${x}`] = { g, r };
  ok(`default at x = ${x}: drawn by the inverse pass`, !!g && g.path === 'inverse', g);
  ok(`default at x = ${x}: the parked plane's frame (away from the lines > 6 on <= 0.2 %; mean <= 1.5 on the whole frame)`, r.smooth.n > 10000 && r.smooth.over <= 0.002 && r.all.mean <= 1.5, r);
}

// a step whose homotopy is the straight line (a formula that is not analytic) put after the Möbius map: its glide
// takes the carried mesh
{
  await ev(`__cmwAddStep('custom', { expr: 'z+0.2*conj(z)', cut: 180 }), 1`);
  await ev('await new Promise((r) => setTimeout(r, 2000)), 1');
  const g = await at(2.5, 'mesh');
  info.lin = g;
  ok('a non-analytic formula after the Möbius map: its straight-line glide takes the carried mesh', !!g && g.b === 3 && g.path === 'mesh', g);
}

// ---- the fallback, per step ----
{
  const ex = names.indexOf('In the Hall of the Mountain King');
  ok('the Mountain King example is found', ex >= 0, names.length);
  await go(`${BASE}/test.html?ns=gk${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(`__cmwExample(${ex}), 1`);
  await ev('await new Promise((r) => setTimeout(r, 3000)), 1');
  for (const [x, want] of [[0.3, 'inverse'], [0.7, 'inverse'], [1.5, 'mesh']]) {
    const g = await at(x, want, x > 1 ? 300000 : 60000);
    info[`king x ${x}`] = g;
    ok(`Mountain King at x = ${x}: ${want === 'inverse' ? 'the inverse pass' : 'the carried mesh (no inverse of the step)'}`, !!g && g.path === want, g);
  }
}
// ---- a NEWT glide draws the window's image: zeta ----
// ζ has no exact inverse, so its glide runs Newton members from seeds over the window part of the shape. The share of
// the left pane that is not paper (every channel above INK_PAPER) at u = 0.25, 0.5, 0.75 stays above the floors, each
// above what a ladder seeded about w / (1 - t) draws (a third to a half of it)
{
  // (FRAME_MS: a software renderer takes minutes over a zeta frame)
  const INK_PAPER = 240, FRAME_MS = 600000, floor = { 0.25: 0.045, 0.5: 0.065, 0.75: 0.07 };
  const ex = names.indexOf('Zeros of the zeta function');
  ok('the zeta example is found', ex >= 0, names.length);
  await go(`${BASE}/test.html?ns=gz${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(`__cmwExample(${ex}), 1`);
  await ev("__cmwSteps({ bare: true, scope: 'in' }), 1");
  // (the prestart's idle warm draw lands in the GL canvas next to whichever frame is requested while it runs: the
  // frames are measured once the prestart is done)
  await settled({ max: 120000, until: '__cmwSteps().ready.ready' });
  for (const x of [0.25, 0.5, 0.75]) {
    const g = await at(x, 'inverse', FRAME_MS);
    const share = await ev(`(() => { const c = document.querySelector('#canvasL'), k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const q = k.getContext('2d'); q.drawImage(c, 0, 0); const d = q.getImageData(0, 0, k.width, k.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (!(d[i] > ${INK_PAPER} && d[i + 1] > ${INK_PAPER} && d[i + 2] > ${INK_PAPER})) n++; return n / (d.length / 4); })()`);
    info[`zeta x ${x}`] = { g, share };
    ok(`zeta at x = ${x}: the inverse pass draws at least ${floor[x]} of the pane`, !!g && g.path === 'inverse' && share >= floor[x], { g, share });
  }
  // (the source window moved to where the strip's image near its pole z = 1 lies, Im -2.8 to 13.8: most of the true image there
  // is the pole's, which the ladder's seeds do not reach; the pole member draws it)
  const POLE_FLOOR = { 0.5: 0.4, 0.75: 0.4 };
  await ev("__cmwSet('srcView', { cx: 0.5, cy: 5.5, s: 40 }), 1");
  for (const x of [0.5, 0.75]) {
    const g = await at(x, 'inverse', FRAME_MS);
    const share = await ev(`(() => { const c = document.querySelector('#canvasL'), k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const q = k.getContext('2d'); q.drawImage(c, 0, 0); const d = q.getImageData(0, 0, k.width, k.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (!(d[i] > ${INK_PAPER} && d[i + 1] > ${INK_PAPER} && d[i + 2] > ${INK_PAPER})) n++; return n / (d.length / 4); })()`);
    info[`zeta pole window x ${x}`] = { g, share };
    ok(`zeta over its pole's image at x = ${x}: the inverse pass draws at least ${POLE_FLOOR[x]} of the pane`, !!g && g.path === 'inverse' && share >= POLE_FLOOR[x], { g, share });
  }
}
// ---- a scrub right after load, before step b's pole tracks exist (zeta) ----
// The first frame of a scrub made at once (no wait for ready.ready) is the held frame, pixel-equal to plane z's parked
// frame, or drawn by the inverse pass with the share of its floor; never a frame below the floor. The first frame at rest
// after it leaves no hold behind, the hold ends once the tracks exist, and a glide with an exact inverse (z squared) is
// never held, nor one Everywhere through a polynomial step inverted by every root after no step with a pole (the partial
// sum of the exponential: its map has no pole at any t, so no tracks to wait for).
{
  const INK_PAPER = 240, FRAME_MS = 600000, FIRST_MS = 120000, HELD_DIFF = 6, HELD_OVER = 0.002, HELD_FAR = 10 * HELD_OVER, FRAME_SEARCH_MS = 0.001;
  const FLOOR = { 0.25: 0.045, 0.5: 0.065, 0.75: 0.07 };
  const ex = names.indexOf('Zeros of the zeta function'), sq = names.indexOf('Quarter plane squared'), ps = names.indexOf('Partial sums of the exponential');
  ok('the zeta, the squared and the partial sums examples are found', ex >= 0 && sq >= 0 && ps >= 0, names.length);
  const SHARE = `(() => { const c = document.querySelector('#canvasL'), k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const q = k.getContext('2d'); q.drawImage(c, 0, 0); const d = q.getImageData(0, 0, k.width, k.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (!(d[i] > ${INK_PAPER} && d[i + 1] > ${INK_PAPER} && d[i + 2] > ${INK_PAPER})) n++; return n / (d.length / 4); })()`;
  // (the example, then every pole track dropped and the scrub to x in one page call: no idle moment makes tracks in
  // between, as right after load; a frame's own pole search gets FRAME_SEARCH_MS, as on a machine too slow to finish it)
  const load = async (example, x, scope = 'in') => {
    await go(`${BASE}/test.html?ns=gh${Date.now()}&lang=en&view=steps`);
    await ready();
    await ev(HELP);
    await ev(`__cmwExample(${example}), 1`);
    await ev(`__cmwSteps({ bare: true, scope: '${scope}' }), 1`);
    await settled({ max: 120000, until: '__cmwSteps().ready.ready' });
    await ev(`__cmwSteps({ poleFrameMs: ${FRAME_SEARCH_MS}, dropTracks: true, x: ${x} }), 1`);
  };
  // the first frame after the scrub to x: the page's canvas then, its share, and the thread's record
  const first = async (x, scrubbed) => {
    if (!scrubbed) await ev(`__cmwSteps({ x: ${x} }), 1`);
    await settled({ max: FIRST_MS, until: `(() => { const s = __cmwSteps(), g = s.glide; return !!s.hold || (!!g && Math.abs(${Math.floor(x)} + g.u - ${x}) < 1e-9); })()` });
    const r = await ev(`(() => { const s = __cmwSteps(), g = s.glide; window.__gi.f = __giGrab(); return { hold: s.hold || 0, ready: s.ready.ready, g: g && { u: g.u, path: g.path }, share: ${SHARE} }; })()`);
    return r;
  };
  // the held frame's test: plane z's parked frame, measured once the frames are parked
  // (the page's bare hook strips the points and outlines from the carry core's frames only; plane z's parked frame is the
  // classic core's and keeps them, so the held frame is drawn again with them, in the same held state, to be compared)
  const heldFrame = async () => {
    const again = await ev(`(async () => { __cmwSteps({ bare: false }); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); window.__gi.f = __giGrab(); return __cmwSteps().hold || 0; })()`);
    ok('the held frame is drawn again with its overlays while the hold lasts', again > 0, again);
    // (the first frame at rest on plane z leaves no hold behind while the held glide's tracks are still missing: they are
    // dropped as the thread parks, and the hold is read in the animation frame that draws plane z, right after the left
    // pane's own callback, before an idle moment can make them)
    const rest = await ev(`(async () => { __cmwSteps({ dropTracks: true, park: 0 }); for (let k = 0; k < 60; k++) { await new Promise((r) => requestAnimationFrame(r)); const s = __cmwSteps(); if (s.x === 0 && s.core === 'still') return s.hold; } return 'no frame at rest'; })()`);
    ok('the first frame at rest on plane z after the hold leaves no hold behind (hold 0)', rest === 0, rest);
    await park(0);
    return heldOver();
  };
  const heldOver = () => ev(`(() => { const A = window.__gi.f, B = __giGrab(); let over = 0; for (let i = 0; i < A.d.length; i += 4) { let m = 0; for (let c = 0; c < 3; c++) m = Math.max(m, Math.abs(A.d[i + c] - B.d[i + c])); if (m > ${HELD_DIFF}) over++; } return over / (A.d.length / 4); })()`);
  for (const x of [0.25, 0.5, 0.75]) {
    await load(ex, x);
    const r = await first(x, true);
    const over = await heldFrame();
    const held = over <= HELD_OVER, inv = !!r.g && r.g.path === 'inverse' && r.share >= FLOOR[x];
    info[`zeta scrub at once x ${x}`] = { r, over };
    if (x === 0.5) {
      // (control: the held frame is not plane w₁'s parked frame, so a mismatch over the frame fails the comparison)
      await park(1);
      const other = await heldOver();
      info['zeta held vs plane w1'] = other;
      ok(`the held frame differs from plane w₁'s parked frame on more than ${HELD_FAR} of the pane (the comparison can fail)`, other > HELD_FAR, other);
      await park(0);
    }
    ok(`zeta scrubbed at once to x = ${x}: the first frame is the held frame of plane z or the inverse pass's at least ${FLOOR[x]} of the pane`, held || inv, { r, over });
    if (x === 0.5) {
      // (the hold ends: once the tracks exist the frame at the finger is the inverse pass's, above the floor)
      await ev(`__cmwSteps({ x: ${x} }), 1`);
      await settled({ max: FRAME_MS, until: '__cmwSteps().ready.ready' });
      const g = await at(x, 'inverse', FRAME_MS);
      const share = await ev(SHARE);
      info['zeta hold ends'] = { g, share };
      ok(`zeta scrubbed at once to x = ${x}: after the tracks exist the frame at the finger is the inverse pass's, above the floor`, !!g && g.path === 'inverse' && share >= FLOOR[x], { g, share });
      // (after ready.ready the same scrub is never held)
      await ev('__cmwSteps({ x: 0.25 }), 1');
      const r2 = await first(0.75);
      info['zeta scrub after ready'] = r2;
      ok('zeta scrubbed after ready.ready: not held, drawn by the inverse pass above the floor', !r2.hold && !!r2.g && r2.g.path === 'inverse' && r2.share >= FLOOR[0.75], r2);
    }
  }
  // a glide with an exact inverse needs no tracks: never held
  await load(sq, 0.5);
  const r3 = await first(0.5, true);
  info['squared scrub at once'] = r3;
  ok('z squared scrubbed at once after load: never held, drawn by the inverse pass', !r3.hold && !!r3.g && r3.g.path === 'inverse', r3);
  await load(ps, 0.5, 'all');
  const r4 = await first(0.5, true);
  info['partial sum scrub at once'] = r4;
  ok('the partial sum of the exponential scrubbed at once after load, Everywhere: never held, drawn by the inverse pass', !r4.hold && !!r4.g && r4.g.path === 'inverse', r4);
}
// ---- the NEWT roots pass reads no GL state back ----
// (the partial sum of the exponential, degree 8, Inside regions, inverts by a NEWT op, whose members the roots pass draws for every pixel, GLR.newtRoots: once a
// frame, so it keeps the frame's state from the renderer's own record, not by getParameter, a synchronous read from the
// GPU process: 2.4 ms a frame on lavapipe. Its first call reads the device's draw-buffer limit, once)
{
  const ex = names.indexOf('Partial sums of the exponential');
  ok('the Partial sums of the exponential example is found', ex >= 0, names.length);
  await go(`${BASE}/test.html?ns=gn${Date.now()}&lang=en&view=steps`);
  await ready();
  await ev(`__cmwExample(${ex}), 1`);
  await ev(`__cmwSteps({ scope: 'in' }), 1`);
  await settled({ max: 60000, until: 'GLR.pendingLinks === 0 && !__cmwSteps().anim' });
  // (each newtRoots call: its answer and the getParameter calls made inside it)
  await ev(`(() => { const n = GLR.newtRoots, P = WebGL2RenderingContext.prototype, g = P.getParameter, L = window.__nrLog = []; let k = -1; P.getParameter = function () { if (k >= 0) k++; return g.apply(this, arguments); }; GLR.newtRoots = function () { k = 0; try { const r = n.apply(this, arguments); L.push([r.state, k]); return r; } finally { k = -1; } }; return 1; })()`);
  for (const x of [0.5, 0.55, 0.6]) await at(x, 'inverse');
  const log = await ev('window.__nrLog.slice(0, 40)'), drawn = log.filter((e) => e[0] === 'drawn');
  info['newt roots'] = log;
  ok('Partial sums of the exponential: the NEWT roots pass draws in the glide\'s frames and reads no GL state back (no getParameter in GLR.newtRoots after its first call)', drawn.length > 1 && drawn.slice(1).every((e) => e[1] === 0), log);
}
return { pass: fails.length === 0, fails, info };
