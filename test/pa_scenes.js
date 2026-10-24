// the 8 scenes of the paths-aesthetics study (notes/paths-aesthetics): eval'd by test/pa_render.js
const PI = Math.PI;
const SCENES = [
  { id: 'jouk', st: { shapes: [{ id: 's1', kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true }, { id: 's2', kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888 }], steps: [{ type: 'joukowski', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 70 } } },
  { id: 'rational', st: { shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.5], b: [1.5, 1.5], n: 6 }], steps: [{ type: 'rational', params: { p: '1, 0, -1', q: '1, 0, 1' }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } } },
  { id: 'expstrip', st: { shapes: [{ id: 's1', kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' }, { id: 's2', kind: 'cgrid', a: [-2, -1.5], b: [1.5, 1.5], n: 6 }], steps: [{ type: 'exp', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 60 } } },
  { id: 'chain3', homAll: true, st: { shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.2], b: [1.5, 1.2], n: 6 }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' }, on: true }, { type: 'pown', params: { n: 2 }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } } },
  { id: 'cosstrip', st: { shapes: [{ id: 's1', kind: 'rect', a: [0, -1], b: [PI, 1] }, { id: 's2', kind: 'cgrid', a: [0, -1], b: [PI, 1], n: 6 }], steps: [{ type: 'cos', params: {}, on: true }], srcView: { cx: 1.5, cy: 0, s: 80 } } },
  { id: 'cube', st: { shapes: [{ id: 's1', kind: 'sector', c: [0, 0], r: 1.4, t1: 0, t2: 60 }, { id: 's2', kind: 'pgrid', c: [0, 0], r: 1.4, nc: 4, nr: 16 }], steps: [{ type: 'pown', params: { n: 3 }, on: true }], srcView: { cx: 0.5, cy: 0.5, s: 120 } } },
  { id: 'mobius', st: { shapes: [{ id: 's1', kind: 'halfplane', a: [0, 0], b: [1, 0] }, { id: 's2', kind: 'cgrid', a: [-2, 0], b: [2, 2.5], n: 8 }], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], srcView: { cx: 0, cy: 1, s: 60 } } },
  { id: 'zp', st: { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1.5 }, { id: 's2', kind: 'pgrid', c: [0, 0], r: 1.5, nc: 4, nr: 16 }], steps: [{ type: 'zp', params: { a: '1', zeros: '0.8, -0.8', poles: '0.5i' }, on: true }], srcView: { cx: 0, cy: 0, s: 80 } } },
];
SCENES;
