const B = 'http://127.0.0.1:9814/';
const ld = async (b, ns, st) => {
  await nav(B + b + '/test.html?ns=blank'); await sleep(500);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st || {});
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await nav(B + b + '/test.html?ns=' + ns); await sleep(2500);
};
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
const CASES = [
  { id: 'sinsqrt-im', steps: [sq, sn], h: 'im', range: { a: 1, b: 1 } },
  { id: 'asin-sqrt-im', steps: [{ type: 'arcsin', params: {}, on: true }, sq], h: 'im', range: { a: 1, b: 2 } },
  { id: 'tan-re-play', steps: [{ type: 'tan', params: {}, on: true }], h: 're', range: { a: 1, b: 1 } },
];
const out = [];
await view(1440, 900, false, false);
for (const meshN of [1920, 240]) for (const c of CASES) for (const b of ['snap', 'xvls', 'snap', 'xvls']) {
  await ld(b, 'rvm' + b + c.id + meshN + Date.now(), { shapes: [{ id: 's1', kind: 'rect', a: [-3, -3], b: [3, 3] }], steps: c.steps, pattern: 'checker', srcView: { cx: 0, cy: 0, s: 60 }, view: { main: 'land' }, sheets: false, height: c.h, meshN });
  await settle(1200); await ev('__cmwSetMain("land")'); await settle(900);
  await ev(`__cmwMorph({ open: true, playing: false, range: ${JSON.stringify(c.range)} })`); await settle(900);
  await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(600);
  const play = await ev('await (async () => await __qa.frames(3000))()', 30000);
  await ev('__cmwMorph({ playing: false })');
  const st = await ev('({ meshN: __cmwState().meshN, cuts: (window.GLR && GLR.landMesh) ? (GLR.landMesh() || {}).cuts : null })');
  out.push({ b, meshN, id: c.id, fps: play.fps, p50: play.p50, p95: play.p95, max: play.max, n: play.n, st });
}
return out;
