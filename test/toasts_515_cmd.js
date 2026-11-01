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
    // every way of going on dismisses it and brings the rail back: < > (a press), an arrow key, a swipe from the plane's edge, a tap on a plane's dot
    const state = () => ev(`({ toast: !!document.querySelector('#toastHost .toast'), cls: document.getElementById('svStrip').classList.contains('sv-toast'), rail: [...document.querySelectorAll('#svStrip .sv-rail > *')].every((e) => getComputedStyle(e).visibility !== 'hidden') })`);
    const centre = (sel) => ev(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find((e) => !e.disabled && !e.classList.contains('cp') && e.getClientRects().length); if (!b) return null; const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
    const ways = {
      'the < > button': async () => { const c = await centre('#svStrip .sv-nav'); if (c) await click(c[0], c[1]); return !!c; },
      'an arrow key': async () => { await ev(`document.activeElement && document.activeElement.blur(), document.body.focus(), 1`); await key('ArrowRight'); return true; },
      'a swipe from the plane\'s edge': async () => { await ev(`(() => { const p = document.getElementById('plotL'), r = p.getBoundingClientRect(), y = r.top + r.height / 2;
        const e = (type, x) => p.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
        e('pointerdown', r.right - 10); for (let i = 1; i <= 4; i++) e('pointermove', r.right - 10 - i * 30); e('pointerup', r.right - 130); return 1; })()`); return true; },
      'a tap on a plane\'s dot': async () => { const c = await centre('#svStrip .sv-plane'); if (c) await click(c[0], c[1]); return !!c; },
      // (ux on #460: the rail is hidden under the message, so a press on its body only dismisses it: the shown plane stays)
      'a tap on the message itself': async () => {
        const c = await ev(`(() => { const e = document.querySelector('#toastHost .toast > span'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()`);
        if (!c) return false;
        x0 = await ev(`__cmwSvX()`);
        await click(c[0], c[1]);
        return true;
      },
    };
    let x0 = null;
    let first = true;
    for (const [way, go] of Object.entries(ways)) {
      if (!first) { await add('sine'); await shown(); await settle(120); }
      first = false;
      if (!(await state()).toast) { fails.push(`${at}: no toast to dismiss by ${way}`); continue; }
      if (!(await go())) { fails.push(`${at}: nothing to go on with by ${way}`); continue; }
      await settle(500);
      const after = await state();
      if (after.toast || after.cls || !after.rail) fails.push(`${at}: going on by ${way} did not dismiss the toast and restore the rail: ${JSON.stringify(after)}`);
      if (way === 'a tap on the message itself') {
        const x1 = await ev(`__cmwSvX()`);
        if (x0 == null || Math.abs(x1 - x0) > 1e-6) fails.push(`${at}: a tap on the message moved the shown plane (${x0} → ${x1}): it must only dismiss it`);
      }
    }
  }
}
return { pass: fails.length === 0, fails, info };
