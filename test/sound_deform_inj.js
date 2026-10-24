// Injected before the app's own scripts by test/sound_deform_clicks_cmd.js (after test/sound_rec.js, the recorder).
//   ?raf=<Hz>: requestAnimationFrame runs at that rate (a 240 Hz display; headless Chrome paints at 60): callbacks run
//   together, async, on a precise timer (a MessageChannel yield loop near the target, as the pointer driver does).
//   window.__dlog: what the independent detector (notes/sound/cdp3/det.py) reads: automation calls landing behind the
//   clock (late), the voices' worklet commands (cmds), source starts and stops, frames (ev).
(() => {
  const L = (window.__dlog = { starts: [], stops: [], late: [], cmds: [], ev: [], acts: [] });
  const hz = +new URLSearchParams(location.search).get('raf') || 0;
  if (hz) {
    const iv = 1000 / hz, q = new Map(), mc = new MessageChannel();
    let id = 0, armed = false, next = 0;
    const run = () => { armed = false; const now = performance.now(); next = Math.max(next + iv, now + 0.5 * iv); const list = [...q.values()]; q.clear(); for (const f of list) { try { f(now); } catch (e) { setTimeout(() => { throw e; }); } } };
    const loop = () => { const d = next - performance.now(); if (d <= 0.15) run(); else if (d > 3) setTimeout(loop, d - 2); else mc.port2.postMessage(0); };
    mc.port1.onmessage = loop;
    window.requestAnimationFrame = (f) => { q.set(++id, f); if (!armed) { armed = true; if (!next) next = performance.now() + iv; mc.port2.postMessage(0); } return id; };
    window.cancelAnimationFrame = (i) => { q.delete(i); };
  }
  const ctxOf = () => (window.__rec && window.__rec.ctx) || null;
  const AP = AudioParam.prototype;
  for (const m of ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime', 'setTargetAtTime', 'setValueCurveAtTime', 'cancelScheduledValues', 'cancelAndHoldAtTime']) {
    const f = AP[m];
    if (!f) continue;
    AP[m] = function (...a) {
      const c = ctxOf(), ti = m.startsWith('cancel') ? a[0] : a[1];
      if (c && this.context === c && c.state === 'running' && ti < c.currentTime) L.late.push({ m, t: ti, now: c.currentTime });
      return f.apply(this, a);
    };
  }
  const PR = AudioScheduledSourceNode.prototype, os = PR.start, op = PR.stop;
  let sid = 0;
  PR.start = function (t, ...r) { const c = ctxOf(); if (c && this.context === c) { this.__id = ++sid; L.starts.push({ id: this.__id, k: this.constructor.name, t: t || 0, now: c.currentTime }); } return os.call(this, t, ...r); };
  PR.stop = function (t, ...r) { const c = ctxOf(); if (c && this.context === c) L.stops.push({ id: this.__id, t: t == null ? null : t, now: c.currentTime }); return op.call(this, t, ...r); };
  const pm = MessagePort.prototype.postMessage;
  MessagePort.prototype.postMessage = function (d, ...r) {
    try { const c = ctxOf(); if (c && Array.isArray(d) && d[0] && typeof d[0] === 'object' && 'at' in d[0]) L.cmds.push({ now: c.currentTime, c: d[0] }); } catch (e) { /* observe only */ }
    return pm.call(this, d, ...r);
  };
  // a frame: the transport's t moved (logged by the command file's rAF probe); kept short
  window.__dframe = () => { const c = ctxOf(); if (c) L.ev.push({ now: c.currentTime, pn: performance.now() }); };
})();
