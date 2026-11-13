// A phone's message does not cover the More sheet (#575): in English, Russian and Italian, at 360 × 640, 390 × 844 and
// 740 × 360, with the More sheet open, a step added the way the palette adds one shows "Added f₄ …  Show alone  Undo"; the
// sheet makes way for it by shrinking from its bottom edge (its head, ✕ and search field stay on the screen), and no control
// of the sheet is under the message. In the steps view (ci/suite_views.js).
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
// ---- the More sheet (eyes on #575): it hangs from its bottom edge up to a cap, with no top of its own; with its bottom lifted for the message it
// has to shrink, not slide up off the screen (its header, ✕ and search field gone), and no control of it is under the message
const measureMore = () => ev(`(() => {
  const host = document.getElementById('toastHost'), t = host && host.querySelector('.toast'); if (!t) return null;
  const sheet = document.querySelector('.ph-sheet[data-k="more"]'); if (!sheet) return null;
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
    rows: t.dataset.rows, btnH: [...t.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)),
    btnIn: [...t.querySelectorAll('button')].every((b) => { const r = b.getBoundingClientRect(); return r.left >= tb.left - 0.5 && r.right <= tb.right + 0.5 && r.top >= tb.top - 0.5 && r.bottom <= tb.bottom + 0.5; }) };
})()`);
// the toast's words wrap at a phone's width rather than being cut (#1329, ux's ruling): the text span may overflow by at most one
// pixel, and its text is at most two lines (lines = its text's line boxes, 18 px apart); English, which fits on one line at 360 px,
// keeps the one-line control
const LIST_BASE_PAD = '16px', FLUSH_TOL = 1, TOAST_GAP = 12, BTN_GAP_MAX = TOAST_GAP + 1, CUT_MAX = 1, TOAST_LINE_H = 18, TOAST_MAX_LINES = 2, TARGET_PX = 44, PHONE_360 = [360, 640], PHONE_390 = [390, 844];
for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[360, 640], [390, 844], [740, 360]]) {
  const tag = `${lang} ${w}×${h} More sheet`;
  await fresh(w, h, lang);
  ok(`${tag}: the steps view is on`, await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
  await ev(`document.getElementById('hdrMoreBtn').click(); 1`);
  await settled({ panes: false, until: `!!document.querySelector('.ph-sheet[data-k="more"].open')` });
  let m = null, ysBefore = null;
  const ysNow = () => ev(`[...(document.querySelector('.ph-sheet[data-k="more"]') || document.body).querySelectorAll('button')].filter((b) => b.getClientRects().length > 0).map((b) => { const r = b.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round); })`);
  for (let i = 0; i < 3 && !m; i++) { ysBefore = await ysNow(); await ev(`__cmwAddStep('exp')`); if (await shown()) { await madeWay('more'); m = await measureMore(); } }
  info[tag] = m;
  ok(`${tag}: it is open and a toast shows`, !!m && m.open, m);
  if (!m) continue;
  ok(`${tag}: the sheet stays on the screen, its header too`, m.sheet[1] >= -0.5 && m.head && m.head[0] >= -0.5, { sheet: m.sheet, head: m.head });
  if (h > w) {
    // (portrait, ux on #1329: the message sits at the sheet's bottom edge, over its list; the list's inset lets every control scroll clear of it)
    ok(`${tag}: the message never covers the sheet's head or search field`, !m.headHit && !m.fieldHit, { headHit: m.headHit, fieldHit: m.fieldHit });
    ok(`${tag}: the message sits flush on the sheet's bottom edge`, Math.abs(m.toast[3] - m.sheet[3]) <= FLUSH_TOL, { toast: m.toast, sheet: m.sheet });
    ok(`${tag}: no control moves when the message shows`, JSON.stringify(ysBefore) === JSON.stringify(await ysNow()), { before: ysBefore, now: await ysNow() });
    await ev(`(() => { const sb = document.querySelector('.ph-sheet[data-k="more"] .ph-link').closest('.ph-sb'); sb.scrollTop = sb.scrollHeight; return 1; })()`);
    const end = await measureMore();
    ok(`${tag}: at the end of its list no control is under the message`, !!end && end.under.length === 0, end && { under: end.under });
    await settled({ max: 8000, panes: false, until: `!document.querySelector('#toastHost .toast')` });
    ok(`${tag}: the list's inset goes with the message`, await ev(`getComputedStyle(document.querySelector('.ph-sheet[data-k="more"] .ph-link').closest('.ph-sb')).paddingBottom === LIST_BASE_PAD`), null);
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
return { pass: fails.length === 0, fails, info };
