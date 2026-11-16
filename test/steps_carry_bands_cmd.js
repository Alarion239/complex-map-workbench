// #845: the carried colour under Everywhere has no sawtooth bands below full opacity. exp(sin z) typed, colour plane z,
// plane w1 at rest (the exact pass refuses the whole plane there: 'unbounded range outside the innermost family', so the
// carried meshes draw it). Below full opacity the meshes drew every covering layer, and a layer behind the front one
// ended where the meshes end (they cover clipWin and the ring, not every point behind), along their triangles' edges:
// through the front layer at the slider's 85 % those ends showed as sawtooth bands of whole triangles (#845 part 2).
// - Everywhere at 85 %: the colour layer (bare) has no straight step run of 10 px or more (ux's line on #845: no straight
//   run of 10 px or more along which the colour steps by 6 levels or more), at dpr 2;
// - control: that frame is the carried meshes' (the rest record's path is 'mesh'), and Everywhere at 85 % draws no
//   layered frame (GLR.carryLayerFrames);
// - control: the meshes of a region below full opacity still draw their layers (the disc forced forward, Inside regions,
//   85 %: layered frames drawn).
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
// the frame at rest, settled: its programs linked and its meshes built (a SphereMesh's job lands after the first frames)
const still = async () => {
  await settled({ max: 120000, until: `__cmwSteps().ready.ready && GLR.pendingLinks === 0 && __cmwSvFixed() && (() => { const g = __cmwPaneStatus('L'); return !!g && !g.pending && !g.compiling; })()` });
  await sleep(1500);
  await settled({ max: 60000, until: '__cmwSteps().ready.ready' });
};
// the left pane's straight step runs: a pixel steps where the second difference of a channel across it, along one of four
// directions, is 6 levels or more; a run is an 8-connected set of such pixels whose length (its principal axis) is 10 px
// or more and whose width is 2.5 px or less. The paper (TH.plane) is left out
const RUNS = `(() => {
  const c = document.getElementById('canvasL'), W = c.width, H = c.height, p = c.getContext('2d').getImageData(0, 0, W, H).data;
  const g = document.createElement("canvas").getContext("2d"); g.fillStyle = (typeof TH !== "undefined" && TH.plane) || "#ffffff"; g.fillRect(0, 0, 1, 1); const pp = g.getImageData(0, 0, 1, 1).data;
  const on = new Uint8Array(W * H), s = new Uint8Array(W * H), seen = new Uint8Array(W * H), dirs = [1, W, W + 1, W - 1];
  for (let i = 0; i < W * H; i++) on[i] = Math.max(Math.abs(p[4 * i] - pp[0]), Math.abs(p[4 * i + 1] - pp[1]), Math.abs(p[4 * i + 2] - pp[2])) > 10 ? 1 : 0;
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
  return { W, H, covered: on.reduce((m, v) => m + v, 0), n: out.length, longest: out.length ? out[0].L : 0, top: out.slice(0, 5) };
})()`;
// Everywhere at the slider's 85 %
await ev("(__cmwSteps({ bare: true, T: 0, scope: 'all' }), __cmwSteps({ go: 1, now: true }), 1)");
await still();
const f0 = await ev('GLR.carryLayerFrames()');
await ev('(__cmwSteps({ bare: true }), 1)');
await still();
const f1 = await ev('GLR.carryLayerFrames()');
const all = await ev(RUNS), rest = await ev('__cmwSteps().rest');
info.everywhere = { runs: all, rest, layered: f1 - f0 };
ok('Everywhere at 85 %: the frame at rest is the carried meshes\' (the exact pass refuses the whole plane)', !!rest && rest.a === 1 && rest.path === 'mesh', rest);
ok('Everywhere at 85 %: the colour layer covers the pane', !!all && all.covered > 0.95 * all.W * all.H, all && { covered: all.covered, W: all.W, H: all.H });
ok('Everywhere at 85 %: no straight step run of 10 px or more (no sawtooth bands)', !!all && all.n === 0, all && { n: all.n, longest: all.longest, top: all.top });
ok('Everywhere at 85 %: no layered frame (the meshes draw the front layer alone)', f1 === f0, { before: f0, after: f1 });
// Inside regions, the disc on the meshes: its layers still drawn below full opacity
await ev("(__cmwForceForward(['s1']), __cmwSteps({ scope: 'in' }), 1)");
await still();
const g0 = await ev('GLR.carryLayerFrames()');
await ev('(__cmwSteps({ bare: true }), 1)');
await still();
const g1 = await ev('GLR.carryLayerFrames()'), restIn = await ev('__cmwSteps().rest');
info.inside = { rest: restIn, layered: g1 - g0 };
ok('Inside regions at 85 %, the disc forced forward: the frame is the carried meshes\'', !!restIn && restIn.path === 'mesh', restIn);
ok('Inside regions at 85 %, the disc forced forward: layered frames are drawn', g1 > g0, { before: g0, after: g1 });
const L = logs().filter((l) => l.t === 'EXC');
ok('no page exceptions', L.length === 0, L.slice(0, 3));
return { pass: fails.length === 0, fails, info };
