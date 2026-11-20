// The phone's hint card over the globe (X's readout chip while the globe is shown: "Drag to turn, tap a shape to select it; …") stays
// clear of the globe: its rectangle does not meet the disk of the sphere (the top edge) and does not hide the sphere's `i` mark. Over the
// portrait and landscape phone sizes in English, Russian and Italian (the longest words). The globe's disk is the app's own: the
// pane's centre and the radius globeCam gives, from the camera. A command file for a CDP daemon (test/cdp_kit README); prints
// { pass, fails, info }. With a construction tool picked on the landscape globe, the construction chip stands clear of the hint card too (the last block).
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const POINTS = [[740, 360, 'en'], [915, 412, 'en'], [667, 375, 'en'], [320, 568, 'en'], [320, 568, 'ru'], [360, 640, 'en'], [360, 640, 'ru'], [360, 640, 'it'], [390, 844, 'ru'], [740, 360, 'ru'], [740, 360, 'it'], [915, 412, 'ru']];
for (const [w, h, lang] of POINTS) {
  const name = `${w}x${h} ${lang}`;
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=hg${w}${Date.now()}`);
  await settled({ max: 30000, until: `typeof __cmwSteps === "function" && !!window.GLR` });
  await ev(`__cmwSteps({ surf: 'sphere', go: 0, now: true }); 1`);
  await settled({ max: 30000, until: `!!document.querySelector('#leftReadout .rglobe') && !!__cmwGlobeXY('L', 0, 1)` });
  const m = info[name] = await ev(`(() => {
    const cv = document.getElementById('canvasL').getBoundingClientRect(), R = __cmwGlobeDisk('L').R;
    const ch = document.getElementById('leftReadout').getBoundingClientRect(), cx = cv.left + cv.width / 2, cy = cv.top + cv.height / 2;
    const nx = Math.max(ch.left, Math.min(cx, ch.right)), ny = Math.max(ch.top, Math.min(cy, ch.bottom)), i = __cmwGlobeXY('L', 0, 1);
    return { R: Math.round(R), chip: [ch.left, ch.top, ch.right, ch.bottom].map(Math.round), gap: Math.round(Math.hypot(nx - cx, ny - cy) - R), i: i && i.map(Math.round),
      iHidden: !!i && i[0] >= ch.left && i[0] <= ch.right && i[1] >= ch.top && i[1] <= ch.bottom, shown: ch.width > 0 };
  })()`);
  ok(`${name}: the hint card is on the page`, m.shown, m);
  ok(`${name}: the hint card is clear of the globe's disk (gap ≥ 0 px)`, m.gap >= 0, m);
  ok(`${name}: the hint card does not hide the i mark`, m.i && !m.iHidden, m);
}
// With a construction tool picked on the globe, the construction chip ("Switch to the plane to pick the curve · Perpendicular ×")
// stands over the same corner as the hint card (in landscape the same left column, and the plane has no room for both: 106 px tall at 320 px;
// in portrait the card's wrap reaches the chip's rows): the card gives way while the
// chip stands, so no line of it shows behind the chip's words. The card is clear of the disk, hidden or not (in portrait, while it shows: a hidden hint's
// wrap may reach the disk), and it is back when the chip's × cancels the tool. Perpendicular has the tall context bar. Every landscape and portrait phone size, in English, Russian and Italian, light and then dark
// (the same page, its colours switched). In portrait the chip takes the hidden card's place, 8 px under the plane's top, clear of the folded key's hit area.
const CHIP_CASES = [[568, 320], [600, 320], [640, 360], [667, 375], [740, 360], [320, 568], [360, 640], [390, 844]];
const CHIP_TOP = 8;   // a portrait plane's construction chip stands this far under the plane's top while the hint card is hidden, px
const meets = (a, b) => Math.min(a[2], b[2]) - Math.max(a[0], b[0]) > 0.5 && Math.min(a[3], b[3]) - Math.max(a[1], b[1]) > 0.5;
const cardChip = () => ev(`(() => {
  const box = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom].map((x) => Math.round(x * 10) / 10); };
  const cv = document.getElementById('canvasL').getBoundingClientRect(), R = __cmwGlobeDisk('L').R, cx = cv.left + cv.width / 2, cy = cv.top + cv.height / 2;
  const card = document.getElementById('leftReadout'), chip = document.getElementById('draftChipL'), c = card.getBoundingClientRect();
  const nx = Math.max(c.left, Math.min(cx, c.right)), ny = Math.max(c.top, Math.min(cy, c.bottom));
  const key = document.getElementById('leftLegend'), kb = key && key.getClientRects().length ? key.getBoundingClientRect() : null;
  return { card: box(card), chip: box(chip), plotTop: Math.round(document.getElementById('plotL').getBoundingClientRect().top * 10) / 10, keyBox: kb && [kb.left - 8, kb.top - 8, kb.right + 8, kb.bottom + 8].map((v) => Math.round(v * 10) / 10), cardShown: c.width > 0, cardVisible: getComputedStyle(card).visibility !== 'hidden', chipShown: chip.getClientRects().length > 0,
    gap: Math.round(Math.hypot(nx - cx, ny - cy) - R) };
})()`);
for (const [w, h] of CHIP_CASES) for (const lang of ['en', 'ru', 'it']) {
  await view(w, h, false, true);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=hc${w}${Date.now() % 100000}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR && !!document.querySelector("#constructTools .tool[data-tool=perp]")' });
  await ev(`__cmwSteps({ surf: 'sphere', go: 0, now: true }); 1`);
  await settled({ max: 30000, until: `!!document.querySelector('#leftReadout .rglobe') && !!window.__cmwGlobeDisk` });
  await ev(`document.querySelector('#constructTools .tool[data-tool="perp"]').click(); 1`);
  await settled({ max: 20000, until: 'document.documentElement.classList.contains("ph-ctx-tall") && !!document.querySelector(".ph-ctx.in") && !document.getElementById("draftChipL").hidden' });
  for (const dark of [false, true]) {
    if (dark) { await view(w, h, true, true); await settled({ max: 10000, until: 'matchMedia("(prefers-color-scheme: dark)").matches && !document.getElementById("draftChipL").hidden' }); }
    const name = `${w}x${h} ${lang} ${dark ? 'dark' : 'light'}, Perpendicular on the globe`;
    const m = info[name] = await cardChip();
    ok(`${name}: the construction chip is shown`, m.chipShown, m);
    ok(`${name}: the hint card shows no line behind the chip (hidden, or clear of it)`, !m.cardVisible || !meets(m.card, m.chip), m);
    // in portrait the chip takes the hidden card's place at the plane's top, and stays clear of the folded key's hit area (8 px out from the glyph)
    if (h > w) {
      ok(`${name}: the chip stands ${CHIP_TOP} px under the plane's top, where the hidden card was`, Math.abs(m.chip[1] - m.plotTop - CHIP_TOP) <= 0.5, m);
      ok(`${name}: the chip is clear of the folded key's hit area`, !m.keyBox || !meets(m.chip, m.keyBox), m);
    }
    ok(`${name}: the hint card is clear of the globe's disk (gap ≥ 0 px${h > w ? ' while it shows' : ''})`, (h > w && !m.cardVisible) || m.gap >= 0, m);
    // a finger's reach: 21.5 px out from the centre of the chip's × and of its ?, each way (inside a 44 px square), still lands on that button, or on another control that stands there (the context bar's: a neighbour's tap wins over the chip's reach)
    const reach = info[`${name} reach`] = await ev(`(() => {
      const out = {};
      for (const cls of ['cm-x', 'cm-q']) {
        const b = document.querySelector('#draftChipL .' + cls);
        if (!b) { out[cls] = null; continue; }
        const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = ([dx, dy]) => document.elementFromPoint(cx + dx, cy + dy);
        out[cls] = { size: [Math.round(r.width), Math.round(r.height)], miss: [[-21.5, 0], [21.5, 0], [0, -21.5], [0, 21.5]].filter((d) => {
          const at = hit(d);
          return !(at && (b.contains(at) || at.closest('button, .ph-ct')));
        }).map((d) => d.join(',') + ' → ' + ((e) => e ? e.tagName + '.' + e.className : 'nothing')(hit(d))) };
      }
      return out;
    })()`);
    ok(`${name}: the chip's × is there`, !!reach['cm-x'], reach);
    for (const cls of ['cm-x', 'cm-q']) if (reach[cls]) ok(`${name}: 21.5 px from the centre of the chip's ${cls === 'cm-x' ? '×' : '?'}, each way, reaches it or a control beside it`, reach[cls].miss.length === 0, reach[cls]);
  }
  // the chip's × cancels the tool: the hint card is back
  await ev(`document.querySelector('#draftChipL .cm-x').click(); 1`);
  await settled({ max: 10000, until: 'document.getElementById("draftChipL").hidden' });
  const back = info[`${w}x${h} ${lang}, tool cancelled`] = await cardChip();
  ok(`${w}x${h} ${lang}: the hint card is back when the tool is cancelled`, back.cardVisible && back.cardShown, back);
}
return { pass: fails.length === 0, fails, info };
