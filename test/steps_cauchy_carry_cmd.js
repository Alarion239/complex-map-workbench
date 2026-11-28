// The Cauchy style's carried colour (the region meshes' carry with the style's residue data, the chain's length as T of the
// Cauchy integral): the carried colour of the points of plane z is the Cauchy integral's colour of F over the unit circle at
// each point. With the chain [z, z + 1/z] (F = z + 1/z, the first step the identity), plane 1 is plane z itself, so its
// carried colour is the plot of the style on plane z (GLR.drawColorPlot of the same data) at each point, for Both, Inside and
// Outside. Then, with the chain [z + 1/z], the colour of F(z0) on plane 1 is the colour of z0 (or of 1/z0) on plane z.
// Its switch leg, which watches a glide under way (the hold on plane z), runs with the Play gate off (__cmwSteps({ gate: false })); the
// gated switch leg after it keeps the gate on and reads plane z while the press waits.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PNG = process.mainModule.require(path.join(DIR, 'png.js'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// a pixel differs when a channel is off by more than this (of 255): the edge of a phase sector falling between two pixels' rounding
const PIXEL_TOL = 6;
// the share of the sampled points that may differ by more than PIXEL_TOL: those on an edge of a sector
const EDGE_SHARE_MAX = 0.01;
// a colour pixel has channels that differ by more than this (of 255); a coloured picture has more than COLOUR_SHARE_MIN of them
const COLOUR_CHANNEL_GAP = 20, COLOUR_SHARE_MIN = 0.05;
// a wrong reference must differ from the carried colour on more than this share of the sampled points, far above EDGE_SHARE_MAX
const CONTROL_SHARE_MIN = 0.05;
// the points of plane z compared: a GRID_NX x GRID_NY grid over the box |Re| <= GRID_RE, |Im| <= GRID_IM, without the band
// |(|z| - 1)| < CURVE_BAND, where the curve's stroke is drawn over the colour
const GRID_NX = 48, GRID_NY = 32, GRID_RE = 1.8, GRID_IM = 1.2, CURVE_BAND = 0.08;
// the page's bounds for a ready page and for the view to settle, and the window's size
const PAGE_READY_MS = 30000, SETTLE_MS = 15000, WIN_W = 1200, WIN_H = 800;
const CIRCLE = { id: 's1', kind: 'circle', c: [0, 0], r: 1, ci: 0, visible: true };
const step = (expr) => ({ type: 'custom', params: { expr, cut: 180 }, on: true });
const base = { shapes: [CIRCLE], srcView: { cx: 0, cy: 0, s: 110 }, nextId: 50, pattern: 'checker', dc: 'cauchy', alpha: 1 };
const state = Object.assign({}, base, { steps: [step('z+\\frac{1}{z}')] });
const stateId = Object.assign({}, base, { steps: [step('z'), step('z+\\frac{1}{z}')] });
await view(WIN_W, WIN_H, false, false);
const open = async (s) => {
  const ns = 'cauchycarry' + Date.now();
  await load(ns, s);
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
  await settled({ until: 'window.MathJax && !!window.__cmwSteps && __cmwSteps().planes.length > 0 && typeof GLR === "object"', max: PAGE_READY_MS });
  await ev(`__cmwSelect('s1'); 1`);
  await settled({ until: '!__cmwSteps().moving', max: SETTLE_MS });
};
// the left pane's pixels at points of the plane shown (one screenshot): [r, g, b, a] each
const pixels = async (pts) => {
  const r = await ev(`(() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; })()`);
  const s = await send('Page.captureScreenshot', { format: 'png', clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
  const png = PNG(Buffer.from(s.data, 'base64'));
  const xy = await ev(`JSON.stringify(${JSON.stringify(pts)}.map(([x, y]) => { const p = __cmwW2S('L', x, y), r = document.getElementById('canvasL').getBoundingClientRect(); return [p[0] - r.left, p[1] - r.top]; }))`);
  return JSON.parse(xy).map(([x, y]) => png.at(Math.round(x), Math.round(y)));
};
const pixel = async (x, y) => (await pixels([[x, y]]))[0];
// parked at plane g, the colour plane z (T 0), the shown plane g reached
const parkAt = async (g) => {
  await ev(`(__cmwSteps({ T: 0, go: ${g}, now: true }), 1)`);
  await settled({ until: `!__cmwSteps().moving && __cmwSteps().i === ${g}`, max: SETTLE_MS });
};
const differ = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2])) > PIXEL_TOL;
const coloured = (p) => Math.abs(p[0] - p[1]) > COLOUR_CHANNEL_GAP || Math.abs(p[1] - p[2]) > COLOUR_CHANNEL_GAP;
const share = (a, f) => +(a.filter(f).length / a.length).toFixed(4);
const grid = [];
for (let i = 0; i < GRID_NX; i++) for (let j = 0; j < GRID_NY; j++) {
  const x = -GRID_RE + (2 * GRID_RE * (i + 0.5)) / GRID_NX, y = -GRID_IM + (2 * GRID_IM * (j + 0.5)) / GRID_NY;
  if (Math.abs(Math.hypot(x, y) - 1) >= CURVE_BAND) grid.push([x, y]);
}
await open(stateId);
// the other show setting's plot, for each show: the negative control's reference
const OTHER = { both: 'in', in: 'both', out: 'in' };
for (const show of ['both', 'in', 'out']) {
  await ev(`__cmwCauchyOpt('${OTHER[show]}', true)`);
  await parkAt(0);
  const wrongRef = await pixels(grid);
  await ev(`__cmwCauchyOpt('${show}', true)`);
  await parkAt(0);
  const ref = await pixels(grid);
  await parkAt(1);
  const carried = await pixels(grid);
  const carry = await ev('JSON.stringify((() => { const c = __cmwCauchyCarry(); return c && { T: c.T, show: c.show, edges: c.edges.length }; })())');
  const r = { n: grid.length, over: share(grid.map((_, k) => k), (k) => differ(ref[k], carried[k])), wrong: share(grid.map((_, k) => k), (k) => differ(wrongRef[k], carried[k])), colour: share(ref, coloured), carriedColour: share(carried, coloured), carry };
  info[show] = r;
  ok(`${show}: the residue data is carried (the chain's length as T)`, /"T":2/.test(carry), r);
  ok(`${show}: the reference plot is coloured (the check is not between two blanks)`, r.colour > COLOUR_SHARE_MIN, r);
  ok(`${show}: the carried colour is drawn (plane 1 is coloured)`, r.carriedColour > COLOUR_SHARE_MIN, r);
  ok(`${show}: plane 1's carried colour is the plot of the style on plane z, point for point`, r.over <= EDGE_SHARE_MAX, r);
  // negative control: the same comparison against the plot of another show setting (the other side of the curve coloured) must fail
  ok(`${show}: negative control: the plot of another show setting is not the carried colour`, r.wrong > CONTROL_SHARE_MIN, r);
}
await open(state);
// (Outside is the sharp case: F(z0) at an outside point is the colour of f₋ there, not the plain colour of F)
// (alpha 1: the sheet is opaque, so its pixels are the carried colour and not a blend with the plane behind it)
// the steps view itself: with the colour plane z and the thread parked at plane 1, the point F(z0) of plane 1 has the colour that z0 has on plane z
// (inside the circle coloured, outside the circle coloured, for Both); the pane's pixels at two points compared plane against plane
// F(z) = z + 1/z at two points of plane z, 0.55 + 0.3i inside the circle and 1.9 + 0.45i outside it. F takes z and 1/z to the same
// point, so the point F(z0) of plane 1 carries the colour of whichever of the two the front sheet holds: the colour z0 has on plane z or
// the colour 1/z0 has there
const F = ([x, y]) => { const d = x * x + y * y; return [x + x / d, y - y / d]; };
const inv = ([x, y]) => { const d = x * x + y * y; return [x / d, -y / d]; };
const near = (p, q) => Math.max(...p.slice(0, 3).map((c, k) => Math.abs(c - q[k]))) <= PIXEL_TOL * 2;
for (const [show, z0] of [['both', [0.55, 0.3]], ['both', [1.9, 0.45]], ['out', [1.9, 0.45]], ['in', [0.55, 0.3]]]) {
  await ev(`__cmwCauchyOpt('${show}', true)`);
  await parkAt(0);
  const onZ = await pixel(z0[0], z0[1]), onZ2 = await pixel(...inv(z0));
  await parkAt(1);
  const onW = await pixel(...F(z0));
  info[show + ' z ' + z0] = { onZ, onZ2, onW, carry: await ev('JSON.stringify((() => { const c = __cmwCauchyCarry(); return c && { T: c.T, show: c.show, edges: c.edges.length }; })())'), steps: await ev('JSON.stringify(__cmwSteps().glide || null)') };
  ok(`${show}, z0 = ${z0}: the colour of F(z0) on plane 1 is the colour of z0 or of 1/z0 on plane z`, near(onZ, onW) || near(onZ2, onW), info[show + ' z ' + z0]);
  // negative control: i·z0 is a quarter turn from z0 (a different phase, in the same part of the plane), so the colour of F(z0)
  // is not its colour on plane z
  await parkAt(0);
  const turned = await pixel(-z0[1], z0[0]);
  ok(`${show}, z0 = ${z0}: negative control: the colour of F(z0) is not the colour of i·z0 on plane z`, !near(turned, onW), { turned, onW });
}
// Switching to the Cauchy style, then stepping to plane 1 at once, with links that land late (test/lib/late_links.js, LATE_LINK_MS):
// the Cauchy style's carried programs are variants of their own (CARRY_CAUCHY), linked as the style is chosen, so no frame
// of the glide or of plane 1 at rest waits on them with nothing drawn. With the chain [z, z + 1/z] the glide to plane 1 is the
// identity's, so every frame past z shows the points of SWITCH_PTS (outside the circle, where the Cauchy colour 1/z is not the
// stages' colour z) in their final colour: the glide's frames and plane 1 at rest, never a blank plane. While the programs
// link the glide waits on plane z (svLinkHold), whose frames are the late-link stand-in (svCarryRegions' standIn: plane z's
// meshes in the phase of their points) or the final picture, and are drawn (not blank).
const LATE_LINK_MS = 2500, SWITCH_FRAMES = 40, SWITCH_MS = 60000;
const SWITCH_PTS = [[1.6, 0.4], [-1.5, -0.6], [0.3, -1.4], [1.3, 1.1], [-1.2, 1.2]];
await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__lateLinkMs = ${LATE_LINK_MS};\n` + fs.readFileSync(path.join(DIR, '..', 'lib', 'late_links.js'), 'utf8') });
const HOLD_TOL = 6, far = (p, q) => Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
// (from several previous styles: the held picture is the one the plane had, whichever style it was in)
for (const prev of ['phase', 'classic', 'grid', 'enhanced']) {
  await open(Object.assign({}, stateId, { dc: prev }));
  await ev('(__cmwSteps({ T: 0 }), 1)');
  await settled({ until: '!__cmwSteps().moving && __cmwSteps().i === 0 && __cmwSteps().ready.ready && !GLR.pendingLinks', max: SWITCH_MS });
  const phaseOut = await pixels(SWITCH_PTS);
  await ev(`(() => { let b = document.querySelector('[id="dcSeg"] [data-v="cauchy"]'); if (!b || !b.getClientRects().length) { document.querySelector('#leftFoot .opts-btn').click(); b = document.querySelector('.opts-pop [data-v="cauchy"]'); } b.click(); return 1; })()`);
  // (the Play gate off: the hold of the glide that has started waits on plane z, which this leg watches; the gate's waits are svplay_gate_cmd.js's)
  await ev('(__cmwSteps({ T: 0, go: 1, gate: false }), 1)');
  const seen = [];
  for (let i = 0; i < SWITCH_FRAMES; i++) seen.push({ x: await ev('+__cmwSteps().x.toFixed(3)'), px: await pixels(SWITCH_PTS) });
  await settled({ until: '!__cmwSteps().moving && __cmwSteps().i === 1 && __cmwSteps().ready.ready && !GLR.pendingLinks', max: SWITCH_MS });
  const finalOut = await pixels(SWITCH_PTS);
  await parkAt(0);
  const plotOut = await pixels(SWITCH_PTS);
  const blankAt = (f) => f.px.every((p) => !coloured(p));
  const finalAt = (f) => f.px.every((p, k) => !differ(p, finalOut[k]));
  info.switch = { phaseOut, finalOut, plotOut, links: await ev('JSON.stringify(window.__lateLinks || null)'), frames: seen.map((f) => [f.x, blankAt(f) ? 'blank' : finalAt(f) ? 'final' : f.px.map((p) => p.slice(0, 3).join(',')).join(' ')]) };
  ok('switch: the links were late (the control: a link reads not complete for a while)', /"early":[1-9]/.test(info.switch.links), info.switch.links);
  ok('switch: plane 1 at rest is plane z\'s Cauchy plot at the points outside the circle', SWITCH_PTS.every((_, k) => !differ(finalOut[k], plotOut[k])), info.switch);
  ok('switch: negative control: those points\' colour before the switch (the stages\' colour) is not the Cauchy colour', SWITCH_PTS.some((_, k) => differ(phaseOut[k], finalOut[k])), info.switch);
  ok('switch: the thread reached plane 1 within the frames sampled', seen.some((f) => f.x === 1), info.switch.frames);
  ok('switch: every frame past z is the final picture (never blank, never the stages\' colour)', seen.every((f) => f.x === 0 || finalAt(f)), info.switch.frames);
  ok('switch: every frame on plane z is drawn: the late-link stand-in or the final picture, not a blank plane', seen.every((f) => f.x !== 0 || !blankAt(f)), info.switch.frames);
  // The same switch and step with the Play gate on (the page's default): the press waits for the prestart and starts no glide, and
  // plane z, which the wait leaves on the screen, is still drawn (the late-link stand-in or the final picture, as the held glide's
  // frames are above), never blank; the glide then reaches plane 1 once the programs have linked
  await open(Object.assign({}, stateId, { dc: prev }));
  await ev('(__cmwSteps({ T: 0 }), 1)');
  await settled({ until: '!__cmwSteps().moving && __cmwSteps().i === 0 && __cmwSteps().ready.ready && !GLR.pendingLinks', max: SWITCH_MS });
  await ev(`(() => { let b = document.querySelector('[id="dcSeg"] [data-v="cauchy"]'); if (!b || !b.getClientRects().length) { document.querySelector('#leftFoot .opts-btn').click(); b = document.querySelector('.opts-pop [data-v="cauchy"]'); } b.click(); return 1; })()`);
  await ev('(__cmwSteps({ T: 0, go: 1 }), 1)');
  const gated = [];
  for (let i = 0; i < SWITCH_FRAMES; i++) gated.push({ x: await ev('+__cmwSteps().x.toFixed(3)'), px: await pixels(SWITCH_PTS) });
  await settled({ until: '!__cmwSteps().moving && __cmwSteps().i === 1 && __cmwSteps().ready.ready && !GLR.pendingLinks', max: SWITCH_MS });
  const gatedOnZ = gated.filter((f) => f.x === 0);
  info.gated = { frames: gated.map((f) => [f.x, f.px.every((p) => !coloured(p)) ? 'blank' : 'drawn']), onZ: gatedOnZ.length, blank: gatedOnZ.filter((f) => f.px.every((p) => !coloured(p))).length };
  ok('gated switch: the press waits on plane z for the links (the control: the thread is on z for some of the frames sampled)', gatedOnZ.length > 0, info.gated);
  ok('gated switch: every frame on plane z is drawn: the late-link stand-in or the final picture, not a blank plane', info.gated.blank === 0, info.gated);
  ok('gated switch: the glide reaches plane 1 once the programs have linked', (await ev('__cmwSteps().i')) === 1, info.gated);
  // The same switch with no press at all: the thread stays at rest on plane z while the programs of the carried colour link late, and
  // plane z, drawn by the still core, is the late-link stand-in and then the final picture, never a blank plane. (A press has the glide's
  // hold to draw plane z; with none, the rest draw has to.)
  await open(Object.assign({}, stateId, { dc: prev }));
  await ev('(__cmwSteps({ T: 0 }), 1)');
  await settled({ until: '!__cmwSteps().moving && __cmwSteps().i === 0 && __cmwSteps().ready.ready && !GLR.pendingLinks', max: SWITCH_MS });
  const before = await pixels(SWITCH_PTS), capBefore = await ev('__cmwLegend().caption');
  await ev(`(() => { let b = document.querySelector('[id="dcSeg"] [data-v="cauchy"]'); if (!b || !b.getClientRects().length) { document.querySelector('#leftFoot .opts-btn').click(); b = document.querySelector('.opts-pop [data-v="cauchy"]'); } b.click(); return 1; })()`);
  const still = [];
  for (let i = 0; i < SWITCH_FRAMES; i++) still.push({ x: await ev('+__cmwSteps().x.toFixed(3)'), linking: await ev('GLR.pendingLinks'), px: await pixels(SWITCH_PTS), cap: await ev('__cmwLegend().caption'), tip: await ev("document.getElementById('leftLed').getAttribute('data-tip')") });
  await settled({ until: '!GLR.pendingLinks', max: SWITCH_MS });
  const after = await pixels(SWITCH_PTS);
  const stillOnZ = still.filter((f) => f.x === 0);
  info['still ' + prev] = { frames: still.map((f) => [f.x, f.linking, f.px.every((p) => !coloured(p)) ? 'blank' : 'drawn']), onZ: stillOnZ.length, blank: stillOnZ.filter((f) => f.px.every((p) => !coloured(p))).length };
  ok(`no-press switch from ${prev}: the links were late (the control: some of the frames sampled were taken with links pending)`, still.some((f) => f.linking > 0), info['still ' + prev]);
  ok(`no-press switch from ${prev}: the thread stays on plane z (the control: every frame sampled is on z)`, stillOnZ.length === SWITCH_FRAMES, info['still ' + prev]);
  ok(`no-press switch from ${prev}: every frame on plane z at rest is drawn: the late-link stand-in or the final picture, not a blank plane`, info['still ' + prev].blank === 0, info['still ' + prev]);
  // (one change, from the picture the plane had to the Cauchy plot: while the Cauchy program links, plane z holds the previous style's
  // picture, the phase portrait, as it was drawn before the switch, not F's values in the Cauchy style's look)
  const is = (px, ref) => px.every((p, i) => far(p, ref[i]) <= HOLD_TOL), landed = still.findIndex((f) => is(f.px, after));
  const held = still.slice(0, landed < 0 ? still.length : landed), changes = still.filter((f, i) => i > 0 && is(f.px, before) !== is(still[i - 1].px, before)).length;
  info['hold ' + prev] = { before, after, frames: still.length, landed, held: held.length, heldLinking: held.filter((f) => f.linking > 0).length, changes };
  ok(`no-press switch from ${prev}: the plane had a coloured picture before the switch, and the Cauchy plot differs from it (the controls)`, before.some(coloured) && !is(after, before), info['hold ' + prev]);
  ok(`no-press switch from ${prev}: until the Cauchy plot lands, plane z holds the picture it had before the switch: one change, from it to the Cauchy plot`, landed > 0 && held.every((f) => is(f.px, before)) && still.slice(landed).every((f) => is(f.px, after)) && held.some((f) => f.linking > 0), info['hold ' + prev]);
  // (and what the pane says goes with what it shows: the key keeps the held style's caption until the Cauchy plot lands, then reads
  // "Cauchy integral" (the frame in which it lands is read a moment apart from its pixels: one frame of either is let go); the LED's
  // tip says the previous picture is shown, never "a quick preview")
  const QUICK = 'Drawing a quick preview; the exact plot is still being built', PREV = 'Showing the previous picture; the Cauchy plot is still being built';
  info['hold ' + prev].keys = { before: capBefore, held: [...new Set(held.map((f) => f.cap))], after: [...new Set(still.slice(landed).map((f) => f.cap))], tips: [...new Set(held.map((f) => f.tip))] };
  ok(`no-press switch from ${prev}: the key keeps the held style's caption until the Cauchy plot lands, and then reads "Cauchy integral"`, held.length > 1 && held.slice(0, -1).every((f) => f.cap === capBefore) && still.slice(landed + 1).every((f) => f.cap === 'Cauchy integral'), info['hold ' + prev]);
  ok(`no-press switch from ${prev}: while the picture is held the LED's tip says the previous picture is shown, never a quick preview`, held.every((f) => f.tip !== QUICK) && held.some((f) => f.tip === PREV), info['hold ' + prev]);
}
// A Cauchy compile that fails does not leave the held picture on the plane for good: the programs linked after the switch fail (a shim
// over LINK_STATUS, for programs whose link began after window.__failLinks), the frame says why (GLR.frameStatus().error), and plane z
// shows something other than the picture it held while the link was pending.
{
  const fail = await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const P = WebGL2RenderingContext.prototype, lp = P.linkProgram, gp = P.getProgramParameter, bad = new WeakSet(); P.linkProgram = function (p) { if (window.__failLinks) bad.add(p); return lp.call(this, p); }; P.getProgramParameter = function (p, k) { return k === 0x8B82 && bad.has(p) ? false : gp.call(this, p, k); }; })();` });
  try {
    await open(Object.assign({}, stateId, { dc: 'phase' }));
    await ev('(__cmwSteps({ T: 0 }), 1)');
    await settled({ until: '!__cmwSteps().moving && __cmwSteps().i === 0 && __cmwSteps().ready.ready && !GLR.pendingLinks', max: SWITCH_MS });
    const before = await pixels(SWITCH_PTS);
    await ev('(window.__failLinks = true, 1)');
    await ev(`(() => { let b = document.querySelector('[id="dcSeg"] [data-v="cauchy"]'); if (!b || !b.getClientRects().length) { document.querySelector('#leftFoot .opts-btn').click(); b = document.querySelector('.opts-pop [data-v="cauchy"]'); } b.click(); return 1; })()`);
    await settled({ until: '!GLR.pendingLinks', max: SWITCH_MS });
    const w = await settled({ until: '!!GLR.frameStatus().error', max: SWITCH_MS });
    const gone = await pixels(SWITCH_PTS), err = await ev('String(GLR.frameStatus().error || "")');
    const tip = await ev("document.getElementById('leftLed').getAttribute('data-tip')"), ledErr = await ev("/\\berr\\b/.test(document.getElementById('leftLed').className)"), noteBox = await ev("__cmwNoteBox('L')");
    info.failed = { before, gone, err: err.slice(0, 200), wait: w, tip, ledErr, noteBox: !!noteBox };
    ok('failed Cauchy compile: the frame says it failed (the control: the link did fail)', w.ok && err.length > 0, info.failed);
    ok('failed Cauchy compile: the note, the red LED and its tip say why and what to do: choose another colour style', !!noteBox && ledErr && tip === `${err} Choose another colour style.`, info.failed);
    ok('failed Cauchy compile: plane z does not show the picture it held while the link was pending', !gone.every((p, i) => far(p, before[i]) <= HOLD_TOL), info.failed);
  } finally {
    await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: fail.identifier });
  }
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error' || x.t === 'warn') && !/Failed to load resource|favicon/.test(x.m || ''));
ok('no page errors or warnings', !errs.length, errs.slice(0, 4).map((x) => String(x.m).slice(0, 300)));
return { pass: fails.length === 0, fails, info };
