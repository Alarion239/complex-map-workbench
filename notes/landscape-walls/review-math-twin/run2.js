const { FN, C, mk, hOf, muOf, H, N } = require('./twin.js');
// LAND_EDGE_VS uCutMode 2, replayed
function rule2(h, z0, z1) {
  const tol = 2e-3 * H; let hLo = h(z0), hHi = h(z1);
  if (!(Number.isFinite(hLo) && Number.isFinite(hHi)) || !(Math.abs(hHi - hLo) > tol)) return null;
  let lo = 0, hi = 1, d5 = 0, fin = true;
  for (let k = 0; k < 12; k++) { const m = (lo + hi) / 2, hm = h(C(z0.re + (z1.re - z0.re) * m, z0.im + (z1.im - z0.im) * m)); if (!Number.isFinite(hm)) { fin = false; break; } if (Math.abs(hm - hLo) >= Math.abs(hHi - hm)) { hi = m; hHi = hm; } else { lo = m; hLo = hm; } if (k === 5) d5 = Math.abs(hHi - hLo); }
  return fin && Math.abs(hHi - hLo) > 0.6 * d5 && Math.abs(hHi - hLo) > 0.02 * H ? { t: (lo + hi) / 2, d: Math.abs(hHi - hLo) } : null;
}
function scan2(name, bx, h, F, real) {
  const Z = (i, j) => C(bx.x0 + i / (N - 1) * (bx.x1 - bx.x0), bx.y0 + j / (N - 1) * (bx.y1 - bx.y0));
  let jumps = 0, fake = [], realJ = 0, missed = 0, maxMiss = 0, evals = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) for (const [di, dj] of [[1, 0], [0, 1], [1, 1]]) {
    if (i + di >= N || j + dj >= N) continue;
    const a = Z(i, j), b = Z(i + di, j + dj); const r = rule2(h, a, b); const isReal = real(a, b);
    if (Math.abs(h(b) - h(a)) > 2e-3 * H) evals++;
    if (r) { jumps++; if (!isReal) fake.push([+a.re.toFixed(4), +a.im.toFixed(4), di, dj, +(r.d / H).toFixed(3)]); else realJ++; }
    else if (isReal) { missed++; }
  }
  console.log(JSON.stringify({ name, N, jumps, real: realJ, spurious: fake.length, spuriousAt: fake.slice(0, 4), realEdgesMissed: missed, edgesBisected: evals, edgesTotal: 3 * N * N }));
}
const sym = { x0: -2, x1: 2, y0: -2, y1: 2 };
const crossesNegReal = (a, b, lim) => (a.im < 0) !== (b.im < 0) && Math.min(a.re, b.re) < -lim;   // asin's cuts |x| > 1 on the real axis
const crossesAsin = (a, b) => (a.im <= 0) !== (b.im <= 0) && (() => { const t = a.im / (a.im - b.im), x = a.re + t * (b.re - a.re); return Math.abs(x) > 1; })();
for (const [id, steps, m, real] of [
  ['asin', [{ type: 'arcsin' }], 'log', crossesAsin],
  ['asin', [{ type: 'arcsin' }], 'im', crossesAsin],
  ['asin', [{ type: 'arcsin' }], 're', crossesAsin],
  ['jouk', [{ type: 'joukowski' }], 're', () => false],
  ['jouk', [{ type: 'joukowski' }], 'log', () => false],
]) {
  const { F } = mk(steps); const mu = m === 'log' ? 1 : muOf(F, m, sym), hf = hOf(m, mu);
  scan2(`${id} ${m} symmetric box`, sym, (z) => hf(F(z)), F, real);
}
