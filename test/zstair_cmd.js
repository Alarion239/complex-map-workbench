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


{
  const shapes = [{ id: 's1', kind: 'disc', c: [0, 0], r: 2, ci: 0, visible: true }, { id: 's2', kind: 'rect', a: [-1.5, -1.2], b: [1.2, 1.4], ci: 1, visible: true }];
  const ns = 'stair' + Date.now();
  await seed(ns, { steps: [{ id: 'f0', type: 'mul', params: { c: '1' } }, { id: 'f1', type: 'exp', params: {} }, { id: 'f2', type: 'log', params: { cut: 180, k: 0 } }], shapes, focus: 3 });
  await go(`http://localhost:${PORT}/test.html?view=steps&ns=${ns}`);
  await ready();
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
      for (let x = e; x < Math.min(W, e + BAND); x++) {
        if (dist(at(x, y), at(x, y + 1)) > JUMP) { n++; longest = Math.max(longest, ++run); } else run = 0;
      }
      per.push([y, n, longest, e]);
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
    const g = __cmwSteps().glide || {};
    return { label: __cmwSteps().label, path: g.path, reason: g.reason, rows: per.length, perRow: mode === 'columns' ? perCol : +worst.toFixed(2), mode, rowsPerRow: +worst.toFixed(2), span, worstY, W, H };
  })()`;
  await ev('__cmwSteps({ T: 0 }); 1'); await settled({ max: 20000 });
  for (const bare of [false, true]) {
    await ev(`__cmwSet('lines', false); __cmwSet('morphPaths', false); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', go: 0, now: true }); __cmwSteps({ scope: 'all', surf: 'plane', park: 2, bare: ${bare} }); 1`);
    await settled({ max: 30000 }); await drawn(); await settled({ max: 20000 });
    const t = await ev(TEETH);
    info['bare=' + bare] = t && { rowsPerRow: t.rowsPerRow, perRow: t.perRow, mode: t.mode, rows: t.rows, label: t.label };
  }
}
return { pass: true, fails, info };
