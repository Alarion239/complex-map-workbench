'use strict';
// End-to-end consequences of the imageBox failures: coverage of well-conditioned image points (every intermediate
// value in [1e-6, 1e6]), K = 16 so the early stop never hides a covering leaf.
const L = require('./lib.js');
const { Inverse, C, chain, fmt } = L;
function run(name, list, shape, win, NS = 6000) {
  const ch = chain(list);
  const prep = Inverse.prepare(ch.plan, { win: win || L.WIN0, shape });
  const boxes = prep.rspec.map((s, j) => (s && s.kind === 'box' ? `op${j} box [${s.lo.toFixed(3)}, ${s.hi.toFixed(3)}]` : null)).filter(Boolean).join(', ');
  let n = 0, miss = 0, ex = null;
  if (!prep.ok) { console.log(`${name}: forward (${prep.reason})`); return; }
  for (let t = 0; t < NS; t++) {
    const z = L.sampleIn(shape, 1e-6);
    let u = z, bad = false;
    for (const b of ch.built) { u = b.f(u); const a = CX.abs(u); if (!(a <= 1e6 && a >= 1e-6)) bad = true; }
    if (bad) continue;
    const w = u;
    n++;
    const r = Inverse.enumerate(ch.plan, prep, w, 1e-4, { K: 16, B: 16 });
    if (!(r.U > 0)) { miss++; if (!ex) ex = { z: fmt(z), w: fmt(w) }; }
  }
  console.log(`${name}: prepare ok=${prep.ok}${prep.reason ? ' (' + prep.reason + ')' : ''} N=${prep.N.join('x')} ${boxes}\n   ${miss} of ${n} well-conditioned image points NOT COVERED${ex ? `; e.g. z = ${ex.z} -> w = ${ex.w}` : ''}`);
}
run('exp∘exp, disc |z| < 8π', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 8 * Math.PI });
run('exp∘exp, rect [0,2]x[0,16π]', [{ type: 'exp' }, { type: 'exp' }], { kind: 'rect', a: [0, 0], b: [2, 16 * Math.PI] });
run('(cos z)^i, disc |z+1.3-0.2i| < 0.5 (contains the zero -π/2)', [{ type: 'cos' }, { type: 'powa', params: { alpha: 'i' } }], { kind: 'disc', c: [-1.3, 0.2], r: 0.5 });
run('(cos z)^i, the fuzz sector', [{ type: 'cos' }, { type: 'powa', params: { alpha: 'i' } }], { kind: 'sector', c: [-3.9694083183861375, -1.8456071158152105], r: 3.474168416535243, t1: 79.9583227094069, t2: 240.62533432181243 });
run('exp∘exp, THIN rect [1.9,2]x[0,16π]', [{ type: 'exp' }, { type: 'exp' }], { kind: 'rect', a: [1.9, 0], b: [2, 16 * Math.PI] });
run('exp∘exp, THIN rect [1.9,2]x[0,16π+0.01] (control: no aliasing)', [{ type: 'exp' }, { type: 'exp' }], { kind: 'rect', a: [1.9, 0], b: [2, 16 * Math.PI + 0.01] });
run('(sin z)^{0.5i}, disc |z-0.3| < 0.6 (contains 0)', [{ type: 'sin' }, { type: 'powa', params: { alpha: '0.5i' } }], { kind: 'disc', c: [0.3, 0], r: 0.6 });
run('control: (cos z)^i, disc |z+0.5| < 0.5 (no zero)', [{ type: 'cos' }, { type: 'powa', params: { alpha: 'i' } }], { kind: 'disc', c: [-0.5, 0], r: 0.5 });
