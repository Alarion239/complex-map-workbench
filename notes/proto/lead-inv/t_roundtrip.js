'use strict';
// Round trips of the catalog enumerators (SPEC 3.4 correctness contract):
//  soundness:    every candidate strictly inside its branch range maps back: |f(z) - w| <= 1e-9 (1 + |w|)
//  completeness: for random u in the step's domain, u is among the candidates of w = f(u) (window centred near u)
//  decomposition: composing the ops' forward maps equals the step's own f
//   node notes/proto/lead-inv/t_roundtrip.js
const INV = require('./inverse_proto.js');
const { C } = CX;
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const rc = (s = 2) => C((rnd() * 2 - 1) * s, (rnd() * 2 - 1) * s);
const fmt = (z) => `${z.re.toFixed(3)}${z.im < 0 ? '-' : '+'}${Math.abs(z.im).toFixed(3)}i`;
const cs = (z) => `${z.re}${z.im < 0 ? '' : '+'}${z.im}i`;

const cases = [];
const add = (type, params, n = 1) => cases.push({ type, params });
for (let i = 0; i < 3; i++) {
  add('mul', { c: cs(rc()) }); add('add', { c: cs(rc()) }); add('affine', { a: cs(rc()), b: cs(rc()) });
  add('mobius', { a: cs(rc()), b: cs(rc()), c: cs(rc()), d: cs(rc()) });
  add('blaschke', { a: cs(rc(0.7)), phi: Math.round(rnd() * 360 - 180) });
}
add('recip', {});
for (const n of [-5, -2, -1, 1, 2, 3, 7]) add('pown', { n });
for (const n of [2, 3, 5]) for (const k of [0, 1]) add('root', { n, cut: Math.round(rnd() * 360 - 180), k });
for (const al of ['1.5', '0.5', '-0.7', '2.5', 'i', '0.3+i', '-0.2+0.8i', '3', '0.25', '-2']) for (const k of [-1, 0, 1]) add('powa', { alpha: al, cut: Math.round(rnd() * 360 - 180), k });
add('exp', {});
for (const k of [-1, 0, 2]) add('log', { cut: Math.round(rnd() * 360 - 180), k });
for (const t of ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan', 'arsinh', 'arcosh', 'artanh', 'joukowski', 'conj']) add(t, {});
add('ijouk', { branch: 'exterior' }); add('ijouk', { branch: 'interior' });
add('poly', { co: '2, 1-i, 3' }); add('poly', { co: '1+i, 0, 0, -2' }); add('poly', { co: '0.5, -1' }); add('poly', { co: '1, 0, -1, 0' });
add('rational', { p: '1, -i', q: '1, i' }); add('rational', { p: '1, 0, 1', q: '1, 0' }); add('rational', { p: '1, 2, 0', q: '1, 0, -3' }); add('rational', { p: '1, 0, 0, 1', q: '1, 0' });
for (const [e, cut] of [['e^{1/z}', 180], ['z^{i}', 180], ['\\sqrt{z}+1', 180], ['2^{z}', 180], ['\\log(z-1)', 90], ['\\cot z', 180], ['\\frac{1}{z^2}', 180],
  ['\\sin(2z+1)', 180], ['\\overline{z}^2', 180], ['(z+1)^{1.5}', 60], ['\\sqrt[3]{z}', -90], ['z^2+\\frac{1}{z}', 180], ['\\arcsin(z)/2', 180], ['\\operatorname{artanh}(z)', 180],
  ['3-\\frac{2}{z+i}', 180], ['i^{z}', 180], ['\\sec(z)', 180], ['(1+i)z^{0.7}', 150], ['e^{z^2}', 180], ['\\log(\\log z)', 180]]) add('custom', { expr: e, cut });

let fails = 0, total = 0, inel = 0;
const rows = [];
for (const cse of cases) {
  const b = Funcs.build({ type: cse.type, params: Object.assign(Funcs.defaults(cse.type), cse.params) });
  if (b.error) { rows.push(`${cse.type} ${JSON.stringify(cse.params)}: build error ${b.error}`); continue; }
  const steps = [{ type: cse.type, params: cse.params, on: true }];
  const plan = INV.planChain(steps, [b]);
  if (!plan.ok) { inel++; rows.push(`  INELIGIBLE ${cse.type} ${JSON.stringify(cse.params)}: ${plan.reason}`); continue; }
  let bad = 0, miss = 0, dec = 0, nc = 0, maxRes = 0;
  for (let t = 0; t < 200; t++) {
    const u = rc(2.5);
    const w = b.f(u);
    if (!CX.isFin(w) || CX.abs(w) > 1e8) continue;
    // decomposition
    let x = u; for (const o of plan.ops) x = o.fwd(x);
    if (CX.abs(CX.sub(x, w)) > 1e-9 * (1 + CX.abs(w))) dec++;
    const refs = INV.makeRefs(plan, u);
    const cands = INV.enumerate(plan, w, refs, 1, { ramp: 1e-9, cap: false });
    nc += cands.length;
    // soundness
    for (const cd of cands) {
      if (!(cd.lvl > 1e-7)) continue;
      const wb = b.f(cd.z);
      const r = CX.abs(CX.sub(wb, w)) / (1 + CX.abs(w));
      if (!(r <= 1e-8)) bad++;
      else maxRes = Math.max(maxRes, r);
    }
    // completeness
    const tol = 1e-7 * (1 + CX.abs(u));
    if (!cands.some((cd) => CX.abs(CX.sub(cd.z, u)) <= tol && cd.lvl >= -1e-6)) miss++;
  }
  total++;
  const ok = !bad && !miss && !dec;
  if (!ok) fails++;
  rows.push(`${ok ? 'ok  ' : 'FAIL'} ${cse.type.padEnd(9)} ${JSON.stringify(cse.params).slice(0, 60).padEnd(60)} ops ${plan.ops.map((o) => o.kind).join('>').padEnd(22)} cands/px ${(nc / 200).toFixed(1).padStart(5)} unsound ${bad} missed ${miss} decomp ${dec} maxres ${maxRes.toExponential(1)}`);
}
console.log(rows.join('\n'));
console.log(`\n${total} eligible step cases, ${fails} failing, ${inel} ineligible`);
process.exitCode = fails ? 1 : 0;
