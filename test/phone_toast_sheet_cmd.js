// A phone's message with a sheet open (#2092). In the steps view with the Display sheet open and a message up:
//  - landscape, 740 × 360 and 667 × 375, in en, ru and it: the message lies at the foot of the sheet's column and covers no control of the thread's
//    strip, Fit view, the plane's keys or the sheet (none of the points sampled on them is under it: elementFromPoint), and its words are whole;
//  - a message of one row over the plot that is up when the sheet opens takes the rows of the sheet's width (data-rows is what is drawn, the words whole);
//  - landscape, 740 × 360, 667 × 375 and 568 × 320, with the Menu or Function chain sheet open (they do not split the layout): the message keeps its row and
//    covers no point of Fit view, the plane's keys or the tool column, its words whole and its buttons 44 px;
//  - portrait, 360 × 640, en, ru and it: the message lies below the sheet's foot, clear of the sheet's switch (Everywhere | Inside regions).
// In the steps view (ci/suite_views.js). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [{ id: 's1', kind: 'disc', c: [0, 0], r: 1 }], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
// (messages of two lines at the sheet's width, with their action)
const MSG = {
  en: ['Opened the figure from the link. Some constructions could not be read and were opened as plain figures.', 'Undo'],
  ru: ['Фигура по ссылке открыта. Некоторые построения не удалось прочитать, они открыты как простые фигуры.', 'Отменить'],
  it: ['Aggiunto f₃: Esponenziale. Il nuovo passo è in fondo alla catena dei passi.', 'Annulla'],
};
const SHORTISH = 'Added f₃: Exponential, and a longer second part that needs three lines beside its buttons';   // (two lines beside its buttons over the plot at 740 px: one row; more than two beside them at the sheet's width: two rows)
// the controls sampled, and how many points of each (a K × K grid inside its visible box: the part inside the window and inside the strip or the
// sheet that holds it); fewer than MIN_* of them seen is a failure, so the rows
// cannot pass with nothing sampled
// (a control's visible box narrower or shorter than MIN_BOX px is not sampled; portrait shows MIN_SHEET_PORTRAIT of the sheet's controls above the message)
const BTN_MIN = 44;   // the message's action and × are this many px each way
const K = 3, MIN_BOX = 4, MIN_STRIP = 4, MIN_SHEET = 4, MIN_SHEET_PORTRAIT = 2, MIN_KEYS = 2, MIN_RAIL = 4, CUT_MAX = 1, STILL_MS = 150, SETTLE_MAX = 5000;
const SAMPLE = `(() => {
  const host = document.getElementById('toastHost'), t = host.querySelector('.toast'); if (!t) return null;
  const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  const clip = (r, c) => ({ l: Math.max(r.left, c.l), t: Math.max(r.top, c.t), r: Math.min(r.right, c.r), b: Math.min(r.bottom, c.b) });
  const win = { l: 0, t: 0, r: innerWidth, b: innerHeight };
  const sheet = document.querySelector('.ph-sheet.open'), sb = sheet && sheet.getBoundingClientRect();
  const sheetBox = sb && { l: sb.left, t: sb.top, r: sb.right, b: sb.bottom };
  const groups = {
    strip: [...document.querySelectorAll('#svStrip button')].filter(vis).map((e) => clip(e.getBoundingClientRect(), clip(document.getElementById('svStrip').getBoundingClientRect(), win))),
    fit: [document.getElementById('leftFit')].filter((e) => e && vis(e)).map((e) => clip(e.getBoundingClientRect(), win)),
    keys: [...document.querySelectorAll('.pane:not(.ph-inset) .viewstack button')].filter(vis).map((e) => clip(e.getBoundingClientRect(), win)),
    sheet: sheet ? [...sheet.querySelectorAll('button, [role="radio"], select, input')].filter(vis).map((e) => clip(e.getBoundingClientRect(), clip(sb, win))) : [],
    rail: [...document.querySelectorAll('#secDraw button, #secDraw summary')].filter(vis).map((e) => clip(e.getBoundingClientRect(), win)),
  };
  const out = {};
  for (const [k, boxes] of Object.entries(groups)) {
    const seen = boxes.filter((b) => b.r - b.l >= ${MIN_BOX} && b.b - b.t >= ${MIN_BOX});
    let n = 0, under = 0;
    for (const b of seen) for (let i = 0; i < ${K}; i++) for (let j = 0; j < ${K}; j++) {
      const x = b.l + (b.r - b.l) * (2 * i + 1) / ${2 * K}, y = b.t + (b.b - b.t) * (2 * j + 1) / ${2 * K};
      n++; const hit = document.elementFromPoint(x, y); if (hit && host.contains(hit)) under++;
    }
    out[k] = { controls: seen.length, n, under };
  }
  const sp = t.querySelector(':scope > span'), tb = t.getBoundingClientRect(), wb = sp.getBoundingClientRect();
  const btns = [...t.querySelectorAll('button')].filter(vis).map((b) => b.getBoundingClientRect());
  const sw = sheet && sheet.querySelector('.seg'), swb = sw && sw.getBoundingClientRect();
  return { out, rows: t.dataset.rows || null, cut: Math.max(sp.scrollHeight - sp.clientHeight, sp.scrollWidth - sp.clientWidth), toast: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round),
    sheet: sb && [sb.left, sb.top, sb.right, sb.bottom].map(Math.round), sw: swb && [swb.left, swb.top, swb.right, swb.bottom].map(Math.round),
    wordsBottom: wb.bottom, btnTop: btns.length ? Math.min(...btns.map((r) => r.top)) : null, btnMin: btns.length ? Math.round(Math.min(...btns.map((r) => Math.min(r.width, r.height)))) : 0 };
})()`;
// (the layout is still: the sheet's and the keys' eased moves are over)
const still = async () => { let a = JSON.stringify(await ev(SAMPLE)); for (let i = 0; i < SETTLE_MAX / STILL_MS; i++) { await sleep(STILL_MS); const b = JSON.stringify(await ev(SAMPLE)); if (a === b) return JSON.parse(b); a = b; } return JSON.parse(a); };
const open = async (w, h, lang) => {
  await view(w, h, false, true);
  const ns = 'pts' + w + lang + (Date.now() % 1000000);
  await load(ns, ST);
  await go(`${U}?ns=${ns}&lang=${lang}&view=steps`);
  await settled({ max: 30000, until: `typeof __cmwToast === 'function' && !!window.Phone && Phone.isOn() && document.getElementById('svStrip').getBoundingClientRect().height > 0` });
};
// (a sheet that splits the layout is open once the planes have given up its column: .ph-split)
const sheetOpen = async (k = 'display') => { await ev(`Phone.open('${k}'), 1`); await settled({ panes: false, until: `!!document.querySelector('.ph-sheet[data-k="${k}"].open') && document.documentElement.classList.contains('ph-sheet-on') && (${k !== 'display'} || document.documentElement.classList.contains('ph-split'))` }); };
const show = async (msg, label) => { await ev(`(__cmwToast(${JSON.stringify(msg)}, ${JSON.stringify(label)}, { sticky: true }), 1)`); await settled({ max: SETTLE_MAX, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]')` }); };
// ---- landscape: the message covers no control
for (const [w, h] of [[740, 360], [667, 375]]) for (const lang of ['en', 'ru', 'it']) {
  const tag = `${lang} ${w}×${h} with the Display sheet open`;
  await open(w, h, lang);
  await sheetOpen();
  await show(MSG[lang][0], MSG[lang][1]);
  const m = await still();
  info[tag] = m;
  ok(`${tag}: the message shows`, !!m, m);
  if (!m) continue;
  ok(`${tag}: the strip, Fit view, the plane's keys and the sheet's controls are sampled`, m.out.strip.controls >= MIN_STRIP && m.out.fit.controls === 1 && m.out.keys.controls >= MIN_KEYS && m.out.sheet.controls >= MIN_SHEET, m.out);
  for (const k of ['strip', 'fit', 'keys', 'sheet']) ok(`${tag}: no point of the ${{ strip: "thread's strip", fit: 'Fit view', keys: "plane's keys", sheet: "sheet's controls" }[k]} is under the message`, m.out[k].under === 0, m.out[k]);
  ok(`${tag}: its words are whole`, m.cut <= CUT_MAX, m.cut);
}
// ---- landscape: a message of one row over the plot, up when the sheet opens
{
  const tag = 'en 740×360, a message over the plot when the Display sheet opens';
  await open(740, 360, 'en');
  await show(SHORTISH, 'Undo');
  const a = await still();
  ok(`${tag}: before, it has one row (control)`, !!a && a.rows === 'one', a);
  await sheetOpen();
  await settled({ max: SETTLE_MAX, panes: false, until: `(() => { const t = document.querySelector('#toastHost .toast'); return !!t && t.dataset.rows === 'two'; })()` });
  const m = await still();
  info[tag] = m;
  ok(`${tag}: it takes two rows at the sheet's width, the buttons under the words`, !!m && m.rows === 'two' && m.btnTop !== null && m.btnTop >= m.wordsBottom - 1, m);
  ok(`${tag}: its words are whole`, !!m && m.cut <= CUT_MAX, m && m.cut);
  ok(`${tag}: no point of the thread's strip or Fit view is under it`, !!m && m.out.strip.controls >= MIN_STRIP && m.out.strip.under === 0 && m.out.fit.under === 0, m && m.out);
}
// ---- landscape: the Menu (More) and Function chain sheets lie over the planes and do not split the layout; the message keeps its row across the foot,
// and covers no point of Fit view, the plane's keys or the tool column, its words whole and its buttons 44 px (#2124: on the shorter phones too)
const OVERLAY = { more: 'the Menu sheet', chain: 'the Function chain sheet' };
for (const [w, h, langs] of [[740, 360, ['en']], [667, 375, ['en', 'ru', 'it']], [568, 320, ['en', 'ru', 'it']]]) for (const lang of langs) for (const [k, what] of Object.entries(OVERLAY)) {
  const tag = `${lang} ${w}×${h} with ${what} open`;
  await open(w, h, lang);
  await sheetOpen(k);
  await show(MSG[lang][0], MSG[lang][1]);
  const m = await still();
  info[tag] = m;
  ok(`${tag}: Fit view, the plane's keys and the tool column are sampled`, !!m && m.out.fit.controls === 1 && m.out.keys.controls >= MIN_KEYS && m.out.rail.controls >= MIN_RAIL, m && m.out);
  for (const g of ['fit', 'keys', 'rail']) ok(`${tag}: no point of ${{ fit: 'Fit view', keys: "the plane's keys", rail: 'the tool column' }[g]} is under the message`, !!m && m.out[g].under === 0, m && m.out[g]);
  ok(`${tag}: its words are whole and its buttons ${BTN_MIN} px`, !!m && m.cut <= CUT_MAX && m.btnMin >= BTN_MIN, m && { cut: m.cut, btnMin: m.btnMin });
}
// ---- portrait: the message lies below the sheet's foot, clear of its switch
for (const lang of ['en', 'ru', 'it']) {
  const tag = `${lang} 360×640 with the Display sheet open`;
  await open(360, 640, lang);
  await sheetOpen();
  await show(MSG[lang][0], MSG[lang][1]);
  const m = await still();
  info[tag] = m;
  ok(`${tag}: the message lies below the sheet's foot`, !!m && !!m.sheet && m.toast[1] >= m.sheet[3] - 1, m);
  ok(`${tag}: the sheet's switch is clear of the message`, !!m && !!m.sw && m.sw[3] <= m.toast[1], m && { sw: m.sw, toast: m.toast });
  ok(`${tag}: no point of the sheet's controls is under the message`, !!m && m.out.sheet.controls >= MIN_SHEET_PORTRAIT && m.out.sheet.under === 0, m && m.out.sheet);
}
return { pass: fails.length === 0, fails, info };
