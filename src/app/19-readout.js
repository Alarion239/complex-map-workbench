  // ---------------- the readout card: a stage disc's preimage on the plane shown ----------------
  // In the steps view, a disc of a later plane T (its stage) has its preimage drawn on the plane shown, k = leftStage()
  // (stagePullbacks). When it is selected, the Inspector's card for it reads that preimage:
  // - the counts: the preimages of its centre, with multiplicity, and the pieces of the preimage of the disc, those that
  //   cover it more than once, and the holes (Pieces.count: the roots followed once round the rim);
  // - an r slider for its radius, from its first step up (a radius is above 0), with a red tick at each join radius,
  //   where pieces join or a piece closes round a hole (Critical.joinRadii), the radii said in words under it; the
  //   counts are a polite live region, so they are said as the slider moves;
  // - how many of its pieces lie off the window ("+n off view" on the plane: drawPullOff).
  // Where the pieces cannot be counted (no exact inverse, or critical values not known), the card says so.
  const RO_SPAN = 2;          // the slider's top: RO_SPAN times the larger of r and the largest join radius
  const RO_STEPS = 400;       // about the slider's steps from 0 to its top (a whole number of them up to r, so r is one)
  const roCache = new Map();
  // the critical data of the steps from plane k to T (Critical.ofChain), kept per plane, stage and chain, for the card and
  // for Look down. Where the critical points are infinitely many, those in the window win are listed: they are pulled back
  // over the window grown by CRIT_PAD of its size on each side, at most CRIT_CAP of them, again only when win leaves that
  // box or is under a quarter of its width, so a pan within it costs nothing
  const CRIT_PAD = 0.5, CRIT_CAP = 96;
  const critCache = new Map();
  function stageCritical(k, T, win = null) {
    const key = JSON.stringify([k, T, chainSig[nSteps()]]);
    let d = critCache.get(key);
    if (!d) {
      try { d = { cr: Critical.ofChain(S.steps, built, k, T) }; } catch (e) { d = { cr: null }; }
      critCache.set(key, d);
      while (critCache.size > 16) critCache.delete(critCache.keys().next().value);
    }
    const cr = d.cr;
    if (!win || !cr || cr.points.complete || !cr.values.known) return cr;
    const w = d.win, wx = win.x1 - win.x0, wy = win.y1 - win.y0;
    if (!w || win.x0 < w.x0 || win.x1 > w.x1 || win.y0 < w.y0 || win.y1 > w.y1 || wx < (w.x1 - w.x0) / 4) {
      d.win = { x0: win.x0 - CRIT_PAD * wx, x1: win.x1 + CRIT_PAD * wx, y0: win.y0 - CRIT_PAD * wy, y1: win.y1 + CRIT_PAD * wy };
      try { d.inWin = Critical.ofChain(S.steps, built, k, T, d.win, CRIT_CAP); } catch (e) { d.inWin = cr; }
    }
    return d.inWin;
  }
  // whether the selected shape s gets the card: a disc of a later plane than the one shown
  const readoutOn = (s) => !!(s && SV.on && s.kind === 'disc' && !s.complement && shapeStage(s) > leftStage());
  // whether s's card is built: in the Inspector, or under its editor in its row in Shapes (a phone, or the panel hidden;
  // the row's sheet may be closed)
  const readoutShown = (s) => readoutOn(s) && (inspEditsShapes() || !!(shapeRows.get(s.id) && shapeRows.get(s.id).ro));
  // {pc: Pieces.count's answer, joins: the join radii about the disc's centre, stuck: where pc is not counted, the step
  // the count stops at (chainStuck)}, kept per plane, stage, chain and disc
  function readoutData(s) {
    const k = leftStage(), T = shapeStage(s), c = C(s.c[0], s.c[1]), key = JSON.stringify([k, T, chainSig[nSteps()], s.c, s.r]);
    let d = roCache.get(key);
    if (!d) {
      let pc = { counted: false }, joins = [];
      try { pc = Pieces.count(S.steps, built, k, T, c, s.r); } catch (e) { pc = { counted: false }; }
      try {
        const cr = stageCritical(k, T);
        if (cr && cr.values.known) joins = Critical.joinRadii(cr.values.list, c).map((e) => e.r).filter((r) => r > 0);
      } catch (e) { joins = []; }
      let stuck = null;
      if (!pc.counted) { try { stuck = chainStuck(k, T, c, s.r); } catch (e) { stuck = null; } }
      d = { pc, joins, stuck };
      roCache.set(key, d);
      while (roCache.size > 32) roCache.delete(roCache.keys().next().value);
    }
    return d;
  }
  const roNum = (x) => I18N.num(CX.fmtNum(x, 3));
  // the counts in words: "3 preimages · 2 pieces · one covers the disc twice"; not counted, the step with no exact inverse
  // that stops the count (stuck: readoutData's) where there is one
  function readoutCounts(pc, stuck = null) {
    if (!pc.counted && stuck) return $t('The pieces of its preimage are not counted: step {k} ({f}) has no exact inverse', { k: stuck.step, f: stuck.name || '?' });
    if (!pc.counted) return $t('The pieces of its preimage are not counted for these steps');
    const n = pc.roots.reduce((a, q) => a + (q.z === null ? 0 : q.mult), 0), multi = pc.pieces.filter((q) => q.covers > 1);
    const parts = [$tn('{n} preimage', '{n} preimages', n, { n }), $tn('{n} piece', '{n} pieces', pc.pieces.length, { n: pc.pieces.length })];
    if (multi.length === 1) parts.push(multi[0].covers === 2 ? $t('one covers the disc twice') : $t('one covers the disc {k} times', { k: multi[0].covers }));
    else if (multi.length > 1) parts.push($t('{n} cover the disc more than once', { n: multi.length }));
    if (pc.holes > 0) parts.push($tn('{n} hole', '{n} holes', pc.holes, { n: pc.holes }));
    return parts.join(' · ');
  }
  // the card's part of the Inspector for shape s, or null: {root, counts, range, ticks, joins, off}
  function readoutBuild(s) {
    if (!readoutOn(s)) return null;
    const counts = h('div', { class: 'ro-counts', 'aria-live': 'polite' });
    const val = h('span', { class: 'fval mono' });
    const range = h('input', { type: 'range', min: 0, class: 'ro-r', 'aria-label': $t('Radius r, against the join radii'),
      oninput: () => {
        const sh = findShape(s.id);
        if (!sh) return;
        // (0, at the slider's left end, is no radius: the slider's first step is the least)
        let v = +range.value;
        if (!(v > 1e-9)) { v = +range.step; range.value = String(v); }
        sh.r = v; readoutFill(E, sh); shapesChanged(false);
      },
      onchange: () => commit() });
    const ticks = h('div', { class: 'ro-ticks', 'aria-hidden': 'true' });
    const joins = h('div', { class: 'ro-joins' }), off = h('div', { class: 'ro-off' });
    // (Look down's switch, 19-lookdown.js)
    const look = checkEl('ld_' + s.id, lookDown, $t('Look down'), (v) => { lookDown = v; requestRender('OL'); });
    look.classList.add('ro-look');   // (hidden on the Stack, whose view control has a Look down of its own: 19-stack.js)
    const row = h('label', { class: 'fader-row ro-row' }, h('span', { class: 'fl', html: $t('radius <i>r</i>') }), val, h('div', { class: 'ro-track' }, range, ticks));
    const E = { root: h('div', { class: 'ro-card', 'data-id': s.id }, h('div', { class: 'cm-ilabel', html: $t('Preimage on {w}', { w: svNameHtml(leftStage()) }) }), counts, row, joins, off, look), counts, range, val, ticks, joins, off, top: 0 };
    return E;
  }
  // the slider's value, its top (kept while r stays below it) and its ticks at the join radii
  function roFillRange(E, s) {
    const { joins } = readoutData(s), big = Math.max(s.r, ...joins);
    if (!(E.top >= s.r)) E.top = RO_SPAN * big;
    E.range.max = String(E.top);
    const step = +E.range.step;
    if (!(step > 0) || Math.abs(Math.round(s.r / step) * step - s.r) > 1e-9 * s.r) E.range.step = String(s.r / Math.max(1, Math.round(s.r * RO_STEPS / E.top)));
    if (+E.range.value !== s.r) E.range.value = String(s.r);
    E.range.setAttribute('aria-valuetext', `r = ${roNum(s.r)}`);
    E.val.textContent = roNum(s.r);
    paintFader(E.range);
    // (the phone's 44 px thumb: its track is filled to the thumb's centre from --f, phone.css)
    E.range.style.setProperty('--f', String(s.r / E.top));
    const sig = joins.map((r) => r.toPrecision(6)).join(',') + '|' + E.top;
    if (E.ticks.dataset.sig !== sig) {
      E.ticks.dataset.sig = sig;
      E.ticks.replaceChildren(...joins.filter((r) => r <= E.top).map((r) => h('span', { class: 'ro-tick', 'data-r': String(r), style: `--f: ${r / E.top}` })));
    }
  }
  // the card filled for shape s: the counts, the slider, the join radii in words, the pieces off the window
  function readoutFill(E, s) {
    const { pc, joins, stuck } = readoutData(s);
    const text = readoutCounts(pc, stuck);
    if (E.counts.textContent !== text) E.counts.textContent = text;
    roFillRange(E, s);
    const jt = joins.length ? $t('Pieces join at r = {list}', { list: joins.map(roNum).join(', ') }) : pc.counted ? $t('No pieces join as r grows') : '';
    if (E.joins.textContent !== jt) E.joins.textContent = jt;
    const o = pullOffDrawn.find((e) => e.id === s.id), ot = o ? $tn('{n} piece off view', '{n} pieces off view', o.n, { n: o.n }) : '';
    if (E.off.textContent !== ot) E.off.textContent = ot;
    E.off.hidden = !ot;
  }
  // the selected disc's card refreshed where it shows: the Inspector, or its row in Shapes (a phone, or the panel hidden)
  function readoutRefresh() {
    requestRender('P');
    const s = findShape(selected), r = s && shapeRows.get(s.id);
    if (r && r.ro) readoutFill(r.ro, s);
  }
  // TEST-HOOK (dropped from the published page by build.py): the card as shown, or null; where is 'insp' (the Inspector)
  // or 'row' (the disc's row in Shapes)
  window.__cmwReadout = () => {
    const el = /** @type {HTMLElement} */ (document.querySelector('#propsPanel .ro-card') || document.querySelector('.ro-card'));
    if (!el) return null;
    const r = /** @type {HTMLInputElement} */ (el.querySelector('.ro-r')), off = /** @type {HTMLElement} */ (el.querySelector('.ro-off'));
    return { id: el.dataset.id, where: el.closest('#propsPanel') ? 'insp' : 'row', counts: el.querySelector('.ro-counts').textContent, joins: el.querySelector('.ro-joins').textContent, off: off.hidden ? '' : off.textContent,
      r: +r.value, max: +r.max, ticks: [.../** @type {NodeListOf<HTMLElement>} */ (el.querySelectorAll('.ro-tick'))].map((t) => { const a = t.getBoundingClientRect(), b = r.getBoundingClientRect(); return { r: +t.dataset.r, x: a.left + a.width / 2 - b.left, w: b.width }; }) };
  };
  // TEST-HOOK
