// Performance review harness (paste into the page with javascript_tool). Does not change app code.
Element.prototype.setPointerCapture = function () {}; Element.prototype.releasePointerCapture = function () {}; Element.prototype.hasPointerCapture = function () { return true; };
window.__lt = window.__lt || [];
if (!window.__ltObs) { try { window.__ltObs = new PerformanceObserver((l) => { for (const e of l.getEntries()) __lt.push({ t: e.startTime, d: e.duration }); }); __ltObs.observe({ type: 'longtask', buffered: false }); } catch (e) { window.__ltErr = String(e); } }
window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
window.__key = (k, o = {}) => document.dispatchEvent(new KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o)));
window.__stat = (a) => { a = a.slice(2).sort((p, q) => p - q); if (!a.length) return null; const q = (p) => +a[Math.min(a.length - 1, Math.floor(p * a.length))].toFixed(2); return { p50: q(0.5), p95: q(0.95), max: +a[a.length - 1].toFixed(2), mean: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2) }; };
// run fn(k) once per animation frame for ms; report frame intervals, app frame time (rAF callbacks before ours), and full main-thread time incl. style/layout/paint
window.__mloop = async (fn, ms = 1500) => {
  const lt0 = __lt.length;
  const ts = [], pre = [], full = [], hnd = [];
  const mc = new MessageChannel(); let pendingTs = 0;
  mc.port1.onmessage = () => { full.push(performance.now() - pendingTs); };
  const t0 = performance.now(); let k = 0;
  await new Promise((done) => {
    const step = (t) => {
      ts.push(t); pre.push(performance.now() - t); pendingTs = t; mc.port2.postMessage(0);
      const w0 = performance.now(); k++; fn(k); hnd.push(performance.now() - w0);
      if (performance.now() - t0 < ms) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  await __wait(60);
  const iv = ts.slice(1).map((t, i) => t - ts[i]);
  return { frames: iv.length, fps: +(1000 / (iv.reduce((s, v) => s + v, 0) / iv.length)).toFixed(1), interval: __stat(iv), appFrameMs: __stat(pre), mainMs: __stat(full), handlerMs: __stat(hnd), longtasks: __lt.slice(lt0).map((e) => Math.round(e.d)) };
};
window.__pe = (el, type, x, y, o = {}) => el.dispatchEvent(new PointerEvent(type, Object.assign({ clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, isPrimary: true }, o)));
window.__mdrag = async (el, opts = {}) => {
  const r = el.getBoundingClientRect();
  const x0 = opts.x ?? (r.x + r.width * 0.5), y0 = opts.y ?? (r.y + r.height * 0.5);
  const tgt = opts.moveTarget || el;
  __pe(el, 'pointerdown', x0, y0, opts.ev);
  let x = x0, y = y0;
  const res = await __mloop((k) => {
    if (opts.path) { const p = opts.path(k); x = x0 + p[0]; y = y0 + p[1]; }
    else { const s = (k % 120) < 60 ? 1 : -1; x += (opts.dx ?? 3) * s; y += (opts.dy ?? 1) * s; }
    __pe(tgt, 'pointermove', x, y, opts.ev);
  }, opts.ms || 1500);
  __pe(tgt, 'pointerup', x, y, opts.ev);
  return res;
};
window.__mwheel = (el, ms = 1500) => { const r = el.getBoundingClientRect(); const x = r.x + r.width * 0.4, y = r.y + r.height * 0.45; return __mloop((k) => el.dispatchEvent(new WheelEvent('wheel', { clientX: x, clientY: y, deltaY: ((k % 80) < 40 ? 1 : -1) * 20, deltaMode: 0, bubbles: true, cancelable: true })), ms); };
// time from an action to the end of the next frame's rendering (two rAFs + a message)
window.__act = async (fn) => { const lt0 = __lt.length; const t0 = performance.now(); fn(); const tSync = performance.now() - t0; await new Promise((r) => requestAnimationFrame(() => { const mc = new MessageChannel(); mc.port1.onmessage = r; mc.port2.postMessage(0); })); const t1 = performance.now() - t0; return { syncMs: +tSync.toFixed(1), toFirstFrameDoneMs: +t1.toFixed(1), longtasks: __lt.slice(lt0).map((e) => Math.round(e.d)) }; };
// profiler: wraps GL / 2D / DOM entry points to count calls and time
window.__prof = window.__prof || { on: false, c: {}, t: {} };
if (!window.__profInstalled) {
  window.__profInstalled = true;
  const wrap = (proto, name, label) => { const orig = proto[name]; if (!orig) return; proto[name] = function (...a) { if (!__prof.on) return orig.apply(this, a); const t0 = performance.now(); try { return orig.apply(this, a); } finally { __prof.c[label] = (__prof.c[label] || 0) + 1; __prof.t[label] = (__prof.t[label] || 0) + performance.now() - t0; } }; };
  const G = WebGL2RenderingContext.prototype;
  for (const n of ['drawArraysInstanced', 'drawArrays', 'drawElements', 'beginTransformFeedback', 'texImage2D', 'bufferData', 'compileShader', 'linkProgram', 'getProgramParameter', 'getShaderParameter', 'createBuffer', 'createTexture', 'createVertexArray', 'deleteBuffer', 'deleteTexture', 'deleteVertexArray', 'readPixels']) wrap(G, n, 'gl.' + n);
  const C2 = CanvasRenderingContext2D.prototype;
  for (const n of ['drawImage', 'fillText', 'getImageData', 'putImageData', 'stroke', 'fill']) wrap(C2, n, '2d.' + n);
  wrap(Element.prototype, 'getBoundingClientRect', 'dom.gBCR');
  wrap(window, 'getComputedStyle', 'dom.getComputedStyle');
  const ih = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', { configurable: true, get() { return ih.get.call(this); }, set(v) { if (!__prof.on) return ih.set.call(this, v); const t0 = performance.now(); ih.set.call(this, v); __prof.c['dom.innerHTML='] = (__prof.c['dom.innerHTML='] || 0) + 1; __prof.t['dom.innerHTML='] = (__prof.t['dom.innerHTML='] || 0) + performance.now() - t0; } });
}
window.__wrapMJ = () => { if (window.MathJax && MathJax.tex2svg && !MathJax.tex2svg.__w) { const o = MathJax.tex2svg; MathJax.tex2svg = function (...a) { if (!__prof.on) return o.apply(this, a); const t0 = performance.now(); try { return o.apply(this, a); } finally { __prof.c['mj.tex2svg'] = (__prof.c['mj.tex2svg'] || 0) + 1; __prof.t['mj.tex2svg'] = (__prof.t['mj.tex2svg'] || 0) + performance.now() - t0; } }; MathJax.tex2svg.__w = true; return true; } return false; };
window.__profRun = async (fn) => { __wrapMJ(); __prof.c = {}; __prof.t = {}; __prof.on = true; let r; try { r = await fn(); } finally { __prof.on = false; } const n = (r && r.frames) || 1; const out = {}; for (const k of Object.keys(__prof.c).sort((a, b) => __prof.t[b] - __prof.t[a]).slice(0, 12)) out[k] = [+(__prof.c[k] / n).toFixed(1), +(__prof.t[k] / n).toFixed(2)]; return { r, prof: out }; };
window.__ls = () => { const o = JSON.parse(localStorage.getItem('complex-map-workbench-v1:' + new URLSearchParams(location.search).get('ns')) || 'null'); return o && { srcView: o.srcView, mode: o.rightMode, meshN: o.meshN, shapes: o.shapes.map((s) => s.kind + JSON.stringify(s.p || s.c || s.a || '')), steps: o.steps.map((s) => s.type + JSON.stringify(s.params)), focus: o.focus }; };
'harness ok';
