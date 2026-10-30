  // ---------------- the steps view (#366 prototype, behind ?view=steps) ----------------
  // One plane of the chain z → w₁ → … → w fills the screen. ‹ ›, the arrow keys, the chain strip and (on a touch
  // screen) a swipe from the plane's edge glide from one plane to the next along the step's deformation h_{k,t}.
  // The colour plane (SV.T, a stage) holds the colour: a plane at or before it is coloured by the phase of the
  // map into the colour plane, f_T ∘ … ∘ f_{k+1} (the pull-back of the colour wheel, the colour plot of the map {a: k, b: T});
  // a plane after it shows the shapes carried forward with their pattern (the push-forward). Inside regions (SV.scope
  // 'in') shows the colour only inside the regions in this plane: the z-plane's and earlier planes' regions carried
  // forward, this plane's own, and later planes' pulled back.
  // The view reuses the app's views: a plane at or before the colour plane is Phase (or Landscape), one after it X → Y, always on
  // the left pane alone (solo 'L'); leftStage() is the shown plane, focusMap() the map into the colour plane.
  const SV = {
    on: (() => { try { return new URLSearchParams(location.search).get('view') === 'steps'; } catch (e) { return false; } })(),
    i: 0,            // the shown plane, an index into svPlanes()
    T: -1,           // the colour plane's stage (-1: the last plane, F's)
    scope: 'all',    // 'all' | 'in'
    surf: 'plane',   // 'plane' | 'sphere' | 'land'
    g: HomRange.glider({ omega: 7 }),
    views: {},       // each plane's view {cx, cy, s}, by stage (the z-plane's is S.srcView)
    drag: null,      // a scrub of the strip or a swipe of the plane: {x0, i0, px, w, id, edge}
    els: null,
  };
  // the planes: z and the stage after each active step
  function svPlanes() { return [0].concat(activeSteps()); }
  function svStage(i = SV.i) { const P = svPlanes(); return P[Math.max(0, Math.min(P.length - 1, i))]; }
  function svT() { const P = svPlanes(); return P.includes(SV.T) ? SV.T : P[P.length - 1]; }
  // the shown plane is coloured from the colour plane: at or before it, and not across a d/dz (whose input is z's plane, not w_k's)
  function svColoured(k = svStage()) { const T = svT(); return k <= T && (k === 0 || !derivIn(k, T)); }
  const svMap = () => { const k = svStage(); return k === 0 ? stageMap(svT()) : { mode: 0, a: k, b: svT() }; };
  const svName = (k) => (k === 0 ? 'z' : k === nSteps() ? 'w' : `w${sub(k)}`);
  const svNameHtml = (k) => (k === 0 ? '<i>z</i>' : k === nSteps() ? '<i>w</i>' : `<i>w</i><sub>${k}</sub>`);
  const svReduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function svViewOf(k) {
    if (k === 0) return S.srcView;
    let v = SV.views[k];
    if (!v) { v = SV.views[k] = fittedView(paneL, k); }
    return v;
  }
  // the app's view of the shown plane: Phase (or Landscape) at or before the colour plane, X → Y after it; true when S changed
  function svViewFix() {
    const k = svStage(), col = svColoured(k), v = S.view, surf = SV.surf === 'sphere' ? 'sphere' : 'plane';
    const main = SV.surf === 'land' && col ? 'land' : col ? 'phase' : 'xy';
    let ch = false;
    if (S.focus !== 0) { setFocusStep(0); ch = true; }
    if (morph.open) { morph.open = false; ch = true; }
    if (v.main !== main) { setViewOpt(null, 'main', main); ch = true; }
    if (main === 'land' && !(v.D && v.D.phase)) { setViewOpt(null, 'D', Object.assign({}, v.D, { phase: true })); ch = true; }
    const side = col ? 'P' : 'L';
    if (main !== 'land' && v[side].surf !== surf) { setViewOpt(side, 'surf', surf); ch = true; }
    return ch;
  }
  // a state replaced under the view (an example, undo, a link): back to what the steps view shows, before it is drawn
  function svCheck() {
    if (!SV.on || !SV.els || svMoving()) return;
    const P = svPlanes();
    if (SV.i > P.length - 1) { SV.i = P.length - 1; SV.g.set(SV.i); }
    if (SV.T >= 0 && !P.includes(SV.T)) SV.T = -1;
    if (svViewFix()) setTimeout(svApply, 0);
    svSync();
  }
  function svApply() {
    const k = svStage();
    svViewFix();
    if (k > 0) Object.assign(V.left, svViewOf(k));
    applyLayout();
    buildShapeList();
    updateFocusUI();
    requestRender('L', 'R', 'OL', 'OR', 'G');
    svSync();
  }
  // leave the shown plane: keep its view for when the glide comes back
  function svKeepView() { const k = svStage(); if (k > 0) SV.views[k] = { cx: V.left.cx, cy: V.left.cy, s: V.left.s }; }
  // go to plane i: a glide along the steps in between (at once under reduced motion)
  function svGo(i, now) {
    const P = svPlanes();
    i = Math.max(0, Math.min(P.length - 1, i));
    svKeepView();
    if (now || svReduced()) { SV.g.set(i); svArrive(); return; }
    SV.g.to(i, P.length - 1);
    draft = null; probe = null;
    requestRender('L');
  }
  function svArrive() {
    const i = Math.round(SV.g.x);
    SV.g.set(i);
    SV.i = i;
    svApply();
    if (typeof sndRelayout === 'function') sndRelayout();
    const live = SV.els && SV.els.live;
    if (live) live.textContent = svLabel();
  }
  const svMoving = () => SV.g.moving() || !!(SV.drag && SV.drag.moved);
  // one frame of the glide (frame() calls it); true while it moves
  function svFrame(ts) {
    if (!SV.on) return false;
    if (SV.drag && SV.drag.moved) { dirty.L = true; svSync(); return false; }
    if (!SV.g.moving()) return false;
    const dt = SV.g.last ? (ts - SV.g.last) / 1000 : 1 / 60;
    SV.g.last = ts;
    const still = !SV.g.step(dt);
    dirty.L = true;
    svSync();
    if (still) { SV.g.last = 0; svArrive(); return false; }
    return true;
  }
  const svLerpView = (a, b, u) => {
    const ls = Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * u;
    return { cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, s: Math.exp(ls) };
  };
  // a frame between two planes: plane a's colour fades into plane b's, over the plane the view glides through, and the
  // z-plane's shapes move along h_{b,t} (the step's natural homotopy after the steps before it), as Y's ‹ › glide does
  function svRenderMoving(pane) {
    const P = svPlanes(), x = SV.g.x, j = Math.max(0, Math.min(P.length - 1, Math.floor(x + 1e-9))), u = x - j;
    const a = P[j], b = P[Math.min(P.length - 1, j + 1)];
    const v = svLerpView(svViewOf(a), svViewOf(b), u);
    pane.setView(v);
    pane.begin(TH.plane);
    if (!GLR.ok) { noGL(pane); return; }
    const T = svT();
    let painted = false;
    for (const [k, al] of [[a, 1], [b, u]]) {
      if (al <= 0.01 || !svColoured(k) || (k === b && b === a)) continue;
      GLR.begin(pane.pw, pane.ph);
      GLR.drawColorPlot({ map: k === 0 ? stageMap(T) : { mode: 0, a: k, b: T }, view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: null });
      pane.ctx.globalAlpha = al;
      GLR.blit(pane.ctx);
      pane.ctx.globalAlpha = 1;
      painted = true;
    }
    const map = u <= 1e-6 || b === a ? stageMap(a) : isDeriv(b) ? stageMap(u < 0.5 ? a : b) : { mode: 1, hi: b, t: u };
    drawScene(pane, map, null, { cache: false, noGrid: painted });
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
  }
  // Inside regions: the region mask of plane k, drawn opaque into a canvas the size of the pane's
  let svMaskCv = null, svColCv = null;
  function svCanvas(cv, pane) {
    if (!cv) cv = document.createElement('canvas');
    if (cv.width !== pane.pw || cv.height !== pane.ph) { cv.width = pane.pw; cv.height = pane.ph; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    return cv;
  }
  function svMaskOn() { return SV.on && SV.scope === 'in' && S.shapes.some((s) => s.visible !== false && kindType(s) !== 'point'); }
  // the colour plot just drawn into GL's frame (renderColor): only inside the regions, the rest the plane's paper
  function svMaskColour(pane) {
    const k = svStage();
    svColCv = svCanvas(svColCv, pane);
    GLR.blit(svColCv.getContext('2d'));
    svMaskCv = svCanvas(svMaskCv, pane);
    const mp = Object.create(pane);
    mp.ctx = svMaskCv.getContext('2d');
    mp.begin = () => {};
    const keep = { pattern: S.pattern, alpha: S.alpha, lines: S.lines };
    try {
      setOpt('pattern', 'solid'); setOpt('alpha', 1); setOpt('lines', false);
      drawScene(mp, stageMap(k), null, { noGrid: true, cache: false, domain: k === 0, plane: k });
      stagePullbacks(mp, k);
    } catch (e) { console.error('steps view mask', e); }
    for (const key of Object.keys(keep)) setOpt(key, keep[key]);
    const c = svColCv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    // (twice: a pulled-back region fills at half strength)
    c.drawImage(svMaskCv, 0, 0); c.globalCompositeOperation = 'source-over';
    pane.ctx.save();
    pane.ctx.setTransform(1, 0, 0, 1, 0, 0);
    pane.ctx.drawImage(svColCv, 0, 0);
    pane.ctx.restore();
    GLR.begin(pane.pw, pane.ph);
  }

  // ---- the controls: the plane's head and the chain strip ----
  function svLabel() {
    const k = svStage(), T = svT(), n = svPlanes().length;
    const where = svColoured(k) ? (k === T ? $t('the colour plane') : $t('coloured from {p}', { p: svName(T) })) : $t('after the colour plane {p}', { p: svName(T) });
    return $t('Plane {p}, {i} of {n}, {where}', { p: svName(k), i: SV.i + 1, n, where });
  }
  function svFormulaHtml(k) {
    if (k === 0) return '<i>z</i>';
    return `${svNameHtml(k)} = <i>f</i><sub>${k}</sub>(${svNameHtml(svPlanes()[svPlanes().indexOf(k) - 1] || 0)})`;
  }
  function svSeg(cls, label, items, cur, pick) {
    const g = h('div', { class: 'seg small sv-seg ' + cls, role: 'radiogroup', 'aria-label': label });
    for (const [id, text, tip] of items) {
      g.append(h('button', { type: 'button', role: 'radio', 'data-v': id, 'data-tip': tip || '', 'aria-checked': String(cur() === id), class: cur() === id ? 'on' : '', onclick: () => pick(id) }, text));
    }
    return g;
  }
  function svBuild() {
    const head = document.querySelector('#paneL .pane-head');
    const bar = h('div', { class: 'sv-head', id: 'svHead' });
    const title = h('div', { class: 'sv-title', 'aria-hidden': 'true' });
    const cp = h('button', { type: 'button', class: 'btn small sv-cp', 'aria-pressed': 'false', 'data-tip': $t('Colour every plane from this one  C'), onclick: () => svSetT(svStage()) });
    const scope = svSeg('sv-scope', $t('Where colour shows'), [['all', $t('Everywhere')], ['in', $t('Inside regions'), $t('Colour only inside the regions you draw, in every plane')]], () => SV.scope, (v) => { SV.scope = v; svSync(); requestRender('L'); });
    const surf = svSeg('sv-surf', $t('Surface'), [['plane', $t('Plane')], ['sphere', $t('Sphere')], ['land', $t('Landscape')]], () => SV.surf, (v) => { SV.surf = v; if (v === 'sphere') prestartGlobe(); svApply(); });
    bar.append(title, cp, scope, surf);
    head.prepend(bar);
    // the chain strip: ‹, a segment per plane with the step between, ›
    const prev = h('button', { type: 'button', class: 'sv-nav sv-prev', 'aria-label': $t('Previous plane'), 'data-tip': $t('Previous plane  ←'), onclick: () => svGo(Math.round(SV.g.target) - 1) }, '‹');
    const next = h('button', { type: 'button', class: 'sv-nav sv-next', 'aria-label': $t('Next plane'), 'data-tip': $t('Next plane  →'), onclick: () => svGo(Math.round(SV.g.target) + 1) }, '›');
    const track = h('div', { class: 'sv-track' });
    const thumb = h('div', { class: 'sv-thumb', 'aria-hidden': 'true' });
    const strip = h('div', { class: 'sv-strip', id: 'svStrip', role: 'toolbar', 'aria-label': $t('Planes of the chain') }, prev, h('div', { class: 'sv-rail' }, thumb, track), next);
    const live = h('div', { class: 'sr-only', 'aria-live': 'polite' });
    const stage = $('stage');
    stage.insertBefore(strip, $('gutterRow'));
    stage.append(live);
    SV.els = { bar, head, title, cp, scope, surf, strip, track, thumb, prev, next, live, sig: '' };
    svStripWire(strip, track);
  }
  // the strip's planes and steps, rebuilt when the chain changes
  function svBuildTrack() {
    const E = SV.els, P = svPlanes(), T = svT();
    const sig = P.join(',') + '|' + T + '|' + P.map((k) => (k ? S.steps[k - 1].type : '')).join(',');
    if (sig === E.sig) return;
    // (another chain: the planes' views are fitted again)
    if (E.sig) SV.views = {};
    E.sig = sig;
    E.track.textContent = '';
    E.track.style.setProperty('--n', String(P.length));
    P.forEach((k, i) => {
      if (i > 0) {
        const st = S.steps[k - 1], d = Funcs.DEFS[st.type];
        E.track.append(h('button', { type: 'button', class: 'sv-step', 'data-k': String(k), 'data-tip': $t('Edit step {k}', { k }), onclick: (e) => { e.stopPropagation(); inspectStep(k); } },
          h('span', { class: 'sv-fk', html: `<i>f</i><sub>${k}</sub>` }), h('span', { class: 'sv-fn' }, cardName(st, d))));
      }
      E.track.append(h('button', { type: 'button', class: 'sv-plane', 'data-i': String(i), 'aria-label': svName(k), onclick: (e) => { e.stopPropagation(); svGo(i); } },
        h('span', { class: 'sv-pn', html: svNameHtml(k) }), k === T ? h('span', { class: 'sv-dot', 'aria-label': $t('colour plane'), 'data-tip': $t('The colour plane') }) : null));
    });
  }
  function svSync() {
    if (!SV.on || !SV.els) return;
    const E = SV.els, k = svStage(), T = svT(), P = svPlanes();
    svBuildTrack();
    // (the plane's controls: in its head on a desktop, in the header on a phone, where the view switch was)
    const home = document.documentElement.classList.contains('ph') ? $('top') : E.head;
    if (E.bar.parentNode !== home) { if (home === E.head) home.prepend(E.bar); else home.insertBefore(E.bar, $('hdrMoreBtn')); }
    const x = SV.g.x, at = Math.round(x);
    E.title.innerHTML = svFormulaHtml(k);
    E.cp.innerHTML = '<span class="sv-dot"></span>' + (k === T ? $t('Colour plane') : $t('Colour from here'));
    E.cp.setAttribute('aria-pressed', String(k === T));
    E.cp.classList.toggle('on', k === T);
    for (const g of [E.scope, E.surf]) for (const b of g.children) { const on = b.dataset.v === (g === E.scope ? SV.scope : SV.surf); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); }
    E.prev.disabled = at <= 0 && !SV.g.moving();
    E.next.disabled = at >= P.length - 1 && !SV.g.moving();
    for (const b of E.track.querySelectorAll('.sv-plane')) { const on = +b.dataset.i === at; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); }
    // (the pill between the two planes' buttons, in proportion to the glide)
    const bs = E.track.querySelectorAll('.sv-plane'), j = Math.max(0, Math.min(bs.length - 1, Math.floor(x + 1e-9))), u = x - j;
    const A = bs[j], B = bs[Math.min(bs.length - 1, j + 1)];
    if (A && B) {
      const l = A.offsetLeft + (B.offsetLeft - A.offsetLeft) * u, w = A.offsetWidth + (B.offsetWidth - A.offsetWidth) * u;
      E.thumb.style.transform = `translateX(${l.toFixed(1)}px)`; E.thumb.style.width = `${w.toFixed(1)}px`;
    }
    $('paneL').setAttribute('aria-label', svLabel());
  }
  function svSetT(k) {
    SV.T = k === svPlanes()[svPlanes().length - 1] ? -1 : k;
    svApply();
    save();
  }
  // the strip: a press on a plane goes there; a drag along it scrubs through the deformation, and the glide settles on
  // the nearest plane when it is let go
  function svStripWire(strip, track) {
    const rail = strip.querySelector('.sv-rail');
    const posX = (e) => { const r = track.getBoundingClientRect(), n = svPlanes().length - 1; const pad = r.width / (2 * (n + 1)); return Math.max(0, Math.min(n, n * (e.clientX - r.left - pad) / Math.max(1, r.width - 2 * pad))); };
    rail.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.sv-step')) return;
      SV.drag = { id: e.pointerId, px: e.clientX, moved: false, strip: true };
      try { rail.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic pointer) */ }
    });
    rail.addEventListener('pointermove', (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      if (!d.moved && Math.abs(e.clientX - d.px) < 6) return;
      if (!d.moved) svKeepView();
      d.moved = true;
      SV.g.set(posX(e)); SV.g.max = svPlanes().length - 1;
      requestRender('L');
    });
    const up = (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.strip) return;
      SV.drag = null;
      if (d.moved) { e.preventDefault(); SV.dragEndT = performance.now(); svGo(Math.round(SV.g.x)); }
    };
    rail.addEventListener('pointerup', up);
    rail.addEventListener('pointercancel', up);
    // (a click that ended a scrub is not a press on the plane under it)
    rail.addEventListener('click', (e) => { if (SV.dragEndT && performance.now() - SV.dragEndT < 50) e.stopPropagation(); }, true);
  }
  // a touch swipe that starts at the plane's left or right edge moves through the planes; anywhere else the plane
  // pans and draws as ever
  function svEdgeSwipe() {
    const plot = $('plotL'), EDGE = 28;
    plot.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      const r = plot.getBoundingClientRect();
      const edge = e.clientX - r.left < EDGE ? 'L' : r.right - e.clientX < EDGE ? 'R' : null;
      if (!edge) return;
      e.stopImmediatePropagation(); e.preventDefault();
      svKeepView();
      SV.drag = { id: e.pointerId, px: e.clientX, w: r.width, x0: SV.g.x, moved: true, edge };
      try { plot.setPointerCapture(e.pointerId); } catch (_) { /* (a synthetic pointer) */ }
    }, true);
    plot.addEventListener('pointermove', (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.edge) return;
      e.stopImmediatePropagation();
      // a finger across the whole plane is one plane
      SV.g.set(Math.max(0, Math.min(svPlanes().length - 1, d.x0 - (e.clientX - d.px) / (0.8 * d.w))));
      SV.g.max = svPlanes().length - 1;
      requestRender('L');
    }, true);
    const up = (e) => {
      const d = SV.drag;
      if (!d || d.id !== e.pointerId || !d.edge) return;
      e.stopImmediatePropagation();
      SV.drag = null;
      const dx = e.clientX - d.px, x = SV.g.x;
      // a flick goes one plane on even when short
      const to = Math.abs(dx) > 40 ? (dx < 0 ? Math.floor(d.x0 + 1e-6) + 1 : Math.ceil(d.x0 - 1e-6) - 1) : Math.round(x);
      svGo(to);
    };
    plot.addEventListener('pointerup', up, true);
    plot.addEventListener('pointercancel', up, true);
  }
  // ← → move through the planes, C makes the shown plane the colour plane (not while typing, nor on a focused plane,
  // whose arrows move the probe)
  function svKeys() {
    document.addEventListener('keydown', (e) => {
      if (!SV.on || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = /** @type {HTMLElement} */ (e.target);
      if (t && (t.closest && t.closest('input, textarea, select, [contenteditable], [role="slider"], canvas, .cm-palette'))) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'PageUp' || e.key === 'PageDown') {
        e.preventDefault(); e.stopImmediatePropagation();
        svGo(Math.round(SV.g.target) + (e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : -1));
      } else if ((e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        e.preventDefault(); e.stopImmediatePropagation();
        svSetT(svStage());
      }
    }, true);
  }
  // the chain changed: the shown plane and the colour plane stay on their stages when they still exist
  function svChainChanged() {
    if (!SV.on || !SV.els) return;
    const P = svPlanes();
    if (SV.i > P.length - 1) { SV.i = P.length - 1; SV.g.set(SV.i); }
    if (SV.T >= 0 && !P.includes(SV.T)) SV.T = -1;
    svApply();
  }
  function setupStepsView() {
    if (!SV.on) return;
    document.documentElement.classList.add('sv');
    setFocusStep(0);
    svBuild();
    svEdgeSwipe();
    svKeys();
    SV.g.set(0); SV.g.max = svPlanes().length - 1;
    svApply();
  }
