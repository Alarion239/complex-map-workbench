// The steps view's carried colour where two sheets meet along a cut: the seam is the cut's image, drawn per
// pixel, so it is as smooth as the cut's image and nothing is left uncovered along it.
//  - teeth: exp then log, coloured from z (T 0), Everywhere, parked half-way between w1 and w2. In a band 40 device px
//    wide from the colour's left edge, in the rows 10 CSS px or more from the top and bottom, a smooth seam changes colour between vertically adjacent pixels about once a row
//    (a seam of slope s px per row crosses |s| pixels of a row); a sawtooth along it, a torn triangle drawn whole on one
//    sheet, crosses it at every tooth's slanted edge. In the worst 20 rows the mean count of such jumps per row is at
//    most 1.5. A seam along the rows (20 px or more of the band jumping in one row: the cut's image on the real axis)
//    crosses its row along the whole band, however straight, so a frame whose worst rows hold such a row is read along
//    the seam instead: per column, the jumps between horizontally adjacent pixels in the 40 px band across it, the
//    worst 20 columns' mean, at most 1.5 too The same holds in every frame of the 2 s after a chain change (a step put first, the seam then between
//    w2 and w3), while the fill's programs link: the fill draws only with its mask, never a torn triangle whole
//  - cracks: z^2 then its square root and z^3 then its cube root, coloured from z, Everywhere, parked half-way between z
//    and w1, where the root's cut, carried into the picture, runs through the fill with a sheet on each side of it: along
//    the cut's image, no pixel of the paper's grey (max - min channel under 20) between two coloured ones (max - min
//    channel over 40) 3 px either side; a control draws a one-pixel line of paper along the cut's image and the same scan
//    must count it
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the images shard (ci/browser_shards.js).
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
    // (a jump: colour distance over JUMP between vertically adjacent pixels; the band is BAND px; the mean is over the
    // worst WORST rows; a row with LONG_RUN px or more jumping holds a seam along the rows)
    const JUMP = 60, BAND = 40, WORST = 20, LONG_RUN = 20;
    const c = document.getElementById('canvasL'), W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const at = (x, y) => (y * W + x) * 4, sat = (i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    const dist = (i, j) => Math.hypot(d[i] - d[j], d[i + 1] - d[j + 1], d[i + 2] - d[j + 2]);
    const per = [], m = Math.round(10 * W / c.clientWidth);
    for (let y = m; y < H - m - 1; y++) {
      let e = -1;
      for (let x = Math.floor(W * 0.2); x < Math.floor(W * 0.6); x++) if (sat(at(x, y)) > 40) { e = x; break; }
      if (e < 0) continue;
      let n = 0, run = 0, longest = 0;
      const xs = [];
      for (let x = e; x < Math.min(W, e + BAND); x++) {
        if (dist(at(x, y), at(x, y + 1)) > JUMP) { n++; longest = Math.max(longest, ++run); xs.push(x - e); } else run = 0;
      }
      per.push([y, n, longest, e, xs]);
    }
    // (rows within 10 CSS px of the top and bottom edge are left out: the frame's own edge crosses the band there, a
    // horizontal step that is not the seam)
    // (the worst 20 rows in a row: the teeth of a sawtooth stand where the torn triangles are, not along the whole seam)
    let worst = 0, worstY = -1;
    for (let i = 0; i + WORST <= per.length; i++) { let s = 0; for (let j = i; j < i + WORST; j++) s += per[j][1]; if (s / WORST > worst) { worst = s / WORST; worstY = per[i][0]; } }
    // (a seam along the rows crosses its row along the whole band, however straight, so there the same count is made
    // along the seam: per column, the jumps between horizontally adjacent pixels in the band across the seam, and the
    // worst columns' mean)
    let mode = 'rows', perCol = null, span = 0;
    const hr = per.filter((q) => q[0] >= worstY && q[0] < worstY + WORST && q[2] >= LONG_RUN).sort((a, b) => b[1] - a[1])[0];
    if (hr) {
      const yw = hr[0], x0 = hr[3], jumps = (x, y) => dist(at(x, y), at(x, y + 1)) > JUMP;
      let x1 = x0;
      while (x1 < W - 1 && [-2, -1, 0, 1, 2].some((k) => jumps(x1, yw + k))) x1++;
      span = x1 - x0;
      if (span >= LONG_RUN) {
        const cnt = [];
        for (let x = x0; x < x1; x++) { let n = 0; for (let y = yw - BAND / 2; y < yw + BAND / 2; y++) if (dist(at(x, y), at(x + 1, y)) > JUMP) n++; cnt.push(n); }
        let w = 0;
        for (let i = 0; i + WORST <= cnt.length; i++) { let t = 0; for (let j = i; j < i + WORST; j++) t += cnt[j]; w = Math.max(w, t / WORST); }
        mode = 'columns'; perCol = +w.toFixed(2);
      }
    }
    // (for the log: the rows of the worst window and the 20 rows with the most jumps as [y, jumps, longest run, left edge x,
    // the jumps' x offsets from the edge], and how many rows hold each jump count)
    const hist = {};
    for (const q of per) hist[q[1]] = (hist[q[1]] || 0) + 1;
    const rowsDump = { window: per.filter((q) => q[0] >= worstY && q[0] < worstY + WORST), top: per.slice().sort((a, b) => b[1] - a[1]).slice(0, WORST), hist };
    const g = __cmwSteps().glide || {};
    return { label: __cmwSteps().label, path: g.path, reason: g.reason, rows: per.length, perRow: mode === 'columns' ? perCol : +worst.toFixed(2), mode, rowsPerRow: +worst.toFixed(2), span, worstY, W, H, rowsDump };
  })()`;
  let keepSettled = null;
  // (the rows behind a reading go to info.teethRows[key], not into the check's own record)
  info.teethRows = {};
  const teeth = async (key) => { const t = await ev(TEETH); if (key) info.teethRows[key] = t.rowsDump; delete t.rowsDump; return t; };
  info.teeth = await teeth('parked');
  keepSettled = await ev(`document.getElementById('canvasL').toDataURL('image/png')`);
  // (the same frame without the cut fill: what the seam looks like where no torn triangle is drawn; for reference)
  await ev('GLR.carryProbes({ noFill: true }); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('without the fill: the frame is drawn', await drawn(), null);
  info.teethNoFill = await teeth('noFill');
  // (and with the fill drawn without its mask: the sawtooth; for reference)
  await ev('GLR.carryProbes({ noMask: true }); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('without the mask: the frame is drawn', await drawn(), null);
  info.teethNoMask = await teeth('noMask');
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
    window.__seamsWorst = null;
    { const t0 = performance.now(), tick = () => { const t = ${TEETH}; delete t.rowsDump; window.__seamsAfter.push(t);
        if (t.perRow != null && (!window.__seamsWorst || t.perRow > window.__seamsWorst.perRow)) window.__seamsWorst = { perRow: t.perRow, url: document.getElementById('canvasL').toDataURL('image/png') };
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else window.__seamsDone = true; };
      requestAnimationFrame(tick); } 1`);
  await settled({ max: 30000, panes: false, until: 'window.__seamsDone === true' });
  await ev(`__cmwSteps({ bare: false }); 1`);
  const after = (await ev('__seamsAfter.map((t) => ({ label: t.label, rows: t.rows, perRow: t.perRow }))')).filter((t) => t.rows > 0);
  info.afterChange = { frames: after.length, perRow: after.map((t) => t.perRow) };
  ok('teeth: frames were drawn in the 2 s after a chain change', after.length > 0, info.afterChange);
  // (the frames the numbers come from, kept as shots/steps_seams-*.png for a look: the settled seam and the worst frame of the window)
  const keep = (name, url) => { if (!url) return; fs.mkdirSync(DIR + '/shots', { recursive: true }); fs.writeFileSync(`${DIR}/shots/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); };
  keep('steps_seams-parked-w1w2', keepSettled);
  keep('steps_seams-window-worst', await ev('window.__seamsWorst && window.__seamsWorst.url'));
  const worst = after.reduce((w, t) => (t.perRow > w.perRow ? t : w), { perRow: 0 });
  ok('teeth: in the 2 s after a chain change, no frame shows a sawtooth along the seam (at most 1.5 colour jumps per row next to it, in its worst 20 rows)', worst.perRow <= 1.5, worst);
  // (and once settled, the seam is drawn: the colour reaches it in most rows)
  await settled({ max: 30000 }); await ev('__cmwHideStrokes(true), 1'); await settled({ max: 20000 });
  ok('after the chain change: the frame is drawn', await drawn(), null);
  info.afterSettled = await teeth('afterSettled');
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

// cracks: z^n then its n-th root
{
  // (each case: z^n then its n-th root, cut 180, coloured from z, Everywhere, parked half-way between z and w1. The z plane
  // covers the picture there more than once, so the root's cut, carried into the picture (its preimage under z^n, moved
  // half-way), runs through the fill with a sheet on each side of it)
  const CRACK_CASES = [{ name: 'Square root', n: 2 }, { name: 'Cube root', n: 3 }];
  // The cut's image is sampled every STEP device px from ORIGIN device px out from 0, and each sample's pixels within
  // HALF px across it are read; a pixel is a crack when its saturation (max - min channel) is under CRACK_SAT while the
  // pixels FLANK px to both sides of it, across the cut's image, are over FLANK_SAT. The fill lies on both sides of a
  // sample when the pixels HALF + FLANK px to both sides of it are over FLANK_SAT: TWO_SIDED of the samples at least, so
  // that the rule reads a gap between two sheets, never the edge of the fill. The control, a line of PAPER one device
  // pixel wide drawn along the cut's image, is counted at CAUGHT of the samples at least
  const STEP = 0.5, ORIGIN = 30, HALF = 4, FLANK = 3, CRACK_SAT = 20, FLANK_SAT = 40, MIN_SAMPLES = 500, TWO_SIDED = 0.95, CAUGHT = 0.9;
  const PAPER = [236, 240, 242, 255];
  // (the scan of the frame along the cut's image, window.__seamsCut's tracks of plane points; paper: draw the control first)
  const SCAN = (paper) => `(() => {
    const STEP = ${STEP}, ORIGIN = ${ORIGIN}, HALF = ${HALF}, FLANK = ${FLANK}, CRACK_SAT = ${CRACK_SAT}, FLANK_SAT = ${FLANK_SAT}, PAPER = ${JSON.stringify(paper)};
    const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, W = c.width, H = c.height, g = c.getContext('2d');
    const dev = (w) => { const p = __cmwW2S('L', w[0], w[1]); return [(p[0] - r.left) * k, (p[1] - r.top) * k]; };
    const o = dev([0, 0]), edge = HALF + FLANK + 1;
    // ([point, unit normal] along each track, in the canvas and ORIGIN px or more from 0)
    const samples = [];
    for (const t of window.__seamsCut) {
      const P = t.map(dev);
      for (let i = 0; i + 1 < P.length; i++) {
        const a = P[i], b = P[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (!(len > 0)) continue;
        const n = [(a[1] - b[1]) / len, (b[0] - a[0]) / len];
        for (let s = 0; s < len; s += STEP) {
          const p = [a[0] + (b[0] - a[0]) * s / len, a[1] + (b[1] - a[1]) * s / len];
          if (p[0] >= edge && p[1] >= edge && p[0] < W - edge && p[1] < H - edge && Math.hypot(p[0] - o[0], p[1] - o[1]) >= ORIGIN) samples.push([p, n]);
        }
      }
    }
    if (PAPER) { const im = g.createImageData(1, 1); im.data.set(PAPER); for (const [p] of samples) g.putImageData(im, Math.round(p[0]), Math.round(p[1])); }
    const d = g.getImageData(0, 0, W, H).data;
    const sat = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); };
    const at = (p, n, t) => [p[0] + t * n[0], p[1] + t * n[1]];
    let twoSided = 0, cracks = 0, first = null;
    for (const [p, n] of samples) {
      if (sat(...at(p, n, -HALF - FLANK)) > FLANK_SAT && sat(...at(p, n, HALF + FLANK)) > FLANK_SAT) twoSided++;
      for (let t = -HALF; t <= HALF; t++) {
        const q = at(p, n, t);
        if (sat(...q) < CRACK_SAT && sat(...at(q, n, -FLANK)) > FLANK_SAT && sat(...at(q, n, FLANK)) > FLANK_SAT) { cracks++; if (!first) first = q.map(Math.round); break; }
      }
    }
    return { label: __cmwSteps().label, samples: samples.length, twoSided, cracks, first };
  })()`;
  for (const kase of CRACK_CASES) {
    const ns = 'seamc' + kase.n + Date.now();
    await seed(ns, { steps: [{ id: 'f1', type: 'pown', params: { n: kase.n } }, { id: 'f2', type: 'root', params: { n: kase.n, cut: 180, k: 0 } }], shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.6, ci: 1, visible: true }], focus: 2 });
    await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
    await ready();
    await ev('__cmwSteps({ T: 0 }); 1'); await settled({ max: 20000 });
    await park(0.5, 'all');
    // (the cut's image as the strokes draw it, read with them shown; then the frame without them, whose colour is read)
    await ev('__cmwHideStrokes(false), 1'); await settled({ max: 20000 }); await drawn();
    const tracks = await ev(`(window.__seamsCut = __cmwCutCurves().filter((cut) => cut.step === 2).flatMap((cut) => (cut.w.length && Array.isArray(cut.w[0][0]) ? cut.w : [cut.w])).filter((t) => t.length > 1)).length`);
    ok(`cracks: ${kase.name}: the cut's image is drawn`, tracks > 0, tracks);
    await ev('__cmwHideStrokes(true), 1'); await settled({ max: 20000 });
    ok(`cracks: ${kase.name}: the frame without the strokes is drawn`, await drawn(), null);
    // (the cut's image curve, a red line with a paper-coloured halo, is a stroke: with the strokes hidden the frame draws
    // none, so its halo is not a grey pixel between coloured ones; the same at any device pixel ratio)
    const cutCurves = await ev('__cmwCutCurves().length');
    ok(`cracks: ${kase.name}, strokes hidden: no cut curve is drawn`, cutCurves === 0, cutCurves);
    const got = info['cracks' + kase.n] = await ev(SCAN(null));
    ok(`cracks: ${kase.name}, parked half-way: the cut's image was sampled`, got.samples > MIN_SAMPLES, got);
    ok(`cracks: ${kase.name}, parked half-way: the fill lies on both sides of the cut's image`, got.twoSided >= TWO_SIDED * got.samples, got);
    ok(`cracks: ${kase.name}, parked half-way: no uncovered pixel along the cut's image`, got.cracks === 0, got);
    // the control: the same scan counts a crack drawn along the cut's image
    const control = info['cracksControl' + kase.n] = await ev(SCAN(PAPER));
    ok(`cracks (control): ${kase.name}: a one-pixel line of paper along the cut's image is counted`, control.cracks >= CAUGHT * control.samples && control.samples > MIN_SAMPLES, control);
  }
}
return { pass: fails.length === 0, fails, info };
