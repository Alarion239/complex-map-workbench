// node tools/bench.js: the audio thread's cost of each option in its busiest steady state, in node (the same V8 as
// Chrome's AudioWorklet): µs per 128-frame quantum over 15,000 quanta after 3,000 of warm-up, median of 3 runs, as a
// percentage of real time on one core (128 / 48000 s = 2667 µs). Run it alone (other load inflates the numbers).
const path = require('path'), H = path.resolve(__dirname, '..');
const FS = 48000; global.sampleRate = FS; global.currentFrame = 0; const reg = {};
global.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
global.registerProcessor = (n, c) => { reg[n] = c; };
const Timbres = require(path.join(H, '..', 'v2', 'timbres.js')); eval(Timbres.SRC);
require(path.join(H, 'proto', 'worklet.js'))();
const C = require(path.join(H, 'proto', 'core.js'));
const Q = 15000, W = 3000;
function bench(make, feed) {
  const runs = [];
  for (let rep = 0; rep < 3; rep++) {
    C.setSeed(3 + rep); const nodes = make(), o = [[new Float32Array(128), new Float32Array(128)]]; let t0 = 0n;
    for (let q = 0; q < Q + W; q++) {
      if (q === W) t0 = process.hrtime.bigint();
      global.currentFrame = q * 128; const T = q * 128 / FS;
      feed(nodes, q, T);
      for (const n of nodes) n.process([], o);
    }
    runs.push(Number(process.hrtime.bigint() - t0) / 1000 / Q);
  }
  runs.sort((a, b) => a - b); return runs[1];
}
const msg = (n, list) => n.port.onmessage({ data: list });
const rep = (name, us) => console.log(name.padEnd(26), us.toFixed(1).padStart(6), 'µs/quantum =', (100 * us / (128 / FS * 1e6)).toFixed(2).padStart(5), '% of one core');
const eng = () => new reg['hf-engine']({ processorOptions: { seed: 1 } });
const res = {};
// today: the Shepard voice moving (a frame every 3 quanta ≈ 125 Hz, faster than the page's 60)
res.today = bench(() => [eng()], (n, q, T) => { if (q === 0) msg(n[0], [{ k: 'sh', at: 0, snap: 0.1, cc: 4.1, loud: 1 }, { k: 'sh', at: 0, gate: 1, tau: 0.02 }]); else if (q % 3 === 0) msg(n[0], [{ k: 'sh', at: T, ds: 0.01, dur: 0.016, cc: 4.1 + 0.3 * Math.sin(q / 50), loud: 0.8 }]); });
for (const kind of ['cello', 'choir', 'glass', 'reed']) {
  res['sung-' + kind] = bench(() => [eng(), new reg['cmw-timbre']({ processorOptions: { kind, seed: 7 } }), new reg['cmw-timbre']({ processorOptions: { kind, seed: 9 } })], (n, q, T) => {
    if (q === 0) { msg(n[1], [{ at: 0, snap: 0.1, cc: 4.1, loud: 1, pan: 0 }, { at: 0, gate: 1, tau: 0.04 }]); msg(n[2], [{ at: 0, snap: 0, cc: 4.1, loud: 0.178, pan: 0 }, { at: 0, gate: 1, tau: 0.08 }]); }
    else if (q % 3 === 0) msg(n[1], [{ at: T, ds: 0.01, dur: 0.016, cc: 4.1 + 0.3 * Math.sin(q / 50), loud: 0.9, pan: 0 }]);
  });
}
// the harp at its busiest: 24 notes a second (the rate above which only Ds sound), 12 strings ringing, steals
for (const mat of ['string', 'glass']) {
  res['harp-' + mat] = bench(() => [eng()], (n, q, T) => { if (q % 16 === 0) { const cm = []; const h = new C.Harp({ eng: (c) => cm.push(c) }, { mat }); h.note((q / 16) % 5, 0.7, T, 0, 1); msg(n[0], cm); } });
}
// the singer (options 3 and 4): new amplitudes every 3 quanta, a zero's harmonic swelling and fading
res.singer = bench(() => [eng()], (n, q, T) => { const A = new Array(24).fill(0); A[3] = 0.8; A[4] = 0.5 + 0.4 * Math.sin(q / 100); A[2] = 0.2; for (let k = 6; k < 24; k++) A[k] = 0.05 / k;
  if (q === 0) msg(n[0], [{ k: 'hv', at: 0, amps: A, lvl: 1, hum: 0.45, vow: 0 }, { k: 'hv', at: 0, gate: 1, t1: 0.01 }]); else if (q % 3 === 0) msg(n[0], [{ k: 'hv', at: T, amps: A, slew: 0.03 }]); });
for (const [k, v] of Object.entries(res)) rep(k, v);
require('fs').writeFileSync(path.join(H, 'tools', 'bench.json'), JSON.stringify(Object.fromEntries(Object.entries(res).map(([k, v]) => [k, { us: +v.toFixed(1), pct: +(100 * v / (128 / FS * 1e6)).toFixed(2) }])), null, 1));
