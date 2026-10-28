  // ---------------- 3D ----------------
  const M4 = {
    mul(a, b) {
      const o = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k];
        o[i * 4 + j] = s;
      }
      return o;
    },
    persp(fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
    },
    lookAt(eye, at, up) {
      const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
      const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
      const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const z = norm(sub(eye, at)), x = norm(crs(up, z)), y = crs(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
    },
    apply(m, p) {
      const x = p[0], y = p[1], z = p[2];
      return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14], m[3] * x + m[7] * y + m[11] * z + m[15]];
    },
  };
  function camera(cam, pw, ph) {
    const D = Math.PI / 180;
    cam = Object.assign({ yaw: -38 * D, pitch: 30 * D, dist: 8, tx: 0, ty: 0, tz: 0, fov: 28 * D }, cam);
    const eye = [
      cam.tx + cam.dist * Math.cos(cam.pitch) * Math.cos(cam.yaw),
      cam.ty + cam.dist * Math.cos(cam.pitch) * Math.sin(cam.yaw),
      cam.tz + cam.dist * Math.sin(cam.pitch),
    ];
    const V = M4.lookAt(eye, [cam.tx, cam.ty, cam.tz], [0, 0, 1]);
    const Pm = M4.persp(cam.fov || 28 * Math.PI / 180, pw / ph, Math.max(0.02, cam.dist * 0.02), cam.dist * 30);
    return { MVP: M4.mul(Pm, V), eye };
  }
  // Light rig, fixed in the world (spec 6.9): key azimuth 135 deg elevation 50 deg, fill azimuth -45 deg elevation
  // 20 deg. The azimuths are bearings (clockwise from +y, the hillshade convention), i.e. math angles -45 and 135:
  // with the default cameras (yaw -38 / -60) the key sits high over the viewer's shoulder and the fill rakes from
  // behind. Read as math angles the key would backlight every default view and leave the faces we look at in shade.
  const dirOf = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)]; };
  const bearing = (b) => 90 - b;
  const KEY_DIR = dirOf(bearing(135), 50), FILL_DIR = dirOf(bearing(-45), 20);
  let sceneLight = null;
  const defaultLight = (dark) => ({ sky: toLin3(hexRGB(dark ? '#9FB2C0' : '#E6EEF4')), ground: toLin3(hexRGB(dark ? '#3A3F44' : '#8C9296')) });
  function lightUniforms(P, lt, specK, specE, rimK) {
    u3(P, 'uKeyDir', KEY_DIR);
    u3(P, 'uFillDir', FILL_DIR);
    u3(P, 'uSky', lt.sky);
    u3(P, 'uGround', lt.ground);
    u1f(P, 'uSpecK', specK);
    u1f(P, 'uSpecE', specE);
    u1f(P, 'uRimK', rimK);
  }

  // Landscape colours (sRGB) with theme defaults derived from the background when the app omits them
  function landColors(st) {
    const c = st.colors || {};
    const bg = col3(st.bg, null);
    const dark = c.landBottom ? lum(col3(c.landBottom)) < 0.18 : (bg ? lum(bg) < 0.18 : false);
    const D = dark ? {
      floor: '#10181D', box: '#36474F', modLine: '#05090B', argLine: '#FFFFFF', plaster: '#C9CFD2', shadow: '#000000', shadowA: 0.55,
      hemiSky: '#9FB2C0', hemiGround: '#3A3F44', accent: '#52B7D3', minor: '#14212A', medium: '#1A2D38', major: '#21404F', landBottom: '#0A1013', cut: '#FF6B3D', probe: '#E3EAEE',
      under: '#5D6E78',
    } : {
      floor: '#FAFCFC', box: '#B3BEC4', modLine: '#18232A', argLine: '#FFFFFF', plaster: '#ECEEEC', shadow: '#2E3D47', shadowA: 0.30,
      hemiSky: '#E6EEF4', hemiGround: '#8C9296', accent: '#0A6A87', minor: '#E2EEF2', medium: '#D3E6ED', major: '#B5D4E0', landBottom: '#DCE4E7', cut: '#CC3311', probe: '#121A20',
      under: '#8A9AA4',
    };
    const o = { dark };
    for (const k of Object.keys(D)) o[k] = k === 'shadowA' ? (c.shadowA ?? D.shadowA) : col3(c[k], D[k]);
    return o;
  }
  // height pass cache: (chain, parameters, map, box, N, height mode, H, mu) -> textures
  const lands = new Map();
  let lastLand = null;
  // How the real discontinuities of the principal surface are found (LAND_EDGE_VS uCutMode), from the steps the map
  // applies (GLChain cutKinds; review math-3): 0 none (no cut: the map is continuous away from its poles, no edge
  // pass), 1 by the continuation of the chain's sheets (roots, powers, log, z^n's path), 2 by bisection (cuts the
  // sheets cannot continue: an inverse trig or Joukowski step, arg in a formula, a formula's path through its branch
  // points, a d/dz after a cut, the straight-line map mode 2). A step's path counts only while it runs, 0 < t < 1.
  function cutModeOf(info, map) {
    if (!info || !Array.isArray(info.cutKinds)) return 0;
    const m = map || {}, mode = m.mode || 0, t = +m.t || 0;
    const base = m.base || 0, a = m.a || 0, b = m.b || 0, hi = m.hi || 0, post = m.post || 0;
    // (as the chain applies step k: 0 not, 1 in full, 2 its path at t; cxs0_how, MAP)
    const how = (k) => {
      if (mode === 0) return k > a && k <= b ? 1 : 0;
      if (mode === 2) return k > base && k <= b ? 1 : 0;
      if (mode === 1) { if (k > base && k < hi) return 1; if (k === hi) return 2; }
      else if (mode === 3) { if (k > base && k <= a) return 1; if (k > a && k <= b) return 2; }
      return post > b && k > b && k <= post ? 1 : 0;
    };
    let other = false, cut = false;
    for (const c of info.cutKinds) {
      const hw = how(c.k);
      if (!hw) continue;
      const kind = hw === 2 ? (t <= 0 ? 'none' : t >= 1 ? c.f : c.h) : c.f;
      if (kind === 'deriv') { if (cut) other = true; continue; }
      if (kind === 'other') other = true;
      if (kind !== 'none') cut = true;
    }
    if (!cut) return 0;
    return other || mode === 2 ? 2 : 1;
  }
  const edgeName = (cm, m) => (cm === 2 ? 'landEdge2' : m && (m.mode === 1 || m.mode === 3) ? 'landEdgeH' : 'landEdgeS');
  // A deformation at t = 0 has no cut yet: the edge pass its t > 0 will need starts compiling now, and is first drawn
  // (a pass that writes nothing) at rest once it has settled, before the play that needs it (r3 review speed-3)
  function edgeAhead(P1, em, st, rf, cmNow, P3now) {
    if (P1.ch !== cur) return;
    if (!(em.mode === 1 || em.mode === 3)) {
      // (no deformation shown: the edge passes a deformation of each step would use start compiling in the background,
      // at rest once this surface has been drawn, so that opening the deformation, which plays at once, finds them
      // linked; nothing is drawn with them here. r3 verify-1: compiled only at the open, the pass was never ready in a
      // rest frame and the whole play drew the former rule's torn walls)
      // (after this surface's own passes have been taken into use: the refinement's programs and the edge pass it
      // draws now, so that the cold open's links are not delayed by it)
      if (st.motion || !rf || !rf.Lp || !rf.Lp.drawnOnce || !rfWarmAll || !Array.isArray(P1.ch.info.cutKinds)) return;
      if (cmNow && !(P3now && P3now.used1)) return;
      // (in the map mode the app's deformation draws, aheadMode: each step's own path, 1, or all steps at once, 3)
      const all = aheadMode === 3, n = P1.ch.sigs.length;
      for (const c of P1.ch.info.cutKinds) {
        if (!c || c.h === 'none' || c.h === 'deriv') continue;
        const hm = all ? { mode: 3, base: 0, a: 0, b: n, t: 0.5 } : { mode: 1, base: 0, hi: c.k, t: 0.5 }, ca = cutModeOf(P1.ch.info, hm);
        // (its settle clock starts when its link lands, not at the open)
        const P = ca ? getProg(edgeName(ca, hm), cur, true, hm) : null;
        if (P && !P.used1) settled(P);
      }
      return;
    }
    const ca = cutModeOf(P1.ch.info, Object.assign({}, em, { t: 0.5 }));
    if (!ca) return;
    const P = getProg(edgeName(ca, em), cur, true, em);
    if (!P || P.used1 || (st.motion && !st.full) || !settled(P)) return;
    use(P, st.map);
    u1i(P, 'uN', 2); u1i(P, 'uSteps', 0); u1i(P, 'uTwo', 0); u1i(P, 'uDir', 0);
    gl.activeTexture(gl.TEXTURE15);
    if (!rfWarmTex) rfWarmTex = floatTex();
    runTF(P, empty(), gl.POINTS, 1, 0, 16, rfWarmTex, 1, 1, gl.RGBA32F, gl.RGBA);
  }
  function landHeights(st, N, mode, H, mu, aspect, rf) {
    const b = st.box;
    const P1 = program('landTF', st.map), P2 = program('landNrm');
    // (one cache per grid size: the stage cards' small landscapes no longer evict the pane's)
    let land = lands.get(N) || null;
    if (!P1 || !P2) return land;   // compiling: keep the last heights
    // (the map P1 draws: a deformation's start while its own mode compiles, mapIn)
    const em = mapIn(P1, st.map) || {};
    const cm = cutModeOf(P1.ch.info, em);
    // the edge pass must be of the same chain version and map mode as the heights. While it compiles (a new chain), the
    // surface is drawn at once by the former rule (a triangle across a height step over 0.3 H left out: cuts -1), and
    // with its real cuts when the pass is ready (review pictures-1: the block stayed empty for seconds)
    // (r3: once it has settled; a figure, a film or an export takes it as soon as it has compiled)
    // (never first drawn while something moves: the deformation's edge pass, first drawn 0.9 s into a play, held a
    // frame 90 to 250 ms, r3 review speed-3; at rest then)
    const P3r = cm ? program(edgeName(cm, em), em) : null;
    // (a deformation's own pass, once it has settled, is first drawn even while it plays: the play starts at the open,
    // and waiting for a rest frame left the whole play, every loop, to the former rule's torn walls; one first-draw
    // instead, at the play's start when the pass was compiled ahead (edgeAhead), r3 verify-1)
    const defo = em.mode === 1 || em.mode === 3;
    const P3 = P3r && (rf && rf.full || (settled(P3r) && (P3r.used1 || defo || !(st.motion && !st.full)))) ? P3r : null;
    if (P3r && !P3 && st.motion) rfLater();
    if (!cm || !defo) edgeAhead(P1, em, st, rf, cm, P3r);
    const cuts = cm && (!P3 || P3.ch !== P1.ch || P3.mode !== P1.mode) ? -1 : cm;
    const key = [P1.ch.key, P1.ch.hash, mapKeyOf(mapIn(P1, st.map)), b.x0, b.x1, b.y0, b.y1, N, mode, H, mu, cuts].join('|');
    if (land && land.key === key) { lastLand = land; landRefine(st, land, P1, N, mode, H, mu, aspect, rf); return land; }
    if (!land) {
      // (the pane's grid and the stage cards' (64) are kept, one each: a former pane size is freed, review math-5)
      for (const [k, l] of lands) {
        if ((k === 64) !== (N === 64)) continue;
        rfFree(l);
        for (const t of [l.tex1, l.tex2, ...l.edges]) gl.deleteTexture(t);
        lands.delete(k);
        if (lastLand === l) lastLand = null;
      }
      land = { N, tex1: floatTex(), tex2: floatTex(), edges: [floatTex(), floatTex(), floatTex()] };
      lands.set(N, land);
    }
    lastLand = land;
    const bytes = N * N * 16;
    use(P1, st.map);
    u1i(P1, 'uN', N);
    u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu); u1i(P1, 'uPass', 0);
    runTF(P1, empty(), gl.POINTS, N * N, 0, bytes, land.tex1, N, N, gl.RGBA32F, gl.RGBA);
    // the real jumps across the grid's edges (+x, +y, the diagonal)
    if (cuts > 0) {
      const m = mapIn(P3, st.map) || {};
      use(P3, st.map);
      u1i(P3, 'uN', N);
      u4f(P3, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      u1i(P3, 'uHMode', mode); u1f(P3, 'uH', H); u1f(P3, 'uMu', mu);
      // (bisection steps: the cut to 2^-14 of an edge in mode 1, the step's shrinking over 12 halvings in mode 2)
      u1i(P3, 'uSteps', 13); u1i(P3, 'uTwo', 2);
      u1i(P3, 'uSheetA', m.a || 0); u1i(P3, 'uSheetB', m.b || 0); u1i(P3, 'uSheetW', 0);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
      for (let d = 0; d < 3; d++) {
        u1i(P3, 'uDir', d);
        // (runTF binds its target on the active unit: a spare one, so unit 2 keeps the heights)
        gl.activeTexture(gl.TEXTURE15);
        runTF(P3, empty(), gl.POINTS, N * N, 0, bytes, land.edges[d], N, N, gl.RGBA32F, gl.RGBA);
      }
    }
    land.cuts = cuts; land.P3 = P3;
    use(P2);
    u1i(P2, 'uN', N);
    u2f(P2, 'uAspect', aspect[0], aspect[1]);
    u1f(P2, 'uH', H);
    u1i(P2, 'uCuts', cuts);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
    for (let d = 0; d < 2; d++) { gl.activeTexture(gl.TEXTURE5 + d); gl.bindTexture(gl.TEXTURE_2D, land.edges[d]); }
    gl.activeTexture(gl.TEXTURE15);
    runTF(P2, empty(), gl.POINTS, N * N, 0, bytes, land.tex2, N, N, gl.RGBA32F, gl.RGBA);
    land.key = key;
    land.rkey = null;
    landRefine(st, land, P1, N, mode, H, mu, aspect, rf);
    return land;
  }
  // ---- adaptive refinement (REFINE; notes/landscape-walls/r2/AS-BUILT.md) ----
  // The levels come from the GPU (a pass of the height program); they are read back (a quarter of a float per cell)
  // and listed here, grouped by level, worst first within the budget; the refined vertices are a third pass of the
  // same program, and each level's sub-cells one instanced draw. The budget (evaluations of the chain) is the design's
  // capacity: while something moves the levels are capped (the walls stay closed, a little coarser) and the full
  // refinement follows when it stops (rfLater). A figure, a film or an export is always refined in full.
  const RF_W = 2048;                       // the refined textures' width in texels
  // evaluations of the chain at rest / while moving (the base passes are ~0.4 M, or 2.6 M for two sheets); at rest the
  // refined textures stay under ~40 MB
  const RF_REST = 6e6, RF_MOVE = 1.2e6;
  // All sheets at rest: built over several frames (sheetRefine), at most RF_FRAME evaluations each, RF_REST_S in all
  // (the user's case, sin sqrt z with All sheets at t = 0.2, needs about 13 M at the default mesh and 17 M at Max; its
  // refined texture is then ~70 to 90 MB, 128 bytes per sub-cell and sheet)
  const RF_REST_S = 18e6, RF_FRAME = 3e6;
  // the moving budget for a pane mesh of N vertices per side: RF_MOVE up to 256 cells, then falling with the cells'
  // count, since the base passes take the frame's GPU time as the mesh grows (at Max they take nearly all of it: the
  // refinement then made the GPU fall behind, and each read of the levels waited for it; r2 review math-3)
  const rfMove = (N) => RF_MOVE * Math.min(1, (256 / Math.max(N - 1, 1)) * (256 / Math.max(N - 1, 1)));
  let rfTimer = 0;
  // a mesh entry's refinement objects (textures, read-back buffer and fence), freed with it (r2 review math-4: a dropped
  // mesh left them to the garbage collector, ~100 MB at Max)
  function rfFree(o) {
    if (!o) return;
    for (const k of ['lvTex', 'lstTex', 'rfTex', 'latTex', 'ptsTex', 'evTex', 'lvTmp']) if (o[k]) { gl.deleteTexture(o[k]); o[k] = null; }
    if (o.nb) { rfFree(o.nb); o.nb = null; }
    if (o.rbBuf) { gl.deleteBuffer(o.rbBuf); o.rbBuf = null; }
    if (o.rbFence) { gl.deleteSync(o.rbFence); o.rbFence = null; }
    o.rf = null; o.lvKey = o.rkey = o.rbFor = null; o.lvRaw = null; o.rfRows = 0; o.rfRaw = o.rbData = null; o.lvDim = o.lstRows = 0;
  }
  function rfLater() {
    if (rfTimer || typeof setTimeout !== 'function') return;
    rfTimer = setTimeout(() => { rfTimer = 0; if (api.onReady) api.onReady({ main: true }); }, 180);
  }
  // The levels are read back synchronously only while something moves and every program of the frame has run before
  // (each read then waits for its own passes only). Otherwise, as at a new chain's first Landscape, whose Metal
  // pipelines compile in the GPU process, a synchronous read would hold the page until they have: the levels are
  // copied aside with a fence, the surface is drawn unrefined, and the refinement follows a frame or two later (rfPoll)
  let pollTimer = 0;
  function rfPoll() {
    if (pollTimer || typeof setTimeout !== 'function') return;
    pollTimer = setTimeout(() => { pollTimer = 0; if (api.onReady) api.onReady({ main: true }); }, 24);
  }
  // The refinement's programs have no chain: they compile once per page. Each one's first draw completes its Metal side
  // in the GPU process, which holds every frame meanwhile (spec 8.7: several in one frame held it for 100-250 ms, and a
  // formula's first Landscape, with its surface's own programs, is where they first came): they are taken into use one
  // per frame at least 48 ms apart, each by a draw that writes nothing, and not in the frame that first draws the
  // surface's own program. Until then the surface is drawn unrefined
  // (they link in the background, started together once the surface has been drawn: a static program's first use
  // otherwise linked it on the main thread, 30 to 280 ms for landLv at a cold open, r3 review speed-2)
  const RF_PROGS = ['landLv', 'landRP', 'landRA', 'landR', 'landB'];
  let rfWarmT = -1e9, rfWarmAll = false;
  function rfWarmed(Lp) {
    if (rfWarmAll) return true;
    if (!Lp || !Lp.drawnOnce) { rfPoll(); return false; }
    prestart(RF_PROGS);
    for (const name of RF_PROGS) {
      const e = progs.get(name + '|static');
      if (e && e.state === 'pending' && pcExt && !gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR)) { rfPoll(); return false; }
      const P = program(name);
      if (!P) { rfPoll(); return false; }   // (still linking, in the background)
      if (P.warm) continue;
      if (performance.now() - rfWarmT < 48) { rfPoll(); return false; }
      use(P);
      if (name === 'landR' || name === 'landB') {
        // (a triangle with all its corners at the origin of clip space: no fragment)
        uM4(P, 'uMVP', new Float32Array(16));
        gl.bindVertexArray(empty());
        if (name === 'landB') gl.drawArrays(gl.TRIANGLES, 0, 3); else gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, 1);
        gl.bindVertexArray(null);
      } else {
        u1i(P, 'uM', 1); u1i(P, 'uTot', 0); u1i(P, 'uCuts', -1);
        gl.activeTexture(gl.TEXTURE15);
        if (!rfWarmTex) rfWarmTex = floatTex();
        runTF(P, empty(), gl.POINTS, 1, 0, 16, rfWarmTex, 1, 1, gl.RGBA32F, gl.RGBA);
      }
      P.warm = true; rfWarmT = performance.now();
      rfPoll();
      return false;
    }
    rfWarmAll = true;
    return true;
  }
  let rfWarmTex = null;
  // o: the mesh entry; n floats of the scratch buffer; progs: the programs this frame's passes used; returns the levels
  // or null (pending)
  // The read-back buffer of o for one read, bytes long: a fresh one each time, as in r2 (r3: a kept one, written again
  // after its read, made Chrome warn that its shadow copy was discarded on every read, and the reads took 30 to 50 ms
  // at the Max mesh instead of under 1)
  function rbOf(o, bytes) {
    if (o.rbBuf) gl.deleteBuffer(o.rbBuf);
    o.rbBuf = gl.createBuffer(); o.rbBytes = bytes;
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, o.rbBuf);
    gl.bufferData(gl.COPY_WRITE_BUFFER, bytes, gl.STREAM_READ);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    return o.rbBuf;
  }
  function lvFetch(o, rkey, n, sync, progs) {
    if (sync) return readScratch(n);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, rbOf(o, 4 * n));
    gl.bindBuffer(gl.COPY_READ_BUFFER, scratch);
    gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, 4 * n);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    if (o.rbFence) gl.deleteSync(o.rbFence);
    o.rbFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    o.rbFor = rkey; o.rbN = n; o.rbProgs = progs; o.rbT = performance.now();
    rfPoll();
    return null;
  }
  // Reads the fenced levels of o when the GPU has them (-> true): into o.rbData, for o.rbDataFor
  // (force: a figure, a film or an export; getBufferSubData then waits for the GPU)
  function lvTake(o, force) {
    if (!o || !o.rbFence) return false;
    const st = force ? gl.ALREADY_SIGNALED : gl.clientWaitSync(o.rbFence, 0, 0);
    if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) return false;
    // (read before the fence is deleted: the read is then known complete)
    const out = new Float32Array(o.rbN);
    gl.bindBuffer(gl.COPY_READ_BUFFER, o.rbBuf);
    gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, out);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    gl.deleteSync(o.rbFence); o.rbFence = null;
    for (const P of o.rbProgs || []) if (P) P.rfWarm = true;
    o.rbData = out; o.rbDataFor = o.rbFor;
    return true;
  }
  // The levels in flight are read when the GPU has done the last Landscape frame's work (lvTail, a fence at its end),
  // at the start of a frame or between frames (lvIdle, polled): getBufferSubData waits for the GPU process to work
  // through what is queued before it, and read in the middle of a frame, or before the GPU had finished the one
  // before, a read at the Max mesh while playing took 1.6 ms in the median and 9 to 30 ms one time in ten (r3, the
  // frames that ran over the vsync)
  let lvTail = null, lvIdleT = 0, lvIdleN = 0;
  // (a read waits for the GPU's idle moment at most LV_LATE ms after its pass: under load that moment can be missed
  // frame after frame, and the levels then stood still while the walls moved)
  const LV_LATE = 60;
  function lvCollect() {
    // (no read in flight: the tail fence goes, r3 review speed-4)
    if (lvTail && !lvInFlight()) { gl.deleteSync(lvTail); lvTail = null; }
    if (lvTail) {
      const st = gl.clientWaitSync(lvTail, 0, 0);
      if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) {
        const now = performance.now();
        for (const o of [...lands.values(), landS]) if (o && o.rbFence && now - (o.rbT || 0) > LV_LATE) lvTake(o);
        lvIdleArm();
        return;
      }
      gl.deleteSync(lvTail); lvTail = null;
    }
    for (const o of lands.values()) lvTake(o);
    lvTake(landS);
  }
  const lvInFlight = () => { for (const o of lands.values()) if (o.rbFence) return true; return !!(landS && landS.rbFence); };
  function lvIdleArm() {
    if (lvIdleT || typeof setTimeout !== 'function') return;
    lvIdleT = setTimeout(() => { lvIdleT = 0; if (!gl || lost || !lvInFlight()) return; lvCollect(); if (lvInFlight() && ++lvIdleN < 64) lvIdleArm(); else lvIdleN = 0; }, 3);
  }
  // (at the end of a Landscape frame that has levels in flight: the GPU is done with it when this fence signals)
  function lvTailMark() {
    if (!lvInFlight()) return;
    if (lvTail) gl.deleteSync(lvTail);
    lvTail = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    lvIdleN = 0; lvIdleArm();
  }
  // the fenced levels for rkey (any key: null), once read (null while pending)
  function lvReady(o, rkey) {
    if (!o.rbData || (rkey !== null && o.rbDataFor !== rkey)) { if (o.rbFence) rfPoll(); return null; }
    const out = o.rbData;
    o.rbGot = o.rbDataFor; o.rbData = null;
    return out;
  }
  // (through a buffer of its own, fenced and waited for: the scratch buffer, which every pass writes, is never read)
  let rdBuf = null;
  function readScratch(n) {
    const out = new Float32Array(n);
    // (a fresh buffer each time, as in lvFetch: a READ buffer written again before Chrome saw its read loses its shadow)
    if (rdBuf) gl.deleteBuffer(rdBuf);
    rdBuf = gl.createBuffer();
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, rdBuf); gl.bufferData(gl.COPY_WRITE_BUFFER, 4 * n, gl.STREAM_READ);
    gl.bindBuffer(gl.COPY_READ_BUFFER, scratch);
    gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, 4 * n);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    const f = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    gl.clientWaitSync(f, gl.SYNC_FLUSH_COMMANDS_BIT, 0);
    gl.deleteSync(f);
    gl.bindBuffer(gl.COPY_READ_BUFFER, rdBuf);
    gl.getBufferSubData(gl.COPY_READ_BUFFER, 0, out, 0, n);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null);
    return out;
  }
  // a transform-feedback pass of count points into rows y0.. of tex (W wide, already allocated)
  function runTFRows(P, count, tex, W, y0) {
    const rows = Math.ceil(count / W), bytes = rows * W * 16;
    if (!tfObj) tfObj = gl.createTransformFeedback();
    if (!scratch || scratchBytes < bytes) {
      if (scratch) gl.deleteBuffer(scratch);
      scratch = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, scratch);
      gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_COPY);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      scratchBytes = bytes;
    }
    gl.bindVertexArray(empty());
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfObj);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, scratch);
    gl.beginTransformFeedback(gl.POINTS);
    gl.drawArrays(gl.POINTS, 0, rows * W);
    gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, scratch);
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y0, W, rows, gl.RGBA, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
  }
  // The refined cells, grouped by their levels (Lx, Ly): lvRaw the levels read back (Lx + 8 Ly, 4 cells per texel,
  // Mq x M); cost(Lx, Ly) the evaluations of one such cell, rowsOf(Lx, Ly, n) the rows n such cells take; cap the
  // budget: the levels drop by D (both directions) until the cost fits, and at rest (fill) the rest of the budget raises
  // whole groups back. rfPlan lists them (no GL: it also runs between frames, as soon as the levels are read, lvTake);
  // rfApply uploads the levels and the list (entries grouped, groups in order) and returns the groups {L: [Lx, Ly], n,
  // E (first entry), y0 (first row)}
  let nzK = new Int32Array(0), nzV = new Uint8Array(0), cutC = new Uint8Array(0);
  // dil (the principal surface while something moves, a number of cells): the unrefined cells within dil cells of a
  // refined one, across its wall (not a cell left to the cut rule), are refined to level 1 across the wall. The levels
  // come a frame or two late and from the cheaper estimate, and a wall that had moved into a cell they still call
  // flat was drawn with the base cells' chords and F at the fragment (no facetW there, see LAND_FS): the sawtooth of
  // r2 review verify-1. Level 1 costs 30 evaluations a cell
  function rfPlan(lvRaw, M, cost, rowsOf, cap, fill, dil) {
    const Mq = (M + 3) >> 2, len = lvRaw.length;
    // (one pass over the cells, the non-zero ones kept: r3, a Map per cell took 1.3 ms a build at the Max mesh, and
    // two passes over the 262 144 cells 1.5)
    if (nzK.length < len) { nzK = new Int32Array(len); nzV = new Uint8Array(len); }
    if (dil && cutC.length < len) cutC = new Uint8Array(len);
    if (dil) cutC.fill(0, 0, len);
    const u = new Uint32Array(lvRaw.buffer, lvRaw.byteOffset, len);
    const cnt = new Float64Array(64);
    let nn = 0;
    for (let k = 0; k < len; k++) if (u[k]) { const v = lvRaw[k] | 0; if (v > 0 && v < 64) { cnt[v]++; nzK[nn] = k; nzV[nn++] = v; } else if (dil && v === 64) cutC[k] = 1; }
    const codes = [];
    for (let v = 1; v < 64; v++) if (cnt[v]) codes.push(v);
    // (over the budget, every cell drops by the same d levels in both directions, so the chord error grows by the
    // same factor 4^d everywhere: a top cap left the steepest cells 16 times over and the rest exact; r2 review math-1)
    const capOf = (v, d) => Math.max((v & 7) - d, 0) + 8 * Math.max((v >> 3) - d, 0);
    const costOf = (w) => (w ? cost(w & 7, w >> 3) : 0);
    const total = (d) => { let c = 0; for (const v of codes) c += cnt[v] * costOf(capOf(v, d)); return c; };
    let D = 0;
    while (D < 4 && total(D) > cap) D++;
    const Lc = 4 - D;
    // (then what the drop left of the budget goes back to whole groups of equal wanted levels, a level at a time, the
    // steepest first: one drop is 4 times the cost, so it left up to three quarters of the budget unspent, and a finer
    // mesh, which wants a level less everywhere, could end with fewer evaluations than the default; r2 verify-4. At
    // rest only (fill): the moving budget keeps the uniform drop it was measured with)
    const fin = new Int32Array(64);
    for (const v of codes) fin[v] = capOf(v, D);
    let spent = total(D);
    const steep = codes.slice().sort((a, b) => Math.max(b & 7, b >> 3) - Math.max(a & 7, a >> 3) || ((b & 7) + (b >> 3)) - ((a & 7) + (a >> 3)) || a - b);
    for (let d = D - 1; fill && d >= 0; d--) {
      for (const v of steep) {
        const w0 = fin[v], w1 = capOf(v, d);
        if (w0 !== capOf(v, d + 1) || w1 === w0) continue;
        const up = cnt[v] * (costOf(w1) - costOf(w0));
        if (spent + up <= cap) { fin[v] = w1; spent += up; }
      }
    }
    const capped = codes.some((v) => fin[v] !== v);
    // (the levels uploaded: the cut rule's cells, 64 in the read-back, are 0 there)
    const lv = new Float32Array(len);
    for (let q = 0; q < nn; q++) lv[nzK[q]] = fin[nzV[q]];
    const gcnt = new Float64Array(64);
    for (const v of codes) if (fin[v]) gcnt[fin[v]] += cnt[v];
    let nx = 0;
    const ext = dil ? [] : null;
    if (dil) {
      // (dil cells out, across the wall: an x wall (Lx > 0) moves along x, a y wall along y)
      const S4 = 4 * Mq, vis = new Uint8Array(len);
      let front = [];
      // (from the walls, cells at level 2 or more: a level 1 cell's chord error unrefined is under a pixel)
      for (let q = 0; q < nn; q++) { const w = fin[nzV[q]]; if (Math.max(w & 7, w >> 3) >= 2) { front.push(nzK[q], ((w & 7) ? 1 : 0) + 8 * ((w >> 3) ? 1 : 0)); vis[nzK[q]] = 1; } }
      for (let step = 0; step < dil && front.length; step++) {
        const next = [];
        for (let f = 0; f < front.length; f += 2) {
          const k = front[f], add = front[f + 1], j = (k / S4) | 0, i = k - S4 * j;
          for (let d = 0; d < 4; d++) {
            if (d < 2 ? !(add & 7) : !(add >> 3)) continue;
            const ii = i + (d === 0 ? 1 : d === 1 ? -1 : 0), jj = j + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (ii < 0 || jj < 0 || ii >= M || jj >= M) continue;
            const kk = S4 * jj + ii;
            // (through the refined cells around the wall too: the fill-in counts from the wall itself)
            if (vis[kk] || cutC[kk]) continue;
            vis[kk] = 1;
            next.push(kk, add);
            if (lv[kk]) continue;
            lv[kk] = add; gcnt[add]++; ext.push(kk); nx++;
            spent += costOf(add);
          }
        }
        front = next;
      }
    }
    const groups = [];
    for (let v = 1; v < 64; v++) if (gcnt[v]) groups.push({ v, L: [v & 7, v >> 3], n: gcnt[v] });
    let e = 0, y = 0;
    const at = new Int32Array(64);
    for (const g of groups) { g.E = e; g.y0 = y; at[g.v] = e; e += g.n; y += rowsOf(g.L[0], g.L[1], g.n); }
    const rows = Math.max(1, Math.ceil(e / 1024));
    const list = new Float32Array(rows * 1024);
    // (the cells in row-major order, as before: k = 4 j Mq + i; then the ones filled in, dil)
    for (let q = 0; q < nn; q++) {
      const w = fin[nzV[q]];
      if (!w) continue;
      const k = nzK[q], j = (k / (4 * Mq)) | 0, i = k - 4 * Mq * j;
      list[at[w]++] = j * M + i;
    }
    if (ext) for (const k of ext) { const w = lv[k], j = (k / (4 * Mq)) | 0, i = k - 4 * Mq * j; list[at[w]++] = j * M + i; }
    return { M, Mq, lv, list, lrows: rows, groups, entries: e, rows: y, capped, Lc, drop: D, evals: spent, need: total(0), filled: nx, want: codes.map((v) => (v & 7) + '' + (v >> 3) + ':' + cnt[v]).join(' ') };
  }
  function rfApply(o, p) {
    const { M, Mq, lv, list, lrows: rows, rows: y } = p;
    // (never upload levels of another grid's size: drawn unrefined instead, r3 verify-2)
    if (lv.length !== Mq * M * 4 || list.length < 1024 * rows) return { groups: [], entries: 0, rows: 0, capped: true, Lc: 0, drop: 0, evals: 0, need: 0, want: '', filled: 0 };
    if (!o.lvTex) { gl.activeTexture(gl.TEXTURE15); o.lvTex = floatTex(); o.lstTex = floatTex(); o.rfTex = floatTex(); }
    gl.activeTexture(gl.TEXTURE15);
    gl.bindTexture(gl.TEXTURE_2D, o.lvTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    // (the same sizes as the last build: written in place, r3)
    if (o.lvDim === M) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, Mq, M, gl.RGBA, gl.FLOAT, lv);
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, Mq, M, 0, gl.RGBA, gl.FLOAT, lv); o.lvDim = M; }
    gl.bindTexture(gl.TEXTURE_2D, o.lstTex);
    if (o.lstRows === rows) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, rows, gl.RED, gl.FLOAT, list);
    else { gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1024, rows, 0, gl.RED, gl.FLOAT, list); o.lstRows = rows; }
    // (the refined texture: one allocation for all the groups' rows)
    if (y > 0) {
      gl.bindTexture(gl.TEXTURE_2D, o.rfTex);
      if (o.rfRows !== y) { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, RF_W, y, 0, gl.RGBA, gl.FLOAT, null); o.rfRows = y; }
    }
    const { groups, entries, capped, Lc, drop, evals, need, want, filled } = p;
    return { groups, entries, rows: y, capped, Lc, drop, evals, need, want, filled };
  }
  function rfBuild(o, lvRaw, M, cost, rowsOf, cap, fill, dil) {
    return rfApply(o, rfPlan(lvRaw, M, cost, rowsOf, cap, fill, dil));
  }
  // the principal surface's refinement for the heights in land (rf: {pxW, motion, full, minPx}): the lattice's heights
  // (the chain pass on the grid of quarter cells), the levels (landLv), read back and listed (rfBuild); per group, the
  // points to evaluate (landRP), the chain pass on them, the vertex records (landRA)
  function landRefine(st, land, P0, N, mode, H, mu, aspect, rf) {
    const M = N - 1, Mq = (M + 3) >> 2, b = st.box;
    if (!rf || !(land.cuts >= 0)) { land.rf = null; return; }
    // (programs without the chain: they compile once per page, in the background; drawn unrefined until they land)
    if (!rfWarmed(rf.Lp)) { if (land.rfFor !== land.key) land.rf = null; return; }
    const PL = program('landLv'), PP = program('landRP'), PA = program('landRA'), P1 = P0;
    if (!PL || !PP || !PA) { land.rf = null; return; }
    const rkey = land.key + '|' + rf.pxW.toPrecision(3) + '|' + rf.minPx;
    const move = rf.motion && !rf.full;
    // (moving: the levels from the half cells, capped to the budget; at rest the quarter cells' lattice, in full: a
    // mesh built while moving is rebuilt when it stops, rfLater)
    // (uLat: 1 at rest, the quarter cells; moving, 0 the half cells, 2 over 256 cells the base heights only, math-3)
    const lat = !move, lmode = lat ? 1 : (M > 256 ? 2 : 0), lk = rkey + ['|c', '|L', '|b'][lmode];
    if (land.rkey === rkey && land.rf && (move || !land.rf.partial)) return;
    // (moving with the heights unchanged, as in an orbit or a zoom: the mesh built at rest stays, math-5)
    if (move && land.rf && !land.rf.partial && land.rfFor === land.key) return;
    // (moving with new heights over 256 cells, as the sheets: the base mesh, its steep triangles with facetW (landB),
    // refined when it stops. The levels' read-back waited 40 to 100 ms for the GPU process in every moving frame that
    // took one, 4 to 8 a second at the Max mesh (r3 review speed-3: hitches of 92 to 252 ms), and the levels came too
    // late for walls that moved 15 to 20 cells between two reads (pictures-1))
    if (move && M > 256) { if (land.rfFor !== land.key) land.rf = null; rfLater(); return; }
    const common = (P) => {
      u1i(P, 'uM', M); u4f(P, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); u2f(P, 'uAspect', aspect[0], aspect[1]);
      u1f(P, 'uPxW', rf.pxW); u1f(P, 'uCellW', 2 * Math.max(aspect[0], aspect[1]) / M); u1f(P, 'uMinPx', rf.minPx);
      u1i(P, 'uLat', lmode); u1i(P, 'uCuts', land.cuts);
    };
    const chain = (pass, n) => {
      use(P1, st.map);
      u1i(P1, 'uN', n); u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
      u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu); u1i(P1, 'uPass', pass);
    };
    gl.activeTexture(gl.TEXTURE15);
    for (const k of ['lvTex', 'lstTex', 'rfTex', 'latTex', 'ptsTex', 'evTex']) if (!land[k]) land[k] = floatTex();
    for (let d = 0; d < 3; d++) { gl.activeTexture(gl.TEXTURE5 + d); gl.bindTexture(gl.TEXTURE_2D, land.edges[d]); }
    if (land.lvKey !== lk) {
      // the fenced levels of this key, or while something moves of any earlier one (a frame or two late: never read
      // synchronously while moving, which held the CPU until the GPU had drained, r2 review math-3; a cell that now
      // holds a jump counts as level 0, REFINE)
      const got = lvReady(land, move ? null : lk);
      // (a read of another grid's levels is dropped: r3 verify-2)
      if (got && got.length === Mq * M * 4) { land.lvRaw = got; land.lvKey = land.rbGot; land.lvM = M; }
      // (a new pass once the one in flight has been read, lvCollect; meanwhile the list stands and its vertices follow
      // the heights)
      if (land.lvKey !== lk && !land.rbFence) {
        // The levels' pass: the lattice (the chain on the grid of quarter cells, of half cells while moving) in strips
        // of whole cells, each under ~8 MB, then the levels of the strip's cells, copied into the read-back buffer
        // (the whole lattice was 67 MB at Max, and the shared scratch buffer grew to match; r2 review math-4)
        const s = lat ? 4 : 2, sN = s * M + 1;
        const cs = Math.max(1, Math.min(M, Math.floor((8 * 1024 * 1024 / (16 * sN) - 1) / s)));
        rbOf(land, Mq * M * 16);
        if (!land.lvTmp) { gl.activeTexture(gl.TEXTURE15); land.lvTmp = floatTex(); }
        for (let j0 = 0; j0 < M; j0 += lmode === 2 ? M : cs) {
          if (lmode === 2) {
            use(PL); common(PL); u1i(PL, 'uJ0', 0);
            gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
            gl.activeTexture(gl.TEXTURE15);
            runTF(PL, empty(), gl.POINTS, Mq * M, 0, Mq * M * 16, land.lvTmp, Mq, M, gl.RGBA32F, gl.RGBA);
            gl.bindBuffer(gl.COPY_READ_BUFFER, scratch); gl.bindBuffer(gl.COPY_WRITE_BUFFER, land.rbBuf);
            gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, M * Mq * 16);
            gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
            continue;
          }
          const nr = Math.min(cs, M - j0), R = s * nr + 1;
          chain(0, sN);
          u4f(P1, 'uBox', b.x0, b.y0 + (b.y1 - b.y0) * j0 / M, b.x1 - b.x0, b.y1 - b.y0);
          gl.activeTexture(gl.TEXTURE15);
          runTF(P1, empty(), gl.POINTS, R * sN, 0, R * sN * 16, land.latTex, sN, R, gl.RGBA32F, gl.RGBA);
          use(PL); common(PL); u1i(PL, 'uJ0', j0);
          gl.activeTexture(gl.TEXTURE11); gl.bindTexture(gl.TEXTURE_2D, land.latTex);
          gl.activeTexture(gl.TEXTURE15);
          runTF(PL, empty(), gl.POINTS, Mq * nr, 0, Mq * nr * 16, land.lvTmp, Mq, nr, gl.RGBA32F, gl.RGBA);
          gl.bindBuffer(gl.COPY_READ_BUFFER, scratch); gl.bindBuffer(gl.COPY_WRITE_BUFFER, land.rbBuf);
          gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, j0 * Mq * 16, nr * Mq * 16);
          gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
        }
        // (a figure, a film or an export: waited for; else fenced, picked up a frame or two later, rfPoll)
        if (land.rbFence) gl.deleteSync(land.rbFence);
        land.rbFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        land.rbFor = lk; land.rbN = Mq * M * 4; land.rbProgs = null; land.rbT = performance.now();
        if (rf.full) {
          lvTake(land, true);
          const lv = lvReady(land, lk);
          if (lv) { land.lvRaw = lv; land.lvKey = lk; land.lvM = M; }
        } else rfPoll();
      }
      if (land.lvKey !== lk && !(move && land.lvRaw && land.lvM === M)) { if (land.rfFor !== land.key) land.rf = null; return; }
    }
    // (a vertex record is two texels; its normal takes 4 evaluations besides its own)
    const nv = (lx, ly) => ((1 << lx) + 1) * ((1 << ly) + 1);
    // (moving, with the levels it was built from: the list stands, only its vertices are evaluated again for these
    // heights; the levels are read and listed again when the next ones land, a frame or two later)
    const cap = move ? rfMove(N) : RF_REST;
    const r = move && land.rf && land.rfRaw === land.lvRaw && land.rfCap === cap ? land.rf
      : rfBuild(land, land.lvRaw, M, (lx, ly) => 5 * nv(lx, ly), (lx, ly, n) => Math.ceil(2 * n * nv(lx, ly) / RF_W), cap, !move,
        // (moving: about 8 px either side of a wall, 2 to 4 cells, a wall playing at 1x moved that far between reads;
        // none over 256 cells: at Fine and Max even one cell held the frame's p95 1 to 3 ms over the base's, r3)
        !move || M > 256 ? 0 : Math.max(2, Math.min(4, Math.ceil(8 / Math.max(rf.pxW * 2 * Math.max(aspect[0], aspect[1]) / M, 0.5)))));
    land.rfRaw = land.lvRaw; land.rfCap = cap;
    for (const g of r.groups) {
      const nvg = g.n * nv(g.L[0], g.L[1]), rowsP = Math.ceil(5 * nvg / RF_W);
      const grp = (P) => { common(P); u2i(P, 'uL', g.L[0], g.L[1]); u1i(P, 'uGE', g.E); u1i(P, 'uTot', nvg); };
      gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, land.lvTex);
      gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, land.lstTex);
      use(PP); grp(PP);
      gl.activeTexture(gl.TEXTURE15);
      runTF(PP, empty(), gl.POINTS, rowsP * RF_W, 0, rowsP * RF_W * 16, land.ptsTex, RF_W, rowsP, gl.RGBA32F, gl.RGBA);
      chain(1, N);
      gl.activeTexture(gl.TEXTURE12); gl.bindTexture(gl.TEXTURE_2D, land.ptsTex);
      gl.activeTexture(gl.TEXTURE15);
      runTF(P1, empty(), gl.POINTS, rowsP * RF_W, 0, rowsP * RF_W * 16, land.evTex, RF_W, rowsP, gl.RGBA32F, gl.RGBA);
      use(PA); grp(PA);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, land.tex1);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, land.tex2);
      gl.activeTexture(gl.TEXTURE13); gl.bindTexture(gl.TEXTURE_2D, land.evTex);
      runTFRows(PA, 2 * nvg, land.rfTex, RF_W, g.y0);
    }
    // (built while moving, capped or from the cheaper levels: rebuilt in full when it stops)
    r.partial = move && (r.capped || !lat);
    land.rf = r; land.rkey = rkey; land.rfFor = land.key;
    if (r.partial) rfLater();
    // (at rest, built: the passes' scratch textures go, the lattice's, the points' and their values, up to ~30 MB at
    // the Max mesh after a play; they are made again when something moves, r3 review speed-4)
    if (!move && !rf.full) freeScratch(land);
  }
  function freeScratch(o) {
    for (const k of ['latTex', 'ptsTex', 'evTex', 'lvTmp']) if (o[k]) { gl.deleteTexture(o[k]); o[k] = null; }
  }
  // ---- All sheets ----
  const SHEET_MAX = 24;
  // The sheet combinations of the current chain for map (mode 0: the steps in (a, b] from the w_a-plane) and window W
  // (sheets on each side of the principal one for log and irrational powers): {K (surfaces drawn, at most 24), total,
  // a, b, W, infinite (a log or irrational power among the steps), steps}; null when the map has no multivalued step
  // in (a, b], cannot be drawn as sheets (a homotopy, or a d/dz in (a, b] with a > 0) or the chain has no
  // chainSheetRange (GLChain). Combos 0..K-1 go to chainSheetRange as they are (it decodes them, steps in chain order).
  function sheetPlan(map, W, end) {
    const info = cur.info;
    if (!info || !hasSheets(info) || !info.sheets || !Array.isArray(info.sheets.steps)) return null;
    const m = map || {};
    // a deformation (modes 1 and 3): H_t on the sheets that become F's (chainSheetHom; notes/v16-user5/SHEETS-DESIGN.md),
    // the pieces of the steps the map applies; a = the source stage, b = the last stage applied. end > 0 (F's last step,
    // v16.1 review math-5): F's pieces and digits throughout (b = end, chainSheetHom's end): surface c is F's surface c
    // at every t, a step not begun keeps its digits, and the count is F's
    if (m.mode === 1 || m.mode === 3) {
      end = Math.max(0, Math.floor(+end || 0));
      let ps = null;
      try { ps = typeof info.sheets.mapPieces === 'function' ? info.sheets.mapPieces(m, end) : null; } catch (e) { ps = null; }
      if (!ps || !ps.length) return null;
      W = clamp(Math.round(W) || 2, 1, 4);
      let total = 1;
      for (const s of ps) total *= s.n > 0 ? s.n : 2 * W + 1;
      const K = Math.min(SHEET_MAX, total);
      if (K < 2) return null;
      return { K, total, a: m.base || 0, b: end > 0 ? end : Math.max(m.mode === 1 ? m.hi || 0 : m.b || 0, m.post || 0), W, infinite: ps.some((s) => !(s.n > 0)), steps: ps, hom: true };
    }
    if ((m.mode || 0) !== 0) return null;
    // a > 0: the steps in (a, b] from points of the w_a-plane (chainSheetRange); never across a d/dz (its input is a
    // function of z, not a point: chainSheetRange gives NaN there)
    const a = Math.max(0, m.a || 0), b = m.b || 0;
    if (a > 0 && (info.derivs || []).some((d) => d > a && d <= b)) return null;
    const all = info.sheets.steps.filter((s) => s && s.k >= 1);
    const steps = all.filter((s) => s.k > a && s.k <= b).sort((p, q) => p.k - q.k);
    if (!steps.length) return null;
    W = clamp(Math.round(W) || 2, 1, 4);
    // GLChain's counts for the stages in (a, b] (combos capped at 24, total not), else the product over the pieces
    let K = 1;
    for (const s of steps) K *= s.n > 0 ? s.n : 2 * W + 1;
    let total = K;
    try {
      if (typeof info.sheets.total === 'function') { const t = Math.floor(+info.sheets.total(W, b, a)); if (t > 0) total = t; }
      if (typeof info.sheets.combos === 'function') { const c = Math.floor(+info.sheets.combos(W, b, a)); if (c > 0) K = c; }
    } catch (e) { /* keep the product */ }
    K = Math.min(SHEET_MAX, K);
    if (K < 2) return null;
    return { K, total: Math.max(total, K), a, b, W, infinite: steps.some((s) => !(s.n > 0)), steps };
  }
  // per-cell sheet heights (LAND_SHEET_TF_VS): cache keyed like landHeights, plus the stage, window and combos
  let landS = null;
  function sheetHeights(st, sp, N, mode, H, mu, aspect, rf) {
    const P1 = program('landSheetTF', sp.hom ? st.map : null);
    if (!P1 || !hasSheets(P1.ch.info)) return landS && landS.want === N && landS.K === sp.K ? landS : null;
    // cells per side: about the plain landscape's cell count in all, at least 96 per side
    const K = sp.K, tileC = Math.ceil(Math.sqrt(K)), tileR = Math.ceil(K / tileC);
    let M = Math.max(Math.min(N - 1, 96), Math.floor(Math.sqrt(2 * (N - 1) * (N - 1) / K)));
    M = Math.max(8, Math.min(M, N - 1, Math.floor(maxTex / (2 * tileC)), Math.floor(maxTex / (2 * tileR))));
    const texW = tileC * 2 * M, texH = tileR * 2 * M;
    const b = st.box;
    // (the map's key too: a deformation's surfaces change with t)
    const key = [P1.ch.key, P1.ch.hash, sp.a, sp.b, sp.W, K, b.x0, b.x1, b.y0, b.y1, M, mode, H, mu, sp.hom ? mapKeyOf(mapIn(P1, st.map)) : '0'].join('|');
    if (landS && landS.key === key) { sheetRefine(st, sp, landS, P1, mode, H, mu, aspect, rf); return landS; }
    if (!landS) landS = { tex1: floatTex() };
    use(P1, sp.hom ? st.map : null);
    u1i(P1, 'uN', M + 1);
    u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    u2f(P1, 'uAspect', aspect[0], aspect[1]);
    u1i(P1, 'uSheetA', sp.a); u1i(P1, 'uSheetB', sp.b); u1i(P1, 'uSheetK', K); u1i(P1, 'uSheetW', sp.W); u1i(P1, 'uTileC', tileC); u1i(P1, 'uTexW', texW);
    u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu);
    // linear heights run on past the block (LAND_SHEET_VS clips the surface there exactly)
    u1f(P1, 'uHClip', mode === 4 || mode === 5 ? 1e4 : 0);
    u1i(P1, 'uPass', 0);
    gl.activeTexture(gl.TEXTURE15);
    runTF(P1, empty(), gl.POINTS, texW * texH, 0, texW * texH * 16, landS.tex1, texW, texH, gl.RGBA32F, gl.RGBA);
    Object.assign(landS, { key, N: M + 1, want: N, K, tileC, a: sp.a, b: sp.b, W: sp.W, sheet: true, rkey: null });
    sheetRefine(st, sp, landS, P1, mode, H, mu, aspect, rf);
    return landS;
  }
  // All sheets' refinement passes (landSheetRF, the chain program of heights ch): started once the surface has been
  // drawn, and taken into use RF_LATE ms after its link has landed. A chain program's first draw completes its Metal
  // side in the GPU process, and drawn at once after its link it held every frame of the page for 0.4 to 1 s; drawn
  // later, that work has mostly been done in the background (r3 cold opens: 0.6 s later, the stalls fell to a quarter).
  // A figure, a film or an export waits for it (the link read at once)
  const RF_LATE = 900;
  let rfLateT = 0;
  // a chain program that has not run yet counts as ready RF_LATE ms after its link landed (false meanwhile; the page
  // redraws when the time is up)
  function settled(P) {
    if (!P || P.used1) return !!P;
    const now = performance.now();
    if (!P.settleT) P.settleT = now;
    if (now - P.settleT >= RF_LATE) return true;
    if (!rfLateT && typeof setTimeout === 'function') rfLateT = setTimeout(() => { rfLateT = 0; if (api.onReady) api.onReady({ main: true }); }, RF_LATE - (now - P.settleT) + 8);
    return false;
  }
  // (P0: the heights' program; the passes' program is of its chain version and map mode)
  function sheetRF(rf, P0) {
    const ch = P0.ch, mm = { mode: P0.mode };
    if (!rf.full && !(rf.Ls && rf.Ls.drawnOnce)) { rfPoll(); return null; }
    let P = getProg('landSheetRF', ch, ch === cur, mm);
    if (!P && rf.full) {
      const e = progs.get(progId('landSheetRF', ch, mm));
      if (e && e.state === 'pending') { finishLink(e); P = e.state === 'ready' ? e : null; }
    }
    if (!P) return null;   // (compiling: the poll redraws when it lands)
    return rf.full || settled(P) ? P : null;
  }
  // All sheets' refinement: one pair of levels per cell for every sheet; a refined sub-cell is a block of 4 x 2 texels
  // per sheet (its corners: heights and normals, then values and positions), 512 blocks per two rows
  function sheetRefine(st, sp, o, P0, mode, H, mu, aspect, rf) {
    const M = o.N - 1, Mq = (M + 3) >> 2, K = o.K, b = st.box;
    if (!rf) { o.rf = null; return; }
    // (the refinement's passes: their own program, once it has settled; until then the surface is drawn as it was for
    // these heights, else unrefined)
    const P1 = sheetRF(rf, P0);
    if (!P1) { if (o.rfFor !== o.key) o.rf = null; return; }
    const rkey = o.key + '|' + rf.pxW.toPrecision(3) + '|' + rf.minPx;
    const move = rf.motion && !rf.full;
    // (moving: the levels from the midpoints and the centre, capped to the budget; at rest the lattice's, in full: a
    // mesh built while moving is rebuilt when it stops, rfLater)
    const lat = !move, lk = rkey + (lat ? '|L' : '|c');
    // (moving with a mesh over 256 cells: the sheets' base pass alone takes the frame's GPU time at Max, and a read
    // of the levels then waits for it; the base mesh while moving, refined when it stops; r2 review math-3)
    if (move && !rf.full && (o.want || 0) - 1 > 256) { if (o.rfFor !== o.key) o.rf = null; rfLater(); return; }
    if (o.rkey === rkey && o.rf && (move || !o.rf.partial)) return;
    if (move && o.rf && !o.rf.partial && o.rfFor === o.key) return;
    use(P1, sp.hom ? st.map : null);
    u1i(P1, 'uN', M + 1); u1i(P1, 'uM', M);
    u4f(P1, 'uBox', b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    u2f(P1, 'uAspect', aspect[0], aspect[1]);
    u1i(P1, 'uSheetA', sp.a); u1i(P1, 'uSheetB', sp.b); u1i(P1, 'uSheetK', K); u1i(P1, 'uSheetW', sp.W); u1i(P1, 'uTileC', o.tileC);
    u1i(P1, 'uHMode', mode); u1f(P1, 'uH', H); u1f(P1, 'uMu', mu);
    u1f(P1, 'uHClip', mode === 4 || mode === 5 ? 1e4 : 0);
    u1f(P1, 'uPxW', rf.pxW); u1f(P1, 'uCellW', 2 * Math.max(aspect[0], aspect[1]) / M); u1f(P1, 'uMinPx', rf.minPx);
    u1i(P1, 'uLat', move ? 0 : 1);
    // (the textures are made before the heights are bound: floatTex binds its new texture on the active unit, and the
    // first level pass then read an empty uT1, every cell 'not finite', level 4 everywhere, and kept it)
    if (!o.lvTex) { gl.activeTexture(gl.TEXTURE15); o.lvTex = floatTex(); o.lstTex = floatTex(); o.rfTex = floatTex(); }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, o.tex1);
    if (o.lvKey !== lk) {
      // (as landRefine: while something moves the fenced levels of an earlier key stand in, never a synchronous read)
      const got = lvReady(o, move ? null : lk);
      // (a read of another grid's levels is dropped: All sheets' M follows the sheets' count, which changes between the
      // steps of a deformation, and the levels of the former M uploaded at the new size failed every frame, r3 verify-2)
      if (got && got.length === Mq * M * 4) { o.lvRaw = got; o.lvKey = o.rbGot; o.lvM = M; }
      if (o.lvKey !== lk && move && o.rbFence && o.lvRaw && o.lvM === M) { /* one read in flight: the earlier levels */ }
      else if (o.lvKey !== lk) {
        // (pending, or a read of other levels in flight, read first (rbOf): drawn as it was for these heights, else
        // unrefined meanwhile)
        if (o.rbFence && !rf.full) { if (o.rfFor !== o.key) o.rf = null; return; }
        u1i(P1, 'uPass', 1);
        gl.activeTexture(gl.TEXTURE15);
        if (!o.lvTmp) o.lvTmp = floatTex();
        runTF(P1, empty(), gl.POINTS, Mq * M, 0, Mq * M * 16, o.lvTmp, Mq, M, gl.RGBA32F, gl.RGBA);
        const lv = lvFetch(o, lk, Mq * M * 4, rf.full, [P1]);
        if (lv) { o.lvRaw = lv; o.lvKey = lk; o.lvM = M; }
        else if (!(move && o.lvRaw && o.lvM === M)) { if (o.rfFor !== o.key) o.rf = null; return; }
      }
    }
    const nb = (lx, ly) => K << (lx + ly);
    // (blocks of 8 texels, groups on whole pairs of rows: 512 blocks per pair, 24 evaluations each)
    const cost = (lx, ly) => 24 * nb(lx, ly), rowsOf = (lx, ly, n) => 2 * Math.ceil(n * nb(lx, ly) / 512);
    // the sub-cells' passes of t's groups from group t.gi, row t.row on, up to budget evaluations (a group's rows in
    // chunks of whole pairs); -> true when every group is built
    const passes = (t, budget) => {
      const r = t.r;
      u1i(P1, 'uPass', 2);
      gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, t.lvTex);
      gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, t.lstTex);
      let spent = 0;
      while (t.gi < r.groups.length) {
        const g = r.groups[t.gi], blocks = g.n * nb(g.L[0], g.L[1]), gr = 2 * Math.ceil(blocks / 512);
        const can = Math.max(2, 2 * Math.floor((budget - spent) / (2 * 256 * 24)));
        if (spent > 0 && spent + can * 256 * 24 > budget) break;
        const r1 = Math.min(gr, t.row + can);
        u2i(P1, 'uL', g.L[0], g.L[1]); u1i(P1, 'uGE', g.E); u1i(P1, 'uTot', blocks); u1i(P1, 'uRow0', t.row);
        runTFRows(P1, RF_W * (r1 - t.row), t.rfTex, RF_W, g.y0 + t.row);
        spent += (r1 - t.row) * 256 * 24;
        g.B = g.y0 / 2 * 512;   // (its first block)
        if (r1 >= gr) { t.gi++; t.row = 0; } else { t.row = r1; break; }
      }
      return t.gi >= r.groups.length;
    };
    if (move || rf.full) {
      // moving (the moving budget) or a figure, a film, an export (in full): one frame
      if (o.nb) { rfFree(o.nb); o.nb = null; }
      // (moving, with the levels it was built from: the list stands, its sub-cells are evaluated again, as landRefine)
      const cap = move ? rfMove(o.want) : RF_REST_S;
      const keep = move && o.rf && o.rfRaw === o.lvRaw && o.rfCap === cap;
      const t = { r: keep ? o.rf : rfBuild(o, o.lvRaw, M, cost, rowsOf, cap, !move), gi: 0, row: 0, lvTex: o.lvTex, lstTex: o.lstTex, rfTex: o.rfTex };
      o.rfRaw = o.lvRaw; o.rfCap = cap;
      passes(t, Infinity);
      const r = t.r;
      r.partial = move && (r.capped || !lat);
      o.rf = r; o.rkey = rkey; o.rfFor = o.key;
      if (r.partial) rfLater();
      return;
    }
    // At rest: built over several frames, at most RF_FRAME evaluations each, into textures of its own, and swapped in
    // when complete; meanwhile the mesh drawn is kept when it is of these heights (built while moving), else the
    // surface is drawn unrefined. The budget at rest is the user's case in full (r2 review math-1: capped at rest)
    if (!o.nb || o.nb.rkey !== rkey) {
      if (o.nb) rfFree(o.nb);
      o.nb = { rkey, gi: 0, row: 0, raw: o.lvRaw };
      o.nb.r = rfBuild(o.nb, o.lvRaw, M, cost, rowsOf, RF_REST_S, true);
    }
    if (o.rfFor !== o.key) o.rf = null;
    if (!passes(o.nb, RF_FRAME)) { rfPoll(); return; }
    for (const k of ['lvTex', 'lstTex', 'rfTex']) { if (o[k]) gl.deleteTexture(o[k]); o[k] = o.nb[k]; }
    o.rfRows = o.nb.rfRows; o.lvDim = o.nb.lvDim; o.lstRows = o.nb.lstRows;
    o.rf = o.nb.r; o.rf.partial = false; o.rkey = rkey; o.rfFor = o.key;
    o.rfRaw = o.nb.raw; o.rfCap = RF_REST_S;
    o.nb = null;
    freeScratch(o);
  }
  const MATERIALS = { phase: 0, tiles: 1, plaster: 2 };
  // Geometry of the landscape block for a domain box and height scale (world units: the longer side spans [-1, 1]).
  // center / radius: the bounding sphere of the block with its floor plate, for camera fitting.
  function landGeom(box, scale) {
    const BW = box.x1 - box.x0, BH = box.y1 - box.y0, Mx = Math.max(BW, BH) || 1;
    const aspect = [BW / Mx, BH / Mx];
    const H = 0.55 * clamp(scale ?? 1, 0.05, 8);
    const floorZ = -H - 0.08;
    const ext = [aspect[0] + 0.16, aspect[1] + 0.16];
    return { aspect, H, floorZ, ext, Mx, center: [0, 0, 0.5 * (H + floorZ)], radius: Math.hypot(ext[0], ext[1], 0.5 * (H - floorZ)) };
  }
  // Camera distance at which a sphere of radius r fits a pw x ph frame (vertical fov) with a margin factor.
  function fitDist(r, fov, pw, ph, margin) {
    const asp = pw > 0 && ph > 0 ? Math.min(1, pw / ph) : 1;
    const half = Math.atan(Math.tan(0.5 * (fov || 28 * Math.PI / 180)) * Math.max(0.05, asp));
    return r / Math.sin(half) * (margin || 1.05);
  }
  // st: {map, box:{x0,x1,y0,y1}, cam, heightMode, scale, mu, material, unitLevel, sectors, cells, dpr, colors:{...},
  //      outlines:[{res, color, map, cacheKey}] (map: into the plane of the box), probe:{x, y},
  //      sheets:{W} (All sheets: every surface of the map's multivalued steps, see sheetPlan; info.sheets says what
  //      was drawn: {K, total, W, N, infinite}, null for the principal branch)}
  // map may be a homotopy (mode 1 / 2 at t): its heights are cached per t like any other map
  // the pane's last Landscape (t: when one was last asked for; key: the chain whose own surface it drew), for the cards
  const landPane = { t: -1e9, key: null };
  let landPollT = 0;
  function landPoll() {
    if (landPollT || typeof setTimeout !== 'function') return;
    landPollT = setTimeout(() => { landPollT = 0; if (api.onReady) api.onReady({ main: true }); }, 120);
  }
  function drawLandscape(st) {
    if (!ok) return null;
    lvCollect();
    const { MVP, eye } = camera(st.cam, fw, fh);
    const box = st.box;
    const BW = box.x1 - box.x0, BH = box.y1 - box.y0;
    const { aspect, H, floorZ, Mx } = landGeom(box, st.scale);
    const modeName = st.heightMode || 'log';
    const mode = { log: 0, abs: 1, re: 2, im: 3, reLin: 4, imLin: 5, reKnee: 6, imKnee: 7 }[modeName] ?? 0;
    const mu = st.mu > 0 ? st.mu : 1;
    const N = clamp(Math.round(st.cells || 256), 32, 512);
    const dpr = st.dpr || Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const C = landColors(st);
    const material = MATERIALS[st.material] ?? (st.style === 'classic' ? 0 : 0);
    const lt = { sky: toLin3(C.hemiSky), ground: toLin3(C.hemiGround) };
    const heightOf = (v) => {
      if (mode === 0) return H * (2 / Math.PI) * Math.atan(Math.log(Math.max(v, 1e-300)) / 1.4);
      if (mode === 1) return H * ((4 / Math.PI) * Math.atan(v / mu) - 1);
      if (mode >= 6) { const x = v / mu, a = Math.abs(x), c = 0.5 / Math.PI; return H * Math.sign(x) * (a <= 1 ? a : 1 + c * Math.atan((a - 1) / c)); }
      if (mode >= 4) return H * Math.max(-1.25, Math.min(1.25, v / mu));
      return H * (2 / Math.PI) * Math.atan(v / mu);
    };
    const info = { MVP, eye, aspect, floorZ, top: H, H, hs: H, heightOf, sheets: null };
    // All sheets (st.sheets: {W}): the covering surface, when the chain and the map allow it (else the principal
    // branch, info.sheets null); while its programs compile the principal branch stands in
    const sp = st.sheets ? sheetPlan(st.map, st.sheets.W, st.sheets.end) : null;
    // A step card's Landscape (st.card) waits for the pane's: its programs start once the pane has drawn this chain's
    // surface, and are taken into use once they have settled (r3: compiled alongside the pane's All sheets, they slowed
    // its link, and their first draws in later frames stalled the GPU process again, r2 review verify-2)
    const now = performance.now();
    if (!st.card) landPane.t = now;
    else if (cur.info && !sideMode) {
      // (at most 3 s from a card's first wait for this chain: a long play or orbit no longer keeps the cards empty,
      // r3 review speed-5)
      if (landPane.waitKey !== cur.key) { landPane.waitKey = cur.key; landPane.wait0 = now; }
      if (landPane.key !== cur.key && now - landPane.t < 1500 && now - landPane.wait0 < 3000) { framePending = true; landPoll(); return info; }
      if (!settled(program('landTF', st.map)) || !settled(program('land', st.map))) { framePending = true; return info; }
    }
    // (the surface's programs start compiling together; they are taken into use together, groupDone. All sheets: the
    // sheets' programs and the floor; the principal branch's start with a view that draws it, r3)
    if (cur.info && !sideMode) for (const n of sp ? ['landSheetTF', 'landSheet', 'floor'] : GROUPS[0]) getProg(n, cur, true, st.map);
    const Ls = sp ? program('landSheet', st.map) : null;   // (both sheet programs start compiling here)
    // the refinement's scale: px per world unit at the camera's fitted distance for this frame's size (not the orbit's
    // or the zoom's, so orbiting never rebuilds the mesh), quantized to quarter octaves (a resize by a few px keeps it)
    const fitD = fitDist(landGeom(box, st.scale).radius, (st.cam && st.cam.fov) || 28 * Math.PI / 180, fw, fh, 1.05);
    const pxW0 = fh / (2 * Math.tan(0.5 * ((st.cam && st.cam.fov) || 28 * Math.PI / 180)) * fitD);
    const dbg = {};
    // At rest (and in figures, films and exports) the scale is the camera's at the block's nearest point, when that is
    // nearer than the fitted distance (zoomed in, or the near side of the block in perspective): a finished zoom or
    // orbit rebuilds once. While something moves the fitted scale stands, and a mesh built at rest for the same heights
    // is kept (orbiting and zooming never rebuild). r2 review math-5
    let pxS = pxW0;
    if (!st.motion || st.full) {
      const ga = landGeom(box, st.scale);
      const q = [clamp(eye[0], -ga.ext[0], ga.ext[0]), clamp(eye[1], -ga.ext[1], ga.ext[1]), clamp(eye[2], ga.floorZ, ga.H)];
      const dN = Math.max(Math.hypot(eye[0] - q[0], eye[1] - q[1], eye[2] - q[2]), 0.15 * fitD);
      pxS = Math.max(pxW0, fh / (2 * Math.tan(0.5 * ((st.cam && st.cam.fov) || 28 * Math.PI / 180)) * dN));
    }
    const rf = st.refine === false || dbg.noRef ? null : { pxW: Math.pow(2, Math.round(4 * Math.log2(Math.max(pxS, 1))) / 4), motion: !!st.motion, full: !!st.full, minPx: dbg.minPx || 0.1, Lp: getProg('land', cur, false, st.map), Ls };
    let hs = sp ? sheetHeights(st, sp, N, mode, H, mu, aspect, rf) : null;
    if (!Ls) hs = null;
    // (while the sheets' programs compile, the principal branch stands in only with programs that have run before, an
    // earlier version of the chain's: a formula's first All-sheets Landscape drew its principal branch with programs of
    // its own first, and the GPU process stalled once for them and once more for the sheets', r2 review verify-2)
    const warm = (name) => { const P = readyProg(name, st.map); return !!(P && P.used1); };
    const hd = hs || (sp && !Ls && !(warm('land') && warm('landTF')) ? null : landHeights(st, N, mode, H, mu, aspect, rf));
    if (!hd) return info;
    // (the pane's other surface keeps its heights, not its refinement: toggling All sheets held both, r3 review speed-4)
    if (!st.card) {
      if (hs) { const lp = lands.get(N); if (lp && lp.lvTex) { rfFree(lp); freeScratch(lp); } }
      else if (landS && landS.lvTex) { rfFree(landS); freeScratch(landS); }
    }
    if (hs) info.sheets = { K: hs.K, total: sp.total, W: sp.W, N: hs.N, infinite: sp.infinite, hom: !!sp.hom };
    const ext = [aspect[0] + 0.16, aspect[1] + 0.16];
    const camD = Math.hypot(eye[0] - (st.cam.tx || 0), eye[1] - (st.cam.ty || 0), eye[2] - (st.cam.tz || 0));
    const fogNear = Math.max(0.01, camD - 1.6), fogFar = camD + 1.6;
    const common = (P) => {
      uM4(P, 'uMVP', MVP);
      u3(P, 'uEye', eye);
      u1f(P, 'uDpr', dpr);
      u1i(P, 'uN', hd.N);
      u4f(P, 'uBox', box.x0, box.y0, BW, BH);
      u2f(P, 'uAspect', aspect[0], aspect[1]);
      u1f(P, 'uH', H);
      u1f(P, 'uFloorZ', floorZ);
      u1i(P, 'uMaterial', material);
      u3(P, 'uPlaster', C.plaster);
      u3(P, 'uModLine', C.modLine);
      u3(P, 'uArgLine', C.argLine);
      // (the figure's art layer: no white sea-level line, |F| = 1 is an ordinary contour of the ln|F| family)
      u1f(P, 'uSea', st.seaLine === false ? 0 : 1);
      u3(P, 'uFogCol', C.landBottom);
      u1f(P, 'uFogNear', fogNear);
      u1f(P, 'uFogFar', fogFar);
      dcUniforms(P, { style: 'enhanced', sectors: st.sectors || 12, dark: C.dark }, dpr);
      u1i(P, 'uSheetK', hs ? hs.K : 0); u1i(P, 'uTileC', hs ? hs.tileC : 1);
      if (hs) { u1i(P, 'uSheetA', hs.a); u1i(P, 'uSheetB', hs.b); u1i(P, 'uSheetW', hs.W); }
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, hd.tex1);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, hs ? hd.tex1 : hd.tex2);
    };
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    gl.bindVertexArray(empty());
    // floor plate: faint graph paper, phase print, contact shading. Seen from above it lies under the surface; seen
    // from below the plate (the camera under it) it is drawn last, as a light veil, so the underside stays visible.
    const below = eye[2] < floorZ;
    const floorPass = (alpha) => {
      const Fp = program('floor', st.map);
      if (!Fp) return;
      use(Fp, st.map);
      common(Fp);
      u2f(Fp, 'uExt', ext[0], ext[1]);
      u3(Fp, 'uFloorCol', C.floor); u3(Fp, 'uMinor', C.minor); u3(Fp, 'uMed', C.medium); u3(Fp, 'uMajor', C.major);
      u3(Fp, 'uShadow', C.shadow); u1f(Fp, 'uShadowA', C.shadowA);
      u1f(Fp, 'uPrint', material === 2 || st.floorPrint === false ? 0 : 1);
      u1f(Fp, 'uPlateA', alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    if (!below) floorPass(0.8);
    gl.disable(gl.BLEND);
    // relief: an open sheet, both sides drawn (no skirt walls, no block)
    const Lp = hs ? (mode === 4 || mode === 5 ? program('landSheetC', st.map) : Ls) : program('land', st.map);
    // (asked for before Lp is bound: a program that finishes its link here binds itself)
    const LR = Lp && hd.rf && hd.rf.groups.length && !hs ? program('landR') : null;
    // (moving, the principal surface: its steep base triangles by landB, once the refinement's programs have run, STEEP;
    // not while the mesh built at rest for these heights stands, an orbit or a zoom: its walls are refined)
    const LB = Lp && !hs && rf && st.motion && !st.full && rfWarmAll && !(hd.rf && !hd.rf.partial && hd.rfFor === hd.key) ? program('landB') : null;
    if (Lp) {
      use(Lp, st.map);
      common(Lp);
      lightUniforms(Lp, lt, material === 2 ? 0.05 : 0.16, material === 2 ? 12 : 48, 0.10);
      u3(Lp, 'uCut', C.cut);
      // (principal: up to 3 triangles where a real cut splits one; All sheets with linear heights: the triangle
      // clipped at the block, up to 3)
      u1i(Lp, 'uHMode', mode); u1f(Lp, 'uMu', mu);
      u2f(Lp, 'uAspect', aspect[0], aspect[1]);
      const clip = !!hs && (mode === 4 || mode === 5);
      if (hs) {
        u1i(Lp, 'uClip', clip ? 1 : 0);
        // the per-sheet cue (notes/landscape-walls/USER-ADDENDUM.md): strongest where a deformation's surfaces nearly
        // coincide (t near 0), faint at t = 1 and for a map's sheets at rest
        const cm = st.map && (st.map.mode === 1 || st.map.mode === 3) ? clamp(+st.map.t || 0, 0, 1) : 1;
        const cue = dbg.cue || st.sheetCue || 'tint';
        // (OKLab lightness x (1 +- uCue): +-14 % at t = 0, +-4 % at t = 1 and for a map's sheets; r2 review pictures-1)
        u1f(Lp, 'uCue', cue === 'none' ? 0 : 0.14 - 0.10 * cm * cm * (3 - 2 * cm));
        u1i(Lp, 'uCueK', hs.K);
        u1f(Lp, 'uZBias', 4e-6);
        u1i(Lp, 'uSheetK', hs.K);
      } else {
        u1i(Lp, 'uCuts', hd.cuts || 0);
        for (let d = 0; d < 3; d++) { gl.activeTexture(gl.TEXTURE5 + d); gl.bindTexture(gl.TEXTURE_2D, hd.edges[d]); }
      }
      // the base cells, then each group's sub-cells (REFINE). All sheets: the same program, sub-cells under about a
      // pixel taking F from their corners (uVW) on screen; the principal surface: a program without the chain (landR,
      // F from the vertices), drawn once it has compiled (until then the cells are drawn unrefined)
      const R = hd.rf && hd.rf.groups.length && (hs || LR) ? hd.rf : null;
      u1i(Lp, 'uM', hd.N - 1); u1i(Lp, 'uRef', 0); u1i(Lp, 'uRefOn', R ? 1 : 0); u1i(Lp, 'uVW', 0); u1i(Lp, 'uSteep', LB ? 1 : 0);
      if (R) {
        gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_2D, hd.lvTex);
        gl.activeTexture(gl.TEXTURE9); gl.bindTexture(gl.TEXTURE_2D, hd.lstTex);
        gl.activeTexture(gl.TEXTURE10); gl.bindTexture(gl.TEXTURE_2D, hd.rfTex);
      }
      gl.drawArraysInstanced(gl.TRIANGLES, 0, !hs || clip ? 9 : 3, (hs ? hs.K : 1) * 2 * (hd.N - 1) * (hd.N - 1));
      const cellPx = rf ? rf.pxW * 2 * Math.max(aspect[0], aspect[1]) / (hd.N - 1) : 0;
      if (LB) {
        use(LB);
        common(LB);
        lightUniforms(LB, lt, material === 2 ? 0.05 : 0.16, material === 2 ? 12 : 48, 0.10);
        u3(LB, 'uCut', C.cut); u1i(LB, 'uHMode', mode); u1f(LB, 'uMu', mu); u2f(LB, 'uAspect', aspect[0], aspect[1]);
        u1i(LB, 'uM', hd.N - 1); u1i(LB, 'uVW', 1); u1i(LB, 'uCuts', hd.cuts || 0); u1i(LB, 'uRefOn', R ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6 * (hd.N - 1) * (hd.N - 1));
      }
      if (R && LR) {
        use(LR);
        common(LR);
        lightUniforms(LR, lt, material === 2 ? 0.05 : 0.16, material === 2 ? 12 : 48, 0.10);
        u3(LR, 'uCut', C.cut); u1i(LR, 'uHMode', mode); u1f(LR, 'uMu', mu); u2f(LR, 'uAspect', aspect[0], aspect[1]);
        u1i(LR, 'uM', hd.N - 1); u1i(LR, 'uVW', 1); u1i(LR, 'uCuts', hd.cuts || 0);
      }
      const PR = LR || Lp;
      if (R) for (const g of R.groups) {
        const n = 1 << (g.L[0] + g.L[1]);
        u1i(PR, 'uRef', 1); u2i(PR, 'uL', g.L[0], g.L[1]); u1i(PR, 'uRefE', g.E); u1i(PR, 'uRefT', hs ? g.y0 / 2 * 512 : g.y0 * RF_W);
        if (hs) u1i(PR, 'uVW', !st.full && !clip && cellPx / (1 << Math.min(g.L[0], g.L[1])) < 1.5 ? 1 : 0);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, clip ? 9 : 3, g.n * n * 2 * (hs ? hs.K : 1));
      }
      info.refine = R ? { groups: R.groups.map((g) => [g.L[0], g.L[1], g.n]), capped: R.capped, Lc: R.Lc, pxW: rf && rf.pxW } : null;
      Lp.drawnOnce = true;
      if (hs && Ls) Ls.drawnOnce = true;
      if (!st.card && Lp.ch === cur) landPane.key = cur.key;
      lvTailMark();
    }
    if (below) {
      gl.enable(gl.BLEND);
      gl.depthMask(false);
      floorPass(0.22);
      gl.depthMask(true);
    }
    gl.enable(gl.BLEND);
    gl.bindVertexArray(null);
    // the domain's footprint on the plate (a faint rectangle; the surface itself has no sides)
    const ax = aspect[0], ay = aspect[1];
    const cs = [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]];
    let far = 0, fd = -1;
    cs.forEach((p, i) => { const d = Math.hypot(p[0] - eye[0], p[1] - eye[1]); if (d > fd) { fd = d; far = i; } });
    const boxM = [];
    for (let i = 0; i < 4; i++) boxM.push(segM([cs[i][0], cs[i][1], floorZ], [cs[(i + 1) % 4][0], cs[(i + 1) % 4][1], floorZ], 0.5 * dpr));
    gl.depthMask(false);
    drawMarks(MVP, boxM, C.box, below ? 0.4 : 0.8, { zBias: 0.0002 });
    info.backCorner = [cs[far][0], cs[far][1]];
    // source outlines printed on the floor plate: clipped to the plate, fading with its outer rim, and hidden
    // wherever the surface covers them (plain depth test: never drawn through the relief)
    const mg = 0.08 * Mx;
    const plate = { x0: box.x0 - mg, y0: box.y0 - mg, x1: box.x1 + mg, y1: box.y1 + mg, w: 0.9 * mg };
    gl.depthFunc(gl.LEQUAL);
    for (const o of st.outlines || []) {
      if (!o || !o.res) continue;
      drawLines(o.res, { map: o.map || null, cacheKey: o.cacheKey || null, dpr, M: 4, width: 1.25 * dpr, color: col3(o.color, C.modLine), alpha: below ? 0.45 : 1, fade: plate, floor: { MVP, box, aspect, floorZ, clip: plate } });
    }
    // unit level: the plane h(|F| = 1)
    if (st.unitLevel) {
      const Up = program('ulevel');
      if (Up) {
        use(Up);
        uM4(Up, 'uMVP', MVP);
        u2f(Up, 'uAspect', ax, ay);
        u1f(Up, 'uZ', heightOf(1));
        u3(Up, 'uColor', C.accent);
        u1f(Up, 'uDpr', dpr);
        gl.bindVertexArray(empty());
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
      }
    }
    // probe needle from the floor to (z, h(z))
    if (st.probe) {
      const Pp = program(hs ? 'probeSheet' : 'probe', st.map);
      if (Pp) {
        use(Pp, st.map);
        if (hs) { u1i(Pp, 'uSheetA', hs.a); u1i(Pp, 'uSheetB', hs.b); u1i(Pp, 'uSheetW', hs.W); }
        uM4(Pp, 'uMVP', MVP);
        u2f(Pp, 'uPx', fw, fh);
        u1f(Pp, 'uZBias', 0);
        u2f(Pp, 'uProbe', st.probe.x ?? st.probe.re ?? st.probe[0], st.probe.y ?? st.probe.im ?? st.probe[1]);
        u4f(Pp, 'uBox', box.x0, box.y0, BW, BH);
        u2f(Pp, 'uAspect', ax, ay);
        u1f(Pp, 'uFloorZ', floorZ);
        u1f(Pp, 'uDpr', dpr);
        u1i(Pp, 'uHMode', mode); u1f(Pp, 'uH', H); u1f(Pp, 'uMu', mu);
        u3(Pp, 'uColor', C.probe);
        gl.bindVertexArray(empty());
        // inside the block the needle is hidden: shown ghosted, so the ring on the surface leads
        const nI = hs ? hs.K : 1;
        gl.depthFunc(gl.GREATER); u1f(Pp, 'uAlpha', 0.2); gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, nI);
        gl.depthFunc(gl.LEQUAL); u1f(Pp, 'uAlpha', 1); gl.drawArraysInstanced(gl.TRIANGLES, 0, 18, nI);
        gl.bindVertexArray(null);
      }
    }
    resetState();
    return info;
  }

  // SPEC 4.8 on a globe (P3): the scissor [x, y, w, h] (device px of the current pane, bottom-left origin, padded by pad)
  // of the image on the sphere of a w-box b, seen through MVP from eye; null when no scissor can be promised (the
  // image may reach the far side or the silhouette) or none is needed (it covers the pane); [0, 0, 0, 0] when it misses
  // the pane. The box's four sides (circles on the sphere, under the conjugate lift) are lifted and projected,
  // subdivided until consecutive screen points are under 2 px apart. Every boundary point must face the eye (by a
  // margin), and the sphere's point farthest from the eye must lie outside the box: then the box's image is a disc
  // inside the visible hemisphere, whose projection is bounded by its projected boundary
  function globeScissorOf(b, MVP, eye, pad = 4) {
    if (!b || ![b.x0, b.x1, b.y0, b.y1].every(Number.isFinite) || b.x1 < b.x0 || b.y1 < b.y0) return null;
    const E = Math.hypot(eye[0], eye[1], eye[2]);
    if (!(E > 1.0001)) return null;
    const F = [-eye[0] / E, -eye[1] / E, -eye[2] / E];
    if (F[2] < 1 - 1e-9) {
      const fx = F[0] / (1 - F[2]), fy = -F[1] / (1 - F[2]);
      if (fx >= b.x0 && fx <= b.x1 && fy >= b.y0 && fy <= b.y1) return null;
    }
    const lift = (x, y) => {
      const q = x * x + y * y;
      if (q > 1) { const iq = 1 / q; return [2 * x * iq / (1 + iq), -2 * y * iq / (1 + iq), (1 - iq) / (1 + iq)]; }
      return [2 * x / (q + 1), -2 * y / (q + 1), (q - 1) / (q + 1)];
    };
    const at = (x, y) => {
      const p = lift(x, y), v = [eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]];
      if (!((v[0] * p[0] + v[1] * p[1] + v[2] * p[2]) > 0.02 * Math.hypot(v[0], v[1], v[2]))) return null;
      const c = M4.apply(MVP, p);
      if (!(c[3] > 1e-6)) return null;
      return [(c[0] / c[3] * 0.5 + 0.5) * fw, (c[1] / c[3] * 0.5 + 0.5) * fh];
    };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
    const add = (q) => { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; };
    for (const [ax, ay, bx, by] of [[b.x0, b.y0, b.x1, b.y0], [b.x1, b.y0, b.x1, b.y1], [b.x1, b.y1, b.x0, b.y1], [b.x0, b.y1, b.x0, b.y0]]) {
      const P = (t) => at(ax + (bx - ax) * t, ay + (by - ay) * t);
      const qa = P(0), qb = P(1);
      if (!qa || !qb) return null;
      add(qa); add(qb);
      const stack = [[0, 1, qa, qb, 0]];
      while (stack.length) {
        const [ta, tb, sa, sb, d] = stack.pop();
        if (Math.hypot(sb[0] - sa[0], sb[1] - sa[1]) <= 2 || d >= 14) continue;
        if (++n > 4096) return null;
        const tm = 0.5 * (ta + tb), sm = P(tm);
        if (!sm) return null;
        add(sm);
        stack.push([ta, tm, sa, sm, d + 1], [tm, tb, sm, sb, d + 1]);
      }
    }
    const cx0 = Math.max(0, Math.floor(x0) - pad), cy0 = Math.max(0, Math.floor(y0) - pad);
    const cx1 = Math.min(fw, Math.ceil(x1) + pad), cy1 = Math.min(fh, Math.ceil(y1) + pad);
    if (cx1 <= cx0 || cy1 <= cy0) return [0, 0, 0, 0];
    if (cx0 <= 0 && cy0 <= 0 && cx1 >= fw && cy1 >= fh) return null;
    return [cx0, cy0, cx1 - cx0, cy1 - cy0];
  }
  // st: {map, mode ('image'|'color'), cam, style, sectors, grid, colors:{plane, gridMajor, axis, ink, accent?, hemiSky?, hemiGround?},
  //      regions:[{res, st} | {inv, fwd: [{res, st}], onResult}], lines:[{res, st}], plane:bool, probe:{w}, dpr,
  //      pre:{map, targets, halo?, haloA?, wGrid?} (drawPreimage over the globe)}
  // A region entry with inv is an exact image (SPEC 4.6, 10.3): drawInverse's st (viewKind 'globe' and this frame's
  // camera are added here, and the scissor of inv.globeBox, a w-box of the image, when one can be promised), drawn at
  // its place in the list, so inverse and forward shapes interleave in list order; when it is not drawn ('pending',
  // 'error') its forward draws fwd stand in, at the same place. onResult(res) reports the outcome to the app.
  // map, and the maps of regions and lines, may be homotopies (mode 1 / 2 at t; without a cacheKey they are evaluated
  // into per-resource scratch textures, so playback adds no cache entries)
  function drawSphere(st) {
    if (!ok) return null;
    const { MVP, eye } = camera(st.cam, fw, fh);
    const c = st.colors || {};
    const plane = col3(c.plane, col3(st.shell, '#FCFDFD'));
    const dark = lum(plane) < 0.18;
    const gridMajor = col3(c.gridMajor, dark ? '#21404F' : '#B5D4E0');
    const axis = col3(c.axis, col3(st.ink, dark ? '#94A8B3' : '#2E3D47'));
    const accent = col3(c.accent, dark ? '#52B7D3' : '#0A6A87');
    const dpr = st.dpr || Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const lt = defaultLight(dark);
    if (c.hemiSky) lt.sky = toLin3(col3(c.hemiSky));
    if (c.hemiGround) lt.ground = toLin3(col3(c.hemiGround));
    sceneLight = lt;
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.depthMask(true);
    const phase = st.mode === 'color';
    const P = program(phase ? 'sphereP' : 'sphere', st.map);
    if (P) {
      use(P, st.map);
      uM4(P, 'uMVP', MVP);
      u3(P, 'uEye', eye);
      dcUniforms(P, { style: st.style, sectors: st.sectors, grid: st.grid, plane, ink: c.ink, dark }, dpr);
      u3(P, 'uPlaneCol', plane);
      u3(P, 'uGridMaj', gridMajor);
      u3(P, 'uAxisCol', axis);
      // the lattice's tiers in the grid colour (its coverage is what the shader uses)
      u1i(P, 'uNet', st.net === 'cart' ? 1 : st.net === 'polar' ? 0 : 2);
      u3(P, 'uMinor', gridMajor); u3(P, 'uMed', gridMajor); u3(P, 'uMajor', gridMajor);
      lightUniforms(P, lt, 0.18, 40, 0.12);
      const g = sphere();
      gl.disable(gl.BLEND);
      gl.bindVertexArray(g.vao);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      gl.enable(gl.BLEND);
    }
    // st.pre: target preimages over the globe (drawPreimage's st without view: {map, targets, halo, haloA, wGrid})
    if (st.pre && P) drawPreimage(Object.assign({}, st.pre, { sphere: { MVP, eye }, dpr, view: null }));
    // lifted regions and their edges: tested against the globe, never against each other (a casing written to
    // depth would otherwise hide parts of its own stroke)
    gl.depthMask(false);
    for (const r of st.regions || []) {
      if (r.inv) {
        let res = 'error';
        try {
          const sc = r.inv.globeBox ? globeScissorOf(r.inv.globeBox, MVP, eye, 4) : null;
          res = drawInverse(Object.assign({}, r.inv, { viewKind: 'globe', sphere: { MVP, eye }, scissor: sc }));
        } catch (err) { res = 'error'; if (r.onError) r.onError(err); }
        gl.depthMask(false);
        if (r.onResult) r.onResult(res);
        if (res === 'drawn') continue;
        for (const f of r.fwd || []) { if (f.pre) drawPreMapped(f.pre, Object.assign({}, f.st, { sphere: { MVP, eye } })); else drawRegion(f.res, Object.assign({}, f.st, { sphere: { MVP, eye } })); }
        continue;
      }
      if (r.pre) { drawPreMapped(r.pre, Object.assign({}, r.st, { sphere: { MVP, eye } })); continue; }
      drawRegion(r.res, Object.assign({}, r.st, { sphere: { MVP, eye } }));
    }
    for (const l of st.lines || []) drawLines(l.res, Object.assign({}, l.st, { sphere: { MVP, eye } }));
    // st.post: drawPreimage passes over everything drawn so far (P3b: the targets on the w-globe and a draft, each
    // exact per pixel through the identity map)
    for (const q of st.post || []) if (q && P) drawPreimage(Object.assign({}, q, { sphere: { MVP, eye }, dpr, view: null }));
    // equatorial plane, depth-clipped so the sphere sits half through it
    if (st.plane) {
      const Dp = program('disc');
      if (Dp) {
        use(Dp);
        uM4(Dp, 'uMVP', MVP);
        u1f(Dp, 'uR', 2.4);
        u1f(Dp, 'uDpr', dpr);
        u3(Dp, 'uPlaneCol', plane);
        u3(Dp, 'uAxisCol', axis);
        u3(Dp, 'uMinor', gridMajor); u3(Dp, 'uMed', gridMajor); u3(Dp, 'uMajor', gridMajor);
        gl.bindVertexArray(empty());
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        gl.bindVertexArray(null);
      }
      // projection ray N -> sphere point -> plane point
      const pw = st.probe && st.probe.w;
      if (pw) {
        const x = pw[0] ?? pw.re ?? pw.x, y = pw[1] ?? pw.im ?? pw.y;
        if (Number.isFinite(x) && Number.isFinite(y) && Math.hypot(x, y) < 1e6) {
          const q = x * x + y * y;
          // (the conjugate lift: the plane point of the projection ray is (x, -y, 0))
          const S = [2 * x / (q + 1), -2 * y / (q + 1), (q - 1) / (q + 1)], N = [0, 0, 1], Pl = [x, -y, 0];
          const hw = 0.5 * dpr;
          // N, S and Pl are collinear: one segment from N to the farther of the two
          const far = q < 1 ? S : Pl;
          drawMarks(MVP, [segM(N, far, hw), dotM(N, 2.5 * dpr), dotM(S, 2.5 * dpr), dotM(Pl, 2.5 * dpr)], accent, 1, { xray: true });
        }
      }
    }
    // silhouette: the circle of tangency seen from the eye, 1.25 px axis at 50%
    const D2 = eye[0] * eye[0] + eye[1] * eye[1] + eye[2] * eye[2];
    if (D2 > 1.0001) {
      const D = Math.sqrt(D2), e = eye.map((x) => x / D);
      const ctr = eye.map((x) => x / D2), rho = Math.sqrt(1 - 1 / D2);
      const up = Math.abs(e[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      let u = [up[1] * e[2] - up[2] * e[1], up[2] * e[0] - up[0] * e[2], up[0] * e[1] - up[1] * e[0]];
      const ul = Math.hypot(...u); u = u.map((x) => x / ul);
      const w = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]];
      const pt = (t) => [0, 1, 2].map((k) => ctr[k] + rho * (Math.cos(t) * u[k] + Math.sin(t) * w[k]));
      const sil = [];
      for (let i = 0; i < 160; i++) sil.push(segM(pt(2 * Math.PI * i / 160), pt(2 * Math.PI * (i + 1) / 160), 0.625 * dpr));
      drawMarks(MVP, sil, axis, 0.5, { once: true });   // last: it writes depth
    }
    resetState();
    return { MVP, eye };
  }

  // =================================================================================================================
  // Exact images: the inverse renderer (SPEC 4.2-4.5, 4.7, 4.8, 10.12)
  // =================================================================================================================
