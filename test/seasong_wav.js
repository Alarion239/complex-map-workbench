// The Mountain King's recording (test/seasong_rec_cmd.js) to a 16-bit WAV, with its measures: the playback's start on
// the recording, its counts (notes, repeats, cracks) and scheduled events by kind, the peak, the RMS of each statement
// (between the cracks, the drum before each downbeat) and of the ring-out, and the mean peak in the 50 ms after each
// note and each crack.
//   node test/seasong_wav.js <rec/mountain-king.f32> <out.wav>
const fs = require('fs');
const [src, dst] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(src.replace(/\.f32$/, '.json'), 'utf8'));
const buf = fs.readFileSync(src), x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4), n = x.length / 2, fs0 = meta.rate;
const A = meta.along || {}, ev = meta.events || [];
// the recording's start on the AudioContext's clock (its first frame), and the events relative to it
const tRec0 = meta.f0 / fs0, rel = (at) => at - tRec0;
const tPlay = A.t0 != null ? rel(A.t0) : NaN;
const rms = (a, b) => { const i0 = Math.max(0, Math.round(a * fs0)), i1 = Math.min(n, Math.round(b * fs0)); let e = 0; for (let i = i0; i < i1; i++) e += x[2 * i] * x[2 * i] + x[2 * i + 1] * x[2 * i + 1]; return +(10 * Math.log10(e / (2 * Math.max(1, i1 - i0)) + 1e-20)).toFixed(1); };
const pk = (t) => { const i0 = Math.max(0, Math.round(t * fs0)), i1 = Math.min(n, i0 + Math.round(0.05 * fs0)); let m = 0; for (let i = i0; i < i1; i++) m = Math.max(m, Math.abs(x[2 * i]), Math.abs(x[2 * i + 1])); return 20 * Math.log10(m + 1e-12); };
const mean = (a) => (a.length ? +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(1) : null);
let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
const kinds = {}; for (const e of ev) kinds[e.k] = (kinds[e.k] || 0) + 1;
// the statements: from the playback's start, cut at each crack; then the ring-out (3 s after its end)
const cracks = ev.filter((e) => e.k === 'crack').map((e) => rel(e.at)).sort((a, b) => a - b);
const edges = [tPlay, ...cracks.filter((t) => t > tPlay + 0.2), tPlay + (A.dur || 0)];
const sections = {};
for (let i = 0; i + 1 < edges.length; i++) sections['part' + (i + 1)] = rms(edges[i], edges[i + 1]);
sections.ringOut = rms(tPlay + (A.dur || 0), tPlay + (A.dur || 0) + 3);
const notes = ev.filter((e) => e.k === 'n' || e.k === 'cutnote').map((e) => rel(e.at));
// 16-bit PCM WAV, stereo
const out = Buffer.alloc(44 + n * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + n * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12); out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(fs0, 24); out.writeUInt32LE(fs0 * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(n * 4, 40);
for (let i = 0; i < 2 * n; i++) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + 2 * i);
fs.writeFileSync(dst, out);
console.log(JSON.stringify({ seconds: +(n / fs0).toFixed(2), rate: fs0, gaps: meta.gaps, playStartsAt: +tPlay.toFixed(3), dur: A.dur, mode: A.mode, counts: A.counts, kinds,
  peakDbfs: +(20 * Math.log10(peak + 1e-12)).toFixed(2), rmsDbfs: sections, notePeakDbfs: mean(notes.map(pk)), crackPeakDbfs: mean(cracks.map(pk)) }));
