// Layout invariants (#470): checks a page's layout from its boxes, with no one looking. A page script: a suite injects
// this file's text (`await ev(fs.readFileSync(DIR + '/../lib/layout.js', 'utf8'))`) and calls window.__layout in the
// page; tools/inspect.js does the same. Each check returns a list of violations, { check, el, other?, detail }, where
// el and other describe elements (desc()) so a violation reads the same from one run to the next.
//   noOverlap(scope)         no two visible controls or text boxes overlap, except across a layer meant to sit on top
//   notCovered(scope)        the topmost element at each control's centre is that control (elementFromPoint)
//   centred(scope)           the boxes declared centred are, within their tolerance (INTENT.centred, data-center)
//   noClippedText(scope)     no text is cut by its box, except an ellipsis that is declared (INTENT.ellipsis, data-ellipsis)
//   noCutControls(scope)     no control is drawn past a panel that clips it and cannot scroll to it
//   noTextSpill(scope)       no control's text shows past the control's own box (a nowrap label wider than its pill, #498)
//   onGround(scope)          text over a plot (a canvas) sits on a ground: a box with a background, or a halo
//   insideViewport()         no horizontal page scroll, and nothing visible is cut by the viewport's edge
//   targetSizes(min)         each control is at least min × min px, or spaced as WCAG 2.2's 2.5.8 allows
//   focusRings(scope)        a control focused from the keyboard shows a ring that no box cuts
//   evenSpacing(scope)       the rows declared even (INTENT.rows) have equal gaps, within their tolerance
//   all(opt)                 every check above; opt: { touch, focus, scope }
// (ux's desktop sweep and phone's phone sweeps, #474, are folded in here: an overlap counts only where one of the two
// is painted on top, elementFromPoint at the overlap's centre; the layers are the stylesheets' z-index stack)
// The design intent (what sits on top, what is centred, which ellipses are meant, which rows are even) is declared in
// INTENT below or on the element (data-layer, data-center="x|y|both", data-ellipsis); the suite
// (test/layout_invariants_cmd.js) declares the known violations, each with its reason.
(function (root) {
  const INTENT = {
    // the layers meant to sit on top of the page: a box in one of them may cover a box outside it. From the stylesheets'
    // z-index stack, highest first (ux's table on #470): the tour's top layer and dimming, the warm-up bar, the phone's
    // keys, the steps view's Playback sheet and scrim, menus over dialogs, dialogs, the phone's sound pop-up, menus and
    // pop-ups, the phone's sheets and scrim, the tour strip; and toasts
    layers: [
      '[data-layer]', '.tour-top', '.tour-dim', '#warmBar', '.ph-keys', '.sv-sheet', '.sv-scrim', '.pop.over-modal', '.modal-bg',
      'dialog[open]', '.snd-pop', '#popHost > *', '.pop', ':popover-open', '.ph-sheet', '.ph-scrim', '.tour-root', '[data-tour]', '#toastHost',
      '#propsPanel.temp',   // (the Inspector floated over the stage, z 25, while the right panel is hidden: the steps view at 1024)
      '.ph-ctx',            // (#478: the phone's shape bar floats over the plane's bottom 56 px, 104 for the construction bar)
      ':root.ph.sv #svStrip',   // (the steps view's strip over the plane on a phone, z 26)
    ],
    // the boxes meant to be centred: sel, in (the container: 'parent' or a selector for closest()), or against (another
    // box it is centred on: a selector in its parent, or in the document with from: 'document'), axis ('x', 'y',
    // 'both'), what ('self': the box; 'content': the union of its visible children's boxes, centred in the box itself),
    // tol (px), why. ux's table on #470
    centred: [
      { sel: '#leftTabs > button, #rightTabs > button, #viewSwitch > button', what: 'content', axis: 'x', why: 'a view tab: its icon and word as a pair (#335)' },
      { sel: '.seg > button', what: 'content', axis: 'x', why: 'a segment\'s word (and icon) in its tile' },
      { sel: '.icon-btn, .vbtn', what: 'content', axis: 'both', why: 'an icon button\'s icon (the zoom and fit buttons, the ⋯ and eye buttons)' },
      { sel: '.tool[data-tool]', what: 'content', axis: 'x', why: 'a drawing tool\'s icon over its name' },
      { sel: '#addStepBtn', what: 'content', axis: 'both', why: 'Add function\'s + and word in its tile' },
      { sel: '.modal-bg > .modal', in: 'parent', axis: 'both', why: 'a dialog (Export, Settings, the gallery) in the viewport' },
      { sel: '.sv-nav, .sv-play', what: 'content', axis: 'both', why: 'the steps view\'s ‹ › and ▶ glyphs' },
      { sel: '.ts-btn', what: 'content', axis: 'both', why: 'the tour strip\'s Back and ✕ icons' },
      { sel: '.sv-plane .sv-pn', against: '.sv-node', axis: 'x', why: 'a plane\'s name under its dot' },
      { sel: '.sv-thumb', against: '.sv-plane.on .sv-node', from: 'document', axis: 'both', why: 'the ring on the shown plane\'s dot (not parked: then no plane is .on)' },
      { sel: '#toastHost > .toast', against: '.stage', from: 'document', axis: 'x', tol: 2, why: 'a toast over the stage' },
    ],
    // the ellipses that are meant: a box matching one of these may cut its text with text-overflow: ellipsis; named: only
    // when the box (or a control holding it) carries the whole text as its title or accessible name. ux on #470 and #483
    ellipsis: [
      { sel: '.ts-title', named: true, why: 'the tour strip\'s title: one line, the whole title as its name' },
      { sel: ':root.ph .pal-desc', why: 'the palette\'s row descriptions on a phone: one line per row; the whole one in its tooltip' },
    ],
    // the rows meant to be evenly spaced: sel (the row), tol (px), why
    rows: [],
  };

  const vis = (e) => {
    if (!e || !e.isConnected) return false;
    if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  };
  const CONTROL = 'button, a[href], input:not([type=hidden]), select, textarea, summary, [contenteditable=""], [contenteditable=true], '
    + '[role=button], [role=link], [role=tab], [role=radio], [role=checkbox], [role=switch], [role=menuitem], [role=menuitemradio], '
    + '[role=menuitemcheckbox], [role=option], [role=slider], [role=spinbutton], [role=combobox]';
  const isControl = (e) => e.matches(CONTROL);
  const disabled = (e) => e.disabled || e.getAttribute('aria-disabled') === 'true' || !!e.closest('[inert], fieldset[disabled]');

  // a short, stable description of an element: the nearest ancestor with an id, then the element's tag, id, two
  // classes and its name (aria-label, title or text)
  const desc = (e) => {
    if (!e || !(e instanceof Element)) return String(e);
    const one = (x) => x.tagName.toLowerCase() + (x.id ? '#' + x.id : '') + [...x.classList].slice(0, 2).map((c) => '.' + c).join('');
    let a = e.parentElement;
    while (a && !a.id && a !== document.body) a = a.parentElement;
    const name = (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 28);
    return (a && a.id && !e.id ? '#' + a.id + ' ' : '') + one(e) + (name ? `[${name}]` : '');
  };
  // the same without the name, and without the classes that only say a state (on, sel, open, ...): one key for a box
  // in every language and state, for the ratchet
  const STATE_CLASS = /^(on|sel|active|open|hover|focus|checked|cur|cp|is-.*|has-.*)$/;
  const key = (e) => {
    if (!e || !(e instanceof Element)) return String(e);
    const one = (x) => x.tagName.toLowerCase() + (x.id ? '#' + x.id : '') + [...x.classList].filter((c) => !STATE_CLASS.test(c)).slice(0, 2).map((c) => '.' + c).join('');
    let a = e.parentElement;
    while (a && !a.id && a !== document.body) a = a.parentElement;
    return (a && a.id && !e.id ? '#' + a.id + ' ' : '') + one(e);
  };
  // a violation: el (and other) described and keyed, with their boxes for a marked screenshot
  const V = (check, el, other, detail, box, obox) => {
    const v = { check, key: key(el), el: desc(el), detail };
    if (other) { v.okey = other instanceof Element ? key(other) : String(other); v.other = other instanceof Element ? desc(other) : String(other); }
    if (box || el instanceof Element) v.box = round(box || R(el.getBoundingClientRect()));
    if (obox || other instanceof Element) v.obox = round(obox || R(other.getBoundingClientRect()));
    return v;
  };
  const R = (r) => ({ l: r.left, t: r.top, r: r.right, b: r.bottom });
  const round = (q) => q && { l: Math.round(q.l), t: Math.round(q.t), r: Math.round(q.r), b: Math.round(q.b) };
  const inter = (p, q) => ({ l: Math.max(p.l, q.l), t: Math.max(p.t, q.t), r: Math.min(p.r, q.r), b: Math.min(p.b, q.b) });
  const w = (q) => Math.max(0, q.r - q.l), h = (q) => Math.max(0, q.b - q.t);

  // the boxes that clip e: its ancestors whose overflow is not visible (a fixed box is not clipped by those above it);
  // opt.scroll false leaves out the boxes e can be scrolled into view in (a scroller's edge cuts what is scrolled away);
  // opt.only: the scrollers alone
  function clipOf(e, opt = {}) {
    let q = { l: -1e9, t: -1e9, r: 1e9, b: 1e9 };
    let fx = getComputedStyle(e).position === 'fixed';
    for (let a = e.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      if (fx) break;
      const cs = getComputedStyle(a);
      fx = cs.position === 'fixed';
      if (cs.display === 'contents' || (cs.overflowX === 'visible' && cs.overflowY === 'visible')) continue;
      const b = a.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      const sx = /(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1;
      const sy = /(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1;
      // (the padding box: the border does not show what it clips)
      const c = { l: b.left + a.clientLeft, t: b.top + a.clientTop, r: b.left + a.clientLeft + a.clientWidth, b: b.top + a.clientTop + a.clientHeight };
      if (cs.overflowX !== 'visible' && (opt.scroll !== false || !sx) && (!opt.only || sx)) { q.l = Math.max(q.l, c.l); q.r = Math.min(q.r, c.r); }
      if (cs.overflowY !== 'visible' && (opt.scroll !== false || !sy) && (!opt.only || sy)) { q.t = Math.max(q.t, c.t); q.b = Math.min(q.b, c.b); }
    }
    return q;
  }
  const padBox = (e) => { const b = e.getBoundingClientRect(); return { l: b.left + e.clientLeft, t: b.top + e.clientTop, r: b.left + e.clientLeft + e.clientWidth, b: b.top + e.clientTop + e.clientHeight }; };
  const viewport = () => ({ l: 0, t: 0, r: innerWidth, b: innerHeight });
  // what shows of e's box: cut by its clipping ancestors and the viewport; null when (almost) nothing does
  function seen(e, box) {
    const q = inter(inter(box || R(e.getBoundingClientRect()), clipOf(e)), viewport());
    return w(q) > 1 && h(q) > 1 ? q : null;
  }

  // the app's own layers, as it lists them for the tour (the drawers at 768-1023 px, the Inspector over the steps view)
  // (and a side panel lifted out as a drawer, absolute over the stage at 768-1279 px: z 20 in page.html's floating layers)
  const appLayers = () => {
    let L = [];
    try { L = [...((window.__tourApi && __tourApi.layers && __tourApi.layers()) || [])].filter((k) => k instanceof Element); } catch (x) { L = []; }
    if (document.documentElement.classList.contains('ph')) return L;   // (a phone's rails are not drawers)
    return L.concat([...document.querySelectorAll('.layout > .panel')].filter((p) => getComputedStyle(p).position === 'absolute'));
  };
  // the layer e is in: the outermost declared layer that holds it (null: the page)
  function layerOf(e) {
    let L = null;
    const sel = INTENT.layers.join(', '), app = appLayers();
    for (let a = e; a; a = a.parentElement) { try { if (a.matches(sel) || app.includes(a)) L = a; } catch (x) { /* a selector this Chrome lacks */ } }
    return L;
  }

  // a layer's stacking order: its own z-index or the nearest positioned ancestor's (auto: 0)
  const zOf = (e) => { for (let a = e; a && a !== document.documentElement; a = a.parentElement) { const z = getComputedStyle(a).zIndex; if (z !== 'auto') return +z; } return 0; };
  // the layers open now (visible), outermost first in document order; under(e): the topmost element at e's centre is
  // in a layer that does not hold e
  function openLayers() {
    const sel = INTENT.layers.join(', ');
    let L = [];
    try { L = [...document.querySelectorAll(sel)].concat(appLayers()); } catch (x) { L = []; }
    return L.filter((k) => vis(k) && !L.some((o) => o !== k && o.contains(k)));
  }
  function under(e) {
    const s = seen(e);
    if (!s) return false;
    const hit = document.elementFromPoint((s.l + s.r) / 2, (s.t + s.b) / 2);
    if (!hit || e.contains(hit) || hit.contains(e)) return false;
    const Lh = layerOf(hit);
    return !!Lh && Lh !== layerOf(e);
  }
  // the text boxes: the text of an element's own text nodes (one box for all of them), a typeset formula as one box, an
  // SVG text
  function textBoxes(scope) {
    const out = [];
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (/\S/.test(n.nodeValue) && n.parentElement && !n.parentElement.closest('mjx-container, script, style, noscript, svg, template') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
    });
    const by = new Map();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!vis(p)) continue;
      const rg = document.createRange(); rg.selectNodeContents(n);
      const rs = [...rg.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      if (!rs.length) continue;
      const b = by.get(p) || { l: 1e9, t: 1e9, r: -1e9, b: -1e9 };
      for (const r of rs) { b.l = Math.min(b.l, r.left); b.t = Math.min(b.t, r.top); b.r = Math.max(b.r, r.right); b.b = Math.max(b.b, r.bottom); }
      by.set(p, b);
    }
    // (box: what its own box lets show, a scroller's hidden lines left out; full: all of the text, for noClippedText)
    for (const [el, full] of by) {
      const cs = getComputedStyle(el), c = padBox(el), box = Object.assign({}, full);
      if (cs.display === 'inline') { out.push({ el, box, full, kind: 'text' }); continue; }   // (overflow does not apply)
      if (cs.overflowX !== 'visible') { box.l = Math.max(box.l, c.l); box.r = Math.min(box.r, c.r); }
      if (cs.overflowY !== 'visible') { box.t = Math.max(box.t, c.t); box.b = Math.min(box.b, c.b); }
      if (w(box) > 0.5 && h(box) > 0.5) out.push({ el, box, full, kind: 'text' });
    }
    for (const el of scope.querySelectorAll('mjx-container, svg text')) if (vis(el)) out.push({ el, box: R(el.getBoundingClientRect()), kind: el.tagName === 'MJX-CONTAINER' ? 'formula' : 'text' });
    return out;
  }
  const controls = (scope) => [...scope.querySelectorAll(CONTROL)].filter(vis);

  // ---- the checks ----
  function noOverlap(scope = document.body, tol = 2) {
    // the controls, and the text that is not inside a control (a control's own text is in its box)
    const items = controls(scope).map((el) => ({ el, box: R(el.getBoundingClientRect()), kind: 'control' }))
      .concat(textBoxes(scope).filter((t) => !t.el.closest(CONTROL)));
    const live = [];
    for (const it of items) { const s = seen(it.el, it.box); if (s) live.push(Object.assign(it, { s, L: layerOf(it.el) })); }
    const out = [];
    for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
      const a = live[i], b = live[j];
      if (a.L !== b.L || a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const q = inter(a.s, b.s);
      if (w(q) <= tol || h(q) <= tol) continue;
      // (only where one of the two is painted there: something above both, a scrim or a sheet, covers the collision)
      const hit = document.elementFromPoint((q.l + q.r) / 2, (q.t + q.b) / 2);
      if (hit && !(a.el.contains(hit) || b.el.contains(hit) || hit.contains(a.el) || hit.contains(b.el))) continue;
      out.push(V('overlap', a.el, b.el, { kinds: a.kind + '/' + b.kind, by: [Math.round(w(q)), Math.round(h(q))] }, a.s, b.s));
    }
    return out;
  }

  function notCovered(scope = document.body) {
    const out = [];
    for (const el of controls(scope)) {
      if (getComputedStyle(el).pointerEvents === 'none') continue;
      const s = seen(el);
      if (!s) continue;
      const x = (s.l + s.r) / 2, y = (s.t + s.b) / 2;
      const hit = document.elementFromPoint(x, y);
      if (!hit || el === hit || el.contains(hit)) continue;
      // (a label is its control's target; a control under a layer meant to sit on top is meant to be covered)
      const lab = hit.closest('label');
      if (lab && (lab.control === el || lab.contains(el))) continue;
      if (hit.contains(el) && (disabled(el) || getComputedStyle(el).pointerEvents === 'none')) continue;
      // (a page control under a layer is meant to be covered, and so is a layer's control under a layer drawn above it,
      // a sheet over the steps view's strip; a layer's control covered by anything else is not)
      const Lh = layerOf(hit), Le = layerOf(el);
      if (Lh && (!Le || (Lh !== Le && zOf(Lh) > zOf(Le)))) continue;
      out.push(V('covered', el, hit, { at: [Math.round(x), Math.round(y)] }, s));
    }
    return out;
  }

  function centredOne(el, c, axis = 'both', tol = 1, what = 'self') {
    const box = R(el.getBoundingClientRect());
    let it = box, ct = c ? R(c.getBoundingClientRect()) : null;
    if (what === 'content') {
      const kids = [...el.children].filter(vis).map((k) => R(k.getBoundingClientRect()));
      const tb = textBoxes(el).filter((t) => t.el === el).map((t) => t.box);
      const all = kids.concat(tb);
      if (!all.length) return null;
      it = all.reduce((p, q) => ({ l: Math.min(p.l, q.l), t: Math.min(p.t, q.t), r: Math.max(p.r, q.r), b: Math.max(p.b, q.b) }));
      ct = box;
    }
    if (!ct) return null;
    const dx = (it.l - ct.l) - (ct.r - it.r), dy = (it.t - ct.t) - (ct.b - it.b);
    const bad = (/x|both/.test(axis) && Math.abs(dx) / 2 > tol) || (/y|both/.test(axis) && Math.abs(dy) / 2 > tol);
    return { off: [+(dx / 2).toFixed(2), +(dy / 2).toFixed(2)], bad };
  }
  function centred(scope = document.body) {
    const out = [];
    const decl = INTENT.centred.slice();
    for (const el of scope.querySelectorAll('[data-center]')) decl.push({ el, axis: el.dataset.center, why: 'data-center' });
    for (const d of decl) {
      const els = d.el ? [d.el] : [...scope.querySelectorAll(d.sel)];
      for (const el of els) {
        if (!vis(el) || !seen(el)) continue;
        const c = d.what === 'content' ? el : d.against ? (d.from === 'document' ? document : el.parentElement || document).querySelector(d.against)
          : !d.in || d.in === 'parent' ? el.parentElement : el.parentElement && el.parentElement.closest(d.in);
        if (!c || !vis(c)) continue;
        const r = centredOne(el, c, d.axis || 'both', d.tol != null ? d.tol : 1, d.what || 'self');
        if (r && r.bad) out.push(V('centred', el, d.what === 'content' ? null : c, { off: r.off, axis: d.axis || 'both', why: d.why }));
      }
    }
    return out;
  }

  function noClippedText(scope = document.body) {
    const out = [];
    // (a meant ellipsis: [data-ellipsis], or INTENT.ellipsis, whose named ones need the whole text as a name nearby)
    const named = (e, text) => { for (let a = e; a && a !== document.body; a = a.parentElement) { const n = (a.getAttribute('title') || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(); if (n && n.includes(text)) return true; } return false; };
    const meantEll = (e) => { if (e.closest('[data-ellipsis]')) return true; const d = INTENT.ellipsis.find((x) => { try { return !!e.closest(x.sel); } catch (y) { return false; } }); return !!d && (!d.named || named(e, (e.textContent || '').replace(/\s+/g, ' ').trim())); };
    for (const t of textBoxes(scope)) {
      if (!seen(t.el, t.box)) continue;
      // (the text a scroller of its own hides is scrolled away, not cut: that way, what its box shows counts)
      const fu = t.full || t.box, oc = getComputedStyle(t.el), sx = /(auto|scroll)/.test(oc.overflowX), sy = /(auto|scroll)/.test(oc.overflowY);
      const full = { l: sx ? t.box.l : fu.l, r: sx ? t.box.r : fu.r, t: sy ? t.box.t : fu.t, b: sy ? t.box.b : fu.b };
      // the boxes that cut it for good: its clipping ancestors that cannot scroll it into view, and its own box
      let q = clipOf(t.el, { scroll: false });
      const own = getComputedStyle(t.el);
      // (its own box cuts it unless it can scroll that way)
      const c = padBox(t.el), blk = own.display !== 'inline';
      if (blk && own.overflowX !== 'visible' && !/(auto|scroll)/.test(own.overflowX)) { q.l = Math.max(q.l, c.l); q.r = Math.min(q.r, c.r); }
      if (blk && own.overflowY !== 'visible' && !/(auto|scroll)/.test(own.overflowY)) { q.t = Math.max(q.t, c.t); q.b = Math.min(q.b, c.b); }
      // (glyph boxes stand a little past a tight line box: a tenth of the font size up and down is not a cut)
      const fs = parseFloat(own.fontSize) || 13, ty = Math.max(1.5, 0.15 * fs);
      // (a side a scroller of an ancestor also cuts is scrolled away: a row at the edge of a scrolling list, under a
      // panel that clips at the same line)
      const sc = clipOf(t.el, { only: true });
      const sd = (k, sg) => (sg * (full[k] - sc[k]) < -0.5 ? 0 : sg * (q[k] - full[k]));
      const cx = Math.max(sd('l', 1), sd('r', -1)), cy = Math.max(sd('t', 1), sd('b', -1));
      // an ellipsis cuts the text inside its box: the box's scrollWidth says so
      const sw = t.el.scrollWidth > t.el.clientWidth + 1 && blk && /(hidden|clip)/.test(own.overflowX);
      if (cx <= 1 && cy <= ty && !sw) continue;
      let meant = false;
      meant = own.textOverflow === 'ellipsis' && meantEll(t.el);
      if (meant) continue;
      out.push(V(own.textOverflow === 'ellipsis' ? 'ellipsis' : 'clipped', t.el, null, { cut: [Math.round(Math.max(0, cx)), Math.round(Math.max(0, cy))], text: (t.el.textContent || '').trim().slice(0, 40) }, t.box));
    }
    return out;
  }

  function insideViewport(scope = document.body) {
    const out = [];
    const se = document.scrollingElement || document.documentElement;
    if (se.scrollWidth > innerWidth + 1) {
      const past = [...scope.querySelectorAll('*')].filter((e) => vis(e) && e.getBoundingClientRect().right > innerWidth + 1);
      // (the outermost of them: their children are past the edge with them)
      const top = past.filter((e) => !past.some((p) => p !== e && p.contains(e))).slice(0, 6).map(desc);
      out.push({ check: 'page-scroll-x', key: 'document', el: 'document', detail: { scrollWidth: se.scrollWidth, width: innerWidth, past: top } });
    }
    const items = controls(scope).map((el) => ({ el, box: R(el.getBoundingClientRect()) })).concat(textBoxes(scope));
    for (const it of items) {
      const q = inter(it.box, clipOf(it.el));
      if (w(q) <= 1 || h(q) <= 1) continue;
      const v = inter(q, viewport());
      // (wholly outside: a drawer slid away; partly: cut by the edge)
      if (w(v) <= 1 || h(v) <= 1) continue;
      const cut = Math.max(-q.l, -q.t, q.r - innerWidth, q.b - innerHeight);
      if (cut > 1) out.push(V('off-screen', it.el, null, { cut: Math.round(cut) }, q));
    }
    return out;
  }

  // WCAG 2.2 2.5.8 (min 24; 44 on touch, as Apple's and the WCAG AAA 2.5.5 size): a control smaller than min passes when
  // a circle of diameter min on its centre meets no other control and no other small control's circle. Not targets:
  // a disabled control, a link inside a sentence
  function targetSizes(min = 24, scope = document.body) {
    const out = [];
    // (a control under a layer that covers it is no target now, and the neighbours that count are in its own layer)
    const all = controls(scope).filter((e) => !disabled(e) && getComputedStyle(e).pointerEvents !== 'none' && seen(e) && !under(e));
    const inline = (e) => e.tagName === 'A' && getComputedStyle(e).display === 'inline' && /\S/.test((e.parentElement.textContent || '').replace(e.textContent, ''));
    const T = all.filter((e) => !inline(e) && !all.some((o) => o !== e && o.contains(e) && !disabled(o)))
      .map((e) => { const r = e.getBoundingClientRect(); return { e, L: layerOf(e), r: R(r), c: [(r.left + r.right) / 2, (r.top + r.bottom) / 2], small: r.width < min - 0.5 || r.height < min - 0.5 }; });
    const dRect = (c, q) => Math.hypot(Math.max(q.l - c[0], 0, c[0] - q.r), Math.max(q.t - c[1], 0, c[1] - q.b));
    for (const a of T) {
      if (!a.small) continue;
      const near = T.find((b) => b !== a && b.L === a.L && (b.small ? Math.hypot(a.c[0] - b.c[0], a.c[1] - b.c[1]) < min - 0.5 : dRect(a.c, b.r) < min / 2 - 0.5));
      if (near) out.push(V('target-size', a.e, near.e, { size: [Math.round(w(a.r)), Math.round(h(a.r))], min }));
    }
    return out;
  }

  // each keyboard-focusable control, focused as from the keyboard: it shows that it has the focus (an outline, a
  // shadow, or its background, border or colour changes), and an outline or shadow ring is not cut by a box that clips
  // it (a control a scroller cuts is scrolled away: then only the boxes that cannot scroll count). Run it last: the
  // focus moves (a menu may close when it leaves). When a layer is open, only its controls (the rest are not reachable)
  const LOOK = ['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'color', 'textDecorationLine'];
  function focusRings(scope = document.body, limit = 400) {
    const out = [];
    const back = document.activeElement;
    const top = openLayers().pop();
    const els = controls(top || scope).filter((e) => e.tabIndex >= 0 && !disabled(e) && seen(e) && !under(e)).slice(0, limit);
    for (const el of els) {
      // (a field may show its focus on its wrapper, :focus-within: the two boxes above it count)
      const look = () => [el, el.parentElement, el.parentElement && el.parentElement.parentElement].filter(Boolean).map((x) => { const c = getComputedStyle(x); return LOOK.map((k) => c[k]).join('|'); }).join('/');
      const was = look();
      try { el.focus({ preventScroll: true, focusVisible: true }); } catch (x) { continue; }
      if (document.activeElement !== el) continue;
      const cs = getComputedStyle(el);
      // (an item already marked, the menu's current one, looks focused before it is: then an unfocused sibling of its
      // kind is what it must differ from)
      const one = (x) => { const c = getComputedStyle(x); return LOOK.map((k) => c[k]).join('|'); };
      const peer = [...(el.parentElement ? el.parentElement.children : [])].find((x) => x !== el && x.tagName === el.tagName && x.classList[0] === el.classList[0] && vis(x));
      const changed = look() !== was || (!!peer && one(el) !== one(peer));
      const ow = cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) || 0 : 0;
      const sh = cs.boxShadow && cs.boxShadow !== 'none' ? Math.max(0, ...cs.boxShadow.split(/,(?![^(]*\))/).filter((x) => !/inset/.test(x)).map((x) => /(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px\s+(-?[\d.]+)px/.exec(x)).filter(Boolean).map((m) => +m[4] + +m[3] / 2)) : 0;
      const inset = cs.boxShadow && /inset/.test(cs.boxShadow);
      const grow = Math.max(ow > 0 ? ow + (parseFloat(cs.outlineOffset) || 0) : 0, sh);
      if (ow <= 0 && sh <= 0 && !inset && !changed) { out.push(V('focus-ring', el, null, { ring: 'none' })); continue; }
      if (grow <= 0) continue;
      const b = R(el.getBoundingClientRect());
      const ring = { l: b.l - grow, t: b.t - grow, r: b.r + grow, b: b.b + grow };
      // a side counts where a box that cannot scroll cuts the ring, or where a scroller does and the control's own edge
      // there is in view (a control scrolled partly away shows its ring once it is scrolled to)
      // (the viewport's edge too counts only where the control's edge is in view)
      const qa = inter(clipOf(el), viewport()), qn = clipOf(el, { scroll: false });
      const side = (k, sg) => Math.max(sg * (qn[k] - ring[k]), sg * (b[k] - qa[k]) >= -0.5 ? sg * (qa[k] - ring[k]) : 0);
      const cut = Math.max(side('l', 1), side('t', 1), side('r', -1), side('b', -1));
      if (cut > Math.max(1, grow / 2)) out.push(V('focus-ring', el, null, { ring: 'cut', grow: +grow.toFixed(1), cut: Math.round(cut) }, ring));
    }
    try { if (back && back.focus) back.focus({ preventScroll: true }); else document.activeElement.blur(); } catch (x) { /* gone */ }
    return out;
  }

  // a control drawn past the edge of a box that clips it and cannot scroll to it (ux's "controls past their panel"):
  // part of it can never be seen or reached
  function noCutControls(scope = document.body) {
    const out = [];
    for (const el of controls(scope)) {
      const s = seen(el);
      if (!s) continue;
      // (a side a scroller also cuts is scrolled away: a panel round the scroller may clip at the same line)
      const b = R(el.getBoundingClientRect()), q = clipOf(el, { scroll: false }), sc = clipOf(el, { only: true });
      const side = (k, sg) => (sg * (b[k] - sc[k]) < -0.5 ? 0 : sg * (q[k] - b[k]));
      const cut = Math.max(side('l', 1), side('t', 1), side('r', -1), side('b', -1));
      if (cut > 2) out.push(V('control-cut', el, null, { cut: Math.round(cut) }, b));
    }
    return out;
  }

  // a control's text stays inside the control: a label wider than its button, with overflow visible, is cut by
  // nothing (noClippedText passes it) and runs into its neighbours (the export dialog's caption pills in Italian, #498)
  function noTextSpill(scope = document.body) {
    const out = [];
    for (const el of controls(scope)) {
      if (!seen(el)) continue;
      const cs = getComputedStyle(el), b = R(el.getBoundingClientRect());
      const fs = parseFloat(cs.fontSize) || 13, ty = Math.max(1.5, 0.15 * fs);
      for (const t of textBoxes(el)) {
        if (t.kind !== 'text' || t.el.closest(CONTROL) !== el) continue;   // (a control's own text, not a nested control's)
        const f = t.box;
        const dx = cs.overflowX === 'visible' ? Math.max(b.l - f.l, f.r - b.r) : 0, dy = cs.overflowY === 'visible' ? Math.max(b.t - f.t, f.b - b.b) : 0;
        if (dx <= 2 && dy <= ty) continue;   // (2 px, as noOverlap and noCutControls allow)
        out.push(V('text-spill', el, null, { spill: [Math.round(Math.max(0, dx)), Math.round(Math.max(0, dy))], text: (t.el.textContent || '').trim().slice(0, 40) }, b));
        break;
      }
    }
    return out;
  }

  // text over a plot (a canvas under it at its centre) sits on a ground: the text, or a box above the canvas that
  // holds it, has a background at least half opaque, or the text has a halo (a text-shadow, an SVG stroke painted
  // first). Text straight on the picture can be unreadable whatever the picture is (#469's empty-state hint)
  const alpha = (c) => { const m = /rgba?\(([^)]+)\)/.exec(c || ''); if (!m) return 0; const p = m[1].split(/[\s,/]+/).filter(Boolean); return p.length > 3 ? parseFloat(p[3]) : 1; };
  function onGround(scope = document.body) {
    const out = [];
    for (const t of textBoxes(scope)) {
      const s = seen(t.el, t.box);
      if (!s) continue;
      const stack = document.elementsFromPoint((s.l + s.r) / 2, (s.t + s.b) / 2);
      const ci = stack.findIndex((e) => e.tagName === 'CANVAS');
      if (ci < 0 || !stack.slice(0, ci).some((e) => e === t.el || e.contains(t.el) || t.el.contains(e))) continue;
      const above = stack.slice(0, ci);
      const ground = above.some((e) => { const c = getComputedStyle(e); return alpha(c.backgroundColor) >= 0.5 || (c.backgroundImage && c.backgroundImage !== 'none') || (c.backdropFilter && c.backdropFilter !== 'none'); });
      const tc = getComputedStyle(t.el);
      const halo = (tc.textShadow && tc.textShadow !== 'none') || (t.el instanceof SVGElement && tc.stroke !== 'none' && /stroke/.test(tc.paintOrder));
      if (!ground && !halo) out.push(V('no-ground', t.el, stack[ci], { text: (t.el.textContent || '').trim().slice(0, 40) }, t.box));
    }
    return out;
  }

  function evenSpacing(scope = document.body) {
    const out = [];
    for (const d of INTENT.rows) {
      for (const row of scope.querySelectorAll(d.sel)) {
        if (!vis(row)) continue;
        const ks = [...row.children].filter(vis).map((k) => R(k.getBoundingClientRect()));
        if (ks.length < 3) continue;
        const hz = (ks[ks.length - 1].l - ks[0].l) >= (ks[ks.length - 1].t - ks[0].t);
        ks.sort((p, q) => (hz ? p.l - q.l : p.t - q.t));
        const gaps = ks.slice(1).map((k, i) => +(hz ? k.l - ks[i].r : k.t - ks[i].b).toFixed(1));
        const spread = Math.max(...gaps) - Math.min(...gaps);
        if (spread > (d.tol != null ? d.tol : 1)) out.push(V('spacing', row, null, { gaps, why: d.why }));
      }
    }
    return out;
  }

  function all(opt = {}) {
    const scope = opt.scope || document.body;
    const touch = opt.touch != null ? opt.touch : matchMedia('(pointer: coarse)').matches;
    // (the focus rings last: they move the focus)
    return [].concat(noOverlap(scope), notCovered(scope), centred(scope), noClippedText(scope), noCutControls(scope), noTextSpill(scope), onGround(scope), insideViewport(scope),
      targetSizes(touch ? 44 : 24, scope), evenSpacing(scope), opt.focus ? focusRings(scope) : []);
  }

  root.__layout = { INTENT, openLayers, under, vis, seen, clipOf, desc, key, layerOf, textBoxes, controls, noOverlap, notCovered, centred, centredOne, noClippedText, noCutControls, noTextSpill, onGround, insideViewport, targetSizes, focusRings, evenSpacing, all };
})(typeof window !== 'undefined' ? window : globalThis);
