// The guide (issue #34): a contents row that jumps to a section, a search that folds the others away, the sections
// Zeros and poles, Examples and Export, and a Show me that starts the section's tour chapter. A command file for a CDP
// daemon.
const settle = async (ms = 500) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const fails = [];
const ok = (name, pass, detail) => { if (!pass) fails.push(`${name}: ${JSON.stringify(detail)}`); };
await view(1440, 900, false, false);
await load('guidenav' + Date.now(), { shapes: [], steps: [{ type: 'sin', params: {}, on: true }], srcView: { cx: 0, cy: 0, s: 80 }, view: { main: 'xy' } });
await settle(1500);
// an example says what to try, in the tour's line, with a Show me
await ev(`__cmwExample(3)`); await settle(1800);
const ln = await ev(`(() => { const l = document.querySelector('.tour-lane[data-lane="example"]'); return l ? { text: l.textContent.replace(/\\s+/g, ' ').trim(), btn: [...l.querySelectorAll('.tl-act')].map((b) => b.textContent.trim()) } : null; })()`);
ok('an example opens with its Try line and a Show me', ln && /Joukowski/.test(ln.text) && /Try: drag the circle through 1/.test(ln.text) && ln.btn.some((b) => /Show me/.test(b)), ln);
await ev(`openGuide ? 0 : 0`).catch(() => 0);
await key('?', 0); await settle(800);
const g = await ev(`(() => { const m = document.querySelector('.modal'); if (!m) return null; return { toc: [...m.querySelectorAll('.guide-toc-b')].map((b) => b.textContent), secs: m.querySelectorAll('.guide-sec').length, find: !!m.querySelector('.guide-find'), show: [...m.querySelectorAll('.guide-show .btn')].length }; })()`);
ok('the guide has a contents row and a search', g && g.toc.length >= 12 && g.find && g.secs === g.toc.length, g);
ok('the new sections are there', g && ['Zeros and poles', 'Examples', 'Export'].every((t) => g.toc.includes(t)), g && g.toc);
ok('sections about what the tour teaches end in Show me', g && g.show >= 6, g);
// the search folds the sections that do not match
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = 'Overleaf'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settle(200);
const s = await ev(`({ shown: [...document.querySelectorAll('.guide-sec')].filter((x) => !x.hidden).map((x) => x.querySelector('h3').textContent), none: !document.querySelector('.guide-none').hidden })`);
ok('the search leaves the sections with the word', s.shown.length >= 1 && s.shown.includes('Export') && s.shown.length < 6 && !s.none, s);
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = 'qzxqzx'; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settle(200);
ok('a search with no match says so', await ev(`!document.querySelector('.guide-none').hidden && ![...document.querySelectorAll('.guide-sec')].some((x) => !x.hidden)`), null);
await ev(`(() => { const f = document.querySelector('.guide-find'); f.value = ''; f.dispatchEvent(new Event('input', { bubbles: true })); })()`); await settle(200);
// Show me on Views starts the Views chapter
await ev(`[...document.querySelectorAll('.guide-sec')].find((x) => x.querySelector('h3').textContent === 'Views').querySelector('.guide-show .btn').click()`); await settle(1500);
const t = await ev(`({ modal: !!document.querySelector('.modal-bg'), cur: Tour.isActive() ? Tour.current().chapter : null })`);
ok('Show me closes the guide and starts that chapter', !t.modal && t.cur === 'views', t);
return { pass: fails.length === 0, fails };
