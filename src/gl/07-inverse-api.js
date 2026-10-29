  // ---- shape records (4.3): drawPreimage's kind / A / B, plus the clip primitive and the polygon vertices ----
  const PACK_W = 1024;                  // texels per row of the frame's record texture
  const INV_POLY_MAX = 64;
  // the clip primitive of Region.clipPrimitive as texels: header (nIn, nHole), then 2 texels per piece
  const BIGF = 1e30, fcl = (x) => (x >= BIGF ? BIGF : x <= -BIGF ? -BIGF : x);
  function packPrim(prim, out) {
    const ins = prim ? prim.in || [] : [], holes = prim && prim.hole ? prim.hole : [];
    out.push(ins.length, holes.length, 0, 0);
    for (const pc of ins.concat(holes)) {
      if (pc.t === 'disc') out.push(1, pc.c[0], pc.c[1], pc.r, 0, 0, 0, 0);
      else if (pc.t === 'box') out.push(2, fcl(pc.x0), fcl(pc.x1), 0, fcl(pc.y0), fcl(pc.y1), 0, 0);
      else if (pc.t === 'half') out.push(3, pc.a[0], pc.a[1], 0, pc.d[0], pc.d[1], 0, 0);
      else if (pc.t === 'g') {
        let G = pc.G;
        if (formAnchor && typeof Constr !== 'undefined' && Constr.reanchor) G = Constr.reanchor(G, formAnchor);
        out.push(4, G.o[0], G.o[1], G.A, G.B[0], G.B[1], G.C, 0);
      }
      else out.push(0, 0, 0, 0, 0, 0, 0, 0);
    }
    return 1 + 2 * (ins.length + holes.length);       // texels: the header, then 2 per piece
  }
  let invTex = null, invTexKey = '';
  let pack = null;                      // the frame's records: {recs: Map(id -> rec), forms, formsKey, data}
  // formula bundle (4.4): the first four visible formula shapes take slots 0-3; an edit is debounced 300 ms
  const FORM_DEBOUNCE = 300;
  const hashStr = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; };
  let bundle = { srcs: [], key: hashStr(''), exprs: [], ids: [] }, bundleWant = null, bundleT = 0, bundleTimer = 0;
  // GLR.packShapes(list, opts) -> {recs, forms, formsKey}: packs every area shape of the frame once (one texture
  // upload when the records changed). rec (per shape id): {offset, kind, complement, formSlot, ok, reason, pending}.
  // ok false: the shape cannot be drawn inverse (more than 64 polygon vertices, a fifth formula shape, a formula
  // whose GLSL failed); pending: a formula edited within the last 300 ms (draw it forward meanwhile).
  function packShapes(list, opts = {}) {
    const now = opts.now ?? performance.now();
    const recs = new Map(), data = [];
    const want = [], wantExpr = [], wantIds = [];
    for (const s of list || []) {
      if (!s || s.visible === false || !TKIND[s.kind] || TKIND[s.kind] > 10) continue;
      const gk = gKind(s);
      const rec = { offset: 0, kind: gk || TKIND[s.kind], complement: gk ? false : !!s.complement, formSlot: -1, ok: true, reason: null, pending: false };
      recs.set(s.id, rec);
      let prim = null;
      try { prim = typeof Region !== 'undefined' && Region.clipPrimitive ? Region.clipPrimitive(s) : null; } catch (e) { prim = null; }
      const pk = packShape(s);
      if (!pk) { rec.ok = false; rec.reason = 'shape'; continue; }
      rec.A = pk.A; rec.B = pk.B;
      if (s.kind === 'polygon' && pk.pts.length > INV_POLY_MAX) { rec.ok = false; rec.reason = `polygon with more than ${INV_POLY_MAX} vertices`; }
      if (s.kind === 'formula') {
        if (want.length >= MAX_INV_FORMS) { rec.ok = false; rec.reason = 'fifth formula shape'; }
        else {
          const src = typeof GLChain !== 'undefined' && GLChain.levelGLSL ? GLChain.levelGLSL(s.expr, 'ilev' + want.length) : null;
          if (!src || !src.ok) { rec.ok = false; rec.reason = 'formula GLSL'; }
          else { rec.formSlot = want.length; want.push(src.source); wantExpr.push(String(s.expr)); wantIds.push(s.id); }
        }
      }
      // Lambda rule data (4.3): inside at z = 0; boundary through 0 (a half-plane line within 1e-12 |a| of 0, a sector
      // apex at 0)
      let at0 = 0, thru0 = 0;
      try { at0 = Region.levelOf(s)(CX.C(0, 0)) > 0 ? 1 : 0; } catch (e) { at0 = 0; }
      if (s.kind === 'halfplane') {
        const ax = s.a[0], ay = s.a[1], dx = s.b[0] - ax, dy = s.b[1] - ay, L = Math.hypot(dx, dy) || 1;
        thru0 = Math.abs((dx * ay - dy * ax) / L) <= 1e-12 * Math.hypot(ax, ay) ? 1 : 0;
      } else if (s.kind === 'sector') thru0 = Math.hypot(s.c[0], s.c[1]) <= 1e-12 ? 1 : 0;
      if (gk) thru0 = s._g.thru0 ? 1 : 0;             // v16: from incidence [C9]
      rec.C = [at0, thru0, 0, 0];
      rec.offset = data.length / 4;
      const n0 = data.length, n = packPrim(prim, data);
      rec.clipH = [data[n0], data[n0 + 1]];
      rec.clipU = new Float32Array(64);
      rec.clipU.set(data.slice(n0 + 4, n0 + 4 + 64));
      // the early-out box (polygons, bounded formulas); x0 > x1: none
      rec.box = [1, 1, 0, 0];
      if (!s.complement && (s.kind === 'polygon' || s.kind === 'formula')) {
        let bb = null;
        try { bb = s.kind === 'polygon' ? Region.bboxOf(s) : Region.formulaBox(s); } catch (e) { bb = null; }
        if (bb && [bb.x0, bb.x1, bb.y0, bb.y1].every(Number.isFinite) && bb.x0 <= bb.x1 && bb.y0 <= bb.y1) rec.box = [bb.x0, bb.y0, bb.x1, bb.y1];
      }
      rec.ptsOff = n;
      rec.nPts = 0;
      if (s.kind === 'polygon' && rec.ok) { rec.nPts = pk.pts.length; for (const p of pk.pts) data.push(p[0], p[1], 0, 0); }
    }
    // the formula bundle: an edit of the same formula shapes (same ids in the same slots) waits FORM_DEBOUNCE ms after
    // the last change, while the edited shapes are pending (forward) and the others keep the current program; a load,
    // an added or a removed formula shape switches at once
    const wkey = hashStr(want.join(''));
    if (wkey !== bundle.key) {
      const sameIds = bundle.ids && bundle.ids.length === wantIds.length && bundle.ids.every((id, i) => id === wantIds[i]);
      if (!bundleWant || bundleWant.key !== wkey) { bundleWant = { srcs: want, key: wkey, exprs: wantExpr, ids: wantIds }; bundleT = now; }
      if (!sameIds || opts.debounce === false || now - bundleT >= FORM_DEBOUNCE) { bundle = bundleWant; bundleWant = null; }
      else {
        for (const r of recs.values()) if (r.formSlot >= 0 && bundle.exprs[r.formSlot] !== wantExpr[r.formSlot]) { r.pending = true; r.ok = false; r.reason = 'formula edit pending'; }
        if (!bundleTimer && typeof setTimeout === 'function') bundleTimer = setTimeout(() => { bundleTimer = 0; if (api.onReady) api.onReady({ main: true }); }, FORM_DEBOUNCE + 20);
      }
    } else bundleWant = null;
    const fd = new Float32Array(Math.max(4, data.length));
    fd.set(data);
    pack = { recs, forms: bundle.srcs, formsKey: bundle.key, data: fd, texels: data.length / 4 };
    return { recs, forms: pack.forms, formsKey: pack.formsKey };
  }
  function uploadPack() {
    if (!pack) return;
    const texels = Math.max(1, pack.texels), rows = Math.ceil(texels / PACK_W);
    const key = pack.data.length + '|' + hashStr(Array.prototype.join.call(pack.data, ','));
    gl.activeTexture(gl.TEXTURE4);
    if (!invTex) invTex = floatTex();
    gl.bindTexture(gl.TEXTURE_2D, invTex);
    if (key === invTexKey) return;
    const buf = new Float32Array(PACK_W * rows * 4);
    buf.set(pack.data.subarray(0, Math.min(pack.data.length, buf.length)));
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, PACK_W, rows, 0, gl.RGBA, gl.FLOAT, buf);
    invTexKey = key;
  }
  const formsSrc = (srcs) => (srcs.length ? srcs.join('') + 'float formulaLevel(int f, vec2 z) {\n' + srcs.map((_, i) => `  if (f == ${i}) return ilev${i}(z);\n`).join('') + '  return -1.0;\n}\n' : '');

  // ---- inverse programs (4.4): keyed inv|<inverse key>|<formula bundle>|B<n> (invS on the globe), in progs (so
  // context loss clears them) with their own LRU of 8 that never evicts a program drawn in this or the last frame.
  // Never a history stand-in. A failed compile is silent (one console line, no frameErr / lastError) and marks the
  // chain structure ineligible for the session.
  const INV_KEEP = 8;
  let invFrame = 0;                     // begin() / viewport() count: "this or the previous frame" = the last 4
  const invFailed = new Set();          // inverse keys whose program failed (session)
  function invProgKey(inv, B, globe, formsKey) { return `${globe ? 'invS' : 'inv'}|${inv.key}|${formsKey}|B${B}`; }
  // coldNonce (tests: the perf suite's cold-compile units, SPEC 13.12): every new inverse program gets a uniform the
  // compilers cannot fold, so its text is new to the machine (macOS caches compiled Metal libraries system-wide, and
  // ANGLE strips comments): its compile and first draw are cold, as on a user's first visit
  let coldNonce = 0;
  function invSources(info, B, globe, forms, extra) {
    const vs = globe ? SPHERE_VS : QUAD_VS;
    const L = typeof GLChain !== 'undefined' ? GLChain.LIB : '';
    let main = extra && extra.main ? extra.main : INV_MAIN(globe), pre = (globe ? INV_GLOBE_PRE : '') + (extra && extra.pre || '');
    if (coldNonce && !extra) {
      const tag = `uIxNonce${coldNonce++}_${Math.floor(Math.random() * 1e9)}`;
      pre += `uniform float ${tag};\n`;
      main = main.replace('  invWalk(w);', `  w.x += ${tag};\n  invWalk(w);`);
    }
    const fs = pre + L + info.inverse.lib + UTIL + (globe ? SHADE : '') + INV_HEAD(B, formsSrc(forms)) + info.inverse.walker + main;
    return [HEAD + vs, HEAD + fs];
  }
  function finishInv(e) {
    if (gl.isContextLost && gl.isContextLost()) return;      // not a failure: the restore recompiles
    const p = e.p;
    const linked = gl.getProgramParameter(p, gl.LINK_STATUS);
    profWaited(e);
    if (!linked) {
      const log = (!gl.getShaderParameter(e.vs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(e.vs))
        || (!gl.getShaderParameter(e.fs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(e.fs)) || gl.getProgramInfoLog(p) || 'link failed';
      gl.deleteShader(e.vs); gl.deleteShader(e.fs); gl.deleteProgram(p);
      e.p = e.vs = e.fs = null;
      e.state = 'error'; e.error = String(log).trim();
      if (!invFailed.has(e.ikey)) { invFailed.add(e.ikey); console.info('exact images: the inverse program did not compile; this chain draws forward (' + e.error.split('\n')[0].slice(0, 160) + ')'); }
      return;
    }
    gl.deleteShader(e.vs); gl.deleteShader(e.fs); e.vs = e.fs = null;
    const loc = {};
    const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    gl.useProgram(p);
    for (let i = 0; i < nu; i++) {
      const u = gl.getActiveUniform(p, i);
      const name = u.name.replace(/\[0\]$/, '');
      loc[name] = gl.getUniformLocation(p, u.name);
      if (name in SAMPLER_UNITS) gl.uniform1i(loc[name], SAMPLER_UNITS[name]);
    }
    e.loc = loc; e.state = 'ready'; e.readyAt = performance.now();
  }
  function evictInv() {
    const list = [...progs.values()].filter((e) => e.inv && e.state !== 'pending' && invFrame - e.frame > 4);
    const n = [...progs.values()].filter((e) => e.inv).length;
    list.sort((a, b) => a.frame - b.frame || a.used - b.used);
    for (let i = 0; i < n - INV_KEEP && i < list.length; i++) {
      const e = list[i];
      if (e.p) gl.deleteProgram(e.p);
      progs.delete(e.id);
    }
  }
  // the inverse program for the current chain, B and view kind with the current formula bundle. start: begin its
  // compile when it is missing (never in side mode, never while forward programs of this chain still compile).
  // -> {state: 'ready' | 'pending' | 'error' | 'none', P, reason}
  function invProgram(B, globe, start, extra) {
    const info = cur.info, inv = info && info.inverse;
    if (!inv) return { state: 'none', reason: 'no inverse program for this chain' };
    if (!inv.ok) return { state: 'none', reason: inv.reason };
    if (invFailed.has(inv.key)) return { state: 'error', reason: 'compile failed' };
    const fk = (extra ? 'test:' + hashStr(extra.pre + extra.main) + '|' : '') + (pack ? pack.formsKey : '');
    const id = invProgKey(inv, B, globe, fk);
    let e = progs.get(id);
    if (!e) {
      if (!start || sideMode) return { state: 'none', reason: sideMode ? 'side draw' : 'not started' };
      for (const q of progs.values()) if (q.key === cur.key && q.state === 'pending' && !q.inv) return { state: 'pending', reason: 'forward programs first' };
      e = { id, name: globe ? 'invS' : 'inv', key: id, inv: true, ikey: inv.key, chain: false, state: 'pending', used: ++useClock, frame: invFrame, t0: performance.now() };
      progs.set(id, e);
      try {
        const [vs, fs] = invSources(info, B, globe, pack ? pack.forms : [], extra);
        e.srcLen = fs.length;
        startLink(e, vs, fs, false);
      } catch (err) { e.state = 'error'; e.error = String(err.message || err); if (!invFailed.has(inv.key)) { invFailed.add(inv.key); console.info('exact images: inverse program not built (' + e.error + ')'); } }
      evictInv();
    }
    e.used = ++useClock; e.frame = invFrame;
    if (e.state === 'pending') {
      if (!pcExt || syncDepth > 0 || gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR)) {
        finishInv(e);
        // landed outside the compile poll (a draw or a status query): tell the app as the poll would, once, after
        // this call (it warms the program at an idle moment and redraws the panes and thumbnails)
        if (e.state === 'ready' && syncDepth === 0) setTimeout(() => { if (api.onReady) api.onReady({ main: true, side: false }); }, 0);
      } else schedulePoll();
    }
    if (e.state === 'ready') return { state: 'ready', P: e };
    if (e.state === 'error') return { state: 'error', reason: e.error };
    return { state: 'pending', reason: 'compiling' };
  }
  // a ready inverse program of the current chain, view kind and formula bundle for another B class (never starts a
  // compile): a larger B first (exact for any alpha), else the largest smaller one (its front B sheets exact, the rest
  // through their transmittance, SPEC 13.12). warm: only programs already drawn (their first draw, the Metal pipeline
  // build, stalled the GPU process 75-200 ms: P2 review)
  function invAltProgram(Bwant, globe, extra, warm) {
    const info = cur.info, inv = info && info.inverse;
    if (!inv || !inv.ok || invFailed.has(inv.key)) return null;
    const fk = (extra ? 'test:' + hashStr(extra.pre + extra.main) + '|' : '') + (pack ? pack.formsKey : '');
    const order = [3, 5, INV_B_MAX].filter((b) => b !== Bwant).sort((a, b) => (a > Bwant) !== (b > Bwant) ? (a > Bwant ? -1 : 1) : (a > Bwant ? a - b : b - a));
    for (const B of order) {
      const e = progs.get(invProgKey(inv, B, globe, fk));
      if (e && e.state === 'ready' && (!warm || e.warm)) { e.used = ++useClock; e.frame = invFrame; return { P: e, B }; }
    }
    return null;
  }
  // ---- per-pass data from Inverse.prepare (cached per prep object and program op list) ----
  const passCache = new WeakMap();
  const isFinC = (z) => !!z && Number.isFinite(z.re) && Number.isFinite(z.im);
  function passData(inv, plan, prep) {
    const c = passCache.get(prep);
    if (c && c.inv === inv && c.plan === plan) return c.d;
    const N = Math.max(1, inv.nOps), ops = inv.ops;
    const d = { ref: new Float32Array(2 * N), N: new Int32Array(N).fill(1), RK: new Int32Array(N), AB: new Float32Array(4 * N), box: new Float32Array(4 * N),
      stopOp: -1, stopMob: [0, 0, 0, 0], stopT: new Float32Array(8), mobOn: false, pInP: 0, sing: new Float32Array(8), singN: 0, ok: true, reason: null,
      tail: prep.tail ? 1 : 0 };
    const TAU = 2 * Math.PI;
    for (let j = 0; j < plan.ops.length; j++) {
      const o = plan.ops[j];
      const g = ops.findIndex((q) => q.step === o.step && q.node === o.node && q.kind === o.kind);
      if (g < 0) { d.ok = false; d.reason = 'the plan does not match the chain\'s inverse program'; break; }
      const F = o.fam, ref = prep.refs[j];
      if (F && F.type === 'log') {
        // lambda_ref (3.2): ln|ref| + i Arg ref shifted into (lo, hi]
        let lr = { re: 0, im: 0 };
        if (isFinC(ref) && !(ref.re === 0 && ref.im === 0)) {
          lr = CX.log(ref);
          let im = lr.im + TAU * (Math.floor((F.lo - lr.im) / TAU) + 1);
          if (im > F.hi) im -= TAU;
          if (im <= F.lo) im += TAU;
          if (Number.isFinite(im)) lr = { re: lr.re, im };
        }
        d.ref[2 * g] = lr.re; d.ref[2 * g + 1] = lr.im;
      } else if (isFinC(ref)) { d.ref[2 * g] = ref.re; d.ref[2 * g + 1] = ref.im; }
      else { d.ref[2 * g] = NaN; d.ref[2 * g + 1] = NaN; }
      const Nj = prep.N[j];
      d.N[g] = Math.max(1, Math.min(64, Number.isFinite(Nj) ? Nj : 64));
      const sp = prep.rspec[j];
      if (sp && sp.kind === 'clip') { d.RK[g] = 1; d.AB.set([sp.A.re, sp.A.im, sp.B.re, sp.B.im], 4 * g); }
      else if (sp && sp.kind === 'box') { d.RK[g] = 2; d.box.set([sp.e ? sp.e.re : 0, sp.e ? sp.e.im : 0, fcl(sp.lo), fcl(sp.hi)], 4 * g); }
      else if (sp && sp.kind === 'branch') d.RK[g] = 3;
      if (prep.stopOp === j) d.stopOp = g;
    }
    if (prep.stopMob && d.stopOp >= 0) {
      const sm = prep.stopMob, T = CX.mobScaled(sm.T);
      d.mobOn = true; d.stopMob = [sm.uPole.re, sm.uPole.im, sm.pAcc.re, sm.pAcc.im]; d.pInP = sm.pInP ? 1 : 0;
      d.stopT.set([T[0].re, T[0].im, T[1].re, T[1].im, T[2].re, T[2].im, T[3].re, T[3].im]);
    }
    const sing = (prep.sing || []).slice(0, 4);
    sing.forEach((p, i) => { d.sing[2 * i] = p.re; d.sing[2 * i + 1] = p.im; });
    d.singN = sing.length;
    // saturation anchors (SPEC 13.12): the anchor op's index in the program, the affine ops' (A, B), each anchor's
    // model, geometry and (p, log p); the pattern origin (p - Q, Q) depends on the cell: drawInverse
    d.ancJ = -1; d.ancAB = [1, 0, 0, 0]; d.ancLA = [0, 0]; d.anc = new Float32Array(32); d.ancP = [];
    if (prep.anc && d.ok) {
      const A = prep.anc, o = plan.ops[A.op];
      const g = o ? ops.findIndex((q) => q.step === o.step && q.node === o.node && q.kind === o.kind) : -1;
      if (g >= 0) {
        d.ancJ = g; d.ancAB = [A.A.re, A.A.im, A.B.re, A.B.im]; d.ancLA = [A.logA.re, A.logA.im];
        const big = (x) => (Number.isFinite(x) ? Math.min(x, 1e30) : 1e30);
        A.models.forEach((M, a) => {
          const b = 16 * a, t = M.type || 0;
          d.anc.set([t, big(M.m), t === 1 ? M.flag : t === 2 ? (M.convex ? 1 : 0) : t === 3 ? M.sign : 0, M.sgn || 1], b);
          if (t === 2) d.anc.set([M.u1.re, M.u1.im, M.u2.re, M.u2.im], b + 4);
          else if (t === 3) d.anc.set([M.v0.re, M.v0.im, M.r, M.K], b + 4);
          const lp = M.pz.re === 0 && M.pz.im === 0 ? null : CX.log(M.pz);
          d.anc.set([M.pz.re, M.pz.im, lp ? lp.re : -1e30, lp ? lp.im : 0], b + 12);
          d.ancP.push(M.pz);
        });
      }
    }
    passCache.set(prep, { inv, plan, d });
    return d;
  }
  // ---- half-resolution target (cost guard) ----
  // A pane's consecutive half-resolution passes share one batch (P2 review: one target bind, clear and upsample per
  // pass cost more than half resolution saved): the first binds and clears the half target, each draws its scissored
  // part, and flushHalf() (before any other draw of GLR: the api entry points call it) upsamples the union of their
  // scissor boxes once.
  let halfTex = null, halfFbo = null, halfW = 0, halfH = 0;
  let halfOpen = null;   // {x0, y0, x1, y1 (device px of the pane, the union), scOn, prevSc, hw, hh, pre}
  // force: also a pre-pass layer (beginHalfPre), which other draws leave waiting for its place in list order
  function flushHalf(force) {
    if (!halfOpen || !gl || preActive) return;
    if (halfOpen.pre && force !== true) return;
    const hb = halfOpen;
    halfOpen = null;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vpX, vpY, fw, fh);
    let x0 = vpX + hb.x0, y0 = vpY + hb.y0, x1 = vpX + hb.x1, y1 = vpY + hb.y1;
    if (hb.prevSc) { x0 = Math.max(x0, hb.prevSc[0]); y0 = Math.max(y0, hb.prevSc[1]); x1 = Math.min(x1, hb.prevSc[0] + hb.prevSc[2]); y1 = Math.min(y1, hb.prevSc[1] + hb.prevSc[3]); }
    if (x1 > x0 && y1 > y0) {
      const Q = program('invUp');
      if (Q) {
        use(Q);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
        gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, halfTex);
        u1i(Q, 'uHalf', 5);
        u4f(Q, 'uVp', vpX, vpY, fw, fh);
        u2f(Q, 'uHalfSz', hb.hw / halfW, hb.hh / halfH);
        gl.bindVertexArray(empty());
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindVertexArray(null);
      }
    }
    if (hb.scOn) { gl.enable(gl.SCISSOR_TEST); gl.scissor(...hb.prevSc); } else gl.disable(gl.SCISSOR_TEST);
  }
  // Half resolution before the pane's main pass (13.14). Binding the half-size target in the middle of a pane's frame
  // ends its render pass: on Metal the multisampled colour and depth are stored, then reloaded for the upsample, which
  // at dpr 2 cost about what half resolution saved (forced half frames p95 10.3-12 ms, a full-resolution pass of a
  // quarter of the pixels 7.4-10.3). A pane in half-resolution motion therefore draws its leading run of inverse
  // passes first: beginHalfPre(pw, ph) begins the pane's frame (its size, status and state) without touching the
  // default framebuffer, drawInverse({..., half: true, halfPre: true}) draws into the half target ('nohalf': this pass
  // cannot draw at half resolution yet, nothing was drawn: the run ends there and the pass draws in the main pass),
  // begin(pw, ph) then starts the main pass, and compositeHalf() upsamples the layer at the run's place in list order.
  let preActive = false;
  function beginHalfPre(pw, ph) {
    if (!ok) return false;
    if (preActive) gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    halfOpen = null;
    fw = pw; fh = ph; vpX = 0; vpY = 0;
    frameErr = ''; framePending = false; invAltUsed = false; invFrame++;
    preActive = true;
    resetState();
    return true;
  }
  function compositeHalf() {
    if (!halfOpen || !halfOpen.pre || preActive) return false;
    flushHalf(true);
    return true;
  }
  function halfTarget(w, h) {
    if (!halfFbo || halfW < w || halfH < h) {
      if (halfTex) gl.deleteTexture(halfTex);
      if (halfFbo) gl.deleteFramebuffer(halfFbo);
      halfW = Math.max(w, halfW); halfH = Math.max(h, halfH);
      halfTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, halfTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, halfW, halfH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      halfFbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, halfFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, halfTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    return halfFbo;
  }
  // K (SPEC 4.2): the front count for the early stop and admission: 1 when alpha >= 0.999, else
  // ceil(ln(1/255) / ln(1 - alpha))
  const invK = (alpha) => (alpha >= 0.999 ? 1 : Math.max(1, Math.ceil(Math.log(1 / 255) / Math.log(1 - Math.min(alpha, 0.999999)))));
  // B, the compile-time buffer (4.2; P2 benchmark, SPEC 13.10, 13.12): the buffer lives in registers across the whole
  // walk, and its size dominated the pass cost (dpr 2, z^i(H) marginal pass: B 3 1.4 ms at alpha 1, B 5 2.0 at 0.85,
  // B 8 3.3 at 0.7, B 16 8.4-10.8 at 0.5-0.3, P2 review). Classes by the shape's own (undimmed) alpha: 3 (alpha >=
  // 0.999, K 1), 5 (alpha >= 0.5), 8 (below). The buffer keeps the front B sheets exactly; the covering candidates it
  // does not keep enter the composite through their exact transmittance, coloured with the buffer's mean (the walk then
  // has no early stop: K > B). Their share of the light is (1 - alpha)^B: 0 for alpha >= 0.67 (B 5 holds K), at most
  // 3 % at alpha 0.5 (B 5) and 6 % at alpha 0.3 (B 8). A hover-dimmed draw keeps its shape's variant with K capped at
  // B (the tail closure covers the rest).
  const INV_B_MAX = 8;
  const invB = (alphaOwn) => (alphaOwn >= 0.999 ? 3 : alphaOwn >= 0.5 ? 5 : INV_B_MAX);
  // The cost guard's prediction (SPEC 10.12, 13.14): the GPU time of one inverse pass over px device pixels, in ms of the
  // suite's M4 at full clock (13.10's marginal cost), from the leaves the walk visits per pixel: the stop op walks K + 1
  // members with the early stop (B + 1 under the tail rule, K > B), every other op its whole budget (prep.N); 0.45 ms per
  // leaf and million pixels, plus 0.3. Measured at dpr 2 (0.85 Mpx), exp(H) / z^i(H): alpha 1 0.77 / -, 0.85 1.32 /
  // 1.92 ms, 0.3 3.14 / 4.12 (exp(H) walks 2, 4, 6, 9 leaves per pixel at alpha 1, 0.85, 0.5, 0.3; z^i(H) 2.1, 4.1, 6.2,
  // 9.1 per covered pixel); the model 1.02, 1.78, 2.54, 3.68. Not a timing: the GPU's clock decides that (13.14).
  function inverseEstimate(prep, alpha, alphaOwn, px) {
    if (!prep || !prep.ok || !(px > 0)) return 0;
    const B = invB(alphaOwn ?? alpha), K = Math.min(64, invK(alpha)), all = Math.abs(alpha - (alphaOwn ?? alpha)) < 1e-6;
    let L = 1;
    for (let j = 0; j < (prep.N || []).length; j++) {
      const n = Math.max(1, Number.isFinite(prep.N[j]) ? prep.N[j] : 64);
      L *= j === prep.stopOp && j === prep.inner ? Math.min(n, (all && K > B ? B : Math.min(K, B)) + 1) : n;
    }
    return px * 1e-6 * (0.3 + 0.45 * Math.min(L, 64));
  }
  // GLR.drawInverse(st) -> 'drawn' | 'pending' | 'error' (SPEC 4.5). st:
  //   map: GPU map spec, mode 0 (normalised) with stages (a, b]; plan: Inverse.planChain(steps, built, a, b) of the
  //   current chain; prep: Inverse.prepare(plan, {win, shape, ...}) of the shape (ok); shape (or shapeId): the shape,
  //   whose record GLR.packShapes packed this frame; viewKind 'flat' (default) | 'globe'; view {cx, cy, s}, dpr (flat)
  //   or sphere {MVP, eye} (globe); look {color, color2, edge, ink, alpha (drawn, hover-dimmed), alphaOwn (undimmed,
  //   sets B), pattern, cell, lines, stretch, origin}; scissor [x, y, w, h] device px (optional); half (cost guard).
  // 'pending' (a compile in flight or not yet allowed to start) sets frameStatus().pending; 'error': the shape cannot
  // be drawn inverse this frame (no program, a failed compile, a side draw without a ready program, a plan / prep
  // mismatch); both fall through to the forward draw.
  function drawInverse(st) {
    if (!ok || !st || !st.plan || !st.prep || !st.prep.ok) return 'error';
    const globe = st.viewKind === 'globe';
    const rec = pack && pack.recs.get(st.shapeId ?? (st.shape && st.shape.id));
    if (!rec || !rec.ok) return 'error';
    const look = st.look || {};
    let B = invB(look.alphaOwn ?? look.alpha ?? 1);
    let pr = invProgram(B, globe, true, st.extra);
    // A program that is still compiling, or ready but never drawn (cold: its first draw builds the Metal pipeline, a
    // 75-205 ms stall of the GPU process), is not drawn in a frame that defers cold programs: a live pane in motion
    // (st.motion) or any live frame (st.coldOk === false: the app warms it at an idle moment with warmInverse, then
    // redraws). Another ready, warm B class of the same program draws instead (the opacity slider, P2 review), else
    // the forward stand-in ('pending'). Exports (coldOk) and direct callers draw it, stall included.
    const defer = st.motion || st.coldOk === false;
    if (pr.state === 'pending' || (pr.state === 'ready' && !pr.P.warm && defer)) {
      const alt = invAltProgram(B, globe, st.extra, true);
      if (alt) { pr = { state: 'ready', P: alt.P }; B = alt.B; invAltUsed = true; }
      else if (pr.state === 'ready') pr = { state: 'pending', cold: true };
    }
    if (pr.state === 'pending') { framePending = true; return 'pending'; }
    if (pr.state !== 'ready') return 'error';
    const P = pr.P, inv = cur.info.inverse;
    P.warm = true;
    const d = passData(inv, st.plan, st.prep);
    if (!d.ok) return 'error';
    const map = st.map || {};
    // half resolution draws into another target format: a program's first half draw builds another Metal pipeline (a
    // stall), so a program not yet warm for it draws full resolution this frame and is warmed at the next quiet moment
    let half = !!st.half && !globe;
    if (half && (!P.warmHalf || !invUpWarm)) { half = false; P.warmHalfWanted = true; P.warmHalf = P.warmHalf && invUpWarm; }
    // a pre-pass draw (beginHalfPre) is a half-resolution draw or none
    const pre = !!st.halfPre && preActive;
    if (st.halfPre && (!pre || !half)) return 'nohalf';
    if (globe || !half) flushHalf();
    const hw = half ? Math.max(1, Math.ceil(fw / 2)) : fw, hh = half ? Math.max(1, Math.ceil(fh / 2)) : fh;
    gl.useProgram(P.p);
    if (!cur.invData || cur.invData.length !== 4 * inv.slots) { cur.invData = new Float32Array(4 * inv.slots); inv.fill(cur.invData); cur.invFill = inv; }
    else if (cur.invFill !== inv) { inv.fill(cur.invData); cur.invFill = inv; }
    if (P.loc.uInv) gl.uniform4fv(P.loc.uInv, cur.invData);
    u1i(P, 'uIxA', map.a || 0); u1i(P, 'uIxB', map.b || 0);
    if (P.loc.uIxRef) gl.uniform2fv(P.loc.uIxRef, d.ref);
    if (P.loc.uIxN) gl.uniform1iv(P.loc.uIxN, d.N);
    if (P.loc.uIxRK) gl.uniform1iv(P.loc.uIxRK, d.RK);
    if (P.loc.uIxAB) gl.uniform4fv(P.loc.uIxAB, d.AB);
    if (P.loc.uIxBox) gl.uniform4fv(P.loc.uIxBox, d.box);
    u1i(P, 'uIxStopOp', d.stopOp);
    u4f(P, 'uIxStopMob', ...d.stopMob);
    if (P.loc.uIxStopT) gl.uniform4fv(P.loc.uIxStopT, d.stopT);
    u1i(P, 'uIxStopMobOn', d.mobOn ? 1 : 0); u1f(P, 'uIxPAccInP', d.pInP);
    u1i(P, 'uIxTail', d.tail);
    const win = st.prep.win;
    u4f(P, 'uWin', win.x0, win.y0, win.x1, win.y1);
    u1f(P, 'uWinR', st.prep.R); u1f(P, 'uWinRs', st.prep.rs);
    if (P.loc.uSing) gl.uniform2fv(P.loc.uSing, d.sing);
    u1i(P, 'uSingN', d.singN);
    if (P.loc.uAncJ) {
      u1i(P, 'uAncJ', d.ancJ);
      if (d.ancJ >= 0) {
        u4f(P, 'uAncAB', ...d.ancAB); u2f(P, 'uAncLA', d.ancLA[0], d.ancLA[1]);
        // each anchor's pattern origin: Q, the cell corner nearest to p (the source point is passed as p - Q + delta,
        // precise), and the integer cell shift k mod 10 of Q (the patterns repeat over 10 cells), added after the
        // magnification of sub-pixel footprints
        const cell = (st.look && st.look.cell) || 1, K = [0, 0, 0, 0];
        d.ancP.forEach((p, a) => {
          const kx = Math.round(p.re / cell), ky = Math.round(p.im / cell);
          d.anc.set([p.re - kx * cell, p.im - ky * cell, kx * cell, ky * cell], 16 * a + 8);
          K[2 * a] = ((kx % 10) + 10) % 10; K[2 * a + 1] = ((ky % 10) + 10) % 10;
        });
        gl.uniform4fv(P.loc.uAnc, d.anc);
        if (P.loc.uAncK) u4f(P, 'uAncK', ...K);
        // log-polar: log p 16 / 2 pi = n + f (n the nearest integers): f, and n mod 2 (p = 0: none)
        if (P.loc.uAncG) {
          const G = new Float32Array(8);
          d.ancP.forEach((p, a) => {
            if (p.re === 0 && p.im === 0) { G.set([0, 0, -1, 0], 4 * a); return; }
            const l = CX.log(p), gx = l.re * 16 / (2 * Math.PI), gy = l.im * 16 / (2 * Math.PI), nx = Math.round(gx), ny = Math.round(gy);
            G.set([gx - nx, gy - ny, ((nx % 2) + 2) % 2, ((ny % 2) + 2) % 2], 4 * a);
          });
          gl.uniform4fv(P.loc.uAncG, G);
        }
      }
    }
    // K of the drawn alpha; a draw at the shape's own alpha counts every covering candidate (exact opacity past B),
    // a hover-dimmed one stops at the B-th key (its transient look may approximate the far sheets)
    const aDraw = look.alpha ?? 1, aOwn = look.alphaOwn ?? aDraw;
    u1i(P, 'uKsat', Math.max(1, Math.min(64, invK(aDraw))));
    u1i(P, 'uKall', Math.abs(aDraw - aOwn) < 1e-6 ? 1 : 0);
    // shape
    uploadPack();
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, invTex);
    u1i(P, 'uShOff', rec.offset);
    gl.uniform4i(L_(P, 'uShape'), rec.kind, rec.complement ? 1 : 0, rec.nPts, rec.ptsOff);
    u4f(P, 'uShA', ...rec.A); u4f(P, 'uShB', ...rec.B); u4f(P, 'uShC', ...rec.C);
    u1i(P, 'uFormSlot', rec.formSlot); u1i(P, 'uIxOne', 1);
    if (P.loc.uClipP) { u4f(P, 'uClipH', rec.clipH[0], rec.clipH[1], 0, 0); gl.uniform4fv(P.loc.uClipP, rec.clipU); }
    u4f(P, 'uShBox', ...rec.box);
    // look (regionUniforms with the pattern origin Q = 0: the walk's z is absolute)
    regionUniforms(P, Object.assign({ pattern: 'solid' }, look, { dpr: st.dpr || 1 }), [0, 0]);
    if (P.loc.uLut) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lut()); }
    if (globe) {
      // (the scissor of the image's w-box on the sphere, globeScissorOf: device px of the pane, intersected with the
      // pane's own scissor)
      const gsc = st.scissor, gScOn = gsc ? gl.isEnabled(gl.SCISSOR_TEST) : false, gPrev = gsc && gScOn ? gl.getParameter(gl.SCISSOR_BOX) : null;
      if (gsc) {
        let x0 = vpX + gsc[0], y0 = vpY + gsc[1], x1 = x0 + gsc[2], y1 = y0 + gsc[3];
        if (gPrev) { x0 = Math.max(x0, gPrev[0]); y0 = Math.max(y0, gPrev[1]); x1 = Math.min(x1, gPrev[0] + gPrev[2]); y1 = Math.min(y1, gPrev[1] + gPrev[3]); }
        if (x1 <= x0 || y1 <= y0) return 'drawn';
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
        invGlobeSc++; invGlobeScPx += (x1 - x0) * (y1 - y0);
      }
      uM4(P, 'uMVP', st.sphere.MVP); u3(P, 'uEye', st.sphere.eye);
      lightUniforms(P, sceneLight || defaultLight(false), 0.18, 40, 0.12);
      const g = sphere();
      const dt = gl.isEnabled(gl.DEPTH_TEST);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      gl.bindVertexArray(g.vao);
      gl.drawElements(gl.TRIANGLES, g.count, gl.UNSIGNED_INT, 0);
      gl.bindVertexArray(null);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      if (!dt) gl.disable(gl.DEPTH_TEST);
      if (gsc) { if (gScOn) gl.scissor(gPrev[0], gPrev[1], gPrev[2], gPrev[3]); else gl.disable(gl.SCISSOR_TEST); }
      invDraws++;
      return 'drawn';
    }
    const v = st.view || { cx: 0, cy: 0, s: 1 }, dpr = st.dpr || 1, inv1 = 1 / (v.s * dpr) * (half ? fw / hw : 1), inv2 = 1 / (v.s * dpr) * (half ? fh / hh : 1);
    u2f(P, 'uCenter', hi32(v.cx), hi32(v.cy));
    u2f(P, 'uCenterLo', v.cx - hi32(v.cx), v.cy - hi32(v.cy));
    u2f(P, 'uInvScale', inv1, inv2);
    // scissor: device px of the pane, intersected with the pane's own scissor (viewport())
    const sc = st.scissor;
    // (a pre-pass precedes begin(), which leaves the pane unscissored)
    const scOn = pre ? false : half && halfOpen ? halfOpen.scOn : gl.isEnabled(gl.SCISSOR_TEST);
    const prevSc = pre ? null : half && halfOpen ? halfOpen.prevSc : (scOn ? gl.getParameter(gl.SCISSOR_BOX) : null);
    if (half) {
      if (!halfOpen || halfOpen.hw !== hw || halfOpen.hh !== hh || !!halfOpen.pre !== pre) {
        if (halfOpen) { flushHalf(true); gl.useProgram(P.p); }     // (the upsample bound its own program)
        gl.bindFramebuffer(gl.FRAMEBUFFER, halfTarget(hw, hh));
        gl.viewport(0, 0, hw, hh);
        gl.disable(gl.SCISSOR_TEST);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        halfOpen = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, scOn, prevSc, hw, hh, pre };
      }
      if (sc) { gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.floor(sc[0] / 2), Math.floor(sc[1] / 2), Math.ceil(sc[2] / 2) + 2, Math.ceil(sc[3] / 2) + 2); }
      else gl.disable(gl.SCISSOR_TEST);
      const b = sc ? [sc[0] - 2, sc[1] - 2, sc[0] + sc[2] + 4, sc[1] + sc[3] + 4] : [0, 0, fw, fh];
      halfOpen.x0 = Math.min(halfOpen.x0, Math.max(0, b[0])); halfOpen.y0 = Math.min(halfOpen.y0, Math.max(0, b[1]));
      halfOpen.x1 = Math.max(halfOpen.x1, Math.min(fw, b[2])); halfOpen.y1 = Math.max(halfOpen.y1, Math.min(fh, b[3]));
      u4f(P, 'uVp', 0, 0, hw, hh);
    } else {
      u4f(P, 'uVp', vpX, vpY, fw, fh);
      if (sc) {
        let x0 = vpX + sc[0], y0 = vpY + sc[1], x1 = x0 + sc[2], y1 = y0 + sc[3];
        if (prevSc) { x0 = Math.max(x0, prevSc[0]); y0 = Math.max(y0, prevSc[1]); x1 = Math.min(x1, prevSc[0] + prevSc[2]); y1 = Math.min(y1, prevSc[1] + prevSc[3]); }
        if (x1 <= x0 || y1 <= y0) return 'drawn';
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
      }
    }
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    invDraws++;
    if (half) invHalfDraws++;   // the batch stays open: flushHalf upsamples it
    else if (sc) {
      if (scOn) gl.scissor(...prevSc); else gl.disable(gl.SCISSOR_TEST);
    }
    gl.bindVertexArray(null);
    return 'drawn';
  }
  let invDraws = 0, invHalfDraws = 0, invAltUsed = false, invGlobeSc = 0, invGlobeScPx = 0;
  // draws the ready inverse programs that were never drawn into one pixel of the current target (their first draw
  // builds the Metal pipeline: a 75-200 ms stall of the GPU process), at a quiet moment chosen by the app, so the
  // frame that switches to them does not stall -> the number of programs warmed for full resolution (a frame drawn with
  // another B class meanwhile should be redrawn); warmed for half resolution only: not counted (nothing to redraw)
  // (flat and globe programs, with the render state of a real pass: the pipeline includes the target's format, blending and
  // write mask; uniforms left at 0 give alpha 0, so the pixel is unchanged; the next frame clears it anyway)
  // half: also the half-resolution pipelines that a refused half draw asked for (the app warms those only at a longer
  // idle: they are not urgent, full resolution draws meanwhile)
  function warmInverse(half = true) {
    if (!ok || lost) return 0;
    flushHalf();
    let nFull = 0;
    const one = (e, half) => {
      if (half) { gl.bindFramebuffer(gl.FRAMEBUFFER, halfTarget(Math.max(1, halfW), Math.max(1, halfH))); gl.viewport(0, 0, 1, 1); }
      gl.useProgram(e.p);
      resetState();
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, 1, 1);
      // a globe program draws the globe's vertex layout (the pipeline includes it): one triangle, uMVP still 0, so
      // nothing is rasterised
      if (e.name === 'invS') { const g = sphere(); gl.bindVertexArray(g.vao); gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0); }
      else { gl.bindVertexArray(empty()); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      gl.bindVertexArray(null);
      gl.disable(gl.SCISSOR_TEST);
      if (half) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(vpX, vpY, fw, fh); }
    };
    for (const e of progs.values()) {
      if (!invWarmable(e) || !e.p) continue;
      if (!e.warm) { one(e, false); e.warm = true; nFull++; }
      if (half && e.warmHalfWanted && !e.warmHalf && warmUpsample()) { one(e, true); e.warmHalf = true; e.warmHalfWanted = false; }
    }
    return nFull;
  }
  // the half-resolution upsample (invUp, a static program: its first use links synchronously and its first draw
  // builds a pipeline, together a 100-250 ms stall measured in the first half frame) is made ready with the first half
  // warm-up: one pixel into the current target, alpha 0 (the texture unit holds the half target, or nothing)
  let invUpWarm = false;
  function warmUpsample() {
    if (invUpWarm) return true;
    const Q = getProg('invUp', cur, true);
    if (!Q) return false;
    use(Q);
    resetState();
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, 1, 1);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, halfTarget(Math.max(1, halfW), Math.max(1, halfH)) && halfTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(vpX, vpY, fw, fh);
    u1i(Q, 'uHalf', 5); u4f(Q, 'uVp', -1e6, -1e6, 1, 1); u2f(Q, 'uHalfSz', 0, 0);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.disable(gl.SCISSOR_TEST);
    invUpWarm = true;
    return true;
  }
  // a ready inverse program waits for warmInverse (a variant drawn in its place, or half resolution refused)
  // (only the current chain's programs: an older structure's program that was never drawn is not worth a stall)
  const invWarmable = (e) => e.inv && (e.name === 'inv' || e.name === 'invS') && e.state === 'ready' && !sideMode && !!cur.info && !!cur.info.inverse && e.ikey === cur.info.inverse.key;
  // 2: a program waits for its first (full-resolution) draw; 1: only half-resolution pipelines are wanted; 0: none
  const inverseColdState = () => {
    let s = 0;
    for (const e of progs.values()) if (invWarmable(e)) { if (!e.warm) return 2; if (e.warmHalfWanted && !e.warmHalf) s = 1; }
    return s;
  };
  const inverseColdWaiting = () => inverseColdState() > 0;
  // the app predicts half resolution in motion for a pane (app.js predictLevel): the current chain's programs get their
  // half-resolution pipelines at the same quiet moment as their first draw, not when the first half draw is refused
  function wantHalf() {
    for (const e of progs.values()) if (invWarmable(e) && !e.warmHalf) e.warmHalfWanted = true;
  }

  // ---- GPU timing for the cost guard (10.12): EXT_disjoint_timer_query_webgl2 around a pane's inverse passes ----
  let tqExt = null, tqChecked = false;
  const tqPending = [];
  let tqActive = null;
  function tq() { if (!tqChecked && gl) { tqChecked = true; tqExt = gl.getExtension('EXT_disjoint_timer_query_webgl2'); } return tqExt; }
  const timer = {
    // true when GPU timer queries exist (else the guard falls back to frame intervals)
    get available() { return !!(ok && tq()); },
    // brackets the inverse passes of one pane in one frame (tag: 'L' | 'R' ...); one bracket at a time
    begin(tag) {
      if (!ok || !tq() || tqActive) return false;
      const q = gl.createQuery();
      gl.beginQuery(tqExt.TIME_ELAPSED_EXT, q);
      tqActive = { q, tag, t: performance.now() };
      return true;
    },
    end() {
      if (!tqActive) return;
      gl.endQuery(tqExt.TIME_ELAPSED_EXT);
      tqPending.push(tqActive); tqActive = null;
      if (tqPending.length > 16) { const o = tqPending.shift(); gl.deleteQuery(o.q); }
    },
    // completed measurements since the last poll: [{tag, ms, t}] (disjoint ones dropped). The disjoint flag is read
    // only when a result is available: getParameter(GPU_DISJOINT_EXT) is a synchronous round trip to the GPU process
    // (the availability check is not), which a busy GPU process turned into main-thread stalls on every frame
    poll() {
      if (!ok || !tqExt || !tqPending.length || !gl.getQueryParameter(tqPending[0].q, gl.QUERY_RESULT_AVAILABLE)) return [];
      const disjoint = gl.getParameter(tqExt.GPU_DISJOINT_EXT);
      const out = [];
      while (tqPending.length) {
        const r = tqPending[0];
        if (!gl.getQueryParameter(r.q, gl.QUERY_RESULT_AVAILABLE)) break;
        tqPending.shift();
        const ns = gl.getQueryParameter(r.q, gl.QUERY_RESULT);
        gl.deleteQuery(r.q);
        if (!disjoint) out.push({ tag: r.tag, ms: ns / 1e6, t: r.t });
      }
      return out;
    },
  };
  // ---- the cost guard's policy (10.12), per pane, against a fixed 60 Hz frame (the user's rule, 2026-10-20: "60 fps
  // is enough": frames only have to stay comfortably inside 60 fps, and image quality is never traded for a 120 Hz
  // budget, so the display's own refresh plays no part). Levels: 0 full resolution and exact images; 1 half resolution
  // of the inverse passes of motion frames (settled frames, thumbnails and exports stay full); 2 also the pane's
  // bounded clean shapes forward (the last resort). A reading is the GPU time of the pane's frame (the bracket: clear,
  // grid, fills, strokes; each the median of the pane's last 3, app.js), or without timer queries the frame's lag.
  // STREAK consecutive readings over BUDGET at the current level move one level up. Hysteresis: a level is left only
  // by a probe that measures the finer level: at the start of a motion burst, at least `gap` ms after the last change,
  // the pane draws one level finer; when its first STREAK readings there are all under EXIT, that level sticks;
  // otherwise the coarser level returns at once (the probe cost at most STREAK measured frames) and the next probe
  // waits twice as long (up to probeMax). Readings between EXIT and BUDGET change nothing. Pure bookkeeping: the app
  // feeds it one record per measured pane frame (with the level it was drawn at) and one call per motion burst.
  // BUDGET (SPEC 10.12, measured on the suite's M4): the GPU-synchronised frame is the pane's reading + 2.2 ms (main
  // thread, blit and sync; 1.7-2.9 ms over 17 pans), and the 60 fps ceiling with headroom is 12 ms of the 16.7 ms
  // frame (the perf suite's absolute rule); 12 - 2.2 - 1.8 (the other pane's forward redraw at dpr 2, when it shares
  // the frame) = 8 ms. When both live panes drew inverse passes in the measured frame, each gets half (f.share).
  // EXIT = 5 ms: a probe sticks only with frames near 7 ms, 3 ms below the trip point (the run-to-run swing of the
  // readings of one scene with the GPU's clock: 2-3 ms).
  // Readings are never compared across resolutions (an Apple GPU lowers its clock on cheaper frames: half readings rise
  // from 2.3 to 5.7 ms within a pan), only with the absolute thresholds at the level they were drawn at.
  const GUARD_FRAME_MS = 1000 / 60;
  function CostGuard(opts = {}) {
    const BUDGET = opts.budget ?? 8, EXIT = opts.exit ?? 5, STREAK = opts.streak ?? 3;
    // the frame-lag fallback: over 1.5 frames of 60 Hz is over budget, at most one frame is under EXIT
    const LAG_OVER = 1.5 * GUARD_FRAME_MS, LAG_EXIT = GUARD_FRAME_MS;
    const PROBE_MS = opts.probeMs ?? 4000, PROBE_MAX = opts.probeMax ?? 32000, MAXLV = 2;
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const panes = new Map();
    const fresh = (s) => Object.assign(s, { over: 0, level: 0, floor: 0, raised: false, probe: false, probeN: 0, gap: PROBE_MS, changed: 0, log: 0 });
    const paneOf = (p) => { let s = panes.get(p); if (!s) { s = fresh({ key: null, last: null }); panes.set(p, s); } return s; };
    // (a probe never goes below the predicted floor: setFloor)
    const eff = (s) => Math.max(s.floor || 0, s.level - (s.probe ? 1 : 0));
    const note = (pane, s, what) => { if (s.log < 4 && typeof console !== 'undefined') { s.log++; console.info(`exact images: cost guard (${pane}): ${what}`); } };
    const out = (s, over) => { const lv = eff(s); return { level: lv, half: lv >= 1, demote: lv >= 2, budget: BUDGET, exit: EXIT, over }; };
    return {
      // frame(pane, {key, motion, inverse, gpuMs, intervalMs, level, share, t}): key = scene structure + map key
      // structure + B class + dpr (a new key starts at level 0); gpuMs: the timer reading of the pane's frame (null when
      // none); intervalMs: the frame's lag (without timer queries); inverse: inverse passes were drawn; level: the level
      // the measured frame was drawn at (a reading from another level is ignored; undefined: the current one); share:
      // the pane's share of the frame's GPU budget (0.5 when the other pane drew inverse passes in the same frame).
      // -> {level, half, demote, budget, exit, over}
      frame(pane, f) {
        const s = paneOf(pane);
        if (f.key !== undefined && f.key !== s.key) { fresh(s); s.key = f.key; }
        let over = null, under = false;
        const lv = eff(s);
        if (f.motion && f.inverse && (f.level === undefined || f.level === lv)) {
          const sh = f.share > 0 && f.share < 1 ? f.share : 1;
          if (f.gpuMs != null) { over = f.gpuMs > BUDGET * sh; under = f.gpuMs < EXIT * sh; }
          else if (f.intervalMs > 0) { over = f.intervalMs > LAG_OVER; under = f.intervalMs <= LAG_EXIT; }
        }
        if (over !== null) s.last = { gpuMs: f.gpuMs ?? null, intervalMs: f.intervalMs ?? null, over, under, level: lv };
        if (over === null) return out(s, over);
        const t = f.t ?? now();
        if (s.probe) {
          if (!under) {
            // the finer level does not fit: back at once, and the next probe waits longer
            s.probe = false; s.over = 0; s.changed = t; s.gap = Math.min(PROBE_MAX, 2 * s.gap);
          } else if (++s.probeN >= STREAK) {
            s.probe = false; s.level--; s.over = 0; s.changed = t; s.gap = PROBE_MS;
            note(pane, s, s.level ? 'bounded shapes back to exact images' : 'within the 60 fps budget again; full resolution');
          }
          return out(s, over);
        }
        s.over = over ? s.over + 1 : 0;
        if (s.over >= STREAK && s.level < MAXLV) {
          s.over = 0; s.level++; s.raised = false; s.changed = t; s.gap = PROBE_MS;
          note(pane, s, `over ${BUDGET} ms of GPU per frame (60 fps budget); ${s.level === 1 ? 'half resolution in motion' : 'bounded shapes drawn forward'}`);
        }
        return out(s, over);
      },
      // a motion burst of the pane starts: time for a probe of the finer level?
      burst(pane, t = now()) {
        const s = paneOf(pane);
        if (s.level > (s.floor || 0) && !s.probe && t - s.changed >= s.gap) { s.probe = true; s.probeN = 0; s.over = 0; }
        return out(s, null);
      },
      // the level the pane's passes are predicted to need (app.js predictLevel, GLR.inverseEstimate: 1 when they are
      // too heavy for full resolution in motion): the level never drops below it, probes stop at it, and readings at it
      // may still raise the level (a slower GPU). Set every frame (a new key starts at 0, then takes the floor).
      setFloor(pane, floor, t = now()) {
        const s = paneOf(pane), f = Math.max(0, Math.min(MAXLV, floor | 0));
        if (f === (s.floor || 0)) return out(s, null);
        // (a level the floor raised, not a measurement, follows it back down)
        if (f < (s.floor || 0) && s.raised && s.level > f) { s.level = f; s.probe = false; s.over = 0; s.changed = t; }
        s.floor = f;
        if (s.level < f) { s.level = f; s.raised = true; s.probe = false; s.over = 0; s.changed = t; s.gap = PROBE_MS; note(pane, s, 'predicted over the 60 fps budget; half resolution in motion'); }
        return out(s, null);
      },
      state(pane) { const s = paneOf(pane); return Object.assign(out(s, null), { over: s.over, last: s.last, probe: s.probe, gap: s.gap, stuck: s.level, floor: s.floor || 0 }); },
      reset(pane) { if (pane) panes.delete(pane); else panes.clear(); },
    };
  }

  const api = {
    init, begin, viewport, blit, gpuDone, prestart, prestartModes, prestartLand, warmStatus, warmBarStep, GLOBE_PROGS, profile, setChain, drawGrid, drawRegion, drawLines, drawColorPlot, drawLandscape, drawSphere, drawPreimage,
    // exact images (SPEC 4.5): see packShapes, drawInverse, inverseStatus, timer, CostGuard above
    packShapes, setFormAnchor: (xy) => { formAnchor = Array.isArray(xy) && xy.every(Number.isFinite) ? xy.slice() : null; }, packShape, TKIND, drawInverse, timer, CostGuard, warmInverse, flushHalf, beginHalfPre, compositeHalf, inverseEstimate, wantHalf,
    // a ready inverse program waits for warmInverse (call it at a quiet moment, then redraw)
    get inverseColdWaiting() { return inverseColdWaiting(); },
    inverseColdState,
    // the current chain's inverse program for shapes of own (undimmed) alpha alphaOwn and a view kind, with the
    // frame's formula bundle (packShapes), without starting a compile: 'ready' | 'pending' | 'error' | 'none' (no
    // program for this chain, or its compile not started). pathOf's GLR.inverseReady(...) is status === 'ready'.
    inverseStatus(alphaOwn = 1, viewKind = 'flat') { return ok ? invProgram(invB(alphaOwn), viewKind === 'globe', false).state : 'none'; },
    // the same, starting the compile when allowed (not in side mode, after the chain's forward programs landed)
    inverseRequest(alphaOwn = 1, viewKind = 'flat') { if (!ok) return 'none'; const r = invProgram(invB(alphaOwn), viewKind === 'globe', true); if (r.state === 'pending') schedulePoll(); return r.state; },
    // the compile-time buffer size and the front count K of SPEC 4.2 for an alpha
    inverseB: (alphaOwn) => invB(alphaOwn), inverseK: (alpha) => invK(alpha),
    // SPEC 4.8: a w-box {x0, x1, y0, y1} of a shape's image -> drawInverse's scissor [x, y, w, h] in device px of the
    // current pane (bottom-left origin), padded by pad device px; null when it covers the pane (no scissor needed);
    // [0, 0, 0, 0] when it misses the pane (nothing to draw)
    globeScissorOf: (b, MVP, eye, pad = 4) => globeScissorOf(b, MVP, eye, pad),
    scissorOf(b, view, dpr = 1, pad = 4) {
      if (!b || !view || ![b.x0, b.x1, b.y0, b.y1].every(Number.isFinite)) return null;
      const k = view.s * dpr;
      const x0 = Math.floor(fw / 2 + (b.x0 - view.cx) * k) - pad, x1 = Math.ceil(fw / 2 + (b.x1 - view.cx) * k) + pad;
      const y0 = Math.floor(fh / 2 + (b.y0 - view.cy) * k) - pad, y1 = Math.ceil(fh / 2 + (b.y1 - view.cy) * k) + pad;
      const cx0 = Math.max(0, x0), cy0 = Math.max(0, y0), cx1 = Math.min(fw, x1), cy1 = Math.min(fh, y1);
      if (cx1 <= cx0 || cy1 <= cy0) return [0, 0, 0, 0];
      if (cx0 <= 0 && cy0 <= 0 && cx1 >= fw && cy1 >= fh) return null;
      return [cx0, cy0, cx1 - cx0, cy1 - cy0];
    },
    // the current chain's inverse structure: {ok, key, reason, nOps} (null without a chain)
    get inverseInfo() { const v = cur.info && cur.info.inverse; return v ? { ok: !!v.ok, key: v.key, reason: v.reason || null, nOps: v.nOps || 0 } : null; },
    // draws made with an inverse program since load (tests, perf counters)
    get inverseDraws() { return invDraws; },
    get inverseHalfDraws() { return invHalfDraws; },
    // globe passes drawn with a scissor (globeScissorOf) and their scissored device px (tests)
    get inverseGlobeScissors() { return { n: invGlobeSc, px: invGlobeScPx }; },
    // internals for tests: shader sources (REGION_FS byte identity, the parity page's recording program)
    _src: { warmCount, warmBarStep, REGION_FS: (s) => REGION_FS(!!s), PATTERN_SRC, INV_HEAD, INV_MAIN, LINE_VS, invB, invK, invSources: (B, globe, forms, extra) => invSources(cur.info, B, !!globe, forms || [], extra), invProgram, passData, invAltProgram,
      // tests: every new inverse program gets a unique uniform (a cold compile and first draw, SPEC 13.12)
      set coldCompiles(v) { coldNonce = v ? Math.max(1, coldNonce) : 0; }, get coldCompiles() { return coldNonce > 0; } },
    createMesh, createSkip, setSkip, createLines, destroy, dropCached, releaseLandscape: landRelease, createPreMesh, drawPreMapped, get preBytes() { return preBytes; }, M4, camera, landGeom, fitDist, hexRGB, phaseRGB, paletteRGB, palRGB, setPalette, palette, PATTERNS, STYLES,
    get ok() { return ok; }, get lost() { return lost; }, get error() { return lastError; }, get gl() { return gl; }, get canvas() { return canvas; },
    // since the last begin/viewport: error (plain words) when a chain program failed to compile, pending when one
    // is still compiling (an earlier chain version, or nothing, was drawn instead; onReady follows)
    frameStatus() { return { error: frameErr, pending: framePending, alt: invAltUsed }; },
    // any chain program compiling in the background
    get compiling() { for (const e of progs.values()) if (e.state === 'pending') return true; return false; },
    // how many programs are compiling (issue #72: the panes' "Preparing the GPU" note counts them)
    get pendingLinks() { let n = 0; for (const e of progs.values()) if (e.state === 'pending') n++; return n; },
    // the programs compiling, as {id, key} (key: the chain structure key, 'static' for the others)
    pending() { const out = []; for (const e of progs.values()) if (e.state === 'pending') out.push({ id: e.id, key: e.key }); return out; },
    // drops every cached map evaluation (e.g. to measure the uncached cost)
    clearCaches() { for (const r of live) freeCache(r); },
    get cacheBytes() { return cacheBytes; },
    // true: every compile is waited for (tests that compare frames drawn right after a chain change)
    set syncCompile(v) { syncDepth += v ? 1 : -1; },
    // (exports) every chain and static program a draw needs is linked before it draws: a deformation frame's map mode
    // may be one the screen never drew (MAP); inverse programs keep their own rule (syncCompile)
    set syncPrograms(v) { syncFwd += v ? 1 : -1; },
    // side(true) ... side(false): setChain and the draws in between use a side chain (example thumbnails). The current
    // chain, its history and their programs are untouched; a side draw never stands in with them, so a side frame
    // whose programs are still compiling draws nothing (frameStatus().pending) and onReady({side: true}) follows.
    side(on) {
      if (on && !sideMode) { side = { cur }; sideMode = true; }
      else if (!on && sideMode) { cur = side.cur; side = null; sideMode = false; }
    },
    get chainKey() { return cur.key; },
    // All sheets for map (GPU map spec) with window W: {K (surfaces drawn, at most 24), total, W, infinite} or null
    // when the current chain cannot draw it (no multivalued step in (a, b], a homotopy, a d/dz in (a, b] with a > 0,
    // or no chainSheetRange in the chain's GLSL)
    // TEMP-DEBUG-HOOK (removed before publishing)
    // (v16 tests, SPEC 13.3) the points pts ([[x, y], ...]) through the current chain's mapPoint under map, read back by
    // transform feedback: a Float32Array of pairs, or null while the program compiles or without WebGL
    evalMap(map, pts) {
      if (!ok || lost || !cur.info) return null;
      syncDepth++;
      let P;
      try { P = getProg('evalPt', cur, true, map); } finally { syncDepth--; }
      if (!P) return null;
      const n = pts.length, data = new Float32Array(2 * n);
      pts.forEach((q, i) => { data[2 * i] = q[0]; data[2 * i + 1] = q[1]; });
      const vbo = gl.createBuffer(), out = gl.createBuffer(), vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, out); gl.bufferData(gl.ARRAY_BUFFER, 8 * n, gl.STREAM_READ);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      use(P, map);
      if (!tfObj) tfObj = gl.createTransformFeedback();
      gl.enable(gl.RASTERIZER_DISCARD);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfObj);
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, out);
      gl.beginTransformFeedback(gl.POINTS);
      gl.drawArrays(gl.POINTS, 0, n);
      gl.endTransformFeedback();
      gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
      gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
      gl.disable(gl.RASTERIZER_DISCARD);
      gl.bindVertexArray(null);
      const res = new Float32Array(2 * n);
      gl.bindBuffer(gl.ARRAY_BUFFER, out); gl.getBufferSubData(gl.ARRAY_BUFFER, 0, res); gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.deleteBuffer(vbo); gl.deleteBuffer(out); gl.deleteVertexArray(vao);
      return res;
    },
    // (v16 tests) the map-spec helpers: the cache key, the identity test and an earlier chain version's stand-in
    _map: { mapKeyOf: (m) => mapKeyOf(m), isIdent: (m) => isIdent(m), mapFor: (m, sigs) => mapFor(m, { sigs }) },
    // (walls tests, issue #52) the landscape's grid and refinement read back
    landMesh: lwMesh, landRefine: lwRefine, landHeld: lwHeld,
    // TEMP-DEBUG-HOOK
    sheetInfo(map, W, end) { const p = ok ? sheetPlan(map, W, end) : null; return p ? { K: p.K, total: p.total, W: p.W, infinite: p.infinite, hom: !!p.hom } : null; },
    // no program of chain structure key is still compiling (the ones its draws asked for landed or failed)
    ready(key) { for (const e of progs.values()) if (e.key === key && e.state === 'pending') return false; return true; },
    onRestore: null, onLost: null, onReady: null,
  };
  // a half-resolution batch is upsampled before any other draw (drawInverse flushes it itself)
  for (const k of ['begin', 'viewport', 'blit', 'drawGrid', 'drawRegion', 'drawPreMapped', 'drawLines', 'drawColorPlot', 'drawLandscape', 'drawSphere', 'drawPreimage']) {
    const f = api[k];
    // (a pre-pass layer waits for compositeHalf; the blit composites one that was left waiting)
    api[k] = function () { flushHalf(k === 'blit'); return f.apply(this, arguments); };
  }
  return api;
