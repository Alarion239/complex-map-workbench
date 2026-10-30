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
      // ([#240] a field's bound letters, a series' n, a recurrence's u, are its own: never new numbers)
      const bound = el.dataset.bound ? el.dataset.bound.split(',') : [];
      const u = Params.unknownIn(el.value, { bound });
      if (!u.length) return;
      if (u.length > 1) { sndError(); toast($t('One new name at a time: {x}', { x: u.map(Params.display).join(', ') })); return; }
      const c = Params.check(u[0], { bound });
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
  // (#385) init() is the start-up: the area wiring is in its area's part, as a setup…() called here at the point the
  // start-up had it (the order of the listeners and the layout's reads), so a change to one area's wiring runs that
  // area's shards (ci/impact.js); new wiring goes there too (test/t_init_wiring.js)
  function init() {
    SoundHooks.init(soundHooksApi());   // the sound hooks (src/soundhooks.js), before anything can make a sound
    Export.init(exportApi());   // export and captions (src/export.js)
    MorphPaths.init(morphPathsApi());   // the deformation's paths (src/morphpaths.js)
    Integrals.init(integralsApi());   // the integrals (src/integrals.js)
    Examples.init(examplesApi());   // the examples and the guide (src/examples.js)
    // TEMP-DEBUG-HOOK (removed before publishing)
    // (v15: the quality and perf suites keep the v14 pane geometry, a 272 px chain, from the first layout on, so no
    // canvas is ever sized for the taller planes; setupGutters applies it again after a stored height)
    if (window.__cmwChainH > 0) document.documentElement.style.setProperty('--chain-h', window.__cmwChainH + 'px'); // TEMP-DEBUG-HOOK
    // i18n (notes/i18n/DESIGN.md 2): English does nothing here
    I18N.applyPage();
    I18N.applyStatic($('app'));
    // the command field shows the short form (DESIGN.md 8.3); its aria-label keeps the whole phrase
    // (and «Поиск» where the header is short of room: page.html, review ui-9)
    if (I18N.lang !== 'en') { const ct = document.querySelector('#cmdBtn .cmd-text'); if (ct) { ct.textContent = ''; ct.append(h('span', { class: 'ct-l' }, $tx('field', 'Add function')), h('span', { class: 'ct-s' }, $tx('field-short', 'Add function'))); } }
    I18N.reveal();
    // the switch reloads only when the work was written and reads back (review i18n-3); while a tour holds the canvas
    // the saved state is the user's own work, and the tour's scenes are never stashed as undo history
    I18N.onSwitch(() => {
      const held = tourHold;
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
    // before, so they do not delay the first image or an inverse program (its compile waits for forward programs).
    // (issue #72) Then, one group at a time, each once the one before has landed and the user has paused for a second,
    // the globes' and the Landscape's: a cold link on Direct3D 11 takes seconds, and the browser keeps the programs for
    // later visits. Each group starts only the programs not started yet.
    let modesT = 0, warmI = 0;
    const WARM = [() => GLR.prestartModes(S.homAll ? [3] : [1]), () => prestartGlobe(), () => GLR.prestartLand()];
    const warmNext = () => {
      try {
        if (!GLR.ok || !GLR.prestartModes || warmI >= WARM.length) return;
        // (no group starts while the user is active: the first after 300 ms of quiet, the later ones after a second)
        if (GLR.compiling || performance.now() - lastInputT < (warmI ? 1000 : 300)) { modesT = setTimeout(warmNext, 400); warmKick(); return; }
        WARM[warmI++]();
        modesT = setTimeout(warmNext, 400);
        warmKick();
      } catch (e) { /* the views start them */ }
    };
    // (the bar reads which group the driver is in: 'modes', 'globe', 'land', then 'done')
    warmDriver = { finished: () => warmI >= WARM.length, phase: () => (warmI >= WARM.length ? (GLR.compiling ? 'land' : 'done') : ['modes', 'globe', 'land'][Math.max(0, warmI - 1)]) };
    const prestartModesIdle = () => { clearTimeout(modesT); warmI = 0; modesT = setTimeout(warmNext, 400); };
    GLR.onReady = (w) => {
      // an inverse program that landed is warmed first, at once unless something moves (scheduleWarm)
      if (GLR.inverseColdWaiting) scheduleWarm(0);
      // (thumbnails too: one drawn forward before an inverse program landed is redrawn; the others hit their cache)
      if (!w || w.main) { requestRender('L', 'R'); requestRender('T'); prestartModesIdle(); }
      warmKick();
      if ((!w || w.side) && exWait.size) retryExampleThumbs();
    };
    setTheme(themePref()); // before the first readTheme, so canvases start in the saved theme
    GLR.setPalette(palPref());
    readTheme();
    paneL = new Pane($('canvasL'), $('overlayL'));
    paneR = new Pane($('canvasR'), $('overlayR'));
    warmKick();
    const loaded = load();
    setState(loaded || blankState());
    if (!Array.isArray(S.params)) setParams([]);
    attachParams();
    bindsAll();
    dockPref.L = !!S.hideLeft; dockPref.R = !!S.hideRight;
    // narrow windows start with the drawers closed (run-time only: save() writes dockPref)
    if (isDrawer('R')) setHidden('R', true);
    if (isDrawer('L')) setHidden('L', true);
    // (v15, 1024 to 1279: one panel docks; the Inspector when the chain has steps, the tools on an empty canvas)
    if (oneDock()) { if (S.steps.length) { setHidden('L', true); setHidden('R', false); } else { setHidden('L', false); setHidden('R', true); } }
    if (S.clipWin) clipWin = S.clipWin;
    paneL.resize(); paneR.resize();
    paneL.setView(S.srcView);
    // (v16 review picture-1) a saved state without its window (older saves, hand-made states) meshes and samples in
    // the window of its view, as a scene opened from a file does, never in a fixed -4…4 that a deep view lies inside
    if (!S.clipWin && S.srcView && Number.isFinite(S.srcView.s) && S.srcView.s > 0) { const vb = viewBox(S.srcView); if (goodWin(vb)) { clipWin = vb; setOpt('clipWin', clipWin); } }
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
    setupHeader();
    setupViewControls();
    setupMorphButton();
    setupSections();
    setupGutters();
    setupTooltips();
    setupFocusKeeper();
    // the undo entry follows the focused step until the next action (see noteFocus)
    document.addEventListener('pointerdown', noteFocus, true);
    document.addEventListener('keydown', noteFocus, true);
    // write pending changes (and the right-plane view) when the page is hidden or closed
    window.addEventListener('pagehide', writeState);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeState(); });
    setupShell();
    applyLayout();
    setupPaneButtons();
    setupChainHead();
    setupDrawControls();
    setupHeaderButtons();
    setupEscSound();
    setupKeys();
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
        if (sel0 !== S.sel && (sel0 === 'F' || (Number.isInteger(sel0) && sel0 >= 0 && sel0 <= S.steps.length))) { setSel(sel0); syncSel(); requestRender('P'); save(); }
        // an old save's Morph view opens with the deformation on (merged-views.md migration)
        if (S.deform) { deleteOpt('deform'); openTransport(); }
        // a link's or a scene's camera and deformation time (figureState, review math-10)
        if (S.figCam) {
          const c = S.figCam;
          if (c && [c.yaw, c.pitch, c.d].every(Number.isFinite) && c.d > 0) { cam.yaw = c.yaw; cam.pitch = Math.max(-89 * DEG, Math.min(89 * DEG, c.pitch)); cam.dist = c.d * CAM3.dist; cam.tx = Number.isFinite(c.tx) ? c.tx : 0; cam.ty = Number.isFinite(c.ty) ? c.ty : 0; }
          deleteOpt('figCam');
        }
        if ('figMorph' in S) {
          const fm = S.figMorph;
          deleteOpt('figMorph');
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
        setState(Object.assign(blankState(), { hideLeft: S.hideLeft, hideRight: S.hideRight }));
        selected = null; draft = null;
        dropAllGPU();
        loadExample(firstExample(), undefined, { quiet: true });
        buildDisplay(); applyLayout();
        hist = [snap()]; hi = 0; updateUndo();
        toast($t('The saved session could not be restored, so the first example was loaded.'));
      }
    } else {
      loadExample(firstExample(), undefined, { quiet: true });
      hist = [snap()]; hi = 0; updateUndo();
    }
    try { const k = lsk('cmw-probe'); localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { warnStorage(); }
    if (window.MathJax && MathJax.tex2svg && MathJax.startup && MathJax.startup.promise) MathJax.startup.promise.then(() => TeX.onReady());
    setupLateFonts();
    // v15: the phone layout (src/phone.js; notes/ui-redesign-2/build/phone.md)
    // (review russian-12: the left rail's vertical label is short, so it fits the rail at 1024 in Russian)
    { const rl = document.querySelector('#leftRail .rail-label'); if (rl) rl.textContent = $tx('rail', 'Draw'); }
    Phone.init(phoneApi());
    // (review russian-6: a language switch on a phone reopens the sheet that was open, More where the switch is)
    // (v15.1: and the plane that was large stays large, so each plane's saved view is drawn at the size it was saved at;
    // build/phone-swap.md)
    if (swPhone && Phone.isOn()) { const sp = swPhone; swPhone = null; if (Phone.setBig && (sp.big === 'L' || sp.big === 'R')) Phone.setBig(sp.big); if (typeof sp.k === 'string') setTimeout(() => Phone.open(sp.k, sp.nums ? { params: true } : {}), 0); }
    setupStepsView();   // ((#366 prototype) ?view=steps)
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
