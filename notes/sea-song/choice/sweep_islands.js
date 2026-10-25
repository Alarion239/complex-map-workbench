'use strict';
const fs = require('fs'), vm = require('vm');
const ROOT = '<project>';
const SRC = ROOT + '/work/xvsea/src', ID = ROOT + '/notes/sea-song/islands';
global.CX = require(SRC + '/cx.js');
const Calc = require(SRC + '/calc.js');
const C = CX.C, TAU = 2 * Math.PI;
const R = JSON.parse(fs.readFileSync(ID + '/route.json', 'utf8'));
const a = C(1e-4, 0), one = C(1, 0);
const F = (z) => { const z3 = CX.mul(z, CX.mul(z, z)); return CX.mul(a, CX.div(CX.sub(CX.mul(z3, z3), one), z3)); };
const sndOk = (w) => !!w && CX.isFin(w) && (w.re !== 0 || w.im !== 0);
function sndSample(pts, M, closed) {
  const ring = closed ? pts.concat([pts[0]]) : pts, seg = []; let Lt = 0;
  for (let i = 0; i + 1 < ring.length; i++) { const l = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]); seg.push(l); Lt += l; }
  const zs = []; let i = 0, acc = 0;
  for (let j = 0; j < M; j++) { const s = (j / (M - 1)) * Lt; while (i < seg.length - 1 && acc + seg[i] < s) { acc += seg[i]; i++; } const aa = seg[i] ? Math.max(0, Math.min(1, (s - acc) / seg[i])) : 0; zs.push(C(ring[i][0] + (ring[i + 1][0] - ring[i][0]) * aa, ring[i][1] + (ring[i + 1][1] - ring[i][1]) * aa)); }
  const phi = new Float64Array(M), la = new Float64Array(M), cuts = []; let evals = 0;
  const t0 = process.hrtime.bigint();
  let g0 = F(zs[0]); phi[0] = Math.atan2(g0.im, g0.re) / TAU; la[0] = Math.log(CX.abs(g0));
  for (let j = 1; j < M; j++) { const g1 = F(zs[j]), r = Calc.argStep(F, zs[j - 1], g0, zs[j], g1, { budget: 2000 }); evals += r.evals || 0; if (!r.exact) cuts.push(r.why); phi[j] = phi[j - 1] + r.d / TAU; la[j] = sndOk(g1) ? Math.log(CX.abs(g1)) : la[j - 1]; g0 = g1; }
  return { zs, phi, la, cuts, ms: Number(process.hrtime.bigint() - t0) / 1e6, evals };
}
const SOUND = fs.readFileSync(SRC + '/sound.js', 'utf8');
const a0 = SOUND.indexOf('  const HARP_TH'), a1 = SOUND.indexOf("  // the pointer's harp (Hear the function)");
const harpSrc = SOUND.slice(a0, a1).replace('function harpNote(g, j,', 'function harpNoteEngine_unused(g, j,');
function makeHarp(record) { const ctx = { Math, Number, record, out: {} }; vm.createContext(ctx); vm.runInContext(`'use strict'; const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)); const busy=()=>{}; function harpNote(g,j,vel,t,ln,dir,sign){record({j,vel,t,ln,dir,sign});return t;} ${harpSrc} out.Harp=Harp; out.harpStep=harpStep; out.cellOf=cellOf; out.harpCross=harpCross;`, ctx); return ctx.out; }
const NAMES = ['D', 'E', 'F#', 'A', 'B'];
function run(pts, M, dur) {
  const Sm = sndSample(pts, M, true), got = [], H = makeHarp((n) => got.push(n)), st = H.Harp(), n = M, dt = dur / (n - 1), phi = Sm.phi;
  const W = phi[n - 1] - phi[0], p0 = phi[n - 2] - W; st.c = H.cellOf(p0); const seat = H.harpCross(st, p0, phi[0]); st.phi = phi[0];
  for (let j = 1; j < n; j++) H.harpStep(st, {}, (j - 1) * dt, phi[j], { ln: Sm.la[j], dt });
  const exp = R.score; let same = got.length === exp.length && !seat.length, worst = 0;
  for (let i = 0; i < Math.min(got.length, exp.length); i++) { if (NAMES[got[i].j] !== exp[i].nm || got[i].dir !== exp[i].dir) same = false; worst = Math.max(worst, Math.abs(got[i].t - exp[i].t)); }
  return { M, n: got.length, want: exp.length, same, worstMs: +(1000 * worst).toFixed(1), W: +W.toFixed(4), notExact: Sm.cuts.length, sampleMs: +Sm.ms.toFixed(1), evals: Sm.evals };
}
const dur = R.dur;
let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296 - 0.5);
const sets = { route9119: R.pts, dec4: R.pts.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]), dec5: R.pts.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]), thin3: R.pts.filter((_, i) => i % 3 === 0), jitter1e4: R.pts.map(([x, y]) => [x + 2e-4 * rnd(), y + 2e-4 * rnd()]) };
console.log('score kinds', JSON.stringify(R.score.slice(0, 3)));
for (const [k, pts] of Object.entries(sets)) for (const M of [600, 750, 900, 901, 1000, 1200, 1800, 2802]) { const r = run(pts, M, dur); console.log(k, JSON.stringify(r)); }
const Sd = sndSample(R.pts, 40000, true);
const thr = (i) => Math.floor(i / 5) + [0, 1 / 6, 1 / 3, 7 / 12, 3 / 4][((i % 5) + 5) % 5], Hh = 1 / 96;
const ph = Sd.phi; const margins = []; let minM = 1, at = 0;
for (let j = 1; j + 1 < ph.length; j++) if ((ph[j] - ph[j - 1]) * (ph[j + 1] - ph[j]) < 0) { const base = Math.floor(ph[j] * 5) - 3; let d = 1; for (let i = base; i < base + 10; i++) d = Math.min(d, Math.abs(ph[j] - (thr(i) + Hh)), Math.abs(ph[j] - (thr(i) - Hh))); margins.push(d); if (d < minM) { minM = d; at = j / (ph.length - 1) * dur; } }
margins.sort((a, b) => a - b);
console.log('dense ms', Sd.ms.toFixed(0), 'turning points', margins.length, 'min dist to a Schmitt edge deg', (minM * 360).toFixed(2), 'at t', at.toFixed(2), 'smallest 5', margins.slice(0, 5).map((x) => (x * 360).toFixed(2)).join(' '));
console.log('JSON size 4dec', JSON.stringify(sets.dec4).length, '5dec', JSON.stringify(sets.dec5).length);
