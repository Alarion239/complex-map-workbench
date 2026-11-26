  // ---------------- frame management ----------------
  let fw = 0, fh = 0, vpX = 0, vpY = 0;
  function init(cnv) {
    canvas = cnv || document.createElement('canvas');
    if (!cnv) { canvas.width = 640; canvas.height = 480; }
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) return false;
      shadowUniforms(gl);
      // (the GLSL library's sin and cos for this renderer, before the first program: GLChain.useRenderer, #1739)
      GLChain.useRenderer(gl);
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      GLChain.setUniformVecs(Math.min(gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS), gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)));
      pcExt = gl.getExtension('KHR_parallel_shader_compile');
      rtOK = !!gl.getExtension('EXT_color_buffer_float');
      const dri = gl.getExtension('WEBGL_debug_renderer_info');
      swiftShader = /SwiftShader/i.test(String(gl.getParameter(dri ? dri.UNMASKED_RENDERER_WEBGL : gl.RENDERER)));
      ok = true;
      prestart(PRESTART_2D);
      canvas.addEventListener('webglcontextlost', (e) => {
        // a GPU reset: the browser may give the context back (webglcontextrestored); until then the app shows
        // a "restoring" state rather than the unsupported message
        e.preventDefault();
        ok = false; lost = true;
        for (const r of live) r.tf = r.tmp = null;   // GPU objects are gone with the context
        live.clear();
        cacheAll.clear(); tmpAll.clear(); cacheBytes = 0;
        // the pre-mapped meshes' buffers are gone too: forget them (destroy() on one of them later is a no-op), so the
        // budget counts only the meshes re-uploaded after the restore
        for (const [r] of preAll) { r.vao = r.buf = null; r.n = 0; r.count = 0; }
        preAll.clear(); preBytes = 0;
        clearTimeout(pollT); pollT = 0;
        if (api.onLost) api.onLost();
      });
      canvas.addEventListener('webglcontextrestored', () => {
        // every GPU object is gone: forget them and let the app rebuild its meshes
        progs.clear(); tplCache.clear();
        sphereGeo = emptyVAO = markVAO = markBuf = lutTex = palTex = tfObj = scratch = nodeTex = nodeKey = standInTex = standInKey = ptsTex = rtFbo = null;
        peel = null; peelOn = 0; peelSeen = 0; peelQ = null; invTex = halfTex = halfFbo = null; invTexKey = ''; halfW = halfH = 0; invUpWarm = false; invFailed.clear(); tqPending.length = 0; tqActive = null; tqChecked = false; tqExt = null;
        scratchBytes = 0;
        reptAccs.clear(); ctxGen++;
        lands.clear(); lastLand = landS = null;
        // (the refinement's programs are warmed again one per frame, and its read-back buffer is gone)
        rfWarmAll = false; rfWarmT = -1e9; rfWarmTex = null; rdBuf = null;
        maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        GLChain.setUniformVecs(Math.min(gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS), gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS)));
        pcExt = gl.getExtension('KHR_parallel_shader_compile');
        rtOK = !!gl.getExtension('EXT_color_buffer_float'); halfOK = null;
        ok = true; lost = false;
        prestart(PRESTART_2D);
        if (api.onRestore) api.onRestore();
      });
    } catch (e) {
      ok = false;
    }
    return ok;
  }
  // a new frame of pw x ph device px, cleared to clear (rgba 0-1; transparent by default). keep: it goes on with the
  // status of the frame before it (frameStatus), for a pane drawn in several frames: it reports what each waited for
  function begin(pw, ph, clear, keep) {
    if (canvas.width < pw || canvas.height < ph) {
      canvas.width = Math.max(canvas.width, Math.ceil(pw));
      canvas.height = Math.max(canvas.height, Math.ceil(ph));
    }
    // after beginHalfPre the frame has begun already (its status kept): back to the default framebuffer, the half
    // layer waiting for compositeHalf; otherwise a pre-pass layer nobody composited is stale
    if (preActive && fw === pw && fh === ph) { preActive = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    else {
      if (preActive) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      preActive = false;
      if (halfOpen && halfOpen.pre) halfOpen = null;
      if (!keep) { frameErr = ''; framePending = false; frameRefining = false; frameCompiling = false; invAltUsed = false; frameOver = 0; }
      invFrame++;
    }
    fw = pw; fh = ph; vpX = 0; vpY = 0;
    gl.viewport(0, 0, pw, ph);
    gl.disable(gl.SCISSOR_TEST);
    const c = clear || [0, 0, 0, 0];
    gl.clearColor(c[0], c[1], c[2], c[3]);
    gl.clearDepth(1);
    gl.depthMask(true);
    // (a frame writes every channel: a write mask ends with the frame it was set in)
    if (!maskRGB || !maskA) { maskRGB = maskA = true; gl.colorMask(true, true, true, true); }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    resetState();
  }
  // Optional: draw into a sub-rectangle (device px, bottom-left origin) of a shared stage canvas.
  function viewport(x, y, w, h, clear) {
    if (preActive) { preActive = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    if (halfOpen && halfOpen.pre) halfOpen = null;
    fw = w; fh = h; vpX = x; vpY = y;
    frameErr = ''; framePending = false; frameRefining = false; frameCompiling = false; invAltUsed = false; frameOver = 0; invFrame++;
    gl.viewport(x, y, w, h);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, y, w, h);
    if (clear !== false) {
      const c = clear || [0, 0, 0, 0];
      gl.clearColor(c[0], c[1], c[2], c[3]);
      gl.depthMask(true);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    resetState();
  }
  function resetState() {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.POLYGON_OFFSET_FILL);
  }
  // a promise that settles once the GPU has finished every command issued so far: a fence polled between tasks,
  // never waited on (SPEC 10.6: the export reads its rasters back only then, so a readback does not hold the main
  // thread while the GPU finishes 300 dpi passes; P3 review). Settles anyway after maxMs or on a lost context.
  // (a hidden page runs timers about once a second: a video made there polls through a message channel instead)
  const laterQ = [], laterCh = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
  if (laterCh) laterCh.port1.onmessage = () => { const f = laterQ.shift(); if (f) f(); };
  const later = (f) => { if (laterCh && typeof document !== 'undefined' && document.hidden) { laterQ.push(f); laterCh.port2.postMessage(0); } else setTimeout(f, 4); };
  function gpuDone(maxMs = 3000) {
    if (!ok || lost || !gl || typeof gl.fenceSync !== 'function') return Promise.resolve(false);
    let f = null;
    try { f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); } catch (e) { f = null; }
    if (!f) return Promise.resolve(false);
    const t0 = performance.now();
    return new Promise((res) => {
      const poll = () => {
        let done = true;
        try { done = gl.isContextLost() || gl.getSyncParameter(f, gl.SYNC_STATUS) === gl.SIGNALED; } catch (e) { done = true; }
        if (done || performance.now() - t0 > maxMs) { try { gl.deleteSync(f); } catch (e) { /* lost */ } res(done); return; }
        later(poll);
      };
      later(poll);
    });
  }
  function blit(ctx) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, canvas.height - fh, fw, fh, 0, 0, fw, fh);
    ctx.restore();
  }
  // A new chain structure (key) becomes the current version; the previous one is kept (with its parameter values)
  // so its compiled programs can draw while the new ones compile.
  const sigsOf = (key) => { try { const k = JSON.parse(key); return Array.isArray(k[1]) ? k[1] : []; } catch (e) { return []; } };
  function setChain(info) {
    if (!sideMode) chainRefused = '';
    if (sideMode) {
      // a side chain: its own version object (never the user's, whose parameter values it would overwrite)
      let ch = sideChs.get(info.key);
      if (!ch) {
        ch = { key: info.key, info: null, data: null, hash: '', sigs: sigsOf(info.key) };
        sideChs.set(info.key, ch);
        if (sideChs.size > SIDE_KEEP) sideChs.delete(sideChs.keys().next().value);
      }
      cur = ch;
    } else if (info.key !== cur.key) {
      // (the steps view's carried colour's scratch entries, kept between its glides: another chain's draws make their own)
      for (const e of [...tmpAll]) if (e.carry) freeTmp(e);
      if (cur.info) hist.unshift(cur);
      const j = hist.findIndex((h) => h.key === info.key);
      cur = j >= 0 ? hist.splice(j, 1)[0] : { key: info.key, info: null, data: null, hash: '', sigs: sigsOf(info.key) };
      if (hist.length > PROG_KEEP) hist.length = PROG_KEEP;
    }
    if (discardPending && !sideMode) dropOtherChains();
    cur.info = info;
    const n = Math.max(4, info.slots * 4);
    if (!cur.data || cur.data.length !== n) cur.data = new Float32Array(n); else cur.data.fill(0);
    info.fill(cur.data);
    cur.hash = Array.prototype.join.call(cur.data, ',');
  }
  // view: {cx, cy, s (css px/unit)}, dpr; org: the resource origin (float64). The view centre goes in as a hi/lo
  // pair, and uRel = O - centre (float64 difference) places identity draws.
  function view2D(P, v, dpr, org) {
    u2f(P, 'uCenter', hi32(v.cx), hi32(v.cy));
    u2f(P, 'uCenterLo', v.cx - hi32(v.cx), v.cy - hi32(v.cy));
    u2f(P, 'uScale', 2 * v.s * dpr / fw, 2 * v.s * dpr / fh);
    u2f(P, 'uPx', fw, fh);
    u1f(P, 'uDpr', dpr);
    const ox = org ? org[0] : 0, oy = org ? org[1] : 0;
    u2f(P, 'uRel', ox - v.cx, oy - v.cy);
    originUniforms(P, org);
  }

  // ---------------- graph paper (spec 6.1) ----------------
  const TIER_M = [0.5, 1, 5, 10, 50, 100];   // 0.5 keeps the d0 / 2 family when d0 steps a decade: no popping
  function nice125(x) {
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    for (const m of [1, 2, 5, 10]) if (m * p >= x * (1 - 1e-9)) return m * p;
    return 10 * p;
  }
  // st: {view:{cx,cy,s}, dpr, plane, minor, medium, major, axis, unit, unitAlpha, ticks?:{x,y},
  //      overlay?:{color, alpha, axisAlpha, casing, casingAlpha}}  (overlay: transparent, major tier + axes only)
  const tierBuf = new Float32Array(24), tierCol = new Float32Array(18);
  function drawGrid(st) {
    if (!ok) return;
    const P = program('grid');
    if (!P) return;
    const v = st.view, dpr = st.dpr || 1, s = v.s, W = fw, H = fh;
    const ov = st.overlay || null;
    const minor = col3(st.minor, '#E2EEF2'), medium = col3(st.medium, '#D3E6ED'), major = col3(st.major, '#B5D4E0');
    const d0 = Math.pow(10, Math.ceil(Math.log10(8 / s)));
    for (let i = 0; i < 6; i++) {
      const step = d0 * TIER_M[i], px = step * s;
      let a = smooth(8, 20, px);
      const t = smooth(Math.log(12), Math.log(240), Math.log(px));
      let c = t < 0.5 ? minor.map((x, k) => x + (medium[k] - x) * 2 * t) : medium.map((x, k) => x + (major[k] - x) * (2 * t - 1));
      if (ov) { c = col3(ov.color, [1, 1, 1]); a *= smooth(0.5, 1, t) * (ov.alpha ?? 0.22); }
      const kx = Math.round(v.cx / step), ky = Math.round(v.cy / step);
      tierBuf.set([W / 2 + (kx * step - v.cx) * s * dpr, H / 2 + (ky * step - v.cy) * s * dpr, px * dpr, a], 4 * i);
      tierCol.set(c, 3 * i);
    }
    use(P);
    u4f(P, 'uVp', vpX, vpY, W, H);
    u1f(P, 'uDpr', dpr);
    const plane = ov ? null : col3(st.plane, '#FCFDFD');
    u4f(P, 'uBg', plane ? plane[0] : 0, plane ? plane[1] : 0, plane ? plane[2] : 0, plane ? 1 : 0);
    gl.uniform4fv(L_(P, 'uTier'), tierBuf);
    gl.uniform3fv(L_(P, 'uTierCol'), tierCol);
    // axes, pixel-snapped: odd widths centred on a pixel centre, even widths on a pixel edge
    const axisCol = col3(ov ? ov.color : st.axis, '#2E3D47');
    const aw = 1.25 * dpr;
    const snap = (x) => (Math.round(aw) % 2 ? Math.floor(x) + 0.5 : Math.round(x));
    const AX = snap(W / 2 - v.cx * s * dpr), AY = snap(H / 2 - v.cy * s * dpr);
    const axisOn = st.axes !== false;
    u4f(P, 'uAxis', AX, AY, aw, axisOn ? (ov ? (ov.axisAlpha ?? 0.7) : 1) : 0);
    u3(P, 'uAxisCol', axisCol);
    const cas = ov && ov.casing ? col3(ov.casing, [0, 0, 0]) : null;
    u4f(P, 'uCasing', cas ? cas[0] : 0, cas ? cas[1] : 0, cas ? cas[2] : 0, cas ? (ov.casingAlpha ?? 0.4) : 0);
    // ticks at the ruler-labelled steps: >= 72 px apart along x, >= 48 px along y
    const tx = (st.ticks && st.ticks.x) || nice125(72 / s), ty = (st.ticks && st.ticks.y) || nice125(48 / s);
    const kx = Math.round(v.cx / tx), ky = Math.round(v.cy / ty);
    u4f(P, 'uTickX', W / 2 + (kx * tx - v.cx) * s * dpr, tx * s * dpr, 2.5 * dpr, dpr);
    u4f(P, 'uTickY', H / 2 + (ky * ty - v.cy) * s * dpr, ty * s * dpr, 2.5 * dpr, dpr);
    // unit circle: 1 px axis at unitAlpha, dashed 2/3 (a multiple of 4 dashes), 3 px ticks at the axes
    const UX = W / 2 - v.cx * s * dpr, UY = H / 2 - v.cy * s * dpr, UR = s * dpr;
    const near = Math.hypot(Math.max(0, Math.abs(UX - W / 2) - W / 2), Math.max(0, Math.abs(UY - H / 2) - H / 2));
    const visible = st.unit && !ov && UR > 2 && near < UR + 4 && Math.hypot(Math.abs(UX - W / 2) + W / 2, Math.abs(UY - H / 2) + H / 2) > UR - 4;
    u4f(P, 'uUnit', UX, UY, UR, visible ? (st.unitAlpha ?? 0.55) : 0);
    u3(P, 'uUnitCol', axisCol);
    const nDash = Math.max(4, 4 * Math.round(2 * Math.PI * s / 20));
    u2f(P, 'uDash', nDash, s);
    // beyond 2e5 device px the shader uses the circle's local form, computed here in float64
    const cAbs = Math.hypot(v.cx, v.cy), CL = cAbs * s * dpr;
    if (visible && UR > 2e5 && CL > 0) {
      const th0 = Math.atan2(v.cy, v.cx), per = 2 * Math.PI * s / nDash, q = Math.PI / 2;
      u4f(P, 'uUnitL', (cAbs - 1) * s * dpr, v.cx / cAbs, v.cy / cAbs, CL);
      u4f(P, 'uUnitA', (((th0 * s) % per) + per) % per, (th0 - Math.round(th0 / q) * q) * s, 0, 1);
    } else u4f(P, 'uUnitA', 0, 0, 0, 0);
    gl.bindVertexArray(empty());
    // (st.under: under what the frame holds already, as if the frame were drawn over the grid (premultiplied
    // destination-over; the grid is opaque), so a layer composed first and the grid reach the page in one copy)
    if (st.under && !ov) gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    else if (!ov) gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(null);
  }

  // ---------------- regions and lines ----------------
  const PATTERNS = { solid: 0, checker: 1, polar: 2, tiles: 3, grid: 4, polargrid: 5, phase: 6, stretch: 7, sphere: 8, carry: 9 };
  function fadeUniforms(P, f) {
    if (f && f.R != null) {
      u1i(P, 'uFadeMode', 2); u4f(P, 'uFade', f.cx || 0, f.cy || 0, f.R, 0); u1f(P, 'uFadeW', 0.08 * f.R);
    } else if (f && f.x1 != null) {
      u1i(P, 'uFadeMode', 1); u4f(P, 'uFade', f.x0, f.y0, f.x1, f.y1); u1f(P, 'uFadeW', f.w != null ? f.w : 0.04 * Math.max(f.x1 - f.x0, f.y1 - f.y0));
    } else u1i(P, 'uFadeMode', 0);
  }
  function regionUniforms(P, st, org) {
    const c0 = col3(st.color, [0.5, 0.5, 0.5]);
    u3(P, 'uC0', c0);
    u3(P, 'uC1', col3(st.color2, c0));
    u3(P, 'uK', col3(st.edge, col3(st.ink, [0.07, 0.1, 0.13])));
    u1f(P, 'uAlpha', st.alpha ?? 0.85);
    u1i(P, 'uPattern', PATTERNS[st.pattern] ?? 1);
    const cell = st.cell || 1;
    u1f(P, 'uCell', cell);
    u1f(P, 'uLines', st.lines ? 1 : 0);
    u1f(P, 'uDpr', st.dpr || 1);
    // the spherical checker (SPEC 6.3): n longitude sectors, n = clamp(round(16 / pattern scale), 4, 64), even
    u1f(P, 'uSphN', Math.max(4, Math.min(64, 2 * Math.round((st.sphN || 16) / 2))));
    const sx = st.stretch || {};
    u3(P, 'uShrink', col3(sx.shrink, '#2E69B2'));
    u3(P, 'uGrow', col3(sx.grow, '#D79628'));
    u3(P, 'uMid', col3(sx.mid, '#E9F0F2'));
    // pattern coordinates are taken relative to Q, the resource origin snapped to 10 cells (every pattern repeats
    // over 10 cells), so they stay small numbers in float32 wherever the shape is
    const per = 10 * cell, ox = org ? org[0] : 0, oy = org ? org[1] : 0;
    const qx = Number.isFinite(Math.round(ox / per) * per) ? Math.round(ox / per) * per : 0;
    const qy = Number.isFinite(Math.round(oy / per) * per) ? Math.round(oy / per) * per : 0;
    u2f(P, 'uSrcOff', ox - qx, oy - qy);
    u2f(P, 'uQ', qx, qy);
    const o = st.origin || [0, 0];
    u2f(P, 'uOrigin', (o[0] ?? o.re ?? 0) - qx, (o[1] ?? o.im ?? 0) - qy);
    fadeUniforms(P, st.fade);
  }
  // tfEntry's answer while the current chain's transform-feedback program is still compiling (and no earlier one is
  // ready): the draw then uses whichever direct program is already ready, without starting another compile. One of an
  // earlier version (or none) is a stand-in: the frame is pending until the transform-feedback program tf lands.
  const PENDING = {};
  function readyProg(name, map, tf) {
    const P = getProg(name, cur, false, map);
    if (P || sideMode) return P;
    if (tf) { framePending = true; standIn(progId(tf, cur, map)); }
    for (const h of hist) { const Q = getProg(name, h, false, map); if (Q) return Q; }
    return modeOf(map) ? getProg(name, cur, false, startOf(map)) : null;
  }
  // nothing ready for a direct draw while the current chain compiles: an earlier version's cached evaluation of
  // the (translated) map stands in, so the pane keeps showing the previous image instead of going blank (or, for a
  // deformation whose mode compiles, this chain's evaluation of its start); with none, lines whose caller gave the
  // map's CPU twin (cpuOf) are evaluated by it (cpuEntry)
  function stand(res, isMesh, L, map, name, cpuOf) {
    const d = progs.get(progId(name, cur, map));
    if (!d || d.state !== 'pending' || sideMode) return null;   // a failed compile is reported, never covered up
    for (const h of hist) {
      const T = getProg(isMesh ? 'tfRegion' : 'tfLine', h, false, map);
      if (T) return tfEntry(res, isMesh, L, map, 'stand-in', T);
    }
    const T = modeOf(map) ? getProg(isMesh ? 'tfRegion' : 'tfLine', cur, false, startOf(map)) : null;
    if (T) return tfEntry(res, isMesh, L, map, 'stand-in', T);
    return !isMesh && cpuOf ? cpuEntry(res, L, map, cpuOf) : null;
  }
  function freeTmp(e) {
    if (!tmpAll.delete(e)) return;
    cacheBytes -= e.bytes;
    if (gl && e.tex) gl.deleteTexture(e.tex);
    if (e.res.tmp && e.res.tmp.get(e.slot) === e) e.res.tmp.delete(e.slot);
  }
  // over the budget: scratch textures not drawn from for a second go first (a homotopy or thumbnails that ended); the
  // steps view's carried colour's (e.carry) once none of them has been drawn for CARRY_TMP_MS (carryTmpT), since its
  // next glide or scrub, after a rest, draws them again: freed in the rest, the scrub's first frame would allocate them
  // again, and a scrub or glide that lasts longer than the keep time draws each plane's only once, so each entry's own
  // idle time is no measure of the rest. With need more bytes over the budget, each one's own go after a second too
  let CARRY_TMP_MS = 30000, carryTmpT = 0;
  function freeStaleTmp(now, need = 0) {
    const pressed = cacheBytes + need > CACHE_BYTES;
    for (const e of [...tmpAll]) {
      if (e.carry && !pressed ? now - carryTmpT > CARRY_TMP_MS : now - e.t > 1000) freeTmp(e);
    }
  }
  // and once the drawing that used them has been idle that long, whatever the budget: a scratch evaluation is only
  // reused by the next draw of the same map (the next frame of a playing homotopy, a thumbnail drawn again at once),
  // so after the step-card thumbnails or a finished homotopy it held its texture for nothing (U-b gate: the idle app
  // kept the thumbnails' evaluations of every shape). A later draw evaluates into a new one.
  /** @type {any} */
  let tmpSweepT = 0;
  function sweepTmpLater() {
    if (tmpSweepT) return;
    tmpSweepT = setTimeout(() => {
      tmpSweepT = 0;
      freeStaleTmp(performance.now());
      if (tmpAll.size) sweepTmpLater();
    }, 1200);
    if (tmpSweepT && tmpSweepT.unref) tmpSweepT.unref();   // (node tests: never keeps the process alive)
  }
  // cacheKey null: the per-resource scratch texture (tmpEntry), which only the rt path has
  function cached(res, isMesh, L, map, cacheKey) {
    const e = cacheKey ? tfEntry(res, isMesh, L, map, cacheKey) : tmpEntry(res, isMesh, L, map);
    if (e) return e;
    const s = progs.get(progId(isMesh ? 'tfRegion' : 'tfLine', cur, map));
    return s && s.state === 'pending' ? PENDING : null;
  }
  // draw() once inside each of the rects (device px of the pane, bottom-left origin; intersected with a scissor already
  // set, the pane's own), or once with no rects; then the scissor is put back
  function scissored(rects, draw) {
    if (!rects) { draw(); return; }
    const scOn = gl.isEnabled(gl.SCISSOR_TEST), prevSc = scOn ? gl.getParameter(gl.SCISSOR_BOX) : null;
    for (const sc of rects) {
      let x0 = vpX + sc[0], y0 = vpY + sc[1], x1 = x0 + sc[2], y1 = y0 + sc[3];
      if (prevSc) { x0 = Math.max(x0, prevSc[0]); y0 = Math.max(y0, prevSc[1]); x1 = Math.min(x1, prevSc[0] + prevSc[2]); y1 = Math.min(y1, prevSc[1] + prevSc[3]); }
      if (x1 <= x0 || y1 <= y0) continue;
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
      draw();
    }
    if (scOn) gl.scissor(prevSc[0], prevSc[1], prevSc[2], prevSc[3]); else gl.disable(gl.SCISSOR_TEST);
  }
  // the end of draws sharing one depth (drawRegionCarry's st.depth 'first' .. 'last', or one that failed before its last)
  // (a layer of carryLayers keeps its depth: the next layer reads it)
  // (pass 1 of carryResolve keeps its depth too: pass 2 reads it)
  function carryDepthEnd() { if (!ok) return; if (!peelOn && resOn !== 1) gl.clear(gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LESS); gl.disable(gl.DEPTH_TEST); }
  // ---- the carried colour's layers (opacity below 1) ----
  // The carried colour shows the front sheet alone (one depth for all meshes). With opacity a < 1 it shows the layers as the
  // exact pass does: carryLayers calls draw once per layer, front to back, into a target of the canvas's size (the layers
  // share the frame's viewport and scissor); layer j keeps the fragments behind layer j-1's key (PRE_KEY's uPeelOn: the
  // previous layer's depth, two 32-bit float depth textures alternating), and one pass composites them into the frame,
  // each layer at a, the farthest opaque
  // (KPOS_UNIT is also the inverse pass's uHalf, which binds it for its own draws: the resolve binds it again in resBind
  // before each pass 2, and drawAll's draws inside a resolved frame are carried meshes alone)
  const PEEL_MAX = 8, PEEL_UNIT = 7, KMIN_UNIT = 6, KPOS_UNIT = 5;
  let peel = null, peelBad = false;
  // the layers that drew something in the last frame whose occlusion queries have answered (0: none known): the next
  // frame draws one layer more, which shows a layer that has appeared, and no more
  let peelSeen = 0, peelQ = null;
  let peelOn = 0;   // the 1-based layer being drawn, 0 outside carryLayers
  let layerFrames = 0;   // the frames carryLayers composited (the tests read it: carryLayerFrames)
  let resOn = 0, resBand = 0, resOrd = 0;   // carryResolve's pass (1, 2; 0 outside it), its band in units of the key's s, and the rotation's order its last frame tested the orbit of (0: none; the tests read it: carryResolveOrd)
  let kposBad = false;   // the source points' float target cannot be drawn into here: the resolve ties by the band alone
  // EXT_color_buffer_half_float: the source points' target is RG16F where RG32F cannot be drawn into. Asked for there
  // alone, the first time (null: not yet), so a context that draws into RG32F enables no extension for it
  let halfOK = null;
  const halfOn = () => halfOK ?? (halfOK = !!gl.getExtension('EXT_color_buffer_half_float'));
  let resFrames = 0;   // the frames carryResolve drew (the tests read it: carryResolveFrames)
  function peelFree() {
    if (!peel) return;
    gl.deleteFramebuffer(peel.fbo); gl.deleteTexture(peel.col); peel.dep.forEach((t) => gl.deleteTexture(t));
    if (peel.kmin) gl.deleteTexture(peel.kmin);
    if (peel.kpos) gl.deleteTexture(peel.kpos);
    peel = null;
  }
  // -> {W, H, n, fbo, col (RGBA8 array of n layers), dep, kmin and kpos (resMin's, made on their first use)}, or null when the
  // target is not complete
  function peelTarget(n) {
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
    if (peel && peel.W === W && peel.H === H && peel.n >= n) return peel;
    peelFree();
    const set = (target) => {
      gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    gl.activeTexture(gl.TEXTURE0 + PEEL_UNIT);
    const col = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, col); gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, W, H, n); set(gl.TEXTURE_2D_ARRAY);
    const dep = [0, 1].map(() => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, W, H); set(gl.TEXTURE_2D);
      return t;
    });
    const fbo = gl.createFramebuffer();
    peel = { W, H, n, fbo, col, dep };
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, col, 0, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dep[0], 0);
    const good = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (good) return peel;
    peelBad = true; peelFree();
    return null;
  }
  // ---- the carried colour's ties ----
  // Where two sheets' keys are equal (a map symmetric about the key's centre: z³'s three sheets over every w), the key a
  // mesh draws differs between them by the mesh's own error (the source point interpolated across a triangle, far more
  // than a step of the key), so a single depth puts the sheet in front that the error favours, a triangle at a time.
  // carryResolve draws the frame's carried draws twice, with the variants that write the key per fragment (st.peel), as
  // the inverse pass orders keys: pass 1 into a 32-bit float depth target of the canvas's size, its colour masked, each
  // pixel left with its smallest key; pass 2 into the frame, the fragments within the band of that key in front by their
  // tie order alone (PRE_KEY_RES: KEY_ERR_K times the key's error across the fragment's triangle, at least band, in units
  // of s). Below full opacity carryLayers does pass 1 the same way and peels its layers in that order. -> null: no target
  // (nothing was drawn, the caller draws as without it); else draw()'s last result (false: a pass failed, nothing reached
  // the frame)
  function carryResolve(band, draw, ord = 0) {
    if (!ok || peelBad || peelOn || resOn) return null;
    const T = peelTarget(1);
    if (!T) return null;
    let done = resMin(T, band, draw, ord);
    if (!done) return false;
    try {
      resBind(T);
      resOn = 2;
      done = draw();
    } finally { resOn = 0; }
    if (done) resFrames++;
    return done;
  }
  // pass 2's textures: each pixel's smallest key and, with a rotation's order, the front fragment's source point
  function resBind(T) {
    gl.activeTexture(gl.TEXTURE0 + KMIN_UNIT); gl.bindTexture(gl.TEXTURE_2D, T.kmin);
    gl.activeTexture(gl.TEXTURE0 + KPOS_UNIT); gl.bindTexture(gl.TEXTURE_2D, resOrd ? T.kpos : null);
  }
  // pass 1 of the resolve into target T: draw() with the key alone into T.kmin (made here, a 32-bit float depth of T's size),
  // which each pixel's smallest key is left in, and with a rotation's order ord > 1 each fragment's source point, less the
  // key window's centre, into T.kpos (made here: RG32F, or RG16F with half floats alone, whose 11 bits are then relative
  // to the window wherever the centre is; carryProbe.kpos 'half' or 'none' takes the lesser path), which keeps the front
  // one's; with no float target
  // there (kposBad), ord is dropped and the band alone ties; -> draw()'s result
  function resMin(T, band, draw, ord = 0) {
    if (!T.kmin) {
      T.kmin = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + KMIN_UNIT); gl.bindTexture(gl.TEXTURE_2D, T.kmin);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, T.W, T.H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    resBand = band;
    const fmt = carryProbe.kpos === 'none' || kposBad ? 0 : rtOK && carryProbe.kpos !== 'half' ? gl.RG32F : halfOn() ? gl.RG16F : 0;
    resOrd = ord > 1 && fmt ? ord : 0;
    if (resOrd && T.kpos && T.kposFmt !== fmt) { gl.deleteTexture(T.kpos); T.kpos = null; }
    if (resOrd && !T.kpos) {
      T.kpos = gl.createTexture(); T.kposFmt = fmt;
      gl.activeTexture(gl.TEXTURE0 + KPOS_UNIT); gl.bindTexture(gl.TEXTURE_2D, T.kpos);
      gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, T.W, T.H);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
      if (resOrd) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.kpos, 0);
      else gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, T.col, 0, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, T.kmin, 0);
      if (resOrd && gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        kposBad = true; resOrd = 0;
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, T.col, 0, 0);
      }
      // (the units the programs sample hold other textures than the ones they draw into)
      gl.activeTexture(gl.TEXTURE0 + KMIN_UNIT); gl.bindTexture(gl.TEXTURE_2D, T.dep[0]);
      gl.activeTexture(gl.TEXTURE0 + PEEL_UNIT); gl.bindTexture(gl.TEXTURE_2D, T.dep[1]);
      gl.activeTexture(gl.TEXTURE0 + KPOS_UNIT); gl.bindTexture(gl.TEXTURE_2D, null);
      gl.colorMask(!!resOrd, !!resOrd, false, false);
      if (resOrd) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); }
      resOn = 1;
      return draw();
    } finally { resOn = 0; gl.colorMask(maskRGB, maskRGB, maskRGB, maskA); gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
  }
  // the program and targets of carryLayers at opacity alpha made ahead (the idle job), so the first layered frame of a glide
  // creates nothing
  function carryLayersReserve(alpha) {
    if (!ok || peelBad) return;
    const n = Math.min(PEEL_MAX, invK(alpha));
    if (n >= 2 && program('carryLayers')) { peelTarget(n); prestartCarry(true); }
  }
  // draw() issues the frame's carried draws (every mesh, in one shared depth) and returns whether they all drew.
  // -> null: layers cannot be drawn here (opacity >= 1, one layer, no target or program yet): nothing was drawn, the
  // caller draws the front layer as it does at opacity 1; else draw()'s last result (false: a layer's draw failed, nothing
  // reached the frame)
  // (band: the frame's sheets can tie, carryResolve's band: each pixel's smallest key is drawn first, and the layers peel in
  // the order it resolves, the tied sheets by their tie order, so each layer is one sheet where they tie too. The band is
  // about the front group's key alone: a second group of tied sheets behind it (z³ + z⁶'s outer ring of three) peels by
  // the key's own order)
  function carryLayers(alpha, draw, band = null, ord = 0) {
    if (!ok || peelBad || peelOn || resOn) return null;
    let n = Math.min(PEEL_MAX, invK(alpha));
    if (n < 2) return null;
    if (peelQ && peelQ.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) {
      peelSeen = peelQ.reduce((m, q, j) => (gl.getQueryParameter(q, gl.QUERY_RESULT) ? j + 1 : m), 0);
      peelQ.forEach((q) => gl.deleteQuery(q)); peelQ = null;
    }
    if (peelSeen) n = Math.max(2, Math.min(n, peelSeen + 1));
    const Q = program('carryLayers'), T = Q ? peelTarget(n) : null;
    if (!T) return null;
    let done = true, nq = null;
    if (band != null) {
      done = resMin(T, band, draw, ord);
      if (done) { resOn = 2; resBind(T); }
    }
    // (the layers hold alpha: the frame's write mask does not apply to them)
    gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
    try {
      for (let j = 0; j < n && done; j++) {
        gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, T.col, 0, j);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, T.dep[j & 1], 0);
        gl.activeTexture(gl.TEXTURE0 + PEEL_UNIT); gl.bindTexture(gl.TEXTURE_2D, T.dep[(j + 1) & 1]);
        gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.depthMask(true); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        peelOn = j + 1;
        const q = !peelQ || peelQ.length <= j ? gl.createQuery() : null;
        if (q) gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, q);
        done = draw();
        if (q) { gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE); (nq || (nq = [])).push(q); }
      }
    } finally { peelOn = 0; resOn = 0; gl.colorMask(maskRGB, maskRGB, maskRGB, maskA); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (nq && !peelQ) peelQ = nq; else if (nq) nq.forEach((q) => gl.deleteQuery(q));
    if (!done) return false;
    layerFrames++;
    use(Q);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0 + PEEL_UNIT); gl.bindTexture(gl.TEXTURE_2D_ARRAY, T.col);
    u1i(Q, 'uL', PEEL_UNIT); u1i(Q, 'uN', n); u1f(Q, 'uA', alpha);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    return true;
  }
  // the chain's cut kinds (a deformation map's carried colour draws a fill for a path cut the sheets continue, clipped
  // at a cut marked clip)
  const carryKinds = () => (cur.info && Array.isArray(cur.info.cutKinds) ? cur.info.cutKinds : []);
  // (the carried colour's regionK and regionKC for a chain with no cut are regionKN and regionKCN: the pixel-centre read)
  const noCutProg = (name, cuts) => (cuts ? name : name + 'N');
  // the programs a glide's carried colour draws with (drawRegionCarry, map mode 1), started without waiting: a renderer
  // without parallel compiles links each in an idle moment before the first glide, not in its first frame
  // (peel: the variants of carryLayers, which write the sheet key per fragment; cz: the Cauchy style's, CARRY_CAUCHY, whose
  // masks are the others')
  function carryNames(peel, cz) {
    const k = carryKinds(), clip = k.some((c) => c && c.clip), cuts = clip || k.some((c) => c && c.h === 'sheet');
    // (a sheet cut not clipped: the fill's mask too, which the first frame's fill draws through)
    const names = clip ? ['regionKC', 'regionKSCclippt', 'fillPts'] : cuts ? ['regionKC', 'regionKSCpt', 'fillPts', rtOK ? 'regionKSCptm' : 'regionKSm'] : [noCutProg('regionKC', false)];
    const named = peel ? names.map((n) => (n === 'fillPts' ? n : /m$/.test(n) ? n.slice(0, -1) + 'Pm' : n + 'P')) : names;
    return cz ? named.map((n) => (n === 'fillPts' || /m$/.test(n) ? n : n + 'Z')) : named;
  }
  function prestartCarry(peel) { return prestartNames(carryNames(peel), [1]); }
  // the programs a frame of map draws its carried colour with at full quality (carryPrep's for a glide's meshes, under
  // the sheet key): with the map cache (rtOK), its places' program (tfRegion), the cached program and, for a chain with
  // a cut, the fill's (carryNames); without it, the plain program or, with a cut, the sheet program and its mask. On the
  // globe (globe: {id}, plane s the colour plane), drawCarriedGlobe's
  function carryProgs(map, globe) {
    if (globe) return [globe.id ? 'carryGId' : 'carryG'];
    const m = map || {}, kinds = m.mode === 1 || m.mode === 3 ? carryKinds() : [];
    const clip = kinds.some((c) => c && c.clip), cuts = clip || kinds.some((c) => c && c.h === 'sheet');
    if (rtOK && !isIdent(m)) return carryNames(false).concat(['tfRegion']);
    return !cuts ? [noCutProg('regionK', false)] : clip ? ['regionKSclip'] : ['regionKS', 'regionKSm'];
  }
  // the state of the carried colour a frame of map would draw, nothing drawn: 'ready' when every program it draws with
  // (carryProgs) is linked for this chain and map mode, not an earlier version's or the start's that program() stands
  // in with; 'error' when one cannot link; else 'pending'. Asking starts the programs not yet started, as a draw does,
  // and a frame that waits on them is drawn again when they land (as program() has it); a renderer that links at once
  // has them linked here
  function carryState(map, globe) {
    if (!ok || lost || !cur.info) return 'error';
    let state = 'ready';
    for (const name of carryProgs(map, globe)) {
      if (!DEFS[name] || getProg(name, cur, true, map)) continue;
      const e = progs.get(progId(name, cur, map));
      if (e && e.state === 'error') return 'error';
      framePending = true;
      standIn(e && e.id);
      state = 'pending';
    }
    return state;
  }
  // whether a carried program of the Cauchy style (CARRY_CAUCHY: the meshes' and the pre-mapped mesh's, both map modes, started
  // as the style is chosen) is still linking for the current chain: a glide waits on its first plane for them (svLinkHold),
  // as for its inverse program, since no other program draws the Cauchy integral past z
  function carryCauchyLinking() {
    if (!ok || lost || sideMode || !cur.info) return false;
    for (const n of carryNames(false, true).concat(['regionPKZ'])) {
      for (const m of [0, 1]) {
        const e = DEFS[n] && progs.get(progId(n, cur, { mode: m }));
        if (e && e.state === 'pending') return true;
      }
    }
    return false;
  }
  // drawRegion with st.carry {s, T, style, sectors, grid, plane, ink, dark}: the region's points in the colour plane's
  // colour (regionK; regionKC with the places from the map cache, as drawRegion's regionC: the map once per lattice
  // point, not four times per vertex, which would be most of a glide frame); -> true when drawn, false while its
  // program compiles
  // The carried colour of mesh res in two steps: carryPrep runs its off-screen passes (its map cache's, its fill's point
  // pass) and picks its programs; drawRegionCarry draws it on the frame's framebuffer. A frame of several meshes
  // (svCarryRegions) prepares them all before it draws any, so its framebuffer is left once, not once a mesh.
  // -> {L, e, P, fill, fp, full, clip, mask}; true: nothing to draw (the probes' noCarry); false: nothing can draw
  function carryPrep(res, st) {
    if (!ok || !res || !res.n) return false;
    const L = st.L || 4;
    // (st.peel: the variants that write the sheet key per fragment, for the layers of carryLayers; the Cauchy style's, CARRY_CAUCHY)
    const cz = carryCauchyOn(st.carry);
    const N = (n) => (st.peel ? n + 'P' : n) + (cz ? 'Z' : '');
    // (a deformation whose path has a cut the sheets continue: the places from the map cache (regionKC), then the
    // triangles they tear across a cut on their centre's sheet (regionKSCpt, its places from its point pass); without
    // the cache, every triangle
    // on its centre's sheet (regionKS, the chain at every vertex). A cut clipped (cutKinds' clip): the sheet program's
    // triangles cut at it, and its pass again (uKPass 1) for the triangles across it, on the branch past it)
    const m = st.map || {}, kinds = m.mode === 1 || m.mode === 3 ? carryKinds() : [];
    const clip = kinds.some((c) => c && c.clip), cuts = clip || kinds.some((c) => c && c.h === 'sheet');
    // (the programs of the way it draws are started when they are not ready (program); one that only stands in while
    // they link is used when it, or an earlier chain version's, is linked, and not started (programLinked): a frame
    // after an edit would otherwise start every stand-in of a heavy chain at once, each a compile the GPU process makes
    // the frames wait behind)
    if (carryProbe.noCarry) return true;
    const cache = rtOK && !isIdent(st.map), linked = programLinked;
    let e = cache ? cached(res, true, L, st.map, null) : null;
    if (e === PENDING) e = null;
    if (e) { e.carry = true; carryTmpT = performance.now(); }
    let P = e ? program(N(noCutProg('regionKC', cuts)), st.map) : null;
    // (the fill's places from its point pass, fillPoints: the chain once per point of a torn sub-triangle. The fill never
    // evaluates them itself, so its frames are the point pass's whatever the compiler does with either program; while
    // the pass cannot run (fillPts or the fill still linking) the sheet program stands in, below)
    // (a sheet program without a clipped cut, under the key: drawn only with its mask (regionKS*m) of the same chain
    // version and map mode, so no frame shows a torn triangle whole; until the mask has linked, the frame draws as
    // while the sheet program itself links. Without the key (no depth to draw the mask into), the sheet program alone)
    const masked = !!(st.key && st.key.win) && !clip;
    const maskOf = (name, R, get) => {
      const M = get(name.replace(/Z$/, '') + 'm', st.map);
      return M && M.ch === R.ch && M.mode === R.mode ? M : null;
    };
    let fill = null, fp = null, mask = null;
    if (cuts && P && !carryProbe.noFill) {
      const Q = program(N(clip ? 'regionKSCclippt' : 'regionKSCpt'), st.map);
      const QM = Q && masked ? maskOf(N('regionKSCpt'), Q, program) : null;
      // (with the mask, the point pass's second run too: the places of the fill's pass 1)
      fp = Q && (!masked || QM) ? fillPoints(res, L, st.map, { e, skip: st.skip || null, kpx: 4 / ((st.view.s || 1) * (st.dpr || 1)), lim: st.lim || 1e30, two: !!QM }) : null;
      if (fp) { fill = Q; mask = QM; }
      noteFill(Q, !!fp);
    }
    let full = null;
    if (cuts && !fill && !carryProbe.noFill) {
      P = full = (cache ? linked : program)(N(clip ? 'regionKSclip' : 'regionKS'), st.map);
      if (P && masked && !(mask = maskOf(N('regionKS'), full, cache ? linked : program))) P = full = null;
      if (P) e = null;
    }
    if (!P) { e = null; P = (cache || cuts ? linked : program)(N(noCutProg('regionK', cuts)), st.map); }
    return P ? { L, e, P, fill, fp, full, clip, mask } : false;
  }
  // (prep: carryPrep's for res and st, made here when not given)
  function drawRegionCarry(res, st, prep) {
    if (prep == null) prep = carryPrep(res, st);
    if (typeof prep === 'boolean') return prep;
    const { L, e, P, fill, fp, full, clip, mask } = prep;
    // (the sheet key, st.key {win, R, rs, sing}: the default framebuffer has a depth buffer)
    const k = st.key && st.key.win && (peelOn || resOn || gl.getParameter(gl.FRAMEBUFFER_BINDING) === null) ? st.key : null;
    const sheet = fill || full;
    const set = (Q) => {
      use(Q, st.map);
      if (e) bindCache(Q, e);
      view2D(Q, st.view, st.dpr || 1, res.org);
      regionUniforms(Q, st, res.org);
      u1f(Q, 'uKPx', 4 / ((st.view.s || 1) * (st.dpr || 1)));   // (4 device px, in plane units)
      u1f(Q, 'uKLim', st.lim || 1e30);
      keyUniforms(Q, k);
      u1i(Q, 'uGs', st.carry.s); u1i(Q, 'uGt', st.carry.T); dcUniforms(Q, st.carry, st.dpr || 1);
      if (Q !== mask) carryCauchy(Q, st.carry);
      if (Q === sheet || Q === mask) u1i(Q, 'uKPass', 0);
      if (fp && Q !== P) { gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, fp.tex); u1i(Q, 'uFTW', fp.W); u1i(Q, 'uFTP', fp.P); }
    };
    // (pass p of the sheet program Q: its uKPass, and with the point pass, the run that holds that pass's places)
    const passOf = (Q, p) => {
      set(Q); u1i(Q, 'uKPass', p);
      if (fp && p === 1 && !clip) { gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, fp.tex1); }
    };
    gl.bindVertexArray(meshVAO(res, L, st.skip));
    const n = regionTemplate(L).count;
    set(P);
    // (st.scissors: only inside these rects, as drawRegion's; the depth's clears stay whole)
    const drawAll = () => gl.drawArraysInstanced(gl.TRIANGLES, 0, n, res.n);
    // (the sheet program's passes: 0, every triangle on its centre's sheet; 1, a triangle again on the branch of its
    // first vertex past the cut, for its part there. A clipped cut's program cuts each pass at the cut itself. Another
    // cut's, under the key, draws each pass twice: its mask into the depth alone, the fragments of a torn triangle
    // the map sends there; then its colour with the depth test EQUAL, so each pixel takes the one fragment the mask
    // kept in front, and the colour's chain runs once a pixel)
    const sheetPass = (pass) => {
      if (!clip && !(mask && k && !carryProbe.noMask)) { if (pass === 0) { set(sheet); scissored(st.scissors, drawAll); } return; }
      if (clip) { passOf(sheet, pass); scissored(st.scissors, drawAll); return; }
      passOf(mask, pass);
      gl.colorMask(false, false, false, false);
      scissored(st.scissors, drawAll);
      gl.colorMask(maskRGB, maskRGB, maskRGB, maskA);
      passOf(sheet, pass);
      gl.depthFunc(gl.EQUAL);
      scissored(st.scissors, drawAll);
      gl.depthFunc(gl.LEQUAL);
    };
    // (st.behind: its depth pushed back that many units (polygonOffset), so where another mesh in the same depth draws
    // the same points, that mesh's are in front, not whichever placement lands a hair nearer)
    carryDraw(k, st.depth, () => {
      if (st.behind) { gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(0, st.behind); }
      // (the map cache's pass; without the cache, P is the sheet program itself, drawn by its passes)
      if (!carryProbe.noKCDraw && P !== full) scissored(st.scissors, drawAll);
      if (sheet) { sheetPass(0); sheetPass(1); }
      if (st.behind) gl.disable(gl.POLYGON_OFFSET_FILL);
    });
    gl.bindVertexArray(null);
    return true;
  }
  // the sheet key's uniforms (PRE_KEY_DECL) of program Q: k {win, R, rs, sing, per}, or null (uKeyOn 0)
  function keyUniforms(Q, k) {
    u1i(Q, 'uKeyOn', k ? 1 : 0);
    u1i(Q, 'uPeelOn', k && peelOn > 1 ? 1 : 0); u1i(Q, 'uPeelD', PEEL_UNIT);
    // (uKRes: the pass, and the frame's rotation's order in pass 2; one vector, as the chain's uniform slots are counted)
    u2i(Q, 'uKRes', k ? resOn : 0, k && resOn === 2 ? resOrd : 0); u1f(Q, 'uKBand', resBand); u1i(Q, 'uKMin', KMIN_UNIT);
    u1i(Q, 'uKPos', KPOS_UNIT);
    if (!k) return;
    const w = k.win, sing = (k.sing || []).slice(0, 4), sv = new Float32Array(8);
    sing.forEach((p, i) => { sv[2 * i] = p.re; sv[2 * i + 1] = p.im; });
    u4f(Q, 'uKWin', w.x0, w.y0, w.x1, w.y1); u1f(Q, 'uKR', k.R); u1f(Q, 'uKRs', k.rs);
    if (Q.loc.uKSing) gl.uniform2fv(Q.loc.uKSing, sv);
    u1i(Q, 'uKSingN', sing.length);
    u2f(Q, 'uKSingT', k.per ? k.per.re : 0, k.per ? k.per.im : 0);
  }
  // a carried-colour draw under the sheet key k (none: the draw order). depth: 'only' (default) a depth of its own;
  // 'first', 'mid', 'last' draws sharing one depth, so the key orders the points of all of them: the first clears it,
  // the last clears it after. Unblended: the carried colour is opaque (alpha 1, which the premultiplied blend only
  // copies), and an opaque draw lets a tiling GPU shade only the front sheet's fragments, where a blended one shades
  // every sheet's, each the colour's whole chain
  function carryDraw(k, depth, draw) {
    gl.disable(gl.BLEND);
    try {
      if (!k) { draw(); return; }
      const depthMode = depth || 'only', first = depthMode === 'only' || depthMode === 'first', last = depthMode === 'only' || depthMode === 'last';
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LEQUAL);
      if (first) { gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); }
      draw();
      if (last) carryDepthEnd();
    } finally { gl.enable(gl.BLEND); }
  }
  // Draw a region mesh. st: {map, view, dpr, L, color (c0), color2 (c1), edge (k), ink, alpha, pattern, cell, lines,
  //   skip, stretch:{shrink,grow,mid}, fade, origin, cacheKey, sphere:{MVP, eye}, sync (wait for compiles)}
  // Identity maps draw without the chain, in coordinates relative to the mesh origin.
  // (st.carry: drawRegionCarry, with st.prep from GLR.carryPrep when the caller made it)
  function drawRegion(res, st) {
    if (!ok || !res || !res.n) return;
    if (st.carry) return drawRegionCarry(res, st, st.prep);
    const L = st.L || 4, sph = !!st.sphere;
    if (st.sync) syncDepth++;
    try {
      const ident = !sph && isIdent(st.map);
      let e = (st.cacheKey || rtOK) && !ident ? cached(res, true, L, st.map, st.cacheKey || null) : null;
      const pend = e === PENDING;
      if (pend) e = null;
      const name = ident ? 'region0' : (sph ? 'regionS' : 'region') + (e ? 'C' : '');
      let P = pend ? readyProg(name, st.map, 'tfRegion') : program(name, st.map);
      if (!P && !ident && !e && (e = stand(res, true, L, st.map, pend ? 'tfRegion' : name))) P = program(sph ? 'regionSC' : 'regionC');
      if (!P) return;
      use(P, st.map);
      if (e) bindCache(P, e);
      if (sph) {
        uM4(P, 'uMVP', st.sphere.MVP);
        u3(P, 'uEye', st.sphere.eye);
        globeLight(P, st.sphere);
        originUniforms(P, res.org);
      } else view2D(P, st.view, st.dpr || 1, res.org);
      regionUniforms(P, st, res.org);
      gl.bindVertexArray(meshVAO(res, L, st.skip));
      // st.scissors: draw only inside these rects (SPEC 8.8: the GPU image around a SphereMesh's guard box while its
      // rebuild runs)
      scissored(st.scissors, () => gl.drawArraysInstanced(gl.TRIANGLES, 0, regionTemplate(L).count, res.n));
      gl.bindVertexArray(null);
    } finally { if (st.sync) syncDepth--; }
  }
  // st: {map, view, dpr, M, width (device px), color, alpha, casing:{color, alpha, width}, fade, cacheKey, sphere,
  //      floor, sync, dash:[on, off] (CSS px, 2D only; the casing stays solid), arc:{key, data}, cpu}
  // cpu (2D only): () => the map's CPU twin, which evaluates the stand-in while the chain's first version links (stand)
  // arc.data: per segment (in createLines order) the arc length of the mapped curve at the segment start and the
  // segment's length, in plane units (the dash phase follows the curve across pieces and segments).
  function drawLines(res, st) {
    if (!ok || !res || !res.n) return;
    const M = st.M || 8, sph = !!st.sphere, flo = !!st.floor, dpr = st.dpr || 1;
    if (st.sync) syncDepth++;
    try {
      const ident = !sph && isIdent(st.map);
      let e = (st.cacheKey || rtOK) && !ident ? cached(res, false, M, st.map, st.cacheKey || null) : null;
      const pend = e === PENDING;
      if (pend) e = null;
      const nameOf = () => (flo ? (ident ? 'lineF' : e ? 'lineFC' : 'lineFM') : sph ? (e ? 'lineSC' : 'lineS') : (ident ? 'line0' : e ? 'lineC' : 'line'));
      let P = pend ? readyProg(nameOf(), st.map, 'tfLine') : program(nameOf(), st.map);
      if (!P && !ident && !e && (e = stand(res, false, M, st.map, pend ? 'tfLine' : nameOf(), sph || flo ? null : st.cpu))) P = program(nameOf(), st.map);
      if (!P) return;
      use(P, st.map);
      if (e) bindCache(P, e);
      if (sph || flo) {
        const m = sph ? st.sphere : st.floor;
        uM4(P, 'uMVP', m.MVP);
        u2f(P, 'uPx', fw, fh);
        u1f(P, 'uDpr', dpr);
        originUniforms(P, res.org);
        if (flo) {
          u4f(P, 'uBox', m.box.x0, m.box.y0, m.box.x1 - m.box.x0, m.box.y1 - m.box.y0); u2f(P, 'uAspect', m.aspect[0], m.aspect[1]); u1f(P, 'uFloorZ', m.floorZ);
          const cl = m.clip || m.box;
          u4f(P, 'uClip', cl.x0, cl.y0, cl.x1, cl.y1);
        }
      } else view2D(P, st.view, dpr, res.org);
      fadeUniforms(P, st.fade);
      // (a CPU stand-in's own template size, which may be coarser than M)
      const Me = e && e.cpu ? e.L : M;
      gl.bindVertexArray(lineVAO(res, Me));
      const dash = !sph && !flo && st.dash && st.arc && st.arc.data && res.arcs && st.arc.data.length >= 2 * res.n ? st.dash : null;
      if (dash) {
        let b = res.arcs.get(st.arc.key);
        if (b) res.arcs.delete(st.arc.key);
        else {
          b = makeBuf(st.arc.data);
          if (res.arcs.size >= 3) { const [k0, b0] = res.arcs.entries().next().value; res.arcs.delete(k0); gl.deleteBuffer(b0); }
        }
        res.arcs.set(st.arc.key, b);
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        attrib(12, 2, 8, 0, 1);
        u1f(P, 'uArcPx', st.view.s * dpr);
      } else { gl.disableVertexAttribArray(12); gl.vertexAttrib2f(12, 0, 0); }
      const count = lineTemplate(Me).count;
      const pass = (width, color, alpha, d) => {
        u1f(P, 'uWidth', width);
        u3(P, 'uColor', col3(color, [0, 0, 0]));
        u1f(P, 'uAlpha', alpha ?? 1);
        u2f(P, 'uDash', d ? d[0] * dpr : 0, d ? d[1] * dpr : 0);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, count, res.n);
      };
      const cs = st.casing;
      if (cs && cs.width > 0 && (cs.alpha ?? 1) > 0) pass(cs.width, cs.color || [1, 1, 1], cs.alpha ?? 1, null);
      pass(st.width, st.color, st.alpha, dash);
      gl.bindVertexArray(null);
    } finally { if (st.sync) syncDepth--; }
  }

  // ---------------- phase portrait (spec 6.8) ----------------
  const STYLES = { enhanced: 0, classic: 1, phase: 2, grid: 3, modulus: 4 };
  function dcUniforms(P, st, dpr) {
    u1i(P, 'uStyle', STYLES[st.style] ?? 0);
    u1f(P, 'uSectors', st.sectors || 12);
    u1f(P, 'uGrid', st.grid || 0.5);
    u3(P, 'uPlane', col3(st.plane, st.dark ? '#0D1317' : '#FCFDFD'));
    u3(P, 'uInk', col3(st.ink, st.dark ? '#E3EAEE' : '#121A20'));
    u1f(P, 'uDark', st.dark ? 1 : 0);
    u1f(P, 'uDpr', dpr || 1);
    u1f(P, 'uPhaseLines', st.phaseLines ? 1 : 0);
  }
  // st: {map, view, dpr, style, sectors, grid, plane, ink, dark, phaseLines,
  //      cauchy: {nodes: Float32Array [x, y, wre, wim] * n (Calc.cauchyNodes), n} (the Cauchy integral of the nodes
  //      instead of F; the map is not used, style 'cauchy' colours like 'enhanced')}
  let nodeTex = null, nodeKey = null, nodeO = [0, 0], nodeW = 1;
  function cauchyNodes(c) {
    const n = Math.max(0, Math.min(c.n | 0, Math.floor(c.nodes.length / 4), maxTex));
    gl.activeTexture(gl.TEXTURE4);
    if (nodeTex && nodeKey === c.nodes && nodeKey.length === c.nodes.length) return n;
    // nodes relative to their centroid (float64 here), so zeta_j - z keeps its precision in float32
    let ox = 0, oy = 0;
    for (let j = 0; j < n; j++) { ox += c.nodes[4 * j]; oy += c.nodes[4 * j + 1]; }
    ox = n ? ox / n : 0; oy = n ? oy / n : 0;
    if (!Number.isFinite(ox + oy)) ox = oy = 0;
    nodeW = Math.max(1, n);
    const d = new Float32Array(nodeW * 4);
    for (let j = 0; j < n; j++) {
      d[4 * j] = c.nodes[4 * j] - ox; d[4 * j + 1] = c.nodes[4 * j + 1] - oy;
      d[4 * j + 2] = c.nodes[4 * j + 2]; d[4 * j + 3] = c.nodes[4 * j + 3];
    }
    if (!nodeTex) nodeTex = floatTex();
    gl.bindTexture(gl.TEXTURE_2D, nodeTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, nodeW, 1, 0, gl.RGBA, gl.FLOAT, d);
    nodeKey = c.nodes; nodeO = [ox, oy];
    return n;
  }
  // the residue theorem's data (st.cauchy.plan = {poles: [{z, order <= 4, n, a: [{re, im}]}]}, st.cauchy.edges =
  // Float64Array [ax, ay, bx, by] * m: the polygon's edges, simplified to a fraction of a pixel): the edges as a texture
  // row relative to their centre, the poles and their principal parts as uniforms. -> {n edges, origin}
  let edgeTex = null, edgeKey = null, edgeO = [0, 0], edgeN = 0;
  function cauchyEdges(c, unit = 4) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    if (edgeTex && edgeKey === c.edges) { gl.bindTexture(gl.TEXTURE_2D, edgeTex); return; }
    const E = c.edges, m = Math.min(Math.floor(E.length / 4), maxTex);
    let ox = 0, oy = 0;
    for (let j = 0; j < m; j++) { ox += E[4 * j]; oy += E[4 * j + 1]; }
    ox = m ? ox / m : 0; oy = m ? oy / m : 0;
    if (!Number.isFinite(ox + oy)) ox = oy = 0;
    edgeN = m;
    const d = new Float32Array(Math.max(1, m) * 4);
    for (let j = 0; j < m; j++) { d[4 * j] = E[4 * j] - ox; d[4 * j + 1] = E[4 * j + 1] - oy; d[4 * j + 2] = E[4 * j + 2] - ox; d[4 * j + 3] = E[4 * j + 3] - oy; }
    if (!edgeTex) edgeTex = floatTex();
    gl.bindTexture(gl.TEXTURE_2D, edgeTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, Math.max(1, m), 1, 0, gl.RGBA, gl.FLOAT, d);
    edgeKey = c.edges; edgeO = [ox, oy];
  }
  // the plan's uniforms of the Cauchy shader (CAUCHY_CORE): the edge row on sampler `unit` (4 for the plot, CARRY_EDGE_UNIT for the carried colour), the poles and their principal parts relative to edgeO, the part shown
  function cauchyPlan(P, cp, unit) {
    cauchyEdges(cp, unit);
    u1i(P, 'uEdgeN', edgeN);
    const poles = cp.plan.poles.slice(0, 16), pd = new Float32Array(64), cd = new Float32Array(128);
    poles.forEach((q, k) => {
      pd[4 * k] = q.z.re - edgeO[0]; pd[4 * k + 1] = q.z.im - edgeO[1]; pd[4 * k + 2] = Math.min(4, q.order); pd[4 * k + 3] = q.n;
      for (let j = 0; j < 4 && j < q.a.length; j++) { cd[4 * k + 2 * j] = q.a[j].re; cd[4 * k + 2 * j + 1] = q.a[j].im; }
    });
    u1i(P, 'uPoleN', poles.length);
    if (P.loc.uPole) gl.uniform4fv(P.loc.uPole, pd);
    if (P.loc.uCoef) gl.uniform4fv(P.loc.uCoef, cd);
    u2f(P, 'uShow', cp.show || 0, cp.sign || -1);
  }
  // the carried colour's Cauchy mode (CARRY_FS): c.cauchy = {plan, edges, show, sign, T} (T: the chain's length) draws the carried points in the
  // Cauchy integral's colour, anything else leaves the stages' colour
  // whether the residue theorem's data (a plan and its polygon's edges) are there to draw
  const cauchyUsable = (c) => !!(c && c.plan && c.edges && c.edges.length >= 4);
  // whether carried colour c draws the Cauchy integral: its programs are then the CARRY_CAUCHY variants
  const carryCauchyOn = (c) => !!(c && cauchyUsable(c.cauchy));
  const CARRY_EDGE_UNIT = SAMPLER_UNITS.uCEdges;
  function carryCauchy(P, c) {
    const cp = carryCauchyOn(c) ? c.cauchy : null;
    u1i(P, 'uCT', cp ? cp.T : -1);
    if (!cp) return;
    cauchyPlan(P, cp, CARRY_EDGE_UNIT);
    u2f(P, 'uEdgeO', edgeO[0], edgeO[1]);
  }
  // the stand-ins' node texture (unit 4: the colour plot's and the phase globe's) and the w array last uploaded into it
  let standInTex = null, standInKey = null;
  // binds the stand-in grid g ({nx, ny, w}: w = F(z) at the nx x ny nodes, node (i, j) at w[2 (j nx + i)], re and im; a
  // Float32Array) to unit 4, uploading it when it is not the one there
  function standInTexture(g) {
    gl.activeTexture(gl.TEXTURE4);
    if (!standInTex) standInTex = floatTex(); else gl.bindTexture(gl.TEXTURE_2D, standInTex);
    if (standInKey !== g.w) {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, g.nx, g.ny, 0, gl.RG, gl.FLOAT, g.w);
      standInKey = g.w;
    }
  }
  const standInRelease = () => { if (standInTex) { gl.deleteTexture(standInTex); standInTex = standInKey = null; } };
  function standInUniforms(P, st, dpr) {
    const g = st.standIn, k = st.view.s * dpr;
    standInTexture(g);
    u2f(P, 'uGO', (g.x0 - st.view.cx) * k + fw / 2, (g.y0 - st.view.cy) * k + fh / 2);
    u1f(P, 'uGC', g.h * k);
  }
  // the colour plot of st and the program that draws it: the Cauchy style's residue plot (cp: st.cauchy with its plan and
  // edges, cauchyF), its node sum (cz: st.cauchy with nodes, cauchy), else the colour plot (color) -> {cp, cz, pname}
  function colorPlotOf(st) {
    const cp = cauchyUsable(st.cauchy) ? st.cauchy : null;
    const cz = !cp && st.cauchy && st.cauchy.nodes && st.cauchy.nodes.length >= 4 ? st.cauchy : null;
    return { cp, cz, pname: cp ? 'cauchyF' : cz ? 'cauchy' : 'color' };
  }
  const colorProgName = (st) => colorPlotOf(st).pname;
  // st.standIn: the plot's stand-in while its program links, {x0, y0, h, nx, ny, w}: w = F(z) at the nx x ny nodes, node
  // (i, j) the point (x0 + i h, y0 + j h) with its value at w[2 (j nx + i)] (re, im; a Float32Array). Drawn in the
  // plot's style (the Cauchy style colours F's values as 'enhanced' does), only when the plot's program gives nothing to
  // draw: first the color program, where it is linked (the Cauchy plot's program compiling: F's values in the same style, no
  // compile started for it), else the stand-in, else nothing; the frame in which the plot's link completes draws the plot. st.noValue: only where F has no finite value, its
  // no-value colour (the NaN hatch, infinity's white), nothing elsewhere, and no stand-in. st.hold: the plot the pane drew in the style
  // before the Cauchy one, {map, style, sectors, grid}: while the Cauchy program links it is drawn again (the color program of its
  // map, where that is linked), so that the pane changes once, from what it showed to the Cauchy plot, and F's values in the
  // Cauchy style's look are drawn only where there is none to hold. -> true when the plot or its stand-in was drawn
  function drawColorPlot(st) {
    if (!ok) return false;
    let { cp, cz, pname } = colorPlotOf(st);
    const dpr = st.dpr || 1;
    // (st.exact: the current chain's own program or nothing drawn, never an earlier chain version's picture)
    let P = program(pname, st.map, st.exact);
    // (the Cauchy plot's program is still linking: F's values drawn by the color program in the stand-in's style (enhanced), with no compile of
    // its own started, until the plot's lands; a failed compile is not this: frameErr says so)
    if (!P && pname !== 'color' && programPending(pname, st.map)) {
      if (st.hold && (P = programLinked('color', st.hold.map, st.exact))) { st = Object.assign({}, st, st.hold); cp = cz = null; pname = 'color'; }
      else if ((P = programLinked('color', st.map, st.exact))) { cp = cz = null; pname = 'color'; }
    }
    if (!P) {
      if (!st.standIn || st.noValue || !(P = program('colorStandIn'))) return false;
      use(P);
      standInUniforms(P, st, dpr);
      return colorPass(P, st, dpr);
    }
    standInRelease();
    use(P, st.map);
    if (cp) {
      cauchyPlan(P, cp);
      u2f(P, 'uCenter', st.view.cx, st.view.cy);
      u2f(P, 'uRelC', st.view.cx - edgeO[0], st.view.cy - edgeO[1]);
    } else if (cz) {
      const n = cauchyNodes(cz);
      gl.bindTexture(gl.TEXTURE_2D, nodeTex);   // unit 4
      u1i(P, 'uNodeN', n);
      u2f(P, 'uRelC', st.view.cx - nodeO[0], st.view.cy - nodeO[1]);
    } else {
      u2f(P, 'uCenter', st.view.cx, st.view.cy);
      u1i(P, 'uNoValue', st.noValue ? 1 : 0);
    }
    u2f(P, 'uInvScale', 1 / (st.view.s * dpr), 1 / (st.view.s * dpr));
    return colorPass(P, st, dpr);
  }
  // the colour plot's pass with program P, its own uniforms set: the frame's viewport, the style's uniforms and
  // st's blending -> true
  function colorPass(P, st, dpr) {
    u4f(P, 'uVp', vpX, vpY, fw, fh);
    dcUniforms(P, st, dpr);
    // (st.dstAlpha: kept only where the frame's alpha is, the regions an alphaOnly pass drew: the
    // colour times the alpha there, the alpha unchanged)
    // (st.alpha < 1: over what the frame holds at that opacity, source-over as a 2D draw at globalAlpha alpha,
    // so a glide's cross-faded plots and the carried colour compose in one frame and reach the page in one copy)
    const fade = !st.dstAlpha && st.alpha != null && st.alpha < 1;
    if (st.dstAlpha) gl.blendFuncSeparate(gl.DST_ALPHA, gl.ZERO, gl.ZERO, gl.ONE);
    else if (fade) { gl.blendColor(0, 0, 0, st.alpha); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); }
    else gl.disable(gl.BLEND);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    if (st.dstAlpha || fade) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }
  // which of the frame's channels what follows writes: its alpha alone (a mask of the regions, for drawColorPlot's
  // dstAlpha or keepInAlpha), its colour alone (drawn over that mask), or all of them again
  function writeMask(rgb, a) { if (ok) { maskRGB = !!rgb; maskA = !!a; gl.colorMask(maskRGB, maskRGB, maskRGB, maskA); } }
  function alphaOnly(on) { writeMask(!on, true); }
  // the frame's colour set to rgb (0-1), its alpha as it is: the paper under a colour layer drawn over a mask
  function clearRGB(rgb) {
    if (!ok) return;
    gl.colorMask(true, true, true, false);
    gl.clearColor(rgb[0], rgb[1], rgb[2], 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(0, 0, 0, 0);
    gl.colorMask(maskRGB, maskRGB, maskRGB, maskA);
  }
  // the frame's colour kept only where its alpha is: each pixel's colour times its alpha, the alpha as it is (a mask
  // the regions wrote before the colour was drawn over it). False while its program links (probe: only ask)
  function keepInAlpha(probe) {
    const Q = ok && program('keepA');
    if (!Q || probe) return !!Q;
    use(Q);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ZERO, gl.DST_ALPHA, gl.ZERO, gl.ONE);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  // the steps view's carried colour on the globe, inside drawSphere's frame (sph: its camera and key light): the whole
  // sphere of plane s (st.mesh {nx, ny}: cells in phi and theta) moved by st.map (from plane s: its base is s), each
  // fragment the colour plane's colour of its point, G = the stages (s, T] (st.s, st.T); triangles whose chord on the
  // sphere is over st.lim are left out. With st.key (the default framebuffer's depth) the sheet key orders the visible
  // side's sheets; the depth buffer is left cleared.
  // st.net and st.gridMajor draw the globe's graticule over the colour (drawSphere's), unless st.graticule is false. False when the program is not ready
  // whether the last carried globe drew the graticule (null before the first)
  let carriedGlobeGraticule = null;
  function drawCarriedGlobe(st, sph) {
    if (!ok) return false;
    const P = program(st.s === st.T ? 'carryGId' : 'carryG', st.map);
    if (!P) return false;
    use(P, st.map);
    uM4(P, 'uMVP', sph.MVP); u3(P, 'uEye', sph.eye);
    globeLight(P, sph);
    sphereNetUniforms(P, st.net, st.gridMajor);
    carriedGlobeGraticule = st.graticule !== false;
    u1f(P, 'uGraticule', +carriedGlobeGraticule);
    const g = st.mesh;
    u2i(P, 'uN', g.nx, g.ny);
    u1f(P, 'uLim', st.lim);
    u1f(P, 'uPole', 1e-3);
    u1i(P, 'uGs', st.s); u1i(P, 'uGt', st.T);
    dcUniforms(P, st, st.dpr || 1);
    const k = st.key && st.key.win && gl.getParameter(gl.FRAMEBUFFER_BINDING) === null ? st.key : null;
    keyUniforms(P, k);
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LEQUAL);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 6 * g.nx * g.ny);
    gl.bindVertexArray(null);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    return true;
  }

  // ---------------- preimages (Preimage mode) ----------------
  const TKIND = { disc: 1, rect: 2, polygon: 3, halfplane: 4, annulus: 5, sector: 6, formula: 7, segment: 11, line: 12, ray: 13, circle: 14, arc: 15, curve: 16, cgrid: 17, pgrid: 18, fcurve: 19 };
  // (notes/constructions-v16/SPEC.md 2.2) a gcircle disc or circle (s._g, A != 0) packs its exact form instead of  standards-ok: a spec path in notes/
  // (c, r): kind 8 (gdisc, the area form: inverse and Preimage area paths) or 20 (gcurve, the curve paths), A = (o, A,
  // C), B = (B, tangent at 0 when the curve passes through 0 by incidence), relative to an anchor o re-anchored in
  // float64 at the point of the curve nearest formAnchor (the view's centre, GLR.setFormAnchor), so float32 sees only
  // small numbers near the view at any radius [C4, C5]
  let formAnchor = null;
  const gKind = (t) => (t && t._g && t._g.A !== 0 && (t.kind === 'disc' || t.kind === 'circle') ? (t.kind === 'disc' ? 8 : 20) : 0);
  function packForm(t) {
    let G = t._g;
    if (formAnchor && Constr.reanchor && !G.thru0) G = Constr.reanchor(G, formAnchor);
    const gx = G.B[0] - G.A * G.o[0], gy = G.B[1] - G.A * G.o[1], gl = Math.hypot(gx, gy) || 1;
    const A = [G.o[0], G.o[1], G.A, G.C], B = [G.B[0], G.B[1], -gy / gl, gx / gl];
    return [...A, ...B].every(Number.isFinite) ? { kind: gKind(t), A, B, size: 2 / Math.abs(G.A), pts: null } : null;
  }
  // MAX_FORMS: formula level functions of the preimage pass (area formulas, traced curve pieces: a complex piece takes
  // two, a restriction one); the inverse renderer's formula areas have their own cap MAX_INV_FORMS (SPEC 4.4)
  const MAX_TARGETS = 16, MAX_PTS = 256, MAX_FORMS = 8, MAX_INV_FORMS = 4;
  let ptsTex = null;
  const preNames = [];     // programs with formula targets compiled in, oldest first
  function dropDef(name) {
    for (const [id, e] of [...progs]) {
      if (e.name !== name) continue;
      if (e.p) gl.deleteProgram(e.p);
      if (e.vs) gl.deleteShader(e.vs);
      if (e.fs) gl.deleteShader(e.fs);
      progs.delete(id);
    }
    delete DEFS[name];
  }
  // the program for a list of formula level functions (GLSL sources defining tlev0, tlev1, ...)
  function preProgram(forms, sph, map) {
    if (!forms.length) return program(sph ? 'preS' : 'pre', map);
    const src = forms.join('');
    let h = 0;
    for (let i = 0; i < src.length; i++) h = (Math.imul(h, 31) + src.charCodeAt(i)) | 0;
    const name = (sph ? 'preS:' : 'pre:') + (h >>> 0).toString(36) + ':' + src.length;
    if (!DEFS[name]) {
      const disp = 'float formulaLevel(int f, vec2 w) {\n' + forms.map((_, i) => `  if (f == ${i}) return tlev${i}(w);\n`).join('') + '  return -1.0;\n}\n';
      DEFS[name] = { chain: true, vs: () => (sph ? SPHERE_VS : QUAD_VS), fs: () => PRE_FS(src + disp, sph) };
      preNames.push(name);
      // (a frame may draw a pass per later plane on the flat plane and on the globe, and the targets' pass: 16 formula
      // programs, so one plane's never evicts another's within a frame and nothing relinks every frame)
      while (preNames.length > 16) dropDef(preNames.shift());
    } else {
      preNames.splice(preNames.indexOf(name), 1);
      preNames.push(name);
    }
    return program(name, map);
  }
  // GLSL of a formula target's level function, named tlev<f>: the app's levelSrc (any function name) or GLChain's
  function formulaSource(t, f) {
    const name = 'tlev' + f;
    if (typeof t.levelSrc === 'string') {
      const m = /float\s+([A-Za-z_]\w*)\s*\(\s*vec2/.exec(t.levelSrc);
      if (m) return t.levelSrc.replace(new RegExp('\\b' + m[1] + '\\b', 'g'), name);
    }
    if (typeof GLChain.levelGLSL !== 'function' || !t.expr) return null;
    const r = GLChain.levelGLSL(t.expr, name);
    return r && r.ok ? r.source : null;
  }
  const xyOf = (p) => (Array.isArray(p) ? [+p[0], +p[1]] : p ? [+(p.re ?? p.x), +(p.im ?? p.y)] : [NaN, NaN]);
  // the pieces of a curve formula target as level ASTs for GLChain.levelGLSL: {g: 'A = B' (levelGLSL's Re(A - B)),
  // gi: for complex sides 'Re(-i (A - B)) = 0' (Im(A - B)): the curve is where both parts vanish, stroked from the
  // smooth complex difference (|A - B| has a kink on the curve that the jump test took for a cut), r: the restriction
  // (positive inside) | null}. Isolated zeros (|z^2 - 1| = 0) have no stroke.
  function curveForms(t) {
    let d = null;
    try { d = Region.curveDesc ? Region.curveDesc(t) : null; } catch (e) { d = null; }
    if (!d) return [];
    const out = [];
    for (const pc of d.pieces) {
      if (pc.kind === 'zeros' || !pc.form || pc.form.t !== 'cmp') continue;
      const f = pc.form;
      const Z = { t: 'num', v: CX.C(0, 0) }, D = { t: 'sub', a: f.a, b: f.b };
      if (pc.real === 'complex') out.push({ g: { t: 'cmp', op: '=', a: D, b: Z }, gi: { t: 'cmp', op: '=', a: { t: 'mul', a: { t: 'num', v: CX.C(0, -1) }, b: D }, b: Z }, r: pc.formRestrict || null });
      else out.push({ g: f, r: pc.formRestrict || null });
    }
    return out;
  }
  // st: {map, view, dpr, targets: [{kind, shape fields as in Region (c, r, r1, r2, a, b, m, t1, t2, pts, n, nc, nr,
  //      complement, expr, levelSrc?), color: [r, g, b], edge?, alpha, width? (device px)}], halo?, wGrid?}
  // Area targets fill where w = F(z) lies inside them (with a faint pull-back of the w-plane's grid and their
  // boundary); curve targets draw their preimage curves. Points are not drawn (their preimages are roots: the app
  // finds them on the CPU). At most 16 targets and 256 polygon / polyline vertices in all.
  // st.sphere: {MVP} instead of view: over the Riemann sphere of that camera (the globe drawn first, depth kept)
  // A shape's record (drawPreimage's targets and the inverse pass's shapes, SPEC 4.3): {kind (TKIND), A, B, size,
  // pts ([x, y] of polygons and freehand curves, finite only)}, or null (an unknown kind, non-finite parameters)
  function packShape(t) {
    if (!t || !TKIND[t.kind]) return null;
    if (gKind(t)) return packForm(t);
    let kind = TKIND[t.kind], ps = null;
    let A = [0, 0, 0, 0], B = [0, 0, 0, 0], size = 0;
    const c = xyOf(t.c), a = xyOf(t.a), b = xyOf(t.b);
    const dir = (deg) => [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
    if (kind === 3 || kind === 16) {
      ps = (t.pts || []).map(xyOf).filter((p) => Number.isFinite(p[0] + p[1]));
      if (ps.length) {
        const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
        size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
      }
    } else if (kind === 1 || kind === 14) { A = [c[0], c[1], Math.abs(t.r), 0]; size = 2 * Math.abs(t.r); }
    else if (kind === 2) {
      A = [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
      size = Math.max(A[2] - A[0], A[3] - A[1]);
    } else if (kind === 4) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      A = [a[0], a[1], dx / L, dy / L];
    } else if (kind === 5) { A = [c[0], c[1], Math.min(t.r1, t.r2), Math.max(t.r1, t.r2)]; size = 2 * A[3]; }
    else if (kind === 6) {
      const span = (((t.t2 - t.t1) % 360) + 360) % 360 || 360;
      A = [c[0], c[1], t.r > 0 ? t.r : 0, span];
      B = [...dir(t.t1), ...dir(t.t1 + span)];
      size = t.r > 0 ? 2 * t.r : 0;
    } else if (kind === 11 || kind === 17) { A = [a[0], a[1], b[0], b[1]]; size = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1])); if (kind === 17) B = [Math.max(1, Math.min(60, t.n | 0)), 0, 0, 0]; }
    else if (kind === 12 || kind === 13) A = [a[0], a[1], b[0] - a[0], b[1] - a[1]];
    else if (kind === 15) {
      // the arc through a, m, b (Region.arc3): ccw from its start over span degrees
      const m = xyOf(t.m);
      const arc = Region.arc3 ? Region.arc3(CX.C(a[0], a[1]), CX.C(m[0], m[1]), CX.C(b[0], b[1])) : null;
      if (!arc || !arc.center) { kind = 11; A = [a[0], a[1], b[0], b[1]]; }
      else {
        const cx = arc.center.re, cy = arc.center.im, TAU = 2 * Math.PI;
        const ta = Math.atan2(a[1] - cy, a[0] - cx), tb = Math.atan2(b[1] - cy, b[0] - cx), tm = Math.atan2(m[1] - cy, m[0] - cx);
        const ccw = (x) => (((x - ta) % TAU) + TAU) % TAU;
        const s0 = ccw(tm) < ccw(tb) ? ta : tb, span = ccw(tm) < ccw(tb) ? ccw(tb) : TAU - ccw(tb);
        A = [cx, cy, arc.radius, span * 180 / Math.PI];
        B = [Math.cos(s0), Math.sin(s0), Math.cos(s0 + span), Math.sin(s0 + span)];
      }
    } else if (kind === 18) { A = [c[0], c[1], Math.abs(t.r), 0]; B = [Math.max(1, Math.min(40, t.nc | 0)), Math.max(1, Math.min(72, t.nr | 0)), 0, 0]; size = 2 * Math.abs(t.r); }
    if (![...A, ...B].every(Number.isFinite)) return null;
    return { kind, A, B, size, pts: ps };
  }
  function drawPreimage(st) {
    if (!ok || !st || !(st.view || st.sphere)) return;
    const recs = [], pts = [], forms = [];
    for (const t of st.targets || []) {
      if (recs.length >= MAX_TARGETS * 24) break;
      if (!t || t.visible === false || !TKIND[t.kind]) continue;
      const pk = packShape(t);
      if (!pk) continue;
      const { kind, A, B, size } = pk;
      let start = 0, count = 0;
      if (kind === 3 || kind === 16) {
        const ps = pk.pts;
        const room = MAX_PTS - pts.length;
        if (ps.length < (kind === 3 ? 3 : 2) || room < (kind === 3 ? 3 : 2)) continue;
        const n = Math.min(ps.length, room);
        start = pts.length; count = n;
        for (let i = 0; i < n; i++) pts.push(ps[Math.round(i * (ps.length - 1) / Math.max(1, n - 1))]);
      } else if (kind === 7) {
        if (forms.length >= MAX_FORMS) continue;
        const src = formulaSource(t, forms.length);
        if (!src) continue;
        start = forms.length;
        forms.push(src);
      } else if (kind === 19) {
        // a curve formula: one record per piece (its equation's g = A - B, |A - B| for complex sides; its restriction's
        // level, or -1), stroked where |g(w)| / |grad g| in device px is under half the width (PRE_FS)
        for (const pf of curveForms(t)) {
          const ng = pf.gi ? 2 : 1;
          if (recs.length >= MAX_TARGETS * 24 || forms.length + ng + (pf.r ? 1 : 0) > MAX_FORMS) break;
          const gs = formulaSource({ expr: pf.g }, forms.length);
          const gis = pf.gi ? formulaSource({ expr: pf.gi }, forms.length + 1) : null;
          const rs = pf.r ? formulaSource({ expr: pf.r }, forms.length + ng) : null;
          if (!gs || (pf.gi && !gis) || (pf.r && !rs)) continue;
          const gi = forms.length;
          forms.push(gs);
          if (gis) forms.push(gis);
          if (rs) forms.push(rs);
          const col = col3(t.color, [0.04, 0.23, 0.61]), edge = col3(t.edge, col.map((x) => 0.55 * x));
          recs.push(19, 0, gi, gis ? 1 : 0, 0, 0, 0, 0, rs ? gi + ng : -1, 0, 0, 0, ...col, t.alpha ?? 1, ...edge, t.width ?? 2 * (st.dpr || 1), 0, 0, 0, 0);
        }
        continue;
      }
      const area = kind < 10;
      const col = col3(t.color, area ? [0.23, 0.44, 0.83] : [0.04, 0.23, 0.61]);
      const cmp = t.complement && area && kind !== 8;   // (a gdisc's form holds its side)
      const edge = col3(t.edge, col.map((x) => 0.55 * x));
      const cell = size > 0 ? nice125(size / 4) : (st.wGrid > 0 ? st.wGrid : 0.5);
      recs.push(kind, cmp ? 1 : 0, start, count, ...A, ...B, ...col, t.alpha ?? (area ? 0.4 : 1), ...edge, t.width ?? 2 * (st.dpr || 1), cell, 0, 0, 0);
    }
    const nt = recs.length / 24;
    if (!nt) return;
    const sph = !!st.sphere;
    const P = preProgram(forms, sph, st.map);
    if (!P) return;
    // records, then vertices, one texel each
    const W = nt * 6 + pts.length;     // at most 352 texels: one row
    const data = new Float32Array(W * 4);
    data.set(recs);
    pts.forEach((p, i) => { data[recs.length + 4 * i] = p[0]; data[recs.length + 4 * i + 1] = p[1]; });
    use(P, st.map);
    gl.activeTexture(gl.TEXTURE4);
    if (!ptsTex) ptsTex = floatTex();
    gl.bindTexture(gl.TEXTURE_2D, ptsTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, 1, 0, gl.RGBA, gl.FLOAT, data);
    const dpr = st.dpr || 1;
    u1f(P, 'uDpr', dpr);
    u1i(P, 'uTN', nt);
    u3(P, 'uHalo', col3(st.halo, [1, 1, 1]));
    u1f(P, 'uHaloA', st.haloA ?? 0.85);
    if (sph) {
      // the globe's own triangles at its depth: only the visible hemisphere, nothing written
      uM4(P, 'uMVP', st.sphere.MVP);
      const g = sphere();
      const dt = gl.isEnabled(gl.DEPTH_TEST);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);   // another program over the same triangles
      gl.bindVertexArray(g.vao);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      if (!dt) gl.disable(gl.DEPTH_TEST);
      return;
    }
    u2f(P, 'uCenter', st.view.cx, st.view.cy);
    u2f(P, 'uInvScale', 1 / (st.view.s * dpr), 1 / (st.view.s * dpr));
    u4f(P, 'uVp', vpX, vpY, fw, fh);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

