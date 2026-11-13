// The strip's chapter label is a menu (issue #34): the chapters with their minutes and a check on the finished ones; a
// pick starts that chapter. It runs in the steps view (ci/suite_views.js: steps({ pin: true })), where the tour's strip is the
// same. A command file for a CDP daemon.
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
const STATE = { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } };
const STRIP = `typeof Tour === 'object' && !!document.querySelector('.ts-chap')`;
await view(1440, 900, false, false);
await loadView(null, 'tourchap' + Date.now(), STATE);
await settled({ until: `typeof Tour === 'object'` });
if (!(await isSteps())) return { pass: false, fails: ['the page is not in the steps view (this suite is tagged steps({ pin: true }) in ci/suite_views.js)'] };
await ev(`Tour.start({ chapter: 'basics' })`); await settled({ until: STRIP });
const st = () => ev(`(() => { const c = document.querySelector('.ts-chap'); return { vis: !!(c && c.getClientRects().length), txt: c ? c.textContent.trim() : null, exp: c ? c.getAttribute('aria-expanded') : null, cur: Tour.current().id }; })()`);
let s = await st();
ok('the strip shows the chapter and its count as a button', s.vis && /^1\/\d+$/.test(s.txt), s);
await ev(`document.querySelector('.ts-chap').click()`); await settled({ until: `!!document.querySelector('.tour-menu')` });
const menu = await ev(`(() => { const m = document.querySelector('.tour-menu'); if (!m) return null; return { items: [...m.querySelectorAll('.mi')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()), cur: [...m.querySelectorAll('.mi[aria-current]')].map((b) => b.textContent.slice(0, 12)), head: (m.querySelector('.menu-head') || {}).textContent }; })()`);
ok('the menu lists the chapters, and only them', menu && menu.head === 'Chapters' && menu.items.length >= 5 && !menu.items.some((t) => /Reference guide|Keyboard shortcuts|Take the tour/.test(t)), menu);
ok('each chapter has its minutes and the running one is marked', menu && /min/.test(menu.items[0]) && menu.cur.length === 1 && /Basics/.test(menu.cur[0]), menu);
await ev(`(() => { const b = document.querySelectorAll('.tour-menu .mi')[1]; b.click(); })()`); await settled({ until: `Tour.current().chapter !== 'basics'` });
s = await st();
ok('a pick starts that chapter', s.cur !== 'basics', s);
await ev(`Tour.stop()`); await settled({ until: `!document.querySelector('.ts-chap')` });
// a phone keeps its short count in the text, no chapter button
await view(390, 844, true, true);
await loadView(null, 'tourchapph' + Date.now(), STATE);
await settled({ until: `typeof Tour === 'object'` });
await ev(`Tour.start({ chapter: 'basics' })`); await settled({ until: `!!document.querySelector('.tour-strip')` });
s = await st();
ok('on a phone there is no chapter button', !s.vis, s);
return { pass: fails.length === 0, fails };
