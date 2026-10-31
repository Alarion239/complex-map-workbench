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
    /** @type {any} */ (cmSync).last = r;
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
      if (v.freed) { /** @type {any} */ (cmLoad).freed = v.freed; cmEmit('loadFreed', { n: v.freed }); }
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
          if (!s.id) s.id = 's' + takeId();
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
        setShapes(S.shapes.filter((s) => !del.has(s.id)));
        setTargets(S.targets.filter((s) => !del.has(s.id)));
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
    // ([issue #6] a repeat's N bound to a number: renamed with it; a removed number leaves its value, rounded)
    S.steps.forEach((st, i) => {
      if (!st.repeat || !st.repeat.by) return;
      out.push({ label: `f${sub(i + 1)}`, get: () => st.repeat.by, set: (t) => {
        const ns = Params.namesIn(t), v = Number(t);
        if (ns.length === 1 && String(t).trim() === ns[0]) st.repeat = Object.assign({}, st.repeat, { by: ns[0] });
        else st.repeat = { n: Number.isFinite(v) ? Math.min(Funcs.REPEAT_MAX, Math.max(1, Math.round(v))) : st.repeat.n, len: st.repeat.len };
      } });
    });
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
    for (const [key, , o] of stepTexts(st)) for (const n of Params.namesIn(st.params[key], o)) if (!ns.includes(n)) ns.push(n);
    const num4 = (v) => I18N.num(String(+(+v).toPrecision(4))).replace('-', '−');
    const val = (n) => {
      const c = Params.getC(n);
      if (!c) return '?';
      return c.im ? `${c.re ? num4(c.re) : ''}${c.re ? (c.im < 0 ? ' − ' : ' + ') : c.im < 0 ? '−' : ''}${Math.abs(c.im) === 1 ? '' : num4(Math.abs(c.im))}i` : num4(c.re);
    };
    return ns.length ? $t('Numbers: {list}', { list: ns.map((n) => `${Params.display(n)} = ${val(n)}`).join(', ') }) : '';
  }
  function paramsRestored() { zpParsed.clear(); Params.render(); }
  // a number changed (a slider, play, a field, undo): the steps and the shapes that use it follow; a drag or play
  // frame is motion (motion-quality frames; the renderer's rest pass follows when it stops)
  // ([#241] a slider of a number a costly chain uses (its last change took over 8 ms: a series re-planned) is applied
  // once a frame, at its latest value, the names of the frame's events together; a change at rest applies at once)
  const liveQ = { names: null, raf: 0 };
  function onParamChange(ev) {
    if (ev.live) { const t = performance.now(); lastInputT = t; motionInT = t; }
    if (liveQ.raf) {
      cancelAnimationFrame(liveQ.raf); liveQ.raf = 0;
      const was = liveQ.names; liveQ.names = null;
      ev = Object.assign({}, ev, { names: [...new Set([...was, ...(ev.names || [])])] });
    }
    const big = !!(ev.removed || ev.renamed || ev.inlined);
    if (ev.live && !ev.play && !big && chainCost() > 8 && S.steps.some((st) => stepUses(st, new Set(ev.names || [])))) {
      liveQ.names = ev.names || [];
      liveQ.raf = requestAnimationFrame(() => { const nm = liveQ.names; liveQ.raf = 0; liveQ.names = null; paramChanged({ names: nm, live: true }); });
      return;
    }
    paramChanged(ev);
  }
  function paramChanged(ev) {
    const names = new Set(ev.names || []);
    const big = !!(ev.removed || ev.renamed || ev.inlined);
    zpParsed.clear();
    const steps = big || S.steps.some((st) => stepUses(st, names));
    let sh = false, tg = false;
    for (const x of S.shapes) if (applyBinds(x, big ? null : names)) sh = true;
    for (const x of S.targets) if (applyBinds(x, big ? null : names)) tg = true;
    if (steps) chainChanged(big, { live: ev.live && !ev.play });
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
      binds: chainBinds,
      formulas: paramFormulas,
      commit: () => commit(),
      toast: (m) => toast(m),
      announce: (m) => toast(m),
      undoToast: (m) => undoToast(m),
      openMenu: (a, items) => openMenu(a, items),
      useIn: (nm) => paramUseIn(nm),
      pointOf: (nm) => numberPoint(nm),
      showPoint: (nm) => { if (!numberPoint(nm)) addNumberPoint(nm); },
    });
    if (!(/** @type {any} */ (attachParams)).on) { /** @type {any} */ (attachParams).on = true; Params.on('change', onParamChange); }
  }
