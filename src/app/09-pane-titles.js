  // ---------------- pane titles & option strips ----------------
  // the right plane says what it shows beside its mode control (icon-only below 520px): the whole title when it
  // fits the free head, the math part alone when the role text would be cut short, nothing when even that does not fit
  // Each pane says what it shows after its view control (icon-only below 520px): the whole title when it fits the
  // free head, the math part alone when the role text would be cut short, nothing when even that does not fit (U4: the
  // control comes first, so it never moves when the title changes with the focus)
  function fitTitle(side, noNote, noDisp, noEmpty) {
    const t = $(side === 'L' ? 'leftTitle' : 'rightTitle'), pane = $(side === 'L' ? 'paneL' : 'paneR'), grow = t && t.nextElementSibling;
    if (!t || !grow) return;
    t.classList.remove('terse', 'short', 'notag'); pane.classList.remove('tiny');
    // ([v17 D4; #247] the head's pattern button shows its caret unless the title needs that room: then its swatch alone,
    // e.g. Y's head at 1366 px with the chain empty and Add function there)
    const disp = pane.querySelector('.pane-head .pat-btn');
    if (disp && !noDisp) disp.classList.remove('tight');
    // (and Y's Add function button, in the head while the chain is empty, shrinks to its plus after the Display button)
    const emp = side === 'R' ? $('emptyRight') : null;
    if (emp && !noEmpty) emp.classList.remove('tight');
    // (v16.5 UX20: Y's one-time note in the head gives way before the title itself does; never cut)
    const note = side === 'R' ? $('rightNote') : null;
    if (note) note.classList.toggle('nofit', !!noNote);
    const tabs = $(side === 'L' ? 'leftTabs' : 'rightTabs');
    // (a view control squeezed by the title, if any, takes its room back first)
    const room = grow.offsetWidth + t.offsetWidth - (tabs ? Math.max(0, tabs.scrollWidth - tabs.clientWidth) : 0);
    if (!(pane.offsetWidth > 0)) return;   // not laid out (hidden plane): measured again on the next resize
    const pt = t.querySelector('.ptitle'), pr = t.querySelector('.prole');
    let ptw = pt ? pt.scrollWidth : 0;
    if (pt && ptw > room) {
      if (note && !note.hidden && !noNote) { fitTitle(side, true); return; }
      // (wave 1 merge) then the plane's "Y · " tag (UX27) gives way, before the title itself: with the chain empty, Y's
      // head also holds Add function (UX20), and at 1366 px the tagged title no longer fitted, so it vanished
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
  // (#247: a title that changed width changes the room for the head's controls: they are laid out again first)
  function fitRightTitle() { if (paneR) layoutFoot(); fitTitle('L'); fitTitle('R'); }
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
    // (the deformation paints H_t: the title names it, merged-views review)
    const def = '';
    const of = morphOn() && lPaintsF() ? '<i>H</i><sub><i>t</i></sub>' : S.focus === 0 ? '<i>F</i>' : dk ? `${Fh}(<i>z</i>)` : Fh;
    let roleL, shortL;
    if (lLand()) { const shw = sheetsShown(); roleL = $t('landscape of {h}{sheets}', { h: heightHtml(of), sheets: shw ? sheetsClause(shw, 'html') : deformOneSheet() ? $t('; one sheet is drawn while it deforms') : '' }); shortL = $tx('role', 'landscape'); }
    else if (lColor() && S.dc === 'cauchy' && !morphOn()) { const cp = typeof cauchyPlot === 'function' ? cauchyPlot() : null; roleL = cp ? $t('Cauchy integral over {name}', { name: cp.name }) : $t('Cauchy integral'); shortL = cp ? $t('Cauchy integral') : ''; }
    else if (lPhase()) { roleL = $t('phase of {ofV}', { ofV: of }); shortL = $tx('role', 'phase'); }
    else { roleL = $t('domain of {ofV}', { ofV: of }); shortL = $tx('role', 'domain'); }
    // ([v16.5 UX27] one name per plane everywhere: "X · z-plane, domain of F", "Y · w = F(z), image")
    const XT = '<span class="ptag"><i>X</i> · </span>', YT = '<span class="ptag"><i>Y</i> · </span>';
    const left = T(XT + xName, roleL + def, def ? undefined : shortL);
    let right;
    // (the deformation keeps Y's surface: the arrow form on the plane, the w-sphere's own title on the globe)
    // (one title for the merged plane and the merged globe)
    // (v16.5 UX103: in words, "Deformation from z to w", where it read "z → w deformation"; UX27: the other right titles
    // carry the "Y · " tag)
    if (morphOn()) { const [fa, fb] = S.focus === 0 && rangeParts() ? [rangeStart('html'), '<i>w</i>'] : S.focus === 0 || dk ? [wHtml(0), S.focus === 0 ? '<i>w</i>' : wHtml(rk)] : [wHtml(lk), wHtml(rk)]; right = T((S.focus === 0 && bracketWords('html')) || $t('Deformation'), $t('from {a} to {b}', { a: fa, b: fb }), ''); }
    else if (rGlobe()) right = T(YT + $t('{w}-sphere', { w: S.focus === 0 ? '<i>w</i>' : wHtml(rk) }), $tx('role', 'image'), '');
    else if (S.focus === 0) right = T(YT + (n ? '<i>w</i> = <i>F</i>(<i>z</i>)' : '<i>w</i> = <i>z</i>'), $tn('image, after {n} step', 'image, after {n} steps', n), $tx('role', 'image'));
    else if (dk) right = T(YT + `${wHtml(rk)} = d${wHtml(rk - 1)}/d<i>z</i>`, $tx('role', 'image'), '');
    else right = T(YT + `${wHtml(rk)} = <i>f</i>${sub(S.focus)}(${wHtml(lk)})`, $tx('role', 'image'), '');
    return { left, right };
  }
  // (v16) where a bracket's deformation starts, H_0 = Q applied to w_{a-1} (w_0 = z): 'html', 'text' (Unicode subscripts,
  // the phone's title chip and the menu's key slot) or 'tex'. One post step f3(w1), two (f4 o f3)(w1), three or more
  // (f6 o ... o f4)(w1); the bypassed steps are left out. No words: the same in English and Russian
  // (review v16 user-2) Unicode subscript digits as <sub> digits: the menu's key slot and the phone row in the label's face
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
  function updateFocusUI() {
    const t = paneTitles();
    // (v16: the phone's title chip of the merged plane reads data-mtitle, SPEC 5.1)
    const mt = `${S.focus === 0 && rangeParts() ? rangeStart('text') : 'z'} \u2192 w`;
    if (document.documentElement.dataset.mtitle !== mt) { document.documentElement.dataset.mtitle = mt; for (const id of ['leftReadout', 'rightReadout']) { const el = $(id); if (el) el.dataset.mtitle = mt; } }
    syncStyleBtn();
    if ($('leftTitle').innerHTML !== t.left) $('leftTitle').innerHTML = t.left;
    if ($('rightTitle').innerHTML !== t.right) $('rightTitle').innerHTML = t.right;
    syncAloneChip();
    syncModeChips();
    $('paneL').classList.toggle('no-rulers', !lFlat());
    // (the last active step turned off or removed ends the deformation, and with it the merge)
    if (morph.open && !morphRange().steps.length) { closeTransport(); return; }
    if (Views.merged(S.view, morphOn()) !== layoutMg) applyLayout();
    syncViewControls();
    fitRightTitle();
    $('paneR').classList.toggle('no-rulers', !rImage());
    $('rightFit').hidden = !rImage();
    $('leftFit').hidden = false;
    buildRightFoot();
    for (const c of document.querySelectorAll('.card')) c.classList.toggle('focus', +c.dataset.k === S.focus);
    syncSel();
    $('viewAllBtn').setAttribute('aria-pressed', String(S.focus === 0));
    if (setupFormula.refresh) setupFormula.refresh();
    syncSnapUnit();
    updateToolHint();
    updateLeds();
    drawLegend();
    updateBracket();   // (v16: the deformation's bracket shows with the transport on the whole chain)
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
      if (sel) on = b;
    }
    if (on) {
      segPending.set(el, on);
      if (!segRaf) segRaf = requestAnimationFrame(placeSegs);
    }
  }
  function seg(id, value, options, onchange, label) {
    const el = h('div', { class: 'seg small', id, role: 'radiogroup', 'aria-label': label });
    for (const [v, l, title] of options) {
      el.append(h('button', { 'data-v': v, role: 'radio', title: title || null, onclick: () => { setSeg(el, v); onchange(v); } }, l));
    }
    requestAnimationFrame(() => setSeg(el, value));
    setSeg(el, value);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const bs = [...el.children], i = bs.findIndex((b) => b.classList.contains('on'));
      const j = Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
      bs[j].click(); bs[j].focus(); e.preventDefault();
    });
    return el;
  }
  function selectEl(id, value, options, onchange, title) {
    const sel = h('select', { class: 'sel', id, title, 'aria-label': title, onchange: (e) => onchange(e.target.value) }, ...options.map(([v, l]) => h('option', { value: v }, l)));
    sel.value = value;
    return sel;
  }
  // (#247: with an icon, a check that the pane head shows as an icon toggle, its word the tooltip and its accessible name;
  // a phone's sheet and the ⋯ pop-up show the word)
  function checkEl(id, checked, label, onchange, icon) {
    const inp = h('input', { type: 'checkbox', id, onchange: (e) => onchange(e.target.checked) });
    inp.checked = !!checked;
    if (!icon) return h('label', { class: 'check' }, inp, h('span', null, label));
    return h('label', { class: 'check ic-tg', 'data-tip': label }, inp, h('span', { class: 'tg-ic', 'aria-hidden': 'true', html: icon }), h('span', { class: 'tg-l' }, label));
  }
  const DC_STYLES = [['enhanced', $t('Tiles'), $t('Conformal tiles: phase sectors and modulus contours form squares')], ['phase', $t('Plain'), $t('Phase only')], ['classic', $t('Modulus'), $t('Brightness from |F|: zeros black, poles white')], ['modulus', $t('Contours'), $t('Level lines of |F| and arg F')], ['grid', $t('Pulled-back grid'), $t('Pull-back of the Re/Im grid of the image')], ['cauchy', $t('Cauchy'), $t('The Cauchy integral over the selected closed curve: F inside, 0 outside')]];
  // (#247) the Phase style as one row: each style its glyph (STYLE_SVG), the chosen one its word too (the pane head), or
  // every word under its glyph (a phone's sheet, the ⋯ pop-up); one click picks. "Pulled-back grid" is "Grid" here, its
  // whole name the tooltip, the accessible name and the header menu's item
  function styleSeg() {
    const el = seg('dcSeg', S.dc, DC_STYLES.map(([v, name, tip]) => [v, [h('span', { class: 'sty-g', 'aria-hidden': 'true', html: STYLE_SVG[v] }), h('span', { class: 'sty-n' }, v === 'grid' ? $t('Grid') : name)], tip]), (v) => pickPhaseStyle(v), $t('Phase style'));
    el.classList.add('sty-seg');
    for (const b of /** @type {HTMLElement[]} */ ([...el.children])) {
      const d = DC_STYLES.find((p) => p[0] === b.dataset.v);
      b.setAttribute('aria-label', d[1]);
      b.removeAttribute('title');
      b.dataset.tip = d[1] === d[2] ? d[1] : `${d[1]}: ${d[2]}`;
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
    // (v16.5 UX17: on a touch screen a tap places, and two fingers turn)
    const tch = touchUI();
    const g = tool === 'point' ? (tch ? $t('Tap to place a {tg}point', { tg }) : $t('Click to place a {tg}point', { tg })) : tool === 'polygon' ? (tch ? $t('Tap the vertices') : $t('Click the vertices'))
      : tool === 'curve' ? $t('Hold and draw a {tg}curve', { tg }) : tool === 'lasso' ? $t('Hold and draw a {tg}region', { tg })
        : tg ? $t('Drag to draw a target {tool}', { tool: lab }) : /^[aeiou]/.test(lab) ? $t('Drag to draw an {tool}', { tool: lab }) : $t('Drag to draw a {tool}', { tool: lab });
    return tch ? $t('{g}; two fingers turn', { g }) : $t('{g}; Space or the middle button turns', { g });
  }
  // the idle left readout: the scale, or how to draw on or turn the globe, or orbit the landscape (which takes no
  // drawing, panels.md 9.1)
  const touchUI = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  // (v16.1 review user-7) a phone has no pane title: in Landscape with All sheets its title chip says which sheets are
  // drawn, as the title does ("Im H_t, on both sheets of F"), in place of the orbit hint
  const landSheetsHint = () => {
    if (!document.documentElement.classList.contains('ph')) return '';
    const shw = sheetsShown();
    if (!shw) return '';
    const of = morphOn() && lPaintsF() ? '<i>H</i><sub><i>t</i></sub>' : S.focus === 0 ? '<i>F</i>' : focusDeriv() ? `${fnHtml()}(<i>z</i>)` : fnHtml();
    return heightHtml(of) + sheetsClause(shw, 'html');
  };
  // [v16.5 UX10] on a phone the scale chip teaches the hold-and-slide that reads z and F(z), until it is first used
  let probeLearnedV = null;
  const probeLearned = () => { if (probeLearnedV == null) { try { probeLearnedV = localStorage.getItem('cmw-probe-learned') === '1'; } catch (e) { probeLearnedV = false; } } return probeLearnedV; };
  // ([v16.5 fix regress-4] once a session, for 8 s from the first idle readout of a phone, never a standing part of the
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
    return probeTeachUntil > now ? `<span class="rhint rteach">${$t('Hold and slide to read F(z)')}</span>` : '';
  };
  const idleLeft = () => (lGlobe() ? `<span class="rhint">${globeHint('L')}</span>`
    : lLand() ? `<span class="rhint">${tool !== 'select' && tool !== 'formula' ? $t('Draw in X → Y (1)') : landSheetsHint() || (touchUI() ? $t('Drag to orbit, pinch to zoom') : $t('Drag to orbit, Shift-drag to pan'))}</span>` : rk('', paneL ? scaleText(paneL) : '') + probeTeach());
  // the idle right readout: the scale, a drawing hint, or how to draw on or turn the w-globe (a short hint in Archivo)
  function idleRight() {
    // (the deformation's globe with under 3 paths, X mostly on its far side: the hint says why; verify fix path-8)
    const v = rGlobe() ? { hint: mfGlobeAway() ? $t('Paths: X is on the far side; drag to turn') : globeHint('R') }
      : document.documentElement.classList.contains('ph') && hasTargets() && targetText() ? { hint: targetText({ phone: true }) }
        : targetsEditable() && tool !== 'select' && tool !== 'formula' ? { hint: $t('Draw a target in Y (the {x}-plane)', { x: yHtml() }) } : scaleText(paneR);
    return v && v.hint ? `<span class="rhint">${v.hint}</span>` : rk('', v);
  }
  function scaleText(pane) { return pane ? $t('{x} / div', { x: I18N.num(CX.fmtNum(Axes.niceStep(110 / pane.view.s), 4).replace('-', '−')) }) : ''; }
  // Mode options (spec 5.8): one 32px row. Controls that do not fit beside the view stack move, in order, behind
  // a sliders button into a popover; on a phone all of them do. The deformation transport always stays inline.
  const phoneMQ = matchMedia('(max-width: 767px)');
  // one options strip per pane (U-b, panels.md 4): foot.L in X, foot.R in Y
  const footOf = () => ({ kids: [], widths: null, n: -1, w: -1, phone: null, pop: null });
  const foot = { L: footOf(), R: footOf() };
  phoneMQ.addEventListener('change', () => { if (S && paneR) layoutFoot(true); });
  function layoutFoot(force) { layoutFootSide('L', force); layoutFootSide('R', force); }
  // (#247) on a desktop the unit circle's check (page.html's #unitBox) sits in one pane head: Y's in the X → Y view, else
  // X's; a phone's Display sheet lends it itself
  const unitSide = () => (S.view.main === 'xy' ? 'R' : 'L');
  // (a strip rebuilt or laid out again lets go of it first: replaceChildren would leave it out of the page)
  function unitHome(f) {
    const u = $('unitBox'), home = $('regionsHome');
    if (u && home && f && f.contains(u)) home.append(u);
  }
  function unitKid(side) {
    const u = $('unitBox');
    if (!u || side !== unitSide()) return null;
    // (its icon and toggle look, once: the word stays its name and the tooltip's)
    const l = u.querySelector('label.check');
    if (l && !l.classList.contains('ic-tg')) {
      l.classList.add('ic-tg'); l.setAttribute('data-tip', $t('Unit circle'));
      const w = l.querySelector(':scope > span'); if (w) w.classList.add('tg-l');
      l.insertBefore(h('span', { class: 'tg-ic', 'aria-hidden': 'true', html: ICONS.unit }), w);
    }
    return u;
  }
  function layoutFootSide(side, force) {
    const f = $(side === 'L' ? 'leftFoot' : 'rightFoot'), ft = foot[side], pane = side === 'L' ? paneL : paneR;
    const phone = phoneMQ.matches;
    // (v16.5 UX20: on a desktop the strip sits in the pane head, placeKeys, so no bar lies over the plot. [#247] There its
    // controls are inline, compact (icon toggles, the style's glyphs), as many as the head has room for beside a title
    // kept readable; the rest go behind a ⋯ button. In the X → Y view the head also has the shapes' pattern button)
    const inHead = !!(f && f.parentElement && f.parentElement.classList.contains('pane-head'));
    if (!f || !pane || (!ft.kids.length && !inHead)) return;
    if (inHead && f.hidden) f.hidden = false;
    // (in the head a note, Cauchy's sentence, comes last and always behind ⋯: the head holds controls, never a cut sentence)
    const unit = inHead ? unitKid(side) : null, isNote = (e) => e.classList.contains('foot-note');
    const kids = inHead ? [...ft.kids.filter((e) => !isNote(e)), ...(unit ? [unit] : []), ...ft.kids.filter(isNote)] : ft.kids;
    ft.order = kids;
    if (!unit) unitHome(f);   // (not this strip's any more, e.g. the view changed: home, before replaceChildren drops it)
    // (in the head: its width and the title's whole width, which the room for the controls depends on, are part of the key)
    let headW = 0, titleW = 0;
    if (inHead) {
      const t = $(side === 'L' ? 'leftTitle' : 'rightTitle'), pt = t && t.querySelector('.ptitle');
      if (t) { t.classList.remove('terse', 'short', 'notag'); f.parentElement.parentElement.classList.remove('tiny'); }   // (fitTitle fits it after)
      headW = f.parentElement.clientWidth; titleW = pt ? pt.scrollWidth : 0;
    }
    if (!force && ft.w === pane.w && ft.phone === phone && ft.head === inHead && ft.headW === headW && ft.titleW === titleW && ft.nk === kids.length) { if (inHead) fitTitle(side); return; }
    ft.head = inHead; ft.headW = headW; ft.titleW = titleW;
    if (ft.nk !== kids.length) ft.widths = null;
    ft.nk = kids.length;
    const pat = inHead && S.view.main === 'xy' ? patternBtn(side) : null;
    let n = kids.length;
    if (phone) n = 0;
    else {
      if (!ft.widths) {
        // natural widths, measured once per build with every control inline on one row
        if (f.childElementCount !== kids.length || [...f.children].some((c, i) => c !== kids[i])) f.replaceChildren(...kids);
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
        avail = room - Math.min(180, titleW + 12) - (pat ? 34 + gap : 0) - 4;
      } else avail = pane.w - 60;
      let used = pad;
      for (n = 0; n < kids.length; n++) {
        if (inHead && isNote(kids[n])) break;
        const next = used + (n ? gap : 0) + ft.widths[n];
        const more = n + 1 < kids.length ? btn : 0;
        if (next + more > avail) break;
        used = next;
      }
    }
    ft.w = pane.w; ft.phone = phone;
    if (n === ft.n && !force) return;
    ft.n = n;
    const rest = kids.slice(n);
    let b = null;
    if (rest.length) {
      // (the controls that do not fit: in the pane head a ⋯ button, under the plot the sliders)
      b = h('button', { class: 'icon-btn opts-btn', 'data-tip': $t('Display options'), 'aria-label': $t('Display options'), 'aria-haspopup': 'dialog', 'aria-expanded': 'false', html: inHead ? ICONS.more : ICONS.sliders });
      b.addEventListener('click', () => openFootPop(b, false, side));
    }
    const open = ft.pop && ft.pop.isConnected && ft.pop.dataset.of !== 'pattern';
    if (unit && rest.includes(unit)) unitHome(f);
    f.replaceChildren(...(pat ? [pat] : []), ...kids.slice(0, n), ...(b ? [b] : []));
    f.classList.toggle('collapsed', !n);
    if (inHead) fitTitle(side);   // (the head's room changed with the controls: the title is fitted again)
    if (open) { if (b) openFootPop(b, true, side); else closePalette(); }
  }
  // ([v17 D5, #82; #247] in the X → Y view the shapes' pattern, a swatch in the pane head: its pop-up holds the regions'
  // display, page.html's #regionsBox (pattern, cell, grid lines, chevrons, opacity), lent while it is open)
  function patternBtn(side) {
    const p = PATTERNS.find((x) => x[0] === S.pattern) || PATTERNS[0], name = $t('Pattern: {name}', { name: p[1] });
    const b = h('button', { class: 'btn opts-btn pat-btn', 'data-tip': name, 'aria-label': name, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' },
      h('canvas', { class: 'disp-sw', width: 52, height: 40, 'aria-hidden': 'true' }), h('span', { class: 'disp-caret', 'aria-hidden': 'true', html: ICONS.chevD }));
    drawPatternSwatch(b.firstChild, S.pattern);
    b.addEventListener('click', () => openFootPop(b, false, side, true));
    return b;
  }
  function openFootPop(btn, refresh, side = 'R', regionsOnly = false) {
    const ft = foot[side], of = regionsOnly ? 'pattern' : 'opts';
    if (!refresh && ft.pop && ft.pop.isConnected && ft.pop.dataset.of === of) { closePalette(); btn.focus(); return; } // anchor re-click closes
    closePalette();
    // (#247: the ⋯ pop-up holds the head's controls that did not fit, with no title; the pattern button's, the regions'
    // display alone. Both are lent and go back when the pop-up closes)
    const head = !!btn.closest('.pane-head'), home = $('regionsHome');
    const unit = $('unitBox'), rest = regionsOnly ? [] : (head && ft.order ? ft.order : ft.kids).slice(ft.n);
    const regions = regionsOnly ? $('regionsBox') : null;
    const kids = regionsOnly ? (regions ? [regions] : []) : rest;
    const pop = h('div', { class: 'pop opts-pop' + (head ? ' disp-pop' : '') + (regionsOnly ? ' pat-pop' : ''), role: 'dialog', 'aria-label': regionsOnly ? btn.getAttribute('aria-label') : $t('Display options'), 'data-of': of }, ...kids);
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
    // (v16.5 UX20: from the pane head, the popover hangs under the button, its right edge on the button's)
    const fromHead = !!btn.closest('.pane-head');
    const x0 = fromHead ? r.right - pw : (btn.closest('.options') || btn).getBoundingClientRect().left; // above the strip, clear of the view stack
    let y = fromHead ? -1 : r.top - ph - 6;
    if (y < 12) y = Math.max(12, Math.min(window.innerHeight - ph - 12, r.bottom + 6));
    pop.dataset.side = y < r.top ? 'top' : 'bottom';
    pop.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, x0)) + 'px';
    pop.style.top = y + 'px';
    const mo = new MutationObserver(() => { if (!pop.isConnected) { btn.setAttribute('aria-expanded', 'false'); mo.disconnect(); } });
    mo.observe($('popHost'), { childList: true });
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePalette(); btn.focus(); } });
    if (!refresh) { const first = pop.querySelector('button, input, select'); if (first) first.focus({ preventScroll: true }); }
    armOutside(btn);
  }
  // the focused map has a multivalued step the Landscape can show all sheets of (GLR.sheetInfo): {infinite} or null
  // (v16.1 review math-6) D: how many of the K surfaces are distinct sheets, from F's values on every surface at a few
  // generic points (two surfaces agreeing to 1e-9 at all of them are one sheet): √ then z² is F = z, single-valued, so
  // its two surfaces are one sheet and All sheets has nothing more to draw (null: the principal branch, no clause)
  let sheetsD = { key: '', D: 0 };
  function multiSheet() {
    if (!GLR.ok || typeof GLR.sheetInfo !== 'function') return null;
    let ms = null;
    try { ms = GLR.sheetInfo(endMap(), S.sheetW || 2) || null; } catch (e) { ms = null; }
    if (!ms) return null;
    const m = endMap(), key = `${chainSig[nSteps()]}|${S.focus}|${ms.W}|${ms.K}`;
    if (sheetsD.key !== key) {
      const pts = [C(0.731, 0.412), C(-1.287, 0.903), C(-0.618, -1.733), C(1.911, -0.794), C(0.307, 2.268)], reps = [];
      const same = (u, v) => (!u || !v ? u === v : !(Number.isFinite(u.re) && Number.isFinite(u.im) && Number.isFinite(v.re) && Number.isFinite(v.im)) ? !(Number.isFinite(u.re) && Number.isFinite(u.im)) && !(Number.isFinite(v.re) && Number.isFinite(v.im)) : CX.abs(CX.sub(u, v)) <= 1e-9 * (1 + CX.abs(u)));
      for (let c = 0; c < ms.K; c++) {
        const v = pts.map((z) => { try { return Funcs.sheetEval(S.steps, built, m.b, z, z, c, ms.W, { a: m.a || 0 }); } catch (e) { return null; } });
        if (!reps.some((r) => r.every((w, i) => same(w, v[i])))) reps.push(v);
      }
      sheetsD = { key, D: reps.length };
    }
    return sheetsD.D > 1 ? Object.assign({}, ms, { D: sheetsD.D }) : null;
  }
  // All sheets is ticked but the deformation that shows has no sheet form: the landscape draws one sheet (issue #51: the
  // check and the title say so)
  function deformOneSheet() { return !!S.sheets && morphOn() && !deformSheetsOk(); }
  // All sheets while the deformation shows (notes/v16-user5/SHEETS-DESIGN.md): H_t is drawn on the sheets that become
  // F's (GLChain chainSheetHom), unless a step the deformation applies has no sheet form: a d/dz, or a deformed formula
  // with branch points that is not recognised as catalog steps (Funcs.sheetMapPieces null). The test takes every step
  // the deformation applies at some t (all at once from the source stage), so it does not change with t.
  function deformSheetsOk() {
    if (!morphOn() || typeof Funcs.sheetMapPieces !== 'function') return false;
    const R = morphRange();
    try { return !!Funcs.sheetMapPieces(S.steps, built, { mode: 3, base: leftStage(), a: R.lo, b: R.b, post: R.p1, t: 0.5 }); } catch (e) { return false; }
  }
  // (v16.1 user-5) what the landscape draws with All sheets, as render3D does: null for the principal branch (All
  // sheets off, a deformation with no sheet form, or no multivalued step in the map in focus), else {K: the surfaces
  // drawn, total: the sheet combinations of the window, W, pieces: [{n, of}], hom} (one per multivalued piece of the
  // map in focus: n sheets all drawn, or n = 0 for the window k = -W, ..., W; of: the piece's own count, Infinity for
  // log). hom: the deformation shows, and H_t is drawn on the sheets that become these sheets of F (at most these:
  // a step not begun adds its sheets when it starts; notes/v16-user5/SHEETS-DESIGN.md)
  function sheetsShown() {
    if (!S.sheets || !lLand()) return null;
    const hom = morphOn();
    if (hom && !deformSheetsOk()) return null;
    const ms = multiSheet();
    if (!ms) return null;
    const m = endMap(), a = Math.max(0, m.a || 0), b = m.b || 0, pieces = [];
    try {
      for (const e of Funcs.sheetSteps(S.steps, built)) {
        if (e.k <= a || e.k > b) continue;
        const q = Funcs.stepSheets(built[e.k - 1])[e.node];
        // (v16.1 verify-5: kb, the step's own branch, on which its window is centred (Funcs' stepTh: a root's k mod n,
        // a log's or power's k; a formula's branch nodes 0), so the caption numbers the window as drawn)
        const bb = built[e.k - 1], v = bb && bb.def && bb.def.id !== 'custom' && bb.vals ? bb.vals : {}, kk = v.k | 0, rn = Math.max(2, v.n | 0);
        pieces.push({ n: e.n, of: q && q.of > 0 ? q.of : e.n > 0 ? e.n : Infinity, kb: bb && bb.def && bb.def.id === 'root' ? ((kk % rn) + rn) % rn : kk });
      }
    } catch (e) { return null; }
    // (v16.1 review math-2: while deforming, which deformed pieces are roots and powers, which logs: the clause gives
    // their paths on a sheet)
    let dk = null;
    if (hom) {
      // (v16.1 verify-1: turn, the deformed pieces run in turn, each in its own time s: steps one after another, or the
      // catalog steps of a recognised formula; else every piece deforms in the caption's own t)
      const R = morphRange();
      dk = { pow: false, log: false, turn: R.steps.length > 1 && !allAtOnce() };
      const kinds = (b) => (!b || b.error || !b.def ? [] : b.def.id === 'custom' && b.rec ? b.rec.built.flatMap(kinds) : b.def.id === 'log' ? ['log'] : b.def.id === 'root' || b.def.id === 'powa' ? (Funcs.stepSheets(b).some((q) => q.n !== 1) ? ['pow'] : []) : []);
      try {
        for (const e of Funcs.sheetMapPieces(S.steps, built, { mode: 3, base: leftStage(), a: R.lo, b: R.b, post: R.p1, t: 0.5 }) || []) {
          if (e.how !== 2) continue;
          const b = built[e.k - 1], q = kinds(b);
          for (const x of q) dk[x] = true;
          if (q.length && b && b.def && b.def.id === 'custom' && b.rec && b.rec.built.length > 1) dk.turn = true;
        }
      } catch (e) { /* no tail */ }
    }
    return pieces.length ? { K: ms.K, D: ms.D || ms.K, total: ms.total, W: ms.W, pieces, hom, dk } : null;
  }
  // the clause on what it draws, exact (the user, v16.1: "all sheets" is not true of infinitely many): a finite
  // covering says how many sheets (both, all 3), a window says which and of how many (the sheets k = -2, ..., 2 of
  // infinitely many), a capped one how many combinations (24 of the 30). fmt 'tex': {src, p, then} for $t or capT, with
  // p.k the window as TeX without dollars (the caller wraps it, and p.H, p.F while deforming), src null for the plural
  // string done (p.text), then: a second sentence {src, p} or null; 'html': the Landscape title's suffix (", both
  // sheets"). Finite counts are of distinct sheets (sh.D: √ then z⁴ draws 4 combinations that are 2 sheets).
  // While deforming (sh.hom; v16.1 review math-1, math-2): H_t is drawn on F's K surfaces, one for each of F's sheets
  // (or combinations), every multivalued step on its sheet with its branch number kept along its path; H_t's own
  // sheets are not counted (z^s has infinitely many for 0 < t < 1, and several of them end on each sheet of z^α), so
  // the title says "on the sheets of F" and the caption names the path on a sheet of each deformed root, power or log.
  function sheetsClause(sh, fmt, F) {
    const win = sh.pieces.some((q) => !(q.n > 0)), html = fmt === 'html', D = sh.D || sh.K, capped = sh.total > sh.K;
    // (v16.1 verify-5: the window as drawn, centred on the step's own branch kb when every window piece has the same)
    const kbs = [...new Set(sh.pieces.filter((q) => !(q.n > 0)).map((q) => q.kb || 0))], kb = kbs.length === 1 ? kbs[0] : 0;
    const k = html ? `<i>k</i> = ${I18N.num(kb - sh.W).replace('-', '−')}…${I18N.num(kb + sh.W).replace('-', '−')}` : `k=${kb - sh.W},\\dots,${kb + sh.W}`;
    const N = sh.pieces.reduce((x, q) => x * (Number.isFinite(q.of) ? q.of : Infinity), 1);
    if (html && sh.hom) {
      const Fh = fnHtml();
      if (capped) return win ? $t(', on {K} of the {total} sheet combinations of {F}, {k}', { K: sh.K, total: sh.total, F: Fh, k }) : $t(', on {K} of the {total} sheet combinations of {F}', { K: sh.K, total: sh.total, F: Fh });
      if (!win) return D === 2 ? $t(', on both sheets of {F}', { F: Fh }) : $tn(', on all {n} sheets of {F}', ', on all {n} sheets of {F}', D, { F: Fh });
      return sh.pieces.length === 1 ? $t(', on the sheets {k} of {F}', { k, F: Fh }) : $tn(', on {n} sheets of {F}, {k}', ', on {n} sheets of {F}, {k}', sh.K, { k, F: Fh });
    }
    if (html) {
      if (capped) return win ? $t(', {K} of {total} sheet combinations, {k}', { K: sh.K, total: sh.total, k }) : $t(', {K} of {total} sheet combinations', { K: sh.K, total: sh.total });
      if (!win) return D === 2 ? $t(', both sheets') : $tn(', all {n} sheets', ', all {n} sheets', D);
      return sh.pieces.length === 1 ? $t(', sheets {k}', { k }) : $tn(', {n} sheets, {k}', ', {n} sheets, {k}', sh.K, { k });
    }
    if (sh.hom) {
      const p = { H: 'H_t', F: F || 'F', n: sh.K };
      const dk = sh.dk || {};
      // the paths on a sheet (a second sentence): z^alpha along z^sigma e^{2 pi i k sigma}, log along (z^u e^{2 pi i k u} - 1)/u + u,
      // in the caption's t when every piece deforms in it, else in the time s of the piece's own step (v16.1 verify-1:
      // the steps in turn define step k's homotopy in its own s; sigma is the exponent, a letter not used elsewhere)
      const then = dk.turn
        ? (dk.pow && dk.log ? { src: ' Each deformed root or power $z^{\\alpha}$ runs along $z^{\\sigma}e^{2\\pi ik\\sigma}$, $\\sigma=1+(\\alpha-1)s$, and each deformed logarithm along $(z^{u}e^{2\\pi iku}-1)/u+u$, $u=1-s$, where $s$ ($0\\le s\\le 1$) is the time of the step it belongs to and $k$ is its branch number on that surface.', p: {} }
          : dk.pow ? { src: ' Each deformed root or power $z^{\\alpha}$ runs along $z^{\\sigma}e^{2\\pi ik\\sigma}$, $\\sigma=1+(\\alpha-1)s$, where $s$ ($0\\le s\\le 1$) is the time of the step it belongs to and $k$ is its branch number on that surface.', p: {} }
            : dk.log ? { src: ' Each deformed logarithm runs along $(z^{u}e^{2\\pi iku}-1)/u+u$, $u=1-s$, where $s$ ($0\\le s\\le 1$) is the time of the step it belongs to and $k$ is its branch number on that surface.', p: {} } : null)
        : dk.pow && dk.log ? { src: ' Each deformed root or power $z^{\\alpha}$ runs along $z^{\\sigma}e^{2\\pi ik\\sigma}$, $\\sigma=1+(\\alpha-1)t$, and each deformed logarithm along $(z^{u}e^{2\\pi iku}-1)/u+u$, $u=1-t$, where $k$ is its branch number on that surface.', p: {} }
          : dk.pow ? { src: ' Each deformed root or power $z^{\\alpha}$ runs along $z^{\\sigma}e^{2\\pi ik\\sigma}$, $\\sigma=1+(\\alpha-1)t$, where $k$ is its branch number on that surface.', p: {} }
            : dk.log ? { src: ' Each deformed logarithm runs along $(z^{u}e^{2\\pi iku}-1)/u+u$, $u=1-t$, where $k$ is its branch number on that surface.', p: {} } : null;
      if (capped) return win ? { src: '; %{H} is drawn on %{n} surfaces, one for each of %{K} of the %{total} sheet combinations of %{F} in the window %{k}.', p: Object.assign(p, { K: sh.K, total: sh.total, k }), then } : { src: '; %{H} is drawn on %{n} surfaces, one for each of %{K} of the %{total} sheet combinations of %{F}.', p: Object.assign(p, { K: sh.K, total: sh.total }), then };
      if (!win) return D === sh.K ? { src: '; %{H} is drawn on %{n} surfaces, one for each sheet of %{F}.', p, then } : { src: '; %{H} is drawn on %{n} surfaces, one for each of the %{n} sheet combinations of %{F}.', p, then };
      return sh.pieces.length === 1 ? { src: '; %{H} is drawn on %{n} surfaces, one for each of the sheets %{k} of %{F}.', p: Object.assign(p, { k }), then } : { src: '; %{H} is drawn on %{n} surfaces, one for each of %{n} sheets of %{F} (the window %{k}).', p: Object.assign(p, { k }), then };
    }
    if (capped) return win ? { src: '; %{K} of the %{total} sheet combinations in the window %{k} are shown.', p: { K: sh.K, total: sh.total, k } } : { src: '; %{K} of the %{total} sheet combinations are shown.', p: { K: sh.K, total: sh.total } };
    if (!win) return D === 2 ? { src: '; both sheets are shown.', p: {} } : { src: null, p: { text: $tn('; all {n} sheets are shown.', '; all {n} sheets are shown.', D) } };
    if (sh.pieces.length === 1) return Number.isFinite(N) ? { src: '; the sheets %{k} of %{N} are shown.', p: { k, N } } : { src: '; the sheets %{k} of infinitely many are shown.', p: { k } };
    return Number.isFinite(N) ? { src: '; %{n} of the %{N} sheets are shown (the window %{k}).', p: { n: sh.K, N, k } } : { src: '; %{n} of the infinitely many sheets are shown (the window %{k}).', p: { n: sh.K, k } };
  }
  // the TeX parameters of a clause: the window k and, while deforming, H and F are math (wrap: {m} for capT, $..$)
  const sheetsTexP = (p, wrap) => { const r = Object.assign({}, p); for (const q of ['k', 'H', 'F']) if (r[q] != null) r[q] = wrap(r[q]); return r; };
  // the All sheets check: with more sheet combinations than the landscape draws (GLR caps them), "24 of 30" (F's: while
  // deforming, at most those are drawn); while a deformation that has no sheet form shows, its tip says so
  function sheetsLabel(lab, ms) {
    const span = lab && lab.querySelector('span');
    if (!span) return lab;
    const capped = !!(S.sheets && ms && ms.total > ms.K);
    const one = deformOneSheet();
    span.textContent = one ? $t('All sheets (one while it deforms)') : capped ? $t('All sheets ({K} of {total})', { K: ms.K, total: ms.total }) : $t('All sheets');
    lab.classList.toggle('sheets-one', one);
    if (one) lab.dataset.tip = $t('While this deformation shows, one sheet is drawn: a step it deforms has no path on every sheet.');
    else if (capped) lab.dataset.tip = $t('{K} of the {total} surfaces are drawn (at most {K}).', { K: ms.K, total: ms.total }); else delete lab.dataset.tip;
    return lab;
  }
  // [v16.5 UX92] a region formula has no box (Region.bboxOf is null), so its note asked whether it is bounded: no point
  // of it on circles far out (radius 10³ and 10⁵ about 0, 4096 directions each), and it is taken as bounded (|z+1| < 1
  // is; a strip, a half-plane, the outside of a disc are not). A complement is unbounded
  function formulaBounded(s) {
    if (!s || s.kind !== 'formula' || s.complement) return false;
    let f;
    try { f = Expr.compileLevel(Expr.parse((s.bind && s.bind.expr) || s.expr, { allowRel: true })); } catch (e) { return false; }
    try { for (const R of [1e3, 1e5]) for (let i = 0; i < 4096; i++) { const a = (i + 0.5) * TAU / 4096; if (!(f(C(R * Math.cos(a), R * Math.sin(a))) < 0)) return false; } } catch (e) { return false; }
    return true;
  }
  // [v16.5 UX67] the step editor's "Show all sheets": Landscape (3) with All sheets on
  function showAllSheets() { if (S.view.main !== 'land') setMain('land'); if (!S.sheets) setSheets(true); }
  function setSheets(on) {
    setOpt('sheets', !!on);
    // the sheets of a root share |F|: they separate in Re F and Im F
    if (on && (S.height === 'log' || S.height === 'abs')) { setOpt('height', 'im'); toast($t('All sheets: the height is now Im {x}, where the sheets come apart (a modulus height stacks them).', { x: fnText() })); }
    buildRightFoot(); updateFocusUI(); requestRender('L'); save();
  }
  // both panes' options strips (the name is kept from when only the right pane had one)
  function buildRightFoot() { buildFoot('L'); buildFoot('R'); buildDock(); setReadouts(probe); }
  // X's paint changed (style, sectors, grid step): X redraws, and Y too while it shows the colour key
  const paintChanged = () => requestRender('L', wKeyOn() ? 'R' : null, 'T');
  function buildFoot(side) {
    const f = $(side === 'L' ? 'leftFoot' : 'rightFoot');
    if (!f) return;
    unitHome(f);
    f.innerHTML = '';
    f.className = 'options';
    const ft = foot[side];
    ft.kids = []; ft.widths = null; ft.n = -1;
    // ([v17 D4] a strip in the pane head shows even with no options of its own: its Display ▾ holds the regions')
    const headed = () => !!(f.parentElement && f.parentElement.classList.contains('pane-head'));
    if (side === 'L') { buildFootL(f); f.hidden = !f.children.length && !headed(); ft.kids = [...f.children]; layoutFootSide('L', true); drawLegend(); return; }
    const resetCam = (c, d) => h('button', { class: 'icon-btn small', title: $t('Reset camera'), 'aria-label': $t('Reset camera'), html: ICONS.orbit, onclick: () => tweenCam(c, d) });
    if (morphOn() && rImage()) {
      // (the merged deformation plane: no options of its own; the transport is docked under it)
    } else if (rImage()) {
      if (lFlat()) f.append(checkEl('fovChk', S.fov !== false, $t('View outline'), (v) => { setOpt('fov', v); requestRender('R'); drawLegend(); save(); }, ICONS.fov));
      // the phase colour key under the images: X's portrait colours of the identity, so a colour in Phase reads off
      // as a value in Y (its one switch, merged-views review)
      if (wKeyAvail()) { const kl = checkEl('wKeyChkR', !!S.wKey, $t('Phase key'), (v) => { setOpt('wKey', v); buildRightFoot(); drawLegend(); requestRender('R'); save(); tourEmit('phase-key', { on: !!v }); }, '<span class="pcol-ic"></span>'); kl.dataset.tip = $t('Phase key') + ': ' + $t('The phase colours of the {x}-plane under the images', { x: yHtml() }); f.append(kl); }
    } else if (rGlobe()) {
      f.append(
        checkEl('eqChkR', S.view.R.eq, $t('Equator'), (v) => { setViewOpt('R', 'eq', v); requestRender('R'); save(); }),
        resetCam(camS, CAMS));
      tipEq(f);
    }
    f.hidden = !f.children.length && !headed();
    ft.kids = [...f.children]; layoutFootSide('R', true);
    drawLegend();
  }
  // the deformation transport (spec 6.11; merged-views.md: docked at the bottom of the view's panel, under the plot):
  // play, the scrubber with a tick per step, t, speed, the path, Loop and Paths; x turns the deformation off
  // the phone's Steps picker: which steps deform, as the button names it
  function stepsLabel() {
    const r = homRangeOk();
    return r ? $t('Steps {f1}–{f2}', { f1: fUni(r.a), f2: fUni(r.b) }) : $t('Every step');
  }
  function buildDock() {
    const side = S.view.main === 'xy' ? 'R' : 'L';
    for (const sd of ['L', 'R']) {
      const d = $(sd === 'L' ? 'tdockL' : 'tdockR');
      if (!d) continue;
      const on = morph.open && sd === side;
      if (d.hidden === on) d.hidden = !on;
      if (!on) { if (d.firstChild) d.replaceChildren(); continue; }
      d.replaceChildren();
      const f = d;

      // the deformation transport (spec 6.11), in every view: play, the scrubber with a tick per step (one for all
      // steps at once), t, speed, the order of the steps (two or more), Loop and the Paths toggle (P); × closes it
      // and the view returns to t = end
      const m = morphLen(), nSt = morphRange().steps.length, hasD = morphHasDeriv();
      const play = h('button', { class: 'icon-btn play', id: 'morphPlay', 'data-tip': (morph.playing ? $t('Pause') : $t('Play')) + '  K', 'aria-label': morph.playing ? $t('Pause') : $t('Play'), html: morph.playing ? ICONS.pause : ICONS.play, onclick: () => togglePlay() });
      const rng = h('input', { type: 'range', id: 'morphRange', min: 0, max: Math.max(m, 0.001), step: 0.001, value: morph.T, 'aria-label': $t('Deformation time'),
        onchange: () => sndScrubEnd(), onpointerup: () => sndScrubEnd(),
        // (v16.2: the readout follows a paused scrub in every view; in Landscape or Phase alone Y's pane, whose render
        // called syncTransport, is not drawn, so it kept the last played t)
        oninput: (e) => { let v = +e.target.value; const r = Math.round(v); if (Math.abs(v - r) < 0.03) v = r; sndScrub(morph.T, v); morph.T = v; morph.seg = null; morph.u = 0; morph.playing = false; setPlayIcon(); paintFader(e.target); syncTransport(); scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); } });
      const ticks = h('div', { class: 'tticks', 'aria-hidden': 'true' });
      if (allAtOnce()) {
        const ks = morphRange().steps;
        ticks.append(h('span', { class: 'ttick', style: 'left:50%', html: $t('<i>f</i>{x}, …, <i>f</i>{x2} at once', { x: sub(ks[0]), x2: sub(ks[ks.length - 1]) }) }));
      } else morphRange().steps.forEach((k, i) => ticks.append(h('span', { class: 'ttick', style: `left:${(i + 0.5) / Math.max(1, m) * 100}%`, html: isDeriv(k) ? 'd/d<i>z</i>' : `<i>f</i>${sub(k)}` })));
      // the order of the steps (two or more): one after another (t in [0, m]) or all at once (t in [0, 1])
      let order = null;
      if (nSt > 1) {
        order = selectEl('homOrderSel', allAtOnce() ? 'all' : 'steps', [['steps', $t('One after another')], ['all', $t('All at once')]], (v) => setHomAll(v === 'all'), $t('Deformation: the steps one after another or all at once'));
        if (hasD) { order.disabled = true; order.value = 'steps'; order.dataset.tip = $t('d/dz is not a map: its step deforms on its own, so the steps run one after another'); }
      }
      // (v16, SPEC 6.6: with a bracket's pre or post, "f₁ →" and "→ f₄" around the scrubber, and the transport says so)
      const rp = S.focus === 0 ? rangeParts() : null;
      let scrub;
      if (rp && (rp.pre.length || rp.post.length)) {
        const ks = morphRange().steps;
        const preTip = rp.pre.length ? $tn('{list} is applied first, in full', '{list} are applied first, in full', rp.pre.length, { list: stepRuns(rp.pre) }) : '';
        const postTip = rp.post.length ? $tn('{list} is applied last, in full', '{list} are applied last, in full', rp.post.length, { list: stepRuns(rp.post) }) : '';
        scrub = h('div', { class: 'tscrub tfixed' },
          rp.pre.length ? h('span', { class: 'tfix tpre', 'data-tip': preTip, html: `${stepRuns(rp.pre, true)} →` }) : null,
          h('div', { class: 'trail' }, rng, ticks),
          rp.post.length ? h('span', { class: 'tfix tpost', 'data-tip': postTip, html: `→ ${stepRuns(rp.post, true)}` }) : null);
        d.setAttribute('aria-description', [$tn('Deforming step {list}.', 'Deforming steps {list}.', ks.length, { list: stepRuns(ks) }), preTip && preTip + '.', postTip && postTip + '.'].filter(Boolean).join(' '));
        // (a phone: the labels are left out once the range input would be under 120 px wide; the bracket above says the
        // same. syncTransport checks it on the frames that follow; never shown again until the dock is rebuilt, so the
        // scrubber does not flip between two widths)
        if (brPhone()) {
          scrub.dataset.fit = '1';
          let nf = 0;
          const tick = () => { if (!scrub.isConnected || !scrub.dataset.fit || ++nf > 40) return; const w = rng.getBoundingClientRect().width; if (w > 0 && w < 120) { for (const x of scrub.querySelectorAll('.tfix')) x.hidden = true; delete scrub.dataset.fit; } else requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        }
      } else { scrub = h('div', { class: 'tscrub' }, rng, ticks); d.removeAttribute('aria-description'); }
      // (v16, SPEC 6.7: the phone's Display sheet row, Deformed steps [f_a]–[f_b]; built but hidden on desktop)
      let trow = null;
      if (S.focus === 0 && activeSteps().length >= 2) {
        const n = nSteps(), r = homRangeOk() || { a: 1, b: n }, dd = HR.lastDeriv();
        // (review v16 user-4: each choice names its step, 'f₁ Exponential', and the row says where the deformation
        // starts, as the desktop menu's key slot does)
        const optName = (k) => { const st = S.steps[k - 1], d = st && Funcs.DEFS[st.type]; try { return st && d ? cardName(st, d) : ''; } catch (e) { return ''; } };
        const opt = (k, dis) => { const nm = optName(k); const o = h('option', { value: String(k) }, nm ? `${fUni(k)} ${nm}` : fUni(k)); if (dis) o.disabled = true; return o; };
        const sa = h('select', { class: 'sel', 'aria-label': $t('First deformed step'), onchange: (e) => { const a = +e.target.value, cur = homRangeOk() || { a: 1, b: nSteps() }; setHomRange({ a, b: Math.max(a, cur.b) }); } }, ...Array.from({ length: n }, (_, i) => opt(i + 1, false)));
        const sb = h('select', { class: 'sel', 'aria-label': $t('Last deformed step'), onchange: (e) => { const b = +e.target.value, cur = homRangeOk() || { a: 1, b: nSteps() }; setHomRange({ a: Math.min(cur.a, b), b }); } }, ...Array.from({ length: n }, (_, i) => opt(i + 1, i + 1 < dd)));
        sa.value = String(r.a); sb.value = String(r.b);
        trow = h('div', { class: 'trange' }, h('span', { class: 'tr-label' }, $t('Deformed steps')), h('span', { class: 'tr-sels' }, sa, h('span', { class: 'tr-dash', 'aria-hidden': 'true' }, '–'), sb),
          h('span', { class: 'tr-from', html: $t('from {v}', { v: subTags(rangeStart('html')) }) }),
          dd > 1 ? h('span', { class: 'tr-note' }, $t('A d/dz step differentiates the whole chain before it, so it cannot come after the deformed steps.')) : null);
      }
      const tread = h('span', { class: 'tread mono', id: 'morphLabel', 'data-tip': $t('The step t is in, and how far along it: t runs from 0 to {m}, one unit per step', { m }) }, morphReadout());
      const speed = seg('speedSeg', String(S.morphSecs), [['3.2', I18N.num('0.5') + '×'], ['1.6', '1×'], ['0.8', '2×']], (v) => { setOpt('morphSecs', +v); save(); }, $t('Speed'));
      const loop = checkEl('loopChk', S.loop !== false, $t('Loop'), (v) => { setOpt('loop', v); save(); sndToggleCue(!!v); });
      // (the paths t -> H_t(z) are drawn in the merged deformation plane and on its globe)
      const paths = side === 'R' ? [pathsToggle(hasD)] : [];
      // a phone: two rows (the scrubber the full width with the readout on its handle; below it play, the speed, Paths
      // and the Steps picker, which holds the range, the order and Loop, and ×)
      let kids;
      if (brPhone()) {
        const pick = h('div', { class: 'tpick', id: 'stepsPick', hidden: true }, ...(trow ? [trow] : []), ...(order ? [order] : []), loop);
        const open = h('button', { class: 'tsteps', id: 'stepsBtn', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-controls': 'stepsPick', onclick: () => { pick.hidden = !pick.hidden; open.setAttribute('aria-expanded', String(!pick.hidden)); } }, stepsLabel());
        scrub.append(tread);
        kids = [play, scrub, speed, ...paths, open, pick];
      } else kids = [play, scrub, tread, speed, ...(order ? [order] : []), loop, ...paths, ...(trow ? [trow] : [])];
      f.append(...kids,
        h('button', { class: 'icon-btn tclose', 'data-tip': $t('Deformation off  M'), 'aria-label': $t('Turn the deformation off'), html: ICONS.close, onclick: () => { closeTransport(); const b = $('morphBtn'); if (b) b.focus({ preventScroll: true }); } }));
      paintFader(rng);
      watchFader(rng);
      // ([v16.5 fix regress-1] a row too tight for the readout in words: the short form, measured once here, where the
      // dock is laid out anyway)
      { const lab = f.querySelector('#morphLabel'), tc = f.querySelector('.tclose');
        if (lab && tc && play.getClientRects().length && tc.getBoundingClientRect().top > play.getBoundingClientRect().bottom - 4) { lab.dataset.short = '1'; setText(lab, morphReadout(true)); } }
      // (v16: a phone's transport labels, measured once the dock is laid out: here, then on the next frames and renders)
      if (scrub.dataset.fit) { const w = rng.getBoundingClientRect().width; if (w > 0 && w < 120) { for (const x of scrub.querySelectorAll('.tfix')) x.hidden = true; delete scrub.dataset.fit; } }
    }
  }
  // the Paths toggle of the deformation (key P while the deformation shows in X → Y; the palette): the live paths
  // t -> H_t(z) on the merged plane and globe, remembered in the saved state, and the figure's default
  // (with a d/dz in the range no paths are drawn: the toggle is disabled and says why, as the order select)
  function pathsToggle(hasD = morphHasDeriv()) {
    const on = S.morphPaths !== false;
    const b = h('button', { class: 'phbtn tpaths', id: 'pathsBtn', type: 'button', 'aria-pressed': String(on && !hasD), 'data-tip': on ? $t('Hide the paths t ↦ H_t(z)  P') : $t('Show the paths t ↦ H_t(z)  P'), html: $t('{iconPaths}<span>Paths</span>', { iconPaths: ICONS.paths }), onclick: () => setMorphPaths(!(S.morphPaths !== false)) });
    if (hasD) { b.disabled = true; b.dataset.tip = $t('d/dz is not a map, so there are no paths t ↦ H_t(z) to draw'); }
    return b;
  }
  function setMorphPaths(on) {
    if (sndP.on && !!on !== (S.morphPaths !== false)) sndToggleCue(!!on);
    setOpt('morphPaths', !!on);
    const b = $('pathsBtn');
    if (b) { b.setAttribute('aria-pressed', String(!!on)); b.dataset.tip = on ? $t('Hide the paths t ↦ H_t(z)  P') : $t('Show the paths t ↦ H_t(z)  P'); }
    requestRender('R'); drawLegend(); save();
    tourEmit('paths-toggled', { on: !!on });
  }
  // one after another <-> all at once: the same moment of the deformation, rescaled to the new range of t
  function setHomAll(all) {
    const before = morphLen();
    setOpt('homAll', !!all);
    const after = morphLen();
    if (morph.open && before !== after) { morph.T = morph.T * after / before; morph.seg = null; morph.u = 0; }
    else if (!morph.open) morph.T = after;
    buildDock(); scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); save();
    tourEmit('order-changed', { all: !!S.homAll });
  }
  const resetCamBtn = (c, d) => h('button', { class: 'icon-btn small', title: $t('Reset camera'), 'aria-label': $t('Reset camera'), html: ICONS.orbit, onclick: () => tweenCam(c, d) });
  // the Equator checkbox's tooltip (P2: formerly "Plane")
  function tipEq(f) { const l = f.querySelector('label.check:has(> input[id^="eqChk"])'); if (l) l.dataset.tip = $t('Equatorial plane and projection ray'); }
  // X's strip (panels.md 4): the paint's part (Phase on: style, n, Δ, Outlines), then the surface's part (Sphere:
  // Equator, Reset camera; Landscape: height, sheets, scale, unit level, view, Reset camera). X Plane with Phase off
  // has none (the strip hides).
  function buildFootL(f) {
    const Fn = fnText();
    // the Landscape view (merged-views.md): its height, then its colouring in one control: the phase colours the relief
    // can paint (Tiles, Plain) or plaster. Plain on the relief is S.landPlain, so the portrait keeps its own style (P10)
    if (lLand()) {
      const paint = !S.view.D.phase ? 'plaster' : landMaterial() === 'phase' ? 'phase' : 'tiles';
      f.append(
        seg('heightSeg', S.height, [['log', `${I18N.fnName('log')} |${Fn}|`], ['abs', `|${Fn}|`], ['re', `Re ${Fn}`], ['im', `Im ${Fn}`]], (v) => { setOpt('height', v); updateFocusUI(); requestRender('L'); save(); }, $t('Height')),
        seg('landPaint', paint, [['tiles', $t('Tiles'), $t('Phase colours with modulus contours')], ['phase', $t('Plain'), $t('Phase colours only')], ['plaster', $t('Plaster'), $t('The relief alone, lit')]], (v) => {
          setViewOpt('D', 'phase', v !== 'plaster');
          if (v === 'phase') setOpt('landPlain', S.dc !== 'phase');
          else if (v === 'tiles') { setOpt('landPlain', false); if (S.dc === 'phase') setOpt('dc', 'enhanced'); }
          buildRightFoot(); updateFocusUI(); paintChanged(); save();
        }, $t('Colouring')));
    }
    if (lPhase()) {
      const land = lLand();
      if (!land) f.append(styleSeg());
      if (S.dc === 'cauchy' && lColor()) {
        const cp = cauchyPlot(), Fh = fnHtml();
        f.append(h('span', { class: 'foot-note', html: cp ? $t('(1/2π<i>i</i>) ∮ {Fh}(<i>ζ</i>)/(<i>ζ</i> − <i>z</i>) d<i>ζ</i> over {name}: {Fh} inside, 0 outside', { Fh, name: cp.name }) : $t('Select a closed curve or a bounded region: its Cauchy integral is shown.') }));
      }
      // (#247: n, the sectors per turn, only for the styles it changes: Tiles, Contours, Cauchy's Tiles, the relief's)
      if (land || /^(enhanced|modulus|cauchy)$/.test(S.dc)) f.append(h('div', { class: 'scrub', 'data-tip': $t('Phase sectors') }, h('span', { class: 'pl' }, 'n'), selectEl('secSel', String(S.sectors || 12), [['8', '8'], ['12', '12'], ['16', '16'], ['24', '24']], (v) => { setOpt('sectors', +v); paintChanged(); drawLegend(); save(); }, $t('Phase sectors'))));
      if (S.dc === 'grid' && !land) f.append(h('div', { class: 'scrub', 'data-tip': $t('Grid step') }, h('span', { class: 'pl' }, 'Δ'), selectEl('dcGridSel', String(S.dcGrid), [['0.1', '0.1'], ['0.25', '0.25'], ['0.5', '0.5'], ['1', '1'], ['2', '2']], (v) => { setOpt('dcGrid', +v); paintChanged(); save(); }, $t('Grid step'))));
      if (lColor()) f.append(checkEl('outlineChk', S.outline, $t('Outlines'), (v) => { setOpt('outline', v); requestRender('L'); save(); }, ICONS.outlines));
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
        resetCamBtn(cam, CAM3));
    }
  }
  // The deformation plane has its own view (merged-views review: it shared Y's, so zooms leaked both ways): Y's split
  // view is put aside while the deformation shows and restored when it closes; the deformation's own view is kept
  // between openings for the same chain, focus and path, and fitted to X and its images the first time.
  const defMem = { y: null, d: null, dkey: '' };
  const defKey = () => JSON.stringify([chainSig[nSteps()], S.focus, !!S.homAll, S.shapes.filter((s) => s.visible !== false).length]) + rangeKey();
  // the deformation transport: open, it plays the homotopy from t = 0 in the current view; closed, t = end
  function openTransport() {
    if (!morphRange().steps.length) { toast($t('Add a function to the chain to see its deformation.')); return; }
    phHold();
    if (typeof cancelTweens === 'function') cancelTweens();
    defMem.y = { v: { cx: V.right.cx, cy: V.right.cy, s: V.right.s }, auto: rightAuto };
    const mem = defMem.d && defMem.dkey === defKey() ? defMem.d : null;
    if (mem) { Object.assign(V.right, mem.v); rightAuto = mem.auto; } else rightAuto = true;
    morph.open = true;
    morph.T = 0; morph.seg = null; morph.u = 0; morph.hold = 0; morph.last = 0;
    morph.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (morph.playing) sndMorphStart();
    soundFunctionChanged(); sndRelayout();
    if (draft && draft.target) draft = null;
    // (review v16 user-1: a draw or Construct tool still armed, as Construct leaves it after each construction, goes
    // back to Select where the deformation's plane cannot be drawn on, so no chip stands over the plane uninvited)
    if (tool !== 'select' && solo() !== 'L') setTool('select');
    setHoverW(null); rHover = null;
    // (X → Y: the panes merge into one plane, merged-views.md; the plane is fitted once its new width is known)
    applyLayout();
    if (rightAuto && rImage()) { paneR.resize(); fitRight(); }
    updateFocusUI(); scheduleFix(); requestRender('L', 'R');
    tourEmit('deformation-toggled', { on: true });
  }
  function closeTransport() {
    if (!morph.open) return;
    phHold();
    if (typeof cancelTweens === 'function') cancelTweens();
    defMem.d = { v: { cx: V.right.cx, cy: V.right.cy, s: V.right.s }, auto: rightAuto }; defMem.dkey = defKey();
    morph.open = false; morph.playing = false; morph.seg = null; snd.morphArm = false;
    morph.T = morphLen();
    syncPlaying();
    soundFunctionChanged(); sndRelayout();
    if (defMem.y) { Object.assign(V.right, defMem.y.v); rightAuto = defMem.y.auto; defMem.y = null; }
    applyLayout();
    if (rightAuto && rImage()) { paneR.resize(); fitRight(); }
    updateFocusUI(); scheduleFix(); requestRender('L', 'R');
    tourEmit('deformation-toggled', { on: false });
  }
  const toggleTransport = () => (morph.open ? closeTransport() : openTransport());
  function setPlayIcon() {
    const b = $('morphPlay');
    if (!b) return;
    b.innerHTML = morph.playing ? ICONS.pause : ICONS.play;
    // (v16.5 UX104: the tooltip reads data-tip, which a title set later never reached, so it kept saying Pause; the
    // tooltip is written itself, with the key)
    const lab = morph.playing ? $t('Pause') : $t('Play');
    b.removeAttribute('title');
    b.setAttribute('data-tip', lab + '  K');
    b.setAttribute('aria-label', lab);
    // (v16.1: paused, the scrubber shows T exactly; while playing syncTransport moves it in half-pixel steps)
    const sl = !morph.playing ? $('morphRange') : null;
    if (sl && document.activeElement !== sl && +sl.value !== morph.T) { sl.value = morph.T; paintFader(sl); }
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
  const LEG = { W: 136, H: 72, dpr: 2, cx: 42, cy: 36, R: 24, r0: 14, sx: 80, sy: 30, sw: 48, sh: 8 };
  // one legend chip per pane (U-b): X's colour key while Phase is on (wheel and modulus strip; the landscape's
  // height), Y Plane's pattern key. legendKind(side): 'color' | 'sphere' | '3d' (X) | 'image' (Y) | null
  const legendState = { L: { key: '', drawn: '', cv: null, strip: false }, R: { key: '', drawn: '', cv: null, strip: false } };
  function legendKind(side) {
    if (!GLR.ok) return null;
    if (side === 'R') return rImage() ? 'image' : null;
    if (!lPhase()) return null;
    return lLand() ? '3d' : lGlobe() ? 'sphere' : 'color';
  }
  // (v16.5 UX20, restores "nothing covers the work uninvited") On a desktop each plane's key and its display options
  // sit in its pane head, not on the picture: the key as a short chip that unfolds under the head while hovered or
  // after a click, the options behind the Display options button (wave 2's D4 turns it into a Display popover). A phone
  // keeps both on the plane, where the key is a folded glyph and the options are in the Display sheet.
  function placeKeys() {
    const ph = document.documentElement.classList.contains('ph');
    let moved = false;
    for (const side of ['L', 'R']) {
      const pane = side === 'L' ? $('paneL') : $('paneR'), head = pane && pane.querySelector('.pane-head'), plot = $(side === 'L' ? 'plotL' : 'plotR');
      const leg = $(side === 'L' ? 'leftLegend' : 'rightLegend'), ft = $(side === 'L' ? 'leftFoot' : 'rightFoot'), led = $(side === 'L' ? 'leftLed' : 'rightLed');
      if (!head || !plot || !leg || !ft) continue;
      if (!ph) {
        if (leg.parentNode !== head) { head.insertBefore(leg, led && led.parentNode === head ? led : null); leg.classList.remove('collapsed'); moved = true; }
        if (ft.parentNode !== head) head.insertBefore(ft, led && led.parentNode === head ? led : null);
        // (the empty chain's call to action too: "Add function" in Y's head, not over the picture)
        const er = side === 'R' ? $('emptyRight') : null;
        if (er && er.parentNode !== head) head.insertBefore(er, leg);
      } else {
        const ro = $(side === 'L' ? 'leftReadout' : 'rightReadout'), vs = plot.querySelector(':scope > .viewstack');
        if (leg.parentNode !== plot) {
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
  // the key chip's words in the pane head: the pattern's cell (Y), or what X's colours show
  function legendSum(kind) {
    if (kind === 'image') return S.pattern === 'stretch' ? $t('Scale |F′|') : S.pattern === 'sphere' ? $t('Sphere cells') : $t('cell {x}', { x: I18N.num(CX.fmtNum(patternCell(), 4).replace('-', '−')) });
    return kind === '3d' ? $t('Height key') : $t('Colour key');
  }
  function drawLegend() { drawLegendSide('L'); drawLegendSide('R'); }
  // the globe shows under 3 paths because X is mostly on its far side (the globe's hint says so: the globe has no legend)
  const mfGlobeAway = () => !!(rGlobe() && morphOn() && S.morphPaths !== false && mfCache.sel && mfCache.sel.globe && mfCache.sel.kept.length < 3 && mfCache.sel.away > 0.5);
  function drawLegendSide(side) {
    const box = $(side === 'L' ? 'leftLegend' : 'rightLegend');
    const cv = $(side === 'L' ? 'legendCanvasL' : 'legendCanvas');
    if (!box || !cv) return;
    // no legend without WebGL: the plane shows nothing it could explain
    const kind = legendKind(side);
    const want = !!kind;
    if (box.hidden === want) box.hidden = !want;
    // (the folded chip on a phone shows a glyph of its key: the hue wheel, arg increasing counterclockwise from red at
    // 1, or a checker for the Pattern key)
    if (kind && box.parentNode && box.parentNode.classList && box.parentNode.classList.contains('pane-head')) {
      let sm = box.querySelector(':scope > .lg-sum');
      if (!sm) { sm = h('span', { class: 'lg-sum' }); box.prepend(sm); }
      const tx = legendSum(kind);
      if (sm.textContent !== tx) sm.textContent = tx;
      const tip = kind === 'image' ? $t('Pattern key: point at it to unfold, click to keep it open') : $t('Colour key: point at it to unfold, click to keep it open');
      // (no tooltip: pointing at the chip unfolds the key under it, which a tooltip would cover)
      if (box.getAttribute('aria-label') !== tip) box.setAttribute('aria-label', tip);
    }
    if (kind && (box.dataset.kind !== kind || box.dataset.pal !== GLR.palette())) {
      box.dataset.kind = kind; box.dataset.pal = GLR.palette();
      box.style.setProperty('--wheel', keyConic());
    }
    if (side === 'L') {
      // the Key switch: X's colour key painted in the Y plane (the user's decision for item 1: not a view of Y)
      const ks = $('wKeyRow');
      // (merged-views review: the key shows only in X → Y, so its switch is the "Phase key" check in Y's strip)
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
    const { W, H: Hh, dpr } = LEG;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = Hh * dpr; st.drawn = ''; }
    const img = kind === 'image';
    const k = rightStage();
    const anyCut = img && built.some((b, i) => i < k && S.steps[i] && S.steps[i].on !== false && b && !b.error && b.cuts.some((c) => c.kind === 'ray'));
    const key = [kind, S.dc, GLR.palette(), S.sectors, S.height, S.pattern, img ? patternCell() : '', anyCut, S.fov, lFlat(), morphOn(), S.morphPaths !== false, fnText(), TH.ink, TH.plane, TH.lineStrong, document.fonts ? document.fonts.status : ''].join('|');
    if (st.key !== key || !st.cv) {
      if (!st.cv) st.cv = document.createElement('canvas');
      const off = st.cv;
      off.width = W * dpr; off.height = Hh * dpr;
      const octx = off.getContext('2d');
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintLegend(octx, anyCut, kind, st);
      st.key = key; st.drawn = '';
    }
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
    if (legendNeedle != null) {
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
  function paintLegend(ctx, anyCut, kind, st) {
    const { W, H: Hh } = LEG;
    ctx.clearRect(0, 0, W, Hh);
    ctx.textBaseline = 'middle';
    st.strip = false;
    if (kind === 'image') {
      // pattern key: the cell size in z, plus markers present in the plane
      ctx.font = `600 11px ${TH.ui}`; ctx.fillStyle = TH.ink2; ctx.textAlign = 'left';
      if (S.pattern === 'stretch') {
        // the local scale ramp: blue shrinks, amber grows
        ctx.fillText($t('Scale |F′|'), 8, 13);
        const g = ctx.createLinearGradient(8, 0, 128, 0);
        g.addColorStop(0, TH.stretchShrink); g.addColorStop(0.5, TH.stretchMid); g.addColorStop(1, TH.stretchGrow);
        ctx.fillStyle = g; ctx.fillRect(8, 22, 120, 8);
        ctx.strokeStyle = TH.lineStrong; ctx.lineWidth = 1; ctx.strokeRect(8.5, 22.5, 119, 7);
        ctx.font = `10px ${TH.mono}`; ctx.fillStyle = TH.muted;
        ctx.textAlign = 'left'; ctx.fillText('×⅛', 8, 40); ctx.textAlign = 'center'; ctx.fillText('1', 68, 40); ctx.textAlign = 'right'; ctx.fillText('×8', 128, 40);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText($t('Pattern'), 8, 13);
        // "cell 0.5 in z" as one run: words in Archivo, the number in B612 Mono, z in STIX italic
        let x = 8;
        const run = (t, font, color) => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(t, x, 30); x += ctx.measureText(t).width; };
        if (S.pattern === 'sphere') {
          // the spherical checker has no cell size in z: its longitude x latitude cells of the Riemann sphere (SPEC 6.3)
          run(`${sphN()} × ${sphN() / 2}`, `11px ${TH.mono}`, TH.ink);
          run($t(' cells of the sphere'), `11px ${TH.ui}`, TH.muted);
        } else {
          // Russian: «клетка 0,125 в плоскости z» can be wider than the chip; then the run is narrowed to fit it, so
          // the plane's name is never cut (review ui-3). English draws as before
          const parts = [[$t('cell '), `11px ${TH.ui}`, TH.muted], [I18N.num(CX.fmtNum(patternCell(), 4).replace('-', '−')), `11px ${TH.mono}`, TH.ink], [$tx('legend', ' in '), `11px ${TH.ui}`, TH.muted], ['z', `italic 500 12px ${TH.math}`, TH.muted]];
          let k = 1;
          if (I18N.lang !== 'en') { let w = 0; for (const [t, f] of parts) { ctx.font = f; w += ctx.measureText(t).width; } k = Math.min(1, (W - 8 - 4) / w); }
          if (k < 1) { ctx.save(); ctx.translate(8, 0); ctx.scale(k, 1); x = 0; }
          for (const [t, f, c] of parts) run(t, f, c);
          if (k < 1) ctx.restore();
        }
      }
      // only marks that this plane actually draws
      let y = 52;
      ctx.font = `11px ${TH.ui}`; ctx.lineWidth = 1;
      if (anyCut) { ctx.strokeStyle = TH.cut; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(24, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = TH.muted; ctx.fillText($t('image of a cut'), 30, y); y += 15; }
      // the merged deformation plane: what grey is (X, the start) and what the lines are (the paths t -> H_t(z)), in
      // the rows the view outline uses in X → Y (merged-views review: the chip's lower half was blank)
      if (morphOn()) {
        const run = (t, font, color, x, yy) => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(t, x, yy); return x + ctx.measureText(t).width; };
        // (with a cut's row above, X and the paths share the last row: the paths' row is never dropped)
        const paths = S.morphPaths !== false && !morphHasDeriv(), share = paths && y > 52;
        let px0 = 8;
        if (y < 68) {
          // (at a focused step after the first, the start is the dashed outline of the step's source, renderMorph)
          if (S.focus <= 1) { ctx.fillStyle = TH.ink; ctx.globalAlpha = 0.16; ctx.fillRect(8, y - 5, 16, 10); ctx.globalAlpha = 1; ctx.strokeStyle = TH.faint; ctx.strokeRect(8.5, y - 4.5, 15, 9); px0 = run('X', `italic 500 12px ${TH.math}`, TH.muted, 30, y) + 10; }
          else { ctx.strokeStyle = TH.faint; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(24, y); ctx.stroke(); ctx.setLineDash([]); px0 = run('start', `11px ${TH.ui}`, TH.muted, 30, y) + 10; }
          if (share) px0 = Math.min(px0, W - 80); else { y += 15; px0 = 8; }
        }
        if (y < 72 && paths) {
          // the paths' glyph (as on screen): an open ring, the line, a small arrowhead at its middle, a filled dot
          ctx.strokeStyle = TH.muted; ctx.fillStyle = TH.muted; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(px0 + 3.6, y); ctx.lineTo(px0 + 15, y); ctx.stroke();
          ctx.beginPath(); ctx.arc(px0 + 1.8, y, 1.8, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(px0 + 11, y); ctx.lineTo(px0 + 6.5, y - 2.6); ctx.lineTo(px0 + 7.8, y); ctx.lineTo(px0 + 6.5, y + 2.6); ctx.closePath(); ctx.fill();
          ctx.beginPath(); ctx.arc(px0 + 16, y, 2, 0, TAU); ctx.fill();
          let x = run('t', `italic 500 12px ${TH.math}`, TH.muted, px0 + 22, y);
          x = run(' ↦ ', `11px ${TH.ui}`, TH.muted, x, y);
          x = run('H', `italic 500 12px ${TH.math}`, TH.muted, x, y);
          x = run('t', `italic 500 9px ${TH.math}`, TH.muted, x, y + 3);
          x = run('(', `12px ${TH.math}`, TH.muted, x, y);
          x = run('z', `italic 500 12px ${TH.math}`, TH.muted, x, y);
          run(')', `12px ${TH.math}`, TH.muted, x, y);
        }
        return;
      }
      if (S.fov !== false && lFlat() && y < 68) { ctx.strokeStyle = TH.fov; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(24, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = TH.muted; ctx.fillText($t('edge of X\'s view'), 30, y); }
      return;
    }
    // hue ring: arg increases counterclockwise from red at 1
    const { cx, cy, R, r0, sx, sy, sw, sh } = LEG;
    for (let i = 0; i < 360; i++) {
      const a0 = i * DEG, a1 = (i + 1.5) * DEG;
      ctx.fillStyle = `rgb(${keyRGB(i * DEG).map((v) => Math.round(255 * v)).join(',')})`;
      ctx.beginPath(); ctx.arc(cx, cy, R, -a0, -a1, true); ctx.arc(cx, cy, r0, -a1, -a0, false); ctx.fill();
    }
    ctx.strokeStyle = TH.lineStrong; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r0, 0, TAU); ctx.stroke();
    // labels outside the ring, "−1" right-aligned so it ends 3px from the ring and starts inside the chip
    ctx.font = `italic 500 11px ${TH.math}`; ctx.fillStyle = TH.ink2;
    ctx.textAlign = 'left'; ctx.fillText('1', cx + R + 3, cy);
    ctx.textAlign = 'right'; ctx.fillText('−1', cx - R - 3, cy);
    ctx.textAlign = 'center'; ctx.fillText('i', cx, cy - R - 6); ctx.fillText('−i', cx, cy + R + 7);
    const n = S.sectors || 12;
    // one right-aligned run: words in Archivo, the variables (F, F′, w) in STIX italic as on the ring
    // (H with a subscript t, the deformation's map: H in STIX italic, t a smaller italic below the baseline)
    const caption = (t) => {
      const parts = t.split(/(Hₜ|F′|F|(?<![A-Za-z])[wf](?![A-Za-z]))/).filter(Boolean).flatMap((p) => (p === 'Hₜ' ? [['H', `italic 500 12px ${TH.math}`, 0], ['t', `italic 500 9px ${TH.math}`, 3]] : [[p, /^(F′?|w|f)$/.test(p) ? `italic 500 12px ${TH.math}` : `600 10.5px ${TH.ui}`, 0]]));
      let x = LEG.W - 8;
      for (const [p, f] of parts) { ctx.font = f; x -= ctx.measureText(p).width; }
      ctx.fillStyle = TH.ink2; ctx.textAlign = 'left';
      for (const [p, f, dy] of parts) { ctx.font = f; ctx.fillText(p, x, 62 + dy); x += ctx.measureText(p).width; }
    };
    // the deformation paints H_t (merged-views review)
    const homL = morphOn() && lPaintsF();
    // the Phase style has no modulus bands: no strip
    const Fl = homL ? 'Hₜ' : S.focus === 0 ? 'F' : focusDeriv() ? 'w' : 'f';
    // the landscape paints Tiles unless the style is Plain (P10)
    const plainL = S.dc === 'phase';
    if (kind !== '3d' && plainL) { caption(`arg ${Fl}`); return; }
    // modulus strip
    st.strip = !(kind === 'color' && S.dc === 'classic');
    if (kind === 'color' && S.dc === 'classic') {
      const g = ctx.createLinearGradient(sx, 0, sx + sw, 0);
      g.addColorStop(0, '#000000'); g.addColorStop(0.5, '#8a8f93'); g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = TH.muted; ctx.font = `10px ${TH.mono}`; ctx.textAlign = 'left';
      ctx.fillText('0', sx, sy + 18); ctx.textAlign = 'right'; ctx.fillText('∞', sx + sw, sy + 18);
      ctx.strokeStyle = TH.ink; ctx.beginPath(); ctx.moveTo(sx + sw / 2, sy - 2); ctx.lineTo(sx + sw / 2, sy + sh + 2); ctx.stroke();
    } else {
      for (let b = 0; b < 3; b++) {
        const g = ctx.createLinearGradient(sx + b * sw / 3, 0, sx + (b + 1) * sw / 3, 0);
        g.addColorStop(0, TH.dark ? '#3a4650' : '#9aa4ab'); g.addColorStop(1, TH.dark ? '#c9d2d8' : '#eef2f4');
        ctx.fillStyle = g; ctx.fillRect(sx + b * sw / 3, sy, sw / 3, sh);
      }
      ctx.strokeStyle = TH.lineStrong; ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      // words in Archivo, the factor in B612 Mono (spec 3)
      ctx.fillStyle = TH.muted; ctx.textAlign = 'left';
      // a Russian word («линии уровня», «на полосу») is narrowed to the chip's edge; English draws as before
      const word = (t, y) => { ctx.font = `11px ${TH.ui}`; if (I18N.lang === 'en') ctx.fillText(t, sx, y); else ctx.fillText(t, sx, y, LEG.W - sx - 4); };
      const num = (t, y) => { ctx.font = `10px ${TH.mono}`; ctx.fillText(t, sx, y); };
      if (kind === '3d') { word($t('contours'), sy - 9); num(I18N.num('×1.69'), sy + 19); }
      else { num(I18N.num(n === 12 ? '×1.69' : `×${CX.fmtNum(Math.exp(TAU / n), 3)}`), sy - 9); word($t('per band'), sy + 19); }
    }
    const Fn = homL ? 'Hₜ' : S.focus === 0 ? 'F' : focusDeriv() ? 'w' : 'f';
    caption(kind === '3d' ? ({ abs: $t('height |{Fn}|', { Fn }), re: $t('height Re {Fn}', { Fn }), im: $t('height Im {Fn}', { Fn }) }[S.height] || $t('height log |{Fn}|', { Fn })) : $t('arg and |{Fn}|', { Fn }));
  }
  // (v16.5 UX97) the deformation's time to the previous or next step's tick (t at a whole step), paused
  function morphTick(d) {
    const m = morphLen(), T = morph.T, eps = 1e-6;
    let to = d > 0 ? Math.floor(T + eps) + 1 : Math.ceil(T - eps) - 1;
    to = Math.max(0, Math.min(m, to));
    if (morph.playing) { morph.playing = false; snd.morphArm = false; }
    morph.T = to; morph.seg = null; morph.u = 0; morph.hold = 0;
    setPlayIcon(); syncTransport(); scheduleFix(); requestRender('R', 'L');
  }
  function togglePlay() {
    morph.playing = !morph.playing;
    morph.last = 0;
    if (!morph.playing) { scheduleFix(); requestRender('R'); }
    if (morph.playing && morph.T >= morphLen()) morph.T = 0;
    morph.seg = null; morph.hold = 0;
    if (morph.playing) sndMorphStart(); else snd.morphArm = false;
    setPlayIcon();
    requestRender('R');
  }

