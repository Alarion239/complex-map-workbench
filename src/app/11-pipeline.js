  // ---------------- the function chain: its steps' edits, Repeat and the deformation's range ----------------
  const fsub = (k) => `<i>f</i><sub>${k}</sub>`;
  const brPhone = () => document.documentElement.classList.contains('ph');
  const fUni = (k) => 'f' + sub(k);
  // runs of consecutive active steps as text or HTML: f₁–f₃, f₅
  function stepRuns(ks, html) {
    const f = (k) => (html ? `<i>f</i>${sub(k)}` : fUni(k)), out = [];
    for (let i = 0; i < ks.length;) { let j = i; while (j + 1 < ks.length && ks[j + 1] === ks[j] + 1) j++; out.push(j > i ? `${f(ks[i])}–${f(ks[j])}` : f(ks[i])); i = j + 1; }
    return out.join(', ');
  }
  // ---------------- [issue #6] Repeat × N: a block of steps applied N times ----------------
  // step.repeat = {n, len} on a block's last step (Funcs.applyRepeats). N is 1 … Funcs.REPEAT_MAX (typed, or the arrow
  // keys), or the name of a shared number whose value, rounded, is N (repeat.by: its slider or Play runs the passes; the
  // GPU keeps one program, N a uniform). The Inspector's Repeat row sets it and ends it.
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
  // is no change (the Inspector's Repeat row)
  function repeatFromText(st, t) {
    const ns = /^\d+$/.test(t) ? [] : Params.namesIn(t), v = Number(t);
    if (ns.length === 1 && Params.get(ns[0]) !== undefined) return st.repeat.by !== ns[0] ? { n: st.repeat.n, len: st.repeat.len, by: ns[0] } : null;
    if (/^\d+$/.test(t) && v >= 1 && v <= Funcs.REPEAT_MAX && (v !== st.repeat.n || st.repeat.by)) return { n: v, len: st.repeat.len };
    return null;
  }
  // the block that step k is in, as repeatBlocks gives it, or null
  const repeatOf = (k) => repeatBlocks().find((r) => r.a <= k && k <= r.b) || null;
  // the keyboard goes back to a step's chip on the thread once the chain is drawn again: after a control that has gone,
  // such as the Inspector's End the repeat, which holds it no more
  function focusStepChip(k) {
    requestAnimationFrame(() => {
      const el = svEl(k, 'chip');
      if (el) /** @type {HTMLElement} */ (el).focus({ preventScroll: true });
    });
  }
  // (the Inspector draws its row a frame or two after the step is selected; on a slow machine a first draw takes longer: the
  // field is looked for this long, then given up)
  const REPEAT_FIELD_WAIT_MS = 1500;
  // where the keyboard goes after a Repeat is chosen: the N field of the Inspector's row of the step's block (which the
  // Edit sheet carries on a phone), focused here once the Inspector has drawn it
  function focusRepeatField(k) {
    const field = () => repFields.map((f) => f.inp).find((el, i) => repFields[i].getK() === k && el.isConnected && el.getClientRects().length) || null;
    svInspect(k);
    const t0 = performance.now(), look = () => {
      const f = field();
      if (f) { f.focus(); f.select(); } else if (performance.now() - t0 < REPEAT_FIELD_WAIT_MS) requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  }
  // N's fields (the Inspector's Repeat row; a phone's Edit sheet carries another): typed, or by the arrow keys, for the block ending at step getK(). N applies once typing settles, so 12 builds the chain once, not for
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
  // the ⋯ menu's Repeat: the blocks that may end at step k (back to a d/dz or another repeat), or N and End for its own
  function repeatItems(k) {
    const own = repeatBlocks().find((r) => r.a <= k && k <= r.b);
    if (own) return [{ label: $t('Repeat…'), run: () => focusRepeatField(own.b) }, { label: $t('End the repeat'), run: () => setRepeat(own.b, null) }];
    const kids = [], prevEnd = Math.max(0, ...repeatBlocks().filter((r) => r.b < k).map((r) => r.b));
    for (let j = k; j > prevEnd && j >= Math.max(1, k - 5); j--) {
      if (isDerivStep(S.steps[j - 1], built[j - 1])) break;
      kids.push({ label: j === k ? $t('This step, twice') : $t('f{a}–f{b}, twice', { a: sub(j), b: sub(k) }), run: () => { setRepeat(k, { n: 2, len: k - j + 1 }); focusRepeatField(k); } });
    }
    return kids;
  }
  // a deformation range the user just chose plays from its start, so the change shows; not under reduced motion
  function playNewRange() {
    if (morph.open && !morph.playing && !matchMedia('(prefers-reduced-motion: reduce)').matches) togglePlay();
  }
  // what the deformation deforms in words, for Y's title: "Deforming f₁–f₂" (the active steps inside its range);
  // null when it deforms every step
  function rangeWords(fmt) {
    const r = homRangeOk();
    if (!r) return null;
    const ks = activeSteps().filter((k) => k >= r.a && k <= r.b);
    return $t('Deforming {steps}', { steps: stepRuns(ks, fmt === 'html') });
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
  // after the chain's steps were replaced, added, removed or reordered: the Inspector's fields belong to the old steps, so it
  // draws them again, and the panes' titles follow
  function chainRebuilt() {
    if (insp) insp.invalidate();
    updateFocusUI();
    requestRender('P');
  }
  // a step of a type this build does not know still gets a definition (its error comes from Funcs.build)
  const defOf = (st) => Funcs.DEFS[st.type] || { label: String(st.type), params: [] };
  function stepMenu(anchor, k, opt) { return openMenu(anchor, stepMenuItems(anchor, k, opt)); }
  // the keys that edit a step on the steps view's chips: Alt+← / Alt+→ move it (move: -1, 1), Delete or Backspace remove it
  // (remove: true)
  function stepEditKey(e) {
    if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) return { move: e.key === 'ArrowLeft' ? -1 : 1 };
    if (e.key === 'Delete' || e.key === 'Backspace') return { remove: true };   // (any modifier: ⌘⌫ on a Mac)
    return null;
  }
  // a step's short name, for the planes' heads and the steps view: the catalog name, or a shorter one where the catalog's
  // is long (Möbius: «Мёбиус», not «Дробно-линейная»)
  function cardName(st, d) {
    if (st.type === 'mobius') return $tx('card', 'Möbius');
    if (st.type === 'ijouk') return $tx('card', 'Inverse Joukowski');
    if (st.type === 'blaschke') return $tx('card', 'Disk automorphism');
    // («Гиперболический» is long; the short name says «Гиперб.»)
    if (st.type === 'sinh') return $tx('card', 'Hyperbolic sine');
    if (st.type === 'cosh') return $tx('card', 'Hyperbolic cosine');
    if (st.type === 'tanh') return $tx('card', 'Hyperbolic tangent');
    return d.label;
  }
  // F's guarantees in one short word each, as the palette's rows name them; the Inspector
  // keeps the full names
  const FT_WORD = () => ({ analytic: $tx('ftile', 'Analytic'), entire: $tx('ftile', 'Entire'), rational: $tx('ftile', 'Rational'), polynomial: $tx('ftile', 'Polynomial'),
    mobius: $tx('ftile', 'Möbius'), proper: $tx('ftile', 'Proper'), homeo: $tx('ftile', 'Homeomorphic'), conformal: $tx('ftile', 'Conformal') });
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
  // keep every field of step k's parameter `key` in step with the one it was typed in (`from`, its id's prefix)
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
  function addStep(type, params, at, o) {
    const st = { type, params: Object.assign(Funcs.defaults(type), params || {}), on: true };
    if (at == null) at = S.focus > 0 ? S.focus : S.steps.length;
    at = Math.max(0, Math.min(S.steps.length, at));
    spliceSteps(at, 0, st);
    chainChanged(true);
    // (the planes keep what they showed, F or the step shown alone; the new step is selected, and the
    // toast offers Show alone: Show alone is its own choice, ui-redesign-2)
    keepShown(at + 1, 1);
    commit();
    startTransition(at + 1);
    noteRecent(type);
    soundCue('stepAdd');
    addedToast(at + 1, 1, null, o && o.msg);
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
    return r;
  }
  // (UX01) after a step is added, moved or duplicated: the step shown alone, if any, stays shown (its index moved by
  // the n new steps at k, or by the move), and step k is selected for the Inspector
  function keepShown(k, n, from) {
    let f = S.focus;
    if (from != null) f = f === from ? k : f > from && f <= k ? f - 1 : f < from && f >= k ? f + 1 : f;
    else if (f >= k) f += n;
    setFocus(Math.max(0, Math.min(S.steps.length, f)), f === S.focus);
    setSel(k);
    requestRender('P');
  }
  // "Added f₃ Sine · Show alone · Undo" (the toast's Show alone shows the first new step; one undo for all n)
  function addedToast(k, n, verb, msgOf) {
    const name = n === 1 ? defOf(S.steps[k - 1]).label : '';
    const msg = msgOf ? msgOf(k) : verb === 'dup' ? $t('Duplicated f{x} as f{x2}.', { x: sub(k - 1), x2: sub(k) })
      : n === 1 ? $t('Added f{x} {name}.', { x: sub(k), name }) : $t('Added f{x}–f{x2}.', { x: sub(k), x2: sub(k + n - 1) });
    undoToast(msg, S.focus === k ? null : [$t('Show alone'), () => { if (S.steps[k - 1]) { setFocus(k); requestRender('P'); } }]);
  }
  // a formula added as its steps (the palette's Add as n steps): one commit; the planes keep what they showed,
  // so into an empty chain F is the formula the user typed, with its parts as the steps
  function addSteps(list, at) {
    if (at == null) at = S.focus > 0 ? S.focus : S.steps.length;
    at = Math.max(0, Math.min(S.steps.length, at));
    const news = list.map((s) => ({ type: s.type, params: Object.assign(Funcs.defaults(s.type), s.params), on: true }));
    spliceSteps(at, 0, ...news);
    chainChanged(true);
    keepShown(at + 1, news.length);   // (the planes keep F, the first new step is selected)
    commit();
    startTransition(at + 1);
    for (const s of news) noteRecent(s.type);
    soundCue('stepAdd');
    addedToast(at + 1, news.length);
  }
  function removeStep(k) {
    const name = defOf(S.steps[k - 1]).label;
    // (the deformation's range by index: a removed step leaves it, so it shrinks; a range of that step alone is dropped)
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
    addedToast(k + 1, 1, 'dup');
  }
  // move step k by d places: true, or null when that is past an end of the chain
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
    return true;
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
  // the ⋯ menu's Replace with the inverse (and "Inverse of f_k" in the palette): the inverse step when the step has a single-valued one on
  // its branch; otherwise the reason, with the way to see every preimage instead
  function inverseAction(k) {
    const b = built[k - 1], st = S.steps[k - 1];
    if (!b || b.error || !st || isDerivStep(st, b)) return;
    if (b.inverse) { invertStep(k); return null; }
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
    return null;
  }
  // the palette's Clear chain: every step goes, as one undo step
  function clearChain() {
    if (!S.steps.length) return;
    setSteps([]); setFocusStep(0); chainChanged(true); setFocus(0); commit(); undoToast($t('Chain cleared.'));
  }
