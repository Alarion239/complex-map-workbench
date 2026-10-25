// The sea song's recording (test/seasong_rec_cmd.js) to a 16-bit WAV, with its measures: the RMS of each statement
// and of the coda (the crescendo), the peak, and the recorded note onsets against the score (the harp's cues).
//   node test/seasong_wav.js <rec/mountain-king.f32> <out.wav>      (then: afconvert -f m4af -d aac out.wav out.m4a)
const fs = require('fs'), path = require('path');
const [src, dst] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(src.replace(/\.f32$/, '.json'), 'utf8'));
const SC = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'seasong_score.json'), 'utf8'));
const SN = SC.notes.filter((s) => !s[4]);   // (the silent crossings sound nothing: notes/sea-song/ledger.json)
const buf = fs.readFileSync(src), x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4), n = x.length / 2, fs0 = meta.rate;
// the playback's start on the recording's clock: the first scheduled string minus its score onset
const strs = meta.cues.filter((c) => c[1]).map((c) => c[0]);
const on = [...new Set(strs.map((t) => +t.toFixed(6)))].sort((a, b) => a - b);
const tRec0 = meta.f0 / fs0, tPlay = on[0] - SN[0][2] - tRec0;
let worst = 0;
for (let i = 0; i < Math.min(on.length, SN.length); i++) worst = Math.max(worst, Math.abs(on[i] - on[0] - (SN[i][2] - SN[0][2])));
const rms = (a, b) => { const i0 = Math.max(0, Math.round((tPlay + a) * fs0)), i1 = Math.min(n, Math.round((tPlay + b) * fs0)); let e = 0; for (let i = i0; i < i1; i++) e += x[2 * i] * x[2 * i] + x[2 * i + 1] * x[2 * i + 1]; return 10 * Math.log10(e / (2 * Math.max(1, i1 - i0)) + 1e-20); };
// the statements start on ticks 0, 1, 2 (round 2: one turn, one drum a statement; round 1: 0, 2, 4), the coda on the last
const T0 = SC.ticks, T = T0.length === 4 ? [T0[0], 0, T0[1], 0, T0[2], 0, T0[3]] : T0;
const sections = { statement1: rms(T[0], T[2]), statement2: rms(T[2], T[4]), statement3: rms(T[4], T[6]), coda: rms(T[6], T[6] + 3) };
let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
// peaks (dBFS) in the 50 ms after each onset: the main notes by statement (mean), the graces against their next main
// note, and the drum's ticks against the main note on the same beat
const pk = (t) => { const i0 = Math.max(0, Math.round((tPlay + t) * fs0)), i1 = Math.min(n, i0 + Math.round(0.05 * fs0)); let m = 0; for (let i = i0; i < i1; i++) m = Math.max(m, Math.abs(x[2 * i]), Math.abs(x[2 * i + 1])); return 20 * Math.log10(m + 1e-12); };
const stmtOf = (t) => (t < T[2] ? 0 : t < T[4] ? 1 : t < T[6] - 0.3 ? 2 : 3);
const mainPk = [[], [], [], []];
for (const s of SN) if (!s[3]) mainPk[stmtOf(s[2])].push(pk(s[2]));
const mean = (a) => +(a.reduce((p, q) => p + q, 0) / Math.max(1, a.length)).toFixed(1);
const tickPk = T0.map((t) => +pk(t).toFixed(1));
// 16-bit PCM WAV, stereo
const out = Buffer.alloc(44 + n * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + n * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12); out.writeUInt32LE(16, 16);
out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(fs0, 24); out.writeUInt32LE(fs0 * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34);
out.write('data', 36); out.writeUInt32LE(n * 4, 40);
for (let i = 0; i < 2 * n; i++) out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(x[i] * 32767))), 44 + 2 * i);
fs.writeFileSync(dst, out);
console.log(JSON.stringify({ seconds: +(n / fs0).toFixed(2), rate: fs0, peakDbfs: +(20 * Math.log10(peak)).toFixed(1), onsets: on.length, score: SC.notes.length, worstOnsetVsScoreMs: +(1000 * worst).toFixed(1),
  playStartsAt: +tPlay.toFixed(3), mainPeakDbfs: mainPk.map(mean), tickPeakDbfs: tickPk, rmsDbfs: Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, +v.toFixed(1)])), riseDb: +(sections.statement3 - sections.statement1).toFixed(1) }));
