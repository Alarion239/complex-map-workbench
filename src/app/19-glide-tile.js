  // ---------------- the glide's formula tile (#1533) ----------------
  // While the steps view glides between two planes, a small chip over the left plane shows the formula of the plane it
  // leaves, w_a = …, then the formula of the plane it goes to, w_b = …, with the glide's position (a plane's
  // formula: the steps through it composed, compositeTexShort; z for plane z). It is of low priority: it takes the first
  // spot clear of every visible control, chip, key, toast, sheet and the plane's note (svTileSpot), and is hidden when
  // there is none (a tour's layers cover the viewport, so while one runs there is none), where the formula of that part
  // of the glide does not fit it (SV_TILE_W of the plane's width, the math at its own size), and whenever the thread is
  // on a plane. It pictures what the head already names, and an arrival is spoken by the steps view's live region, so it
  // is hidden from assistive technology and takes no pointer and no focus. Between the two planes the first formula
  // turns into the second glyph by glyph (#2409): a glyph only the first has fades out, then a glyph of one that is a
  // glyph of the other (GlyphMatch.match) slides and resizes from its place in the first to its place in the second,
  // across the middle of the way, then a glyph only the second has fades in; the plane's name's index changes over in
  // place as those start to come in. The frame is the thread's position's alone (svTileMorphAt), so a
  // held, dragged or played thread at the same place shows the same frame. Under reduced motion, and where the morph
  // cannot be drawn (a formula not typeset as SVG, or one too wide for the tile), the two change over at the half instead,
  // only the formula shown taking room in the tile: while the glide moves, the first fades out before the half and the
  // second in after it
  const SV_TILE_GAP = 8;   // (px: from the plane's edges and from what it keeps clear of)
  const SV_TILE_W = (plotW) => (plotW < 560 ? 0.62 : 0.45) * plotW;   // (px: the widest it may be)
  // the two formulas' opacities at the glide's position u: the first fades out over SV_TILE_X before the half, the
  // second in over SV_TILE_X after it; with step, a change-over at the half
  const SV_TILE_X = 0.1;
  const svTileOps = (u, step) => (step ? (u < 0.5 ? [1, 0] : [0, 1])
    : [Math.min(1, Math.max(0, (0.5 - u) / SV_TILE_X)), Math.min(1, Math.max(0, (u - 0.5) / SV_TILE_X))]);
  // what the tile keeps clear of, besides the plane's own children (the canvases and the hairline aside) and its note
  const SV_TILE_AVOID = '#svStrip, .sv-bandx, .sv-playpop, #toastHost > *, :root.ph .viewstack .vbtn, .ph-ctx, .ph-keys, .ph-sheet, .ph-scrim, '
    + '.sv-sheet, .sv-scrim, #paneL .pane-head, #popHost > *, .pop, dialog[open], .tour-root, .tour-top';
  // (idle: a layout job is queued, svTileLater; now: a layout may be made, svTileSync's; trace: the test hook's record of
  // each layout and typesetting, with now then, or null)
  const svTile = { el: null, a: null, b: null, m: null, key: '', texA: null, texB: null, q: 0, q2: 0, fitA: false, fitB: false, spot: null, shown: -1, morph: undefined, idle: false, now: false, trace: null };
  // ---- the morph (#2409) ----
  const SV_SVG_NS = 'http://www.w3.org/2000/svg';
  // the affine m then n ([a, b, c, d, e, f]: x' = a x + c y + e, y' = b x + d y + f)
  const svTileMul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  // the glyphs of a typeset formula (MathJax's <svg>): each <use> (a glyph of its font), <rect> (a rule) and <text> (a
  // character the font lacks) with its class and the affine that places it in the svg's user space, the transforms of
  // the groups around it composed (read from the SVG DOM, which needs no layout: the tile's hidden formula has none);
  // a <use>'s x and y, and a rule as the unit square scaled to its size. Its point for the matching: a glyph's origin, a
  // rule's middle. The plane's name the formula starts with (w_k, MathJax's first msub) is a class of its own, "name:",
  // so its w goes to the other's w and its subscript, another plane's, to nothing: never to a digit of the formula
  function svTileGlyphs(svg) {
    const out = [];
    let named = false;
    const walk = (el, m, pre = '') => {
      for (const c of el.children) {
        const tag = c.tagName.toLowerCase();
        if (tag === 'defs' || tag === 'title' || tag === 'desc') continue;
        const tl = c.transform && c.transform.baseVal && c.transform.baseVal.consolidate(), t = tl && tl.matrix;
        const n = t ? svTileMul(m, [t.a, t.b, t.c, t.d, t.e, t.f]) : m, at = (k) => parseFloat(c.getAttribute(k)) || 0;
        if (tag === 'use') {
          const href = c.getAttribute('href') || c.getAttribute('xlink:href') || '', g = svTileMul(n, [1, 0, 0, 1, at('x'), at('y')]);
          out.push({ kind: 'use', href, c: c.getAttribute('data-c'), k: pre + GlyphMatch.glyphClass(href, c.getAttribute('data-c')), m: g, x: g[4], y: g[5] });
        } else if (tag === 'rect') {
          const w = at('width'), h = at('height'), g = svTileMul(n, [w, 0, 0, h, at('x'), at('y')]);
          out.push({ kind: 'rect', k: pre + GlyphMatch.ruleClass(w, h), m: g, x: g[0] / 2 + g[2] / 2 + g[4], y: g[1] / 2 + g[3] / 2 + g[5] });
        } else if (tag === 'text') out.push({ kind: 'text', node: c, k: pre + 'text:' + c.textContent, m: n, x: n[0] * at('x') + n[2] * at('y') + n[4], y: n[1] * at('x') + n[3] * at('y') + n[5] });
        else if (!named && c.getAttribute('data-mml-node') === 'msub') { named = true; walk(c, n, 'name:'); } else walk(c, n, pre);
      }
    };
    walk(svg, [1, 0, 0, 1, 0, 0]);
    return out;
  }
  // a typeset formula's frame: its viewBox, its width and height (ex) and its vertical-align (ex)
  const svTileBox = (svg) => {
    const vb = (svg.getAttribute('viewBox') || '0 0 0 0').split(/[\s,]+/).map(Number), ex = (v) => parseFloat(v) || 0;
    return { vb, w: ex(svg.getAttribute('width')), h: ex(svg.getAttribute('height')), va: ex(svg.style.verticalAlign) };
  };
  // the morph's frame, one for all of it: the two formulas' frames together (both from the left edge and the baseline, at
  // one scale), so each glyph, where it starts and where it ends, is inside it, and the tile does not change size while
  // the thread moves (its spot, svTileLay, holds the larger formula)
  function svTileUnion(sa, sb) {
    const A = svTileBox(sa), B = svTileBox(sb), ex = A.vb[2] ? A.w / A.vb[2] : B.vb[2] ? B.w / B.vb[2] : 0;
    const x0 = Math.min(A.vb[0], B.vb[0]), y0 = Math.min(A.vb[1], B.vb[1]), x1 = Math.max(A.vb[0] + A.vb[2], B.vb[0] + B.vb[2]), y1 = Math.max(A.vb[1] + A.vb[3], B.vb[1] + B.vb[3]);
    return { vb: [x0, y0, x1 - x0, y1 - y0], w: (x1 - x0) * ex, h: (y1 - y0) * ex, va: -y1 * ex };
  }
  // the morph from the first formula to the second, built once for the pair and kept for the last SV_TILE_MORPHS pairs
  // (svTile.morph; null where it cannot be: a formula not typeset as SVG): an <svg>, in MathJax's container so its glyphs
  // are drawn as the formulas' are, with both formulas' glyph definitions and one node for each glyph pair, each glyph
  // only the first has and each only the second has, with its affines at the two ends
  const SV_TILE_MORPHS = 16, svTileMorphs = new Map();
  function svTileMorph() {
    const key = svTile.texA + '\u0001' + svTile.texB;
    if (svTileMorphs.has(key)) return svTileMorphs.get(key);
    const sa = svTile.a.querySelector('svg'), sb = svTile.b.querySelector('svg');
    if (!sa || !sb) return null;
    const A = svTileGlyphs(sa), B = svTileGlyphs(sb), mt = GlyphMatch.match(A, B);
    const svg = document.createElementNS(SV_SVG_NS, 'svg'), defs = document.createElementNS(SV_SVG_NS, 'defs'), root = document.createElementNS(SV_SVG_NS, 'g'), ids = new Set();
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    for (const d of [sa, sb].flatMap((x) => [...x.querySelectorAll('defs > *')])) if (!ids.has(d.id)) { ids.add(d.id); defs.append(d.cloneNode(true)); }
    for (const [k, v] of [['fill', 'currentColor'], ['stroke', 'currentColor'], ['stroke-width', '0']]) root.setAttribute(k, v);
    svg.append(defs, root);
    const node = (g) => {
      if (g.kind === 'text') { const t = g.node.cloneNode(true); t.removeAttribute('transform'); return t; }
      const e = document.createElementNS(SV_SVG_NS, g.kind);
      if (g.kind === 'use') { e.setAttribute('href', g.href); if (g.c) e.setAttribute('data-c', g.c); } else { e.setAttribute('width', '1'); e.setAttribute('height', '1'); }
      return e;
    };
    // (each part's role: a pair, a glyph of the first alone ('out'), of the second alone ('in'), or the name's index of
    // either ('nameOut', 'nameIn'))
    const named = (g) => g.k.startsWith('name:'), parts = [];
    for (const [i, j] of mt.pairs) parts.push({ el: node(A[i]), k: A[i].k, a: A[i].m, b: B[j].m, role: 'pair' });
    for (const i of mt.gone) parts.push({ el: node(A[i]), k: A[i].k, a: A[i].m, b: A[i].m, role: named(A[i]) ? 'nameOut' : 'out' });
    for (const j of mt.come) parts.push({ el: node(B[j]), k: B[j].k, a: B[j].m, b: B[j].m, role: named(B[j]) ? 'nameIn' : 'in' });
    for (const p of parts) root.append(p.el);
    const box = document.createElement('mjx-container');
    box.className = 'MathJax'; box.setAttribute('jax', 'SVG');
    box.append(svg);
    const u = svTileUnion(sa, sb);
    svg.setAttribute('viewBox', u.vb.map((v) => +v.toFixed(2)).join(' '));
    svg.setAttribute('width', u.w.toFixed(3) + 'ex'); svg.setAttribute('height', u.h.toFixed(3) + 'ex');
    svg.style.verticalAlign = u.va.toFixed(3) + 'ex';
    const mo = { box, svg, parts, pairs: mt.pairs.length };
    if (svTileMorphs.size >= SV_TILE_MORPHS) svTileMorphs.delete(svTileMorphs.keys().next().value);
    svTileMorphs.set(key, mo);
    return mo;
  }
  // the morph's frame for the thread u of the way from the first plane to the second, in GlyphMatch's three parts: the
  // first's glyphs alone fade out, then each pair moves from its place in the first to its place in the second, then the
  // second's glyphs alone fade in; the name's index changes over in place as those start to
  // come in
  function svTileMorphAt(mo, u) {
    const t = GlyphMatch.move(u), op = { pair: 1, out: GlyphMatch.fadeOut(u), in: GlyphMatch.fadeIn(u), nameOut: GlyphMatch.nameOut(u), nameIn: GlyphMatch.nameIn(u) };
    for (const p of mo.parts) {
      p.el.setAttribute('transform', `matrix(${GlyphMatch.lerpM(p.a, p.b, t).map((v) => +v.toFixed(3)).join(' ')})`);
      p.el.setAttribute('opacity', String(+op[p.role].toFixed(3)));
    }
  }
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
    svTile.m = h('span', { class: 'sv-tile-m', hidden: '' });
    svTile.el = h('div', { class: 'sv-tile', id: 'svTile', 'aria-hidden': 'true', hidden: '' }, svTile.a, svTile.b, svTile.m);
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
  // The tile's layout (its formulas typeset, svTileLay's measures, the morph built) is never made in a frame of the steps
  // view's sync (svSync), which may be a glide's first and draws its picture too: the two together are one long task on a
  // slow machine. It is queued for an idle moment, at most SV_TILE_IDLE_MS on (svTileLater, one at a time), and
  // the tile is hidden until then where what it would show is not laid out yet. An observer's refresh (svTileRefresh:
  // what it keeps clear of moved) lays it out at once while the thread is still, so it is never seen over what came, and
  // is queued the same way while a glide moves
  const SV_TILE_IDLE_MS = 120;
  function svTileLater() {
    if (svTile.idle) return;
    const run = () => { svTile.idle = false; if (SV.on && SV.els && !SV.offscreen && svTile.el) svTileSync(true, true); };
    svTile.idle = true;
    if (window.requestIdleCallback) window.requestIdleCallback(run, { timeout: SV_TILE_IDLE_MS }); else setTimeout(run, 0);
  }
  const svTileRefresh = () => { if (SV.on && SV.els && !SV.offscreen && svTile.el) { if (svGliding()) svTileLater(); else svTileSync(true, true); } };
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
  // the tile's layout, measured shown at no spot yet: which formulas fit for the planes it is between (svTile.fitA,
  // fitB: one wider than the tile may be is left out), with full; and the spot for formula i (0 the first, 1 the second)
  // alone in it, or the morph (2) whose one frame holds both (svTile.spot, or null; svTile.shown = i)
  function svTileLay(plot, i, full) {
    if (svTile.trace) svTile.trace.push({ what: 'lay', i, now: svTile.now });
    const el = svTile.el, P = plot.getBoundingClientRect(), maxW = SV_TILE_W(P.width);
    el.style.visibility = 'hidden'; el.hidden = false;
    if (full) {
      el.style.maxWidth = maxW + 'px';
      svTile.a.hidden = svTile.b.hidden = false;
      const pad = el.offsetWidth - el.clientWidth + 16;
      svTile.fitA = !!svTile.texA && svTile.a.scrollWidth + pad <= maxW; svTile.fitB = !!svTile.texB && svTile.b.scrollWidth + pad <= maxW;
    }
    svTile.a.hidden = i !== 0; svTile.b.hidden = i !== 1; svTile.m.hidden = i !== 2;
    svTile.shown = i;
    svTile.spot = svTileSpot(P, el.offsetWidth, el.offsetHeight, svTileObstacles(plot));
  }
  // the tile, every frame the steps view syncs: shown between two planes, at a clear spot, the morph's frame for the
  // thread's position (svTileMorphAt), or one formula at a time faded by it (svTileOps); hidden otherwise. It is laid out
  // again (svTileLay) only when the planes it is between change, what it shows changes (the morph or one formula), or full
  // (an observer's call, svTileRefresh: the plane resized among them, a formula typeset): a frame of the glide sets the
  // morph's affines and opacities, or the formula's opacity, alone. A layout is made only with now (svTileLater's job,
  // the test hook); a frame that needs one queues it (svTileLater) and hides the tile where what it shows changes
  function svTileSync(full = false, now = false) {
    const el = svTile.el || svTileBuild();
    if (!el) return;
    svTile.now = now;
    const bt = svBetween(), still = bt.b === bt.a || bt.u <= SV_REST_U || bt.u >= 1 - SV_REST_U;
    if (still) { if (!el.hidden) el.hidden = true; return; }
    // (the key holds the app's chain key too (chainSig: the steps, their parameters and repeats): an edit, a Repeat, an undo, a
    // load or the tour's end changes what a pair of planes says)
    const key = bt.a + '|' + bt.b + '|' + chainSig[nSteps()], plot = $('plotL');
    if (key !== svTile.key && !now) { el.hidden = true; svTileLater(); return; }
    if (full && !now) { svTileLater(); full = false; }
    if (key !== svTile.key) {
      svTile.key = key; full = true; svTile.morph = undefined;
      svTile.texA = svTileTex(bt.a); svTile.texB = svTileTex(bt.b);
      if (svTile.trace) svTile.trace.push({ what: 'tex', now });
      for (const [n, t] of [[svTile.a, svTile.texA], [svTile.b, svTile.texB]]) { if (t) TeX.set(n, t); else { n.textContent = ''; delete n.dataset.tex; } }
    }
    // (synced again a frame on while the glide moves, so the tile is still once the thread comes to rest)
    const moving = svGliding();
    if (moving && !svTile.q2) svTile.q2 = requestAnimationFrame(() => { svTile.q2 = 0; if (SV.on && SV.els && !SV.offscreen) svTileSync(); });
    // (the morph, where both formulas fit and are typeset as SVG and motion is not reduced: measured with full, as the
    // formulas are typeset again; built once for the pair)
    if (full) { svTileLay(plot, 0, true); svTile.morph = undefined; }
    if (svTile.morph === undefined) svTile.morph = svTile.fitA && svTile.fitB ? svTileMorph() : null;
    const mo = !svReduced() && svTile.morph;
    // (else the change-over: fading while the glide moves, at the half at rest and under reduced motion; the formula of this
    // part of the glide: one that does not fit, or none at the half while moving, hides the tile)
    const [oa, ob] = mo ? [0, 0] : svTileOps(bt.u, svReduced() || !moving);
    const i = mo ? 2 : oa > 0 ? 0 : ob > 0 ? 1 : -1;
    const relay = (mo && svTile.m.firstChild !== mo.box) || (i >= 0 && i !== svTile.shown);
    if (relay && !now) { el.hidden = true; svTileLater(); return; }
    if (mo && svTile.m.firstChild !== mo.box) { svTile.m.replaceChildren(mo.box); full = true; }
    if (full || (i >= 0 && i !== svTile.shown)) svTileLay(plot, i >= 0 ? i : 0, false);
    const fits = i === 2 ? true : i === 0 ? svTile.fitA : i === 1 ? svTile.fitB : false, spot = fits ? svTile.spot : null;
    if (!spot) { el.hidden = true; el.style.visibility = ''; return; }
    if (i === 2) svTileMorphAt(mo, bt.u);
    else (i === 0 ? svTile.a : svTile.b).style.opacity = String(i === 0 ? oa : ob);
    el.hidden = false;
    el.style.left = spot.left + 'px'; el.style.top = spot.top + 'px'; el.style.visibility = '';
  }
