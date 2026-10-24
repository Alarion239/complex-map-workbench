// node tools/hv_check.js: the singer of options 3 and 4 at rest (snd-1). Renders the hf-engine with the spectrum the
// ring plays at a few points, and reports each harmonic's share of the energy (Goertzel over 1 s of the steady tone),
// the hum's level re the note, and the band shares (250–500 Hz, 0.5–2 kHz, 2–5 kHz). Targets: hum −6 to −8 dB re the
// note, 2–5 kHz −20 to −25 dB, the note the strongest harmonic above the 3rd.
const path = require('path'), H = path.resolve(__dirname, '..');
const FS = 48000; global.sampleRate = FS; global.currentFrame = 0; const reg = {};
global.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
global.registerProcessor = (n, c) => { reg[n] = c; };
require(path.join(H, 'proto', 'worklet.js'))();
const C = require(path.join(H, 'proto', 'core.js'));
const F0 = 146.8324;
function run(cmds, secs) { const p = new reg['hf-engine']({ processorOptions: { cmds, seed: 3 } }), n = Math.ceil(secs * FS / 128), L = new Float32Array(n * 128), o = [[new Float32Array(128), new Float32Array(128)]];
  for (let q = 0; q < n; q++) { global.currentFrame = q * 128; o[0][0].fill(0); o[0][1].fill(0); p.process([], o); L.set(o[0][0], q * 128); } return L; }
function goertzel(x, f) { const w = 2 * Math.PI * f / FS, c = 2 * Math.cos(w); let s1 = 0, s2 = 0; for (let i = 0; i < x.length; i++) { const hw = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (x.length - 1)); const s = x[i] * hw + c * s1 - s2; s2 = s1; s1 = s; } return s1 * s1 + s2 * s2 - c * s1 * s2; }
// energy per band and per harmonic (bins within ±F0/2 of n F0, so the vibrato's spread is counted), by a DFT on
// Hann-windowed 4096-sample frames
function bands(x) {
  const N = 4096, out = { lo: 0, mid: 0, hi: 0, tot: 0, h: new Float64Array(25) };
  for (let s = 0; s + N <= x.length; s += N / 2) for (let k = 1; k < N / 2; k++) { const f = k * FS / N; if (f > 6000) break; let re = 0, im = 0; for (let i = 0; i < N; i += 1) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N), a = -2 * Math.PI * k * i / N; re += w * x[s + i] * Math.cos(a); im += w * x[s + i] * Math.sin(a); } const e = re * re + im * im; out.tot += e; if (f >= 250 && f < 500) out.lo += e; else if (f >= 500 && f < 2000) out.mid += e; else if (f >= 2000 && f < 5000) out.hi += e; const n = Math.round(f / F0); if (n >= 1 && n <= 24) out.h[n] += e; }
  return out; }
const db = (x) => (10 * Math.log10(x)).toFixed(1);
for (const [name, fnId, x, y, vow] of [['ring, nothing inside (z² − 1 at 1.5i)', 'z2m1', 0, 1.5, 0], ['ring, a zero inside (z² − 1 near 1)', 'z2m1', 1.02, 0.03, 0], ['ring, a pole inside ((z − 1)/(z + 1) near −1)', 'mob', -0.98, 0.03, 0], ['curve vowel /a/, nothing inside', 'z2m1', 0, 1.5, 1]]) {
  const fn = C.byId[fnId], sp = C.ringSpectrum(fn, null, x, y, 20 / (386 / (2 * fn.view[2]))), R = C.ringAmps(sp, false);
  const x0 = run([{ k: 'hv', at: 0.02, amps: R.A, lvl: C.LV.hv, hum: 0.45, vow }, { k: 'hv', at: 0.02, gate: 1, t1: 0.01 }], 2.2).slice(FS, 2 * FS);
  const hum = run([{ k: 'hv', at: 0.02, amps: new Array(24).fill(0), lvl: C.LV.hv, hum: 0.45, vow }, { k: 'hv', at: 0.02, gate: 1, t1: 0.01 }], 2.2).slice(FS, 2 * FS);
  const b = bands(x0), bh = bands(hum), e = Array.from(b.h).slice(1), tot = b.tot;
  let best = 4; for (let n = 4; n <= 24; n++) if (e[n - 1] > e[best - 1]) best = n;
  const eNote = e[R.n0 - 1], eHum = bh.tot;
  console.log(name, '| W', R.W, 'note h' + R.n0, '| strongest above the 3rd: h' + best, '| shares (dB) h1..h8:', e.slice(0, 8).map((v) => db(v / tot)).join(' '), '| hum re note', db(eHum / eNote), 'dB | bands 250–500', db(b.lo / b.tot), '0.5–2k', db(b.mid / b.tot), '2–5k', db(b.hi / b.tot));
}
