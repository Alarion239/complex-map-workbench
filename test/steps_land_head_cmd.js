// The steps view's Landscape chrome (#846): the head is one row and the height axis reads evenly.
// - the head (the plane's title, its controls, the Height key's chip, the status light) is one row, under 44 px tall, at
//   1920, 1440, 1280, 1024 and 800 px wide, in en and ru, on plane w₁ (T = w₂) and on w₂ past T (T = w₁, the longest
//   title). The Height key's chip keeps its words only where the bar fits beside them at a level that drops no words of
//   it (the scope as a menu, the colour-plane button as its wheel: SV_KEY_LEVEL); the surface button's name and the
//   title's role outrank them, and the key is its glyph (the .glyph class) otherwise. Each head's state is pinned (WORDS),
//   and on each page a head with more room (its width, which is not the window's: at 1280 px the pane is narrower than
//   at 1024) never folds a key that a head with less room shows;
// - short of room (1024 px, plane w₁, no spacer, then one of 100 and 200 px set in the head): the key keeps its words
//   with none and folds to its glyph with either, the head still one row; folded with a spacer, folded with every wider one;
// - the height axis (the last frame's labels, __cmwLandTicks) has no two labels less than 18 px apart on the screen, at
//   plane w₁ and w₂ at rest and held between them.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const headOf = () => ev(`(() => { const h = document.querySelector('#leftLegend') && document.querySelector('#leftLegend').parentNode, l = document.getElementById('leftLegend'); return h && l ? { h: Math.round(h.getBoundingClientRect().height), inHead: h.classList.contains('pane-head'), glyph: l.classList.contains('glyph'), w: Math.round(l.getBoundingClientRect().width), room: Math.round(h.clientWidth), bar: document.getElementById('svHead').className.replace('sv-head', '').trim() } : null; })()`);
// the page in lang at w px wide, the Landscape on plane p (with T at plane T, else the default T)
const open = async (w, lang, T, p) => {
  await view(w, 900, false, false);
  await go(`http://localhost:${PORT}/test.html?view=steps&lang=${lang}&ns=landchrome${w}${Date.now()}`);
  await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
  await ev(`__cmwSteps({ scope: 'in', surf: 'land'${T ? `, T: ${T}` : ''}, go: ${p}, now: true }); 1`);
  await settled({ max: 60000 });
};
// the key's state at each head: language, T, plane -> words (W) or glyph (G) at 1920, 1440, 1280, 1024 and 800 px
const WIDTHS = [1920, 1440, 1280, 1024, 800];
const WORDS = { 'en 2 1': 'WWGWW', 'en 1 2': 'WWGGG', 'ru 2 1': 'WWGGG', 'ru 1 2': 'WGGGG' };
info.head = {};
for (const lang of ['en', 'ru']) for (const [T, p] of [[2, 1], [1, 2]]) for (const w of WIDTHS) {
  await open(w, lang, T, p);
  await ev(`await ${rAF2}; 1`);
  await settled({ max: 5000 });
  const name = `${lang} ${w} px, T = ${T}, plane ${p}`, r = info.head[name] = await headOf();
  ok(`${name}: the head is one row (under 44 px)`, !!r && r.inHead && r.h < 44, r);
  const words = WORDS[`${lang} ${T} ${p}`][WIDTHS.indexOf(w)] === 'W';
  ok(`${name}: the Height key chip ${words ? 'keeps its words' : 'is its glyph'}`, !!r && (words ? !r.glyph && r.w > 60 : r.glyph && r.w < 40), r);
}
// (on each page, by the head's room: folded on a head, folded on every head with less room)
for (const key of Object.keys(WORDS)) {
  const [lang, T, p] = key.split(' '), rs = WIDTHS.map((w) => info.head[`${lang} ${w} px, T = ${T}, plane ${p}`]).filter(Boolean).sort((a, b) => b.room - a.room);
  const first = rs.findIndex((r) => r.glyph);
  ok(`${key}: a head with more room never folds a key that a head with less room shows`, first < 0 || rs.slice(first).every((r) => r.glyph), rs.map((r) => [r.room, r.glyph]));
}
// short of room: a spacer in the head, the head fitted again (a resize)
await open(1024, 'en', 2, 1);
info.spacer = {};
for (const sp of [0, 100, 200]) {
  // (spacer 0: none in the head; an element there, however narrow, takes a gap of the row)
  await ev(`(() => { const l = document.getElementById('leftLegend'); let s = document.getElementById('lhSpacer'); if (!${sp}) { if (s) s.remove(); return 1; } if (!s) { s = document.createElement('div'); s.id = 'lhSpacer'; s.style.flex = 'none'; l.parentNode.insertBefore(s, l); } s.style.width = '${sp}px'; return 1; })()`);
  await view(1025, 900, false, false);
  await ev(`await ${rAF2}; 1`);
  await view(1024, 900, false, false);
  await settled({ max: 20000 });
  await ev(`await ${rAF2}; 1`);
  const r = info.spacer[sp] = await headOf();
  ok(`spacer ${sp} px: the head is one row (under 44 px)`, !!r && r.inHead && r.h < 44, r);
  if (sp === 0) ok(`spacer ${sp} px: the Height key chip keeps its words`, !!r && !r.glyph && r.w > 60, r);
  else ok(`spacer ${sp} px: the Height key chip is folded to its glyph`, !!r && r.glyph && r.w < 40, r);
}
const sps = Object.keys(info.spacer).map(Number).sort((a, b) => a - b), firstFold = sps.findIndex((sp) => info.spacer[sp] && info.spacer[sp].glyph);
ok('the Height key chip, folded with a spacer, is folded with every wider one', firstFold < 0 || sps.slice(firstFold).every((sp) => info.spacer[sp] && info.spacer[sp].glyph), info.spacer);
// ---- the height axis ----
await open(1440, 'en', 0, 1);
info.ticks = {};
for (const x of [1, 1.5, 2]) {
  await ev(`__cmwSteps({ go: ${Math.floor(x)}, now: true }); 1`);
  await settled({ max: 60000 });
  if (x % 1) { await ev(`__cmwSteps({ x: ${x} }); 1`); await settled({ max: 60000 }); }
  await ev(`await ${rAF2}; 1`);
  const t = (await ev('JSON.stringify(__cmwLandTicks())')) || '[]';
  const ys = JSON.parse(t).sort((a, b) => a - b);
  info.ticks[x] = ys;
  const gap = ys.length > 1 ? Math.min(...ys.slice(1).map((y, i) => y - ys[i])) : 99;
  ok(`x = ${x}: the height axis has labels, none under 18 px from the next`, ys.length >= 2 && gap >= 18, ys);
}
return { pass: fails.length === 0, fails, info };
