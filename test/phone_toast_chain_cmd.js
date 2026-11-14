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
  const btns = [...t.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, at = document.elementFromPoint(x, y); return { t: b.textContent.trim() || b.className, hit: !!at && (at === b || b.contains(at)) }; });
  return { sheet: [sb.left, sb.top, sb.right, sb.bottom].map(Math.round), head: hb && [hb.top, hb.bottom].map(Math.round), toast: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), under, open: sheet.classList.contains('open'),
    win: tb.left >= -0.5 && tb.right <= innerWidth + 0.5 && tb.top >= -0.5 && tb.bottom <= innerHeight + 0.5, btns };
})()`);
for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[360, 640], [390, 844], [740, 360]]) {
  const tag = `${lang} ${w}×${h} More sheet`;
  await fresh(w, h, lang);
  ok(`${tag}: the steps view is on`, await ev('typeof __cmwSteps === "function" && __cmwSteps().on'), null);
  await ev(`document.getElementById('hdrMoreBtn').click(); 1`);
  await settled({ panes: false, until: `!!document.querySelector('.ph-sheet[data-k="more"].open')` });
  let m = null;
  for (let i = 0; i < 3 && !m; i++) { await ev(`__cmwAddStep('exp')`); if (await shown()) { await madeWay('more'); m = await measureMore(); } }
  info[tag] = m;
  ok(`${tag}: it is open and a toast shows`, !!m && m.open, m);
  if (!m) continue;
  ok(`${tag}: the sheet stays on the screen, its header too`, m.sheet[1] >= -0.5 && m.head && m.head[0] >= -0.5, { sheet: m.sheet, head: m.head });
  ok(`${tag}: the toast covers none of its controls`, m.under.length === 0, { under: m.under, sheet: m.sheet, toast: m.toast });
  ok(`${tag}: the toast is inside the window`, m.win, { toast: m.toast });
  ok(`${tag}: its buttons can be pressed`, m.btns.length >= 1 && m.btns.every((b) => b.hit), m.btns);
}
return { pass: fails.length === 0, fails, info };
