// The target legend of the steps view (behind ?view=steps): a note in the plane's head that says where what the plane
// draws or shades comes from, named by the plane that holds the targets ("Drawn from w₂'s targets"):
// - a curve target on w₂ and the view on z or on w₁: the note says drawn, never shaded, with the map in its tooltip;
// - on w₂, the plane that holds the target, there is no note;
// - an area target says shaded, and both kinds say shaded and drawn;
// - the note is a note, not a live region (role="note"); several source planes are joined by the language's own "and";
// - at 1280 in Russian the note is whole, or folded to its icon and the source planes' names, or to its icon alone, never cut,
//   and the head stays one row; a folded note that shows names shows exactly the planes it comes from;
// - on a phone the Display sheet's first line holds it, and the head has none.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ns = 'svtl' + Date.now();
const CURVE = { id: 't1', kind: 'circle', c: [1, 0], r: 1.5, ci: 0, visible: true, stage: 2 };
const CURVE1 = { id: 't3', kind: 'circle', c: [0, 1], r: 0.5, ci: 2, visible: true, stage: 1 };
const AREA = { id: 't2', kind: 'disc', c: [0, 0], r: 1, ci: 1, visible: true, stage: 2 };
const state = (shapes) => ({ v3: true, v4: true, v5: true, v6: true, shapes, steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' }, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } });
const open = async (w, h, touch, lang, shapes) => {
  await view(w, h, false, touch);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await settled({ panes: false });
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(state(shapes)))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwSteps === 'function' && !!document.querySelector('#svStrip .sv-wholemap')` });
};
const goTo = async (k) => { await ev(`__cmwSteps({ go: ${k}, now: true }); 1`); await settled({ floor: 600 }); };
const note = () => ev(`(() => { const e = document.querySelector('.sv-tnote'); if (!e) return null; const nm = e.querySelector('.sv-tn-n'); const chipNames = getComputedStyle(nm).display !== 'none' ? nm.textContent : ''; const h = document.querySelector('#paneL .pane-head'); const r = e.getBoundingClientRect(); return { role: e.getAttribute('role'), chipNames, shown: !e.hidden && e.getClientRects().length > 0, text: e.querySelector('.sv-tn-t').textContent, folded: e.classList.contains('tn-icon'), label: e.getAttribute('aria-label') || '', tip: e.getAttribute('data-tip') || '', cut: e.scrollWidth > e.clientWidth + 1, headH: Math.round(h.getBoundingClientRect().height), inside: r.right <= h.getBoundingClientRect().right + 0.5 }; })()`);

await open(1440, 900, false, 'en', [CURVE]);
for (const k of [0, 1]) {
  await goTo(k);
  const n = await note();
  ok(`en, plane ${k}: a curve target on w₂ reads "Drawn from w₂'s targets"`, n && n.shown && n.text === 'Drawn from w₂’s targets'.replace('’', "'") , n);
  ok(`en, plane ${k}: it is a note, not a live region`, n && n.role === 'note', n);
  ok(`en, plane ${k}: it never says shaded, and its tooltip says the curves are drawn here`, n && !/shaded/i.test(n.text + n.tip + n.label) && /are drawn here/.test(n.tip), n);
}
await goTo(2);
const own = await note();
ok('en: on w₂, the plane that holds the target, there is no note', own && !own.shown, own);

await open(1440, 900, false, 'en', [AREA]);
await goTo(0);
const sh = await note();
ok('en: an area target reads "Shaded from w₂\'s targets"', sh && sh.shown && sh.text === "Shaded from w₂'s targets", sh);
await open(1440, 900, false, 'en', [CURVE, CURVE1]);
await goTo(0);
const multi = await note();
ok('en: curves on w₁ and w₂ read "Drawn from the targets of w₁ and w₂"', multi && multi.shown && multi.text === 'Drawn from the targets of w₁ and w₂', multi);
await open(1440, 900, false, 'en', [CURVE, AREA]);
await goTo(0);
const both = await note();
ok('en: both kinds read "Shaded and drawn from w₂\'s targets"', both && both.shown && both.text === "Shaded and drawn from w₂'s targets", both);

await open(1280, 800, false, 'ru', [CURVE]);
await goTo(0);
const ru = await note();
ok('ru 1280: the note is the ruled words, whole or folded to its icon, never cut, in a one-row head', ru && ru.shown && ru.text === 'Нарисовано по целям w₂' && !ru.cut && ru.inside && ru.headH <= 48 && ru.label.startsWith('Нарисовано по целям w₂'), ru);
ok('ru 1280: a folded note that shows names shows w₂', ru && (!ru.chipNames || ru.chipNames === 'w₂'), ru);
info.ru = ru;
await open(1280, 800, false, 'ru', [CURVE, AREA]);
await goTo(0);
const ruBoth = await note();
ok('ru: areas and curves read «Закрашено и нарисовано по целям w₂»', ruBoth && ruBoth.text === 'Закрашено и нарисовано по целям w₂', ruBoth);

await open(390, 780, true, 'en', [CURVE]);
await goTo(0);
const phHead = await note();
ok('phone: the head has no note', phHead && !phHead.shown, phHead);
await ev(`document.querySelector('.ph-dsp').click(); 1`);
await settled({ floor: 600 });
const sheet = await ev(`(() => { const l = document.querySelector('.ph-tnote'); const first = l && l.parentElement && l.parentElement.firstElementChild === l; return l ? { text: l.textContent, role: l.getAttribute('role'), first, shown: l.getClientRects().length > 0 } : null; })()`);
ok('phone: the Display sheet\'s first line holds the words', sheet && sheet.shown && sheet.first && sheet.text === "Drawn from w₂'s targets" && sheet.role === 'note', sheet);
return { pass: fails.length === 0, fails, info };
