// The steps view's carried colour where two sheets meet along a cut: the seam is the cut's image, drawn per
// pixel, so it is as smooth as the cut's image and nothing is left uncovered along it.
//  - teeth: exp then log, coloured from z (T 0), Everywhere, parked half-way between w1 and w2. In a band 40 device px
//    wide from the colour's left edge, in the rows 10 CSS px or more from the top and bottom, a smooth seam changes colour between vertically adjacent pixels about once a row
//    (a seam of slope s px per row crosses |s| pixels of a row); a sawtooth along it, a torn triangle drawn whole on one
//    sheet, crosses it at every tooth's slanted edge. In the worst 20 rows the mean count of such jumps per row is at
//    most 1.5. The same holds in every frame of the 2 s after a chain change (a step put first, the seam then between
//    w2 and w3), while the fill's programs link: the fill draws only with its mask, never a torn triangle whole
//  - cracks: Square root and its sheets, Everywhere, parked half-way between z and w1, where the cut's image is the two
//    rays from 0 at 135° and 225°: across each ray, no pixel of the paper's grey (max - min channel under 20) between
//    two coloured ones (max - min channel over 40) 3 px either side
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js).
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); return cond; };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1200, 800, false, false);
const ready = () => settled({ max: 30000, until: 'typeof __cmwSteps === "function" && typeof __cmwHideStrokes === "function"' });
// the left pane drawn: two reads of its pixels 100 ms apart agree (the glide's meshes are made in idle moments after
// the page is settled, and each lands in a later frame)
const drawn = async () => {
  for (let n = 0; n < 100; n++) {
    const same = await ev(`(() => { const c = document.getElementById('canvasL'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + 7 * d[i + 1] + 13 * d[i + 2]) | 0;
      const same = window.__seamsH === h; window.__seamsH = h; return same; })()`);
    if (same) return true;
    await sleep(100);
  }
  return false;
};
// parked at x with the scope given, the region lines, the strokes and the deformation's paths off (they cross the
// seam), the frame drawn
const park = async (x, scope) => {
  await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); 1`);
  await ev(`__cmwSteps({ scope: '${scope}', surf: 'plane', go: 0, now: true }); __cmwSteps({ scope: '${scope}', surf: 'plane', park: ${x} }); 1`);
  await settled({ max: 20000 });
  ok(`parked at ${x}: the frame is drawn`, await drawn(), null);
};

// teeth: exp then log
{
  const shapes = [{ id: 's1', kind: 'disc', c: [0, 0], r: 2, ci: 0, visible: true }, { id: 's2', kind: 'rect', a: [-1.5, -1.2], b: [1.2, 1.4], ci: 1, visible: true }];
  const ns = 'seams' + Date.now();
  await seed(ns, { steps: [{ id: 'f1', type: 'exp', params: {} }, { id: 'f2', type: 'log', params: { cut: 180, k: 0 } }], shapes, focus: 2 });
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
  await ready();
  ok('teeth: the page shows the steps view', await isSteps(), null);
  await ev('__cmwSteps({ T: 0 }); 1'); await settled({ max: 20000 });
  await park(1.5, 'all');
  // (the fill draws through its mask, started with it: that program made, then a frame drawn with it)
  await settled({ max: 30000, until: 'GLR.chainProgs().includes("regionKSCptm")' });
  await ev('__cmwHideStrokes(true), 1'); await settled({ max: 20000 });
  ok('teeth: the frame is drawn with the fill\'s mask', await drawn(), null);
  const TEETH = `(() => {
    const c = document.getElementById('canvasL'), W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const at = (x, y) => (y * W + x) * 4, sat = (i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    const dist = (i, j) => Math.hypot(d[i] - d[j], d[i + 1] - d[j + 1], d[i + 2] - d[j + 2]);
    const per = [], m = Math.round(10 * W / c.clientWidth);
    for (let y = m; y < H - m - 1; y++) {
      let e = -1;
      for (let x = Math.floor(W * 0.2); x < Math.floor(W * 0.6); x++) if (sat(at(x, y)) > 40) { e = x; break; }
      if (e < 0) continue;
      let n = 0;
      for (let x = e; x < Math.min(W, e + 40); x++) if (dist(at(x, y), at(x, y + 1)) > 60) n++;
      per.push([y, n]);
    }
    // (rows within 10 CSS px of the top and bottom edge are left out: the frame's own edge crosses the band there, a
    // horizontal step that is not the seam)
    // (the worst 20 rows in a row: the teeth of a sawtooth stand where the torn triangles are, not along the whole seam)
    let worst = 0, worstY = -1;
    for (let i = 0; i + 20 <= per.length; i++) { let s = 0; for (let j = i; j < i + 20; j++) s += per[j][1]; if (s / 20 > worst) { worst = s / 20; worstY = per[i][0]; } }
    const g = __cmwSteps().glide || {};
    return { label: __cmwSteps().label, path: g.path, reason: g.reason, rows: per.length, perRow: +worst.toFixed(2), worstY, W, H };
  })()`;
  const teeth = () => ev(TEETH);
  info.teeth = await teeth();
  // (the same frame without the cut fill: what the seam looks like where no torn triangle is drawn; for reference)
  await ev('GLR.carryProbes({ noFill: true }); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('without the fill: the frame is drawn', await drawn(), null);
  info.teethNoFill = await teeth();
  // (and with the fill drawn without its mask: the sawtooth; for reference)
  await ev('GLR.carryProbes({ noMask: true }); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('without the mask: the frame is drawn', await drawn(), null);
  info.teethNoMask = await teeth();
  await ev('GLR.carryProbes({}); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('teeth: the colour has a left edge in most rows', info.teeth.rows > info.teeth.H * 0.8, info.teeth);
  ok('teeth: exp then log, parked between w1 and w2: the seam along the cut is smooth (at most 1.5 colour jumps per row next to it, in its worst 20 rows)', info.teeth.perRow != null && info.teeth.perRow <= 1.5, info.teeth);
  // (the first frames after a chain change: a step put first, the same seam now between w2 and w3, parked there at
  // once. The window is what is checked: every animation frame of the 2 s after the park, on the page's clock, while
  // the new chain's programs link; a frame with no colour edge yet has no rows and does not count. The colour layer
  // alone is read (bare): a frame held on plane w2 at rest while the inverse pass's program links (svLinkHold) has the
  // cut's dashed handle along the very rows the scan reads, each dash a jump)
  await ev(`__cmwAddStep('mul', { c: '1' }, 0), 1`);
  await settled({ max: 20000, panes: false, until: '__cmwSteps().planes.length === 4' });
  await ev(`__cmwSteps({ T: 0, bare: true }); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', park: 2.5 });
    window.__seamsAfter = []; window.__seamsDone = false;
    { const t0 = performance.now(), tick = () => { window.__seamsAfter.push(${TEETH});
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else window.__seamsDone = true; };
      requestAnimationFrame(tick); } 1`);
  await settled({ max: 30000, panes: false, until: 'window.__seamsDone === true' });
  await ev(`__cmwSteps({ bare: false }); 1`);
  const after = (await ev('__seamsAfter.map((t) => ({ label: t.label, rows: t.rows, perRow: t.perRow }))')).filter((t) => t.rows > 0);
  info.afterChange = { frames: after.length, perRow: after.map((t) => t.perRow) };
  ok('teeth: frames were drawn in the 2 s after a chain change', after.length > 0, info.afterChange);
  const worst = after.reduce((w, t) => (t.perRow > w.perRow ? t : w), { perRow: 0 });
  ok('teeth: in the 2 s after a chain change, no frame shows a sawtooth along the seam (at most 1.5 colour jumps per row next to it, in its worst 20 rows)', worst.perRow <= 1.5, worst);
  // (and once settled, the seam is drawn: the colour reaches it in most rows)
  await settled({ max: 30000 }); await ev('__cmwHideStrokes(true), 1'); await settled({ max: 20000 });
  ok('after the chain change: the frame is drawn', await drawn(), null);
  info.afterSettled = await teeth();
  ok('after the chain change: the colour has a left edge in most rows, and the seam is smooth', info.afterSettled.rows > info.afterSettled.H * 0.8 && info.afterSettled.perRow <= 1.5, info.afterSettled);
  // (parked on w2 itself, the colour layer alone (the cut's handle is drawn along the seam): the log's cut is the
  // negative real axis there, a horizontal seam, its place in each column the row where the colour passes from the sheet
  // above to the sheet below. The inverse pass orders the two sheets by their keys, so that place is the same row in
  // every column, to a pixel; a staircase of teeth is a place that wanders)
  await ev(`__cmwSteps({ scope: 'all', surf: 'plane', park: 2, bare: true }); 1`); await settled({ max: 30000 });
  info.atW2 = await ev(`(() => {
    // (columns from 5 % of the width to 20 CSS px short of the origin; the two sheets are read 10 CSS px above and below the cut)
    const COL0 = 0.05, ORIGIN_GAP = 20, SHEET_GAP = 10;
    const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, W = c.width, H = c.height;
    const d = c.getContext('2d').getImageData(0, 0, W, H).data, o = __cmwW2S('L', 0, 0), ox = (o[0] - r.left) * k, yc = Math.round((o[1] - r.top) * k), m = Math.round(SHEET_GAP * k);
    const at = (x, y) => (y * W + x) * 4, dist = (i, j) => Math.hypot(d[i] - d[j], d[i + 1] - d[j + 1], d[i + 2] - d[j + 2]);
    const ys = [];
    for (let x = Math.round(COL0 * W); x < ox - ORIGIN_GAP * k; x++) {
      const a = at(x, yc - m), b = at(x, yc + m);
      if (dist(a, b) < 60) continue;
      let y = yc - m;
      while (y < yc + m && dist(at(x, y), a) <= dist(at(x, y), b)) y++;
      ys.push(y);
    }
    return { cols: ys.length, spread: ys.length ? Math.max(...ys) - Math.min(...ys) : null, yc, k, label: __cmwSteps().label };
  })()`);
  await ev(`__cmwSteps({ bare: false }); 1`);
  ok('parked on w2: the seam along the cut is on one row in every column, to a pixel (no teeth)', info.atW2.cols > 100 && info.atW2.spread <= Math.ceil(info.atW2.k), info.atW2);
}

// cracks: Square root and its sheets
{
  const names = [...fs.readFileSync(DIR + '/../../src/app/15-examples-guide.js', 'utf8').matchAll(/\bname: \$t\('((?:[^'\\]|\\.)*)'\)/g)].map((m) => m[1].replace(/\\'/g, "'"));
  const ex = names.indexOf('Square root and its sheets');
  ok('cracks: the example is found', ex >= 0, names.length);
  if (ex >= 0) {
    await go(`http://localhost:${PORT}/test.html?view=steps&ns=seamsq${Date.now()}`);
    await ready();
    await ev(`__cmwExample(${ex}); 1`); await settled({ max: 20000 });
    await park(0.5, 'all');
    // The ray is scanned from RAY_START px out to RAY_END of the smaller canvas side, over +-RAY_HALF px across it; a pixel is a crack when its
    // own saturation is under CRACK_SAT while the pixels FLANK px to both sides of the ray are above FLANK_SAT.
    const RAY_START = 30, RAY_END = 0.45, RAY_HALF = 4, FLANK = 3, CRACK_SAT = 20, FLANK_SAT = 40, MIN_SAMPLES = 500;
    info.cracks = await ev(`(() => {
      const RAY_START = ${RAY_START}, RAY_END = ${RAY_END}, RAY_HALF = ${RAY_HALF}, FLANK = ${FLANK}, CRACK_SAT = ${CRACK_SAT}, FLANK_SAT = ${FLANK_SAT};
      const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, W = c.width, H = c.height;
      const d = c.getContext('2d').getImageData(0, 0, W, H).data, o = __cmwW2S('L', 0, 0), O = [(o[0] - r.left) * k, (o[1] - r.top) * k];
      const sat = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return -1; const i = (y * W + x) * 4; return Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); };
      const out = {};
      for (const a0 of [135, 225]) {
        const A = a0 * Math.PI / 180, u = [Math.cos(A), -Math.sin(A)], n = [-u[1], u[0]];
        let samples = 0, cracks = 0, first = null;
        for (let rr = RAY_START; rr < Math.min(W, H) * RAY_END; rr++) for (let t = -RAY_HALF; t <= RAY_HALF; t++) {
          const p = [O[0] + rr * u[0] + t * n[0], O[1] + rr * u[1] + t * n[1]], s = sat(...p);
          if (s < 0) continue;
          samples++;
          if (s < CRACK_SAT && sat(p[0] - FLANK * n[0], p[1] - FLANK * n[1]) > FLANK_SAT && sat(p[0] + FLANK * n[0], p[1] + FLANK * n[1]) > FLANK_SAT) { cracks++; if (!first) first = [Math.round(p[0]), Math.round(p[1])]; }
        }
        out[a0] = { samples, cracks, first };
      }
      const g = __cmwSteps().glide || {};
      return { label: __cmwSteps().label, path: g.path, reason: g.reason, O: O.map(Math.round), out };
    })()`);
    for (const a0 of ['135', '225']) {
      const q = info.cracks.out[a0];
      ok(`cracks: Square root, parked half-way, the ray at ${a0}° was sampled`, q.samples > MIN_SAMPLES, q);
      ok(`cracks: Square root, parked half-way: no uncovered pixel along the cut's image at ${a0}°`, q.cracks === 0, q);
    }
  }
}
return { pass: fails.length === 0, fails, info };
