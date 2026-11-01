// A control the focus scrolls into view is left room for its focus ring (#601): on a phone at 360 × 780 with the tour's
// Constructions step open (the Tools sheet's tiles end exactly at the scroller's foot), focusing the Formula tile the way a
// keyboard does (the browser scrolls it into view) leaves its 3 px ring inside the scroller, light and dark. The layout
// suite's focus-ring check reads the control's scroll-margin instead of scrolling (it focuses with preventScroll), so this is
// the proof that the browser does what that check assumes.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
for (const dark of [false, true]) {
  const tag = dark ? 'dark' : 'light';
  await view(360, 780, dark, true);
  await nav(`http://localhost:${PORT}/test.html?ns=pfm${tag}${Date.now() % 100000}`);
  await sleep(4500);
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false);
    const T = Tour._t, c = T.CHAPTERS.find((x) => x.id === 'construct'); let best = 0, len = -1;
    c.steps.forEach((st, i) => { const n = (T.leadFor(st) || '').length + (T.copyFor(st, null) || '').length + (st.try ? (T.tryFor(st.try) || '').length : 0); if (n > len) { len = n; best = i; } });
    Tour.start({ chapter: 'construct', step: best }); return best; })()`);
  await sleep(3000);
  const g = await ev(`(() => {
    const sh = document.querySelector('.ph-sheet.open'), sb = sh && sh.querySelector('.ph-sb:not([hidden])');
    const f = [...document.querySelectorAll('.ph-tile')].find((t) => /Formula/.test(t.textContent));
    if (!sb || !f) return null;
    const before = sb.scrollTop;
    f.focus({ focusVisible: true });
    const q = sb.getBoundingClientRect(), b = f.getBoundingClientRect(), cs = getComputedStyle(f);
    const grow = (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0);
    return { before, after: sb.scrollTop, canScroll: sb.scrollHeight > sb.clientHeight + 1, room: q.bottom - b.bottom, grow, margin: cs.scrollMarginBottom, focused: document.activeElement === f };
  })()`);
  await sleep(300);
  info[tag] = g;
  ok(`${tag}: the Tools sheet and its Formula tile are there`, !!g && g.focused, g);
  if (g) ok(`${tag}: after the focus scrolled it, the Formula tile's ring (${g && g.grow} px) fits above the scroller's foot`, g.room >= g.grow - 0.5, g);
}
return { pass: fails.length === 0, fails, info };
