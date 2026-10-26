const B = 'http://127.0.0.1:9814/xvls/';
const ns = 'rvmpown' + Date.now();
await nav(B + 'test.html?ns=blank'); await sleep(500);
const o = { v3: true, v4: true, shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [{ type: 'pown', params: { n: 2 }, on: true }], nextId: 50, focus: 0, rightMode: 'image', pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'land' }, sheets: false, height: 'im', meshN: 240 };
await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
await nav(B + 'test.html?ns=' + ns); await sleep(2500);
await ev('__cmwSetMain("land")'); await sleep(1200);
await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await sleep(900);
await ev('__cmwMorph({ T: 0.5, playing: false })'); await sleep(1500);
await shot('rvmath-pown-t05');
return await ev(`(() => { const m = GLR.landMesh(256); if (!m || !m.h) return { err: 'no mesh', m: !!m };
  const f = m.key.split('|'), n = f.length, bx = { x0: +f[n - 9], x1: +f[n - 8], y0: +f[n - 7], y1: +f[n - 6] }, N = +f[n - 5], H = +f[n - 3];
  let cross = 0, steep = 0, flagged = 0, maxd = 0;
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N; i++) { const x = bx.x0 + i / (N - 1) * (bx.x1 - bx.x0), y0 = bx.y0 + j / (N - 1) * (bx.y1 - bx.y0), y1 = bx.y0 + (j + 1) / (N - 1) * (bx.y1 - bx.y0);
    if (!(x < -0.05 && y0 < 0 && y1 >= 0)) continue; cross++; const a = (j * N + i) * 4, b = ((j + 1) * N + i) * 4; const d = Math.abs(m.h[b + 2] - m.h[a + 2]) / H; maxd = Math.max(maxd, d); if (d > 0.3) steep++; if (m.e && m.e[1][a + 3] > 0.5) flagged++; }
  return { N, cuts: m.cuts, key: m.key.slice(-80), crossEdges: cross, steepOver03H: steep, flaggedAsJump: flagged, maxStepH: +maxd.toFixed(3) }; })()`);
