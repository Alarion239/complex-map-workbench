'use strict';
// The proof: the app's own code plays curve.json. node prove.js [src dir] -> proof.json and a summary.
//  * F: CX.pow(z, α, cut, k), the catalog's 'powa' step (src/funcs.js), from src/cx.js;
//  * the samples: app.js sndSample, copied verbatim (900 points uniform in arc length, Calc.argStep from src/calc.js,
//    a failed step with why 'jump' is a cut tick at j/899 of the duration);
//  * the harp: the source text of src/sound.js from `const HARP_TH` to the end of harpStep, evaluated as is, driven
//    as harpAlong drives it (open curve); its harpNote is replaced by a recorder (string, velocity, time, ln|F|, dir).
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.resolve(process.argv[2] || path.join(__dirname, '../../../work/xvsea/src'));
global.CX = require(path.join(SRC, 'cx.js'));
const Calc = require(path.join(SRC, 'calc.js'));
const C = CX.C || ((re, im) => ({ re, im }));
const TAU = 2 * Math.PI, DEG = Math.PI / 180;
const J = JSON.parse(fs.readFileSync(process.env.CURVE || path.join(__dirname, 'curve.json'), 'utf8'));
const P = J.F.step.params, alpha = (() => { const m = /^(-?[\d.]+)([+-][\d.]+)i$/.exec(P.alpha); return C(+m[1], +m[2]); })();
const F = (z) => CX.pow(z, alpha, P.cut * DEG, P.k);

// ---- app.js sndSample (verbatim but for `performance` and the helpers it closes over)
const sndClamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sndOk = (w) => !!w && CX.isFin(w) && (w.re !== 0 || w.im !== 0);
const performance = { now: () => 0 };
function sndSample(F, pts, closed) {
  const ring = closed ? pts.concat([pts[0]]) : pts, seg = [];
  let Lt = 0;
  for (let i = 0; i + 1 < ring.length; i++) { const l = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]); seg.push(l); Lt += l; }
  if (!(Lt > 0)) return null;
  const M = 900, zs = [];
  let i = 0, acc = 0;
  for (let j = 0; j < M; j++) {
    const s = (j / (M - 1)) * Lt;
    while (i < seg.length - 1 && acc + seg[i] < s) { acc += seg[i]; i++; }
    const a = seg[i] ? sndClamp((s - acc) / seg[i], 0, 1) : 0;
    zs.push(C(ring[i][0] + (ring[i + 1][0] - ring[i][0]) * a, ring[i][1] + (ring[i + 1][1] - ring[i][1]) * a));
  }
  const phi = new Float64Array(M), la = new Float64Array(M), cuts = [], t0 = performance.now();
  let g0 = F(zs[0]);
  if (!sndOk(g0)) return null;
  phi[0] = Math.atan2(g0.im, g0.re) / TAU; la[0] = Math.log(CX.abs(g0));
  for (let j = 1; j < M; j++) {
    const g1 = F(zs[j]), r = Calc.argStep(F, zs[j - 1], g0, zs[j], g1, { budget: 2000 });
    if (!r.exact && r.why === 'jump') cuts.push(j / (M - 1));
    phi[j] = phi[j - 1] + r.d / TAU; la[j] = sndOk(g1) ? Math.log(CX.abs(g1)) : la[j - 1];
    g0 = g1;
    if (performance.now() - t0 > 500) return null;
  }
  return { zs, phi, la, cuts };
}

// ---- the harp, from src/sound.js
const SOUND = fs.readFileSync(path.join(SRC, 'sound.js'), 'utf8');
const a0 = SOUND.indexOf('  const HARP_TH'), a1 = SOUND.indexOf('  // the pointer\'s harp (Hear the function)');
if (a0 < 0 || a1 < 0) throw new Error('harp source not found');
const harpSrc = SOUND.slice(a0, a1).replace('function harpNote(g, j,', 'function harpNoteEngine_unused(g, j,');   // the recorder below takes its place
function makeHarp(record) {
  const ctx = { Math, Number, record, out: {} };
  vm.createContext(ctx);
  vm.runInContext(`'use strict';
    const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
    const busy = () => {};
    function harpNote(g, j, vel, t, ln, dir, sign, pan, tier, tag) { record({ j, vel, t, ln, dir, sign }); return t; }
    ${harpSrc}
    out.Harp = Harp; out.harpStep = harpStep; out.thr = thr; out.HARP_H = HARP_H;`, ctx);
  return ctx.out;
}

// ---- play it as sndListen/harpAlong would, with the example's duration
const pts = J.shape.pts, dur = J.listen.dur;
const Sm = sndSample(F, pts, false);
const got = [];
const H = makeHarp((n) => got.push(n));
const n = Sm.phi.length, t0 = 0, dt = dur / Math.max(1, n - 1), st = H.Harp();
H.harpStep(st, null, t0, Sm.phi[0], {});
for (let j = 1; j < n; j++) H.harpStep(st, {}, t0 + (j - 1) * dt, Sm.phi[j], { ln: Sm.la[j], pan: 0, dt, tier: 'events', tag: 'x' });
const NAMES = ['D', 'E', 'F#', 'A', 'B'];
const ticks = Sm.cuts.map((u) => u * dur);
// what the engine counted (a dense passage drops all but the Ds: st.notes counts what sounded)
const exp = J.notes;
const rows = [];
let ok = got.length === exp.length, worst = 0, worstMain = 0;
for (let i = 0; i < Math.max(got.length, exp.length); i++) {
  const g = got[i], e = exp[i];
  const row = { i, want: e ? `${e.note}${e.dir > 0 ? '↑' : '↓'}${e.grace ? ' (grace)' : ''}` : null, got: g ? `${NAMES[g.j]}${g.dir > 0 ? '↑' : '↓'}` : null, tWant: e ? e.t : null, tGot: g ? +g.t.toFixed(4) : null };
  if (g && e) {
    row.errMs = +(1000 * (g.t - e.t)).toFixed(1);
    row.lnF = +g.ln.toFixed(2); row.register = +(0.5 * Math.tanh(g.ln / 2.5)).toFixed(3);
    row.velEngine = +g.vel.toFixed(3); row.velProposed = e.vel;
    if (NAMES[g.j] !== e.note || g.dir !== e.dir) ok = false;
    worst = Math.max(worst, Math.abs(row.errMs));
    if (!e.grace) worstMain = Math.max(worstMain, Math.abs(row.errMs));
  } else ok = false;
  rows.push(row);
}
// the ticks against the drum beats (downbeats of bars 1 and 3, crash 1)
const tickRows = J.ticksExpected.map((t, k) => ({ want: t, got: ticks[k] != null ? +ticks[k].toFixed(4) : null, errMs: ticks[k] != null ? +(1000 * (ticks[k] - t)).toFixed(1) : null }));
const reg = { low: rows.filter((r) => r.register != null && r.register < -0.25).length, mid: rows.filter((r) => r.register != null && Math.abs(r.register) <= 0.25).length, high: rows.filter((r) => r.register != null && r.register > 0.25).length };
const summary = {
  F: J.F, dur, samples: n, sampleMs: +(1000 * dt).toFixed(2),
  notes: { score: exp.length, engine: got.length, sameSequence: ok, worstOnsetMs: +worst.toFixed(1), worstMainOnsetMs: +worstMain.toFixed(1), countedByEngine: st.notes, lowDsUp: st.up, lowDsDown: st.down },
  ticks: { count: ticks.length, expected: J.ticksExpected.length, rows: tickRows, note: 'the app quantizes a tick to the sample after the crossing (' + (1000 * dt).toFixed(1) + ' ms grid)' },
  register: reg,
  lnFRange: [Math.min(...Sm.la), Math.max(...Sm.la)].map((x) => +x.toFixed(2)),
  sung: 'none: the curve is open and crosses the cut (the closed-curve note needs a closed curve with no cut)',
  turns: +(Sm.phi[n - 1] - Sm.phi[0]).toFixed(4),
};
if (!process.env.CURVE) fs.writeFileSync(path.join(__dirname, 'proof.json'), JSON.stringify({ summary, rows, phi: Array.from(Sm.phi).map((x) => +x.toFixed(6)), la: Array.from(Sm.la).map((x) => +x.toFixed(4)), cuts: Sm.cuts }, null, 0));
console.log(JSON.stringify(summary, null, 1));
const bad = rows.filter((r) => r.errMs == null || Math.abs(r.errMs) > 15 || r.want === null || r.got === null || (r.want && r.got && r.want.split(' ')[0] !== r.got));
if (bad.length) console.log('MISMATCHES', JSON.stringify(bad.slice(0, 20)));
