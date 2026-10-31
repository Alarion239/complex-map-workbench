  // ---------------- frame management ----------------
  let fw = 0, fh = 0, vpX = 0, vpY = 0;
  function init(cnv) {
    canvas = cnv || document.createElement('canvas');
    if (!cnv) { canvas.width = 640; canvas.height = 480; }
    try {
      gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
      if (!gl) return false;
      maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      pcExt = gl.getExtension('KHR_parallel_shader_compile');
      rtOK = !!gl.getExtension('EXT_color_buffer_float');
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
        sphereGeo = emptyVAO = markVAO = markBuf = lutTex = palTex = tfObj = scratch = nodeTex = nodeKey = ptsTex = rtFbo = null;
        invTex = halfTex = halfFbo = null; invTexKey = ''; halfW = halfH = 0; invUpWarm = false; invFailed.clear(); tqPending.length = 0; tqActive = null; tqChecked = false; tqExt = null;
        scratchBytes = 0;
        lands.clear(); lastLand = landS = null;
        // (the refinement's programs are warmed again one per frame, and its read-back buffer is gone; r2 review math-4)
        rfWarmAll = false; rfWarmT = -1e9; rfWarmTex = null; rdBuf = null;
        maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        pcExt = gl.getExtension('KHR_parallel_shader_compile');
        rtOK = !!gl.getExtension('EXT_color_buffer_float');
        ok = true; lost = false;
        prestart(PRESTART_2D);
        if (api.onRestore) api.onRestore();
      });
    } catch (e) {
      ok = false;
    }
    return ok;
  }
  function begin(pw, ph, clear) {
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
      frameErr = ''; framePending = false; frameCompiling = false; invAltUsed = false; invFrame++;
    }
    fw = pw; fh = ph; vpX = 0; vpY = 0;
    gl.viewport(0, 0, pw, ph);
    gl.disable(gl.SCISSOR_TEST);
    const c = clear || [0, 0, 0, 0];
    gl.clearColor(c[0], c[1], c[2], c[3]);
    gl.clearDepth(1);
    gl.depthMask(true);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    resetState();
  }
  // Optional: draw into a sub-rectangle (device px, bottom-left origin) of a shared stage canvas.
  function viewport(x, y, w, h, clear) {
    if (preActive) { preActive = false; gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    if (halfOpen && halfOpen.pre) halfOpen = null;
    fw = w; fh = h; vpX = x; vpY = y;
    frameErr = ''; framePending = false; frameCompiling = false; invAltUsed = false; invFrame++;
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
      if (cur.info) hist.unshift(cur);
      const j = hist.findIndex((h) => h.key === info.key);
      cur = j >= 0 ? hist.splice(j, 1)[0] : { key: info.key, info: null, data: null, hash: '', sigs: sigsOf(info.key) };
      if (hist.length > PROG_KEEP) hist.length = PROG_KEEP;
    }
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
  const PATTERNS = { solid: 0, checker: 1, polar: 2, tiles: 3, grid: 4, polargrid: 5, phase: 6, stretch: 7, sphere: 8 };
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
  // deformation whose mode compiles, this chain's evaluation of its start)
  function stand(res, isMesh, L, map, name) {
    const d = progs.get(progId(name, cur, map));
    if (!d || d.state !== 'pending' || sideMode) return null;   // a failed compile is reported, never covered up
    for (const h of hist) {
      const T = getProg(isMesh ? 'tfRegion' : 'tfLine', h, false, map);
      if (T) return tfEntry(res, isMesh, L, map, 'stand-in', T);
    }
    const T = modeOf(map) ? getProg(isMesh ? 'tfRegion' : 'tfLine', cur, false, startOf(map)) : null;
    return T ? tfEntry(res, isMesh, L, map, 'stand-in', T) : null;
  }
  function freeTmp(e) {
    if (!tmpAll.delete(e)) return;
    cacheBytes -= e.bytes;
    if (gl && e.tex) gl.deleteTexture(e.tex);
    if (e.res.tmp && e.res.tmp.get(e.slot) === e) e.res.tmp.delete(e.slot);
  }
  // over the budget: scratch textures not drawn from for a second go first (a homotopy or thumbnails that ended)
  function freeStaleTmp(now) { for (const e of [...tmpAll]) if (now - e.t > 1000) freeTmp(e); }
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
  // Draw a region mesh. st: {map, view, dpr, L, color (c0), color2 (c1), edge (k), ink, alpha, pattern, cell, lines,
  //   skip, stretch:{shrink,grow,mid}, fade, origin, cacheKey, sphere:{MVP, eye}, sync (wait for compiles)}
  // Identity maps draw without the chain, in coordinates relative to the mesh origin.
  function drawRegion(res, st) {
    if (!ok || !res || !res.n) return;
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
      // st.scissors: draw only inside these rects (device px of the pane, bottom-left origin; SPEC 8.8: the GPU image
      // around a SphereMesh's guard box while its rebuild runs)
      if (st.scissors) {
        const scOn = gl.isEnabled(gl.SCISSOR_TEST), prevSc = scOn ? gl.getParameter(gl.SCISSOR_BOX) : null;
        for (const sc of st.scissors) {
          let x0 = vpX + sc[0], y0 = vpY + sc[1], x1 = x0 + sc[2], y1 = y0 + sc[3];
          if (prevSc) { x0 = Math.max(x0, prevSc[0]); y0 = Math.max(y0, prevSc[1]); x1 = Math.min(x1, prevSc[0] + prevSc[2]); y1 = Math.min(y1, prevSc[1] + prevSc[3]); }
          if (x1 <= x0 || y1 <= y0) continue;
          gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
          gl.drawArraysInstanced(gl.TRIANGLES, 0, regionTemplate(L).count, res.n);
        }
        if (scOn) gl.scissor(prevSc[0], prevSc[1], prevSc[2], prevSc[3]); else gl.disable(gl.SCISSOR_TEST);
      } else gl.drawArraysInstanced(gl.TRIANGLES, 0, regionTemplate(L).count, res.n);
      gl.bindVertexArray(null);
    } finally { if (st.sync) syncDepth--; }
  }
  // st: {map, view, dpr, M, width (device px), color, alpha, casing:{color, alpha, width}, fade, cacheKey, sphere,
  //      floor, sync, dash:[on, off] (CSS px, 2D only; the casing stays solid), arc:{key, data}}
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
      if (!P && !ident && !e && (e = stand(res, false, M, st.map, pend ? 'tfLine' : nameOf()))) P = program(nameOf(), st.map);
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
      gl.bindVertexArray(lineVAO(res, M));
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
      const count = lineTemplate(M).count;
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
  // the residue theorem's data (#235; st.cauchy.plan = {poles: [{z, order <= 4, n, a: [{re, im}]}]}, st.cauchy.edges =
  // Float64Array [ax, ay, bx, by] * m: the polygon's edges, simplified to a fraction of a pixel): the edges as a texture
  // row relative to their centre, the poles and their principal parts as uniforms. -> {n edges, origin}
  let edgeTex = null, edgeKey = null, edgeO = [0, 0], edgeN = 0;
  function cauchyEdges(c) {
    gl.activeTexture(gl.TEXTURE4);
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
  function drawColorPlot(st) {
    if (!ok) return;
    const cp = st.cauchy && st.cauchy.plan && st.cauchy.edges && st.cauchy.edges.length >= 4 ? st.cauchy : null;
    const cz = !cp && st.cauchy && st.cauchy.nodes && st.cauchy.nodes.length >= 4 ? st.cauchy : null;
    const P = program(cp ? 'cauchyF' : cz ? 'cauchy' : 'color', st.map);
    if (!P) return;
    use(P, st.map);
    const dpr = st.dpr || 1;
    if (cp) {
      cauchyEdges(cp);
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
      u2f(P, 'uCenter', st.view.cx, st.view.cy);
      u2f(P, 'uRelC', st.view.cx - edgeO[0], st.view.cy - edgeO[1]);
    } else if (cz) {
      const n = cauchyNodes(cz);
      gl.bindTexture(gl.TEXTURE_2D, nodeTex);   // unit 4
      u1i(P, 'uNodeN', n);
      u2f(P, 'uRelC', st.view.cx - nodeO[0], st.view.cy - nodeO[1]);
    } else {
      u2f(P, 'uCenter', st.view.cx, st.view.cy);
    }
    u2f(P, 'uInvScale', 1 / (st.view.s * dpr), 1 / (st.view.s * dpr));
    u4f(P, 'uVp', vpX, vpY, fw, fh);
    dcUniforms(P, st, dpr);
    // ((#366 prototype) st.dstAlpha: kept only where the frame's alpha is, the regions an alphaOnly pass drew: the
    // colour times the alpha there, the alpha unchanged)
    // ((#439 I) st.alpha < 1: over what the frame holds at that opacity, source-over as a 2D draw at globalAlpha alpha,
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
  }
  // ((#366 prototype) what follows writes the frame's alpha alone (on), or every channel again (off): a mask of the
  // regions for drawColorPlot's dstAlpha)
  function alphaOnly(on) { if (ok) gl.colorMask(!on, !on, !on, true); }

  // (#366 F) the steps view's carried colour: the grid over plane s (st.mesh {x0, y0, dx, dy, nx, ny}) moved by st.map
  // (from plane s: its base is s), each fragment the colour plane's colour of its point, G = the stages (s, T]
  // (st.s, st.T); triangles longer than st.lim on the plane are left out. False when the program is not ready
  function drawCarried(st) {
    if (!ok) return false;
    const P = program(st.s === st.T ? 'carryId' : 'carry', st.map);
    if (!P) return false;
    use(P, st.map);
    const dpr = st.dpr || 1, g = st.mesh;
    view2D(P, st.view, dpr, null);
    u4f(P, 'uCGrid', g.x0, g.y0, g.dx, g.dy);
    u2i(P, 'uN', g.nx, g.ny);
    u1f(P, 'uLim', st.lim);
    u1i(P, 'uGs', st.s); u1i(P, 'uGt', st.T);
    dcUniforms(P, st, dpr);
    // (the sheet key, as drawPreMapped's: the default framebuffer has a depth buffer)
    const k = st.key && st.key.win && gl.getParameter(gl.FRAMEBUFFER_BINDING) === null ? st.key : null;
    u1i(P, 'uKeyOn', k ? 1 : 0);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(empty());
    if (k) {
      const w = k.win, sing = (k.sing || []).slice(0, 4), sv = new Float32Array(8);
      sing.forEach((p, i) => { sv[2 * i] = p.re; sv[2 * i + 1] = p.im; });
      u4f(P, 'uKWin', w.x0, w.y0, w.x1, w.y1); u1f(P, 'uKR', k.R); u1f(P, 'uKRs', k.rs);
      if (P.loc.uKSing) gl.uniform2fv(P.loc.uKSing, sv);
      u1i(P, 'uKSingN', sing.length);
      const dt = gl.isEnabled(gl.DEPTH_TEST);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LEQUAL);
      gl.drawArrays(gl.TRIANGLES, 0, 6 * g.nx * g.ny);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LESS);
      if (!dt) gl.disable(gl.DEPTH_TEST);
    } else gl.drawArrays(gl.TRIANGLES, 0, 6 * g.nx * g.ny);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND);
    return true;
  }

  // ---------------- preimages (Preimage mode) ----------------
  const TKIND = { disc: 1, rect: 2, polygon: 3, halfplane: 4, annulus: 5, sector: 6, formula: 7, segment: 11, line: 12, ray: 13, circle: 14, arc: 15, curve: 16, cgrid: 17, pgrid: 18, fcurve: 19 };
  // v16 (notes/constructions-v16/SPEC.md 2.2): a gcircle disc or circle (s._g, A != 0) packs its exact form instead of
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
      const cmp = t.complement && area && kind !== 8;   // (v16: a gdisc's form holds its side)
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

