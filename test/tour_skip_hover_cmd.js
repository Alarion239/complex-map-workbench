// The tour strip's Skip stays outlined after a tap (issue #34): on a touch screen :hover stays on the button just
// tapped (Next, a step ago), which the shared .btn.primary :hover rule filled with the accent, so the quiet Skip
// looked like Next, with its label unreadable. 390 px touch: tap Next into a task step and read Skip's colours; then
// at 1440 with a mouse, hover Skip: it gets the hover shade, not the accent. en and ru. It runs in the steps view
// (ci/suite_views.js: steps({ pin: true })); the Draw task is found by its id, not by its place in the chapter. A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const TOUR = `typeof Tour === 'object' && typeof I18N === 'object'`;
const stepAt = (chapter, id) => ev(`Tour._t.CHAPTERS.find((c) => c.id === '${chapter}').steps.findIndex((s) => s.id === '${id}')`);
const rgb = (s) => (String(s).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// (the button turns into Skip a moment after the step starts: wait for the class, up to 6 s, before reading its colours)
const skipReady = async () => (await settled({ until: `!!document.querySelector('.tour-strip .ts-next.skip')`, max: 6000 })).ok;
const skip = () => ev(`(() => { const n = document.querySelector('.tour-strip .ts-next'); const cs = getComputedStyle(n); return { skip: n.classList.contains('skip'), bg: cs.backgroundColor, color: cs.color, hover: n.matches(':hover') }; })()`);
for (const lang of ['en', 'ru']) {
  await view(390, 844, false, true);
  await go(`http://localhost:${PORT}/test.html?ns=sk${lang}${Date.now()}&lang=${lang}`);
  await settled({ until: `${TOUR} && I18N.lang === '${lang}'` });
  if (!(await isSteps())) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'], info };
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); Tour.auto && Tour.auto(false); 1');
  const draw = await stepAt('basics', 'draw');
  await ev(`Tour.start({ chapter: 'basics', step: ${draw - 1} })`); await settled({ until: `Tour.isActive()` });
  const c = await ev(`(() => { const b = document.querySelector('.tour-strip .ts-next').getBoundingClientRect(); return [Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2)]; })()`);
  await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c[0], y: c[1] }] });
  await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await skipReady();
  const s = await skip();
  info[lang + ' touch'] = s;
  ok(`${lang} touch: Next led into the Draw task, where the button is Skip`, s.skip && (await ev('Tour.current().id')) === 'draw', s);
  ok(`${lang} touch: Skip is outlined (white), not the accent, though :hover stays on it`, rgb(s.bg).every((v) => v > 240), s);
  ok(`${lang} touch: Skip's label reads on its fill (4.5:1)`, ratio(rgb(s.color), rgb(s.bg)) >= 4.5, s);
}
await view(1440, 900, false, false);
await go(`http://localhost:${PORT}/test.html?ns=skd${Date.now()}`);
await settled({ until: TOUR });
await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); Tour.auto && Tour.auto(false); 1');
await ev(`Tour.start({ chapter: 'basics', step: ${await stepAt('basics', 'draw')} })`); await settled({ until: `Tour.isActive()` });
const d = await ev(`(() => { const b = document.querySelector('.tour-strip .ts-next').getBoundingClientRect(); return [Math.round(b.left + b.width / 2), Math.round(b.top + b.height / 2)]; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: d[0], y: d[1] });
await skipReady();
const h = await skip();
info.mouse = h;
ok('mouse: hovering Skip gives the hover shade, not the accent', h.skip && h.hover && ratio(rgb(h.color), rgb(h.bg)) >= 4.5 && rgb(h.bg).every((v) => v > 200), h);
return { pass: fails.length === 0, fails, info };
