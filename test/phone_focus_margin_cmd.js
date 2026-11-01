// Keyboard focus leaves a control room for its focus ring: on a phone at 360 × 780 with the tour's Constructions step
// open (the Tools sheet's tiles end exactly at the scroller's foot), Tab to the Formula tile, the last row, scrolls it into the
// scroller far enough that its 3 px ring (2 px outline, 1 px offset) is not cut at the foot, light and dark. This is the page's own
// rule (`:focus-visible { scroll-margin: 8px }`, src/page.html) at work, and what the layout suite's focus-ring check assumes:
// it focuses with preventScroll, so it reads the control's scroll-margin instead of the scroll (test/lib/layout.js).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, got) => { if (!pass) fails.push({ name, got }); };
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
for (const dark of [false, true]) {
  const tag = dark ? 'dark' : 'light';
  await view(360, 780, dark, true);
  await go(`http://localhost:${PORT}/test.html?ns=pfm${tag}${Date.now() % 100000}`);
  await settled({ until: `typeof Tour !== 'undefined' && !!window.Phone && Phone.isOn()` });
  await ev(`(() => { Tour.dismissSuggestion(); Tour.auto(false);
    const T = Tour._t, c = T.CHAPTERS.find((x) => x.id === 'construct'); let best = 0, len = -1;
    c.steps.forEach((st, i) => { const n = (T.leadFor(st) || '').length + (T.copyFor(st, null) || '').length + (st.try ? (T.tryFor(st.try) || '').length : 0); if (n > len) { len = n; best = i; } });
    Tour.start({ chapter: 'construct', step: best }); return best; })()`);
  // the step has opened the Tools sheet with its tiles
  await settled({ until: `(() => { const sb = document.querySelector('.ph-sheet.open .ph-sb:not([hidden])'); return !!sb && [...sb.querySelectorAll('.ph-tile')].some((t) => /Formula/.test(t.textContent)); })()` });
  // the tile before Formula, focused without scrolling; then the keyboard moves on to Formula
  const pre = await ev(`(() => {
    const sb = document.querySelector('.ph-sheet.open .ph-sb:not([hidden])');
    if (!sb) return null;
    sb.scrollTop = 0;
    const t = [...sb.querySelectorAll('.ph-tile')], i = t.findIndex((x) => /Formula/.test(x.textContent));
    if (i < 1) return null;
    t[i - 1].focus({ preventScroll: true });
    return { canScroll: sb.scrollHeight > sb.clientHeight + 1, top: sb.scrollTop };
  })()`);
  ok(`${tag}: the Tools sheet is open with the Formula tile after another`, !!pre, pre);
  if (!pre) continue;
  await key('Tab');
  await settled({ until: `/Formula/.test((document.activeElement || {}).textContent || '')` });
  const g = await ev(`(() => {
    const sb = document.querySelector('.ph-sheet.open .ph-sb:not([hidden])');
    const f = [...document.querySelectorAll('.ph-tile')].find((t) => /Formula/.test(t.textContent));
    const q = sb.getBoundingClientRect(), b = f.getBoundingClientRect(), cs = getComputedStyle(f);
    return { top: sb.scrollTop, room: q.bottom - b.bottom, grow: (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0), margin: cs.scrollMarginBottom, focused: document.activeElement === f, visible: f.matches(':focus-visible') };
  })()`);
  info[tag] = Object.assign({ pre }, g);
  ok(`${tag}: Tab reaches the Formula tile and shows its focus ring`, g.focused && g.visible, g);
  ok(`${tag}: the focus scrolled the tile clear of the scroller's foot by the page's scroll-margin`, g.room >= g.grow - 0.5, g);
}
return { pass: fails.length === 0, fails, info };
