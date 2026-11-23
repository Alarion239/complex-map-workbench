  // ---------------- the glide's formula tile (#1533) ----------------
  // While the steps view glides between two planes, a small chip over the left plane shows the formula of the plane it
  // leaves, w_a = …, fading into the formula of the plane it goes to, w_b = …, with the glide's position (a plane's
  // formula: the steps through it composed, compositeTexShort; z for plane z). It is of low priority: it takes the first
  // spot clear of every visible control, chip, key, toast, sheet and the plane's note (svTileSpot), and is hidden when
  // there is none, where the formula of that part of the glide does not fit it (SV_TILE_W of the plane's width, the
  // math at its own size), and whenever the thread is on a plane. It pictures what the head already names, and an
  // arrival is spoken by the steps view's live region, so it is hidden from assistive technology and takes no pointer
  // and no focus. The formulas fade only while the glide moves: with the thread at rest between two planes, and under
  // reduced motion, they change over at the glide's half, so a still tile never shows the two over each other
  const SV_TILE_GAP = 8;   // (px: from the plane's edges and from what it keeps clear of)
  const SV_TILE_W = (plotW) => (plotW < 560 ? 0.62 : 0.45) * plotW;   // (px: the widest it may be)
  // how far the second formula has faded in at the glide's position u: across SV_TILE_X about the half, so the two are
  // seldom on top of each other (the first wholly shown before it, the second after); with step, a change-over at the
  // half
  const SV_TILE_X = 0.2;
  const svTileFade = (u, step) => (step ? (u < 0.5 ? 0 : 1) : Math.min(1, Math.max(0, (u - 0.5) / SV_TILE_X + 0.5)));
  // what the tile keeps clear of, besides the plane's own children (the canvases and the hairline aside) and its note
  const SV_TILE_AVOID = '#svStrip, .sv-bandx, .sv-playpop, #toastHost > *, .ph-col, .ph-ctx, .ph-keys, .ph-sheet, .ph-scrim, '
    + '.sv-sheet, .sv-scrim, #paneL .pane-head, #popHost > *, .pop, dialog[open], .tour-root, .tour-top';
  const svTile = { el: null, a: null, b: null, key: '', texA: null, texB: null, q: 0, q2: 0, fitA: false, fitB: false, spot: null, pw: 0, ph: 0 };
  // the formula shown for plane k: z, or w_k = the steps through k composed; null when it is longer than the caption's
  // limit (SV_CAP_TEX_MAX) or a step cannot write it
  function svTileTex(k) {
    if (k === 0) return 'z';
    let c = null;
    try { c = compositeTexShort(k); } catch (e) { c = null; }
    return c && c.length < SV_CAP_TEX_MAX ? `w_{${k}} = ${c}` : null;
  }
  function svTileBuild() {
    const plot = $('plotL');
    if (!plot) return null;
    svTile.a = h('span', { class: 'sv-tile-f' });
    svTile.b = h('span', { class: 'sv-tile-f' });
    svTile.el = h('div', { class: 'sv-tile', id: 'svTile', 'aria-hidden': 'true', hidden: '' }, svTile.a, svTile.b);
    plot.append(svTile.el);
    // (placed again, once a frame, when what it keeps clear of may have moved while the thread is held: a phone's sheet
    // or a dialog opening, a toast coming, going or placed, the plane, its key or the strip resized; and when a formula
    // is typeset, MathJax's result coming after the fallback text)
    const again = () => { if (!svTile.q) svTile.q = requestAnimationFrame(() => { svTile.q = 0; svTileRefresh(); }); };
    new MutationObserver(again).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(again).observe(document.body, { childList: true });
    const th = $('toastHost'), pop = $('popHost');
    for (const e of [th, pop]) if (e) new MutationObserver(again).observe(e, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
    // (a toast slides in: its box is final when its animation ends)
    if (th) for (const ev of ['animationend', 'transitionend']) th.addEventListener(ev, again, true);
    for (const e of [svTile.a, svTile.b]) new MutationObserver(again).observe(e, { childList: true });
    const ro = new ResizeObserver(again);
    for (const e of [plot, $('leftLegend'), $('svStrip'), th]) if (e) ro.observe(e);
    return svTile.el;
  }
  const svTileRefresh = () => { if (SV.on && SV.els && !SV.offscreen && svTile.el) svTileSync(true); };
  const svTileVis = (e) => {
    if (!e || !e.isConnected || e === svTile.el || e.hidden) return null;
    if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return null;
    const r = e.getBoundingClientRect();
    return r.width > 1 && r.height > 1 ? r : null;
  };
  // the boxes the tile keeps clear of, in the page's px: the plane's children but its canvases and hairline, what
  // SV_TILE_AVOID names, and the plane's note (paneL.noteBox, in the pane's px from its canvas)
  function svTileObstacles(plot) {
    const out = [];
    for (const e of plot.children) if (e.tagName !== 'CANVAS' && !e.classList.contains('hairline')) { const r = svTileVis(e); if (r) out.push(r); }
    for (const e of document.querySelectorAll(SV_TILE_AVOID)) { const r = svTileVis(e); if (r) out.push(r); }
    const nb = paneL.noteBox, cv = $('canvasL');
    if (nb && cv) { const c = cv.getBoundingClientRect(); out.push({ left: c.left + nb.x, top: c.top + nb.y, right: c.left + nb.x + nb.w, bottom: c.top + nb.y + nb.h }); }
    return out;
  }
  // the tile's spot in the plane (its left and top in the plane's px), w x h px: the first of the plane's corners,
  // bottom left, top left, bottom right, top right, from which it can slide along the plane's side, away from the corner,
  // past what it meets until it is clear of everything (SV_TILE_GAP from each), inside the plane; null when none is
  function svTileSpot(P, w, h, obs) {
    const g = SV_TILE_GAP, hit = (x, y) => obs.find((o) => x - g < o.right && x + w + g > o.left && y - g < o.bottom && y + h + g > o.top);
    for (const [left, top] of [[true, false], [true, true], [false, false], [false, true]]) {
      const x = left ? P.left + g : P.right - g - w;
      let y = top ? P.top + g : P.bottom - g - h;
      for (let n = 0; n < 8 && y >= P.top + g && y + h <= P.bottom - g; n++) {
        const o = hit(x, y);
        if (!o) return { left: x - P.left, top: y - P.top };
        y = top ? o.bottom + g : o.top - g - h;
      }
    }
    return null;
  }
  // the tile's layout for the planes it is between (svTile.fitA, fitB: which formulas fit; spot: where it goes, or null),
  // measured shown at no spot yet: a formula wider than the tile may be is left out
  function svTileLay(plot) {
    const el = svTile.el, P = plot.getBoundingClientRect(), maxW = SV_TILE_W(P.width);
    svTile.pw = plot.clientWidth; svTile.ph = plot.clientHeight;
    el.style.maxWidth = maxW + 'px';
    el.style.visibility = 'hidden'; el.hidden = false;
    svTile.a.hidden = svTile.b.hidden = false;
    const pad = el.offsetWidth - el.clientWidth + 16;
    svTile.fitA = !!svTile.texA && svTile.a.scrollWidth + pad <= maxW; svTile.fitB = !!svTile.texB && svTile.b.scrollWidth + pad <= maxW;
    svTile.a.hidden = !svTile.fitA; svTile.b.hidden = !svTile.fitB;
    svTile.spot = svTile.fitA || svTile.fitB ? svTileSpot(P, el.offsetWidth, el.offsetHeight, svTileObstacles(plot)) : null;
  }
  // the tile, every frame the steps view syncs: shown between two planes, its formulas cross-faded by the glide's
  // position (svTileFade), at a clear spot; hidden otherwise. It is laid out again (svTileLay) only when the planes it is
  // between change, the plane is resized, or full (an observer's call, svTileRefresh): a frame of the glide sets the
  // formulas' opacities alone
  function svTileSync(full = false) {
    const el = svTile.el || svTileBuild();
    if (!el) return;
    const bt = svBetween(), still = bt.b === bt.a || bt.u <= SV_REST_U || bt.u >= 1 - SV_REST_U;
    if (still) { if (!el.hidden) el.hidden = true; return; }
    const key = bt.a + '|' + bt.b, plot = $('plotL');
    if (key !== svTile.key) {
      svTile.key = key; full = true;
      svTile.texA = svTileTex(bt.a); svTile.texB = svTileTex(bt.b);
      for (const [n, t] of [[svTile.a, svTile.texA], [svTile.b, svTile.texB]]) { if (t) TeX.set(n, t); else { n.textContent = ''; delete n.dataset.tex; } }
    }
    if (full || plot.clientWidth !== svTile.pw || plot.clientHeight !== svTile.ph) svTileLay(plot);
    // (each formula in its own part of the glide: one that does not fit leaves the tile empty there, and so hidden)
    // (fading while the glide moves, and synced again a frame on, so the tile is still once the thread comes to rest)
    const moving = svGliding(), e = svTileFade(bt.u, svReduced() || !moving), any = (svTile.fitA && e < 1) || (svTile.fitB && e > 0);
    if (moving && !svTile.q2) svTile.q2 = requestAnimationFrame(() => { svTile.q2 = 0; if (SV.on && SV.els && !SV.offscreen) svTileSync(); });
    const spot = any ? svTile.spot : null;
    if (!spot) { el.hidden = true; el.style.visibility = ''; return; }
    svTile.a.style.opacity = String(1 - e); svTile.b.style.opacity = String(e);
    el.hidden = false;
    el.style.left = spot.left + 'px'; el.style.top = spot.top + 'px'; el.style.visibility = '';
  }
