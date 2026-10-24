'use strict';
// Numbers for OPTIONS.md: spectra of F on circles and loops (exact DFT, M samples), three normalisations.
const M = 1024;
const C = (re, im = 0) => ({ re, im });
const add = (a, b) => C(a.re + b.re, a.im + b.im), sub = (a, b) => C(a.re - b.re, a.im - b.im);
const mul = (a, b) => C(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return C((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
const ab = (a) => Math.hypot(a.re, a.im), ex = (a) => C(Math.exp(a.re) * Math.cos(a.im), Math.exp(a.re) * Math.sin(a.im));
const sqrtP = (a) => { const r = Math.sqrt(ab(a)), t = Math.atan2(a.im, a.re) / 2; return C(r * Math.cos(t), r * Math.sin(t)); };
const sinc = (a) => { const e1 = ex(C(-a.im, a.re)), e2 = ex(C(a.im, -a.re)); const d = sub(e1, e2); return C(d.im / 2, -d.re / 2); };

// samples of F along a closed curve g(θ), θ = 2πj/M; mode: 'raw' | 'soft' (eps) | 'phase'
function samples(F, g, mode, eps = 0.25) {
  const s = []; for (let j = 0; j < M; j++) s.push(F(g(2 * Math.PI * j / M)));
  const rms = Math.sqrt(s.reduce((a, v) => a + ab(v) ** 2, 0) / M);
  return s.map((v) => {
    if (mode === 'raw') return C(v.re / rms, v.im / rms);
    const m = ab(v), d = mode === 'phase' ? m : Math.sqrt(m * m + (eps * rms) ** 2);
    return C(v.re / d, v.im / d);
  });
}
function dft(s, K = 24) {   // coefficients k = −K..K
  const out = new Map();
  for (let k = -K; k <= K; k++) { let re = 0, im = 0; for (let j = 0; j < M; j++) { const a = -2 * Math.PI * k * j / M; re += s[j].re * Math.cos(a) - s[j].im * Math.sin(a); im += s[j].re * Math.sin(a) + s[j].im * Math.cos(a); } out.set(k, Math.hypot(re, im) / M); }
  return out;
}
function summary(c) {
  let E = 0, Ek = 0, best = 0, bk = 0;
  for (const [k, a] of c) { E += a * a; Ek += k * a * a; if (a > best) { best = a; bk = k; } }
  const near = [-1, 0, 1].reduce((s, d) => s + (c.get(bk + d) || 0) ** 2, 0);
  const db = (k) => { const a = c.get(k) || 0; return a > 0 ? (20 * Math.log10(a / best)).toFixed(1) : '-inf'; };
  return { dom: bk, centroid: +(Ek / E).toFixed(3), domShare: +((best * best) / E * 100).toFixed(1), outside3: +((1 - near / E) * 100).toFixed(1), rel: [-3, -2, -1, 0, 1, 2, 3].map((d) => `${bk + d}:${db(bk + d)}`).join(' ') };
}
const circ = (a, r) => (t) => C(a.re + r * Math.cos(t), a.im + r * Math.sin(t));
const run = (label, F, g, modes = ['raw', 'soft', 'phase']) => { for (const m of modes) { const s = summary(dft(samples(F, g, m))); console.log(label.padEnd(44), m.padEnd(5), JSON.stringify(s)); } };

console.log('--- ring, F = z (zero at 0), ring radius r = 1, centre at distance δ ---');
for (const d of [3, 2, 1.5, 1, 0.5, 0]) run(`z, δ/r=${d}`, (z) => z, circ(C(d, 0), 1), ['raw', 'phase']);
console.log('--- ring, F = z^2, δ/r ---');
for (const d of [2, 1, 0.5, 0]) run(`z^2, δ/r=${d}`, (z) => mul(z, z), circ(C(d, 0), 1), ['raw', 'phase']);
console.log('--- ring, F = 1/z, δ/r ---');
for (const d of [5, 3, 1.5, 1.1, 0.9, 0.5, 0]) run(`1/z, δ/r=${d}`, (z) => div(C(1), z), circ(C(d, 0), 1), ['raw', 'phase']);
console.log('--- ring centred on branch point of sqrt z, and near it ---');
for (const d of [0, 0.5, 2]) run(`sqrt z, δ/r=${d}`, sqrtP, circ(C(-d, 0.0001), 1), ['raw', 'phase']);
console.log('--- ring around essential singularity e^{1/z} centre 0, radius r ---');
for (const r of [2, 1, 0.5, 0.25]) run(`e^(1/z), r=${r}`, (z) => ex(div(C(1), z)), circ(C(0, 0), r), ['raw', 'phase']);
console.log('--- loops: circle radius 1 at 0 ---');
for (const z0 of [0, 0.3, 0.6, 0.9]) run(`z - ${z0}`, (z) => sub(z, C(z0)), circ(C(0), 1));
run('(z-.5)(z+.5) circle r1', (z) => mul(sub(z, C(0.5)), add(z, C(0.5))), circ(C(0), 1));
run('z^3-1, circle r 1.5', (z) => sub(mul(z, mul(z, z)), C(1)), circ(C(0), 1.5));
run('z^3-1, circle r 1.1', (z) => sub(mul(z, mul(z, z)), C(1)), circ(C(0), 1.1));
// a hand-drawn-like loop: a wobbly bean around 0.6 (one zero of z^2-0.36 at 0.6, other at -0.6 outside)
const bean = (t) => C(0.6 + 0.5 * Math.cos(t) + 0.12 * Math.cos(2 * t + 0.7), 0.35 * Math.sin(t) + 0.08 * Math.sin(3 * t));
run('z^2-0.36 on a bean around 0.6', (z) => sub(mul(z, z), C(0.36)), bean);
// a square loop around a zero (corners)
const sq = (t) => { const u = ((t / (2 * Math.PI)) * 4) % 4, i = Math.floor(u), f = u - i; const P = [C(1, -1), C(1, 1), C(-1, 1), C(-1, -1), C(1, -1)]; return C(P[i].re + (P[i + 1].re - P[i].re) * f, P[i].im + (P[i + 1].im - P[i].im) * f); };
run('z on a square ±1', (z) => z, sq);
run('(z-.5)/(z+.5) on circle r 1 (W=0)', (z) => div(sub(z, C(0.5)), add(z, C(0.5))), circ(C(0), 1));
run('(z-.5)/(z+.5) on circle at .5 r .5 (W=1)', (z) => div(sub(z, C(0.5)), add(z, C(0.5))), circ(C(0.5), 0.5));
console.log('--- growing circle at 0: e^z and sin z ---');
for (const r of [1, 2, 4, 6]) run(`e^z r=${r}`, ex, circ(C(0), r), ['raw', 'soft', 'phase']);
for (const r of [0.5, 2, 3.5, 6.5]) run(`sin z r=${r}`, sinc, circ(C(0), r), ['raw', 'soft', 'phase']);
