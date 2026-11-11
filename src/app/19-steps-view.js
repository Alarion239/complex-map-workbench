  // ---------------- the steps view (#366 prototype, behind ?view=steps) ----------------
  // One plane of the chain z → w₁ → … → w fills the screen. ‹ ›, the arrow keys, the chain strip and (on a touch
  // screen) a swipe from the plane's edge glide from one plane to the next along the step's deformation h_{k,t}.
  // The colour plane (SV.T, a stage) holds the colour: a plane at or before it is coloured by the phase of the
  // map into the colour plane, f_T ∘ … ∘ f_{k+1} (the pull-back of the colour wheel, the colour plot of the map {a: k, b: T});
  // a plane after it shows the shapes carried forward with their pattern (the push-forward). Inside regions (SV.scope
  // 'in') shows the colour only inside the regions in this plane: the z-plane's and earlier planes' regions carried
  // forward, this plane's own, and later planes' pulled back.
  // The view reuses the app's views: a plane at or before the colour plane is Phase (or Landscape), one after it X → Y, always on
  // the left pane alone (solo 'L'); leftStage() is the shown plane, focusMap() the map into the colour plane.
  const SV = {
    // (the steps view is the default; ?view=classic, or a host page that sets window.cmwView = 'classic' before the app starts, opens the classic views)
    on: (() => { try { return (new URLSearchParams(location.search).get('view') || /** @type {any} */ (window).cmwView) !== 'classic'; } catch (e) { return true; } })(),
    core: '',        // the core that drew the left plane last: 'carry' (svRenderMoving's) or 'still' (the classic one's)
    bare: false,     // (a test hook's) the left pane's frames draw the colour layer alone
    poleFrameMs: 0,  // (a test hook's) a frame's pole search budget in ms, instead of SV_POLE_BUDGET when above 0 (a slow machine's)
    clock: null,     // (a test hook's) ms of glide or play time a frame (svFrame), else the wall clock
    i: 0,            // the shown plane, an index into svPlanes()
    at: 0,           // the plane last arrived at (null: parked between two), so 'plane-changed' is sent for a change only
    T: -1,           // the colour plane's stage (-1: the last plane, F's)
    scope: 'all',    // 'all' | 'in'
    surf: 'plane',   // 'plane' | 'sphere' | 'land'
    g: HomRange.glider({ omega: 7 }),   // the position x in planes (set directly: a scrub, a swipe, the glide below)
    anim: null,      // the glide to a plane: {from, to, t0, ms}, eased in and out over a fixed time (no spring tail)
    sig: null,       // the chain and shapes last seen (another one: an example or a link was opened)
    footT: -1,       // the colour plane and Cauchy kind the style row was last built for
    dcSeen: '',      // the phase style svCheck saw last
    main: null,      // the view the steps view set last (svViewFix): a parked view rounds to a plane it was not set for
    drag: null,      // a scrub of the strip or a swipe of the plane: {x0, i0, px, w, id, edge}
    els: null,
    ready: false,    // setup is done: S.sv may be written (before it, the state's own place is still to be read)
  };
  // the glide's time a plane, by speed (a setting kept on this device)
  const SV_SPEEDS = { fast: 450, normal: 900, slow: 2000, slower: 4500 };
  SV.speed = (() => { try { const v = localStorage.getItem('cmw-sv-speed'); return v && SV_SPEEDS[v] ? v : 'normal'; } catch (e) { return 'normal'; } })();
  SV.loop = (() => { try { return localStorage.getItem('cmw-sv-loop') === '1'; } catch (e) { return false; } })();
  SV.span = null;   // the planes a glide crosses as one homotopy (All at once): {x0, x1}, indices into svPlanes(); null: plane by plane
  SV.play = null;   // play along the thread (#438): {from, to, start, t0, ms} a glide, or {slide, start, end, timer} one plane at a time
  // the planes: z and the stage after each active step
  // (#437: a step shown alone narrows the thread to the plane before it and its own. So index 0 is not always z: while a step is
  // shown alone the list starts at its input plane. Code that needs z asks for stage 0, not svPlanes()[0])
  function svPlanes() { const k = svAloneOk(); return k ? [svPrev(k), k] : [0].concat(activeSteps()); }
  function svStage(i = SV.i) { const P = svPlanes(); return P[Math.max(0, Math.min(P.length - 1, i))]; }
  function svT() { const P = svPlanes(); return SV.alone && P.length === 2 && P[1] === SV.alone ? SV.alone : P.includes(SV.T) ? SV.T : P[P.length - 1]; }
  // a glide's u at or under this is its plane's rest frame (the thread sits on a plane, to the precision of a float); it stays above
  // SV_REST_U_MIN, two ulps of float32 below 1, where 1 - t is exact (Sterbenz) so a frame at t = 1 - u is not the plane itself
  const SV_REST_U_MIN = 2 ** -23;
  const SV_REST_U = 3e-7;
  // the sheet key's inner radius, as a share of its window's half diagonal R (the region tiling's own: smKeyOf)
  const SV_KEY_RS = 1 / 8;
  // the carried globe's mesh (cells along longitude and latitude), and the chord, on the unit sphere, over which a
  // triangle is torn across a cut or a pole and left out (CARRY_GLOBE_VS)
  const SV_GLOBE_MESH = { nx: 192, ny: 96 }, SV_GLOBE_CHORD = 0.5;
  // plane b's globe is cross-faded in over a's only past this u (under it its alpha, u, is below 3 of 255 levels, not
  // worth a second globe's draw)
  const SV_FADE_U = 0.01;
  // the shown plane is coloured from the colour plane: at or before it, and not across a d/dz (whose input is z's plane, not w_k's)
  function svColoured(k = svStage()) { const T = svT(); return k <= T && (k === 0 || !derivIn(k, T)); }
  // which way the shown plane is painted: 'pull' on a coloured plane (the colour is pulled back through the map), 'push' past it
  // (the colour plane's colour is pushed forward); the one flag the plane's UI reads, whatever the drawing core does
  const svPaint = (k = svStage()) => (svColoured(k) ? 'pull' : 'push');
  const svMap = () => { const k = svStage(); return k === 0 ? stageMap(svT()) : { mode: 0, a: k, b: svT() }; };
  // Every plane's Landscape height is h(F_k), F_k the stages (k, last]: the same value of a
  // point in every plane. The plane the heights of plane k read is the last one, unless a d/dz step on the way leaves
  // no map from w_k (then the colour plane, or past it w_k itself)
  function svHT(k) { const P = svPlanes(), L = P[P.length - 1]; return k === 0 || !derivIn(k, L) ? L : Math.max(k, svT()); }
  // the height map of plane k (a map spec of plane k) and its CPU twin
  const svHeightMap = (k) => ({ mode: 0, a: k, b: svHT(k) });
  const svHeightF = (k) => { const t = svHT(k); return k === t ? (z) => z : rangeF(k, t); };
  // plane k's Landscape is plain: k is before the colour plane T with a d/dz step between them, so its 2D picture has no
  // colour (shapes only). Every plane past T is coloured from T, through the z points it shares with T when a d/dz step
  // lies between them
  const svPlain = (k) => !svColoured(k) && k < svT();
  // (one name for a plane everywhere: the last is w₂ too, F is the name of the map into it)
  const svName = (k) => (k === 0 ? 'z' : `w${sub(k)}`);
  const svNameHtml = (k) => (k === 0 ? '<i>z</i>' : `<i>w</i><sub>${k}</sub>`);
  // the map from plane k into the colour plane T, by name (#435): F from z into the last plane, else f_T ∘ … ∘ f_{k+1}
  // (f₂, f₃∘f₂, f₄∘⋯∘f₂); null when k is T itself (the wheel is the plane's own phase). fmt 'html', 'text' or 'tex'
  function svMapName(fmt, k = svStage(), T = svT()) {
    const P = svPlanes(), ss = P.filter((s) => s > k && s <= T), h5 = fmt === 'html', tex = fmt === 'tex';
    if (!ss.length) return null;
    if (k === 0 && T === P[P.length - 1]) return h5 ? '<i>F</i>' : 'F';
    const f = (s) => (h5 ? `<i>f</i>${sub(s)}` : tex ? `f_{${s}}` : `f${sub(s)}`), q = ss.slice().reverse();
    const o = tex ? '\\circ ' : '∘', dots = tex ? '\\cdots' : '⋯';
    return q.length === 1 ? f(q[0]) : q.length === 2 ? `${f(q[0])}${o}${f(q[1])}` : `${f(q[0])}${o}${dots}${o}${f(q[q.length - 1])}`;
  }
  // the longest step formula, in TeX characters, that the export's caption shows in its display: a longer one would
  // not fit the display's one line, so the caption names the map without it
  const SV_CAP_TEX_MAX = 240;
  // the export's caption parts for the shown plane: its variable; the map that colours it (into the colour plane)
  // or, past the colour plane, the map that carries the shapes to it from z, by name; that map's formula when it is
  // one step and no longer than SV_CAP_TEX_MAX
  function svFigParts() {
    const k = svStage(), T = svT(), coloured = svColoured(k), [a, b] = coloured ? [k, T] : [0, k];
    const ss = svPlanes().filter((s) => s > a && s <= b), st = ss.length === 1 ? built[ss[0] - 1] : null;
    const lvar = k === 0 ? 'z' : `w_{${k}}`, arg = a === 0 ? 'z' : `w_{${a}}`;
    const raw = st && !st.error ? st.tex({ s: arg, p: 4 }).s : null;
    return { k, coloured, lvar, arg, name: svMapName('tex', a, b), raw: raw && raw.length < SV_CAP_TEX_MAX ? raw : null };
  }
  // that map applied to the plane's own variable, "f₂(w₁)"; just the variable when k is T
  const svMapCall = (fmt, k = svStage()) => { const m = svMapName(fmt, k), v = fmt === 'html' ? wHtml(k) : svName(k); return m ? (fmt === 'html' ? `${m}<span class="rm">(</span>${v}<span class="rm">)</span>` : `${m}(${v})`) : v; };
  // the map from the shown plane into the colour plane as a function: what the probe reads (the identity past it, where
  // the plane carries shapes and no colour of its own)
  function svF(k = svStage()) { const T = svT(); return !svColoured(k) ? (z) => z : k === 0 ? stageF(T) : k === T ? (z) => z : rangeF(k, T); }
  // the plane the shown plane's colour is carried from, "w₁", when it is past the colour plane (the key says so, #442); else ''
  const svCarriedFrom = () => (SV.on && svStage() > svT() && !svColoured() ? svName(svT()) : '');
  // what the key's caption calls the colouring, "arg and |f₂|": the map into the colour plane, or the plane's own variable
  const svKeyName = (k = svStage()) => svMapName('text', k) || svName(k);
  // past the colour plane the colour is carried, so the probe names where its point comes from in the colour plane T: a
  // preimage of it under the map T → shown plane, by a short search over the camera's window (undefined at or before T;
  // null when none is found there or the map has no inverse here, which the readout says as "—")
  function svSource(q) {
    const k = svStage(), T = svT();
    if (k <= T) return undefined;
    if (T > 0 && derivIn(T, k)) return null;
    /** @type {any} */
    let sols = [];
    const F = T === 0 ? stageF(k) : rangeF(T, k), box = paneBox(paneL, leftView());
    try {
      sols = zerosPolesTimed(F, box, { target: { re: q.re, im: q.im }, max: 4 }, 4);
      // (a search that found nothing before its time ran out, a cold first call or a busy frame: once more with more time)
      if (!sols.length && (sols.stopped || sols.incomplete)) sols = zerosPolesTimed(F, box, { target: { re: q.re, im: q.im }, max: 4 }, 16);
    } catch (e) { return null; }
    const hit = sols.filter((r) => r && r.kind !== 'pole' && r.z && CX.isFin(r.z));
    return hit.length ? hit[0].z : null;
  }
  // the plane's title, name · role: "w₁ · phase of f₂" (the shown plane, then the map into the colour plane); past the
  // colour plane the colour is carried by the points, which the role says. A Landscape names its height, h(F) on every
  // plane (svHeightF), then the carried colour past T
  function svTitleParts() {
    const k = svStage(), T = svT(), map = svMapName('html', k, T) || wHtml(k);
    let role, short = '';
    if (SV.surf === 'land' && svMain(k) === 'land') {
      const o = { h: heightHtml('<i>F</i>'), sheets: landSheetsHtml(), p: wHtml(T) };
      role = k > T ? $t('landscape of {h}{sheets}, colour carried from {p}', o) : $t('landscape of {h}{sheets}', o);
      short = $t('landscape');
    } else if (!svColoured(k)) role = k > T ? $t('colour carried from {p}', { p: wHtml(T) }) : $t('shapes only');
    else if (k === 0 && S.dc === 'cauchy' && cauchyPlot()) { role = $t('Cauchy integral over {name}', { name: cauchyPlot().name }); short = $t('Cauchy integral'); }
    else if (k === T) role = $t('colour plane');
    else role = $t('phase of {ofV}', { ofV: map });
    return { name: svNameHtml(k), role, short };
  }
  const svReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // (one camera for every plane, S.srcView: a glide moves the picture, never the view, so its scale is the user's own)
  // the app's view of the shown plane: Phase (or Landscape) at or before the colour plane, X → Y after it; true when S changed
  const svMain = (k = svStage()) => (SV.surf === 'land' ? 'land' : svColoured(k) ? 'phase' : 'xy');
  function svViewFix() {
    const k = svStage(), col = svColoured(k), v = S.view, surf = SV.surf === 'sphere' ? 'sphere' : 'plane';
    const main = svMain(k);
    let ch = false;
    if (S.focus !== 0) { setFocusStep(0); ch = true; }
    if (morph.open) { morph.open = false; ch = true; }
    if (v.main !== main) { setViewOpt(null, 'main', main); ch = true; }
    SV.main = main;
    const side = col ? 'P' : 'L';
    if (main !== 'land' && v[side].surf !== surf) { setViewOpt(side, 'surf', surf); ch = true; }
    return ch;
  }
  // a state replaced under the view (an example, undo, a link): back to what the steps view shows, before it is drawn
  function svCheck() {
    // (only a glide or a drag under way holds it off: a view parked between planes still takes an example, a link or an
    // undo; perf on #460)
    if (!SV.on || !SV.els) return;
    const sig = svSigNow();
    // (rework on #460: another chain loaded under a Play, Loop on: it stops, or it never adopts the new view)
    if (SV.play && SV.sig != null && sig !== SV.sig) svPause(false);
    if (svGliding()) return;
    const P = svPlanes();
    if (SV.i > P.length - 1) { SV.i = P.length - 1; SV.g.set(SV.i); }
    if (SV.T >= 0 && !P.includes(SV.T)) SV.T = -1;
    // (the Cauchy style is drawn on z, so choosing it, or loading a state, example or tour step that has it, colours from z)
    // (and the thread parks on z with it: the style's control is in the pane of the colour plane, which the view shows only while it is the plane the thread is on)
    if (S.dc === 'cauchy' && SV.dcSeen !== 'cauchy' && !SV.alone && P.length > 1) { if (SV.T !== P[0]) SV.T = P[0]; if (SV.i !== 0) { SV.dcSeen = S.dc; svGo(0, true); } }
    SV.dcSeen = S.dc;
    // (another chain loaded with the state, an example or a link: its glide's programs are started too)
    if (SV.sig != null && sig !== SV.sig) svPrestartSoon(300);
    svAdopt(SV.sig != null && sig !== SV.sig);
    SV.sig = sig;
    if (svViewFix()) setTimeout(svApply, 0);
    svSync();
  }
  // a view the steps view did not set (an example, a link, a saved state) opens coloured from the last plane: X → Y
  // with the colour inside its regions, Phase everywhere, Landscape on the relief
  // (force: another chain was loaded, which brings its own view even when it is the one shown)
  const svSigNow = () => svPlanes().join(',') + '|' + S.steps.map((st) => st.type).join(',') + '|' + S.shapes.map((x) => x.id).join(',');
  function svAdopt(force) {
    const ext = S.view.main;
    // (a view the steps view set is not one from outside, whichever plane a parked view now rounds to; a Phase view on the
    // other surface is one from outside too: a save that asked for the sphere opens on it)
    const own = ext === 'land' || Views.xOf(S.view).surf === (SV.surf === 'sphere' ? 'sphere' : 'plane');
    if ((ext === svMain() || ext === SV.main) && !force && own) return;
    // (ux's review: always from the last plane, F's; X → Y keeps its colour inside its regions when it has areas;
    // Views.svOf, concept §6)
    const areas = S.shapes.some((s) => s.visible !== false && kindType(s) === 'area');
    const o = Views.svOf(S.view, areas, S.steps.length === 0);
    SV.T = o.T; SV.scope = o.scope; SV.surf = o.surf;
    if (SV.els) setSeg(SV.els.scope, SV.scope);   // (the head's switch shows what the view opened on)
    SV.i = 0; SV.g.set(0);
  }
  // S.sv, the steps view's place, saved in the state, in links and kept by undo (Views.cleanSv; the speed is the state's, and
  // the device's setting for a state without one). svStore writes it before a save, a link or an undo entry;
  // svLoad reads it when the page opens on a state that has one, and after an undo
  function svStore() {
    if (!SV.on || !SV.ready) return;
    // (#437: a step shown alone keeps the whole chain's place, which is what undo and a link restore)
    const b = SV.alone && SV.back ? SV.back : null;
    const o = { at: b ? b.i : SV.anim ? SV.anim.to : SV.g.x, T: b ? b.T : SV.T, scope: SV.scope, surf: SV.surf, speed: SV.speed };
    if (SV.alone) o.alone = SV.alone;   // (the step shown alone is part of the state: a reload, a language switch and a link keep it)
    setOpt('sv', o);
  }
  function svLoad(onPageOpen) {
    // (#437: by the chain's own steps: after an undo the active steps (svPlanes) still read the chain before it, which clamped the place)
    const o = Views.cleanSv(S.sv, svAloneOk() ? svPlanes() : svPlanesOf(S.steps));
    if (!o) return false;
    SV.T = o.T; SV.scope = o.scope; SV.surf = o.surf;
    if (o.speed) { SV.speed = o.speed; svPlayRebase(); if (SV.els) { if (SV.els.speed) SV.els.speed.value = o.speed; if (SV.els.sheetSpeed) SV.els.sheetSpeed.value = o.speed; } }   // (a state without one keeps the device's)
    SV.anim = null; SV.g.max = svPlanes().length - 1; SV.g.set(o.at); SV.i = Math.round(o.at);
    SV.at = Math.abs(o.at - SV.i) < SV_REST_U ? SV.i : null;
    // (when the page opens on a state that had a step shown alone, it is shown alone again, over the chain's place that
    // leaving it goes back to; an undo leaves it)
    if (onPageOpen && o.alone && !SV.alone) {
      SV.back = { i: SV.i, T: SV.T };
      SV.alone = o.alone; SV.i = 0; SV.at = 0; SV.g.set(0); SV.g.max = 1;
      SV.sig = svSigNow();
    }
    return true;
  }
  // the place x along the chain (a link's figMorph time: planes are the chain's stages), at once and without a glide
  function svPlaceAt(x) {
    if (!SV.on || !SV.ready) return;
    const n = svPlanes().length - 1, p = Math.max(0, Math.min(n, x));
    SV.anim = null; SV.g.set(p); SV.i = Math.round(p);
    SV.at = Math.abs(p - SV.i) < SV_REST_U ? SV.i : null;
    svApply();
  }
  // an undo put another S.sv under the view
  function svRestored() {
    if (!SV.on || !SV.ready) return;
    if (SV.alone) { SV.alone = 0; SV.back = null; }   // (#437: an undo leaves a step shown alone)
    const ls = SV.lastSplit;
    SV.lastSplit = null;
    // (the undo of the split just made, with a glide or a play under way: it goes on, as the split's did)
    if (ls && svGliding() && S.steps.length === ls.len - (ls.n - 1)) { SV.split = { inv: true, k: ls.k, n: ls.n, j: ls.j }; SV.own = true; return; }
    if (svLoad()) { SV.sig = null; setTimeout(svApply, 0); }
  }
  function svApply() {
    const k = svStage();
    svViewFix();
    leftAuto = false;
    if (k > 0) Object.assign(V.left, S.srcView);
    applyLayout();
    buildShapeList();
    updateFocusUI();
    requestRender('L', 'R', 'OL', 'OR', 'G');
    svSync();
  }
  // leave the shown plane: its view (panned or zoomed there) is the camera every plane shares
  function svKeepView() { const k = svStage(); if (k > 0) Object.assign(S.srcView, { cx: V.left.cx, cy: V.left.cy, s: V.left.s }); }
  // go to plane i: a glide along the steps in between (at once under reduced motion)
  function svGo(i, now) {
    const P = svPlanes();
    i = Math.max(0, Math.min(P.length - 1, i));
    svPause(false);
    svKeepView();
    SV.span = null;
    if (now || svReduced()) { SV.anim = null; SV.g.set(i); svArrive(); return; }
    SV.g.max = P.length - 1;
    const from = SV.g.x;
    if (Math.abs(i - from) < SV_REST_U) { SV.anim = null; SV.g.set(i); svArrive(); return; }
    // (a press while it glides starts the next glide from where the picture is: no jump; 420 ms a plane, at most 900)
    // (the speed setting's time a plane, for at most two planes' worth when it crosses several)
    const per = SV_SPEEDS[SV.speed] || 900;
    SV.span = svSpanOf(from, i);
    SV.anim = { from, to: i, t0: performance.now(), ms: per * Math.min(2, Math.max(0.35, Math.abs(i - from))) };
    draft = null; probe = null;
    requestRender('L');
  }
  function svArrive() {
    svPolesWatch();
    const i = Math.round(SV.g.x), was = SV.at;
    SV.span = null;
    SV.g.set(i);
    SV.i = i;
    svApply();
    // (the tour and an example's Try line listen for it: a plane reached other than the one it was at; not a plane the view was
    // opened on)
    SV.at = i;
    if (was !== i) { const n = svPlanes().length; tourEmit('plane-changed', { i, n, last: i === n - 1 }); }
    if (typeof sndRelayout === 'function') sndRelayout();
    const live = SV.els && SV.els.live;
    if (live) live.textContent = svLabel();
  }
  // (parked: left between two planes on the thread, the picture of the deformation there)
  const svParked = () => !SV.anim && !SV.play && !(SV.drag && SV.drag.moved) && Math.abs(SV.g.x - Math.round(SV.g.x)) > SV_REST_U;
  // (under way: a glide, a play, a scrub or a swipe; a play is no parked view)
  const svGliding = () => !!SV.anim || !!SV.play || SV.g.moving() || !!(SV.drag && SV.drag.moved);
  const svMoving = () => svGliding() || svParked();
  // one plane on (d = ±1) from where the view is: from between two planes, the next one that way
  function svStep(d) {
    if (SV.anim) { svGo(SV.anim.to + d); return; }
    const x = SV.g.x;
    svGo(d > 0 ? Math.floor(x + SV_REST_U) + 1 : Math.ceil(x - SV_REST_U) - 1);
  }
  // one frame of the glide (frame() calls it); true while it moves
  function svFrame(ts) {
    if (!SV.on) return false;
    if (SV.drag && SV.drag.moved) { dirty.L = true; svSync(); return false; }
    if (SV.play && !SV.play.slide) return svPlayFrame();
    if (SV.anim) {
      // (SV.clock, a test hook's, null in the app: the glide's time advances that many ms a frame instead of by the wall
      // clock, so a suite reads its frames mid-glide however long each one takes to draw)
      const A = SV.anim, el = SV.clock ? (A.el = (A.el || 0) + SV.clock) : performance.now() - A.t0;
      const v = Math.min(1, el / A.ms), e0 = v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
      // (A.e0: the ease's value when a Split remapped the glide; it goes on from there, so the place has no jump)
      const e = A.e0 ? (e0 - A.e0) / Math.max(1e-9, 1 - A.e0) : e0;
      SV.g.set(A.from + (A.to - A.from) * e);
      dirty.L = true;
      svSync();
      if (v >= 1) { SV.anim = null; svArrive(); return false; }
      return true;
    }
    if (!SV.g.moving()) return false;
    const dt = SV.g.last ? (ts - SV.g.last) / 1000 : 1 / 60;
    SV.g.last = ts;
    const still = !SV.g.step(dt);
    dirty.L = true;
    svSync();
    if (still) { SV.g.last = 0; svArrive(); return false; }
    return true;
  }
  // the plane a carry starts from: s0, unless a d/dz step lies between s0 and a plane in ts it must reach (the places,
  // the colour plane, the planes the heights read), or All sheets draws a multivalued chain; then z's plane. Every stage
  // is a function of z (chainRange from plane 0 crosses a d/dz step, from a later plane it cannot), and the sheets of a
  // step before s0 exist only as the preimages of z's points
  const svCarryFrom = (s0, ts) => (S.sheets && multiSheet() || ts.some((t) => t > s0 && derivIn(s0, t)) ? 0 : s0);
  // the longest edge a cell of the carried grid may have once placed by the glide's map, as a share of the pane's longer
  // side (svLandCarry's lim, in the plane's units): a cell stretched past it, by a pole of the map or a fold, is left
  // out, and the patches about the poles cover its place
  const LAND_CELL_SPAN = 0.35;
  // The Landscape as the points of a source plane s carried (render3D's carry), from plane a's surface at u = 0 to plane
  // b's at u = 1 (b null: a's). s is min(a, T), or z's plane when a d/dz step lies in the way or All sheets draws a
  // multivalued chain (svCarryFrom), so every point past T keeps T's colour. Each point is placed by mapOf(s) (a map spec from plane s), at its height h(F) (the
  // stages (s, hT] blended over u into (s, hT2]: the heights of planes a and b, svHT) and in its colour (the stages
  // (s, T]), or in no colour while the nearer plane is plain (svPlain; T is then s). key: from z's
  // plane to a later one, the 2D carried colour's sheet key of the plane the frame goes to (svSheetKey), so where the
  // places fold the point in front is the one the 2D picture shows; else null. vs, va, vb: the shared camera's view (S.srcView: a glide moves the picture, never the view), the same for s, a and b.
  // rest: the plane at rest the frame is (the probe picks on its relief), else null. zmap: the same map from z's plane, the
  // map the shapes' outlines are drawn under, so the floor's lines are carried as the surface is
  function svLandCarry(mapOf, a, b, u, rest = null) {
    const T0 = svT(), e = b == null ? a : b, hT = svHT(a), hT2 = svHT(e), plain = svPlain(u < 0.5 ? a : e);
    const s = svCarryFrom(Math.min(a, T0), [e, T0, hT, hT2]), T = plain ? s : T0;
    const lim = LAND_CELL_SPAN * Math.max(paneL.w, paneL.h) / S.srcView.s, hmap = { mode: 0, a: s, b: hT };
    const cam = S.srcView;
    const key = !plain && s === 0 && e > 0 ? svSheetKey(e) : null;
    return { map: mapOf(s), zmap: mapOf(0), s, T, hT, hT2, hmap, plain, key, lim, u, a, b, vs: cam, va: cam, vb: b == null ? null : cam, rest };
  }
  // plane k's Landscape at rest: its own relief (render3D without a carry, heights and colour of the one map into T)
  // when it is coloured from T and its heights are of that map too; else plane k's points (k at or before T) or T's
  // (past it) carried to plane k, so the height is h(F_k) and the colour that of the 2D picture. Undefined for the rest
  // frame
  function svLandRest(k = svStage()) {
    if (!SV.on) return undefined;
    const T = svT(), to = (s) => ({ mode: 0, a: s, b: k });
    if (k <= T) return !svPlain(k) && svHT(k) === T ? undefined : svLandCarry(to, k, null, 0, k);
    return svLandCarry(to, T, k, 1, k);
  }
  // The Landscape between two planes a and b: the points of plane s carried by the glide's map, each at its height and
  // colour (svLandCarry); at u = 0 and 1 that is plane a's and plane b's surface at rest, since F_s = F_b ∘ (the map
  // s → b). Across a d/dz step the points of z's plane move along the classic deformation's straight line from stage a
  // to stage b (mode 1 at a d/dz step), so the glide is continuous as everywhere else. At a plane, that plane's surface
  // at rest. False when the Landscape is not on the pane
  function svLandMoving(pane) {
    if (SV.surf !== 'land' || !lLand()) return false;
    const g = svBetween();
    if (!g.all && (g.u <= SV_REST_U || g.a === g.b)) { render3D(pane, svLandRest(g.near)); return true; }
    const mapOf = (s) => (g.all ? { mode: 3, a: g.a, b: g.b, t: g.u, base: s } : { mode: 1, base: s, hi: g.b, t: g.u });
    render3D(pane, svLandCarry(mapOf, g.a, g.b, g.u));
    return true;
  }
  // The carried grid's patches for GLR.drawLandscape (CARRY_Z), [x, y, r0, r1] each: one about each pole of the carry's
  // map (from plane s) in plane s's carried box src, from a ten-thousandth of a cell of the box's N x N grid to eight
  // cells, nearest the box's centre first, at most 4. Near a pole the map carries a small disc over the far plane, where
  // the box's cells stretch past the tear limit and are left out.
  // The poles are searched for (svPolesIn) once per carry: its map but for t, and src. Then each frame follows the last
  // frame's poles by Newton's method (svPoleAt; one that does not settle stays where it was): a glide's poles move little
  // from frame to frame, and a step's own poles (a Möbius step's) not at all. (The glide's pole tracks, svPoleTracks, are
  // of the map from plane 0 over the camera's window; the carry's map is from plane s over its box)
  const svLandPoleMemo = { key: '', poles: [] };
  function svLandPatches(map, src, N, hF, hKey) {
    const F = cpuMap(map);
    if (!F) return [];
    const key = JSON.stringify([map.mode, map.base, map.hi, map.a, map.b, map.post, map.t, src.x0, src.x1, src.y0, src.y1]), E = { n: 0, at: 0 };
    let poles;
    if (svLandPoleMemo.key === key) poles = svLandPoleMemo.poles.map((p) => svDrain(svPoleAt(F, p, src, E)) || svDrain(svSingularAt(F, p, SV_SING_BIG, E, src)) || p);
    else poles = svDrain(svPolesIn(F, src, 16, src, E, true));
    const cell = Math.max(src.x1 - src.x0, src.y1 - src.y0) / (N - 1), cx = (src.x0 + src.x1) / 2, cy = (src.y0 + src.y1) / 2;
    const near = poles.sort((p, q) => Math.hypot(p.re - cx, p.im - cy) - Math.hypot(q.re - cx, q.im - cy)).slice(0, 4);
    Object.assign(svLandPoleMemo, { key, poles: near });
    const patch = (p) => [p.re, p.im, cell * 1e-4, cell * 8];
    return near.map(patch).concat(hF ? svLandHeightPoles(hF, hKey, src, cell * 8).map(patch) : []);
  }
  // The poles of the height map hF (plane s to the height plane) in the far patches' inner ring, and within a pole patch's
  // reach (reach) of it, outside the carried box src, nearest the box's centre first, at most LAND_HEIGHT_POLES: the height
  // there is a log spike that the far patches' coarse cells facet, so each gets a pole patch of its own like the glide
  // map's poles (svLandPatches). hF does not move with the glide, so they are searched once per plane s and box (hKey
  // names hF)
  const LAND_HEIGHT_POLES = 8, LAND_HEIGHT_GRID = 64, svLandHeightMemo = { key: '', poles: [] };
  function svLandHeightPoles(hF, hKey, src, reach) {
    const key = JSON.stringify([hKey, src.x0, src.x1, src.y0, src.y1, reach]);
    if (svLandHeightMemo.key === key) return svLandHeightMemo.poles;
    const x = (src.x0 + src.x1) / 2, y = (src.y0 + src.y1) / 2, r = LAND_FAR_NEAR * LAND_FAR_LAP * Math.min(src.x1 - src.x0, src.y1 - src.y0) / 2 + reach;
    const ring = { x0: x - r, x1: x + r, y0: y - r, y1: y + r };
    const out = svDrain(svPolesIn(hF, ring, LAND_HEIGHT_GRID, ring, { n: 0, at: 0 }))
      .filter((p) => p.re < src.x0 || p.re > src.x1 || p.im < src.y0 || p.im > src.y1)
      .sort((p, q) => Math.hypot(p.re - x, p.im - y) - Math.hypot(q.re - x, q.im - y)).slice(0, LAND_HEIGHT_POLES);
    Object.assign(svLandHeightMemo, { key, poles: out });
    return out;
  }
  // The carried grid's far patches for GLR.drawLandscape (CARRY_Z), [x, y, r0, r1] each: plane s outside its carried box
  // src, in two rings about the box's centre, from its inscribed circle to LAND_FAR_NEAR times that, then on to
  // LAND_FAR_REACH times the box's size. A map takes that region over the far plane too (a Möbius step takes it to a
  // disc about the image of infinity), where no cell of the box's grid reaches. The inner ring is the part the glides
  // of a periodic map (exp) bring into the block, so it has the finer grid. The inner ring runs a little past the outer
  // one's start (LAND_FAR_LAP), so the chords of their polygons, of different sizes, leave no crack.
  const LAND_FAR_NEAR = 4, LAND_FAR_REACH = 1000, LAND_FAR_LAP = 1.002;
  const svLandFar = (src) => {
    const w = src.x1 - src.x0, h = src.y1 - src.y0, x = (src.x0 + src.x1) / 2, y = (src.y0 + src.y1) / 2, r = Math.min(w, h) / 2;
    return [[x, y, r, LAND_FAR_LAP * LAND_FAR_NEAR * r], [x, y, LAND_FAR_NEAR * r, LAND_FAR_REACH * Math.max(w, h)]];
  };
  // the glide between planes a and b at x: (a, b, u, the map of the z-plane's shapes along h_{b,u}, and the plane whose
  // look the regions take, the nearer one: outlined over colour, filled past the colour plane, as each plane at rest)
  // All at once (S.homAll, as the classic Deformation's order): a glide that crosses two planes or more is one homotopy, every step
  // of it at the same time t (the map spec of mode 3 and its CPU twin), the planes between left out; not across a d/dz, whose
  // step is no map
  function svAllOk(x0, x1) {
    const ks = svPlanes().slice(x0 + 1, x1 + 1);
    return !!S.homAll && ks.length > 1 && !ks.some((k) => isDeriv(k));
  }
  // the span of a glide from plane index `from` to `to` (a plane's index, an integer) when it goes all at once, else none
  function svSpanOf(from, to) {
    if (Math.abs(from - Math.round(from)) > SV_REST_U) return null;
    const x0 = Math.min(Math.round(from), to), x1 = Math.max(Math.round(from), to);
    return x1 - x0 > 1 && svAllOk(x0, x1) ? { x0, x1 } : null;
  }
  // the picture at the thread's place x (default where the thread is) and its All-at-once span (default the view's);
  // x0, x1: a's and b's places
  function svBetween(x = SV.g.x, span = SV.span) {
    const P = svPlanes();
    if (span && span.x1 < P.length && x > span.x0 + SV_REST_U && x < span.x1 - SV_REST_U && svAllOk(span.x0, span.x1)) {
      const a = P[span.x0], b = P[span.x1], u = (x - span.x0) / (span.x1 - span.x0), map = { mode: 3, a, b, t: u };
      // (F is the map spec's own CPU twin; H, the homotopy alone, is the same steps' homF composed)
      const homs = P.slice(span.x0 + 1, span.x1 + 1).map((k) => homF(k, u));
      const H = (z) => { let w = z; for (const f of homs) w = f(w); return w; };
      return { a, b, u, map, F: cpuMap(map), H, near: u < 0.5 ? a : b, all: true, x0: span.x0, x1: span.x1 };
    }
    const j = Math.max(0, Math.min(P.length - 1, Math.floor(x + 1e-9))), u = x - j;
    const a = P[j], b = P[Math.min(P.length - 1, j + 1)];
    const still = u <= SV_REST_U || b === a, jump = !still && isDeriv(b);
    const map = still ? stageMap(a) : jump ? stageMap(u < 0.5 ? a : b) : { mode: 1, hi: b, t: u };
    // (its CPU twin, for the points: H_u after the steps before b, as transState)
    const hom = still || jump ? null : homF(b, u);
    const F = still ? stageF(a) : jump ? stageF(u < 0.5 ? a : b) : ((H, before) => (z) => H(before(z)))(hom, stageF(b - 1));
    return { a, b, u, map, F, H: hom, near: u < 0.5 ? a : b, all: false, x0: j, x1: j + 1 };
  }
  // (a glide's frames sample the cuts' banks at a quarter of the density: 121 points a bank, cutBank)
  const SV_CUT_THIN = 4;
  // How the cuts' image curves are drawn in the picture of a svBetween result bt (drawCutCurvesAt's arguments):
  // - mapFor(j0): the map from the plane j0 (a cut's own plane) to the picture, the chain's steps up to the plane the glide
  //   starts from, then the glide's homotopy at its u; null where the picture has no image of that plane (a plane past
  //   the glide's, a d/dz step between, a middle plane of an All-at-once run);
  // - pre: the cuts of the planes past the glide's, drawn as the preimages the plane it starts from shows at rest, carried
  //   by the homotopy as every point of that plane is, so they meet the planes' own frames at both ends
  // A picture at rest on a plane (or across a d/dz step) is that plane's
  function svCutPlan(bt) {
    const P = svPlanes(), { a, b, u, H, all, near } = bt, still = u <= SV_REST_U || b === a;
    if (still || isDeriv(b)) {
      return { mapFor: (j0) => (j0 <= near && !derivIn(j0, near) ? rangeF(j0, near) : null), pre: { k: near, jMin: 0, H: null } };
    }
    const from = all ? P[bt.x0] : b - 1;
    return {
      mapFor: (j0) => (j0 <= from && !derivIn(j0, from) ? ((base) => (z) => H(base(z)))(rangeF(j0, from)) : null),
      pre: { k: from, jMin: (all ? P[bt.x1] : b) + 1, H },
    };
  }
  // The steps view's deformation source for the paths t -> H_t(z) (classicSource's fields): the glide's run of planes
  // [lo, hi] (thread places), from where it started to where it goes (play: from its start; a glide: both ends; parked
  // or dragged between two planes: those two), with T the thread's place in it, so a glide over several planes keeps one
  // selection; H_T the picture at thread place lo + T, which starts at plane lo's image of z. Null on a plane at rest,
  // with Paths off, or with a d/dz step in the run (it has no path, as the classic).
  function svPathsSource() {
    if (S.morphPaths === false || !SV.on) return null;
    const P = svPlanes(), x = SV.g.x, n = P.length - 1;
    let lo, hi;
    if (SV.play && !SV.play.slide) { lo = Math.floor(Math.min(SV.play.from, SV.play.to) + 1e-9); hi = Math.ceil(Math.max(SV.play.from, SV.play.to) - 1e-9); }
    else if (SV.anim) { lo = Math.floor(Math.min(SV.anim.from, SV.anim.to) + 1e-9); hi = Math.ceil(Math.max(SV.anim.from, SV.anim.to) - 1e-9); }
    else { lo = Math.floor(x + 1e-9); hi = lo + 1; }
    lo = Math.max(0, lo); hi = Math.min(n, hi);
    if (!(hi > lo) || (x - lo < SV_REST_U && !SV.anim && !SV.play) || derivIn(P[lo], P[hi])) return null;
    const src = svPathsSeg(P, lo, hi, x);
    // (parked or dragged between two planes: the segments on either side, whose paths a scrub across a plane draws
    // next; the deformation re-traces them ahead, off the frame)
    if (!SV.play && !SV.anim) {
      // (svBetween reads SV.span, the glide's run of planes)
      src.aheadKey = SV.span ? `${SV.span.x0},${SV.span.x1}` : '';
      src.near = () => [[lo - 1, lo], [hi, hi + 1]].filter(([l, h]) => l >= 0 && h <= n && !derivIn(P[l], P[h])).map(([l, h]) => svPathsSeg(P, l, h, x));
    }
    return src;
  }
  // the source for the planes' run [lo, hi] with the thread at x
  function svPathsSeg(P, lo, hi, x) {
    const start = P[lo];
    // (all at once, the glide is one homotopy over [0, 1] of the whole run, as the classic dock's: its time is the run's share)
    const all = hi - lo > 1 && !!SV.span && SV.span.x0 === lo && SV.span.x1 === hi && svAllOk(lo, hi), len = all ? hi - lo : 1;
    return {
      Fat: (T) => svBetween(lo + T * len).F, T: Math.max(0, Math.min(hi - lo, x - lo)) / len, Tend: (hi - lo) / len, seq: !all && hi - lo > 1,
      startId: start === 0,
      key: JSON.stringify(['steps', chainSig[nSteps()], lo, hi, P, all]),
      alive: () => SV.on && S.morphPaths !== false, side: 'L', nogo: () => [], win: (pane) => (start === 0 ? pane.box() : clipWin),
    };
  }
  const svColourMap = (k) => (k === 0 ? stageMap(svT()) : { mode: 0, a: k, b: svT() });
  // The colour carried by the points: a grid over plane s's window (the camera's, half again as wide), each vertex
  // painted by where it lands in the colour plane, G = f_T ∘ … ∘ f_{s+1} (its phase, the Arg pattern of the
  // pre-mapped meshes, which reads (ln |G|, arg G) from the vertex), and placed where posF takes it. So the colour
  // travels with the points along a deformation, and a plane past the colour plane shows the colour plane's colours
  // pushed forward. Into the 2D context cc; false when a d/dz step is in the way (no map from plane s). The grid, its
  // colours G and its places on plane a (rangeF(s, a)) are kept while the plane, the colour plane, the view and the
  // chain stay (svCarryMemo), so a glide's frame evaluates only the step's homotopy H (null at rest)
  let svCarryMemo = null, svCarryRes = null, svCarryBuf = null;
  // (#439 I) frame: the GL frame the caller composes the colour layer in ({open}); the GPU path draws into it (opening
  // it if need be) and leaves the copy to the caller; the CPU path first copies what it holds into cc
  // the sheet key of the points of plane s carried from plane a (svCarry's and the globe's, svSphereMoving): the window
  // of the camera every plane shares (S.srcView) at the pane's size, and the plan's accumulation set of the map from s
  // to a, as smKeyOf for the forward meshes
  function svCarryKey(pane, s, a) {
    const v = S.srcView, hw = pane.w / 2 / v.s, hy = pane.h / 2 / v.s, R = Math.hypot(hw, hy);
    const plan = a > s ? invPlan(s, a) : null;
    return { win: { x0: v.cx - hw, y0: v.cy - hy, x1: v.cx + hw, y1: v.cy + hy }, R, rs: R * SV_KEY_RS, sing: plan && plan.ok ? invSing(plan) : [] };
  }
  function svCarry(pane, cc, s, a, H, frame) {
    const T = svT();
    if (s > 0 && derivIn(s, T)) return false;
    const v = S.srcView, nx = 160, ny = Math.max(12, Math.round(nx * pane.h / Math.max(1, pane.w)));
    // (#366 F) on the GPU when it can: the grid moved by the glide's map from plane s, each fragment coloured from the
    // colour plane exactly (GLR.drawCarried); the CPU mesh below while its program compiles, or without it
    if (GLR.drawCarried && !/** @type {any} */ (window).__svCpu) {
      const ext = 1.5, hw = pane.w / 2 / v.s * ext, hy = pane.h / 2 / v.s * ext, g = svBetween();
      const map = H ? (g.all ? { mode: 3, a: g.a, b: g.b, t: g.u, base: s } : { mode: 1, base: s, hi: g.b, t: g.u }) : { mode: 0, a: s, b: a };
      const key = svCarryKey(pane, s, a);
      if (!frame || !frame.open) GLR.begin(pane.pw, pane.ph);
      if (GLR.drawCarried({ map, s, T, view: v, dpr: pane.dpr, mesh: { x0: v.cx - hw, y0: v.cy - hy, dx: 2 * hw / nx, dy: 2 * hy / ny, nx, ny }, lim: 0.35 * Math.max(pane.w, pane.h) / v.s, key,
        style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark })) {
        if (frame) frame.open = true; else GLR.blit(cc);
        return true;
      }
    }
    // (the CPU mesh begins a frame of its own: what the caller's frame holds goes into cc first, and the caller composes
    // from cc; a frame that must stay whole (frame.keep, the Inside regions mask) goes on without it while the GPU's
    // program links)
    if (frame && frame.keep) return false;
    if (frame && frame.open) { GLR.blit(cc); frame.open = false; }
    if (frame) frame.cc = true;
    const key = [s, a, T, v.cx, v.cy, v.s, pane.w, pane.h, chainSig[nSteps()]].join('|');
    let m = svCarryMemo;
    if (!m || m.key !== key) {
      const G = s === T ? (z) => z : rangeF(s, T), toA = s === a ? null : rangeF(s, a);
      const ext = 1.5, hw = pane.w / 2 / v.s * ext, hy = pane.h / 2 / v.s * ext, W = (nx + 1) * (ny + 1);
      m = svCarryMemo = { key, ax: new Float64Array(W), ay: new Float64Array(W), gl: new Float64Array(W), ga: new Float64Array(W), ok: new Uint8Array(W) };
      for (let jy = 0; jy <= ny; jy++) for (let ix = 0; ix <= nx; ix++) {
        const p = C(v.cx - hw + 2 * hw * ix / nx, v.cy - hy + 2 * hy * jy / ny), n = jy * (nx + 1) + ix;
        let q, g;
        try { q = toA ? toA(p) : p; g = G(p); } catch (e) { continue; }
        if (!q || !g || !CX.isFin(q) || !CX.isFin(g)) continue;
        m.ax[n] = q.re; m.ay[n] = q.im;
        m.gl[n] = Math.max(-60, Math.log(Math.hypot(g.re, g.im))); m.ga[n] = Math.atan2(g.im, g.re); m.ok[n] = 1;
      }
    }
    // (perf on #448) the mesh is made once per memo: every grid triangle whose corners have a colour, with its colours
    // (arg unwrapped within it), on the GPU; a frame only moves its corners (GLR.updatePreMesh: one upload, no new
    // buffer), and a triangle torn across a cut or a pole, or with a corner H cannot place, collapses to a point. The
    // same frame again (at rest, parked) is drawn as it is
    const fkey = key + '|' + (H ? SV.g.x.toFixed(6) : 'rest');
    if (!m.tris) {
      const K = 16 / TAU, tris = [], attr = [];
      const add = (A, B, D) => {
        if (!m.ok[A] || !m.ok[B] || !m.ok[D]) return;
        const a0 = m.ga[A];
        tris.push(A, B, D);
        for (const n of [A, B, D]) { let t = m.ga[n] - a0; t -= TAU * Math.round(t / TAU); attr.push(0, 0, m.gl[n] * K, (a0 + t) * K); }
      };
      for (let jy = 0; jy < ny; jy++) for (let ix = 0; ix < nx; ix++) {
        const n = jy * (nx + 1) + ix, e = n + 1, u = n + nx + 1, d = u + 1;
        add(n, e, d); add(n, d, u);
      }
      m.tris = Uint32Array.from(tris);
      m.pos = new Float32Array(tris.length * 2);
      m.attr = Float32Array.from(attr);
      if (svCarryRes) { GLR.destroy(svCarryRes.res); svCarryRes = null; }
    }
    const nt = m.tris.length / 3;
    if (!nt) return true;
    let res = svCarryRes && svCarryRes.memo === m && svCarryRes.res.n ? svCarryRes.res : null;
    if (!res || svCarryRes.key !== fkey) {
      const W = (nx + 1) * (ny + 1), lim2 = Math.pow(0.35 * Math.max(pane.w, pane.h) / v.s, 2);
      if (!svCarryBuf || svCarryBuf.W !== W) svCarryBuf = { W, qx: new Float64Array(W), qy: new Float64Array(W), ok: new Uint8Array(W) };
      const { qx, qy, ok } = svCarryBuf, pos = m.pos, T3 = m.tris;
      for (let n = 0; n < W; n++) {
        ok[n] = 0;
        if (!m.ok[n]) continue;
        if (!H) { qx[n] = m.ax[n] - v.cx; qy[n] = m.ay[n] - v.cy; ok[n] = 1; continue; }
        let q;
        try { q = H(C(m.ax[n], m.ay[n])); } catch (e) { continue; }
        if (!q || !CX.isFin(q)) continue;
        qx[n] = q.re - v.cx; qy[n] = q.im - v.cy; ok[n] = 1;
      }
      const d2 = (A, B) => { const dx = qx[A] - qx[B], dy = qy[A] - qy[B]; return dx * dx + dy * dy; };
      for (let t = 0, o = 0; t < nt; t++, o += 6) {
        const A = T3[3 * t], B = T3[3 * t + 1], D = T3[3 * t + 2];
        if (!ok[A] || !ok[B] || !ok[D] || d2(A, B) > lim2 || d2(B, D) > lim2 || d2(D, A) > lim2) { pos.fill(3e7, o, o + 6); continue; }
        pos[o] = qx[A]; pos[o + 1] = qy[A]; pos[o + 2] = qx[B]; pos[o + 3] = qy[B]; pos[o + 4] = qx[D]; pos[o + 5] = qy[D];
      }
      if (res) GLR.updatePreMesh(res, pos);
      else {
        res = GLR.createPreMesh({ n: nt, pos, attr: m.attr, tri: new Float32Array(nt), origin: [v.cx, v.cy], dynamic: true });
        if (!res) return false;
      }
      svCarryRes = { key: fkey, memo: m, res };
    }
    GLR.begin(pane.pw, pane.ph);
    GLR.drawPreMapped(res, { view: v, dpr: pane.dpr, color: [0.5, 0.5, 0.5], alpha: 1, pattern: 'phase', cell: 1, lines: false, sphN: 16 });
    GLR.blit(cc);
    return true;
  }
  // The colour the points carry, by the region tiling's own machinery (the machinery that carries region patterns,
  // applied to colours): Inside regions, each visible region; Everywhere,
  // SV_ALL, the whole plane as one region (the outside of a speck far beyond any view: unbounded, as the tiling's
  // unbounded regions are). Each point z (on plane 0) is coloured with the colour plane's colour of it,
  // dcolor(f_T ∘ … ∘ f_1(z)), wherever the map takes it. Where several points land on one pixel, the one in front is
  // the tiling's own: the one nearest the window's centre, away from the map's poles (Inverse.sheetKey, svSheetKey)
  const SV_ALL = { id: '__svAll', kind: 'disc', c: [1e9, 0], r: 1e-6, complement: true, visible: true };
  // the reason svInvPaths gives when Inside regions has no area shape to draw (a curve, a point: strokes only): nothing
  // region-wise is drawn then, so a glide frame's path reads 'none'
  const SV_NO_AREA = 'no area region to draw';
  // hom: a glide's frame, where a region of plane k holds the points z of plane 0 whose F_{0->k}(z) it holds (the inverse
  // pass tests it there), so the regions of later planes are drawn too. null: a region of a later plane the frame cannot
  // take (at rest, any; in a glide, one behind a d/dz step)
  function svCarryShapes(hom) {
    if (SV.scope !== 'in' || !svMaskOn()) return [SV_ALL];
    const areas = visibleAreas();
    return areas.some((x) => shapeStage(x) && (!hom || derivIn(0, shapeStage(x)))) ? null : areas;
  }
  // the sheet key's parameters for the image on plane b: the region tiling's own (smKeyOf: clipWin, half its diagonal
  // R, R / 8, Inverse.keySing of the map to b; with no inverse plan to b, the window alone), the one key the inverse
  // pass, the pre-mapped meshes and these meshes all order sheets by (Inverse.sheetKey)
  function svSheetKey(b) {
    const k = smKeyOf(stageMap(b));
    if (k) return k;
    const R = Math.hypot(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0) / 2;
    return { win: clipWin, R, rs: R * SV_KEY_RS, sing: [] };
  }
  // The sheet key mid-glide (the map h_{b,t} after the steps before b): plane b's key, and the glide's poles at t, which
  // move with t (a path's pole sweeps across the plane, or flies in from infinity): a point beside one is not in front
  // for being near the centre alone, as beside plane b's poles. Its points: plane b's accumulation set, then plane b's
  // poles and the glide's poles at t, nearest the window first (at most 4 in all, as Inverse.keySing gives them at
  // rest). At t = 1 the glide's poles are plane b's: the key meets plane b's own.
  // The poles are tracked once per glide (the plane and the chain up to it, the windows), in idle moments: SV_POLE_K
  // steps of t, found on a grid over the camera's window (a quarter wider each side, SV_POLE_GRID cells a side) and on a
  // coarser one over the key's window widened by three times its size on each side, at t = 0 and every SV_POLE_SEED
  // steps; each followed from step to step by Newton's method on 1/F (or, where it leaves through a cut, by svPeakAt
  // while the points beside it go past 4 R), and read between two steps by linear interpolation, so the key moves
  // continuously with t. The search is a generator that pauses every SV_POLE_CHUNK evaluations of the map, so a slice of
  // it stops at SV_POLE_BUDGET ms whatever step it is in
  const SV_POLE_K = 64, SV_POLE_SEED = 8, SV_POLE_GRID = 24, SV_POLE_MAX = 8, SV_POLE_TOP = 8;
  const SV_POLE_CHUNK = 16, SV_POLE_BUDGET = 2;
  const svPoleMemo = new Map(), svPoleLast = new Map();
  // a pause of a search: once SV_POLE_CHUNK evaluations (E.n, counted by the map P.Ft gives) ran since the last. The
  // searches may pause at the start of each Newton or peak climb and of each grid, after each of their iterations and
  // every 8 points of a grid, so at most SV_POLE_CHUNK - 1 plus a peak climb's first 9 evaluations run between two
  // pauses: a slice ends within a few evaluations of its time (a map such as zeta's takes tens of µs each)
  function* svPoleTick(E) {
    if (E.n - E.at >= SV_POLE_CHUNK) { E.at = E.n; yield; }
  }
  // a search run to its end at once, through all its pauses: its result
  function svDrain(gen) {
    let r;
    do r = gen.next(); while (!r.done);
    return r.value;
  }
  // Newton's method on h = 1/F from z: a pole of F (h(z) = 0, |F| past 1e8) or null (it left the box or did not settle)
  function* svPoleAt(F, z, box, E) {
    const h = (p) => { const w = F(p); return w && CX.isFin(w) && !CX.isZero(w) ? CX.inv(w) : null; };
    yield* svPoleTick(E);
    for (let i = 0; i < 12; i++) {
      const e = 1e-6 * (1 + CX.abs(z)), h0 = h(z);
      if (!h0) return null;
      if (CX.abs(h0) < 1e-8) return z;
      const hp = h(CX.add(z, C(e, 0))), hm = h(CX.sub(z, C(e, 0)));
      if (!hp || !hm) return null;
      const d = CX.div(CX.sub(hp, hm), C(2 * e, 0));
      if (!CX.isFin(d) || CX.isZero(d)) return null;
      z = CX.sub(z, CX.div(h0, d));
      if (!CX.isFin(z) || z.re < box.x0 || z.re > box.x1 || z.im < box.y0 || z.im > box.y1) return null;
      yield* svPoleTick(E);
    }
    return null;
  }
  // where a pole leaves through a cut (the map continues past it on another branch): from z, the nearest local maximum
  // of |F| (climbing over 8 points about it, its step shrinking), while |F| there is past big; null otherwise. A
  // pole's track continues through it while the points beside it still go far, so the key does not lose it a step of
  // t before it reaches the cut (or gain it a step after)
  function* svPeakAt(F, z, big, E) {
    const m = (p) => { try { const w = F(p); return w && CX.isFin(w) ? CX.abs(w) : Infinity; } catch (e) { return 0; } };
    yield* svPoleTick(E);
    let v = m(z), h = 0.05 * (1 + CX.abs(z));
    for (let i = 0; i < 40 && h > 1e-7 * (1 + CX.abs(z)); i++) {
      let best = null, bv = v;
      for (let a = 0; a < 8; a++) { const p = CX.add(z, C(h * Math.cos(a * Math.PI / 4), h * Math.sin(a * Math.PI / 4))), u = m(p); if (u > bv) { bv = u; best = p; } }
      if (best) { z = best; v = bv; } else h /= 2;
      yield* svPoleTick(E);
    }
    return v > big && v < Infinity ? z : null;
  }
  // a point where F is unbounded without being a pole (the logarithm at 0, a root at a pole of its Möbius step: Newton's
  // method on 1/F reflects about it or crawls): z itself when F is not finite there, else the nearest peak of |F| from z
  // when it is past big and within box; null otherwise (a map that only grows, exp's, has its peak climbed out of the box)
  function* svSingularAt(F, z, big, E, box) {
    let w = null;
    try { w = F(z); } catch (e) { w = null; }
    if (!w || !CX.isFin(w)) return z;
    const p = yield* svPeakAt(F, z, big, E);
    return p && p.re >= box.x0 && p.re <= box.x1 && p.im >= box.y0 && p.im <= box.y1 ? p : null;
  }
  const SV_SING_BIG = 10;
  // the poles of F in box: the local maxima of |F| on an n x n grid over it, each refined (kept while within lim); with
  // sing, a start Newton's method does not settle on and where |F| is past SV_SING_BIG is refined to its singular point
  function* svPolesIn(F, box, n, lim, E, sing = false) {
    const dx = (box.x1 - box.x0) / n, dy = (box.y1 - box.y0) / n, M = [];
    yield* svPoleTick(E);
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        let w = null;
        try { w = F(C(box.x0 + i * dx, box.y0 + j * dy)); } catch (e) { w = null; }
        M.push(w && CX.isFin(w) ? CX.abs(w) : Infinity);
        if (i % 8 === 7) yield* svPoleTick(E);
      }
      yield* svPoleTick(E);
    }
    // (the starts: the grid's local maxima of |F|, and its SV_POLE_TOP points of the largest |F| / (1 + |z - c|), c the
    // box's centre: a map that grows like z far out hides a pole's maximum from a coarse grid, not its ratio)
    const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2, at = (i, j) => C(box.x0 + i * dx, box.y0 + j * dy);
    const starts = [], ratio = [];
    for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) {
      const m = M[j * (n + 1) + i];
      ratio.push([m / (1 + Math.hypot(box.x0 + i * dx - cx, box.y0 + j * dy - cy)), i, j]);
      let top = true;
      for (let b = -1; b <= 1 && top; b++) for (let a = -1; a <= 1; a++) if ((a || b) && M[(j + b) * (n + 1) + i + a] > m) { top = false; break; }
      if (top) starts.push([i, j]);
    }
    ratio.sort((u, v) => v[0] - u[0]);
    for (const [, i, j] of ratio.slice(0, SV_POLE_TOP)) if (!starts.some(([a, b]) => a === i && b === j)) starts.push([i, j]);
    const out = [];
    for (const [i, j] of starts) {
      let p = yield* svPoleAt(F, at(i, j), lim, E);
      if (!p && sing && !(M[j * (n + 1) + i] < SV_SING_BIG)) p = yield* svSingularAt(F, at(i, j), SV_SING_BIG, E, lim);
      if (p && !out.some((q) => CX.abs(CX.sub(p, q)) < 1e-6 * (1 + CX.abs(p)))) out.push(p);
    }
    return out;
  }
  // a seed step's search for P's map F: svPolesIn over the camera's window and the coarse box, the SV_POLE_MAX nearest
  // the key's window's centre
  function* svPolesNear(F, P) {
    const fine = yield* svPolesIn(F, P.win, SV_POLE_GRID, P.box, P.E), coarse = yield* svPolesIn(F, P.box, SV_POLE_GRID / 2, P.box, P.E);
    return fine.concat(coarse).sort((p, q) => CX.abs(CX.sub(p, P.cz)) - CX.abs(CX.sub(q, P.cz))).slice(0, SV_POLE_MAX);
  }
  // the tracks of the glide's poles to plane b for the window w: {tr: [[z or null] x (SV_POLE_K + 1)], k: the next
  // step of t to make}, made by svPoleGen. Keyed by the chain up to plane b (the glide's map is h_{b,t} after the steps
  // before b): an edit after plane b keeps them
  function svPoleTracks(b, w) {
    // (the fine grid over the camera's window, what the view shows, a quarter wider each side: clipWin, kept while the
    // view stays inside it, can be many times larger after a zoom out and back, and its grid's cells too coarse to have
    // a point by a pole that has just come out of a cut)
    const v = S.srcView, hw = 0.75 * paneL.w / v.s, hh = 0.75 * paneL.h / v.s, cam = { x0: v.cx - hw, x1: v.cx + hw, y0: v.cy - hh, y1: v.cy + hh };
    const key = [b, chainSig[b], w.x0, w.x1, w.y0, w.y1, cam.x0, cam.x1, cam.y0, cam.y1].join('|');
    if (svPoleMemo.has(key)) return svPoleMemo.get(key);
    const ex = (f) => ({ x0: w.x0 - f * (w.x1 - w.x0), x1: w.x1 + f * (w.x1 - w.x0), y0: w.y0 - f * (w.y1 - w.y0), y1: w.y1 + f * (w.y1 - w.y0) });
    const Fp = stageF(b - 1), E = { n: 0, at: 0 };
    const P = { key, b, sig: chainSig[b], tr: [], k: 0, gen: null, found: null, seek: null, E, box: ex(3), win: cam, big: 4 * Math.hypot(w.x1 - w.x0, w.y1 - w.y0) / 2, cz: C((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2),
      Ft: (t) => { const H = homF(b, t); return (z) => { E.n++; return H(Fp(z)); }; } };
    if (svPoleMemo.size >= 16) svPoleMemo.clear();
    svPoleMemo.set(key, P);
    return P;
  }
  // P's tracks, step by step of t: each track followed from the step before; at a seed step the poles found there, each
  // new one back-tracked, and a track lost near one bridged to it. A seed step can find a pole the grid missed before (a
  // grid has no point near one that has just come out of a cut), and its back-track changes earlier steps: the tracks
  // are final only once every step is made (P.k past SV_POLE_K). A map that throws leaves no tracks
  function* svPoleGen(P) {
    const { tr, box, big, Ft, E } = P;
    try {
      for (let k = P.k; k <= SV_POLE_K; k++) {
        const F = Ft(k / SV_POLE_K);
        for (const r of tr) r[k] = r[k - 1] ? (yield* svPoleAt(F, r[k - 1], box, E)) || (yield* svPeakAt(F, r[k - 1], big, E)) : null;
        if (k % SV_POLE_SEED === 0) {
          const near = yield* svPolesNear(F, P);
          for (const p of near) {
            if (tr.some((r) => r[k] && CX.abs(CX.sub(r[k], p)) < 1e-6 * (1 + CX.abs(p)))) continue;
            // (a track lost near p is p's: the steps between are bridged on the line from there to p, so the key keeps the
            // pole through them, never dropping it for a step and taking it back)
            const last = (r) => r.findLastIndex((q, i) => q && i < k);
            const old = tr.find((r) => { if (r[k]) return false; const j = last(r); return j >= 0 && CX.abs(CX.sub(r[j], p)) < 0.25 * (1 + CX.abs(p)); });
            if (old) {
              const j = last(old);
              for (let i = j + 1; i <= k; i++) old[i] = CX.add(old[j], CX.mul(C((i - j) / (k - j), 0), CX.sub(p, old[j])));
              continue;
            }
            const r = new Array(SV_POLE_K + 1).fill(null);
            r[k] = p;
            // (and back to where it came into the box, or out of a cut: a pole a seed step finds has its track at the steps before it too)
            for (let j = k - 1; j >= 0 && r[j + 1]; j--) { const G = Ft(j / SV_POLE_K); r[j] = (yield* svPoleAt(G, r[j + 1], box, E)) || (yield* svPeakAt(G, r[j + 1], big, E)); }
            tr.push(r);
          }
        }
        P.k = k + 1;
      }
    } catch (e) { tr.length = 0; P.k = SV_POLE_K + 1; }
  }
  // gen run for at most ms (checked at its pauses): its last result ({done, value}). kind 'idle' or 'frame': counted in
  // __svPathStats where a measurement sets that object (the slices, the longest slice's ms, the most evaluations
  // between two pauses, and the idle slices' steps of t made)
  function svPoleRun(gen, E, ms, kind, P) {
    const t0 = performance.now(), k0 = P ? P.k : 0;
    let r, most = 0;
    for (;;) {
      const n0 = E.n;
      r = gen.next();
      most = Math.max(most, E.n - n0);
      if (r.done || performance.now() - t0 >= ms) break;
    }
    const ps = globalThis.__svPathStats, dt = performance.now() - t0;
    if (ps && kind) {
      const K = kind === 'idle' ? 'poleIdle' : 'poleFrame';
      ps[K] = (ps[K] || 0) + 1;
      ps[K + 'Max'] = Math.max(ps[K + 'Max'] || 0, dt);
      if (P) ps[K + 'Steps'] = (ps[K + 'Steps'] || 0) + P.k - k0;
      ps.poleChunk = Math.max(ps.poleChunk || 0, most);
    }
    return r;
  }
  // every glide's pole tracks forgotten, as right after load (a test hook's)
  function svDropTracks() { svPoleMemo.clear(); svPoleLast.clear(); svPolesWatch(); }
  // P's tracks made for at most ms; once whole, they are plane b's last whole tracks (svPoleLast)
  function svPoleMake(P, ms, kind) {
    if (P.k > SV_POLE_K) return;
    if (!P.gen) P.gen = svPoleGen(P);
    svPoleRun(P.gen, P.E, ms, kind, P);
    if (P.k > SV_POLE_K) svPoleLast.set(P.b, P);
  }
  // the poles near t of P's map while its tracks are not whole: a seed step's search at the tracks' seed step nearest t
  // (at most SV_POLE_K / SV_POLE_SEED + 1 searches a glide, those the whole tracks make anyway), SV_POLE_BUDGET ms of it
  // a frame, kept while t stays nearest it; until it is done, the last one done (none at first). Its frames' time is
  // counted in __svPathStats.poleSyncMs, its searches in poleSync, where a measurement sets that object
  function svPolesNow(P, t) {
    const j = Math.min(SV_POLE_K, Math.round(t * SV_POLE_K / SV_POLE_SEED) * SV_POLE_SEED);
    if (P.found && P.found.j === j) return P.found.poles;
    const ps = globalThis.__svPathStats, t0 = performance.now();
    if (!P.seek || P.seek.j !== j) {
      P.seek = { j, gen: (function* () { try { return yield* svPolesNear(P.Ft(j / SV_POLE_K), P); } catch (e) { return []; } })() };
      if (ps) ps.poleSync = (ps.poleSync || 0) + 1;
    }
    const r = svPoleRun(P.seek.gen, P.E, SV.poleFrameMs || SV_POLE_BUDGET, 'frame', null);
    if (r.done) { P.found = { j, poles: r.value }; P.seek = null; }
    if (ps) ps.poleSyncMs = (ps.poleSyncMs || 0) + performance.now() - t0;
    return P.found ? P.found.poles : [];
  }
  // svHoldB: plane b when the left pane's last frame held the glide into b for its missing tracks (svLinkHold), else 0: each
  // frame starts it at 0 (svDrawPlane), so a frame at rest, on the globe or of the classic core leaves no hold behind
  let svHoldB = 0;
  // the first glide whose tracks for the current windows are not whole, null when all are (the key's window is clipWin,
  // as svSheetKey gives it, without its singular points)
  // (the glide held by svLinkHold for its missing tracks comes first)
  function svPolesLeft() {
    const n = nSteps();
    for (const b of svHoldB ? [svHoldB] : []) if (b <= n && !derivIn(b - 1, b)) { const P = svPoleTracks(b, clipWin); if (P.k <= SV_POLE_K) return P; }
    for (let b = 1; b <= n; b++) {
      if (derivIn(b - 1, b)) continue;
      const P = svPoleTracks(b, clipWin);
      if (P.k <= SV_POLE_K) return P;
    }
    return null;
  }
  // Whether the frames of the glide into plane b are drawn from pole tracks that are not made: its inverse paths h have a
  // Newton member (the poles it needs are plane b's tracks') and neither these tracks nor plane b's last whole ones
  // (svSheetKeyAt) exist
  function svTracksMissing(b, h) {
    if (!(h && h.paths.some((p) => p.plan.ops.some((o) => o.kind === 'NEWT')))) return false;
    const P = svPoleTracks(b, svSheetKey(b).win), L = svPoleLast.get(b);
    return P.k <= SV_POLE_K && !(L && L.sig === chainSig[b]);
  }
  // The idle job: every glide's pole tracks for the current windows, then the outer ring's sizes of the glides beside
  // the plane (svRingAhead), SV_POLE_BUDGET ms an idle moment at most, so a glide finds them made. One job at a time
  // (svPoleJob, its token: a new one ends the one before); it reads its inputs (the chain, clipWin, the camera) afresh
  // each slice, and svPolesWatch starts it again once they change after it ended
  let svPoleJob = 0, svPoleBusy = false;
  function svPolesAhead() {
    const tok = ++svPoleJob;
    svPoleBusy = true;
    const ric = window.requestIdleCallback, idle = (f) => (ric ? ric.call(window, f, { timeout: 2000 }) : setTimeout(() => f(null), 100));
    const next = (dl) => {
      if (tok !== svPoleJob) return;
      const t0 = performance.now();
      const left = () => Math.min(SV_POLE_BUDGET - (performance.now() - t0), dl ? dl.timeRemaining() : SV_POLE_BUDGET);
      try {
        while (left() > 0) {
          const P = svPolesLeft();
          if (P) { svPoleMake(P, left(), 'idle'); if (P.k > SV_POLE_K && svHoldB === P.b) { svHoldB = 0; requestRender('L'); } }
          else if (!svRingAhead(left()) && !svMeshAhead(left())) break;
        }
        if (svPolesLeft() || svRingLeft() || svMeshNext()) { idle(next); return; }
      } catch (e) { /* (a map that cannot be evaluated: nothing more to make) */ }
      svPoleBusy = false;
    };
    idle(next);
  }
  // the idle job started again where its inputs changed since it ended (a frame of the view calls it)
  function svPolesWatch() {
    if (!svPoleBusy && (svPolesLeft() || svRingLeft() || svMeshNext())) svPolesAhead();
  }
  // the key of the glide's frame at t in (0, 1) to plane b (svSheetKey(b) at rest)
  function svSheetKeyAt(b, t) {
    const k = svSheetKey(b);
    if (!(t > 0 && t < 1)) return k;
    const plan = invPlan(0, b);
    let acc = [];
    try { acc = plan && plan.ok ? Inverse.accumulation(plan, k.win) : []; } catch (e) { acc = []; }
    // (this glide's tracks once they are whole; until then (a glide at once after an edit or a change of view, before
    // the idle moments made them), the plane's last whole tracks, for other windows (they find the same poles where the
    // windows overlap); with none, the poles a seed step finds at t itself: the same search, without the tracks through
    // a cut. No tracks are made in a frame)
    const s = t * SV_POLE_K, i = Math.min(SV_POLE_K - 1, Math.floor(s)), f = s - i;
    let P = svPoleTracks(b, k.win), at = null;
    if (P.k <= SV_POLE_K) {
      svPolesWatch();
      const L = svPoleLast.get(b);
      if (L && L.sig === chainSig[b]) P = L;
      else at = svPolesNow(P, t);
    }
    const cz = C((k.win.x0 + k.win.x1) / 2, (k.win.y0 + k.win.y1) / 2), near = (p, q) => CX.abs(CX.sub(p, q)) < 1e-9 * (1 + CX.abs(p));
    const poles = (k.sing || []).filter((p) => !acc.some((q) => near(p, q)));
    const add = (p) => { if (p && !acc.some((q) => near(p, q)) && !poles.some((q) => near(p, q))) poles.push(p); };
    if (at) at.forEach(add);
    else {
      for (const r of P.tr) {
        add(r[i] && r[i + 1] ? CX.add(r[i], CX.mul(C(f, 0), CX.sub(r[i + 1], r[i]))) : r[i] || r[i + 1]);
      }
    }
    poles.sort((p, q) => CX.abs(CX.sub(p, cz)) - CX.abs(CX.sub(q, cz)));
    return Object.assign({}, k, { sing: acc.concat(poles).slice(0, 4) });
  }
  // (an: the chain up to plane T analytic, as the F tile and the Inspector read it, so the colour's footprint across a
  // pixel gives the one down it)
  const svCarryStyle = (T) => ({ s: 0, T, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark,
    an: Funcs.composeProps(activeSteps().filter((k) => k <= T).map((k) => built[k - 1].props)).analytic });
  // The shapes list (svCarryShapes) of the carried colour and their inverse paths: each pixel is coloured by the front point
  // z of plane 0 that lands on it, in the colour dcolor(F_T(z)). At rest on plane b (u null) through the map into b (pathOf,
  // kind 'flat' or 'globe'); between planes through step b's homotopy at u (invHomPath). {list, paths}, or null with why.r
  // the first reason unless every shape takes that path; with why.rest an array (at rest, shapes listed one by one), the shapes
  // that do not are put in it and left out of the lists
  function svInvPaths(b, u, kind, why) {
    const hom = u != null, list = svCarryShapes(hom);
    if (!list || !list.length) { why.r = list ? SV_NO_AREA : hom ? 'a region of a plane behind a d/dz step' : 'a region of a later plane'; return null; }
    if (!GLR.drawInverse || !GLR.packShapes) { why.r = 'no inverse renderer'; return null; }
    if (derivIn(0, b)) { why.r = 'a d/dz step'; return null; }
    const recs = packRecs(list.includes(SV_ALL) ? [SV_ALL] : [], hom);
    const singAt = () => svSheetKeyAt(b, u).sing;
    // (a region of a later plane takes the whole plane's path: its test is in the pass, not in the path's preparation)
    let whole = null;
    // (a plane at rest whose step has no exact inverse is drawn as the glide's last frame is: the homotopy's inverse at t = 1)
    const restHom = () => svSheetKey(b).sing;
    const viaHom = (x, t, sing) => (shapeStage(x) ? whole || (whole = invHomPath(SV_ALL, 0, b, t, sing)) : invHomPath(x, 0, b, t, sing));
    const paths = list.map((x) => {
      if (hom) return viaHom(x, u, singAt);
      const p = pathOf(x, stageMap(b), 'L', kind, { recs, budget: false, stepsRest: true });
      // (only a step with no exact inverse falls back; a path still compiling or forced forward stays as it is. The exactImages switch is not read here: a plane at rest is the exact pass's)
      const m = normalizeMap(stageMap(b));
      if (p.path !== 'forward' || invPlan(m.a || 0, m.b || 0).ok) return p;
      const q = viaHom(x, 1, restHom);
      return q.path === 'inverse' ? q : p;
    });
    const part = why.rest && !hom && !list.includes(SV_ALL);
    if (part) {
      for (let i = list.length - 1; i >= 0; i--) if (paths[i].path !== 'inverse') { why.rest.unshift(list[i]); list.splice(i, 1); paths.splice(i, 1); }
    }
    const no = paths.find((p) => p.path !== 'inverse');
    if (no) { why.r = no.reason; return null; }
    // (Everywhere asks for the front one of all of H_t's points over w. A homotopy inverted by Newton finds them all only
    // when its step's own exact ops seed walks back from t = 1 (InvOps.opNewt's back); without them it finds two, so
    // that frame keeps the carried mesh)
    if (u != null && list.includes(SV_ALL) && paths.some((p) => p.plan.ops.some((o) => o.kind === 'NEWT' && !(o.p && (o.p.back || o.p.deg))))) { why.r = 'Everywhere under a Newton inverse with neither seeds nor every root'; return null; }
    return { list, paths };
  }
  // The steps view's colour opacity (the Opacity slider; read through regionLook, which the regions' mask passes keep
  // at the slider's value): how much the layers behind show through where the picture covers a point more than once.
  // The farthest layer stays opaque, so a point covered once keeps its colour
  const SV_OPACITY_MIN = 0.3;
  const svOpacity = () => Math.max(SV_OPACITY_MIN, regionLook().alpha);
  // the look of a carried fill whose own opacity is base: full-opacity fills take the slider's, a dimmed one (a pulled-back
  // shape) keeps its own and draws every layer at it
  // The opacity of a carried layer, and the opacity its buffer size is chosen for: base is the fill's own (1, or less for a
  // pulled-back shape); glide is {b, u} for a frame of step b's glide at u. With the sheets off a glide frame of the whole
  // plane starts as the colour plane T looks (the front member alone, opacity 1) and ends as a plane past T looks (the
  // slider's opacity): from plane T it goes from 1 to the slider's, linear in u; from a plane before T it is 1, from a
  // plane past T the slider's. A frame at rest, All sheets and a shape's own layers take the slider's.
  const svCarryAlpha = (base, shape, glide, T) => {
    if (base < 1) return { alpha: base, alphaOwn: base };
    const slider = svOpacity();
    if (shape !== SV_ALL || S.sheets || !glide) return { alpha: slider, alphaOwn: slider };
    const a = glide.b - 1;
    if (a < T) return { alpha: 1, alphaOwn: 1 };
    return { alpha: a === T ? 1 + (slider - 1) * glide.u : slider, alphaOwn: slider };
  };
  const svCarryLook = (base, shape, glide, T) => Object.assign(svCarryAlpha(base, shape, glide, T), { lastOpaque: base >= 1, pattern: 'carry', cell: 1, lines: false });
  // drawInverse's arguments (without the view) for one shape's inverse path p. alphaOf(shape): the opacity of its fill; edgeOf(shape): {w, a, ...} draws its boundary band alone (GLR.drawInverse's edge);
  // a shape of a later plane drawn as a fill is grown by half the band's width plus half a pixel, so the colour reaches as far
  // as the band's outer edge
  const svInvArg = (pane, p, shape, carry, alphaOf, edgeOf, glide) => {
    return { map: p.m, plan: p.plan, prep: p.prep, inv: p.inv, shape, dpr: pane.dpr, look: svCarryLook(alphaOf ? alphaOf(shape) : 1, shape, glide, carry.T),
      carry, edge: edgeOf ? edgeOf(shape) : null, grow: shapeStage(shape) && !edgeOf ? 0.5 * pullBandW(shape, pane.dpr) + 0.5 : 0, half: false, motion: false, coldOk: true };
  };
  // At rest on plane a past the colour plane T: exactly, by the tiling's inverse pass (GLR.drawInverse, its carried
  // colour variant): at each pixel w of plane a, the shapes' points z with F_a(z) = w, the front one's colour, so the
  // colour is the points' own wherever they reach, with no grid, no window and no stray sheet. Into the open GL frame
  // (opened if need be). False (nothing more drawn) unless every shape takes that path: a region of a later plane, a
  // map with no inverse, a program still compiling
  function svCarryExact(pane, a, T, frame) {
    const h = a > T ? svInvPaths(a, null, 'flat', { r: null }) : null;
    // (a path of the homotopy's inverse at t = 1, which has a NEWT op: its roots pass runs at t = 1)
    const nt = !!h && h.paths.some((p) => p.plan.ops.some((o) => o.kind === 'NEWT'));
    return !!h && (nt ? svDrawInverse(pane, h.list, h.paths, T, frame, 1, null, null, a) : svDrawInverse(pane, h.list, h.paths, T, frame)) === 'drawn';
  }
  // the carried colour of the shapes list by their inverse paths (all 'inverse'; a path's inv: its own inverse program),
  // into the GL frame gl ({ open }, opened if need be): 'drawn', else the first draw's GLR.drawInverse answer that was
  // not ('error' when it threw). A shape drawn already stays: the next path draws over it
  // t (a glide's frame): the homotopy's t, for the NEWT roots pass (GLR.newtRoots: when the plan's first inverted op is a
  // NEWT op, its members for every pixel, drawn once for all the shapes and seeded from the previous frame's)
  // (alphaOf, edgeOf: svInvArg's)
  function svDrawInverse(pane, list, paths, T, gl, t, alphaOf, edgeOf, b) {
    const carry = svCarryStyle(T), p0 = paths[0];
    let nr = 0;
    if (t != null && p0 && p0.inv && p0.inv.nr && GLR.newtRoots) {
      try {
        const r = GLR.newtRoots({ map: p0.m, plan: p0.plan, prep: p0.prep, inv: p0.inv, view: pane.view, dpr: pane.dpr, pw: pane.pw, ph: pane.ph, t });
        if (r.state === 'drawn') nr = r.token;
      } catch (e) { console.error('steps view NEWT roots', e); }
    }
    if (!gl.open) { GLR.begin(pane.pw, pane.ph); gl.open = true; }
    for (let i = 0; i < list.length; i++) {
      let res = 'error';
      try {
        res = GLR.drawInverse(Object.assign({ viewKind: 'flat', view: pane.view }, svInvArg(pane, paths[i], list[i], carry, alphaOf, edgeOf, t != null ? { b, u: t } : null), { nr }));
      } catch (e) {
        // (a throw answers 'error': the caller draws the frame by the carried mesh, and the glide's record names why)
        console.error('steps view carried colour', e);
      }
      if (res !== 'drawn') return res;
    }
    return 'drawn';
  }
  // A frame between planes a and b as svCarryExact draws a plane: per pixel, by the inverse pass, the front point z of
  // plane 0 with H_u(F_{b-1}(z)) = w (invHomPath: step b's homotopy at u inverted by its own ops), in the colour
  // dcolor(F_T(z)). So the glide shows the exact picture of the map at u, which meets each plane's own at u = 0 and 1.
  // Into the open GL frame. False (nothing drawn) unless every shape takes that path; why: the first reason not
  function svCarryExactHom(pane, b, u, T, frame, why) {
    const h = svHomMemo && svHomMemo.b === b && svHomMemo.u === u ? svHomMemo.h : svInvPaths(b, u, 'flat', why);
    if (!h) { if (svHomMemo && svHomMemo.b === b && svHomMemo.u === u) why.r = svHomMemo.why.r; return false; }
    const res = svDrawInverse(pane, h.list, h.paths, T, frame, u, null, null, b);
    if (res !== 'drawn') { why.r = 'inverse pass ' + res; return false; }
    return true;
  }
  // A glide frame between planes whose step the inverse pass draws, while that pass's program still links, and once it
  // is linked, while the pole tracks the glide's frames are drawn from are not made (svTracksMissing): the glide waits
  // on the plane it started from (a glide's or a play's clock starts again there; a scrub's frame is that of the plane
  // before the thread), so no frame between the planes is the carried mesh's or one drawn without its tracks, and the
  // first one drawn is exact. After it svHoldB is plane b when the glide waits for the tracks, else 0; such a wait also
  // starts the idle job (svPolesWatch), which makes plane b's tracks first (svPolesLeft)
  // -> the place to draw instead of the thread's, or null (draw the thread's)
  // (the paths it builds are kept in svHomMemo for the frame's svCarryExactHom, which asks for the same b and u)
  let svHomMemo = null;
  function svLinkHold() {
    svHomMemo = null;
    const g = svBetween();
    if (g.u <= SV_REST_U || g.all || g.b === g.a || g.map.mode !== 1 || isDeriv(g.b) || !GLR.inverseState) return null;
    const why = { r: null }, h = svInvPaths(g.b, g.u, 'flat', why);
    svHomMemo = { b: g.b, u: g.u, h, why };
    const linking = !!h && h.paths.some((p, i) => GLR.inverseState({ map: p.m, plan: p.plan, prep: p.prep, inv: p.inv, viewKind: 'flat', look: svCarryLook(1), carry: true, staged: shapeStage(h.list[i]) > 0 }) === 'pending');
    svHoldB = !linking && svTracksMissing(g.b, h) ? g.b : 0;
    if (svHoldB) svPolesWatch();
    if (!linking && !svHoldB) return null;
    const A = SV.anim || (SV.play && !SV.play.slide ? SV.play : null);
    if (A) { A.t0 = performance.now(); A.el = 0; A.e0 = 0; SV.g.set(A.from); requestRender('L'); return A.from; }
    return g.x0;
  }
  // the last frame between two planes: {b, u, path: 'inverse' | 'mesh', reason (why not inverse), key(z): the inverse
  // pass's sheet key of a point of plane 0, H: the map of that frame (H_u o F_{b-1}), Hb: the glide's homotopy alone
  // (H_u on the glide's first plane), view, w, h (the pane's css size)}
  // (read by the test hooks)
  let svGlideRec = null;
  // (the last plane at rest past the colour plane: { a, path: 'inverse' | 'mesh' }, how its colour was drawn)
  let svRestRec = null;
  const SV_CARRY_L = 2;
  // Everywhere, the points the view needs from past the whole plane's mesh (it covers clipWin, about the camera's
  // window): where the map pulls far points into the view (the edge of clipWin lands in it), a coarse annulus about
  // clipWin's centre, from its inscribed circle out to m times its half-diagonal: the least m of SV_RING_M whose circle
  // the map sends past the view (a tenth wider), the largest when none does, the least when the map cannot be sampled.
  // Its cells are coarser than the whole plane's (SV_RING_BASE a side over its box): the map is near the camera's
  // window's own there, and the cells beside a pole, where it is not, are the whole plane's. Where those do not hold the
  // view's points (a circle a whole-plane cell across about the singular point c of plane b's key nearest the window
  // lands in the view, as about a logarithm's branch point), or no ring does (the largest lands in it), a polar annulus
  // in place of the ring (svPolarGPU): about c (else clipWin's centre), out to the least R 2^k about it that lands past
  // the view and in to the least R 2^-k (without c, clipWin's inscribed circle). Drawn in the same depth
  // under the same key, its corners over the whole plane's mesh are the same points in the same colour. m is the glide's
  // at its nearest twentieth (svRingSize), kept while the planes, the window, the view and that twentieth stay
  // (svRingSizes): made ahead in idle moments for the glides into and out of the plane the thread is at (svRingAhead),
  // else in the frame. A number: the ring's size; null: none needed; {polar: true, c, k1, k2, ring}: the polar annulus
  // while gliding, the ring of size ring
  // (null: none) parked
  const SV_RING_M = [1.5, 2, 3, 4], SV_RING_N = 128, SV_RING_BASE = 40;
  const SV_RING = { id: '__svRing', kind: 'annulus', c: [0, 0], r1: 1, r2: 2, visible: true };
  // (the sizes kept: 21 a glide, two glides beside the plane, so 400 holds those of about nine views or windows; each
  // is a number, and a full table is dropped whole)
  const SV_RING_SIZES_MAX = 400;
  const svRingSizes = new Map();
  let svRingMemo = null, svRingJob = null;
  // the key of m at the twentieth q of the glide g (svBetween's) for the view v of a pw x ph pane
  const svRingKey = (g, q, v, pw, ph) => { const w = clipWin; return [g.a, g.b, g.all ? 1 : 0, q, w.x0, w.x1, w.y0, w.y1, v.cx, v.cy, v.s, pw, ph, chainSig[nSteps()]].join('|'); };
  // m at the twentieth q of the glide g (null: no ring): a generator that pauses every 8 points
  function* svRingSize(g, q, v, pw, ph) {
    const gq = svBetween(g.x0 + q / 20 * (g.x1 - g.x0), g.all ? { x0: g.x0, x1: g.x1 } : null), w = clipWin;
    const hw = 0.55 * pw / v.s, hh = 0.55 * ph / v.s;
    const past = (z) => { const p = gq.F(z); return !p || !CX.isFin(p) || Math.abs(p.re - v.cx) > hw || Math.abs(p.im - v.cy) > hh; };
    const cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2, ax = (w.x1 - w.x0) / 2, ay = (w.y1 - w.y0) / 2, R = Math.hypot(ax, ay);
    // (the edge of the box: 4 sides of SV_RING_N / 4 points; a circle of radius r: SV_RING_N points)
    const side = (i) => { const f4 = 4 * i / SV_RING_N, k = Math.floor(f4), f = 2 * (f4 - k) - 1; return k === 0 ? C(cx + ax * f, cy - ay) : k === 1 ? C(cx + ax, cy + ay * f) : k === 2 ? C(cx - ax * f, cy + ay) : C(cx - ax, cy - ay * f); };
    const about = (o, r) => (i) => C(o.re + r * Math.cos(2 * Math.PI * i / SV_RING_N), o.im + r * Math.sin(2 * Math.PI * i / SV_RING_N));
    const all = function* (fn) {
      for (let i = 0; i < SV_RING_N; i++) {
        if (!past(fn(i))) return false;
        if (i % 8 === 7) yield;
      }
      return true;
    };
    let m = null;
    try {
      // (the singular point of plane b's key nearest clipWin's centre, within R of its box: the polar mesh's centre)
      let c = null;
      for (const p of svSheetKey(g.b).sing || []) if (p && CX.isFin(p) && p.re > w.x0 - R && p.re < w.x1 + R && p.im > w.y0 - R && p.im < w.y1 + R) { c = p; break; }
      // (the cells beside c are the whole plane's, a cell of its mesh across: they hold the view's points unless the
      // circle of that radius about c lands past the view)
      // (ring: the ring's size, which a parked map draws in place of the polar ring; fits: one of its sizes, or none,
      // does)
      let ring = null, fits = true;
      if (!(yield* all(side))) {
        ring = SV_RING_M[SV_RING_M.length - 1]; fits = false;
        for (const x of SV_RING_M) if (yield* all(about(C(cx, cy), x * R))) { ring = x; fits = true; break; }
      }
      const deep = c && !(yield* all(about(c, (w.x1 - w.x0) / 80)));
      if (!deep && fits) return ring;
      const o = c || C(cx, cy);
      // (outward: the least k with the circle of radius R 2^k about o past the view; inward from c: the least k with
      // that of R 2^-k, down to where float32 places the points relative to c; without c, the inscribed circle)
      // (each rounded out to a multiple of SV_POLAR_KQ, so a glide's twentieths share a few meshes)
      const kq = (k, K) => Math.min(K, Math.ceil(k / SV_POLAR_KQ) * SV_POLAR_KQ);
      const k2 = kq(yield* svLeastK((k) => all(about(o, R * Math.pow(2, k))), SV_POLAR_KOUT), SV_POLAR_KOUT);
      let k1 = null;
      if (c) {
        // (or where the circle's points land within a pixel of each other: the disc inside it is one point of the view,
        // as a power's about 0 is)
        const floor = Math.max(1e-36, 1e-6 * CX.abs(c));
        const inner = function* (k) {
          const fn = about(c, R * Math.pow(2, -k));
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, far = true;
          for (let i = 0; i < SV_RING_N; i++) {
            const p = gq.F(fn(i));
            if (p && CX.isFin(p)) {
              x0 = Math.min(x0, p.re); x1 = Math.max(x1, p.re); y0 = Math.min(y0, p.im); y1 = Math.max(y1, p.im);
              if (Math.abs(p.re - v.cx) <= hw && Math.abs(p.im - v.cy) <= hh) far = false;
            }
            if (i % 8 === 7) yield;
          }
          return far || (x1 >= x0 && Math.max(x1 - x0, y1 - y0) * v.s < 1);
        };
        const K1 = Math.max(1, Math.floor(Math.log2(R / floor)));
        k1 = kq(yield* svLeastK(inner, K1), K1);
      }
      m = { polar: true, c: [o.re, o.im], k1, k2, ring };
    } catch (e) { m = SV_RING_M[0]; }
    return m;
  }
  // the least k in [0, K] whose test passes (a generator of the test's own), the tests taken to pass from some k on: by
  // doubling, then halving the last gap; K when none does
  function* svLeastK(test, K) {
    if (yield* test(0)) return 0;
    let no = 0, yes = 1;
    while (yes < K && !(yield* test(yes))) { no = yes; yes = Math.min(K, 2 * yes); }
    if (yes >= K && !(yield* test(K))) return K;
    while (yes - no > 1) { const mid = (no + yes) >> 1; if (yield* test(mid)) yes = mid; else no = mid; }
    return yes;
  }
  function svRingSet(key, m) {
    if (svRingSizes.size >= SV_RING_SIZES_MAX) svRingSizes.clear();
    svRingSizes.set(key, m);
  }
  function svRingFor(pane, map) {
    const g = svBetween(), v = pane.view, q = Math.round(g.u * 20), sk = svRingKey(g, q, v, pane.w, pane.h), key = sk + '|' + (map.mode || 0);
    if (svRingMemo && svRingMemo.key === key) return svRingMemo.ring;
    let m = svRingSizes.get(sk);
    if (m === undefined) {
      const gen = svRingSize(g, q, { cx: v.cx, cy: v.cy, s: v.s }, pane.w, pane.h);
      let r;
      do r = gen.next(); while (!r.done);
      m = r.value;
      svRingSet(sk, m);
      const ps = globalThis.__svPathStats;
      if (ps) ps.ringFrame = (ps.ringFrame || 0) + 1;
    }
    // (a parked map draws the ring: its fix-ups and pre-mapped meshes refine the whole plane's mesh, not the polar ring's)
    const ring = svRingShape(m && m.polar && !map.mode ? m.ring : m);
    svRingMemo = { key, ring, m };
    return ring;
  }
  // the outer ring of size m about clipWin, null for none (a shape of its own for each m: the rings of a glide's sizes
  // keep their meshes, not one rebuilt at each change); a polar size {polar: true, c, k1, k2}: the polar annulus about c from
  // R 2^-k1 (k1 null: clipWin's inscribed circle) to R 2^k2, R clipWin's half-diagonal (polar: true; sing: about a
  // singular point, k1 not null)
  function svRingShape(m) {
    const w = clipWin, cx = (w.x0 + w.x1) / 2, cy = (w.y0 + w.y1) / 2, ax = (w.x1 - w.x0) / 2, ay = (w.y1 - w.y0) / 2, R = Math.hypot(ax, ay);
    if (m && m.polar) {
      const r1 = m.k1 === null ? Math.min(ax, ay) : R * Math.pow(2, -m.k1);
      return Object.assign({}, SV_RING, { id: [SV_RING.id, 'polar', m.c[0], m.c[1], r1, m.k2, R].join('|'), polar: true, sing: m.k1 !== null, c: m.c.slice(), r1, r2: R * Math.pow(2, m.k2) });
    }
    return m ? Object.assign({}, SV_RING, { id: SV_RING.id + '|' + m, c: [cx, cy], r1: Math.min(ax, ay), r2: m * R }) : null;
  }
  // the ring's mesh (shapeGPU at the ring's base, over its own box; no strokes: the ring has no edge drawn); a polar
  // ring's, svPolarGPU
  const svRingGPU = (ring) => (ring.polar ? svPolarGPU(ring) : shapeGPU(ring, { base: SV_RING_BASE, lines: false, win: { x0: ring.c[0] - ring.r2, x1: ring.c[0] + ring.r2, y0: ring.c[1] - ring.r2, y1: ring.c[1] + ring.r2 } }));
  // The polar annulus's mesh: cells uniform in log r and in angle about its centre c (SV_POLAR_NT a turn, as many a
  // radian of log r), the points the view needs from where the map pulls in what lies very near c or very far from it
  // (a logarithm's points down to e^-|w| / u, a glide's straight line's out to |w| / (1 - u)): every cell is about as
  // round in the map's picture as on the plane, whatever its radius. Its seam, the edge between its first and its last
  // column of cells, is the ray from c at angle pi, a hair either side (SV_POLAR_EPS), the principal cut of a logarithm
  // or a root about c: no cell straddles it. Relative to c (meshInstances' origin), so float32 keeps its points near c.
  // Kept by id in svPolarRes, at most SV_POLAR_KEEP, the oldest dropped first: {meshRes, NR rings, NT cells a ring, dl
  // the log of a ring's ratio}; svPolarBuilds counts the builds
  // (SV_POLAR_BEHIND: the ring's depth offset, in polygonOffset units, about a step of the sheet key (2^-24 a unit):
  // where the ring and the whole plane's mesh overlap along their shares' edge, the whole plane's finer cells are in
  // front, not whichever mesh's placement lands nearer, which would speckle a colour band's edge)
  const SV_POLAR_BEHIND = 16384;
  const SV_POLAR_NT = 48, SV_POLAR_EPS = 1e-6, SV_POLAR_KOUT = 40, SV_POLAR_KQ = 4, SV_POLAR_KEEP = 12;
  const svPolarRes = new Map();
  let svPolarBuilds = 0;
  // Under a polar ring the whole plane's mesh and the ring's share the plane, each where its cells are the finer, so
  // no point is drawn twice by two meshes that place it differently (in the same depth, the worse one's straight edges
  // would cut into the other's picture): the whole plane's inside clipWin, where its cells are uniform, h across
  // (clipWin's larger side / 80), and, about a singular point c the ring reaches in to past rho - h, outside the disc
  // of radius rho = h (SV_POLAR_NT / 2 pi - 1) about it, a cell inside the radius within which the ring's cells are the
  // finer (beside a logarithm's branch point a whole-plane cell spans radii the map sends far apart); the ring's
  // everywhere else. The whole plane's keeps the triangles wholly in its share (one that reaches past clipWin is a
  // stretched outer cell, placed worse than the ring's), the ring every cell that reaches within 2h of the ring's share
  // (a corner outside clipWin shrunk by 2h, or within rho + 2h of c), so the two overlap along the edge, the ring's
  // drawn behind there (SV_POLAR_BEHIND).
  // svPolarShare: the radius rho about the ring's centre (0: none)
  function svPolarShare(ring) {
    const w = clipWin, h = Math.max(w.x1 - w.x0, w.y1 - w.y0) / 80, rho = h * SV_POLAR_NT / (2 * Math.PI) - h;
    return { h, rho: ring.sing && ring.r1 < rho - h ? rho : 0 };
  }
  // the whole plane's mesh r's skip flags under the polar ring: {skip, extra}, extra those of its fix-up fx's refined
  // pieces (null without them; the triangles fx leaves out are left out too). Kept per mesh (r.polarSkip)
  function svPolarSkip(r, ring, fx) {
    if (!r.mesh || !GLR.createSkip) return null;
    const w = clipWin, { rho } = svPolarShare(ring);
    const base = fx && fx.res && fx.res.flags && fx.res.flags.length === r.mesh.tri.length / 3 ? fx.res.flags : null;
    const ex = fx && fx.extraRes && fx.res && fx.res.extra ? fx.res.extra : null;
    const key = [r.meshKey, ring.c[0], ring.c[1], rho, w.x0, w.x1, w.y0, w.y1, base || ex ? fx.mapKey : ''].join('|');
    let P = r.polarSkip;
    if (P && P.key === key && P.extraRes === (ex ? fx.extraRes : null)) return P;
    const [cx, cy] = ring.c;
    // (a point outside the whole plane's share)
    const out = (x, y) => x < w.x0 || x > w.x1 || y < w.y0 || y > w.y1 || Math.hypot(x - cx, y - cy) < rho;
    const T = r.mesh.tri, P0 = r.mesh.src, n = T.length / 3, flags = base ? Float32Array.from(base) : new Float32Array(n);
    for (let t = 0; t < n; t++) {
      for (let k = 0; k < 3; k++) if (out(P0[2 * T[3 * t + k]], P0[2 * T[3 * t + k] + 1])) { flags[t] = 1; break; }
    }
    if (!P || P.res !== r.meshRes) P = r.polarSkip = { res: r.meshRes, skip: null };
    P.skip = svSkipSet(P.skip, r.meshRes, flags);
    // (the fix-up's pieces: [ax, ay, bx, by, cx, cy] a piece, on the plane, each inside its triangle)
    P.extraRes = ex ? fx.extraRes : null;
    P.extra = null;
    if (ex) {
      const m = ex.length / 6, fe = new Float32Array(m);
      for (let t = 0; t < m; t++) if (out(ex[6 * t], ex[6 * t + 1]) || out(ex[6 * t + 2], ex[6 * t + 3]) || out(ex[6 * t + 4], ex[6 * t + 5])) fe[t] = 1;
      P.extra = GLR.createSkip(fx.extraRes, fe);
    }
    P.key = key;
    return P;
  }
  // skip flags on the mesh res: those of skip, made for res, set to flags; a new skip of res when there is none
  function svSkipSet(skip, res, flags) {
    if (!skip) return GLR.createSkip(res, flags);
    GLR.setSkip(skip, flags);
    return skip;
  }
  // the polar ring's own skip flags (its mesh r, svPolarGPU's): its cells within the whole plane's share left out.
  // Kept per mesh (r.share: {key, skip})
  function svPolarOwnSkip(r, ring) {
    if (!GLR.createSkip) return null;
    const w = clipWin, { h, rho } = svPolarShare(ring), key = [w.x0, w.x1, w.y0, w.y1, rho].join('|');
    if (r.share && r.share.key === key) return r.share.skip;
    const { NR, NT, dl } = r, [cx, cy] = ring.c, flags = new Float32Array(2 * NR * NT);
    const inWin = (rr, th) => { const x = cx + rr * Math.cos(th), y = cy + rr * Math.sin(th); return x > w.x0 + 2 * h && x < w.x1 - 2 * h && y > w.y0 + 2 * h && y < w.y1 - 2 * h; };
    for (let i = 0; i < NR; i++) {
      const ra = ring.r1 * Math.exp(i * dl), rb = ring.r1 * Math.exp((i + 1) * dl);
      if (ra < rho + 2 * h) continue;
      for (let j = 0; j < NT; j++) {
        const ta = -Math.PI + 2 * Math.PI * j / NT, tb = ta + 2 * Math.PI / NT;
        if (inWin(ra, ta) && inWin(ra, tb) && inWin(rb, ta) && inWin(rb, tb)) flags[2 * (i * NT + j)] = flags[2 * (i * NT + j) + 1] = 1;
      }
    }
    r.share = { skip: svSkipSet(r.share && r.share.skip, r.meshRes, flags) };
    r.share.key = key;
    return r.share.skip;
  }
  function svPolarGPU(ring) {
    let r = svPolarRes.get(ring.id);
    if (r) { svPolarRes.delete(ring.id); svPolarRes.set(ring.id, r); return r; }
    if (!GLR.ok) return null;
    const NT = SV_POLAR_NT, d = 2 * Math.PI / NT, NR = Math.max(1, Math.ceil(Math.log(ring.r2 / ring.r1) / d)), dl = Math.log(ring.r2 / ring.r1) / NR;
    // (the points relative to c, rho (cos, sin) theta; two triangles a cell, as meshInstances lays them out)
    const px = new Float64Array((NR + 1) * (NT + 1)), py = new Float64Array(px.length);
    for (let i = 0, v = 0; i <= NR; i++) {
      const rho = ring.r1 * Math.exp(i * dl);
      for (let j = 0; j <= NT; j++, v++) {
        const th = -Math.PI + SV_POLAR_EPS + (2 * Math.PI - 2 * SV_POLAR_EPS) * j / NT;
        px[v] = rho * Math.cos(th); py[v] = rho * Math.sin(th);
      }
    }
    /** @type {Float32Array & {origin?: number[]}} */
    const out = new Float32Array(12 * NR * NT);
    for (let i = 0, t = 0; i < NR; i++) {
      for (let j = 0; j < NT; j++) {
        const a = i * (NT + 1) + j, b = a + 1, c = a + NT + 1, e = c + 1;
        for (const v of [a, b, e, a, e, c]) { out[t++] = px[v]; out[t++] = py[v]; }
      }
    }
    out.origin = ring.c.slice();
    r = { meshRes: GLR.createMesh(out), NR, NT, dl };
    svPolarBuilds++;
    while (svPolarRes.size >= SV_POLAR_KEEP) {
      const [k, o] = svPolarRes.entries().next().value;
      svPolarRes.delete(k);
      GLR.destroy(o.meshRes);
    }
    svPolarRes.set(ring.id, r);
    return r;
  }
  // a ring size's mesh and its carried colour's textures, made by the idle job once it has made the size, so the frame
  // that first draws the ring builds and allocates nothing
  function svRingWarm(m) {
    if (m && m.polar && m.ring) svRingWarm(m.ring);
    const ring = svRingShape(m), r = ring ? svRingGPU(ring) : null;
    if (r && r.meshRes && GLR.carryReserve) GLR.carryReserve(r.meshRes, SV_CARRY_L);
    // (a polar ring's share of the plane: its own skip flags, with their vertex arrays, and the whole plane's mesh's)
    if (r && r.meshRes && ring.polar && GLR.carryReserve) {
      GLR.carryReserve(r.meshRes, SV_CARRY_L, svPolarOwnSkip(r, ring));
      svPolarWarmRing = ring;
      svPolarWarmAll();
    }
  }
  // the whole plane's mesh's skip flags under the polar ring made last (svPolarWarmRing), with their vertex arrays, once
  // that mesh is built (the frame or svMeshAhead builds it; it is not built for this alone, its strokes with it)
  let svPolarWarmRing = null;
  function svPolarWarmAll() {
    const a = svPolarWarmRing ? gpu.get(SV_ALL.id) : null, P = a && a.meshRes ? svPolarSkip(a, svPolarWarmRing, null) : null;
    if (P) GLR.carryReserve(a.meshRes, SV_CARRY_L, P.skip);
  }
  // the first twentieth of the glides into and out of the plane the thread is at whose m is not made, Everywhere, for
  // the left pane, which the steps view draws in: {g, q, key, v, w, h}, or null (from the first moment, so a page's
  // first glide finds them made)
  function svRingNext() {
    if (!SV.on || !paneL) return null;
    const L = svCarryShapes();
    if (!L || !L.includes(SV_ALL)) return null;
    // (the view the frames between planes draw in: svRenderMoving sets the pane's view to S.srcView)
    const P = svPlanes(), i = Math.round(SV.g.x), v = S.srcView;
    for (const j of [i - 1, i]) {
      if (j < 0 || j + 1 >= P.length) continue;
      const g = svBetween(j + 0.5, null);
      for (let q = 0; q <= 20; q++) {
        const key = svRingKey(g, q, v, paneL.w, paneL.h);
        if (!svRingSizes.has(key)) return { g, q, key, v: { cx: v.cx, cy: v.cy, s: v.s }, w: paneL.w, h: paneL.h };
      }
    }
    return null;
  }
  const svRingLeft = () => !!svRingJob || !!svRingNext();
  // the idle job's share of the ring: an m made for at most ms, its mesh built (svRingWarm) in the slice that publishes
  // it, so no frame finds a size whose mesh is not built; that slice can run past ms by the build's time. false when
  // none is left to make
  function svRingAhead(ms) {
    const t0 = performance.now();
    if (!svRingJob) {
      const n = svRingNext();
      if (!n) return false;
      svRingJob = { key: n.key, gen: svRingSize(n.g, n.q, n.v, n.w, n.h) };
    }
    for (;;) {
      const r = svRingJob.gen.next();
      if (r.done) {
        const ps = globalThis.__svPathStats, tw = performance.now();
        if (r.value) svRingWarm(r.value);
        svRingSet(svRingJob.key, r.value);
        svRingJob = null;
        if (ps) {
          ps.ringIdle = (ps.ringIdle || 0) + 1;
          // (for each size whose mesh it built: the slice's time past ms and the build's, in ms)
          const t1 = performance.now();
          if (r.value) (ps.ringOver || (ps.ringOver = [])).push({ over: +Math.max(0, t1 - t0 - ms).toFixed(2), build: +(t1 - tw).toFixed(2) });
        }
        return true;
      }
      if (performance.now() - t0 >= ms) return true;
    }
  }
  // a carried shape's tessellated mesh (shapeGPU; the whole plane's at 80 base cells a side, not 140: it has no edge
  // to draw)
  const svCarryGPU = (x) => shapeGPU(x, x === SV_ALL ? { base: 80 } : undefined);
  // The carried meshes of a chain with a step whose glide has no inverse plan (Inverse.homOps of its homotopy fails:
  // its frames, and those of the glides after it, draw svCarryRegions): built, and their carried colour's textures
  // reserved, by the idle job, so the first frame of such a glide builds and allocates nothing. svMeshNext: the key of
  // the meshes left to make (the chain, clipWin and the carried shapes), or null
  let svMeshDone = null, svMeshFalls = null;
  function svMeshNext() {
    if (!SV.on || !paneL || !GLR.ok || !GLR.carryReserve) return null;
    const sig = chainSig[nSteps()];
    if (!svMeshFalls || svMeshFalls.sig !== sig) {
      let falls = false;
      for (let b = 1; b <= nSteps() && !falls; b++) {
        try { falls = !isDeriv(b) && !Inverse.homOps(built[b - 1], 0.5).ok; } catch (e) { falls = true; }
      }
      svMeshFalls = { sig, falls };
    }
    if (!svMeshFalls.falls) return null;
    const L = svCarryShapes();
    if (!L || !L.length) return null;
    const w = clipWin, key = [sig, w.x0, w.x1, w.y0, w.y1, SV.scope, svOpacity()].concat(L.map((x) => shapeKey(x))).join('|');
    return key === svMeshDone ? null : key;
  }
  // the idle job's share of those meshes: all of them at once (each built whole), only with at least half a slice's
  // time left; false when there are none to make or too little time
  function svMeshAhead(ms) {
    const key = svMeshNext();
    if (!key || ms < SV_POLE_BUDGET / 2) return false;
    svMeshDone = key;
    if (svOpacity() < 0.999 && GLR.carryLayersReserve) GLR.carryLayersReserve(svOpacity());
    for (const x of svCarryShapes() || []) {
      const r = svCarryGPU(x);
      if (r && r.meshRes) GLR.carryReserve(r.meshRes, SV_CARRY_L);
    }
    svPolarWarmAll();
    return true;
  }
  // While gliding (map: the glide's, h_{b,u} after the steps before b; b: the plane it goes to), or at rest while the
  // exact pass compiles: each shape's tessellated mesh, the one the tiling's patterns travel on, moved by map, each
  // fragment its point's colour (GLR.drawRegion with carry), the sheet key as its depth. Into the open GL frame
  // (opened if need be). False (nothing more drawn) unless every shape draws so
  // (each base triangle in SV_CARRY_L^2, not the tiling's MESH_L^2: each fragment's colour is its own point's exactly,
  // the subdivision only places it, and the map at every vertex is most of a glide frame's cost)
  // F (at rest or parked: the map's CPU function): the tiling's fix-up job is asked for the shapes under map
  // (svWantFix), and each mesh is drawn with its fix-up once it lands (carryFix: the cells the map bends too much
  // refined, drawn as an extra mesh of their own, their base cells skipped)
  // At rest on a still map, a shape the tiling draws from a SphereMesh (smFor: an unbounded shape, or a fix-up with
  // trouble; the whole plane under a map with a family of poles, whose cells no fix-up budget resolves) is drawn from
  // that pre-mapped mesh once it is built (GLR.drawPreMapped with carry), in the same depth; its tessellated mesh stands
  // in while the mesher's job runs
  function svCarryRegions(pane, map, T, b, frame, F) {
    const list = svCarryShapes();
    if (!list || !list.length || !GLR.drawRegion || derivIn(0, T) || GLR.carryProbes().oldGrid) return false;
    const key = map.mode === 1 ? svSheetKeyAt(b, map.t) : svSheetKey(b);
    const carry = svCarryStyle(T);
    const ring = list.includes(SV_ALL) ? svRingFor(pane, map) : null, shapes = ring ? list.concat([ring]) : list;
    const draws = [], fixed = [], still = F && !(map.mode || 0);
    for (const x of shapes) {
      const r = x === ring ? svRingGPU(ring) : svCarryGPU(x);
      if (!r || !r.meshRes) return false;
      // (the polar ring's cells are already the map's own: no fix-up, no pre-mapped mesh)
      if (x.polar) { draws.push({ res: r.meshRes, L: SV_CARRY_L, skip: svPolarOwnSkip(r, x), stand: null, behind: SV_POLAR_BEHIND }); continue; }
      const smd = still ? smFor(x, r, 'SV', 'flat', map, pane, 0, true) : null, pre = smd && smd.e ? smRes(smd.e) : null;
      if (pre) { draws.push({ res: pre, pre: true }); continue; }
      // (while its rebuild runs, the old mesh of the same content stands in inside its guard box: stand)
      const oldRes = smd && smd.old ? smRes(smd.old) : null, stand = oldRes ? { box: smd.old.guardBox, res: oldRes } : null;
      fixed.push(x);
      const fx = F ? carryFix(x, map) : null;
      const ps = x === SV_ALL && ring && ring.polar ? svPolarSkip(r, ring, fx) : null;
      draws.push({ res: r.meshRes, L: SV_CARRY_L, skip: ps ? ps.skip : fx ? fx.skip : null, stand });
      if (fx && fx.extraRes) draws.push({ res: fx.extraRes, L: 1, skip: ps ? ps.extra : null, stand });
    }
    if (F && fixed.length) svWantFix(F, map, fixed);
    if (!frame.open) { GLR.begin(pane.pw, pane.ph); frame.open = true; }
    // (a stand-in as drawScene's: the old mesh alone where its guard box covers the pane, else inside the box with the
    // tessellated meshes, which cover clipWin's window alone, around it; a box off the pane, none: GLR.standInOf. The
    // frame is open: it reads the frame's size)
    const lay = [];
    for (let i = 0; i < draws.length; i++) {
      const d = draws[i], o = d.stand, end = !o || i + 1 >= draws.length || draws[i + 1].stand !== o;
      if (o && o.so === undefined) o.so = GLR.standInOf(o.box, pane.view, pane.dpr);
      if (!o || !o.so) { lay.push(d); continue; }
      if (o.so === 'whole') { if (end) lay.push({ res: o.res, pre: true }); continue; }
      lay.push(Object.assign({}, d, { scissors: o.so.around }));
      if (end) lay.push({ res: o.res, pre: true, scissor: o.so.sc });
    }
    // (one depth over them all: the sheet key orders the points of every mesh against each other, the first draw
    // clears it, the last clears it after; lim, 0.35 of the pane's larger side: a longer mapped triangle is a point
    // the map sends far, which would cover the pane many times over, so it is left out)
    // (an old mesh drawn inside its guard box never ends the depth: its clear would be scissored too, so the depth is
    // cleared after it; it is never first, its shape's tessellated mesh comes before it)
    const n = lay.length, tail = n > 1 && lay[n - 1].scissor;
    const sts = lay.map((d, i) => {
      const depth = n === 1 ? 'only' : i === 0 ? 'first' : i === n - 1 && !tail ? 'last' : 'mid';
      // (preZ: under graph paper the SphereMesh keeps the source point itself as vP, not its polar coordinates)
      return { map, view: pane.view, dpr: pane.dpr, L: d.L, skip: d.skip, scissors: d.scissors, scissor: d.scissor, alpha: 1, pattern: 'carry', cell: 1, lines: false, carry, key, depth, lim: 0.35 * Math.max(pane.w, pane.h) / pane.view.s, preZ: d.pre && GLR.PATTERNS[S.pattern] === GLR.PATTERNS.grid, prep: null, peel: false, behind: d.behind || 0 };
    });
    // (every mesh's off-screen passes first, then the draws: the frame's framebuffer is left once, not once a mesh. Below full
    // opacity every covering layer shows, as the exact pass composites them: the meshes are drawn once per layer
    // (GLR.carryLayers) with the programs that write each fragment's sheet key (st.peel); while those link, or if the
    // layers cannot be drawn, the front layer alone is drawn)
    const a = svOpacity();
    let layers = a < 0.999 && !!GLR.carryLayers;
    for (let pass = 0; pass < 2; pass++) {
      let ready = true;
      for (let i = 0; i < n; i++) {
        sts[i].peel = layers; sts[i].prep = null;
        if (!lay[i].pre && (sts[i].prep = GLR.carryPrep(lay[i].res, sts[i])) === false) { ready = false; break; }
      }
      if (ready) break;
      if (!layers) return false;
      layers = false;
    }
    const drawAll = () => {
      for (let i = 0; i < n; i++) {
        const d = lay[i], st = sts[i];
        if (!(d.pre ? GLR.drawPreMapped(d.res, st) : GLR.drawRegion(d.res, st))) {
          if (i > 0) GLR.carryDepthEnd();
          return false;
        }
      }
      if (tail) GLR.carryDepthEnd();
      return true;
    };
    const layered = layers ? GLR.carryLayers(a, drawAll) : null;
    return layered === null ? drawAll() : layered;
  }
  // A frame of the plane between two planes (or at rest on a plane past the colour plane, where it is u = 0): the
  // colour carried by the points along h_{b,u} (svCarry), with each plane's exact pull-back colour blended in near it;
  // Inside regions masks it with the moving regions; the regions are outlined over it. The view stays.
  // (#1059) the labels are placed in full once the picture has been still for SV_LABEL_STILL ms, held or released (on the
  // move they keep their offsets, see drawPoints). The picture is what it draws: a pan or a zoom counts as a change too
  const SV_LABEL_STILL = 120;
  let svPicKey = '', svPicAt = 0, svPicTimer = 0;
  function svPictureSettled(pane, a, b, u) {
    const key = [a, b, u, pane.w, pane.h, JSON.stringify(pane.view)].join('|');
    const now = performance.now();
    if (key !== svPicKey) { svPicKey = key; svPicAt = now; }
    const left = SV_LABEL_STILL - (now - svPicAt);
    if (left <= 0) return true;
    // (a held thread draws no frame of its own: this one draws the still picture's full placement)
    if (!svPicTimer) svPicTimer = setTimeout(() => { svPicTimer = 0; requestRender('L'); }, left);
    return false;
  }
  // the steps view's left plane, drawn by one of two cores: a glide frame and a flat plane past the colour plane (push) by the
  // carry core, svRenderMoving, which paints the colour plane's colour forward; every other plane at rest by `still`, the
  // classic core, which pulls the colour back through the map (and draws the globe and the relief of a push plane too)
  function svDrawPlane(pane, still) {
    svHoldB = 0;
    if (svMoving()) { if (svParked()) svCheck(); if (svMoving()) { probeMoving(); SV.core = 'carry'; if (!svLandMoving(pane)) svRenderMoving(pane); return; } }
    svCheck(); svPolesWatch();
    if (svPaint() === 'push' && SV.surf === 'plane' && lFlat()) { SV.core = 'carry'; svRenderMoving(pane); return; }
    SV.core = 'still'; still(pane);
  }
  function svRenderMoving(pane) {
    if (SV.surf === 'sphere' && lGlobe()) { svSphereMoving(pane); return; }
    const hold = svLinkHold();
    const bt = svBetween(hold == null ? SV.g.x : hold), { a, b, u, map, F, H: Hb, near } = bt, rest = !SV.anim && !(SV.drag && SV.drag.moved);
    // (#548: parked between two planes, a pan or a zoom changes the view of the plane the thread is nearest to, V.left past the first
    // plane; the picture is drawn from the one camera every plane shares, S.srcView, so the parked view hands it its own)
    if (rest) svKeepView();
    pane.setView(S.srcView);
    svPolesWatch();
    pane.begin(TH.plane);
    if (!GLR.ok) { noGL(pane); return; }
    // (col: the frame looks like the coloured plane it is nearest to, as renderColor draws it: plain, no paper or graph
    // paper, the outlines as Outlines says and open sets dashed, the colour plot's grid over it all; else like a plane
    // past the colour plane, which this function draws at rest: the paper and its graph paper under the colour)
    const col = svColoured(near);
    if (!col) paper(pane);
    // (SV.bare, a test hook's: the colour layer alone, without the grid, the outlines and the points)
    const bare = !!SV.bare;
    const grid = (under) => !bare && !col && GLR.drawGrid && GLR.drawGrid({ view: pane.view, dpr: pane.dpr, plane: TH.planeRGB, minor: GLR.hexRGB(TH.gridMinor), medium: GLR.hexRGB(TH.gridMedium), major: GLR.hexRGB(TH.gridMajor), axis: TH.axisRGB, unit: S.unit, unitAlpha: 0.55, under });
    svColCv = svCanvas(svColCv, pane);
    const cc = svColCv.getContext('2d');
    const T = svT(), src = Math.min(a, T), still = u <= SV_REST_U || b === a;
    // (#439 I: the colour layer is one GL frame, the plots at their opacity and the carried colour composed in it, and
    // one copy into cc at the end)
    const frame = { open: false, cc: false };
    const plot = (k, al) => {
      if (al <= 0.01 || !svColoured(k)) return;
      if (!frame.open) { GLR.begin(pane.pw, pane.ph); frame.open = true; }
      GLR.drawColorPlot({ map: svColourMap(k), view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: null, alpha: al, exact: true });
    };
    const colour = () => {
      // (between two planes, per pixel through the inverse pass when step b's homotopy has an inverse plan: the exact
      // picture of the map at u, with nothing blended in; else the carried meshes below, with the planes' plots)
      if (!still && map.mode === 1 && !isDeriv(b)) {
        const why = { r: null }, drew = svCarryExactHom(pane, b, u, T, frame, why);
        const kp = drew ? invHomPath(SV_ALL, 0, b, u, () => svSheetKeyAt(b, u).sing) : null;
        svGlideRec = { b, u, path: drew ? 'inverse' : why.r === SV_NO_AREA ? 'none' : 'mesh', reason: why.r, key: kp && kp.prep ? (z) => Inverse.sheetKey(kp.prep, z) : null, H: F, Hb, view: Object.assign({}, pane.view), w: pane.w, h: pane.h };
        if (drew) return;
      }
      // (meshed: drawn by the carried meshes, which nothing is drawn under or blended over)
      let carried = false, meshed = false;
      // (at rest on a plane at or before the colour plane its exact colour covers it all: no carried colour under it)
      // (at rest past the colour plane, the points take their colour exactly, as the region tiling places them:
      // svCarryExact; the carried grid only where neither path can draw)
      const exact = still && !svColoured(a) && svCarryExact(pane, a, T, frame);
      if (still && !svColoured(a)) svRestRec = { a, path: exact ? 'inverse' : 'mesh' };
      if (exact) carried = true;
      // (and while gliding, or at rest while the exact pass compiles: the tessellated meshes the tiling's patterns
      // travel on, each fragment its point's colour; Everywhere with the outer meshes, they cover the pane, so no
      // plane's colour is drawn under them or blended over them)
      else if ((still ? !svColoured(a) : (!isDeriv(b) && map.mode === 1)) && svCarryRegions(pane, map, T, still ? a : b, frame, rest ? F : null)) carried = meshed = true;
      else {
        // (under the rest, the two planes' exact colours cross-faded: where no carried point of the grid lands, and
        // the whole picture of a d/dz step's glide)
        if (!still) { plot(a, svColoured(b) ? 1 : 1 - u); if (b !== a) plot(b, u); }
        // (the carried grid, svCarry, only where the region machinery cannot draw: a region of a later plane (it has
        // no points on plane 0), a d/dz step before the colour plane (no map of the points), a program still compiling)
        if (still ? !svColoured(a) : !isDeriv(b)) carried = svCarry(pane, cc, src, a, still ? null : Hb, frame);
      }
      // (over it, at a plane at or before the colour plane, its exact colour: all of it at rest; over the carried
      // grid, blended in over the first and the last 15 % of a glide)
      const near = (w) => Math.max(0, Math.min(1, w));
      if (still) plot(a, 1);
      else if (carried && !meshed) { plot(a, near(1 - u / 0.15)); if (b !== a) plot(b, near((u - 0.85) / 0.15)); }
    };
    // (Inside regions on the GPU, #440: the colour layer over the regions' mask and kept inside it, the grid under it and
    // the outlines over it, in one frame and one copy to the page, #545)
    if (svMaskOn() && svMask(pane, map, still ? a : undefined, {
      // (under the colour, the plane's paper and, past the colour plane, its grid, as the 2D path leaves the pane's
      // showing where none lands: a pixel of the regions the colour layer leaves empty (the inverse pass found no point
      // there) reads as the paper, never as the frame's cleared black; the colour layer stays in this frame: the
      // carried colour's CPU mesh, which needs a frame of its own, waits)
      paint: () => { GLR.clearRGB(TH.planeRGB); grid(false); frame.open = true; frame.keep = true; colour(); },
      after: () => { grid(true); svOutlines(pane, map, frame, col); frame.open = false; frame.keep = false; },
    })) {
      // (drawn: the frame is on the page)
    } else {
      colour();
      // (#492) the grid under the colour layer and the outlines over it, in the same frame: the frame's one copy goes
      // to the page. Inside regions in 2D (the mask is a pass over the colour layer) or when the carried colour took
      // the CPU path (it is in cc already), the layers go one by one, the grid first
      if (!svMaskOn() && !frame.cc) {
        if (!frame.open) { GLR.begin(pane.pw, pane.ph); frame.open = true; }
        grid(true);
        if (!bare) svOutlines(pane, map, frame, col);
        GLR.blit(pane.ctx);
        frame.open = false;
      } else {
        if (frame.open) { GLR.blit(cc); frame.open = false; }
        if (svMaskOn()) svMask(pane, map, still ? a : undefined, { cc });
        if (GLR.drawGrid && !col) { GLR.begin(pane.pw, pane.ph); grid(false); GLR.blit(pane.ctx); }
        pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.drawImage(svColCv, 0, 0); pane.ctx.restore();
        svOutlines(pane, map, null, col);
      }
    }
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (bare) return;
    if (col) colourGrid(pane);
    // (the points, carried too; at rest the plane's rulers, as every plane has)
    // (the paths t -> H_t(z) of the glide's run, svPathsSource: the classic deformation's, under the points)
    const paths = svPathsSource();
    if (paths) { try { drawMorphPathsX(pane, morphSelScreen(pane, paths), F, null, { T: paths.T, side: 'L' }); } catch (e) { console.error('steps view paths', e); } }
    cutHandlesL = still && rest ? drawCuts(pane, a, true, false) : [];
    if (!(still && rest)) { const cp = svCutPlan(bt); drawCutCurvesAt(pane, cp.mapFor, null, cp.pre, still ? 1 : SV_CUT_THIN); }
    // (a glide or a play is under way: its frames stay on the move, whatever a stalled frame shows)
    const settled = rest || (!SV.anim && !SV.play && svPictureSettled(pane, a, b, u));
    drawPoints(pane, F, Object.assign(still ? { primes: a, k: a, editK: a } : {}, settled ? {} : { lite: true }));
    // (at rest on plane a, the points of later planes by their preimages here, as on a coloured plane)
    if (still && rest) { updatePre('L', pane, a); drawPre(pane, 'L', a); }
    if (rest) drawRulers(pane, 'L');
    // (the pane's GPU status and its notes, compiling or preparing, as renderLeft's frames keep them)
    glStatusNote(pane);
  }
  // Inside regions between two planes: the alpha of the regions of later planes in the open frame, by the inverse pass
  // (a region of plane k holds the points whose F_{0->k} it holds, moved by the glide's map), at the opacity they have
  // at rest on the nearer plane (the pulled-back ones, stagePullbacks, at PULL_ALPHA), which writes alpha alone under the
  // caller's write mask. Nothing when none is visible or the pass cannot draw them
  function svStagedMask(pane) {
    const st = svStagedOf();
    if (!st) return;
    // (the regions of the planes up to the nearer one at their own opacity, the later ones pulled back, as the picture
    // at rest on the nearer plane draws them; each of the pulled-back ones then has its boundary band, the mask's more
    // opaque line that drawPreimage draws at rest, so the carried colour shows stronger there)
    const nearer = (x) => shapeStage(x) <= st.g.near;
    svDrawInverse(pane, st.list, st.paths, svT(), { open: true }, null, (x) => (nearer(x) ? 1 : PULL_ALPHA * dimK(x)));
    const later = st.list.map((x, i) => i).filter((i) => !nearer(st.list[i]));
    svDrawInverse(pane, later.map((i) => st.list[i]), later.map((i) => st.paths[i]), svT(), { open: true }, null, null, (x) => ({ w: pullBandW(x, pane.dpr), a: PULL_EDGE_A }));
  }
  // the regions of later planes of the frame between two planes, with their inverse paths: {g, list, paths}, or null
  // when there is none or the pass cannot draw them
  function svStagedOf() {
    const g = svBetween();
    if (g.a === g.b || g.map.mode !== 1 || isDeriv(g.b)) return null;
    const h = svHomMemo && svHomMemo.b === g.b && svHomMemo.u === g.u ? svHomMemo.h : svInvPaths(g.b, g.u, 'flat', { r: null });
    if (!h) return null;
    const at = h.list.map((x, i) => i).filter((i) => shapeStage(h.list[i]));
    return at.length ? { g, list: at.map((i) => h.list[i]), paths: at.map((i) => h.paths[i]) } : null;
  }
  // Inside regions (#440, #591): the colour kept inside the regions under map (and, at rest on plane k, the later planes'
  // regions pulled back, stagePullbacks), by what the renderer can do:
  // - on the GPU, in one frame and one copy to the page (#545): the regions' fills (drawScene's fills, #561) write the
  //   frame's alpha alone; o.paint() draws the colour over it, its colour alone (into the open frame); the colour is
  //   kept where the alpha is (keepInAlpha); then o.after() (the grid, the outlines) and drawScene's one blit to the
  //   pane. True when it is on the page; false (nothing on the page) without the GL calls, while keepInAlpha's program
  //   links, or when the frame failed before o.after;
  // - o.cc (the 2D path): the picture already in the 2D context o.cc is cut to the regions (drawn opaque into a canvas
  //   the pane's size, destination-in). True
  function svMask(pane, map, k, o) {
    // (sm: the regions' SphereMesh in the steps view's slot, SPEC 8, where the tiling would draw them from one)
    const opt = k == null ? { noGrid: true, fills: true, cache: false, sm: 'SV' }
      : { noGrid: true, fills: true, domain: k === 0, plane: k, sm: 'SV' };
    if (o.cc) {
      svMaskCv = svCanvas(svMaskCv, pane);
      const mp = svProxy(pane, svMaskCv);
      mp.begin = () => {};
      try {
        // (at rest, plane k: the cached maps, as the plane's own frame (perf A3); between planes the homotopy's, uncached)
        withSolidRegions(() => { drawScene(mp, map, 'L', opt); if (k != null) stagePullbacks(mp, k); });
      } catch (e) { console.error('steps view mask', e); }
      o.cc.save();
      o.cc.setTransform(1, 0, 0, 1, 0, 0);
      o.cc.globalCompositeOperation = 'destination-in';
      o.cc.drawImage(svMaskCv, 0, 0);
      o.cc.restore();
      return true;
    }
    if (!GLR.writeMask || !GLR.keepInAlpha || !GLR.keepInAlpha(true)) return false;
    let onPage = false;
    const mp = Object.create(pane);
    mp.begin = () => {};
    try {
      withSolidRegions(() => drawScene(mp, map, 'L', Object.assign(opt, {
        under: () => GLR.writeMask(false, true),
        over: () => {
          if (k != null) stagePullbacks(mp, k, true);
          else svStagedMask(mp);
          GLR.writeMask(true, false);
          o.paint();
          GLR.writeMask(true, true);
          GLR.keepInAlpha();
          if (o.after) o.after();
          onPage = true;
        },
      })));
    } catch (e) { console.error('steps view mask', e); }
    GLR.writeMask(true, true);
    return onPage;
  }
  // the shapes' outlines under map, open sets dashed (spec 6.5), along the curve under map; col: as the colour plot draws
  // them (renderColor: with Outlines off, the selected shape's alone). Into the open GL frame frame, if given (the
  // caller copies it), else a frame of their own
  function svOutlines(pane, map0, frame, col) {
    if (!frame) GLR.begin(pane.pw, pane.ph);
    for (const s of hideStrokes ? [] : S.shapes) {
      if (!outlineShown(s, !col)) continue;
      const map = svShapeMap(s, map0), r = map && shapeGPU(s);
      if (!r || !r.lineRes) continue;
      const dash = openDash(r, map);
      GLR.drawLines(r.lineRes, Object.assign({ map, view: pane.view, dpr: pane.dpr, M: 8 }, shapeStroke(s, pane.dpr, { domain: svStage() === 0, plane: svStage() }), dash));
    }
    if (!frame) GLR.blit(pane.ctx);
  }
  // The Landscape with Inside regions (#846): which points of plane k's box are in the carried region set, the set the
  // plane's 2D picture colours (svMask): {cv, key, box}, a canvas over box (512 pixels on its longer side, row 0 at its
  // top), opaque inside the set and clear outside; the surface is plain (the Plain material's colour) there. One per
  // chain, plane, box and shapes; null with the colour everywhere (Everywhere)
  let svLandMaskC = null;
  // (the number of masks drawn while a program of the pass still linked: each one's key is its own, so the surface's
  // texture is uploaded again for it and the next frame draws the mask afresh)
  let svLandMaskLinking = 0;
  // the mask of a plain Landscape (svPlain): transparent, so its surface is plain everywhere
  let svLandPlainC = null;
  function svLandPlainMask() {
    if (!svLandPlainC) { const cv = document.createElement('canvas'); cv.width = cv.height = 1; svLandPlainC = { cv, key: 'plain', box: { x0: 0, x1: 1, y0: 0, y1: 1 } }; }
    return svLandPlainC;
  }
  function svLandMask(k, box) {
    if (!svMaskOn() || !paneL) return null;
    const W = box.x1 - box.x0, H = box.y1 - box.y0, n = 512;
    const pw = W >= H ? n : Math.max(8, Math.round(n * W / H)), ph = W >= H ? Math.max(8, Math.round(n * H / W)) : n;
    const key = [svSigNow(), chainSig[nSteps()], k, box.x0, box.x1, box.y0, box.y1, pw, ph].concat(S.shapes.map((x) => shapeKey(x))).join('|');
    if (svLandMaskC && svLandMaskC.key === key) return svLandMaskC;
    const cv = (svLandMaskC && svLandMaskC.cv) || document.createElement('canvas');
    cv.width = pw; cv.height = ph;
    const cc = cv.getContext('2d');
    cc.setTransform(1, 0, 0, 1, 0, 0);
    cc.fillStyle = '#fff';
    cc.fillRect(0, 0, pw, ph);
    // (a pane over box at one pixel a CSS pixel: the 2D plane's own mask, cut out of the white)
    // (own values over the pane's getters)
    const own = { w: pw, h: ph, pw, ph, dpr: 1, view: { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, s: pw / W } };
    const over = Object.create(paneL, Object.fromEntries(Object.entries(own).map(([k, value]) => [k, { value, writable: true }])));
    svMask(over, stageMap(k), k, { cc });
    // (a pass that left a program linking drew its regions short: the mask is not kept under this key, so the frame
    // that follows the link draws it afresh)
    const linking = !!GLR.frameStatus().pending;
    svLandMaskC = { cv, key: linking ? key + '|linking' + (++svLandMaskLinking) : key, box: Object.assign({}, box), cut: true };
    return svLandMaskC;
  }
  // the map of shape s under map0, the frame's map of the z-plane's shapes: shapeMap's, and under a glide's map (mode 1:
  // h_{hi,t} after the steps before hi; mode 3: h_{b,t} ... h_{a+1,t} after the steps to a) for a shape of plane k > 0
  // at or before the glide's first plane, the same map from plane k (its base), so it moves as plane k's picture does.
  // Null: a shape the frame does not draw (a later plane's, or one behind a d/dz step on the way)
  function svShapeMap(s, map0) {
    const m = map0.mode || 0, k = shapeStage(s);
    if (!k || (m !== 1 && m !== 3) || (map0.base || 0) !== 0) return shapeMap(s, map0);
    const lo = m === 1 ? (map0.hi || 0) - 1 : (map0.a || 0);
    return k <= lo && !derivIn(k, lo) ? Object.assign({}, map0, { base: k }) : null;
  }
  // a pane that draws into canvas cv instead (the same size and view)
  function svProxy(pane, cv) {
    const p = Object.create(pane);
    p.ctx = cv.getContext('2d');
    p.ctx.setTransform(1, 0, 0, 1, 0, 0);
    p.ctx.clearRect(0, 0, cv.width, cv.height);
    p.begin = (bg) => { p.ctx.setTransform(1, 0, 0, 1, 0, 0); p.ctx.clearRect(0, 0, cv.width, cv.height); if (bg) { p.ctx.fillStyle = bg; p.ctx.fillRect(0, 0, cv.width, cv.height); } p.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0); };
    return p;
  }
  // the glide on the globe: the globe of plane a, its colour fading into plane b's, with the shapes moving on it
  let svFadeCv = null;
  // the regions' colour on the globe per pixel through the inverse pass, as drawSphere's regions draw records: between
  // two planes, step b's homotopy at u (svCarryExactHom's records); at rest on plane b past the colour plane (u null),
  // the map into b (svCarryExact's). A point of the plane shown is walked back to plane 0 and coloured as the colour
  // plane colours it. Null when the frame cannot take the pass; a region with no inverse plan makes it null too, unless rest
  // is an array (at rest): those shapes are put in it and the list holds the others (possibly none)
  function svGlobeCarryInv(pane, b, u, T, rest) {
    const h = svInvPaths(b, u, 'globe', { r: null, rest }), carry = svCarryStyle(T);
    return h && h.list.map((x, i) => ({ inv: Object.assign(svInvArg(pane, h.paths[i], x, carry), { globeBox: u == null ? svGlobeBox(h.paths[i], x) : null }), onResult: (res) => { if (res === 'pending') requestRender('L'); } }));
  }
  // the w-box of a bounded shape's image on plane b at rest (the carried colour is drawn only where the shape's points land),
  // which scissors its pass (gl.js globeScissorOf); null for an unbounded shape, a shape of a later plane or a box that cannot
  // be promised
  function svGlobeBox(p, x) {
    return shapeStage(x) ? null : globeImageBox(p, x, false);
  }
  // the carried mesh of plane a's globe (drawSphere's st.carried; its graticule shows at x <= T, as the exact pass's): the colour plane's grid, plane min(a, T)'s, placed by
  // map (the map into plane a at rest, or the glide's) and coloured from the colour plane. Null where a d/dz step lies
  // on the way from that plane to the colour plane
  function svGlobeMesh(pane, a, T, map, x = a) {
    const src = Math.min(a, T);
    if (src > 0 && derivIn(src, T)) return null;
    return Object.assign(svCarryStyle(T), { map, s: src, mesh: SV_GLOBE_MESH, lim: SV_GLOBE_CHORD, key: svCarryKey(pane, src, a), graticule: x <= T });
  }
  // the globe at rest on plane k past the colour plane: the colour carried to it per pixel (svGlobeCarryInv with no
  // homotopy), by the carried mesh where a region has no inverse plan (kept inside those regions alone when others take
  // the exact pass), with the plane's shapes and what the globe draws over them at rest (leftGlobeOver). Null when
  // neither can draw: the caller draws the regions' exact images instead
  function svGlobeRest(pane, k) {
    const T = svT(), fwd = [], inv = svGlobeCarryInv(pane, k, null, T, fwd);
    const mesh = !inv || fwd.length ? svGlobeMesh(pane, k, T, { mode: 0, a: Math.min(k, T), b: k }) : null;
    if (!inv && !mesh) return null;
    if (inv && fwd.length && !mesh) return null;
    const look = { imageMode: false, stage: k, plane: !!xView().eq, role: 'L' };
    const info = sphereView(pane, camL, CAML, Object.assign({ carryRegions: inv, carried: inv ? null : mesh }, look, leftGlobeOver()));
    let meshed = !!(info && info.carried) && !inv;
    // (the mesh over the exact pass's globe, kept inside the regions that take it)
    if (info && inv && fwd.length) meshed = maskedGlobe(pane, camL, CAML, Object.assign({ only: new Set(fwd), carried: mesh }, look));
    const exact = !!inv && inv.length > 0;
    if (info) { info.carryPath = exact ? (fwd.length ? (meshed ? 'mixed' : null) : 'inverse') : meshed ? 'mesh' : null; info.carried = !!info.carryPath; }
    return info;
  }
  function svSphereMoving(pane) {
    const bt = svBetween(), { a, b, u, map, F, near, all } = bt;
    // (Inside regions: a coloured plane's globe in its colour only inside the regions, lifted under the glide's map as
    // the outlines are, sphereView's inRegions)
    const look = (k) => ({
      imageMode: !svColoured(near), inRegions: svMaskOn() && svColoured(k), stage: k, plane: !!xView().eq, role: 'L', net: leftNet(),
      colorMap: svColoured(k) ? svColourMap(k) : null, lineMap: map, hom: { map, imageMap: map, F, imageF: F },
    });
    // The colour moves with the points, as on the plane: per pixel through the inverse pass of the glide's map
    // (svGlobeCarryInv), the regions' own colour on the plain globe, nothing blended in, so the ends are the planes'
    // own globes. A plane past the colour plane shows the colour carried to it, at rest too (u null), as the plane's
    // svCarryExact. For a step with no inverse plan, at rest or between two planes that show the colour, the carried mesh
    // (svGlobeMesh); while neither can draw, plane b's globe fading in over plane a's
    const T = svT(), still = u <= SV_REST_U || b === a;
    const shows = (k) => svColoured(k) || k > T;
    const rest = still && !svColoured(a) ? svGlobeRest(pane, a) : null;
    if (rest) { leftSphereInfo = rest; return; }
    const inv = !still && !all && map.mode === 1 && !isDeriv(b) && shows(a) && shows(b) ? svGlobeCarryInv(pane, b, u, T) : null;
    // (the carried mesh, between two planes that show the colour: the colour plane's grid carried by the glide's map)
    const src = Math.min(a, T);
    const carried = !inv && !still && shows(a) && shows(b) && (all || map.mode === 1)
      ? svGlobeMesh(pane, a, T, all ? { mode: 3, a, b, t: u, base: src } : { mode: 1, base: src, hi: b, t: u }, a + u) : null;
    const info = inv ? sphereView(pane, camL, CAML, Object.assign(look(a), { imageMode: false, inRegions: false, carryRegions: inv }))
      : sphereView(pane, camL, CAML, Object.assign(look(a), carried ? { imageMode: false, carried } : { carried }));
    if (!inv && !(info && info.carried) && b !== a && (svColoured(b) || !svColoured(near)) && u > SV_FADE_U) {
      svFadeCv = svCanvas(svFadeCv, pane);
      sphereView(svProxy(pane, svFadeCv), camL, CAML, look(b));
      pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.globalAlpha = u; pane.ctx.drawImage(svFadeCv, 0, 0); pane.ctx.restore();
    }
    if (info) { info.carryPath = inv ? 'inverse' : info.carried ? 'mesh' : null; info.carried = !!info.carryPath; }
    // (the paths t -> H_t(z) of the glide's run over both globes, as the plane draws them (svRenderMoving): chosen in
    // the plane's camera, drawn lifted to the sphere)
    const paths = info ? svPathsSource() : null;
    if (paths) {
      try {
        const sel = morphSelGlobe(pane, { MVP: info.MVP, eye: info.eye }, paths, S.srcView);
        drawMorphPathsX(pane, sel, F, globeSelP(info, pane.w, pane.h, 0.02), { T: paths.T, side: 'L' });
      } catch (e) { console.error('steps view globe paths', e); mfGlobeDrawn = { T: paths.T, heads: 0, error: String((e && e.message) || e) }; }
    }
    if (info) { const cp = svCutPlan(bt); drawCutCurvesAt(pane, cp.mapFor, sphereProj(pane, info, 1), cp.pre, u > SV_REST_U && b !== a ? SV_CUT_THIN : 1); }
    leftSphereInfo = info;
  }

  // Inside regions: the region mask of plane k, drawn opaque into a canvas the size of the pane's
  let svMaskCv = null, svColCv = null;
  function svCanvas(cv, pane) {
    if (!cv) cv = document.createElement('canvas');
    if (cv.width !== pane.pw || cv.height !== pane.ph) { cv.width = pane.pw; cv.height = pane.ph; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    return cv;
  }
  // (Inside regions: the colour shows only inside the areas drawn, so with none, a curve or a point alone, the plane is
  // neutral)
  // the scope in force: the Cauchy style is always drawn everywhere
  const svScope = () => (S.dc === 'cauchy' ? 'all' : SV.scope);
  function svMaskOn() { return SV.on && svScope() === 'in'; }
  // why the Cauchy style draws no picture on this plane, or '': it is the integral over the curve on plane z, so it is drawn
  // there while z is the colour plane, and with no closed curve (cz, cauchyDraw's data) there is nothing to draw
  function svCauchyWhy(cz) {
    if (S.dc !== 'cauchy') return '';
    if (svT() !== 0) return $t('The Cauchy integral is drawn on z, where its curve lies: colour from z');
    return cz ? '' : $t('Select a closed curve or a bounded region: its Cauchy integral is shown.');
  }
  // (Inside regions with no area drawn: the plane is neutral, and a chain with a step says what to do)
  function svNoRegions() {
    return svScope() === 'in' && !S.shapes.some((s) => s.visible !== false && kindType(s) === 'area');
  }
  // Inside regions on the plane at rest (renderColor): the colour plot cst kept inside the plane's regions (its own, the
  // earlier planes' images and the later planes' pulled back), svMask: on the GPU in its frame, else the plot drawn,
  // copied to a 2D canvas, cut to the regions there and copied to the page. A new GL frame is open after it
  function svColourIn(pane, cst) {
    const k = svStage(), map = stageMap(k);
    if (!svMask(pane, map, k, { paint: () => GLR.drawColorPlot(cst) })) {
      GLR.drawColorPlot(cst);
      svColCv = svCanvas(svColCv, pane);
      const cc = svColCv.getContext('2d');
      GLR.blit(cc);
      svMask(pane, map, k, { cc });
      pane.ctx.save();
      pane.ctx.setTransform(1, 0, 0, 1, 0, 0);
      pane.ctx.drawImage(svColCv, 0, 0);
      pane.ctx.restore();
    }
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    GLR.begin(pane.pw, pane.ph);
  }

  // ---- the controls: the plane's head and the chain strip ----
  function svLabel() {
    if (svParked()) return svPlaceText();
    const k = svStage(), T = svT(), n = svPlanes().length;
    const where = svColoured(k) ? (k === T ? $t('the colour plane') : $t('coloured from {p}', { p: svName(T) })) : $t('after the colour plane {p}', { p: svName(T) });
    return $t('Plane {p}, {i} of {n}, {where}', { p: svName(k), i: I18N.num(SV.i + 1), n: I18N.num(n), where });
  }
  function svFormulaHtml() {
    const { name, role, short } = svTitleParts();
    return `${name}<span class="sv-sep"> · </span><span class="sv-role"${short ? ` data-short="${short}"` : ''}>${role}</span>`;
  }
  // a choice of several as a button that names the current one and opens svChoiceMenu; `.value` reads and sets the choice (its
  // word and its accessible name, "Speed: Normal", follow); svDisableWhy greys it with its reason
  function svChoiceBtn(cur, pairs, pick, title, cls) {
    let val = cur;
    const word = h('span', { class: 'sv-choice-t' });
    const b = /** @type {HTMLButtonElement & { value: string, choices: string[][] }} */ (h('button', { type: 'button', class: 'btn sv-choice ' + cls, 'data-tip': title, 'aria-haspopup': 'menu',
      onclick: () => { if (!svOff(b)) svChoiceMenu(b, pairs, val, title, (v) => { b.value = v; pick(v); }); } }, word, h('span', { class: 'sv-choice-i', html: ICONS.chevD, 'aria-hidden': 'true' })));
    b.choices = pairs;   // (the suites pick an item by its value through it)
    Object.defineProperty(b, 'value', { get: () => val, set: (v) => {
      val = v;
      word.textContent = (pairs.find((q) => q[0] === v) || pairs[0])[1];
      b.setAttribute('aria-label', `${title}: ${word.textContent}`);
    } });
    b.value = cur;
    return b;
  }
  // the glide speed's choice and the Loop toggle, the strip's and the playback sheet's
  function svSpeedSel(title) {
    return svChoiceBtn(SV.speed, [['fast', $t('Fast')], ['normal', $t('Normal')], ['slow', $t('Slow')], ['slower', $t('Slower')]], svSetSpeed, title, 'sv-speed');
  }
  function svLoopBtn(cls, tip) {
    return h('button', { type: 'button', class: cls, 'aria-pressed': String(SV.loop), 'data-tip': tip || null, onclick: () => svSetLoop(!SV.loop) }, $t('Loop'));
  }
  // the Paths toggle (the classic deformation's S.morphPaths, setMorphPaths): the paths t -> H_t(z) of a glide and of a
  // parked view (svPathsSource); key P. Off, with its reason, when a d/dz step is in the chain (svPlaySync)
  // (inPop: the button of the Playback popover, whose row is labelled Paths, says On or Off; the phone sheet's, a toggle
  // like its Loop, is labelled Paths itself)
  function svPathsBtn(cls, inPop) {
    const label = inPop ? (S.morphPaths !== false ? $t('On') : $t('Off')) : $t('Paths');
    return h('button', {
      type: 'button', class: cls, 'aria-pressed': String(S.morphPaths !== false),
      onclick: () => { setMorphPaths(S.morphPaths === false); svSync(); requestRender('L'); },
    }, label);
  }
  // the order of a glide across several planes (S.homAll): plane by plane, or all at once as one homotopy of the whole range
  function svOrderSel(title) {
    return svChoiceBtn(S.homAll ? 'all' : 'steps', [['steps', $t('Step by step')], ['all', $t('All at once')]], svSetOrder, title, 'sv-order');
  }
  function svSetOrder(v) {
    const all = v === 'all';
    if (!!S.homAll === all) return;
    // (the classic Deformation's setter: the order is shared, so its moment, dock and fix-ups follow too)
    setHomAll(all);
    svSync(); requestRender('L');
  }
  // the order select says why it is off: a chain of fewer than two steps has nothing to take together, a d/dz is no map to deform
  function svOrderSync() {
    const E = SV.els, P = svPlanes(), deriv = P.some((k, i) => i > 0 && isDeriv(k)), ok = P.length > 2 && !deriv;
    // (read and written only when what it says changes)
    const key = `${ok ? 1 : 0}|${deriv ? 1 : 0}|${S.homAll ? 1 : 0}|${I18N.lang}|${E.sheetOrder ? 1 : 0}`;
    if (key === E.orderKey) return;
    E.orderKey = key;
    const tip = deriv ? $t('d/dz is not a map: its step deforms on its own, so the steps run one after another') : !ok ? $t('All at once needs two steps or more') : $t('Glide order');
    for (const sel of [E.order, E.sheetOrder]) {
      if (!sel) continue;
      sel.value = S.homAll && ok ? 'all' : 'steps';
      svDisableWhy(sel, ok ? '' : tip, tip);
    }
    for (const why of [E.orderWhy, E.sheetOrderWhy]) {
      if (!why) continue;
      why.textContent = ok ? '' : tip;
      why.hidden = ok;
    }
    if (E.play) E.play.setAttribute('aria-description', ok ? `${$t('Hold for speed and loop')}. ${$t('Glide order')}: ${S.homAll ? $t('All at once') : $t('Step by step')}` : $t('Hold for speed and loop'));
  }
  // the Playback dialog: the glide order, with its reason when it is off (muted); focus goes in, Esc returns it to the ⋯, a press
  // outside or Tab out closes it
  function svPlayPop(show) {
    const E = SV.els;
    if (show === undefined) show = E.pop.hidden;
    if (show === !E.pop.hidden) return;
    E.pop.hidden = !show;
    E.playMore.setAttribute('aria-expanded', String(show));
    if (!E.popOff) {
      const close = (back) => { svPlayPop(false); if (back) E.playMore.focus(); };
      E.pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } });
      E.pop.addEventListener('focusout', (e) => { const to = e.relatedTarget; if (to && !E.pop.contains(to) && to !== E.playMore) close(false); });
      E.popOff = (e) => { if (!E.pop.hidden && !E.pop.contains(e.target) && !E.playMore.contains(e.target)) close(false); };
    }
    if (show) { svOrderSync(); document.addEventListener('pointerdown', E.popOff, true); (E.order.disabled ? E.pop : E.order).focus(); }
    else document.removeEventListener('pointerdown', E.popOff, true);
  }
  function svBuild() {
    const head = document.querySelector('#paneL .pane-head');
    const bar = h('div', { class: 'sv-head', id: 'svHead' });
    const title = h('div', { class: 'sv-title', 'aria-hidden': 'true' });
    const cp = h('button', { type: 'button', class: 'btn small sv-cp', 'aria-pressed': 'false', 'data-tip': $t('Colour every plane from this one  C'), onclick: () => svSetT(svStage()) });
    const SCOPES = [['all', $t('Everywhere')], ['in', $t('Inside regions'), $t('Colour only inside the regions you draw, in every plane')]];
    const scope = seg(null, SV.scope, SCOPES, svSetScope, $t('Where colour shows'), { cls: 'sv-seg sv-scope', loop: true });
    // (the surface: one button that names it and opens a menu of the three, on a laptop as on a phone; ux, #441: the
    // three-way row took 190 px of a head that has 700 at 1024 px)
    const SURF = [['plane', $t('Plane')], ['sphere', $t('Sphere')], ['land', $t('Landscape')]];
    const surf1 = h('button', { type: 'button', class: 'btn small sv-surf1', 'aria-haspopup': 'menu', onclick: () => svSurfMenu() });
    // (short of room the scope's two-way switch folds to one button that names the shown scope and opens a menu of the two; ux, #1047)
    const scopeBtn = h('button', { type: 'button', class: 'btn small sv-scope-menu', 'aria-haspopup': 'menu', onclick: () => svScopeMenu() });
    bar.append(title, cp, scope, scopeBtn, surf1);
    head.prepend(bar);
    // (the targets' note: a head item, not part of the bar, so the fit counts it and folds it to its icon first)
    const tnote = h('span', { class: 'head-note sv-tnote', role: 'note', tabindex: '0', hidden: '' }, h('span', { class: 'sv-tn-i', 'aria-hidden': 'true', html: ICONS.targets }), h('span', { class: 'sv-tn-n', 'aria-hidden': 'true' }), h('span', { class: 'sv-tn-t' }));
    head.insertBefore(tnote, bar.nextSibling);
    // the chain strip: ‹, a segment per plane with the step between, ›
    const play = h('button', { type: 'button', class: 'sv-nav sv-play', 'aria-description': $t('Hold for speed and loop'), onclick: () => { if (SV.sheetHeld) { SV.sheetHeld = false; if (SV.els.sheet && !SV.els.sheet.hidden) SV.els.sheetSpeed.focus(); return; } svTogglePlay(); } });
    const prev = h('button', { type: 'button', class: 'sv-nav sv-prev', 'aria-label': $t('Previous plane'), 'data-tip': $t('Previous plane  ←'), onclick: () => svStep(-1) }, '‹');
    const next = h('button', { type: 'button', class: 'sv-nav sv-next', 'aria-label': $t('Next plane'), 'data-tip': $t('Next plane  →'), onclick: () => svStep(1) }, '›');
    const track = h('div', { class: 'sv-track' });
    const thumb = h('div', { class: 'sv-thumb', 'aria-hidden': 'true' });
    const speed = svSpeedSel($t('Glide speed'));
    const order = svOrderSel($t('Glide order'));
    // (the order lives in a small dialog at the strip's end, opened by its ⋯: Speed and Loop stay on the strip; a phone has the Playback sheet)
    const orderWhy = h('p', { class: 'sv-playpop-why' });
    const pathsWhy = h('p', { class: 'sv-playpop-why', hidden: '' });
    const paths = svPathsBtn('btn small sv-paths', true);
    const rowSpeed = h('label', { class: 'sv-playpop-r', hidden: '' }, h('span', {}, $t('Speed'))), rowLoop = h('label', { class: 'sv-playpop-r', hidden: '' }, h('span', {}, $t('Loop')));
    const pop = h('div', { class: 'sv-playpop', role: 'dialog', tabindex: '-1', 'aria-label': $t('Playback') },
      rowSpeed, rowLoop,
      h('label', { class: 'sv-playpop-r' }, h('span', {}, $t('Order')), order), orderWhy,
      h('label', { class: 'sv-playpop-r' }, h('span', {}, $t('Paths')), paths), pathsWhy);
    pop.hidden = true;
    const playMore = h('button', { type: 'button', class: 'icon-btn sv-playmore', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': $t('Playback'), 'data-tip': $t('Playback'), html: ICONS.more, onclick: () => svPlayPop() });
    const add = h('button', { type: 'button', class: 'sv-add', 'data-tip': $t('Add a function  +'), onclick: (e) => { e.stopPropagation(); if (svOff(e.currentTarget)) return; svAddFn(e.currentTarget); } },
      h('span', { class: 'sv-add-i', html: ICONS.plus, 'aria-hidden': 'true' }), h('span', { class: 'sv-add-t' }, $t('Add function')));
    const loop = svLoopBtn('btn small sv-loop', $t('Start over at the end'));
    const band = h('div', { class: 'sv-band', role: 'group', hidden: '' });
    // (the clear button is the strip's, over the rail's top edge: the rail scrolls and clips what is in it (#501), and inside the band it lay under the plane buttons)
    const bandx = h('button', { type: 'button', class: 'sv-bandx', hidden: '', 'aria-label': $t('Clear the range'), 'data-tip': $t('Clear the range  Esc'), onclick: () => { svClearRange(); thumb.focus(); } }, '×');
    // (F, the whole map, after the rail: it opens the Inspector's page of the composition, its domain and its guarantees; no ⋯, no drag,
    // no step of the chain; outside the rail, so it never lies over a plane or a chip of a long thread)
    const wholeMap = svChipBtn('sv-wholemap', { 'aria-pressed': 'false', 'aria-label': $t('Whole map'), 'data-tip': $t('Whole map'), onclick: (e) => { if (!svOff(e.currentTarget)) svInspect('F'); } }, '<i>F</i>', $t('Whole map'));
    const strip = h('div', { class: 'sv-strip', id: 'svStrip', role: 'toolbar', 'aria-label': $t('Planes of the chain') }, play, prev, h('div', { class: 'sv-rail' }, band, thumb, track), wholeMap, add, next, speed, loop, playMore, pop, bandx);
    const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
    // (in the plane's pane right after its head, so Tab reaches it after the head's controls; CSS draws it at the foot)
    head.after(strip);
    $('stage').append(live);
    const empty = h('div', { class: 'sv-empty', hidden: true }, $t('Add a function to send z through it.'));
    $('plotL').append(empty);
    const rail = strip.querySelector('.sv-rail');
    // (the slider is the ring that marks the place, not the thread: the thread holds the planes' and the steps' buttons,
    // which a slider's children cannot be (axe nested-interactive, ux's re-check of #448))
    thumb.removeAttribute('aria-hidden');
    thumb.setAttribute('role', 'slider'); thumb.setAttribute('tabindex', '0'); thumb.setAttribute('aria-label', $t('Place on the chain'));
    thumb.setAttribute('aria-valuemin', '0'); thumb.setAttribute('aria-orientation', 'horizontal');
    // (#549: the thread's own width too: it grows when the fonts arrive or a name changes, and a stale width left the last
    // plane's node a few pixels under the rail's edge)
    { const ro = new ResizeObserver(() => { if (SV.els) { SV.els.centres = null; svFitStrip(); svFitRail(); svSync(); } }); ro.observe(rail); ro.observe(track); }
    // (the head's width, as the observer reports it: svFitHead fits the head again when it changes, with no read of its own)
    if (typeof ResizeObserver === 'function') new ResizeObserver((es) => { const E = SV.els; if (!E) return; E.headW = Math.round(es[es.length - 1].contentRect.width); svFitHead(); }).observe(head);
    // (on a phone the bar sits in the header: its own width, as reported, keys the fit there; fonts that load late re-fit it)
    if (typeof ResizeObserver === 'function') new ResizeObserver((es) => { const E = SV.els; if (!E) return; E.barW = Math.round(es[es.length - 1].contentRect.width); svFitHead(); }).observe(bar);
    onFontsSettled(() => { svFitRail(); svFitHead(); });
    // (the rail's own scroll, by a wheel, a trackpad or a focus: where the ring is kept in view from, and its fades)
    rail.addEventListener('scroll', () => { const E = SV.els; if (E) { E.scrollX = rail.scrollLeft; svFades(); svBandSync(E.centres || []); } }, { passive: true });
    SV.els = { tnote, add, wholeMap, empty, rail, play, loop, band, bandx, speed, rowSpeed, rowLoop, paths, order, orderWhy, pathsWhy, pop, playMore, slider: thumb, bar, head, title, cp, scope, scopeBtn, surf1, SURF, SCOPES, strip, track, thumb, prev, next, live, sig: '' };
    svStripWire(strip, track);
    svFSync();
    svPlayHold();
    // (the other way to the sheet, for a screen reader's user who cannot hold: the header's ⋯ menu, which a phone shows)
    const pb = h('button', { type: 'button', class: 'icon-btn sv-playback', popovertarget: 'hdrMenu', popovertargetaction: 'hide', onclick: () => svSheet() }, h('span', { class: 'mlabel' }, $t('Playback…')));
    const sb = $('settingsBtn');
    if (sb && sb.parentNode) sb.parentNode.insertBefore(pb, sb);
  }
  // the strip's planes and steps, rebuilt when the chain changes
  // (#437: a bypassed step keeps its chip, dashed, between the dots it sits between; "+ Add function" ends the thread;
  // a step shown alone has a "Whole chain" chip at its left)
  function svBuildTrack() {
    const E = SV.els, P = svPlanes(), T = svT(), al = svAloneOk();
    const sig = P.join(',') + '|' + T + '|' + al + '|' + S.steps.map((st) => st.type + (st.on === false ? '-' : '')).join(',') + '|' + repeatBlocks().map((r) => `${r.a}-${r.b}x${r.by || r.n}`).join(',') + '|' + document.documentElement.lang + '|' + document.documentElement.classList.contains('ph');
    if (sig === E.sig) return;
    E.sig = sig;
    // (the thread is drawn again from the chain: a control with the focus on it, a chip, its ⋯, a plane's node or Whole chain, is
    // given the focus again, which an undo or a redo by the keyboard needs; one whose step has gone, the + button)
    const fa = /** @type {HTMLElement | null} */ (document.activeElement);
    let keep = null;
    if (fa && (E.track.contains(fa) || fa.classList.contains('sv-whole-pin'))) {
      const sk = /** @type {HTMLElement | null} */ (fa.closest('.sv-step'));
      keep = fa.classList.contains('sv-plane') ? { p: fa.dataset.i } : fa.classList.contains('sv-whole') ? { w: 1 } : fa.classList.contains('sv-awalk') ? { a: fa.dataset.d } : sk ? { k: +sk.dataset.k, part: fa.classList.contains('sv-more') ? 'more' : 'chip' } : null;
    }
    E.track.textContent = '';
    E.track.style.setProperty('--n', String(P.length));
    // (a phone has no room for the pill beside the thread: Whole chain is a pinned icon, the F of the whole map, outside the
    // scrolling rail, and the step's ⋯ menu carries the walk ‹ ›)
    for (const old of E.strip.querySelectorAll('.sv-whole-pin')) old.remove();
    const wholePin = () => E.strip.insertBefore(h('button', { type: 'button', class: 'sv-whole sv-whole-pin', 'aria-label': $t('Whole chain'), 'data-tip': $t('Whole chain'), onclick: () => svLeaveAlone(true) }, h('span', { class: 'sv-fk sv-pin-i', html: SV_PIN_ICON })), E.rail);
    if (al) wholePin();
    if (al && !document.documentElement.classList.contains('ph')) {
      // (Whole chain and the walk ‹ › are one pill: the walk's arrows are the step's, not the planes')
      E.track.append(h('div', { class: 'sv-alone', role: 'group', 'aria-label': $t('Step shown alone') },
        h('button', { type: 'button', class: 'sv-whole', onclick: () => svLeaveAlone(true) }, $t('Whole chain')), svWalkBtn(-1, al), svWalkBtn(1, al)));
    }
    P.forEach((k, i) => {
      if (i > 0) {
        // (a step is a stretch of the thread, which a drag moves along; its function's chip on it opens the step)
        for (let j = al ? k : P[i - 1] + 1; j < k; j++) E.track.append(svStepEl(j));
        E.track.append(svStepEl(k));
      }
      // (a plane is a node, the colour plane's filled with the wheel; its name is small: the steps are the buttons)
      E.track.append(h('button', { type: 'button', class: 'sv-plane' + (k === T ? ' cp' : ''), 'data-i': String(i), 'aria-label': k === T ? `${svName(k)}, ${$t('colour plane')}` : svName(k), 'data-tip': k === T ? $t('The colour plane') : $t('Go to {p}', { p: svName(k) }), onclick: (e) => { e.stopPropagation(); svGo(i); } },
        h('span', { class: 'sv-node', 'aria-hidden': 'true' }), h('span', { class: 'sv-pn', html: svNameHtml(k) })));
    });
    if (!al) {
      for (let j = P[P.length - 1] + 1; j <= S.steps.length; j++) E.track.append(svStepEl(j));
    }
    if (keep) {
      const el = /** @type {HTMLElement | null} */ (keep.p != null ? E.track.querySelector(`.sv-plane[data-i="${keep.p}"]`) : keep.a ? E.track.querySelector(`.sv-awalk[data-d="${keep.a}"]`) : keep.w ? svEl('whole') : svEl(keep.k, keep.part));
      const back = el && el.getClientRects().length ? el : null;
      if (back) back.focus({ preventScroll: true });
      else SV.refocus = true;   // (the + button, once it is drawn below)
    }
    // ("+ Add function" is the strip's own, after the rail, so it never lies over the thread's end)
    // (a step shown alone leaves Add and F in place, disabled, with the reason as their tip and description)
    svDisableWhy(E.add, al ? $t('Show the whole chain to add a function') : '', $t('Add a function  +'));
    svDisableWhy(E.wholeMap, al ? $t('Show the whole chain to see the whole map') : '', $t('Whole map'));
    E.wholeMap.hidden = S.steps.length < 2;   // (a one-step chain has no F chip: F is f₁ there, and selecting f₁ selects the whole map)
    E.strip.classList.toggle('sv-nof', E.wholeMap.hidden);   // (the phone's track keeps room for F only while F is there)
    // (on a phone F ends what the rail scrolls, after the last plane, with no room of its own in the strip; elsewhere it stands outside the rail)
    // (on a phone a step shown alone keeps its planes whole: F and Add, disabled, end what the rail scrolls; elsewhere they stay in the strip)
    const ph = document.documentElement.classList.contains('ph');
    if (al && ph) E.rail.append(E.wholeMap, E.add);
    else {
      if (E.add.parentNode !== E.strip) E.strip.insertBefore(E.add, E.next);
      if (ph) { if (E.wholeMap.parentNode !== E.rail) E.rail.append(E.wholeMap); }
      else if (E.wholeMap.parentNode !== E.strip) E.strip.insertBefore(E.wholeMap, E.add);
    }
    svFitStrip();
    E.add.setAttribute('aria-label', S.steps.length ? $t('Add function') : $t('Add the first function'));
    if (SV.refocus) { SV.refocus = false; if (!svOff(E.add)) E.add.focus({ preventScroll: true }); }
    svFitRail();
    // (a rebuilt chain, a split or an added step, brings the selected chip into view; a rebuild for where the ring is leaves the rail to it)
    const chain = S.steps.map((st) => st.type + (st.on === false ? '-' : '')).join(',');
    if (chain !== E.chainSig) { E.chainSig = chain; svRevealSel(true); }
  }
  // the head, the strip's states and the names: written only when what they show changed (perf A1: a glide's frame
  // writes the ring's transform alone, from the nodes' centres measured once per layout, with no forced layout)
  function svSync() {
    if (!SV.on || !SV.els) return;
    const E = SV.els, k = svStage(), T = svT(), P = svPlanes();
    svBuildTrack();
    // (the Cauchy parts in the style row read the colour plane and the kind of integral the selected curve has: the row is
    // built again when either changes)
    const footKey = S.dc === 'cauchy' ? T + '|' + (cauchyKind() || {}).kind : T;
    if (SV.footT !== footKey) { SV.footT = footKey; if (S.dc === 'cauchy') buildRightFoot(); }
    const x = SV.g.x, at = Math.round(x), parked = svParked();
    const ph = document.documentElement.classList.contains('ph');
    const sig = [k, T, SV.scope, svNoRegions() ? 1 : 0, SV.surf, at, parked ? x.toFixed(3) : '', svMoving() ? 1 : 0,
      SV.play ? 1 : 0, SV.loop ? 1 : 0, S.morphPaths !== false ? 1 : 0, S.homAll ? 1 : 0, rangeKey(), ph ? 1 : 0, E.sig,
      // (the relief's title names its height and the sheets drawn)
      SV.surf === 'land' ? `${S.height}${S.sheets ? '+' + S.sheetW : ''}` : ''].join('|');
    // (the folded key on a phone loses its head's words: as an image it keeps a name; ux on #448)
    const leg = $('leftLegend');
    if (leg && leg.getAttribute('role') === 'img' && !leg.getAttribute('aria-label')) leg.setAttribute('aria-label', SV.surf === 'land' ? $t('Height key') : $t('Colour key'));
    // (the targets' note: in the head on a desktop, in the Display sheet on a phone)
    const tn = svTargetNote(), tnShow = !!tn && !ph;
    if (E.tnote.hidden === tnShow) E.tnote.hidden = !tnShow;
    if (tn && E.tnote.dataset.sig !== tn.text) {
      E.tnote.dataset.sig = tn.text;
      E.tnote.querySelector('.sv-tn-t').textContent = tn.text;
      E.tnote.querySelector('.sv-tn-n').textContent = tn.names;
      E.tnote.setAttribute('aria-label', tn.text + '. ' + tn.tip); E.tnote.setAttribute('data-tip', tn.tip);
    }
    // (the scrubber's spoken value follows the glide and is written only when its words change: never every frame)
    const said = svReadout() + svRangeText();
    if (said !== E.said) { E.said = said; E.slider.setAttribute('aria-valuetext', said); }
    if (sig !== E.headSig) {
      E.headSig = sig;
      // (the plane's controls: in its head on a desktop, in the header on a phone, where the view switch was)
      const home = ph ? $('top') : E.head;
      if (E.bar.parentNode !== home) { if (home === E.head) home.prepend(E.bar); else home.insertBefore(E.bar, $('hdrMoreBtn')); }
      E.title.innerHTML = svFormulaHtml();
      // (on a phone the button is its wheel alone, its words in its label)
      const cpText = k === T ? $t('Colour plane') : $t('Colour from here');
      E.cp.innerHTML = `<span class="sv-dot"></span><span class="sv-cp-t">${cpText}</span>`;
      E.cp.setAttribute('aria-label', cpText);
      E.cp.setAttribute('aria-pressed', String(k === T));
      E.cp.classList.toggle('on', k === T);
      E.cp.disabled = !!svAloneOk();
      E.cp.setAttribute('data-tip', svAloneOk() ? $t('The step shown alone is coloured from its own plane') : $t('Colour every plane from this one  C'));
      const sname = (E.SURF.find((v) => v[0] === SV.surf) || E.SURF[0])[1];
      const sicon = { plane: MODE_ICONS.image, sphere: MODE_ICONS.sphere, land: MODE_ICONS['3d'] }[SV.surf] || '';
      E.surf1.innerHTML = `<span class="sv-surf-i" aria-hidden="true">${sicon}</span><span class="sv-surf-t">${sname}</span>${ICONS.chevD || ''}`; E.surf1.setAttribute('aria-label', `${$t('Surface')}: ${sname}`); E.surf1.dataset.tip = `${$t('Surface')}: ${sname}`;
      // (the Cauchy style draws everywhere: Inside regions would cut its outside part f₋ off, so the control reads Everywhere and says why it is off)
      const sc = svScope(), cWhy = S.dc === 'cauchy' ? $t('The Cauchy integral is drawn everywhere: its outside part is not cut to regions') : '';
      setSeg(E.scope, sc);
      for (const b of E.scope.querySelectorAll('button')) { /** @type {HTMLButtonElement} */ (b).disabled = !!cWhy; if (cWhy) b.dataset.tip = cWhy; }
      const scName = sc === 'in' ? $t('Inside') : $t('Everywhere');
      E.scopeBtn.innerHTML = `<span class="sv-surf-t">${scName}</span>${ICONS.chevD || ''}`;
      E.scopeBtn.setAttribute('aria-label', `${$t('Where colour shows')}: ${E.SCOPES.find((v) => v[0] === sc)[1]}`);
      E.scopeBtn.disabled = !!cWhy;
      E.scopeBtn.dataset.tip = cWhy || $t('Where colour shows');
      svFitHead();
      E.prev.disabled = at <= 0 && !svMoving() && !parked;
      E.next.disabled = at >= P.length - 1 && !svMoving() && !parked;
      // (All at once: ▶ and a click on a plane that is not the next skip the planes between the range's ends: they show dimmed, and stay planes to click)
      const R = svRange(), lo = R ? R.lo : 0, hi = R ? R.hi : svPlanes().length - 1, skip = hi - lo > 1 && svAllOk(lo, hi);
      for (const b of E.track.querySelectorAll('.sv-plane')) { const i = +b.dataset.i, on = i === at && !parked; b.classList.toggle('on', on); b.classList.toggle('sv-skip', skip && i > lo && i < hi); b.setAttribute('aria-current', on ? 'true' : 'false'); }
      $('paneL').setAttribute('aria-label', svLabel());
      // (the thread as a slider: its place in planes, said as a plane or the two it is between)
      E.slider.setAttribute('aria-valuenow', x.toFixed(2)); E.slider.setAttribute('aria-valuemax', String(P.length - 1));
      svPlaySync();
      // (#437: an empty chain has no place to go: the ring and the speed are off, and the plane says what to do)
      const none = P.length < 2;
      E.slider.setAttribute('tabindex', none ? '-1' : '0'); E.slider.setAttribute('aria-disabled', String(none));
      svDisableWhy(E.speed, none ? $t('Add a function to send z through it.') : '', $t('Glide speed'));
      const msg = [
        none ? $t('Add a function to send z through it.') : '',
        !none && svNoRegions() ? $t('Draw a region to colour it, or choose Everywhere.') : '',
      ].filter(Boolean).join(' ');
      if (E.empty.textContent !== msg) E.empty.textContent = msg;
      E.empty.hidden = !msg;
    }
    // (the ring round the shown plane's node, between two nodes in proportion to the glide)
    // (and, when the thread is longer than its rail (#497), the rail's width and the thread's, and the nodes' height (the
    // ring is centred on a node, clear of its name): measured with the centres)
    if (!E.centres || E.centresSig !== E.sig) {
      const pl = [...E.track.querySelectorAll('.sv-plane')];
      E.centres = pl.map((b) => b.offsetLeft + b.offsetWidth / 2); E.centresSig = E.sig; E.railW = E.rail.clientWidth; E.trackW = E.wholeMap.parentNode === E.rail ? E.rail.scrollWidth : E.track.offsetWidth; E.railLeft = E.rail.offsetLeft;
      const nd = pl[0] && pl[0].querySelector('.sv-node');
      if (nd) E.thumb.style.setProperty('--sv-node-y', `${(pl[0].offsetTop + nd.offsetTop + nd.offsetHeight / 2).toFixed(1)}px`);
      svFades();
    }
    const c = E.centres, j = Math.max(0, Math.min(c.length - 1, Math.floor(x + 1e-9))), u = x - j;
    svBandSync(c);
    if (!c.length) return;
    const tx = c[j] + ((c[Math.min(c.length - 1, j + 1)] ?? c[j]) - c[j]) * u;
    E.tx = tx;
    E.thumb.style.transform = `translateX(${tx.toFixed(1)}px)`;
    // (between two planes the ring is a marker over the thread, above the step's chip: ux's wave 12 sweep)
    const between = Math.abs(x - Math.round(x)) > 0.02;
    if (between !== E.between) { E.between = between; E.thumb.classList.toggle('between', between); }
    // a thread longer than its rail scrolls in it, the ring kept in view a plane's width from either end (a write, no read)
    // (#549: not while the keyboard's focus is on a plane or chip in the rail and nothing moves: Tab scrolled that control in, and
    // the ring's follow would carry the rail back to the ring, leaving the focus out of sight)
    const kf = document.activeElement, keepFocus = !!kf && kf !== E.thumb && E.rail.contains(kf) && kf.matches(':focus-visible') && !SV.anim && !SV.g.moving();
    if (keepFocus) { /* (the rail stays where the focus scrolled it) */ }
    else if (E.trackW > E.railW + 1) {
      const m = Math.min(60, E.railW / 3), s = E.scrollX ?? 0;
      // (on a phone F follows the last plane in the rail: the ring there brings the rail to its end, with F whole in view)
      const toEnd = E.wholeMap.parentNode === E.rail && !E.wholeMap.hidden && j >= c.length - 1;
      // (parked on a plane, the shown dot is centred in the rail; the rail's ends take it as near as they can. Between planes, and
      // under a drag or a glide, the ring is kept a plane's width from either end)
      // (a step shown alone keeps the rail at its start, the Whole chain pill whole)
      const want = SV.alone ? 0 : toEnd ? E.trackW : !between && !SV.anim && !SV.g.moving() && !(SV.drag && SV.drag.moved) ? tx - E.railW / 2 : tx < s + m ? tx - m : tx > s + E.railW - m ? tx - E.railW + m : s;
      // (on a phone the rail stays where svRevealSel put it while the ring is parked on the plane it was parked on; once the ring
      // moves, a jump, a glide or a drag, the ring decides again)
      let aim = want;
      if (E.hold && document.documentElement.classList.contains('ph') && !SV.alone) {
        if (E.hold.tx == null) E.hold.tx = tx;
        if (E.hold.tx === tx && !between && !SV.anim && !SV.g.moving() && !(SV.drag && SV.drag.moved)) aim = E.hold.aim; else E.hold = null;
      } else E.hold = null;
      const to = Math.max(0, Math.min(E.trackW - E.railW, Math.round(aim)));
      // (the fades follow at once: the rail's scroll event comes a frame later)
      if (to !== s) { E.rail.scrollLeft = to; E.scrollX = to; svFades(); }
    } else if (E.scrollX) { E.rail.scrollLeft = 0; E.scrollX = 0; svFades(); }
  }
  // the thread's ends fade where more of it is out of sight in the rail (#501 review): from the widths measured with the
  // centres and the scroll the rail reported, no read
  function svFades() {
    const E = SV.els;
    if (!E || E.railW == null) return;
    const s = E.scrollX || 0, over = E.trackW > E.railW + 1;
    const l = over && s > 1, r = over && s < E.trackW - E.railW - 1;
    if (l !== E.fadeL) { E.fadeL = l; E.rail.classList.toggle('fade-l', l); }
    if (r !== E.fadeR) { E.fadeR = r; E.rail.classList.toggle('fade-r', r); }
  }
  // a button's menu of choices, the current one checked (a menu's keys are its own: svKeys leaves them alone)
  function svChoiceMenu(btn, pairs, cur, label, pick) {
    openMenu(btn, Object.assign(pairs.map(([v, t]) => ({ label: t, radio: true, checked: cur === v, run: () => pick(v) })), { menuLabel: label, focusChecked: true }));
  }
  function svSurfMenu() {
    svChoiceMenu(SV.els.surf1, SV.els.SURF, SV.surf, $t('Surface'), (v) => { SV.surf = v; if (v === 'sphere') { prestartGlobe(); svPrestartSoon(300); } svApply(); tourEmit('surface-changed', { s: v }); });
  }
  function svSetScope(v) { SV.scope = v; svPrestartSoon(300); svSync(); requestRender('L'); tourEmit('scope-changed', { s: v }); }
  function svScopeMenu() { svChoiceMenu(SV.els.scopeBtn, SV.els.SCOPES, SV.scope, $t('Where colour shows'), svSetScope); }
  // "+ Add function" keeps its words while the whole thread fits beside them, and folds to the round + when the words
  // would make the thread scroll. The words' width is cached while they show, so the choice is the same before and
  // after the fold (the rail grows by exactly that width): no flicker at the edge.
  // the thread's fit to the rail, by what gives way first: "+ Add function" folds to its round + (svFitStrip), then the steps stop
  // sharing one width (each takes what its chip needs: the names stay whole), then every chip drops its name together for its
  // letters (fₖ; the chip's tooltip and its aria-label keep the name), and only then does the rail scroll. While the names fit
  // with every step as wide as the widest chip, the steps are all that width, so the planes sit evenly. Measured again only when
  // the rail's width, the chain, the fonts or the language change, never while the view moves, and a richer tier returns only
  // once it fits with SV_RAIL_HYST px to spare, so a window at the edge does not flicker. A phone's chips are the letters already
  const SV_RAIL_HYST = 8;
  const SV_RAIL_EQUAL = 0, SV_RAIL_OWN = 1, SV_RAIL_LETTERS = 2;
  function svFitRail() {
    const E = SV.els;
    if (!E || !E.track.firstElementChild || SV.anim || SV.g.moving() || (SV.drag && SV.drag.moved)) return;
    const steps = /** @type {HTMLElement[]} */ ([...E.track.querySelectorAll('.sv-step')]);
    // (the room is the rail's with "+ Add function" folded, which svFitStrip does when the names would not fit beside its words)
    // (the rail's room is what it has with no centring margin, svCentreRail's)
    const room = E.rail.clientWidth + (E.railM || 0) + (!E.add.hidden && !E.add.classList.contains('fold') && E.addLabelW ? E.addLabelW : 0);
    const key = [room, E.sig, document.fonts ? document.fonts.status : '', faceGen, I18N.lang, document.documentElement.classList.contains('ph') ? 1 : 0, E.centreLetters ? 1 : 0].join('|');
    if (key === E.railKey) return;
    E.railKey = key;
    if (document.documentElement.classList.contains('ph') || !steps.length || !room) {
      svCentreRail(E, 0);
      svLeadF(E);
      E.strip.classList.remove('sv-letters');
      E.track.style.removeProperty('--sv-step-w');
      E.railMode = SV_RAIL_EQUAL;
      return;
    }
    const fixed = [...E.track.children].reduce((a, c) => a + (c.classList.contains('sv-step') ? 0 : /** @type {HTMLElement} */ (c).offsetWidth), 0);
    // (the steps' widths when each takes the width its chip needs, with the names or with the letters alone)
    const measure = (letters) => {
      E.strip.classList.add('sv-measure');
      E.strip.classList.toggle('sv-letters', letters);
      const ws = steps.map((st) => st.offsetWidth), w = Math.max(...ws);
      E.strip.classList.remove('sv-measure');
      return { w, equal: fixed + w * ws.length, own: fixed + ws.reduce((a, b) => a + b, 0) };
    };
    const names = measure(false), letters = measure(true);
    const was = E.railMode == null ? SV_RAIL_EQUAL : E.railMode;
    const fits = (total, mode) => total <= room - (mode < was ? SV_RAIL_HYST : 0);
    const mode = E.centreLetters ? SV_RAIL_LETTERS : fits(names.equal, SV_RAIL_EQUAL) ? SV_RAIL_EQUAL : fits(names.own, SV_RAIL_OWN) ? SV_RAIL_OWN : SV_RAIL_LETTERS;
    E.railMode = mode;
    E.strip.classList.toggle('sv-letters', mode === SV_RAIL_LETTERS);
    if (mode === SV_RAIL_OWN) E.track.style.removeProperty('--sv-step-w');
    else E.track.style.setProperty('--sv-step-w', `${mode === SV_RAIL_LETTERS ? letters.w : names.w}px`);
    svCentreRail(E, mode === SV_RAIL_EQUAL ? names.equal : mode === SV_RAIL_OWN ? names.own : letters.own);
  }
  // On a phone F ends what the rail scrolls. When the thread plus F overflows the rail by less than F's own width, F would lie
  // partly in view at rest, cut by the rail's edge; a lead margin before F makes the overflow exactly F's width, so F lies fully
  // past the edge at rest and whole at the rail's end, with at most that margin as blank track before it. The margin is a
  // function of the rail's and the thread's widths, so a glide (svFitRail returns first) never changes it.
  function svLeadF(E) {
    const F = E.wholeMap, own = F.style.marginLeft;
    if (F.hidden || F.parentNode !== E.rail || E.rail.lastElementChild !== F) { if (own) { F.style.marginLeft = ''; E.centres = null; E.scrollX = E.rail.scrollLeft; } return; }
    // (the overflow without the margin, read with it in place: taking it off to measure would shrink the rail's scroll range under
    // its scroll position, and the browser would clamp that without a scroll event for the position svSync keeps)
    const over = E.rail.scrollWidth - E.rail.clientWidth - (parseFloat(own) || 0), fw = F.offsetWidth;
    const lead = over > 1 && over < fw ? Math.ceil(fw - over) : 0;
    if (lead) F.style.marginLeft = `${lead}px`;
    else F.style.marginLeft = '';
    if ((lead ? `${lead}px` : '') !== own) { E.centres = null; E.scrollX = E.rail.scrollLeft; }
  }
  // (CSS px: a centring margin smaller than this is none, and a change smaller than this leaves the margin as it is)
  const SV_CENTRE_MIN = 0.5;
  // The thread is centred on the pane: the rail gives up, on the side of the narrower group, what the wider group takes
  // (▶ ‹ stay at the left edge, the right group at the right edge), so the first and last dots lie evenly about the pane's
  // centre line. It gives up no more than leaves the thread its width (need): a tight pane shifts the thread as little as
  // it must, and one that cannot hold it scrolls as before. Called with a fitted rail only, never during a glide
  // (svFitRail returns first), so a resize recentres and a play never moves the rail. A phone centres in the rail (CSS).
  function svCentreRail(E, need) {
    const rail = E.rail, was = E.railM || 0;
    let ml = 0, mr = 0;
    if (need > 0 && !document.documentElement.classList.contains('ph')) {
      const sr = E.strip.getBoundingClientRect(), rr = rail.getBoundingClientRect(), cs = getComputedStyle(E.strip);
      const wasL = parseFloat(rail.style.marginLeft) || 0, wasR = parseFloat(rail.style.marginRight) || 0;
      const left = rr.left - wasL - (sr.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth));
      const right = (sr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)) - (rr.right + wasR);
      const m = Math.max(0, Math.min(Math.abs(right - left), rr.width + wasL + wasR - need));
      if (m >= SV_CENTRE_MIN) { if (right > left) ml = m; else mr = m; }
    }
    const next = ml + mr;
    if (Math.abs(next - was) < SV_CENTRE_MIN && (parseFloat(rail.style.marginLeft) || 0) === ml) return;
    rail.style.marginLeft = ml ? `${ml.toFixed(1)}px` : ''; rail.style.marginRight = mr ? `${mr.toFixed(1)}px` : '';
    E.railM = next; E.centres = null;
    E.strip.dataset.centre = next > 0 ? 'shift' : 'none';
  }
  // the strip's width gives way in this order until the thread fits, centred on the pane where it can be: "+ Add function"
  // folds to its round +, Speed and Loop move into the Playback ⋯, the Whole chain pill folds to its pin, and last the rail
  // scrolls. A phone has only the first (its words are hidden by CSS; the rest of its strip is the sheet's).
  const SV_FOLD_ADD = 1, SV_FOLD_PLAY = 2, SV_FOLD_WHOLE = 3;
  // the Whole chain pin: three nodes on a line (the chain), not the F of the whole map
  const SV_PIN_ICON = '<svg viewBox="0 0 18 10" width="18" height="10" aria-hidden="true"><path d="M4 5h10" stroke="currentColor" stroke-width="1.4"/><circle cx="3" cy="5" r="2.2" fill="var(--surface)" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="5" r="2.2" fill="var(--surface)" stroke="currentColor" stroke-width="1.4"/><circle cx="15" cy="5" r="2.2" fill="var(--surface)" stroke="currentColor" stroke-width="1.4"/></svg>';
  function svFitStrip() {
    const E = SV.els; if (!E || !E.add) return;
    if (!E.track.firstElementChild) { E.add.classList.remove('fold'); E.strip.classList.remove('sv-fold-play', 'sv-fold-whole'); svFoldPlay(false); return; }
    const add = E.add, t = add.querySelector('.sv-add-t');
    const shown = t.offsetWidth > 0;
    if (shown) E.addLabelW = add.offsetWidth - add.offsetHeight;
    const first = E.track.firstElementChild, last = [...E.track.children].filter((c) => c !== E.add && c !== E.wholeMap).pop() || first;
    const ph = document.documentElement.classList.contains('ph');
    // (the rail's width less what the label takes while it is shown, read before the fold changes it)
    const addRoom = () => E.rail.clientWidth - (add.classList.contains('fold') ? E.addLabelW : 0);
    const addFolds = (room) => add.classList.toggle('fold', last.offsetLeft + last.offsetWidth - first.offsetLeft > room || E.railMode === SV_RAIL_LETTERS);
    const apply = (lv) => {
      add.classList.toggle('fold', lv >= SV_FOLD_ADD || E.railMode === SV_RAIL_LETTERS);
      E.strip.classList.toggle('sv-fold-play', lv >= SV_FOLD_PLAY);
      E.strip.classList.toggle('sv-fold-whole', lv >= SV_FOLD_WHOLE);
    };
    if (ph) {
      if (E.addLabelW == null) return;
      addFolds(addRoom());
      return;
    }
    // (the whole order applies to a step shown alone, whose pill and planes need the room, and to a one-step chain, whose short thread is centred; a chain keeps Speed and Loop on the strip,
    // and its thread gives way by the steps' own widths, svFitRail's)
    // (a chain of one step, not a step shown alone: the alone view has its own pill and walk, and keeps the first level that fits)
    const one = nSteps() === 1;
    if (!E.strip.querySelector('.sv-whole-pin') && !one) {
      const room = addRoom();
      apply(0);
      if (E.addLabelW != null) addFolds(room);
      svFoldPlay(false);
      return;
    }
    // (each level is tried as it would stand: the folds made, the steps fitted to the rail, and the rail's own overflow read; the
    // first level that does not overflow stands, else the last, the rail scrolling)
    // (a one-step thread must also sit on the strip's centre line; when no level centres it with the names, the chips take their
    // letters, svFitRail's)
    const stands = () => E.rail.scrollWidth <= E.rail.clientWidth + 1 && (!one || Math.abs(svThreadOff(E)) <= SV_CENTRE_TOL);
    const tryLevels = () => {
      for (let lv = 0; lv <= SV_FOLD_WHOLE; lv++) {
        apply(lv); svFoldPlay(lv >= SV_FOLD_PLAY);
        E.railKey = null; svFitRail();
        if (stands() || lv === SV_FOLD_WHOLE) return stands();
      }
      return false;
    };
    E.centreLetters = false;
    if (!tryLevels() && one) {
      E.centreLetters = true;
      if (!tryLevels()) { E.centreLetters = false; tryLevels(); }
    }
  }
  // (CSS px) how far a one-step thread may lie from the strip's centre line: under the layout suite's 4 px, which allows for rounding in its own measure
  const SV_CENTRE_TOL = 3;
  // the middle of the thread (first node to last) less the strip's centre, in CSS px
  function svThreadOff(E) {
    const nodes = E.track.querySelectorAll('.sv-plane .sv-node');
    if (!nodes.length) return 0;
    const a = nodes[0].getBoundingClientRect(), b = nodes[nodes.length - 1].getBoundingClientRect(), s = E.strip.getBoundingClientRect();
    return (a.left + a.right + b.left + b.right) / 4 - (s.left + s.right) / 2;
  }
  // Speed and Loop are on the strip, or, when it has no room for them, in the Playback ⋯ beside Order and Paths
  function svFoldPlay(on) {
    const E = SV.els;
    if (on === (E.speed.parentNode !== E.strip)) return;
    if (on) { E.rowSpeed.append(E.speed); E.rowLoop.append(E.loop); } else { E.strip.insertBefore(E.speed, E.playMore); E.strip.insertBefore(E.loop, E.playMore); }
    E.rowSpeed.hidden = E.rowLoop.hidden = !on;
  }
  // the head on one row (#441): beside the plane's controls it keeps the style row, a ⋯ and the lamp (#247 keeps the
  // style row in the head whatever the room). When they do not fit, the colour-plane button gives up its words first
  // (its wheel stays, its words in its name and tooltip, as on a phone), then the title its role ("phase of f₂", also in
  // the plane's accessible name). Read and written only when the head's width or the words in it change (the observer,
  // or a new title, button or surface), and never while the view moves (#320)
  // svFitHead's chip fit: the head is one row while it is under SV_HEAD_ROW px tall (40 px minimum, with 4 px for
  // the border and rounding). Short of room, a chip's name gives up its width in SV_NAME_STEP px steps (a few letters
  // each, so the fit takes few layouts), and once it is down to a step the chip drops it: it is the chip's tooltip and
  // its button's name, and the chip keeps what is not the name (the tool's count, the button, then Esc last)
  const SV_HEAD_ROW = 44, SV_NAME_STEP = 16;
  // the foot's ⋯ button and the gap before it: what the head's foot takes beside its first row
  const SV_FOOT_MORE = 4 + 26;
  function svChipBare(chip, bare) {
    const t = chip.querySelector('.mc-t');
    const act = /** @type {HTMLElement | null} */ (chip.querySelector('.mc-stop, .icon-btn'));
    chip.classList.toggle('mc-bare', bare);
    if (!t || !act) return;
    if (act.dataset.name === undefined) act.dataset.name = act.getAttribute('aria-label') || '';
    if (bare) {
      chip.setAttribute('data-tip', t.textContent);
      act.setAttribute('aria-label', `${act.dataset.name}: ${t.textContent}`);
    } else {
      chip.removeAttribute('data-tip');
      act.setAttribute('aria-label', act.dataset.name);
    }
  }
  // the title's tooltip, its whole words, while the head shows its role as one word
  function svTitleTip(short) {
    const t = SV.els.title;
    if (short) t.setAttribute('data-tip', t.textContent); else t.removeAttribute('data-tip');
  }
  function svFitHead() {
    const E = SV.els;
    if (!E || !E.head) return;
    // (not while the view moves: the title changes half-way through a glide, and a fit then is a forced layout in a frame;
    // a view parked between two planes is at rest and is fitted; svSync's head key holds svMoving(), so the head is fitted
    // once when the glide settles; rework on #473)
    if (SV.anim || SV.g.moving() || (SV.drag && SV.drag.moved)) return;
    const ph = document.documentElement.classList.contains('ph');
    const mc = $('modeChips');
    const key = [
      ph ? 1 : 0, ph ? E.barW || 0 : E.headW || 0, document.fonts ? document.fonts.status : '', faceGen, E.title.innerHTML,
      E.cp.textContent, E.surf1.textContent, E.scopeBtn.textContent, I18N.lang, mc && !mc.hidden ? mc.dataset.sig : '', E.tnote.hidden ? '' : E.tnote.dataset.sig,
    ].join('|');
    if (key === E.fitKey) return;
    E.fitKey = key;
    // (the levels, in the order the head gives way: the scope's switch is a menu button (sv-sm), the colour-plane button is its
    // wheel alone (sv-c1), the surface button is its icon and ▾ (sv-si), the title's role is its first word (sv-rs), then the title
    // loses its role (sv-c2) last; a word is never cut)
    const set = (lvl) => { E.bar.classList.toggle('sv-sm', lvl >= 1); E.bar.classList.toggle('sv-c1', lvl >= 2); E.bar.classList.toggle('sv-si', lvl >= 3); E.bar.classList.toggle('sv-rs', lvl >= 4); E.bar.classList.toggle('sv-c2', lvl >= 5); };
    if (mc) {
      for (const c of mc.querySelectorAll('.mode-chip')) {
        svChipBare(c, false);
        c.classList.remove('mc-nokey');
        const t = /** @type {HTMLElement | null} */ (c.querySelector('.mc-t'));
        if (t) t.style.removeProperty('max-width');
      }
    }
    // (a phone: the header holds the bar beside the menu button; short of room (360 px, Russian) the surface button is
    // its icon and ▾ alone, its name in its label and tooltip; phone on #473)
    E.bar.classList.remove('sv-c3', 'sv-c4');
    const legend = $('leftLegend');
    E.head.classList.remove('sv-lg');
    if (legend) legend.classList.remove('glyph');
    if (ph) {
      set(0);
      // (then, still short, as on w₁ at 360 px whose name is wider than z's, the bar's gaps and the scope's padding
      // tighten; eyes on #473)
      const more = $('hdrMoreBtn'), mr = more && more.getClientRects().length ? more.getBoundingClientRect() : null;
      const short = () => E.bar.scrollWidth > E.bar.clientWidth + 1 || (mr && E.surf1.getBoundingClientRect().right > mr.left - 2);
      if (short()) E.bar.classList.add('sv-c3');
      if (short()) E.bar.classList.add('sv-c4');
      return;
    }
    set(0);
    const tn = E.tnote.hidden ? null : E.tnote;
    E.tnote.classList.remove('tn-chip', 'tn-icon');
    const head = E.head, cs = getComputedStyle(head), gap = parseFloat(cs.columnGap) || 8;
    const room = head.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // (what the rest of the head takes at the least: the strip as its first row (the style row, or the Landscape's height) and a ⋯, every other shown item as it is,
    // a stretchy spacer as nothing; a gap before each)
    const dc = $('dcSeg'), hs = $('heightSeg'), foot = $('leftFoot');
    let keep = 0;
    for (const c of head.children) {
      if (c === E.bar || !c.getClientRects().length) continue;
      const m = getComputedStyle(c);
      const w = c === foot ? (dc && dc.getClientRects().length ? dc.getBoundingClientRect().width : hs && hs.getClientRects().length ? hs.getBoundingClientRect().width : 0) + SV_FOOT_MORE : c.classList.contains('grow') ? 0 : c.getBoundingClientRect().width;
      keep += w + parseFloat(m.marginLeft) + parseFloat(m.marginRight) + gap;
    }
    keep += 2;
    // (the Height key's chip folds to its glyph (sv-lg, which the pane head's own fit, fitTitle in 09-pane-titles.js, keeps) before the bar's controls shorten,
    // and after the targets' note; its words stay its accessible name)
    const legFoldable = !!(legend && legend.parentNode === head && legend.getClientRects().length);
    let legFolded = false;
    const levels = (legOk) => {
      let l = 0;
      set(0);
      while (l < 5 && E.bar.scrollWidth + keep > room) {
        if (legOk && legFoldable && !legFolded) {
          const w0 = legend.getBoundingClientRect().width;
          legend.classList.add('glyph'); head.classList.add('sv-lg'); legFolded = true;
          keep -= w0 - legend.getBoundingClientRect().width;
          continue;
        }
        set(++l);
      }
      return l;
    };
    let lvl = levels(!tn);
    svTitleTip(lvl >= 4);
    // (short of room, the targets' note folds first, before the bar's controls shorten and before any mode chip: to its icon and
    // the source planes' names, then to its icon alone)
    for (const cls of ['tn-chip', 'tn-icon']) {
      if (!lvl || !tn) break;
      const w0 = tn.getBoundingClientRect().width;
      tn.classList.add(cls);
      keep -= w0 - tn.getBoundingClientRect().width;
      lvl = levels(false);
      svTitleTip(lvl >= 4);
    }
    if (tn && lvl) { lvl = levels(true); svTitleTip(lvl >= 4); }
    // (the levels settled, the key is unfolded again if the bar still fits beside it)
    if (legFolded) {
      const w1 = legend.getBoundingClientRect().width;
      legend.classList.remove('glyph'); head.classList.remove('sv-lg');
      // (the chip's own width: its words, not the width a squeezed chip is left with)
      const sum = /** @type {HTMLElement | null} */ (legend.querySelector('.lg-sum'));
      const dw = legend.getBoundingClientRect().width + (sum ? sum.scrollWidth - sum.clientWidth : 0) - w1;
      if (E.bar.scrollWidth + keep + dw > room) { legend.classList.add('glyph'); head.classList.add('sv-lg'); } else keep += dw;
    }
    // (the mode chips are the head's own items, counted above. Short of room even then, the plane never moves for a
    // chip: a chip's name shrinks, then goes, one chip after another)
    if (mc && !mc.hidden) {
      const wraps = () => head.getBoundingClientRect().height > SV_HEAD_ROW;
      const chips = /** @type {NodeListOf<HTMLElement>} */ (mc.querySelectorAll('.mode-chip'));
      for (const c of chips) {
        const t = /** @type {HTMLElement | null} */ (c.querySelector('.mc-t'));
        if (!t || !wraps()) continue;
        let w = Math.ceil(t.getBoundingClientRect().width);
        // (the Listening chip's name is its whole label: it goes at once, and Stop stays)
        if (c.dataset.mode !== 'listen') {
          while (wraps() && w > SV_NAME_STEP) { w -= SV_NAME_STEP; t.style.maxWidth = w + 'px'; }
        }
        if (wraps()) svChipBare(c, true);
        if (wraps()) c.classList.add('mc-nokey');   // (the Esc hint goes last; the key still works)
      }
    }
    // (the strip in the head fits its controls to the room the bar now leaves)
    if (typeof layoutFoot === 'function') layoutFoot(true);
  }
  // where the view is on the thread, in words: a plane, or the two planes it is between
  // the targets' note: what the shown plane draws or shades because of shapes on the planes after it, named by where they come
  // from ("Drawn from w₂'s targets"), with the map that carries them here in its tooltip; null when nothing of theirs shows here.
  // The words are made again only when the planes, their shapes' kinds or the shown plane change
  let svTnKey = '', svTnVal = null;
  function svTargetNote() {
    const j = svStage(), by = new Map();
    for (const q of S.shapes) {
      const st = shapeStage(q);
      if (q.visible === false || st <= j || kindType(q) === 'point') continue;
      if (!by.has(st)) by.set(st, [0, 0]);
      by.get(st)[kindType(q) === 'area' ? 0 : 1]++;
    }
    const key = `${j}|${I18N.lang}|${[...by].map(([st, c]) => st + ':' + c).join(',')}|${chainSig[nSteps()]}`;
    if (key === svTnKey) return svTnVal;
    svTnKey = key;
    if (!by.size) return (svTnVal = null);
    const stages = [...by.keys()].sort((a, b) => a - b), na = [...by.values()].reduce((n, c) => n + c[0], 0), nc = [...by.values()].reduce((n, c) => n + c[1], 0);
    const names = stages.map(svName), p = new Intl.ListFormat(I18N.lang, { type: 'conjunction' }).format(names), one = stages.length === 1, x = svMapName('plain', j, stages[stages.length - 1]);
    const text = na && nc ? (one ? $t('Shaded and drawn from {p}\'s targets', { p }) : $t('Shaded and drawn from the targets of {p}', { p }))
      : na ? (one ? $t('Shaded from {p}\'s targets', { p }) : $t('Shaded from the targets of {p}', { p }))
        : one ? $t('Drawn from {p}\'s targets', { p }) : $t('Drawn from the targets of {p}', { p });
    const tip = na && nc ? $t('Where {x} lands in the targets of {p} is shaded here; the curves it maps onto them are drawn here.', { x, p })
      : na ? $t('Where {x} lands in the targets of {p} is shaded here.', { x, p }) : $t('The curves that {x} maps onto the targets of {p} are drawn here.', { x, p });
    return (svTnVal = { text, tip, names: p });
  }
  // the thread's place as the scrubber speaks it, in the classic Deformation readout's words: inside a step "Step 1 of 2 · f₁ · 84 %",
  // across a span that glides all at once "All steps at once · 84 %", on a plane "Plane w₁, 2 of 3"; the percentage is whole, so the
  // text changes only when it does
  function svReadout() {
    const P = svPlanes(), x = Math.max(0, Math.min(P.length - 1, SV.g.x)), r = Math.round(x), sp = SV.span;
    if (sp && x > sp.x0 + SV_REST_U && x < sp.x1 - SV_REST_U) return $t('All steps at once · {p} %', { p: I18N.num(Math.round(100 * (x - sp.x0) / (sp.x1 - sp.x0))) });
    if (Math.abs(x - r) <= SV_REST_U) return $t('Plane {p}, {i} of {n}', { p: svName(P[r]), i: I18N.num(r + 1), n: I18N.num(P.length) });
    const a = Math.floor(x), k = P[a + 1];
    return $t('Step {k} of {m} · {f} · {p} %', { k: I18N.num(a + 1), m: I18N.num(P.length - 1), f: isDeriv(k) ? 'd/dz' : 'f' + sub(k), p: I18N.num(Math.round(100 * (x - a))) });
  }
  function svPlaceText() {
    const P = svPlanes(), x = SV.g.x;
    if (!svParked()) return svName(svStage());
    return $t('Between {a} and {b}', { a: svName(P[Math.floor(x)]), b: svName(P[Math.min(P.length - 1, Math.ceil(x))]) });
  }
  function svSetT(k) {
    // (#437: a step shown alone is coloured from its own plane; the button says so, and so does the key)
    if (SV.alone) { if (SV.els && SV.els.live) SV.els.live.textContent = $t('The step shown alone is coloured from its own plane'); return; }
    SV.T = k === svPlanes()[svPlanes().length - 1] ? -1 : k;
    svApply();
    save();
    tourEmit('colour-plane-set', { k });
    if (SV.els && SV.els.live) SV.els.live.textContent = svLabel();
    // (the programs a new colour plane needs, started when the page is idle: else they link on the first glide past it,
    // 8 s on WARP for the Mountain King; tiers on #456)
    svPrestartSoon(0);
  }
  // the tour's own placing of the view (#442): plane i at once, the colour plane T (an index among the planes; -1 the last), the
  // scope and the surface; sends none of the events the user's own moves send
  function svTourPlace(o) {
    if (!SV.on || !SV.els || !o) return false;
    const P = svPlanes();
    if (o.T != null) SV.T = o.T < 0 || o.T >= P.length - 1 ? -1 : P[o.T];
    if (o.scope) SV.scope = o.scope;
    if (o.surf) SV.surf = o.surf;
    if (o.scope || o.surf) svPrestartSoon(300);
    if (o.i != null) svPause(false);
    if (o.i != null) { const i = Math.max(0, Math.min(P.length - 1, o.i | 0)); SV.anim = null; SV.g.max = P.length - 1; SV.g.set(i); SV.i = i; SV.at = i; }
    svApply();
    save();
    return true;
  }
  // the phone's Sphere key on the plane (#471): in the steps view it toggles the view's surface between Plane and Sphere; null
  // outside it, where the key works the pane's own tabs
  function svSphereKey() {
    if (!SV.on) return null;
    SV.surf = SV.surf === 'sphere' ? 'plane' : 'sphere';
    if (SV.surf === 'sphere') { prestartGlobe(); svPrestartSoon(300); }
    svApply();
    tourEmit('surface-changed', { s: SV.surf });
    return SV.surf;
  }
  let svToastWired = false;
  // the strip: a press on a plane goes there; a drag along it scrubs through the deformation, and the glide settles on
  // the nearest plane when it is let go
  function svStripWire(strip, track) {
    const rail = strip.querySelector('.sv-rail');
    // (Tab to a plane or chip (the whole-map chip too) that the rail shows only in part scrolls it fully in, clear of the fade; the browser's own
    // focus scroll leaves a control that is partly in view where it is. The ring's own focus is kept in view by svSync)
    rail.addEventListener('focusin', (e) => { const t = /** @type {HTMLElement} */ (e.target); if (t && t.closest && t.closest('.sv-plane, .sv-fchip, .sv-wholemap, .sv-more') && t.matches(':focus-visible')) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });   // (the keyboard's focus only: a press focuses too, and the thread must not move under a finger)
    // (a press on a message's body dismisses it; its own buttons keep their action)
    const th = document.getElementById('toastHost');
    if (th && !svToastWired) {
      svToastWired = true;
      th.addEventListener('click', (e) => {
        const t = e.target instanceof Element ? e.target.closest('.toast') : null;
        if (t && SV.on && !(e.target instanceof Element && e.target.closest('button'))) t.remove();
      });
    }
    // (the thread's position under the pointer: between the centres of the planes' nodes, in proportion)
    const posX = (e) => {
      const ns = [...track.querySelectorAll('.sv-plane')].map((b) => { const r = b.getBoundingClientRect(); return r.left + r.width / 2; });
      if (ns.length < 2) return 0;
      const x = e.clientX;
      if (x <= ns[0]) return 0;
      for (let i = 1; i < ns.length; i++) if (x <= ns[i]) return i - 1 + (x - ns[i - 1]) / Math.max(1, ns[i] - ns[i - 1]);
      return ns.length - 1;
    };
    rail.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.sv-fwrap, .sv-wholemap, .sv-add, .sv-whole, .sv-awalk, .sv-bandx')) return;
      const d = SV.drag = { id: e.pointerId, px: e.clientX, moved: false, strip: true };
      svRangeDown(d, e, rail, posX);
      try { rail.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic pointer) */ }
    });
    // (a press on the thread away from the planes and the chips goes there too)
    rail.addEventListener('click', (e) => {
      if (SV.dragEndT && performance.now() - SV.dragEndT < 50) return;
      if (e.target.closest('.sv-fwrap, .sv-wholemap, .sv-plane, .sv-add, .sv-whole, .sv-awalk, .sv-bandx')) return;
      svOutsideBand(posX(e));
      SV.span = null; SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1; svLetGo(true);
    });
    rail.addEventListener('pointermove', (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      if (svRangeMove(d, e, posX)) return;
      if (!d.moved && Math.abs(e.clientX - d.px) < 6) return;
      if (!d.moved) { svPause(false); svKeepView(); SV.anim = null; }
      d.moved = true;
      SV.span = null; SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1;
      requestRender('L');
    });
    const up = (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      SV.drag = null;
      if (svRangeUp(d, rail)) { e.preventDefault(); return; }
      if (d.moved) { e.preventDefault(); SV.dragEndT = performance.now(); svLetGo(); }
    };
    rail.addEventListener('pointerup', up);
    rail.addEventListener('pointercancel', up);
    // (a click that ended a scrub is not a press on the plane under it)
    rail.addEventListener('click', (e) => { if (SV.dragEndT && performance.now() - SV.dragEndT < 50) e.stopPropagation(); }, true);
  }
  // a touch swipe that starts at the plane's left or right edge moves through the planes; anywhere else the plane
  // pans and draws as ever
  function svEdgeSwipe() {
    const plot = $('plotL'), EDGE = 28;
    plot.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const r = plot.getBoundingClientRect();
      const edge = e.clientX - r.left < EDGE ? 'L' : r.right - e.clientX < EDGE ? 'R' : null;
      if (!edge) return;
      e.stopImmediatePropagation(); e.preventDefault();
      svPause(false);
      svKeepView();
      SV.anim = null;
      SV.span = null;
      SV.drag = { id: e.pointerId, px: e.clientX, w: r.width, x0: SV.g.x, moved: true, edge, t0: e.timeStamp };
      try { plot.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic pointer) */ }
    }, true);
    plot.addEventListener('pointermove', (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.edge) return;
      e.stopImmediatePropagation();
      // a finger across the whole plane is one plane
      SV.g.set(Math.max(0, Math.min(svPlanes().length - 1, d.x0 - (e.clientX - d.px) / (0.8 * d.w))));
      SV.g.max = svPlanes().length - 1;
      requestRender('L');
    }, true);
    const up = (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.edge) return;
      e.stopImmediatePropagation();
      SV.drag = null;
      const dx = e.clientX - d.px;
      // a flick (short and quick) goes one plane on; otherwise the view stays where it was let go. (The events' own times:
      // a stalled frame between them delays the handler, not the finger; phone on #448)
      if (Math.abs(dx) > 40 && e.timeStamp - d.t0 < 300) svGo(dx < 0 ? Math.floor(d.x0 + SV_REST_U) + 1 : Math.ceil(d.x0 - SV_REST_U) - 1);
      else svLetGo();
    };
    plot.addEventListener('pointerup', up, true);
    plot.addEventListener('pointercancel', up, true);
  }
  // let go on the thread at x: near a plane (an eighth of a step) it settles there; anywhere else it stays, showing the
  // deformation at that place (press: a press, which glides there first)
  function svLetGo(press) {
    const P = svPlanes(), x = Math.max(0, Math.min(P.length - 1, SV.g.x)), r = Math.round(x);
    if (Math.abs(x - r) < 0.125) { if (press) { svGo(r); return; } SV.g.set(r); svArrive(); return; }
    SV.anim = null;
    SV.g.set(x);
    SV.i = r;
    // (parked nearer a plane past the first, a pan or a zoom changes V.left, which the parked frames hand to the camera
    // every plane shares (svKeepView): V.left starts as that camera, as svApply sets it, so the parked frame keeps the
    // view the held one had)
    if (svStage() > 0) Object.assign(V.left, S.srcView);
    svSync();
    requestRender('L', 'OL');
    const live = SV.els && SV.els.live;
    if (live) live.textContent = $t('Between {a} and {b}', { a: svName(P[Math.floor(x)]), b: svName(P[Math.ceil(x)]) });
    SV.at = null;
    tourEmit('thread-parked', { x });
  }
  // a dialog, a menu, a popover, a pop-up or a phone sheet is open over the page (its keys are its own)
  function svLayerOpen() {
    if (document.querySelector('#popHost > *, .modal-bg, dialog[open], .snd-pop:not([hidden]), .ph-sheet:not([hidden]), .sv-sheet:not([hidden])')) return true;
    try { return !!document.querySelector(':popover-open'); } catch (e) { return false; }
  }
  // a quarter of a step along the thread, at once (it stops between two planes, or settles on one it reaches)
  function svNudge(d) {
    const P = svPlanes(), from = SV.anim ? SV.anim.to : SV.g.x;
    svPause(false);
    SV.anim = null;
    svKeepView();
    SV.span = null;
    SV.g.set(Math.max(0, Math.min(P.length - 1, Math.round((from + d) * 4) / 4)));
    SV.g.max = P.length - 1;
    svLetGo();
  }
  // ← → move through the planes, also with a plane focused (a selected shape keeps them to nudge it), C makes the shown
  // plane the colour plane (not while typing)
  function svKeys() {
    document.addEventListener('keydown', (e) => {
      if (!SV.on || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = /** @type {HTMLElement} */ (e.target);
      // (#437: Esc brings the whole thread back from a step shown alone, unless a layer is open: its own Esc)
      if (e.key === 'Escape' && SV.alone && !svLayerOpen() && !(t && t.closest && t.closest('input, select, textarea, [contenteditable]'))) { e.preventDefault(); e.stopImmediatePropagation(); svLeaveAlone(true); return; }
      // (on the thread itself, a slider: ← → move a quarter of a step and stop there, Home / End go to z and the last plane)
      const onRail = !!(t && t.classList && t.classList.contains('sv-thumb'));
      // (Shift+← → on the ring: the range, a plane at a time, #438)
      if (onRail && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); e.stopImmediatePropagation(); svRangeExtend(e.key === 'ArrowRight' ? 1 : -1); return; }
      if (onRail && (e.key === 'Home' || e.key === 'End')) { e.preventDefault(); e.stopImmediatePropagation(); svGo(e.key === 'Home' ? 0 : svPlanes().length - 1); return; }
      // (Shift+← → anywhere, or ← → on the thread: a quarter of a step, so the view can stop between two planes)
      // (the keys of a control that has focus, or of an open dialog, menu, popover or sheet, are its own (ux's review of
      // #448; the classic key handler's exclusions, 14-interaction.js): only the thread's own keys pass)
      if (!onRail && (svLayerOpen() || (t && t.closest && t.closest('[role="listbox"], [role="option"], [role="radiogroup"], [role="radio"], [role="menu"], [role="menuitem"], [role="slider"], [role="dialog"], input, select, textarea, [contenteditable], #propsPanel, .ph-sheet, .cm-palette, #popHost')))) return;
      if ((e.shiftKey || onRail) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); e.stopImmediatePropagation();
        svNudge(e.key === 'ArrowRight' ? 0.25 : -0.25);
        return;
      }
      // (K or M plays and pauses; Esc pauses, or else clears the range, #438. By the Latin letter of the physical key, so
      // that a Russian layout's Л, Ь, З and С work as K, M, P and C)
      const lk = (I18N.keyOf(e) || e.key || '').toLowerCase();
      if ((lk === 'k' || lk === 'm') && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); svTogglePlay(); return; }
      // (P: the paths, as in the classic deformation)
      if (lk === 'p' && !e.shiftKey && SV.els && SV.els.paths && !SV.els.paths.disabled) { e.preventDefault(); e.stopImmediatePropagation(); SV.els.paths.click(); return; }
      if (e.key === 'Escape' && (SV.play || svRange())) { e.preventDefault(); e.stopImmediatePropagation(); if (SV.play) svPause(true); else svClearRange(); return; }
      // (PageUp / PageDown on a focused plane too; ← → always step the chain, the sound probe's arrows being Alt / Option +
      // arrow, except while a shape is selected, which they nudge while the focus is on a plane (14-interaction.js))
      const page = e.key === 'PageUp' || e.key === 'PageDown';
      if (!page && ((selected && /^Arrow(Left|Right)$/.test(e.key) && t && t.closest && t.closest('canvas, #paneL, #paneR')))) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || page) {
        e.preventDefault(); e.stopImmediatePropagation();
        svStep(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1);
      } else if (lk === 'c' && !e.shiftKey) {
        e.preventDefault(); e.stopImmediatePropagation();
        svSetT(svStage());
      }
    }, true);
  }
  // the chain changed: the shown plane and the colour plane stay on their stages when they still exist
  function svChainChanged() {
    if (!SV.on || !SV.els) return;
    svKeepView();
    svShifted();
    if (SV.alone && !svAloneOk()) svLeaveAlone(false);
    if (SV.play && !SV.motionKept) svPause(false);
    SV.motionKept = false;
    const P = svPlanes();
    if (SV.i > P.length - 1) { SV.i = P.length - 1; SV.g.set(SV.i); }
    if (SV.T >= 0 && !P.includes(SV.T)) SV.T = -1;
    svApply();
    svPrestartSoon(300);
    // (an edit made on the thread, or an undo, is not another chain loaded: the planes it shows are kept)
    if (SV.own) { SV.own = false; SV.sig = svSigNow(); }
    svWantFocus();
  }
  // On the globe, the inverse program of the glides out of and into the plane shown (svGlobeCarryInv's: each step's homotopy
  // inverted by its own ops, its own program), linked in the background, so the first glide finds it and no program links
  // inside a glide's frame
  function svPrestartGlobeInv() {
    if (SV.surf !== 'sphere' || !paneL || !GLR.inverseState || nSteps() < 1) return;
    const P = svPlanes(), j = Math.max(0, Math.min(P.length - 1, Math.round(SV.g.x))), T = svT(), carry = svCarryStyle(T);
    for (const b of new Set([P[Math.min(P.length - 1, j + 1)], P[j]])) {
      if (!b || isDeriv(b) || derivIn(0, b)) continue;
      const h = svInvPaths(b, 0.5, 'globe', { r: null });
      if (h) h.list.forEach((x, i) => GLR.inverseState(Object.assign({ viewKind: 'globe' }, svInvArg(paneL, h.paths[i], x, carry))));
    }
  }
  // (perf A2) the programs a glide draws with, started without waiting (KHR_parallel_shader_compile): the homotopy
  // maps' (mode 1) and the carried colour's pre-mapped mesh, and its GPU programs (#439); at start-up and when the
  // chain changes
  function svPrestart() {
    try {
      if (!GLR.ok) return;
      if (GLR.prestartModes) GLR.prestartModes([1]);
      // (perf on #448: the programs keyed by the map that the first glide linked synchronously)
      if (GLR.prestartNames) GLR.prestartNames(['region0', 'regionC', 'regionP', 'line0', 'lineC', 'tfRegion', 'tfLine', 'color', 'pre'], [0, 1]);
      if (GLR.prestart) GLR.prestart(['regionP', 'keepA']);
      // (#439: the carried colour's glide program only: carryId and the ones at rest link at their first use, the CPU mesh
      // drawn until then; each a few seconds of FXC on WARP for the Mountain King, run 41148134848)
      if (GLR.prestartNames) GLR.prestartNames(['carry'], [1]);
      // (and the region meshes' carried colour, the glide's own: the map cache's places and the cut fill, then drawn
      // once: svWarmCarry)
      if (GLR.prestartCarry) GLR.prestartCarry();
      svPrestartGlobeInv();
      svWarmCarry(0);
      svPolesWatch();
    } catch (e) { /* (the first glide starts them) */ }
  }
  // svPrestart again once the edits have stopped for `ms` (a chain or a shape edited, an example, a link, an undo), in an
  // idle moment: a drag or typing is never held back by it, and a run of edits starts it once
  let svPrestartTimer = 0;
  function svPrestartSoon(ms) {
    clearTimeout(svPrestartTimer);
    svPrestartTimer = setTimeout(() => {
      svPrestartTimer = 0;
      if (interacting()) { svPrestartSoon(250); return; }
      (window.requestIdleCallback || setTimeout)(svPrestart);
    }, ms);
  }
  // How much of what a glide of the current chain needs is ready: {done, total, parts, ready}. parts: the chain's
  // programs linked (both map modes, the carried colour and its cut fills, any inverse one still compiling), the carried
  // colour's warm draw made, and the idle jobs finished (the pole tracks, the outer ring, the meshes). total is 0 only
  // while the GPU layer or the chain is not up; ready is true only when done = total > 0
  function svReady() {
    const parts = {};
    if (!GLR.ok || !GLR.progStatus || !SV.on || nSteps() < 1) return { done: 0, total: 0, parts, ready: false };
    parts.programs = GLR.progStatus();
    parts.warm = { done: svWarmSig === chainSig[nSteps()] ? 1 : 0, total: derivIn(0, 1) ? 0 : 1 };
    let jobs = 0;
    try { jobs = (svPolesLeft() ? 1 : 0) + (svRingLeft() ? 1 : 0) + (svMeshNext() ? 1 : 0); } catch (e) { jobs = 0; }
    parts.jobs = { done: 3 - jobs, total: 3 };
    let done = 0, total = 0;
    for (const k in parts) { done += parts[k].done; total += parts[k].total; }
    return { done, total, parts, ready: total > 0 && done === total };
  }
  // The glide's carried colour drawn once on a speck (SV_WARM's mesh, at x = 1/2 of the first step) into the GL canvas,
  // which no pane shows until a frame copies it: a renderer that makes a program's machine code at its first draw
  // (SwiftShader, llvmpipe) makes it then, in an idle moment, not in the first frame of the first glide, whose clock
  // would run on past that stall and end it. The idle moment is SV_WARM_IDLE_MS after the chain changed and after the
  // last input (lastInputT): that machine code takes the main thread for a second or more on such a renderer, which
  // just after an edit holds back what the edit shows (the "Added" message). Tried again while the programs link
  // (prestartCarry), at most 40 times; the programs themselves link without waiting (prestartCarry, the parallel compile)
  const SV_WARM = { id: '__svWarm', kind: 'disc', c: [0, 0], r: 0.01, visible: true }, SV_WARM_IDLE_MS = 2000;
  let svWarmSig = null, svWarmAt = 0;
  // (t0: when the chain changed, as svPrestart saw it)
  function svWarmCarry(n, t0 = performance.now()) {
    const sig = chainSig[nSteps()];
    if (svWarmSig === sig || n > 40 || !GLR.ok || !GLR.drawRegion || nSteps() < 1 || derivIn(0, 1)) return;
    const wait = Math.max(t0, lastInputT) + SV_WARM_IDLE_MS - performance.now();
    if (wait > 0 || interacting()) { setTimeout(() => { if (chainSig[nSteps()] === sig) svWarmCarry(n, t0); }, Math.max(wait, 250)); return; }
    const idle = (f) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 1000 }) : setTimeout(f, 250));
    idle(() => {
      if (chainSig[nSteps()] !== sig) return;
      const r = shapeGPU(SV_WARM, { base: 2 }), pane = paneL;
      let done = false;
      try {
        if (r && r.meshRes && pane && pane.view) {
          GLR.begin(pane.pw, pane.ph);
          const map = { mode: 1, hi: 1, t: 0.5 }, key = svSheetKey(1);
          done = GLR.drawRegion(r.meshRes, { map, view: pane.view, dpr: pane.dpr, L: SV_CARRY_L, alpha: 1, pattern: 'carry', cell: 1, lines: false, carry: svCarryStyle(svT()), key, lim: 1e30 });
        }
      } catch (e) { done = false; }
      // the speck is no shape of the scene: its cache entry goes, or the line job's "every shape refined" never holds
      dropShapeGPU(SV_WARM.id);
      if (done) { svWarmSig = sig; svWarmAt = performance.now(); } else setTimeout(() => svWarmCarry(n + 1, t0), 500);
    });
  }
  // ---- play along the thread (#438): ▶, Loop, the range ----
  // The speed is the steps view's setting (SV.speed, saved as S.sv.speed), one for glide and play: the time a plane. ▶ glides on from the shown place to the
  // range's end (or the last plane) in a straight line, with no stop at the planes; Loop starts over at the range's start
  // (or z). The landscape (no frames between planes) and reduced motion step a plane at a time instead (2 s under reduced
  // motion, with the live region saying each plane).
  const svPerPlane = () => SV_SPEEDS[SV.speed] || 900;
  // the range a…b (S.homRange: steps a…b are the band from w_{a−1} to w_b) as planes {lo, hi}, or null; the plane at or
  // before a stage
  const svIdxAt = (s) => { let r = 0; svPlanes().forEach((k, i) => { if (k <= s) r = i; }); return r; };
  function svRange() {
    // (#437: none while a step is shown alone: the range maps onto the whole chain's planes, and the thread has two; it is kept in the
    // state, and is back with the whole chain)
    const r = SV.on && !SV.alone ? homRangeOk() : null;
    return r ? { a: r.a, b: r.b, lo: svIdxAt(r.a - 1), hi: svIdxAt(r.b) } : null;
  }
  const svRangeText = () => { const R = svRange(), P = svPlanes(); return R ? $t(', range {a} to {b}', { a: svName(P[R.lo]), b: svName(P[R.hi]) }) : ''; };
  // set the range between planes lo and hi (snapped to planes; the same plane twice clears it); a drag's snaps are previews
  function svSetRange(lo, hi, preview) {
    if (SV.alone) return;
    const P = svPlanes();
    svPause(false);
    if (hi < lo) [lo, hi] = [hi, lo];
    lo = Math.max(0, lo); hi = Math.min(P.length - 1, hi);
    setHomRange(lo === hi ? null : { a: P[lo] + 1, b: P[hi] }, { preview, force: !preview });
    svSync();
    if (!preview && lo !== hi) tourEmit('range-set', { lo, hi });
  }
  function svClearRange() {
    if (!svRange()) return;
    setHomRange(null, { force: true });
    svSync();
    if (SV.els && SV.els.live) SV.els.live.textContent = $t('Range cleared');
  }
  function svRangeExtend(d) {
    const R = svRange(), P = svPlanes(), at = Math.round(SV.g.x);
    const lo = R ? (d < 0 ? R.lo - 1 : R.lo) : (d > 0 ? at : at - 1), hi = R ? (d > 0 ? R.hi + 1 : R.hi) : (d > 0 ? at + 1 : at);
    if (lo < 0 || hi > P.length - 1) return;
    svSetRange(lo, hi, false);
    if (SV.els && SV.els.live) SV.els.live.textContent = (svRangeText() || $t('Range cleared')).replace(/^, /, '');
  }
  // a click on the thread outside the band clears the range
  function svOutsideBand(x) { const R = svRange(); if (R && (x < R.lo - 0.5 || x > R.hi + 0.5)) svClearRange(); }
  // the band's place: from the node of its first plane to the node of its last, written when the range or the layout changed
  function svBandSync(c) {
    const E = SV.els, R = svRange(), sx = E.scrollX || 0, rl = E.railLeft || 0, rw = E.railW || 0;
    const key = R && c.length ? `${R.lo}|${R.hi}|${c[R.lo]}|${c[R.hi]}|${sx}|${rl}|${rw}` : '';
    if (key === E.bandKey) return;
    E.bandKey = key;
    E.band.hidden = !key;
    E.bandx.hidden = !key;
    if (!key) return;
    const P = svPlanes();
    E.band.style.left = (c[R.lo] - 14) + 'px';
    E.band.style.width = (c[R.hi] - c[R.lo] + 36) + 'px';
    // (the ×: the band's right end in the strip's coordinates, kept between the rail's ends; written, never read)
    E.bandx.style.setProperty('--bx', (rl + c[R.hi] + 22 - sx) + 'px');
    E.bandx.style.setProperty('--rl', rl + 'px'); E.bandx.style.setProperty('--rr', (rl + rw) + 'px');
    E.band.setAttribute('aria-label', $t('Range {a} to {b}', { a: svName(P[R.lo]), b: svName(P[R.hi]) }));
  }
  // Shift-drag (mouse) or hold-then-drag (touch) along the thread: the range
  function svRangeDown(d, e, rail, posX) {
    const from = () => Math.round(posX({ clientX: d.px }));
    if (e.shiftKey && e.pointerType === 'mouse') { d.rangeFrom = from(); return; }
    if (e.pointerType === 'mouse') return;
    // (a touch: held still until the ring fills, then it drags the range; moved first, it is the scrub as ever)
    rail.classList.add('hold');
    d.hold = setTimeout(() => {
      d.hold = 0;
      if (SV.drag !== d || d.moved) return;
      d.rangeFrom = from();
      rail.classList.remove('hold'); rail.classList.add('arm');
      try { navigator.vibrate && navigator.vibrate(12); } catch (_) { /* (no haptics) */ }
    }, 450);
  }
  function svRangeMove(d, e, posX) {
    if (d.rangeFrom == null) {
      if (d.hold && Math.abs(e.clientX - d.px) >= 6) { clearTimeout(d.hold); d.hold = 0; SV.els.rail.classList.remove('hold'); }
      return false;
    }
    if (!d.rangeMoved && Math.abs(e.clientX - d.px) < 6) return true;
    d.rangeMoved = true;
    svSetRange(d.rangeFrom, Math.round(posX(e)), true);
    return true;
  }
  // (true when the press was a range's)
  function svRangeUp(d, rail) {
    if (d.hold) { clearTimeout(d.hold); d.hold = 0; }
    rail.classList.remove('hold', 'arm');
    if (d.rangeFrom == null) return false;
    SV.dragEndT = performance.now();
    if (d.rangeMoved) { const R = svRange(); setHomRange(R ? { a: R.a, b: R.b } : null, { force: true }); svSync(); if (R) tourEmit('range-set', { lo: R.lo, hi: R.hi }); const live = SV.els.live; if (live) live.textContent = (svRangeText() || $t('Range cleared')).replace(/^, /, ''); }
    return true;
  }
  // the speed, one for the glide and for play (S.sv.speed, saved with the state; the device's setting is the default of a
  // state without one): the strip's select and the Playback sheet both set it here
  function svSetSpeed(v) {
    if (!SV_SPEEDS[v]) return;
    SV.speed = v;
    svPlayRebase();
    try { localStorage.setItem('cmw-sv-speed', v); } catch (_) { /* (no storage) */ }
    svStore(); save();
    if (SV.els) { if (SV.els.speed) SV.els.speed.value = v; if (SV.els.sheetSpeed) SV.els.sheetSpeed.value = v; }
  }
  function svSetLoop(on) {
    SV.loop = on;
    tourEmit('loop-changed', { on });
    try { localStorage.setItem('cmw-sv-loop', on ? '1' : '0'); } catch (_) { /* (no storage) */ }
    svSync();
  }
  // ▶ and pause, the loop's state
  function svPlaySync() {
    const E = SV.els, on = !!SV.play, label = on ? $t('Pause') : $t('Play');
    // (the pause is two bars, drawn: no glyph of the bundled faces)
    if (E.play.dataset.on !== String(on)) { E.play.dataset.on = String(on); E.play.textContent = ''; if (on) E.play.append(h('span', { class: 'sv-bar' }), h('span', { class: 'sv-bar' })); else E.play.textContent = '▶'; }
    E.play.setAttribute('aria-label', label);
    E.play.setAttribute('data-tip', `${label}  K`);
    E.play.setAttribute('aria-pressed', String(on));
    E.loop.setAttribute('aria-pressed', String(SV.loop));
    E.loop.classList.toggle('on', SV.loop);
    // (Paths: pressed as S.morphPaths; off with a d/dz in the chain, which has no paths, as the classic toggle)
    const P = svPlanes(), noPaths = P.length > 1 && derivIn(P[0], P[P.length - 1]);
    for (const b of [E.paths, E.sheetPaths]) { if (!b) continue; syncPathsBtn(b, S.morphPaths !== false, noPaths); b.classList.toggle('on', S.morphPaths !== false && !noPaths); if (b === E.paths) b.textContent = S.morphPaths !== false && !noPaths ? $t('On') : $t('Off');
    }
    for (const [b, why] of [[E.paths, E.pathsWhy], [E.sheetPaths, E.sheetPathsWhy]]) {
      if (!b || !why) continue;
      why.textContent = noPaths ? b.dataset.tip || '' : '';
      why.hidden = !noPaths;
    }
    svOrderSync();
    if (E.sheet) { E.sheetLoop.setAttribute('aria-pressed', String(SV.loop)); E.sheetLoop.classList.toggle('on', SV.loop); E.sheetSpeed.value = SV.speed; }
  }
  function svTogglePlay() { if (SV.play) svPause(true); else svPlay(); }
  function svPlay() {
    const P = svPlanes();
    if (P.length < 2 || SV.play) return;
    const R = svRange(), start = R ? R.lo : 0, end = R ? R.hi : P.length - 1;
    svKeepView();
    const x = SV.anim ? SV.anim.to : SV.g.x;
    SV.anim = null; SV.g.set(x); SV.g.max = P.length - 1;
    // (at the end, or past it: from the start)
    const from = x >= end - SV_REST_U ? start : x;
    draft = null; probe = null;
    if (svReduced()) {
      SV.g.set(Math.round(from));
      SV.play = { slide: true, start, end, timer: 0, steps: S.steps };
      svSlide(true);
    } else {
      SV.g.set(from);
      SV.span = svSpanOf(from, end);
      SV.play = { from, to: end, start, t0: performance.now(), ms: svPerPlane() * (end - from), steps: S.steps };
    }
    svSync();
    requestRender('L');
    tourEmit('play-started', { from: Math.round(SV.g.x) });
    if (SV.els.live) SV.els.live.textContent = $t('Playing from {a} to {b}', { a: svName(svStage(Math.round(SV.g.x))), b: svName(P[end]) });
  }
  // a plane a tick (the landscape and reduced motion): the first tick shows the plane the press was on
  function svSlide(first) {
    const A = SV.play;
    if (!A || !A.slide) return;
    if (S.steps !== A.steps) { svPause(false); svCheck(); requestRender('L'); return; }
    const i = Math.round(SV.g.x);
    if (!first) {
      if (i >= A.end) { if (!SV.loop) { svPause(true); if (SV.els.live) SV.els.live.textContent = $t('Stopped at {p}', { p: svName(svStage()) }); return; } SV.g.set(A.start); } else SV.g.set(i + 1);
      SV.i = Math.round(SV.g.x);
      svApply();
      if (SV.els.live) SV.els.live.textContent = svLabel();
    }
    A.timer = setTimeout(() => svSlide(false), svReduced() ? 2000 : svPerPlane());
    svSync();
  }
  // one frame of the glide: a straight line in x; the plane the picture is nearest to is the shown one (the view's
  // kind follows it, as at a plane's arrival), and at the end it stops, or starts over
  function svPlayFrame() {
    // (SV.clock, a test hook's: the play's time advances that many ms a frame, as a glide's, so a suite reads its speed in the
    // frames drawn however long each takes)
    const A = SV.play, now = performance.now(), v = Math.min(1, (SV.clock ? (A.el = (A.el || 0) + SV.clock) : now - A.t0) / A.ms);
    // (another chain loaded under the play, an example, a link or an undo: it stops, and the new state's view is adopted)
    if (S.steps !== A.steps) { svPause(false); svCheck(); requestRender('L'); return false; }
    SV.g.set(A.from + (A.to - A.from) * v);
    // (a crossing mid-play writes the head and the live region only: svApply's layout and lists wait for the stop, as a glide's
    // wait for its arrival (perf on #460: a flip through svApply was a 111–168 ms frame of forced layout))
    const r = Math.round(SV.g.x);
    if (r !== SV.i && v < 1) { SV.i = r; if (SV.els.live) SV.els.live.textContent = svLabel(); }
    dirty.L = true;
    svSync();
    if (v < 1) return true;
    if (SV.loop && A.to > A.start) { A.from = A.start; A.t0 = now; A.el = 0; A.ms = svPerPlane() * (A.to - A.start); SV.span = svSpanOf(A.start, A.to); SV.g.set(A.start); SV.i = A.start; svSync(); return true; }
    SV.play = null;
    svArrive();
    if (SV.els.live) SV.els.live.textContent = $t('Stopped at {p}', { p: svName(svStage()) });
    svSync();
    return false;
  }
  // a new speed while it plays: from here on at it
  function svPlayRebase() {
    const A = SV.play;
    if (!A || A.slide) return;
    A.from = SV.g.x; A.t0 = performance.now(); A.el = 0; A.ms = svPerPlane() * Math.max(0.05, A.to - A.from);
  }
  // stop: settle where it is (a plane near, or parked between two), as a scrub let go; quiet: another move took over
  function svPause(settle) {
    const A = SV.play;
    if (!A) return;
    SV.play = null;
    if (A.slide) clearTimeout(A.timer);
    // (parked between two planes, the full apply the crossings skipped is done now, once)
    if (settle) { if (A.slide) { svArrive(); } else { svLetGo(); if (svParked()) svApply(); } }
    svSync();
  }
  // a phone's Playback sheet (a long press on ▶): the speed, the loop and the paths
  function svSheet() {
    const E = SV.els;
    if (!E.sheet) {
      const scrim = h('div', { class: 'sv-scrim', onclick: () => svSheetClose() });
      const sel = svSpeedSel($t('Speed'));
      const ord = svOrderSel($t('Glide order'));
      const lp = svLoopBtn('btn sv-loop');
      const pa = svPathsBtn('btn sv-paths');
      // (a disabled control's reason is on the sheet, where a touch can read it)
      const ordWhy = h('p', { class: 'sv-sheet-why', hidden: '' });
      const paWhy = h('p', { class: 'sv-sheet-why', hidden: '' });
      const sh = h('div', { class: 'sv-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': $t('Playback'), hidden: '' },
        h('div', { class: 'sv-sheet-h' }, h('b', {}, $t('Playback')), h('button', { type: 'button', class: 'btn small', onclick: () => svSheetClose() }, $t('Done'))),
        h('label', { class: 'sv-sheet-r' }, h('span', {}, $t('Speed')), sel),
        h('label', { class: 'sv-sheet-r' }, h('span', {}, $t('Order')), ord), ordWhy,
        h('div', { class: 'sv-sheet-r' }, lp), h('div', { class: 'sv-sheet-r' }, pa), paWhy);
      sh.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); svSheetClose(); return; }
        // (modal: Tab stays in the sheet)
        if (e.key !== 'Tab') return;
        const f = [...sh.querySelectorAll('button, select')], i = f.indexOf(/** @type {any} */ (document.activeElement));
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      });
      scrim.hidden = true;
      document.body.append(scrim, sh);
      Object.assign(E, {
        sheet: sh, scrim, sheetSpeed: sel, sheetOrder: ord, sheetLoop: lp, sheetPaths: pa,
        sheetOrderWhy: ordWhy, sheetPathsWhy: paWhy,
      });
    }
    E.sheetSpeed.value = SV.speed;
    E.sheet.hidden = false; E.scrim.hidden = false;
    E.sheetSpeed.focus();
    svPlaySync();
  }
  function svSheetClose() { const E = SV.els; if (!E.sheet) return; E.sheet.hidden = true; E.scrim.hidden = true; E.play.focus(); }
  // (a long press on ▶ on a touch screen opens the sheet; the release then is not a press)
  function svPlayHold() {
    const b = SV.els.play;
    let t = 0;
    b.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      SV.sheetHeld = false;
      t = setTimeout(() => { t = 0; SV.sheetHeld = true; svSheet(); }, 550);
    });
    // (the release's own mouse events move the focus to the page: it goes back to the sheet after them)
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { if (t) { clearTimeout(t); t = 0; } if (SV.sheetHeld && SV.els.sheet && !SV.els.sheet.hidden) setTimeout(() => SV.els.sheetSpeed.focus(), 60); });
    b.addEventListener('contextmenu', (e) => { if (document.documentElement.classList.contains('ph')) e.preventDefault(); });
  }
  function setupStepsView() {
    if (!SV.on) return;
    document.documentElement.classList.add('sv');
    setFocusStep(0);
    svBuild();
    svEdgeSwipe();
    svKeys();
    SV.g.set(0); SV.g.max = svPlanes().length - 1;
    if (!svLoad(true)) svAdopt();
    SV.ready = true;
    svApply();
    // (#leftLed and #leftLegend carry a label: an image's, for axe's aria-prohibited-attr; ux v6 re-check)
    for (const id of ['leftLed', 'leftLegend']) { const el = $(id); if (el && !el.getAttribute('role')) el.setAttribute('role', 'img'); }
    svPrestartSoon(1500);
  }

  // ---- chain editing on the thread (#437) ----
  // The chain's own actions (11-pipeline.js: stepMenuItems, moveStep, duplicateStep, removeStep, toggleBypass) are
  // reused; this section is the thread's chips, its menu, the focus after each action, and the step shown alone.
  // The step shown alone: the thread narrows to the plane before it, the step and its own plane (SV.alone, a step index;
  // SV.back the planes the whole chain was on)
  function svPrev(k) { let j = k - 1; while (j >= 1 && S.steps[j - 1].on === false) j--; return Math.max(0, j); }
  function svAloneOk() { const k = SV.alone; return k && S.steps[k - 1] && S.steps[k - 1].on !== false ? k : 0; }
  // the step shown alone before (d = -1) or after (d = 1) step k, bypassed steps skipped; 0 at the chain's ends
  function svAloneNeighbour(k, d) { for (let j = k + d; j >= 1 && j <= S.steps.length; j += d) if (S.steps[j - 1].on !== false) return j; return 0; }
  // the ‹ › after "Whole chain": the walk of a step shown alone. › parks the next step on its first plane (the plane the
  // step shown ends on), ‹ the previous one on its last, so a press at the end it points to changes the thread, not the picture
  function svWalkInfo(d, k) {
    const j = svAloneNeighbour(k, d), off = !j;
    return { j, off, name: d < 0 ? $t('Previous step alone') : $t('Next step alone'),
      tip: off ? (d < 0 ? $t('No step before f{k}', { k: sub(k) }) : $t('No step after f{k}', { k: sub(k) })) : $t('Show f{k} alone', { k: sub(j) }) };
  }
  function svWalkBtn(d, k) {
    const w = svWalkInfo(d, k);
    return h('button', { type: 'button', class: 'sv-awalk' + (w.off ? ' off' : ''), 'data-d': String(d), 'aria-label': w.name, 'aria-disabled': String(w.off), 'data-tip': w.tip, onclick: () => { if (!w.off) svAlone(w.j, d < 0); } }, d < 0 ? '‹' : '›');
  }
  function svAlone(k, last) {
    const st = S.steps[k - 1];
    if (!st || st.on === false) return null;
    if (SV.alone) svKeepView();
    else SV.back = { i: SV.i, T: SV.T };
    SV.anim = null;
    SV.alone = k; SV.i = last ? 1 : 0; SV.g.set(SV.i); SV.g.max = 1;
    SV.sig = svSigNow();
    svApply();
    const live = SV.els.live;
    live.textContent = $t('Showing f{k} alone, from {a} to {b}', { k: sub(k), a: svName(svPrev(k)), b: svName(k) });
    return svEl('whole');
  }
  function svLeaveAlone(focus) {
    if (!SV.alone) return;
    const k = SV.alone, b = SV.back || { i: 0, T: -1 };
    SV.anim = null;
    SV.alone = 0; SV.back = null; SV.T = b.T;
    const P = svPlanes();
    SV.i = Math.max(0, Math.min(P.length - 1, b.i)); SV.g.set(SV.i); SV.g.max = P.length - 1;
    SV.sig = svSigNow();
    svApply();
    if (focus) { const el = svEl(k, 'chip'); if (el) el.focus({ preventScroll: true }); }
  }
  // after a change in the number of steps, the shown plane and the colour plane stay on their stages: stages from `from` on
  // moved by d (a remove: the removed stage's plane goes to the one before), and a stage that is gone to the one before it
  function svEdit(from, d, n) { SV.shift = { st: svStage(), T: SV.T, alone: SV.alone, from, d, n: n == null ? S.steps.length : n, t: performance.now() }; }
  // a formula step k split into n steps (splitStep): the thread keeps its place, as the planes keep their pictures
  // (Funcs.splitSvPlace). A glide or a play under way is remapped through the same map and goes on from the same picture
  // (svRemapMotion); svSplitEdit is called before the chain changes. An undo of that split while one is under way remaps it
  // back (svRestored, inv)
  function svSplitEdit(k, n) {
    const j = svPlanesOf(S.steps).indexOf(k) - 1;
    SV.split = { k, n, j, x: SV.g.x, rest: !svGliding(), moving: svGliding() };
    SV.lastSplit = { k, n, j, len: S.steps.length - 1 + n };
    SV.own = true;   // (an edit of the chain, not another chain loaded: svChainChanged keeps the planes it shows)
  }
  function svSplitApply(sp) {
    const r = Funcs.splitSvPlace({ x: sp.x, rest: sp.rest, T: SV.T, alone: SV.alone, back: SV.alone ? SV.back : null }, sp.k, sp.n, sp.j);
    SV.T = r.T; SV.alone = r.alone; SV.back = r.back;
    SV.g.max = svPlanes().length - 1;
    if (!SV.alone && sp.rest) { SV.g.set(r.x); SV.i = Math.max(0, Math.min(SV.g.max, Math.round(r.x))); }
    if (sp.moving) svRemapMotion((x) => Funcs.splitSvPlace({ x, rest: true, T: -1, alone: 0, back: null }, sp.k, sp.n, sp.j).x);
  }
  // the undo of a split under way: the unit [j, j+n) of the n new steps is the formula's [j, j+1) again
  function svUnsplitApply(sp) {
    const { j, n } = sp, pl = (x) => (j < 0 || !(x >= j) ? x : x < j + n ? j + (x - j) / n : x - n + 1);
    SV.T = SV.T < 0 || SV.T < sp.k ? SV.T : SV.T < sp.k + n ? sp.k : SV.T - n + 1;
    SV.g.max = svPlanes().length - 1;
    svRemapMotion(pl);
  }
  // a glide or a play under way after the planes changed (pl: the old place on the thread -> the new one): it goes on from the
  // same place, to the same destination, with no jump. A glide keeps its ease's progress and its time; a play keeps the time
  // it has left, so the picture's speed goes on; a reduced-motion play (a plane a tick) is remapped to its planes
  function svRemapMotion(pl) {
    const A = SV.anim, B = SV.play, x = SV.g.x, last = svPlanes().length - 1, cl = (v) => Math.max(0, Math.min(last, v));
    SV.motionKept = true;
    const aim = SV.g.moving() ? SV.g.target : null;
    SV.g.set(cl(pl(x)));
    if (aim != null) SV.g.to(cl(pl(aim)));
    if (A) {
      const el = SV.clock ? A.el || 0 : performance.now() - A.t0, v = Math.min(1, el / A.ms);
      A.e0 = v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
      A.from = SV.g.x; A.to = cl(pl(A.to));
    }
    if (B) {
      B.steps = S.steps;
      if (B.slide) { B.start = cl(pl(B.start)); B.end = cl(pl(B.end)); } else {
        const left = B.ms * (1 - Math.min(1, (SV.clock ? B.el || 0 : performance.now() - B.t0) / B.ms));
        B.from = SV.g.x; B.to = cl(pl(B.to)); B.start = cl(pl(B.start)); B.t0 = performance.now(); B.el = 0; B.ms = Math.max(1, left);
      }
    }
    const sp = SV.span;
    if (sp) { const x0 = cl(pl(sp.x0)), x1 = cl(pl(sp.x1)); SV.span = x1 > x0 && svAllOk(x0, x1) ? { x0, x1 } : null; }
    SV.i = Math.round(SV.g.x);
    dirty.L = true;
  }
  function svShifted() {
    const sp = SV.split;
    if (sp) { SV.split = null; if (sp.inv) svUnsplitApply(sp); else svSplitApply(sp); return; }
    const sh = SV.shift;
    if (!sh) return;
    if (sh.n === S.steps.length && sh.d !== 0) return;   // (a palette that has not changed the count yet, or a replace)
    SV.shift = null;
    if (performance.now() - sh.t > 60000) return;
    const m = (x) => (x < 0 ? x : sh.d === 0 ? (x === sh.from ? x - 1 : x) : sh.d > 0 ? (x >= sh.from ? x + 1 : x) : x > sh.from ? x - 1 : x === sh.from ? x - 1 : x);
    if (sh.alone) SV.alone = sh.d < 0 && sh.alone === sh.from ? 0 : m(sh.alone);
    if (SV.alone) return;
    SV.T = m(sh.T);
    const st = m(sh.st), P = svPlanes();
    let i = P.indexOf(st);
    if (i < 0) { i = 0; P.forEach((x, j) => { if (x <= st) i = j; }); }
    SV.i = i; SV.g.set(i);
  }
  // an element of the thread: the chip or the ⋯ of step k, "+ Add function", the "Whole chain" chip
  function svEl(k, part) {
    if (!SV.els) return null;
    const q = (sel) => { const el = SV.els.track.querySelector(sel); return el && el.getClientRects().length ? el : null; };
    if (k === 'add') { const a = SV.els.add; return a && a.getClientRects().length ? a : null; }
    if (k === 'whole') { const pin = SV.els.strip.querySelector('.sv-whole-pin'); return q('.sv-whole') || (pin && pin.getClientRects().length ? pin : null); }
    const sel = `.sv-step[data-k="${k}"] `;
    return (part === 'more' ? q(sel + '.sv-more') : null) || q(sel + '.sv-fchip');
  }
  // the focus an action asks for, applied when the thread has been rebuilt (never <body>)
  function svWant(k, part) { SV.want = { k, part, t: performance.now() }; }
  function svWantFocus() {
    const w = SV.want;
    if (!w) return;
    const go = (late) => {
      if (performance.now() - w.t > 30000) { SV.want = null; return; }
      const a = document.activeElement;
      if (late && a && a !== document.body && !(a.classList && a.classList.contains('sv-add'))) return;
      const el = svEl(w.k, w.part) || svEl('add');
      if (el) el.focus({ preventScroll: true });
    };
    requestAnimationFrame(() => go(false));
    setTimeout(() => { go(true); SV.want = null; }, 200);
  }
  function svAddFn(anchor) {
    SV.shift = null; SV.own = true;
    svWant(S.steps.length + 1, 'chip');
    openPalette(anchor, S.steps.length, { fnOnly: true });
    svWatchPalette();
  }
  // the palette a thread action opened decides whether its edit is the thread's own (SV.own): while it is open, however long
  // the pick takes, the edit that follows is; once it is closed, with no edit made, nothing is pending
  function svWatchPalette() {
    const host = $('popHost');
    if (!host || typeof MutationObserver !== 'function') return;
    let seen = !!host.querySelector('.palette');
    const t0 = performance.now();
    const mo = new MutationObserver(() => {
      const open = !!host.querySelector('.palette');
      if (open) { seen = true; return; }
      if (!seen && performance.now() - t0 < 2000) return;
      mo.disconnect();
      setTimeout(() => { SV.own = false; SV.want = null; SV.shift = null; }, 400);
    });
    mo.observe(host, { childList: true, subtree: true });
  }
  // a menu item's run, for the thread: the focus lands on the chip it is about (a palette it opens keeps the keyboard until
  // it has done its work, and svWant gives the new chip the focus then)
  function svWrap(items, k) {
    return items.map((it) => {
      if (it === 'sep' || !it.run && !it.kids) return it;
      if (it.kids) return Object.assign({}, it, { kids: svWrap(it.kids, k) });
      const run = it.run;
      return Object.assign({}, it, { run: () => {
        SV.shift = null; SV.want = null; SV.own = true;
        if (it.id === 'insert') { svEdit(k + 1, 1); svWant(k + 1, 'chip'); }
        if (it.id === 'replace') svWant(k, 'chip');
        if (it.id === 'dup') { svEdit(k + 1, 1); }
        if (it.id === 'remove') { svRemove(k); return it.id; }
        if (it.id === 'bypass') return svBypass(k);
        if (it.id === 'moveL' || it.id === 'moveR') return svMove(k, it.id === 'moveL' ? -1 : 1);
        let r;
        SV.quiet = true;
        try { r = run(); } finally { SV.quiet = false; }
        if (!SV.want) SV.own = false;
        else if (it.id === 'insert' || it.id === 'replace') svWatchPalette();
        // (what the item says: an element it shows)
        if (r instanceof Element && r.getClientRects().length) return r;
        if (it.id === 'dup') return svEl(k + 1, 'chip');
        // (a palette, a toast's Undo…: the keyboard goes to the chip unless a layer took it)
        return svLayerOpen() ? null : svEl(k, 'chip');
      } });
    });
  }
  // a message for an edit made on the thread (#515 would take the rail for it and hide the thread, with the focus on it): none on a
  // desktop. It is said in the live region; Undo stays in the top bar's Undo button and Ctrl+Z; the focus stays on its chip (ux's choice A)
  function svQuietToast(msg) {
    if (!SV.on || !SV.els || document.documentElement.classList.contains('ph')) return false;
    const a = document.activeElement, inRail = !!(a && a.closest && a.closest('#svStrip .sv-rail, #svStrip .sv-add'));
    if (!(SV.quiet || SV.want || inRail)) return false;
    SV.els.live.textContent = '';
    setTimeout(() => { if (SV.els) SV.els.live.textContent = msg; }, 30);
    return true;
  }
  // open step k in the Inspector; on a phone its sheet too
  function svInspect(k) {
    inspectStep(k);
    if (document.documentElement.classList.contains('ph') && typeof Phone !== 'undefined' && Phone.open) Phone.open('edit');
  }
  // a menu a long press raised: clear of the finger where it fits, and deaf for 450 ms to the lift that ends the press
  // (a tall menu opened under the finger would otherwise activate the item it landed on)
  function svClearOf(pop, x, y, chip) {
    if (!pop || !pop.getBoundingClientRect) return;
    const W = window.innerWidth, H = window.innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight, c = chip.getBoundingClientRect(), M = 8, F = 24;
    const hit = (l, t) => x >= l - F && x <= l + pw + F && y >= t - F && y <= t + ph + F;
    const left0 = parseFloat(pop.style.left) || 0, top0 = parseFloat(pop.style.top) || 0;
    if (!hit(left0, top0)) return;
    const cand = [[left0, c.top - ph - F - M], [left0, c.bottom + F + M], [x - F - pw - M, top0], [x + F + M, top0]];
    for (const [l, t] of cand) {
      if (l < M || t < M || l + pw > W - M || t + ph > H - M || hit(l, t)) continue;
      pop.style.left = l + 'px'; pop.style.top = t + 'px';
      return;
    }
  }
  // (the finger that raised the menu is not a choice: its lift, wherever it comes, however long the press was held or
  // dragged, chooses nothing, and the click that follows it is swallowed, so a lift over the chip never opens its editor.
  // The next tap chooses. A press with no pointer to follow is deaf for 450 ms)
  function svDeaf(pop, id) {
    const t0 = performance.now();
    let lifted = null;
    const lift = (e) => { if (e.pointerId !== id) return; lifted = performance.now(); SV.noClickT = lifted; document.removeEventListener('pointerup', lift, true); document.removeEventListener('pointercancel', lift, true); };
    if (id != null) { document.addEventListener('pointerup', lift, true); document.addEventListener('pointercancel', lift, true); }
    const eat = (e) => {
      const now = performance.now();
      const deaf = id == null ? now - t0 < 450 : lifted == null ? now - t0 < 8000 : now - lifted < 350;
      if (deaf) { e.stopPropagation(); e.preventDefault(); }
    };
    for (const type of ['pointerup', 'click', 'mouseup']) pop.addEventListener(type, eat, true);
  }
  // (stepMenuItems is the list, each item with an id; the steps view's thread orders them its own way, svStepMenu)
  function stepMenuItems(anchor, k, opt) {
    const st = S.steps[k - 1], d = defOf(st);
    // (Replace… first: the palette, ready to replace this step)
    const items = /** @type {any[]} */ ([{ id: 'replace', label: $t('Replace…'), run: () => openPalette(anchor, null, { fnOnly: true, replace: k }) }]);
    // (the Inspector's menu also holds Inverse and Bypass)
    if (opt && opt.full) {
      const b0 = built[k - 1];
      if (!isDerivStep(st, b0)) items.push({ id: 'inverse', label: b0 && b0.inverse ? $t('Replace with the inverse') : $t('No single inverse: show why'), disabled: !b0 || !!b0.error, run: () => inverseAction(k) });
      items.push({ id: 'bypass', label: st.on === false ? $t('Turn this step back on') : $t('Bypass this step'), icon: 'bypass', run: () => toggleBypass(k) }, 'sep');
    }
    items.push(
      // (the keys a focused chip takes, Alt+← / Alt+→; none on a touch screen)
      { id: 'moveL', label: $t('Move left'), icon: 'chevL', key: touchUI() ? '' : 'Alt ←', disabled: k === 1, run: () => moveStep(k, -1) },
      { id: 'moveR', label: $t('Move right'), icon: 'chevR', key: touchUI() ? '' : 'Alt →', disabled: k === S.steps.length, run: () => moveStep(k, 1) },
      { id: 'dup', label: $t('Duplicate'), icon: 'copy', run: () => duplicateStep(k) },
      { id: 'insert', label: $t('Insert a function after it'), icon: 'plus', run: () => openPalette(anchor, k, { fnOnly: true, insert: true }) },
      { label: $t('Replace with derivative'), disabled: isDerivStep(st, built[k - 1]), run: () => derivativeAction(k) },
      { label: $t('Insert d/dz after it'), disabled: !Funcs.DEFS.deriv, run: () => addStep('deriv', null, k) });
    // (which steps the deformation deforms, SPEC 6.5)
    if (!(opt && opt.thread) && activeSteps().length >= 2) items.push({ id: 'deform', label: $t('Deformation'), kids: deformItems(k) });
    // ([issue #6] Repeat × N)
    if (!isDerivStep(st, built[k - 1])) {
      const rk = repeatItems(k);
      // (the thread's menu has no submenu of one: a single choice is the item itself, and a repeated block's two are items)
      if (opt && opt.thread && rk.length === 1) items.push({ id: 'repeat', label: $t('Repeat…'), run: rk[0].run });
      else if (opt && opt.thread && repeatOf(k)) items.push({ id: 'repeat', label: rk[0].label, run: rk[0].run }, { id: 'repeatEnd', label: rk[1].label, run: rk[1].run });
      else if (rk.length) items.push({ id: 'repeat', label: $t('Repeat'), kids: rk });
    }
    if (d.presets) items.push({ label: $t('Presets'), kids: d.presets.map((p) => ({ label: p.label, run: () => { Object.assign(st.params, p.params); chainChanged(true); commit(); } })) });
    const bk = built[k - 1];
    // a formula that is a chain of catalog steps, split into them (or, read as one step, replaced by it)
    if (st.type === 'custom') {
      const sp = Funcs.splitSteps(st, bk), no = sp.kind === 'none' || !!sp.blocked;
      items.push({ label: sp.kind === 'one' ? $t('Replace with “{name}”', { name: Funcs.DEFS[sp.steps[0].type].label }) : $t('Split into steps'), disabled: no, tip: no ? Funcs.splitReason(sp) : null, run: () => splitStep(k) });
    }
    // a polynomial or rational map by its zeros and poles (dragged in the input plane), and back
    if (Funcs.DEFS.zp && (st.type === 'poly' || st.type === 'rational' || (st.type === 'custom' && bk && !bk.error && bk.props && bk.props.rational && !bk.usesCut))) items.push({ label: $t('Write by zeros and poles'), disabled: !!(bk && (bk.error || (bk.props && bk.props.constant))), run: () => convertZp(k, true) });
    if (st.type === 'zp') items.push({ label: $t('Write by coefficients'), disabled: !!(bk && bk.error), run: () => convertZp(k, false) });
    items.push('sep', { id: 'remove', label: $t('Remove'), icon: 'trash', danger: true, run: () => removeStep(k) });
    return items;
  }
  const REPEAT_TYPE_SETTLE_MS = 400;
  function repeatField(getK) {
    const inp = h('input', { class: 'rep-n', type: 'text', inputmode: 'text', autocomplete: 'off', spellcheck: 'false', 'data-tip': $t('Times: a whole number, or a number’s name to run its slider') });
    // (typed for the step it was typed on: a chain or example switch within the settle delay must not take the N)
    let settle = 0, typedFor = null;
    const apply = () => {
      clearTimeout(settle);
      const t = inp.value.trim(), st = typedFor || S.steps[getK() - 1];
      typedFor = null;
      if (!st || !st.repeat || S.steps.indexOf(st) < 0) return;
      const rp = repeatFromText(st, t);
      if (!rp) return;
      st.repeat = rp;
      chainChanged(false);
      repeatMoved(S.steps.indexOf(st) + 1, rp);
    };
    // (while text is being typed the field is the viewer's: repeatShowAll leaves it alone)
    inp.addEventListener('input', () => { inp.dataset.typing = '1'; clearTimeout(settle); typedFor = S.steps[getK() - 1] || null; settle = setTimeout(apply, REPEAT_TYPE_SETTLE_MS); });
    inp.addEventListener('change', () => { delete inp.dataset.typing; apply(); repeatShowAll(); commit(); });
    inp.addEventListener('blur', () => { delete inp.dataset.typing; });
    // (the arrow keys step a typed N, as a number field does)
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      delete inp.dataset.typing; clearTimeout(settle);
      repeatStep(getK(), e.key === 'ArrowUp' ? 1 : -1);
    });
    repFields.push({ inp, getK });
    return inp;
  }
  // a formula step replaced by the catalog steps it is (Funcs.splitSteps): the
  // same function, so the planes do not change; one commit, undone by Undo
  function splitStep(k) {
    const st = S.steps[k - 1], b = built[k - 1];
    const sp = st && st.type === 'custom' ? Funcs.splitSteps(st, b) : null;
    if (!sp || sp.kind === 'none' || sp.blocked) { sndError(); toast(Funcs.splitReason(sp).replace(/\.?$/, '.')); return null; }
    const news = sp.steps.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: st.on !== false }));
    const n = news.length;
    // the deformation (open on the whole chain): the formula's unit [j, j+1) becomes [j, j+n), its own sub-steps
    let T1 = null;
    // (all at once: one t for every step, kept as it is; the movie runs the new steps together)
    if (morph.open && S.focus === 0) { const j = morphRange().steps.indexOf(k); T1 = S.homAll ? morph.T : j >= 0 ? Funcs.splitMorphT(morph.T, j, n) : morph.T; }
    // the formula shown alone (the palette's flow focuses a new step): the first new step alone is only part of it. With
    // no other step, F is the formula: show F, so the planes stay the same; otherwise the toast says what is shown
    const alone = S.focus === k, only = S.steps.length === 1;
    // (the bracket by index: an end on the split step moves to the new steps' outer one, so all n stay bracketed)
    const hr = S.homRange ? HR.resolve(S, true) : null;
    if (SV.on) svSplitEdit(k, n);
    spliceSteps(k - 1, 1, ...news);
    if (hr) setOpt('homRange', { a: hr.a > k ? hr.a + n - 1 : hr.a, b: hr.b >= k ? hr.b + n - 1 : hr.b });
    if (S.focus > k) setFocusStep(S.focus + n - 1);
    else if (alone && only) setFocusStep(0);
    chainChanged(true);
    if (!SV.on || S.focus) setFocus(S.focus);   // (the steps view's planes share one camera: with no focus, a split does not fit it again)
    setSel(k);
    if (T1 != null && morph.open) { morph.T = T1; requestRender('L', 'R'); }
    commit();
    soundCue('stepAdd');
    tourEmit('formula-split', { k, n });
    requestRender('P');
    const shown = alone && !only && n > 1 ? ' ' + (document.documentElement.classList.contains('ph') ? $t('Showing f{k} alone.', { k: sub(k) }) : $t('Showing f{k} alone; › shows the next step.', { k: sub(k) })) : '';
    undoToast((n === 1 ? $t('f{k} is now the step “{name}”.', { k: sub(k), name: Funcs.DEFS[news[0].type].label })
      : $t('Split f{k} into f{k}–f{k2}: {chain}.', { k: sub(k), k2: sub(k + n - 1), chain: sp.names.join(' → ') })) + shown);
    // (true: split; null is a refusal)
    return true;
  }
  function setMorphPaths(on) {
    if (sndP.on && !!on !== (S.morphPaths !== false)) sndToggleCue(!!on);
    setOpt('morphPaths', !!on);
    const b = $('pathsBtn');
    if (b) syncPathsBtn(b, !!on, b.disabled);
    requestRender('R'); drawLegend(); save();
    tourEmit('paths-toggled', { on: !!on });
  }
  // one after another <-> all at once: the same moment of the deformation, rescaled to the new range of t
  function setHomAll(all) {
    const before = morphLen();
    setOpt('homAll', !!all);
    const after = morphLen();
    if (morph.open && before !== after) { morph.T = morph.T * after / before; morph.seg = null; morph.u = 0; }
    else if (!morph.open) morph.T = after;
    scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); save();
    tourEmit('order-changed', { all: !!S.homAll });
  }
  function svStepMenu(anchor, k, lp) {
    if (!S.steps[k - 1]) return null;
    const now = performance.now();
    if (SV.menuT && now - SV.menuT < 500) return null;   // (a long press and the context menu it raises are one)
    SV.menuT = now;
    const st = S.steps[k - 1], off = st.on === false;
    const raw = stepMenuItems(anchor, k, { full: true, thread: true });
    const by = (id) => raw.find((x) => x && x.id === id);
    const first = /** @type {any[]} */ ([
      { label: $t('Open in the Inspector'), run: () => { svInspect(k); return svEl(k, 'chip'); } },
      { label: $t('Show alone'), disabled: off, tip: off ? $t('Turn this step back on first.') : null, run: () => svAlone(k) }]);
    // (on a phone the walk of the step shown alone is in its menu: the thread has no room for ‹ ›)
    if (svAloneOk() === k && document.documentElement.classList.contains('ph')) {
      for (const d of [-1, 1]) { const w = svWalkInfo(d, k); first.push({ label: w.name, disabled: w.off, tip: w.off ? w.tip : null, run: () => svAlone(w.j, d < 0) }); }
    }
    first.push('sep');
    const used = new Set(['inverse', 'bypass', 'moveL', 'moveR', 'dup', 'insert', 'replace', 'remove']);
    const rest = raw.filter((x) => x !== 'sep' && !(x.id && used.has(x.id)));
    const items = first.concat([by('bypass'), by('moveL'), by('moveR'), by('dup'), by('insert'), 'sep', by('replace'), by('inverse')].filter(Boolean), rest, ['sep', by('remove')]);
    // (a separator is never first, last or doubled)
    const out = [];
    for (const it of items) { if (it === 'sep' && (!out.length || out[out.length - 1] === 'sep')) continue; out.push(it); }
    while (out.length && out[out.length - 1] === 'sep') out.pop();
    const wrapped = svWrap(out, k);
    // (removing: svRemove has done it; the item's own run is not called again)
    wrapped.menuLabel = $t('More actions for f{x}', { x: sub(k) });
    const pop = openMenu(anchor, wrapped);
    if (pop && lp) { svDeaf(pop, lp.id); svClearOf(pop, lp.x, lp.y, anchor); }
    return pop;
  }
  function svBypass(k) {
    const st = S.steps[k - 1];
    if (!st) return;
    const was = st.on !== false, name = defOf(st).label;
    svEdit(k, 0, -1);
    SV.own = true; SV.quiet = true;
    try {
      toggleBypass(k);
      SV.shift = null; SV.own = false;
      undoToast(was ? $t('Bypassed f{x} ({name}).', { x: sub(k), name }) : $t('Turned f{x} back on.', { x: sub(k) }));
    } finally { SV.quiet = false; }
    return svEl(k, 'more');
  }
  function svMove(k, d) {
    const n = S.steps.length, j = k + d;
    if (j < 1 || j > n) return null;
    if (SV.alone === k) SV.alone = j; else if (SV.alone === j) SV.alone = k;
    SV.own = true; SV.quiet = true;
    let r;
    try { r = moveStep(k, d); } finally { SV.quiet = false; SV.own = false; }
    return r ? svEl(j, 'chip') : null;
  }
  function svRemove(k) {
    const n = S.steps.length;
    if (!S.steps[k - 1]) return;
    svEdit(k, -1);
    SV.own = true; SV.quiet = true;
    try { removeStep(k); } finally { SV.quiet = false; }
    SV.shift = null; SV.own = false;
    svWant(k > 1 ? k - 1 : n > 1 ? 1 : 'add', k > 1 ? 'more' : 'chip');
    svWantFocusNow();
  }
  function svWantFocusNow() {
    const w = SV.want;
    SV.want = null;
    if (!w) return;
    const el = svEl(w.k, w.part) || svEl('add');
    if (el) el.focus({ preventScroll: true });
  }
  // On a phone the selected step's chip and ⋯ are brought whole into the rail, moving it as little as it takes; a rail that shows
  // them whole stays as it is, and selecting the step already revealed does nothing. svSync then holds the rail there until the
  // ring moves from where it was at the selection (after a rebuilt chain, from where it is next). Called at each selection and
  // after the chain's strip is rebuilt (`force`).
  function svRevealSel(force) {
    const E = SV.els;
    if (!E || !E.track || SV.alone || !document.documentElement.classList.contains('ph')) return;
    const k = S.sel, stepEl = typeof k === 'number' ? E.track.querySelector(`.sv-step[data-k="${k}"]`) : null;
    if (!stepEl || (k === E.revealed && !force)) return;
    E.revealed = k;
    const rail = E.rail, a = stepEl.offsetLeft, s = rail.scrollLeft, w = rail.clientWidth;
    const to = Math.max(0, Math.min(rail.scrollWidth - w, Math.min(Math.max(s, a + stepEl.offsetWidth - w), a)));
    if (to !== s) { rail.scrollLeft = to; E.scrollX = to; svFades(); }
    E.hold = { tx: force ? null : E.tx ?? null, aim: to };
  }
  // the F chip says whether F is the selected step (S.sel); read by selectStep, so a selection by any route shows
  function svFSync() {
    svRevealSel();
    const f = SV.on && SV.els && SV.els.wholeMap;
    if (!f) return;
    const on = String(S.sel === 'F');
    if (f.getAttribute('aria-pressed') !== on) f.setAttribute('aria-pressed', on);
  }
  // a control that can't act now: disabled, with `why` as its tip and description; `tip` is its tip while it can act
  function svDisableWhy(btn, why, tip) {
    if (why) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');   // (not `disabled`: a press still reaches the long-press tip, and the keyboard still finds the reason)
    btn.setAttribute('data-tip', why || tip);
    if (why) btn.setAttribute('aria-description', why); else btn.removeAttribute('aria-description');
  }
  // whether a control set by svDisableWhy can't act now
  const svOff = (btn) => btn.getAttribute('aria-disabled') === 'true';
  // a chip of the thread: a function's letter (fk, html) and its name, a step's and F's
  function svChipBtn(cls, attrs, fk, name) {
    return h('button', Object.assign({ type: 'button', class: cls }, attrs), h('span', { class: 'sv-fk', html: fk }), h('span', { class: 'sv-fn' }, name));
  }
  // a step's chip: its pill (the chip opens the step, ⋯ its menu), with the step's keys
  function svStepEl(k) {
    const st = S.steps[k - 1], d = defOf(st), off = st.on === false, name = cardName(st, d);
    const chip = svChipBtn('sv-fchip', { 'data-tip': `${name} · ${$t('Edit step {k}', { k })}`,
      'aria-label': `f${sub(k)} ${name}${off ? $t(', bypassed') : ''}: ${$t('Edit step {k}', { k })}`, onclick: (e) => { e.stopPropagation(); svInspect(k); } },
    `<i>f</i><sub>${k}</sub>`, name);
    const more = h('button', { type: 'button', class: 'sv-more', 'aria-haspopup': 'menu', 'data-tip': $t('More'), 'aria-label': $t('More for f{x} {name}', { x: sub(k), name }), html: ICONS.more,
      onclick: (e) => { e.stopPropagation(); svStepMenu(e.currentTarget, k); } });
    // (a repeated block: its chips are marked, and the last one carries the count, ×N)
    const rb = repeatOf(k);
    const badge = rb && rb.b === k ? h('span', { class: 'sv-rep', 'aria-hidden': 'true' }, `×${rb.by ? Params.display(rb.by) : rb.n}`) : null;
    if (rb) chip.setAttribute('aria-label', `${chip.getAttribute('aria-label')}, ${rb.a === rb.b ? $t('Repeat f{k}: times', { k: sub(rb.b) }) : $t('Repeat f{a}–f{b}: times', { a: sub(rb.a), b: sub(rb.b) })} ${rb.by ? Params.display(rb.by) : rb.n}`);
    const wrap = h('span', { class: 'sv-fwrap' + (off ? ' off' : '') + (rb ? ' rep' + (rb.a === k ? ' rep-a' : '') : '') }, chip, badge, more);
    wrap.addEventListener('keydown', (e) => {
      const ed = stepEditKey(e);
      if (ed && ed.move) {
        e.preventDefault(); e.stopPropagation();
        const el = svMove(k, ed.move);
        if (el) el.focus({ preventScroll: true });
      } else if (ed && ed.remove) { e.preventDefault(); e.stopPropagation(); svRemove(k); }
      else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); e.stopPropagation(); svStepMenu(/** @type {HTMLElement} */ (e.target), k); }
    });
    // (right-click, and the touch's long press: the phone's chips have no ⋯)
    let touch = null;
    wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); svStepMenu(chip, k, touch && performance.now() - touch.t < 1500 ? touch : null); });
    let lp = null;
    const lpOff = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
    wrap.addEventListener('pointerdown', (e) => {
      lpOff();
      if (e.pointerType === 'touch') touch = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
      if (e.pointerType !== 'touch' || e.target.closest('.sv-more')) return;
      lp = { x: e.clientX, y: e.clientY, id: e.pointerId, t: setTimeout(() => {
        const at = { x: lp.x, y: lp.y, id: lp.id };
        lp = null;
        SV.noClickT = performance.now();
        svStepMenu(chip, k, at);
      }, 450) };
    });
    wrap.addEventListener('pointermove', (e) => { if (lp && e.pointerId === lp.id && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) lpOff(); });
    wrap.addEventListener('pointerup', lpOff); wrap.addEventListener('pointercancel', lpOff);
    // (the click that ends a long press is not a press on the chip)
    chip.addEventListener('click', (e) => { if (SV.noClickT && performance.now() - SV.noClickT < 800) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    return h('div', { class: 'sv-step' + (off ? ' off' : ''), 'data-k': String(k) }, wrap);
  }
