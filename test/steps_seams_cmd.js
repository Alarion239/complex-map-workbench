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
    // (inject: a fill crack, a paper-grey line INJECT_PX wide, INJECT_OFF px beside the 135° ray, drawn into the frame before it is read)
    const INJECT_PX = 2, INJECT_OFF = 4;
    const scan = (inject) => ev(`(() => {
      if (${inject}) {
        const c0 = document.getElementById('canvasL'), r0 = c0.getBoundingClientRect(), k0 = c0.width / r0.width, o0 = __cmwW2S('L', 0, 0), O0 = [(o0[0] - r0.left) * k0, (o0[1] - r0.top) * k0];
        const A0 = 135 * Math.PI / 180, u0 = [Math.cos(A0), -Math.sin(A0)], n0 = [-u0[1], u0[0]], g0 = c0.getContext('2d');
        g0.save(); g0.setTransform(1, 0, 0, 1, 0, 0); g0.strokeStyle = 'rgb(236,240,242)'; g0.lineWidth = ${INJECT_PX}; g0.beginPath();
        g0.moveTo(O0[0] + 100 * u0[0] + ${INJECT_OFF} * n0[0], O0[1] + 100 * u0[1] + ${INJECT_OFF} * n0[1]);
        g0.lineTo(O0[0] + 260 * u0[0] + ${INJECT_OFF} * n0[0], O0[1] + 260 * u0[1] + ${INJECT_OFF} * n0[1]); g0.stroke(); g0.restore();
      }
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
    info.cracks = await scan(false);
    // (the cut's image curve, a red line with a paper-coloured halo, is drawn with the strokes hidden as the parked plane draws its cut, which
    // hiding the shapes' strokes leaves alone: the frame's cut curves are those it draws with the strokes shown, the same count and the same banks;
    // the crack scan above counts a grey pixel between coloured ones, which the halo is not, at any device pixel ratio)
    const cutKey = () => ev('JSON.stringify(__cmwCutCurves().map((c) => ({ step: c.step, solid: c.solid, w: c.w })))');
    const hiddenCuts = await cutKey();
    await ev('__cmwHideStrokes(false); 1'); await settled({ max: 20000 });
    const shownCuts = await cutKey();
    await ev('__cmwHideStrokes(true); 1'); await settled({ max: 20000 });
    info.cutCurves = JSON.parse(hiddenCuts).length;
    info.cutCurvesShown = JSON.parse(shownCuts).length;
    ok('cracks: Square root, parked half-way, strokes hidden: the cut curves drawn are those drawn with the strokes shown (the same banks)', hiddenCuts === shownCuts, { hidden: info.cutCurves, shown: info.cutCurvesShown });
    ok('cracks: the reference draws a cut (a frame that drops the cut must differ from it)', info.cutCurvesShown > 0 && JSON.stringify([]) !== shownCuts, { shown: info.cutCurvesShown });
    for (const a0 of ['135', '225']) {
      const q = info.cracks.out[a0];
      ok(`cracks: Square root, parked half-way, the ray at ${a0}° was sampled`, q.samples > MIN_SAMPLES, q);
      ok(`cracks: Square root, parked half-way: no uncovered pixel along the cut's image at ${a0}°`, q.cracks === 0, q);
    }
    // the control: the scan still counts a real crack beside the cut's image (the 135° ray; the 225° ray has none)
    info.control = await scan(true);
    ok('cracks: a fill crack injected beside the cut\'s image at 135° is counted', info.control.out['135'].cracks > 0, info.control.out['135']);
    ok('cracks: the other ray, with no crack injected, still reads none', info.control.out['225'].cracks === 0, info.control.out['225']);
  }
}
return { pass: fails.length === 0, fails, info };
