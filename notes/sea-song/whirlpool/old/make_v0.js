'use strict';
// In the Hall of the Mountain King (Edvard Grieg, Peer Gynt, 1875; public domain), our own adaptation for the phase
// harp, drawn as ONE curve spiralling into the centre of F(z) = z^(n + iβ) so that "Listen along" plays it.
// Run: node make.js  ->  curve.json (the score, the example's step, the curve), then node prove.js.
//
// How the curve is made from the score:
//  1. The score (Grieg's notes, our substitutions) becomes a walk on the harp's lines (D E F♯ A B = lines 0..4, +5 a
//     turn of arg F). From the cell the phase is in, a note is reached in the direction of Grieg's interval (a leap over
//     a fifth: the shorter way); every line passed on the way is a written grace note (the harp's glissando), and a
//     note repeated is the same line crossed back. So the turning note of a figure is re-plucked: F♯ D F♯ is
//     F♯ (f♯ e) D (d e) F♯.
//  2. Time: beats on a hyperbolic accelerando (tempo = T0 / (1 − t/τ)); graces just before their note.
//  3. A target phase Φ(t) (turns): a monotone cubic through a brisk ramp across each line at its onset (the 1/96-turn
//     Schmitt band passed within ~10 ms), a turning point between the two crossings of a repeated note.
//  4. Log-polar w = ln r + iθ: arg F = nθ + β ln r. Listen along plays the curve uniformly in arc length, so the curve
//     has constant speed V: e^u |w'| = V, an ODE for θ(t) (the clockwise root); V by bisection for the number of turns.
//     The music sets how fast the arg must turn; the only way to afford fast notes at a constant speed is to be close
//     to 0 (|w'| = V/r), so the accelerando itself pulls the curve inward: the spiral into the mountain.
//  5. The cut ray is placed where the curve passes at the final chord (its tick is the last crash).
const fs = require('fs'), path = require('path');
const TAU = 2 * Math.PI;

// ---------------------------------------------------------------- the score
// Grieg's theme (B minor, 4/4), as he wrote it: [note, octave, eighths]
const GRIEG = [
  ['B', 3, 1], ['C#', 4, 1], ['D', 4, 1], ['E', 4, 1], ['F#', 4, 1], ['D', 4, 1], ['F#', 4, 2],
  ['E#', 4, 1], ['C#', 4, 1], ['E#', 4, 2], ['E', 4, 1], ['C', 4, 1], ['E', 4, 2],
  ['B', 3, 1], ['C#', 4, 1], ['D', 4, 1], ['E', 4, 1], ['F#', 4, 1], ['D', 4, 1], ['F#', 4, 1], ['B', 4, 1],
  ['A', 4, 1], ['F#', 4, 1], ['D', 4, 1], ['F#', 4, 1], ['A', 4, 4],
];
// our substitutions (index in GRIEG -> [note, octave]); every other note is Grieg's
const SUBS = {
  1: ['B', 3],   // C♯ -> the tonic again (a repeated B: the creep starts in place, the rhythm is kept)
  7: ['E', 4],   // E♯ -> E   } the answer's first figure: one string below bar 1's F♯ D F♯ (it sinks)
  8: ['D', 4],   // C♯ -> D   }
  9: ['E', 4],   // E♯ -> E   }
  11: ['B', 3],  // C -> B: the second figure sinks again, from the same E (E is Grieg's)
  14: ['B', 3],  // C♯ -> B, as in bar 1
};
const STATEMENTS = 3;
// the coda: three crashing chords, each a rolled run of a whole turn landing on B (the harp's own run); [eighths after
// the last statement's final A, direction]
const CODA = [[4, +1], [2, -1], [4, +1]];
const PC = { 'C': 0, 'C#': 1, 'D': 2, 'E': 4, 'E#': 5, 'F#': 6, 'A': 9, 'B': 11 };
const STR = { 'D': 0, 'E': 1, 'F#': 2, 'A': 3, 'B': 4 };
const NAMES = ['D', 'E', 'F#', 'A', 'B'];
const midi = (nm, oc) => 12 * (oc + 1) + PC[nm];

// ---------------------------------------------------------------- tempo and dynamics
const Q0 = +(process.env.Q0 || 104), Q1 = +(process.env.Q1 || 224);   // quarter = 104 -> 224 over the three statements
const BEATS = 16 * STATEMENTS;                                         // quarters
// tempo(t) = q0 / (1 − t/τ) (quarters/s): b(t) = −q0 τ ln(1 − t/τ); chosen so that tempo(t(BEATS)) = Q1
const q0 = Q0 / 60, ratio = Q1 / Q0, TAUT = BEATS / (q0 * Math.log(ratio));
const tOfBeat = (b) => TAUT * (1 - Math.exp(-b / (q0 * TAUT)));
const tempoAt = (t) => q0 / (1 - t / TAUT);
const LEAD = 0.35;                       // s before the first note
const TAIL = 1.4;                        // s after the last chord
// velocity (the per-example dynamics: see PROPOSAL.md): p -> ff over the statements, marcato downbeats
const velMain = (b, beatInBar, len) => Math.min(1, (0.36 + 0.56 * Math.pow(Math.min(1, b / BEATS), 1.25)) * (beatInBar === 0 ? 1.1 : 1) * (len >= 2 ? 1.04 : 1));

const TH = [0, 1 / 6, 1 / 3, 7 / 12, 3 / 4];
const thr = (i) => Math.floor(i / 5) + TH[((i % 5) + 5) % 5];
const pcOfLine = (i) => ((i % 5) + 5) % 5;

function score() {
  // main notes with beats (in eighths from the start)
  const mains = [];
  let e = 0;
  for (let s = 0; s < STATEMENTS; s++) {
    GRIEG.forEach(([nm, oc, len], k) => {
      const [nm2, oc2] = SUBS[k] || [nm, oc];
      mains.push({ grieg: nm + oc, nm: nm2, oc: oc2, midi: midi(nm2, oc2), e, len, stmt: s + 1, k });
      e += len;
    });
  }
  // the walk: the cell index c (the phase lies between lines c and c+1); the first B is reached from above (down)
  const notes = [];
  let c = 4;                                  // between B (line 4) and D (line 5): the first note is B, crossed down
  let prev = null;
  for (const m of mains) {
    let d;
    if (!prev) d = -1;
    else if (m.midi === prev.midi) d = -prev.d;           // a repeat: the same line back
    else {
      d = Math.sign(m.midi - prev.midi);
      if (Math.abs(m.midi - prev.midi) > 7) {              // a leap over a fifth: the shorter way round
        const pass = (dd) => { let cc = c, n = 0; for (;;) { const L = dd > 0 ? cc + 1 : cc; if (NAMES[pcOfLine(L)] === m.nm) return n; n++; cc += dd; } };
        d = pass(+1) <= pass(-1) ? +1 : -1;
      }
    }
    const graces = [];
    for (;;) {
      const L = d > 0 ? c + 1 : c;
      c += d;
      if (NAMES[pcOfLine(L)] === m.nm) { m.L = L; break; }
      graces.push({ L, d, nm: NAMES[pcOfLine(L)] });
    }
    m.d = d; m.graces = graces; prev = m;
  }
  // times
  const tE = (eighths) => LEAD + tOfBeat(eighths / 2);
  for (let i = 0; i < mains.length; i++) {
    const m = mains[i];
    m.t = tE(m.e); m.len_s = tE(m.e + m.len) - m.t;
    const beatInBar = (m.e % 8) / 2;
    m.vel = velMain(m.e / 2, beatInBar, m.len);
    const before = i ? m.t - mains[i - 1].t : LEAD;
    const eighth = tE(m.e + 1) - m.t;
    let g = Math.min(0.06, Math.max(0.032, eighth / 4));
    if (m.graces.length) g = Math.min(g, 0.6 * before / m.graces.length);
    m.graces.forEach((gr, j) => { gr.t = m.t - (m.graces.length - j) * g; gr.vel = +(0.42 * m.vel).toFixed(3); gr.grace = true; });
    for (const gr of m.graces) notes.push(gr);
    notes.push({ L: m.L, d: m.d, nm: m.nm, t: m.t, vel: +m.vel.toFixed(3), grieg: m.grieg, stmt: m.stmt, len: m.len, e: m.e });
  }
  // the coda: rolled runs of one turn landing on B
  let eC = e, last = notes[notes.length - 1];
  const chords = [];
  CODA.forEach(([gap, dir], j) => {
    eC += gap;
    const t = tE(eC), roll = [];
    // from the current cell, run in `dir` until a B is crossed after at least 4 other strings
    let cnt = 0;
    for (;;) {
      const L = dir > 0 ? c + 1 : c;
      c += dir;
      const nm = NAMES[pcOfLine(L)];
      roll.push({ L, d: dir, nm });
      cnt++;
      if (nm === 'B' && cnt >= 5) break;
    }
    const g = 0.026;
    roll.forEach((n, k) => {
      n.t = t - (roll.length - 1 - k) * g;
      const main = k === roll.length - 1;
      n.vel = main ? 1 : +(0.62 + 0.3 * k / roll.length).toFixed(3);
      n.chord = j + 1; if (!main) n.grace = true; else { n.grieg = 'chord ' + (j + 1); n.e = eC; }
      notes.push(n);
    });
    chords.push(t);
  });
  const T = notes[notes.length - 1].t + TAIL;
  return { mains, notes, T, chords, endCell: c };
}

// ---------------------------------------------------------------- the function and the curve
const N_ = +(process.env.NN || 0), BETA = +(process.env.BETA || -36);    // F(z) = z^(−36i): arg F = −36 ln r (rings), ln|F| = 36 θ
const KT = +(process.env.KT || 0);                 // whole turns added to the phase (only scales the picture)
const REV = +(process.env.REV || 4);               // clockwise turns round 0
const S0 = +(process.env.S0 || 0.9);               // crossing slope, turns/s
const NPTS = +(process.env.NPTS || 3000);
const RSTART = +(process.env.RSTART || 1.6);       // |z| at the start (n ≠ 0: sets theta0 through the similarity)
const ROT = +(process.env.ROT || 0);               // n = 0: the picture's rotation, degrees

function build(opts = {}) {
  const SC = score(), notes = SC.notes, T = SC.T;
  // ---- knots of Φ(t)
  const lv = (n) => thr(n.L) + KT;
  const kn = [];
  const first = notes[0];
  kn.push([0, lv(first) - first.d * 0.1]);
  for (let k = 0; k < notes.length; k++) {
    const n = notes[k], p = notes[k - 1], q = notes[k + 1];
    const dPrev = p ? n.t - p.t : first.t, dNext = q ? q.t - n.t : T - n.t;
    let S = S0;
    if (p && p.L !== n.L) S = Math.max(S, Math.abs(lv(n) - lv(p)) / dPrev);
    if (q && q.L !== n.L) S = Math.max(S, Math.abs(lv(q) - lv(n)) / dNext);
    const tau = Math.min(0.04, dPrev / 3, dNext / 3);
    kn.push([n.t - tau, lv(n) - n.d * S * tau]);
    kn.push([n.t, lv(n)]);
    kn.push([n.t + tau, lv(n) + n.d * S * tau]);
    if (q && q.L === n.L) {
      const cell = n.d > 0 ? thr(n.L + 1) - thr(n.L) : thr(n.L) - thr(n.L - 1);
      const A = Math.min(0.42 * cell, S * tau + 0.35 * S * (dNext / 2 - tau));
      kn.push([n.t + dNext / 2, lv(n) + n.d * A]);
    }
  }
  const last = notes[notes.length - 1];
  kn.push([T, lv(last) + last.d * 0.1]);
  kn.sort((a, b) => a[0] - b[0]);
  const Phi = pchip(kn.map((k) => k[0]), kn.map((k) => k[1]));
  // ---- constant speed: θ(t) by RK4, the clockwise root; V by bisection for REV clockwise turns
  const dt = 0.0005, M = Math.round(T / dt);
  const theta0 = opts.theta0 != null ? opts.theta0 : 0;
  const solve = (V) => {
    const th = new Float64Array(M + 1); th[0] = theta0; let bad = 0, back = 0;
    const f = (tt, tht) => {
      const ph = Phi(tt), a = TAU * Phi.d(tt), u = (TAU * ph - N_ * tht) / BETA, R = V * Math.exp(-u);
      const A = (N_ * N_ + BETA * BETA) / (BETA * BETA), B = -2 * a * N_ / (BETA * BETA), C = (a * a) / (BETA * BETA) - R * R;
      let disc = B * B - 4 * A * C; if (disc < 0) { bad++; disc = 0; }
      return (-B - Math.sqrt(disc)) / (2 * A);
    };
    for (let i = 0; i < M; i++) {
      const tt = i * dt, y = th[i];
      const k1 = f(tt, y), k2 = f(tt + dt / 2, y + dt / 2 * k1), k3 = f(tt + dt / 2, y + dt / 2 * k2), k4 = f(tt + dt, y + dt * k3);
      th[i + 1] = y + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
      if (k1 > 0) back++;
    }
    return { th, bad, back };
  };
  let lo = 0.001, hi = 200, sol;
  for (let it = 0; it < 60; it++) { const V = Math.sqrt(lo * hi); sol = solve(V); if (theta0 - sol.th[M] > TAU * REV) hi = V; else lo = V; }
  const V = Math.sqrt(lo * hi); sol = solve(V);
  const th = sol.th, us = new Float64Array(M + 1);
  for (let i = 0; i <= M; i++) us[i] = (TAU * Phi(i * dt) - N_ * th[i]) / BETA;
  return { SC, notes, T, V, sol, th, us, dt, M, Phi, kn };
}

// the similarity that keeps the melody: rotate by δ and scale by e^(−nδ/β)... in log-polar, (u, θ) -> (u − nδ/β, θ + δ)
function place() {
  const B = build({ theta0: 0 });
  // the cut: the ray through the curve at the final chord's landing (the tick is the last crash)
  const tFinal = B.SC.chords[B.SC.chords.length - 1];
  const CUT_EARLY = 0.004;
  // choose δ so that |z| at the start is RSTART:   u0 − nδ/β = ln RSTART
  // (n = 0: the rings; a rotation keeps everything, so δ = ROT turns the picture; the size is set by KT)
  const u0 = B.us[0], delta = N_ ? (u0 - Math.log(RSTART)) * BETA / N_ : ROT * Math.PI / 180;
  const th = B.th.map((x) => x + delta), us = B.us.map((x) => x - N_ * delta / BETA);
  const iCut = Math.round((tFinal - CUT_EARLY) / B.dt);
  let cutRad = th[iCut]; cutRad -= TAU * Math.floor((cutRad + Math.PI) / TAU);
  const thP = (x) => x - TAU * Math.ceil((x - cutRad) / TAU);
  const reg = (i) => N_ * us[i] - BETA * thP(th[i]);
  const pts = [];
  for (let k = 0; k < NPTS; k++) { const i = Math.round(k * B.M / (NPTS - 1)), r = Math.exp(us[i]); pts.push([+(r * Math.cos(th[i])).toFixed(6), +(r * Math.sin(th[i])).toFixed(6)]); }
  return Object.assign(B, { th, us, cutRad, cutDeg: cutRad * 180 / Math.PI, reg, pts, delta });
}

// monotone cubic Hermite (Fritsch–Carlson), with its derivative
function pchip(x, y) {
  const n = x.length, h = [], dl = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) { h.push(x[i + 1] - x[i]); dl.push((y[i + 1] - y[i]) / h[i]); }
  for (let i = 1; i < n - 1; i++) {
    if (dl[i - 1] * dl[i] <= 0) m[i] = 0;
    else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / dl[i - 1] + w2 / dl[i]); }
  }
  m[0] = dl[0]; m[n - 1] = dl[n - 2];
  const seg = (t) => { let lo = 0, hi = n - 2; while (lo < hi) { const md = (lo + hi + 1) >> 1; if (x[md] <= t) lo = md; else hi = md - 1; } return lo; };
  const f = (t) => { const i = seg(t), s = (t - x[i]) / h[i], s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h[i] * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h[i] * m[i + 1]; };
  f.d = (t) => { const i = seg(t), s = (t - x[i]) / h[i], s2 = s * s;
    return ((6 * s2 - 6 * s) * y[i] + (3 * s2 - 4 * s + 1) * h[i] * m[i] + (-6 * s2 + 6 * s) * y[i + 1] + (3 * s2 - 2 * s) * h[i] * m[i + 1]) / h[i]; };
  return f;
}

if (require.main === module) {
  const B = place();
  let rmin = Infinity, rmax = 0; for (const u of B.us) { rmin = Math.min(rmin, Math.exp(u)); rmax = Math.max(rmax, Math.exp(u)); }
  let len = 0; for (let i = 1; i < B.pts.length; i++) len += Math.hypot(B.pts[i][0] - B.pts[i - 1][0], B.pts[i][1] - B.pts[i - 1][1]);
  const alpha = `${N_}${BETA < 0 ? '-' : '+'}${Math.abs(BETA)}i`;
  const out = {
    title: 'In the Hall of the Mountain King (Grieg)',
    tempo: { q0: Q0, q1: Q1, tauS: +TAUT.toFixed(4), lead: LEAD, law: 'quarters/s = (q0/60) / (1 − (t − lead)/τ)' },
    score: B.notes.map((n) => ({ note: n.nm, line: n.L, dir: n.d, t: +n.t.toFixed(4), vel: n.vel, grace: !!n.grace, grieg: n.grieg || null, chord: n.chord || 0 })),
    F: { step: { type: 'powa', params: { alpha, cut: +B.cutDeg.toFixed(4), k: 0 } }, tex: `w=z^{${N_}${BETA < 0 ? '-' : '+'}${Math.abs(BETA)}i}` },
    listen: { dur: +B.T.toFixed(4), vel: B.notes.map((n) => n.vel) },
    curve: { kind: 'curve', n: B.pts.length, V: B.V, rmin, rmax, length: len, rev: REV, infeasible: B.sol.bad, backSteps: B.sol.back },
    pts: B.pts,
  };
  fs.writeFileSync(path.join(__dirname, 'curve.json'), JSON.stringify(out));
  const nG = B.notes.filter((n) => n.grace).length;
  console.log(JSON.stringify({ alpha, cutDeg: B.cutDeg, T: B.T, V: B.V, rmin, rmax, len, notes: B.notes.length, graces: nG, main: B.notes.length - nG, infeasible: B.sol.bad, back: B.sol.back }));
}
module.exports = { build, place, score, thr, NAMES };
