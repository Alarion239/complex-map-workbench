  // ---- chain editing on the thread ----
  // The chain's own actions (11-pipeline.js: stepMenuItems, moveStep, duplicateStep, removeStep, toggleBypass) are
  // reused; this section is the thread's chips, its menu, the focus after each action, and the step shown alone.
  // The step shown alone: the thread narrows to the plane before it, the step and its own plane (SV.alone, a step index;
  // SV.back the planes the whole chain was on)
  function svPrev(k) { let j = k - 1; while (j >= 1 && S.steps[j - 1].on === false) j--; return Math.max(0, j); }
  function svAloneOk() { const k = SV.alone; return k && S.steps[k - 1] && S.steps[k - 1].on !== false ? k : 0; }
  // the step shown alone before (d = -1) or after (d = 1) step k, bypassed steps skipped; 0 at the chain's ends
  function svAloneNeighbour(k, d) { for (let j = k + d; j >= 1 && j <= S.steps.length; j += d) if (S.steps[j - 1].on !== false) return j; return 0; }
  // the ‹ › after "Whole chain": the walk of a step shown alone. › parks the next step on its first plane (the plane the
  // step shown ends on), ‹ the previous one on its last, so a press at the end it points to changes the thread, not the picture
  function svWalkInfo(d, k) {
    const j = svAloneNeighbour(k, d), off = !j;
    return { j, off, name: d < 0 ? $t('Previous step alone') : $t('Next step alone'),
      tip: off ? (d < 0 ? $t('No step before f{k}', { k: sub(k) }) : $t('No step after f{k}', { k: sub(k) })) : $t('Show f{k} alone', { k: sub(j) }) };
  }
  function svWalkBtn(d, k) {
    const w = svWalkInfo(d, k);
    return h('button', { type: 'button', class: 'sv-awalk' + (w.off ? ' off' : ''), 'data-d': String(d), 'aria-label': w.name, 'aria-disabled': String(w.off), 'data-tip': w.tip, onclick: () => { if (!w.off) svAlone(w.j, d < 0); } }, d < 0 ? '‹' : '›');
  }
  function svAlone(k, last) {
    const st = S.steps[k - 1];
    if (!st || st.on === false) return null;
    if (SV.alone) svKeepView();
    else SV.back = { i: SV.i, T: SV.T };
    SV.anim = null;
    SV.alone = k; SV.i = last ? 1 : 0; SV.g.set(SV.i); SV.g.max = 1;
    SV.sig = svSigNow();
    svApply();
    const live = SV.els.live;
    live.textContent = $t('Showing f{k} alone, from {a} to {b}', { k: sub(k), a: svName(svPrev(k)), b: svName(k) });
    return svEl('whole');
  }
  function svLeaveAlone(focus) {
    if (!SV.alone) return;
    const k = SV.alone, b = SV.back || { i: 0, T: -1 };
    SV.anim = null;
    SV.alone = 0; SV.back = null; SV.T = b.T;
    const P = svPlanes();
    SV.i = Math.max(0, Math.min(P.length - 1, b.i)); SV.g.set(SV.i); SV.g.max = P.length - 1;
    SV.sig = svSigNow();
    svApply();
    if (focus) { const el = svEl(k, 'chip'); if (el) el.focus({ preventScroll: true }); }
  }
  // after a change in the number of steps, the shown plane and the colour plane stay on their stages: stages from `from` on
  // moved by d (a remove: the removed stage's plane goes to the one before), and a stage that is gone to the one before it
  function svEdit(from, d, n) { SV.shift = { st: svStage(), T: SV.T, alone: SV.alone, from, d, n: n == null ? S.steps.length : n, t: performance.now() }; }
  // a formula step k split into n steps (splitStep): the thread keeps its place, as the planes keep their pictures
  // (Funcs.splitSvPlace). A glide or a play under way is remapped through the same map and goes on from the same picture
  // (svRemapMotion); svSplitEdit is called before the chain changes. An undo of that split while one is under way remaps it
  // back (svRestored, inv)
  function svSplitEdit(k, n) {
    const j = svPlanesOf(S.steps).indexOf(k) - 1;
    SV.split = { k, n, j, x: SV.g.x, rest: !svGliding(), moving: svGliding() };
    SV.lastSplit = { k, n, j, pre: svStepsSig() }; SV.lastUnsplit = null;   // (pre: the chain before the Split, which only its Undo restores)
    SV.own = true;   // (an edit of the chain, not another chain loaded: svChainChanged keeps the planes it shows)
  }
  function svSplitApply(sp) {
    const r = Funcs.splitSvPlace({ x: sp.x, rest: sp.rest, T: SV.T, alone: SV.alone, back: SV.alone ? SV.back : null }, sp.k, sp.n, sp.j);
    SV.T = r.T; SV.alone = r.alone; SV.back = r.back;
    SV.g.max = svPlanes().length - 1;
    if (!SV.alone && sp.rest) { SV.g.set(r.x); SV.i = Math.max(0, Math.min(SV.g.max, Math.round(r.x))); }
    if (SV.lastSplit) SV.lastSplit.sig = svStepsSig();   // (the split chain, which only that Split's Redo restores)
    if (sp.moving) svRemapMotion((x) => Funcs.splitSvPlace({ x, rest: true, T: -1, alone: 0, back: null }, sp.k, sp.n, sp.j).x, (st) => svStepTSplit(st, sp.k, sp.n));
  }
  // the undo of a split under way: the unit [j, j+n) of the n new steps is the formula's [j, j+1) again
  function svUnsplitApply(sp) {
    const { j, n } = sp, pl = (x) => (j < 0 || !(x >= j) ? x : x < j + n ? j + (x - j) / n : x - n + 1);
    SV.T = SV.T < 0 || SV.T < sp.k ? SV.T : SV.T < sp.k + n ? sp.k : SV.T - n + 1;
    SV.g.max = svPlanes().length - 1;
    svRemapMotion(pl, (st) => svStepTJoin(st, sp.k, n));
  }
  // a glide or a play under way after the planes changed (pl: the old place on the thread -> the new one): it goes on from the
  // same place, to the same destination, with no jump. A glide keeps its ease's progress and its time; a play keeps the time
  // it has left, so the picture's speed goes on; a reduced-motion play (a plane a tick) is remapped to its planes.
  // All at once: the glide's progress u in its span is what the picture is a function of, so u is kept, not the place; the
  // span's step times (stepT, retime: the old ones -> the new) run the steps a Split made of a formula as that formula's
  // own homotopy runs them (svBetween), so the picture is the same at the same u, through any number of Splits and their
  // undos and redos. They last to the end of this glide
  function svRemapMotion(pl, retime) {
    const A = SV.anim, B = SV.play, x = SV.g.x, last = svPlanes().length - 1, cl = (v) => Math.max(0, Math.min(last, v));
    SV.motionKept = true;
    const aim = SV.g.moving() ? SV.g.target : null;
    const sp = SV.span;
    let span = null, nx = cl(pl(x));
    if (sp) {
      const x0 = cl(pl(sp.x0)), x1 = cl(pl(sp.x1));
      if (x1 > x0 && svAllOk(x0, x1)) {
        span = { x0, x1 };
        const stepT = retime ? retime(sp.stepT || null) : sp.stepT;
        if (stepT) span.stepT = stepT;
        nx = x0 + (x - sp.x0) / (sp.x1 - sp.x0) * (x1 - x0);
      }
    }
    SV.g.set(nx);
    if (aim != null) SV.g.to(cl(pl(aim)));
    if (A) {
      const el = svElapsed(A), v = Math.min(1, el / A.ms);
      A.e0 = v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
      A.from = SV.g.x; A.to = cl(pl(A.to)); A.held = null; A.drawn = { at: A.from, el };
    }
    if (B) {
      B.steps = S.steps;
      if (B.slide) { B.start = cl(pl(B.start)); B.end = cl(pl(B.end)); } else {
        const left = B.ms * (1 - Math.min(1, svElapsed(B) / B.ms));
        B.from = SV.g.x; B.to = cl(pl(B.to)); B.start = cl(pl(B.start)); B.t0 = performance.now(); B.el = 0; B.ms = Math.max(1, left); B.held = null; B.drawn = { at: B.from, el: 0 };
      }
    }
    if (sp) SV.span = span;
    SV.i = cl(pl(SV.i));
    leftChanged();
  }
  function svShifted() {
    const sp = SV.split;
    if (sp) { SV.split = null; if (sp.inv) svUnsplitApply(sp); else svSplitApply(sp); return; }
    const sh = SV.shift;
    if (!sh) return;
    if (sh.n === S.steps.length && sh.d !== 0) return;   // (a palette that has not changed the count yet, or a replace)
    SV.shift = null;
    if (performance.now() - sh.t > 60000) return;
    const m = (x) => (x < 0 ? x : sh.d === 0 ? (x === sh.from ? x - 1 : x) : sh.d > 0 ? (x >= sh.from ? x + 1 : x) : x > sh.from ? x - 1 : x === sh.from ? x - 1 : x);
    if (sh.alone) SV.alone = sh.d < 0 && sh.alone === sh.from ? 0 : m(sh.alone);
    if (SV.alone) return;
    SV.T = m(sh.T);
    const st = m(sh.st), P = svPlanes();
    let i = P.indexOf(st);
    if (i < 0) { i = 0; P.forEach((x, j) => { if (x <= st) i = j; }); }
    SV.i = i; SV.g.set(i);
  }
  // an element of the thread: the chip or the ⋯ of step k, "+ Add function", the "Whole chain" chip
  function svEl(k, part) {
    if (!SV.els) return null;
    const q = (sel) => { const el = SV.els.track.querySelector(sel); return el && el.getClientRects().length ? el : null; };
    if (k === 'add') { const a = SV.els.add; return a && a.getClientRects().length ? a : null; }
    if (k === 'whole') { const pin = SV.els.strip.querySelector('.sv-whole-pin'); return q('.sv-whole') || (pin && pin.getClientRects().length ? pin : null); }
    const sel = `.sv-step[data-k="${k}"] `;
    return (part === 'more' ? q(sel + '.sv-more') : null) || q(sel + '.sv-fchip');
  }
  // the focus an action asks for, applied when the thread has been rebuilt (never <body>)
  function svWant(k, part) { SV.want = { k, part, t: performance.now() }; }
  function svWantFocus() {
    const w = SV.want;
    if (!w) return;
    const go = (late) => {
      if (performance.now() - w.t > 30000) { SV.want = null; return; }
      const a = document.activeElement;
      if (late && a && a !== document.body && !(a.classList && a.classList.contains('sv-add'))) return;
      const el = svEl(w.k, w.part) || svEl('add');
      if (el) el.focus({ preventScroll: true });
    };
    requestAnimationFrame(() => go(false));
    setTimeout(() => { go(true); SV.want = null; }, 200);
  }
  function svAddFn(anchor) {
    SV.shift = null; SV.own = true;
    svWant(S.steps.length + 1, 'chip');
    openPalette(anchor, S.steps.length, { fnOnly: true });
    svWatchPalette();
  }
  // the palette a thread action opened decides whether its edit is the thread's own (SV.own): while it is open, however long
  // the pick takes, the edit that follows is; once it is closed, with no edit made, nothing is pending
  function svWatchPalette() {
    const host = $('popHost');
    if (!host || typeof MutationObserver !== 'function') return;
    let seen = !!host.querySelector('.palette');
    const t0 = performance.now();
    const mo = new MutationObserver(() => {
      const open = !!host.querySelector('.palette');
      if (open) { seen = true; return; }
      if (!seen && performance.now() - t0 < 2000) return;
      mo.disconnect();
      setTimeout(() => { SV.own = false; SV.want = null; SV.shift = null; }, 400);
    });
    mo.observe(host, { childList: true, subtree: true });
  }
  // a menu item's run, for the thread: the focus lands on the chip it is about (a palette it opens keeps the keyboard until
  // it has done its work, and svWant gives the new chip the focus then)
  function svWrap(items, k) {
    return items.map((it) => {
      if (it === 'sep' || !it.run && !it.kids) return it;
      if (it.kids) return Object.assign({}, it, { kids: svWrap(it.kids, k) });
      const run = it.run;
      return Object.assign({}, it, { run: () => {
        SV.shift = null; SV.want = null; SV.own = true;
        if (it.id === 'insert') { svEdit(k + 1, 1); svWant(k + 1, 'chip'); }
        if (it.id === 'replace') svWant(k, 'chip');
        if (it.id === 'dup') { svEdit(k + 1, 1); }
        if (it.id === 'remove') { svRemove(k); return it.id; }
        if (it.id === 'bypass') return svBypass(k);
        if (it.id === 'moveL' || it.id === 'moveR') return svMove(k, it.id === 'moveL' ? -1 : 1);
        let r;
        SV.quiet = true;
        try { r = run(); } finally { SV.quiet = false; }
        if (!SV.want) SV.own = false;
        else if (it.id === 'insert' || it.id === 'replace') svWatchPalette();
        // (what the item says: an element it shows)
        if (r instanceof Element && r.getClientRects().length) return r;
        if (it.id === 'dup') return svEl(k + 1, 'chip');
        // (a palette, a toast's Undo…: the keyboard goes to the chip unless a layer took it)
        return svLayerOpen() ? null : svEl(k, 'chip');
      } });
    });
  }
  // a message for an edit made on the thread (a toast would take the rail for it and hide the thread, with the focus on it): none on a
  // desktop. It is said in the live region; Undo stays in the top bar's Undo button and Ctrl+Z; the focus stays on its chip
  function svQuietToast(msg) {
    if (!SV.on || !SV.els || document.documentElement.classList.contains('ph')) return false;
    const a = document.activeElement, inRail = !!(a && a.closest && a.closest('#svStrip .sv-rail, #svStrip .sv-add'));
    if (!(SV.quiet || SV.want || inRail)) return false;
    SV.els.live.textContent = '';
    setTimeout(() => { if (SV.els) SV.els.live.textContent = msg; }, 30);
    return true;
  }
  // open step k in the Inspector; on a phone its sheet too
  function svInspect(k) {
    inspectStep(k);
    if (document.documentElement.classList.contains('ph') && typeof Phone !== 'undefined' && Phone.open) Phone.open('edit');
  }
  // a menu a long press raised: clear of the finger where it fits, and deaf for 450 ms to the lift that ends the press
  // (a tall menu opened under the finger would otherwise activate the item it landed on)
  function svClearOf(pop, x, y, chip) {
    if (!pop || !pop.getBoundingClientRect) return;
    const W = window.innerWidth, H = window.innerHeight, pw = pop.offsetWidth, ph = pop.offsetHeight, c = chip.getBoundingClientRect(), M = 8, F = 24;
    const hit = (l, t) => x >= l - F && x <= l + pw + F && y >= t - F && y <= t + ph + F;
    const left0 = parseFloat(pop.style.left) || 0, top0 = parseFloat(pop.style.top) || 0;
    if (!hit(left0, top0)) return;
    const cand = [[left0, c.top - ph - F - M], [left0, c.bottom + F + M], [x - F - pw - M, top0], [x + F + M, top0]];
    for (const [l, t] of cand) {
      if (l < M || t < M || l + pw > W - M || t + ph > H - M || hit(l, t)) continue;
      pop.style.left = l + 'px'; pop.style.top = t + 'px';
      return;
    }
  }
  // (the finger that raised the menu is not a choice: its lift, wherever it comes, however long the press was held or
  // dragged, chooses nothing, and the click that follows it is swallowed, so a lift over the chip never opens its editor.
  // The next tap chooses. A press with no pointer to follow is deaf for 450 ms)
  function svDeaf(pop, id) {
    const t0 = performance.now();
    let lifted = null;
    const lift = (e) => { if (e.pointerId !== id) return; lifted = performance.now(); SV.noClickT = lifted; document.removeEventListener('pointerup', lift, true); document.removeEventListener('pointercancel', lift, true); };
    if (id != null) { document.addEventListener('pointerup', lift, true); document.addEventListener('pointercancel', lift, true); }
    const eat = (e) => {
      const now = performance.now();
      const deaf = id == null ? now - t0 < 450 : lifted == null ? now - t0 < 8000 : now - lifted < 350;
      if (deaf) { e.stopPropagation(); e.preventDefault(); }
    };
    for (const type of ['pointerup', 'click', 'mouseup']) pop.addEventListener(type, eat, true);
  }
  // (stepMenuItems is the list, each item with an id; the steps view's thread orders them its own way, svStepMenu)
  function stepMenuItems(anchor, k, opt) {
    const st = S.steps[k - 1], d = defOf(st);
    // (Replace… first: the palette, ready to replace this step)
    const items = /** @type {any[]} */ ([{ id: 'replace', label: $t('Replace…'), run: () => openPalette(anchor, null, { fnOnly: true, replace: k }) }]);
    // (the Inspector's menu also holds Inverse and Bypass)
    if (opt && opt.full) {
      const b0 = built[k - 1];
      if (!isDerivStep(st, b0)) items.push({ id: 'inverse', label: b0 && b0.inverse ? $t('Replace with the inverse') : $t('No single inverse: show why'), disabled: !b0 || !!b0.error, run: () => inverseAction(k) });
      items.push({ id: 'bypass', label: st.on === false ? $t('Turn this step back on') : $t('Bypass this step'), icon: 'bypass', run: () => toggleBypass(k) }, 'sep');
    }
    items.push(
      // (the keys a focused chip takes, Alt+← / Alt+→; none on a touch screen)
      { id: 'moveL', label: $t('Move left'), icon: 'chevL', key: touchUI() ? '' : 'Alt ←', disabled: k === 1, run: () => moveStep(k, -1) },
      { id: 'moveR', label: $t('Move right'), icon: 'chevR', key: touchUI() ? '' : 'Alt →', disabled: k === S.steps.length, run: () => moveStep(k, 1) },
      { id: 'dup', label: $t('Duplicate'), icon: 'copy', run: () => duplicateStep(k) },
      { id: 'insert', label: $t('Insert a function after it'), icon: 'plus', run: () => openPalette(anchor, k, { fnOnly: true, insert: true }) },
      { label: $t('Replace with derivative'), disabled: isDerivStep(st, built[k - 1]), run: () => derivativeAction(k) },
      { label: $t('Insert d/dz after it'), disabled: !Funcs.DEFS.deriv, run: () => addStep('deriv', null, k) });
    // (which steps the deformation deforms, SPEC 6.5)
    if (!(opt && opt.thread) && activeSteps().length >= 2) items.push({ id: 'deform', label: $t('Deformation'), kids: deformItems(k) });
    // (Repeat × N)
    if (!isDerivStep(st, built[k - 1])) {
      const rk = repeatItems(k);
      // (the thread's menu has no submenu of one: a single choice is the item itself, and a repeated block's two are items)
      if (opt && opt.thread && rk.length === 1) items.push({ id: 'repeat', label: $t('Repeat…'), run: rk[0].run });
      else if (opt && opt.thread && repeatOf(k)) items.push({ id: 'repeat', label: rk[0].label, run: rk[0].run }, { id: 'repeatEnd', label: rk[1].label, run: rk[1].run });
      else if (rk.length) items.push({ id: 'repeat', label: $t('Repeat'), kids: rk });
    }
    if (d.presets) items.push({ label: $t('Presets'), kids: d.presets.map((p) => ({ label: p.label, run: () => { Object.assign(st.params, p.params); chainChanged(true); commit(); } })) });
    const bk = built[k - 1];
    // a formula that is a chain of catalog steps, split into them (or, read as one step, replaced by it)
    if (st.type === 'custom') {
      const sp = Funcs.splitSteps(st, bk), no = sp.kind === 'none' || !!sp.blocked;
      items.push({ label: sp.kind === 'one' ? $t('Replace with “{name}”', { name: Funcs.DEFS[sp.steps[0].type].label }) : $t('Split into steps'), disabled: no, tip: no ? Funcs.splitReason(sp) : null, run: () => splitStep(k) });
    }
    // a polynomial or rational map by its zeros and poles (dragged in the input plane), and back
    if (Funcs.DEFS.zp && (st.type === 'poly' || st.type === 'rational' || (st.type === 'custom' && bk && !bk.error && bk.props && bk.props.rational && !bk.usesCut))) items.push({ label: $t('Write by zeros and poles'), disabled: !!(bk && (bk.error || (bk.props && bk.props.constant))), run: () => convertZp(k, true) });
    if (st.type === 'zp') items.push({ label: $t('Write by coefficients'), disabled: !!(bk && bk.error), run: () => convertZp(k, false) });
    items.push('sep', { id: 'remove', label: $t('Remove'), icon: 'trash', danger: true, run: () => removeStep(k) });
    return items;
  }
  const REPEAT_TYPE_SETTLE_MS = 400;
  function repeatField(getK) {
    const inp = h('input', { class: 'rep-n', type: 'text', inputmode: 'text', autocomplete: 'off', spellcheck: 'false', 'data-tip': $t('Times: a whole number, or a number’s name to run its slider') });
    // (typed for the step it was typed on: a chain or example switch within the settle delay must not take the N)
    let settle = 0, typedFor = null;
    const apply = () => {
      clearTimeout(settle);
      const t = inp.value.trim(), st = typedFor || S.steps[getK() - 1];
      typedFor = null;
      if (!st || !st.repeat || S.steps.indexOf(st) < 0) return;
      const rp = repeatFromText(st, t);
      if (!rp) return;
      st.repeat = rp;
      chainChanged(false);
      repeatMoved(S.steps.indexOf(st) + 1, rp);
    };
    // (while text is being typed the field is the viewer's: repeatShowAll leaves it alone)
    inp.addEventListener('input', () => { inp.dataset.typing = '1'; clearTimeout(settle); typedFor = S.steps[getK() - 1] || null; settle = setTimeout(apply, REPEAT_TYPE_SETTLE_MS); });
    inp.addEventListener('change', () => { delete inp.dataset.typing; apply(); repeatShowAll(); commit(); });
    inp.addEventListener('blur', () => { delete inp.dataset.typing; });
    // (the arrow keys step a typed N, as a number field does)
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      e.preventDefault();
      delete inp.dataset.typing; clearTimeout(settle);
      repeatStep(getK(), e.key === 'ArrowUp' ? 1 : -1);
    });
    repFields.push({ inp, getK });
    return inp;
  }
  // a formula step replaced by the catalog steps it is (Funcs.splitSteps): the
  // same function, so the planes do not change; one commit, undone by Undo
  function splitStep(k) {
    const st = S.steps[k - 1], b = built[k - 1];
    const sp = st && st.type === 'custom' ? Funcs.splitSteps(st, b) : null;
    if (!sp || sp.kind === 'none' || sp.blocked) { sndError(); toast(Funcs.splitReason(sp).replace(/\.?$/, '.')); return null; }
    const news = sp.steps.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: st.on !== false }));
    const n = news.length;
    // the deformation (open on the whole chain): the formula's unit [j, j+1) becomes [j, j+n), its own sub-steps
    let T1 = null;
    // (all at once: one t for every step, kept as it is; the movie runs the new steps together)
    if (morph.open && S.focus === 0) { const j = morphRange().steps.indexOf(k); T1 = S.homAll ? morph.T : j >= 0 ? Funcs.splitMorphT(morph.T, j, n) : morph.T; }
    // the formula shown alone (the palette's flow focuses a new step): the first new step alone is only part of it. With
    // no other step, F is the formula: show F, so the planes stay the same; otherwise the toast says what is shown
    const alone = S.focus === k, only = S.steps.length === 1;
    // (the bracket by index: an end on the split step moves to the new steps' outer one, so all n stay bracketed)
    const hr = S.homRange ? HR.resolve(S, true) : null;
    if (SV.on) svSplitEdit(k, n);
    spliceSteps(k - 1, 1, ...news);
    if (hr) setOpt('homRange', { a: hr.a > k ? hr.a + n - 1 : hr.a, b: hr.b >= k ? hr.b + n - 1 : hr.b });
    if (S.focus > k) setFocusStep(S.focus + n - 1);
    else if (alone && only) setFocusStep(0);
    chainChanged(true);
    if (!SV.on || S.focus) setFocus(S.focus);   // (the steps view's planes share one camera: with no focus, a split does not fit it again)
    setSel(k);
    if (T1 != null && morph.open) { morph.T = T1; requestRender('L', 'R'); }
    commit();
    soundCue('stepAdd');
    tourEmit('formula-split', { k, n });
    requestRender('P');
    const shown = alone && !only && n > 1 ? ' ' + (document.documentElement.classList.contains('ph') ? $t('Showing f{k} alone.', { k: sub(k) }) : $t('Showing f{k} alone; › shows the next step.', { k: sub(k) })) : '';
    undoToast((n === 1 ? $t('f{k} is now the step “{name}”.', { k: sub(k), name: Funcs.DEFS[news[0].type].label })
      : $t('Split f{k} into f{k}–f{k2}: {chain}.', { k: sub(k), k2: sub(k + n - 1), chain: sp.names.join(' → ') })) + shown);
    // (true: split; null is a refusal)
    return true;
  }
  function setMorphPaths(on) {
    if (sndP.on && !!on !== (S.morphPaths !== false)) sndToggleCue(!!on);
    setOpt('morphPaths', !!on);
    const b = $('pathsBtn');
    if (b) syncPathsBtn(b, !!on, b.disabled);
    requestRender('R'); drawLegend(); save();
  }
  // one after another <-> all at once; morph.T goes to the end of the new range of t
  function setHomAll(all) {
    setOpt('homAll', !!all);
    morph.T = morphLen();
    scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); save();
  }
  function svStepMenu(anchor, k, lp) {
    if (!S.steps[k - 1]) return null;
    const now = performance.now();
    if (SV.menuT && now - SV.menuT < 500) return null;   // (a long press and the context menu it raises are one)
    SV.menuT = now;
    const st = S.steps[k - 1], off = st.on === false;
    const raw = stepMenuItems(anchor, k, { full: true, thread: true });
    const by = (id) => raw.find((x) => x && x.id === id);
    const first = /** @type {any[]} */ ([
      { label: $t('Open in the Inspector'), run: () => { svInspect(k); return svEl(k, 'chip'); } },
      { label: $t('Show alone'), disabled: off, tip: off ? $t('Turn this step back on first.') : null, run: () => svAlone(k) }]);
    // (on a phone the walk of the step shown alone is in its menu: the thread has no room for ‹ ›)
    if (svAloneOk() === k && document.documentElement.classList.contains('ph')) {
      for (const d of [-1, 1]) { const w = svWalkInfo(d, k); first.push({ label: w.name, disabled: w.off, tip: w.off ? w.tip : null, run: () => svAlone(w.j, d < 0) }); }
    }
    first.push('sep');
    const used = new Set(['inverse', 'bypass', 'moveL', 'moveR', 'dup', 'insert', 'replace', 'remove']);
    const rest = raw.filter((x) => x !== 'sep' && !(x.id && used.has(x.id)));
    const items = first.concat([by('bypass'), by('moveL'), by('moveR'), by('dup'), by('insert'), 'sep', by('replace'), by('inverse')].filter(Boolean), rest, ['sep', by('remove')]);
    // (a separator is never first, last or doubled)
    const out = [];
    for (const it of items) { if (it === 'sep' && (!out.length || out[out.length - 1] === 'sep')) continue; out.push(it); }
    while (out.length && out[out.length - 1] === 'sep') out.pop();
    const wrapped = svWrap(out, k);
    // (removing: svRemove has done it; the item's own run is not called again)
    wrapped.menuLabel = $t('More actions for f{x}', { x: sub(k) });
    const pop = openMenu(anchor, wrapped);
    if (pop && lp) { svDeaf(pop, lp.id); svClearOf(pop, lp.x, lp.y, anchor); }
    return pop;
  }
  function svBypass(k) {
    const st = S.steps[k - 1];
    if (!st) return;
    const was = st.on !== false, name = defOf(st).label;
    svEdit(k, 0, -1);
    SV.own = true; SV.quiet = true;
    try {
      toggleBypass(k);
      SV.shift = null; SV.own = false;
      undoToast(was ? $t('Bypassed f{x} ({name}).', { x: sub(k), name }) : $t('Turned f{x} back on.', { x: sub(k) }));
    } finally { SV.quiet = false; }
    return svEl(k, 'more');
  }
  function svMove(k, d) {
    const n = S.steps.length, j = k + d;
    if (j < 1 || j > n) return null;
    if (SV.alone === k) SV.alone = j; else if (SV.alone === j) SV.alone = k;
    SV.own = true; SV.quiet = true;
    let r;
    try { r = moveStep(k, d); } finally { SV.quiet = false; SV.own = false; }
    return r ? svEl(j, 'chip') : null;
  }
  function svRemove(k) {
    const n = S.steps.length;
    if (!S.steps[k - 1]) return;
    svEdit(k, -1);
    SV.own = true; SV.quiet = true;
    try { removeStep(k); } finally { SV.quiet = false; }
    SV.shift = null; SV.own = false;
    svWant(k > 1 ? k - 1 : n > 1 ? 1 : 'add', k > 1 ? 'more' : 'chip');
    svWantFocusNow();
  }
  function svWantFocusNow() {
    const w = SV.want;
    SV.want = null;
    if (!w) return;
    const el = svEl(w.k, w.part) || svEl('add');
    if (el) el.focus({ preventScroll: true });
  }
  // On a phone the selected step's chip and ⋯ are brought whole into the rail, moving it as little as it takes; a rail that shows
  // them whole stays as it is, and selecting the step already revealed does nothing. svSync then holds the rail there until the
  // ring moves from where it was at the selection (after a rebuilt chain, from where it is next). Called at each selection and
  // after the chain's strip is rebuilt (`force`).
  function svRevealSel(force) {
    const E = SV.els;
    if (!E || !E.track || SV.alone || !document.documentElement.classList.contains('ph')) return;
    const k = S.sel, stepEl = typeof k === 'number' ? E.track.querySelector(`.sv-step[data-k="${k}"]`) : null;
    if (!stepEl || (k === E.revealed && !force)) return;
    E.revealed = k;
    const rail = E.rail, a = stepEl.offsetLeft, s = rail.scrollLeft, w = rail.clientWidth;
    const to = Math.max(0, Math.min(rail.scrollWidth - w, Math.min(Math.max(s, a + stepEl.offsetWidth - w), a)));
    svRailTo(E, to, s);
    E.hold = { tx: force ? null : E.tx ?? null, aim: to };
  }
  // the F chip says whether F is the selected step (S.sel); read by selectStep, so a selection by any route shows
  function svFSync() {
    svRevealSel();
    const f = SV.on && SV.els && SV.els.wholeMap;
    if (!f) return;
    const on = String(S.sel === 'F');
    if (f.getAttribute('aria-pressed') !== on) f.setAttribute('aria-pressed', on);
  }
  // a control that can't act now: disabled, with `why` as its tip and description; `tip` is its tip while it can act
  function svDisableWhy(btn, why, tip) {
    if (why) btn.setAttribute('aria-disabled', 'true'); else btn.removeAttribute('aria-disabled');   // (not `disabled`: a press still reaches the long-press tip, and the keyboard still finds the reason)
    btn.setAttribute('data-tip', why || tip);
    if (why) btn.setAttribute('aria-description', why); else btn.removeAttribute('aria-description');
  }
  // whether a control set by svDisableWhy can't act now
  const svOff = (btn) => btn.getAttribute('aria-disabled') === 'true';
  // a chip of the thread: a function's letter (fk, html) and its name, a step's and F's
  function svChipBtn(cls, attrs, fk, name) {
    return h('button', Object.assign({ type: 'button', class: cls }, attrs), h('span', { class: 'sv-fk', html: fk }), h('span', { class: 'sv-fn' }, name));
  }
  // a step's chip: its pill (the chip opens the step, ⋯ its menu), with the step's keys
  function svStepEl(k) {
    const st = S.steps[k - 1], d = defOf(st), off = st.on === false, name = cardName(st, d);
    const chip = svChipBtn('sv-fchip', { 'data-tip': `${name} · ${$t('Edit step {k}', { k })}`,
      'aria-label': `f${sub(k)} ${name}${off ? $t(', bypassed') : ''}: ${$t('Edit step {k}', { k })}`, onclick: (e) => { e.stopPropagation(); svInspect(k); } },
    `<i>f</i><sub>${k}</sub>`, name);
    const more = h('button', { type: 'button', class: 'sv-more', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'data-tip': $t('More'), 'aria-label': $t('More for f{x} {name}', { x: sub(k), name }), html: ICONS.more,
      onclick: (e) => { e.stopPropagation(); svStepMenu(e.currentTarget, k); } });
    // (a repeated block: its chips are marked, and the last one carries the count, ×N)
    const rb = repeatOf(k);
    const badge = rb && rb.b === k ? h('span', { class: 'sv-rep', 'aria-hidden': 'true' }, `×${rb.by ? Params.display(rb.by) : rb.n}`) : null;
    if (rb) chip.setAttribute('aria-label', `${chip.getAttribute('aria-label')}, ${rb.a === rb.b ? $t('Repeat f{k}: times', { k: sub(rb.b) }) : $t('Repeat f{a}–f{b}: times', { a: sub(rb.a), b: sub(rb.b) })} ${rb.by ? Params.display(rb.by) : rb.n}`);
    const wrap = h('span', { class: 'sv-fwrap' + (off ? ' off' : '') + (rb ? ' rep' + (rb.a === k ? ' rep-a' : '') : '') }, chip, badge, more);
    wrap.addEventListener('keydown', (e) => {
      const ed = stepEditKey(e);
      if (ed && ed.move) {
        e.preventDefault(); e.stopPropagation();
        const el = svMove(k, ed.move);
        if (el) el.focus({ preventScroll: true });
      } else if (ed && ed.remove) { e.preventDefault(); e.stopPropagation(); svRemove(k); }
      else if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) { e.preventDefault(); e.stopPropagation(); svStepMenu(/** @type {HTMLElement} */ (e.target), k); }
    });
    // (right-click, and the touch's long press: the phone's chips have no ⋯)
    let touch = null;
    wrap.addEventListener('contextmenu', (e) => { e.preventDefault(); svStepMenu(chip, k, touch && performance.now() - touch.t < 1500 ? touch : null); });
    let lp = null;
    const lpOff = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
    wrap.addEventListener('pointerdown', (e) => {
      lpOff();
      if (e.pointerType === 'touch') touch = { x: e.clientX, y: e.clientY, id: e.pointerId, t: performance.now() };
      if (e.pointerType !== 'touch' || e.target.closest('.sv-more')) return;
      lp = { x: e.clientX, y: e.clientY, id: e.pointerId, t: setTimeout(() => {
        const at = { x: lp.x, y: lp.y, id: lp.id };
        lp = null;
        SV.noClickT = performance.now();
        svStepMenu(chip, k, at);
      }, 450) };
    });
    wrap.addEventListener('pointermove', (e) => { if (lp && e.pointerId === lp.id && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) lpOff(); });
    wrap.addEventListener('pointerup', lpOff); wrap.addEventListener('pointercancel', lpOff);
    // (the click that ends a long press is not a press on the chip)
    chip.addEventListener('click', (e) => { if (SV.noClickT && performance.now() - SV.noClickT < 800) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
    return h('div', { class: 'sv-step' + (off ? ' off' : ''), 'data-k': String(k) }, wrap);
  }
