'use strict';
// Review fixes M1, M2, M3, M7 (walker): per-shape member ranges + budgets (walk.js) on the reviewer's cases
// (notes/proto/adv-math/p1, p3, p7) and a completeness fuzz with the reference fixed at the default clipWin centre.
//   node notes/proto/lead-rev/r1_ranges.js [--fuzz N]
const path = require('path');
const W2 = require('./walk.js');
const Region = require(path.resolve(__dirname, '../../../src/region.js'));
const { C } = CX;
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
function sampleIn(shape, N, box) {
  const L = Region.levelOf(shape), bb = Region.bboxOf(shape) || box, out = [];
  let tries = 0;
  while (out.length < N && tries < N * 400) {
    tries++;
    const z = C(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.y0 + rnd() * (bb.y1 - bb.y0));
    if (L(z) > 1e-6) out.push(z);
  }
  return out;
}
// float64 conditioning guard: follow the true path backwards (nearest member to the true intermediate value at each
// op); samples whose path does not return to z (precision loss, e.g. w rounding to an asymptotic value) are skipped.
function wellConditioned(plan, z) {
  const vals = [z];
  for (const o of plan.ops) vals.push(o.fwd(vals[vals.length - 1]));
  let v = vals[vals.length - 1];
  for (let j = plan.ops.length - 1; j >= 0; j--) {
    const o = plan.ops[j], ut = vals[j];
    let cands;
    if (o.kind === 'ROOTPOW' && o.count !== 'one') {
      const beta = CX.inv(o.s), S = C(-2 * Math.PI * beta.im, 2 * Math.PI * beta.re), bL = CX.mul(beta, CX.log(v));
      const lt = CX.log(ut), S2 = S.re * S.re + S.im * S.im, d = CX.sub(lt, bL);
      const m0 = Math.round((d.re * S.re + d.im * S.im) / S2);
      cands = [];
      for (let m = m0 - 3; m <= m0 + 3; m++) cands.push(CX.exp(C(bL.re + m * S.re, bL.im + m * S.im)));
    } else cands = o.pre(v, ut).map((m) => m.u);
    let best = null, bd = Infinity;
    for (const u of cands) { if (!CX.isFin(u)) continue; const d = CX.abs(CX.sub(u, ut)); if (d < bd) { bd = d; best = u; } }
    if (!best) return false;
    v = best;
  }
  return CX.abs(CX.sub(v, z)) <= 1e-7 * (1 + CX.abs(z));
}
let skipped = 0;
function run(name, stepList, shape, win, N = 2000, opts = {}) {
  const { plan, F } = W2.planOf(stepList);
  const prep = W2.prepare(plan, shape, win, opts);
  if (!prep.ok) return { name, forward: prep.reason };
  let n = 0, miss = 0, vis = 0, ex = null; const sk0 = skipped;
  for (const z of sampleIn(shape, N, opts.box || { x0: -100, x1: 100, y0: -100, y1: 100 })) {
    const w = F(z);
    if (!CX.isFin(w) || CX.abs(w) > 1e12 || CX.abs(w) < 1e-12) continue;
    if (!wellConditioned(plan, z)) { skipped++; continue; }
    n++;
    const r = W2.walk(plan, prep, w, 1e-3, { K: 1 });
    vis += r.visited;
    if (!r.found.length) { miss++; if (!ex) ex = { z: CX.fmt(z), w: CX.fmt(w) }; }
  }
  return { name, n, miss, skip: skipped - sk0, perPx: vis / Math.max(1, n), N: prep.N.filter((x, i) => prep.fam[i]).join('x'), ex };
}
const show = (r) => console.log(r.forward ? `${r.name.padEnd(52)} -> forward (${r.forward})` : `${r.name.padEnd(52)} missed ${r.miss}/${r.n} (skipped ${r.skip})  leaves/px ${r.perPx.toFixed(1)}  budgets ${r.N}${r.ex ? '  e.g. ' + JSON.stringify(r.ex) : ''}`);
const WIN0 = { x0: -3.4, x1: 3.4, y0: -4.3, y1: 4.3 };
const WIDE = { x0: -80, x1: 80, y0: -100, y1: 100 };
const OUT2 = { x0: -6.8, x1: 6.8, y0: -8.6, y1: 8.6 };
const H = { kind: 'halfplane', a: [0, 0], b: [1, 0] };
const sub = (cy) => ({ x0: -3.4, x1: 3.4, y0: cy - 4.3, y1: cy + 4.3 });

console.log('--- M1/M2: reviewer cases (p1_window_miss.js), ref at the clipWin centre');
show(run('exp, disc r=1 at 60i, wide view', [{ type: 'exp' }], { kind: 'disc', c: [0, 60], r: 1 }, WIDE));
show(run('tan, disc r=1 at 30, wide view', [{ type: 'tan' }], { kind: 'disc', c: [30, 0], r: 1 }, WIDE));
show(run('sin, rect [20,40]x[0,1], wide view', [{ type: 'sin' }], { kind: 'rect', a: [20, 0], b: [40, 1] }, WIDE));
show(run('exp∘exp, disc r=0.1 at 3+0.9i, default view', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [3, 0.9], r: 0.1 }, WIN0));
show(run('exp∘exp, disc r=1 at 3, default view', [{ type: 'exp' }, { type: 'exp' }], { kind: 'disc', c: [3, 0], r: 1 }, WIN0));
show(run('exp∘exp, rect [0,3]x[-1,1]', [{ type: 'exp' }, { type: 'exp' }], { kind: 'rect', a: [0, -1], b: [3, 1] }, WIN0));
show(run('sin∘exp, disc r=0.3 at 2.5+0.5i', [{ type: 'exp' }, { type: 'sin' }], { kind: 'disc', c: [2.5, 0.5], r: 0.3 }, WIN0));
show(run('tan∘exp, disc r=0.3 at 1.5+2i', [{ type: 'exp' }, { type: 'tan' }], { kind: 'disc', c: [1.5, 2], r: 0.3 }, WIN0));
show(run('e^{z^2}, disc r=0.3 at 3+3i', [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }], { kind: 'disc', c: [3, 3], r: 0.3 }, WIN0));
show(run('e^{z^2}, disc r=0.3 at 3.3+4.1i', [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }], { kind: 'disc', c: [3.3, 4.1], r: 0.3 }, WIN0));
show(run('e^{1/z^2}, disc r=0.2 at 0.6+0.5i', [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z^2}}', cut: 180 } }], { kind: 'disc', c: [0.6, 0.5], r: 0.2 }, WIN0));
show(run('e^{1/z^2}, unit disc (pole inside)', [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z^2}}', cut: 180 } }], { kind: 'disc', c: [0, 0], r: 1 }, WIN0, 2000, { sing: [C(0, 0)] }));
show(run('e^{10z}, disc r=0.3 at 6.5i, view out 2x', [{ type: 'custom', params: { expr: 'e^{10z}', cut: 180 } }], { kind: 'disc', c: [0, 6.5], r: 0.3 }, OUT2));
show(run('e^{1/z} (recip, exp), unit disc', [{ type: 'recip' }, { type: 'exp' }], { kind: 'disc', c: [0, 0], r: 1 }, WIN0, 2000, { sing: [C(0, 0)] }));
show(run('exp, disc r=100 (convex, truncated window)', [{ type: 'exp' }], { kind: 'disc', c: [0, 0], r: 100 }, WIN0));
show(run('exp, annulus 40<|z|<100 (non-convex, too big)', [{ type: 'exp' }], { kind: 'annulus', c: [0, 0], r1: 40, r2: 100 }, WIN0));
show(run('exp, complement of |z-60i|<40', [{ type: 'exp' }], { kind: 'disc', c: [0, 60], r: 40, complement: true }, WIN0, 2000, { box: { x0: -100, x1: 100, y0: -100, y1: 100 } }));
show(run('exp, sector r=0 at 0, 100..120 deg (tilted)', [{ type: 'exp' }], { kind: 'sector', c: [0, 0], r: 0, t1: 100, t2: 120 }, WIN0));
show(run('exp, halfplane Im z > 10 Re z (shallow tilt)', [{ type: 'exp' }], { kind: 'halfplane', a: [0, 0], b: [1, 10] }, WIN0));
show(run('exp∘exp of H (outer range unbounded)', [{ type: 'exp' }, { type: 'exp' }], H, WIN0));

console.log('--- M7 walker (p7_walker_clamp.js): exp(H), left view centred below the axis');
for (const cy of [1, -3, -6, -20, -200]) show(run(`exp(H), view centred at Im z = ${cy}`, [{ type: 'exp' }], H, sub(cy), 1500, { box: { x0: -20, x1: 5, y0: 0, y1: 400 } }));

console.log('--- M3: ROOTPOW finite (p3_rootpow_finite.js)');
for (const a of ['15', '15.5', '16', '17.5', '20', '-18', '20+0.1i', '20+2i', '0.05', '0.05+1i', '0.01+1i', '70']) {
  for (const [sh, nm] of [[{ kind: 'disc', c: [1, 0.5], r: 0.3 }, 'disc'], [H, 'H']]) show(run(`powa ${a}, ${nm}`, [{ type: 'powa', params: { alpha: a, cut: 180, k: 0 } }], sh, WIN0, 1500, { box: { x0: -3, x1: 3, y0: 0, y1: 3 } }));
}
show(run('custom z^{17.5}, disc at 1+0.5i', [{ type: 'custom', params: { expr: 'z^{17.5}', cut: 180 } }], { kind: 'disc', c: [1, 0.5], r: 0.3 }, WIN0));

// completeness fuzz: random shapes anywhere in +-100, ref at the default clipWin centre, several left-view zooms
const fuzzN = +(process.argv[process.argv.indexOf('--fuzz') + 1]) || 0;
if (fuzzN) {
  console.log(`--- completeness fuzz: ${fuzzN} shapes per chain x zoom`);
  const CHAINS = [
    ['exp', [{ type: 'exp' }]], ['tan', [{ type: 'tan' }]], ['sin', [{ type: 'sin' }]], ['cosh', [{ type: 'cosh' }]],
    ['e^{10z}', [{ type: 'custom', params: { expr: 'e^{10z}', cut: 180 } }]], ['exp∘exp', [{ type: 'exp' }, { type: 'exp' }]],
    ['e^{z^2}', [{ type: 'custom', params: { expr: 'e^{z^2}', cut: 180 } }]], ['tan∘exp', [{ type: 'exp' }, { type: 'tan' }]],
    ['e^{1/z^2}', [{ type: 'custom', params: { expr: 'e^{\\frac{1}{z^2}}', cut: 180 } }]], ['z^i', [{ type: 'powa', params: { alpha: 'i', cut: 180, k: 0 } }]],
    ['e^{1/z}', [{ type: 'recip' }, { type: 'exp' }]], ['powa 17.5', [{ type: 'powa', params: { alpha: '17.5', cut: 180, k: 0 } }]],
    ['powa 0.5+2i', [{ type: 'powa', params: { alpha: '0.5+2i', cut: 90, k: 1 } }]], ['exp∘Cayley', [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'exp' }]],
  ];
  const randShape = () => {
    const k = Math.floor(rnd() * 7), c = [(rnd() * 2 - 1) * 100, (rnd() * 2 - 1) * 100], r = 0.05 * Math.pow(100, rnd());
    if (k === 0) return { kind: 'disc', c, r };
    if (k === 1) return { kind: 'rect', a: c, b: [c[0] + r * (rnd() * 2 - 1) * 2, c[1] + r * (rnd() * 2 - 1) * 2] };
    if (k === 2) { const t = rnd() * 360; return { kind: 'halfplane', a: c, b: [c[0] + Math.cos(t * Math.PI / 180), c[1] + Math.sin(t * Math.PI / 180)] }; }
    if (k === 3) { const t1 = rnd() * 360; return { kind: 'sector', c, r: rnd() < 0.5 ? 0 : r, t1, t2: t1 + 10 + rnd() * 300 }; }
    if (k === 4) return { kind: 'annulus', c, r1: r * 0.4, r2: r };
    if (k === 5) { const pts = []; for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5 + rnd(); const rr = r * (0.5 + rnd()); pts.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]); } return { kind: 'polygon', pts }; }
    return { kind: 'disc', c, r, complement: true };
  };
  for (const [cn, chain] of CHAINS) {
    let tot = 0, miss = 0, fwd = 0, shapes = 0, worst = null; const sk0 = skipped;
    for (const z of [1, 0.25, 1 / 16, 4]) {
      const win = { x0: -3.4 / z, x1: 3.4 / z, y0: 0.5 - 4.3 / z, y1: 0.5 + 4.3 / z };
      for (let t = 0; t < fuzzN; t++) {
        const sh = randShape(); shapes++;
        const r = run(cn, chain, sh, win, 60, { ref: C(0, 0.5), box: { x0: -100, x1: 100, y0: -100, y1: 100 } });
        if (r.forward) { fwd++; continue; }
        tot += r.n; miss += r.miss;
        if (r.miss && !worst) worst = { sh, miss: r.miss, n: r.n, ex: r.ex };
      }
    }
    console.log(`${cn.padEnd(12)} shapes ${shapes}, forward ${fwd}, samples ${tot} (ill-conditioned skipped ${skipped - sk0}), missed ${miss}${worst ? '  first miss ' + JSON.stringify(worst) : ''}`);
  }
}
