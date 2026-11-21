// #845: the carried colour of the whole plane has no sawtooth bands below full opacity. exp(sin z) typed, colour plane z,
// plane w1 at rest. The exact pass refuses the whole plane there ('unbounded range outside the innermost family'), so the
// carried meshes draw it. They cover clipWin and the ring, not every point behind the front one, so a layer behind would
// end where they end, along their triangles' edges, and show through the front layer at the slider's 85 % as sawtooth
// bands of whole triangles. So the whole plane's meshes draw the front layer alone (svCarryRegions), and a region's own
// meshes, which cover all of the region, draw every layer.
// - Everywhere at 85 %, dpr 2, the colour layer alone (bare): no straight step run of 10 px or more (ux's line on #845:
//   no straight run of 10 px or more along which the colour steps by 6 levels or more);
// - control: that frame is the carried meshes' (the rest record's path is 'mesh'), drawn from the whole plane's SphereMesh
//   once its job has landed, and it is the carried colour (it covers the pane, mostly saturated, in many colours);
// - Everywhere at 85 %: a frame drawn again at rest draws no layered frame (GLR.carryLayerFrames);
// - control: the meshes of a region below full opacity still draw their layers (the disc forced forward, Inside regions,
//   85 %: a frame drawn again draws a layered frame).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const BASE = `http://localhost:${PORT}`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
const ns = 'svbands' + Date.now();
await seed(ns, { v3: true, v4: true, shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 0.9, ci: 0, visible: true }],
  steps: [{ type: 'custom', params: { expr: 'exp(sin(z))', cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'image' });
await go(`${BASE}/test.html?ns=${ns}&lang=en&view=steps`);
await settled({ max: 120000, until: "typeof __cmwSteps === 'function' && !!window.GLR && __cmwSteps().ready.ready" });
// the frame at rest, settled: its programs linked, its fix-up done and no SphereMesh job left (none running, wanted or
// due to be asked for); sv: the whole plane's SphereMesh of the steps view (its key's role SV) is built. Then the frame
// that job's landing asked for is drawn (settled)
const SM_IDLE = (sv) => `(() => { const s = __cmwSphere(); return !s.running && !s.kick && s.jobs.length === 0 && s.want.length === 0${sv ? ' && s.entries.some((e) => /\\|SV\\|/.test(e.key) && e.gpu)' : ''}; })()`;
const still = async (sv) => {
  const w = await settled({ max: 120000, until: `__cmwSteps().ready.ready && GLR.pendingLinks === 0 && __cmwSvFixed() && ${SM_IDLE(sv)}` });
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
  return w;
};
// a frame drawn again at rest, as a still frame: the rest record (__cmwSteps().rest, a new object for each such frame) is
// marked first, so a record without the mark is a frame drawn since. -> whether one was drawn, and the layered frames it drew
const redraw = async () => {
  const f0 = await ev('GLR.carryLayerFrames()');
  const fresh = '(() => { const r = __cmwSteps().rest; return !!r && !r.__mark; })()';
  await ev('(() => { const r = __cmwSteps().rest; if (r) r.__mark = 1; __cmwSteps({ bare: true }); return 1; })()');
  await settled({ max: 60000, until: `__cmwSteps().ready.ready && ${fresh}` });
  const drawn = await ev(fresh), f1 = await ev('GLR.carryLayerFrames()');
  return { drawn, layered: f1 - f0 };
};
// the left pane's straight step runs: a pixel steps where the second difference of a channel across it, along one of four
// directions, is 6 levels or more; a run is an 8-connected set of such pixels whose length (its principal axis) is 10 px
// or more and whose width is 2.5 px or less. The paper (TH.plane) is left out. Also the pixels off the paper (covered),
// the share of saturated ones (channels 32 or more apart) and the colours (4 bits a channel) the frame holds
const RUNS = `(() => {
  const c = document.getElementById('canvasL'), W = c.width, H = c.height, p = c.getContext('2d').getImageData(0, 0, W, H).data;
  const g = document.createElement('canvas').getContext('2d'); g.fillStyle = (typeof TH !== 'undefined' && TH.plane) || '#ffffff'; g.fillRect(0, 0, 1, 1); const pp = g.getImageData(0, 0, 1, 1).data;
  const on = new Uint8Array(W * H), s = new Uint8Array(W * H), seen = new Uint8Array(W * H), dirs = [1, W, W + 1, W - 1], hues = new Set();
  let sat = 0;
  for (let i = 0; i < W * H; i++) {
    const r = p[4 * i], gg = p[4 * i + 1], b = p[4 * i + 2];
    on[i] = Math.max(Math.abs(r - pp[0]), Math.abs(gg - pp[1]), Math.abs(b - pp[2])) > 10 ? 1 : 0;
    if (Math.max(r, gg, b) - Math.min(r, gg, b) >= 32) sat++;
    hues.add((r >> 4) * 256 + (gg >> 4) * 16 + (b >> 4));
  }
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x; if (!on[i]) continue;
    for (const n of dirs) {
      if (!on[i - n] || !on[i + n]) continue;
      let v = 0; for (let k = 0; k < 3; k++) v = Math.max(v, Math.abs(p[4 * (i + n) + k] - 2 * p[4 * i + k] + p[4 * (i - n) + k]));
      if (v >= 6) { s[i] = 1; break; }
    }
  }
  const out = [], st = [];
  for (let i0 = 0; i0 < W * H; i0++) {
    if (!s[i0] || seen[i0]) continue;
    let k = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0; st.push(i0); seen[i0] = 1;
    while (st.length) {
      const i = st.pop(), x = i % W, y = (i - x) / W; k++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const j = yy * W + xx; if (s[j] && !seen[j]) { seen[j] = 1; st.push(j); } }
    }
    if (k < 10) continue;
    const mx = sx / k, my = sy / k, a = sxx / k - mx * mx, b = syy / k - my * my, cc = sxy / k - mx * my, dt = Math.sqrt(Math.max(0, (a - b) * (a - b) / 4 + cc * cc));
    const L = Math.sqrt(12 * ((a + b) / 2 + dt)), Wd = Math.sqrt(12 * Math.max(0, (a + b) / 2 - dt));
    if (L >= 10 && Wd <= 2.5) out.push({ L: +L.toFixed(1), x: Math.round(mx), y: Math.round(my) });
  }
  out.sort((u, v) => v.L - u.L);
  return { W, H, covered: on.reduce((m, v) => m + v, 0), sat: +(sat / (W * H)).toFixed(3), colours: hues.size, n: out.length, longest: out.length ? out[0].L : 0, top: out.slice(0, 5) };
})()`;
// Everywhere at the slider's 85 %
await ev("(__cmwSteps({ bare: true, T: 0, scope: 'all' }), __cmwSteps({ go: 1, now: true }), 1)");
info.everywhereWait = await still(true);
const again = await redraw();
const all = await ev(RUNS), rest = await ev('__cmwSteps().rest');
info.everywhere = { runs: all, rest, again };
ok('Everywhere at 85 %: the frame at rest is the carried meshes\' (the exact pass refuses the whole plane)', !!rest && rest.a === 1 && rest.path === 'mesh', rest);
ok('Everywhere at 85 %: the frame is the carried colour (it covers the pane, mostly saturated, in many colours)', !!all && all.covered > 0.95 * all.W * all.H && all.sat > 0.5 && all.colours >= 64,
  all && { covered: all.covered, of: all.W * all.H, sat: all.sat, colours: all.colours });
ok('Everywhere at 85 %: no straight step run of 10 px or more (no sawtooth bands)', !!all && all.n === 0, all && { n: all.n, longest: all.longest, top: all.top });
ok('Everywhere at 85 %: a frame drawn again at rest draws no layered frame (the meshes draw the front layer alone)', again.drawn && again.layered === 0, again);
// Inside regions, the disc on the meshes: its layers still drawn below full opacity
await ev("(__cmwForceForward(['s1']), __cmwSteps({ scope: 'in' }), 1)");
info.insideWait = await still(false);
const againIn = await redraw(), restIn = await ev('__cmwSteps().rest');
info.inside = { rest: restIn, again: againIn };
ok('Inside regions at 85 %, the disc forced forward: the frame is the carried meshes\'', !!restIn && restIn.path === 'mesh', restIn);
ok('Inside regions at 85 %, the disc forced forward: a frame drawn again draws a layered frame', againIn.drawn && againIn.layered > 0, againIn);
const L = logs().filter((l) => l.t === 'EXC');
ok('no page exceptions', L.length === 0, L.slice(0, 3));
return { pass: fails.length === 0, fails, info };
