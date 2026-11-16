  // ---------------------------------------------------------------- state
  let api = {}, rec = normRec(null), inited = false;
  let run = null;        // the running tour: {chs, ci, si, snap, scene, seq, opener, offs, ui, ...}
  let sugg = null;       // the suggestion card (or, id 'continue', the line that continues a tour cut short)
  let cutShort = false;  // init found a tour that a reload or a crash cut short
  let menu = null;       // the help menu
  let lastWhy = null;    // the steps the last run skipped, and why (Tour.skipped())
  const doc = () => (typeof document !== 'undefined' ? document : null);
  const mac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  const modKey = () => (mac() ? '⌘' : 'Ctrl');
  const sk = (k) => { try { return (api.storageKey && api.storageKey(k)) || k; } catch (e) { return k; } };
  const KEY = 'cmw-tour', STASH = 'cmw-tour-stash', LIVE = 'cmw-tour-live';
  // this page's id: the stash and its heartbeat name the page whose tour holds them, so another tab never takes them
  const PAGE = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const BEAT_MS = 2000, BEAT_STALE = 6000;
  let lastToast = null, recheckT = 0;
  function load() { try { rec = normRec(JSON.parse(localStorage.getItem(sk(KEY)) || 'null')); } catch (e) { rec = normRec(null); } return rec; }
  function save() { try { localStorage.setItem(sk(KEY), JSON.stringify(rec)); } catch (e) { /* storage unavailable: the tour still runs */ } }
  const call = (name, ...a) => { try { return typeof api[name] === 'function' ? api[name](...a) : undefined; } catch (e) { warn(name, e); return false; } };
  const warn = (what, e) => { try { console.warn('[tour]', what, e && e.message ? e.message : e); } catch (x) { /* */ } };
  const reduced = () => {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--t-slow').trim();
      if (v === '0ms' || v === '0s') return true;
      return matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  };
  /** @type {(n?: number) => Promise<void>} */
  const frames = (n = 2) => new Promise((res) => { const f = () => (--n <= 0 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const narrow = () => (typeof innerWidth === 'number' ? innerWidth < 640 : false);
  // a touch screen: no hover, no right-click, no key hints
  const coarse = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  // the phone layout (the `ph` class phone.js sets: the controls sit in its sheets and menus), apart from the pointer: place
  // words follow it, gesture words follow coarse(). Where there is no document (the unit tests): the narrow window.
  const layoutIsPhone = () => (typeof document !== 'undefined' && document.documentElement ? phoneLayout() : narrow());
  const isCoarseOf = (o) => (o && o.coarse != null ? o.coarse : coarse());
  const isPhoneOf = (o) => (o && o.phone != null ? o.phone : o && o.narrow != null ? o.narrow : layoutIsPhone());
  // one of an item's copies by layout and pointer. body (desk layout, fine pointer) and touch (phone layout, coarse
  // pointer) are the two basic ones; deskTouch (desk, coarse) and phoneFine (phone, fine) are for the items whose
  // words name a place that differs between the layouts ("the Inspector" or "the editor", "Open the chain, then tap").
  // An item without them has gesture words only: a coarse pointer reads its touch copy, a fine one its body.
  const variantOf = (it, base, o, dt = 'deskTouch', pf = 'phoneFine') => {
    const c = isCoarseOf(o), ph = isPhoneOf(o);
    if (c) return (!ph && it[dt]) || it.touch || base;
    return (ph && it[pf]) || base;
  };
  // a chapter this screen offers: one for the keyboard (desk) is not offered on a touch screen
  const chapterShown = (c) => !(c && c.desk && coarse());
  // where the tour lives: the help button, or the ⋯ menu that holds it on a phone
  // (on a phone the ⋯ sheet lists Guided tour)
  const helpWhere = () => (anchorEl('helpBtn') ? $t('Help') : anchorEl('moreBtn') ? $t('⋯ › Guided tour') : $t('Help'));
  // the copy a step shows here: by the scene shown, on a touch screen, below 640 px, else its body
  function copyFor(step, scene, o = {}) {
    const isCoarse = isCoarseOf(o), isPhone = isPhoneOf(o);
    // (and by layout, as the step's own copies)
    if (scene != null) {
      const tb = isCoarse ? (!isPhone && step.deskTouchByScene && step.deskTouchByScene[scene]) || (step.touchByScene && step.touchByScene[scene]) : isPhone && step.phoneFineByScene && step.phoneFineByScene[scene];
      if (tb) return $t(tb);
    }
    if (step.byScene && scene != null && step.byScene[scene]) return $t(step.byScene[scene]);
    // the anchor found is the ⋯ menu (the control itself lives in it here): the copy that says "in this menu"
    if (o.menu && step.narrow) return $t(step.narrow);
    // the phone layout's place words ("in this menu") belong to the layout, a touch screen's to the pointer
    if (isCoarse) return $t((!isPhone && step.deskTouch) || step.touch || (isPhone && step.narrow) || step.body);
    return $t((isPhone && (step.phoneFine || step.narrow)) || step.body);
  }
  // a step's lead and title on a touch screen, where it has its own
  const leadFor = (st, o = {}) => variantOf({ touch: st.leadTouch, deskTouch: st.leadDeskTouch, phoneFine: st.leadPhoneFine }, st.lead, o);
  const tryFor = (t, o = {}) => $t(variantOf(t, t.text, o));
  // (a hint after a wrong attempt: the gesture words of the pointer)
  const hintFor = (t, o = {}) => (t.hint ? (isCoarseOf(o) ? t.hint.touch || t.hint.text : t.hint.text) : null);
  // a step's Try it here (tryWide: not below 640 px, where what it asks for is off-screen)
  // (try.after: only when that step's task of the same chapter was done in this run; else the step is read)
  const tryOf = (step) => (step.try && !(step.tryWide && narrow()) && !(step.try.after && !(run && run.doneTasks && run.doneTasks.has(CHAPTERS[run.ci].id + '/' + step.try.after))) ? step.try : null);
  // the controls that complete the step's Try it, while it shows
  const ctlOf = (step) => { const t = tryOf(step); return t && t.ctl ? [].concat(t.ctl) : []; };
  // the parts a Try it's touch task names (try.work), lit on a touch screen
  const workOf = (step) => { const t = tryOf(step); return t && t.work && t.touch && coarse() ? [].concat(t.work) : []; };

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids) if (k != null) e.append(k);
    return e;
  }
  // copy -> DOM (TeX through the app's renderer when it has one)
  function richText(s) {
    const frag = document.createDocumentFragment();
    const toks = parseCopy(s);
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.t === 'text') frag.append(t.v);
      else if (t.t === 'b') frag.append(el('b', null, t.v));
      else if (t.t === 'kbd') frag.append(el('span', { class: 'kbd' }, t.v === 'mod' ? modKey() : t.v));
      else {
        let m = null;
        const tex = notation(t.v);
        try { m = api.tex ? api.tex(tex) : null; } catch (e) { m = null; }
        if (!(m && m.nodeType)) m = el('span', { class: 'tour-math' }, texPlain(tex));
        if (m.setAttribute && !m.getAttribute('aria-label')) m.setAttribute('aria-label', texPlain(tex));
        // punctuation right after a formula stays on its line
        const nx = toks[i + 1], pm = nx && nx.t === 'text' ? /^[.,;:!?)]+/.exec(nx.v) : null;
        if (pm) { frag.append(el('span', { class: 'tour-nb' }, m, pm[0])); nx.v = nx.v.slice(pm[0].length); }
        else frag.append(m);
      }
    }
    return frag;
  }

  // ---------------------------------------------------------------- anchors
  function visible(e) {
    if (!e || !e.isConnected) return false;
    if (typeof e.checkVisibility === 'function' && !e.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1;
  }
  // What a name lights (api.anchor, else the ANCHORS default): an Element (HTML or SVG); a list of Elements, a composite
  // anchor whose visible members are each lit exactly; or a region of an element, { el, rect }, such as a part of a
  // canvas: rect is { x, y, w, h } in CSS px from the element's top left corner, or a function returning a client rect
  // { left, top, right, bottom }. Normalised to { el (the first visible element), parts: [{ el, rect? }] } or null.
  function anchorVal(n) {
    let e;
    try { e = api.anchor ? api.anchor(n) : undefined; } catch (x) { e = undefined; }
    if (e === undefined && ANCHORS[n]) { try { e = typeof ANCHORS[n] === 'function' ? ANCHORS[n]() : document.querySelector(ANCHORS[n]); } catch (x) { e = null; } }
    return e;
  }
  function normAnchor(v) {
    if (!v) return null;
    if (Array.isArray(v) || (typeof NodeList !== 'undefined' && v instanceof NodeList)) {
      const els = [...v].filter(visible);
      return els.length ? { el: els[0], parts: els.map((e) => ({ el: e })) } : null;
    }
    if (v.el && v.rect && !(typeof Element !== 'undefined' && v instanceof Element)) return visible(v.el) ? { el: v.el, parts: [{ el: v.el, rect: v.rect }] } : null;
    return visible(v) ? { el: v, parts: [{ el: v }] } : null;
  }
  // (ok: a further test, such as not clipped away)
  function anchorOf(names, ok) {
    for (const n of [].concat(names)) { const t = normAnchor(anchorVal(n)); if (t && (!ok || ok(t))) return t; }
    return null;
  }
  function anchorEl(names) { const t = anchorOf(names); return t ? t.el : null; }
  // a part's box in client px: the element's border box, or its region
  function partBox(p) {
    const b = p.el.getBoundingClientRect();
    if (!p.rect) return b;
    try {
      const q = typeof p.rect === 'function' ? p.rect(p.el) : p.rect;
      if (q && q.left != null) return { left: q.left, top: q.top, right: q.right, bottom: q.bottom, width: q.right - q.left, height: q.bottom - q.top };
      if (q && q.x != null) return { left: b.left + q.x, top: b.top + q.y, right: b.left + q.x + q.w, bottom: b.top + q.y + q.h, width: q.w, height: q.h };
    } catch (e) { /* the element's box */ }
    return b;
  }
  // the corner radii of an element in px [top left, top right, bottom right, bottom left]: its border-radius, or the
  // rx of an SVG rect; 0 for anything else
  function radii(e) {
    try {
      if (typeof HTMLElement !== 'undefined' && e instanceof HTMLElement) {
        const cs = getComputedStyle(e), b = e.getBoundingClientRect(), m = Math.min(b.width, b.height);
        return ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map((k) => {
          const v = String(cs[k] || '0').split(' ')[0], n = parseFloat(v);
          return !Number.isFinite(n) ? 0 : /%$/.test(v) ? (n / 100) * m : n;
        });
      }
      if (e && e.tagName === 'rect' && e.rx && e.rx.baseVal && e.getScreenCTM) {
        const k = e.rx.baseVal.value * Math.abs(e.getScreenCTM().a || 1);
        return [k, k, k, k];
      }
    } catch (x) { /* square */ }
    return [0, 0, 0, 0];
  }
  // the part of e that can be seen: its box (or the given box) cut by every scrolling or clipping ancestor (a side
  // panel that scrolls)
  function seenBox(e, box) {
    const r = box || e.getBoundingClientRect();
    let l = r.left, t = r.top, rr = r.right, b = r.bottom;
    // (a fixed box, such as a phone's tool row, is not clipped by the ancestors above it)
    let fx = getComputedStyle(e).position === 'fixed';
    // clip: the box the ancestors that clip and cannot scroll leave (null: none)
    let clip = null;
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (fx) break;
      const cs = getComputedStyle(a);
      fx = cs.position === 'fixed';
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      // a box that cannot clip: display: contents (the header's popover on a wide screen: auto overflow, a 0 × 0 box)
      if (cs.display === 'contents') continue;
      const q = a.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) continue;
      l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); b = Math.min(b, q.bottom);
      // (only a panel that cannot scroll: a scrolled panel is scrolled back by reveal, or by the user)
      if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY)) clip = clip ? { l: Math.max(clip.l, q.left), t: Math.max(clip.t, q.top), r: Math.min(clip.r, q.right), b: Math.min(clip.b, q.bottom) } : { l: q.left, t: q.top, r: q.right, b: q.bottom };
    }
    return { l, t, r: Math.max(l, rr), b: Math.max(t, b), full: r, clip };
  }
  // the viewport the tour draws in: the layout viewport less any classic scroll bar (what position: fixed fills)
  function vpSize() {
    const d = document.documentElement;
    return { w: (d && d.clientWidth) || innerWidth, h: (d && d.clientHeight) || innerHeight };
  }
  // Clipped away: a panel that cannot scroll leaves (almost) nothing of a part that would fit in it (a phone in
  // landscape squeezes the panes to a strip: the transport below them is cut to a 0 px line). A part bigger than its
  // panel is not clipped away: its visible part is what is lit. The viewport does not count (a scroll brings it in).
  function clippedAway(full, s) {
    if (!s.clip) return false;
    const c = s.clip, fw = full.right - full.left, fh = full.bottom - full.top;
    const w = Math.min(full.right, c.r) - Math.max(full.left, c.l), h = Math.min(full.bottom, c.b) - Math.max(full.top, c.t);
    if (fw <= 0 || fh <= 0) return false;
    if (w < Math.min(6, fw / 2) || h < Math.min(6, fh / 2)) return true;
    const big = fw > c.r - c.l + 1 || fh > c.b - c.t + 1;
    return !big && w * h < 0.25 * fw * fh;
  }
  // A part's lit rect: exactly its visible box (grown by pad, 0 unless a step asks), cut by the viewport, with its
  // corner radii; a corner on a cut edge is square. hidden: the part is clipped away.
  function partRect(p, pad) {
    const full = partBox(p), s = seenBox(p.el, full), vp = vpSize(), W = vp.w, H = vp.h;
    const l = Math.max(0, s.l - pad), t = Math.max(0, s.t - pad), rr = Math.min(W, s.r + pad), b = Math.min(H, s.b + pad);
    const cut = [t > full.top - pad + 0.5, rr < full.right + pad - 0.5, b < full.bottom + pad - 0.5, l > full.left - pad + 0.5];   // top, right, bottom, left
    const k = p.rect ? [0, 0, 0, 0] : radii(p.el);
    const rad = [cut[0] || cut[3] ? 0 : k[0], cut[0] || cut[1] ? 0 : k[1], cut[2] || cut[1] ? 0 : k[2], cut[2] || cut[3] ? 0 : k[3]].map((x) => (x > 0 ? x + pad : 0));
    return { l, t, r: Math.max(l, rr), b: Math.max(t, b), rad, hidden: clippedAway(full, s) };
  }
  // every part of an anchor is clipped away
  const tgtHidden = (tgt) => !!tgt && tgt.parts.every((q) => partRect(q, 0).hidden);

  // ---------------------------------------------------------------- styles
  const CSS = `
/* the spotlight's shade: the app's ink, a little deeper than the modal scrim so the lit patch reads at a glance */
:root { --tour-scrim: #121A2080; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --tour-scrim: #000000A3; } }
:root[data-theme="dark"] { --tour-scrim: #000000A3; }
/* two layers: the shade (z 25) sits under the app's own menus, palette and dialogs, so a layer the user opens is lit
   and usable; the rings and a phone's Why panel (.tour-top) sit above every app layer, in the top layer while the app
   has one open there (its More menu is a popover). The strip itself is in the page's layout, a hole of the shade */
.tour-root { position: fixed; inset: 0; z-index: 25; pointer-events: none; }
:root.ph .tour-root { z-index: 27; }   /* (v15: above the chain bar, 26; under the More sheet, 28, a layer) */
.tour-top, .tour-top[popover] { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; width: auto; height: auto; max-width: none; max-height: none; margin: 0; padding: 0; border: 0; background: transparent; overflow: visible; color: inherit; }
.tour-top::backdrop { background: transparent; pointer-events: none; }
.tour-dim { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.tour-dim .tour-shade { fill: var(--tour-scrim); pointer-events: visiblePainted; cursor: default; }
.tour-dim .tour-ring { fill: none; stroke: var(--accent); stroke-width: 1.5; pointer-events: none; }
.tour-dim .tour-glow { fill: none; stroke: var(--accent); stroke-opacity: 0.22; stroke-width: 7; pointer-events: none; }
.tour-dim .tour-mark { fill: none; stroke: var(--accent); stroke-width: 1.5; stroke-dasharray: 4 3; pointer-events: none; }
/* v15.1 (notes/tour/PHONE.md): on a phone the spotlight of a part inside a scrolling panel (a sheet, the chain) is
   drawn inside that panel, so the panel's own scroll moves it in the same frame as the content (no script follows) */
.tour-dim.tour-host { inset: auto; left: 0; top: 0; width: 1px; height: 1px; overflow: visible; z-index: 2147482000; pointer-events: none; }
/* (the rings fade while something they cannot follow natively moves: a fling of the page, a sliding layer) */
.tour-rings { transition: opacity 160ms linear; }
.tour-rings.moving { opacity: 0; transition: opacity 80ms linear; }
/* (r3 review user-1: once a task is done the spotlight steps aside, so the result can be looked at and touched; the
   next step brings it back) */
.tour-dim { transition: opacity 200ms linear; }
.tour-dim.tour-quiet, .tour-rings.tour-quiet { opacity: 0; transition: opacity 200ms linear; }
.tour-dim.tour-quiet .tour-shade { pointer-events: none; }
/* (v16.4: a lit control smaller than 48 x 48 px pulses its ring once when its step appears; the text is not beside it) */
.tour-rings g.pulse .tour-glow { animation: tour-ring-pulse 900ms var(--ease-out, ease-out) 1; }
@keyframes tour-ring-pulse { 40% { stroke-width: 14px; stroke-opacity: 0.45; } }
.tour-caret { position: absolute; width: 12px; height: 12px; background: var(--surface); border: 1px solid var(--line-strong); rotate: 45deg; }
/* ---- v16.4 (notes/tour-r3/SPEC.md 1): the docked strip, a row the layout makes room for. It covers nothing and never
   moves: the stage's first row on a tablet or a desktop (62 px, plus the step's body while Why is open), a 68 px row
   under a phone's header, or a landscape phone's header itself (48 px). The text block is the Why button. */
.tour-strip {
  position: relative; box-sizing: border-box; display: flex; flex-direction: column; width: 100%; height: 100%; min-width: 0; overflow: hidden;
  background: var(--surface); border: 1px solid var(--line); border-radius: 8px;
  color: var(--ink); font: var(--t-body); text-align: left; overflow-wrap: break-word;
}
/* (a desktop's slot holds the strip and the 8 px gap above the panes) */
#tourSlot:has(> .tour-strip[data-mode="desk"]) { padding-bottom: 8px; box-sizing: border-box; }
.tour-strip[data-mode="port"], .tour-strip[data-mode="row"] { border-width: 0 0 1px; border-radius: 0; }
.tour-strip[data-mode="head"] { border: 0; border-left: 1px solid var(--line); border-radius: 0; background: transparent; }
.ts-row { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; min-width: 0; height: 60px; padding: 0 8px; box-sizing: border-box; }
/* (#34 T1) a laptop's row is 52 px: Back, the title with its count ("5/10 ▾", the chapters' menu) over the task, then Skip or
   Next and ×. The text block is plain text there, so its two lines sit on the row's own grid beside the count */
.tour-strip[data-mode="desk"] .ts-row { display: grid; grid-template-columns: auto auto auto minmax(0, 1fr) auto auto auto; grid-template-rows: 18px 18px; align-content: center; column-gap: 8px; row-gap: 1px; height: 52px; padding: 0 8px 0 4px; }
.tour-strip[data-mode="desk"] .ts-text { display: contents; }
.tour-strip[data-mode="desk"] .ts-l1 { grid-column: 2; grid-row: 1; }
.tour-strip[data-mode="desk"] .ts-chap { grid-column: 3; grid-row: 1; margin-left: -4px; }
.tour-strip[data-mode="desk"] .ts-l2 { grid-column: 2 / 5; grid-row: 2; font: 400 13px/18px var(--f-ui); color: var(--ink); }
.tour-strip[data-mode="desk"] .ts-back { grid-column: 1; grid-row: 1 / 3; }
.tour-strip[data-mode="desk"] .ts-act { grid-column: 5; grid-row: 1 / 3; }
.tour-strip[data-mode="desk"] .ts-next { grid-column: 6; grid-row: 1 / 3; }
.tour-strip[data-mode="desk"] .ts-x { grid-column: 7; grid-row: 1 / 3; }
.tour-strip[data-mode="port"] .ts-row { height: 67px; padding: 0 8px 0 4px; }
.tour-strip[data-mode="port"] .ts-text { padding: 2px 6px; gap: 0; }
.tour-strip[data-mode="head"] .ts-row, .tour-strip[data-mode="row"] .ts-row { height: 47px; padding: 0 4px 0 8px; }
.ts-text {
  flex: 1 1 auto; min-width: 0; align-self: stretch; display: flex; flex-direction: column; justify-content: center; gap: 1px;
  margin: 0; padding: 4px 6px; background: none; border: 0; border-radius: var(--r-2, 4px); color: var(--ink); font: inherit; text-align: left; cursor: pointer;
}
.ts-text:hover { background: var(--well, transparent); }
.ts-text:focus-visible, .tour-strip button:focus-visible, .ts-why button:focus-visible, .ts-why input:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.ts-l1 { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.ts-title { flex: 0 1 auto; min-width: 0; margin: 0; font: 600 13px/18px var(--f-ui); color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.tour-strip[data-mode="desk"] .ts-count { display: none; }
.ts-chap { flex: 0 0 auto; align-self: center; display: inline-flex; align-items: center; gap: 3px; height: 24px; min-height: 24px; margin: 0; padding: 0 4px; border: 0; border-radius: var(--r-2, 4px); background: none; color: var(--muted); font: 500 12px/18px var(--f-ui); white-space: nowrap; cursor: pointer; }
.ts-chap:hover { color: var(--ink); background: var(--well, transparent); }
.ts-chap[hidden] { display: none; }
.ts-chap svg { width: 12px; height: 12px; }
.ts-chap[aria-expanded="true"] svg { rotate: 180deg; }
.ts-count { flex: 0 0 auto; font: 400 12px/18px var(--f-ui); color: var(--muted); white-space: nowrap; }
.ts-chev { display: none; flex: 0 0 auto; color: var(--accent); }
.ts-chev svg { width: 12px; height: 12px; vertical-align: -2px; transition: rotate var(--t-fast, 120ms) var(--ease-out, ease-out); }
.ts-text[aria-expanded="true"] .ts-chev svg, .ts-text[aria-expanded="true"] .ts-tdn svg { rotate: 180deg; }
/* a laptop's text block is plain text (the explanation went with Details); a phone's opens its sheet */
.ts-text.inert { cursor: default; pointer-events: none; }
.ts-tdn svg { width: 11px; height: 11px; vertical-align: -1px; color: var(--accent); transition: rotate var(--t-fast, 120ms) var(--ease-out, ease-out); }
.ts-l2 { display: flex; align-items: flex-start; gap: 6px; min-width: 0; font: 400 13px/17px var(--f-ui); color: var(--ink-2); }
.ts-lead { flex: 1 1 auto; min-width: 0; text-wrap: pretty; }
.ts-lead:has(mjx-container) { padding-bottom: 2px; } /* an inline formula (sized in ex) stands a pixel or two below the line: the lead's box holds it */
.ts-tin { display: none; font-weight: 600; color: var(--ink); }
.ts-lead mjx-container { font-size: 104% !important; color: var(--ink); }
.ts-ring { flex: 0 0 13px; width: 13px; height: 13px; margin-top: 2px; border-radius: 50%; border: 1.5px solid var(--accent); box-sizing: border-box; display: grid; place-items: center; }
.ts-ring[hidden] { display: none; }
.ts-ring svg { width: 9px; height: 9px; opacity: 0; transform: scale(0.6); transition: opacity var(--t-med, 200ms) var(--ease-out, ease-out), transform var(--t-med, 200ms) var(--ease-out, ease-out); }
.ts-l2.done .ts-ring { border-color: transparent; }
.ts-l2.done .ts-ring svg { opacity: 1; transform: none; width: 14px; height: 14px; color: var(--ok, #2d7a4b); stroke-width: 2.4; }
.ts-l2.caption .ts-ring { border-style: dotted; }
.ts-l2.pulse { animation: tour-nudge 320ms var(--ease-std, ease); }
@keyframes tour-nudge { 30% { translate: 0 -3px; } 60% { translate: 0 1px; } }
/* a phone: the title and the count above two lines of lead; a landscape phone: the title in bold at the lead's start */
.tour-strip[data-mode="head"] .ts-l1, .tour-strip[data-mode="row"] .ts-l1 { display: none; }
.tour-strip[data-mode="head"] .ts-tin, .tour-strip[data-mode="row"] .ts-tin { display: inline; }
.tour-strip[data-mode="head"] .ts-l2, .tour-strip[data-mode="row"] .ts-l2 { font: 400 13px/16px var(--f-ui); color: var(--ink); }
.tour-strip[data-mode="head"] .ts-text, .tour-strip[data-mode="row"] .ts-text { padding: 2px 4px; }
/* (r3 review user-7: a phone's text block shows that it opens: a chevron after the count) */
.tour-strip[data-mode="port"] .ts-chev { display: inline; }
/* (v16.5 UX93: the count and its chevron closer, so «Добро пожаловать» is whole on a 360 px phone) */
.tour-strip[data-mode="port"] .ts-l1 { gap: 6px; }
.tour-strip[data-mode="port"] .ts-chev { margin-left: -3px; }
/* (r3 review user-3, user-10: a chapter whose line needs three lines here gets a taller row) */
.tour-strip[data-mode="port"][data-lines="3"] .ts-row { height: 75px; }
.tour-strip[data-mode="row"][data-lines="3"] .ts-row { height: 55px; }
/* (#553) four lines of lead, where a long language at 360 px needs them: a line (17 px, 16 in the landscape row) more */
.tour-strip[data-mode="port"][data-lines="4"] .ts-row { height: 92px; }
.tour-strip[data-mode="row"][data-lines="4"] .ts-row { height: 71px; }
/* the buttons: 32 px with a mouse, 44 px on a touch screen or a phone, 8 px apart */
.tour-strip .ts-btn { flex: 0 0 auto; width: 32px; height: 32px; min-width: 32px; min-height: 32px; }
.tour-strip .ts-btn[hidden], .tour-strip .ts-act[hidden] { display: none !important; }
.tour-strip .ts-act { flex: 0 0 auto; height: 32px; min-height: 32px; min-width: 32px; padding: 0 12px; gap: 6px; white-space: nowrap; }
.tour-strip .ts-act svg { width: 14px; height: 14px; flex: 0 0 14px; }
.tour-strip .ts-next { flex: 0 0 auto; position: relative; isolation: isolate; overflow: hidden; height: 32px; min-height: 32px; min-width: 64px; max-width: 220px; padding: 0 14px; white-space: nowrap; text-overflow: ellipsis; }
.tour-strip .ts-next { transition: none; }  /* Skip and Next swap in place; no fade between their two looks */
.tour-strip .ts-next.ready { box-shadow: inset 0 0 0 2px var(--accent-ink); }
/* (#34 T1) Next is earned: while the step's task is open the button is a quiet outlined Skip */
/* (Skip keeps its outlined look under :hover and :active, which the shared .btn.primary rules would fill with the accent: on a touch screen :hover stays on the button just tapped, which was Next a step ago; only a mouse gets the hover shade) */
.tour-strip .ts-next.skip, .tour-strip .ts-next.skip:not(:disabled):hover, .tour-strip .ts-next.skip:not(:disabled):active { background: var(--surface); color: var(--muted); border: 1px solid var(--line-strong); }
@media (hover: hover) { .tour-strip .ts-next.skip:not(:disabled):hover { color: var(--ink); background: var(--well, var(--surface)); } }
/* (r3 verify-1: while the countdown runs, the ring leaves out its bottom edge; the bar below is that edge, filling in) */
.tour-strip .ts-next.ready.counting { box-shadow: inset 0 2px var(--accent-ink), inset 2px 0 var(--accent-ink), inset -2px 0 var(--accent-ink); }
/* the countdown (r3 review user-4): a bar along Next's bottom edge in Next's own label colour, so it stands off the
   button as the label does, growing from left to right over the countdown (CD_MS); restarted with the countdown, frozen while held */
.tour-strip .ts-next::before { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; z-index: -1; background: var(--accent-ink); transform-origin: 0 50%; transform: scaleX(0); }
.tour-strip .ts-next svg { width: 18px; height: 18px; display: block; }
.tour-strip .ts-ncount { font: 600 15px/1 var(--f-ui); }
.tour-strip .ts-next.counting::before { animation: tour-fill var(--tour-cd, 1500ms) linear forwards; }
.tour-strip .ts-next.counting.held::before { animation-play-state: paused; }
@keyframes tour-fill { to { transform: scaleX(1); } }
@media (pointer: coarse) {
  .tour-strip .ts-btn { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
  .tour-strip .ts-act, .tour-strip .ts-next { height: 44px; min-height: 44px; }
  .tour-strip .ts-act { min-width: 44px; }
  .tour-strip .ts-next::before { height: 4px; }
}
.tour-strip:not([data-mode="desk"]) .ts-btn { width: 44px; height: 44px; min-width: 44px; min-height: 44px; }
.tour-strip:not([data-mode="desk"]) .ts-next { width: 44px; height: 44px; min-width: 44px; max-width: 44px; min-height: 44px; padding: 0; display: inline-grid; place-items: center; }
.tour-strip:not([data-mode="desk"]) .ts-next::before { height: 4px; }
.tour-strip:not([data-mode="desk"]) .ts-act { width: 44px; height: 44px; min-width: 44px; padding: 0; justify-content: center; }
.tour-strip:not([data-mode="desk"]) .ts-act > span { display: none; }
/* (r3 review user-7, verify-2: × stays in a phone's portrait row and in the landscape row under the header; in the
   header it shows when the header has 52 px more than the strip needs (.ts-xok), else it is in Why) */
.tour-strip[data-mode="head"]:not(.ts-xok) .ts-x { display: none; }
.tour-strip[data-mode="head"] .ts-back, .tour-strip[data-mode="row"] .ts-back { display: none; }
/* (r3 review user-3: in a phone's portrait row the act button takes Back's place, which is in Why, so the line keeps
   its width while the Grieg captions play) */
.tour-strip[data-mode="port"].has-act .ts-back { display: none; }
/* Why: the step's body. Inline under the row on a tablet or a desktop (the strip grows; the panes shrink); on a phone a
   panel that hangs under the strip, over X, at most half the screen, opened only by a tap */
.ts-why { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; box-sizing: border-box; padding: 0 16px 10px 58px; font: 400 13px/19px var(--f-ui); color: var(--ink-2); }
.ts-why[hidden] { display: none; }
.ts-why .ts-foot { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-top: 8px; }
.ts-why .ts-auto { display: inline-flex; align-items: center; gap: 6px; min-height: 28px; font: 400 12px/16px var(--f-ui); color: var(--ink-2); cursor: pointer; }
.ts-why .ts-auto input { margin: 0; width: 16px; height: 16px; accent-color: var(--accent); }
.ts-why .ts-wend { display: none; }
.tour-top .ts-why.ts-panel {
  position: fixed; left: 0; right: 0; top: 0; max-height: 50vh; max-height: 50dvh; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--surface); border-bottom: 1px solid var(--line-strong); box-shadow: var(--shadow-3); pointer-events: auto;
  font-size: 13px; line-height: 20px;
}
.tour-top .ts-why.ts-panel .ts-wend { display: flex; gap: 8px; }
.tour-top .ts-why.ts-panel .ts-wend .btn { min-height: 44px; padding: 0 14px; }
.tour-top .ts-why.ts-panel .ts-auto { min-height: 44px; font-size: 13px; }
.tour-top .ts-why.ts-panel .ts-auto input { width: 20px; height: 20px; }
.tour-top .ts-why.ts-panel .ts-wtitle { display: block; margin: 0 0 4px; font: 600 15px/20px var(--f-ui); color: var(--ink); }
.ts-wtitle { display: none; }
.tour-sr { position: absolute; top: 0; left: 0; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
/* (v16.5 UX21) the learning lane: one line in the tour's docked slot (the first-run invitation, an example's Try
   line). It sits in the layout like the strip and covers nothing: a 48 px row at the stage's top on a desktop (plus the
   8 px gap), a 56 px row under a phone's header, a landscape phone's header when it has room */
.tour-lane {
  position: relative; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; height: 100%; min-width: 0; padding: 0 6px 0 10px;
  background: var(--surface); border: 1px solid var(--line-strong); border-radius: var(--r-3, 4px); color: var(--ink); font: var(--t-body);
  animation: fade-in var(--t-med, 200ms) var(--ease-out, ease-out);
}
#tourSlot:has(> .tour-lane[data-mode="desk"]) { padding-bottom: 8px; box-sizing: border-box; }
.tour-lane[data-mode="port"], .tour-lane[data-mode="row"] { border-width: 0 0 1px; border-radius: 0; padding: 0 4px 0 8px; gap: 8px; }
.tour-lane[data-mode="head"] { border: 0; border-left: 1px solid var(--line); border-radius: 0; background: transparent; padding: 0 2px 0 8px; gap: 6px; }
:root.ph.ph-land .stage > #tourSlot > .tour-lane[data-mode="row"] { position: fixed; left: 0; right: 0; top: calc(env(safe-area-inset-top, 0px) + var(--ph-head)); width: auto; height: var(--ph-tour, 48px); }
.tl-mark { flex: 0 0 24px; width: 24px; height: 24px; }
.tl-mark svg { width: 24px; height: 24px; display: block; }
.tour-lane:not([data-mode="desk"]) .tl-mark { display: none; }
.tl-text { flex: 1 1 auto; min-width: 0; margin: 0; font: 400 13px/17px var(--f-ui); color: var(--ink-2); display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; text-wrap: pretty; }
.tour-lane.grow .tl-text { -webkit-line-clamp: 4; line-clamp: 4; }
.tour-lane[data-mode="desk"]:not(.two) .tl-text { -webkit-line-clamp: 1; line-clamp: 1; display: block; white-space: nowrap; text-overflow: ellipsis; }
.tl-title { font-weight: 600; color: var(--ink); }
.tl-acts { flex: 0 0 auto; display: flex; align-items: center; gap: 6px; }
.tour-lane .tl-act { height: 32px; min-height: 32px; padding: 0 12px; white-space: nowrap; }
.tour-lane .tl-x { width: 32px; height: 32px; }
.tour-lane .tl-short { display: none; }
@media (pointer: coarse) { .tour-lane .tl-act { height: 44px; min-height: 44px; } .tour-lane .tl-x { width: 44px; height: 44px; } }
.tour-lane:not([data-mode="desk"]) .tl-act { height: 44px; min-height: 44px; padding: 0 10px; }
.tour-lane:not([data-mode="desk"]) .tl-x { width: 44px; height: 44px; }
.tour-lane:not([data-mode="desk"]) .tl-long { display: none; }
.tour-lane:not([data-mode="desk"]) .tl-short { display: inline; }
.tour-lane .tl-text mjx-container { color: var(--ink); }
/* the help menu (the app's menu component, plus a chapter row) */
.pop.menu.tour-menu { min-width: 264px; }
.tour-menu .mi { gap: 10px; }
.tour-menu .tour-num { flex: 0 0 16px; font: var(--t-readout); color: var(--faint); text-align: right; }
.tour-menu .tour-time { font: 400 11px/16px var(--f-mono); color: var(--faint); }
.tour-menu .tour-done { flex: 0 0 14px; width: 14px; height: 14px; color: var(--good); }
.tour-menu .tour-done svg { width: 14px; height: 14px; display: block; }
.tour-menu .tour-new { font: var(--t-caption); font-stretch: var(--ui-narrow-stretch); font-variation-settings: var(--ui-narrow-var); color: var(--accent); }
.tour-menu .mi.tour-continue { height: auto; min-height: 40px; padding-top: 4px; padding-bottom: 4px; white-space: normal; }
.tour-menu .tour-sub { display: block; font: 400 11px/16px var(--f-ui); color: var(--muted); }
@media (prefers-reduced-motion: reduce) { .ts-ring svg, .ts-chev svg, .ts-tdn svg, .tour-dim, .tour-dim.tour-quiet { transition: none; } .ts-l2.pulse, .tour-lane, .tour-rings g.pulse .tour-glow, .tour-strip .ts-next.counting::before { animation: none; } .tour-strip .ts-next::before { display: none; } }
`;
  // a polite announcement outside the tour (the suggestion): one shared live region
  function say(text) {
    let n = document.getElementById('tourSay');
    if (!n) { n = el('div', { id: 'tourSay', class: 'tour-sr', 'aria-live': 'polite', 'aria-atomic': 'true' }); document.body.append(n); }
    n.textContent = '';
    setTimeout(() => { n.textContent = text; }, 60);
  }
  function injectCSS() {
    if (document.getElementById('tourCSS')) return;
    document.head.append(el('style', { id: 'tourCSS' }, CSS));
  }
  // a laptop's keyboard steps the tour (→ forward, ← back): the strip shows the key; a touch screen has none to show
  const keyHints = () => { try { return !matchMedia('(pointer: coarse)').matches; } catch (e) { return true; } };
  const ICON_X = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>';
  const ICON_LEFT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4l-4 4 4 4"/></svg>';
  const ICON_DOWN = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>';
  const ICON_RIGHT = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><path d="M5 3.5v9l7.5-4.5z"/></svg>';
  const ICON_STOP = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor"><rect x="4" y="4" width="8" height="8" rx="1"/></svg>';
  const ICON_SOUND = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6h2.5l3.5-3v10l-3.5-3h-2.5z"/><path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4"/></svg>';
  const ICON_BOOK = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 3.5c2-.8 3.8-.6 5.5.7v9c-1.7-1.3-3.5-1.5-5.5-.7zM13.5 3.5c-2-.8-3.8-.6-5.5.7v9c1.7-1.3 3.5-1.5 5.5-.7z"/></svg>';
  const ICON_KEYS = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="4" width="13" height="8.5" rx="1.5"/><path d="M4 7h.01M6.5 7h.01M9 7h.01M11.5 7h.01M5 10h6"/></svg>';
  const mark = () => {
    const m = document.querySelector('header svg.mark');
    return m ? `<svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">${m.innerHTML}</svg>` : '';
  };

  // ---------------------------------------------------------------- spotlight
  // Two SVGs. The shade (in .tour-root, under the app's own layers): a full-screen fill with a hole per lit area
  // (even-odd), so clicks on the shade stop and clicks in a hole reach the app. The rings (in .tour-top, above every
  // layer): a 1.5px accent ring and a soft glow just outside each hole, and a dashed ring just outside an anchor that
  // sits inside a lit panel; they are masked out of any open layer, so they never draw over what the user opened. A
  // hole is exactly the lit element's visible border box, with its corner radii; holes animate in JS between steps
  // (CSS cannot animate a path in every browser), towards the target as it is measured in each frame.
  const radOf = (h) => (Array.isArray(h.rad) ? h.rad : [0, 1, 2, 3].map(() => h.rad || 0));
  function rrPath(h) {
    const w = h.r - h.l, ht = h.b - h.t, m = Math.max(0, Math.min(w / 2, ht / 2));
    const [a, b, c, d] = radOf(h).map((x) => Math.max(0, Math.min(x, m)));
    return `M${h.l + a} ${h.t}H${h.r - b}A${b} ${b} 0 0 1 ${h.r} ${h.t + b}V${h.b - c}A${c} ${c} 0 0 1 ${h.r - c} ${h.b}H${h.l + d}A${d} ${d} 0 0 1 ${h.l} ${h.b - d}V${h.t + a}A${a} ${a} 0 0 1 ${h.l + a} ${h.t}Z`;
  }
  // a rect grown by e, its radii with it (a ring drawn just outside a hole)
  const grow = (h, e) => ({ l: h.l - e, t: h.t - e, r: h.r + e, b: h.b + e, rad: radOf(h).map((x) => x + e) });
  // (each SVG's viewBox is its own client box, so one unit is one CSS px at the same place: a classic scroll bar
  // narrows the fixed roots, never the drawing's scale)
  const boxOf = (g) => { const b = g.getBoundingClientRect(); return b.width > 0 && b.height > 0 ? b : Object.assign({ left: 0, top: 0 }, vpSize(), { width: vpSize().w, height: vpSize().h }); };
  // (wins: windows over the panels a phone's spotlight is drawn inside: open in the shade, with no ring)
  function drawHoles(ui, holes, mark, layers, wins) {
    const sb = boxOf(ui.svg), rb = boxOf(ui.rsvg);
    const X = sb.left, Y = sb.top, W = sb.width, H = sb.height;
    ui.svg.setAttribute('viewBox', `${X} ${Y} ${W} ${H}`);
    ui.rsvg.setAttribute('viewBox', `${rb.left} ${rb.top} ${rb.width} ${rb.height}`);
    ui.shade.setAttribute('d', `M${X} ${Y}H${X + W}V${Y + H}H${X}Z` + holes.map(rrPath).join('') + (wins || []).map(rrPath).join(''));
    ui.ring.setAttribute('d', holes.map((h) => rrPath(grow(h, 0.75))).join(''));
    ui.glow.setAttribute('d', holes.map((h) => rrPath(grow(h, 3.5))).join(''));
    // (mark: the anchor's own ring, or a list: the anchor's and the insets')
    if (mark !== undefined) ui.mark.setAttribute('d', [].concat(mark || []).map((m) => rrPath(grow(m, 0.75))).join(''));
    if (layers !== undefined) {
      for (const [k, v] of [['x', rb.left], ['y', rb.top], ['width', rb.width], ['height', rb.height]]) { ui.maskRect.setAttribute(k, v); ui.maskEl.setAttribute(k, v); }
      ui.maskHoles.setAttribute('d', (layers || []).map((h) => rrPath(grow(h, 2))).join(''));
    }
    ui.holes = holes;
  }
  const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  // the holes drawn u of the way from `from` to `to` (pairs morph; a hole without a partner grows from, or into, the
  // first partner's rectangle)
  function between(from, to, u) {
    const lerp = (a, b) => a + (b - a) * u;
    if (!from.length || !to.length) return to;
    const n = Math.max(from.length, to.length), out = [];
    for (let i = 0; i < n; i++) {
      const a = from[i] || from[0], b = to[i] || to[0], ra = radOf(a), rb = radOf(b);
      out.push({ l: lerp(a.l, b.l), t: lerp(a.t, b.t), r: lerp(a.r, b.r), b: lerp(a.b, b.b), rad: ra.map((x, j) => lerp(x, rb[j])) });
    }
    return out;
  }

  let maskN = 0;
  function buildUI() {
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); return p; };
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'tour-dim'); svg.setAttribute('aria-hidden', 'true');
    const shade = mk('tour-shade');
    shade.setAttribute('fill-rule', 'evenodd');
    svg.append(shade);
    // the rings, masked out of the open layers
    const rsvg = document.createElementNS(NS, 'svg');
    rsvg.setAttribute('class', 'tour-dim tour-rings'); rsvg.setAttribute('aria-hidden', 'true');
    const id = 'tourRingMask' + (++maskN);
    const defs = document.createElementNS(NS, 'defs'), maskEl = document.createElementNS(NS, 'mask'), maskRect = document.createElementNS(NS, 'rect'), maskHoles = document.createElementNS(NS, 'path');
    maskEl.setAttribute('id', id); maskEl.setAttribute('maskUnits', 'userSpaceOnUse'); maskEl.setAttribute('maskContentUnits', 'userSpaceOnUse');
    maskRect.setAttribute('fill', '#fff'); maskRect.setAttribute('x', '0'); maskRect.setAttribute('y', '0');
    maskHoles.setAttribute('fill', '#000');
    maskEl.append(maskRect, maskHoles); defs.append(maskEl);
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('mask', `url(#${id})`);
    const glow = mk('tour-glow'), ring = mk('tour-ring'), markP = mk('tour-mark');
    g.append(glow, ring, markP);
    rsvg.append(defs, g);
    const live = el('div', { class: 'tour-sr', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const root = el('div', { class: 'tour-root', 'data-tour': 'root' }, svg);
    const top = el('div', { class: 'tour-top', 'data-tour': 'top' }, rsvg, live);
    // the strip (notes/tour-r3/SPEC.md 1.1). Row: Back, the text block (the title, the chapter's count, Why, and
    // the lead line: a caption, the result, the task or the lead), the act button, Next, × End; under it, Why
    const back = el('button', { class: 'icon-btn ts-btn ts-back', type: 'button', 'aria-label': $t('Back'), title: $t('Back') + (keyHints() ? '  ←' : '') });
    back.innerHTML = ICON_LEFT;
    const title = el('span', { class: 'ts-title', id: 'tourTitle' });
    const count = el('span', { class: 'ts-count' });
    const ringI = el('span', { class: 'ts-ring', 'aria-hidden': 'true', hidden: true });
    ringI.innerHTML = ICON_CHECK;
    const tin = el('span', { class: 'ts-tin', 'aria-hidden': 'true' });
    const lead = el('span', { id: 'tourLead' });
    const l2 = el('span', { class: 'ts-l2' }, ringI, el('span', { class: 'ts-lead' }, tin, lead));
    const chev = el('span', { class: 'ts-chev', 'aria-hidden': 'true' });
    chev.insertAdjacentHTML('beforeend', ICON_DOWN);
    const text = el('button', { class: 'ts-text', type: 'button', 'aria-describedby': 'tourTitle tourLead' },
      el('span', { class: 'ts-l1' }, title, count, chev), l2);
    // the chapter menu: on a wide strip the chapter and its count are a button that lists the chapters (done ones checked)
    const chap = el('button', { class: 'ts-chap', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', hidden: true }, el('span', { class: 'ts-chapl' }));
    chap.insertAdjacentHTML('beforeend', ICON_DOWN);
    chap.addEventListener('click', () => openHelpMenu(chap, 'chapters'));
    const act = el('button', { class: 'btn ts-act', type: 'button', hidden: true });
    const next = el('button', { class: 'btn primary ts-next', type: 'button' }, $t('Next'));
    const x = el('button', { class: 'icon-btn ts-btn ts-x', type: 'button', 'aria-label': $t('End the tour'), title: $t('End the tour') + '  Esc' });
    x.innerHTML = ICON_X;
    // (Move on by itself is in the chapter menu on a laptop, and in the sheet below on a phone)
    const row = el('div', { class: 'ts-row' }, back, text, chap, act, next, x);
    // the phone's sheet (a panel in the tour's top layer): the step's title, Move on by itself, Back and × End the tour,
    // which the narrow row has no room for
    const wtitle = el('span', { class: 'ts-wtitle', 'aria-hidden': 'true' });
    const autoC = el('input', { type: 'checkbox' });
    const autoL = el('label', { class: 'ts-auto' }, autoC, el('span', null, $t('Move on by itself')));
    const wBack = el('button', { class: 'btn ghost', type: 'button' }, $t('Back'));
    const wEnd = el('button', { class: 'btn ghost', type: 'button' }, $t('End the tour'));
    const wend = el('span', { class: 'ts-wend' }, wBack, wEnd);
    const why = el('div', { class: 'ts-why', id: 'tourWhy', hidden: true, 'data-tour': 'why' }, wtitle, el('div', { class: 'ts-foot' }, autoL, wend));
    const strip = el('section', { class: 'tour-strip', role: 'region', 'aria-label': $t('Guided tour'), 'data-tour': 'strip' }, row, why);
    // the safe-area insets, read from a probe (env() has no script API)
    const safeP = el('div', { 'aria-hidden': 'true', style: 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)' });
    top.append(safeP);
    document.body.append(root, top);
    return { root, top, svg, rsvg, ringG: g, shade, glow, ring, mark: markP, maskEl, maskRect, maskHoles, live, strip, row, back, text, chap, title, count, l2, ringI, tin, lead, act, next, x, why, wtitle, autoC, wBack, wEnd, safeP,
      holes: null, raf: 0, anim: null, motion: 0, topSet: [], hosts: new Map(), hostOk: new Map(), work: [], moveT: 0, mode: null, whyOpen: false };
  }

  // ---------------------------------------------------------------- the app's layers
  // What the user can open over the app: its popovers (#popHost: the palette, menus, the integral popover, the
  // coordinate pad, the options sheet), a dialog (.modal-bg's box), the sound settings, anything in the top layer
  // (the header's More menu is a popover). api.layers() may list them instead (elements). The callout never covers
  // them, and the rings are masked out of them.
  const LAYER_SEL = '#popHost > *, .modal-bg > *, .snd-pop:not([hidden]), dialog[open]';
  function layerEls() {
    let els = null;
    try { if (fn('layers')) els = api.layers(); } catch (e) { els = null; }
    if (!els || typeof els.length !== 'number') {
      els = [...document.querySelectorAll(LAYER_SEL)];
      try { els.push(...document.querySelectorAll(':popover-open')); } catch (e) { /* no popover API */ }
    }
    // (a layer that holds the step's own anchor, a phone's sheet or a drawer the step opened, is part of the step:
    // it is lit, not kept clear, and its rings are not masked off)
    const lit = run && run.el && run.el.isConnected ? run.el : null;
    return [...els].filter((e) => e && e.closest && !e.closest('[data-tour="root"], [data-tour="top"]') && visible(e) && !(lit && e.contains(lit)));
  }
  function appLayers() {
    return layerEls().map((e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, rad: radii(e) }; });
  }
  // The callout's layer joins the top layer (as a manual popover) while the app has something there, shown after it
  // so it stays above; it leaves when the app's top layer is empty. (Only then: the app's layerOpen() counts open
  // popovers, and a tour always in the top layer would read as a layer that never closes.)
  function topLayerApp() {
    try { return [...document.querySelectorAll(':popover-open, dialog:modal')].filter((e) => !e.closest('[data-tour]')); } catch (e) { return []; }
  }
  function syncTop(ui) {
    const top = ui && ui.top;
    if (!top || !top.isConnected || typeof top.showPopover !== 'function') return;
    const now = topLayerApp();
    let isOpen = false;
    try { isOpen = top.matches(':popover-open'); } catch (e) { isOpen = false; }
    const added = now.some((e) => !ui.topSet.includes(e));
    ui.topSet = now;
    if (now.length ? isOpen && !added : !isOpen) return;
    const a = /** @type {HTMLElement | null} */ (document.activeElement);
    try {
      if (now.length) {
        if (!top.hasAttribute('popover')) top.setAttribute('popover', 'manual');
        if (isOpen) top.hidePopover();
        top.showPopover();
      } else {
        top.hidePopover();
        top.removeAttribute('popover');
      }
    } catch (e) { warn('top layer', e); }
    if (a && a !== document.activeElement && top.contains(a)) { try { a.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }

