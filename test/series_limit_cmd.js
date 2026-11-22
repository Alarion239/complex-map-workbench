// The Series step's float32 limit in a glide's inverse pass, pinned (the rule: notes/sphere-design/SPEC.md §7): where the left pane is white, and why.
// One Series step (the sum of z^n / n!), the rectangle [-3, 3]^2, Inside regions (the default), parked at u = 1/2 of the
// glide. Every 24th pixel of the left pane is read from the canvas, and the CPU's float64 members of its point in plane w
// (Inverse.homOps' NEWT op, op.pre(w, trace), as test/newt_member0_cmd.js reads them) say what the pixel should be:
// - a member inside the rectangle whose walk is clear of the cancelled points (glsl.js's SER_CANCEL, or |z| > 88): the
//   pixel should be coloured; where the GPU's float32 walk lost it, the pixel is white anyway. That is the limit: a ragged
//   band along the image's edge, a few pixels wide. It is counted and bounded, so that a change that widens it is seen;
// - every member inside the rectangle walks into a cancelled point ("cancelled"): the pixel is white; none are at u = 1/2;
// - no member inside the rectangle ("outside"): the picture outside the regions' image, white by the rule of Inside regions.
// A coloured pixel with no member in op.pre's list ("listLacks") has a root inside the rectangle by a seeded Newton search
// (the list stops short of some roots the GPU finds; counted, not asserted); one with none is an artefact.
// Asserted: no coloured pixel is an artefact or has only cancelled walks; the white pixels the float32 walk lost (the band)
// are at most BAND_MAX of those sampled.
// Controls: the page is on the inverse pass; the sample has MIN_* coloured and white pixels, so that no row passes on a few.
// Page: dist/glsl-inverse-test.html (the CPU side). A command file for a CDP daemon (test/cdp_kit README); prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const GLSL = fs.readFileSync(path.join(DIR, '../../src/glsl.js'), 'utf8');
// (SER_CANCEL: `${M} * ROUND > SHARE * (1.0 + cx_abs(${S}))`; a template of another form stops the suite with a message)
const cancelAt = /const SER_CANCEL = \(M, S\) => `\$\{M\} \* ([0-9.e-]+) > ([0-9.e-]+) \* \(1\.0 \+ cx_abs/.exec(GLSL);
if (!cancelAt) throw new Error('src/glsl.js: SER_CANCEL is not `${M} * ROUND > SHARE * (1.0 + cx_abs(${S}))`, the form this suite reads its rounding and share from');
const [, CANCEL_ROUND, CANCEL_SHARE] = cancelAt.map(Number);
const evp = new Function('ev', 'sleep', fs.readFileSync(path.join(DIR, '../inv_bench_evp.js'), 'utf8'))(ev, sleep);
const U = 0.5, STEP = 24, RECT = 3;
// (measured at u = 1/2 on 1,050 pixels: 2 band pixels; the bound leaves room for another renderer's rounding)
const BAND_MAX = 8, MIN_COLOURED = 150, MIN_WHITE = 300, SEEDS = 21, SEED_R = 6, FRAME_MS = 120000;
const ns = 'sl' + Date.now();
const st = { shapes: [{ id: 's1', kind: 'rect', a: [-RECT, -RECT], b: [RECT, RECT], ci: 0, visible: true }], steps: [{ type: 'series', params: {}, on: true }] };
await view(1440, 900, false);
await load(ns, st, '', 'steps');
await settled({ max: 60000, until: 'typeof __cmwSteps === "function" && __cmwSteps().on && __cmwSteps().ready.ready === true' });
await ev(`__cmwSteps({ x: ${U} }), 1`);
// (parked at U, the inverse pass's frame drawn with its programs linked: the pane's status neither pending nor compiling)
const parked = await settled({ max: FRAME_MS, panes: false, until: `(() => { const s = __cmwPaneStatus('L'), g = __cmwSteps().glide; return !!s && !s.pending && !s.compiling && !!g && g.path === 'inverse' && Math.abs(g.u - ${U}) < 1e-9 && !__cmwSteps().anim; })()` });
ok('the glide is parked at u = 1/2 and its inverse frame is drawn', parked.ok, parked);
const g = JSON.parse(await ev('JSON.stringify(__cmwSteps().glide)'));
ok('the glide is the inverse pass', g.path === 'inverse', g.path);
const PIXEL = 1 / g.view.s;
const px = await ev(`(() => {
  const cv = document.querySelector('#canvasL'), c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(cv, 0, 0);
  const W = c.width, H = c.height, d = x.getImageData(0, 0, W, H).data, out = [];
  for (let j = ${STEP / 2}; j < H; j += ${STEP}) for (let i = ${STEP / 2}; i < W; i += ${STEP}) { const k = 4 * (j * W + i); out.push([i, j, d[k], d[k + 1], d[k + 2]]); }
  return out;
})()`);
const white = (p) => Math.min(p[2], p[3], p[4]) >= 235;
const coloured = (p) => Math.max(p[2], p[3], p[4]) - Math.min(p[2], p[3], p[4]) > 40;
const pts = px.map((p) => ({ w: [(p[0] + 0.5 - g.w / 2) / g.view.s + g.view.cx, -(p[1] + 0.5 - g.h / 2) / g.view.s + g.view.cy], c: white(p) ? 'white' : coloured(p) ? 'coloured' : 'other' }));
await nav(`http://localhost:${PORT}/glsl-inverse-test.html`);
await settled({ max: 60000, panes: false, until: 'typeof Funcs !== "undefined" && typeof Inverse !== "undefined"' });
const tab = await evp(`(async () => {
  const pts = ${JSON.stringify(pts)};
  const b = Funcs.build({ type: 'series', params: Funcs.defaults('series'), on: true });
  const op = Inverse.homOps(b, ${U}).ops.find((q) => q.kind === 'NEWT'), Ht = b.hom(${U});
  const lostAt = (z) => !(Number.isFinite(z.re) && Number.isFinite(z.im)) || Math.hypot(z.re, z.im) > 88 || Math.exp(Math.hypot(z.re, z.im)) * ${CANCEL_ROUND} > ${CANCEL_SHARE} * (1 + Math.exp(z.re));
  const inRect = (z) => Math.abs(z.re) < ${RECT} && Math.abs(z.im) < ${RECT};
  // (a root of H_t - w inside the rectangle by Newton from a grid of seeds: the judge's independent search of #1898, which finds the roots op.pre's list lacks)
  const rootInRect = (w) => {
    for (let a = 0; a < ${SEEDS}; a++) for (let c = 0; c < ${SEEDS}; c++) {
      const v = op.polish({ re: -${SEED_R} + a * 2 * ${SEED_R} / (${SEEDS} - 1), im: -${SEED_R} + c * 2 * ${SEED_R} / (${SEEDS} - 1) }, w), hv = v && Number.isFinite(v.re) && Number.isFinite(v.im) && Ht(v);
      if (hv && Math.hypot(hv.re - w.re, hv.im - w.im) / (1 + Math.hypot(w.re, w.im)) <= 1e-9 && inRect(v)) return true;
    }
    return false;
  };
  const tab = {};
  for (const p of pts) {
    const w = { re: p.w[0], im: p.w[1] }, walk = {}, mem = op.pre(w, (m, v) => (walk[m] || (walk[m] = [])).push(v));
    const leaves = mem.filter((m) => inRect(m.u)), cut = (m) => lostAt(m.u) || (walk[m.m] || []).some(lostAt);
    let k = leaves.length === 0 ? 'outside' : leaves.every(cut) ? 'cancelled' : 'clean';
    // (a pixel on the image's edge is antialiased: its colour may come from a point one pixel from its centre)
    if (p.c === 'coloured' && k === 'outside') k = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, c]) => rootInRect({ re: w.re + a * ${PIXEL}, im: w.im + c * ${PIXEL} })) ? 'listLacks' : 'artefact';
    const key = p.c + '/' + k;
    tab[key] = (tab[key] || 0) + 1;
  }
  return tab;
})()`, 900000);
info.tab = tab;
const n = (k) => tab[k] || 0, sum = (c) => ['outside', 'cancelled', 'clean', 'listLacks', 'artefact'].reduce((s, m) => s + n(c + '/' + m), 0);
ok('the sample has coloured pixels', sum('coloured') >= MIN_COLOURED, sum('coloured'));
ok('the sample has white pixels', sum('white') >= MIN_WHITE, sum('white'));
ok('no coloured pixel is an artefact: each has a root inside the rectangle (op.pre\'s, or the seeded search\'s)', n('coloured/artefact') === 0, n('coloured/artefact'));
ok('no coloured pixel has only walks into cancelled points', n('coloured/cancelled') === 0, n('coloured/cancelled'));
ok(`the white pixels with a clean member (the band) are at most ${BAND_MAX}`, n('white/clean') <= BAND_MAX, n('white/clean'));
return { pass: fails.length === 0, fails, info };
