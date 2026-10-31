// Toasts (#515): at 1024×768, en and ru, in the classic view and in ?view=steps, after adding two steps from the palette
// (Ctrl+K "sine", "exponential"), a desktop toast covers no plane and no control and is never cut: no violation of
// __layout.toasts() (test/lib/layout.js) and no cut text in the toast host. A command file for a CDP daemon (test/cdp_kit README).
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
for (const lang of ['en', 'ru']) for (const vw of ['classic', 'steps']) {
  const at = `${lang} ${vw}`;
  await view(1024, 768, false);
  await nav(`${U}?ns=toast515-${lang}-${vw}-${Date.now()}${vw === 'steps' ? '&view=steps' : ''}&lang=${lang}`); await settle(2500);
  await ev(LIB);
  await add('sine'); await add('exponential'); await shown(); await settle(120);
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
  else if (vw === 'steps' && r.over.length) fails.push(`${at}: the toast covers a plane: ${JSON.stringify(r.over)}`);
  else if (r.win === false) fails.push(`${at}: the toast leaves the window: ${JSON.stringify(r.box)}`);
  else if (r.cut > 0) fails.push(`${at}: the message is cut by ${r.cut} px`);
  if (vw === 'steps' && r.shown) {
    // (ux's choice A: the toast takes only the thread's rail; < > and the speed stay live under it; going on dismisses it)
    const g = await ev(`(() => {
      const top = (e) => { const b = e.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2; const t = document.elementFromPoint(x, y); return !!t && (t === e || e.contains(t)); };
      const strip = document.getElementById('svStrip'), th = document.getElementById('toastHost'), t = th.querySelector('.toast');
      const live = [...strip.querySelectorAll('.sv-nav, .sv-speed')].map((e) => ({ c: e.className, ok: top(e) }));
      const tb = t.getBoundingClientRect(), rb = strip.querySelector('.sv-rail').getBoundingClientRect();
      return { placed: th.getAttribute('data-placed'), cls: strip.classList.contains('sv-toast'), live, inRail: tb.left >= rb.left - 1 && tb.right <= rb.right + 1 && tb.top >= rb.top - 8 && tb.bottom <= rb.bottom + 8, tb: [tb.left, tb.top, tb.right, tb.bottom].map(Math.round), rb: [rb.left, rb.top, rb.right, rb.bottom].map(Math.round),
        covers: [...strip.querySelectorAll('button, select, input')].filter((e) => !e.closest('.sv-rail') || getComputedStyle(e).visibility !== 'hidden').filter((e) => { const b = e.getBoundingClientRect(); return Math.min(b.right, tb.right) - Math.max(b.left, tb.left) > 2 && Math.min(b.bottom, tb.bottom) - Math.max(b.top, tb.top) > 2; }).map((e) => e.className) };
    })()`);
    if (g.placed !== 'rail' || !g.cls) fails.push(`${at}: the toast is not placed over the rail: ${JSON.stringify(g)}`);
    else if (!g.inRail) fails.push(`${at}: the toast is not inside the rail: ${JSON.stringify(g)}`);
    else if (g.covers.length) fails.push(`${at}: the toast covers a live control: ${JSON.stringify(g)}`);
    else if (!g.live.length || g.live.some((l) => !l.ok)) fails.push(`${at}: < > or the speed is not hit-testable under the toast: ${JSON.stringify(g.live)}`);
    // going on through the thread: the first enabled < or > dismisses the toast and brings the rail back
    const nav = await ev(`(() => { const b = [...document.querySelectorAll('#svStrip .sv-nav')].find((e) => !e.disabled); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    if (!nav) fails.push(`${at}: no enabled < or > to go on with`);
    else {
      await click(nav[0], nav[1]); await settle(500);
      const after = await ev(`({ toast: !!document.querySelector('#toastHost .toast'), cls: document.getElementById('svStrip').classList.contains('sv-toast'), rail: [...document.querySelectorAll('#svStrip .sv-rail > *')].every((e) => getComputedStyle(e).visibility !== 'hidden') })`);
      if (after.toast || after.cls || !after.rail) fails.push(`${at}: going on did not dismiss the toast and restore the rail: ${JSON.stringify(after)}`);
    }
  }
}
return { pass: fails.length === 0, fails, info };
