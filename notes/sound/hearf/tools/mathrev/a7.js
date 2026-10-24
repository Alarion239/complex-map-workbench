// the fix proposed for option 4: compress arg F's deviation from uniform turning, φ̃(s) = W s + λ (φ(s) − W s).
// The centre Σ k|b_k|² stays exactly W (the mean of φ̃′ is W); the spread shrinks by λ.
const H = process.argv[2] || require('path').resolve(__dirname, '../..');
const C = require(H + '/proto/core.js'); const TAU = 2 * Math.PI;
function spec(fn, cx, cy, r, lam, M = 1024) {
  const phi = []; let prev = null, acc = 0; const o = [0, 0];
  for (let j = 0; j <= M; j++) { const th = TAU * j / M; C.ev(fn, null, cx + r * Math.cos(th), cy + r * Math.sin(th), o); const a = Math.atan2(o[1], o[0]); if (prev !== null) { let d = a - prev; d -= TAU * Math.round(d / TAU); acc += d; } prev = a; phi.push(acc / TAU); }
  const W = Math.round(phi[M]); const out = {}; let cen = 0, e = 0;
  for (let k = -12; k <= 16; k++) { let sr = 0, si = 0; for (let j = 0; j < M; j++) { const s = j / M, p = W * s + lam * (phi[j] - W * s), th = TAU * (p - k * s); sr += Math.cos(th); si += Math.sin(th); } const v = (sr * sr + si * si) / (M * M); out[k] = v; cen += k * v; e += v; }
  let best = 0; for (const k in out) if (out[k] > (out[best] || 0)) best = +k;
  return { W, centre: +(cen / e).toFixed(3), top: best, share: Math.round(100 * out[best] / e) };
}
for (const [id, r] of [['exp', 2.4], ['exp', 4], ['exp', 5.66], ['sin', 2.83], ['sin', 5.66], ['mob', 0.71]]) {
  const fn = C.byId[id];
  console.log(id, 'r', r, 'λ=1', JSON.stringify(spec(fn, 0, 0, r, 1)), ' λ=0.35', JSON.stringify(spec(fn, 0, 0, r, 0.35)));
}
