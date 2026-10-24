// (1) lamps: the formula step (classify + chain) against the split chain (composeProps of its steps);
// (2) deformation: the formula step's hom at t = (j+s)/n against the split chain played in sequence (step j at s)
require('./load.js');
const C = CX.C;
let A = 0.7;
Expr.setNames({ get: (n) => (n === 'a' ? A : undefined), display: (n) => n });
const F = ['\\sin(z^2+1)', '\\frac{2z+1}{z-1}', 'e^{iz}+e^{-iz}', 'z^{i}', '(z-a)^3', '\\sqrt{1-z^2}', '\\log\\frac{1+z}{1-z}', '\\frac{1}{z}+z',
  '\\log(-z)', '2(z-1)^3+5', '1/(1+e^{-z})', '\\log(z^z)', 'z^2+1', '\\frac{z^2-1}{z^2+1}', '\\cot z', '\\sin z+\\cos z', '\\log(1+z)-\\log(1-z)'];
const on = (p) => Funcs.PROP_KEYS.filter((k) => p[k]).concat(p.deg != null ? [`deg${p.degExact ? '=' : '≤'}${p.deg}`] : []);
let seed = 3; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const RP = []; for (let i = 0; i < 400; i++) RP.push(C((rnd() * 2 - 1) * 2.5, (rnd() * 2 - 1) * 2.5));
const rel = (u, v) => (CX.isFin(u) !== CX.isFin(v) ? Infinity : !CX.isFin(u) ? 0 : CX.abs(CX.sub(u, v)) / (1 + CX.abs(u)));
for (const s of F) {
  const r = Funcs.buildVals('custom', { expr: s, cut: 180 });
  if (!r.rec) { console.log(s, ': not recognized'); continue; }
  const built = r.rec.steps.map((x) => (x.type === 'custom' ? Funcs.buildVals('custom', { expr: Expr.toTex(x.vals.ast).s, cut: 180 }) : Funcs.buildVals(x.type, x.vals)));
  const cp = Funcs.composeProps(built.map((b) => b.props));
  const a = on(r.props), b = on(cp);
  const lost = a.filter((k) => !b.includes(k)), gained = b.filter((k) => !a.includes(k));
  const n = built.length;
  let worst = 0, bad = 0;
  for (const t of [0.07, 0.31, 0.5, 0.66, 0.93]) {
    const j = Math.min(n - 1, Math.floor(t * n)), sj = t * n - j;
    const Hf = r.hom(t), Hj = (built[j].hom || ((tt) => (z) => CX.add(CX.scale(z, 1 - tt), CX.scale(built[j].f(z), tt))))(sj);
    for (const p of RP) {
      let z = p; for (let i = 0; i < j; i++) z = built[i].f(z);
      const d = rel(Hf(p), Hj(z));
      if (d > 1e-9) bad++; else if (d > worst) worst = d;
    }
  }
  console.log(`${s.padEnd(26)} | ${built.map((x) => x.def.id).join('>').padEnd(24)} | formula lamps: ${a.join(' ')} | split lamps lose: ${lost.join(' ') || '-'} gain: ${gained.join(' ') || '-'} | path: ${bad} of ${5 * RP.length} differ, max rounding ${worst.toExponential(1)}`);
}
