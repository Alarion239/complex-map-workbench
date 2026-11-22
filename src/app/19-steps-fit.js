  // ---------------- the thread's and the head's fit (a part of the steps view: svFitRail, svFitStrip, svFitHead and what they place) ----------------
  // "+ Add function" keeps its words while the whole thread fits beside them, and folds to the round + when the words
  // would make the thread scroll. The words' width is cached while they show, so the choice is the same before and
  // after the fold (the rail grows by exactly that width): no flicker at the edge.
  // the thread's fit to the rail, by what gives way first: "+ Add function" folds to its round + (svFitStrip), then the steps stop
  // sharing one width (each takes what its chip needs: the names stay whole), then every chip drops its name together for its
  // letters (fₖ; the chip's tooltip and its aria-label keep the name), and only then does the rail scroll. While the names fit
  // with every step as wide as the widest chip, the steps are all that width, so the planes sit evenly. Measured again only when
  // the rail's width, the chain, the fonts or the language change, never while the view moves, and a richer tier returns only
  // once it fits with SV_RAIL_HYST px to spare, so a window at the edge does not flicker. A phone's chips are the letters already
  const SV_RAIL_HYST = 8;
  const SV_RAIL_EQUAL = 0, SV_RAIL_OWN = 1, SV_RAIL_LETTERS = 2;
  function svFitRail() {
    const E = SV.els;
    if (!E || !E.track.firstElementChild || SV.anim || SV.g.moving() || (SV.drag && SV.drag.moved)) return;
    const steps = /** @type {HTMLElement[]} */ ([...E.track.querySelectorAll('.sv-step')]);
    // (the room is the rail's with "+ Add function" folded, which svFitStrip does when the names would not fit beside its words)
    // (the rail's room is what it has with no centring margin, svCentreRail's)
    const room = E.rail.clientWidth + (E.railM || 0) + (!E.add.hidden && !E.add.classList.contains('fold') && E.addLabelW ? E.addLabelW : 0);
    const key = [room, E.sig, document.fonts ? document.fonts.status : '', faceGen, I18N.lang, document.documentElement.classList.contains('ph') ? 1 : 0, E.centreLetters ? 1 : 0].join('|');
    if (key === E.railKey) return;
    E.railKey = key;
    if (document.documentElement.classList.contains('ph') || !steps.length || !room) {
      svCentreRail(E, 0);
      svLeadF(E);
      E.strip.classList.remove('sv-letters');
      E.track.style.removeProperty('--sv-step-w');
      E.railMode = SV_RAIL_EQUAL;
      return;
    }
    const fixed = [...E.track.children].reduce((a, c) => a + (c.classList.contains('sv-step') ? 0 : /** @type {HTMLElement} */ (c).offsetWidth), 0);
    // (the steps' widths when each takes the width its chip needs, with the names or with the letters alone)
    const measure = (letters) => {
      E.strip.classList.add('sv-measure');
      E.strip.classList.toggle('sv-letters', letters);
      const ws = steps.map((st) => st.offsetWidth), w = Math.max(...ws);
      E.strip.classList.remove('sv-measure');
      return { w, equal: fixed + w * ws.length, own: fixed + ws.reduce((a, b) => a + b, 0) };
    };
    // (the measuring layouts have a narrower thread: the browser clamps the rail's scroll to their range. The scroll is put back to where it
    // was: that is undoing the browser's clamp, not a scroll of the app's own, so it is not recorded by svRailTo)
    const sx = E.rail.scrollLeft;
    const names = measure(false), letters = measure(true);
    E.rail.scrollLeft = sx;
    const was = E.railMode == null ? SV_RAIL_EQUAL : E.railMode;
    const fits = (total, mode) => total <= room - (mode < was ? SV_RAIL_HYST : 0);
    const mode = E.centreLetters ? SV_RAIL_LETTERS : fits(names.equal, SV_RAIL_EQUAL) ? SV_RAIL_EQUAL : fits(names.own, SV_RAIL_OWN) ? SV_RAIL_OWN : SV_RAIL_LETTERS;
    E.railMode = mode;
    E.strip.classList.toggle('sv-letters', mode === SV_RAIL_LETTERS);
    if (mode === SV_RAIL_OWN) E.track.style.removeProperty('--sv-step-w');
    else E.track.style.setProperty('--sv-step-w', `${mode === SV_RAIL_LETTERS ? letters.w : names.w}px`);
    svCentreRail(E, mode === SV_RAIL_EQUAL ? names.equal : mode === SV_RAIL_OWN ? names.own : letters.own);
  }
  // On a phone F ends what the rail scrolls. When the thread plus F overflows the rail by less than F's own width, F would lie
  // partly in view at rest, cut by the rail's edge; a lead margin before F makes the overflow exactly F's width, so F lies fully
  // past the edge at rest and whole at the rail's end, with at most that margin as blank track before it. The margin is a
  // function of the rail's and the thread's widths, so a glide (svFitRail returns first) never changes it.
  function svLeadF(E) {
    const F = E.wholeMap, own = F.style.marginLeft;
    if (F.hidden || F.parentNode !== E.rail || E.rail.lastElementChild !== F) { if (own) { F.style.marginLeft = ''; E.centres = null; E.scrollX = E.rail.scrollLeft; } return; }
    // (the overflow without the margin, read with it in place: taking it off to measure would shrink the rail's scroll range under
    // its scroll position, and the browser would clamp that without a scroll event for the position svSync keeps)
    const over = E.rail.scrollWidth - E.rail.clientWidth - (parseFloat(own) || 0), fw = F.offsetWidth;
    const lead = over > 1 && over < fw ? Math.ceil(fw - over) : 0;
    if (lead) F.style.marginLeft = `${lead}px`;
    else F.style.marginLeft = '';
    if ((lead ? `${lead}px` : '') !== own) { E.centres = null; E.scrollX = E.rail.scrollLeft; }
  }
  // (CSS px: a centring margin smaller than this is none, and a change smaller than this leaves the margin as it is)
  const SV_CENTRE_MIN = 0.5;
  // The thread is centred on the pane: the rail gives up, on the side of the narrower group, what the wider group takes
  // (▶ ‹ stay at the left edge, the right group at the right edge), so the first and last dots lie evenly about the pane's
  // centre line. It gives up no more than leaves the thread its width (need): a tight pane shifts the thread as little as
  // it must, and one that cannot hold it scrolls. Called with a fitted rail only, never during a glide
  // (svFitRail returns first), so a resize recentres and a play never moves the rail. A phone centres in the rail (CSS).
  function svCentreRail(E, need) {
    const rail = E.rail, was = E.railM || 0;
    let ml = 0, mr = 0;
    if (need > 0 && !document.documentElement.classList.contains('ph')) {
      const sr = E.strip.getBoundingClientRect(), rr = rail.getBoundingClientRect(), cs = getComputedStyle(E.strip);
      const wasL = parseFloat(rail.style.marginLeft) || 0, wasR = parseFloat(rail.style.marginRight) || 0;
      const left = rr.left - wasL - (sr.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth));
      const right = (sr.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)) - (rr.right + wasR);
      const m = Math.max(0, Math.min(Math.abs(right - left), rr.width + wasL + wasR - need));
      if (m >= SV_CENTRE_MIN) { if (right > left) ml = m; else mr = m; }
    }
    const next = ml + mr;
    if (Math.abs(next - was) < SV_CENTRE_MIN && (parseFloat(rail.style.marginLeft) || 0) === ml) return;
    rail.style.marginLeft = ml ? `${ml.toFixed(1)}px` : ''; rail.style.marginRight = mr ? `${mr.toFixed(1)}px` : '';
    E.railM = next; E.centres = null;
    E.strip.dataset.centre = next > 0 ? 'shift' : 'none';
  }
  // the strip's width gives way in this order until the thread fits, centred on the pane where it can be: "+ Add function"
  // folds to its round +, Speed and Loop move into the Playback ⋯, the Whole chain pill folds to its pin, and last the rail
  // scrolls. A phone has only the first (its words are hidden by CSS; the rest of its strip is the sheet's).
  const SV_FOLD_ADD = 1, SV_FOLD_PLAY = 2, SV_FOLD_WHOLE = 3;
  // the Whole chain pin: three nodes on a line (the chain), not the F of the whole map
  const SV_PIN_ICON = '<svg viewBox="0 0 18 10" width="18" height="10" aria-hidden="true"><path d="M4 5h10" stroke="currentColor" stroke-width="1.4"/><circle cx="3" cy="5" r="2.2" fill="var(--surface)" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="5" r="2.2" fill="var(--surface)" stroke="currentColor" stroke-width="1.4"/><circle cx="15" cy="5" r="2.2" fill="var(--surface)" stroke="currentColor" stroke-width="1.4"/></svg>';
  function svFitStrip() {
    const E = SV.els; if (!E || !E.add) return;
    if (!E.track.firstElementChild) { E.add.classList.remove('fold'); E.strip.classList.remove('sv-fold-play', 'sv-fold-whole'); svFoldPlay(false); return; }
    const add = E.add, t = add.querySelector('.sv-add-t');
    const shown = t.offsetWidth > 0;
    if (shown) E.addLabelW = add.offsetWidth - add.offsetHeight;
    const first = E.track.firstElementChild, last = [...E.track.children].filter((c) => c !== E.add && c !== E.wholeMap).pop() || first;
    const ph = document.documentElement.classList.contains('ph');
    // (the rail's width less what the label takes while it is shown, read before the fold changes it)
    const addRoom = () => E.rail.clientWidth - (add.classList.contains('fold') ? E.addLabelW : 0);
    const addFolds = (room) => add.classList.toggle('fold', last.offsetLeft + last.offsetWidth - first.offsetLeft > room || E.railMode === SV_RAIL_LETTERS);
    const apply = (lv) => {
      add.classList.toggle('fold', lv >= SV_FOLD_ADD || E.railMode === SV_RAIL_LETTERS);
      E.strip.classList.toggle('sv-fold-play', lv >= SV_FOLD_PLAY);
      E.strip.classList.toggle('sv-fold-whole', lv >= SV_FOLD_WHOLE);
    };
    if (ph) {
      if (E.addLabelW == null) return;
      addFolds(addRoom());
      return;
    }
    // (the whole order applies to a step shown alone, whose pill and planes need the room, and to a one-step chain, whose short thread is centred; a chain keeps Speed and Loop on the strip,
    // and its thread gives way by the steps' own widths, svFitRail's)
    // (a chain of one step, not a step shown alone: the alone view has its own pill and walk, and keeps the first level that fits)
    const one = nSteps() === 1;
    if (!E.strip.querySelector('.sv-whole-pin') && !one) {
      const room = addRoom();
      apply(0);
      if (E.addLabelW != null) addFolds(room);
      svFoldPlay(false);
      return;
    }
    // (each level is tried as it would stand: the folds made, the steps fitted to the rail, and the rail's own overflow read; the
    // first level that does not overflow stands, else the last, the rail scrolling)
    // (a one-step thread must also sit on the strip's centre line; when no level centres it with the names, the chips take their
    // letters, svFitRail's)
    const stands = () => E.rail.scrollWidth <= E.rail.clientWidth + 1 && (!one || Math.abs(svThreadOff(E)) <= SV_CENTRE_TOL);
    const tryLevels = () => {
      for (let lv = 0; lv <= SV_FOLD_WHOLE; lv++) {
        apply(lv); svFoldPlay(lv >= SV_FOLD_PLAY);
        E.railKey = null; svFitRail();
        if (stands() || lv === SV_FOLD_WHOLE) return stands();
      }
      return false;
    };
    E.centreLetters = false;
    if (!tryLevels() && one) {
      E.centreLetters = true;
      if (!tryLevels()) { E.centreLetters = false; tryLevels(); }
    }
  }
  // (CSS px) how far a one-step thread may lie from the strip's centre line: under the layout suite's 4 px, which allows for rounding in its own measure
  const SV_CENTRE_TOL = 3;
  // the middle of the thread (first node to last) less the strip's centre, in CSS px
  function svThreadOff(E) {
    const nodes = E.track.querySelectorAll('.sv-plane .sv-node');
    if (!nodes.length) return 0;
    const a = nodes[0].getBoundingClientRect(), b = nodes[nodes.length - 1].getBoundingClientRect(), s = E.strip.getBoundingClientRect();
    return (a.left + a.right + b.left + b.right) / 4 - (s.left + s.right) / 2;
  }
  // Speed and Loop are on the strip, or, when it has no room for them, in the Playback ⋯ beside Order and Paths
  function svFoldPlay(on) {
    const E = SV.els;
    if (on === (E.speed.parentNode !== E.strip)) return;
    if (on) { E.rowSpeed.append(E.speed); E.rowLoop.append(E.loop); } else { E.strip.insertBefore(E.speed, E.playMore); E.strip.insertBefore(E.loop, E.playMore); }
    E.rowSpeed.hidden = E.rowLoop.hidden = !on;
  }
  // the head on one row: beside the plane's controls it keeps the style row, a ⋯ and the lamp (whatever the room, the
  // style row stays in the head). When they do not fit, the colour-plane button gives up its words first
  // (its wheel stays, its words in its name and tooltip, as on a phone), then the title its role ("phase of f₂", also in
  // the plane's accessible name). Read and written only when the head's width or the words in it change (the observer,
  // or a new title, button or surface), and never while the view moves
  // svFitHead's chip fit: the head is one row while it is under SV_HEAD_ROW px tall (40 px minimum, with 4 px for
  // the border and rounding). Short of room, a chip's name gives up its width in SV_NAME_STEP px steps (a few letters
  // each, so the fit takes few layouts), and once it is down to a step the chip drops it: it is the chip's tooltip and
  // its button's name, and the chip keeps what is not the name (the tool's count, the button, then Esc last)
  const SV_HEAD_ROW = 44, SV_NAME_STEP = 16;
  // the title's role, cut to the whole words that the room allows with an ellipsis after them (SV_ROLE_ELL px), shows at least
  // SV_ROLE_MORE px more than its first word: else it is its first word
  const SV_ROLE_MORE = 40, SV_ROLE_ELL = 12;
  // the foot's ⋯ button and the gap before it: what the head's foot takes beside its first row
  const SV_FOOT_MORE = 4 + 26;
  // the shortest level of the steps head's bar (svFitHead's set: 1 the scope as a menu, 2 the colour-plane button as its
  // wheel, 3 the surface button as its icon, 4 the title's role cut to the room left, 5 its first word) at which the Height
  // key keeps its words: the levels up to it keep the title's role and the surface button's name
  const SV_KEY_LEVEL = 2;
  function svChipBare(chip, bare) {
    const t = chip.querySelector('.mc-t');
    const act = /** @type {HTMLElement | null} */ (chip.querySelector('.mc-stop, .icon-btn'));
    chip.classList.toggle('mc-bare', bare);
    if (!t || !act) return;
    if (act.dataset.name === undefined) act.dataset.name = act.getAttribute('aria-label') || '';
    if (bare) {
      chip.setAttribute('data-tip', t.textContent);
      act.setAttribute('aria-label', `${act.dataset.name}: ${t.textContent}`);
    } else {
      chip.removeAttribute('data-tip');
      act.setAttribute('aria-label', act.dataset.name);
    }
  }
  // the title's tooltip, its whole words, while the head shows its role cut (sv-re) or as one word (sv-rs)
  function svTitleTip(short) {
    const t = SV.els.title;
    if (short) t.setAttribute('data-tip', t.textContent); else t.removeAttribute('data-tip');
  }
  // svFitHead on the next frame, once however often it is asked for before then
  let svFitRaf = 0;
  const svFitSoon = () => { if (!svFitRaf) svFitRaf = requestAnimationFrame(() => { svFitRaf = 0; svFitHead(); }); };
  function svFitHead() {
    const E = SV.els;
    if (!E || !E.head) return;
    // (while the view moves the head is fitted only when its words change, once at the half of a glide, where the title names the
    // next plane: a fit is a forced layout, so not every frame; a view parked between two planes is at rest and is fitted)
    const ph = document.documentElement.classList.contains('ph');
    const mc = $('modeChips'), lg = $('leftLegend'), lgSum = lg && lg.querySelector('.lg-sum');
    const key = [
      ph ? 1 : 0, ph ? E.barW || 0 : E.headW || 0, document.fonts ? document.fonts.status : '', faceGen, E.title.innerHTML,
      E.cp.textContent, E.surf1.textContent, E.scopeBtn.textContent, I18N.lang, mc && !mc.hidden ? mc.dataset.sig : '', E.tnote.hidden ? '' : E.tnote.dataset.sig,
      // (the Height key's chip: where it is, whether it shows, and its words)
      lg ? `${lg.parentNode === E.head ? 1 : 0}${lg.hidden ? 0 : 1}${lgSum ? lgSum.textContent : ''}` : '',
    ].join('|');
    if (key === E.fitKey) return;
    E.fitKey = key;
    SV.fits++;
    // (the levels, in the order the head gives way: the scope's switch is a menu button (sv-sm), the colour-plane button is its
    // wheel alone (sv-c1), the surface button is its icon and ▾ (sv-si), the title's role is cut to the whole words that the room
    // that is left allows, then an ellipsis (sv-re), while that shows clearly more than its first word, else it is its first word
    // (sv-rs), then the title loses its role (sv-c2) last; a word is never cut. A role whose short form keeps what a cut would
    // lose (data-short-first, svTitleParts: a carried Landscape's "landscape, carried from w₁") goes from whole to that form)
    const role = /** @type {HTMLElement | null} */ (E.title.querySelector('.sv-role'));
    const rwords = role ? /** @type {HTMLElement[]} */ ([...role.children]) : [];
    let roleN = 0;
    const set = (lvl) => {
      E.bar.classList.toggle('sv-sm', lvl >= 1); E.bar.classList.toggle('sv-c1', lvl >= 2); E.bar.classList.toggle('sv-si', lvl >= 3);
      E.bar.classList.toggle('sv-re', lvl === 4); E.bar.classList.toggle('sv-rs', lvl >= 5); E.bar.classList.toggle('sv-c2', lvl >= 6);
      // (level 4: the role's first roleN words, then an ellipsis)
      const cut = lvl === 4 && roleN > 0;
      if (role) role.classList.toggle('sv-cut', cut);
      rwords.forEach((w, i) => w.classList.toggle('sv-wx', cut && i >= roleN));
    };
    if (mc) {
      for (const c of mc.querySelectorAll('.mode-chip')) {
        svChipBare(c, false);
        c.classList.remove('mc-nokey');
        const t = /** @type {HTMLElement | null} */ (c.querySelector('.mc-t'));
        if (t) t.style.removeProperty('max-width');
      }
    }
    // (a phone: the header holds the bar beside the menu button; short of room (360 px, Russian) the surface button is
    // its icon and ▾ alone, its name in its label and tooltip)
    E.bar.classList.remove('sv-c3', 'sv-c4', 'sv-c5');
    const legend = $('leftLegend');
    E.head.classList.remove('sv-lg');
    if (legend) legend.classList.remove('glyph');
    if (ph) {
      set(0);
      // (then, still short, as on w₁ at 360 px whose name is wider than z's, the bar's gaps tighten, and its segmented
      // buttons' padding but the scope's, which keeps the spec's; last of all the scope's padding too, on w₁
      // at 320 px, where nothing else is left to give)
      const more = $('hdrMoreBtn'), mr = more && more.getClientRects().length ? more.getBoundingClientRect() : null;
      const short = () => E.bar.scrollWidth > E.bar.clientWidth + 1 || (mr && E.surf1.getBoundingClientRect().right > mr.left - 2);
      if (short()) E.bar.classList.add('sv-c3');
      if (short()) E.bar.classList.add('sv-c4');
      if (short()) E.bar.classList.add('sv-c5');
      return;
    }
    set(0);
    const tn = E.tnote.hidden ? null : E.tnote;
    E.tnote.classList.remove('tn-chip', 'tn-icon');
    const head = E.head, cs = getComputedStyle(head), gap = parseFloat(cs.columnGap) || 8;
    const room = head.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // (what the rest of the head takes at the least: the strip as its first row (the style row, or the Landscape's height) and a ⋯, every other shown item as it is,
    // a stretchy spacer as nothing; a gap before each)
    const dc = $('dcSeg'), hs = $('heightSeg'), foot = $('leftFoot');
    let keep = 0;
    for (const c of head.children) {
      if (c === E.bar || !c.getClientRects().length) continue;
      const m = getComputedStyle(c);
      const w = c === foot ? (dc && dc.getClientRects().length ? dc.getBoundingClientRect().width : hs && hs.getClientRects().length ? hs.getBoundingClientRect().width : 0) + SV_FOOT_MORE : c.classList.contains('grow') ? 0 : c.getBoundingClientRect().width;
      keep += w + parseFloat(m.marginLeft) + parseFloat(m.marginRight) + gap;
    }
    keep += 2;
    // (the Height key's chip folds to its glyph (sv-lg, which the pane head's own fit, fitTitle in 09-pane-titles.js, keeps) before the bar's controls shorten,
    // and after the targets' note; its words stay its accessible name)
    const legFoldable = !!(legend && legend.parentNode === head && legend.getClientRects().length);
    let legFolded = false;
    const levels = (legOk) => {
      let l = 0;
      set(0);
      while (l < 6 && E.bar.scrollWidth + keep > room) {
        if (legOk && legFoldable && !legFolded) {
          const w0 = legend.getBoundingClientRect().width;
          legend.classList.add('glyph'); head.classList.add('sv-lg'); legFolded = true;
          keep -= w0 - legend.getBoundingClientRect().width;
          continue;
        }
        // (level 4 starts its search afresh: the search below leaves roleN as it is when no word fits)
        if (l === 3) roleN = 0;
        set(++l);
        if (l === 4 && role && role.dataset.shortFirst != null) { roleN = 0; set(++l); } else if (l === 4) {
          // (the role keeps the whole words that the room allows, and an ellipsis for the rest: not fewer than the first word's
          // width and SV_ROLE_MORE px more, else the role is its first word. One layout reads every word's end)
          const room4 = room - keep - (E.bar.scrollWidth - (role ? role.getBoundingClientRect().width : 0)), r0 = role ? role.getBoundingClientRect().left : 0;
          let min = SV_ROLE_MORE;
          if (role && role.dataset.short) { E.bar.classList.add('sv-rs'); min += role.getBoundingClientRect().width; E.bar.classList.remove('sv-rs'); }
          const ends = rwords.map((w) => w.getBoundingClientRect().right - r0);
          for (let i = ends.length - 1; i >= 1; i--) if (ends[i - 1] + SV_ROLE_ELL <= room4) { roleN = i; break; }
          if (roleN && ends[roleN - 1] + SV_ROLE_ELL >= min) set(4); else { roleN = 0; set(++l); }
        }
      }
      return l;
    };
    let lvl = levels(!tn);
    svTitleTip(lvl >= 4);
    // (short of room, the targets' note folds first, before the bar's controls shorten and before any mode chip: to its icon and
    // the source planes' names, then to its icon alone)
    for (const cls of ['tn-chip', 'tn-icon']) {
      if (!lvl || !tn) break;
      const w0 = tn.getBoundingClientRect().width;
      tn.classList.add(cls);
      keep -= w0 - tn.getBoundingClientRect().width;
      lvl = levels(false);
      svTitleTip(lvl >= 4);
    }
    if (tn && lvl) { lvl = levels(true); svTitleTip(lvl >= 4); }
    // The levels settled, the key shows its words where the bar fits beside them, at this level or a shorter one up to
    // SV_KEY_LEVEL. Those levels keep the title's role and the surface button's name: the scope as a menu, the
    // colour-plane button as its wheel. The role, which says what the relief reads, and the surface button's name outrank
    // the key's words, so past SV_KEY_LEVEL the key stays its glyph, which keeps its words as its name and tooltip. The
    // key folds first while the bar is too wide, and a head with more room never folds a key that a head with less room
    // shows.
    if (legFolded) {
      const w1 = legend.getBoundingClientRect().width;
      legend.classList.remove('glyph'); head.classList.remove('sv-lg');
      // (the chip's own width: its words, not the width a squeezed chip is left with)
      const sum = /** @type {HTMLElement | null} */ (legend.querySelector('.lg-sum'));
      const dw = legend.getBoundingClientRect().width + (sum ? sum.scrollWidth - sum.clientWidth : 0) - w1;
      // (whether the key's words fit beside the bar at level l, the bar set there)
      const fits = (l) => l <= SV_KEY_LEVEL && E.bar.scrollWidth + keep + dw <= room;
      let l2 = lvl;
      while (!fits(l2) && l2 < SV_KEY_LEVEL) set(++l2);
      if (l2 !== lvl) { if (fits(l2)) { lvl = l2; svTitleTip(lvl >= 4); } else set(lvl); }
      if (!fits(lvl)) { legend.classList.add('glyph'); head.classList.add('sv-lg'); } else keep += dw;
    }
    // (the mode chips are the head's own items, counted above. Short of room even then, the plane never moves for a
    // chip: a chip's name shrinks, then goes, one chip after another)
    if (mc && !mc.hidden) {
      const wraps = () => head.getBoundingClientRect().height > SV_HEAD_ROW;
      const chips = /** @type {NodeListOf<HTMLElement>} */ (mc.querySelectorAll('.mode-chip'));
      for (const c of chips) {
        const t = /** @type {HTMLElement | null} */ (c.querySelector('.mc-t'));
        if (!t || !wraps()) continue;
        let w = Math.ceil(t.getBoundingClientRect().width);
        // (the Listening chip's name is its whole label: it goes at once, and Stop stays)
        if (c.dataset.mode !== 'listen') {
          while (wraps() && w > SV_NAME_STEP) { w -= SV_NAME_STEP; t.style.maxWidth = w + 'px'; }
        }
        if (wraps()) svChipBare(c, true);
        if (wraps()) c.classList.add('mc-nokey');   // (the Esc hint goes last; the key still works)
      }
    }
    // (the strip in the head fits its controls to the room the bar now leaves)
    if (typeof layoutFoot === 'function') layoutFoot(true);
  }
