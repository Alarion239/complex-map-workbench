// Instrumentation for the independent click verification (notes/sound/cdp3), evaluated in the page BEFORE sound is
// turned on. Nothing here changes what the engine does; it only observes:
//   1. a recorder: every node the page connects to the realtime context's destination (the safety clipper) is also
//      connected to an AudioWorklet tap that copies its output sample-exact (context frame numbers, gaps detected);
//   2. logs: every AudioScheduledSourceNode start/stop (requested time vs currentTime at the call), every AudioParam
//      automation call whose time is already behind currentTime (with the caller), every command posted to the
//      voices' worklet (MessagePort.postMessage on the main thread), and every synthetic pointer event / action;
//   3. a pointer driver: a precomputed, jittered event schedule (rate Hz, ±jit, random stalls) dispatched as
//      PointerEvents on the portrait overlay, with actions (mode, Hear F, function, Esc, leave, listen) at set times.
(() => {
  if (window.__v3) return;
  const V = (window.__v3 = { log: { starts: [], stops: [], late: [], cmds: [], ev: [], acts: [], stalls: [] }, h: null });
  const REC = `class Rec extends AudioWorkletProcessor {
  constructor() { super(); this.on = false; this.B = 16; this.buf = new Float32Array(2 * 128 * 16); this.fr = new Float64Array(16); this.k = 0; this.f0 = -1;
    this.port.onmessage = (e) => { if (e.data === 'start') { this.on = true; this.k = 0; this.f0 = -1; } else if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ end: currentFrame }); } }; }
  flush() { if (this.k) { const a = this.buf.slice(0, 2 * 128 * this.k), fr = Array.from(this.fr.subarray(0, this.k)); this.port.postMessage({ f: this.f0, n: 128 * this.k, a, fr }, [a.buffer]); this.k = 0; this.f0 = -1; } }
  process(inputs) {
    if (this.on) {
      const x = inputs[0], L = x && x[0], R = x && (x[1] || x[0]);
      if (this.f0 < 0) this.f0 = currentFrame;
      const o = 2 * 128 * this.k; this.fr[this.k] = currentFrame;
      for (let i = 0; i < 128; i++) { this.buf[o + 2 * i] = L ? L[i] : 0; this.buf[o + 2 * i + 1] = R ? R[i] : 0; }
      if (++this.k === this.B) this.flush();
    }
    return true;
  }
}
registerProcessor('v3-rec', Rec);`;
  const oc = AudioNode.prototype.connect;
  const isRT = (c) => c && !(typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext);
  function hook(c, src) {
    let h = V.h;
    if (!h || h.c !== c) {
      h = V.h = { c, srcs: [], node: null, chunks: [], ended: null };
      const url = URL.createObjectURL(new Blob([REC], { type: 'text/javascript' }));
      h.ready = c.audioWorklet.addModule(url).then(() => {
        h.node = new AudioWorkletNode(c, 'v3-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete' });
        for (const s of h.srcs) oc.call(s, h.node);
        const z = c.createGain(); z.gain.value = 0; oc.call(h.node, z); oc.call(z, c.destination);
        h.node.port.onmessage = (e) => { if (e.data.end != null) { if (h.ended) h.ended(e.data.end); } else h.chunks.push(e.data); };
      });
    }
    h.srcs.push(src); if (h.node) oc.call(src, h.node);
  }
  AudioNode.prototype.connect = function (d, ...r) {
    const res = oc.call(this, d, ...r);
    try { if (d instanceof AudioDestinationNode && isRT(this.context)) hook(this.context, this); } catch (e) { /* observe only */ }
    return res;
  };
  // sources: requested time vs the clock at the call
  // (AudioBufferSourceNode has its own start(when, offset, duration): both prototypes are wrapped)
  let sid = 0;
  for (const PR of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) {
    if (Object.prototype.hasOwnProperty.call(PR, 'start')) { const os = PR.start; PR.start = function (t, ...r) {
      if (isRT(this.context)) { this.__id = ++sid; V.log.starts.push({ id: this.__id, k: this.constructor.name, t: t || 0, now: this.context.currentTime, pn: performance.now() }); }
      return os.call(this, t, ...r); }; }
    if (Object.prototype.hasOwnProperty.call(PR, 'stop')) { const op = PR.stop; PR.stop = function (t, ...r) {
      if (isRT(this.context)) V.log.stops.push({ id: this.__id, t: t == null ? null : t, now: this.context.currentTime, pn: performance.now() });
      return op.call(this, t, ...r); }; }
  }
  // automation calls landing behind the clock (the realtime context only; the page has one)
  const AP = AudioParam.prototype;
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']) {
    const f = AP[m];
    AP[m] = function (...a) {
      const c = V.h && V.h.c, ti = m === 'setTargetAtTime' ? a[1] : m.startsWith('cancel') ? a[0] : a[1];
      if (c && c.state === 'running' && ti < c.currentTime) {
        const st = (new Error().stack || '').split('\n').slice(2, 5).map((s) => s.trim().replace(/\s*\(.*$/, '').replace(/^at /, '')).join(' < ');
        V.log.late.push({ m, t: ti, now: c.currentTime, pn: performance.now(), by: st });
      }
      return f.apply(this, a);
    };
  }
  // the voices' worklet commands (the only main-thread MessagePort traffic in the page)
  const pm = MessagePort.prototype.postMessage;
  MessagePort.prototype.postMessage = function (d, ...r) {
    try { if (Array.isArray(d) && V.h) V.log.cmds.push({ pn: performance.now(), now: V.h.c.currentTime, c: JSON.parse(JSON.stringify(d[0])) }); } catch (e) { /* observe only */ }
    return pm.call(this, d, ...r);
  };
  // ---- recording
  V.recStart = async () => {
    await V.h.ready;
    V.h.chunks = []; for (const k in V.log) V.log[k] = [];
    V.h.node.port.postMessage('start');
    V.t0 = { pn: performance.now(), now: V.h.c.currentTime };
    try { V.ps0 = JSON.parse(JSON.stringify(V.h.c.playbackStats)); } catch (e) { V.ps0 = null; }
  };
  V.recStop = (name) => new Promise((res) => {
    const h = V.h;
    h.ended = async (fend) => {
      h.ended = null;
      // quanta in the order process() produced them (a port delivers in order): the recording is contiguous by
      // construction. currentFrame is kept only as a diagnostic: Chrome sometimes labels two consecutive quanta with
      // the same frame (then skips one label), with no underrun reported (playbackStats): a label glitch, not audio.
      const ch = h.chunks.slice();
      if (!ch.length) { res({ err: 'no audio' }); return; }
      const f0 = ch[0].fr[0]; let n = 0; for (const c of ch) n += c.n;
      const a = new Float32Array(2 * n); let o = 0, gaps = 0, exp = f0; const gapAt = [], labels = [];
      for (const c of ch) { a.set(c.a, o); for (let q = 0; q < c.fr.length; q++) { if (c.fr[q] !== exp) labels.push([o / 2 + 128 * q, c.fr[q] - exp]); exp = c.fr[q] + 128; } o += c.a.length; }
      let ps = null; try { ps = JSON.parse(JSON.stringify(h.c.playbackStats)); } catch (e) { /* none */ }
      const meta = { name, fs: h.c.sampleRate, f0, n, gaps, gapAt, labels, order: 'arrival', ps, ps0: V.ps0, base: h.c.baseLatency, out: h.c.outputLatency, lead: Sound.lead(), engine: Sound.state().engine, t0: V.t0, log: V.log };
      await fetch('/up?name=' + name + '.f32', { method: 'POST', body: a.buffer });
      await fetch('/up?name=' + name + '.json', { method: 'POST', body: JSON.stringify(meta) });
      res({ name, n, secs: n / h.c.sampleRate, labels: labels.length, ps, starts: V.log.starts.length, late: V.log.late.length, cmds: V.log.cmds.length, ev: V.log.ev.length });
    };
    h.node.port.postMessage('stop');
  });
})();
