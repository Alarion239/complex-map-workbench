'use strict';
// The phone layout (v15; notes/ui-redesign-2/phone/DESIGN.md, build notes in notes/ui-redesign-2/build/phone.md).
//
// Below 768 px (and on a landscape phone: coarse pointer, at most 500 px tall, below 1024 px wide) the page is one
// screen without page scroll: the view switch and More in the header, one plane with the other as a live inset (tap
// it to swap), the chain bar (Numbers, the cards, +, F, Deformation) and the tool row (Undo, Select, Point, Disc,
// Polygon, More). Everything else opens in one bottom sheet: the Editor (the Inspector with Parameters), More tools
// (with the region formula and the shapes), Display, and More (sound, theme, language, examples, export, help).
// While the Editor, More tools or Display is open, X and Y sit side by side above it.
//
// The phone moves some of the app's own elements into its sheets (the Inspector's host, the region sections, the
// Deformation toggle) and puts them back when the window grows past the phone layout: their listeners stay theirs.
// The app hands over a small API (app.js, Phone.init at the end of init()). Nothing here runs at 768 px and up.
const Phone = (() => {
  let A = null;
  let on = false, land = false;
  let big = 'L';                       // the large plane in X → Y; the other one is the inset
  let kind = null, full = false;       // the open sheet and its height
  let nums = false;                    // the Editor opened by Numbers: Parameters only (review design-12)
  let anim = 0;                        // the sheet's opening or closing timer
  const homes = [];                    // [el, placeholder] of the moved elements
  const els = {};
  const SPLIT = new Set(['edit', 'tools', 'display']);   // the non-modal sheets: X | Y above them
  const MQP = '(max-width: 767px)';
  const MQL = '(orientation: landscape) and (max-height: 500px) and (max-width: 1023px) and (pointer: coarse)';
  const DUR = 220;
  const $ = (id) => document.getElementById(id);
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'html') e.innerHTML = v; else if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids) if (c != null) e.append(c);
    return e;
  };
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const rootEl = document.documentElement;

  // ---------------- moving the app's elements ----------------
  function park(el, parent, before) {
    if (!el || homes.some((x) => x[0] === el)) { if (el && parent) parent.insertBefore(el, before || null); return; }
    const ph = el.parentNode ? document.createComment('phone') : null;   // (a phone-only element has no home)
    if (ph) el.parentNode.insertBefore(ph, el);
    homes.push([el, ph]);
    parent.insertBefore(el, before || null);
  }
  function unparkAll() {
    for (const [el, ph] of homes.splice(0)) { if (!ph) el.remove(); else if (ph.parentNode) { ph.parentNode.insertBefore(el, ph); ph.remove(); } }
  }

  // ---------------- the build (once) ----------------
  function build() {
    if (els.sheet) return;
    const I = A.icons;
    // the sheet: a head (title, the grabber, close) and one body per kind
    els.scrim = h('div', { class: 'ph-scrim ph-only', hidden: true, onclick: () => close() });
    els.title = h('span', { class: 'ph-st' });
    els.snap = h('button', { class: 'ph-pill ph-snap', type: 'button', 'aria-pressed': 'true', onclick: () => { $('snapBtn').click(); syncSnap(); } },
      h('span', { class: 'ph-ic', html: I.snap }), h('span', null, $t('Snap')));
    els.grab = h('button', { class: 'ph-grab', type: 'button', 'aria-label': $t('Resize the sheet') });
    els.close = h('button', { class: 'ph-x', type: 'button', 'aria-label': $t('Close'), html: I.close, onclick: () => close() });
    els.mark = h('span', { class: 'ph-mark', 'aria-hidden': 'true' });
    const head = h('div', { class: 'ph-sh' }, els.grab, els.mark, els.title, h('span', { class: 'grow' }), els.snap, els.close);
    els.body = {};
    for (const k of ['edit', 'tools', 'display', 'more']) els.body[k] = h('div', { class: 'ph-sb', 'data-k': k, hidden: true });
    els.sheet = h('div', { class: 'ph-sheet ph-only', role: 'dialog', 'aria-modal': 'false', hidden: true }, head, ...Object.values(els.body));
    document.body.append(els.scrim, els.sheet);
    grabber(head);
    // the Editor: the Inspector's host comes in when the phone layout starts
    // More tools: the tiles, then the region formula and the shapes (moved in)
    els.tiles = h('div', { class: 'ph-tiles', role: 'group', 'aria-label': $t('Drawing tools') });
    els.body.tools.append(els.tiles);
    // Display: this view's options, then the region display (moved in)
    els.viewOpts = h('div', { class: 'ph-vopts' });
    els.body.display.append(h('h3', { class: 'ph-h' }, $t('This view')), els.viewOpts);
    // the chain bar: Numbers first
    els.nums = h('button', { class: 'ph-nums ph-only', type: 'button', onclick: () => open('edit', { params: true }) });
    // the tool row: Undo first (its long-press offers Redo)
    els.undo = h('button', { class: 'ph-undo tool ph-only', type: 'button', 'aria-label': $t('Undo'), html: `${I.undo}<span>${$t('Undo')}</span>` });
    undoKey(els.undo);
    // each plane: Sphere and Display at the right; the inset's swap cover
    for (const side of ['L', 'R']) {
      const plot = $(side === 'L' ? 'plotL' : 'plotR'), pane = $(side === 'L' ? 'paneL' : 'paneR');
      const sph = h('button', { class: 'ph-key ph-sph', type: 'button', 'aria-pressed': 'false', 'aria-label': $t('Sphere'), html: A.modeIcons.sphere, onclick: () => toggleSphere(side) });
      const dsp = h('button', { class: 'ph-key ph-dsp', type: 'button', 'aria-label': $t('Display options'), html: I.sliders, onclick: () => open('display', { side }) });
      plot.append(h('div', { class: 'ph-col ph-only' }, sph, dsp));
      els['sph' + side] = sph;
      const sw = h('button', { class: 'ph-swap ph-only', type: 'button', onclick: () => swap() },
        h('span', { class: 'ph-tag', html: side === 'L' ? '<i>X</i>' : '<i>Y</i>' }), h('span', { class: 'ph-swic', html: SWAP }));
      pane.append(sw);
      els['swap' + side] = sw;
    }
    // the tool row's More key and the header's More open sheets on a phone
    $('toolMore').addEventListener('click', (e) => { if (!on) return; e.preventDefault(); e.stopPropagation(); open('tools'); }, true);
    $('hdrMoreBtn').addEventListener('click', (e) => { if (!on) return; e.preventDefault(); e.stopPropagation(); open('more'); }, true);
    // a card, the region card or the F tile opens the Editor (the app has selected it already)
    $('pipeline').addEventListener('click', (e) => {
      if (!on) return;
      const t = e.target;
      if (t.closest('.acts, .conn-add, .add-card, button.icon-btn')) return;
      if (t.closest('.card, .ftile')) open('edit');
    });
    // the tool row follows the tool: a tool from More tools lights the More key with its icon and name
    new MutationObserver(() => syncTools()).observe($('tools'), { subtree: true, attributes: true, attributeFilter: ['class'] });
    new MutationObserver(() => { els.undo.disabled = $('undoBtn').disabled; }).observe($('undoBtn'), { attributes: true, attributeFilter: ['disabled'] });
    els.undo.disabled = $('undoBtn').disabled;
    // the views: the inset only in X → Y; the plane chips and the Sphere keys follow
    const panes = $('panes');
    new MutationObserver(() => { if (on) syncPanes(); }).observe(panes, { attributes: true, attributeFilter: ['class'] });
    for (const id of ['leftTabs', 'rightTabs', 'viewSwitch']) new MutationObserver(() => { if (on) syncPanes(); }).observe($(id), { subtree: true, attributes: true, attributeFilter: ['class'] });
    if (typeof Params !== 'undefined' && Params.on) { Params.on('change', syncNums); Params.on('structure', syncNums); }
    window.addEventListener('keydown', (e) => { if (on && kind && e.key === 'Escape' && !document.querySelector('#popHost .pop, .modal-bg')) { close(); } });
  }
  const GRID = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>';
  const TEX = '<svg viewBox="0 0 20 16" width="18" height="16" aria-hidden="true" fill="currentColor"><text x="0" y="11" font-family="STIX Two Text, Times New Roman, serif" font-size="10">T</text><text x="5.6" y="14" font-family="STIX Two Text, Times New Roman, serif" font-size="10">E</text><text x="11.4" y="11" font-family="STIX Two Text, Times New Roman, serif" font-size="10">X</text></svg>';
  const TOUR = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6.6 5.4v5.2L10.6 8z" fill="currentColor"/></svg>';
  const SWAP = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13"/></svg>';

  // ---------------- mode ----------------
  function sync() {
    const p = matchMedia(MQP).matches, l = !p && matchMedia(MQL).matches;
    const want = p || l;
    if (want === on && l === land) return;
    if (want && !on) enter(l); else if (!want && on) leave(); else { land = l; rootEl.classList.toggle('ph-land', l); close(true); A.resize(); }
  }
  function enter(l) {
    on = true; land = l;
    build();
    rootEl.classList.add('ph');
    rootEl.classList.toggle('ph-land', l);
    // the Inspector's host goes into the Editor, the region sections into More tools and Display; the Deformation
    // toggle closes the chain bar; Numbers opens it
    park($('propsPanel'), els.body.edit);
    park($('secFormula'), els.body.tools);
    park($('secShapes'), els.body.tools);
    park($('secDisplay'), els.body.display);
    const wrap = document.querySelector('.pipe-wrap');
    park(els.nums, wrap, $('pipeline'));
    park($('morphBtn'), wrap);
    park(els.undo, $('secDraw'), $('secDraw').firstChild);
    for (const id of ['secFormula', 'secShapes', 'secDisplay']) { const d = $(id); if (d) d.open = true; }
    A.showPanels(true);
    syncPanes(); syncTools(); syncNums(); syncSnap();
    A.resize();
  }
  function leave() {
    close(true);
    on = false;
    rootEl.classList.remove('ph', 'ph-land', 'ph-split', 'ph-full', 'ph-morph');
    $('panes').classList.remove('ph-big-L', 'ph-big-R', 'ph-one');
    unparkAll();
    A.showPanels(false);
    A.resize();
  }

  // ---------------- the planes ----------------
  function merged() { const p = $('panes'); return p.classList.contains('merged-L') ? 'L' : p.classList.contains('merged-R') ? 'R' : null; }
  function syncPanes() {
    const p = $('panes'), mg = merged();
    const b = mg || big;
    p.classList.toggle('ph-big-L', b === 'L');
    p.classList.toggle('ph-big-R', b === 'R');
    p.classList.toggle('ph-one', !!mg);
    rootEl.classList.toggle('ph-morph', !!A.morphOn());
    const split = land || rootEl.classList.contains('ph-split');
    for (const side of ['L', 'R']) $(side === 'L' ? 'paneL' : 'paneR').classList.toggle('ph-inset', !mg && !split && side !== b);
    for (const side of ['L', 'R']) {
      const tabs = $(side === 'L' ? 'leftTabs' : 'rightTabs'), sph = els['sph' + side];
      const sb = tabs && tabs.querySelector('button[data-mode="sphere"]');
      sph.hidden = !sb || tabs.offsetParent === null && !tabs.closest('.pane-head');
      const onS = !!(sb && sb.classList.contains('on'));
      sph.setAttribute('aria-pressed', String(onS));
      sph.setAttribute('aria-label', onS ? $t('Plane') : $t('Sphere'));
      const other = side === 'L' ? 'Y' : 'X';
      els['swap' + side].setAttribute('aria-label', $t('Show {x} large', { x: side === 'L' ? 'X' : 'Y' }));
      els['swap' + side].title = '';
      void other;
    }
  }
  function toggleSphere(side) {
    const tabs = $(side === 'L' ? 'leftTabs' : 'rightTabs');
    if (!tabs) return;
    const sb = tabs.querySelector('button[data-mode="sphere"]'), pb = tabs.querySelector('button[data-mode="plane"]');
    const t = sb && sb.classList.contains('on') ? pb : sb;
    if (t) t.click();
    setTimeout(syncPanes, 0);
  }
  // the inset swaps with the large plane: the large one keeps its view, the new inset is fitted (its own view comes
  // back when it is large again)
  const keep = { L: null, R: null };
  function swap() {
    if (merged() || rootEl.classList.contains('ph-split')) return;
    const was = big;
    big = big === 'L' ? 'R' : 'L';
    keep[was] = A.getView(was);
    syncPanes();
    A.resize();
    if (keep[big]) { A.setView(big, keep[big]); keep[big] = null; }
    A.fit(was);
    A.sound('swap');
  }

  // ---------------- the tool row ----------------
  const ROW = ['select', 'point', 'disc', 'polygon'];
  function syncTools() {
    if (!els.undo) return;
    const onB = document.querySelector('#tools .tool.on');
    const id = onB ? onB.dataset.tool : 'select';
    const sum = document.querySelector('#toolMore > summary');
    if (!sum) return;
    const lab = sum.querySelector('.tm-open'), ic = sum.querySelector(':scope > .ic-slot');
    if (!els.moreIc) { els.moreIc = ic.innerHTML; els.moreLab = lab.textContent; }
    const extra = onB && !ROW.includes(id);
    sum.classList.toggle('ph-lit', !!extra);
    if (extra) { ic.innerHTML = onB.querySelector('svg').outerHTML; lab.textContent = onB.getAttribute('aria-label'); }
    else if (ic.dataset.ph !== 'more') { ic.innerHTML = els.moreIc; lab.textContent = els.moreLab; }
    ic.dataset.ph = extra ? id : 'more';
    if (kind === 'tools') fillTiles();
  }
  function fillTiles() {
    const tiles = [...document.querySelectorAll('#tools .tool[data-tool]')].map((b) => {
      const t = h('button', { class: 'ph-tile' + (b.classList.contains('on') ? ' on' : ''), type: 'button', 'aria-pressed': String(b.classList.contains('on')), 'data-tool': b.dataset.tool, 'aria-label': b.getAttribute('aria-label') },
        h('span', { class: 'ph-ic', html: b.querySelector('svg').outerHTML }), h('span', { class: 'ph-tl' }, b.querySelector('span').textContent));
      t.addEventListener('click', () => {
        const id = b.dataset.tool;
        b.click();
        if (id === 'formula') { const f = $('formulaInput'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); } return; }
        close();
      });
      return t;
    });
    els.tiles.replaceChildren(...tiles);
  }
  function syncSnap() { const s = $('snapBtn'); if (s && els.snap) els.snap.setAttribute('aria-pressed', s.getAttribute('aria-pressed') || 'false'); }
  // Undo: a tap undoes; a long press offers Redo
  function undoKey(b) {
    let t = 0, long = false;
    b.addEventListener('pointerdown', () => { long = false; clearTimeout(t); t = setTimeout(() => { long = true; redoMenu(b); }, 480); });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => clearTimeout(t));
    b.addEventListener('click', (e) => { if (long) { e.preventDefault(); long = false; return; } $('undoBtn').click(); });
    b.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  function redoMenu(anchor) {
    A.openMenu(anchor, [
      { label: $t('Undo'), icon: 'undo', disabled: $('undoBtn').disabled, run: () => $('undoBtn').click() },
      { label: $t('Redo'), icon: 'redo', disabled: $('redoBtn').disabled, run: () => $('redoBtn').click() },
    ]);
  }

  // ---------------- Numbers ----------------
  function syncNums() {
    if (!els.nums) return;
    const list = typeof Params !== 'undefined' ? Params.list() : [];
    const names = list.map((p) => (Params.display ? Params.display(p.name) : p.name));
    els.nums.replaceChildren(h('span', { class: 'ph-na', html: '<i>a</i> =' }),
      h('span', { class: 'ph-nn', html: names.length ? names.map((n) => `<i>${n}</i>`).join(', ') : $t('Numbers') }));
    els.nums.setAttribute('aria-label', names.length ? $t('Numbers: {list}', { list: names.join(', ') }) : $t('Numbers'));
  }

  // ---------------- the sheet ----------------
  function geometry() {
    const H = window.innerHeight;
    const hp = Math.round(Math.max(180, Math.min(340, H * 0.36)));
    rootEl.style.setProperty('--ph-hp', hp + 'px');
    // the sheet's height less the tool row's: how far the chain bar rides up with it
    const row = ($('secDraw') && $('secDraw').getBoundingClientRect().height) || 56;
    rootEl.style.setProperty('--ph-ride', Math.max(0, H - (56 + hp + 64) - row) + 'px');
  }
  function open(k, opt = {}) {
    if (!on) return;
    const wantNums = k === 'edit' && !!opt.params;
    if (kind === k && k === 'edit' && wantNums !== nums) { setNums(wantNums); A.renderInspector(); return; }
    if (kind === k && !opt.params && !opt.side) { if (k !== 'edit') close(); return; }
    clearTimeout(anim);
    const was = kind;
    if (was && SPLIT.has(was) !== SPLIT.has(k)) close(true);
    if (typeof A.closePops === 'function') A.closePops();
    kind = k;
    geometry();
    for (const [n, b] of Object.entries(els.body)) b.hidden = n !== k;
    els.sheet.dataset.k = k;
    els.sheet.setAttribute('aria-modal', String(!SPLIT.has(k)));
    els.sheet.setAttribute('aria-label', TITLES()[k]);
    els.title.textContent = k === 'edit' ? '' : TITLES()[k];
    setNums(wantNums);
    els.snap.hidden = k !== 'tools';
    els.mark.hidden = k !== 'more';
    if (k === 'more') fillMore();
    if (k === 'tools') { fillTiles(); syncSnap(); }
    if (k === 'display') fillDisplay(opt.side || big);
    if (k === 'edit') A.renderInspector();
    els.sheet.hidden = false;
    els.scrim.hidden = SPLIT.has(k) || land;
    const split = SPLIT.has(k);
    if (was && SPLIT.has(was) === split) { after(k, opt); return; }
    // the sheet slides in by its transform alone; the planes change size once, at the end
    els.sheet.classList.add('opening');
    void els.sheet.offsetHeight;
    els.sheet.classList.remove('opening');
    els.sheet.classList.add('open');
    rootEl.classList.add('ph-sheet-on');
    if (split && !land) rootEl.classList.add('ph-ride');
    const done = () => {
      if (kind !== k) return;
      if (split) {
        rootEl.classList.add('ph-notrans', 'ph-split');
        rootEl.classList.remove('ph-ride');
        syncPanes(); A.resize();
        void els.sheet.offsetHeight;
        rootEl.classList.remove('ph-notrans');
      }
      after(k, opt);
    };
    if (reduced()) done(); else anim = setTimeout(done, DUR);
  }
  // Numbers: the Editor with Parameters alone, headed Numbers; a card or the F tile brings the selection back
  function setNums(v) {
    nums = !!v;
    els.sheet.classList.toggle('nums', nums);
    if (kind === 'edit') {
      els.title.textContent = nums ? $t('Numbers') : '';
      els.sheet.setAttribute('aria-label', nums ? $t('Numbers') : TITLES().edit);
    }
  }
  function after(k, opt) {
    if (k === 'edit' && opt.params) els.body.edit.scrollTop = 0;
    const f = els.sheet.querySelector('.ph-sh .ph-x');
    if (!SPLIT.has(k) && f) f.focus({ preventScroll: true });
  }
  function close(now) {
    if (!kind) return;
    clearTimeout(anim);
    const k = kind;
    kind = null; full = false; nums = false; els.sheet.classList.remove('nums');
    rootEl.classList.remove('ph-full');
    const split = rootEl.classList.contains('ph-split');
    rootEl.classList.remove('ph-split');
    if (split) {
      // the chain bar rides down with the sheet: it starts where it stood above the sheet
      if (!land && !now) { rootEl.classList.add('ph-notrans', 'ph-ride'); void els.sheet.offsetHeight; rootEl.classList.remove('ph-notrans'); }
      syncPanes(); A.resize();
      if (!land && !now) requestAnimationFrame(() => rootEl.classList.remove('ph-ride'));
    }
    rootEl.classList.remove('ph-ride');
    // this view's options go back to the app (it keeps them for its own popover)
    els.viewOpts.replaceChildren();
    if (els.morphKids) { for (const [el, ph] of els.morphKids) { if (ph.parentNode) { ph.parentNode.insertBefore(el, ph); ph.remove(); } } els.morphKids = null; }
    els.sheet.classList.remove('open');
    els.scrim.hidden = true;
    rootEl.classList.remove('ph-sheet-on');
    const fin = () => { if (!kind) { els.sheet.hidden = true; for (const b of Object.values(els.body)) b.hidden = true; } };
    if (now || reduced()) fin(); else anim = setTimeout(fin, DUR);
    void k;
  }
  function setFull(f) {
    if (!kind) return;
    full = !!f;
    rootEl.classList.toggle('ph-full', full);
  }
  // the head is the grabber: a tap toggles the full height, a drag up opens it fully, a drag down closes
  // (review design-2: a tap resizes on its click, which comes after the tap's own mouse events and focus, so the
  // field that slides under the finger never receives them; a drag resizes at its release, which makes no click.
  // The sheet also swallows a stray click and its focus for 400 ms after a resize.)
  function grabber(head) {
    let y0 = null, dy = 0, id = null, onGrab = false, tap = 0, tapT = 0;
    head.addEventListener('pointerdown', (e) => { if (e.target.closest('.ph-x, .ph-snap')) return; y0 = e.clientY; dy = 0; id = e.pointerId; onGrab = !!e.target.closest('.ph-grab'); try { head.setPointerCapture(id); } catch (er) { /* */ } });
    head.addEventListener('pointermove', (e) => { if (y0 == null || e.pointerId !== id) return; dy = e.clientY - y0; if (Math.abs(dy) > 4) els.sheet.style.transform = `translateY(${Math.max(full ? -0 : -40, dy)}px)`; });
    const end = (e) => {
      if (y0 == null || e.pointerId !== id) return;
      y0 = null; els.sheet.style.transform = '';
      if (dy > 64) { guard(); if (full) setFull(false); else close(); } else if (dy < -40) { guard(); setFull(true); }
      else if (Math.abs(dy) <= 4 && onGrab && e.type === 'pointerup') { tap = 1; clearTimeout(tapT); tapT = setTimeout(() => { if (tap) { tap = 0; guard(); setFull(!full); } }, 450); }
    };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
    head.addEventListener('click', (e) => { if (!tap || e.target.closest('.ph-x, .ph-snap')) return; tap = 0; clearTimeout(tapT); guard(); setFull(!full); try { els.grab.focus({ preventScroll: true }); } catch (er) { /* */ } });
    els.grab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFull(!full); } });
    let gT = 0;
    const guard = () => { clearTimeout(gT); els.sheet.dataset.guard = '1'; gT = setTimeout(() => { delete els.sheet.dataset.guard; }, 400); };
    for (const ev of ['mousedown', 'click']) els.sheet.addEventListener(ev, (e) => { if (els.sheet.dataset.guard && !e.target.closest('.ph-sh')) { e.preventDefault(); e.stopPropagation(); } }, true);
  }
  const TITLES = () => ({ edit: $t('Editor'), tools: $t('More tools'), display: $t('Display'), more: $t('More') });

  // Display: this view's options (the ones the plane's sliders button held), then the regions' display
  function fillDisplay(side) {
    const kids = A.footKids(side);
    els.viewOpts.replaceChildren(...kids);
    // in the deformation, its order and its loop (the transport row keeps play, the scrubber, the speed and Paths)
    if (A.morphOn()) {
      const dock = document.querySelector('.tdock:not([hidden])');
      if (dock) {
        els.morphKids = [];
        for (const el of dock.querySelectorAll(':scope > select, :scope > .check')) {
          const ph = document.createComment('phone'); el.parentNode.insertBefore(ph, el); els.morphKids.push([el, ph]); els.viewOpts.append(el);
        }
      }
    }
    els.viewOpts.previousElementSibling.hidden = !els.viewOpts.childElementCount;
  }

  // More (⋯): sound, theme, language; examples, export, LaTeX, search, the tour and the guide
  function fillMore() {
    const I = A.icons, b = els.body.more;
    const row = (icon, label, run, chev, extra) => h('button', { class: 'ph-row', type: 'button', onclick: run },
      h('span', { class: 'ph-ic', html: icon || '' }), h('span', { class: 'ph-rl' }, label), extra || null, chev ? h('span', { class: 'ph-chev', html: I.chevR }) : null);
    const seg = (label, opts, cur, pick, icon) => {
      const s = h('div', { class: 'ph-seg', role: 'radiogroup', 'aria-label': label });
      for (const [v, t, lang] of opts) s.append(h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === cur), class: v === cur ? 'on' : '', lang: lang || null, onclick: () => { for (const x of s.children) { const m = x === s.querySelector(`[data-v="${v}"]`); x.classList.toggle('on', m); x.setAttribute('aria-checked', String(m)); } pick(v); }, 'data-v': v }, t));
      return h('div', { class: 'ph-srow' }, h('span', { class: 'ph-ic', html: icon }), h('span', { class: 'ph-rl' }, label), s);
    };
    const snd = A.sound('state');
    const sw = h('button', { class: 'ph-switch', type: 'button', role: 'switch', 'aria-checked': String(!!snd.on), 'aria-label': $t('Sound'), onclick: () => { $('soundBtn').click(); sw.setAttribute('aria-checked', String(!!A.sound('state').on)); } });
    const sndSet = h('button', { class: 'ph-link', type: 'button', onclick: () => { close(true); $('soundMore').click(); } }, $t('Settings'));
    const kids = [];
    if (snd.has) kids.push(h('div', { class: 'ph-srow' }, h('span', { class: 'ph-ic', html: A.soundIcon() }), h('span', { class: 'ph-rl' }, $t('Sound')), sndSet, sw));
    kids.push(seg($t('Theme'), [['auto', $t('Auto')], ['light', $t('Light')], ['dark', $t('Dark')]], A.theme(), (v) => A.setTheme(v), I.theme));
    const lang = A.langPref();
    kids.push(seg($t('Language'), [['auto', $t('Auto')], ['en', 'English', 'en'], ['ru', 'Русский', 'ru']], lang, (v) => A.setLang(v), A.globeIcon));
    kids.push(h('div', { class: 'ph-sep' }));
    kids.push(row(GRID, $t('Examples'), () => { close(true); $('examplesBtn').click(); }, true));
    kids.push(row(I.download, $t('Export figure'), () => { close(true); A.exportFigure(); }, true));
    kids.push(row(I.copy, $t('Links, scenes and LaTeX'), () => { close(true); $('exportBtn').click(); }, true));
    kids.push(row(TEX, $t('Copy LaTeX with guarantees'), () => { close(true); A.copyLatex(); }));
    kids.push(row(I.search, $t('Search functions and commands'), () => { close(true); $('cmdBtn').click(); }));
    kids.push(row(TOUR, $t('Guided tour'), () => { close(true); $('helpBtn').click(); }, true));
    kids.push(row(I.help, $t('Reference guide'), () => { close(true); A.openGuide(); }));
    b.replaceChildren(...kids);
  }

  function init(api) {
    A = api;
    els.title || void 0;
    const mq = [matchMedia(MQP), matchMedia(MQL)];
    for (const m of mq) m.addEventListener('change', sync);
    window.addEventListener('resize', () => { if (on && kind) geometry(); });
    sync();
  }
  return {
    init, open, close, swap, isOn: () => on, sheet: () => kind, big: () => big, nums: () => nums,
    // TEMP-DEBUG-HOOK (removed before publishing)
    _state: () => ({ on, land, big, kind, full, split: rootEl.classList.contains('ph-split') }),
    // TEMP-DEBUG-HOOK
  };
})();
