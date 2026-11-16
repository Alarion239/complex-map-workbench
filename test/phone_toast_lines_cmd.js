// A phone's message keeps all its words and its layout (#1686): the longest messages need three lines at 360 × 640 (Italian and Russian), and
// are not cut at two; a message that stays up through a rotation takes the rows its new width needs.
//  - at 360 × 640 in the steps view, with no sheet open (over the plot) and with the Display sheet open (over its row): the words of the longest it and ru
//    messages are not cut (`scrollHeight - clientHeight` of the words ≤ 1) and are at most three lines; the message is inside the window;
//  - a message of two rows at 360 × 640 that stays up while the phone turns to 740 × 360 has one row beside its buttons, and the other way
//    round: `data-rows` is what is drawn (the buttons beside the words, or under them).
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
const SHORTISH = 'Added f₃: Exponential, and a longer second part';   // (two rows at 360 px, one row at 740 px)
const LINE_H = 18, MAX_LINES = 3, CUT_MAX = 1, STILL_MS = 150, SETTLE_MAX = 5000, MSG_MS = 60000;
const measure = () => ev(`(() => {
  const host = document.getElementById('toastHost'), t = host && host.querySelector('.toast'); if (!t) return null;
  const sp = t.querySelector(':scope > span'), tb = t.getBoundingClientRect(), sb = sp.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(sp);
  const tops = [...rg.getClientRects()].map((r) => Math.round(r.top)).filter((y, i, a) => a.indexOf(y) === i).length;
  const btns = [...t.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect());
  return { rows: t.dataset.rows || null, cut: sp.scrollHeight - sp.clientHeight, lines: tops, placed: host.dataset.placed || null, toast: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), wordsBottom: sb.bottom, btnTop: btns.length ? Math.min(...btns.map((r) => r.top)) : null,
    win: tb.left >= -0.5 && tb.right <= innerWidth + 0.5 && tb.top >= -0.5 && tb.bottom <= innerHeight + 0.5 };
})()`);
const still = async () => { let a = JSON.stringify(await measure()); for (let i = 0; i < SETTLE_MAX / STILL_MS; i++) { await sleep(STILL_MS); const b = JSON.stringify(await measure()); if (a === b) return JSON.parse(b); a = b; } return JSON.parse(a); };
const open = async (w, h, lang) => {
  await view(w, h, false, true);
  const ns = 'ptl' + w + lang + (Date.now() % 1000000);
  await load(ns, ST);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}&view=steps` });
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
// ---- a message through a rotation
for (const [from, to, want0, want1] of [[[360, 640], [740, 360], 'two', 'one'], [[740, 360], [360, 640], 'one', 'two']]) {
  const tag = `en ${from.join('×')} → ${to.join('×')}, a message up through the turn`;
  await open(from[0], from[1], 'en');
  await show(SHORTISH, 'Undo');
  await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]')` });
  const a = await still();
  ok(`${tag}: before the turn it has ${want0} row${want0 === 'two' ? 's' : ''} (control)`, !!a && a.rows === want0, a);
  await view(to[0], to[1], false, true);
  await settled({ max: SETTLE_MAX, panes: false, until: `innerWidth === ${to[0]}` });
  await sleep(600);
  const b = await still();
  info[tag] = { a, b };
  ok(`${tag}: after the turn it has ${want1} row${want1 === 'two' ? 's' : ''}`, !!b && b.rows === want1, b);
  if (b) ok(`${tag}: what is drawn is what data-rows says (the buttons ${want1 === 'two' ? 'under' : 'beside'} the words)`, b.btnTop !== null && (want1 === 'two' ? b.btnTop >= b.wordsBottom - 1 : b.btnTop < b.wordsBottom - 1), b);
}
const errs = (await logs()).filter((x) => (x.t === 'EXC' || x.t === 'error' || x.t === 'log-error') && !/Failed to load resource/.test(x.m || '')).map((x) => x.m).slice(0, 5);
ok('no errors', !errs.length, errs);
return { pass: fails.length === 0, fails, info };
