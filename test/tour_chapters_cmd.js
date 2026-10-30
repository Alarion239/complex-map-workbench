// The strip's chapter label is a menu (issue #34): the chapters with their minutes and a check on the finished ones; a
// pick starts that chapter. A command file for a CDP daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('tourchap' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);
await ev(`Tour.start({ chapter: 'basics' })`); await settle(1500);
const st = () => ev(`(() => { const c = document.querySelector('.ts-chap'); return { vis: !!(c && c.getClientRects().length), txt: c ? c.textContent.trim() : null, exp: c ? c.getAttribute('aria-expanded') : null, cur: Tour.current().id }; })()`);
let s = await st();
ok('the strip shows the chapter and its count as a button', s.vis && /^1\/\d+$/.test(s.txt), s);
await ev(`document.querySelector('.ts-chap').click()`); await settle(400);
const menu = await ev(`(() => { const m = document.querySelector('.tour-menu'); if (!m) return null; return { items: [...m.querySelectorAll('.mi')].map((b) => b.textContent.replace(/\\s+/g, ' ').trim()), cur: [...m.querySelectorAll('.mi[aria-current]')].map((b) => b.textContent.slice(0, 12)), head: (m.querySelector('.menu-head') || {}).textContent }; })()`);
ok('the menu lists the chapters, and only them', menu && menu.head === 'Chapters' && menu.items.length >= 5 && !menu.items.some((t) => /Reference guide|Keyboard shortcuts|Take the tour/.test(t)), menu);
ok('each chapter has its minutes and the running one is marked', menu && /min/.test(menu.items[0]) && menu.cur.length === 1 && /Basics/.test(menu.cur[0]), menu);
await ev(`(() => { const b = document.querySelectorAll('.tour-menu .mi')[1]; b.click(); })()`); await settle(1500);
s = await st();
ok('a pick starts that chapter', s.cur !== 'basics', s);
await ev(`Tour.end && Tour.end()`); await settle(300);
// a phone keeps its short count in the text, no chapter button
await view(390, 844, true, true); await settle(500);
await load('tourchapph' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);
await ev(`Tour.start({ chapter: 'basics' })`); await settle(1500);
s = await st();
ok('on a phone there is no chapter button', !s.vis, s);
return { pass: fails.length === 0, fails };
