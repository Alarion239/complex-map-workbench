const H = process.argv[2] || require("path").resolve(__dirname, "../..");
const C = require(H + '/proto/core.js');
const db = (x) => (20 * Math.log10(x + 1e-12)).toFixed(1);
function top(A, n = 3) { const idx = A.map((v, i) => [v, i + 1]).sort((a, b) => b[0] - a[0]).slice(0, n); const m = idx[0][0]; let e = 0; for (const v of A) e += v * v; return idx.map(([v, h]) => `h${h}:${db(v / m)}`).join(' ') + ` (${Math.round(100 * m * m / e)}%)`; }
for (const fn of C.FUNCS) {
  const D = fn.deform; const rows = []; let lastTop = null, lastW = null;
  for (let t = 0; t <= 1.0001; t += 0.01) {
    const sp = C.curveSpectrum(fn, t, C.circlePts(D.loop, 128), 256); const A = C.toAmps(sp.b, -8, 20, { centre: sp.ok ? sp.W : 0 });
    let n = 1; for (let i = 0; i < A.length; i++) if (A[i] > A[n - 1]) n = i + 1;
    const W = sp.ok ? sp.W : '?';
    if (n !== lastTop || W !== lastW) rows.push(`t=${t.toFixed(2)} W=${W} ${top(A)}`); lastTop = n; lastW = W;
  }
  console.log('DEFORM', fn.id, D.loop, '\n  ' + rows.join('\n  '));
}
