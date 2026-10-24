// Elementary moves in the order translate d/c, scale −c²/det, invert, translate a/c: the pole maps to ∞ exactly
require('./load.js');
const C = CX.C;
const cases = [['\\frac{2z+1}{z-1}', [C(2, 0), C(1, 0), C(1, 0), C(-1, 0)]], ['\\frac{z-i}{z+i}', [C(1, 0), C(0, -1), C(1, 0), C(0, 1)]], ['\\log\\frac{1+z}{1-z}', [C(1, 0), C(1, 0), C(-1, 0), C(1, 0)], 'log'], ['\\frac{3}{z-1}+2', [C(2, 0), C(1, 0), C(1, 0), C(-1, 0)]], ['\\frac{1}{1+e^{-z}}', null]];
let seed = 9; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const RP = []; for (let i = 0; i < 3000; i++) RP.push(C((rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3));
const AX = []; for (const x of [-2.5, -1.7, -1.2, -0.6, -0.2, 0.3, 0.8, 1.4, 2.2]) for (const s of [0, -0]) { AX.push(C(x, s)); AX.push(C(s, x)); }
const rel = (u, v) => (CX.isFin(u) !== CX.isFin(v) ? Infinity : !CX.isFin(u) ? 0 : CX.abs(CX.sub(u, v)) / (1 + CX.abs(u)));
const fx = (z) => (CX.isFin(z) ? CX.fmtExact(z) : `${z.re},${z.im}`);
for (const [s, m0, tail] of cases) {
  if (!m0) continue;
  const [a, b, c, d] = m0, det = CX.sub(CX.mul(a, d), CX.mul(b, c));
  const el = [Funcs.buildVals('add', { c: CX.div(d, c) }), Funcs.buildVals('mul', { c: CX.neg(CX.div(CX.mul(c, c), det)) }), Funcs.buildVals('recip', {}), Funcs.buildVals('add', { c: CX.div(a, c) })];
  if (tail) el.push(Funcs.buildVals('log', { cut: 180, k: 0 }));
  const E = (z) => { for (const x of el) z = x.f(z); return z; };
  const f = Expr.compile(Expr.parse(s), { theta: Math.PI });
  let mr = 0, off = 0; for (const p of RP) { const r = rel(f(p), E(p)); if (r > 1e-9) off++; else if (r > mr) mr = r; }
  const ax = AX.filter((p) => rel(f(p), E(p)) > 1e-6);
  const pole = CX.neg(CX.div(d, c));
  console.log(`${s.padEnd(22)} moves: +(${fx(CX.div(d, c))}) ×(${fx(CX.neg(CX.div(CX.mul(c, c), det)))}) 1/u +(${fx(CX.div(a, c))}) | random: ${off} off, rounding ${mr.toExponential(1)} | axis ±0 differ: ${ax.length} | pole z=${fx(pole)}: F ${fx(f(pole))}, moves ${fx(E(pole))}`);
}
