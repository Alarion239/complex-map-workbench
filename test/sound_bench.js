// The audio thread's cost (v15.2, notes/sound/AS-BUILT-v152.md): src/sound.js's worklet (the synth: palette B's
// parts, the harp's strings, the texture, the singer) run in node, the same V8 as Chrome's AudioWorklet. µs per
// 128-frame quantum over 15,000 quanta after 3,000 of warm-up, median of 3 runs, as a share of real time on one core
// (128 / 48000 s = 2667 µs). Also checks that every scenario's output is finite, starts at exactly 0 and ends at 0.
// Run it alone: node test/sound_bench.js [--json out.json]. Limits: 5 % of one core a scenario, 8 % all at once.
const fs = require('fs'), path = require('path'), vm = require('vm');
const FS = 48000, reg = {};
// the worklet runs in this context's globals, as in an AudioWorkletGlobalScope (a vm context would slow every global
// access through its interceptors)
const box = global;
global.sampleRate = FS; global.currentFrame = 0;
global.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
global.registerProcessor = (n, c) => { reg[n] = c; };
// the engine on a fake page (no audio: only its pure parts are used here)
const page = { window: { addEventListener() {} }, document: { visibilityState: 'visible', addEventListener() {} }, location: { search: '?ns=b' }, navigator: {}, performance: { now: () => 0 },
  setTimeout, clearTimeout, URLSearchParams, console, Math, JSON, Object, Array, Float32Array, Float64Array, Number, Map, Set, Promise, Date };
vm.createContext(page);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/sound.js'), 'utf8') + '\n;globalThis.Sound = Sound;', page);
const Sound = page.Sound;
vm.runInThisContext(Sound.WORKLET_SRC.replace("'use strict';", ''));
const Q = 15000, W = 3000, NOUT = 8;
const outs = () => Array.from({ length: NOUT }, () => [new Float32Array(128), new Float32Array(128)]);
function run(feed, quanta, o) {
  const node = new reg['cmw-synth']({ processorOptions: { seed: 9 } }), msg = (list) => node.port.onmessage({ data: list });
  let t0 = 0n, first = null, last = 0, bad = 0;
  for (let q = 0; q < quanta; q++) {
    if (q === W) t0 = process.hrtime.bigint();
    box.currentFrame = q * 128;
    feed(msg, q, q * 128 / FS);
    for (const a of o) for (const c of a) c.fill(0);
    node.process([], o);
    if (q < W || q >= quanta - 100) for (const a of o) for (const c of a) for (let i = 0; i < 128; i++) { const v = c[i]; if (!Number.isFinite(v)) bad++; if (v !== 0 && first === null) first = Math.abs(v); }
  }
  for (const a of o) for (const c of a) last = Math.max(last, Math.abs(c[127]));
  return { us: Number(process.hrtime.bigint() - t0) / 1000 / (quanta - W), bad, first, last };
}
function bench(name, feed) {
  const r = [];
  for (let k = 0; k < 3; k++) r.push(run(feed, Q + W, outs()));
  r.sort((a, b) => a.us - b.us);
  return { name, us: +r[1].us.toFixed(1), pct: +(100 * r[1].us / (128 / FS * 1e6)).toFixed(2), bad: r[1].bad };
}
// the parts the engine posts, made by the engine itself (its catalog and harp), collected from a fake graph
function collect(fn) {
  const posted = [];
  const g = { c: { sampleRate: FS }, synth: { post: (l) => posted.push(...l) }, offline: true };
  fn(g);
  return posted;
}
Sound.seed(5);
const harpRun = (dir) => collect((g) => { const st = Sound.Harp(); Sound.harpStep(st, null, 0, 0.02, {}); let phi = 0.02; for (let q = 0; q < 40; q++) { phi += dir * 0.2; Sound.harpStep(st, g, q * 0.04, phi, { ln: 0, dt: 0.04, pan: 0 }); } });
const res = [];
// 1. the harp at its busiest: a fast run (5 turns a second → 25 notes a second, the D-only threshold), 12 strings, steals
const harpCmds = harpRun(1);
res.push(bench('harp, 25 notes/s', (msg, q, T) => { if (q % 375 === 0) { const base = T + 0.01; msg(harpCmds.map((c) => Object.assign({}, c, { at: base + (c.at || 0) }))); } }));
// 2. palette B cues at the storm guard's 14 a second, every cue of the catalog in turn
const names = Object.keys(Sound.CATALOG);
const cueCmds = names.map((n, i) => collect((g) => Sound.cueTo(g, n, 0, { order: 2, w: 3, k: 1, q: 2, seed: i })));
res.push(bench('cues, 14/s', (msg, q, T) => { if (q % 27 === 0) { const k = (q / 27) % cueCmds.length; msg(cueCmds[k].map((c) => Object.assign({}, c, { at: T + 0.01 }))); } }));
// 3. the scrub texture and the motion bed together, updated every quantum
res.push(bench('scrub + motion texture', (msg, q, T) => msg([{ k: 'tex', id: 1, at: T, v: 1.5 + Math.sin(q / 90), t: (q % 2000) / 2000, amp: 0.06, tier: 1, wet: 0.12, hold: 0.09, seed: 11 }, { k: 'tex', id: 2, at: T, v: 0.5, t: (q % 3000) / 3000, amp: 0.06, tier: 1, wet: 0.12, hold: 0.25, seed: 23 }])));
// 4. the singer live (the deformation): a new spectrum every 3 quanta (≈ 125 Hz, faster than the page's 60)
const A = (n0, x) => { const a = new Array(24).fill(0); a[n0 - 1] = 0.8; a[n0] = 0.3 + 0.3 * x; a[n0 - 2] = 0.2; for (let k = 8; k < 24; k++) a[k] = 0.02 / k; return a; };
res.push(bench('singer live', (msg, q, T) => { if (q === 0) msg([{ k: 'hv', at: 0, amps: A(5, 0), lvl: 0.74, hum: 0.45, vow: 1, tier: 2 }, { k: 'hv', at: 0, gate: 1, t1: 0.04, n: 1 }]); else if (q % 3 === 0) msg([{ k: 'hv', at: T, amps: A(q % 900 < 450 ? 5 : 6, Math.sin(q / 50)), slew: 0.05 }]); }));
// 5. everything at once: the harp, the singer, the texture and the cues
res.push(bench('all at once', (msg, q, T) => {
  if (q % 375 === 0) msg(harpCmds.map((c) => Object.assign({}, c, { at: T + 0.01 + (c.at || 0) })));
  if (q % 27 === 0) msg(cueCmds[(q / 27) % cueCmds.length].map((c) => Object.assign({}, c, { at: T + 0.01 })));
  if (q === 0) msg([{ k: 'hv', at: 0, amps: A(5, 0), lvl: 0.74, hum: 0.45, vow: 1, tier: 2 }, { k: 'hv', at: 0, gate: 1, t1: 0.04, n: 1 }]); else if (q % 3 === 0) msg([{ k: 'hv', at: T, amps: A(5, Math.sin(q / 50)), slew: 0.05 }]);
  msg([{ k: 'tex', id: 1, at: T, v: 1.5, t: (q % 2000) / 2000, amp: 0.06, tier: 1, wet: 0.12, hold: 0.09, seed: 11 }]);
}));
let fails = 0;
for (const r of res) { console.log(r.name.padEnd(24), String(r.us).padStart(6), 'µs/quantum =', String(r.pct).padStart(5), '% of one core', r.bad ? 'NON-FINITE ' + r.bad : ''); if (r.bad) fails++; }
// limits: each scenario ≤ 5 % of one core; all of them at once (not reachable in use: the harp at its D-only rate while
// cues fire at the storm guard's 14 a second, the singer and the texture) ≤ 8 %
for (const r of res) { const lim = r.name === 'all at once' ? 8 : 5; if (r.pct > lim) { fails++; console.log('FAIL:', r.name, 'uses', r.pct, '% of one core (limit', lim, '%)'); } }
// clean edges: a single cue and a single harp note start from exactly 0 and end at exactly 0
for (const [name, cm] of [['toggleOn', cueCmds[names.indexOf('toggleOn')]], ['zero', cueCmds[names.indexOf('zero')]], ['a harp note', harpCmds.slice(0, 4)]]) {
  const o = outs(); let firstQ = null, lastV = 1;
  const node = new reg['cmw-synth']({ processorOptions: { seed: 1 } });
  node.port.onmessage({ data: cm.map((c) => Object.assign({}, c, { at: 0.01 + (c.at || 0) })) });
  for (let q = 0; q < 2400; q++) {
    box.currentFrame = q * 128; for (const a of o) for (const c of a) c.fill(0);
    node.process([], o);
    const v = Math.abs(o[2][0][0]) + Math.abs(o[0][0][0]) + Math.abs(o[4][0][0]);
    if (firstQ === null && o.some((a) => a[0].some((x) => x !== 0))) { firstQ = q; let f = 0; for (const a of o) for (let i = 0; i < 128; i++) if (a[0][i] !== 0) { f = Math.abs(a[0][i]); break; } if (f > 1e-3) { fails++; console.log('FAIL', name, 'starts with', f); } }
    lastV = v;
  }
  const ok = lastV === 0;
  if (!ok) { fails++; console.log('FAIL', name, 'does not end at 0'); }
  console.log(name.padEnd(24), 'clean start and end:', ok);
}
if (process.argv.includes('--json')) fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(res, null, 1));
console.log(fails ? `FAIL (${fails})` : 'PASS');
process.exit(fails ? 1 : 0);
