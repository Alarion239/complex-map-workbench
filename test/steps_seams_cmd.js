// The steps view's carried colour where two sheets meet along a cut: the seam is the cut's image, drawn per
// pixel, so it is as smooth as the cut's image.
//  - teeth: exp then log, coloured from z (T 0), Everywhere, parked half-way between w1 and w2. In a band 40 device px
//    wide from the colour's left edge, a smooth seam changes colour between vertically adjacent pixels about once a row
//    (a seam of slope s px per row crosses |s| pixels of a row); a sawtooth along it, a torn triangle drawn whole on one
//    sheet, crosses it at every tooth's slanted edge. In the worst 20 rows the mean count of such jumps per row is at
//    most 1.5
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
// parked at x with the scope given, the region lines and the strokes off (they cross the seam), the frame drawn
const park = async (x, scope) => {
  await ev(`__cmwSet('lines', false); __cmwHideStrokes(true); 1`);
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
  // (the fill draws seams pixel for pixel with its own-option program, started after the steps view's warm draw:
  // that program made, then a frame drawn with it)
  await settled({ max: 30000, until: 'GLR.chainProgs().includes("regionKSCpto")' });
  await ev('__cmwHideStrokes(true), 1'); await settled({ max: 20000 });
  ok('teeth: the frame is drawn with the fill\'s own-option program', await drawn(), null);
  const teeth = () => ev(`(() => {
    const c = document.getElementById('canvasL'), W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const at = (x, y) => (y * W + x) * 4, sat = (i) => Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    const dist = (i, j) => Math.hypot(d[i] - d[j], d[i + 1] - d[j + 1], d[i + 2] - d[j + 2]);
    const per = [];
    for (let y = 10; y < H - 11; y++) {
      let e = -1;
      for (let x = Math.floor(W * 0.2); x < Math.floor(W * 0.6); x++) if (sat(at(x, y)) > 40) { e = x; break; }
      if (e < 0) continue;
      let n = 0;
      for (let x = e; x < Math.min(W, e + 40); x++) if (dist(at(x, y), at(x, y + 1)) > 60) n++;
      per.push([y, n]);
    }
    // (the worst 20 rows in a row: the teeth of a sawtooth stand where the torn triangles are, not along the whole seam)
    let worst = 0, worstY = -1;
    for (let i = 0; i + 20 <= per.length; i++) { let s = 0; for (let j = i; j < i + 20; j++) s += per[j][1]; if (s / 20 > worst) { worst = s / 20; worstY = per[i][0]; } }
    const g = __cmwSteps().glide || {};
    return { label: __cmwSteps().label, path: g.path, reason: g.reason, rows: per.length, perRow: +worst.toFixed(2), worstY, W, H };
  })()`);
  info.teeth = await teeth();
  // (the same frame without the cut fill: what the seam looks like where no torn triangle is drawn; for reference)
  await ev('GLR.carryProbes({ noFill: true }); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('without the fill: the frame is drawn', await drawn(), null);
  info.teethNoFill = await teeth();
  await ev('GLR.carryProbes({}); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('teeth: the colour has a left edge in most rows', info.teeth.rows > info.teeth.H * 0.8, info.teeth);
  ok('teeth: exp then log, parked between w1 and w2: the seam along the cut is smooth (at most 1.5 colour jumps per row next to it, in its worst 20 rows)', info.teeth.perRow != null && info.teeth.perRow <= 1.5, info.teeth);
}

return { pass: fails.length === 0, fails, info };
