// The guide (issue #34): a contents row that jumps to a section, a search that folds the others away, the sections
// Zeros and poles, Examples and Export, and a Show me that starts the section's tour chapter; the Deformation section
// describes the steps view's glide (in en and ru): none of the classic transport's words, and each control it names in
// bold is on the thread's strip or in its Playback dialog. A command file for a CDP daemon. It runs in the steps view (ci/suite_views.js: steps({ pin: true })), where the Try line is the steps view's own.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('guidenav' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settled();
if (!(await ev(`!!(window.__cmwSteps && __cmwSteps().on)`))) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'] };
// an example says what to try, in the tour's line, with a Show me
await ev(`__cmwExample(3)`); await settled();
const ln = await ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? { text: l.textContent.replace(/\\s+/g, ' ').trim(), btn: [...l.querySelectorAll('.tl-act')].map((b) => b.textContent.trim()) } : null; })()`);
ok('an example opens with its Try line and a Show me', ln && /Joukowski/.test(ln.text) && /Try: drag the circle through 1, then press ›/.test(ln.text) && ln.btn.some((b) => /Show me/.test(b)), ln);
await key('?', 0); await settled();
const g = await ev(`(() => { const m = document.querySelector('.modal'); if (!m) return null; return { toc: [...m.querySelectorAll('.guide-toc-b')].map((b) => b.textContent), secs: m.querySelectorAll('.guide-sec').length, find: !!m.querySelector('.guide-find'), show: [...m.querySelectorAll('.guide-show .btn')].length }; })()`);
ok('the guide has a contents row and a search', g && g.toc.length >= 12 && g.find && g.secs === g.toc.length, g);
ok('the new sections are there', g && ['Zeros and poles', 'Examples', 'Export'].every((t) => g.toc.includes(t)), g && g.toc);
ok('sections about what the tour teaches end in Show me', g && g.show >= 6, g);
// the search folds the sections that do not match
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = 'Overleaf'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settled();
const s = await ev(`({ shown: [...document.querySelectorAll('.guide-sec')].filter((x) => !x.hidden).map((x) => x.querySelector('h3').textContent), none: !document.querySelector('.guide-none').hidden })`);
ok('the search leaves the sections with the word', s.shown.length >= 1 && s.shown.includes('Export') && s.shown.length < 6 && !s.none, s);
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = 'qzxqzx'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settled();
ok('a search with no match says so', await ev(`!document.querySelector('.guide-none').hidden && ![...document.querySelectorAll('.guide-sec')].some((x) => !x.hidden)`), null);
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settled();
// the Deformation section is the steps view's glide: none of the classic transport's words (its X → Y, the transport under
// the panel, the Deformation button of the top bar and its turning off), and each control it names in bold is on the
// thread's strip or in its Playback dialog, by the name the page gives it (a bold lead ending in a full stop is a
// paragraph's title, not a control)
const DEFORM = `(() => { const sec = [...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === $t('Deformation'));
  if (!sec) return null;
  const names = new Set();
  const add = (v) => { if (v) names.add(v.replace(/\\s+/g, ' ').trim()); };
  for (const el of document.querySelectorAll('.sv-nav, .sv-playmore, .sv-loop, .sv-paths, .sv-choice, .sv-playpop-r > span')) { add(el.getAttribute('aria-label')); add(el.textContent); if (el.choices) for (const c of el.choices) add(c[1]); }
  add($t('Playback'));
  const bold = [...sec.querySelectorAll('p b')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()).filter((b) => !/[.:]$/.test(b));
  return { text: sec.textContent.replace(/\\s+/g, ' '), bold, missing: bold.filter((b) => !names.has(b)), names: [...names] };
})()`;
const d = await ev(DEFORM);
ok('the guide has a Deformation section', !!d, d);
ok('the Deformation section has none of the classic transport\'s words', d && !/X\s*→\s*Y|transport|top bar|panes|turning the deformation off/i.test(d.text), d && d.text.slice(0, 600));
ok('each control the Deformation section names in bold is on the strip or in Playback', d && d.bold.length >= 3 && d.missing.length === 0, d && { bold: d.bold, missing: d.missing, names: d.names });
// Show me on Views starts the steps view's chapter in its place, Planes
await ev(`[...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === 'Views').querySelector('.guide-show .btn').click()`); await settled();
const t = await ev(`({ modal: !!document.querySelector('.modal-bg'), cur: Tour.isActive() ? Tour.current().chapter : null })`);
ok('Show me closes the guide and starts that chapter', !t.modal && t.cur === 'planes', t);
// Show me on Deformation starts Playing the chain
await ev(`Tour.isActive() && Tour.stop && Tour.stop()`); await settled();
await key('?', 0); await settled();
await ev(`[...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === 'Deformation').querySelector('.guide-show .btn').click()`); await settled();
const tp = await ev(`({ modal: !!document.querySelector('.modal-bg'), cur: Tour.isActive() ? Tour.current().chapter : null })`);
ok('Show me on Deformation starts Playing the chain', !tp.modal && tp.cur === 'playing', tp);
// the same in Russian: the section's bold names are the page's Russian names for the controls
await go(`${await ev('location.origin')}/test.html?ns=guidenavru${Date.now()}&lang=ru`); await settled();
await ev(`Tour.isActive() && Tour.stop && Tour.stop()`); await settled();
await key('?', 0); await settled();
const dr = await ev(DEFORM);
ok('ru: each control the Deformation section names in bold is on the strip or in Playback', dr && dr.bold.length >= 3 && dr.missing.length === 0, dr && { bold: dr.bold, missing: dr.missing, names: dr.names });
ok('ru: the Deformation section has no X → Y', dr && !/X\s*→\s*Y/.test(dr.text), dr && dr.text.slice(0, 400));
// on a phone the strip has no speed select, Loop or ⋯: the section sends to Playback by holding ▶, as the line under its heading does
const origin = await ev('location.origin');
await view(412, 860, false, true);
await send('Page.navigate', { url: 'about:blank' }); await settled({ panes: false });
await go(`${origin}/test.html?ns=guidenavph${Date.now()}`); await settled();
await ev(`(document.querySelector('.modal-bg') || { remove() {} }).remove()`); await ev(`__tourApi.openGuide()`); await settled();
const dp = await ev(`(() => { const sec = [...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === 'Deformation'); return { ph: document.documentElement.classList.contains('ph'), text: sec ? sec.textContent.replace(/\\s+/g, ' ') : null }; })()`);
ok('phone: the Deformation section sends to Playback by holding ▶, and names no speed select or ⋯ on the thread', dp.ph && dp.text && /Hold ▶ to open Playback/.test(dp.text) && !/speed select|its ⋯/.test(dp.text), dp);
return { pass: fails.length === 0, fails };
