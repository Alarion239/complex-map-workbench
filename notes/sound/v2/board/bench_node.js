// node bench_node.js: the B worklet's processors in node (same V8 as Chrome's worklet thread), fake globals.
// Checks every cue starts and ends at exactly 0 and has no NaN, and measures µs per 128-frame quantum per voice kind,
// against the app's own voice worklet (extracted from src/sound.js as notes/sound/cdp3/bench.js does).
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '../../../..');
global.sampleRate = 48000; global.currentFrame = 0;
const reg = {};
global.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
global.registerProcessor = (n, c) => { reg[n] = c; };
global.Sound = { hNote: (k) => 587.33 * Math.pow(2, k / 5), ShepardVoice: null };
const src = fs.readFileSync(path.join(__dirname, 'engine_b.js'), 'utf8');
const SoundB = new Function(src + '\nreturn SoundB;')();
eval(SoundB.SRC);
const Synth = reg['cmwb-synth'], Choir = reg['cmw-voice'];
const outs = () => Array.from({ length: 6 }, () => [new Float32Array(128), new Float32Array(128)]);
const zero = (o) => { for (const p of o) for (const ch of p) ch.fill(0); };
function renderCue(name, o, secs = 2) {
  const P = []; SoundB.CAT[name].make(P, o);
  const s = new Synth({ processorOptions: { cmds: [{ k: 'cue', at: 0, tier: 1, pan: 0, wet: 0.1, g: 1, parts: P }] } });
  const n = Math.ceil(secs * 48000 / 128), y = new Float32Array(n * 128); const o2 = outs();
  for (let q = 0; q < n; q++) { global.currentFrame = q * 128; zero(o2); s.process([], o2); for (let i = 0; i < 128; i++) y[q * 128 + i] = o2[2][0][i]; }
  return { y, s, parts: P.length };
}
const rep = { cues: {}, cpu: {} };
for (const [name, o] of [['toggleOn', {}], ['toggleOff', {}], ['stepAdd', {}], ['stepRemove', {}], ['view', { k: 1 }], ['exportDone', {}], ['error', {}], ['edge', {}], ['snap', {}], ['morphStart', {}], ['morphEnd', {}], ['landmark', { q: 2 }], ['endBump', {}], ['loopDone', { w: 2 }], ['loopDone', { w: 0 }], ['cut', {}], ['zero', { order: 2 }], ['pole', { order: 1 }], ['dense', {}], ['contour', { k: 0 }], ['turn', { pc: 0.3, dir: 1 }], ['turnMany', {}], ['collide', {}]]) {
  const { y, s, parts } = renderCue(name, o);
  let pk = 0, nan = 0, last = 0; for (let i = 0; i < y.length; i++) { const a = Math.abs(y[i]); if (!(a === a)) nan++; pk = Math.max(pk, a); if (a > 0) last = i; }
  rep.cues[name + (o.w != null ? o.w : '')] = { parts, peak: +pk.toFixed(4), first: y[0], endsAt_ms: +(last / 48).toFixed(1), done: s.cues.length === 0, nan, lastAbs: Math.abs(y[last]).toExponential(2) };
}
// CPU: µs per quantum
function bench(label, mk, step, Q = 15000) {
  const v = mk(); const o2 = outs(); let t0;
  for (let q = 0; q < Q + 1500; q++) { if (q === 1500) t0 = process.hrtime.bigint(); step && step(v, q); global.currentFrame = q * 128; zero(o2); v.process([], o2.slice(0, v instanceof Synth ? 6 : 1)); }
  const us = Number(process.hrtime.bigint() - t0) / 1000 / Q; rep.cpu[label] = { us_per_quantum: +us.toFixed(2), pct_one_core: +(100 * us / (128 / 48000 * 1e6)).toFixed(2) };
}
const moveCmd = (q) => ({ at: q * 128 / 48000, ds: 0.05, dur: 0.016, cc: 4 + 0.3 * Math.sin(q / 50), loud: 0.8, pan: 0.1 });
bench('B choir (moving)', () => new Choir({ processorOptions: { kind: 'shepard', seed: 3, cmds: [{ at: 0, snap: 0.2, cc: 4.1, loud: 1, pan: 0 }, { at: 0, gate: 1, tau: 0.02 }] } }), (v, q) => { if (q % 3 === 0) v.push(moveCmd(q)); });
bench('B choir (resting)', () => new Choir({ processorOptions: { kind: 'shepard', seed: 3, cmds: [{ at: 0, snap: 0.2, cc: 4.1, loud: 1, pan: 0 }, { at: 0, gate: 1, tau: 0.02 }] } }));
bench('B synth idle', () => new Synth({ processorOptions: {} }));
bench('B texture (dragging)', () => new Synth({ processorOptions: {} }), (v, q) => { if (q % 3 === 0) v.push({ k: 'tex', id: 1, at: q * 128 / 48000, v: 1.2, t: 0.5 + 0.5 * Math.sin(q / 100) }); });
const P1 = []; SoundB.CAT.zero.make(P1, { order: 1 });
bench('B one glass strike sounding (8 modes + contact)', () => new Synth({ processorOptions: {} }), (v, q) => { if (q % 200 === 0) v.push({ k: 'cue', at: q * 128 / 48000, tier: 2, pan: 0, wet: 0.2, g: 1, parts: P1 }); });
const P2 = []; SoundB.CAT.loopDone.make(P2, { w: 8 });
bench('B 8 glass pings overlapping (loop W = 8)', () => new Synth({ processorOptions: {} }), (v, q) => { if (q % 400 === 0) v.push({ k: 'cue', at: q * 128 / 48000, tier: 1, pan: 0, wet: 0.2, g: 1, parts: P2 }); });
// the app's voice worklet (A)
const html = fs.readFileSync(path.join(ROOT, 'notes/v15-candidate/src/sound.js'), 'utf8');
const m = html.match(/const WORKLET_SRC = `([\s\S]*?)`;\n/);
const SH = { N: 9, fLo: 36.70810, sigma: 0.95, c0: 4.1, swing: 0.3, amp: 0.028, edge: 0.5 }, ORGAN = [1, 1 / 2, 1 / 3, 1 / 4];
const ORGAN_NORM = (() => { let mm = 0; for (let i = 0; i < 4096; i++) { const a = 2 * Math.PI * i / 4096; let s = 0; for (let n = 0; n < 4; n++) s += ORGAN[n] * Math.sin((n + 1) * a); mm = Math.max(mm, Math.abs(s)); } return 1 / mm; })();
const asrc = eval('`' + m[1] + '`'); const before = reg['cmw-voice']; eval(asrc); const AVoice = reg['cmw-voice'];
bench('A Shepard voice (moving)', () => new AVoice({ processorOptions: { kind: 'shepard', cmds: [{ at: 0, snap: 0.2, cc: 4.1, loud: 1, pan: 0 }, { at: 0, gate: 1, tau: 0.02 }] } }), (v, q) => { if (q % 3 === 0) v.push(moveCmd(q)); });
console.log(JSON.stringify(rep, null, 1));
