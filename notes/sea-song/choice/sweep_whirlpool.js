'use strict';
// robustness sweep for whirlpool: app's sndSample (Calc.argStep) at M samples + the app's harpStep from src/sound.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = '<project>';
const SRC = ROOT + '/work/xvsea/src', WD = ROOT + '/notes/sea-song/whirlpool';
global.CX = require(SRC + '/cx.js');
const Calc = require(SRC + '/calc.js');
const C = CX.C, TAU = 2 * Math.PI, DEG = Math.PI / 180;
const J = JSON.parse(fs.readFileSync(WD + '/curve.json', 'utf8'));
const EX = JSON.parse(fs.readFileSync(WD + '/example.json', 'utf8'));
const P = J.F.step.params, m = /^(-?[\d.]+)([+-][\d.]+)i$/.exec(P.alpha), alpha = C(+m[1], +m[2]);
const F = (z) => CX.pow(z, alpha, P.cut * DEG, P.k);
const sndOk = (w) => !!w && CX.isFin(w) && (w.re !== 0 || w.im !== 0);
function sndSample(pts, M) {
  const ring = pts, seg = []; let Lt = 0;
  for (let i = 0; i + 1 < ring.length; i++) { const l = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]); seg.push(l); Lt += l; }
  const zs = []; let i = 0, acc = 0;
  for (let j = 0; j < M; j++) { const s = (j / (M - 1)) * Lt; while (i < seg.length - 1 && acc + seg[i] < s) { acc += seg[i]; i++; } const a = seg[i] ? Math.max(0, Math.min(1, (s - acc) / seg[i])) : 0; zs.push(C(ring[i][0] + (ring[i + 1][0] - ring[i][0]) * a, ring[i][1] + (ring[i + 1][1] - ring[i][1]) * a)); }
  const phi = new Float64Array(M), la = new Float64Array(M), cuts = []; let evals = 0;
  const t0 = process.hrtime.bigint();
  let g0 = F(zs[0]); phi[0] = Math.atan2(g0.im, g0.re) / TAU; la[0] = Math.log(CX.abs(g0));
  for (let j = 1; j < M; j++) { const g1 = F(zs[j]), r = Calc.argStep(F, zs[j - 1], g0, zs[j], g1, { budget: 2000 }); evals += r.evals || 0; if (!r.exact && r.why === 'jump') cuts.push(j / (M - 1)); if (!r.exact && r.why !== 'jump') cuts.push('BAD:' + r.why); phi[j] = phi[j - 1] + r.d / TAU; la[j] = sndOk(g1) ? Math.log(CX.abs(g1)) : la[j - 1]; g0 = g1; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { zs, phi, la, cuts, ms, evals };
}
const SOUND = fs.readFileSync(SRC + '/sound.js', 'utf8');
const a0 = SOUND.indexOf('  const HARP_TH'), a1 = SOUND.indexOf("  // the pointer's harp (Hear the function)");
const harpSrc = SOUND.slice(a0, a1).replace('function harpNote(g, j,', 'function harpNoteEngine_unused(g, j,');
function makeHarp(record) { const ctx = { Math, Number, record, out: {} }; vm.createContext(ctx); vm.runInContext(`'use strict'; const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)); const busy=()=>{}; function harpNote(g,j,vel,t,ln,dir,sign){record({j,vel,t,ln,dir,sign});return t;} ${harpSrc} out.Harp=Harp; out.harpStep=harpStep;`, ctx); return ctx.out; }
const NAMES = ['D', 'E', 'F#', 'A', 'B'];
function run(pts, M, dur) {
  const Sm = sndSample(pts, M), got = [], H = makeHarp((n) => got.push(n)), st = H.Harp(), n = M, dt = dur / (n - 1);
  H.harpStep(st, null, 0, Sm.phi[0], {});
  for (let j = 1; j < n; j++) H.harpStep(st, {}, (j - 1) * dt, Sm.phi[j], { ln: Sm.la[j], dt });
  const exp = J.notes; let same = got.length === exp.length, worst = 0;
  for (let i = 0; i < Math.min(got.length, exp.length); i++) { if (NAMES[got[i].j] !== exp[i].note || got[i].dir !== exp[i].dir) same = false; worst = Math.max(worst, Math.abs(got[i].t - exp[i].t)); }
  const tick = Sm.cuts.map((u) => typeof u === 'number' ? +(u * dur).toFixed(3) : u);
  return { M, n: got.length, want: exp.length, same, worstMs: +(1000 * worst).toFixed(1), ticks: tick.length, tickList: tick.join(','), sampleMs: +Sm.ms.toFixed(1), evals: Sm.evals };
}
const dur = J.listen.dur;
const sets = { curve2400: J.shape.pts, example1200: EX.shapes[0].pts };
// perturbed: jitter every point by up to 2e-4 (seeded)
let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296 - 0.5);
sets.example_jitter2e4 = EX.shapes[0].pts.map(([x, y]) => [x + 4e-4 * rnd(), y + 4e-4 * rnd()]);
sets.example_3dec = EX.shapes[0].pts.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]);
for (const [k, pts] of Object.entries(sets)) for (const M of [600, 750, 900, 901, 1000, 1200, 1800, 3600]) { const r = run(pts, M, dur); console.log(k, JSON.stringify(r).replace(/"tickList":"[^"]*",/, '')); }
// margins: dense phase along curve2400, at each turning point of the walk: how far past the line's Schmitt edge the phase reaches
const Sd = sndSample(J.shape.pts, 40000);
console.log('dense sample ms', Sd.ms.toFixed(0));
const thr = (i) => Math.floor(i / 5) + [0, 1 / 6, 1 / 3, 7 / 12, 3 / 4][((i % 5) + 5) % 5], Hh = 1 / 96;
// local extrema of phi; for each, distance from the extremum to the nearest Schmitt edge (thr±H) of any line
const ph = Sd.phi; let minMargin = 1, worstAt = -1; const margins = [];
for (let j = 1; j + 1 < ph.length; j++) {
  if ((ph[j] - ph[j - 1]) * (ph[j + 1] - ph[j]) < 0) {
    // nearest edge distance
    const base = Math.floor(ph[j] * 5) - 3; let d = 1;
    for (let i = base; i < base + 10; i++) { d = Math.min(d, Math.abs(ph[j] - (thr(i) + Hh)), Math.abs(ph[j] - (thr(i) - Hh))); }
    margins.push(d); if (d < minMargin) { minMargin = d; worstAt = j / (ph.length - 1) * dur; }
  }
}
margins.sort((a, b) => a - b);
console.log('turning points', margins.length, 'min distance of a turn from a Schmitt edge (turns)', minMargin.toFixed(5), '(deg', (minMargin * 360).toFixed(2) + ') at t', worstAt.toFixed(2), 'smallest 5', margins.slice(0, 5).map((x) => (x * 360).toFixed(2)).join(' '));
