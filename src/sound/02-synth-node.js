  // ---------------------------------------------------------------- the synth node (or the fallback)
  // the worklet's source: the library, the synth processor (6 tier outputs + the audition pair), the Height voice
  const WORKLET_SRC = `'use strict';
const L = (${SND_LIB.toString()})();
class Synth extends AudioWorkletProcessor {
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.fs = sampleRate; this.q = []; this.cues = []; this.strs = []; this.tex = new Map(); this.dying = [];
    this.y = new Float32Array(128); this.sd = new Float32Array(128); this.sw = new Float32Array(128);
    this.sg = L.Singer(this.fs, p.seed || 4242); this.nFade = Math.round(0.012 * this.fs); this.gl = L.Glide(this.fs);
    this.stat = { cues: 0, late: 0, maxLateMs: 0, steals: 0, maxStrings: 0, maxCues: 0 };
    for (const c of p.cmds || []) this.push(c);
    this.port.onmessage = (e) => { if (e.data === 'stat') { this.port.postMessage(this.stat); return; } for (const c of e.data) this.push(c); };
  }
  push(c) { if (c.k === 'clear') { this.clear(c.tag); return; } if (c.k === 'gl') { this.gl.cmd(c, Math.round((c.at || 0) * this.fs)); return; } c.f = Math.round((c.at || 0) * this.fs); let i = this.q.length; while (i > 0 && this.q[i - 1].f > c.f) i--; this.q.splice(i, 0, c); }
  // {k: 'clear'} (Esc, off, a hidden tab): queued commands are dropped, parts that have not started are dropped, and
  // what sounds fades to 0 on a 12 ms raised cosine; the texture and the singer too. {k: 'clear', tag}: only that tag's
  // cues (a "listen along" stopped)
  clear(tag) {
    const all = tag == null, now = currentFrame;
    this.q = all ? [] : this.q.filter((c) => c.tag !== tag);
    for (let ci = this.cues.length - 1; ci >= 0; ci--) {
      const cue = this.cues[ci];
      if (!all && cue.tag !== tag) continue;
      cue.parts = cue.parts.filter((p) => p.live && p.sf < now);
      if (!cue.parts.length) { this.drop(ci); continue; }
      if (cue.fade < 0) { cue.fade = 0; cue.fadeN = this.nFade; }
    }
    this.gl.clear(all ? undefined : tag);
    if (all) { for (const T of this.tex.values()) { T.fade = 0; this.dying.push(T); } this.tex.clear(); this.sg.hush(); }
    else if (this.sg.h.tag === tag) this.sg.hush();
  }
  drop(ci) { const cue = this.cues[ci]; this.cues.splice(ci, 1); if (cue.str) { const k = this.strs.indexOf(cue); if (k >= 0) this.strs.splice(k, 1); } }
  start(c, f0) {
    const fs = this.fs, sh = c.f < f0 ? f0 - c.f : 0;
    if (sh) { this.stat.late++; this.stat.maxLateMs = Math.max(this.stat.maxLateMs, 1000 * sh / fs); }
    this.stat.cues++;
    const cue = { tier: c.tier, pan: c.pan || 0, g: c.g == null ? 1 : c.g, wet: c.wet || 0, tag: c.tag, str: !!c.str, key: c.key || 0, grp: c.grp || '', fade: -1, fadeN: this.nFade,
      parts: c.parts.map((p) => ({ sf: c.f + sh + Math.round((p.d || 0) * fs), v: L.MAKE[p.k](p, fs), live: true })) };
    // the harp's strings: at most 12 at once (c.cap: a composed piece's, notes/sea-song); the oldest fades out over
    // 30 ms (raised cosine) when one more starts. c.key (a piece's string, its MIDI note): a string plucked again is
    // damped first, as a harpist re-plucks one string (notes/sea-song/r3)
    if (cue.str) {
      const strs = this.strs;
      if (cue.key) for (let i = strs.length - 1; i >= 0; i--) if (strs[i].key === cue.key && strs[i].grp === cue.grp) { const o = strs.splice(i, 1)[0]; if (o.fade < 0) { o.fade = 0; o.fadeN = Math.round(0.03 * fs); } this.stat.steals++; }
      // (c.grp: string groups, each under its own cap: Hear the function's marimba bars ('ht') damp only each other)
      for (let cnt = strs.reduce((a, s) => a + (s.grp === cue.grp ? 1 : 0), 0); cnt >= (c.cap || 12); cnt--) { const o = strs.splice(strs.findIndex((s) => s.grp === cue.grp), 1)[0]; if (o.fade < 0) { o.fade = 0; o.fadeN = Math.round(0.03 * fs); } this.stat.steals++; }
      strs.push(cue); if (strs.length > this.stat.maxStrings) this.stat.maxStrings = strs.length;
    }
    this.cues.push(cue); if (this.cues.length > this.stat.maxCues) this.stat.maxCues = this.cues.length;
  }
  fadeY(o, y, n) { const N = o.fadeN || this.nFade; for (let j = 0; j < n; j++) { const k = o.fade + j; y[j] *= k >= N ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * k / N); } o.fade += n; return o.fade >= N; }
  mix(outs, tier, pan, g, wet, y, n) {
    const th = (Math.max(-0.4, Math.min(0.4, pan)) + 1) * Math.PI / 4, gl = g * Math.cos(th), gr = g * Math.sin(th);
    const D = outs[2 * tier], W = outs[2 * tier + 1];
    if (D && D[0]) { const A = D[0], B = D[1] || D[0]; for (let j = 0; j < n; j++) { A[j] += y[j] * gl; if (B !== A) B[j] += y[j] * gr; } }
    if (wet && W && W[0]) { const A = W[0], B = W[1] || W[0], wl = gl * wet, wr = gr * wet; for (let j = 0; j < n; j++) { A[j] += y[j] * wl; if (B !== A) B[j] += y[j] * wr; } }
  }
  process(_, outs) {
    const f0 = currentFrame, n = outs[0][0].length, y = this.y, fs = this.fs;
    while (this.q.length && this.q[0].f < f0 + n) {
      const c = this.q.shift();
      if (c.k === 'cue') this.start(c, f0);
      else if (c.k === 'tex') { let T = this.tex.get(c.id); if (!T) { T = L.Tex(fs, c.seed || 7); this.tex.set(c.id, T); } T.set(c, Math.max(c.f, f0)); }
      else if (c.k === 'hv') this.sg.cmd(c, Math.max(c.f, f0));
    }
    for (let ci = this.cues.length - 1; ci >= 0; ci--) {
      const cue = this.cues[ci]; y.fill(0); let more = false, any = false;
      for (const p of cue.parts) {
        if (!p.live) continue;
        if (p.sf >= f0 + n) { more = true; continue; }
        any = true; p.live = p.v.run(y, Math.max(0, p.sf - f0), n); if (p.live) more = true;
      }
      let gone = false; if (cue.fade >= 0) { if (any) gone = this.fadeY(cue, y, n); else gone = true; }
      if (any) this.mix(outs, cue.tier, cue.pan, cue.g, cue.wet, y, n);
      if (!more || gone) this.drop(ci);
    }
    for (let di = this.dying.length - 1; di >= 0; di--) {
      const T = this.dying[di]; T.run(y, f0, n); const gone = this.fadeY(T, y, n); this.mix(outs, T.tier, T.pan, 1, T.wet, y, n);
      if (gone) this.dying.splice(di, 1);
    }
    for (const [id, T] of this.tex) {
      if (T.silent(f0)) { if (T.end || f0 - T.last > 30 * fs) this.tex.delete(id); continue; }
      T.run(y, f0, n); this.mix(outs, T.tier, T.pan, 1, T.wet, y, n);
    }
    this.gl.run(outs, f0, n, 0.14);
    const sd = this.sd, sw = this.sw;
    sd.fill(0); sw.fill(0);
    if (this.sg.run(sd, sw, n, f0)) {
      const D = outs[2 * this.sg.tier()], W = outs[2 * this.sg.tier() + 1];
      if (D && D[0]) { const A = D[0], B = D[1] || D[0]; for (let j = 0; j < n; j++) { A[j] += sd[j]; if (B !== A) B[j] += sd[j]; } }
      if (W && W[0]) { const A = W[0], B = W[1] || W[0]; for (let j = 0; j < n; j++) { A[j] += sw[j]; if (B !== A) B[j] += sw[j]; } }
    }
    return true;
  }
}
registerProcessor('cmw-synth', Synth);
// the declared safety limiter on the bus (L.Limiter): every tier and the room's return, before the master volume
class Limit extends AudioWorkletProcessor {
  constructor(o) { super(); const p = (o && o.processorOptions) || {}; this.lim = L.Limiter(sampleRate, p.ceil || 0.363); this.port.onmessage = (e) => { if (e.data === 'stat') this.port.postMessage(this.lim.st); }; }
  process(ins, outs) {
    const i = ins[0] || [], o = outs[0], n = o[0].length, a = i[0], b = i[1] || i[0];
    if (a) o[0].set(a); else o[0].fill(0);
    if (o[1]) { if (b) o[1].set(b); else o[1].fill(0); }
    this.lim.process(o[0], o[1] || null, n);
    return true;
  }
}
registerProcessor('cmw-limit', Limit);`;
  let workletURL = null;
  const workletURLs = () => {
    const u = [];
    try { if (!workletURL) workletURL = URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' })); u.push(workletURL); } catch (e) { /* no Blob URLs */ }
    u.push('data:text/javascript;charset=utf-8,' + encodeURIComponent(WORKLET_SRC));
    return u;
  };
  // load the worklet into a context: a Blob URL, else a data: URL; false where neither is allowed (a CSP without
  // blob:/data: for scripts, no AudioWorklet): then the main-thread fallback
  let workletRefused = false;
  async function loadWorklet(c) {
    if (workletRefused || !c.audioWorklet || typeof AudioWorkletNode === 'undefined') return false;
    for (const u of workletURLs()) { try { await c.audioWorklet.addModule(u); return true; } catch (e) { /* refused: next */ } }
    workletRefused = true;
    return false;
  }
  // the synth node of a graph: 8 outputs (dry and wet of ui, events, sonify and the audition bus). Offline: made when
  // rendering starts, with every command in its options (exact and deterministic renders)
  function makeSynth(g) {
    const c = g.c, pend = [];
    let node = null;
    const make = () => {
      node = new AudioWorkletNode(c, 'cmw-synth', { numberOfInputs: 0, numberOfOutputs: 8, outputChannelCount: [2, 2, 2, 2, 2, 2, 2, 2], processorOptions: { cmds: pend.splice(0), seed: (seedBase ^ 0x5bd1e995) >>> 0 } });
      [g.tier.ui, g.tier.events, g.tier.sonify, g.aud].forEach((T, k) => { node.connect(T.dry, 2 * k); node.connect(T.wet, 2 * k + 1); });
    };
    if (g.offline) g.flush.push(make); else make();
    return { post(list) { if (node) node.port.postMessage(list); else pend.push(...list); }, node: () => node, stat: () => new Promise((res) => { if (!node) return res(null); const prev = node.port.onmessage; node.port.onmessage = (e) => { node.port.onmessage = prev; res(e.data); }; node.port.postMessage('stat'); }) };
  }
  // the fallback: the cue's parts rendered into a buffer on the main thread (the same code), played once
  function fallbackCue(g, cue, t) {
    const c = g.c, fs = c.sampleRate;
    let end = 0; for (const p of cue.parts) end = Math.max(end, LIB.partEnd(p));
    const n = Math.max(1, Math.ceil(end * fs) + 2), b = c.createBuffer(1, n, fs), y = b.getChannelData(0);
    for (const p of cue.parts) { const s = Math.round((p.d || 0) * fs); LIB.MAKE[p.k](p, fs).run(y, s, n); }
    if (cue.g !== 1) for (let i = 0; i < n; i++) y[i] *= cue.g;
    const src = c.createBufferSource(); src.buffer = b;
    const T = cue.tier === 3 ? g.audition : g, tn = TIERS[cue.tier === 3 ? 0 : cue.tier];
    // (its own gain, so that stopping a tagged group fades it first: review sound-4)
    src.out = out(T, tn, cue.pan, cue.wet);
    src.connect(src.out);
    src.tag = cue.tag;
    // rendering took main-thread time: a start already in the past would cut into the attack, so it starts no earlier
    // than now + LEAD, and the click regression's log has the true start (review sound-4)
    const t1 = g.offline ? t : Math.max(t, c.currentTime + LEAD);
    if (cueHook && !g.offline) { try { cueHook(t1, cue); } catch (e) { /* the test's */ } }
    src.start(t1); g.active.add(src); src.onended = () => g.active.delete(src);
    return t1 + end;
  }
  // (tests: the click regression logs every one-shot's scheduled start, so a detection at a note's own attack is told
  // from a snap)
  let cueHook = null;
  function emitCue(g, cue, t) {
    if (g.synth && (g.offline || prefer.worklet)) {
      if (cueHook && !g.offline) { try { cueHook(t, cue); } catch (e) { /* the test's */ } }
      g.synth.post([Object.assign({ k: 'cue', at: t }, cue)]); let e = 0; for (const p of cue.parts) e = Math.max(e, LIB.partEnd(p)); return t + e; }
    // (#271) the main-thread render takes 30–70 ms: inside an input handler it is handed to the next task, and its start
    // stays no earlier than now + LEAD (fallbackCue's own rule), so the attack is not cut
    if (!g.offline && inInput()) {
      let end = 0; for (const p of cue.parts) end = Math.max(end, LIB.partEnd(p));
      // (a hush or stopTag before it runs drops it: g.later)
      const job = { tag: cue.tag }; (g.later || (g.later = new Set())).add(job);
      setTimeout(() => { if (g.later.delete(job) && g.c.state !== 'closed') fallbackCue(g, cue, t); }, 0);
      return Math.max(t, g.c.currentTime + LEAD) + end;
    }
    return fallbackCue(g, cue, t);
  }
  // in an input event's handler: the activation gesture is live and the event being dispatched is a UI event
  const inInput = () => inGesture() && typeof UIEvent !== 'undefined' && window.event instanceof UIEvent;
  // one cue of the catalog into a graph at time t (no guards: play() has them; offline renders and the lab call this)
  const reps = new Map();
  function cueTo(g, name, t, o = {}) {
    const d = CATALOG[name]; if (!d) return t;
    FS = g.c.sampleRate;
    R = prng(o.seed != null ? o.seed : (seedBase + 0x9E3779B9 * ++cueN) >>> 0);
    // repetition softens: −1 dB per repeat within 2 s, down to −4 dB (not count-bearing cues, not auditions)
    let rg = 0;
    if (!d.count && !o.noRep && !o.audition && !g.offline) { const r = reps.get(name), k = r && t - r.t < 2 ? Math.min(4, r.k + 1) : 0; reps.set(name, { t, k }); rg = -k; }
    const Pt = [];
    d.make(Pt, o);
    const tier = o.audition ? 3 : TI[o.tier || d.tier];
    return emitCue(g, { tier, pan: clamp(o.pan || 0, -0.4, 0.4), wet: d.wet, g: Math.pow(10, (rg + (TRIM[name] || 0) + (o.gainDb || 0)) / 20), parts: Pt, tag: o.tag }, t);
  }

