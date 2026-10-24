// node tools/measure.js [filter] [--save]: renders every option of options.html on the scripted gestures, offline, with
// the page's own code (proto/core.js → commands; proto/worklet.js and v2/timbres.js processors, run in node: the same V8
// as Chrome's AudioWorklet), and measures loudness (LUFS-M, BS.1770 K-weighting, 400 ms windows; the loudest window and
// the gated mean), peak, the first and last samples, and CPU (µs per 128-frame quantum while sounding, % of real time on
// one core). --save writes rec/<case>.f32 (+ .json for notes/sound/cdp3/det.py, the click detectors).
const fs = require('fs'), path = require('path');
const H = path.resolve(__dirname, '..'), OUT = path.join(H, 'tools', 'rec');
const FS = 48000; global.sampleRate = FS; global.currentFrame = 0;
const reg = {};
global.AudioWorkletProcessor = class { constructor() { this.port = { onmessage: null, postMessage() {} }; } };
global.registerProcessor = (n, c) => { reg[n] = c; };
const Timbres = require(path.join(H, '..', 'v2', 'timbres.js')); eval(Timbres.SRC);
require(path.join(H, 'proto', 'worklet.js'))();
const C = require(path.join(H, 'proto', 'core.js'));
const args = process.argv.slice(2), SAVE = args.includes('--save'), filt = args.find((a) => !a.startsWith('--')) || '';

// K-weighting (BS.1770, 48 kHz)
function kw(x) { const y = new Float64Array(x.length); let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i]; const s = 1.53512485958697 * v - 2.69169618940638 * a1 + 1.19839281085285 * a2 + 1.69065929318241 * b1 - 0.73248077421585 * b2; a2 = a1; a1 = v; b2 = b1; b1 = s;
    const u = s - 2 * c1 + c2 + 1.99004745483398 * d1 - 0.99007225036621 * d2; c2 = c1; c1 = s; d2 = d1; d1 = u; y[i] = u; } return y; }
function loud(L, R) {
  const kl = kw(L), kr = kw(R), W = Math.round(0.4 * FS), hop = Math.round(0.1 * FS), bl = [];
  for (let s = 0; s + W <= L.length; s += hop) { let e = 0; for (let i = s; i < s + W; i++) e += kl[i] * kl[i] + kr[i] * kr[i]; bl.push(e / W); }
  const lu = (e) => -0.691 + 10 * Math.log10(e + 1e-30);
  const max = Math.max(...bl.map(lu));
  const g1 = bl.filter((e) => lu(e) > -70); const m1 = g1.reduce((a, b) => a + b, 0) / Math.max(1, g1.length);
  const g2 = g1.filter((e) => lu(e) > lu(m1) - 10); const m2 = g2.reduce((a, b) => a + b, 0) / Math.max(1, g2.length);
  return { max: +max.toFixed(1), gated: g2.length ? +lu(m2).toFixed(1) : null, blocks: bl.map(lu) };
}

const LEAD = 0.03, RATE = 60;
function simulate(opt, fn, kind, set = {}) {
  C.setSeed(11);
  const cmds = { eng: [], voice: [], drone: [] }, starts = [];
  // every partial's designed onset (a cue's parts may start later than the cue: the turn bell's second strike, the
  // repeated strikes of a multiple zero) is registered for the click detector
  const out = { eng: (c) => { cmds.eng.push(c); if (c.k === 'cue') for (const d of new Set(c.parts.map((p) => p.d || 0))) starts.push({ id: starts.length + 1, k: 'cue', t: c.at + d, now: c.at + d }); }, voice: (c) => cmds.voice.push(c), drone: (c) => cmds.drone.push(c) };
  const g = C.gesture(fn, kind); if (!g) return null;
  const ss = new C.Session(out, opt, set), ppu = 320 / (2 * fn.view[2]);
  const T0 = 0.15; ss.start(T0, fn, g);
  let ctlMs = 0, frames = 0;
  for (let u = 0; u <= g.dur + 1e-9; u += 1 / RATE) { const pos = g.at(Math.min(u, g.dur)); const t0 = process.hrtime.bigint(); ss.frame(T0 + u + LEAD, pos, ppu); ctlMs += Number(process.hrtime.bigint() - t0) / 1e6; frames++; }
  ss.end(T0 + g.dur + LEAD + 1 / RATE);
  return { cmds, starts, dur: T0 + g.dur + 3.2, ctlMsPerFrame: ctlMs / frames, info: ss.info };
}
function render(sim, opt, set) {
  const n = Math.ceil(sim.dur * FS / 128), L = new Float32Array(n * 128), Rr = new Float32Array(n * 128);
  const nodes = [{ p: new reg['hf-engine']({ processorOptions: { cmds: sim.cmds.eng, seed: 5 } }), us: [] }];
  if (opt === 'sung') { nodes.push({ p: new reg['cmw-timbre']({ processorOptions: { kind: set.kind || 'cello', seed: 7, cmds: sim.cmds.voice } }), us: [] });
    if (set.drone !== false) nodes.push({ p: new reg['cmw-timbre']({ processorOptions: { kind: set.kind || 'cello', seed: 9, cmds: sim.cmds.drone } }), us: [] }); }
  const o = [[new Float32Array(128), new Float32Array(128)]];
  for (let q = 0; q < n; q++) {
    global.currentFrame = q * 128;
    for (const nd of nodes) { o[0][0].fill(0); o[0][1].fill(0); const t0 = process.hrtime.bigint(); nd.p.process([], o); nd.us.push(Number(process.hrtime.bigint() - t0) / 1000); for (let i = 0; i < 128; i++) { L[q * 128 + i] += o[0][0][i]; Rr[q * 128 + i] += o[0][1][i]; } }
  }
  return { L, R: Rr, nodes };
}
function stats(r) {
  let pk = 0, last = 0, first = Math.abs(r.L[0]) + Math.abs(r.R[0]); for (let i = 0; i < r.L.length; i++) { const a = Math.max(Math.abs(r.L[i]), Math.abs(r.R[i])); if (a > pk) pk = a; if (a > 1e-5) last = i; }
  // CPU: the sum over nodes, per quantum, over quanta where anything sounded (skip the first 20 quanta: JIT warm-up)
  const nq = r.nodes[0].us.length, tot = []; for (let q = 20; q < nq; q++) { let s = 0; for (const nd of r.nodes) s += nd.us[q]; tot.push(s); }
  tot.sort((a, b) => a - b); const mean = tot.reduce((a, b) => a + b, 0) / tot.length, p99 = tot[Math.floor(0.99 * tot.length)];
  return { peak: +pk.toFixed(4), first: +first.toFixed(6), lastSoundS: +(last / FS).toFixed(2), us: +mean.toFixed(1), us99: +p99.toFixed(1), cpuPct: +(100 * mean / (128 / FS * 1e6)).toFixed(2) };
}
const CASES = [];
const OPTS = [['today', {}], ['sung', { kind: 'cello' }], ['sung', { kind: 'choir' }], ['sung', { kind: 'glass' }], ['sung', { kind: 'reed' }], ['harp', { mat: 'string' }], ['harp', { mat: 'glass' }], ['ring', {}], ['ring', { colour: 'light' }], ['curve', {}]];
for (const [opt, set] of OPTS) for (const fn of C.FUNCS) for (const kind of ['visit', 'sweep', 'zero', 'pole', 'dzero', 'deform', 'view']) {
  if (kind === 'view' && opt !== 'curve') continue;
  if (kind === 'visit' && opt === 'curve') continue;
  const name = opt + (set.kind ? '-' + set.kind : set.mat === 'glass' ? '-glass' : set.colour === 'light' ? '-light' : '') + '_' + fn.id + '_' + kind;
  if (filt && !name.includes(filt)) continue;
  CASES.push({ name, opt, set, fn, kind });
}
const res = {};
for (const cs of CASES) {
  const sim = simulate(cs.opt, cs.fn, cs.kind, cs.set); if (!sim) continue;
  const r = render(sim, cs.opt, cs.set), lv = loud(r.L, r.R), st = stats(r);
  res[cs.name] = Object.assign({ lufsMax: lv.max, lufsGated: lv.gated, ctlMs: +sim.ctlMsPerFrame.toFixed(3), cues: sim.starts.length }, st);
  console.log(cs.name.padEnd(30), 'LUFS max', String(lv.max).padStart(6), 'gated', String(lv.gated).padStart(6), '| peak', st.peak.toFixed(3), '| last', st.lastSoundS, 's | cpu', st.us, 'µs/q =', st.cpuPct, '% (p99', st.us99, ') | ctl', sim.ctlMsPerFrame.toFixed(2), 'ms/frame | cues', sim.starts.length);
  if (SAVE) {
    fs.mkdirSync(OUT, { recursive: true });
    const a = new Float32Array(2 * r.L.length); for (let i = 0; i < r.L.length; i++) { a[2 * i] = r.L[i]; a[2 * i + 1] = r.R[i]; }
    fs.writeFileSync(path.join(OUT, cs.name + '.f32'), Buffer.from(a.buffer));
    fs.writeFileSync(path.join(OUT, cs.name + '.json'), JSON.stringify({ name: cs.name, fs: FS, f0: 0, n: r.L.length, gaps: 0, gapAt: [], labels: [], log: { starts: sim.starts, stops: [], late: [], cmds: [], ev: [], acts: [] } }));
  }
}
if (args.includes('--json')) fs.writeFileSync(path.join(H, 'tools', 'measure.json'), JSON.stringify(res, null, 1));
// the loudness spread across options on each function and gesture (snd-5): fails above 4 dB. Option 1's deformation is
// silent by design until the zero passes, and option 2 is silent between notes, so their gated means are not compared
// there (the deformation) ; the singer options' loops are the wrong gesture for option 3 and are compared all the same
const groups = {};
// Also left out, silent by design: option 4 on √z's loop, sweep and deformation (a curve across a cut has no winding
// number), and the harp on √z's deformation (arg H_t turns a quarter turn there: one string)
for (const [name, r] of Object.entries(res)) { const [o, f, k] = name.split('_'); if (r.lufsGated == null) continue; if (k === 'deform' && /^sung/.test(o)) continue; if (f === 'sqrt' && (o === 'curve' || (/^harp/.test(o) && k === 'deform'))) continue; (groups[f + '_' + k] = groups[f + '_' + k] || []).push([o, r.lufsGated]); }
let fails = 0;
for (const [g, v] of Object.entries(groups)) { if (v.length < 2) continue; v.sort((a, b) => a[1] - b[1]); const sp = v[v.length - 1][1] - v[0][1]; if (sp > 4) fails++; console.log('spread', g.padEnd(16), sp.toFixed(1), 'dB', sp > 4 ? 'FAIL' : 'ok', '(' + v[0][0] + ' ' + v[0][1] + ' … ' + v[v.length - 1][0] + ' ' + v[v.length - 1][1] + ')'); }
console.log('spread check:', fails ? fails + ' over 4 dB' : 'every function and gesture within 4 dB');
