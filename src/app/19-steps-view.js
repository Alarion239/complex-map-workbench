  // ---------------- the steps view (behind ?view=steps) ----------------
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
    poleFrameMs: 0,  // (a test hook's) a frame's pole search budget in ms, instead of SV_POLE_BUDGET when above 0 (a slow machine's): a glide frame's seed search (svPolesNow) and a held frame's tracks (svLinkHold)
    clock: null,     // (a test hook's) ms of glide or play time a frame (svFrame), else the wall clock
    glideSheets: 0,  // (a test hook's) 1: a glide frame draws the chain as it is alone, without the other sheets' copies (svGlideSheets)
    glideSat: 1,     // (a test hook's) 0: a glide frame with the other sheets' copies draws them in painter's order, not front to back (colour())
    glideStencil: 0, // (a test hook's) 1: the sphere draws a glide's sheet copies only where the principal sheet is not opaque (drawSphere's sheetCut)
    restPaint: 1,    // (a test hook's) 0: a glide frame leaves out the arrival plane's picture under its carried colour; any other value draws it
    glideSeams: 1,   // (a test hook's) 0: a Landscape glide's copies are drawn without their seams (svGlideSeams); any other value draws them
    glideFade: null, // (a test hook's) the alpha of a Landscape glide's copies, fixed over the glide; null: their fade over u
    landBranches: 1, // (a test hook's) 0: the carried Landscape draws no patches about its map's branch points (svLandPatches); any other value draws them
    fits: 0,         // (for a test) the head's fits (svFitHead's) that ran past their key
    i: 0,            // the shown plane, an index into svPlanes()
    at: 0,           // the plane last arrived at (null: parked between two), so 'plane-changed' is sent for a change only
    T: -1,           // the colour plane's stage (-1: the last plane, F's)
    scope: 'all',    // 'all' | 'in'
    surf: 'plane',   // 'plane' | 'sphere' | 'land' | 'stack' (19-stack.js)
    links: 'straight',   // the Stack's connectors: 'straight' | 'curved' (19-stack-links.js)
    g: HomRange.glider({ omega: 7 }),   // the position x in planes (set directly: a scrub, a swipe, the glide below)
    anim: null,      // the glide to a plane: {from, to, t0, ms, held, drawn}, eased in and out over a fixed time (no spring tail); held: the place a hold waits on ({x: the place it waits to draw, at: the place it shows, el: its clock there}), drawn: its last frame's place and clock (svMotionDrawn)
    sig: null,       // the chain and shapes last seen (another one: an example or a link was opened)
    footT: -1,       // the colour plane and Cauchy kind the style row was last built for
    dcSeen: '',      // the phase style svCheck saw last
    sheetsSeen: null,   // All sheets as svCheck saw it last (null: not yet)
    main: null,      // the view the steps view set last (svViewFix): a parked view rounds to a plane it was not set for
    restHeld: -1,    // the plane whose frame at rest the left pane holds for a waiting glide (svDrawPlane), -1 for any other frame: the pane's stage (leftStage), so its rulers, scale and corner, handles and probe are that plane's, as its picture is
    drag: null,      // a scrub of the strip or a swipe of the plane: {x0, i0, px, w, id, edge}
    els: null,
    ready: false,    // setup is done: S.sv may be written (before it, the state's own place is still to be read)
  };
  // the glide's time a plane, by speed (a setting kept on this device)
  const SV_SPEEDS = { fast: 450, normal: 900, slow: 2000, slower: 4500 };
  SV.speed = (() => { try { const v = localStorage.getItem('cmw-sv-speed'); return v && SV_SPEEDS[v] ? v : 'normal'; } catch (e) { return 'normal'; } })();
  SV.loop = (() => { try { return localStorage.getItem('cmw-sv-loop') === '1'; } catch (e) { return false; } })();
  SV.span = null;   // the planes a glide crosses as one homotopy (All at once): {x0, x1, stepT?}, indices into svPlanes() and the steps' own times (svStepTSplit); null: plane by plane
  SV.play = null;   // play along the thread (#438): {from, to, start, t0, ms, held, drawn, label} a glide (held, drawn: svLinkHold's; label: the words of a crossing not yet drawn, svMotionDrawn), or {slide, start, end, timer} one plane at a time
  SV.hold = null;   // a hold in the middle of a play, shown on ▶ after SV_GATE_SHOW_MS (svHoldWait): {btn, A (the play), t0, timer, shown, keep, fill, gauge (the ring's fill: the share of svHoldLeft gone), left0, ending (the full ring stands two animation frames)}
  SV.offscreen = 0;   // > 0 while an export draws a plane or a glide frame off-screen (svAtPlane, svGlideArt): the page is not written
  // the planes: z and the stage after each active step
  // (#437: a step shown alone narrows the thread to the plane before it and its own. So index 0 is not always z: while a step is
  // shown alone the list starts at its input plane. Code that needs z asks for stage 0, not svPlanes()[0])
  function svPlanes() { const k = svAloneOk(); return k ? [svPrev(k), k] : [0].concat(activeSteps()); }
  function svStage(i = SV.i) { const P = svPlanes(); return P[Math.max(0, Math.min(P.length - 1, i))]; }
  // the plane the thread is nearest to (a glide's second half is nearer the plane it is going to than the one it left)
  const svNear = () => svStage(Math.round(SV.g.x));
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
  // the shown plane is coloured from the colour plane: at or before it, and not across a d/dz (whose input is z's plane, not w_k's)
  function svColoured(k = svStage()) { const T = svT(); return k <= T && (k === 0 || !derivIn(k, T)); }
  // which way the shown plane is painted: 'pull' on a coloured plane (the colour is pulled back through the map), 'push' past it
  // (the colour plane's colour is pushed forward); the one flag the plane's UI reads, whatever the drawing core does
  const svPaint = (k = svStage()) => (svColoured(k) ? 'pull' : 'push');
  const svMap = () => { const k = svStage(); return k === 0 ? stageMap(svT()) : { mode: 0, a: k, b: svT() }; };
  // The Landscape's height follows the colour plane T, as the colour does: a point's height is h of its image in T,
  // the same on every plane. Plane k's heights are carried by the points of plane svHeightSrc(k): k itself up to T (the
  // map from w_k into T, the colour's), T's own points past it (as they carry T's colour), and z's points where a d/dz
  // step between k and T leaves no map from the later plane to the earlier one's, as the colour's carry
  const svHeightSrc = (k) => { const T = svT(), a = Math.min(k, T); return derivIn(a, Math.max(k, T)) ? 0 : a; };
  // the height map of plane k: a map spec from plane svHeightSrc(k) into T, and its CPU twin
  const svHeightMap = (k) => ({ mode: 0, a: svHeightSrc(k), b: svT() });
  const svHeightF = (k) => { const s = svHeightSrc(k), T = svT(); return s === T ? (z) => z : rangeF(s, T); };
  // plane k's Landscape is plain: k is before the colour plane T with a d/dz step between them, so its 2D picture has no
  // colour (shapes only). Every plane past T is coloured from T, through the z points it shares with T when a d/dz step
  // lies between them
  const svPlain = (k) => !svColoured(k) && k < svT();
  // (one name for a plane everywhere: the last is w₂ too, F is the name of the map into it)
  const svName = (k) => (k === 0 ? 'z' : `w${sub(k)}`);
  const svNameHtml = (k) => (k === 0 ? '<i>z</i>' : `<i>w</i><sub>${k}</sub>`);
  // the map from plane k into the colour plane T, by name: F from z into the last plane, else f_T ∘ … ∘ f_{k+1}
  // (f₂, f₃∘f₂, f₄∘⋯∘f₂); null when k is T itself (the wheel is the plane's own phase). fmt 'html', 'text' or 'tex'
  function svMapName(fmt, k = svStage(), T = svT()) {
    const P = svPlanes(), ss = P.filter((s) => s > k && s <= T), h5 = fmt === 'html', tex = fmt === 'tex';
    if (!ss.length) return null;
    if (k === 0 && T === P[P.length - 1]) return h5 ? '<i>F</i>' : 'F';
    const f = (s) => (h5 ? `<i>f</i>${sub(s)}` : tex ? `f_{${s}}` : `f${sub(s)}`), q = ss.slice().reverse();
    const o = tex ? '\\circ ' : '∘', dots = tex ? '\\cdots' : '⋯';
    return q.length === 1 ? f(q[0]) : q.length === 2 ? `${f(q[0])}${o}${f(q[1])}` : `${f(q[0])}${o}${dots}${o}${f(q[q.length - 1])}`;
  }
  // the name of what the Landscape's height reads on plane k (fmt as svMapName's): the map into the colour plane up to T
  // ("f₂", F from z into the last plane), the plane's own variable on T, and T's variable where the points carry T's
  // heights (past T, or before it across a d/dz step)
  function svHeightName(fmt, k = svStage()) {
    const T = svT(), m = svColoured(k) ? svMapName(fmt, k, T) : null;
    return m || (fmt === 'html' ? wHtml(T) : fmt === 'tex' ? (T === 0 ? 'z' : `w_{${T}}`) : svName(T));
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
  // the plane the shown plane's colour is carried from, "w₁", on every plane but the colour plane's own (the key says so); else ''.
  // A plane that draws no carried hue keeps its own key: before T the Cauchy style paints paper, not T's colour, and a plane
  // before a d/dz step shows shapes only
  const svCarriedFrom = () => (SV.on && (svStage() > svT() || (svStage() < svT() && svColoured() && S.dc !== 'cauchy')) ? svName(svT()) : '');
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
  // colour plane the colour is carried by the points, which the role says. A Landscape names its height (svHeightName),
  // then past T that the points carry it and their colour from T. Parked between two planes, the place is no plane: the
  // title names the two, as the live label does (svLabel), "z → w₁ · coloured from w₁" (past T, carried from it).
  // short: the role's short form for a narrow head, plain text, and shortP the plane's name that ends it, set as maths after
  // it (a carried Landscape's, where the language puts the name last); shortFirst: the head shows it in place of the role cut
  // to its first words, which would lose what the short form keeps (a carried Landscape's "carried from w₁": its height stays
  // in the title's tip and the Height key)
  function svTitleParts() {
    // (the plane the thread is nearest to, not the one it last arrived at: a glide's header turns over at the half, as the picture does)
    const k = svNear(), T = svT(), map = svMapName('html', k, T) || wHtml(k);
    let role, short = '', shortP = '', shortFirst = false;
    const park = svParkedPair();
    if (park && !(SV.surf === 'land' && svMain(k) === 'land')) {
      role = park[1] <= T ? $t('coloured from {p}', { p: wHtml(T) }) : $t('colour carried from {p}', { p: wHtml(T) });
      return { name: `${svNameHtml(park[0])} → ${svNameHtml(park[1])}`, role, short, shortP, shortFirst };
    }
    if (SV.surf === 'land' && svMain(k) === 'land') {
      const o = { h: heightHtml(svHeightName('html', k)), sheets: landSheetsHtml(), p: wHtml(T) };
      role = k > T ? $t('landscape of {h}{sheets}, carried from {p}', o) : $t('landscape of {h}{sheets}', o);
      if (k > T) {
        const [head, tail] = $t('landscape, carried from {p}', { p: '\u0001' }).split('\u0001');
        if (tail === '') { short = head; shortP = svName(T); } else short = $t('landscape, carried from {p}', { p: svName(T) });
      } else short = $t('landscape');
      shortFirst = k > T;
    } else if (!svColoured(k)) role = k > T ? $t('colour carried from {p}', { p: wHtml(T) }) : $t('shapes only');
    else if (k === 0 && S.dc === 'cauchy' && cauchyPlot()) { role = $t('Cauchy integral over {name}', { name: cauchyPlot().name }); short = $t('Cauchy integral'); }
    else if (k === T) role = $t('colour plane');
    else role = $t('phase of {ofV}', { ofV: map });
    return { name: svNameHtml(k), role, short, shortP, shortFirst };
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
    // undo)
    if (!SV.on || !SV.els) return;
    const sig = svSigNow();
    // (another chain loaded under a Play, Loop on: it stops, or it never adopts the new view)
    if (SV.play && SV.sig != null && sig !== SV.sig) svPause(false);
    // (and a press still waiting for its chain to be prepared: the wait ends, so nothing starts on the chain loaded instead)
    if (SV.gate && SV.sig != null && sig !== SV.sig) svGateEnd();
    if (svGliding()) return;
    const P = svPlanes();
    if (SV.i > P.length - 1) { SV.i = P.length - 1; SV.g.set(SV.i); }
    if (SV.T >= 0 && !P.includes(SV.T)) SV.T = -1;
    // (the Cauchy style's carried programs, its own variants, started as it is chosen)
    if (S.dc === 'cauchy' && SV.dcSeen !== 'cauchy') svPrestartSoon(0);
    // (the Cauchy style is drawn on z, so choosing it, or loading a state, example or tour step that has it, colours from z)
    // (and the thread parks on z with it: the style's control is in the pane of the colour plane, which the view shows only while it is the plane the thread is on)
    if (S.dc === 'cauchy' && SV.dcSeen !== 'cauchy' && !SV.alone && P.length > 1) { if (SV.T !== P[0]) SV.T = P[0]; if (SV.i !== 0) { SV.dcSeen = S.dc; svGo(0, true); } }
    SV.dcSeen = S.dc;
    // (All sheets ticked by any of its writers, the check, a tour step's look or an example, with the Landscape shown: its
    // glide's carry places the sheets then, so that program starts linking at once, svPrestart)
    if (S.sheets && SV.sheetsSeen === false && SV.surf === 'land') svPrestartSoon(300);
    SV.sheetsSeen = !!S.sheets;
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
    // (always from the last plane, F's; X → Y keeps its colour inside its regions when it has areas;
    // Views.svOf, concept §6)
    const areas = S.shapes.some((s) => s.visible !== false && kindType(s) === 'area');
    const o = Views.svOf(S.view, areas, S.steps.length === 0);
    SV.T = o.T; SV.scope = o.scope; SV.surf = o.surf; SV.links = 'straight';
    if (SV.els) setSeg(SV.els.scope, SV.scope);   // (the head's switch shows what the view opened on)
    SV.i = 0; SV.g.set(0);
  }
  // S.sv, the steps view's place, saved in the state, in links and kept by undo (Views.cleanSv; the speed is the state's, and
  // the device's setting for a state without one). svStore writes it before a save and an undo entry; a link and a scene
  // file take the place on screen from svPlace (figureState), without writing S; svLoad reads it when the page opens on a
  // state that has one, and after an undo
  function svStore() {
    const o = svPlace();
    if (o) setOpt('sv', o);
  }
  // the steps view's place as svStore writes it, or null while the view is off or not set up
  function svPlace() {
    if (!SV.on || !SV.ready) return null;
    // (a step shown alone keeps the whole chain's place, which is what undo and a link restore)
    const b = SV.alone && SV.back ? SV.back : null;
    const o = { at: b ? b.i : SV.anim ? SV.anim.to : SV.g.x, T: b ? b.T : SV.T, scope: SV.scope, surf: SV.surf, links: SV.links, speed: SV.speed };
    if (SV.surf === 'stack') o.cam = stackCamSaved();   // (the Stack's camera: a link opens in the view it was saved in)
    if (SV.alone) o.alone = SV.alone;   // (the step shown alone is part of the state: a reload, a language switch and a link keep it)
    return o;
  }
  function svLoad(onPageOpen) {
    // (by the chain's own steps: after an undo the active steps (svPlanes) still read the chain before it, which would clamp the place)
    const o = Views.cleanSv(S.sv, svAloneOk() ? svPlanes() : svPlanesOf(S.steps));
    if (!o) return false;
    SV.T = o.T; SV.scope = o.scope; SV.surf = o.surf; SV.links = o.links || 'straight';
    if (o.surf === 'stack' && (o.cam || onPageOpen)) stackCamOpen(o.cam || null);
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
  // another S.sv is under the view: an undo put it there, or the tour's end gave the user's work back
  function svRestored() {
    if (!SV.on || !SV.ready) return;
    if (SV.alone) { SV.alone = 0; SV.back = null; }   // (an undo leaves a step shown alone)
    const ls = SV.lastSplit, lu = SV.lastUnsplit;
    SV.lastSplit = null; SV.lastUnsplit = null;
    // (the undo of the split just made, with a glide or a play under way: it goes on, as the split's did; and the redo of
    // that split, as the split itself. Each is told by the chain it restores, the one before the Split or the one it made)
    SV.restored = 'load';   // (how the last undo or redo was taken: 'unsplit', 'resplit' or 'load', for the test hook)
    if (ls && svGliding() && ls.pre === svStepsSig()) { SV.split = { inv: true, k: ls.k, n: ls.n, j: ls.j }; SV.lastUnsplit = ls; SV.own = true; SV.restored = 'unsplit'; return; }
    if (lu && svGliding() && lu.sig === svStepsSig()) { SV.split = { k: lu.k, n: lu.n, j: lu.j, x: SV.g.x, rest: false, moving: true }; SV.lastSplit = lu; SV.own = true; SV.restored = 'resplit'; return; }
    if (svLoad()) { SV.sig = null; setTimeout(svApply, 0); }
  }
  function svApply() {
    const k = svStage();
    svViewFix();
    leftAuto = false;
    if (k > 0) Object.assign(V.left, S.srcView);
    // (off-screen the view's state is all the picture needs; the page keeps showing where the view is, and is put back to)
    if (SV.offscreen) return;
    applyLayout();
    buildShapeList();
    updateFocusUI();
    requestRender('L', 'R', 'OL', 'OR', 'G');
    svSync();
  }
  // leave the shown plane: its view (panned or zoomed there) is the camera every plane shares
  function svKeepView() { const k = svStage(); if (k > 0) Object.assign(S.srcView, { cx: V.left.cx, cy: V.left.cy, s: V.left.s }); }
  // the app's scroll of the rail to v (from s, where the rail is): its last two values are kept, by which its scroll events are told from the
  // user's, and the first is what the rail is put back to when the browser clamps it while the rail's width changes
  function svRailTo(E, v, s = E.scrollX) {
    E.writes = [v, E.writes ? E.writes[0] : v];
    if (v !== s) { E.rail.scrollLeft = v; E.scrollX = v; svFades(); }
  }
  // the rail's next follow brings the ring into view, though the ring has not moved (a press on the thread, ‹ and › at an end)
  function svFollowRing() { if (SV.els) SV.els.followKey = null; }
  // go to plane i: a glide along the steps in between (at once under reduced motion)
  function svGo(i, now) {
    svFollowRing();
    const P = svPlanes(), moving = !!(SV.anim || SV.play);
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
    // (a press while the wait runs cancels it: on the button that shows it, that is all; elsewhere the new glide waits instead)
    const btn = i > from ? SV.els.next : SV.els.prev;
    if (SV.gate) { const same = SV.gate.btn === btn; svGateEnd(); if (same) return; }
    // (from rest, the motion's frames may be drawn ahead while it waits; a press during a motion retargets it live)
    const ms = per * Math.min(2, Math.max(0.35, Math.abs(i - from))), M = moving ? null : { from, to: i, ms, eased: true, span: svSpanOf(from, i) };
    if (svAhead && (!M || svAhead.key !== svAheadKey(paneL, M))) svAheadDrop();
    // (the Landscape steps a plane at a time, with no frames between planes: an arrow or a plane of the strip there waits
    // for nothing, and no wait holds back its at-rest refinement)
    if (SV.surf !== 'land' && svGateNeeded(M)) { svGated(btn, () => svGo(i), M); return; }
    SV.span = svSpanOf(from, i);
    SV.anim = { from, to: i, t0: performance.now(), ms };
    draft = null; probe = null;
    requestRender('L');
    svAheadStart(M);
  }
  // runs draw() with the view at plane i, then puts the view back where it was: on its plane, at the place between two planes
  // it was parked at, with its view and with the plane it last arrived at. A visit, not an arrival: no plane-changed event, no
  // sound relayout and no spoken label, and while it lasts the page is not written (svApply and svSync wait on SV.offscreen:
  // the strip, the slider and the pane's name keep saying where the view is). A Play or a glide under way is held for the visit
  // and goes on afterwards: a glide from where it was, its clock moved on by the visit's time; a slide (Play under reduced
  // motion) on the plane it was on, its next step a full svSlideMs() after the visit. So a figure or a video drawn off-screen
  // leaves the page as it found it. (They are drawn under a modal dialog, so no Play or glide starts during draw(): what is
  // put back is what was held.) -> draw()'s result
  async function svAtPlane(i, draw) {
    const keep = { i: SV.i, x: SV.g.x, span: SV.span, at: SV.at, view: Object.assign({}, V.left), play: SV.play, anim: SV.anim };
    // (stay: the view is at rest on plane i with nothing playing, so draw() needs no visit)
    const stay = i === keep.i && Math.abs(keep.x - i) <= SV_REST_U && !keep.play && !keep.anim;
    const visit = (k, x) => { SV.span = null; SV.g.set(x); SV.i = k; svApply(); };
    const t0 = performance.now();
    // (the counter goes up just before the try whose finally takes it down: a throw in either visit cannot leave it up)
    SV.offscreen++;
    try {
      if (!stay) {
        if (keep.play && keep.play.slide) clearTimeout(keep.play.timer);
        SV.play = null; SV.anim = null;
        svKeepView();
        visit(i, i);
      }
      return await draw();
    } finally {
      if (stay) SV.offscreen--;
      else {
        const held = performance.now() - t0;
        for (const A of [keep.play, keep.anim]) if (A && A.t0 != null) A.t0 += held;
        SV.play = keep.play; SV.anim = keep.anim;
        try { visit(keep.i, keep.x); } finally { SV.offscreen--; }
        Object.assign(V.left, keep.view); SV.span = keep.span; SV.at = keep.at;
        if (keep.play && keep.play.slide) keep.play.timer = setTimeout(() => svSlide(false), svSlideMs());
        requestRender('L');
      }
    }
  }
  function svArrive() {
    svPolesWatch();
    // (the motion whose frames were drawn ahead ended: they go, unless a play paused on them, which may resume)
    if (svAhead && svAhead.A && !svAhead.paused) svAheadDrop();
    const i = Math.round(SV.g.x), was = SV.at;
    SV.span = null;
    SV.g.set(i);
    SV.i = i;
    svApply();
    // (the tour and an example's Try line listen for it: a plane reached other than the one it was at; not a plane the view was
    // opened on)
    SV.at = i;
    if (was !== i) { const n = svPlanes().length; tourEmit('plane-changed', { i, n, last: i === n - 1 }); svPrestartSoon(300); }
    if (typeof sndRelayout === 'function') sndRelayout();
    const live = SV.els && SV.els.live;
    if (live) live.textContent = svAheadTail(svLabel());
    if (svAheadProbeM && !SV.anim && !SV.play) svAheadProbe();
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
      // (held: it does not move while it waits, svLinkHold)
      if (SV.anim.held) { dirty.L = true; return true; }
      // (SV.clock, a test hook's, null in the app: the glide's time advances that many ms a frame instead of by the wall
      // clock, so a suite reads its frames mid-glide however long each one takes to draw)
      const A = SV.anim, el = SV.clock ? (A.el = (A.el || 0) + SV.clock) : performance.now() - A.t0;
      const v = Math.min(1, el / A.ms), e0 = HomRange.ease3(v);
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
  // the colour plane), or All sheets draws several sheets of a carry from z (landSheetsMap(0): the chain up to the colour
  // plane, so a step after it changes nothing); then z's plane. Every stage is a function of z (chainRange from plane 0
  // crosses a d/dz step, from a later plane it cannot), and the sheets of a step before s0 exist only as the preimages
  // of z's points
  const svCarryFrom = (s0, ts) => (S.sheets && multiSheet(landSheetsMap(0)) || ts.some((t) => t > s0 && derivIn(s0, t)) ? 0 : s0);
  // the longest edge a cell of the carried grid may have once placed by the glide's map, as a share of the pane's longer
  // side (svLandCarry's lim, in the plane's units): a cell stretched past it, by a pole of the map or a fold, is left
  // out, and the patches about the poles cover its place
  const LAND_CELL_SPAN = 0.35;
  // The Landscape as the points of a source plane s carried (render3D's carry), from plane a's surface at u = 0 to plane
  // b's at u = 1 (b null: a's). s is min(a, T), or z's plane when a d/dz step lies in the way or All sheets draws a
  // multivalued chain (svCarryFrom), so every point past T keeps T's colour and height. Each point is placed by mapOf(s)
  // (a map spec from plane s), at the height of its image in T (hmap, the stages (s, T]: the same on planes a and b and
  // in every frame between them) and in that image's colour, or in no colour while the nearer plane is plain (svPlain;
  // T is then s, and the height plane hT stays the colour plane). key: from z's plane to a later one, the 2D carried
  // colour's sheet key of the plane the frame goes to (svSheetKey), so where the places fold the point in front is the
  // one the 2D picture shows; else null. vs, va, vb: the shared camera's view (S.srcView: a glide moves the picture,
  // never the view), the same for s, a and b.
  // rest: the plane at rest the frame is (the probe picks on its relief), else null. zmap: the same map from z's plane, the
  // map the shapes' outlines are drawn under, so the floor's lines are carried as the surface is
  function svLandCarry(mapOf, a, b, u, rest = null) {
    const T0 = svT(), e = b == null ? a : b, plain = svPlain(u < 0.5 ? a : e);
    const s = svCarryFrom(Math.min(a, T0), [e, T0]), T = plain ? s : T0;
    const lim = LAND_CELL_SPAN * Math.max(paneL.w, paneL.h) / S.srcView.s, hmap = { mode: 0, a: s, b: T0 };
    const cam = S.srcView;
    const key = !plain && s === 0 && e > 0 ? svSheetKey(e) : null;
    return { map: mapOf(s), zmap: mapOf(0), s, T, hT: T0, hmap, plain, key, lim, u, a, b, vs: cam, va: cam, vb: b == null ? null : cam, rest };
  }
  // plane k's Landscape at rest: its own relief (render3D without a carry, heights and colour of the one map into T)
  // when it is coloured from T; else plane k's points (k before T, plain) or T's (past it) carried to plane k, at their
  // heights and in their colour in T. Undefined for the rest frame
  function svLandRest(k = svStage()) {
    if (!SV.on) return undefined;
    const T = svT(), to = (s) => ({ mode: 0, a: s, b: k });
    if (k <= T) return svPlain(k) ? svLandCarry(to, k, null, 0, k) : undefined;
    return svLandCarry(to, T, k, 1, k);
  }
  const LAND_PICK_GRID = 64, LAND_PICK_SEEDS = 4;
  // the seeds for Newton's method toward a point w of a carried Landscape: (w, n) -> the n points p of the LAND_PICK_GRID x
  // LAND_PICK_GRID grid over plane s's box src whose images F(p) are nearest w (the grid is made on the first call)
  function svLandSeeds(F, src) {
    const N = LAND_PICK_GRID;
    let pts = null;
    const grid = () => {
      const out = [];
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const p = C(src.x0 + (i + 0.5) / N * (src.x1 - src.x0), src.y0 + (j + 0.5) / N * (src.y1 - src.y0)), q = F(p);
        if (CX.isFin(q)) out.push({ p, q });
      }
      return out;
    };
    return (w, n) => {
      if (!pts) pts = grid();
      const near = [];
      for (const g of pts) {
        const d = Math.hypot(g.q.re - w.re, g.q.im - w.im);
        if (near.length < n || d < near[near.length - 1].d) { near.push({ d, p: g.p }); near.sort((x, y) => x.d - y.d); if (near.length > n) near.pop(); }
      }
      return near.map((g) => g.p);
    };
  }
  // The value of the height map at the point w of a carried Landscape at rest (render3D's carry with rest set, a plain
  // plane or one past T), what the probe picks on and reads: a point p of plane s carried to w (carry.map, Newton's
  // method from svLandSeeds' LAND_PICK_SEEDS points), and p's image in the height plane (carry.hmap). Where sheets cross
  // over w, the one whose height is highest, the one a ray from above meets first; null where no point of the box is
  // carried to w
  function svLandPickF(carry, src) {
    const F = cpuMap(carry.map), H = cpuMap(carry.hmap);
    if (!F || !H) return () => null;
    const seeds = svLandSeeds(F, src), size = Math.max(src.x1 - src.x0, src.y1 - src.y0);
    return (w) => {
      let best = null, top = -Infinity;
      for (const p of seeds(w, LAND_PICK_SEEDS)) {
        const z = newtonTo(F, w, p, 1, 1e-9 * (1 + CX.abs(w)), 0.1 * size);
        if (!z || z.re < src.x0 || z.re > src.x1 || z.im < src.y0 || z.im > src.y1) continue;
        const v = H(z), h = CX.isFin(v) ? landValue(v) : Infinity;
        if (h > top) { top = h; best = v; }
      }
      return best;
    };
  }
  // The sheets of a carried Landscape at rest on plane k past its source plane s (the pick on its sheets,
  // pickLandSheet): fibre(w, seeds, grid) -> [{z, v}], every point z of plane s's box src that the carry takes to w,
  // with its image v in the height plane (carry.hmap). They are the exact preimages where the steps (s, k] have them
  // (exactPre), else Newton's method from seeds (the points of a nearby w, as a ray's march passes them on) and, unless
  // grid is false, from the LAND_PICK_FIBRE grid points whose images are nearest w, one point for points within
  // LAND_PICK_SAME of the box's size. fibre.H is the height map, fibre.s the plane s
  const LAND_PICK_FIBRE = 16, LAND_PICK_SAME = 1e-7;
  function svLandFibreF(carry, src, k) {
    const F = cpuMap(carry.map), H = cpuMap(carry.hmap);
    if (!F || !H) return null;
    const grid = svLandSeeds(F, src), size = Math.max(src.x1 - src.x0, src.y1 - src.y0);
    const inBox = (z) => z && CX.isFin(z) && z.re >= src.x0 && z.re <= src.x1 && z.im >= src.y0 && z.im <= src.y1;
    const fibre = (w, seeds, fromGrid = true) => {
      const ex = exactPre(carry.s, k, [w.re, w.im]), zs = [];
      const add = (z) => { if (inBox(z) && !zs.some((q) => CX.abs(CX.sub(q, z)) <= LAND_PICK_SAME * size)) zs.push(z); };
      if (ex) ex.zs.forEach(add);
      else for (const p of (seeds || []).concat(fromGrid || !seeds ? grid(w, LAND_PICK_FIBRE) : [])) add(newtonTo(F, w, p, 1, 1e-9 * (1 + CX.abs(w)), 0.1 * size));
      return zs.map((z) => ({ z, v: H(z) }));
    };
    return Object.assign(fibre, { H, s: carry.s });
  }
  // a Landscape glide's copies fade in from u = 0 and are whole from u = SV_FADE_END on
  const SV_FADE_END = 0.5;
  // The Landscape between two planes a and b: the points of plane s carried by the glide's map, each at its height and
  // colour (svLandCarry); at u = 0 and 1 that is plane a's and plane b's surface at rest, since F_s = F_b ∘ (the map
  // s → b). Across a d/dz step the points of z's plane move along the classic deformation's straight line from stage a
  // to stage b (mode 1 at a d/dz step), so the glide is continuous as everywhere else. At a plane, that plane's surface
  // at rest. False when the Landscape is not on the pane
  function svLandMoving(pane) {
    if (SV.surf !== 'land' || !lLand()) return false;
    const g = svBetween();
    if (!g.all && (g.u <= SV_REST_U || g.a === g.b)) { render3D(pane, svLandCarryNow()); return true; }
    const carry = svLandCarryNow();
    // (onto a plane b coloured by its own variable: the other sheets' copies of the carried surface, svGlideSheets, as
    // the Plane's glide draws them; not with All sheets, whose surfaces are the carry's own, nor under Inside regions,
    // where plane b shows the principal sheet's image of the regions)
    const sheets = !g.all && !S.sheets && !carry.plain && !isDeriv(g.b) && svColoured(g.b) && !svMaskOn() && SV.glideSheets !== 1 ? svGlideSheets(g.a, g.b, carry.s) : [];
    // (the seams first: drawLandscape draws the opaque copies in this order, then the principal surface over them, then
    // the translucent ones. band: the cut's angle when a seam may draw a band about it alone (svSeamCut), else null.
    // alpha: the copies and their seams fade in over the glide, none at plane a and whole from u = SV_FADE_END on, so
    // the frame leaves plane a as it is parked and has plane b's sheets well before it parks there; the principal
    // sheet's seam (the first) is its own surface and stays opaque. SV.glideFade: a test's fixed alpha)
    const band = svSeamCut(g.b, carry.s), seams = sheets.length && SV.glideSeams !== 0 ? svGlideSeams(g.a, g.b, carry.s) : [];
    const fade = SV.glideFade != null ? SV.glideFade : smoothstep(0, SV_FADE_END, g.u);
    carry.copies = [...seams.map((v, n) => ({ draw: (f) => svOnSheets(v, f), band, alpha: n ? fade : 1 })), ...sheets.map((v) => ({ draw: (f) => svOnSheets(v, f), band: null, alpha: fade }))];
    render3D(pane, carry);
    return true;
  }
  // the carry the Landscape draws now (render3D's), undefined for a plane's own relief at rest
  function svLandCarryNow() {
    const g = svBetween();
    if (!g.all && (g.u <= SV_REST_U || g.a === g.b)) return svLandRest(g.near);
    return svLandCarry((s) => svGlideMap(g, s), g.a, g.b, g.u);
  }
  // The carried grid's patches for GLR.drawLandscape (CARRY_Z), [x, y, r0, r1] each, from a ten-thousandth of a cell of
  // the box's N x N grid to eight cells: one about each pole of the carry's map (from plane s) in plane s's carried box
  // src, nearest the box's centre first, at most 4; one about each of the map's branch points (svLandBranches) not within
  // a cell of one of them, out to svLandBranchReach and marked hole; and with hF, one about each pole of the height map in
  // the far patches' ring (svLandHeightPoles). Near a pole the map carries a small disc over the far plane, where the
  // box's cells stretch past the tear limit and are left out; about a branch point the sheets meet and the cells stretch
  // the same way. On the principal surface's carry a branch point's patch (hole) draws only where the box's cells and
  // the pole patches leave a hole (GLR.drawLandscape): its coarse outer cells would otherwise lie over finer ones that
  // draw the surface well. All sheets' carry draws it as it draws a pole's patch.
  // The glide map's poles and branch points take the map's seam (svPatchSeam): a patch's rings start at the cut out of
  // its point, so no cell straddles the cut. branchSeams false (the carry draws the other sheets' copies, which draw no
  // patches of their own) leaves a branch point's patch without it, so it covers the point on both sides of the cut,
  // where a seamed patch would leave the far side bare
  // The poles are searched for (svPolesIn) once per carry: its map but for t, and src. Then each frame follows the last
  // frame's poles by Newton's method (svPoleAt; one that does not settle stays where it was): a glide's poles move little
  // from frame to frame, and a step's own poles (a Möbius step's) not at all. (The glide's pole tracks, svPoleTracks, are
  // of the map from plane 0 over the camera's window; the carry's map is from plane s over its box)
  // Each patch's seam (svPatchSeam) is kept with them, by the patch: it is measured again only for a new key or a pole or
  // branch point that moved, so a frame drawn again at rest (the camera turned, a readout) measures none. runs: the seams measured
  const svLandPoleMemo = { key: '', poles: [], seams: new Map(), runs: 0 };
  function svLandPatches(map, src, N, hF, hKey, branchSeams = true) {
    const F = cpuMap(map);
    if (!F) return [];
    const key = JSON.stringify([map.mode, map.base, map.hi, map.a, map.b, map.post, map.t, src.x0, src.x1, src.y0, src.y1]), E = { n: 0, at: 0 };
    let poles;
    if (svLandPoleMemo.key === key) poles = svLandPoleMemo.poles.map((p) => svDrain(svPoleAt(F, p, src, E)) || svDrain(svSingularAt(F, p, SV_SING_BIG, E, src)) || p);
    else poles = svDrain(svPolesIn(F, src, 16, src, E, true));
    const cell = Math.max(src.x1 - src.x0, src.y1 - src.y0) / (N - 1), cx = (src.x0 + src.x1) / 2, cy = (src.y0 + src.y1) / 2;
    const near = poles.sort((p, q) => Math.hypot(p.re - cx, p.im - cy) - Math.hypot(q.re - cx, q.im - cy)).slice(0, 4);
    const was = svLandPoleMemo.key === key ? svLandPoleMemo.seams : null, seams = new Map();
    const patch = (p, r1 = cell * 8) => [p.re, p.im, cell * 1e-4, r1];
    const branches = SV.landBranches === 0 ? [] : svLandBranches(map, src, cell * 8).filter((b) => near.every((p) => Math.hypot(p.re - b.re, p.im - b.im) > cell));
    // (each patch's rings start at the map's cut out of its point, if it has one; a branch point's only with branchSeams.
    // The seam is kept by the patch, as svLandPoleMemo says)
    const seamed = (q) => {
      const id = q.join(','), seam = was && was.has(id) ? was.get(id) : (svLandPoleMemo.runs++, svPatchSeam(F, q));
      seams.set(id, seam);
      return Object.assign(q, { seam });
    };
    const branch = (b) => { const q = patch(b, svLandBranchReach(b, src, cell)); return Object.assign(branchSeams ? seamed(q) : q, { hole: true }); };
    const out = near.map((p) => seamed(patch(p))).concat(branches.map(branch));
    Object.assign(svLandPoleMemo, { key, poles: near, seams });
    return out.concat(hF ? svLandHeightPoles(hF, hKey, src, cell * 8).map((p) => patch(p)) : []);
  }
  // The reach of a branch point b's patch (svLandPatches) over plane s's carried box src of cells cell wide: eight cells,
  // or outside src, LAND_BRANCH_FAR cells of the far patch whose ring holds b (svLandFar, GLR.CARRY_FAR_N points a side)
  // if those are wider. There the far patch's cells next to b straddle the cut out of it and are torn, leaving a hole as
  // wide as they are, which a patch of the box's cells' size would fill only part of
  const LAND_BRANCH_FAR = 2;
  function svLandBranchReach(b, src, cell) {
    if (b.re >= src.x0 && b.re <= src.x1 && b.im >= src.y0 && b.im <= src.y1) return cell * 8;
    const [inner] = svLandFar(src), rho = Math.hypot(b.re - inner[0], b.im - inner[1]), k = rho <= inner[3] ? 0 : 1;
    return Math.max(cell * 8, (LAND_BRANCH_FAR * 2 * Math.PI * rho) / (GLR.CARRY_FAR_N[k] - 1));
  }
  // The branch points of a carry's map from plane s: where the input of a multivalued step it applies (a root, power or
  // logarithm, SV_SHEET_STEPS) is 0, in the carried box src or the far patches' inner ring about it (and within reach of
  // it), nearest the box's centre first, at most LAND_BRANCHES. There the map's sheets meet, and a cell of the box's grid
  // or of a far patch about the point is stretched past the tear limit and left out, leaving a hole; a pole patch's polar
  // grid about it is not stretched. Plane s is map.a at rest (mode 0) and map.base on a glide (modes 1 and 3).
  // The points are the zeros of each step's input as a map from plane s: rangeF(s, k - 1), which does not move with the
  // glide, but in an All-at-once span (mode 3) the input of a step after the span's first runs the steps before it at
  // the glide's time (cpuMap of the span up to k - 1), so its zeros move. They are searched for (svPolesIn of the
  // reciprocal) once per plane s, steps and box, and in a span each frame follows the last frame's points by Newton's
  // method (svPoleAt), as the glide map's poles do (svLandPatches)
  const LAND_BRANCHES = 4, svLandBranchMemo = { key: '', pts: [] };
  function svLandBranches(map, src, reach) {
    const mode = map.mode || 0, base = mode === 0 ? map.a || 0 : map.base || 0, hi = mode === 1 ? map.hi || 0 : map.b || 0, ks = [];
    for (let k = base + 1; k <= hi; k++) if (stepActive(k) && SV_SHEET_STEPS.includes(S.steps[k - 1].type)) ks.push(k);
    // (step k's input from plane s, and whether it moves with the glide)
    const moves = (k) => mode === 3 && k > (map.a || 0) + 1;
    const input = (k) => (moves(k) ? cpuMap({ mode: 3, a: map.a || 0, b: k - 1, t: map.t || 0, base, stepT: map.stepT }) : rangeF(base, k - 1));
    const inv = (G) => (z) => { const w = G(z); return w && CX.isFin(w) && !CX.isZero(w) ? CX.inv(w) : null; };
    const key = JSON.stringify([chainSig[nSteps()], mode, base, mode === 3 ? [map.a || 0, svStepTKey(map.stepT)] : 0, ks, src.x0, src.x1, src.y0, src.y1, reach]);
    const x = (src.x0 + src.x1) / 2, y = (src.y0 + src.y1) / 2, ring = svLandRing(src, reach), E = { n: 0, at: 0 };
    let pts;
    if (svLandBranchMemo.key === key) {
      if (!ks.some(moves)) return svLandBranchMemo.pts;
      pts = svLandBranchMemo.pts.map((p) => (moves(p.k) ? Object.assign(svDrain(svPoleAt(inv(input(p.k)), p, ring, E)) || C(p.re, p.im), { k: p.k }) : p));
    } else {
      pts = [];
      for (const k of ks) {
        for (const p of svDrain(svPolesIn(inv(input(k)), ring, LAND_ZERO_GRID, ring, E))) if (pts.every((q) => Math.hypot(q.re - p.re, q.im - p.im) > LAND_ZERO_TOL * (1 + ring.r))) pts.push(Object.assign(p, { k }));
      }
    }
    const out = pts.sort((p, q) => Math.hypot(p.re - x, p.im - y) - Math.hypot(q.re - x, q.im - y)).slice(0, LAND_BRANCHES);
    Object.assign(svLandBranchMemo, { key, pts: out });
    return out;
  }
  // the square about the carried box src's centre that holds the far patches' inner ring and reach beyond it (r: its half
  // side), where svLandBranches and svLandHeightPoles look
  function svLandRing(src, reach) {
    const x = (src.x0 + src.x1) / 2, y = (src.y0 + src.y1) / 2, r = LAND_FAR_NEAR * LAND_FAR_LAP * Math.min(src.x1 - src.x0, src.y1 - src.y0) / 2 + reach;
    return { x0: x - r, x1: x + r, y0: y - r, y1: y + r, r };
  }
  // The cut of the glide map F out of the point of a pole's patch p ([x, y, r0, r1]), if it has one: the branch of a power
  // or a log that ends there (the √ of a Möbius step ends at the step's pole). Its angle on SEAM_K (GLR.SEAM_RINGS, the
  // uSeam CARRY_ZIN takes) rings of the patch, ring k at k / (SEAM_K - 1) of the way out (radii geometric from r0 to r1, as CARRY_Z's), unwrapped from ring to ring;
  // the patch's rings start at it (CARRY_ZIN, uSeam), so no cell straddles the cut, and the patch ends along the cut
  // on both sides, where the branch ends. null when no ring has one. A ring's cut: of SEAM_M steps round it, the one whose
  // midpoint's image lies farthest from the midpoint of its ends' images, more than SEAM_JUMP of their distance (across a
  // cut the midpoint goes to one side, half the chord away, however near the branch's sides; a smooth step's sagitta is
  // a small part of it), bisected to its angle; a ring without one (too near the point for the map to take it whole, or
  // past the cut's end) takes the nearest ring's
  const SEAM_M = 96, SEAM_JUMP = 0.1, SEAM_BISECT = 32;
  function svPatchSeam(F, p) {
    const SEAM_K = GLR.SEAM_RINGS;
    const [x, y, r0, r1] = p, at = (r, th) => F(C(x + r * Math.cos(th), y + r * Math.sin(th)));
    const d = (a, b) => (a && b && CX.isFin(a) && CX.isFin(b) ? CX.abs(CX.sub(a, b)) : NaN);
    const seam = new Array(SEAM_K).fill(null);
    for (let k = 0; k < SEAM_K; k++) {
      const r = r0 * Math.pow(r1 / r0, k / (SEAM_K - 1)), W = [];
      for (let m = 0; m <= SEAM_M; m++) W.push(at(r, (-2 * Math.PI * m) / SEAM_M));
      // (each step's sagitta, the midpoint's image off the chord's midpoint, as a part of the chord)
      const sag = W.slice(0, SEAM_M).map((w, m) => {
        const c = d(w, W[m + 1]), h = at(r, (-2 * Math.PI * (m + 0.5)) / SEAM_M);
        return c > 0 && h && CX.isFin(h) ? d(h, C((w.re + W[m + 1].re) / 2, (w.im + W[m + 1].im) / 2)) / c : NaN;
      });
      if (sag.some((v) => !Number.isFinite(v))) continue;
      const mi = sag.indexOf(Math.max(...sag));
      if (!(sag[mi] > SEAM_JUMP)) continue;
      let a = (-2 * Math.PI * mi) / SEAM_M, b = (-2 * Math.PI * (mi + 1)) / SEAM_M, Fa = W[mi], Fb = W[mi + 1];
      for (let it = 0; it < SEAM_BISECT; it++) {
        const c = (a + b) / 2, Fc = at(r, c);
        if (d(Fa, Fc) > d(Fc, Fb)) { b = c; Fb = Fc; } else { a = c; Fa = Fc; }
      }
      seam[k] = (a + b) / 2;
    }
    const known = seam.map((v, k) => (v == null ? -1 : k)).filter((k) => k >= 0);
    if (!known.length) return null;
    const out = seam.map((v, k) => (v != null ? v : seam[known.reduce((q, j) => (Math.abs(j - k) < Math.abs(q - k) ? j : q))]));
    for (let k = 1; k < SEAM_K; k++) out[k] += 2 * Math.PI * Math.round((out[k - 1] - out[k]) / (2 * Math.PI));
    // (where the cut ends, between its outermost ring and the next: past it the rings close round with no gap, as a cut's
    // end is a branch point, where a gap SEAM_EPS wide would be blown up into a visible crack; bisected on the ring
    // fraction t, each time asking whether a short step across the seam there jumps)
    const kOut = known[known.length - 1];
    let end = 1;
    if (kOut < SEAM_K - 1) {
      const fr = (t) => r0 * Math.pow(r1 / r0, t), th = (t) => { const s = t * (SEAM_K - 1), k = Math.min(Math.floor(s), SEAM_K - 2); return out[k] + (out[k + 1] - out[k]) * (s - k); };
      const cut = (t) => {
        const r = fr(t), q = th(t), dq = (Math.PI / SEAM_M) * 0.5, A = at(r, q + dq), B = at(r, q - dq), H = at(r, q - dq * 0.5), c = d(A, B);
        return c > 0 && !!H && CX.isFin(H) && d(H, C((A.re + B.re) / 2, (A.im + B.im) / 2)) / c > SEAM_JUMP;
      };
      let lo = kOut / (SEAM_K - 1), hi = (kOut + 1) / (SEAM_K - 1);
      for (let it = 0; it < SEAM_BISECT; it++) { const m = (lo + hi) / 2; if (cut(m)) lo = m; else hi = m; }
      end = hi;
    }
    return Object.assign(out, { end });
  }
  // the point of a pole's patch p ([x, y, r0, r1], p.seam) at grid place (i, j) of an n x n grid, as CARRY_ZIN places it
  // (SEAM_EPS inside the cut on rings out to its end, p.seam.end)
  function svPatchZ(p, i, j, n) {
    const f = 1 / (n - 1), r = p[2] * Math.pow(p[3] / p[2], j * f);
    let th = -2 * Math.PI * i * f;
    if (p.seam) {
      const K = GLR.SEAM_RINGS, t = Math.min(Math.max(j * f, 0), 1) * (K - 1), k = Math.min(Math.floor(t), K - 2), E = j * f <= p.seam.end ? GLR.SEAM_EPS : 0;
      th = p.seam[k] + (p.seam[k + 1] - p.seam[k]) * (t - k) - E - (2 * Math.PI - 2 * E) * i * f;
    }
    return [p[0] + r * Math.cos(th), p[1] + r * Math.sin(th)];
  }
  // The poles of the height map hF (plane s to the height plane) in the far patches' inner ring, and within a pole patch's
  // reach (reach) of it, outside the carried box src, nearest the box's centre first, at most LAND_HEIGHT_POLES: the height
  // there is a log spike that the far patches' coarse cells facet, so each gets a pole patch of its own like the glide
  // map's poles (svLandPatches). With sing, as svLandPatches searches: a point where hF is unbounded without being a
  // pole (a root step after a Möbius step's pole, |hF| ~ |z - p|^-a with a < 1) is found too. hF does not move with the
  // glide, so they are searched once per plane s and box (hKey names hF)
  // (LAND_HEIGHT_GRID and LAND_ZERO_GRID: the grid a side the searches for the height map's poles and for the branch
  // points (svLandBranches) run on in the ring (svPolesIn); LAND_ZERO_TOL: two branch points found closer than it times the
  // ring's size are one)
  const LAND_HEIGHT_POLES = 8, LAND_HEIGHT_GRID = 64, LAND_ZERO_GRID = 64, LAND_ZERO_TOL = 1e-9, svLandHeightMemo = { key: '', poles: [] };
  function svLandHeightPoles(hF, hKey, src, reach) {
    const key = JSON.stringify([hKey, src.x0, src.x1, src.y0, src.y1, reach]);
    if (svLandHeightMemo.key === key) return svLandHeightMemo.poles;
    const x = (src.x0 + src.x1) / 2, y = (src.y0 + src.y1) / 2, ring = svLandRing(src, reach);
    const out = svDrain(svPolesIn(hF, ring, LAND_HEIGHT_GRID, ring, { n: 0, at: 0 }, true))
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
  // the glide between planes a and b at x: (a, b, u, the map of the z-plane's shapes along h_{b,u}, and near, the nearer
  // plane, whose title and key the pane shows). The regions' fill and stroke do not switch at near: each blends its own
  // look in by its share own(x) (svStagedOf), outlined over colour and filled past the colour plane as each plane at rest
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
      const a = P[span.x0], b = P[span.x1], u = (x - span.x0) / (span.x1 - span.x0), stepT = span.stepT || null, map = { mode: 3, a, b, t: u, stepT };
      // (F is the map spec's own CPU twin; H, the homotopy alone, is the same steps' homF composed, each at its own time:
      // span.stepT, the times of the steps Splits during this glide made of a formula, run as that formula's homotopy runs them)
      const homs = P.slice(span.x0 + 1, span.x1 + 1).map((k) => homF(k, HR.stepTime(stepT, k, u)));
      const H = (z) => { let w = z; for (const f of homs) w = f(w); return w; };
      return { a, b, u, map, F: cpuMap(map), H, near: u < 0.5 ? a : b, all: true, stepT, x0: span.x0, x1: span.x1 };
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
  // the map spec of a svBetween result g from the plane s, for a carried draw (s <= g.a): All at once, its span's steps
  // (at the span's step times) at g.u; else the step into g.b at g.u
  function svGlideMap(g, s) { return g.all ? { mode: 3, a: g.a, b: g.b, t: g.u, base: s, stepT: g.stepT } : { mode: 1, base: s, hi: g.b, t: g.u }; }
  // the chain's steps as a string, to tell a restored chain from another of the same length (svRestored)
  function svStepsSig() { return JSON.stringify(S.steps.map((st) => [st.type, st.params, st.on !== false])); }
  // a span's step times (stepT: [a, b] by step, or none) in a cache key (map and filter skip the sparse array's holes, the
  // steps with no time of their own)
  function svStepTKey(stepT) { return stepT ? stepT.map((m, k) => `${k}:${m[0]}:${m[1]}`).filter(Boolean).join(',') : ''; }
  // the span's step times after step k is split into n steps: a step after k moves n - 1 on, and the new steps k..k+n-1
  // run as the formula's homotopy runs them, in turn within the formula's own time [a, b] (none: [1, 0]). The rule
  // composes, clamp(n clamp(a t - b, 0, 1) - i, 0, 1) = clamp(a n t - (b n + i), 0, 1), so it holds for a step with a time
  // of its own as for any other (the page offers no such step: the Split's reader and its gate refuse the steps a Split
  // makes)
  function svStepTSplit(stepT, k, n) {
    const o = [], f = (stepT && stepT[k]) || [1, 0];
    if (stepT) stepT.forEach((m, i) => { if (i < k) o[i] = m; else if (i > k) o[i + n - 1] = m; });
    for (let i = 0; i < n; i++) o[k + i] = [f[0] * n, f[1] * n + i];
    return o;
  }
  // the span's step times after the n steps k..k+n-1 are the formula again (an undo of their Split): a step after them
  // moves n - 1 back, and the formula takes the time they ran in, [a, b] from their [a n, b n + i]; steps that ran
  // otherwise (a Split made before this glide) leave it the glide's own time. Null when no step has a time of its own
  function svStepTJoin(stepT, k, n) {
    if (!stepT) return null;
    const o = [], f = stepT[k];
    stepT.forEach((m, i) => { if (i < k) o[i] = m; else if (i >= k + n) o[i - n + 1] = m; });
    let own = !!f;
    for (let i = 0; own && i < n; i++) { const m = stepT[k + i]; own = !!m && m[0] === f[0] && m[1] === f[1] + i; }
    if (own && !(f[0] === n && f[1] === 0)) o[k] = [f[0] / n, f[1] / n];
    return o.some(Boolean) ? o : null;
  }
  // (a glide's frames sample the cuts' banks at a quarter of the density, 121 points a bank where it runs straight;
  // where a chord of them bends, cutBank takes the full set's samples there too)
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
    else if (SV.anim) {
      // (All at once, the run is the span's: a Split under way moves the animation's start to where the glide is, not the run's)
      const sp = SV.span;
      if (sp && svAllOk(sp.x0, sp.x1)) { lo = sp.x0; hi = sp.x1; } else { lo = Math.floor(Math.min(SV.anim.from, SV.anim.to) + 1e-9); hi = Math.ceil(Math.max(SV.anim.from, SV.anim.to) - 1e-9); }
    }
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
      key: JSON.stringify(['steps', chainSig[nSteps()], lo, hi, P, all, svStepTKey(all ? SV.span.stepT : null)]),
      alive: () => SV.on && S.morphPaths !== false, side: 'L', nogo: () => [], win: (pane) => (start === 0 ? pane.box() : clipWin),
    };
  }
  const svColourMap = (k) => (k === 0 ? stageMap(svT()) : { mode: 0, a: k, b: svT() });
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
  // hom: a glide's frame drawn by the inverse pass, where a region of plane k holds the points z of plane 0 whose
  // F_{0->k}(z) it holds (the pass tests it there), so the regions of later planes are drawn too; null: a region behind
  // a d/dz step, which the pass cannot take. The carried meshes (no hom) take a region of a later plane as the whole
  // plane, SV_ALL: it has no points on plane 0, and svMask's moving regions keep the colour inside it, as Everywhere is
  // under the mask
  function svCarryShapes(hom) {
    if (SV.scope !== 'in' || !svMaskOn()) return [SV_ALL];
    const areas = visibleAreas();
    if (!areas.some((x) => shapeStage(x))) return areas;
    if (!hom) return [SV_ALL];
    return areas.some((x) => shapeStage(x) && derivIn(0, shapeStage(x))) ? null : areas;
  }
  // the sheet key's parameters for the image on plane b of the points of plane s (default 0, plane z): the region
  // tiling's own (smKeyOf: clipWin, half its diagonal R, R / 8, Inverse.keySing of the map from s to b; with no inverse
  // plan, or s = b, the window alone), the one key the inverse pass, the pre-mapped meshes, these meshes and the
  // globe's carried mesh all order sheets by (Inverse.sheetKey)
  function svSheetKey(b, s = 0) {
    const k = smKeyOf({ mode: 0, a: s, b });
    if (k) return k;
    const R = Math.hypot(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0) / 2;
    return { win: clipWin, R, rs: R * SV_KEY_RS, sing: [], per: null };
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
  // svSingNewton's limits: at most SV_SING_ITERS Newton steps, each reading u again at most SV_SING_REREAD times; a
  // point is kept only where |F| at SV_SING_R (1 + |z|) from it is past big at each of four points, and grows towards it
  // by more than SV_SING_GROW from ten times as far (|F| ~ r^-a grows by 10^a: a root's a is at least about 0.2 where |F|
  // at that distance is past SV_SING_BIG, and a bounded branch point, 20 + √z at 0, does not grow); the four points are
  // turned SV_SING_TURN from the axes, so that a cut along an axis does not take one
  const SV_SING_ITERS = 16, SV_SING_R = 1e-6, SV_SING_GROW = 10 ** 0.1, SV_SING_TURN = 0.3, SV_SING_REREAD = 4;
  const SV_SING_OFF = [0.27, 0.31];   // svPolesIn's start for svSingNewton: this share of a cell off its grid point, on neither line
  // a point where F is unbounded without being a pole, from z, by Newton's method on u = h/h' (h = 1/F): u has a simple
  // zero where h has a zero of any order, a pole's (order 1) or a root's (|F| ~ |z - p|^-a, 0 < a < 1, where Newton's
  // method on h reflects about p or crawls). It is the point Newton's method settles on (u or its step under 1e-12 or
  // 1e-11 of 1 + |z|), within box, where |F| next to it is past big and grows towards it; null otherwise: a start that
  // does not settle (Newton on u reflects where u's zero is not simple, as exp(√z)'s u = -2√z sends z to -z), that
  // leaves the box, or that settles on no such point (a zero of h' alone)
  function* svSingNewton(F, z, box, big, E) {
    const h = (p) => { let w = null; try { w = F(p); } catch (e) { w = null; } return !w ? null : CX.isFin(w) ? (CX.isZero(w) ? null : CX.inv(w)) : C(0, 0); };
    const u = (p, e) => {
      const h0 = h(p), hp = h(CX.add(p, C(e, 0))), hm = h(CX.sub(p, C(e, 0)));
      if (!h0 || !hp || !hm) return null;
      const d = CX.div(CX.sub(hp, hm), C(2 * e, 0));
      return CX.isZero(h0) ? C(0, 0) : CX.isFin(d) && !CX.isZero(d) ? CX.div(h0, d) : null;
    };
    yield* svPoleTick(E);
    let gap = Infinity, settled = false;
    for (let i = 0; i < SV_SING_ITERS && !settled; i++) {
      // (the differences' step: a hundredth of the distance u gives, at most 1e-6 (1 + |z|) and at least 1e-14 (1 + |z|),
      // where float64 differences still resolve: steps that straddle the point, or the cut through it, would read the
      // difference across it. It is first the last step's distance; where u read with it says the point is nearer than
      // that (a Newton step lands much nearer the point, and so nearer its cut, than the step before was long), u is read
      // again with steps of a hundredth of its own distance, up to SV_SING_REREAD times, until they are)
      const s = CX.abs(z), lo = 1e-14 * (1 + s);
      let e = Math.max(lo, Math.min(1e-6 * (1 + s), gap / 100)), u0 = u(z, e);
      for (let k = 0; k < SV_SING_REREAD && u0 && CX.abs(u0) / 100 < e && e > lo; k++) { e = Math.max(lo, CX.abs(u0) / 100); u0 = u(z, e); }
      if (!u0) return null;
      if (CX.abs(u0) < 1e-12 * (1 + s)) { settled = true; break; }
      // (a step more than twice the last: Newton's method moving away from the zero, not towards it)
      if (CX.abs(u0) > 2 * gap) return null;
      gap = CX.abs(u0);
      const up = u(CX.add(z, C(e, 0)), e), um = u(CX.sub(z, C(e, 0)), e);
      if (!up || !um) return null;
      const d = CX.div(CX.sub(up, um), C(2 * e, 0));
      if (!CX.isFin(d) || CX.isZero(d)) return null;
      const step = CX.div(u0, d);
      z = CX.sub(z, step);
      if (!CX.isFin(z) || z.re < box.x0 || z.re > box.x1 || z.im < box.y0 || z.im > box.y1) return null;
      yield* svPoleTick(E);
      if (CX.abs(step) < 1e-11 * (1 + s)) settled = true;
    }
    if (!settled) return null;
    const m = (p) => { let w = null; try { w = F(p); } catch (e) { w = null; } return !w ? null : CX.isFin(w) ? CX.abs(w) : Infinity; };
    const r = SV_SING_R * (1 + CX.abs(z));
    for (let a = 0; a < 4; a++) {
      const c = Math.cos(a * Math.PI / 2 + SV_SING_TURN), sn = Math.sin(a * Math.PI / 2 + SV_SING_TURN);
      const near = m(CX.add(z, C(r * c, r * sn))), far = m(CX.add(z, C(10 * r * c, 10 * r * sn)));
      if (near == null || far == null || !(near > big) || (near < Infinity && !(near > SV_SING_GROW * far))) return null;
    }
    return z;
  }
  // the poles of F in box: the local maxima of |F| on an n x n grid over it, each refined (kept while within lim); with
  // sing, a start Newton's method does not settle on is refined to its singular point: where |F| there is past
  // SV_SING_BIG, by its nearest peak of |F|; else (and where that finds none) by svSingNewton, which finds a root's
  // point (√ of a Möbius step at its pole) from a grid whose |F| next to it is small
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
      // (svSingNewton starts SV_SING_OFF of a cell off the grid's point: a root's cut through a Möbius step's pole runs
      // along a grid line where the pole is on an axis (the dipole's), and a start on it reads differences across it)
      if (!p && sing) p = yield* svSingNewton(F, C(box.x0 + (i + SV_SING_OFF[0]) * dx, box.y0 + (j + SV_SING_OFF[1]) * dy), lim, SV_SING_BIG, E);
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
  // frame starts it at 0 (svDrawPlane), so a frame at rest, on the globe or of the classic core leaves no hold behind, and
  // the idle job (svPolesAhead) sets it to 0, and asks for a frame, once plane b's tracks are whole
  let svHoldB = 0;
  // how many things the last frame svHolds tested waits for: its inverse paths still linking, the carried meshes, the Cauchy style's
  // carried programs, and the pole tracks (one); 0 when the frame need not wait. A hold's ring is the share of it that has gone
  let svHoldLeft = 0;
  // the first glide whose tracks for the current windows are not whole, null when all are (the key's window is clipWin,
  // as svSheetKey gives it, without its singular points)
  // (the glide held by svLinkHold for its missing tracks comes first)
  function svPolesLeft() {
    const n = nSteps();
    for (const b of svHoldB ? [svHoldB] : []) if (b <= n && !derivIn(b - 1, b)) { const P = svPoleTracks(b, clipWin); if (P.k <= SV_POLE_K) return P; }
    for (let b = 1; b <= n; b++) {
      if (derivIn(b - 1, b) || svGlideEntire(b)) continue;
      const P = svPoleTracks(b, clipWin);
      if (P.k <= SV_POLE_K) return P;
    }
    return null;
  }
  // Whether the glide into plane b moves through entire maps alone, so its map h_{b,t} after the steps before b has no
  // pole at any t: step b is a polynomial step, whose homotopy has none (Inverse.polyHom: a root power, a zoom, or a
  // polynomial in u inverted by every root, NEWT with deg), and each active step before b is entire. Its frames' key then takes no pole tracks (svSheetKeyAt),
  // none are made for it (svPolesLeft), and its glide never waits for them (svTracksMissing)
  function svGlideEntire(b) {
    if (isDeriv(b) || !Inverse.polyHom(built[b - 1])) return false;
    for (let k = 1; k < b; k++) if (stepActive(k) && (isDeriv(k) || !(built[k - 1] && built[k - 1].props && built[k - 1].props.entire))) return false;
    return true;
  }
  // The pole tracks the frames of the glide into plane b are drawn from, while they are not made (null otherwise): its
  // inverse paths h have a Newton member (the poles it needs are plane b's tracks') and neither these tracks nor plane b's
  // last whole ones (svSheetKeyAt) exist. A glide through entire maps alone has none to wait for (svGlideEntire)
  function svTracksMissing(b, h) {
    if (svGlideEntire(b) || !(h && h.paths.some((p) => p.plan.ops.some((o) => o.kind === 'NEWT')))) return null;
    const P = svPoleTracks(b, svSheetKey(b).win), L = svPoleLast.get(b);
    return P.k <= SV_POLE_K && !(L && L.sig === chainSig[b]) ? P : null;
  }
  // The idle job: every glide's pole tracks for the current windows, then the outer ring's sizes of the glides beside
  // the plane and of the chain's other glides, nearest first, with their meshes, as far as the caches take them (svRingAhead, svRingNext),
  // SV_POLE_BUDGET ms an idle moment at most, so a glide finds them made. One job at a time (svPoleJob, its token: a
  // new one ends the one before); it reads its inputs (the chain, clipWin, the camera) afresh each slice, and
  // svPolesWatch starts it again once they change after it ended
  let svPoleJob = 0, svPoleBusy = false;
  function svPolesAhead() {
    const tok = ++svPoleJob;
    svPoleBusy = true;
    const ric = window.requestIdleCallback, idle = (f) => (ric ? ric.call(window, f, { timeout: 2000 }) : setTimeout(() => f(null), 100));
    const next = (dl) => {
      if (tok !== svPoleJob) return;
      const t0 = performance.now();
      // (a callback the browser ran for its timeout, not in an idle moment, has no time remaining and still runs one slice)
      const left = () => Math.min(SV_POLE_BUDGET - (performance.now() - t0), dl && !dl.didTimeout ? dl.timeRemaining() : SV_POLE_BUDGET);
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
    // a cut. A glide's frames make no tracks; the frames that hold the glide for them do, svLinkHold. A glide through
    // entire maps alone has no poles: none, svGlideEntire)
    const s = t * SV_POLE_K, i = Math.min(SV_POLE_K - 1, Math.floor(s)), f = s - i;
    let P = svGlideEntire(b) ? { tr: [] } : svPoleTracks(b, k.win), at = null;
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
    // (the period: the glide map's at t, invHomPer, which meets plane b's as t -> 1; one point of each class modulo it,
    // as at rest)
    const per = invHomPer(0, b, t);
    return Object.assign({}, k, { sing: Inverse.keyClasses(acc.concat(poles), per).slice(0, 4), per });
  }
  // (an: the chain up to plane T analytic, as the F tile and the Inspector read it, so the colour's footprint across a
  // pixel gives the one down it)
  const svCarryStyle = (T) => ({ s: 0, T, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark,
    an: Funcs.composeProps(activeSteps().filter((k) => k <= T).map((k) => built[k - 1].props)).analytic, cauchy: svCauchyCarry() });
  // the Cauchy style's residue data (plan, edges at the shared camera's scale, part shown) with the chain's length, for the carried colour on a plane past z; null for
  // any other style, with no closed curve, or when the integral is not by the residue theorem (the carried colour is then the stages' colour)
  const svCauchyCarry = () => {
    if (S.dc !== 'cauchy') return null;
    const cz = cauchyDraw(S.srcView.s);
    return GLR.cauchyUsable(cz) && cz.plan.ok ? Object.assign({}, cz, { T: nSteps() }) : null;
  };
  // The shapes list (svCarryShapes) of the carried colour and their inverse paths: each pixel is coloured by the front point
  // z of plane 0 that lands on it, in the colour dcolor(F_T(z)). At rest on plane b (u null) through the map into b (pathOf,
  // kind 'flat' or 'globe'; past a d/dz step, invDerivPath); between planes through step b's homotopy at u (invHomPath,
  // past a d/dz over the chain that stands in for it), or, span {a, stepT} given (an All-at-once glide from plane a to
  // b, map mode 3), through each of its steps' homotopies at its own time (invSpanPath; a span past a d/dz step keeps
  // the carried mesh). {list, paths}, or null with why.r the first reason unless every shape takes that path; with
  // why.rest an array (at rest, shapes listed one by one), the shapes that do not are put in it and left out of the
  // lists
  function svInvPaths(b, u, kind, why, span) {
    const hom = u != null, list = svCarryShapes(hom);
    if (!list || !list.length) { why.r = list ? SV_NO_AREA : hom ? 'a region of a plane behind a d/dz step' : 'a region of a later plane'; return null; }
    if (!GLR.drawInverse || !GLR.packShapes) { why.r = 'no inverse renderer'; return null; }
    // (a glide past a d/dz is planned over the chain that stands in for it, the steps before the d/dz off (invHomBase), so
    // a region of plane k > 0, tested where F_{0->k}(z) lies in it, would be tested against z: such a frame keeps the
    // carried mesh)
    if (hom && derivIn(0, b - 1) && list.some((x) => x !== SV_ALL && shapeStage(x))) { why.r = 'a region of a plane before a d/dz step'; return null; }
    // (invSpanPath plans the span on the chain itself, not on the one that stands in past a d/dz (invHomBase))
    if (span && derivIn(0, b)) { why.r = 'an All-at-once glide past a d/dz step'; return null; }
    const recs = packRecs(list.includes(SV_ALL) ? [SV_ALL] : [], hom);
    // (an All-at-once glide keys its sheets by its last plane, as its carried meshes do: svCarryRegions)
    const singAt = span ? () => svSheetKey(b).sing : () => svSheetKeyAt(b, u).sing;
    // (a region of a later plane takes the whole plane's path: its test is in the pass, on its own plane at rest, not in
    // the path's preparation)
    let whole = null;
    // (a plane at rest whose step has no exact inverse is drawn as the glide's last frame is: the homotopy's inverse at t = 1)
    const restHom = () => svSheetKey(b).sing;
    const via = (x, t, sing) => (span ? invSpanPath(x, 0, span.a, b, t, span.stepT, sing) : invHomPath(x, 0, b, t, sing));
    const viaHom = (x, t, sing) => (shapeStage(x) ? whole || (whole = via(SV_ALL, t, sing)) : via(x, t, sing));
    const paths = list.map((x) => {
      if (hom) return viaHom(x, u, singAt);
      if (derivIn(0, b)) return invDerivPath(x, b);
      const p = pathOf(x, stageMap(b), 'L', kind, { recs, budget: false });
      // (only a step with no exact inverse falls back; a path still compiling or forced forward stays as it is)
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
  // pulled-back shape); glide is {a, b, u} for a frame between planes a and b at u (a step's glide: a = b - 1; an
  // All-at-once span's: its first plane). With the sheets off a glide frame of the whole plane goes from plane a's look to
  // plane b's, linear in u: a plane at or before the colour plane T looks as T does (the front member alone, opacity 1),
  // a plane past T has the slider's opacity. A frame at rest, All sheets and a shape's own layers take the slider's.
  const svCarryAlpha = (base, shape, glide, T) => {
    if (base < 1) return { alpha: base, alphaOwn: base };
    const slider = svOpacity();
    if (shape !== SV_ALL || S.sheets || !glide) return { alpha: slider, alphaOwn: slider };
    const look = (k) => (k <= T ? 1 : slider), la = look(glide.a), lb = look(glide.b);
    return { alpha: la + (lb - la) * glide.u, alphaOwn: la === 1 && lb === 1 ? 1 : slider };
  };
  const svCarryLook = (base, shape, glide, T) => Object.assign(svCarryAlpha(base, shape, glide, T), { lastOpaque: base >= 1, pattern: 'carry', cell: 1, lines: false });
  // drawInverse's arguments (without the view) for one shape's inverse path p. alphaOf(shape): the opacity of its fill; edgeOf(shape): {width, alpha, ...} draws its boundary alone (GLR.drawInverse's edge);
  // a shape of a later plane drawn as a fill is grown by half the band's width plus half a pixel, so the colour reaches as far
  // as the band's outer edge
  const svInvArg = (pane, p, shape, carry, alphaOf, edgeOf, glide) => {
    return { map: p.m, plan: p.plan, prep: p.prep, inv: p.inv, shape, dpr: pane.dpr, look: svCarryLook(alphaOf ? alphaOf(shape) : 1, shape, glide, carry.T),
      carry, edge: edgeOf ? edgeOf(shape) : null, grow: shapeStage(shape) && !edgeOf ? 0.5 * pullBandW(shape, pane.dpr) + 0.5 : 0, half: false, motion: false, coldOk: true, whole: offRender };
  };
  // At rest on plane a that is not coloured (past the colour plane T, or before it with a d/dz step between): exactly,
  // by the tiling's inverse pass (GLR.drawInverse, its carried colour variant): at each pixel w of plane a, the shapes'
  // points z with F_a(z) = w, the front one's colour, so the colour is the points' own wherever they reach, with no grid,
  // no window and no stray sheet. Into the open GL frame (opened if need be). False (nothing more drawn) unless every
  // shape takes that path: a region of a later plane, a map with no inverse, a program still compiling
  function svCarryExact(pane, a, T, frame) {
    const h = !svColoured(a) ? svInvPaths(a, null, 'flat', { r: null }) : null;
    // (a path of the homotopy's inverse at t = 1, which has a NEWT op: its roots pass runs at t = 1)
    const nt = !!h && h.paths.some((p) => p.plan.ops.some((o) => o.kind === 'NEWT'));
    return !!h && (nt ? svDrawInverse(pane, h.list, h.paths, T, frame, 1, null, null, a) : svDrawInverse(pane, h.list, h.paths, T, frame)) === 'drawn';
  }
  // the carried colour of the shapes list by their inverse paths (all 'inverse'; a path's inv: its own inverse program),
  // into the GL frame gl ({ open }, opened if need be): 'drawn', else the first draw's GLR.drawInverse answer that was
  // not ('error' when it threw). A shape drawn already stays: the next path draws over it
  // t (a glide's frame): the homotopy's t, for the NEWT roots pass (GLR.newtRoots: when the plan's first inverted op is a
  // NEWT op, its members for every pixel, drawn once for all the shapes and seeded from the previous frame's)
  // (alphaOf, edgeOf: svInvArg's; b, a: the frame's planes, a = b - 1 unless given: svCarryAlpha's glide; gl.sat: each
  // draw blended front to back, drawInverse's saturate, its cut edges grown by gl.grow px, drawInverse's cutGrow)
  function svDrawInverse(pane, list, paths, T, gl, t, alphaOf, edgeOf, b, a = b - 1) {
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
        res = GLR.drawInverse(Object.assign({ viewKind: 'flat', view: pane.view }, svInvArg(pane, paths[i], list[i], carry, alphaOf, edgeOf, t != null ? { a, b, u: t } : null), { nr, saturate: !!gl.sat, cutGrow: gl.sat ? gl.grow || 0 : 0 }));
      } catch (e) {
        // (a throw answers 'error': the caller draws the frame by the carried mesh, and the glide's record names why)
        console.error('steps view carried colour', e);
      }
      if (res !== 'drawn') return res;
    }
    return 'drawn';
  }
  // A frame between planes a and b as svCarryExact draws a plane: per pixel, by the inverse pass, the front point z of
  // plane 0 with H_u(F_{b-1}(z)) = w (invHomPath: step b's homotopy at u inverted by its own ops), or, for an All-at-once
  // span (span: svSpanPaths'), with each step of the span at its own time (invSpanPath), in the colour dcolor(F_T(z)). So
  // the glide shows the exact picture of the map at u, which meets each plane's own at u = 0 and 1. Into the open GL
  // frame. False (nothing drawn) unless every shape takes that path; why: the first reason not
  function svCarryExactHom(pane, b, u, T, frame, why, span) {
    const m = svHomPaths(b, u, span), h = m.h;
    if (!h) { why.r = m.why.r; return false; }
    const res = svDrawInverse(pane, h.list, h.paths, T, frame, u, null, null, b, span ? span.a : b - 1);
    if (res !== 'drawn') { why.r = 'inverse pass ' + res; return false; }
    return true;
  }
  // Whether a glide frame between planes (plane b, at u) is drawn by the inverse pass with every program linked: its colour
  // layer then holds exactly the pixels whose front point of the regions lands there (svInvPaths: the pass tests each
  // region), so no mask from the regions' images is drawn under Inside regions (that mask's meshes, SphereMesh aside,
  // lack parts of an unbounded region's image). The pullbacks of regions of later planes keep their own opacity and band,
  // which only the mask's pass (svStagedMask) draws, so such a frame keeps a mask made of the inverse pass alone
  function svExactGlide(b, u, span) {
    if (!GLR.inverseState) return false;
    const h = svHomPaths(b, u, span).h;
    return !!h && h.paths.every((p, i) => svInvState(h, i, b, u, span ? span.a : b - 1) === 'ready');
  }
  // (the paths of the glide's frame at (b, u), svInvPaths, kept in svHomMemo { b, u, sk, h, why } for the frame's other
  // readers; sk: the span's key, '' for a step's frame)
  let svHomMemo = null;
  // (span: an All-at-once glide's {a, stepT}, svSpanPaths; its frames' paths are kept apart from a step's at the same b and u)
  function svHomPaths(b, u, span) {
    const sk = span ? `${span.a}|${svStepTKey(span.stepT)}` : '';
    if (!(svHomMemo && svHomMemo.b === b && svHomMemo.u === u && svHomMemo.sk === sk)) { const why = { r: null }; svHomMemo = { b, u, sk, h: svInvPaths(b, u, 'flat', why, span), why }; }
    return svHomMemo;
  }
  // the span of an All-at-once frame g (svBetween's) for the inverse paths: {a: its first plane, stepT}, or null
  const svSpanPaths = (g) => (g.all ? { a: g.a, stepT: g.stepT } : null);
  // the inverse program's state ('ready', 'pending', 'error') of path i of the paths h (svInvPaths, or svStagedOf's) of
  // the glide frame between planes a and b at u (a = b - 1 unless given), as the carried colour draws it there
  // (svCarryExactHom): with that frame's look, whose opacity picks the program's B class (svCarryAlpha: sheets off before
  // the colour plane, opacity 1)
  const svInvState = (h, i, b, u, a = b - 1) => GLR.inverseState(svInvStateArg(h, i, b, u, a));
  // (the state GLR.inverseState and GLR.inverseWarmup take for it)
  const svInvStateArg = (h, i, b, u, a = b - 1) => {
    const p = h.paths[i];
    return { map: p.m, plan: p.plan, prep: p.prep, inv: p.inv, viewKind: 'flat', look: svCarryLook(1, h.list[i], { a, b, u }, svT()), carry: true, staged: shapeStage(h.list[i]) > 0 };
  };
  // A glide frame between planes whose step the inverse pass draws, while that pass's programs still link (the colour's,
  // and the staged one of the later planes' shapes, svStagedOf and svStagedCurves, which draws their mask and strokes),
  // and once it is linked, while the pole tracks the glide's frames are drawn from are not made (svTracksMissing); or
  // whose step the carried meshes draw (no inverse plan, or All at once), while their programs link (svMeshLinking): a
  // glide or a play waits where it is, at the place of its last frame drawn (its start when it has drawn none) with its
  // clock still, judged at the place it was held for (A.held) until that place can be drawn, and then goes on from there
  // in the time it had left; a scrub's frame is that of the plane before the thread. So no frame between the planes is
  // the carried mesh's, one drawn without its tracks or the planes' plots in place of the meshes, and the first one drawn
  // is the glide's own. After it svHoldB is plane b when the glide waits for the tracks, else 0. Each frame of such a
  // wait makes the tracks for a frame's pole budget, so the wait ends within a bounded number of frames: a held play or
  // glide asks for frame after frame, and where each takes past its deadline (a software renderer) no idle moment comes
  // between them. Such a wait also starts the idle job (svPolesWatch), which makes plane b's tracks first (svPolesLeft).
  // holds: whether a frame must wait (svHolds on the plane, svGlobeHolds on the globe)
  // -> the place to draw instead of the thread's, or null (draw the thread's)
  function svLinkHold(holds = svHolds) {
    svHomMemo = null;
    const A = svMotion();
    const g = svBetween(A && A.held ? A.held.x : SV.g.x);
    if (!holds(g)) {
      // (released: the frame is the one the motion waited on, and its clock goes on from there)
      if (A && A.held) { SV.g.set(A.held.at); svSetElapsed(A, A.held.el); }
      svMotionDrawn(A);
      return null;
    }
    if (!A) return g.x0;
    const first = !A.held;
    if (first) A.held = { x: SV.g.x, at: A.drawn ? A.drawn.at : A.from, el: A.drawn ? A.drawn.el : 0 };
    svSetElapsed(A, A.held.el); SV.g.set(A.held.at); requestRender('L');
    // (the thread, and a play's head and live region, stand at the held place for the whole wait: the live region has not been
    // written for the crossing of the frame that starts the hold, A.label, which is dropped here and made by the crossing again once
    // the hold ends)
    if (first && SV.play === A) svHoldWaitBegin(A);
    if (first) {
      const r = Math.round(A.held.at);
      if (SV.play === A && r !== SV.i) { SV.i = r; A.label = null; }
      svSync();
    }
    return A.held.at;
  }
  // the motion whose clock moves the thread: a glide, or a play a glide at a time; null
  const svMotion = () => SV.anim || (SV.play && !SV.play.slide ? SV.play : null);
  // a motion's time since its start (ms), as svFrame and svPlayFrame read it (the test clock's, or the wall clock's), and
  // that time set
  const svElapsed = (A) => (SV.clock ? A.el || 0 : performance.now() - A.t0);
  function svSetElapsed(A, ms) { A.el = ms; A.t0 = performance.now() - ms; }
  // a frame of the motion A drawn at the thread's place, on any surface: its last frame drawn, and no hold
  function svMotionDrawn(A) {
    if (A) {
      A.held = null; A.drawn = { at: SV.g.x, el: svElapsed(A) };
      // (the crossing's words, once its frame is drawn: svPlayFrame)
      if (A.label != null && SV.els && SV.els.live && SV.play === A) SV.els.live.textContent = SV.loop ? svAheadTail(A.label) : A.label;
      A.label = null;
    }
    svHoldWaitEnd(true);
  }
  // whether the glide frame g (svBetween: a step's glide, or an All-at-once span's) on the plane must wait: the inverse
  // pass draws it and that pass's programs still link, or, once linked, the pole tracks a step's frames are drawn from
  // are not made (svHoldB is then plane b, else 0); or the carried meshes draw it and their programs link
  function svHolds(g) {
    svHoldB = 0; svHoldLeft = 0;
    if (g.u <= SV_REST_U || g.b === g.a || isDeriv(g.b)) return false;
    const inv = (g.map.mode === 1 || g.map.mode === 3) && !!GLR.inverseState;
    // (an All-at-once frame: its span's paths and its later planes' shapes', no pole tracks of its own)
    const span = inv ? svSpanPaths(g) : null, h = inv ? svHomPaths(g.b, g.u, span).h : null;
    // (the Cauchy style's carried programs too, its own variants: while they link, nothing past z draws its colour)
    const waits = (h ? [h, svStagedOf(false, g), svStagedCurves(g)].reduce((n, q) => n + (q ? q.paths.filter((p, i) => svInvState(q, i, g.b, g.u, span ? span.a : g.b - 1) === 'pending').length : 0), 0) : (svMeshLinking(g.map, null) ? 1 : 0))
      + (S.dc === 'cauchy' && !!GLR.carryCauchyLinking && GLR.carryCauchyLinking() && !!svCauchyCarry() ? 1 : 0);
    const linking = waits > 0;
    const P = inv && !linking && !span ? svTracksMissing(g.b, h) : null;
    svHoldLeft = waits + (P ? 1 : 0);
    if (P) {
      svPoleMake(P, SV.poleFrameMs || SV_POLE_BUDGET, 'frame');
      // (made whole by this slice: the frame draws the glide, its paths prepared again from the tracks)
      if (P.k > SV_POLE_K) svHomMemo = null;
    }
    svHoldB = P && P.k <= SV_POLE_K ? g.b : 0;
    if (svHoldB) svPolesWatch();
    return linking || !!svHoldB;
  }
  // whether the carried meshes a glide's frame of map draws with are still linking (GLR.carryState; globe: {id}, the
  // carried globe's): a frame of the glide would draw something else in their place
  function svMeshLinking(map, globe) {
    if (!GLR.carryState) return false;
    if (!globe && !(svCarryShapes() || []).length) return false;
    return GLR.carryState(map, globe) === 'pending';
  }
  // the last frame between two planes: {b, u, all (an All-at-once frame: b the span's last plane, u its progress), path:
  // 'inverse' | 'mesh', reason (why not inverse), key(z): the inverse pass's sheet key of a point of plane 0, per: that
  // key's period ([re, im] or null), ops: the kinds of the ops the inverse pass inverted (InvOps' AFF, SIN, NEWT, ...), in
  // the chain's order, or null, H: the map of that frame (H_u o F_{b-1}), Hb: the glide's homotopy alone (H_u on the
  // glide's first plane), view, w, h (the pane's css size)}
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
  // (the sizes kept: SV_RING_Q + 1 a glide; the idle job makes those of every glide while the table is under half its
  // limit, so 400 holds those of a few views or windows; each is a number, and a full table is dropped whole)
  const SV_RING_SIZES_MAX = 400, SV_RING_Q = 20;
  const svRingSizes = new Map();
  let svRingMemo = null, svRingJob = null;
  // the key of m at the twentieth q of the glide g (svBetween's) for the view v of a pw x ph pane
  const svRingKey = (g, q, v, pw, ph) => { const w = clipWin; return [g.a, g.b, g.all ? 1 : 0, svStepTKey(g.stepT), q, w.x0, w.x1, w.y0, w.y1, v.cx, v.cy, v.s, pw, ph, chainSig[nSteps()]].join('|'); };
  // m at the twentieth q of the glide g (null: no ring): a generator that pauses every 8 points
  function* svRingSize(g, q, v, pw, ph) {
    const gq = svBetween(g.x0 + q / 20 * (g.x1 - g.x0), g.all ? { x0: g.x0, x1: g.x1, stepT: g.stepT } : null), w = clipWin;
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
  // (a full table drops the sizes no glide of the chain draws at the view the frames between planes draw in: other
  // chains', windows' and views'; whole when the chain's own fill it)
  function svRingSet(key, m) {
    if (svRingSizes.size >= SV_RING_SIZES_MAX) {
      const keep = new Set();
      for (const { j } of svGlidesNear()) for (const k of svGlideRingKeys(j)) keep.add(k.key);
      for (const k of svRingSizes.keys()) if (!keep.has(k)) svRingSizes.delete(k);
      if (svRingSizes.size >= SV_RING_SIZES_MAX) svRingSizes.clear();
    }
    svRingSizes.set(key, m);
  }
  function svRingFor(pane, map) {
    const g = svBetween(), v = pane.view, q = Math.round(g.u * SV_RING_Q), sk = svRingKey(g, q, v, pane.w, pane.h), key = sk + '|' + (map.mode || 0);
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
  // Kept by id in svPolarRes, at most SV_POLAR_KEEP (the bound on the steps view's polar meshes in GPU memory), the one
  // farthest from the thread dropped first (svPolarFarthest): {meshRes, NR rings, NT cells a ring, dl the log of a
  // ring's ratio}; svPolarBuilds counts the builds
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
    const need = svPolarRes.size >= SV_POLAR_KEEP ? svPolarNeed() : null;
    while (svPolarRes.size >= SV_POLAR_KEEP) {
      const { id } = svPolarFarthest(need);
      GLR.destroy(svPolarRes.get(id).meshRes);
      svPolarRes.delete(id);
    }
    svPolarRes.set(ring.id, r);
    return r;
  }
  // the ring id of a polar size m (svRingShape's), kept on m: a size is made for one clipWin, which its key holds
  const svPolarId = (m) => m.id || (m.id = svRingShape(m).id);
  // the glides of the chain, nearest the thread first: {j, d}, d the distance in planes from the thread's place to the
  // glide's middle, j + 1/2
  function svGlidesNear() {
    const x = SV.g.x, out = [];
    for (let j = 0; j + 1 < svPlanes().length; j++) out.push({ j, d: Math.abs(j + 0.5 - x) });
    return out.sort((p, q) => p.d - q.d);
  }
  // the ring keys of the glide j at the view the frames between planes draw in (svRenderMoving's S.srcView)
  const svGlideRingKeys = (j) => svRingKeys(svBetween(j + 0.5, null), S.srcView);
  // the polar meshes the chain's made ring sizes draw with: ring id -> the distance of the nearest glide that draws it
  function svPolarNeed() {
    const need = new Map();
    for (const { j, d } of svGlidesNear()) {
      for (const { key } of svGlideRingKeys(j)) {
        const m = svRingSizes.get(key);
        if (m && m.polar && !need.has(svPolarId(m))) need.set(svPolarId(m), d);
      }
    }
    return need;
  }
  // the kept polar mesh farthest from the thread by need (svPolarNeed's): {id, d}, d Infinity for one no glide of the
  // chain draws (another chain's, window's or view's); of those as far, the one used longest ago
  function svPolarFarthest(need) {
    let far = { id: null, d: -1 };
    for (const id of svPolarRes.keys()) {
      const d = need.has(id) ? need.get(id) : Infinity;
      if (d > far.d) far = { id, d };
    }
    return far;
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
  // the first twentieth of the chain's glides whose m is not made, or is a polar size whose mesh is not built,
  // Everywhere, for the left pane, which the steps view draws in: {g, q, key, v, w, h, m} (m: the size when made), or
  // null (from the first moment, so a page's first glide finds them made). The glides nearest the thread first, so the
  // two into and out of the plane it is at come first, then every other glide of the chain (a scrub crosses them all,
  // and a frame that finds a polar size's mesh not built builds it), as far as the caches take them: the glides whose
  // sizes fit in svRingSizes, and a polar mesh only while svPolarRes has room or keeps one farther from the thread than
  // its glide (which it then drops), so that no mesh made for a far glide drops one of a nearer glide
  function svRingNext() {
    if (!SV.on || !paneL) return null;
    const L = svCarryShapes();
    if (!L || !L.includes(SV_ALL)) return null;
    const v = S.srcView;
    let keys = 0;
    for (const { j, d } of svGlidesNear()) {
      keys += SV_RING_Q + 1;
      if (keys > SV_RING_SIZES_MAX) return null;
      const g = svBetween(j + 0.5, null);
      for (const { q, key } of svRingKeys(g, v)) {
        const m = svRingSizes.get(key);
        if (m !== undefined && !(m && m.polar && !svPolarRes.has(svPolarId(m)))) continue;
        if (m !== undefined && svPolarRes.size >= SV_POLAR_KEEP && !(svPolarFarthest(svPolarNeed()).d > d)) return null;
        return { g, q, key, v: { cx: v.cx, cy: v.cy, s: v.s }, w: paneL.w, h: paneL.h, m };
      }
    }
    return null;
  }
  // the keys of a glide g's ring sizes at view v in the left pane, a twentieth (q) each
  function* svRingKeys(g, v) { for (let q = 0; q <= SV_RING_Q; q++) yield { q, key: svRingKey(g, q, v, paneL.w, paneL.h) }; }
  const svRingLeft = () => !!svRingJob || !!svRingNext();
  // the idle job's share of the ring: an m made for at most ms, its mesh built (svRingWarm) in the slice that publishes
  // it, so no frame finds a size whose mesh is not built; that slice can run past ms by the build's time. false when
  // none is left to make
  function svRingAhead(ms) {
    const t0 = performance.now();
    if (!svRingJob) {
      const n = svRingNext();
      if (!n) return false;
      // (a size made whose polar mesh is not built: the job only builds it)
      svRingJob = { key: n.key, gen: n.m !== undefined ? { next: () => ({ done: true, value: n.m }) } : svRingSize(n.g, n.q, n.v, n.w, n.h) };
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
  // While gliding (map: the glide's, h_{b,u} after the steps before b, or all at once; b: the plane it goes to), or at
  // rest while the exact pass compiles: each shape's tessellated mesh, the one the tiling's patterns travel on, moved by
  // map, each fragment its point's colour (GLR.drawRegion with carry), the sheet key as its depth. Into the open GL frame
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
  // (the sheet key: a step at a time, the glide's at t (svSheetKeyAt, plane b's key with the glide's poles at t); all at
  // once, the key of the span's top plane, map.b, with that plane's poles, so the front sheet is the one the inverse pass
  // shows where the span ends, at plane b: an upward glide lands on that sheet, while a downward one, which ends at the
  // span's first plane, keeps plane b's key to the end (the first plane's key lacks the later planes' poles, so where the
  // map folds it would put the wrong sheet in front on the way); at rest, plane b's)
  // Whether a frame's sheets can tie under the sheet key k: the largest order n (up to SV_TIE_N) of a rotation about the key's
  // centre c by 2 pi / n that its points of plane 0 go first through a map unchanged by, as z^n's about 0 (f(c + e^(2 pi i
  // / n) (z - c)) = f(z) at SV_TIE_PTS points of the key's window), or 0 for none. Such a rotation keeps a point's distance
  // to c, so the sheets it carries into each other have equal keys over the whole plane, and only their tie order may
  // decide between them: the carried meshes then resolve the ties per pixel (GLR.carryResolve: the sheets in the rotation's
  // orbit of a pixel's front one whose keys are within a band of its key, KEY_ERR_K times the key's error across each
  // triangle and at least SV_TIE_BAND, ordered by the tie order), which costs every mesh a second draw, so a frame whose
  // sheets cannot tie draws them once.
  // The map tested: at rest plane b's own; a step's glide the steps before b, which the glide's map runs first; All at
  // once, the steps up to the span's first plane (a rotation the later ones keep, as a step's glide's own, is not seen).
  // Not covered: a rotation of order past SV_TIE_N (z^12 about 0 keeps the key's own order); equal keys that no rotation
  // makes, which lie on curves alone (z + 1/z: z and 1/z on |z| = 1); and a map a rotation keeps only nearly, off by more
  // than SV_TIE_REL (z³ with the key's centre a little off 0, z³ + εz): its frames draw without the resolve, so where its
  // sheets' keys differ by less than the mesh's error they stay as rough as before (#2190). A map the check passes
  // without its being exactly symmetric is harmless: the resolve reorders only fragments within the mesh's error
  const SV_TIE_N = 8, SV_TIE_PTS = 7, SV_TIE_REL = 1e-9, SV_TIE_BAND = 1, SV_TIE_MEMO = 32;
  const svTieMemo = new Map();
  // (the band's floor, SV_TIE_BAND unless a test hook set another: __cmwSteps({ tieBand }))
  let svTieBandSet = null;
  // the pre-mapped meshes among the draws of the frame on the screen (the tests read it: __cmwSteps().carryPre): 0 from the
  // start of each screen frame (svDrawPlane), set by its carried colour's layout, and a frame drawn ahead brings its own
  // (svAheadShow); a frame drawn off-screen (SV.offscreen: the frames drawn ahead and their probe) sets svCarryPreOff instead
  let svCarryPre = 0, svCarryPreOff = 0;
  const svTieBand = () => (svTieBandSet == null ? SV_TIE_BAND : svTieBandSet);
  function svTies(map, b, k) {
    const s = map.mode === 1 ? b - 1 : map.mode === 3 ? map.a : b;
    if (!(s > 0) || !k || !k.win) return 0;
    const w = k.win, c = C((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2), r = Math.hypot(w.x1 - w.x0, w.y1 - w.y0) / 4;
    const key = [s, chainSig[s], c.re, c.im, r].join('|');
    if (svTieMemo.has(key)) return svTieMemo.get(key);
    const f = stageF(s), zs = [], fs = [];
    // (the points spread in angle by the golden angle, 2.399963 rad, and in radius over 0.2 .. 1 of r, none on an axis)
    for (let i = 0; i < SV_TIE_PTS; i++) {
      const q = 0.2 + 0.8 * (i + 0.37) / SV_TIE_PTS, a = 2.399963 * i + 0.3;
      const z = CX.add(c, C(r * q * Math.cos(a), r * q * Math.sin(a))), v = f(z);
      if (v && CX.isFin(v)) { zs.push(z); fs.push(v); }
    }
    let tie = 0;
    for (let n = SV_TIE_N; n >= 2 && !tie && zs.length >= 3; n--) {
      const e = C(Math.cos(2 * Math.PI / n), Math.sin(2 * Math.PI / n));
      if (zs.every((z, i) => {
        const v = f(CX.add(c, CX.mul(e, CX.sub(z, c))));
        return !!v && CX.isFin(v) && CX.abs(CX.sub(v, fs[i])) <= SV_TIE_REL * (1 + CX.abs(fs[i]));
      })) tie = n;
    }
    if (svTieMemo.size >= SV_TIE_MEMO) svTieMemo.clear();
    svTieMemo.set(key, tie);
    return tie;
  }
  function svCarryRegions(pane, map, T, b, frame, F) {
    const list = svCarryShapes();
    if (!list || !list.length || !GLR.drawRegion) return false;
    const key = map.mode === 1 ? svSheetKeyAt(b, map.t) : map.mode === 3 ? svSheetKey(map.b) : svSheetKey(b);
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
    if (SV.offscreen) svCarryPreOff = lay.filter((d) => d.pre).length; else svCarryPre = lay.filter((d) => d.pre).length;
    const sts = lay.map((d, i) => {
      const depth = n === 1 ? 'only' : i === 0 ? 'first' : i === n - 1 && !tail ? 'last' : 'mid';
      // (preZ: under graph paper the SphereMesh keeps the source point itself as vP, not its polar coordinates)
      return { map, view: pane.view, dpr: pane.dpr, L: d.L, skip: d.skip, scissors: d.scissors, scissor: d.scissor, alpha: 1, pattern: 'carry', cell: 1, lines: false, carry, key, depth, lim: 0.35 * Math.max(pane.w, pane.h) / pane.view.s, preZ: d.pre && GLR.PATTERNS[S.pattern] === GLR.PATTERNS.grid, prep: null, peel: false, behind: d.behind || 0 };
    });
    // (every mesh's off-screen passes first, then the draws: the frame's framebuffer is left once, not once a mesh. Below full
    // opacity every covering layer shows, as the exact pass composites them: the meshes are drawn once per layer
    // (GLR.carryLayers) with the programs that write each fragment's sheet key (st.peel); while those link, or if the
    // layers cannot be drawn, the front layer alone is drawn)
    // (while the carried colour's programs link: a still frame of plane z's colour (T = 0) whose shapes are all drawn from
    // their SphereMeshes (the tiling's stand-in while a chain's first program links, smNeed's 'linking') shows those
    // meshes in the phase of their source points, which is that colour, with programs that carry no chain)
    const standIn = () => T === 0 && n > 0 && lay.every((d) => d.pre)
      && lay.every((d, i) => GLR.drawPreMapped(d.res, Object.assign({}, sts[i], { carry: null, pattern: 'phase', sphN: 16 })));
    const a = svOpacity();
    let layers = a < 0.999 && !!GLR.carryLayers;
    // (a frame whose sheets can tie draws its meshes through the resolve of ties, with the layers' programs: at full
    // opacity the front layer, below it every layer in the order it resolves)
    let ties = GLR.carryResolve ? svTies(map, b, key) : 0;
    for (let pass = 0; pass < 2; pass++) {
      let ready = true;
      for (let i = 0; i < n; i++) {
        sts[i].peel = layers || !!ties; sts[i].prep = null;
        if (!lay[i].pre && (sts[i].prep = GLR.carryPrep(lay[i].res, sts[i])) === false) { ready = false; break; }
      }
      if (ready) break;
      if (!layers && !ties) return standIn();
      layers = false; ties = 0;
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
    const layered = layers ? GLR.carryLayers(a, drawAll, ties ? svTieBand() : null, ties || 0) : ties ? GLR.carryResolve(svTieBand(), drawAll, ties) : null;
    return (layered === null ? drawAll() : layered) || standIn();
  }
  // A frame of the plane between two planes (or at rest on a plane past the colour plane, where it is u = 0): the
  // colour carried by the points along h_{b,u} (the inverse pass, svCarryExactHom, or the carried meshes, svCarryRegions);
  // Inside regions masks it with the moving regions; the regions are outlined over it. The view stays.
  // the labels are placed in full once the picture has been still for SV_LABEL_STILL ms, held or released (on the
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
    svHoldB = 0; svRedrawDue = false; SV.restHeld = -1;
    if (!SV.offscreen) svCarryPre = 0;
    if (svAhead && svAhead.state === 'fill') svAhead.live++;
    cutMarksL = [];
    if (svMoving()) {
      if (svParked()) svCheck();
      if (svMoving()) {
        probeMoving();
        if (svJump(pane, still)) { svHeldOn = null; svMotionDrawn(svMotion()); return; }
        // (a glide waiting for its programs (svLinkHold): held on plane z, that plane's frame as it is at rest (svRestAt:
        // its plot, plane z's own colours whatever chain's programs draw it, which the carry core's frame at u = 0
        // cannot draw while the chain links). Any other plane's frame at rest would stand in another chain's picture
        // while this one links: a scrub held is drawn at the thread's place and a glide's or a play's frame where it
        // waits, by the carry core, which draws nothing of another chain)
        // (asks: the frames asked for before the hold's own ask, svRenderMoving's held-frame test)
        const asks = renderAsks, land = SV.surf === 'land', hold = land ? null : svLinkHold(SV.surf === 'sphere' && lGlobe() ? svGlobeHolds : svHolds);
        const at = hold == null ? -1 : Math.round(hold), onPlane = at >= 0 && Math.abs(hold - at) <= SV_REST_U;
        // (plane z's own plot waiting on its program with no stand-in yet, so that its frame at rest would be blank: the
        // carry core's frame at the held place instead, whose late-link stand-in draws plane z's colour; the frame at rest
        // is tried again once nothing links, svRestFell)
        if (onPlane && svPlanes()[at] === 0) {
          SV.restHeld = at;
          const key = ['rest', at, S.srcView.cx, S.srcView.cy, S.srcView.s, pane.w, pane.h, pane.dpr, chainSig[nSteps()]].join('|');
          if (svRestFell !== key || !GLR.pendingLinks) {
            SV.core = 'still';
            if (svHeldKept(key, asks)) return;
            const n0 = colourAsks;
            svRestAt(at, pane, still);
            if (colourAsks === n0 || !colourBlank) { svRestFell = null; svHeldOn.mf = mfDrawn; svHeldOn.cm = cutMarksL; svHeldOn.pre = svCarryPre; return; }
            svRestFell = key;
          }
          SV.core = 'carry';
          svRenderMoving(pane, hold, asks);
          return;
        }
        SV.core = 'carry';
        if (svLandMoving(pane)) { svHeldOn = null; svMotionDrawn(svMotion()); } else svRenderMoving(pane, onPlane && !SV.anim && !SV.play ? null : hold, asks);
        return;
      }
    }
    svCheck(); svPolesWatch();
    // (a press waits behind the gate on plane z, the colour plane: the plane is drawn as the first frame of the glide it waits to start)
    if (svGateDraws() || (svPaint() === 'push' && svFlatSurf() && lFlat())) { SV.core = 'carry'; svRenderMoving(pane); return; }
    svHeldOn = null;
    SV.core = 'still'; still(pane);
  }
  // Sheets over a glide: a glide frame onto a plane b coloured by its own variable (at or before the colour plane) is
  // the copies of plane z, one per sheet combo of the multivalued steps up to b, each placed by the glide's map
  // continued on its combo and coloured on it (the steps after b on their principal sheets, as plane b's own colour),
  // so it covers plane b as plane b does at rest, every sheet's image and not the principal one's alone. (A plane past
  // the colour plane carries the principal sheet's points at rest, and so does a glide onto it; under Inside regions
  // plane b shows the principal sheet's image of the regions, and so does a glide onto it.)
  // A combo is the chain with each multivalued step's sheet (its k, which the GPU reads as data, so the programs are the
  // same) moved by an offset: 0 to n − 1 for a root's n sheets, −W to W for an infinitely sheeted step (S.sheetW, the
  // window All sheets draws). The combo of offsets 0 is the chain as it is; the others, at most SV_GLIDE_SHEETS_MAX − 1,
  // are svGlideSheets(a, b, from)'s for the glide from plane a to plane b, nearest the principal sheet first (the sum
  // of the offsets' distances from 0, a root's around its circle of sheets), made once per chain and glide. A combo
  // whose maps to every plane from a to b are an earlier combo's is left out, as the Landscape's sheets are (sheetUniq:
  // the same values at SHEET_PTS): a later step can undo a sheet (exp after log, z² after √), and a glide frame is
  // placed by the map to plane a and coloured by the map to plane b, so a combo the glide's planes cannot tell apart is
  // drawn once and the cap counts distinct ones. A chain with more distinct combos leaves the farthest ones out.
  // from moves the steps in (from, b] alone: a Landscape glide carries the points of plane from, which no step before
  // it moves (0, every step up to b, on the Plane). SV.glideSheets 1 (a test hook's) draws the chain as it is alone, on
  // the Plane and on the Landscape.
  // SV_SHEET_STEPS: the steps whose sheet is a parameter, k, that the GPU reads as data, so a copy is the same programs
  // with k moved. A custom formula's branch points have no such parameter (its sheets are only the All-sheets combo's
  // digits), so a copy of it would be a chain of its own to compile: its principal sheet alone is carried.
  // The window of an infinitely sheeted step: S.sheetW within its bounds (sheetWOf), as the Landscape's "sheets ±"
  // choice and the GPU's sheet plan draw it
  const SV_GLIDE_SHEETS_MAX = 8, SV_SHEET_STEPS = ['root', 'powa', 'log'];
  // a step's cut in degrees: its own, else the default every multivalued step starts with (SV_CUT, the negative real
  // axis); SV_HALF_TURN: a seam's cut turned from it (svGlideSeams)
  const SV_CUT = 180, SV_HALF_TURN = 180;
  const svCut = (st) => (st.params.cut == null ? SV_CUT : +st.params.cut);
  // svGlideSheets' last answer, made again when its key (the chain's signature, planes a, b and from, the window W)
  // changes: key, list (the copies), W, seamList (the seams, svGlideSeams, made when first asked for), and own, the
  // chain as it is on the GPU, which svOnSheets sets back after each copy's draw
  let svSheetMemo = { key: '', list: [] };
  function svGlideSheets(a, b, from = 0) {
    const W = sheetWOf(S.sheetW);
    const key = `${chainSig[nSteps()]}|${a}|${b}|${from}|${W}`;
    if (svSheetMemo.key === key) return svSheetMemo.list;
    // (each multivalued step's offsets, 0 first, and how far each is from the principal sheet)
    const radix = [];
    for (const e of Funcs.sheetSteps(S.steps, built)) {
      const st = S.steps[e.k - 1];
      if (e.k <= from || e.k > b || !SV_SHEET_STEPS.includes(st.type)) continue;
      // (the piece's sheets as the sheets module reads them, from sheet 0 on round the circle: 0, 1 … W, −W … −1)
      const all = Funcs.sheetOffsets(e, W), i0 = all.indexOf(0), offs = [...all.slice(i0), ...all.slice(0, i0)];
      radix.push({ k: e.k, offs, far: (o) => (e.n > 0 ? Math.min(o, e.n - o) : Math.abs(o)) });
    }
    // (every combo but the chain as it is, the first of the product: nearest the principal sheet first)
    let combos = [[]];
    for (const d of radix) combos = combos.flatMap((c) => d.offs.map((o) => c.concat(o)));
    const far = (c) => c.reduce((t, o, i) => t + radix[i].far(o), 0);
    combos = combos.slice(1).map((c, i) => ({ c, i, f: far(c) })).sort((x, y) => x.f - y.f || x.i - y.i).map((x) => x.c);
    // (a chain's values on each plane from a to b at SHEET_PTS, one list; a point it cannot be evaluated at is a missing
    // value, null)
    const valsOf = (steps, bs) => {
      let G = null;
      try { G = Funcs.stageFunctions(steps, bs); } catch (e) { G = null; }
      const out = [];
      for (let j = a; j <= b; j++) for (const z of SHEET_PTS) { let w = null; try { w = G && G[j] ? G[j](z) : null; } catch (e) { w = null; } out.push(w); }
      return out;
    };
    // (each copy's steps, built forms, signature and GPU chain: rebuild()'s, without its repeatsFollow and
    // stagesFollow, which change the user's chain; turn: each of those steps' cuts turned half a turn too,
    // svGlideSeams)
    const variant = (offs, tag, turn) => {
      const steps = S.steps.map((st) => Object.assign({}, st, { params: Object.assign({}, st.params) }));
      radix.forEach((d, i) => { const st = steps[d.k - 1]; st.params.k = (st.params.k || 0) + offs[i]; if (turn) st.params.cut = svCut(st) + SV_HALF_TURN; });
      const bs = Funcs.applyRepeats(steps, steps.map((st) => Funcs.build(st)));
      return { offs, steps, built: bs, sig: chainSig.map((g) => `${g}|${tag}`), gl: null };
    };
    // (a combo whose values match the chain's or a kept copy's is not kept; the GPU chain is built for the kept ones)
    const seen = [valsOf(S.steps, built)], list = [];
    for (const offs of combos) {
      if (list.length >= SV_GLIDE_SHEETS_MAX - 1) break;
      const v = variant(offs, `sheet${list.length + 1}`, false), vals = valsOf(v.steps, v.built);
      if (seen.some((w) => sheetValsSame(w, vals))) continue;
      seen.push(vals);
      list.push(v);
    }
    // (the GPU chains, the chain's own first: a copy changes only a step's params.k and takes the chain's uniform slots, so
    // a chain the build refuses (GLChain.build throws over the slot cap; rebuild() reported it) has no copies, and the
    // memo keeps that answer: the glide draws the chain alone, which reads the refusal as the parked plane does)
    let own = null;
    if (GLR.ok && list.length) {
      try {
        own = GLChain.build(S.steps, built);
        for (const v of list) v.gl = GLChain.build(v.steps, v.built);
      } catch (e) {
        // (the chain's own refusal is rebuild()'s to report; a copy's, after the chain's own built, is reported here)
        if (own) console.error('GLChain', e);
        own = null; list.length = 0;
      }
    }
    // (the seams: every surface drawn, the chain as it is first, with its cuts turned, made when first asked for)
    let seams = null;
    const seamList = () => seams || (seams = [radix.map(() => 0), ...list.map((v) => v.offs)].map((offs, n) => { const v = variant(offs, `seam${n}`, true); if (GLR.ok) v.gl = GLChain.build(v.steps, v.built); return v; }));
    svSheetMemo = { key, list, W, seamList, own };
    return list;
  }
  // The seams of a Landscape glide's copies (svGlideSheets(a, b, from)): the carried grid leaves out a cell its map
  // tears, and every surface drawn tears along the image of its multivalued steps' cuts, where one sheet meets the next,
  // so the copies leave a slit there. Each surface again with those cuts turned half a turn is continuous across that
  // image; drawn before the surfaces themselves, it shows only where none of them draws (a surface and its turned
  // twin take the same values away from both cuts). SV.glideSeams 0 (a test hook's) draws none
  function svGlideSeams(a, b, from = 0) {
    return svGlideSheets(a, b, from).length ? svSheetMemo.seamList() : [];
  }
  // where a Landscape glide's seams tear (svGlideSeams): along step b's cut, a ray from 0 in the plane of its input,
  // when that plane is the carry's source s (from) and step b is the one multivalued step it applies. Its angle in
  // degrees when it lies on an axis, so a seam's cells can be a box about it (GLR.drawLandscape's band), else null (the
  // seams cover the source plane's whole box)
  function svSeamCut(b, from) {
    const st = S.steps[b - 1];
    if (from !== b - 1 || !st || !SV_SHEET_STEPS.includes(st.type)) return null;
    const c = ((svCut(st) % 360) + 360) % 360;
    return c % 90 === 0 ? c : null;
  }
  // draw() with the chain on sheet combo v (svGlideSheets): the steps, their built forms, their signature (the plans'
  // caches are keyed by it) and the GPU chain's data, then the chain as it is again; draw's answer
  function svOnSheets(v, draw) {
    const s0 = S.steps, b0 = built, g0 = chainSig, m0 = svHomMemo;
    setSteps(v.steps); built = v.built; chainSig = v.sig; svHomMemo = null;
    if (v.gl) GLR.setChain(v.gl);
    try { return draw(); } finally {
      setSteps(s0); built = b0; chainSig = g0; svHomMemo = m0;
      if (svSheetMemo.own) GLR.setChain(svSheetMemo.own);
    }
  }
  // A glide into a d/dz plane (svBetween's jump: the step has no homotopy) on the plane or the globe: the two planes'
  // pictures at rest cross-faded, each drawn as the plane draws at rest (the classic core's pull-back on a coloured
  // plane, else the carry core's exact pass or its meshes), plane a's on the pane and plane b's over it at opacity u
  // from a canvas of its own. The glide's record: path 'inverse' when both ends are exact (a coloured plane's plot, or
  // the exact pass past the colour plane), else 'mesh' ('none': an end drew no colour), each end's in ends. The cuts
  // are each end's, faded with it; while the glide is under way, the handles of the plane it is nearest to, inert. False
  // for any other frame (the Landscape's jump is svLandMoving's)
  let svJumpCv = null;
  function svJump(pane, still) {
    if (SV.surf === 'land') return false;
    const bt = svBetween();
    if (bt.all || bt.b === bt.a || bt.u <= SV_REST_U || !isDeriv(bt.b)) return false;
    const globe = SV.surf === 'sphere' && lGlobe();
    const end = (j, p) => {
      const k = svRestAt(j, p, still);
      if (svColoured(k)) return 'plot';
      if (globe) return (leftSphereInfo && leftSphereInfo.carryPath) || 'none';
      return svRestRec && svRestRec.a === k ? svRestRec.path : 'none';
    };
    // (each end's cut handles, as its draw leaves them: the editable ones of the classic core at rest (cutHandlesL), or
    // the inert ones of the carry core, which draws them so while a scrub holds the thread (cutMarksL))
    const handles = [];
    const drawEnd = (j, p) => { cutHandlesL = []; cutMarksL = []; const e = end(j, p); handles.push(cutHandlesL.concat(cutMarksL)); return e; };
    const ends = [drawEnd(bt.x0, pane)];
    svJumpCv = svCanvas(svJumpCv, pane);
    ends.push(drawEnd(bt.x1, svProxy(pane, svJumpCv)));
    svFadeOver(pane, svJumpCv, bt.u);
    // (no handle takes a press mid-glide; while the glide is under way the plane it is nearest to shows its handles
    // inert, as a glide frame between two other planes does (cutMarksL); a frame parked between the planes shows none)
    cutHandlesL = [];
    cutMarksL = svGliding() ? handles[bt.u < 0.5 ? 0 : 1] : [];
    const exact = (e) => e === 'plot' || e === 'inverse';
    svGlideRec = { b: bt.b, u: bt.u, path: ends.every(exact) ? 'inverse' : ends.includes('none') ? 'none' : 'mesh', reason: 'a d/dz step', ends, key: null, H: bt.F, Hb: null, view: Object.assign({}, pane.view), w: pane.w, h: pane.h };
    SV.core = 'carry';
    return true;
  }
  // plane j's frame at rest (svPlanes' j-th) drawn on pane p, as the steps view draws it at rest: the thread on that
  // plane and the view the steps view sets there (svViewFix's main view and surface), all put back after; the classic
  // core's still, or the carry core where the plane's colour is pushed forward -> the plane
  function svRestAt(j, p, still) {
    const g = SV.g, keep = { x: g.x, target: g.target, v: g.v, i: SV.i }, v = S.view, surf = SV.surf === 'sphere' ? 'sphere' : 'plane';
    const k = svPlanes()[j], side = svColoured(k) ? 'P' : 'L', main = v.main, was = v[side].surf;
    g.x = j; g.target = j; g.v = 0; SV.i = j; svRestRec = null; leftSphereInfo = null;
    v.main = svMain(k);
    if (v.main !== 'land') v[side].surf = surf;
    try {
      if (svPaint() === 'push' && svFlatSurf() && lFlat()) svRenderMoving(p);
      else still(p);
    } finally { g.x = keep.x; g.target = keep.target; g.v = keep.v; SV.i = keep.i; v.main = main; v[side].surf = was; }
    return k;
  }
  // the held frame on the left pane while a held glide's frames keep it there: { key: its inputs (the place held, the
  // view, the pane's size, the chain), asks: renderAsks once it was drawn or kept, mf: its moving paths (mfDrawn), cm:
  // its cuts' inert handles (cutMarksL), pre: its pre-mapped draws (svCarryPre, which a kept frame sets again) }; null
  // after any other frame
  let svHeldOn = null;
  // the held frame at rest on plane z (its svHeldKept key) whose plot drew nothing while its program linked: drawn by the
  // carry core until nothing links (svDrawPlane); null otherwise
  let svRestFell = null;
  // a held frame with the inputs of the held frame on the pane (key: the place held, the view, the pane's size, the
  // chain), and no frame asked for since asks, would draw that frame again: the pane keeps it, its status included,
  // and the hold's own checks are all this frame does -> true; else -> false, svHeldOn starts over for key (null: none),
  // the frame's moving paths and cut handles put on it once drawn
  function svHeldKept(key, asks) {
    if (key !== null && svHeldOn && svHeldOn.key === key && svHeldOn.asks === asks) { svHeldOn.asks = renderAsks; mfDrawn = svHeldOn.mf; cutMarksL = svHeldOn.cm; svCarryPre = svHeldOn.pre; return true; }
    svHeldOn = key === null ? null : { key, asks: renderAsks, mf: null, cm: [], pre: 0 };
    return false;
  }
  // device px the principal sheet's pass grows its cut edges by in a glide frame drawn front to back (colour()):
  // the copy's pass on the cut's other side estimates the same edge from its own leaf, so at a pixel on the cut the two
  // coverages can sum short of one; drawn first, the grown principal fills that pixel and saturate leaves the copy the
  // rest. Half a pixel: no pixel centre further past the cut takes the principal's colour
  const SV_SAT_GROW = 0.5;
  // hold: the place a waiting glide is drawn at instead of the thread's (svDrawPlane's svLinkHold), or null; asks: the
  // frames asked for (renderAsks) before that hold asked for its own
  function svRenderMoving(pane, hold = null, asks = renderAsks) {
    // (the globe's frame: the motion's frame drawn where it is, unless it waits, svLinkHold with svGlobeHolds)
    if (SV.surf === 'sphere' && lGlobe()) { svHeldOn = null; svSphereMoving(pane, hold); if (hold == null) svMotionDrawn(svMotion()); return; }
    // (a motion whose frames were drawn ahead shows them)
    if (svAheadShow(pane)) return;
    if (svHeldKept(hold == null ? null : [hold, S.srcView.cx, S.srcView.cy, S.srcView.s, pane.w, pane.h, pane.dpr, chainSig[nSteps()]].join('|'), asks)) return;
    const bt = svBetween(hold == null ? SV.g.x : hold), { a, b, u, map, F, H: Hb, near } = bt, rest = !SV.anim && !SV.play && !(SV.drag && SV.drag.moved);
    // (parked between two planes, a pan or a zoom changes the view of the plane the thread is nearest to, V.left past the first
    // plane; the picture is drawn from the one camera every plane shares, S.srcView, so the parked view hands it its own. Not
    // while a Play runs: V.left has not taken the camera yet, and would hand the camera back the view of plane z)
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
    const T = svT(), still = u <= SV_REST_U || b === a;
    // (in both scopes: the regions of later planes pulled back, a layer of their own over the colour, under the outlines,
    // as a coloured plane draws them (renderColor): at rest on plane a by drawPreimage, between two planes by the inverse
    // pass (svStagedLayer); into the open frame, else a frame of its own; left out with the strokes, hideStrokes)
    const pullLayer = (inFrame) => {
      if (bare || hideStrokes) return;
      if (still) { stagePullbacks(pane, a, inFrame, true); return; }
      const f = { open: inFrame };
      svStagedLayer(pane, f);
      if (f.open && !inFrame) GLR.blit(pane.ctx);
    };
    // (the colour layer is one GL frame, the plots at their opacity and the carried colour composed in it, and
    // one copy into cc at the end)
    const frame = { open: false };
    // (noValue: only where plane k's map has no value, its no-value colour: GLR.drawColorPlot's)
    // (under: under what the frame holds, drawColorPlot's under)
    const plot = (k, al, noValue, under) => {
      if (al <= 0.01 || !svColoured(k)) return;
      if (!frame.open) { GLR.begin(pane.pw, pane.ph); frame.open = true; }
      GLR.drawColorPlot({ map: svColourMap(k), view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: null, alpha: al, exact: true, noValue, under });
    };
    // (the glide's record, svGlideRec, of a frame that drew (drew) or not, why not (why.r), its span and its sheet copies;
    // sat: drawn front to back, colour())
    const record = (drew, why, span, sheets, sat) => {
      const kp = !drew ? null : span ? invSpanPath(SV_ALL, 0, span.a, b, u, span.stepT, () => svSheetKey(b).sing) : invHomPath(SV_ALL, 0, b, u, () => svSheetKeyAt(b, u).sing);
      // (sheets: the sheet combos drawn, svGlideSheets, the window of an infinitely sheeted step's, and each combo's
      // offsets, one per multivalued step up to b in chain order, the chain as it is first)
      // (alpha, on a frame the inverse pass drew: the opacity it composited the frame's points with, front to back, the
      // farthest opaque (svCarryLook at base 1))
      const hl = drew ? svHomPaths(b, u, span).h : null, look = hl ? svCarryLook(1, hl.list[0], { a: span ? span.a : b - 1, b, u }, T) : null;
      svGlideRec = { b, u, all: !!span, path: drew ? 'inverse' : why.r === SV_NO_AREA ? 'none' : 'mesh', reason: why.r, key: kp && kp.prep ? (z) => Inverse.sheetKey(kp.prep, z) : null, per: kp && kp.prep && kp.prep.per ? [kp.prep.per.re, kp.prep.per.im] : null, ops: kp && kp.plan ? kp.plan.ops.map((o) => o.kind) : null, H: F, Hb, view: Object.assign({}, pane.view), w: pane.w, h: pane.h, sheets: sheets.length + 1, sheetW: sheets.length ? svSheetMemo.W : null, sheetKs: sheets.length ? [sheets[0].offs.map(() => 0), ...sheets.map((v) => v.offs)] : null,
        sat, ...(look && { alpha: look.alpha }) };
    };
    const colour = () => {
      // (the other sheets' copies, svGlideSheets, nearest the principal sheet first)
      const sheets = !still && map.mode === 1 && !isDeriv(b) && svColoured(b) && !svMaskOn() && SV.glideSheets !== 1 ? svGlideSheets(a, b) : [];
      // (front to back, when the inverse pass draws the frame and its copies into a frame still empty: the principal sheet
      // and then the copies, nearest first, each blended by SRC_ALPHA_SATURATE (drawInverse's saturate), then the
      // planes' plots under them (drawColorPlot's under), plane a's no-value colour first so that it stays over plane
      // b's. Two copies that meet along a cut's image each cover part of its pixels: saturate makes those parts the whole
      // pixel, where painter's order leaves the plots showing through as a line (#2069). Where copies overlap, the first
      // drawn wins, as the last drawn does in painter's order, so each pixel's winner is painter's. A pass that cannot
      // draw sends the frame back to painter's order below, from a fresh frame. SV.glideSat 0 (a test hook's) keeps
      // painter's order; not with a repeat's plan (REPT), whose pass writes marks, not colours)
      if (sheets.length && !frame.open && SV.glideSat !== 0 && svExactGlide(b, u, null) && !svHomPaths(b, u, null).h.paths.some((p) => p.plan.ops.some((o) => o.kind === 'REPT'))) {
        GLR.begin(pane.pw, pane.ph); frame.open = true; frame.sat = true;
        let drew = false;
        try { frame.grow = SV_SAT_GROW; const p0 = svCarryExactHom(pane, b, u, T, frame, { r: null }, null); frame.grow = 0; drew = p0 && sheets.every((v) => svOnSheets(v, () => svCarryExactHom(pane, b, u, T, frame, { r: null }))); } finally { frame.sat = false; }
        if (drew) {
          plot(a, 1, true, true);
          if (SV.restPaint !== 0) plot(b, 1, false, true);
          record(true, { r: null }, null, sheets, true);
          return;
        }
        GLR.begin(pane.pw, pane.ph, undefined, true);
      }
      // (between planes, under the carried colour, which covers both wherever a point of the glide arrives, so that a
      // pixel no point reaches shows them: what plane b draws there at rest, its own colour when it is a coloured plane
      // (no blank, and at the arrival plane b's parked picture), and over it the departure plane's
      // no-value colour, its NaN hatch where its map has no value at the pixel's point, which shrinks as the points
      // arrive. Inside regions only under the regions' mask, which keeps them inside the regions. SV.restPaint
      // 0 (a test hook's) leaves plane b's picture out, so that a pixel no point reaches shows the paper)
      if (!still && map.mode === 1 && !isDeriv(b) && (mask || !svMaskOn())) { if (SV.restPaint !== 0) plot(b, 1); plot(a, 1, true); }
      // (between two planes, per pixel through the inverse pass when step b's homotopy has an inverse plan, or, all at
      // once, each step of the span at its own time (svSpanPaths): the exact picture of the map at u, with nothing
      // blended in; else the carried meshes below, with the planes' plots)
      // (painter's order: the copies first, the farthest from the principal sheet first: where they meet, a nearer sheet
      // is drawn over a farther one, and the principal one over them all)
      for (const v of sheets.slice().reverse()) svOnSheets(v, () => svCarryExactHom(pane, b, u, T, frame, { r: null }) || svCarryRegions(pane, map, T, b, frame, null));
      if (!still && (map.mode === 1 || map.mode === 3) && !isDeriv(b)) {
        const span = svSpanPaths(bt), why = { r: null }, drew = svCarryExactHom(pane, b, u, T, frame, why, span);
        record(drew, why, span, sheets, false);
        if (drew) return;
      }
      // (at rest on a plane at or before the colour plane its exact colour covers it all: no carried colour under it)
      // (at rest past the colour plane, the points take their colour exactly, as the region tiling places them:
      // svCarryExact)
      const exact = still && !svColoured(a) && svCarryExact(pane, a, T, frame);
      if (still && !svColoured(a)) svRestRec = { a, path: exact ? 'inverse' : 'mesh' };
      if (exact) return;
      // (and while gliding, a step at a time or all at once, or at rest while the exact pass compiles: the tessellated
      // meshes the tiling's patterns travel on, each fragment its point's colour; Everywhere with the outer meshes, they
      // cover the pane, so no plane's colour is drawn under them or blended over them)
      if ((still ? !svColoured(a) : !isDeriv(b)) && svCarryRegions(pane, map, T, still ? a : b, frame, rest ? F : null)) return;
      // (at rest while the programs at rest link: the glide's own to plane a at its end, t = 1, the same places, with
      // the programs the glide there linked)
      if (still && !svColoured(a) && a > 0 && !isDeriv(a) && svCarryRegions(pane, { mode: 1, hi: a, t: 1 }, T, a, frame, null)) return;
      // (else the planes' exact colours: at rest, a plane at or before the colour plane; mid-glide, where the carried
      // meshes cannot draw (the glide waits while they link, svLinkHold), the colour of the plane the frame is nearest
      // to, as it is at rest: never two planes blended)
      plot(still ? a : near, 1);
    };
    // (Inside regions on the GPU, #440: the colour layer over the regions' mask and kept inside it, the grid under it and
    // the outlines over it, in one frame and one copy to the page, #545)
    // (mask: the regions' mask drawn under the colour; none for a step's frame the inverse pass draws, svExactGlide; an
    // All-at-once frame keeps the mask of the regions' images)
    // (with a region of a later plane, the mask stays but is the inverse pass's too: svStagedMask draws every region)
    const exact = svMaskOn() && !still && (map.mode === 1 || map.mode === 3) && !isDeriv(b) && svExactGlide(b, u, svSpanPaths(bt));
    const mask = svMaskOn() && !(exact && !svStagedOf());
    if (mask && svMask(pane, map, still ? a : undefined, {
      exact,
      // (under the colour, the plane's paper and, past the colour plane, its grid, as the 2D path leaves the pane's
      // showing where none lands: a pixel of the regions the colour layer leaves empty (the inverse pass found no point
      // there) reads as the paper, never as the frame's cleared black; the colour layer stays in this frame)
      paint: () => { GLR.clearRGB(TH.planeRGB); grid(false); frame.open = true; colour(); },
      after: () => { grid(true); pullLayer(true); if (!bare) svOutlines(pane, map, frame, col); frame.open = false; },
    })) {
      // (drawn: the frame is on the page)
    } else {
      colour();
      // the grid under the colour layer and the outlines over it, in the same frame: the frame's one copy goes
      // to the page. Inside regions in 2D (the mask is a pass over the colour layer), the layers go one by one, the grid
      // first
      if (!mask) {
        if (!frame.open) { GLR.begin(pane.pw, pane.ph); frame.open = true; }
        grid(true);
        pullLayer(true);
        if (!bare) svOutlines(pane, map, frame, col);
        GLR.blit(pane.ctx);
        frame.open = false;
      } else {
        if (frame.open) { GLR.blit(cc); frame.open = false; }
        svMask(pane, map, still ? a : undefined, { cc });
        if (GLR.drawGrid && !col) { GLR.begin(pane.pw, pane.ph); grid(false); GLR.blit(pane.ctx); }
        pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.drawImage(svColCv, 0, 0); pane.ctx.restore();
        pullLayer(false);
        if (!bare) svOutlines(pane, map, null, col);
      }
    }
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (bare) { glStatusNote(pane, true); return; }   // (the colour layer alone: its status is the pane's, with no note)
    if (col) colourGrid(pane);
    // (the points, carried too; at rest the plane's rulers, as every plane has)
    // (the paths t -> H_t(z) of the glide's run, svPathsSource: the classic deformation's, under the points)
    const paths = svPathsSource();
    if (paths) { try { drawMorphPathsX(pane, morphSelScreen(pane, paths), F, null, { T: paths.T, side: 'L' }); } catch (e) { console.error('steps view paths', e); } }
    cutHandlesL = still && rest ? drawCuts(pane, a, true, false) : [];
    // (a frame between two planes shows the cuts as the plane it is nearest to does at rest: hatches and the branch point's dot on the cuts of that plane, and a
    // handle on each editable cut: while the glide is under way inert (cutMarksL), on a frame parked between two planes one that a drag turns, the pointer pulled
    // back through the frame's own map, the glide's at its u (cutHandlesL))
    if (!(still && rest)) { const cp = svCutPlan(bt); drawCutCurvesAt(pane, cp.mapFor, null, cp.pre, still ? 1 : SV_CUT_THIN, { own: (j0) => j0 === near, marks: svGliding() ? cutMarksL : svParked() ? cutHandlesL : null }); }
    // (a glide or a play is under way: its frames stay on the move, whatever a stalled frame shows)
    const settled = rest || (!SV.anim && !SV.play && svPictureSettled(pane, a, b, u));
    drawPoints(pane, F, Object.assign(still ? { primes: a, k: a, editK: a } : {}, settled ? {} : { lite: true }));
    // (at rest on plane a, the points of later planes by their preimages here, as on a coloured plane)
    if (still && rest) { updatePre('L', pane, a); drawPre(pane, 'L', a); }
    if (rest) drawRulers(pane, 'L');
    // (the pane's GPU status and its notes, compiling or preparing, as renderLeft's frames keep them)
    glStatusNote(pane);
    if (svHeldOn) { svHeldOn.mf = mfDrawn; svHeldOn.cm = cutMarksL; svHeldOn.pre = svCarryPre; }
  }
  // Inside regions between two planes: the alpha of the regions of later planes (all: and of the colour's plane) in the
  // open frame, by the inverse pass (a region of plane k holds the points whose F_{0->k} it holds, moved by the glide's
  // map), which writes alpha alone under the caller's write mask. A region's look goes from the one it has at rest on
  // the glide's first plane to the one it has on the plane the glide reaches, by its share of its own look (svStagedOf's
  // own): its own opacity at 1, pulled back (stagePullbacks' mask: opaque, dimK alone, and the boundary band that
  // drawPreimage draws at rest) at 0, mixed in between. Nothing when none is visible or the pass cannot draw them.
  // A region at its own look is one fill pass, grown to its band's reach; a pulled-back one is one pass of its band over
  // its fill (the edge draw's tint), alpha l + f (1 - l) as a fill pass and a band pass over it write, its fill to the
  // boundary (the band's outer half is the band's alpha alone). So each region costs the frame one inverse pass (a
  // pulled-back region a second, svStagedLayer's over the colour), within a software renderer's time for a frame
  function svStagedMask(pane, all) {
    const st = svStagedOf(all);
    if (!st) return;
    const fillA = (x) => { const p = dimK(x); return p + st.own(x) * (1 - p); };
    const whole = st.list.map((x, i) => i).filter((i) => st.own(st.list[i]) >= 1);
    if (whole.length) svDrawInverse(pane, whole.map((i) => st.list[i]), whole.map((i) => st.paths[i]), svT(), { open: true }, null, fillA);
    svPulledEdge(pane, st, { open: true }, (x, k) => ({ width: pullBandW(x, pane.dpr), alpha: PULL_EDGE_A * k, tint: [0, 0, 0, fillA(x)] }));
  }
  // the regions of svStagedOf's st pulled back (own < 1) by one edge draw each of the inverse pass into the frame gl:
  // edgeOf(shape, k) its band and tint (GLR.drawInverse's edge), k its share of the pulled-back look (1 - own). Nothing
  // when none is pulled back
  function svPulledEdge(pane, st, gl, edgeOf) {
    const back = st.list.map((x, i) => i).filter((i) => st.own(st.list[i]) < 1);
    if (back.length) svDrawInverse(pane, back.map((i) => st.list[i]), back.map((i) => st.paths[i]), svT(), gl, null, null, (x) => edgeOf(x, 1 - st.own(x)));
  }
  // the layer of the regions of later planes over the colour in the frame between two planes, in both scopes, by the
  // inverse pass: each region's fill and band as the parked frame of the glide's first plane draws them (stagePullbacks
  // over the colour), at its share of the pulled-back look (1 - svStagedOf's own), so the layer of a region of the
  // plane the glide reaches goes out as its own look comes in; into the frame gl ({ open }, opened if need be). Nothing
  // when none is visible or the pass cannot draw them
  function svStagedLayer(pane, gl) {
    const st = svStagedOf();
    if (!st) return;
    svPulledEdge(pane, st, gl, (x, k) => {
      const e = svStrokeAt(pullLayerEdge(x, pane.dpr), k);
      return Object.assign(e, { tint: [e.tint[0], e.tint[1], e.tint[2], e.tint[3] * k] });
    });
  }
  // The shapes of the plane the glide reaches, which the inverse pass strokes where it puts a region's boundary or the
  // curve itself, with the outline pass's stroke at rest on that plane (shapeStroke: the shape's colour over its casing)
  // at the shape's share of its own look (svStagedOf's own: u), so the stroke comes in over the glide: Map shape ->
  // { path: its inverse path, k: that share }, or null. Inside regions and Everywhere. The pulled-back regions' band is
  // the layer's (svStagedLayer); the earlier planes' strokes are the outline pass's (svShapeMap)
  function svReached(map0) {
    if (map0.mode !== 1 && map0.mode !== 3) return null;
    const g = svBetween(), m = new Map();
    for (const q of [svStagedOf(), svStagedCurves()]) if (q) q.list.forEach((x, i) => { if (shapeStage(x) === g.b) m.set(x, { path: q.paths[i], k: g.u }); });
    return m.size ? m : null;
  }
  // stroke st (shapeStroke's) at the share k of its opacity, its casing too
  const svStrokeAt = (st, k) => Object.assign({}, st, { alpha: st.alpha * k }, st.casing ? { casing: Object.assign({}, st.casing, { alpha: st.casing.alpha * k }) } : {});
  // the frame between two planes whose shapes of later planes the inverse pass draws: {g: svBetween's (by default the
  // thread's place), h: its paths (svHomPaths)}, or null (at rest, a d/dz step, or no inverse paths)
  function svStagedFrame(g = svBetween()) {
    if (g.a === g.b || !(g.map.mode === 1 || g.map.mode === 3) || isDeriv(g.b)) return null;
    const h = svHomPaths(g.b, g.u, svSpanPaths(g)).h;
    return h ? { g, h } : null;
  }
  // the curve kinds the inverse pass strokes on a later plane (GLR.packShapes: their distance is its level; a freehand
  // curve, a formula curve, an external ray and an equipotential by their polylines at rest, invTrace)
  const SV_STAGED_CURVES = new Set(['segment', 'line', 'ray', 'circle', 'arc', 'curve', 'cgrid', 'pgrid', 'fcurve', 'dhray', 'dheq']);
  // the curves of later planes of the frame between two planes, with their inverse path, the whole plane's (a shape of
  // a later plane is tested on its own plane, svInvPaths): {list, paths}, or null when there is none or the pass cannot
  // draw them
  function svStagedCurves(g) {
    const f = svStagedFrame(g);
    if (!f) return null;
    g = f.g;
    const list = S.shapes.filter((x) => x.visible !== false && SV_STAGED_CURVES.has(x.kind) && shapeStage(x) > 0 && !derivIn(0, shapeStage(x)));
    if (!list.length) return null;
    const whole = g.all ? invSpanPath(SV_ALL, 0, g.a, g.b, g.u, g.stepT, () => svSheetKey(g.b).sing) : invHomPath(SV_ALL, 0, g.b, g.u, () => svSheetKeyAt(g.b, g.u).sing);
    return whole.path === 'inverse' ? { list, paths: list.map(() => whole) } : null;
  }
  // the regions of later planes of the frame between two planes, with their inverse paths: {g, list, paths, own(x): the
  // share of its own plane's look region x has in this frame, 1 on a plane up to the glide's first, u on the plane it
  // reaches, 0 past it}, or null when there is none or the pass cannot draw them.
  // Everywhere (the pass draws the whole plane, SV_ALL) such a region takes the whole plane's path, as it does Inside
  // regions (svInvPaths). all: the regions of the colour's plane too (Inside regions); g: the frame's place (svStagedFrame)
  function svStagedOf(all, g) {
    const f = svStagedFrame(g);
    if (!f) return null;
    const { h } = f;
    g = f.g;
    const whole = h.list.indexOf(SV_ALL);
    const list = whole < 0 ? h.list.filter((x) => all || shapeStage(x)) : visibleAreas().filter((x) => shapeStage(x) && !derivIn(0, shapeStage(x)));
    if (!list.length) return null;
    return { g, list, paths: list.map((x) => h.paths[whole < 0 ? h.list.indexOf(x) : whole]), own: (x) => (shapeStage(x) <= g.a ? 1 : shapeStage(x) === g.b ? g.u : 0) };
  }
  // Inside regions: the colour kept inside the regions under map (and, at rest on plane k, the later planes'
  // regions pulled back, stagePullbacks), by what the renderer can do:
  // - on the GPU, in one frame and one copy to the page: the regions' fills (drawScene's fills) write the
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
    // (o.exact: the regions of the colour's plane are not filled from their forward image: svStagedMask draws them)
    if (o.exact) opt.skip = (x) => !shapeStage(x);
    const mp = Object.create(pane);
    mp.begin = () => {};
    try {
      withSolidRegions(() => drawScene(mp, map, 'L', Object.assign(opt, {
        under: () => GLR.writeMask(false, true),
        over: () => {
          if (k != null) stagePullbacks(mp, k, true);
          else svStagedMask(mp, o.exact);
          GLR.writeMask(true, false);
          o.paint();
          GLR.writeMask(true, true);
          GLR.keepInAlpha();
          reptHatch(pane, map);
          refusedHatch(pane, map);
          if (o.after) o.after();
          onPage = true;
        },
      })));
    } catch (e) { console.error('steps view mask', e); }
    GLR.writeMask(true, true);
    return onPage;
  }
  // the shapes' outlines in S.shapes order: under map, open sets dashed (spec 6.5), along the curve under map; the plane
  // a glide reaches, in every frame of the glide, by the inverse pass per pixel (svReached) at opacity u (svStrokeAt);
  // col: as the colour plot draws them (renderColor: with Outlines off, the selected shape's alone). Into the open GL
  // frame frame, if given (the caller copies it), else a frame of their own
  function svOutlines(pane, map0, frame, col) {
    if (!frame) GLR.begin(pane.pw, pane.ph);
    const reached = hideStrokes ? null : svReached(map0);
    for (const s of hideStrokes ? [] : S.shapes) {
      if (!outlineShown(s, !col)) continue;
      const p = reached && reached.get(s);
      // (an open region's outline dashed as at rest, OPEN_DASH along its arc at rest: GLR.drawInverse's st.edge.dash)
      if (p) { svDrawInverse(pane, [s], [p.path], svT(), { open: true }, null, null, (x) => Object.assign(svStrokeAt(shapeStroke(x, pane.dpr, { plane: shapeStage(x) }), p.k), kindType(x) === 'area' && Region.isOpen(x) ? { dash: OPEN_DASH } : {})); continue; }
      const map = svShapeMap(s, map0), r = map && shapeGPU(s), o = r && outlineRes(map, r, pane);
      if (!o) continue;
      const dash = openDash(o.rec, map);
      GLR.drawLines(o.res, Object.assign({ map, view: pane.view, dpr: pane.dpr, M: OUTLINE_M, cpu: () => cpuMap(map) }, shapeStroke(s, pane.dpr, { domain: svStage() === 0, plane: svStage() }), dash));
    }
    if (!frame) GLR.blit(pane.ctx);
  }
  // The Landscape with Inside regions: which points of plane k's box are in the carried region set, the set the
  // plane's 2D picture colours (svMask): {cv, key, box, unres}, a canvas over box (512 pixels on its longer side, row 0
  // at its top), opaque white inside the set, clear outside, where the surface is plain (the Plain material's colour),
  // and opaque black at the pixels a REPT plan left unresolved (unres of them; all of them when the plane's repeat is
  // refused, repeatRefused), where it draws the no-value hatch. One
  // per chain, plane, box and shapes; null with the colour everywhere (Everywhere)
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
    // (the pixels a REPT plan left unresolved: counted, and marked opaque black in the mask, where the surface draws
    // the no-value hatch (LAND_FS); never read as uncovered)
    // (a refused repeat's plan has none to draw it: its mask is the no-value mark everywhere, the surface hatched all over,
    // as the flat plane is)
    const refused = repeatRefused(stageMap(k));
    if (refused) { cc.fillStyle = '#000'; cc.fillRect(0, 0, pw, ph); }
    const unres = refused ? pw * ph : reptExact(stageMap(k)) && GLR.reptMarkCount ? GLR.reptMarkCount(cc) : 0;
    // (a pass that left a program linking drew its regions short: the mask is not kept under this key, so the frame
    // that follows the link draws it afresh)
    const linking = !!GLR.frameStatus().pending;
    svLandMaskC = { cv, key: linking ? key + '|linking' + (++svLandMaskLinking) : key, box: Object.assign({}, box), cut: true, unres, refused };
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
  // whether the globe's glide frame g (svBetween) must wait (svLinkHold's hold test on the globe), between two planes that
  // show the colour: an All-at-once span's frame the globe's inverse pass draws while that pass's programs link (as svHolds
  // on the plane), or a frame the globe's carried mesh draws (All at once with no inverse plan, or a step with none) while
  // the mesh links
  function svGlobeHolds(g) {
    svHoldB = 0;
    const T = svT(), shows = (k) => svColoured(k) || k > T;
    if (g.u <= SV_REST_U || g.b === g.a || isDeriv(g.b) || !shows(g.a) || !shows(g.b)) return false;
    // (the span's frame as svSphereMoving asks the inverse pass for it, svGlobeCarryInv: its programs in the globe's kind)
    const span = svSpanPaths(g);
    if (span && (g.map.mode === 1 || g.map.mode === 3) && GLR.inverseState) {
      const h = svInvPaths(g.b, g.u, 'globe', { r: null }, span), carry = svCarryStyle(T);
      if (h) return h.paths.some((p, i) => GLR.inverseState(Object.assign({ viewKind: 'globe' }, svInvArg(paneL, p, h.list[i], carry))) === 'pending');
    }
    // (a step's glide the globe's inverse pass draws, as svSphereMoving asks it, draws no carried mesh)
    if (!g.all && (g.map.mode !== 1 || svInvPaths(g.b, g.u, 'globe', { r: null }))) return false;
    const src = Math.min(g.a, T);
    if (src > 0 && derivIn(src, T)) return false;
    return svMeshLinking(svGlideMap(g, src), { id: src === T });
  }
  // the glide on the globe: the globe of plane a with the colour carried by the glide's map, the shapes moving on it.
  // While the carried mesh it is drawn with links, the glide waits where it is (svLinkHold with svGlobeHolds); hold: the
  // place it is drawn at then
  // the regions' colour on the globe per pixel through the inverse pass, as drawSphere's regions draw records: between
  // two planes, step b's homotopy at u (svCarryExactHom's records), or an All-at-once span's steps each at its own time
  // (span, svSpanPaths); at rest on plane b past the colour plane (u null), the map into b (svCarryExact's). A point of the
  // plane shown is walked back to plane 0 and coloured as the colour plane colours it. Null when the frame cannot take the
  // pass; a region with no inverse plan makes it null too, unless rest is an array (at rest): those shapes are put in it
  // and the list holds the others (possibly none)
  function svGlobeCarryInv(pane, b, u, T, rest, span) {
    const h = svInvPaths(b, u, 'globe', { r: null, rest }, span), carry = svCarryStyle(T);
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
  // (svGlobeKeyRec: the sheet key the last carried mesh was built with, read by the test hooks)
  let svGlobeKeyRec = null;
  function svGlobeMesh(a, T, map, x = a) {
    const src = Math.min(a, T);
    if (src > 0 && derivIn(src, T)) return null;
    svGlobeKeyRec = svSheetKey(a, src);
    return Object.assign(svCarryStyle(T), { map, s: src, mesh: SV_GLOBE_MESH, lim: SV_GLOBE_CHORD, key: svGlobeKeyRec, graticule: x <= T });
  }
  // the globe at rest on plane k past the colour plane: the colour carried to it per pixel (svGlobeCarryInv with no
  // homotopy), by the carried mesh where a region has no inverse plan (kept inside those regions alone when others take
  // the exact pass), with the plane's shapes and what the globe draws over them at rest (leftGlobeOver). Null when
  // neither can draw: the caller draws the regions' exact images instead
  function svGlobeRest(pane, k) {
    const T = svT(), fwd = [], inv = svGlobeCarryInv(pane, k, null, T, fwd);
    const mesh = !inv || fwd.length ? svGlobeMesh(k, T, { mode: 0, a: Math.min(k, T), b: k }) : null;
    if (!inv && !mesh) return null;
    if (inv && fwd.length && !mesh) return null;
    const look = { imageMode: false, stage: k, plane: !!xView().eq, role: 'L' }, mixed = !!inv && fwd.length > 0;
    const over = Object.assign({ carryRegions: inv, carried: inv ? null : mesh }, look, leftGlobeOver());
    const info = sphereView(pane, camL, CAML, mixed ? Object.assign({}, over, { marks: false }) : over);
    let meshed = !!(info && info.carried) && !inv;
    // (the mesh over the exact pass's globe, kept inside the regions that take it, and the globe's marks over both, as
    // sphereView's Inside regions draws them: not on the figure's art layer, which draws them as vectors)
    if (info && mixed) {
      meshed = maskedGlobe(pane, camL, CAML, Object.assign({ only: new Set(fwd), carried: mesh }, look));
      if (!artMode) globeMarks(pane, info, over);
    }
    const exact = !!inv && inv.length > 0;
    if (info) { info.carryPath = exact ? (fwd.length ? (meshed ? 'mixed' : null) : 'inverse') : meshed ? 'mesh' : null; info.carried = !!info.carryPath; }
    return info;
  }
  // the sheet combos the last globe glide frame drew, the principal one counted (svSphereMoving's; null when it carried no
  // colour), read by the test hooks
  let svGlobeSheetsRec = null;
  function svSphereMoving(pane, hold = null) {
    const bt = svBetween(hold == null ? SV.g.x : hold), { a, b, u, map, F, near, all } = bt;
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
    // (svGlobeMesh); where neither can draw (the glide waits while the mesh links, svGlobeHolds), the plain globe of
    // the plane the frame is nearest to: never two globes blended
    const T = svT(), still = u <= SV_REST_U || b === a;
    const shows = (k) => svColoured(k) || k > T;
    const rest = still && !svColoured(a) ? svGlobeRest(pane, a) : null;
    if (rest) { leftSphereInfo = rest; return; }
    // (all at once, the span's steps each at its own time: svSpanPaths)
    const own = !still && (map.mode === 1 || map.mode === 3) && !isDeriv(b) && shows(a) && shows(b) ? svGlobeCarryInv(pane, b, u, T, undefined, svSpanPaths(bt)) : null;
    // (the other sheets' copies under it, svGlideSheets, as the plane draws them: each copy's regions made and drawn with
    // the chain on that copy's sheets (svOnSheets), the farthest from the principal sheet first, so that a nearer sheet is
    // drawn over a farther one and the principal one over them all)
    const sheets = own && map.mode === 1 && svColoured(b) && !svMaskOn() && SV.glideSheets !== 1 ? svGlideSheets(a, b) : [];
    const copies = sheets.slice().reverse().flatMap((v) => (svOnSheets(v, () => svGlobeCarryInv(pane, b, u, T)) || []).map((r) => Object.assign(r, { around: (draw) => svOnSheets(v, draw) })));
    const inv = own && copies.length ? copies.concat(own) : own;
    // (the carried mesh, between two planes that show the colour: the colour plane's grid carried by the glide's map)
    const src = Math.min(a, T);
    const carried = !inv && !still && shows(a) && shows(b) && (all || map.mode === 1)
      ? svGlobeMesh(a, T, svGlideMap(bt, src), a + u) : null;
    // (and its other sheets' copies under it, as the inverse pass's: each copy's mesh made and drawn on its sheets)
    const meshSheets = carried && !all && map.mode === 1 && !isDeriv(b) && svColoured(b) && !svMaskOn() && SV.glideSheets !== 1 ? svGlideSheets(a, b) : [];
    const carriedCopies = meshSheets.slice().reverse().map((v) => ({ carried: svOnSheets(v, () => svGlobeMesh(a, T, svGlideMap(bt, src), a + u)), around: (draw) => svOnSheets(v, draw) })).filter((c) => !!c.carried);
    svGlobeSheetsRec = inv ? sheets.length + 1 : carried ? meshSheets.length + 1 : null;
    // (under the carried colour, as the plane's frame paints it (svRenderMoving's colour): the arrival plane's own colour
    // when it is a coloured plane, so that a place no point of the glide reaches shows what plane b draws there at rest,
    // not the bare globe. SV.restPaint 0 leaves it out, as on the plane. The plane's second layer, plane a's no-value
    // hatch over it, has no pass on the globe)
    const under = inv && map.mode === 1 && SV.restPaint !== 0 && svColoured(b) && !svMaskOn() ? { colorMap: svColourMap(b), carryBase: true } : null;
    const sheetCut = SV.glideStencil === 1;
    let info = inv ? sphereView(pane, camL, CAML, Object.assign(look(a), { imageMode: false, inRegions: false, carryRegions: inv, sheetCut }, under))
      : sphereView(pane, camL, CAML, Object.assign(look(a), carried ? { imageMode: false, carried, carriedCopies, sheetCut } : { carried }));
    if (!inv && !(info && info.carried) && near === b && b !== a) info = sphereView(pane, camL, CAML, look(b));
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
  // canvas cv (svCanvas's, the pane's size in device pixels) drawn over the pane at opacity alpha: plane b's picture
  // faded over plane a's
  function svFadeOver(pane, cv, alpha) {
    pane.ctx.save(); pane.ctx.setTransform(1, 0, 0, 1, 0, 0); pane.ctx.globalAlpha = alpha; pane.ctx.drawImage(cv, 0, 0); pane.ctx.restore();
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
    if (svT() !== 0) return cauchyOffZWhy();
    return cz ? '' : $t('Select a closed curve or a bounded region: its Cauchy integral is shown.');
  }
  // (Inside regions with no area drawn: the plane is neutral, and a chain with a step says what to do)
  function svNoRegions() {
    return svScope() === 'in' && !S.shapes.some((s) => s.visible !== false && kindType(s) === 'area');
  }
  // Inside regions on the plane at rest (renderColor): the colour plot cst kept inside the plane's regions (its own, the
  // earlier planes' images and the later planes' pulled back), svMask: on the GPU in its frame, over the paper (what the
  // plot leaves undrawn, while its program links, reads as the paper), else the plot drawn, copied to a 2D canvas, cut
  // to the regions there and copied to the page. A new GL frame is open after it, with the colour frame's status
  function svColourIn(pane, cst) {
    const k = svStage(), map = stageMap(k);
    if (!svMask(pane, map, k, { paint: () => { GLR.clearRGB(TH.planeRGB); GLR.drawColorPlot(cst); } })) {
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
    GLR.begin(pane.pw, pane.ph, null, true);
  }

  // ---- the controls: the plane's head and the chain strip ----
  function svLabel() {
    const pr = svParkedPair();
    if (pr) return $t('Between {a} and {b}', { a: svName(pr[0]), b: svName(pr[1]) });
    const k = svNear(), T = svT(), P = svPlanes();
    const where = svColoured(k) ? (k === T ? $t('the colour plane') : $t('coloured from {p}', { p: svName(T) })) : $t('after the colour plane {p}', { p: svName(T) });
    return $t('Plane {p}, {i} of {n}, {where}', { p: svName(k), i: I18N.num(P.indexOf(k) + 1), n: I18N.num(P.length), where });
  }
  // the role's words, each in a span that takes the space before it: the head's fit drops the last ones (sv-wx) when the role is
  // short of room. A space inside a tag ("<i class=…>") does not split
  const svRoleWords = (role) => role.split(/ (?![^<]*>)/).map((w, i) => `<span class="sv-w">${i ? ' ' : ''}${w}</span>`).join('');
  function svFormulaHtml() {
    const { name, role, short, shortP, shortFirst } = svTitleParts();
    return `${name}<span class="sv-sep"> · </span><span class="sv-role"${short ? ` data-short="${short}"` : ''}${shortP ? ` data-short-p="${shortP}"` : ''}${shortFirst ? ' data-short-first=""' : ''}>${svRoleWords(role)}</span>`;
  }
  // a choice of several as a button that names the current one and opens svChoiceMenu; `.value` reads and sets the choice (its
  // word and its accessible name, "Speed: Normal", follow); svDisableWhy greys it with its reason
  function svChoiceBtn(cur, pairs, pick, title, cls) {
    let val = cur;
    const word = h('span', { class: 'sv-choice-t' });
    const b = /** @type {HTMLButtonElement & { value: string, choices: string[][] }} */ (h('button', { type: 'button', class: 'btn sv-choice ' + cls, 'data-tip': title, 'aria-haspopup': 'menu', 'aria-expanded': 'false',
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
    const cp = h('button', { type: 'button', class: 'btn small sv-cp', 'aria-pressed': 'false', 'data-tip': $t('Colour every plane from this one  C'), onclick: (e) => { if (!svOff(e.currentTarget)) svSetT(svNear()); } });
    const SCOPES = [['all', $t('Everywhere')], ['in', $t('Inside regions'), $t('Colour only inside the regions you draw, in every plane')]];
    const scope = seg(null, SV.scope, SCOPES, svSetScope, $t('Where colour shows'), { cls: 'sv-seg sv-scope', loop: true });
    // (a phone's header says "Inside" for "Inside regions": with the segmented control's own padding the long name does not fit
    // 360 px in Russian and Italian; the segment's name stays the whole one, and the tooltip says what it does)
    const inSeg = scope.querySelector('[data-v="in"]');
    if (inSeg) { inSeg.setAttribute('aria-label', SCOPES[1][1]); inSeg.textContent = ''; inSeg.append(h('span', { class: 'sc-full' }, SCOPES[1][1]), h('span', { class: 'sc-short' }, $t('Inside'))); }
    // (the surface: one button that names it and opens a menu of the three, on a laptop as on a phone: the
    // three-way row took 190 px of a head that has 700 at 1024 px)
    const SURF = [['plane', $t('Plane')], ['sphere', $t('Sphere')], ['land', $t('Landscape')], ['stack', $t('Stack')]];
    const surf1 = h('button', { type: 'button', class: 'btn small sv-surf1', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => svSurfMenu() });
    // (short of room the scope's two-way switch folds to one button that names the shown scope and opens a menu of the two)
    const scopeBtn = h('button', { type: 'button', class: 'btn small sv-scope-menu', 'aria-haspopup': 'menu', 'aria-expanded': 'false', onclick: () => svScopeMenu() });
    // (the Stack's view control, shown on the Stack only: 19-stack.js)
    const camSeg = stackSeg('sv-camseg');
    camSeg.hidden = true;
    bar.append(title, cp, scope, scopeBtn, surf1, camSeg);
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
    // (the clear button is the strip's, over the rail's top edge: the rail scrolls and clips what is in it, and inside the band it lay under the plane buttons)
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
    // which a slider's children cannot be (axe nested-interactive))
    thumb.removeAttribute('aria-hidden');
    thumb.setAttribute('role', 'slider'); thumb.setAttribute('tabindex', '0'); thumb.setAttribute('aria-label', $t('Place on the chain'));
    thumb.setAttribute('aria-valuemin', '0'); thumb.setAttribute('aria-orientation', 'horizontal');
    // (the thread's own width too: it grows when the fonts arrive or a name changes, and a stale width left the last
    // plane's node a few pixels under the rail's edge)
    // (the rail's scroll and size are read here, where the layout is clean, so that the follow in svSync only writes)
    {
      const ro = new ResizeObserver(() => {
        const E = SV.els;
        if (!E) return;
        E.scrollX = rail.scrollLeft; E.railBoxW = rail.clientWidth; E.railBoxS = rail.scrollWidth;
        E.centres = null; svFitStrip(); svFitRail(); svSync();
      });
      ro.observe(rail); ro.observe(track);
    }
    // (the observers below fit the head on the next frame (svFitSoon), never in their callbacks: a fit there measures
    // a layout the observers are still reporting, and its fold of the Height key's chip changes a size they observe)
    // (the head's width, as the observer reports it: svFitHead fits the head again when it changes, with no read of its own)
    if (typeof ResizeObserver === 'function') new ResizeObserver((es) => { const E = SV.els; if (!E) return; E.headW = Math.round(es[es.length - 1].contentRect.width); svFitSoon(); }).observe(head);
    // (on a phone the bar sits in the header: its own width, as reported, keys the fit there; fonts that load late re-fit it)
    if (typeof ResizeObserver === 'function') new ResizeObserver((es) => { const E = SV.els; if (!E) return; E.barW = Math.round(es[es.length - 1].contentRect.width); svFitSoon(); }).observe(bar);
    // (the Height key's chip: shown, and its words written, by the legend's draw after the fit may have run; its size
    // changes then, and the head is fitted again. Its fold to the glyph changes its size too, which the fit's key holds)
    const leg = $('leftLegend');
    if (leg && typeof ResizeObserver === 'function') new ResizeObserver(() => svFitSoon()).observe(leg);
    onFontsSettled(() => { svFitRail(); svFitHead(); });
    // (the rail's own scroll, by a wheel, a trackpad or a focus: where the ring is kept in view from, and its fades)
    // (the app's own scrolls of the rail land where it wrote them (svRailTo). Any other scroll is the user's, from a wheel, a trackpad, find
    // in page or a screen reader's reveal alike: until the ring moves, a resize leaves the rail where it is, and a rail left at its end stays
    // at its end. A wheel that moves nothing brings no scroll event, and leaves the rail following. The exception is the browser's own clamp
    // when the rail's size has changed since the last scroll or resize it saw (the event comes before the observer's callback of the same
    // resize): that scroll is never the user's, and is put back where the app wrote it, unless focus is in the rail (a scroll to show the
    // focused control stays). The rail has no touch scroll (touch-action: none))
    rail.addEventListener('scroll', () => {
      const E = SV.els;
      if (!E) return;
      const resized = rail.clientWidth !== E.railBoxW || rail.scrollWidth !== E.railBoxS;
      E.railBoxW = rail.clientWidth; E.railBoxS = rail.scrollWidth;
      E.scrollX = rail.scrollLeft;
      E.atEnd = rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - 1;
      if (!(E.writes && E.writes.some((v) => Math.abs(v - rail.scrollLeft) <= 1))) {
        if (!resized) { E.userScrolled = true; E.writes = null; }
        else if (E.writes && !rail.contains(document.activeElement)) { rail.scrollLeft = E.writes[0]; return; }
      }
      svFades(); svBandSync(E.centres || []);
    }, { passive: true });
    SV.els = { tnote, add, wholeMap, empty, rail, play, loop, band, bandx, speed, rowSpeed, rowLoop, paths, order, orderWhy, pathsWhy, pop, playMore, slider: thumb, bar, head, title, cp, scope, scopeBtn, surf1, camSeg, SURF, SCOPES, strip, track, thumb, prev, next, live, sig: '' };
    svStripWire(strip, track);
    svFSync();
    svPlayHold();
    // (the other way to the sheet, for a screen reader's user who cannot hold: the header's ⋯ menu, which a phone shows)
    const pb = h('button', { type: 'button', class: 'icon-btn sv-playback', popovertarget: 'hdrMenu', popovertargetaction: 'hide', onclick: () => svSheet() }, h('span', { class: 'mlabel' }, $t('Playback…')));
    const sb = $('settingsBtn');
    if (sb && sb.parentNode) sb.parentNode.insertBefore(pb, sb);
  }
  // the strip's planes and steps, rebuilt when the chain changes
  // (a bypassed step keeps its chip, dashed, between the dots it sits between; "+ Add function" ends the thread;
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
    if (!SV.on || !SV.els || SV.offscreen) return;
    svTileSync();
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
      // (the relief's title names its height and the sheets drawn: not the sheets while the stand-in draws the principal branch)
      SV.surf === 'land' ? `${S.height}${S.sheets ? '+' + S.sheetW : ''}${render3D.standIn ? '~' : ''}` : ''].join('|');
    // (the folded key on a phone, a button (legendKeyButton), is named for its kind, set again when the surface changes
    // it. In a pane head the key's own words name it)
    const leg = $('leftLegend'), legName = SV.surf === 'land' ? $t('Height key') : $t('Colour key'), legRole = leg && leg.getAttribute('role');
    if (leg && ph && (legRole === 'button' || legRole === 'img') && leg.getAttribute('aria-label') !== legName) leg.setAttribute('aria-label', legName);
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
      // (the plane's controls: in its head on a desktop, in the header on a phone)
      const home = ph ? $('top') : E.head;
      if (E.bar.parentNode !== home) { if (home === E.head) home.prepend(E.bar); else home.insertBefore(E.bar, $('hdrMoreBtn')); }
      E.title.innerHTML = svFormulaHtml();
      // (on a phone the button is its wheel alone, its words in its label)
      // (the plane the thread is nearest to, as the title's; pressed on the colour plane only: a place parked between two planes is no plane)
      const cpOn = svStage(at) === T && !parked, cpText = cpOn ? $t('Colour plane') : $t('Colour from here');
      E.cp.innerHTML = `<span class="sv-dot"></span><span class="sv-cp-t">${cpText}</span>`;
      E.cp.setAttribute('aria-label', cpText);
      E.cp.setAttribute('aria-pressed', String(cpOn));
      E.cp.classList.toggle('on', cpOn);
      // (a step shown alone: disabled, it is coloured from its own plane; else parked between two planes: off, with the
      // reason, since a place between planes is no plane to colour from)
      E.cp.disabled = !!svAloneOk();
      svDisableWhy(E.cp, !svAloneOk() && parked ? $t('Stop on a plane to colour from it') : '', svAloneOk() ? $t('The step shown alone is coloured from its own plane') : $t('Colour every plane from this one  C'));
      const sname = (E.SURF.find((v) => v[0] === SV.surf) || E.SURF[0])[1];
      const sicon = { plane: MODE_ICONS.image, sphere: MODE_ICONS.sphere, land: MODE_ICONS['3d'], stack: MODE_ICONS.stack }[SV.surf] || '';
      stackSyncControls();
      E.surf1.innerHTML = `<span class="sv-surf-i" aria-hidden="true">${sicon}</span><span class="sv-surf-t">${sname}</span>${ICONS.chevD || ''}`; E.surf1.setAttribute('aria-label', `${$t('Surface')}: ${sname}`); E.surf1.dataset.tip = `${$t('Surface')}: ${sname}`;
      // (the Cauchy style draws everywhere: Inside regions would cut its outside part f₋ off, so the control reads Everywhere and says why it is off)
      const sc = svScope(), cWhy = S.dc === 'cauchy' ? $t('The Cauchy integral is drawn everywhere: its outside part is not cut to regions') : '';
      for (const el of [E.scope, E.sheetScope]) {
        if (!el) continue;
        setSeg(el, sc);
        for (const b of el.querySelectorAll('button')) { /** @type {HTMLButtonElement} */ (b).disabled = !!cWhy; if (cWhy) b.dataset.tip = cWhy; }
      }
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
      // (an empty chain has no place to go: the ring and the speed are off, and the plane says what to do)
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
    // (and, when the thread is longer than its rail, the rail's width and the thread's, and the nodes' height (the
    // ring is centred on a node, clear of its name): measured with the centres)
    if (!E.centres || E.centresSig !== E.sig) {
      const pl = [...E.track.querySelectorAll('.sv-plane')];
      E.centres = pl.map((b) => b.offsetLeft + b.offsetWidth / 2); E.centresSig = E.sig; E.railW = E.rail.clientWidth; E.trackW = E.wholeMap.parentNode === E.rail ? E.rail.scrollWidth : E.track.offsetWidth; E.railLeft = E.rail.offsetLeft; E.scrollMax = E.rail.scrollWidth - E.rail.clientWidth;
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
    // (between two planes the ring is a marker over the thread, above the step's chip)
    const between = Math.abs(x - Math.round(x)) > 0.02;
    if (between !== E.between) { E.between = between; E.thumb.classList.toggle('between', between); }
    // a thread longer than its rail scrolls in it, the ring kept in view a plane's width from either end (a write, no read)
    // (not while the keyboard's focus is on a plane or chip in the rail and nothing moves: Tab scrolled that control in, and
    // the ring's follow would carry the rail back to the ring, leaving the focus out of sight)
    const kf = document.activeElement, keepFocus = !!kf && kf !== E.thumb && E.rail.contains(kf) && kf.matches(':focus-visible') && !SV.anim && !SV.g.moving();
    if (keepFocus) { /* (the rail stays where the focus scrolled it) */ }
    else if (E.trackW > E.railW + 1) {
      // (the rail follows the ring when the ring moves, or a control asks for it (svFollowRing), or the user has not scrolled it
      // since the last follow: a resize alone leaves a rail the user scrolled where it is, its scrollLeft clamped by the browser)
      const key = `${x.toFixed(3)}|${c.length}|${SV.alone}`;
      if (key !== E.followKey || !E.userScrolled) {
        E.followKey = key; E.userScrolled = false;
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
        // (to the rail's real range, scrollWidth - clientWidth, which trackW - railW is not when the whole map sits outside the rail)
        const to = Math.max(0, Math.min(E.scrollMax, Math.round(aim)));
        // (the fades follow at once: the rail's scroll event comes a frame later)
        svRailTo(E, to);
      } else if (E.atEnd) {
        // (a rail the user left at its end stays at its end when its range grows)
        svRailTo(E, E.scrollMax);
      }
    } else {
      // (a rail that fits has no scroll of the user's to keep: it follows the ring again when it overflows)
      E.userScrolled = false; E.atEnd = false;
      svRailTo(E, 0);
    }
  }
  // the thread's ends fade where more of it is out of sight in the rail: from the widths measured with the
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
  // opener: the control that holds the menu, when btn leaves the page as the menu opens (openMenu's items.opener)
  function svChoiceMenu(btn, pairs, cur, label, pick, opener) {
    openMenu(btn, Object.assign(pairs.map(([v, t]) => ({ label: t, radio: true, checked: cur === v, run: () => pick(v) })), { menuLabel: label, focusChecked: true, opener }));
  }
  // the shown plane's surface, 'plane' | 'sphere' | 'land' | 'stack' (the Surface menu's choice and the command palette's), and null outside the steps view
  const svSurface = () => (SV.on ? SV.surf : null);
  // a surface's name as the Surface control reads it: 'Surface: Plane'
  function svSurfaceLabel(v) { return `${$t('Surface')}: ${{ plane: $t('Plane'), sphere: $t('Sphere'), land: $t('Landscape'), stack: $t('Stack') }[v]}`; }
  function svSetSurface(v) { SV.surf = v; if (v === 'sphere') prestartGlobe(); if (v === 'stack') stackChosen(); if (v !== 'plane') svPrestartSoon(300); svApply(); tourEmit('surface-changed', { s: v }); }
  function svSurfMenu() { svChoiceMenu(SV.els.surf1, SV.els.SURF, SV.surf, $t('Surface'), svSetSurface); }
  function svSetScope(v) { SV.scope = v; svPrestartSoon(300); svSync(); requestRender('L'); tourEmit('scope-changed', { s: v }); }
  // the scope switch again, for the phone's Display sheet (the sheet shows it full width; svSync keeps it with the head's)
  function svSheetScope() {
    const el = seg(null, SV.scope, SV.els.SCOPES, svSetScope, $t('Where colour shows'), { cls: 'sv-seg sv-sheet-scope', loop: true });
    SV.els.sheetScope = el;
    svSync();
    return el;
  }
  function svScopeMenu() { svChoiceMenu(SV.els.scopeBtn, SV.els.SCOPES, SV.scope, $t('Where colour shows'), svSetScope); }
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
  // parked between two planes: their stages [a, b], either side of the thread; else null
  function svParkedPair() {
    if (!svParked()) return null;
    const P = svPlanes(), x = SV.g.x;
    return [P[Math.floor(x)], P[Math.min(P.length - 1, Math.ceil(x))]];
  }
  // says text in the steps view's live region (the colour plane set or refused, the place on the chain)
  const svSay = (text) => { if (SV.els && SV.els.live) SV.els.live.textContent = text; };
  function svSetT(k) {
    // (a step shown alone is coloured from its own plane; the button says so, and so does the key)
    if (SV.alone) { svSay($t('The step shown alone is coloured from its own plane')); return; }
    SV.T = k === svPlanes()[svPlanes().length - 1] ? -1 : k;
    svApply();
    save();
    tourEmit('colour-plane-set', { k });
    svSay(svLabel());
    // (the programs a new colour plane needs, started when the page is idle: else they link on the first glide past it,
    // 8 s on WARP for the Mountain King)
    svPrestartSoon(0);
  }
  // the tour's own placing of the view : plane i at once, the colour plane T (an index among the planes; -1 the last), the
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
  // the phone's Sphere key on the plane : in the steps view it toggles the view's surface between Plane and Sphere; null
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
      svOutsideBand(posX(e)); svFollowRing();
      SV.span = null; SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1; svLetGo(true);
    });
    rail.addEventListener('pointermove', (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      if (svRangeMove(d, e, posX)) return;
      if (!d.moved && Math.abs(e.clientX - d.px) < 6) return;
      if (!d.moved) { svPause(false); svKeepView(); SV.anim = null; }
      d.moved = true;
      const x0 = SV.g.x;
      SV.span = null; SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1;
      sndScrub(x0, SV.g.x, SV.g.max);   // (the scrub's detents)
      requestRender('L');
    });
    const up = (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      SV.drag = null;
      if (svRangeUp(d, rail)) { e.preventDefault(); return; }
      if (d.moved) { e.preventDefault(); SV.dragEndT = performance.now(); svLetGo(); sndScrubEnd(); }
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
      // a stalled frame between them delays the handler, not the finger)
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
  // ← → move through the planes, also with a plane focused (a selected shape keeps them to nudge it, with a plane or its row in
  // the Shapes list focused), C makes the shown plane the colour plane (not while typing)
  function svKeys() {
    document.addEventListener('keydown', (e) => {
      if (!SV.on || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = /** @type {HTMLElement} */ (e.target);
      // (Esc brings the whole thread back from a step shown alone, unless a layer is open: its own Esc)
      if (e.key === 'Escape' && SV.alone && !svLayerOpen() && !(t && t.closest && t.closest('input, select, textarea, [contenteditable]'))) { e.preventDefault(); e.stopImmediatePropagation(); svLeaveAlone(true); return; }
      // (on the thread itself, a slider: ← → move a quarter of a step and stop there, Home / End go to z and the last plane)
      const onRail = !!(t && t.classList && t.classList.contains('sv-thumb'));
      // (Shift+← → on the ring: the range, a plane at a time)
      if (onRail && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); e.stopImmediatePropagation(); svRangeExtend(e.key === 'ArrowRight' ? 1 : -1); return; }
      if (onRail && (e.key === 'Home' || e.key === 'End')) { e.preventDefault(); e.stopImmediatePropagation(); svGo(e.key === 'Home' ? 0 : svPlanes().length - 1); return; }
      // (Shift+← → anywhere, or ← → on the thread: a quarter of a step, so the view can stop between two planes)
      // (the keys of a control that has focus, or of an open dialog, menu, popover or sheet, are its own (
      // the classic key handler's exclusions, 14-interaction.js): only the thread's own keys pass)
      if (!onRail && (svLayerOpen() || (t && t.closest && t.closest('[role="listbox"], [role="option"], [role="radiogroup"], [role="radio"], [role="menu"], [role="menuitem"], [role="slider"], [role="dialog"], input, select, textarea, [contenteditable], #propsPanel, .ph-sheet, .cm-palette, #popHost')))) return;
      if ((e.shiftKey || onRail) && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault(); e.stopImmediatePropagation();
        svNudge(e.key === 'ArrowRight' ? 0.25 : -0.25);
        return;
      }
      // (K or M plays and pauses; Esc pauses, or else clears the range. By the Latin letter of the physical key, so
      // that a Russian layout's Л, Ь, З and С work as K, M, P and C)
      const lk = (I18N.keyOf(e) || e.key || '').toLowerCase();
      if ((lk === 'k' || lk === 'm') && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); svTogglePlay(); return; }
      // (P: the paths, as in the classic deformation)
      if (lk === 'p' && !e.shiftKey && SV.els && SV.els.paths && !SV.els.paths.disabled) { e.preventDefault(); e.stopImmediatePropagation(); SV.els.paths.click(); return; }
      if (e.key === 'Escape' && (SV.play || SV.gate || svRange())) { e.preventDefault(); e.stopImmediatePropagation(); if (SV.play) svPause(true); else if (SV.gate) svGateEnd(); else svClearRange(); return; }
      // (PageUp / PageDown on a focused plane too; ← → always step the chain, the sound probe's arrows being Alt / Option +
      // arrow, except while a shape is selected, which they nudge while the focus is on a plane or a row of the Shapes list
      // (14-interaction.js))
      const page = e.key === 'PageUp' || e.key === 'PageDown';
      if (!page && ((selected && /^Arrow(Left|Right)$/.test(e.key) && t && t.closest && t.closest('canvas, #paneL, #paneR, #shapeList')))) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || page) {
        e.preventDefault(); e.stopImmediatePropagation();
        svStep(e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1);
      } else if (lk === 'c' && !e.shiftKey) {
        e.preventDefault(); e.stopImmediatePropagation();
        // (parked between two planes, the key says why it does nothing, as the colour button's reason does)
        if (!SV.alone && svParked()) svSay($t('Stop on a plane to colour from it'));
        else svSetT(svNear());
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
  // The glides out of and into the plane shown made ready at rest, on the plane and the globe, so the first glide links
  // no inverse program and builds no pipeline inside its first frame: on a renderer that links in the main thread and
  // makes a draw's machine code at its first use (SwiftShader, llvmpipe) those hold a first frame 0.5-2.7 s. Each job
  // is one part of a glide (svGlideParts) and takes an idle moment of its own: it asks for the inverse programs of its
  // frame (svInvPaths: the programs svCarryExactHom and svGlobeCarryInv draw with; with KHR_parallel_shader_compile they
  // link in the background, and a later moment looks again), then, on the plane, draws that frame once into the GL
  // canvas, which no pane shows until a frame copies it (svWarmCarry's way). A frame whose first op is a NEWT op is not
  // drawn: its roots pass would keep a float texture of the pane's size a root, which the rest never needs. The jobs start
  // once the rest's own work is done (svReady) and SV_WARM_IDLE_MS have passed since that, since the jobs were queued and
  // since the last input, so a loaded example, an edit or a plane's first frame gets its programs first. The glide on
  // comes first, then the glide back; at most SV_INV_WARM_MAX jobs a rest, so a long chain links nothing more there. Any
  // input puts the job off; anything svInvKey names changing drops the rest, and svPrestart, which runs after such a
  // change, queues them again
  const SV_INV_WARM_MAX = 4;
  // (the jobs left [{b, u, asked}] for what svInvWarmKey names: the chain, the surface, the scope, the colour plane, the
  // colour style and the plane shown; svInvFlushing: a job's frame is still running on the GPU; read by the test hooks;
  // svInvQueuedAt, svInvReadyAt: when the jobs were queued, and since when svReady has read ready, 0 while it does not)
  let svInvJobs = [], svInvWarmKey = null, svInvFlushing = false, svInvQueuedAt = 0, svInvReadyAt = 0;
  // (test hook: no jobs queued while set, and those left dropped; svReady's inverse part, which counts the jobs' glides,
  // built again)
  let svInvWarmOff = false;
  const svInvWarmOffSet = (on) => { svInvWarmOff = !!on; svInvStates = null; if (on) svInvJobs = []; };
  const svInvKey = () => `${chainSig[nSteps()]}|${SV.surf}|${SV.scope}|${svT()}|${S.dc}|${Math.round(SV.g.x)}`;
  // the glides the jobs make ready, [{b, u}]: each part of the glide on and of the glide back, at most SV_INV_WARM_MAX;
  // [] where there are no jobs (the Landscape, which draws no frames between planes: a program linking there would
  // redraw its pane after the pane settled; no inverse programs; the test hook's warmInv: false)
  function svInvGlides() {
    const globe = SV.surf === 'sphere', out = [];
    if (svInvWarmOff || (!globe && !svFlatSurf(true)) || !paneL || !GLR.inverseState || nSteps() < 1) return out;
    const P = svPlanes(), j = Math.max(0, Math.min(P.length - 1, Math.round(SV.g.x)));
    for (const b of new Set([P[Math.min(P.length - 1, j + 1)], P[j]])) {
      if (b && !isDeriv(b)) for (const u of svGlideParts(b)) out.push({ b, u });
    }
    return out.slice(0, SV_INV_WARM_MAX);
  }
  function svPrestartInv() {
    svInvWarmKey = svInvKey();
    svInvJobs = svInvGlides().map((g) => ({ b: g.b, u: g.u, asked: false }));
    svInvQueuedAt = performance.now();
    svInvReadyAt = 0;
    svInvWarmNext();
  }
  // a place in each part of step b's glide whose homotopy has ops of their own kinds (Inverse.homOps): a recognised
  // formula's sub-steps, each one's middle; else the first half and the second (z^-n's power path, then its Möbius path)
  function svGlideParts(b) {
    const n = built[b - 1] && built[b - 1].rec ? built[b - 1].rec.built.length : 0;
    return n > 1 ? [...Array(n).keys()].map((i) => (i + 0.5) / n) : [0.25, 0.75];
  }
  // the inverse programs the frame of step b's glide at u draws its carried colour with, on the globe or the plane: {h (its
  // paths, svInvPaths), sts (GLR.inverseState's arguments, one a path)}, or null when the frame has no inverse pass
  function svInvFrame(b, u, globe) {
    const h = svInvPaths(b, u, globe ? 'globe' : 'flat', { r: null });
    if (!h) return null;
    const carry = svCarryStyle(svT());
    return { h, sts: h.paths.map((p, i) => (globe ? Object.assign({ viewKind: 'globe' }, svInvArg(paneL, p, h.list[i], carry)) : svInvStateArg(h, i, b, u))) };
  }
  // Those of the jobs' glides (svInvGlides), the states svReady's inverse part counts: built once for what svInvListKey
  // names (svPrestartSoon drops them after an edit). Besides what svInvKey names, a state's program depends on the
  // opacity and the sheets (its B class, svCarryAlpha) and on the shapes (which, their kinds, formulas and stages, and
  // whether they show): a list kept past a change of those would count programs no job asks for, and ready would never
  // read true
  let svInvStates = null, svInvStatesKey = null;
  const svInvListKey = () => `${svInvKey()}|${svOpacity()}|${S.sheets ? 1 : 0}|${S.shapes.map((x) => `${x.id}:${x.kind}:${x.expr || ''}:${x.visible === false ? 0 : 1}:${shapeStage(x)}`).join(',')}`;
  function svInvList() {
    const key = svInvListKey();
    if (svInvStates && svInvStatesKey === key) return svInvStates;
    const globe = SV.surf === 'sphere', sts = [];
    for (const g of svInvGlides()) { const f = svInvFrame(g.b, g.u, globe); if (f) sts.push(...f.sts); }
    svInvStatesKey = key;
    return (svInvStates = sts);
  }
  // the next job of svPrestartInv's in an idle moment: its programs asked for, or, once they are ready, its frame drawn.
  // The jobs wait for the rest of svReady (svReady's rest: all but their own part, which waits for them), and while a
  // glide waits for svReady (SV.gate) they take no idle wait: that press asked for the glide they prepare. A job whose
  // programs still link is looked at again every SV_INV_WARM_AGAIN_MS for as long as they take
  const SV_INV_WARM_AGAIN_MS = 250;
  function svInvWarmNext() {
    if (!svInvJobs.length) return;
    const key = svInvWarmKey;
    svIdle(() => {
      if (key !== svInvWarmKey || !svInvJobs.length) return;
      if (key !== svInvKey()) { svInvJobs = []; return; }
      if (interacting() || svGliding()) { setTimeout(svInvWarmNext, SV_INV_WARM_AGAIN_MS); return; }
      const now = performance.now();
      if (!svReady().rest) { svInvReadyAt = 0; setTimeout(svInvWarmNext, SV_INV_WARM_AGAIN_MS); return; }
      if (!svInvReadyAt) svInvReadyAt = now;
      const wait = SV.gate ? 0 : Math.max(svInvQueuedAt, svInvReadyAt, lastInputT) + SV_WARM_IDLE_MS - now;
      if (wait > 0) { setTimeout(svInvWarmNext, Math.max(wait, SV_INV_WARM_AGAIN_MS)); return; }
      const job = svInvJobs[0], globe = SV.surf === 'sphere', T = svT();
      const f = svInvFrame(job.b, job.u, globe), h = f && f.h;
      let next = 0;
      if (!f) svInvJobs.shift();
      else if (!job.asked) { GLR.inverseWarmup(f.sts, { start: true }); job.asked = true; }
      else {
        const st = f.sts.map((x) => GLR.inverseState(x));
        if (st.includes('pending')) next = SV_INV_WARM_AGAIN_MS;
        else {
          svInvJobs.shift();
          // (the frame's commands flushed, and the next job only once the GPU has run them (GLR.gpuDone's fence, polled,
          // never waited on): left in the queue they would run in the first glide frame's copy to its pane)
          if (!globe && st.every((x) => x === 'ready') && !h.paths.some((q) => q.inv && q.inv.nr)) {
            let drawn = false;
            const warmFrame = { open: false };
            try { drawn = svDrawInverse(paneL, h.list, h.paths, T, warmFrame, job.u, null, null, job.b) === 'drawn'; } catch (e) { drawn = false; }
            // (and the outlines over it, into the same frame, which no pane shows: the first glide frame would build
            // their pass's scratch and pipeline otherwise)
            if (drawn && !SV.bare) { try { svOutlines(paneL, svBetween(svPlanes().indexOf(job.b) - 1 + job.u).map, warmFrame, false); } catch (e) { /* the glide frame draws them */ } }
            if (drawn && GLR.gpuDone) { svInvFlushing = true; GLR.gpuDone().then(() => { svInvFlushing = false; svInvWarmNext(); }); return; }
          }
        }
      }
      if (next) setTimeout(svInvWarmNext, next); else svInvWarmNext();
    });
  }
  // the programs a glide draws with, started without waiting (KHR_parallel_shader_compile): the homotopy
  // maps' (mode 1) and the carried colour's pre-mapped mesh, and its GPU programs; at start-up, when the chain changes
  // and when the thread arrives at another plane (the glides of that plane, svPrestartInv)
  function svPrestart() {
    try {
      if (!GLR.ok) return;
      if (GLR.prestartModes) GLR.prestartModes([1]);
      // (perf on #448: the programs keyed by the map that the first glide linked synchronously)
      if (GLR.prestartNames) GLR.prestartNames(['region0', 'regionC', 'regionP', 'line0', 'lineC', 'tfRegion', 'tfLine', 'color', 'pre'], [0, 1]);
      if (GLR.prestart) GLR.prestart(['regionP', 'keepA']);
      // (the Landscape shown: its glide's carry, the moved grid (landCarryTF), its normals and surface, the sheets'
      // places under All sheets, and the floor's carried outlines (lineFC); its heights and the rest frame are mode 0's)
      if (SV.surf === 'land') {
        if (GLR.prestartNames) GLR.prestartNames(['landCarryTF', 'landCarry'].concat(S.sheets && multiSheet() ? ['landCarryPlace'] : []), [1]);
        // (All sheets on a multivalued chain: the sheets' programs, which the carried glide's first frame draws the sheets with
        // in map mode 0, landSheetC for the linear heights (Re, Im) alone; started at rest, so that frame links none and
        // svReady counts them)
        if (GLR.prestartNames && S.sheets && multiSheet()) GLR.prestartNames(['landSheetTF', 'landSheet'].concat(S.height === 're' || S.height === 'im' ? ['landSheetC'] : []), [0]);
        if (GLR.prestart) GLR.prestart(['landCarryNrm', 'lineFC']);
      }
      // (the region meshes' carried colour, the glide's own: the map cache's places and the cut fill, then drawn once:
      // svWarmCarry; the programs at rest link at their first use, the glide's programs at its end drawn until then)
      if (GLR.prestartCarry) GLR.prestartCarry();
      // (the Cauchy style's variants, CARRY_CAUCHY: the carried meshes' and the pre-mapped mesh's at rest and in the glide, so a
      // plane past z at rest has them when the thread arrives, while its inverse program links)
      if (S.dc === 'cauchy' && GLR.prestartNames && GLR.carryNames) GLR.prestartNames(GLR.carryNames(false, true).concat(['regionPKZ']), [0, 1]);
      svPrestartInv();
      svWarmCarry(0);
      svPolesWatch();
    } catch (e) { /* (the first glide starts them) */ }
  }
  // The WebGL context was restored (GLR.onRestore): every program, mesh and texture the steps view kept went with the
  // lost context. Its polar meshes are forgotten (their buffers are dead, so not destroyed), and so are the ring sizes
  // and the carried meshes the idle job made, so it makes them again with their meshes and textures; the warm draw is
  // made again, and the prestart runs again, so svReady counts the restored context's programs and reads ready once
  // they have linked
  function svContextRestored() {
    svPolarRes.clear();
    svRingSizes.clear();
    svRingMemo = null;
    svMeshDone = null;
    svWarmSig = null;
    svPrestartSoon(0);
  }
  // svPrestart again once the edits have stopped for `ms` (a chain or a shape edited, an example, a link, an undo), in an
  // idle moment: a drag or typing is never held back by it, and a run of edits starts it once
  let svPrestartTimer = 0;
  function svPrestartSoon(ms) {
    svInvStates = null;
    clearTimeout(svPrestartTimer);
    svPrestartTimer = setTimeout(() => {
      svPrestartTimer = 0;
      if (interacting()) { svPrestartSoon(250); return; }
      (window.requestIdleCallback || setTimeout)(svPrestart);
    }, ms);
  }
  // a program of the main panes landed (GLR.onReady) and the left pane has drawn no frame since (svDrawPlane clears it)
  let svRedrawDue = false;
  // How much of what a glide of the current chain needs is ready: {done, total, parts, ready}. parts: the chain's
  // programs linked (both map modes, the carried colour and its cut fills, the glide's map mode of the programs the
  // panes draw, which the warm-up starts in the init part (WARM's first group, in the same modes), any inverse one
  // still compiling), the carried colour's warm draw made, the idle jobs finished (the pole tracks, the outer ring, the
  // meshes), with M (the motion the gate is about to start) the frames it may draw ahead (svAheadPart), and the inverse
  // programs of the glides a press starts linked while the thread rests on a plane (inverse: svInvList, which
  // svInvWarmNext's jobs ask for; their first draw is the jobs' own, and a cold program is drawn by the glide's frame,
  // svLinkHold; no part while a frame is held between planes or a glide runs); while a pane's last frame had a REPT
  // draw still drawing its tiles (__cmwPaneStatus's rept), that draw as a part not done; while svRedrawDue, the left
  // pane's frame that draws with the program that landed, a part not done. The programs of a view no pane shows are no
  // part of it (GLR's offView). The warm draw, the REPT draw and the redraw are parts with nothing counted inside them,
  // one unit done or not, marked whole (the Play gate's ring shows them as unknown, svGateFill). total is 0 only while
  // the GPU layer or the chain is not up; ready is true only when done = total > 0; rest: the same without the inverse
  // part. Programs counted that no job asks for any more (the jobs were dropped when what svInvKey names changed, or a
  // program was evicted after its job) are queued again, unless peek (a read that starts no work: the test hook's)
  // (test hooks: the idle jobs count as unfinished while svJobsHold is set, the warm draw while svWarmHold is)
  let svJobsHold = false, svWarmHold = false;
  const svJobsHoldSet = (on) => { svJobsHold = !!on; };
  const svWarmHoldSet = (on) => { svWarmHold = !!on; };
  function svReady(M, peek = false) {
    const parts = {};
    if (!GLR.ok || !GLR.progStatus || !SV.on || nSteps() < 1) return { done: 0, total: 0, parts, ready: false };
    parts.programs = GLR.progStatus(S.homAll ? [3] : [1]);
    parts.warm = { done: !svWarmHold && svWarmSig === chainSig[nSteps()] ? 1 : 0, total: derivIn(0, 1) ? 0 : 1, whole: true };
    let jobs = 0;
    try { jobs = (svPolesLeft() ? 1 : 0) + (svRingLeft() ? 1 : 0) + (svMeshNext() ? 1 : 0); } catch (e) { jobs = 0; }
    if (svJobsHold) jobs = 3;
    parts.jobs = { done: 3 - jobs, total: 3 };
    if (['L', 'R'].some((r) => paneGl[r] && paneGl[r].rept)) parts.rept = { done: 0, total: 1, whole: true };
    if (svRedrawDue) parts.redraw = { done: 0, total: 1, whole: true };
    // (M: the motion the gate is about to start, whose frames may be drawn ahead once all else is ready, svAheadPart)
    const ahead = M ? svAheadPart(M) : null;
    if (ahead) parts.ahead = ahead;
    let done = 0, total = 0;
    for (const k in parts) { done += parts[k].done; total += parts[k].total; }
    const rest = total > 0 && done === total;
    // (the inverse part only while the thread rests on a plane: its glides are the ones a press starts from there. A frame
    // held between planes, or a glide under way, is ready when its own programs are, which its frame asks for itself)
    if (!svMoving()) {
      let inv = { done: 0, total: 0 };
      try { inv = GLR.inverseWarmup ? GLR.inverseWarmup(svInvList()) : inv; } catch (e) { svInvStates = []; }
      parts.inverse = inv;
      if (!peek && inv.done < inv.total && !svInvFlushing && (!svInvJobs.length || svInvWarmKey !== svInvKey())) svPrestartInv();
      done += inv.done;
      total += inv.total;
    }
    return { done, total, parts, ready: total > 0 && done === total, rest };
  }
  // The glide's carried colour drawn once on a speck (SV_WARM's mesh, at x = 1/2 of the first step) into the GL canvas,
  // which no pane shows until a frame copies it: a renderer that makes a program's machine code at its first draw
  // (SwiftShader, llvmpipe) makes it then, in an idle moment, not in the first frame of the first glide, whose clock
  // would run on past that stall and end it. The idle moment is SV_WARM_IDLE_MS after the chain changed and after the
  // last input (lastInputT): that machine code takes the main thread for a second or more on such a renderer, which
  // just after an edit holds back what the edit shows (the "Added" message). Tried again while the programs link
  // (prestartCarry), for as long as they take (svWarmWhenIdle); the programs themselves link without waiting
  // (prestartCarry, the parallel compile)
  const SV_WARM = { id: '__svWarm', kind: 'disc', c: [0, 0], r: 0.01, visible: true }, SV_WARM_IDLE_MS = 2000;
  // f in an idle moment of the idle warm-ups (svWarmCarry, svInvWarmNext): run after SV_IDLE_CB_MS at the latest, or, with
  // no requestIdleCallback, SV_IDLE_FALLBACK_MS from now
  const SV_IDLE_CB_MS = 1000, SV_IDLE_FALLBACK_MS = 250;
  const svIdle = (f) => (window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: SV_IDLE_CB_MS }) : setTimeout(f, SV_IDLE_FALLBACK_MS));
  // svWarmWhenIdle's attempts: at most SV_WARM_TRIES unfinished ones made with no program linking, the next one
  // SV_WARM_RETRY_MS after an unfinished one, and a wait for input to stop looked at again after at least SV_WARM_POLL_MS
  const SV_WARM_TRIES = 40, SV_WARM_RETRY_MS = 500, SV_WARM_POLL_MS = 250;
  // Runs step() in an idle moment (svIdle), SV_WARM_IDLE_MS after t0 and after the last input, if the chain is still the
  // one it was asked for and nothing is being dragged or typed (looked at again when the idle callback runs); step() is
  // true when its work is done. Else again runs SV_WARM_RETRY_MS later: again(n, t0) while a program links (GLR.pendingLinks:
  // the work waits for it, however long the link takes, and a part of svReady that waits for the work cannot stay short
  // after it lands), else again(n + 1, t0). A wait for input to stop calls again(n, t0) after at least SV_WARM_POLL_MS
  function svWarmWhenIdle(again, n, t0, step) {
    const sig = chainSig[nSteps()];
    const wait = () => Math.max(t0, lastInputT) + SV_WARM_IDLE_MS - performance.now();
    const waitMore = () => { setTimeout(() => { if (chainSig[nSteps()] === sig) again(n, t0); }, Math.max(wait(), SV_WARM_POLL_MS)); };
    if (wait() > 0 || interacting()) { waitMore(); return; }
    svIdle(() => {
      if (chainSig[nSteps()] !== sig) return;
      if (wait() > 0 || interacting()) { waitMore(); return; }
      if (step() !== true) { const linking = GLR.pendingLinks > 0; setTimeout(() => again(linking ? n : n + 1, t0), SV_WARM_RETRY_MS); }
    });
  }
  let svWarmSig = null, svWarmAt = 0;
  // (the chain whose warm draw waits for its fence: a second call meanwhile draws it no second time)
  let svWarmFlushing = null;
  // (t0: when the chain changed, as svPrestart saw it)
  function svWarmCarry(n, t0 = performance.now()) {
    const sig = chainSig[nSteps()];
    if (svWarmSig === sig || svWarmFlushing === sig || n > SV_WARM_TRIES || !GLR.ok || !GLR.drawRegion || nSteps() < 1 || derivIn(0, 1)) return;
    svWarmWhenIdle(svWarmCarry, n, t0, () => {
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
      if (!done) return false;
      // (made once the GPU has run the draw's commands (GLR.gpuDone's fence, polled, never waited on): left in the
      // queue of the GL canvas, which no pane shows, they would run in the next copy of that canvas to a pane, the
      // first glide frame's, and that frame would wait for the carried colour's machine code after all)
      const made = () => { svWarmFlushing = null; if (chainSig[nSteps()] === sig) { svWarmSig = sig; svWarmAt = performance.now(); } };
      svWarmFlushing = sig;
      if (GLR.gpuDone) GLR.gpuDone().then(made); else made();
      return true;
    });
  }
  // ---- play along the thread (#438): ▶, Loop, the range ----
  // The speed is the steps view's setting (SV.speed, saved as S.sv.speed), one for glide and play: the time a plane. ▶ glides on from the shown place to the
  // range's end (or the last plane) in a straight line, with no stop at the planes; Loop starts over at the range's start
  // (or z), on the Landscape too (its sheets glide, svLandMoving). Reduced motion steps a plane at a time instead (2 s,
  // with the live region saying each plane).
  const svPerPlane = () => SV_SPEEDS[SV.speed] || 900;
  // the range a…b (S.homRange: steps a…b are the band from w_{a−1} to w_b) as planes {lo, hi}, or null; the plane at or
  // before a stage
  const svIdxAt = (s) => { let r = 0; svPlanes().forEach((k, i) => { if (k <= s) r = i; }); return r; };
  function svRange() {
    // (none while a step is shown alone: the range maps onto the whole chain's planes, and the thread has two; it is kept in the
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
    const E = SV.els, on = !!SV.play, waits = svWaitOn(E.play), label = waits ? $t('Cancel') : on ? $t('Pause') : $t('Play');
    // (the pause is two bars, drawn: no glyph of the bundled faces)
    if (E.play.dataset.on !== String(on) && !waits) { E.play.dataset.on = String(on); E.play.textContent = ''; if (on) E.play.append(h('span', { class: 'sv-bar' }), h('span', { class: 'sv-bar' })); else E.play.textContent = '▶'; }
    E.play.setAttribute('aria-label', label);
    E.play.setAttribute('data-tip', `${label}  K`);
    // (a plain button, Cancel, while the press waits: a "not pressed" toggle named Cancel would be read as one)
    if (waits) E.play.removeAttribute('aria-pressed'); else E.play.setAttribute('aria-pressed', String(on));
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
  // ▶, K and M: a play pauses; a wait on ▶ is cancelled; a wait on another control (an arrow's) ends and the play waits
  // instead, as svGo does for an arrow pressed while ▶ waits
  function svTogglePlay() {
    if (SV.play) { svPause(true); return; }
    if (SV.gate) { const same = SV.gate.btn === SV.els.play; svGateEnd(); if (same) return; }
    svPlay();
  }
  // The steps view's CPU caches of the chains (pole tracks, ring sizes and ring, the polar mesh results) are dropped
  // when the chain is discarded (opening an example or a new scene discards it)
  function svDiscardCaches() {
    svPoleMemo.clear(); svPoleLast.clear(); svRingSizes.clear(); svRingMemo = null; svPolarRes.clear();
  }
  // the play's schedule from where the view is: { start, end (the range's ends), x (where it is), from (where it plays from) }
  function svPlayFrom() {
    const P = svPlanes(), R = svRange(), start = R ? R.lo : 0, end = R ? R.hi : P.length - 1, x = SV.anim ? SV.anim.to : SV.g.x;
    // (at the end, or past it: from the start)
    return { start, end, x, from: x >= end - SV_REST_U ? start : x };
  }
  function svPlay() {
    if (SV.play || svPlanes().length < 2) return;
    // (from rest, its frames may be drawn ahead while it waits; resumed where a play paused on frames drawn ahead, it goes
    // on with that play's schedule and frames)
    const R = svAhead, q = svPlayFrom();
    const resume = R && R.paused && R.state === 'done' && Math.abs(SV.g.x - R.paused.x) < 1e-12 && R.key === svAheadKey(paneL, R.M) ? { M: R.M, el: R.paused.el } : null;
    const M = SV.anim || svReduced() ? null : resume ? resume.M : { from: q.from, to: q.end, ms: svPerPlane() * (q.end - q.from), eased: false, span: svSpanOf(q.from, q.end) };
    if (svAhead && (!M || svAhead.key !== svAheadKey(paneL, M))) svAheadDrop();
    if (svAhead) svAhead.paused = null;
    svGated(SV.els.play, () => svPlayNow(resume), M);
  }
  // the live region's words for a play to plane index end, from the plane the thread is near
  const svPlayWords = (end) => $t('Playing from {a} to {b}', { a: svName(svNear()), b: svName(svPlanes()[end]) });
  // (resume: { M, el }, a play paused on frames drawn ahead, which goes on at el ms into its schedule M)
  function svPlayNow(resume) {
    const P = svPlanes();
    if (P.length < 2 || SV.play) return;
    const { start, end, x, from } = svPlayFrom();
    svKeepView();
    SV.anim = null; SV.g.set(x); SV.g.max = P.length - 1;
    draft = null; probe = null;
    if (svReduced()) {
      SV.g.set(Math.round(from));
      SV.play = { slide: true, start, end, timer: 0, steps: S.steps };
      svSlide(true);
    } else if (resume) {
      SV.span = resume.M.span;
      SV.play = { from: resume.M.from, to: resume.M.to, start, t0: 0, ms: resume.M.ms, steps: S.steps };
      svSetElapsed(SV.play, resume.el);
    } else {
      SV.g.set(from);
      SV.span = svSpanOf(from, end);
      SV.play = { from, to: end, start, t0: performance.now(), ms: svPerPlane() * (end - from), steps: S.steps };
    }
    svSync();
    requestRender('L');
    tourEmit('play-started', { from: Math.round(SV.g.x) });
    if (SV.els.live) SV.els.live.textContent = svPlayWords(end);
    sndMorphStart();   // (the play's swell; its arrival is at the play's own end)
    const A = SV.play;
    if (!A.slide) svAheadStart({ from: A.from, to: A.to, ms: A.ms, eased: false, span: SV.span });
  }
  // a slide's time on each plane (ms)
  const svSlideMs = () => (svReduced() ? 2000 : svPerPlane());
  // a plane a tick (the landscape and reduced motion): the first tick shows the plane the press was on
  function svSlide(first) {
    const A = SV.play;
    if (!A || !A.slide) return;
    if (S.steps !== A.steps) { svPause(false); svCheck(); requestRender('L'); return; }
    const i = Math.round(SV.g.x);
    if (!first) {
      if (i >= A.end) { if (!SV.loop) { svPause(true); sndMorphArrive(svPerPlane() / 1000); if (SV.els.live) SV.els.live.textContent = $t('Stopped at {p}', { p: svName(svStage()) }); return; } SV.g.set(A.start); } else SV.g.set(i + 1);
      SV.i = Math.round(SV.g.x);
      svApply();
      if (SV.els.live) SV.els.live.textContent = svLabel();
    }
    A.timer = setTimeout(() => svSlide(false), svSlideMs());
    svSync();
  }
  // one frame of the glide: a straight line in x; the plane the picture is nearest to is the shown one (the view's
  // kind follows it, as at a plane's arrival), and at the end it stops, or starts over
  function svPlayFrame() {
    // (SV.clock, a test hook's: the play's time advances that many ms a frame, as a glide's, so a suite reads its speed in the
    // frames drawn however long each takes)
    const A = SV.play;
    // (another chain loaded under the play, an example, a link or an undo: it stops, and the new state's view is adopted)
    if (S.steps !== A.steps) { svPause(false); svCheck(); requestRender('L'); return false; }
    // (held: it does not move while it waits, svLinkHold)
    if (A.held) { dirty.L = true; return true; }
    const now = performance.now(), v = Math.min(1, (SV.clock ? (A.el = (A.el || 0) + SV.clock) : now - A.t0) / A.ms);
    SV.g.set(A.from + (A.to - A.from) * v);
    // (a crossing mid-play writes the head and the live region only: svApply's layout and lists wait for the stop, as a glide's
    // wait for its arrival (perf on #460: a flip through svApply was a 111–168 ms frame of forced layout))
    const r = Math.round(SV.g.x);
    // (a play's note goes with the words of its stop, which stay; a loop has none, and says it with the words of its first crossing
    // drawn. A.label: the live region's words for the crossing, written when the frame is drawn (svMotionDrawn), not when a hold
    // starts in this frame: the region then stays on the held place's words, svLinkHold)
    if (r !== SV.i && v < 1) { SV.i = r; A.label = svLabel(); }
    dirty.L = true;
    svSync();
    if (v < 1) return true;
    if (SV.loop && A.to > A.start) { A.from = A.start; A.t0 = now; A.el = 0; A.held = A.drawn = null; A.ms = svPerPlane() * (A.to - A.start); SV.span = svSpanOf(A.start, A.to); SV.g.set(A.start); SV.i = A.start; svSync(); return true; }
    SV.play = null;
    // (the note of the play's start goes with the words of its stop, not the arrival's they replace)
    const note = svAheadNote;
    svAheadNote = null;
    svArrive();
    sndMorphArrive(svPerPlane() / 1000);   // (the arrival, at a play's own end only: never on a loop's repeat)
    if (SV.els.live) SV.els.live.textContent = svAheadTail($t('Stopped at {p}', { p: svName(svStage()) }), note);
    svSync();
    return false;
  }
  // the least span, in planes, that a play given a new speed is timed over: one switched at its last plane still takes a
  // moment, not 0 ms
  const SV_REBASE_MIN_SPAN = 0.05;
  // a new speed while it plays: from here on at it
  function svPlayRebase() {
    const A = SV.play;
    if (!A || A.slide) return;
    A.from = SV.g.x; A.t0 = performance.now(); A.el = 0; A.ms = svPerPlane() * Math.max(SV_REBASE_MIN_SPAN, A.to - A.from); A.drawn = null;
    // TEST-HOOK (dropped from the published page by build.py)
    // the schedule this rebase set, kept after the play ends (__cmwSteps().rebased)
    SV.rebased = { from: A.from, to: A.to, ms: A.ms, t0: A.t0 };
    // TEST-HOOK
    // (held: it waits at the place it starts from now)
    if (A.held) A.held.el = 0;
  }
  // stop: settle where it is (a plane near, or parked between two), as a scrub let go; quiet: another move took over
  function svPause(settle) {
    const A = SV.play;
    if (!A) return;
    SV.play = null;
    svHoldWaitEnd(false);
    if (A.slide) clearTimeout(A.timer);
    // (a play on frames drawn ahead keeps them, and where it paused, for a resume: svPlay)
    const R = svAhead && svAhead.A === A ? svAhead : null;
    if (R) R.paused = { el: svElapsed(A), x: NaN };
    // (parked between two planes, the full apply the crossings skipped is done now, once)
    if (settle) { if (A.slide) { svArrive(); } else { svLetGo(); if (svParked()) svApply(); } }
    if (R && svAhead === R) R.paused.x = SV.g.x;
    if (svAheadProbeM) svAheadProbe();
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
    // (the root says it when the page opened the classic views: rules for them cannot reach the steps view while it starts)
    if (!SV.on) { document.documentElement.classList.add('classic'); return; }
    document.documentElement.classList.add('sv');
    setFocusStep(0);
    svBuild();
    svEdgeSwipe();
    svKeys();
    SV.g.set(0); SV.g.max = svPlanes().length - 1;
    if (!svLoad(true)) svAdopt();
    SV.ready = true;
    svApply();
    // (#leftLegend carries a label: an image's, for axe's aria-prohibited-attr)
    const legend = $('leftLegend');
    if (legend && !legend.getAttribute('role')) legend.setAttribute('role', 'img');
    svPrestartSoon(1500);
  }

  // ---- chain editing on the thread ----
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
    SV.lastSplit = { k, n, j, pre: svStepsSig() }; SV.lastUnsplit = null;   // (pre: the chain before the Split, which only its Undo restores)
    SV.own = true;   // (an edit of the chain, not another chain loaded: svChainChanged keeps the planes it shows)
  }
  function svSplitApply(sp) {
    const r = Funcs.splitSvPlace({ x: sp.x, rest: sp.rest, T: SV.T, alone: SV.alone, back: SV.alone ? SV.back : null }, sp.k, sp.n, sp.j);
    SV.T = r.T; SV.alone = r.alone; SV.back = r.back;
    SV.g.max = svPlanes().length - 1;
    if (!SV.alone && sp.rest) { SV.g.set(r.x); SV.i = Math.max(0, Math.min(SV.g.max, Math.round(r.x))); }
    if (SV.lastSplit) SV.lastSplit.sig = svStepsSig();   // (the split chain, which only that Split's Redo restores)
    if (sp.moving) svRemapMotion((x) => Funcs.splitSvPlace({ x, rest: true, T: -1, alone: 0, back: null }, sp.k, sp.n, sp.j).x, (st) => svStepTSplit(st, sp.k, sp.n));
  }
  // the undo of a split under way: the unit [j, j+n) of the n new steps is the formula's [j, j+1) again
  function svUnsplitApply(sp) {
    const { j, n } = sp, pl = (x) => (j < 0 || !(x >= j) ? x : x < j + n ? j + (x - j) / n : x - n + 1);
    SV.T = SV.T < 0 || SV.T < sp.k ? SV.T : SV.T < sp.k + n ? sp.k : SV.T - n + 1;
    SV.g.max = svPlanes().length - 1;
    svRemapMotion(pl, (st) => svStepTJoin(st, sp.k, n));
  }
  // a glide or a play under way after the planes changed (pl: the old place on the thread -> the new one): it goes on from the
  // same place, to the same destination, with no jump. A glide keeps its ease's progress and its time; a play keeps the time
  // it has left, so the picture's speed goes on; a reduced-motion play (a plane a tick) is remapped to its planes.
  // All at once: the glide's progress u in its span is what the picture is a function of, so u is kept, not the place; the
  // span's step times (stepT, retime: the old ones -> the new) run the steps a Split made of a formula as that formula's
  // own homotopy runs them (svBetween), so the picture is the same at the same u, through any number of Splits and their
  // undos and redos. They last to the end of this glide
  function svRemapMotion(pl, retime) {
    const A = SV.anim, B = SV.play, x = SV.g.x, last = svPlanes().length - 1, cl = (v) => Math.max(0, Math.min(last, v));
    SV.motionKept = true;
    const aim = SV.g.moving() ? SV.g.target : null;
    const sp = SV.span;
    let span = null, nx = cl(pl(x));
    if (sp) {
      const x0 = cl(pl(sp.x0)), x1 = cl(pl(sp.x1));
      if (x1 > x0 && svAllOk(x0, x1)) {
        span = { x0, x1 };
        const stepT = retime ? retime(sp.stepT || null) : sp.stepT;
        if (stepT) span.stepT = stepT;
        nx = x0 + (x - sp.x0) / (sp.x1 - sp.x0) * (x1 - x0);
      }
    }
    SV.g.set(nx);
    if (aim != null) SV.g.to(cl(pl(aim)));
    if (A) {
      const el = svElapsed(A), v = Math.min(1, el / A.ms);
      A.e0 = v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
      A.from = SV.g.x; A.to = cl(pl(A.to)); A.held = null; A.drawn = { at: A.from, el };
    }
    if (B) {
      B.steps = S.steps;
      if (B.slide) { B.start = cl(pl(B.start)); B.end = cl(pl(B.end)); } else {
        const left = B.ms * (1 - Math.min(1, svElapsed(B) / B.ms));
        B.from = SV.g.x; B.to = cl(pl(B.to)); B.start = cl(pl(B.start)); B.t0 = performance.now(); B.el = 0; B.ms = Math.max(1, left); B.held = null; B.drawn = { at: B.from, el: 0 };
      }
    }
    if (sp) SV.span = span;
    SV.i = cl(pl(SV.i));
    leftChanged();
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
  // a message for an edit made on the thread (a toast would take the rail for it and hide the thread, with the focus on it): none on a
  // desktop. It is said in the live region; Undo stays in the top bar's Undo button and Ctrl+Z; the focus stays on its chip
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
    // (Repeat × N)
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
  }
  // one after another <-> all at once; morph.T goes to the end of the new range of t
  function setHomAll(all) {
    setOpt('homAll', !!all);
    morph.T = morphLen();
    scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); save();
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
    svRailTo(E, to, s);
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
    const more = h('button', { type: 'button', class: 'sv-more', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-tip': $t('More'), 'aria-label': $t('More for f{x} {name}', { x: sub(k), name }), html: ICONS.more,
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
