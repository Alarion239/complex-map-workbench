// The sound lab of notes/sound/prototype.html (DESIGN §2.2), for test/sound_cmd.js: evaluated in the app's page, it
// renders every cue of Sound.CATALOG offline (OfflineAudioContext, through its panner, as in use, at 100 % volume)
// and measures it: LUFS-M (BS.1770 K-weighting, the loudest 400 ms), the same through a phone-speaker model (a 4th-order
// high-pass at 550 Hz), the peak, the onset and the last sample before the source stops, and the energy above 14 kHz;
// then Hear the function's marimba note and a stream of notes, the singer's release note (curves sing), and the
// Glide's held voice. window.__sndLab() → { rows, voices }.
(() => {
  const TAU = 2 * Math.PI;
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -TAU / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const p = i + j, q = p + len / 2, xr = re[q] * cr - im[q] * ci, xi = re[q] * ci + im[q] * cr; re[q] = re[p] - xr; im[q] = im[p] - xi; re[p] += xr; im[p] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
    }
  }
  const dB = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  function biq(x, b, a) { const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0; for (let i = 0; i < x.length; i++) { const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2; x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v; } return y; }
  const KW = [[[1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]], [[1, -2, 1], [1, -1.99004745483398, 0.99007225036621]]];
  function hpRBJ(f, q, fs) { const w = TAU * f / fs, al = Math.sin(w) / (2 * q), c = Math.cos(w), a0 = 1 + al; return [[(1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0], [1, -2 * c / a0, (1 - al) / a0]]; }
  const PHONE = [hpRBJ(550, 0.5412, 48000), hpRBJ(550, 1.3066, 48000)];
  function lufsM(buf, phone, from = 0, to = Infinity, integrated = false) {
    const fs = buf.sampleRate, i0 = Math.round(from * fs), i1 = Math.min(buf.length, Math.round(Math.min(to, buf.length / fs) * fs));
    const chans = [0, 1].map((c) => { let x = buf.getChannelData(Math.min(c, buf.numberOfChannels - 1)).slice(i0, i1); for (const [b, a] of KW.concat(phone ? PHONE : [])) x = biq(x, b, a); return x; });
    const n = chans[0].length, p = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) p[i + 1] = p[i] + chans[0][i] * chans[0][i] + chans[1][i] * chans[1][i];
    if (integrated) return -0.691 + 10 * Math.log10(p[n] / n + 1e-30);
    const w = Math.round(0.4 * fs); let m = 0;
    if (n < w) m = p[n] / w; else for (let i = 0; i + w <= n; i += 480) m = Math.max(m, (p[i + w] - p[i]) / w);
    return -0.691 + 10 * Math.log10(m + 1e-30);
  }
  function bandDb(buf, f, from, to) {
    const fs = buf.sampleRate, i0 = Math.round(from * fs), n0 = Math.round((to - from) * fs); let N = 1; while (N < n0) N <<= 1;
    const re = new Float64Array(N), im = new Float64Array(N), L = buf.getChannelData(0), R = buf.getChannelData(1);
    for (let i = 0; i < n0; i++) re[i] = 0.5 * (L[i0 + i] + R[i0 + i]) * (0.5 - 0.5 * Math.cos(TAU * i / (n0 - 1)));
    fft(re, im); let e = 0; const k0 = Math.floor(f * Math.pow(2, -1 / 6) / fs * N), k1 = Math.ceil(f * Math.pow(2, 1 / 6) / fs * N);
    for (let k = k0; k <= k1; k++) e += re[k] * re[k] + im[k] * im[k];
    return 10 * Math.log10(e + 1e-30);
  }
  function analyse(buf, onset, stopAt) {
    const fs = buf.sampleRate, L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length;
    let peak = 0, lastLoud = 0;
    for (let i = 0; i < n; i++) { const a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > peak) peak = a; }
    for (let i = 0; i < n; i++) if (Math.max(Math.abs(L[i]), Math.abs(R[i])) > peak * 1e-3) lastLoud = i;
    const o = Math.round(onset * fs);
    let first = 0; for (let i = o; i < o + Math.round(0.00025 * fs); i++) first = Math.max(first, Math.abs(L[i]), Math.abs(R[i]));
    // (v15.2: the synth ends each part on a sample of exactly 0; the cue's end time is the sum of its parts' rounded
    // lengths, so the sample read is 2 after it: 0 when nothing is left sounding, as a step would not be)
    let end = 0; if (stopAt) { const s = Math.min(n - 1, Math.round(stopAt * fs) + 2); end = Math.max(Math.abs(L[s]), Math.abs(R[s])); }
    let N = 1; while (N < n) N <<= 1;
    const re = new Float64Array(N), im = new Float64Array(N);
    for (let i = 0; i < n; i++) re[i] = 0.5 * (L[i] + R[i]);
    fft(re, im);
    let tot = 0, hf = 0; const k14 = Math.round(14000 / fs * N);
    for (let k = 1; k < N / 2; k++) { const e = re[k] * re[k] + im[k] * im[k]; tot += e; if (k >= k14) hf += e; }
    return { peak, len: (lastLoud - o) / fs, first: peak ? first / peak : 0, end, hf: tot ? 10 * Math.log10(Math.max(hf / tot, 1e-30)) : -300 };
  }
  window.__sndLab = async (opts = {}) => {
    const rows = [];
    for (const [name, d] of Object.entries(Sound.CATALOG)) {
      const variants = name === 'zero' ? [{ order: 1 }, { order: 2 }, { order: 4 }] : name === 'pole' ? [{ order: 1 }] : name === 'turn' ? [{ dir: 1, pc: 0 }, { dir: -1, pc: 0 }] : name === 'landmark' ? [{ q: 0 }, { q: 2, vel: 0.5 }, { q: 4, vel: 0.85 }] : name === 'view' ? [{ k: 0 }] : name === 'contour' ? [{ k: -7 }, { k: 0 }, { k: 8 }] : name === 'loopDone' ? [{ w: 2 }, { w: 0 }] : [{}];
      for (const o0 of variants) {
        // (palette B: every play is a new strike; the lab plays a fixed seed)
        const o = Object.assign({ seed: 1 }, o0);
        let endAt = 0;
        const buf = await Sound.render((G, t) => { endAt = Sound.cueTo(G, name, t, o); }, 2.2, { noClip: true, nodes: opts.nodes });
        const a = analyse(buf, 0.01, null);
        // (the envelope before the declared limiter: its 2 ms look-ahead would put the end 96 samples late)
        const dry = await Sound.render((G, t) => { G.tier[d.tier].wet.gain.value = 0; endAt = Sound.cueTo(G, name, t, o); }, 2.2, { noClip: true, noLimit: true, nodes: opts.nodes });
        const ad = analyse(dry, 0.01, endAt);
        const L = lufsM(buf, false), Lp = lufsM(buf, true);
        rows.push({ name, o, tier: d.tier, peak: +dB(a.peak).toFixed(2), lufs: +L.toFixed(2), phone: +Lp.toFixed(2), loss: +(L - Lp).toFixed(2), first: +a.first.toFixed(3), end: ad.end, hf: +a.hf.toFixed(1), len: +a.len.toFixed(3) });
      }
    }
    const voices = {};
    // Hear the function's notes (v16.5; the pointer harp is retired): one marimba note (Sound.htNote) at pitch class c
    // (semitones above D) and the law's dB (dbV3: 0 at |F| = 1, −8 at a zero, +4 at a pole), seed fixed by the note;
    // and a stream of rising notes, one a line, at 10 and at 5 a second, each at its crowding gain (noteGain: a stream's
    // power is that of R0 = 5 events a second)
    const HTL = Sound.HT;
    const note = (c, db) => Sound.render((G, t) => { Sound.htNote(G, t, c, db, 0, 0, 'sonify', 'lab', false); }, 2.6, { noClip: true });
    const ne = await note(2, 0), nd = await note(0, 0), nz = await note(2, HTL.law(-Infinity)), np = await note(2, HTL.law(Infinity)), na = analyse(ne, 0.01, null);
    const stream = (rate) => Sound.render((G, t) => { for (let i = 0; i < 3 * rate; i++) Sound.htNote(G, t + i / rate, i % 12, 0, HTL.noteGain(rate), 0, 'sonify', 'lab', false); }, 3.8, { noClip: true });
    const r10 = await stream(10), r5 = await stream(5);
    voices.notes = { e: +lufsM(ne, false).toFixed(2), d: +lufsM(nd, false).toFixed(2), zero: +lufsM(nz, false).toFixed(2), pole: +lufsM(np, false).toFixed(2), loss: +(lufsM(ne, false) - lufsM(ne, true)).toFixed(2),
      first: +na.first.toFixed(3), peak: +dB(na.peak).toFixed(2), run10: +lufsM(r10, false, 0.5, 2.5, true).toFixed(2), run5: +lufsM(r5, false, 0.5, 2.5, true).toFixed(2) };
    // curves sing: the release note of z − 0.6 (W = 1) and 1/(z − 0.6) (W = −1) on the unit circle; its level and its
    // loudest harmonic (n·D3, n = 1 … 8)
    const phase = (sign) => { const M = 512, ph = new Float64Array(M); let prev = 0, acc = 0; for (let j = 0; j < M; j++) { const th = 2 * Math.PI * j / M, a = sign * Math.atan2(Math.sin(th), Math.cos(th) - 0.6); if (j) { let d = a - prev; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); acc += d; } else acc = a; prev = a; ph[j] = acc / (2 * Math.PI); } return ph; };
    const singR = async (W) => { const c = Sound.curveAmps(phase(W), W); return Sound.render((G, t) => G.synth.post(Sound.singCmds(c.A, c.n0, 'release', t, 'events', { gate: 1 })), 3.4, { noClip: true }); };
    const s1 = await singR(1), sm1 = await singR(-1);
    const peakH = (b) => { let best = 0, bn = 0; for (let n = 1; n <= 8; n++) { const e = bandDb(b, 146.8324 * n, 0.5, 1.4); if (e > best || !bn) { best = e; bn = n; } } return bn; };
    voices.sing = { w1: +lufsM(s1, false).toFixed(2), wm1: +lufsM(sm1, false).toFixed(2), loss: +(lufsM(s1, false) - lufsM(s1, true)).toFixed(2), peak1: peakH(s1), peakm1: peakH(sm1) };
    // the Glide (v16.5; the Height voice is retired: the Landscape is heard as the planes are): one held voice at
    // |F| = 1 on D, F♯ (4 semitones above D) and B♭ (8), and on D at a zero and at a pole (the worklet's 'gl' command, as
    // Sound.hear posts it), the integrated loudness of its hold
    const gl = (c, ln) => Sound.render((G, t) => { G.synth.post([{ k: 'gl', at: t + 0.1, phi: c / 12, mode: 'slew', a: HTL.glideAmp(ln), b: HTL.bright(HTL.law(ln)), pan: 0, until: t + 2.0, rel: 0, fade: 0, tier: 2, tag: 'lab' }]); }, 2.6, { noClip: true });
    const GLv = {}, GLp = {};
    for (const c of [0, 4, 8]) { const b = await gl(c, 0); GLv[c] = lufsM(b, false, 0.5, 1.9, true); GLp[c] = lufsM(b, true, 0.5, 1.9, true); }
    const gz = await gl(0, -Infinity), gp = await gl(0, Infinity);
    voices.glide = { at0: +GLv[0].toFixed(2), all: [GLv[0], GLv[4], GLv[8]].map((x) => +x.toFixed(2)), phoneRange: +(Math.max(GLp[0], GLp[4], GLp[8]) - Math.min(GLp[0], GLp[4], GLp[8])).toFixed(2),
      zero: +lufsM(gz, false, 0.5, 1.9, true).toFixed(2), pole: +lufsM(gp, false, 0.5, 1.9, true).toFixed(2) };
    return { rows, voices };
  };
})();
