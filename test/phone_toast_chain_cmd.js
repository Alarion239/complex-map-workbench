// A phone's toast does not cover the chain sheet's rows (#464, from Alexander's screenshot on #58): at 360 × 640 and 390 × 844 (and in landscape,
// 740 × 360 and 915 × 412),
// in English, Russian and Italian, with the chain sheet open (the chain bar's "N steps ▾"), a step added the way the palette adds one
// shows "Added f₄ …  Show alone  Undo", and that message:
//   - meets no row of the sheet: not the Numbers row, the F tile, any card, nor the Add function row (the rows that are inside the
//     sheet's own box; one scrolled out of it is not under the message's reach);
//   - is whole: inside the window, its words not cut;
//   - leaves its own buttons (Show alone, Undo) hit-testable.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ST = { shapes: [], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }, { type: 'pown', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const fresh = async (w, h, lang) => {
  await view(w, h, false, true);
  const ns = 'ptc' + w + lang + (Date.now() % 1000000);
  await load(ns, ST);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}` });
  await settled({ max: 30000, until: `typeof __cmwAddStep === 'function'` }); await settle(1000);
};
// (the toast stays 5 s: the measure runs the moment it shows)
const shown = async () => { for (let i = 0; i < 30; i++) { if (await ev(`!!document.querySelector('#toastHost .toast')`)) return true; await sleep(100); } return false; };
const measure = () => ev(`(() => {
  const host = document.getElementById('toastHost'), t = host && host.querySelector('.toast'); if (!t) return null;
  const sheet = document.querySelector('.ph-sheet[data-k="chain"]'), sb = sheet && sheet.getBoundingClientRect();
  const tb = t.getBoundingClientRect();
  const vis = (e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
  const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  // (a row is seen where the sheet shows it: its box cut to the sheet's, as the scrolling list cuts it at the sheet's edge)
  const clip = (r) => ({ left: Math.max(r.left, sb.left), right: Math.min(r.right, sb.right), top: Math.max(r.top, sb.top), bottom: Math.min(r.bottom, sb.bottom) });
  const rows = [...(sheet ? sheet.querySelectorAll('.ph-nums, #ftile, #pipeline .card, #add-card') : [])].filter(vis).map((e) => ({ id: e.id || e.className.split(' ')[0], b: sb ? clip(e.getBoundingClientRect()) : null }))
    .filter((r) => r.b && r.b.bottom > r.b.top + 1 && r.b.right > r.b.left + 1);
  const under = rows.filter((r) => inter(r.b, tb)).map((r) => r.id);
  // (the step just added is the selected card: it is to be seen in the sheet's list, above the message, not scrolled away under it)
  const nc = sheet && sheet.querySelector('#pipeline .card[aria-selected="true"]'), ncr = nc && nc.getBoundingClientRect();
  const newCard = nc && sb ? { id: nc.id, seen: +(Math.max(0, Math.min(ncr.bottom, sb.bottom) - Math.max(ncr.top, sb.top)) / Math.max(1, ncr.height)).toFixed(2) } : null;
  const btns = [...t.querySelectorAll('button')].map((b) => { const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, at = document.elementFromPoint(x, y); return { t: b.textContent.trim() || b.className, hit: !!at && (at === b || b.contains(at)) }; });
  const sp = t.querySelector('span');
  return { text: sp && sp.textContent, box: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), sheet: sb && [sb.left, sb.top, sb.right, sb.bottom].map(Math.round), full: document.documentElement.classList.contains('ph-full'),
    win: tb.left >= -0.5 && tb.right <= innerWidth + 0.5 && tb.top >= -0.5 && tb.bottom <= innerHeight + 0.5, under, newCard, rows: rows.length, btns,
    cut: sp ? Math.max(0, sp.scrollWidth - sp.clientWidth) : 0, placed: host.getAttribute('data-placed') };
})()`);
// (portrait 360 × 640 and 390 × 844, the width of Alexander's screenshot; landscape 740 × 360 and 915 × 412, where the sheet is a side panel)
for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[360, 640], [390, 844], [740, 360], [915, 412]]) {
  const tag = `${lang} ${w}×${h}`;
  await fresh(w, h, lang);
  await ev(`document.querySelector('.ph-csteps').click(); 1`); await settle(900);
  ok(`${tag}: the chain sheet is open`, await ev(`!!document.querySelector('.ph-sheet[data-k="chain"].open')`), null);
  // (a second after the toast shows: the sheet's 220 ms to make way for it, and the list's scroll to the card just added)
  let m = null;
  for (let i = 0; i < 3 && !m; i++) {
    await ev(`__cmwAddStep('exp')`);
    if (await shown()) {
      await settle(1000); m = await measure();
      // (the list's smooth scroll to the card just added takes longer on a slow start: measured again, up to eight times, until the card is in view)
      for (let j = 0; j < 8 && m && !(m.newCard && m.newCard.seen >= 0.9); j++) { await sleep(500); const n = await measure(); if (!n) break; m = n; }
    }
  }
  info[tag] = m;
  ok(`${tag}: a toast shows after a step is added`, !!m, null);
  if (!m) continue;
  ok(`${tag}: the toast covers no row of the chain sheet`, m.under.length === 0, { under: m.under, box: m.box, sheet: m.sheet, rows: m.rows, placed: m.placed });
  ok(`${tag}: the toast is inside the window`, m.win, { box: m.box });
  ok(`${tag}: the step just added is in view in the sheet`, m.newCard && m.newCard.seen >= 0.9, { newCard: m.newCard, box: m.box, sheet: m.sheet });
  ok(`${tag}: the toast's words are not cut`, m.cut <= 1, { cut: m.cut, text: m.text });
  ok(`${tag}: its buttons can be pressed`, m.btns.length >= 2 && m.btns.every((b) => b.hit), m.btns);
}
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
  return { sheet: [sb.left, sb.top, sb.right, sb.bottom].map(Math.round), head: hb && [hb.top, hb.bottom].map(Math.round), toast: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), under, open: sheet.classList.contains('open') };
})()`);
for (const lang of ['en', 'ru', 'it']) for (const [w, h] of [[360, 640], [390, 844], [740, 360]]) {
  const tag = `${lang} ${w}×${h} More sheet`;
  await fresh(w, h, lang);
  await ev(`document.getElementById('hdrMoreBtn').click(); 1`); await settle(900);
  let m = null;
  for (let i = 0; i < 3 && !m; i++) { await ev(`__cmwAddStep('exp')`); if (await shown()) { await settle(1000); m = await measureMore(); } }
  info[tag] = m;
  ok(`${tag}: it is open and a toast shows`, !!m && m.open, m);
  if (!m) continue;
  ok(`${tag}: the sheet stays on the screen, its header too`, m.sheet[1] >= -0.5 && m.head && m.head[0] >= -0.5, { sheet: m.sheet, head: m.head });
  ok(`${tag}: the toast covers none of its controls`, m.under.length === 0, { under: m.under, sheet: m.sheet, toast: m.toast });
}
return { pass: fails.length === 0, fails, info };
