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
      const [st] = spliceSteps(from - 1, 1);
      spliceSteps(to, 0, st);
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
  // ---------------- [issue #6] Repeat × N: a bracket under the cards of each block, with its N ----------------
  // step.repeat = {n, len} on a block's last step (Funcs.applyRepeats). The line runs under the block's cards; its
  // chip holds N (1 … Funcs.REPEAT_MAX: typed, or the arrow keys), or the name of a shared number whose value, rounded,
  // is N (repeat.by: its slider or Play runs the passes; the GPU keeps one program, N a uniform), and a button that
  // ends the repeat.
  const repeatBlocks = () => S.steps.map((st, i) => { const rp = Funcs.repeatOk(S.steps, i + 1); return rp ? { a: i + 2 - rp.len, b: i + 1, n: rp.n, by: rp.by || null } : null; }).filter(Boolean);
  function setRepeat(k, rp) {
    const st = S.steps[k - 1];
    if (!st) return;
    if (rp) st.repeat = rp; else delete st.repeat;
    chainChanged(true); commit();
    repeatMoved(k, rp);
  }
  // ([#398] the tour's event for a user's Repeat: the block set, or its N changed; not a repeat a loaded scene brings)
  const repeatMoved = (k, rp) => tourEmit('repeat-changed', { k, n: rp ? rp.n : 0, len: rp ? rp.len : 0, by: rp && rp.by ? rp.by : null });
  // the repeat that text typed into an N field asks for (a whole number, or the name of a shared number), or null when it
  // is no change: the bracket's field and the Inspector's row read it alike
  function repeatFromText(st, t) {
    const ns = /^\d+$/.test(t) ? [] : Params.namesIn(t), v = Number(t);
    if (ns.length === 1 && Params.get(ns[0]) !== undefined) return st.repeat.by !== ns[0] ? { n: st.repeat.n, len: st.repeat.len, by: ns[0] } : null;
    if (/^\d+$/.test(t) && v >= 1 && v <= Funcs.REPEAT_MAX && (v !== st.repeat.n || st.repeat.by)) return { n: v, len: st.repeat.len };
    return null;
  }
  // the block that step k is in, as repeatBlocks gives it, or null
  const repeatOf = (k) => repeatBlocks().find((r) => r.a <= k && k <= r.b) || null;
  // the keyboard goes back to a step's chip on the thread (its card in the classic view) once the chain is drawn again: after a
  // control that has gone, such as the Inspector's End the repeat, no longer holds it
  function focusStepChip(k) {
    requestAnimationFrame(() => {
      const el = SV.on ? svEl(k, 'chip') : document.querySelector(`#pipeline .card[data-k="${k}"]`);
      if (el) /** @type {HTMLElement} */ (el).focus({ preventScroll: true });
    });
  }
  // (the Inspector draws its row a frame or two after the step is selected; on a slow machine a first draw takes longer: the
  // field is looked for this long, then given up)
  const REPEAT_FIELD_WAIT_MS = 1500;
  // where the keyboard goes after a Repeat is chosen: the bracket's N field, or in the steps view the Inspector's row of the
  // step's block (which the Edit sheet carries on a phone), found once the Inspector has drawn it. Returns the bracket's field,
  // for the caller to focus, and null in the steps view, where the field is focused here once it is drawn
  function focusRepeatField(k) {
    const field = () => repFields.map((f) => f.inp).find((el, i) => repFields[i].getK() === k && el.isConnected && el.getClientRects().length) || null;
    if (!SV.on) return field();
    svInspect(k);
    const t0 = performance.now(), look = () => {
      const f = field();
      if (f) { f.focus(); f.select(); } else if (performance.now() - t0 < REPEAT_FIELD_WAIT_MS) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
    return null;
  }
  // N's field, one for every place that sets it (the bracket under the cards, the steps view's Inspector row): typed, or by the
  // arrow keys, for the block ending at step getK(). N applies once typing settles, so 12 builds the chain once, not for
  // N = 1 then N = 12; at once on change
  const repFields = [];
  function repeatShowAll() {
    for (let i = repFields.length - 1; i >= 0; i--) {
      const f = repFields[i];
      if (!f.inp.isConnected) { repFields.splice(i, 1); continue; }
      const st = S.steps[f.getK() - 1];
      if (!f.inp.dataset.typing && st && st.repeat) f.inp.value = st.repeat.by ? Params.display(st.repeat.by) : String(st.repeat.n);
    }
  }
  // one step of N for the block ending at step k (the arrow keys, the Inspector's − and +); not for a shared number's
  function repeatStep(k, d) {
    const st = S.steps[k - 1];
    if (!st || !st.repeat || st.repeat.by) return;
    const v = Math.min(Funcs.REPEAT_MAX, Math.max(1, st.repeat.n + d));
    if (v === st.repeat.n) return;
    st.repeat = { n: v, len: st.repeat.len };
    chainChanged(false); commit();
    repeatMoved(k, st.repeat);
    repeatShowAll();
  }
  let repRO = null;
  function updateRepeats() {
    const host = $('pipeline');
    if (!host) return;
    const blocks = repeatBlocks(), els = /** @type {HTMLElement[]} */ ([...host.querySelectorAll(':scope > .rep-bracket')]);
    if (blocks.length && !repRO && typeof ResizeObserver !== 'undefined') { repRO = new ResizeObserver(() => requestAnimationFrame(updateRepeats)); repRO.observe(host); }
    els.slice(blocks.length).forEach((e) => e.remove());
    blocks.forEach((r, i) => {
      let L = els[i];
      if (!L) {
        const inp = repeatField(() => +L.dataset.k);
        const off = h('button', { class: 'rep-off', type: 'button', 'aria-label': $t('End the repeat'), 'data-tip': $t('End the repeat'), onclick: (e) => { e.stopPropagation(); setRepeat(+L.dataset.k, null); } }, '×');
        L = h('div', { class: 'rep-bracket' }, h('div', { class: 'rep-line', 'aria-hidden': 'true' }),
          h('div', { class: 'rep-chip' }, h('span', { class: 'rep-x', 'aria-hidden': 'true' }, '×'), inp, off));
        const add = $('addStepBtn');
        if (add && add.parentNode === host) host.insertBefore(L, add); else host.append(L);
      }
      L.dataset.k = String(r.b);
      const inp = /** @type {HTMLInputElement} */ (L.querySelector('.rep-n'));
      if (document.activeElement !== inp) inp.value = r.by ? Params.display(r.by) : String(r.n);
      inp.setAttribute('aria-label', r.a === r.b ? $t('Repeat f{k}: times', { k: sub(r.b) }) : $t('Repeat f{a}–f{b}: times', { a: sub(r.a), b: sub(r.b) }));
      const ca = /** @type {HTMLElement} */ (host.querySelector(`.card[data-k="${r.a}"]`)), cb = /** @type {HTMLElement} */ (host.querySelector(`.card[data-k="${r.b}"]`));
      if (!ca || !cb) { L.hidden = true; return; }
      L.hidden = false;
      const x0 = ca.offsetLeft + 4, x1 = cb.offsetLeft + cb.offsetWidth - 4, y = cb.offsetTop + cb.offsetHeight;
      Object.assign(/** @type {HTMLElement} */ (L.querySelector('.rep-line')).style, { left: x0 + 'px', width: Math.max(8, x1 - x0) + 'px', top: (y + 2) + 'px' });
      Object.assign(/** @type {HTMLElement} */ (L.querySelector('.rep-chip')).style, { left: Math.round((x0 + x1) / 2) + 'px', top: (y - 9) + 'px' });
    });
  }
  // the ⋯ menu's Repeat: the blocks that may end at step k (back to a d/dz or another repeat), or N and End for its own
  function repeatItems(k) {
    const own = repeatBlocks().find((r) => r.a <= k && k <= r.b);
    if (own) return [{ label: $t('Repeat…'), run: () => focusRepeatField(own.b) }, { label: $t('End the repeat'), run: () => setRepeat(own.b, null) }];
    const kids = [], prevEnd = Math.max(0, ...repeatBlocks().filter((r) => r.b < k).map((r) => r.b));
    for (let j = k; j > prevEnd && j >= Math.max(1, k - 5); j--) {
      if (isDerivStep(S.steps[j - 1], built[j - 1])) break;
      kids.push({ label: j === k ? $t('This step, twice') : $t('f{a}–f{b}, twice', { a: sub(j), b: sub(k) }), run: () => { setRepeat(k, { n: 2, len: k - j + 1 }); return focusRepeatField(k); } });
    }
    return kids;
  }
  function updateBracket() {
    updateRepeats();
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
      if (!brRO) { brRO = new ResizeObserver(() => requestAnimationFrame(placeBracket)); brRO.observe(host); }
    }
    L.hidden = false;
    placeBracket();
  }
  function placeBracket() {
    const L = $('chainBracket'), host = $('pipeline');
    if (!L || L.hidden || !host) return;
    const n = nSteps(), r = homRangeOk() || { a: 1, b: n };
    const ca = /** @type {HTMLElement | null} */ (host.querySelector(`.conn[data-conn="${r.a}"]`)), cb = /** @type {HTMLElement | null} */ (host.querySelector(`.conn[data-conn="${r.b + 1}"]`));
    if (!ca || !cb) return;
    const ph = brPhone(), drop = ph ? 14 : host.classList.contains('compact') ? 10 : 20;
    const x0 = Math.round(ca.offsetLeft + ca.offsetWidth / 2), x1 = Math.round(cb.offsetLeft + cb.offsetWidth / 2);
    const top = ph ? Math.max(0, Math.round(ca.offsetTop) - 5) : 3;
    const line = /** @type {HTMLElement} */ (L.querySelector('.br-line'));
    Object.assign(line.style, { left: x0 + 'px', width: Math.max(2, x1 - x0) + 'px', top: top + 'px', height: drop + 'px' });
    const st = HR.stops(S);
    for (const [el, c, v, ok] of [[L.querySelector('.br-end.l'), ca, r.a, st.okA], [L.querySelector('.br-end.r'), cb, r.b, st.okB]]) {
      // (#483) a 24 px target at least (WCAG 2.5.8), centred on the connector, which is 16 px wide at 1280 and under; and above the
      // connector's labels (z, w₁, w) instead of over them, so a press on a label is not a press on the handle. The compact chain
      // keeps its labels at the top, so its handle still runs the whole height
      const cw = Math.round(c.offsetWidth), w = Math.max(24, cw), cv = /** @type {HTMLElement | null} */ (c.querySelector('.conn-var'));
      const labelTop = cv && !host.classList.contains('compact') ? Math.round(c.offsetTop + cv.offsetTop) : 0;
      Object.assign(el.style, { left: Math.round(c.offsetLeft + (cw - w) / 2) + 'px', width: w + 'px', top: '0px', height: (labelTop >= 24 ? labelTop : Math.round(c.offsetTop + c.offsetHeight)) + 'px' });
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
    const again = /** @type {HTMLElement | null} */ ($('chainBracket') && $('chainBracket').querySelector('.br-end.' + side));
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
      for (let k = 1; k <= nSteps(); k++) { const c = /** @type {HTMLElement | null} */ (host.querySelector(`.card[data-k="${k}"]`)); if (c && c.offsetLeft + c.offsetWidth / 2 < x) j = k + 1; }
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
    const c0 = h('div', { class: 'card region-card' + (S.focus === 0 ? ' focus' : ''), 'data-k': 0, tabindex: 0, role: 'option', 'aria-label': $t('Shapes'),
      onclick: () => cardClick(0), ondblclick: () => setFocus(0), onkeydown: (e) => chainKey(e, 0) },
    h('div', { class: 'card-head' }, h('span', { class: 'idx', html: '<i>z</i>' }), h('span', { class: 'ty', html: Inspector.regionIcon() }), h('span', { class: 'nm' }, $t('Shapes'))),
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
    /** @type {HTMLElement} */ (host.lastChild).classList.add('conn-last');
    updateBracket();   // (v16: the deformation's bracket, a tab stop after the cards and before the Add tile)
    host.append(h('button', { class: 'add-card' + (S.steps.length <= 3 ? ' labelled' : ''), id: 'addStepBtn', 'data-tip': $t('Add a function  +'), 'aria-label': S.steps.length ? $t('Add function') : $t('Add the first function'), onclick: (e) => openPalette(e.currentTarget, S.steps.length, { fnOnly: true }) },
      h('span', { html: ICONS.plus }), h('span', null, $tx('addcard', 'Add function')), h('span', { class: 'kbd' }, '+')));   // (v16.5 UX22: the label the short chain shows, desk.css)
    host.append(fTile());
    { const cc = $('clearChain'); if (cc) cc.hidden = !S.steps.length; }   // (D1, issue #23: Clear chain in words, with a chain to clear)
    // (v15 review design-14: the listbox owns the options only, the region card, the step cards and F, through
    // aria-owns; the connectors are aria-hidden and the Add tile is its own tab stop after the listbox, not an item in it)
    host.removeAttribute('role'); host.removeAttribute('aria-label');
    const opts = /** @type {HTMLElement[]} */ ([...host.querySelectorAll(':scope > [role="option"]')]);
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
  function stepMenu(anchor, k, opt) { return openMenu(anchor, stepMenuItems(anchor, k, opt)); }
  // v15 (DESIGN.md 2.4): a click selects (the Inspector edits it); Show alone is its own action (a double-click, L,
  // the lens in the Inspector's head)
  function cardClick(k) { selectStep(k); }
  // (v16.5 UX81) move step k one place and keep the keyboard on its card (the chain is drawn again)
  function moveCard(k, d) {
    if (!moveStep(k, d)) return;
    const c = /** @type {HTMLElement | null} */ (document.querySelector(`#pipeline .card[data-k="${k + d}"]`));
    if (c) c.focus({ preventScroll: true });
  }
  // the keys that edit a step, read once for the chain's cards and the steps view's chips: Alt+← / Alt+→ move it (move: -1, 1),
  // Delete or Backspace remove it (remove: true)
  function stepEditKey(e) {
    if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return { move: e.key === 'ArrowLeft' ? -1 : 1 };
    if (e.key === 'Delete' || e.key === 'Backspace') return { remove: true };   // (any modifier: ⌘⌫ on a Mac, as the chain's cards took it)
    return null;
  }
  function chainKey(e, k) {
    if (e.target !== e.currentTarget) return;
    const n = S.steps.length, cur = k === 'F' ? n + 1 : k;
    const go = (j) => { e.preventDefault(); const el = /** @type {HTMLElement | null} */ (j === n + 1 ? document.querySelector('#pipeline .ftile') : document.querySelector(`#pipeline .card[data-k="${j}"]`)); if (el) { el.focus(); selectStep(j === n + 1 ? 'F' : j); } };
    // (v16.5 UX81 / UX97: Alt+← / Alt+→ moves the step one place, as its ⋯ menu's Move left / right, and the moved card
    // keeps the keyboard; the chain and learn pieces built the same key, merged as one)
    const ed = stepEditKey(e);
    if (ed && ed.move) {
      e.preventDefault(); e.stopPropagation();
      if (k > 0 && k !== 'F') moveCard(k, ed.move);
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') go(Math.min(n + 1, cur + 1));
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') go(Math.max(0, cur - 1));
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(n + 1);
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectStep(k); }
    // (the physical L key on any layout: «д» on ЙЦУКЕН; review russian-5)
    else if (String((I18N.keyOf ? I18N.keyOf(e) : e.key) || '').toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey && k > 0 && k !== 'F') { e.preventDefault(); e.stopPropagation(); toggleAlone(k); }
    else if (ed && ed.remove && k > 0 && k !== 'F') { e.preventDefault(); e.stopPropagation(); removeStep(k); }
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
    // (#361: Bypass and More are a hover's, for the mouse; the keyboard has the card's keys. An option holds no control a
    // screen reader can reach, so they are inert until a pointer is over the card: a negative tabindex is not enough)
    const acts = h('span', { class: 'acts', 'aria-hidden': 'true', inert: true }, byp, more);
    const root = h('div', { class: 'card', 'data-k': k, role: 'option', tabindex: 0, 'aria-label': `f${sub(k)}, ${d.label}`, 'aria-selected': 'false',
      onclick: () => cardClick(k), ondblclick: (e) => { if (e.target.closest && e.target.closest('button')) return; setFocus(S.focus === k ? 0 : k); },
      onkeydown: (e) => chainKey(e, k),
      onpointerenter: (e) => { hiStep(k, true); if (acts) acts.inert = false; }, onpointerleave: (e) => { hiStep(k, false); if (acts && e.pointerType === 'mouse') acts.inert = true; } });
    const nm = h('span', { class: 'nm' }, cardName(st, d));
    const head = h('div', { class: 'card-head', draggable: 'true' },
      h('span', { class: 'grip', html: ICONS.grip, 'aria-hidden': 'true' }),
      h('span', { class: 'idx', html: fsub(k) }),
      h('span', { class: 'ty', html: Inspector.typeIcon(st.type), 'aria-hidden': 'true' }),
      nm,
      acts);
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
    h('span', { class: 'fF', 'aria-hidden': 'true' }, 'F', h('span', { class: 'fid' }, '\u2009=\u2009z')), h('span', { class: 'fwm' }, $t('The whole map')), fl, h('span', { class: 'fnone', hidden: true }, $t('No guarantees')));
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
    for (const el of /** @type {NodeListOf<HTMLElement>} */ (t.querySelectorAll('.lamp'))) {
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
    /** @type {HTMLElement} */ (t.querySelector('.fnone')).hidden = lit.length > 0;
    const names = BADGES.filter(([key]) => words[key]).map(([, n]) => n);
    // (v16.5 UX84: an empty chain is the identity: the tile says F = z, not its guarantees)
    const id = !act.length;
    t.classList.toggle('ident', id);
    if (id) for (const el of /** @type {NodeListOf<HTMLElement>} */ (t.querySelectorAll('.lamp, .fnone'))) el.hidden = true;
    t.setAttribute('aria-label', id ? $t('F = z: no steps yet') : names.length ? $t('F: {list}', { list: names.join(', ') }) : $t('F: no guarantees'));
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
    for (const el of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll(`[id$="${k}_${key}"][data-pkey="${key}"]`))) {
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
      // ([#465] read as text: \frac{1}{z} is 1/z and z^3 is z³ in the tooltip and to a screen reader)
      const fx = st.type === 'custom' && st.params && st.params.expr ? texTitle(String(st.params.expr)) : '';
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
    spliceSteps(at, 0, st);
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
    const gone = spliceSteps(k0, count);
    setFocusStep(Math.min(f, k0));
    const r = run(k0);
    const added = S.steps.length - n0;
    if (!added) { spliceSteps(k0, 0, ...gone); setFocusStep(f); return r; }
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
    spliceSteps(at, 0, ...news);
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
  function removeStep(k) {
    const name = defOf(S.steps[k - 1]).label;
    // (v16: the bracket by index: a removed step leaves it, so it shrinks; a bracket of that step alone is dropped)
    const hr = S.homRange ? HR.resolve(S, true) : null;
    spliceSteps(k - 1, 1);
    if (hr) { if (hr.a === k && hr.b === k) deleteOpt('homRange'); else setOpt('homRange', { a: hr.a > k ? hr.a - 1 : hr.a, b: hr.b >= k ? hr.b - 1 : hr.b }); }
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
    const cp = JSON.parse(JSON.stringify(st));
    delete cp.repeat;   // ([issue #6] the copy is a step after the block, not a second repeat)
    spliceSteps(k, 0, cp);
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
    const [st] = spliceSteps(k - 1, 1);
    spliceSteps(j, 0, st);
    chainChanged(true);
    keepShown(j + 1, 0, k);   // (v16.5 UX01: a step shown alone stays shown, wherever it moved)
    commit();
    tourEmit('step-moved', { k: j + 1, from: k });
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
    // ([issue #6] a repeat the step ended now repeats its derivative's block, as the step's place in it stays)
    setStepAt(k - 1, Object.assign({ type, params: Object.assign(Funcs.defaults(type), r.step.params || {}), on: st.on !== false }, st.repeat ? { repeat: { ...st.repeat } } : {}));
    chainChanged(true);
    setFocus(k);
    commit();
    // the math note, without its "Derivative of …" preamble (the toast already says so)
    const note = String(r.note || '').replace(/^Derivative of [^;:]*[;:]?\s*/, '').replace(/\.$/, '');
    undoToast($t('Replaced f{k} with its derivative{choice}.', { k: sub(k), choice: note ? ` (${note})` : '' }));
    return cardButton(k);
  }
  // (#385) the chain head: compact or full, View all, Clear chain, its fit
  function setupChainHead() {
    for (const b of $('chainMode').children) b.addEventListener('click', () => {
      setOpt('compact', /** @type {HTMLElement} */ (b).dataset.mode === 'compact');
      const hgt = S.compact ? 96 : 188;
      document.documentElement.style.setProperty('--chain-h', hgt + 'px');
      try { localStorage.setItem(lsk('cmw-chain-h2'), String(hgt)); } catch (e) { /* ignore */ }
      applyLayout(); save();
    });
    radioKeys($('chainMode'));
    $('viewAllBtn').addEventListener('click', () => setFocus(0));
    $('clearChain').addEventListener('click', () => { if (!S.steps.length) return; setSteps([]); setFocusStep(0); chainChanged(true); setFocus(0); commit(); undoToast($t('Chain cleared.')); });
    // (D1, issue #23: Clear chain is a word button in the chain head again, shown while there is a chain to clear; it
    // had been under a ⋯ there since v15, review design-18)
    $('clearChain').hidden = !S.steps.length;
    // ([#357] the chain head never cuts a control: when its row does not fit (Russian and Italian at 1024 px beside the
    // Inspector), the heading "Function chain" gives way, kept for screen readers; the cards under it say what it is)
    const pipeHead = document.querySelector('.pipe-head');
    if (pipeHead && typeof ResizeObserver === 'function') {
      const fitPipeHead = () => {
        // (#566: the heading shrinks first, as CSS has it; one that is cut, or a row that still does not fit, hides it)
        const title = pipeHead.querySelector(':scope > h2');
        pipeHead.classList.remove('notitle');
        if (pipeHead.scrollWidth > pipeHead.clientWidth + 1 || (title && title.scrollWidth > title.clientWidth + 1)) pipeHead.classList.add('notitle');
      };
      const ro = new ResizeObserver(fitPipeHead);
      ro.observe(pipeHead);
      for (const id of ['chainMode', 'viewAllBtn', 'clearChain']) { const e = $(id); if (e) ro.observe(e); }
    }
  }
