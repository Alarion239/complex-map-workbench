#!/usr/bin/env node
// PROOF: Listen along on route.json, with the app's own harp. src/sound.js (work/xvsea) runs in a sandbox and its
// exported Harp / harpStep / cellOf / curveAmps play the curve exactly as harpAlong does (the closed-curve seat, then
// one harpStep per sample, dt = dur / (M - 1)); the curve is sampled as app.js sndSample does (M points uniformly in
// arc length of the closed polyline, arg F tracked between samples; here F is a rational of degree 6 and the samples
// are close, so the arg step is the principal one, checked against 8 sub-steps). The crossings and their onsets
// (t0 + (j - 1 + u) dt) must equal the score: same strings, same directions, same order, onsets within 15 ms.
//   node prove.js [M]     (M: the sample count; default the route's own, ceil(128 dur))
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.resolve(__dirname, '../../../work/xvsea/src/sound.js');
const R = JSON.parse(fs.readFileSync(path.join(__dirname, 'route.json'), 'utf8'));
const { F } = require('./make.js');
const TAU = 2 * Math.PI;

// ---- src/sound.js in a sandbox (no AudioContext: the pure parts only)
const sandbox = {
  window: { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {} },
  console, Math, JSON, Object, Array, Float32Array, Float64Array, Number, String, Set, Map, Promise, Error, isFinite, encodeURIComponent, URLSearchParams,
  location: { search: '?ns=t0' }, navigator: { userActivation: { hasBeenActive: true, isActive: false } },
  document: { visibilityState: 'visible', addEventListener() {} }, performance: { now: () => 0 },
  setTimeout: () => 0, clearTimeout() {}, URL: { createObjectURL: () => 'blob:x' }, Blob: function () {},
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(SRC, 'utf8') + '\n;globalThis.Sound = Sound;', sandbox);
const Snd = sandbox.Sound;

// ---- app.js sndSample, faithfully (M samples uniformly in arc length of the closed ring)
function sample(pts, M) {
  const ring = pts.concat([pts[0]]), seg = [];
  let Lt = 0;
  for (let i = 0; i + 1 < ring.length; i++) { const l = Math.hypot(ring[i + 1][0] - ring[i][0], ring[i + 1][1] - ring[i][1]); seg.push(l); Lt += l; }
  const zs = [];
  let i = 0, acc = 0;
  for (let j = 0; j < M; j++) {
    const s = (j / (M - 1)) * Lt;
    while (i < seg.length - 1 && acc + seg[i] < s) { acc += seg[i]; i++; }
    const a = seg[i] ? Math.min(1, Math.max(0, (s - acc) / seg[i])) : 0;
    zs.push([ring[i][0] + (ring[i + 1][0] - ring[i][0]) * a, ring[i][1] + (ring[i + 1][1] - ring[i][1]) * a]);
  }
  const ang = (w) => Math.atan2(w[1], w[0]);
  const dArg = (a, b) => { let d = ang(b) - ang(a); d -= TAU * Math.round(d / TAU); return d; };
  const phi = new Float64Array(M), la = new Float64Array(M);
  let g0 = F(zs[0]), worst = 0;
  phi[0] = ang(g0) / TAU; la[0] = Math.log(Math.hypot(g0[0], g0[1]));
  for (let j = 1; j < M; j++) {
    const g1 = F(zs[j]);
    const d = dArg(g0, g1);
    // the exact step: 8 sub-steps along the chord (as Calc.argStep would bisect)
    let dd = 0, gp = g0;
    for (let q = 1; q <= 8; q++) { const z = [zs[j - 1][0] + (zs[j][0] - zs[j - 1][0]) * q / 8, zs[j - 1][1] + (zs[j][1] - zs[j - 1][1]) * q / 8], gq = F(z); dd += dArg(gp, gq); gp = gq; }
    worst = Math.max(worst, Math.abs(dd - d));
    phi[j] = phi[j - 1] + dd / TAU; la[j] = Math.log(Math.hypot(g1[0], g1[1]));
    g0 = g1;
  }
  return { zs, phi, la, Lt, worst };
}

// ---- harpAlong, faithfully (o.closed; today's velocities as harpStep computes them, and the D-only gate)
function listen(M) {
  const Sm = sample(R.pts, M), n = M, dur = R.dur, dt = dur / (n - 1), phi = Sm.phi, la = Sm.la;
  const st = Snd.Harp();
  const Wt = phi[n - 1] - phi[0], p0 = phi[n - 2] - Wt;
  st.c = Snd.cellOf(p0); st.phi = p0;
  const seat = Snd.harpStep(st, null, 0, phi[0], { dt });   // harpCross(st, p0, phi[0]): nothing may fire here
  const out = [];
  const recent = [];   // today's rule, replayed for the report (harpStep's own st.recent is the same list)
  for (let j = 1; j < n; j++) {
    const P0 = phi[j - 1], notesBefore = st.notes;
    const fired = Snd.harpStep(st, null, (j - 1) * dt, phi[j], { ln: la[j], dt });
    const dtc = Math.min(0.1, Math.max(0.008, dt)), rateT = Math.abs(phi[j] - P0) / dtc;
    for (const f of fired) {
      const at = (j - 1) * dt + f.u * dtc, jj = ((f.i % 5) + 5) % 5;
      while (recent.length && recent[0] < at - 0.5) recent.shift();
      recent.push(at);
      const rate = Math.max(recent.length / 0.5, 5 * rateT), dOnly = recent.length / 0.5 > 24;
      let vel = 0.55 + 0.3 * Math.min(1, Math.max(0, Math.log10(Math.max(rateT, 0.1) / 0.1)));
      if (rate > 2.5) vel *= Math.pow(2.5 / rate, 0.6);
      if (rate > 14) vel *= 14 / rate;
      out.push({ line: f.i, nm: ['D', 'E', 'F#', 'A', 'B'][jj], dir: f.dir, t: at, j, ln: la[j], todayVel: jj !== 0 && dOnly ? 0 : vel, todaySilent: jj !== 0 && dOnly });
    }
    void notesBefore;
  }
  return { Sm, out, seat, st, W: Math.round(Wt), Wt };
}

function prove(M) {
  const L = listen(M), sc = R.score, out = L.out;
  const errs = [];
  if (L.seat.length) errs.push('a note at the seat');
  if (out.length !== sc.length) errs.push(`count ${out.length} vs score ${sc.length}`);
  let maxDt = 0, worstK = -1, off = 0;
  for (let k = 0; k < Math.min(out.length, sc.length); k++) {
    const a = out[k], b = sc[k];
    if (k === 0) { off = a.line - b.line; if (off % 5) errs.push('the strings are shifted'); }
    if (a.line - off !== b.line || a.dir !== b.dir) { errs.push(`#${k}: played ${a.nm}${a.dir > 0 ? '↑' : '↓'} (line ${a.line}) for ${b.nm}${b.dir > 0 ? '↑' : '↓'} (line ${b.line})`); if (errs.length > 8) break; }
    const d = Math.abs(a.t - b.t); if (d > maxDt) { maxDt = d; worstK = k; }
  }
  if (maxDt > 0.015) errs.push(`onset off by ${(1000 * maxDt).toFixed(1)} ms at #${worstK}`);
  return { M, L, errs, maxDt, worstK };
}

if (require.main === module) {
  const Ms = process.argv[2] ? [+process.argv[2]] : [R.M, 900];
  const rep = {};
  for (const M of Ms) {
    const P = prove(M), L = P.L;
    const D = L.out.filter((x) => x.nm === 'D'), up = D.filter((x) => x.dir > 0).length, down = D.length - up;
    console.log(`M ${M} (dt ${(1000 * R.dur / (M - 1)).toFixed(2)} ms): ${L.out.length} crossings for ${R.score.length} in the score; ` +
      `max onset error ${(1000 * P.maxDt).toFixed(2)} ms (#${P.worstK}); arg check ${L.Sm.worst.toExponential(1)}; W ${L.Wt.toFixed(6)}; low Ds up ${up} down ${down}; ` +
      (P.errs.length ? 'FAIL: ' + P.errs.join('; ') : 'EQUAL to the score'));
    rep[M] = { M, ok: !P.errs.length, errs: P.errs, maxOnsetErrMs: +(1000 * P.maxDt).toFixed(3), W: L.W, Wexact: L.Wt, lowDsUp: up, lowDsDown: down };
    if (M === R.M) {
      // the register along the route: ln|F| at each crossing, by statement
      const sc = R.score, rows = [];
      const span = (a, b, name) => { const xs = L.out.slice(a, b).map((x) => x.ln); const lo = Math.min(...xs), hi = Math.max(...xs), mean = xs.reduce((s, x) => s + x, 0) / xs.length; rows.push({ name, lnMin: +lo.toFixed(2), lnMean: +mean.toFixed(2), lnMax: +hi.toFixed(2), centreOct: +(0.5 * Math.tanh(mean / 2.5)).toFixed(3) }); };
      const firstOf = (r) => sc.findIndex((e) => e.kind === 'main' && e.beat === 16 * r);
      const ch = sc.findIndex((e) => e.kind === 'chord');
      span(0, firstOf(1), 'statement 1 (pp, 100-137 bpm)'); span(firstOf(1), firstOf(2), 'statement 2 (mf, 137-183 bpm)'); span(firstOf(2), ch, 'statement 3 (ff, 183-250 bpm)'); span(ch, sc.length, 'the chords');
      console.table(rows);
      const amps = Snd.curveAmps(L.Sm.phi.subarray(0, M - 1), L.W);
      let best = 0; for (let i = 1; i < amps.A.length; i++) if (amps.A[i] > amps.A[best]) best = i;
      const sung = { W: L.W, n0: amps.n0, loudestHarmonic: best + 1, note: { 1: 'D3', 2: 'D4', 3: 'A4', 4: 'D5', 5: 'F#5', 6: 'A5' }[amps.n0] };
      console.log('the loop sings: W', sung.W, 'harmonic', sung.n0, 'of D3 =', sung.note, '(the loudest:', sung.loudestHarmonic + ')');
      // today's engine on this route: the velocities harpStep would give (rate rule) and the notes the D-only gate drops
      const mains = L.out.filter((x, k) => sc[k].kind === 'main');
      const v3 = [0, 1, 2].map((r) => { const xs = L.out.filter((x, k) => sc[k].kind === 'main' && Math.floor(sc[k].beat / 16) === r).map((x) => x.todayVel); return +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3); });
      const silent = L.out.filter((x) => x.todaySilent).length;
      console.log('today\'s engine (no per-example dynamics): mean main-note velocity by statement', v3, '; non-D notes the D-only gate would drop:', silent, 'of', L.out.length);
      const cuts = 0;   // a rational map: no branch cut; the route keeps clear of the zeros and the King
      const minZ = Math.min(...L.Sm.zs.map((z) => Math.hypot(z[0], z[1]))), minZero = Math.min(...L.Sm.zs.map((z) => Math.min(...[0, 1, 2, 3, 4, 5].map((k) => Math.hypot(z[0] - Math.cos(k * TAU / 6), z[1] - Math.sin(k * TAU / 6))))));
      Object.assign(rep[M], { register: rows, sung, todayMainVel: v3, todayDropped: silent, cutTicks: cuts, minDistKing: +minZ.toFixed(4), minDistTroll: +minZero.toFixed(4), meanMainVelProposed: [0, 1, 2].map((r) => { const xs = sc.filter((e) => e.kind === 'main' && Math.floor(e.beat / 16) === r).map((e) => e.vel); return +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(3); }) });
      rep.notes = L.out.map((x, k) => ({ k, kind: sc[k].kind, nm: x.nm, dir: x.dir > 0 ? 'up' : 'down', t: +x.t.toFixed(4), want: sc[k].t, errMs: +(1000 * (x.t - sc[k].t)).toFixed(2), ln: +x.ln.toFixed(3), vel: sc[k].vel, todayVel: +x.todayVel.toFixed(3), grieg: sc[k].grieg }));
      void mains;
    }
  }
  fs.writeFileSync(path.join(__dirname, 'proof.json'), JSON.stringify(rep, null, 1));
}
module.exports = { sample, listen, prove };
