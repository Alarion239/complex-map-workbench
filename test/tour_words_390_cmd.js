// The steps-view tour's task lines (#2233): the words and the ru titles at 390 px. In en, ru and it:
//   - Basics > Draw a shape names no "X" or "Y" (the steps view has one plane, named in its head), in its body, its task and its "then";
//   - a button is "Click"ed (a key is "Press"ed): no string of the tour says "press" with anything but a key after it;
//   - on a touch phone (390 wide) the two sound tasks that carry a "sound is off" line (Grieg on a curve, A loop sings its number) say
//     Tap / Коснитесь / Tocca, not Press, Click, Нажмите, Premi or Fai clic;
//   - at 390 px no step's title is cut with an ellipsis beside the chapter count (the strip's .ts-title: scrollWidth within clientWidth).
// It runs in the steps view (ci/suite_views.js: steps({ pin: true })). A command file for a CDP daemon (test/cdp_kit README); prints { pass, fails, info }.
const PORT = (typeof process !== 'undefined' && process.env.CMW_PORT) || (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const fails = [], info = {};
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const TOUR = `typeof Tour === 'object' && typeof I18N === 'object'`;
const READ = `(() => { const s = document.querySelector('.tour-strip'); const t = s && s.querySelector('.ts-title'), l = s && s.querySelector('.ts-l2'); return { title: t ? t.textContent.trim() : null, cut: t ? t.scrollWidth > t.clientWidth : null, room: t ? t.clientWidth : null, need: t ? t.scrollWidth : null, l2: l ? l.textContent.trim() : null, cur: Tour.current().id }; })()`;
const TAP = { en: /\bTap ▶/, ru: /Коснитесь ▶/, it: /Tocca ▶/ };   // (the strip's second line reads title, then task)
const MOUSE_VERB = { en: /\b(Press|Click)\b/, ru: /(Нажмите|Щёлкните)/, it: /(Premi|Fai clic)/ };
// (a string's own TeX is no letter of the prose: $z$, $w_1$)
const noTex = (s) => s.replace(/\$[^$]*\$/g, '');
const letterXY = (s) => /(^|[^\p{L}\p{N}_])[XY]([^\p{L}\p{N}_]|$)/u.test(noTex(s));
const KEY_AFTER_PRESS = /^(\{|[←→↑↓]|Esc\b|Enter\b|Space\b|Shift\b|Alt\b|Ctrl\b|Cmd\b|[A-Z][,.)]|[A-Z]$)/;

for (const lang of ['en', 'ru', 'it']) {
  await view(1440, 900, false, false);
  await go(`http://localhost:${PORT}/test.html?ns=tw${lang}${Date.now()}&lang=${lang}`);
  await settled({ until: `${TOUR} && I18N.lang === '${lang}'` });
  if (!(await isSteps())) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'], info };
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); Tour.auto && Tour.auto(false); 1');
  // the words of the data: the Draw step in the page's language, and every English string with "press" in it
  const data = await ev(`(() => {
    const st = Tour._t.CHAPTERS.find((c) => c.id === 'basics').steps.find((s) => s.id === 'draw');
    const tr = (s) => I18N.at(${JSON.stringify(lang)}).t(s);
    const strs = [];
    const walk = (v) => { if (typeof v === 'string') strs.push(v); else if (v && typeof v === 'object' && !(v instanceof Function)) for (const k of Object.keys(v)) walk(v[k]); };
    for (const c of Tour._t.CHAPTERS) for (const s of c.steps) walk(s);
    return { draw: [st.body, st.try && st.try.text, st.try && st.try.then].map((s) => tr(s || '')), press: strs.filter((s) => /\\b[Pp]ress /.test(s)) };
  })()`);
  info[lang + '_draw'] = data.draw;
  ok(`${lang}: Basics > Draw a shape (body, task, then) names no X or Y`, !data.draw.some(letterXY), data.draw);
  if (lang === 'en') {
    const bad = [];
    for (const s of data.press) for (const m of s.matchAll(/\b[Pp]ress (\S+)/g)) if (!KEY_AFTER_PRESS.test(m[1])) bad.push(m[0]);
    ok('en: "press" is for keys: a button is clicked (and tapped on a touch screen)', bad.length === 0, bad);
    // ("Press {C}, or Colour from here.": after a key, the other way is a verb of its own: click, choose)
    const bare = data.press.filter((s) => /\b[Pp]ress \{[^}]+\},? or [A-Z]/.test(s));
    ok('en: "press {key}, or" is followed by its own verb, not by a bare button name', bare.length === 0, bare);
  }
  await ev('Tour.stop && Tour.stop(); 1');

  // the phone: 390 px, touch
  await view(390, 844, false, true);
  await go(`http://localhost:${PORT}/test.html?ns=tp${lang}${Date.now()}&lang=${lang}`);
  await settled({ until: `${TOUR} && I18N.lang === '${lang}'` });
  await ev('Tour.dismissSuggestion && Tour.dismissSuggestion(); Tour.auto && Tour.auto(false); 1');
  const plan = JSON.parse(await ev(`JSON.stringify(Tour._t.CHAPTERS.flatMap((c) => c.steps.map((s, i) => [c.id, i, s.id])))`));
  const cuts = [], missed = [], sound = {};
  for (const [chapter, step, id] of plan) {
    await ev(`window.__shown = null; Tour.start(${JSON.stringify({ chapter, step })}); 1`);
    const r = await settled({ max: 6000, only: true, until: `Tour.isActive() && Tour.current().id === '${id}' && (() => { const g = ${READ}; if (!g.title) return false; window.__shown = window.__shown || g; return true; })()` });
    const g = r.ok ? await ev('window.__shown') : null;
    if (!g) { missed.push(`${chapter}/${id}`); continue; }
    if (g.cut) cuts.push(`${chapter}/${id}: ${g.title} (${g.need} px in ${g.room})`);
    if (id === 'song' || id === 'loop') sound[id] = g.l2;
    await ev('Tour.stop(); 1');
  }
  info[lang + '_phone'] = { steps: plan.length, missed, cuts, sound };
  ok(`${lang} at 390 px: the tour was walked (control: most steps showed their strip)`, plan.length - missed.length >= 30, { steps: plan.length, missed });
  ok(`${lang} at 390 px: no step's title is cut with an ellipsis`, cuts.length === 0, cuts);
  for (const id of ['song', 'loop']) {
    ok(`${lang} at 390 px: ${id}: the task line (the sound is off) is a tap`, !!sound[id] && TAP[lang].test(sound[id]) && !MOUSE_VERB[lang].test(sound[id]), sound[id]);
  }
}
return { pass: fails.length === 0, fails, info };
