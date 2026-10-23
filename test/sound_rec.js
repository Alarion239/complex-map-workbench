// Injected before the app's own scripts (Page.addScriptToEvaluateOnNewDocument) by test/sound_clicks_cmd.js. From the
// click investigation's recorder (notes/sound/cdp2/rec_inject.js, DESIGN §7.1), for the app:
//   a tap that records, sample-exact, what the app's AudioContext sends to its destination (after the engine's soft
//   clipper), in the order the quanta were rendered (notes/sound/DESIGN.md §7.6: Chrome's frame labels can repeat);
//   __rec.start() · await __rec.stop() → stats; the samples (float32 stereo interleaved) stay in __rec.data and are read
//   back in base64 chunks with __rec.chunk(i, n) (no server upload: the test server is python's http.server);
//   await __drive({ sel, path, rate, jitter, stalls, dur, down, seed }) dispatches pointer events on the element `sel`
//   along path(u ∈ [0, 1]) → [clientX, clientY], at `rate` Hz with ±jitter·interval timing noise and occasional
//   main-thread stalls of 20–45 ms; returns the log of event times ([performance.now() − T0, the context's time]).
(() => {
  if (!window.AudioContext || window.__rec) return;
  const REC = window.__rec = { ctx: null, src: null, node: null, chunks: [], ready: null, err: null, data: null };
  const MOD = `class R extends AudioWorkletProcessor {
    constructor() { super(); this.on = false; this.buf = []; this.n = 0; this.f0 = 0;
      this.port.onmessage = (e) => { if (e.data.on) { this.on = true; } else { this.on = false; this.flush(); this.port.postMessage({ done: true }); } }; }
    flush() { if (!this.n) return; const a = new Float32Array(2 * this.n); let o = 0; for (const b of this.buf) { a.set(b, o); o += b.length; }
      this.port.postMessage({ f0: this.f0, n: this.n, a }, [a.buffer]); this.buf = []; this.n = 0; }
    process(inputs) {
      if (!this.on) return true;
      const i = inputs[0], n = 128, b = new Float32Array(2 * n);
      if (i && i.length) { const L = i[0], R = i[1] || i[0]; for (let k = 0; k < n; k++) { b[2 * k] = L[k]; b[2 * k + 1] = R[k]; } }
      if (!this.n) this.f0 = currentFrame;
      this.buf.push(b); this.n += n; if (this.n >= 8192) this.flush();
      return true;
    } }
    registerProcessor('cmw-rec', R);`;
  const url = URL.createObjectURL(new Blob([MOD], { type: 'text/javascript' }));
  const connect = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    const r = connect.call(this, dest, ...rest);
    try {
      const c = this.context;
      if (dest === c.destination && c instanceof AudioContext && !REC.ctx && this !== REC.node) {
        REC.ctx = c; REC.src = this;
        REC.ready = c.audioWorklet.addModule(url).then(() => {
          REC.node = new AudioWorkletNode(c, 'cmw-rec', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], channelCount: 2, channelCountMode: 'explicit' });
          connect.call(REC.src, REC.node); connect.call(REC.node, c.destination);
          REC.node.port.onmessage = (e) => { if (e.data.done) { if (REC.onDone) REC.onDone(); } else REC.chunks.push(e.data); };
        }).catch((e) => { REC.err = String(e); });
      }
    } catch (e) { REC.err = String(e); }
    return r;
  };
  REC.start = async () => { await REC.ready; REC.chunks = []; REC.data = null; REC.node.port.postMessage({ on: true }); return REC.ctx.currentTime; };
  REC.stop = async () => {
    await new Promise((res) => { REC.onDone = res; REC.node.port.postMessage({ on: false }); });
    let n = 0, gaps = 0;
    for (let i = 0; i < REC.chunks.length; i++) { n += REC.chunks[i].n; if (i && REC.chunks[i].f0 !== REC.chunks[i - 1].f0 + REC.chunks[i - 1].n) gaps++; }
    const all = new Float32Array(2 * n); let o = 0; for (const c of REC.chunks) { all.set(c.a, o); o += c.a.length; }
    REC.data = new Uint8Array(all.buffer);
    let peak = 0; for (let i = 0; i < all.length; i++) peak = Math.max(peak, Math.abs(all[i]));
    const f0 = REC.chunks.length ? REC.chunks[0].f0 : 0;
    return { frames: n, f0, rate: REC.ctx.sampleRate, gaps, peak, bytes: REC.data.length };
  };
  REC.chunk = (i, n) => {
    const a = REC.data.subarray(i, Math.min(REC.data.length, i + n));
    let s = ''; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000));
    return btoa(s);
  };
  // the pointer driver: precise timing without the 4 ms nested-timer clamp (a MessageChannel yield loop near the target)
  const mc = new MessageChannel(); let wake = null; mc.port1.onmessage = () => { const w = wake; wake = null; if (w) w(); };
  const yieldNow = () => new Promise((r) => { wake = r; mc.port2.postMessage(0); });
  const until = async (t) => { for (;;) { const d = t - performance.now(); if (d <= 0) return; if (d > 3) await new Promise((r) => setTimeout(r, d - 2)); else await yieldNow(); } };
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  window.__drive = async (o) => {
    const el = document.querySelector(o.sel), log = [];
    seed = o.seed || 12345;
    const fire = (type, u) => { const [x, y] = o.path(u); el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, bubbles: true, cancelable: true, button: 0, buttons: o.down && type !== 'pointerup' ? 1 : 0 })); };
    const T0 = performance.now() + 20, iv = 1000 / o.rate;
    let t = T0, acted = false;
    if (o.down) { await until(t); fire('pointerdown', 0); }
    while (t - T0 <= o.dur * 1000) {
      await until(t);
      const u = Math.min(1, (performance.now() - T0) / (o.dur * 1000));
      fire('pointermove', u);
      log.push([performance.now() - T0, REC.ctx ? REC.ctx.currentTime : 0]);
      // an action while moving (Esc, a click on Listen…) at u ≥ o.actAt
      if (o.act && !acted && u >= o.actAt) { acted = true; o.act(); }
      if (o.stalls && rnd() < o.stalls) { const s = performance.now() + 20 + 25 * rnd(); while (performance.now() < s) { /* busy */ } }
      t += iv * (1 + (o.jitter || 0) * (2 * rnd() - 1));
    }
    if (o.down) fire('pointerup', 1);
    return log;
  };
})();
