// The tour's task titles and the Phase portrait task (issue #34): a step whose title is a task reads as one in Russian
// (Draw a shape: «Нарисуйте фигуру», Add a function: «Добавьте функцию», where the same words on a button stay in the
// infinitive), a title that starts in lower case (Cauchy integral) is capitalised in every language, and the Phase
// portrait step of Views now has a task (zoom in on a zero or a pole), done by a wheel zoom. 1440 px, en/ru/it.
// A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const settle = async (ms = 600) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const strip = () => ev(`(() => { const s = document.querySelector('.tour-strip'); const t = s && s.querySelector('.ts-title'), l = s && s.querySelector('.ts-l2'); return { title: t ? t.textContent.trim() : null, l2: l ? l.textContent.trim() : null, done: !!(l && l.classList.contains('done')), cur: Tour.current().id }; })()`);
const WANT = {
  en: { draw: 'Draw a shape', add: 'Add a function', cauchy: 'Cauchy integral', zoom: 'Zoom in on a zero or a pole.' },
  ru: { draw: 'Нарисуйте фигуру', add: 'Добавьте функцию', cauchy: 'Интеграл Коши', zoom: 'Приблизьте нуль или полюс.' },
  it: { draw: 'Disegna una figura', add: 'Aggiungi una funzione', cauchy: 'Integrale di Cauchy', zoom: 'Ingrandisci uno zero o un polo.' },
};
for (const lang of ['en', 'ru', 'it']) {
  await view(1440, 900, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=tt${lang}${Date.now()}&lang=${lang}` });
  await sleep(2600); await settle();
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); Tour.auto && Tour.auto(false); 1');
  const w = WANT[lang];
  const at = async (chapter, step) => { await ev(`Tour.start(${JSON.stringify({ chapter, step })})`); await settle(1500); return strip(); };
  let g = await at('basics', 4);
  ok(`${lang}: Draw a shape reads as a task`, g.cur === 'draw' && g.title === w.draw, g);
  g = await at('basics', 8);
  ok(`${lang}: Add a function reads as a task`, g.cur === 'add' && g.title === w.add, g);
  g = await at('analysis', 1);
  ok(`${lang}: Cauchy integral starts in capitals`, g.cur === 'cauchy' && g.title === w.cauchy, g);
  g = await at('views', 1);
  ok(`${lang}: the Phase portrait step has its task`, g.cur === 'phase' && (g.l2 || '').endsWith(w.zoom) && !g.done, g);
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 700, y: 450, deltaX: 0, deltaY: -120 });
  await settle(800);
  g = await strip();
  ok(`${lang}: a zoom ticks it`, g.done, g);
  info[lang] = g;
  await ev('Tour.stop()'); await settle(300);
}
return { pass: fails.length === 0, fails, info };
