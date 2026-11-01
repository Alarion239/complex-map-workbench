  // ---------------- program management ----------------
  const SAMPLER_UNITS = { uLut: 0, uW: 1, uT1: 2, uT2: 3, uNodes: 4, uEdges: 4, uPts: 4, uE0: 5, uE1: 6, uE2: 7, uLv: 8, uLst: 9, uRf: 10, uLp: 11, uPq: 12, uPv: 13, uPalT: 14 };
  function shader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }
  // ?glprof (issue #72): every program's link timed, for slow shader compilers (ANGLE's Direct3D 11 runs FXC at link
  // time). A record per link: the program (name, its chain version's key, map mode, inverse or not, source sizes), when
  // it started, and when it was done: KHR_parallel_shader_compile's COMPLETION_STATUS seen by a 5 ms poll, or the
  // return of a link read that waited (no extension, tests, exports). GLR.profile() returns them; ci/glprof.js reads them.
  const PROF = (() => { try { return new URLSearchParams(location.search).has('glprof'); } catch (err) { return false; } })();
  const profRecs = [];
  let profT = 0;
  function profStart(e, vsSrc, fsSrc) {
    if (!PROF) return;
    e.prof = { name: e.name, key: String(e.key).slice(0, 40), mode: e.mode || 0, inv: !!e.inv, vs: vsSrc.length, fs: fsSrc.length,
      t0: performance.now(), ms: null, by: '' };
    profRecs.push(e.prof);
    if (pcExt && !profT) profT = setTimeout(profPoll, 5);
  }
  function profPoll() {
    profT = 0;
    let open = false;
    for (const r of profRecs) {
      if (r.ms !== null) continue;
      const e = r.e || [...progs.values()].find((q) => q.prof === r);
      if (!e || !e.p) { r.ms = -1; r.by = 'dropped'; continue; }
      r.e = e;
      if (gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR)) { r.ms = performance.now() - r.t0; r.by = 'parallel'; } else open = true;
    }
    if (open) profT = setTimeout(profPoll, 5);
  }
  // a link read that waited (finishLink, finishInv): the program was done when it returned
  function profWaited(e) {
    if (PROF && e.prof && e.prof.ms === null) { e.prof.ms = performance.now() - e.prof.t0; e.prof.by = 'waited'; }
  }
  const profile = () => profRecs.map(({ e, ...r }) => r);
  // Starts compiling and linking. Nothing here waits for the driver: with KHR_parallel_shader_compile the work
  // runs in the background until finishLink reads the result.
  function startLink(e, vsSrc, fsSrc, tf) {
    profStart(e, vsSrc, fsSrc);
    const p = gl.createProgram();
    e.vs = shader(gl.VERTEX_SHADER, vsSrc); e.fs = shader(gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, e.vs); gl.attachShader(p, e.fs);
    if (tf) gl.transformFeedbackVaryings(p, ['tfOut'], gl.INTERLEAVED_ATTRIBS);
    gl.linkProgram(p);
    e.p = p;
  }
  // Reads the link status (blocks until the driver is done) and the uniform locations.
  function finishLink(e) {
    const p = e.p;
    const linked = gl.getProgramParameter(p, gl.LINK_STATUS);
    profWaited(e);
    if (!linked) {
      const log = (!gl.getShaderParameter(e.vs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(e.vs))
        || (!gl.getShaderParameter(e.fs, gl.COMPILE_STATUS) && gl.getShaderInfoLog(e.fs)) || gl.getProgramInfoLog(p) || 'link failed';
      gl.deleteShader(e.vs); gl.deleteShader(e.fs); gl.deleteProgram(p);
      e.p = e.vs = e.fs = null;
      e.state = 'error'; e.error = String(log).trim();
      lastError = e.error;
      console.warn('shader', e.name, e.error);   // shown in the pane in plain words (frameStatus)
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
    e.loc = loc; e.state = 'ready';
  }
  const F_UTIL = UTIL + FADE;
  // the region program's carried colour (drawRegion with st.carry): each fragment of a region's tessellated
  // mesh, wherever the map takes it, is coloured with the colour plane's colour of its source point z,
  // dcolor(f_T ∘ … ∘ f_{s+1}(z)) (uGs, uGt; the same z the region's patterns read, made absolute: vSrc + uQ), so the
  // colour travels with the region's points as its patterns do
  // the steps view's carried colour on a region's tessellated mesh: the region tiling's vertex stage (its places,
  // from the chain, the map cache or each triangle's own sheet) with its carry option (REGION_VS), and the carried
  // colour's fragment stage without a key of its own (CARRY_FS): dcolor(chainRange(vP, uGs, uGt)), nothing of the
  // region's patterns (their whole chain per fragment would be most of a glide frame); the vertex stage's
  // depth orders the sheets, so a fragment behind the front sheet drawn already is dropped before its colour
  const REGION_K_VS = (fetch, sheet, clip) => REGION_VS(false, fetch, { carry: true, sheet: !!sheet, clip: !!clip });
  const REGION_K_FS = (clip) => () => UTIL + DCOLOR + CARRY_FS(false, false, false, !!clip);
  // chain: the program includes the chain (one per chain structure); the others compile once
  const DEFS = {
    region: { chain: true, vs: () => REGION_VS(false, 'chain'), fs: () => F_UTIL + REGION_FS(false) },
    regionC: { chain: false, vs: () => FIN + REGION_VS(false, 'tex'), fs: () => F_UTIL + REGION_FS(false) },
    region0: { chain: false, vs: () => FIN + REGION_VS(false, 'local'), fs: () => F_UTIL + REGION_FS(false) },
    // (the steps view's carried colour, REGION_K_VS / REGION_K_FS; regionKC from the map cache, regionKS on each
    // triangle's own sheet)
    regionK: { chain: true, vs: () => REGION_K_VS('chain'), fs: REGION_K_FS() },
    // (and from the map cache: the places evaluated once per lattice point by the region tiling's transform feedback,
    // drawRegion's regionC; a chain program still, for the colour's chainRange per fragment)
    regionKC: { chain: true, vs: () => REGION_K_VS('tex'), fs: REGION_K_FS() },
    regionKS: { chain: true, sheet: true, vs: () => REGION_K_VS('chain', true), fs: REGION_K_FS() },
    // (and the fill after regionKC: only the triangles the cached places tear, on their centre's sheet)
    regionKSC: { chain: true, sheet: true, vs: () => REGION_K_VS('tex', true), fs: REGION_K_FS() },
    // (regionKS and regionKSC for a chain whose path has a clipped cut: REGION_VS's clip, CARRY_FS's clip)
    regionKSclip: { chain: true, sheet: true, vs: () => REGION_K_VS('chain', true, true), fs: REGION_K_FS(true) },
    regionKSCclip: { chain: true, sheet: true, vs: () => REGION_K_VS('tex', true, true), fs: REGION_K_FS(true) },
    // (and on a pre-mapped mesh, drawPreMapped with st.carry: places mapped on the CPU, the carried colour per fragment,
    // its depth the sheet key)
    regionPK: { chain: true, vs: () => PRE_VS(false), fs: () => UTIL + DCOLOR + CARRY_FS(false, true, true) },
    regionS: { chain: true, vs: () => REGION_VS(true, 'chain'), fs: () => F_UTIL + SHADE_GLOBE + REGION_FS(true) },
    regionSC: { chain: false, vs: () => FIN + REGION_VS(true, 'tex'), fs: () => F_UTIL + SHADE_GLOBE + REGION_FS(true) },
    regionP: { chain: false, vs: () => PRE_VS(false), fs: () => F_UTIL + REGION_PRE_FS(false) },
    regionSP: { chain: false, vs: () => PRE_VS(true), fs: () => F_UTIL + SHADE_GLOBE + REGION_PRE_FS(true) },
    line: { chain: true, vs: () => LINE_VS('', 'chain'), fs: () => FADE + LINE_FS },
    lineC: { chain: false, vs: () => FIN + LINE_VS('', 'tex'), fs: () => FADE + LINE_FS },
    line0: { chain: false, vs: () => FIN + LINE_VS('', 'local'), fs: () => FADE + LINE_FS },
    lineS: { chain: true, vs: () => LINE_VS('S', 'chain'), fs: () => FADE + LINE_FS },
    lineSC: { chain: false, vs: () => FIN + LINE_VS('S', 'tex'), fs: () => FADE + LINE_FS },
    lineF: { chain: false, vs: () => FIN + LINE_VS('F', 'abs'), fs: () => FADE + LINE_FS },
    lineFM: { chain: true, vs: () => LINE_VS('F', 'chain'), fs: () => FADE + LINE_FS },
    lineFC: { chain: false, vs: () => FIN + LINE_VS('F', 'tex'), fs: () => FADE + LINE_FS },
    // the map cache passes: a point draw into the cache texture (rt), else transform feedback
    tfRegion: { chain: true, vs: () => TF_REGION_VS(rtOK), fs: () => (rtOK ? RT_FS : TF_FS), tf: 'rt' },
    tfLine: { chain: true, vs: () => TF_LINE_VS(rtOK), fs: () => (rtOK ? RT_FS : TF_FS), tf: 'rt' },
    // TEMP-DEBUG-HOOK (removed before publishing)
    evalPt: { chain: true, vs: () => EVAL_VS, fs: () => TF_FS, tf: true },
    // TEMP-DEBUG-HOOK
    grid: { chain: false, vs: () => QUAD_VS, fs: () => GRID_FS },
    color: { chain: true, vs: () => QUAD_VS, fs: () => UTIL + DCOLOR + COLORPLOT_FS },
    // (#366 F: the steps view's carried colour, CARRY_VS)
    carry: { chain: true, vs: () => CARRY_VS, fs: () => UTIL + DCOLOR + CARRY_FS(false) },
    carryId: { chain: true, vs: () => CARRY_VS, fs: () => UTIL + DCOLOR + CARRY_FS(true) },
    cauchy: { chain: false, vs: () => QUAD_VS, fs: () => UTIL + DCOLOR + CAUCHY_FS },
    // (#235: the residue theorem's picture of the same style; its chain's F, compiled when the style first shows for a chain)
    cauchyF: { chain: true, vs: () => QUAD_VS, fs: () => UTIL + DCOLOR + CAUCHYF_FS },
    pre: { chain: true, vs: () => QUAD_VS, fs: () => PRE_FS('') },
    preS: { chain: true, vs: () => SPHERE_VS, fs: () => PRE_FS('', true) },
    // (the heights, uPass 0, and the refinement, 1 and 2: one program, one call site of the chain, LAND_TF_VS)
    // (issue #47: and the edge pass, uPass 3, of the cut kind tfKind gives this chain version and map mode)
    landTF: { chain: true, vs: (ch, mode) => UTIL_V + HEIGHT + LAND_TF_VS(tfKind(ch, mode)), fs: () => TF_FS, tf: true, kind: (ch, mode) => tfKind(ch, mode) },
    // (the refinement's levels and vertices: no chain, compiled once per page, LAND_LV_VS / LAND_RP_VS / LAND_RA_VS)
    landLv: { chain: false, vs: () => LAND_LV_VS, fs: () => TF_FS, tf: true },
    landRP: { chain: false, vs: () => LAND_RP_VS, fs: () => TF_FS, tf: true },
    landRA: { chain: false, vs: () => LAND_RA_VS, fs: () => TF_FS, tf: true },
    landNrm: { chain: false, vs: () => LAND_NRM_VS, fs: () => TF_FS, tf: true },
    // (the edge pass, one program per kind: S the stages' sheets, H a deformation's, 2 bisection; LAND_EDGE_VS)
    landEdgeS: { chain: true, vs: () => UTIL_V + HEIGHT + LAND_EDGE_VS('S'), fs: () => TF_FS, tf: true },
    landEdgeH: { chain: true, sheet: true, vs: () => UTIL_V + HEIGHT + LAND_EDGE_VS('H'), fs: () => TF_FS, tf: true },
    landEdge2: { chain: true, vs: () => UTIL_V + HEIGHT + LAND_EDGE_VS('2'), fs: () => TF_FS, tf: true },
    // (the base cells: the base's fragment stage, F at the fragment and no fade, so a formula's first Landscape compiles
    // what it did before the walls; r2 review math-2)
    land: { chain: true, vs: () => LAND_VS, fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + LAND_FS(false, false, true) },
    landR: { chain: false, vs: () => LAND_R_VS, fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + HEIGHT + LAND_FS(false, true) },
    landB: { chain: false, vs: () => LAND_B_VS, fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + HEIGHT + LAND_FS(false, true) },
    floor: { chain: true, vs: () => FLOOR_VS, fs: () => UTIL + DCOLOR + LAND_COMMON + TIERS + FLOOR_FS },
    ulevel: { chain: false, vs: () => ULEVEL_VS, fs: () => ULEVEL_FS },
    probe: { chain: true, vs: () => UTIL_V + HEIGHT + PROBE_VS(false), fs: () => MARK_FS },
    // All sheets (only for chains whose source has chainSheetRange: see sheetPlan)
    // (its base pass, as in the base; the refinement's passes, uPass 1 and 2, in landSheetRF: inside landSheetTF they
    // made a formula's first All-sheets surface link 2 to 3 times as long and its first draw held the GPU process for
    // 0.5 to 1 s, r3. landSheetRF compiles once the surface is drawn and is taken into use when it has settled, sheetRF)
    landSheetTF: { chain: true, sheet: true, vs: () => UTIL_V + HEIGHT + LAND_SHEET_TF_VS(false), fs: () => TF_FS, tf: true },
    landSheetRF: { chain: true, sheet: true, vs: () => UTIL_V + HEIGHT + LAND_SHEET_TF_VS(true), fs: () => TF_FS, tf: true },
    landSheet: { chain: true, sheet: true, vs: () => LAND_SHEET_VS(false), fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + HEIGHT + LAND_FS(true) },
    landSheetC: { chain: true, sheet: true, vs: () => LAND_SHEET_VS(true), fs: () => UTIL + DCOLOR + SHADE + LAND_COMMON + HEIGHT + LAND_FS(true) },
    probeSheet: { chain: true, sheet: true, vs: () => UTIL_V + HEIGHT + PROBE_VS(true), fs: () => MARK_FS },
    mark: { chain: false, vs: () => MARK_VS, fs: () => MARK_FS },
    sphere: { chain: false, vs: () => SPHERE_VS, fs: () => UTIL + DCOLOR + SHADE_GLOBE + TIERS + SPHERE_FS(false) },
    sphereP: { chain: true, vs: () => SPHERE_VS, fs: () => UTIL + DCOLOR + SHADE_GLOBE + TIERS + SPHERE_FS(true) },
    disc: { chain: false, vs: () => DISC_VS, fs: () => UTIL + 'uniform float uDpr;\n' + TIERS + DISC_FS },
    invUp: { chain: false, vs: () => QUAD_VS, fs: () => INV_UP_FS },
    keepA: { chain: false, vs: () => QUAD_VS, fs: () => 'out vec4 o;\nvoid main() { o = vec4(0.0); }\n' },
  };
  // vertex-stage subset of UTIL (no derivatives)
  const UTIL_V = `
float wabs(vec2 w) {
  float m = max(abs(w.x), abs(w.y));
  if (!(m > 0.0)) return 0.0;
  if (m > 1e18 || m < 1e-18) return m * length(w / m);
  return length(w);
}
`;
  // A stage gets the chain library only when it calls into it (the fragment stages of the map-cache, region and line
  // programs do not), so each added step compiles about half the GLSL it used to (spec 8.7); a stage whose only use
  // is cfin gets FIN.
  let libRe = null;
  function libUse(src) {
    if (!libRe) {
      const L = GLChain.LIB;
      const ids = new Set(['mapPoint', 'mapF', 'chainStep', 'chainRange', 'chainHom', 'chainHomAll', 'chainStage', 'chainIsDeriv', 'chainSheet', 'chainSheetRange', 'chainSheetHom', 'derivIn', 'uChain', 'uMode', 'uA', 'uB', 'uHi', 'uT', 'uBase', 'uPost', 'postOf', 'uSheetW', 'uDeriv']);
      for (const m of L.matchAll(/\b(?:vec[234]|float|int|bool|void|mat[234])\s+(\w+)\s*\(/g)) ids.add(m[1]);
      for (const m of L.matchAll(/#define\s+(\w+)/g)) ids.add(m[1]);
      ids.delete('cfin');
      libRe = new RegExp('\\b(?:' + [...ids].join('|') + '|cxs\\d+_\\w+)\\b');
    }
    return libRe.test(src) ? 2 : /\bcfin\b/.test(src) ? 1 : 0;
  }
  // (issue #47) the cut kind landTF's own edge pass handles for chain version ch in map mode `mode`, so that the
  // surface's heights and its edge pass are one program: 'S' in map mode 0 when every cut a step of the chain can make
  // is one the stages' sheets continue (cutModeOf's mode 1, chainSheetRange), else 'N': the plain heights (mapF), no
  // edge pass compiled in, and the frames with cuts use the separate edge program (landEdgeS / landEdgeH / landEdge2).
  // (D3D11 links the edge loop around the inlined chain slowly: the deformation's landTF of Mobius then z^3 took 18 to
  // 30 s of link time-share on an Intel Iris Xe, against under 1.7 s for the plain one; glprof runs 40964003719 and
  // 40998168010)
  function tfKind(ch, mode) {
    const info = ch && ch.info;
    if (!info || !Array.isArray(info.cutKinds) || (mode || 0) !== 0) return 'N';
    let sheet = false;
    for (const c of info.cutKinds) {
      const kd = c && c.f;
      if (kd === 'other' || kd === 'deriv') return 'N';
      if (kd && kd !== 'none') sheet = true;
    }
    return sheet && /\bchainSheetRange\b/.test(info.source || '') ? 'S' : 'N';
  }
  function sources(name, ch, mode = 0) {
    const d = DEFS[name];
    const vs = d.vs(ch, mode), fs = d.fs();
    if (!d.chain) return [HEAD + vs, HEAD + fs];
    // (the sheet programs also take the deformation's sheets, chainSheetHom: GLChain's sheetHom)
    const lib = GLChain.LIB + '\n' + ch.info.source + (d.sheet ? ch.info.sheetHom || '' : '') + MAP(ch.info, mode);
    const pre = (s) => ['', FIN, lib][libUse(s)];
    return [HEAD + pre(vs) + vs, HEAD + pre(fs) + fs];
  }
  // shader limits are reported in plain words in the pane (spec 8.6)
  function friendly(err) {
    if (/uniform/i.test(err)) return $t('This chain needs more shader parameters than this GPU allows. Remove or shorten a step.');
    return $t('The GPU could not compile this chain ({err}).', { err: String(err).split('\n')[0].slice(0, 90) });
  }
  let useClock = 0, pollT = 0;
  const PROG_KEEP = 3;   // chain versions kept per program (undo, redo and bypass toggles reuse them)
  // the id of program `name` in progs: chain programs per chain version and map mode (the draw's map, as use() applies
  // it to version ch), the others once; landTF also per kind (tfKind): a log's or z^a's cut angle and branch are
  // uniforms, so the chain's key stays when its cuts change kind (sheet <-> other) and the kind flips S <-> N (#168 review)
  function progId(name, ch, map) {
    const d = DEFS[name];
    if (!(d && d.chain)) return name + '|static';
    const mode = modeOf(mapFor(map, ch));
    return `${name}|${ch.key}|m${mode}${d.kind ? '|' + d.kind(ch, mode) : ''}`;
  }
  // The program `name` for chain version ch (null for programs without the chain) and the draw's map (its mode: one
  // program per mode, MAP); start: begin compiling if needed. Returns the program once it is ready, else null.
  function getProg(name, ch, start, map) {
    const d = DEFS[name];
    if (!d) throw new Error('unknown program ' + name);
    if (d.chain && !(ch && ch.info)) return null;
    const key = d.chain ? ch.key : 'static';
    const mode = d.chain ? modeOf(mapFor(map, ch)) : 0;
    const id = progId(name, ch, map);
    let e = progs.get(id);
    if (!e) {
      if (!start) return null;
      e = { id, name, key, mode, chain: !!d.chain, ch: d.chain ? ch : null, state: 'pending', used: ++useClock, side: !!(sideMode && d.chain), born: performance.now() };
      progs.set(id, e);
      e.rt = d.tf === 'rt' && rtOK;
      try { const [vs, fs] = sources(name, ch, mode); startLink(e, vs, fs, d.tf === 'rt' ? !rtOK : d.tf); } catch (err) { e.state = 'error'; e.error = String(err.message || err); lastError = e.error; }
      if (d.chain) evictProgs(name, mode);
    }
    e.used = ++useClock;
    if (d.chain) e.ch = ch;
    if (!sideMode) e.side = false;   // a side chain's program that the current chain now uses (an example loaded)
    if (e.state === 'pending') {
      // programs without the chain compile once (the 2D view's at init, PRESTART_2D); their first use does not wait
      // either: a synchronous link held the main thread 0.3-1.8 s per program on Direct3D 11 (Iris Xe), ~4 s before
      // the first frame, while the background links run in parallel (1.3 s for all seven). syncDepth (tests) and
      // syncFwd (figure and video exports) wait.
      if (heldOf(e)) { /* (tests: holdLinks) */ }
      else if (!pcExt || syncDepth > 0 || syncFwd > 0) finishLink(e);
      else if (gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR) && (!d.chain || (groupDone(e) && canFinish(e)))) { finishLink(e); if (d.chain) finishGroup(e); }
      else schedulePoll();
    }
    return e.state === 'ready' ? e : null;
  }
  // Static programs started ahead of their first use, in the background (KHR_parallel_shader_compile): getProg links
  // a static program synchronously at its first use, so the first frame of a view paid for all of its programs. The
  // globes' (sphere, regionSC, lineSC, disc, mark) held the first frame after a switch to Sphere for 35-45 ms of main
  // thread, over 50 with the stage-0 inverse pass's start (P3 review). The app calls this when a switch to Sphere is
  // coming (the pointer over a Sphere control, or the switch itself, a frame ahead of its draw): the links run in
  // parallel, and the first use reads a finished one or waits for the slowest only. -> the number started
  function prestart(names) {
    if (!ok || lost || !pcExt) return 0;
    let n = 0;
    for (const name of names) {
      const d = DEFS[name], id = name + '|static';
      if (!d || d.chain || progs.has(id)) continue;
      const e = { id, name, key: 'static', mode: 0, chain: false, ch: null, state: 'pending', used: ++useClock, side: false };
      progs.set(id, e);
      e.rt = d.tf === 'rt' && rtOK;
      try { const [vs, fs] = sources(name, null); startLink(e, vs, fs, d.tf === 'rt' ? !rtOK : d.tf); n++; } catch (err) { e.state = 'error'; e.error = String(err.message || err); lastError = e.error; }
    }
    // finished by the poll when their links land (or at their first use, whichever comes first)
    if (n) schedulePoll();
    return n;
  }
  // A deformation is coming (the app: the pointer on its toggle): the current chain's programs that the views draw now
  // start compiling for these map modes too, in the background, so the homotopy's first frames find them (MAP compiles
  // a mode at its first draw). Never without KHR_parallel_shader_compile (that would link synchronously here).
  // -> the number started
  // (the Landscape's edge passes are left to edgeAhead, which knows the ones a deformation draws, in aheadMode: the
  // last deformation mode asked for here)
  let aheadMode = 1;
  const EDGE_PROGS = ['landEdgeS', 'landEdgeH', 'landEdge2'];
  // (the programs prestartModes starts, started or not: each chain program the views draw for the current chain, in
  // each of these map modes)
  function modesPlan(modes) {
    const out = [];
    if (sideMode || !cur.info) return out;
    for (const e of [...progs.values()]) {
      if (!e.chain || e.inv || e.side || e.key !== cur.key || e.mode !== 0 || EDGE_PROGS.includes(e.name)) continue;
      for (const m of modes) {
        const mm = modeOf({ mode: m });
        if (mm) out.push({ name: e.name, mode: mm, id: progId(e.name, cur, { mode: mm }) });
      }
    }
    return out;
  }
  function prestartModes(modes) {
    const dm = modes.map((m) => modeOf({ mode: m })).find((m) => m === 1 || m === 3);
    if (dm) aheadMode = dm;
    if (!ok || lost || !pcExt || sideMode || !cur.info) return 0;
    let n = 0;
    for (const q of modesPlan(modes)) {
      if (progs.has(q.id)) continue;
      getProg(q.name, cur, true, { mode: q.mode });
      n++;
    }
    return n;
  }
  // ((#366 prototype) the steps view's glide: the current chain's programs by name and map mode, started in the
  // background (KHR_parallel_shader_compile) so the first glide finds them linked: the region meshes, the lines, their
  // transform feedback, the colour plot and the pull-backs, in modes 0 (a plane) and 1 (a step's homotopy))
  // (without the extension a link blocks: perf's suggestion on #448, they are linked one at a time in idle time
  // instead, so the block lands before the first glide rather than in it)
  function prestartNames(names, modes) {
    if (!ok || lost || sideMode || !cur.info) return 0;
    if (!pcExt) {
      const todo = [];
      for (const name of names) for (const m of modes) if (DEFS[name]) todo.push([name, m]);
      const key = cur.key, idle = typeof requestIdleCallback === 'function' ? (f) => requestIdleCallback(f, { timeout: 2000 }) : (f) => setTimeout(f, 50);
      const next = () => {
        if (!ok || lost || sideMode || cur.key !== key || !todo.length) return;
        const [name, m] = todo.shift();
        if (!progs.has(progId(name, cur, { mode: m }))) { try { getProg(name, cur, true, { mode: m }); } catch (e) { /* (a program this build has not) */ } }
        idle(next);
      };
      idle(next);
      return todo.length;
    }
    let n = 0;
    for (const name of names) for (const m of modes) {
      if (!DEFS[name]) continue;
      const id = progId(name, cur, { mode: m });
      if (progs.has(id)) continue;
      try { getProg(name, cur, true, { mode: m }); n++; } catch (e) { /* (a program this build has not) */ }
    }
    if (n) schedulePoll();
    return n;
  }
  // (issue #72) the Landscape's programs for the current chain (its heights and surface, mode 0, and the normals'
  // static one), started in the background ahead of a switch to Landscape, as prestartModes does for a deformation.
  // -> the number started
  function prestartLand() {
    if (!ok || lost || !pcExt || sideMode || !cur.info) return 0;
    let n = prestart(LAND_STATIC);
    for (const name of LAND_CHAIN) {
      if (progs.has(progId(name, cur, { mode: 0 }))) continue;
      getProg(name, cur, true, { mode: 0 });
      n++;
    }
    return n;
  }
  // the static programs of the 2D views' first frame (the grid, cached fills and curves, identity fills and curves),
  // started at init and after a context restore: that frame needs them anyway, and their links overlap the app's
  // start-up instead of each other
  const PRESTART_2D = ['grid', 'regionC', 'region0', 'lineC', 'line0', 'mark'];
  // the lists of the app's background warm-up (the globes' static programs, the Landscape's static one and its chain
  // programs in mode 0): what prestart and prestartLand start, and what warmStatus counts
  const GLOBE_PROGS = ['sphere', 'regionSC', 'lineSC', 'disc', 'mark'];
  const LAND_STATIC = ['landNrm'];
  const LAND_CHAIN = ['landTF', 'land'];
  // The ids of the programs of one warm-up group ('2d', 'modes' for these map modes, 'globe', 'land'), whether or not
  // they have started: the lists above and the current chain's, so the total is known before the work is
  function warmIds(group, modes) {
    if (group === '2d') return PRESTART_2D.map((n) => n + '|static');
    if (group === 'globe') return GLOBE_PROGS.map((n) => n + '|static');
    if (!ok || lost || !pcExt || sideMode || !cur.info) return group === 'land' ? LAND_STATIC.map((n) => n + '|static') : [];
    if (group === 'modes') return modesPlan(modes || []).map((q) => q.id);
    if (group === 'land') return LAND_STATIC.map((n) => n + '|static').concat(LAND_CHAIN.map((n) => progId(n, cur, { mode: 0 })));
    return [];
  }
  // How far the programs have come: {done, total, pending, groups}. The ids of each group count once each (a program in
  // two groups counts in the first); done: linked (or failed: nothing more will come of it). Programs outside the
  // lists that are compiling now (the exact images' inverse program, the chain's first-frame programs) are counted in
  // total and pending, not in done, so the bar is full only when nothing is left. stateOf(id) is 'pending', 'ready',
  // 'error' or undefined (not started); it reads the programs' own state, which the poll keeps current from
  // COMPLETION_STATUS_KHR: a pending program is never asked for its link status here
  function warmCount(groups, stateOf, extraPending) {
    const seen = new Set(), out = { done: 0, total: 0, pending: 0, groups: {} };
    for (const [g, ids] of groups) {
      const r = { done: 0, total: 0 };
      for (const id of ids) {
        if (seen.has(id)) continue;
        seen.add(id); r.total++;
        const st = stateOf(id);
        if (st === 'ready' || st === 'error') r.done++; else if (st === 'pending') out.pending++;
      }
      out.groups[g] = r; out.done += r.done; out.total += r.total;
    }
    for (const id of extraPending || []) if (!seen.has(id)) { seen.add(id); out.total++; out.pending++; }
    return out;
  }
  // (known: the chain's own programs are listed: before its first frame only the static lists are, and the total is
  // still to grow)
  function warmStatus(modes) {
    if (!ok || lost || !pcExt) return { done: 0, total: 0, pending: 0, groups: {}, known: true };
    const groups = ['2d', 'modes', 'globe', 'land'].map((g) => [g, warmIds(g, modes)]);
    const extra = [];
    for (const e of progs.values()) if (e.state === 'pending' && !e.side) extra.push(e.id);
    const r = warmCount(groups, (id) => { const e = progs.get(id); return e && e.state; }, extra);
    r.known = groups[1][1].length > 0;
    return r;
  }
  // The bar's rule, one step (a pure function of the counts and the clock, so it can be tested without a page):
  // s: the state it returned last (null at the start), st: {done, total, unknown}, now: ms, o: {delay, hold}.
  // -> {t0, frac, visible, indet, doneAt, working}. The bar shows only when work is still pending `delay` ms after it began (a
  // warm program cache lands everything before that, and nothing flickers), never goes back (the total may grow as the
  // chain's programs are listed: the fraction holds until the work catches up), is indeterminate while the total is
  // unknown, and hides `hold` ms after the work is done. A later piece of work starts a new round.
  function warmBarStep(s, st, now, o) {
    const delay = o && o.delay != null ? o.delay : 300, hold = o && o.hold != null ? o.hold : 400;
    s = s ? Object.assign({}, s) : { t0: now, frac: 0, visible: false, indet: false, doneAt: -1, working: false };
    const work = st.total > st.done || !!st.unknown;
    if (st.total > 0) s.frac = Math.max(s.frac, Math.min(1, st.done / st.total));
    s.indet = !!st.unknown && work;
    if (work) {
      if (!s.working) { s.working = true; s.t0 = now; }   // (when this piece of work began)
      s.doneAt = -1;
      if (!s.visible && now - s.t0 >= delay) s.visible = true;
    } else {
      s.working = false;
      if (s.visible) {
        if (s.doneAt < 0) s.doneAt = now;
        s.frac = 1;
        if (now - s.doneAt >= hold) { s.visible = false; s.frac = 0; s.doneAt = -1; }
      } else s.frac = 0;
    }
    return s;
  }
  // A chain program whose background compile has landed is taken into use at most one per FRESH_MS while an earlier
  // version stands in (always for side chains): ANGLE completes a program's Metal side when it is first drawn, and
  // several of those in one frame held the GPU process, and so every frame on the page, for 100-250 ms (spec 8.7).
  const FRESH_MS = 48;
  let freshT = -1e9;
  // A surface's chain programs are taken into use together, in one frame: ANGLE completes each one's Metal side at its
  // first draw, and a formula's first Landscape drew its heights' program a frame or more before its surface's, which
  // held the GPU process twice (r2 review math-2: a second stall of 0.85 to 1.1 s under load; the base, one stall).
  // A member finishes only when every member of its group has compiled; the group counts as one for FRESH_MS
  // (a group is one chain version in one map mode: a draw takes all three with the same map)
  const GROUPS = [['landTF', 'land', 'floor'], ['landSheetTF', 'landSheet', 'floor']];
  // (the floor goes with the surface it is drawn under: All sheets' when their programs were asked for, r3: through the
  // principal group it started the principal programs alongside the sheets', a second family compiling at a cold open)
  const groupOf = (e) => (e.name === 'floor' ? (progs.has(progId('landSheet', e.ch, { mode: e.mode })) ? GROUPS[1] : GROUPS[0]) : GROUPS.find((g) => g.includes(e.name)) || null);
  function groupDone(e) {
    const g = groupOf(e);
    if (!g || !pcExt) return true;
    for (const n of g) {
      if (n === e.name) continue;
      const q = progs.get(progId(n, e.ch, { mode: e.mode }));
      if (!q) { getProg(n, e.ch, true, { mode: e.mode }); return false; }
      if (q.state === 'pending' && !gl.getProgramParameter(q.p, pcExt.COMPLETION_STATUS_KHR)) return false;
    }
    return true;
  }
  function finishGroup(e) {
    const g = groupOf(e);
    if (!g) return;
    for (const n of g) { const q = progs.get(progId(n, e.ch, { mode: e.mode })); if (q && q !== e && q.state === 'pending') finishLink(q); }
  }
  function canFinish(e) {
    const now = performance.now();
    if (now - freshT < FRESH_MS && (e.side || hist.some((h) => { const q = progs.get(progId(e.name, h, { mode: e.mode })); return q && q.state === 'ready'; }))) return false;
    freshT = now;
    return true;
  }
  // side chains keep their own programs (SIDE_KEEP per program name) and never evict the current chain's history
  const SIDE_KEEP = 12;
  function evictProgs(name, mode) {
    const list = [...progs.values()].filter((e) => e.name === name && e.mode === mode && e.chain && e.key !== cur.key && e.side === sideMode && !(sideMode && side && e.key === side.cur.key));
    list.sort((a, b) => a.used - b.used);
    for (let i = 0; i < list.length - ((sideMode ? SIDE_KEEP : PROG_KEEP) - 1); i++) {
      const e = list[i];
      if (e.p) gl.deleteProgram(e.p);
      if (e.vs) gl.deleteShader(e.vs);
      if (e.fs) gl.deleteShader(e.fs);
      progs.delete(e.id);
    }
  }
  function schedulePoll() { if (!pollT) pollT = setTimeout(pollCompiles, 16); }
  function pollCompiles() {
    pollT = 0;
    if (!gl || lost) return;
    let main = false, sided = false, waiting = false;
    for (const e of progs.values()) {
      if (e.state !== 'pending' || heldOf(e)) continue;
      if (gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR) && (e.inv || !e.chain || (groupDone(e) && canFinish(e)))) { (e.inv ? finishInv : finishLink)(e); if (e.chain) finishGroup(e); if (e.side) sided = true; else main = true; } else if (e.state === 'pending') waiting = true;
    }
    if (waiting) schedulePoll();
    // which draws can now redraw: main (the current chain and its history), side (side chains)
    if ((main || sided) && api.onReady) api.onReady({ main, side: sided });
  }
  // (issue #72, I) How long the current chain's area draws (region, or tfRegion for the cached path; the deformation's
  // start for a mode still compiling) have had nothing to draw: their own programs still linking and no earlier chain
  // version ready to stand in. 0 as soon as a draw would find a program (one ready, or a link complete, so the frame
  // that leaves the app's stand-in draws the GPU picture: no blank frame between), when none was asked for yet, or
  // after a failed compile (reported, never covered up). The same program table as pendingLinks and pending().
  const AREA_PROGS = ['region', 'tfRegion'];
  function drawable(e) {
    if (!e) return false;
    if (e.state === 'ready') return true;
    if (e.state !== 'pending' || heldOf(e)) return false;
    return !pcExt || syncDepth > 0 || syncFwd > 0 || (gl.getProgramParameter(e.p, pcExt.COMPLETION_STATUS_KHR) && (!e.chain || groupDone(e)));
  }
  function bareMs(map) {
    if (!ok || lost || sideMode || !cur.info) return 0;
    const maps = modeOf(map) ? [map, startOf(map)] : [map];
    const own = maps.flatMap((m) => AREA_PROGS.map((n) => progs.get(progId(n, cur, m)))).filter(Boolean);
    if (!own.length || own.some((e) => e.state === 'error' || drawable(e))) return 0;
    for (const h of hist) for (const n of AREA_PROGS) { const q = progs.get(progId(n, h, map)); if (q && q.state === 'ready') return 0; }
    return performance.now() - Math.min(...own.map((e) => e.born || performance.now()));
  }
  // (tests) holdLinks(true): the current chain's forward programs stay linking (COMPLETION_STATUS held false, and no
  // synchronous link) until holdLinks(false), on any back end: SwiftShader and lavapipe link synchronously. ?glhold
  // starts with it on (a cold load: no earlier version of the chain)
  let held = (() => { try { return new URLSearchParams(location.search).has('glhold'); } catch (err) { return false; } })();
  function heldOf(e) { return held && e.chain && !e.side && !e.inv; }
  function holdLinks(on) {
    held = !!on;
    if (!held && api.onReady) api.onReady({ main: true, side: false });
  }
  // The program `name` for the current chain. While it compiles in the background, the newest earlier chain version
  // whose program is ready draws instead (use() maps the map spec onto that version), so a frame never waits for a
  // compile; null when nothing can draw: frameErr says why for a failed compile, framePending for one in flight.
  // map: the draw's map (the one passed to use()), which picks the program of its mode
  function program(name, map) {
    const P = getProg(name, cur, true, map);
    if (P) return P;
    const e = progs.get(progId(name, cur, map));
    if (e && e.state === 'error') { frameErr = friendly(e.error); return null; }
    if (!DEFS[name].chain) { if (e && e.state === 'pending') { framePending = true; standIn(e.id); } return null; }
    if (!cur.info) return null;
    framePending = true;
    if (e && e.state === 'pending') standIn(e.id);
    if (sideMode) return null;   // a side chain draws only with its own programs
    for (const h of hist) { const Q = getProg(name, h, false, map); if (Q) return Q; }
    return modeOf(map) ? getProg(name, cur, false, startOf(map)) : null;
  }
  // a deformation's start through the plain chain (mode 0), as mapFor shows a homotopy or morph through a changed step:
  // what draws while the program of the deformation's own mode compiles (its first frames: MAP compiles a mode only
  // when a draw needs it)
  function startOf(m) {
    const mode = modeOf(m);
    if (mode === 1) return { mode: 0, a: m.base || 0, b: (m.hi || 0) - 1 };
    if (mode === 2 || mode === 3) return { mode: 0, a: m.base || 0, b: m.a || 0 };
    return m;
  }
  // the map program P draws for the draw's map: mapFor's translation to P's chain version, and the deformation's start
  // when P is a plain program standing in for a mode still compiling
  function mapIn(P, map) {
    const m = mapFor(map, P.ch);
    return P.mode === modeOf(m) ? m : startOf(m);
  }
  // a map spec of the current chain, applied to an earlier version ch: steps before the first structural change are
  // shared; a homotopy or morph through a changed step shows its start
  function mapFor(map, ch) {
    if (!map || !ch || ch === cur) return map;
    const a = ch.sigs, b = cur.sigs;
    let p = 0;
    while (p < a.length && p < b.length && a[p] === b[p]) p++;
    const mode = map.mode || 0;
    // (v16: a changed step inside the post: the start of the bracketed part, from the source plane)
    if ((mode === 1 || mode === 3) && (map.post || 0) >= p + 1) { const lo = mode === 1 ? (map.hi || 0) - 1 : (map.a || 0); return { mode: 0, a: map.base || 0, b: Math.min(lo, p) }; }
    if (mode === 1 && (map.hi || 0) > p) return { mode: 0, a: map.base || 0, b: (map.hi || 0) - 1 };
    if ((mode === 2 || mode === 3) && (map.b || 0) > p) return { mode: 0, a: map.base || 0, b: map.a || 0 };
    return map;
  }
  const LIVE = (sig) => sig !== 'off' && sig !== 'err' && sig !== 'unsupported';
  // true when no step that the map applies acts on the GPU (the chain skips the others): drawn without the chain
  function isIdent(map) {
    if (!cur.info) return true;
    const m = map || {}, mode = m.mode || 0;
    const lo = mode === 0 ? (m.a || 0) + 1 : (m.base || 0) + 1, hi = Math.max(mode === 1 ? (m.hi || 0) : (m.b || 0), mode === 1 || mode === 3 ? (m.post || 0) : 0);
    for (let k = Math.max(1, lo); k <= Math.min(hi, cur.sigs.length); k++) if (LIVE(cur.sigs[k - 1])) return false;
    return true;
  }
  // uniform helpers (missing uniforms are optimised away: location null is a no-op)
  const L_ = (P, n) => P.loc[n] ?? null;
  const u1f = (P, n, v) => gl.uniform1f(L_(P, n), v);
  const u1i = (P, n, v) => gl.uniform1i(L_(P, n), v);
  const u2f = (P, n, a, b) => gl.uniform2f(L_(P, n), a, b);
  const u3 = (P, n, v) => gl.uniform3f(L_(P, n), v[0], v[1], v[2]);
  const u4f = (P, n, a, b, c, d) => gl.uniform4f(L_(P, n), a, b, c, d);
  const u2i = (P, n, a, b) => gl.uniform2i(L_(P, n), a, b);
  const uM4 = (P, n, m) => gl.uniformMatrix4fv(L_(P, n), false, m);
  function use(P, map) {
    gl.useProgram(P.p);
    // TEMP-DEBUG-HOOK (removed before publishing)
    // (walls tests, issue #52) api._lwLog = []: [name, time] of each program's first use, for the cold-open timing
    try { if (api._lwLog && !P.used1) api._lwLog.push([P.name || '', performance.now()]); } catch (e) { /* api is not built yet */ }
    // TEMP-DEBUG-HOOK
    P.used1 = true;
    if (P.chain) {
      if (P.loc.uChain) gl.uniform4fv(P.loc.uChain, P.ch.data);
      const m = mapIn(P, map) || {};
      u1i(P, 'uMode', m.mode || 0); u1i(P, 'uA', m.a || 0); u1i(P, 'uB', m.b || 0); u1i(P, 'uHi', m.hi || 0); u1f(P, 'uT', m.t || 0); u1i(P, 'uBase', m.base || 0); u1i(P, 'uPost', m.post || 0);
    }
    bindLut(P);
  }
  // a float64 value as a float32 pair (hi + lo)
  const hi32 = Math.fround;
  // origin uniforms of a resource: O as hi/lo
  function originUniforms(P, org) {
    const ox = org ? org[0] : 0, oy = org ? org[1] : 0;
    u2f(P, 'uOrgHi', hi32(ox), hi32(oy)); u2f(P, 'uOrgLo', ox - hi32(ox), oy - hi32(oy));
  }
  const mapKeyOf = (m) => (m ? `${m.mode || 0},${m.a || 0},${m.b || 0},${m.hi || 0},${m.t || 0},${m.base || 0},${m.post || 0}` : '0');

  // ---------------- phase LUT: 256 x 32 RGBA8, oklch(L, min(0.13, 0.97 Cmax(L, h)), h), h = 29 deg + arg ----------------
  const LUT_W = 256, LUT_H = 32;
  let lutData = null, lutTex = null;
  function oklabLin(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  const enc1 = (x) => { x = clamp(x, 0, 1); return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055; };
  const inGamut = (c) => c[0] >= -1e-7 && c[1] >= -1e-7 && c[2] >= -1e-7 && c[0] <= 1 + 1e-7 && c[1] <= 1 + 1e-7 && c[2] <= 1 + 1e-7;
  function cmax(L, h) {
    const ca = Math.cos(h), sa = Math.sin(h);
    let lo = 0, hi = 0.37;
    for (let i = 0; i < 24; i++) { const m = 0.5 * (lo + hi); if (inGamut(oklabLin(L, m * ca, m * sa))) lo = m; else hi = m; }
    return lo;
  }
  function lutBytes() {
    if (lutData) return lutData;
    const d = new Uint8Array(LUT_W * LUT_H * 4);
    const h0 = 29 * Math.PI / 180;
    for (let j = 0; j < LUT_H; j++) {
      const L = 0.05 + 0.93 * j / (LUT_H - 1);
      for (let i = 0; i < LUT_W; i++) {
        const h = h0 + 2 * Math.PI * (i + 0.5) / LUT_W;
        const C = Math.min(0.13, 0.97 * cmax(L, h));
        const c = oklabLin(L, C * Math.cos(h), C * Math.sin(h));
        const o = 4 * (j * LUT_W + i);
        d[o] = Math.round(enc1(c[0]) * 255); d[o + 1] = Math.round(enc1(c[1]) * 255); d[o + 2] = Math.round(enc1(c[2]) * 255); d[o + 3] = 255;
      }
    }
    return (lutData = d);
  }
  function lut() {
    if (lutTex) return lutTex;
    lutTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, lutTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, LUT_W, LUT_H, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutBytes());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return lutTex;
  }
  // ---------------- Phase colors (issue 8): the chosen palette, an Arb one baked in its own texture (unit 14) ----------------
  let palId = 0, palData = null, palTex = null, palUp = false;
  // id: one of Palette.LIST's; true when the choice changed
  function setPalette(id) {
    const i = Palette.indexOf(id);
    if (i === palId) return false;
    palId = i; palData = i ? Palette.bake(id) : null; palUp = false;
    return true;
  }
  const palette = () => Palette.LIST[palId][0];
  // bind the LUT (unit 0) and the palette's texels (unit 14), and set the program's uPal
  function bindLut(P) {
    if (P.loc.uLut) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lut()); }
    if (P.loc.uPal) gl.uniform1i(P.loc.uPal, palId);
    if (P.loc.uPalT && palData) {
      gl.activeTexture(gl.TEXTURE14);
      if (!palTex) {
        palTex = gl.createTexture(); palUp = false;
        gl.bindTexture(gl.TEXTURE_2D, palTex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      } else gl.bindTexture(gl.TEXTURE_2D, palTex);
      if (!palUp) {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, Palette.W, Palette.H, 0, gl.RGBA, gl.UNSIGNED_BYTE, palData);
        palUp = true;
      }
    }
  }
  // JS mirrors of the shaders' arbc and pwheel (the same texels, bilinear), for legends, keys and readouts: the
  // palette's color of w at a style's neutral lightness (lr = ln|w|; the wheel does not read it), and pwheel(arg, L,
  // ref): sRGB floats
  function paletteRGB(arg, lr) { return palId ? Palette.sample(palData, arg, lr) : phaseRGB(arg, 0.75); }
  function palRGB(arg, L, ref, lr) { return palId ? Palette.shade(Palette.sample(palData, arg, lr), L, ref) : phaseRGB(arg, L); }
  // JS mirror of wheel(arg, L) (same texels, bilinear), for legends and readout swatches: sRGB floats
  function phaseRGB(arg, L) {
    const d = lutBytes();
    const u = (((arg / (2 * Math.PI)) % 1) + 1) % 1 * LUT_W - 0.5;
    const v = clamp((L - 0.05) / 0.93, 0, 1) * (LUT_H - 1);
    const i0 = Math.floor(u), fu = u - i0, j0 = Math.min(LUT_H - 2, Math.floor(v)), fv = v - j0;
    const at = (i, j, k) => d[4 * (j * LUT_W + ((i % LUT_W) + LUT_W) % LUT_W) + k] / 255;
    const out = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const a = at(i0, j0, k) * (1 - fu) + at(i0 + 1, j0, k) * fu, b = at(i0, j0 + 1, k) * (1 - fu) + at(i0 + 1, j0 + 1, k) * fu;
      out[k] = a * (1 - fv) + b * fv;
    }
    return out;
  }

  // ---------------- geometry templates ----------------
  const tplCache = new Map();
  function makeBuf(data, usage) {
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW);
    return buf;
  }
  // Region template for L: lattice points (i, j), i + j <= L, then the L^2 sub-triangle centroids.
  // Draw records: 3 corners (bary), corner k, -, then the template point indices of the corners and centroid.
  function regionTemplate(L) {
    const key = 'r' + L;
    if (tplCache.has(key)) return tplCache.get(key);
    const idx = new Map();
    const pts = [];
    for (let i = 0; i <= L; i++) for (let j = 0; i + j <= L; j++) { idx.set(i * (L + 1) + j, pts.length / 2); pts.push(i / L, j / L); }
    const V = pts.length / 2;
    const tris = [];
    for (let i = 0; i < L; i++) for (let j = 0; i + j < L; j++) {
      tris.push([[i, j], [i + 1, j], [i, j + 1]]);
      if (i + j < L - 1) tris.push([[i + 1, j], [i + 1, j + 1], [i, j + 1]]);
    }
    const data = [];
    tris.forEach((t, ti) => {
      const id = t.map(([i, j]) => idx.get(i * (L + 1) + j));
      const b = t.map(([i, j]) => [i / L, j / L]);
      pts.push((b[0][0] + b[1][0] + b[2][0]) / 3, (b[0][1] + b[1][1] + b[2][1]) / 3);
      for (let k = 0; k < 3; k++) data.push(b[0][0], b[0][1], b[1][0], b[1][1], b[2][0], b[2][1], k, 0, id[0], id[1], id[2], V + ti);
    });
    const t = { buf: makeBuf(new Float32Array(data)), count: data.length / 12, P: pts.length / 2, pts: makeBuf(new Float32Array(pts)) };
    tplCache.set(key, t);
    return t;
  }
  // Line template for M pieces: points t = k / M (k = 0..M) then midpoints (k + 1/2) / M.
  function lineTemplate(M) {
    const key = 'l' + M;
    if (tplCache.has(key)) return tplCache.get(key);
    const data = [], pts = [];
    for (let k = 0; k <= M; k++) pts.push(k / M, 0);
    for (let k = 0; k < M; k++) pts.push((k + 0.5) / M, 0);
    for (let k = 0; k < M; k++) {
      const t0 = k / M, t1 = (k + 1) / M;
      const v = (e, s) => data.push(t0, t1, e, s, k, k + 1, M + 1 + k, 0);
      v(0, -1); v(1, -1); v(1, 1); v(0, -1); v(1, 1); v(0, 1);
    }
    const t = { buf: makeBuf(new Float32Array(data)), count: data.length / 8, P: pts.length / 2, pts: makeBuf(new Float32Array(pts)) };
    tplCache.set(key, t);
    return t;
  }

  // ---------------- resources ----------------
  // Region mesh: instances = Float32Array [ax,ay,bx,by,cx,cy] per triangle, relative to instances.origin (or
  // origin, float64 [x, y]; default 0)
  let skipIds = 0;
  function createMesh(instances, origin) {
    const buf = makeBuf(instances);
    const n = instances.length / 6;
    const org = origin || instances.origin || [0, 0];
    const res = { kind: 'mesh', buf, n, org: [org[0], org[1]], vaos: new Map(), skips: [], tf: null };
    res.skip0 = createSkip(res);
    live.add(res);
    return res;
  }
  // Per-triangle skip flags (1 = do not draw); a mesh can have several, one per view that refines it.
  function createSkip(res, flags) {
    const buf = makeBuf(flags || new Float32Array(res.n), gl.DYNAMIC_DRAW);
    const sk = { buf, id: ++skipIds };
    res.skips.push(sk);
    return sk;
  }
  function setSkip(skip, flags) {
    gl.bindBuffer(gl.ARRAY_BUFFER, skip.buf);
    gl.bufferData(gl.ARRAY_BUFFER, flags, gl.DYNAMIC_DRAW);
  }
  function attrib(loc, size, stride, off, div) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
    gl.vertexAttribDivisor(loc, div);
  }
  function meshVAO(res, L, skip) {
    skip = skip || res.skip0;
    const key = 'd' + L + '|' + skip.id;
    let v = res.vaos.get(key);
    if (v) return v;
    const tpl = regionTemplate(L);
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, tpl.buf);
    attrib(0, 4, 48, 0, 0); attrib(1, 4, 48, 16, 0); attrib(6, 4, 48, 32, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    attrib(2, 4, 24, 0, 1); attrib(3, 2, 24, 16, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, skip.buf);
    attrib(4, 1, 4, 0, 1);
    gl.bindVertexArray(null);
    res.vaos.set(key, v);
    return v;
  }
  function meshTFVAO(res, L) {
    const key = 't' + L;
    let v = res.vaos.get(key);
    if (v) return v;
    const tpl = regionTemplate(L);
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, tpl.pts);
    attrib(0, 2, 8, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    attrib(2, 4, 24, 0, 1); attrib(3, 2, 24, 16, 1);
    gl.bindVertexArray(null);
    res.vaos.set(key, v);
    return v;
  }
  // Lines: list of Float64Array/arrays of source points (x0,y0,x1,y1,...); consecutive points become segments.
  // Per segment: P0.xy, P1.xy, the instance offsets of the previous and next segment of the same polyline
  // (0 = none; a closed polyline wraps), then the previous segment's start and the next segment's end: the draw
  // uses them to mitre the joins between pieces. Points are stored relative to origin (float64 [x, y]; default:
  // the centre of the points' bounding box).
  const LSTRIDE = 10;
  function createLines(polys, origin) {
    let n = 0;
    let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
    for (const p of polys) {
      n += Math.max(0, p.length / 2 - 1);
      if (!origin) for (let i = 0; i + 1 < p.length; i += 2) if (Number.isFinite(p[i]) && Number.isFinite(p[i + 1])) { bx0 = Math.min(bx0, p[i]); bx1 = Math.max(bx1, p[i]); by0 = Math.min(by0, p[i + 1]); by1 = Math.max(by1, p[i + 1]); }
    }
    const org = origin || (bx1 >= bx0 ? [(bx0 + bx1) / 2, (by0 + by1) / 2] : [0, 0]);
    const ox = org[0], oy = org[1];
    const data = new Float32Array(n * LSTRIDE);
    let o = 0;
    for (const p of polys) {
      const m = Math.max(0, p.length / 2 - 1);
      if (!m) continue;
      const L = p.length;
      const closed = m > 1 && Math.abs(p[0] - p[L - 2]) <= 1e-12 * (1 + Math.abs(p[0])) && Math.abs(p[1] - p[L - 1]) <= 1e-12 * (1 + Math.abs(p[1]));
      for (let j = 0, i = 0; j < m; j++, i += 2) {
        const hp = j > 0 || closed, hn = j < m - 1 || closed;
        const ip = j > 0 ? i - 2 : L - 4, in_ = j < m - 1 ? i + 4 : 2;     // previous start, next end
        data[o++] = p[i] - ox; data[o++] = p[i + 1] - oy; data[o++] = p[i + 2] - ox; data[o++] = p[i + 3] - oy;
        data[o++] = j > 0 ? -1 : (closed ? m - 1 : 0);
        data[o++] = j < m - 1 ? 1 : (closed ? -(m - 1) : 0);
        data[o++] = (hp ? p[ip] : p[i]) - ox; data[o++] = (hp ? p[ip + 1] : p[i + 1]) - oy;
        data[o++] = (hn ? p[in_] : p[i + 2]) - ox; data[o++] = (hn ? p[in_ + 1] : p[i + 3]) - oy;
      }
    }
    const res = { kind: 'lines', buf: makeBuf(data), n, org: [ox, oy], vaos: new Map(), tf: null, arcs: new Map() };
    live.add(res);
    return res;
  }
  function lineVAO(res, M) {
    const key = 'd' + M;
    let v = res.vaos.get(key);
    if (v) return v;
    const tpl = lineTemplate(M);
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, tpl.buf);
    attrib(0, 4, 32, 0, 0); attrib(6, 4, 32, 16, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    attrib(2, 4, 4 * LSTRIDE, 0, 1); attrib(10, 2, 4 * LSTRIDE, 16, 1); attrib(11, 4, 4 * LSTRIDE, 24, 1);
    gl.bindVertexArray(null);
    res.vaos.set(key, v);
    return v;
  }
  function lineTFVAO(res, M) {
    const key = 't' + M;
    let v = res.vaos.get(key);
    if (v) return v;
    const tpl = lineTemplate(M);
    v = gl.createVertexArray();
    gl.bindVertexArray(v);
    gl.bindBuffer(gl.ARRAY_BUFFER, tpl.pts);
    attrib(0, 2, 8, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    attrib(2, 4, 4 * LSTRIDE, 0, 1);
    gl.bindVertexArray(null);
    res.vaos.set(key, v);
    return v;
  }
  // (v16.1) frees the entries of res evaluated under the app key cacheKey, at every template size: the forward stand-in
  // a shape drew while its inverse program compiled, once the inverse pass draws it. Nothing looks that evaluation up
  // again unless the shape falls back to forward, which evaluates it anew (gate v16: sphere.logUHP kept 1.2 MB)
  function dropCached(res, cacheKey) {
    if (!res || !res.tf || !cacheKey) return 0;
    let n = 0;
    for (const e of [...res.tf.values()]) if (e.ck === cacheKey) { freeEntry(e); n++; }
    return n;
  }
  function freeCache(res) {
    if (res.tf) for (const e of [...res.tf.values()]) freeEntry(e);
    res.tf = null;
    if (res.tmp && gl) for (const e of res.tmp.values()) freeTmp(e);
    res.tmp = null;
  }
  // ---- pre-mapped meshes (SPEC 8.7): their own GPU budget (32 MB, least recently drawn first; preBytes), apart from
  // the map cache's cacheBytes: they cannot be recreated from GPU state (the app re-uploads an evicted one from its
  // published CPU data, res.n === 0). The app keeps one mesh per slot (shape, role, view kind) at rest, so the budget
  // only bounds transients (a stand-in next to its rebuild, an export's mesh while the figure draws)
  const PRE_BYTES = 32 * 1024 * 1024;
  let preBytes = 0;
  const preAll = new Map();   // res -> true, least recently drawn first
  // d: SphereMesh.publish() -> res {kind: 'pre', n (triangles), count (vertices), sph, org}
  function createPreMesh(d) {
    if (!ok || !d || !d.n) return null;
    const sph = !!d.pos3, pc = sph ? 3 : 2, stride = pc + 5, n = d.n;
    const data = new Float32Array(n * 3 * stride);
    for (let t = 0; t < n; t++) for (let j = 0; j < 3; j++) {
      const o = (t * 3 + j) * stride;
      if (sph) { data[o] = d.pos3[t * 9 + 3 * j]; data[o + 1] = d.pos3[t * 9 + 3 * j + 1]; data[o + 2] = d.pos3[t * 9 + 3 * j + 2]; }
      else { data[o] = d.pos[t * 6 + 2 * j]; data[o + 1] = d.pos[t * 6 + 2 * j + 1]; }
      const a = t * 12 + 4 * j;
      data[o + pc] = d.attr[a]; data[o + pc + 1] = d.attr[a + 1]; data[o + pc + 2] = d.attr[a + 2]; data[o + pc + 3] = d.attr[a + 3];
      data[o + pc + 4] = d.tri[t];
    }
    // ((#366 prototype) d.dynamic: the data kept, for updatePreMesh to move its vertices frame by frame)
    const buf = makeBuf(data, d.dynamic ? gl.DYNAMIC_DRAW : undefined);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    attrib(0, pc, stride * 4, 0, 0); attrib(1, 4, stride * 4, pc * 4, 0); attrib(2, 1, stride * 4, (pc + 4) * 4, 0);
    gl.bindVertexArray(null);
    const res = { kind: 'pre', buf, vao, n, count: 3 * n, sph, org: (d.origin || [0, 0]).slice(), bytes: data.byteLength, vaos: new Map(), skips: [], data: d.dynamic ? data : null, stride };
    preAll.set(res, true); preBytes += res.bytes;
    for (const [r] of preAll) { if (preBytes <= PRE_BYTES) break; if (r !== res) destroy(r); }
    return res;
  }
  // ((#366 prototype) a flat dynamic mesh's vertices moved: pos as createPreMesh's (2 per vertex, 6 per triangle), the
  // other attributes kept; one upload, no new buffer)
  function updatePreMesh(res, pos) {
    if (!ok || !res || !res.data || res.sph || !res.n) return false;
    const D = res.data, st = res.stride, nv = res.count;
    for (let v = 0; v < nv; v++) { D[v * st] = pos[2 * v]; D[v * st + 1] = pos[2 * v + 1]; }
    gl.bindBuffer(gl.ARRAY_BUFFER, res.buf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, D);
    return true;
  }
  // st: {view, dpr, color, color2, edge, ink, alpha, pattern, cell, lines, sphN, stretch, sphere: {MVP, eye},
  //      scissor [x, y, w, h] (device px of the pane, bottom-left origin),
  //      key: {win, R, rs, sing} (flat: the inverse path's sheet key, SPEC 5; null: the leaf order alone)}
  // With a key the front sheet is chosen per sample (PRE_KEY): one pass in the mesh's far-to-near order with the depth
  // test (LEQUAL, depth written), so the sample's nearest key is drawn last, over the layers drawn before it; a layer
  // the leaf order draws after a nearer one (only where the leaf order and the key disagree) is left out (alpha < 1).
  // (A depth-only pre-pass and separate passes for the layers behind and the front, which keep those layers, drew the
  // mesh three times: gl_FragDepth turns early depth tests off, and exp(exp z)(H)'s settle frames jank by 20 ms.)
  // st.carry (flat only, the steps view's carried colour): each fragment the colour plane's colour of its source point
  // (regionPK), its depth the sheet key, st.depth shared as drawRegionCarry's; st.preZ: the mesh's vP is the source
  // point itself (graph paper's mesh), not its polar coordinates; -> true when drawn, false while its program compiles
  function drawPreMapped(res, st) {
    if (!ok || !res || !res.n) return false;
    const sph = !!st.sphere, carry = !!st.carry && !sph;
    const P = carry ? program('regionPK', st.map) : program(sph ? 'regionSP' : 'regionP');
    if (!P) return false;
    preAll.delete(res); preAll.set(res, true);
    if (carry) use(P, st.map); else use(P);
    if (sph) {
      uM4(P, 'uMVP', st.sphere.MVP);
      u3(P, 'uEye', st.sphere.eye);
      globeLight(P, st.sphere);
    } else {
      const v = st.view, dpr = st.dpr || 1;
      u2f(P, 'uRel', v.cx - res.org[0], v.cy - res.org[1]);
      u2f(P, 'uScale', 2 * v.s * dpr / fw, 2 * v.s * dpr / fh);
    }
    // (origin [0, 0]: uQ = 0, the attributes are already reduced; the pattern origin is 0)
    if (carry) { u1i(P, 'uGs', st.carry.s); u1i(P, 'uGt', st.carry.T); dcUniforms(P, st.carry, st.dpr || 1); u1i(P, 'uPreZ', st.preZ ? 1 : 0); }
    else regionUniforms(P, Object.assign({}, st, { fade: null }), [0, 0]);
    const sc = st.scissor;
    const scOn = sc ? gl.isEnabled(gl.SCISSOR_TEST) : false, prevSc = sc && scOn ? gl.getParameter(gl.SCISSOR_BOX) : null;
    if (sc) {
      let x0 = vpX + sc[0], y0 = vpY + sc[1], x1 = x0 + sc[2], y1 = y0 + sc[3];
      if (prevSc) { x0 = Math.max(x0, prevSc[0]); y0 = Math.max(y0, prevSc[1]); x1 = Math.min(x1, prevSc[0] + prevSc[2]); y1 = Math.min(y1, prevSc[1] + prevSc[3]); }
      if (x1 <= x0 || y1 <= y0) return true;
      gl.enable(gl.SCISSOR_TEST); gl.scissor(x0, y0, x1 - x0, y1 - y0);
    }
    // (the default framebuffer has a depth buffer; any other target draws in the leaf order)
    const k = !sph && st.key && st.key.win && gl.getParameter(gl.FRAMEBUFFER_BINDING) === null ? st.key : null;
    keyUniforms(P, k);
    gl.bindVertexArray(res.vao);
    if (carry) carryDraw(k, st.depth, () => gl.drawArrays(gl.TRIANGLES, 0, res.count));
    else if (k) {
      const dt = gl.isEnabled(gl.DEPTH_TEST);
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clearDepth(1); gl.clear(gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LEQUAL);
      gl.drawArrays(gl.TRIANGLES, 0, res.count);
      gl.clear(gl.DEPTH_BUFFER_BIT); gl.depthFunc(gl.LESS);
      if (!dt) gl.disable(gl.DEPTH_TEST);
    } else gl.drawArrays(gl.TRIANGLES, 0, res.count);
    gl.bindVertexArray(null);
    if (sc) { if (scOn) gl.scissor(prevSc[0], prevSc[1], prevSc[2], prevSc[3]); else gl.disable(gl.SCISSOR_TEST); }
    return true;
  }
  function destroy(res) {
    if (!res || !gl) return;
    if (res.kind === 'pre') {
      if (preAll.delete(res)) preBytes -= res.bytes;
      if (res.vao) gl.deleteVertexArray(res.vao);
      if (res.buf) gl.deleteBuffer(res.buf);
      res.vao = res.buf = null; res.n = 0; res.count = 0;
      return;
    }
    freeCache(res);
    live.delete(res);
    for (const v of res.vaos.values()) gl.deleteVertexArray(v);
    gl.deleteBuffer(res.buf);
    for (const sk of res.skips || []) gl.deleteBuffer(sk.buf);
    for (const b of (res.arcs || new Map()).values()) gl.deleteBuffer(b);
    if (res.arcs) res.arcs.clear();
    res.vaos.clear();
    res.n = 0;
  }

  // ---------------- map cache (spec 8.1) ----------------
  // Each entry holds one RG32F texture. Transform feedback writes into one shared scratch buffer (grown to the largest
  // pass) that is copied into the entry's texture, so a cached evaluation is held once.
  let tfObj = null, scratch = null, scratchBytes = 0;
  const CACHE_MAX = 4;                     // entries per resource (2 for entries over BIG_ENTRY: Max meshes)
  const BIG_ENTRY = 48 * 1024 * 1024;      // a Max mesh (480 base cells per side) holds ~115 MB per evaluation
  const CACHE_BYTES = 256 * 1024 * 1024;   // all entries; ones drawn in the last 250 ms are never evicted
  const cacheAll = new Map();              // entry -> true, least recently used first
  const tmpAll = new Set();                // scratch evaluations (tmpEntry); counted in cacheBytes
  let cacheBytes = 0;
  function freeEntry(e) {
    if (!e) return;
    if (cacheAll.delete(e)) cacheBytes -= e.bytes;
    if (e.res && e.res.tf && e.res.tf.get(e.key) === e) e.res.tf.delete(e.key);
    if (gl && e.tex) gl.deleteTexture(e.tex);
    e.tex = null;
  }
  function floatTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  // Runs a transform-feedback pass into the scratch buffer, then copies bytes of it into tex (W x H texels).
  function runTF(P, vao, mode, count, instances, bytes, tex, W, H, ifmt, fmt) {
    if (!tfObj) tfObj = gl.createTransformFeedback();
    if (!scratch || scratchBytes < bytes) {
      if (scratch) gl.deleteBuffer(scratch);
      scratch = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, scratch);
      gl.bufferData(gl.ARRAY_BUFFER, bytes, gl.DYNAMIC_COPY);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      scratchBytes = bytes;
    }
    gl.bindVertexArray(vao);
    gl.enable(gl.RASTERIZER_DISCARD);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, tfObj);
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, scratch);
    gl.beginTransformFeedback(gl.POINTS);
    if (instances > 0) gl.drawArraysInstanced(gl.POINTS, 0, count, instances);
    else gl.drawArrays(gl.POINTS, 0, count);
    gl.endTransformFeedback();
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, null);
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, scratch);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, W, H, 0, fmt, gl.FLOAT, 0);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
  }
  // The map-cache pass without transform feedback: count x instances points of program P (current, uniforms set),
  // each drawn as one pixel into its texel of tex (W x H, RG32F). Blending, depth, culling and the scissor are off
  // for the pass; the pane's framebuffer, viewport and these switches are restored after it.
  // alloc false: tex already has W x H RG32F storage (a reused scratch texture)
  // (maskRGB, maskA: the frame's write mask (writeMask); the pass writes its texel's RG whatever it is, #440)
  let rtFbo = null, maskRGB = true, maskA = true;
  function runRT(P, vao, count, instances, tex, W, H, alloc = true) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (alloc) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, W, H, 0, gl.RG, gl.FLOAT, null);
    if (!rtFbo) rtFbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, rtFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const caps = [gl.BLEND, gl.DEPTH_TEST, gl.CULL_FACE, gl.SCISSOR_TEST].filter((c) => gl.isEnabled(c));
    for (const c of caps) gl.disable(c);
    const masked = !maskRGB || !maskA;
    if (masked) gl.colorMask(true, true, true, true);
    gl.viewport(0, 0, W, H);
    u1i(P, 'uP', count); u1i(P, 'uRtW', W); u2f(P, 'uRtSz', W, H);
    gl.bindVertexArray(vao);
    if (instances > 0) gl.drawArraysInstanced(gl.POINTS, 0, count, instances);
    else gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(vpX, vpY, fw, fh);
    for (const c of caps) gl.enable(c);
    if (masked) gl.colorMask(maskRGB, maskRGB, maskRGB, maskA);
  }
  function touch(e) {
    e.t = performance.now();
    cacheAll.delete(e); cacheAll.set(e, true);
    e.res.tf.delete(e.key); e.res.tf.set(e.key, e);
    return e;
  }
  // The cached mapped values of res under map, for template size L (mesh) or M (lines); null = use the direct path.
  // The key is what the values depend on: the app's cacheKey (the geometry), L, the map, the chain structure and its
  // parameter values (of the chain version that computed them: an earlier one while the current one compiles).
  // Pf: use this transform-feedback program (an earlier chain version) instead of the current one
  function tfEntry(res, isMesh, L, map, cacheKey, Pf) {
    if (!res.tf) res.tf = new Map();
    const c = res.tf;
    const keyOf = (ch, m) => `${cacheKey}|${L}|${mapKeyOf(m)}|${ch.key}|${ch.hash}`;
    const hit = Pf ? null : c.get(keyOf(cur, map));
    if (hit) return touch(hit);
    const P = Pf || program(isMesh ? 'tfRegion' : 'tfLine', map);
    if (!P) return null;
    const key = keyOf(P.ch, mapIn(P, map));
    const hit2 = c.get(key);
    if (hit2) return touch(hit2);
    const tpl = isMesh ? regionTemplate(L) : lineTemplate(L);
    const count = tpl.P * res.n;
    const W = Math.min(maxTex, 4096), H = Math.max(1, Math.ceil(count / W));
    if (H > maxTex) return null;
    const bytes = W * H * 8;
    while (c.size >= (bytes > BIG_ENTRY ? 2 : CACHE_MAX)) freeEntry(c.values().next().value);
    const now = performance.now();
    if (cacheBytes + bytes > CACHE_BYTES) freeStaleTmp(now);
    for (const e0 of [...cacheAll.keys()]) {
      if (cacheBytes + bytes <= CACHE_BYTES) break;
      if (now - e0.t > 250) freeEntry(e0);
    }
    const e = { tex: floatTex(), W, H, P: tpl.P, bytes, res, key, t: now, ck: cacheKey, L };
    use(P, map);
    originUniforms(P, res.org);
    const vao = isMesh ? meshTFVAO(res, L) : lineTFVAO(res, L);
    if (P.rt) runRT(P, vao, tpl.P, res.n, e.tex, W, H);
    else runTF(P, vao, gl.POINTS, tpl.P, res.n, bytes, e.tex, W, H, gl.RG32F, gl.RG);
    c.set(key, e); cacheAll.set(e, true); cacheBytes += bytes;
    if (P.ch === cur && !sideMode) dropSuperseded(c, e);
    return e;
  }
  // The current chain's evaluation of (cacheKey, L) supersedes what earlier chain versions computed for it while the
  // current program compiled (an older ready program under the same app key, or an earlier version's stand-in at this
  // template size): those entries can never be looked up again (the current chain's key is checked first, and the
  // stand-in is only drawn while the current program is pending), so they are freed now instead of holding their
  // texture until the resource is rebuilt (U-b gate: a loaded example kept a second full-size evaluation of each shape)
  function dropSuperseded(c, e) {
    for (const o of [...c.values()]) {
      if (o === e || o.L !== e.L) continue;
      if (o.ck === e.ck || o.ck === 'stand-in') freeEntry(o);
    }
  }
  // Draws without a cache key (homotopy frames, thumbnails) still evaluate the map once per template point, into
  // one scratch texture per resource and template size that each such draw overwrites (rt only). So 2D views never
  // need the per-vertex chain programs (region, line): adding a step compiles two chain programs instead of four
  // (spec 8.7), and a frame evaluates the chain ~10x less often than per vertex. null while nothing can evaluate.
  function tmpEntry(res, isMesh, L, map) {
    const P = program(isMesh ? 'tfRegion' : 'tfLine', map);
    if (!P) return null;
    const tpl = isMesh ? regionTemplate(L) : lineTemplate(L);
    const count = tpl.P * res.n;
    const W = Math.min(maxTex, 4096), H = Math.max(1, Math.ceil(count / W));
    if (H > maxTex || !P.rt) return null;
    if (!res.tmp) res.tmp = new Map();
    const slot = (isMesh ? 'm' : 'l') + L;
    const key = `${mapKeyOf(mapIn(P, map))}|${P.ch.key}|${P.ch.hash}`;
    let e = res.tmp.get(slot);
    const now = performance.now();
    sweepTmpLater();
    if (e) e.t = now;
    if (e && e.W === W && e.H === H && e.key === key) return e;
    const alloc = !e || e.W !== W || e.H !== H;
    if (alloc) {
      if (e) freeTmp(e);
      e = { tex: floatTex(), W, H, P: tpl.P, bytes: W * H * 8, res, slot, key: '', t: now };
      if (cacheBytes + e.bytes > CACHE_BYTES) freeStaleTmp(now);
      res.tmp.set(slot, e); tmpAll.add(e); cacheBytes += e.bytes;
    }
    e.key = key;
    use(P, map);
    originUniforms(P, res.org);
    runRT(P, isMesh ? meshTFVAO(res, L) : lineTFVAO(res, L), tpl.P, res.n, e.tex, W, H, alloc);
    return e;
  }
  function bindCache(P, e) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, e.tex);
    u1i(P, 'uTexW', e.W);
    u1i(P, 'uP', e.P);
  }

  // static 3D geometry
  let sphereGeo = null, emptyVAO = null;
  function icosphere(level) {
    const t = (1 + Math.sqrt(5)) / 2;
    let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    V = V.map((p) => { const l = Math.hypot(...p); return p.map((x) => x / l); });
    let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let s = 0; s < level; s++) {
      const mid = new Map();
      const m = (a, b) => {
        const k = a < b ? a * 1e6 + b : b * 1e6 + a;
        if (mid.has(k)) return mid.get(k);
        const p = [V[a][0] + V[b][0], V[a][1] + V[b][1], V[a][2] + V[b][2]];
        const l = Math.hypot(...p);
        V.push(p.map((x) => x / l));
        mid.set(k, V.length - 1);
        return V.length - 1;
      };
      const G = [];
      for (const [a, b, c] of F) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); G.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
      F = G;
    }
    return { pos: new Float32Array(V.flat()), idx: new Uint32Array(F.flat()) };
  }
  function sphere() {
    if (sphereGeo) return sphereGeo;
    const g = icosphere(5);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, makeBuf(g.pos));
    attrib(5, 3, 12, 0, 0);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, g.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    sphereGeo = { vao, count: g.idx.length };
    return sphereGeo;
  }
  function empty() {
    if (!emptyVAO) emptyVAO = gl.createVertexArray();
    return emptyVAO;
  }
  // marks: instanced lines / discs / rings, 10 floats per instance (A, B, kind, radius, half width, -)
  let markVAO = null, markBuf = null;
  function drawMarks(MVP, list, rgb, alpha, opts = {}) {
    if (!list.length) return;
    const P = program('mark');
    if (!P) return;
    if (!markVAO) {
      markVAO = gl.createVertexArray();
      markBuf = gl.createBuffer();
      gl.bindVertexArray(markVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, markBuf);
      attrib(7, 3, 40, 0, 1); attrib(8, 3, 40, 12, 1); attrib(9, 4, 40, 24, 1);
      gl.bindVertexArray(null);
    }
    const data = new Float32Array(list.length * 10);
    list.forEach((m, i) => data.set(m, i * 10));
    use(P);
    uM4(P, 'uMVP', MVP);
    u2f(P, 'uPx', fw, fh);
    u1f(P, 'uZBias', opts.zBias || 0);
    u1f(P, 'uZFix', opts.once ? -0.9999 : -2);
    u3(P, 'uColor', rgb);
    gl.bindVertexArray(markVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, markBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STREAM_DRAW);
    const draw = (a) => { u1f(P, 'uAlpha', a); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, list.length); };
    if (opts.once) {                      // a translucent polyline drawn last: each pixel blends once
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
      draw(alpha);
    } else if (opts.xray) {               // hidden parts faint, visible parts full
      gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
      gl.depthFunc(gl.GREATER); draw(alpha * 0.35);
      gl.depthFunc(gl.LEQUAL); draw(alpha);
    } else draw(alpha);
    gl.bindVertexArray(null);
  }
  const segM = (a, b, hw) => [a[0], a[1], a[2], b[0], b[1], b[2], 0, 0, hw, 0];
  const dotM = (a, r) => [a[0], a[1], a[2], 0, 0, 0, 1, r, 0, 0];

