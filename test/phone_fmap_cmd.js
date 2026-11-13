// On a phone in the steps view F, the whole map, is a 44 px round chip at the end of the rail, inside the rail's scroller
// after the last plane: it can be reached by scrolling the rail, and a tap on it selects F and opens the Inspector's sheet.
// On a wide screen it stays outside the rail, in the strip. 390 and 360 px wide with touch, in en, ru and it, then 1440 px.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push({ name, got: detail }); };
const STATE = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 'k1', kind: 'disc', c: [0.3, 0], r: 0.6, ci: 0, visible: true }],
  steps: [{ type: 'affine', params: { a: '1', b: '0.5' }, on: true }, { type: 'sin', params: {}, on: true }, { type: 'exp', params: {}, on: true }], nextId: 50, focus: 0, srcView: { cx: 0, cy: 0, s: 80 } };
const touch = async (x, y, ms = 60) => {
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
  await sleep(ms);
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};
// a wait on the page's own state; a timeout is a failed check by the caller reading its result
const ready = async (expr, max = 20000) => (await settled({ until: expr, max, only: true })).ok;
// where the chip is: its box, its parent, whether the last plane comes before it, and what lies at its centre
const probe = `(() => {
  const c = document.querySelector('#svStrip .sv-wholemap'), rail = document.querySelector('#svStrip .sv-rail');
  if (!c) return { none: 1 };
  const b = c.getBoundingClientRect(), rr = rail.getBoundingClientRect(), pl = [...rail.querySelectorAll('.sv-plane')], last = pl[pl.length - 1];
  const hit = b.width ? document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) : null;
  return { shown: getComputedStyle(c).display !== 'none' && b.width > 0, w: Math.round(b.width), h: Math.round(b.height), inRail: c.parentElement === rail,
    afterPlanes: !!last && !!(last.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING), left: b.left, right: b.right, top: b.top, bottom: b.bottom,
    railL: rr.left, railR: rr.right, railT: rr.top, railB: rr.bottom, scrollW: rail.scrollWidth, clientW: rail.clientWidth, scrollL: rail.scrollLeft,
    hit: !!hit && c.contains(hit), pressed: c.getAttribute('aria-pressed') };
})()`;
const open = async (w, lang) => {
  const ns = 'fmap' + Date.now();
  await view(w, w === 1440 ? 900 : 844, false, w !== 1440);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` });
  await ready('document.readyState === "complete"');
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(STATE))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}&lang=${lang}&view=steps` });
  return ready(`!!window.__cmwSteps && __cmwSteps().on && document.querySelectorAll('#svStrip .sv-plane').length === 4 && (${w === 1440} || Phone.isOn())`);
};
for (const [lang, w] of [['en', 390], ['ru', 390], ['it', 390], ['en', 360], ['ru', 360], ['it', 360]]) {
  const tag = `${lang} ${w} phone`;
  ok(`${tag}: the steps view is up with its four planes`, await open(w, lang), null);
  const p0 = await ev(probe);
  ok(`${tag}: F is shown, a 44 px chip`, p0.shown && p0.w === 44 && p0.h === 44, p0);
  ok(`${tag}: F is inside the rail's scroller, after the last plane`, p0.inRail && p0.afterPlanes, p0);
  // (the rail follows the ring: on the last plane it is at its end, and nothing else scrolls it on a phone)
  await ev('__cmwSteps({ go: 3, now: true }); 1');
  await ready(`(() => { const r = document.querySelector('#svStrip .sv-rail'); return !__cmwSteps().moving && Math.abs(r.scrollLeft + r.clientWidth - r.scrollWidth) < 1; })()`, 8000);
  const p1 = await ev(probe);
  ok(`${tag}: on the last plane F lies whole inside the rail and is what a tap there reaches`,
    p1.shown && p1.left >= p1.railL - 0.5 && p1.right <= p1.railR + 0.5 && p1.top >= p1.railT - 0.5 && p1.bottom <= p1.railB + 0.5 && p1.hit, p1);
  await touch((p1.left + p1.right) / 2, (p1.top + p1.bottom) / 2);
  const opened = await ready(`Phone._state().kind === 'edit' && __cmwSteps().sel === 'F'`, 5000);
  const p2 = await ev(probe);
  ok(`${tag}: a tap on F selects it and opens the Inspector sheet`, opened && p2.pressed === 'true', { opened, p2 });
}
ok('desktop: the steps view is up', await open(1440, 'en'), null);
const d = await ev(probe);
ok('desktop: F stays outside the rail, in the strip', d.shown && !d.inRail, d);
return { pass: fails.length === 0, fails, info };
