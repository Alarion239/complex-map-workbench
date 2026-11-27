// A phone's message keeps all its words and its layout (#1686): the longest messages need three lines at 360 × 640 (Italian and Russian), and
// are not cut at two; a message that stays up through a rotation takes the rows its new width needs.
//  - at 360 × 640 in the steps view, with no sheet open (over the plot) and with the Display sheet open (over its row): the words of the longest it and ru
//    messages are not cut (`scrollHeight - clientHeight` of the words ≤ 1) and are at most three lines; the message is inside the window;
//  - (#1685) with no sheet open at 390 × 844 and 360 × 740, en and ru: a long message over the plot has its words whole and `data-rows` is what is drawn;
//  - a message of two rows at 360 × 640 that stays up while the phone turns to 740 × 360 has one row beside its buttons, and the other way
//    round; with the Menu sheet open it has one row after the turn too, and with the Display sheet open, whose column's foot it takes in landscape
//    (360 px), two: `data-rows` is what is drawn (the buttons beside the words, or under them).
//  - (#2567) at 390 × 844 in en, ru and it, over the plot: the Landscape's message (the Sphere key's reason, with its ×) fits in two lines beside
//    its ×, so it is one row: the × beside the words, and the message no taller than its words and × beside them need (a message that
//    takes the × to a row of its own under two lines is 44 px taller).
// In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const LONGEST = {
  it: ['Figura del link aperta. Non è stato possibile leggere alcune costruzioni: sono state aperte come figure semplici.', 'Annulla'],
  ru: ['Все листы: высота теперь равна Im f₂(z), а перезагрузка стёрла бы вашу работу, поэтому язык интерфейса не изменён.', 'Отменить'],
};
const SHORTISH = 'Added f₃: Exponential, and a longer second part that needs three lines beside its buttons';   // (more than two lines beside its buttons at 360 px: two rows; two lines at most beside them at 740 px: one row)
const MAX_LINES = 3, CUT_MAX = 1, STILL_MS = 150, SETTLE_MAX = 5000;
const measure = () => ev(`(() => {
  const host = document.getElementById('toastHost'), t = host && host.querySelector('.toast'); if (!t) return null;
  const sp = t.querySelector(':scope > span'), tb = t.getBoundingClientRect(), sb = sp.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(sp);
  const tops = [...rg.getClientRects()].map((r) => Math.round(r.top)).filter((y, i, a) => a.indexOf(y) === i).length;
  const btns = [...t.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect());
  const cs = getComputedStyle(t), btnH = btns.length ? Math.max(...btns.map((r) => r.height)) : 0;
  const need = Math.max(sb.height, btnH) + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  return { rows: t.dataset.rows || null, cut: sp.scrollHeight - sp.clientHeight, lines: tops, h: tb.height, need: Math.max(need, parseFloat(cs.minHeight) || 0), placed: host.dataset.placed || null, toast: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), wordsBottom: sb.bottom, btnTop: btns.length ? Math.min(...btns.map((r) => r.top)) : null,
    win: tb.left >= -0.5 && tb.right <= innerWidth + 0.5 && tb.top >= -0.5 && tb.bottom <= innerHeight + 0.5 };
})()`);
const still = async () => { let a = JSON.stringify(await measure()); for (let i = 0; i < SETTLE_MAX / STILL_MS; i++) { await sleep(STILL_MS); const b = JSON.stringify(await measure()); if (a === b) return JSON.parse(b); a = b; } return JSON.parse(a); };
const open = async (w, h, lang) => {
  await view(w, h, false, true);
  const ns = 'ptl' + w + lang + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwToast === 'function' && !!window.Phone && Phone.isOn() && document.getElementById('svStrip').getBoundingClientRect().height > 0` });
};
const show = (msg, label) => ev(`(__cmwToast(${JSON.stringify(msg)}, ${JSON.stringify(label)}, { sticky: true }), 1)`);
// ---- the longest messages keep their third line
for (const lang of ['it', 'ru']) for (const sheet of [false, true]) {
  const tag = `${lang} 360×640 ${sheet ? 'over the Display sheet' : 'over the plot'}`;
  await open(360, 640, lang);
  if (sheet) { await ev(`Phone.open('display'), 1`); await settled({ panes: false, until: `!!document.querySelector('.ph-sheet[data-k="display"].open')` }); }
  await show(LONGEST[lang][0], LONGEST[lang][1]);
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]')` });
  const m = await still();
  info[tag] = m;
  ok(`${tag}: the message shows`, !!m, m);
  if (!m) continue;
  ok(`${tag}: it takes two rows (the words full width)`, m.rows === 'two', m.rows);
  ok(`${tag}: the words are not cut`, m.cut <= CUT_MAX, { cut: m.cut, lines: m.lines });
  ok(`${tag}: the words are at most ${MAX_LINES} lines`, m.lines <= MAX_LINES, m.lines);
  ok(`${tag}: the message is inside the window`, m.win, m.toast);
}
// ---- #1685: with no sheet open the message over the plot takes the two-row rule too (words whole, buttons under them at the right), at 390 × 844 and 360 × 740
const OPENED = { en: ['Opened the figure from the link. Some constructions could not be read and were opened as plain figures.', 'Undo'], ru: ['Фигура по ссылке открыта. Некоторые построения не удалось прочитать, они открыты как простые фигуры.', 'Отменить'] };
for (const lang of ['en', 'ru']) for (const [w, h] of [[390, 844], [360, 740]]) {
  const tag = `${lang} ${w}×${h} over the plot, no sheet`;
  await open(w, h, lang);
  await show(OPENED[lang][0], OPENED[lang][1]);
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]') && document.getElementById('toastHost').dataset.placed === 'phone-plot'` });
  const m = await still();
  info[tag] = m;
  ok(`${tag}: the message lies over the plot`, !!m && m.placed === 'phone-plot', m);
  if (!m) continue;
  ok(`${tag}: the words are not cut and are at most ${MAX_LINES} lines`, m.cut <= CUT_MAX && m.lines <= MAX_LINES, { cut: m.cut, lines: m.lines });
  ok(`${tag}: data-rows is what is drawn (${m.rows}: the buttons ${m.rows === 'two' ? 'under' : 'beside'} the words)`, m.btnTop !== null && (m.rows === 'two' ? m.btnTop >= m.wordsBottom - 1 : m.btnTop < m.wordsBottom - 1), m);
  ok(`${tag}: the message is inside the window`, m.win, m.toast);
}
// ---- #2567: a message that fits in two lines beside its × keeps the × beside it, and is as tall as the one-row layout
const NO_SPHERE = {
  en: 'The Landscape has no sphere: choose Plane or Sphere in the surface menu',
  ru: 'В Рельефе нет сферы: выберите Плоскость или Сферу в меню поверхности',
  it: 'Il Paesaggio non ha una sfera: scegli Piano o Sfera nel menu della superficie',
};
for (const lang of ['en', 'ru', 'it']) {
  const tag = `${lang} 390×844 over the plot, the Landscape's message with its ×`;
  await open(390, 844, lang);
  await show(NO_SPHERE[lang], null);
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]') && document.getElementById('toastHost').dataset.placed === 'phone-plot'` });
  const m = await still();
  info[tag] = m;
  ok(`${tag}: the message lies over the plot`, !!m && m.placed === 'phone-plot', m);
  if (!m) continue;
  ok(`${tag}: its words are whole in at most two lines`, m.cut <= CUT_MAX && m.lines <= 2, { cut: m.cut, lines: m.lines });
  ok(`${tag}: it is one row, the × beside the words`, m.rows === 'one' && m.btnTop !== null && m.btnTop < m.wordsBottom - 1, m);
  ok(`${tag}: it is no taller than its words and its × beside them need (the taller of the two, its padding and borders, at least its min-height)`, m.h <= m.need + 1, { h: m.h, need: m.need });
  ok(`${tag}: the message is inside the window`, m.win, m.toast);
}
// ---- a message through a rotation
// (in landscape the Display sheet is a column that splits the layout, and the message takes that column's foot, the sheet's 360 px (#2092): two rows,
// as at 360 × 640; the Menu sheet lies over the planes, and the message keeps its row across the foot: one row)
const TURN_SHEET = { display: 'the Display sheet', more: 'the Menu sheet' };
for (const [from, to, want0, want1, sheet] of [[[360, 640], [740, 360], 'two', 'one', null], [[740, 360], [360, 640], 'one', 'two', null], [[360, 640], [740, 360], 'two', 'two', 'display'], [[360, 640], [740, 360], 'two', 'one', 'more']]) {
  const tag = `en ${from.join('×')} → ${to.join('×')}${sheet ? ` with ${TURN_SHEET[sheet]} open` : ''}, a message up through the turn`;
  await open(from[0], from[1], 'en');
  if (sheet) { await ev(`Phone.open('${sheet}'), 1`); await settled({ panes: false, until: `!!document.querySelector('.ph-sheet[data-k="${sheet}"].open')` }); }
  await show(SHORTISH, 'Undo');
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]')` });
  const a = await still();
  ok(`${tag}: before the turn it has ${want0} row${want0 === 'two' ? 's' : ''} (control)`, !!a && a.rows === want0, a);
  await view(to[0], to[1], false, true);
  await settled({ max: SETTLE_MAX, panes: false, until: `innerWidth === ${to[0]}` });
  // (the rows are chosen again once per width: wait for them to be what the new width needs, then for the layout to be still)
  const rowsNow = await settled({ max: SETTLE_MAX, only: true, panes: false, until: `(document.querySelector('#toastHost .toast') || {}).dataset && document.querySelector('#toastHost .toast').dataset.rows === '${want1}'` });
  ok(`${tag}: the rows become ${want1} within ${SETTLE_MAX} ms`, rowsNow.ok, rowsNow);
  const b = await still();
  info[tag] = { a, b };
  ok(`${tag}: after the turn it has ${want1} row${want1 === 'two' ? 's' : ''}`, !!b && b.rows === want1, b);
  if (b) ok(`${tag}: what is drawn is what data-rows says (the buttons ${want1 === 'two' ? 'under' : 'beside'} the words)`, b.btnTop !== null && (want1 === 'two' ? b.btnTop >= b.wordsBottom - 1 : b.btnTop < b.wordsBottom - 1), b);
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
