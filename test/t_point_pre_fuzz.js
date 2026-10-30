// Inverse.pointPre against a brute-force solve (#291, the wave 9 maths sweep): seeded random chains of 1 to 3 steps in
// its exact class (affine, Möbius, 1/z, Blaschke, z^n with n in ±2..4, a principal root, a quadratic formula, a degree-2
// rational, zeros and poles, Joukowski) and random p (generic, the image of a random point, at and near a critical
// value, a RAT2 step's value at infinity carried through the steps after it: RAT2 is linear there, one finite root,
// #332's lone root). For each exact answer:
//  1. every z it lists maps to p (relative residual ≤ 1e-7);
//  2. its multiplicities sum to the branch product when no step restricts to one branch (a root) and p is generic, and
//     never exceed it;
//  3. Newton on F(z) − p from a dense grid finds no preimage it missed (a known preimage, the random point, is listed);
//  4. a preimage listed with multiplicity above 1 is a critical point, F′(z) ≈ 0 (a simple root counted twice, #332's
//     RAT2 lone root, fails it).
// Run: node test/t_point_pre_fuzz.js   (exit code 1 on any failure; a fixed seed, about five seconds)
global.CX = require('../src/cx.js');
global.Expr = require('../src/parse.js');
global.Funcs = require('../src/funcs.js');
const Inverse = require('../src/inverse.js');
const C = CX.C, abs = CX.abs, sub = CX.sub;
let seed = 20261030;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const r1 = (a, b) => a + (b - a) * rnd();
const cx = (s = 1.5) => C(r1(-s, s), r1(-s, s));
const cs = (z) => `${+z.re.toFixed(3)}${z.im < 0 ? '-' : '+'}${Math.abs(+z.im.toFixed(3))}i`;
const step = (type, params = {}) => ({ type, params: Object.assign(Funcs.defaults(type), params), on: true });
// one random step of the exact class; restricts: a step whose inverse is one branch (fewer preimages than its degree)
function randStep(force) {
  const k = force != null ? force : Math.floor(rnd() * 11);
  if (k === 0) return { st: step('affine', { a: cs(C(r1(0.4, 1.8) * (rnd() < 0.5 ? 1 : -1), r1(-1, 1))), b: cs(cx(1)) }) };
  if (k === 1) { let a, b, c, d; do { a = cx(); b = cx(); c = cx(); d = cx(); } while (abs(sub(CX.mul(a, d), CX.mul(b, c))) < 0.3); return { st: step('mobius', { a: cs(a), b: cs(b), c: cs(c), d: cs(d) }) }; }
  if (k === 2) return { st: step('recip') };
  if (k === 3) return { st: step('blaschke', { a: cs(C(r1(-0.6, 0.6), r1(-0.6, 0.6))), phi: Math.round(r1(0, 360)) }) };
  if (k === 4) return { st: step('pown', { n: [2, 3, 4, -2][Math.floor(rnd() * 4)] }) };
  if (k === 5) return { st: step('root', { n: 2 + Math.floor(rnd() * 2) }), restricts: true };
  if (k === 6) return { st: step('custom', { expr: `z^2+(${cs(cx(1))})z+(${cs(cx(1))})` }) };
  if (k === 7) return { st: step('rational', { p: `${r1(0.5, 2).toFixed(2)}, ${r1(-1, 1).toFixed(2)}, ${r1(-1, 1).toFixed(2)}`, q: `${r1(0.5, 2).toFixed(2)}, ${r1(-1, 1).toFixed(2)}, ${r1(0.2, 1).toFixed(2)}` }) };
  if (k === 8) return { st: step('zp', { a: cs(C(r1(0.5, 1.5), r1(-0.5, 0.5))), zeros: `${cs(cx(1))}, ${cs(cx(1))}`, poles: cs(cx(1)) }) };
  if (k === 9) return { st: step('joukowski') };
  return { st: step('add', { c: cs(cx(1)) }) };
}
const ev = (built, z) => { for (const b of built) { z = b.f(z); if (!CX.isFin(z)) return null; } return z; };
// the largest |value| on the way: at a RAT2's value at infinity, a z whose path passes through infinity (a pole of a
// step before the RAT2) is a preimage pointPre leaves out by design, as F there is not computed
const peak = (built, z) => { let m = abs(z); for (const b of built) { z = b.f(z); if (!CX.isFin(z)) return Infinity; m = Math.max(m, abs(z)); } return m; };
const dF = (built, z) => { const h = 1e-6 * (1 + abs(z)), a = ev(built, CX.add(z, C(h, 0))), b = ev(built, sub(z, C(h, 0))); return a && b ? CX.scale(sub(a, b), 1 / (2 * h)) : null; };
// Newton on F(z) = p from a grid of seeds over |z| ≤ R and the rings beyond it: the distinct roots it converges to
function brute(built, p, R, keepAll) {
  const out = [], seeds = [];
  for (let i = 0; i <= 14; i++) for (let j = 0; j <= 14; j++) seeds.push(C(-R + (2 * R * i) / 14, -R + (2 * R * j) / 14));
  for (const rr of [2 * R, 5 * R]) for (let t = 0; t < 24; t++) seeds.push(C(rr * Math.cos((t * Math.PI) / 12), rr * Math.sin((t * Math.PI) / 12)));
  // (a root is taken once Newton's step is down to 1e-13 of it and the residual is small: near a root of multiplicity
  // m a small residual alone leaves z as far as residual^(1/m) from it; Newton converges there too, linearly)
  for (let z of seeds) {
    let ok = false;
    for (let it = 0; it < 400; it++) {
      const w = ev(built, z), d = w && dF(built, z);
      if (!w || !d || abs(d) === 0) { ok = !!w && abs(sub(w, p)) <= 1e-12 * (1 + abs(p)); break; }
      const g = sub(w, p);
      let stp = CX.div(g, d);
      if (abs(stp) > 1 + abs(z)) stp = CX.scale(stp, (1 + abs(z)) / abs(stp));
      z = sub(z, stp);
      if (!(abs(z) < 1e6)) break;
      if (abs(stp) <= 1e-13 * (1 + abs(z))) { const w2 = ev(built, z); ok = !!w2 && abs(sub(w2, p)) <= 1e-9 * (1 + abs(p)); break; }
    }
    if (ok && (keepAll || peak(built, z) < 1e6) && !out.some((q) => abs(sub(q, z)) <= 1e-6 * (1 + abs(z)))) out.push(z);
  }
  return out;
}
let bad = 0, n = 0, exact = 0;
const fail = (msg, info) => { bad++; if (bad <= 12) console.log('FAIL', msg, JSON.stringify(info).slice(0, 400)); };
for (let t = 0; t < 375; t++) {
  const kind = ['generic', 'image', 'critical', 'near', 'infinity'][t % 5];
  const depth = 1 + Math.floor(rnd() * 3), parts = Array.from({ length: depth }, () => randStep());
  // (a value at infinity: one step is a RAT2, its numerator and denominator of degree 2, so the value is p₀ / q₀)
  const ri = kind === 'infinity' ? Math.floor(rnd() * depth) : -1;
  if (ri >= 0) parts[ri] = randStep(7);
  const steps = parts.map((x) => x.st), restricts = parts.some((x) => x.restricts);
  let built;
  try { built = steps.map((s) => Funcs.build(s)); } catch (e) { continue; }
  if (built.some((b) => !b || b.error)) continue;
  const plan = Inverse.planChain(steps, built);
  // p: generic, the image of a known point, at / near a critical value of F, or the RAT2's value at infinity
  let p = cx(2), z0 = null;
  if (kind === 'image') { z0 = cx(1.5); p = ev(built, z0); }
  else if (kind === 'critical' || kind === 'near') {
    // a zero of F' (Newton on F' from a random seed): its image is a critical value
    let z = cx(1.5), zc = null;
    for (let it = 0; it < 60; it++) { const d = dF(built, z), h = 1e-4 * (1 + abs(z)), d2a = dF(built, CX.add(z, C(h, 0))), d2b = dF(built, sub(z, C(h, 0))); if (!d || !d2a || !d2b) break; const d2 = CX.scale(sub(d2a, d2b), 1 / (2 * h)); if (abs(d) < 1e-9) { zc = z; break; } if (abs(d2) === 0) break; z = sub(z, CX.div(d, d2)); if (!(abs(z) < 1e4)) break; }
    if (!zc) continue;
    p = ev(built, zc);
    if (p && kind === 'near') p = CX.add(p, CX.scale(C(Math.cos(t), Math.sin(t)), 1e-7 * (1 + abs(p))));
  } else if (kind === 'infinity') {
    const lead = (s) => +s.split(',')[0];
    p = ev(built.slice(ri + 1), C(lead(steps[ri].params.p) / lead(steps[ri].params.q), 0));
  }
  if (!p || !CX.isFin(p)) continue;
  const r = Inverse.pointPre(plan, p);
  if (!r.exact) continue;
  exact++; n++;
  const name = `#${t} ${steps.map((s) => s.type + (s.params.n != null ? s.params.n : '')).join(' → ')} at ${cs(p)} (${kind})`;
  // 1. every listed z maps to p
  const worst = Math.max(0, ...r.zs.map((z) => { const w = ev(built, z); return w ? abs(sub(w, p)) / (1 + abs(p)) : Infinity; }));
  if (!(worst <= 1e-7)) fail(`${name}: a listed z does not map to p`, { worst, zs: r.zs });
  // 2. the multiplicities
  const sum = r.mult.reduce((a, m) => a + m, 0);
  if (sum > r.total) fail(`${name}: multiplicities ${sum} over the branch product ${r.total}`, r.mult);
  if (!restricts && kind !== 'critical' && kind !== 'infinity' && sum !== r.total) fail(`${name}: multiplicities ${sum}, the branch product ${r.total}`, { mult: r.mult, zs: r.zs });
  // 3. nothing missed: Newton's roots are all listed (near a double root Newton is good to √ε of it)
  const R = Math.max(3, 2 * Math.max(0, ...r.zs.map(abs)));
  const tol = (z) => (kind === 'generic' || kind === 'image' ? 1e-6 : 1e-3) * (1 + abs(z));
  for (const z of brute(built, p, R, kind !== 'infinity')) if (!r.zs.some((q) => abs(sub(q, z)) <= tol(z))) fail(`${name}: Newton finds ${cs(z)}, not listed`, { zs: r.zs });
  // 4. a multiple preimage is a critical point (a simple one has |F′| (1 + |z|) / (1 + |p|) of order one)
  r.zs.forEach((z, i) => {
    if (r.mult[i] < 2) return;
    const d = dF(built, z), rel = d ? (abs(d) * (1 + abs(z))) / (1 + abs(p)) : 0;
    if (!(rel <= 1e-3)) fail(`${name}: ${cs(z)} listed ×${r.mult[i]}, but F′ there is not 0`, { rel, mult: r.mult });
  });
  if (z0 && !r.zs.some((q) => abs(sub(q, z0)) <= 1e-6 * (1 + abs(z0)))) fail(`${name}: the known preimage ${cs(z0)} is not listed`, { zs: r.zs });
}
console.log(bad ? `${bad} failures in ${n} exact chains` : `all ${n} exact chains agree with the brute-force solve (of 375 drawn)`);
process.exit(bad || exact < 150 ? 1 : 0);
