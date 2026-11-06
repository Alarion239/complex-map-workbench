// The steps view's carried colour where two sheets meet along a cut: the seam is the cut's image, drawn per
// pixel, so it is as smooth as the cut's image and nothing is left uncovered along it.
//  - teeth: exp then log, coloured from z (T 0), Everywhere, parked half-way between w1 and w2. In a band 40 device px
//    wide from the colour's left edge, in the rows 10 CSS px or more from the top and bottom, a smooth seam changes colour between vertically adjacent pixels about once a row
//    (a seam of slope s px per row crosses |s| pixels of a row); a sawtooth along it, a torn triangle drawn whole on one
//    sheet, crosses it at every tooth's slanted edge. In the worst 20 rows the mean count of such jumps per row is at
//    most 1.5. The same holds in every frame of the 2 s after a chain change (a step put first, the seam then between
//    w2 and w3), while the fill's programs link: the fill draws only with its mask, never a torn triangle whole
//  - cracks: exp then log of a tall rectangle, Everywhere, parked half-way between w1 and w2, where the cut's image runs
//    through the fill: in the colour layer alone, no pixel of the paper's grey (max - min channel under 20) between two
//    coloured ones (max - min channel over 40) 3 px either side along a row, a column or a diagonal; a control puts a
//    one-pixel gap of paper into the fill and the same scan must count it
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
  // the new chain's programs link; a frame with no colour edge yet has no rows and does not count)
  await ev(`__cmwAddStep('mul', { c: '1' }, 0), 1`);
  await settled({ max: 20000, panes: false, until: '__cmwSteps().planes.length === 4' });
  await ev(`__cmwSteps({ T: 0 }); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', park: 2.5 });
    window.__seamsAfter = []; window.__seamsDone = false;
    { const t0 = performance.now(), tick = () => { window.__seamsAfter.push(${TEETH});
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else window.__seamsDone = true; };
      requestAnimationFrame(tick); } 1`);
  await settled({ max: 30000, panes: false, until: 'window.__seamsDone === true' });
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
}

// cracks: Everywhere, parked half-way between w1 and w2, where the second step's cut passes through the middle of the fill
// (the sheets of the first step overlap there), so the fill lies on both sides of the cut's image. The colour layer alone is read
// (the cut curves' casing would cover a crack). Cases: the square root of a squared disc (the disc covers
// the plane's disc twice), the logarithm of the exponential of a rectangle taller than one turn of its strip.
for (const kase of [
  { name: 'Square root', steps: [{ id: 'f1', type: 'pown', params: { n: 2 } }, { id: 'f2', type: 'root', params: { n: 2, cut: 180, k: 0 } }], shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.6, ci: 1, visible: true }] },
  { name: 'Logarithm', steps: [{ id: 'f1', type: 'exp', params: {} }, { id: 'f2', type: 'log', params: { cut: 180, k: 0 } }], shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -4.5], b: [1.2, 4.5], ci: 1, visible: true }] },
]) {
  const ns = 'seamc' + Date.now();
  await seed(ns, { steps: kase.steps, shapes: kase.shapes, focus: 2 });
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
  await ready();
  await ev('__cmwSteps({ T: 0 }); 1'); await settled({ max: 20000 });
  await park(1.5, 'all');
  await settled({ max: 30000, until: 'GLR.chainProgs().includes("regionKSCptm")' });
  await ev('__cmwSteps({ bare: true }); 1'); await settled({ max: 20000 });
  ok(`cracks: ${kase.name}: the colour layer alone is drawn`, await drawn(), null);
  // A pixel is a crack when its saturation (max - min channel) is under CRACK_SAT while the pixels FLANK px to both sides of it,
  // along a row, a column or a diagonal, are above FLANK_SAT; the pixels within ZERO px of the origin are left out (the colour of
  // a zero is white by design). filled is the share of pixels over FLANK_SAT: the scan reads fill.
  const CRACK_SAT = 20, FLANK_SAT = 40, FLANK = 3, MIN_FILLED = 0.3, GAP = 200, ZERO = 2 * FLANK;
  const SCAN = `(() => {
    const CRACK_SAT = ${CRACK_SAT}, FLANK_SAT = ${FLANK_SAT}, FLANK = ${FLANK}, ZERO = ${ZERO};
    const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const o = __cmwW2S('L', 0, 0), ox = (o[0] - r.left) * k, oy = (o[1] - r.top) * k;
    const sat = (x, y) => { const i = (y * W + x) * 4; return Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); };
    let cracks = 0, filled = 0, first = null;
    for (let y = FLANK; y < H - FLANK; y++) for (let x = FLANK; x < W - FLANK; x++) {
      if (sat(x, y) >= CRACK_SAT) { if (sat(x, y) > FLANK_SAT) filled++; continue; }
      if (Math.hypot(x - ox, y - oy) < ZERO) continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) if (sat(x - FLANK * dx, y - FLANK * dy) > FLANK_SAT && sat(x + FLANK * dx, y + FLANK * dy) > FLANK_SAT) { cracks++; if (!first) first = [x, y]; break; }
    }
    return { W, H, cracks, filled: filled / (W * H), first };
  })()`;
  const got = info['cracks' + kase.name] = await ev(SCAN);
  ok(`cracks: ${kase.name}: the colour layer is mostly fill`, got.filled > MIN_FILLED, got);
  ok(`cracks: ${kase.name}, parked half-way: no uncovered pixel in the fill along the cut's image`, got.cracks === 0, got);
  // The control: a one-device-pixel line of paper put into the fill, vertical and diagonal, must be counted GAP times each.
  const paper = await ev('(() => { const c = document.getElementById("canvasL"); return Array.from(c.getContext("2d").getImageData(2, 2, 1, 1).data); })()');
  for (const [name, slope] of [['vertical', 0], ['diagonal', 1]]) {
    await ev(`(() => {
      const c = document.getElementById('canvasL'), ctx = c.getContext('2d'), W = c.width, H = c.height, im = ctx.createImageData(1, 1);
      im.data.set(${JSON.stringify(paper)});
      for (let i = 0; i < ${GAP}; i++) ctx.putImageData(im, Math.round(W * 0.7) + i * ${slope}, Math.round(H * 0.3) + i);
      return 1; })()`);
    const gap = await ev(SCAN);
    info['cracks' + kase.name + name] = gap;
    ok(`cracks (control): ${kase.name}: a one-pixel ${name} gap of paper in the fill counts at least ${GAP} cracks`, gap.cracks >= GAP, gap);
    await ev('__cmwSteps({ bare: true }); 1'); await settled({ max: 20000 }); await drawn();
  }
  await ev('__cmwSteps({ bare: false }); 1');
}
return { pass: fails.length === 0, fails, info };
