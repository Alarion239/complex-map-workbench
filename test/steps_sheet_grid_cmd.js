// The phone's Display sheet (the colour panel): the colour style is a wrapping grid of 48 px choices with their words
// under them, four to a row at 360 px, words wrapped to two lines at most and never cut, the chosen one marked and
// ringed; the sheet stays under 60 % of the viewport; a dimmed toggle keeps the default cursor. The controls sit in groups,
// each under a small-caps label (scope, colour style, its settings, opacity, overlays), 12 px apart, the rows of a group 8 px apart.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const PHONE = 360, WIDE_PHONE = 390, PHONE_H = 780;   // (viewport widths, and the height, in px)
const STYLES = 6, PER_ROW = 4, ROWS = 2, MAX_LINES = 2;   // (the grid at 360: its styles, a row, its rows, a word's lines)
const MIN_TILE = 48, MAX_SHEET_SHARE = 0.6, DIMMED_BELOW = 0.5;   // (px, the sheet's share of the viewport, an opacity)
const GROUP_GAP = 12, ROW_GAP = 8, GROUPS = 7;   // (px between groups, px between a group's rows, the groups the sheet has: scope, style, settings, opacity, overlays, regions, quality)
const MIN_TARGET = 44, MIN_FONT = 13, SCOPE_SEGMENTS = 2, FULL_WIDTH_SLACK = 12;   // (px; the segments; px a full-width control may stop short of its group)
const NUM_CHOICES = 4;   // (the sectors n offers 8, 12, 16 and 24)
const SLIDER_LINE = 44;   // (px: the slider's touch line)
const CHOICE_TARGET = 48;   // (px: a colour-style choice)
const SETTLE_FLOOR = 300;   // (ms the page stays quiet before a state is read)
const SHEET_FLOOR = 700;   // (ms to let the sheet finish opening before it is measured)
const ns = 'svsg' + Date.now();
const st = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's2', kind: 'circle', c: [0.3, 0.2], r: 0.8, ci: 0, visible: true }],
  steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const open = async (w, lang, past) => {
  await view(w, PHONE_H, false, true);
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
const scope = () => ev(`(() => {
  const g = document.querySelector('.ph-sheet .ph-vopts .sv-sheet-scope'); if (!g) return null;
  const bs = [...g.children], r = (e) => e.getBoundingClientRect(), pr = r(g.parentElement), lh = (e) => parseFloat(getComputedStyle(e).lineHeight) || 16;
  return { n: bs.length, fullWidth: pr.width - r(g).width, minH: Math.min(...bs.map((b) => r(b).height)), minW: Math.min(...bs.map((b) => r(b).width)),
    font: Math.min(...bs.map((b) => parseFloat(getComputedStyle(b).fontSize))), lines: Math.max(...bs.map((b) => Math.round(r(b).height / lh(b)))),
    cut: bs.filter((b) => b.scrollWidth > b.clientWidth + 1).length, on: g.querySelector('[aria-checked="true"]') && g.querySelector('[aria-checked="true"]').dataset.v };
})()`);
const numChoice = () => ev(`(() => {
  const b = document.querySelector('.ph-sheet #secSel'); if (!b) return null;
  const r = b.getBoundingClientRect(), row = b.parentElement.getBoundingClientRect(), sheet = document.querySelector('.ph-sheet').getBoundingClientRect();
  return { tag: b.tagName, popup: b.getAttribute('aria-haspopup'), h: r.height, rowFree: row.right - r.right, inside: r.right <= sheet.right && r.left >= sheet.left, name: b.getAttribute('aria-label') };
})()`);
const slider = () => ev(`(() => {
  const row = document.querySelector('.ph-sheet .fader-row'); if (!row) return null;
  const rng = row.querySelector('input[type="range"]'), v = row.querySelector('.fval'), lab = row.querySelector('.fl'), r = (e) => e.getBoundingClientRect(), pr = r(row.parentElement);
  return { rowFree: pr.width - r(row).width, rngW: r(rng).width, rowW: r(row).width, rngH: r(rng).height, valRight: r(row).right - r(v).right, valLeftOfLabel: r(v).left < r(lab).right,
    tab: getComputedStyle(v).fontVariantNumeric, text: v.textContent, vt: rng.getAttribute('aria-valuetext'),
    ranges: [...document.querySelectorAll('.ph-sheet input[type="range"]')].filter((i) => i.getClientRects().length && /opacity|alpha/i.test(i.id + ' ' + i.className)).length,
    labShown: lab.getClientRects().length > 0, named: (document.getElementById(rng.getAttribute('aria-labelledby')) || {}).textContent, groupLabel: row.closest('.ph-grp').firstElementChild.textContent };
})()`);
// the sheet's controls: each visible control's kind and its name, and the targets that are too small (a checkbox is its label's target)
const controls = () => ev(`(() => {
  const sheet = document.querySelector('.ph-sheet.open'), vis = (e) => e.getClientRects().length > 0;
  const cs = [...sheet.querySelectorAll('button, select, input, [role="radio"], [role="switch"], label.check')].filter((e) => vis(e) && !e.matches('.ph-grab') && !(e.matches('input[type="checkbox"]') && e.closest('label.check')));
  const need = (e) => (e.closest('.sty-seg') ? ${CHOICE_TARGET} : ${MIN_TARGET});
  return { list: cs.map((e) => e.tagName + '#' + (e.id || '') + '.' + (e.dataset.v || e.getAttribute('aria-label') || '')),
    small: cs.filter((e) => e.getBoundingClientRect().height < need(e) - 0.5 || e.getBoundingClientRect().width < ${MIN_TARGET} - 0.5).map((e) => e.tagName + '#' + e.id + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)) };
})()`);
const groups = () => ev(`(() => {
  const gs = [...document.querySelectorAll('.ph-sheet .ph-vopts > .ph-grp')], r = (e) => e.getBoundingClientRect();
  return { n: gs.length, labelled: gs.every((g) => g.firstElementChild.matches('h3.ph-h') && g.firstElementChild.textContent.trim()),
    caps: gs.every((g) => /small-caps/.test(getComputedStyle(g.firstElementChild).fontVariantCaps)),
    gaps: gs.slice(1).map((g, i) => Math.round(r(g).top - r(gs[i]).bottom)),
    rowGap: gs.flatMap((g) => { const k = g.children.length > 2 ? [...g.children] : g.children[1].matches('.field-col') ? [g.children[0], ...g.children[1].children] : []; const v = k.filter((e) => e.getClientRects().length); return v.length > 2 ? [Math.round(r(v[2]).top - r(v[1]).bottom)] : []; }),
    first: gs.map((g) => g.firstElementChild.textContent),
    labelLefts: [...new Set(gs.map((g) => Math.round(r(g.firstElementChild).left)))], rowLefts: [...new Set(gs.map((g) => Math.round(r(g.children[1]).left)))],
    labelStyles: [...new Set(gs.map((g) => { const c = getComputedStyle(g.firstElementChild); return [c.fontSize, c.fontWeight, c.fontVariantCaps, c.letterSpacing, c.color].join('|'); }))].length };
})()`);
for (const lang of ['en', 'ru', 'it']) {
  await open(PHONE, lang, false);
  const g = await grid();
  info[lang] = g;
  ok(`${lang} 360: six styles, four to a row, two rows`, g && g.n === STYLES && g.perRow === PER_ROW && g.rows === ROWS, g);
  ok(`${lang} 360: every choice is at least 48 px both ways`, g && g.minW >= MIN_TILE && g.minH >= MIN_TILE, g);
  ok(`${lang} 360: no word is cut and none takes more than two lines`, g && g.cut === 0 && g.lines <= MAX_LINES && g.inside, g);
  ok(`${lang} 360: one choice is marked (aria-checked), with a 2 px ring inside it`, g && g.on === 1 && g.ring, g);
  ok(`${lang} 360: the sheet is at most 60 % of the viewport`, g && g.sheetShare <= MAX_SHEET_SHARE, g);
  const ctl = await controls();
  info[lang + 'Controls'] = ctl;
  ok(`${lang} 360: every control in the sheet is at least ${MIN_TARGET} px (a style choice ${CHOICE_TARGET})`, ctl.small.length === 0 && ctl.list.length > 0, ctl.small);
  const sc = await scope();
  info[lang + 'Scope'] = sc;
  ok(`${lang} 360: the scope is a full-width switch of two segments, 44 px tall, text at least 13 px, none cut`, !!sc && sc.n === SCOPE_SEGMENTS && sc.fullWidth <= FULL_WIDTH_SLACK && sc.minH >= MIN_TARGET && sc.minW >= MIN_TARGET && sc.font >= MIN_FONT && sc.cut === 0, sc);
  const sl = await slider();
  info[lang + 'Slider'] = sl;
  ok(`${lang} 360: the opacity slider is full width on a 44 px line, its value at the right in tabular figures, said as its aria-valuetext`, !!sl && sl.rowFree <= FULL_WIDTH_SLACK && sl.rowW - sl.rngW <= FULL_WIDTH_SLACK && sl.rngH >= SLIDER_LINE && sl.valRight <= FULL_WIDTH_SLACK && !sl.valLeftOfLabel && /tabular-nums/.test(sl.tab) && sl.text === sl.vt && /%/.test(sl.text), sl);
  ok(`${lang} 360: the opacity row shows no second "Opacity": the slider is named by the group's label, and it is the sheet's only opacity slider`, !!sl && !sl.labShown && !!sl.named && sl.named === sl.groupLabel && sl.ranges === 1, sl);
  const nc = await numChoice();
  info[lang + 'N'] = nc;
  ok(`${lang} 360: n is a menu button, 44 px tall, across its row, inside the sheet`, !!nc && nc.tag === 'BUTTON' && nc.popup === 'menu' && nc.h >= MIN_TARGET && nc.rowFree <= FULL_WIDTH_SLACK && nc.inside, nc);
  const gr = await groups();
  info[lang + 'Groups'] = gr;
  ok(`${lang} 360: the controls are in ${GROUPS} groups, each under a small-caps label`, gr.n === GROUPS && gr.labelled && gr.caps, gr);
  ok(`${lang} 360: every group, the mesh quality's included, has one left edge for its label and its rows, and one label style`, /Quality|Качество|Qualità/.test(gr.first[GROUPS - 1]) && gr.labelLefts.length === 1 && gr.rowLefts.length === 1 && gr.labelStyles === 1, gr);
  ok(`${lang} 360: groups are ${GROUP_GAP} px apart and a group's rows ${ROW_GAP} px`, gr.gaps.every((x) => x === GROUP_GAP) && gr.rowGap.every((x) => x === ROW_GAP), gr);
}
await open(PHONE, 'en', false);
await ev(`document.querySelector('.ph-sheet .sv-sheet-scope [data-v="in"]').click(); 1`);
await settled({ floor: SETTLE_FLOOR });
const head = await ev(`(() => { const h = document.querySelector('#svHead .sv-scope .on'); return { head: h && h.dataset.v, sheet: document.querySelector('.ph-sheet .sv-sheet-scope .on').dataset.v }; })()`);
ok('the sheet\'s scope switch sets the scope and the head\'s switch follows', head.sheet === 'in' && head.head === 'in', head);
await ev(`document.querySelector('.ph-sheet #secSel').click(); 1`);
await settled({ floor: SETTLE_FLOOR });
const menu = await ev(`(() => { const it = [...document.querySelectorAll('[role="menuitemradio"]')]; return { n: it.length, minH: Math.min(...it.map((e) => e.getBoundingClientRect().height)) }; })()`);
ok('the n menu lists its four choices, each at least 44 px tall', menu.n === NUM_CHOICES && menu.minH >= MIN_TARGET, menu);
await open(WIDE_PHONE, 'en', false);
const g390 = await grid();
ok('390: four to a row too', g390 && g390.perRow >= PER_ROW && g390.minW >= MIN_TILE, g390);
ok('390: the sheet is at most 60 % of the viewport', g390 && g390.sheetShare <= MAX_SHEET_SHARE, g390);
const c390 = await controls();
ok(`390: every control in the sheet is at least ${MIN_TARGET} px (a style choice ${CHOICE_TARGET})`, c390.small.length === 0 && c390.list.length > 0, c390.small);
// closing the sheet gives focus back to the button that opened it
await ev(`document.querySelector('.ph-dsp').focus(); document.querySelector('.ph-dsp').click(); 1`);
await settled({ floor: SHEET_FLOOR });
await key('Escape');
await settled({ floor: SHEET_FLOOR });
const back = await ev(`({ open: !!document.querySelector('.ph-sheet.open'), focus: document.activeElement && (document.activeElement.className || document.activeElement.tagName) })`);
ok('Escape closes the sheet and focus returns to the Display button', !back.open && /ph-dsp/.test(back.focus), back);
await open(PHONE, 'en', false);
const before = await controls();
await open(PHONE, 'en', true);
const after = await controls();
ok('the sheet lists the same controls, in the same order, either side of the colour plane', before.list.length > 0 && JSON.stringify(before.list) === JSON.stringify(after.list), { before: before.list, after: after.list });
const cur = await ev(`(() => { const l = document.querySelector('.ph-sheet label.check[aria-disabled="true"]'); return l && { cursor: getComputedStyle(l).cursor, opacity: getComputedStyle(l).opacity }; })()`);
ok('a toggle that does not apply keeps the default cursor, dimmed', !!cur && cur.cursor === 'default' && +cur.opacity < DIMMED_BELOW, cur);
// a style chosen in the open sheet refills it: the settings that style has (n for Tiles, the grid step for Grid) replace the old style's
const styleControls = () => ev(`(() => ({ n: !!document.querySelector('.ph-sheet #secSel'), step: !!document.querySelector('.ph-sheet #dcGridSel'),
  checked: (document.querySelector('.ph-sheet .sty-seg [aria-checked="true"]') || {}).dataset && document.querySelector('.ph-sheet .sty-seg [aria-checked="true"]').dataset.v }))()`);
const pickStyle = async (v) => { await ev(`document.querySelector('.ph-sheet .sty-seg [data-v="${v}"]').click(); 1`); await settled({ floor: SETTLE_FLOOR }); };
await open(PHONE, 'en', false);
const tiles = await styleControls();
ok('the sheet opens on Tiles with n and no grid step', tiles.checked === 'enhanced' && tiles.n && !tiles.step, tiles);
await pickStyle('grid');
const gridSt = await styleControls();
ok('choosing Grid in the open sheet replaces n by the grid step', gridSt.checked === 'grid' && !gridSt.n && gridSt.step, gridSt);
const kept = await ev(`document.activeElement && document.activeElement.closest('.sty-seg') && document.activeElement.dataset.v`);
ok('the chosen style keeps the focus after the sheet is refilled', kept === 'grid', kept);
await pickStyle('enhanced');
const backTiles = await styleControls();
ok('choosing Tiles again brings n back and takes the grid step away', backTiles.checked === 'enhanced' && backTiles.n && !backTiles.step, backTiles);
return { pass: fails.length === 0, fails, info };
