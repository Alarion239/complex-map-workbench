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
  // It shows with the disc's readout card (readoutOn), unless the card's Look down switch is off. The ring and the
  // lines are LD_HIT css px wide to the touch: a press there with the Pick tool drags the target (pickDown).
  const LD_HIT = 16;                     // css px: the ring's and the lines' width to the touch
  const LD_CROSS = 5, LD_DOT = 3.5;      // css px: a critical point's cross arm, a critical value's dot radius
  const LD_DASH = [6, 4];                // css px: the join ring's dashes
  const LD_CAP = 24;                     // the most critical points drawn (an infinite set: those in the window)
  let lookDown = true;                   // the readout card's Look down switch
  let lookDrawn = null;                  // the marks as drawn, in the pane's css px (lookHit, __cmwLookDown)
  // whether Look down draws for shape s: only where its readout card, with the switch, is built (readoutShown)
  const lookDownOn = (s) => lookDown && lFlat() && readoutShown(s);
  // the join radius drawn for a disc of radius r: the least above r, else the largest
  const ldJoin = (joins, r) => { const up = joins.filter((q) => q > r); return up.length ? Math.min(...up) : joins.length ? Math.max(...joins) : null; };
  function drawLookDown(pane) {
    lookDrawn = null;
    const s = findShape(selected);
    syncLookKey(lookDownOn(s));
    if (!lookDownOn(s)) return;
    const k = leftStage(), T = shapeStage(s), c = C(s.c[0], s.c[1]), b = pane.box(), ctx = pane.octx;
    const [cx, cy] = pane.w2s(c), px = (r) => Math.hypot(...pane.w2s(C(c.re + r, c.im)).map((v, i) => v - [cx, cy][i]));
    const ex = exactPre(k, T, [c.re, c.im]), zs = ex ? ex.zs.filter((z) => z && CX.isFin(z)) : [];
    const cr = stageCritical(k, T, b), crit = cr ? cr.points.list.map((p) => p.z).filter((z) => z && inBoxZ(z, b, 0)).slice(0, LD_CAP) : [];
    const vals = cr && cr.values.known ? cr.values.list.map((v) => v.w).filter((w) => w && inBoxZ(w, b, 0)) : [];
    const jr = ldJoin(readoutData(s).joins, s.r);
    const stroke = (w, colour, dash, path) => {
      ctx.setLineDash(dash || []);
      ctx.lineWidth = w + 2.5; ctx.strokeStyle = TH.halo; ctx.globalAlpha = TH.haloA; ctx.beginPath(); path(); ctx.stroke();
      ctx.globalAlpha = 1; ctx.lineWidth = w; ctx.strokeStyle = colour; ctx.beginPath(); path(); ctx.stroke();
    };
    ctx.save();
    ctx.lineCap = 'round';
    const lines = zs.map((z) => [...pane.w2s(z), cx, cy]);
    for (const [x0, y0, x1, y1] of lines) stroke(1.25, TH.ink, null, () => { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); });
    const rpx = px(s.r);
    stroke(2, TH.ink, null, () => ctx.arc(cx, cy, rpx, 0, TAU));
    stroke(1.25, TH.ink, null, () => ctx.arc(cx, cy, LD_DOT, 0, TAU));
    const jpx = jr === null ? null : px(jr);
    if (jpx !== null) stroke(1.5, TH.cut, LD_DASH, () => ctx.arc(cx, cy, jpx, 0, TAU));
    ctx.setLineDash([]);
    const critPx = crit.map((z) => pane.w2s(z)), valPx = vals.map((w) => pane.w2s(w));
    // (a critical value's dot under a critical point's cross, where one is the other: z² at 0)
    for (const [x, y] of valPx) {
      ctx.fillStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, LD_DOT + 1.5, 0, TAU); ctx.fill();
      ctx.fillStyle = TH.cut; ctx.beginPath(); ctx.arc(x, y, LD_DOT, 0, TAU); ctx.fill();
    }
    for (const [x, y] of critPx) stroke(1.75, TH.cut, null, () => { ctx.moveTo(x - LD_CROSS, y - LD_CROSS); ctx.lineTo(x + LD_CROSS, y + LD_CROSS); ctx.moveTo(x - LD_CROSS, y + LD_CROSS); ctx.lineTo(x + LD_CROSS, y - LD_CROSS); });
    ctx.restore();
    lookDrawn = { id: s.id, c: [cx, cy], r: rpx, join: jpx, lines, crit: critPx, vals: valPx };
  }
  // the disc whose ring or lines are within LD_HIT / 2 css px of (x, y) in the left pane, or null
  function lookHit(x, y) {
    const d = lookDrawn;
    if (!d) return null;
    const near = Math.abs(Math.hypot(x - d.c[0], y - d.c[1]) - d.r) <= LD_HIT / 2
      || d.lines.some(([x0, y0, x1, y1]) => segDist([x, y], [x0, y0], [x1, y1]) <= LD_HIT / 2);
    return near ? findShape(d.id) : null;
  }
  // the key chip over the left plane, shown with the marks. On a phone it starts folded to its title, a button that
  // unfolds it (the open key covers a fifth of a 360 px plane)
  let lookKey = null, lookKeyOpen = false;
  const LD_KEY = [
    { kind: 'ring', text: () => $t('target') }, { kind: 'line', text: () => $t('to the target') }, { kind: 'cross', text: () => $t('critical point') },
    { kind: 'dot', text: () => $t('critical value') }, { kind: 'dash', text: () => $t('join radius') },
  ];
  const ldSwatch = (kind) => h('span', { class: `ld-sw ld-${kind}`, 'aria-hidden': 'true' });
  function syncLookKey(on) {
    const host = $('plotL');
    if (!host) return;
    if (!lookKey) { lookKey = h('div', { class: 'ld-key', role: 'note' }); host.append(lookKey); }
    const ph = document.documentElement.classList.contains('ph'), sig = on ? `${I18N.lang}|${ph}` : '';
    if (lookKey.dataset.sig === sig) return;
    lookKey.dataset.sig = sig;
    lookKey.hidden = !on;
    if (!on) return;
    const fold = (open) => { lookKeyOpen = open; lookKey.classList.toggle('folded', ph && !open); ttl.setAttribute('aria-expanded', String(open)); };
    const ttl = ph ? h('button', { type: 'button', class: 'ld-ttl', onclick: () => fold(!lookKeyOpen) }, $t('Look down')) : h('span', { class: 'ld-ttl' }, $t('Look down'));
    // (the marks are a list, so a screen reader says them one by one)
    lookKey.replaceChildren(ttl, h('span', { class: 'ld-list', role: 'list' }, ...LD_KEY.map(({ kind, text }) => h('span', { class: 'ld-it', role: 'listitem' }, ldSwatch(kind), text()))));
    lookKey.classList.toggle('folded', ph && !lookKeyOpen);
    if (ph) ttl.setAttribute('aria-expanded', String(lookKeyOpen));
  }
  // TEST-HOOK (dropped from the published page by build.py): the marks as drawn, and the key's words, its marks after
  // its title, "; " between them
  window.__cmwLookDown = () => (lookDrawn ? Object.assign({ key: lookKey && !lookKey.hidden ? [lookKey.querySelector('.ld-ttl'), ...lookKey.querySelectorAll('.ld-it')].map((e) => e.textContent).join('; ') : '' }, JSON.parse(JSON.stringify(lookDrawn))) : null);
  // TEST-HOOK
