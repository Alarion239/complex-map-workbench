  // ---------------- Look down: the target and its preimage seen straight down, on the plane shown ----------------
  // Seen straight down, the floor (the plane shown, k = leftStage()) and the glass (the plane T of the selected disc of a
  // later plane) coincide. Over the disc's preimage patches on the floor (stagePullbacks: filled), Look down draws, in
  // the floor's own coordinates:
  // - the target |w − c| < r as an outline ring, with a small ring at c, so that a patch and the target never read as
  //   each other (z₁ = 1 sits inside the ring for z² about 1);
  // - a line from each preimage of c to c;
  // - the critical points of the steps from k to T, red crosses, and their critical values, red dots (Critical.ofChain),
  //   in the cut's red, as the readout card's ticks;
  // - the join radius that r crosses next as it grows (else the last below it), a dashed red ring about c;
  // - a key chip at the plane's bottom left that says what each mark is.
  // The marks are drawn level by level, the floor's under the glass's (LD_LAYERS), as the Stack draws them from any
  // angle: where a critical value is a critical point (z² at 0), its dot lies over the cross.
  // It shows with the disc's readout card (readoutOn), unless the card's Look down switch is off. The ring and the
  // lines are LD_HIT css px wide to a mouse, and to a finger (or a pen) LD_HIT_TOUCH: a press there with the Pick tool
  // drags the target with the pointer (pickDown). A finger's band about the ring is lopsided (ldRingNear): it reaches
  // LD_HIT_TOUCH / 2 out from the ring, and in from it a third of the ring's drawn radius, from LD_HIT / 2 up to
  // LD_HIT_TOUCH / 2, so that a small ring's inside, where its lit patches are, stays theirs. With the Pick tool the
  // target's square, its radius handle at c + r (ldSquare: the Stack's glass draws it too), resizes it; a press there
  // comes first.
  const LD_HIT = 16;                     // css px: the ring's and the lines' width to a mouse
  const LD_HIT_TOUCH = 44;               // css px: their width to a finger (the page's touch target)
  const LD_CROSS = 5, LD_DOT = 3.5;      // css px: a critical point's cross arm, a critical value's dot radius
  const LD_DASH = [6, 4];                // css px: the join ring's dashes
  const LD_CAP = 24;                     // the most critical points drawn (an infinite set: those in the window)
  let lookDown = true;                   // the readout card's Look down switch
  let lookDrawn = null;                  // the marks as drawn, in the pane's css px (lookHit, __cmwLookDown)
  let lookSq = null, lookSqLit = false;  // the target's square as drawn on the flat plane (ldSquare's), and whether the hover lights it
  // whether the marks draw for shape s on any surface (the Stack's levels too: there always, as the card hides the switch
  // there), and whether Look down draws them on the flat plane: only where the disc's readout card, with the switch, is
  // built (readoutShown)
  const lookMarksOn = (s) => (lookDown || stackOn()) && readoutShown(s);
  const lookDownOn = (s) => lFlat() && lookMarksOn(s);
  // the join radius drawn for a disc of radius r: the least above r, else the largest
  const ldJoin = (joins, r) => { const up = joins.filter((q) => q > r); return up.length ? Math.min(...up) : joins.length ? Math.max(...joins) : null; };
  // the marks for disc s on the flat plane of pane (its view), in that plane's css px: the target's centre c and radius r,
  // the join radius (null: none), the preimages zs of c, the critical points crit and the critical values vals; and the
  // preimages of c and the critical points as plane points, zsZ and critZ
  function lookMarks(pane, s) {
    const k = leftStage(), T = shapeStage(s), c = C(s.c[0], s.c[1]), b = pane.box();
    const [cx, cy] = pane.w2s(c), px = (r) => Math.hypot(...pane.w2s(C(c.re + r, c.im)).map((v, i) => v - [cx, cy][i]));
    const ex = exactPre(k, T, [c.re, c.im]), zs = ex ? ex.zs.filter((z) => z && CX.isFin(z)) : [];
    const cr = stageCritical(k, T, b), crit = cr ? cr.points.list.map((p) => p.z).filter((z) => z && inBoxZ(z, b, 0)).slice(0, LD_CAP) : [];
    const vals = cr && cr.values.known ? cr.values.list.map((v) => v.w).filter((w) => w && inBoxZ(w, b, 0)) : [];
    const jr = ldJoin(readoutData(s).joins, s.r);
    return { id: s.id, c: [cx, cy], r: px(s.r), join: jr === null ? null : px(jr), zs: zs.map((z) => pane.w2s(z)), crit: crit.map((z) => pane.w2s(z)), vals: vals.map((w) => pane.w2s(w)), zsZ: zs, critZ: crit };
  }
  // The marks' layers, bottom to top: the floor's (the critical points), the lines from each preimage on the floor to the
  // target's centre on the glass, and the glass's (the target, its centre, the join ring, the critical values). Seen
  // straight down the two levels coincide; the Stack sees them apart (stackLevels).
  const LD_LAYERS = ['floor', 'lines', 'glass'];
  // A level of the marks: at(x, y), a point of the flat plane's css px to the canvas's css px, and path(ctx, build), which
  // adds build's path in the flat plane's css px under the level's map and leaves ctx's transform as it found it, so the
  // stroke after it keeps its width and dashes in canvas px. LD_FLAT is the flat plane's own: both levels are it.
  const LD_FLAT = { at: (x, y) => [x, y], path: (ctx, build) => build() };
  // draws layer (one of LD_LAYERS) of marks m (lookMarks's) on ctx (css px) through the levels lv = {floor, glass}, the
  // lines along lv.link where it is given (the Stack's connectors)
  function drawLookLayer(ctx, m, lv, layer) {
    const stroke = (w, colour, dash, path) => {
      ctx.setLineDash(dash || []);
      ctx.lineWidth = w + 2.5; ctx.strokeStyle = TH.halo; ctx.globalAlpha = TH.haloA; ctx.beginPath(); path(); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.strokeStyle = colour; ctx.beginPath(); path(); ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'round';
    if (layer === 'floor') {
      for (const [x, y] of m.crit.map((p) => lv.floor.at(...p))) stroke(1.75, TH.cut, null, () => { ctx.moveTo(x - LD_CROSS, y - LD_CROSS); ctx.lineTo(x + LD_CROSS, y + LD_CROSS); ctx.moveTo(x - LD_CROSS, y + LD_CROSS); ctx.lineTo(x + LD_CROSS, y - LD_CROSS); });
    } else if (layer === 'lines') {
      // (straight from the floor to the glass, or along lv.link(i), line i's runs of points in canvas px, where the levels
      // have it)
      const [cx, cy] = lv.glass.at(...m.c);
      m.zs.forEach((p, i) => {
        const runs = lv.link && lv.link(i);
        if (runs) stroke(1.25, TH.ink, null, () => runs.forEach((r) => r.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))));
        else { const [x0, y0] = lv.floor.at(...p); stroke(1.25, TH.ink, null, () => { ctx.moveTo(x0, y0); ctx.lineTo(cx, cy); }); }
      });
    } else {
      const [cx, cy] = lv.glass.at(...m.c), ring = (r) => () => lv.glass.path(ctx, () => ctx.arc(m.c[0], m.c[1], r, 0, TAU));
      stroke(2, TH.ink, null, ring(m.r));
      stroke(1.25, TH.ink, null, () => ctx.arc(cx, cy, LD_DOT, 0, TAU));
      if (m.join !== null) stroke(1.5, TH.cut, LD_DASH, ring(m.join));
      ctx.setLineDash([]);
      for (const [x, y] of m.vals.map((p) => lv.glass.at(...p))) {
        ctx.fillStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, LD_DOT + 1.5, 0, TAU); ctx.fill();
        ctx.fillStyle = TH.cut; ctx.beginPath(); ctx.arc(x, y, LD_DOT, 0, TAU); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawLookDown(pane) {
    // (nothing drawn is nothing to press: the square goes with the marks)
    lookDrawn = null; lookSq = null;
    const s = findShape(selected);
    syncLookKey(lookDownOn(s));
    if (!lookDownOn(s)) return;
    const m = lookMarks(pane, s), lv = { floor: LD_FLAT, glass: LD_FLAT };
    for (const layer of LD_LAYERS) drawLookLayer(pane.octx, m, lv, layer);
    // (the target's square over the marks, lit under the pointer)
    lookSq = ldSquare(pane);
    if (!lookSq) lookSqLit = false;
    if (lookSq) drawHandleMark(pane.octx, lookSq.p[0], lookSq.p[1], false, lookSqLit ? TH.probe : shapeInk(lookSq.s).edge, lookSqLit ? 2.5 : 1.5);
    lookDrawn = { id: m.id, c: m.c, r: m.r, join: m.join, lines: m.zs.map((p) => [...p, ...m.c]), crit: m.crit, vals: m.vals, square: lookSq && lookSq.p, squareLit: !!lookSq && lookSqLit };
  }
  // the identity as a level's map: the flat plane's css px are the canvas's
  const LD_ID = [1, 0, 0, 1, 0, 0];
  // the least stretch of the affine map G's linear part (its least singular value): an ellipse drawn through G from a ring
  // of radius r has its half minor axis r times it
  function ldLeast(G) {
    const det = G[0] * G[3] - G[1] * G[2], sq = G[0] ** 2 + G[1] ** 2 + G[2] ** 2 + G[3] ** 2;
    return Math.sqrt(Math.max(0, (sq - Math.sqrt(Math.max(0, sq * sq - 4 * det * det))) / 2));
  }
  // The target's square, its radius handle (Region.handlesOf's 'r', at c + r), drawn on the level G maps the flat plane's
  // css px to: the flat plane's own (LD_ID) for Look down, the glass's on the Stack. It shows with the Pick tool while
  // the target's marks show and its radius is free (not bound to a construction, s.at.r, as drawHandles and handleAt read
  // it): {s, p, o, minor}, p its place and o the centre's in the canvas's css px, minor the ring's drawn half minor axis;
  // or null
  function ldSquare(pane, G = LD_ID) {
    const s = findShape(selected);
    if (tool !== 'pick' || !s || s.kind !== 'disc' || s.def || s.fixed || !lookMarksOn(s)) return null;
    const hd = Region.handlesOf(s).find(([k]) => k === 'r');
    if (!hd || !CX.isFin(hd[1]) || (s.at && s.at[hd[0]])) return null;
    const at = (z) => { const [u, v] = pane.w2s(z); return [G[0] * u + G[2] * v + G[4], G[1] * u + G[3] * v + G[5]]; };
    const c = C(s.c[0], s.c[1]), r = Math.hypot(...pane.w2s(hd[1]).map((v, i) => v - pane.w2s(c)[i]));
    return { s, p: at(hd[1]), o: at(c), minor: r * ldLeast(G) };
  }
  // the target when (x, y) is on the square q (ldSquare's, or null): within LD_HIT / 2 css px of it, LD_HIT_TOUCH / 2 for
  // a finger's or a pen's press (finger); else null. Where the ring is drawn smaller than a finger's reach (its half minor
  // axis under LD_HIT_TOUCH / 2), a finger reaches the square only from outside, the side away from the centre, so that
  // the ring stays a finger's to drag
  function ldSquareHit(q, x, y, finger = false) {
    if (!q || Math.hypot(x - q.p[0], y - q.p[1]) > (finger ? LD_HIT_TOUCH : LD_HIT) / 2) return null;
    const out = (x - q.p[0]) * (q.p[0] - q.o[0]) + (y - q.p[1]) * (q.p[1] - q.o[1]) >= 0;
    return finger && q.minor < LD_HIT_TOUCH / 2 && !out ? null : q.s;
  }
  // the resize cursor for the square q (ldSquare's): the one along the line from the centre to it on screen
  function ldSquareCursor(q) {
    const a = Math.atan2(q.p[1] - q.o[1], q.p[0] - q.o[0]), k = Math.round((((a % Math.PI) + Math.PI) % Math.PI) / (Math.PI / 4)) % 4;
    return ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'][k];
  }
  // the target when (x, y) of the flat plane is on Look down's square as drawn, for a finger's press or not; else null
  const lookSquareAt = (x, y, finger = false) => (lookSq ? ldSquareHit(lookSq, x, y, finger) : null);
  // the hover at (x, y) of the flat plane lights the square or puts it out: true when that changed
  function lookSquareHover(x, y) {
    const on = !!lookSquareAt(x, y);
    if (on === lookSqLit) return false;
    lookSqLit = on;
    requestRender('OL');
    return true;
  }
  // the cursor over Look down's square on the flat plane (ldSquareCursor's) while the hover lights it, else null
  const lookSquareCursor = () => (lookSq && lookSqLit ? ldSquareCursor(lookSq) : null);
  // whether a press gap css px from a ring of drawn radius r (in: inside it) is on the ring: within LD_HIT / 2 for a
  // mouse; for a finger (finger) within LD_HIT_TOUCH / 2 outside it, and inside it within r / 3 clamped to
  // [LD_HIT / 2, LD_HIT_TOUCH / 2]
  const ldRingNear = (gap, inside, r, finger) => gap <= (!finger ? LD_HIT / 2
    : inside ? Math.min(LD_HIT_TOUCH / 2, Math.max(LD_HIT / 2, r / 3)) : LD_HIT_TOUCH / 2);
  // the half width of the lines to a press (finger: a finger's or a pen's)
  const ldLineReach = (finger) => (finger ? LD_HIT_TOUCH : LD_HIT) / 2;
  // the disc whose ring or (with lines) lines are near (x, y) in the left pane, for a press of a finger or not (ldRingNear,
  // ldLineReach), or null
  function lookHit(x, y, lines = true, finger = false) {
    const d = lookDrawn;
    if (!d) return null;
    const dc = Math.hypot(x - d.c[0], y - d.c[1]);
    const near = ldRingNear(Math.abs(dc - d.r), dc < d.r, d.r, finger)
      || (lines && d.lines.some(([x0, y0, x1, y1]) => segDist([x, y], [x0, y0], [x1, y1]) <= ldLineReach(finger)));
    return near ? findShape(d.id) : null;
  }
  // the key chip over the left plane, shown with the marks: titled Look down, or Stack on the Stack, where it also names
  // the tubes and the critical strands while they are drawn (19-stack-tubes.js), and ends with the switch between their
  // two kinds of connector (19-stack-links.js). On a phone it starts folded to its title, a button that unfolds it (the
  // open key covers a fifth of a 360 px plane)
  let lookKey = null, lookKeyOpen = false, lookFits = 0;
  const LD_KEY = [
    { kind: 'ring', text: () => $t('target') }, { kind: 'line', text: () => $t('to the target') }, { kind: 'cross', text: () => $t('critical point') },
    { kind: 'dot', text: () => $t('critical value') }, { kind: 'dash', text: () => $t('join radius') },
  ];
  const LD_TUBE_KEY = [{ kind: 'tube', text: () => $t('tube of a piece') }, { kind: 'strand', text: () => $t('critical point to its value') }];
  const ldSwatch = (kind) => h('span', { class: `ld-sw ld-${kind}`, 'aria-hidden': 'true' });
  function syncLookKey(on, stack = false, tubes = false) {
    const host = $('plotL');
    if (!host) return;
    if (!lookKey) {
      lookKey = h('div', { class: 'ld-key', role: 'note' });
      host.append(lookKey);
      // (its room is measured again when the key or the plane changes size, or the root's classes change: the context bar
      // opening or closing, a turn to landscape; never per overlay frame)
      try { const ro = new ResizeObserver(() => requestAnimationFrame(fitLookKey)); ro.observe(lookKey); ro.observe(host); } catch (e) { /* no ResizeObserver */ }
      try { new MutationObserver(() => requestAnimationFrame(fitLookKey)).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] }); } catch (e) { /* no MutationObserver */ }
      // (and when it has ridden up or down with the plane's other keys: the Stack's rooms, stackMeasureRooms)
      lookKey.addEventListener('transitionend', () => requestAnimationFrame(fitLookKey));
    }
    const ph = document.documentElement.classList.contains('ph'), sig = on ? `${I18N.lang}|${ph}|${stack}|${tubes}` : '';
    // (the same key keeps its elements: the connectors' switch shows the kind drawn, which a load or an undo may have
    // changed, and keeps the focus a key press on it left there)
    if (lookKey.dataset.sig === sig) { const sw = lookKey.querySelector('.ld-links'); if (sw) setSeg(sw, linkMode()); return; }
    lookKey.dataset.sig = sig;
    lookKey.hidden = !on;
    if (!on) { fitLookKey(); return; }
    // (on a phone one key of the plane is open at a time: the colour key's card, open, folds as this one opens; the focus
    // stays on this key's title)
    const fold = (open) => {
      lookKeyOpen = open; lookKey.classList.toggle('folded', ph && !open); ttl.setAttribute('aria-expanded', String(open));
      if (ph && open) for (const lg of host.querySelectorAll(':scope > .legend-chip:not(.collapsed)')) lg.classList.add('collapsed');
      fitLookKey();
    };
    const title = stack ? $t('Stack') : $t('Look down');
    const ttl = ph ? h('button', { type: 'button', class: 'ld-ttl', 'aria-controls': stack && tubes ? 'ldList ldLinks' : 'ldList', onclick: () => fold(!lookKeyOpen) }, title) : h('span', { class: 'ld-ttl' }, title);
    // (the marks are a list, so a screen reader says them one by one)
    lookKey.replaceChildren(ttl, h('span', { class: 'ld-list', id: 'ldList', role: 'list' }, ...LD_KEY.concat(tubes ? LD_TUBE_KEY : []).map(({ kind, text }) => h('span', { class: 'ld-it', role: 'listitem' }, ldSwatch(kind), text()))));
    // (with the tubes, the switch between the Stack's two kinds of connector, after the marks)
    if (stack && tubes) lookKey.append(stackLinksSwitch());
    lookKey.classList.toggle('folded', ph && !lookKeyOpen);
    if (ph) ttl.setAttribute('aria-expanded', String(lookKeyOpen));
    fitLookKey();
  }
  // an open key on a landscape phone that the room under the plane's readout would cut: it takes the plane's top, over the
  // readout, which gives way (over-readout). Where it would still not show all it holds, it is marked: narrow where its
  // title and the connectors' switch do not fit side by side, tight where its marks run past its foot; phone.css draws the
  // key closer there, in the one-key-high row of the Stack's keys, whose row sets how wide the key may be (#2449)
  function fitLookKey() {
    if (!lookKey) return;
    lookFits++;
    lookKey.classList.remove('over-readout', 'narrow', 'tight');
    const rc = document.documentElement.classList;
    if (!lookKey.hidden && lookKeyOpen && rc.contains('ph') && rc.contains('ph-land')) {
      const ttl = lookKey.querySelector('.ld-ttl');
      if (lookKey.scrollHeight > lookKey.clientHeight + 1) lookKey.classList.add('over-readout');
      if (lookKey.scrollWidth > lookKey.clientWidth + 1 || (!!ttl && ttl.scrollWidth > ttl.clientWidth + 1)) lookKey.classList.add('narrow');
      if (lookKey.scrollHeight > lookKey.clientHeight + 1) lookKey.classList.add('tight');
    }
    stackMeasureRooms();
    svTileRefresh();   // (the glide's formula tile keeps clear of the key: the plane's contain: strict keeps its size from telling it)
  }
  // TEST-HOOK (dropped from the published page by build.py): the marks as drawn, the key's words (its marks after its
  // title, "; " between them), and how many times the key's room was measured (fits)
  window.__cmwLookDown = () => (lookDrawn ? Object.assign({ key: lookKey && !lookKey.hidden ? [lookKey.querySelector('.ld-ttl'), ...lookKey.querySelectorAll('.ld-it')].map((e) => e.textContent).join('; ') : '', fits: lookFits }, JSON.parse(JSON.stringify(lookDrawn))) : null);
  // TEST-HOOK
