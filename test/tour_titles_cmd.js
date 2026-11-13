// The tour's task titles and the Phase portrait task (issue #34): a step whose title is a task reads as one in Russian
// (Draw a shape: «Нарисуйте фигуру», Add a function: «Добавьте функцию», where the same words on a button stay in the
// infinitive), a title that starts in lower case (Cauchy integral) is capitalised in every language, and the Phase
// portrait step of Views now has a task (zoom in on a zero or a pole), done by a wheel zoom. 1440 px, en/ru/it. It runs in
// the steps view (ci/suite_views.js: steps({ pin: true })); a step is found by its id, not by its place in the chapter.
// (Tour.start returns a promise that ev would await, so the call ends in a value and the strip is read as it shows.)
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const TOUR = `typeof Tour === 'object' && typeof I18N === 'object'`;
// (the strip as the page shows it: a step's task may be done at once and the countdown moves the tour on, so a step's strip is
// read at the moment it first shows, in the wait for it)
const READ = `(() => { const s = document.querySelector('.tour-strip'); const t = s && s.querySelector('.ts-title'), l = s && s.querySelector('.ts-l2'); return { title: t ? t.textContent.trim() : null, l2: l ? l.textContent.trim() : null, done: !!(l && l.classList.contains('done')), cur: Tour.current().id }; })()`;
const strip = () => ev(READ);
const WANT = {
  en: { draw: 'Draw a shape', add: 'Add a function', cauchy: 'Cauchy integral', zoom: 'Drag empty space, or scroll to zoom.' },
  ru: { draw: 'Нарисуйте фигуру', add: 'Добавьте функцию', cauchy: 'Интеграл Коши', zoom: 'Перетащите пустое место или прокрутите колёсико.' },
  it: { draw: 'Disegna una figura', add: 'Aggiungi una funzione', cauchy: 'Integrale di Cauchy', zoom: 'Trascina uno spazio vuoto, oppure scorri per ingrandire.' },
};
for (const lang of ['en', 'ru', 'it']) {
  await view(1440, 900, false, false);
  await go(`http://localhost:${PORT}/test.html?ns=tt${lang}${Date.now()}&lang=${lang}`);
  await settled({ until: `${TOUR} && I18N.lang === '${lang}'` });
  if (!(await isSteps())) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'], info };
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); Tour.auto && Tour.auto(false); 1');
  const w = WANT[lang];
  const at = async (chapter, id) => { const step = await ev(`Tour._t.CHAPTERS.find((c) => c.id === '${chapter}').steps.findIndex((s) => s.id === '${id}')`); await ev(`window.__shown = null; Tour.start(${JSON.stringify({ chapter, step })}); 1`); await settled({ until: `Tour.isActive() && Tour.current().id === '${id}' && (() => { const g = ${READ}; if (!g.title) return false; window.__shown = window.__shown || g; return true; })()` }); return ev(`window.__shown`); };
  let g = await at('basics', 'draw');
  ok(`${lang}: Draw a shape reads as a task`, g.cur === 'draw' && g.title === w.draw, g);
  g = await at('basics', 'add');
  ok(`${lang}: Add a function reads as a task`, g.cur === 'add' && g.title === w.add, g);
  g = await at('analysis', 'cauchy');
  ok(`${lang}: Cauchy integral starts in capitals`, g.cur === 'cauchy' && g.title === w.cauchy, g);
  g = await at('planes', 'plane');
  ok(`${lang}: the plane step has its task`, g.cur === 'plane' && (g.l2 || '').endsWith(w.zoom) && !g.done, g);
  await settled();   // (the step's own actions have run and it listens: the wheel then ticks the task)
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: -120 });
  await settled({ until: `!!document.querySelector('.tour-strip .ts-l2.done')`, max: 3000 });
  g = await strip();
  ok(`${lang}: a zoom ticks it`, g.done, g);
  info[lang] = g;
  await ev('Tour.stop()'); await settled({ until: `!Tour.isActive()` });
}
return { pass: fails.length === 0, fails, info };
