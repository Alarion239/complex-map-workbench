// Emulates the GRID_FS unit-circle term in IEEE float32 (correctly rounded ops) for a 1032x1032 dpr-2 pane
const f = Math.fround;
const TAU = f(6.283185307179586), PI = f(Math.PI);
function run(s, cx = 0.6, cy = 0.8, W = 1032, H = 1032, dpr = 2) {
  const UX = f(W / 2 - cx * s * dpr), UY = f(H / 2 - cy * s * dpr), UR = f(s * dpr);
  const dashN = f(Math.max(4, 4 * Math.round(2 * Math.PI * s / 20))), dashS = f(s);
  const band = (x, c, w) => Math.min(Math.max(Math.min(x + 0.5, c + 0.5 * w) - Math.max(x - 0.5, c - 0.5 * w), 0), 1);
  let covered = 0, sumCov = 0, onLine = 0, onLineCov = 0, distinct = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const fx = x + 0.5, fy = y + 0.5;
    const dx = f(fx - UX), dy = f(fy - UY);
    const len = f(Math.sqrt(f(f(dx * dx) + f(dy * dy))));
    const r = f(len - UR);
    const covR = band(r, 0, dpr);
    // exact distance (float64)
    const ex = Math.abs(Math.hypot(fx - (W / 2 - cx * s * dpr), fy - (H / 2 - cy * s * dpr)) - s * dpr);
    let cov = 0;
    if (covR > 0) {
      const th = f(Math.atan2(dy, dx));
      const P = f(f(TAU * dashS) / dashN);
      const X = f(th * dashS);
      const u = f(X - f(P * Math.floor(f(X / P))));
      let covA = Math.min(Math.max(Math.max(Math.min(u, 2 - u), u - P) * dpr + 0.5, 0), 1);
      const q = f(PI * 0.5);
      const ad = f(Math.abs(th - Math.floor(th / q + 0.5) * q) * dashS);
      covA = Math.max(covA, Math.min(Math.max((3 - ad) * dpr + 0.5, 0), 1));
      cov = covR * covA * 0.55;
      distinct.add(u.toFixed(3));
    }
    if (cov > 0.05) covered++;
    sumCov += cov;
    if (ex < 1) { onLine++; onLineCov += cov; }
  }
  return { s, UR, covered, sumCov: +sumCov.toFixed(1), onLine, meanCovOnLine: +(onLineCov / onLine).toFixed(3), uValues: [...distinct].slice(0, 8) };
}
for (const s of [3e3, 3e4, 3e5, 3e6, 1e7, 3e7, 1e8]) console.log(JSON.stringify(run(s)));
