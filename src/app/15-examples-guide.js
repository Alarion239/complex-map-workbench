  // ---------------- examples ----------------
  const EX = [
    { name: $t('Empty canvas'), tex: '', blurb: $t('No shapes and no functions: start from scratch.'), view: { cx: 0, cy: 0, s: 90 }, shapes: [], steps: [] },
    {
      name: $t('Strip to disk'), tex: 'w=\\frac{e^{z}-1}{e^{z}+1}', blurb: $t('exp opens the strip |Im z| < π/2 onto a half-plane; a Möbius map folds it into the disk.'), view: { cx: 0, cy: 0, s: 52 },
      shapes: [
        { kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' },
        { kind: 'line', a: [0, 0.8], b: [1, 0.8] },
        { kind: 'point', p: [0, 0], label: 'z₀' },
      ],
      steps: [{ type: 'exp', params: {} }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }],
    },
    {
      name: $t('Quarter plane squared'), tex: 'w=z^{2}', blurb: $t('The first quadrant opens onto the upper half-plane; angles at 0 double.'), view: { cx: 0.6, cy: 0.6, s: 70 },
      shapes: [{ kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, { kind: 'pgrid', c: [0, 0], r: 2, nc: 4, nr: 16 }],
      steps: [{ type: 'pown', params: { n: 2 } }],
    },
    {
      name: $t('Joukowski airfoil'), tex: 'w=\\tfrac12\\left(z+\\tfrac1z\\right)', blurb: $t('A circle through 1 becomes a wing with a sharp trailing edge.'), view: { cx: 0, cy: 0, s: 70 },
      shapes: [
        { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true },
        { kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888 },
        { kind: 'point', p: [1, 0], label: 'trailing edge' },
      ],
      steps: [{ type: 'joukowski', params: {} }],
    },
    {
      name: $t('Logarithm of an annulus'), tex: 'w=\\log z', blurb: $t('The annulus becomes a rectangle. Drag the red cut to move the seam.'), view: { cx: 0, cy: 0, s: 70 },
      shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, { kind: 'circle', c: [0, 0], r: 1 }, { kind: 'segment', a: [0.5, 0.5], b: [1.5, 1.5] }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 } }], focus: 1,
    },
    {
      name: $t('Disk automorphism'), tex: 'w=\\frac{z-a}{1-\\bar a z}', blurb: $t('A Möbius self-map of the disk, played as a deformation.'), view: { cx: 0, cy: 0, s: 110 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 1 }, { kind: 'pgrid', c: [0, 0], r: 1, nc: 5, nr: 16 }],
      steps: [{ type: 'blaschke', params: { a: '0.5+0.3i', phi: 0 } }], morph: true,
    },
    {
      name: $t('Sine of a half-strip'), tex: 'w=\\sin z', blurb: $t('The half-strip |Re z| < π/2, Im z > 0 maps onto the upper half-plane.'), view: { cx: 0, cy: 1.25, s: 105 },
      shapes: [{ kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, { kind: 'cgrid', a: [-1.5, 0], b: [1.5, 2.4], n: 6 }],
      steps: [{ type: 'sin', params: {} }],
    },
    {
      name: $t('Square root and its sheets'), tex: 'w=\\sqrt{z}', blurb: $t('The slit plane maps onto a half-plane. On the step card, ‹ › flips the sheet and Show all sheets draws both.'), view: { cx: 0, cy: 0, s: 70 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 2 }, { kind: 'circle', c: [0.5, 0.3], r: 0.9 }],
      steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 } }], focus: 1,
    },
    {
      name: $t('Cayley, then cube'), tex: 'w=\\left(\\frac{z-i}{z+i}\\right)^{3}', blurb: $t('Half-plane to disk, then the disk wraps around itself three times.'), view: { cx: 0, cy: 1, s: 60 },
      shapes: [{ kind: 'halfplane', a: [0, 0], b: [1, 0] }, { kind: 'cgrid', a: [-2, 0], b: [2, 2.5], n: 8 }],
      steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'pown', params: { n: 3 } }],
    },
    {
      name: $t('A formula in LaTeX'), tex: 'w=\\frac{z^2-1}{z^2+1}', blurb: $t('A custom step shown as a color plot: zeros at ±1, poles at ±i.'), view: { cx: 0, cy: 0, s: 80 },
      shapes: [{ kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }],
      steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], rightMode: 'color',
    },
    {
      name: $t('Roots as preimages'), tex: 'z^{3}-1=0', blurb: $t('The target 0 in the w-plane pulls back to the three cube roots of unity; the target circle to curves around them.'), view: { cx: 0, cy: 0, s: 90 },
      shapes: [{ kind: 'circle', c: [0, 0], r: 1 }],
      targets: [{ kind: 'point', p: [0, 0] }, { kind: 'circle', c: [0, 0], r: 0.6 }],
      steps: [{ type: 'custom', params: { expr: 'z^3-1', cut: 180 } }],
    },
    {
      name: $t('A residue by integration'), tex: '\\oint_{|z-i|=1}\\frac{dz}{z^2+1}=\\pi', blurb: touchUI() ? $t('Hold a finger on the circle, then choose Integrate: around the pole at i the running integral misses its start by 2πi · Res = π.') : $t('Right-click the circle: around the pole at i the running integral misses its start by 2πi · Res = π.'), view: { cx: 0, cy: 0.5, s: 80 },
      shapes: [{ kind: 'circle', c: [0, 1], r: 1 }],
      steps: [{ type: 'custom', params: { expr: '\\frac{1}{z^2+1}', cut: 180 } }], rightMode: 'color', integrate: 0,
    },
    {
      name: $t('The derivative in the chain'), tex: 'w=\\frac{d}{dz}\\left(z^{3}-3z\\right)', blurb: $t('A d/dz step differentiates the chain so far: the critical points ±1 of z³ − 3z are the zeros of its derivative.'), view: { cx: 0, cy: 0, s: 80 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 1.6 }, { kind: 'pgrid', c: [0, 0], r: 1.6, nc: 4, nr: 16 }],
      targets: [{ kind: 'point', p: [0, 0] }],
      steps: [{ type: 'custom', params: { expr: 'z^3-3z', cut: 180 } }, { type: 'deriv', params: {} }], rightMode: 'color',
    },
    {
      name: $t('Sheets of the logarithm'), tex: 'w=\\log z', blurb: $t('Landscape with All sheets: Im log z climbs a helicoid around 0 instead of jumping at the cut.'), view: { cx: 0, cy: 0, s: 60 },
      shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 } }], rightMode: '3d', sheets: true, height: 'im',
    },
    // a melody on a curve (notes/sea-song): Edvard Grieg's theme (1875, public domain) in our own adaptation for the
    // phase harp, one curve spiralling into 0 under SEASONG.tex (src/seasong.js, made by tools/melody_curve.js). Listen along
    // plays it with its own tempo and dynamics (the shape's listen: sndListenOf); fit: the box kept in view
    {
      name: $t('In the Hall of the Mountain King'), tex: SEASONG.tex, blurb: $t('Edvard Grieg, Peer Gynt (1875). Choose Listen along in the spiral\'s menu (right-click, or hold on touch): the theme speeds up and grows louder as the curve winds in, and the branch cut is the drum.'),
      view: SEASONG.view, fit: SEASONG.fit, shapes: [{ kind: 'curve', pts: SEASONG.pts, listen: SEASONG.listen, nameKey: 'spiral' }], steps: SEASONG.steps, rightMode: 'color', dc: 'phase', thumbX: true, tip: true,
    },
    // [issue #4] the phase portraits of ζ (its first zeros on the critical line) and of Γ (its row of poles)
    {
      name: $t('Zeros of the zeta function'), tex: 'w=\\zeta(z)', blurb: $t('The phase portrait of ζ over the critical strip 0 < Re z < 1: its first zeros ½ + 14.13i, ½ + 21.02i and ½ + 25.01i lie on the line Re z = ½, where every colour meets.'), view: { cx: 0.5, cy: 19.5, s: 40 },
      shapes: [
        { kind: 'formula', expr: '0<\\Re z<1' },
        { kind: 'line', a: [0.5, 0], b: [0.5, 1] },
        { kind: 'point', p: [0.5, 14.134725] }, { kind: 'point', p: [0.5, 21.022040] }, { kind: 'point', p: [0.5, 25.010858] },
      ],
      steps: [{ type: 'zeta', params: {} }], rightMode: 'color',
    },
    {
      name: $t('Poles of the Gamma function'), tex: 'w=\\Gamma(z)', blurb: $t('The phase portrait of Γ: its poles at 0, −1, −2, … sit in a row on the negative real axis, and Γ(n + 1) = n! grows fast to the right.'), view: { cx: -1.5, cy: 0, s: 60 },
      shapes: [{ kind: 'rect', a: [-4.5, -1.5], b: [2.5, 1.5] }],
      steps: [{ type: 'gamma', params: {} }], rightMode: 'color',
    },
  ];
  // an example's box that must be in view (ex.fit: a phone's narrow plane, or X → Y's half): its view's scale at most,
  // centred on the box, for the X pane's size now; exFitKey: the view it gave (a view seen first after it fits again).
  // The plane's style bar floats over its bottom on a desktop (a 32 px row 8 px in, more rows on a narrow plane) and
  // does not scale with the view: it is kept clear in pixels, the box fitted and centred above it (notes/sea-song/r2
  // review picture-2); a phone has no bar on the plane
  let exFitKey = '';
  function exFitBarPx() {
    if (document.documentElement.classList.contains('ph')) return 0;   // (:root.ph hides the bar on the plane)
    // (v16.5 UX20: on a desktop the bar is in the pane head, above the plane, so only the bottom margin is kept: the
    // same 48 px, the examples' views unchanged; measured from the head it took the whole plane and the fit went NaN)
    const f = $('leftFoot'), pr = paneL.ocanvas && paneL.ocanvas.getBoundingClientRect(), fr = f && !f.hidden && f.parentNode === $('plotL') ? f.getBoundingClientRect() : null;
    return Math.max(40, fr && pr && fr.height > 0 ? pr.bottom - fr.top : 0) + 8;
  }
  function exFitTo(ex) {
    const fb = ex.fit;
    if (fb && paneL.w > 20 && paneL.h > 20 + exFitBarPx()) {
      const bar = exFitBarPx(), s = Math.min(ex.view.s, paneL.w / (fb.x1 - fb.x0), (paneL.h - bar) / (fb.y1 - fb.y0));
      Object.assign(S.srcView, { cx: (fb.x0 + fb.x1) / 2, cy: (fb.y0 + fb.y1) / 2 - bar / 2 / s, s });
    }
    exFitKey = fb ? JSON.stringify(S.srcView) : '';
  }
  // an example whose steps this build cannot make is left out of the menus
  const exOk = (ex) => ex.steps.every((st) => Funcs.DEFS[st.type]);
  let currentExample = -1;
  // a first visit opens a worked example, not the empty canvas listed first
  const firstExample = () => Math.max(0, EX.findIndex((e) => e.shapes.length && e.steps.length));
  function loadExample(i, spec) {
    phHold();
    const ex = spec || EX[i];
    if (!ex) return;
    // what plays along a curve belongs to the scene it was started in (notes/sea-song review ui-1)
    sndStopPlay(false);
    // (v16.5 UX74) an example's Try line goes with the example
    if (Tour.laneHide) Tour.laneHide('example');
    // (a tour scene, spec, leaves the Examples label and currentExample alone)
    if (!spec) currentExample = i;
    const xl = document.querySelector('#examplesBtn .exlabel');
    if (xl && !spec) { xl.textContent = ex.name; xl.title = ex.name; }   // ([v16.5 check app-3] its tooltip: the whole name)
    S.shapes = []; S.steps = [];
    S.sel = null;   // (v15: a new example selects its last step)
    // an example opens as its blurb describes: the views it names (in the fields of earlier builds, rightMode and
    // leftSphere, migrated to the panes' views as a saved state is), a phase style that needs no selected curve, the
    // landscape's sheets and height as it sets them. The layout comes first (merged-views.md): the meshing window below
    // is the X pane's box, which must have its new width (a merge or a split changes it)
    const ev = Views.migrate({ rightMode: ex.rightMode || 'image', sphereMode: ex.sphereMode, leftSphere: !!ex.leftSphere, material: ex.material, spherePlane: ex.spherePlane,
      dc: ex.dc || (S.dc === 'cauchy' ? blankState().dc : S.dc) });
    S.view = ev.view;
    S.dc = ev.dc;
    S.landPlain = !!ev.landPlain;
    // (a new scene: every view starts from its own fitted plane)
    for (const k of Object.keys(viewMem)) delete viewMem[k];
    morph.open = false; morph.T = 0; morph.seg = null; morph.playing = false;
    defMem.y = null; defMem.d = null; defMem.dkey = '';
    // (v16.5 UX74) an example with a melody shows its Try line before the layout, so its plane is fitted with the
    // line's room already taken (shown after the fit, the line pushed the spiral's top out of the plane)
    const laned = !spec && ex.shapes.some((sh) => sh.listen) && sndPieceHint(true);
    applyLayout();
    // (the planes take their new height at once, as for a merge, not at the next ResizeObserver callback)
    if (laned && paneL && paneR) onPaneResize();
    S.srcView = Object.assign({}, ex.view);
    // an example's box that must be in view (a phone's narrow plane): its view's scale at most, centred on the box
    exFitTo(ex);
    paneL.setView(S.srcView);
    // (review v16 regress-6: the window goes into the state too, so a link, a scene file or an autosave made from the
    // example carries it, and the recipient meshes in the sender's window whatever the size of their pane)
    clipWin = viewBox(S.srcView);
    S.clipWin = clipWin;
    dropAllGPU();
    selected = null;
    for (const sh of ex.shapes) {
      const ns = newShape(sh.kind, JSON.parse(JSON.stringify(sh)));
      // a melody's data keeps the chain it was composed for and the key of its points (sndListenOf)
      if (ns.listen) ns.listen = Object.assign(ns.listen, { steps: JSON.parse(JSON.stringify(ex.steps)), key: sndPtsKey(ns.pts) });
      S.shapes.push(ns);
    }
    for (const st of ex.steps) S.steps.push(Object.assign({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params), on: true }, st.handleR > 0 ? { handleR: st.handleR } : {}));
    if (ex.range && Number.isInteger(ex.range.a) && Number.isInteger(ex.range.b)) S.homRange = { a: ex.range.a, b: ex.range.b }; else delete S.homRange;   // (v16)
    // the L key (the keyboard probe) replays the example's melody; another example forgets it
    const piece = S.shapes.find((x) => x.listen);
    if (piece) snd.lastLoop = { pts: piece.pts, closed: false, sid: piece.id };
    else if (snd.lastLoop && snd.lastLoop.sid) snd.lastLoop = null;
    // an example brings its own w-plane targets (none unless it says so)
    S.targets = [];
    if (ex.targets) for (const t of ex.targets) S.targets.push(newShape(t.kind, JSON.parse(JSON.stringify(t)), true));
    S.sheets = !!ex.sheets;
    if (ex.height) S.height = ex.height;
    cauchyCache.key = '';
    closePalette();
    rebuild();
    buildShapeList();
    buildPipeline();
    setFocus(ex.focus || 0);
    commit();
    // (v16.5 UX25: what opened, with Undo, when there is work to go back to; the button names it until an edit)
    if (!spec) { exAt = hi; exLabelSync(); if (hi > 0) undoToast($t('Opened {name}.', { name: ex.name })); }
    if (ex.morph || ev.deform) openTransport();
    if (piece && !spec && !laned) sndPieceHint();
    // the line integral the example is about, once the planes have their size
    if (ex.integrate != null) requestAnimationFrame(() => { const s = S.shapes[ex.integrate]; if (s && paneL) { const r = paneL.ocanvas.getBoundingClientRect(); openIntegralPop(s.id, r.left + r.width * 0.62, r.top + 40); } });
  }
  // examples menu: 48x32 thumbnails rendered once with the real renderer, by swapping in a scratch state
  // Each is drawn with its own example's chain, in GLR side mode: the user's chain, its history and their programs
  // stay as they are, and a thumbnail whose chain programs are still compiling is not kept (exWait) but drawn again
  // when they land (GLR.onReady side), into the open gallery. exThumbs: example index -> data URL, for the current
  // look (pattern, opacity, theme); a change of look starts over.
  const exThumbs = new Map();
  const exWait = new Map();   // example index -> its chain structure key, compiling
  let exLook = '';
  function renderExampleThumb(i) {
    if (!GLR.ok) return exThumbs.get(i);
    const look = `${S.pattern}|${S.alpha}|${TH.plane}`;
    if (look !== exLook) { exThumbs.clear(); exLook = look; }
    if (exThumbs.has(i)) return exThumbs.get(i);
    const ex = EX[i];
    const save = { S, clipWin, selected, hoverShape };
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:-1000px;top:0;width:96px;height:64px';
    document.body.append(cv);
    let url = null, key = null;
    GLR.side(true);
    try {
      S = Object.assign(blankState(), {
        shapes: ex.shapes.map((sh, j) => Object.assign({ id: `ex${i}_${j}`, ci: j % 8, visible: true }, JSON.parse(JSON.stringify(sh)))),
        steps: ex.steps.map((st) => ({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params), on: true })),
        pattern: save.S.pattern, alpha: save.S.alpha, meshN: 160, lines: false, unit: false, chev: false,
      });
      selected = null; hoverShape = null;
      clipWin = { x0: ex.view.cx - 260 / ex.view.s, x1: ex.view.cx + 260 / ex.view.s, y0: ex.view.cy - 180 / ex.view.s, y1: ex.view.cy + 180 / ex.view.s };
      rebuild();
      const pane = new Pane(cv);
      pane.resize();
      // (thumbX: the shapes in X, for an example whose image under F is not a picture: the melody's curve, where
      // |F| runs from e^−78 to e^78)
      const tk = ex.thumbX ? 0 : nSteps();
      fitPane(pane, tk);
      pane.begin(TH.plane);
      sideDraw = true;
      try { drawScene(pane, stageMap(tk), null, { thin: true, L: 2, cache: false }); } finally { sideDraw = false; }
      if (GLR.frameStatus().pending) key = GLR.chainKey; else url = cv.toDataURL();
      for (const sh of S.shapes) dropShapeGPU(sh.id);
    } catch (e) { console.error(e); } finally {
      S = save.S; clipWin = save.clipWin; selected = save.selected; hoverShape = save.hoverShape;
      GLR.side(false);
      rebuild();
      cv.remove();
    }
    if (key) exWait.set(i, key);
    else { exWait.delete(i); exThumbs.set(i, url); }
    return url;
  }
  // side compiles landed: draw the waiting thumbnails whose programs are all ready, into the gallery if it is open
  let exRetryT = 0;
  function retryExampleThumbs() {
    clearTimeout(exRetryT);
    exRetryT = setTimeout(() => {
      const imgs = document.querySelectorAll('#popHost .examples .ex-thumb');   // the gallery's images, in EX order
      for (const [i, key] of [...exWait]) {
        if (!GLR.ready(key)) continue;
        const url = renderExampleThumb(i);
        if (url && imgs[i]) imgs[i].src = url;
      }
    }, 30);
  }
  function openGallery(anchor) {
    const okey = focusKey(anchor);
    const items = EX.map((ex, i) => {
      const img = h('img', { class: 'ex-thumb', alt: '', width: 48, height: 32 });
      // (v16.5 UX25: the empty canvas is "New", first, the way to start fresh)
      const b = h('button', { class: 'ex-item' + (i === 0 ? ' ex-new' : ''), role: 'menuitem', hidden: !exOk(ex) || null, 'aria-current': i === currentExample ? 'true' : null, onclick: () => { closePalette(); loadExample(i); focusBack(anchor, okey); } }, img,
        h('span', { class: 'ex-text' }, h('span', { class: 'ex-nl' }, h('span', { class: 'ex-name' }, i === 0 ? $t('New: empty canvas') : ex.name), ex.shapes.some((sh) => sh.listen) ? h('span', { class: 'ex-snd', title: $t('With sound'), 'aria-label': $t('With sound') }, '♫') : null), h('span', { class: 'ex-blurb' }, ex.blurb || '')));   // (v16.5 UX74: ♫ beside the name, not in it: .ex-name stays the example's name)
      return { b, img, i };
    });
    closePalette();
    const pop = h('div', { class: 'pop menu examples', role: 'menu', 'aria-label': $t('Examples') }, ...items.map((x) => x.b));
    $('popHost').append(pop);
    popEl = pop;
    placePop(pop, anchor);
    // (ex.tip: the whole description as a tooltip, where its line is cut; the melody says how to hear it there)
    for (const { b, i } of items) { const bl = EX[i].tip && b.querySelector('.ex-blurb'); if (bl && bl.scrollWidth > bl.clientWidth + 1) b.title = EX[i].blurb; }
    items[0].b.focus();
    pop.addEventListener('keydown', (e) => {
      const its = items.map((x) => x.b).filter((b) => !b.hidden), i = its.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); its[(i + 1) % its.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); focusBack(anchor, okey); }
    });
    armOutside(anchor);
    // fill thumbnails one per frame so the menu opens at once
    let q = 0;
    const next = () => {
      if (popEl !== pop || q >= items.length) return;
      const it = items[q++];
      if (it.b.hidden) { setTimeout(next, 0); return; }
      const url = renderExampleThumb(it.i);
      if (url) it.img.src = url;
      setTimeout(next, 0);
    };
    setTimeout(next, 30);
  }
  // theme preference is per viewer: auto follows the system
  function themePref() { try { return localStorage.getItem(lsk('cmw-theme')) || 'auto'; } catch (e) { return 'auto'; } }
  function setTheme(t) {
    try { localStorage.setItem(lsk('cmw-theme'), t); } catch (e) { /* storage unavailable */ }
    // one frame (spec 8.7): flush the new colors with transitions off, so none of the hover transitions start.
    // The class goes on <body>: the theme MutationObserver watches the class of <html>.
    const body = document.body;
    body.classList.add('no-trans');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    void getComputedStyle(body).color;
    body.classList.remove('no-trans');
    const b = $('themeBtn');
    const name = { auto: $t('Auto'), light: $t('Light'), dark: $t('Dark') }[t];
    if (b) {
      b.setAttribute('data-tip', $t('Theme: {name}', { name })); b.setAttribute('aria-label', $t('Theme: {name}', { name })); b.removeAttribute('title');
      const tl = b.querySelector('.tlabel'); if (tl) tl.textContent = name; // the markup already reads "Theme: "
    }
  }
  // Phase colors (issue 8): one palette for every view, a per-viewer setting like the theme (src/palette.js): the
  // wheel or one of Arb's color functions. The header's button opens a menu with a preview of each
  const PAL_NAMES = () => ({
    wheel: [$t('Wheel'), $t('The workbench\'s hue wheel: every phase equally bright')],
    arb: ['Arb', $t('Arb\'s colours: hue from the phase, zeros black, poles white')],
    arbPhase: [$t('Gold and blue'), $t('Arb\'s phase colours: white at arg 0, gold, black at ±π, blue')],
    arbDodge: [$t('Arb blend'), $t('Arb\'s colours and its phase colours blended')],
    chrome: [$t('Chrome'), $t('The Arb blend with a shiny colour balance')],
    warm: [$t('Warm'), $t('The Arb blend with a warm colour balance')],
    cold: [$t('Cold'), $t('The Arb blend with a cold colour balance')],
    tomato: [$t('Tomato'), $t('The Arb blend with a red colour balance')],
  });
  function palPref() { try { const v = localStorage.getItem(lsk('cmw-palette')); return Palette.LIST.some((p) => p[0] === v) ? v : 'wheel'; } catch (e) { return 'wheel'; } }
  // a disc whose |w| runs from 10^-3 at the centre to 10^3 at the rim, arg w the angle: the palette as Plain paints it
  const palPreviews = new Map();
  function palPreview(id) {
    if (palPreviews.has(id)) return palPreviews.get(id);
    const n = 40, cv = document.createElement('canvas'); cv.width = cv.height = n;
    const x = cv.getContext('2d'), img = x.createImageData(n, n), mode = Palette.modeOf(id);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n * 2 - 1, v = 1 - (j + 0.5) / n * 2, rho = Math.hypot(u, v), o = 4 * (j * n + i);
      if (rho > 1) continue;
      const a = Math.atan2(v, u), c = mode < 0 ? GLR.phaseRGB(a, 0.75) : Palette.arb(mode, a, Math.pow(10, 6 * rho - 3));
      img.data[o] = Math.round(255 * c[0]); img.data[o + 1] = Math.round(255 * c[1]); img.data[o + 2] = Math.round(255 * c[2]); img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    const url = cv.toDataURL('image/png');
    palPreviews.set(id, url);
    return url;
  }
  // done: after a choice (the phone's More sheet relabels its row)
  function palItems(done) {
    const cur = GLR.palette(), names = PAL_NAMES();
    const list = Palette.LIST.map(([id]) => ({ label: names[id][0], tip: names[id][1], radio: true, checked: cur === id, iconHtml: `<img class="pcol-prev" alt="" src="${palPreview(id)}">`, run: () => { setPalette(id); if (done) done(); } }));
    list.menuLabel = $t('Phase colours'); list.focusChecked = true;
    return list;
  }
  function setPalette(id) {
    try { localStorage.setItem(lsk('cmw-palette'), id); } catch (e) { /* storage unavailable */ }
    const changed = GLR.setPalette(id);
    syncPalBtn();
    if (!changed || !paneL) return;
    drawLegend();
    requestRender('L', 'R', 'T');
  }
  function syncPalBtn() {
    const b = $('palBtn');
    if (!b) return;
    const name = PAL_NAMES()[GLR.palette()][0];
    b.setAttribute('data-tip', $t('Phase colours: {name}', { name })); b.setAttribute('aria-label', $t('Phase colours: {name}', { name })); b.removeAttribute('title');
    const pl = b.querySelector('.plabel'); if (pl) pl.textContent = name;
    const ic = /** @type {HTMLElement | null} */ (b.querySelector('.pcol-ic')); if (ic) ic.style.setProperty('--wheel', keyConic());
  }
  function viewBox(v) {
    const w = paneL ? paneL.w : 500, hh = paneL ? paneL.h : 500;
    return { x0: v.cx - w / 2 / v.s, x1: v.cx + w / 2 / v.s, y0: v.cy - hh / 2 / v.s, y1: v.cy + hh / 2 / v.s };
  }

  // ---------------- guide ----------------
  // (v16) the guide's TeX in $…$ as typeset spans (the guide sets every [data-tex] after it is built)
  const guideTex = (s) => s.replace(/\$([^$]+)\$/g, (_, x) => `<span class="gtex" data-tex="${x.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></span>`);
  // v16.5 UX17: the guide on a touch screen (the tour's touch check: a coarse pointer). Each paragraph that names a place
  // or a gesture of the desktop (the tools on the left, the right pane, the Inspector, a double-click, a right-click,
  // Shift, a key) is given in a phone's words. A paragraph is found by its section's heading and its place in the
  // section, so the desktop wording can change without this list. The Deformation section gets a line on where its
  // controls are on a phone, and the Keys section is left out.
  const GUIDE_TOUCH = [
    [null, 0, `Build a region in the <i>z</i>-plane, push it through a chain of functions <i>f</i><sub>1</sub>, <i>f</i><sub>2</sub>, …, and watch every intermediate image. <i>X</i> is always the domain (or the input of a step shown alone) and <i>Y</i> its output: <i>X</i> shows the shapes, <i>Y</i> their images. One of them fills the screen and the other is the small picture in its corner: tap that picture to swap them. With a panel open, or with the phone turned, they stand side by side.`],
    [`Regions`, 0, `Draw with the tools of the bottom row (its More key holds the others and a formula box), or type a set in that box, such as <span class="chip ftag" data-tex="|z-1|<2"></span> or <span class="chip ftag" data-tex="0<\\Im z<\\pi"></span>. Formulas accept <i>and</i>, <i>or</i>, <i>not</i>, commas, chained comparisons, and <i>x</i>, <i>y</i>, <i>r</i>, <i>θ</i>. An equation is a curve: <span class="chip ftag" data-tex="\\operatorname{Re} z=0"></span> is a line, <span class="chip ftag" data-tex="|z|=1,\\ \\operatorname{Im} z>0"></span> an arc; lines, rays, segments, circles and arcs become shapes with handles, other curves such as <span class="chip ftag" data-tex="|\\sin z|=1"></span> are traced exactly. A set or curve in <i>w</i> is a target of the <i>w</i>-plane. Unbounded regions are meshed far beyond the visible window, so their whole image appears in <i>Y</i>; the fill fades out where the mesh ends. The pattern is drawn in <i>z</i>-coordinates and carried along by the map, so every tile can be followed.`],
    [`Function chain`, 0, `Add a step with the + in the chain bar; type a formula such as <span class="chip ftag" data-tex="e^{z^2}"></span> in its search to add it directly. Tap a card: its editor opens in a panel at the bottom, with its formula in full, a field per coefficient and a ⋯ menu that replaces the step by its inverse, bypasses, moves, duplicates or removes it. A step's own coefficients are marked with its index (<i>a</i><sub>2</sub>); a plain letter is a shared number. The editor's <b>Show alone</b> button shows that step alone. To reorder, use Move in the ⋯ menu.`],
    [`Function chain`, 2, `A typed formula that is a chain of catalog steps, such as <span class="chip ftag" data-tex="\\sin(z^2+1)"></span>, shows in its editor how it is built: <span class="chip ftag" data-tex="z\\mapsto z^2\\mapsto z^2+1\\mapsto \\sin(z^2+1)"></span>. <b>Split into steps</b> turns it into those steps, each with its own card and picture; Undo returns the formula. A sum or product of two functions of <i>z</i>, such as <span class="chip ftag" data-tex="z^2+\\sin z"></span>, is not a chain and stays one step. In the search, a formula that is one catalog function, such as sin z or z^i, adds that function directly.`],
    [`Shared numbers|Numbers`, 0, `Type a new letter such as <i>a</i> in any field (a coefficient, a zero, a radius, a region formula such as Re <i>z</i> = <i>a</i>), and the number <i>a</i> appears under <b>Numbers</b>, the <i>a</i> = key at the start of the chain bar, with a slider and Play. Change it once, and everything that uses it follows. <b>Copy link to this figure</b>, in the ⋯ menu, puts the whole figure in a link; <b>Save scene</b> and <b>Open scene</b> use a file.`],
    [`Shared numbers|Numbers`, 1, `<b>d/dz</b> is a step too: it differentiates the chain so far, so [<i>f</i><sub>1</sub>, <i>f</i><sub>2</sub>, d/dz, <i>f</i><sub>3</sub>] maps <i>z</i> to <i>f</i><sub>3</sub>((<i>f</i><sub>2</sub> ∘ <i>f</i><sub>1</sub>)′(<i>z</i>)), and two in a row give the second derivative. Every view shows it like any other step; shown alone, its <i>X</i> is the <i>z</i>-plane.`],
    [`Branch cuts`, 0, `Logarithms, roots and complex powers cut along a ray from 0. Drag the seam's handle in the step's input plane (<i>X</i> for the first step, else show the step alone). The hatched side is the side the cut belongs to. The sheet number, in the step's editor, picks the branch.`],
    [`Branch cuts`, 1, `<i>Zeros and poles</i> (in Polynomial &amp; custom) is the map <i>a</i>∏(<i>z</i> − ζ<sub><i>k</i></sub>)/∏(<i>z</i> − <i>p<sub>j</sub></i>). Its zeros (dots) and poles (crosses) are handles in its input plane (X for the first step, else show the step alone): drag them, or add one with <b>Add zero</b> and <b>Add pole</b> in its editor. Drag one off the plane, or hold it and choose Remove, to remove it. A polynomial or rational step can be rewritten this way from its <b>⋯</b> menu, and back.`],
    [`The planes' menu`, 0, `Hold a finger on a zero or a pole, a shape or a cut handle until the ring fills, then lift it: its menu opens. Its head gives the point and the map there; below come the actions for that object: Remove, Turn into a pole (or a zero) and Edit for a mark, Reset the cut for a cut handle, and for a shape its line integral and Listen along, Hide, Delete and the constructions that act on it. An empty plane has no menu, and a long press while you draw cancels the drawing. Slide the finger instead of lifting it, and you read the values under it.`],
    [`Views`, 0, `The switch at the top picks the view. <b><i>X</i> → <i>Y</i></b> shows the two planes: the shapes in <i>X</i>, their images in <i>Y</i>, each with its own <b>Sphere</b> key in the column at its bottom right. <i>Y</i> has a derivative gauge under the probe. <b>Phase</b> fills the screen with <i>X</i>, each point coloured by arg <i>F</i>, with modulus contours, on the plane or on the Riemann sphere; the shapes are outlined. <b>Landscape</b> lifts |<i>F</i>| over <i>X</i> into a surface, in the phase colours or in plaster: zeros are pits, poles are peaks; for a map with a branch cut, <b>All sheets</b>, in the Display panel, draws its sheets instead of the cut principal branch (all of them when there are finitely many, else a window of them; best with height Re <i>F</i> or Im <i>F</i>). Each view keeps its own camera and plane view. <b>Sphere</b> places a plane on the Riemann sphere, with ∞ at the north pole. You draw on it as in the plane (shapes in <i>X</i>, targets in <i>Y</i>; Annulus, Sector and Polar grid draw in Plane only): a Disc or Circle is a cap of the sphere, and one whose rim passes ∞ becomes a half-plane or a line. With Select, drag a shape to move it (over ∞ it changes kind) and empty space to turn the globe; in every tool two fingers turn it. The <b>Phase key</b> check, in the Display panel of <i>Y</i> in <i>X</i> → <i>Y</i>, paints the portrait's colours under it, so a colour of the portrait reads off as a value of <i>w</i>.`],
    [`Preimages and roots`, 0, `Hold a finger on a point <i>w</i> of <i>Y</i> (its plane or its sphere) and slide it: <i>X</i> marks every <i>z</i> in view with <i>F</i>(<i>z</i>) = <i>w</i>, and its readout counts them. In its plane the drawing tools also work in <i>Y</i>: what you draw there is a <i>target</i> in the <i>w</i>-plane. In every view <i>X</i> shades every <i>z</i> with <i>F</i>(<i>z</i>) in a target area and traces the curves <i>F</i>(<i>z</i>) on a target curve; a target point <i>p</i> marks the solutions of <i>F</i>(<i>z</i>) = <i>p</i> as <i>z</i><sub>1</sub>, <i>z</i><sub>2</sub>, … with their multiplicity, and the poles of <i>F</i> (a target at 0 shows the roots). Targets are listed under the shapes, under More, and can be edited, hidden or deleted.`],
    [`Inverses and derivatives`, 0, `<b>Replace with the inverse</b>, in the ⋯ menu of a step's editor, replaces the step by its inverse on the same branch. A step that takes some values more than once (a polynomial of degree 2 or more, for example) has no single inverse: the command says why and offers its preimages instead. The ⋯ menu's <b>Replace with derivative</b> turns a single step into its derivative <i>f</i>′ (a d/dz step differentiates the whole chain before it); both are in the search as <b>Inverse of <i>f</i><sub><i>k</i></sub></b> and <b>Derivative of <i>f</i><sub><i>k</i></sub></b>, and both can be undone.`],
    [`Integrals`, 0, `Hold a finger on a curve or a region's boundary in <i>X</i>, on its image in <i>Y</i>, or on its outline on the phase portrait, lift it, and choose <b>Integrate</b>: a popover gives ∫<sub><i>γ</i></sub> <i>F</i> d<i>z</i> with a plot of the running integral from 0; region boundaries go around with the region on their left. For a closed curve it adds (1/2π<i>i</i>) ∮ <i>F</i> d<i>z</i>, the winding number of <i>F</i>∘<i>γ</i> about 0 and the zeros and poles found inside: by the argument principle the winding number is zeros minus poles. The curve is highlighted with its direction while the popover is open. The phase portrait's <b>Cauchy</b> style paints the Cauchy integral over the selected closed curve: <i>F</i> inside, 0 outside.`],
    [`Sound`, 0, `<b>Sound</b>, in the ⋯ menu, is on by default and starts with your first tap; your choice stays on this device. Its Settings set the volume and what you hear: the interface and mathematical events (the deformation, a closed loop's winding number), both on by default, and <b>Hear the function under the pointer</b>, off until you turn it on; then hold a finger on a plane and slide it. It is a harp: silent while you rest, it plucks a note each time arg <i>F</i> crosses one of five phase lines (D, E, F♯, A, B), so a loop around a zero of order <i>m</i> plays a rising scale <i>m</i> times, around a pole a falling one, and the low Ds, counted up minus down, are the winding number. A closed loop then sings its winding number as one note (D for 0, F♯ for 1, A for 2, the A below for −1), and while the deformation plays, the last loop's note changes the moment a zero or pole crosses it.`],
    [`Guarantees`, 0, `The <b>F</b> tile at the end of the chain names what <i>F</i> is guaranteed to be. A property is named only when every step has it and composition preserves it, so it is always true; a property not named is not implied, though it may still hold. Tap the tile, and its editor shows <i>F</i> in closed form with Copy LaTeX, its natural domain, and Step by step: which step brings which property.`],
  ];
  const GUIDE_TOUCH_DEFORM = `On a phone, <b>Deformation</b> is the key at the end of the chain bar. While it plays, the row along the bottom holds Undo, play, the time <i>t</i>, the speed (tap it: 1×, 2×, ½×), Paths and ×; the plane's Display key holds the order, Loop and the deformed steps.`;
  function guideTouch(m) {
    const hs = [...m.querySelectorAll('h3')];
    // (a section may go by another name in a later build: 'Shared numbers|Numbers' finds either)
    const head = (name) => hs.find((x) => name.split('|').some((nm) => x.textContent.trim() === $t(nm))) || null;
    const paras = (hh) => {
      const out = [];
      const first = hh ? hh.nextElementSibling : (m.querySelector('.modal-head') || {}).nextElementSibling;
      for (let e = first; e && e.tagName !== 'H3'; e = e.nextElementSibling) if (e.tagName === 'P') out.push(e);
      return out;
    };
    for (const [sec, i, text] of GUIDE_TOUCH) {
      const hh = sec == null ? null : head(sec);
      if (sec != null && !hh) continue;
      const p = paras(hh)[i];
      if (p) p.innerHTML = $t(text);
    }
    const dh = head('Deformation');
    if (dh) { const p = document.createElement('p'); p.className = 'guide-touch'; p.innerHTML = $t(GUIDE_TOUCH_DEFORM); dh.after(p); }
    const kh = head('Keys');
    if (kh) { for (let e = kh.nextElementSibling; e && e.tagName !== 'H3';) { const nx = e.nextElementSibling; e.remove(); e = nx; } kh.remove(); }
  }
  function openGuide() {
    if (document.querySelector('.modal-bg')) return;
    const opener = document.activeElement, okey = focusKey(opener);
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const mod = mac ? '⌘' : 'Ctrl ';
    const onKey = (e) => {
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = [...m.querySelectorAll('button, [href], summary, [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        return;
      }
      // the dialog is modal: no app shortcut reaches the page behind it (Enter and Space still press its buttons)
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); focusBack(opener, okey); };
    document.addEventListener('keydown', onKey, true);
    const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } });
    const m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'guideTitle' });
    const k = (t) => t.split(' ').map((x) => `<span class="kbd">${x}</span>`).join(' ');
    const keys = [
      [k('V'), $t('Select and move shapes')], [`${k('P')} ${k('S')} ${k('L')} ${k('R')}`, $t('Point, segment, line, ray')],
      [`${k('C')} ${k('A')} ${k('F')}`, $t('Circle, arc, freehand')], [`${k('D')} ${k('B')} ${k('G')} ${k('O')}`, $t('Disc, rectangle, polygon, lasso')],
      [`${k('H')} ${k('N')} ${k('K')}`, $t('Half-plane, annulus, sector')], [k('T'), $t('Type a region formula')],
      [`${k('E')} ${k('I')} ${k('U')} ${k('Q')} ${k('W')} ${k('J')} ${k('Y')}`, $t('Construct: circle through 3 points, intersect, midpoint, bisector, orthogonal, touching, hyperbolic')], [k('Tab'), $t('On a focused plane: the next shape (⇧ Tab: the previous)')],
      [`${k(mod.trim() + ' K')}`, $t('Command palette')], [`${k(mod.trim() + ' E')}`, $t('Export figure')], [k('+'), $t('Add a function')],
      [`${k('1')} ${k('2')} ${k('3')}`, $t('View: X → Y, Phase, Landscape')], [k('M'), $t('Deformation on or off, in every view')], [k('⇧ M'), $t('Sound on or off')], [k('P'), $t('Deformation: paths on or off (in X → Y; else the Point tool)')],
      [`${k('⇧ 1')} ${k('⇧ 2')}`, $t('Plane, Sphere of X (in Phase: of the portrait)')], [`${k('⇧ 3')} ${k('⇧ 4')}`, $t('Plane, Sphere of Y')], [k('Z'), $t('Fit both planes')],
      [`${k('[')} ${k(']')}`, $t('Hide or show the side panels')], [k('?'), $t('This guide')],
      [`${k('F6')} ${k('⇧ F6')}`, $t('Next or previous area: top bar, tools, X, Y, chain, Inspector')], [`${k('←')} ${k('→')} ${k('↑')} ${k('↓')}`, $t('Move between the tools and the chain\'s cards')],
      [k('Delete'), $t('Remove the selected shape')], [k('Esc'), $t('Cancel a drawing or close a popover')],
      [k('Enter'), $t('Close a polygon')], [`${k(mod.trim() + ' Z')} ${k('⇧ ' + mod.trim() + ' Z')}`, $t('Undo, redo')],
    ];
    m.innerHTML = `
      <div class="modal-head"><svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" class="mark">${(document.querySelector('header svg.mark') || { innerHTML: '' }).innerHTML}</svg><h2 id="guideTitle">${$t('Using the Workbench')}</h2></div>
      <p>${$t(`Build a region in the <i>z</i>-plane, push it through a chain of functions <i>f</i><sub>1</sub>, <i>f</i><sub>2</sub>, …, and watch every intermediate image. The left pane is always <i>X</i>, the domain (or the input of a step shown alone), and the right pane always <i>Y</i>, its output: the left pane shows the shapes, the right pane their images.`)}</p>
      <h3>${$t(`Regions`)}</h3>
      <p>${$t(`Draw with the tools on the left, or type a set such as <span class="chip ftag" data-tex="|z-1|<2"></span> or <span class="chip ftag" data-tex="0<\\Im z<\\pi"></span>. Formulas accept <i>and</i>, <i>or</i>, <i>not</i>, commas, chained comparisons, and <i>x</i>, <i>y</i>, <i>r</i>, <i>θ</i>. An equation is a curve: <span class="chip ftag" data-tex="\\operatorname{Re} z=0"></span> is a line, <span class="chip ftag" data-tex="|z|=1,\\ \\operatorname{Im} z>0"></span> an arc; lines, rays, segments, circles and arcs become shapes with handles, other curves such as <span class="chip ftag" data-tex="|\\sin z|=1"></span> are traced exactly. A set or curve in <i>w</i> is a target of the <i>w</i>-plane. Unbounded regions are meshed far beyond the visible window, so their whole image appears on the right; the fill fades out where the mesh ends. The pattern is drawn in <i>z</i>-coordinates and carried along by the map, so every tile can be followed.`)}</p>
      <h3>${$t(`Function chain`)}</h3>
      <p>${$t(`Add a step with {x}, the add card, or a connector's insert button; type a formula such as <span class="chip ftag" data-tex="e^{z^2}"></span> in the palette to add it directly. Click a card to select it: the <b>Inspector</b> on the right edits it, with its formula in full, a field per coefficient and a ⋯ menu that replaces the step by its inverse, bypasses, moves, duplicates or removes it. A step's own coefficients are marked with its index (<i>a</i><sub>2</sub>); a plain letter is a number of the Numbers section. Double-click a card, or press <b>Show alone</b> in the Inspector, to show that step alone. Drag a card's header onto a connector, or press Alt+← or Alt+→, to reorder.`, { x: k('+') })}</p>
      <p>${$t(`Each card's picture follows the open view: card <i>k</i> shows <i>F</i><sub><i>k</i></sub>, the map up to its step, as an image in <i>X</i> → <i>Y</i>, a phase portrait in Phase and a relief in Landscape, so the last card is the main picture. The <b>F</b> tile closes the chain: see Guarantees.`)}</p>
      <p>${$t(`A typed formula that is a chain of catalog steps, such as <span class="chip ftag" data-tex="\\sin(z^2+1)"></span>, shows in the Inspector how it is built: <span class="chip ftag" data-tex="z\\mapsto z^2\\mapsto z^2+1\\mapsto \\sin(z^2+1)"></span>. <b>Split into steps</b> turns it into those steps, each with its own card and picture; Undo returns the formula. A sum or product of two functions of <i>z</i>, such as <span class="chip ftag" data-tex="z^2+\\sin z"></span>, is not a chain and stays one step. In the search, a formula that is one catalog function, such as sin z or z^i, adds that function directly.`)}</p>
      <h3>${$t(`Numbers`)}</h3>
      <p>${$t(`Type a new letter such as <i>a</i> in any field (a coefficient, a zero, a radius, a region formula such as Re <i>z</i> = <i>a</i>), and the number <i>a</i> appears under <b>Numbers</b> in the Inspector, with a slider and Play. Change it once, and everything that uses it follows. <b>Copy link to this figure</b>, in the Export menu, puts the whole figure in a link; <b>Save scene</b> and <b>Open scene</b> use a file.`)}</p>
      <p>${$t(`<b>d/dz</b> is a step too: it differentiates the chain so far, so [<i>f</i><sub>1</sub>, <i>f</i><sub>2</sub>, d/dz, <i>f</i><sub>3</sub>] maps <i>z</i> to <i>f</i><sub>3</sub>((<i>f</i><sub>2</sub> ∘ <i>f</i><sub>1</sub>)′(<i>z</i>)), and two in a row give the second derivative. Every view shows it like any other step; focused, its left plane is the <i>z</i>-plane.`)}</p>
      <h3>${$t(`Branch cuts`)}</h3>
      <p>${$t(`Logarithms, roots and complex powers cut along a ray from 0. Drag the seam's handle in the step's input plane (<i>X</i> for the first step, else show the step alone); it snaps to 15° with Shift. The hatched side is the side the cut belongs to. The sheet number, in the Inspector, picks the branch.`)}</p>
      <p>${$t(`<i>Zeros and poles</i> (in Polynomial &amp; custom) is the map <i>a</i>∏(<i>z</i> − ζ<sub><i>k</i></sub>)/∏(<i>z</i> − <i>p<sub>j</sub></i>). Its zeros (dots) and poles (crosses) are handles in its input plane (X for the first step, else show the step alone): drag them, or add one with <b>Add zero</b> and <b>Add pole</b> in the Inspector, with Shift-click (a zero) or Shift-⌘-click (Shift-Ctrl, a pole). Drag one off the plane, or select it and press Delete, to remove it. A polynomial or rational step can be rewritten this way from its <b>⋯</b> menu, and back.`)}</p>
      <h3>${$t(`The planes' menu`)}</h3>
      <p>${$t(`Right-click a zero or a pole, a shape or a cut handle (hold it on touch; Shift+F10 from the keyboard) for its menu. Its head gives the point and the map there; below come the actions for that object: Remove, Turn into a pole (or a zero) and Edit for a mark, Reset the cut for a cut handle, and for a shape its line integral and Listen along, Hide, Delete and the constructions that act on it, such as Mark the intersection and Make free. An empty plane has no menu: a right-drag pans it. While you draw (a polygon's vertices, a construction's picks, a shape you are dragging out), a right-click cancels the drawing, as Esc does. <b>Double-click</b> an empty spot of a plane to center the view there.`)}</p>
      <h3>${$t(`Views`)}</h3>
      <p>${$t(`The switch in the middle of the top bar picks the view ({x} {x2} {x3}). <b><i>X</i> → <i>Y</i></b> shows the two planes side by side: the shapes on the left, their images on the right, each pane with its own <b>Plane · Sphere</b> switch ({x4} {x5} for the left pane, {x6} {x7} for the right). The right plane has a derivative gauge under the probe. <b>Phase</b> is one wide panel that colours each point of <i>X</i> by arg <i>F</i>, with modulus contours, on the plane or on the Riemann sphere; the shapes are outlined. <b>Landscape</b> is one wide panel that lifts |<i>F</i>| over <i>X</i> into a surface, in the phase colours or in plaster: zeros are pits, poles are peaks; for a map with a branch cut, <b>All sheets</b> draws its sheets instead of the cut principal branch (all of them when there are finitely many, else a window of them; best with height Re <i>F</i> or Im <i>F</i>). Each view keeps its own camera and plane view. <b>Sphere</b> places a pane on the Riemann sphere, with ∞ at the north pole. You draw on it as in the plane (shapes on the left, targets on the right; Annulus, Sector and Polar grid draw in Plane only): a Disc or Circle is a cap of the sphere, and one whose rim passes ∞ becomes a half-plane or a line. With Select, drag a shape to move it (over ∞ it changes kind) and empty space to turn the globe; in every tool the middle button, Space held or two fingers turn it. The <b>Phase key</b> check in the right plane's options of <i>X</i> → <i>Y</i> paints the portrait's colours under it, so a colour of the portrait reads off as a value of <i>w</i>.`, { x: k('1'), x2: k('2'), x3: k('3'), x4: k('⇧ 1'), x5: k('⇧ 2'), x6: k('⇧ 3'), x7: k('⇧ 4') })}</p>
      <h3>${$t(`Deformation`)}</h3>
      <p>${$t(`<b>Deformation</b> in the top bar ({x}) plays the homotopy from <i>z</i> to <i>F</i>(<i>z</i>), step by step, in every view. In <i>X</i> → <i>Y</i> the two panes merge into one plane (one globe when the right pane shows its Sphere): <i>X</i> in grey, the moving image <i>H</i><sub><i>t</i></sub>(<i>X</i>), and the paths <i>t</i> ↦ <i>H</i><sub><i>t</i></sub>(<i>z</i>) of well-spread points. In Phase and Landscape it paints <i>H</i><sub><i>t</i></sub>. Each step deforms along its natural path: <i>H</i><sub><i>t</i></sub> starts at the identity, ends at the map and, when the step is analytic, is analytic for every <i>t</i>. Möbius maps move along their one-parameter groups; powers and roots <i>z</i><sup><i>a</i></sup> along <i>z</i><sup>1+(<i>a</i>−1)<i>t</i></sup> (a negative integer power reaches <i>z</i><sup>|<i>a</i>|</sup> at <i>t</i> = ½, then 1/<i>z</i><sup>|<i>a</i>|</sup> through Möbius maps); log along (<i>z</i><sup>1−<i>t</i></sup> − 1)/(1 − <i>t</i>) + 1 − <i>t</i>; exp, sin, cos, tan, the hyperbolic functions and the inverse trigonometric and hyperbolic functions are zoomed into, so their zeros, poles and cuts fly in from infinity (sin(<i>tz</i>)/<i>t</i>); polynomials, rational maps and any other analytic formula are zoomed into about a point <i>p</i>, so their critical points, poles and cuts fly in from infinity along the rays from <i>p</i>; Joukowski closes the unit circle onto [−1, 1]. A formula that is not analytic, a constant, or an analytic formula with no usable point <i>p</i> to zoom about moves along the straight line, and conjugation squashes the plane onto the real axis and out again, mirrored: Re <i>z</i> + <i>i</i>(1 − 2<i>t</i>) Im <i>z</i>. The transport under the panel scrubs <i>t</i> and sets the speed and, for two or more steps, the order: one after another (0 ≤ <i>t</i> ≤ <i>m</i>) or all at once (0 ≤ <i>t</i> ≤ 1, every step at the same <i>t</i>). <b>Paths</b> ({x2}) shows or hides the paths. Turning the deformation off splits the panes again and returns to <i>t</i> at the end. A focused step deforms that step only.`, { x: k('M'), x2: k('P') })} ${guideTex($t('A step shown alone deforms in its own planes; to see it deform inside $F$, bracket it (below).'))}</p>
      <p>${guideTex($t('<b>Part of the chain.</b> While the deformation shows the whole chain, a bracket stands over the cards. Drag its ends, or choose a card\'s ⋯ → <b>Deformation</b>; on a phone, use Deformed steps in the Display sheet. Steps before the bracket act first and in full, steps after it last and in full: $H_t=f_3\\circ G_t\\circ f_1$ runs from $f_3\\circ f_1$ at $t=0$ to $F$, while $G_t$ deforms the bracketed steps. Bracket the last steps to watch them deform the image $f_1(X)$ (a push-forward); bracket the first steps to watch them deform under the last ones (a pullback: for $\\sqrt{z}$ then $f$, bracket $\\sqrt{z}$ to go from $f(z)$ to $f(\\sqrt{z})$). The start is outlined, and the plane\'s title names it.'))}</p>
      <h3>${$t(`Preimages and roots`)}</h3>
      <p>${$t(`Hover a point <i>w</i> of the right pane (its plane or its sphere): the left plane marks every <i>z</i> in view with <i>F</i>(<i>z</i>) = <i>w</i>, and its readout counts them. In its plane the drawing tools also work in the right pane: what you draw there is a <i>target</i> in the <i>w</i>-plane. In every view the left plane shades every <i>z</i> with <i>F</i>(<i>z</i>) in a target area and traces the curves <i>F</i>(<i>z</i>) on a target curve; a target point <i>p</i> marks the solutions of <i>F</i>(<i>z</i>) = <i>p</i> as <i>z</i><sub>1</sub>, <i>z</i><sub>2</sub>, … with their multiplicity, and the poles of <i>F</i> (a target at 0 shows the roots). Targets are listed under the shapes and can be edited, hidden or deleted.`)}</p>
      <h3>${$t(`Inverses and derivatives`)}</h3>
      <p>${$t(`<b>Replace with the inverse</b>, in a step's ⋯ menu in the Inspector, replaces the step by its inverse on the same branch. A step that takes some values more than once (a polynomial of degree 2 or more, for example) has no single inverse: the command says why and offers its preimages instead. The ⋯ menu's <b>Replace with derivative</b> turns a single step into its derivative <i>f</i>′ (a d/dz step differentiates the whole chain before it); both are in the palette as <b>Inverse of <i>f</i><sub><i>k</i></sub></b> and <b>Derivative of <i>f</i><sub><i>k</i></sub></b>, and both can be undone.`)}</p>
      <h3>${$t(`Integrals`)}</h3>
      <p>${$t(`Right-click a curve or a region's boundary (hold it on touch) in the left plane, its image in the right plane, or its outline on the phase portrait, and choose <b>Integrate</b>: a popover gives ∫<sub><i>γ</i></sub> <i>F</i> d<i>z</i> with a plot of the running integral from 0; region boundaries go around with the region on their left. For a closed curve it adds (1/2π<i>i</i>) ∮ <i>F</i> d<i>z</i>, the winding number of <i>F</i>∘<i>γ</i> about 0 and the zeros and poles found inside: by the argument principle the winding number is zeros minus poles. The curve is highlighted with its direction while the popover is open. The phase portrait's <b>Cauchy</b> style paints the Cauchy integral over the selected closed curve: <i>F</i> inside, 0 outside.`)}</p>
      <h3>${$t(`Sound`)}</h3>
      <p>${$t(`<b>Sound</b> in the top bar ({x}) is on by default and starts with your first click or key; your choice stays on this device. Its caret sets the volume and what you hear: the interface and mathematical events (the deformation, a closed loop's winding number), both on by default, and <b>Hear the function under the pointer</b>, off until you turn it on. It is a harp: silent while you rest, it plucks a note each time arg <i>F</i> crosses one of five phase lines (D, E, F♯, A, B), so a loop around a zero of order <i>m</i> plays a rising scale <i>m</i> times, around a pole a falling one, and the low Ds, counted up minus down, are the winding number. A closed loop then sings its winding number as one note (D for 0, F♯ for 1, A for 2, the A below for −1), and while the deformation plays, the last loop's note changes the moment a zero or pole crosses it. {x2} stops anything playing. With the keyboard, Tab to the left plane: the arrows move a probe, {x3} goes to the next zero or pole, {x4} gives the order there, {x5} describes the view, {x6} draws a loop and {x7} listens along it. With a screen reader in browse mode, use the button: {x} may not reach the page.`, { x: k('⇧ M'), x2: k('Esc'), x3: k('Z'), x4: k('O'), x5: k('D'), x6: k('Enter'), x7: k('L') })}</p>
      ${EX.some((ex) => exOk(ex) && ex.shapes.some((sh) => sh.listen)) ? `<p>${$t(`<b>A curve as a melody.</b> <b>Listen along</b>, in a curve's menu, plays the harp along the curve at an even pace: arg <i>F</i> is the pitch, each phase line it crosses plucks that line's string, crossing back plucks it again and a leap runs over the strings between, and |<i>F</i>| sets the register (lower near zeros, higher near poles). A closed loop's last note is its winding number. The example “In the Hall of the Mountain King” (after Edvard Grieg) is a single curve: at constant speed each turn of its spiral is shorter, so the theme speeds up by itself, and each time it crosses the branch cut the drum sounds. This example has its own strings, one for each note Grieg wrote: only those notes and the drum sound, each in its written octave.`)}</p>
      <p style="display:flex;align-items:center;gap:12px"><img class="guide-piece" alt="" width="96" height="64" style="flex:none;border-radius:6px;border:1px solid var(--line);background:var(--well)"><button class="btn" type="button" data-play="piece">${$t('Open and play “In the Hall of the Mountain King”')}</button></p>` : ''}
      <h3>${$t(`Guarantees`)}</h3>
      <p>${$t(`The <b>F</b> tile at the end of the chain names what <i>F</i> is guaranteed to be. A property is named only when every step has it and composition preserves it, so it is always true; a property not named is not implied, though it may still hold. Select the tile, and the Inspector shows <i>F</i> in closed form with Copy LaTeX, its natural domain, and Step by step: which step brings which property.`)}</p>
      <h3>${$t(`Keys`)}</h3>
      <table class="keys">${keys.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>${I18N.lang === 'en' ? '' : `<p>${$t('Letter keys work in any keyboard layout: what counts is the key, not the letter it types.')}</p>`}`;
    if (touchUI()) guideTouch(m);   // (v16.5 UX17)
    for (const el of m.querySelectorAll('[data-tex]')) TeX.set(el, el.dataset.tex);
    const pb = m.querySelector('[data-play="piece"]');
    if (pb) pb.addEventListener('click', () => { close(); sndPlayPiece(); });
    // the example's picture (the spiral, its cut): its gallery thumbnail, drawn by the real renderer once its programs
    // are compiled
    const pim = m.querySelector('img.guide-piece'), pi = EX.findIndex((ex) => exOk(ex) && ex.shapes.some((sh) => sh.listen));
    const putPic = (n) => { if (!pim.isConnected && n < 12) return; const u = renderExampleThumb(pi); if (u) pim.src = u; else if (n > 0) setTimeout(() => putPic(n - 1), 250); };
    if (pim && pi >= 0) putPic(12);
    m.append(h('div', { class: 'modal-foot' }, h('button', { class: 'btn primary', onclick: close }, $t('Close'))));
    bg.append(m);
    document.body.append(bg);
    m.querySelector('.btn.primary').focus({ preventScroll: true });
  }

  // ---------------- left-panel display controls ----------------
  const PATTERNS = [
    ['checker', $t('Checker'), $t('Checkerboard in z-coordinates: shows how squares are bent and scaled')],
    ['polar', $t('Log-polar'), $t('Checkerboard in log|z| and arg z: conformal maps keep these cells square')],
    ['tiles', $t('Tiles'), $t('Tiles with an F glyph: shows rotation, scaling and reflection')],
    ['grid', $t('Square grid'), $t('Cartesian grid lines of z carried by the map')],
    ['polargrid', $t('Polar grid'), $t('Circles |z| = const and rays arg z = const carried by the map')],
    ['phase', $t('Arg z'), $t('Colored by the argument of the source point z')],
    ['stretch', $t('Stretch'), $t('Local scale factor |F′(z)|: blue shrinks, amber grows')],
    // (the count follows the pattern size: sphN() longitude cells by sphN() / 2 latitude cells, 128 at size ×1)
    ['sphere', $t('Sphere checker'), () => $tn('Longitude and latitude cells of the Riemann sphere: {n} cells cover the plane and ∞', 'Longitude and latitude cells of the Riemann sphere: {n} cells cover the plane and ∞', sphN() * sphN() / 2)],
    ['solid', $t('Solid'), $t('Flat fill')],
  ];
  // live swatches (spec 6.4) in the first shape color's tokens (c0, alt, edge): the accent stays for the selection
  // ring, Stretch uses the stretch tokens (no red) and Phase the OKLCH wheel of the Phase tab
  function drawPatternSwatch(cv, id) {
    const x = cv.getContext('2d');
    const W = 52, H = 40, sc = cv.width / W; // 104×80 device px for a 52×40 swatch
    x.setTransform(sc, 0, 0, sc, 0, 0);
    const ink = TH.c[0], c0 = ink.c0, c1 = ink.alt, k = ink.edge;
    const mix = (p, q, t) => { const a = GLR.hexRGB(p), b = GLR.hexRGB(q); return `rgb(${a.map((v, i) => Math.round(255 * (v + (b[i] - v) * t))).join(',')})`; };
    x.fillStyle = c1; x.fillRect(0, 0, W, H);
    if (id === 'checker') {
      const c = 8;
      x.fillStyle = c0;
      for (let i = 0; i < W / c; i++) for (let j = 0; j < H / c; j++) if ((i + j) % 2 === 0) x.fillRect(i * c, j * c, c, c);
    } else if (id === 'tiles') {
      // a 4×3 checker of c1 and mix(c1, c0, 0.35), large enough for the F (stem, top bar, middle bar; y up)
      const c = 13;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const ox = i * c, oy = j * c;
        if ((i + j) % 2 === 0) { x.fillStyle = mix(c1, c0, 0.35); x.fillRect(ox, oy, c, c); }
        x.fillStyle = k;
        const box = (u0, u1, v0, v1) => x.fillRect(ox + u0 * c, oy + (1 - v1) * c, (u1 - u0) * c, (v1 - v0) * c);
        box(0.30, 0.42, 0.18, 0.82); box(0.30, 0.72, 0.70, 0.82); box(0.30, 0.62, 0.46, 0.56);
      }
    } else if (id === 'polar' || id === 'polargrid') {
      const cx = W * 0.25, cy = H * 0.9;
      x.lineWidth = 1;
      for (let r = 2, n = 0; r < 70; r *= 1.48, n++) {
        for (let q = 0; q < 16; q++) {
          if (id === 'polar' && (n + q) % 2) continue;
          x.beginPath();
          x.arc(cx, cy, r * 1.48, -q * Math.PI / 8, -(q + 1) * Math.PI / 8, true);
          x.arc(cx, cy, r, -(q + 1) * Math.PI / 8, -q * Math.PI / 8, false);
          x.closePath();
          if (id === 'polar') { x.fillStyle = c0; x.fill(); }
        }
        if (id === 'polargrid') { x.strokeStyle = c0; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); }
      }
      if (id === 'polargrid') {
        x.strokeStyle = k;
        for (let q = 0; q < 24; q++) {
          const a = q * 15 * DEG, axis = q % 6 === 0;
          x.globalAlpha = axis ? 1 : 0.7; x.lineWidth = axis ? 1.75 : 1;
          x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + 80 * Math.cos(a), cy - 80 * Math.sin(a)); x.stroke();
        }
        x.globalAlpha = 1;
      }
    } else if (id === 'grid') {
      // Re lines 1.25px k, Im lines 1px c0, every 5th +0.5px
      for (let i = 0, n = 0; i <= W; i += 8, n++) { x.strokeStyle = k; x.lineWidth = n % 5 ? 1.25 : 1.75; x.beginPath(); x.moveTo(i + 2, 0); x.lineTo(i + 2, H); x.stroke(); }
      for (let j = 0, n = 0; j <= H; j += 8, n++) { x.strokeStyle = c0; x.lineWidth = n % 5 ? 1 : 1.5; x.beginPath(); x.moveTo(0, j + 4); x.lineTo(W, j + 4); x.stroke(); }
    } else if (id === 'phase') {
      // wheel(arg s, L) with L = 0.62 + 0.14·saw(ln|s| / (π/6)), as the shader does
      x.setTransform(1, 0, 0, 1, 0, 0);
      const PW = cv.width, PH = cv.height, img = x.createImageData(PW, PH), u = 14 * sc; // 14 CSS px per unit
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        const re = (i + 0.5 - PW / 2) / u, im = (PH / 2 - j - 0.5) / u;
        const lr = Math.log(Math.hypot(re, im) || 1e-9) / (Math.PI / 6);
        const rgb = GLR.phaseRGB(Math.atan2(im, re), 0.62 + 0.14 * (lr - Math.floor(lr)));
        const o = 4 * (j * PW + i); img.data[o] = rgb[0] * 255; img.data[o + 1] = rgb[1] * 255; img.data[o + 2] = rgb[2] * 255; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } else if (id === 'sphere') {
      // the spherical checker about 0 (SPEC 6.3): 16 longitude sectors, latitude rings at |z| = tan(j pi / 16)
      x.setTransform(1, 0, 0, 1, 0, 0);
      const PW = cv.width, PH = cv.height, img = x.createImageData(PW, PH), u = 15 * sc, a = GLR.hexRGB(c0), b = GLR.hexRGB(c1);
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        const re = (i + 0.5 - PW / 2) / u, im = (PH / 2 - j - 0.5) / u;
        const th = Math.atan2(im, re), lat = 2 * Math.atan(Math.hypot(re, im));
        const par = (Math.floor(th * 16 / TAU) + Math.floor(lat * 8 / Math.PI)) & 1, c = par ? b : a;
        const o = 4 * (j * PW + i); img.data[o] = c[0] * 255; img.data[o + 1] = c[1] * 255; img.data[o + 2] = c[2] * 255; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } else if (id === 'stretch') {
      const g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, TH.stretchShrink); g.addColorStop(0.5, TH.stretchMid); g.addColorStop(1, TH.stretchGrow);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    } else {
      x.fillStyle = c0; x.fillRect(0, 0, W, H);
    }
  }
  function buildDisplay() {
    const pat = $('patternSeg');
    pat.innerHTML = '';
    for (const [v, l, tip] of PATTERNS) {
      const cv = h('canvas', { width: 104, height: 80, 'aria-hidden': 'true' });
      const b = h('button', { class: 'pat' + (S.pattern === v ? ' on' : ''), role: 'radio', 'aria-checked': String(S.pattern === v), 'data-pat': v, 'data-tip': typeof tip === 'function' ? tip() : tip, 'aria-label': l,
        onclick: () => { S.pattern = v; buildDisplay(); requestRender('L', 'R', 'T'); save(); tourEmit('pattern-changed', { id: S.pattern }); } }, cv, h('span', null, l));
      pat.append(b);
      drawPatternSwatch(cv, v);
    }
    const ps = Math.round(Math.log2(S.patternScale || 1));
    $('patScale').value = ps;
    $('patScaleVal').textContent = ps === 0 ? '×1' : ps > 0 ? `×${2 ** ps}` : `×1/${2 ** -ps}`;
    $('meshRange').min = 0; $('meshRange').max = 1000; $('meshRange').step = 1;
    $('meshRange').value = meshToPos(S.meshN);
    showMeshVal(S.meshN);
    $('linesChk').checked = !!S.lines;
    $('chevChk').checked = !!S.chev;
    $('unitChk').checked = S.unit !== false;
    $('alphaRange').value = S.alpha;
    $('alphaVal').textContent = I18N.num(S.alpha.toFixed(2));
    for (const r of document.querySelectorAll('input[type=range]')) paintFader(r);
  }
  // filled part of a fader track (CSS reads --fill)
  function paintFader(r) {
    const lo = +r.min || 0, hi = r.max === '' ? 100 : +r.max, v = +r.value;
    const fill = `${((v - lo) / (hi - lo || 1)) * 100}%`;
    r.style.setProperty('--fill', fill);
    if (r.closest('.tscrub')) r.closest('.tscrub').style.setProperty('--fill', fill);
  }

  // below 1280 px the guarantees panel is an overlay drawer, below 1024 px the tools panel too
  // (v15: the Inspector never is a drawer: it docks at 264 px from 1024, under the chain from 768 to 1023)
  const isDrawer = (side) => (side === 'R' ? false : window.innerWidth < 1024) && window.innerWidth >= 768;
  // from 1024 to 1279 one side panel docks at a time (DESIGN.md 4)
  const oneDock = () => window.innerWidth >= 1024 && window.innerWidth < 1280;
  function setPanels(hideL, hideR) {
    const reqL = !!hideL, reqR = !!hideR;
    // only one drawer at a time when both panels are drawers
    if ((isDrawer('L') && isDrawer('R')) || oneDock()) {
      if (!hideL && S.hideLeft) hideR = true;
      else if (!hideR && S.hideRight) hideL = true;
    }
    // (review regress-1: a panel the one-dock rule closed is closed at run time only; the user's choice stays)
    const forcedL = !!hideL && !reqL, forcedR = !!hideR && !reqR;
    if (sndP.on && (!!hideL !== !!S.hideLeft || !!hideR !== !!S.hideRight)) sndToggleCue(!(hideL && hideR) && (!hideL && S.hideLeft || !hideR && S.hideRight));
    S.hideLeft = !!hideL; S.hideRight = !!hideR;
    // only a choice made where the panel docks is the user's preference; drawers are run-time state
    if (!isDrawer('L') && !forcedL) dockPref.L = S.hideLeft;
    if (!isDrawer('R') && !forcedR) dockPref.R = S.hideRight;
    applyLayout();
    save();
  }
  function closeDrawers() {
    const l = isDrawer('L') && !S.hideLeft, r = isDrawer('R') && !S.hideRight;
    if (l || r) { setPanels(S.hideLeft || l, S.hideRight || r); return true; }
    return false;
  }
  function setSolo(which) {
    if (Views.merged(S.view, morphOn())) return; // a merged view is one panel: nothing to expand
    S.solo = S.solo === which ? null : which;
    applyLayout();
    save();
  }
  function applyLayout() {
    const lay = document.querySelector('.layout');
    placeKeys();
    if (oneDock() && !S.hideLeft && !S.hideRight) S.hideLeft = true;   // (run time: the docked choice stays the user's)
    if (!S.hideRight) closeTemp(); else requestRender('P');
    // ([v17 D4] the selected shape's editor follows the Inspector: in it while it shows, under its row when hidden)
    if (shapeEdWhere !== inspEditsShapes()) { shapeEdWhere = inspEditsShapes(); if (selected != null) buildShapeList(); }
    lay.classList.toggle('hide-left', !!S.hideLeft);
    lay.classList.toggle('hide-right', !!S.hideRight);
    $('toggleLeft').setAttribute('aria-pressed', String(!S.hideLeft));
    $('toggleRight').setAttribute('aria-pressed', String(!S.hideRight));
    $('pipeline').classList.toggle('compact', !!S.compact);
    setSeg($('chainMode'), S.compact ? 'compact' : 'cards');
    const panes = document.querySelector('.panes');
    // merged views (merged-views.md): one wide panel, the other pane hidden (on a phone too) and no expand button,
    // so it reads as a view of its own, not an expanded pane
    const one = solo(), mg = Views.merged(S.view, morphOn());
    panes.classList.toggle('solo-L', one === 'L');
    panes.classList.toggle('solo-R', one === 'R');
    panes.classList.toggle('merged-L', mg === 'L');
    panes.classList.toggle('merged-R', mg === 'R');
    for (const [id, w] of [['leftSolo', 'L'], ['rightSolo', 'R']]) {
      const b = $(id);
      b.hidden = !!mg;
      b.setAttribute('aria-pressed', String(S.solo === w));
      b.setAttribute('data-tip', S.solo === w ? $t('Show both planes') : $t('Expand plane')); b.removeAttribute('title');
      b.innerHTML = S.solo === w ? ICONS.restore : ICONS.expand;
    }
    syncModeChips();
    if (mg !== layoutMg || one !== layoutOne) { layoutMg = mg; layoutOne = one; if (paneL && paneR) onPaneResize(); requestRender('L', 'R', 'OL', 'OR'); }
  }
  let layoutMg = null, layoutOne = null;
  // the panes' canvases follow their boxes (the ResizeObserver, and a layout change at once: a merge or a split
  // must not leave a frame, a fit or a mesh to be made at the old width)
  function onPaneResize() {
    const a = paneL.resize(), b = paneR.resize();
    $('paneR').classList.toggle('narrow', $('paneR').getBoundingClientRect().width < 520);
    $('paneL').classList.toggle('narrow', $('paneL').getBoundingClientRect().width < 520);
    syncViewControls();
    fitRightTitle();
    if (a && leftStage() > 0 && leftAuto && solo() !== 'R') { paneL.setView(V.left); fitPane(paneL, leftStage()); }
    if (a || b) {
      // (a merged view widens one pane: its options strip re-flows at the new width; a hidden pane is not fitted)
      layoutFoot();
      sourceViewChanged();
      if (rightAuto && rImage() && solo() !== 'L') fitRight();
      requestRender('L', 'R', 'T');
      sndRelayout();   // (sound: the plane under a still pointer moved)
    }
  }

  // the mesh fader is piecewise logarithmic so each named stop sits on its tick
  // Draft, Normal, Fine, Ultra, Max
  const MESH_STOPS = [160, 240, 480, 960, 1920];
  function posToMesh(p) {
    const seg = Math.max(0, Math.min(3, Math.floor(p / 250))), t = (p - seg * 250) / 250;
    const a = MESH_STOPS[seg], b = MESH_STOPS[seg + 1];
    return Math.round(Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t) / 10) * 10;
  }
  function meshToPos(n) {
    n = Math.max(MESH_STOPS[0], Math.min(MESH_STOPS[4], n));
    for (let i = 0; i < 4; i++) { const a = MESH_STOPS[i], b = MESH_STOPS[i + 1]; if (n <= b) return Math.round(i * 250 + 250 * Math.log(n / a) / Math.log(b / a)); }
    return 1000;
  }
  function showMeshVal(n) {
    $('meshVal').textContent = `${n}`;
    for (const b of document.querySelectorAll('#meshPresets button')) b.classList.toggle('on', +b.dataset.n === n);
    $('meshNote').hidden = n < 480;
    paintFader($('meshRange'));
  }
  function setMesh(n) {
    n = Math.max(MESH_MIN, Math.min(MESH_MAX, Math.round(n)));
    if (n === S.meshN) return;
    S.meshN = n;
    dropAllGPU();
    $('meshRange').value = meshToPos(n);
    showMeshVal(n);
    if (rightAuto && rImage()) fitRight();
    requestRender('L', 'R', 'T');
    save();
  }

  // the views (merged-views.md): the top bar's switch X → Y · Phase · Landscape (keys 1-3 by e.code), the panes'
  // Plane | Sphere switches in their heads (Shift 1, 2: the left or only panel, X or the portrait; Shift 3, 4: Y),
  // and the Deformation toggle (M), which modifies the active view. The preimages and the integrals are parts of every
  // view.
  const SURF = {
    L: [['plane', $t('Plane'), '⇧1'], ['sphere', $t('Sphere'), '⇧2']],
    R: [['plane', $t('Plane'), '⇧3'], ['sphere', $t('Sphere'), '⇧4']],
  };
  const MAINS = [['xy', 'X → Y', '1', '<i>X</i><span class="arr"> → </span><i>Y</i>'], ['phase', $t('Phase'), '2', $t('Phase')], ['land', $t('Landscape'), '3', $t('Landscape')]];
  const VIEW_ICONS = { plane: MODE_ICONS.image, sphere: MODE_ICONS.sphere, land: MODE_ICONS['3d'], phase: MODE_ICONS.color, xy: MODE_ICONS.xy };
  // the globes' static programs, started in the background when a switch to Sphere is coming (the pointer or focus on
  // a Sphere control, the switch itself a frame ahead of its draw), so the first globe frame does not link them one
  // after another (GLR.prestart; P3 review: 51-55 ms long tasks on the first switch to X Sphere). Not at start-up:
  // compiles there compete with the first scene's own (example settle times)
  function prestartGlobe() { try { if (GLR.ok && GLR.prestart) GLR.prestart(['sphere', 'regionSC', 'lineSC', 'disc', 'mark']); } catch (e) { /* the frame links them */ } }
  // side 'L': X's surface in the active view (X → Y's left pane or the phase panel); 'R': Y's (X → Y)
  function setView(side, surf) {
    if (side === 'L' && lLand()) return;
    const v = side === 'L' ? xView() : S.view.R;
    if (!v || v.surf === surf || !(side === 'L' ? Views.SURF_L : Views.SURF_R).includes(surf)) return;
    if (surf === 'sphere') prestartGlobe();
    v.surf = surf;
    viewChanged(side);
  }
  // Each view keeps its own plane view and cameras (merged-views.md): X → Y and Phase both show X's plane and globe,
  // so the plane view (S.srcView, and V.left at a focused stage) and the z-globe's camera are swapped on a switch; the
  // landscape (cam) and the w-globe (camS) belong to one view each already. A view seen for the first time starts from
  // the one it was switched from.
  const viewMem = {};
  const camKeys = (c) => ({ yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx || 0, ty: c.ty || 0, tz: c.tz || 0, fov: c.fov });
  function setMain(main) {
    if (!Views.MAIN.includes(main) || S.view.main === main) return;
    phHold();
    const from = S.view.main;
    soundCue('view', { k: Views.MAIN.indexOf(main) });
    if (main !== 'land' && (main === 'phase' ? S.view.P.surf : S.view.L.surf) === 'sphere') prestartGlobe();
    cancelTweens();
    viewMem[from] = { src: Object.assign({}, S.srcView), left: Object.assign({}, V.left), leftAuto, camL: camKeys(camL) };
    S.view.main = main;
    const m = viewMem[main];
    if (m) {
      Object.assign(S.srcView, m.src); Object.assign(V.left, m.left); leftAuto = m.leftAuto;
      Object.assign(camL, m.camL, { vyaw: 0, vpitch: 0 });
    }
    // an example's box (ex.fit), untouched since it opened, fits the X pane of a view seen for the first time (review ui-3)
    const refit = !m && exFitKey && exFitKey === JSON.stringify(S.srcView) && EX[currentExample] && EX[currentExample].fit;
    // a shape draft and the probe end with the view they were made in; targets are edited in Y (X → Y only)
    draft = null; probe = null; hoverCut = 0; setReadouts(null);
    rHover = null; setHoverW(null);
    applyLayout();
    if (refit) { exFitTo(EX[currentExample]); paneL.setView(S.srcView); }
    sndRelayout();
    buildShapeList();
    updateFocusUI(); scheduleFix(); requestRender('L', 'R', 'OL', 'OR'); save();
    tourEmit('view-changed', { main });
  }
  // U-b's Phase toggle, kept for the test hooks: on, the Phase view on X's surface; off, X → Y on the phase panel's
  function setPhase(on) {
    if (!!on === (S.view.main === 'phase')) return;
    if (on) { if (S.view.main === 'xy') S.view.P.surf = S.view.L.surf; setMain('phase'); }
    else { S.view.L.surf = S.view.P.surf; setMain('xy'); }
  }
  function viewChanged(side) {
    if (side === 'R') {
      // targets are drawn and edited in Y Plane; a target draft and a target selection end with it (the transport
      // stays open)
      // targets are drawn in Y Plane and on the w-globe (P3b): a target draft ends with the view it was drawn in
      if (draft && draft.target) draft = null;
      rHover = null; setHoverW(null);
      if (autoFit()) { rightAuto = true; fitRight(); }
      buildShapeList();
    } else {
      // a shape draft ends with the view it was drawn in (the plane or the z-globe); the flat probe goes
      draft = draft && draft.target ? draft : null;
      if (!lFlat()) { probe = null; hoverCut = 0; setReadouts(null); }
    }
    updateFocusUI(); scheduleFix(); requestRender('L', 'R'); save();
  }
  // the head controls show the state
  function syncViewControls() {
    const main = S.view.main;
    setSeg($('viewSwitch'), main);
    setSeg($('leftTabs'), xView().surf);
    setSeg($('rightTabs'), S.view.R.surf);
    // the landscape is its own surface: no Plane | Sphere in its head
    const lt = $('leftTabs'); if (lt && lt.parentElement.hidden !== lLand()) lt.parentElement.hidden = lLand();
    if (lt) { const al = main === 'phase' ? $t('Phase portrait surface') : $t('Left pane surface'); if (lt.getAttribute('aria-label') !== al) lt.setAttribute('aria-label', al); }
    // X's switch (X → Y's left pane, the phase panel) takes Shift 1, 2; Y's takes Shift 3, 4
    for (const b of lt ? lt.children : []) { const k = b.dataset.mode === 'plane' ? '⇧1' : '⇧2'; const tip = `${b.getAttribute('aria-label')}${k ? '  ' + k : ''}`; if (b.dataset.tip !== tip) b.dataset.tip = tip; }
    // the view names the map in focus (P13)
    const vs = $('viewSwitch');
    if (vs) for (const b of vs.children) {
      const F = fnText(), tip = { xy: $t(`X → Y: the shapes and their images  1`), phase: $t('Phase portrait of {F}  2', { F }), land: $t('Landscape of {F}  3', { F }) }[b.dataset.mode];
      if (b.dataset.tip !== tip) b.dataset.tip = tip;
    }
    // the Deformation toggle: pressed while the transport is open; with no active step it explains instead of acting
    const mb = $('morphBtn');
    if (mb) {
      const can = morphRange().steps.length > 0;
      mb.setAttribute('aria-pressed', String(!!morph.open));
      mb.setAttribute('aria-disabled', String(!can && !morph.open));
      const tip = !can && !morph.open ? (S.focus > 0 ? $t('This step is off: turn it on to deform') : $t('Add a function to deform')) : morph.open ? $t('Close the deformation  M') : $t('Deformation of {F}  M', { F: S.focus > 0 ? fnText() : 'F' });
      if (mb.dataset.tip !== tip) mb.dataset.tip = tip;
    }
  }
  // Snap (the Draw heading and the rail) and Unit circle (Display) show the state (P3)
  function syncSnapUnit() {
    for (const id of ['snapBtn', 'railSnap']) { const b = $(id); if (b) b.setAttribute('aria-pressed', String(!!S.snap)); }
    const u = $('unitChk');
    if (u && u.checked !== !!S.unit) u.checked = !!S.unit;
  }
  // P4: a drawing tool pressed in X at focus k >= 2 draws nothing; the Whole chain button pulses once
  function pulseWhole() {
    const b = $('viewAllBtn');
    if (!b) return;
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    clearTimeout(pulseWhole.t); pulseWhole.t = setTimeout(() => b.classList.remove('pulse'), 900);
  }
  // resizable gutters between the planes and above the chain (sizes are per viewer)
  function setupGutters() {
    const stage = $('stage'), panes = $('panes');
    const store = (k, v) => { try { localStorage.setItem(lsk(k), String(v)); } catch (e) { /* ignore */ } };
    const read = (k) => { try { return localStorage.getItem(lsk(k)); } catch (e) { return null; } };
    // (v15: the chain is 188 px with pictures, 96 with names; a height saved for the old 272 px cards is not reused)
    const ch = +read('cmw-chain-h2'); if (ch) document.documentElement.style.setProperty('--chain-h', ch + 'px');
    else if (S && S.compact) document.documentElement.style.setProperty('--chain-h', '96px');   // (Names, saved before v15)
    // TEMP-DEBUG-HOOK (removed before publishing)
    // the quality and perf suites render their scenes at the v14 pane geometry (a 272 px chain), so their golden images
    // and baselines stay valid (test/regress/quality/run_quality.js, test/regress/perf/run.js set window.__cmwChainH)
    if (window.__cmwChainH > 0) document.documentElement.style.setProperty('--chain-h', window.__cmwChainH + 'px'); // TEMP-DEBUG-HOOK
    const sp = +read('cmw-split'); if (sp) panes.style.setProperty('--split', String(sp));
    const drag1 = (el, onMove, onEnd) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('active');
      const mv = (ev) => onMove(ev);
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.classList.remove('active'); onEnd && onEnd(); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
    const row = $('gutterRow');
    if (row) drag1(row, (e) => {
      const r = stage.getBoundingClientRect();
      let hgt = r.bottom - e.clientY - 4;
      hgt = Math.max(96, Math.min(r.height * 0.5, hgt));
      for (const snapTo of [96, 188]) if (Math.abs(hgt - snapTo) < 12) hgt = snapTo;
      document.documentElement.style.setProperty('--chain-h', Math.round(hgt) + 'px');
      S.compact = hgt < 140; $('pipeline').classList.toggle('compact', S.compact); setSeg($('chainMode'), S.compact ? 'compact' : 'cards');
    }, () => store('cmw-chain-h2', parseInt(getComputedStyle(stage).getPropertyValue('--chain-h')) || 188));
    const col = $('gutterCol');
    if (col) {
      drag1(col, (e) => {
        const r = panes.getBoundingClientRect();
        const f = Math.max(0.2, Math.min(0.8, (e.clientX - r.left) / r.width));
        panes.style.setProperty('--split', f.toFixed(4));
      }, () => store('cmw-split', panes.style.getPropertyValue('--split') || 0.5));
      col.addEventListener('dblclick', () => { panes.style.setProperty('--split', '0.5'); store('cmw-split', 0.5); });
    }
  }
  // tooltips: elements with data-tip (or title) show a styled tip after a short delay
  function setupTooltips() {
    const tip = $('tip');
    if (!tip) return;
    let timer = 0, cur = null, lastHide = 0, kbdTip = null, navKeyAt = -1e9;
    // (v16.5 UX17) the tool descriptions that say click, in touch words (the others drag, hold or pick)
    const TOUCH_DESC = {
      point: () => $t('Tap to place a point; its images are labelled a′, a″, …'),
      polygon: () => $t('Tap the vertices; tap the first one to close.'),
      segment: () => $t('Tap one end and then the other, or drag between them.'),
      line: () => $t('Tap two points, or drag through them; the line extends to infinity.'),
      ray: () => $t('Tap the start and then a point on the ray, or drag from the start.'),
      circle: () => $t('Tap the center and then a point on the circle, or drag from the center.'),
      meet: () => $t('Tap a crossing of two curves, or one curve and then another.'),
      touch: () => $t('Pick a line or a circle, then the point where the new circle touches it and a point it passes through, in either order. Tap the dashed tangent or Tangent line for the tangent line, or a ring for a tangent from the point. The curve stays picked for the next one.'),
    };
    const show = (el) => {
      const text = el.getAttribute('data-tip');
      // (v16.5 UX34: never for an element that went away, or one the mouse already left)
      if (!text || !el.isConnected || (el !== lpShown && el !== kbdTip && !el.matches(':hover'))) return;
      const [label, key] = text.split(/\s{2,}/);
      // (v16.5 UX17: a long-press tip on touch names no key and says tap, not click)
      const byTouch = el === lpShown;
      tip.innerHTML = '';
      tip.append(document.createTextNode(label));
      if (key && !byTouch) tip.append(h('span', { class: 'tip-key' }, key));
      // a tool's description: the tooltip's second line (items 3 and 6 moved the descriptions here)
      const tdesc = byTouch && TOUCH_DESC[el.getAttribute('data-tool')];
      const desc = tdesc ? tdesc() : el.getAttribute('data-desc');
      if (desc) tip.append(h('span', { class: 'tip-desc' }, desc));
      tip.hidden = false;
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      let y = r.top - th - 6; if (y < 6) y = r.bottom + 6;
      tip.style.left = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2)) + 'px';
      tip.style.top = y + 'px';
    };
    const hide = () => { clearTimeout(timer); if (!tip.hidden) lastHide = performance.now(); tip.hidden = true; cur = null; kbdTip = null; };
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      const el = e.target.closest && e.target.closest('[data-tip],[title]');
      if (!el || el === cur) return;
      if (el.hasAttribute('title') && !el.hasAttribute('data-tip')) { el.setAttribute('data-tip', el.getAttribute('title')); el.removeAttribute('title'); }
      hide();
      cur = el;
      timer = setTimeout(() => show(el), performance.now() - lastHide < 300 ? 0 : 450);
    });
    document.addEventListener('pointerout', (e) => { if (cur && !lpShown && (!e.relatedTarget || !cur.contains(e.relatedTarget))) hide(); });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', hide, true);
    // v16.5 UX34 (restores 'tooltips never stick'): a tip shows on hover only, never after a focus (a focus the app
    // moves, after a palette or a dialog closes, left the tip over the planes); it goes when its element goes, on a
    // scroll and when the window loses the pointer
    document.addEventListener('pointermove', () => { if (cur && !cur.isConnected) hide(); }, { passive: true, capture: true });
    document.addEventListener('scroll', (e) => { if (!tip.hidden && cur && (e.target === document || (e.target instanceof Element && e.target.contains(cur)))) { lpShown = null; hide(); } }, { passive: true, capture: true });
    window.addEventListener('blur', () => { lpCancel(); lpShown = null; hide(); });
    // ([v16.5 fix regress-9] a keyboard user's Tab still names an icon and its key: a tip after a focus that Tab, Shift+Tab
    // or an arrow key moved, on :focus-visible; a focus the app moves itself (after a click, a palette, a dialog, Enter or
    // Esc) shows none, as UX34 asks. It goes with the focus, on any key and on any press)
    document.addEventListener('keydown', (e) => { if (e.key === 'Tab' || /^Arrow/.test(e.key)) navKeyAt = performance.now(); }, true);
    document.addEventListener('focusin', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('[data-tip],[title]') : null;
      if (!el || performance.now() - navKeyAt > 300 || !el.matches(':focus-visible')) return;
      if (el.hasAttribute('title') && !el.hasAttribute('data-tip')) { el.setAttribute('data-tip', el.getAttribute('title')); el.removeAttribute('title'); }
      hide();
      cur = el; kbdTip = el;
      timer = setTimeout(() => show(el), 300);
    });
    document.addEventListener('focusout', (e) => { if (kbdTip && (e.target === kbdTip || kbdTip.contains(e.target))) { kbdTip = null; hide(); } });
    // touch (P5): tooltips are skipped above, so a 450 ms long-press on a tool, a pattern swatch or a view button
    // shows the same tip; moving the finger cancels it, and the release after a tip does not also press the button
    const LP_SEL = '.tool[data-tip], .pat[data-tip], #viewSwitch [data-tip], #leftTabs [data-tip], #rightTabs [data-tip], .phbtn[data-tip]';
    // (v16.3.1: lpDown, the press by its event's own time. The timer measures 450 ms on the page's clock, which a busy
    // page (one still settling) runs late: a quick tap whose release waited behind a long task looked like a long-press,
    // and its click was swallowed. The release decides by the events' times instead)
    let lp = null, lpShown = null, lpDown = null;
    const lpCancel = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
    document.addEventListener('pointerdown', (e) => {
      lpCancel();
      if (lpShown) { lpShown = null; hide(); }
      lpDown = null;
      if (e.pointerType !== 'touch') return;
      const el = e.target.closest && e.target.closest(LP_SEL);
      if (!el) return;
      lpDown = { id: e.pointerId, t: e.timeStamp };
      lp = { el, x: e.clientX, y: e.clientY, id: e.pointerId, t: setTimeout(() => { lp = null; cur = el; lpShown = el; show(el); }, 450) };
    });
    document.addEventListener('pointermove', (e) => { if (lp && e.pointerId === lp.id && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) lpCancel(); }, { passive: true });
    document.addEventListener('pointercancel', lpCancel);
    document.addEventListener('pointerup', (e) => {
      lpCancel();
      const down = lpDown;
      lpDown = null;
      if (!lpShown) return;
      // a release less than 450 ms after the press, by the events' times, is a tap: the tip goes, the click goes through
      if (down && e.pointerId === down.id && e.timeStamp - down.t < 450) { lpShown = null; hide(); return; }
      // (v16.5 UX34) the tip goes when the finger lifts; the click that follows the release is swallowed
      const el = lpShown;
      const swallow = (ev) => { if (el.contains(ev.target)) { ev.preventDefault(); ev.stopPropagation(); } };
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
      lpShown = null; hide();
    });
    // the long-press must not open the system's context menu over the tip
    document.addEventListener('contextmenu', (e) => { if (lpShown || (lp && e.target.closest && e.target.closest(LP_SEL))) e.preventDefault(); });
  }
  // ---------------- keyboard focus across rebuilds ----------------
  // Lists, cards and segmented controls are rebuilt from the state. A control is known by its id, or by the
  // row/card keys above it (data-k, data-id, ...) plus its class and label, so its rebuilt twin can take the focus.
  const FK_ATTRS = ['data-k', 'data-id', 'data-mode', 'data-v', 'data-tool', 'data-conn', 'data-n'];
  const FK_STATE = new Set(['on', 'sel', 'focus', 'off', 'bad', 'active', 'dragging', 'drop', 'hidden-shape', 'copied', 'scrub', 'scrubbing']);
  function focusKey(el) {
    if (!(el instanceof Element) || el === document.body) return null;
    if (el.id) return { id: el.id };
    const path = [];
    let n = el, root = null;
    while (n && n !== document.body) {
      if (n !== el && n.id) { root = n.id; break; }
      const a = FK_ATTRS.filter((k) => n.hasAttribute(k)).map((k) => `${k}=${n.getAttribute(k)}`).join(',');
      if (a) path.push(a);
      n = n.parentElement;
    }
    if (!root) return null;
    const g = el.getAttribute('role') === 'radio' && el.closest('[role="radiogroup"]');
    return { root, path: path.join('|'), tag: el.tagName, cls: [...el.classList].filter((c) => !FK_STATE.has(c)).sort().join('.'), label: el.getAttribute('aria-label') || '', group: g ? g.getAttribute('aria-label') || '' : null };
  }
  function findByKey(key) {
    if (!key) return null;
    if (key.id) return $(key.id);
    const root = $(key.root);
    if (!root) return null;
    if (key.group != null) {
      // a radio hands the focus to the checked radio of its group
      const g = [root, ...root.querySelectorAll('[role="radiogroup"]')].find((x) => x.getAttribute('role') === 'radiogroup' && (x.getAttribute('aria-label') || '') === key.group);
      const on = g && g.querySelector('[role="radio"][aria-checked="true"]');
      if (on) return on;
    }
    let same = null, other = null;
    for (const el of root.getElementsByTagName(key.tag)) {
      const k = focusKey(el);
      if (!k || k.root !== key.root || k.cls !== key.cls) continue;
      if (k.path === key.path) { if (k.label === key.label) return el; same = same || el; } else other = other || el;
    }
    return same || other; // same row with a changed label (Hide → Show), else the same control in another row
  }
  // after a menu, palette or dialog closes: back to its opener, the opener's rebuilt twin, or the phone's ⋯ button
  // when the opener sat in that (now closed) menu
  function focusBack(anchor, key) {
    const a = document.activeElement;
    if (a && a !== document.body) return;
    const vis = (el) => (el && el !== document.body && el.isConnected && el.getClientRects().length ? el : null);
    const t = vis(anchor) || vis(findByKey(key)) || (anchor && anchor.closest && anchor.closest('#hdrMenu') ? vis($('hdrMoreBtn')) : null);
    if (t) t.focus({ preventScroll: true });
  }
  // radiogroups are one Tab stop: only the checked radio is tabbable
  function roveRadios() {
    for (const g of document.querySelectorAll('[role="radiogroup"]')) {
      const rs = [...g.querySelectorAll('[role="radio"]')];
      if (!rs.length) continue;
      const on = rs.find((r) => r.getAttribute('aria-checked') === 'true') || rs[0];
      for (const r of rs) { const t = r === on ? 0 : -1; if (r.tabIndex !== t) r.tabIndex = t; }
    }
  }
  // a laptop's tool grids and the chain are one Tab stop each, the arrows move inside, and F6 moves between
  // the areas (the top bar, the tools, X, Y, the chain, the Inspector). A phone keeps every control a stop
  const ROVE = [['#tools', '.tool'], ['#constructTools', '.tool'], ['#pipeline', '.card, .ftile']];
  const roveLast = new Map();   // group selector -> the item that last had the focus
  const onLaptop = () => !document.documentElement.classList.contains('ph');
  const shown = (el) => !!el && el.isConnected && el.getClientRects().length > 0;
  function roveGroups() {
    for (const [gs, isel] of ROVE) {
      const g = document.querySelector(gs);
      if (!g) continue;
      const items = /** @type {HTMLElement[]} */ ([...g.querySelectorAll(isel)]);
      if (!items.length) continue;
      if (!onLaptop()) { for (const it of items) if (it.tabIndex !== 0) it.tabIndex = 0; continue; }
      const vis = items.filter(shown), last = roveLast.get(gs);
      const on = (last && vis.includes(last) ? last : null) || vis.find((el) => el.classList.contains('on') || el.classList.contains('focus')) || vis[0];
      for (const it of items) { const t = it === on ? 0 : -1; if (it.tabIndex !== t) it.tabIndex = t; }
    }
  }
  // arrows inside a tool grid: left and right to the next tool, up and down to the nearest tool in the next row
  function toolKeys(e) {
    if (!onLaptop() || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const dx = { ArrowRight: 1, ArrowLeft: -1 }[e.key], dy = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!dx && !dy && e.key !== 'Home' && e.key !== 'End') return;
    const t = /** @type {HTMLElement} */ (e.target), g = t && t.closest ? t.closest('#tools, #constructTools') : null;
    if (!g || !t.classList.contains('tool')) return;
    const items = /** @type {HTMLElement[]} */ ([...g.querySelectorAll('.tool')]).filter(shown), i = items.indexOf(t);
    if (i < 0) return;
    let j = i;
    if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = items.length - 1;
    else if (dx) j = Math.max(0, Math.min(items.length - 1, i + dx));
    else {
      const r = t.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let best = null, bd = Infinity;
      for (const o of items) {
        const q = o.getBoundingClientRect(), oy = q.top + q.height / 2;
        if (dy > 0 ? oy <= cy + r.height / 2 : oy >= cy - r.height / 2) continue;
        const d = Math.abs(oy - cy) * 4 + Math.abs(q.left + q.width / 2 - cx);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) j = items.indexOf(best);
    }
    e.preventDefault(); e.stopPropagation();
    if (j !== i) items[j].focus({ preventScroll: true });
  }
  // F6 and Shift+F6: the next and the previous area. Each area takes the focus where it last had it
  function areaKeys(e) {
    if (e.key !== 'F6' || e.altKey || e.ctrlKey || e.metaKey || !onLaptop() || document.querySelector('.modal-bg')) return;
    const act = (gs) => { const g = document.querySelector(gs); return g ? /** @type {HTMLElement[]} */ ([...g.querySelectorAll(ROVE.find((r) => r[0] === gs)[1])]).find((el) => el.tabIndex === 0 && shown(el)) : null; };
    const plane = (p) => { const cv = p && p.ocanvas; if (cv && !cv.hasAttribute('tabindex')) cv.tabIndex = -1; return shown(cv) ? cv : null; };
    const first = (gs) => { const g = document.querySelector(gs); return g ? [...g.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex="0"]')].find(shown) || null : null; };
    const areas = [
      { id: 'top', el: () => first('#top'), has: (el) => !!el.closest('#top') },
      { id: 'tools', el: () => act('#tools'), has: (el) => !!el.closest('#secDraw, #railTools') },
      { id: 'x', el: () => plane(paneL), has: (el) => paneL && el === paneL.ocanvas },
      { id: 'y', el: () => plane(paneR), has: (el) => paneR && el === paneR.ocanvas },
      { id: 'chain', el: () => act('#pipeline'), has: (el) => !!el.closest('#pipeline') },
      { id: 'inspector', el: () => (S.hideRight ? null : first('#propsPanel')), has: (el) => !!el.closest('#propsPanel') },
    ].filter((a) => a.el());
    if (!areas.length) return;
    const a = document.activeElement;
    const i = areas.findIndex((r) => a && a !== document.body && r.has(a));
    const j = i < 0 ? (e.shiftKey ? areas.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + areas.length) % areas.length;
    e.preventDefault(); e.stopPropagation();
    /** @type {HTMLElement} */ (areas[j].el()).focus({ preventScroll: true });
  }
  let lastFocus = null;
  function setupFocusKeeper() {
    document.addEventListener('keydown', toolKeys, true);
    document.addEventListener('keydown', areaKeys, true);
    document.addEventListener('focusin', (e) => {
      lastFocus = { el: e.target, key: focusKey(e.target) };
      const t = /** @type {Element} */ (e.target);
      for (const [gs, isel] of ROVE) { const g = document.querySelector(gs); if (g && t.closest && g.contains(t) && t.matches(isel)) { roveLast.set(gs, /** @type {HTMLElement} */ (t)); roveGroups(); } }
    });
    // a real blur (the user moved on) forgets the control; a blur by removal keeps it for the rebuild below
    document.addEventListener('focusout', (e) => { const el = e.target; queueMicrotask(() => { if (lastFocus && lastFocus.el === el && el.isConnected && document.activeElement !== el) lastFocus = null; }); });
    const mo = new MutationObserver(() => {
      roveRadios(); roveGroups();
      const a = document.activeElement;
      if ((a && a !== document.body) || !lastFocus || lastFocus.el.isConnected || document.querySelector('.modal-bg')) return;
      const el = findByKey(lastFocus.key);
      if (el && el.getClientRects().length) el.focus({ preventScroll: true });
    });
    for (const id of ['shapeList', 'pipeline', 'patternSeg', 'leftFoot', 'rightFoot', 'leftTabs', 'rightTabs', 'chainMode', 'propsPanel', 'tools']) {
      const el = $(id);
      if (el) mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
    }
    roveRadios(); roveGroups();
  }
  // radiogroups without their own handler: arrows (and Home/End) move the checked radio and the focus with it
  function radioKeys(group) {
    group.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir && e.key !== 'Home' && e.key !== 'End') return;
      const rs = [...group.querySelectorAll('[role="radio"]')];
      const i = rs.findIndex((r) => r.getAttribute('aria-checked') === 'true');
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? rs.length - 1 : Math.max(0, Math.min(rs.length - 1, i + dir));
      e.preventDefault();
      if (j === i || !rs[j]) return;
      rs[j].click();
      const on = group.querySelector('[role="radio"][aria-checked="true"]');
      if (on) on.focus({ preventScroll: true });
    });
  }
  // toast with an optional action (used instead of confirmation dialogs).
  // An Undo toast is bound to the history entry it announces: it undoes exactly that action, and the next
  // undoable action, undo or redo dismisses it
  function undoToast(msg, also) {
    const at = hi;
    const t = toast(msg, $t('Undo'), () => { if (hi === at) $('undoBtn').click(); }, true);
    // (v16.5 UX01: a second action before Undo, "Added f₃ Sine · Show alone · Undo")
    if (t && also) { const u = t.querySelector('.toast-act'); u.before(h('button', { class: 'toast-act', onclick: () => { t.remove(); also[1](); } }, also[0])); }
    return t;
  }
  function dismissUndoToast() {
    const host = $('toastHost');
    if (host) for (const t of host.querySelectorAll('.toast[data-undo]')) t.remove();
  }
  // (v16.5 UX80, restores "nothing covers uninvited": a message never lands on a control) A desktop's messages sit
  // above the chain, centred between X's and Y's button columns (and above the deformation's transport), as wide as
  // the room between them, wrapping to a second line; a phone's sit above the chain bar, right of the inset and left of
  // the plane's key column, or above the inset where that room is too narrow. Placed whenever one shows (an observer
  // on the host) and when the layout changes.
  function placeToasts() {
    const host = $('toastHost');
    if (!host) return;
    const st = host.style;
    const clear = () => { if (host.hasAttribute('data-placed')) { host.removeAttribute('data-placed'); st.removeProperty('left'); st.removeProperty('bottom'); st.removeProperty('max-width'); } };
    // (D1, issue #23) Clear chain gives the chain head's room to a message placed there, and is back when it goes (the
    // message has its own Undo)
    const cc = $('clearChain'), away = (on) => { if (cc) cc.classList.toggle('toast-away', on); };
    away(false);
    if (!host.firstElementChild) return;
    const box = (e) => (e && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' ? e.getBoundingClientRect() : null);
    const chain = box(document.querySelector('.pipe-wrap'));
    if (!chain || !(chain.width > 0)) { clear(); return; }
    const H = window.innerHeight, W = window.innerWidth;
    let lo = 8, hi = W - 8, top = chain.top;
    const dock = [...document.querySelectorAll('.tdock:not([hidden])')].map(box).filter(Boolean);
    for (const d of dock) top = Math.min(top, d.top);
    const inset = box(document.querySelector('.panes > .pane.ph-inset'));
    if (inset) {
      // a phone with the inset: right of it, left of the large plane's keys at the bottom
      const big = document.querySelector('.panes > .pane:not(.ph-inset):not([hidden])');
      const keys = big ? [...big.querySelectorAll('.viewstack, .ph-col')].map(box).filter((r) => r && r.width > 0 && r.bottom > inset.top) : [];
      lo = inset.right + 8;
      for (const r of keys) hi = Math.min(hi, r.left - 8);
      if (hi - lo < 200) {
        lo = 8; hi = W - 8; top = inset.top;
        for (const r of keys) if (r.bottom > top - 80) hi = Math.min(hi, r.left - 8);
      }
    } else {
      // ([v16.5 fix regress-3, the user's rule "nothing covers the work area uninvited"] a desktop's message goes in the
      // chain head's free middle, between its title and Pictures | Names, when it fits there whole on one line: it then
      // covers neither a plane nor a control. Only a message too long for it goes above the chain, as UX80 placed it)
      const hd = document.querySelector('.pipe-head'), grow = hd && hd.querySelector(':scope > .grow'), hb = box(hd);
      if (hb && grow && hb.height > 0 && hb.height < 60 && host.children.length === 1) {
        away(true);
        const kids = [...hd.children].filter((e) => e.getClientRects().length && getComputedStyle(e).display !== 'none'), gi = kids.indexOf(grow);
        const a = gi > 0 ? Math.max(...kids.slice(0, gi).map((e) => e.getBoundingClientRect().right)) : hb.left;
        const b = gi >= 0 && gi < kids.length - 1 ? Math.min(...kids.slice(gi + 1).map((e) => e.getBoundingClientRect().left)) : hb.right;
        host.setAttribute('data-placed', 'head'); st.maxWidth = 'none';
        const tw = host.firstElementChild.getBoundingClientRect(), room = b - a - 24;
        if (room >= 160 && tw.width <= room && tw.height <= hb.height) {
          st.left = Math.round((a + b) / 2) + 'px';
          st.bottom = Math.round(H - hb.bottom + (hb.height - tw.height) / 2) + 'px';
          st.maxWidth = Math.round(room) + 'px';
          return;
        }
        away(false);
        host.setAttribute('data-placed', '');
      }
      // the planes side by side: between X's and Y's button columns; one plane: left of its own
      const stacks = ['paneL', 'paneR'].map((id) => { const p = $(id); return p && p.getClientRects().length ? box(p.querySelector('.viewstack')) : null; });
      const plots = ['plotL', 'plotR'].map((id) => box($(id)));
      if (stacks[0] && stacks[1] && stacks[1].left > stacks[0].right) { lo = stacks[0].right + 8; hi = stacks[1].left - 8; }
      else { const k = stacks[1] ? 1 : 0, st2 = stacks[k], pl = plots[k]; if (st2 && pl && pl.width > 0) { lo = pl.left + 8; hi = st2.left - 8; } }
    }
    if (!(hi - lo >= 160)) { clear(); return; }
    host.setAttribute('data-placed', '');
    st.left = Math.round((lo + hi) / 2) + 'px';
    st.bottom = Math.round(H - top + 8) + 'px';
    st.maxWidth = Math.round(hi - lo) + 'px';
  }
  // (o.sticky: it stays until its action or its close button is used, or another toast replaces it: review v16 user-5;
  // o.ms: how long an ordinary one stays)
  function toast(msg, actionLabel, action, isUndo, o) {
    const host = $('toastHost');
    if (!host) return;
    host.innerHTML = '';
    const t = h('div', { class: 'toast', role: 'status', 'data-undo': isUndo ? '' : null }, h('span', null, msg));
    if (actionLabel) t.append(h('button', { class: 'toast-act', onclick: () => { t.remove(); action(); } }, actionLabel));
    if (o && o.sticky) { t.append(h('button', { class: 'icon-btn toast-x', 'aria-label': $t('Close'), html: ICONS.close, onclick: () => t.remove() })); host.append(t); return t; }
    host.append(t);
    let left = (o && o.ms) || 5000, t0 = performance.now(), timer = setTimeout(() => t.remove(), left);
    t.addEventListener('pointerenter', () => { clearTimeout(timer); left -= performance.now() - t0; });
    t.addEventListener('pointerleave', () => { t0 = performance.now(); timer = setTimeout(() => t.remove(), Math.max(800, left)); });
    return t;
  }

