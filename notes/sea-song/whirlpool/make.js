'use strict';
// "In the Hall of the Mountain King" (Edvard Grieg, Peer Gynt, 1875; public domain): our own adaptation for the phase
// harp, drawn as ONE curve that spirals into the centre of F(z) = z^(−1+24i) so that "Listen along" plays it.
//   node make.js            -> curve.json (score, F, the example's shape, listen options)   then: node prove.js
//
// The idea. arg F = −θ + 24 ln r: the phase lines are tight logarithmic spirals. The curve goes round the centre
// clockwise, two turns a statement of the theme (4 bars), and every turn it drifts inward by e^(−π/24) while the
// melody nudges it across the phase spirals. F(λz) has the same phase as F(z) when λ = e^(−π/12) (one statement), so
// statement k+1 is statement k scaled by e^(−π/12) ≈ 0.77 about 0. Listen along plays the curve at constant speed, so a
// copy 0.77 times as long is played 1/0.77 = 1.30 times as fast: the accelerando (×2.19 over three statements) is the
// geometry itself. The branch cut is crossed once a turn: its tick is the drum on the downbeats of bars 1 and 3.
//
// How the curve is made from the score:
//  1. The score (Grieg's notes, our substitutions) becomes a walk on the harp's lines (D E F♯ A B = lines 0..4, +5 per
//     turn of arg F). A note is reached in the direction of Grieg's interval (a leap over a fifth: the shorter way);
//     every line passed is a grace note (the harp's slide); a repeated note is the same line crossed back. Each
//     statement's downbeat B is struck from above (a flam b↑ B↓) so that the C♯ substitute B↑ can lead on to D.
//  2. Beats -> seconds: tempo(t) = q0 / (1 − (t − LEAD)/τ) (exponential in beats), with q0·τ = 16/(π/12): exactly the
//     curve's shrink per statement. Every knot of the phase is placed in beats, so the phase is self-similar too.
//  3. The target phase Φ(b) (turns): a monotone cubic through a ramp across each line at its onset (slope ≥ S0 turns a
//     beat, so the 1/96-turn Schmitt band is passed within a few ms), a turning point between two crossings of a line.
//  4. Log-polar w = ln r + iθ: arg F = nθ + β ln r. The curve has constant speed V (Listen along samples it uniformly in
//     arc length): e^u |w'| = V, solved for θ(t) by RK4 (the clockwise root). V is set (bisection) so that a statement
//     is exactly two turns; KNOB (a held note's in-cell sway in bar 2 or bar 4, no crossing) so that bar 3's downbeat is
//     exactly one turn after bar 1's. Then every downbeat of bars 1 and 3 lies on one ray: the cut is put there.
//  5. The register: ln|F| = −ln r − 24 θ_p, θ_p in (c − 360°, c]. With the cut c at the angle the curve turns through
//     from bar 1 to bar 2, ln|F| is negative (low strings) in bars 1 and 3 and positive (high) in bars 2 and 4: the
//     rising phrase low, the answer high, switching on the downbeats of bars 2 and 4.
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
  1: ['B', 3],   // C♯ -> B: the tonic struck again; the rhythm and the climb D E F♯ are kept
  7: ['E', 4],   // E♯ -> E  } bar 2's first figure E D E: bar 1's F♯ D F♯ one string lower (it sinks)
  8: ['D', 4],   // C♯ -> D  }
  9: ['E', 4],   // E♯ -> E  }
  11: ['B', 3],  // C -> B: the second figure E B E sinks again, from the same E (E is Grieg's)
  14: ['B', 3],  // C♯ -> B, as in bar 1
};
const STATEMENTS = 3;
// the coda: crashing chords, each a rolled run of a whole turn landing on B: [eighths after the previous, direction]
const CODA = [[0, +1], [4, -1], [6, +1]];
let CG1 = 0;   // the first crash's offset (eighths), fitted so that its landing B is the curve's 7th crossing of the cut
const PC = { 'C': 0, 'C#': 1, 'D': 2, 'E': 4, 'E#': 5, 'F#': 6, 'A': 9, 'B': 11 };
const NAMES = ['D', 'E', 'F#', 'A', 'B'];
const midi = (nm, oc) => 12 * (oc + 1) + PC[nm];

// ---------------------------------------------------------------- the function
const N_ = +(process.env.NN || -1), BETA = +(process.env.BETA || 24);   // F(z) = z^(n + iβ)
const NREV = 2;                                                         // clockwise turns a statement
const DU = TAU * (1 + N_ * NREV) / BETA;                                // ln-shrink a statement (−π/12)

// ---------------------------------------------------------------- tempo and dynamics
const Q0 = +(process.env.Q0 || 100);              // quarter = 100 at the start
const q0 = Q0 / 60, Q0TAU = -16 / DU, TAUT = Q0TAU / q0;
const LEADB = 0.75;                                // beats before the first downbeat (the curve's first point)
let LEAD = TAUT * (Math.exp(LEADB / Q0TAU) - 1); // seconds: t(−LEADB) = 0 (set again with EPS)
// a gentle rubato inside each statement (EPS, set by the solver, a few %): warped beats W(b) = b + EPS·(8/π)(1 − cos(πb/8))
// for b < 48, so bars 1–2 take 8 + 5.09·EPS warped beats and bars 3–4 the rest; a statement stays 16 (self-similar)
let EPS = 0;
const Wb = (b) => (b < 48 ? b + EPS * (8 / Math.PI) * (1 - Math.cos(Math.PI * b / 8)) : b);
const Wd = (b) => (b < 48 ? 1 + EPS * Math.sin(Math.PI * b / 8) : 1);
const Winv = (w) => { if (w >= 48) return w; let b = w; for (let i = 0; i < 30; i++) { const d = (Wb(b) - w) / Wd(b); b -= d; if (Math.abs(d) < 1e-13) break; } return b; };
const tOfW = (w) => LEAD + TAUT * (1 - Math.exp(-w / Q0TAU));
const tOfBeat = (b) => tOfW(Wb(b));
const beatOfT = (t) => Winv(-Q0TAU * Math.log(1 - (t - LEAD) / TAUT));
const dbdt = (t) => q0 / (1 - (t - LEAD) / TAUT) / Wd(beatOfT(t));
const GB = +(process.env.GB || 0.16);               // grace spacing, beats (60 ms at the start, 23 ms at the end)
const GRUN = +(process.env.GRUN || 0.16);                                 // the coda's rolls, beats a string
const TAILB = 0.35;                                // beats after the last chord
// the per-example dynamics (PROPOSAL.md): pp -> ff over the statements, marcato downbeats; graces soft
const velMain = (b, beatInBar, len) => Math.min(1, (0.3 + 0.6 * Math.pow(Math.min(1, Math.max(0, b) / 48), 1.15)) * (beatInBar === 0 ? 1.12 : 1) * (len >= 2 ? 1.05 : 1));

const TH = [0, 1 / 6, 1 / 3, 7 / 12, 3 / 4];
const thr = (i) => Math.floor(i / 5) + TH[((i % 5) + 5) % 5];
const pcOfLine = (i) => ((i % 5) + 5) % 5;

function score() {
  const mains = [];
  let e = 0;
  for (let s = 0; s < STATEMENTS; s++) {
    GRIEG.forEach(([nm, oc, len], k) => {
      const [nm2, oc2] = SUBS[k] || [nm, oc];
      mains.push({ grieg: nm + (nm === 'E#' ? '' : '') + oc, nm: nm2, oc: oc2, midi: midi(nm2, oc2), e, len, stmt: s + 1, k });
      e += len;
    });
  }
  const notes = [];
  let c = 3;                                  // the curve starts between A (line 3) and B (line 4)
  let prev = null;
  for (const m of mains) {
    const graces = [];
    let d;
    if (m.k === 0) {                          // a statement's downbeat B: struck from above (flam b↑ then B↓)
      while (NAMES[pcOfLine(c + 1)] !== 'B') { c++; graces.push({ L: c, d: 1, nm: NAMES[pcOfLine(c)] }); }
      c++; graces.push({ L: c, d: 1, nm: 'B', flam: true });
      d = -1;
    } else if (m.midi === prev.midi) d = -prev.d;
    else {
      d = Math.sign(m.midi - prev.midi);
      if (Math.abs(m.midi - prev.midi) > 7) {
        const pass = (dd) => { let cc = c, n = 0; for (;;) { const L = dd > 0 ? cc + 1 : cc; if (NAMES[pcOfLine(L)] === m.nm) return n; n++; cc += dd; } };
        d = pass(+1) <= pass(-1) ? +1 : -1;
      }
    }
    for (;;) {
      const L = d > 0 ? c + 1 : c;
      c += d;
      if (NAMES[pcOfLine(L)] === m.nm) { m.L = L; break; }
      graces.push({ L, d, nm: NAMES[pcOfLine(L)] });
    }
    m.d = d; m.graces = graces; prev = m;
  }
  for (let i = 0; i < mains.length; i++) {
    const m = mains[i];
    m.b = m.e / 2;
    const beatInBar = (m.e % 8) / 2;
    m.vel = velMain(m.b, beatInBar, m.len);
    const before = i ? m.b - mains[i - 1].b : LEADB;
    let g = GB;
    if (m.graces.length) g = Math.min(g, 0.6 * before / m.graces.length);
    m.graces.forEach((gr, j) => { gr.b = m.b - (m.graces.length - j) * g; gr.vel = +((gr.flam ? 0.6 : 0.4) * m.vel).toFixed(3); gr.grace = true; gr.stmt = m.stmt; });
    for (const gr of m.graces) notes.push(gr);
    notes.push({ L: m.L, d: m.d, nm: m.nm, b: m.b, vel: +m.vel.toFixed(3), grieg: m.grieg, stmt: m.stmt, len: m.len, e: m.e, k: m.k });
  }
  // the coda: rolled runs of a whole turn landing on B
  let eC = e;
  const chords = [];
  CODA.forEach(([gap, dir], j) => {
    eC += gap + (j === 0 ? CG1 : 0);
    const b = eC / 2, roll = [];
    let cnt = 0;
    for (;;) {
      const L = dir > 0 ? c + 1 : c;
      c += dir;
      const nm = NAMES[pcOfLine(L)];
      roll.push({ L, d: dir, nm });
      cnt++;
      if (nm === 'B' && cnt >= 5) break;
    }
    roll.forEach((n, k) => {
      n.b = b - (roll.length - 1 - k) * GRUN;
      const main = k === roll.length - 1;
      n.vel = main ? 1 : +(0.6 + 0.3 * k / roll.length).toFixed(3);
      n.chord = j + 1; n.stmt = 4; if (!main) n.grace = true; else { n.grieg = 'chord ' + (j + 1); n.e = eC; }
      notes.push(n);
    });
    chords.push(b);
  });
  const Bend = notes[notes.length - 1].b + TAILB;
  return { mains, notes, Bend, chords, endCell: c };
}

// ---------------------------------------------------------------- the phase and the curve
const S0 = +(process.env.S0 || 0.8);       // crossing slope, turns a beat (at least)
function phaseKnots(notes, Bend, knob) {
  const lv = (n) => thr(n.L);
  const kn = [];
  const first = notes[0];
  kn.push([-LEADB, lv(first) - first.d * 0.06]);
  for (let k = 0; k < notes.length; k++) {
    const n = notes[k], p = notes[k - 1], q = notes[k + 1];
    const dPrev = p ? n.b - p.b : n.b + LEADB, dNext = q ? q.b - n.b : Bend - n.b;
    let S = S0;
    if (p && p.L !== n.L) S = Math.max(S, Math.abs(lv(n) - lv(p)) / dPrev);
    if (q && q.L !== n.L) S = Math.max(S, Math.abs(lv(q) - lv(n)) / dNext);
    const tau = Math.min(0.07, dPrev / 3, dNext / 3);
    kn.push([n.b - tau, lv(n) - n.d * S * tau]);
    kn.push([n.b, lv(n)]);
    kn.push([n.b + tau, lv(n) + n.d * S * tau]);
    if (q && q.L === n.L) {                          // a line crossed back: the turning point in the cell
      const cell = n.d > 0 ? thr(n.L + 1) - thr(n.L) : thr(n.L) - thr(n.L - 1);
      const A = Math.min(0.42 * cell, S * tau + 0.35 * S * (dNext / 2 - tau));
      kn.push([n.b + dNext / 2, lv(n) + n.d * A]);
    } else if (knob && !n.grace && n.len >= 2 && dNext > 0.6 && ((knob < 0 && n.k === 12) || (knob > 0 && n.k === 25))) {
      // the knob: a held note's sway inside its cell (no crossing), bar 2's last E (knob < 0) or bar 4's A (knob > 0)
      const cell = n.d > 0 ? thr(n.L + 1) - thr(n.L) : thr(n.L) - thr(n.L - 1);
      const A = Math.min(0.7 * cell, S * tau + Math.abs(knob) * 0.7 * cell);
      kn.push([n.b + 0.5 * dNext, lv(n) + n.d * A]);
      kn.push([n.b + dNext - Math.min(0.07, dNext / 3) - 0.02, lv(n) + n.d * (S * tau + 0.002)]);
    }
  }
  const last = notes[notes.length - 1];
  kn.push([Bend, lv(last) + last.d * 0.06]);
  kn.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < kn.length; i++) if (kn[i][0] <= kn[i - 1][0] + 1e-9) kn[i][0] = kn[i - 1][0] + 1e-6;
  return kn;
}

let DT = 0.0004;
function build(V, knob, SC) {
  SC = SC || score();
  const kn = phaseKnots(SC.notes, SC.Bend, knob);
  const Pb = pchip(kn.map((k) => k[0]), kn.map((k) => k[1]));
  const T = tOfBeat(SC.Bend);
  const Phi = (t) => Pb(beatOfT(t));
  Phi.d = (t) => Pb.d(beatOfT(t)) * dbdt(t);
  const dt = DT, M = Math.round(T / dt);
  const th = new Float64Array(M + 1); let bad = 0; const badB = [];
  const f = (tt, tht) => {
    const a = TAU * Phi.d(tt), u = (TAU * Phi(tt) - N_ * tht) / BETA, R = V * Math.exp(-u);
    const A = (N_ * N_ + BETA * BETA) / (BETA * BETA), B = -2 * a * N_ / (BETA * BETA), C = (a * a) / (BETA * BETA) - R * R;
    let disc = B * B - 4 * A * C; if (disc < 0) { bad++; badB.push(+beatOfT(tt).toFixed(2)); disc = 0; }
    return (-B - Math.sqrt(disc)) / (2 * A);       // the clockwise root
  };
  for (let i = 0; i < M; i++) {
    const tt = i * dt, y = th[i];
    const k1 = f(tt, y), k2 = f(tt + dt / 2, y + dt / 2 * k1), k3 = f(tt + dt / 2, y + dt / 2 * k2), k4 = f(tt + dt, y + dt * k3);
    th[i + 1] = y + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
  }
  const at = (t) => { const x = t / dt, i = Math.min(M - 1, Math.floor(x)); return th[i] + (th[i + 1] - th[i]) * (x - i); };
  return { SC, kn, Phi, T, dt, M, th, at, bad, badB, V, knob };
}

// V: a statement is exactly NREV clockwise turns (beat 0 -> 16); EPS: bar 3's downbeat exactly one turn after bar 1's
function setEps(e) { EPS = e; LEAD = 0; LEAD = -(tOfBeat(-LEADB) - 0); }
function fitV(SC) {
  const tb = (b) => tOfBeat(b);
  let lo = 0.3, hi = 6, V = 1, B;
  for (let it = 0; it < (DT > 0.0005 ? 34 : 52); it++) { V = Math.sqrt(lo * hi); B = build(V, 0, SC); const tt = B.at(tb(0)) - B.at(tb(16)); if (!(tt <= TAU * NREV)) hi = V; else lo = V; }
  return build(Math.sqrt(lo * hi), 0, SC);
}
function solve() {
  const SC = score();
  const half = (e) => { setEps(e); const B = fitV(SC); return { B, err: (B.at(tOfBeat(0)) - B.at(tOfBeat(8))) / TAU - 1 }; };
  DT = 0.0016;
  let a = -0.25, c = 0.25, ea = half(a).err;
  for (let it = 0; it < 16; it++) { const m = (a + c) / 2, em = half(m).err; if ((em > 0) === (ea > 0)) { a = m; ea = em; } else c = m; }
  // refine with the fine step: secant on EPS around the coarse root
  DT = 0.0004;
  let e0 = (a + c) / 2, r0 = half(e0), e1 = e0 + 0.002, r1 = half(e1);
  for (let it = 0; it < 4 && Math.abs(r1.err) > 1e-7; it++) { const e2 = e1 - r1.err * (e1 - e0) / (r1.err - r0.err); e0 = e1; r0 = r1; e1 = e2; r1 = half(e1); }
  r1.B.eps = EPS; return r1.B;
}

// place: the curve's u(t), θ(t); rotate (with the phase-keeping scale) so that bar 1's downbeat lies on the ray ψ
const PSI = +(process.env.PSI || 90);   // degrees: the downbeat ray (the drum at 12 o'clock)
const NPTS = +(process.env.NPTS || 2400);
function place() {
  let B = solve();
  // the coda: move crash 1 (by a fraction of an eighth) so that its landing B is on the cut ray (6 turns after beat 0)
  const SC0 = B.SC, fit = (g) => { CG1 = g; const b2 = build(B.V, 0, score()); const nb = b2.SC.chords[0]; return { b2, err: (b2.at(tOfBeat(0)) - b2.at(tOfBeat(nb))) / TAU - 6 }; };
  let g0 = 0, r0 = fit(0), g1 = 0.4, r1 = fit(g1);
  for (let it = 0; it < 8 && Math.abs(r1.err) > 1e-7; it++) { const g2 = g1 - r1.err * (g1 - g0) / (r1.err - r0.err); g0 = g1; r0 = r1; g1 = g2; r1 = fit(g1); }
  B = Object.assign(r1.b2, { eps: EPS, cg1: CG1 });
  const tb0 = tOfBeat(0);
  const turn12 = B.at(tb0) - B.at(tOfBeat(4));                 // clockwise angle from bar 1 to bar 2 (radians)
  // bar 1's downbeats on the ray ψ = turn12 and the cut there (θ_p in (ψ − 360°, ψ]): bar 2's downbeats then lie on the
  // ray θ = 0, where ln|F| = −ln r − 24 θ_p changes sign: bars 1 and 3 low, bars 2 and 4 high
  const psi = turn12 + KT * 0;
  const th0 = B.at(tb0), delta = psi - th0;
  const th = B.th.map((x) => x + delta);
  const us = new Float64Array(B.M + 1);
  for (let i = 0; i <= B.M; i++) us[i] = (TAU * (B.Phi(i * B.dt) + KT) - N_ * th[i]) / BETA;
  const pts = [];
  for (let k = 0; k < NPTS; k++) { const i = Math.round(k * B.M / (NPTS - 1)), r = Math.exp(us[i]); pts.push([r * Math.cos(th[i]), r * Math.sin(th[i])]); }
  return Object.assign(B, { th, us, pts, delta, turn12, psi, cutDeg: psi * 180 / Math.PI });
}
const KT = +(process.env.KT || 0);   // whole turns added to the phase: scales the picture by e^(2π KT/β) (1.30 a turn)

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
  const tb = (b) => tOfBeat(b);
  const ang = (b) => (B.at(tb(0)) - B.at(tb(b))) / TAU;
  let rmin = Infinity, rmax = 0; for (const u of B.us) { rmin = Math.min(rmin, Math.exp(u)); rmax = Math.max(rmax, Math.exp(u)); }
  const notes = B.SC.notes.map((n) => ({ note: n.nm, line: n.L, dir: n.d, beat: +n.b.toFixed(4), t: +tOfBeat(n.b).toFixed(5), vel: n.vel, grace: !!n.grace, flam: !!n.flam, grieg: n.grieg || null, stmt: n.stmt, chord: n.chord || 0 }));
  const ticks = [0, 8, 16, 24, 32, 40].map((b) => +tOfBeat(b).toFixed(5)).concat([+tOfBeat(B.SC.chords[0]).toFixed(5)]);
  const pts = B.pts.map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]);
  const alpha = `${N_}${BETA < 0 ? '-' : '+'}${Math.abs(BETA)}i`;
  const out = {
    title: 'In the Hall of the Mountain King (Grieg)',
    F: { step: { type: 'powa', params: { alpha, cut: +B.cutDeg.toFixed(4), k: 0 } }, tex: `w=z^{${N_}${BETA < 0 ? '-' : '+'}${Math.abs(BETA)}i}` },
    tempo: { q0: Q0, qEnd: +(Q0 * Math.exp(48 / Q0TAU)).toFixed(1), tauS: +TAUT.toFixed(5), lead: +LEAD.toFixed(5), eps: +EPS.toFixed(6), cg1: +CG1.toFixed(6),
      law: 'quarters/s = (q0/60)/(1 − (t − lead)/τ) in warped beats W(b) = b + eps·(8/π)(1 − cos(πb/8)), b < 48' },
    listen: { dur: +B.T.toFixed(4), vel: notes.map((n) => n.vel) },
    ticksExpected: ticks,
    curve: { n: pts.length, V: B.V, rmin, rmax, cutDeg: B.cutDeg, turnsAt: [4, 8, 16, 24, 32, 40, 48].map((b) => [b, +ang(b).toFixed(6)]), infeasible: B.bad },
    notes,
    shape: { kind: 'curve', pts },
  };
  fs.writeFileSync(path.join(__dirname, 'curve.json'), JSON.stringify(out));
  console.log(JSON.stringify({ alpha, cutDeg: B.cutDeg, T: B.T, V: B.V, eps: EPS, cg1: CG1, rmin, rmax, notes: notes.length, graces: notes.filter((n) => n.grace).length, bad: B.bad, turnsAt: out.curve.turnsAt, ticks }));
}
module.exports = { build, solve, place, score, thr, NAMES, tOfBeat, beatOfT, N_, BETA, get LEAD() { return LEAD; }, get EPS() { return EPS; }, TAUT, Q0, NREV, DU, PSI, setEps };
