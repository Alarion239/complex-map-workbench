// The visible split (catalog steps as the chain evaluates them, normalised cut, no formula pieces) against the formula's
// own Expr.compile: random points (rounding), and the axes with signed zeros (the cut-ray cases).
require('./load.js');
const C = CX.C;
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const F = ['\\sin(z^2+1)', '\\frac{2z+1}{z-1}', 'e^{iz}+e^{-iz}', 'z^{i}', '(z-a)^3', '\\sqrt{1-z^2}', '\\log\\frac{1+z}{1-z}', '\\frac{1}{z}+z',
  '\\log(-z)', '\\sqrt{-z}', '\\log(z-1)', '\\log(1-z)', '\\sqrt{z^2-1}', '\\log(\\sin z)', '\\sqrt{z^2}', '1/(1+e^{-z})', 'z^{a}', '\\log(2z)', '\\log(-2z+1)', '\\log(z^2)', '(1-z)^{1/3}', '\\log(iz)', '\\sqrt{-iz}'];
const CUTS = [180, 90, -90, 270];
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const RP = []; for (let i = 0; i < 3000; i++) RP.push(C((rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3));
const AX = [];
for (const x of [-2.5, -1.7, -1, -0.6, -0.2, 0.3, 0.8, 1, 1.4, 2.2]) for (const s of [0, -0]) { AX.push(C(x, s)); AX.push(C(s, x)); }
const rel = (u, v) => (CX.isFin(u) !== CX.isFin(v) ? Infinity : !CX.isFin(u) ? 0 : CX.abs(CX.sub(u, v)) / (1 + CX.abs(u)));
const fmt = (z) => `${Object.is(z.re, -0) ? '-0' : z.re}${Object.is(z.im, -0) ? '-0' : (z.im >= 0 ? '+' + z.im : z.im)}i`;
for (const s of F) for (const cut of CUTS) {
  const ast = Expr.parse(s), th = cut * Math.PI / 180;
  const f = Expr.compile(ast, { theta: th });
  const rc = Recognize.chain(ast, cut);
  if (!rc) { if (cut === 180) console.log(s, 'not recognized'); continue; }
  const built = rc.steps.map((x) => Funcs.buildVals(x.type, x.vals));
  const g = (z) => { for (const b of built) z = b.f(z); return z; };
  let mr = 0; for (const p of RP) { const r = rel(f(p), g(p)); if (r > mr && r < 1e-3) mr = r; }
  let flips = RP.filter((p) => rel(f(p), g(p)) > 1e-6).length;
  const ax = AX.filter((p) => rel(f(p), g(p)) > 1e-6);
  if (cut === 180 || flips || ax.length) console.log(`${s.padEnd(24)} cut ${String(cut).padStart(4)} | ${rc.steps.map((x) => x.type).join('>').padEnd(26)} | random: max rounding ${mr.toExponential(1)}, off ${flips} | axis ±0 points that differ: ${ax.length}${ax.length ? ' e.g. z=' + fmt(ax[0]) + ' F=' + CX.fmtExact(f(ax[0])) + ' chain=' + CX.fmtExact(g(ax[0])) : ''}`);
}
