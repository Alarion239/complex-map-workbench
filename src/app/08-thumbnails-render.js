  // ---------------- thumbnails ----------------
  const thumbs = new Map(); // stage k -> Pane
  // thumbnail sizes come from a ResizeObserver: measuring each canvas after the cards were rebuilt forced a
  // layout per thumbnail
  const thumbSize = new WeakMap();
  const thumbSeen = new Set();
  let thumbRO = null;
  function thumbDims(cv) {
    let s = thumbSize.get(cv);
    if (!s) {
      if (!thumbRO && window.ResizeObserver) {
        thumbRO = new ResizeObserver((es) => {
          let changed = false;
          for (const e of es) {
            const o = thumbSize.get(e.target), w = e.contentRect.width, hh = e.contentRect.height;
            if (!o || o[0] !== w || o[1] !== hh) { thumbSize.set(e.target, [w, hh]); changed = true; }
          }
          if (changed) requestRender('T');
        });
      }
      const r = cv.getBoundingClientRect(); // first sight only
      s = [r.width, r.height];
      thumbSize.set(cv, s);
      if (thumbRO) { thumbRO.observe(cv); thumbSeen.add(cv); }
    }
    return s;
  }
  // thumbnails are cached by signature (stage, chain prefix, shapes, look), so rebuilding the strip is instant
  const thumbCache = new Map();
  let thumbShapesSig = '';
  // v15 (DESIGN.md 2.2, 2.3): a card's picture follows the open view and is cumulative: card k shows F_k, the map up to
  // step k. X → Y: the image of the shapes; Phase: arg F_k over the main plane's z-window (cover-fitted); Landscape:
  // log|F_k| at the main camera, without labels; the Deformation (X → Y): step k at its own t over its grey start. The
  // region card shows the shapes in z. Drawn exactly (the main view's programs), cached by signature, when idle.
  function cardKind() {
    if (S.view.main === 'phase') return 'phase';
    if (S.view.main === 'land') return 'land';
    return morphOn() ? 'def' : 'xy';
  }
  // the time of step k in the deformation: one after another, each its own t; all at once, one t
  function cardT(k) {
    const R = morphRange(), steps = R.steps, j = steps.indexOf(k);
    if (S.focus === 0 && R.r && (k < R.r.a || k > R.r.b)) return 1;   // (v16: outside the bracket, in full)
    if (j < 0) return S.focus > 0 && k < S.focus ? 1 : 0;
    if (allAtOnce()) return Math.max(0, Math.min(1, morph.T));
    return Math.max(0, Math.min(1, morph.T - j));
  }
  // the z-window of the main plane, cover-fitted to a card (the card shows the middle of what the plane shows)
  function cardZView(pane) {
    const v = S.srcView, mw = paneL.w || 1, mh = paneL.h || 1;
    return { cx: v.cx, cy: v.cy, s: v.s * Math.max(pane.w / mw, pane.h / mh) };
  }
  // the landscape's box over the z-window (landBox() is X's, which shows w_{k-1} while a step is shown alone)
  function cardLandBox() {
    const v = S.srcView, hw = (paneL.w || 1) / 2 / v.s, hh = (paneL.h || 1) / 2 / v.s;
    let w = 2 * hw, hgt = 2 * hh;
    if (w > 2 * hgt) w = 2 * hgt; else if (hgt > 2 * w) hgt = 2 * w;
    return { x0: v.cx - w / 2, x1: v.cx + w / 2, y0: v.cy - hgt / 2, y1: v.cy + hgt / 2 };
  }
  const cardMu = new Map();
  function cardMedian(k, box) {
    if (S.height === 'log') return 1;
    const key = `${k}|${chainSig[k]}|${box.x0},${box.x1},${box.y0},${box.y1}|${S.height}`;
    if (cardMu.has(key)) return cardMu.get(key);
    const F = stageF(k), vals = [];
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
      const w = F(C(box.x0 + (i + 0.5) / 32 * (box.x1 - box.x0), box.y0 + (j + 0.5) / 32 * (box.y1 - box.y0)));
      const v = S.height === 're' ? Math.abs(w.re) : S.height === 'im' ? Math.abs(w.im) : CX.abs(w);
      if (Number.isFinite(v)) vals.push(v);
    }
    vals.sort((x, y) => x - y);
    const mu = vals.length ? Math.max(1e-6, vals[Math.floor(vals.length / 2)]) : 1;
    if (cardMu.size > 64) cardMu.clear();
    cardMu.set(key, mu);
    return mu;
  }
  function shapeOutlines(map0) {
    const out = [];
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const map = shapeMap(s, map0);   // ([#253] a later plane's shape: not in this one)
      if (!map) continue;
      const r = shapeGPU(s);
      if (r.lineRes) out.push({ r, res: r.lineRes, color: GLR.hexRGB(shapeInk(s).edge), map, cacheKey: `${r.lineKey}|${mapKeyOf(map)}` });
    }
    return out;
  }
  function cardPhase(pane, k) {
    pane.setView(cardZView(pane));
    pane.begin(TH.plane);
    GLR.begin(pane.pw, pane.ph);
    GLR.drawColorPlot({ map: stageMap(k), view: pane.view, dpr: pane.dpr, style: S.dc === 'cauchy' ? 'enhanced' : S.dc, sectors: S.sectors || 12, grid: dcGridStep(pane), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: null });
    if (S.outline) {
      const map = stageMap(0);
      for (const o of shapeOutlines(map)) {
        const dash = o.r.open ? { dash: [5, 3.5], arc: arcOf(o.r, stageF(0), mapKeyOf(o.map)) } : null;
        GLR.drawLines(o.res, Object.assign({ map, view: pane.view, dpr: pane.dpr, M: 8, width: 1 * pane.dpr, color: GLR.hexRGB(TH.dcCasing), alpha: 0.9, casing: { color: [1, 1, 1], alpha: 0.95, width: 2.4 * pane.dpr }, cacheKey: o.cacheKey }, dash));
      }
    }
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
  }
  // (issue #72) the programs a card's Landscape links: its heights, surface and floor (the user's function each) and the
  // normals' pass
  const LAND_CARD = ['landTF', 'land', 'floor', 'landNrm'];
  function cardLand(pane, k) {
    pane.begin(TH.plane);
    backdrop(pane);
    const box = cardLandBox(), lscale = S.lscale || 1;
    const geo = GLR.landGeom(box, lscale);
    const zoom = CAM3.dist > 0 ? cam.dist / CAM3.dist : 1;
    // (the main camera's angles and zoom; closer than the bounding-sphere fit, so the block fills the small card)
    const view = { yaw: cam.yaw, pitch: cam.pitch, dist: GLR.fitDist(geo.radius, CAM3.fov, pane.w, pane.h, 1.05) * zoom * 0.58, tx: cam.tx, ty: cam.ty, tz: geo.center[2], fov: CAM3.fov };
    GLR.begin(pane.pw, pane.ph);
    GLR.drawLandscape({
      map: stageMap(k), box, cam: view, heightMode: S.height, scale: lscale, mu: cardMedian(k, box), material: landMaterial(), unitLevel: !!S.unitLevel, sectors: S.sectors || 12,
      cells: 64, sheets: null, card: true, outlines: shapeOutlines(stageMap(0)), probe: null, bg: GLR.hexRGB(TH.landBottom), dpr: pane.dpr,
      colors: {
        floor: GLR.hexRGB(TH.landFloor), box: GLR.hexRGB(TH.landBox), modLine: GLR.hexRGB(TH.landMod), argLine: GLR.hexRGB(TH.landArg), plaster: GLR.hexRGB(TH.plaster),
        shadow: GLR.hexRGB(TH.landShadow), shadowA: TH.landShadowA, hemiSky: GLR.hexRGB(TH.hemiSky), hemiGround: GLR.hexRGB(TH.hemiGround), accent: GLR.hexRGB(TH.accent),
        minor: GLR.hexRGB(TH.gridMinor), medium: GLR.hexRGB(TH.gridMedium), major: GLR.hexRGB(TH.gridMajor), landBottom: GLR.hexRGB(TH.landBottom),
        cut: GLR.hexRGB(TH.cut), probe: GLR.hexRGB(TH.probe),
      },
    });
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
  }
  // the deformation: step k at its own t over its grey start (the image of the shapes at stage k − 1)
  function cardDef(pane, k, t) {
    // (all at once, review math-1: card k is the deformation itself up to step k, h_{k,t} ∘ … ∘ h_{1,t}, over
    // h_{k−1,t} ∘ … ∘ h_{1,t}; so the last card is the main picture at every t)
    // (v16: with a bracket, all at once runs from its start, stage a − 1; a card outside it shows its stage in full)
    const R = morphRange(), out = S.focus === 0 && !!R.r && (k < R.r.a || k > R.r.b), lo0 = S.focus === 0 && R.r ? R.lo : 0;
    const all = allAtOnce() && !out;
    const map = out ? stageMap(k) : all ? { mode: 3, a: lo0, b: k, t } : stepActive(k) ? { mode: 1, hi: k, t } : stageMap(k);
    const Ft = out ? stageF(k) : all ? cpuMap(map) : stepActive(k) ? ((Ht, Fp) => (z) => Ht(Fp(z)))(homF(k, t), stageF(k - 1)) : stageF(k);
    fitPane(pane, k, [], Ft);   // (framed on the image at this t, as X → Y frames the image)
    pane.begin(TH.plane);
    if (!GLR.ok || !GLR.drawGrid) Axes.draw(pane, Object.assign({}, TH, { label: 'rgba(0,0,0,0)' }), { unitCircle: false, labels: false });
    const ghost = () => {
      const mm = all ? (k - 1 > lo0 ? { mode: 3, a: lo0, b: k - 1, t } : stageMap(lo0)) : stageMap(k - 1);
      const Fg = all ? cpuMap(mm) : stageF(k - 1);
      for (const o of shapeOutlines(mm)) GLR.drawLines(o.res, { map: mm, view: pane.view, dpr: pane.dpr, M: 8, width: 1 * pane.dpr, color: GLR.hexRGB(TH.faint), alpha: 0.8, cacheKey: o.cacheKey, dash: [4, 3], arc: arcOf(o.r, Fg, mapKeyOf(mm)) });
    };
    drawScene(pane, map, null, { thin: true, L: 2, under: ghost });
    drawPoints(pane, Ft, { thin: true });
  }
  function renderThumb(k) {
    const pane = thumbs.get(k);
    if (!pane || !pane.canvas.isConnected) return;
    pane.resize(...thumbDims(pane.canvas));
    const card = pane.canvas.closest('.card');
    const kind = k === 0 ? 'xy' : cardKind();
    // (issue #72) without parallel compile every link is synchronous, seconds each on software GL (a pan over "Sheets of
    // the logarithm" froze for a minute while the cards linked the principal branch beside the pane's All sheets), so a
    // Landscape card never starts one: it shows its Phase picture until the pane has linked those programs. The pane's
    // Landscape redraws the cards (frame), and the sig then asks for the relief
    const landStand = kind === 'land' && GLR.ok && GLR.parallelCompile === false && !GLR.linked(LAND_CARD, stageMap(k));
    const t = kind === 'def' ? cardT(k) : 0;
    // what the picture depends on, per kind (the view, the camera, the time, the selection that shows step k + 1's cuts)
    const vk = kind === 'phase' || landStand ? `${S.srcView.cx},${S.srcView.cy},${S.srcView.s}|${paneL.w}x${paneL.h}|${S.dc}|${S.sectors || 12}|${S.dcGrid}|${S.outline}`
      : kind === 'land' ? `${S.srcView.cx},${S.srcView.cy},${S.srcView.s}|${paneL.w}x${paneL.h}|${cam.yaw.toFixed(4)},${cam.pitch.toFixed(4)},${(cam.dist / CAM3.dist).toFixed(4)},${cam.tx},${cam.ty}|${S.height}|${S.lscale || 1}|${landMaterial()}|${S.dc}|${S.unitLevel}`
      : kind === 'def' ? `t${t.toFixed(4)}|${S.homAll}` : `${selOf() === k + 1 ? 'cuts' : ''}`;
    // (with exact images: whether the inverse program is ready, so a thumbnail drawn forward before it was is redrawn)
    const sig = `${kind}|${k}|${chainSig[k]}|${thumbShapesSig}|${GLR.palette()}|${S.pattern}|${S.patternScale}|${S.alpha}|${S.lines}|${TH.plane}|${TH.dark}|${pane.pw}x${pane.ph}|${vk}|${S.exactImages !== false && GLR.ok && GLR.inverseStatus ? GLR.inverseStatus(S.alpha, 'flat') === 'ready' : ''}`;
    if (card) { const tl = card.querySelector('.tlab'); if (tl) { const tt = kind === 'def' ? `t = ${I18N.num(t.toFixed(2))}` : ''; if (tl.textContent !== tt) tl.textContent = tt; } }
    if (pane.sig === sig) { if (card) card.classList.remove('stale'); return; }
    const hit = thumbCache.get(sig);
    if (hit) {
      thumbCache.delete(sig); thumbCache.set(sig, hit);   // (least recently used last)
      pane.ctx.setTransform(1, 0, 0, 1, 0, 0);
      pane.ctx.drawImage(hit, 0, 0);
      pane.sig = sig;
      if (card) card.classList.remove('stale');
      return;
    }
    thumbNotFinal = false;
    let waiting = false;
    if (kind === 'phase' || kind === 'land') {
      if (!GLR.ok) { pane.begin(TH.plane); return; }
      if (kind === 'phase' || landStand) cardPhase(pane, k); else cardLand(pane, k);
      const glst = GLR.frameStatus ? GLR.frameStatus() : null;
      waiting = !!(glst && glst.pending);
    } else if (kind === 'def') {
      if (GLR.ok) cardDef(pane, k, t); else pane.begin(TH.plane);
      const glst = GLR.frameStatus ? GLR.frameStatus() : null;
      waiting = !!(glst && glst.pending);
    } else {
      fitPane(pane, k, [], undefined, fitMs > FIT_LIVE_MS);
      pane.begin(TH.plane);
      if (!GLR.ok || !GLR.drawGrid) Axes.draw(pane, Object.assign({}, TH, { label: 'rgba(0,0,0,0)' }), { unitCircle: false, labels: false });
      // ([#253] the scene's pending is read before the preimage passes begin their own frame, and both count: a card
      // whose picture or preimages are still linking is drawn with a stand-in, never cached as final)
      let prePending = false;
      if (GLR.ok) drawScene(pane, stageMap(k), null, { thin: true, L: 2 });
      const glst = GLR.frameStatus ? GLR.frameStatus() : null;
      if (GLR.ok) prePending = stagePullbacks(pane, k);
      waiting = !!(glst && glst.pending) || prePending;
      drawPoints(pane, stageF(k), { thin: true, k });
      // (step k + 1's cuts show on card k only while step k + 1 is selected: a card never shows a later step's marks)
      if (selOf() === k + 1) drawCuts(pane, k, false, true);
      if (!S.shapes.some((x) => x.visible !== false)) {
        // above the real axis (the empty view is centered on 0) and cased in the plane color, so nothing strikes it
        const ctx = pane.ctx;
        ctx.font = `12px ${TH.ui}`; ctx.fillStyle = TH.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        // (only where it fits: a phone's 44 px picture showed it cut, 'lo shape', and a strip 28 px high would cut it at the top; the axes alone say it)
        if (pane.h >= 40 && ctx.measureText($t('No shapes')).width <= pane.w - 8) haloText(ctx, $t('No shapes'), pane.w / 2, pane.h / 2 - 7, TH.plane);
      }
    }
    if (waiting || thumbNotFinal) { thumbNotFinal = false; return; } // drawn with a stand-in: not final, not cached
    pane.sig = sig;
    if (card) card.classList.remove('stale');
    if (window.createImageBitmap) {
      createImageBitmap(pane.canvas).then((bm) => {
        thumbCache.set(sig, bm);
        if (thumbCache.size > 64) { const old = thumbCache.keys().next().value; const b = thumbCache.get(old); thumbCache.delete(old); if (b && b.close) b.close(); }
      }).catch(() => {});
    }
  }
  // (issue #49) while the morph plays renderThumbs waits (it is put off past every frame), so a card with no picture
  // of its own yet, a fresh Landscape's, stayed empty until the pause; such a card draws now, one pass at most every
  // 200 ms and only while nothing else moves (outside Deformation, the cards' pictures do not change with t)
  let missT = -1e9;
  function missingCards() {
    const now = performance.now();
    if (now - missT < 200 || drag || tweens.length || camTweens.length || now - lastInputT < 150 || cardKind() === 'def') return;
    const want = [...thumbs.entries()].filter(([, p]) => !p.sig && p.canvas.isConnected);
    if (!want.length) return;
    missT = now;
    thumbShapesSig = S.shapes.map((x) => shapeKey(x) + (x.visible === false ? 'h' : '') + (x.ci ?? '') + (x.color || '')).join('|');
    for (const [, p] of want) thumbDims(p.canvas);   // (all reads before any canvas resize)
    for (const [k] of want) { try { renderThumb(k); } catch (e) { console.error(e); } }
  }
  // (#326) the cards are drawn in idle slices, not in one task: the first frames belong to the planes. renderThumbs starts a
  // job (the quiet-moment wait as before, the sizes read before any canvas is resized), the card nearest the selected step
  // first; each slice draws cards until its budget is spent and yields (requestIdleCallback, or a short timer). A new
  // request for the cards (a change of the chain, the shapes or the view: dirty.T, requestRender('T')) or an input drops
  // the pending slices (thumbJob.token), and the job starts again at its quiet moment: a card already drawn for the
  // current signature costs nothing. now: draw them all at once (__cmwCardsNow, the tests)
  const thumbJob = { token: 0, order: /** @type {number[]} */ ([]), left: 0 };
  const THUMB_SLICE_MS = 12;
  const thumbIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 120 }) : setTimeout(fn, 16));
  function thumbQuiet() {
    return !(drag || tweens.length || camTweens.length || (morph.playing && morph.open) || performance.now() - lastInputT < 150);
  }
  function renderThumbs(now) {
    // wait for a quiet moment: never during drags, pans or a playing morph
    if (!thumbQuiet()) {
      // (a card held for its exact redraw shows a thin bar: a drag that changes what the cards show, or playback)
      if ((drag && (!/^(pan[LR]|probe|panR|orbit|pan3)$/.test(drag.mode) || ((cardKind() === 'phase' || cardKind() === 'land') && drag.side !== 'R'))) || (morph.playing && morph.open && cardKind() === 'def')) for (const c of document.querySelectorAll('#pipeline .card:not(.stale)')) c.classList.add('stale');
      thumbJob.token++;
      clearTimeout(thumbT);
      thumbT = setTimeout(renderThumbs, 160);
      return;
    }
    for (const cv of thumbSeen) if (!cv.isConnected) { thumbRO.unobserve(cv); thumbSeen.delete(cv); } // cards rebuilt
    const sel = selOf(), ks = [...thumbs.keys()].sort((a, b) => Math.abs(a - sel) - Math.abs(b - sel) || a - b);
    const token = ++thumbJob.token;
    thumbJob.order = ks.slice(); thumbJob.left = ks.length;   // (the test hook's: __cmwThumbJob)
    thumbSlice(token, ks, now === true);
  }
  function thumbSlice(token, ks, now) {
    if (token !== thumbJob.token) return;   // (a newer request or an input took the job over)
    if (!now && !thumbQuiet()) { thumbJob.token++; clearTimeout(thumbT); thumbT = setTimeout(renderThumbs, 160); return; }
    thumbShapesSig = S.shapes.map((x) => shapeKey(x) + (x.visible === false ? 'h' : '') + (x.ci ?? '') + (x.color || '')).join('|');
    for (const p of thumbs.values()) if (p.canvas.isConnected) thumbDims(p.canvas); // all reads before any canvas resize
    const t0 = performance.now();
    while (ks.length) {
      const k = ks.shift();
      try { renderThumb(k); } catch (e) { console.error(e); }
      thumbJob.left = ks.length;
      if (!now && ks.length && performance.now() - t0 >= THUMB_SLICE_MS) { thumbIdle(() => thumbSlice(token, ks, false)); return; }
    }
  }

  // ---------------- render scheduling ----------------
  const dirty = { L: false, R: false, OL: false, OR: false, T: false, P: false, G: false }; // G: the legend chip
  let rafId = 0;
  function requestRender(...which) {
    for (const w of which.length ? which : ['L', 'R']) if (w) { dirty[w] = true; if (w === 'T') thumbJob.token++; }
    if (!rafId) { rafId = requestAnimationFrame(frame); rafReqT = performance.now(); }
  }
  let thumbT = 0, lastInputT = 0, motionInT = 0;
  // motionInT: the last CONTINUOUS input (a wheel, a pointer moved with a button down, a range slider's input, a held
  // key); a hover or a single click is not motion (interacting(): a ready inverse program is not held back for it)
  for (const ev of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'input']) window.addEventListener(ev, (e) => {
    const t = performance.now();
    lastInputT = t;
    if (ev === 'wheel' || (ev === 'pointermove' && e.buttons) || (ev === 'input' && e.target && e.target.type === 'range') || (ev === 'keydown' && e.repeat)) motionInT = t;
  }, { passive: true, capture: true });
  // ---------------- the start-up bar (issue #245) ----------------
  // A thin bar at the top of the page while the programs of the first frames and of the background warm-up (WARM, in
  // the init part) are still linking: counted from the GPU layer's own program lists (GLR.warmStatus), never from
  // timers. It shows only when work is still pending 300 ms after it began (GLR.warmBarStep), so a warm program cache
  // shows nothing, and it never takes input. warmDriver: set by the init part, {finished(), phase()}.
  let warmDriver = null, warmS = null, warmBarT = 0, warmLast = '';
  function warmCounts() {
    const st = GLR.warmStatus(S.homAll ? [3] : [1]);
    // (every warm-up group started and nothing compiling: a program that is still not linked never will be, e.g. one
    // the chain cannot have; the bar must not wait for it)
    const fin = !!(warmDriver && warmDriver.finished()) && !st.pending;
    if (fin) st.done = st.total;
    // (the total is unknown while the chain's programs are not listed yet and something is compiling: the sweep, not a number)
    st.unknown = !st.known && st.pending > 0;
    st.phase = !st.known ? 'first' : warmDriver ? warmDriver.phase() : 'first';
    return st;
  }
  function warmUpdate() {
    warmBarT = 0;
    const el = $('warmBar');
    if (!el || !GLR.ok || !GLR.warmStatus) return;
    const st = warmCounts();
    warmS = GLR.warmBarStep(warmS, st, performance.now());
    const pct = Math.round(warmS.frac * 100);
    const sig = `${warmS.visible}|${warmS.indet}|${pct}|${st.done}|${st.total}|${I18N.lang}`;
    if (sig !== warmLast) {
      warmLast = sig;
      el.hidden = !warmS.visible;
      el.classList.toggle('indet', warmS.indet);
      el.style.setProperty('--warm', warmS.frac.toFixed(3));
      el.setAttribute('aria-label', $t('Preparing the page'));
      if (warmS.indet) { el.removeAttribute('aria-valuenow'); el.removeAttribute('aria-valuetext'); }
      else { el.setAttribute('aria-valuenow', String(pct)); el.setAttribute('aria-valuetext', $t('Preparing {done} of {total} shaders, first time only', { done: st.done, total: st.total })); }
    }
    // (it ticks while there is work or the bar is up; a frame that waits for a program, or a program that lands, starts it again)
    if (warmS.visible || st.total > st.done || st.unknown) warmBarT = setTimeout(warmUpdate, 150);
  }
  function warmKick() { if (!warmBarT) warmBarT = setTimeout(warmUpdate, 0); }
  // TEMP-DEBUG-HOOK (removed before publishing)
  // test hook: the counts, the phase, whether the bar shows and how far it is
  /** @type {any} */ (window).__cmwWarm = () => {
    if (!GLR.ok || !GLR.warmStatus) return { done: 0, total: 0, pending: 0, visible: false, phase: 'none', frac: 0 };
    const st = warmCounts();
    return { done: st.done, total: st.total, pending: st.pending, visible: !!(warmS && warmS.visible), phase: st.phase, frac: warmS ? warmS.frac : 0, indet: !!(warmS && warmS.indet), groups: st.groups };
  };
  // TEMP-DEBUG-HOOK
  // cameras: 28° telephoto. dist is the fit distance for the bounding sphere at the pane's aspect; render3D and
  // renderSphere refit it every frame (refitCam), so zoom limits (0.4–4 × dist) and resets stay relative to the fit.
  const CAM3 = { yaw: -38 * DEG, pitch: 30 * DEG, dist: 1.77 / Math.sin(14 * DEG) * 1.05, tx: 0, ty: 0, tz: -0.04, fov: 28 * DEG };
  const CAMS = { yaw: -60 * DEG, pitch: 18 * DEG, dist: 1.16 / Math.sin(14 * DEG) * 1.05, tx: 0, ty: 0, tz: 0, fov: 28 * DEG };
  const cam = Object.assign({ vyaw: 0, vpitch: 0 }, CAM3);
  const camS = Object.assign({ vyaw: 0, vpitch: 0 }, CAMS);
  // the pane a camera orbits in (U-b): the landscape (cam) and the z-globe (camL) in X, the w-globe (camS) in Y
  const camSide = (c) => (c === camS ? 'R' : 'L');
  const camTweens = [];
  // a new fit distance (pane resized, box aspect or height scale changed) rescales the user's zoom with it
  // v16.5 UX106: the Landscape camera's fitted distance. The block's bounding sphere fits the pane's narrower side; on a
  // portrait phone that left the surface a small picture in the middle (about 230 × 330 px of a 412 × 680 plane). There
  // the block's own corners, as the default camera sees them, are fitted to the width and to the height, never farther
  // than the sphere's fit. Every other pane keeps the sphere's fit, and every picture it drew.
  function landFitDist(geo, pane) {
    const sph = GLR.fitDist(geo.radius, CAM3.fov, pane.w, pane.h, 1.05);
    if (!(Phone.isOn && Phone.isOn()) || !(pane.w > 0 && pane.h > pane.w * 1.05)) return sph;
    const y = CAM3.yaw, p = CAM3.pitch;
    const u = [Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p)];   // from the target to the eye
    const rl = Math.hypot(u[0], u[1]) || 1, r = [-u[1] / rl, u[0] / rl, 0];        // the screen's right (f × z, f = -u)
    const up = [-r[1] * u[2], r[0] * u[2], r[1] * u[0] - r[0] * u[1]];               // the screen's up (r × f)
    const tv = Math.tan(CAM3.fov / 2), th = tv * pane.w / pane.h, m = 1.02;          // (the plate holds the labels)
    let d = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const z of [geo.floorZ, geo.H]) {
      const q = [sx * geo.ext[0], sy * geo.ext[1], z - geo.center[2]];
      const dot = (a) => a[0] * q[0] + a[1] * q[1] + a[2] * q[2];
      d = Math.max(d, dot(u) + Math.abs(dot(r)) * m / th, dot(u) + Math.abs(dot(up)) * m / tv);
    }
    return d > 0 && isFinite(d) ? Math.min(sph, d) : sph;
  }
  function refitCam(c, base, fit) {
    if (!(fit > 0 && fit < 1e6) || Math.abs(fit - base.dist) <= 1e-9 * fit) return;   // (a collapsed pane gives no fit)
    const k = fit / base.dist;
    c.dist *= k;
    for (const tw of camTweens) if (tw.c === c) { tw.from.dist *= k; tw.to.dist *= k; }
    base.dist = fit;
  }
  function tweenCam(c, target) {
    for (let i = camTweens.length - 1; i >= 0; i--) if (camTweens[i].c === c) camTweens.splice(i, 1);
    const to = Object.assign({}, { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx, ty: c.ty }, target);
    c.vyaw = c.vpitch = 0;
    const side = camSide(c);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(c, to); requestRender(side); return; }
    // take the short way round in yaw
    let dy = (to.yaw - c.yaw) % TAU; if (dy > Math.PI) dy -= TAU; if (dy < -Math.PI) dy += TAU;
    camTweens.push({ c, from: { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx, ty: c.ty }, to: Object.assign(to, { yaw: c.yaw + dy }), t0: performance.now(), ms: 400 });
    requestRender(side);
  }
  function frame(ts) {
    rafId = 0;
    let again = false;
    liveMsUsed = 0;
    const frameT0 = performance.now();
    frameStartT = frameT0;
    // (the time from the request to this callback: the rAF timestamp is the frame's begin time, which can precede the
    // request)
    frameLag = Math.max(0, performance.now() - rafReqT);
    prepMs = 0;
    if (morph.playing && morph.open) {
      const dt = morph.last ? Math.min(0.1, (ts - morph.last) / 1000) : 0;
      morph.last = ts;
      const m = morphLen();
      // per step: eased motion, a short hold at each step boundary, a longer one at the end
      if (!m) { morph.playing = false; setPlayIcon(); }
      else if (morph.hold > 0) morph.hold -= dt;
      else {
        // the current step is tracked explicitly; deriving it from floor(T) skipped a step when easing rounded T up to an integer
        if (morph.seg == null) { morph.seg = Math.max(0, Math.min(m - 1, Math.floor(morph.T))); morph.u = Math.max(0, Math.min(0.999, morph.T - morph.seg)); }
        const before = morph.seg;
        morph.u = (morph.u || 0) + dt / (S.morphSecs || 1.6);
        if (morph.u >= 1) { morph.u = 0; morph.T = Math.min(m, before + 1); morph.seg = morph.T >= m ? null : before + 1; morph.hold = morph.T >= m ? 1.0 : 0.5; if (morph.T >= m) sndMorphArrive(); }
        else { const u = morph.u; morph.T = Math.min(before + 0.9999, before + (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)); }
      }
      if (m && morph.hold <= 0 && morph.T >= m) {
        if (S.loop === false || matchMedia('(prefers-reduced-motion: reduce)').matches) { morph.playing = false; morph.seg = null; setPlayIcon(); scheduleFix(); } else { morph.T = 0; morph.u = 0; morph.seg = 0; }
      }
      dirty.R = true;
      // X's portrait, landscape or phase globe paint H_t too
      if (lPaintsF()) dirty.L = true;
      // (review v16 sound-picture-2: the readout and the scrubber follow T here, every frame and when Play stops at the
      // end; renderRight's call does not run while Y's pane is hidden, as in Phase alone)
      syncTransport();
      again = morph.playing;
      soundFunctionChanged('t');
      sndMotion();   // (sound: the motion bed on a play's first pass)
      // the cards are held while it plays (renderThumbs is debounced past every frame), so their t is not the main
      // t: they show no t until they are redrawn after the pause (review verify-1, design-13)
      if (morph.playing && cardKind() === 'def') for (const c of document.querySelectorAll('#pipeline .card:not(.stale)')) c.classList.add('stale');
    }
    // (#246) the step glide moves T while it owns it: T is still what it wrote last. Play, the scrubber, a tick, a new
    // range or focus that moved T take it back, and the glide rests where T is
    if (glide.moving()) {
      if (!morph.open || morph.playing || morph.T !== glide.x) glide.set(morph.T);
      else {
        // (a step removed or turned off while it glides: the target stays inside the chain as it is now)
        if (glide.target > morphLen()) glide.to(morphLen(), morphLen());
        const dt = glide.last ? (ts - glide.last) / 1000 : 1 / 60;
        glide.last = ts;
        const still = !glide.step(dt);
        morph.T = glide.x;
        dirty.R = true;
        if (lPaintsF()) dirty.L = true;
        syncTransport();
        soundFunctionChanged('t');
        if (still) { glide.last = 0; scheduleFix(); } else again = true;
        if (cardKind() === 'def') for (const c of document.querySelectorAll('#pipeline .card:not(.stale)')) c.classList.add('stale');
      }
    }
    // camera tweens and inertia in 3D views
    for (let i = camTweens.length - 1; i >= 0; i--) {
      const tw = camTweens[i];
      const u = Math.min(1, (performance.now() - tw.t0) / tw.ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      for (const k of ['yaw', 'pitch', 'dist', 'tx', 'ty']) tw.c[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (u >= 1) camTweens.splice(i, 1);
      dirty[camSide(tw.c)] = true;
      again = true;
    }
    // (the landscape and the z-globe orbit in X, the w-globe in Y)
    const c3 = rGlobe() ? camS : null;
    const cL = lLand() ? cam : lGlobe() ? leftCam() : null;
    for (const [cc, side] of [[c3, 'R'], [cL, 'L']]) {
      if (!cc || drag || !(Math.abs(cc.vyaw) > 1e-4 || Math.abs(cc.vpitch) > 1e-4)) continue;
      cc.yaw += cc.vyaw;
      cc.pitch = Math.max(pitchMin(cc), Math.min(88 * DEG, cc.pitch + cc.vpitch));
      cc.vyaw *= 0.9; cc.vpitch *= 0.9;
      // (the turn has died away: one rest frame once nothing else moves, camSpin)
      if (!(Math.abs(cc.vyaw) > 1e-4 || Math.abs(cc.vpitch) > 1e-4)) { cc.vyaw = cc.vpitch = 0; setTimeout(() => { if (!interacting()) requestRender(side); }, 170); }
      dirty[side] = true;
      again = true;
    }
    if (tweens.length) { stepTweens(ts); again = true; }
    if (trans.k) {
      if (performance.now() - trans.t0 >= trans.dur || !stepActive(trans.k)) { trans.k = 0; scheduleFix(); if (rightAuto && rImage()) fitRight(true); }
      dirty.R = true; again = true;
    }
    // overlays and marker rulers once per frame, after whichever planes were redrawn
    const ov = dirty.L || dirty.R || dirty.OL || dirty.OR;
    const leg = dirty.G || dirty.R; // the legend repaints only when its key or the needle changed
    dirty.G = false;
    // (v15: the cards follow X's z-window and camera in Phase and Landscape, and the time in the deformation)
    if ((dirty.L && (S.view.main === 'phase' || S.view.main === 'land')) || (dirty.R && morph.open && S.view.main === 'xy')) dirty.T = true;
    if (dirty.L) { dirty.L = false; if (solo() !== 'R') try { renderLeft(); } catch (e) { console.error(e); } }
    if (dirty.R) { dirty.R = false; if (solo() !== 'L') try { renderRight(); } catch (e) { console.error(e); } }
    dirty.OL = dirty.OR = false;
    if (invPaneQ.drew.L && invPaneQ.drew.R) for (const k of ['L', 'R']) if (invPaneQ[k]) invPaneQ[k].share = 0.5;
    invPaneQ.L = invPaneQ.R = null; invPaneQ.drew.L = invPaneQ.drew.R = false;
    if (ov) try { renderOverlays(); } catch (e) { console.error(e); }
    sndFrame();   // (sound: a re-pick under a still pointer waits for a frame drawn at the new layout)
    if (leg) try { drawLegend(); } catch (e) { console.error(e); }
    idleReadouts();
    if (dirty.T) {
      dirty.T = false;
      thumbJob.token++;
      clearTimeout(thumbT);
      thumbT = setTimeout(renderThumbs, 150);
      if (morph.playing && morph.open) missingCards();
    }
    if (dirty.P) { dirty.P = false; renderProps(); }
    // a shape drag whose frames run over the 60 fps budget twice takes the drag-time mesh cap (baseRes)
    if (drag && (drag.mode === 'handle' || drag.mode === 'move') && !drag.capMesh && performance.now() - frameT0 + frameLag > FRAME_BUDGET_MS + 2) {
      if ((drag.slow = (drag.slow || 0) + 1) >= 2) { drag.capMesh = true; dirty.L = dirty.R = true; again = true; }
    }
    // (a requestRender during this frame may already have asked for the next one: never two frame chains at once)
    if (again && !rafId) { rafId = requestAnimationFrame(frame); rafReqT = performance.now(); }
  }
  // a newly added step plays its own homotopy once, so the change is seen as a deformation
  const trans = { k: 0, t0: 0, dur: 480 };
  function startTransition(k) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !rImage() || morphOn() || rightStage() !== k || !stepActive(k)) return;
    trans.k = k; trans.t0 = performance.now();
    // frame both the start and the end of the deformation, then settle on the result
    paneR.setView(V.right);
    if (rightAuto) Object.assign(V.right, fittedView(paneR, k, [k - 1]));
    requestRender('R');
  }
  function transState() {
    const u = Math.min(1, (performance.now() - trans.t0) / trans.dur);
    const t = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const k = trans.k, Fprev = stageF(k - 1);
    // a new d/dz step slides from G_{k−1} to G_k along the straight line
    if (isDeriv(k)) return { map: { mode: 1, hi: k, t }, F: lerpF(Fprev, stageF(k), t), u };
    const Ht = homF(k, t);
    return { map: { mode: 1, hi: k, t }, F: (z) => Ht(Fprev(z)), u };
  }
  // smooth view transitions
  const tweens = [];
  function tweenView(view, target, ms = 260, onDone) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].view === view) tweens.splice(i, 1);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(view, target); if (onDone) onDone(); requestRender('L', 'R'); return; }
    tweens.push({ view, from: { cx: view.cx, cy: view.cy, s: view.s }, to: target, t0: performance.now(), ms, onDone });
    requestRender();
  }
  // a view switch lands the plane tweens of X's view at once (they would move the next view's plane otherwise)
  function cancelTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.view !== S.srcView && tw.view !== V.left) continue;
      Object.assign(tw.view, tw.to); tweens.splice(i, 1); if (tw.onDone) tw.onDone();
    }
  }
  function stepTweens(ts) {
    const now = performance.now();
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const u = Math.min(1, (now - tw.t0) / tw.ms);
      const e = 1 - Math.pow(1 - u, 3);
      const ls = Math.log(tw.from.s) + (Math.log(tw.to.s) - Math.log(tw.from.s)) * e;
      tw.view.s = Math.exp(ls);
      tw.view.cx = tw.from.cx + (tw.to.cx - tw.from.cx) * e;
      tw.view.cy = tw.from.cy + (tw.to.cy - tw.from.cy) * e;
      if (u >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
    }
    dirty.L = true; dirty.R = true;
  }
  // compute a fitted view for a pane without applying it
  function fittedView(pane, k, extraKs, F) {
    const saved = pane.view;
    const tmp = { cx: saved.cx, cy: saved.cy, s: saved.s };
    pane.setView(tmp);
    fitPane(pane, k, extraKs, F);
    pane.setView(saved);
    return tmp;
  }

  // change notifications
  let lastLeftSig = '';
  // a change that follows another within 150 ms, or comes from a drag, is part of a scrub: MathJax waits for a pause
  let lastChangeT = 0, scrubT = 0;
  function noteChange() {
    const now = performance.now();
    if (drag || now - lastChangeT < 150) { TeX.hush(); scrubT = now; }
    lastChangeT = now;
  }
  // ([#243, #241] what the last chain change cost, ms, all of it and the fit of the views in it (a series' fit samples
  // it on the CPU): a live change (a slider dragged) of a chain whose fit costs more than FIT_LIVE_MS keeps the views
  // until the drag ends, whose change at rest fits them; a field and a slider of a costly chain wait for a pause or the
  // next frame (paramField, onParamChange))
  let chainMs = 0, fitMs = 0, fitLate = 0;
  const FIT_LIVE_MS = 12;
  const chainCost = () => chainMs + fitLate;   // (with the fit in slices after it)
  function chainChanged(structural, o) {
    const t0 = performance.now();
    noteChange();
    rebuild();
    cmChain();   // (v16: step uids, zero ids, constructions on f1's zeros and F(z0))
    soundFunctionChanged();
    if (structural) buildPipeline(); else updateCards();
    const fit = !(o && o.live && fitMs > FIT_LIVE_MS), sliced = fitMs > FIT_LIVE_MS && !morphOn() && !hasTargets(), tf = performance.now();
    if (fit && rightAuto && autoFit()) { if (sliced) fitRightSliced(); else fitRight(); }
    const ls = leftStage() + ':' + chainSig[leftStage()];
    if (fit && leftStage() > 0 && leftAuto && ls !== lastLeftSig) { paneL.setView(V.left); fitPane(paneL, leftStage()); }
    if (fit) lastLeftSig = ls;
    if (fit && !sliced) { fitMs = performance.now() - tf; fitLate = 0; }
    if (morph.open && !morphRange().steps.length) closeTransport();
    scheduleFix();
    updateLeds();
    refreshIntPop();
    if (Params.syncUnused) Params.syncUnused();   // ([v16.5 fix user-1] "Not used yet" follows the chain)
    requestRender('L', 'R', 'T', 'P');
    chainMs = performance.now() - t0;
  }
  function shapesChangedAll(structural) { shapesChanged(structural); }
  function shapesChanged(structural) {
    if (cmShapes()) structural = true;   // (v16 constructions)
    if (numberPoints()) structural = true;
    noteChange();
    if (structural) {
      updateFocusUI();
      buildShapeList();
      updateRegionCard();
    } else { updateShapeList(); updateRegionCard(); }
    // (v16 [C3a]: not while a pointer gesture moves shapes, points or zeros: onUp fits Y once at the gesture's end)
    if (rightAuto && autoFit() && !(!structural && drag && /^(move|handle|zp)$/.test(drag.mode))) fitRight();
    scheduleFix();
    refreshIntPop();
    requestRender('L', 'R', 'T');
  }
  // the right plane mode that keeps its own view, fitted to what it shows
  const autoFit = () => rImage();
  function boxView(pane, b) {
    const saved = pane.view, tmp = { cx: saved.cx, cy: saved.cy, s: saved.s };
    pane.setView(tmp);
    if (!pane.fitBox(b, 0.07)) pane.fitBox({ x0: -2, x1: 2, y0: -2, y1: 2 });
    pane.setView(saved);
    return tmp;
  }
  // the deformation's own frame at pane's size (fitRight; the globe's path selection frame)
  function defFitView(pane, withT) {
    let target;
      // the deformation: its start and its end. A start much larger than its end (an unbounded source, the
      // half-plane e^X of a strip at a focused Möbius step) is clipped to 1.5 times the end's box, so H_t(X) does not
      // shrink to a blob in a frame of the source (merged-views review); the Fit button also takes the current H_t
      // (withT)
      const base = S.focus > 0 ? S.focus - 1 : 0;
      const end = S.focus > 0 ? S.focus : nSteps();
      const m = morphLen();
      const xs = [], ys = [], bx = [], by = [];
      stageSamples(stageF(end), xs, ys, end);
      if (withT && morph.T > 0 && morph.T < m) stageSamples(morphAt(morph.T), xs, ys);
      stageSamples(homRangeOk() ? morphState(false).H0F : stageF(base), bx, by, homRangeOk() ? undefined : base);   // (v16: the bracket's start)
      const U = robustBox(xs, ys), B = robustBox(bx, by);
      const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
      if (U && B && area(B) > 9 * Math.max(area(U), 1e-12)) {
        const cx = (U.x0 + U.x1) / 2, cy = (U.y0 + U.y1) / 2, hw = 0.75 * (U.x1 - U.x0), hh = 0.75 * (U.y1 - U.y0);
        for (let i = 0; i < bx.length; i++) if (Math.abs(bx[i] - cx) <= hw && Math.abs(by[i] - cy) <= hh) { xs.push(bx[i]); ys.push(by[i]); }
        const b = robustBox(xs, ys) || U;
        const v = { cx: V.right.cx, cy: V.right.cy, s: V.right.s }, keep = pane.view;
        pane.setView(v); pane.fitBox(b, 0.07); pane.setView(keep);
        target = v;
      } else {
        for (let i = 0; i < bx.length; i++) { xs.push(bx[i]); ys.push(by[i]); }
        const b = robustBox(xs, ys);
        target = b ? (() => { const v = { cx: V.right.cx, cy: V.right.cy, s: V.right.s }, keep = pane.view; pane.setView(v); pane.fitBox(b, 0.07); pane.setView(keep); return v; })() : fittedView(pane, end, [base]);
      }
    return target;
  }
  // ([#243] a costly fit of Y (the last took over FIT_LIVE_MS: a series sampled on the CPU) after a chain change: its
  // samples are taken in slices of FIT_SLICE ms between which the page draws and takes input; Y keeps its view until
  // the fit is ready; a newer change or fit drops it)
  const fitJob = { token: 0 };
  const FIT_SLICE = 8;
  const yieldFit = () => (typeof scheduler !== 'undefined' && scheduler && typeof scheduler.yield === 'function' ? scheduler.yield() : yieldTask());
  async function fitRightSliced() {
    const token = ++fitJob.token, k = rightStage(), sig = chainSig[k];
    const xs = [], ys = [], it = stageSampler(stageF(k), xs, ys, k);
    let t0 = performance.now(), ms = 0;
    for (let r = it.next(); !r.done; r = it.next()) {
      if (performance.now() - t0 < FIT_SLICE) continue;
      ms += performance.now() - t0;
      await yieldFit();
      if (token !== fitJob.token) return;
      t0 = performance.now();
    }
    fitMs = fitLate = ms + performance.now() - t0;
    if (rightStage() !== k || chainSig[k] !== sig || !(rightAuto && autoFit()) || morphOn() || hasTargets()) return;
    paneR.setView(V.right);
    Object.assign(V.right, boxView(paneR, robustBox(xs, ys) || { x0: -2, x1: 2, y0: -2, y1: 2 }));
    requestRender('R', 'T');
  }
  function fitRight(animate, withT) {
    fitJob.token++;
    paneR.setView(V.right);
    let target;
    if (morphOn()) target = defFitView(paneR, withT);
    else if (hasTargets()) {
      // the image of the domain and the w-plane targets
      const xs = [], ys = [];
      stageSamples(stageF(rightStage()), xs, ys, rightStage());
      for (const s of S.targets) {
        if (s.visible === false) continue;
        let b = null;
        try { b = Region.bboxOf(s); } catch (e) { b = null; }
        if (b) { xs.push(b.x0, b.x1); ys.push(b.y0, b.y1); }
        try { for (const [, z] of Region.handlesOf(s)) { xs.push(z.re); ys.push(z.im); } } catch (e) { /* no handles */ }
      }
      target = boxView(paneR, robustBox(xs, ys) || { x0: -2, x1: 2, y0: -2, y1: 2 });
    } else target = fittedView(paneR, rightStage());
    // a refit that would move the view by a few pixels at most (the fit after a drag, from the same shape data) is
    // skipped: its tween frames would be motion frames for nothing (motion-vs-rest, the refit at pointer-up)
    if (animate && fitWithinPx(V.right, target, paneR, 3)) return;
    if (animate) tweenView(V.right, target);
    else Object.assign(V.right, target);
  }
  // whether view b differs from view a by at most px CSS pixels anywhere in the pane (centre shift plus the zoom's
  // move of the pane's corners)
  function fitWithinPx(a, b, pane, px) {
    if (!a || !b || !(a.s > 0) || !(b.s > 0)) return false;
    const half = Math.hypot(pane.w || 0, pane.h || 0) / 2;
    const shift = Math.hypot(b.cx - a.cx, b.cy - a.cy) * a.s;
    return shift + Math.abs(b.s / a.s - 1) * half <= px;
  }
  function setFocus(k, quiet) {
    phHold();
    setFocusStep(k);
    if (k > 0) setSel(k);   // (v15: showing a step alone selects it)
    leftAuto = true; rightAuto = true;
    // (Y's split view, put aside by the deformation, is fitted again for the new focus when the deformation closes)
    if (defMem.y) defMem.y.auto = true;
    if (leftStage() > 0) { paneL.setView(V.left); fitPane(paneL, leftStage()); lastLeftSig = leftStage() + ':' + chainSig[leftStage()]; }
    // the deformation starts over for the new focus (or closes when it has nothing to deform)
    morph.T = 0; morph.seg = null;
    if (morph.open && !morphRange().steps.length) closeTransport();
    updateFocusUI();
    // the target group's heading and formulas name Y's variable (wₖ with step k focused, P13)
    if (S.targets && S.targets.length) buildShapeList();
    fitRight();
    scheduleFix();
    refreshIntPop();
    requestRender('L', 'R', 'P');
    save();
    if (!quiet) tourEmit('step-focused', { k });
  }

