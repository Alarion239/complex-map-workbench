// The steps view's moving frames draw the axes (Re = 0, Im = 0) and the major grid over the colour as the parked planes do
// (the colour plot's colourGrid, in the frame's own camera, at full strength, no fade): a guard for the standing rule
// that moving frames are drawn like the parked planes.
// The glide's frames a hair from each plane (x = FIRST and 1 - FIRST, set through __cmwSteps({ x })) are read from the
// left pane's canvas and compared with the parked frame of that plane. Each frame is read by what the rest renderer
// strokes over the colour (--dc-casing at 40 % and --dc-line at --dc-axis-a for the axes, --dc-line at --dc-line-a for
// the major grid): at each line pixel whose two neighbours across the line (3 CSS px off) agree within DIFF_TOL, the
// stroke is expected where it would move the colour by more than DIFF_TOL; the share of those pixels that are not
// where it puts them is the frame's `over`. A moving frame has the lines when it has as many such pixels as the parked
// frame (at least MIN_PX) and about as many of them right (the difference of the two shares at most SAME_OVER).
// Controls, each of which must fail the same comparison: the frame drawn bare (__cmwSteps({ bare: true }), no lines),
// and the parked frame read as if its lines were LINE_SHIFT CSS px off.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard. Prints {pass, fails, info}.
// The cases: the default example (Strip to disk) Inside regions and the Böttcher coordinates Everywhere.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const { grab, DIFF_TOL } = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'held_frames.js'), 'utf8'));
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const FIRST = 0.002;          // (a glide's first and last frames: x from either plane)
const MIN_PX = 300;           // (the pixels at which the strokes are expected, in axes and in grid: the parked frames have 375 to 1250 axes pixels and 979 to 5156 grid ones)
const SAME_OVER = 0.05;       // (two frames' shares of those pixels not drawn right, at most this far apart)
const LINE_SHIFT = 2;         // (CSS px: the control's lines off)
const EDGE_CSS = 24;          // (the rulers' band, left out: a moving frame has none)
const CASES = [
  { tag: 'Strip to disk', example: null, scope: 'in' },
  { tag: 'Böttcher coordinates, Everywhere', example: 'Böttcher coordinates of a Julia set', scope: 'all' },
];
const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
await view(1200, 800, false, false);
const ready = () => settled({ max: 60000, until: 'typeof __cmwSteps === "function" && typeof __cmwExample === "function" && typeof __cmwSvX === "function" && !!window.GLR' });
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }), 1`); await settled({ max: 60000, until: `!__cmwSteps().moving && __cmwSvX() === ${i}` }); };
const at = async (x) => { await ev(`__cmwSteps({ x: ${x} }), 1`); await settled({ max: 60000, until: `GLR.pendingLinks === 0 && Math.abs(__cmwSvX() - ${x}) < 1e-9 && __cmwSteps().moving` }); };
// the page's reader of a kept frame (tag) for the camera win = [cx, cy, s], its lines dx, dy CSS px off:
// { axes: { n, over }, grid: { n, over } }
const READER = `window.__lineShare = (tag, win, dx, dy, edge, tol) => {
  const P = window.__heldPx[tag], c = document.getElementById('canvasL'), W = c.width, H = c.height, d = W / c.getBoundingClientRect().width;
  const cw = W / d, ch = H / d, [cx, cy, s] = win;
  const cs = getComputedStyle(document.documentElement), hex = (v, f) => { const h = (cs.getPropertyValue(v).trim() || f).slice(1); return [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16)); };
  const ink = hex('--dc-line', '#FFFFFF'), casing = hex('--dc-casing', '#0B1114'), aL = parseFloat(cs.getPropertyValue('--dc-line-a')) || 0.22, aA = parseFloat(cs.getPropertyValue('--dc-axis-a')) || 0.7;
  const K = Math.round(3 * d), st = Axes.niceStep(110 / s), out = { axes: { n: 0, over: 0 }, grid: { n: 0, over: 0 } };
  // (the pixel i, its neighbours j and k across the line: counted when they agree and the stroke would show; over when i is not where the stroke puts it)
  const px = (i, j, k, want, o) => {
    let smooth = true, seen = false, off = false;
    for (let q = 0; q < 3; q++) {
      const m = (P[j + q] + P[k + q]) / 2, w = want(m, q);
      if (Math.abs(P[j + q] - P[k + q]) > tol) smooth = false;
      if (Math.abs(w - m) > tol) seen = true;
      if (Math.abs(P[i + q] - w) > tol) off = true;
    }
    if (!smooth || !seen) return;
    o.n++; if (off) o.over++;
  };
  const grid = (m, q) => m * (1 - aL) + ink[q] * aL, axis = (m, q) => (m * 0.6 + casing[q] * 0.4) * (1 - aA) + ink[q] * aA;
  const e = Math.round(edge * d);
  // (a vertical line at CSS x, a horizontal one at CSS y: the pixel the rest renderer's 1 px line at Math.round(x) + 0.5 covers)
  const vline = (x, want, o) => { const X = Math.floor((x + dx) * d); if (X - K < 0 || X + K >= W) return; for (let y = e; y < H - e; y++) px(4 * (y * W + X), 4 * (y * W + X - K), 4 * (y * W + X + K), want, o); };
  const hline = (y, want, o) => { const Y = Math.floor((y + dy) * d); if (Y - K < 0 || Y + K >= H) return; for (let x = e; x < W - e; x++) px(4 * (Y * W + x), 4 * ((Y - K) * W + x), 4 * ((Y + K) * W + x), want, o); };
  const ox = cw / 2 - cx * s, oy = ch / 2 + cy * s, x0 = cx - cw / 2 / s, x1 = cx + cw / 2 / s, y0 = cy - ch / 2 / s, y1 = cy + ch / 2 / s;
  vline(Math.round(ox) + 0.5, axis, out.axes); hline(Math.round(oy) + 0.5, axis, out.axes);
  for (let k = Math.ceil(x0 / st); k <= Math.floor(x1 / st); k++) if (k !== 0) vline(Math.round(cw / 2 + (k * st - cx) * s) + 0.5, grid, out.grid);
  for (let k = Math.ceil(y0 / st); k <= Math.floor(y1 / st); k++) if (k !== 0) hline(Math.round(ch / 2 - (k * st - cy) * s) + 0.5, grid, out.grid);
  for (const o of [out.axes, out.grid]) o.over = +(o.over / Math.max(1, o.n)).toFixed(4);
  return out;
}, 1`;
const WIN = '(() => { const v = __cmwSteps().win; return v; })()';
const read = async (tag, win, dx = 0, dy = 0) => ev(`window.__lineShare(${JSON.stringify(tag)}, ${JSON.stringify(win)}, ${dx}, ${dy}, ${EDGE_CSS}, ${DIFF_TOL})`);
// two frames' lines compared: both have the pixels, and as many of them right
const same = (a, b) => ['axes', 'grid'].every((k) => a[k].n >= MIN_PX && b[k].n >= MIN_PX && Math.abs(a[k].over - b[k].over) <= SAME_OVER);
async function lines(c, r) {
  await go(`http://localhost:${PORT}/test.html?ns=lines${Date.now()}`);
  await ready();
  if (c.example) {
    const ex = names.indexOf(c.example);
    ok(`${c.tag}: the example is found`, ex >= 0, names.length);
    await ev(`__cmwExample(${ex}); 1`);
    await settled({ max: 60000 });
  }
  // (100 % opacity and no paths: the colour under the lines is the plane's alone)
  await ev(`__cmwSet('morphPaths', false), __cmwSet('alpha', 1), __cmwSteps(${JSON.stringify({ scope: c.scope, surf: 'plane' })}), ${READER}`);
  for (const [x, k] of [[FIRST, 0], [1 - FIRST, 1]]) {
    r.step = `plane ${k}`;
    await rest(k);
    const restOk = await grab('P' + k), winRest = await ev(WIN), parked = await read('P' + k, winRest);
    await at(x);
    const held = await grab('G' + k), winGlide = await ev(WIN), glide = await read('G' + k, winGlide);
    // (the controls: the same frame drawn bare, and the parked frame read with its lines LINE_SHIFT px off)
    await ev('window.__bareRec = __cmwSteps().glide, __cmwSteps({ bare: true }), 1');
    await settled({ max: 60000, until: '__cmwSteps().glide !== window.__bareRec' });
    const bareOk = await grab('B' + k), bare = await read('B' + k, winGlide);
    await ev('__cmwSteps({ bare: false }), 1');
    const shifted = await read('P' + k, winRest, LINE_SHIFT, LINE_SHIFT);
    r[k] = { restOk, held, bareOk, parked, glide, bare, shifted };
    ok(`${c.tag}: plane ${k}'s parked and its glide frame (x = ${x}) are read`, restOk && held && bareOk, r[k]);
    ok(`${c.tag}: the frame at x = ${x} draws the axes and the major grid as plane ${k}'s parked frame (at least ${MIN_PX} pixels each, shares of them right within ${SAME_OVER})`, same(glide, parked), { glide, parked });
    ok(`${c.tag}: control: the frame drawn bare is not plane ${k}'s (no axes, no grid)`, !same(bare, parked), { bare, parked });
    ok(`${c.tag}: control: plane ${k}'s parked frame read ${LINE_SHIFT} px off its lines is not its own`, !same(shifted, parked), { shifted, parked });
    await rest(0);
  }
}
for (const c of CASES) {
  const r = info[c.tag] = {}, t0 = Date.now();
  try { await lines(c, r); } catch (e) { ok(`${c.tag}: the case runs to its end`, false, { at: r.step, error: String(e && e.message || e).slice(0, 300) }); }
  r.s = Math.round((Date.now() - t0) / 1000);
}
return { pass: fails.length === 0, fails, info };
