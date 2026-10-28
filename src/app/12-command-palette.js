  // ---------------- command palette (src/commands.js), the popovers, recent functions and languages ----------------
  const RECENT_KEY = lsk('cmw-recent');
  function recentTypes() {
    try { return (JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []).filter((t) => Funcs.DEFS[t]).slice(0, 4); } catch (e) { return []; }
  }
  function noteRecent(t) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...recentTypes().filter((x) => x !== t)].slice(0, 4))); } catch (e) { /* ignore */ }
  }
  let popEl = null;
  function closePalette() {
    closePad(); // the Argand pad never outlives the popover or menu around it
    if (!popEl) return;
    const back = Commands.opener();   // (the command palette's opener, when the popover is the palette)
    const onClose = popEl._onClose;
    popEl.remove(); popEl = null;
    if (onClose) onClose();
    Commands.closed();
    if (back && back.isConnected && document.activeElement === document.body) back.focus({ preventScroll: true });
  }
  // the English source of a translated label: the palette scores it too, so English names still find things
  // (DESIGN.md 1). English never builds the map
  let enRev = null;
  const enOf = (s) => {
    if (I18N.lang === 'en') return s;
    if (!enRev) { enRev = new Map(); const tb = I18N._table(I18N.lang) || {}; for (const k in tb) if (typeof tb[k] === 'string') enRev.set(tb[k], k.slice(k.indexOf(I18N.CTX) + 1)); }
    return enRev.get(s) || s;
  };
  // the languages' own names (never translated: each is found under its own name)
  const LANG_NAMES = { en: 'English', ru: 'Русский', it: 'Italiano' };
  // the Language setting's items: the globe button's menu, the More menu and the palette (Auto, English, Русский,
  // Italiano)
  function langItems() {
    // Auto names what it would pick here (a test page's ?ns= stays English: review eng-12); each name carries its own
    // lang for a screen reader (eng-3); the menu is named and opens on the checked item (eng-7)
    const pref = I18N.readPref(), autoLang = I18N._resolve({ param: null, pref: 'auto', ns: I18N.NS, nav: navigator });
    const auto = LANG_NAMES[autoLang] || LANG_NAMES.en;
    const mk = (v, label, lang, labelEl) => ({ label, lang, labelEl, radio: true, checked: pref === v, run: () => pickLang(v) });
    const autoEl = h('span', { class: 'mi-label' }, ...I18N.parts('Auto ({name})', { name: h('span', { lang: LANG_NAMES[autoLang] ? autoLang : 'en' }, auto) }));
    const list = [mk('auto', $t('Auto ({name})', { name: auto }), null, autoEl), mk('en', LANG_NAMES.en, 'en'), mk('ru', LANG_NAMES.ru, 'ru'), mk('it', LANG_NAMES.it, 'it')];
    list.menuLabel = $t('Language'); list.focusChecked = true;
    return list;
  }
  // a choice that keeps the language (Auto (Русский) -> Русский) does not reload: the globe's label follows (eng-6)
  function pickLang(v) { const r = I18N.setPref(v); if (r && !r.reload) syncLangLabel(); return r; }
  function syncLangLabel() {
    const lb = $('langBtn');
    if (!lb) return;
    const pref = I18N.readPref(), nm = LANG_NAMES[pref] || $t('Auto');
    lb.setAttribute('aria-label', $t('Language: {name}', { name: nm }));
    const ll = lb.querySelector('.llabel'); if (ll) { ll.textContent = nm; if (pref === 'auto') ll.removeAttribute('lang'); else ll.setAttribute('lang', pref); }
  }
  // (v16.5 V03) one name for the integral in the palette and the planes' menu: ∮ F dz around Disc 1, Integrate F along Line 1
  function intLabel(s, names) {
    let closed = false;
    try { const pieces = curvePieces(s, false); closed = pieces.length > 0 && pieces.every((c) => c.closed); } catch (e) { closed = false; }
    const name = names.get(s.id) || Region.KINDS[s.kind].label, dv = leftStage() === 0 ? 'z' : `w${sub(leftStage())}`;
    return closed ? $t('∮ {x} d{dv} around {name}', { x: fnText(), dv, name }) : $t('Integrate {x} along {name}', { x: fnText(), name });
  }
  // the result opens beside its curve in X, never over Y, where the curve's image is
  function integrateShape(id) {
    const s = S.shapes.find((x) => x.id === id);
    if (!s || !paneL) return null;
    const r = paneL.ocanvas.getBoundingClientRect();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity;
    if (lFlat()) {
      paneL.setView(leftView());
      try { for (const [, z] of Region.handlesOf(s)) { const [x, y] = paneL.w2s(z); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); } } catch (e) { /* no handles */ }
    }
    const ok = Number.isFinite(x1) && x1 > -1e4 && x0 < 1e4;
    const cx = ok ? r.left + Math.min(r.width - 8, Math.max(8, x1)) : r.left + r.width / 2, cy = ok ? r.top + Math.max(8, Math.min(r.height - 8, y0)) : r.top + r.height / 3;
    return openIntegralPop(id, cx, cy, { beside: true, bx0: ok ? r.left + Math.max(0, x0) : null });
  }
  // what the command palette (src/commands.js) needs from the app: its functions and constants, and the state it
  // reassigns as getters (and popEl as a setter too: the palette is one of the popovers)
  function commandsApi() {
    return {
      C, EX, FT_WORD, HR, ICONS, PAL_NAMES, REGION_EXAMPLES, SUB, TOOLS, TeX, activeSteps, addCurveShapes, addShape,
      addStep, addSteps, armOutside, chooseRange, circleDeriv, closePalette, copyFigureLink, copyText, curvePlan,
      defOf, derivativeAction, enOf, exOk, exThumbs, fUni, focusBack, focusKey, fsub, intLabel, integrateSelected,
      integrateShape, inverseAction, isDerivStep, kindType, lLand, latexDocument, leftStage, loadExample, morph,
      morphOn, nSteps, newShape, openGallery, openGuide, pickLang, pickScene, recentTypes, renumberPoints,
      renumberZp, robustBox, saveScene, selOf, setFocus, setHomAll, setMain, setMorphPaths, setPalette, setPanels,
      setTheme, setTool, setView, shapeGPU, shapeInk, shapeKey, shapeNames, sndExportDone, soundHear, soundMode,
      soundStop, soundToggle, stageF, sub, toast, toggleAlone, toggleTransport, tourEmit, viewBox,
      get S() { return S; },
      get TH() { return TH; },
      get built() { return built; },
      get clipWin() { return clipWin; },
      get popEl() { return popEl; }, set popEl(v) { popEl = v; },
      get selected() { return selected; },
      get shapeVia() { return shapeVia; }, set shapeVia(v) { shapeVia = v; },
    };
  }
  function openPalette(...args) { return Commands.openPalette(...args); }

