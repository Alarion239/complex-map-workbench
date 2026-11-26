// The steps view's glide onto the logarithm's plane draws the other sheets' copies front to back (#2069): where two
// copies meet along a cut's image, each covers part of the pixels there, and blended by SRC_ALPHA_SATURATE those parts make
// the whole pixel, where painter's order leaves the planes' plots under them showing through as a line. The log (cut
// 180), Everywhere, the plane, the colour layer alone (bare), s = 30 px per unit, 1440 x 900 at dpr 2, held with
// __cmwSteps({ x }). The control is painter's order (__cmwSteps({ glideOrder: 'painter' })). Show-through: the pixels
// where the frame with the plots under it (restPaint 1) and the frame without (restPaint 0) differ by more than DIFF levels
// in a channel, which the carried colour leaves to the plots.
// - R1: at u = .7 the show-through is at most SEAM_MAX pixels (painter's order: about 1,600); and at .7 and .9, on
//   painter's show-through, at most SEAM_MAX pixels of the frame without the plots are more than DIFF off the median of
//   their 8 neighbours (the seam's dots, whatever shows through them), and none is less than opaque;
// - R2: at u = .9 and .97 it is at least SEAM_LESS pixels below painter's;
// - R3 (where copies overlap, the same one wins as in painter's order): at u = .3, .5, .7, .9 and .97, against painter's
//   frame, no differing pixel has CLUMP or more differing neighbours of its 8, so no area changes colour, only lines a
//   pixel wide;
// - R4 (those lines are painter's seams, gone): at the same u, at most SEAM_MAX of the pixels that differ from painter's
//   frame are more than DIFF off the median of their 8 neighbours, leaving out the picture's own edges, where the colour
//   two pixels either side is more than EDGE apart (painter's frame on the same pixels: about 240 to 2,950 off, up to
//   about 130 levels). Painter's order draws a seam at u = .5 too, where the copies meet with the whole pixel covered: a
//   leaf on its cut takes its colour past the cut there, invLeaf's uCutIn;
// - R5: the frames that do not draw copies by the inverse pass are painter's, byte for byte: z⁵ − 5z then √ (the carried
//   mesh) and the log with its copies left out (glideSheets 1). (No glide frame has a REPT plan to check: a repeated step
//   inverts exactly only as its plane's one step, and its glide is drawn by the carried mesh);
// - R7 (info, not gated): the frame's time at u = .9, front to back against painter's, __cmwTime(8), medians of
//   alternated rounds.
// The record names the order: __cmwSteps().glide.sat is true front to back and false in painter's order.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const { grab } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
// (the bounds, from frames on lavapipe: DIFF, a channel apart by more than the saturate sum's rounding; SEAM_MAX, R1
// measures 0 against painter's 1,605; SEAM_LESS, R2 measures about 4,400 and 5,600 fewer; CLUMP, a pixel of a seam
// line one or two pixels wide has at most 6 differing neighbours, one inside a changed area 8; EDGE, the log's smooth
// colour changes less across 4 pixels at s = 30, and its bands' anti-aliased edges, 17 to 19 off at u = .97, more)
const DIFF = 8, SEAM_MAX = 20, SEAM_LESS = 2000, CLUMP = 7, EDGE = 32, ROUNDS = 3;
await view(1440, 900, false, false);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
const step = (type, params) => ({ type, params: params || {}, on: true });
const open = async (steps, s) => {
  const ns = 'seams' + Date.now();
  await seed(ns, { v3: true, v4: true, v5: true, v6: true, nextId: 50, focus: 0, shapes: [], steps, srcView: { cx: 0, cy: 0, s } });
  await go(`http://localhost:${PORT}/test.html?ns=${ns}&view=steps`);
  await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
};
const plane = async (go) => {
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: ${go}, now: true, bare: true }); 1`);
  await settled({ max: 60000 });
};
// (the frame at x, in the order and with the plots under it or not, kept as tag; the glide's record)
const frame = async (x, order, rest, tag) => {
  await ev(`__cmwSteps({ glideOrder: '${order}', restPaint: ${rest}, x: ${x} }); 1`);
  await settled({ max: 60000 });
  ok(`${tag}: the frame is still`, await grab(tag), null);
  return ev('(() => { const g = __cmwSteps().glide || {}; return { path: g.path, sat: g.sat, sheets: g.sheets }; })()');
};
// (the pixels where kept frames a and b differ by more than DIFF levels in a channel: how many, the largest difference,
// and how many of them have CLUMP or more differing neighbours of their 8; outside: a third frame pair's differing pixels
// left out, and the largest difference of the rest)
const diff = (a, b, outA, outB) => ev(`(() => {
  const A = window.__heldPx[${JSON.stringify(a)}], B = window.__heldPx[${JSON.stringify(b)}], W = document.getElementById('canvasL').width, H = A.length / 4 / W;
  const OA = ${outA ? `window.__heldPx[${JSON.stringify(outA)}]` : 'null'}, OB = ${outB ? `window.__heldPx[${JSON.stringify(outB)}]` : 'null'};
  const d = (P, Q, i) => Math.max(Math.abs(P[i] - Q[i]), Math.abs(P[i + 1] - Q[i + 1]), Math.abs(P[i + 2] - Q[i + 2]));
  const on = new Uint8Array(W * H);
  let n = 0, max = 0, outMax = 0;
  for (let p = 0; p < W * H; p++) { const v = d(A, B, 4 * p); if (v > ${DIFF}) { on[p] = 1; n++; } if (v > max) max = v; if (OA && !(d(OA, OB, 4 * p) > ${DIFF}) && v > outMax) outMax = v; }
  let clumps = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!on[y * W + x]) continue;
    let k = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && on[(y + dy) * W + x + dx]) k++;
    if (k >= ${CLUMP}) clumps++;
  }
  return { n, max, clumps, outMax: OA ? outMax : null };
})()`);

// ---- the log ----
await open([step('log', { cut: 180, k: 0 })], 30);
await plane(0);
const show = {};
for (const u of [0.3, 0.5, 0.7, 0.9, 0.97]) {
  const r = info[`u ${u}`] = {};
  r.front = await frame(u, 'front', 1, `f${u}`);
  r.painter = await frame(u, 'painter', 1, `p${u}`);
  ok(`u = ${u}: front to back, the record says so, painter's order says not`, r.front.sat === true && r.front.path === 'inverse' && r.painter.sat === false, r);
  if (u !== 0.3 && u !== 0.5) {
    await frame(u, 'front', 0, `f${u}r0`);
    await frame(u, 'painter', 0, `p${u}r0`);
    show[u] = { front: await diff(`f${u}`, `f${u}r0`), painter: await diff(`p${u}`, `p${u}r0`) };
    r.show = show[u];
  }
}
ok(`R1: at u = .7 the plots show through at most ${SEAM_MAX} pixels between the copies`, show[0.7].front.n <= SEAM_MAX, show[0.7]);
// (on the pixels where kept frames seamA and seamB differ by more than DIFF, frame tag's pixels more than DIFF off the
// median of their 8 neighbours (off, the largest max), and tag's pixels whose alpha is under 255 (thin). With smooth,
// a pixel on the picture's own edge in tag, two pixels either side of it more than EDGE apart in a channel along a row,
// a column or a diagonal, is counted as edge, not checked: an anti-aliased edge between two colours is off any median)
const dots = (tag, seamA, seamB, smooth) => ev(`(() => {
  const F = window.__heldPx[${JSON.stringify(tag)}], A = window.__heldPx[${JSON.stringify(seamA)}], B = window.__heldPx[${JSON.stringify(seamB)}], W = document.getElementById('canvasL').width, H = F.length / 4 / W;
  const med = (v) => v.sort((x, y) => x - y)[4];
  const far = (i, o) => Math.max(Math.abs(F[i + o] - F[i - o]), Math.abs(F[i + o + 1] - F[i - o + 1]), Math.abs(F[i + o + 2] - F[i - o + 2]));
  let seam = 0, off = 0, thin = 0, max = 0, edge = 0;
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = 4 * (y * W + x);
    if (F[i + 3] < 255) thin++;
    if (!(Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])) > ${DIFF})) continue;
    seam++;
    if (${!!smooth} && [8, 8 * W, 8 * W + 8, 8 * W - 8].some((o) => far(i, o) > ${EDGE})) { edge++; continue; }
    let d = 0;
    for (let c = 0; c < 3; c++) { const v = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) v.push(F[i + 4 * (dy * W + dx) + c]); d = Math.max(d, Math.abs(F[i + c] - med(v))); }
    if (d > ${DIFF}) off++;
    if (d > max) max = d;
  }
  return { seam, off, max, thin, edge };
})()`);
for (const u of [0.7, 0.9]) {
  const d = info[`u ${u}`].dots = { front: await dots(`f${u}r0`, `p${u}`, `p${u}r0`), painter: await dots(`p${u}r0`, `p${u}`, `p${u}r0`) };
  ok(`R1: at u = ${u}, on painter's seam, no dots: at most ${SEAM_MAX} pixels more than ${DIFF} levels off their neighbours' median, none with alpha under 255`, d.front.off <= SEAM_MAX && d.front.thin === 0, d);
}
for (const u of [0.9, 0.97]) ok(`R2: at u = ${u} the plots show through at least ${SEAM_LESS} fewer pixels than in painter's order`, show[u].front.n <= show[u].painter.n - SEAM_LESS, show[u]);
for (const u of [0.3, 0.5, 0.7, 0.9, 0.97]) {
  const d = info[`u ${u}`].vsPainter = await diff(`f${u}`, `p${u}`);
  ok(`R3: at u = ${u} no area changes against painter's order (no differing pixel with ${CLUMP} or more differing neighbours)`, d.clumps === 0, d);
  const e = info[`u ${u}`].changed = await dots(`f${u}`, `f${u}`, `p${u}`, true);
  info[`u ${u}`].changedPainter = await dots(`p${u}`, `f${u}`, `p${u}`, true);
  ok(`R4: at u = ${u} the pixels that differ from painter's order leave no line: at most ${SEAM_MAX} more than ${DIFF} levels off their neighbours' median`, e.off <= SEAM_MAX, e);
}
// (R7, info: the frame's time at u = .9, front to back against painter's, alternated)
{
  const t = { front: [], painter: [] };
  await ev(`__cmwSteps({ restPaint: 1, x: 0.9 }); 1`);
  for (let i = 0; i < ROUNDS; i++) for (const order of ['front', 'painter']) {
    await ev(`__cmwSteps({ glideOrder: '${order}' }); 1`); await settled({ max: 60000 });
    t[order].push(await ev('__cmwTime(8).left'));
  }
  const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  info.R7 = { front: med(t.front), painter: med(t.painter), all: t };
}
// ---- R5: the frames that do not draw copies by the inverse pass ----
const same = async (x, tag) => {
  await frame(x, 'front', 1, `${tag}F`);
  await frame(x, 'painter', 1, `${tag}P`);
  return ev(`(() => { const A = window.__heldPx[${JSON.stringify(tag + 'F')}], B = window.__heldPx[${JSON.stringify(tag + 'P')}]; let n = 0; for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) n++; return n; })()`);
};
await ev(`__cmwSteps({ glideSheets: 1 }); 1`);
info.R5 = { alone: await same(0.9, 'alone') };
await ev(`__cmwSteps({ glideSheets: 0 }); 1`);
await open([step('custom', { expr: 'z^5-5z', cut: 180 }), step('root', { n: 2, cut: 180 })], 90);
await plane(1);
info.R5.mesh = await same(1.5, 'mesh');
info.R5.meshRec = await ev('(() => { const g = __cmwSteps().glide || {}; return { path: g.path, sat: g.sat }; })()');
ok('R5: the log with its copies left out (glideSheets 1) is painter\'s frame byte for byte', info.R5.alone === 0, info.R5);
ok('R5: z⁵ − 5z then √ (the carried mesh) is painter\'s frame byte for byte', info.R5.mesh === 0 && info.R5.meshRec.path === 'mesh', info.R5);

const errs = (await logs()).filter((e) => (e.t === 'EXC' || e.t === 'error' || e.t === 'log-error') && !/Failed to load resource|favicon/.test(e.m || ''));
ok('no errors in the console', errs.length === 0, errs.slice(0, 5));
return { pass: fails.length === 0, fails, info };
