// Frame cost of the new natural paths while the deformation plays (no perf-suite unit plays them): per scene, the
// rAF frame intervals over 2.5 s of play (paths on) and the synchronised render time of the merged plane at t = 0.5
// (__cmwTime: main thread + GPU finish). Budget: 60 fps (frames <= 16.7 ms; render <= 14 ms, BUDGET60).
//   python3 build.py && test/<you>_cdp/q.sh test/deform_nat_fps_cmd.js
const out = {};
const scenes = {
  joukowski: { ex: 3 },
  cos: { shapes: [{ id: 's1', kind: 'rect', a: [0, -1], b: [Math.PI, 1] }, { id: 's2', kind: 'cgrid', a: [0, -1], b: [Math.PI, 1], n: 6 }], steps: [{ type: 'cos', params: {}, on: true }] },
  rational: { shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.5], b: [1.5, 1.5], n: 6 }], steps: [{ type: 'rational', params: { p: '1, 0, -1', q: '1, 0, 1' }, on: true }] },
  allAtOnce3: { shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.2], b: [1.5, 1.2], n: 6 }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'pown', params: { n: 2 }, on: true }], homAll: true },
  poly5: { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.5 }, { id: 's2', kind: 'pgrid', c: [0, 0], r: 1.5, nc: 5, nr: 16 }], steps: [{ type: 'poly', params: { co: '1, 0, -1, 0.5i, 0, 1' }, on: true }] },
};
await view(1440, 900, false);
for (const [name, sc] of Object.entries(scenes)) {
  if (sc.ex != null) { await nav('http://localhost:8793/test.html?ns=natfps' + name + Date.now()); await sleep(1500); await ev(`__cmwExample(${sc.ex})`); }
  else await load('natfps' + name + Date.now(), { shapes: sc.shapes, steps: sc.steps, pattern: 'checker', homAll: !!sc.homAll, srcView: { cx: 0, cy: 0, s: 80 } });
  await sleep(1200);
  await ev('__cmwMorph({ open: true, T: 0.5, playing: false })'); await sleep(1500);
  const t = await ev('__cmwTime(5)');
  await ev('__cmwMorph({ T: 0, playing: true })'); await sleep(300);
  const fr = await ev('await (async () => await __qa.frames(2500))()', 30000);
  await ev('__cmwMorph({ playing: false, open: false })'); await sleep(300);
  out[name] = { renderRightMs: t.right, frames: fr };
}
return out;
