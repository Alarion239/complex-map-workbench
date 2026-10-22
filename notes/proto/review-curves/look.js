// node look.js '<formula>' x0 x1 y0 y1 [noexact] [cx cy r]: list polylines, and the samples within r of (cx, cy)
const { Curves, W } = require('./load.js');
const [s, x0, x1, y0, y1, ex, cx, cy, r] = process.argv.slice(2);
const win = W(+x0, +x1, +y0, +y1);
const d = Curves.fromFormula(s, ex === 'noexact' ? { exact: false } : {});
const t = Curves.trace(d, win);
for (const [k, p] of t.polys.entries()) {
  const a = p.pts, n = a.length / 2;
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity, L = 0;
  for (let i = 0; i < n; i++) { minx = Math.min(minx, a[2 * i]); maxx = Math.max(maxx, a[2 * i]); miny = Math.min(miny, a[2 * i + 1]); maxy = Math.max(maxy, a[2 * i + 1]); if (i) L += Math.hypot(a[2 * i] - a[2 * i - 2], a[2 * i + 1] - a[2 * i - 1]); }
  const bb = Math.hypot(maxx - minx, maxy - miny) < 1e3 ? `bbox [${minx.toFixed(4)},${maxx.toFixed(4)}]x[${miny.toFixed(4)},${maxy.toFixed(4)}]` : 'far';
  console.log(`#${k} n=${n} closed=${p.closed} ends=${JSON.stringify(p.ends)} len=${L.toFixed(4)} ${bb} first=(${a[0].toFixed(5)},${a[1].toFixed(5)}) last=(${a[2 * n - 2].toFixed(5)},${a[2 * n - 1].toFixed(5)})`);
  if (cx !== undefined) for (let i = 0; i < n; i++) if (Math.hypot(a[2 * i] - +cx, a[2 * i + 1] - +cy) <= +r) console.log(`    [${i}] ${a[2 * i]}, ${a[2 * i + 1]}`);
}
