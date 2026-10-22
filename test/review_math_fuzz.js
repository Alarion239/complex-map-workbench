// Reviewer scratch: random chains, check every lit property numerically.
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
const Funcs = require('../src/funcs.js');
const C = CX.C;
let seed = +(process.argv[2] || 1);
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const rc = () => pick(['0', '1', '-1', 'i', '-i', '2', '0.5', '1+i', '-2+0.5i', '0.3-0.7i', '3', `${(rnd() * 4 - 2).toFixed(2)}+${(rnd() * 4 - 2).toFixed(2)}i`]);
const CUSTOM = ['z^2+\\frac{1}{z}', 'z^3-z', '\\overline{z}', '|z|', '\\operatorname{Re}(z)', '\\arg z', 'z\\overline{z}', '\\frac{z^2-1}{z-1}', '\\frac{\\sin z}{z}', '2z+1', '(z+1)^2-z^2', 'z^2-z^2', '\\log z', '\\sqrt{z}', 'e^{z}', '\\frac{1}{z}', '\\frac{z-i}{z+i}', 'z^{-2}', 'iz+\\pi', '5', 'z^{1.5}', '\\sqrt{z^2}', '\\frac{z}{2}+\\frac{z}{2}', '\\cos z', 'z|z|', '0z+3', '(z-2)(z+2)', '\\frac{(z-1)^2}{z-1}', 'z^0', '\\sqrt[3]{z}', 'z^{i}', '2^z', '\\frac{z^3}{z}'];
function randStep() {
  const ids = Object.keys(Funcs.DEFS);
  const id = pick(ids);
  const p = Funcs.defaults(id);
  for (const q of Funcs.DEFS[id].params) {
    if (q.type === 'cx') p[q.key] = id === 'blaschke' && q.key === 'a' ? pick(['0', '0.5', '1', 'i', '0.6+0.8i', '2', '-0.3i']) : rc();
    if (q.type === 'int') p[q.key] = pick([0, 1, -1, 2, 3, -2, -3, 5]);
    if (q.type === 'angle') p[q.key] = pick([180, 90, -90, 0, 45, 135]);
    if (q.type === 'coeffs') p[q.key] = Array.from({ length: 1 + Math.floor(rnd() * 4) }, () => pick(['0', '1', '-1', '2', 'i', '0.5'])).join(',');
    if (q.type === 'expr') p[q.key] = pick(CUSTOM);
    if (q.type === 'choice') p[q.key] = pick(q.choices)[0];
  }
  return { type: id, params: p };
}
const pts = (n) => Array.from({ length: n }, () => C((rnd() * 2 - 1) * 2.5, (rnd() * 2 - 1) * 2.5));
function deriv(F, z) {
  const h = 1e-6 * (1 + CX.abs(z));
  const fx = CX.scale(CX.sub(F(C(z.re + h, z.im)), F(C(z.re - h, z.im))), 1 / (2 * h));
  const fy = CX.scale(CX.sub(F(C(z.re, z.im + h)), F(C(z.re, z.im - h))), 1 / (2 * h));
  return { fx, fy };
}
const issues = {};
const report = (key, msg) => { (issues[key] = issues[key] || []).push(msg); };
const N = +(process.argv[3] || 4000);
for (let trial = 0; trial < N; trial++) {
  const n = 1 + Math.floor(rnd() * 3);
  const steps = Array.from({ length: n }, randStep);
  const built = steps.map((s) => Funcs.build(s));
  if (built.some((b) => b.error)) { report("_built_error", built.find((b)=>b.error).error); continue; }
  report("_lit_" + Funcs.PROP_KEYS.filter((k)=>Funcs.composeProps(built.map((b)=>b.props))[k]).join(","), "x");
  const P = Funcs.composeProps(built.map((b) => b.props));
  const F = (z) => built.reduce((w, b) => b.f(w), z);
  const desc = steps.map((s) => `${s.type}(${JSON.stringify(s.params)})`).join(' ∘→ ');
  const zs = pts(40).filter((z) => CX.isFin(F(z)));
  if (zs.length < 10) continue;
  // constant
  const v0 = F(zs[0]);
  const isConst = zs.every((z) => CX.abs(CX.sub(F(z), v0)) < 1e-9 * (1 + CX.abs(v0)));
  if (P.constant && !isConst) report('constant-false', desc);
  // analytic (Cauchy-Riemann), away from cuts: skip points where finite differences blow up
  if (P.analytic && !isConst) {
    let bad = 0, tot = 0;
    for (const z of zs) {
      const { fx, fy } = deriv(F, z);
      if (!CX.isFin(fx) || !CX.isFin(fy)) continue;
      tot++;
      const cr = CX.abs(CX.sub(fy, CX.mul(C(0, 1), fx)));
      if (cr > 1e-4 * (1 + CX.abs(fx))) bad++;
    }
    if (bad > 3) report('analytic-false', `${desc}  [${bad}/${tot} CR failures]`);
  }
  // entire: finite on a big sample
  if (P.entire) {
    const big = pts(60).map((z) => CX.scale(z, 0.4));
    if (big.some((z) => !CX.isFin(F(z)))) report('entire-false', desc);
  }
  // mobius: fit through 3 points via cross-ratio, check others
  if (P.mobius) {
    const z3 = zs.slice(0, 3), w3 = z3.map(F);
    const cr = (a, b, c, d) => CX.div(CX.mul(CX.sub(a, c), CX.sub(b, d)), CX.mul(CX.sub(a, d), CX.sub(b, c)));
    let bad = 0;
    for (const z of zs.slice(3, 12)) {
      const x = cr(z, z3[0], z3[1], z3[2]), y = cr(F(z), w3[0], w3[1], w3[2]);
      if (CX.isFin(x) && CX.isFin(y) && CX.abs(CX.sub(x, y)) > 1e-6 * (1 + CX.abs(x))) bad++;
    }
    if (bad) report('mobius-false', desc);
  }
  // injective: look for a second preimage by Newton
  if (P.injective && !isConst) {
    let found = null;
    for (const z1 of zs.slice(0, 6)) {
      const w1 = F(z1);
      for (let s = 0; s < 12 && !found; s++) {
        let z = C((rnd() * 2 - 1) * 4, (rnd() * 2 - 1) * 4);
        for (let it = 0; it < 60; it++) {
          const fz = CX.sub(F(z), w1);
          if (!CX.isFin(fz)) break;
          const { fx } = deriv(F, z);
          const st = CX.div(fz, fx);
          if (!CX.isFin(st)) break;
          z = CX.sub(z, st);
          if (CX.abs(st) < 1e-13 * (1 + CX.abs(z))) break;
        }
        const fz = F(z);
        if (CX.isFin(fz) && CX.abs(CX.sub(fz, w1)) < 1e-11 * (1 + CX.abs(w1)) && CX.abs(CX.sub(z, z1)) > 1e-4) found = [z1, z, w1];
      }
      if (found) break;
    }
    if (found) report('injective-false', `${desc}  F(${CX.fmt(found[0])}) = F(${CX.fmt(found[1])}) = ${CX.fmt(found[2])}`);
  }
  // proper: |F| large at large |z| (only meaningful when no step has a bounded far field)
  if (P.proper) {
    const far = [1e5, 1e6].flatMap((R) => [0, 1, 2, 3, 4].map((k) => C(R * Math.cos(k * 1.3), R * Math.sin(k * 1.3))));
    if (far.some((z) => CX.isFin(F(z)) && CX.abs(F(z)) < 1e3)) report('proper-false', desc);
  }
  // polynomial degree via winding number on a big circle
  if (P.polynomial && P.degExact && P.deg > 0) {
    const R = 50; let wind = 0; let prev = null;
    const M = 4000;
    for (let j = 0; j <= M; j++) {
      const w = F(C(R * Math.cos(2 * Math.PI * j / M), R * Math.sin(2 * Math.PI * j / M)));
      const a = Math.atan2(w.im, w.re);
      if (prev !== null) { let d = a - prev; if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; wind += d; }
      prev = a;
    }
    const wn = Math.round(wind / (2 * Math.PI));
    if (wn !== P.deg) report('polydeg-false', `${desc} claimed deg ${P.deg}, winding ${wn}`);
  }
}
for (const [k, v] of Object.entries(issues)) {
  console.log(`== ${k}: ${v.length}`);
  for (const m of [...new Set(v)].slice(0, 6)) console.log('   ', m);
}
console.log('done');
