// A phone's message beside the More sheet (#575, #1329): in English, Russian and Italian, at 360 × 640, 390 × 844 and 740 × 360, with the
// More sheet open, a step added the way the palette adds one shows "Added f₄ …  Show alone  Undo". In landscape the sheet makes way for it by
// shrinking from its bottom edge and no control of it is under the message. In portrait the sheet keeps its height: the message sits flush on
// its bottom edge over its list, never over its head or search field, no control moves when it shows, the list's inset lets every control
// scroll clear of it and goes back with the message. The message's words are never cut: they take two rows (words full width, at most two
// lines, the buttons together at the right, 44 px tall) when they do not fit beside the buttons (ru and it at 360 px), one row otherwise (en).
// A message of two rows over the Display and Chain sheets (360 × 640) and the More side panel (740 × 360) has the sheet end above it, whatever its height; a message
// whose only button is the close × keeps it at the right over those sheets and without one.
// The steps view's message with no sheet open takes two rows too when its words do not fit beside its buttons (the choice does not read the overflow on its start side).
// In the steps view (ci/suite_views.js).
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }, { type: 'pown', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const fresh = async (w, h, lang) => {
  await view(w, h, false, true);
  const ns = 'ptc' + w + lang + (Date.now() % 1000000);
  await load(ns, ST);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}` });
  await settled({ max: 30000, until: `typeof __cmwAddStep === 'function' && !!window.Phone && Phone.isOn()` });
};
// (the toast stays 5 s: the measure runs once the sheet has made way for it)
const shown = async () => (await settled({ max: 3000, panes: false, until: `!!document.querySelector('#toastHost .toast')` })).ok;
const madeWay = (k) => settled({ max: 3000, panes: false, until: `(() => { const sh = document.querySelector('.ph-sheet[data-k="${k}"]'), t = document.querySelector('#toastHost .toast'); return !sh || !t || sh.getBoundingClientRect().bottom <= t.getBoundingClientRect().top + 1; })()` });
// (portrait: the message sits at the sheet's bottom edge, over its list: placed once its bottom is the sheet's)
const flushOnSheet = (k) => settled({ max: 3000, panes: false, until: `(() => { const sh = document.querySelector('.ph-sheet[data-k="${k}"]'), t = document.querySelector('#toastHost .toast'); return !sh || !t || Math.abs(t.getBoundingClientRect().bottom - sh.getBoundingClientRect().bottom) <= ${FLUSH_TOL}; })()` });
// ---- the More sheet (eyes on #575): it hangs from its bottom edge up to a cap, with no top of its own; with its bottom lifted for the message it
// has to shrink, not slide up off the screen (its header, ✕ and search field gone), and no control of it is under the message
const measureMore = (k = 'more') => ev(`(() => {
  const host = document.getElementById('toastHost'), t = host && host.querySelector('.toast'); if (!t) return null;
  const sheet = document.querySelector('.ph-sheet[data-k="${k}"]'); if (!sheet) return null;
  const sb = sheet.getBoundingClientRect(), tb = t.getBoundingClientRect(), head = sheet.querySelector('.ph-sh'), hb = head && head.getBoundingClientRect();
  const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  const clip = (r) => ({ left: Math.max(r.left, sb.left), right: Math.min(r.right, sb.right), top: Math.max(r.top, sb.top), bottom: Math.min(r.bottom, sb.bottom) });
  const under = [...sheet.querySelectorAll('button, input, select, [role="button"]')].filter(vis).filter((e) => { const c = clip(e.getBoundingClientRect()); return c.bottom > c.top + 1 && c.right > c.left + 1 && inter(c, tb); }).map((e) => e.id || e.className.split(' ')[0] || e.tagName);
  const btns = [...t.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, at = document.elementFromPoint(x, y); return { t: b.textContent.trim() || b.className, l: r.left, r: r.right, hit: !!at && (at === b || b.contains(at)) }; });
  const txt = t.querySelector(':scope > span'), cut = txt ? txt.scrollWidth - txt.clientWidth : null;
  const rg = document.createRange(); if (txt) rg.selectNodeContents(txt);
  const tops = txt ? [...rg.getClientRects()].map((r) => r.top).sort((a, b) => a - b) : [];
  const lines = txt ? tops.reduce((n, y, i) => n + (i > 0 && y - tops[i - 1] > ${TOAST_LINE_H / 2} ? 1 : 0), tops.length ? 1 : 0) : null;
  return { sheet: [sb.left, sb.top, sb.right, sb.bottom].map(Math.round), head: hb && [hb.top, hb.bottom].map(Math.round), toast: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), under, open: sheet.classList.contains('open'), cut, lines,
    win: tb.left >= -0.5 && tb.right <= innerWidth + 0.5 && tb.top >= -0.5 && tb.bottom <= innerHeight + 0.5, btns,
    headHit: !!hb && inter(tb, hb), fieldHit: [...sheet.querySelectorAll('input')].some((e) => vis(e) && inter(tb, e.getBoundingClientRect())),
    rows: t.dataset.rows, x: (() => { const b = t.querySelector('.toast-x'), r = b && b.getBoundingClientRect(); return r && [r.left, r.right].map(Math.round); })(), btnH: [...t.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)),
    btnIn: [...t.querySelectorAll('button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= tb.left - 0.5 && r.right <= tb.right + 0.5 && r.top >= tb.top - 0.5 && r.bottom <= tb.bottom + 0.5; }) };
})()`);
// the toast's words wrap at a phone's width rather than being cut (#1329, ux's ruling): the text span may overflow by at most one
// pixel, and its text is at most two lines (lines = its text's line boxes, 18 px apart); English, which fits on one line at 360 px,
// keeps the one-line control
const FACE_HOLD_MS = 1000, FACES_MAX_MS = 15000;   // how long the first leg's font files are held, and the bound on waiting for the faces
const FACES_SETTLED = `(document.body.offsetHeight, document.fonts.status === 'loaded')`;   // (the layout is flushed first: a face is requested when its text is laid out)
const LIST_BASE_PAD = '16px', FLUSH_TOL = 1, TOAST_GAP = 12, BTN_GAP_MAX = TOAST_GAP + 1, CUT_MAX = 1, TOAST_LINE_H = 18, TOAST_MAX_LINES = 2, TARGET_PX = 44, TOAST_ONE_ROW_H = 56, X_EDGE_MAX = 12, PHONE_360 = [360, 640], PHONE_390 = [390, 844];
for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[360, 640], [390, 844], [740, 360]]) {
  const tag = `${lang} ${w}×${h} More sheet`;
  // (the first leg's font files land late, as on a slow network: the Language row's words change width when they do)
  await holdFaces(lang === 'en' && w === PHONE_360[0] ? FACE_HOLD_MS : 0);
  await fresh(w, h, lang);
  ok(`${tag}: the steps view is on`, await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
  await ev(`document.getElementById('hdrMoreBtn').click(); 1`);
  await settled({ panes: false, until: `!!document.querySelector('.ph-sheet[data-k="more"].open')` });
  // (the sheet's words need their script's face, fetched when they are first laid out: the controls are read once it has landed)
  await settled({ max: FACES_MAX_MS, panes: false, until: FACES_SETTLED });
  let m = null, ysBefore = null;
  const ysNow = () => ev(`[...(document.querySelector('.ph-sheet[data-k="more"]') || document.body).querySelectorAll('button')].filter((b) => b.getClientRects().length > 0).map((b) => { const r = b.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })`);
  for (let i = 0; i < 3 && !m; i++) { ysBefore = await ysNow(); await ev(`__cmwAddStep('exp')`); if (await shown()) { await (h > w ? flushOnSheet('more') : madeWay('more')); m = await measureMore(); } }
  info[tag] = m;
  ok(`${tag}: it is open and a toast shows`, !!m && m.open, m);
  if (!m) continue;
  ok(`${tag}: the sheet stays on the screen, its header too`, m.sheet[1] >= -0.5 && m.head && m.head[0] >= -0.5, { sheet: m.sheet, head: m.head });
  if (h > w) {
    // (portrait, ux on #1329: the message sits at the sheet's bottom edge, over its list; the list's inset lets every control scroll clear of it)
    ok(`${tag}: the message never covers the sheet's head or search field`, !m.headHit && !m.fieldHit, { headHit: m.headHit, fieldHit: m.fieldHit });
    ok(`${tag}: the message sits flush on the sheet's bottom edge`, Math.abs(m.toast[3] - m.sheet[3]) <= FLUSH_TOL, { toast: m.toast, sheet: m.sheet });
    ok(`${tag}: no control moves when the message shows`, JSON.stringify(ysBefore) === JSON.stringify(await ysNow()), { before: ysBefore, now: await ysNow() });
    // (a control the browser scrolls into view, for keyboard focus, find in page or assistive technology, comes to rest above the message, not under it)
    const into = await ev(`(() => {
      const sb = document.querySelector('.ph-sheet[data-k="more"] .ph-link').closest('.ph-sb'), t = document.querySelector('#toastHost .toast');
      sb.scrollTop = 0;
      const last = [...sb.querySelectorAll('button, a, input, select')].filter((e) => e.getClientRects().length > 0).pop();
      last.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      const r = last.getBoundingClientRect(), tr = t.getBoundingClientRect();
      return { control: [r.top, r.bottom].map(Math.round), toast: [tr.top, tr.bottom].map(Math.round) };
    })()`);
    ok(`${tag}: the list's last control, scrolled into view, ends above the message`, !!into && into.control[1] <= into.toast[0] + FLUSH_TOL, into);
    await ev(`(() => { const sb = document.querySelector('.ph-sheet[data-k="more"] .ph-link').closest('.ph-sb'); sb.scrollTop = sb.scrollHeight; return 1; })()`);
    const end = await measureMore();
    ok(`${tag}: at the end of its list no control is under the message`, !!end && end.under.length === 0, end && { under: end.under });
    await settled({ max: 8000, panes: false, until: `!document.querySelector('#toastHost .toast')` });
    ok(`${tag}: the list's inset goes with the message`, await ev(`getComputedStyle(document.querySelector('.ph-sheet[data-k="more"] .ph-link').closest('.ph-sb')).paddingBottom === ${JSON.stringify(LIST_BASE_PAD)}`), null);
  } else ok(`${tag}: the toast covers none of its controls`, m.under.length === 0, { under: m.under, sheet: m.sheet, toast: m.toast });
  ok(`${tag}: the toast is inside the window`, m.win, { toast: m.toast });
  ok(`${tag}: its buttons can be pressed`, m.btns.length >= 1 && m.btns.every((b) => b.hit), m.btns);
  ok(`${tag}: its buttons are inside the toast`, m.btnIn, null);
  if (w === PHONE_360[0] && h === PHONE_360[1] && lang !== 'en') {
    ok(`${tag}: the message's words are not cut`, m.cut !== null && m.cut <= CUT_MAX, { cut: m.cut });
    ok(`${tag}: the message is at most two lines of text`, m.lines !== null && m.lines <= TOAST_MAX_LINES, { lines: m.lines });
    ok(`${tag}: the words take two rows (they do not fit beside the buttons)`, m.rows === 'two', m.rows);
    ok(`${tag}: the buttons sit together at the right (not spread across the row)`, m.btns.every((x, i) => i === 0 || x.l - m.btns[i - 1].r <= BTN_GAP_MAX), m.btns);
    ok(`${tag}: the buttons are at least 44 px tall`, m.btnH.every((x) => x >= TARGET_PX), m.btnH);
  }
  if (w === PHONE_390[0] && lang === 'en') ok(`${tag}: the message stays one row (control)`, m.rows === 'one', m.rows);
  // (portrait took this check above, before its list was scrolled to the end)
  if (w > h) ok(`${tag}: the sheet's controls do not move when the message shows`, JSON.stringify(ysBefore) === JSON.stringify(await ysNow()), { before: ysBefore, now: await ysNow() });
  if (w === PHONE_360[0] && h === PHONE_360[1] && lang === 'en') ok(`${tag}: the message stays one line (control)`, m.lines === 1, { lines: m.lines });
}
// ---- a message of two rows over the other sheets (#1329, ux's measure): the sheets end above the message whatever its height (a row of buttons
// makes it 76 to 94 px, not 56), so no control of the Display or Chain sheet, nor of the More sheet's side panel, is under it
// (ru and it need two rows at 360 px; the Display sheet's second row of tiles and the chain list's last card were covered)
for (const lang of ['ru', 'it']) for (const [k, w, h] of [['display', 360, 640], ['chain', 360, 640], ['more', 740, 360]]) {
  const tag = `${lang} ${w}×${h} ${k} sheet, a message of two rows`;
  await fresh(w, h, lang);
  await ev(`Phone.open('${k}'); 1`);
  await settled({ panes: false, until: `!!document.querySelector('.ph-sheet[data-k="${k}"].open')` });
  let m = null;
  for (let i = 0; i < 3 && !m; i++) { await ev(`__cmwAddStep('exp')`); if (await shown()) { await madeWay(k); m = await measureMore(k); } }
  info[tag] = m;
  ok(`${tag}: the sheet is open and a message shows`, !!m && m.open, m);
  if (!m) continue;
  if (w === PHONE_360[0]) ok(`${tag}: the message takes two rows (control: it is taller than 56 px)`, m.rows === 'two' && m.toast[3] - m.toast[1] > TOAST_ONE_ROW_H, { rows: m.rows, toast: m.toast });
  ok(`${tag}: the sheet ends above the message`, m.sheet[3] <= m.toast[1] + 1, { sheet: m.sheet, toast: m.toast });
  ok(`${tag}: no control of the sheet is under the message`, m.under.length === 0, { under: m.under });
  ok(`${tag}: its buttons can be pressed`, m.btns.length >= 1 && m.btns.every((b) => b.hit), m.btns);
}
// ---- a message whose only button is the close ×, over two rows (ux): the × stays at the right, on the row under the words
const LONG_MSG = 'A long message with no button of its own that cannot fit on one line beside the close button at this width';
for (const [k, tag] of [[null, 'no sheet'], ['display', 'the Display sheet'], ['chain', 'the Chain sheet']]) {
  const t = `en 360×640 ${tag}: a message of two rows with only the close ×`;
  await fresh(360, 640, 'en');
  if (k) { await ev(`Phone.open('${k}'); 1`); await settled({ panes: false, until: `!!document.querySelector('.ph-sheet[data-k="${k}"].open')` }); }
  await ev(`__cmwToast(${JSON.stringify(LONG_MSG)}, null, { sticky: true }), 1`);
  await shown();
  await settled({ max: 3000, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]')` });
  const m = await measureMore(k || 'more');
  const mm = m || await ev(`(() => { const t = document.querySelector('#toastHost .toast'), b = t && t.querySelector('.toast-x'), tb = t && t.getBoundingClientRect(), r = b && b.getBoundingClientRect(); return t ? { rows: t.dataset.rows, toast: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), x: r && [r.left, r.right].map(Math.round) } : null; })()`);
  info[t] = mm;
  ok(`${t}: it shows with its close button`, !!mm && !!mm.x, mm);
  if (!mm || !mm.x) continue;
  ok(`${t}: the close button is at the right (its right edge at most ${X_EDGE_MAX} px from the message's)`, mm.toast[2] - mm.x[1] <= X_EDGE_MAX, { toast: mm.toast, x: mm.x });
}
// ---- the steps view's message with no sheet open (eyes on #1359, #1685): over the plot's bottom edge it is packed to the end, so the choice of rows
// must not read the overflow on its start side: words that do not fit on one line beside the buttons take the full width, at most two lines, and the
// buttons go below them at the right; short words stay on one row beside them (control)
const PLOT_MSGS = { en: 'Added f₄ Exponential at the end of the chain, after the Möbius step', ru: 'Добавлен шаг f₄ (Экспонента) в конец цепочки, после дробно-линейного шага', it: 'Aggiunto il passo f₄ (Esponenziale) in fondo alla catena, dopo il passo di Möbius' };
const measurePlot = () => ev(`(() => {
  const host = document.getElementById('toastHost'), t = host && host.querySelector('.toast'); if (!t) return null;
  const sp = t.querySelector(':scope > span'), tb = t.getBoundingClientRect(), sb = sp.getBoundingClientRect(), cs = getComputedStyle(t);
  const inner = tb.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 2 * parseFloat(cs.borderLeftWidth);
  const btns = [...t.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(), at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { t: b.textContent.trim() || b.className, l: Math.round(r.left), r: Math.round(r.right), top: Math.round(r.top), hit: !!at && (b === at || b.contains(at)) }; });
  return { placed: host.dataset.placed || null, rows: t.dataset.rows, toast: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), words: Math.round(sb.width), inner: Math.round(inner), wordsBottom: Math.round(sb.bottom),
    cutV: sp.scrollHeight - sp.clientHeight, btns, win: tb.left >= -0.5 && tb.right <= innerWidth + 0.5 && tb.bottom <= innerHeight + 0.5 };
})()`);
for (const lang of ['en', 'ru', 'it']) {
  const tag = `${lang} 360×640 steps view, no sheet`;
  await fresh(360, 640, lang);
  await ev(`__cmwToast(${JSON.stringify(PLOT_MSGS[lang])}, ${JSON.stringify({ en: 'Undo', ru: 'Отменить', it: 'Annulla' }[lang])}, { sticky: true }), 1`);
  await shown();
  await settled({ max: 3000, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]') && document.getElementById('toastHost').dataset.placed === 'phone-plot'` });
  const m = await measurePlot();
  info[tag] = m;
  ok(`${tag}: the message lies over the plot`, !!m && m.placed === 'phone-plot', m);
  if (!m) continue;
  ok(`${tag}: words that do not fit beside the buttons take two rows`, m.rows === 'two', { rows: m.rows, words: m.words, inner: m.inner });
  ok(`${tag}: the words have the full width`, m.words >= m.inner - 1, { words: m.words, inner: m.inner });
  ok(`${tag}: the words are not clamped (at most two lines)`, m.cutV <= 1, { cutV: m.cutV });
  ok(`${tag}: the buttons are below the words, at the right`, m.btns.length >= 2 && m.btns.every((b) => b.top >= m.wordsBottom - 1) && m.toast[2] - Math.max(...m.btns.map((b) => b.r)) <= X_EDGE_MAX + 8, { btns: m.btns, wordsBottom: m.wordsBottom, toast: m.toast });
  ok(`${tag}: its buttons can be pressed and it is inside the window`, m.btns.every((b) => b.hit) && m.win, { btns: m.btns, win: m.win });
}
{
  await fresh(360, 640, 'en');
  await ev(`__cmwToast('Added f₄', 'Undo', { sticky: true }), 1`);
  await shown();
  await settled({ max: 3000, panes: false, until: `!!document.querySelector('#toastHost .toast[data-rows]')` });
  const m = await measurePlot();
  ok('en 360×640 steps view, no sheet: a short message stays on one row (control)', !!m && m.rows === 'one', m);
}
return { pass: fails.length === 0, fails, info };
