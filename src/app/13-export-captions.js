  // ---------------- guarantees panel ----------------
  const BADGES = [
    ['analytic', $t('Analytic'), $t('Holomorphic at every point of its natural domain D.')],
    ['entire', $t('Entire'), $t('D = ℂ and F is holomorphic everywhere.')],
    ['rational', $tx('badge', 'Rational'), $t('Agrees on D with P(z)/Q(z) for polynomials P and Q.')],
    ['polynomial', $t('Polynomial'), $t('A polynomial in z.')],
    ['mobius', $tx('badge', 'Möbius'), $t('F(z) = (az + b)/(cz + d) with ad − bc ≠ 0.')],
    ['proper', $t('Proper'), $t('Preimages of compact sets in ℂ are compact in D, so |F(z)| → ∞ as z → ∂D or z → ∞.')],
    ['homeo', $t('Homeomorphism onto image'), $t('Injective and continuous on the open set D, so a homeomorphism D → F(D) by invariance of domain.')],
    ['conformal', $t('Conformal onto image'), $t('Analytic and injective: a biholomorphism D → F(D), with F′ ≠ 0.')],
  ];
  let openLamp = null;
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(() => fallbackCopy(t)); } catch (e) { /* fall through */ }
    fallbackCopy(t);
    return Promise.resolve();
  }
  function fallbackCopy(t) {
    const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0' });
    ta.value = t; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }
  // The panel is built once per chain structure (steps, on/off, errors) and then updated in place: lamps, count,
  // qualifiers and matrix cells are set on every change, so a lit lamp never outlives the chain that implied it;
  // formulas go through TeX.set, which skips unchanged nodes and, during a scrub or drag, waits for input to
  // pause (TeX.hush). A hidden panel costs nothing: only the rail lamps update, and the panel catches up when shown.
  const PROPS = { sig: null, stale: false, texF: '', rail: '', ro: null, el: null };
  // ---- v15: the selection and the Inspector (notes/ui-redesign-2/desktop/DESIGN.md 2.4) ----
  // S.sel: the selected object, a step k (0: the region) or 'F'; null follows the step shown alone, else the last step.
  // Selecting is not focusing: the planes keep what they show; Show alone (S.focus) is its own action.
  function selOf() {
    const n = S.steps.length;
    if (S.sel === 'F') return 'F';
    if (Number.isInteger(S.sel) && S.sel >= 0 && S.sel <= n) return S.sel;
    return S.focus > 0 && S.focus <= n ? S.focus : n;
  }
  function syncSel() {
    const sel = selOf(), quiet = !!(morph.playing && morph.open);
    for (const c of document.querySelectorAll('#pipeline .card')) {
      const on = +c.dataset.k === sel;
      c.classList.toggle('sel', on); c.classList.toggle('quiet', on && quiet);
      if (c.getAttribute('aria-selected') !== String(on)) c.setAttribute('aria-selected', String(on));
      c.tabIndex = on ? 0 : -1;   // (review design-14: one tab stop, the selected option; the arrows move inside)
    }
    const ft = document.querySelector('#pipeline .ftile');
    if (ft) { ft.classList.toggle('sel', sel === 'F'); ft.setAttribute('aria-selected', String(sel === 'F')); ft.tabIndex = sel === 'F' ? 0 : -1; }
    syncPlaying();
    const wb = $('viewAllBtn');
    if (wb) wb.disabled = S.focus === 0;
  }
  // the card of the step the deformation is in (review design-13): one after another, the step at t; all at once, the
  // last card, which shows the deformation itself
  let playKey = '';
  function syncPlaying() {
    let k = 0;
    if (morph.open && morphOn()) {
      const steps = morphRange().steps;
      k = allAtOnce() ? steps[steps.length - 1] : steps[Math.max(0, Math.min(steps.length - 1, Math.floor(morph.T - (morph.T >= steps.length ? 1e-9 : 0))))];
    }
    const key = String(k || 0);
    if (key === playKey && (!k || document.querySelector('#pipeline .card.playing'))) return;
    playKey = key;
    for (const c of document.querySelectorAll('#pipeline .card')) c.classList.toggle('playing', !!k && +c.dataset.k === k);
  }
  // a step shown alone says so in X's head, with a way back (DESIGN.md 2.4, design-23): "f₃ alone ×"
  function syncAloneChip() {
    const head = document.querySelector('#paneL .pane-head');
    if (!head) return;
    let chip = $('aloneChip');
    if (!chip) {
      // (v15.2: ‹ and › walk the steps one by one, in the head strip, never over the plane)
      const nav = (d) => h('button', { class: 'icon-btn ac-nav ' + (d < 0 ? 'prev' : 'next'), type: 'button', 'aria-label': d < 0 ? $t('Show the previous step alone') : $t('Show the next step alone'), 'data-tip': d < 0 ? $t('Show the previous step alone') : $t('Show the next step alone'),
        onclick: () => { const j = S.focus + d; if (j >= 1 && j <= S.steps.length) { setFocus(j); requestRender('P'); } } }, d < 0 ? '‹' : '›');
      chip = h('span', { class: 'alone-chip', id: 'aloneChip', hidden: true }, nav(-1), h('span', { class: 'ac-t' }), nav(1),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': $t('Show F'), 'data-tip': $t('Show F'), html: ICONS.close, onclick: () => setFocus(0) }));
      head.insertBefore(chip, $('leftLed'));
    }
    const k = S.focus;
    chip.hidden = !(k > 0);
    if (k > 0) { const ht = $t('{f} alone', { f: `<i>f</i>${sub(k)}` }); const el = chip.querySelector('.ac-t'); if (el.innerHTML !== ht) el.innerHTML = ht; }
    const pv = chip.querySelector('.ac-nav.prev'), nx = chip.querySelector('.ac-nav.next');
    if (pv) pv.disabled = !(k > 1);
    if (nx) nx.disabled = !(k > 0 && k < S.steps.length);
  }
  // The modes Esc steps out of, innermost first: a step shown alone, an expanded plane, the deformation. Each one is a
  // chip at the right end of the head of the plane that stays in view, with the key that leaves it and a ×; the
  // chip of the mode Esc closes next also shows Esc.
  const modeNext = () => {
    if (S.focus > 0) return 'alone';
    if (S.view.main === 'xy' && S.solo && !Views.merged(S.view, morphOn())) return 'solo';
    return morphOn() ? 'morph' : null;
  };
  function modeClose(m) {
    if (m === 'tool') { Construct.cancel(); setTool('select'); return; }
    if (m === 'listen') { sndStopPlay(true); updateDraftChips(); return; }
    if (m === 'alone') setFocus(0);
    else if (m === 'solo') setSolo(S.solo);
    else if (m === 'morph') closeTransport();
  }
  function syncModeChips() {
    const mg = Views.merged(S.view, morphOn()), side = mg || (S.view.main === 'xy' && S.solo) || 'L';
    const head = document.querySelector(side === 'R' ? '#paneR .pane-head' : '#paneL .pane-head');
    if (!head) return;
    let box = $('modeChips');
    if (!box) box = h('span', { class: 'mode-chips', id: 'modeChips' });
    const next = modeNext();
    const want = [];
    if (S.view.main === 'xy' && S.solo && !mg) want.push(['solo', S.solo === 'L' ? $t('Y hidden') : $t('X hidden'), $t('Show both planes'), '']);
    if (morphOn()) want.push(['morph', $t('Deformation'), $t('Turn the deformation off'), 'M']);
    // the Construct tool in use: its name and count in the head, × leaves the tool (the pick's sentence stays on the plane)
    const tc = Construct.toolChip && Construct.toolChip();
    if (tc) want.push(['tool', tc.count ? tc.name + ' · ' + tc.count : tc.name, $t('Leave the tool'), '']);
    // Listening along: the plane's own chip says it and has the Stop
    const lp = snd.play;
    if (lp) { const nm = lp.shape ? shapeNames().get(lp.shape.id) : ''; want.push(['listen', nm ? $t('Listening along {name}', { name: nm }) : $t('Listening along'), $t('Stop listening'), '']); }
    // an expanded plane leaves the other one as a labelled strip at the edge, a way back
    const strip = $('hiddenStrip') || h('button', { type: 'button', class: 'hidden-strip', id: 'hiddenStrip', hidden: true, onclick: () => setSolo(S.solo) });
    const hid = S.view.main === 'xy' && S.solo && !mg ? (S.solo === 'L' ? 'R' : 'L') : null;
    if (strip.parentNode !== $('panes')) $('panes').append(strip);
    strip.hidden = !hid;
    if (hid) {
      const t = hid === 'R' ? $t('Y hidden') : $t('X hidden');
      strip.dataset.side = hid;
      if (strip.textContent !== t) { strip.textContent = t; strip.setAttribute('aria-label', $t('Show both planes')); strip.setAttribute('data-tip', $t('Show both planes')); }
    }
    const sig = want.map((w) => w.join('|')).join('/') + '|' + next + '|' + side;
    if (box.dataset.sig !== sig) {
      box.dataset.sig = sig;
      box.replaceChildren(...want.map(([m, label, tip, key]) => h('span', { class: 'mode-chip', 'data-mode': m },
        h('span', { class: 'mc-t' }, label),
        ...(m === next || m === 'tool' ? [h('span', { class: 'kbd' }, 'Esc')] : key ? [h('span', { class: 'kbd' }, key)] : []),
        m === 'listen' ? h('button', { class: 'mc-stop', type: 'button', 'aria-label': tip, 'data-tip': tip, onclick: () => { sndStopPlay(true); updateDraftChips(); } }, $t('Stop'))
          : h('button', { class: 'icon-btn', type: 'button', 'aria-label': tip, 'data-tip': tip, html: ICONS.close, onclick: () => modeClose(m) }))));
    }
    if (box.parentNode !== head) head.insertBefore(box, side === 'R' ? $('rightLed') : $('leftLed'));
    box.hidden = !want.length;
    const ac = $('aloneChip');
    if (ac) {
      let k = ac.querySelector('.kbd');
      if (next === 'alone' && !k) { k = h('span', { class: 'kbd' }, 'Esc'); ac.insertBefore(k, ac.lastElementChild); }
      else if (next !== 'alone' && k) k.remove();
    }
  }
  // the Inspector docks under the chain from 768 to 1023 px; from 1024 a hidden panel opens as the temporary Inspector
  const underChain = () => window.innerWidth >= 768 && window.innerWidth < 1024;
  let tempInsp = false;
  function selectStep(k) {
    setSel(k);
    // ([v17 D4] the Inspector edits what was selected last: a step chosen in the chain replaces the shape it showed)
    if (shapeInspSel()) { selected = null; buildShapeList(); requestRender('L', 'R'); }
    syncSel();
    if (Params.syncUnused) Params.syncUnused();   // ([v16.5 fix user-1] Use in names the selected step)
    if (S.hideRight) {
      if (underChain()) setPanels(S.hideLeft, false);
      else if (window.innerWidth >= 1024) openTemp();
    }
    requestRender('P');
    save();
    tourEmit('step-selected', { k });
  }
  // open step k in the Inspector: select it, show the Inspector (docked, or the temporary one over the stage) and draw
  // it now, so its fields exist
  function inspectStep(k) {
    selectStep(k);
    if (S.hideRight && !tempInsp) setPanels(S.hideLeft, false);
    renderProps();
  }
  function toggleAlone(k) { setFocus(S.focus === k ? 0 : k); requestRender('P'); }
  function toggleBypass(k) {
    const st = S.steps[k - 1];
    if (!st) return;
    st.on = st.on === false; chainChanged(true); commit(); if (st.on) startTransition(k); sndToggleCue(st.on);
  }
  function openTemp() {
    const host = $('propsPanel');
    if (!host) return;
    tempInsp = true;
    host.classList.add('temp');
    host.setAttribute('role', 'dialog'); host.setAttribute('aria-label', $t('Inspector'));
    // (review design-5: with X and Y side by side, an overlay would cover Y's centre; the stage gives the Inspector
    // its width for the time it is open instead. A merged view is wide enough to keep its centre clear.)
    const L = $('paneL').getBoundingClientRect(), R = $('paneR').getBoundingClientRect();
    const lay = document.querySelector('.layout');
    if (L.width > 0 && R.width > 0 && lay && !lay.classList.contains('temp-dock')) { lay.classList.add('temp-dock'); onPaneResize(); }
    requestRender('P');
  }
  function closeTemp() {
    const host = $('propsPanel');
    if (!tempInsp && !(host && host.classList.contains('temp'))) return false;
    tempInsp = false;
    if (host) { host.classList.remove('temp'); host.setAttribute('role', 'region'); host.setAttribute('aria-label', $t('Inspector')); host.style.top = host.style.right = host.style.height = ''; }
    for (const id of ['paneL', 'paneR']) $(id).classList.remove('under-insp');
    const lay = document.querySelector('.layout');
    if (lay && lay.classList.contains('temp-dock')) { lay.classList.remove('temp-dock'); if (paneL && paneR) onPaneResize(); }
    return true;
  }
  // over the stage's right edge, from the planes' top to above the chain; the plane under it keeps its controls clear
  function placeTemp() {
    const host = $('propsPanel');
    if (!tempInsp || !host) return;
    if (!S.hideRight || window.innerWidth < 1024) { closeTemp(); return; }
    const r = $('panes').getBoundingClientRect();
    const lay = document.querySelector('.layout');
    if (lay && lay.classList.contains('temp-dock')) {
      // (docked for the time it is open: the stage's freed right column, the planes' top to the chain's bottom)
      const st = document.querySelector('.layout > .stage').getBoundingClientRect();
      host.style.top = Math.round(st.top) + 'px';
      host.style.height = Math.round(st.height) + 'px';
      host.style.right = Math.round(window.innerWidth - st.right - 8 - 288) + 'px';
      for (const id of ['paneL', 'paneR']) $(id).classList.remove('under-insp');
      return;
    }
    host.style.top = Math.round(r.top) + 'px';
    host.style.height = Math.round(r.height) + 'px';
    host.style.right = Math.round(window.innerWidth - r.right) + 'px';
    for (const id of ['paneL', 'paneR']) { const b = $(id).getBoundingClientRect(); $(id).classList.toggle('under-insp', b.width > 0 && b.right >= r.right - 2); }
  }
  let insp = null;
  let swPhone = null;   // the phone sheet open before a language switch
  function inspector() {
    if (insp) return insp;
    insp = Inspector.create({
      h, $t, $tx, $tn, ICONS, TeX, sub, fsub, wvar, Funcs, Expr, CX, BADGES, CHIP_DEFS,
      host: () => $('propsPanel'), S: () => S, built: () => built, sel: selOf,
      defOf, isDerivStep, isDeriv, activeSteps, stepMenu, inverseAction, replacePalette: (el, k) => openPalette(el, null, { fnOnly: true, replace: k }), toggleAlone, toggleBypass, closeTemp: () => { closeTemp(); requestRender('P'); },
      moveStep: (k, d) => moveStep(k, d), numbersOf: (k) => stepNumbers(k),   // (v16.5 UX81, UX65)
      paramField, zpFields, zpCounts: (st) => ZP_KINDS.map((kind) => zpItems(st, kind).length).join(','), branchTag, exactTexF, copyText, hiStep, tourEmit,
      regionSummary, swatchStyle, kindType, requestRender, shapeInspSig, shapeInspBuild, shapeInspFill, splitStep, lsk, splitInfo: (k) => Funcs.splitSteps(S.steps[k - 1], built[k - 1]), splitHidden: () => tourHold && !tourSplit, splitTour: () => tourHold && tourSplit, fmt: (v) => ((t) => (I18N.lang === 'en' ? t : t.replace(/(\d)\.(\d)/g, '$1,$2')))(CX.fmt(v, 4)),
    });
    return insp;
  }
  function renderProps() {
    const host = $('propsPanel');
    if (!host) return;
    if (!PROPS.ro && window.ResizeObserver) {
      PROPS.ro = new ResizeObserver(() => { if (PROPS.stale && !S.hideRight) requestRender('P'); });
      PROPS.ro.observe(host);
    }
    // a hidden panel costs nothing (unless it is open as the temporary Inspector); it catches up when shown
    if (S.hideRight && !tempInsp) { PROPS.stale = true; return; }
    PROPS.stale = false;
    try { inspector().render(); } catch (e) { console.error('Inspector', e); }
    placeTemp();
  }
  // the copied formula: constants that parse back exactly, and a note for every non-principal branch
  function exactTexF() {
    const act = activeSteps();
    let arg = { s: 'z', p: 4 };
    const notes = [];
    CX.setTexExact(true);
    try {
      for (const k of act) {
        const b = built[k - 1], st = S.steps[k - 1];
        arg = b.tex(arg);
        const usesCut = b.cuts && b.cuts.some((c) => c.editable) || b.usesCut;
        const cut = st.params.cut, kk = Math.round(+st.params.k || 0);
        if (usesCut && cut != null && (+cut !== 180 || kk)) notes.push($t('f_{%{k}}\\text{: cut }%{cut}^\\circ%{sheet}', { k, cut: CX.texNum(+cut), sheet: kk ? $t('\\text{, sheet }%{kk}', { kk }) : '' }));
      }
    } finally { CX.setTexExact(false); }
    return `F(z)=${arg.s}` + (notes.length ? `\\quad(${notes.join(',\\ ')})` : '');
  }
  // the whole figure as an SVG document; opt: {panels: ['L'] | ['R'] | ['L', 'R'], widthIn, caption, morph, upTo}
  // opt.alive(): false once the figure is no longer wanted (the dialog's token moved on): -> null, nothing drawn after
  // opt.morph (the deformation open, morph-figure.md 5): the right panel is the deformation, one plane with X, its
  // image and the paths, for 0 <= t <= end (or up to the current t with opt.upTo), whatever the scrubber shows
  const mfFigCache = { key: '', sel: null };
  // ---- the figure export (src/figure.js; notes/export-design/AS-BUILT.md): the renderer and the state it reads ----
  // artRender(side, o): one plane drawn off-screen in the art layer (fills only) for the exact world window o.box at
  // o.wpt points wide (a globe or the landscape: the pane's picture at o.wpt x o.hpt), in the light theme on white
  // paper, the fills in the print tones o.ink(s), at o.dpi; o.T: the deformation's time (paused). The theme, the
  // tones, the view and t change only inside one synchronous block, so no screen frame ever draws with them.
  // -> {w, h, rgb (opaque on white), land (the landscape's camera)} or null when cancelled (o.alive() false)
  let artLandBox = null;
  Figure.attach({
    h, openMenu, toast, copyText, saveFile, lsk,
    // (v16.5 UX60) Video in the export dialog turns the deformation on, where there is one
    canDeform: () => morphRange().steps.length > 0,
    deformOn: () => { if (!morphRange().steps.length) return false; if (!morph.open) openTransport(); return morphOn(); },
    soundDone: () => sndExportDone(), soundError: () => sndError(),
    art: artRender,
    state: () => ({ alpha: S.alpha, focus: S.focus, lFlat: lFlat(), rImage: rImage(), lGlobe: lGlobe(), rGlobe: rGlobe(), lLand: lLand(), main: S.view.main }),
    viewKind: figViewKind,
    shapes: () => S.shapes.filter((s) => s.visible !== false),
    F: (side) => stageF(side === 'L' ? leftStage() : rightStage()),
    plotF: () => { const hv = homView(); return hv ? hv.F : focusF(); },
    homF: (T) => { const keep = morph.T; morph.T = T; try { const hv = homView(); return hv ? hv.imageF : stageF(rightStage()); } finally { morph.T = keep; } },
    morphLen,
    // L0: the z-plane's window (the shapes' own plane, also at a focused step)
    screenBox: (side) => { if (side !== 'L0') return viewBoxOf(side); const v = S.srcView, w = effW('L'), hh = paneL.h > 20 ? paneL.h : paneR.h; return { x0: v.cx - w / 2 / v.s, x1: v.cx + w / 2 / v.s, y0: v.cy - hh / 2 / v.s, y1: v.cy + hh / 2 / v.s }; },
    // a pane's view (centre, px per unit), for the export window of an unbounded set (independent of the pane's size)
    viewOf: (side) => { const v = side === 'L0' ? S.srcView : side === 'L' ? leftView() : V.right; return { cx: v.cx, cy: v.cy, s: v.s }; },
    landBox: () => landBox(),
    paneAspect: (side) => { const real = side === 'L' ? paneL : paneR, other = side === 'L' ? paneR : paneL; return (real.h > 20 ? real.h : other.h) / effW(side); },
    panelVar,
    fname: () => (morphOn() ? 'H_t' : S.focus === 0 ? 'F' : `f_{${S.focus}}`),
    formulaTex: () => figCapParts().formula,
    formulaRaw: () => figCapParts().raw,
    capParts: figCapParts,
    sheetsClause,   // (v16.1 user-5: the caption's clause on what All sheets draws, from capParts().sheets)
    segsTex: (segs) => captionLatex(segs, true),
    sceneName: figSceneName,
    sceneMeta: () => { const used = Constr.referencedSteps ? Constr.referencedSteps(S) : new Set(); return JSON.parse(JSON.stringify({ shapes: S.shapes.filter((s) => s.visible !== false), steps: S.steps.map((st) => Object.assign({ type: st.type, params: st.params, on: st.on !== false }, st.uid && used.has(st.uid) ? { uid: st.uid } : {}, st.zpIds && used.has(st.uid) ? { zpIds: st.zpIds } : {})), focus: S.focus, pattern: S.pattern, view: S.view, dc: S.dc, height: S.height }, noRuntime)); },   // (review regress-1: step ids only when a shape refers to them)
    chipHTML: (view) => { const name = { xy: 'X → Y', xyL: S.view.main === 'phase' ? $t('Phase') : 'X', xyR: $t('Deformation'), phase: $t('Phase'), land: $t('Landscape'), morph: $t('Deformation') }[view] || $t('Figure'); const c = figCapParts(); return `${name}${c.mapTex ? ` · <i>${c.Fname.replace(/_\{(\d+)\}/, '<sub>$1</sub>')}(${c.lvar.replace(/_\{(\d+)\}/, '<sub>$1</sub>')})</i>` : ''}`; },
    hue: hueBytes,
    // (export round 3) the deformation in every view: on, t, its end, a d/dz step; the plot of X (Phase, Landscape) at
    // time T; the lift of the plane to the Riemann sphere (the globe's vector marks)
    defo: () => { const rt = morphOn() ? rangeTex() : null; return { on: morphOn(), T: morph.T, m: morphLen(), deriv: morphHasDeriv(), rGlobe: rGlobe(), main: S.view.main, paths: S.morphPaths !== false, range: rt ? rt.range : null, pre: rt ? rt.pre : null, post: rt ? rt.post : null, qp: rt ? rt.qp : null, qpz: rt ? rt.qpz : null, wdef: rt ? rt.wdef : null }; },
    plotFAt: (T) => { const keep = morph.T; morph.T = T; try { const hv = homView(); return hv ? hv.F : focusF(); } finally { morph.T = keep; } },
    lift: liftC,
    // (export review r3) the screen's deformation paths (their points z), for the video's Paths
    screenPaths: () => (S.view.main === 'xy' && S.morphPaths !== false && mfCache.sel && mfCache.sel.kept ? mfCache.sel.kept.map((k) => [k.sp.z.re, k.sp.z.im]) : null),
    // the deformation's paths as print vectors (figure.js: the paths figure, plane and globe), and the live globe's
    // chosen points (the globe's paths figure draws the same ones)
    pathsSvg: (items, o) => pathsSvg(items, o),
    pathTimesTex: (m) => pathTimesTex(m),
    pathMarkTimes: (m) => pathMarkTimes(m),
    pathMarksTex: (m) => pathMarksTex(m),
    morphPaths: (o) => figMorphPaths(o),
    globePaths: () => (rGlobe() && S.morphPaths !== false && mfCache.sel && mfCache.sel.globe ? mfCache.sel.kept.map((k) => [k.sp.z.re, k.sp.z.im]) : null),
  });
  // what export and captions (src/export.js) need from the app: its functions and constants, and the state they
  // reassign as getters (and setters for the state they write)
  function exportApi() {
    return {
      BADGES, cauchyKind, C, EX, PATHS, PHASE, V, activeSteps, copyFigureLink, copyText, enOf, exLabel, exactTexF, flushLabels,
      focusDeriv, hov, inkCache, inlineFrac, isDeriv, keyHex, keyRGB, kindType, lColor, lFlat, lGlobe, lLand,
      lPaintsF, lPhase, lPlain, leftStage, leftView, mfFigCache, morph, morphCaption, morphFigureLayers,
      morphHasDeriv, morphHomSegs, morphLen, morphOn, morphRange, nSteps, openMenu, pathOf, pathsGen, patternCell,
      pickScene, rGlobe, rImage, readTheme, refineAllNow, renderLeft, renderRight, requestRender, rightStage,
      runGenSliced, saveScene, shapeTexOf, sheetsClause, sheetsShown, sheetsTexP, sm, smDropExport, smOn,
      smPrepareExport, sndError, sndExportDone, sphN, stageMap, texSegs, toast, wDefSegs, wvar, setOpt,
      get S() { return S; },
      get TH() { return TH; }, set TH(v) { TH = v; },
      get artCam() { return artCam; }, set artCam(v) { artCam = v; },
      get artGlobe() { return artGlobe; }, set artGlobe(v) { artGlobe = v; },
      get artLand() { return artLand; }, set artLand(v) { artLand = v; },
      get artLandBox() { return artLandBox; }, set artLandBox(v) { artLandBox = v; },
      get artMode() { return artMode; }, set artMode(v) { artMode = v; },
      get artNoLab() { return artNoLab; }, set artNoLab(v) { artNoLab = v; },
      get artSkip() { return artSkip; }, set artSkip(v) { artSkip = v; },
      get built() { return built; },
      get chainSig() { return chainSig; },
      get currentExample() { return currentExample; },
      get draft() { return draft; }, set draft(v) { draft = v; },
      get figMode() { return figMode; }, set figMode(v) { figMode = v; },
      get figVec() { return figVec; }, set figVec(v) { figVec = v; },
      get hoverShape() { return hoverShape; }, set hoverShape(v) { hoverShape = v; },
      get offRender() { return offRender; }, set offRender(v) { offRender = v; },
      get paneL() { return paneL; }, set paneL(v) { paneL = v; },
      get paneR() { return paneR; }, set paneR(v) { paneR = v; },
      get printInk() { return printInk; }, set printInk(v) { printInk = v; },
      get probe() { return probe; }, set probe(v) { probe = v; },
      get rHover() { return rHover; }, set rHover(v) { rHover = v; },
      get selected() { return selected; }, set selected(v) { selected = v; },
    };
  }
  // the app calls the module by the old names (as untyped calls: their types stay the module's own)
  const EXP = /** @type {any} */ (Export);
  function getDownloads(...args) { return EXP.getDownloads(...args); }
  function saveFile(...args) { return EXP.saveFile(...args); }
  function prepareExport(...args) { return EXP.prepareExport(...args); }
  function effW(...args) { return EXP.effW(...args); }
  function renderOff(...args) { return EXP.renderOff(...args); }
  function panelVar(...args) { return EXP.panelVar(...args); }
  function capT(...args) { return EXP.capT(...args); }
  function shapePhrase(...args) { return EXP.shapePhrase(...args); }
  function joinList(...args) { return EXP.joinList(...args); }
  function cap1(...args) { return EXP.cap1(...args); }
  function pcTidy(...args) { return EXP.pcTidy(...args); }
  function compositeTexShort(...args) { return EXP.compositeTexShort(...args); }
  function patternSegs(...args) { return EXP.patternSegs(...args); }
  function figureCaption(...args) { return EXP.figureCaption(...args); }
  function captionLatex(...args) { return EXP.captionLatex(...args); }
  function figMorphPaths(...args) { return EXP.figMorphPaths(...args); }
  function buildFigure(...args) { return EXP.buildFigure(...args); }
  function artRender(...args) { return EXP.artRender(...args); }
  function figViewKind(...args) { return EXP.figViewKind(...args); }
  function figSceneName(...args) { return EXP.figSceneName(...args); }
  function figCapParts(...args) { return EXP.figCapParts(...args); }
  function hueBytes(...args) { return EXP.hueBytes(...args); }
  function viewBoxOf(...args) { return EXP.viewBoxOf(...args); }
  function latexDocument(...args) { return EXP.latexDocument(...args); }
  function exportMenuItems(...args) { return EXP.exportMenuItems(...args); }
  function openExportMenu(...args) { return EXP.openExportMenu(...args); }
  function openShareMenu(...args) { return EXP.openShareMenu(...args); }
  function hiStep(...args) { return EXP.hiStep(...args); }

