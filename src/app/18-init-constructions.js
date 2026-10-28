  // ---------------- init ----------------
  // ---------------- v15: shared numbers, links and scene files (src/params.js; constructions/DESIGN.md 1) ----------------
  // A step's text fields keep the names (Funcs.build reads them through the parser's name scope); a shape's field that
  // holds names keeps its text in s.bind[key] and its value in the field itself (s.expr: the text with the values
  // written in), so the renderers and every cache keyed by a shape see plain values.
  const FX_TYPES = ['cx', 'coeffs', 'cxlist', 'expr'];
  // the text fields of a step: [key, text]
  function stepTexts(st) {
    const d = Funcs.DEFS[st.type], out = [];
    if (!d) return out;
    for (const q of d.params) if (FX_TYPES.includes(q.type) && typeof st.params[q.key] === 'string') out.push([q.key, st.params[q.key]]);
    return out;
  }
  // the names a step's fields use, with their values: part of the chain signature, so every cache keyed by it (cards,
  // fits, paths) sees a new value; the GPU programs keep their structure (the values are uniforms)
  function paramSig(st) {
    if (!S.params || !S.params.length) return '';
    let out = '';
    for (const [, v] of stepTexts(st)) for (const nm of Params.namesIn(v)) out += `;${nm}=${Params.get(nm)}`;
    return out;
  }
  const stepUses = (st, names) => stepTexts(st).some(([, v]) => Params.namesIn(v).some((n) => names.has(n)));
  function bindField(s, key, text) {
    if (Params.namesIn(text).length) (s.bind || (s.bind = {}))[key] = String(text).trim();
    else if (s.bind && key in s.bind) { delete s.bind[key]; if (!Object.keys(s.bind).length) delete s.bind; }
  }
  function setExprBind(s, text) {
    bindField(s, 'expr', text);
    s.expr = s.bind && s.bind.expr ? Params.resolve(text) : text;
  }
  // the bound fields of shape s again (only those that use one of names, all when names is null): true if one changed.
  // A value outside the field's range (a radius ≤ 0) or a formula with no value makes the shape undefined (review
  // math-2): s.undef says why, the shape is not drawn (hidden; s.undefHid remembers that the rule hid it), and it comes
  // back as soon as the numbers give a valid value again. So the picture never depends on how a slider moved.
  const BIND_LIM = { r: [1e-9, Infinity], r1: [0, Infinity], r2: [0, Infinity], n: [1, 60, 1], nc: [1, 60, 1], nr: [1, 60, 1] };
  function applyBinds(s, names) {
    if (!s.bind) { if (s.undef) { delete s.undef; if (s.undefHid && !s.cHid) s.visible = true; delete s.undefHid; return true; } return false; }
    let ch = false, bad = null;
    const fv = (x) => CX.fmtNum(x, 4).replace(/-/g, '−');
    for (const [key, src] of Object.entries(s.bind)) {
      const touched = !names || Params.namesIn(src).some((n) => names.has(n));
      try {
        if (key === 'expr') { if (!touched) continue; const r = Params.resolve(src); if (r !== s.expr) { s.expr = r; ch = true; } continue; }
        if (Array.isArray(s[key])) {
          const v = Expr.constValue(src);
          if (!CX.isFin(v)) { bad = bad || $t('{x} has no value here', { x: src }); continue; }
          if (touched && (v.re !== s[key][0] || v.im !== s[key][1])) { s[key] = [v.re, v.im]; ch = true; }
          continue;
        }
        let x = Params.evalReal(src);
        const lim = BIND_LIM[key];
        if (lim) {
          if (lim[2]) x = Math.round(x);
          const lo = key === 'r' && s.kind === 'sector' ? 0 : lim[0];
          if (!(x >= lo && x <= lim[1])) {
            const why = lim[2] ? $t('a count is a whole number from 1 to 60') : key === 'r' && lo > 0 ? $t('a radius must be positive') : $t('radii must be 0 or more');
            bad = bad || `${key.replace(/^r([12])$/, (m, d) => 'r' + sub(+d))} = ${src} = ${fv(x)}: ${why}`;
            continue;
          }
        }
        if (touched && x !== s[key]) { s[key] = x; ch = true; }
      } catch (e) { bad = bad || (e && e.message) || $t('{x} has no value here', { x: src }); }
    }
    if (bad) {
      if (s.undef !== bad) { if (!s.undef && (s.visible !== false || s.cHid)) { s.visible = false; s.undefHid = true; } s.undef = bad; ch = true; }
    } else if (s.undef) { delete s.undef; if (s.undefHid && !s.cHid) s.visible = true; delete s.undefHid; ch = true; }
    return ch;
  }
  // every bound field and every number by formula from the numbers' current values (review math-3: a state, a link or a
  // scene opens with its formulas as the truth; the stored values are only a cache)
  function bindsAll() {
    if (!S) return;
    try { Params.recompute(); } catch (e) { /* a cycle keeps the stored values */ }
    for (const x of S.shapes.concat(S.targets || [])) { try { applyBinds(x, null); } catch (e) { /* */ } }
  }

  // ---------------- v16 constructions: the model (notes/constructions-v16/SPEC.md 20.2, CORE) ----------------
  // Shapes may carry s.at (bound handles) and s.def (circle3, meet, glider, midpoint, bisector); Constr (constr.js)
  // writes their geometry in topological order. cmSync runs at the start of shapesChanged / targetsChanged and after
  // every chain change (zeros of f1, image refs), so every path that moves a source (a drag, a number, undo, load, a
  // zero) recomputes what is built on it before the frame is drawn. Function declarations: sanitizeState calls them
  // while the app loads. The interface (construct.js) uses cmApi() and Construct.on(type, data).
  function cmOn() { return !!S; }
  // the values Constr reads: f1's zeros and poles (parsed like the marks), F(z0) of the whole chain, traced curves
  function cmEnv() {
    const val = (raw) => { let v = null; try { v = typeof zpParse === 'function' ? zpParse(raw) : Expr.constValue(raw); } catch (e) { v = null; } return v && CX.isFin(v) ? [v.re, v.im] : null; };
    return {
      zp: (st, kind, i) => val(Funcs.splitList(st.params[kind])[i] || ''),
      zpAll: (st, kind) => Funcs.splitList(st.params[kind]).map(val),
      F: (z) => { if (z === Constr.INF) return null; try { const w = stageF(nSteps())(C(z[0], z[1])); return CX.isFin(w) ? [w.re, w.im] : null; } catch (e) { return null; } },
      // (review math-11: one component per traced branch, each with its level function for the float64 Newton step,
      // traced on the z-plane's window plus a margin, never joined into one polyline)
      trace: (s) => {
        try {
          const win = Region.expandBox(goodWin(clipWin) ? clipWin : { x0: -8, x1: 8, y0: -8, y1: 8 }, 2);
          const d = s.kind === 'fcurve' ? Region.curveDesc(s) : null, out = [];
          for (const c of Region.curvesOf(s, win)) {
            let pts = null;
            if (c.pts) pts = c.pts.map((z) => [z.re, z.im]);
            else { const f = Region.sampleCurve(c, win); pts = []; for (let i = 0; i + 1 < f.length; i += 2) if (Number.isFinite(f[i]) && Number.isFinite(f[i + 1])) pts.push([f[i], f[i + 1]]); }
            if (pts.length < 2) continue;
            const pc = d && c.piece != null ? d.pieces.find((x) => x.index === c.piece) || d.pieces[c.piece] : null;
            out.push({ pts, g: pc && typeof pc.g === 'function' ? pc.g : null });
          }
          return out.length ? out : null;
        } catch (e) { return null; }
      },
    };
  }
  function cmEmit(type, data) { if (Construct.on) { try { Construct.on(type, data); } catch (e) { console.error('Construct.on', e); } } }
  // recompute (changed: Constr.recompute's {all} | {shapes, zp, chain}); returns its result or null
  function cmSync(changed) {
    if (!cmOn() || !(S.shapes.some((s) => s.at || s.def) || (S.targets || []).some((s) => s.at || s.def))) return null;
    let r = null;
    try { r = Constr.recompute(S, changed || { all: true }, cmEnv()); } catch (e) { console.error('constructions', e); return null; }
    if (r.ids.length) cmEmit('recomputed', { ids: r.ids, kindChanged: r.kindChanged, undefChanged: r.undefChanged });
    cmSync.last = r;
    return r;
  }
  // after a chain change: step uids and zero ids, then what is built on f1's zeros and on F(z0)
  function cmChain() {
    if (!cmOn()) return;
    try { Constr.syncSteps(S, cmEnv()); } catch (e) { console.error('constructions', e); }
    const tgt = new Set((S.targets || []).map((x) => x.id));
    const r = cmSync({ zpAny: true, chain: true });
    if (!r || !r.ids.length) return;
    const xs = r.ids.some((id) => !tgt.has(id)), ts = r.ids.some((id) => tgt.has(id)), st = !!(r.kindChanged.length || r.undefChanged.length);
    if (xs) shapesChanged(st);
    if (ts) targetsChanged(st);
  }
  // shapesChanged / targetsChanged: recompute everything built on the shapes (cheap: a few flops a node; the meshes
  // rebuild only for shapes whose fields changed, by shapeKey); true when a row must be rebuilt (kind, undefined)
  function cmShapes() {
    const r = cmSync({ all: true });
    return !!(r && (r.kindChanged.length || r.undefChanged.length));
  }
  // load (sanitizeState): steps keep uid and zpIds, refs are validated (fallbacks [C29]), one recompute
  function cmLoad(o) {
    const env = cmEnv();
    try {
      Constr.syncSteps(o, env);
      const v = Constr.validate(o, env);
      Constr.recompute(o, { all: true }, env);
      if (v.freed) { cmLoad.freed = v.freed; cmEmit('loadFreed', { n: v.freed }); }
    } catch (e) { console.error('constructions (load)', e); }
  }
  // delete shapes through Constr.deletePlan (definitions cascade, bindings are freed [C17]); returns the plan
  function cmDeletePlan(ids) {
    if (!cmOn()) return { del: ids, freed: [], undef: [] };
    const plan = Constr.deletePlan(S, ids);
    Constr.applyFreed(S, plan.freed);
    return plan;
  }
  // a zero or pole of step k is removed: its bindings are freed, its constructions become undefined [C12]
  function cmZeroRemoved(k, kind, i) {
    if (!cmOn()) return null;
    const st = S.steps[k - 1];
    if (!st || !st.zpIds || !st.zpIds[kind]) return null;
    const zref = { zp: st.uid, kind, id: st.zpIds[kind][i] };
    const plan = Constr.zeroRemovePlan(S, zref);
    Constr.applyFreed(S, plan.freed);
    Constr.zpRemoveId(st, kind, i);
    if (plan.undef.length || plan.freed.length) cmEmit('zpRemoved', { zref, undef: plan.undef, freed: plan.freed });
    return plan;
  }
  // (review math-10, SPEC 2.2 [C5]) the anchor the GPU packs the exact forms at, in float64: the centre of the view of
  // the plane whose forms are packed ('X': the shapes, at the z-window's centre; 'Y': the targets, at Y's centre; or a
  // point), so float32 sees only small numbers near the view at any radius and any distance from the first point
  function cmFormAnchor(which) {
    if (!GLR.setFormAnchor) return;
    let xy = null;
    if (Array.isArray(which)) xy = which;
    else if (which === 'X') xy = goodWin(clipWin) ? [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2] : null;
    else if (which === 'Y') xy = [V.right.cx, V.right.cy];
    GLR.setFormAnchor(xy && xy.every(Number.isFinite) ? xy : null);
  }
  // the interface's API (SPEC 20.2): every call that changes S records undo as v15's gestures do
  let cmGesture = false;
  function cmApi() {
    const find = (id) => S.shapes.find((x) => x.id === id) || S.targets.find((x) => x.id === id) || null;
    const isT = (id) => S.targets.some((x) => x.id === id);
    const done = (ids, live, structural) => {
      // (v16.3 review user-4: a live frame recomputes once, in shapesChanged / targetsChanged, as a free point's drag)
      const r = live && !structural ? null : cmSync({ all: true });
      const st = structural || !!(r && (r.kindChanged.length || r.undefChanged.length));
      if (ids.some((id) => !isT(id))) shapesChanged(st);
      if (ids.some(isT)) targetsChanged(st);
      if (!live && !cmGesture) commit();
    };
    return {
      // shapes: new shape objects (ids assigned here when missing); helpers included; one undo step
      create(shapes, o = {}) {
        const ids = [];
        for (const s0 of shapes) {
          const s = s0.id ? s0 : Object.assign(newShape(s0.kind, {}, !!o.target), s0, { id: undefined });
          if (!s.id) s.id = 's' + S.nextId++;
          if (s.visible == null) s.visible = true;
          (o.target ? S.targets : S.shapes).push(s);
          ids.push(s.id);
        }
        if (o.select !== false && ids.length) { selected = ids[ids.length - 1]; zpSel = null; }
        done(ids, false, true);
        return ids;
      },
      bind(id, key, ref, o = {}) { const s = find(id); if (!s) return; (s.at || (s.at = {}))[key] = ref; done([id], !!o.live, true); },
      unbind(id, key) { const s = find(id); if (!s || !s.at) return; delete s.at[key]; if (!Object.keys(s.at).length) delete s.at; done([id], false, true); },
      // fill, flip, index, t, seed; {def} on a free point ("Put on this curve")
      setDef(id, patch) {
        const s = find(id);
        if (!s) return;
        if (patch.def && Constr.wouldCycle && Constr.wouldCycle(S, id, patch.def.args)) return false;   // (review math-6: no cycles)
        if (patch.def) s.def = patch.def;
        if (!s.def) return;
        for (const k of ['fill', 'index', 'seed']) if (k in patch) s.def[k] = patch[k];
        // (v16.3 review math-5: Use complement keeps the meet points on the shape where they are, in the same step)
        if ('flip' in patch) { if (Constr.setFlip) Constr.setFlip(S, id, patch.flip); else s.def.flip = patch.flip; }
        if ('t' in patch) s.t = patch.t;
        // (v16.3 review user-4: a glider's live drag frame is not structural: the rows are updated, not rebuilt)
        done([id], !!patch.live, !patch.live || !!patch.def);
      },
      makeFree(id, o = {}) { const s = find(id); if (!s) return; delete s.def; delete s.at; delete s.helper; delete s.owner; if (s.cHid) { delete s.cHid; if (!s.undefHid) s.visible = true; } delete s.cundef; delete s._g; delete s._atInf; done([id], !!o.live, true); },   // ([v16.5 rail] live: a pull mid-drag, the release commits)
      // a gesture moved a source (live: a motion frame; the gesture's end calls end())
      moved(changed, o = {}) { cmGesture = cmGesture || !!o.live; const r = cmSync(changed || { all: true }); if (r && r.ids.length) { shapesChanged(!!(r.kindChanged.length || r.undefChanged.length)); targetsChanged(false); } return r; },
      end() { cmGesture = false; commit(); if (rightAuto && autoFit()) fitRight(); requestRender('L', 'R', 'T'); },
      remove(ids) {
        const plan = cmDeletePlan(ids);
        const del = new Set(plan.del);
        S.shapes = S.shapes.filter((s) => !del.has(s.id));
        S.targets = S.targets.filter((s) => !del.has(s.id));
        for (const id of del) dropShapeGPU(id);
        if (selected && del.has(selected)) selected = null;
        shapesChanged(true); targetsChanged(true); commit();
        cmEmit('deleted', plan);
        return plan;
      },
      state(id) { const s = find(id); return s ? { undef: s.cundef || null, atInf: !!s._atInf, helper: !!s.helper, owner: s.owner || null, note: s._note || null } : null; },
      describe: (id) => Constr.describe(S, id),
      graph: () => Constr.graph(S),
      env: cmEnv,
    };
  }
  // ---------------- v16 constructions: the interface's adapter (construct.js; SPEC 20, INTERFACE) ----------------
  function cmUiApi() {
    const paneOf = (side) => (side === 'R' ? paneR : paneL);
    return {
      S: () => S, h, TH: () => TH, sub,
      setView: (side) => { const p = paneOf(side); p.setView(side === 'R' ? V.right : leftView()); return p; },
      win: (side) => (side === 'R' ? targetWin() : clipWin),
      globeEdit, globePick: (side, x, y) => { const gc = globeCam(side); const g = gc ? pickGlobe(side === 'R' ? paneR : paneL, camOf(side), x, y) : null; return gc && g ? { gc, g, hit: (s, tol) => globeCurveHit(gc, s, x, y, tol) } : null; }, gScreen,
      tool: () => tool, setTool, selected: () => selected, dragging: () => !!drag && /^(move|handle|zp)$/.test(drag.mode) && !!drag.moved,
      select: (id) => { selected = id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL', 'OR', 'P'); },
      hoverShape: (id) => { hoverShape = id; requestRender('L', 'R'); },
      snapZ, snapOn: () => !!S.snap, altHeld: () => altHeld,
      // [v16.5 rail] the drag in progress; ending it without its release; back to the last undo step (Esc, a second
      // finger: the press state, no step); a sound cue
      drag: () => drag, abortDrag: () => { drag = null; }, revert: () => { if (hist[hi]) restore(hist[hi]); }, cue: (n) => soundCue(n), snapTick: () => { if (sndP.on && sndP.snap) soundCue('snap'); },
      leftStage, lFlat, targetsEditable, zpStep,
      yWhole: () => S.focus === 0 && !morphOn() && rImage(),
      kindType, shapeInk, swatchStyle, shapeNames, pointLabel, nextPointNum, targetLabel,
      nextCi: (target, k = 0) => (target ? TARGET_CI[(S.targets.length + k) % TARGET_CI.length] : (S.shapes.length + k) % 8),   // (the colour newShape will give; k shapes later)
      capPhrase: (s, cs) => shapePhrase(s, 0, cs),   // (a curve named by its maths in a caption: review picture-7)
      newShape, deleteShape, requestRender, commit, shapesChanged, targetsChanged, buildShapeList, toast, undoToast, tourEmit, bindField,
    };
  }
  // every text that may hold names, for rename, delete and "used by": [{label, get, set}]
  function paramFormulas() {
    const out = [];
    S.steps.forEach((st, i) => { for (const [key] of stepTexts(st)) out.push({ label: `f${sub(i + 1)}`, get: () => st.params[key], set: (t) => { st.params[key] = t; } }); });
    const names = shapeNames();
    for (const x of S.shapes.concat(S.targets)) if (x.bind) for (const key of Object.keys(x.bind)) out.push({ label: names.get(x.id) || $t('a target'), get: () => x.bind[key], set: (t) => { x.bind[key] = t; } });
    return out;
  }
  // (v16.5 UX65) an unused number's way into a formula: + a appended to the selected formula step, else the last one
  function paramUseIn(nm) {
    const ks = [];
    S.steps.forEach((st, i) => { if (st.type === 'custom') ks.push(i + 1); });
    if (!ks.length) return null;
    const k = Number.isInteger(S.sel) && ks.includes(S.sel) ? S.sel : ks[ks.length - 1];
    return { label: $t('Use in f{x}', { x: sub(k) }), run: () => {
      const st = S.steps[k - 1];
      if (!st) return;
      st.params.expr = `${String(st.params.expr || 'z').trim()} + ${nm}`;
      chainChanged(true); selectStep(k); commit(); Params.render();
      undoToast($t('f{x} now adds {a}.', { x: sub(k), a: Params.display(nm) }));
    } };
  }
  // the numbers step k uses, with their values, for its editor ("Numbers: a = 1.2")
  function stepNumbers(k) {
    const st = S.steps[k - 1];
    if (!st) return '';
    const ns = [];
    for (const [key] of stepTexts(st)) for (const n of Params.namesIn(st.params[key])) if (!ns.includes(n)) ns.push(n);
    const val = (n) => { const v = Params.get(n); return v == null ? '?' : I18N.num(String(+(+v).toPrecision(4))).replace('-', '−'); };
    return ns.length ? $t('Numbers: {list}', { list: ns.map((n) => `${Params.display(n)} = ${val(n)}`).join(', ') }) : '';
  }
  function paramsRestored() { zpParsed.clear(); Params.render(); }
  // a number changed (a slider, play, a field, undo): the steps and the shapes that use it follow; a drag or play
  // frame is motion (motion-quality frames; the renderer's rest pass follows when it stops)
  function onParamChange(ev) {
    const names = new Set(ev.names || []);
    const big = !!(ev.removed || ev.renamed || ev.inlined);
    if (ev.live) { const t = performance.now(); lastInputT = t; motionInT = t; }
    zpParsed.clear();
    const steps = big || S.steps.some((st) => stepUses(st, names));
    let sh = false, tg = false;
    for (const x of S.shapes) if (applyBinds(x, big ? null : names)) sh = true;
    for (const x of S.targets) if (applyBinds(x, big ? null : names)) tg = true;
    if (steps) chainChanged(big);
    // the tone under a still pointer follows the new function (a slider, Play, a field, undo): the pathless form, the
    // nearest turn (notes/sound/DEFORMATION.md, "The hook for v15"); however often it is called, the tone is
    // re-evaluated once a frame at most (its requestAnimationFrame), together with chainChanged's own report
    if (steps) soundFunctionChanged();
    if (sh || big) shapesChanged(big);
    if (tg || big) targetsChanged(big);
    if (!ev.live) save();
    tourEmit('number-changed', { names: ev.names || [], live: !!ev.live });
  }
  function attachParams() {
    Params.attach({
      list: () => (S && Array.isArray(S.params) ? S.params : []),
      formulas: paramFormulas,
      commit: () => commit(),
      toast: (m) => toast(m),
      announce: (m) => toast(m),
      undoToast: (m) => undoToast(m),
      openMenu: (a, items) => openMenu(a, items),
      useIn: (nm) => paramUseIn(nm),
    });
    if (!attachParams.on) { attachParams.on = true; Params.on('change', onParamChange); }
  }
  // ---- links and scene files ----
  // the figure: the saved state without the panels the viewer chose
  function figureState() {
    if (S.homRange) HR.resolve(S, true);
    const out = Object.assign({}, S, { rightView: rightAuto ? null : { cx: V.right.cx, cy: V.right.cy, s: V.right.s } });
    const o = JSON.parse(JSON.stringify(out, cmSaveReplacer(out)));
    delete o.hideLeft; delete o.hideRight;
    // (review math-10: the recipient sees the same picture: the Landscape camera, relative to its fit, and the
    // deformation at its t; read once at load, never kept in the saved state)
    o.figCam = { yaw: cam.yaw, pitch: cam.pitch, d: cam.dist / CAM3.dist, tx: cam.tx, ty: cam.ty };
    o.figMorph = morph.open ? { T: morph.T } : null;
    return o;
  }
  async function copyFigureLink() {
    let payload;
    try { payload = await Params.encodeLink(figureState()); } catch (e) { console.error(e); sndError(); toast($t('The link could not be made.')); return; }
    const url = location.href.replace(/#.*$/, '') + '#cmw=' + payload;
    if (url.length > Params.LINK_MAX) { sndError(); toast($t('The figure is too large for a link: use Save scene.')); return; }
    await copyText(url);
    toast(url.length > Params.LINK_WARN ? $t('Link copied: {n} characters. Some apps cut long links; Save scene keeps any figure.', { n: url.length }) : $t('Link copied.'));
    sndExportDone();
  }
  function saveScene() { return saveFile('figure.cmw.json', Params.scene(figureState())); }
  function openSceneFile(f) {
    f.text().then((t) => openFigure(Params.readScene(t), 'scene')).catch((e) => { sndError(); toast(e && e.message ? e.message : $t('This scene could not be read.')); });
  }
  function pickScene() {
    const inp = h('input', { type: 'file', accept: '.json,application/json', style: 'position:fixed;left:-9999px;top:0' });
    inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; inp.remove(); if (f) openSceneFile(f); });
    document.body.append(inp);
    inp.click();
  }
  // open a figure (a link's or a scene's state): it is checked like a saved state, written as the saved state, and the
  // page reloads with it; the figure before it is kept for Undo (undoOpen)
  function openFigure(state, how) {
    let st = null;
    // (v16.3.1: constructions this build cannot read are freed here, before the reload; the toast after it says so)
    cmLoad.freed = 0;
    try { st = sanitizeState(JSON.parse(JSON.stringify(state))); } catch (e) { st = null; }
    if (!st) { sndError(); toast(how === 'scene' ? $t('This scene could not be read.') : $t('This link does not hold a figure.')); return false; }
    try {
      const prev = writeState() || localStorage.getItem(LS_KEY);
      if (prev) localStorage.setItem(lsk('cmw-before-open'), prev);
      st.hideLeft = dockPref.L; st.hideRight = dockPref.R;
      localStorage.setItem(LS_KEY, JSON.stringify(st, noRuntime));
      sessionStorage.setItem(lsk('cmw-opened'), how + (cmLoad.freed ? ':freed' : ''));
    } catch (e) { sndError(); toast($t('The figure cannot open here: this browser blocks site storage.')); return false; }
    figureSwap = true;
    try { history.replaceState(null, '', location.href.replace(/#.*$/, '')); } catch (e) { /* the hash stays */ }
    location.reload();
    return true;
  }
  function undoOpen() {
    let prev = null;
    try { prev = localStorage.getItem(lsk('cmw-before-open')); } catch (e) { prev = null; }
    if (!prev) return;
    try { localStorage.setItem(LS_KEY, prev); localStorage.removeItem(lsk('cmw-before-open')); } catch (e) { return; }
    figureSwap = true;
    location.reload();
  }
  // a link opened over the viewer's own figure asks first (the bar stays until answered)
  function askOpen(st) {
    const host = $('toastHost');
    if (!host) return;
    host.innerHTML = '';
    const t = h('div', { class: 'toast', role: 'alertdialog', 'aria-label': $t('Open the linked figure') }, h('span', null, $t('This link holds a figure. Open it in place of yours? Undo brings yours back.')),
      h('button', { class: 'toast-act', onclick: () => { t.remove(); openFigure(st, 'link'); } }, $t('Open')),
      h('button', { class: 'toast-act', onclick: () => t.remove() }, $t('Keep mine')));
    host.append(t);
  }
  function setupParams(hadSaved) {
    // (the Parameters component lives in the Inspector's Parameters slot: inspector.js calls Params.mount)
    // a new name typed in a formula field: Enter (or leaving the field) adds the number before the field reads its text
    document.addEventListener('change', (e) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || !el.hasAttribute('data-fx')) return;
      const u = Params.unknownIn(el.value);
      if (!u.length) return;
      if (u.length > 1) { sndError(); toast($t('One new name at a time: {x}', { x: u.map(Params.display).join(', ') })); return; }
      const c = Params.check(u[0]);
      if (c.error) { sndError(); toast(c.error); return; }
      Params.add(c.name);
      el.dispatchEvent(new Event('input'));
      setTimeout(() => undoToast($t('Added the number {x}', { x: Params.display(c.name) })), 0);
    }, true);
    // a scene file dropped on the page
    const jsonFile = (dt) => !!dt && [...(dt.items || [])].some((it) => it.kind === 'file' && /json/.test(it.type || ''));
    window.addEventListener('dragover', (e) => { if (jsonFile(e.dataTransfer)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
    window.addEventListener('drop', (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (!f || !(/\.json$/i.test(f.name) || /json/.test(f.type || ''))) return;
      e.preventDefault();
      openSceneFile(f);
    });
    // after opening a link or a scene: say so, with Undo (the figure before it)
    let opened = null;
    try { opened = sessionStorage.getItem(lsk('cmw-opened')); sessionStorage.removeItem(lsk('cmw-opened')); } catch (e) { opened = null; }
    // (v16.3.1: with the note that some constructions were opened as plain shapes, freed by openFigure before the
    // reload, or by this load; this toast would replace the note's own toast)
    if (opened) {
      const freed = /:freed$/.test(opened) || !!cmLoad.freed, how = opened.replace(/:freed$/, '');
      setTimeout(() => toast((how === 'scene' ? $t('Opened the scene.') : $t('Opened the figure from the link.')) + (freed ? ' ' + $t('Some constructions could not be read and were opened as plain shapes.') : ''), $t('Undo'), undoOpen), 400);
    }
    // a link: #cmw=<payload>, when the page opens, or pasted into the address bar of the open page (a hash change)
    const fromLink = (fresh) => {
      const m = /[#&]cmw=([A-Za-z0-9_.-]+)/.exec(location.hash || '');
      if (!m) return;
      Params.decodeLink(m[1]).then((st) => {
        try { history.replaceState(null, '', location.href.replace(/#.*$/, '')); } catch (e) { /* the hash stays */ }
        if (fresh) openFigure(st, 'link'); else askOpen(st);
      }).catch((e) => { sndError(); toast(e && e.message ? e.message : $t('This link does not hold a figure.')); });
    };
    fromLink(!hadSaved);
    window.addEventListener('hashchange', () => fromLink(false));
  }
  // TEMP-DEBUG-HOOK (removed before publishing)
  window.__cmwP = () => ({ params: JSON.parse(JSON.stringify(S.params)), steps: JSON.parse(JSON.stringify(S.steps)), shapes: JSON.parse(JSON.stringify(S.shapes)), targets: JSON.parse(JSON.stringify(S.targets)), errors: built.map((b) => (b && b.error) || ''), sig: chainSig[chainSig.length - 1], hi, n: hist.length, figure: figureState() });
  window.__cmwPOpen = (st, how) => openFigure(st, how || 'link');
  // TEMP-DEBUG-HOOK
  function init() {
    SoundHooks.init(soundHooksApi());   // the sound hooks (src/soundhooks.js), before anything can make a sound
    Export.init(exportApi());   // export and captions (src/export.js)
    MorphPaths.init(morphPathsApi());   // the deformation's paths (src/morphpaths.js)
    Integrals.init(integralsApi());   // the integrals (src/integrals.js)
    // TEMP-DEBUG-HOOK (removed before publishing)
    // (v15: the quality and perf suites keep the v14 pane geometry, a 272 px chain, from the first layout on, so no
    // canvas is ever sized for the taller planes; setupGutters applies it again after a stored height)
    if (window.__cmwChainH > 0) document.documentElement.style.setProperty('--chain-h', window.__cmwChainH + 'px'); // TEMP-DEBUG-HOOK
    // i18n (notes/i18n/DESIGN.md 2): English does nothing here
    I18N.applyPage();
    I18N.applyStatic($('app'));
    // the command field shows the short form (DESIGN.md 8.3); its aria-label keeps the whole phrase
    // (and «Поиск» where the header is short of room: page.html, review ui-9)
    if (I18N.lang !== 'en') { const ct = document.querySelector('#cmdBtn .cmd-text'); if (ct) { ct.textContent = ''; ct.append(h('span', { class: 'ct-l' }, $tx('field', 'Add function or command')), h('span', { class: 'ct-s' }, $tx('field-short', 'Add function or command'))); } }
    I18N.reveal();
    // the switch reloads only when the work was written and reads back (review i18n-3); while a tour holds the canvas
    // the saved state is the user's own work, and the tour's scenes are never stashed as undo history
    I18N.onSwitch(() => {
      const held = typeof tourHold !== 'undefined' && !!tourHold;
      const wrote = held ? null : writeState();
      let ok = false;
      try { ok = !S || (held ? localStorage.getItem(LS_KEY) != null : wrote !== false && localStorage.getItem(LS_KEY) === wrote); } catch (e) { ok = false; }
      if (!ok) return false;
      // the open panels come back too: the deformation (at its t, paused), the open lamp, the selected shape
      if (!held) { try { sessionStorage.setItem(lsk('cmw-switch'), JSON.stringify({ hist, hi, at: Date.now(), ui: { morph: morph.open ? { T: morph.T } : null, lamp: openLamp, sel: selected, focus: 1, phone: Phone.isOn() ? { k: Phone.sheet(), nums: !!(Phone.nums && Phone.nums()), big: Phone.big() } : null } })); } catch (e) { /* undo starts afresh */ try { localStorage.setItem(lsk('cmw-switch-lost'), String(hist.length > 1 ? Date.now() : 0)); } catch (e2) { /* nothing to say */ } } }
      return true;
    }, () => toast($t('The language cannot change: this browser blocks site storage, and a reload would lose your work.')));
    // canvas text (rulers, legend, plot labels) is redrawn once the Cyrillic faces have loaded (review i18n-12)
    I18N.onFonts(() => { for (const k in rulerCache) rulerCache[k] = null; drawLegend(); requestRender('L', 'R', 'T'); });
    GLR.init();
    GLR.onRestore = () => { gpu.clear(); for (const e of sm.entries.values()) e.res = null; rebuild(); if (guard) guard.reset(); for (const g of Object.values(paneG)) { g.qs.length = 0; g.reads.length = 0; g.t = 0; } invWaiting.clear(); requestRender('L', 'R', 'T'); };
    // a lost context shows its "restoring" note at once; a background compile that lands redraws with it
    GLR.onLost = () => requestRender('L', 'R');
    // w.main: the user's chain (panes, step thumbnails); w.side: example thumbnails (GLR side mode)
    // once nothing compiles (the views' plain programs and the exact images have landed), the views' homotopy programs
    // (one per map mode, gl.js MAP) compile in the background, so a deformation started later plays at once; never
    // before, so they do not delay the first image or an inverse program (its compile waits for forward programs)
    let modesT = 0;
    const prestartModesIdle = () => {
      clearTimeout(modesT);
      modesT = setTimeout(() => { try { if (GLR.ok && GLR.prestartModes && !GLR.compiling) GLR.prestartModes(S.homAll ? [3] : [1]); } catch (e) { /* the deformation starts them */ } }, 400);
    };
    GLR.onReady = (w) => {
      // an inverse program that landed is warmed first, at once unless something moves (scheduleWarm)
      if (GLR.inverseColdWaiting) scheduleWarm(0);
      // (thumbnails too: one drawn forward before an inverse program landed is redrawn; the others hit their cache)
      if (!w || w.main) { requestRender('L', 'R'); requestRender('T'); prestartModesIdle(); }
      if ((!w || w.side) && exWait.size) retryExampleThumbs();
    };
    setTheme(themePref()); // before the first readTheme, so canvases start in the saved theme
    GLR.setPalette(palPref());
    readTheme();
    paneL = new Pane($('canvasL'), $('overlayL'));
    paneR = new Pane($('canvasR'), $('overlayR'));
    const loaded = load();
    S = loaded || blankState();
    if (!Array.isArray(S.params)) S.params = [];
    attachParams();
    bindsAll();
    dockPref.L = !!S.hideLeft; dockPref.R = !!S.hideRight;
    // narrow windows start with the drawers closed (run-time only: save() writes dockPref)
    if (isDrawer('R')) S.hideRight = true;
    if (isDrawer('L')) S.hideLeft = true;
    // (v15, 1024 to 1279: one panel docks; the Inspector when the chain has steps, the tools on an empty canvas)
    if (oneDock()) { if (S.steps.length) { S.hideLeft = true; S.hideRight = false; } else { S.hideLeft = false; S.hideRight = true; } }
    if (S.clipWin) clipWin = S.clipWin;
    paneL.resize(); paneR.resize();
    paneL.setView(S.srcView);
    // (v16 review picture-1) a saved state without its window (older saves, hand-made states) meshes and samples in
    // the window of its view, as a scene opened from a file does, never in a fixed -4…4 that a deep view lies inside
    if (!S.clipWin && S.srcView && Number.isFinite(S.srcView.s) && S.srcView.s > 0) { const vb = viewBox(S.srcView); if (goodWin(vb)) { clipWin = vb; S.clipWin = clipWin; } }
    buildTools();
    setupFormula();
    setupParams(!!loaded);
    buildDisplay();
    setupPane(paneL, 'L');
    setupPane(paneR, 'R');
    PlaneMenu.init(planeMenuApi());   // the planes' context menu (v15)
    Commands.init(commandsApi());   // the command palette (src/commands.js)
    Construct.init({ cm: cmApi() });   // v16 constructions (the interface)
    if (Construct.ui) Construct.ui(cmUiApi());   // v16 (INTERFACE): the app's adapter
    // right tabs
    for (const el of document.querySelectorAll('.ic-slot[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] || '';
    $('cmdKbd').textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
    $('cmdBtn').addEventListener('click', (e) => openPalette(e.currentTarget));
    hdrFitInit();
    // the view controls: the top bar's view switch (merged-views.md) and the panes' Plane | Sphere radios (U4)
    const vsw = $('viewSwitch');
    if (vsw) {
      for (const [v, l, k, html] of MAINS) vsw.append(h('button', { 'data-mode': v, role: 'radio', 'data-tip': `${l}  ${k}`, 'aria-label': l, html: `${VIEW_ICONS[v]}<span>${html}</span>`, onclick: () => setMain(v) }));
      vsw.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const i = MAINS.findIndex((x) => x[0] === S.view.main), j = Math.max(0, Math.min(MAINS.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        setMain(MAINS[j][0]); vsw.children[j].focus(); e.preventDefault();
      });
    }
    for (const side of ['L', 'R']) {
      const el = $(side === 'L' ? 'leftTabs' : 'rightTabs');
      for (const [v, l, k] of SURF[side]) el.append(h('button', { 'data-mode': v, role: 'radio', 'data-tip': k ? `${l}  ${k}` : l, 'aria-label': l, html: `${VIEW_ICONS[v]}<span>${l}</span>`, onclick: () => setView(side, v), ...(v === 'sphere' ? { onpointerenter: prestartGlobe, onfocus: prestartGlobe } : {}) }));
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const list = SURF[side], i = list.findIndex((x) => x[0] === (side === 'L' ? xView() : S.view.R).surf);
        const j = Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        setView(side, list[j][0]); el.children[j].focus(); e.preventDefault();
      });
    }
    // the Key switch in X's legend chip: the colour key painted in the Y plane
    const kc = $('wKeyChk');
    if (kc) kc.addEventListener('change', () => { S.wKey = kc.checked; buildRightFoot(); requestRender('R'); save(); tourEmit('phase-key', { on: !!kc.checked }); });
    // the Deformation toggle in the top bar (M; merged-views.md): it modifies the active view
    const mb = $('morphBtn');
    if (mb) { mb.innerHTML = $t('{iconMorph}<span>Deformation</span>', { iconMorph: MODE_ICONS.morph }); mb.addEventListener('click', () => toggleTransport()); }
    // a deformation is coming: the homotopy programs (one per map mode, gl.js MAP) start compiling in the background,
    // so its first frames do not wait for them (the pointer or focus on the toggle, as prestartGlobe)
    const prestartMorph = () => { try { if (!morph.open && GLR.ok && GLR.prestartModes) GLR.prestartModes(S.homAll ? [3] : [1]); } catch (e) { /* the frame starts them */ } };
    if (mb) { mb.addEventListener('pointerenter', prestartMorph); mb.addEventListener('focus', prestartMorph); }
    $('linesChk').addEventListener('change', (e) => { S.lines = e.target.checked; requestRender('L', 'R', 'T'); save(); });
    $('chevChk').addEventListener('change', (e) => { S.chev = e.target.checked; requestRender('L', 'R'); save(); });
    // Snap: in the Draw heading and the last button of the collapsed rail (P3); Unit circle: in Display
    // ([v16.5 rail SPEC 4.3] the button was "Snap while drawing": it now names what it snaps to, the grid and figures)
    $('snapBtn').addEventListener('click', () => { S.snap = !S.snap; syncSnapUnit(); save(); sndToggleCue(S.snap); });
    $('unitChk').addEventListener('change', (e) => { S.unit = e.target.checked; requestRender('L', 'R', 'T'); save(); });
    $('alphaRange').addEventListener('input', (e) => { S.alpha = +e.target.value; $('alphaVal').textContent = I18N.num(S.alpha.toFixed(2)); paintFader(e.target); requestRender('L', 'R', 'T'); save(); });
    $('meshRange').addEventListener('input', (e) => { showMeshVal(posToMesh(+e.target.value)); });
    $('patScale').addEventListener('input', (e) => { S.patternScale = 2 ** +e.target.value; cellBase = 0; buildDisplay(); requestRender('L', 'R', 'T'); save(); });
    $('leftReadout').addEventListener('click', () => copyReadout('L'));
    $('rightReadout').addEventListener('click', () => copyReadout('R'));
    for (const b of $('chainMode').children) b.addEventListener('click', () => {
      S.compact = b.dataset.mode === 'compact';
      const hgt = S.compact ? 96 : 188;
      document.documentElement.style.setProperty('--chain-h', hgt + 'px');
      try { localStorage.setItem(lsk('cmw-chain-h2'), String(hgt)); } catch (e) { /* ignore */ }
      applyLayout(); save();
    });
    radioKeys($('chainMode'));
    radioKeys($('patternSeg'));
    // on phones the More sheet of tools closes once a tool is picked
    $('tools').addEventListener('click', (e) => { const tm = $('toolMore'); if (tm && tm.open && e.target.closest('.tool')) tm.open = false; });
    // from 768 px up the panel sections are always open: their summaries are headings, not Tab stops or toggles
    const phoneMQ = matchMedia('(max-width: 767px)');
    const syncSections = () => {
      for (const d of document.querySelectorAll('details.psec')) {
        const s = d.querySelector(':scope > summary');
        if (!s) continue;
        if (phoneMQ.matches) s.removeAttribute('tabindex'); else { s.tabIndex = -1; d.open = true; }
      }
    };
    for (const d of document.querySelectorAll('details.psec')) d.addEventListener('toggle', () => { if (!phoneMQ.matches && !d.open) d.open = true; });
    phoneMQ.addEventListener('change', syncSections);
    syncSections();
    setupGutters();
    setupTooltips();
    setupFocusKeeper();
    // the undo entry follows the focused step until the next action (see noteFocus)
    document.addEventListener('pointerdown', noteFocus, true);
    document.addEventListener('keydown', noteFocus, true);
    // write pending changes (and the right-plane view) when the page is hidden or closed
    window.addEventListener('pagehide', writeState);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeState(); });
    // (v16.5 UX99) a right click on a chain card or a Shapes row opens its ⋯ menu at the pointer, as on the planes
    // (a mouse only: a phone's long press keeps its own meaning)
    document.addEventListener('contextmenu', (e) => {
      const t = e.target instanceof Element ? e.target : null;
      if (!t || document.documentElement.classList.contains('ph') || (e.pointerType && e.pointerType !== 'mouse')) return;
      const card = t.closest('#pipeline .card[data-k]'), row = !card && t.closest('.shape-row');
      const more = card ? card.querySelector('.card-head .more') : row ? row.querySelector(':scope > .more') : null;
      if (!more || more.disabled) return;
      e.preventDefault();
      if (popEl && popEl._opener === more) closePalette();
      more.click();
      const pop = popEl && popEl._opener === more ? popEl : null;
      if (!pop) return;
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let px = e.clientX + 2, py = e.clientY + 2;
      if (px + pw > window.innerWidth - 12) px = Math.max(12, e.clientX - pw - 2);
      if (py + ph > window.innerHeight - 12) py = Math.max(12, e.clientY - ph - 2);
      pop.style.left = px + 'px'; pop.style.top = py + 'px';
    });
    // (v16.5 UX80) a message is placed clear of the planes' controls when it shows and when the layout changes
    { const th = $('toastHost'); if (th) new MutationObserver(() => placeToasts()).observe(th, { childList: true }); window.addEventListener('resize', () => requestAnimationFrame(placeToasts));
      // ([v16.5 fix regress-2] and whenever the layout under a toast changes while it stays up: the deformation's dock
      // opening or closing, the learning lane showing or hiding, a panel: each resizes a plot or the chain; one rAF, and
      // only while a toast shows)
      if (typeof ResizeObserver !== 'undefined' && th) {
        let q = 0;
        const ro = new ResizeObserver(() => { if (!q && th.firstElementChild) q = requestAnimationFrame(() => { q = 0; placeToasts(); }); });
        for (const el of [$('plotL'), $('plotR'), document.querySelector('.pipe-wrap')]) if (el) ro.observe(el);
      } }
    // crossing a drawer breakpoint: a drawer starts closed, a docked panel follows the user's choice
    let drawerWas = { L: isDrawer('L'), R: isDrawer('R') }, wideWas = window.innerWidth >= 768, oneWas = oneDock();
    window.addEventListener('resize', () => {
      const now = { L: isDrawer('L'), R: isDrawer('R') }, wide = window.innerWidth >= 768;
      if (wide && wideWas && (now.L !== drawerWas.L || now.R !== drawerWas.R)) {
        if (now.L !== drawerWas.L) S.hideLeft = now.L || dockPref.L;
        if (now.R !== drawerWas.R) S.hideRight = now.R || dockPref.R;
        applyLayout();
      }
      drawerWas = now; wideWas = wide;
      if (oneDock() && !S.hideLeft && !S.hideRight) applyLayout();   // (v15: one docked panel from 1024 to 1279)
      // (review regress-1: back at 1280 or more, both panels follow the user's choice again)
      const one = oneDock();
      if (oneWas && !one && window.innerWidth >= 1280 && (S.hideLeft !== dockPref.L || S.hideRight !== dockPref.R)) { S.hideLeft = dockPref.L; S.hideRight = dockPref.R; applyLayout(); }
      oneWas = one;
      if (tempInsp) placeTemp();
    });
    // a pointerdown outside an open overlay drawer closes it
    document.addEventListener('pointerdown', (e) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest('#popHost, .modal-bg')) return;
      const inL = t.closest('#leftPanel, #leftRail, #toggleLeft'), inR = t.closest('#rightPanel, #rightRail, #toggleRight');
      const l = isDrawer('L') && !S.hideLeft && !inL, r = isDrawer('R') && !S.hideRight && !inR;
      if (l || r) setPanels(S.hideLeft || l, S.hideRight || r);
    }, true);
    $('meshRange').addEventListener('change', (e) => setMesh(posToMesh(+e.target.value)));
    for (const b of document.querySelectorAll('#meshPresets button')) b.addEventListener('click', () => setMesh(+b.dataset.n));
    $('toggleLeft').addEventListener('click', () => setPanels(!S.hideLeft, S.hideRight));
    $('toggleRight').addEventListener('click', () => setPanels(S.hideLeft, !S.hideRight));
    $('leftCollapse').addEventListener('click', () => setPanels(true, S.hideRight));
    $('leftRailOpen').addEventListener('click', () => setPanels(false, S.hideRight));
    $('rightRailOpen').addEventListener('click', () => setPanels(S.hideLeft, false));
    // (v15: the rail's Edit opens the selection in the temporary Inspector, over the stage's right edge)
    if ($('rightRailEdit')) $('rightRailEdit').addEventListener('click', () => { if (tempInsp) { closeTemp(); return; } if (window.innerWidth >= 1024 && S.hideRight) openTemp(); else setPanels(S.hideLeft, false); });
    $('leftSolo').addEventListener('click', () => setSolo('L'));
    $('rightSolo').addEventListener('click', () => setSolo('R'));
    applyLayout();
    $('leftFit').addEventListener('click', () => {
      if (!lFlat()) { const c = camOf('L'); if (c) tweenCam(c, camBaseOf(c)); return; }
      paneL.setView(leftView());
      const target = fittedView(paneL, leftStage());
      if (leftStage() > 0) leftAuto = true;
      tweenView(leftView(), target, 260, () => sourceViewChanged());
    });
    $('rightFit').addEventListener('click', () => { rightAuto = true; fitRight(true, morphOn()); requestRender('R'); });
    // On a touch phone the legend chips start folded to their colour wheel and a tap unfolds them (merged-views
    // review: on a 356 px plot the key covered a third of the landscape); a tap on a folded or unfolded chip toggles
    for (const id of ['leftLegend', 'rightLegend']) {
      const el = $(id);
      if (!el) continue;
      try { if (matchMedia('(pointer: coarse)').matches && el.parentNode && !el.parentNode.classList.contains('pane-head')) el.classList.add('collapsed'); } catch (e) { /* no media queries */ }
      el.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.key-sw')) return; if (el.parentNode && el.parentNode.classList.contains('pane-head')) el.classList.toggle('open'); else el.classList.toggle('collapsed'); });
    }
    for (const [side, pane] of [['left', paneL], ['right', paneR]]) {
      $(side + 'ZoomIn').innerHTML = ICONS.plus;
      $(side + 'ZoomOut').innerHTML = ICONS.minus;
      $(side + 'Fit').innerHTML = ICONS.fit;
      $(side + 'Solo').innerHTML = ICONS.expand;
      const zb = (f) => () => {
        const sd = side === 'left' ? 'L' : 'R';
        if (is3DSide(sd)) { zoomPane(pane, sd, pane.w / 2, pane.h / 2, f); return; }
        const v = sd === 'L' ? leftView() : V.right;
        pane.setView({ cx: v.cx, cy: v.cy, s: v.s });
        const target = { cx: v.cx, cy: v.cy, s: Math.min(1e9, Math.max(1e-6, v.s * f)) };
        if (sd === 'R') rightAuto = false; else if (leftStage() > 0) leftAuto = false;
        tweenView(v, target, 180, () => sourceViewChanged());
      };
      $(side + 'ZoomIn').addEventListener('click', zb(1.6));
      $(side + 'ZoomOut').addEventListener('click', zb(1 / 1.6));
    }
    $('viewAllBtn').addEventListener('click', () => setFocus(0));
    $('clearChain').addEventListener('click', () => { if (!S.steps.length) return; S.steps = []; S.focus = 0; chainChanged(true); setFocus(0); commit(); undoToast($t('Chain cleared.')); });
    // (D1, issue #23: Clear chain is a word button in the chain head again, shown while there is a chain to clear; it
    // had been under a ⋯ there since v15, review design-18)
    $('clearChain').hidden = !S.steps.length;
    // Clear in the Shapes heading removes both groups (P15); each row menu clears its own group
    $('clearShapes').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearGroup(true, true); });
    $('undoBtn').addEventListener('click', () => {
      // [v16.5 UX15] a construction's last pick, [UX14] an open polygon's last point, before any finished work
      const w = Construct.undoPick();
      if (w != null) { toast(w ? $t('Undid the pick: {x}', { x: w }) : $t('Undid the last pick')); updateUndo(); return; }
      if (polyBack()) return;
      if (hi > 0) { hi--; restore(hist[hi]); }
    });
    $('redoBtn').addEventListener('click', () => { if (hi < hist.length - 1) { hi++; restore(hist[hi]); } });
    $('helpBtn').addEventListener('click', (e) => Tour.openHelpMenu(e.currentTarget));
    sndInit();
    $('exportBtn').addEventListener('click', (e) => openExportMenu(e.currentTarget));
    $('shareBtn').addEventListener('click', (e) => openShareMenu(e.currentTarget));
    getDownloads(); // resolves the save capability early (no prompt until a save)
    $('examplesBtn').addEventListener('click', (e) => openGallery(e.currentTarget));
    // the cycle runs on the theme in use, so it still reaches Dark when storage is blocked
    let curTheme = themePref();
    $('themeBtn').addEventListener('click', () => {
      const order = ['auto', 'light', 'dark'];
      curTheme = order[(order.indexOf(curTheme) + 1) % 3];
      setTheme(curTheme);
      sndToggleCue(curTheme !== 'light');
    });
    setTheme(curTheme);
    // Phase colors (issue 8): the palette menu, with a preview of each
    const pb = $('palBtn');
    if (pb) {
      pb.setAttribute('aria-expanded', 'false');
      pb.addEventListener('click', (e) => {
        const pop = openMenu(e.currentTarget, palItems());
        pb.setAttribute('aria-expanded', String(!!pop));
        if (pop) { const mo = new MutationObserver(() => { if (!pop.isConnected) { pb.setAttribute('aria-expanded', 'false'); mo.disconnect(); } }); mo.observe($('popHost'), { childList: true }); }
      });
      syncPalBtn();
    }
    // [v17 D5, #82] Settings (⚙): what is rarely changed, in one pop-down under the button: the theme, the language,
    // sound and its settings, the panels, mesh quality (lent from #settingsHome) and help. The Language setting (device
    // only: Auto, English, Русский, Italiano; a choice that changes the language reloads) is here and in the palette:
    // the header's globe went (notes/i18n/USER-DECISIONS.md, 2026-10-28)
    const sb = $('settingsBtn');
    if (sb) sb.addEventListener('click', () => openSettings(sb));
    function openSettings(btn) {
      if (popEl && popEl.classList.contains('set-pop')) { closePalette(); btn.focus(); return; }   // (a re-click closes)
      closePalette();
      const sep = (t, first) => h('div', { class: 'opts-h' + (first ? '' : ' opts-sep') }, t);
      // (Auto's tooltip names what it would pick here: a test page's ?ns= stays English, review eng-12; the languages'
      // own names are never translated)
      const autoName = { en: 'English', ru: 'Русский', it: 'Italiano' }[I18N._resolve({ param: null, pref: 'auto', ns: I18N.NS, nav: navigator })] || 'English';
      const kids = [sep($t('Theme'), true), seg('setTheme', curTheme, [['auto', $t('Auto')], ['light', $t('Light')], ['dark', $t('Dark')]], (v) => { curTheme = v; setTheme(v); sndToggleCue(v !== 'light'); }, $t('Theme')),
        sep($t('Language')), seg('setLang', I18N.readPref(), [['auto', $t('Auto'), $t('Auto ({name})', { name: autoName })], ['en', 'English'], ['ru', 'Русский'], ['it', 'Italiano']], (v) => pickLang(v), $t('Language'))];
      if (SND) {
        const sw = h('input', { type: 'checkbox', class: 'snd-switch', role: 'switch', 'aria-label': $t('Sound') });
        sw.checked = !!SND.prefs().on;
        sw.addEventListener('change', () => { $('soundBtn').click(); sw.checked = !!SND.prefs().on; });
        kids.push(sep($t('Sound')), h('div', { class: 'set-row' }, h('span', { class: 'fl' }, $t('Sound (Shift+M)')), sw),
          h('button', { class: 'set-link', type: 'button', onclick: () => { closePalette(); $('soundMore').click(); } }, $t('Sound settings…')));
      }
      const panel = (label, key, on, set) => {
        const c = h('input', { type: 'checkbox' });
        c.checked = on;
        c.addEventListener('change', () => set(c.checked));
        return h('label', { class: 'check' }, c, h('span', null, label), h('span', { class: 'kbd' }, key));
      };
      kids.push(sep($t('Panels')), panel($t('Region tools'), '[', !S.hideLeft, (v) => setPanels(!v, S.hideRight)), panel($t('Inspector'), ']', !S.hideRight, (v) => setPanels(S.hideLeft, !v)));
      const mesh = $('meshGroup');
      if (mesh) kids.push(sep(''), mesh);   // (the fader names itself: Mesh quality)
      const help = (label, run) => h('button', { class: 'set-link', type: 'button', onclick: () => { closePalette(); run(); } }, label);
      kids.push(sep($t('Help')), h('div', { class: 'set-help' }, help($t('Guided tour'), () => Tour.openHelpMenu($('helpBtn'))), help($t('Reference guide'), () => openGuide()),
        help($t('Keyboard shortcuts'), () => { openGuide(); const k = [...document.querySelectorAll('.modal h3')].find((x) => ['Keys', $t('Keys')].includes(x.textContent.trim())); if (k) k.scrollIntoView({ block: 'start' }); })));
      const pop = h('div', { class: 'pop opts-pop set-pop', role: 'dialog', 'aria-label': $t('Settings') }, ...kids);
      pop._onClose = () => { btn.setAttribute('aria-expanded', 'false'); const home = $('settingsHome'); if (mesh && home && mesh.parentNode === pop) home.append(mesh); };
      $('popHost').append(pop);
      popEl = pop;
      btn.setAttribute('aria-expanded', 'true');
      // (under the button, its right edge on the button's, inside the window)
      const r = btn.getBoundingClientRect(), pw = pop.offsetWidth;
      pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.right - pw)) + 'px';
      pop.style.top = (r.bottom + 6) + 'px';
      pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePalette(); btn.focus(); } });
      const first = pop.querySelector('.seg > .on') || pop.querySelector('button, input');
      if (first) first.focus({ preventScroll: true });
      armOutside(btn);
    }
    // Esc stops anything playing, whoever else handles that Esc (the export dialog, the palette, the tour, a menu):
    // first, in the capture phase, and without taking the key from them. During a tour, the Esc that stops a
    // Listen along does only that: the next Esc ends the tour
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const playing = !!snd.play;
      soundStop();
      if (playing && Tour.isActive && Tour.isActive() && !document.querySelector('.modal-bg, #popHost > .pop')) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('keydown', (e) => {
      // nothing reaches the app behind a modal dialog; a handled key, or one in a popover or menu, stays there
      if (e.defaultPrevented || document.querySelector('.modal-bg')) return;
      const t = e.target instanceof Element ? e.target : document.body;
      const tag = t.tagName.toLowerCase(), mod = e.ctrlKey || e.metaKey, kk = I18N.keyOf(e) || '', key = kk.toLowerCase();
      if (t.closest('#popHost') && !(mod && key === 'k') && !(e.shiftKey && !mod && !e.altKey && key === 'm')) return;
      // text fields keep their keys and native undo; a select keeps plain keys (type-ahead), not ⌘Z
      const textEntry = t.isContentEditable || tag === 'textarea' || (tag === 'input' && /^(|text|number|search|email|url|tel|password)$/.test((t.getAttribute('type') || '').toLowerCase()));
      const typing = textEntry || tag === 'select';
      if (mod && key === 'z' && !textEntry) {
        e.preventDefault();
        if (e.shiftKey) $('redoBtn').click(); else $('undoBtn').click();
        return;
      }
      if (mod && key === 'y' && !textEntry) { e.preventDefault(); $('redoBtn').click(); return; }
      if (mod && key === 'e' && !e.shiftKey && !e.altKey && !textEntry) { e.preventDefault(); Figure.open(); return; }
      // (Ctrl K a second time closes the palette; over another popover, a step's Display ▾ or a menu, it opens the palette)
      if (mod && key === 'k') { e.preventDefault(); if (popEl && popEl.classList.contains('palette')) closePalette(); else openPalette(null); return; }
      if ((e.key === '/' || I18N.isPaletteSlash(e)) && !typing && !popEl) { e.preventDefault(); openPalette(null); return; }
      if (typing) return;
      // Tab on a focused plane steps through its shapes (Shift+Tab backwards); past the last one Tab leaves the plane as usual
      if (e.key === 'Tab' && !mod && !e.altKey && t.matches('.plot > canvas.overlay')) {
        const list = t.id === 'overlayR' ? S.targets : S.shapes;
        const i = list.findIndex((x) => x.id === selected), n = i + (e.shiftKey ? -1 : 1);
        if (list.length && n >= 0 && n < list.length && !(i < 0 && e.shiftKey)) {
          e.preventDefault(); selected = list[n].id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'P'); return;
        }
      }
      if (e.key === 'Escape') {
        const tm = $('toolMore');
        if (padEl) closePad(); else if (popEl) closePalette(); else if (tm && tm.open) tm.open = false;
        else if (closeTemp()) { requestRender('P'); } else if (closeDrawers()) { /* closed an overlay drawer */ } else if (draft) { if (draft.pending) dropPending(); else draft = null; requestRender('L', 'OR', rGlobe() ? 'R' : null); } else if (selected) { selected = null; buildShapeList(); requestRender('L', 'R'); }
        else if (tool !== 'select') setTool('select');
        else if (modeNext()) modeClose(modeNext());
        soundStop();
      }
      if (e.key === 'Enter' && draft && draft.kind === 'polygon') finishPolygon();
      // (v16.5 UX97) ⌘D duplicates the selected shape; ⌘] and ⌘[ bring it forward and send it backward
      if (mod && !e.altKey && selected && (key === 'd' || kk === ']' || kk === '[')) {
        const s = findShape(selected);
        if (s) { e.preventDefault(); if (key === 'd') duplicateShape(s); else moveShape(s.id, kk === ']' ? 1 : -1); return; }
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // (v16.5 UX97) the deformation: K plays or pauses, Shift+← and Shift+→ go to the previous or next step's tick
      if (morph.open && key === 'k') { e.preventDefault(); togglePlay(); return; }
      if (morph.open && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); morphTick(e.key === 'ArrowRight' ? 1 : -1); return; }
      // (v16.5 UX97) the arrows move the selected shape (Shift: ten steps); not in a list, a slider or a menu of its own
      if (selected && /^Arrow(Left|Right|Up|Down)$/.test(e.key) && !t.closest('#pipeline, [role="listbox"], [role="option"], [role="radiogroup"], [role="slider"], [role="menu"], input, select, #propsPanel, .ph-sheet')) {
        const s = findShape(selected), d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
        if (s && nudgeShape(s, d[0], d[1], e.shiftKey)) { e.preventDefault(); return; }
      }
      if (e.shiftKey && key === 'm') { e.preventDefault(); soundToggle(); return; }
      // views (merged-views.md): 1 X → Y, 2 Phase, 3 Landscape. One map for the surfaces in every view (merged-views
      // review): Shift 1, 2 Plane, Sphere of the left or only panel (X in X → Y, the portrait in Phase), Shift 3, 4 of
      // Y (X → Y). By e.code, so Shift 1 is not "!" and the digits work on any layout (AZERTY included); before every
      // e.key shortcut, so a digit key that types '+' or '?' (Swiss ⇧1, Czech 1) still picks a view
      const dg = /^(?:Digit|Numpad)([1-4])$/.exec(e.code || '');
      if (dg && (e.shiftKey || +dg[1] <= 3)) {
        const d = +dg[1];
        if (e.shiftKey) { const sf = d % 2 === 1 ? 'plane' : 'sphere'; if (d <= 2) { if (!lLand()) setView('L', sf); } else if (S.view.main === 'xy') setView('R', sf); }
        else setMain(MAINS[d - 1][0]);
        e.preventDefault();
        return;
      }
      if (kk === '[') setPanels(!S.hideLeft, S.hideRight);
      if (kk === ']') setPanels(S.hideLeft, !S.hideRight);
      if (e.key === 'Backspace' && polyDraftOpen()) { e.preventDefault(); polyBack(); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && zpSel && zpStep() && zpStep().k === zpSel.k) { e.preventDefault(); zpRemove(zpSel.k, zpSel.kind, zpSel.i); return; }
      if (e.key === 'Escape' && zpSel) { zpSel = null; requestRender('OL'); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteShape(selected); return; }
      if (e.key === '?') { openGuide(); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); openPalette(null, undefined, { fnOnly: true }); return; }
      if (key === 'm') { e.preventDefault(); toggleTransport(); return; }
      // P: the deformation's Paths while it shows in X → Y (drawing is off there), the Point tool otherwise
      if (key === 'p' && morphOn() && S.view.main === 'xy') { e.preventDefault(); if (!morphHasDeriv()) setMorphPaths(!(S.morphPaths !== false)); return; }
      if (key === 'z') { $('leftFit').click(); if (autoFit()) $('rightFit').click(); return; }
      const tl = TOOLS.find((x) => x[2] && x[2].toLowerCase() === key);
      if (tl) { e.preventDefault(); setTool(tl[0]); }
    });
    const ro = new ResizeObserver(() => onPaneResize());
    ro.observe(paneL.canvas); ro.observe(paneR.canvas);
    // (a notice whose theme is the one already read is skipped: the export's one-off read of the light tokens)
    const themeKey = () => `${document.documentElement.getAttribute('data-theme')}|${document.documentElement.className}|${matchMedia('(prefers-color-scheme: dark)').matches}`;
    let themeSeen = themeKey();
    const themeChanged = () => { const k = themeKey(); if (k === themeSeen) return; themeSeen = k; readTheme(); buildDisplay(); buildShapeList(); drawLegend(); for (const k in rulerCache) rulerCache[k] = null; requestRender('L', 'R', 'T'); };
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged);
    new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    if (loaded) {
      try {
        rebuild();
        buildShapeList();
        buildPipeline();
        hist = [snap()]; hi = 0;
        // after a language switch, the undo history comes back too (I18N.onSwitch above)
        let swUi = null;
        try { const k = lsk('cmw-switch'), st = JSON.parse(sessionStorage.getItem(k) || 'null'); sessionStorage.removeItem(k); if (st && st.hist && st.hist[st.hi] && Date.now() - st.at < 30000) { hist = st.hist; hi = st.hi; hist[hi] = snap(); swUi = st.ui || null; } } catch (e) { /* no stash */ }
        // a switch whose undo stash could not be written (review eng-8): say so once, after the reload
        try { const k = lsk('cmw-switch-lost'), at = Number(localStorage.getItem(k)); if (localStorage.getItem(k) != null) localStorage.removeItem(k); if (at && Date.now() - at < 30000) setTimeout(() => toast($t('The undo history could not be kept across the language change.')), 0); } catch (e) { /* no note */ }
        updateUndo();
        // (showing a step alone selects it; a saved selection of another step, or of F, stays: the language switch
        // keeps the selection, review russian-6 and verify-8)
        const sel0 = S.sel;
        setFocus(Math.min(S.focus || 0, S.steps.length));
        if (sel0 !== S.sel && (sel0 === 'F' || (Number.isInteger(sel0) && sel0 >= 0 && sel0 <= S.steps.length))) { S.sel = sel0; syncSel(); requestRender('P'); save(); }
        // an old save's Morph view opens with the deformation on (merged-views.md migration)
        if (S.deform) { delete S.deform; openTransport(); }
        // a link's or a scene's camera and deformation time (figureState, review math-10)
        if (S.figCam) {
          const c = S.figCam;
          if (c && [c.yaw, c.pitch, c.d].every(Number.isFinite) && c.d > 0) { cam.yaw = c.yaw; cam.pitch = Math.max(-89 * DEG, Math.min(89 * DEG, c.pitch)); cam.dist = c.d * CAM3.dist; cam.tx = Number.isFinite(c.tx) ? c.tx : 0; cam.ty = Number.isFinite(c.ty) ? c.ty : 0; }
          delete S.figCam;
        }
        if ('figMorph' in S) {
          const fm = S.figMorph;
          delete S.figMorph;
          if (fm && Number.isFinite(fm.T) && !morph.open) { openTransport(); if (morph.open) { morph.T = Math.max(0, Math.min(morphLen(), fm.T)); morph.seg = null; morph.u = 0; morph.playing = false; setPlayIcon(); syncTransport(); } }
        }
        if (swUi) {
          if (swUi.sel && findShape(swUi.sel)) { selected = swUi.sel; buildShapeList(); }
          if (swUi.lamp) openLamp = swUi.lamp;
          if (swUi.phone && typeof swUi.phone === 'object') swPhone = swUi.phone;   // (review russian-6: the open sheet; v15.1: the large plane)
          if (swUi.morph && !morph.open) { openTransport(); morph.T = swUi.morph.T; morph.seg = null; morph.u = 0; morph.playing = false; setPlayIcon(); syncTransport(); }
          // focus returns to the control that switched (review eng-5): Settings, or the phone's More button
          if (swUi.focus) setTimeout(() => { const vis = (el) => el && el.getClientRects().length > 0; const lb = $('settingsBtn'), mb = $('hdrMoreBtn'); const f = vis(lb) ? lb : vis(mb) ? mb : null; if (f && document.activeElement === document.body) f.focus({ preventScroll: true }); }, 0);
        }
        // the right plane reopens at the view the user left it at
        if (loaded.rightView && autoFit()) { Object.assign(V.right, loaded.rightView); rightAuto = false; requestRender('R'); }
        if (loadDropped) toast($tn('{n} saved item could not be restored by this version and was left out.', '{n} saved items could not be restored by this version and were left out.', loadDropped));
      } catch (err) {
        // never a dead app on every reload: fall back to the first example
        console.warn('The saved session could not be restored', err);
        S = Object.assign(blankState(), { hideLeft: S.hideLeft, hideRight: S.hideRight });
        selected = null; draft = null;
        dropAllGPU();
        loadExample(firstExample());
        buildDisplay(); applyLayout();
        hist = [snap()]; hi = 0; updateUndo();
        toast($t('The saved session could not be restored, so the first example was loaded.'));
      }
    } else {
      loadExample(firstExample());
      hist = [snap()]; hi = 0; updateUndo();
    }
    try { const k = lsk('cmw-probe'); localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { warnStorage(); }
    if (window.MathJax && MathJax.tex2svg && MathJax.startup && MathJax.startup.promise) MathJax.startup.promise.then(() => TeX.onReady());
    // fonts may arrive late; redraw labels
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitRightTitle(); requestRender('L', 'R', 'T'); });
    // v15: the phone layout (src/phone.js; notes/ui-redesign-2/build/phone.md)
    // (review russian-12: the left rail's vertical label is short, so it fits the rail at 1024 in Russian)
    { const rl = document.querySelector('#leftRail .rail-label'); if (rl) rl.textContent = $tx('rail', 'Region tools'); }
    Phone.init({
      icons: ICONS, modeIcons: MODE_ICONS, morphOn: () => morphOn(),
      showPanels: (ph) => { if (ph) { S.hideLeft = false; S.hideRight = false; } else { S.hideLeft = dockPref.L; S.hideRight = dockPref.R; } applyLayout(); requestRender('P'); },
      resize: () => { onPaneResize(); requestRender('L', 'R', 'OL', 'OR', 'T'); },
      // (v15.1, build/phone-swap.md: a plane's own view, the one it draws (X's leftView(), Y's V.right), its pane's
      // width, and whether the app fits it itself (Y's auto fit, X's at a focused step); setView writes that view)
      // (land: a running tween on that view ends at its target first, review-phone-swap swap-8)
      getView: (side, land) => {
        const v = side === 'L' ? leftView() : V.right, p = side === 'L' ? paneL : paneR;
        if (land) for (let i = tweens.length - 1; i >= 0; i--) { const tw = tweens[i]; if (tw.view === v) { Object.assign(v, tw.to); tweens.splice(i, 1); if (tw.onDone) tw.onDone(); } }
        return { cx: v.cx, cy: v.cy, s: v.s, w: p.w, h: p.h, auto: side === 'L' ? leftStage() > 0 && leftAuto : rightAuto };
      },
      setView: (side, v) => {
        const t = side === 'L' ? leftView() : V.right;
        for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].view === t) tweens.splice(i, 1);
        t.cx = v.cx; t.cy = v.cy; t.s = v.s;
        if (side === 'L') { if (leftStage() > 0) leftAuto = false; sourceViewChanged(); } else rightAuto = false;
        requestRender('L', 'R', 'OL', 'OR');
      },
      fit: (side) => $(side === 'L' ? 'leftFit' : 'rightFit').click(),
      footKids: (side) => foot[side].kids.slice(Math.max(0, foot[side].n)),
      xyView: () => S.view.main === 'xy',   // ([v17 D5] the regions' display is the X → Y view's)
      renderInspector: () => renderProps(),
      openMenu: (a, items) => openMenu(a, items), closePops: () => closePalette(),
      theme: () => curTheme, setTheme: (t) => { curTheme = t; setTheme(t); sndToggleCue(t !== 'light'); },
      langPref: () => I18N.readPref(), setLang: (v) => pickLang(v),
      palName: () => PAL_NAMES()[GLR.palette()][0], palIcon: () => `<span class="pcol-ic" style="--wheel:${keyConic()}"></span>`, palMenu: (a, done) => openMenu(a, palItems(done)),
      globeIcon: ICONS.globe,
      soundIcon: () => (($('soundBtn') || {}).querySelector && $('soundBtn').querySelector('.snd-ic') || {}).innerHTML || '',
      sound: (k) => (k === 'state' ? { has: !!SND, on: !!(SND && SND.prefs().on) } : null),
      exportFigure: () => Figure.open(),
      copyLatex: () => { copyText(latexDocument()); toast($t('LaTeX copied: the map, its natural domain and its guarantees.')); sndExportDone(); },
      openGuide: () => openGuide(),
      exportItems: () => exportMenuItems(true),   // (v16.5 V02)
      // v16.5 UX12: the top layer a phone's Back closes, as the function that closes it (null: nothing is open). Top
      // first: the coordinate pad, the popover (the palette, a menu, a plane's menu, the integral, the options), the
      // tour's chapter menu, the sound settings, a dialog (Export, the guide), a popover of the top layer, the sheet
      backLayer: () => {
        if (padEl) return () => closePad();
        if (popEl) return () => closePalette();
        const tm = document.querySelector('#popHost > .tour-menu');
        if (tm) return () => { if (Tour.closeHelpMenu) Tour.closeHelpMenu(); else tm.remove(); };
        const sp = $('sndPop');
        if (sp && !sp.hidden) return () => { sp.hidden = true; const m = $('soundMore'); if (m) m.setAttribute('aria-expanded', 'false'); };
        const bgs = document.querySelectorAll('.modal-bg');
        if (bgs.length) { const bg = bgs[bgs.length - 1]; return () => bg.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
        let po = null;
        try { po = [...document.querySelectorAll(':popover-open')].find((e) => !e.closest('[data-tour]') && !e.classList.contains('tour-top')); } catch (e) { po = null; }
        if (po) return () => { try { po.hidePopover(); } catch (e) { /* */ } };
        if (Phone.sheet && Phone.sheet()) return () => Phone.close();
        const tmo = $('toolMore');
        if (tmo && tmo.open) return () => { tmo.open = false; };
        return null;
      },
    });
    // (review russian-6: a language switch on a phone reopens the sheet that was open, More where the switch is)
    // (v15.1: and the plane that was large stays large, so each plane's saved view is drawn at the size it was saved at;
    // build/phone-swap.md)
    if (swPhone && Phone.isOn()) { const sp = swPhone; swPhone = null; if (Phone.setBig && (sp.big === 'L' || sp.big === 'R')) Phone.setBig(sp.big); if (typeof sp.k === 'string') setTimeout(() => Phone.open(sp.k, sp.nums ? { params: true } : {}), 0); }
    tourWire();
  }
  // TEMP-DEBUG-HOOK (removed before publishing)
  // the tour's adapter, and a tap on every call the tour makes into it (test/tour_cmd.js)
  window.__tourApi = tourApi;
  window.__tourTap = (() => {
    const taps = [];
    for (const k of Object.keys(tourApi)) {
      const f = tourApi[k];
      if (typeof f !== 'function' || /^(storageKey|anchor|has|tex|on|busy|hasWork)$/.test(k)) continue;
      tourApi[k] = function (...a) { for (const t of taps) { try { t('call', k, a); } catch (e) { /* a test's tap */ } } return f.apply(this, a); };
    }
    return (f) => taps.push(f);
  })();
  // the zeros and poles of the step acting on X: handles in page coordinates, the selection, the step's parameters
  window.__cmwZp = () => { const r = paneL.ocanvas.getBoundingClientRect(), zs = zpStep(); return { k: zs ? zs.k : 0, sel: zpSel, params: zs ? Object.assign({}, zs.st.params) : null, handles: zpHandlesL.map((q) => ({ kind: q.kind, i: q.i, x: r.left + q.x, y: r.top + q.y })), pane: { left: r.left, top: r.top, w: paneL.w, h: paneL.h }, glKey: (() => { try { return String(GLChain.build(S.steps, built).key).length + ':' + String(GLChain.build(S.steps, built).key).slice(-80); } catch (e) { return null; } })() }; };
  window.__cmwTime = (n = 5) => {
    const t = (f, pane) => { f(); pane.ctx.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < n; i++) { f(); pane.ctx.getImageData(0, 0, 1, 1); } return +((performance.now() - t0) / n).toFixed(2); };
    // (a merged view shows one pane: the hidden one is not timed)
    const one = solo();
    return { left: one === 'R' ? null : t(renderLeft, paneL), right: one === 'L' ? null : t(renderRight, paneR), overlay: t(() => renderOverlays(), paneL), mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), meshN: S.meshN };
  };
  window.__cmwInfo = () => [...gpu.entries()].map(([id, r]) => ({ id, tris: r.meshRes && r.meshRes.n, segs: r.lineRes && r.lineRes.n, fixR: r.fix.R && r.fix.R.extraRes && r.fix.R.extraRes.n, fixL: r.fix.L && r.fix.L.extraRes && r.fix.L.extraRes.n, hold: !!r.hold, live: !!r.live, liveStat: r.liveStat, pool: r.lpool ? r.lpool.size : 0, base: r.meshKey ? +String(r.meshKey).split('|')[1] : null, buildMs: r.buildMs }));
  // per area shape and role: is a hold drawn, and do its strokes belong to another geometry than its fill (U-a review)
  window.__cmwHoldCheck = () => S.shapes.filter((s) => kindType(s) === 'area' && gpu.get(s.id)).flatMap((s) => ['L', 'R'].map((role) => {
    const r = gpu.get(s.id), pm = pairFor(s, r, role).p, L = linesOf(r, pm);
    const held = pm !== r;
    return { id: s.id, role, held, mismatch: held && pm.skey !== r.skey && L === r };
  }));
  window.__cmwSet = (k, v) => {
    // the view fields of earlier builds (the suites set rightMode in many scenes): applied through the migration table,
    // on top of the old fields that name the current view (panels.md 10)
    if (Views.LEGACY.includes(k)) {
      const o = Object.assign(Views.toLegacy(S.view, S.dc, S.landPlain), { [k]: v, dc: S.dc });
      Views.migrate(o);
      S.view = o.view; S.dc = o.dc; S.landPlain = !!o.landPlain;
      applyLayout(); viewChanged('L'); viewChanged('R');
      return;
    }
    if (k === 'view') { S.view = Views.clean(v); applyLayout(); viewChanged('L'); viewChanged('R'); return; }
    S[k] = v; if (k === 'meshN') { dropAllGPU(); } if (k === 'exactImages') scheduleFix(); requestRender('L', 'R', 'T');
  };
  // U-b: the panes' views; setView(side, surf) and setPhase(on) as the controls and keys call them
  window.__cmwView = () => Views.clean(S.view);
  // (U-b's calls: X's surface 'land' is the Landscape view now; Plane or Sphere on X from the Landscape opens X → Y)
  window.__cmwSetView = (side, surf) => { if (side === 'L' && surf === 'land') return setMain('land'); if (side === 'L' && lLand()) setMain('xy'); return setView(side, surf); };
  window.__cmwSetPhase = (on) => setPhase(on);
  // merged views (merged-views.md): the top bar's view ('xy' | 'phase' | 'land') and the layout the panes are in
  window.__cmwSetMain = (m) => setMain(m);
  window.__cmwLayout = () => { const mg = Views.merged(S.view, morphOn()), one = solo(); return { main: S.view.main, deform: !!morph.open, merged: mg, shown: one ? [one] : ['L', 'R'], wL: paneL.w, wR: paneR.w }; };
  // which pane ('L' | 'R') shows the picture an earlier build's rightMode named (the perf suite drags that pane)
  window.__cmwPaneOf = (mode, sphereMode) => Views.paneOf(mode, sphereMode);
  // the old layout's other pane for that picture (the shapes plane beside an old Phase or Landscape view): null when
  // the view is one merged panel here (the perf suite then measures X's plane in X → Y, the same picture)
  window.__cmwOtherPane = (mode, sphereMode) => (Views.merged(S.view, morphOn()) ? null : Views.paneOf(mode, sphereMode) === 'L' ? 'R' : 'L');
  // exact images (SPEC 10.1): the path of every visible area shape in every visible view: [{id, role, viewKind, path, reason}]
  window.__cmwSphere = () => ({ entries: [...sm.entries.values()].map((e) => ({ key: e.key, slot: e.slot, why: e.why, view: e.view, guardBox: e.guardBox, gpu: !!(e.res && e.res.n), ...e.info })), jobs: [...sm.jobs.values()].map((j) => ({ key: j.key, slot: j.slot, why: j.why, ms: +j.ms.toFixed(1), slices: j.slices, nodes: j.mesh ? j.mesh.nodes : 0 })), want: [...sm.want.entries()], running: sm.running, stats: Object.assign({}, sm.stats), cpuBytes: sm.cpuBytes, preBytes: GLR.preBytes, lastExport: sm.lastExport || null });
  // the SphereMesh verdict (SPEC 8.1) of every visible area shape for the right pane's map (12.3: invariant under right-view zooms)
  window.__cmwSmVerdict = (role = 'R') => S.shapes.filter((s) => s.visible !== false && kindType(s) === 'area').map((s) => ({ id: s.id, why: smNeed(s, gpu.get(s.id), role, normalizeMap(stageMap(role === 'R' ? rightStage() : leftStage()))) }));
  window.__cmwSmReset = () => { for (const e of [...sm.entries.values()]) smDrop(e); for (const j of [...sm.jobs.values()]) smCancel(j); sm.want.clear(); Object.assign(sm.stats, { built: 0, ms: 0, slices: 0, maxSlice: 0, cancelled: 0, partial: 0 }); requestRender('L', 'R'); return true; };
  window.__cmwPaths = () => {
    const views = [];
    if (solo() !== 'L') {
      if (rImage()) views.push(['R', 'flat', trans.k ? transState().map : morphOn() ? morphState(false).map : stageMap(rightStage())]);
      else { const hv = homView(); views.push(['R', 'globe', hv ? (hv.imageMap || hv.map) : stageMap(rightStage())]); }
    }
    // (X draws the shapes' areas in its plane and on its globe; the portrait, the phase globe and the landscape outline them)
    if (solo() !== 'R' && (lPlain() || (lGlobe() && !lPhase()))) views.push(['L', lGlobe() ? 'globe' : 'flat', stageMap(leftStage())]);
    const out = [];
    for (const [role, viewKind, map] of views) for (const s of S.shapes) {
      if (s.visible === false || kindType(s) !== 'area') continue;
      const p = pathOf(s, map, role, viewKind, { status: true });
      out.push({ id: s.id, role, viewKind, path: p.path, reason: p.reason || null });
    }
    return out;
  };
  // shape ids that draw forward whatever their eligibility (mixed-path tests); [] clears
  window.__cmwHideStrokes = (on) => { hideStrokes = !!on; requestRender('L', 'R'); return hideStrokes; };
  window.__cmwForceForward = (ids) => { forceFwd.clear(); for (const id of ids || []) forceFwd.add(id); scheduleFix(); requestRender('L', 'R', 'T'); return [...forceFwd]; };
  // the plane point w under a Sphere-view pixel (CSS px of the right pane), null off the globe
  window.__cmwSphereW = (x, y) => { const w = pickSphere(paneR, camS, x, y); return w ? [w.re, w.im] : null; };
  // the level predictLevel would give the right pane's passes (13.14's estimate; no longer a floor) and its estimate
  window.__cmwPredict = () => { const list = S.shapes.filter((x) => x.visible !== false); return predictLevel(list, stageMap(rightStage()), 'R', paneR, lastRecs); };
  // per shape: the line key, whether the settle-time refinement is in (SPEC 9.1), segments and pieces drawn
  window.__cmwLines = () => [...gpu.entries()].map(([id, r]) => ({ id, refined: !!r.refKey && r.refKey.startsWith(r.lineKey + '|'), segs: r.lineRes ? r.lineRes.n : 0, pieces: r.lpolys ? r.lpolys.length : 0, refMs: r.refMs, running: !!lineJob.running }));
  // the cost guard per pane, the timer and the display interval estimate
  window.__cmwGuard = () => ({ R: guard ? guard.state('R') : null, L: guard ? guard.state('L') : null, timer: !!(GLR.timer && GLR.timer.available), inverseDraws: GLR.inverseDraws, log: guardLog.slice() });
  // a fresh cost guard with policy options (GLR.CostGuard opts, e.g. {budget: 1e9}: measure only), for measurements
  window.__cmwGuardOpts = (o) => { if (!GLR.CostGuard) return null; guard = GLR.CostGuard(Object.assign({}, GUARD_OPTS, o || {})); for (const g of Object.values(paneG)) { g.key = ''; g.reads = []; g.demoted = false; } guardLog.length = 0; requestRender('L', 'R'); return guard.state('R'); };
  // the look drawScene gives shape id (colours as hex), the pattern cell, the right view, clipWin and the plane colour
  window.__cmwLook = (id, side = 'R') => { const s = S.shapes.find((x) => x.id === id); if (!s) return null; const k = shapeInk(s); const L = side === 'L'; return { color: k.c0, color2: k.alt, edge: k.edge, ink: TH.ink, alpha: S.alpha, pattern: S.pattern, cell: patternCell(), lines: S.lines, sphN: sphN(), plane: TH.plane, view: Object.assign({}, L ? leftView() : V.right), win: Object.assign({}, clipWin), dpr: (L ? paneL : paneR).dpr, W: (L ? paneL : paneR).pw, H: (L ? paneL : paneR).ph, stage: L ? leftStage() : rightStage() }; };
  // P3: the z-globe's point under a pane pixel (as __cmwSphereW for the w-globe), and a globe's camera set directly
  // P3b: the shapes and targets as stored; the CSS pixel of the plane point (x, y) on a side's globe (null behind it)
  window.__cmwShapes = () => JSON.parse(JSON.stringify({ shapes: S.shapes, targets: S.targets, selected }, noRuntime));
  window.__cmwGlobeXY = (side, x, y) => { const gc = globeCam(side); if (!gc) return null; const P = Number.isFinite(x) ? Region.Globe.lift(x, y) : [0, 0, 1]; return gScreen(gc, P); };
  window.__cmwGlobeSnap = (side, x, y, role) => { const gc = globeCam(side), g = pickGlobe(side === 'L' ? paneL : paneR, camOf(side), x, y); const r = g && gc ? globeSnap(gc, side, g, role) : null; gSnapMark = null; return r ? { z: r.z && [r.z.re, r.z.im], snapped: !!r.snapped, g: g.z && [g.z.re, g.z.im], R: gc.R } : null; };
  window.__cmwSelect = (id) => { selected = id; if (id) zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL', 'OR'); };
  window.__cmwGlobeHandles = (side) => { const gc = globeCam(side); const s = (side === 'R' ? S.targets : S.shapes).find((x) => x.id === selected); return s && gc ? globeHandles(s, gc).map(([k, P]) => [k, gScreen(gc, P)]) : []; };
  window.__cmwSphereWL = (x, y) => { const w = pickSphere(paneL, camOf('L'), x, y); return w ? [w.re, w.im] : null; };
  window.__cmwCam = (side, o) => { const c = camOf(side); if (o) { Object.assign(c, o, { vyaw: 0, vpitch: 0 }); requestRender(side); } return { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx || 0, ty: c.ty || 0, tz: c.tz || 0, fov: c.fov }; };
  // what the live panes last drew each shape with: {'R|s1': 'inverse' | 'pending' | 'forward', ...}
  window.__cmwDrawn = () => Object.fromEntries(lastPath);
  // the scissor w-box of shape id's image under the right plane's map (SPEC 4.8; null: no scissor)
  window.__cmwInvBox = (id) => {
    const s = S.shapes.find((x) => x.id === id);
    if (!s) return null;
    const p = pathOf(s, stageMap(rightStage()), 'R', 'flat');
    return p.e ? invBox(p.e, p.plan, s) : null;
  };
  window.__cmwExample = (i) => loadExample(i);
  // v15 (test/v15_desktop_cmd.js): the cards' kind and pictures (each card's view, size and whether it is final), the
  // selection, the temporary Inspector; __cmwCardsNow() draws the cards at once (no wait for a quiet moment)
  window.__cmwCards = () => ({ kind: cardKind(), sel: selOf(), focus: S.focus, temp: tempInsp, cards: [...thumbs].map(([k, p]) => { const c = p.canvas.closest('.card'); return { k, sig: p.sig || null, view: Object.assign({}, p.view), w: p.w, h: p.h, dpr: p.dpr, stale: !!(c && c.classList.contains('stale')), t: kindOfT(k) }; }), main: { view: Object.assign({}, paneL.view), w: paneL.w, h: paneL.h, dpr: paneL.dpr } });
  const kindOfT = (k) => (cardKind() === 'def' ? cardT(k) : null);
  window.__cmwCardsNow = () => { lastInputT = 0; clearTimeout(thumbT); renderThumbs(); return true; };
  // P3 (SPEC 10.6, 12.4 (h)): the figure export as the dialog runs it (opt: {panels, widthIn, caption, alive}), and one
  // panel drawn off-screen at print size (a PNG data URL)
  window.__cmwBuildFigure = (opt) => buildFigure(Object.assign({ panels: ['L', 'R'], widthIn: 7, caption: false }, opt || {}));
  // item 2 (the deformation picture): open/close and scrub the transport; the screen's path selection
  // (v16 deformation range, SPEC 13.3) kind 'H' (the image side at T), 'H0', 'F' (the chain), 'cpuMap' (a map spec's
  // CPU twin): pts [[x, y]] -> [[re, im]] (null for a non-finite value)
  window.__cmwEval = (kind, specOrT, pts) => {
    const T0 = morph.T;
    let F;
    try {
      if (kind === 'H') { if (specOrT != null) morph.T = specOrT; F = morphState(false).F; }
      else if (kind === 'H0') F = morphState(false).H0F;
      else if (kind === 'F') F = stageF(nSteps());
      else if (kind === 'cpuMap') F = cpuMap(specOrT);
    } finally { morph.T = T0; }
    return F ? pts.map((q) => { const w = F(C(q[0], q[1])); return CX.isFin(w) ? [w.re, w.im] : null; }) : null;
  };
  window.__cmwRange = () => ({ stored: S.homRange ? JSON.parse(JSON.stringify(S.homRange)) : null, ok: homRangeOk(), stops: HR.stops(S), start: rangeStart('text'), parts: rangeParts(), cards: [...document.querySelectorAll('#pipeline .card[data-k]')].map((c) => [+c.dataset.k, cardT(+c.dataset.k)]) });
  window.__cmwMorph = (o) => { if (o && 'range' in o) setHomRange(o.range, { preview: !!o.preview }); if (o && o.open != null) { if (o.open) openTransport(); else closeTransport(); } if (o && o.T != null) { morph.T = o.T; morph.seg = null; morph.u = 0; morph.playing = false; setPlayIcon(); syncTransport(); scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); } if (o && o.playing != null) { morph.playing = !!o.playing; setPlayIcon(); requestRender('R'); } return { open: morph.open, T: morph.T, playing: morph.playing, on: morphOn() }; };
  window.__cmwMorphSel = async (o) => { if (!morphOn()) return null; const t0 = performance.now(); const sel = await morphSelScreenNow(paneR, !!(o && o.force)); const wall = performance.now() - t0; if (!sel) return null; const end = S.focus > 0 ? S.focus : nSteps(); const base = S.focus > 0 ? S.focus - 1 : 0; return { ms: sel.ms, wall, budget: sel.budget, n: sel.kept.length, nCands: sel.nCands, kept: sel.kept.map((k) => { const w = stageF(end)(k.sp.z), w0 = stageF(base)(k.sp.z), a = k.s[0].w, b = k.s[k.s.length - 1].w; return { z: [k.sp.z.re, k.sp.z.im], kind: k.sp.kind, start: k.l[0], end: k.l[k.l.length - 1], path: k.l, F: [w.re, w.im], W0: [w0.re, w0.im], Ws: [a.re, a.im], We: [b.re, b.im], meet: !!k.meet }; }), log: sel.log.map(([c, why]) => [c.sp.z.re, c.sp.z.im, c.sp.kind, why]) }; };
  // paths-aesthetics (test/deform_nat_cmd.js): the screen's kept paths measured in its px. seg: the longest drawn
  // segment; jump: the largest distance of H at a segment's mid time from the segment's midpoint (segments over 3 px:
  // a jump across a cut would be about half the segment); ang: the largest angle between drawn segments over 0.3 px,
  // turn: that angle over the mean length of its two segments (rad/px; p99 and max), kink: the largest angle between
  // two segments both over 1.5 px (the trace refines a turn into short chords: a kink is a corner it left); sep: per
  // path, the share of its 3 px samples (away from the paths' ends, the transport and the legend) within 0.7 dTest of
  // another path, in the px it was chosen in (the worst path); heads: the last frame's moving points vs H_T(z) (px)
  window.__cmwPathsCheck = () => {
    const sel = mfCache.rsel && mfCache.rkey === mfScreenKey(paneR).key ? mfCache.rsel : mfCache.sel;
    if (!sel) return null;
    const P = (w) => paneR.w2s(w);
    const Fc = new Map(), Fat = (T) => { let f = Fc.get(T); if (!f) { f = morphAt(T); Fc.set(T, f); } return f; };
    let seg = 0, jump = 0, ang = 0, kink = 0, nSeg = 0, kinkStep = 0;
    const turns = [], polys = [], nodeT = pathMarkTimes(sel.Tend || morphLen()).nodes;
    const g = SegGrid(6);
    for (const k of sel.kept) {
      const ls = [];
      for (const r of k.runs) {
        const l = r.map((q) => P(q.w));
        ls.push(r.map((q) => q.p));
        for (let i = 1; i < r.length; i++) g.add(r[i - 1].p, r[i].p, k);
        for (let i = 1; i < l.length; i++) {
          const a = l[i - 1], b = l[i], L = mDist(a, b);
          nSeg++; seg = Math.max(seg, L);
          if (L > 3) { const m = P(Fat(0.5 * (r[i - 1].T + r[i].T))(k.sp.z)); jump = Math.max(jump, mDist(m, [0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1])])); }
          if (i >= 2) {
            const o = l[i - 2], L0 = mDist(o, a);
            // (a step's end, one after another, is a corner of H itself: it is marked with a bar and counted apart)
            const atNode = nodeT.some((t) => Math.abs(r[i - 1].T - t) < 1e-9);
            if (L0 > 0.3 && L > 0.3) { const q = Math.acos(Math.max(-1, Math.min(1, ((a[0] - o[0]) * (b[0] - a[0]) + (a[1] - o[1]) * (b[1] - a[1])) / (L0 * L)))); if (atNode) { kinkStep = Math.max(kinkStep, q); continue; } ang = Math.max(ang, q); turns.push(q / (0.5 * (L0 + L))); if (L0 >= 1.5 && L >= 1.5) kink = Math.max(kink, q); }
          }
        }
      }
      polys.push({ k, ls });
    }
    const ex = 0.75 * PATHS.sep, d = 0.7 * PATHS.dTest, nogo = mfNogo(paneR);
    let sep = 0;
    // (only a path's own start and end are exempt, within ex: the review's measure; another path's end is not.
    // sepLong: the share within 2 dTest, for paths longer than longK dS)
    let sepLong = 0;
    for (const { k, ls } of polys) {
      if (!ls.length) continue;
      const lr = ls[ls.length - 1], ends = [ls[0][0], lr[lr.length - 1]];
      let n = 0, near = 0, far = 0;
      for (const l of ls) for (const p of resamplePx(l, 3)) {
        if (p[0] < 0 || p[1] < 0 || p[0] > paneR.w || p[1] > paneR.h - 8 || nogo.some((R) => p[0] >= R.x0 && p[0] <= R.x1 && p[1] >= R.y0 && p[1] <= R.y1) || ends.some((q) => mDist(p, q) < ex)) continue;
        n++; if (g.near(p, d, k) < d) near++; if (g.near(p, PATHS.longD * PATHS.dTest, k) < PATHS.longD * PATHS.dTest) far++;
      }
      if (n) sep = Math.max(sep, near / n);
      if (n && (k.lenPx || 0) > PATHS.longK * PATHS.dS) sepLong = Math.max(sepLong, far / n);
    }
    // the review's other measures: the shortest path, the largest retrace share, an end dot's or a ring's nearest
    // other line, a ring's nearest other end, the turn at a step's end
    // (ownLine: a ring's or an end dot's distance from its own path's line beyond its first / before its last dS)
    let minLen = Infinity, retr = 0, endLine = Infinity, ringLine = Infinity, ringEnd = Infinity, ownLine = Infinity;
    for (const { k, ls } of polys) {
      if (!ls.length) continue;
      minLen = Math.min(minLen, k.lenPx || 0);
      {
        const q0 = ls[0][0], lq = ls[ls.length - 1], qe = k.runs[k.runs.length - 1].slice(-1)[0].T >= sel.Tend - 1e-9 ? lq[lq.length - 1] : null;
        let L = 0, acc = 0;
        for (const l of ls) for (let i = 1; i < l.length; i++) L += mDist(l[i], l[i - 1]);
        for (const l of ls) for (let i = 1; i < l.length; i++) { const a0 = acc; acc += mDist(l[i], l[i - 1]); if (a0 > PATHS.dS) ownLine = Math.min(ownLine, segD(q0, l[i - 1], l[i])); if (qe && acc < L - PATHS.dS) ownLine = Math.min(ownLine, segD(qe, l[i - 1], l[i])); }
      }
      retr = Math.max(retr, retraceShare(ls.flatMap((l) => resamplePx(l, 3)), 2, 6));
      const lr = ls[ls.length - 1], s0 = ls[0][0], e0 = k.runs[k.runs.length - 1].slice(-1)[0].T >= sel.Tend - 1e-9 ? lr[lr.length - 1] : null;
      for (const o of polys) {
        if (o.k === k || !o.ls.length) continue;
        for (const l of o.ls) for (let i = 1; i < l.length; i++) { if (e0) endLine = Math.min(endLine, segD(e0, l[i - 1], l[i])); ringLine = Math.min(ringLine, segD(s0, l[i - 1], l[i])); }
        const ol = o.ls[o.ls.length - 1];
        ringEnd = Math.min(ringEnd, mDist(s0, ol[ol.length - 1]));
      }
    }
    turns.sort((a, b) => a - b);
    let heads = 0;
    if (mfDrawn) for (const h of mfDrawn.heads) { const q = P(Fat(mfDrawn.T)(C(h[2], h[3]))); heads = Math.max(heads, mDist(q, h)); }
    return { ownLine, arrowMin: sel.arrowMin, kinkStep, minLen, retrace: retr, endLine, ringLine, ringEnd, sepLong, ink: sel.ink, cap: sel.budget, n: sel.kept.length, nSeg, seg, jump, ang, kink, turnP99: turns.length ? turns[Math.floor(0.99 * (turns.length - 1))] : 0, turnMax: turns.length ? turns[turns.length - 1] : 0, sep, heads, nHeads: mfDrawn ? mfDrawn.heads.length : 0, T: mfDrawn ? mfDrawn.T : null, kinds: sel.kept.reduce((a, q) => { a[q.sp.kind] = (a[q.sp.kind] || 0) + 1; return a; }, {}) };
  };
  window.__cmwMorphCache = () => ({ ready: !!(mfCache.sel && mfCache.key === mfScreenKey(paneR).key && (mfCache.vkey === mfScreenKey(paneR).vkey || mfViewOk(paneR))), job: !!mfCache.job, zs: mfCache.sel ? mfCache.sel.kept.map((k) => [k.sp.z.re, k.sp.z.im]) : null, rej: mfCache.sel ? mfCache.sel.rej : null, away: mfCache.sel ? mfCache.sel.away : null, hint: mfGlobeAway(), prev: mfCache.prev ? mfCache.prev.sel.kept.length : 0 });
  window.__cmwLastFigure = () => Figure.last();
  window.__cmwFigPathsSel = () => (mfFigCache.sel ? { n: mfFigCache.sel.kept.length, nCands: mfFigCache.sel.nCands, cap: mfFigCache.sel.budget, rej: mfFigCache.sel.rej } : null);
  window.__cmwFig = Figure;
  window.__cmwPrepareExport = (panels, alive) => prepareExport(panels || ['L', 'R'], alive);
  window.__cmwRenderOff = (side, w, h, dpr) => renderOff(side, w, h, dpr).toDataURL('image/png');
  // client coordinates of plane point (re, im) in the left ('L') or right ('R') plane, as last drawn
  // v16.5 wave 1 plane (test/ux165_plane_cmd.js): the open draft, the handle size in use
  window.__cmwDraft = () => (draft ? { kind: draft.kind, pts: (draft.pts || []).map((p) => p.slice()) } : null);
  window.__cmwHandles = () => ({ size: fingerNow() ? 12 : 7, touch: ptrTouch });
  window.__cmwW2S = (side, re, im) => { const p = side === 'L' ? paneL : paneR; const r = p.ocanvas.getBoundingClientRect(); const v = p.view; return [r.left + p.w / 2 + (re - v.cx) * v.s, r.top + p.h / 2 - (im - v.cy) * v.s]; };
  // sound (notes/sound): the app side of the engine, for test/sound_cmd.js
  window.__cmwSound = (o) => { if (o && o.zp) { zpSet(o.zp[0], o.zp[1], o.zp[2], C(o.zp[3], o.zp[4])); return 1; } if (o && o.hAt) { const F = sndFAt(o.hAt[0]), w = F(C(o.hAt[1], o.hAt[2])); return [w.re, w.im]; } if (o && o.pick) { const r = paneL.ocanvas.getBoundingClientRect(), z = lLand() ? pickLand(o.pick[0] - r.left, o.pick[1] - r.top) : null; return z ? [z.re, z.im] : null; } if (o && o.perEval) snd.perEval = o.perEval; if (o && o.pathT) { const [T0, T1] = o.pathT; morph.T = T1; snd.T = T1; requestRender('R'); soundFunctionChanged({ at: (u) => sndFAt(T0 + u * (T1 - T0)) }); return 1; } if (o && o.listen) sndListen(o.listen, o.closed !== false); if (o && o.loop) sndLoopDone(o.loop); if (o && o.lastLoop) snd.lastLoop = { pts: o.lastLoop, closed: true }; return { harp: SND ? SND.harpState() : null, sing: SND ? SND.singState() : null, cv: { on: snd.cv.on, W: snd.cv.W, T: snd.cv.T }, sang: snd.sang, listenHarp: snd.play && snd.play.h.harp ? { up: snd.play.h.harp.up, down: snd.play.h.harp.down, notes: snd.play.h.harp.notes, dur: snd.play.dur, piece: !!snd.play.piece } : null, voice: !!snd.voice, kind: snd.kind, engine: snd.voice ? snd.voice.engine : '', phi: snd.phi, near: snd.near, gestT: snd.gestT, loop: snd.loop ? { phi: snd.loop.phi, k: snd.loop.k } : null, lastLoop: !!snd.lastLoop, play: !!snd.play, auto: snd.auto, morphArm: snd.morphArm, kz: snd.kz, kbd: snd.kbd, kloop: snd.kloop ? snd.kloop.length : 0, perEval: snd.perEval, tracker: snd.tracker, live: ($('sndLive') || {}).textContent || '', run: snd.run ? { phi: snd.run.phi, k: snd.run.k, jumps: snd.run.jumps } : null, rest: snd.rest ? { z: [snd.rest.z.re, snd.rest.z.im], src: snd.rest.src } : null, T: snd.T, fcN: snd.fcN, fcGen: snd.fcGen,  g: snd.g ? [snd.g.re, snd.g.im] : null }; };
  // v16 constructions (CORE): the graph's order, the forms, the last recompute, the events; o.call runs a cm call,
  // o.state(...) replaces S's shapes / targets / steps through the load path (sanitizeState), o.anchor sets the GPU anchor
  window.__cmwC = (o) => {
    if (o && o.call) { const a = cmApi(); const r = a[o.call](...(o.args || [])); return r === undefined ? null : JSON.parse(JSON.stringify(r, noRuntime)); }
    if (o && o.anchor) { GLR.setFormAnchor(o.anchor); requestRender('L', 'R'); return 1; }
    const g = Constr.graph(S), all = S.shapes.concat(S.targets);
    const last = cmSync.last ? { ids: cmSync.last.ids, kindChanged: cmSync.last.kindChanged, undefChanged: cmSync.last.undefChanged } : null;
    return { order: g.order, cyclic: g.cyclic, last, forms: Object.fromEntries(all.filter((s) => s._g).map((s) => [s.id, s._g])), atInf: all.filter((s) => s._atInf).map((s) => s.id), events: Construct.events.map((e) => e.type), freed: cmLoad.freed || 0, steps: S.steps.map((st) => ({ uid: st.uid, zpIds: st.zpIds || null })), stats: Constr.lastRecompute };
  };
  // v16 constructions (INTERFACE): the ring, the draft, the session's Curve | Region; o.fill sets it
  window.__cmwCI = (o) => { if (o && o.gs) { const [side, P] = o.gs, gc = globeCam(side), q = gc && gScreen(gc, P), r = (side === 'R' ? paneR : paneL).ocanvas.getBoundingClientRect(); return q ? [r.left + q[0], r.top + q[1]] : null; } if (o && o.fill) Construct.fill = o.fill; if (o && o.snap) { const [side, x, y, opt] = o.snap; const t = Construct.snapAt(side, x, y, opt || {}); return t ? { cls: t.cls, z: t.z, ref: t.ref } : null; } if (o && o.names) return S.shapes.concat(S.targets).map((s) => ({ id: s.id, kind: s.kind, name: Construct.shapeLabel(s), def: Construct.defText(s), why: s.cundef ? Construct.reasonText(s.cundef) : null })); if (o && o.shapes) return { hi, n: hist.length, tool, selected, zeros: S.steps[0] ? S.steps[0].params.zeros : null, list: S.shapes.concat(S.targets).map((s) => Object.assign(JSON.parse(JSON.stringify(s, noRuntime)), { inf: !!s._atInf, A: s._g ? s._g.A : null })) }; return Construct.debug(); };
  window.__cmwCapText = (panels) => pcTidy(figureCaption(panels || ['L'])).map((x) => (x.t != null ? x.t : x.m != null ? `$${x.m}$` : x.b || '')).join('');
  window.__cmwLandSheets = () => ({ drawn: render3D.sheetsInfo || null, shown: sheetsShown(), deformOk: deformSheetsOk(), linear: !!render3D.linear, title: paneTitles().left });
  window.__cmwCutHandles = () => { const r = paneL.ocanvas.getBoundingClientRect(); return cutHandlesL.map((hd) => ({ step: hd.step, x: r.left + hd.x, y: r.top + hd.y })); };   // (v16.5 test/ux165_chain_cmd.js)
  window.__cmwState = () => ({ mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), dc: S.dc, landPlain: !!S.landPlain, wKey: !!S.wKey, focus: S.focus, morph: { open: morph.open, T: morph.T, playing: morph.playing }, targets: S.targets.length, hov: hov.list ? hov.list.map((r) => [r.z.re, r.z.im, r.mult]) : null, intPop: intPop ? intPop.id : null, sheets: S.sheets, height: S.height, meshN: S.meshN, homView: homView() }); // TEMP-DEBUG-HOOK
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
