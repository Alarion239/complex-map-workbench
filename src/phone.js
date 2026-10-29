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
  // "Both": X above Y, each its own half, instead of the large plane and the inset; remembered (D8)
  const BOTH_KEY = 'cmw-ph-both' + (new URLSearchParams(location.search).get('ns') || '');
  let both = (() => { try { return localStorage.getItem(BOTH_KEY) === '1'; } catch (e) { return false; } })();
  let kind = null, full = false;       // the open sheet and its height
  let nums = false;                    // the Editor opened by Numbers: Parameters only (review design-12)
  let anim = 0;                        // the sheet's opening or closing timer
  const homes = [];                    // [el, placeholder] of the moved elements
  const els = {};
  const SPLIT = new Set(['edit', 'tools', 'display']);   // the non-modal sheets: X | Y above them
  const MQP = '(max-width: 767px)';
  const MQL = '(orientation: landscape) and (max-height: 500px) and (max-width: 1023px) and (pointer: coarse)';
  const DUR = 220;
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
    // v16.5 UX24: Undo in every sheet's head, beside ×, where the sheet covers the tool row's Undo (its long press
    // offers Redo, as the tool row's does)
    els.sundo = h('button', { class: 'ph-hundo', type: 'button', 'aria-label': $t('Undo'), html: I.undo });
    undoKey(els.sundo);
    const head = h('div', { class: 'ph-sh' }, els.grab, els.mark, els.title, h('span', { class: 'grow' }), els.snap, els.sundo, els.close);
    els.body = {};
    for (const k of ['edit', 'tools', 'display', 'more']) els.body[k] = h('div', { class: 'ph-sb', 'data-k': k, hidden: true });
    els.sheet = h('div', { class: 'ph-sheet ph-only', role: 'dialog', 'aria-modal': 'false', hidden: true }, head, ...Object.values(els.body));
    document.body.append(els.scrim, els.sheet);
    grabber(head);
    // the Editor: the Inspector's host comes in when the phone layout starts
    // More tools: the tiles, then the region formula and the shapes (moved in)
    // (D6) three tabs: Draw, Construct, Shapes with its count; the sheet reopens on the last one
    els.tabs = h('div', { class: 'ph-tabs', role: 'tablist', 'aria-label': $t('More tools') }, ...TOOL_TABS.map((t) => h('button', { type: 'button', role: 'tab', 'data-tab': t, onclick: () => setTab(t) })));
    els.tiles = h('div', { class: 'ph-tiles', role: 'tabpanel', 'data-tab': 'draw', 'aria-label': $t('Drawing tools') });
    els.ctiles = h('div', { class: 'ph-tiles', role: 'tabpanel', 'data-tab': 'construct', 'aria-label': $t('Construct') });
    els.shapesPane = h('div', { class: 'ph-tabpane', role: 'tabpanel', 'data-tab': 'shapes', 'aria-label': $t('Shapes') });
    els.body.tools.append(els.tabs, els.tiles, els.ctiles, els.shapesPane);
    // Display: this view's options and the unit circle, then (in the X → Y view) the regions' display, lent from
    // page.html's #regionsHome ([v17 D5, #82]: no longer a section of the region tools)
    els.viewOpts = h('div', { class: 'ph-vopts' });
    els.regions = h('div', { class: 'ph-regions' });
    els.regionsH = h('h3', { class: 'ph-h' }, $t('Shapes'));
    // (issue #81) the Phase style, on the sheet's first row: its name shows as soon as the sheet opens, one tap opens its menu.
    // (#247: in the flat Phase view the styles' own row of glyphs comes first and is one tap, so this row shows only in the
    // Landscape, where it says where the styles live; the sheet has no "This view" title)
    els.style = h('button', { class: 'ph-style', type: 'button', hidden: true, 'aria-haspopup': 'menu', onclick: (e) => A.styleMenu(e.currentTarget, paintStyle) },
      h('span', { class: 'ph-ic', 'aria-hidden': 'true' }), h('span', { class: 'ph-rl' }), h('span', { class: 'ph-chev', 'aria-hidden': 'true', html: A.icons.chevR }));
    els.body.display.append(els.style, els.viewOpts, els.regionsH, els.regions);
    els.dispTip = tip(INFO, $t('Tip: Display changes the plane you opened it from; open it from the other plane for that plane\'s own options.'));
    els.editTip = tip(INFO, $t('Tip: Show alone pictures one step by itself in X and Y; a step\'s ⋯ menu has Replace with the inverse and Bypass this step.'));
    // the chain bar: Numbers first
    els.nums = h('button', { class: 'ph-nums ph-only', type: 'button', onclick: () => open('edit', { params: true }) });
    // the context bar: above the tool row, only while something is selected or under way (D3)
    els.ctx = h('div', { class: 'ph-ctx ph-only', role: 'region', 'aria-live': 'polite', hidden: true });
    document.body.append(els.ctx);
    // a message (a toast, with its Undo) takes that row for as long as it shows; the planes give it up when no finger is down
    const th = $('toastHost');
    if (th) new MutationObserver(() => barLayout()).observe(th, { childList: true });
    document.addEventListener('pointerdown', () => { fingers++; }, true);
    for (const evn of ['pointerup', 'pointercancel']) document.addEventListener(evn, () => { if (fingers > 0 && --fingers === 0) barLayout(); }, true);
    // the tool row: Undo first (its long-press offers Redo)
    els.undo = h('button', { class: 'ph-undo tool ph-only', type: 'button', 'aria-label': $t('Undo'), html: `${I.undo}<span>${$t('Undo')}</span>` });
    undoKey(els.undo);
    // each plane: Sphere and Display at the right; the inset's swap cover
    for (const side of ['L', 'R']) {
      const plot = $(side === 'L' ? 'plotL' : 'plotR'), pane = $(side === 'L' ? 'paneL' : 'paneR');
      const bt = h('button', { class: 'ph-key ph-both-key', type: 'button', 'aria-pressed': String(both), 'aria-label': $t('Both'), html: BOTH_ICON, onclick: () => toggleBoth() });
      const sph = h('button', { class: 'ph-key ph-sph', type: 'button', 'aria-pressed': 'false', 'aria-label': $t('Sphere'), html: A.modeIcons.sphere, onclick: () => toggleSphere(side) });
      const dsp = h('button', { class: 'ph-key ph-dsp', type: 'button', 'aria-label': $t('Display options'), html: I.sliders, onclick: () => open('display', { side }) });
      plot.append(h('div', { class: 'ph-col ph-only' }, bt, sph, dsp));
      els['sph' + side] = sph;
      els['both' + side] = bt;
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
    { const sum = document.querySelector('#toolMore > summary'), rc = $('railCount');
      if (sum) { els.badge = h('span', { class: 'ph-badge', 'aria-hidden': 'true', hidden: true }); sum.append(els.badge); }
      if (rc) new MutationObserver(() => { if (els.tabs) setTab(toolTab); syncBadge(); }).observe(rc, { childList: true, characterData: true, subtree: true });
      syncBadge(); }
    if ($('constructTools')) new MutationObserver(() => syncTools()).observe($('constructTools'), { subtree: true, attributes: true, attributeFilter: ['class'] });   // (v16 [C20])
    new MutationObserver(() => { els.undo.disabled = els.sundo.disabled = $('undoBtn').disabled; }).observe($('undoBtn'), { attributes: true, attributeFilter: ['disabled'] });
    els.undo.disabled = els.sundo.disabled = $('undoBtn').disabled;
    // the views: the inset only in X → Y; the plane chips and the Sphere keys follow
    const panes = $('panes');
    new MutationObserver(() => { if (on) syncPanes(); }).observe(panes, { attributes: true, attributeFilter: ['class'] });
    for (const id of ['leftTabs', 'rightTabs', 'viewSwitch']) new MutationObserver(() => { if (on) syncPanes(); }).observe($(id), { subtree: true, attributes: true, attributeFilter: ['class'] });
    if (typeof Params !== 'undefined' && Params.on) { Params.on('change', syncNums); Params.on('structure', syncNums); }
    window.addEventListener('keydown', (e) => { if (on && kind && e.key === 'Escape' && !document.querySelector('#popHost .pop, .modal-bg')) { close(); } });
    kbInit();
    // v16.5 UX62: the transport shows the chosen speed only; a tap on it moves on, 1× → 2× → ½× → 1× (it ignored taps)
    document.addEventListener('click', (e) => {
      if (!on) return;
      const b = e.target.closest && e.target.closest('.tdock #speedSeg > button.on');
      if (!b) return;
      const ORDER = ['1.6', '0.8', '3.2'];
      const nx = ORDER[(ORDER.indexOf(b.dataset.v) + 1) % ORDER.length];
      const t = b.parentNode.querySelector(`button[data-v="${nx}"]`);
      if (!t) return;
      e.preventDefault(); e.stopPropagation();
      t.click();
    }, true);
  }
  const BOTH_ICON = '<svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="2.5" width="12" height="5.5" rx="1"/><rect x="3" y="10" width="12" height="5.5" rx="1"/></svg>';
  const GRID = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>';
  const TEX = '<svg viewBox="0 0 20 16" width="18" height="16" aria-hidden="true" fill="currentColor"><text x="0" y="11" font-family="STIX Two Text, Times New Roman, serif" font-size="10">T</text><text x="5.6" y="14" font-family="STIX Two Text, Times New Roman, serif" font-size="10">E</text><text x="11.4" y="11" font-family="STIX Two Text, Times New Roman, serif" font-size="10">X</text></svg>';
  const TOUR = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><path d="M6.6 5.4v5.2L10.6 8z" fill="currentColor"/></svg>';
  const OPEN = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M2.5 4.5v8h11v-6H8L6.5 4.5z"/></svg>';
  const HOLD = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/><path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5" /></svg>';
  const INFO = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.2"/><path d="M8 7.3v3.7"/><circle cx="8" cy="5" r=".5" fill="currentColor"/></svg>';
  // a tip taught where people look: a line with its small icon, at the end of a sheet's content (never on the plane)
  const tip = (icon, text) => h('p', { class: 'ph-tip' }, h('span', { class: 'ph-tip-ic', 'aria-hidden': 'true', html: icon }), h('span', null, text));
  const SWAP = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13"/></svg>';

  // ---------------- mode ----------------
  function sync() {
    const p = matchMedia(MQP).matches, l = !p && matchMedia(MQL).matches;
    const want = p || l;
    if (want === on && l === land) return;
    // (a rotation: the panes are synced first, so a landscape layout's side-by-side panes get their inset back in
    // portrait; review-phone-swap-verify verify-1)
    if (want && !on) enter(l); else if (!want && on) leave(); else { const keepIt = keepSheet(); land = l; rootEl.classList.toggle('ph-land', l); close(true); syncPanes(); A.resize(); reconcile(); keepIt(); }
  }
  // v16.5 UX68: a rotation (portrait <-> landscape) relays the sheet out: the same sheet opens again in the new layout,
  // at the same scroll, and the field that had the focus gets it back with its caret (the Editor's fields are rebuilt
  // by the reopening: the field in the same place among the sheet's fields)
  function keepSheet() {
    const k = kind;
    if (!k) return () => {};
    const o = k === 'edit' && nums ? { params: true } : k === 'display' ? { side: els.dispSide || big } : {};
    const body = els.body[k], top = body ? body.scrollTop : 0;
    const FIELDS = 'input:not([type="hidden"]), textarea, select';
    const fe = document.activeElement;
    const fIn = fe && fe !== document.body && els.sheet.contains(fe) && fe.matches(FIELDS) ? fe : null;
    const at = fIn ? [...els.sheet.querySelectorAll(FIELDS)].indexOf(fIn) : -1;
    let caret = null;
    try { caret = fIn && fIn.selectionStart != null ? [fIn.selectionStart, fIn.selectionEnd] : null; } catch (e) { caret = null; }
    return () => {
      open(k, o);
      const back = () => {
        if (kind !== k) return;
        const b = els.body[k];
        if (b) b.scrollTop = top;
        if (!fIn) return;
        const f = fIn.isConnected && els.sheet.contains(fIn) ? fIn : at >= 0 ? els.sheet.querySelectorAll(FIELDS)[at] : null;
        if (!f) return;
        try { f.focus({ preventScroll: true }); if (caret && f.setSelectionRange) f.setSelectionRange(caret[0], caret[1]); } catch (e) { /* */ }
        try { f.scrollIntoView({ block: 'nearest' }); } catch (e) { /* */ }
      };
      if (reduced()) back(); else setTimeout(back, DUR + 40);
    };
  }
  function enter(l) {
    on = true; land = l;
    build();
    rootEl.classList.add('ph');
    rootEl.classList.toggle('ph-land', l);
    // the Inspector's host goes into the Editor, the region sections into More tools and Display; the Deformation
    // toggle closes the chain bar; Numbers opens it
    park($('propsPanel'), els.body.edit);
    els.body.edit.append(els.editTip);
    park($('secShapes'), els.shapesPane);
    park($('secFormula'), els.shapesPane);
    const wrap = document.querySelector('.pipe-wrap');
    park(els.nums, wrap, $('pipeline'));
    park($('morphBtn'), wrap);
    park(els.undo, $('secDraw'), $('secDraw').firstChild);
    for (const id of ['secFormula', 'secShapes']) { const d = $(id); if (d) d.open = true; }
    A.showPanels(true);
    syncPanes(); syncTools(); syncNums(); syncSnap();
    A.resize();
    reconcile();   // (v15.1: the inset shows its plane's own view, the desktop's or the saved one, at its size)
  }
  function leave() {
    close(true);
    // (v15.1: the desktop gets each plane's large view back; no view is drawn small while merged or held)
    for (const side of ['L', 'R']) if (keep[side]) grow(side);
    on = false;
    rootEl.classList.remove('ph', 'ph-land', 'ph-split', 'ph-full', 'ph-morph', 'ph-toast-on', 'ph-ctx-on', 'ph-ctx-tall');
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
    const split = twoUp();
    p.classList.toggle('ph-both', both && !land && !mg);
    for (const side of ['L', 'R']) { const bb = els['both' + side]; bb.hidden = land || !!mg; bb.setAttribute('aria-pressed', String(both)); }
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
  // The inset swaps with the large plane, and each plane keeps its own view (v15.1, build/phone-swap.md). A plane's
  // own view is its large view: the saved state and the desktop get that one (largeView). The inset draws it smaller,
  // the same region (its centre and its units per pane width) at the inset's size; the plane that comes back large
  // shows exactly what it showed before. Nothing is fitted (v15 fitted the new inset: for an unbounded region the fit
  // framed the part in its own window plus a margin, so every round trip multiplied the scale). A plane the app fits
  // itself (Y's auto fit, X's at a focused step) is fitted by the resize as before.
  // keep[side], while side is drawn as the inset: {v: its large view, set: the view the inset was given, r: v.s / set.s}.
  // Only the inset's view is ever small: while a merged view (Phase, Landscape, the Deformation) shows, or while the app
  // parks, replaces or saves the views (hold), every plane holds its large view (review-phone-swap swap-1 to swap-6).
  const keep = { L: null, R: null };
  let held = false;
  const sameView = (a, b) => !!a && !!b && a.cx === b.cx && a.cy === b.cy && a.s === b.s;
  // the plane that goes small: the same region at the inset's size (a: its large view, with the large pane's width)
  function shrink(side, a) {
    keep[side] = null;
    if (a.auto) return;
    const w = A.getView(side).w;
    if (!(w > 0 && a.w > 0)) return;
    const v = { cx: a.cx, cy: a.cy, s: a.s * w / a.w };
    A.setView(side, v);
    keep[side] = { v: { cx: a.cx, cy: a.cy, s: a.s }, set: v, r: a.w / w };
  }
  // the plane that comes back large: what it showed large (or, when its view changed while it was small, that view
  // at the large size)
  function grow(side) {
    const k = keep[side]; keep[side] = null;
    const c = A.getView(side, true);   // (a running Fit lands first: swap-8)
    if (!k || c.auto) return;
    A.setView(side, sameView(c, k.set) ? k.v : { cx: c.cx, cy: c.cy, s: c.s * k.r });
  }
  // a plane's large view (writeState saves it; null: the view the app holds is that one)
  function largeView(side) {
    const k = keep[side];
    if (!on || side === big || !k || merged()) return null;
    const c = A.getView(side);
    if (c.auto) return null;
    return sameView(c, k.set) ? Object.assign({}, k.v) : { cx: c.cx, cy: c.cy, s: c.s * k.r };
  }
  // the plane that is not the large one is drawn small only as the inset (X -> Y, no sheet, portrait); side by side
  // (an open sheet, a landscape phone) it shows its large view, like the large plane. A merged view (Phase,
  // Landscape, the Deformation) holds other views: nothing changes until it ends.
  function reconcile() {
    if (!on || held || merged()) return;
    const ins = big === 'L' ? 'R' : 'L';
    const small = !twoUp();
    if (small && !keep[ins]) shrink(ins, Object.assign(A.getView(ins, true), { w: A.getView(big).w }));
    else if (!small && keep[ins]) grow(ins);
  }
  // the app is about to park, replace or save the views (a view switch, the Deformation, a focus, an example, the
  // tour): the inset gets its large view back now, and is drawn small again once the current task ends
  function hold() {
    if (!on || held) return;
    held = true;
    for (const side of ['L', 'R']) if (keep[side]) grow(side);
    // (the layout first: the panes' classes and sizes may still be those of a merged view)
    queueMicrotask(() => { held = false; if (!on) return; syncPanes(); A.resize(); reconcile(); });
  }
  // X's window at its large size while X is the inset: the app's meshing window, so a swap does not move it and Y's
  // auto fit frames the same region in the inset and large (swap-7); null: X's pane box is that window
  function largeBox() {
    const v = largeView('L');
    if (!v) return null;
    const p = A.getView(big), hw = p.w / 2 / v.s, hh = p.h / 2 / v.s;
    return hw > 0 && hh > 0 ? { x0: v.cx - hw, x1: v.cx + hw, y0: v.cy - hh, y1: v.cy + hh } : null;
  }
  // two planes in sight: a landscape phone, an open sheet, or Both
  const twoUp = () => land || rootEl.classList.contains('ph-split') || (both && !merged());
  function toggleBoth() {
    both = !both;
    try { localStorage.setItem(BOTH_KEY, both ? '1' : '0'); } catch (e) { /* */ }
    syncPanes();
    A.resize();
    reconcile();
    A.sound('swap');
  }
  function swap(quiet) {
    if (merged() || both || rootEl.classList.contains('ph-split')) return;
    const now = big === 'L' ? 'R' : 'L';
    big = now;
    syncPanes();
    A.resize();
    grow(now);
    reconcile();
    if (quiet !== true) A.sound('swap');
  }
  // the large plane after a reload (the language switch) or a tour: a swap without its sound; while merged or held
  // no plane is drawn small, so only the layout changes (swap-6)
  function setBig(side) {
    if (!on || (side !== 'L' && side !== 'R') || side === big) return;
    if (merged() || held) { big = side; syncPanes(); A.resize(); return; }
    swap(true);
  }

  // ---------------- the context bar (D3) ----------------
  // One 56 px bar above the tool row for what is selected or under way: the selected shape (name, definition, Edit,
  // Delete, ⋯), the polygon being drawn (Last, Done, Cancel), a curve being listened along (Stop). The planes give up the
  // room from the bottom (--ph-ctx), so the drawing does not move. The app calls Phone.ctx from its overlay renders and
  // its selection changes; the bar is rebuilt only when what it shows changes.
  let ctxKey = '';
  function ctxSync() { ctx(true); }
  // The planes give the bar its room (and a message its row) only while no finger is down: a plane that shrinks under a
  // press moves the drawing the finger is on. The change waits for the lift (or 1.5 s, should a lift never come).
  let fingers = 0, layoutT = 0;
  function barLayout() {
    if (fingers > 0) { clearTimeout(layoutT); layoutT = setTimeout(() => { fingers = 0; barLayout(); }, 1500); return; }
    clearTimeout(layoutT);
    const th = $('toastHost'), c = rootEl.classList;
    const wantOn = on && !!els.ctx && !els.ctx.hidden, wantTall = wantOn && els.ctx.classList.contains('tall'), wantToast = on && !!th && !!th.firstElementChild;
    if (c.contains('ph-ctx-on') === wantOn && c.contains('ph-ctx-tall') === wantTall && c.contains('ph-toast-on') === wantToast) return;
    c.toggle('ph-ctx-on', wantOn); c.toggle('ph-ctx-tall', wantTall); c.toggle('ph-toast-on', wantToast);
    syncPanes(); A.resize();
  }
  function ctx(force) {
    if (!on || !els.ctx) return;
    let st = null;
    try { st = A.ctxState(); } catch (e) { st = null; }
    // (the deformation's transport has the bottom; a sheet covers the bar but leaves its room, so that opening and closing
    // one is no second layout change for the planes)
    if (A.morphOn()) st = null;
    els.ctx.classList.toggle('under', !!kind);
    const key = st ? JSON.stringify(st) : '';
    if (key === ctxKey && !force) return;
    if (key === ctxKey && force && !!st === !els.ctx.hidden) return;
    ctxKey = key;
    const btn = (cls, label, run, extra) => h('button', Object.assign({ class: 'ph-cb ' + cls, type: 'button', onclick: (e) => run(e.currentTarget) }, extra || {}), label);
    const text = (title, sub) => h('div', { class: 'ph-ct' }, h('span', { class: 'ph-ctn' }, title), sub ? h('span', { class: 'ph-cts' }, sub) : null);
    let kids = [];
    if (st && st.kind === 'shape') {
      kids = [text(st.name, st.used ? st.def + ' · ' + $t('Used by {n}', { n: st.used }) : st.def),
        btn('prim', $t('Edit'), () => open('tools', { tab: 'shapes', edit: st.id })),
        btn('', $t('Delete'), () => A.ctxAct('delete', st.id), st.used ? { 'aria-label': $t('Delete {label} and the {n} that use it', { label: st.name, n: st.used }) } : {}),
        btn('ico', h('span', { 'aria-hidden': 'true', html: A.icons.more }), (a) => A.ctxAct('more', st.id, a), { 'aria-label': $t('More actions for {label}', { label: st.name }), 'aria-haspopup': 'menu' })];
    } else if (st && st.kind === 'polygon') {
      kids = [text($t('Polygon'), String(st.n)),
        btn('', '⌫ ' + $t('Last'), () => A.ctxAct('last')),
        btn('prim', $t('Done'), () => A.ctxAct('done'), st.n < 3 ? { disabled: true } : {}),
        btn('', $t('Cancel'), () => A.ctxAct('cancel'))];
    } else if (st && st.kind === 'construct') {
      // (with the second row the key is just the symbol, its words in the label)
      const undo = st.seg ? btn('ico', '⌫', () => A.ctxAct('undopick'), Object.assign({ 'aria-label': $t('Undo pick') }, st.undo ? {} : { disabled: true }))
        : btn('', '⌫ ' + $t('Undo pick'), () => A.ctxAct('undopick'), st.undo ? {} : { disabled: true });
      const x = btn('ico', '×', () => A.ctxAct('xcancel'), { 'aria-label': $t('Cancel') });
      if (st.seg) {
        // (the orthogonal circle: Whole, Inside, Outside or Between, in words, on a second row)
        const sg = h('div', { class: 'ph-ctseg', role: 'radiogroup', 'aria-label': $t('Whole or inside') });
        for (const [v, lab] of [['whole', $tx('side', 'Whole')], ['in', $tx('side', 'Inside')], ['out', $tx('side', 'Outside')], ['between', $tx('side', 'Between')]].filter(([v]) => !st.segs || st.segs.includes(v))) sg.append(h('button', { type: 'button', role: 'radio', class: 'ph-cb' + (st.seg === v ? ' prim' : ''), 'aria-checked': String(st.seg === v), onclick: () => A.ctxAct('seg', v) }, lab));
        kids = [text(st.text), undo, x, sg];
      } else kids = [text(st.text), undo, x];
    } else if (st && st.kind === 'listen') {
      kids = [text($t('Listening along the curve')), btn('prim', $t('Stop'), () => A.ctxAct('stop'))];
    }
    els.ctx.replaceChildren(...kids);
    const tall = !!(st && st.kind === 'construct' && st.seg);
    els.ctx.hidden = !kids.length;
    els.ctx.classList.toggle('tall', tall);
    if (kids.length) { els.ctx.dataset.k = st.kind; }
    barLayout();
  }

  // ---------------- the tool row ----------------
  const ROW = ['select', 'point', 'disc', 'polygon'];
  function syncTools() {
    if (!els.undo) return;
    const onB = document.querySelector('#tools .tool.on, #constructTools .tool.on');
    const id = onB ? onB.dataset.tool : 'select';
    const sum = document.querySelector('#toolMore > summary');
    if (!sum) return;
    const lab = sum.querySelector('.tm-open'), ic = sum.querySelector(':scope > .ic-slot');
    if (!els.moreIc) { els.moreIc = ic.innerHTML; els.moreLab = lab.textContent; }
    const extra = onB && !ROW.includes(id);
    sum.classList.toggle('ph-lit', !!extra);
    if (extra) { ic.innerHTML = onB.querySelector('svg').outerHTML; lab.textContent = onB.dataset.phl || (onB.querySelector('span') || {}).textContent || onB.getAttribute('aria-label'); }   // (v16: the tile's short label, '3-pt circle')
    else if (ic.dataset.ph !== 'more') { ic.innerHTML = els.moreIc; lab.textContent = els.moreLab; }
    ic.dataset.ph = extra ? id : 'more';
    if (kind === 'tools') fillTiles();
  }
  function fillTiles() {
    const tile = (b) => {
      const t = h('button', { class: 'ph-tile' + (b.classList.contains('on') ? ' on' : ''), type: 'button', 'aria-pressed': String(b.classList.contains('on')), 'data-tool': b.dataset.tool, 'aria-label': b.getAttribute('aria-label') },
        h('span', { class: 'ph-ic', html: b.querySelector('svg').outerHTML }), h('span', { class: 'ph-tl' }, b.dataset.phl || b.querySelector('span').textContent));   // (v16.5 UX93: a short form, app.js)
      t.addEventListener('click', () => {
        const id = b.dataset.tool;
        b.click();
        // (the formula field is on the Shapes tab)
        if (id === 'formula') { setTab('shapes'); const f = $('formulaInput'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); } return; }
        close();
      });
      return t;
    };
    const tiles = [...document.querySelectorAll('#tools .tool[data-tool]')].map(tile);
    // (the Construct tiles on their own tab; a tile closes the sheet as the others do)
    const ct = [...document.querySelectorAll('#constructTools .tool[data-tool]')].map(tile);
    // v16.5 UX40: the long press, taught where people look (never on the plane)
    ct.push(tip(HOLD, $t('Tip: hold a finger on a shape until the ring fills: its menu hides or deletes it and gives its line integral.')));
    els.tiles.replaceChildren(...tiles);
    els.ctiles.replaceChildren(...ct);
    setTab(toolTab);
  }
  // the Tools sheet's tabs (D6)
  const TOOL_TABS = ['draw', 'construct', 'shapes'];
  let toolTab = 'draw';
  const shapeCount = () => parseInt((($('railCount') || {}).textContent || '0'), 10) || 0;
  function setTab(t) {
    if (!TOOL_TABS.includes(t)) t = 'draw';
    const moved = t !== toolTab;
    toolTab = t;
    const names = { draw: $t('Draw'), construct: $t('Construct'), shapes: $t('Shapes') + ' ' + shapeCount() };
    for (const b of els.tabs.children) { const on = b.dataset.tab === t; b.textContent = names[b.dataset.tab]; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; b.classList.toggle('on', on); }
    els.tiles.hidden = t !== 'draw'; els.ctiles.hidden = t !== 'construct'; els.shapesPane.hidden = t !== 'shapes';
    if (moved) els.body.tools.scrollTop = 0;
    syncBadge();
  }
  // the More key shows how many shapes there are
  function syncBadge() {
    if (!els.badge) return;
    const n = shapeCount();
    els.badge.textContent = n ? String(n) : '';
    els.badge.hidden = !n;
  }
  // the tab a tool's tile is on (the tour opens it first)
  const tabOf = (tool) => (els.ctiles.querySelector(`[data-tool="${tool}"]`) ? 'construct' : 'draw');
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
    // (v16.4: less the guided tour's strip under the header, --ph-tour, while it shows)
    const H = window.innerHeight - (parseFloat(getComputedStyle(rootEl).getPropertyValue('--ph-tour')) || 0);
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
    if (kind === k && k === 'tools' && opt.tab) { setTab(opt.tab); return; }
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
    if (k === 'tools') { if (opt.tab) toolTab = opt.tab; fillTiles(); syncSnap(); }
    if (k === 'display') fillDisplay(opt.side || big);
    // (Edit in the context bar: the selected shape's row, with its editor, comes into view)
    if (k === 'tools' && opt.edit) setTimeout(() => { const r = document.querySelector(`#shapeList .shape[data-id="${opt.edit}"]`); if (r) r.scrollIntoView({ block: 'nearest' }); }, 0);
    if (k === 'edit') A.renderInspector();
    els.sheet.hidden = false;
    els.scrim.hidden = SPLIT.has(k) || land;
    ctxSync();
    backLater();
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
        syncPanes(); A.resize(); reconcile();
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
    // a formula step built from catalog steps: its offer's summary is brought into view (it sat below the fold, review
    // steps-12); the sheet scrolls only as far as that needs
    else if (k === 'edit') { const sm = els.body.edit.querySelector('.split-offer:not([hidden]) > summary'); if (sm) sm.scrollIntoView({ block: 'nearest', behavior: 'auto' }); }
    const f = els.sheet.querySelector('.ph-sh .ph-x');
    if (!SPLIT.has(k) && f) f.focus({ preventScroll: true });
  }
  function close(now) {
    if (!kind) return;
    clearTimeout(anim);
    const k = kind;
    kind = null; full = false; nums = false; els.sheet.classList.remove('nums'); kb.grew = false;
    queueMicrotask(ctxSync);
    rootEl.classList.remove('ph-full');
    const split = rootEl.classList.contains('ph-split');
    rootEl.classList.remove('ph-split');
    if (split) {
      // the chain bar rides down with the sheet: it starts where it stood above the sheet
      if (!land && !now) { rootEl.classList.add('ph-notrans', 'ph-ride'); void els.sheet.offsetHeight; rootEl.classList.remove('ph-notrans'); }
      syncPanes(); A.resize(); reconcile();
      if (!land && !now) requestAnimationFrame(() => rootEl.classList.remove('ph-ride'));
    }
    rootEl.classList.remove('ph-ride');
    // this view's options go back to the app (it keeps them for its own popover), the unit circle and the regions'
    // display to their home
    homeDisplay();
    els.viewOpts.replaceChildren();
    els.sheet.classList.remove('open');
    els.scrim.hidden = true;
    rootEl.classList.remove('ph-sheet-on');
    backLater();
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
    head.addEventListener('pointerdown', (e) => { if (e.target.closest('.ph-x, .ph-snap, .ph-hundo')) return; y0 = e.clientY; dy = 0; id = e.pointerId; onGrab = !!e.target.closest('.ph-grab'); try { head.setPointerCapture(id); } catch (er) { /* */ } });
    head.addEventListener('pointermove', (e) => { if (y0 == null || e.pointerId !== id) return; dy = e.clientY - y0; if (Math.abs(dy) > 4) els.sheet.style.transform = `translateY(${Math.max(full ? -0 : -40, dy)}px)`; });
    const end = (e) => {
      if (y0 == null || e.pointerId !== id) return;
      y0 = null; els.sheet.style.transform = '';
      if (dy > 64) { guard(); if (full) setFull(false); else close(); } else if (dy < -40) { guard(); setFull(true); }
      else if (Math.abs(dy) <= 4 && onGrab && e.type === 'pointerup') { tap = 1; clearTimeout(tapT); tapT = setTimeout(() => { if (tap) { tap = 0; guard(); setFull(!full); } }, 450); }
    };
    head.addEventListener('pointerup', end); head.addEventListener('pointercancel', end);
    head.addEventListener('click', (e) => { if (!tap || e.target.closest('.ph-x, .ph-snap, .ph-hundo')) return; tap = 0; clearTimeout(tapT); guard(); setFull(!full); try { els.grab.focus({ preventScroll: true }); } catch (er) { /* */ } });
    els.grab.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFull(!full); } });
    let gT = 0;
    const guard = () => { clearTimeout(gT); els.sheet.dataset.guard = '1'; gT = setTimeout(() => { delete els.sheet.dataset.guard; }, 400); };
    for (const ev of ['mousedown', 'click']) els.sheet.addEventListener(ev, (e) => { if (els.sheet.dataset.guard && !e.target.closest('.ph-sh')) { e.preventDefault(); e.stopPropagation(); } }, true);
  }
  const TITLES = () => ({ edit: $t('Editor'), tools: $t('More tools'), display: $t('Display'), more: $t('Menu') });

  // Display: this view's options (the ones the plane's sliders button held), then the regions' display
  function paintStyle() {
    const st = A.styleState();
    els.style.hidden = !st.show || !st.land;
    if (els.style.hidden) return;
    els.style.querySelector('.ph-ic').innerHTML = st.svg;
    els.style.querySelector('.ph-rl').textContent = $t('Style: {name}', { name: st.name });
    els.style.setAttribute('aria-disabled', String(st.land));
  }
  function fillDisplay(side) {
    els.dispSide = side;
    paintStyle();
    const kids = A.footKids(side), unit = $('unitBox'), reg = A.xyView() ? $('regionsBox') : null;
    homeDisplay();
    els.viewOpts.replaceChildren(...kids, ...(unit ? [unit] : []));
    if (reg) els.regions.append(reg);
    els.regionsH.hidden = !reg;
    // ([v17 D5, #82] mesh quality, the laptop's Settings', stays at the end of this sheet on a phone, where it was: the
    // More sheet has no room left for it at 360 px; page.html's #meshGroup)
    const mesh = $('meshGroup');
    if (mesh) els.body.display.append(mesh);
    els.body.display.append(els.dispTip);
  }
  function homeDisplay() {
    const home = $('regionsHome');
    if (!home) return;
    for (const id of ['unitBox', 'regionsBox']) { const b = $(id); if (b && b.parentNode !== home && els.body.display.contains(b)) home.append(b); }
  }

  // More (⋯): sound, theme, phase colours, language; examples, export, LaTeX, search, the tour and the guide
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
    // (D6) grouped by task, with a search field on top: Scene, Figure, Sound, Help, Look
    const groups = [];
    const group = (title, ...rows) => groups.push({ title, rows: rows.filter(Boolean) });
    const sndRow = snd.has ? h('div', { class: 'ph-srow' }, h('span', { class: 'ph-ic', html: A.soundIcon() }), h('span', { class: 'ph-rl' }, $t('Sound')), sndSet, sw) : null;
    const hearSw = snd.has ? h('button', { class: 'ph-switch', type: 'button', role: 'switch', 'aria-checked': String(!!snd.sonify), 'aria-label': $t('Hear the function'), onclick: () => { A.sound('sonify', hearSw.getAttribute('aria-checked') !== 'true'); hearSw.setAttribute('aria-checked', String(!!A.sound('state').sonify)); } }) : null;
    const hearRow = hearSw ? h('div', { class: 'ph-srow' }, h('span', { class: 'ph-ic', html: A.soundIcon() }), h('span', { class: 'ph-rl' }, $t('Hear the function')), hearSw) : null;
    // Phase colours (issue 8): the palette's menu, with a preview of each, over the sheet
    const pc = row(A.palIcon(), $t('Phase colours'), (e) => A.palMenu(e.currentTarget, () => { pcName.textContent = A.palName(); pc.querySelector('.ph-ic').innerHTML = A.palIcon(); }), true);
    const pcName = h('span', { class: 'ph-pv' }, A.palName());
    pc.insertBefore(pcName, pc.querySelector('.ph-chev'));
    pc.setAttribute('aria-haspopup', 'menu');
    const lang = A.langPref();
    // v16.5 V02: the links, the scene files and the LaTeX are rows of this sheet (it opened a desktop menu over the
    // plane, with a key a phone has not got); "… again" only once a figure was made
    const sceneRows = [], figRows = [];
    const xs = typeof A.exportItems === 'function' ? A.exportItems() : [];
    if (xs.length) {
      for (const it of xs) {
        if (it === 'sep' || it.fig || (it.again && it.disabled)) continue;
        const isTex = /LaTeX/.test(it.label);
        const ic = isTex ? TEX : it.save ? I.download : it.icon && I[it.icon] ? I[it.icon] : OPEN;
        const r = row(ic, it.label, () => { close(true); it.run(); });
        if (it.disabled) r.disabled = true;
        (isTex ? figRows : sceneRows).push(r);
      }
    } else {
      sceneRows.push(row(I.copy, $t('Links, scenes and LaTeX'), () => { close(true); $('exportBtn').click(); }, true));
      figRows.push(row(TEX, $t('Copy LaTeX with guarantees'), () => { close(true); A.copyLatex(); }));
    }
    const searchRow = row(I.search, $t('Search'), () => { close(true); $('cmdBtn').click(); });
    group($t('Scene'), row(I.add || OPEN, $t('New scene'), () => { close(true); A.newScene(); }), row(GRID, $t('Examples'), () => { close(true); $('examplesBtn').click(); }, true), ...sceneRows);
    group($t('Figure'), row(I.download, $t('Export figure'), () => { close(true); A.exportFigure(); }, true), ...figRows);
    group($t('Sound'), sndRow, hearRow);
    group($t('Help'), searchRow, row(TOUR, $t('Guided tour'), () => { close(true); $('helpBtn').click(); }, true), row(I.help, $t('Guide'), () => { close(true); A.openGuide(); }));
    group($tx('menu group', 'Look'), seg($t('Theme'), [['auto', $t('Auto')], ['light', $t('Light')], ['dark', $t('Dark')]], A.theme(), (v) => A.setTheme(v), I.theme), pc,
      seg($t('Language'), [['auto', $t('Auto')], ['en', 'English', 'en'], ['ru', 'Русский', 'ru'], ['it', 'Italiano', 'it']], lang, (v) => A.setLang(v), A.globeIcon));
    const field = h('input', { class: 'ph-search', type: 'search', enterkeyhint: 'search', autocomplete: 'off', spellcheck: 'false', placeholder: $t('Search tools, functions, help…'), 'aria-label': $t('Search tools, functions, help…') });
    const blocks = groups.filter((g) => g.rows.length).map((g) => ({ g, head: h('h3', { class: 'ph-h' }, g.title) }));
    const filter = () => {
      const q = field.value.trim().toLowerCase();
      for (const { g, head } of blocks) {
        let any = false;
        // (the row that opens the command palette stays while there is a query: what the menu lacks, the palette may have)
        for (const r of g.rows) { const hit = !q || r === searchRow || r.textContent.toLowerCase().includes(q) || g.title.toLowerCase().includes(q); r.hidden = !hit; if (hit) any = true; }
        head.hidden = !any;
      }
    };
    field.addEventListener('input', filter);
    b.replaceChildren(field, ...blocks.flatMap(({ g, head }) => [head, ...g.rows]));
    filter();
  }

  // ---------------- the on-screen keyboard (v16.5 UX69) ----------------
  // Android Chrome lays the page out as before when its keyboard opens (only the visual viewport shrinks), so a field
  // low in a sheet went under the keyboard and Chrome panned the whole screen to show it. While the keyboard is up (the
  // visual viewport shorter than the window), the sheet's body gets that much room at its end (--ph-kb), and the field
  // with the focus is brought above the keyboard: by scrolling the body first (the planes stay in view, so the image
  // still changes as you type), and only when that cannot do it, by opening the sheet to its full height with the field
  // near the top of its body. The sheet goes back to its height when the keyboard goes or the focus leaves its fields.
  const TEXTY = 'input:not([type="checkbox"], [type="radio"], [type="range"], [type="button"], [type="color"], [type="file"]), textarea, [contenteditable="true"]';
  const kb = { grew: false, t: 0, h: 0, v: 0 };
  // a row of symbols above the keyboard while a formula field has the focus (UX46): symbols only, never templates;
  // a press keeps the focus in the field and puts the symbol at the caret
  const KEYS_H = 44, KEYS = ['z', '|', '<', '>', '≤', 'π', 'i', 'Re', 'Im', 'arg', '(', ')'];
  const keys = { el: null };
  function kbHeight(h) {
    let v = 0;
    if (h != null) v = h;
    else { const vv = window.visualViewport; if (vv) v = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)); }
    v = v > 80 ? v : 0;   // (a small difference is the browser's own bar, not a keyboard)
    if (v === kb.h) return;
    kb.h = v;
    kbApply();
  }
  // the room the keyboard takes: its height, and the symbol strip's above it while a formula field has the focus
  function kbApply() {
    const strip = !!kb.h && !!document.activeElement && document.activeElement.matches('.math-src');
    const v = kb.h ? kb.h + (strip ? KEYS_H : 0) : 0;
    keys.el.hidden = !strip;
    if (strip) rootEl.style.setProperty('--ph-kbraw', kb.h + 'px');
    if (v) rootEl.style.setProperty('--ph-kb', v + 'px'); else rootEl.style.removeProperty('--ph-kb');
    rootEl.classList.toggle('ph-kb', !!v);
    if (v === kb.v) return;
    kb.v = v;
    const f = document.activeElement;
    if (v && kind && f && els.sheet.contains(f)) setTimeout(() => kbFit(f), 0);
    if (!v && kb.grew && kind && full) { kb.grew = false; setFull(false); }   // (the keyboard went, the field may keep the focus)
  }
  function kbFit(f, grown) {
    if (!on || !kind || !f || document.activeElement !== f) return;
    const body = els.body[kind];
    if (!body || !body.contains(f)) return;
    const vis = window.innerHeight - kb.v - 8;   // the lowest y the user sees
    const fb = f.getBoundingClientRect(), bb = body.getBoundingClientRect();
    if (grown) { body.scrollTop = Math.max(0, body.scrollTop + (fb.top - bb.top) - 48); return; }
    if (!kb.v) { if (fb.bottom > bb.bottom || fb.top < bb.top) try { f.scrollIntoView({ block: 'nearest' }); } catch (e) { /* */ } return; }
    if (fb.bottom <= vis && fb.top >= bb.top) return;
    // scroll: the field's bottom just above the keyboard, its top never above the body's top
    // (rounded up and compared with 1 px to spare: scrollTop lands on whole pixels, a field's edges need not)
    body.scrollTop = Math.max(0, body.scrollTop + Math.ceil(Math.min(fb.bottom - vis, fb.top - bb.top - 8)));
    if (f.getBoundingClientRect().bottom <= vis + 1 || full || kind === 'more') return;
    kb.grew = true; setFull(true);
    setTimeout(() => kbFit(f, true), reduced() ? 0 : DUR + 20);
  }
  function kbInit() {
    keys.el = h('div', { class: 'ph-keys ph-only', role: 'toolbar', 'aria-label': $t('Symbols'), hidden: true },
      ...KEYS.map((k) => h('button', { type: 'button', tabindex: '-1', 'aria-label': k, onpointerdown: (e) => e.preventDefault(), onclick: () => {
        const f = /** @type {HTMLInputElement | null} */ (document.activeElement);
        if (!f || !f.matches('.math-src')) return;
        f.setRangeText(k, f.selectionStart, f.selectionEnd, 'end');
        f.dispatchEvent(new Event('input', { bubbles: true }));
      } }, k)));
    rootEl.append(keys.el);
    document.addEventListener('focusin', () => kbApply());
    document.addEventListener('focusout', () => setTimeout(kbApply, 0));
    els.sheet.addEventListener('focusin', (e) => {
      const f = e.target;
      if (!on || !kind || !(f instanceof Element) || !f.matches(TEXTY)) return;
      clearTimeout(kb.t);
      // (after the tap that focused it has made its click: the sheet must not move under the finger first)
      setTimeout(() => kbFit(f), 60);
    });
    els.sheet.addEventListener('focusout', () => {
      clearTimeout(kb.t);
      kb.t = setTimeout(() => {
        const a = document.activeElement;
        if (a && els.sheet.contains(a) && a.matches(TEXTY)) return;
        if (kb.grew && kind && full) setFull(false);
        kb.grew = false;
      }, 250);
    });
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', () => kbHeight()); window.visualViewport.addEventListener('scroll', () => kbHeight()); }
  }

  // ---------------- Back (v16.5 UX12) ----------------
  // A phone's Back (the system button or the edge gesture) closes the top layer, and the user stays in the app: a menu,
  // the palette, the coordinate pad, the tour's chapter menu, the sound settings, a dialog, a sheet (A.backLayer says
  // which, top first). While one is open, one history entry of ours sits on the page's own; Back pops it, the app
  // closes the top layer and, while another is still open, a new entry goes on. A layer closed in the app takes its
  // entry back (history.back(), whose popstate is ours and does nothing). With nothing open there is no entry of ours,
  // so Back from the bare app leaves it, as before. On a phone, and on any touch screen (an Android tablet).
  const back = { guard: false, skip: 0, t: 0 };
  const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  const topLayer = () => (A && typeof A.backLayer === 'function' ? A.backLayer() : null);
  function backSync() {
    back.t = 0;
    if (back.skip) return;   // (our own history.back() is on its way: its popstate looks again)
    const open = !!topLayer();
    if (open && !back.guard && (on || coarse())) {
      try { history.pushState(Object.assign({}, history.state, { cmwLayer: 1 }), ''); back.guard = true; } catch (e) { /* no history: Back leaves */ }
    } else if (!open && back.guard) {
      back.guard = false; back.skip++;
      try { history.back(); } catch (e) { back.skip--; }
    }
  }
  const backLater = () => { if (!back.t) back.t = setTimeout(backSync, 0); };
  function backInit() {
    // (a reload while a layer was open, the language switch: the entry we stand on was ours; it is the page's now)
    try { if (history.state && history.state.cmwLayer) { const st = Object.assign({}, history.state); delete st.cmwLayer; history.replaceState(Object.keys(st).length ? st : null, ''); } } catch (e) { /* */ }
    window.addEventListener('popstate', (e) => {
      if (back.skip) { back.skip--; backLater(); return; }
      if (!back.guard) {
        // (Forward onto an entry of ours with nothing open: step back off it)
        if (e.state && e.state.cmwLayer && !topLayer()) { back.skip++; try { history.back(); } catch (er) { back.skip--; } }
        return;
      }
      back.guard = false;
      const c = topLayer();
      if (c) { try { c(); } catch (er) { /* */ } }
      backLater();
    });
    // the layers come and go in the app's own code: look after each change
    const mo = new MutationObserver(backLater);
    const host = $('popHost');
    if (host) mo.observe(host, { childList: true });
    mo.observe(document.body, { childList: true });
    for (const id of ['sndPop', 'toolMore']) { const e = $(id); if (e) mo.observe(e, { attributes: true, attributeFilter: ['hidden', 'open'] }); }
    document.addEventListener('toggle', backLater, true);   // (a popover: the header's More menu)
  }

  function init(api) {
    A = api;
    els.title || void 0;
    const mq = [matchMedia(MQP), matchMedia(MQL)];
    for (const m of mq) m.addEventListener('change', sync);
    window.addEventListener('resize', () => { if (on && kind) geometry(); });
    sync();
    backInit();
  }
  return {
    init, open, close, swap: () => swap(), setBig, largeView, largeBox, hold, isOn: () => on, tab: (t) => { if (kind === 'tools') setTab(t); else toolTab = TOOL_TABS.includes(t) ? t : toolTab; }, tabOf, ctx, sheet: () => kind, big: () => big, nums: () => nums,
    geometry: () => { if (on) geometry(); },
    // TEMP-DEBUG-HOOK (removed before publishing)
    _state: () => ({ on, land, big, kind, full, split: rootEl.classList.contains('ph-split') }),
    _kb: (h) => kbHeight(h),   // (v16.5: a keyboard of h px, for the browser checks; headless Chrome has none)
    // TEMP-DEBUG-HOOK
  };
})();
