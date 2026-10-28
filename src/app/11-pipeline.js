  // ---------------- pipeline (function chain) ----------------
  const cardRefs = [];
  let dragStep = 0;
  const fsub = (k) => `<i>f</i><sub>${k}</sub>`;
  const wsub = (k) => (k === 0 ? '<i>z</i>' : `<i>w</i><sub>${k}</sub>`);
  function connector(k) {
    // the arrow between stage k-1 and stage k; its + inserts a new step at that position
    const where = k === 1 ? $t('at the start') : $t('after f{x}', { x: sub(k - 1) });
    const plus = h('button', { class: 'conn-add', tabindex: -1, 'data-tip': $t('Insert a function {where}', { where }), 'aria-label': $t('Insert a function {where}', { where }), html: ICONS.plus,
      onclick: (e) => { e.stopPropagation(); openPalette(e.currentTarget, k - 1, { fnOnly: true, insert: true }); } });
    // (v15, review design-14: the connectors are pictures in the listbox, not options; their + is a pointer
    // shortcut, the keyboard has Insert a function after it in a step's ⋯)
    const el = h('div', { class: 'conn', 'data-conn': k, 'aria-hidden': 'true' },
      h('span', { class: 'conn-var', html: wsub(k - 1) }),
      h('span', { class: 'conn-line', html: '<svg viewBox="0 0 36 10" aria-hidden="true"><path d="M1 5h31M28 1.5L32.5 5 28 8.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      h('span', { class: 'conn-f', html: k <= S.steps.length ? (isDerivStep(S.steps[k - 1]) ? 'd/d<i>z</i>' : fsub(k)) : '' }), plus);
    // dropping a dragged card here moves it to position k
    el.addEventListener('dragover', (e) => { if (dragStep) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); el.classList.remove('drop');
      const from = dragStep; dragStep = 0;
      if (!from) return;
      const to = from < k ? k - 2 : k - 1; // index after removal
      if (to === from - 1) return;
      const [st] = S.steps.splice(from - 1, 1);
      S.steps.splice(to, 0, st);
      chainChanged(true); setFocus(to + 1); commit();
    });
    return el;
  }
  // ---------------- v16: the deformation's bracket over the chain (notes/deform-range/SPEC.md 6) ----------------
  // Shown while the transport is open on the whole chain with two or more active steps: a line in the chain bar's top
  // padding from connector a to connector b + 1, its ends two sliders (dragged on desktop and tablet; drawn only on a
  // phone, where the Display sheet's Deformed steps row sets it)
  const brOn = () => morph.open && S.focus === 0 && activeSteps().length >= 2;
  const brPhone = () => document.documentElement.classList.contains('ph');
  let brDrag = null, brRO = null;
  function brDragging() { try { return !!brDrag; } catch (e) { return false; } }
  const fUni = (k) => 'f' + sub(k);
  // runs of consecutive active steps as text or HTML: f₁–f₃, f₅
  function stepRuns(ks, html) {
    const f = (k) => (html ? `<i>f</i>${sub(k)}` : fUni(k)), out = [];
    for (let i = 0; i < ks.length;) { let j = i; while (j + 1 < ks.length && ks[j + 1] === ks[j] + 1) j++; out.push(j > i ? `${f(ks[i])}–${f(ks[j])}` : f(ks[i])); i = j + 1; }
    return out.join(', ');
  }
  // (review v16 verify-1) the phone's Deformed steps row lives in the Display sheet once moved there, so a rebuilt
  // dock does not replace it: every such row follows the bracket here (its selects and its 'from ...' line)
  function syncRangeRows() {
    for (const b of document.querySelectorAll('.tsteps')) { const t = stepsLabel(); if (b.textContent !== t) b.textContent = t; }
    const rows = document.querySelectorAll('.trange');
    if (!rows.length) return;
    const r = homRangeOk() || { a: 1, b: nSteps() };
    let fromHtml = null;
    for (const row of rows) {
      const sels = row.querySelectorAll('select');
      if (sels[0] && sels[0].value !== String(r.a)) sels[0].value = String(r.a);
      if (sels[1] && sels[1].value !== String(r.b)) sels[1].value = String(r.b);
      const fr = row.querySelector('.tr-from');
      if (fr) {
        if (fromHtml == null) { try { fromHtml = $t('from {v}', { v: subTags(rangeStart('html')) }); } catch (e) { fromHtml = ''; } }
        if (fromHtml && fr.innerHTML !== fromHtml) fr.innerHTML = fromHtml;
      }
    }
  }
  // ([v17 UX64]) the bracketed cards are tinted while the bracket shows fewer than every step
  function tintBracketed() {
    const hr = brOn() ? homRangeOk() : null;
    cardRefs.forEach((c, k) => { if (c && c.root) c.root.classList.toggle('br-in', !!hr && k >= hr.a && k <= hr.b); });
  }
  function updateBracket() {
    syncRangeRows();
    tintBracketed();
    const host = $('pipeline');
    if (!host) return;
    let L = $('chainBracket');
    if (!brOn()) {
      if (L) L.hidden = true;
      for (const c of host.querySelectorAll('.conn.br-at')) c.classList.remove('br-at');
      return;
    }
    if (!L) {
      // ([v17 UX64] the bracket says what it deforms, "Deforming f₁–f₂", with an All steps reset, while it brackets
      // fewer than every step)
      const all = h('button', { class: 'br-all', type: 'button', 'data-tip': $t('Deform every step'), onclick: (e) => { e.stopPropagation(); chooseRange(null); } }, $t('All steps'));
      L = h('div', { class: 'chain-bracket', id: 'chainBracket' }, h('div', { class: 'br-line', 'aria-hidden': 'true', 'data-tip': $t('Drag either end to choose the deformed steps') }), brHandle('l'), brHandle('r'),
        h('div', { class: 'br-label' }, h('span', { class: 'br-what' }), all));
      const add = $('addStepBtn');
      if (add && add.parentNode === host) host.insertBefore(L, add); else host.append(L);
      if (!brRO && typeof ResizeObserver !== 'undefined') { brRO = new ResizeObserver(() => requestAnimationFrame(placeBracket)); brRO.observe(host); }
    }
    L.hidden = false;
    placeBracket();
  }
  function placeBracket() {
    const L = $('chainBracket'), host = $('pipeline');
    if (!L || L.hidden || !host) return;
    const n = nSteps(), r = homRangeOk() || { a: 1, b: n };
    const ca = host.querySelector(`.conn[data-conn="${r.a}"]`), cb = host.querySelector(`.conn[data-conn="${r.b + 1}"]`);
    if (!ca || !cb) return;
    const ph = brPhone(), drop = ph ? 14 : host.classList.contains('compact') ? 10 : 20;
    const x0 = Math.round(ca.offsetLeft + ca.offsetWidth / 2), x1 = Math.round(cb.offsetLeft + cb.offsetWidth / 2);
    const top = ph ? Math.max(0, Math.round(ca.offsetTop) - 5) : 3;
    const line = L.querySelector('.br-line');
    Object.assign(line.style, { left: x0 + 'px', width: Math.max(2, x1 - x0) + 'px', top: top + 'px', height: drop + 'px' });
    const st = HR.stops(S);
    for (const [el, c, v, ok] of [[L.querySelector('.br-end.l'), ca, r.a, st.okA], [L.querySelector('.br-end.r'), cb, r.b, st.okB]]) {
      Object.assign(el.style, { left: Math.round(c.offsetLeft) + 'px', width: Math.round(c.offsetWidth) + 'px', top: '0px', height: Math.round(c.offsetTop + c.offsetHeight) + 'px' });
      el.setAttribute('aria-valuenow', String(v)); el.setAttribute('aria-valuetext', fUni(v));
      el.setAttribute('aria-valuemin', String(Math.min(...ok))); el.setAttribute('aria-valuemax', String(Math.max(...ok)));
    }
    for (const c of host.querySelectorAll('.conn.br-at')) if (c !== ca && c !== cb) c.classList.remove('br-at');
    ca.classList.add('br-at'); cb.classList.add('br-at');
    // the label over the line's middle, on the phone too (its ends are drawn only there); hidden on every step
    const lab = /** @type {HTMLElement} */ (L.querySelector('.br-label')), what = lab.querySelector('.br-what'), part = !!homRangeOk() && !ph;
    lab.hidden = !part;
    if (part) {
      const html = bracketWords('html');
      if (what.innerHTML !== html) what.innerHTML = html;
      lab.style.left = Math.round((x0 + x1) / 2) + 'px';
    }
  }
  // ([v17 UX64]) what the bracket deforms in words: "Deforming f₁–f₂" (the active steps inside it); null on every step
  function bracketWords(fmt) {
    const r = homRangeOk();
    if (!r) return null;
    const ks = activeSteps().filter((k) => k >= r.a && k <= r.b);
    return $t('Deforming {steps}', { steps: stepRuns(ks, fmt === 'html') });
  }
  function brHandle(side) {
    const el = h('div', { class: 'br-end ' + side, role: 'slider', tabindex: 0, 'aria-orientation': 'horizontal',
      'aria-label': side === 'l' ? $t('First deformed step') : $t('Last deformed step'),
      'data-tip': side === 'l' ? $t('Drag to choose the first deformed step') : $t('Drag to choose the last deformed step') });
    el.addEventListener('pointerdown', (e) => brDown(e, side, el));
    el.addEventListener('keydown', (e) => brKey(e, side, el));
    return el;
  }
  // the candidate bracket when end `side` goes to step v, clamped to its stops (the other end, the d/dz)
  function brCand(side, v) {
    const n = nSteps(), r = homRangeOk() || { a: 1, b: n }, d = HR.lastDeriv();
    if (side === 'l') return { a: Math.max(1, Math.min(r.b, v)), b: r.b, stop: false };
    const lo = Math.max(r.a, d, 1);
    return { a: r.a, b: Math.max(lo, Math.min(n, v)), stop: d > 0 && v < d && d >= r.a };
  }
  function brTip(el, side, stop) {
    const t = stop ? $t('A d/dz step differentiates the whole chain before it, so it cannot come after the deformed steps.') : side === 'l' ? $t('Drag to choose the first deformed step') : $t('Drag to choose the last deformed step');
    if (el.dataset.tip !== t) el.dataset.tip = t;
    if (stop) el.setAttribute('aria-description', t); else el.removeAttribute('aria-description');
  }
  function brSet(c, preview) {
    const cur = homRangeOk() || { a: 1, b: nSteps() };
    if (c.a === cur.a && c.b === cur.b) return false;
    setHomRange({ a: c.a, b: c.b }, { preview });
    if (!preview) playNewRange();
    return true;
  }
  // ([v17 UX64]) a bracket the user just chose plays from its start, so the change shows; not under reduced motion
  function playNewRange() {
    if (morph.open && !morph.playing && !matchMedia('(prefers-reduced-motion: reduce)').matches) togglePlay();
  }
  function brKey(e, side, el) {
    const n = nSteps(), r = homRangeOk() || { a: 1, b: n }, v = side === 'l' ? r.a : r.b;
    let to = null;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') to = v - 1;
    else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') to = v + 1;
    else if (e.key === 'Home') to = 1;
    else if (e.key === 'End') to = n;
    if (to == null) return;
    e.preventDefault(); e.stopPropagation();
    const c = brCand(side, to);
    brTip(el, side, c.stop);
    brSet(c, false);
    const again = $('chainBracket') && $('chainBracket').querySelector('.br-end.' + side);
    if (again && document.activeElement !== again) again.focus({ preventScroll: true });
  }
  function brDown(e, side, el) {
    if (brPhone() || e.button !== 0 || window.innerWidth < 768) return;
    e.preventDefault(); e.stopPropagation();
    const r = homRangeOk();
    brDrag = { side, el, held: r ? { a: r.a, b: r.b } : null, pid: e.pointerId };
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
    $('chainBracket').classList.add('drag'); el.classList.add('drag');
    const move = (ev) => {
      if (!brDrag) return;
      const host = $('pipeline'), hb = host.getBoundingClientRect(), x = ev.clientX - hb.left + host.scrollLeft;
      let j = 1;
      for (let k = 1; k <= nSteps(); k++) { const c = host.querySelector(`.card[data-k="${k}"]`); if (c && c.offsetLeft + c.offsetWidth / 2 < x) j = k + 1; }
      const c = brCand(side, side === 'l' ? j : j - 1);
      brTip(el, side, c.stop);
      if (brSet(c, true) && sndP.ui !== false) soundCue('snap');
    };
    const end = (commit) => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', cancel); window.removeEventListener('keydown', esc, true);
      const L = $('chainBracket'); if (L) L.classList.remove('drag'); el.classList.remove('drag');
      const held = brDrag && brDrag.held;
      brDrag = null;
      if (commit) { const r = homRangeOk(); setHomRange(r ? { a: r.a, b: r.b } : null, { force: true }); playNewRange(); }
      else setHomRange(held, { force: true });
    };
    const up = () => end(true), cancel = () => end(true);
    const esc = (ev) => { if (ev.key === 'Escape' && brDrag) { ev.preventDefault(); ev.stopPropagation(); end(false); } };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', cancel); window.addEventListener('keydown', esc, true);
  }
  // the ⋯ menu's Deformation ▸ (SPEC 6.5): Only f_k inside F, Steps f_k–f_n, Steps f_1–f_k, Every step; deduped by
  // their normal forms; disabled with the reason when the d/dz rule moves b past the item's end or f_k is bypassed
  function deformItems(k) {
    const n = nSteps(), cur = homRangeOk(), off = S.steps[k - 1] && S.steps[k - 1].on === false, ph = brPhone();
    // (review v16 user-2: F is italic like f_k; the start, 'from f₃(w₁)', is set in the label's math face)
    const itF = (x) => x.replace(/(^|[\s(])F(?=$|[\s,.)])/g, '$1<i>F</i>');
    const cand = [
      [{ a: k, b: k }, itF($t('Only {f}, inside F', { f: fsub(k) })), $t('Only {f}, inside F', { f: fUni(k) })],
      [{ a: k, b: n }, $t('Steps {f1}–{f2}', { f1: fsub(k), f2: fsub(n) }), $t('Steps {f1}–{f2}', { f1: fUni(k), f2: fUni(n) })],
      [{ a: 1, b: k }, $t('Steps {f1}–{f2}', { f1: fsub(1), f2: fsub(k) }), $t('Steps {f1}–{f2}', { f1: fUni(1), f2: fUni(k) })],
    ];
    const items = [], seen = new Set();
    const key = (r) => (r ? `${r.a}-${r.b}` : 'all');
    for (const [r, html, plain] of cand) {
      const nf = off ? null : HR.normal(r.a, r.b);
      let dis = null;
      if (off) dis = $t('Turn this step back on first.');
      else if (nf && nf.b > r.b) dis = $t('A d/dz step differentiates the whole chain before it, so it cannot come after the deformed steps.');
      const kk = off ? `raw${r.a}-${r.b}` : key(nf);
      if ((!off && !nf) || seen.has(kk) || (off && r.a === 1 && r.b === n)) continue;
      seen.add(kk);
      const from = !dis && nf && !ph ? $t('from {v}', { v: rangeStart('text', partsOf(nf)) }) : '';
      const fromH = from ? $t('from {v}', { v: subTags(rangeStart('html', partsOf(nf))) }) : '';
      items.push({ label: plain, labelEl: h('span', { class: 'mi-label', html }), radio: true, checked: !dis && !!cur && !!nf && cur.a === nf.a && cur.b === nf.b, disabled: !!dis, tip: dis, key: from, keyHtml: fromH, run: () => chooseRange(nf) });
    }
    items.push({ label: $t('Every step'), radio: true, checked: !cur, key: '', run: () => chooseRange(null) });
    return items;
  }
  function chooseRange(r) {
    if (S.focus > 0) setFocus(0);
    setHomRange(r);
    if (!morph.open) openTransport();
    playNewRange();
    return null;
  }
  function regionSummary() {
    const n = S.shapes.length, hid = S.shapes.filter((s) => s.visible === false).length;
    if (!n) return '';
    return $tn('{n} shape', '{n} shapes', n) + (hid ? $t(', {hid} hidden', { hid }) : '');
  }
  function updateRegionCard() {
    const c0 = document.querySelector('#pipeline .region-card');
    if (!c0) return;
    c0.querySelector('.note').textContent = regionSummary();
    const sw = c0.querySelector('.swatches');
    sw.innerHTML = '';
    for (const s of S.shapes.slice(0, 10)) sw.append(h('span', { class: 'swatch' + (s.visible === false ? ' off' : ''), 'data-kind': kindType(s), style: swatchStyle(s) }));
  }
  function buildPipeline() {
    const host = $('pipeline');
    host.innerHTML = '';
    if (insp) insp.invalidate();   // (v15: the Inspector's fields belong to the steps rebuilt here)
    thumbs.clear();
    cardRefs.length = 0;
    // region card (stage 0)
    // (v15: the region card selects the region; a double-click shows the whole chain)
    const c0 = h('div', { class: 'card region-card' + (S.focus === 0 ? ' focus' : ''), 'data-k': 0, tabindex: 0, role: 'option', 'aria-label': $t('Region'),
      onclick: () => cardClick(0), ondblclick: () => setFocus(0), onkeydown: (e) => chainKey(e, 0) },
    h('div', { class: 'card-head' }, h('span', { class: 'idx', html: '<i>z</i>' }), h('span', { class: 'ty', html: Inspector.regionIcon() }), h('span', { class: 'nm' }, $t('Region'))),
    h('div', { class: 'thumb' }, h('canvas'), h('span', { class: 'thumb-var', html: '<i>z</i>' })),
    h('div', { class: 'note' }), h('div', { class: 'swatches' }));
    host.append(c0);
    thumbs.set(0, new Pane(c0.querySelector('canvas')));
    S.steps.forEach((st, i) => {
      const k = i + 1;
      host.append(connector(k));
      const card = makeCard(st, k);
      host.append(card.root);
      cardRefs[k] = card;
      thumbs.set(k, new Pane(card.canvas));
    });
    host.append(connector(S.steps.length + 1));
    host.lastChild.classList.add('conn-last');
    updateBracket();   // (v16: the deformation's bracket, a tab stop after the cards and before the Add tile)
    host.append(h('button', { class: 'add-card' + (S.steps.length <= 3 ? ' labelled' : ''), id: 'addStepBtn', 'data-tip': $t('Add a function  +'), 'aria-label': S.steps.length ? $t('Add function') : $t('Add the first function'), onclick: (e) => openPalette(e.currentTarget, S.steps.length, { fnOnly: true }) },
      h('span', { html: ICONS.plus }), h('span', null, $tx('addcard', 'Add function')), h('span', { class: 'kbd' }, '+')));   // (v16.5 UX22: the label the short chain shows, desk.css)
    host.append(fTile());
    { const cc = $('clearChain'); if (cc) cc.hidden = !S.steps.length; }   // (D1, issue #23: Clear chain in words, with a chain to clear)
    // (v15 review design-14: the listbox owns the options only, the region card, the step cards and F, through
    // aria-owns; the connectors are aria-hidden and the Add tile is its own tab stop after the listbox, not an item in it)
    host.removeAttribute('role'); host.removeAttribute('aria-label');
    const opts = [...host.querySelectorAll(':scope > [role="option"]')];
    for (const o of opts) o.id = 'chainOpt' + (o.classList.contains('ftile') ? 'F' : o.dataset.k);
    host.prepend(h('div', { class: 'chain-lb', id: 'chainListbox', role: 'listbox', 'aria-label': $t('Function chain'), 'aria-orientation': 'horizontal', 'aria-owns': opts.map((o) => o.id).join(' ') }));
    if ($('chainBracket') && $('addStepBtn')) host.insertBefore($('chainBracket'), $('addStepBtn'));
    updateRegionCard();
    updateCards();
    updateFocusUI();
    renderComposeTex();
    requestRender('T');
  }
  // a step of a type this build does not know still gets a card (its error comes from Funcs.build)
  const defOf = (st) => Funcs.DEFS[st.type] || { label: String(st.type), params: [] };
  const cardButton = (k) => document.querySelector(`#pipeline .card[data-k="${k}"] .nm`);
  function stepMenu(anchor, k, opt) {
    const st = S.steps[k - 1], d = defOf(st);
    // (D1, issue #23: Replace… first: the palette, ready to replace this step)
    const items = /** @type {any[]} */ ([{ label: $t('Replace…'), run: () => openPalette(anchor, null, { fnOnly: true, replace: k }) }]);
    // (v15: the Inspector's menu also holds Inverse and Bypass, which the card shows on hover)
    if (opt && opt.full) {
      const b0 = built[k - 1];
      if (!isDerivStep(st, b0)) items.push({ label: b0 && b0.inverse ? $t('Replace with the inverse') : $t('No single inverse: show why'), disabled: !b0 || !!b0.error, run: () => inverseAction(k) });
      items.push({ label: st.on === false ? $t('Turn this step back on') : $t('Bypass this step'), icon: 'bypass', run: () => toggleBypass(k) }, 'sep');
    }
    items.push(
      // (v16.5 UX97 / UX81: the keys a focused card takes, Alt+← / Alt+→; added by the wave 1 merge, as the learn piece asked;
      // none on a touch screen)
      { label: $t('Move left'), icon: 'chevL', key: touchUI() ? '' : 'Alt ←', disabled: k === 1, run: () => moveStep(k, -1) },
      { label: $t('Move right'), icon: 'chevR', key: touchUI() ? '' : 'Alt →', disabled: k === S.steps.length, run: () => moveStep(k, 1) },
      { label: $t('Duplicate'), icon: 'copy', run: () => duplicateStep(k) },
      { label: $t('Insert a function after it'), icon: 'plus', run: () => openPalette(anchor, k, { fnOnly: true, insert: true }) },
      { label: $t('Replace with derivative'), disabled: isDerivStep(st, built[k - 1]), run: () => derivativeAction(k) },
      { label: $t('Insert d/dz after it'), disabled: !Funcs.DEFS.deriv, run: () => addStep('deriv', null, k) });
    // (v16: which steps the deformation deforms, SPEC 6.5)
    if (activeSteps().length >= 2) items.push({ label: $t('Deformation'), kids: deformItems(k) });
    if (d.presets) items.push({ label: $t('Presets'), kids: d.presets.map((p) => ({ label: p.label, run: () => { Object.assign(st.params, p.params); chainChanged(true); commit(); } })) });
    const bk = built[k - 1];
    // v15.2: a formula that is a chain of catalog steps, split into them (or, read as one step, replaced by it)
    if (st.type === 'custom') {
      const sp = Funcs.splitSteps(st, bk), no = sp.kind === 'none' || !!sp.blocked;
      items.push({ label: sp.kind === 'one' ? $t('Replace with “{name}”', { name: Funcs.DEFS[sp.steps[0].type].label }) : $t('Split into steps'), disabled: no, tip: no ? Funcs.splitReason(sp) : null, run: () => splitStep(k) });
    }
    // a polynomial or rational map by its zeros and poles (dragged in the input plane), and back
    if (Funcs.DEFS.zp && (st.type === 'poly' || st.type === 'rational' || (st.type === 'custom' && bk && !bk.error && bk.props && bk.props.rational && !bk.usesCut))) items.push({ label: $t('Write by zeros and poles'), disabled: !!(bk && (bk.error || (bk.props && bk.props.constant))), run: () => convertZp(k, true) });
    if (st.type === 'zp') items.push({ label: $t('Write by coefficients'), disabled: !!(bk && bk.error), run: () => convertZp(k, false) });
    items.push('sep', { label: $t('Remove'), icon: 'trash', danger: true, run: () => removeStep(k) });
    openMenu(anchor, items);
  }
  // v15 (DESIGN.md 2.4): a click selects (the Inspector edits it); Show alone is its own action (a double-click, L,
  // the lens in the Inspector's head)
  function cardClick(k) { selectStep(k); }
  // (v16.5 UX81) move step k one place and keep the keyboard on its card (the chain is drawn again)
  function moveCard(k, d) {
    if (!moveStep(k, d)) return;
    const c = document.querySelector(`#pipeline .card[data-k="${k + d}"]`);
    if (c) c.focus({ preventScroll: true });
  }
  function chainKey(e, k) {
    if (e.target !== e.currentTarget) return;
    const n = S.steps.length, cur = k === 'F' ? n + 1 : k;
    const go = (j) => { e.preventDefault(); const el = j === n + 1 ? document.querySelector('#pipeline .ftile') : document.querySelector(`#pipeline .card[data-k="${j}"]`); if (el) { el.focus(); selectStep(j === n + 1 ? 'F' : j); } };
    // (v16.5 UX81 / UX97: Alt+← / Alt+→ moves the step one place, as its ⋯ menu's Move left / right, and the moved card
    // keeps the keyboard; the chain and learn pieces built the same key, merged as one)
    if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); e.stopPropagation();
      if (k > 0 && k !== 'F') moveCard(k, e.key === 'ArrowLeft' ? -1 : 1);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(Math.min(n + 1, cur + 1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(Math.max(0, cur - 1));
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n + 1);
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectStep(k); }
    // (the physical L key on any layout: «д» on ЙЦУКЕН; review russian-5)
    else if (String((I18N.keyOf ? I18N.keyOf(e) : e.key) || '').toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey && k > 0 && k !== 'F') { e.preventDefault(); e.stopPropagation(); toggleAlone(k); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && k > 0 && k !== 'F') { e.preventDefault(); e.stopPropagation(); removeStep(k); }
  }
  function makeCard(st, k) {
    const d = defOf(st);
    const stop = (e) => e.stopPropagation();
    const off = st.on === false;
    const invBtn = h('button', { class: 'icon-btn txt', 'data-tip': $t('Replace with the inverse'), 'aria-label': $t('Replace with the inverse function'), html: '<i>f</i><sup>−1</sup>', onclick: (e) => { stop(e); inverseAction(k); } });
    // a d/dz step differentiates the chain so far: no parameters, no inverse
    if (isDerivStep(st)) invBtn.hidden = true;
    const byp = h('button', { class: 'icon-btn bypass', 'aria-pressed': String(off), 'data-tip': off ? $t('Turn this step back on') : $t('Bypass this step'), 'aria-label': $t('Bypass this step'), html: ICONS.bypass,
      onclick: (e) => { stop(e); st.on = st.on === false; chainChanged(true); commit(); if (st.on) startTransition(k); sndToggleCue(st.on); } });
    const more = h('button', { class: 'icon-btn more', 'data-tip': $t('More'), 'aria-label': $t('More actions for f{x}', { x: sub(k) }), 'aria-haspopup': 'menu', html: ICONS.more, onclick: (e) => { stop(e); stepMenu(e.currentTarget, k); } });
    // v15 (DESIGN.md 2.1): a card is its type and a picture; the chain is a listbox, a card an option. Its head shows
    // the index, the type icon and the name (two lines allowed); Bypass and More appear over the name on hover or focus
    const root = h('div', { class: 'card', 'data-k': k, role: 'option', tabindex: 0, 'aria-label': `f${sub(k)}, ${d.label}`, 'aria-selected': 'false',
      onclick: () => cardClick(k), ondblclick: (e) => { if (e.target.closest && e.target.closest('button')) return; setFocus(S.focus === k ? 0 : k); },
      onkeydown: (e) => chainKey(e, k),
      onpointerenter: () => hiStep(k, true), onpointerleave: () => hiStep(k, false) });
    const nm = h('span', { class: 'nm' }, cardName(st, d));
    const head = h('div', { class: 'card-head', draggable: 'true' },
      h('span', { class: 'grip', html: ICONS.grip, 'aria-hidden': 'true' }),
      h('span', { class: 'idx', html: fsub(k) }),
      h('span', { class: 'ty', html: Inspector.typeIcon(st.type), 'aria-hidden': 'true' }),
      nm,
      h('span', { class: 'acts', 'aria-hidden': 'true' }, byp, more));
    byp.tabIndex = -1; more.tabIndex = -1;
    head.addEventListener('dragstart', (e) => {
      if (e.target.closest && e.target.closest('button')) { e.preventDefault(); return; }
      dragStep = k; root.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; $('pipeline').classList.add('card-drag');
      try { e.dataTransfer.setData('text/plain', String(k)); e.dataTransfer.setDragImage(root, 24, 14); } catch (err) { /* ignore */ }
    });
    head.addEventListener('dragend', () => { dragStep = 0; root.classList.remove('dragging'); $('pipeline').classList.remove('card-drag'); for (const c of document.querySelectorAll('.conn.drop')) c.classList.remove('drop'); });
    const canvas = h('canvas');
    const tlab = h('span', { class: 'tlab', 'aria-hidden': 'true' });
    root.append(head, h('div', { class: 'thumb' }, canvas, tlab));
    if (S.focus === k) root.classList.add('focus');
    if (off) root.classList.add('off');
    return { root, canvas, tlab, invBtn };
  }
  // a card's name is its type, whole on at most two lines of the narrowest card (DESIGN.md 2.1): the catalog name, or
  // a shorter one where a word of it would not fit (Möbius: «Мёбиус», not «Дробно-линейная»)
  function cardName(st, d) {
    if (st.type === 'mobius') return $tx('card', 'Möbius');
    if (st.type === 'ijouk') return $tx('card', 'Inverse Joukowski');
    if (st.type === 'blaschke') return $tx('card', 'Disk automorphism');
    // (v15 review russian-2: «Гиперболический» takes three hyphenated lines of a narrow card; the card says «Гиперб.»)
    if (st.type === 'sinh') return $tx('card', 'Hyperbolic sine');
    if (st.type === 'cosh') return $tx('card', 'Hyperbolic cosine');
    if (st.type === 'tanh') return $tx('card', 'Hyperbolic tangent');
    return d.label;
  }
  // the F tile closes the chain (DESIGN.md 2.1, 2.6): F and its lit guarantees; selecting it shows F in the Inspector
  // (review russian-1, design-15: the tile names a property in one short word; the Inspector and the tile's
  // aria-label keep the full names)
  const FT_WORD = () => ({ analytic: $tx('ftile', 'Analytic'), entire: $tx('ftile', 'Entire'), rational: $tx('ftile', 'Rational'), polynomial: $tx('ftile', 'Polynomial'),
    mobius: $tx('ftile', 'Möbius'), proper: $tx('ftile', 'Proper'), homeo: $tx('ftile', 'Homeomorphic'), conformal: $tx('ftile', 'Conformal') });
  function fTile() {
    const fl = h('div', { class: 'fl' });
    const W = FT_WORD();
    for (const [key, name] of BADGES) fl.append(h('span', { class: 'lamp', 'data-lamp': key, hidden: true }, h('span', { class: 'lampname' }, W[key] || name), ' ', h('span', { class: 'lampq' })));
    const t = h('div', { class: 'ftile', role: 'option', tabindex: 0, 'aria-selected': 'false', 'data-tip': $t('F, the whole map: its formula and guarantees'),
      onclick: () => selectStep('F'), onkeydown: (e) => chainKey(e, 'F') },
    h('span', { class: 'fF', 'aria-hidden': 'true' }, 'F', h('span', { class: 'fid' }, '\u2009=\u2009z')), fl, h('span', { class: 'fnone', hidden: true }, $t('No guarantees')));
    return t;
  }
  // the lit names on the F tile: the two strongest (the tooltip and the Inspector list them all)
  function updateFTile() {
    const t = document.querySelector('#pipeline .ftile');
    if (!t) return;
    const act = activeSteps();
    const P = Funcs.composeProps(act.map((k) => built[k - 1].props));
    const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective });
    const lit = Inspector.STRONG.filter((key) => words[key]);
    const show = new Set(lit.slice(0, 2));
    for (const el of t.querySelectorAll('.lamp')) {
      const key = el.dataset.lamp, on = !!words[key];
      el.classList.toggle('on', on);
      el.hidden = !show.has(key);
      const q = el.querySelector('.lampq');
      const qt = on && (key === 'rational' || key === 'polynomial') && P.deg != null ? (P.degExact ? $t('deg {n}', { n: P.deg }) : $t('deg ≤ {n}', { n: P.deg })) : '';
      if (q.textContent !== qt) q.textContent = qt;
    }
    // (the strongest first in the list's order)
    const fl = t.querySelector('.fl');
    for (const key of lit.slice(0, 2).reverse()) { const el = fl.querySelector(`.lamp[data-lamp="${key}"]`); if (el) fl.prepend(el); }
    t.querySelector('.fnone').hidden = lit.length > 0;
    const names = BADGES.filter(([key]) => words[key]).map(([, n]) => n);
    // (v16.5 UX84: an empty chain is the identity: the tile says F = z, not its guarantees)
    const id = !act.length;
    t.classList.toggle('ident', id);
    if (id) for (const el of t.querySelectorAll('.lamp, .fnone')) el.hidden = true;
    t.setAttribute('aria-label', id ? $t('F = z: no steps yet') : names.length ? $t('F: {list}', { list: names.join(', ') }) : $t('F: no guarantees'));
  }
  // dragging horizontally on a label changes a numeric field
  function scrubbable(label, input, step, isInt) {
    label.classList.add('scrub');
    label.title = (label.title ? label.title + ' · ' : '') + $t('drag to change');
    label.style.touchAction = 'pan-y'; // a sideways touch scrubs instead of scrolling the chain
    label.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const x0 = e.clientX, v0 = Number(input.value) || 0;
      let moved = 0;
      try { label.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      const move = (ev) => {
        const dx = ev.clientX - x0;
        moved = Math.max(moved, Math.abs(dx));
        let v = v0 + Math.round(dx / (ev.shiftKey ? 12 : 4)) * step;
        if (isInt) v = Math.round(v);
        if (input.min !== '' && v < +input.min) v = +input.min;
        if (String(v) !== input.value) { input.value = +v.toFixed(6); input.dispatchEvent(new Event('input')); }
      };
      // an ended, cancelled or lost pointer all finish the scrub once: what it applied is committed
      const ends = ['pointerup', 'pointercancel', 'lostpointercapture'];
      const up = () => {
        label.removeEventListener('pointermove', move);
        for (const t of ends) label.removeEventListener(t, up);
        // after a real scrub, the click that follows would activate the label and focus the field, where ⌘Z is
        // the field's own (empty) undo: swallow that one click, so the app's undo takes back the scrub
        if (moved > 2) {
          const swallow = (ce) => { ce.preventDefault(); ce.stopPropagation(); };
          label.addEventListener('click', swallow, { capture: true, once: true });
          setTimeout(() => label.removeEventListener('click', swallow, { capture: true }), 0);
          if (document.activeElement === input) input.blur();
        }
        input.dispatchEvent(new Event('change'));
      };
      label.addEventListener('pointermove', move);
      for (const t of ends) label.addEventListener(t, up);
    });
  }
  // a small Argand diagram to pick a complex value by dragging
  let padEl = null, padOff = null;
  function closePad() {
    if (padOff) { document.removeEventListener('pointerdown', padOff, true); padOff = null; }
    if (padEl) { padEl.remove(); padEl = null; }
  }
  function openArgandPad(anchor, input) {
    closePad();
    let v;
    try { v = Expr.constValue(input.value); } catch (e) { v = C(0, 0); }
    const R = Math.max(2, Axes.niceStep(Math.max(Math.abs(v.re), Math.abs(v.im)) * 1.6 || 2));
    const S2 = 200;
    const cv = h('canvas', { width: S2 * 2, height: S2 * 2, style: `width:${S2}px;height:${S2}px`, tabindex: 0, role: 'application', 'aria-roledescription': $t('Argand diagram'),
      'aria-label': $t('Complex value. Arrow keys move the point, Shift for fine steps; Enter or Esc closes.') });
    const read = h('div', { class: 'pad-read mono', 'aria-live': 'polite' });
    const pad = h('div', { class: 'pop pad', role: 'dialog', 'aria-label': $t('Pick a complex value') }, cv, read, h('div', { class: 'lbl' }, $t('Drag the point, or use the arrow keys. Hold Shift for fine steps.')));
    $('popHost').append(pad);
    padEl = pad;
    const ctx = cv.getContext('2d');
    const toPx = (z) => [S2 / 2 + z.re / R * S2 / 2, S2 / 2 - z.im / R * S2 / 2];
    const draw = () => {
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.fillStyle = TH.plane; ctx.fillRect(0, 0, S2, S2);
      const st = Axes.niceStep(R / 4);
      ctx.strokeStyle = TH.gridMajor; ctx.lineWidth = 1;
      for (let x = -R; x <= R + 1e-9; x += st) { const [px] = toPx(C(x, 0)); ctx.beginPath(); ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, S2); ctx.stroke(); const [, py] = toPx(C(0, x)); ctx.beginPath(); ctx.moveTo(0, py + 0.5); ctx.lineTo(S2, py + 0.5); ctx.stroke(); }
      ctx.strokeStyle = TH.axis;
      ctx.beginPath(); ctx.moveTo(S2 / 2 + 0.5, 0); ctx.lineTo(S2 / 2 + 0.5, S2); ctx.moveTo(0, S2 / 2 + 0.5); ctx.lineTo(S2, S2 / 2 + 0.5); ctx.stroke();
      ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(S2 / 2, S2 / 2, S2 / 2 / R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const [px, py] = toPx(v);
      ctx.strokeStyle = TH.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(S2 / 2, S2 / 2); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = TH.accent; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = TH.plane; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = TH.label; ctx.font = `10px ${TH.mono}`; ctx.textAlign = 'right'; ctx.fillText(`±${I18N.num(CX.fmtNum(R, 3))}`, S2 - 4, S2 - 5);
      read.textContent = ((t) => (I18N.lang === 'en' ? t : t.replace(/(\d)\.(\d)/g, '$1,$2')))(`${CX.fmt(v, 4)}   |·| ${CX.fmtNum(CX.abs(v), 4)}   arg ${CX.fmtNum(Math.atan2(v.im, v.re) / DEG, 2)}°`);
    };
    draw();
    const set = (e) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / S2 * 2 - 1, y = 1 - (e.clientY - r.top) / S2 * 2;
      const st = e.shiftKey ? R / 400 : R / 40;
      v = C(Math.round(x * R / st) * st, Math.round(y * R / st) * st);
      v = C(+v.re.toPrecision(6), +v.im.toPrecision(6));
      input.value = ((t) => (input.dataset.zp || input.dataset.num ? zpShow(t) : t))(CX.fmt(v, 6).replace(/\s/g, ''));
      input.dispatchEvent(new Event('input'));
      draw();
    };
    cv.addEventListener('pointerdown', (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      set(e);
      const ends = ['pointerup', 'pointercancel', 'lostpointercapture'];
      const mv = (ev) => set(ev);
      const up = () => { cv.removeEventListener('pointermove', mv); for (const t of ends) cv.removeEventListener(t, up); input.dispatchEvent(new Event('change')); };
      cv.addEventListener('pointermove', mv); for (const t of ends) cv.addEventListener(t, up);
    });
    // keyboard: arrows nudge on the same grid as dragging; Enter or Esc closes and returns to the opener
    const back = () => { closePad(); if (anchor.isConnected) anchor.focus({ preventScroll: true }); };
    pad.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (e.key !== 'Tab') e.stopPropagation();
      if (d) {
        e.preventDefault();
        const st = e.shiftKey ? R / 400 : R / 40;
        const q = (x, dx) => +Math.max(-R, Math.min(R, Math.round(x / st) * st + dx * st)).toPrecision(6);
        v = C(q(v.re, d[0]), q(v.im, d[1]));
        input.value = ((t) => (input.dataset.zp || input.dataset.num ? zpShow(t) : t))(CX.fmt(v, 6).replace(/\s/g, ''));
        input.dispatchEvent(new Event('input'));
        draw();
      } else if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); back(); }
    });
    pad.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) input.dispatchEvent(new Event('change')); });
    const r = anchor.getBoundingClientRect();
    const pw = pad.offsetWidth, ph = pad.offsetHeight;
    let y = r.top - ph - 6;
    if (y < 12) y = r.bottom + 6;
    pad.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left - pw / 2)) + 'px';
    pad.style.top = Math.max(12, Math.min(window.innerHeight - ph - 12, y)) + 'px';
    cv.focus({ preventScroll: true });
    setTimeout(() => {
      if (padEl !== pad) return;
      // a press outside closes the pad; a press on its opener (or the icon inside it) is the opener's toggle
      padOff = (e) => { if (padEl && !padEl.contains(e.target) && !anchor.contains(e.target)) closePad(); };
      document.addEventListener('pointerdown', padOff, true);
    }, 0);
  }
  // short symbols for parameter labels (the full name is the tooltip)
  const PSYM = { cut: ['θ', $t('Cut angle, in degrees')], k: ['k', $t('Sheet (branch index)')], branch: ['br', $t('Branch')],
    co: ['aₖ', $t('Coefficients aₙ, …, a₀, highest degree first')], p: ['p', $t('Numerator coefficients, highest degree first')], q: ['q', $t('Denominator coefficients, highest degree first')] };
  function paramField(st, k, q, pre = 'p') {
    const val = st.params[q.key] ?? q.def;
    const upd = (v) => { st.params[q.key] = v; chainChanged(false); syncParam(k, q.key, pre); };
    let input, extra = null, before = null;
    const id = `${pre}${k}_${q.key}`;
    if (q.type === 'choice') {
      input = h('select', { class: 'inp', id, onchange: (e) => { upd(e.target.value); commit(); } }, ...q.choices.map(([v, l]) => h('option', { value: v }, l)));
      input.value = val;
    } else if (q.type === 'int' || q.type === 'angle') {
      input = h('input', { class: 'inp', id, type: 'number', step: '1', value: val, min: q.min });
      // an empty or unreadable field (Number('') is 0) is flagged and never applied; leaving it shows the value in use again
      const unread = () => input.value.trim() === '' || !!(input.validity && input.validity.badInput) || !Number.isFinite(Number(input.value));
      input.addEventListener('input', () => {
        if (unread()) {
          input.classList.add('bad'); input.setAttribute('aria-invalid', 'true');
          input.setAttribute('data-tip', $t('Enter a number; {label} stays {choice}', { label: q.label, choice: st.params[q.key] ?? q.def }));
          return;
        }
        const v = Number(input.value);
        const okInt = q.type !== 'int' || (Number.isInteger(v) && (q.min == null || v >= q.min));
        input.classList.toggle('bad', !okInt); input.setAttribute('aria-invalid', String(!okInt));
        if (!okInt) input.setAttribute('data-tip', $t('Uses {choice}: {label} must be a whole number{choice2}', { choice: Math.max(q.min ?? -Infinity, Math.round(v)), label: q.label, choice2: q.min != null ? ` ≥ ${q.min}` : '' })); else input.removeAttribute('data-tip');
        upd(q.type === 'int' ? Math.round(v) : v);
      });
      input.addEventListener('change', () => {
        if (unread()) input.value = st.params[q.key] ?? q.def;
        const v = Number(input.value);
        if (q.type === 'int' && Number.isFinite(v)) { const r = Math.min(q.max ?? Infinity, Math.max(q.min ?? -Infinity, Math.round(v))); if (r !== v) { input.value = r; upd(r); } }
        input.classList.remove('bad'); input.removeAttribute('data-tip'); input.removeAttribute('aria-invalid');
        commit();
      });
      if (q.key === 'cut' && pre === 'p') input.dataset.cutStep = k;
      // [v16.5 UX67] a step's sheet: "‹ 0 of 2 ›": ‹ › step through the sheets ("of n" for a root), and Show all sheets opens Landscape
      // with All sheets on, the one view that draws them
      if (q.key === 'k' && q.type === 'int') {
        const n = st.type === 'root' ? Math.max(2, Math.round(+st.params.n || 2)) : 0;
        const go = (d) => { let v = Math.round(Number(st.params.k) || 0) + d; if (n) v = ((v % n) + n) % n; input.value = v; upd(v); commit(); };
        before = h('button', { class: 'icon-btn sh-prev', type: 'button', 'aria-label': $t('Previous sheet'), 'data-tip': $t('Previous sheet'), onclick: (e) => { e.preventDefault(); go(-1); } }, '‹');
        extra = h('div', { class: 'sheet-ctl' },
          n ? h('span', { class: 'sh-of' }, $t('of {n}', { n })) : null,
          h('button', { class: 'icon-btn sh-next', type: 'button', 'aria-label': $t('Next sheet'), 'data-tip': $t('Next sheet'), onclick: (e) => { e.preventDefault(); go(1); } }, '›'),
          h('button', { class: 'btn ghost small sh-all', type: 'button', 'data-tip': $t('Landscape draws every sheet of the map as one surface'), onclick: (e) => { e.preventDefault(); showAllSheets(); } }, $t('Show all sheets')));
      }
    } else {
      // (review verify-4: a number field (a complex value or a list of them) shows the true minus, U+2212, as the zero
      // and pole fields and the Parameters' value fields do; the stored text keeps the hyphen. A formula field is as typed.)
      const num = q.type === 'cx' || q.type === 'coeffs' || q.type === 'cxlist';
      const raw = () => (num ? input.value.replace(/−/g, '-') : input.value);
      input = h('input', { class: 'inp', id, value: num ? numShow(val) : val, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-fx': '' });
      if (num) input.dataset.num = '1';
      input.addEventListener('input', () => {
        if (q.type === 'cx') { try { Expr.constValue(raw()); input.classList.remove('bad'); } catch (e) { input.classList.add('bad'); } }
        if (q.type === 'coeffs' || q.type === 'cxlist') Funcs.typedList(st, q.key, raw());
        upd(raw());
      });
      input.addEventListener('change', () => { if (num && input.value !== numShow(raw())) input.value = numShow(raw()); commit(); });
      if (q.type === 'cx') extra = h('button', { class: 'icon-btn argand', 'data-tip': $t('Pick on an Argand diagram'), 'aria-label': $t('Pick {label} on an Argand diagram', { label: q.label }), html: ICONS.argand, onclick: (e) => { e.preventDefault(); e.stopPropagation(); if (padEl) closePad(); else openArgandPad(e.currentTarget, input); } });
    }
    input.dataset.pkey = q.key;
    const wide = q.type === 'expr' || q.type === 'coeffs' || q.type === 'seq';
    const sym = PSYM[q.key];
    const labelText = sym ? sym[0] : q.label;
    // (v16.5 UX33: a word before the symbol, "Cut angle θ", "Sheet k", "Power n", so a phone, which has no tooltips,
    // says what the field is; the symbol keeps its own span, where a step's index goes)
    const word = paramWord(st, q);
    const lab = h('label', { class: 'pl' + (word ? ' worded' : ''), for: id, 'data-tip': sym ? sym[1] : q.label }, ...(word ? [h('span', { class: 'pw' }, word), ' ', h('span', { class: 'ps' }, labelText)] : [labelText]));
    if (q.type === 'int' || q.type === 'angle') scrubbable(lab, input, 1, q.type === 'int');
    return h('div', { class: 'pf' + (wide ? ' wide' : '') + (q.type === 'cx' ? ' cx' : '') + (word ? ' worded' : '') }, lab, extra ? h('div', { class: 'pair' }, before, input, extra) : input);
  }
  // (v16.5 UX33) the word before a field's symbol: the cut, the sheet, the power or root index, the zeros-and-poles factor
  function paramWord(st, q) {
    if (q.key === 'cut') return $t('Cut angle');
    if (q.key === 'k') return $t('Sheet');
    if (q.key === 'n') return st.type === 'root' ? $t('Root index') : $t('Power');
    if (q.key === 'phi') return $t('Angle');
    if (q.key === 'alpha') return $t('Exponent');
    if (q.key === 'a' && st.type === 'zp') return $t('Factor');
    return '';
  }
  // keep the card's field and the compact popover's field in step
  function syncParam(k, key, from) {
    const v = S.steps[k - 1] && S.steps[k - 1].params[key];
    for (const el of document.querySelectorAll(`[id$="${k}_${key}"][data-pkey="${key}"]`)) {
      if (el.id === `${from}${k}_${key}` || document.activeElement === el) continue;
      const t = el.dataset.num ? numShow(v) : String(v);
      if (String(el.value) !== t) el.value = t;
    }
  }
  const CHIP_DEFS = [['analytic', $tx('lamp', 'A'), $t('Analytic')], ['entire', $tx('lamp', 'E'), $t('Entire')], ['rational', $tx('lamp', 'R'), $tx('badge', 'Rational')], ['polynomial', $tx('lamp', 'P'), $t('Polynomial')], ['mobius', $tx('lamp', 'M'), $tx('badge', 'Möbius')], ['proper', $tx('lamp', 'Pr'), $t('Proper')], ['injective', $tx('lamp', 'I'), $t('Injective (a homeomorphism onto its image)')]];
  function branchTag(st, b) {
    if (st.params.cut == null || !b.cuts.some((c) => c.editable)) return '';
    let deg = ((+st.params.cut % 360) + 360) % 360;
    if (deg > 180) deg -= 360; // same convention as the θ field: (−180°, 180°]
    let t = $t('cut {x}°', { x: I18N.num(String(+deg.toFixed(1)).replace('-', '−')) });
    const kk = Math.round(+st.params.k || 0);
    if (st.type === 'root') { const n = Math.max(2, Math.round(+st.params.n || 2)); t += $t(', sheet {x}/{n}', { x: ((kk % n) + n) % n, n }); }
    else if (kk) t += $t(', sheet {kk}', { kk });
    return t;
  }
  function updateCards() {
    // v15: a card shows its state only (bypassed, error); its formula and parameters are in the Inspector
    S.steps.forEach((st, i) => {
      const k = i + 1;
      const c = cardRefs[k];
      if (!c) return;
      const b = built[i];
      const bad = !!(b && b.error);
      c.root.classList.toggle('off', st.on === false);
      c.root.classList.toggle('bad', bad);
      const d = defOf(st);
      // (v16.5 UX84: a typed step is a "Formula"; its formula is in the tooltip and the aria label, never on the card)
      const fx = st.type === 'custom' && st.params && st.params.expr ? String(st.params.expr) : '';
      const lab = `f${sub(k)}, ${d.label}` + (fx ? ` ${fx}` : '') + (S.focus === k ? $t(', shown alone') : '') + (st.on === false ? $t(', bypassed') : '') + (bad ? $t(', error: {msg}', { msg: b.error }) : '');
      if (c.root.getAttribute('aria-label') !== lab) c.root.setAttribute('aria-label', lab);
      const tip = bad ? `f${sub(k)} (${b.def ? b.def.label : d.label}): ${b.error}` : fx ? `f${sub(k)}(z) = ${fx}` : null;
      if ((c.root.dataset.tip || null) !== tip) { if (tip) c.root.dataset.tip = tip; else delete c.root.dataset.tip; }
      c.invBtn.disabled = !b || bad;
    });
    updateFTile();
    syncSel();
    renderComposeTex();
    requestRender('T', 'P');
  }
  function renderComposeTex() {
    const act = activeSteps();
    const el = $('composeTex');
    if (!act.length) { TeX.set(el, 'F=\\mathrm{id}'); return; }
    // a d/dz step differentiates the composite so far: [f₁, f₂, d/dz, f₃] reads F = f₃ ∘ (f₂ ∘ f₁)′
    let acc = '';
    for (const k of act) {
      if (isDeriv(k)) acc = acc ? (/\\circ/.test(acc) ? `\\left(${acc}\\right)'` : `${acc}'`) : '\\mathrm{id}\'';
      else acc = acc ? `f_{${k}}\\circ ${acc}` : `f_{${k}}`;
    }
    TeX.set(el, `F=${acc}`);
  }
  function addStep(type, params, at, o) {
    const st = { type, params: Object.assign(Funcs.defaults(type), params || {}), on: true };
    if (at == null) at = S.focus > 0 ? S.focus : S.steps.length;
    at = Math.max(0, Math.min(S.steps.length, at));
    S.steps.splice(at, 0, st);
    chainChanged(true);
    // (v16.5 UX01: the planes keep what they showed, F or the step shown alone; the new card is selected, and the
    // toast offers Show alone: Show alone is its own choice, ui-redesign-2)
    keepShown(at + 1, 1);
    commit();
    startTransition(at + 1);
    noteRecent(type);
    soundCue('stepAdd');
    bornCards(at + 1, 1);
    addedToast(at + 1, 1, null, o && o.msg);
    return cardButton(at + 1);
  }
  // (D1, issue #23) the palette's Replace: steps k0+1 … k0+count give way to what run(k0) inserts, as one undo step; a
  // step shown alone stays shown, now the first new step when it was one of the replaced
  function replaceSteps(k0, count, run, name) {
    const f = S.focus, old = count === 1 ? defOf(S.steps[k0]).label : '', n0 = S.steps.length - count;
    const gone = S.steps.splice(k0, count);
    setFocusStep(Math.min(f, k0));
    const r = run(k0);
    const added = S.steps.length - n0;
    if (!added) { S.steps.splice(k0, 0, ...gone); setFocusStep(f); return r; }
    if (f > k0) { setFocus(Math.min(S.steps.length, f > k0 + count ? f - count + added : k0 + 1)); commit(); }
    undoToast(count === 1 && n0 > 0 ? $t('Replaced f{x} ({old}) with {name}.', { x: sub(k0 + 1), old, name }) : $t('Replaced F with {name}.', { name }));
    tourEmit('step-replaced', { k: k0 + 1, type: S.steps[k0].type });
    return cardButton(k0 + 1) || r;
  }
  // (UX01) after a step is added, moved or duplicated: the step shown alone, if any, stays shown (its index moved by
  // the n new cards at k, or by the move), and card k is selected for the Inspector
  function keepShown(k, n, from) {
    let f = S.focus;
    if (from != null) f = f === from ? k : f > from && f <= k ? f - 1 : f < from && f >= k ? f + 1 : f;
    else if (f >= k) f += n;
    setFocus(Math.max(0, Math.min(S.steps.length, f)), f === S.focus);
    setSel(k);
    syncSel();
    requestRender('P');
  }
  // "Added f₃ Sine · Show alone · Undo" (the toast's Show alone shows the first new step; one undo for all n)
  function addedToast(k, n, verb, msgOf) {
    const name = n === 1 ? defOf(S.steps[k - 1]).label : '';
    const msg = msgOf ? msgOf(k) : verb === 'dup' ? $t('Duplicated f{x} as f{x2}.', { x: sub(k - 1), x2: sub(k) })
      : n === 1 ? $t('Added f{x} {name}.', { x: sub(k), name }) : $t('Added f{x}–f{x2}.', { x: sub(k), x2: sub(k + n - 1) });
    undoToast(msg, S.focus === k ? null : [$t('Show alone'), () => { if (S.steps[k - 1]) { setFocus(k); requestRender('P'); } }]);
  }
  // v15.2: a formula added as its steps (the palette's Add as n steps): one commit; the planes keep what they showed
  // (v16.5 UX01), so into an empty chain F is the formula the user typed, with its parts on the cards (review steps-1)
  function addSteps(list, at) {
    if (at == null) at = S.focus > 0 ? S.focus : S.steps.length;
    at = Math.max(0, Math.min(S.steps.length, at));
    const news = list.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: true }));
    S.steps.splice(at, 0, ...news);
    chainChanged(true);
    keepShown(at + 1, news.length);   // (v16.5 UX01: the planes keep F, the first new card is selected)
    commit();
    startTransition(at + 1);
    for (const s of news) noteRecent(s.type);
    soundCue('stepAdd');
    bornCards(at + 1, news.length);
    addedToast(at + 1, news.length);
    return cardButton(at + 1);
  }
  // the new cards unfold (200 ms; none with reduced motion), and the first one scrolls into view
  function bornCards(k, n) {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cards = [];
    for (let j = k; j < k + n; j++) { const c = document.querySelector(`#pipeline .card[data-k="${j}"]`); if (c) cards.push(c); }
    if (!still) { for (const c of cards) c.classList.add('born'); setTimeout(() => { for (const c of cards) c.classList.remove('born'); }, 240); }
    if (cards[0]) cards[0].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: still ? 'auto' : 'smooth' });
  }
  // v15.2 (notes/formula-steps/DESIGN.md 7): a formula step replaced by the catalog steps it is (Funcs.splitSteps): the
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
    // (review steps-1)
    const alone = S.focus === k, only = S.steps.length === 1;
    // (v16: the bracket by index: an end on the split step moves to the new steps' outer one, so all n stay bracketed)
    const hr = S.homRange ? HR.resolve(S, true) : null;
    S.steps.splice(k - 1, 1, ...news);
    if (hr) S.homRange = { a: hr.a > k ? hr.a + n - 1 : hr.a, b: hr.b >= k ? hr.b + n - 1 : hr.b };
    if (S.focus > k) setFocusStep(S.focus + n - 1);
    else if (alone && only) setFocusStep(0);
    chainChanged(true);
    setFocus(S.focus);
    setSel(k);
    if (T1 != null && morph.open) { morph.T = T1; requestRender('L', 'R'); }
    syncSel();
    commit();
    soundCue('stepAdd');
    tourEmit('formula-split', { k, n });
    bornCards(k, n);
    requestRender('P');
    const shown = alone && !only && n > 1 ? ' ' + (document.documentElement.classList.contains('ph') ? $t('Showing f{k} alone.', { k: sub(k) }) : $t('Showing f{k} alone; › shows the next step.', { k: sub(k) })) : '';
    undoToast((n === 1 ? $t('f{k} is now the step “{name}”.', { k: sub(k), name: Funcs.DEFS[news[0].type].label })
      : $t('Split f{k} into f{k}–f{k2}: {chain}.', { k: sub(k), k2: sub(k + n - 1), chain: sp.names.join(' → ') })) + shown);
    // (the card, focusable, for the ⋯ menu's focus; true while the chain is still to be drawn; null is a refusal)
    return document.querySelector(`#pipeline .card[data-k="${k}"]`) || true;
  }
  function removeStep(k) {
    const name = defOf(S.steps[k - 1]).label;
    // (v16: the bracket by index: a removed step leaves it, so it shrinks; a bracket of that step alone is dropped)
    const hr = S.homRange ? HR.resolve(S, true) : null;
    S.steps.splice(k - 1, 1);
    if (hr) { if (hr.a === k && hr.b === k) delete S.homRange; else S.homRange = { a: hr.a > k ? hr.a - 1 : hr.a, b: hr.b >= k ? hr.b - 1 : hr.b }; }
    if (S.focus >= k) setFocusStep(Math.max(0, S.focus === k ? 0 : S.focus - 1));
    if (Number.isInteger(S.sel) && S.sel >= k) setSel(S.sel === k ? null : S.sel - 1);
    chainChanged(true);
    setFocus(S.focus);
    commit();
    soundCue('stepRemove');
    undoToast($t('Removed f{x} ({name}).', { x: sub(k), name }));
  }
  function duplicateStep(k) {
    const st = S.steps[k - 1];
    S.steps.splice(k, 0, JSON.parse(JSON.stringify(st)));
    chainChanged(true);
    keepShown(k + 1, 1);   // (v16.5 UX01)
    commit();
    bornCards(k + 1, 1);
    addedToast(k + 1, 1, 'dup');
    return cardButton(k + 1); // the new card takes the keyboard focus
  }
  function moveStep(k, d) {
    const j = k - 1 + d;
    if (j < 0 || j >= S.steps.length) return null;
    const [st] = S.steps.splice(k - 1, 1);
    S.steps.splice(j, 0, st);
    chainChanged(true);
    keepShown(j + 1, 0, k);   // (v16.5 UX01: a step shown alone stays shown, wherever it moved)
    commit();
    undoToast($t('Moved {name} to f{x}.', { name: defOf(st).label, x: sub(j + 1) }));
    return cardButton(j + 1); // the moved card keeps the keyboard focus
  }
  function invertStep(k) {
    const b = built[k - 1];
    if (!b || !b.inverse) return;
    const st = S.steps[k - 1];
    st.type = b.inverse.type;
    st.params = Object.assign(Funcs.defaults(b.inverse.type), b.inverse.params);
    chainChanged(true);
    setFocus(k);
    commit();
    undoToast($t('Replaced f{x} with its inverse ({x2}).', { x: sub(k), x2: defOf(st).label }));
    tourEmit('step-replaced', { k, type: st.type });
  }
  // f⁻¹ on a card (and "Inverse of f_k" in the palette): the inverse step when the step has a single-valued one on
  // its branch; otherwise the reason, with the way to see every preimage instead
  function inverseAction(k) {
    const b = built[k - 1], st = S.steps[k - 1];
    if (!b || b.error || !st || isDerivStep(st, b)) return;
    if (b.inverse) { invertStep(k); return cardButton(k); }
    const why = b.inverseNote || $t('{x} takes some values more than once, so it has no single inverse.', { x: defOf(st).label });
    toast(why.replace(/\.?$/, '.'), $t('Show preimages'), () => {
      // a target point at 0 (unless there is one) shows every preimage of it in the left plane
      if (S.focus !== k) setFocus(k);
      if (!S.targets.some((t) => t.visible !== false && t.kind === 'point')) addShape(newShape('point', { p: [0, 0] }, true), true);
      fitLeftToSolutions();
    });
    return null;
  }
  // "Show preimages" promises every solution of f(w) = p: for a rational step of known degree d, widen the left
  // view (up to 2⁸ times) until the point targets' d solutions are all in it
  function fitLeftToSolutions() {
    const deg = focusDegree();
    if (!deg || !hasCalc('zerosPoles') || !paneL || !(paneL.w > 0) || !lFlat()) return;
    const pts = S.targets.filter((s) => s.visible !== false && s.kind === 'point');
    if (!pts.length) return;
    const F = focusF(), b0 = paneBox(paneL, leftView());
    const cx = (b0.x0 + b0.x1) / 2, cy = (b0.y0 + b0.y1) / 2, hw = (b0.x1 - b0.x0) / 2, hh = (b0.y1 - b0.y0) / 2;
    const all = [];
    let done = false;
    // (bounded in time: about 0.8 s on the main thread at most; a search cut short counts as not done)
    const t0 = performance.now();
    for (let j = 0; j <= 8 && !done; j++) {
      if (j && performance.now() - t0 > 800) break;
      const m = 2 ** j, box = { x0: cx - hw * m, x1: cx + hw * m, y0: cy - hh * m, y1: cy + hh * m };
      all.length = 0; done = true;
      for (const s of pts) {
        let sols = [];
        try { sols = zerosPolesTimed(F, box, { target: { re: s.p[0], im: s.p[1] }, max: 40 }, Math.max(30, 150 / pts.length)); } catch (e) { sols = []; }
        const zs = sols.filter((r) => r && r.kind !== 'pole' && r.z && CX.isFin(r.z));
        all.push(...zs);
        // a polynomial has all d in ℂ; a rational map may send ∞ to p, so d − 1 is enough for it
        if (zs.reduce((a, r) => a + (r.mult || 1), 0) < deg.d - (deg.poly ? 0 : 1)) done = false;
      }
      if (j === 0 && done) return; // already in view
    }
    if (!all.length) return;
    const xs = [b0.x0, b0.x1], ys = [b0.y0, b0.y1];
    for (const r of all) { xs.push(r.z.re); ys.push(r.z.im); }
    const b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    const m = 0.08 * Math.max(b.x1 - b.x0, b.y1 - b.y0);
    paneL.setView(leftView());
    const target = boxView(paneL, { x0: b.x0 - m, x1: b.x1 + m, y0: b.y0 - m, y1: b.y1 + m });
    if (leftStage() > 0) leftAuto = false;
    tweenView(leftView(), target, 260, () => sourceViewChanged());
  }
  // "Replace with derivative": the step becomes f′ (a custom step on the same branch), as one undoable change
  function derivativeAction(k) {
    const st = S.steps[k - 1];
    if (!st) return null;
    if (typeof Funcs.derivativeStep !== 'function') { sndError(); toast($t('Derivatives are not available in this build.')); return null; }
    let r;
    try { r = Funcs.derivativeStep(st); } catch (e) { r = { error: e.message || String(e) }; }
    if (!r || r.error || !r.step) { sndError(); toast((r && r.error) || $t('f{x} has no derivative here.', { x: sub(k) })); return null; }
    const type = Funcs.DEFS[r.step.type] ? r.step.type : 'custom';
    S.steps[k - 1] = { type, params: Object.assign(Funcs.defaults(type), r.step.params || {}), on: st.on !== false };
    chainChanged(true);
    setFocus(k);
    commit();
    // the math note, without its "Derivative of …" preamble (the toast already says so)
    const note = String(r.note || '').replace(/^Derivative of [^;:]*[;:]?\s*/, '').replace(/\.$/, '');
    undoToast($t('Replaced f{k} with its derivative{choice}.', { k: sub(k), choice: note ? ` (${note})` : '' }));
    return cardButton(k);
  }
