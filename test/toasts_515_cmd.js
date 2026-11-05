// Toasts: at 1024×768, en, ru and it, in the classic view and in ?view=steps (and in the steps view at 1280 and 1440), after adding two steps from the palette
// (Ctrl+K "sine", "exponential"), a desktop toast covers no control and is never cut: no violation of __layout.toasts()
// (test/lib/layout.js) and no cut text in the toast host. In the steps view it lies over the left plot's bottom edge, above the
// thread's strip, which keeps every plane and chip in place and clickable; a press on its body dismisses it. A command file for a CDP daemon (test/cdp_kit README).
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const LIB = fs.readFileSync(path.join(DIR, '..', 'lib', 'layout.js'), 'utf8');
const fails = [], info = {};
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const nSteps = () => ev('__cmwP().steps.length');
// (a palette not yet open takes no word: the step is tried again until it is added)
const add = async (word) => { const n = await nSteps(); for (let i = 0; i < 3 && (await nSteps()) === n; i++) { await key('k', 2); await settle(400); await type(word); await settle(400); await key('Enter'); await settle(150); } };
// (the toast stays 5 s; the measure runs as soon as it shows, and the page is given a moment to place it)
const shown = async () => { for (let i = 0; i < 20; i++) { if (await ev(`!!document.querySelector('#toastHost .toast')`)) return true; await sleep(100); } return false; };
const CASES = [];
for (const lang of ['en', 'ru', 'it']) for (const vw of ['classic', 'steps']) CASES.push([lang, vw, 1024, 768]);
for (const [w, h] of [[1280, 800], [1440, 900]]) CASES.push(['en', 'steps', w, h]);
for (const [lang, vw, w, h] of CASES) {
  const at = `${lang} ${vw} ${w}`;
  await view(w, h, false);
  await nav(`${U}?ns=toast515-${lang}-${vw}-${w}-${Date.now()}${vw === 'steps' ? '&view=steps' : ''}&lang=${lang}`); await settle(2500);
  await ev(LIB);
  await add('sine'); await add('exponential');
  // (a slow page can show the toast and drop it before the measure: another step brings a fresh one)
  for (let i = 0; i < 2 && !(await shown()); i++) await add('sine');
  await settle(120);
  const r = await ev(`(() => {
    const host = document.getElementById('toastHost'), t = host && host.querySelector('.toast'), sp = t && t.querySelector('span');
    const b = t && t.getBoundingClientRect();
    const vs = __layout.toasts().concat(__layout.noClippedText(host)).map((v) => ({ check: v.check, key: v.key, okey: v.okey, detail: v.detail }));
    // (the same from the boxes, not the library: the toast clear of every shown plot (the steps view's thread strip is inside the pane), and inside the window)
    const over = t ? [...document.querySelectorAll('#plotL, #plotR')].filter((p) => p.getClientRects().length).map((p) => { const q = p.getBoundingClientRect(); return [p.id, Math.round(Math.min(b.right, q.right) - Math.max(b.left, q.left)), Math.round(Math.min(b.bottom, q.bottom) - Math.max(b.top, q.top))]; }).filter((o) => o[1] > 2 && o[2] > 2) : [];
    return { over, win: b ? b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight : null, shown: !!t, text: sp && sp.textContent, placed: host && host.getAttribute('data-placed'), box: b && [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], cut: sp && sp.scrollWidth - sp.clientWidth, vs };
  })()`);
  info[at] = r;
  if (!r.shown) fails.push(`${at}: no toast showed after adding the steps`);
  else if (r.vs.length) fails.push(`${at}: ${JSON.stringify(r.vs)}`);
  else if (r.win === false) fails.push(`${at}: the toast leaves the window: ${JSON.stringify(r.box)}`);
  else if (r.cut > 0) fails.push(`${at}: the message is cut by ${r.cut} px`);
  if (vw === 'steps' && r.shown) {
    // a message over the plot's bottom edge replaces nothing: the strip's rail keeps its planes, chips and place, the toast lies
    // inside the left plot above the strip and clear of every control of the pane, and a press on its body dismisses it
    const g = await ev(`(() => {
      const th = document.getElementById('toastHost'), t = th.querySelector('.toast'), strip = document.getElementById('svStrip'), pl = document.getElementById('plotL').getBoundingClientRect();
      const tb = t.getBoundingClientRect(), sb = strip.getBoundingClientRect();
      const rail = [...strip.querySelectorAll('.sv-rail > *, .sv-wholemap, .sv-add')].filter((e) => e.getClientRects().length);
      const hid = rail.filter((e) => getComputedStyle(e).visibility === 'hidden').length, blocked = rail.filter((e) => { const b = e.getBoundingClientRect(), el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!el && th.contains(el); }).map((e) => { const b = e.getBoundingClientRect(), el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e.className + ' under ' + (el && (el.id || el.className)); });
      const inter = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
      const ctl = [...document.querySelectorAll('#paneL button, #paneL select, #paneL input')].filter((e) => !strip.contains(e) && !th.contains(e) && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').filter((e) => inter(e.getBoundingClientRect(), tb)).map((e) => e.className || e.id);
      return { placed: th.getAttribute('data-placed'), cls: strip.classList.contains('sv-toast'), n: rail.length, hid, blocked, ctl,
        inPlot: tb.left >= pl.left - 1 && tb.right <= pl.right + 1 && tb.top >= pl.top - 1 && tb.bottom <= pl.bottom + 1, aboveStrip: tb.bottom <= sb.top + 1 || sb.top >= pl.bottom, tb: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round) };
    })()`);
    if (g.placed !== 'plot') fails.push(`${at}: the toast is not placed over the plot: ${JSON.stringify(g)}`);
    else if (g.cls || g.hid || !g.n) fails.push(`${at}: the toast replaces part of the thread's strip: ${JSON.stringify(g)}`);
    else if (g.blocked.length) fails.push(`${at}: the toast covers a control of the strip: ${JSON.stringify(g)}`);
    else if (!g.inPlot || !g.aboveStrip) fails.push(`${at}: the toast is not inside the plot above the strip: ${JSON.stringify(g)}`);
    else if (g.ctl.length) fails.push(`${at}: the toast covers a control of the plot: ${JSON.stringify(g.ctl)}`);
    // a press on the message's body dismisses it and moves nothing
    const x0 = await ev(`__cmwSvX()`);
    const c = await ev(`(() => { const e = document.querySelector('#toastHost .toast > span'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    if (!c) fails.push(`${at}: no message body to press`);
    else {
      await click(c[0], c[1]);
      await settled({ max: 3000, only: true, until: `!document.querySelector('#toastHost .toast')` });
      if (await ev(`!!document.querySelector('#toastHost .toast')`)) fails.push(`${at}: a press on the message did not dismiss it`);
      const x1 = await ev(`__cmwSvX()`);
      if (x0 == null || Math.abs(x1 - x0) > 1e-6) fails.push(`${at}: a press on the message moved the shown plane (${x0} → ${x1})`);
    }
  }
}
return { pass: fails.length === 0, fails, info };
