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
    // (or a host page that sets window.cmwView = 'steps' before the app starts: the prototype's published page)
    on: (() => { try { return /** @type {any} */ (window).cmwView === 'steps' || new URLSearchParams(location.search).get('view') === 'steps'; } catch (e) { return false; } })(),
    i: 0,            // the shown plane, an index into svPlanes()
    at: 0,           // the plane last arrived at (null: parked between two), so 'plane-changed' is sent for a change only
    T: -1,           // the colour plane's stage (-1: the last plane, F's)
    scope: 'all',    // 'all' | 'in'
    surf: 'plane',   // 'plane' | 'sphere' | 'land'
    g: HomRange.glider({ omega: 7 }),   // the position x in planes (set directly: a scrub, a swipe, the glide below)
    anim: null,      // the glide to a plane: {from, to, t0, ms}, eased in and out over a fixed time (no spring tail)
    sig: null,       // the chain and shapes last seen (another one: an example or a link was opened)
    main: null,      // the view the steps view set last (svViewFix): a parked view rounds to a plane it was not set for
    drag: null,      // a scrub of the strip or a swipe of the plane: {x0, i0, px, w, id, edge}
    els: null,
    ready: false,    // setup is done: S.sv may be written (before it, the state's own place is still to be read)
  };
  // the glide's time a plane, by speed (a setting kept on this device)
  const SV_SPEEDS = { fast: 450, normal: 900, slow: 2000, slower: 4500 };
  SV.speed = (() => { try { const v = localStorage.getItem('cmw-sv-speed'); return v && SV_SPEEDS[v] ? v : 'normal'; } catch (e) { return 'normal'; } })();
  SV.loop = (() => { try { return localStorage.getItem('cmw-sv-loop') === '1'; } catch (e) { return false; } })();
  SV.play = null;   // play along the thread (#438): {from, to, start, t0, ms} a glide, or {slide, start, end, timer} one plane at a time
  // the planes: z and the stage after each active step
  // (#437: a step shown alone narrows the thread to the plane before it and its own. So index 0 is not always z: while a step is
  // shown alone the list starts at its input plane. Code that needs z asks for stage 0, not svPlanes()[0])
  function svPlanes() { const k = svAloneOk(); return k ? [svPrev(k), k] : [0].concat(activeSteps()); }
  function svStage(i = SV.i) { const P = svPlanes(); return P[Math.max(0, Math.min(P.length - 1, i))]; }
  function svT() { const P = svPlanes(); return SV.alone && P.length === 2 && P[1] === SV.alone ? SV.alone : P.includes(SV.T) ? SV.T : P[P.length - 1]; }
  // the shown plane is coloured from the colour plane: at or before it, and not across a d/dz (whose input is z's plane, not w_k's)
  function svColoured(k = svStage()) { const T = svT(); return k <= T && (k === 0 || !derivIn(k, T)); }
  const svMap = () => { const k = svStage(); return k === 0 ? stageMap(svT()) : { mode: 0, a: k, b: svT() }; };
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
  // the export's caption parts for the shown plane (#633): its variable; the map that colours it (into the colour plane)
  // or, past the colour plane, the map that carries the shapes to it from z, by name; that map's formula when it is one step
  function svFigParts() {
    const k = svStage(), T = svT(), coloured = svColoured(k), [a, b] = coloured ? [k, T] : [0, k];
    const ss = svPlanes().filter((s) => s > a && s <= b), st = ss.length === 1 ? built[ss[0] - 1] : null;
    const lvar = k === 0 ? 'z' : `w_{${k}}`, arg = a === 0 ? 'z' : `w_{${a}}`;
    const raw = st && !st.error ? st.tex({ s: arg, p: 4 }).s : null;
    return { k, coloured, lvar, arg, name: svMapName('tex', a, b), raw: raw && raw.length < 240 ? raw : null };
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
  // colour plane the colour is carried by the points, which the role says
  function svTitleParts() {
    const k = svStage(), T = svT(), map = svMapName('html', k, T) || wHtml(k);
    let role;
    if (!svColoured(k)) role = k > T ? $t('colour carried from {p}', { p: wHtml(T) }) : $t('shapes only');
    else if (k === T && SV.surf !== 'land') role = $t('colour plane');
    else if (SV.surf === 'land') role = $t('landscape of {h}{sheets}', { h: heightHtml(map), sheets: '' });
    else role = $t('phase of {ofV}', { ofV: map });
    return { name: svNameHtml(k), role };
  }
  const svReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  // (one camera for every plane, S.srcView: a glide moves the picture, never the view, so its scale is the user's own)
  // the app's view of the shown plane: Phase (or Landscape) at or before the colour plane, X → Y after it; true when S changed
  const svMain = (k = svStage()) => (SV.surf === 'land' && svColoured(k) ? 'land' : svColoured(k) ? 'phase' : 'xy');
  function svViewFix() {
    const k = svStage(), col = svColoured(k), v = S.view, surf = SV.surf === 'sphere' ? 'sphere' : 'plane';
    const main = svMain(k);
    let ch = false;
    if (S.focus !== 0) { setFocusStep(0); ch = true; }
    if (morph.open) { morph.open = false; ch = true; }
    if (v.main !== main) { setViewOpt(null, 'main', main); ch = true; }
    SV.main = main;
    if (main === 'land' && !(v.D && v.D.phase)) { setViewOpt(null, 'D', Object.assign({}, v.D, { phase: true })); ch = true; }
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
    // (another chain loaded with the state, an example or a link: its glide's programs are started too)
    if (SV.sig != null && sig !== SV.sig) setTimeout(svPrestart, 300);
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
    // (a view the steps view set is not one from outside, whichever plane a parked view now rounds to)
    if ((ext === svMain() || ext === SV.main) && !force) return;
    // (ux's review: always from the last plane, F's; X → Y keeps its colour inside its regions when it has areas;
    // Views.svOf, concept §6)
    const areas = S.shapes.some((s) => s.visible !== false && kindType(s) === 'area'), o = Views.svOf(S.view, areas);
    SV.T = o.T; SV.scope = o.scope; SV.surf = o.surf;
    SV.i = 0; SV.g.set(0);
  }
  // S.sv, the steps view's place, saved in the state, in links and kept by undo (Views.cleanSv; the speed is the state's, and
  // the device's setting for a state without one). svStore writes it before a save, a link or an undo entry;
  // svLoad reads it when the page opens on a state that has one, and after an undo
  function svStore() {
    if (!SV.on || !SV.ready) return;
    // (#437: a step shown alone keeps the whole chain's place, which is what undo and a link restore)
    const b = SV.alone && SV.back ? SV.back : null;
    setOpt('sv', { at: b ? b.i : SV.anim ? SV.anim.to : SV.g.x, T: b ? b.T : SV.T, scope: SV.scope, surf: SV.surf, speed: SV.speed });
  }
  function svLoad() {
    // (#437: by the chain's own steps: after an undo the active steps (svPlanes) still read the chain before it, which clamped the place)
    const o = Views.cleanSv(S.sv, svAloneOk() ? svPlanes() : svPlanesOf(S.steps));
    if (!o) return false;
    SV.T = o.T; SV.scope = o.scope; SV.surf = o.surf;
    if (o.speed) { SV.speed = o.speed; svPlayRebase(); if (SV.els) { if (SV.els.speed) SV.els.speed.value = o.speed; if (SV.els.sheetSpeed) SV.els.sheetSpeed.value = o.speed; } }   // (a state without one keeps the device's)
    SV.anim = null; SV.g.max = svPlanes().length - 1; SV.g.set(o.at); SV.i = Math.round(o.at);
    SV.at = Math.abs(o.at - SV.i) < 1e-6 ? SV.i : null;
    return true;
  }
  // an undo put another S.sv under the view
  function svRestored() {
    if (!SV.on || !SV.ready) return;
    if (SV.alone) { SV.alone = 0; SV.back = null; }   // (#437: an undo leaves a step shown alone)
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
  // (#515) a message placed over the thread's rail goes, by the message's own close, when the thread is gone through again
  let svToastWired = false;
  function svDismissToast() {
    const th = document.getElementById('toastHost');
    if (th && th.getAttribute('data-placed') === 'rail') for (const t of th.querySelectorAll(':scope > .toast')) t.remove();
  }
  // go to plane i: a glide along the steps in between (at once under reduced motion)
  function svGo(i, now) {
    svDismissToast();
    const P = svPlanes();
    i = Math.max(0, Math.min(P.length - 1, i));
    svPause(false);
    svKeepView();
    // (the landscape has no frames between two planes: it changes plane at once)
    if (now || svReduced() || SV.surf === 'land') { SV.anim = null; SV.g.set(i); svArrive(); return; }
    SV.g.max = P.length - 1;
    const from = SV.g.x;
    if (Math.abs(i - from) < 1e-6) { SV.anim = null; SV.g.set(i); svArrive(); return; }
    // (a press while it glides starts the next glide from where the picture is: no jump; 420 ms a plane, at most 900)
    // (the speed setting's time a plane, for at most two planes' worth when it crosses several)
    const per = SV_SPEEDS[SV.speed] || 900;
    SV.anim = { from, to: i, t0: performance.now(), ms: per * Math.min(2, Math.max(0.35, Math.abs(i - from))) };
    draft = null; probe = null;
    requestRender('L');
  }
  function svArrive() {
    const i = Math.round(SV.g.x), was = SV.at;
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
  const svParked = () => !SV.anim && !SV.play && !(SV.drag && SV.drag.moved) && Math.abs(SV.g.x - Math.round(SV.g.x)) > 1e-6;
  // (under way: a glide, a play, a scrub or a swipe; a play is no parked view)
  const svGliding = () => !!SV.anim || !!SV.play || SV.g.moving() || !!(SV.drag && SV.drag.moved);
  const svMoving = () => svGliding() || svParked();
  // one plane on (d = ±1) from where the view is: from between two planes, the next one that way
  function svStep(d) {
    if (SV.anim) { svGo(SV.anim.to + d); return; }
    const x = SV.g.x;
    svGo(d > 0 ? Math.floor(x + 1e-6) + 1 : Math.ceil(x - 1e-6) - 1);
  }
  // one frame of the glide (frame() calls it); true while it moves
  function svFrame(ts) {
    if (!SV.on) return false;
    if (SV.drag && SV.drag.moved) { dirty.L = true; svSync(); return false; }
    if (SV.play && !SV.play.slide) return svPlayFrame();
    if (SV.anim) {
      const A = SV.anim, v = Math.min(1, (performance.now() - A.t0) / A.ms), e = v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
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
  // the glide between planes a and b at x: (a, b, u, the map of the z-plane's shapes along h_{b,u}, and the plane whose
  // look the regions take, the nearer one: outlined over colour, filled past the colour plane, as each plane at rest)
  function svBetween() {
    const P = svPlanes(), x = SV.g.x, j = Math.max(0, Math.min(P.length - 1, Math.floor(x + 1e-9))), u = x - j;
    const a = P[j], b = P[Math.min(P.length - 1, j + 1)];
    const still = u <= 1e-6 || b === a, jump = !still && isDeriv(b);
    const map = still ? stageMap(a) : jump ? stageMap(u < 0.5 ? a : b) : { mode: 1, hi: b, t: u };
    // (its CPU twin, for the points: H_u after the steps before b, as transState)
    const F = still ? stageF(a) : jump ? stageF(u < 0.5 ? a : b) : ((Ht, Fp) => (z) => Ht(Fp(z)))(homF(b, u), stageF(b - 1));
    return { a, b, u, map, F, near: u < 0.5 ? a : b };
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
  function svCarry(pane, cc, s, a, H, frame) {
    const T = svT();
    if (s > 0 && derivIn(s, T)) return false;
    const v = S.srcView, nx = 160, ny = Math.max(12, Math.round(nx * pane.h / Math.max(1, pane.w)));
    // (#366 F) on the GPU when it can: the grid moved by the glide's map from plane s, each fragment coloured from the
    // colour plane exactly (GLR.drawCarried); the CPU mesh below while its program compiles, or without it
    if (GLR.drawCarried && !/** @type {any} */ (window).__svCpu) {
      const ext = 1.5, hw = pane.w / 2 / v.s * ext, hy = pane.h / 2 / v.s * ext, g = svBetween();
      const map = H ? { mode: 1, base: s, hi: g.b, t: g.u } : { mode: 0, a: s, b: a };
      // (the sheet key of the points of plane s: its window, the camera's, and the plan's accumulation set of the map
      // to plane a, as smKeyOf for the forward meshes)
      const win = { x0: v.cx - hw / ext, y0: v.cy - hy / ext, x1: v.cx + hw / ext, y1: v.cy + hy / ext }, R = Math.hypot(hw, hy) / ext;
      const plan = a > s ? invPlan(s, a) : null;
      const key = { win, R, rs: R / 8, sing: plan && plan.ok ? invSing(plan) : [] };
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
  // A frame of the plane between two planes (or at rest on a plane past the colour plane, where it is u = 0): the
  // colour carried by the points along h_{b,u} (svCarry), with each plane's exact pull-back colour blended in near it;
  // Inside regions masks it with the moving regions; the regions are outlined over it. The view stays.
  function svRenderMoving(pane) {
    if (SV.surf === 'sphere' && lGlobe()) { svSphereMoving(pane); return; }
    const { a, b, u, map, F } = svBetween(), rest = !SV.anim && !(SV.drag && SV.drag.moved);
    // (#548: parked between two planes, a pan or a zoom changes the view of the plane the thread is nearest to, V.left past the first
    // plane; the picture is drawn from the one camera every plane shares, S.srcView, so the parked view hands it its own)
    if (rest) svKeepView();
    pane.setView(S.srcView);
    pane.begin(TH.plane);
    if (!GLR.ok) { noGL(pane); return; }
    paper(pane);
    const grid = (under) => GLR.drawGrid && GLR.drawGrid({ view: pane.view, dpr: pane.dpr, plane: TH.planeRGB, minor: GLR.hexRGB(TH.gridMinor), medium: GLR.hexRGB(TH.gridMedium), major: GLR.hexRGB(TH.gridMajor), axis: TH.axisRGB, unit: S.unit, unitAlpha: 0.55, under });
    svColCv = svCanvas(svColCv, pane);
    const cc = svColCv.getContext('2d');
    const T = svT(), src = Math.min(a, T), still = u <= 1e-6 || b === a;
    // (#439 I: the colour layer is one GL frame, the plots at their opacity and the carried colour composed in it, and
    // one copy into cc at the end)
    const frame = { open: false, cc: false };
    const plot = (k, al) => {
      if (al <= 0.01 || !svColoured(k)) return;
      if (!frame.open) { GLR.begin(pane.pw, pane.ph); frame.open = true; }
      GLR.drawColorPlot({ map: svColourMap(k), view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: null, alpha: al });
    };
    const colour = () => {
      // (under it, the two planes' exact colours cross-faded: where no carried point lands, as the points from outside
      // the window would, the picture is not left blank)
      if (!still) { plot(a, svColoured(b) ? 1 : 1 - u); if (b !== a) plot(b, u); }
      let carried = false;
      // (at rest on a plane at or before the colour plane its exact colour covers it all: no carried colour under it)
      if (still ? !svColoured(a) : !isDeriv(b)) {
        carried = svCarry(pane, cc, src, a, still ? null : homF(b, u), frame);
      }
      // (over it, at a plane at or before the colour plane, its exact colour: all of it at rest, blended in over the
      // first and the last 15 % of a glide)
      const near = (w) => Math.max(0, Math.min(1, w));
      if (still) plot(a, 1);
      else if (carried) { plot(a, near(1 - u / 0.15)); if (b !== a) plot(b, near((u - 0.85) / 0.15)); }
    };
    // (Inside regions on the GPU, #440: the colour layer over the regions' mask and kept inside it, the grid under it and
    // the outlines over it, in one frame and one copy to the page, #545)
    if (svMaskOn() && svMask(pane, map, still ? a : undefined, {
      // (under the colour, the plane's paper and grid, as the 2D path leaves the pane's showing where none lands; the
      // colour layer stays in this frame: the carried colour's CPU mesh, which needs a frame of its own, waits)
      paint: () => { grid(false); frame.open = true; frame.keep = true; colour(); },
      after: () => { grid(true); svOutlines(pane, map, frame); frame.open = false; frame.keep = false; },
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
        svOutlines(pane, map, frame);
        GLR.blit(pane.ctx);
        frame.open = false;
      } else {
        if (frame.open) { GLR.blit(cc); frame.open = false; }
        if (svMaskOn()) svMask(pane, map, still ? a : undefined, { cc });
        if (GLR.drawGrid) { GLR.begin(pane.pw, pane.ph); grid(false); GLR.blit(pane.ctx); }
        pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.drawImage(svColCv, 0, 0); pane.ctx.restore();
        svOutlines(pane, map);
      }
    }
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    // (the points, carried too; at rest the plane's rulers, as every plane has)
    drawPoints(pane, F, Object.assign(still ? { primes: a, k: a, editK: a } : {}, rest ? {} : { lite: true }));
    if (rest) drawRulers(pane, 'L');
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
    const opt = k == null ? { noGrid: true, fills: true, cache: false } : { noGrid: true, fills: true, domain: k === 0, plane: k };
    if (o.cc) {
      svMaskCv = svCanvas(svMaskCv, pane);
      const mp = svProxy(pane, svMaskCv);
      mp.begin = () => {};
      try {
        // (at rest, plane k: the cached maps, as the plane's own frame (perf A3); between planes the homotopy's, uncached)
        withSolidRegions(() => { drawScene(mp, map, null, opt); if (k != null) stagePullbacks(mp, k); });
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
      withSolidRegions(() => drawScene(mp, map, null, Object.assign(opt, {
        under: () => GLR.writeMask(false, true),
        over: () => {
          if (k != null) stagePullbacks(mp, k, true);
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
  // the shapes' outlines under map, as the colour plot draws them (renderColor); into the open GL frame frame, if given
  // (the caller copies it), else a frame of their own
  function svOutlines(pane, map0, frame) {
    if (!frame) GLR.begin(pane.pw, pane.ph);
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const map = shapeMap(s, map0), r = map && shapeGPU(s);
      if (!r || !r.lineRes) continue;
      GLR.drawLines(r.lineRes, Object.assign({ map, view: pane.view, dpr: pane.dpr, M: 8 }, shapeStroke(s, pane.dpr, { domain: svStage() === 0, plane: svStage() })));
    }
    if (!frame) GLR.blit(pane.ctx);
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
  function svSphereMoving(pane) {
    const { a, b, u, map, F, near } = svBetween();
    const look = (k) => ({ imageMode: !svColoured(near), stage: k, plane: !!xView().eq, role: 'L', colorMap: svColoured(k) ? svColourMap(k) : null, lineMap: map, hom: { map, imageMap: map, F, imageF: F } });
    const info = sphereView(pane, camL, CAML, look(a));
    // (plane b's globe fades in when it has its own paint: coloured, or the shapes on paper past the colour plane)
    if (u > 0.01 && b !== a && (svColoured(b) || !svColoured(near))) {
      svFadeCv = svCanvas(svFadeCv, pane);
      sphereView(svProxy(pane, svFadeCv), camL, CAML, look(b));
      pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.globalAlpha = u; pane.ctx.drawImage(svFadeCv, 0, 0); pane.ctx.restore();
    }
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
  // (only areas bound the colour: with none drawn, a curve or a point alone, it shows everywhere)
  function svMaskOn() { return SV.on && SV.scope === 'in' && S.shapes.some((s) => s.visible !== false && kindType(s) === 'area'); }
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
    return $t('Plane {p}, {i} of {n}, {where}', { p: svName(k), i: SV.i + 1, n, where });
  }
  function svFormulaHtml() {
    const { name, role } = svTitleParts();
    return `${name}<span class="sv-sep"> · </span><span class="sv-role">${role}</span>`;
  }
  // the glide speed's select (the shared field-styled one, selectEl) and the Loop toggle, the strip's and the playback sheet's
  function svSpeedSel(title) {
    return selectEl(null, SV.speed, [['fast', $t('Fast')], ['normal', $t('Normal')], ['slow', $t('Slow')], ['slower', $t('Slower')]], svSetSpeed, title, 'sv-speed');
  }
  function svLoopBtn(cls, tip) {
    return h('button', { type: 'button', class: cls, 'aria-pressed': String(SV.loop), 'data-tip': tip || null, onclick: () => svSetLoop(!SV.loop) }, $t('Loop'));
  }
  function svBuild() {
    const head = document.querySelector('#paneL .pane-head');
    const bar = h('div', { class: 'sv-head', id: 'svHead' });
    const title = h('div', { class: 'sv-title', 'aria-hidden': 'true' });
    const cp = h('button', { type: 'button', class: 'btn small sv-cp', 'aria-pressed': 'false', 'data-tip': $t('Colour every plane from this one  C'), onclick: () => svSetT(svStage()) });
    const scope = seg(null, SV.scope, [['all', $t('Everywhere')], ['in', $t('Inside regions'), $t('Colour only inside the regions you draw, in every plane')]], (v) => { SV.scope = v; svSync(); requestRender('L'); tourEmit('scope-changed', { s: v }); }, $t('Where colour shows'), { cls: 'sv-seg sv-scope', loop: true });
    // (the surface: one button that names it and opens a menu of the three, on a laptop as on a phone; ux, #441: the
    // three-way row took 190 px of a head that has 700 at 1024 px)
    const SURF = [['plane', $t('Plane')], ['sphere', $t('Sphere')], ['land', $t('Landscape')]];
    const surf1 = h('button', { type: 'button', class: 'btn small sv-surf1', 'aria-haspopup': 'menu', onclick: () => svSurfMenu() });
    bar.append(title, cp, scope, surf1);
    head.prepend(bar);
    // the chain strip: ‹, a segment per plane with the step between, ›
    const play = h('button', { type: 'button', class: 'sv-nav sv-play', 'aria-description': $t('Hold for speed and loop'), onclick: () => { if (SV.sheetHeld) { SV.sheetHeld = false; if (SV.els.sheet && !SV.els.sheet.hidden) SV.els.sheetSpeed.focus(); return; } svTogglePlay(); } });
    const prev = h('button', { type: 'button', class: 'sv-nav sv-prev', 'aria-label': $t('Previous plane'), 'data-tip': $t('Previous plane  ←'), onclick: () => svStep(-1) }, '‹');
    const next = h('button', { type: 'button', class: 'sv-nav sv-next', 'aria-label': $t('Next plane'), 'data-tip': $t('Next plane  →'), onclick: () => svStep(1) }, '›');
    const track = h('div', { class: 'sv-track' });
    const thumb = h('div', { class: 'sv-thumb', 'aria-hidden': 'true' });
    const speed = svSpeedSel($t('Glide speed'));
    const add = h('button', { type: 'button', class: 'sv-add', 'data-tip': $t('Add a function  +'), onclick: (e) => { e.stopPropagation(); svAddFn(e.currentTarget); } },
      h('span', { class: 'sv-add-i', html: ICONS.plus, 'aria-hidden': 'true' }), h('span', { class: 'sv-add-t' }, $t('Add function')));
    const loop = svLoopBtn('btn small sv-loop', $t('Start over at the end'));
    const band = h('div', { class: 'sv-band', role: 'group', hidden: '' });
    // (the clear button is the strip's, over the rail's top edge: the rail scrolls and clips what is in it (#501), and inside the band it lay under the plane buttons)
    const bandx = h('button', { type: 'button', class: 'sv-bandx', hidden: '', 'aria-label': $t('Clear the range'), 'data-tip': $t('Clear the range  Esc'), onclick: () => { svClearRange(); thumb.focus(); } }, '×');
    const strip = h('div', { class: 'sv-strip', id: 'svStrip', role: 'toolbar', 'aria-label': $t('Planes of the chain') }, play, prev, h('div', { class: 'sv-rail' }, band, thumb, track), add, next, speed, loop, bandx);
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
    if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => { if (SV.els) { SV.els.centres = null; svSync(); } }); ro.observe(rail); ro.observe(track); }
    // (the head's width, as the observer reports it: svFitHead fits the head again when it changes, with no read of its own)
    if (typeof ResizeObserver === 'function') new ResizeObserver((es) => { const E = SV.els; if (!E) return; E.headW = Math.round(es[es.length - 1].contentRect.width); svFitHead(); }).observe(head);
    // (on a phone the bar sits in the header: its own width, as reported, keys the fit there; fonts that load late re-fit it)
    if (typeof ResizeObserver === 'function') new ResizeObserver((es) => { const E = SV.els; if (!E) return; E.barW = Math.round(es[es.length - 1].contentRect.width); svFitHead(); }).observe(bar);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => svFitHead());
    // (the rail's own scroll, by a wheel, a trackpad or a focus: where the ring is kept in view from, and its fades)
    rail.addEventListener('scroll', () => { const E = SV.els; if (E) { E.scrollX = rail.scrollLeft; svFades(); svBandSync(E.centres || []); } }, { passive: true });
    SV.els = { add, empty, rail, play, loop, band, bandx, speed, slider: thumb, bar, head, title, cp, scope, surf1, SURF, strip, track, thumb, prev, next, live, sig: '' };
    svStripWire(strip, track);
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
    const sig = P.join(',') + '|' + T + '|' + al + '|' + S.steps.map((st) => st.type + (st.on === false ? '-' : '')).join(',') + '|' + document.documentElement.lang;
    if (sig === E.sig) return;
    E.sig = sig;
    // (the thread is drawn again from the chain: a control with the focus on it, a chip, its ⋯, a plane's node or Whole chain, is
    // given the focus again, which an undo or a redo by the keyboard needs; one whose step has gone, the + button)
    const fa = /** @type {HTMLElement | null} */ (document.activeElement);
    let keep = null;
    if (fa && E.track.contains(fa)) {
      const sk = /** @type {HTMLElement | null} */ (fa.closest('.sv-step'));
      keep = fa.classList.contains('sv-plane') ? { p: fa.dataset.i } : fa.classList.contains('sv-whole') ? { w: 1 } : sk ? { k: +sk.dataset.k, part: fa.classList.contains('sv-more') ? 'more' : 'chip' } : null;
    }
    E.track.textContent = '';
    E.track.style.setProperty('--n', String(P.length));
    if (al) E.track.append(h('button', { type: 'button', class: 'sv-whole', onclick: () => svLeaveAlone(true) }, $t('Whole chain')));
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
      const el = /** @type {HTMLElement | null} */ (keep.p != null ? E.track.querySelector(`.sv-plane[data-i="${keep.p}"]`) : keep.w ? svEl('whole') : svEl(keep.k, keep.part));
      const back = el && el.getClientRects().length ? el : null;
      if (back) back.focus({ preventScroll: true });
      else SV.refocus = true;   // (the + button, once it is drawn below)
    }
    // ("+ Add function" is the strip's own, after the rail, so it never lies over the thread's end)
    E.add.hidden = !!al;
    E.add.setAttribute('aria-label', S.steps.length ? $t('Add function') : $t('Add the first function'));
    if (SV.refocus) { SV.refocus = false; if (!E.add.hidden) E.add.focus({ preventScroll: true }); }
  }
  // the head, the strip's states and the names: written only when what they show changed (perf A1: a glide's frame
  // writes the ring's transform alone, from the nodes' centres measured once per layout, with no forced layout)
  function svSync() {
    if (!SV.on || !SV.els) return;
    const E = SV.els, k = svStage(), T = svT(), P = svPlanes();
    svBuildTrack();
    const x = SV.g.x, at = Math.round(x), parked = svParked();
    const ph = document.documentElement.classList.contains('ph');
    const sig = [k, T, SV.scope, SV.surf, at, parked ? x.toFixed(3) : '', svMoving() ? 1 : 0, SV.play ? 1 : 0, SV.loop ? 1 : 0, rangeKey(), ph ? 1 : 0, E.sig].join('|');
    // (the folded key on a phone loses its head's words: as an image it keeps a name; ux on #448)
    const leg = $('leftLegend');
    if (leg && leg.getAttribute('role') === 'img' && !leg.getAttribute('aria-label')) leg.setAttribute('aria-label', SV.surf === 'land' ? $t('Height key') : $t('Colour key'));
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
      setSeg(E.scope, SV.scope);
      svFitHead();
      E.prev.disabled = at <= 0 && !svMoving() && !parked;
      E.next.disabled = at >= P.length - 1 && !svMoving() && !parked;
      for (const b of E.track.querySelectorAll('.sv-plane')) { const on = +b.dataset.i === at && !parked; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); }
      $('paneL').setAttribute('aria-label', svLabel());
      // (the thread as a slider: its place in planes, said as a plane or the two it is between)
      E.slider.setAttribute('aria-valuenow', x.toFixed(2)); E.slider.setAttribute('aria-valuemax', String(P.length - 1));
      E.slider.setAttribute('aria-valuetext', svPlaceText() + svRangeText());
      svPlaySync();
      // (#437: an empty chain has no place to go: the ring and the speed are off, and the plane says what to do)
      const none = P.length < 2;
      E.slider.setAttribute('tabindex', none ? '-1' : '0'); E.slider.setAttribute('aria-disabled', String(none));
      E.strip.querySelector('.sv-speed').disabled = none;
      E.empty.hidden = !none;
    }
    // (the ring round the shown plane's node, between two nodes in proportion to the glide)
    // (and, when the thread is longer than its rail (#497), the rail's width and the thread's, and the nodes' height (the
    // ring is centred on a node, clear of its name): measured with the centres)
    if (!E.centres || E.centresSig !== E.sig) {
      const pl = [...E.track.querySelectorAll('.sv-plane')];
      E.centres = pl.map((b) => b.offsetLeft + b.offsetWidth / 2); E.centresSig = E.sig; E.railW = E.rail.clientWidth; E.trackW = E.track.offsetWidth; E.railLeft = E.rail.offsetLeft;
      const nd = pl[0] && pl[0].querySelector('.sv-node');
      if (nd) E.thumb.style.setProperty('--sv-node-y', `${(pl[0].offsetTop + nd.offsetTop + nd.offsetHeight / 2).toFixed(1)}px`);
      svFades();
    }
    const c = E.centres, j = Math.max(0, Math.min(c.length - 1, Math.floor(x + 1e-9))), u = x - j;
    svBandSync(c);
    if (!c.length) return;
    const tx = c[j] + ((c[Math.min(c.length - 1, j + 1)] ?? c[j]) - c[j]) * u;
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
      const want = tx < s + m ? tx - m : tx > s + E.railW - m ? tx - E.railW + m : s;
      const to = Math.max(0, Math.min(E.trackW - E.railW, Math.round(want)));
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
  // the surface's menu: the three, the shown one checked (a menu's keys are its own: svKeys leaves them alone)
  function svSurfMenu() {
    const E = SV.els;
    const items = E.SURF.map(([v, t]) => ({ label: t, radio: true, checked: SV.surf === v, run: () => { SV.surf = v; if (v === 'sphere') prestartGlobe(); svApply(); tourEmit('surface-changed', { s: v }); } }));
    openMenu(E.surf1, Object.assign(items, { menuLabel: $t('Surface'), focusChecked: true }));
  }
  // the head on one row (#441): beside the plane's controls it keeps the style row, a ⋯ and the lamp (#247 keeps the
  // style row in the head whatever the room). When they do not fit, the colour-plane button gives up its words first
  // (its wheel stays, its words in its name and tooltip, as on a phone), then the title its role ("phase of f₂", also in
  // the plane's accessible name). Read and written only when the head's width or the words in it change (the observer,
  // or a new title, button or surface), and never while the view moves (#320)
  function svFitHead() {
    const E = SV.els;
    if (!E || !E.head) return;
    // (not while the view moves: the title changes half-way through a glide, and a fit then is a forced layout in a frame;
    // a view parked between two planes is at rest and is fitted; svSync's head key holds svMoving(), so the head is fitted
    // once when the glide settles; rework on #473)
    if (SV.anim || SV.g.moving() || (SV.drag && SV.drag.moved)) return;
    const ph = document.documentElement.classList.contains('ph');
    const key = [ph ? 1 : 0, ph ? E.barW || 0 : E.headW || 0, document.fonts ? document.fonts.status : '', E.title.innerHTML, E.cp.textContent, E.surf1.textContent, I18N.lang].join('|');
    if (key === E.fitKey) return;
    E.fitKey = key;
    const set = (lvl) => { E.bar.classList.toggle('sv-c1', lvl >= 1); E.bar.classList.toggle('sv-c2', lvl >= 2); };
    // (a phone: the header holds the bar beside the menu button; short of room (360 px, Russian) the surface button is
    // its icon and ▾ alone, its name in its label and tooltip; phone on #473)
    E.bar.classList.remove('sv-c3', 'sv-c4');
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
    const head = E.head, cs = getComputedStyle(head), gap = parseFloat(cs.columnGap) || 8;
    const room = head.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // (what the rest of the head takes at the least: the strip as its style row and a ⋯, every other shown item as it is,
    // a stretchy spacer as nothing; a gap before each)
    const dc = $('dcSeg'), foot = $('leftFoot');
    let keep = 0;
    for (const c of head.children) {
      if (c === E.bar || !c.getClientRects().length) continue;
      const m = getComputedStyle(c);
      const w = c === foot ? (dc && dc.getClientRects().length ? dc.getBoundingClientRect().width : 0) + 4 + 26 : c.classList.contains('grow') ? 0 : c.getBoundingClientRect().width;
      keep += w + parseFloat(m.marginLeft) + parseFloat(m.marginRight) + gap;
    }
    keep += 2;
    let lvl = 0;
    while (lvl < 2 && E.bar.scrollWidth + keep > room) set(++lvl);
    // (the strip in the head fits its controls to the room the bar now leaves)
    if (typeof layoutFoot === 'function') layoutFoot(true);
  }
  // where the view is on the thread, in words: a plane, or the two planes it is between
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
    (window.requestIdleCallback || setTimeout)(svPrestart);
  }
  // the tour's own placing of the view (#442): plane i at once, the colour plane T (an index among the planes; -1 the last), the
  // scope and the surface; sends none of the events the user's own moves send
  function svTourPlace(o) {
    if (!SV.on || !SV.els || !o) return false;
    const P = svPlanes();
    if (o.T != null) SV.T = o.T < 0 || o.T >= P.length - 1 ? -1 : P[o.T];
    if (o.scope) SV.scope = o.scope;
    if (o.surf) SV.surf = o.surf;
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
    if (SV.surf === 'sphere') prestartGlobe();
    svApply();
    tourEmit('surface-changed', { s: SV.surf });
    return SV.surf;
  }
  // the strip: a press on a plane goes there; a drag along it scrubs through the deformation, and the glide settles on
  // the nearest plane when it is let go
  function svStripWire(strip, track) {
    const rail = strip.querySelector('.sv-rail');
    // (#515) every way of going on dismisses a message over the rail (svGo, svNudge); a press on the rail also does (a scrub)
    const dismissToast = svDismissToast;
    strip.addEventListener('click', (e) => { if (e.target.closest('.sv-nav')) dismissToast(); }, true);
    rail.addEventListener('pointerdown', dismissToast, true);
    // (#549: Tab to a plane or chip that the rail shows only in part scrolls it fully in, clear of the fade; the browser's own
    // focus scroll leaves a control that is partly in view where it is. The ring's own focus is kept in view by svSync)
    rail.addEventListener('focusin', (e) => { const t = /** @type {HTMLElement} */ (e.target); if (t && t.closest && t.closest('.sv-plane, .sv-fchip') && t.matches(':focus-visible')) t.scrollIntoView({ block: 'nearest', inline: 'nearest' }); });   // (the keyboard's focus only: a press focuses too, and the thread must not move under a finger)
    // (ux on #460: a press on the message's body only dismisses it and brings the rail back: the rail is hidden under it, so the
    // press must not act on a plane the user cannot see; its own buttons keep their action)
    const th = document.getElementById('toastHost');
    if (th && !svToastWired) {
      svToastWired = true;
      th.addEventListener('click', (e) => {
        const t = e.target instanceof Element ? e.target.closest('.toast') : null;
        if (t && th.getAttribute('data-placed') === 'rail' && !(e.target instanceof Element && e.target.closest('button'))) dismissToast();
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
      if (e.button !== 0 || e.target.closest('.sv-fwrap, .sv-add, .sv-whole, .sv-bandx')) return;
      const d = SV.drag = { id: e.pointerId, px: e.clientX, moved: false, strip: true };
      svRangeDown(d, e, rail, posX);
      try { rail.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic pointer) */ }
    });
    // (a press on the thread away from the planes and the chips goes there too)
    rail.addEventListener('click', (e) => {
      if (SV.dragEndT && performance.now() - SV.dragEndT < 50) return;
      if (e.target.closest('.sv-fwrap, .sv-plane, .sv-add, .sv-whole, .sv-bandx')) return;
      svOutsideBand(posX(e));
      SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1; svLetGo(true);
    });
    rail.addEventListener('pointermove', (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      if (svRangeMove(d, e, posX)) return;
      if (!d.moved && Math.abs(e.clientX - d.px) < 6) return;
      if (!d.moved) { svPause(false); svKeepView(); SV.anim = null; }
      d.moved = true;
      SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1;
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
      if (Math.abs(dx) > 40 && e.timeStamp - d.t0 < 300) svGo(dx < 0 ? Math.floor(d.x0 + 1e-6) + 1 : Math.ceil(d.x0 - 1e-6) - 1);
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
    svDismissToast();
    const P = svPlanes(), from = SV.anim ? SV.anim.to : SV.g.x;
    svPause(false);
    SV.anim = null;
    svKeepView();
    SV.g.set(Math.max(0, Math.min(P.length - 1, Math.round((from + d) * 4) / 4)));
    SV.g.max = P.length - 1;
    svLetGo();
  }
  // ← → move through the planes, C makes the shown plane the colour plane (not while typing, nor on a focused plane,
  // whose arrows move the probe)
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
      if (!onRail && (svLayerOpen() || (t && t.closest && t.closest('#pipeline, [role="listbox"], [role="option"], [role="radiogroup"], [role="radio"], [role="menu"], [role="menuitem"], [role="slider"], [role="dialog"], input, select, textarea, [contenteditable], #propsPanel, .ph-sheet, .cm-palette, #popHost')))) return;
      if ((e.shiftKey || onRail) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); e.stopImmediatePropagation();
        svNudge(e.key === 'ArrowRight' ? 0.25 : -0.25);
        return;
      }
      // (K or M plays and pauses; Esc pauses, or else clears the range, #438)
      if ((e.key === 'k' || e.key === 'K' || e.key === 'm' || e.key === 'M') && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); svTogglePlay(); return; }
      if (e.key === 'Escape' && (SV.play || svRange())) { e.preventDefault(); e.stopImmediatePropagation(); if (SV.play) svPause(true); else svClearRange(); return; }
      // (PageUp / PageDown on a focused plane too; the arrows not on a plane, where they move the probe)
      const page = e.key === 'PageUp' || e.key === 'PageDown';
      if (!page && t && t.closest && t.closest('canvas')) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || page) {
        e.preventDefault(); e.stopImmediatePropagation();
        svStep(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1);
      } else if ((e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        e.preventDefault(); e.stopImmediatePropagation();
        svSetT(svStage());
      }
    }, true);
  }
  // the chain changed: the shown plane and the colour plane stay on their stages when they still exist
  function svChainChanged() {
    if (!SV.on || !SV.els) return;
    svShifted();
    if (SV.alone && !svAloneOk()) svLeaveAlone(false);
    if (SV.play) svPause(false);
    const P = svPlanes();
    if (SV.i > P.length - 1) { SV.i = P.length - 1; SV.g.set(SV.i); }
    if (SV.T >= 0 && !P.includes(SV.T)) SV.T = -1;
    svApply();
    setTimeout(svPrestart, 300);
    // (an edit made on the thread, or an undo, is not another chain loaded: the planes it shows are kept)
    if (SV.own) { SV.own = false; SV.sig = svSigNow(); }
    svWantFocus();
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
    } catch (e) { /* (the first glide starts them) */ }
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
    if (d.rangeMoved) { const R = svRange(); setHomRange(R ? { a: R.a, b: R.b } : null, { force: true }); svSync(); const live = SV.els.live; if (live) live.textContent = (svRangeText() || $t('Range cleared')).replace(/^, /, ''); }
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
    const from = x >= end - 1e-6 ? start : x;
    draft = null; probe = null;
    if (svReduced() || SV.surf === 'land') {
      SV.g.set(Math.round(from));
      SV.play = { slide: true, start, end, timer: 0, steps: S.steps };
      svSlide(true);
    } else {
      SV.g.set(from);
      SV.play = { from, to: end, start, t0: performance.now(), ms: svPerPlane() * (end - from), steps: S.steps };
    }
    svSync();
    requestRender('L');
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
    const A = SV.play, now = performance.now(), v = Math.min(1, (now - A.t0) / A.ms);
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
    if (SV.loop && A.to > A.start) { A.from = A.start; A.t0 = now; A.ms = svPerPlane() * (A.to - A.start); SV.g.set(A.start); SV.i = A.start; svSync(); return true; }
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
    A.from = SV.g.x; A.t0 = performance.now(); A.ms = svPerPlane() * Math.max(0.05, A.to - A.from);
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
  // a phone's Playback sheet (a long press on ▶): the speed and the loop
  function svSheet() {
    const E = SV.els;
    if (!E.sheet) {
      const scrim = h('div', { class: 'sv-scrim', onclick: () => svSheetClose() });
      const sel = svSpeedSel($t('Speed'));
      const lp = svLoopBtn('btn sv-loop');
      const sh = h('div', { class: 'sv-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': $t('Playback'), hidden: '' },
        h('div', { class: 'sv-sheet-h' }, h('b', {}, $t('Playback')), h('button', { type: 'button', class: 'btn small', onclick: () => svSheetClose() }, $t('Done'))),
        h('label', { class: 'sv-sheet-r' }, h('span', {}, $t('Speed')), sel), h('div', { class: 'sv-sheet-r' }, lp));
      sh.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); svSheetClose(); return; }
        // (modal: Tab stays in the sheet)
        if (e.key !== 'Tab') return;
        const f = [...sh.querySelectorAll('button, select')], i = f.indexOf(/** @type {any} */ (document.activeElement));
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      });
      scrim.hidden = true;
      document.body.append(scrim, sh);
      Object.assign(E, { sheet: sh, scrim, sheetSpeed: sel, sheetLoop: lp });
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
    if (!svLoad()) svAdopt();
    SV.ready = true;
    svApply();
    // (#leftLed and #leftLegend carry a label: an image's, for axe's aria-prohibited-attr; ux v6 re-check)
    for (const id of ['leftLed', 'leftLegend']) { const el = $(id); if (el && !el.getAttribute('role')) el.setAttribute('role', 'img'); }
    setTimeout(svPrestart, 1500);
  }

  // ---- chain editing on the thread (#437) ----
  // The chain's own actions (11-pipeline.js: stepMenuItems, moveStep, duplicateStep, removeStep, toggleBypass) are
  // reused; this section is the thread's chips, its menu, the focus after each action, and the step shown alone.
  // The step shown alone: the thread narrows to the plane before it, the step and its own plane (SV.alone, a step index;
  // SV.back the planes the whole chain was on)
  function svPrev(k) { let j = k - 1; while (j >= 1 && S.steps[j - 1].on === false) j--; return Math.max(0, j); }
  function svAloneOk() { const k = SV.alone; return k && S.steps[k - 1] && S.steps[k - 1].on !== false ? k : 0; }
  function svAlone(k) {
    const st = S.steps[k - 1];
    if (!st || st.on === false) return null;
    if (!SV.alone) SV.back = { i: SV.i, T: SV.T };
    SV.anim = null;
    SV.alone = k; SV.i = 0; SV.g.set(0); SV.g.max = 1;
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
  function svShifted() {
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
    if (k === 'whole') return q('.sv-whole');
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
        // (what the item says: an element it shows; the chain's own return is a hidden card)
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
  // open step k in the Inspector; on a phone its sheet (a card's tap does it there, the thread's chip is not a card)
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
  function svStepMenu(anchor, k, lp) {
    if (!S.steps[k - 1]) return null;
    const now = performance.now();
    if (SV.menuT && now - SV.menuT < 500) return null;   // (a long press and the context menu it raises are one)
    SV.menuT = now;
    const st = S.steps[k - 1], off = st.on === false;
    const raw = stepMenuItems(anchor, k, { full: true, thread: true });
    const by = (id) => raw.find((x) => x && x.id === id);
    const first = [
      { label: $t('Open in the Inspector'), run: () => { svInspect(k); return svEl(k, 'chip'); } },
      { label: $t('Show alone'), disabled: off, tip: off ? $t('Turn this step back on first.') : null, run: () => svAlone(k) }, 'sep'];
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
  // a step's chip: its pill (the chip opens the step, ⋯ its menu), with the card's keys
  function svStepEl(k) {
    const st = S.steps[k - 1], d = defOf(st), off = st.on === false, name = cardName(st, d);
    const chip = h('button', { type: 'button', class: 'sv-fchip', 'data-tip': `${name} · ${$t('Edit step {k}', { k })}`,
      'aria-label': `f${sub(k)} ${name}${off ? $t(', bypassed') : ''}: ${$t('Edit step {k}', { k })}`, onclick: (e) => { e.stopPropagation(); svInspect(k); } },
    h('span', { class: 'sv-fk', html: `<i>f</i><sub>${k}</sub>` }), h('span', { class: 'sv-fn' }, name));
    const more = h('button', { type: 'button', class: 'sv-more', 'aria-haspopup': 'menu', 'data-tip': $t('More'), 'aria-label': $t('More for f{x} {name}', { x: sub(k), name }), html: ICONS.more,
      onclick: (e) => { e.stopPropagation(); svStepMenu(e.currentTarget, k); } });
    const wrap = h('span', { class: 'sv-fwrap' + (off ? ' off' : '') }, chip, more);
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
