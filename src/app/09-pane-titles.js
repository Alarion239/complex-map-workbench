  // ---------------- pane titles & option strips ----------------
  // the right plane says what it shows beside its mode control (icon-only below 520px): the whole title when it
  // fits the free head, the math part alone when the role text would be cut short, nothing when even that does not fit
  // Each pane says what it shows after its view control (icon-only below 520px): the whole title when it fits the
  // free head, the math part alone when the role text would be cut short, nothing when even that does not fit (U4: the
  // control comes first, so it never moves when the title changes with the focus)
  function fitTitle(side, noNote, noDisp, noEmpty) {
    const t = $(side === 'L' ? 'leftTitle' : 'rightTitle'), pane = $(side === 'L' ? 'paneL' : 'paneR'), grow = t && /** @type {HTMLElement | null} */ (t.nextElementSibling);
    if (!t || !grow) return;
    t.classList.remove('terse', 'short', 'notag'); pane.classList.remove('tiny');
    // (the head's Regions button shows its caret unless the title needs that room: then its swatch alone,
    // e.g. Y's head at 1366 px with the chain empty and Add function there)
    const disp = pane.querySelector('.pane-head .pat-btn');
    if (disp && !noDisp) disp.classList.remove('tight');
    // (and Y's Add function button, in the head while the chain is empty, shrinks to its plus after the Display button)
    const emp = side === 'R' ? $('emptyRight') : null;
    if (emp && !noEmpty) emp.classList.remove('tight');
    // (Y's one-time note in the head gives way before the title itself does; never cut)
    const note = side === 'R' ? $('rightNote') : null;
    if (note) note.classList.toggle('nofit', !!noNote);
    const tabs = $(side === 'L' ? 'leftTabs' : 'rightTabs');
    // ("Plane | Sphere" stays in words: a head too narrow for the tabs, the title already gone (Y's head at 1024
    // px beside the Inspector), folds its key chip to the glyph first, then the head packs closer (the tabs' padding,
    // its gaps), and last its status light goes (Russian at 1024 px)
    const hd = pane.querySelector('.pane-head'), leg = $(side === 'L' ? 'leftLegend' : 'rightLegend');
    const legIn = !!(leg && hd && leg.parentNode === hd);
    const tabsCut = () => !!tabs && (tabs.scrollWidth > tabs.clientWidth + 1 || [...tabs.children].some((b) => b.scrollWidth > b.clientWidth + 1));
    // (the steps view's head fit folds the chip itself, sv-lg: it stays folded)
    if (legIn) { leg.classList.toggle('glyph', SV.on && hd.classList.contains('sv-lg')); hd.classList.remove('tight', 'noled'); }
    if (legIn && !leg.hidden && tabsCut()) {
      leg.classList.add('glyph');
      if (tabsCut()) { hd.classList.add('tight'); if (tabsCut()) hd.classList.add('noled'); }
    }
    // (a view control squeezed by the title, if any, takes its room back first)
    const room = grow.offsetWidth + t.offsetWidth - (tabs ? Math.max(0, tabs.scrollWidth - tabs.clientWidth) : 0);
    if (!(pane.offsetWidth > 0)) return;   // not laid out (hidden plane): measured again on the next resize
    const pt = t.querySelector('.ptitle'), pr = t.querySelector('.prole');
    let ptw = pt ? pt.scrollWidth : 0;
    if (pt && ptw > room) {
      if (note && !note.hidden && !noNote) { fitTitle(side, true); return; }
      // then the plane's "Y · " tag gives way, before the title itself: with the chain empty, Y's
      // head also holds Add function, and at 1366 px the tagged title would not fit and would vanish
      const tag = pt.querySelector('.ptag'), tw = tag ? tag.getBoundingClientRect().width : 0;
      if (!(tag && ptw - tw <= room)) {
        if (disp && !noDisp) { disp.classList.add('tight'); fitTitle(side, noNote, true); return; }
        if (emp && !emp.hidden && emp.parentNode === pane.querySelector('.pane-head') && !noEmpty) { emp.classList.add('tight'); fitTitle(side, noNote, true, true); return; }
        pane.classList.add('tiny'); return;
      }
      t.classList.add('notag'); ptw -= tw;
    }
    // the role is shown whole, or in its short form (its first words: "landscape", "phase of F" without the
    // formula), or not at all: it is never cut inside a formula
    if (!pr || room - ptw - 8 >= pr.scrollWidth) return;
    if (pr.querySelector('.rs')) {
      t.classList.add('short');
      if (room - ptw - 8 >= pr.scrollWidth) return;
      t.classList.remove('short');
    }
    t.classList.add('terse');
  }
  // (a title that changed width changes the room for the head's controls: they are laid out again first)
  // (a title in a pane head is fitted by its strip's layout, layoutFootSide, only when what it depends on changed;
  // the others, a phone's, are fitted here. force: the fonts settled, which no key can see)
  function fitRightTitle(force) {
    if (paneR) layoutFoot(force);
    // (whether the strip is in a head now, not as of its last layout: a switch to the phone layout moves it out first)
    const headed = (side) => { const f = $(side === 'L' ? 'leftFoot' : 'rightFoot'); return !!(f && f.parentElement && f.parentElement.classList.contains('pane-head')); };
    for (const side of ['L', 'R']) if (!paneR || !headed(side)) fitTitle(side);
  }
  // the words of the landscape's height (S.height)
  const heightHtml = (Fh) => ({ abs: `|${Fh}|`, re: `Re ${Fh}`, im: `Im ${Fh}` }[S.height] || `${I18N.fnName('log')}|${Fh}|`);
  // the pane titles (panels.md 2): X is the domain of the map in focus, Y its codomain
  function paneTitles() {
    const n = nSteps(), lk = leftStage(), rk = rightStage(), dk = focusDeriv();
    const Fh = fnHtml();
    // the role, with its short form for a narrow head (fitTitle): the words before the formula ("landscape",
    // "phase", "Cauchy integral", "image"), plus ", deforming"
    // (sh: the short form, given with the role: the role is a translated sentence, so its words are not parsed)
    const T = (t, role, sh) => {
      const m = sh == null ? /^(.*?)( of | over |, after )/.exec(role) : null;
      const short = sh != null ? sh : m ? m[1] + (/, deforming$/.test(role) ? ', deforming' : '') : '';
      return `<span class="ptitle">${t}</span><span class="prole">${short ? `<span class="rf">${role}</span><span class="rs">${short}</span>` : role}</span>`;
    };
    const surfL = lGlobe() ? 'sphere' : 'plane';
    const xName = surfL === 'sphere' ? $t('{w}-sphere', { w: wHtml(lk) }) : $t('{w}-plane', { w: wHtml(lk) });
    const of = S.focus === 0 ? '<i>F</i>' : dk ? `${Fh}(<i>z</i>)` : Fh;
    let roleL, shortL;
    if (lLand()) { roleL = $t('landscape of {h}{sheets}', { h: heightHtml(of), sheets: landSheetsHtml() }); shortL = $tx('role', 'landscape'); }
    else if (lColor() && S.dc === 'cauchy') { const cp = typeof cauchyPlot === 'function' ? cauchyPlot() : null; roleL = cp ? $t('Cauchy integral over {name}', { name: cp.name }) : $t('Cauchy integral'); shortL = cp ? $t('Cauchy integral') : ''; }
    else if (lPhase()) { roleL = $t('phase of {ofV}', { ofV: of }); shortL = $tx('role', 'phase'); }
    else { roleL = $t('domain of {ofV}', { ofV: of }); shortL = $tx('role', 'domain'); }
    // (one name per plane everywhere: "X · z-plane, domain of F", "Y · w = F(z), image")
    const XT = '<span class="ptag"><i>X</i> · </span>', YT = '<span class="ptag"><i>Y</i> · </span>';
    // (the steps view's plane: "w₁ · phase of f₂", the shown plane and the map from it into the colour plane, 19)
    const left = SV.on ? ((tp) => T(tp.name, tp.role))(svTitleParts()) : T(XT + xName, roleL, shortL);
    let right;
    // (the right titles carry the "Y · " tag)
    if (rGlobe()) right = T(YT + $t('{w}-sphere', { w: S.focus === 0 ? '<i>w</i>' : wHtml(rk) }), $tx('role', 'image'), '');
    else if (S.focus === 0) {
      // (Y rests on the plane after j steps: w_j = f_j(…f₁(z)), after j steps)
      const j = parkedAt(), steps = j >= 0 ? j : n;
      const pf = j === 0 ? '<i>z</i>' : j === 1 ? `<i>f</i>${sub(1)}(<i>z</i>)` : `<i>f</i>${sub(j)}(…<i>f</i>${sub(1)}(<i>z</i>))`;
      const map = j >= 0 ? `${j === 0 ? '<i>w</i>' + sub(0) : wHtml(j)} = ${pf}` : n ? '<i>w</i> = <i>F</i>(<i>z</i>)' : '<i>w</i> = <i>z</i>';
      right = T(YT + map, $tn('image, after {n} step', 'image, after {n} steps', steps), $tx('role', 'image'));
    }
    else if (dk) right = T(YT + `${wHtml(rk)} = d${wHtml(rk - 1)}/d<i>z</i>`, $tx('role', 'image'), '');
    else right = T(YT + `${wHtml(rk)} = <i>f</i>${sub(S.focus)}(${wHtml(lk)})`, $tx('role', 'image'), '');
    return { left, right };
  }
  // where a bracket's deformation starts, H_0 = Q applied to w_{a-1} (w_0 = z): 'html', 'text' (Unicode subscripts,
  // the phone's title chip and the menu's key slot) or 'tex'. One post step f3(w1), two (f4 o f3)(w1), three or more
  // (f6 o ... o f4)(w1); the bypassed steps are left out. No words: the same in English and Russian
  // Unicode subscript digits as <sub> digits: the menu's key slot and the phone row in the label's face
  const subTags = (html) => html.replace(/[\u2080-\u2089]+/g, (m) => `<sub>${[...m].map((c) => c.charCodeAt(0) - 0x2080).join('')}</sub>`);
  function rangeStart(fmt, p = rangeParts()) {
    if (!p) return fmt === 'tex' ? 'z' : fmt === 'html' ? '<i>z</i>' : 'z';
    const SUBS = '₀₁₂₃₄₅₆₇₈₉', su = (k) => String(k).split('').map((d) => SUBS[+d]).join('');
    const v = (k) => (fmt === 'tex' ? (k === 0 ? 'z' : `w_{${k}}`) : fmt === 'html' ? wHtml(k) : k === 0 ? 'z' : 'w' + su(k));
    const f = (k) => (fmt === 'tex' ? `f_{${k}}` : fmt === 'html' ? `<i>f</i>${sub(k)}` : 'f' + su(k));
    const o = fmt === 'tex' ? '\\circ ' : fmt === 'html' ? ' ∘ ' : '∘', dots = fmt === 'tex' ? '\\cdots' : '⋯';
    const x = v(p.pre.length ? p.a - 1 : 0), q = p.post.slice().reverse();
    if (!q.length) return x;
    if (q.length === 1) return `${f(q[0])}(${x})`;
    const comp = q.length === 2 ? `${f(q[0])}${o}${f(q[1])}` : `${f(q[0])}${o}${dots}${o}${f(q[q.length - 1])}`;
    return `(${comp})(${x})`;
  }
  // a plane's accessible name is its head's own words: its title and its role in plain text ("w₁ · phase of f₂"), so it follows the
  // plane shown as the head does
  function titleName(html) {
    const d = h('div', { html });
    // (the subscript's digits and the deformation's t as Unicode subscripts: Hₜ, as the page writes it elsewhere)
    for (const s of d.querySelectorAll('sub')) s.textContent = sub(s.textContent).replace(/t/g, '\u209C');
    const words = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : '');
    return [words(d.querySelector('.ptitle')), words(d.querySelector('.rf') || d.querySelector('.prole'))].filter(Boolean).join(', ');
  }
  function nameCanvases(t) {
    for (const [id, html] of [['overlayL', t.left], ['overlayR', t.right]]) {
      const el = $(id), name = titleName(html);
      if (el && name && el.getAttribute('aria-label') !== name) el.setAttribute('aria-label', name);
    }
  }
  function updateFocusUI() {
    const t = paneTitles();
    // (v16: the phone's title chip of the merged plane reads data-mtitle, SPEC 5.1)
    const mt = `${S.focus === 0 && rangeParts() ? rangeStart('text') : 'z'} \u2192 ${parkedAt() >= 0 ? 'w' + String(parkedAt()).split('').map((d) => '\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089'[+d]).join('') : 'w'}`;
    if (document.documentElement.dataset.mtitle !== mt) { document.documentElement.dataset.mtitle = mt; for (const id of ['leftReadout', 'rightReadout']) { const el = $(id); if (el) el.dataset.mtitle = mt; } }
    if ($('leftTitle').innerHTML !== t.left) $('leftTitle').innerHTML = t.left;
    if ($('rightTitle').innerHTML !== t.right) $('rightTitle').innerHTML = t.right;
    nameCanvases(t);
    syncAloneChip();
    syncModeChips();
    $('paneL').classList.toggle('no-rulers', !lFlat());
    phoneChain();
    if (Views.merged(S.view) !== layoutMg) applyLayout();
    syncViewControls();
    fitRightTitle();
    $('paneR').classList.toggle('no-rulers', !rImage());
    buildRightFoot();
    if (/** @type {any} */ (setupFormula).refresh) /** @type {any} */ (setupFormula).refresh();
    syncSnapUnit();
    updateToolHint();
    updateLeds();
    drawLegend();
  }
  // segmented controls: mark the selected segment and move the sliding thumb
  // the sliding marker of the segmented controls is placed for every control that changed in one pass at the next
  // frame: reading offsetLeft right after the class change forced a layout per control (about 0.4 s of layouts while
  // the panels were built at start-up on Windows)
  const segPending = new Map();
  let segRaf = 0;
  function placeSegs() {
    segRaf = 0;
    const list = [...segPending];
    segPending.clear();
    const at = list.map(([, on]) => (on.isConnected ? [on.offsetLeft, on.offsetWidth] : null));
    list.forEach(([el], i) => { if (at[i]) { el.style.setProperty('--seg-x', at[i][0] + 'px'); el.style.setProperty('--seg-w', at[i][1] + 'px'); } });
  }
  function setSeg(el, value) {
    if (!el) return;
    let on = null;
    for (const b of el.children) {
      if (!b.dataset || b.dataset.mode === undefined && b.dataset.v === undefined) continue;
      const sel = (b.dataset.mode ?? b.dataset.v) === String(value);
      b.classList.toggle('on', sel);
      b.setAttribute('aria-checked', String(sel));
      b.tabIndex = sel ? 0 : -1;   // (one Tab stop: the checked one, as roveRadios keeps every radio group)
      if (sel) on = b;
    }
    if (on) {
      segPending.set(el, on);
      if (!segRaf) segRaf = requestAnimationFrame(placeSegs);
    }
  }
  // (opt.cls: more classes; opt.loop: ↑ ↓ move too, as the steps view's scope switch does. The arrows ← → wrap in every row, as a
  // radiogroup's do: from the last radio on to the first, from the first back to the last. Home and End check the first and the
  // last choice. opt.wrap false: a row whose change is costly (Language, which reloads the page) stops at its ends, and Home and
  // End leave it alone, so no one key press reaches the far choice)
  function seg(id, value, options, onchange, label, opt) {
    const o = opt || {}, wrap = o.wrap !== false;
    const el = h('div', { class: 'seg small' + (o.cls ? ' ' + o.cls : ''), id: id || null, role: 'radiogroup', 'aria-label': label });
    for (const [v, l, title, aria] of options) {
      el.append(h('button', { type: 'button', 'data-v': v, role: 'radio', title: title || null, 'aria-label': aria || null, onclick: () => { setSeg(el, v); onchange(v); } }, l));
    }
    setSeg(el, value);
    // (the thumb is placed again once the control is in the page: for the segment checked by then, which a caller may
    // have changed)
    requestAnimationFrame(() => {
      const on = el.querySelector('.on');
      if (on) { segPending.set(el, on); if (!segRaf) segRaf = requestAnimationFrame(placeSegs); }
    });
    el.addEventListener('keydown', (e) => {
      const bs = [...el.children];
      if (wrap && (e.key === 'Home' || e.key === 'End')) {
        const b = bs[e.key === 'Home' ? 0 : bs.length - 1];
        b.click(); b.focus(); e.preventDefault();
        return;
      }
      const next = e.key === 'ArrowRight' || (o.loop && e.key === 'ArrowDown');
      if (!next && e.key !== 'ArrowLeft' && !(o.loop && e.key === 'ArrowUp')) return;
      const i = o.loop ? bs.indexOf(/** @type {HTMLElement} */ (e.target)) : bs.findIndex((b) => b.classList.contains('on'));
      if (i < 0) return;
      e.preventDefault();
      const j = wrap ? (i + (next ? 1 : bs.length - 1)) % bs.length : i + (next ? 1 : -1);
      if (j < 0 || j >= bs.length) return;
      bs[j].click(); bs[j].focus();
    });
    return el;
  }
  function selectEl(id, value, options, onchange, title, cls) {
    const sel = h('select', { class: 'sel' + (cls ? ' ' + cls : ''), id: id || null, title, 'aria-label': title, onchange: (e) => onchange(e.target.value) }, ...options.map(([v, l]) => h('option', { value: v }, l)));
    sel.value = value;
    return sel;
  }
  // a list of a few numbers as the steps view's choice button (its word names the current one, a tap opens the menu of the
  // others), not a native select: the head and the phone's sheet show the same control
  function choiceEl(id, value, options, onchange, title) {
    const b = svChoiceBtn(value, options, onchange, title, 'sv-choice-num');
    if (id) b.id = id;
    return b;
  }
  // (with an icon, a check that the pane head shows as an icon toggle, its word the tooltip and its accessible name;
  // a phone's sheet and the ⋯ pop-up show the word)
  function checkEl(id, checked, label, onchange, icon) {
    const inp = h('input', { type: 'checkbox', id, onchange: (e) => onchange(e.target.checked) });
    inp.checked = !!checked;
    if (icon) inp.setAttribute('aria-label', label);   // (the icon form's word is hidden in the head: the name is the input's)
    if (!icon) return h('label', { class: 'check' }, inp, h('span', null, label));
    return h('label', { class: 'check ic-tg', 'data-tip': label }, inp, h('span', { class: 'tg-ic', 'aria-hidden': 'true', html: icon }), h('span', { class: 'tg-l' }, label));
  }
  const DC_STYLES = [['enhanced', $t('Tiles'), $t('Conformal tiles: phase sectors and modulus contours form squares')], ['phase', $t('Plain'), $t('Phase only')], ['classic', $t('Modulus'), $t('Brightness from |F|: zeros black, poles white')], ['modulus', $t('Contours'), $t('Level lines of |F| and arg F')], ['grid', $t('Pulled-back grid'), $t('Pull-back of the Re/Im grid of the image')], ['cauchy', $t('Cauchy'), $t('The Cauchy integral over the selected closed curve: F inside, 0 outside')]];
  // the Phase style as one row: each style its glyph (STYLE_SVG), alone in the pane head (option 1: the name its
  // tooltip), or with its word under it (a phone's sheet, the ⋯ pop-up); one click picks. "Pulled-back grid" is "Grid" here
  // and Cauchy its short word (Russian «Коши», not «Интеграл Коши», which a 54 px button at 360 px broke mid-word), the
  // whole name the tooltip, the accessible name and the header menu's item
  function styleSeg(id = 'dcSeg') {
    const word = (v, name) => (v === 'grid' ? $t('Grid') : v === 'cauchy' ? $tx('style', 'Cauchy') : name);
    const el = seg(id, S.dc, DC_STYLES.map(([v, name, tip]) => [v, [h('span', { class: 'sty-g', 'aria-hidden': 'true', html: STYLE_SVG[v] }), h('span', { class: 'sty-n' }, word(v, name))], tip]), (v) => pickPhaseStyle(v), $t('Phase style'));
    el.classList.add('sty-seg');
    for (const b of /** @type {HTMLElement[]} */ ([...el.children])) {
      const d = DC_STYLES.find((p) => p[0] === b.dataset.v);
      b.setAttribute('aria-label', d[1]);
      b.removeAttribute('title');
      b.dataset.tip = d[1] === d[2] ? d[1] : `${d[1]}: ${d[2]}`;
      // (the steps view: the Cauchy integral is drawn on z, where its curve lies, so the style is offered while z is the colour plane)
      if (SV.on && d[0] === 'cauchy' && svT() !== 0) {
        const why = cauchyOffZWhy();
        /** @type {HTMLButtonElement} */ (b).disabled = true; b.dataset.tip = why; b.setAttribute('aria-description', why);
      }
    }
    return el;
  }
  // the idle hint of a globe (panels.md 3, 9): on an editable globe a drawing tool's drag draws, so the hint names the
  // tool's gesture and how to turn; Select drags shapes and turns on empty space; a tool that does not draw here
  // (Annulus, Sector, Polar grid: the pane chip says so) and a globe that takes no drawing turn with a drag
  function globeHint(side) {
    const TURN = $t('Drag to turn; ∞ is at the north pole');
    if (!globeEdit(side) || tool === 'formula' || GLOBE_OFF.has(tool)) return TURN;
    if (tool === 'select') return touchUI() ? $t('Drag to turn, tap a shape to select it; two fingers turn too; ∞ is at the north pole') : $t('Drag to turn, a shape to move it; Space turns; ∞ is at the north pole');
    const lab = ((TOOLS.find((t) => t[0] === tool) || [])[1] || '').toLowerCase();
    const tg = side === 'R' ? $t('target ') : '';
    // (on a touch screen a tap places, and two fingers turn)
    const tch = touchUI();
    const g = tool === 'point' ? (tch ? $t('Tap to place a {tg}point', { tg }) : $t('Click to place a {tg}point', { tg })) : tool === 'polygon' ? (tch ? $t('Tap the vertices') : $t('Click the vertices'))
      : tool === 'curve' ? $t('Hold and draw a {tg}curve', { tg }) : tool === 'lasso' ? $t('Hold and draw a {tg}region', { tg })
        : tg ? $t('Drag to draw a target {tool}', { tool: lab }) : /^[aeiou]/.test(lab) ? $t('Drag to draw an {tool}', { tool: lab }) : $t('Drag to draw a {tool}', { tool: lab });
    return tch ? $t('{g}; two fingers turn', { g }) : $t('{g}; Space or the middle button turns', { g });
  }
  // the idle left readout: the scale, or how to draw on or turn the globe, or orbit the landscape (which takes no
  // drawing, panels.md 9.1)
  const touchUI = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  // a phone has no pane title: in Landscape with All sheets its title chip says which sheets are
  // drawn, as the title does ("Im F, on both sheets of F"), in place of the orbit hint
  const landSheetsHint = () => {
    if (!document.documentElement.classList.contains('ph')) return '';
    const shw = sheetsShown();
    if (!shw) return '';
    const of = S.focus === 0 ? '<i>F</i>' : focusDeriv() ? `${fnHtml()}(<i>z</i>)` : fnHtml();
    return heightHtml(of) + sheetsClause(shw, 'html');
  };
  // on a phone the scale chip teaches the hold-and-slide that reads z and F(z), until it is first used
  let probeLearnedV = null;
  const probeLearned = () => { if (probeLearnedV == null) { try { probeLearnedV = localStorage.getItem('cmw-probe-learned') === '1'; } catch (e) { probeLearnedV = false; } } return probeLearnedV; };
  // (once a session, for 8 s from the first idle readout of a phone, never a standing part of the
  // chip: the rule "no always-on hint"; a phone that probed once never sees it again)
  let probeTeachUntil = 0;
  const probeTeach = () => {
    if (!document.documentElement.classList.contains('ph') || probeLearned()) return '';
    const now = performance.now();
    if (!probeTeachUntil) {
      let seen = false;
      try { seen = sessionStorage.getItem('cmw-probe-taught') === '1'; sessionStorage.setItem('cmw-probe-taught', '1'); } catch (e) { seen = false; }
      probeTeachUntil = seen ? -1 : now + 8000;
      if (!seen) setTimeout(() => { const lr = $('leftReadout'); if (lr && lr.querySelector('.rteach')) lr.innerHTML = idleLeft(); }, 8050);
    }
    return probeTeachUntil > now ? `<span class="rhint rteach">${SV.on ? $t('Hold and slide to read {f}', { f: svMapCall('html') }) : $t('Hold and slide to read F(z)')}</span>` : '';
  };
  const idleLeft = () => (lGlobe() ? `<span class="rhint rglobe">${globeHint('L')}</span>`
    : lLand() ? `<span class="rhint">${tool !== 'select' && tool !== 'formula' ? $t('Draw in X → Y (1)') : landSheetsHint() || (touchUI() ? $t('Drag to orbit, pinch to zoom') : $t('Drag to orbit, Shift-drag to pan'))}</span>` : rk('', paneL ? scaleText(paneL) : '') + probeTeach());
  // the idle right readout: the scale, a drawing hint, or how to draw on or turn the w-globe (a short hint in the UI face)
  function idleRight() {
    // (the deformation's globe with under 3 paths, X mostly on its far side: the hint says why; verify fix path-8)
    const v = rGlobe() ? { hint: globeHint('R') }
      : document.documentElement.classList.contains('ph') && hasTargets() && targetText() ? { hint: targetText({ phone: true }) }
        : targetsEditable() && tool !== 'select' && tool !== 'formula' ? { hint: $t('Draw a target in Y (the {x}-plane)', { x: yHtml() }) } : scaleText(paneR);
    return v && v.hint ? `<span class="rhint">${v.hint}</span>` : rk('', v);
  }
  function scaleText(pane) { return pane ? $t('{x} / div', { x: I18N.num(CX.fmtNum(Axes.niceStep(110 / pane.view.s), 4).replace('-', '−')) }) : ''; }
  // Mode options (spec 5.8): one 32px row. Controls that do not fit beside the view stack move, in order, behind
  // a sliders button into a popover; on a phone all of them do.
  const phoneMQ = matchMedia('(max-width: 767px)');
  // one options strip per pane (panels.md 4): foot.L in X, foot.R in Y
  const footOf = () => ({ kids: [], widths: null, n: -1, w: -1, phone: null, pop: null });
  const foot = { L: footOf(), R: footOf() };
  phoneMQ.addEventListener('change', () => { if (S && paneR) layoutFoot(true); });
  function layoutFoot(force) { layoutFootSide('L', force); layoutFootSide('R', force); }
  // on a desktop the unit circle's check (page.html's #unitBox) sits in X's pane head; a phone's Display sheet lends it
  // itself. The classic X → Y view puts the regions' button in the head too
  // (the steps view has one head and one colour panel on every plane: its ⋯ pop-up holds the regions' display)
  const pushHome = () => !SV.on && S.view.main === 'xy';
  // the regions' display (page.html's #regionsBox): the X → Y view's Regions pop-up, the steps view's ⋯ pop-up
  const stepsRegions = () => SV.on;
  // (a strip rebuilt or laid out again lets go of it first: replaceChildren would leave it out of the page)
  function unitHome(f) {
    const u = $('unitBox'), home = $('regionsHome');
    if (u && home && f && f.contains(u)) home.append(u);
  }
  function unitKid(side) {
    const u = $('unitBox');
    if (!u || side !== 'L') return null;
    // (its icon and toggle look, once: the word stays its name and the tooltip's)
    const l = u.querySelector('label.check');
    if (l && !l.classList.contains('ic-tg')) {
      l.classList.add('ic-tg'); l.setAttribute('data-tip', $t('Unit circle'));
      const w = l.querySelector(':scope > span'); if (w) w.classList.add('tg-l');
      l.insertBefore(h('span', { class: 'tg-ic', 'aria-hidden': 'true', html: ICONS.unit }), w);
      const ui = l.querySelector('input'); if (ui) ui.setAttribute('aria-label', $t('Unit circle'));
    }
    return u;
  }
  const headRO = new WeakSet();   // (the pane heads observed for their width)
  // (a strip is laid out once per task, after the handler that asked for it and before the frame: opening the
  // Deformation asked for it five times a side (buildFoot, placeKeys, fitRightTitle, each through layoutFoot), and each
  // pass forced two to four layouts reading the head and fitting its title. The asks are gathered and laid out in one
  // microtask, force if any asked for it; nothing paints in between)
  const footDue = { L: 0, R: 0 };
  let footFlush = false;
  function layoutFootSide(side, force) {
    footDue[side] = Math.max(footDue[side], force ? 2 : 1);
    if (footFlush) return;
    footFlush = true;
    queueMicrotask(() => {
      footFlush = false;
      for (const s of ['L', 'R']) { const d = footDue[s]; footDue[s] = 0; if (d) layoutFootNow(s, d === 2); }
    });
  }
  // the strip's children made exactly `list`, in that order. A control already in the strip is moved where it belongs with
  // moveBefore, which keeps its focus (replaceChildren takes the controls out of the page and puts them back: the focused one
  // is blurred); a browser without it sets the whole list at once, and layoutFootNow gives the focus back
  function setKids(f, list) {
    if (typeof f.moveBefore !== 'function') { f.replaceChildren(...list); return; }
    list.forEach((k, i) => { const at = f.children[i]; if (at === k) return; if (k.parentNode === f) f.moveBefore(k, at || null); else f.insertBefore(k, at || null); });
    while (f.children.length > list.length) f.lastElementChild.remove();
  }
  // (a browser without moveBefore blurs the strip's focused control when it is laid out: the control that had it takes it again)
  function layoutFootNow(side, force) {
    const f = $(side === 'L' ? 'leftFoot' : 'rightFoot'), a = document.activeElement;
    layoutFootRun(side, force);
    if (f && a && a !== document.body && a.isConnected && document.activeElement !== a && f.contains(a)) /** @type {HTMLElement} */ (a).focus({ preventScroll: true });
  }
  function layoutFootRun(side, force) {
    const f = $(side === 'L' ? 'leftFoot' : 'rightFoot'), ft = foot[side], pane = side === 'L' ? paneL : paneR;
    // (a landscape phone is wider than the query, but its options are the Display sheet's too: all of them, none inline)
    const phone = phoneMQ.matches || document.documentElement.classList.contains('ph');
    // (on a desktop the strip sits in the pane head, placeKeys, so no bar lies over the plot. There its
    // controls are inline, compact (icon toggles, the style's glyphs), as many as the head has room for beside a title
    // kept readable; the rest go behind a ⋯ button. In the X → Y view the head also has the shapes' pattern button)
    const inHead = !!(f && f.parentElement && f.parentElement.classList.contains('pane-head'));
    if (!f || !pane || (!ft.kids.length && !inHead)) return;
    if (inHead && f.hidden) f.hidden = false;
    // (a head whose width changes on its own, the panels or the fonts settling after the first layout, lays its row out
    // again, and so does one whose key chip fills in after it (the Phase key at 1280 px left the title shortened): the
    // cache key below holds both widths, so an unchanged head costs nothing)
    if (inHead && !headRO.has(f.parentElement) && typeof ResizeObserver === 'function') {
      headRO.add(f.parentElement);
      // (only a change of a pixel or more: a sub-pixel settle cannot ping-pong with the layout it starts)
      const lastW = new Map();
      const ro = new ResizeObserver((es) => {
        let moved = false;
        for (const e of es) { const w = e.contentRect.width; if (!(Math.abs(w - (lastW.has(e.target) ? lastW.get(e.target) : -1)) < 1)) { lastW.set(e.target, w); moved = true; } }
        // (the widths the observer reports are the layout's key, read with no forced layout)
        ft.roW = [...lastW.values()].map((w) => Math.round(w)).join(',');
        if (moved && f.parentElement && f.parentElement.classList.contains('pane-head')) layoutFootSide(side);
      });
      ro.observe(f.parentElement);
      const leg = $(side === 'L' ? 'leftLegend' : 'rightLegend');
      if (leg) ro.observe(leg);
    }
    // (in the head a note, Cauchy's sentence, comes last and always behind ⋯: the head holds controls, never a cut sentence)
    // (n and the grid step, like Cauchy's note, are always behind ⋯: the head keeps the style's glyphs
    // and the toggles, so the plane's title keeps its room)
    // (the steps view's head is the same on every plane: the style row stays inline and every other control is behind ⋯,
    // whatever the title's width, so no control comes and goes as the shown plane changes)
    const unit = inHead ? unitKid(side) : null, isNote = (e) => e.classList.contains('foot-note') || e.classList.contains('ovf') || (SV.on && !e.classList.contains('seg'));
    const kids = inHead ? [...ft.kids.filter((e) => !isNote(e)), ...(unit && !isNote(unit) ? [unit] : []), ...ft.kids.filter(isNote), ...(unit && isNote(unit) ? [unit] : [])] : ft.kids;
    ft.order = kids;
    if (!unit) unitHome(f);   // (not this strip's any more, e.g. the view changed: home, before replaceChildren drops it)
    // (first a key of what the layout depends on that needs no layout read and no write: the head's and its key
    // chip's widths as the observer reported them, the title's words, which items of the head show, the controls, the
    // view; unchanged, the strip and the title are as they were laid out and fitted, and nothing is touched. Opening the
    // Deformation retitles the panes and lays both strips out again: each call stripped the title's classes and read
    // its widths first, several forced layouts a click)
    let pre = null;
    if (inHead) {
      const hd = f.parentElement, t = $(side === 'L' ? 'leftTitle' : 'rightTitle');
      pre = [phone, kids.length, pane.w, S.view.main, ft.roW || '', t ? t.innerHTML : '', [...hd.children].map((c) => (/** @type {HTMLElement} */ (c).hidden ? 0 : 1)).join(''), I18N.lang].join('|');
      if (!force && ft.roW && pre === ft.pre) return;
    }
    ft.pre = null;   // (kept only once this layout is done, below)
    // (in the head: its width and the title's whole width, which the room for the controls depends on, are part of the key)
    // (and its role's whole width, "phase of F(z) = …", which fitTitle shortens when the room runs out)
    let headW = 0, titleW = 0, roleW = 0, legW = 0;
    if (inHead) {
      const t = $(side === 'L' ? 'leftTitle' : 'rightTitle'), pt = t && t.querySelector('.ptitle'), pr = t && t.querySelector('.prole');
      const leg = $(side === 'L' ? 'leftLegend' : 'rightLegend');
      if (t) { t.classList.remove('terse', 'short', 'notag'); f.parentElement.parentElement.classList.remove('tiny'); }   // (fitTitle fits it after)
      headW = f.parentElement.clientWidth; titleW = pt ? pt.scrollWidth : 0; roleW = pr ? pr.scrollWidth + 8 : 0;
      legW = leg && leg.parentNode === f.parentElement ? Math.round(leg.getBoundingClientRect().width) : 0;
    }
    if (!force && ft.w === pane.w && ft.phone === phone && ft.head === inHead && ft.headW === headW && ft.titleW === titleW && ft.roleW === roleW && ft.legW === legW && ft.nk === kids.length) { if (inHead) { fitTitle(side); ft.pre = pre; } return; }
    ft.head = inHead; ft.headW = headW; ft.titleW = titleW; ft.roleW = roleW; ft.legW = legW;
    if (ft.nk !== kids.length) ft.widths = null;
    ft.nk = kids.length;
    const pat = inHead && pushHome() ? patternBtn(side) : null;
    let n = kids.length;
    if (phone) n = 0;
    else {
      if (!ft.widths) {
        // natural widths, measured once per build with every control inline on one row
        if (f.childElementCount !== kids.length || [...f.children].some((c, i) => c !== kids[i])) setKids(f, kids);
        f.classList.add('measuring');
        const ws = kids.map((c) => c.getBoundingClientRect().width);
        f.classList.remove('measuring');
        if (ws.some((x) => !(x > 0))) { ft.n = n; if (pat) f.prepend(pat); return; } // plane not shown: keep everything inline for now
        ft.widths = ws;
      }
      let avail;
      const gap = inHead ? 4 : 8, pad = inHead ? 0 : 10, btn = (inHead ? 26 : 24) + gap;
      if (inHead) {
        // the head's room: what the title, the free space after it and the strip take now (the rest of the head is
        // fixed), less a title that stays readable (its whole width, at most 180 px) and the pattern button
        const head = f.parentElement, t = $(side === 'L' ? 'leftTitle' : 'rightTitle'), hs = getComputedStyle(head);
        let room = head.clientWidth - parseFloat(hs.paddingLeft) - parseFloat(hs.paddingRight), shown = 0;
        for (const c of head.children) {
          if (!c.getClientRects().length) continue;
          shown++;
          if (c === t || c === f || c.classList.contains('grow')) continue;
          const cs = getComputedStyle(c);
          room -= c.getBoundingClientRect().width + parseFloat(cs.marginLeft) + parseFloat(cs.marginRight);
        }
        room -= Math.max(0, shown - 1) * (parseFloat(hs.columnGap) || 0) + 2;   // (the gaps, the strip's own margin)
        // (the Phase head, its style row first, keeps its whole title, its role too: the toggles go behind ⋯, the unit
        // circle first, before the title gives up letters. The row itself always stays, below)
        const whole = kids.length > 0 && kids[0].id === 'dcSeg';
        avail = room - (whole ? titleW + roleW + 12 : Math.min(180, titleW + 12)) - (pat ? 34 + gap : 0) - 4;
      } else avail = pane.w - 60;
      let used = pad;
      for (n = 0; n < kids.length; n++) {
        if (inHead && isNote(kids[n])) break;
        const next = used + (n ? gap : 0) + ft.widths[n];
        // (a head that starts with the style row always keeps the ⋯'s room, filled or not)
        const more = n + 1 < kids.length || (inHead && kids[0].id === 'dcSeg') ? btn : 0;
        if (next + more > avail) break;
        used = next;
      }
      // (in the head a first control that is a segmented row, the Phase style or the Landscape's height, always stays:
      // one click is the point of the row; a head short of room cuts the title down instead, fitTitle)
      if (inHead && n === 0 && kids.length && kids[0].classList.contains('seg')) n = 1;
    }
    ft.w = pane.w; ft.phone = phone;
    if (n === ft.n && !force) { if (inHead) { fitTitle(side); ft.pre = pre; } return; }   // (the title's classes were cleared above: fitted again)
    ft.n = n;
    const rest = kids.slice(n);
    let b = null;
    // (in a head with the Regions button and nothing else inline, Y's in the X → Y view, the controls that do not fit go
    // into the Regions pop-up above the regions' options: one button, as narrow as the Display button was)
    const merged = !!pat && n === 0 && rest.length > 0;
    ft.merged = merged;
    if ((rest.length || (inHead && stepsRegions())) && !merged) {
      // (the controls that do not fit: in the pane head a ⋯ button, under the plot the sliders)
      b = h('button', { class: 'icon-btn opts-btn', 'data-tip': $t('Display options'), 'aria-label': $t('Display options'), 'aria-haspopup': 'dialog', 'aria-expanded': 'false', html: inHead ? ICONS.more : ICONS.sliders });
      b.addEventListener('click', () => openFootPop(b, false, side));
    } else if (inHead && kids.length && kids[0].id === 'dcSeg') {
      // the Phase head keeps the ⋯'s room whatever the style: a style with nothing behind ⋯ (Plain, Modulus)
      // leaves the slot empty, so the style row, at the head's right, never shifts as the style changes
      b = h('span', { class: 'opts-slot', 'aria-hidden': 'true' });
    }
    const open = ft.pop && ft.pop.isConnected && (ft.pop.dataset.of !== 'pattern' || ft.pop.dataset.merged === '1');
    if (unit && rest.includes(unit)) unitHome(f);
    // (in a head that starts with the style row, the toggles that fit go to its left and
    // the row stays last, beside ⋯; it sits at the head's right, so a style that changes the title, and with it how many
    // toggles fit, moves only the toggles)
    const inl = kids.slice(0, n), styl = inHead && inl.length && inl[0].id === 'dcSeg';
    setKids(f, [...(pat ? [pat] : []), ...(styl ? [...inl.slice(1), inl[0]] : inl), ...(b ? [b] : [])]);
    f.classList.toggle('collapsed', !n);
    if (inHead) { fitTitle(side); ft.pre = pre; }   // (the head's room changed with the controls: the title is fitted again)
    if (open) {
      // (the open pop-up follows its controls: the Regions pop-up while they are merged into it, else the ⋯'s)
      if (ft.pop.dataset.of === 'pattern' && merged) openFootPop(pat, true, side, true);
      else if (b) openFootPop(b, true, side); else closePalette();
    }
  }
  // (in the X → Y view the Regions button in the pane head, a swatch of the regions' fill (the
  // phase of z): its pop-up holds the regions' display, page.html's #regionsBox (grid lines and their step, chevrons,
  // opacity), lent while it is open)
  function patternBtn(side) {
    const name = $t('Regions');
    const b = h('button', { class: 'btn opts-btn pat-btn', 'data-tip': name, 'aria-label': name, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
      h('canvas', { class: 'disp-sw', width: 52, height: 40, 'aria-hidden': 'true' }), h('span', { class: 'disp-caret', 'aria-hidden': 'true', html: ICONS.chevD }));
    drawPhaseSwatch(b.firstChild);
    b.addEventListener('click', () => openFootPop(b, false, side, true));
    return b;
  }
  function openFootPop(btn, refresh, side = 'R', regionsOnly = false) {
    const ft = foot[side], of = regionsOnly ? 'pattern' : 'opts';
    if (!refresh && ft.pop && ft.pop.isConnected && ft.pop.dataset.of === of) { closePalette(); btn.focus(); return; } // anchor re-click closes
    closePalette();
    // (the ⋯ pop-up holds the head's controls that did not fit, with no title; the Regions button's, the regions'
    // display alone. Both are lent and go back when the pop-up closes)
    const head = !!btn.closest('.pane-head'), home = $('regionsHome');
    const unit = $('unitBox'), rest = regionsOnly && !ft.merged ? [] : (head && ft.order ? ft.order : ft.kids).slice(ft.n);
    const regions = regionsOnly || (head && stepsRegions()) ? $('regionsBox') : null;
    // (the steps view's Opacity slider is the one for S.alpha there: the regions' own row is left out)
    if (regions) /** @type {HTMLElement} */ ($('alphaRange').closest('.fader-row')).hidden = SV.on;
    if (regions) regionsNote();
    // (the regions' group, set apart by a rule and its name when other controls come before it in the pop-up)
    const regionsHead = regions && !regionsOnly && rest.length
      ? [h('div', { class: 'opts-h opts-sep' }, $t('Regions'))] : [];
    const kids = regions ? [...rest, ...regionsHead, regions] : rest;
    const pop = h('div', { class: 'pop opts-pop' + (head ? ' disp-pop' : '') + (regionsOnly ? ' pat-pop' : ''), role: 'dialog', 'aria-label': regionsOnly ? btn.getAttribute('aria-label') : $t('Display options'), 'data-of': of, 'data-merged': regionsOnly && ft.merged ? '1' : null }, ...kids);
    if (head && home) pop._onClose = () => { for (const b of [unit, regions]) if (b && b.parentNode === pop) home.append(b); };
    $('popHost').append(pop);
    popEl = pop; ft.pop = pop;
    btn.setAttribute('aria-expanded', 'true');
    for (const s of pop.querySelectorAll('.seg')) { const on = s.querySelector(':scope > .on'); if (on) setSeg(s, on.dataset.v ?? on.dataset.mode); }
    // a segmented row wider than the popover (a phone): the chosen segment in view, and a fade where more follows
    for (const s of pop.querySelectorAll(':scope > .seg')) {
      if (s.scrollWidth <= s.clientWidth + 1) continue;
      const on = s.querySelector(':scope > .on');
      if (on) s.scrollLeft = Math.max(0, Math.min(s.scrollWidth - s.clientWidth, on.offsetLeft + on.offsetWidth / 2 - s.clientWidth / 2));
      const edge = () => { s.classList.toggle('more-l', s.scrollLeft > 1); s.classList.toggle('more-r', s.scrollLeft + s.clientWidth < s.scrollWidth - 1); };
      edge();
      s.addEventListener('scroll', edge, { passive: true });
    }
    // the strip sits at the bottom of the plot: open upward over the plot, below only when there is no room
    const r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    // (from the pane head, the popover hangs under the head, its right edge on the head's: the Regions
    // button sits left of the toggles, and a popover under it would cover the middle of the plane the tour lights)
    const fromHead = !!btn.closest('.pane-head'), hr = fromHead ? btn.closest('.pane-head').getBoundingClientRect() : null;
    const x0 = fromHead ? Math.max(r.right, hr.right - 6) - pw : (btn.closest('.options') || btn).getBoundingClientRect().left; // above the strip, clear of the view stack
    let y = fromHead ? -1 : r.top - ph - 6;
    if (y < 12) y = Math.max(12, Math.min(window.innerHeight - ph - 12, r.bottom + 6));
    pop.dataset.side = y < r.top ? 'top' : 'bottom';
    pop.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, x0)) + 'px';
    pop.style.top = y + 'px';
    const mo = new MutationObserver(() => { if (!pop.isConnected) { btn.setAttribute('aria-expanded', 'false'); mo.disconnect(); } });
    mo.observe($('popHost'), { childList: true });
    // (Escape, and a Tab that would leave the pop-up, close it and give the focus back to the anchor: it is a non-modal dialog, so Tab
    // does not trap, and it lies apart from the page's Tab order (after the app in the document), so a Tab out of it would land on
    // the page's last or first control with the pop-up left open. A control Tab does not reach, a segmented row's unchecked choice
    // that a click focused, counts by its place: Tab from it goes to the next stop after it in the pop-up, or leaves)
    const tabStops = () => [...pop.querySelectorAll(':is(button, input, select, textarea, [tabindex]):not([tabindex="-1"]):not(:disabled)')].filter((x) => /** @type {HTMLElement} */ (x).offsetParent !== null);
    pop.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); btn.focus(); return; }
      if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = /** @type {Node} */ (e.target), stops = tabStops();
      const next = e.shiftKey ? stops.filter((x) => x.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING).pop() : stops.find((x) => t.compareDocumentPosition(x) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (next) return;
      e.preventDefault(); closePalette(); btn.focus();
    });
    // (focus moves into the pop-up, whichever way it was opened, onto the first control Tab would reach: the checked choice of a
    // segmented row, whose other buttons are tabindex -1)
    if (!refresh) { const first = tabStops()[0]; if (first) /** @type {HTMLElement} */ (first).focus({ preventScroll: true }); }
    armOutside(btn);
  }
  // the focused map has a multivalued step the Landscape can show all sheets of (GLR.sheetInfo): {infinite} or null
  // D: how many of the K surfaces are distinct sheets, from F's values on every surface at a few generic points (two
  // surfaces agreeing to 1e-9 at all of them are one sheet): √ then z² is F = z, single-valued, so its two surfaces are
  // one sheet and All sheets has nothing more to draw (null: the principal branch, no clause)
  // The distinct sheets among the K combos of map m (window W): the first combo of each class of combos whose values
  // agree at every probe point (all of 0..K-1 when none repeats an earlier one).
  // The sheets of √ then log coincide in pairs, so the surfaces drawn are these combos only. Cached per chain, map, focus, window.
  // SHEET_PTS: the generic points two maps are compared at; sheetValsSame(a, b): two lists of values there are one map's
  // (each pair within 1e-9 relative; a missing value, null, equals only another, and a value not finite only another)
  const SHEET_PTS = [C(0.731, 0.412), C(-1.287, 0.903), C(-0.618, -1.733), C(1.911, -0.794), C(0.307, 2.268)];
  const sheetFin = (u) => Number.isFinite(u.re) && Number.isFinite(u.im);
  const sheetSame = (u, v) => (!u || !v ? u === v : !sheetFin(u) || !sheetFin(v) ? !sheetFin(u) && !sheetFin(v) : CX.abs(CX.sub(u, v)) <= 1e-9 * (1 + CX.abs(u)));
  const sheetValsSame = (a, b) => a.every((w, i) => sheetSame(w, b[i]));
  const sheetUniqCache = new Map();
  function sheetUniq(m, W, K) {
    const key = `${chainSig[nSteps()]}|${mapKeyOf(m)}|${S.focus}|${W}|${K}`;
    let r = sheetUniqCache.get(key);
    if (r) return r.list;
    const reps = [], list = [];
    for (let c = 0; c < K; c++) {
      // a point where the sheet cannot be evaluated (a throw) counts as a missing value, which only equals another
      const v = SHEET_PTS.map((z) => { try { return Funcs.sheetEval(S.steps, built, m.b, z, z, c, W, { a: m.a || 0 }); } catch (e) { return null; } });
      if (!reps.some((x) => sheetValsSame(x, v))) { reps.push(v); list.push(c); }
    }
    r = { list };
    if (sheetUniqCache.size > 32) sheetUniqCache.delete(sheetUniqCache.keys().next().value);
    sheetUniqCache.set(key, r);
    return r.list;
  }
  // sheetUniq for map m as GLR.sheetInfo counts it (callers hold a multiSheet map, so GLR.sheetInfo exists)
  function sheetUniqOf(m, W) {
    const si = GLR.sheetInfo(m, W);
    return si ? sheetUniq(m, W, si.K) : [0];
  }
  // the sheets of map m (the focused map, endMap, unless a caller names the map it shows), or null when it has one
  function multiSheet(m = endMap()) {
    if (!GLR.ok || typeof GLR.sheetInfo !== 'function') return null;
    let ms = null;
    // (a map GLR.sheetInfo cannot describe throws: no sheets)
    try { ms = GLR.sheetInfo(m, S.sheetW || 2) || null; } catch (e) { ms = null; }
    if (!ms) return null;
    const list = sheetUniq(m, ms.W, ms.K), D = list.length;
    return D > 1 ? Object.assign({}, ms, { D, uniq: list }) : null;
  }
  // the map whose sheets the Landscape draws with All sheets (render3D), given the plane s a steps-view carry starts from
  // (null for none): the carry's colour map, the chain from s to the colour plane (svColourMap); else the map shown
  // (focusMap: in the steps view the shown plane's map into the colour plane). A step after the colour plane is in
  // neither, so it adds no sheets
  function landSheetsMap(s = null) { return s != null ? svColourMap(s) : focusMap(); }
  // (v16.1 user-5) what the landscape draws with All sheets, as render3D does: null for the principal branch (All
  // sheets off, or no multivalued step in the map it draws the sheets of, landSheetsMap, or the CPU stand-in's frame,
  // which draws the principal branch alone while the sheets' programs link), else {K: the surfaces drawn, total: the
  // sheet combinations of the window, W, pieces: [{n, of}]} (one per multivalued piece of that map: n sheets all drawn,
  // or n = 0 for the window k = -W, ..., W; of: the piece's own count, Infinity for log)
  function sheetsShown() {
    if (!S.sheets || !lLand() || render3D.standIn) return null;
    const carry = SV.on && SV.surf === 'land' ? svLandCarryNow() : null, m = landSheetsMap(carry ? carry.s : null), ms = multiSheet(m);
    if (!ms) return null;
    const a = Math.max(0, m.a || 0), b = m.b || 0, pieces = [];
    try {
      for (const e of Funcs.sheetSteps(S.steps, built)) {
        if (e.k <= a || e.k > b) continue;
        const q = Funcs.stepSheets(built[e.k - 1])[e.node];
        // (kb, the step's own branch, on which its window is centred (Funcs' stepTh: a root's k mod n,
        // a log's or power's k; a formula's branch nodes 0), so the caption numbers the window as drawn)
        const bb = built[e.k - 1], v = bb && bb.def && bb.def.id !== 'custom' && bb.vals ? bb.vals : {}, kk = v.k | 0, rn = Math.max(2, v.n | 0);
        pieces.push({ n: e.n, of: q && q.of > 0 ? q.of : e.n > 0 ? e.n : Infinity, kb: bb && bb.def && bb.def.id === 'root' ? ((kk % rn) + rn) % rn : kk });
      }
    } catch (e) { return null; }
    return pieces.length ? { K: ms.K, D: ms.D || ms.K, total: ms.total, W: ms.W, pieces } : null;
  }
  // the clause on what it draws, exact (the user, "all sheets" is not true of infinitely many): a finite
  // covering says how many sheets (both, all 3), a window says which and of how many (the sheets k = -2, ..., 2 of
  // infinitely many), a capped one how many combinations (24 of the 30). fmt 'tex': {src, p} for $t or capT, with p.k
  // the window as TeX without dollars (the caller wraps it), src null for the plural string done (p.text); 'html': the
  // Landscape title's suffix (", both sheets"). Finite counts are of distinct sheets (sh.D: √ then z⁴ draws 4
  // combinations that are 2 sheets).
  function sheetsClause(sh, fmt) {
    const win = sh.pieces.some((q) => !(q.n > 0)), html = fmt === 'html', D = sh.D || sh.K, capped = sh.total > sh.K;
    const nd = win ? D : sh.K;   // (the surfaces drawn: a window's coinciding combinations are one sheet)
    // (the window as drawn, centred on the step's own branch kb when every window piece has the same)
    const kbs = [...new Set(sh.pieces.filter((q) => !(q.n > 0)).map((q) => q.kb || 0))], kb = kbs.length === 1 ? kbs[0] : 0;
    const k = html ? `<i>k</i> = ${I18N.num(kb - sh.W).replace('-', '−')}…${I18N.num(kb + sh.W).replace('-', '−')}` : `k=${kb - sh.W},\\dots,${kb + sh.W}`;
    const N = sh.pieces.reduce((x, q) => x * (Number.isFinite(q.of) ? q.of : Infinity), 1);
    if (html) {
      if (capped) return win ? $t(', {K} of {total} sheet combinations, {k}', { K: sh.K, total: sh.total, k }) : $t(', {K} of {total} sheet combinations', { K: sh.K, total: sh.total });
      if (!win) return D === 2 ? $t(', both sheets') : $tn(', all {n} sheets', ', all {n} sheets', D);
      return sh.pieces.length === 1 ? $t(', sheets {k}', { k }) : $tn(', {n} sheets, {k}', ', {n} sheets, {k}', nd, { k });
    }
    if (capped) return win ? { src: '; %{K} of the %{total} sheet combinations in the window %{k} are shown.', p: { K: sh.K, total: sh.total, k } } : { src: '; %{K} of the %{total} sheet combinations are shown.', p: { K: sh.K, total: sh.total } };
    if (!win) return D === 2 ? { src: '; both sheets are shown.', p: {} } : { src: null, p: { text: $tn('; all {n} sheets are shown.', '; all {n} sheets are shown.', D) } };
    if (sh.pieces.length === 1) return Number.isFinite(N) ? { src: '; the sheets %{k} of %{N} are shown.', p: { k, N } } : { src: '; the sheets %{k} of infinitely many are shown.', p: { k } };
    return Number.isFinite(N) ? { src: '; %{n} of the %{N} sheets are shown (the window %{k}).', p: { n: nd, N, k } } : { src: '; %{n} of the infinitely many sheets are shown (the window %{k}).', p: { n: nd, k } };
  }
  // the Landscape title's sheets suffix, as both views' titles say it: which sheets are drawn (", both sheets"); '' for
  // the principal branch
  function landSheetsHtml() {
    const shw = sheetsShown();
    return shw ? sheetsClause(shw, 'html') : '';
  }
  // the TeX parameters of a clause: the window k is math (wrap: {m} for capT, $..$)
  const sheetsTexP = (p, wrap) => { const r = Object.assign({}, p); if (r.k != null) r.k = wrap(r.k); return r; };
  // the All sheets check: with more sheet combinations than the landscape draws (GLR caps them), "24 of 30"
  function sheetsLabel(lab, ms) {
    const span = lab && lab.querySelector('span');
    if (!span) return lab;
    const capped = !!(S.sheets && ms && ms.total > ms.K);
    span.textContent = capped ? $t('All sheets ({K} of {total})', { K: ms.K, total: ms.total }) : $t('All sheets');
    if (capped) lab.dataset.tip = $t('{K} of the {total} surfaces are drawn (at most {K}).', { K: ms.K, total: ms.total }); else delete lab.dataset.tip;
    return lab;
  }
  // a region formula has no box (Region.bboxOf is null), so its note asked whether it is bounded: no point
  // of it on circles far out (radius 10³ and 10⁵ about 0, 4096 directions each), and it is taken as bounded (|z+1| < 1
  // is; a strip, a half-plane, the outside of a disc are not). A complement is unbounded
  function formulaBounded(s) {
    if (!s || s.kind !== 'formula' || s.complement) return false;
    let f;
    try { f = Expr.compileLevel(Expr.parse((s.bind && s.bind.expr) || s.expr, { allowRel: true })); } catch (e) { return false; }
    try { for (const R of [1e3, 1e5]) for (let i = 0; i < 4096; i++) { const a = (i + 0.5) * TAU / 4096; if (!(f(C(R * Math.cos(a), R * Math.sin(a))) < 0)) return false; } } catch (e) { return false; }
    return true;
  }
  // the step editor's "Show all sheets": Landscape (3) with All sheets on
  // (setSheets sends sheets-shown when it turns them on; with the sheets already on, Show all sheets sends it itself)
  function showAllSheets() { if (S.view.main !== 'land') setMain('land'); if (!S.sheets) setSheets(true); else tourEmit('sheets-shown', {}); }
  function setSheets(on) {
    setOpt('sheets', !!on);
    // the sheets of a root share |F|: they separate in Re F and Im F
    if (on && (S.height === 'log' || S.height === 'abs')) { setOpt('height', 'im'); toast($t('All sheets: the height is now Im {x}, where the sheets come apart (a modulus height stacks them).', { x: SV.on ? svHeightName('text') : fnText() })); }
    buildRightFoot(); updateFocusUI(); requestRender('L'); save();
    if (on) tourEmit('sheets-shown', {});
  }
  // both panes' options strips (the name is kept from when only the right pane had one)
  function buildRightFoot() { buildFoot('L'); buildFoot('R'); setReadouts(probe); if (Phone.isOn && Phone.isOn() && Phone.refreshDisplay) Phone.refreshDisplay(); }
  // X's paint changed (style, sectors, grid step): X redraws
  const paintChanged = () => requestRender('L', 'T');
  function buildFoot(side) {
    const f = $(side === 'L' ? 'leftFoot' : 'rightFoot');
    if (!f) return;
    unitHome(f);
    f.innerHTML = '';
    f.className = 'options';
    const ft = foot[side];
    ft.kids = []; ft.widths = null; ft.n = -1;
    // (a strip in the pane head shows even with no options of its own: its Display ▾ holds the regions')
    const headed = () => !!(f.parentElement && f.parentElement.classList.contains('pane-head'));
    if (side === 'L') { buildFootL(f); f.hidden = !f.children.length && !headed(); ft.kids = [...f.children]; layoutFootSide('L', true); drawLegend(); return; }
    // (Y's strip: the right pane draws nothing, so its strip has no options)
    f.hidden = !f.children.length && !headed();
    ft.kids = [...f.children]; layoutFootSide('R', true);
    drawLegend();
  }
  // a Paths toggle's state (the deformation's and the steps view's): pressed while the paths show, its tip saying what a
  // press does; off, with the reason, when there are no paths to draw (noPaths: a d/dz)
  function syncPathsBtn(b, on, noPaths) {
    const pressed = String(on && !noPaths);
    const tip = noPaths ? $t('d/dz is not a map, so there are no paths t ↦ Hₜ(z) to draw') : on ? $t('Hide the paths t ↦ Hₜ(z)  P') : $t('Show the paths t ↦ Hₜ(z)  P');
    if (b.getAttribute('aria-pressed') !== pressed) b.setAttribute('aria-pressed', pressed);
    if (b.disabled !== !!noPaths) b.disabled = !!noPaths;
    if (b.dataset.tip !== tip) b.dataset.tip = tip;
    // (a disabled button gets no pointer events, so its reason is also its description)
    const desc = noPaths ? tip : '';
    if ((b.getAttribute('aria-description') || '') !== desc) b.setAttribute('aria-description', desc);
  }
  // (its name is also a text, which only the phone's Display sheet shows beside the icon)
  const resetCamBtn = (c, d) => h('button', { class: 'icon-btn small cam-reset', title: $t('Reset camera'), 'aria-label': $t('Reset camera'), html: ICONS.orbit, onclick: () => tweenCam(c, d) }, h('span', { class: 'cr-t', 'aria-hidden': 'true' }, $t('Reset camera')));
  // the Equator checkbox's tooltip (P2: formerly "Plane")
  function tipEq(f) { const l = f.querySelector('label.check:has(> input[id^="eqChk"])'); if (l) l.dataset.tip = $t('Equatorial plane and projection ray'); }
  // X's strip (panels.md 4): the paint's part (Phase on: style, n, Δ, Outlines), then the surface's part (Sphere:
  // Equator, Reset camera; Landscape: height, sheets, scale, unit level, view, Reset camera). X Plane with Phase off
  // has none (the strip hides).
  // the colouring's own scrubs after the style row: n, the sectors per turn, only for the styles it changes (Tiles,
  // Contours, Cauchy's Tiles, the relief's), and the pulled-back grid's step; idSuffix tells a second copy's ids apart
  function colourScrubs(land, idSuffix) {
    const out = [];
    if (land || /^(enhanced|modulus|cauchy)$/.test(S.dc)) out.push(h('div', { class: 'scrub ovf', 'data-tip': $t('Phase sectors') }, h('span', { class: 'pl' }, 'n'), choiceEl('secSel' + idSuffix, String(S.sectors || 12), [['8', '8'], ['12', '12'], ['16', '16'], ['24', '24']], (v) => { setOpt('sectors', +v); paintChanged(); drawLegend(); save(); }, $t('Phase sectors'))));
    if (S.dc === 'grid' && !land) out.push(h('div', { class: 'scrub ovf', 'data-tip': $t('Grid step') }, h('span', { class: 'pl' }, 'Δ'), choiceEl('dcGridSel' + idSuffix, String(S.dcGrid), [['0.1', '0.1'], ['0.25', '0.25'], ['0.5', '0.5'], ['1', '1'], ['2', '2']], (v) => { setOpt('dcGrid', +v); paintChanged(); save(); }, $t('Grid step'))));
    if (SV.on && !land) out.push(opacityScrub(idSuffix));
    return out;
  }
  // a control that does not apply on the shown plane: in place, with the one disabled look and its reason as the tip
  function disableCtl(el, reason) {
    svDisableWhy(el, reason);
    const inp = el.querySelector('input');
    if (inp) { inp.disabled = true; inp.setAttribute('aria-description', reason); }
  }
  // the steps view's Opacity slider: svOpacity's range in whole percents, valuetext and the value beside it saying the
  // percent; setFillOpacity (S.alpha's one setter) keeps it and the regions' own slider at one value
  const opacityText = (v) => I18N.num(Math.round(v * 100)) + ' %';
  function syncOpacityRange(rng) {
    const v = svOpacity();
    rng.value = String(v); rng.setAttribute('aria-valuetext', opacityText(v));
    rng.nextElementSibling.textContent = opacityText(v);
    paintFader(rng);
  }
  // (on the Landscape the sheets are opaque: the slider is there, disabled, after the Landscape's own controls, and its tip says so)
  function opacityScrub(idSuffix, land) {
    const rng = h('input', { type: 'range', class: 'sv-opacity', id: 'opacityRange' + idSuffix, min: SV_OPACITY_MIN, max: 1, step: 0.05, 'aria-label': $t('Opacity'), oninput: (e) => setFillOpacity(+e.target.value) });
    const tip = land ? $t('The Landscape draws its sheets opaque; opacity applies to the plane.') : $t('How much the layers behind show through where the picture covers a point more than once.');
    if (land) { rng.disabled = true; rng.setAttribute('aria-disabled', 'true'); rng.setAttribute('aria-description', tip); }
    const row = h('label', { class: 'fader-row compact' + (land ? ' is-disabled' : ''), 'data-tip': tip }, h('span', { class: 'fl' }, $t('Opacity')), rng, h('span', { class: 'fval mono' }));
    syncOpacityRange(rng);
    return row;
  }
  // why the Cauchy style and its parts are not offered while the colour plane is not z (the integral is drawn on z, where its curve lies)
  function cauchyOffZWhy() { return $t('The Cauchy integral is drawn on z, where its curve lies: colour from z'); }
  // the Height control's options: the kind of height of the map Fn ("Re F"); in the steps view, where what the height reads
  // changes with the plane and the colour plane (the title, the key and the ruler name it), the kind alone ("Re"), each
  // button named and titled in words that start with its visible label ("Re, real part"; the modulus, |·|, is symbols
  // alone, and its words are its name)
  function heightOptions(Fn) {
    const lg = I18N.fnName('log');
    if (!SV.on) return [['log', `${lg} |${Fn}|`], ['abs', `|${Fn}|`], ['re', `Re ${Fn}`], ['im', `Im ${Fn}`]];
    const kinds = [['log', `${lg} |·|`, lg, $t('log of the modulus')], ['abs', '|·|', '', $t('modulus')], ['re', 'Re', 'Re', $t('real part')], ['im', 'Im', 'Im', $t('imaginary part')]];
    return kinds.map(([v, l, lead, words]) => { const name = !lead || words.startsWith(lead) ? words : `${lead}, ${words}`; return [v, l, name, name]; });
  }
  function buildFootL(f) {
    const Fn = fnText();
    // the Landscape view (merged-views.md): its height, then its colouring in one control: the phase colours the relief
    // can paint (Tiles, Plain) or plaster. Plain on the relief is S.landPlain, so the portrait keeps its own style (P10)
    if (lLand()) {
      const paint = !S.view.D.phase ? 'plaster' : landMaterial() === 'phase' ? 'phase' : 'tiles';
      f.append(
        seg('heightSeg', S.height, heightOptions(Fn), (v) => { setOpt('height', v); updateFocusUI(); requestRender('L'); save(); }, $t('Height')),
        seg('landPaint', paint, [['tiles', $t('Tiles'), $t('Phase colours with modulus contours')], ['phase', $t('Plain'), $t('Phase colours only')], ['plaster', $t('Plaster'), $t('The relief alone, lit')]], (v) => {
          setViewOpt('D', 'phase', v !== 'plaster');
          if (v === 'phase') setOpt('landPlain', S.dc !== 'phase');
          else if (v === 'tiles') { setOpt('landPlain', false); if (S.dc === 'phase') setOpt('dc', 'enhanced'); }
          buildRightFoot(); regionsNote(); updateFocusUI(); paintChanged(); save();
        }, $t('Colouring')));
    }
    // the colour panel: the same controls on every plane of the steps view, before and after the colour plane; one that
    // has no meaning on the shown plane stays in place, disabled, its reason the tip
    if (lPhase() || (SV.on && !lLand())) {
      const land = lLand();
      if (!land) f.append(styleSeg());
      if (S.dc === 'cauchy' && (lColor() || SV.on)) {
        const cp = cauchyPlot(), Fh = fnHtml(), ck = cauchyKind(), kind = ck ? ck.kind : null;
        // (#235: with poles inside the curve, which halves show; the words say what the picture is)
        // (the steps view offers the parts on every plane whenever the style is Cauchy: off for a curve without a pole inside, with the reason)
        const parts = kind === 'split' || SV.on ? seg('cauchySeg', S.cauchyShow, [['both', $t('Both'), $t('Both parts: f₊ inside the curve, f₋ outside it')], ['in', $t('Inside'), $t('Only f₊, inside the curve')], ['out', $t('Outside'), $t('Only f₋, outside the curve')]], (v) => { setOpt('cauchyShow', v); requestRender('L'); save(); }, $t('Cauchy integral: parts shown')) : null;
        const offZ = SV.on && svT() !== 0;
        const partsWhy = kind === 'split' && !offZ ? '' : offZ ? cauchyOffZWhy() : !cp ? $t('Select a closed curve or a bounded region: its Cauchy integral is shown.') : kind === 'numeric' ? $t('Computed numerically: there is no f₊ and f₋ to show apart') : kind === 'undefined' ? $t('F is not finite on the curve: its Cauchy integral is not defined') : $t('No pole inside the curve: F inside, 0 outside');
        if (parts) {
          if (partsWhy) for (const b of parts.querySelectorAll('button')) { b.disabled = true; b.dataset.tip = partsWhy; b.setAttribute('aria-description', partsWhy); }
          f.append(parts);
        }
        const noteHtml = SV.on && svT() !== 0 ? cauchyOffZWhy() : !cp ? $t('Select a closed curve or a bounded region: its Cauchy integral is shown.')
          : kind === 'split' ? $t('(1/2π<i>i</i>) ∮ {Fh}(<i>ζ</i>)/(<i>ζ</i> − <i>z</i>) d<i>ζ</i> over {name}: <i>f</i>₊ inside, <i>f</i>₋ outside, {Fh} = <i>f</i>₊ + <i>f</i>₋', { Fh, name: cp.name })
          : kind === 'numeric' ? $t('(1/2π<i>i</i>) ∮ {Fh}(<i>ζ</i>)/(<i>ζ</i> − <i>z</i>) d<i>ζ</i> over {name}, computed numerically: {Fh} has a singularity inside that is not a pole', { Fh, name: cp.name })
          : kind === 'undefined' ? $t('{Fh} is not finite on {name}: its Cauchy integral is not defined', { Fh, name: cp.name })
          : $t('(1/2π<i>i</i>) ∮ {Fh}(<i>ζ</i>)/(<i>ζ</i> − <i>z</i>) d<i>ζ</i> over {name}: {Fh} inside, 0 outside', { Fh, name: cp.name });
        f.append(h('span', { class: 'foot-note', html: noteHtml }));
      }
      f.append(...colourScrubs(land, ''));
      if (lColor() || SV.on) {
        const ol = checkEl('outlineChk', S.outline, $t('Outlines'), (v) => { setOpt('outline', v); requestRender('L'); save(); }, ICONS.outlines);
        if (!lColor()) disableCtl(ol, $t('Outlines are drawn on the colour plane'));
        f.append(ol);
      }
    }
    if (lGlobe()) {
      f.append(checkEl('eqChkL', xView().eq, $t('Equator'), (v) => { xView().eq = v; requestRender('L'); save(); }), resetCamBtn(camL, CAML));
      tipEq(f);
    } else if (lLand()) {
      // All sheets: the whole covering surface of a multivalued map (a window of 2W + 1 sheets for log and
      // irrational powers)
      const ms = multiSheet();
      f.append(
        ...(ms ? [sheetsLabel(checkEl('sheetsChk', S.sheets, $t('All sheets'), (v) => setSheets(v)), ms)] : []),
        ...(ms && S.sheets && ms.infinite ? [h('div', { class: 'scrub', 'data-tip': $t('Sheets shown on each side of the principal one') }, h('span', { class: 'pl' }, $t('sheets ±')), selectEl('sheetWSel', String(S.sheetW || 2), [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], (v) => { setOpt('sheetW', +v); const c = $('sheetsChk'); if (c) sheetsLabel(c.closest('label'), multiSheet()); requestRender('L'); save(); }, $t('Sheets on each side')))] : []),
        h('label', { class: 'fader-row compact' }, h('span', { class: 'fl' }, $t('Scale')), h('input', { type: 'range', id: 'lscaleRange', min: 0.25, max: 2, step: 0.05, value: S.lscale || 1, 'aria-label': $t('Height scale'), oninput: (e) => { setOpt('lscale', +e.target.value); requestRender('L'); save(); } })),
        checkEl('unitLevelChk', S.unitLevel, $t('Unit level'), (v) => { setOpt('unitLevel', v); requestRender('L'); save(); }),
        seg('viewSeg', '', [['iso', '3/4'], ['top', $t('Top')], ['front', $t('Front')]], (v) => tweenCam(cam, { iso: { yaw: -38 * DEG, pitch: 30 * DEG }, top: { yaw: -90 * DEG, pitch: 88 * DEG }, front: { yaw: -90 * DEG, pitch: 8 * DEG } }[v]), $t('View')),
        resetCamBtn(cam, CAM3),
        ...(SV.on ? [opacityScrub('', true)] : []));
    }
  }
  let legendNeedle = null, legendMod = null;
  const WHEEL_STOPS = ['#F58C7E', '#EA9853', '#CFA93E', '#A5B953', '#6EC580', '#27C8AF', '#1CC3D8', '#53B8F7', '#8EAAFD', '#B99BF5', '#DB8FD6', '#F089AC'];
  // The legend's static part (ring, strip, words) is painted once per look into an offscreen canvas; a probe move
  // only blits it and draws the needle and the modulus tick, on the next frame (requestRender('G')).
  const WHEEL_RGB = WHEEL_STOPS.map((c) => GLR.hexRGB(c));
  // the colour keys' colour of arg a (radians): the legend wheel's stops, or an Arb palette's colour at |F| = 1
  function keyRGB(a) {
    if (GLR.palette() !== 'wheel') return GLR.paletteRGB(a, 0);
    const deg = ((a / DEG) % 360 + 360) % 360, f = deg / 30, k = Math.floor(f) % 12, t = f - Math.floor(f);
    const c0 = WHEEL_RGB[k], c1 = WHEEL_RGB[(k + 1) % 12];
    return c0.map((v, j) => v + (c1[j] - v) * t);
  }
  const keyHex = (a) => '#' + keyRGB(a).map((x) => Math.round(255 * x).toString(16).padStart(2, '0')).join('');
  // the key as a CSS conic gradient: arg increasing counterclockwise from 1 (the folded legend chip, the header button)
  const keyConic = () => `conic-gradient(from 90deg, ${Array.from({ length: 25 }, (_, i) => keyHex(-i * 15 * DEG)).join(', ')})`;
  // (Hc: the key's height when it is one line of text with no ring)
  const LEG = { W: 136, H: 72, Hc: 24, dpr: 2, cx: 42, cy: 36, R: 24, r0: 14, sx: 80, sy: 30, sw: 48, sh: 8 };
  // one legend chip per pane (U-b): X's colour key while Phase is on (wheel and modulus strip; the landscape's
  // height), Y Plane's pattern key. legendKind(side): 'color' | 'sphere' | '3d' (X) | 'image' (Y) | null
  const legendState = { L: { key: '', drawn: '', cv: null, strip: false }, R: { key: '', drawn: '', cv: null, strip: false } };
  // the steps view on a plane other than the colour plane: the colour wheel, with the plane its colour is carried from
  const svCarriedKey = () => SV.on && !!svCarriedFrom();
  // the Landscape's key under Plaster: the height and the contours, with no hue
  const plasterKey = (kind) => kind === '3d' && !lPhase();
  function legendKind(side) {
    if (!GLR.ok) return null;
    if (side === 'R') return rImage() ? 'image' : null;
    // (the Landscape's key is its height, whichever Colouring it has: Plaster draws no phase colours, and no carried wheel)
    if (lLand()) return '3d';
    if (svCarriedKey()) return 'color';
    if (!lPhase()) return null;
    return lGlobe() ? 'sphere' : 'color';
  }
  // (v16.5 UX20, restores "nothing covers the work uninvited") On a desktop each plane's key and its display options
  // sit in its pane head, not on the picture: the key as a short chip that unfolds under the head while hovered or
  // after a click, the options behind the Display options button. A phone
  // keeps both on the plane, where the key is a folded glyph and the options are in the Display sheet.
  const keyOnPlot = () => { const k = legendKind('L'); return k === 'color' || k === 'sphere'; };
  function placeKeys() {
    const ph = document.documentElement.classList.contains('ph');
    let moved = false;
    for (const side of ['L', 'R']) {
      const pane = side === 'L' ? $('paneL') : $('paneR'), head = pane && pane.querySelector('.pane-head'), plot = $(side === 'L' ? 'plotL' : 'plotR');
      const leg = $(side === 'L' ? 'leftLegend' : 'rightLegend'), ft = $(side === 'L' ? 'leftFoot' : 'rightFoot'), led = $(side === 'L' ? 'leftLed' : 'rightLed');
      if (!head || !plot || !leg || !ft) continue;
      // (#365: Phase's colour key is always on the plot, top right: no hover, no toggle. The Landscape's height key and
      // Y's pattern key stay chips in the head)
      const onPlot = side === 'L' && !ph && keyOnPlot();
      if (!ph) delete leg.dataset.phKey;
      if (onPlot) {
        if (leg.parentNode !== plot) {
          leg.classList.remove('open', 'collapsed'); plot.insertBefore(leg, plot.querySelector(':scope > .viewstack'));
          const sm = leg.querySelector(':scope > .lg-sum'); if (sm) sm.remove();
          leg.removeAttribute('aria-label'); moved = true;
        }
        if (ft.parentNode !== head) head.insertBefore(ft, led && led.parentNode === head ? led : null);
      } else if (!ph) {
        if (leg.parentNode !== head) { head.insertBefore(leg, led && led.parentNode === head ? led : null); leg.classList.remove('collapsed'); moved = true; }
        if (ft.parentNode !== head) head.insertBefore(ft, led && led.parentNode === head ? led : null);
        // (the empty chain's call to action too: "Add function" in Y's head, not over the picture)
        const er = side === 'R' ? $('emptyRight') : null;
        if (er && er.parentNode !== head) head.insertBefore(er, leg);
      } else {
        const ro = $(side === 'L' ? 'leftReadout' : 'rightReadout'), vs = plot.querySelector(':scope > .viewstack');
        // (data-ph-key marks a legend this branch has placed: one the desktop's branch left on the plot is placed again, folded)
        if (leg.parentNode !== plot || !leg.dataset.phKey) {
          leg.dataset.phKey = '1';
          // (the head's words and tooltip go: on the plane the key is the folded glyph, a tap unfolds it)
          leg.classList.remove('open'); plot.insertBefore(leg, ro ? ro.nextSibling : vs);
          const sm = leg.querySelector(':scope > .lg-sum'); if (sm) sm.remove();
          leg.removeAttribute('aria-label');
          try { if (matchMedia('(pointer: coarse)').matches) leg.classList.add('collapsed'); } catch (e) { /* */ }
        }
        if (ft.parentNode !== plot) plot.insertBefore(ft, vs);
        const er = side === 'R' ? $('emptyRight') : null;
        if (er && er.parentNode !== plot) plot.insertBefore(er, $('draftChipR'));
      }
    }
    if (foot.L.kids.length || foot.R.kids.length) layoutFoot(true);
    if (moved) drawLegend();   // (the chip's words, written when it is in the head)
  }
  // the key chip's words in the pane head: the grid's cell while the regions' grid lines are drawn, else their fill, the
  // phase of z (Y), or what X's colours show
  function legendSum(kind) {
    if (kind === 'image') return S.lines ? $t('cell {x}', { x: I18N.num(CX.fmtNum(patternCell(), 4).replace('-', '−')) }) : $t('Phase of z');
    return kind === '3d' ? $t('Height key') : $t('Colour key');
  }
  function drawLegend() {
    // (the view changed under a laptop: Phase's key goes to the plot, the others' back to the head)
    const L = $('leftLegend'), pl = $('plotL');
    if (L && pl && !document.documentElement.classList.contains('ph') && (L.parentNode === pl) !== keyOnPlot()) placeKeys();
    drawLegendSide('L'); drawLegendSide('R');
  }
  const KEY_GUTTER = 4;   // px between an unfolded key and its plane's edge
  // ([#337] the key unfolds over the top of the plot, where the probe's readout (which also carries the idle hint) and the
  // empty or dim notes lie. In a pane head its pop-up opens below the ones it would cover; on a phone, where the chip
  // lies in the plot, the chip, folded or unfolded, drops below the readout it would touch (a folded one by its 44 px
  // hit area, 8 px out from the glyph), unless that puts it under the context bar. The drop, --lg-drop, is the
  // distance to the lowest of them, less what an unfolded card on a phone needs to end KEY_GUTTER above the plane's foot; it is
  // recomputed each time the key is shown, and, on a phone, whenever a readout changes size or the context bar opens or closes)
  const LEGEND_HIT_PX = 8, LEGEND_BAR_GAP_PX = 4;
  // (a phone's unfolded chip stays above the context bar, which overlays the foot of the plane: it moves up by what
  // it runs under the bar, as far as 4 px under the plane's top or under the foot of a readout above it in its
  // column. What still runs under the bar then is cut off the chip's height, and the chip scrolls, so all of the key
  // stays in reach; placeKeyPopReadout gives the chip its whole height back)
  function clearContextBar(box) {
    const bar = document.querySelector('.ph-ctx.in'), plot = /** @type {HTMLElement} */ (box.parentNode);
    if (!bar || !plot || box.classList.contains('collapsed') || plot.classList.contains('pane-head')) return;
    const c = box.getBoundingClientRect();
    if (!c.width) return;
    const over = Math.ceil(c.bottom - (bar.getBoundingClientRect().top - LEGEND_BAR_GAP_PX));
    if (over <= 0) return;
    const planeTop = plot.getBoundingClientRect().top + LEGEND_BAR_GAP_PX;
    let top = planeTop;
    for (const e of plot.querySelectorAll(':scope > .chip.readout')) {
      const r = e.getBoundingClientRect();
      if (r.width && r.left < c.right && c.left < r.right && r.top < c.top) top = Math.max(top, r.bottom + LEGEND_BAR_GAP_PX);
    }
    // (under the readouts it would meet when it then stands whole above the bar; else it takes the plane's top, over them, and the readouts it
    // then covers give way, .over-readout: the key's words are the greater loss)
    const below = Math.max(0, Math.min(over, Math.floor(c.top - top))), up = below >= over ? below : Math.max(0, Math.min(over, Math.floor(c.top - planeTop)));
    const cTop = c.top - up, cBottom = c.bottom - up;
    box.classList.toggle('over-readout', up > below && [...plot.querySelectorAll(':scope > .chip.readout')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left < c.right && c.left < r.right && r.top < cBottom && cTop < r.bottom; }));
    if (up) box.style.setProperty('--lg-drop', `${(parseFloat(box.style.getPropertyValue('--lg-drop')) || 0) - up}px`);
    if (over > up) {
      const cs = getComputedStyle(box), edges = ['borderTopWidth', 'borderBottomWidth', 'paddingTop', 'paddingBottom'].reduce((s, k) => s + (parseFloat(cs[k]) || 0), 0);
      box.style.maxHeight = `${Math.max(0, Math.floor(c.height - (over - up) - edges))}px`;
      box.style.overflowY = 'auto';
    }
  }
  function placeKeyPop(box) { placeKeyPopReadout(box); clearContextBar(box); }
  function placeKeyPopReadout(box) {
    const pane = box && box.closest('.pane'), plot = pane && pane.querySelector('.plot');
    if (!box || !plot || !box.parentNode) return;
    const head = box.parentNode.classList.contains('pane-head');
    const el = head ? box.querySelector(':scope > canvas') : box;
    box.style.removeProperty('--lg-drop'); box.style.removeProperty('--lg-shift'); box.style.removeProperty('max-height'); box.style.removeProperty('overflow-y'); box.classList.remove('over-readout');
    if (!el) return;
    const reach = !head && box.classList.contains('collapsed') ? LEGEND_HIT_PX : 0;   // (a folded chip is pressed 8 px out from its glyph)
    // (a head's pop-up is anchored by its right edge: a chip near the pane's left edge would push it past that edge, so
    // it shifts right, and past the right edge it shifts left, to lie inside the pane with a gutter, KEY_GUTTER)
    const c0 = el.getBoundingClientRect(), pr = pane.getBoundingClientRect();
    if (head && c0.width) {
      const lo = pr.left + KEY_GUTTER - c0.left, hi = pr.right - KEY_GUTTER - c0.right, sh = lo > 0 ? Math.ceil(lo) : hi < 0 ? Math.floor(hi) : 0;
      if (sh) box.style.setProperty('--lg-shift', `${sh}px`);
    }
    const sel = head ? ':scope > .chip.readout, :scope > .empty-chip, :scope > .dim-chip' : ':scope > .chip.readout';
    for (let i = 0; i < 3; i++) {
      const c = el.getBoundingClientRect();
      if (!c.width) return;   // (shown by :hover or .open: not shown, nothing to place)
      let drop = 0;
      for (const e of plot.querySelectorAll(sel)) {
        const r = e.getBoundingClientRect();
        if (r.width && r.left < c.right + reach && c.left - reach < r.right && r.top < c.bottom + reach && c.top - reach < r.bottom) drop = Math.max(drop, r.bottom + 6 + reach - c.top);
      }
      if (drop <= 0) break;
      // (a folded chip does not go under the context bar: the readout it would touch is the lesser harm)
      const bar = reach ? document.querySelector('.ph-ctx.in') : null;
      if (bar && c.bottom + drop + reach > bar.getBoundingClientRect().top) break;
      box.style.setProperty('--lg-drop', `${Math.ceil(parseFloat(box.style.getPropertyValue('--lg-drop')) || 0) + Math.ceil(drop)}px`);
    }
    // (on a phone the card stays inside the plane: a readout that wraps to more lines would drop it past the plane's foot, so the
    // drop gives up what the card needs, down to none, and the card then overlaps the readout's last lines, which take no press
    // there. A head's pop-up has no such room: the readout there takes presses, and it stays under the pop-up's drop)
    if (!head) {
      const over = el.getBoundingClientRect().bottom - (plot.getBoundingClientRect().bottom - KEY_GUTTER), dropNow = parseFloat(box.style.getPropertyValue('--lg-drop')) || 0;
      if (over > 0 && dropNow > 0) box.style.setProperty('--lg-drop', `${Math.max(0, dropNow - Math.ceil(over))}px`);
    }
  }
  // (a key is a button on a phone and in a pane's head: a name, a place in the focus order, aria-expanded (the fold's on a
  // phone, the panel's in a head, which Enter, Space and Escape open and shut: setupPaneButtons). A key lying open on the plane
  // off the phone takes role img and leaves the focus order)
  function legendKeyButton(box, name) {
    const par = box.parentNode, head = !!par && (/** @type {HTMLElement} */ (par)).classList.contains('pane-head');
    const btn = !!par && (head || document.documentElement.classList.contains('ph'));
    if (btn) {
      // (a head's key shows its panel while kept open, or focused and not shut: pointing at it shows it too, which a button's state does not follow)
      const shown = head ? box.classList.contains('open') || (!box.classList.contains('shut') && box.matches(':focus-visible')) : !box.classList.contains('collapsed');
      const open = shown ? 'true' : 'false';
      if (box.getAttribute('role') !== 'button') box.setAttribute('role', 'button');
      if (box.tabIndex !== 0) box.tabIndex = 0;
      if (box.getAttribute('aria-expanded') !== open) box.setAttribute('aria-expanded', open);
      if (name && box.getAttribute('aria-label') !== name) box.setAttribute('aria-label', name);
    } else if (box.getAttribute('role') === 'button') {
      box.setAttribute('role', 'img'); box.removeAttribute('tabindex'); box.removeAttribute('aria-expanded');
    }
  }
  // the key's canvas has no words a screen reader reaches: what it draws (paintLegend's st.say) is the key box's
  // description (srSay), in a hidden span inside the box (#leftLegendSay, #rightLegendSay; inside, so it moves with the
  // box and is never an item of a pane head's row)
  function legendSaid(box, text) { srSay(box, text, (sp) => box.append(sp)); }
  function drawLegendSide(side) {
    const box = $(side === 'L' ? 'leftLegend' : 'rightLegend');
    const cv = $(side === 'L' ? 'legendCanvasL' : 'legendCanvas');
    if (!box || !cv) return;
    // no legend without WebGL: the plane shows nothing it could explain
    const kind = legendKind(side);
    const want = !!kind;
    if (box.hidden === want) box.hidden = !want;
    // (the folded chip on a phone shows a glyph of its key: the hue wheel, arg increasing counterclockwise from red at
    // 1, or a checker for the Regions key)
    if (kind && box.parentNode && /** @type {HTMLElement} */ (box.parentNode).classList && /** @type {HTMLElement} */ (box.parentNode).classList.contains('pane-head')) {
      let sm = box.querySelector(':scope > .lg-sum');
      if (!sm) { sm = h('span', { class: 'lg-sum' }); box.prepend(sm); }
      const tx = legendSum(kind);
      if (sm.textContent !== tx) sm.textContent = tx;
    }
    // (the phone's key button is named for its kind, "Regions key" as "Height key" and "Colour key": what the key
    // shows, its fill among it, is its description's (legendSaid), so a screen reader says it once)
    legendKeyButton(box, !kind ? '' : kind === 'image' ? $t('Regions key') : legendSum(kind));
    // (#365: Phase's key lies on the plot with no words of its own: its name is the label)
    if (kind && box.parentElement && box.parentElement.id === 'plotL' && !document.documentElement.classList.contains('ph')) {
      const nm = $t('Colour key');
      if (box.getAttribute('aria-label') !== nm) box.setAttribute('aria-label', nm);
    }
    // (the chip's glyph is the hue wheel; the Landscape under Plaster paints no hue, so its glyph keeps the neutral ink)
    const hueless = plasterKey(kind);
    if (kind && (box.dataset.kind !== kind || box.dataset.pal !== GLR.palette() || box.dataset.hueless !== String(hueless))) {
      box.dataset.kind = kind; box.dataset.pal = GLR.palette(); box.dataset.hueless = String(hueless);
      if (hueless) box.style.removeProperty('--wheel'); else box.style.setProperty('--wheel', keyConic());
    }
    if (side === 'L') {
      // the Key switch: X's colour key painted in the Y plane (the user's decision for item 1: not a view of Y)
      const ks = $('wKeyRow');
      // (the key shows only in X → Y, so its switch is the "Phase key" check in Y's strip)
      const showKey = false;
      if (ks && ks.hidden === showKey) ks.hidden = !showKey;
      const kc = $('wKeyChk');
      if (kc && kc.checked !== !!S.wKey) kc.checked = !!S.wKey;
      // (in Y's variable, P13)
      const kl = ks && ks.querySelector('span'), kt = $t('Key in the {x}-plane', { x: yHtml() });
      if (kl && kl.innerHTML !== kt) kl.innerHTML = kt;
    }
    if (!want) return;
    const st = legendState[side];
    // (the steps view's Cauchy style off plane z: the reason alone, in a box of one line)
    const compact = SV.on && kind === 'color' && S.dc === 'cauchy' && svT() !== 0 && !svCarriedFrom();
    const { W, dpr } = LEG, Hh = compact ? LEG.Hc : LEG.H;
    if (cv.width !== W * dpr || cv.height !== Hh * dpr) { cv.width = W * dpr; cv.height = Hh * dpr; cv.style.height = Hh + 'px'; st.drawn = ''; }
    st.h = Hh;
    const img = kind === 'image';
    const k = rightStage();
    const anyCut = img && built.some((b, i) => i < k && S.steps[i] && S.steps[i].on !== false && b && !b.error && b.cuts.some((c) => c.kind === 'ray'));
    const key = [kind, plasterKey(kind), S.dc, compact, GLR.palette(), S.sectors, S.height, S.pattern, S.lines, img ? patternCell() : '', anyCut, S.fov, lFlat(), fnText(), SV.on ? svKeyName() + '|' + svCarriedFrom() : '', TH.ink, TH.plane, TH.lineStrong, document.fonts ? document.fonts.status : ''].join('|');
    if (st.key !== key || !st.cv) {
      if (!st.cv) st.cv = document.createElement('canvas');
      const off = st.cv;
      off.width = W * dpr; off.height = Hh * dpr;
      const octx = off.getContext('2d');
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintLegend(octx, anyCut, kind, st);
      st.key = key; st.drawn = '';
    }
    // (a head's key opens by pointing and by keys, which its name does not say: the instruction ends its description)
    const inHead = !!box.parentNode && /** @type {HTMLElement} */ (box.parentNode).classList.contains('pane-head');
    legendSaid(box, [(st.say || []).join('; '), inHead ? $t('Point at it to unfold; click it or press Enter to keep it open') : ''].filter(Boolean).join('. '));
    const dyn = img ? '' : `${legendNeedle == null ? '' : legendNeedle.toFixed(3)}|${legendMod == null ? '' : legendMod.toPrecision(4)}`;
    if (st.drawn === key + dyn) return;
    st.drawn = key + dyn;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(st.cv, 0, 0);
    if (img) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { cx, cy, R, sx, sy, sw, sh } = LEG;
    if (legendNeedle != null && !compact) {
      ctx.strokeStyle = TH.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(legendNeedle) * R, cy - Math.sin(legendNeedle) * R); ctx.stroke();
    }
    if (st.strip && legendMod != null && Number.isFinite(legendMod) && legendMod > 0) {
      const q = TAU / (S.sectors || 12);
      const f = ((Math.log(legendMod) / q) % 3 + 3) % 3;
      const mx = sx + f / 3 * sw;
      ctx.strokeStyle = TH.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx, sy - 2); ctx.lineTo(mx, sy + sh + 2); ctx.stroke();
    }
  }
  // the modulus key's facts, shared by the pane and the export's still and video: the bands' light and dark ends, the
  // factor per band, and the caption words around the plane's variable
  const keyStops = (dark) => (dark ? ['#3a4650', '#c9d2d8'] : ['#9aa4ab', '#eef2f4']);
  const keyFactor = (n) => I18N.num(n === 12 ? '×1.69' : `×${CX.fmtNum(Math.exp(TAU / n), 3)}`);
  const keyCaption = (plain, Fn) => (plain ? `arg ${Fn}` : $t('arg and |{Fn}|', { Fn }));
  function paintLegend(ctx, anyCut, kind, st) {
    const W = LEG.W, Hh = st.h || LEG.H;
    ctx.clearRect(0, 0, W, Hh);
    ctx.textBaseline = 'middle';
    st.strip = false;
    // (what the key draws, in words, in its order with the caption first: the key box's description, legendSaid)
    const say = st.say = [];
    if (kind === 'image') {
      // the regions' key: their fill, the phase of z, and the grid's cell in z while its lines are drawn, plus
      // markers present in the plane
      ctx.font = `600 11px ${TH.ui}`; ctx.fillStyle = TH.ink2; ctx.textAlign = 'left';
      ctx.fillText($t('Regions'), 8, 13);
      // "cell 0.5 in z" as one run: words in the interface face, the number in the mono face, z in STIX italic
      let x = 8;
      const run = (t, font, color) => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(t, x, 30); x += ctx.measureText(t).width; };
      // Russian: «клетка 0,125 в плоскости z» can be wider than the chip; then the run is narrowed to fit it, so
      // the plane's name is never cut. English draws unchanged
      const parts = S.lines
        ? [[$t('cell '), `11px ${TH.ui}`, TH.muted], [I18N.num(CX.fmtNum(patternCell(), 4).replace('-', '−')), `11px ${TH.mono}`, TH.ink], [$tx('legend', ' in '), `11px ${TH.ui}`, TH.muted], ['z', `italic 500 12px ${TH.math}`, TH.muted]]
        : [[$t('phase of '), `11px ${TH.ui}`, TH.muted], ['z', `italic 500 12px ${TH.math}`, TH.muted]];
      let k = 1;
      if (I18N.lang !== 'en') { let w = 0; for (const [t, f] of parts) { ctx.font = f; w += ctx.measureText(t).width; } k = Math.min(1, (W - 8 - 4) / w); }
      if (k < 1) { ctx.save(); ctx.translate(8, 0); ctx.scale(k, 1); x = 0; }
      for (const [t, f, c] of parts) run(t, f, c);
      if (k < 1) ctx.restore();
      say.push($t('Regions') + ': ' + parts.map((q) => q[0]).join(''));
      // only marks that this plane actually draws
      let y = 52;
      ctx.font = `11px ${TH.ui}`; ctx.lineWidth = 1;
      if (anyCut) { ctx.strokeStyle = TH.cut; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(24, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = TH.muted; ctx.fillText($t('image of a cut'), 30, y); y += 15; say.push($t('dashed: {x}', { x: $t('image of a cut') })); }
      if (S.fov !== false && lFlat() && y < 68) { ctx.strokeStyle = TH.fov; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(24, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = TH.muted; ctx.fillText($t('edge of X\'s view'), 30, y); say.push($t('dashed: {x}', { x: $t('edge of X\'s view') })); }
      return;
    }
    // (the steps view's Cauchy style off plane z draws no picture: the key is its reason alone, with no ring to run over)
    const cauchyOff = SV.on && kind === 'color' && S.dc === 'cauchy' && svT() !== 0 && !svCarriedFrom();
    // (the Landscape under Plaster paints no hue: its key keeps the height and the contours, with no ring)
    const noRing = cauchyOff || plasterKey(kind);
    st.ring = !noRing;
    // hue ring: arg increases counterclockwise from red at 1
    const { cx, cy, R, r0, sx, sy, sw, sh } = LEG;
    if (!noRing) for (let i = 0; i < 360; i++) {
      const a0 = i * DEG, a1 = (i + 1.5) * DEG;
      ctx.fillStyle = `rgb(${keyRGB(i * DEG).map((v) => Math.round(255 * v)).join(',')})`;
      ctx.beginPath(); ctx.arc(cx, cy, R, -a0, -a1, true); ctx.arc(cx, cy, r0, -a1, -a0, false); ctx.fill();
    }
    if (!noRing) {
      say.push($t('hue: the argument, red at 1, counterclockwise'));
      ctx.strokeStyle = TH.lineStrong; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r0, 0, TAU); ctx.stroke();
      // labels outside the ring, "−1" right-aligned so it ends 3px from the ring and starts inside the chip
      ctx.font = `italic 500 11px ${TH.math}`; ctx.fillStyle = TH.ink2;
      ctx.textAlign = 'left'; ctx.fillText('1', cx + R + 3, cy);
      ctx.textAlign = 'right'; ctx.fillText('−1', cx - R - 3, cy);
      ctx.textAlign = 'center'; ctx.fillText('i', cx, cy - R - 6); ctx.fillText('−i', cx, cy + R + 7);
    }
    const n = S.sectors || 12;
    // one right-aligned run: words in the UI face, the variables (F, F′, w) in STIX italic as on the ring
    // (H with a subscript t, the deformation's map: H in STIX italic, t a smaller italic below the baseline)
    // (the caption drawn is kept in st.caption: tests)
    const caption = (t) => {
      st.caption = t; say.unshift(t);
      const parts = t.split(/(Hₜ|F′|F|(?<![A-Za-z])[wf](?![A-Za-z]))/).filter(Boolean).flatMap((p) => (p === 'Hₜ' ? [['H', `italic 500 12px ${TH.math}`, 0], ['t', `italic 500 9px ${TH.math}`, 3]] : [[p, /^(F′?|w|f)$/.test(p) ? `italic 500 12px ${TH.math}` : `600 10.5px ${TH.ui}`, 0]]));
      // (right-aligned under the wheel; the one-line key, with no wheel, is centred)
      let x = cauchyOff ? LEG.W / 2 : LEG.W - 8;
      for (const [p, f] of parts) { ctx.font = f; x -= ctx.measureText(p).width * (cauchyOff ? 0.5 : 1); }
      ctx.fillStyle = TH.ink2; ctx.textAlign = 'left';
      for (const [p, f, dy] of parts) { ctx.font = f; ctx.fillText(p, x, (cauchyOff ? Hh / 2 : 62) + dy); x += ctx.measureText(p).width; }
    };
    // (the steps view on every plane but the colour plane's own: the wheel is the colour plane's, carried by the points)
    if (kind === 'color' && svCarriedKey()) {
      // (longer than the room under the wheel, so it stands in lines to the right of it, the plane's variable in STIX italic)
      const KEY_X = 78;      // left edge of the lines: just right of the wheel and its −i label
      const KEY_PAD = 8;     // room kept at the legend's right edge
      const KEY_TOP = 22;    // baseline of the first line
      const KEY_STEP = 13;   // line step (10.5 px text)
      const maxW = LEG.W - KEY_PAD - KEY_X, words = $tx('key line', 'colour carried from {p}', { p: svCarriedFrom() }).split(' '), lines = [];
      const ui = `600 10.5px ${TH.ui}`;
      let cur = '';
      for (const w of words) { const nx = cur ? `${cur} ${w}` : w; ctx.font = ui; if (cur && ctx.measureText(nx).width > maxW) { lines.push(cur); cur = w; } else cur = nx; }
      if (cur) lines.push(cur);
      st.caption = words.join(' '); say.unshift(st.caption);
      ctx.fillStyle = TH.ink2; ctx.textAlign = 'left';
      lines.forEach((ln, i) => {
        let x = KEY_X;
        for (const p of ln.split(/((?<![A-Za-z])w(?![A-Za-z]))/).filter(Boolean)) { ctx.font = p === 'w' ? `italic 500 12px ${TH.math}` : ui; ctx.fillText(p, x, KEY_TOP + i * KEY_STEP, maxW); x += Math.min(maxW, ctx.measureText(p).width); }
      });
      return;
    }
    // the Phase style has no modulus bands: no strip
    const Fl = SV.on ? svKeyName() : S.focus === 0 ? 'F' : focusDeriv() ? 'w' : 'f';
    // the landscape paints Tiles unless the style is Plain (P10)
    const plainL = S.dc === 'phase';
    if (kind !== '3d' && plainL) { caption(keyCaption(true, Fl)); return; }
    // (the steps view's Cauchy style with no picture on this plane: the reason, no bands that are not drawn)
    if (SV.on && kind === 'color' && S.dc === 'cauchy' && svCauchyWhy(cauchyPlot())) { st.strip = false; caption(cauchyOff ? $t('Cauchy: on z only') : $t('No curve selected')); return; }
    // modulus strip
    st.strip = !(kind === 'color' && S.dc === 'classic');
    if (kind === 'color' && S.dc === 'classic') {
      const g = ctx.createLinearGradient(sx, 0, sx + sw, 0);
      g.addColorStop(0, '#000000'); g.addColorStop(0.5, '#8a8f93'); g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = TH.muted; ctx.font = `10px ${TH.mono}`; ctx.textAlign = 'left';
      ctx.fillText('0', sx, sy + 18); ctx.textAlign = 'right'; ctx.fillText('∞', sx + sw, sy + 18);
      say.push($t('brightness: black at 0, white at ∞'));
      ctx.strokeStyle = TH.ink; ctx.beginPath(); ctx.moveTo(sx + sw / 2, sy - 2); ctx.lineTo(sx + sw / 2, sy + sh + 2); ctx.stroke();
    } else {
      for (let b = 0; b < 3; b++) {
        const g = ctx.createLinearGradient(sx + b * sw / 3, 0, sx + (b + 1) * sw / 3, 0);
        g.addColorStop(0, keyStops(TH.dark)[0]); g.addColorStop(1, keyStops(TH.dark)[1]);
        ctx.fillStyle = g; ctx.fillRect(sx + b * sw / 3, sy, sw / 3, sh);
      }
      ctx.strokeStyle = TH.lineStrong; ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      // words in the UI face, the factor in the mono face (spec 3)
      ctx.fillStyle = TH.muted; ctx.textAlign = 'left';
      // a Russian word («линии уровня», «на полосу») is narrowed to the chip's edge; English draws unchanged
      const word = (t, y) => { ctx.font = `11px ${TH.ui}`; if (I18N.lang === 'en') ctx.fillText(t, sx, y); else ctx.fillText(t, sx, y, LEG.W - sx - 4); };
      const num = (t, y) => { ctx.font = `10px ${TH.mono}`; ctx.fillText(t, sx, y); };
      if (kind === '3d') { const f = I18N.num('×1.69'); word($t('contours'), sy - 9); num(f, sy + 19); say.push($t('contours') + ' ' + f); }
      else { num(keyFactor(n), sy - 9); word($t('per band'), sy + 19); say.push(keyFactor(n) + ' ' + $t('per band')); }
    }
    // (the steps view's Height key names what the height reads on the shown plane, svHeightName)
    const Fn = SV.on ? (kind === '3d' ? svHeightName('text') : svKeyName()) : S.focus === 0 ? 'F' : focusDeriv() ? 'w' : 'f';
    if (SV.on && kind === 'color' && S.dc === 'cauchy') { caption($t('Cauchy integral')); return; }
    caption(kind === '3d' ? ({ abs: $t('height |{Fn}|', { Fn }), re: $t('height Re {Fn}', { Fn }), im: $t('height Im {Fn}', { Fn }) }[S.height] || $t('height log |{Fn}|', { Fn })) : keyCaption(false, Fn));
  }
  // ‹ › on a phone's chain row: Y glides from the plane after one step to the next or the one before
  // (HomRange.glider: a press never waits for the last one, quick presses go faster, a press the other way turns round
  // with no jump); the frame loop moves it (frame(), 08). Y is a plane of X → Y: in Phase, Landscape or with Y a sphere
  // it isn't shown, and ‹ › do nothing.
  function glideStep(d) {
    if (S.focus > 0 && morphRange().steps.length) { setFocus(0); toast($t('Show alone ended: ‹ › go through the whole chain.')); }
    const L = S.view.main === 'xy' && rImage() && peekSteps();
    if (L) {
      if (!trans.glide) { trans.glide = true; trans.k = 0; trans.at = -1; glide.set(L.length); }
      glide.nudge(d, L.length);
      glide.last = 0;
      // (reduced motion: the plane at once)
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) glide.set(glide.target);
      // (Y's view follows the plane the glide is heading for, each fitted on its own: in the inset a view that held every
      // plane left the first of them a speck off the centre)
      if (rightAuto && rImage()) {
        const j = Math.round(glide.target), at = j === 0 ? L[0] - 1 : L[j - 1];
        tweenView(V.right, fittedView(paneR, at, []));
      }
      requestRender('R');
      phoneChain();
    }
  }
  // what the phone's chain row shows: the plane Y's glide is at (its target while it moves), as the step whose plane
  // it is: T = j is the plane after the range's j-th step, T = 0 its start (z, or a bracket's start), all at once's end
  // F. With no glide, Y is at the end: F, the plane after the last step.
  function chainState() {
    const n = nSteps(), open = trans.glide, m = open ? morphLen() : 0;
    const T = !open ? m : glide.moving() ? glide.target : glide.x, j = Math.round(T);
    let k = n, html = '', name = '';
    // (a step shown alone, X and Y its input and output: the chip names it, marked alone; ‹ › go back to the whole chain)
    const alone = !open && S.focus > 0;
    if (alone) k = S.focus;
    else if (open && allAtOnce()) k = j ? -1 : 0;
    else if (open) k = j ? morphRange().steps[j - 1] : 0;
    if (k === -1 || (k === n && !n)) { html = '<i>F</i>'; name = $t('The whole map'); }
    else if (k === 0) {
      const rp = open ? rangeParts() : null;
      html = rp ? rangeStart('html') : '<i>z</i>'; name = rp ? '' : $t('Shapes');
    } else {
      const st = S.steps[k - 1];
      html = isDeriv(k) ? 'd/dz' : fsub(k); name = st ? cardName(st, defOf(st)) : '';
    }
    return { n, open, k, html, name, alone, prev: n > 0 && (!open || T > 1e-6), next: open && T < m - 1e-6, key: [n, open, k, j, alone, chainSig[n]].join('|') };
  }
  // (the phone's chain row follows T, the chain and the deformation; Phone.chain redraws only what changed)
  const phoneChain = () => { if (Phone.isOn() && Phone.chain) Phone.chain(); };

  // the faces arriving late: the right title and the labels again
  function setupLateFonts() {
    // fonts may arrive late; redraw labels
    onFontsSettled(() => { fitRightTitle(true); requestRender('L', 'R'); });
  }
