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
  await ev(LIB); info[at + ' n0'] = await nSteps();
  await add('sine'); await add('exponential'); await shown(); await settle(120);
  info[at + ' n'] = [await nSteps(), await ev(`[...document.querySelectorAll('#toastHost *')].map((e) => e.className + ':' + e.textContent).join('|')`)];
  const r = await ev(`(() => {
    const host = document.getElementById('toastHost'), t = host && host.querySelector('.toast'), sp = t && t.querySelector('span');
    const b = t && t.getBoundingClientRect();
    const vs = __layout.toasts().concat(__layout.noClippedText(host)).map((v) => ({ check: v.check, key: v.key, okey: v.okey, detail: v.detail }));
    // (the same from the boxes, not the library: the toast clear of every shown plane, and inside the window)
    const over = t ? [...document.querySelectorAll('.panes > .pane')].filter((p) => p.getClientRects().length).map((p) => { const q = p.getBoundingClientRect(); return [p.id, Math.round(Math.min(b.right, q.right) - Math.max(b.left, q.left)), Math.round(Math.min(b.bottom, q.bottom) - Math.max(b.top, q.top))]; }).filter((o) => o[1] > 2 && o[2] > 2) : [];
    return { over, win: b ? b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight : null, shown: !!t, text: sp && sp.textContent, placed: host && host.getAttribute('data-placed'), box: b && [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], cut: sp && sp.scrollWidth - sp.clientWidth, vs };
  })()`);
  info[at] = r; if (process.env.T515) await shot('t515-' + lang + '-' + vw);
  if (!r.shown) fails.push(`${at}: no toast showed after adding the steps`);
  else if (r.vs.length) fails.push(`${at}: ${JSON.stringify(r.vs)}`);
  else if (vw === 'steps' && r.over.length) fails.push(`${at}: the toast covers a plane: ${JSON.stringify(r.over)}`);
  else if (r.win === false) fails.push(`${at}: the toast leaves the window: ${JSON.stringify(r.box)}`);
  else if (r.cut > 0) fails.push(`${at}: the message is cut by ${r.cut} px`);
}
if (process.env.T515) fails.push(JSON.stringify(info));
return { pass: fails.length === 0, fails, info };
