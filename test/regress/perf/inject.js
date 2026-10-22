// In-page instrumentation for the perf suite. Installed with Page.addScriptToEvaluateOnNewDocument, so it runs
// before the app's own scripts. It only observes; the app's behaviour is unchanged except that, while
// __perf.sync is on, every animation frame that issued WebGL draws ends with a 1-pixel gl.readPixels, which waits for
// the GPU: the frame's GPU work is then part of the measured frame time (GPU-synchronised frame times).
//
// window.__perf:
//   frames      [{ts, t0, t1, cpu, gpu, draws, n}] one record per animation frame that ran at least one callback
//               cpu = main-thread time in rAF callbacks; gpu = time of the readPixels sync; t1 = end incl. sync
//   evts        [[type, eventTimeStamp, ms, t]] main-thread time of every listener call for input events
//   draws, lastDrawT        WebGL draw calls so far / page time of the last one
//   led         {L, R, lastChangeT} state of #leftLed / #rightLed ('ok' | 'busy' | 'err')
//   mem()       live bytes in WebGL buffers, textures and renderbuffers (+ drawing buffers)
//   status()    a compact snapshot for the runner's settle polling
//   progs       [{t, ready, inv}] one record per linkProgram call: t = page time of the call, ready = when the app
//               first saw the program complete (COMPLETION_STATUS_KHR true, or a LINK_STATUS query, which waits),
//               inv = an inverse-rendering program (its fragment shader has the walker of SPEC 4.1: invWalk / uInv)
//   links, invLinks, invDraws   counters; frames also count their draws with an inverse program (frame field inv)
//   ledBusy     number of times an LED turned busy (a fix-up / refinement job started)
//   status().pending  the app's GLR.frameStatus().pending: the last frame could not draw everything with its own
//               programs because one is still compiling (a stand-in or nothing was drawn; onReady redraws). A view
//               is not settled while it is true (the app draws nothing while it waits for a compile)
(() => {
  if (window.__perf) return;
  const now = () => performance.now();
  const P = window.__perf = {
    sync: true, frames: [], evts: [], draws: 0, lastDrawT: 0, lastActT: 0, gls: [], glErrors: 0,
    led: { L: '', R: '', lastChangeT: 0 }, maxFrames: 60000, maxEvts: 60000,
    progs: [], links: 0, invLinks: 0, invDraws: 0, curInv: false, ledBusy: 0,
  };

  // ---------------- requestAnimationFrame timing ----------------
  const rAF = window.requestAnimationFrame.bind(window);
  let cur = null; // the record of the frame whose callbacks are running
  const syncGL = () => {
    const gl = P.gls[0];
    if (!gl || gl.isContextLost()) return;
    try {
      const fb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
      const pb = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
      if (fb) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      if (pb) gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, P._px || (P._px = new Uint8Array(4)));
      if (fb) gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
      if (pb) gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pb);
    } catch (e) { P.glErrors++; }
  };
  window.requestAnimationFrame = function (cb) {
    return rAF(function (ts) {
      if (!cur || cur.ts !== ts) {
        cur = { ts, t0: now(), t1: 0, cpu: 0, gpu: 0, draws: 0, n: 0, inv: 0 };
        if (P.frames.length < P.maxFrames) P.frames.push(cur);
      }
      const d0 = P.draws, i0 = P.invDraws, a = now();
      try { cb(ts); } finally {
        const b = now();
        cur.cpu += b - a; cur.n++;
        const drew = P.draws - d0;
        cur.draws += drew;
        cur.inv += P.invDraws - i0;
        let c = b;
        if (drew && P.sync) { syncGL(); c = now(); cur.gpu += c - b; }
        cur.t1 = c;
        if (drew) P.lastActT = c;
      }
    });
  };

  // ---------------- input listener timing ----------------
  const TIMED = new Set(['pointermove', 'pointerdown', 'pointerup', 'wheel', 'mousemove', 'mousedown', 'mouseup', 'input', 'change', 'lostpointercapture', 'pointerover', 'pointerout', 'pointerleave', 'pointerenter']);
  const wrapped = new WeakMap(); // listener -> Map(type|capture -> wrapper)
  const capOf = (o) => (typeof o === 'boolean' ? o : !!(o && o.capture));
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    if (!fn || !TIMED.has(type)) return add.call(this, type, fn, opts);
    let m = wrapped.get(fn);
    if (!m) { m = new Map(); wrapped.set(fn, m); }
    const key = type + '|' + capOf(opts);
    let w = m.get(key);
    if (!w) {
      w = function (e) {
        const a = now();
        try { return typeof fn === 'function' ? fn.call(this, e) : fn.handleEvent(e); } finally {
          const b = now();
          if (P.evts.length < P.maxEvts) P.evts.push([e.type, e.timeStamp, b - a, a]);
        }
      };
      m.set(key, w);
    }
    return add.call(this, type, w, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    const m = fn && wrapped.get(fn);
    const w = m && m.get(type + '|' + capOf(opts));
    return rem.call(this, type, w || fn, opts);
  };

  // ---------------- WebGL: contexts, draws, memory ----------------
  const gcOrig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, attrs) {
    const c = gcOrig.call(this, kind, attrs);
    if (c && (kind === 'webgl2' || kind === 'webgl') && !P.gls.includes(c)) P.gls.push(c);
    return c;
  };
  if (window.OffscreenCanvas) {
    const gco = OffscreenCanvas.prototype.getContext;
    OffscreenCanvas.prototype.getContext = function (kind, attrs) {
      const c = gco.call(this, kind, attrs);
      if (c && (kind === 'webgl2' || kind === 'webgl') && !P.gls.includes(c)) P.gls.push(c);
      return c;
    };
  }
  const G = window.WebGL2RenderingContext && WebGL2RenderingContext.prototype;
  if (!G) return;
  const K = WebGL2RenderingContext;
  for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
    const f = G[name];
    G[name] = function () { P.draws++; if (P.curInv) P.invDraws++; P.lastDrawT = now(); return f.apply(this, arguments); };
  }
  // programs: links, readiness and inverse programs (perf units examples, gallery.open, hover.dim; SPEC 12.5)
  const srcOf = new WeakMap(), shadersOf = new WeakMap(), progRec = new WeakMap();
  const INV_RE = /\binvWalk\b|\buInv\b/;
  const COMPLETION_STATUS_KHR = 0x91B1;
  const shaderSource = G.shaderSource;
  G.shaderSource = function (sh, src) { try { srcOf.set(sh, String(src)); } catch (e) { /* ignore */ } return shaderSource.apply(this, arguments); };
  const attachShader = G.attachShader;
  G.attachShader = function (p, sh) {
    try { let l = shadersOf.get(p); if (!l) { l = []; shadersOf.set(p, l); } l.push(sh); } catch (e) { /* ignore */ }
    return attachShader.apply(this, arguments);
  };
  const linkProgram = G.linkProgram;
  G.linkProgram = function (p) {
    try {
      const inv = (shadersOf.get(p) || []).some((sh) => INV_RE.test(srcOf.get(sh) || ''));
      const rec = { t: now(), ready: null, inv };
      progRec.set(p, rec);
      if (P.progs.length < 20000) P.progs.push(rec);
      P.links++; if (inv) P.invLinks++;
    } catch (e) { /* ignore */ }
    return linkProgram.apply(this, arguments);
  };
  const getProgramParameter = G.getProgramParameter;
  G.getProgramParameter = function (p, pname) {
    const r = getProgramParameter.apply(this, arguments);
    try {
      if ((pname === COMPLETION_STATUS_KHR && r) || pname === K.LINK_STATUS) { const rec = progRec.get(p); if (rec && rec.ready === null) rec.ready = now(); }
    } catch (e) { /* ignore */ }
    return r;
  };
  const useProgram = G.useProgram;
  G.useProgram = function (p) { const rec = p && progRec.get(p); P.curInv = !!(rec && rec.inv); return useProgram.apply(this, arguments); };
  const mem = { buf: new Map(), tex: new Map(), rb: new Map(), live: 0, peak: 0, allocated: 0, allocCalls: 0 };
  P._mem = mem;
  const setBytes = (map, obj, sub, bytes) => {
    let e = map.get(obj);
    if (!e) { e = new Map(); map.set(obj, e); }
    const old = e.get(sub) || 0;
    e.set(sub, bytes);
    mem.live += bytes - old;
    mem.allocated += bytes; mem.allocCalls++;
    if (mem.live > mem.peak) mem.peak = mem.live;
  };
  const drop = (map, obj) => {
    const e = obj && map.get(obj);
    if (!e) return;
    for (const v of e.values()) mem.live -= v;
    map.delete(obj);
  };
  // bytes per texel of a (sized or unsized) internal format
  const BPP = {};
  const S = (n, b) => { if (K[n] !== undefined) BPP[K[n]] = b; };
  S('R8', 1); S('R8_SNORM', 1); S('R8UI', 1); S('R8I', 1); S('ALPHA', 1); S('LUMINANCE', 1); S('LUMINANCE_ALPHA', 2);
  S('RG8', 2); S('RG8_SNORM', 2); S('R16F', 2); S('R16UI', 2); S('R16I', 2); S('RGB565', 2); S('RGBA4', 2); S('RGB5_A1', 2); S('DEPTH_COMPONENT16', 2);
  S('RGB8', 3); S('SRGB8', 3); S('RGB8_SNORM', 3);
  S('RGBA8', 4); S('SRGB8_ALPHA8', 4); S('RGBA8_SNORM', 4); S('RGB10_A2', 4); S('RG16F', 4); S('R32F', 4); S('R32UI', 4); S('R32I', 4);
  S('RG16UI', 4); S('RG16I', 4); S('R11F_G11F_B10F', 4); S('RGB9_E5', 4); S('RGBA8UI', 4); S('RGBA8I', 4);
  S('DEPTH_COMPONENT24', 4); S('DEPTH_COMPONENT32F', 4); S('DEPTH24_STENCIL8', 4); S('DEPTH_COMPONENT', 4);
  S('RGB16F', 6); S('RG32F', 8); S('RGBA16F', 8); S('RG32UI', 8); S('RG32I', 8); S('RGBA16UI', 8); S('RGBA16I', 8); S('DEPTH32F_STENCIL8', 8);
  S('RGB32F', 12); S('RGB32UI', 12); S('RGB32I', 12); S('RGBA32F', 16); S('RGBA32UI', 16); S('RGBA32I', 16);
  const unsized = (ifmt, fmt, type) => {
    const comps = { [K.RGBA]: 4, [K.RGB]: 3, [K.LUMINANCE_ALPHA]: 2, [K.LUMINANCE]: 1, [K.ALPHA]: 1 }[ifmt] || 4;
    const per = type === K.FLOAT ? 4 : (type === K.HALF_FLOAT ? 2 : 1);
    return comps * per;
  };
  const bpp = (ifmt, fmt, type) => (ifmt === K.RGBA || ifmt === K.RGB || ifmt === K.LUMINANCE || ifmt === K.ALPHA || ifmt === K.LUMINANCE_ALPHA ? unsized(ifmt, fmt, type) : (BPP[ifmt] || 4));
  const bindingOf = (gl, target) => {
    switch (target) {
      case K.ARRAY_BUFFER: return gl.getParameter(K.ARRAY_BUFFER_BINDING);
      case K.ELEMENT_ARRAY_BUFFER: return gl.getParameter(K.ELEMENT_ARRAY_BUFFER_BINDING);
      case K.COPY_READ_BUFFER: return gl.getParameter(K.COPY_READ_BUFFER_BINDING);
      case K.COPY_WRITE_BUFFER: return gl.getParameter(K.COPY_WRITE_BUFFER_BINDING);
      case K.TRANSFORM_FEEDBACK_BUFFER: return gl.getParameter(K.TRANSFORM_FEEDBACK_BUFFER_BINDING);
      case K.UNIFORM_BUFFER: return gl.getParameter(K.UNIFORM_BUFFER_BINDING);
      case K.PIXEL_PACK_BUFFER: return gl.getParameter(K.PIXEL_PACK_BUFFER_BINDING);
      case K.PIXEL_UNPACK_BUFFER: return gl.getParameter(K.PIXEL_UNPACK_BUFFER_BINDING);
      case K.TEXTURE_2D: return gl.getParameter(K.TEXTURE_BINDING_2D);
      case K.TEXTURE_3D: return gl.getParameter(K.TEXTURE_BINDING_3D);
      case K.TEXTURE_2D_ARRAY: return gl.getParameter(K.TEXTURE_BINDING_2D_ARRAY);
      default:
        if (target >= K.TEXTURE_CUBE_MAP_POSITIVE_X && target <= K.TEXTURE_CUBE_MAP_NEGATIVE_Z) return gl.getParameter(K.TEXTURE_BINDING_CUBE_MAP);
        if (target === K.TEXTURE_CUBE_MAP) return gl.getParameter(K.TEXTURE_BINDING_CUBE_MAP);
        return null;
    }
  };
  const bufferData = G.bufferData;
  G.bufferData = function (target, a1, usage, srcOffset, length) {
    const r = bufferData.apply(this, arguments);
    try {
      let bytes;
      if (typeof a1 === 'number') bytes = a1;
      else if (a1 && a1.byteLength !== undefined) {
        const bpe = a1.BYTES_PER_ELEMENT || 1;
        bytes = length ? length * bpe : a1.byteLength - (srcOffset || 0) * bpe;
      } else bytes = 0;
      const b = bindingOf(this, target);
      if (b) setBytes(mem.buf, b, 0, bytes);
    } catch (e) { /* never break the app */ }
    return r;
  };
  const deleteBuffer = G.deleteBuffer;
  G.deleteBuffer = function (b) { drop(mem.buf, b); return deleteBuffer.apply(this, arguments); };
  const texImage2D = G.texImage2D;
  G.texImage2D = function (target, level, ifmt) {
    const r = texImage2D.apply(this, arguments);
    try {
      let w, h, fmt, type;
      if (arguments.length >= 8) { w = arguments[3]; h = arguments[4]; fmt = arguments[6]; type = arguments[7]; }
      else { fmt = arguments[3]; type = arguments[4]; const src = arguments[5]; w = src && (src.videoWidth || src.naturalWidth || src.width) || 0; h = src && (src.videoHeight || src.naturalHeight || src.height) || 0; }
      const t = bindingOf(this, target);
      if (t) setBytes(mem.tex, t, target + ':' + level, w * h * bpp(ifmt, fmt, type));
    } catch (e) { /* ignore */ }
    return r;
  };
  const texImage3D = G.texImage3D;
  G.texImage3D = function (target, level, ifmt, w, h, d, border, fmt, type) {
    const r = texImage3D.apply(this, arguments);
    try { const t = bindingOf(this, target); if (t) setBytes(mem.tex, t, target + ':' + level, w * h * d * bpp(ifmt, fmt, type)); } catch (e) { /* ignore */ }
    return r;
  };
  const texStorage2D = G.texStorage2D;
  G.texStorage2D = function (target, levels, ifmt, w, h) {
    const r = texStorage2D.apply(this, arguments);
    try {
      let bytes = 0; for (let l = 0; l < levels; l++) bytes += Math.max(1, w >> l) * Math.max(1, h >> l) * bpp(ifmt);
      if (target === K.TEXTURE_CUBE_MAP) bytes *= 6;
      const t = bindingOf(this, target); if (t) setBytes(mem.tex, t, 'storage', bytes);
    } catch (e) { /* ignore */ }
    return r;
  };
  const texStorage3D = G.texStorage3D;
  G.texStorage3D = function (target, levels, ifmt, w, h, d) {
    const r = texStorage3D.apply(this, arguments);
    try {
      let bytes = 0; for (let l = 0; l < levels; l++) bytes += Math.max(1, w >> l) * Math.max(1, h >> l) * (target === K.TEXTURE_3D ? Math.max(1, d >> l) : d) * bpp(ifmt);
      const t = bindingOf(this, target); if (t) setBytes(mem.tex, t, 'storage', bytes);
    } catch (e) { /* ignore */ }
    return r;
  };
  const deleteTexture = G.deleteTexture;
  G.deleteTexture = function (t) { drop(mem.tex, t); return deleteTexture.apply(this, arguments); };
  const rbs = G.renderbufferStorage, rbsm = G.renderbufferStorageMultisample;
  G.renderbufferStorage = function (target, ifmt, w, h) {
    const r = rbs.apply(this, arguments);
    try { const b = this.getParameter(K.RENDERBUFFER_BINDING); if (b) setBytes(mem.rb, b, 0, w * h * bpp(ifmt)); } catch (e) { /* ignore */ }
    return r;
  };
  G.renderbufferStorageMultisample = function (target, samples, ifmt, w, h) {
    const r = rbsm.apply(this, arguments);
    try { const b = this.getParameter(K.RENDERBUFFER_BINDING); if (b) setBytes(mem.rb, b, 0, w * h * bpp(ifmt) * Math.max(1, samples)); } catch (e) { /* ignore */ }
    return r;
  };
  const deleteRenderbuffer = G.deleteRenderbuffer;
  G.deleteRenderbuffer = function (b) { drop(mem.rb, b); return deleteRenderbuffer.apply(this, arguments); };

  const sumMap = (m) => { let s = 0; for (const e of m.values()) for (const v of e.values()) s += v; return s; };
  P.mem = () => {
    // drawing buffers of the WebGL canvases: color (4 B) + depth (4 B) per pixel, x4 samples when antialiased
    let draw = 0;
    for (const gl of P.gls) {
      const a = gl.getContextAttributes ? gl.getContextAttributes() || {} : {};
      const px = gl.drawingBufferWidth * gl.drawingBufferHeight;
      draw += px * 4 + px * (4 + (a.depth ? 4 : 0) + (a.stencil ? 1 : 0)) * (a.antialias ? 4 : 1);
    }
    const buffers = sumMap(mem.buf), textures = sumMap(mem.tex), renderbuffers = sumMap(mem.rb);
    return { buffers, textures, renderbuffers, drawingBuffers: draw, live: buffers + textures + renderbuffers, peak: mem.peak, allocated: mem.allocated, allocCalls: mem.allocCalls, nBuffers: mem.buf.size, nTextures: mem.tex.size };
  };
  P.resetPeak = () => { mem.peak = mem.live; mem.allocated = 0; mem.allocCalls = 0; };

  // ---------------- LEDs (the app's "up to date" / "refining" signal) ----------------
  const ledState = (el) => (el ? (el.classList.contains('busy') ? 'busy' : el.classList.contains('err') ? 'err' : el.classList.contains('ok') ? 'ok' : '') : '');
  const watchLeds = () => {
    const l = document.getElementById('leftLed'), r = document.getElementById('rightLed');
    if (!l || !r) return false;
    const upd = () => {
      const L = ledState(l), R = ledState(r);
      if (L !== P.led.L || R !== P.led.R) { if ((L === 'busy' && P.led.L !== 'busy') || (R === 'busy' && P.led.R !== 'busy')) P.ledBusy++; P.led.L = L; P.led.R = R; P.led.lastChangeT = now(); P.lastActT = Math.max(P.lastActT, P.led.lastChangeT); }
    };
    upd();
    new MutationObserver(upd).observe(l, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(upd).observe(r, { attributes: true, attributeFilter: ['class'] });
    return true;
  };
  if (!watchLeds()) document.addEventListener('DOMContentLoaded', () => { if (!watchLeds()) setTimeout(watchLeds, 0); });

  // main-thread tasks of 50 ms or more (the Long Tasks API), e.g. an unsliced CPU job after an interaction
  P.longtasks = [];
  try {
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (P.longtasks.length < 20000) P.longtasks.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
  } catch (e) { /* not supported */ }
  P.longSince = (since, until = Infinity) => P.longtasks.filter((t) => t[0] + t[1] >= since && t[0] <= until).map((t) => [+t[0].toFixed(2), +t[1].toFixed(2)]);

  const pendingNow = () => { try { return typeof GLR !== 'undefined' && GLR && typeof GLR.frameStatus === 'function' ? !!GLR.frameStatus().pending : false; } catch (e) { return false; } };
  P.status = () => ({ now: now(), lastDrawT: P.lastDrawT, lastActT: Math.max(P.lastActT, P.lastDrawT), ledL: P.led.L, ledR: P.led.R, draws: P.draws, nFrames: P.frames.length, pending: pendingNow(), invLinks: P.invLinks, invDraws: P.invDraws });
  // frames and listener timings with t0 >= since (page time), compacted for transfer
  P.framesSince = (since, until = Infinity) => P.frames.filter((f) => f.t0 >= since && f.t0 <= until).map((f) => [+f.t0.toFixed(2), +f.cpu.toFixed(3), +f.gpu.toFixed(3), f.draws, f.n, +f.ts.toFixed(2), +f.t1.toFixed(2), f.inv]);
  // programs linked at page times in [since, until]: [t, ready (null: never seen complete), inv]
  P.progsSince = (since, until = Infinity) => P.progs.filter((r) => r.t >= since && r.t <= until).map((r) => [+r.t.toFixed(2), r.ready === null ? null : +r.ready.toFixed(2), r.inv]);
  P.counters = () => ({ links: P.links, invLinks: P.invLinks, invDraws: P.invDraws, ledBusy: P.ledBusy, draws: P.draws });
  P.evtsSince = (since, until = Infinity) => P.evts.filter((e) => e[3] >= since && e[3] <= until).map((e) => [e[0], +e[1].toFixed(3), +e[2].toFixed(4)]);
  P.clear = () => { P.frames.length = 0; P.evts.length = 0; cur = null; };
})();
