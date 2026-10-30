  // ---------------- tools ----------------
  const tsvg = (inner) => `<svg class="tic" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const grip = (x, y) => `<rect x="${x - 1.75}" y="${y - 1.75}" width="3.5" height="3.5" fill="currentColor" stroke="none"/>`;
  const AREA = 'fill="currentColor" fill-opacity=".16"';
  const plusC = (x, y) => `<path d="M${x - 2.5} ${y}h5M${x} ${y - 2.5}v5" stroke-width="1"/>`;
  const ICON = {
    select: tsvg('<path d="M5.5 3.5V15l3.1-2.9 2.1 4.5 1.9-.8-2.1-4.5h4.1z"/>'),
    point: tsvg('<circle cx="10" cy="10" r="2.25" fill="currentColor" stroke="none"/><path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2"/>'),
    segment: tsvg('<path d="M5 15L15 5"/>' + grip(5, 15) + grip(15, 5)),
    line: tsvg('<path d="M1 17.9L19 2.1"/>' + grip(7, 12.6) + grip(13, 7.4)),
    ray: tsvg('<path d="M5 15L19 2.7"/>' + grip(5, 15)),
    circle: tsvg('<circle cx="10" cy="10" r="6.5"/>' + plusC(10, 10)),
    arc: tsvg('<path d="M3.5 14.5A7.5 7.5 0 0 1 16.5 14.5"/>' + grip(3.5, 14.5) + grip(16.5, 14.5) + grip(10, 7)),
    curve: tsvg('<path d="M3 14c2.2-4.8 4.2-.4 6.2-3.6S13 5.6 17 7.5"/>'),
    disc: tsvg(`<circle cx="10" cy="10" r="6.5" ${AREA}/>`),
    rect: tsvg(`<rect x="3.5" y="5.5" width="13" height="9" rx=".5" ${AREA}/>` + grip(3.5, 5.5) + grip(16.5, 14.5)),
    polygon: tsvg(`<path d="M4 14.5L6.5 5 14 4.5l2.5 7L10 16z" ${AREA}/>` + grip(4, 14.5) + grip(6.5, 5) + grip(14, 4.5) + grip(16.5, 11.5) + grip(10, 16)),
    lasso: tsvg(`<path d="M5.2 12.8C3 9.6 5 4.8 9.6 4.5s7.4 2.6 6.4 6.2-5.6 4.9-8.6 4.3c-1-.2-1.7-1-2.2-2.2z" ${AREA}/><path d="M5 13l-1.5 3.5"/>`),
    halfplane: tsvg('<rect x="0" y="0" width="20" height="10.5" fill="currentColor" fill-opacity=".16" stroke="none"/><path d="M0 10.5h20M14.5 8.5l2 2-2 2"/>'),
    annulus: tsvg(`<path fill-rule="evenodd" d="M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14zm0 3.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 1 0 0-6.5z" ${AREA}/>`),
    sector: tsvg(`<path d="M4 16h13A13 13 0 0 0 13.2 6.8z" ${AREA}/>` + grip(4, 16)),
    formula: tsvg('<text x="3" y="15" font-family="STIX Two Text, serif" font-style="italic" font-size="14" fill="currentColor" stroke="none">f</text><path d="M12 7h5M12 11h5"/>'),
    cgrid: tsvg('<path stroke-width="1" d="M4 4v12M8 4v12M12 4v12M16 4v12M4 4h12M4 8h12M4 12h12M4 16h12"/>'),
    pgrid: tsvg('<g stroke-width="1"><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5v13M3.5 10h13M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2"/></g>'),
  };
  const TOOLS = [
    ['select', $t('Select'), 'V', $t('Drag a shape to move it and its handles to reshape. Drag empty space to pan (on a sphere, to turn it).')],
    ['point', $t('Point'), 'P', $t('Click to place a point; its images are labelled a′, a″, …')],
    ['segment', $t('Segment'), 'S', $t('Drag from one end to the other, or click one end and then the other.')],
    ['line', $t('Line'), 'L', $t('Drag through two points, or click one and then the other; the line extends to infinity.')],
    ['ray', $t('Ray'), 'R', $t('Drag from the start in the direction of the ray, or click the start and then a point on the ray.')],
    ['circle', $tx('tool', 'Circle'), 'C', $t('Drag from the center outward, or click the center and then a point on the circle.')],
    ['arc', $t('Arc'), 'A', $t('An arc through 3 points: drag from the start to the end, then move the middle handle. Each of the three can snap to a point.')],   // (v16 [C24])
    ['curve', $t('Freehand'), 'F', $t('Hold and draw an open curve.')],
    ['disc', $t('Disc'), 'D', $t('Drag from the center outward.')],
    ['rect', $tx('tool', 'Rectangle'), 'B', $t('Drag between opposite corners.')],
    ['polygon', $tx('tool', 'Polygon'), 'G', $t('Click the vertices; click the first one or press Enter to close. Backspace removes the last point.')],
    ['lasso', $t('Lasso'), 'O', $t('Hold and draw a closed region.')],
    ['halfplane', $tx('tool', 'Half-plane'), 'H', $t('Drag along the boundary; the region is to the left of the arrow.')],
    ['annulus', $t('Annulus'), 'N', $t('Drag from the center to the outer radius.')],
    ['sector', $t('Sector'), 'K', $t('Drag from the vertex; edit the angles in the shape list.')],
    ['formula', $t('Formula'), 'T', $t('Type a set such as |z − 1| < 2, or a curve such as Re z = 0, below.')],
    // ([v16.5 UX86] one name per role: the tool 'Line grid', the pattern 'Square grid', the Phase style 'Pulled-back grid')
    ['cgrid', $t('Line grid'), '', $t('Drag a rectangle to fill with grid lines.')],
    ['pgrid', $t('Polar grid'), '', $t('Drag from the center to set the radius.')],
  ].concat(Construct.toolRows());   // (v16: the Construct group, construct.js)
  Object.assign(ICON, Construct.ICON);
  function buildTools() {
    const host = $('tools'), rail = $('railTools');
    host.innerHTML = '';
    if (rail) rail.innerHTML = '';
    const cmGrid = Construct.buildGrid();   // (v16: the Construct grid under Draw)
    if (cmGrid) cmGrid.innerHTML = '';
    for (const [id, label, key, desc, group, tile] of TOOLS) {
      const tip = key ? `${label}  ${key}` : label;
      // the description is the tooltip's second line (item 3: no hint line under the tools)
      ((group === 'construct' && cmGrid) || host).append(h('button', { class: 'tool' + (tool === id ? ' on' : ''), 'data-tool': id, 'data-tip': tip, 'data-desc': desc, 'aria-label': label, 'aria-description': desc, 'aria-pressed': String(tool === id), onclick: () => setTool(id), html: `${ICON[id]}<span>${tile || label}</span>` }));
      if (rail && group === 'construct' && id === 'circle3') rail.append(h('span', { class: 'rail-sep', 'aria-hidden': 'true' }));
      if (rail) rail.append(h('button', { class: 'tool rail-tool' + (tool === id ? ' on' : ''), 'data-tool': id, 'data-tip': tip, 'data-desc': desc, 'aria-label': label, 'aria-description': desc, onclick: () => setTool(id), html: ICON[id] }));
    }
    // (v16.5 UX93) a phone's tool tile (58 px) shows the name on one line: in Russian a short form where the full name,
    // which the desktop grid hyphenates, is wider than the tile (phone.js reads data-phl)
    if (I18N.lang !== 'en') {
      const PHL = { circle: $tx('phone tile', 'Circle'), rect: $tx('phone tile', 'Rectangle'), polygon: $tx('phone tile', 'Polygon'), halfplane: $tx('phone tile', 'Half-plane'),
        meet: $tx('phone tile', 'Intersect'), bisector: $tx('phone tile', 'Bisector'), perp: $tx('phone tile', 'Perpendicular'),
        hyper: $tx('phone tile', 'Hyperbolic') };   // (wave 1 merge: the plane piece's seventh Construct tool, UX55)
      for (const b of [...host.querySelectorAll('.tool[data-tool]'), ...(cmGrid ? cmGrid.querySelectorAll('.tool[data-tool]') : [])]) { const v = PHL[b.dataset.tool]; if (v) { b.dataset.phl = v; const sp = b.querySelector(':scope > span'); if (sp) sp.dataset.phl = v; } }
    }
    // Snap: the last button of the collapsed rail, so it stays reachable with the drawer collapsed (P3)
    if (rail) rail.append(h('button', { class: 'icon-btn rail-snap', id: 'railSnap', 'aria-pressed': String(!!(S && S.snap)), 'data-tip': $t('Snap to the grid and to figures (both panes). Hold Alt to place freely.'), 'aria-label': $t('Snap to grid and figures'), html: ICONS.snap, onclick: () => { setOpt('snap', !S.snap); syncSnapUnit(); save(); sndToggleCue(S.snap); } }));
    updateToolHint();
    syncModeChips();
  }
  function setTool(id) {
    if (id === 'formula') { setPanels(false, S.hideRight); const f = $('formulaInput'); f.focus(); f.select(); return; }
    tool = id;
    draft = null;
    Construct.toolChanged();   // (v16)
    for (const b of document.querySelectorAll('.tool[data-tool]')) { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    // ([#253] shapes are drawn in the plane X shows; constructions in the z-plane: Image also draws targets in the right
    // plane at any focus)
    if (Construct.isTool(id) && leftStage() > 0 && !targetsEditable()) setFocus(0);
    updateToolHint();
    // the right readout's idle hint names the tool (drawing a target, or the scale)
    if (!probe) { const ro = $('rightReadout'); if (ro && !ro.classList.contains('copied') && !(rHover && rImage() && tool === 'select')) ro.innerHTML = idleRight(); }
    // the left readout's idle hint names the tool on a globe and on the landscape (panels.md 3, 9.1)
    if (!probe && !hov.w && (lGlobe() || lLand())) { const lr = $('leftReadout'); if (lr && !lr.classList.contains('copied')) lr.innerHTML = idleLeft(); }
    // an editable globe's graticule is the snap net of the tool (P3b): it is redrawn
    requestRender('OL', 'OR', globeEdit('L') ? 'L' : null, globeEdit('R') ? 'R' : null);
  }
  // the tool's cursors (the hint line under the tools is gone, item 3: descriptions are the tools' tooltips)
  function updateToolHint() {
    updateDraftChips();
    if (paneL) setCursor(paneL, 'L');
    if (paneR) setCursor(paneR, 'R');
  }

  // ---------------- shapes ----------------
  // target: a shape of the w-plane (Preimage), kept in S.targets; its colors start further along the palette
  function newShape(kind, params, target) {
    const ci = target ? TARGET_CI[S.targets.length % TARGET_CI.length] : S.shapes.length % 8;
    const s = Object.assign({ id: 's' + takeId(), kind, ci, visible: true }, params);
    // [#253] a shape drawn while X shows an intermediate plane belongs to it
    if (!target && leftStage() > 0 && lFlat() && !('stage' in s)) s.stage = leftStage();
    return s;
  }
  // (v16.4) how the shape came: 'draw' (a tool in a plane), 'formula' (the formula field or the palette's region), 'paste',
  // else 'menu'; set around the call by the path that adds it (the tour's Sets from formulas task)
  let shapeVia = null;
  function addShape(s, target) {
    if (!target && !cellSaid && kindType(s) === 'area') cellSay = true;
    (target ? S.targets : S.shapes).push(s);
    selected = s.id; zpSel = null;
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
    tourEmit('shape-added', { kind: s.kind, plane: target ? 'w' : 'z', bound: !!s.at, via: shapeVia || 'menu' });   // (v16: bound, a snapped end)
  }
  // [issue #260] an external ray (theta: '1/3') or an equipotential (r > 1) of step k's set: M for Φ_M, the Julia set of
  // z² + c for φ_c (its c, by name when it is a shared number), as a shape of the plane the step reads (stage k − 1)
  // (the message when v cannot be used, else '')
  function dhAddShape(k, kind, v) {
    const st = S.steps[k - 1], b = built[k - 1];
    if (!st || !b || b.error || (st.type !== 'dh' && st.type !== 'bottcher')) return $t('Fix this step first');
    let r = NaN;
    if (kind === 'dhray' && Region.dhAngle(v) == null) return $t('Enter a fraction p/q or a decimal from 0 to 1, such as 1/3');
    if (kind === 'dheq') {
      try { r = Number.isFinite(Number(v)) && String(v).trim() !== '' ? Number(v) : Params.evalReal(v); } catch (e) { r = NaN; }
      const lo = st.type === 'bottcher' ? b.dh.rho : 1;
      if (!(r > lo)) return lo > 1 ? $t('The level |Φ| must be more than {r} here (the critical level of this c)', { r: CX.fmtNum(lo, 4) }) : $t('The level |Φ| must be more than 1');
    }
    const p = kind === 'dhray' ? { theta: String(v).trim() } : { r };
    p.c = null;
    if (st.type === 'bottcher') {
      p.c = [b.vals.c.re, b.vals.c.im];
      const t = String(st.params.c ?? '').trim();
      if (Params.namesIn(t).length) p.bind = { c: t };
    }
    if (k > 1) p.stage = k - 1;
    const s = newShape(kind, p);
    if (k === 1) delete s.stage;
    addShape(s);
    // (the step's card stays in the Inspector, so that more rays and levels can follow; the shape is a click away)
    selected = null;
    buildShapeList(); requestRender('P');
    undoToast(kind === 'dhray' ? $t('Added the external ray {t}.', { t: p.theta }) : $t('Added the equipotential |Φ| = {r}.', { r: CX.fmtNum(r, 6) }));
    return '';
  }
  // (the palette's Add an external ray… / Add an equipotential…: step k in the Inspector, its field focused; with no
  // Inspector on screen, the default ray 1/3 or level 1.1 is added)
  function dhFocusAdd(k, kind) {
    selected = null; zpSel = null;
    setSel(k); syncSel(); buildShapeList(); requestRender('P');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = /** @type {HTMLInputElement | null} */ (document.getElementById(`dh${k}_${kind}`));
      if (el && el.getClientRects().length) { el.focus(); el.select(); } else dhAddShape(k, kind, kind === 'dhray' ? '1/3' : '1.1');
    }));
  }
  function deleteShape(id) {
    const cmMsg = Construct.deleteMessage(id);   // (v16: the cascade's toast)
    if (S.shapes.concat(S.targets).some((s) => s.at || s.def)) { const plan = cmDeletePlan([id]); if (plan.del.length > 1) { const del = new Set(plan.del); setShapes(S.shapes.filter((s) => !del.has(s.id) || s.id === id)); setTargets(S.targets.filter((s) => !del.has(s.id) || s.id === id)); for (const x of del) if (x !== id) dropShapeGPU(x); cmEmit('deleted', plan); } }   // (v16 [C17])
    const target = S.targets.some((s) => s.id === id);
    if (target) setTargets(S.targets.filter((s) => s.id !== id));
    else { setShapes(S.shapes.filter((s) => s.id !== id)); dropShapeGPU(id); }
    if (selected === id) selected = null;
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
    undoToast(cmMsg || (target ? $t('Target deleted.') : $t('Shape deleted.')));
  }
  // targets change only the preimages and the right plane's targets: no meshes, no refit
  function targetsChanged(structural) {
    if (cmShapes()) structural = true;   // (v16 constructions)
    noteChange();
    if (structural) { buildShapeList(); updateFocusUI(); } else updateShapeList();
    requestRender('L', 'R');
  }
  // ---------------- menus (popover lists) ----------------
  // items: {label, icon?, swatch?, key?, danger?, run} | 'sep' ; a 'kids' array opens a submenu beside its item.
  // run() may return the element that should take the focus; otherwise it goes back to the menu's opener.
  // sub (internal): {opener, okey, parent, label} for a submenu, so Esc and ← lead back to a live element.
  function openMenu(anchor, items, cls, sub) {
    const opener = sub ? sub.opener : anchor;
    // re-clicking the button that opened a menu closes it
    if (!sub && popEl && popEl.classList.contains('menu') && popEl._opener === anchor) { closePalette(); return null; }
    const okey = sub ? sub.okey : focusKey(anchor);
    const ar = anchor.getBoundingClientRect(); // before closePalette detaches a submenu's parent item
    closePalette();
    const pop = h('div', { class: 'pop menu' + (cls ? ' ' + cls : ''), role: 'menu', 'aria-label': sub ? sub.label : items.menuLabel || null });
    pop._opener = opener;
    // (v16.1 user-5) a menu opened from a dialog (Export figure's Size and More formats) is drawn over the dialog: the
    // popovers' layer (30) is under the modal's (50), so it opened behind the dialog and its scrim, out of sight
    if (opener && opener.closest && opener.closest('.modal-bg')) pop.classList.add('over-modal');
    const add = (host, list) => {
      for (const it of list) {
        if (it === 'sep') { host.append(h('div', { class: 'msep', role: 'separator' })); continue; }
        const ic = it.swatch ? `<span class="swatch" style="--c0:${it.swatch.c0};--c1:${it.swatch.alt};--k:${it.swatch.edge}"></span>` : it.iconHtml || (it.icon ? ICONS[it.icon] || '' : '');
        const b = h('button', { class: 'mi' + (it.danger ? ' danger' : '') + (it.kids ? ' has-sub' : ''), role: it.radio ? 'menuitemradio' : 'menuitem', 'aria-checked': it.radio ? String(!!it.checked) : null, disabled: it.disabled || null, 'aria-haspopup': it.kids ? 'menu' : null, 'data-tip': it.tip || null, 'aria-description': it.tip || null,
          onclick: (e) => {
            e.stopPropagation();
            if (it.kids) { openMenu(b, it.kids, cls, { opener, okey, parent: items, label: it.label, at: pop.getBoundingClientRect() }); return; }
            closePalette();
            const r = it.run();
            if (r instanceof Element && r.isConnected) r.focus({ preventScroll: true }); else focusBack(opener, okey);
          } },
          h('span', { class: 'mi-ic', html: ic }), it.labelEl || h('span', { class: 'mi-label' }, it.label), it.keyHtml ? h('span', { class: 'mi-key mi-math', html: it.keyHtml }) : h('span', { class: 'mi-key' }, it.key || ''));
        if (it.lang) b.lang = it.lang;
        host.append(b);
      }
    };
    add(pop, items);
    $('popHost').append(pop);
    popEl = pop;
    if (sub) {
      // (review v16 user-6) in the parent's place, its top at the item that opened it: the submenu replaces the parent
      // where the pointer already is, rather than jumping beside it (and onto whatever lies there, a divider's tooltip)
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let x = sub.at ? sub.at.left : ar.right + 2;
      if (x + pw > window.innerWidth - 12) x = Math.max(12, sub.at ? window.innerWidth - 12 - pw : ar.left - pw - 2);
      pop.style.left = x + 'px';
      pop.style.top = Math.max(12, Math.min(window.innerHeight - ph - 12, ar.top - 4)) + 'px';
    } else placePop(pop, ar);
    const first = (items.focusChecked && pop.querySelector('.mi[aria-checked="true"]:not([disabled])')) || pop.querySelector('.mi:not([disabled])');
    if (first) first.focus();
    pop.addEventListener('keydown', (e) => {
      const its = [...pop.querySelectorAll('.mi:not([disabled])')];
      const i = its.indexOf(document.activeElement), cur = its[i];
      if (e.key === 'ArrowDown') { e.preventDefault(); its[(i + 1) % its.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); its[e.key === 'Home' ? 0 : its.length - 1].focus(); }
      if (e.key === 'ArrowRight' && cur && cur.classList.contains('has-sub')) { e.preventDefault(); cur.click(); }
      if (e.key === 'ArrowLeft' && sub && sub.parent) {
        e.preventDefault();
        closePalette();
        openMenu(opener, sub.parent, cls);
        const back = popEl && [...popEl.querySelectorAll('.mi')].find((b) => b.querySelector('.mi-label').textContent === sub.label);
        if (back) back.focus();
      }
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); focusBack(opener, okey); }
    });
    armOutside(opener);
    return pop;
  }
  // anchor: an element or a rect measured earlier
  function placePop(pop, anchor) {
    const r = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const x = Math.min(window.innerWidth - pw - 12, Math.max(12, r.left));
    let y = r.bottom + 6;
    if (y + ph > window.innerHeight - 12) y = Math.max(12, r.top - ph - 6);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function armOutside(anchor) {
    const pop = popEl;
    setTimeout(() => {
      const off = (e) => {
        if (!popEl || popEl !== pop) { document.removeEventListener('pointerdown', off, true); return; }
        // a press in the Argand pad opened from this popover is inside it
        if (!popEl.contains(e.target) && !(anchor && anchor.contains(e.target)) && !(padEl && padEl.contains(e.target))) { closePalette(); document.removeEventListener('pointerdown', off, true); }
      };
      document.addEventListener('pointerdown', off, true);
    }, 0);
  }

  const shapeRows = new Map();
  function swatchStyle(s) {
    const ink = shapeInk(s);
    return `--c0:${ink.c0};--c1:${ink.alt};--k:${ink.edge}`;
  }
  function shapeName(s, counts) {
    // (a name the user gave it: Rename)
    if (s.name && s.kind !== 'point') return s.name;
    if (s.kind === 'point' && s.label) return exLabel(s.label);
    // (an example's named curve: the melody's spiral, notes/sea-song)
    if (s.kind === 'curve' && s.nameKey === 'spiral') return $t('Spiral');
    // (the circle's own kind label, Region.KINDS: a translation call for the word here would be make_ru_table's first
    // call site of it, nearest the tool button's entry, whose hyphenated Russian would then name every circle)
    if (s.kind === 'curve' && s.nameKey === 'circle') return kindLabel('circle');
    const nk = nameKind(s);
    return $t('{kind} {n}', { kind: kindLabel(nk), n: counts[nk] });
  }
  // (v16.3 review user-9) a perpendicular or touching circle is numbered once, by the kind it was made as (def.nk): a
  // drag that turns it into a line for a moment renames neither it nor the shapes after it
  // ([v16.4 segments] Inside C only renames nothing: its arc or ray keeps nk; one made with the chip on Inside: nk 'arc')
  // ([v16.5 UX55] made as a hyperbolic line, def.nk 'hyper': numbered and named as one, 'Hyperbolic line 1')
  const colorName = (i) => [$tx('color', 'Blue'), $tx('color', 'Orange'), $tx('color', 'Teal'), $tx('color', 'Pink'), $tx('color', 'Green'), $tx('color', 'Purple'), $tx('color', 'Olive'), $tx('color', 'Slate')][i] || $t('Preset {x}', { x: i + 1 });
  const kindLabel = (nk) => (nk === 'hyper' ? $t('Hyperbolic line') : Region.KINDS[nk].label);
  function nameKind(s) {
    const nk = s.def && (s.def.op === 'perp' || s.def.op === 'touch') ? s.def.nk : null;
    if (nk !== 'circle' && nk !== 'line' && nk !== 'arc' && nk !== 'hyper') return s.kind;
    const region = s.kind === 'disc' || s.kind === 'halfplane';
    if (!region && !['circle', 'line', 'arc', 'ray'].includes(s.kind)) return s.kind;
    if (nk === 'arc' || nk === 'hyper') return region ? s.kind : nk;
    if (s.kind === 'arc' || s.kind === 'ray') return nk;
    return nk === 'circle' ? (region ? 'disc' : 'circle') : (region ? 'halfplane' : 'line');
  }
  // (v16.5 UX97) a menu's key for ⌘ or Ctrl with k (wave 1 merge: none on a touch screen, the phone piece's UX17 rule
  // that touch words name no keys)
  const modK = (k) => (touchUI() ? '' : (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl ') + k);
  // a copy of s beside it, selected (the row menu's Duplicate, ⌘D)
  function duplicateShape(s) {
    const target = isTarget(s), list = target ? S.targets : S.shapes;
    const c = JSON.parse(JSON.stringify(s)); c.id = 's' + takeId(); c.ci = target ? TARGET_CI[list.length % TARGET_CI.length] : list.length % 8; delete c.color; delete c.label; Region.translate(c, C(0.25, -0.25)); list.push(c); selected = c.id; zpSel = null;
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
  }
  // (v16.5 UX97) the arrows move the selected shape by one step of the drawn grid (Shift: ten), as a drag would
  // A closed polygon gains a vertex by a double-click on an edge and loses one from its menu or its vertex list. A bound
  // vertex (a construction's point) moves its binding with its index; a derived or fixed polygon is left as it is.
  const polyEditable = (s) => !!s && s.kind === 'polygon' && !s.def && !s.fixed;
  const shiftBinds = (s, from, d) => {
    if (!s.at) return;
    const at = {};
    for (const k of Object.keys(s.at)) { const m = /^v(\d+)$/.exec(k); at[m && +m[1] >= from ? 'v' + (+m[1] + d) : k] = s.at[k]; }
    s.at = at;
  };
  // the vertex of polygon s under pane pixel (x, y), or -1
  function polyVertexAt(pane, s, x, y, tol) {
    let best = -1, bd = tol;
    s.pts.forEach((p, i) => { const [px, py] = pane.w2s(C(p[0], p[1])), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  // the edge of polygon s nearest pane pixel (x, y) within tol: the vertex it follows (the last edge closes the polygon)
  // and the foot of the point on it, in the plane; null near a vertex, where the press belongs to the handle
  function polyEdgeAt(pane, s, x, y, tol) {
    const n = s.pts.length;
    if (n < 3 || n >= 256) return null;
    let best = null, bd = tol;
    for (let i = 0; i < n; i++) {
      const a = pane.w2s(C(s.pts[i][0], s.pts[i][1])), b = pane.w2s(C(s.pts[(i + 1) % n][0], s.pts[(i + 1) % n][1]));
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      if (!(L2 > 0)) continue;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)), fx = a[0] + t * dx, fy = a[1] + t * dy, d = Math.hypot(fx - x, fy - y);
      if (d < bd) { bd = d; best = { i, t, sx: fx, sy: fy }; }
    }
    if (!best) return null;
    if (polyVertexAt(pane, s, x, y, 9) >= 0) return null;
    return { i: best.i, z: pane.s2w(best.sx, best.sy) };
  }
  function polyAddVertex(s, i, z) {
    if (!polyEditable(s) || s.pts.length >= 256 || !CX.isFin(z)) return false;
    s.pts.splice(i + 1, 0, [z.re, z.im]);
    shiftBinds(s, i + 1, 1);
    if (isTarget(s)) targetsChanged(true); else shapesChanged(true);
    commit();
    requestRender('P');
    return true;
  }
  function polyRemoveVertex(id, i) {
    const s = findShape(id);
    if (!polyEditable(s) || s.pts.length <= 3 || !(i >= 0 && i < s.pts.length)) return false;
    s.pts.splice(i, 1);
    if (s.at) delete s.at['v' + i];
    shiftBinds(s, i + 1, -1);
    if (isTarget(s)) targetsChanged(true); else shapesChanged(true);
    buildShapeList();
    commit();
    requestRender('P');
    return true;
  }
  function nudgeShape(s, dx, dy, big) {
    const pane = isTarget(s) ? paneR : paneL;
    if (!pane || s.def) return false;
    // (wave 1 merge: the step of the grid as drawn, halves included, the rail piece's Constr.gridStep, as snapping uses)
    const sc = pane.view.s, d0 = Math.pow(10, Math.ceil(Math.log10(8 / sc)));
    const step = (Constr.gridStep ? Constr.gridStep(sc) : [1, 5, 10, 50, 100].map((m) => d0 * m).find((st) => st * sc >= 14) || d0 * 100) * (big ? 10 : 1);
    try { Region.translate(s, C(dx * step, dy * step)); } catch (e) { return false; }
    if (isTarget(s)) targetsChanged(true); else shapesChanged(true);
    commit();
    return true;
  }
  function moveShape(id, d) {
    const target = S.targets.some((x) => x.id === id), list = target ? S.targets : S.shapes;
    moveShapeTo(id, list.findIndex((x) => x.id === id) + d);
  }
  // a shape to place j of its list (the last is the front): Bring to front, Send to back, a dragged row
  function moveShapeTo(id, j) {
    const target = S.targets.some((x) => x.id === id), list = target ? S.targets : S.shapes;
    const i = list.findIndex((x) => x.id === id);
    if (i < 0 || j < 0 || j >= list.length || i === j) return;
    const [x] = list.splice(i, 1);
    list.splice(j, 0, x);
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
  }
  // remove the shapes and/or the targets, with undo
  function clearGroup(shapes, targets) {
    const ds = shapes && S.shapes.length, dt = targets && S.targets.length;
    if (!ds && !dt) return;
    // (the selection goes only with its own group: 'Clear targets' keeps a selected shape selected)
    if (selected && ((ds && S.shapes.some((s) => s.id === selected)) || (dt && S.targets.some((s) => s.id === selected)))) selected = null;
    if (ds) { setShapes([]); dropAllGPU(); }
    if (dt) setTargets([]);
    if (ds) shapesChanged(true);
    if (dt) targetsChanged(true);
    buildPipeline(); commit();
    undoToast(ds && dt ? $t('Shapes and targets cleared.') : ds ? $t('Shapes cleared.') : $t('Targets cleared.'));
  }
  function buildShapeList() {
    const host = $('shapeList');
    host.innerHTML = '';
    shapeRows.clear();
    const rc = $('railCount');
    if (rc) rc.textContent = String(S.shapes.length);
    // Clear is faint and inert with nothing to clear (U-a review); it stays a button so the heading does not shift
    const cb = $('clearShapes');
    if (cb) {
      const none = !S.shapes.length && !S.targets.length;
      cb.setAttribute('aria-disabled', String(none));
      cb.title = none ? $t('Nothing to clear') : $t('Remove all shapes and targets');
    }
    // two groups, always both shown: the shapes of the z-plane and the targets of the w-plane (wₖ with step k
    // focused), each with its rows (no shapes: no rows; no targets: a note on drawing one)
    // ([v16.5 UX27] the planes by their one name: "In X (z-plane)", "Targets in Y (w-plane)")
    host.append(h('div', { class: 'shapes-sub', role: 'heading', 'aria-level': '3', html: $t('<span>In <i>X</i> (<i>z</i>-plane)</span>') }));
    const counts = {}, pv = { n: 0 };
    // ([#253] then the shapes of each plane of the chain they were drawn in, by its name: "In the plane w₁")
    const rows = [];
    S.shapes.forEach((s) => { const nk = nameKind(s); if (!fixedNm(s)) counts[nk] = (counts[nk] || 0) + 1; rows.push([s, shapeRow(s, rowName(s, counts, pv), false)]); });
    for (const k of [...new Set([0, ...S.shapes.map(shapeStage)])].sort((x, y) => x - y)) {
      if (k) host.append(h('div', { class: 'shapes-sub', role: 'heading', 'aria-level': '3', html: $t('<span>In the plane {w}</span>', { w: wHtml(k) }) }));
      for (const [s, row] of rows) if (shapeStage(s) === k) host.append(row);
    }
    // the targets drawn in the w-plane, listed (and edited) like shapes; their preimages show in every view
    {
      const out = yAtF() ? '<i>w</i>' : wHtml(rightStage());
      host.append(h('div', { class: 'shapes-sub', role: 'heading', 'aria-level': '3', html: $t('<span>Targets in <i>Y</i> ({out}-plane)</span>', { out }) }));
      if (!S.targets.length) host.append(h('div', { class: 'empty-note' }, h('div', null, h('span', { html: $t('No targets yet. Draw one in <i>Y</i> (the {out}-plane).', { out }) }))));
      const tc = {};
      S.targets.forEach((s, i) => {
        const nk = nameKind(s), fx = fixedNm(s);
        if (!fx) tc[nk] = (tc[nk] || 0) + 1;
        // targets are named apart from the domain's shapes: point targets by letter (p, q, …), the rest "Target disc 1"
        // ([v16.5 fix rail-4] the unit circle or an axis of Y: by that name)
        const label = s.name && s.kind !== 'point' ? s.name : fx ? capFirst(fx) : s.kind === 'point' ? $t('Point {s}', { s: targetLabel(s, S.targets.filter((x) => x.kind === 'point').indexOf(s)) }) : $t('Target {x} {x2}', { x: kindLabel(nk).toLowerCase(), x2: tc[nk] });
        host.append(shapeRow(s, label, true, i));
      });
    }
    updateShapeList();
    ctxChanged();
    Construct.orderRows(); Construct.markLinks(touchUI() ? selected : null); requestRender('P');   // (v16 [C21]; helpers under their owner; the Construction view)
  }
  // the phone's context bar follows the selection, the polygon being drawn and the listening (Phone.ctx re-renders only on a change)
  function ctxChanged() { if (Phone.isOn && Phone.isOn()) Phone.ctx(); }
  const dragId = () => { const b = document.querySelector('#shapeList .shape.dragging'); return b ? b.getAttribute('data-id') : null; };
  function shapeRow(s, label, target) {
    const list = target ? S.targets : S.shapes;
    const changed = () => (target ? targetsChanged(true) : shapesChanged(true));
    const hidden = s.visible === false;
    const sw = h('span', { class: 'swatch', 'data-kind': kindType(s), style: swatchStyle(s) });
    const d = h('span', { class: 'd' });
    const eye = h('button', { class: 'icon-btn eye', 'aria-label': `${hidden ? $t('Show') : $t('Hide')} ${label}`, 'data-tip': hidden ? $t('Show') : $t('Hide'), html: hidden ? ICONS.eyeOff : ICONS.eye,
      onclick: (e) => { e.stopPropagation(); s.visible = hidden; changed(); commit(); } });
    // the ⋯ menu, from the row's button or (a phone) the context bar's
    const openMore = (anchor) => {
        const items = [];
        // a curve of the domain: its line integral (as a right click on the curve opens it)
        if (!target && kindType(s) !== 'point' && s.kind !== 'cgrid' && s.kind !== 'pgrid') {
          items.push({ label: $t('Integrate {x} along it', { x: fnText() }), run: () => { const r = anchor.getBoundingClientRect(); return openIntegralPop(s.id, r.right, r.top); } });
          // (v16.5 UX72: Listen along, as in the plane's menu, with the same verb; sound off: it offers to turn it on)
          if (SND) items.push({ label: snd.play ? $t('Stop listening') : $t('Listen along it'), run: () => (snd.play ? sndStopPlay(true) : sndListenAsk(s)) });
          items.push('sep');
        }
        items.push({ label: $t('Rename'), run: () => startRename(s) });
        if (kindType(s) === 'area') items.push({ label: s.complement ? $t('Use the set itself') : $t('Use complement'), run: () => { s.complement = !s.complement; changed(); commit(); } });
        items.push({ label: $t('Duplicate'), key: modK('D'), run: () => duplicateShape(s) });
        // ([v16.5 UX95] the colours by their names, not "Preset 1"–"Preset 8")
        items.push({ label: $t('Color'), kids: [...TH.c.map((cc, i) => ({ label: colorName(i), swatch: cc, run: () => { s.ci = i; delete s.color; changed(); commit(); } })), { label: $t('Custom color…'), run: () => pickColor(s) }] });
        items.push({ label: $t('Bring forward'), key: modK(']'), disabled: list.indexOf(s) === list.length - 1, run: () => moveShape(s.id, 1) });
        items.push({ label: $t('Send backward'), key: modK('['), disabled: list.indexOf(s) === 0, run: () => moveShape(s.id, -1) });
        items.push('sep');
        // ([v16.5 UX95] Clear shapes, which deletes them all, is the Shapes heading's, not one shape's)
        items.push({ label: $t('Delete'), icon: 'trash', key: touchUI() ? '' : '⌫', danger: true, run: () => deleteShape(s.id) });
        Construct.rowMenu(s, items);   // (v16: Make free, Other point, …)
        openMenu(anchor, items);
    };
    const more = h('button', { class: 'icon-btn more', 'aria-label': $t('More actions for {label}', { label }), 'aria-haspopup': 'menu', 'data-tip': $t('More'), html: ICONS.more,
      onclick: (e) => { e.stopPropagation(); openMore(e.currentTarget); } });
    const name = h('span', { class: 'k' }, label);
    // the name is the row's button; the eye and ⋯ buttons sit beside it, not inside it
    const nameBtn = h('div', { class: 'shape-name', role: 'button', tabindex: 0, 'aria-pressed': String(selected === s.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); } } }, name, d);
    const row = h('div', { class: 'shape-row',
      onclick: (e) => {
        // a second click on the name within 450 ms renames it (a laptop; the row is rebuilt by the first click, so the
        // pair is counted here, not by dblclick)
        const now = performance.now();
        if (!touchUI() && e && e.target && e.target.closest && e.target.closest('.shape-name .k') && lastNameClick.id === s.id && now - lastNameClick.t < 450) { lastNameClick = { id: null, t: 0 }; startRename(s); return; }
        lastNameClick = { id: s.id, t: now };
        selected = selected === s.id ? null : s.id; zpSel = null; if (!target && selected === s.id && shapeStage(s) !== leftStage()) setFocus(shapeStage(s) ? shapeStage(s) + 1 : 0); buildShapeList(); requestRender('L', 'R', 'P'); },
      onpointerenter: () => { hoverShape = s.id; Construct.markLinks(s.id); requestRender('L', 'R'); },
      onpointerleave: () => { if (hoverShape === s.id) { hoverShape = null; Construct.markLinks(touchUI() ? selected : null); requestRender('L', 'R'); } } },
    sw, nameBtn, eye, more);
    const box = h('div', { class: 'shape' + (selected === s.id ? ' sel' : '') + (hidden ? ' hidden-shape' : ''), 'data-id': s.id }, row);
    // (v16: a construction's fields are its definition: the Inspector, ⋯. [v17 D4] on the laptop the Inspector edits a free
    // shape; the row keeps its editor on a phone, with the panel hidden, and for a shape with bound handles, whose
    // Inspector view is its construction's)
    const ed = selected === s.id && !s.def && (!inspEditsShapes() || s.at) ? shapeEditor(s) : null;
    if (ed) box.append(ed);
    shapeRows.set(s.id, { d, box, sw, ed, kind: rowKind(s), row, k: name, more: openMore });
    // a row dragged onto another takes its place in the list (the laptop; a phone has Move in the ⋯ menu)
    if (!touchUI() && list.length > 1) {
      box.draggable = true;
      box.addEventListener('dragstart', (e) => { if (e.target !== box) return; e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; box.classList.add('dragging'); });
      box.addEventListener('dragend', () => { box.classList.remove('dragging'); for (const b of document.querySelectorAll('#shapeList .shape.drop-over')) b.classList.remove('drop-over'); });
      box.addEventListener('dragover', (e) => { if (!e.dataTransfer.types.includes('text/plain') || !list.some((x) => x.id === dragId())) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; box.classList.add('drop-over'); });
      box.addEventListener('dragleave', () => box.classList.remove('drop-over'));
      box.addEventListener('drop', (e) => { e.preventDefault(); box.classList.remove('drop-over'); const id = e.dataTransfer.getData('text/plain'); if (list.some((x) => x.id === id)) moveShapeTo(id, list.indexOf(s)); });
    }
    return box;
  }
  // Rename: the name becomes a field in its row; Enter or leaving keeps it, Esc leaves it as it was, and an empty name
  // goes back to the automatic one ("Circle 1"). A point's name is its label (it names the point in the plane too)
  let lastNameClick = { id: null, t: 0 };
  function startRename(s) {
    const r = shapeRows.get(s.id);
    if (!r || !r.k || r.k.querySelector('input')) return;
    const target = isTarget(s), field = s.kind === 'point' ? 'label' : 'name', cur = r.k.textContent;
    const inp = h('input', { class: 'rename-in', type: 'text', value: s[field] ? (field === 'label' ? exLabel(s[field]) : s[field]) : cur, maxlength: 40, spellcheck: false, 'aria-label': $t('Name of {label}', { label: cur }) });
    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      const v = inp.value.trim().slice(0, 40);
      if (keep && v !== cur && (v || s[field])) {
        if (v) s[field] = v; else delete s[field];
        if (target) targetsChanged(true); else shapesChanged(true);
        commit();
      }
      buildShapeList();
    };
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); finish(true); } else if (e.key === 'Escape') { e.preventDefault(); finish(false); } });
    inp.addEventListener('blur', () => finish(true));
    for (const t of ['click', 'pointerdown', 'dblclick']) inp.addEventListener(t, (e) => e.stopPropagation());
    r.k.textContent = '';
    r.k.append(inp);
    inp.focus(); inp.select();
  }
  function pickColor(s) {
    const inp = h('input', { type: 'color', value: s.color || shapeInk(s).c0, style: 'position:fixed;left:-100px;top:0;opacity:0' });
    document.body.append(inp);
    inp.addEventListener('input', () => { s.color = inp.value; shapesChanged(false); const r = shapeRows.get(s.id); if (r) r.sw.style.cssText = swatchStyle(s); });
    inp.addEventListener('change', () => { commit(); inp.remove(); });
    inp.click();
  }
  // the kind a row was built for: a shape slid over ∞ on a globe changes kind (panels.md 9.4), and its row's name and
  // editor fields follow
  const rowKind = (s) => s.kind + (s.complement ? '~' : '');
  function updateShapeList() {
    for (const s of S.shapes.concat(S.targets)) {
      const r = shapeRows.get(s.id);
      if (r && r.kind !== rowKind(s)) { buildShapeList(); return; }
    }
    for (const s of S.shapes.concat(S.targets)) {
      const r = shapeRows.get(s.id);
      if (!r) continue;
      if (r.ed && r.ed._sync) r.ed._sync();
      r.sw.style.cssText = swatchStyle(s);
      let tex;
      try { tex = shapeTexOf(s); } catch (e) { tex = '\\text{?}'; }
      if (s.complement) tex = $t('\\text{not }%{tex}', { tex });
      // a target is a set in Y, written in Y's variable (P13: w, or w_k with step k focused), so the row states what
      // X shades (the stored target is unchanged)
      if (isTarget(s)) { const yv = yAtF() ? 'w' : `w_{${rightStage()}}`; tex = tex.replace(/(^|[^\\a-zA-Z])z(?![a-zA-Z])/g, `$1${yv}`); }
      // ([#253] a shape of a plane of the chain, in that plane's variable)
      else if (shapeStage(s)) tex = tex.replace(/(^|[^\\a-zA-Z])z(?![a-zA-Z])/g, `$1w_{${shapeStage(s)}}`);
      r.d.title = texTitle(tex);   // (the spoken text, in the current language: not the raw LaTeX)
      if (Construct.row(s, r)) continue;   // (v16: definitions, reasons)
      const er = s.undef || s._err;
      if (er) { r.d.innerHTML = ''; r.d.dataset.tex = ''; r.d.append(h('span', { class: 'err-msg' }, er)); } else TeX.set(r.d, tex);
      const eye = r.row && r.row.querySelector('.eye');
      if (eye) eye.disabled = !!s.undef;
    }
  }
  function shapeEditor(s) {
    const box = h('div', { class: 'shape-edit' });
    const target = isTarget(s);
    const shapesChanged = (structural) => (target ? targetsChanged(structural) : shapesChangedAll(structural));
    const lab = (t) => h('label', { html: t });
    const errEl = (fieldEl) => { let e = fieldEl.querySelector('.field-err'); if (!e) { e = h('div', { class: 'field-err', role: 'alert' }); fieldEl.append(e); } return e; };
    const showErr = (fieldEl, inp, msg) => {
      inp.classList.toggle('bad', !!msg); inp.setAttribute('aria-invalid', String(!!msg));
      if (msg) errEl(fieldEl).textContent = msg; else { const e = fieldEl.querySelector('.field-err'); if (e) e.remove(); }
    };
    const fmtNumIn = (x) => String(+(+x).toPrecision(6));
    // the fields follow a shape edited on the canvas (a drag, a slide on a globe); the field being typed in and an
    // invalid entry keep their text
    const syncs = [];
    box._sync = () => { for (const f of syncs) f(); };
    const follow = (inp, text) => syncs.push(() => {
      if (document.activeElement === inp || inp.classList.contains('bad')) return;
      let t;
      try { t = text(); } catch (e) { return; }
      if (t != null && inp.value !== t) inp.value = t;
    });
    // (v16 review user-3) a handle bound to a point is not typed into: its field reads "= z₀" (read-only, with the link
    // glyph) and offers Make free, which unbinds that handle only (one undo step)
    const boundField = (key, label) => {
      if (!(s.at && s.at[key])) return null;
      const nm = Construct.refName(s.at[key]);
      const inp = h('input', { class: 'inp mono cm-bound', value: '= ' + nm, readonly: '', 'aria-readonly': 'true', title: $t('follows {x}', { x: nm }), tabindex: -1 });
      const free = h('button', { type: 'button', class: 'btn cm-free', onclick: () => cmApi().unbind(s.id, key) }, $t('Make free'));
      return h('div', { class: 'field cm-boundf' }, lab(label), inp, free);
    };
    const ptField = (key, label) => {
      const bf = boundField(key, label);
      if (bf) return bf;
      // (v15: a field may hold a formula of the shared numbers, kept in s.bind)
      // ([v16.5 UX44] a point takes the full row and reads 4 significant digits until it is clicked into, then 6)
      const sig4 = (x) => +(+x).toPrecision(4);
      const ptText = (dp = 6) => (s.bind && s.bind[key]) || (dp === 4 ? CX.fmt(C(sig4(s[key][0]), sig4(s[key][1])), 6) : CX.fmt(C(s[key][0], s[key][1]), dp));
      const inp = h('input', { class: 'inp mono', value: ptText(4), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-fx': '' });
      follow(inp, () => (s[key] ? ptText(4) : null));
      const f = h('div', { class: 'field cxf' }, lab(label), inp);
      const now = () => JSON.stringify([s[key], s.bind && s.bind[key]]);
      let start = now();
      inp.addEventListener('focus', () => { start = now(); if (!inp.classList.contains('bad') && s[key]) inp.value = ptText(); });
      inp.addEventListener('blur', () => { if (!inp.classList.contains('bad') && s[key] && now() === start) inp.value = ptText(4); });
      inp.addEventListener('input', () => {
        try { const v = Expr.constValue(inp.value); s[key] = [v.re, v.im]; bindField(s, key, inp.value); showErr(f, inp, ''); shapesChanged(false); } catch (e) { showErr(f, inp, e.unknown ? e.message : $t('Expected a number like 1+2i or e^{i\\pi/4}')); }
      });
      inp.addEventListener('change', () => {
        if (inp.classList.contains('bad')) { inp.value = ptText(); showErr(f, inp, ''); return; }
        if (now() !== start) commit();
      });
      return f;
    };
    // positive radii, whole counts in range; an invalid value is shown but never applied
    // ([#299 review] an equipotential of a Julia set: above the critical level of its c, |Φ_M(c)|^{1/2}, too)
    const dhRho = s.kind === 'dheq' && Array.isArray(s.c) ? CX.dhCritRho(C(s.c[0], s.c[1]), 64) : 1;
    const LIMITS = { r: s.kind === 'dheq' ? [dhRho * (1 + 1e-9), Infinity, dhRho > 1 ? $t('The level |Φ| must be more than {r} here (the critical level of this c)', { r: CX.fmtNum(dhRho, 4) }) : $t('The level |Φ| must be more than 1')] : [s.kind === 'sector' ? 0 : 1e-9, Infinity, s.kind === 'sector' ? $t('The radius must be 0 (unbounded) or more') : $t('The radius must be positive')],
      r1: [0, Infinity, $t('Radii must be 0 or more')], r2: [0, Infinity, $t('Radii must be 0 or more')],
      n: [1, 60, $t('Use a whole number from 1 to 60')], nc: [1, 60, $t('Use a whole number from 1 to 60')], nr: [1, 60, $t('Use a whole number from 1 to 60')] };
    const numField = (key, label, step = 'any') => {
      const bf = boundField(key, label);
      if (bf) return bf;
      // (v15: a text field, so that it takes formulas of the shared numbers: 2a, ρ/2)
      const numText = (sig) => (s.bind && s.bind[key]) || (sig ? String(+(+s[key]).toPrecision(sig)) : fmtNumIn(s[key]));
      const inp = h('input', { class: 'inp mono', type: 'text', step, value: numText(4), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-fx': '' });
      follow(inp, () => (s[key] != null ? numText(4) : null));
      const l = lab(label);
      const f = h('div', { class: 'field' }, l, inp);
      const now = () => JSON.stringify([s[key], s.bind && s.bind[key]]);
      let start = now();
      inp.addEventListener('focus', () => { start = now(); if (!inp.classList.contains('bad') && s[key] != null) inp.value = numText(); });
      inp.addEventListener('blur', () => { if (!inp.classList.contains('bad') && s[key] != null && now() === start) inp.value = numText(4); });
      const readNum = (t) => { const n = Number(t); return Number.isFinite(n) ? n : Params.evalReal(t); };
      const check = (v) => {
        if (!Number.isFinite(v)) return $t('Enter a number');
        const lim = LIMITS[key];
        if (!lim) return '';
        if (step === 1 && !Number.isInteger(v)) return lim[2];
        return v < lim[0] || v > lim[1] ? lim[2] : '';
      };
      inp.addEventListener('input', () => {
        let v = NaN, msg;
        try { v = inp.value.trim() === '' ? NaN : readNum(inp.value); msg = inp.value.trim() === '' ? $t('Enter a number') : check(v); } catch (e) { msg = e.unknown ? e.message : $t('Enter a number'); }
        showErr(f, inp, msg);
        if (!msg) { s[key] = v; bindField(s, key, inp.value); shapesChanged(false); }
      });
      inp.addEventListener('change', () => {
        if (inp.classList.contains('bad')) { inp.value = numText(); showErr(f, inp, ''); return; }
        if (now() !== start) commit();
      });
      scrubbable(l, inp, step === 1 ? 1 : 0.01, step === 1);
      return f;
    };
    switch (s.kind) {
      case 'point': box.append(ptField('p', target ? '<i>w</i>' : '<i>z</i>')); break;
      case 'segment': case 'line': case 'ray': box.append(ptField('a', $t('start <i>a</i>')), ptField('b', $t('end <i>b</i>'))); break;
      case 'halfplane': box.append(ptField('a', $t('from <i>a</i>')), ptField('b', $t('to <i>b</i>'))); break;
      case 'rect': box.append(ptField('a', $t('corner <i>a</i>')), ptField('b', $t('corner <i>b</i>'))); break;
      case 'circle': case 'disc': box.append(ptField('c', $t('center <i>c</i>')), numField('r', $t('radius <i>r</i>'))); break;
      case 'annulus': box.append(ptField('c', $t('center <i>c</i>')), numField('r1', '<i>r</i>₁'), numField('r2', '<i>r</i>₂')); break;
      case 'sector': box.append(ptField('c', $t('vertex <i>c</i>')), numField('t1', '<i>θ</i>₁ (°)'), numField('t2', '<i>θ</i>₂ (°)'), numField('r', $t('radius (0 = ∞)'))); break;
      case 'arc': box.append(ptField('a', $tx('arc', 'start')), ptField('m', $tx('arc', 'through')), ptField('b', $tx('arc', 'end'))); break;
      case 'polygon': {
        // the vertices, folded: each with its place and a way to remove it (a polygon keeps at least three)
        const list = h('div', { class: 'poly-verts' });
        const fill = () => {
          list.replaceChildren(...s.pts.map((p, i) => h('div', { class: 'poly-vert' },
            h('span', { class: 'mono' }, `${i + 1}: ${CX.fmt(C(p[0], p[1]), 4)}`),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': $t('Remove vertex {i}', { i: i + 1 }), 'data-tip': $t('Remove vertex'), disabled: s.pts.length <= 3 || !polyEditable(s), html: ICONS.close,
              onclick: () => polyRemoveVertex(s.id, i) }))));
        };
        fill();
        box.append(h('details', { class: 'field wide poly-det' }, h('summary', null, $t('Vertices ({n})', { n: s.pts.length })), list));
        break;
      }
      case 'cgrid': box.append(ptField('a', $t('corner <i>a</i>')), ptField('b', $t('corner <i>b</i>')), numField('n', $t('divisions'), 1)); break;
      // ([issue #260] an external ray: its angle in turns, exact as p/q; an equipotential: its level |Φ| = r; both of M,
      // or of the Julia set of z² + c when they were added from a Böttcher step: its c, which may be a shared number)
      case 'dhray': case 'dheq': {
        const txt = (key, label, check) => {
          const inp = h('input', { class: 'inp mono', value: String(s[key] ?? ''), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-fx': '' });
          const f = h('div', { class: 'field' }, lab(label), inp);
          const was = String(s[key] ?? '');
          inp.addEventListener('input', () => { const msg = check(inp.value); showErr(f, inp, msg); if (!msg) { s[key] = inp.value.trim(); shapesChanged(false); } });
          inp.addEventListener('change', () => { if (inp.classList.contains('bad')) { inp.value = String(s[key] ?? ''); showErr(f, inp, ''); return; } if (String(s[key]) !== was) commit(); });
          return f;
        };
        if (s.kind === 'dhray') box.append(txt('theta', $t('angle <i>θ</i> (turns)'), (v) => (Region.dhAngle(v) == null ? $t('Enter a fraction p/q or a decimal from 0 to 1, such as 1/3') : '')));
        else box.append(numField('r', $t('level |Φ|')));
        if (s.c != null) box.append(ptField('c', '<i>c</i>'));
        break;
      }
      case 'pgrid': box.append(ptField('c', $t('center <i>c</i>')), numField('r', $t('radius <i>r</i>')), numField('nc', $t('circles'), 1), numField('nr', $t('rays'), 1)); break;
      case 'formula': {
        const inp = h('input', { class: 'inp math-src', value: (s.bind && s.bind.expr) || s.expr, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-fx': '' });
        inp.addEventListener('input', () => {
          // (Russian: a comma between digits read as two conditions keeps the set, with the warning as the tip: verify-5)
          try { const warn = []; Expr.compileLevel(Expr.parse(inp.value, { allowRel: true, notes: warn })); setExprBind(s, inp.value); inp.classList.remove('bad'); if (warn.length) inp.setAttribute('data-tip', warn.join(' ')); else inp.removeAttribute('data-tip'); shapesChanged(false); } catch (e) { inp.classList.add('bad'); }
        });
        inp.addEventListener('change', () => commit());
        box.append(h('div', { class: 'field wide' }, lab($tx('field', 'set')), inp));
        break;
      }
      case 'fcurve': {
        // the equation stays a curve while typed (an area or a refused equation keeps the last good one); the notes
        // are the curve engine's: the formula's own and this window's trace's (budget, touching zeros)
        const inp = h('input', { class: 'inp math-src', value: (s.bind && s.bind.expr) || s.expr, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-fx': '' });
        const fld = h('div', { class: 'field wide' }, lab($tx('field', 'equation')), inp);
        const nt = h('div', { class: 'lbl note' });
        const notes = () => {
          let t = [];
          try {
            const d = Region.curveDesc(s);
            t = d.notes.slice();
            for (const x of Region.fcurveTrace(s, target ? targetWin() : clipWin).notes) if (!t.includes(x)) t.push(x);
          } catch (e) { t = []; }
          nt.textContent = t.join(' ');
          nt.hidden = !t.length;
        };
        inp.addEventListener('input', () => {
          let msg = '';
          try { Curves.fromFormula(inp.value); } catch (e) { msg = e.message; }
          showErr(fld, inp, msg);
          if (!msg) { setExprBind(s, inp.value); shapesChanged(false); notes(); }
        });
        inp.addEventListener('change', () => { if (inp.classList.contains('bad')) { inp.value = (s.bind && s.bind.expr) || s.expr; showErr(fld, inp, ''); return; } commit(); });
        notes();
        box.append(fld, nt);
        break;
      }
    }
    if (s.kind === 'point') {
      const inp = h('input', { class: 'inp', value: exLabel(s.label) || '', placeholder: 'a', spellcheck: 'false' });
      inp.addEventListener('input', () => { s.label = inp.value; requestRender('L', 'R'); });
      inp.addEventListener('change', () => { commit(); buildShapeList(); });
      box.append(h('div', { class: 'field' }, lab($tx('field', 'label')), inp));
    }
    if (kindType(s) === 'area') box.append(checkEl('cmp_' + s.id, s.complement, $t('Use complement'), (v) => { s.complement = v; shapesChanged(true); commit(); }));
    let unb = false;
    try { unb = kindType(s) === 'area' && !Region.bboxOf(s) && !formulaBounded(s); } catch (e) { unb = true; }
    // ([v16.5 UX92] only for a region that goes on forever; UX95 in plain words)
    if (unb) box.append(h('div', { class: 'lbl note', 'data-unb': '' }, $t('Goes on forever; drawn faded towards the edge.')));
    // (v16.5 UX72) Listen along from the selected curve's editor too, as in its ⋯ (sound off: it offers to turn it on);
    // on a phone this is the way in without a long press on a thin line
    if (SND && !target && kindType(s) !== 'point' && s.kind !== 'cgrid' && s.kind !== 'pgrid')
      box.append(h('div', { class: 'row snd-edit' }, h('button', { type: 'button', class: 'btn', 'data-act': 'listen-along',
        onclick: () => (snd.play ? sndStopPlay(true) : sndListenAsk(s)) }, $t('Listen along it'))));
    // (#361: a field's label names its input for a screen reader, by aria-labelledby, not a for: a click on the label,
    // which scrubs a number, keeps doing only that)
    for (const f of box.querySelectorAll('.field')) {
      const l = f.querySelector(':scope > label'), i = f.querySelector(':scope > input');
      if (l && i && !i.hasAttribute('aria-labelledby')) { l.id = l.id || `fl${++fieldLabelSeq}`; i.setAttribute('aria-labelledby', l.id); }
    }
    return box;
  }
  let fieldLabelSeq = 0;
  // ---------------- [v17 D4] the Inspector edits the selected shape (plan/ux-audit/REPORT.md D4, issue #26) ----------------
  // On the laptop the selected free shape is edited in the Inspector, with full-width fields, its Used by list and a way
  // back to the step it replaced there; a construction keeps its own view (construct.js). The Shapes list keeps the
  // editor under the row on a phone (its sheets) and while the Inspector panel is hidden.
  const inspEditsShapes = () => !S.hideRight && !document.documentElement.classList.contains('ph');
  let shapeEdWhere = null;   // (applyLayout: where the editor was last built)
  function shapeInspSel() {
    if (selected == null || !inspEditsShapes()) return null;
    const s = findShape(selected);
    return s && !s.def && !s.at ? s : null;
  }
  const shapeInspSig = () => { const s = shapeInspSel(); return s ? `SH#${s.id}#${rowKind(s)}#${isTarget(s) ? 'y' : 'x'}#${I18N.lang}#${selOf()}#${s.kind === 'polygon' ? s.pts.length : ''}` : null; };
  function shapeInspBuild() {
    const s = shapeInspSel();
    const label = Construct.shapeLabel(s);
    const back = selOf();
    // (‹ Back to f₂: the step, or F, the Inspector showed before the shape was selected)
    const backBtn = back ? h('button', { type: 'button', class: 'linkbtn sh-back', onclick: () => { selected = null; buildShapeList(); requestRender('L', 'R', 'P'); },
      html: '‹ ' + (back === 'F' ? $t('Back to {f}', { f: '<i>F</i>' }) : $t('Back to {f}', { f: fsub(back) })) }) : null;
    const crumbs = h('div', { class: 'sh-crumbs' }, h('span', { class: 'sh-path' }, isTarget(s) ? $t('Targets') : $t('Shapes'), ' › ', label), backBtn);
    const head = h('div', { class: 'ihead sh-ihead' }, h('span', { class: 'swatch', 'data-kind': kindType(s), style: swatchStyle(s) }), h('span', { class: 'ttl' }, label),
      h('span', { class: 'sh-in' }, isTarget(s) ? $t('in Y') : $t('in X')));
    const ed = shapeEditor(s);
    const used = h('div', { class: 'cm-ichips sh-used' });
    const acts = h('div', { class: 'sh-acts' },
      h('button', { type: 'button', class: 'btn', onclick: () => duplicateShape(s) }, $t('Duplicate')),
      h('button', { type: 'button', class: 'btn', onclick: () => deleteShape(s.id) }, $t('Delete')));
    const root = h('div', { class: 'sh-insp', 'data-id': s.id }, crumbs, head, ed, h('div', { class: 'cm-ilabel' }, $t('Used by')), used, acts);
    return { kind: 'shape', id: s.id, root, ed, used, head };
  }
  function shapeInspFill(E) {
    const s = findShape(E.id);
    if (!s) return;
    if (E.ed._sync) E.ed._sync();
    const sw = E.head.querySelector('.swatch'), st = swatchStyle(s);
    if (sw.style.cssText !== st) sw.style.cssText = st;
    const us = Construct.usedBy(s.id);
    const sig = us.join(',') + '|' + I18N.lang;
    if (E.used.dataset.sig === sig) return;
    E.used.dataset.sig = sig;
    E.used.replaceChildren(...(us.length ? us.map((id) => { const u = findShape(id); return h('button', { type: 'button', class: 'cm-chipbtn', onclick: () => { selected = id; buildShapeList(); requestRender('L', 'R', 'P'); } }, u ? Construct.shapeLabel(u) : id); })
      : [h('span', { class: 'cm-none' }, $t('nothing yet'))]));
  }

  // ---------------- formula region input ----------------
  // example sets offered by the command palette's "Region formulas" group (the sidebar has no example chips, item 4)
  const REGION_EXAMPLES = ['|z|<1', '0<\\Im z<\\pi', '1<|z|<2', '|\\arg z|<\\pi/4', '|z-1|+|z+1|<3', '\\Re z>0', '|z^2-1|<1', '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0'];
  // the plane a formula's set lives in, from its variable: 'w' (a target of the w-plane), 'z' (a shape of the
  // z-plane; also a set in neither variable), or 'both' (an error: use z or w)
  function formulaPlane(v) {
    const t = String(v).replace(/\\[a-zA-Z]+/g, ' ');
    const w = /w/.test(t), z = /z/.test(t);
    return w && z ? 'both' : w ? 'w' : 'z';
  }
  // ---- curve formulas (equations: 1-dimensional regions, notes/curves-design.md 4) ----
  // curvePlan(src) -> {desc, shapes: [shape params], what (a phrase: 'a line', '2 circles', 'a traced curve'), notes}
  // An equation whose every piece Curves recognizes exactly becomes the app's own shapes (line, ray, segment, circle,
  // arc, point: with their handles); otherwise one 'fcurve' shape holds the source text (its exact pieces are still
  // drawn exactly, the rest traced per window). A lone exact shape keeps the formula as its row's TeX (srcTex) while
  // its geometry is as recognized (srcKey). Throws the classification's message (Expr.REL_MSG) for a refused equation.
  // Isolated zeros (|z^2 - 1| = 0, |\sin z| = 0) become point shapes: the ones in win (the plane's view; a periodic
  // set has infinitely many).
  function curvePlan(src, win) {
    const desc = Curves.fromFormula(src);
    const notes = desc.notes.slice();
    let shapes = [];
    let someZeros = false;
    if (desc.pieces.every((pc) => pc.exact || pc.kind === 'zeros')) {
      // one shape per distinct exact shape: 'Re z = 0 or Re z = 0' is one line
      const keys = new Set();
      for (const pc of desc.pieces) for (const sh of pc.exact || []) {
        const k = JSON.stringify(sh);
        if (keys.has(k)) continue;
        keys.add(k);
        shapes.push(JSON.parse(k));
      }
      if (desc.pieces.some((pc) => pc.kind === 'zeros') && win) {
        const seen = new Set(shapes.filter((x) => x.kind === 'point').map((x) => x.p.join(',')));
        const tr = Curves.trace(desc, win);
        for (const t of tr.notes) if (/^Only some of the zeros/.test(t)) { someZeros = true; if (!notes.includes(t)) notes.push(t); }
        for (const { p } of tr.points) {
          const k = [p.re, p.im].join(',');
          if (seen.has(k)) continue;
          if (shapes.length >= 64) { someZeros = true; continue; }
          seen.add(k);
          shapes.push({ kind: 'point', p: [p.re, p.im] });
        }
      }
      if (!shapes.length) throw new Error(notes[0] && !desc.pieces.some((pc) => pc.kind === 'zeros') ? notes[0] : $t('This equation has no points in view'));
      if (shapes.length === 1 && shapes[0].kind !== 'point') shapes[0].srcTex = desc.tex;
    } else {
      shapes = [{ kind: 'fcurve', expr: src }];
      // a traced curve with nothing in view says so (instead of an empty row)
      if (win) {
        let tr = null;
        try { tr = Curves.trace(desc, win); } catch (e) { tr = null; }
        if (tr && !tr.polys.length && !tr.points.length && !tr.notes.length) notes.push($t('Nothing of this curve was found in view: it lies elsewhere, or it is too small or too thin to trace here.'));
      }
    }
    const n = {};
    for (const sh of shapes) n[sh.kind] = (n[sh.kind] || 0) + 1;
    const NAME = {
      line: (c) => (c === 1 ? $t('a line') : $tn('{n} line', '{n} lines', c)), ray: (c) => (c === 1 ? $t('a ray') : $tn('{n} ray', '{n} rays', c)),
      segment: (c) => (c === 1 ? $t('a segment') : $tn('{n} segment', '{n} segments', c)), circle: (c) => (c === 1 ? $t('a circle') : $tn('{n} circle', '{n} circles', c)),
      arc: (c) => (c === 1 ? $t('an arc') : $tn('{n} arc', '{n} arcs', c)), point: (c) => (c === 1 ? $t('a point') : $tn('{n} point', '{n} points', c)),
      fcurve: (c) => (c === 1 ? $t('a traced curve') : $tn('{n} traced curve', '{n} traced curves', c)),
    };
    let what = Object.entries(n).map(([k, c]) => NAME[k](c)).join($t(' and '));
    if (desc.pieces.some((pc) => pc.kind === 'zeros')) what += someZeros ? $t(' (some of the zeros in view)') : $t(' (the zeros in view)');
    return { desc, shapes, what, notes };
  }
  // the shapes of curvePlan(src), added as one undoable step (target: in the w-plane)
  function addCurveShapes(plan, target) {
    let last = null;
    for (const p of plan.shapes) {
      const s = newShape(p.kind, p, target);
      if (s.srcTex) s.srcKey = shapeKey(s);
      (target ? S.targets : S.shapes).push(s);
      last = s;
    }
    if (!last) return;
    selected = last.id; zpSel = null;
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
  }
  // a shape's TeX: a shape added from an equation shows the equation while its geometry is unchanged
  function shapeTexOf(s) {
    if (s.srcTex && s.srcKey === shapeKey(s)) return s.srcTex;
    return Region.KINDS[s.kind].tex(s);
  }
  function setupFormula() {
    const inp = $('formulaInput'), prev = $('formulaPrev'), tag = $('formulaPlane'), note = $('formulaNote');
    let plan = null;
    const setNote = (t) => { if (!note) return; note.textContent = t || ''; note.hidden = !t; };
    // one Add (item 4): the set's variable decides where it goes, and the tag at the end of the preview names that
    // plane before Add (z: a shape of the z-plane; w: a target of the w-plane, wₖ with step k focused)
    const plane = () => formulaPlane(inp.value);
    const check = () => {
      const v = inp.value.trim();
      tag.textContent = '';
      plan = null;
      setNote('');
      if (!v) { prev.innerHTML = ''; prev.dataset.tex = ''; inp.classList.remove('bad'); return null; }
      try {
        const pl = plane();
        if (pl === 'both') throw new Error($t('Use z or w, not both: z adds a shape, w adds a target'));
        const warn = [];
        const ast = Expr.parse(v, { allowRel: true, notes: warn });
        // an equation is a curve (Curves), inequalities an area (as before); anything else says why not
        const dm = Curves.dimOf(ast);
        if (dm.dim === 'curve') {
          plan = curvePlan(v, pl === 'w' ? targetWin() : viewBox(S.srcView));
          setNote((pl === 'w' ? $t('Adds {what} as a target.', { what: plan.what }) : $t('Adds {what}.', { what: plan.what })) + (plan.notes.length ? ' ' + plan.notes.join(' ') : '') + (warn.length ? ' ' + warn.join(' ') : ''));
        } else if (dm.dim === 'error') throw new Error(dm.error);
        else { Expr.compileLevel(ast); if (warn.length) setNote(warn.join(' ')); }
        inp.classList.remove('bad');
        TeX.set(prev, Expr.toTex(ast, pl === 'w' ? { s: 'w', p: 4 } : undefined).s);
        tag.textContent = pl === 'w' ? `w${yAtF() ? '' : sub(rightStage())}-plane` : $t('z-plane');
        return v;
      } catch (e) {
        plan = null;
        setNote('');
        inp.classList.add('bad');
        prev.dataset.tex = '';
        prev.innerHTML = '';
        prev.append(h('span', { class: 'err' }, e.message));
        return null;
      }
    };
    const add = () => {
      // (v16.5 UX32: Add on an empty field puts the cursor there and says what to type)
      if (!inp.value.trim()) { inp.focus(); setNote($t('Type a set, such as |z − 1| < 2, or a curve, such as Re z = 0.')); return; }
      let v = check();
      // v15: one new name in the formula (Re z = a) adds the number, then the shape
      if (!v) { const u = Params.unknownIn(inp.value); if (u.length === 1 && !Params.check(u[0]).error) { Params.add(u[0]); v = check(); } }
      if (!v) return;
      const w = plane() === 'w';
      shapeVia = 'formula';
      try {
      // a formula with names stays one formula shape (its text keeps the names; the shape draws their values)
      if (Params.namesIn(v).length) { if (!w && leftStage() > 0) setFocus(0); addShape(newShape(plan ? 'fcurve' : 'formula', { expr: Params.resolve(v), bind: { expr: v } }, w), w); }
      else if (plan) { if (!w && leftStage() > 0) setFocus(0); addCurveShapes(plan, w); }
      else if (w) addShape(newShape('formula', { expr: v }, true), true);
      else { if (leftStage() > 0) setFocus(0); addShape(newShape('formula', { expr: v })); }
      } finally { shapeVia = null; }
      inp.value = ''; check();
    };
    // a formula wider than the well fades out at its end until it is scrolled there (U-a review)
    const ovf = () => prev.classList.toggle('ovf', prev.scrollLeft + prev.clientWidth < prev.scrollWidth - 1);
    try { new MutationObserver(ovf).observe(prev, { childList: true, subtree: true, characterData: true }); new ResizeObserver(ovf).observe(prev); } catch (e) { /* older browsers: no fade */ }
    prev.addEventListener('scroll', ovf, { passive: true });
    inp.addEventListener('input', check);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    $('formulaAdd').addEventListener('click', add);
    // the tag names wₖ with step k focused: refresh it when the focus changes
    setupFormula.refresh = check;
  }

