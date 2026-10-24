// (tests only, evaluated before the board's scripts) a sample-exact tap on every realtime context's output (after the
// clipper), the start times of every native source (A's cues), and automation calls that land behind the clock
(() => {
  if (window.__rec) return;
  const REC = `class Rec extends AudioWorkletProcessor {
  constructor() { super(); this.on = false; this.chunks = []; this.f0 = -1;
    this.port.onmessage = (e) => { if (e.data === 'start') { this.on = true; this.f0 = -1; this.buf = []; } else if (e.data === 'stop') { this.on = false; const n = this.buf.length; const a = new Float32Array(n * 256); for (let k = 0; k < n; k++) a.set(this.buf[k], k * 256); this.port.postMessage({ f0: this.f0, a }, [a.buffer]); this.buf = []; } }; }
  process(inputs) { if (this.on) { const x = inputs[0], L = x && x[0], R = x && (x[1] || x[0]); if (this.f0 < 0) this.f0 = currentFrame; const q = new Float32Array(256); for (let i = 0; i < 128; i++) { q[2 * i] = L ? L[i] : 0; q[2 * i + 1] = R ? R[i] : 0; } this.buf.push(q); } return true; }
}
registerProcessor('rec-tap', Rec);`;
  const V = (window.__rec = { ctx: new Map(), starts: [], late: [] });
  const oc = AudioNode.prototype.connect, isRT = (c) => c && !(c instanceof OfflineAudioContext);
  function hook(c, src) {
    let h = V.ctx.get(c);
    if (!h) {
      h = { srcs: [], node: null }; V.ctx.set(c, h);
      h.ready = c.audioWorklet.addModule(URL.createObjectURL(new Blob([REC], { type: 'text/javascript' }))).then(() => {
        h.node = new AudioWorkletNode(c, 'rec-tap', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'discrete' });
        for (const s of h.srcs) oc.call(s, h.node); const z = c.createGain(); z.gain.value = 0; oc.call(h.node, z); oc.call(z, c.destination);
      });
    }
    h.srcs.push(src); if (h.node) oc.call(src, h.node);
  }
  AudioNode.prototype.connect = function (d, ...r) { const res = oc.call(this, d, ...r); try { if (d instanceof AudioDestinationNode && isRT(this.context) && !(this instanceof AudioWorkletNode && this.__tap)) hook(this.context, this); } catch (e) { } return res; };
  for (const PR of [AudioScheduledSourceNode.prototype, AudioBufferSourceNode.prototype]) if (Object.prototype.hasOwnProperty.call(PR, 'start')) { const os = PR.start; PR.start = function (t, ...r) { if (isRT(this.context)) V.starts.push([this.context, Math.max(t || 0, this.context.currentTime)]); return os.call(this, t, ...r); }; }
  const AP = AudioParam.prototype;
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']) {
    const f = AP[m]; AP[m] = function (...a) { const ti = m === 'setTargetAtTime' || m === 'setValueCurveAtTime' ? a[1] : m.startsWith('cancel') ? a[0] : a[1]; for (const [c] of V.ctx) if (c.state === 'running' && ti < c.currentTime - 1e-9) { V.late.push([m, ti, c.currentTime]); break; } return f.apply(this, a); };
  }
  V.start = async (c) => { const h = V.ctx.get(c); await h.ready; V.starts = []; V.late = []; V.c = c; h.node.port.postMessage('start'); };
  V.onsets = () => V.starts.filter((x) => x[0] === V.c).map((x) => x[1]);
  V.stop = () => new Promise((res) => { const c = V.c, h = V.ctx.get(c); h.node.port.onmessage = (e) => { const u8 = new Uint8Array(e.data.a.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); res({ f0: e.data.f0, fs: c.sampleRate, b64: btoa(s), late: V.late.length, lateList: V.late.slice(0, 5) }); }; h.node.port.postMessage('stop'); });
})();
