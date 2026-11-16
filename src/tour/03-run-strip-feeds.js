  // ---------------------------------------------------------------- the run
  function chapterIndex(id) { const i = CHAPTERS.findIndex((c) => c.id === id); return i < 0 ? 0 : i; }

  // The user's work while the tour borrows the canvas (INTEGRATION.md §3). The tour changes the scene only when it can
  // put the work back: snapshot, restore and loadScene exist, snapshot() gave a value, and the saved copy on disk is
  // safe, either because the app paused its autosave (api.sandbox(true)) or because the backup stash was written and
  // read back. Otherwise it runs without scenes: only the steps that change nothing are shown.
  const fn = (k) => typeof api[k] === 'function';
  function borrow() {
    if (!(fn('snapshot') && fn('restore') && fn('loadScene'))) { warn('no scenes', 'snapshot, restore and loadScene are required to show the tour\'s scenes'); return null; }
    let paused = false;
    if (fn('sandbox')) { try { paused = api.sandbox(true) !== false; } catch (e) { warn('sandbox', e); } }
    let snap = null;
    try { snap = api.snapshot(); } catch (e) { warn('snapshot', e); snap = null; }
    if (snap == null) { if (paused) call('sandbox', false); warn('no scenes', 'snapshot() gave nothing'); return null; }
    const stashed = writeStash(snap, paused);
    if (!paused && !stashed) { warn('no scenes', 'the autosave is not paused and the backup could not be stored'); return null; }
    return { snap, paused, stashed };
  }
  // the backup: only the persisted part of the snapshot (snap.state when it has one: the undo history stays in memory),
  // checked by reading it back. Its heartbeat (LIVE) tells other pages that this one is using it
  const stashOf = (snap) => (snap && typeof snap === 'object' && 'state' in snap ? { state: snap.state } : snap);
  // (paused: the app's autosave is held, so the saved copy is the user's work, as savedMark() fingerprints it)
  function writeStash(snap, paused) {
    let mark = null;
    try { mark = fn('savedMark') ? api.savedMark() : null; } catch (e) { mark = null; }
    try {
      const v = JSON.stringify({ page: PAGE, snap: stashOf(snap), paused: !!paused, mark });
      localStorage.setItem(sk(STASH), v);
      if (localStorage.getItem(sk(STASH)) !== v) return false;
      beat();
      return true;
    } catch (e) { warn('stash', e); try { localStorage.removeItem(sk(STASH)); } catch (x) { /* */ } return false; }
  }
  function beat() { try { localStorage.setItem(sk(LIVE), JSON.stringify({ page: PAGE, t: Date.now() })); } catch (e) { /* */ } }
  // this page is going away (a reload, a closed tab): its heartbeat goes with it, so the next page recovers at once
  function unbeat() {
    try { const live = JSON.parse(localStorage.getItem(sk(LIVE)) || 'null'); if (live && live.page === PAGE) localStorage.removeItem(sk(LIVE)); } catch (e) { /* */ }
  }
  function liveElsewhere() {
    try { const live = JSON.parse(localStorage.getItem(sk(LIVE)) || 'null'); return !!(live && live.page !== PAGE && Date.now() - live.t < BEAT_STALE); } catch (e) { return false; }
  }
  function dropStash() { try { localStorage.removeItem(sk(STASH)); localStorage.removeItem(sk(LIVE)); } catch (e) { /* */ } }

  // Synchronous up to the new run (a second start in the same tick finds it and takes it over, never a fresh snapshot
  // of the tour's own scene); the only wait is the first step.
  function start(opt = {}) {
    if (!doc()) return Promise.resolve(false);
    if (!inited) init(api);
    // a "Your work is back" toast from the tour that just ended would sit over this one's controls
    if (lastToast && lastToast.isConnected) lastToast.remove();
    lastToast = null;
    hideSuggest(false);
    laneHide(null, false);
    closeMenu(false);
    const ci = chapterIndex(opt.chapter);
    // a chapter started from inside a running tour (its help step lights the help button): the snapshot taken when the
    // first tour began stays, and the app is not told that the tour ended and began again
    let lend = null, opener = opt.opener || null;
    const prev = run;
    if (prev) { lend = prev.lend; opener = opener || prev.opener; stop({ silent: true, keepWork: true }); }
    else lend = borrow();
    if (!opener) opener = document.activeElement !== document.body ? document.activeElement : null;
    const r = { ci, si: 0, lend, snap: lend ? lend.snap : null, scenes: !!lend, scene: undefined, sceneOk: {}, seq: 0, opener, offs: [], tryOffs: [], skipped: new Set(), why: new Map(), absent: new Set(), ui: null, el: null, step: null, dir: 1, timer: 0, tracked: null,
      doneTasks: new Set(), cd: cdInit(), cdT: 0, capT: [], caption: null, done: false };
    // steps on a feature this build does not have (api.has), or that need a scene the tour cannot borrow, are left out
    // from the start, so the count is right
    CHAPTERS.forEach((c, i) => c.steps.forEach((st, j) => { if (absent(i, j, r.scenes)) r.absent.add(skipKey(i, j)); }));
    const first = seek(ci, Math.min(Math.max(0, opt.step | 0), CHAPTERS[ci].steps.length - 1), 1, (a, b) => r.absent.has(skipKey(a, b)));
    if (!first || first.ci !== ci) {
      // nothing of this chapter can be shown here
      if (lend) giveBack(lend, true);
      if (prev) call('onTour', false);
      call('toast', $t('The tour is not available in this build.'));
      return Promise.resolve(false);
    }
    r.si = first.si;
    rec.outcome = 'taken';
    rec.v = Math.max(rec.v, VERSION);
    save();
    injectCSS();
    r.ui = buildUI();
    // (the root's style attribute from before the tour, so its end leaves none it did not find;
    // a chapter started inside a running tour keeps the first run's)
    r.rootStyle = prev ? prev.rootStyle : document.documentElement.getAttribute('style');
    run = r;
    // (the strip is mounted and sized before the first scene loads, which fits its view to the panes' size; the
    // phone's sheet starts folded)
    r.ui.whyOpen = false;
    r.ui.why.hidden = true;
    mountStrip(r);
    sizeDesk(r);
    wire(r);
    if (!prev) call('onTour', true);
    return show(r.ci, r.si, 1).then(() => true);
  }
  // the user's work back; true when it is (or nothing was borrowed). A failed restore keeps the autosave paused and the
  // backup stash, so the saved copy stays the user's and a reload brings it back
  function giveBack(lend, quiet) {
    if (!lend) return true;
    let ok = false;
    try { ok = api.restore(lend.snap) !== false; } catch (e) { warn('restore', e); ok = false; }
    if (!ok) { if (!quiet) warn('restore', 'the user\'s work could not be put back; the backup is kept'); return false; }
    if (lend.paused) call('sandbox', false);
    dropStash();
    return true;
  }

  function wire(r) {
    const ui = r.ui;
    const inStrip = (t) => !!t && t.nodeType === 1 && (ui.strip.contains(t) || ui.why.contains(t));
    ui.next.addEventListener('click', () => { if (run === r) go(1); });
    // (Back during the countdown cancels it; the step it reaches does not move on by itself)
    const back = () => { if (run !== r) return; cdFeed(r, { type: 'cancel' }); go(-1); };
    ui.back.addEventListener('click', back);
    ui.wBack.addEventListener('click', back);
    const end = () => { if (run === r) stop({ finished: lastOfChapter(r) }); };
    ui.x.addEventListener('click', end);
    ui.wEnd.addEventListener('click', end);
    // a press on the text block opens or closes Why, and cancels this showing's countdown (the user is reading)
    // (a tap that closes an open layer, the function list say, does nothing else: it neither opens Details
    // nor stops the countdown)
    const openLayers = () => { try { return [...document.querySelectorAll('#popHost > .pop, .modal-bg, .ph-sheet:not([hidden]), [popover]:popover-open:not([data-tour])')]; } catch (e) { return []; } };
    const onDownL = () => { ui.downLayers = openLayers(); ui.downT = performance.now(); };
    document.addEventListener('pointerdown', onDownL, true);
    r.offs.push(() => document.removeEventListener('pointerdown', onDownL, true));
    const closedByTap = () => { const was = ui.downLayers || [], now = openLayers(); ui.downLayers = null; return performance.now() - (ui.downT || 0) < 1500 && was.some((x) => !now.includes(x)); };
    ui.text.addEventListener('click', () => { if (run !== r || !ui.whyPanel) return; if (closedByTap()) return; cdFeed(r, { type: 'cancel' }); setWhy(r, !ui.whyOpen); });
    ui.act.addEventListener('click', () => { if (run === r) actPress(r); });
    ui.autoC.addEventListener('change', () => { if (run === r) setAuto(ui.autoC.checked); });
    ui.shade.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); nudge(); });
    const onKey = (e) => {
      if (run !== r || e === fwdKey) return;
      const a = /** @type {HTMLInputElement | null} */ (document.activeElement), inS = inStrip(a);
      const idle = a === document.body || a == null || inS;
      if (e.key === 'Escape') {
        // The app's own layer comes first, wherever the focus is: a menu, the palette or a dialog closes and the tour
        // stays. Then Escape in the strip ends the tour. Elsewhere the app's own Escape comes first: a field being
        // typed in, and whatever the app reports busy (a drawing, a drag, a selection, an open drawer, a Listen along).
        // Only when the app has nothing to cancel does Escape end the tour; a phone's open Why panel folds first
        if (appLayerOpen()) { if (inS) escToLayer(e); return; }
        if (ui.whyOpen && ui.whyPanel) { e.preventDefault(); e.stopPropagation(); setWhy(r, false); return; }
        if (!inS) {
          if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
          if (appBusy()) return;
        }
        e.preventDefault(); e.stopPropagation(); stop({}); return;
      }
      // arrows step the tour when the focus is in the strip or nowhere (Enter stays the app's: it closes a polygon)
      if (!idle || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (a && a.tagName === 'INPUT' && a.type !== 'checkbox') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); cdFeed(r, { type: 'cancel' }); go(-1); }
    };
    document.addEventListener('keydown', onKey, true);
    r.offs.push(() => document.removeEventListener('keydown', onKey, true));
    // (SPEC 2.2) on a phone a touch in the work area folds an open Why panel, and the touch goes on to the app. The
    // countdown ignores the pointer: it runs CD_MS from the event whatever the user does next
    const onDown = (e) => {
      if (run !== r || inStrip(e.target)) return;
      if (ui.whyOpen && ui.whyPanel) setWhy(r, false);
    };
    // a focused text field holds the countdown while it holds text not yet sent (the user may still be typing); the app
    // empties a field it has taken in (a set added with Enter), which ends the hold (r3 review regress-1). Checked on
    // focus, on input and four times a second (the app empties it without an input event)
    const isField = (a) => !!a && a.nodeType === 1 && (a.isContentEditable || a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|color|file)$/i.test(a.type || 'text')));
    const unsent = (a) => isField(a) && !inStrip(a) && String(a.isContentEditable ? a.textContent : a.value || '').trim() !== '';
    const onFocus = () => { if (run !== r) return; cdFeed(r, { type: unsent(document.activeElement) ? 'hold' : 'release', kind: 'field' }); };
    ui.syncField = onFocus;
    const onVis = () => { if (run === r) cdFeed(r, { type: document.hidden ? 'hold' : 'release', kind: 'hidden' }); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('focusin', onFocus, true);
    document.addEventListener('input', onFocus, true);
    r.offs.push(() => document.removeEventListener('input', onFocus, true));
    const onBlurF = () => setTimeout(onFocus, 0);
    document.addEventListener('focusout', onBlurF, true);
    document.addEventListener('visibilitychange', onVis);
    r.offs.push(() => document.removeEventListener('pointerdown', onDown, true),
      () => document.removeEventListener('focusin', onFocus, true), () => document.removeEventListener('focusout', onBlurF, true), () => document.removeEventListener('visibilitychange', onVis));
    if (document.hidden) cdFeed(r, { type: 'hold', kind: 'hidden' });
    // Listen along: the step's piece holds the countdown while it plays, and its captions run from its start
    if (typeof api.on === 'function') {
      try {
        const a = api.on('listen-started', (e) => { if (run !== r) return; cdFeed(r, { type: 'hold', kind: 'listen' }); startCaptions(r, e); syncAct(r); });
        const b = api.on('listen-ended', () => { if (run !== r) return; stopCaptions(r); cdFeed(r, { type: 'release', kind: 'listen' }); syncAct(r); paintLead(r); });
        for (const off of [a, b]) if (typeof off === 'function') r.offs.push(off);
      } catch (e) { warn('on listen', e); }
    }
    // (review-phone phone-3: a finger on the screen; a lit part its panel's fling left out of sight comes back once the
    // finger is off and the panel still)
    const onTouch = (e) => {
      if (run !== r) return;
      ui.touching = e.touches ? e.touches.length : 0;
      if (ui.touching) clearTimeout(ui.backT);
      if (!ui.touching && ui.backH) { const H = ui.backH; clearTimeout(ui.backT); ui.backT = setTimeout(() => { if (run === r) bringBack(r, H); }, BACK_MS); }
    };
    for (const t of ['touchstart', 'touchend', 'touchcancel']) { document.addEventListener(t, onTouch, { capture: true, passive: true }); r.offs.push(() => document.removeEventListener(t, onTouch, /** @type {EventListenerOptions} */ ({ capture: true, passive: true }))); }
    const onHide = () => { if (run === r && r.lend && r.lend.stashed) unbeat(); };
    const onShow = (e) => { if (e.persisted && run === r && r.lend && r.lend.stashed) beat(); };
    addEventListener('pagehide', onHide);
    addEventListener('pageshow', onShow);
    r.offs.push(() => removeEventListener('pagehide', onHide), () => removeEventListener('pageshow', onShow));
    // The spotlight keeps up in the same frame: a scroll (of the page or any panel) and a resize are handled as they
    // fire, before the frame is painted; a ResizeObserver catches the lit elements, the strip and the open layers
    // changing size; a MutationObserver catches layout changes that fire no event (a panel opening, the chain
    // growing, a menu or a dialog opening); and while anything moves (a transition, an animation, the shade's own
    // morph) the layout runs every frame until it has been still for a while
    // (a panel the spotlight is drawn inside scrolls with it natively: its frames need no script. Anything else
    // a phone's rings follow by script during a scroll fades them until it is still)
    const onMove = (e) => {
      if (run !== r) return;
      if (e && e.type === 'resize') remount(r);
      if (e && e.type === 'scroll' && ui.hosts.has(e.target)) {
        clearTimeout(ui.hostT); clearTimeout(ui.backT);
        const H = e.target;
        ui.hostT = setTimeout(() => { if (run === r) { layout(false); kick(4); ui.backT = setTimeout(() => { if (run === r) bringBack(r, H); }, BACK_MS - 140); } }, 140);
        return;
      }
      const was = ui.drawSig;
      layout(false); kick(12);
      if (e && e.type === 'scroll' && ui.drawSig !== was && phoneL()) moving(ui);
    };
    addEventListener('resize', onMove);
    addEventListener('scroll', onMove, true);
    r.offs.push(() => removeEventListener('resize', onMove), () => removeEventListener('scroll', onMove, true));
    r.offs.push(() => { clearTimeout(ui.hostT); clearTimeout(ui.backT); clearTimeout(ui.moveT); clearTimeout(r.cdT); clearTimeout(ui.pulseT); stopCaptions(r); });
    if (typeof visualViewport !== 'undefined' && visualViewport) {
      for (const t of ['resize', 'scroll']) { visualViewport.addEventListener(t, onMove); r.offs.push(() => visualViewport.removeEventListener(t, onMove)); }
    }
    const ours = (n) => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return !e || !!e.closest('[data-tour="root"], [data-tour="top"], [data-tour="strip"], #tip'); };
    if (typeof ResizeObserver === 'function') {
      ui.ro = new ResizeObserver(() => { if (run === r) { layout(false); kick(12); } });
      ui.roSet = new Set();
      r.offs.push(() => ui.ro.disconnect());
    }
    if (typeof MutationObserver === 'function') {
      const mo = new MutationObserver((recs) => { if (run === r && recs.some((m) => !ours(m.target))) { syncTop(ui); syncLayers(r); kick(12); } });
      mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
      r.offs.push(() => mo.disconnect());
      // (the app's layout class on the root: a phone turned to landscape moves the strip into the header)
      let was = document.documentElement.className;
      const mr = new MutationObserver(() => { const c = document.documentElement.className; if (run === r && c !== was) { was = c; remount(r); layout(false); kick(12); } });
      mr.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      r.offs.push(() => mr.disconnect());
    }
    const onAnim = (e) => {
      if (run !== r || ours(e.target)) return;
      kick(45);
      // (a phone: a lit part's panel slides or rides, on the compositor: the rings drawn over the page fade
      // while it moves rather than trail it)
      if (phoneL() && r.step && r.tgt && e.target instanceof Element && (e.type === 'animationstart' || /^(transform|translate|top|bottom|left|right|inset|margin)/.test(e.propertyName || ''))) {
        let d = 0;
        try { const cs = getComputedStyle(e.target); d = Math.max(...String(e.type === 'animationstart' ? cs.animationDuration : cs.transitionDuration).split(',').map((v) => ms(v.trim(), 0))); } catch (x) { d = 0; }
        if (d > 0 && litParts(r.step, r.tgt).some((q) => e.target.contains(q.el))) moving(ui, Math.min(1200, d + 80));
      }
    };
    for (const t of ['transitionrun', 'animationstart']) { document.addEventListener(t, onAnim, true); r.offs.push(() => document.removeEventListener(t, onAnim, true)); }
    // a popover or a modal dialog of the app opening (the top layer): the rings and a phone's Why panel go above it
    const onToggle = (e) => {
      if (run !== r || ours(e.target)) return;
      const go1 = () => { if (run === r) { syncTop(ui); syncLayers(r); layout(false); kick(20); } };
      queueMicrotask(go1); requestAnimationFrame(go1);
    };
    for (const t of ['beforetoggle', 'toggle']) { document.addEventListener(t, onToggle, true); r.offs.push(() => document.removeEventListener(t, onToggle, true)); }
    r.offs.push(() => { try { if (ui.top.matches(':popover-open')) ui.top.hidePopover(); } catch (e) { /* */ } });
    // a safety net for anything the observers miss, four times a second (the layers that hold the countdown, the act
    // button's sound state); the stash's heartbeat every two seconds
    let n = 0;
    r.timer = setInterval(() => { syncTop(ui); syncLayers(r); syncAct(r); onFocus(); track(); if (r.lend && r.lend.stashed && ++n % Math.round(BEAT_MS / 250) === 0) beat(); }, 250);
    r.offs.push(() => clearInterval(r.timer));
    // the app's hover tooltip sits above the strip: hidden while it would cover it
    const tip = /** @type {HTMLElement | null} */ (document.querySelector(TIP_SEL));
    if (tip && typeof MutationObserver === 'function') {
      const mo = new MutationObserver(() => guardTip(r));
      mo.observe(tip, { attributes: true, attributeFilter: ['hidden', 'style', 'class'], childList: true });
      r.offs.push(() => { mo.disconnect(); if (tip.dataset.tourHid) { tip.style.visibility = ''; delete tip.dataset.tourHid; } });
    }
  }
  function guardTip(r) {
    const tip = /** @type {HTMLElement | null} */ (document.querySelector(TIP_SEL));
    if (!tip || run !== r) return;
    const t = tip.getBoundingClientRect(), c = r.ui.strip.getBoundingClientRect();
    const shown = !tip.hidden && t.width > 0 && t.height > 0;
    const over = shown && t.left < c.right + 4 && t.right > c.left - 4 && t.top < c.bottom + 4 && t.bottom > c.top - 4;
    if (over && !tip.dataset.tourHid) { tip.dataset.tourHid = '1'; tip.style.visibility = 'hidden'; }
    else if (!over && tip.dataset.tourHid) { delete tip.dataset.tourHid; tip.style.visibility = ''; }
  }
  // (every layer the tour itself keeps clear counts, also one the app's layerOpen() does not report: the sound settings)
  function appLayerOpen() {
    if (layerEls().length) return true;
    try { if (fn('layerOpen')) return !!api.layerOpen(); } catch (e) { /* fall through */ }
    try { return !!document.querySelector('#popHost > .pop, .modal-bg, .pal, .palette, [popover]:popover-open:not([data-tour])'); } catch (e) { return !!document.querySelector('#popHost > .pop, .modal-bg, .pal, .palette'); }
  }
  // Escape in the strip while a layer is open that the app's own Escape does not close (its layerOpen() does not
  // report it: the sound settings close on an Escape inside them): the key goes to that layer, the topmost one
  function escToLayer(e) {
    let own = true;
    try { own = fn('layerOpen') ? !!api.layerOpen() : true; } catch (x) { own = true; }
    if (own) return;
    const k = layerEls().filter((x) => !x.contains(document.activeElement)).pop();
    if (!k) return;
    e.preventDefault(); e.stopPropagation();
    try { fwdKey = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }); k.dispatchEvent(fwdKey); } catch (x) { /* */ } finally { fwdKey = null; }
  }
  let fwdKey = null;   // the Escape forwarded to a layer (the tour's own key handler lets it pass)
  // the app has something of its own that Escape cancels (INTEGRATION.md §3: busy)
  function appBusy() {
    try { if (fn('busy')) return !!api.busy(); } catch (e) { /* fall through */ }
    return !!document.querySelector('#toolMore[open]');
  }
  // a tap on the shade: the strip's lead line pulses (the step is there)
  function nudge() {
    if (!run || reduced()) return;
    const l = run.ui.l2;
    l.classList.remove('pulse'); void l.offsetWidth; l.classList.add('pulse');
  }

  // ---------------------------------------------------------------- the strip
  // where the strip goes: 'desk' (the stage's first row, 768 px and up), 'port' (a phone in portrait: a 68 px row under
  // the header), 'head' (a landscape phone: the header's free part, right of ⋯, when it is at least 260 px), 'row' (a
  // landscape phone whose header has no such room: a 48 px row under it)
  function stripMode() {
    const de = document.documentElement;
    if (!de.classList.contains('ph')) return 'desk';
    if (!de.classList.contains('ph-land')) return 'port';
    const top = document.querySelector('header.top, .top');
    if (!top) return 'row';
    const cs = getComputedStyle(top);
    let used = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0), k = 0;
    for (const c of /** @type {HTMLElement[]} */ ([...top.children])) {
      if (c.id === 'tourHeadSlot' || c.matches(':popover-open, [popover]') || getComputedStyle(c).display === 'none') continue;
      // (the view switch keeps at most 420 px, as when the header holds nothing else)
      used += c.id === 'viewSwitch' ? Math.min(420, c.scrollWidth > c.offsetWidth ? c.scrollWidth : Math.max(c.offsetWidth, 0)) : c.offsetWidth;
      k++;
    }
    const gap = parseFloat(cs.columnGap || cs.gap) || 4;
    const free = top.clientWidth - used - gap * k;
    /** @type {any} */ (stripMode).free = free;
    return free >= 260 ? 'head' : 'row';
  }
  // Mounts the strip in its slot (the app's api.slot, else the first child of .stage) and reserves its room: --tour-h
  // (the stage's first row) or --ph-tour (a phone's row under the header). Again on every resize. (r3 review user-10:
  // a landscape phone's header strip becomes the row under the header for a chapter whose line needs three lines
  // there, r.forceRow; user-3: a phone's row grows to three lines for a chapter that needs them, ui.lines)
  function mountStrip(r) {
    const ui = r.ui;
    let mode = stripMode();
    if (mode === 'head' && r.forceRow) mode = 'row';
    const where = mode === 'head' ? 'head' : 'stage';
    let slot = call('slot', where);
    if (!(slot && slot.nodeType === 1)) slot = document.getElementById(where === 'head' ? 'tourHeadSlot' : 'tourSlot');
    if (!slot && where === 'head') { mode = 'row'; slot = call('slot', 'stage') || document.getElementById('tourSlot'); }
    if (!(slot && slot.nodeType === 1)) {
      const st = document.querySelector('.stage');
      slot = el('div', { id: 'tourSlot', class: 'tour-slot' });
      if (st) st.prepend(slot); else document.body.prepend(slot);
      r.ownSlot = slot;
    }
    if (ui.slot && ui.slot !== slot) ui.slot.hidden = true;
    if (ui.strip.parentNode !== slot) slot.append(ui.strip);
    slot.hidden = false;
    const changed = ui.mode !== mode;
    ui.slot = slot; ui.mode = mode; ui.strip.dataset.mode = mode;
    ui.chap.hidden = mode !== 'desk' || !ui.chap.firstChild.textContent;
    // (r3 verify-2: × End in the landscape header only with 44 + 8 px to spare beyond the strip's 260)
    ui.strip.classList.toggle('ts-xok', mode === 'head' && /** @type {any} */ (stripMode).free >= 312);
    // the sheet: a panel in the tour's top layer on a phone (the narrow row has no room for Back, × End the tour and
    // Move on by itself); a laptop's strip has them in its row, and no sheet
    const panel = mode !== 'desk';
    const panelWas = !!ui.whyPanel;
    ui.whyPanel = panel;
    if (panel && ui.why.parentNode !== ui.top) { ui.top.append(ui.why); ui.why.classList.add('ts-panel'); }
    else if (!panel && ui.why.parentNode) { ui.why.remove(); ui.why.classList.remove('ts-panel'); ui.why.style.left = ''; ui.why.style.right = ''; ui.why.style.width = ''; }
    if ((changed || panel !== panelWas) && panel && ui.whyOpen) setWhy(r, false);
    if (!panel && panelWas) { ui.whyOpen = false; cdFeed(r, { type: 'release', kind: 'why' }); }
    // the text block opens the sheet on a phone; on a laptop it is plain text
    ui.text.classList.toggle('inert', !panel);
    ui.text.tabIndex = panel ? 0 : -1;
    if (panel) { ui.text.setAttribute('aria-expanded', String(!!ui.whyOpen)); ui.text.setAttribute('aria-controls', 'tourWhy'); ui.text.setAttribute('aria-label', $t('Tour options')); ui.text.removeAttribute('role'); }
    else { ui.text.removeAttribute('aria-expanded'); ui.text.removeAttribute('aria-controls'); ui.text.removeAttribute('aria-label'); ui.text.setAttribute('role', 'presentation'); }
    const st = document.documentElement.style;
    if (mode === 'desk') { st.removeProperty('--ph-tour'); sizeDesk(r); }
    else { st.removeProperty('--tour-h'); setPhTour(r); }
    if (changed && mode !== 'desk') call('slot', where);   // (the app's phone layout shares out its height again)
    paintNext(ui);
  }
  // the phone's row under the header: the one place that writes its height (--ph-tour), for the strip and for the lane,
  // true when it changed; PH_LINE: a line of the strip's or the lane's text, 17 px
  const PH_LINE = 17;
  const phTourGet = () => parseFloat(document.documentElement.style.getPropertyValue('--ph-tour')) || 0;
  function phTourSet(px) {
    if (phTourGet() === px) return false;
    document.documentElement.style.setProperty('--ph-tour', px + 'px');
    return true;
  }
  // a phone's row: 68 px in portrait (76 for three lines), 48 under a landscape header (56), none in the header
  function setPhTour(r) {
    const ui = r.ui, n = ui.lines || 2;
    ui.strip.dataset.lines = String(n);
    // (Italian at 360 px needs four lines for "Tieni premuto dentro il disco…": the row grows by a line, 17 px)
    const v = ui.mode === 'port' ? (n >= 4 ? 93 : n === 3 ? 76 : 68) : ui.mode === 'row' ? (n >= 4 ? 72 : n === 3 ? 56 : 48) : 0;
    return phTourSet(v);
  }
  // a resize or a layout change: the strip's place, then its lines, measured again
  function remount(r) { r.forceRow = false; mountStrip(r); fitLines(r); }
  // The number of lines the strip's line needs in this chapter on a phone (r3 review user-3, user-10): every lead, task,
  // result, hint and caption of its steps, at the width each step leaves it (a step with an act button has 52 px less),
  // set out of sight in a copy of the line. A landscape header that would need three takes the row under the header
  // instead; the row and a portrait strip grow to three lines. A desktop's line keeps its two lines (Next shortens).
  function fitLines(r) {
    const ui = r.ui;
    if (ui.mode === 'desk') { ui.lines = 2; ui.strip.dataset.lines = '2'; return; }
    let n = needLines(r);
    // (r3 verify-2: × stays in the header only while the chapter's line keeps its two lines there; else it is in Why,
    // and the strip keeps the header, so X keeps its size)
    if (ui.mode === 'head' && n > 2 && ui.strip.classList.contains('ts-xok')) { ui.strip.classList.remove('ts-xok'); n = needLines(r); }
    if (ui.mode === 'head' && n > 2) { r.forceRow = true; mountStrip(r); n = needLines(r); }
    ui.lines = n > 3 ? 4 : n > 2 ? 3 : 2;
    if (setPhTour(r)) call('slot', ui.mode === 'head' ? 'head' : 'stage');
  }
  // what a step's line can show: [text, with the task's ring]
  function lineTexts(st) {
    const out = [];
    const t = st.try && !(st.tryWide && narrow()) ? st.try : null;
    if (st.lead) out.push([leadFor(st), false]);
    if (t) {
      out.push([variantOf(t, t.text), true], [t.then || 'Done.', true]);
      if (t.off) out.push([t.off, true]);
      const h = hintFor(t);
      if (h) out.push([h, true]);
    }
    for (const c of st.captions || []) out.push([c[1], false]);
    return out;
  }
  function needLines(r, dbg) {
    const ui = r.ui, ch = CHAPTERS[r.ci];
    const w0 = ui.l2.clientWidth;
    if (!(w0 > 0)) return 2;
    // (a portrait row's act button takes Back's place: the same width with or without it)
    const port = ui.mode === 'port';
    const actW = ui.act.hidden || port ? 0 : ui.act.offsetWidth + 8, actFull = port ? 0 : actW || 52;
    // (measured once per chapter, mode, width and language: a phone's visual viewport fires resize events while it is
    // pinched or its keyboard opens, and these change none of them)
    const key = [r.ci, ui.mode, w0, actW, I18 ? I18.lang : 'en', coarse(), narrow()].join('|');
    if (!dbg && r.lineKey === key) return r.lineN;
    const probe = el('span', { class: 'ts-l2', 'aria-hidden': 'true' });
    probe.style.cssText = 'position:absolute;left:0;top:0;height:auto;visibility:hidden;pointer-events:none';
    ui.text.append(probe);
    let n = 1;
    try {
      const lh = parseFloat(getComputedStyle(probe).lineHeight) || 17;
      ch.steps.forEach((st, i) => {
        if (r.absent.has(skipKey(r.ci, i))) return;
        probe.style.width = (w0 + actW - (st.act ? actFull : 0)) + 'px';
        for (const [text, ring] of lineTexts(st)) {
          probe.textContent = '';
          const ri = el('span', { class: 'ts-ring' });
          ri.hidden = !ring;
          const tin = el('span', { class: 'ts-tin' });
          tinFill(tin, stepTitle(st));
          probe.append(ri, el('span', { class: 'ts-lead' }, tin, el('span', null, richText($t(text)))));
          n = Math.max(n, Math.round(probe.offsetHeight / lh));
          if (dbg) dbg.push([st.id, probe.style.width, Math.round(probe.offsetHeight / lh), text]);
        }
      });
    } finally { probe.remove(); }
    r.lineKey = key; r.lineN = n;
    return n;
  }
  // the title at the start of a landscape strip's line: bold, with a chevron (it opens Why)
  function tinFill(tin, t) {
    tin.textContent = t + ' ';
    const d = el('span', { class: 'ts-tdn' });
    d.innerHTML = ICON_DOWN;
    tin.append(d, ' ');
  }
  // A desktop's strip height: 52 px, plus while Why is open inline the tallest body of the steps seen so far at this
  // width (measured off screen at each chapter's start; r3 review regress-4: it never shrinks during the tour, so the
  // panes change size at most when a taller chapter comes, not at every chapter). At most 45 % of the view, and never
  // so tall that the panes keep less than 360 px (Why scrolls inside).
  const ROW_H = 52, SLOT_GAP = 8;
  // a laptop's strip is one row high
  function sizeDesk(r) {
    const ui = r.ui;
    if (ui.mode !== 'desk') return;
    const v = (ROW_H + SLOT_GAP) + 'px';
    if (document.documentElement.style.getPropertyValue('--tour-h') !== v) document.documentElement.style.setProperty('--tour-h', v);
  }
  // the phone's sheet open or folded: it folds at every step and holds the countdown while it is open
  function setWhy(r, open) {
    const ui = r.ui;
    if (!ui.whyPanel) return;
    open = !!open;
    ui.whyOpen = open;
    ui.why.hidden = !open;
    ui.text.setAttribute('aria-expanded', String(open));
    cdFeed(r, { type: open ? 'hold' : 'release', kind: 'why' });
    if (open) placeWhy(r);
    layout(false); kick(12);
  }
  function placeWhy(r) {
    const ui = r.ui;
    if (!ui.whyPanel || !ui.whyOpen) return;
    const b = ui.strip.getBoundingClientRect();
    const t = Math.round(ui.mode === 'head' ? b.bottom + 1 : b.bottom);
    if (ui.why.style.top !== t + 'px') ui.why.style.top = t + 'px';
    if (ui.why.style.width) { ui.why.style.left = ''; ui.why.style.right = ''; ui.why.style.width = ''; }
  }
  // the chapter's last step, where the strip's × finishes the chapter
  const lastOfChapter = (r) => { const nx = seek(r.ci, r.si + 1, 1, isAbsent); return !nx || nx.ci !== r.ci; };
  // Move on by itself (SPEC 2.4): on by default, kept in the tour record; off, the countdown of this showing stops
  function setAuto(on) {
    rec.auto = !!on; save();
    if (run) { run.ui.autoC.checked = rec.auto; if (!rec.auto) cdFeed(run, { type: 'off' }); }
    return rec.auto;
  }
  // Next (r3 review user-7): on a wide screen "Start", "Finish", "Next: <chapter>" or "Next", shortened to "Next →" (the
  // full label its name) when it does not fit or would cut the lead line; on a phone an arrow, its label its name. With
  // reduced motion during a countdown, the seconds left ("Next in 3 s"; on a phone "3")
  function paintNext(ui) {
    const n = ui.next, cnt = n.dataset.count || '';
    const ph = !!ui.mode && ui.mode !== 'desk';
    // Next is earned: while the step's task is open the button is a quiet, outlined Skip; once it is done, or when
    // the step has no task, the filled Next
    const r = run && run.ui === ui ? run : null;
    const open = !!(r && r.step && tryOf(r.step) && !r.done && r.caption == null);
    const base = open ? $t('Skip') : n.dataset.base || $t('Next');
    const cap = !ph && keyHints();
    const html = ph ? (cnt ? `<span class="ts-ncount">${esc(cnt)}</span>` : ICON_RIGHT) : null;
    const text = ph ? null : cnt ? $t('Next in {n} s', { n: cnt }) : base;
    const aria = ph || cnt ? base : null;
    const sig = [html, text, aria, cap, open].join('|');
    // (a laptop's Next names the key that steps forward in its tooltip)
    if (n.dataset.sig !== sig) {
      n.dataset.sig = sig;
      n.classList.toggle('skip', open);
      if (html != null) n.innerHTML = html; else n.textContent = text;
      if (aria) n.setAttribute('aria-label', aria); else n.removeAttribute('aria-label');
      n.title = ph ? base : cap ? base + '  →' : '';
    }
    if (open || ph || cnt || !n.dataset.full) return;
    // (it does not fit, or it leaves the lead line too little room: never cut; a laptop's text block has no box of its own,
    // its task line is the one measured)
    const t = ui.text.offsetWidth > 0 ? ui.text : ui.l2, cut = t && t.offsetWidth > 0 && (t.scrollHeight > t.clientHeight + 1 || t.scrollWidth > t.clientWidth + 1);
    if ((n.offsetWidth > 0 && n.scrollWidth > n.clientWidth + 0.5) || cut) { n.textContent = $t('Next') + ' →'; n.setAttribute('aria-label', base); n.dataset.sig = 'short'; }
  }

  // ---------------------------------------------------------------- the act button and the sound
  const soundState = () => { const s = call('soundState'); return s && typeof s === 'object' ? s : { on: false, events: false, sonify: false, playing: !!call('soundPlaying') }; };
  // the act button: Listen (Stop listening while it plays; Turn on and listen when the sound or Mathematical events are
  // off), or Turn on sound while the sound is not ready (a hear step). Icon only on a phone, its label its name
  function syncAct(r, st) {
    const ui = r.ui, step = st || r.step, kind = step && step.act;
    if (!kind) { if (!ui.act.hidden) { ui.act.hidden = true; ui.strip.classList.remove('has-act'); } return; }
    let label = '', icon = ICON_PLAY, show = true;
    if (kind === 'listen') {
      const s = soundState();
      if (s.playing) { label = $t('Stop listening'); icon = ICON_STOP; }
      else if (!(s.on && s.events)) label = $t('Turn on and listen');
      else label = $t('Listen');
    } else {
      show = call('soundReady') !== true;
      label = $t('Turn on sound'); icon = ICON_SOUND;
    }
    // (r3 review user-8: the task line says when the tour turns the sound on, try.off; a phone shows the icon only)
    if (kind === 'listen' && step === r.step) paintLead(r, step);
    const sig = [show, label].join('|');
    if (ui.act.dataset.sig === sig) return;
    ui.act.dataset.sig = sig;
    ui.act.hidden = !show;
    ui.strip.classList.toggle('has-act', show);
    ui.act.innerHTML = icon;
    ui.act.append(el('span', null, label));
    ui.act.setAttribute('aria-label', label);
    ui.act.title = label;
    paintNext(ui);
  }
  // the act button's press: the user gesture the audio engine needs
  function actPress(r) {
    const step = r.step;
    if (!step || !step.act) return;
    if (step.act === 'listen') {
      if (soundState().playing) { call('soundStop'); syncAct(r); return; }
      const was = soundState();
      call('soundHold', Object.assign({ on: true, events: true }, step.hear ? { sonify: true } : {}));
      if (step.hear && !was.sonify) r.sndNote = true;
      if (call('listen') === false) call('toast', $t('This browser cannot play sound here.'));
    } else {
      const was = soundState();
      call('soundHold', { on: true, events: true, sonify: true });
      if (!was.sonify) { r.sndNote = true; r.ui.live.textContent = $t('The tour turns Hear the function on for this step; your setting comes back after it.'); }
    }
    syncAct(r);
    setTimeout(() => { if (run === r) syncAct(r); }, 300);
  }
  // the sound a step holds (SPEC 4.3): a hear step turns Hear the function on when the sound is ready (with a note);
  // a listen step of the Sound chapter gives Hear the function back; a step with no sound of its own (Sound settings)
  // and a step outside the chapter give everything back, so the menu shows the user's own settings (r3 review user-6)
  function holdSound(r, ch, step) {
    call('soundStop');
    r.sndNote = false;
    if (ch.id !== 'sound' || !(step.hear || step.act)) { call('soundHold', null); return; }
    if (step.hear) {
      if (call('soundReady') === true) { const was = soundState(); call('soundHold', { sonify: true }); r.sndNote = !was.sonify; }
    } else call('soundHold', { sonify: null });
  }
  // captions while the step's piece plays: the tour's own timer from listen-started (±50 ms is fine for captions)
  function startCaptions(r, e) {
    stopCaptions(r);
    const step = r.step;
    // (the step's piece: the composition, or the function's own Listen along; capFrac scales by its duration)
    if (!step || !step.captions || !(e && (e.piece || e.fn))) return;
    const k = step.capFrac ? (Number.isFinite(e.dur) && e.dur > 0 ? e.dur : 0) : 1;
    if (!(k > 0)) return;
    const t0 = performance.now();
    r.capT = [];
    for (const [sec, text] of step.captions) {
      const at = Math.max(0, sec * k * 1000 - (performance.now() - t0));
      r.capT.push(setTimeout(() => { if (run !== r || r.step !== step) return; r.caption = text; paintLead(r); r.ui.live.textContent = plainCopy($t(text), modKey()); }, at));
    }
  }
  function stopCaptions(r) {
    for (const t of r.capT || []) clearTimeout(t);
    r.capT = [];
    if (r.caption != null) { r.caption = null; if (run === r) paintLead(r); }
  }

  // ---------------------------------------------------------------- the countdown's feeds and its look
  function cdFeed(r, e) {
    if (!r || run !== r) return;
    const before = r.cd;
    r.cd = countdown(r.cd, e, performance.now());
    if (r.cd !== before) cdSync(r, before);
  }
  function cdSync(r, before) {
    const s = r.cd, ui = r.ui;
    clearTimeout(r.cdT);
    const now = performance.now(), L = cdLeft(s, now);
    const live = s.phase === 'running' || s.phase === 'held';
    const restarted = s.phase === 'running' && (!before || before.phase !== 'running' || before.t0 !== s.t0);
    const red = reduced();
    if (s.door) { ui.next.classList.remove('counting', 'held'); }
    else {
      ui.next.classList.toggle('held', s.phase === 'held');
      if (restarted && !red) { ui.next.style.setProperty('--tour-cd', s.dur + 'ms'); ui.next.classList.remove('counting'); void ui.next.offsetWidth; ui.next.classList.add('counting'); }
      if (!live) ui.next.classList.remove('counting', 'held');
      // (held: the fill freezes; when the hold ends the countdown starts again from its full length)
      if (s.phase === 'held' && before && before.phase !== 'held' && !red) ui.next.classList.add('counting');
    }
    nextLabel(r, red && live && !s.door ? Math.ceil((s.phase === 'running' ? L : s.dur) / 1000) : null);
    // (r3 review regress-5: the countdown is announced when it starts: at done when nothing holds it, else here, when the
    // last hold ends)
    if (r.done && !s.door && s.phase === 'running' && before && before.phase === 'held') ui.live.textContent = nextIn();
    if (L == null) return;
    // (reduced motion: the label counts down each second; otherwise one timer to the end)
    const wait = red && !s.door ? Math.max(1, L % 1000 || 1000) : L;
    r.cdT = setTimeout(() => {
      if (run !== r || r.cd !== s) return;
      if (cdLeft(s, performance.now()) > 1) { cdSync(r, s); return; }
      r.cd = countdown(s, { type: 'fire' }, performance.now());
      // (a focused text field is left first, so a phone's keyboard closes)
      const a = /** @type {HTMLElement | null} */ (document.activeElement);
      if (a && a !== document.body && !r.ui.strip.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) { try { a.blur(); } catch (x) { /* */ } }
      go(1);
    }, wait);
  }
  // Next's countdown with reduced motion: the seconds left (n), or none
  function nextLabel(r, n) {
    const nx = r.ui.next, v = n != null ? String(n) : '';
    if ((nx.dataset.count || '') === v) return;
    if (v) nx.dataset.count = v; else delete nx.dataset.count;
    paintNext(r.ui);
  }
  // the app's layers open (a menu, the palette, a dialog, a popover, a sheet the step did not open) hold the countdown
  function syncLayers(r) {
    if (!r || run !== r) return;
    // (a layer the step itself opened, a phone's sheet, is part of the step: it holds nothing; r3 review user-1: so is a
    // layer that holds one of the step's lit parts, the Editor sheet with the lens that the chain's task opens)
    const cand = layerEls().filter((k) => !(r.stepLayers && r.stepLayers.has(k)));
    let open = cand.length > 0;
    if (open && r.step && r.tgt) { const els = litParts(r.step, r.tgt).map((q) => q.el); open = cand.some((k) => !els.some((e) => k.contains(e))); }
    if (open !== !!r.layerHeld) { r.layerHeld = open; cdFeed(r, { type: open ? 'hold' : 'release', kind: 'layer' }); }
  }

  // the next showable step from (ci, si) in direction dir, crossing chapters; null at either end. skip(ci, si): a step
  // known to be absent from this build
  function seek(ci, si, dir, skip) {
    const d = dir < 0 ? -1 : 1;
    while (ci >= 0 && ci < CHAPTERS.length) {
      // (a chapter for the keyboard is passed over on a touch screen, unless the tour is in it)
      if (!chapterShown(CHAPTERS[ci]) && !(run && run.ci === ci)) { ci += d; si = d < 0 ? (ci >= 0 ? CHAPTERS[ci].steps.length - 1 : -1) : 0; continue; }
      const st = CHAPTERS[ci].steps;
      if (si < 0) { ci--; if (ci >= 0) si = CHAPTERS[ci].steps.length - 1; continue; }
      if (si >= st.length) { ci++; si = 0; continue; }
      if (skip && skip(ci, si)) { si += d; continue; }
      return { ci, si };
    }
    return null;
  }
  const isAbsent = (ci, si) => !!run && run.absent.has(skipKey(ci, si));
  const featureOff = (f) => { try { return typeof api.has === 'function' && api.has(f) === false; } catch (e) { return false; } };
  // a scene name, or a list of them: the first whose features this build has (else the last, whose steps are absent)
  function pickScene(k) {
    if (!Array.isArray(k)) return k;
    return k.find((x) => !(SCENES[x] && [].concat(SCENES[x].needs || []).some(featureOff))) || k[k.length - 1];
  }
  // the actions that change the scene or the view: only when the tour can put the user's work back (borrow)
  const CHANGES = new Set(['scene', 'range', 'view', 'surface', 'deform', 'focus', 'panel', 'tool', 'look', 'select', 'plane', 'svPlace']);
  function absent(ci, si, scenes) {
    const ch = CHAPTERS[ci], st = ch.steps[si], k = sceneAt(ch, si), sc = k != null ? SCENES[k] : null;
    if (scenes === false && (k != null || (st.before || []).some((a) => CHANGES.has(a[0])))) return true;
    if (st.wide && narrow()) return true;
    return [].concat(st.needs || [], (sc && sc.needs) || [], ch.needs || []).some(featureOff);
  }

  async function go(dir) {
    if (!run) return;
    const r = run;
    const pos = seek(r.ci, r.si + dir, dir, isAbsent);
    if (!pos) { if (dir > 0) stop({ finished: true }); return; }
    // the end of a chapter counts as finishing it (and says so)
    if (dir > 0 && pos.ci !== r.ci) { rec.done[CHAPTERS[r.ci].id] = CHAPTERS[r.ci].rev; save(); say($t('{chapter} done ✓', { chapter: $t(CHAPTERS[r.ci].title) })); }
    await show(pos.ci, pos.si, dir);
  }

  function loadScene(r, key) {
    if (key == null) return true;
    if (r.scene === key) return r.sceneOk[key] !== false;
    const spec0 = SCENES[key];
    // (a scene the app holds, app: the Grieg example, asked for at load time; none: the scene is absent)
    let spec = spec0;
    if (spec0 && spec0.app) { const a = call('sceneSpec', spec0.app); spec = a && typeof a === 'object' ? Object.assign({}, a, { look: spec0.look }) : null; }
    let ok = !!spec && r.scenes;
    if (ok) {
      const res = call('loadScene', JSON.parse(JSON.stringify(spec)));
      ok = res !== false;
      // the display the copy assumes (the user's own look comes back with restore)
      if (ok && spec.look) call('setLook', Object.assign({}, spec.look));
    }
    r.scene = key; r.sceneOk[key] = ok;
    return ok;
  }
  const ACTIONS = { range: 'setRange', view: 'setView', surface: 'setSurface', deform: 'setDeformation', focus: 'focusStep', panel: 'showPanel', tool: 'setTool', look: 'setLook', select: 'selectStep', plane: 'showPlane' };
  function act(r, a) {
    const [name, ...args] = a;
    if (name === 'scene') return loadScene(r, pickScene(args[0]));
    if (CHANGES.has(name) && !r.scenes) return false;
    return call(ACTIONS[name] || name, ...args) !== false;
  }

  // the scene a step shows: the last `scene` action at or before it in its chapter, else the chapter's own
  function sceneAt(ch, si) {
    let k = ch.scene;
    for (let i = 0; i <= si; i++) for (const a of ch.steps[i].before || []) if (a[0] === 'scene') k = a[1];
    return pickScene(k);
  }
  const skipKey = (ci, si) => CHAPTERS[ci].id + '/' + CHAPTERS[ci].steps[si].id;

  async function show(ci, si, dir) {
    const r = run;
    if (!r) return;
    const token = ++r.seq;
    // a newer show of this run, a restart or the end of the tour: this one gives up (run is the live run, r this one's)
    const stale = () => run !== r || token !== r.seq;
    if (isAbsent(ci, si)) {
      const pos = seek(ci, si, dir || 1, isAbsent) || seek(ci, si, -(dir || 1), isAbsent);
      if (!pos) { stop({}); return; }
      ci = pos.ci; si = pos.si;
    }
    const ch = CHAPTERS[ci], step = ch.steps[si];
    r.ci = ci; r.si = si; r.dir = dir;
    rec.last = { ch: ch.id, i: si }; rec.open = true; save();
    // (the Inspector's split offer shows during the tour only at a step that asks for it)
    call('splitOffer', !!step.split);
    // (a step about the cards' pictures shows them, Pictures rather than Names; any other step, and the end of the
    // tour, gives the user's setting back. picNote: the tour changed it, and the step says so)
    r.picNote = call('chainPictures', !!step.pictures) === true && !!step.pictures;
    for (const off of r.tryOffs.splice(0)) off();
    // (a new showing: no countdown, no caption, no Listen along from the step before; the Sound chapter's sound)
    clearTimeout(r.cdT);
    const holds = r.cd ? r.cd.holds.filter((k) => k !== 'why' && k !== 'listen') : [];
    r.cd = Object.assign(cdInit(), { holds });
    r.ui.next.classList.remove('counting', 'held', 'ready');
    stopCaptions(r);
    r.done = false; r.result = null; r.hint = null; r.quiet = false;
    holdSound(r, ch, step);
    if (r.ui.whyOpen && r.ui.whyPanel) setWhy(r, false);
    r.ui.strip.setAttribute('aria-busy', 'true');
    // (the strip shows the new step's title and line at once, while its scene and spotlight settle)
    r.caption = null;
    fill(r, ch, step);
    // A chapter's start, before its scene loads and is fitted: the side panel a step of the
    // chapter docks opens, so the stage and the strip keep one place through the chapter (a drawer, or a phone's
    // sheet, still opens at its own step); the strip's lines for its copy (a phone); a desktop's Why for its steps
    if (r.chapterAt !== ci) {
      r.chapterAt = ci;
      const pa = r.scenes ? chapterPanel(r, ci) : null;
      if (pa) call('showPanel', pa[1], pa[2], true);
      remount(r);
      sizeDesk(r);
      await frames(1); if (stale()) return;
    }
    const want = sceneAt(ch, si);
    const sceneLoaded = want != null && r.scene !== want;
    const ok = want == null ? true : loadScene(r, want);
    // a step that does not ask for the panel: a phone's sheet that an earlier step opened closes (optional)
    if (r.scenes && !(step.before || []).some((a) => a[0] === 'panel')) call('closeSheet');
    for (const a of step.before || []) {
      if (a[0] === 'scene') continue;
      // (the steps view takes a scene just loaded a frame or two later and sets its place back: the placement waits for that)
      if (a[0] === 'svPlace' && sceneLoaded) { await frames(2); if (stale()) return; }
      act(r, a);
      await null;
      if (stale()) return;
    }
    await frames(2);
    await sleep(step.wait || (step.before && step.before.length ? 60 : 0));
    if (stale()) return;
    // the fonts the copy and the lit controls are set in (a Cyrillic face loads on first use)
    if (typeof document.fonts === 'object' && document.fonts && document.fonts.status !== 'loaded') { await Promise.race([document.fonts.ready, sleep(1000)]); if (stale()) return; }
    let tgt = step.anchor == null ? null : anchorOf(step.anchor);
    let target = tgt ? tgt.el : null;
    // Missing in this build or this layout, or clipped away: skip it, in the direction of travel. The skip is reported
    // (Tour.skipped(), and a warning once per step and run), never silent
    const skip = async (why) => {
      const key = skipKey(ci, si);
      r.skipped.add(key);
      if (!r.why.has(key)) { r.why.set(key, why); warn('step skipped', `${key} (${why})`); }
      const d = dir || 1;
      const pos = seek(ci, si + d, d, isAbsent);
      if (!pos) { if (d > 0) stop({ finished: true }); else await show(ci, si, 1); return; }
      if (pos.ci !== ci && d > 0) { rec.done[ch.id] = ch.rev; save(); }
      await show(pos.ci, pos.si, d);
    };
    if (!ok) { await skip('scene'); return; }
    if (step.anchor != null && !target) { await skip('missing'); return; }
    r.step = step; r.el = target; r.tgt = tgt;
    // the copy of a control that lives in the ⋯ menu here says "in this menu"
    r.inMenu = !!target && [].concat(step.anchor).length > 1 && target === anchorEl('moreBtn') && anchorEl([].concat(step.anchor)[0]) !== target;
    // bring the lit area into view: between the top bar and what is fixed at the bottom (a phone's tool bar, and the
    // sheet the callout becomes), measured again once the scroll has ended
    if (target) {
      await reveal(target, step); if (stale()) return;
      // measured once it has settled: the lit area unchanged over two frames (a view switch, a panel sliding open)
      await steady(r, step, 700); if (stale()) return;
      // clipped away by a panel that cannot scroll (the panes squeezed to a strip on a phone in landscape): another of
      // the step's anchors, else the step is skipped (an empty line lit where the control would be helps no one)
      if (tgtHidden(r.tgt)) {
        tgt = anchorOf(step.anchor, (t) => !tgtHidden(t));
        if (!tgt) { r.step = null; await skip('clipped'); return; }
        target = tgt.el; r.el = target; r.tgt = tgt;
        await reveal(target, step); if (stale()) return;
        await steady(r, step, 700); if (stale()) return;
      }
    }
    r.ui.strip.removeAttribute('aria-busy');
    // (each step checks its panels anew)
    r.ui.hostOk = new Map();
    // (the layers open here were opened by the step itself, a phone's sheet: they hold no countdown)
    r.stepLayers = new Set(layerEls());
    r.layerHeld = false;
    r.cd = Object.assign(cdInit(), { holds: r.cd.holds.filter((k) => k !== 'layer') });
    fill(r, ch, step);
    watchStep(r);
    layout(true);
    kick(30);
    announce(r, ch, step);
    armTry(r, step);
    pulseSmall(r);
    // (the strip is not a dialog: the focus stays where the user is working; when it was in the strip, it goes to Next)
    if (r.ui.strip.contains(document.activeElement) && document.activeElement !== r.ui.next) { try { r.ui.next.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }

  // the first side panel a step of the chapter shows (['panel', 'left' | 'right', …]), the steps absent here aside
  function chapterPanel(r, ci) {
    const ch = CHAPTERS[ci];
    for (let i = 0; i < ch.steps.length; i++) {
      if (r.absent.has(skipKey(ci, i))) continue;
      const a = (ch.steps[i].before || []).find((x) => x[0] === 'panel' && (x[1] === 'left' || x[1] === 'right'));
      if (a) return a;
    }
    return null;
  }
  // the band of the viewport that nothing fixed covers: below the top bar, above a bottom bar and (on a phone) the sheet
  function fixedEdge(y, fromTop) {
    let best = null;
    const vp = vpSize(), xs = [vp.w * 0.25, vp.w * 0.5, vp.w * 0.75];
    for (const x of xs) {
      for (const e of document.elementsFromPoint(x, y)) {
        if (e.closest('[data-tour]')) continue;
        let a = e;
        for (; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') break; }
        if (!a || a === document.body || a === document.documentElement) break;
        const q = a.getBoundingClientRect();
        if (q.width < vp.w * 0.4) break;
        best = fromTop ? Math.max(best == null ? 0 : best, q.bottom) : Math.min(best == null ? vp.h : best, q.top);
        break;
      }
    }
    return best;
  }
  function freeBand() {
    const H = vpSize().h, top = fixedEdge(2, true) || 0, bar = fixedEdge(H - 3, false);
    let bot = bar == null ? H : bar;
    if (narrow()) bot = Math.min(bot, H * 0.58);
    return { top, bot: Math.max(top + 80, bot) };
  }
  /** @returns {Promise<void>} */
  function scrollWin(y) {
    return new Promise((res) => {
      if (Math.abs(y - scrollY) < 1) { res(); return; }
      if (reduced()) { scrollTo({ top: y, behavior: 'auto' }); res(); return; }
      let done = false;
      const fin = () => { if (done) return; done = true; removeEventListener('scrollend', fin); res(); };
      addEventListener('scrollend', fin);
      setTimeout(fin, 700);
      scrollTo({ top: y, behavior: 'smooth' });
    });
  }
  // Scrolls every scrolling ancestor of e (not the page) so e's box is inside it, 8 px clear, when it fits; when it
  // does not, so its start shows. Instant: the spotlight follows in the same frame. Returns whether anything moved.
  function panelsReveal(e) {
    let moved = false;
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      const sy = /(auto|scroll|overlay)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1;
      const sx = /(auto|scroll|overlay)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1;
      if (!sy && !sx) continue;
      const q = a.getBoundingClientRect(), b = e.getBoundingClientRect(), m = 8;
      // (the container's scroll-padding is room that something over it takes, such as the phone chain's pinned + and F)
      const sp = (k) => parseFloat(cs[k]) || 0;
      const top0 = q.top + a.clientTop, left0 = q.left + a.clientLeft;
      const top = top0 + sp('scrollPaddingTop'), left = left0 + sp('scrollPaddingLeft'), bot = top0 + a.clientHeight - sp('scrollPaddingBottom'), right = left0 + a.clientWidth - sp('scrollPaddingRight');
      // (a part that fits only without the 8 px margins is placed whole, with equal margins)
      const need = (lo, hi, a0, a1) => {
        if (hi - lo <= a1 - a0 - 2 * m) return lo < a0 + m ? lo - a0 - m : hi > a1 - m ? hi - a1 + m : 0;
        if (hi - lo <= a1 - a0) { const mm = (a1 - a0 - (hi - lo)) / 2; return lo < a0 + mm - 0.5 || hi > a1 - mm + 0.5 ? lo - a0 - mm : 0; }
        return lo < a0 || lo > a0 + m ? lo - a0 - m : 0;
      };
      const dy = sy ? need(b.top, b.bottom, top, bot) : 0, dx = sx ? need(b.left, b.right, left, right) : 0;
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) continue;
      const y0 = a.scrollTop, x0 = a.scrollLeft;
      try { a.scrollTo({ top: y0 + dy, left: x0 + dx, behavior: 'instant' }); } catch (x) { a.scrollTop = y0 + dy; a.scrollLeft = x0 + dx; }
      if (a.scrollTop !== y0 || a.scrollLeft !== x0) moved = true;
    }
    return moved;
  }
  // waits (at most maxMs) until the step's lit areas are the same in two frames running
  async function steady(r, step, maxMs) {
    const t0 = performance.now();
    let last = '';
    while (performance.now() - t0 < maxMs) {
      if (run !== r || r.step !== step) return;
      const sig = JSON.stringify(holesFor(step, r.tgt).holes.map((h) => [h.l, h.t, h.r, h.b].map((v) => Math.round(v * 2))));
      if (sig === last) return;
      last = sig;
      await frames(1);
    }
  }
  const inFixed = (e) => { for (let a = e; a && a !== document.body && a !== document.documentElement; a = a.parentElement) { const p = getComputedStyle(a).position; if (p === 'fixed' || p === 'sticky') return true; } return false; };
  async function reveal(target, step) {
    // the panels that cut a lit part scroll first (the F tile in a scrolled chain strip, a section low in a
    // phone's sheet); the anchor's panels last, so it wins where both are in one panel. (the controls a Try it
    // needs after it: the Select tool above the shape list of a short side panel shows whole, the list from its top)
    const ctls = ctlOf(step).map((a) => anchorEl(a)).filter((e) => e && e !== target);
    const alsoAll = [].concat(step.also || [], workOf(step)).map((a) => anchorEl(a)).filter((e) => e && e !== target).concat(ctls);
    const ctlsReveal = () => { let m = false; for (const e of ctls) if (panelsReveal(e)) m = true; return m; };
    let pm = false;
    for (const e of alsoAll) if (panelsReveal(e)) pm = true;
    if (panelsReveal(target)) pm = true;
    if (ctlsReveal()) pm = true;
    if (pm) await frames(1);
    // a control in the top bar or a fixed tool bar (or a phone's sheet) is always in view; scrolling the page would
    // only move the page under it
    if (inFixed(target)) return;
    const also = alsoAll.filter((e) => !inFixed(e));
    for (let pass = 0; pass < 2; pass++) {
      // cut by a scrolling panel (a section low in a side panel, the add card at the end of a long chain): that panel
      // scrolls first, so the whole target shows when it fits
      if (/** @type {any} */ (panelsReveal(target)) | /** @type {any} */ (ctlsReveal())) await frames(1);
      // the lit area: the anchor, and its second lit element when both can be brought in
      const b = target.getBoundingClientRect();
      const box = { top: b.top, bottom: b.bottom };
      for (const e of also) { const q = e.getBoundingClientRect(); box.top = Math.min(box.top, q.top); box.bottom = Math.max(box.bottom, q.bottom); }
      const band = freeBand(), room = band.bot - band.top - 16;
      let delta = 0;
      if (box.bottom - box.top <= room) {
        // it fits: wholly inside the band
        if (box.top < band.top + 2) delta = box.top - band.top - 8;
        else if (box.bottom > band.bot - 2) delta = box.bottom - band.bot + 8;
      } else if (also.length && narrow() && b.bottom - b.top <= room) {
        // two lit areas that cannot both fit (X and Y on a phone): the anchor whole, at the band's edge toward the
        // other, so as much of the other shows as can
        delta = box.top < b.top - 1 ? b.bottom - band.bot + 8 : b.top - band.top - 8;
      } else if (also.length && narrow()) {
        delta = b.top - band.top - 8;
      } else if (b.bottom - b.top <= room) {
        if (b.top < band.top + 2) delta = b.top - band.top - 8;
        else if (b.bottom > band.bot - 2) delta = b.bottom - band.bot + 8;
      } else if (b.top < band.top - 2 || b.top > band.top + 0.4 * room) delta = b.top - band.top - 8;
      if (Math.abs(delta) < 2) return;
      const maxY = Math.max(0, document.documentElement.scrollHeight - vpSize().h);
      const y = Math.max(0, Math.min(maxY, scrollY + delta));
      if (Math.abs(y - scrollY) < 1) return;
      await scrollWin(y);
      await frames(1);
      if (!run) return;
    }
  }

  function fill(r, ch, step) {
    const ui = r.ui;
    // the count leaves out the steps this run found missing
    const shown = ch.steps.filter((s, i) => s === step || !(r.skipped.has(skipKey(r.ci, i)) || r.absent.has(skipKey(r.ci, i))));
    const k = shown.indexOf(step) + 1, total = shown.length;
    const t = stepTitle(step);
    ui.title.textContent = t;
    // (cut with an ellipsis where it does not fit: the full title stays its name)
    ui.title.setAttribute('aria-label', t); ui.title.title = t;
    tinFill(ui.tin, t);
    ui.wtitle.textContent = t;
    r.countText = $t('{k} of {total}', { k, total });
    r.countShort = `${k}/${total}`;
    ui.count.textContent = ui.mode === 'desk' ? `${$t(ch.title)} · ${r.countText}` : r.countShort;
    ui.count.setAttribute('aria-label', `${$t(ch.title)}, ${r.countText}`);
    // (the count in the text gives way to the chapter button where there is room for it)
    ui.chap.hidden = ui.mode !== 'desk';
    ui.chap.firstChild.textContent = r.countShort;
    ui.chap.setAttribute('aria-label', `${$t(ch.title)}, ${r.countText}. ${$t('Chapters')}`);
    ui.chap.setAttribute('title', $t('Chapters'));
    const nx = seek(r.ci, r.si + 1, 1, isAbsent);
    const nextCh = nx && nx.ci !== r.ci ? CHAPTERS[nx.ci] : null;
    const last = !nx;
    const base = step.anchor == null && r.ci === 0 && r.si === 0 ? $t('Start') : last ? $t('Finish') : nextCh ? $t('Next: {chapter}', { chapter: $t(nextCh.title) }) : $t('Next');
    delete ui.next.dataset.count;
    ui.next.dataset.base = base;
    if (nextCh) ui.next.dataset.full = base; else delete ui.next.dataset.full;
    paintNext(ui);
    // (no step before: Back keeps its place, unseen, so the text and Why stay aligned from step to step)
    const noBack = !seek(r.ci, r.si - 1, -1, isAbsent);
    ui.back.style.visibility = noBack ? 'hidden' : '';
    ui.back.disabled = noBack;
    ui.wBack.hidden = noBack;
    ui.autoC.checked = rec.auto !== false;
    ui.l2.classList.remove('done', 'caption');
    ui.act.dataset.sig = '';
    syncAct(r, step);
    paintLead(r, step);
    paintNext(ui);
  }
  // The lead line, by precedence (SPEC 1.1): a caption while the step's piece plays; the result line with a tick once the
  // task is done ("Done." when the step has none); the task with an empty ring; else the step's lead
  function paintLead(r, st) {
    const ui = r.ui, step = st || r.step;
    if (!step) return;
    const tr = tryOf(step);
    let text, ring = false, done = false, cap = false;
    if (r.caption != null) { text = $t(r.caption); cap = true; }
    else if (tr && r.done) {
      // the chapter's last task: the line says the chapter is done ("Basics done ✓"); Next names the next one
      const nx = seek(r.ci, r.si + 1, 1, isAbsent), end = !nx || nx.ci !== r.ci;
      const chDone = end ? $t('{chapter} done ✓', { chapter: $t(CHAPTERS[r.ci].title) }) : '';
      text = tr.then ? $t(tr.then) + (chDone ? ' ' + chDone : '') : chDone || $t('Done.');
      ring = true; done = true;
    }
    else if (tr && r.hint) { text = $t(r.hint); ring = true; }
    else if (tr) { text = tr.off && step.act === 'listen' && !(soundState().on && soundState().events) ? $t(tr.off) : tryFor(tr); ring = true; }
    else text = step.lead ? $t(leadFor(step)) : '';
    const sig = [text, ring, done, cap].join('|');
    if (ui.leadSig === sig) return;
    ui.leadSig = sig;
    ui.lead.textContent = '';
    ui.lead.append(richText(text));
    ui.ringI.hidden = !ring;
    ui.l2.classList.toggle('done', done);
    ui.l2.classList.toggle('caption', cap);
    paintNext(ui);
  }
  // The polite live region (SPEC 1.3): "Basics, step 5 of 10. Draw a shape. Choose Disc, then drag in X." (the lead on a
  // read step)
  function announce(r, ch, step) {
    const tr = tryOf(step);
    const end = (t) => (/[.!?…]\s*$/.test(t) ? t.trim() : t.trim() + '.');
    const line = tr ? plainCopy(tryFor(tr), modKey()) : step.lead ? plainCopy($t(leadFor(step)), modKey()) : '';
    // (what the tour changed in the user's settings for this step, and that they come back, is said to a screen reader: the
    // Details panel that showed it as text is gone)
    const notes = (r.picNote && step.pictures ? ' ' + $t('The tour turns the cards\' pictures on for this step; your setting comes back after it.') : '')
      + (r.sndNote && step.hear ? ' ' + $t('The tour turns Hear the function on for this step; your setting comes back after it.') : '');
    r.ui.live.textContent = $t('{chapter}, step {k}. {title}. ', { chapter: $t(ch.title), k: r.countText, title: stepTitle(step) }) + (line ? end(line) : '') + notes;
  }
  // a lit control smaller than 48 x 48 px pulses its ring once when the step appears (none with reduced motion)
  function pulseSmall(r) {
    const ui = r.ui;
    clearTimeout(ui.pulseT);
    ui.ringG.classList.remove('pulse');
    if (reduced() || !r.tgt) return;
    const els = [r.el, ...ctlOf(r.step).map((a) => anchorEl(a))].filter(Boolean);
    if (!els.some((e) => { const b = e.getBoundingClientRect(); return b.width > 1 && b.width < 48 && b.height < 48; })) return;
    void ui.ringG.getBoundingClientRect();
    ui.ringG.classList.add('pulse');
    ui.pulseT = setTimeout(() => ui.ringG.classList.remove('pulse'), 950);
  }

  // The lit areas of a step: its anchor's parts and its `also` areas, each exactly its visible box (step.pad grows them
  // when a step asks), with its corner radii; an anchor inside a lit panel is the mark.
  // the lit parts: the anchor's, then its `also` areas and the areas its Try it names (try.work), each once
  function litParts(step, tgt) {
    const parts = /** @type {{ el: any, rect?: any }[]} */ (tgt.parts.slice());
    // (try.work names parts of the touch task: review-phone phone-2, the lens in the sheet the first tap opens)
    const ctl = new Set(ctlOf(step));
    for (const a of [].concat(step.also || [], ctlOf(step), workOf(step))) {
      const t = anchorOf(a);
      if (t) for (const q of /** @type {{ el: any, rect?: any }[]} */ (t.parts)) if (!parts.some((x) => x.el === q.el && !x.rect && !q.rect) && !covered(q.el) && !(ctl.has(a) && underLayer(q.el))) parts.push(q);
    }
    return parts;
  }
  // a Try it's control under an open layer it is not in (a phone's tool row under the Editor sheet) is not lit:
  // it cannot be reached there, and the step has switched to it already
  function underLayer(e) {
    const lay = layerEls().filter((k) => !k.contains(e));
    if (!lay.length || typeof document.elementsFromPoint !== 'function') return false;
    const b = e.getBoundingClientRect();
    const hit = document.elementsFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2).find((h) => !h.closest('[data-tour]'));
    return !!hit && lay.some((k) => k.contains(hit));
  }
  function holesFor(step, tgt) {
    if (!tgt) return { holes: [], mark: null, insets: [] };
    const pad = step.pad != null ? step.pad : 0;
    // (a part clipped away has no hole: never an empty line where the anchor would be)
    const rects = litParts(step, tgt).map((q, i) => (i > 0 ? sideCut(q.el, partRect(q, pad)) : partRect(q, pad))).filter((q, i) => !q.hidden && (i === 0 || (q.r - q.l > 0.5 && q.b - q.t > 0.5)));
    return areasOf(rects, true);
  }
  // (r3 review fix pass) a lit part beside the anchor that an open layer covers along one whole side, X under the left
  // drawer the step opened at 768-1023 px, is lit only where it shows: cut back to the layer's edge, square corners
  // there. Not on a phone, whose sheets the spotlight is drawn into (hostPlan)
  function sideCut(e, q) {
    if (!e || phoneLayout() || q.hidden) return q;
    let els = null;
    try { if (fn('layers')) els = api.layers(); } catch (x) { els = null; }
    for (const k of [...(els || [])]) {
      if (!k || !k.getBoundingClientRect || k === e || k.contains(e) || e.contains(k) || (k.closest && k.closest('[data-tour]')) || !visible(k)) continue;
      const b = k.getBoundingClientRect();
      if (b.right <= q.l + 0.5 || b.left >= q.r - 0.5 || b.bottom <= q.t + 0.5 || b.top >= q.b - 0.5) continue;
      const spanV = b.top <= q.t + 0.5 && b.bottom >= q.b - 0.5, spanH = b.left <= q.l + 0.5 && b.right >= q.r - 0.5;
      const rad = q.rad.slice();   // [top-left, top-right, bottom-right, bottom-left]
      if (spanV && b.left <= q.l + 0.5 && b.right < q.r - 1) { q = Object.assign({}, q, { l: b.right }); rad[0] = rad[3] = 0; }
      else if (spanV && b.right >= q.r - 0.5 && b.left > q.l + 1) { q = Object.assign({}, q, { r: b.left }); rad[1] = rad[2] = 0; }
      else if (spanH && b.top <= q.t + 0.5 && b.bottom < q.b - 1) { q = Object.assign({}, q, { t: b.bottom }); rad[0] = rad[1] = 0; }
      else if (spanH && b.bottom >= q.b - 0.5 && b.top > q.t + 1) { q = Object.assign({}, q, { b: b.top }); rad[2] = rad[3] = 0; }
      else continue;
      q.rad = rad;
    }
    return q;
  }
  // the lit areas of rects (the anchor's first when anchorFirst): merged, with their radii, the mark and the insets
  function areasOf(rects, anchorFirst) {
    if (!rects.length) return { holes: [], mark: null, insets: [] };
    const { holes, mark } = litAreas(rects);
    // each hole takes the radii of the part whose box it is (the panel an anchor sits in), else of the part it overlaps most
    const match = (h) => {
      let best = null, bo = -1;
      for (const q of rects) {
        if (Math.max(Math.abs(q.l - h.l), Math.abs(q.t - h.t), Math.abs(q.r - h.r), Math.abs(q.b - h.b)) < 0.5) return q.rad;
        const o = Math.max(0, Math.min(q.r, h.r) - Math.max(q.l, h.l)) * Math.max(0, Math.min(q.b, h.b) - Math.max(q.t, h.t));
        if (o > bo) { bo = o; best = q; }
      }
      return best ? best.rad : [0, 0, 0, 0];
    };
    // (a lit part inside a larger lit area, other than the anchor, X's inset on a phone inside the lit Y, the chain
    // under a merged Inspector: a ring of its own, like the mark)
    const area = (q) => Math.max(0, q.r - q.l) * Math.max(0, q.b - q.t);
    const insets = rects.slice(1).filter((q) => area(q) > 1 && holes.some((h) => q.l >= h.l - 0.5 && q.t >= h.t - 0.5 && q.r <= h.r + 0.5 && q.b <= h.b + 0.5 && area(h) > 1.3 * area(q)))
      .map((q) => ({ l: q.l, t: q.t, r: q.r, b: q.b, rad: q.rad }));
    return { holes: holes.map((h) => Object.assign(h, { rad: match(h) })), mark: anchorFirst && mark ? Object.assign(mark, { rad: rects[0].rad }) : null, insets };
  }

