// The sea song (notes/sea-song/AS-BUILT.md, round 2: notes/sea-song/r2/AS-BUILT.md): the example "In the Hall of the
// Mountain King" (src/seasong.js, made by tools/melody_curve.js) played by the app's own code is Grieg's score
// (test/fixtures/seasong_score.json, tools/melodies/mountain-king.json):
//  * the samples: app.js sndSample, its source text taken from app.js (src/app/) (900 points uniform in arc length, arg F
//    tracked exactly by Calc.argStep, a 'jump' is a cut tick at the crossing), F the powa step (CX.pow);
//  * the harp: src/sound.js run in a sandbox (a mock AudioContext): Sound.alongCount, Sound.harpStep driven as
//    harpAlong drives it on the piece's own lines with the stored velocities, and Sound.harpAlong itself (its
//    scheduled cues recorded);
//  * every crossing is the score's: the same line, direction and order; every written note sounds, on time (within
//    15 ms), at its written pitch (exactly, with the score's tuning: F♯ a just fifth over B) and octave, on one string
//    whose 2nd partial is the octave at a fixed level; every other crossing is silent and nothing else sounds; the
//    theme keeps one note ringing, the coda's chords four, a string plucked again is damped (its key); the 4 drum
//    ticks; the same at 600 … 3600 samples, with the points rounded to 3 decimals or jittered by 2e-4;
//  * the in-tune pluck (notes/sea-song/r3): harmonic partials (exactly n·f), one fixed start phase, one detune for all
//    the strings of a note (the pointer's harp too, whose D accent is on its D4 copy: no two strings at one pitch);
//  * the spiral: no crossing of itself, always clockwise, no corner (round 1's crossed itself 31 times).
// Run: node test/t_seasong.js
const fs = require('fs'), path = require('path'), vm = require('vm');
global.CX = require('../src/cx.js');
const Calc = require('../src/calc.js');
const { SEASONG } = require('../src/seasong.js');
const SC = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'seasong_score.json'), 'utf8'));
const C = CX.C, TAU = 2 * Math.PI, DEG = Math.PI / 180;
// the harp's fixed start phases (src/sound.js pluck, notes/sea-song/r3): by the odd part of the partial's number
const PH = (n) => { while (!(n & 1)) n >>= 1; return { 1: 0, 3: 0.5, 5: 0.25, 7: 0.75 }[n]; };
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } else if (process.env.V) console.log('ok  ', name, info); }

// ---- F: the example's one step, as the catalog's powa makes it
const st0 = SEASONG.steps[0], P = st0.params;
check('the example is one powa step', SEASONG.steps.length === 1 && st0.type === 'powa', JSON.stringify(SEASONG.steps));
const m = /^(-?[\d.]+)([+-][\d.]+)i$/.exec(P.alpha), alpha = C(+m[1], +m[2]);
const F = (z) => CX.pow(z, alpha, P.cut * DEG, P.k);
const funcs = fs.readFileSync(path.join(__dirname, '../src/funcs.js'), 'utf8');
check('funcs.js powa is CX.pow(z, α, cut, k)', /powa[\s\S]{0,3000}CX\.pow\(/.test(funcs));

// ---- app.js sndSample, from its source (M made a parameter for the sweep)
const APP = require('./src_text').appText();   // (src/app/*.js joined, as build.py does)
const a0 = APP.indexOf('  function sndSample(F, pts, closed) {'), a1 = APP.indexOf('\n  }\n', a0);
check('app.js sndSample found', a0 > 0 && a1 > a0);
const sampleSrc = APP.slice(a0, a1 + 4).replace('const M = 900,', 'const M = __M,');
check('sndSample samples 900 points', APP.slice(a0, a1).includes('const M = 900,'));
const sampler = new Function('C', 'CX', 'Calc', 'TAU', 'sndClamp', 'sndOk', 'performance', '__M', `${sampleSrc}; return sndSample;`);
const sndClamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sndOk = (w) => !!w && CX.isFin(w) && (w.re !== 0 || w.im !== 0);
const perf = { now: () => 0 };   // (the 500 ms budget is the browser's; timed separately below)
const sample = (pts, M = 900) => sampler(C, CX, Calc, TAU, sndClamp, sndOk, perf, M)(F, pts, false);

// ---- src/sound.js in a sandbox
function makeEnv() {
  const env = { clock: 0, listeners: {}, timers: [], ctx: null };
  class Param { constructor(v) { this.value = v; } setValueAtTime() { return this; } linearRampToValueAtTime() { return this; } exponentialRampToValueAtTime() { return this; } setTargetAtTime() { return this; } cancelScheduledValues() { return this; } setValueCurveAtTime() { return this; } }
  class AC {
    constructor() { env.ctx = this; this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.baseLatency = 0.005; this.destination = this.node(); }
    node(x = {}) { return Object.assign({ context: this, gain: new Param(1), connect: (d) => d, disconnect() {} }, x); }
    createGain() { return this.node(); } createStereoPanner() { return this.node({ pan: new Param(0) }); } createConvolver() { return this.node({ buffer: null }); }
    createWaveShaper() { return this.node({ curve: null }); } createBiquadFilter() { return this.node({ frequency: new Param(350), Q: new Param(1) }); }
    createBuffer(ch, len, fs) { const d = Array.from({ length: ch }, () => new Float32Array(len)); return { length: len, sampleRate: fs, numberOfChannels: ch, getChannelData: (i) => d[i] }; }
    createPeriodicWave() { return {}; }
    src() { const s = this.node({ frequency: new Param(440), detune: new Param(0), start() {}, stop() {}, setPeriodicWave() {} }); return s; }
    createOscillator() { return this.src(); } createBufferSource() { return this.src(); }
    resume() { this.state = 'running'; return Promise.resolve(); } suspend() { this.state = 'suspended'; return Promise.resolve(); }
  }
  const store = new Map();
  const sandbox = {
    window: { AudioContext: AC, localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }, addEventListener: (t, f) => { (env.listeners[t] = env.listeners[t] || []).push(f); } },
    console, Math, JSON, Object, Array, Float32Array, Float64Array, Number, String, Set, Map, Promise, Error, isFinite, encodeURIComponent, URLSearchParams,
    location: { search: '?ns=t0' }, navigator: { userActivation: { hasBeenActive: true, isActive: true } },
    document: { visibilityState: 'visible', addEventListener: () => {} }, performance: { now: () => env.clock },
    setTimeout: (f, ms) => { env.timers.push(f); return env.timers.length; }, clearTimeout: () => {}, URL: { createObjectURL: () => 'blob:x' }, Blob: function () {},
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/sound.js'), 'utf8') + '\n;globalThis.Sound = Sound;', sandbox);
  env.Sound = sandbox.Sound;
  env.fire = (t) => { for (const f of env.listeners[t] || []) f({ type: t }); };
  return env;
}
const want = SC.notes;   // [line, direction, onset s, not a main note, silent, written MIDI (0 silent), name]
const L = SEASONG.listen, LINES = L.lines, NL = LINES.length;
const dur = L.dur, vel = L.vel, note = L.note, tickDb = L.tick;
check('the stored data: a velocity and a written note per crossing, the score\'s duration and lines', vel.length === want.length && note.length === want.length && Math.abs(dur - SC.dur) < 1e-9 && JSON.stringify(LINES) === JSON.stringify(SC.lines), `${vel.length} ${want.length}`);
// the piece's own lines: exactly the pitch classes Grieg writes (Phase key: line s plucks D + s semitones)
const MC = require('../tools/melody_curve.js'), MEL = MC.cfg;
const PC = { 'C': 0, 'C#': 1, 'D': 2, 'E': 4, 'E#': 5, 'F#': 6, 'A': 9, 'B': 11 };
const written = new Set(MEL.theme.map(([nm]) => (PC[nm] - 2 + 12) % 12).concat((MEL.codaChord || []).map((nm) => (PC[nm] - 2 + 12) % 12)));
check('the piece\'s strings are exactly the pitch classes of the score (B C C# D E E# F# A: lines 9 10 11 0 2 3 4 7)', LINES.length === written.size && LINES.every((s) => written.has(s)), JSON.stringify(LINES));
check('no note of the theme is substituted (the melody file has no subs)', !MEL.subs && MEL.theme.every(([nm]) => nm in PC));
const sounding = want.filter((w) => !w[4]).length;
check('the silent crossings are exactly those that are not written notes (velocity 0, note 0)', want.every((w, i) => (w[4] ? vel[i] === 0 && note[i] === 0 : vel[i] >= 0.02 && note[i] > 0)), '');
check('each written note is on its own line: the line\'s pitch class is the note\'s', want.every((w) => w[4] || ((w[5] - 62) % 12 + 12) % 12 === LINES[w[0]]));
// the written notes, in order, are the melody file's theme three times (as written: octave and all) and the coda's chords
const SCORE = MC.score();
const themeMidi = MEL.theme.map(([nm, oc]) => 12 * (oc + 1) + PC[nm]);
const mainsWant = want.filter((w) => !w[3]).map((w) => w[5]);
check('the main notes are Grieg\'s theme, 3 times, as written (78 notes), then the 3 crashes', mainsWant.length === 81 && mainsWant.slice(0, 78).every((m, i) => m === themeMidi[i % 26]), mainsWant.slice(0, 30).join(' '));
check('the generator\'s score is the fixture\'s', SCORE.cross.length === want.length && SCORE.cross.every((x, i) => ((x.L % NL) + NL) % NL === want[i][0] && x.d === want[i][1] && (x.silent ? 0 : x.midi) === want[i][5]));

// the harp's crossings as harpAlong drives harpStep (an open curve), on the piece's lines, with the stored velocities
function play(S, Sm, d = dur) {
  const st = S.Harp(LINES), M = Sm.phi.length, dt = d / Math.max(1, M - 1), got = [];
  S.harpStep(st, null, 0, Sm.phi[0], {});
  for (let j = 1; j < M; j++) for (const c of S.harpStep(st, null, (j - 1) * dt, Sm.phi[j], { ln: Sm.la[j], dt, vel, note })) got.push({ j: ((c.i % NL) + NL) % NL, dir: c.dir, t: (j - 1) * dt + c.u * dt });
  return { got, st };
}
function compare(got) {
  let same = got.length === want.length, worst = 0, first = -1;
  for (let i = 0; i < Math.min(got.length, want.length); i++) {
    if (got[i].j !== want[i][0] || got[i].dir !== want[i][1]) { same = false; if (first < 0) first = i; }
    if (!want[i][4]) worst = Math.max(worst, Math.abs(got[i].t - want[i][2]));
  }
  return { same, worstMs: +(1000 * worst).toFixed(1), first, n: got.length };
}
const TURN_DEG = (pts) => { let w = 0; for (let k = 1; k + 1 < pts.length; k++) { const a1 = Math.atan2(pts[k][1] - pts[k - 1][1], pts[k][0] - pts[k - 1][0]), a2 = Math.atan2(pts[k + 1][1] - pts[k][1], pts[k + 1][0] - pts[k][0]); w = Math.max(w, Math.abs(Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1)))); } return w * 180 / Math.PI; };
function selfCross(pts) {
  let c = 0;
  const crs = (a, b, p, q) => { const d = (b[0] - a[0]) * (q[1] - p[1]) - (b[1] - a[1]) * (q[0] - p[0]); if (!d) return false; const t = ((p[0] - a[0]) * (q[1] - p[1]) - (p[1] - a[1]) * (q[0] - p[0])) / d, u = ((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / d; return t > 0 && t < 1 && u > 0 && u < 1; };
  for (let i = 0; i + 1 < pts.length; i++) for (let j = i + 2; j + 1 < pts.length; j++) if (crs(pts[i], pts[i + 1], pts[j], pts[j + 1])) c++;
  return c;
}

(async () => {
  const env = makeEnv(), S = env.Sound;
  const pts = SEASONG.pts;
  // ---- the spiral
  check('the spiral never crosses itself (stored points)', selfCross(pts) === 0, selfCross(pts));
  let back = 0, prevA = Math.atan2(pts[0][1], pts[0][0]), tot = 0;
  for (let k = 1; k < pts.length; k++) { const a = Math.atan2(pts[k][1], pts[k][0]); let d = a - prevA; d = Math.atan2(Math.sin(d), Math.cos(d)); if (d >= 0) back++; tot += d; prevA = a; }
  check('it always turns clockwise about 0 (each turn inside the one before)', back === 0, `${back} steps back, ${(tot / (2 * Math.PI)).toFixed(2)} turns`);
  check('one turn a statement: 3 statements and the coda make 3 to 4 clockwise turns', tot < -3 * 2 * Math.PI && tot > -4 * 2 * Math.PI, (tot / (2 * Math.PI)).toFixed(2));
  const tm = TURN_DEG(pts);
  check('no corner: at most 12° between neighbouring stored points (round 1: 11.2°)', tm <= 12, tm.toFixed(1) + '°');
  check('the function is z^(−2+24i), its cut at 180° (float32: |24 θ| < 88 on the branch)', P.alpha === '-2+24i' && P.cut === 180, JSON.stringify(P));
  const Sm = sample(pts);
  check('the curve samples (F finite and nonzero along it)', !!Sm && Sm.phi.length === 900);
  check('the 900 samples the app plays never cross each other either', selfCross(Sm.zs.map((z) => [z.re, z.im])) === 0);
  // the app's guard: the crossing count on the piece's lines equals the velocity list
  check('Sound.alongCount on the piece\'s lines = the stored velocities (the app then uses them)', S.alongCount(Sm.phi, false, LINES) === vel.length, S.alongCount(Sm.phi, false, LINES));
  check('on the pointer\'s five lines the count differs (the guard keeps a piece\'s data to its own lines)', S.alongCount(Sm.phi, false) !== vel.length, S.alongCount(Sm.phi, false));
  const r = play(S, Sm), c = compare(r.got);
  check(`the harp plays the score: ${want.length} crossings, same lines and directions in order`, c.same, JSON.stringify(c));
  check('every written note within 15 ms of the score', c.worstMs <= 15, c.worstMs + ' ms');
  check(`every written note sounds and nothing else (${sounding} of ${want.length} crossings)`, r.st.notes === sounding, r.st.notes);
  const mains = want.filter((w) => !w[3]);
  console.log(`  ${c.n} crossings: ${sounding} sounding (${mains.length} main notes, ${sounding - mains.length} chord notes), ${want.length - sounding} silent; worst onset ${c.worstMs} ms`);
  // the drum: a cut tick on each statement's downbeat and on the first crash
  const ticks = Sm.cuts.map((u) => u * dur);
  const tErr = ticks.length === SC.ticks.length ? Math.max(...ticks.map((t, i) => Math.abs(t - SC.ticks[i]))) : Infinity;
  check(`${SC.ticks.length} cut ticks (the drum), each within 10 ms of its beat`, ticks.length === SC.ticks.length && tErr < 0.010, JSON.stringify(ticks.map((t) => +t.toFixed(4))) + ' err ' + (1000 * tErr).toFixed(1) + ' ms');
  // the dynamics: pp to ff
  const meanVel = (s) => { const v = want.map((w, i) => [w, vel[i]]).filter(([w]) => !w[3]); const a = v.filter((_, i) => i * 4 >= s * v.length && i * 4 < (s + 1) * v.length).map((x) => x[1]); return a.reduce((p, q) => p + q, 0) / a.length; };
  const q = [0, 1, 2, 3].map(meanVel);
  check('the main notes grow louder quarter by quarter (crescendo)', q[0] >= 0.42 && q[0] < q[1] && q[1] < q[2] && q[2] < q[3] && q[3] / q[0] > 2, q.map((x) => x.toFixed(2)).join(' '));
  // the accelerando: notes a second, statement by statement
  const tsMain = mains.map((w) => w[2]);
  const per = [1, 2, 3].map((k) => { const a = tsMain.slice((k - 1) * 26, k * 26); return (a.length - 1) / (a[a.length - 1] - a[0]); });
  check('each statement is faster than the one before (×1.3)', per[1] / per[0] > 1.25 && per[2] / per[1] > 1.25, per.map((x) => x.toFixed(2)).join(' '));

  // the sampling sweep: the same notes at other sample counts and after small changes of the points
  let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296 - 0.5);
  const sets = { stored: pts, rounded3: pts.map(([x, y]) => [+x.toFixed(3), +y.toFixed(3)]), jitter2e4: pts.map(([x, y]) => [x + 4e-4 * rnd(), y + 4e-4 * rnd()]) };
  for (const [k, p] of Object.entries(sets)) for (const M of [600, 750, 900, 901, 1000, 1200, 1800, 3600]) {
    const Sx = sample(p, M), rx = compare(play(S, Sx).got);
    check(`sweep ${k} M=${M}: the same ${want.length} crossings, written notes within 15 ms, ${SC.ticks.length} ticks`, rx.same && rx.worstMs <= 15 && Sx.cuts.length === SC.ticks.length, JSON.stringify(rx) + ' ticks ' + Sx.cuts.length);
  }
  const t0 = process.hrtime.bigint(); sample(pts); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check('sndSample of the example well under its 500 ms budget (node)', ms < 150, ms.toFixed(0) + ' ms');
  console.log(`  sndSample ${ms.toFixed(0)} ms`);

  // Sound.harpAlong itself: on, activated, its cues recorded
  S.set({ on: true, events: true }, { quiet: true });
  env.fire('pointerdown');
  const cues = [];
  S.cueHook((t, cue) => cues.push({ t, str: !!cue.str, cap: cue.cap, key: cue.key, g: cue.g, parts: cue.parts, f0: cue.parts[0] && cue.parts[0].f }));
  // (as the app calls it for a piece: sndListen; the strings' own ±1 dB from a fixed seed)
  S.seed(20261024);
  const h = S.harpAlong(Sm.phi, Sm.la, dur, { tag: 'x', closed: false, cuts: Sm.cuts.map((u) => u * dur), lines: LINES, vel, note, dbl: L.dbl, tickDb, cap: L.cap });
  check('Sound.harpAlong plays (on, Mathematical events on)', !!h, JSON.stringify(h));
  if (h) {
    const strs = cues.filter((x) => x.str);
    const byOn = new Map(); for (const x of strs) { const k = +(x.t - h.t0).toFixed(6); if (!byOn.has(k)) byOn.set(k, []); byOn.get(k).push(x); }
    const on = [...byOn.keys()].sort((a, b) => a - b);
    const wantOn = want.filter((w) => !w[4]);
    const errs = on.map((t, i) => (wantOn[i] ? Math.abs(t - wantOn[i][2]) : Infinity));
    check(`Sound.harpAlong schedules ${sounding} note onsets (the silent crossings none), each within 15 ms of the score`, on.length === sounding && Math.max(...errs) <= 0.015, `${on.length} worst ${(1000 * Math.max(...errs)).toFixed(1)} ms`);
    check('Sound.harpAlong counts every sounding note', h.notes === sounding, h.notes);
    // the strings ringing at once (review pitch-1): one in the theme, four in the coda's chords; each string keyed by
    // its note, so a pitch plucked again is damped first (review pitch-4)
    const capOn = L.cap.filter((c, k) => L.note[k] > 0);   // (the coda: the last 12 notes, three chords of four)
    check('a piece\'s strings: the theme keeps one note ringing, the coda\'s chords four (listen.cap, one per crossing)', capOn.length === sounding && on.every((t, i) => byOn.get(t).every((x) => x.cap === capOn[i])) && capOn.every((c, i) => c === (i >= sounding - 12 ? 4 : 1)), [...new Set(strs.map((x) => x.cap))]);
    check('each string carries its note as its key (a string plucked again is damped)', on.every((t, i) => byOn.get(t).every((x) => x.key === wantOn[i][5])), strs.slice(0, 4).map((x) => x.key));
    // the pitch (review pitch-2, pitch-5): each written note on one string at exactly its written pitch with the
    // score's tuning (F♯ +1.955 cents, a just fifth over B; the rest equal temperament; no detune), its 2nd partial the
    // octave at exactly dbl of the fundamental; the partials harmonic, with the fixed phases (PH of n's odd part); nothing
    // else
    const TUNE = { 6: 1.955 };
    let worstC = 0, one = 0, lvl = 0, part = 0, oct = 0;
    const cents = (f, m) => 1200 * Math.log2(f / (440 * Math.pow(2, (m - 69) / 12)));
    on.forEach((t, i) => {
      const g = byOn.get(t), m = wantOn[i] && wantOn[i][5];
      if (g.length === 1) one++;
      const a = g[0], mp = a.parts.filter((p) => p.k === 'm');
      worstC = Math.max(worstC, Math.abs(cents(a.f0, m) - (TUNE[m % 12] || 0)));
      if (Math.round(cents(a.f0, m) / 1200) === 0) oct++;
      if (mp.length > 1 && Math.abs(mp[1].a / mp[0].a - L.dbl) < 1e-9) lvl++;
      if (mp.every((p, k) => Math.abs(p.f / (a.f0 * (k + 1)) - 1) < 1e-12 && p.ph === PH(k + 1))) part++;
    });
    check('every written note: one string at exactly its written pitch with the score\'s tuning, in its written octave', worstC < 1e-6 && oct === sounding, `${worstC.toExponential(1)} cents off, ${oct}/${sounding} in octave`);
    check('every written note: exactly one string, its 2nd partial the octave at dbl of the fundamental', one === sounding && lvl === sounding, `${one} ${lvl} of ${sounding}`);
    check('every string\'s partials are harmonic (exactly n·f), with fixed start phases (n and 2n alike)', part === sounding, `${part}/${sounding}`);
    check(`nothing else sounds: ${sounding} strings for ${sounding} written notes`, strs.length === sounding, strs.length);
    const ticksC = cues.filter((x) => !x.str);
    check(`Sound.harpAlong schedules the ${SC.ticks.length} drum ticks, one pluck each`, ticksC.length === SC.ticks.length && ticksC.every((x) => x.parts.length <= 9), ticksC.map((x) => x.parts.length));
    const tg = ticksC.map((x) => 20 * Math.log10(x.g));
    check('the drum grows from soft to loud (its gains rise by the stored levels)', tg.every((g, i) => !i || g > tg[i - 1]) && Math.abs((tg[tg.length - 1] - tg[0]) - (tickDb[tickDb.length - 1] - tickDb[0])) < 0.01, tg.map((g) => g.toFixed(2)).join(' '));
    const byT = new Map(); for (const x of strs) { const k = +x.t.toFixed(6); byT.set(k, (byT.get(k) || 0) + x.parts.reduce((a, pp) => a + (pp.a || 0), 0)); }
    const loud = (a, b) => Math.max(...[...byT].filter(([t]) => t - h.t0 >= a && t - h.t0 < b).map(([, v]) => v));
    const g6 = 20 * Math.log10(loud(16, 23) / loud(0, 5));
    check('the last statement and coda strike over 5 dB harder than the first bars (velocity 0.48 to 1.0: 6.4 dB, each string ±1 dB)', g6 > 5, g6.toFixed(1) + ' dB');
  }
  S.cueHook(null);
  // the pointer's harp (Hear the function) is in tune too: a note's octave copies share one detune (pure octaves)
  S.set({ on: true, sonify: true }, { quiet: true });
  const pc = [];
  S.cueHook((t, cue) => { if (cue.str) pc.push({ t, f0: cue.parts[0].f, parts: cue.parts }); });
  S.harpReset(0.05); S.harp(0.05, { dt: 0.05 }); S.harp(0.30, { dt: 0.05 });   // crosses E (60°): one note
  const fs0 = pc.map((x) => x.f0).sort((a, b) => a - b);
  const ratios = fs0.slice(1).map((f) => Math.log2(f / fs0[0]));
  check('the pointer\'s harp: a note\'s octave copies are pure octaves (one detune, ±1.5 cents)', fs0.length >= 2 && ratios.every((r2) => Math.abs(r2 - Math.round(r2)) < 1e-12) && ((c0) => Math.abs(c0 - 1200 * Math.round(c0 / 1200)))(1200 * Math.log2(fs0[0] / (73.416 * Math.pow(2, 2 / 12)))) <= 1.5 + 1e-6, fs0.map((f) => f.toFixed(3)).join(' '));
  // (each copy a quarter turn on from the octave below: its partials meet the lower copy's in quadrature, so they add
  // in power every time, review pitch-3)
  const ocOf = (f) => Math.round(Math.log2(f / fs0[0]));
  check('the pointer\'s harp: harmonic partials, fixed phases, each copy a quarter turn on from the one below', pc.every((x) => x.parts.filter((p) => p.k === 'm').every((p, k) => Math.abs(p.f / (x.f0 * (k + 1)) - 1) < 1e-12 && Math.abs(((p.ph - PH(k + 1) - 0.25 * ocOf(x.f0)) % 1 + 1) % 1 - (((0.25 * Math.round(Math.log2(fs0[0] / (73.416 * Math.pow(2, 2 / 12))))) % 1 + 1) % 1)) < 1e-9)), pc.length);
  // a D (review picture-1, pitch-3): its accent is on the D4 copy, one string, not a second string at the same pitch
  pc.length = 0;
  S.harpReset(0.95); S.harp(0.95, { dt: 0.05 }); S.harp(1.05, { dt: 0.05 });   // crosses D (0°)
  const dF = pc.map((x) => x.f0).sort((a, b) => a - b), d4 = pc.find((x) => Math.abs(1200 * Math.log2(x.f0 / 293.665)) < 2);
  check('the pointer\'s harp: a D has one string a pitch, its D4 copy carrying the accent', dF.length >= 2 && dF.every((f, k) => !k || f / dF[k - 1] > 1.5) && !!d4, dF.map((f) => f.toFixed(2)).join(' '));
  S.cueHook(null);
  console.log(`${n - bad}/${n} sea song checks passed`);
  if (bad) process.exitCode = 1;
})();
