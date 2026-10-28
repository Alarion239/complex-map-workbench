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
  // the Inspector docks under the chain from 768 to 1023 px; from 1024 a hidden panel opens as the temporary Inspector
  const underChain = () => window.innerWidth >= 768 && window.innerWidth < 1024;
  let tempInsp = false;
  function selectStep(k) {
    S.sel = k;
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
<<<<<<< HEAD
  // ---- export: plane images (PNG) and the map with its guarantees (LaTeX) ----
  // Files go through the viewer's downloads capability in claude.ai (the viewer confirms each save); a copy of the
  // page opened on its own saves with a plain download link.
  let dlNs = null, dlAsked = null, dlDone = false;
  function getDownloads() {
    if (!window.claude || typeof window.claude.use !== 'function') { dlDone = true; dlNs = 'local'; return Promise.resolve('local'); }
    if (!dlAsked) dlAsked = window.claude.use('downloads').then((d) => { dlNs = d; dlDone = true; return d; }).catch(() => { dlDone = true; return null; });
    return dlAsked;
  }
  async function saveFile(filename, data) {
    const d = await getDownloads();
    if (d === 'local') {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob), a = h('a', { href: url, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(matchMedia('(pointer: coarse)').matches ? $t('Saved to Downloads: {filename}', { filename }) : $t('Saved {filename}.', { filename }));
      sndExportDone();
      return true;
    }
    // true only when the file was saved (or handed to the browser's download): a declined or refused save is false, so
    // the export dialog never says "Saved" for it
    if (!d) { sndError(); toast($t('Saving files is not available in this view.')); return false; }
    try {
      const r = await d.save({ filename, data });
      if (r && r.status === 'saved') { toast($t('Saved {filename}.', { filename })); sndExportDone(); return true; }
      return false;
    } catch (e) {
      const code = e && e.code;
      if (code === 'declined') return false;
      sndError();
      toast(code === 'rate_limited' ? $t('Another save is still waiting for your answer.') : $t('The file could not be saved in this view.'));
      return false;
    }
  }
  // ---- article figures ----
  // A figure as a journal would print it: each plane re-rendered at print resolution in the light theme and placed
  // in a thin frame with inward ticks; tick numbers, axis titles, panel letters and the caption typeset by MathJax
  // in the TeX fonts (as vector paths, so the SVG and PDF need no fonts); a colour bar where colour carries a value;
  // a caption written from the chain (regions, the map, the shading, the natural domain, the guarantees). Sizes are
  // set for the printed width: 1 unit = 1/96 in, so text is 8 to 9 pt at 100 %.
  const FIG_DPI = 300;
  const PT = 96 / 72;                  // px per point
  const mjCache = new Map();
  // TeX as a MathJax SVG (vector paths): {markup, w, h, va} at font size px; null without MathJax
  function mj(tex, px, color = '#000') {
    const key = `${px}|${color}|${tex}`;
    if (mjCache.has(key)) return mjCache.get(key);
    const MJ = window.MathJax;
    let out = null;
    if (tex && MJ && typeof MJ.tex2svg === 'function') {
      try {
        const node = MJ.tex2svg(I18N.notation(tex), { display: false });
        const svg = node && node.querySelector('svg');
        if (svg) {
          const ex = px * 0.431;
          const w = parseFloat(svg.getAttribute('width')) * ex, hh = parseFloat(svg.getAttribute('height')) * ex;
          const va = (parseFloat(String(svg.style.verticalAlign || '0').replace('ex', '')) || 0) * ex;
          svg.setAttribute('width', w.toFixed(3)); svg.setAttribute('height', hh.toFixed(3));
          svg.removeAttribute('style'); svg.removeAttribute('role'); svg.removeAttribute('focusable');
          // glyphs are filled paths: a zero-width stroke prints as a hairline in PDF viewers (text looks bold)
          let markup = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, color).replace(/\sstroke="[^"]*"/g, ' stroke="none"').replace(/\sstroke-width="[^"]*"/g, '');
          if (!/^<svg[^>]*\sxmlns="/.test(markup)) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          if (w > 0 && hh > 0) out = { markup, w, h: hh, va };
        }
      } catch (e) { out = null; }
    }
    if (!out) {
      // without MathJax: the TeX source as plain serif text (rare: MathJax loads with the page)
      const t = String(tex).replace(/\\(operatorname|text|mathrm|textbf)\{([^}]*)\}/g, '$2').replace(/[{}\\]/g, '').replace(/\^/g, '').replace(/_/g, '');
      const w = t.length * px * 0.5, hh = px * 1.2;
      out = { markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}"><text x="0" y="${px}" font-family="Times New Roman, Times, serif" font-style="italic" font-size="${px}" fill="${color}">${t.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</text></svg>`, w, h: hh, va: -px * 0.2 };
    }
    if (mjCache.size > 2000) mjCache.clear();
    mjCache.set(key, out);
    return out;
  }
  // place a typeset item with its baseline at (x, y); anchor: 'start' | 'middle' | 'end'
  function mjAt(it, x, y, anchor = 'start') {
    const left = anchor === 'middle' ? x - it.w / 2 : anchor === 'end' ? x - it.w : x;
    const top = y - it.h - it.va;
    return it.markup.replace('<svg', `<svg x="${left.toFixed(2)}" y="${top.toFixed(2)}"`);
  }
  // SPEC 10.6: prepareExport(panels, alive) -> true when the export may draw, false when it was cancelled (alive()
  // turned false: an option changed or the dialog closed). Asynchronous and time-sliced: it refines the lines and
  // waits (bounded, polling every 25 ms, never blocking) for the inverse programs that each panel's current view draws
  // with: the right plane or the w-globe (role R), the left plane at a focused stage or the z-globe (role L, also at
  // stage 0), so renderOff then draws exact images synchronously. P5: dims {pw (figure px per panel), dpr}: the
  // SphereMesh jobs of the flat panels' forward shapes at the export's resolution (smPrepareExport).
  async function prepareExport(panels, alive = () => true, morphFig = false, dims = null) {
    // the lines' settle-time refinement, if it has not landed yet (a figure never carries today's samples)
    try { if (!(await refineAllNow(alive))) return false; } catch (e) { console.error('line refinement', e); }
    if (!alive()) return false;
    if (dims && smOn()) {
      const panes = [];
      for (const side of panels) {
        const real = side === 'L' ? paneL : paneR, v = side === 'L' ? leftView() : V.right;
        if (side === 'R' ? !rImage() || (morphOn() && !morphFig) : !(lPlain() && leftStage() > 0)) continue;
        const k = dims.pw / effW(side), ov = dims.views && dims.views[side], ph = ov ? ov.ph : dims.pw * real.h / effW(side);
        panes.push({ role: side, map: stageMap(side === 'R' ? rightStage() : leftStage()), pane: { view: ov ? { cx: ov.cx, cy: ov.cy, s: ov.s } : { cx: v.cx, cy: v.cy, s: v.s * k }, dpr: dims.dpr, pw: Math.max(1, Math.round(dims.pw * dims.dpr)), ph: Math.max(1, Math.round(ph * dims.dpr)) } });
      }
      try { if (!(await smPrepareExport(panes, alive, dims.gen || 0))) return false; } catch (e) { console.error('SphereMesh export', e); }
    }
    if (!GLR.ok || !GLR.inverseRequest || S.exactImages === false) return true;
    const kinds = new Set();
    const need = (role, kind, map) => {
      if (!PHASE[role][kind]) return;
      if (S.shapes.some((s) => s.visible !== false && kindType(s) === 'area' && pathOf(s, map, role, kind, { status: true }).path === 'pending')) kinds.add(kind);
    };
    // (the deformation figure draws the region at t = end: the stage map, exact; morph-figure.md 6.4)
    if (panels.includes('R') && (!morphOn() || morphFig)) need('R', rGlobe() ? 'globe' : 'flat', stageMap(rightStage()));
    if (panels.includes('L') && (lPlain() || (lGlobe() && !lPhase()))) need('L', lGlobe() ? 'globe' : 'flat', stageMap(leftStage()));
    const t0 = performance.now();
    while (kinds.size && performance.now() - t0 < 4000) {
      if (!alive()) return false;
      if (![...kinds].map((k) => GLR.inverseRequest(S.alpha, k)).includes('pending')) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    return alive();
  }
  // a canvas as a PNG data URL, encoded off the main thread (toBlob), so a 300 dpi raster does not block the page
  function canvasURL(cv) {
    return new Promise((res, rej) => {
      try {
        cv.toBlob((b) => {
          if (!b) { try { res(cv.toDataURL('image/png')); } catch (e) { rej(e); } return; }
          const fr = new FileReader();
          fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error);
          fr.readAsDataURL(b);
        }, 'image/png');
      } catch (e) { rej(e); }
    });
  }
  // a pane's CSS width for the export: a pane hidden by a merged view (merged-views.md) takes the width it has in the
  // split view, half of the wide panel beside the gutter
  function effW(side) {
    const real = side === 'L' ? paneL : paneR, other = side === 'L' ? paneR : paneL;
    return real.w > 20 || !(other.w > 20) ? real.w : Math.max(1, (other.w - 8) / 2);
  }
  // a plane drawn off-screen at print size: views scaled so the same window shows; selection, hover and probe off
  function renderOff(side, w, h, dpr) {
    const cv = document.createElement('canvas'), ov = document.createElement('canvas');
    const off = new Pane(cv, ov);
    off.w = w; off.h = h; off.dpr = dpr;
    cv.width = ov.width = Math.max(1, Math.round(w * dpr)); cv.height = ov.height = Math.max(1, Math.round(h * dpr));
    const k = w / effW(side);
    const scaled = new Map();
    for (const v of [S.srcView, V.left, V.right]) if (v && !scaled.has(v)) { scaled.set(v, v.s); v.s *= k; }
    // (the outline of the left view in the image is a screen aid, not part of a figure; so is the colour key under the
    // Y plane (the Key switch): a figure's Y panel would carry colours its caption and key do not explain)
    const keep = { L: paneL, R: paneR, probe, rHover, selected, hoverShape, draft, hw: hov.w, hl: hov.list, fov: S.fov, wKey: S.wKey };
    probe = null; rHover = null; selected = null; hoverShape = null; draft = null; hov.w = null; hov.list = null; S.fov = false; S.wKey = false; figMode = true;
    // numbers drawn inside the plot (landscape axes, labels) in the serif of the figure, not the app's monospace
    const mono = TH.mono; TH.mono = TH.math;
    // exact images (SPEC 10.6): prepareExport has waited for the inverse programs; one still compiling (normally
    // none) is waited for here, and only then
    const wait = GLR.ok && GLR.inverseStatus && (GLR.inverseStatus(S.alpha, 'flat') === 'pending' || GLR.inverseStatus(S.alpha, 'globe') === 'pending');
    // the forward programs are always waited for: a deformation frame may need a map mode the screen never drew
    // (gl.js MAP compiles one program per mode), and a static program's first use no longer waits on screen
    const waitFwd = GLR.ok;
    offRender = true;
    if (wait) GLR.syncCompile = true;
    if (waitFwd) GLR.syncPrograms = true;
    try {
      if (side === 'L') { paneL = off; renderLeft(); } else { paneR = off; renderRight(); }
      // labels are placed in a microtask on screen; here they are needed before the pixels are read
      if (off.labels) flushLabels(off, off.labels);
    } finally {
      if (wait) GLR.syncCompile = false;
      if (waitFwd) GLR.syncPrograms = false;
      offRender = false;
      paneL = keep.L; paneR = keep.R;
      for (const [v, s] of scaled) v.s = s;
      probe = keep.probe; rHover = keep.rHover; selected = keep.selected; hoverShape = keep.hoverShape; draft = keep.draft; hov.w = keep.hw; hov.list = keep.hl; S.fov = keep.fov; S.wKey = keep.wKey; figMode = false; TH.mono = mono;
    }
    return cv;
  }
  // the world window a plane panel shows at width w (figure px)
  function panelBox(side, w, h) {
    const v = side === 'L' ? leftView() : V.right;
    const s = v.s * w / effW(side);
    return { x0: v.cx - w / 2 / s, x1: v.cx + w / 2 / s, y0: v.cy - h / 2 / s, y1: v.cy + h / 2 / s };
  }
  // export takes each pane's view (U-b): a plane panel is X Plane (with or without Phase) or Y Plane
  const isPlanePanel = (side) => (side === 'L' ? lFlat() : rImage());
  // the variable of a panel's coordinates, in TeX
  function panelVar(side) {
    if (side === 'L') return leftStage() === 0 ? 'z' : `w_{${leftStage()}}`;
    return S.focus === 0 ? 'w' : `w_{${rightStage()}}`;
  }
  // a tick number in TeX: as few decimals as the step needs; powers of ten far from 1
  function tickTex(v, step) {
    if (Math.abs(v) < step * 1e-9) return '0';
    const av = Math.abs(v);
    if (av >= 1e5 || step < 1e-4) {
      const e = Math.floor(Math.log10(av)), m = v / 10 ** e;
      const ms = (+m.toFixed(Math.max(0, Math.min(6, e - Math.floor(Math.log10(step)))))).toString();
      return ms === '1' ? `10^{${e}}` : ms === '-1' ? `-10^{${e}}` : `${ms}\\times 10^{${e}}`;
    }
    const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    let t = v.toFixed(Math.min(dec, 8));
    if (t.includes('.')) t = t.replace(/\.?0+$/, '');
    return t;
  }
  // the colour key of a panel, when colour carries a value: arg F (phase), the stretch factor (Image, Stretch)
  function panelKey(side) {
    const stopsFrom = (f) => Array.from({ length: 25 }, (_, i) => [i / 24, f(i / 24)]);
    const hueAt = (t) => keyHex((2 * t - 1) * Math.PI); // t in [0, 1] -> arg from -pi to pi, colours of the legend wheel
    const Fn = side === 'L' && morphOn() && lPaintsF() ? 'H_t' : S.focus === 0 ? 'F' : focusDeriv() ? `w_{${S.focus}}` : `f_{${S.focus}}`;
    if (side === 'L' && lColor() && S.dc !== 'classic') return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.25, '-\\frac{\\pi}{2}'], [0.5, '0'], [0.75, '\\frac{\\pi}{2}'], [1, '\\pi']] };
    if (side === 'L' && lColor()) return { title: `|${Fn}|`, stops: [[0, '#000000'], [0.5, '#8a8f93'], [1, '#ffffff']], ticks: [[0, '0'], [0.5, '1'], [1, '\\infty']] };
    if (side === 'R' && rImage() && S.pattern === 'stretch') return { title: `|${Fn}'|`, stops: [[0, TH.stretchShrink], [0.5, TH.stretchMid], [1, TH.stretchGrow]], ticks: [[0, '\\tfrac18'], [0.5, '1'], [1, '8']] };
    if (side === 'L' && lGlobe() && lPhase()) return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.5, '0'], [1, '\\pi']] };
    if (side === 'L' && lLand() && lPhase()) return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.5, '0'], [1, '\\pi']] };
    return null;
  }
  // ---- the caption, as segments: {t: text} and {m: TeX}; also as LaTeX source ----
  const texEsc = (s) => String(s).replace(/\\/g, '\\textbackslash{}').replace(/([#$%&_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
  // a caption sentence as segments: the template is translated whole (DESIGN.md 1) and its %{slots} hold segments,
  // so the word order follows the language. cs 'gen': the genitive form ("the images of ...", Russian needs the case)
  // (a plain-string value joins the text around it, as one segment)
  const capT = (src, params, cs) => {
    const out = [];
    for (let x of I18N.parts(src, params, cs)) {
      if (typeof x === 'string' || typeof x === 'number') { x = String(x); if (!x) continue; const l = out[out.length - 1]; if (l && l._s) l.t += x; else out.push({ t: x, _s: 1 }); } else out.push(...(Array.isArray(x) ? x : [x]));
    }
    return out.map((g) => (g._s ? { t: g.t } : g));
  };
  function shapePhrase(s, idx, cs) {
    let tex = '';
    try { tex = shapeTexOf(s); } catch (e) { tex = ''; }
    // a drawn area is a closed set (Region.isOpen, spec 6.5: only open boundaries are drawn dashed), so its caption
    // says so: the disc |z| <= 2, and its complement |z| > 2 is the open set. Typed formulas keep their own relations
    if (tex && kindType(s) === 'area' && s.kind !== 'formula') tex = tex.replace(/</g, '\\le ').replace(/>/g, '\\ge ');
    // inline maths as journals set it: plain bars and a slashed fraction, not \left|...\right| or a stacked \frac
    if (tex) tex = inlineFrac(tex.replace(/\\left\|/g, '|').replace(/\\right\|/g, '|').replace(/\\left\(/g, '(').replace(/\\right\)/g, ')')).replace(/\\tfrac\{([^{}]+)\}\{([^{}]+)\}/g, '$1/$2');
    const P = (a) => CX.tex(C(a[0], a[1]), 3);
    const M = (m) => ({ m });
    // (phrase(c): the shape in case c; the complement names its shape in the genitive: «дополнение круга», math-4)
    const phrase = (c) => {
      const sp = (src, params) => capT(src, params, c);
      // (v16: constructions by their definitions; [v16.4 review user-2, user-3] a phrase that must be closed when more text
      // follows (a Russian participial phrase, a stacked "in the domain") ends with a closing comma, {pc}: pcTidy drops it
      // before punctuation and at the end)
      if (s.def || s.at) { const ph = Construct.phrase(s, P); if (ph) { const r = sp(ph.src, ph.params); if (ph.close) r.push({ t: ',', pc: 1 }); return r; } }
      // a shape added from an equation, as recognized: by its equation
      if (s.srcTex && tex === s.srcTex && s.kind !== 'point') {
        switch (s.kind) {
          case 'line': return sp('the line %{m}', { m: M(tex) });
          case 'ray': return sp('the ray %{m}', { m: M(tex) });
          case 'segment': return sp('the segment %{m}', { m: M(tex) });
          case 'circle': return sp('the circle %{m}', { m: M(tex) });
          case 'arc': return sp('the arc %{m}', { m: M(tex) });
          case 'fcurve': return sp('the curve formula %{m}', { m: M(tex) });
          default: return sp('the %{kind} %{m}', { kind: Region.KINDS[s.kind].label.toLowerCase(), m: M(tex) });
        }
      }
      switch (s.kind) {
        case 'point': {
          // (a label that is a word, "trailing edge", is set as text, not as a product of italic letters)
          // a name that is a word: "the trailing edge $z=1$", not a symbol "$\\text{trailing edge}=1$"
          if (s.label && (I18N.lang === 'en' ? /[A-Za-z]{2}|\s/ : /\p{L}{2}|\s/u).test(exLabel(s.label))) return sp('the %{label} %{m}', { label: String(exLabel(s.label)).trim(), m: M(`z=${P(s.p)}`) });
          const lab = s.label ? s.label.replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2') : `z_{${idx}}`;
          return sp('the point %{m}', { m: M(`${lab}=${P(s.p)}`) });
        }
        case 'segment': return sp('the segment %{m}', { m: M(`[${P(s.a)},\\,${P(s.b)}]`) });
        // (a line stored from a cap on a globe has a unit direction and is written by its equation, Region normalTex)
        // (v16 review picture-7: "\text{…}" in any language is the line-through form: by its two points, never as maths)
        case 'line': return tex && !/^\\text\{/.test(tex) ? sp('the line %{m}', { m: M(tex) }) : sp('the line through %{a} and %{b}', { a: M(P(s.a)), b: M(P(s.b)) });
        case 'ray': return sp('the ray from %{a} through %{b}', { a: M(P(s.a)), b: M(P(s.b)) });
        case 'circle': return sp('the circle %{m}', { m: M(tex) });
        case 'arc': return sp('the arc from %{a} through %{m} to %{b}', { a: M(P(s.a)), m: M(P(s.m)), b: M(P(s.b)) });
        case 'curve': return sp('a freehand curve', {});
        case 'disc': return sp('the disc %{m}', { m: M(tex) });
        case 'rect': return sp('the rectangle %{m}', { m: M(tex) });
        // (the genitive has no plural pair of its own: $tn takes no context; 'вершинами' is right for every n but 21, 31, ...)
        case 'polygon': return [{ t: c === 'gen' ? $tx('gen', 'a polygon with {n} vertices', { n: s.pts.length }) : $tn('a polygon with {n} vertices', 'a polygon with {n} vertices', s.pts.length) }];
        case 'halfplane': return sp('the half-plane %{m}', { m: M(tex) });
        case 'annulus': return sp('the annulus %{m}', { m: M(tex) });
        case 'sector': return capT('the sector %{m}', { m: M(tex) }, s.r > 0 ? c : c === 'gen' ? 'gen-angle' : 'angle');
        case 'formula': return sp('the set %{m}', { m: M(tex) });
        case 'fcurve': return sp('the curve %{m}', { m: M(tex) });
        // (the grid's name is a translated \text{} at the front of its TeX: review math-3)
        case 'cgrid': return sp('a Cartesian grid on %{m}', { m: M(tex.replace(/^\\text\{[^{}]*\}\s*/, '')) });
        case 'pgrid': return sp('a polar grid in %{m}', { m: M(tex.replace(/^\\text\{[^{}]*\},\s*/, '')) });
        default: return Region.KINDS[s.kind] ? sp('a %{kind}', { kind: Region.KINDS[s.kind].label.toLowerCase() }) : sp('a shape', {});
      }
    };
    // (v16: a 3-point region and a bound half-plane say their side themselves: "the outside of the circle through …")
    if (s.complement && kindType(s) === 'area' && !(s.def || (s.at && s.kind === 'halfplane'))) return capT('the complement of %{segs}', { segs: phrase('gen') }, cs);
    return phrase(cs);
  }
  const joinList = (items) => { // [[segs], ...] -> segs joined with commas and "and"
    const out = [];
    items.forEach((it, i) => {
      if (i) out.push({ t: i === items.length - 1 ? (items.length > 2 ? $tx('list', ', and ') : $tx('list', ' and ')) : ', ' });
      out.push(...it);
    });
    return out;
  };
  const cap1 = (segs) => { const s = segs.slice(); if (s[0] && s[0].t) s[0] = { t: s[0].t.charAt(0).toUpperCase() + s[0].t.slice(1) }; return s; };
  // [v16.4 review user-2] a phrase's closing comma ({pc}) stays only before more words: it goes before punctuation, an
  // opening bracket, another comma and at the end (keepEnd: a list that a template continues; it is left as PC_MARK,
  // which figure.js's polish resolves the same way once the sentence is whole). [verify-1] It also goes before the
  // English "and" (a list's or a meet's): there it would read as a list break; Russian keeps it («…, и~…»)
  const PC_MARK = '\u2063';
  function pcTidy(segs, keepEnd) {
    if (!segs.some((g) => g.pc)) return segs;
    return segs.filter((g, i) => {
      if (!g.pc) return true;
      const nx = segs.slice(i + 1).find((x) => x.m != null || x.b != null || (x.t != null && /\S/.test(x.t)));
      if (!nx) return !!keepEnd;
      return !(nx.t != null && /^\s*(?:[,.;:()]|and\b)/.test(nx.t));
    }).map((g, i, a) => (g.pc && keepEnd && !a.slice(i + 1).some((x) => x.m != null || x.b != null || (x.t != null && /\S/.test(x.t))) ? { t: PC_MARK } : g));
  }
  function compositeTexShort() {
    const act = activeSteps();
    let arg = { s: 'z', p: 4 };
    for (const j of act) arg = built[j - 1].tex(arg);
    return act.length ? (arg.s.length <= 320 ? arg.s : null) : 'z';
  }
  // the sentence on the image's shading (the pattern carried from the z-plane)
  function patternSegs(Fname) {
    const cell = { m: I18N.texNum(CX.fmtNum(patternCell(), 3)) }, z = { m: 'z' };
    switch (S.pattern) {
      case 'checker': return capT(' Regions are shaded by a checkerboard of squares of side %{cell} in the %{z}-plane, carried by the map.', { cell, z });
      case 'polar': return capT(' Regions are shaded by a log-polar checkerboard in the %{z}-plane, whose cells stay square under conformal maps.', { z });
      case 'tiles': return capT(' Regions are shaded by tiles marked with the letter F, which show rotation, scaling and reflection.', {});
      case 'grid': return capT(' Lines are the coordinate lines of the %{z}-plane, spaced %{cell}.', { z, cell });
      case 'polargrid': return capT(' Lines are circles about 0 and rays from 0 in the %{z}-plane.', { z });
      case 'phase': return capT(' Regions are coloured by the argument of the source point.', {});
      case 'stretch': return capT(' The colour shows the local scale factor %{F} (bar).', { F: { m: `|${Fname}'|` } });
      case 'sphere': return capT(' Regions are shaded by a checkerboard of %{n} longitude sectors and %{n2} latitude bands of the Riemann sphere of the %{z}-plane, carried by the map.', { n: { m: String(sphN()) }, n2: { m: String(sphN() / 2) }, z });
      default: return [];
    }
  }
  function figureCaption(panels) {
    const out = [];
    const push = (...xs) => out.push(...xs);
    const both = panels.length === 2;
    const vis = S.shapes.filter((s) => s.visible !== false);
    let pi = 0;
    const shapeList = joinList(vis.map((s) => { const r = shapePhrase(s, s.kind === 'point' ? pi : 0); if (s.kind === 'point') pi++; return r; }));
    const lv = panelVar('L'), Fname0 = S.focus === 0 ? 'F' : `f_{${S.focus}}`;
    const Ftex = S.focus === 0 ? compositeTexShort() : (built[S.focus - 1] && !built[S.focus - 1].error ? built[S.focus - 1].tex({ s: lv, p: 4 }).s : null);
    const mapF = Ftex ? `${Fname0}(${lv})=${Ftex}` : `${Fname0}`;
    // the deformation drawn in one panel (Phase or Landscape of H_t, or X → Y's merged globe): the picture is H_t at
    // the current t, so the caption names H_t and says which t and which homotopy (merged-views review)
    const hm = morphOn() && (panels.includes('L') ? lPaintsF() : true);
    const Fname = hm ? 'H_t' : Fname0, mapM = hm ? 'H_t' : mapF;
    const homDef = () => {
      const m = morphLen(), hom = morphHomSegs(m);
      if (hom.rt) return [...capT(' Shown at %{t}, where %{H} deforms %{QP} (%{t0}) into %{map} (%{tm}); it is %{hom}.', { t: { m: `t=${I18N.texNum(morph.T.toFixed(2))}` }, H: { m: hom.rt.H }, QP: { m: hom.rt.qp }, t0: { m: 't=0' }, map: { m: mapF }, tm: { m: `t=${m}` }, hom: hom.segs }), ...wDefSegs(hom.rt)];
      return capT(' Shown at %{t}, where %{H} deforms the identity (%{t0}) into %{map} (%{tm}) along %{hom}.', { t: { m: `t=${I18N.texNum(morph.T.toFixed(2))}` }, H: { m: 'H_t' }, t0: { m: 't=0' }, map: { m: mapF }, tm: { m: `t=${m}` }, hom: hom.segs });
    };
    // the plane of X in three cases (Russian: nominative, after «в»/«на», after «над»)
    const planeName = (cs) => (leftStage() === 0 ? capT('the %{z}-plane', { z: { m: 'z' } }, cs) : capT('the %{w}-plane, the input of %{F}', { w: { m: lv }, F: { m: Fname } }, cs));
    const lab = (c) => (both ? [{ b: `(${c})` }, { t: ' ' }] : []);
    // (a): X, with its view (U-b): the shapes, or what X's paint shows of the map
    const phaseText = (onWhat) => {
      const st = S.dc, r = [], F = { m: `|${Fname}|` }, arg = { m: `\\arg ${Fname}` };
      r.push(...capT('The phase portrait of %{map}', { map: { m: mapM } }), ...onWhat);
      if (st === 'classic') r.push(...capT('brightness increases with %{F}, so zeros are black and poles white.', { F }));
      else if (st === 'phase') r.push(...capT('the colour shows %{arg} (bar).', { arg }));
      else if (st === 'modulus') r.push(...capT('the colour shows %{arg} (bar); lines are level curves of %{F} and of %{arg}.', { arg, F }));
      else if (st === 'grid') r.push(...capT('the colour shows %{arg} (bar); lines are the preimages of the coordinate lines of the image plane.', { arg }));
      else if (st === 'cauchy') r.push(...capT('the Cauchy integral %{I} over the selected closed curve, which equals %{F} inside and %{zero} outside.', { I: { m: '\\frac{1}{2\\pi i}\\oint_\\gamma \\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta' }, F: { m: 'F' }, zero: { m: '0' } }));
      else r.push(...capT('the colour shows %{arg} (bar), and the shading steps in %{F} by factors of %{k}, so phase lines and modulus lines meet in near-squares where the map is conformal.', { arg, F, k: { m: `e^{2\\pi/${S.sectors || 12}}\\approx ${I18N.texNum(CX.fmtNum(Math.exp(TAU / (S.sectors || 12)), 2))}` } }));
      return r;
    };
    const inf = { m: '\\infty' };
    if (panels.includes('L')) {
      if (lColor()) push(...lab('a'), ...phaseText([{ t: $tx('cap', ' on ') }, ...planeName('prep'), { t: ': ' }]));
      else if (lGlobe() && lPhase()) push(...lab('a'), ...capT('The phase portrait of %{map} on the Riemann sphere, with %{inf} at the north pole.', { map: { m: mapM }, inf }));
      else if (lLand()) {
        const ht = { log: `\\log|${Fname}|`, abs: `|${Fname}|`, re: `\\operatorname{Re} ${Fname}`, im: `\\operatorname{Im} ${Fname}` }[S.height || 'log'];
        // (v16.1 user-5: what All sheets draws, exactly; while deforming, the sheets of H_t that become those of F,
        // notes/v16-user5/SHEETS-DESIGN.md; the multivalued notation only when it draws F's own sheets)
        const shw = sheetsShown(), shc = shw ? sheetsClause(shw, 'tex', Fname0) : null;
        push(...lab('a'), ...capT('The landscape of %{map}', { map: { m: shw && !shw.hom ? I18N.notation(mapM, undefined, { multi: true }) : mapM } }), { t: $tx('cap', ' over ') }, ...planeName('ins'), ...capT(': the height is %{h}', { h: { m: ht } }), ...(lPhase() ? capT(' and the colour %{arg} (bar)', { arg: { m: `\\arg ${Fname}` } }) : []), ...(shc ? (shc.src ? capT(shc.src, sheetsTexP(shc.p, (m) => ({ m }))) : [{ t: shc.p.text }]) : [{ t: $t('; zeros are pits and poles are peaks.') }]), ...(shc && shc.then ? texSegs($t(shc.then.src, shc.then.p)) : []));
      } else if (vis.length) push(...lab('a'), ...cap1(shapeList), { t: $tx('cap', ' in ') }, ...planeName('prep'), { t: lGlobe() ? $t(', on the Riemann sphere.') : '.' });
      else push(...lab('a'), ...cap1(planeName()), { t: '.' });
      if (both) push({ t: ' ' });
    }
    // (b): Y, the images (the shape list in the genitive: "the images of ...")
    let pg = 0;
    const listGen = () => joinList(vis.map((s) => { const r = shapePhrase(s, s.kind === 'point' ? pg : 0, 'gen'); if (s.kind === 'point') pg++; return r; }));
    if (panels.includes('R') && hm) {
      const r = [...capT('The deformation %{H}', { H: { m: 'H_t' } }), ...(rGlobe() ? capT(' on the Riemann sphere, with %{inf} at the north pole', { inf }) : [])];
      if (vis.length) r.push(...capT(': the image of %{list} under %{H}, over the set itself in grey.', { list: listGen(), H: { m: 'H_t' } }));
      else r.push({ t: '.' });
      push(...r);
    } else if (panels.includes('R')) {
      const r = [];
      const named = vis.length && (!panels.includes('L') || !lPlain() && !(lGlobe() && !lPhase()));
      const map = { m: mapM };
      if (rGlobe()) r.push(...(vis.length ? (named ? capT('The images of %{list} under %{map} on the Riemann sphere, with %{inf} at the north pole.', { list: listGen(), map, inf }) : capT('Their images under %{map} on the Riemann sphere, with %{inf} at the north pole.', { map, inf })) : capT('The image under %{map} on the Riemann sphere, with %{inf} at the north pole.', { map, inf })));
      else if (named) r.push(...capT('The images of %{list} under %{map}.', { list: listGen(), map }));
      else r.push(...(vis.length ? capT('Their images under %{map}.', { map }) : capT('The map %{map}.', { map })));
      push(...lab('b'), ...r);
    }
    // the shading (Image)
    if (panels.includes('R') && rImage() && vis.some((s) => kindType(s) === 'area')) push(...patternSegs(Fname));

    if (vis.some((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s))) push({ t: $t(' Dashed boundaries do not belong to the sets.') });
    if (hm) push(...homDef());
    // the chain, when F has several steps
    const act = activeSteps();
    if (act.length > 1 && S.focus === 0) {
      const defs = act.map((j) => {
        const b = built[j - 1];
        if (isDeriv(j)) return [{ m: `w_{${j}}=\\frac{d w_{${j - 1}}}{dz}` }];
        return [{ m: `f_{${j}}(${j === 1 ? 'z' : 'w'})=${b.tex({ s: j === 1 ? 'z' : 'w', p: 4 }).s}` }];
      });
      const hasD = act.some((j) => isDeriv(j));
      push(...(hasD ? capT(' Here the chain is built step by step from %{w0}: %{defs}.', { w0: { m: 'w_0=z' }, defs: joinList(defs) }) : capT(' Here %{F} with %{defs}.', { F: { m: `F=${act.slice().reverse().map((j) => `f_{${j}}`).join('\\circ ')}` }, defs: joinList(defs) })));
    }
    // the natural domain and the guarantees
    const P = Funcs.composeProps(act.map((j) => built[j - 1].props));
    const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective });
    const conds = [];
    for (const j of act) { const b = built[j - 1]; if (b.domain) conds.push(b.domain(wvar(j - 1))); }
    const deg = P.deg != null ? (P.degExact ? $t(' of degree {deg}', { deg: P.deg }) : $t(' of degree at most {deg}', { deg: P.deg })) : '';
    const props = [];
    if (words.mobius) props.push([{ t: $tx('cap', 'a Möbius transformation') }]);
    else if (words.polynomial) props.push([{ t: $tx('cap', 'a polynomial{deg}', { deg }) }]);
    else if (words.rational) props.push([{ t: $tx('cap', 'rational{deg}', { deg }) }]);
    if (words.entire && !words.polynomial && !words.mobius) props.push([{ t: $tx('cap', 'entire') }]);
    else if (words.analytic && !words.entire && !words.rational && !words.polynomial && !words.mobius) props.push([{ t: $tx('cap', 'analytic') }]);
    if (words.proper) props.push([{ t: $tx('cap', 'proper') }]);
    if (words.conformal) props.push([{ t: $tx('cap', 'conformal onto its image') }]);
    else if (words.homeo) props.push([{ t: $tx('cap', 'a homeomorphism onto its image') }]);
    if (act.length) {
      const generic = conds.filter((c) => /^\\text\{the formula is defined at/.test(c)), sets = conds.filter((c) => !generic.includes(c));
      conds.length = 0; conds.push(...sets);
      const D = { m: `D=\\{z : ${conds.join(',\\ ')}\\}` };
      const onD = !conds.length && generic.length ? capT(' Where the formula is defined, ', {}) : conds.length ? (conds.some((c) => /w_\{/.test(c)) ? capT(' On its natural domain %{D} (with %{wk} the value after step %{k}), ', { D, wk: { m: 'w_k' }, k: { m: 'k' } }) : capT(' On its natural domain %{D}, ', { D })) : [{ t: ' ' }];
      if (props.length) push(...onD, ...(props.length > 1 ? capT('%{F} is %{props}; these properties are guaranteed by the chain.', { F: { m: 'F' }, props: joinList(props) }) : capT('%{F} is %{props}; this is guaranteed by the chain.', { F: { m: 'F' }, props: joinList(props) })));
      else push(...onD, { t: conds.length ? $t('the chain guarantees none of the tracked properties.') : $t('The chain guarantees none of the tracked properties.') });
    }
    return out;
  }
  // the caption as LaTeX source (for \caption{...})
  function captionLatex(segs, keepEnd) {
    return pcTidy(segs, keepEnd).map((s) => (s.m != null ? `$${s.m}$` : s.b != null ? `\\textbf{${texEsc(s.b)}}` : texEsc(s.t).replace(/Möbius/g, 'M\\"obius'))).join('').replace(/\s+/g, ' ').trim();
  }
  // lay the caption out in lines of width W (justified, the last line ragged); returns {markup, h}
  // ragged: ragged-right lines (the deformation's captions, morph-figure.md 5), else justified with capped gaps
  function layoutCaption(segs, x0, y0, W, px, ragged = false) {
    const items = [];
    segs = pcTidy(segs);
    const sp = mj('\\text{a b}', px).w - mj('\\text{ab}', px).w || px * 0.33;
    for (const s of segs) {
      if (s.m != null) { items.push({ it: mj(s.m, px), glue: false }); continue; }
      const text = s.b != null ? s.b : s.t;
      const parts = text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        if (/^\s+$/.test(p)) { items.push({ space: true }); continue; }
        const tex = s.b != null ? `\\textbf{${texEsc(p)}}` : `\\text{${texEsc(p)}}`;
        items.push({ it: mj(tex, px) });
      }
    }
    // words joined by no space stay together (a word followed by math, "z-plane")
    const words = [];
    let cur = [];
    for (const i of items) {
      if (i.space) { if (cur.length) { words.push(cur); cur = []; } continue; }
      cur.push(i.it);
    }
    if (cur.length) words.push(cur);
    const lineH = px * 1.42;
    const lines = [];
    let line = [], lw = 0;
    for (const wd of words) {
      const ww = wd.reduce((a, it) => a + it.w, 0);
      if (line.length && lw + sp + ww > W) { lines.push({ words: line, w: lw }); line = []; lw = 0; }
      line.push({ parts: wd, w: ww });
      lw += (line.length > 1 ? sp : 0) + ww;
    }
    if (line.length) lines.push({ words: line, w: lw, last: true });
    let markup = '', y = y0 + px;
    for (const ln of lines) {
      const gaps = ln.words.length - 1;
      const extra = !ragged && !ln.last && gaps > 0 ? (W - ln.w) / gaps : 0;
      let x = x0;
      ln.words.forEach((wd, i) => {
        for (const it of wd.parts) { markup += mjAt(it, x, y); x += it.w; }
        x += sp + (i < gaps ? Math.min(extra, sp * 3) : 0);
      });
      y += lineH;
    }
    return { markup, h: lines.length ? (lines.length - 1) * lineH + px * 1.35 : 0 };
  }
=======
>>>>>>> claude/w0-lint-types-33
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
      BADGES, C, EX, PATHS, PHASE, V, activeSteps, copyFigureLink, copyText, enOf, exLabel, exactTexF, flushLabels,
      focusDeriv, hov, inkCache, inlineFrac, isDeriv, keyHex, keyRGB, kindType, lColor, lFlat, lGlobe, lLand,
      lPaintsF, lPhase, lPlain, leftStage, leftView, mfFigCache, morph, morphCaption, morphFigureLayers,
      morphHasDeriv, morphHomSegs, morphLen, morphOn, morphRange, nSteps, openMenu, pathOf, pathsGen, patternCell,
      pickScene, rGlobe, rImage, readTheme, refineAllNow, renderLeft, renderRight, requestRender, rightStage,
      runGenSliced, saveScene, shapeTexOf, sheetsClause, sheetsShown, sheetsTexP, sm, smDropExport, smOn,
      smPrepareExport, sndError, sndExportDone, sphN, stageMap, texSegs, toast, wDefSegs, wvar,
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
  function hiStep(...args) { return EXP.hiStep(...args); }

