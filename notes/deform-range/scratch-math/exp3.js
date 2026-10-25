const { chain, X, C } = require('./rangeModel.js');
const eqb = (u, v) => (Object.is(u.re, v.re) && Object.is(u.im, v.im));
const pts = [C(0.3, 0.7), C(-0.4, 0.2), C(0.8, -0.5), C(-1.2, 0.9), C(1.4, 1.1), C(-0.9, -1.0)];
function check(name, ch, extra) {
  const n = ch.n; let rep = [];
  for (let a = 0; a < n; a++) for (let b = a + 1; b <= n; b++) for (const homAll of [false, true]) {
    const S = { focus: 0, range: { a, b }, homAll };
    const r = ch.morphRange(S);
    const m0 = ch.morphState(S, 0, false), mEnd = ch.morphState(S, homAll && r.steps.length > 1 ? 1 : r.steps.length, false);
    const pre = ch.rangeF(0, r.a), post = ch.rangeF(r.b, n), F = ch.stageF(n);
    let s0 = 0, sE = 0, sMap = 0, worst = 0;
    for (const z of pts) {
      const h0 = m0.F(z), want0 = post(pre(z));
      if (eqb(h0, want0)) s0++;
      const hE = mEnd.F(z), f = F(z);
      if (eqb(hE, f)) sE++;
      // the map spec's CPU twin agrees with morphState's F at a middle time
      const mm = ch.morphState(S, 0.37 * (homAll && r.steps.length > 1 ? 1 : r.steps.length), false);
      const u = mm.F(z), v = ch.cpuMap(mm.map)(z);
      if (eqb(u, v)) sMap++;
      // continuity across a segment boundary (one after another)
      if (!homAll && r.steps.length > 1) {
        const e = 1e-9, A = ch.morphState(S, 1 - e, false).F(z), B = ch.morphState(S, 1 + e, false).F(z);
        worst = Math.max(worst, X.abs(X.sub(A, B)));
      }
    }
    rep.push(`(${a},${b}]${homAll ? ' all' : '    '} map=${JSON.stringify(m0.map)} H0=post∘pre ${s0}/${pts.length} Hend=F ${sE}/${pts.length} twin ${sMap}/${pts.length}${!homAll && r.steps.length > 1 ? ' jump@1 ' + worst.toExponential(1) : ''}`);
  }
  console.log('== ' + name + '\n' + rep.join('\n'));
}
check('chain3: exp, (w-1)/(w+1), w^2', chain([{ type: 'exp' }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }, { type: 'pown', params: { n: 2 } }]));
check('sin sqrt: root 2, sin', chain([{ type: 'root', params: { n: 2 } }, { type: 'sin' }]));
check('mobius-log: (z-i)/(z+i), log', chain([{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'log' }]));
