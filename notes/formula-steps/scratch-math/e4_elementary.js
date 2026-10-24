// A Möbius step written as elementary moves: u = z + d/c, 1/u, times −det/c², plus a/c (c ≠ 0), against the formula
// and against the one Möbius step: values, signed zeros on a later cut, the pole, and the deformation.
require('./load.js');
const C = CX.C;
const cases = [['\\frac{2z+1}{z-1}', [C(2, 0), C(1, 0), C(1, 0), C(-1, 0)], null], ['\\frac{z-i}{z+i}', [C(1, 0), C(0, -1), C(1, 0), C(0, 1)], null],
  ['\\log\\frac{1+z}{1-z}', [C(1, 0), C(1, 0), C(-1, 0), C(1, 0)], 'log'], ['\\sqrt{\\frac{z-1}{z+1}}', [C(1, 0), C(-1, 0), C(1, 0), C(1, 0)], 'root']];
let seed = 5; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const RP = []; for (let i = 0; i < 3000; i++) RP.push(C((rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3));
const AX = []; for (const x of [-2.5, -1.7, -1.2, -0.6, -0.2, 0.3, 0.8, 1.4, 2.2]) for (const s of [0, -0]) { AX.push(C(x, s)); AX.push(C(s, x)); }
const rel = (u, v) => (CX.isFin(u) !== CX.isFin(v) ? Infinity : !CX.isFin(u) ? 0 : CX.abs(CX.sub(u, v)) / (1 + CX.abs(u)));
const fx = (z) => (CX.isFin(z) ? CX.fmtExact(z) : `${z.re},${z.im}`);
for (const [s, m, tail] of cases) {
  const [a, b, c, d] = m, det = CX.sub(CX.mul(a, d), CX.mul(b, c));
  const el = [Funcs.buildVals('add', { c: CX.div(d, c) }), Funcs.buildVals('recip', {}), Funcs.buildVals('mul', { c: CX.neg(CX.div(det, CX.mul(c, c))) }), Funcs.buildVals('add', { c: CX.div(a, c) })];
  const mob = [Funcs.buildVals('mobius', { a, b, c, d })];
  if (tail) { const t = tail === 'log' ? Funcs.buildVals('log', { cut: 180, k: 0 }) : Funcs.buildVals('root', { n: 2, cut: 180, k: 0 }); el.push(t); mob.push(t); }
  const run = (L) => (z) => { for (const x of L) z = x.f(z); return z; };
  const f = Expr.compile(Expr.parse(s), { theta: Math.PI }), E = run(el), Mb = run(mob);
  let mr = 0; for (const p of RP) { const r = rel(f(p), E(p)); if (r < 1e-6 && r > mr) mr = r; }
  const axE = AX.filter((p) => rel(f(p), E(p)) > 1e-6), axM = AX.filter((p) => rel(f(p), Mb(p)) > 1e-6);
  const pole = CX.neg(CX.div(d, c));
  // deformation: one Möbius homotopy at t vs the elementary chain at the same fraction of its 4 sub-steps
  let dmax = 0; const t = 0.5, H = mob[0].hom(t);
  for (const p of RP.slice(0, 200)) { let z = p; for (let i = 0; i < 2; i++) z = el[i].f(z); const r = rel(H(p), el[2].hom(0)(z)); if (r > dmax && CX.isFin(H(p))) dmax = r; }
  console.log(`${s.padEnd(26)} elementary: rounding ${mr.toExponential(1)}; axis ±0 points that differ from F: elementary ${axE.length}${axE.length ? ' (e.g. z=' + fx(axE[0]) + ': F ' + fx(f(axE[0])) + ', elementary ' + fx(E(axE[0])) + ')' : ''}, one Möbius ${axM.length}; at the pole z=${fx(pole)}: F ${fx(f(pole))}, Möbius ${fx(Mb(pole))}, elementary ${fx(E(pole))}; frame at t=1/2: Möbius path vs elementary path differ by up to ${dmax.toFixed(2)} (chordal-free rel)`);
}
