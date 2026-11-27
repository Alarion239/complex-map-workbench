  // ---- shape records (4.3): drawPreimage's kind / A / B, plus the clip primitive and the polygon vertices ----
  const PACK_W = 1024;                  // texels per row of the frame's record texture
  const INV_POLY_MAX = 64;
  // the kinds a later plane strokes by the polylines opts.trace gives (their own trace at rest): a formula curve, an
  // external ray, an equipotential, and a freehand curve
  const TRACED = new Set(['curve', 'fcurve', 'dhray', 'dheq']);
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
        if (formAnchor && Constr.reanchor) G = Constr.reanchor(G, formAnchor);
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
  // a traced curve's texels: its polylines' vertices (x, y, 1 where a polyline starts, arc) after one box per group of
  // CURVE_GROUP segments (group g: the vertices CURVE_GROUP g to CURVE_GROUP (g + 1)); a polyline of fewer than two
  // finite vertices adds none. arc: a vertex's third value ([x, y, arc]: its arc length along the stroke at rest, for an
  // open region's dash), else 0. -> {n, texels}, or null for none
  function traceRec(lines) {
    const v = [];
    for (const line of lines) {
      const ps = (line || []).map((q) => { const p = xyOf(q); return [p[0], p[1], Array.isArray(q) && q.length > 2 ? +q[2] || 0 : 0]; }).filter((p) => Number.isFinite(p[0] + p[1]));
      if (ps.length >= 2) ps.forEach((p, i) => v.push(p[0], p[1], i ? 0 : 1, p[2]));
    }
    const n = v.length / 4;
    if (n < 2) return null;
    const groups = Math.ceil((n - 1) / CURVE_GROUP), boxes = [];
    for (let g = 0; g < groups; g++) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = g * CURVE_GROUP; i <= Math.min(n - 1, (g + 1) * CURVE_GROUP); i++) {
        const x = v[4 * i], y = v[4 * i + 1];
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      }
      boxes.push(x0, y0, x1, y1);
    }
    return { n, texels: boxes.concat(v) };
  }
  // GLR.packShapes(list, opts) -> {recs, forms, formsKey}: packs every area shape of the frame once (one texture
  // upload when the records changed). rec (per shape id): {offset, kind, complement, formSlot, ok, reason, pending}.
  // ok false: the shape cannot be drawn inverse (more than 64 polygon vertices, a traced curve of more than 1024, a
  // fifth formula shape, a formula whose GLSL failed); pending: a formula edited within the last 300 ms (draw it
  // forward meanwhile). opts.trace(s): the polylines (arrays of [x, y]) a traced curve of a later plane is stroked by;
  // with none, a freehand curve's own vertices. opts.dash(s): for an open region of a later plane, the polylines (arrays
  // of [x, y, arc]) its dashed outline is stroked by, packed after its own texels as rec.edge {nPts, ptsOff} (drawInverse
  // strokes its boundary by them when the stroke has a dash); none, or more than INV_CURVE_MAX vertices: no rec.edge
  function packShapes(list, opts = {}) {
    const now = opts.now ?? performance.now();
    const recs = new Map(), data = [];
    const want = [], wantExpr = [], wantIds = [];
    for (const s of list || []) {
      // stage: the plane the shape lies on; a shape of plane k > 0 holds the points z of plane 0 whose F_{0->k}(z) it
      // holds, so its clip primitive and box (in its own plane) say nothing of z. A curve (kinds 11-18, a constructed
      // circle 20, a traced curve as 16) is packed only on a later plane, where the staged program strokes it (its
      // level is minus its distance)
      const stage = s && Number.isInteger(s.stage) && s.stage > 0 ? s.stage : 0;
      const traced = stage > 0 && TRACED.has(s.kind);
      if (!s || s.visible === false || !(TKIND[s.kind] || traced)) continue;
      if (!traced && TKIND[s.kind] > (stage ? 18 : 10)) continue;
      const gk = gKind(s);
      const rec = { offset: 0, kind: traced ? 16 : gk || TKIND[s.kind], complement: gk || traced ? false : !!s.complement, formSlot: -1, ok: true, reason: null, pending: false, stage };
      recs.set(s.id, rec);
      let prim = null;
      try { prim = Region.clipPrimitive && !stage ? Region.clipPrimitive(s) : null; } catch (e) { prim = null; }
      let tr = null;
      if (traced) {
        let lines = null;
        try { lines = opts.trace ? opts.trace(s) : s.kind === 'curve' ? [s.pts || []] : null; } catch (e) { lines = null; }
        tr = lines && traceRec(lines);
      }
      const pk = traced ? tr && { A: [0, 0, 0, 0], B: [0, 0, 0, 0], pts: null } : packShape(s);
      if (!pk) { rec.ok = false; rec.reason = 'shape'; continue; }
      rec.A = pk.A; rec.B = pk.B;
      if (s.kind === 'polygon' && pk.pts.length > INV_POLY_MAX) { rec.ok = false; rec.reason = `${s.kind} with more than ${INV_POLY_MAX} vertices`; }
      if (tr && tr.n > INV_CURVE_MAX) { rec.ok = false; rec.reason = `${s.kind} with more than ${INV_CURVE_MAX} vertices`; }
      if (s.kind === 'formula') {
        if (want.length >= MAX_INV_FORMS) { rec.ok = false; rec.reason = 'fifth formula shape'; }
        else {
          const src = GLChain.levelGLSL ? GLChain.levelGLSL(s.expr, 'ilev' + want.length) : null;
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
      if (gk) thru0 = s._g.thru0 ? 1 : 0;             // from incidence
      rec.C = [at0, thru0, 0, 0];
      rec.offset = data.length / 4;
      const n0 = data.length, n = packPrim(prim, data);
      rec.clipH = [data[n0], data[n0 + 1]];
      rec.clipU = new Float32Array(64);
      rec.clipU.set(data.slice(n0 + 4, n0 + 4 + 64));
      // the early-out box (polygons, bounded formulas); x0 > x1: none
      rec.box = [1, 1, 0, 0];
      if (!stage && !s.complement && (s.kind === 'polygon' || s.kind === 'formula')) {
        let bb = null;
        try { bb = s.kind === 'polygon' ? Region.bboxOf(s) : Region.formulaBox(s); } catch (e) { bb = null; }
        if (bb && [bb.x0, bb.x1, bb.y0, bb.y1].every(Number.isFinite) && bb.x0 <= bb.x1 && bb.y0 <= bb.y1) rec.box = [bb.x0, bb.y0, bb.x1, bb.y1];
      }
      rec.ptsOff = n;
      rec.nPts = 0;
      if (s.kind === 'polygon' && rec.ok) { rec.nPts = pk.pts.length; for (const p of pk.pts) data.push(p[0], p[1], 0, 0); }
      if (tr && rec.ok) { rec.nPts = tr.n; for (const x of tr.texels) data.push(x); }
      rec.edge = null;
      if (stage && !traced && rec.ok && opts.dash) {
        let ed = null;
        try { const lines = opts.dash(s); ed = lines && traceRec(lines); } catch (e) { ed = null; }
        if (ed && ed.n <= INV_CURVE_MAX) { rec.edge = { nPts: ed.n, ptsOff: data.length / 4 - rec.offset }; for (const x of ed.texels) data.push(x); }
      }
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

  // ---- inverse programs (4.4): keyed inv|<source key>|<formula bundle>|B<n> (invS on the globe), in progs (so
  // context loss clears them) with their own LRU of 8 that never evicts a program drawn in this or the last frame.
  // Never a history stand-in. A failed compile is silent (one console line, no frameErr / lastError) and marks the
  // chain structure ineligible for the session.
  const INV_KEEP = 8;
  let invFrame = 0;                     // begin() / viewport() count: "this or the previous frame" = the last 4
  const invFailed = new Set();          // inverse keys whose program failed (session)
  // (inv.srcKey: what the program's text is built from, GLChain's inverse key and the constants it bakes in)
  function invProgKey(inv, B, globe, formsKey) { return `${globe ? 'invS' : 'inv'}|${inv.srcKey || inv.key}|${formsKey}|B${B}`; }
  // coldNonce (tests: the perf suite's cold-compile units, SPEC 13.12): every new inverse program gets a uniform the
  // compilers cannot fold, so its text is new to the machine (macOS caches compiled Metal libraries system-wide, and
  // ANGLE strips comments): its compile and first draw are cold, as on a user's first visit
  let coldNonce = 0;
  // the carried colour's variant of the inverse program (extra = INV_CARRY): each covering sheet's point z on
  // plane uGs is shaded with the colour plane's colour of it, dcolor(G(z)), G the stages (uGs, uGt] (the forward
  // chain's chainRange, compiled in beside the walker), its footprints from the walk's dz across and down a pixel
  // (dcolorD: the screen's derivatives mean nothing inside the walk). G at z and z + dX; with uGan (G analytic) the
  // footprint down is G'(z) dY from the one across, else G at z + dY too (ixChain3, one chain call site). One dcolorD
  // call site: z and its footprints themselves when G is the identity (uGs >= uGt)
  const INV_CARRY = { carry: true, pre: '', main: '' };
  // (its variant for a shape of a later plane, uShStage and the boundary draw compiled in: the chain's range evaluations the
  // test adds weigh on the programs that never draw one)
  const INV_CARRY_STAGED = { carry: true, staged: true, pre: '#define IX_STAGED 1\n', main: '' };
  // (CARRY_CAUCHY: each with the Cauchy integral compiled in, drawn only while the style is Cauchy with its residue data)
  const INV_CARRY_CZ = Object.assign({}, INV_CARRY, { cz: true }), INV_CARRY_STAGED_CZ = Object.assign({}, INV_CARRY_STAGED, { cz: true });
  // the carried colour's variant for st: staged or not, Cauchy or not
  const carryExtra = (st, staged) => (carryCauchyOn(st.carry) ? (staged ? INV_CARRY_STAGED_CZ : INV_CARRY_CZ) : staged ? INV_CARRY_STAGED : INV_CARRY);
  // whether st's carried program is the staged variant: the shape's own plane when its record is known, else st.staged
  const stagedOf = (st, rec) => rec ? rec.stage > 0 : !!st.staged;
  // (the carried variants compile the current chain in, invCarrySrc: their key names it, as a forward program's does,
  // so a chain with the same inverse ops never draws with another chain's code)
  const carryKey = (extra) => (extra && extra.carry ? (extra.staged ? 'carrystaged' : 'carry') + (extra.cz ? 'cz' : '') + ':' + cur.key : '');
  // (two parts: the chain and the declaration before INV_HEAD, which calls it; dcolor after it, which declares uDpr)
  function invCarrySrc(info) {
    return '#define IX_CARRY 1\n' + info.source + 'vec3 ixCarryCol(vec2 z, bool zf, vec2 dX, vec2 dY);\n';
  }
  // (cz: the Cauchy style's variant, CARRY_CAUCHY; without it the function has none of CAUCHY_CORE)
  function invCarryFns(cz) {
    if (!cz) return DCOLOR.replace('uniform float uDpr;', '') + glsl`
uniform int uGs; uniform int uGt; uniform bool uGan;
vec3 ixCarryCol(vec2 z, bool zf, vec2 dX, vec2 dY) {
#ifdef IX_REPT
  // a REPT plan whose map is its step's own (ixRepOwn): its member maps to the pixel's own w through its stages (uIxA,
  // uIxB] (certified, InvOps' REPT section), so a colour plane at or after them reads w, not z carried forward (the
  // copies' float32 error grows by the chain's expansion, up to 1 / |dz/dw|). A glide frame's member maps to w by the
  // copies' homotopy, not by the stages, and is carried forward as any other plan's
  if (ixRepOwn && uGs <= uIxA && uGt >= uIxB) {
    if (uIxB >= uGt) return dcolorD(ixRepW, ixDwX, ixDwY);
    vec2 v = chainRange(ixRepW, uIxB, uGt), vx = chainRange(ixRepW + ixDwX, uIxB, uGt) - v;
    return dcolorD(v, vx, uGan ? cmul(cdiv(vx, ixDwX), ixDwY) : chainRange(ixRepW + ixDwY, uIxB, uGt) - v);
  }
#endif
  if (!zf) return vec3(0.96078);   // a point at infinity: dcolor's +-infinity
  vec2 w = z, wx = dX, wy = dY;
  if (uGs < uGt) {
    bool an = uGan && dot(dX, dX) > 0.0;
    vec2 wbx, wby;
    ixChain3(z, dX, dY, uGs, uGt, an, false, w, wx, wy, wbx, wby);
    if (an) wy = cmul(cdiv(wx, dX), dY);
  }
  return dcolorD(w, wx, wy);
}
`;
    return DCOLOR.replace('uniform float uDpr;', '') + CAUCHY_CORE('sw', 'uCEdges') + `
uniform int uGs; uniform int uGt; uniform bool uGan; uniform int uCT; uniform vec2 uEdgeO;
` + CARRY_W + glsl`
vec3 ixCarryCol(vec2 z, bool zf, vec2 dX, vec2 dY) {
  if (!zf) return vec3(0.96078);   // a point at infinity: dcolor's +-infinity
  bool cz = uCT >= 0;
  if (!cz && uGs >= uGt) return dcolorD(z, dX, dY);
  vec2 w = carryW(z), wx = carryW(z + dX) - w;
  if (cz) {
    // the Cauchy integral at z and z + dX (the winding number of z for both), its footprint down from the one across (it is analytic on each side of the curve)
    vec2 zr = z - uEdgeO, c0, c1;
    int wn = cauchyWind(zr);
    if (!cauchyShown(wn) || !cauchyVal(z, zr, wn, w, c0)) return cauchyGrey();
    if (!cauchyVal(z + dX, zr + dX, wn, w + wx, c1)) c1 = c0;
    vec2 cx = c1 - c0;
    return dcolorD(c0, cx, dot(dX, dX) > 0.0 ? cmul(cdiv(cx, dX), dY) : vec2(0.0));
  }
  return dcolorD(w, wx, uGan && dot(dX, dX) > 0.0 ? cmul(cdiv(wx, dX), dY) : chainRange(z + dY, uGs, uGt) - w);
}
`;
  }
  // The NEWT roots pass (#938): when the plan's first inverted op is a NEWT op (inverse.nr = {j, targets, main}, from
  // GLChain.buildInverse), a roots program (nr.main, IX_NR_PASS) writes that op's members for each pixel's w into
  // IX_NR_N RGBA32F targets, seeded from the previous frame's (uNrPrev*, uNrPrevOn, uNrPrevT), and the inverse program
  // reads them (uNrTex*, uNrRead) where the op's input is the pixel's own w (ixPixW) instead of walking. Texel:
  // ixNrTexel, the pixel relative to the pass's viewport. IX_NR_N: the targets drawn, at most nr.targets, the GPU's draw
  // buffers and 6; the GLSL walks any members beyond them in place.
  let nrMaxDb = 0;
  function nrCount(nr) {
    if (!nr || !(nr.targets > 0) || !rtOK) return 0;
    if (!nrMaxDb) nrMaxDb = gl.getParameter(gl.MAX_DRAW_BUFFERS) || 1;
    return Math.min(nr.targets, nrMaxDb, 6);
  }
  function nrDecl(n, pass) {
    const k = Array.from({ length: n }, (_, i) => i);
    return `#define IX_NR_N ${n}\n${pass ? '#define IX_NR_PASS 1\n' : ''}vec2 ixPixW = vec2(3.0e38);\nivec2 ixNrTexel = ivec2(0);\n`
      + (pass ? k.slice(1).map((i) => `layout(location = ${i}) out vec4 o${i};\n`).join('') + k.map((i) => `uniform highp sampler2D uNrPrev${i};\n`).join('') + 'uniform int uNrPrevOn; uniform float uNrPrevT;\n'
        : k.map((i) => `uniform highp sampler2D uNrTex${i};\n`).join('') + 'uniform int uNrRead;\n');
  }
  // the part of an inverse program's key that its extra source adds
  const extraKey = (extra) => (extra ? (extra.carry ? carryKey(extra) + '|' + (extra.nrPass ? 'nr:' + hashStr(extra.main) + '|' : '') : 'test:' + hashStr(extra.pre + extra.main) + '|') : '');
  function invSources(info, B, globe, forms, extra) {
    const vs = globe ? SPHERE_VS : QUAD_VS;
    const L = GLChain.LIB;
    let main = extra && extra.main ? extra.main : INV_MAIN(globe), pre = (globe ? INV_GLOBE_PRE : '') + (swiftShader ? '#define IX_CHAIN3_CALLS 1\n' : '') + (extra && extra.pre || '');
    if (coldNonce && !extra) {
      const tag = `uIxNonce${coldNonce++}_${Math.floor(Math.random() * 1e9)}`;
      pre += `uniform float ${tag};\n`;
      main = main.replace('  invWalk(w);', `  w.x += ${tag};\n  invWalk(w);`);
    }
    const nrN = globe ? 0 : nrCount(info.inverse.nr);
    if (nrN) pre = nrDecl(nrN, !!(extra && extra.nrPass)) + pre;
    const fs = pre + L + info.inverse.lib + UTIL + (globe ? SHADE_GLOBE : '') + (extra && extra.carry ? invCarrySrc(info) : '') + INV_HEAD(B, formsSrc(forms)) + (extra && extra.carry ? invCarryFns(!!extra.cz) : '') + info.inverse.walker + main;
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
    programConstants(loc, p);
    // (a REPT program: its uniform values are recorded as set, for reptSig)
    if (loc.uIxRepHatch) /** @type {any} */ (p).reptShadow = new Map();
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
  // compile when it is missing (never in side mode, never while forward programs of this chain still compile, those of
  // a view no pane shows aside: e.offView).
  // -> {state: 'ready' | 'pending' | 'error' | 'none', P, reason}
  const INV_NOT_STARTED = 'not started';
  function invProgram(B, globe, start, extra, invOv) {
    // (invOv: an inverse op list other than the chain's: GLChain.buildInverse of the chain with a step's homotopy at t
    // standing for the step, or with a plan's own options (marked rest: a parked plane's, warmed as the chain's own):
    // its own program, the chain's forward data beside it)
    const info = invOv && cur.info ? Object.assign({}, cur.info, { inverse: invOv }) : cur.info, inv = info && info.inverse;
    if (!inv) return { state: 'none', reason: 'no inverse program for this chain' };
    if (!inv.ok) return { state: 'none', reason: inv.reason };
    // (the carried colour's variant fails on its own: the region tiling's program of the chain still draws)
    const ik = inv.key + (extra && extra.carry ? '|' + carryKey(extra) : '') + (extra && extra.nrPass ? '|nr' : '');
    if (invFailed.has(ik)) return { state: 'error', reason: 'compile failed' };
    const fk = extraKey(extra) + (pack ? pack.formsKey : '');
    const id = invProgKey(inv, B, globe, fk);
    let e = progs.get(id);
    if (!e) {
      if (!start || sideMode) return { state: 'none', reason: sideMode ? 'side draw' : INV_NOT_STARTED };
      for (const q of progs.values()) if (q.key === cur.key && q.state === 'pending' && !q.inv && !q.offView) return { state: 'pending', reason: 'forward programs first' };
      e = { id, name: globe ? 'invS' : 'inv', key: id, inv: true, ikey: ik, chain: false, state: 'pending', used: ++useClock, frame: invFrame, t0: performance.now(),
        rest: !!(invOv && invOv.rest), chainKey: cur.key };
      progs.set(id, e);
      try {
        const [vs, fs] = invSources(info, B, globe, pack ? pack.forms : [], extra);
        e.srcLen = fs.length;
        startLink(e, vs, fs, false);
      } catch (err) { e.state = 'error'; e.error = String(err.message || err); if (!invFailed.has(ik)) { invFailed.add(ik); console.info('exact images: inverse program not built (' + e.error + ')'); } }
      evictInv();
    }
    e.used = ++useClock; e.frame = invFrame;
    if (!sideMode) e.askKey = cur.key;
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
    return { state: 'pending', reason: 'compiling', id };
  }
  // a ready inverse program of the current chain, view kind and formula bundle for another B class (never starts a
  // compile): a larger B first (exact for any alpha), else the largest smaller one (its front B sheets exact, the rest
  // through their transmittance, SPEC 13.12). warm: only programs already drawn (their first draw, the Metal pipeline
  // build, stalls the GPU process 75-200 ms)
  function invAltProgram(Bwant, globe, extra, warm) {
    const info = cur.info, inv = info && info.inverse;
    if (!inv || !inv.ok || invFailed.has(inv.key + (extra && extra.carry ? '|' + carryKey(extra) : ''))) return null;
    const fk = extraKey(extra) + (pack ? pack.formsKey : '');
    const order = [3, 5, INV_B_MAX].filter((b) => b !== Bwant).sort((a, b) => (a > Bwant) !== (b > Bwant) ? (a > Bwant ? -1 : 1) : (a > Bwant ? a - b : b - a));
    for (const B of order) {
      const e = progs.get(invProgKey(inv, B, globe, fk));
      if (e && e.state === 'ready' && (!warm || e.warm)) { e.used = ++useClock; e.frame = invFrame; return { P: e, B }; }
    }
    return null;
  }
  // a REPT search's node budget (uIxRepNodes, min'd with REPEAT_NODES_MAX in the walker): the walker's own unless a test
  // starves it (setReptNodes, the unresolved hatch's control)
  let reptNodes = 1 << 30;
  // a test's non-finite root at every level-0 node (setReptPoison 'nan' | 'inf'; null: none): the pixel must read unresolved
  let reptPoison = null;
  // ---- per-pass data from Inverse.prepare (cached per prep object and program op list) ----
  const passCache = new WeakMap();
  const isFinC = (z) => !!z && Number.isFinite(z.re) && Number.isFinite(z.im);
  function passData(inv, plan, prep) {
    const c = passCache.get(prep);
    if (c && c.inv === inv && c.plan === plan) return c.d;
    const N = Math.max(1, inv.nOps), ops = inv.ops;
    const d = { ref: new Float32Array(2 * N), N: new Int32Array(N).fill(1), RK: new Int32Array(N), AB: new Float32Array(4 * N), box: new Float32Array(4 * N),
      stopOp: -1, stopMob: [0, 0, 0, 0], stopT: new Float32Array(8), mobOn: false, pInP: 0, sing: new Float32Array(12), singN: 0, ok: true, reason: null,
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
      d.mobOn = true; d.stopMob = [sm.uPole.re, sm.uPole.im, sm.pAcc.re, sm.pAcc.im]; d.pInP = sm.pInP;
      d.stopT.set([T[0].re, T[0].im, T[1].re, T[1].im, T[2].re, T[2].im, T[3].re, T[3].im]);
    }
    // a REPT plan's forward enclosures E_r (already rounded to float32 by Inverse.prepare): the box (x0, y0, x1, y1) and
    // (the escape bound or -1, 1 when there is no box, the radius bound or -1); the whole plane as x0 > x1 with no
    // escape bound
    const nE = GLChain.reptLevels();
    d.repE = new Float32Array(4 * nE); d.repS = new Float32Array(3 * nE);
    for (let r = 0; r < nE; r++) {
      const e = prep.rept && prep.rept.E[r];
      d.repE.set(e && !e.empty ? [e.x0, e.y0, e.x1, e.y1] : [1, 0, -1, 0], 4 * r);
      d.repS.set(e ? [e.esc > 0 ? e.esc : -1, e.empty ? 1 : 0, e.rad > 0 ? e.rad : -1] : [-1, 0, -1], 3 * r);
    }
    // the closed form of a monomial step on a disc (already rounded to float32 by Inverse.prepare): (log R, M, |c| / R,
    // dI), (dP down, dP up, dM down, dM up), (the disc's centre, 1 on); (0, 0, 0) off
    const cf = prep.rept && prep.rept.cf;
    d.repCf = cf ? [cf.lR, cf.M, cf.cn, cf.dI] : [0, 1, 0, 0]; d.repCg = cf ? [cf.dPdn, cf.dPup, cf.dMdn, cf.dMup] : [0, 0, 0, 0]; d.repCc = cf ? [cf.c.re, cf.c.im, 1] : [0, 0, 0];
    const sing = (prep.sing || []).slice(0, 4);
    // (each point's re, im and weight w, 1 when it has none, as Inverse.keyW reads it: uSing's vec3)
    sing.forEach((p, i) => { d.sing[3 * i] = p.re; d.sing[3 * i + 1] = p.im; d.sing[3 * i + 2] = p.w === undefined ? 1 : p.w; });
    d.singN = sing.length;
    d.singT = prep.per ? [prep.per.re, prep.per.im] : [0, 0];
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
  // A pane's consecutive half-resolution passes share one batch (one target bind, clear and upsample per
  // pass would cost more than half resolution saves): the first binds and clears the half target, each draws its scissored
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
    frameErr = ''; framePending = false; frameRefining = false; frameCompiling = false; invAltUsed = false; frameOver = 0; invFrame++;
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
  // Kept layers: a frame's picture copied out under a slot's name and drawn back into a later frame of the same size,
  // texel for texel (the steps view's plots under a glide's carried colour, which are the same in every frame of the
  // glide). slot -> { tex, fbo, w, h }; a lost context forgets them
  const layers = new Map();
  // the frame drawn so far (its fw x fh pixels at the viewport) into slot's texture -> true; false when it cannot be kept
  function layerKeep(slot) {
    if (!ok || lost || preActive) return false;
    const L = layerOf(slot);
    // (a multisampled drawing buffer is resolved by the blit; the scissor would clip it)
    const sc = gl.isEnabled(gl.SCISSOR_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, L.fbo);
    gl.blitFramebuffer(vpX, vpY, vpX + fw, vpY + fh, 0, 0, fw, fh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (sc) gl.enable(gl.SCISSOR_TEST);
    return true;
  }
  // the draws that follow go into slot's layer, cleared to transparent, not into the frame, until layerInto(null): a
  // layer kept without a frame to copy it from (the steps view's front-to-back glide, whose frame starts empty) ->
  // true; false when it cannot be kept (a frame of a stage's viewport included)
  function layerInto(slot) {
    if (slot === null) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return true; }
    if (!ok || lost || preActive || vpX || vpY) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, layerOf(slot).fbo);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return true;
  }
  // (slot's layer of the frame's size, made anew when there is none of that size)
  function layerOf(slot) {
    let L = layers.get(slot);
    if (!L || L.w !== fw || L.h !== fh) {
      if (L) { gl.deleteTexture(L.tex); gl.deleteFramebuffer(L.fbo); }
      L = { tex: gl.createTexture(), fbo: gl.createFramebuffer(), w: fw, h: fh };
      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, L.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
      for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, L.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, L.tex, 0);
      layers.set(slot, L);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    return L;
  }
  // slot's picture drawn into the frame in place of what is there (invUp at the frame's own size: each pixel its texel),
  // or with under, under what the frame holds (premultiplied destination-over, drawColorPlot's under) -> true; false
  // when there is none of the frame's size or the program cannot draw
  function layerDraw(slot, under) {
    const L = layers.get(slot);
    if (!ok || lost || preActive || !L || L.w !== fw || L.h !== fh) return false;
    const Q = program('invUp');
    if (!Q) return false;
    use(Q);
    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, L.tex);
    u1i(Q, 'uHalf', 5);
    u4f(Q, 'uVp', vpX, vpY, fw, fh);
    u2f(Q, 'uHalfSz', 1, 1);
    if (under) gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    else gl.disable(gl.BLEND);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    if (under) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    else gl.enable(gl.BLEND);
    return true;
  }
  function layerDrop(slot) {
    const L = layers.get(slot);
    if (L && gl && !lost) { gl.deleteTexture(L.tex); gl.deleteFramebuffer(L.fbo); }
    layers.delete(slot);
  }
  // K (SPEC 4.2): the front count for the early stop and admission: 1 when alpha >= 0.999, else
  // ceil(ln(1/255) / ln(1 - alpha))
  const invK = (alpha) => (alpha >= 0.999 ? 1 : Math.max(1, Math.ceil(Math.log(1 / 255) / Math.log(1 - Math.min(alpha, 0.999999)))));
  // B, the compile-time buffer (4.2; SPEC 13.10, 13.12): the buffer lives in registers across the whole
  // walk, and its size dominated the pass cost (dpr 2, z^i(H) marginal pass: B 3 1.4 ms at alpha 1, B 5 2.0 at 0.85,
  // B 8 3.3 at 0.7, B 16 8.4-10.8 at 0.5-0.3). Classes by the shape's own (undimmed) alpha: 3 (alpha >=
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
  //   inv (optional): an inverse op list for plan other than the chain's (GLChain.buildInverse), drawn by its own program
  // 'pending' (a compile in flight or not yet allowed to start) sets frameStatus().pending; 'error': the shape cannot
  // be drawn inverse this frame (no program, a failed compile, a side draw without a ready program, a plan / prep
  // mismatch); both fall through to the forward draw.
  // the roots pass's targets: two sets (ping-pong) of n RGBA32F textures of the pass's size, each set with its
  // framebuffer; nrLast: the set the last pass wrote, its key (size, view, op list, plan) and t, and token, which a
  // drawInverse of that frame names (st.nr) to read it
  const nrSets = [null, null];
  let nrLast = null, nrToken = 0;
  function nrSet(i, n, W, H) {
    let S = nrSets[i];
    if (S && S.n === n && S.W === W && S.H === H) return S;
    if (S) { S.tex.forEach((t) => gl.deleteTexture(t)); gl.deleteFramebuffer(S.fbo); }
    S = { n, W, H, tex: [], fbo: gl.createFramebuffer() };
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fbo);
    for (let k = 0; k < n; k++) {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE15);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, W, H, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + k, gl.TEXTURE_2D, t, 0);
      S.tex.push(t);
    }
    S.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    nrSets[i] = S;
    if (nrLast && nrLast.set === i) nrLast = null;
    return S;
  }
  function nrBind(S, n) {
    for (let k = 0; k < n; k++) { gl.activeTexture(gl.TEXTURE6 + k); gl.bindTexture(gl.TEXTURE_2D, S ? S.tex[k] : null); }
  }
  // The NEWT roots pass of a flat inverse draw st (drawInverse's: map, plan, prep, inv, view, dpr; t: the NEWT op's t;
  // pw, ph: the size of the frame the draw goes into), drawn into its own targets before or between the frame's draws
  // (the frame's framebuffer, viewport, scissor and blending are restored). -> {state: 'drawn', token} (pass token as
  // st.nr to drawInverse), or {state: 'none' | 'pending' | 'error'}: drawInverse walks every pixel itself
  function newtRoots(st) {
    const inv = st && st.inv, nr = inv && inv.nr, n = ok ? nrCount(nr) : 0;
    if (!n || st.viewKind === 'globe' || !st.plan || !st.prep || !st.prep.ok) return { state: 'none' };
    const pr = invProgram(INV_B_MAX, false, true, { carry: true, nrPass: true, pre: '', main: nr.main }, inv);
    if (pr.state !== 'ready') return { state: pr.state };
    const W = Math.max(1, Math.round(st.pw)), H = Math.max(1, Math.round(st.ph));
    const v = st.view || { cx: 0, cy: 0, s: 1 }, dpr = st.dpr || 1, map = st.map || {};
    const key = [W, H, v.cx, v.cy, v.s, dpr, inv.key, map.a || 0, map.b || 0, cur.key, cur.hash].join('|');
    const prev = nrLast && nrLast.key === key ? nrLast : null;
    const wi = nrLast ? 1 - nrLast.set : 0, S = nrSet(wi, n, W, H), Sp = prev ? nrSets[prev.set] : null;
    if (!S.ok) return { state: 'error' };
    flushHalf();
    const P = pr.P;
    P.warm = true;
    gl.useProgram(P.p);
    // (the prior set is bound for reading even when it is not the same frame's: never the set drawn into)
    nrBind(Sp || nrSets[1 - wi], n);
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fbo);
    gl.drawBuffers(Array.from({ length: n }, (_, k) => gl.COLOR_ATTACHMENT0 + k));
    gl.viewport(0, 0, W, H);
    // (every channel written: a frame's colour mask may leave alpha out, and a target's .w holds a root's part)
    // (the frame's colour mask is the renderer's record, maskRGB / maskA: getParameter would wait on the GPU process)
    const scOn = gl.isEnabled(gl.SCISSOR_TEST), blOn = gl.isEnabled(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND); gl.colorMask(true, true, true, true);
    if (!cur.invData || cur.invData.length !== 4 * inv.slots) { cur.invData = new Float32Array(4 * inv.slots); inv.fill(cur.invData); cur.invFill = inv; }
    else if (cur.invFill !== inv) { inv.fill(cur.invData); cur.invFill = inv; }
    if (P.loc.uInv) gl.uniform4fv(P.loc.uInv, cur.invData);
    if (P.loc.uChain) gl.uniform4fv(P.loc.uChain, cur.data);
    u1i(P, 'uIxA', map.a || 0); u1i(P, 'uIxB', map.b || 0);
    u4f(P, 'uVp', 0, 0, W, H);
    u2f(P, 'uCenter', hi32(v.cx), hi32(v.cy));
    u2f(P, 'uCenterLo', v.cx - hi32(v.cx), v.cy - hi32(v.cy));
    u2f(P, 'uInvScale', 1 / (v.s * dpr), 1 / (v.s * dpr));
    u1i(P, 'uNrPrevOn', prev ? 1 : 0); u1f(P, 'uNrPrevT', prev ? prev.t : 0);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vpX, vpY, fw, fh);
    if (scOn) gl.enable(gl.SCISSOR_TEST);
    if (blOn) gl.enable(gl.BLEND);
    gl.colorMask(maskRGB, maskRGB, maskRGB, maskA);
    nrLast = { set: wi, key, t: st.t, token: ++nrToken, n };
    return { state: 'drawn', token: nrLast.token };
  }
  // the program arguments drawInverse draws the state st with: the B class of its opacity, the view kind (globe), and the
  // variant (st.carry: the carried colour's, staged for a shape of a later plane (rec, or st.staged without a record)
  // on the plane; else st.extra)
  function invArgs(st, rec) {
    const globe = st.viewKind === 'globe', look = st.look || {};
    return { B: invB(look.alphaOwn ?? look.alpha ?? 1), globe, extra: st.carry ? carryExtra(st, !globe && stagedOf(st, rec)) : st.extra };
  }
  // the state of the program drawInverse(st) would draw with (st.staged: for a shape of a later plane), nothing drawn: 'ready' (it or a ready B class of it
  // draws), 'pending' (still linking: drawInverse answers 'pending'), 'error' or 'none' (drawInverse cannot draw st);
  // asking begins its compile when it is missing, as drawInverse does. For st.coldOk callers: a cold ready program counts
  // as ready
  function inverseState(st) {
    if (!ok || !st || !st.plan || !st.prep || !st.prep.ok) return 'error';
    const { B, globe, extra } = invArgs(st, pack && pack.recs.get(st.shapeId ?? (st.shape && st.shape.id)));
    const pr = /** @type {any} */ (invProgram(B, globe, true, extra, st.inv));
    if (pr.state === 'pending') return !st.inv && invAltProgram(B, globe, extra, true) ? 'ready' : 'pending';
    return pr.state;
  }
  // How far the inverse programs of the states sts (drawInverse's arguments, as inverseState takes them) have come:
  // {done, total}. A state is done when its program has linked (a cold one too: its first draw is the caller's, or the
  // frame's), or when nothing will come of it (no inverse for it, a failed compile, a side draw). start: begin the
  // compile of a program not started (it waits while the chain's forward programs link, and is asked again by the next
  // call)
  function inverseWarmup(sts, opt = {}) {
    let done = 0;
    if (!ok || lost) return { done, total: sts.length };
    for (const st of sts) {
      const { B, globe, extra } = invArgs(st, null);
      const pr = /** @type {any} */ (invProgram(B, globe, !!opt.start, extra, st.inv));
      if (pr.state === 'ready' || pr.state === 'error' || (pr.state === 'none' && pr.reason !== INV_NOT_STARTED)) done++;
    }
    return { done, total: sts.length };
  }
  function drawInverse(st) {
    if (!ok || !st || !st.plan || !st.prep || !st.prep.ok) return 'error';
    const rec = pack && pack.recs.get(st.shapeId ?? (st.shape && st.shape.id));
    if (!rec || !rec.ok) return 'error';
    // (st.carry: {s, T, style, sectors, grid, plane, ink, dark}: the carried colour's variant, on the plane and the
    // globe)
    const args = invArgs(st, rec), { globe, extra } = args, look = st.look || {};
    let B = args.B;
    let pr = /** @type {any} */ (invProgram(B, globe, true, extra, st.inv));
    // A program that is still compiling, or ready but never drawn (cold: its first draw builds the Metal pipeline, a
    // 75-205 ms stall of the GPU process), is not drawn in a frame that defers cold programs: a live pane in motion
    // (st.motion) or any live frame (st.coldOk === false: the app warms it at an idle moment with warmInverse, then
    // redraws). Another ready, warm B class of the same program draws instead (the opacity slider), else
    // the forward stand-in ('pending'). Exports (coldOk) and direct callers draw it, stall included.
    const defer = st.motion || st.coldOk === false;
    if (pr.state === 'pending' || (pr.state === 'ready' && !pr.P.warm && defer)) {
      const alt = st.inv ? null : invAltProgram(B, globe, extra, true);
      if (alt) { pr = { state: 'ready', P: alt.P }; B = alt.B; invAltUsed = true; }
      else if (pr.state === 'ready') pr = { state: 'pending', cold: true };
    }
    if (pr.state === 'pending') { framePending = true; standIn(pr.id); return 'pending'; }
    if (pr.state !== 'ready') return 'error';
    const P = pr.P, inv = st.inv || cur.info.inverse;
    P.warm = true;
    const d = passData(inv, st.plan, st.prep);
    if (!d.ok) return 'error';
    const map = st.map || {};
    // half resolution draws into another target format: a program's first half draw builds another Metal pipeline (a
    // stall), so a program not yet warm for it draws full resolution this frame and is warmed at the next quiet moment
    // (a REPT plan draws in tiles through its accumulation target, reptDraw: never at half resolution. A plan with no REPT
    // op draws as any other, by a program that may hold one for another range, Inverse.rangeOpts: its walker leaves
    // that op inactive)
    const isRept = !!P.loc.uIxRepHatch && st.plan.ops.some((o) => o.kind === 'REPT');
    let half = !!st.half && !globe && !isRept;
    // (st.saturate: a flat draw at full resolution, not REPT, blended by SRC_ALPHA_SATURATE, in front of what the frame
    // holds: it adds its straight colour times min(its alpha, 1 - the frame's alpha), so passes drawn front to back into
    // a transparent frame sum disjoint coverage exactly (two halves of a pixel make it whole) and the first opaque one
    // wins. The 8-bit target clamps the alpha's sum at 1. A half-resolution draw is refused: its upsample composites
    // premultiplied). A saturate draw reads a cut edge's colour inside the cut (uCutIn)
    if (st.saturate && st.half && !globe && !isRept) return 'nohalf';
    const sat = !!st.saturate && !globe && !isRept && !half;
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
    // (the roots of the frame's NEWT roots pass, newtRoots: read where its size is this pass's)
    if (P.loc.uNrRead) {
      const R = st.nr && nrLast && nrLast.token === st.nr && !half && nrSets[nrLast.set].W === fw && nrSets[nrLast.set].H === fh ? nrLast : null;
      u1i(P, 'uNrRead', R ? 1 : 0);
      if (R) nrBind(nrSets[R.set], R.n);
    }
    if (P.loc.uIxRef) gl.uniform2fv(P.loc.uIxRef, d.ref);
    if (P.loc.uIxN) gl.uniform1iv(P.loc.uIxN, d.N);
    if (P.loc.uIxRK) gl.uniform1iv(P.loc.uIxRK, d.RK);
    if (P.loc.uIxAB) gl.uniform4fv(P.loc.uIxAB, d.AB);
    if (P.loc.uIxBox) gl.uniform4fv(P.loc.uIxBox, d.box);
    if (P.loc.uIxRepE) gl.uniform4fv(P.loc.uIxRepE, d.repE);
    if (P.loc.uIxRepS) gl.uniform3fv(P.loc.uIxRepS, d.repS);
    if (P.loc.uIxRepCf) { gl.uniform4fv(P.loc.uIxRepCf, d.repCf); gl.uniform4fv(P.loc.uIxRepCg, d.repCg); gl.uniform3fv(P.loc.uIxRepCc, d.repCc); }
    u1i(P, 'uIxRepNodes', reptNodes);
    u1i(P, 'uIxRepPoison', reptPoison ? 1 : 0); u1f(P, 'uIxRepBad', reptPoison === 'inf' ? Infinity : NaN);
    // (st.rept: a REPT program's unresolved pixels: 0 hatched, 1 left out and marked (a region mask's pass, below))
    u1i(P, 'uIxRepHatch', st.rept || 0);
    // (a draw outside reptDraw reads no earlier pass's target: uIxRepPass 0, whatever a REPT draw of the program last set)
    if (!isRept) u1i(P, 'uIxRepPass', 0);
    u1i(P, 'uIxStopOp', d.stopOp);
    u4f(P, 'uIxStopMob', ...d.stopMob);
    if (P.loc.uIxStopT) gl.uniform4fv(P.loc.uIxStopT, d.stopT);
    u1i(P, 'uIxStopMobOn', d.mobOn ? 1 : 0); u1f(P, 'uIxPAccInP', d.pInP);
    u1i(P, 'uIxTail', rec.stage ? 0 : d.tail);
    u1i(P, 'uShStage', rec.stage);
    // st.edge {width, alpha, color, casing {width, alpha, color}, tint} (shapeStroke's): the boundary alone (a shape of a
    // later plane only: the boundary draw and the grow live in the staged program), a line width device px wide at alpha
    // in color (default black: a mask's alpha band) over an optional casing, over the shape's fill in tint [r, g, b, a]
    // (none without it: the steps view's layer of a later plane's region has one). The widths are the full ones; the
    // uniforms hold half widths: the line reaches width / 2 to each side
    const staged = rec.stage > 0;
    u1i(P, 'uEdgeOnly', staged && st.edge ? 1 : 0);
    if (staged && st.edge) {
      const e = st.edge, cs = e.casing;
      u1f(P, 'uEdgeW', 0.5 * e.width); u1f(P, 'uEdgeA', e.alpha); u3(P, 'uEdgeC', e.color || [0, 0, 0]);
      u1f(P, 'uEdgeCW', cs ? 0.5 * cs.width : 0); u1f(P, 'uEdgeCA', cs ? cs.alpha : 0); u3(P, 'uEdgeCC', cs ? cs.color : [0, 0, 0]);
      const tn = e.tint || [0, 0, 0, 0];
      u4f(P, 'uTint', tn[0], tn[1], tn[2], tn[3]);
    }
    u1f(P, 'uStageGrow', staged ? st.grow || 0 : 0);
    const win = st.prep.win;
    u4f(P, 'uWin', win.x0, win.y0, win.x1, win.y1);
    u1f(P, 'uWinR', st.prep.R); u1f(P, 'uWinRs', st.prep.rs);
    if (P.loc.uSing) gl.uniform3fv(P.loc.uSing, d.sing);
    u1i(P, 'uSingN', d.singN);
    u2f(P, 'uSingT', d.singT[0], d.singT[1]);
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
    u1i(P, 'uLastOpaque', look.lastOpaque ? 1 : 0);
    if (!globe) u1i(P, 'uStraight', sat ? 1 : 0);
    u1i(P, 'uCutIn', sat ? 1 : 0);
    // shape
    uploadPack();
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, invTex);
    u1i(P, 'uShOff', rec.offset);
    // (an open region's dashed boundary, st.edge.dash [on, off] in CSS px: stroked by its polylines at rest, rec.edge, a
    // traced curve whose vertices carry their arc at rest, dashed along that arc in device px at the view's scale, as
    // GLR.drawLines dashes it at rest; the casing stays whole, as drawLines' does. An edge with a fill under it (st.edge.tint)
    // keeps the region's own level, which the fill needs: a curve's level holds no point)
    const ed = rec.stage > 0 && st.edge && st.edge.dash && !(st.edge.tint && st.edge.tint[3] > 0) && rec.edge ? rec.edge : null;
    if (ed) gl.uniform4i(L_(P, 'uShape'), 16, 0, ed.nPts, ed.ptsOff);
    else gl.uniform4i(L_(P, 'uShape'), rec.kind, rec.complement ? 1 : 0, rec.nPts, rec.ptsOff);
    if (P.loc.uEdgeDash) {
      const dd = ed && st.edge.dash, ddpr = st.dpr || 1;
      u3(P, 'uEdgeDash', dd ? [dd[0] * ddpr, dd[1] * ddpr, (st.view ? st.view.s : 1) * ddpr] : [0, 0, 0]);
    }
    u4f(P, 'uShA', ...rec.A); u4f(P, 'uShB', ...rec.B); u4f(P, 'uShC', ...rec.C);
    u1i(P, 'uFormSlot', rec.formSlot); u1i(P, 'uIxOne', 1);
    if (P.loc.uClipP) { u4f(P, 'uClipH', rec.clipH[0], rec.clipH[1], 0, 0); gl.uniform4fv(P.loc.uClipP, rec.clipU); }
    u4f(P, 'uShBox', ...rec.box);
    // look (regionUniforms with the pattern origin Q = 0: the walk's z is absolute)
    regionUniforms(P, Object.assign({ pattern: 'solid' }, look, { dpr: st.dpr || 1 }), [0, 0]);
    if (extra && extra.carry) {
      // (the forward chain's data for chainRange, the plot's style, the stages (s, T] of the colour)
      if (P.loc.uChain) gl.uniform4fv(P.loc.uChain, cur.data);
      // (the carried variant ignores uPattern: it holds no pattern code, so a pattern there needs another variant)
      u1i(P, 'uPattern', 9);
      u1i(P, 'uGs', st.carry.s); u1i(P, 'uGt', st.carry.T); u1i(P, 'uGan', st.carry.an ? 1 : 0);
      dcUniforms(P, st.carry, st.dpr || 1);
      carryCauchy(P, st.carry);
      bindLut(P);
    }
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
      // (st.opaqueOnly: only the pixels the composite covers opaquely; the stencil the caller set marks them)
      u1i(P, 'uOpaqueOnly', st.opaqueOnly ? 1 : 0);
      globeLight(P, st.sphere);
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
      if (sc || isRept) {
        let x0 = vpX, y0 = vpY, x1 = vpX + fw, y1 = vpY + fh;
        if (sc) { x0 = vpX + sc[0]; y0 = vpY + sc[1]; x1 = x0 + sc[2]; y1 = y0 + sc[3]; }
        if (prevSc) { x0 = Math.max(x0, prevSc[0]); y0 = Math.max(y0, prevSc[1]); x1 = Math.min(x1, prevSc[0] + prevSc[2]); y1 = Math.min(y1, prevSc[1] + prevSc[3]); }
        if (isRept) {
          // (within the viewport too: a direct caller's may be smaller than the pane's)
          const vp = gl.getParameter(gl.VIEWPORT);
          x0 = Math.max(x0, vp[0]); y0 = Math.max(y0, vp[1]); x1 = Math.min(x1, vp[0] + vp[2]); y1 = Math.min(y1, vp[1] + vp[3]);
        }
        if (x1 <= x0 || y1 <= y0) return 'drawn';
        if (isRept) return reptDraw(P, st, [x0, y0, x1, y1], scOn, prevSc);
        gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
      }
    }
    gl.bindVertexArray(empty());
    if (sat) gl.blendFuncSeparate(gl.SRC_ALPHA_SATURATE, gl.ONE, gl.ONE, gl.ONE);
    try { gl.drawArrays(gl.TRIANGLES, 0, 3); } finally { if (sat) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    invDraws++;
    if (half) invHalfDraws++;   // the batch stays open: flushHalf upsamples it
    else if (sc) {
      if (scOn) gl.scissor(...prevSc); else gl.disable(gl.SCISSOR_TEST);
    }
    gl.bindVertexArray(null);
    return 'drawn';
  }
  let invDraws = 0, invHalfDraws = 0, invAltUsed = false, invGlobeSc = 0, invGlobeScPx = 0;
  // one pixel of the inverse program e into the current target (full resolution, or half: the half target), alpha 0
  function warmDraw(e, half) {
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
  }
  // ---- a REPT draw (flat): passes of at most REPT_TILE_SOLVES root solves into accumulation targets, then into the pane
  // A REPT program's walk costs up to REPEAT_NODES_MAX root solves a pixel, so one draw of a pane could run for seconds
  // and trip a GPU watchdog (a reset, a lost context). It renders into accumulation targets of the rect's size (RGBA8,
  // cleared to 0), each call drawing at most one tile as a submission of its own (flushed before and after):
  //  - pass A, the whole rect at the budget REPT_FAST_NODES (in tiles of REPT_TILE_SOLVES / REPT_FAST_NODES px when
  //    larger): a pixel whose search ends is final, one that does not reads the continue mark (uIxRepPass 1);
  //  - then one occlusion query per tile of pass B (REPT_TILE_SOLVES / REPEAT_NODES_MAX px) over the continue marks,
  //    read at a later call (WebGL answers a query no sooner);
  //  - pass B, the tiles that hold continue marks, at the whole budget: target B starts as a copy of A, and the walk
  //    runs only at the continue marks (uIxRepPass 2, A read as uIxRepPrev).
  // Until the picture is complete the call answers 'pending' (frameStatus().pending: the caller's stand-in, and ready /
  // settled wait) and asks the app for a redraw (GLR.onReptPending). The complete target is drawn into the pane by
  // reptAcc (the same pixels however many tiles made it), and a later draw with the same signature draws it again with no
  // walk. The signature is what the draw binds (reptSig): the program, the value of every uniform set on it (recorded as
  // set, shadowUniforms), the texture bound to each of its samplers with its contents' version, the viewport, the rect
  // and the context's generation; a sampler bound to a texture whose version is not known makes the draw uncacheable,
  // and it then draws whole. st.whole (an export) draws every tile in the one call, pass B over every tile (no query).
  // A glide frame's REPT op (its map the copies' homotopy, not its step's own: InvOps.opRept's own false) is drawn once,
  // at its u: it is walked whole and composited in the same call, as an uncacheable draw is, and keeps no target (one
  // per frame would push the parked planes' walks out of REPT_ACC_KEEP, and a frame answering 'pending' would stand in
  // over the frames after it).
  // A region mask's pass (st.rept 1): the walk writes its unresolved pixels as the mark (1, 0, 0, 0), which the
  // composite leaves out of the picture and marks 1 in the stencil (cleared at the frame's first mark) for
  // reptHatchFill. st.direct (a test's read-back of raw values): one pass at the whole budget straight into the caller's
  // target, no accumulation.
  const REPT_ACC_KEEP = 4;        // accumulation targets kept (least recently drawn dropped)
  const reptAccs = new Map();     // signature -> {w, h, A: {tex, fbo}, B, phase, next, tilesA, tilesB, q}
  let reptTileSolves = 0, reptFastNodes = 0, reptHoldB = false, ctxGen = 0;
  // a REPT draw answered 'pending' since the last GLR.reptPendingTake (a pane's frame begins and ends several GL frames,
  // and each begin clears frameStatus().pending: the pane's status takes this once a frame)
  let reptPendFlag = false;
  // the tiles of the second pass a pending REPT draw has done and has in all ({ done, total }), taken with the flag; null
  // while its second pass's tiles are not known yet (the first pass, the queries)
  let reptProg = null;
  // the tile account (GLR.reptTiles): calls, walks (searches) and the tiles of each pass of the draws a plane keeps (a
  // glide frame's walks counted apart: glides, the frames, and glideTiles, their tiles of both passes), the most tiles
  // of one call and root solves of one tile, the composites, and the draws with no signature (uncached)
  const reptStat = { calls: 0, searches: 0, tilesA: 0, tilesB: 0, maxTilesPerCall: 0, maxTileSolves: 0, composites: 0, uncached: 0, glides: 0, glideTiles: 0 };
  const reptTileOf = () => GLChain.reptTile();
  const sigVal = (k, v) => (ArrayBuffer.isView(v) ? Array.from(/** @type {any} */ (v)) : v);
  // the uniform setters record the values set on a REPT program (its WebGLProgram's reptShadow: location -> value)
  let glProg = null;
  function shadowUniforms(g) {
    const use0 = g.useProgram.bind(g);
    g.useProgram = (p) => { glProg = p; use0(p); };
    for (const f of Object.getOwnPropertyNames(Object.getPrototypeOf(g)).filter((k) => /^uniform(Matrix)?[1-4]/.test(k))) {
      const f0 = g[f].bind(g);
      g[f] = (loc, ...a) => { if (loc && glProg && glProg.reptShadow) glProg.reptShadow.set(loc, JSON.stringify(a, sigVal)); return f0(loc, ...a); };
    }
  }
  const progIds = new WeakMap();
  let progIdN = 0;
  // a texture's contents' version, null when not known
  function texVer(t) {
    if (!t) return 'none';
    if (t === invTex) return 'pack:' + invTexKey;
    if (t === palTex) return 'pal:' + palId;
    if (t === lutTex) return 'lut';
    return null;
  }
  // the uniforms reptDraw's walk sets itself (the target's viewport, the hatch's phase and mode, the pass and its
  // budget): left out of the signature, which their values from the last walk would otherwise change (the signature has
  // the viewport, the rect, mark and the budgets itself)
  const REPT_WALK_UNIFORMS = new Set(['uVp', 'uIxRepFc', 'uIxRepHatch', 'uIxRepPass', 'uIxRepFast']);
  function reptSig(P, st, rect, mark) {
    const p = P.p;
    if (!progIds.has(p)) progIds.set(p, ++progIdN);
    const vals = Object.entries(P.loc).filter(([n]) => !REPT_WALK_UNIFORMS.has(n)).map(([, l]) => (l && p.reptShadow ? p.reptShadow.get(l) ?? null : null));
    const unit0 = gl.getParameter(gl.ACTIVE_TEXTURE), tex = [];
    let known = true;
    for (const n of Object.keys(P.loc)) {
      if (!(n in SAMPLER_UNITS) || n === 'uIxRepPrev') continue;
      gl.activeTexture(gl.TEXTURE0 + SAMPLER_UNITS[n]);
      const v = texVer(gl.getParameter(gl.TEXTURE_BINDING_2D));
      if (v === null) known = false;
      tex.push(n + '=' + v);
    }
    gl.activeTexture(unit0);
    if (!known) return null;
    const t = reptTileOf();
    return JSON.stringify([progIds.get(p), vals, tex, Array.from(gl.getParameter(gl.VIEWPORT)), st.dpr || 1, rect, mark, ctxGen,
      reptTileSolves || t.solves, reptFastNodes || t.fast, reptNodes, reptPoison]);
  }
  function reptTarget(w, h) {
    const T = { tex: gl.createTexture(), fbo: gl.createFramebuffer() };
    gl.bindTexture(gl.TEXTURE_2D, T.tex);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.tex, 0);
    return T;
  }
  function reptAccFree(E) {
    for (const T of [E.A, E.B]) if (T) { gl.deleteTexture(T.tex); gl.deleteFramebuffer(T.fbo); }
    for (const q of E.q || []) gl.deleteQuery(q);
    if (E.hq) gl.deleteQuery(E.hq);
  }
  // the tiles of a w x h rect of at most px pixels each: [x, y, w, h]
  function reptTiles(w, h, px) {
    if (w * h <= px) return [[0, 0, w, h]];
    const ts = Math.max(1, Math.floor(Math.sqrt(px))), out = [];
    for (let y = 0; y < h; y += ts) for (let x = 0; x < w; x += ts) out.push([x, y, Math.min(ts, w - x), Math.min(ts, h - y)]);
    return out;
  }
  let reptKickT = 0;
  function reptKick() {
    if (reptKickT) return;
    reptKickT = setTimeout(() => { reptKickT = 0; if (api.onReptPending) api.onReptPending(); }, 0);
  }
  function reptDraw(P, st, rect, scOn, prevSc) {
    const [ax0, ay0, ax1, ay1] = rect, w = ax1 - ax0, h = ay1 - ay0, mark = st.rept === 1;
    reptStat.calls++;
    const restoreSc = () => { if (scOn) gl.scissor(prevSc[0], prevSc[1], prevSc[2], prevSc[3]); else gl.disable(gl.SCISSOR_TEST); };
    if (st.direct) {
      u1i(P, 'uIxRepPass', 0); u2f(P, 'uIxRepFc', 0, 0); u1i(P, 'uIxRepHatch', mark ? 1 : 0);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(ax0, ay0, w, h);
      gl.bindVertexArray(empty());
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
      restoreSc();
      reptStat.searches++; invDraws++;
      return 'drawn';
    }
    const t = reptTileOf(), S = reptTileSolves || t.solves, fast = Math.min(reptFastNodes || t.fast, t.nodes);
    const op0 = st.plan && st.plan.ops && st.plan.ops[0], glide = !!(op0 && op0.kind === 'REPT' && op0.p && op0.p.own === false);
    const sig = glide ? null : reptSig(P, st, rect, mark), whole = !!st.whole || sig === null;
    if (glide) reptStat.glides++;
    else if (sig === null) reptStat.uncached++;
    // (an uncacheable draw is walked whole and composited in the same call: while the composite's program links it is
    // pending, with nothing walked or allocated)
    if (sig === null && !(ok && program('reptAcc'))) { restoreSc(); framePending = true; reptPendFlag = true; reptProg = null; reptKick(); return 'pending'; }
    const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING), vp = gl.getParameter(gl.VIEWPORT), blend = gl.isEnabled(gl.BLEND);
    gl.activeTexture(gl.TEXTURE15);
    const prevTex = gl.getParameter(gl.TEXTURE_BINDING_2D);
    let E = sig === null ? null : reptAccs.get(sig);
    if (E) { reptAccs.delete(sig); reptAccs.set(sig, E); }
    else {
      E = { w, h, A: reptTarget(w, h), B: null, phase: 'A', next: 0, tilesA: reptTiles(w, h, Math.max(1, Math.floor(S / fast))), tilesB: null, q: null };
      gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      if (sig !== null) {
        reptAccs.set(sig, E);
        for (const [k, F] of reptAccs) { if (reptAccs.size <= REPT_ACC_KEEP) break; reptAccFree(F); reptAccs.delete(k); }
      }
    }
    const tilesB = () => reptTiles(w, h, Math.max(1, Math.floor(S / t.nodes)));
    // (the walk's w at a pixel of a target: the pane's pixel ax0 + x, ay0 + y; the hatch's phase the pane's)
    const walk = (T, pass, list, many) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.fbo);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.BLEND); gl.enable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
      gl.useProgram(P.p);
      u4f(P, 'uVp', vpX - ax0, vpY - ay0, fw, fh); u2f(P, 'uIxRepFc', ax0, ay0); u1i(P, 'uIxRepHatch', mark ? 1 : 0);
      u1i(P, 'uIxRepPass', pass); u1i(P, 'uIxRepFast', fast);
      // (unit 15, uIxRepPrev: A in pass B; else nothing, as the target drawn into may not be bound to a sampler)
      gl.activeTexture(gl.TEXTURE15); gl.bindTexture(gl.TEXTURE_2D, pass === 2 ? E.A.tex : null);
      gl.bindVertexArray(empty());
      let k = 0;
      do {
        const [tx, ty, tw, th] = list[E.next];
        gl.flush();
        gl.scissor(tx, ty, tw, th);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.flush();
        E.next++; k++;
        reptStat.searches++; reptStat[glide ? 'glideTiles' : pass === 1 ? 'tilesA' : 'tilesB']++;
        reptStat.maxTileSolves = Math.max(reptStat.maxTileSolves, tw * th * (pass === 1 ? fast : t.nodes));
      } while (many && E.next < list.length);
      reptStat.maxTilesPerCall = Math.max(reptStat.maxTilesPerCall, k);
      gl.bindVertexArray(null);
      invDraws++;
    };
    let progress = true;
    while (progress && E.phase !== 'done') {
      progress = false;
      if (E.phase === 'A') {
        if (E.next < E.tilesA.length) walk(E.A, 1, E.tilesA, whole);
        if (E.next < E.tilesA.length) break;
        if (!E.B) {
          E.tilesB = tilesB(); E.B = reptTarget(w, h);
          gl.bindFramebuffer(gl.FRAMEBUFFER, E.B.fbo); gl.disable(gl.SCISSOR_TEST); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        }
        if (whole) { E.phase = 'B'; E.next = 0; progress = true; continue; }
        // one query per tile of pass B: any continue mark in it. While the query's program still links (a parallel
        // compile: reptAcc is linked at its first use) pass A stays done and the queries wait for a later call
        const Q = ok && program('reptAcc');
        if (!Q) break;
        E.phase = 'Q'; E.next = 0;
        use(Q);
        gl.bindFramebuffer(gl.FRAMEBUFFER, E.B.fbo); gl.viewport(0, 0, w, h);
        gl.colorMask(false, false, false, false); gl.enable(gl.SCISSOR_TEST);
        gl.activeTexture(gl.TEXTURE15); gl.bindTexture(gl.TEXTURE_2D, E.A.tex);
        u2f(Q, 'uAccOff', 0, 0); u1i(Q, 'uAccMode', 3);
        gl.bindVertexArray(empty());
        E.q = E.tilesB.map(([tx, ty, tw, th]) => {
          const q = gl.createQuery();
          gl.scissor(tx, ty, tw, th);
          gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, q);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
          gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE);
          return q;
        });
        gl.bindVertexArray(null);
        gl.colorMask(maskRGB, maskRGB, maskRGB, maskA);
        break;
      }
      if (E.phase === 'Q') {
        if (!E.q.every((q) => gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE))) break;
        E.tilesB = E.tilesB.filter((_, i) => gl.getQueryParameter(E.q[i], gl.QUERY_RESULT));
        for (const q of E.q) gl.deleteQuery(q);
        E.q = null;
        if (!E.tilesB.length) { E.phase = 'done'; E.src = E.A; break; }
        E.phase = 'B'; progress = true;
        continue;
      }
      if (E.phase === 'B') {
        if (E.next === 0) {
          // (B starts as a copy of A: the pixels the second pass leaves are the first's)
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, E.A.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, E.B.fbo);
          gl.disable(gl.SCISSOR_TEST);
          gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
        }
        if (reptHoldB && !whole) break;
        walk(E.B, 2, E.tilesB, whole);
        if (E.next >= E.tilesB.length) { E.phase = 'done'; E.src = E.B; }
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb);
    gl.viewport(vp[0], vp[1], vp[2], vp[3]);
    if (blend) gl.enable(gl.BLEND); else gl.disable(gl.BLEND);
    gl.colorMask(maskRGB, maskRGB, maskRGB, maskA);
    gl.activeTexture(gl.TEXTURE15); gl.bindTexture(gl.TEXTURE_2D, prevTex);
    const Q = E.phase === 'done' && ok && program('reptAcc');
    if (!Q) {
      // (an entry no signature keeps is freed here: the next call starts its own)
      if (sig === null) reptAccFree(E);
      restoreSc(); framePending = true; reptPendFlag = true;
      reptProg = E.phase === 'B' ? { done: E.next, total: E.tilesB.length } : null;
      reptKick();
      return 'pending';
    }
    use(Q);
    gl.activeTexture(gl.TEXTURE15); gl.bindTexture(gl.TEXTURE_2D, E.src.tex);
    u2f(Q, 'uAccOff', ax0, ay0);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(ax0, ay0, w, h);
    gl.bindVertexArray(empty());
    u1i(Q, 'uAccMode', mark ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (mark) {
      reptMarked = sig === null ? null : E;
      if (repMarkFrame !== invFrame) { repMarkFrame = invFrame; gl.stencilMask(0xff); gl.clearStencil(0); gl.clear(gl.STENCIL_BUFFER_BIT); }
      // (the marks: 1, then 2 over those on the image's rim)
      gl.enable(gl.STENCIL_TEST); gl.stencilMask(0xff); gl.stencilFunc(gl.ALWAYS, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
      gl.colorMask(false, false, false, false);
      u1i(Q, 'uAccMode', 2);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.stencilFunc(gl.ALWAYS, 2, 0xff);
      u1i(Q, 'uAccMode', 4);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.colorMask(maskRGB, maskRGB, maskRGB, maskA);
      gl.disable(gl.STENCIL_TEST);
    }
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE15); gl.bindTexture(gl.TEXTURE_2D, prevTex);
    restoreSc();
    if (sig === null) reptAccFree(E);
    reptStat.composites++;
    return 'drawn';
  }
  // the frame (invFrame) whose stencil holds REPT marks: 1, or 2 on the image's rim
  let repMarkFrame = -1;
  // the grey no-value hatch of program Q over the frame open, opaque: where the stencil holds the mark `marked` (1 or 2),
  // else (0) everywhere
  function hatchPass(Q, dpr, marked) {
    use(Q);
    u1f(Q, 'uDpr', dpr || 1);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (marked) { gl.enable(gl.STENCIL_TEST); gl.stencilMask(0xff); gl.stencilFunc(gl.EQUAL, marked, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP); }
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
  // the hatch over the whole frame open (a plane whose image is nowhere known: a refused repeat's). False when its program is
  // not ready
  function hatchAll(dpr) {
    const Q = ok && program('reptHatch');
    if (!Q) return false;
    hatchPass(Q, dpr, 0);
    return true;
  }
  // the accumulation entry whose picture the frame's mark pass composited (a cacheable draw's), for reptHatchFill
  let reptMarked = null;
  // The hatch over the marked pixels, then the marks cleared. -> whether the picture's hatch covers any pixel off the image's
  // rim (stencil 1: a hairline along the rim, stencil 2, is hatched but not counted): an occlusion query over that hatch's
  // draw, asked once for a picture (its accumulation entry) and answered, as WebGL answers, by a later frame, which is asked
  // for (reptKick) until it finds the entry's answer; true or false once it is known, else undefined, as for an uncacheable
  // picture. null when the frame has no mark pass to hatch or the program is not ready
  function reptHatchFill(dpr) {
    const Q = ok && program('reptHatch');
    if (!Q || repMarkFrame !== invFrame) return null;
    const E = reptMarked;
    reptMarked = null;
    const q = E && E.hatched === undefined && !E.hq ? gl.createQuery() : null;
    if (q) gl.beginQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE, q);
    hatchPass(Q, dpr, 1);
    if (q) { gl.endQuery(gl.ANY_SAMPLES_PASSED_CONSERVATIVE); E.hq = q; reptKick(); }
    hatchPass(Q, dpr, 2);
    gl.clearStencil(0); gl.clear(gl.STENCIL_BUFFER_BIT); gl.disable(gl.STENCIL_TEST);
    repMarkFrame = -1;
    if (E && E.hq) {
      // (a result not there yet asks for another frame, until it is)
      if (gl.getQueryParameter(E.hq, gl.QUERY_RESULT_AVAILABLE)) { E.hatched = !!gl.getQueryParameter(E.hq, gl.QUERY_RESULT); gl.deleteQuery(E.hq); E.hq = null; } else reptKick();
    }
    return E ? E.hatched : undefined;
  }
  // the pixels the frame's stencil marks unresolved off the image's rim (a REPT plan's region-mask pass, drawInverse),
  // counted by a read-back of the frame (its picture is overwritten: the caller has copied it), then the marks cleared. 0
  // without such marks. cc: a 2D context the frame's size (row 0 at its top), where each marked pixel, on the rim too, is
  // also drawn opaque black, over what it holds (the Landscape's region mask: its no-value mark, svLandMask)
  function reptMarkCount(cc) {
    const Q = ok && program('keepA');
    if (!Q || repMarkFrame !== invFrame) return 0;
    use(Q);
    gl.disable(gl.SCISSOR_TEST); gl.colorMask(true, true, true, true);
    gl.clearColor(1, 1, 1, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.BLEND);
    // (the marks off the rim read (0, 0, 0, 0), those on it (0, 1, 1, 1), the rest (1, 1, 1, 1))
    gl.enable(gl.STENCIL_TEST); gl.stencilMask(0xff); gl.stencilFunc(gl.EQUAL, 1, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.bindVertexArray(empty());
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.stencilFunc(gl.EQUAL, 2, 0xff); gl.colorMask(true, false, false, false);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.colorMask(true, true, true, true);
    gl.bindVertexArray(null);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const px = new Uint8Array(4 * fw * fh);
    gl.readPixels(vpX, vpY, fw, fh, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let n = 0, rim = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i + 3] === 0) n++; else if (px[i] === 0) rim++; }
    if (cc && n + rim) {
      // (the read-back's rows run bottom up: each one goes to the canvas's row fh - 1 - y)
      const im = new ImageData(fw, fh), d = im.data;
      for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (px[4 * (y * fw + x)] === 0) d[4 * ((fh - 1 - y) * fw + x) + 3] = 255;
      const cv = document.createElement('canvas');
      cv.width = fw; cv.height = fh;
      cv.getContext('2d').putImageData(im, 0, 0);
      cc.drawImage(cv, 0, 0);
    }
    gl.clearStencil(0); gl.clear(gl.STENCIL_BUFFER_BIT); gl.disable(gl.STENCIL_TEST);
    gl.colorMask(maskRGB, maskRGB, maskRGB, maskA);
    repMarkFrame = -1;
    return n;
  }
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
    for (const e of progs.values()) {
      if (!invWarmable(e) || !e.p) continue;
      if (!e.warm) { warmDraw(e, false); e.warm = true; nFull++; }
      if (half && e.warmHalfWanted && !e.warmHalf && warmUpsample()) { warmDraw(e, true); e.warmHalf = true; e.warmHalfWanted = false; }
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
  // (only the current chain's programs: its own, and a parked plane's own (a plan's inv marked rest, the app's invPlan);
  // an older structure's program that was never drawn is not worth a stall)
  const invWarmable = (e) => e.inv && (e.name === 'inv' || e.name === 'invS') && e.state === 'ready' && !sideMode && !!cur.info && !!cur.info.inverse
    && (e.ikey === cur.info.inverse.key || (e.rest && e.chainKey === cur.key));
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
    init, begin, viewport, blit, layerKeep, layerInto, layerDraw, layerDrop, cauchyUsable, gpuDone, prestart, prestartModes, prestartNames, prestartCarry, carryNames, carryCauchyLinking, progStatus, discardChains, freeChain, chainStats, fillPointsStats, carryProbes, carryReserve, prestartLand, setStepsView, warmStatus, warmBarStep, GLOBE_PROGS, profile, setChain, drawGrid, drawRegion, carryPrep, carryLayers, carryLayersReserve, carryLayerFrames: () => layerFrames, carryResolve, carryResolveFrames: () => resFrames, carryResolveOrd: () => resOrd, carryDepthEnd, drawLines, drawColorPlot, drawLandscape, drawSphere, drawPreimage, carryState, refuseChain: (msg) => { if (!sideMode) { chainRefused = String(msg); lastError = chainRefused; } },
    // exact images (SPEC 4.5): see packShapes, drawInverse, inverseStatus, timer, CostGuard above
    // whether a REPT draw answered 'pending' since the last call: { prog } (its second pass's tiles { done, total }, or
    // null), else null; reset by it (the pane's status, glStatusNote)
    reptPendingTake: () => { const r = reptPendFlag ? { prog: reptProg } : null; reptPendFlag = false; reptProg = null; return r; },
    // (tests: the tile bound and the first pass's budget, 0 for their own; pass B held; the tile account since the last
    // read, reset by it)
    setReptTileSolves: (n) => { reptTileSolves = n > 0 ? n : 0; }, setReptFastNodes: (n) => { reptFastNodes = n > 0 ? n : 0; },
    holdReptB: (on) => { reptHoldB = !!on; },
    reptTiles: () => { const r = Object.assign({ kept: reptAccs.size }, reptStat); for (const k of Object.keys(reptStat)) reptStat[k] = 0; return r; },
    setReptNodes: (n) => { reptNodes = n > 0 ? Math.floor(n) : 1 << 30; }, setReptPoison: (p) => { reptPoison = p === 'nan' || p === 'inf' ? p : null; }, hatchAll, reptHatchFill, reptMarkCount, packShapes, INV_CURVE_MAX, setFormAnchor: (xy) => { formAnchor = Array.isArray(xy) && xy.every(Number.isFinite) ? xy.slice() : null; }, packShape, TKIND, drawInverse, newtRoots, inverseState, inverseWarmup, timer, CostGuard, warmInverse, flushHalf, beginHalfPre, compositeHalf, inverseEstimate, wantHalf,
    // a ready inverse program waits for warmInverse (call it at a quiet moment, then redraw)
    get inverseColdWaiting() { return inverseColdWaiting(); },
    inverseColdState,
    // the current chain's inverse program for shapes of own (undimmed) alpha alphaOwn and a view kind, with the
    // frame's formula bundle (packShapes), without starting a compile: 'ready' | 'pending' | 'error' | 'none' (no
    // program for this chain, or its compile not started). pathOf's GLR.inverseReady(...) is status === 'ready'.
    // (inv: a plan's own inverse op list, path.inv, in place of the chain's)
    inverseStatus(alphaOwn = 1, viewKind = 'flat', inv = null) { return ok ? invProgram(invB(alphaOwn), viewKind === 'globe', false, undefined, inv).state : 'none'; },
    // the same, starting the compile when allowed (not in side mode, after the chain's forward programs landed)
    inverseRequest(alphaOwn = 1, viewKind = 'flat') { if (!ok) return 'none'; const r = invProgram(invB(alphaOwn), viewKind === 'globe', true); if (r.state === 'pending') schedulePoll(); return r.state; },
    // the compile-time buffer size and the front count K of SPEC 4.2 for an alpha
    inverseB: (alphaOwn) => invB(alphaOwn), inverseK: (alpha) => invK(alpha),
    // SPEC 4.8: a w-box {x0, x1, y0, y1} of a shape's image -> drawInverse's scissor [x, y, w, h] in device px of the
    // current pane (bottom-left origin), padded by pad device px; null when it covers the pane (no scissor needed);
    // [0, 0, 0, 0] when it misses the pane (nothing to draw)
    globeScissorOf: (b, MVP, eye, pad = 4) => globeScissorOf(b, MVP, eye, pad),
    scissorOf: (b, view, dpr = 1, pad = 4) => scissorOf(b, view, dpr, pad),
    // the current frame around scissor sc [x, y, w, h]: up to four rects [x, y, w, h] in device px, each of positive size
    scissorAround: (sc) => scissorAround(sc),
    // where an old SphereMesh stands in for a rebuilding one, its guard box b in the current frame: 'whole' (the box
    // covers the frame: the old mesh alone), {sc, around} (the old mesh inside scissor sc, the new meshes in the rects
    // around it, scissorAround), or null (the box misses the frame: no stand-in)
    standInOf: (b, view, dpr = 1) => standInOf(b, view, dpr),
    // the current chain's inverse structure: {ok, key, reason, nOps} (null without a chain)
    get inverseInfo() { const v = cur.info && cur.info.inverse; return v ? { ok: !!v.ok, key: v.key, reason: v.reason || null, nOps: v.nOps || 0 } : null; },
    // draws made with an inverse program since load (tests, perf counters)
    get inverseDraws() { return invDraws; },
    get inverseHalfDraws() { return invHalfDraws; },
    // globe passes drawn with a scissor (globeScissorOf) and their scissored device px (tests)
    get carriedGlobeGraticule() { return carriedGlobeGraticule; },
    get inverseGlobeScissors() { return { n: invGlobeSc, px: invGlobeScPx }; },
    // internals for tests: shader sources (REGION_FS byte identity, the parity page's recording program, every program's uniforms against
    // the texture units finishLink sets, SAMPLER_UNITS)
    _src: { logK, DEFS, SAMPLER_UNITS, program: (name) => program(name), programSources: (name, mode) => sources(name, cur, mode || 0), warmCount, warmBarStep, REGION_FS: (s) => REGION_FS(!!s), PATTERN_SRC, INV_HEAD, INV_MAIN, IX_TIE_ORDER, LINE_VS, invB, invK, invSources: (B, globe, forms, extra, info) => invSources(info || cur.info, B, !!globe, forms || [], extra), invProgram, passData, invAltProgram,
      // tests: every new inverse program gets a unique uniform (a cold compile and first draw, SPEC 13.12)
      set coldCompiles(v) { coldNonce = v ? Math.max(1, coldNonce) : 0; }, get coldCompiles() { return coldNonce > 0; } },
    createMesh, createSkip, setSkip, createLines, destroy, alphaOnly, writeMask, clearRGB, keepInAlpha, dropCached, releaseLandscape: landRelease, createPreMesh, drawPreMapped, get preBytes() { return preBytes; }, M4, camera, globeLimb, clearOfLimb, landGeom, fitDist, hexRGB, phaseRGB, paletteRGB, palRGB, setPalette, palette, PATTERNS, STYLES, SEAM_EPS, SEAM_RINGS, CARRY_DISCS, CARRY_DISC_IN, wallTheta, CARRY_FAR_N, CARRY_JUMP_J, CARRY_JUMP_PX,
    get ok() { return ok; }, get lost() { return lost; }, get error() { return lastError; }, get gl() { return gl; }, get canvas() { return canvas; },
    // the steps a map applies, [lo, hi] (1-based; none when lo > hi)
    stepsOf,
    // since the last begin/viewport: error (plain words) when a chain program failed to compile, pending when one
    // is still compiling (an earlier chain version, or nothing, was drawn instead; onReady follows); compiling: such a
    // stand-in was drawn for a program of the current chain still compiling; waiting: a draw of any pane has drawn one
    // and that program has not landed yet; refining: the Landscape's refinement follows (the frame is drawn without it)
    frameStatus() { return { error: frameErr, pending: framePending, refining: frameRefining, alt: invAltUsed, compiling: frameCompiling, waiting: waitingNow(), over: frameOver }; },
    // any chain program compiling in the background
    get compiling() { for (const e of progs.values()) if (e.state === 'pending') return true; return false; },
    // false without KHR_parallel_shader_compile (SwiftShader, lavapipe): every link is synchronous, at
    // the draw that asks for it
    get parallelCompile() { return !!pcExt; },
    // whether programs `names` of the current chain (static ones by name) are linked for map; never starts one (with no
    // chain there is no chain program to wait for: true, and the card draws as it would)
    linked(names, map) { return !cur.info || names.every((n) => { const e = DEFS[n] && progs.get(progId(n, cur, map)); return !!e && e.state === 'ready'; }); },
    // how many programs are compiling (the panes' "Preparing the GPU" note counts them)
    get pendingLinks() { let n = 0; for (const e of progs.values()) if (e.state === 'pending') n++; return n; },
    // the programs compiling, as {id, key, offView} (key: the chain structure key, 'static' for the others; offView: a
    // view's no pane shows, e.offView)
    pending() { const out = []; for (const e of progs.values()) if (e.state === 'pending') out.push({ id: e.id, key: e.key, offView: !!e.offView }); return out; },
    // bareMs(map, names): ms the current chain's draws of programs names (default its area draws) for map have had
    // nothing to draw (0: they draw), and the tests' hold on its links
    bareMs, holdLinks, colourHeld: () => plotHeld, chainProgs, colorProgName,
    // the app drew a stand-in for programs still linking (a SphereMesh for bareMs): the frame stays pending, so what
    // waits for the final picture (the quality harness's settle, onReady's redraw) still waits
    markPending() { framePending = true; },
    // drops every cached map evaluation (e.g. to measure the uncached cost)
    clearCaches() { for (const r of live) freeCache(r); },
    get cacheBytes() { return cacheBytes; },
    // (tests) the map cache's budget in bytes, CACHE_BYTES
    get cacheBudget() { return CACHE_BYTES; }, set cacheBudget(v) { CACHE_BYTES = v; },
    // the steps view's carried colour's kept scratch entries (e.carry): {n, bytes}, both counted in cacheBytes
    get carryTmp() { let n = 0, bytes = 0; for (const e of tmpAll) if (e.carry) { n++; bytes += e.bytes; } return { n, bytes }; },
    // the keep time of those entries (ms, answers the one before; the tests shorten it to see a scrub outlast it)
    carryKeepMs(ms) { const was = CARRY_TMP_MS; if (ms > 0) CARRY_TMP_MS = ms; return was; },
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
    sheetInfo(map, W, end, uniq) { const p = ok ? sheetPlan(map, W, end, uniq) : null; return p ? { K: p.K, total: p.total, W: p.W, infinite: p.infinite, hom: !!p.hom } : null; },
    // TEST-HOOK (dropped from the published page by build.py)
    // (tests, SPEC 13.3) the points pts ([[x, y], ...]) through the current chain's mapPoint under map, read back by
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
    // (tests) the lines' CPU stand-ins made or refused last (cpuEntry): {n, m, ms} each
    lineStandIns: () => cpuLines.slice(),
    // (tests) the map-spec helpers: the cache key, the identity test and an earlier chain version's stand-in
    _map: { mapKeyOf: (m) => mapKeyOf(m), isIdent: (m) => isIdent(m), mapFor: (m, sigs) => mapFor(m, { sigs }) },
    // (walls tests) the landscape's grid and refinement read back
    landMesh: lwMesh, landRefine: lwRefine, landHeld: lwHeld,
    // (the programs compiled so far, name|chain|mode and state)
    landProgs: () => [...progs.values()].map((e) => `${e.id} ${e.state}`),
    // (a program's sources for the current chain, landTF of a given kind, to time its link)
    landSrc: (name, mode, kind) => {
      const d = DEFS[name], save = d.vs;
      if (kind) d.vs = () => UTIL_V + HEIGHT + LAND_TF_VS(kind);
      try { return sources(name, cur, mode || 0); } finally { d.vs = save; }
    },
    // TEST-HOOK
    // no program of chain structure key is still compiling (the ones its draws asked for landed or failed)
    ready(key) { for (const e of progs.values()) if (e.key === key && e.state === 'pending') return false; return true; },
    onRestore: null, onLost: null, onReady: null, onReptPending: null,
  };
  // a half-resolution batch is upsampled before any other draw (drawInverse flushes it itself)
  for (const k of ['begin', 'viewport', 'blit', 'drawGrid', 'drawRegion', 'drawPreMapped', 'drawLines', 'drawColorPlot', 'drawLandscape', 'drawSphere', 'drawPreimage']) {
    const f = api[k];
    // (a pre-pass layer waits for compositeHalf; the blit composites one that was left waiting)
    api[k] = function () { flushHalf(k === 'blit'); return f.apply(this, arguments); };
  }
  return api;
