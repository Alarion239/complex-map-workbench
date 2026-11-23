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
  // lines are LD_HIT css px wide to the touch: a press there with the Pick tool drags the target with the pointer (pickDown).
  const LD_HIT = 16;                     // css px: the ring's and the lines' width to the touch
  const LD_CROSS = 5, LD_DOT = 3.5;      // css px: a critical point's cross arm, a critical value's dot radius
  const LD_DASH = [6, 4];                // css px: the join ring's dashes
  const LD_CAP = 24;                     // the most critical points drawn (an infinite set: those in the window)
  let lookDown = true;                   // the readout card's Look down switch
  let lookDrawn = null;                  // the marks as drawn, in the pane's css px (lookHit, __cmwLookDown)
  // whether the marks draw for shape s on any surface (the Stack's levels too), and whether Look down draws them on the
  // flat plane: only where the disc's readout card, with the switch, is built (readoutShown)
  const lookMarksOn = (s) => lookDown && readoutShown(s);
  const lookDownOn = (s) => lFlat() && lookMarksOn(s);
  // the join radius drawn for a disc of radius r: the least above r, else the largest
  const ldJoin = (joins, r) => { const up = joins.filter((q) => q > r); return up.length ? Math.min(...up) : joins.length ? Math.max(...joins) : null; };
  // the marks for disc s on the flat plane of pane (its view), in that plane's css px: the target's centre c and radius r,
  // the join radius (null: none), the preimages zs of c, the critical points crit and the critical values vals; and the
  // critical points as plane points, critZ
  function lookMarks(pane, s) {
    const k = leftStage(), T = shapeStage(s), c = C(s.c[0], s.c[1]), b = pane.box();
    const [cx, cy] = pane.w2s(c), px = (r) => Math.hypot(...pane.w2s(C(c.re + r, c.im)).map((v, i) => v - [cx, cy][i]));
    const ex = exactPre(k, T, [c.re, c.im]), zs = ex ? ex.zs.filter((z) => z && CX.isFin(z)) : [];
    const cr = stageCritical(k, T, b), crit = cr ? cr.points.list.map((p) => p.z).filter((z) => z && inBoxZ(z, b, 0)).slice(0, LD_CAP) : [];
    const vals = cr && cr.values.known ? cr.values.list.map((v) => v.w).filter((w) => w && inBoxZ(w, b, 0)) : [];
    const jr = ldJoin(readoutData(s).joins, s.r);
    return { id: s.id, c: [cx, cy], r: px(s.r), join: jr === null ? null : px(jr), zs: zs.map((z) => pane.w2s(z)), crit: crit.map((z) => pane.w2s(z)), vals: vals.map((w) => pane.w2s(w)), critZ: crit };
  }
  // The marks' layers, bottom to top: the floor's (the critical points), the lines from each preimage on the floor to the
  // target's centre on the glass, and the glass's (the target, its centre, the join ring, the critical values). Seen
  // straight down the two levels coincide; the Stack sees them apart (stackLevels).
  const LD_LAYERS = ['floor', 'lines', 'glass'];
  // A level of the marks: at(x, y), a point of the flat plane's css px to the canvas's css px, and path(ctx, build), which
  // adds build's path in the flat plane's css px under the level's map and leaves ctx's transform as it found it, so the
  // stroke after it keeps its width and dashes in canvas px. LD_FLAT is the flat plane's own: both levels are it.
  const LD_FLAT = { at: (x, y) => [x, y], path: (ctx, build) => build() };
  // draws layer (one of LD_LAYERS) of marks m (lookMarks's) on ctx (css px) through the levels lv = {floor, glass}
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
      const [cx, cy] = lv.glass.at(...m.c);
      for (const [x0, y0] of m.zs.map((p) => lv.floor.at(...p))) stroke(1.25, TH.ink, null, () => { ctx.moveTo(x0, y0); ctx.lineTo(cx, cy); });
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
    lookDrawn = null;
    const s = findShape(selected);
    syncLookKey(lookDownOn(s));
    if (!lookDownOn(s)) return;
    const m = lookMarks(pane, s), lv = { floor: LD_FLAT, glass: LD_FLAT };
    for (const layer of LD_LAYERS) drawLookLayer(pane.octx, m, lv, layer);
    lookDrawn = { id: m.id, c: m.c, r: m.r, join: m.join, lines: m.zs.map((p) => [...p, ...m.c]), crit: m.crit, vals: m.vals };
  }
  // the disc whose ring or (with lines) lines are within LD_HIT / 2 css px of (x, y) in the left pane, or null
  function lookHit(x, y, lines = true) {
    const d = lookDrawn;
    if (!d) return null;
    const near = Math.abs(Math.hypot(x - d.c[0], y - d.c[1]) - d.r) <= LD_HIT / 2
      || (lines && d.lines.some(([x0, y0, x1, y1]) => segDist([x, y], [x0, y0], [x1, y1]) <= LD_HIT / 2));
    return near ? findShape(d.id) : null;
  }
  // the key chip over the left plane, shown with the marks: titled Look down, or Stack on the Stack, where it also names
  // the tubes and the critical strands while they are drawn (19-stack-tubes.js). On a phone it starts folded to its
  // title, a button that unfolds it (the open key covers a fifth of a 360 px plane)
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
    }
    const ph = document.documentElement.classList.contains('ph'), sig = on ? `${I18N.lang}|${ph}|${stack}|${tubes}` : '';
    if (lookKey.dataset.sig === sig) return;
    lookKey.dataset.sig = sig;
    lookKey.hidden = !on;
    if (!on) { fitLookKey(); return; }
    const fold = (open) => { lookKeyOpen = open; lookKey.classList.toggle('folded', ph && !open); ttl.setAttribute('aria-expanded', String(open)); fitLookKey(); };
    const title = stack ? $t('Stack') : $t('Look down');
    const ttl = ph ? h('button', { type: 'button', class: 'ld-ttl', 'aria-controls': 'ldList', onclick: () => fold(!lookKeyOpen) }, title) : h('span', { class: 'ld-ttl' }, title);
    // (the marks are a list, so a screen reader says them one by one)
    lookKey.replaceChildren(ttl, h('span', { class: 'ld-list', id: 'ldList', role: 'list' }, ...LD_KEY.concat(tubes ? LD_TUBE_KEY : []).map(({ kind, text }) => h('span', { class: 'ld-it', role: 'listitem' }, ldSwatch(kind), text()))));
    lookKey.classList.toggle('folded', ph && !lookKeyOpen);
    if (ph) ttl.setAttribute('aria-expanded', String(lookKeyOpen));
    fitLookKey();
  }
  // an open key on a landscape phone that the room under the plane's readout would cut: it takes the plane's top, over the
  // readout, which gives way (phone.css)
  function fitLookKey() {
    if (!lookKey) return;
    lookFits++;
    lookKey.classList.remove('over-readout');
    const rc = document.documentElement.classList;
    if (lookKey.hidden || !lookKeyOpen || !rc.contains('ph') || !rc.contains('ph-land')) return;
    if (lookKey.scrollHeight > lookKey.clientHeight + 1) lookKey.classList.add('over-readout');
  }
  // TEST-HOOK (dropped from the published page by build.py): the marks as drawn, the key's words (its marks after its
  // title, "; " between them), and how many times the key's room was measured (fits)
  window.__cmwLookDown = () => (lookDrawn ? Object.assign({ key: lookKey && !lookKey.hidden ? [lookKey.querySelector('.ld-ttl'), ...lookKey.querySelectorAll('.ld-it')].map((e) => e.textContent).join('; ') : '', fits: lookFits }, JSON.parse(JSON.stringify(lookDrawn))) : null);
  // TEST-HOOK
