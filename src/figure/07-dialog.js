  // =====================================================================================================
  // 5. Remembered settings and the dialog
  // =====================================================================================================
  const LS = () => (A && A.lsk ? A.lsk('cmw-figure-v1') : 'cmw-figure-v1');
  function loadSet() {
    const d = { for: 'article', cols: 1, size: {}, text: {}, ink: 'colour', crop: 'fit', axes: {}, fine: false, deform: 'film', last: null, lastFig: null, customPt: null, capLang: 'ui', fmt: 'pdf', dpi: 300, dpiFor: {}, video: null };
    try { const s = JSON.parse(localStorage.getItem(LS()) || 'null'); if (s && typeof s === 'object') return Object.assign(d, s); } catch (e) { /* storage may be blocked */ }
    return d;
  }
  function saveSet(s) { try { localStorage.setItem(LS(), JSON.stringify(s)); } catch (e) { /* storage may be blocked */ } }
  const sizeKey = (s) => (s.for === 'article' ? (s.cols === 2 ? 'article2' : 'article1') : s.for);
  // the caption language (DESIGN.md 12, i18n-22): the dialog offers it only when the interface is not English, so an
  // English interface keeps its dialog and its captions as they were
  const capLangOf = (s) => (uiLang() !== 'en' && (s.capLang === 'en' || s.capLang === 'ru' || s.capLang === 'it') ? s.capLang : uiLang());
  // the build options from the remembered settings
  // the steps view keeps its own crop, As on screen until changed there: its figure is the stage's picture
  const cropOf = (s) => (A.svOn() ? s.svCrop || 'screen' : s.crop);
  function optsOf(s, extra) {
    const sk = sizeKey(s);
    return Object.assign({ for: s.for, cols: s.cols, sizeId: s.size[sk] || null, customPt: s.customPt, text: s.text[s.for] || null, ink: s.ink, crop: cropOf(s), svPic: s.svPic, axes: s.axes[s.for] || null, deform: s.deform, panels: s.panels || 'both', lang: capLangOf(s) }, extra || {});
  }
  const ICON = {
    article: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="2.5" width="13" height="15" rx="1"/><path d="M6 6h3.5M6 8.5h3.5M6 11h3.5M11 6h3M11 8.5h3M6 14h8"/></svg>',
    homework: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 3.5h12v13H4z"/><path d="M6.5 7l1.5 1.5L11 5.5M6.5 12.5h7"/></svg>',
    slides: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="4" width="15" height="10" rx="1"/><path d="M10 14v3M7 17h6"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>',
    loupe: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 10.5l3.5 3.5" stroke="currentColor" stroke-width="1.5"/></svg>',
    down: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.3"/></svg>',
    right: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M3.5 2l3 3-3 3" stroke="currentColor" fill="none" stroke-width="1.4"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5"/></svg>',
    play: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>',
    pause: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor"/></svg>',
  };
  // hairline "words" of dummy text at the document's x-height (deterministic)
  const dummy = (lines, seed, indent) => {
    let r = seed, out = '';
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    for (let l = 0; l < lines; l++) {
      let row = '<div class="xf-txt">';
      if (l === 0 && indent) row += '<i style="width:14px;background:none"></i>';
      const n = l === lines - 1 ? 5 + Math.floor(rnd() * 6) : 30;
      for (let k = 0; k < n; k++) row += `<i style="width:${10 + Math.floor(rnd() * 10) * 4}px"></i>`;
      out += row + '</div>';
    }
    return out;
  };
  const ptTxt = (v) => $t('{x} pt', { x: I18 ? I18.num(v) : v });
  // (round 3) the styles of the format row, the LaTeX box and the video panel, from the app's theme tokens (light and
  // dark follow the page); injected once, so page.html stays as it is
  const CSS3 = `.xf-fmtrow{display:flex;gap:6px;align-items:center}.xf-fmtrow .xf-seg{flex:1 1 auto}.xf-fmtrow select.xf-select{flex:0 0 auto;height:28px}
.xf-ctl>.xf-row{min-width:0}.xf-texwrap{position:relative;display:grid;grid-template-columns:minmax(0,1fr);min-width:0}.xf-tex{margin:0;max-height:9.5em;overflow:auto;box-sizing:border-box;width:100%;padding:7px 8px 7px 9px;background:var(--well);border:1px solid var(--line);border-radius:var(--r-2);font:400 10px/14px var(--f-mono);color:var(--ink-2);white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}
.xf-tex:focus-visible{outline:2px solid var(--accent);outline-offset:1px}.xf-texbar{display:flex;align-items:center;gap:8px;margin-top:6px}.xf-texnote{font:var(--t-label);color:var(--muted)}.xf-texnote code{font:var(--t-readout)}
.xf-video{display:grid;gap:10px}.xf-video .xf-fr{grid-template-columns:64px minmax(0,1fr)}.xf-checks{display:flex;flex-wrap:wrap;gap:6px 14px;font:var(--t-label);color:var(--ink-2)}.xf-checks label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.xf-prog{display:flex;align-items:center;gap:10px;flex:1 1 auto;min-width:0}.xf-prog[hidden]{display:none}.xf-warn{color:var(--warn);margin-top:4px}.xf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.xf-meter{flex:1 1 auto;height:6px;border-radius:3px;background:var(--well);border:1px solid var(--line);overflow:hidden}.xf-meter>i{display:block;height:100%;width:0;background:var(--accent);transition:width .12s linear}.xf-progtxt{font:var(--t-readout);color:var(--ink-2);white-space:nowrap}
.xf-poster{display:block;max-width:100%;max-height:100%;margin:auto;background:#fff;box-shadow:var(--xf-paper-shadow)}.xf-scroll.video{align-items:center}.xf-scroll.video .xf-paper{display:none}.xf-scroll:not(.video) .xf-poster{display:none}
.xf-pv{display:flex;flex-direction:column;gap:6px;max-width:100%;margin:auto}.xf-scroll:not(.video) .xf-pv{display:none}.xf-pv .xf-poster{margin:0}.xf-pv.busy .xf-poster{opacity:.6;transition:opacity var(--t-med) var(--ease-out)}.xf-pv.busy .xf-pvbar{opacity:.55}
.xf-pvcv{display:block;background:#fff;box-shadow:var(--xf-paper-shadow);cursor:pointer}.xf-pvbar{display:flex;align-items:center;gap:8px;min-width:0}.xf-pvbtn{flex:0 0 auto;width:28px;height:28px;padding:0;display:inline-grid;place-items:center;border-radius:var(--r-2);background:var(--surface);border:1px solid var(--line);color:var(--ink);cursor:pointer}.xf-pvbtn:hover{border-color:var(--line-strong)}
.xf-pvbtn:focus-visible,.xf-pvrange:focus-visible{outline:2px solid var(--accent);outline-offset:1px}.xf-pvrange{flex:1 1 auto;min-width:60px;margin:0;accent-color:var(--accent)}.xf-pvtime{font:var(--t-label);color:var(--ink-2);white-space:nowrap;font-variant-numeric:tabular-nums}.xf-pvt i{font-family:var(--f-math, serif)}.xf-pvnote{font:var(--t-label);color:var(--muted);min-height:16px;overflow-wrap:anywhere}
@media (max-width:560px){.xf-fmtrow{flex-wrap:wrap}.xf-video .xf-fr{grid-template-columns:1fr}.xf-pvt{display:none}}`;
  const injectCSS = () => { if (document.getElementById('xfR3css')) return; const st = document.createElement('style'); st.id = 'xfR3css'; st.textContent = CSS3; document.head.append(st); };
  let dlg = null; // the open dialog's state (tests read it)
  let lastFig = null;
  function open() {
    if (!A || document.querySelector('.modal-bg')) return;
    const { h, toast } = A;
    const set = loadSet();
    const view = A.viewKind();
    const opener = /** @type {HTMLElement | null} */ (document.activeElement);
    let token = 0, fig = null, capEdited = null, closed = false;
    const st = { set, view, building: false };
    dlg = st;
    const close = () => { closed = true; token++; pv.stop(); bg.remove(); document.removeEventListener('keydown', onKey, true); window.removeEventListener('pointerdown', onDown, true); dlg = null; if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    // (v16.1 user-5) a press outside an open menu (Size, More formats) closes the menu only, not the dialog with it:
    // whether a menu was open is read before the menu's own outside press closes it (window, capture)
    let downMenu = false;
    const onDown = () => { downMenu = !!document.querySelector('#popHost .pop.menu'); };
    window.addEventListener('pointerdown', onDown, true);
    const onKey = (e) => {
      if (e.key === 'Escape') { if (document.querySelector('#popHost .pop.menu')) return; e.preventDefault(); close(); return; }
      // Tab and Shift+Tab stay inside the dialog (aria-modal): from the last control to the first and back
      if (e.key === 'Tab' && !document.querySelector('#popHost .pop.menu')) {
        const md = bg.querySelector('.modal.xf');
        if (!md) return;
        const fs = [...md.querySelectorAll('button, [href], input, select, textarea, [tabindex]')].filter((x) => !x.disabled && x.tabIndex >= 0 && !x.closest('[hidden]') && x.getClientRects().length);
        if (!fs.length) return;
        const a = document.activeElement, i = fs.indexOf(a);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); fs[fs.length - 1].focus(); }
        else if (!e.shiftKey && (i < 0 || i === fs.length - 1)) { e.preventDefault(); fs[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg && !downMenu) close(); } });
    const segB = (id, value, options, onchange, label, cls) => {
      const el = h('div', { class: 'seg xf-seg' + (cls ? ' ' + cls : ''), id, role: 'radiogroup', 'aria-label': label });
      for (const [v, l, sub, ic] of options) {
        const b = h('button', { type: 'button', role: 'radio', 'data-v': v, 'aria-checked': String(v === value), onclick: () => { for (const x of el.children) x.setAttribute('aria-checked', String(x === b)); onchange(v); } });
        if (ic) b.insertAdjacentHTML('beforeend', ic);
        b.append(h('span', { class: 'xf-sl' }, l));
        if (sub) b.append(h('small', null, sub));
        el.append(b);
      }
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const bs = [...el.children], i = bs.findIndex((b) => b.getAttribute('aria-checked') === 'true');
        const j = Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        bs[j].click(); bs[j].focus(); e.preventDefault();
      });
      return el;
    };
    const iconBtn = (cls, html, label, onclick) => { const b = h('button', { type: 'button', class: cls, onclick }); b.innerHTML = html; if (label) b.append(h('span', null, label)); return b; };
    // ---- the page (the preview) ----
    const hint = h('span', { class: 'xf-hint' });
    const greyBtn = iconBtn('xf-ico', ICON.eye, $t('See in grey'), () => { const on = !paper.classList.contains('grey'); paper.classList.toggle('grey', on); greyBtn.classList.toggle('on', on); greyBtn.setAttribute('aria-pressed', String(on)); });
    greyBtn.setAttribute('aria-pressed', 'false');
    const loupeBtn = iconBtn('xf-ico', ICON.loupe, $t('Loupe'), () => { const on = !loupeBtn.classList.contains('on'); loupeBtn.classList.toggle('on', on); loupeBtn.setAttribute('aria-pressed', String(on)); stage.classList.toggle('loupe-on', on); if (!on) loupe.hidden = true; });
    loupeBtn.setAttribute('aria-pressed', 'false');
    const figImg = h('img', { class: 'xf-fig', alt: $t('The figure at its printed size') });
    const capImg = h('img', { class: 'xf-capimg', alt: $t('The caption, typeset') });
    const capTa = h('textarea', { class: 'xf-capsrc', rows: 4, spellcheck: 'false', 'aria-label': $t('Caption (LaTeX source)') });
    const capEditTag = h('span', { class: 'xf-edit' }, $t('Click to edit · LaTeX source'));
    const regen = h('button', { type: 'button', class: 'xf-link', hidden: true, onclick: (e) => { e.stopPropagation(); capEdited = null; regen.hidden = true; showCaption(); } }, $t('Regenerate'));
    const capBox = h('div', { class: 'xf-cap', tabindex: '0', role: 'button', 'aria-label': $t('Edit the caption'), onclick: () => editCaption(), onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); editCaption(); } } }, capEditTag, capImg);
    const before = h('div', { class: 'xf-before' }), after = h('div', { class: 'xf-after' });
    const paper = h('div', { class: 'xf-paper' }, before, figImg, capBox, after);
    const wait = h('div', { class: 'xf-wait' }, $t('Typesetting…'));
    const scroll = h('div', { class: 'xf-scroll' }, paper, wait);
    const loupe = h('div', { class: 'xf-loupe', hidden: true });
    const stage = h('div', { class: 'xf-stage' }, h('div', { class: 'xf-bar' }, hint, h('span', { class: 'xf-sp' }), greyBtn, loupeBtn), scroll, loupe);
    const facts = h('div', { class: 'xf-facts', role: 'status' });
    // the loupe follows a mouse, and a finger or pen pressed on the paper (pointer events: a phone has no hover)
    let loupeT = 0;
    const loupeAt = (e) => {
      if (!loupeBtn.classList.contains('on') || !fig) return;
      clearTimeout(loupeT);
      const r = figImg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { loupe.hidden = true; return; }
      const sr = stage.getBoundingClientRect(), k = 3, bw = r.width * k, bh = r.height * k;
      loupe.hidden = false;
      // a finger or pen: the lens floats 110 px above the contact, inside the stage (beside the finger, or below it,
      // when the stage has no room above), so the fingertip does not cover the spot it magnifies; a mouse: centred
      let lx = e.clientX - sr.left - stage.clientLeft, ly = e.clientY - sr.top - stage.clientTop;
      if (e.pointerType && e.pointerType !== 'mouse') {
        const sw = stage.clientWidth, sh = stage.clientHeight;
        const x0 = lx, y0 = ly, cl = (v, n) => Math.max(70, Math.min(n - 70, v)), far = () => Math.hypot(lx - x0, ly - y0) >= 90;
        lx = cl(x0, sw); ly = cl(y0 - 110, sh);
        if (!far()) { lx = cl(x0 + (x0 < sw / 2 ? 110 : -110), sw); ly = cl(y0 - 60, sh); }
        if (!far()) { lx = cl(x0, sw); ly = cl(y0 + 110, sh); }
      }
      loupe.style.left = `${lx - 70}px`; loupe.style.top = `${ly - 70}px`;
      loupe.style.backgroundImage = `url("${figImg.src}")`;
      loupe.style.backgroundSize = `${bw}px ${bh}px`;
      loupe.style.backgroundPosition = `${-(e.clientX - r.left) * k + 70}px ${-(e.clientY - r.top) * k + 70}px`;
    };
    stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) loupeAt(e); });
    stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') loupeAt(e); });
    // (a cancelled touch, when the browser takes it for a scroll, ends like a lift)
    for (const t of ['pointerup', 'pointercancel']) stage.addEventListener(t, (e) => { if (e.pointerType !== 'mouse') { clearTimeout(loupeT); loupeT = setTimeout(() => { loupe.hidden = true; }, 1600); } });
    stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') loupe.hidden = true; });
    // ---- the controls ----
    const sizeBtn = h('button', { type: 'button', class: 'xf-select', id: 'xfSize', 'aria-haspopup': 'menu' });
    const textSel = h('select', { class: 'xf-select xf-text', id: 'xfText', 'aria-label': $t('Text size'), onchange: () => { set.text[set.for] = +textSel.value; changed(); } }, ...[10, 11, 12].map((v) => h('option', { value: String(v) }, $t('Text {v} pt', { v }))));
    const customRow = h('div', { class: 'xf-custom', hidden: true });
    // \the\linewidth prints pt; 6.5in, 16.5cm, 165mm and bp are read too (TeX points: 72.27 per inch)
    const lenPt = (str) => { const m = /^\s*([0-9]*\.?[0-9]+)\s*(pt|in|cm|mm|bp)?\s*$/i.exec(String(str || '')); if (!m) return NaN; const u = (m[2] || 'pt').toLowerCase(); return +m[1] * { pt: 1, in: 72.27, cm: 72.27 / 2.54, mm: 72.27 / 25.4, bp: 72.27 / 72 }[u]; };
    const customInp = h('input', { type: 'text', class: 'xf-input', id: 'xfCustom', placeholder: '469.75pt', 'aria-label': $t('Paste \\the\\linewidth'), onchange: () => {
      const v = lenPt(customInp.value);
      if (v > 50 && v < 2000) { customInp.removeAttribute('aria-invalid'); set.customPt = +v.toFixed(2); set.size[sizeKey(set)] = 'custom'; changed(); }
      else { customInp.setAttribute('aria-invalid', 'true'); toast($t('Paste a width between 50 pt and 2000 pt, such as 469.75pt, 6.5in or 16.5cm.')); }
    } });
    customRow.append(h('span', null, $t('Your \\the\\linewidth')), customInp);
    const colsSeg = segB('xfCols', set.cols === 2 ? '2' : '1', [['1', $t('One column')], ['2', $t('Two column')]], (v) => { set.cols = +v; changed(); }, $t('Columns'), 'xf-cols');
    const forSeg = segB('xfFor', set.for, [['article', $t('Article'), $t('journal, arXiv'), ICON.article], ['homework', $t('Homework'), 'Overleaf, Docs', ICON.homework], ['slides', $t('Slides'), 'Beamer, Keynote', ICON.slides]], (v) => { set.for = v; changed(); }, $t('For'), 'big');
    const inkSeg = segB('xfInk', set.ink, [['colour', $t('Colour')], ['bw', $t('B/W')]], (v) => { set.ink = v; changed(); }, $t('Ink'));
    const rows = [];
    const row = (label, ...els) => { const r = h('div', { class: 'xf-row' }, h('div', { class: 'xf-h' }, label), ...els); rows.push(r); return r; };
    const sizeRow = row($t('Size'), colsSeg, h('div', { class: 'xf-pair' }, sizeBtn, textSel), customRow);
    sizeRow.classList.add('wide');
    const forRow = row($t('For'), forSeg); forRow.classList.add('wide');
    const inkRow = row($t('Ink'), inkSeg); inkRow.classList.add('wide');
    // the caption language (DESIGN.md 12): offered only when the interface is not English (the English dialog is
    // unchanged); remembered with the settings. An edited caption is dropped: it was written in the other language
    const capLangRow = uiLang() !== 'en' ? row($t('Caption'), segB('xfCapLang', set.capLang === 'en' || set.capLang === 'ru' || set.capLang === 'it' ? set.capLang : 'ui', [['ui', $t('Interface language')], ['en', 'English'], ['ru', 'Русский'], ['it', 'Italiano']], (v) => { set.capLang = v; capEdited = null; regen.hidden = true; changed(); }, $t('Caption language'))) : null;
    if (capLangRow) capLangRow.classList.add('wide');
    // (round 3) the deformation is a deformation in every view that shows it: the filmstrip, the paths (plane and
    // globe), or one frame at the current t (the earlier one-panel figure of Phase, Landscape and the globes)
    const defo = defoOf(view);
    const dOpts = [['film', $t('Filmstrip')]];
    if (defo && PATHS_OK.has(defo)) dOpts.push(['paths', $t('Paths')]);
    if (defo && defo !== 'plane') dOpts.push(['frame', $t('One frame')]);
    const deformOf = () => (dOpts.some((q) => q[0] === set.deform) ? set.deform : 'film');
    const deformRow = defo ? row($t('Deformation'), segB('xfDeform', deformOf(), dOpts, (v) => { set.deform = v; changed(); }, $t('Deformation'))) : null;
    if (deformRow) deformRow.classList.add('wide');
    // the steps view's picture: the shown plane, or the filmstrip of the whole thread (#634)
    const svPicRow = A.svOn && A.svOn() ? row($t('Picture'), segB('xfSvPic', set.svPic === 'film' ? 'film' : 'plane', [['plane', $t('Shown plane')], ['film', $t('Filmstrip')]], (v) => { set.svPic = v; changed(); }, $t('Picture'))) : null;
    if (svPicRow) svPicRow.classList.add('wide');
    // (round 3) the format: PDF, PNG, SVG, and Video while the deformation is on; remembered
    injectCSS();
    // (a browser without a video encoder is told so at the format row, not after Save: export review r3, video-6)
    const canVideo = typeof VideoEncoder !== 'undefined';
    const fmtOf = () => (set.fmt === 'video' ? (defo && canVideo ? 'video' : 'pdf') : ['pdf', 'png', 'svg'].includes(set.fmt) ? set.fmt : 'pdf');
    const fOpts = [['pdf', 'PDF'], ['png', 'PNG'], ['svg', 'SVG']];
    // (v16.5 UX60: Video is always listed; with the deformation off, choosing it turns the deformation on and the dialog
    // opens again on Video: a video records the deformation)
    fOpts.push(['video', $t('Video')]);
    // (PNG: 600 dpi for an article, where journals ask for it; 300 dpi for homework and slides; remembered per For)
    const dpiOf = () => { const v = set.dpiFor && set.dpiFor[set.for]; return v === 300 || v === 600 ? v : set.for === 'article' ? 600 : 300; };
    const dpiSel = h('select', { class: 'xf-select', id: 'xfDpi', 'aria-label': $t('Resolution'), onchange: () => { set.dpiFor = Object.assign({}, set.dpiFor, { [set.for]: +dpiSel.value }); set.dpi = +dpiSel.value; saveSet(set); syncFmt(); } }, ...[300, 600].map((v) => h('option', { value: String(v) }, `${v} dpi`)));
    dpiSel.value = String(dpiOf());
    const fmtSeg = segB('xfFmt', fmtOf(), fOpts, (v) => {
      if (v === 'video' && !defo) {
        if (!(A.deformOn && A.deformOn())) { syncFmt(); return; }
        set.fmt = 'video'; saveSet(set); close();
        toast($t('A video records the deformation: it is on now.'));
        setTimeout(() => open(), 0);
        return;
      }
      set.fmt = v; saveSet(set); syncFmt();
    }, $t('Format'));
    const fmtRow = row($t('Format'), h('div', { class: 'xf-fmtrow' }, fmtSeg, dpiSel)); fmtRow.classList.add('wide');
    { const vb = fmtSeg.querySelector('[data-v="video"]');
      if (vb && !canVideo) { vb.disabled = true; vb.title = $t('This browser cannot encode video. Try a recent Chrome, Edge or Safari.'); }
      else if (vb && !defo) { const can = !(A.canDeform && !A.canDeform()); vb.disabled = !can; vb.title = can ? $t('A video records the deformation: choosing it turns the deformation on') : $t('A video records the deformation: add a function to the chain first'); } }
    // the LaTeX of the chosen format, in view and one click from the clipboard
    const texPre = h('pre', { class: 'xf-tex', id: 'xfTex', tabindex: '0', 'aria-label': $t('LaTeX snippet') });
    const texNote = h('div', { class: 'xf-texnote', id: 'xfTexNote' });
    const texCopy = h('button', { type: 'button', class: 'btn xf-texcopy', id: 'xfTexCopy', onclick: () => { if (!fig) return; A.copyText(latex(fig, capEdited, fmtOf(), dpiOf())); set.last = set.lastFig = { kind: 'latex', fmt: fmtOf(), dpi: dpiOf() }; saveSet(set); toast($t('LaTeX copied.')); cueDone(); } }, $t('Copy LaTeX'));
    const texRow = row('LaTeX', h('div', { class: 'xf-texwrap' }, texPre), h('div', { class: 'xf-texbar' }, texCopy, texNote)); texRow.classList.add('wide');
    // the video's options (remembered): size, frame rate, length, ends, look, paths, t label
    const vset = Object.assign(vdefaults(), set.video || {});
    const saveV = () => { set.video = Object.assign({}, vset); saveSet(set); };
    const vseg = (id, key, options, label, num) => segB(id, String(vset[key]), options, (v) => { vset[key] = num ? +v : v; saveV(); posterSoon(); }, label);
    // (verify-editor-7) the length of each step, said in the menu; the poster's line gives the whole video's length
    if (!VSECS.includes(+vset.secs)) vset.secs = VSECS.reduce((a, b) => (Math.abs(b - vset.secs) < Math.abs(a - vset.secs) ? b : a), 3);
    const vLen = h('select', { class: 'xf-select', id: 'xfVLen', 'aria-label': $t('Length of each step'), onchange: () => { vset.secs = +vLen.value; saveV(); posterSoon(); } }, ...VSECS.map((v) => h('option', { value: String(v) }, $t('{v} s per step', { v }))));
    vLen.value = String(vset.secs);
    const vck = (key, label) => { const c = h('input', { type: 'checkbox', id: `xfV${key}`, onchange: () => { vset[key] = c.checked; saveV(); posterSoon(); } }); c.checked = !!vset[key]; return h('label', null, c, label); };
    const vfr = (label, el) => h('div', { class: 'xf-fr' }, h('span', null, label), el);
    const vidBox = h('div', { class: 'xf-video', id: 'xfVideoBox' },
      vfr($t('Size'), vseg('xfVSize', 'size', [['1920x1080', '1920×1080'], ['1280x720', '1280×720'], ['1080x1080', '1080×1080']], $t('Video size'))),
      vfr($t('Speed'), h('div', { class: 'xf-fmtrow' }, vseg('xfVFps', 'fps', [['30', $t('{n} fps', { n: 30 })], ['60', $t('{n} fps', { n: 60 })]], $t('Frame rate'), true), vLen)),
      vfr($t('Ends'), vseg('xfVEnds', 'ends', [['once', $t('Once')], ['loop', $t('Loop')], ['bounce', $t('Bounce')]], $t('Ends'))),
      vfr($t('Look'), vseg('xfVLook', 'look', [['light', $tx('video look', 'Light')], ['print', $tx('video look', 'Print')]], $t('Look'))),
      ...(defo === 'plane' || defo === 'deriv' || defo === 'phase' ? [vfr($t('Window'), vseg('xfVWin', 'win', [['screen', $t('As on screen')], ['fit', $t('Fit the motion')]], $t('Window')))] : []),
      h('div', { class: 'xf-checks' }, ...(defo === 'plane' || defo === 'globe' || defo === 'deriv' ? [vck('paths', $t('Paths'))] : []), vck('tlabel', $t('t label'))));
    const vidRow = row($t('Video'), vidBox); vidRow.classList.add('wide');
    // Fine-tune
    const ftBody = h('div', { class: 'xf-ft', hidden: !set.fine });
    const ftBtn = h('button', { type: 'button', class: 'xf-disc', 'aria-expanded': String(!!set.fine), onclick: () => { set.fine = !set.fine; ftBody.hidden = !set.fine; ftBtn.setAttribute('aria-expanded', String(set.fine)); ftBtn.querySelector('.xf-chev').innerHTML = set.fine ? ICON.down : ICON.right; saveSet(set); } });
    ftBtn.append(h('span', { class: 'xf-chev', html: set.fine ? ICON.down : ICON.right }), h('span', null, $t('Fine-tune')), h('small', null, view === 'xy' ? $t('Crop · Axes · Panels') : view === 'land' ? $t('Crop') : $t('Crop · Axes')));
    const fr = (label, el) => h('div', { class: 'xf-fr' }, h('span', null, label), el);
    ftBody.append(fr($t('Crop'), segB('xfCrop', cropOf(set), [['fit', $t('Fit content')], ['screen', $t('As on screen')]], (v) => { if (A.svOn()) set.svCrop = v; else set.crop = v; changed(); }, $t('Crop'))));
    const axesSeg = () => segB('xfAxes', set.axes[set.for] || PRESET[set.for].axes, [['box', $t('Box')], ['cross', $t('Cross')], ['none', $t('None')]], (v) => { set.axes[set.for] = v; changed(); }, $t('Axes'));
    let axesEl = axesSeg();
    const axesRow = fr($t('Axes'), axesEl);
    if (view !== 'land') ftBody.append(axesRow);
    if (view === 'xy') ftBody.append(fr($t('Panels'), segB('xfPanels', set.panels || 'both', [['both', $t('Both')], ['L', $t('X only')], ['R', $t('Y only')]], (v) => { set.panels = v; changed(); }, $t('Panels'))));
    const ftWrap = h('div', { class: 'xf-ftwrap' }, ftBtn, ftBody);
    // On a phone the print settings (what the figure is for, its size, ink, caption language, the LaTeX) are folded
    // behind one button, so the sheet opens on the format and the buttons; elsewhere the rows sit in the grid as before.
    const printBtn = h('button', { type: 'button', class: 'btn quiet xf-printbtn', id: 'xfPrintBtn', 'aria-expanded': 'false', onclick: () => { const on = printBox.dataset.open !== '1'; printBox.dataset.open = on ? '1' : '0'; printBtn.setAttribute('aria-expanded', String(on)); } }, $t('Print settings'));
    const printBox = h('div', { class: 'xf-print', 'data-open': matchMedia('(max-width: 560px)').matches ? '0' : '1' }, ...[forRow, sizeRow, inkRow, ...(capLangRow ? [capLangRow] : []), texRow, ftWrap]);
    printBtn.setAttribute('aria-expanded', String(printBox.dataset.open === '1'));
    const ctl = h('div', { class: 'xf-ctl' }, fmtRow, printBtn, ...(svPicRow ? [svPicRow] : []), ...(deformRow ? [deformRow] : []), vidRow, printBox);
    // ---- the footer ----
    let nameEdited = false;
    const nameInp = h('input', { type: 'text', class: 'xf-nameinp', id: 'xfName', value: defaultName(view, deformOf(), fmtOf()), spellcheck: 'false', 'aria-label': $t('File name'), onchange: () => { changed(); }, oninput: () => { nameEdited = true; fitName(); } });
    // the field is as wide as the name (up to 40 characters, the longest a scene name gets)
    const fitName = () => { nameInp.style.width = `${Math.min(40, Math.max(8, nameInp.value.length + 1))}ch`; };
    fitName();
    const extEl = h('span', { class: 'xf-ext' }, '.pdf');
    const moreBtn = h('button', { type: 'button', class: 'btn quiet xf-more', id: 'xfMore', 'aria-haspopup': 'menu' }, $t('More formats '), h('span', { html: ICON.down }));
    // the plain Save names the format; Copy image and the LaTeX button are the two others (the phone also gets Share first)
    const saveBtn = h('button', { type: 'button', class: 'btn primary xf-dest', id: 'xfSave' }, $t('Save {format}', { format: 'PDF' }));
    const shareBtn = h('button', { type: 'button', class: 'btn primary xf-dest', id: 'xfShare', hidden: !canShareFiles() }, $t('Share PNG…'));
    const docsBtn = h('button', { type: 'button', class: 'btn xf-dest', id: 'xfDocs' }, $t('Copy image'));
    const olBtn = h('button', { type: 'button', class: 'btn xf-dest', id: 'xfOverleaf' }, $t('Save + copy LaTeX for Overleaf'));
    const after2 = h('div', { class: 'xf-after2', hidden: true });
    const vidBtn = h('button', { type: 'button', class: 'btn primary xf-dest', id: 'xfVideo' }, $t('Save video'));
    const meter = h('i'), progTxt = h('span', { class: 'xf-progtxt', 'aria-hidden': 'true' }), progSr = h('span', { class: 'xf-sr', role: 'status' });
    const cancelBtn = h('button', { type: 'button', class: 'btn quiet', id: 'xfVCancel' }, $t('Cancel'));
    const meterEl = h('div', { class: 'xf-meter', role: 'progressbar', 'aria-label': $t('Making the video'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, meter);
    const prog = h('div', { class: 'xf-prog', hidden: true }, meterEl, progTxt, cancelBtn);
    const nameLab = h('label', { class: 'xf-name' }, nameInp, extEl), footSp = h('span', { class: 'xf-sp' });
    const foot = h('div', { class: 'xf-foot' }, nameLab, prog, footSp, moreBtn, shareBtn, saveBtn, docsBtn, olBtn, vidBtn, after2, progSr);
    const chip = h('span', { class: 'xf-chip' }); chip.innerHTML = A.chipHTML(view);
    const m = h('div', { class: 'modal xf', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'xfTitle' },
      h('div', { class: 'xf-head' }, h('h2', { id: 'xfTitle' }, $t('Export figure')), chip, h('span', { class: 'xf-sp' }), iconBtn('icon-btn xf-x', ICON.close, null, close)),
      h('div', { class: 'xf-body' }, h('div', { class: 'xf-left' }, stage, facts), ctl), foot);
    m.querySelector('.xf-x').setAttribute('aria-label', $t('Close'));
    bg.append(m);
    document.body.append(bg);
    // ---- behaviour ----
    const sync = () => {
      colsSeg.hidden = set.for !== 'article';
      for (const b of colsSeg.children) b.setAttribute('aria-checked', String(b.dataset.v === String(set.cols)));
      const sz = sizeOf(optsOf(set));
      sizeBtn.innerHTML = '';
      sizeBtn.append(h('span', null, $t(sz.label) + ' ', h('span', { class: 'xf-dim' }, '· ' + ptTxt(+sz.pt.toFixed(2)))), h('span', { class: 'xf-caret', html: ICON.down }));
      customRow.hidden = sz.id !== 'custom';
      if (sz.id === 'custom') customInp.value = `${sz.pt}pt`;
      textSel.value = String(set.text[set.for] || (set.for === 'article' ? 10 : 11));
      const nax = axesSeg(); axesEl.replaceWith(nax); axesEl = nax;
      olBtn.textContent = set.for === 'slides' ? $t('Save + copy LaTeX for Beamer') : $t('Save + copy LaTeX for Overleaf');
      saveBtn.textContent = fmtOf() === 'video' ? $t('Save video') : $t('Save {format}', { format: fmtOf().toUpperCase() });
      const T = TYPE[set.for][set.text[set.for] || (set.for === 'article' ? 10 : 11)];
      hint.textContent = $t('{label}, {pt} pt text · Fit column', { label: $t(sz.label), pt: set.text[set.for] || (set.for === 'article' ? 10 : 11) });
      st.hintText = hint.textContent;
      st.T = T;
      syncFmt();
    };
    const changed = () => { saveSet(set); sync(); rebuild(); };
    // ---- (round 3) the format: what the destinations save, the LaTeX for it, the video panel and its poster ----
    const posterImg = h('img', { class: 'xf-poster', alt: $t('A frame of the video') });
    // (2026-10-24, VIDEO-PREVIEW.md) the video plays here as it will be saved: the poster first, then the frames as they
    // are drawn; a play/pause button, a scrubber (arrows step one frame) and the time. Reduced motion: paused on the
    // poster, with Play.
    const num = (x, d) => (I18 ? I18.num(x.toFixed(d)) : x.toFixed(d));
    const pvCv = h('canvas', { class: 'xf-pvcv', role: 'img', 'aria-label': $t('The video, as it will be saved'), hidden: true, onclick: () => pvToggle() });
    const pvBtn = h('button', { type: 'button', class: 'xf-pvbtn', id: 'xfPvPlay', onclick: () => pvToggle() });
    // (while no preview runs, between an option change and its new frames, the button and the scrubber change only the
    // wish, which the next preview starts with: review vp-2)
    const pvRange = h('input', { type: 'range', class: 'xf-pvrange', id: 'xfPvSeek', min: '0', max: '0', step: '1', value: '0', 'aria-label': $t('Position in the video'), oninput: () => { const v = +pvRange.value; pvWant = false; if (!pv.state().id) { pvBtnSet(false); return; } pv.pause(); pv.seek(v); } });
    // (a key on the scrubber while it plays: from the frame in view, not from where the scrubber stood still)
    pvRange.addEventListener('keydown', () => { const s = pv.state(); if (s.id && s.playing) pvRange.value = String(s.i); });
    pvRange.addEventListener('focus', () => { const s = pv.state(); if (s.id) pvAria(s.i, true); });
    const pvTt = document.createTextNode('');
    const pvTime = h('span', { class: 'xf-pvtime', 'aria-hidden': 'true' }), pvT = h('span', { class: 'xf-pvtime xf-pvt', 'aria-hidden': 'true' }, h('i', null, 't'), pvTt);
    const pvNote = h('div', { class: 'xf-pvnote', id: 'xfPvNote' });
    const pvBar = h('div', { class: 'xf-pvbar', hidden: true }, pvBtn, pvRange, pvTime, pvT);
    const pvBox = h('div', { class: 'xf-pv', id: 'xfPv' }, posterImg, pvCv, pvBar, pvNote);
    scroll.append(pvBox);
    const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    let pvWant = !reduced(), pvSize = null, pvFill = [0, 0], pvAriaAt = 0;
    // (what the frames are: the video's own, at the size shown here when that is smaller, and lightly compressed when
    // the timeline is too long to keep them as they are; review vp-1)
    const pvNoteText = () => {
      if (!pvSize) return '';
      const s = pv.state(), [r, n] = pvFill, [pw, , W, H, raw] = pvSize;
      const what = r < n && !s.lazy ? $t('Preview: drawing the frames, {p} %', { p: Math.floor(100 * r / Math.max(1, n)) })
        : raw ? (pw >= W ? $t('Preview: the frames of the video itself') : $t('Preview: the frames of the video itself, scaled to fit here (the video is {w} × {h})', { w: W, h: H }))
          : pw >= W ? $t('Preview: the frames of the video itself, lightly compressed') : $t('Preview: the frames of the video itself, scaled to fit here and lightly compressed (the video is {w} × {h})', { w: W, h: H });
      return !s.playing && !s.shown && reduced() ? `${what} · ${$t('Paused: reduced motion is on. Press Play to watch.')}` : what;
    };
    const pvBtnSet = (on) => { pvBtn.innerHTML = on ? ICON.pause : ICON.play; pvBtn.setAttribute('aria-label', on ? $t('Pause') : $t('Play')); pvBtn.title = on ? $t('Pause') : $t('Play'); };
    // the scrubber's value and its text for a screen reader (review vp-6): while it plays, the scrubber with focus
    // stands still (so a screen reader on it does not read out every frame), and its text changes at most once a second
    const pvAria = (i, now) => {
      const s = pv.state(), fps = s.fps || 30, t = pv.tOf(i), ms = performance.now();
      if (s.playing && !now && (document.activeElement === pvRange || ms - pvAriaAt < 1000)) return;
      pvAriaAt = ms;
      pvRange.setAttribute('aria-valuetext', $t('{a} s of {b} s, t = {t}', { a: num(i / fps, 1), b: num(s.n / fps, 1), t: t == null ? '' : num(t, 2) }));
    };
    const pv = makePreview(pvCv, {
      shown: (on) => { pvCv.hidden = !on; posterImg.hidden = on; pvNote.textContent = pvNoteText(); },
      playing: (on) => { pvBtnSet(on); pvNote.textContent = pvNoteText(); const s = pv.state(); if (s.id) { pvRange.value = String(s.i); pvAria(s.i, true); } },
      tick: (i) => {
        const s = pv.state(), fps = s.fps || 30, t = pv.tOf(i);
        pvTime.textContent = $t('{a} / {b} s', { a: num(i / fps, 1), b: num(s.n / fps, 1) });
        pvTt.data = t == null ? '' : ` = ${num(t, 2)}`;
        pvRange.max = String(Math.max(0, s.n - 1));
        if (!(s.playing && document.activeElement === pvRange)) pvRange.value = String(i);
        pvAria(i, !s.playing);
      },
      size: (pw, ph, W, H, raw) => { pvSize = [pw, ph, W, H, raw]; pvNote.textContent = pvNoteText(); },
      fill: (r, n) => { const was = pvFill[0] < pvFill[1]; pvFill = [r, n]; if (r === 0 || r === n || was && Math.floor(10 * r / n) !== Math.floor(10 * (r - 1) / n)) pvNote.textContent = pvNoteText(); },
      blocked: () => !!vRun,
    });
    // (the viewer's choice holds across option changes: paused stays paused)
    const pvToggle = () => { if (!pv.state().id) { pvWant = !pvWant; pvBtnSet(pvWant); return; } pv.toggle(); pvWant = pv.state().playing; };
    // (tests) the preview's state, the picture at a timeline index, the options the video would be made with
    st.preview = { state: () => pv.state(), frame: (i) => pv.frame(i), entry: (i) => pv.entry(i), note: () => pvNote.textContent, opts: () => opts({ video: Object.assign({}, vset) }) };
    // the picture's size: the stage's room at the video's aspect, the bar and the note under it (the poster and the
    // canvas the same, so nothing moves when the frames take over)
    const fitPv = (W, H) => {
      const aw = Math.max(160, scroll.clientWidth - 24), ah = Math.max(120, scroll.clientHeight - 44 - 16 - 62);
      const k = Math.min(aw / W, ah / H), w = Math.round(W * k), hh = Math.round(H * k);
      for (const el of [posterImg, pvCv]) { el.style.width = `${w}px`; el.style.height = `${hh}px`; el.style.maxHeight = 'none'; }
      pvBox.style.width = `${w}px`;
      return w;
    };
    let posterTok = 0, posterTimer = 0, extKnown = null, pvWH = null, pvKey = null;
    // (an option changed: the frames in view are stale; the preview stops, the poster dims until the new one is drawn)
    // (the bar is dimmed and says nothing of the old video; the button shows the wish: review vp-2)
    const posterSoon = () => {
      clearTimeout(posterTimer); pv.stop(); pvCv.hidden = true; posterImg.hidden = false; pvBox.classList.add('busy');
      pvBtnSet(pvWant); pvTime.textContent = ''; pvTt.data = ''; pvRange.max = '0'; pvRange.value = '0'; pvRange.removeAttribute('aria-valuetext');
      pvNote.textContent = pvSize ? $t('Preview: drawing the frames, {p} %', { p: 0 }) : '';
      posterTimer = setTimeout(poster, 150);
    };
    async function poster() {
      if (fmtOf() !== 'video' || closed) return;
      const my = ++posterTok;
      pvKey = JSON.stringify(vset);
      try {
        const plan = await videoPlan(opts({ video: vset, alive: () => my === posterTok && !closed }));
        if (!plan || my !== posterTok) return;
        const c = document.createElement('canvas'); c.width = plan.W; c.height = plan.H;
        const t = Math.max(0, Math.min(plan.m, A.defo().T));
        if (!(await videoFrame(plan, t, c.getContext('2d', { alpha: false }))) || my !== posterTok) return;
        const k = Math.min(1, 960 / plan.W), s2 = document.createElement('canvas');
        s2.width = Math.round(plan.W * k); s2.height = Math.round(plan.H * k);
        s2.getContext('2d').drawImage(c, 0, 0, s2.width, s2.height);
        c.width = 1; c.height = 1;
        await breathe();
        if (my !== posterTok || closed || fmtOf() !== 'video') return;
        posterImg.src = s2.toDataURL('image/png');
        pvWH = [plan.W, plan.H];
        const cssW = fitPv(plan.W, plan.H);
        const fr0 = plan.times.length;
        hint.textContent = $t('{w} × {h} · {fps} fps · {secs} s', { w: plan.W, h: plan.H, fps: vset.fps, secs: num(fr0 / vset.fps, 1) }) + (extKnown === 'webm' ? ' · WebM (VP9)' : '');
        wait.hidden = true; pvBox.classList.remove('busy'); pvBar.hidden = false;
        // the preview starts from the poster's frame, so the picture does not jump (review vp-4); paused with reduced
        // motion, only that frame is drawn until Play (review vp-5)
        let at = 0, best = Infinity;
        plan.times.forEach((e, i) => { if (typeof e === 'number' && Math.abs(e - t) < best - 1e-12) { best = Math.abs(e - t); at = i; } });
        pv.start(plan, { cssW, autoplay: pvWant, at, lazy: !pvWant && reduced() });
      } catch (e) { console.error(e); }
    }
    function updTex() {
      const f = fmtOf();
      texPre.textContent = fig ? latex(fig, capEdited, f, dpiOf()) : '';
      texNote.textContent = f === 'svg' ? $t('SVG in LaTeX needs the svg package and Inkscape (Overleaf has both). Google Docs cannot place SVG: use PNG there.') : f === 'png' ? $t('PNG at {dpi} dpi: the snippet sets its printed width.', { dpi: dpiOf() }) + (set.for === 'article' ? $t(' For a journal, PDF is better: it is vector.') : '') : $t('PDF: vector, no fonts, printed at its natural size.');
    }
    function syncFmt() {
      const f = fmtOf(), vid = f === 'video';
      for (const b of fmtSeg.children) b.setAttribute('aria-checked', String(b.dataset.v === f));
      dpiSel.hidden = f !== 'png';
      for (const r of [forRow, sizeRow, inkRow, capLangRow, svPicRow, deformRow, texRow, ftWrap, printBox, printBtn]) if (r) r.hidden = vid;
      vidRow.hidden = !vid;
      scroll.classList.toggle('video', vid);
      greyBtn.hidden = vid; loupeBtn.hidden = vid; facts.hidden = vid;
      for (const b of [moreBtn, docsBtn, olBtn, saveBtn]) b.hidden = vid;
      shareBtn.hidden = vid || !canShareFiles();
      vidBtn.hidden = !vid;
      dpiSel.value = String(dpiOf());
      // (the default name follows the figure until it is edited: export review r3, editor-2)
      if (!nameEdited) { nameInp.value = defaultName(view, deformOf(), f); fitName(); }
      // (the extension of the file a video will be: .mp4, or .webm where only VP9 can be encoded; video-5)
      extEl.textContent = vid ? `.${extKnown || 'mp4'}` : `.${f}`;
      if (vid && !extKnown && canVideo) { const [w0, h0] = VIDEO_SIZES[vset.size] || VIDEO_SIZES['1920x1080']; pickEncoder(w0, h0, vset.fps === 60 ? 60 : 30).then((pk) => { if (!pk || closed) return; extKnown = pk.mux; if (fmtOf() === 'video') extEl.textContent = `.${extKnown}`; }); }
      // (a preview of these very options keeps playing: after Save video or Cancel it is not drawn again)
      if (vid) { wait.hidden = !!posterImg.getAttribute('src'); if (!(pv.state().id && pvKey === JSON.stringify(vset))) posterSoon(); }
      else { clearTimeout(posterTimer); pv.stop(); if (fig) wait.hidden = true; updTex(); if (fig) hint.textContent = st.hintText || hint.textContent; }
    }
    sizeBtn.addEventListener('click', () => {
      const cur = sizeOf(optsOf(set)).id;
      const items = sizeList(set).map((s) => ({ label: `${s.id === cur ? '✓ ' : ''}${$t(s.label)}${s.note ? ` — ${$t(s.note)}` : ''}`, key: ptTxt(s.pt), run: () => { set.size[sizeKey(set)] = s.id; changed(); } }));
      items.push('sep', { label: `${cur === 'custom' ? '✓ ' : ''}${$t('Paste \\the\\linewidth…')}`, key: $t('exact'), run: () => { set.size[sizeKey(set)] = 'custom'; if (!set.customPt) set.customPt = sizeOf(Object.assign(optsOf(set), { sizeId: null })).pt; changed(); setTimeout(() => { customInp.focus(); customInp.select(); }, 30); } });
      A.openMenu(sizeBtn, items);
    });
    const opts = (extra) => optsOf(set, Object.assign({ name: nameInp.value || A.sceneName(), captionTex: capEdited }, extra || {}));
    const placePaper = () => {
      if (!fig) return;
      const T = st.T || [8, 9, 9];
      const wpx = fig.W * 96 / 72, margin = set.for === 'homework' ? 72 : 48;
      paper.style.width = `${wpx + 2 * margin}px`;
      paper.style.padding = `28px ${margin}px 24px`;
      // body text at the document's size: lines every 1.2 x the size
      paper.style.setProperty('--lh', `${(T[2] || 10) * 1.2 * 96 / 72 / 1.0}px`);
      const avail = Math.max(200, scroll.clientWidth - 24);
      const z = Math.min(1.05, avail / (wpx + 2 * margin));
      paper.style.zoom = String(z);
      figImg.style.width = `${wpx}px`;
      capImg.style.width = `${wpx}px`; capTa.style.width = `${wpx}px`;
    };
    let capTok = 0;
    const showCaption = async () => {
      if (!fig) return;
      const tex = capEdited != null ? capEdited : fig.captionTex;
      if (!tex || set.for === 'slides') { capBox.hidden = true; return; }
      // (the caption box is there at once, for a click; its picture follows when the words are typeset)
      capBox.hidden = false;
      const T = st.T || [8, 9, 9], my = ++capTok, f0 = fig;
      await warmCaption(tex, T[2], fig.lang);
      if (my !== capTok || f0 !== fig || closed) return;
      const c = captionSVG(tex, fig.W, T[2], fig.lang);
      capImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.svg);
      capImg.style.width = `${fig.W * 96 / 72}px`;
      updTex();
    };
    function editCaption() {
      if (!fig || capBox.classList.contains('editing')) return;
      capBox.classList.add('editing');
      capTa.value = capEdited != null ? capEdited : fig.captionTex;
      capImg.replaceWith(capTa);
      capBox.append(regen);
      capTa.focus();
      let t = 0;
      capTa.oninput = () => { clearTimeout(t); t = setTimeout(() => { capEdited = capTa.value; regen.hidden = false; }, 250); };
      capTa.onblur = () => { capEdited = capTa.value === fig.captionTex ? capEdited : capTa.value; capBox.classList.remove('editing'); capTa.replaceWith(capImg); regen.hidden = capEdited == null; showCaption(); };
      capTa.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); capTa.blur(); } };
    }
    const rebuild = async () => {
      const my = ++token;
      st.building = true; scroll.classList.add('busy'); wait.hidden = false;
      wait.textContent = XD.ready() ? $t('Typesetting…') : $t('Preparing formulas…');
      // (once MathJax is in, the line says what the build is doing now)
      if (!XD.ready()) XD.whenReady(20000, () => my === token && !closed).then((on) => { if (on && my === token && !wait.hidden) wait.textContent = $t('Typesetting…'); });
      try {
        const f = await build(opts({ draft: true, alive: () => my === token && !closed }));
        if (my !== token || !f) return;
        fig = f; lastFig = f; st.fig = f;
        figImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f.svg);
        before.innerHTML = set.for === 'homework' ? `<div class="xf-prob">${$t('Problem 3.')}</div>${dummy(3, 7, true)}` : dummy(4, 11, true);
        after.innerHTML = dummy(3, 5, true);
        // (the LaTeX box at once; the caption on the paper follows when its words are typeset)
        placePaper(); updTex(); showCaption();
        const T = st.T || [8, 9, 9];
        const tsz = set.text[set.for] || (set.for === 'article' ? 10 : 11);
        facts.innerHTML = '';
        // (Russian: centimetres, one decimal, GLOSSARY 3.8)
        const dims = uiLang() === 'en' || !I18 ? `${(f.W / 72).toFixed(2)} × ${(f.H / 72).toFixed(2)} in` : $t('{x} × {x2} in', { x: I18.num((f.W / 72 * 2.54).toFixed(1)), x2: I18.num((f.H / 72 * 2.54).toFixed(1)) });
        facts.append(h('b', null, dims), $t(' · labels {x}/{x2} pt, as in {tsz} pt text · {choice} · {choice2}', { x: I18 ? I18.num(T[0]) : T[0], x2: I18 ? I18.num(T[1]) : T[1], tsz, choice: f.ink === 'bw' ? $t('gray only') : $t('print color'), choice2: f.for === 'homework' ? $t('stays under its problem ([H])') : f.star ? $t('figure* across both columns') : $t('floats [tbp]') }));
        if (f.info && f.info.hiddenZP) facts.append(h('div', { class: 'xf-warn' }, $t('Most zeros and poles are on the far side of the sphere in these frames: turn the globe so they face you, then export again.')));
      } catch (e) {
        // (MathJax that never came is a known condition the message below reports, not an error of the page)
        (/MathJax/.test(String(e && e.message)) ? console.warn : console.error)(e);
        if (my === token) { wait.hidden = false; wait.textContent = /MathJax/.test(String(e && e.message)) ? $t('The typesetter is still loading; try again in a moment.') : $t('The figure could not be made.'); }
        return;
      } finally { if (my === token) { st.building = false; scroll.classList.remove('busy'); } }
      wait.hidden = true;
    };
    // the destinations: For Overleaf copies the LaTeX first (while the click still counts as a gesture), then saves
    // the PDF; For Docs copies the PNG with its printed size and the caption in the image
    const done = (btn, text) => { const t0 = btn.textContent; btn.classList.add('done'); btn.textContent = text; setTimeout(() => { if (btn.isConnected) { btn.classList.remove('done'); btn.textContent = t0; sync(); } }, 2600); };
    const full = async (extra) => build(opts(Object.assign({ alive: () => !closed }, extra)));
    olBtn.addEventListener('click', async () => {
      if (!fig) return;
      const fmt = fmtOf(), dpi = dpiOf();
      A.copyText(latex(fig, capEdited, fmt, dpi));
      olBtn.disabled = true; olBtn.textContent = fmt === 'pdf' ? $t('Making the PDF…') : $t('Making the file…');
      try {
        const f = await full();
        if (!f) return;
        // (a declined or refused save: no "Saved", no hint, and it is not remembered as the last destination)
        const file = `${f.name}.${fmt}`;
        if (await A.saveFile(file, fmt === 'png' ? await png(f, dpi) : fmt === 'svg' ? svgBlob(f) : await pdf(f)) === false) return;
        set.last = set.lastFig = { kind: 'overleaf', fmt, dpi }; saveSet(set);
        done(olBtn, $t('✓ Saved · LaTeX copied'));
        after2.hidden = false;
        after2.textContent = $t("First time only: drop {name}.pdf into Overleaf's file tree, then paste. {choice}", { name: f.name, choice: f.for === 'homework' ? $t('The snippet keeps the figure under your solution and shrinks it only if your page is narrower.') : $t('The snippet includes the figure at its natural size, so its labels match your text.') }).replace(`${f.name}.pdf`, file);
      } catch (e) { console.error(e); cueError(); toast(fmt === 'pdf' ? $t('The PDF could not be made here; try More formats → SVG.') : $t('The figure could not be saved.')); }
      finally { olBtn.disabled = false; if (!olBtn.classList.contains('done')) sync(); }
    });
    docsBtn.addEventListener('click', async () => {
      if (!fig) return;
      docsBtn.disabled = true; docsBtn.textContent = $t('Copying…');
      try {
        const f = await full({ capInImage: set.for !== 'slides' });
        if (!f) return;
        const how = await copyImage(f);
        if (how) { set.last = set.lastFig = { kind: 'docs', fmt: 'png' }; saveSet(set); done(docsBtn, $t('✓ Copied · paste it')); cueDone(); }
        else if (await A.saveFile(`${f.name}.png`, await png(f, 300)) !== false) { set.last = set.lastFig = { kind: 'docs', fmt: 'png' }; saveSet(set); done(docsBtn, $t('✓ Saved PNG')); }
      } catch (e) { console.error(e); cueError(); toast($t('The image could not be copied; try More formats → PNG.')); }
      finally { docsBtn.disabled = false; if (!docsBtn.classList.contains('done')) sync(); }
    });
    const saveAs = async (fmt, dpi) => {
      try {
        const f = await full({ capInImage: fmt === 'png' && set.for === 'homework' });
        if (!f) return;
        let ok;
        if (fmt === 'pdf') ok = await A.saveFile(`${f.name}.pdf`, await pdf(f));
        else if (fmt === 'svg') ok = await A.saveFile(`${f.name}.svg`, svgBlob(f));
        else if (fmt === 'png') ok = await A.saveFile(`${f.name}.png`, await png(f, dpi || 300));
        else if (fmt === 'tex') ok = await A.saveFile(`${f.name}-latex.txt`, latex(f, capEdited, fmtOf(), dpiOf()));
        if (ok !== false) { set.last = set.lastFig = { kind: 'save', fmt, dpi }; saveSet(set); }
      } catch (e) { console.error(e); cueError(); toast(fmt === 'pdf' ? $t('The PDF could not be made here; try SVG.') : $t('The figure could not be saved.')); }
    };
    saveBtn.addEventListener('click', async () => {
      if (!fig) return;
      const fmt = fmtOf();
      saveBtn.disabled = true;
      try { await saveAs(fmt, dpiOf()); } finally { saveBtn.disabled = false; }
    });
    // Share PNG…: the system share sheet with the picture (a phone); where it cannot take a file, the PNG is saved
    shareBtn.addEventListener('click', async () => {
      if (!fig) return;
      shareBtn.disabled = true;
      try {
        const f = await full({ capInImage: set.for === 'homework' });
        if (!f) return;
        const file = new File([await png(f, 300)], `${f.name}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: f.name }); set.last = set.lastFig = { kind: 'save', fmt: 'png', dpi: 300 }; saveSet(set); }
        else if (await A.saveFile(file.name, file) !== false) toast($t('Saved {name}.png', { name: f.name }));
      } catch (e) { if (!(e && e.name === 'AbortError')) { console.error(e); cueError(); toast($t('The figure could not be saved.')); } }
      finally { shareBtn.disabled = false; }
    });
    moreBtn.addEventListener('click', () => {
      A.openMenu(moreBtn, [
        { label: 'PDF', key: $tx('format', 'vector'), run: () => saveAs('pdf') },
        { label: 'SVG', key: $tx('format', 'vector'), run: () => saveAs('svg') },
        { label: 'PNG · 300 dpi', key: $tx('format', 'image'), run: () => saveAs('png', 300) },
        { label: 'PNG · 600 dpi', key: $tx('format', 'image'), run: () => saveAs('png', 600) },
        'sep',
        { label: $t('Copy LaTeX only'), run: () => { if (fig) { A.copyText(latex(fig, capEdited, fmtOf(), dpiOf())); set.last = set.lastFig = { kind: 'latex', fmt: fmtOf(), dpi: dpiOf() }; saveSet(set); toast($t('LaTeX copied.')); cueDone(); } } },
        { label: $t('Save LaTeX (.txt)'), run: () => saveAs('tex') },
        { label: $t('Copy image'), run: () => docsBtn.click() },
      ]);
    });
    let vRun = null;
    cancelBtn.addEventListener('click', () => { if (vRun) vRun.cancel = true; });
    // (while a video is made its options are locked: the plan is fixed at the start; the progress takes the name row's
    // place, so the dialog does not move; the screen reader hears the start, every quarter and the end)
    const running = (on) => {
      nameLab.hidden = on; prog.hidden = !on;
      for (const el of vidBox.querySelectorAll('button, select, input')) el.disabled = on;
      for (const b of fmtSeg.children) b.disabled = on || (b.dataset.v === 'video' && (!canVideo || (!defo && A.canDeform && !A.canDeform())));
    };
    const onVis = () => { if (vRun && document.hidden) vRun.hid = true; else if (vRun && vRun.hid) { vRun.hid = false; toast($t('Keep this tab in front while the video is made: a hidden tab can slow it down.')); } };
    document.addEventListener('visibilitychange', onVis);
    vidBtn.addEventListener('click', async () => {
      if (vRun) return;
      const run = vRun = { cancel: false, q: -1 };
      vidBtn.disabled = true; running(true); meter.style.width = '0%'; meterEl.setAttribute('aria-valuenow', '0'); progTxt.textContent = $t('Preparing…'); progSr.textContent = $t('Making the video');
      try {
        const r = await makeVideo(opts({ video: vset, alive: () => !closed && !run.cancel }), { cancelled: () => closed || run.cancel, progress: (i, n) => {
          const pc = 100 * i / n, q = Math.floor(pc / 25);
          meter.style.width = `${pc.toFixed(1)}%`; meterEl.setAttribute('aria-valuenow', String(Math.round(pc))); progTxt.textContent = $t('Frame {i} of {n}', { i, n });
          if (q !== run.q && q < 4) { run.q = q; if (q > 0) progSr.textContent = $t('{p} % done', { p: q * 25 }); }
        } });
        if (!r) { if (!closed) toast($t('The video was cancelled.')); return; }
        progTxt.textContent = $t('Saving…');
        if (await A.saveFile(`${r.name}.${r.ext}`, r.blob) === false) return;
        set.last = { kind: 'video', fmt: r.ext }; saveSet(set);
        progSr.textContent = $t('The video is saved.');
        st.video = { frames: r.frames, fps: r.fps, codec: r.codec, ext: r.ext, W: r.W, H: r.H, bytes: r.blob.size, ms: r.ms };
        done(vidBtn, $t('✓ Saved'));
        after2.hidden = false;
        after2.textContent = $t('{w} × {h}, {fps} fps, {secs} s, {codec} ({ext}).', { w: r.W, h: r.H, fps: r.fps, secs: I18 ? I18.num(r.secs.toFixed(1)) : r.secs.toFixed(1), codec: /^avc1/.test(r.codec) ? 'H.264' : /^vp09/.test(r.codec) ? 'VP9' : 'VP8', ext: r.ext.toUpperCase() });
      } catch (e) { console.error(e); cueError(); toast(/WebCodecs/.test(String(e && e.message)) ? $t('This browser cannot encode video. Try a recent Chrome, Edge or Safari.') : $t('The video could not be made here.')); }
      finally { vRun = null; vidBtn.disabled = false; running(false); if (!vidBtn.classList.contains('done')) syncFmt(); }
    });
    let rz = 0;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { placePaper(); if (pvWH && fmtOf() === 'video') pv.resize(fitPv(pvWH[0], pvWH[1])); }, 60); }; // (bigger: sharper frames; review vp-3)
    window.addEventListener('resize', onResize);
    // (a sharper screen with the same window, such as a move to a retina monitor: devicePixelRatio changes and no
    // 'resize' may come, so its media query is watched too, re-armed for each new ratio; review-video-preview-verify vp-3)
    let dq = null;
    const onDpr = () => { onResize(); armDpr(); };
    const armDpr = () => { try { if (dq) dq.removeEventListener('change', onDpr); dq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`); dq.addEventListener('change', onDpr); } catch (e) { dq = null; } };
    armDpr();
    const obs = new MutationObserver(() => { if (!bg.isConnected) { pv.stop(); window.removeEventListener('resize', onResize); if (dq) dq.removeEventListener('change', onDpr); document.removeEventListener('visibilitychange', onVis); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    sync();
    (canShareFiles() ? shareBtn : saveBtn).focus({ preventScroll: true });
    setTimeout(rebuild, 30);
    pdfLib();
  }
  // the share sheet takes files here (a phone's browser); a laptop keeps Save
  const canShareFiles = () => typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && matchMedia('(pointer: coarse)').matches;
  // the export menu's Copy figure again / Save figure again: the last destination, with the remembered settings
  // (MathJax may still be loading: build waits for it up to 20 s with no dialog to show it, so the menu item says so, and a
  // second press while it waits is ignored)
  let againBusy = false;
  async function again(what) {
    if (againBusy) return false;
    againBusy = true;
    try {
      if (!XD.ready()) A.toast($t('Preparing formulas…'));
      return await againRun(what);
    } finally { againBusy = false; }
  }
  async function againRun(what) {
    const set = loadSet();
    // (after a video: Save opens the dialog on Video, with its progress and Cancel, while the deformation is on; else,
    // and for Copy, the last figure is made again; export review r3, video-3)
    if (set.last && set.last.kind === 'video' && what === 'save' && defoOf(A.viewKind()) && typeof VideoEncoder !== 'undefined') { set.fmt = 'video'; saveSet(set); open(); return true; }
    const last = set.last && set.last.kind !== 'video' ? set.last : set.lastFig || { kind: 'overleaf', fmt: 'pdf' };
    if (set.last && set.last.kind === 'video' && set.fmt === 'video') set.fmt = last.fmt === 'png' || last.fmt === 'svg' ? last.fmt : 'pdf';
    const f = await build(optsOf(set, { capInImage: what === 'copy' && last.kind === 'docs' }));
    if (!f) return false;
    if (what === 'copy') {
      if (last.kind === 'docs') { const how = await copyImage(f); if (!how) { if (await A.saveFile(`${f.name}.png`, await png(f, 300)) !== false) A.toast($t('Saved {name}.png (the image could not be copied here).', { name: f.name })); } else { A.toast($t('Figure copied as an image.')); cueDone(); } }
      else { await A.copyText(latex(f, null, last.fmt === 'png' || last.fmt === 'svg' ? last.fmt : 'pdf', last.dpi || 300)); A.toast($t('Figure LaTeX copied.')); cueDone(); }
      return true;
    }
    const fmt = last.fmt || 'pdf';
    if (fmt === 'svg') await A.saveFile(`${f.name}.svg`, svgBlob(f));
    else if (fmt === 'png') await A.saveFile(`${f.name}.png`, await png(f, last.dpi || 300));
    else if (fmt === 'tex') await A.saveFile(`${f.name}-latex.txt`, latex(f));
    else await A.saveFile(`${f.name}.pdf`, await pdf(f));
    return true;
  }
  return {
    attach: (api) => { A = api; },
    build, pdf, png, svgBlob, greyProof, latex, captionSVG, copyImage, open, again,
    makeVideo, videoCheck, videoScreenCheck, videoTimes, muxMP4, muxWebM, previewStats: () => Object.assign({}, pvStats), defoOf: (v) => defoOf(v || (A && A.viewKind())), shortCaption,
    settings: loadSet, saveSettings: saveSet, sizes: SIZES, presets: PRESET,
    dialog: () => dlg, last: () => lastFig, segsOf, plainOf, XD,
    geom: { senseAt, chevronAt, fitBox },
  };
