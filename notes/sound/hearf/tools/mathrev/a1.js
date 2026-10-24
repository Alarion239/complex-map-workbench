const H = process.argv[2] || require("path").resolve(__dirname, "../..");
const C = require(H + '/proto/core.js');
const CSS = +(process.argv[3] || 386);
const db = (x) => (20 * Math.log10(x + 1e-12)).toFixed(1);
function amps(fn, t, x, y, r) { const sp = C.ringSpectrum(fn, t, x, y, r); return C.toAmps(sp.c, -sp.M / 2, sp.M / 2 - 1, {}); }
function top(A, n = 5) { const idx = A.map((v, i) => [v, i + 1]).sort((a, b) => b[0] - a[0]).slice(0, n); const m = idx[0][0]; return idx.map(([v, h]) => `h${h}:${db(v / m)}`).join(' '); }
// 1. sweep pings & ring on sweep
for (const fn of C.FUNCS) {
  const ppu = CSS / (2 * fn.view[2]);
  const g = C.gesture(fn, 'sweep');
  const cues = []; const out = { eng: (c) => { if (c.k === 'cue' && c.parts && c.wet !== 0.18) cues.push(c); }, voice() {}, drone() {} };
  const ss = new C.Session(out, 'today', {}); ss.start(0, fn, g);
  let minD = 1e9; let turns = 0;
  for (let u = 0; u <= g.dur; u += 1 / 60) { const p = g.at(u); ss.frame(u, p, ppu); for (const z of fn.zeros.concat(fn.poles)) minD = Math.min(minD, Math.hypot(p.x - z[0], p.y - z[1]) * ppu); }
  console.log('sweep', fn.id, 'cues', cues.length, 'min px to zero/pole', minD.toFixed(1), 'phi end', ss.probe.phi.toFixed(3));
  // ring at the closest approach to each zero/pole
  const r = 20 / ppu;
  for (const z of fn.zeros.concat(fn.poles)) { if (g.at(0).y === g.at(1).y) { const y = g.at(0).y; console.log('   ring above', z, 'delta/r', ((y - z[1]) / r).toFixed(2), top(amps(fn, null, z[0], y, r))); } }
}
