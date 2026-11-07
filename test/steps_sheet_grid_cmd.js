// The phone's Display sheet (the colour panel): the colour style is a wrapping grid of 48 px choices with their words
// under them, four to a row at 360 px, words wrapped to two lines at most and never cut, the chosen one marked and
// ringed; the
// sheet stays under 60 % of the viewport; a dimmed toggle keeps the default cursor.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const SHEET_FLOOR = 700;   // (ms to let the sheet finish opening before it is measured)
const ns = 'svsg' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const open = async (w, lang, past) => {
  await view(w, 780, false, true);
  await loadView('steps', ns + lang + w + (past ? 'p' : ''), st, { lang });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
  if (past) {
    await ev(`document.querySelector('.sv-cp').click(); 1`);
    await settled({});
    await ev(`document.querySelector('#svStrip .sv-plane[data-i="1"]').click(); 1`);
    await settled({ max: 15000, until: `__cmwSteps().stage === 1 && !__cmwSteps().moving` });
  }
  await ev(`document.querySelector('.ph-dsp').click(); 1`);
  await settled({ floor: SHEET_FLOOR });
};
const grid = () => ev(`(() => {
  const g = document.querySelector('.ph-sheet .sty-seg'); if (!g) return null;
  const bs = [...g.querySelectorAll(':scope > button')], r = (e) => e.getBoundingClientRect();
  const tops = [...new Set(bs.map((b) => Math.round(r(b).top)))];
  const lh = (e) => parseFloat(getComputedStyle(e).lineHeight) || 13;
  const cut = bs.filter((b) => b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1).length;
  const lines = Math.max(...bs.map((b) => { const t = b.querySelector('.sty-n'); return t ? Math.round(r(t).height / lh(t)) : 1; }));
  const sheet = document.querySelector('.ph-sheet').getBoundingClientRect();
  return { n: bs.length, rows: tops.length, perRow: bs.filter((b) => Math.round(r(b).top) === tops[0]).length,
    minW: Math.min(...bs.map((b) => r(b).width)), minH: Math.min(...bs.map((b) => r(b).height)), cut, lines,
    on: bs.filter((b) => b.getAttribute('aria-checked') === 'true').length,
    ring: bs.filter((b) => b.getAttribute('aria-checked') === 'true').every((b) => /inset/.test(getComputedStyle(b).boxShadow) && /2px/.test(getComputedStyle(b).boxShadow)),
    sheetShare: sheet.height / innerHeight, inside: bs.every((b) => r(b).left >= g.getBoundingClientRect().left - 1 && r(b).right <= g.getBoundingClientRect().right + 1) };
})()`);
for (const lang of ['en', 'ru', 'it']) {
  await open(360, lang, false);
  const g = await grid();
  info[lang] = g;
  ok(`${lang} 360: six styles, four to a row, two rows`, g && g.n === 6 && g.perRow === 4 && g.rows === 2, g);
  ok(`${lang} 360: every choice is at least 48 px both ways`, g && g.minW >= 48 && g.minH >= 48, g);
  ok(`${lang} 360: no word is cut and none takes more than two lines`, g && g.cut === 0 && g.lines <= 2 && g.inside, g);
  ok(`${lang} 360: one choice is marked (aria-checked), with a 2 px ring inside it`, g && g.on === 1 && g.ring, g);
  ok(`${lang} 360: the sheet is at most 60 % of the viewport`, g && g.sheetShare <= 0.6, g);
}
await open(390, 'en', false);
const g390 = await grid();
ok('390: four to a row too', g390 && g390.perRow >= 4 && g390.minW >= 48, g390);
await open(360, 'en', true);
const cur = await ev(`(() => { const l = document.querySelector('.ph-sheet label.check[aria-disabled="true"]'); return l && { cursor: getComputedStyle(l).cursor, opacity: getComputedStyle(l).opacity }; })()`);
ok('a toggle that does not apply keeps the default cursor, dimmed', !!cur && cur.cursor === 'default' && +cur.opacity < 0.5, cur);
return { pass: fails.length === 0, fails, info };
