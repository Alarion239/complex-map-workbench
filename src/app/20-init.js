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
    if (kc) kc.addEventListener('change', () => { setOpt('wKey', kc.checked); buildRightFoot(); requestRender('R'); save(); tourEmit('phase-key', { on: !!kc.checked }); });
    // the Deformation toggle in the top bar (M; merged-views.md): it modifies the active view
    const mb = $('morphBtn');
    if (mb) { mb.innerHTML = $t('{iconMorph}<span>Deformation</span>', { iconMorph: MODE_ICONS.morph }); mb.addEventListener('click', () => toggleTransport()); }
    // a deformation is coming: the homotopy programs (one per map mode, gl.js MAP) start compiling in the background,
    // so its first frames do not wait for them (the pointer or focus on the toggle, as prestartGlobe)
    const prestartMorph = () => { try { if (!morph.open && GLR.ok && GLR.prestartModes) GLR.prestartModes(S.homAll ? [3] : [1]); } catch (e) { /* the frame starts them */ } };
    if (mb) { mb.addEventListener('pointerenter', prestartMorph); mb.addEventListener('focus', prestartMorph); }
    $('linesChk').addEventListener('change', (e) => { setOpt('lines', e.target.checked); requestRender('L', 'R', 'T'); save(); });
    $('chevChk').addEventListener('change', (e) => { setOpt('chev', e.target.checked); requestRender('L', 'R'); save(); });
    // Snap: in the Draw heading and the last button of the collapsed rail (P3); Unit circle: in Display
    // ([v16.5 rail SPEC 4.3] the button was "Snap while drawing": it now names what it snaps to, the grid and figures)
    $('snapBtn').addEventListener('click', () => { setOpt('snap', !S.snap); syncSnapUnit(); save(); sndToggleCue(S.snap); });
    $('unitChk').addEventListener('change', (e) => { setOpt('unit', e.target.checked); requestRender('L', 'R', 'T'); save(); });
    $('alphaRange').addEventListener('input', (e) => { setOpt('alpha', +e.target.value); $('alphaVal').textContent = I18N.num(S.alpha.toFixed(2)); paintFader(e.target); requestRender('L', 'R', 'T'); save(); });
    $('meshRange').addEventListener('input', (e) => { showMeshVal(posToMesh(+e.target.value)); });
    $('patScale').addEventListener('input', (e) => { setOpt('patternScale', 2 ** +e.target.value); cellBase = 0; buildDisplay(); requestRender('L', 'R', 'T'); save(); });
    $('leftReadout').addEventListener('click', () => copyReadout('L'));
    $('rightReadout').addEventListener('click', () => copyReadout('R'));
    for (const b of $('chainMode').children) b.addEventListener('click', () => {
      setOpt('compact', b.dataset.mode === 'compact');
      const hgt = S.compact ? 96 : 188;
      document.documentElement.style.setProperty('--chain-h', hgt + 'px');
      try { localStorage.setItem(lsk('cmw-chain-h2'), String(hgt)); } catch (e) { /* ignore */ }
      applyLayout(); save();
    });
    radioKeys($('chainMode'));
    radioKeys($('patternSeg'));
    // on phones the More sheet of tools closes once a tool is picked
    $('tools').addEventListener('click', (e) => { const tm = $('toolMore'); if (tm && tm.open && e.target.closest('.tool')) tm.open = false; });
    // off the phone layout the panel sections are always open: their summaries are headings, not Tab stops or toggles.
    // ([#348] the phone is :root.ph, as Phone sets it, landscape phones up to 1023 px wide included, not a width query;
    // the sections follow the class when it changes)
    const isPhone = () => document.documentElement.classList.contains('ph');
    let wasPhone = null;
    const syncSections = () => {
      const ph = isPhone();
      if (ph === wasPhone) return;
      wasPhone = ph;
      for (const d of document.querySelectorAll('details.psec')) {
        const s = d.querySelector(':scope > summary');
        if (!s) continue;
        if (ph) s.removeAttribute('tabindex'); else { s.tabIndex = -1; d.open = true; }
      }
    };
    for (const d of document.querySelectorAll('details.psec')) d.addEventListener('toggle', () => { if (!isPhone() && !d.open) d.open = true; });
    new MutationObserver(syncSections).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
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
      if (th) {
        let q = 0;
        const ro = new ResizeObserver(() => { if (!q && th.firstElementChild) q = requestAnimationFrame(() => { q = 0; placeToasts(); }); });
        for (const el of [$('plotL'), $('plotR'), document.querySelector('.pipe-wrap')]) if (el) ro.observe(el);
      } }
    // crossing a drawer breakpoint: a drawer starts closed, a docked panel follows the user's choice
    let drawerWas = { L: isDrawer('L'), R: isDrawer('R') }, wideWas = window.innerWidth >= 768, oneWas = oneDock();
    window.addEventListener('resize', () => {
      const now = { L: isDrawer('L'), R: isDrawer('R') }, wide = window.innerWidth >= 768;
      if (wide && wideWas && (now.L !== drawerWas.L || now.R !== drawerWas.R)) {
        if (now.L !== drawerWas.L) setHidden('L', now.L || dockPref.L);
        if (now.R !== drawerWas.R) setHidden('R', now.R || dockPref.R);
        applyLayout();
      }
      drawerWas = now; wideWas = wide;
      if (oneDock() && !S.hideLeft && !S.hideRight) applyLayout();   // (v15: one docked panel from 1024 to 1279)
      // (review regress-1: back at 1280 or more, both panels follow the user's choice again)
      const one = oneDock();
      if (oneWas && !one && window.innerWidth >= 1280 && (S.hideLeft !== dockPref.L || S.hideRight !== dockPref.R)) { setHidden('L', dockPref.L); setHidden('R', dockPref.R); applyLayout(); }
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
      // ([#337] the pop-up in a pane head opens below the probe's readout and the notes it would cover)
      for (const ev of ['pointerenter', 'focusin', 'click']) el.addEventListener(ev, () => requestAnimationFrame(() => placeKeyPop(el)));
      el.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.key-sw')) return; if (el.parentNode && el.parentNode.classList.contains('pane-head')) el.classList.toggle('open'); else if (document.documentElement.classList.contains('ph')) el.classList.toggle('collapsed'); });   // (#365: on a laptop Phase's key lies open on the plot)
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
    $('clearChain').addEventListener('click', () => { if (!S.steps.length) return; setSteps([]); setFocusStep(0); chainChanged(true); setFocus(0); commit(); undoToast($t('Chain cleared.')); });
    // (D1, issue #23: Clear chain is a word button in the chain head again, shown while there is a chain to clear; it
    // had been under a ⋯ there since v15, review design-18)
    $('clearChain').hidden = !S.steps.length;
    // ([#357] the chain head never cuts a control: when its row does not fit (Russian and Italian at 1024 px beside the
    // Inspector), the heading "Function chain" gives way, kept for screen readers; the cards under it say what it is)
    const pipeHead = document.querySelector('.pipe-head');
    if (pipeHead && typeof ResizeObserver === 'function') {
      const fitPipeHead = () => { pipeHead.classList.remove('notitle'); if (pipeHead.scrollWidth > pipeHead.clientWidth + 1) pipeHead.classList.add('notitle'); };
      const ro = new ResizeObserver(fitPipeHead);
      ro.observe(pipeHead);
      for (const id of ['chainMode', 'viewAllBtn', 'clearChain']) { const e = $(id); if (e) ro.observe(e); }
    }
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
    // [#21] the offline page: build.py writes its size into the live page (<meta name="cmw-offline">) and pages.yml
    // publishes it beside index.html, so the entry is a same-origin download. The offline page itself, the test page
    // and a copy opened from disk have no such entry (null)
    function offlinePage() {
      const m = document.querySelector('meta[name="cmw-offline"]'), n = m ? Number(m.getAttribute('content')) : 0;
      if (!(n > 0) || location.protocol === 'file:') return null;
      const file = 'complex-map-workbench-offline.html';
      return { file, label: $t('Download offline page ({size})', { size: $t('{n} MB', { n: I18N.num((n / 1e6).toFixed(1)) }) }),
        run: () => { const a = h('a', { href: file, download: file }); document.body.append(a); a.click(); a.remove(); } };
    }
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
      kids.push(sep($t('Panels')), panel($t('Draw'), '[', !S.hideLeft, (v) => setPanels(!v, S.hideRight)), panel($t('Inspector'), ']', !S.hideRight, (v) => setPanels(S.hideLeft, !v)));
      const mesh = $('meshGroup');
      if (mesh) kids.push(sep(''), mesh);   // (the fader names itself: Mesh quality)
      const help = (label, run) => h('button', { class: 'set-link', type: 'button', onclick: () => { closePalette(); run(); } }, label);
      const off = offlinePage();
      kids.push(sep($t('Help')), h('div', { class: 'set-help' }, help($t('Guided tour'), () => Tour.openHelpMenu($('helpBtn'))), help($t('Guide'), () => openGuide()),
        help($t('Keyboard shortcuts'), () => { openGuide(); const k = [...document.querySelectorAll('.modal h3')].find((x) => ['Keys', $t('Keys')].includes(x.textContent.trim())); if (k) k.scrollIntoView({ block: 'start' }); }),
        off ? help(off.label, off.run) : null));
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
    let escSound = false;   // (set by the first Esc handler below, read by the one after it)
    // Esc stops anything playing, whoever else handles that Esc (the export dialog, the palette, the tour, a menu):
    // first, in the capture phase, and without taking the key from them. During a tour, the Esc that stops a
    // Listen along does only that: the next Esc ends the tour
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      // (a Listen along still preparing its samples counts as playing: this Esc drops it and goes no further)
      const playing = !!(snd.play || snd.prep);
      // (what Esc silences is its own level: while a melody, the deformation's motion or a loop sounds, this Esc stops
      // the sound and goes no further; the next one steps out of the modes)
      escSound = !!(sndP && sndP.on && (snd.play || snd.prep || snd.morphArm || snd.mo || (snd.cv && snd.cv.on)));
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
        else if (escSound) { /* the sound was this Esc's level */ }
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
    // fonts may arrive late; redraw labels
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitRightTitle(true); requestRender('L', 'R', 'T'); });
    // v15: the phone layout (src/phone.js; notes/ui-redesign-2/build/phone.md)
    // (review russian-12: the left rail's vertical label is short, so it fits the rail at 1024 in Russian)
    { const rl = document.querySelector('#leftRail .rail-label'); if (rl) rl.textContent = $tx('rail', 'Draw'); }
    Phone.init({
      icons: ICONS, modeIcons: MODE_ICONS, morphOn: () => morphOn(),
      showPanels: (ph) => { if (ph) { setHidden('L', false); setHidden('R', false); } else { setHidden('L', dockPref.L); setHidden('R', dockPref.R); } applyLayout(); requestRender('P'); },
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
      // (#246) the phone's chain row and sheet: the plane it is at, ‹ › (the step glide), the deformation's programs
      // compiled ahead of the first press, a step's sheet, a step moved by the sheet's drag
      chainState: () => chainState(), glide: (d) => glideStep(d), cardClick: (k) => (k === 'F' ? selectStep('F') : cardClick(k)),
      prestart: () => { try { if (GLR.ok && GLR.prestartModes) GLR.prestartModes(S.homAll ? [3] : [1]); } catch (e) { /* the frame starts them */ } },
      moveStep: (k, d) => moveStep(k, d), toggleTransport: () => toggleTransport(),
      footKids: (side) => foot[side].kids.slice(Math.max(0, foot[side].n)),
      xyView: () => S.view.main === 'xy',   // ([v17 D5] the regions' display is the X → Y view's)
      renderInspector: () => renderProps(),
      openMenu: (a, items) => openMenu(a, items), closePops: () => closePalette(),
      theme: () => curTheme, setTheme: (t) => { curTheme = t; setTheme(t); sndToggleCue(t !== 'light'); },
      langPref: () => I18N.readPref(), setLang: (v) => pickLang(v),
      palName: () => PAL_NAMES()[GLR.palette()][0], palIcon: () => `<span class="pcol-ic" style="--wheel:${keyConic()}"></span>`, palMenu: (a, done) => openMenu(a, palItems(done)),
      styleState: () => ({ ...styleState(), svg: STYLE_SVG[S.dc] || '' }), styleMenu: (a, done) => openMenu(a, styleItems(done)),
      globeIcon: ICONS.globe,
      soundIcon: () => (($('soundBtn') || {}).querySelector && $('soundBtn').querySelector('.snd-ic') || {}).innerHTML || '',
      // (D3) what the phone's context bar shows: the polygon being drawn, a curve being listened along, the selected shape
      ctxState: () => {
        if (polyDraftOpen()) return { kind: 'polygon', n: draft.pts.length };
        // (a construction tool in hand: what to pick next, with the pick it can take back)
        if (Construct.isTool(tool)) return { kind: 'construct', text: Construct.hint(), undo: !!Construct.undoPickable(), seg: tool === 'perp' ? Construct.seg : tool === 'hyper' ? Construct.hyper : null, segs: tool === 'hyper' ? ['in', 'between'] : null };
        if (SND && snd.play) return { kind: 'listen' };
        const sel = selected && findShape(selected);
        if (!sel) return null;
        const r = shapeRows.get(sel.id);
        // ([#321] a typeset definition as the words its tooltip reads: the cell's text is MathJax's, or the raw TeX
        // until MathJax has loaded; a construction's definition and an error are plain text already)
        const def = !r ? '' : r.d.dataset.tex ? texTitle(r.d.dataset.tex) : r.d.textContent;
        return { kind: 'shape', id: sel.id, name: r ? r.k.textContent : '', def, used: Construct.usedBy(sel.id).length };
      },
      ctxAct: (act, id, anchor) => {
        if (act === 'last') polyBack();
        else if (act === 'done') finishPolygon();
        else if (act === 'cancel') cancelDrawing();
        else if (act === 'seg') { if (tool === 'hyper') Construct.hyper = id; else Construct.seg = id; requestRender('OL', 'OR'); }
        else if (act === 'undopick') $('undoBtn').click();
        else if (act === 'xcancel') { Construct.cancel(); setTool('select'); }
        else if (act === 'delete') deleteShape(id);
        else if (act === 'stop') sndStopPlay(true);
        else if (act === 'more') { const r = shapeRows.get(id); if (r && r.more) r.more(anchor); }
      },
      sound: (k, v) => (k === 'state' ? { has: !!SND, on: !!(SND && SND.prefs().on), sonify: !!(SND && SND.prefs().sonify) } : k === 'sonify' && SND ? (SND.set({ sonify: !!v }, { quiet: true }), null) : null),
      newScene: () => loadExample(0),
      exportFigure: () => Figure.open(),
      copyLatex: () => { copyText(latexDocument()); toast($t('LaTeX copied: the map, its natural domain and its guarantees.')); sndExportDone(); },
      openGuide: () => openGuide(),
      offlinePage: () => offlinePage(),   // [#21] the More sheet's Download offline page (null: none)
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
