'use strict';
// A melody on a curve for the phase harp (notes/sea-song/README.md, round 2: notes/sea-song/r2/AS-BUILT.md). In: a
// melody file (tools/melodies/*.json: the composer's notes as written, the form, the tempo, the dynamics,
// F = z^(n + iβ)). Out: the example's curve and its Listen along data (src/seasong.js) and the score the node test
// checks it against (test/fixtures/seasong_score.json).
//   node tools/melody_curve.js [tools/melodies/mountain-king.json] [--dry]
// Then: node test/t_seasong.js (the app's own sampling and harp play the curve: every written note in order, on time,
// nothing else).
//
// The piece has its own strings: lines of the Phase key (line s at arg F = 30°·s plucks D + s semitones), exactly the
// pitch classes the score uses (here B, C, C♯, D, E, E♯, F♯, A: lines 9, 10, 11, 0, 2, 3, 4, 7), so every note sounds as
// written and nothing is substituted. The harp (src/sound.js) plucks a line's string each time the unwrapped arg F
// along the curve crosses it; in a piece only the written notes sound: every other crossing (a line passed on the way
// to a note, a line crossed back at a turn) has velocity 0 and takes no string. Each written note sounds at its written
// pitch (listen.note, MIDI, with the score's tuning) on one string, its 2nd partial the soft octave (listen.dbl); the
// theme keeps one note ringing, the coda's chords four (listen.cap, notes/sea-song/r2/ledger.json).
//
// How the curve is made:
//  1. The score becomes a walk on the lines (+ lines.length per turn of arg F = an octave). A note is reached in the
//     direction of the composer's interval (a leap over a fifth: the shorter way); the lines passed are silent.
//  2. Beats -> seconds: tempo(t) = q0 / (1 − (t − lead)/τ), exponential in beats, with the ratio per statement fixed
//     by F: one statement is turnsPerStatement clockwise turns, and the next statement is the same path scaled by
//     λ = e^(2π(1 + n·turns)/β) about 0. Listen along plays the curve at constant speed, so the copy λ times as long
//     plays 1/λ times as fast: the accelerando is the geometry.
//  3. The target phase Φ(b) (turns): a monotone cubic through a ramp across each written note's line at its onset
//     (slope ≥ crossSlope turns a beat, so the 1/96-turn Schmitt band is passed within a few ms), and a turning point,
//     short of the next line, where the melody turns. The silent crossings fall where the phase passes their lines.
//  4. Log-polar w = ln r + iθ: arg F = nθ + β ln r. Constant speed V (Listen along samples uniformly in arc length):
//     e^u |w′| = V, solved for θ(t) by RK4 (the clockwise root). V is set so that a statement is exactly
//     turnsPerStatement turns.
//  5. A clean spiral: with n = −2 and one turn a statement, each turn is the one before scaled by λ (and θ always turns
//     clockwise), so every turn lies strictly inside the one before: the curve never crosses itself. The branch cut is
//     put on the ray of bar 1's downbeat: the curve crosses it once a turn, and its tick is the drum.
const fs = require('fs'), path = require('path');
const TAU = 2 * Math.PI;
const ROOT = path.join(__dirname, '..');
const argv = require.main === module ? process.argv.slice(2) : [];
const MEL = argv.find((a) => !a.startsWith('--')) || path.join(__dirname, 'melodies', 'mountain-king.json');
const cfg = JSON.parse(fs.readFileSync(MEL, 'utf8'));

// ---------------------------------------------------------------- the score and the piece's own lines
const THEME = cfg.theme;
const STATEMENTS = cfg.statements;
const CODA = cfg.coda || [];
const PC = { 'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'E#': 5, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11 };
const midi = (nm, oc) => 12 * (oc + 1) + PC[nm];
const semi = (nm) => (PC[nm] - 2 + 12) % 12;   // the Phase key's line: semitones above D
const CHORD = (cfg.codaChord || []).slice();
// the lines: every pitch class the theme and the coda's chord use, named as the score spells them
const LN = new Map();
for (const [nm] of THEME) if (!LN.has(semi(nm))) LN.set(semi(nm), nm);
for (const nm of CHORD) if (!LN.has(semi(nm))) LN.set(semi(nm), nm);
const LINES = [...LN.keys()].sort((a, b) => a - b), NL = LINES.length;
const NAMES = LINES.map((s) => LN.get(s));
const SB = THEME.reduce((a, n) => a + n[2], 0) / 2;   // beats a statement (16)
const END = STATEMENTS * SB;                          // the statements' end, in beats (48)
let CG1 = 0;   // the first crash's offset (eighths), fitted so that its landing note is on the cut ray

// ---------------------------------------------------------------- the function
const N_ = cfg.F.n, BETA = cfg.F.beta, NREV = cfg.F.turnsPerStatement;
const DU = TAU * (1 + N_ * NREV) / BETA;                 // ln-shrink a statement (−π/12 for n = −2, β = 24, 1 turn)

// ---------------------------------------------------------------- tempo and dynamics
const Q0 = cfg.tempo.q0;
const q0 = Q0 / 60, Q0TAU = -SB / DU, TAUT = Q0TAU / q0;
const LEADB = cfg.tempo.leadBeats;
let LEAD = TAUT * (Math.exp(LEADB / Q0TAU) - 1);
// (the coda broadens: after the last statement each beat is codaSlow times as long as at its end, an allargando for
// the crashes; a rolled chord then turns arg F no faster than the curve allows)
const SLOW = cfg.tempo.codaSlow || 1, CB = cfg.tempo.codaFrom == null ? END : cfg.tempo.codaFrom;   // (from beat CB on)
const tE = (b) => LEAD + TAUT * (1 - Math.exp(-b / Q0TAU));
const tOfB = (b) => (b <= CB ? tE(b) : tE(CB) + (b - CB) * SLOW * Math.exp(-CB / Q0TAU) / q0);
const tOfBeat = tOfB;
const beatOfT = (t) => { const t1 = tE(CB); return t <= t1 ? -Q0TAU * Math.log(1 - (t - LEAD) / TAUT) : CB + (t - t1) * q0 / (SLOW * Math.exp(-CB / Q0TAU)); };
const dbdt = (t) => (t <= tE(CB) ? q0 / (1 - (t - LEAD) / TAUT) : q0 / (SLOW * Math.exp(-CB / Q0TAU)));
LEAD = 0; LEAD = -tOfB(-LEADB);   // the curve starts at t = 0, LEADB beats before the first note
const GRUN = cfg.rollBeats, TAILB = cfg.tempo.tailBeats;
const DY = cfg.dynamics;
const velMain = (b, beatInBar, len) => Math.min(1, (DY.from + (DY.to - DY.from) * Math.pow(Math.min(1, Math.max(0, b) / END), DY.power)) * (beatInBar === 0 ? DY.downbeat : 1) * (len >= 2 ? DY.long : 1));

const thr = (i) => Math.floor(i / NL) + LINES[((i % NL) + NL) % NL] / 12;
const nameOf = (i) => NAMES[((i % NL) + NL) % NL];
const pcOf = (i) => LINES[((i % NL) + NL) % NL];
const H = 1 / 96;   // the harp's Schmitt band (src/sound.js HARP_H)

function score() {
  const mains = [];
  let e = 0;
  for (let s = 0; s < STATEMENTS; s++) {
    THEME.forEach(([nm, oc, len], k) => { mains.push({ orig: nm + oc, nm, midi: midi(nm, oc), e, len, stmt: s + 1, k }); e += len; });
  }
  // where the melody turns (a note above or below both its neighbours), the phase turns just past that note's line:
  // after the note (the note crossed on the way out, its line crossed back silently) or before it (its line passed
  // silently, the note crossed on the way back). Each turn costs the phase 2·TURN more travel in one of the two gaps
  // around the note; the choice (a small dynamic programme) evens out the phase speed, gap by gap, so the curve bends
  // gently: the sum over the gaps of (travel / beats)².
  const dirs = [1], dist = [0];
  for (let i = 1; i < mains.length; i++) {
    const dm = mains[i].midi - mains[i - 1].midi;
    if (Math.abs(dm) > 7) { dirs.push(dm > 0 ? -1 : 1); dist.push(12 - Math.abs(dm)); } else { dirs.push(dm ? Math.sign(dm) : -dirs[i - 1]); dist.push(Math.abs(dm)); }
  }
  const ext = mains.map((m, i) => i > 0 && i < mains.length - 1 && dirs[i + 1] !== dirs[i]);
  const gapCost = (i, turns) => { const G = (mains[i + 1].e - mains[i].e) / 2, T = dist[i + 1] / 12 + 2 * TURN * turns; return (T / G) * (T / G); };
  // DP over one statement's notes (and the next statement's first), the same choice in every statement, so the
  // statements stay exact copies of each other (the spiral's self-similarity); state: does note i turn after itself?
  const NT = THEME.length, NI = Math.min(mains.length, NT + 1);
  const cost = [[0, Infinity]], from = [[0, 0]];
  for (let i = 1; i < NI; i++) {
    cost.push([Infinity, Infinity]); from.push([0, 0]);
    for (let a = 0; a < 2; a++) {            // note i turns after (a = 1) or not
      if (a && !ext[i]) continue;
      for (let pa = 0; pa < 2; pa++) {       // note i − 1 turned after (into gap i − 1)
        if (cost[i - 1][pa] === Infinity) continue;
        const before = ext[i] && !a ? 1 : 0;
        const c2 = cost[i - 1][pa] + gapCost(i - 1, pa + before);
        if (c2 < cost[i][a]) { cost[i][a] = c2; from[i][a] = pa; }
      }
    }
  }
  let st = cost[NI - 1][0] <= cost[NI - 1][1] ? 0 : 1;
  const tb = new Array(NT + 1).fill(false);
  for (let i = NI - 1; i > 0; i--) { tb[i] = ext[i] && !st; st = from[i][st]; }
  mains.forEach((m, i) => { m.turnBefore = ext[i] && tb[i % NT]; });
  // the walk: every crossing in order; the written notes sound, the lines passed on the way are silent
  const cross = [];
  let c = LINES.indexOf(semi(mains[0].nm)) - 1;   // the curve starts just below the first note's line
  let prev = null;
  for (const m of mains) {
    let d;
    if (!prev) d = 1;
    else if (m.midi === prev.midi) d = -prev.d;
    else {
      d = Math.sign(m.midi - prev.midi);
      if (Math.abs(m.midi - prev.midi) > 7) {
        const pass = (dd) => { let cc = c, n = 0; for (;;) { const L = dd > 0 ? cc + 1 : cc; if (pcOf(L) === semi(m.nm)) return n; n++; cc += dd; } };
        d = pass(+1) <= pass(-1) ? +1 : -1;
      }
    }
    for (;;) {
      const L = d > 0 ? c + 1 : c;
      c += d;
      if (pcOf(L) === semi(m.nm)) { m.L = L; break; }
      cross.push({ L, d, nm: nameOf(L), silent: true, stmt: m.stmt });
    }
    if (m.turnBefore) {                         // its line passed silently, then crossed back: the note
      cross.push({ L: m.L, d, nm: m.nm, silent: true, stmt: m.stmt });
      d = -d; c += d;
    }
    m.d = d; prev = m;
    m.b = m.e / 2;
    m.vel = +velMain(m.b, (m.e % 8) / 2, m.len).toFixed(3);
    cross.push(Object.assign(m, { L: m.L, d, nm: m.nm, main: true }));
  }
  // the coda: rolled chords of a whole turn ending on the theme's first note; the chord's notes sound (each roll
  // rising or falling through them, the last one in octave landOct), the other lines are silent
  const home = semi(mains[0].nm);
  let eC = e;
  const chords = [];
  CODA.forEach(([gap, dir, landOct], j) => {
    eC += gap + (j === 0 ? CG1 : 0);
    const b = eC / 2, roll = [];
    let cnt = 0;
    for (;;) {
      const L = dir > 0 ? c + 1 : c;
      c += dir;
      roll.push({ L, d: dir, nm: nameOf(L) });
      cnt++;
      if (pcOf(L) === home && cnt >= NL) break;
    }
    const land = midi(nameOf(roll[roll.length - 1].L), landOct);
    const sounding = roll.filter((n) => CHORD.some((nm) => semi(nm) === pcOf(n.L)));
    // the crash: its first note on the beat (chord 1's on the cut: the drum), the others rolled after it, GRUN apart
    sounding.forEach((n, k) => {
      n.b = b + k * GRUN;
      // the written pitch: the landing note, minus the phase between them (the roll's own direction)
      n.midi = land - Math.round(12 * (thr(roll[roll.length - 1].L) - thr(n.L)));
      n.vel = k === 0 ? DY.land : +(DY.roll[1] - (DY.roll[1] - DY.roll[0]) * (k - 1) / Math.max(1, sounding.length - 2)).toFixed(3);
      n.chord = j + 1; n.coda = true; n.stmt = STATEMENTS + 1;
      if (k === 0) { n.orig = 'chord ' + (j + 1); n.e = eC; n.main = true; }
    });
    for (const n of roll) { if (!sounding.includes(n)) { n.silent = true; n.stmt = STATEMENTS + 1; } cross.push(n); }
    chords.push(b);
  });
  const sound = cross.filter((n) => !n.silent);
  const Bend = sound[sound.length - 1].b + TAILB;
  return { mains, cross, sound, Bend, chords, endCell: c };
}

// ---------------------------------------------------------------- the phase and the curve
const S0 = cfg.crossSlope;       // crossing slope at a written note, turns a beat (at least)
const TURN = cfg.turnPast || 0.06;   // how far a turn goes past the line it turns at, turns (the Schmitt band is 1/96)
// the phase: a cubic Hermite through knots [beat, turns, slope]. Each sounding note is a knot on its line with slope
// d·S (S ≥ crossSlope, so the Schmitt band is passed within a few ms). Where the melody turns, a knot with slope 0
// TURN past the furthest line the phase reaches between the two notes (its own line, or the next note's line passed
// silently), timed so that both cubics stay monotone and the turn takes as long as it can (a gentle bend); spare time
// is spent flat at the top. Between notes in one direction a gap too long for a monotone cubic gets two ramp knots
// and a straight middle. So the phase passes every line between two notes exactly once, in order.
function phaseKnots(SC) {
  const N = SC.sound, kn = [];
  const y = (n) => thr(n.L);
  const past = (L, d) => Math.abs(thr(d > 0 ? L + 1 : L - 1) - thr(L));   // the cell past line L, going d
  const idx = N.map((n) => SC.cross.indexOf(n));
  // a turn between notes k and k + 1: the furthest line reached, and the top TURN past it (≤ 42 % of the cell beyond)
  const far = N.map((n, k) => {
    const q = N[k + 1];
    if (!q || (q.d === n.d && q.L !== n.L)) return null;
    let L = n.L;
    for (let i = idx[k] + 1; i < idx[k + 1]; i++) if (SC.cross[i].d === n.d) L = SC.cross[i].L;
    return { L, top: thr(L) + n.d * Math.min(0.42 * past(L, n.d), TURN) };
  });
  // each note's slope: crossSlope, or the pace of a quick run through it (the secants to same-direction neighbours)
  const sec = (a, b) => Math.abs(y(b) - y(a)) / (b.b - a.b);
  const S = N.map((n, k) => {
    let v = S0;
    const p = N[k - 1], q = N[k + 1];
    if (p && !far[k - 1]) v = Math.max(v, 0.8 * sec(p, n));
    if (q && !far[k]) v = Math.max(v, 0.8 * sec(n, q));
    return v;
  });
  // a monotone stretch from [b0, y0, m0] to [b1, y1, m1] (|m| magnitudes along the travel): direct if both slopes are
  // within 3× the secant, else with two ramp knots and a straight middle
  const run = (b0, y0, m0, b1, y1, m1) => {
    const D = Math.abs(y1 - y0), h = b1 - b0, sg = Math.sign(y1 - y0) || 1, sc = D / h;
    if (m0 <= 3 * sc && m1 <= 3 * sc) return;
    // (each ramp eases from the note's slope to the middle's at an even pace: 2·e/(m + middle), as long as a monotone
    // cubic allows)
    const e0 = Math.min(0.4 * D, m0 * h / 3), e1 = Math.min(0.4 * D, m1 * h / 3), mEst = (D - e0 - e1) / h;
    const h0 = m0 > 0 ? Math.min(0.95 * 3 * e0 / m0, 2 * e0 / (m0 + mEst)) : 0, h1 = m1 > 0 ? Math.min(0.95 * 3 * e1 / m1, 2 * e1 / (m1 + mEst)) : 0;
    const mid = (D - e0 - e1) / Math.max(1e-9, h - h0 - h1);
    if (h0 > 0) kn.push([b0 + h0, y0 + sg * e0, sg * mid]);
    if (h1 > 0) kn.push([b1 - h1, y1 - sg * e1, sg * mid]);
  };
  const first = N[0], last = N[N.length - 1];
  const y0 = y(first) - first.d * Math.min(0.1, 0.6 * Math.abs(y(first) - thr(first.L - first.d)));
  kn.push([-LEADB, y0, 0]);
  run(-LEADB, y0, 0, first.b, y(first), S[0]);
  N.forEach((n, k) => {
    kn.push([n.b, y(n), n.d * S[k]]);
    const q = N[k + 1];
    if (!q) return;
    const f = far[k];
    if (!f) { run(n.b, y(n), S[k], q.b, y(q), S[k + 1]); return; }
    // the turn: segment 1 note → top, segment 2 top → next note; each monotone needs its duration ≤ 3·travel/slope
    const D1 = Math.abs(f.top - y(n)), D2 = Math.abs(f.top - y(q)), gap = q.b - n.b;
    // (each side's natural time, at an even deceleration, is 2·travel/slope; the side with less to travel, the turn
    // itself, gets its own first, so the bend is gentle; spare time is spent flat at the top)
    const h1m = 0.95 * 3 * D1 / S[k], h2m = 0.95 * 3 * D2 / S[k + 1];
    const n1 = Math.min(h1m, 2 * D1 / S[k]), n2 = Math.min(h2m, 2 * D2 / S[k + 1]);
    let h1, h2;
    if (n1 + n2 <= gap) { h1 = n1; h2 = n2; }
    else if (D2 <= D1) { h2 = Math.min(n2, 0.5 * gap); h1 = gap - h2; if (h1 > h1m) { h1 = h1m; h2 = gap - h1; } }
    else { h1 = Math.min(n1, 0.5 * gap); h2 = gap - h1; if (h2 > h2m) { h2 = h2m; h1 = gap - h2; } }
    if (h1 > h1m + 1e-9 || h2 > h2m + 1e-9) throw new Error('no monotone turn between beats ' + n.b + ' and ' + q.b);
    kn.push([n.b + h1, f.top, 0]);
    if (gap - h1 - h2 > 1e-6) kn.push([q.b - h2, f.top, 0]);
  });
  const yE = y(last) + last.d * Math.min(0.06, 0.5 * past(last.L, last.d));
  run(last.b, y(last), S[N.length - 1], SC.Bend, yE, 0);
  kn.push([SC.Bend, yE, 0]);
  kn.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < kn.length; i++) if (kn[i][0] <= kn[i - 1][0] + 1e-9) throw new Error('phase knots out of order at beat ' + kn[i][0]);
  return kn;
}

let DT = 0.0004;
let DBG = null;
// θ(t): statement 1 (with the lead-in) by RK4; statements 2 … by exact self-similarity (statement 1 turned NREV turns
// clockwise: the same path scaled by λ, played λ times as fast; integrating on would drift off it, as the solution is
// unstable: a turn that lags is larger, so slower); the coda by RK4 from where the coda's tempo starts (codaFrom)
function build(V, SC, only1) {
  SC = SC || score();
  const kn = phaseKnots(SC);
  const Pb = hermite(kn);
  const T = tOfB(SC.Bend);
  const Phi = (t) => Pb(beatOfT(t));
  Phi.d = (t) => Pb.d(beatOfT(t)) * dbdt(t);
  const dt = DT, M = Math.round(T / dt);
  const th = new Float64Array(M + 1); let bad = 0;
  const f = (tt, tht) => {
    const a = TAU * Phi.d(tt), u = (TAU * Phi(tt) - N_ * tht) / BETA, R = V * Math.exp(-u);
    const A = (N_ * N_ + BETA * BETA) / (BETA * BETA), B = -2 * a * N_ / (BETA * BETA), C = (a * a) / (BETA * BETA) - R * R;
    let disc = B * B - 4 * A * C; if (disc < 0) { bad++; disc = 0; if (DBG) DBG.add(+beatOfT(tt).toFixed(1)); }
    return (-B - Math.sqrt(disc)) / (2 * A);       // the clockwise root
  };
  const rk = (i) => {
    const tt = i * dt, yv = th[i];
    const k1 = f(tt, yv), k2 = f(tt + dt / 2, yv + dt / 2 * k1), k3 = f(tt + dt / 2, yv + dt / 2 * k2), k4 = f(tt + dt, yv + dt * k3);
    th[i + 1] = yv + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4);
  };
  const iS = Math.min(M, Math.ceil(tOfB(SB) / dt) + 2);
  for (let i = 0; i < iS; i++) rk(i);
  const at1 = (t) => { const x = t / dt, i = Math.min(iS - 1, Math.floor(x)); return th[i] + (th[i + 1] - th[i]) * (x - i); };
  if (!only1) {
    const iE = Math.min(M, Math.floor(tOfB(Math.min(CB, END)) / dt));
    for (let i = iS - 1; i <= iE; i++) {
      const b = beatOfT(i * dt), k = Math.floor(b / SB + 1e-12);
      if (k < 1) continue;
      th[i] = at1(tOfB(b - k * SB)) - TAU * NREV * k;
    }
    for (let i = iE; i < M; i++) rk(i);
  }
  const at = (t) => { const x = t / dt, i = Math.min(M - 1, Math.floor(x)); return th[i] + (th[i + 1] - th[i]) * (x - i); };
  return { SC, kn, Pb, Phi, T, dt, M, th, at, at1, bad, V };
}

// V: a statement is exactly NREV clockwise turns
function fitV(SC) {
  let lo = 0.3, hi = 6;
  for (let it = 0; it < 52; it++) { const V = Math.sqrt(lo * hi), B = build(V, SC, true), tt = B.at1(tOfB(0)) - B.at1(tOfB(SB)); if (!(tt <= TAU * NREV)) hi = V; else lo = V; }
  return build(Math.sqrt(lo * hi), SC);
}

// place: rotate (the phase-keeping rotation: the curve is scaled by e^(−n δ / β) as it turns by δ) so that bar 1's
// downbeats lie on the cut
const NPTS = 2400;
function place() {
  let B = fitV(score());
  if (cfg.codaFirstOnCut && CODA.length) {
    // the first crash moved (by a fraction of an eighth) so that its landing note is on the cut ray
    const fit = (g) => { CG1 = g; const b2 = build(B.V, score()); const nb = b2.SC.chords[0]; return { b2, err: (b2.at(tOfB(0)) - b2.at(tOfB(nb))) / TAU - STATEMENTS * NREV }; };
    let g0 = 0, r0 = fit(0), g1 = 0.4, r1 = fit(g1);
    for (let it = 0; it < 8 && Math.abs(r1.err) > 1e-7; it++) { const g2 = g1 - r1.err * (g1 - g0) / (r1.err - r0.err); g0 = g1; r0 = r1; g1 = g2; r1 = fit(g1); }
    B = r1.b2;
  }
  // the cut on the ray of bar 1's downbeat, at cutDeg (180°: the GPU's float32 z^α needs |β θ| < 88 on the branch,
  // θ in (cut − 360°, cut], so the cut must be near 180° for β = 24)
  const tb0 = tOfB(0);
  const psi = (cfg.cutDeg == null ? 180 : cfg.cutDeg) * Math.PI / 180;
  const delta = psi - B.at(tb0);
  const th = B.th.map((x) => x + delta);
  const us = new Float64Array(B.M + 1);
  for (let i = 0; i <= B.M; i++) us[i] = (TAU * B.Phi(i * B.dt) - N_ * th[i]) / BETA;
  const pts = [];
  for (let k = 0; k < NPTS; k++) { const i = Math.round(k * B.M / (NPTS - 1)), r = Math.exp(us[i]); pts.push([r * Math.cos(th[i]), r * Math.sin(th[i])]); }
  return Object.assign(B, { th, us, pts, cutDeg: psi * 180 / Math.PI });
}

// every crossing's time, read off the solved phase as the harp reads it (a Schmitt band of H; the time at the line):
// the silent ones fall where the phase passes their lines
function crossTimes(B) {
  const out = [], nb = Math.round(B.SC.Bend * 4000) + 1;
  let c = null, pPrev = null, bPrev = null;
  for (let i = 0; i <= nb; i++) {
    const b = -LEADB + (B.SC.Bend + LEADB) * i / nb, p = B.Pb(b);
    if (c === null) { c = Math.floor(p) * NL; while (thr(c + 1) <= p) c++; while (thr(c) > p) c--; pPrev = p; bPrev = b; continue; }
    const at = (th) => bPrev + (b - bPrev) * (p === pPrev ? 1 : Math.max(0, Math.min(1, (th - pPrev) / (p - pPrev))));
    while (p > thr(c + 1) + H) { c++; out.push({ L: c, d: 1, b: at(thr(c)) }); }
    while (p < thr(c) - H) { out.push({ L: c, d: -1, b: at(thr(c)) }); c--; }
    pPrev = p; bPrev = b;
  }
  return out;
}

// the drawing as it is seen (notes/sea-song/r2 review picture-3, picture-4), at the phone's scale (pxPerUnit, 128 px a
// unit): the most the curve turns within any arc of `arcPx` (degrees), its smallest radius of curvature over such an
// arc (px), and the narrowest gap between neighbouring turns (points more than 270° of arg z apart along the curve, px)
function shape(pts, o) {
  const ppu = o.pxPerUnit || 128, arcPx = o.arcPx || 4, n = pts.length;
  const s = [0], dir = [];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + ppu * Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  for (let i = 0; i + 1 < n; i++) dir.push(Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]));
  // the tangent turned continuously (unwrapped), at each segment's middle
  const U = [dir[0]]; for (let i = 1; i < dir.length; i++) U.push(U[i - 1] + Math.atan2(Math.sin(dir[i] - dir[i - 1]), Math.cos(dir[i] - dir[i - 1])));
  const mid = (i) => (s[i] + s[i + 1]) / 2;
  let turn = 0, tAt = 0, rMin = Infinity, rAt = 0;
  for (let i = 0, j = 0; i < U.length; i++) {
    if (j < i) j = i;
    while (j + 1 < U.length && mid(j + 1) - mid(i) <= arcPx) j++;
    const a = Math.abs(U[j] - U[i]), L = mid(j) - mid(i);
    if (a > turn) { turn = a; tAt = i; }
    if (L >= 0.5 * arcPx && a > 1e-9 && L / a < rMin) { rMin = L / a; rAt = i; }
  }
  // the gap between turns: from each point, the nearest point at least 270° further round (arg z unwrapped)
  const th = [Math.atan2(pts[0][1], pts[0][0])];
  for (let i = 1; i < n; i++) { const a = Math.atan2(pts[i][1], pts[i][0]); th.push(th[i - 1] + Math.atan2(Math.sin(a - th[i - 1]), Math.cos(a - th[i - 1]))); }
  let gap = Infinity, gAt = null;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (Math.abs(th[j] - th[i]) < 1.5 * Math.PI) continue;
    const d = Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]);
    if (d < gap) { gap = d; gAt = [i, j]; }
  }
  return { pxPerUnit: ppu, arcPx, turnDeg: +(turn * 180 / Math.PI).toFixed(1), turnAt: tAt, rMinPx: +rMin.toFixed(1), rAt, gapPx: +(gap * ppu).toFixed(1), gapAt: gAt };
}

// cubic Hermite through [x, y, slope] knots, with its derivative
function hermite(kn) {
  const n = kn.length, x = kn.map((k) => k[0]), y = kn.map((k) => k[1]), m = kn.map((k) => k[2]);
  const seg = (t) => { let lo = 0, hi = n - 2; while (lo < hi) { const md = (lo + hi + 1) >> 1; if (x[md] <= t) lo = md; else hi = md - 1; } return lo; };
  const f = (t) => { const i = seg(t), h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * y[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * y[i + 1] + (s3 - s2) * h * m[i + 1]; };
  f.d = (t) => { const i = seg(t), h = x[i + 1] - x[i], s = (t - x[i]) / h, s2 = s * s;
    return ((6 * s2 - 6 * s) * y[i] + (3 * s2 - 4 * s + 1) * h * m[i] + (-6 * s2 + 6 * s) * y[i + 1] + (3 * s2 - 2 * s) * h * m[i + 1]) / h; };
  return f;
}

if (require.main === module) {
  const t0 = Date.now();
  const B = place();
  const SC = B.SC;
  // the crossings of the solved phase must be the walk's, in order (each written note at its beat)
  const xs = crossTimes(B);
  if (xs.length !== SC.cross.length || xs.some((x, i) => x.L !== SC.cross[i].L || x.d !== SC.cross[i].d)) {
    const i = xs.findIndex((x, k) => !SC.cross[k] || x.L !== SC.cross[k].L || x.d !== SC.cross[k].d);
    throw new Error(`the phase crosses the lines out of the score's order at crossing ${i} (${xs.length} vs ${SC.cross.length})`);
  }
  let worstB = 0;
  SC.cross.forEach((n, i) => { if (!n.silent) worstB = Math.max(worstB, Math.abs(xs[i].b - n.b)); else n.b = xs[i].b; });
  const notes = SC.cross.map((n) => ({ note: n.nm, j: ((n.L % NL) + NL) % NL, dir: n.d, beat: +n.b.toFixed(4), t: +tOfB(n.b).toFixed(5), vel: n.silent ? 0 : n.vel, midi: n.silent ? 0 : n.midi, silent: !!n.silent, main: !!n.main, orig: n.orig || null, stmt: n.stmt }));
  const ticks = [], tickBeats = [];
  for (let b = 0; b < END - 1e-9; b += SB / NREV) tickBeats.push(b);
  if (cfg.codaFirstOnCut && SC.chords.length) tickBeats.push(SC.chords[0]);
  for (const b of tickBeats) ticks.push(+tOfB(b).toFixed(5));
  // the drum's level at each tick: the written note it falls on (review music-3)
  const tickDb = tickBeats.map((b) => { const m = SC.cross.find((n) => !n.silent && n.main && Math.abs(n.b - b) < 1e-6); return +(20 * Math.log10((m ? m.vel : 0.9) / 0.9) + (DY.tickDb || 0)).toFixed(2); });
  // the stored curve: points spread by arc length and by turning, rounded
  const P = cfg.points, dec = cfg.decimals;
  const pts = [];
  const rd = (x) => +(+x.toFixed(dec + 1)).toFixed(dec);
  {
    const M = B.M, X = new Float64Array(M + 1), Y = new Float64Array(M + 1), cm = new Float64Array(M + 1);
    for (let i = 0; i <= M; i++) { const r = Math.exp(B.us[i]); X[i] = r * Math.cos(B.th[i]); Y[i] = r * Math.sin(B.th[i]); }
    let Ls = 0, As = 0; const ds = [0], da = [0];
    for (let i = 1; i <= M; i++) {
      const l = Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]); Ls += l; ds.push(l);
      let a = 0; if (i < M) { const a1 = Math.atan2(Y[i] - Y[i - 1], X[i] - X[i - 1]), a2 = Math.atan2(Y[i + 1] - Y[i], X[i + 1] - X[i]); a = Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1))); }
      As += a; da.push(a);
    }
    const wt = cfg.pointsBy ? cfg.pointsBy.turn : 0;
    for (let i = 1; i <= M; i++) cm[i] = cm[i - 1] + (1 - wt) * ds[i] / Ls + wt * da[i - 1] / As;
    let i = 0;
    for (let k = 0; k < P; k++) {
      const m = cm[M] * k / (P - 1);
      while (i < M && cm[i + 1] < m) i++;
      const u = i < M && cm[i + 1] > cm[i] ? (m - cm[i]) / (cm[i + 1] - cm[i]) : 0, j = Math.min(M, i + 1);
      pts.push([rd(X[i] + (X[j] - X[i]) * u), rd(Y[i] + (Y[j] - Y[i]) * u)]);
    }
  }
  const alpha = `${N_}${BETA < 0 ? '-' : '+'}${Math.abs(BETA)}i`;
  const steps = [Object.assign({ type: 'powa', params: { alpha, cut: +B.cutDeg.toFixed(4), k: 0 } }, cfg.cutHandleR ? { handleR: cfg.cutHandleR } : {})];
  const dur = +B.T.toFixed(4);
  // the written note in MIDI, with the score's tuning (cents by pitch class) as a fraction; the strings kept ringing at
  // each crossing: the theme's, or the coda's chords' (notes/sea-song/r3)
  const tun = (m) => +(m + ((cfg.tuning || {})[Object.keys(PC).find((k) => PC[k] === m % 12 && (cfg.tuning || {})[k] != null)] || 0) / 100).toFixed(5);
  const listen = { dur, lines: LINES, vel: notes.map((n) => n.vel), note: notes.map((n) => (n.midi ? tun(n.midi) : 0)), dbl: cfg.octave,
    cap: SC.cross.map((n) => (n.silent ? 0 : n.coda ? cfg.strings.coda : cfg.strings.theme)) };
  if (DY.tickDb != null) listen.tick = tickDb;
  const ex = Object.assign({ steps }, cfg.example || {}, { pts, listen });
  // the drawing: the largest turn between neighbouring stored points, the curve's crossings of itself, and whether θ
  // always turns clockwise
  const turnMax = (() => { let w = 0; for (let k = 1; k + 1 < pts.length; k++) { const a1 = Math.atan2(pts[k][1] - pts[k - 1][1], pts[k][0] - pts[k - 1][0]), a2 = Math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0]); w = Math.max(w, Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)))); } return +(w * 180 / Math.PI).toFixed(1); })();
  const selfX = (() => { let c = 0; const crs = (a, b, p, q) => { const d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]); if (!d) return false; const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d, u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d; return t > 0 && t < 1 && u > 0 && u < 1; }; for (let i = 0; i + 1 < pts.length; i++) for (let j = i + 2; j + 1 < pts.length; j++) if (crs(pts[i], pts[i + 1], pts[j], pts[j + 1])) c++; return c; })();
  let ccw = 0; for (let i = 1; i <= B.M; i++) if (B.th[i] > B.th[i - 1] + 1e-12) ccw++;
  const look = shape(pts, cfg.check || {});
  // the narrowest gap between neighbouring turns, as a fraction of the radius (on the ray of each stored point)
  const tempo = [0, SB, 2 * SB, END].map((b) => +(Q0 * Math.exp(b / Q0TAU)).toFixed(1));
  const sum = { title: cfg.title, alpha, lines: LINES, strings: NAMES, cutDeg: +B.cutDeg.toFixed(4), dur, cg1: +CG1.toFixed(6), crossings: notes.length, sounding: notes.filter((n) => !n.silent).length,
    silent: notes.filter((n) => n.silent).length, written: notes.filter((n) => n.main).length, worstWrittenOnsetBeat: +worstB.toFixed(5), infeasible: B.bad, counterClockwiseSteps: ccw,
    tempoAtStatements: tempo, ticks, tickDb, turnMaxDeg: turnMax, selfCrossings: selfX, look, rmin: +Math.exp(Math.min(...B.us)).toFixed(4), rmax: +Math.exp(Math.max(...B.us)).toFixed(4), ms: Date.now() - t0 };
  console.log(JSON.stringify(sum));
  if (!argv.includes('--dry')) {
    const js = "'use strict';\n" +
      `// GENERATED by tools/melody_curve.js from tools/melodies/${path.basename(MEL)}: do not edit (notes/sea-song/README.md).\n` +
      `// ${cfg.title}: the example's curve (${P} points) and its Listen along data (dur: seconds; lines: the piece's own\n` +
      '// strings, lines of the Phase key in semitones above D; vel and note: the velocity and the written note (MIDI, 0: a\n' +
      '// silent crossing; a fraction: the score\'s tuning) of each crossing of a line, in order; dbl: the octave\'s level (the\n' +
      '// 2nd partial); cap: the strings ringing at once, at each crossing; tick:\n' +
      '// the drum, dB). The app plays them only on this curve, unedited, under these steps.\n' +
      `const SEASONG = ${JSON.stringify(ex)};\n` +
      "if (typeof module !== 'undefined' && module.exports) module.exports = { SEASONG };\n";
    fs.writeFileSync(path.join(ROOT, 'src', 'seasong.js'), js);
    fs.mkdirSync(path.join(ROOT, 'test', 'fixtures'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'test', 'fixtures', 'seasong_score.json'), JSON.stringify({ title: cfg.title, steps, dur, lines: LINES, ticks,
      notes: notes.map((n) => [n.j, n.dir, n.t, n.main ? 0 : 1, n.silent ? 1 : 0, n.midi, n.orig]),
      _notes: '[line index into lines (0 = the lowest line, D for this piece), direction, onset s (a silent crossing: where the phase passes its line), 0 a written main note / 1 not (a coda chord note or a silent crossing), silent, the written note (MIDI, 0 silent), the written name of a main note]' }));
    console.log('wrote src/seasong.js (' + js.length + ' bytes) and test/fixtures/seasong_score.json');
  }
}
module.exports = { dbg: () => (DBG = new Set()), getDbg: () => DBG, score, place, tOfBeat, NAMES, LINES, cfg, shape };
