const K = require('./load.js');
const rec = (st) => K.recompute(st, { all: true }, {});
const by = (st, id) => st.shapes.find((x) => x.id === id);
const chord = (a, b) => { const S = (z) => { const r2 = z[0]*z[0]+z[1]*z[1]; return [2*z[0]/(1+r2), 2*z[1]/(1+r2), (r2-1)/(r2+1)]; }; const A = S(a), B = S(b); return Math.hypot(A[0]-B[0], A[1]-B[1], A[2]-B[2]); };
const pos = (s) => s.cundef ? null : (s._atInf ? [1e300, 0] : s.p);
function scene() {
  return { shapes: [{ id: 'c', kind: 'circle', c: [0.2, -0.1], r: 1.3 },
    { id: 't', kind: 'point', p: [0,0], t: 0.1, def: { op: 'glider', args: [{ s: 'c', part: 0 }] } },
    { id: 'p', kind: 'point', p: [2.5, 1.1] },
    { id: 'k', kind: 'circle', c: [0,0], r: 1, def: { op: 'touch', args: [{ s: 'c', part: 0 }, { s: 't' }, { s: 'p' }], fill: 'none' } },
    { id: 'd', kind: 'line', a: [-3, 0.4], b: [3, 0.9] },
    { id: 'm0', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'd', part: 0 }], index: 0 } },
    { id: 'm1', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'k', part: 0 }, { s: 'd', part: 0 }], index: 1 } },
    { id: 'g', kind: 'point', p: [0,0], t: 0.23, def: { op: 'glider', args: [{ s: 'k', part: 0 }] } },
    { id: 'tg0', kind: 'line', a: [0,0], b: [1,0], def: { op: 'tangent', args: [{ s: 'c', part: 0 }, { s: 'p' }], index: 0, fill: 'none' } },
    { id: 'tp0', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'tg0', part: 0 }, { s: 'c', part: 0 }], index: 0 } },
    { id: 'tg1', kind: 'line', a: [0,0], b: [1,0], def: { op: 'tangent', args: [{ s: 'c', part: 0 }, { s: 'p' }], index: 1, fill: 'none' } },
    { id: 'tp1', kind: 'point', p: [0,0], def: { op: 'meet', args: [{ s: 'tg1', part: 0 }, { s: 'c', part: 0 }], index: 0 } },
  ], targets: [], steps: [] };
}
function sweep(lab, mover, N = 4000) {
  const st = scene(); rec(st);
  let prev = null, w = {}, und = {};
  for (let i = 0; i <= N; i++) {
    mover(st, i / N); rec(st);
    const cur = {}; for (const id of ['m0', 'm1', 'g', 'tp0', 'tp1']) cur[id] = pos(by(st, id));
    for (const id in cur) { if (!cur[id]) und[id] = (und[id] || 0) + 1; if (prev && prev[id] && cur[id]) w[id] = Math.max(w[id] || 0, chord(prev[id], cur[id])); }
    prev = cur;
  }
  console.log(lab.padEnd(30), 'worst steps', JSON.stringify(Object.fromEntries(Object.entries(w).map(([k, v]) => [k, +v.toExponential(2)]))), 'undef', JSON.stringify(und));
}
sweep('T once round C', (st, s) => { by(st, 't').t = 0.1 + s; });
sweep('P across C (radial)', (st, s) => { by(st, 'p').p = [0.2 + 3 * (1 - s) * 0.9, -0.1 + 3 * (1 - s) * 0.4]; });
sweep('P orbit far', (st, s) => { by(st, 'p').p = [0.2 + 3 * Math.cos(6.283 * s), -0.1 + 3 * Math.sin(6.283 * s)]; });
sweep('C radius 0.3 -> 4', (st, s) => { by(st, 'c').r = 0.3 + 3.7 * s; });
