// "In the Hall of the Mountain King" (Edvard Grieg, Peer Gynt, 1875; public domain), adapted for the phase harp's
// five strings (B minor pentatonic: D E F# A B). Our own adaptation of Grieg's melody, from the composition itself.
//
// The harp plucks a string each time the unwrapped arg F crosses its line, up or down. So after a note played going
// up, the next note is either the next string up or the SAME string again (going back down across it); a step down
// right after a step up therefore re-plucks the turning string first. walk() below writes the theme as crossings with
// the fewest such extra plucks: a "flam" (the turning string re-plucked right after the note, softly) and a "pass"
// (a string crossed between the two notes of a third, a soft passing 16th: the harp's own run).
'use strict';

const NAMES = ['D', 'E', 'F#', 'A', 'B'];
const PC = { D: 0, E: 1, 'F#': 2, A: 3, B: 4 };
const TH = [0, 1 / 6, 1 / 3, 7 / 12, 3 / 4], H = 1 / 96;
const mod5 = (i) => ((i % 5) + 5) % 5;
const thr = (i) => Math.floor(i / 5) + TH[mod5(i)];

// ---------------------------------------------------------------- the theme (one statement, 4 bars of 4/4, beats)
// Grieg:  B C# D E F# D F#(q) | E# C# E#(q) E C E(q) | B C# D E F# D F# B | A F# D F# A(h)
// here:   B B  D E F# D F#(q) | E  D  E (q) E B E(q) | B B  D E F# D F# B | A F# D F# A(h)
//   C# (bars 1, 3) -> B repeated: the creep keeps its five eighths and still rises every eighth after the first
//   E# -> E, C# -> D, C -> B (bar 2): each the string a semitone away, the answer still sinks (top first, then bottom)
const THEME = [
  ['B', 0.5], ['B', 0.5], ['D', 0.5], ['E', 0.5], ['F#', 0.5], ['D', 0.5], ['F#', 1],
  ['E', 0.5], ['D', 0.5], ['E', 1], ['E', 0.5], ['B', 0.5], ['E', 1],
  ['B', 0.5], ['B', 0.5], ['D', 0.5], ['E', 0.5], ['F#', 0.5], ['D', 0.5], ['F#', 0.5], ['B', 0.5],
  ['A', 0.5], ['F#', 0.5], ['D', 0.5], ['F#', 0.5], ['A', 2],
];
const GRIEG = ['B', 'C#', 'D', 'E', 'F#', 'D', 'F#', 'E#', 'C#', 'E#', 'E', 'C', 'E', 'B', 'C#', 'D', 'E', 'F#', 'D', 'F#', 'B', 'A', 'F#', 'D', 'F#', 'A'];
// Grieg's heights (semitones above B), for the direction each note is played in: up where the tune rises
const HEIGHT = [0, 2, 3, 5, 7, 3, 7, 6, 2, 6, 5, 1, 5, 0, 2, 3, 5, 7, 3, 7, 12, 10, 7, 3, 7, 10];
const REPS = 3;                       // the theme three times: pp sneaking, mf, ff frenzy
const BEATS = 16 * REPS;              // 48 beats
// the accelerando: an exponential tempo from 100 to 270 quarter notes a minute over the 48 beats, then held
const BPM0 = 100, BPM1 = 250, LEAD = 0.35;
const rho = BPM1 / BPM0;
function timeOf(b) {   // s from the route's start
  const T48 = (60 / BPM0) * BEATS * (1 - 1 / rho) / Math.log(rho);
  if (b <= BEATS) return LEAD + (60 / BPM0) * BEATS * (1 - Math.pow(rho, -b / BEATS)) / Math.log(rho);
  return LEAD + T48 + (b - BEATS) * 60 / BPM1;
}
const bpmAt = (b) => (b <= BEATS ? BPM0 * Math.pow(rho, b / BEATS) : BPM1);
// the crescendo: a main note's velocity (the harp's vel, 0.3 = pp … 1 = ff) by beat; held notes and bar downbeats
// a little more; the flams 0.3 of it, the passing notes 0.45
const velAt = (b) => 0.3 + 0.62 * Math.pow(Math.min(1, b / BEATS), 1.3);
// the end: crashing chords, strums over all five strings (a full turn of arg F, about 50 ms, ending on B): three
// falling (A F# E D B) on beats 48, 49, 50, then after a beat's silence one rising (B D E F# A B) that rings. The three
// statements climb a turn each (+3), the chords net -2: (score W = 0 by default: the hall of make.js has a triple pole, so a loop inside it turns arg F a multiple of 3 times; W = 0 sings D5)
const CHORDS = [{ b: 48, dir: -1 }, { b: 49, dir: -1 }, { b: 50, dir: -1 }, { b: 52, dir: 1 }];
const STRUM = 0.120, RING = 1.6;      // a strum's length (s); how long the last chord rings before the loop closes
const FLAM = (D) => Math.max(0.03, Math.min(0.05, 0.2 * D));   // how soon a turning string is re-plucked (s)

// ---------------------------------------------------------------- the walk: notes -> crossings
// state: the cell c (after an up crossing of line l, c = l; after a down crossing, c = l - 1), the last line and dir
function optionsFrom(c, y) {
  const up = [], dn = [];
  for (let l = c + 1; ; l++) { up.push({ line: l, dir: 1 }); if (mod5(l) === y) break; }
  for (let l = c; ; l--) { dn.push({ line: l, dir: -1 }); if (mod5(l) === y) break; }
  return [up, dn];
}
function walk(mains, c0) {
  // DP over the cell (unwrapped), cost: flam 1, pass 1.25; mains: [{y, ...}]; the first note is reached from c0
  const N = mains.length;
  let layer = new Map([[c0, { cost: 0, prev: null, path: null, last: null }]]);
  const layers = [layer];
  for (let k = 0; k < N; k++) {
    const next = new Map();
    for (const [c, s] of layer) {
      for (const opt of optionsFrom(c, mains[k].y)) {
        const extras = opt.length - 1;
        const flam = s.last && extras > 0 && opt[0].line === s.last.line && opt[0].dir !== s.last.dir ? 1 : 0;
        const want = mains[k].dir || 0, mis = want && opt[opt.length - 1].dir !== want ? 2 : 0;
        const cost = s.cost + flam + 1.25 * (extras - flam) + mis + (k === 0 ? 100 * extras : 0);
        const lastX = opt[opt.length - 1], c2 = lastX.dir > 0 ? lastX.line : lastX.line - 1;
        const old = next.get(c2);
        if (!old || cost < old.cost - 1e-9) next.set(c2, { cost, prev: c, path: opt, last: lastX, flam });
      }
    }
    layers.push(next); layer = next;
  }
  return layers;
}
function backtrack(layers, cEnd) {
  const out = [];
  let c = cEnd;
  for (let k = layers.length - 1; k >= 1; k--) { const s = layers[k].get(c); out.unshift({ path: s.path, flam: s.flam }); c = s.prev; }
  return out;
}

// the whole score: [{nm, line, dir, t, kind ('main' | 'flam' | 'pass' | 'chord'), vel, beat, i (main index)}]
function score(o = {}) {
  const mains = [];
  let b = 0;
  for (let r = 0; r < REPS; r++) THEME.forEach(([nm, d], q) => {
    // the melodic direction into this note (Grieg's), 0 for a repeated note or the very first
    const h0 = q ? HEIGHT[q - 1] : r ? HEIGHT[HEIGHT.length - 1] - 12 : null, dir = h0 == null ? 0 : Math.sign(HEIGHT[q] - h0);
    mains.push({ nm, y: PC[nm], beat: b, dur: d, rep: r, dir: THEME[q - 1] && THEME[q - 1][0] === nm ? 0 : dir }); b += d;
  });
  const C0 = 9;   // the start: between the B line (4 + 5) and the D line (10): the first B is played going down
  const layers = walk(mains, C0);
  // the chords: from the walk's end, strums up/down ending on B; the closing must come back to C0 + 5 W
  let best = null;
  for (const [c, s] of layers[layers.length - 1]) {
    let cc = c, last = s.last; const strums = [];
    for (const ch of CHORDS) {
      const xs = [];
      if (ch.dir > 0) { for (let l = cc + 1; ; l++) { xs.push({ line: l, dir: 1 }); if (xs.length >= 5 && mod5(l) === 4) break; } cc = xs[xs.length - 1].line; }
      else { for (let l = cc; ; l--) { xs.push({ line: l, dir: -1 }); if (xs.length >= 5 && mod5(l) === 4) break; } cc = xs[xs.length - 1].line - 1; }
      strums.push(xs); last = xs[xs.length - 1];
    }
    const W = (cc - C0) / 5;
    if (!Number.isInteger(W)) continue;
    const want = o.W == null ? 0 : o.W;
    if (W !== want) continue;
    if (!best || s.cost < best.cost) best = { cEnd: c, cost: s.cost, strums, W, cFinal: cc };
  }
  if (!best) throw new Error('no walk ends where the loop can close with the wanted W');
  const steps = backtrack(layers, best.cEnd);
  const ev = [];
  for (let k = 0; k < mains.length; k++) {
    const m = mains[k], t = timeOf(m.beat), path = steps[k].path, flam = steps[k].flam;
    const tPrev = k ? timeOf(mains[k - 1].beat) : 0, D = t - tPrev;
    const v = velAt(m.beat) + (m.dur >= 1 ? 0.04 : 0) + (m.beat % 4 === 0 ? 0.04 : 0);
    const extras = path.slice(0, -1);
    // extras fall between the previous main note and this one: a flam right after the previous note, the passing
    // notes evenly in what is left (a passing 16th in an eighth)
    let tf = tPrev;
    extras.forEach((x, j) => {
      let tx, kind;
      if (j === 0 && flam) { tx = tPrev + FLAM(D); kind = 'flam'; tf = tx; }
      else { const np = extras.length - (flam ? 1 : 0), jj = j - (flam ? 1 : 0) + 1; tx = tf + (t - tf) * jj / (np + 1); kind = 'pass'; }
      const vb = velAt(mains[k - 1] ? mains[k - 1].beat : 0);
      ev.push({ nm: NAMES[mod5(x.line)], line: x.line, dir: x.dir, t: tx, kind, vel: +(vb * (kind === 'flam' ? 0.3 : 0.45)).toFixed(3), beat: null });
    });
    const x = path[path.length - 1];
    ev.push({ nm: NAMES[mod5(x.line)], line: x.line, dir: x.dir, t, kind: 'main', vel: +Math.min(1, v).toFixed(3), beat: m.beat, i: k, grieg: GRIEG[k % GRIEG.length], dur: m.dur });
  }
  CHORDS.forEach((ch, q) => {
    const t = timeOf(ch.b), xs = best.strums[q];
    xs.forEach((x, j) => ev.push({ nm: NAMES[mod5(x.line)], line: x.line, dir: x.dir, t: t + STRUM * j / (xs.length - 1), kind: 'chord', vel: mod5(x.line) === 4 ? 1 : 0.85, beat: ch.b, chord: q }));
  });
  const tEnd = timeOf(CHORDS[CHORDS.length - 1].b) + STRUM + RING;
  return { ev, W: best.W, C0, cFinal: best.cFinal, tEnd, mains, cost: best.cost };
}

module.exports = { HEIGHT, NAMES, PC, TH, H, thr, mod5, THEME, GRIEG, REPS, BEATS, BPM0, BPM1, LEAD, timeOf, bpmAt, velAt, CHORDS, STRUM, RING, score };

if (require.main === module) {
  const S = score();
  const k = { main: 0, flam: 0, pass: 0, chord: 0 };
  for (const e of S.ev) k[e.kind]++;
  console.log('W', S.W, 'events', S.ev.length, k, 'end', S.tEnd.toFixed(3), 'cost', S.cost);
  let line = '';
  for (const e of S.ev) {
    const tag = e.kind === 'main' ? e.nm : e.kind === 'chord' ? `[${e.nm}]` : `(${e.nm})`;
    line += tag + (e.dir > 0 ? '↑' : '↓') + ' ';
    if (e.kind === 'main' && (e.beat + e.dur) % 4 === 0) { console.log(`b${String(e.beat + e.dur).padStart(2)} t${e.t.toFixed(2)} ${line}`); line = ''; }
  }
  console.log(line);
}
