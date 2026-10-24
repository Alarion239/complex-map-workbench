// node tools/calib.js: the level of each sound of options.html against its target (OPTIONS.md): today's voice at rest
// at |F| = 1 (−32.8 LUFS-M, the app's measured level), one harp note at velocity 0.7 (−32), the singer at home (−32),
// the cues (palette B's −31). Prints LUFS-M (loudest 400 ms) and the gain change to reach the target.
const path = require('path'), H = path.resolve(__dirname, '..');
const FS = 48000; global.sampleRate = FS; global.currentFrame = 0; const reg = {};
global.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
global.registerProcessor = (n, c) => { reg[n] = c; };
require(path.join(H, 'proto', 'worklet.js'))();
const C = require(path.join(H, 'proto', 'core.js'));
function kw(x) { const y = new Float64Array(x.length); let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]; const s = 1.53512485958697 * v - 2.69169618940638 * a1 + 1.19839281085285 * a2 + 1.69065929318241 * b1 - 0.73248077421585 * b2; a2 = a1; a1 = v; b2 = b1; b1 = s;
    const u = s - 2 * c1 + c2 + 1.99004745483398 * d1 - 0.99007225036621 * d2; c2 = c1; c1 = s; d2 = d1; d1 = u; y[i] = u; } return y; }
function lufsMax(L, R) { const kl = kw(L), kr = kw(R), W = 0.4 * FS; let best = -1e9; for (let s = 0; s + W <= L.length; s += 480) { let e = 0; for (let i = s; i < s + W; i++) e += kl[i] * kl[i] + kr[i] * kr[i]; best = Math.max(best, -0.691 + 10 * Math.log10(e / W + 1e-30)); } return best; }
function run(cmds, secs) { const p = new reg['hf-engine']({ processorOptions: { cmds, seed: 3 } }), n = Math.ceil(secs * FS / 128), L = new Float32Array(n * 128), R = new Float32Array(n * 128), o = [[new Float32Array(128), new Float32Array(128)]];
  for (let q = 0; q < n; q++) { global.currentFrame = q * 128; o[0][0].fill(0); o[0][1].fill(0); p.process([], o); L.set(o[0][0], q * 128); R.set(o[0][1], q * 128); } return { L, R }; }
const rep = (name, v, target) => console.log(name.padEnd(34), v.toFixed(2), 'LUFS-M  target', target, ' → gain ×', Math.pow(10, (target - v) / 20).toFixed(3));
// today: rest at pc 0 and 0.5, |F| = 1
for (const pc of [0, 0.25, 0.5]) { const r = run([{ k: 'sh', at: 0.05, snap: pc, cc: 4.1, loud: 1 }, { k: 'sh', at: 0.05, gate: 1, tau: 0.02 }], 2); rep('today rest pc ' + pc, lufsMax(r.L, r.R), -32.8); }
// harp: one note per pitch class at velocity 0.7, |F| = 1 (string, glass)
for (const mat of ['string', 'glass']) { const vals = [];
  for (let j = 0; j < 5; j++) { C.setSeed(20 + j); const cm = []; const h = new C.Harp({ eng: (c) => cm.push(c) }, { mat }); h.note(j, 0.7, 0.05, 0, 1); const r = run(cm, 2.5); vals.push(lufsMax(r.L, r.R)); }
  rep('harp ' + mat + ' (mean of D E F# A B)', vals.reduce((a, b) => a + b) / 5, -32); console.log('   per note', vals.map((v) => v.toFixed(1)).join(' ')); }
// the singer: home only (A4 = 1), with the hum; and a simple zero (A5 = 1)
for (const [nm, n] of [['singer at home (D5)', 4], ['singer F#5', 5], ['singer A4 (pole)', 3], ['singer D4', 2]]) { const A = new Array(24).fill(0); A[n - 1] = 1;
  for (const vow of [0, 1]) { const r = run([{ k: 'hv', at: 0.05, amps: A, lvl: C.LV.hv, hum: 0.45, vow }, { k: 'hv', at: 0.05, gate: 1, t1: 0.01 }], 2.5); rep(nm + (vow ? ' /a/' : ' /u/'), lufsMax(r.L, r.R), -32); } }
// cues
for (const [nm, o] of [['zero', { order: 1 }], ['zeroWood', { order: 1 }], ['pole', { order: 1 }], ['turn', { pc: 0, dir: 1 }], ['cut', {}]]) { const v = []; for (let s = 0; s < 4; s++) { C.setSeed(40 + s); const r = run([C.cue(nm, 0.05, o)], 1.5); v.push(lufsMax(r.L, r.R)); } rep('cue ' + nm, v.reduce((a, b) => a + b) / v.length, -31); }
