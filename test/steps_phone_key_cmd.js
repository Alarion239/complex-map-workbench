// The steps view's per-plane key on a phone (portrait: 412 x 860, 360 x 740 and 320 x 640 in English, 320 x 640 in Russian; landscape:
// 740 x 360 and 568 x 320 in English, 667 x 375 in Russian and Italian; touch): example 1 with the thread parked at each plane
// and the colour plane T at each plane (the sweep of test/lib/plane_key_kit.js, which also checks the legend's kind and
// caption against the laptop's key). On the phone the key is a folded glyph on the plane that a tap unfolds into the card (a
// second tap folds it); the glyph and the card are each whole (inside the plane and the screen) and nothing else covers them
// (the topmost element at the middle and near the four corners, inside the rounded corners, is the key). The folded glyph is
// 30 px with a 44 px hit area: the topmost element at its centre and 21.5 px out from it on each side is the key, and the padded box
// (the glyph 7 px out on each side) meets no other button that takes a press (the phone's readout is a button with pointer-events
// none, and the folded key is checked against it on its own). The unfolded card meets no button of the plane's right-hand
// column or head, at any of the widths.
// The card under a readout: it stands READOUT_GAP below a short readout when the plane has room, and under a readout so tall that
// the drop would carry it past the plane's foot (a hint that wraps to many lines in a narrow column, stood in for by a chip over the
// key's columns) it stays KEY_GUTTER inside the foot, over the readout's last lines. Every width.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_key_kit.js'), 'utf8'));
const fails = [], info = {};
const PAD = 7;       // the hit area's reach beyond the 30 px glyph on each side (44 = 30 + 2 x 7), px: the folded key's ::before, whose inset is measured from the padding box, so the page's value is PAD + the glyph's border
const OUT = 21.5;    // how far out from the glyph's centre the hit probes go, px: inside the 44 px area (22 from the centre), outside a 42 px one
const GLYPH = 30;    // the folded key's glyph, px
const LAND_TOP = 12;  // the least a landscape phone's folded key stands under the plane's top, px: the 8 px hit area and a 4 px gap
const READOUT_GAP = 6, KEY_GUTTER = 4, SLACK = 1;   // the gap under a readout, the gutter above the plane's foot (09-pane-titles.js), and layout rounding, px
const UI_WAIT = 5000;   // how long a toast may take to go and the card to unfold, ms
const WIDTHS = [[412, 860, 'en'], [360, 740, 'en'], [320, 640, 'en'], [320, 640, 'ru'], [740, 360, 'en'], [667, 375, 'ru'], [667, 375, 'it'], [568, 320, 'en']];   // width, height, language (the last four are landscape phones)
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
// the key element's rect, its plane's rect, the screen, and what is on top at its middle and near its corners
const probe = (pad = 0) => ev(`(() => {
  const k = document.getElementById('leftLegend'), p = document.getElementById('plotL');
  if (!k || !p || !k.getClientRects().length) return { shown: false };
  const b = k.getBoundingClientRect(), q = p.getBoundingClientRect();
  const onTop = (x, y) => { const e = document.elementFromPoint(x, y); return !!e && (e === k || k.contains(e)) ? '' : (e ? (e.id || e.className || e.tagName) + '' : 'none'); };
  const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]].map(([fx, fy]) => onTop(b.left + fx * b.width, b.top + fy * b.height));
  const r = (x) => Math.round(x * 10) / 10;
  // (whether a rect overlaps the key's box grown by pad on each side)
  const touches = (q2, pad) => q2.left < b.right + pad && q2.right > b.left - pad && q2.top < b.bottom + pad && q2.bottom > b.top - pad;
  return { shown: true, collapsed: k.classList.contains('collapsed'), open: k.classList.contains('open'), w: r(b.width), h: r(b.height),
    inPlane: b.left >= q.left - 0.5 && b.right <= q.right + 0.5 && b.top >= q.top - 0.5 && b.bottom <= q.bottom + 0.5,
    onScreen: b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight, top: pts, vw: innerWidth,
    // (the globe key of the plane's stack, and the plane: the folded key's centre stands level with the globe key's, where the key is in use: the
    // Landscape's, disabled, stays in its slot and the folded key keeps its place)
    globe: (() => { const g = document.querySelector('#leftSph'); if (!g || !g.getClientRects().length || g.getAttribute('aria-disabled') === 'true') return null; const gb = g.getBoundingClientRect(); return { cy: r(gb.top + gb.height / 2), top: r(gb.top) }; })(), plotTop: r(q.top), cy: r(b.top + b.height / 2), keyTop: r(b.top),
    // (how far the invisible ::before reaches beyond the glyph's border box on each side: its inset from the padding box less the border)
    reach: (() => { const bs = getComputedStyle(k), ps = getComputedStyle(k, '::before'), bw = parseFloat(bs.borderTopWidth) || 0;
      return ['top', 'right', 'bottom', 'left'].map((d) => r(-parseFloat(ps[d]) - bw)); })(),
    // (the readout chip of the plane: the folded key stands clear of it)
    readout: (() => { const ro = document.getElementById('leftReadout'); if (!ro || !ro.getClientRects().length) return null; return touches(ro.getBoundingClientRect(), 0); })(),
    // (the 44 px hit area: the key on top at the centre and 21.5 px out from it on each side, the padded box clear of every other
    // button that takes a press: the phone's readout is a button with pointer-events none, and the folded key is checked against it above)
    hit: [[0, 0], [-${OUT}, 0], [${OUT}, 0], [0, -${OUT}], [0, ${OUT}]].map(([dx, dy]) => onTop(b.left + b.width / 2 + dx, b.top + b.height / 2 + dy)),
    meets: [...document.querySelectorAll('button, [role="button"], a[href], input, select, summary')].filter((e) => e.getClientRects().length && !k.contains(e)).map((e) => { const q2 = e.getBoundingClientRect(); return { e, q2 }; })
      .filter(({ e, q2 }) => q2.width > 0 && getComputedStyle(e).pointerEvents !== 'none' && touches(q2, ${pad})).map(({ e }) => (e.id || e.className || e.tagName) + '') };
})()`);
for (const [w, h, lang] of WIDTHS) {
  await view(w, h, false, true);
  const nPl = await K.open('phonekey' + w + lang, PORT, lang);
  ok(`${w} ${lang}: the phone layout`, await ev('!!Phone._state().on'), null);
  ok(`${w} ${lang}: ${w > h ? 'a landscape phone has' : 'a portrait phone has no'} ph-land`, (await ev("document.documentElement.classList.contains('ph-land')")) === (w > h), null);
  ok(`${w} ${lang}: example 1 has three planes`, nPl === 3, nPl);
  // (the example's toast is a transient overlay on the plane, over a short landscape plane too: it is dismissed, as it times out on a real page, so the probe reads the key and the buttons)
  await ev(`(document.querySelectorAll('.toast-x').forEach((b) => b.click()), 1)`);
  await settled({ until: `!document.querySelector('.toast')`, max: UI_WAIT });
  await K.sweep(ok, info, nPl, async (name, lg) => {
    name = `${w} ${lang}, ${name}`;
    const pr = await probe(PAD);
    info[name] = { lg, pr };
    ok(`${name}: the folded key shows on the phone, whole, and nothing covers it`, pr.shown && pr.collapsed && pr.inPlane && pr.onScreen && pr.top.every((t) => t === ''), pr);
    ok(`${name}: the folded key's hit area reaches ${PAD} px past the glyph on each side, as the suite measures it`, pr.reach.every((x) => x === PAD), pr.reach);
    ok(`${name}: the folded key does not cover the readout chip`, !pr.readout, pr.readout);
    // (a landscape phone: the 30 px glyph is centred on the globe key's 44 px, unless that puts it above LAND_TOP px under the plane's top, where it stands at LAND_TOP; portrait keeps the key at the top of the plane)
    if (w > h) {
      const wantTop = pr.globe ? Math.max(pr.plotTop + LAND_TOP, pr.globe.cy - GLYPH / 2) : null;   // (the Landscape has no globe key)
      if (pr.globe) ok(`${name}: the folded key is level with the globe key (centres within 1 px; at ${LAND_TOP} px under the plane's top where the globe is higher)`, Math.abs(pr.keyTop - wantTop) <= 1, { globe: pr.globe, plotTop: pr.plotTop, keyTop: pr.keyTop, wantTop });
    }
    ok(`${name}: the folded key has a 44 px hit area: the key is on top at its centre and 21.5 px out from it on each side, and the padded box meets no other button`, pr.hit.every((t) => t === '') && pr.meets.length === 0, { hit: pr.hit, meets: pr.meets });
    // (a tap unfolds the card: it is as whole and as uncovered as the glyph, and larger than it)
    await ev(`(document.getElementById('leftLegend').click(), 1)`);
    await settled({ until: `!document.getElementById('leftLegend').classList.contains('collapsed')`, max: UI_WAIT });
    const un = await probe(0);
    info[name].unfolded = un;
    ok(`${name}: the unfolded card is shown, whole, and nothing covers it`, un.shown && !un.collapsed && un.w > pr.w && un.inPlane && un.onScreen && un.top.every((t) => t === ''), un);
    ok(`${name}: the unfolded card meets no button`, un.meets.length === 0, un.meets);
    await ev(`(document.getElementById('leftLegend').click(), 1)`);
  });
  // the card under a readout, on the plane: a short readout, then one so tall that the drop would end the card past the plane's foot
  await K.park(0, 0);
  await ev(`(document.getElementById('leftLegend').classList.contains('collapsed') || document.getElementById('leftLegend').click(), 1)`);
  for (const [tag, tallBy] of [['short', 0], ['tall', 1]]) {
    // (the stand-in readout is one chip over the key's columns: from the plane's top, 28 px, or the plane's height less what
    // leaves room for the card under it and a little more; the card stands under the lowest readout of the plane, which may be the page's own)
    await ev(`(() => { const k = document.getElementById('leftLegend'); if (!k.classList.contains('collapsed')) k.click(); const p = document.getElementById('plotL'), old = document.getElementById('zStandIn'); if (old) old.remove();
      const e = document.createElement('div'); e.id = 'zStandIn'; e.className = 'chip readout'; e.textContent = 'readout';
      e.style.cssText = 'position: absolute; left: 8px; top: 8px; width: calc(100% - 16px); pointer-events: none; height: ' + (${tallBy} ? Math.round(p.getBoundingClientRect().height - 60) : 28) + 'px';
      p.append(e); return 1; })()`);
    await ev(`(document.getElementById('leftLegend').click(), 1)`);
    await settled({ until: `!document.getElementById('leftLegend').classList.contains('collapsed')`, max: UI_WAIT });
    const g = await ev(`(() => { const R = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x * 10) / 10); };
      const low = [...document.querySelectorAll('#plotL > .chip.readout')].filter((e) => e.getClientRects().length).map(R).sort((x, y) => y[3] - x[3])[0];
      return { card: R(document.getElementById('leftLegend')), readout: low, plane: R(document.getElementById('plotL')) }; })()`);
    info[`${w} ${lang}, ${tag} readout`] = g;
    if (tag === 'short') ok(`${w} ${lang}: under a short readout the card stands ${READOUT_GAP} px below it`, g.card[1] >= g.readout[3] + READOUT_GAP - SLACK && g.card[1] <= g.readout[3] + READOUT_GAP + SLACK + 1, g);
    else {
      ok(`${w} ${lang}: under a readout so tall that the drop would pass the plane's foot, the card stays ${KEY_GUTTER} px inside the foot`, g.card[3] <= g.plane[3] - KEY_GUTTER + SLACK, g);
      ok(`${w} ${lang}: the tall readout is taller than the room under it (the case is the one that needs the clamp)`, g.readout[3] + READOUT_GAP + (g.card[3] - g.card[1]) > g.plane[3] - KEY_GUTTER, g);
    }
    await ev(`(document.getElementById('leftLegend').click(), (document.getElementById('zStandIn') || { remove() {} }).remove(), 1)`);
  }
}
return { pass: !fails.length, fails, info };
