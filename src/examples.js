'use strict';
// Examples and the guide (issue #20, phase 3: moved out of app.js): loading an example, its fitted view, the examples
// gallery and its thumbnails, and the guide (on a desktop and on a touch screen). The app hands it what it needs once,
// Examples.init(api) at start-up (src/app/15-examples-guide.js, examplesApi): its functions and constants as they are,
// and the state it reassigns (S, currentExample, ...) as getters on api, read as A.S and so on. The examples
// themselves (EX), the theme and the palettes, and the state the rest of the app reads too (currentExample, exFitKey,
// exThumbs, exWait) stay the app's.
const Examples = (() => {
  let A = null;
  let EX, TeX, applyLayout, armOutside, blankState, buildPipeline, buildShapeList, cauchyCache, closePalette, commit,
    defMem, drawScene, dropAllGPU, dropShapeGPU, exLabelSync, exThumbs, exWait, fitPane, focusBack, focusKey, morph,
    nSteps, newShape, onPaneResize, openIntegralPop, openTransport, phHold, placePop, rebuild, setFocus, snd,
    sndPieceHint, sndPlayPiece, sndPtsKey, sndStopPlay, stageMap, touchUI, undoToast, viewBox, viewMem;
  function exFitBarPx() {
    if (document.documentElement.classList.contains('ph')) return 0;   // (:root.ph hides the bar on the plane)
    // (v16.5 UX20: on a desktop the bar is in the pane head, above the plane, so only the bottom margin is kept: the
    // same 48 px, the examples' views unchanged; measured from the head it took the whole plane and the fit went NaN)
    const f = $('leftFoot'), pr = A.paneL.ocanvas && A.paneL.ocanvas.getBoundingClientRect(), fr = f && !f.hidden && f.parentNode === $('plotL') ? f.getBoundingClientRect() : null;
    return Math.max(40, fr && pr && fr.height > 0 ? pr.bottom - fr.top : 0) + 8;
  }
  function exFitTo(ex) {
    const fb = ex.fit;
    if (fb && A.paneL.w > 20 && A.paneL.h > 20 + exFitBarPx()) {
      const bar = exFitBarPx(), s = Math.min(ex.view.s, A.paneL.w / (fb.x1 - fb.x0), (A.paneL.h - bar) / (fb.y1 - fb.y0));
      Object.assign(A.S.srcView, { cx: (fb.x0 + fb.x1) / 2, cy: (fb.y0 + fb.y1) / 2 - bar / 2 / s, s });
    }
    A.exFitKey = fb ? JSON.stringify(A.S.srcView) : '';
  }
  // an example whose steps this build cannot make is left out of the menus
  const exOk = (ex) => ex.steps.every((st) => Funcs.DEFS[st.type]);
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
    if (!spec) A.currentExample = i;
    const xl = document.querySelector('#examplesBtn .exlabel');
    if (xl && !spec) { xl.textContent = ex.name; xl.title = ex.name; }   // ([v16.5 check app-3] its tooltip: the whole name)
    A.S.shapes = []; A.S.steps = [];
    A.S.sel = null;   // (v15: a new example selects its last step)
    // an example opens as its blurb describes: the views it names (in the fields of earlier builds, rightMode and
    // leftSphere, migrated to the panes' views as a saved state is), a phase style that needs no selected curve, the
    // landscape's sheets and height as it sets them. The layout comes first (merged-views.md): the meshing window below
    // is the X pane's box, which must have its new width (a merge or a split changes it)
    const ev = Views.migrate({ rightMode: ex.rightMode || 'image', sphereMode: ex.sphereMode, leftSphere: !!ex.leftSphere, material: ex.material, spherePlane: ex.spherePlane,
      dc: ex.dc || (A.S.dc === 'cauchy' ? blankState().dc : A.S.dc) });
    A.S.view = ev.view;
    A.S.dc = ev.dc;
    A.S.landPlain = !!ev.landPlain;
    // (a new scene: every view starts from its own fitted plane)
    for (const k of Object.keys(viewMem)) delete viewMem[k];
    morph.open = false; morph.T = 0; morph.seg = null; morph.playing = false;
    defMem.y = null; defMem.d = null; defMem.dkey = '';
    // (v16.5 UX74) an example with a melody shows its Try line before the layout, so its plane is fitted with the
    // line's room already taken (shown after the fit, the line pushed the spiral's top out of the plane)
    const laned = !spec && ex.shapes.some((sh) => sh.listen) && sndPieceHint(true);
    applyLayout();
    // (the planes take their new height at once, as for a merge, not at the next ResizeObserver callback)
    if (laned && A.paneL && A.paneR) onPaneResize();
    A.S.srcView = Object.assign({}, ex.view);
    // an example's box that must be in view (a phone's narrow plane): its view's scale at most, centred on the box
    exFitTo(ex);
    A.paneL.setView(A.S.srcView);
    // (review v16 regress-6: the window goes into the state too, so a link, a scene file or an autosave made from the
    // example carries it, and the recipient meshes in the sender's window whatever the size of their pane)
    A.clipWin = viewBox(A.S.srcView);
    A.S.clipWin = A.clipWin;
    dropAllGPU();
    A.selected = null;
    for (const sh of ex.shapes) {
      const ns = newShape(sh.kind, JSON.parse(JSON.stringify(sh)));
      // a melody's data keeps the chain it was composed for and the key of its points (sndListenOf)
      if (ns.listen) ns.listen = Object.assign(ns.listen, { steps: JSON.parse(JSON.stringify(ex.steps)), key: sndPtsKey(ns.pts) });
      A.S.shapes.push(ns);
    }
    for (const st of ex.steps) A.S.steps.push(Object.assign({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params), on: true }, st.handleR > 0 ? { handleR: st.handleR } : {}));
    if (ex.range && Number.isInteger(ex.range.a) && Number.isInteger(ex.range.b)) A.S.homRange = { a: ex.range.a, b: ex.range.b }; else delete A.S.homRange;   // (v16)
    // the L key (the keyboard probe) replays the example's melody; another example forgets it
    const piece = A.S.shapes.find((x) => x.listen);
    if (piece) snd.lastLoop = { pts: piece.pts, closed: false, sid: piece.id };
    else if (snd.lastLoop && snd.lastLoop.sid) snd.lastLoop = null;
    // an example brings its own w-plane targets (none unless it says so)
    A.S.targets = [];
    if (ex.targets) for (const t of ex.targets) A.S.targets.push(newShape(t.kind, JSON.parse(JSON.stringify(t)), true));
    A.S.sheets = !!ex.sheets;
    if (ex.height) A.S.height = ex.height;
    cauchyCache.key = '';
    closePalette();
    rebuild();
    buildShapeList();
    buildPipeline();
    setFocus(ex.focus || 0);
    commit();
    // (v16.5 UX25: what opened, with Undo, when there is work to go back to; the button names it until an edit)
    if (!spec) { A.exAt = A.hi; exLabelSync(); if (A.hi > 0) undoToast($t('Opened {name}.', { name: ex.name })); }
    if (ex.morph || ev.deform) openTransport();
    if (piece && !spec && !laned) sndPieceHint();
    // the line integral the example is about, once the planes have their size
    if (ex.integrate != null) requestAnimationFrame(() => { const s = A.S.shapes[ex.integrate]; if (s && A.paneL) { const r = A.paneL.ocanvas.getBoundingClientRect(); openIntegralPop(s.id, r.left + r.width * 0.62, r.top + 40); } });
  }
  let exLook = '';
  function renderExampleThumb(i) {
    if (!GLR.ok) return exThumbs.get(i);
    const look = `${A.S.pattern}|${A.S.alpha}|${A.TH.plane}`;
    if (look !== exLook) { exThumbs.clear(); exLook = look; }
    if (exThumbs.has(i)) return exThumbs.get(i);
    const ex = EX[i];
    const save = { S: A.S, clipWin: A.clipWin, selected: A.selected, hoverShape: A.hoverShape };
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:-1000px;top:0;width:96px;height:64px';
    document.body.append(cv);
    let url = null, key = null;
    GLR.side(true);
    try {
      A.S = Object.assign(blankState(), {
        shapes: ex.shapes.map((sh, j) => Object.assign({ id: `ex${i}_${j}`, ci: j % 8, visible: true }, JSON.parse(JSON.stringify(sh)))),
        steps: ex.steps.map((st) => ({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params), on: true })),
        pattern: save.S.pattern, alpha: save.S.alpha, meshN: 160, lines: false, unit: false, chev: false,
      });
      A.selected = null; A.hoverShape = null;
      A.clipWin = { x0: ex.view.cx - 260 / ex.view.s, x1: ex.view.cx + 260 / ex.view.s, y0: ex.view.cy - 180 / ex.view.s, y1: ex.view.cy + 180 / ex.view.s };
      rebuild();
      const pane = new Pane(cv);
      pane.resize();
      // (thumbX: the shapes in X, for an example whose image under F is not a picture: the melody's curve, where
      // |F| runs from e^−78 to e^78)
      const tk = ex.thumbX ? 0 : nSteps();
      fitPane(pane, tk);
      pane.begin(A.TH.plane);
      A.sideDraw = true;
      try { drawScene(pane, stageMap(tk), null, { thin: true, L: 2, cache: false }); } finally { A.sideDraw = false; }
      if (GLR.frameStatus().pending) key = GLR.chainKey; else url = cv.toDataURL();
      for (const sh of A.S.shapes) dropShapeGPU(sh.id);
    } catch (e) { console.error(e); } finally {
      A.S = save.S; A.clipWin = save.clipWin; A.selected = save.selected; A.hoverShape = save.hoverShape;
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
      const b = h('button', { class: 'ex-item' + (i === 0 ? ' ex-new' : ''), role: 'menuitem', hidden: !exOk(ex) || null, 'aria-current': i === A.currentExample ? 'true' : null, onclick: () => { closePalette(); loadExample(i); focusBack(anchor, okey); } }, img,
        h('span', { class: 'ex-text' }, h('span', { class: 'ex-nl' }, h('span', { class: 'ex-name' }, i === 0 ? $t('New: empty canvas') : ex.name), ex.shapes.some((sh) => sh.listen) ? h('span', { class: 'ex-snd', title: $t('With sound'), 'aria-label': $t('With sound') }, '♫') : null), h('span', { class: 'ex-blurb' }, ex.blurb || '')));   // (v16.5 UX74: ♫ beside the name, not in it: .ex-name stays the example's name)
      return { b, img, i };
    });
    closePalette();
    const pop = h('div', { class: 'pop menu examples', role: 'menu', 'aria-label': $t('Examples') }, ...items.map((x) => x.b));
    $('popHost').append(pop);
    A.popEl = pop;
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
      if (A.popEl !== pop || q >= items.length) return;
      const it = items[q++];
      if (it.b.hidden) { setTimeout(next, 0); return; }
      const url = renderExampleThumb(it.i);
      if (url) it.img.src = url;
      setTimeout(next, 0);
    };
    setTimeout(next, 30);
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

  function init(api) {
    A = api;
    ({ EX, TeX, applyLayout, armOutside, blankState, buildPipeline, buildShapeList, cauchyCache, closePalette, commit, defMem, drawScene, dropAllGPU, dropShapeGPU, exLabelSync, exThumbs, exWait, fitPane, focusBack, focusKey, morph, nSteps, newShape, onPaneResize, openIntegralPop, openTransport, phHold, placePop, rebuild, setFocus, snd, sndPieceHint, sndPlayPiece, sndPtsKey, sndStopPlay, stageMap, touchUI, undoToast, viewBox, viewMem } = api);
  }
  return { init, exFitTo, exOk, firstExample, loadExample, retryExampleThumbs, openGallery, openGuide };
})();
