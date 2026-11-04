// The steps view's carried colour where two sheets meet along a cut: the seam is the cut's image, drawn per
// pixel, so it is as smooth as the cut's image and nothing is left uncovered along it.
//  - teeth: exp then log, coloured from z (T 0), Everywhere, parked half-way between w1 and w2. In a band 40 device px
//    wide from the colour's left edge, a smooth seam changes colour between vertically adjacent pixels about once a row
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
  // (the fill draws through its mask, started with it: that program made, then a frame drawn with it)
  await settled({ max: 30000, until: 'GLR.chainProgs().includes("regionKSCptm")' });
  await ev('__cmwHideStrokes(true), 1'); await settled({ max: 20000 });
  ok('teeth: the frame is drawn with the fill\'s mask', await drawn(), null);
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
  // (and with the fill drawn without its mask: the sawtooth; for reference)
  await ev('GLR.carryProbes({ noMask: true }); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('without the mask: the frame is drawn', await drawn(), null);
  info.teethNoMask = await teeth();
  await ev('GLR.carryProbes({}); __cmwHideStrokes(true); 1'); await settled({ max: 20000 });
  ok('teeth: the colour has a left edge in most rows', info.teeth.rows > info.teeth.H * 0.8, info.teeth);
  ok('teeth: exp then log, parked between w1 and w2: the seam along the cut is smooth (at most 1.5 colour jumps per row next to it, in its worst 20 rows)', info.teeth.perRow != null && info.teeth.perRow <= 1.5, info.teeth);
  // (the first frames after a chain change: a step put first, the same seam now between w2 and w3, parked there at
  // once; 8 frames over 2 s, while the new chain's programs link)
  await ev(`__cmwAddStep('mul', { c: '1' }, 0), 1`);
  await settled({ max: 20000, panes: false, until: '__cmwSteps().planes.length === 4' });
  await ev(`__cmwSteps({ T: 0 }); __cmwHideStrokes(true); __cmwSteps({ scope: 'all', surf: 'plane', park: 2.5 }); 1`);
  const after = [];
  for (let i = 0; i < 8; i++) { await sleep(250); after.push(await teeth()); }
  info.afterChange = after.map((t) => [t.label, t.rows, t.perRow]);
  const worst = after.reduce((w, t) => (t.perRow > w.perRow ? t : w), after[0]);
  ok('teeth: in the 2 s after a chain change, no frame shows a sawtooth along the seam (at most 1.5 colour jumps per row next to it, in its worst 20 rows)', worst.perRow <= 1.5, worst);
  // (and once settled, the seam is drawn: the colour reaches it in most rows)
  await settled({ max: 30000 }); await ev('__cmwHideStrokes(true), 1'); await settled({ max: 20000 });
  ok('after the chain change: the frame is drawn', await drawn(), null);
  info.afterSettled = await teeth();
  ok('after the chain change: the colour has a left edge in most rows, and the seam is smooth', info.afterSettled.rows > info.afterSettled.H * 0.8 && info.afterSettled.perRow <= 1.5, info.afterSettled);
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
    info.cracks = await ev(`(() => {
      const c = document.getElementById('canvasL'), r = c.getBoundingClientRect(), k = c.width / r.width, W = c.width, H = c.height;
      const d = c.getContext('2d').getImageData(0, 0, W, H).data, o = __cmwW2S('L', 0, 0), O = [(o[0] - r.left) * k, (o[1] - r.top) * k];
      const sat = (x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return -1; const i = (y * W + x) * 4; return Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]); };
      const out = {};
      for (const a0 of [135, 225]) {
        const A = a0 * Math.PI / 180, u = [Math.cos(A), -Math.sin(A)], n = [-u[1], u[0]];
        let samples = 0, cracks = 0, first = null;
        for (let rr = 30; rr < Math.min(W, H) * 0.45; rr++) for (let t = -4; t <= 4; t++) {
          const p = [O[0] + rr * u[0] + t * n[0], O[1] + rr * u[1] + t * n[1]], s = sat(...p);
          if (s < 0) continue;
          samples++;
          if (s < 20 && sat(p[0] - 3 * n[0], p[1] - 3 * n[1]) > 40 && sat(p[0] + 3 * n[0], p[1] + 3 * n[1]) > 40) { cracks++; if (!first) first = [Math.round(p[0]), Math.round(p[1])]; }
        }
        out[a0] = { samples, cracks, first };
      }
      const g = __cmwSteps().glide || {};
      return { label: __cmwSteps().label, path: g.path, reason: g.reason, O: O.map(Math.round), out };
    })()`);
    for (const a0 of ['135', '225']) {
      const q = info.cracks.out[a0];
      ok(`cracks: Square root, parked half-way, the ray at ${a0}° was sampled`, q.samples > 500, q);
      ok(`cracks: Square root, parked half-way: no uncovered pixel along the cut's image at ${a0}°`, q.cracks === 0, q);
    }
  }
}
return { pass: fails.length === 0, fails, info };
