'use strict';
// Hear the function at the audio level (SOUND-PLAN 5.3): the engine's Listen along (Sound.along, Notes and Glide) on
// the 8 golden scenes of test/t_heard.js, posted on the worklet engine of t_heard's sandbox, played by the worklet's own
// cmw-synth processor in node (as test/sound_bench.js runs it) and mixed as graph() does: the tiers' dry outputs plus
// the room (their sends convolved with roomIR, normalized as the Web Audio spec does, ×2.0) at the bus, then the
// declared limiter (LIB.Limiter, −8.8 dB) the bus feeds. Checks: every sample finite; the bus's peak ≤ −8.3 dBFS
// before the limiter and the limiter idle (0 %); no clicks (the largest third difference under 15× its local RMS);
// the ring-down (60 dB under the render's loudest 50 ms within 0.82 + 0.4 s of the last note, 0.8 + 0.4 s of the
// Glide's last control); silence (no 50 ms window above −80 dBFS from 2 s after the last change); determinism (two
// renders identical); every catalog cue at its loudest (order 8) ≤ −8.8 dBFS at the bus.
// Not here (WARN-level or browser-only in the plan): the Glide's wobble, swell and stop lag, flutter, pitch read-back,
// the order read-back, the stress paths, CPU. Run: node test/t_sound_accept.js [--only scene-regex]
const fs = require('fs'), path = require('path'), vm = require('vm');
global.CX = require('../src/cx.js');
const Calc = require('../src/calc.js');
const C = CX.C, TAU = 2 * Math.PI;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), mod = (x, m) => ((x % m) + m) % m;
const SEASONG = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'heard', 'mountain-king-curve.json'), 'utf8'));
let bad = 0, n = 0;
function check(name, ok, info = '') { n++; if (!ok) { bad++; console.log('FAIL', name, info); } }
const only = process.argv.includes('--only') ? new RegExp(process.argv[process.argv.indexOf('--only') + 1]) : null;

// t_heard.js's sandbox (makeEnv), probe and scenes, taken from its text (one copy of the ported prototype)
const HEARD = fs.readFileSync(path.join(__dirname, 't_heard.js'), 'utf8');
const h0 = HEARD.indexOf('// ---------- sound.js in a sandbox'), h1 = HEARD.indexOf('\n(async () => {');
if (h0 < 0 || h1 < h0) throw new Error('test/t_heard.js: its sandbox and scenes were not found as expected');
const H = new Function('require', '__dirname', 'fs', 'path', 'vm', 'CX', 'Calc', 'SEASONG', 'C', 'TAU', 'clamp', 'mod', 'check',
  HEARD.slice(h0, h1) + '\nreturn { makeEnv, flush, probe, finalCues, SC, T0 };')(require, __dirname, fs, path, vm, CX, Calc, SEASONG, C, TAU, clamp, mod, check);

// the worklet in this context's globals, as in an AudioWorkletGlobalScope (test/sound_bench.js)
const FS = 48000, reg = {};
global.sampleRate = FS; global.currentFrame = 0;
global.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
global.registerProcessor = (name, cls) => { reg[name] = cls; };

// the room: src/sound.js's roomIR (its text), its Web Audio normalization (calculateNormalizationScale, Chromium's
// −58 dB calibration), and an FFT overlap-add convolution
function fft(re, im, inv) {
  const N = re.length;
  for (let i = 1, j = 0; i < N; i++) { let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= N; len <<= 1) {
    const a = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a), hl = len >> 1;
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < hl; j++) {
        const p = i + j, q = p + hl, xr = re[q] * cr - im[q] * ci, xi = re[q] * ci + im[q] * cr;
        re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inv) for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; }
}
function convolve(x, hh, len) {
  const m = hh.length; let N = 1; while (N < 2 * m) N <<= 1; if (N < 65536) N = 65536;
  const B = N - m + 1, Hr = new Float64Array(N), Hi = new Float64Array(N);
  for (let i = 0; i < m; i++) Hr[i] = hh[i];
  fft(Hr, Hi, false);
  const y = new Float64Array(len), re = new Float64Array(N), im = new Float64Array(N);
  for (let s = 0; s < len; s += B) {
    let any = false;
    for (let i = 0; i < B && s + i < len; i++) if (x[s + i] !== 0) { any = true; break; }
    if (!any) continue;
    re.fill(0); im.fill(0);
    for (let i = 0; i < B && s + i < len; i++) re[i] = x[s + i];
    fft(re, im, false);
    for (let k = 0; k < N; k++) { const a = re[k] * Hr[k] - im[k] * Hi[k], b = re[k] * Hi[k] + im[k] * Hr[k]; re[k] = a; im[k] = b; }
    fft(re, im, true);
    for (let i = 0; i < N && s + i < len; i++) y[s + i] += re[i];
  }
  return y;
}
let ROOM = null;
function room(Sound) {
  if (ROOM) return ROOM;
  const SRC = fs.readFileSync(path.join(__dirname, '../src/sound.js'), 'utf8');
  const r0 = SRC.indexOf('  function roomIR(c) {'), r1 = SRC.indexOf('\n  }\n', r0);
  if (r0 < 0 || r1 < r0) throw new Error('src/sound.js: roomIR not found as expected');
  const roomIR = new Function('prng', SRC.slice(r0, r1 + 4) + '; return roomIR;')(Sound.LIB.prng);
  const ch = [new Float32Array(Math.round(FS * 0.9)), new Float32Array(Math.round(FS * 0.9))];
  const b = roomIR({ sampleRate: FS, createBuffer: (k, len) => ({ length: len, numberOfChannels: k, getChannelData: (i) => ch[i] }) });
  let p = 0; for (const d of ch) for (let i = 0; i < d.length; i++) p += d[i] * d[i];
  p = Math.max(0.000125, Math.sqrt(p / (2 * b.length)));
  ROOM = { ir: ch, scale: (1 / p) * Math.pow(10, -58 / 20) * (44100 / FS) };
  return ROOM;
}

// the synth fed the engine's posts (at audio times) and run for secs; the bus (dry + 2.0 × room) in L, R
function play(Sound, posts, secs, seed = 9) {
  if (!reg['cmw-synth']) vm.runInThisContext(Sound.WORKLET_SRC.replace("'use strict';", ''));
  const node = new reg['cmw-synth']({ processorOptions: { seed } });
  const Q = Math.ceil(secs * FS / 128), len = Q * 128;
  const dry = [new Float64Array(len), new Float64Array(len)], wet = [new Float64Array(len), new Float64Array(len)];
  const o = Array.from({ length: 8 }, () => [new Float32Array(128), new Float32Array(128)]);
  global.currentFrame = 0;
  node.port.onmessage({ data: posts.map((c) => Object.assign({}, c)) });
  for (let q = 0; q < Q; q++) {
    global.currentFrame = q * 128;
    for (const a of o) for (const c of a) c.fill(0);
    node.process([], o);
    const off = q * 128;
    for (let k = 0; k < 8; k++) { const T = k & 1 ? wet : dry; for (let c = 0; c < 2; c++) { const s = o[k][c], d = T[c]; for (let i = 0; i < 128; i++) d[off + i] += s[i]; } }
  }
  const Rm = room(Sound), L = new Float32Array(len), R = new Float32Array(len);
  const wl = convolve(wet[0], Rm.ir[0], len), wr = convolve(wet[1], Rm.ir[1], len);
  for (let i = 0; i < len; i++) { L[i] = dry[0][i] + 2.0 * Rm.scale * wl[i]; R[i] = dry[1][i] + 2.0 * Rm.scale * wr[i]; }
  return { L, R, fs: FS };
}
const dbfs = (v) => 20 * Math.log10(Math.max(v, 1e-12));
function peakOf(o) { let p = 0; for (const c of [o.L, o.R]) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > p) p = v; } return p; }
function finite(o) { for (const c of [o.L, o.R]) for (let i = 0; i < c.length; i++) if (!Number.isFinite(c[i])) return false; return true; }
// 50 ms windows: RMS of both channels, dBFS
function windows(o) { const W = Math.round(0.05 * o.fs), out = []; for (let s = 0; s + W <= o.L.length; s += W) { let e = 0; for (let i = s; i < s + W; i++) e += o.L[i] * o.L[i] + o.R[i] * o.R[i]; out.push({ t: s / o.fs, db: dbfs(Math.sqrt(e / (2 * W))) }); } return out; }
// clicks: the largest third difference against the local RMS of the third difference (±10 ms)
function clickScore(o) {
  let worst = 0, at = 0;
  for (const x of [o.L, o.R]) {
    const len = x.length, d = new Float64Array(len), P = new Float64Array(len + 1), W = Math.round(0.01 * o.fs);
    for (let i = 3; i < len; i++) d[i] = x[i] - 3 * x[i - 1] + 3 * x[i - 2] - x[i - 3];
    for (let i = 0; i < len; i++) P[i + 1] = P[i] + d[i] * d[i];
    for (let i = W; i < len - W; i++) { const r = Math.sqrt((P[i + W] - P[i - W]) / (2 * W)); if (r < 1e-7) continue; const v = Math.abs(d[i]) / r; if (v > worst) { worst = v; at = i / o.fs; } }
  }
  return { worst, at };
}

// (required as a module, by a harness outside the repo: the sandbox, the synth and the measures, without the run)
module.exports = { H, play, windows, clickScore, peakOf, finite, dbfs, FS };
if (require.main === module) (async () => {
  async function engine(glide) {
    const E = H.makeEnv({ worklet: true }), S = E.Sound;
    S.set({ on: true, sonify: true, events: true, glide }, { quiet: true });
    E.listeners.pointerdown.forEach((f) => f({ type: 'pointerdown' }));
    for (let k = 0; k < 5 && S.state().engine === 'loading'; k++) await H.flush();
    return { E, S };
  }
  const rows = [];
  async function scene(name, glide, again) {
    const sc = H.SC[name], { E, S } = await engine(glide);
    const HTL = S.HT, smp = H.probe(sc, HTL, { rope: sc.seasong ? 0 : HTL.HT.rope });
    const cues = H.finalCues(sc, smp).map((c) => ({ t: c.t, m: c.m, zero: c.zero, pan: 0.3 * clamp(c.x / sc.halfW, -1, 1) }));
    const s2 = smp.map((p) => (p.gap ? { t: p.t, gap: true } : { t: p.t, phi: p.phi, ln: p.ln, pan: p.pan, seat: p.seat, cut: p.cut }));
    E.posts.length = 0;
    const r = S.along(s2, { tag: 'acc', n: 12, cues });
    if (!r) throw new Error(name + ': along refused');
    const posts = E.posts.slice();
    const last = posts.reduce((m, c) => Math.max(m, c.at || 0), 0);
    const lastNote = posts.filter((c) => c.k === 'cue' && c.grp === 'ht').reduce((m, c) => Math.max(m, c.at || 0), 0);
    const lastGl = posts.filter((c) => c.k === 'gl').reduce((m, c) => Math.max(m, c.at || 0), 0);
    const o = play(S, posts, last + 3.2);
    const lim = S.LIB.Limiter(FS, Math.pow(10, -8.8 / 20)), pk = peakOf(o);
    const out = { L: o.L.slice(), R: o.R.slice(), fs: FS };
    lim.process(out.L, out.R, out.L.length);
    const w = windows(o), loud = Math.max(...w.map((x) => x.db));
    const ringFrom = glide ? lastGl + 0.8 + 0.4 : lastNote + 0.82 + 0.4;
    const ringMax = Math.max(-200, ...w.filter((x) => x.t >= ringFrom).map((x) => x.db));
    const quietMax = Math.max(-200, ...w.filter((x) => x.t >= last + 2).map((x) => x.db));
    const ck = clickScore(o);
    const tagv = `${name} ${glide ? 'glide' : 'notes'}`;
    const row = { scene: tagv, mode: r.mode, counts: r.counts, posts: posts.length, peakDb: +dbfs(pk).toFixed(2), limPct: +(100 * lim.st.acted / lim.st.n).toFixed(3), clicks: +ck.worst.toFixed(1), clickAt: +ck.at.toFixed(3), ringDb: +(ringMax - loud).toFixed(1), quietDb: +quietMax.toFixed(1) };
    rows.push(row);
    check(`${tagv}: Listen along in its mode`, r.mode === (glide ? 'glide' : 'notes'), r.mode);
    check(`${tagv}: every sample finite`, finite(o) && finite(out));
    check(`${tagv}: the bus's peak ≤ −8.3 dBFS before the limiter`, row.peakDb <= -8.3, row.peakDb);
    check(`${tagv}: the limiter idle`, lim.st.acted === 0, row.limPct + '%');
    check(`${tagv}: no clicks (third difference < 15× its local RMS)`, ck.worst < 15, `${row.clicks} at ${row.clickAt} s`);
    check(`${tagv}: rung down 60 dB within ${glide ? '0.8' : '0.82'} + 0.4 s`, ringMax - loud <= -60, `${row.ringDb} dB`);
    check(`${tagv}: silent (≤ −80 dBFS) from 2 s after the last change`, quietMax <= -80, `${row.quietDb} dBFS`);
    if (again) {
      const { E: E2, S: S2 } = await engine(glide);
      E2.posts.length = 0;
      S2.along(s2, { tag: 'acc', n: 12, cues });
      const o2 = play(S2, E2.posts.slice(), last + 3.2);
      let same = o2.L.length === o.L.length;
      for (let i = 0; same && i < o.L.length; i++) if (o.L[i] !== o2.L[i] || o.R[i] !== o2.R[i]) same = false;
      check(`${tagv}: deterministic (two renders identical)`, same);
    }
  }
  for (const name of Object.keys(H.SC)) {
    if (only && !only.test(name)) continue;
    await scene(name, false, name === 'sqrt-cut');
    // the Glide on every scene: also approach, the double pole and essential, which the prototype never rendered
    await scene(name, true, name === 'sqrt-cut');
  }
  // the catalog at its loudest: each cue (order 8 for the zero, pole and dense cues) alone, at the bus
  if (!only) {
    const { S } = await engine(false);
    const cat = [];
    for (const name of Object.keys(S.CATALOG)) {
      const posts = [], g = { c: { sampleRate: FS }, synth: { post: (l) => posts.push(...l) }, offline: true };
      S.seed(3);
      S.cueTo(g, name, 0.05, { order: 8, w: 3, k: 1, q: 2, seed: 7 });
      if (!posts.length) continue;
      const end = posts.reduce((m, c) => Math.max(m, c.at || 0), 0);
      const o = play(S, posts, end + 2.5), p = dbfs(peakOf(o));
      cat.push(`${name} ${p.toFixed(1)}`);
      check(`catalog ${name}: finite`, finite(o));
      check(`catalog ${name}: at its loudest ≤ −8.8 dBFS at the bus`, p <= -8.8, p.toFixed(2));
    }
    console.log('catalog peaks (dBFS at the bus):', cat.join(', '));
  }
  for (const r of rows) console.log(JSON.stringify(r));
  console.log(bad ? `${bad}/${n} sound acceptance checks FAILED` : `${n}/${n} sound acceptance checks passed`);
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
