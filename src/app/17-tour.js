  // ---------------- guided tour (src/tour.js; notes/tour/INTEGRATION.md) ----------------
  // The adapter the tour drives: where things are, the user's work (snapshot, restore, the paused autosave), the tour's
  // scenes and looks, and the events that tick its Try its. tourWire() runs at the end of init().
  const tourL = {};
  let tourSplit = false;   // v15.2: the tour's stop shows the Inspector's split offer (its scene sets split: true)
  let tourHold = false;   // the autosave is paused while a tour borrows the canvas: writeState writes nothing
  let tourDrawer = false; // the tour opened the left drawer for a step (a narrow desktop): the next step closes it
  let tourPics = null;    // v16.1: the chain's Pictures | Names and height before a tour step turned its pictures on
  let tourPhGeo = null;   // (r3) the phone sheet geometry on the root before the tour: [--ph-hp, --ph-ride]
  // saved work existed at this opening (read before init can save anything): the suggestion greets a returning user
  const tourHadWork = (() => { try { return localStorage.getItem(LS_KEY) != null; } catch (e) { return false; } })();
  function tourEmit(ev, p) {
    const fs = tourL[ev];
    if (fs) for (const f of fs.slice()) { try { f(p); } catch (e) { console.warn('[tour] event', ev, e); } }
  }
  // (v16.4) the end of the user's pan, zoom or orbit: pane 'P' is the one wide panel of Phase and Landscape
  function tourViewMoved(side, how) {
    if (!tourL['view-moved']) return;
    tourEmit('view-moved', { pane: S.view && S.view.main !== 'xy' ? 'P' : side === 'R' ? 'R' : 'L', how });
  }
  // (v16.4, notes/tour-r3/SPEC.md 4.3) the sound settings the tour holds for its Sound chapter: the user's own values
  // are remembered at the first hold (and written to cmw-tour-sound, so a crash gives them back at the next start) and
  // come back at the release, each unless the user changed it meanwhile
  const TOUR_SND = 'cmw-tour-sound';
  let tourSnd = null;   // { saved: { key: the user's value }, held: { key: the value the tour set } }
  function tourSndWrite() { try { if (tourSnd && Object.keys(tourSnd.held).length) localStorage.setItem(lsk(TOUR_SND), JSON.stringify(tourSnd)); else localStorage.removeItem(lsk(TOUR_SND)); } catch (e) { /* */ } }
  function tourSoundHold(prefs) {
    if (!SND) return false;
    const keys = ['on', 'events', 'sonify'];
    if (!tourSnd) tourSnd = { saved: {}, held: {} };
    const set = {};
    for (const k of keys) {
      const v = prefs == null ? null : prefs[k];
      if (prefs != null && !(k in prefs)) continue;
      if (v === true) {
        if (!(k in tourSnd.held)) tourSnd.saved[k] = !!sndP[k];
        tourSnd.held[k] = true;
        if (!sndP[k]) set[k] = true;
      } else if (v === null && k in tourSnd.held) {
        // (given back only when it is still what the tour set: a change by the user meanwhile stays)
        if (!!sndP[k] === tourSnd.held[k] && tourSnd.saved[k] !== tourSnd.held[k]) set[k] = tourSnd.saved[k];
        delete tourSnd.held[k]; delete tourSnd.saved[k];
      }
    }
    if (Object.keys(set).length) SND.set(set);
    tourSndWrite();
    const any = Object.keys(tourSnd.held).length > 0;
    if (!any) tourSnd = null;
    return any;
  }
  // (r3 review user-6) a sound setting the user changes while the tour holds it becomes theirs: it is not given back
  function tourSndMine(keys) {
    if (!tourSnd) return;
    for (const k of keys) { delete tourSnd.held[k]; delete tourSnd.saved[k]; }
    tourSndWrite();
    if (!Object.keys(tourSnd.held).length) tourSnd = null;
  }
  // a tour cut short by a reload or a crash: the user's sound settings back (at init)
  function tourSoundRecover() {
    let raw = null;
    try { raw = localStorage.getItem(lsk(TOUR_SND)); } catch (e) { return; }
    if (!raw || !SND) return;
    try {
      const t = JSON.parse(raw), set = {};
      for (const k of ['on', 'events', 'sonify']) if (t && t.held && k in t.held && !!sndP[k] === !!t.held[k] && t.saved && typeof t.saved[k] === 'boolean') set[k] = t.saved[k];
      if (Object.keys(set).length) SND.set(set, { quiet: true });
    } catch (e) { /* malformed: dropped */ }
    try { localStorage.removeItem(lsk(TOUR_SND)); } catch (e) { /* */ }
  }
  const tourSoundReady = () => !!(SND && sndP.on && sndP.events && SND.state().audio === 'running');
  // Listen along the current scene's curve: the shape with a melody, else its last closed curve (the tour's act button)
  function tourListen() {
    if (!SND || typeof (window.AudioContext || window.webkitAudioContext) !== 'function') return false;
    const s = S.shapes.find((x) => x.listen && x.visible !== false) || [...S.shapes].reverse().find((x) => x.visible !== false && ['circle', 'disc', 'polygon', 'rect', 'lasso', 'ellipse'].includes(x.kind)) || null;
    if (!s) return false;
    if (snd.hint) { snd.hint = null; clearTimeout(snd.hintT); updateDraftChips(); }
    if (sndP.on && sndP.events) return sndListenShape(s) !== false;
    tourSoundHold({ on: true, events: true });
    sndTurnOnListen(s);
    return true;
  }
  // the end of a drag in a pane (onUp): a shape or target moved or reshaped, a zero or pole dragged, a cut dragged
  function tourDragEnd(d) {
    if (!d) return;
    const id = d.shape && typeof d.shape === 'object' ? d.shape.id : d.shape;
    if (/^g?(move|handle)$/.test(d.mode) && d.moved) tourEmit('shape-moved', { id, plane: d.target ? 'w' : 'z' });
    else if (d.mode === 'zp' && d.moved && !d.off) tourEmit('zp-moved', { kind: String(d.kind).replace(/s$/, ''), i: d.i });
    else if (d.mode === 'cut') { const st = S.steps[(d.step | 0) - 1]; tourEmit('cut-moved', { k: d.step, cut: st && st.params ? st.params.cut : null }); }
  }
  // the persisted state, as writeState saves it
  const tourState = () => JSON.parse(JSON.stringify(Object.assign({}, S, { hideLeft: dockPref.L, hideRight: dockPref.R, rightView: rightAuto ? null : { cx: V.right.cx, cy: V.right.cy, s: V.right.s } }), noRuntime));
  function tourSnapshot() {
    phHold();
    const xl = document.querySelector('#examplesBtn .exlabel');
    return {
      state: tourState(),
      // what lives in memory only: the undo history, the panels as shown, the transport, the tool and selection, the
      // planes' views and cameras, the views' memories and the Examples label
      mem: {
        hist: hist.map((e) => ({ s: e.s, focus: e.focus, range: e.range || null })), hi, hideLeft: S.hideLeft, hideRight: S.hideRight,
        morph: { open: morph.open, T: morph.T, playing: morph.playing }, tool, selected, currentExample, exLabel: xl ? xl.textContent : null,
        V: JSON.parse(JSON.stringify(V)), leftAuto, rightAuto, clipWin: Object.assign({}, clipWin),
        viewMem: JSON.parse(JSON.stringify(viewMem)), defMem: JSON.parse(JSON.stringify(defMem)), cams: [cam, camL, camS].map(camKeys), cell: [cellBase, cellKey],
        phBig: tourPhone() ? Phone.big() : null,
      },
    };
  }
  // v15: the phone layout (src/phone.js) is on: its sheets and its large plane
  const tourPhone = () => Phone.isOn && Phone.isOn();
  // put the user's work back in place (opt.fromStash: after a reload or a crash, from the persisted state only)
  function tourRestore(sn, opt) {
    if (!sn || !sn.state || typeof sn.state !== 'object') return false;
    if (tourPhone()) Phone.close(true);
    phHold();
    const m = opt && opt.fromStash ? null : sn.mem;
    // this session's own state needs no migration; a stash is read as a reload reads the saved state
    const st = m ? Object.assign(blankState(), JSON.parse(JSON.stringify(sn.state))) : sanitizeState(JSON.parse(JSON.stringify(sn.state)));
    if (!st) return false;
    cancelTweens(); closePad(); closePalette();
    draft = null; drag = null; probe = null; zpSel = null; zpHover = null; selected = null; hoverShape = null;
    rHover = null; setHoverW(null);
    morph.open = false; morph.playing = false; morph.seg = null; morph.T = 0;
    defMem.y = null; defMem.d = null; defMem.dkey = '';
    for (const k of Object.keys(viewMem)) delete viewMem[k];
    setState(st);
    dockPref.L = !!S.hideLeft; dockPref.R = !!S.hideRight;
    if (m) { setHidden('L', !!m.hideLeft); setHidden('R', !!m.hideRight); } else { if (isDrawer('R')) setHidden('R', true); if (isDrawer('L')) setHidden('L', true); }
    if (m && m.viewMem) Object.assign(viewMem, m.viewMem);
    dropAllGPU();
    cauchyCache.key = '';
    applyLayout();
    S.srcView = Object.assign({}, S.srcView);
    paneL.setView(S.srcView);
    clipWin = m && m.clipWin ? Object.assign({}, m.clipWin) : S.clipWin ? Object.assign({}, S.clipWin) : viewBox(S.srcView);
    if (!S.clipWin && goodWin(clipWin)) S.clipWin = clipWin;   // (review v16 regress-6: saved from here on)
    rebuild(); buildShapeList(); buildPipeline(); buildDisplay();
    setFocus(Math.min(S.focus || 0, S.steps.length));
    const xl = document.querySelector('#examplesBtn .exlabel');
    if (m) {
      setTool(TOOLS.some((t) => t[0] === m.tool) ? m.tool : 'select');
      if (m.morph.open && morphRange().steps.length) openTransport();
      Object.assign(V.left, m.V.left); Object.assign(V.right, m.V.right); leftAuto = m.leftAuto; rightAuto = m.rightAuto;
      if (m.defMem) Object.assign(defMem, m.defMem);
      if (morph.open) { morph.T = m.morph.T; morph.playing = m.morph.playing; morph.seg = null; morph.u = 0; setPlayIcon(); syncTransport(); }
      [cam, camL, camS].forEach((c, i) => { if (m.cams && m.cams[i]) Object.assign(c, m.cams[i], { vyaw: 0, vpitch: 0 }); });
      hist = m.hist.map((e) => ({ s: e.s, focus: e.focus, range: e.range || null })); hi = Math.max(0, Math.min(hist.length - 1, m.hi));
      currentExample = m.currentExample;
      if (xl && m.exLabel != null) { xl.textContent = m.exLabel; xl.title = m.exLabel; }
      if (m.selected && (S.shapes.some((s) => s.id === m.selected) || S.targets.some((s) => s.id === m.selected))) selected = m.selected;
      if (m.cell) [cellBase, cellKey] = m.cell;
      if (m.phBig && tourPhone() && Phone.big() !== m.phBig) Phone.setBig(m.phBig);
    } else {
      setTool('select');
      if (S.rightView && autoFit()) { Object.assign(V.right, S.rightView); rightAuto = false; }
      hist = [snap()]; hi = 0;
    }
    updateUndo();
    buildShapeList(); buildRightFoot(); updateFocusUI(); drawLegend();
    scheduleFix(); requestRender('L', 'R', 'T', 'OL', 'OR', 'P');
    save();
    return true;
  }
  // a scene of the tour, in the format of EX: loaded as an example is, without the Examples label or currentExample
  function tourLoadScene(spec) {
    if (!spec || !Array.isArray(spec.steps) || !spec.steps.every((st) => st && Funcs.DEFS[st.type])) return false;
    // (v15: a scene brings its own shared numbers, none unless it says so; restore() brings the user's back)
    setParams(Array.isArray(spec.params) ? JSON.parse(JSON.stringify(spec.params)) : []);
    loadExample(-1, Object.assign({ shapes: [], view: { cx: 0, cy: 0, s: 60 } }, spec));
    paramsRestored();
    return true;
  }
  // the display a scene's copy assumes (the Look keys of INTEGRATION.md); null: the app's default
  function tourSetLook(lk) {
    if (!lk || typeof lk !== 'object') return;
    const d0 = blankState();
    if ('pattern' in lk) S.pattern = PATTERNS.some((p) => p[0] === lk.pattern) ? lk.pattern : d0.pattern;
    if ('alpha' in lk) S.alpha = isNum(lk.alpha) ? Math.max(0.2, Math.min(1, lk.alpha)) : d0.alpha;
    if ('height' in lk) S.height = ['log', 'abs', 're', 'im'].includes(lk.height) ? lk.height : d0.height;
    if ('sheets' in lk) S.sheets = !!lk.sheets;
    if ('phaseStyle' in lk) { S.dc = DC_STYLES.some((p) => p[0] === lk.phaseStyle) ? lk.phaseStyle : d0.dc; S.landPlain = false; cauchyCache.key = ''; }
    if ('paths' in lk) { S.morphPaths = lk.paths !== false; const b = $('pathsBtn'); if (b && !b.disabled) b.setAttribute('aria-pressed', String(S.morphPaths)); }
    if ('allAtOnce' in lk && !!lk.allAtOnce !== !!S.homAll) setHomAll(!!lk.allAtOnce);
    // (v16.4) the Phase key of Y, and the phase sectors (Tiles' 30° lines: the harp's strings)
    if ('phaseKey' in lk) S.wKey = !!lk.phaseKey;
    if ('sectors' in lk) S.sectors = [8, 12, 16, 24].includes(lk.sectors) ? lk.sectors : 12;
    buildDisplay(); buildRightFoot(); updateFocusUI(); drawLegend();
    requestRender('L', 'R', 'T');
    save();
  }
  const tourApi = {
    // the tour's own map fits this markup (INTEGRATION.md, Anchors); v15: F's formula, guarantees, domain and step table
    // are in the Inspector with the F tile selected, so asking for them selects F (and draws the Inspector at once)
    anchor: (name) => {
      if (!['composite', 'guarantees', 'domain', 'matrix'].includes(name)) return undefined;
      if (selOf() !== 'F') { setSel('F'); syncSel(); }
      renderProps();
      return undefined;
    },
    has: (f) => (f === 'zp' ? !!Funcs.DEFS.zp : f === 'constructions' ? !!Construct.ui : true),
    storageKey: lsk,
    snapshot: tourSnapshot,
    restore: tourRestore,
    // on: write any pending save now, then pause the autosave; off: resume it (restore has put the work back)
    sandbox(on) { if (on) { if (!tourHold) writeState(); tourHold = true; } else { tourHold = false; tourSplit = false; save(); } return true; },
    // v15.2: the current stop shows the Inspector's split offer (its split: true); every other stop hides it
    splitOffer: (on) => { if (tourSplit !== !!on) { tourSplit = !!on; requestRender('P'); } return true; },
    // v16.1 (user 5): a step about the cards' pictures shows them: Pictures rather than Names, and a chain shorter than
    // Pictures needs (140 px, the gutter's own rule) at Pictures' 188 px; off, the user's setting comes back (unless they
    // changed it meanwhile). True while the tour holds the pictures on. A phone's chain bar always shows its pictures
    chainPictures: (on) => {
      const root = document.documentElement;
      if (on) {
        if (tourPics) return true;
        if (tourPhone()) return false;
        const hNow = root.style.getPropertyValue('--chain-h'), short = (parseFloat(getComputedStyle($('stage')).getPropertyValue('--chain-h')) || 188) < 140;
        if (!S.compact && !short) return false;
        tourPics = { compact: !!S.compact, h: hNow };
        S.compact = false;
        if (short) root.style.setProperty('--chain-h', '188px');
        applyLayout(); requestRender('T');
        return true;
      }
      if (!tourPics) return false;
      const p = tourPics;
      tourPics = null;
      if (!S.compact) {
        S.compact = p.compact;
        if (p.h) root.style.setProperty('--chain-h', p.h); else root.style.removeProperty('--chain-h');
        applyLayout(); requestRender('T');
      }
      return false;
    },
    loadScene: tourLoadScene,
    setLook: tourSetLook,
    // v16.4 (notes/tour/INTEGRATION.md 9): where the tour's strip goes ('stage': the first row of the stage, or on a
    // phone the row under the header; 'head': a landscape phone's header), the Grieg example as a scene, the sound
    // the Sound chapter needs
    slot: (where) => {
      const e = $(where === 'head' ? 'tourHeadSlot' : 'tourSlot');
      // (r3 review regress-7: only an open sheet's geometry is shared out again; the split rows read --ph-tour in CSS,
      // and a sheet that opens later measures itself)
      if (Phone.geometry) requestAnimationFrame(() => { if (Phone.sheet && Phone.sheet()) Phone.geometry(); });
      return e || null;
    },
    sceneSpec: (name) => {
      if (name !== 'song') return null;
      const ex = EX.find((x) => x.shapes.some((sh) => sh.listen));
      return ex ? { name: ex.name, tex: ex.tex, view: ex.view, fit: ex.fit, shapes: ex.shapes, steps: ex.steps, rightMode: ex.rightMode, dc: ex.dc } : null;
    },
    listen: tourListen,
    soundHold: tourSoundHold,
    soundStop: () => { sndStopPlay(false); return true; },
    soundReady: tourSoundReady,
    soundPlaying: () => !!snd.play,
    soundState: () => ({ on: !!sndP.on, events: !!sndP.events, sonify: !!sndP.sonify, audio: SND ? SND.state().audio : 'none', playing: !!snd.play }),
    setView: (main) => setMain(main),
    setSurface: (pane, surf) => setView(pane === 'R' ? 'R' : 'L', surf),
    setDeformation: (on) => { if (on) { if (!morph.open) openTransport(); } else closeTransport(); },
    // (v16: a scene's bracket; null: every step)
    setRange: (r) => { setHomRange(r && Number.isInteger(r.a) && Number.isInteger(r.b) ? { a: r.a, b: r.b } : null); return true; },
    setTool: (id) => { if (TOOLS.some((t) => t[0] === id)) setTool(id); },
    focusStep: (k) => { k = Math.max(0, Math.min(S.steps.length, k | 0)); if (k !== S.focus) setFocus(k); },
    // (v15: on a phone the right panel is the Editor sheet, the Inspector)
    // ['panel', 'left', sheet]: the left panel, or on a phone the sheet that holds that part of it ('tools': the
    // shapes and the formula; 'display': the patterns); a drawer the tour opened closes with the next step's closeSheet.
    // ['panel', 'sheet', k]: a phone's sheet k only (the Display sheet holds the large plane's options and, while the
    // deformation shows, its order); nothing elsewhere
    // (r3 review regress-2) early: a chapter's start opens the side panel one of its steps docks, so the stage keeps
    // one place through the chapter; a drawer or a phone's sheet, which would cover the work area, waits for its step
    showPanel: (side, sheet, early) => {
      // ('steps': the deformation bar's Steps picker, which holds the order, Loop and the range, opens over the bar)
      if (tourPhone()) { if (early) return; if (sheet === 'steps') { const p = $('stepsPick'), b = $('stepsBtn'); if (p && b && p.hidden) b.click(); return; } if (side === 'right') { Phone.open('edit'); renderProps(); } else if (sheet && Phone.sheet() !== sheet) Phone.open(sheet); return; }
      if (side === 'sheet') return;
      // ([v17 D4] the regions' display is behind Y's Display ▾ on the laptop: its step opens that popover, which is the
      // step's own layer, as a phone's sheet is: it carries the step's id (data-tour-layer), and the next step that does
      // not ask for it closes it, closeSheet)
      if (side === 'left' && sheet === 'display') {
        if (early) return;
        if (!document.querySelector('.disp-pop')) { const b = /** @type {HTMLElement | null} */ (document.querySelector('#rightFoot .disp-btn')); if (b) b.click(); }
        const p = /** @type {HTMLElement | null} */ (document.querySelector('.disp-pop')), c = Tour.current();
        if (p && c) p.dataset.tourLayer = c.chapter + '/' + c.id;
        return;
      }
      if (early && side !== 'right' && isDrawer('L')) return;
      if (side === 'right' ? S.hideRight : S.hideLeft) {
        if (side !== 'right' && isDrawer('L')) tourDrawer = true;
        setPanels(side === 'right' ? S.hideLeft : false, side === 'right' ? false : S.hideRight);
      }
    },
    // v15: select a step (or 'F') for the Inspector; on a phone, which plane is the large one; close a phone's sheet
    selectStep: (k) => { if (!S.steps.length) return false; k = k === 'F' ? 'F' : Math.max(1, Math.min(S.steps.length, k | 0)); selectStep(k); renderProps(); return true; },
    showPlane: (pane) => { if (tourPhone() && (pane === 'L' || pane === 'R') && Phone.big() !== pane) Phone.swap(); },
    closeSheet: () => {
      if (tourPhone()) { const p = $('stepsPick'), b = $('stepsBtn'); if (p && b && !p.hidden) b.click(); if (Phone.sheet()) Phone.close(true); return; }
      if (document.querySelector('.disp-pop')) closePalette();
      if (tourDrawer) { tourDrawer = false; if (isDrawer('L') && !S.hideLeft) setPanels(true, S.hideRight); }
    },
    on(ev, fn) { (tourL[ev] = tourL[ev] || []).push(fn); return () => { tourL[ev] = (tourL[ev] || []).filter((g) => g !== fn); }; },
    tex: (src) => { const s = h('span'); TeX.set(s, src); return s; },
    toast: (msg) => toast(msg),
    // the saved copy's fingerprint (its length and a hash), or null when there is none: the tour's backup records it
    savedMark: () => {
      let raw = null;
      try { raw = localStorage.getItem(LS_KEY); } catch (e) { return null; }
      if (raw == null) return null;
      let hsh = 2166136261;
      for (let i = 0; i < raw.length; i++) { hsh ^= raw.charCodeAt(i); hsh = Math.imul(hsh, 16777619); }
      return `${raw.length}:${(hsh >>> 0).toString(36)}`;
    },
    openGuide: (sec) => {
      openGuide();
      if (sec !== 'keys') return;
      const k = [...document.querySelectorAll('.modal h3')].find((x) => x.textContent.trim() === 'Keys');
      if (k) k.scrollIntoView({ block: 'start' });
    },
    // something Escape cancels in the app: a drawing, a drag, a selection (a shape, a zero or pole), the coordinate
    // pad, the tools' More menu, an open overlay drawer
    busy: () => !!(draft || drag || selected || modeNext() || zpSel || padEl || snd.play || snd.kloop || ($('toolMore') && $('toolMore').open) || (isDrawer('L') && !S.hideLeft) || (isDrawer('R') && !S.hideRight)),
    // a menu, the palette, the coordinate pad or a dialog is open: Escape and Tab are theirs
    layerOpen: () => !!(popEl || padEl || document.querySelector('#popHost > .pop, .modal-bg, [popover]:popover-open')),
    // v15's layers, which the callout keeps clear of and the rings are masked off: the popovers (#popHost: the palette,
    // the menus, the planes' menu, the integral and options popovers, the pad), a dialog, the sound settings, the top
    // layer (the header's More menu), a phone's sheet and an overlay drawer (the tour skips one that holds its anchor)
    layers: () => {
      const out = [...document.querySelectorAll('#popHost > *, .modal-bg > *, .snd-pop:not([hidden]), dialog[open], .ph-sheet:not([hidden])')];
      try { out.push(...document.querySelectorAll(':popover-open')); } catch (e) { /* no popover API */ }
      if (isDrawer('L') && !S.hideLeft && $('leftPanel')) out.push($('leftPanel'));
      return out;
    },
    hasWork: () => tourHadWork,
    // a tour starts: the coordinate pad edits a card of the user's chain, which the tour's scenes replace
    // (r3 review regress-7: a phone's sheet geometry, written by the sheets the tour's steps open, goes when the tour
    // ends if it was not there before it; a sheet opened later measures itself again)
    onTour: (on) => {
      const st = document.documentElement.style;
      if (on) { closePad(); tourPhGeo = ['--ph-hp', '--ph-ride'].map((k) => st.getPropertyValue(k)); return; }
      tourDrawer = false;
      if (tourPhGeo && !(Phone.sheet && Phone.sheet())) ['--ph-hp', '--ph-ride'].forEach((k, i) => { if (!tourPhGeo[i]) st.removeProperty(k); });
      tourPhGeo = null;
    },
  };
  function tourWire() {
    // the events the app sends from delegated listeners: t scrubbed (v16.4: a pattern picked is sent by its setter)
    document.addEventListener('input', (e) => { if (e.target && e.target.id === 'morphRange') tourEmit('deformation-t', { t: morph.T }); });
    tourSoundRecover();       // (v16.4) and the sound settings its Sound chapter held
    Tour.init(tourApi);       // also puts the user's work back if a tour was cut short by a reload or a crash
    if (!NS) Tour.suggest();  // the first-run card; never under ?ns= (tests and golden images stay as they are)
  }

