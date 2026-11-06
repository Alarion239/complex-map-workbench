// A message on a phone in the steps view lies over the plot's bottom edge, above the thread's strip: 16 px in from the plot's
// sides, two lines at most, covering neither the strip nor the tool row, and a swipe down dismisses it (a short drag does not).
// At 360 × 640 and 390 × 844, and in landscape at 740 × 360. A command file for a CDP daemon (test/cdp_kit README); prints
// { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const U = `http://localhost:${PORT}/test.html`;
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const ST = { shapes: [], steps: [{ type: 'exp', params: {}, on: true }, { type: 'mobius', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const R = (sel) => `(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; })()`;
const T = `document.querySelector('#toastHost .toast')`;
// the message is in, placed, and at rest (full opacity, no slide offset left, the keys' lift done)
const SETTLED = `(() => { const e = ${T}; if (!e || document.getElementById('toastHost').getAttribute('data-placed') !== 'phone-plot') return false; const c = getComputedStyle(e); return !document.getAnimations().some((a) => a.transitionProperty === 'bottom') && c.opacity === '1' && (c.transform === 'none' || c.transform === 'matrix(1, 0, 0, 1, 0, 0)'); })()`;
const show = (msg, o) => ev(`(__cmwToast(${JSON.stringify(msg)}, 'Undo', ${JSON.stringify(o || { ms: 60000 })}), 1)`);
const touch = async (x, y0, y1) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 6; i++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / 6 }] }); await sleep(20); }
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
for (const [w, h, lang] of [[360, 640, 'en'], [390, 844, 'en'], [740, 360, 'en'], [360, 640, 'ru']]) {
  const at = `${w}×${h} ${lang}`;
  await view(w, h, false, true);
  const ns = 'ptb' + w + (Date.now() % 1000000);
  await load(ns, ST);
  await send('Page.navigate', { url: `${U}?ns=${ns}&lang=${lang}&view=steps` });
  await settled({ max: 30000, until: `typeof __cmwToast === 'function' && !!window.Phone && Phone.isOn() && document.getElementById('svStrip').getBoundingClientRect().height > 0 && document.getElementById('plotL').getBoundingClientRect().height > 0` });
  // (English: a long message with one action; Russian: the step added, "Показать отдельно" and "Отменить" beside its words)
  if (lang === 'ru') await ev(`(__cmwAddStep('exp'), 1)`); else await show('Added f₃: Exponential, and a longer second part so that the message needs its second line here');
  await settled({ max: 3000, panes: false, until: SETTLED });
  const g = await ev(`({ toast: ${R('#toastHost .toast')}, strip: ${R('#svStrip')}, plot: ${R('#plotL')}, tools: ${R('#tools')}, keys: [...document.querySelectorAll('.viewstack, .ph-col')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }), placed: document.getElementById('toastHost').getAttribute('data-placed'), lines: Math.round(${T}.querySelector('span').getBoundingClientRect().height / 18), cut: (() => { const e = ${T}.querySelector('span'); return e.scrollWidth - e.clientWidth; })(), W: innerWidth })`);
  info[at] = g;
  ok(`${at}: placed over the plot`, g.placed === 'phone-plot', g.placed);
  ok(`${at}: inside the plot, 16 px in from the window's sides (the tool column's, in landscape)`, g.toast && g.plot && g.toast.l >= 15 && g.toast.r <= g.plot.r - 15 && g.toast.t >= g.plot.t, g);
  ok(`${at}: above the strip`, g.toast && g.strip && g.toast.b <= g.strip.t, g);
  ok(`${at}: the tool row is clear`, g.toast && (!g.tools || g.toast.b <= g.tools.t || g.toast.r <= g.tools.l), g);
  ok(`${at}: the plane's keys are clear`, g.toast && g.keys.every((k) => k.r <= g.toast.l || k.l >= g.toast.r || k.b <= g.toast.t || k.t >= g.toast.b), g.keys);
  ok(`${at}: the root carries no style attribute while the message shows`, await ev(`document.documentElement.getAttribute('style') == null`), await ev(`document.documentElement.getAttribute('style')`));
  ok(`${at}: the bar's height reaches the keys' lift`, await ev(`parseInt(getComputedStyle(document.documentElement).getPropertyValue('--ph-toast-h')) > 0`), null);
  const gx = await ev(`(() => { const b = ${T}.querySelector('.toast-x'); if (!b) return null; const r = b.getBoundingClientRect(), t = ${T}.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), inside: r.left >= t.left && r.right <= t.right + 0.5 && r.top >= t.top && r.bottom <= t.bottom + 0.5 }; })()`);
  ok(`${at}: a timed message has a × of 44 px, inside the message`, gx && gx.w >= 44 && gx.h >= 44 && gx.inside, gx);
  ok(`${at}: two lines at most`, g.lines <= 2, g.lines);
  ok(`${at}: its words are not cut`, g.cut <= 0, g.cut);
  // a short drag keeps it, a swipe down dismisses it
  const x = Math.round((g.toast.l + g.toast.r) / 2), y = Math.round((g.toast.t + g.toast.b) / 2);
  await touch(x, y, y + 12);
  await settled({ max: 3000, panes: false, until: SETTLED });
  ok(`${at}: a short drag keeps it`, await ev(`!!${T}`), null);
  await touch(x, y, y + 70);
  for (const t0 = Date.now(); Date.now() - t0 < 2000 && (await ev(`!!${T}`)); await sleep(50));
  ok(`${at}: a swipe down dismisses it`, !(await ev(`!!${T}`)), null);
}
return { pass: fails.length === 0, fails, info };
