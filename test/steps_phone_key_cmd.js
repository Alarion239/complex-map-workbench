// The steps view's per-plane key on a phone (portrait: 412 x 860, 360 x 740 and 320 x 640 in English, 320 x 640 in Russian; landscape:
// 740 x 360 in English and 667 x 375 in Russian; touch): example 1 with the thread parked at each plane
// and the colour plane T at each plane (the sweep of test/lib/plane_key_kit.js, which also checks the legend's kind and
// caption against the laptop's key). On the phone the key is a folded glyph on the plane that a tap unfolds into the card (a
// second tap folds it); the glyph and the card are each whole (inside the plane and the screen) and nothing else covers them
// (the topmost element at the middle and near the four corners, inside the rounded corners, is the key). The folded glyph is
// 30 px with a 44 px hit area: the topmost element at its centre and 21.5 px out from it on each side is the key, and the padded box
// (the glyph 7 px out on each side) meets no other button. The unfolded card meets no button of the plane's right-hand
// column or head, at any of the widths.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const K = eval(fs.readFileSync(path.join(DIR, '..', 'lib', 'plane_key_kit.js'), 'utf8'));
const fails = [], info = {};
const PAD = 7;       // the hit area's reach beyond the 30 px glyph on each side (44 = 30 + 2 x 7), px: the folded key's ::before, whose inset is measured from the padding box, so the page's value is PAD + the glyph's border
const OUT = 21.5;    // how far out from the glyph's centre the hit probes go, px: inside the 44 px area (22 from the centre), outside a 42 px one
const UI_WAIT = 5000;   // how long a toast may take to go and the card to unfold, ms
const WIDTHS = [[412, 860, 'en'], [360, 740, 'en'], [320, 640, 'en'], [320, 640, 'ru'], [740, 360, 'en'], [667, 375, 'ru']];   // width, height, language (the last two are landscape phones)
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
    // (how far the invisible ::before reaches beyond the glyph's border box on each side: its inset from the padding box less the border)
    reach: (() => { const bs = getComputedStyle(k), ps = getComputedStyle(k, '::before'), bw = parseFloat(bs.borderTopWidth) || 0;
      return ['top', 'right', 'bottom', 'left'].map((d) => r(-parseFloat(ps[d]) - bw)); })(),
    // (the readout chip of the plane: the folded key stands clear of it)
    readout: (() => { const ro = document.getElementById('leftReadout'); if (!ro || !ro.getClientRects().length) return null; return touches(ro.getBoundingClientRect(), 0); })(),
    // (the 44 px hit area: the key on top at the centre and 21.5 px out from it on each side, the padded box clear of every other button)
    hit: [[0, 0], [-${OUT}, 0], [${OUT}, 0], [0, -${OUT}], [0, ${OUT}]].map(([dx, dy]) => onTop(b.left + b.width / 2 + dx, b.top + b.height / 2 + dy)),
    meets: [...document.querySelectorAll('button, [role="button"], a[href], input, select, summary')].filter((e) => e.getClientRects().length && !k.contains(e)).map((e) => { const q2 = e.getBoundingClientRect(); return { e, q2 }; })
      .filter(({ q2 }) => q2.width > 0 && touches(q2, ${pad})).map(({ e }) => (e.id || e.className || e.tagName) + '') };
})()`);
for (const [w, h, lang] of WIDTHS) {
  await view(w, h, false, true);
  const nPl = await K.open('phonekey' + w + lang, PORT, lang);
  ok(`${w} ${lang}: the phone layout`, await ev('!!Phone._state().on'), null);
  ok(`${w} ${lang}: ${w > h ? 'a landscape phone has' : 'a portrait phone has no'} ph-land`, (await ev("document.documentElement.classList.contains('ph-land')")) === (w > h), null);
  ok(`${w} ${lang}: example 1 has three planes`, nPl === 3, nPl);
  // (the example's toast is a transient overlay on the plane, over a short landscape plane too: it is dismissed, as it times out on a real page, so the probe reads the key and the buttons)
  await ev(`(document.querySelectorAll('.toast .toast-x, .toast-x').forEach((b) => b.click()), 1)`);
  await settled({ until: `!document.querySelector('.toast')`, max: UI_WAIT });
  await K.sweep(ok, info, nPl, async (name, lg) => {
    name = `${w} ${lang}, ${name}`;
    const pr = await probe(PAD);
    info[name] = { lg, pr };
    ok(`${name}: the folded key shows on the phone, whole, and nothing covers it`, pr.shown && pr.collapsed && pr.inPlane && pr.onScreen && pr.top.every((t) => t === ''), pr);
    ok(`${name}: the folded key's hit area reaches ${PAD} px past the glyph on each side, as the suite measures it`, pr.reach.every((x) => x === PAD), pr.reach);
    ok(`${name}: the folded key does not cover the readout chip`, !pr.readout, pr.readout);
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
}
return { pass: !fails.length, fails, info };
