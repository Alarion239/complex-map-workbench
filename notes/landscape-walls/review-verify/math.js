const B = 'http://127.0.0.1:9806/';
const ld = async (st) => {
  const ns = 'vm' + Date.now();
  await send('Page.navigate', { url: B + 'gl-helpers.html' }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: [], nextId: 50, focus: 0, rightMode: 'image', pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'land' }, sheets: false, height: 'im', meshN: 240 }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: B + 'test.html?ns=' + ns }); await sleep(2500);
  await ev('__cmwSetMain("land")'); await sleep(1500);
};
const mesh = (sel) => ev(`(() => { const m = GLR.landMesh(256); if (!m || !m.h) return { err: 'no mesh' };
  const f = m.key.split('|'), n = f.length, bx = { x0: +f[n - 9], x1: +f[n - 8], y0: +f[n - 7], y1: +f[n - 6] }, N = +f[n - 5], H = +f[n - 3];
  const X = (i) => bx.x0 + i / (N - 1) * (bx.x1 - bx.x0), Y = (j) => bx.y0 + j / (N - 1) * (bx.y1 - bx.y0);
  let cross = 0, steep = 0, flagged = 0, maxd = 0, jumps = [0,0,0], nearO = 0, nearOlist = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = (j * N + i) * 4;
    if (m.e) for (let d = 0; d < 3; d++) if (m.e[d][a + 3] > 0.5) { jumps[d]++; if (Math.hypot(X(i), Y(j)) < 3 * (bx.x1 - bx.x0) / (N - 1)) { nearO++; if (nearOlist.length < 6) nearOlist.push([d, +X(i).toFixed(4), +Y(j).toFixed(4)]); } }
    if (j < N - 1 && X(i) < -0.05 && Y(j) < 0 && Y(j + 1) >= 0) { cross++; const b = ((j + 1) * N + i) * 4; const dd = Math.abs(m.h[b + 2] - m.h[a + 2]) / H; maxd = Math.max(maxd, dd); if (dd > 0.3) steep++; if (m.e && m.e[1][a + 3] > 0.5) flagged++; } }
  return { N, cuts: m.cuts, box: bx, crossNegAxis: cross, steepOver03H: steep, flaggedAsJump: flagged, maxStepH: +maxd.toFixed(3), jumps, nearOrigin: nearO, nearOlist }; })()`);
const out = {};
const cases = [
  ['pown2-t0.5-im', { steps: [{ type: 'pown', params: { n: 2 }, on: true }] }, 0.5],
  ['pown2-t0.25-im', { steps: [{ type: 'pown', params: { n: 2 }, on: true }] }, 0.25],
  ['pownm2-t0.2-im', { steps: [{ type: 'pown', params: { n: -2 }, on: true }] }, 0.2],
  ['pown3-t0.5-im', { steps: [{ type: 'pown', params: { n: 3 }, on: true }] }, 0.5],
  ['tan-re', { steps: [{ type: 'tan', params: {}, on: true }], height: 're' }, null],
  ['jouk-re-rest', { steps: [{ type: 'joukowski', params: {}, on: true }], height: 're', shapes: [{ id: 's1', kind: 'rect', a: [-2, -2], b: [2, 2] }] }, null],
  ['jouk-re-t0.5', { steps: [{ type: 'joukowski', params: {}, on: true }], height: 're', shapes: [{ id: 's1', kind: 'rect', a: [-2, -2], b: [2, 2] }] }, 0.5],
  ['asin-plus-recip-re', { steps: [{ type: 'custom', params: { expr: '\\arcsin(z)+1/z', cut: 180 }, on: true }], height: 're', shapes: [{ id: 's1', kind: 'rect', a: [-2, -2], b: [2, 2] }] }, null],
  ['asin-plus-recip-im', { steps: [{ type: 'custom', params: { expr: '\\arcsin(z)+1/z', cut: 180 }, on: true }], height: 'im', shapes: [{ id: 's1', kind: 'rect', a: [-2, -2], b: [2, 2] }] }, null],
];
for (const [id, st, T] of cases) {
  await ld(st);
  if (T != null) { await ev('__cmwMorph({ open: true, playing: false, range: { a: 1, b: 1 } })'); await sleep(900); await ev(`__cmwMorph({ T: ${T}, playing: false })`); await sleep(2500); }
  out[id] = await mesh();
  await shot('math-' + id);
}
out.logs = logs().filter((l) => !/404|favicon/.test(l.m)).slice(0, 8);
return out;
